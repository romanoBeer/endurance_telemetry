# ACC Pitwall

A **team** race-engineer system for Assetto Corsa Competizione, in the spirit of
ACC DRIVE: live HUD, fuel/stint strategy, and **remote pitstop** control that an
engineer or teammate can push at the driver from any device.

Built to your stack where it counts: **Python** agent + relay (proven by
PyAccEngineer for exactly this), **React/TypeScript** web UI (one codebase that
serves both a browser dashboard *and* a transparent in-game overlay).

```
   ACC (rig, Windows)
        │ shared memory + UDP broadcasting
   ┌────▼─────┐  telemetry+strategy      ┌──────────────┐
   │  AGENT   │ ───────WebSocket───────▶ │ RELAY SERVER │
   │ (Python) │ ◀──── pit commands ───── │   (Python)   │
   └──────────┘                          └──────┬───────┘
                                    fan-out      │
                       ┌─────────────────────────┼─────────────────────────┐
                  ┌────▼────┐               ┌─────▼─────┐             ┌──────▼──────┐
                  │ Browser │               │ Teammate  │             │  Overlay    │
                  │dashboard│               │  / phone  │             │ (transparent│
                  └─────────┘               └───────────┘             │  on the rig)│
                                                                      └─────────────┘
```

The agent reads telemetry and computes the engineer numbers; the relay fans them
out to everyone in the room and routes pit commands back to the driver's agent,
which (on a real rig) drives the pit MFD via keypresses. See `PROTOCOL.md` for
the wire format.

---

## Run it now (no ACC needed)

Three terminals. The agent's simulator drives the whole pipeline so you can see
it work before touching the game.

```bash
# 1) Relay
cd server && pip install -r requirements.txt
uvicorn relay:app --host 0.0.0.0 --port 8765

# 2) Agent (simulated stint)
cd agent && pip install -r requirements.txt
python agent.py --server ws://localhost:8765/ws --room team-spa-6h --name romanoBeer --sim

# 3) Web dashboard
cd web && npm install && npm run dev
# open http://localhost:5173  → room "team-spa-6h", name "engineer"
```

You'll see live (fake) telemetry, and the **Pit Strategy** panel will push a
command the agent receives and acks. Open the URL on your phone (same LAN) to see
the teammate view; add `?overlay=1` for the slim overlay.

On a real rig (Windows + ACC running), drop `--sim` and the agent reads live
shared memory instead.

---

## Layout

```
server/relay.py            FastAPI WebSocket hub: rooms, fan-out, command routing
agent/
  agent.py                 connects to relay, streams telemetry, applies pit cmds
  sources.py               SimulatedSource + Windows SharedMemorySource
  acc_shared_memory.py     ctypes structs for the 3 ACC pages + decoder
  strategy.py              rolling fuel/lap, laps-to-go, fuel-to-add
web/src/
  useRelay.ts              WebSocket hook: presence + per-driver feeds + sendStrategy
  Dashboard.tsx / Overlay.tsx
  components/              HudBar, TyreWidget, BrakeWidget, FuelStrategy, StrategyPanel
overlay-shell/             transparent always-on-top Tauri window (loads ?overlay=1)
PROTOCOL.md                the wire contract
```

---

## Verified

The Python spine was tested end-to-end (relay + agent-in-sim + a viewer client):
telemetry fanned out driver→relay→viewer, a `set_strategy` command routed to the
driver agent, was applied, and acked back. The web app typechecks (`tsc`) and
builds (`vite build`) clean.

## Things to finish before race day

1. **Pit MFD application** (`agent/apply_strategy`) — the real-ACC keypress walk
   of the pit MFD is stubbed. ACC has no API to set it directly; like
   PyAccEngineer you diff current vs desired MFD state and emit keypresses
   (wire in `pydirectinput` per your binds).
2. **Shared-memory layout** — validate `acc_shared_memory.py` against your ACC
   build, or `pip install pyaccsharedmemory` and swap its reader in (the agent
   only needs a Snapshot dict, so the source is pluggable).
3. **Hosting the relay** — for teammates outside your LAN, run `relay.py` on a
   small VPS (it's stateless/in-memory). Put it behind TLS (`wss://`) and add a
   room password check in the `join` handler.

## Roadmap (Phase 2)

- **UDP broadcasting client** in the agent → live timing + the full grid, not
  just your own car. Unlocks proper standings and the early yellow-flag predictor.
- **Stint history / export** — log laps + fuel per driver for post-race review.
- **Driver-swap aware strategy** — per-driver fuel models across a stint.
```
