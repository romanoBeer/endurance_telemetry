// Mirrors the Snapshot / Strategy payloads from the agent (camelCase).

export interface Telemetry {
  connected: boolean;
  status: number;
  session: number;
  gear: number;
  rpm: number;
  maxRpm: number;
  speedKmh: number;
  fuel: number;
  maxFuel: number;
  gas: number;
  brake: number;
  tyrePressure: number[];
  tyreCoreTemp: number[];
  tyreWear: number[];        // 0..100% tread remaining per corner (FL,FR,RL,RR)
  brakeTemp: number[];
  padLife: number[];
  discLife: number[];
  carDamage: number[];
  airTemp: number;
  roadTemp: number;
  position: number;
  completedLaps: number;
  iCurrentTime: number;
  iLastTime: number;
  iBestTime: number;
  sessionTimeLeft: number;
  isInPit: boolean;
  isInPitLane: boolean;
  fuelPerLap: number;
  fuelEstimatedLaps: number;
  isValidLap: boolean;
  globalYellow: boolean;
  flag: number;
  rainIntensity: number;
  rainIn10min: number;
  rainIn30min: number;
  trackGripStatus: number;
  carModel: string;
  track: string;
  playerNick: string;
  tyreCompound: string;
  trackPos?: number;          // 0..1 spline position of the player's car
  standings?: Standing[];     // live field (optional: only the sim/UDP feed has it)
  forecast?: ForecastSlot[];  // weather curve for the next ~45 min
  electronics?: Electronics;  // TC / ABS / brake bias / map ...
  lastSectors?: number[];     // [s1,s2,s3] ms of the last completed lap
  bestSectors?: number[];     // [s1,s2,s3] ms theoretical best
  curSector?: number;         // 0,1,2 — sector the car is currently in
  estimatedLapMs?: number;    // projected lap from current pace
  windSpeedMs?: number;
  windDir?: number;           // degrees
  cornerName?: string;
  brakeBias?: number;
  tyreSetLaps?: number;
}

export interface Electronics {
  tc: number;
  tcCut: number;
  abs: number;
  bb: number;     // brake bias %
  map: number;    // engine map
  fArb: number;   // front anti-roll bar
  rArb: number;   // rear anti-roll bar
}

/** One car in the live field. */
export interface Standing {
  position: number;      // race position (standings order)
  name: string;
  carNumber: number;
  trackPos: number;      // 0..1 around the lap — drives the map + on-track order
  gapToLeaderMs: number; // time behind the leader
  intervalMs: number;    // gap to the car ahead in the standings
  lastLapMs: number;
  bestLapMs?: number;
  sectors?: number[];    // [s1,s2,s3] ms of the last lap
  lapsCompleted: number;
  tyreCompound: string;
  tyreAgeLaps: number;
  carClass?: string;     // GOL / PLA / SIL / BRO driver category
  carBrand?: string;     // manufacturer slug
  pitCount?: number;
  inPit: boolean;
  isPlayer: boolean;
}

/** One point on the weather forecast curve. */
export interface ForecastSlot {
  minutes: number;   // minutes from now
  rain: number;      // 0..1 intensity
  airTemp: number;   // °C
  trackTemp: number; // °C
  grip: number;      // 0..1
}

export interface Strategy {
  avgFuelPerLap: number;
  lapsInTank: number;
  lapsRemainingInSession: number;
  fuelToFinish: number;
  fuelToAdd: number;
  hasData: boolean;
}

export interface PitCommand {
  fuelToAdd: number;
  changeTyres: boolean;
  pressures: number[];
  tyreSet: number;
}

export const SESSION_NAMES: Record<number, string> = {
  [-1]: "Unknown", 0: "Practice", 1: "Qualifying", 2: "Race",
  3: "Hotlap", 4: "Time Attack", 5: "Drift", 6: "Drag",
};

export function formatLapTime(ms: number): string {
  if (!ms || ms <= 0 || ms === 2147483647) return "--:--.---";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const milli = ms % 1000;
  return `${m}:${s.toString().padStart(2, "0")}.${milli.toString().padStart(3, "0")}`;
}

export function formatClock(seconds: number): string {
  if (seconds <= 0) return "0:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
