"""The 'race engineer' math: rolling fuel-per-lap, laps remaining, fuel to add.

Computed on the agent (per driver) and streamed alongside telemetry so every
device in the room sees identical engineer numbers.
"""

from __future__ import annotations

from collections import deque
from dataclasses import asdict, dataclass

ROLLING_LAPS = 5
SAFETY_MARGIN_L = 0.5


@dataclass
class Strategy:
    avgFuelPerLap: float = 0.0
    lapsInTank: float = 0.0
    lapsRemainingInSession: float = 0.0
    fuelToFinish: float = 0.0
    fuelToAdd: float = 0.0
    hasData: bool = False

    def as_dict(self) -> dict:
        return asdict(self)


class StrategyEngine:
    def __init__(self) -> None:
        self._last_laps = -1
        self._fuel_at_lap_start = 0.0
        self._burns: deque[float] = deque(maxlen=ROLLING_LAPS)
        self._last_lap_ms = 0

    def update(self, t: dict) -> Strategy:
        if not t.get("connected"):
            return Strategy()

        laps = int(t["completedLaps"])
        fuel = float(t["fuel"])

        # On a completed lap, record fuel burned (ignoring refuel jumps).
        if laps != self._last_laps:
            if self._last_laps >= 0:
                burned = self._fuel_at_lap_start - fuel
                if 0.0 < burned < self._fuel_at_lap_start:
                    self._burns.append(burned)
            self._last_laps = laps
            self._fuel_at_lap_start = fuel
            if t.get("iLastTime", 0) > 0:
                self._last_lap_ms = int(t["iLastTime"])

        avg = (sum(self._burns) / len(self._burns)) if self._burns \
            else max(float(t.get("fuelPerLap", 0.0)), 0.0)

        laps_in_tank = (fuel / avg) if avg > 0 else 0.0

        time_left = float(t.get("sessionTimeLeft", 0.0))
        if self._last_lap_ms > 0 and time_left > 0:
            # +1: ACC lets you start a final lap if you cross the line in time.
            import math
            laps_remaining = math.ceil(time_left / (self._last_lap_ms / 1000.0)) + 1
        else:
            laps_remaining = 0.0

        fuel_to_finish = max(laps_remaining * avg + SAFETY_MARGIN_L, 0.0)
        max_fuel = float(t.get("maxFuel", 0.0))
        fuel_to_add = max(min(fuel_to_finish - fuel, max_fuel - fuel), 0.0)

        return Strategy(
            avgFuelPerLap=round(avg, 3),
            lapsInTank=round(laps_in_tank, 2),
            lapsRemainingInSession=float(laps_remaining),
            fuelToFinish=round(fuel_to_finish, 2),
            fuelToAdd=round(fuel_to_add, 2),
            hasData=len(self._burns) > 0,
        )
