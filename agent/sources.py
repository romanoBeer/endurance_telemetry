"""Telemetry sources. Each yields a Snapshot dict via `.poll()`.

  * SimulatedSource    — fake race, any OS, no game needed.
  * SharedMemorySource — real ACC, Windows only (memory-mapped pages).

`build_source()` picks automatically; set ACC_PITWALL_SIM=1 to force the sim.
"""

from __future__ import annotations

import math
import os
import sys
import time

from acc_shared_memory import Graphics, Physics, Static, to_snapshot


# A synthetic GT3 field so the leaderboard / track map / pit-exit predictor have
# real data without the game. Each car laps at a slightly different pace, so the
# *on-track* order (spline position) drifts away from the *standings* order —
# exactly what the engineer needs to read. Player is injected separately.
_FIELD = [
    {"num": 63, "name": "Bortolotti",  "lap_len": 103.4, "compound": "dry", "cls": "PLA", "brand": "lamborghini"},
    {"num": 88, "name": "Engel",       "lap_len": 103.9, "compound": "dry", "cls": "GOL", "brand": "mercedes"},
    {"num": 51, "name": "Pier Guidi",  "lap_len": 104.2, "compound": "dry", "cls": "SIL", "brand": "ferrari"},
    {"num": 25, "name": "Vanthoor",    "lap_len": 104.6, "compound": "dry", "cls": "GOL", "brand": "audi"},
    {"num": 7,  "name": "Marciello",   "lap_len": 105.1, "compound": "dry", "cls": "GOL", "brand": "mercedes"},
    {"num": 30, "name": "Feller",      "lap_len": 105.7, "compound": "dry", "cls": "PLA", "brand": "audi"},
    {"num": 99, "name": "Mies",        "lap_len": 106.3, "compound": "dry", "cls": "SIL", "brand": "audi"},
]

# Split a lap time into three plausible sectors (Imola-ish 21% / 32% / 47%).
def _sectors(lap_ms: int, jitter: float) -> list[int]:
    fr = [0.214 + jitter, 0.318 - jitter * 0.5, 0.468 - jitter * 0.5]
    return [int(lap_ms * f) for f in fr]


class SimulatedSource:
    """Synthesizes a plausible endurance stint so the whole pipeline is alive."""

    def __init__(self) -> None:
        self.start = time.monotonic()
        self.fuel = 45.0
        self.lap = 0
        self.lap_started = 0.0
        # Stagger the field around the player (offset 0): some ahead, some behind,
        # so the player sits mid-pack and the order actually shuffles over a stint.
        n = len(_FIELD)
        self._offsets = [(i - n / 2) * 7.0 + (i % 3) * 1.7 for i in range(n)]

    def _standings(self, t: float, player_lap_len: float) -> list[dict]:
        """Build the live field: each car's lap count, spline pos (0..1) and gaps.

        Track order = sort by spline position; standings = sort by total distance
        (laps + spline). They diverge because lap pace differs car-to-car."""
        player_dist = self.lap + ((t - self.lap_started) / player_lap_len)
        cars = [{
            "num": 96, "name": os.environ.get("ACC_DRIVER", "romanoBeer"),
            "compound": "dry", "isPlayer": True, "inPit": False,
            "lap_len": player_lap_len, "dist": player_dist,
            "cls": "PLA", "brand": "ferrari",
        }]
        for car, off in zip(_FIELD, self._offsets):
            elapsed = max(t + off, 0.0)
            dist = elapsed / car["lap_len"]
            cars.append({
                "num": car["num"], "name": car["name"], "compound": car["compound"],
                "isPlayer": False, "inPit": False, "lap_len": car["lap_len"],
                "dist": dist, "cls": car["cls"], "brand": car["brand"],
            })

        # Standings: most total distance first. Leader's distance sets the gaps.
        order = sorted(cars, key=lambda c: c["dist"], reverse=True)
        leader_dist = order[0]["dist"]
        out = []
        prev_dist = None
        for pos, c in enumerate(order, start=1):
            # Convert a distance deficit (in laps) to a time gap via lap length.
            gap_to_leader = (leader_dist - c["dist"]) * c["lap_len"]
            interval = 0.0 if prev_dist is None else (prev_dist - c["dist"]) * c["lap_len"]
            prev_dist = c["dist"]
            spline = c["dist"] - math.floor(c["dist"])
            last_ms = int(c["lap_len"] * 1000)
            jit = ((c["num"] % 7) - 3) * 0.004
            best_ms = last_ms - 120 - (c["num"] % 5) * 35
            out.append({
                "position": pos, "name": c["name"], "carNumber": c["num"],
                "trackPos": round(spline, 4),
                "gapToLeaderMs": int(gap_to_leader * 1000),
                "intervalMs": int(interval * 1000),
                "lastLapMs": last_ms,
                "bestLapMs": best_ms,
                "sectors": _sectors(last_ms, jit),
                "lapsCompleted": int(c["dist"]),
                "tyreCompound": c["compound"],
                "tyreAgeLaps": int(c["dist"]) % 18,
                "carClass": c["cls"], "carBrand": c["brand"],
                "pitCount": 0,
                "inPit": c["inPit"], "isPlayer": c["isPlayer"],
            })
        return out

    def _forecast(self, t: float) -> list[dict]:
        """A simple drying/incoming-weather curve for the Weather tab."""
        slots = []
        for mins in (0, 10, 20, 30, 45):
            # Rain builds toward ~30 min then eases; temps track inversely.
            wave = math.sin((t / 60.0 + mins) * 0.12)
            rain = max(0.0, min(1.0, 0.15 + wave * 0.5))
            slots.append({
                "minutes": mins,
                "rain": round(rain, 2),
                "airTemp": round(24.0 - rain * 4.0, 1),
                "trackTemp": round(31.0 - rain * 9.0, 1),
                "grip": round(max(0.0, 1.0 - rain * 0.6), 2),
            })
        return slots

    def poll(self) -> dict:
        t = time.monotonic() - self.start
        lap_len = 105.0
        if t - self.lap_started >= lap_len:
            self.lap += 1
            self.lap_started = t
            self.fuel -= 2.6
            if self.fuel < 4.0:
                self.fuel = 45.0  # pretend we pitted
        lap_t = t - self.lap_started
        phase = lap_t / lap_len
        standings = self._standings(t, lap_len)
        me = next((c for c in standings if c["isPlayer"]), None)

        wave = abs(math.sin(lap_t * 0.9))
        speed = 80.0 + wave * 180.0
        rpm = int(4500 + wave * 3200)
        gear = int(2 + wave * 4) + 1
        brake = (1.0 - wave) ** 2
        heat = math.sin(lap_t * 0.5) * 4.0
        base = 78.0 + self.lap * 0.4

        return {
            "connected": True, "status": 2, "session": 2,
            "gear": gear, "rpm": rpm, "maxRpm": 7800, "speedKmh": speed,
            "fuel": round(self.fuel, 2), "maxFuel": 120.0,
            "gas": round(wave, 2), "brake": round(brake, 2),
            "tyrePressure": [27.4, 27.6, 27.1, 27.8],
            "tyreCoreTemp": [base + heat, base + heat + 1.5,
                             base + heat - 2.0, base + heat + 2.5],
            # Tread remaining: wears ~1.6%/lap, fronts a touch harder, reset on pit.
            "tyreWear": [max(100.0 - (self.lap * 1.6 + phase * 1.6) * f, 4.0)
                         for f in (1.05, 1.08, 0.95, 0.97)],
            "brakeTemp": [320 + brake * 300, 330 + brake * 300,
                          260 + brake * 200, 265 + brake * 200],
            "padLife": [22.0, 22.0, 25.0, 25.0],
            "discLife": [30.0, 30.0, 31.0, 31.0],
            "carDamage": [0, 0, 0, 0, 0],
            "airTemp": 24.0, "roadTemp": 31.0,
            "position": me["position"] if me else 4,
            "trackPos": me["trackPos"] if me else 0.0,
            "standings": standings,
            "forecast": self._forecast(t),
            "completedLaps": self.lap,
            "iCurrentTime": int(lap_t * 1000),
            "iLastTime": 105300, "iBestTime": 104800,
            "sessionTimeLeft": max(3600.0 - t, 0.0),
            "isInPit": False, "isInPitLane": False,
            "fuelPerLap": 2.6, "fuelEstimatedLaps": self.fuel / 2.6,
            "isValidLap": True,
            "globalYellow": 0.45 < phase < 0.55, "flag": 0,
            "rainIntensity": 0, "rainIn10min": 0, "rainIn30min": 1,
            "trackGripStatus": 4,
            "carModel": "ferrari_296_gt3", "track": "spa",
            "playerNick": os.environ.get("ACC_DRIVER", "romanoBeer"),
            "tyreCompound": "dry_compound",
            # --- richer engineer data for the pro pitwall layout ---
            "electronics": {"tc": 4, "tcCut": 0, "abs": 2, "bb": 56.2,
                            "map": 1, "fArb": 0, "rArb": 0},
            "lastSectors": _sectors(105300, 0.0),
            "bestSectors": _sectors(104800, 0.0),
            "curSector": 0 if phase < 0.214 else (1 if phase < 0.532 else 2),
            "estimatedLapMs": 104117,
            "windSpeedMs": round(wave * 1.5, 1), "windDir": int((t * 6) % 360),
            "cornerName": "Acque Minerali (T11)",
            "brakeBias": 56.2,
            "tyreSetLaps": self.lap % 18,
        }


class SharedMemorySource:
    """Reads ACC's three mapped pages on Windows via mmap + ctypes."""

    def __init__(self) -> None:
        import mmap
        self._mmap = mmap
        self._p = mmap.mmap(-1, ctypes_size(Physics), "Local\\acpmf_physics",
                            access=mmap.ACCESS_READ)
        self._g = mmap.mmap(-1, ctypes_size(Graphics), "Local\\acpmf_graphics",
                            access=mmap.ACCESS_READ)
        self._s = mmap.mmap(-1, ctypes_size(Static), "Local\\acpmf_static",
                            access=mmap.ACCESS_READ)

    def poll(self) -> dict:
        self._p.seek(0); self._g.seek(0); self._s.seek(0)
        p = Physics.from_buffer_copy(self._p.read(ctypes_size(Physics)))
        g = Graphics.from_buffer_copy(self._g.read(ctypes_size(Graphics)))
        s = Static.from_buffer_copy(self._s.read(ctypes_size(Static)))
        return to_snapshot(p, g, s)


def ctypes_size(struct) -> int:
    import ctypes
    return ctypes.sizeof(struct)


def build_source():
    force_sim = os.environ.get("ACC_PITWALL_SIM") == "1"
    if sys.platform == "win32" and not force_sim:
        try:
            return SharedMemorySource()
        except Exception as e:  # noqa: BLE001
            print(f"[agent] shared memory unavailable ({e}); using simulator")
    return SimulatedSource()
