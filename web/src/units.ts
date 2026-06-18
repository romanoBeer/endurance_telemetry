// Unit system. Telemetry is always metric on the wire (km/h, L, psi*, °C); the
// UI converts at the edge based on the engineer's Settings. Keeping the raw
// values metric means the strategy math never has to care about display units.
//
// *ACC reports tyre pressure in psi already, so psi is our base here.

export type SpeedUnit = "kmh" | "mph";
export type VolUnit = "l" | "gal";
export type PressUnit = "psi" | "kpa";
export type TempUnit = "c" | "f";

export interface Settings {
  speed: SpeedUnit;
  vol: VolUnit;
  press: PressUnit;
  temp: TempUnit;
  pitLossSec: number; // pit-lane time loss, drives the pit-exit predictor
}

export const DEFAULT_SETTINGS: Settings = {
  speed: "kmh",
  vol: "l",
  press: "psi",
  temp: "c",
  pitLossSec: 24,
};

interface Disp {
  value: number;
  unit: string;
}

export function speed(kmh: number, u: SpeedUnit): Disp {
  return u === "mph"
    ? { value: kmh * 0.621371, unit: "mph" }
    : { value: kmh, unit: "km/h" };
}

export function volume(litres: number, u: VolUnit): Disp {
  return u === "gal"
    ? { value: litres * 0.264172, unit: "gal" }
    : { value: litres, unit: "L" };
}

export function pressure(psi: number, u: PressUnit): Disp {
  return u === "kpa"
    ? { value: psi * 6.89476, unit: "kPa" }
    : { value: psi, unit: "psi" };
}

export function temp(celsius: number, u: TempUnit): Disp {
  return u === "f"
    ? { value: celsius * 9 / 5 + 32, unit: "°F" }
    : { value: celsius, unit: "°C" };
}

/** Format a Disp with a chosen precision, e.g. `27.4 psi`. */
export function fmt(d: Disp, digits = 1): string {
  return `${d.value.toFixed(digits)} ${d.unit}`;
}

/** Compact mm:ss.mmm — also handles negative deltas with a sign. */
export function gap(ms: number): string {
  if (ms === 0) return "—";
  const sign = ms < 0 ? "-" : "+";
  const a = Math.abs(ms);
  if (a < 60000) return `${sign}${(a / 1000).toFixed(1)}s`;
  const m = Math.floor(a / 60000);
  const s = Math.floor((a % 60000) / 1000);
  return `${sign}${m}:${s.toString().padStart(2, "0")}`;
}
