# ACC Pitwall — wire protocol

All messages are JSON over a single WebSocket. Every message has a `type`.
Two roles connect to a **room** (one room per team session):

- **driver** — an agent running on a rig. Source of telemetry, target of pit commands.
- **viewer** — a dashboard / phone / engineer. Receives telemetry, may send commands.

A room can hold several drivers (driver-swap teams); telemetry is tagged with
the driver's `name` so the UI can show whoever's in the car.

---

## Connect

First message a client sends after the socket opens:

```json
{ "type": "join", "room": "team-spa-6h", "role": "driver", "name": "romanoBeer" }
```

Server replies:

```json
{ "type": "joined", "room": "team-spa-6h", "role": "driver", "self": "romanoBeer" }
```

## Telemetry  (driver → server → all viewers)

Sent ~15 Hz by each driver agent. Server re-broadcasts to every viewer in the
room, tagging the source driver.

```json
{
  "type": "telemetry",
  "driver": "romanoBeer",
  "telemetry": { "...Snapshot fields (camelCase)..." },
  "strategy":  { "...Strategy fields..." }
}
```

## Presence  (server → everyone, on join/leave)

```json
{ "type": "presence", "drivers": ["romanoBeer"], "viewers": ["engineer_nathan"] }
```

## Pit strategy command  (viewer → server → target driver)

An engineer pushes a strategy at the driver currently in the car.

```json
{
  "type": "set_strategy",
  "target": "romanoBeer",
  "strategy": { "fuelToAdd": 52.0, "changeTyres": true,
                "pressures": [27.4, 27.4, 27.1, 27.1], "tyreSet": 3 }
}
```

Server forwards it to the matching driver agent, which applies it (real ACC: by
driving the pit MFD; sim: logs + acks). The agent then acks:

```json
{ "type": "strategy_ack", "driver": "romanoBeer", "applied": true }
```

The server relays the ack to viewers so the engineer sees it landed.

## Errors

```json
{ "type": "error", "message": "room is full" }
```
