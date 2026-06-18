import type { Telemetry } from "../types";
import { useSettings } from "../settings";
import { pressure, temp } from "../units";

const TEMP_IDEAL: [number, number] = [80, 95];
const PRESS_IDEAL: [number, number] = [27.0, 27.8];
const LABELS = ["FL", "FR", "RL", "RR"];

function tempColor(c: number): string {
  if (c < TEMP_IDEAL[0] - 8) return "var(--cold)";
  if (c < TEMP_IDEAL[0]) return "var(--cool)";
  if (c <= TEMP_IDEAL[1]) return "var(--good)";
  if (c <= TEMP_IDEAL[1] + 8) return "var(--warm)";
  return "var(--hot)";
}
function pressColor(p: number): string {
  if (p < PRESS_IDEAL[0] - 0.5) return "var(--cold)";
  if (p < PRESS_IDEAL[0]) return "var(--cool)";
  if (p <= PRESS_IDEAL[1]) return "var(--good)";
  if (p <= PRESS_IDEAL[1] + 0.5) return "var(--warm)";
  return "var(--hot)";
}

export function TyreWidget({ t }: { t: Telemetry }) {
  const { settings } = useSettings();
  return (
    <div className="panel">
      <h3 className="panel-title">Tyres</h3>
      <div className="tyre-grid">
        {[0, 1, 2, 3].map((idx) => {
          const tp = temp(t.tyreCoreTemp[idx], settings.temp);
          const pr = pressure(t.tyrePressure[idx], settings.press);
          return (
            <div key={idx} className="tyre-block" style={{ borderColor: tempColor(t.tyreCoreTemp[idx]) }}>
              <span className="tyre-corner">{LABELS[idx]}</span>
              <span className="tyre-temp" style={{ color: tempColor(t.tyreCoreTemp[idx]) }}>{tp.value.toFixed(0)}{settings.temp === "f" ? "°F" : "°"}</span>
              <span className="tyre-press" style={{ color: pressColor(t.tyrePressure[idx]) }}>{pr.value.toFixed(settings.press === "kpa" ? 0 : 1)} {pr.unit}</span>
            </div>
          );
        })}
      </div>
      <div className="subtle">Compound: {t.tyreCompound || "—"}</div>
    </div>
  );
}
