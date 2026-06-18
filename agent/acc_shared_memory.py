"""ACC shared-memory layout via ctypes (Windows).

Ports the three mapped pages — acpmf_physics / acpmf_graphics / acpmf_static —
into ctypes Structures and decodes the fields we need into a flat `Snapshot`
dict (camelCase, matching the wire protocol).

Layout fidelity: as with any binary mapping, field *order and type* must match
ACC's SDK header byte-for-byte; one wrong type shifts everything after it. This
matches the public assetto_corsa_SDK headers (2023 GTWC era). Validate on the
rig, or pip-install the maintained `pyaccsharedmemory` and swap its reader in —
the rest of the agent only needs a `Snapshot` dict, so the source is pluggable.

Note: c_wchar is 2 bytes on Windows (correct here) but 4 on Linux. That's fine
because shared memory only exists on Windows; the simulator never touches these.
"""

from __future__ import annotations

import ctypes as C

f = C.c_float
i = C.c_int32


class Physics(C.Structure):
    _fields_ = [
        ("packetId", i), ("gas", f), ("brake", f), ("fuel", f),
        ("gear", i), ("rpms", i), ("steerAngle", f), ("speedKmh", f),
        ("velocity", f * 3), ("accG", f * 3),
        ("wheelSlip", f * 4), ("wheelLoad", f * 4),
        ("wheelsPressure", f * 4), ("wheelAngularSpeed", f * 4),
        ("tyreWear", f * 4), ("tyreDirtyLevel", f * 4),
        ("tyreCoreTemp", f * 4), ("camberRAD", f * 4),
        ("suspensionTravel", f * 4),
        ("drs", f), ("tc", f), ("heading", f), ("pitch", f), ("roll", f),
        ("cgHeight", f), ("carDamage", f * 5),
        ("numberOfTyresOut", i), ("pitLimiterOn", i), ("abs", f),
        ("kersCharge", f), ("kersInput", f), ("autoShifterOn", i),
        ("rideHeight", f * 2), ("turboBoost", f), ("ballast", f),
        ("airDensity", f), ("airTemp", f), ("roadTemp", f),
        ("localAngularVel", f * 3), ("finalFF", f), ("performanceMeter", f),
        ("engineBrake", i), ("ersRecoveryLevel", i), ("ersPowerLevel", i),
        ("ersHeatCharging", i), ("ersIsCharging", i), ("kersCurrentKJ", f),
        ("drsAvailable", i), ("drsEnabled", i),
        ("brakeTemp", f * 4), ("clutch", f),
        ("tyreTempI", f * 4), ("tyreTempM", f * 4), ("tyreTempO", f * 4),
        ("isAIControlled", i),
        ("tyreContactPoint", (f * 3) * 4),
        ("tyreContactNormal", (f * 3) * 4),
        ("tyreContactHeading", (f * 3) * 4),
        ("brakeBias", f), ("localVelocity", f * 3),
        # ACC tail
        ("p2pActivations", i), ("p2pStatus", i), ("currentMaxRpm", i),
        ("mz", f * 4), ("fx", f * 4), ("fy", f * 4),
        ("slipRatio", f * 4), ("slipAngle", f * 4),
        ("tcinAction", i), ("absInAction", i),
        ("suspensionDamage", f * 4), ("tyreTemp", f * 4),
        ("waterTemp", f), ("brakePressure", f * 4),
        ("frontBrakeCompound", i), ("rearBrakeCompound", i),
        ("padLife", f * 4), ("discLife", f * 4),
        ("ignitionOn", i), ("starterEngineOn", i), ("isEngineRunning", i),
        ("kerbVibration", f), ("slipVibrations", f),
        ("gVibrations", f), ("absVibrations", f),
    ]


W = C.c_wchar


class Graphics(C.Structure):
    _fields_ = [
        ("packetId", i), ("status", i), ("session", i),
        ("currentTime", W * 15), ("lastTime", W * 15),
        ("bestTime", W * 15), ("split", W * 15),
        ("completedLaps", i), ("position", i),
        ("iCurrentTime", i), ("iLastTime", i), ("iBestTime", i),
        ("sessionTimeLeft", f), ("distanceTraveled", f),
        ("isInPit", i), ("currentSectorIndex", i), ("lastSectorTime", i),
        ("numberOfLaps", i), ("tyreCompound", W * 33),
        ("replayTimeMultiplier", f), ("normalizedCarPosition", f),
        ("activeCars", i), ("carCoordinates", (f * 3) * 60),
        ("carID", i * 60), ("playerCarID", i), ("penaltyTime", f),
        ("flag", i), ("penalty", i), ("idealLineOn", i),
        ("isInPitLane", i), ("surfaceGrip", f), ("mandatoryPitDone", i),
        ("windSpeed", f), ("windDirection", f),
        ("isSetupMenuVisible", i), ("mainDisplayIndex", i),
        ("secondaryDisplayIndex", i), ("tc", i), ("tcCut", i),
        ("engineMap", i), ("abs", i), ("fuelXLap", f),
        ("rainLights", i), ("flashingLights", i), ("lightsStage", i),
        ("exhaustTemperature", f), ("wiperLV", i),
        ("driverStintTotalTimeLeft", i), ("driverStintTimeLeft", i),
        ("rainTyres", i), ("sessionIndex", i), ("usedFuel", f),
        ("deltaLapTime", W * 15), ("iDeltaLapTime", i),
        ("estimatedLapTime", W * 15), ("iEstimatedLapTime", i),
        ("isDeltaPositive", i), ("iSplit", i), ("isValidLap", i),
        ("fuelEstimatedLaps", f), ("trackStatus", W * 33),
        ("missingMandatoryPits", i), ("clock", f),
        ("directionLightsLeft", i), ("directionLightsRight", i),
        ("globalYellow", i), ("globalYellow1", i), ("globalYellow2", i),
        ("globalYellow3", i), ("globalWhite", i), ("globalGreen", i),
        ("globalChequered", i), ("globalRed", i),
        ("mfdTyreSet", i), ("mfdFuelToAdd", f),
        ("mfdTyrePressureLF", f), ("mfdTyrePressureRF", f),
        ("mfdTyrePressureLR", f), ("mfdTyrePressureRR", f),
        ("trackGripStatus", i), ("rainIntensity", i),
        ("rainIntensityIn10min", i), ("rainIntensityIn30min", i),
        ("currentTyreSet", i), ("strategyTyreSet", i),
    ]


class Static(C.Structure):
    _fields_ = [
        ("smVersion", W * 15), ("acVersion", W * 15),
        ("numberOfSessions", i), ("numCars", i),
        ("carModel", W * 33), ("track", W * 33),
        ("playerName", W * 33), ("playerSurname", W * 33),
        ("playerNick", W * 33), ("sectorCount", i),
        ("maxTorque", f), ("maxPower", f), ("maxRpm", i), ("maxFuel", f),
        ("suspensionMaxTravel", f * 4), ("tyreRadius", f * 4),
        ("maxTurboBoost", f), ("deprecated1", f), ("deprecated2", f),
        ("penaltiesEnabled", i), ("aidFuelRate", f), ("aidTyreRate", f),
        ("aidMechanicalDamage", f), ("aidAllowTyreBlankets", i),
        ("aidStability", f), ("aidAutoClutch", i), ("aidAutoBlip", i),
        ("hasDRS", i), ("hasERS", i), ("hasKERS", i), ("kersMaxJ", f),
        ("engineBrakeSettingsCount", i), ("ersPowerControllerCount", i),
        ("trackSplineLength", f), ("trackConfiguration", W * 33),
        ("ersMaxJ", f), ("isTimedRace", i), ("hasExtraLap", i),
        ("carSkin", W * 33), ("reversedGridPositions", i),
        ("pitWindowStart", i), ("pitWindowEnd", i), ("isOnline", i),
        ("dryTyresName", W * 33), ("wetTyresName", W * 33),
    ]


AC_LIVE = 2


def to_snapshot(p: Physics, g: Graphics, s: Static) -> dict:
    """Decode the three pages into the flat camelCase Snapshot the UI uses."""
    return {
        "connected": g.status == AC_LIVE,
        "status": g.status, "session": g.session,
        "gear": p.gear, "rpm": p.rpms, "maxRpm": s.maxRpm,
        "speedKmh": p.speedKmh, "fuel": p.fuel, "maxFuel": s.maxFuel,
        "gas": p.gas, "brake": p.brake,
        "tyrePressure": list(p.wheelsPressure),
        "tyreCoreTemp": list(p.tyreCoreTemp),
        "brakeTemp": list(p.brakeTemp),
        "padLife": list(p.padLife), "discLife": list(p.discLife),
        "carDamage": list(p.carDamage),
        "airTemp": p.airTemp, "roadTemp": p.roadTemp,
        "position": g.position, "completedLaps": g.completedLaps,
        "iCurrentTime": g.iCurrentTime, "iLastTime": g.iLastTime,
        "iBestTime": g.iBestTime, "sessionTimeLeft": g.sessionTimeLeft,
        "isInPit": bool(g.isInPit), "isInPitLane": bool(g.isInPitLane),
        "fuelPerLap": g.fuelXLap, "fuelEstimatedLaps": g.fuelEstimatedLaps,
        "isValidLap": bool(g.isValidLap),
        "globalYellow": bool(g.globalYellow), "flag": g.flag,
        "rainIntensity": g.rainIntensity,
        "rainIn10min": g.rainIntensityIn10min,
        "rainIn30min": g.rainIntensityIn30min,
        "trackGripStatus": g.trackGripStatus,
        "carModel": s.carModel, "track": s.track,
        "playerNick": s.playerNick, "tyreCompound": g.tyreCompound,
    }
