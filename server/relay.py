"""ACC Pitwall relay server.

A thin WebSocket hub. Drivers (agents) push telemetry; the server fans it out to
every viewer in the same room and routes pit-strategy commands from viewers back
to the targeted driver. State is in-memory and per-room — restart-safe by design
(clients just reconnect).

Run:
    pip install -r requirements.txt
    uvicorn relay:app --host 0.0.0.0 --port 8765
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Literal

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

app = FastAPI(title="ACC Pitwall Relay")

Role = Literal["driver", "viewer"]


@dataclass
class Client:
    ws: WebSocket
    name: str
    role: Role


@dataclass
class Room:
    name: str
    clients: list[Client] = field(default_factory=list)

    def drivers(self) -> list[Client]:
        return [c for c in self.clients if c.role == "driver"]

    def viewers(self) -> list[Client]:
        return [c for c in self.clients if c.role == "viewer"]

    def presence(self) -> dict:
        return {
            "type": "presence",
            "drivers": [c.name for c in self.drivers()],
            "viewers": [c.name for c in self.viewers()],
        }


rooms: dict[str, Room] = {}


async def send(ws: WebSocket, msg: dict) -> None:
    try:
        await ws.send_text(json.dumps(msg))
    except Exception:
        pass  # client likely gone; cleanup happens on disconnect


async def broadcast(room: Room, msg: dict, *, to: Role | None = None,
                    exclude: WebSocket | None = None) -> None:
    for c in room.clients:
        if to and c.role != to:
            continue
        if c.ws is exclude:
            continue
        await send(c.ws, msg)


@app.get("/health")
async def health():
    return {"ok": True, "rooms": {r.name: len(r.clients) for r in rooms.values()}}


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    client: Client | None = None
    room: Room | None = None
    try:
        # First message must be a join.
        raw = await ws.receive_text()
        hello = json.loads(raw)
        if hello.get("type") != "join":
            await send(ws, {"type": "error", "message": "expected join"})
            await ws.close()
            return

        room_name = str(hello.get("room", "default"))
        role: Role = "driver" if hello.get("role") == "driver" else "viewer"
        name = str(hello.get("name", "anon"))

        room = rooms.setdefault(room_name, Room(room_name))
        client = Client(ws=ws, name=name, role=role)
        room.clients.append(client)

        await send(ws, {"type": "joined", "room": room_name,
                        "role": role, "self": name})
        await broadcast(room, room.presence())

        # Main loop.
        while True:
            msg = json.loads(await ws.receive_text())
            mtype = msg.get("type")

            if mtype == "telemetry" and client.role == "driver":
                msg["driver"] = client.name
                await broadcast(room, msg, to="viewer")

            elif mtype == "set_strategy" and client.role == "viewer":
                target = msg.get("target")
                for d in room.drivers():
                    if d.name == target:
                        await send(d.ws, msg)
                        break

            elif mtype == "strategy_ack" and client.role == "driver":
                msg["driver"] = client.name
                await broadcast(room, msg, to="viewer")

            elif mtype == "ping":
                await send(ws, {"type": "pong"})

    except WebSocketDisconnect:
        pass
    except Exception as e:  # noqa: BLE001 — never let one client crash the hub
        await send(ws, {"type": "error", "message": str(e)})
    finally:
        if room and client and client in room.clients:
            room.clients.remove(client)
            if room.clients:
                await broadcast(room, room.presence())
            else:
                rooms.pop(room.name, None)
