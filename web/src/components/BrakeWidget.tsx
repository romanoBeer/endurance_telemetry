import type { Telemetry } from "../types";
import { useSettings } from "../settings";
import { temp } from "../units";

const LABELS = ["FL", "FR", "RL", "RR"];

function brakeColor(c: number): string {
  if (c < 200) return "var(--cold)";
  if (c < 300) return "var(--cool)";
  if (c <= 650) return "var(--good)";
  if (c <= 800) return "var(--warm)";
  return "var(--hot)";
}

export function BrakeWidget({ t }: { t: Telemetry }) {
  const { settings } = useSettings();
  return (
    <div className="panel">
      <h3 className="panel-title">Brakes</h3>
      <div className="bar-rows">
        {[0, 1, 2, 3].map((idx) => {
          const c = t.brakeTemp[idx];
          const pct = Math.min(c / 900, 1) * 100;
          const disp = temp(c, settings.temp);
          return (
            <div key={idx} className="bar-row">
              <span className="bar-label">{LABELS[idx]}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${pct}%`, background: brakeColor(c) }} />
              </div>
              <span className="bar-val">{disp.value.toFixed(0)}{settings.temp === "f" ? "°F" : "°"}</span>
            </div>
          );
        })}
      </div>
      <div className="subtle">
        Pads ~{Math.min(...t.padLife).toFixed(0)}mm · Discs ~{Math.min(...t.discLife).toFixed(0)}mm
      </div>
    </div>
  );
}
