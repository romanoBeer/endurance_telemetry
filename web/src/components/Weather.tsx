import { useEffect, useMemo, useRef, useState } from "react";
import type { ForecastSlot, Telemetry } from "../types";
import { useSettings } from "../settings";
import { temp, fmt } from "../units";
import { pointAt, ribbonPath } from "./TrackMap";

/**
 * Weather tab. A live radar map plus current conditions and the agent's short
 * forecast curve. The radar is synthesised from the sim feed (rain intensity +
 * wind) so it shows the weather the driver actually feels, not real-world sky.
 * The rain bars give the engineer the "is it coming / is it drying" read that
 * drives the wet-tyre gamble.
 */
function rainLabel(r: number): string {
  if (r < 0.05) return "Dry";
  if (r < 0.25) return "Damp";
  if (r < 0.55) return "Light rain";
  if (r < 0.8) return "Rain";
  return "Heavy rain";
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
function compass(deg: number): string {
  return COMPASS[Math.round(((deg % 360) / 45)) % 8];
}

export function Weather({ t }: { t: Telemetry }) {
  const { settings } = useSettings();
  const forecast: ForecastSlot[] = t.forecast ?? [];
  const T = (c: number) => fmt(temp(c, settings.temp), 0);

  return (
    <div className="weather-tab">
      <RadarMap t={t} />

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

const TRACK_PATH = ribbonPath();

// Fixed pool of rain cells. Each has a base position + a per-cell weight so the
// pattern is irregular; opacity/size are then modulated by live rain intensity.
const CELLS = Array.from({ length: 16 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  return { bx: r(1) * 120 - 10, by: r(2) * 120 - 10, w: 0.5 + r(3) * 0.5, rad: 10 + r(4) * 14 };
});

/**
 * Live sim weather radar. Rain cells drift along the wind vector (meteorological
 * windDir = where the wind comes FROM) and wrap around the box; their density and
 * opacity track rainIntensity. The track ribbon and player car are overlaid so
 * the engineer can read which part of the lap the next cell is about to hit.
 */
function RadarMap({ t }: { t: Telemetry }) {
  const [clock, setClock] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      setClock((now - start) / 1000);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  const rain = Math.max(0, Math.min(1, t.rainIntensity ?? 0));
  const windMs = t.windSpeedMs ?? 0;
  const windDir = t.windDir ?? 0;

  // Drift direction = where the wind blows TO (windDir + 180), in screen space
  // (north up, y grows downward). Speed scaled so even light wind is visible.
  const toRad = ((windDir + 180) * Math.PI) / 180;
  const dirX = Math.sin(toRad);
  const dirY = -Math.cos(toRad);
  const driftSpeed = 1.5 + windMs * 0.9; // box-units per second
  const phase = clock * driftSpeed;

  // Wind arrow from centre.
  const arrLen = Math.min(34, 8 + windMs * 2.4);
  const ax = 50 + dirX * arrLen;
  const ay = 50 + dirY * arrLen;

  const player = useMemo(() => {
    const p = t.trackPos ?? (t.standings?.find((s) => s.isPlayer)?.trackPos ?? 0);
    return pointAt(p);
  }, [t.trackPos, t.standings]);

  const wrap = (v: number) => ((v % 140) + 140) % 140 - 20; // keep cells around the box

  return (
    <div className="panel radar-panel">
      <h3 className="panel-title">
        Live Radar · {t.track || "—"}
        <span className="radar-tag">{rainLabel(rain)} · {Math.round(rain * 100)}%</span>
      </h3>
      <svg viewBox="0 0 100 100" className="radar-map" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="cellgrad">
            <stop offset="0%" stopColor="var(--cold)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--cold)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width="100" height="100" className="radar-bg" />
        {[12, 24, 36].map((r) => (
          <circle key={r} cx="50" cy="50" r={r} className="radar-ring" />
        ))}
        <line x1="50" y1="0" x2="50" y2="100" className="radar-ring" />
        <line x1="0" y1="50" x2="100" y2="50" className="radar-ring" />

        {/* rain cells */}
        {rain > 0.02 &&
          CELLS.map((c, i) => {
            const x = wrap(c.bx + dirX * phase);
            const y = wrap(c.by + dirY * phase);
            const op = Math.min(0.85, rain * c.w * 1.2);
            const rr = c.rad * (0.5 + rain * 0.8);
            return <circle key={i} cx={x} cy={y} r={rr} fill="url(#cellgrad)" opacity={op} />;
          })}

        {/* track + player */}
        <path d={TRACK_PATH} className="radar-ribbon" />
        <g transform={`translate(${player.x} ${player.y})`}>
          <circle r={3} className="radar-car" />
        </g>

        {/* wind arrow */}
        <g className="radar-wind">
          <line x1="50" y1="50" x2={ax} y2={ay} />
          <circle cx={ax} cy={ay} r={2.2} />
        </g>

        {/* compass N */}
        <text x="50" y="7" className="radar-n">N</text>
      </svg>
      <div className="subtle radar-foot">
        Cells drift with wind {compass(windDir)} {windMs.toFixed(1)} m/s · player marked · synthesised from sim feed
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
