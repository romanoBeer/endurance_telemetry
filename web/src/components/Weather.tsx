import type { ForecastSlot, Telemetry } from "../types";
import { useSettings } from "../settings";
import { temp, fmt } from "../units";

/**
 * Weather tab. Current conditions plus the agent's short forecast curve. The
 * rain bars give the engineer the "is it coming / is it drying" read that drives
 * the wet-tyre gamble.
 */
function rainLabel(r: number): string {
  if (r < 0.05) return "Dry";
  if (r < 0.25) return "Damp";
  if (r < 0.55) return "Light rain";
  if (r < 0.8) return "Rain";
  return "Heavy rain";
}

export function Weather({ t }: { t: Telemetry }) {
  const { settings } = useSettings();
  const forecast: ForecastSlot[] = t.forecast ?? [];
  const T = (c: number) => fmt(temp(c, settings.temp), 0);

  return (
    <div className="weather-tab">
      <div className="panel">
        <h3 className="panel-title">Conditions now</h3>
        <div className="stat-grid">
          <Cell label="Sky" value={rainLabel(t.rainIntensity)} />
          <Cell label="Air" value={T(t.airTemp)} />
          <Cell label="Track" value={T(t.roadTemp)} />
          <Cell label="Grip" value={`${t.trackGripStatus}`} />
        </div>
      </div>

      <div className="panel">
        <h3 className="panel-title">Forecast · next 45 min</h3>
        {forecast.length === 0 ? (
          <div className="subtle">No forecast on this feed.</div>
        ) : (
          <div className="fc-grid">
            {forecast.map((f) => (
              <div key={f.minutes} className="fc-slot">
                <span className="fc-time">{f.minutes === 0 ? "now" : `+${f.minutes}m`}</span>
                <div className="fc-bar-track">
                  <div
                    className="fc-bar-fill"
                    style={{ height: `${Math.max(f.rain * 100, 3)}%`, background: f.rain > 0.4 ? "var(--cold)" : "var(--accent)" }}
                  />
                </div>
                <span className="fc-rain">{Math.round(f.rain * 100)}%</span>
                <span className="fc-sky subtle">{rainLabel(f.rain)}</span>
                <span className="fc-temp subtle">{T(f.airTemp)} / {T(f.trackTemp)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="subtle fc-foot">Rain probability · air / track temp per slot.</div>
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-val">{value}</span>
    </div>
  );
}
