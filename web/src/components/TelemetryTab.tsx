import { useEffect, useRef } from "react";
import type { DriverFeed } from "../useRelay";
import { useSettings } from "../settings";
import { speed as cvSpeed, pressure as cvPress, temp as cvTemp } from "../units";

/**
 * Rolling-scope telemetry, in the spirit of a MoTeC / data-logger overlay:
 * throttle, brake, speed/gear/rpm and the tyres scroll right-to-left as the car
 * laps. The relay only carries the latest sample, so we keep our own ring buffer
 * here and push one frame on every telemetry tick (the parent re-renders per
 * message, which fires the effect).
 */

const CAP = 480; // ~32 s of history at 15 Hz

interface Sample {
  gas: number;
  brake: number;
  speedKmh: number;
  gear: number;
  rpm: number;
  maxRpm: number;
  press: number[];
  temp: number[];
  wear: number[];
}

const TYRE_COLORS = ["var(--hot)", "var(--warm)", "var(--cold)", "#a78bfa"]; // FL FR RL RR
const TYRE_LABELS = ["FL", "FR", "RL", "RR"];

export function TelemetryTab({ feed }: { feed: DriverFeed }) {
  const { settings } = useSettings();
  const buf = useRef<Sample[]>([]);
  const t = feed.telemetry;

  // Append the current frame whenever a new telemetry message lands.
  useEffect(() => {
    buf.current.push({
      gas: t.gas, brake: t.brake, speedKmh: t.speedKmh, gear: t.gear,
      rpm: t.rpm, maxRpm: t.maxRpm,
      press: t.tyrePressure ?? [], temp: t.tyreCoreTemp ?? [], wear: t.tyreWear ?? [],
    });
    if (buf.current.length > CAP) buf.current.splice(0, buf.current.length - CAP);
  }, [feed.lastUpdate]);

  const s = buf.current;
  const gearLabel = (g: number) => (g === 0 ? "R" : g === 1 ? "N" : String(g - 1));
  const spd = cvSpeed(t.speedKmh, settings.speed);

  return (
    <div className="telem-tab">
      <Scope title="THROTTLE" badge={`${Math.round(t.gas * 100)}%`} badgeColor="var(--good)"
        series={[
          { vals: s.map((x) => x.gas), min: 0, max: 1, color: "var(--good)", w: 2.2 },
          { vals: s.map((x) => x.brake), min: 0, max: 1, color: "var(--hot)", w: 1, dim: true },
        ]} />

      <Scope title="BRAKE" badge={`${Math.round(t.brake * 100)}%`} badgeColor="var(--hot)"
        series={[
          { vals: s.map((x) => x.brake), min: 0, max: 1, color: "var(--hot)", w: 2.2 },
          { vals: s.map((x) => x.gas), min: 0, max: 1, color: "var(--good)", w: 1, dim: true },
        ]} />

      <Scope title="SPEED / GEAR / RPM"
        legend={[
          { label: `${Math.round(spd.value)} ${spd.unit}`, color: "var(--cool)" },
          { label: `gear ${gearLabel(t.gear)}`, color: "var(--text)" },
          { label: `${t.rpm.toLocaleString()} rpm`, color: "var(--warm)" },
        ]}
        series={[
          { vals: s.map((x) => x.speedKmh), min: 0, max: Math.max(60, ...s.map((x) => x.speedKmh)), color: "var(--cool)", w: 1.6 },
          { vals: s.map((x) => x.gear), min: 0, max: 8, color: "var(--text)", w: 1.4, step: true },
          { vals: s.map((x) => x.rpm), min: 0, max: t.maxRpm || 8000, color: "var(--warm)", w: 1.6 },
        ]} />

      <div className="panel scope">
        <div className="scope-head">
          <span className="scope-title">TYRES · pressure</span>
          <div className="tyre-chips">
            {TYRE_LABELS.map((lbl, i) => {
              const p = cvPress(t.tyrePressure?.[i] ?? 0, settings.press);
              return (
                <span key={lbl} className="tyre-chip" style={{ background: TYRE_COLORS[i] }}>
                  {lbl} {p.value.toFixed(settings.press === "kpa" ? 0 : 1)}
                </span>
              );
            })}
          </div>
        </div>
        <ScopeSvg height={180}
          series={[0, 1, 2, 3].map((i) => ({
            vals: s.map((x) => x.press[i] ?? 0), min: 24.5, max: 28.5, color: TYRE_COLORS[i], w: 1.4,
          }))}
          axis={[28.5, 26.5, 24.5].map((v) => ({ v, min: 24.5, max: 28.5, label: String(v) }))} />
        <div className="tyre-readout">
          {TYRE_LABELS.map((lbl, i) => {
            const tp = cvTemp(t.tyreCoreTemp?.[i] ?? 0, settings.temp);
            const wear = t.tyreWear?.[i] ?? 0;
            return (
              <div key={lbl} className="tyre-stat" style={{ borderColor: TYRE_COLORS[i] }}>
                <span className="ts-corner" style={{ color: TYRE_COLORS[i] }}>{lbl}</span>
                <span className="ts-temp">{tp.value.toFixed(0)}{settings.temp === "f" ? "°F" : "°"}</span>
                <div className="ts-wear-track">
                  <div className="ts-wear-fill" style={{ width: `${wear}%`, background: wear < 25 ? "var(--hot)" : wear < 50 ? "var(--warm)" : "var(--good)" }} />
                </div>
                <span className="ts-wear-val">{wear.toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface Series { vals: number[]; min: number; max: number; color: string; w: number; dim?: boolean; step?: boolean; }

function Scope({ title, badge, badgeColor, legend, series }: {
  title: string; badge?: string; badgeColor?: string;
  legend?: { label: string; color: string }[]; series: Series[];
}) {
  return (
    <div className="panel scope">
      <div className="scope-head">
        <span className="scope-title">{title}</span>
        {badge && <span className="scope-badge" style={{ color: badgeColor }}>{badge}</span>}
        {legend && (
          <div className="scope-legend">
            {legend.map((l) => <span key={l.label} style={{ color: l.color }}>{l.label}</span>)}
          </div>
        )}
      </div>
      <ScopeSvg height={130} series={series} />
    </div>
  );
}

function ScopeSvg({ height, series, axis }: {
  height: number; series: Series[]; axis?: { v: number; min: number; max: number; label: string }[];
}) {
  const W = 1000;
  const toPoints = (sr: Series): string => {
    const n = sr.vals.length;
    if (n < 2) return "";
    const span = sr.max - sr.min || 1;
    return sr.vals
      .map((v, i) => {
        const x = (i / (n - 1)) * W;
        const y = height - ((v - sr.min) / span) * height;
        return `${x.toFixed(1)},${Math.max(0, Math.min(height, y)).toFixed(1)}`;
      })
      .join(" ");
  };
  return (
    <svg className="scope-svg" viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" style={{ height }}>
      <line x1={0} y1={height / 2} x2={W} y2={height / 2} className="scope-mid" />
      {axis?.map((a) => {
        const y = height - ((a.v - a.min) / (a.max - a.min)) * height;
        return <text key={a.label} x={W - 6} y={y - 3} className="scope-axis" textAnchor="end" fill="currentColor">{a.label}</text>;
      })}
      {series.map((sr, i) => (
        <polyline key={i} points={toPoints(sr)} fill="none" stroke={sr.color}
          strokeWidth={sr.w} strokeLinejoin="round" strokeLinecap="round"
          opacity={sr.dim ? 0.45 : 1} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
