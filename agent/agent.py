"""ACC Pitwall agent — runs on a driver's rig.

Polls a telemetry source, computes strategy, and streams both to the relay.
Listens for pit-strategy commands from engineers and applies them (real ACC:
by driving the pit MFD via keypresses; sim: logs + acks).

Run:
    pip install -r requirements.txt
    python agent.py --server ws://RELAY_HOST:8765/ws --room team-spa-6h --name romanoBeer
    # add --sim to force the simulator (or set ACC_PITWALL_SIM=1)
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os

import websockets

from sources import build_source
from strategy import StrategyEngine

UI_HZ = 15


async def producer(ws, source, engine, name: str) -> None:
    period = 1.0 / UI_HZ
    while True:
        snap = source.poll()
        strat = engine.update(snap)
        await ws.send(json.dumps({
            "type": "telemetry",
            "telemetry": snap,
            "strategy": strat.as_dict(),
        }))
        await asyncio.sleep(period)


def apply_strategy(strategy: dict, *, sim: bool) -> bool:
    """Set the pit strategy in-game.

    Sim mode just logs. On a real rig this is where you drive the pit MFD: ACC
    has no API to set it directly, so (like PyAccEngineer) you compute the delta
    between the current MFD state and the desired state, then emit the virtual
    keypresses to walk the MFD there. That logic is keybind-dependent and lives
    here — wire in your input library (e.g. pydirectinput) per your ACC binds.
    """
    print(f"[agent] applying strategy: {strategy}")
    if sim:
        return True
    # TODO(real ACC): navigate pit MFD via keypresses to match `strategy`.
    return True


async def consumer(ws, *, sim: bool, name: str) -> None:
    async for raw in ws:
        msg = json.loads(raw)
        mtype = msg.get("type")
        if mtype == "set_strategy" and msg.get("target") == name:
            ok = apply_strategy(msg.get("strategy", {}), sim=sim)
            await ws.send(json.dumps({"type": "strategy_ack", "applied": ok}))
        elif mtype == "joined":
            print(f"[agent] joined room '{msg['room']}' as {msg['self']}")


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--server", default="ws://localhost:8765/ws")
    ap.add_argument("--room", default="default")
    ap.add_argument("--name", default=os.environ.get("ACC_DRIVER", "romanoBeer"))
    ap.add_argument("--sim", action="store_true")
    args = ap.parse_args()

    if args.sim:
        os.environ["ACC_PITWALL_SIM"] = "1"
    source = build_source()
    engine = StrategyEngine()
    sim = os.environ.get("ACC_PITWALL_SIM") == "1"

    print(f"[agent] connecting to {args.server} (source={type(source).__name__})")
    async with websockets.connect(args.server) as ws:
        await ws.send(json.dumps({
            "type": "join", "room": args.room,
            "role": "driver", "name": args.name,
        }))
        await asyncio.gather(
            producer(ws, source, engine, args.name),
            consumer(ws, sim=sim, name=args.name),
        )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
