import type { DriverFeed } from "./useRelay";
import { formatLapTime } from "./types";

/**
 * Compact overlay for the in-game transparent window. Shows only the few things
 * a driver glances at: fuel/laps, the engineer's fuel call, tyre temps, and a
 * yellow-flag flash. Transparent background so it floats over ACC.
 */
export function Overlay({ feed }: { feed: DriverFeed }) {
  const { telemetry: t, strategy: s } = feed;
  const TEMP = (c: number) =>
    c < 72 ? "var(--cold)" : c <= 95 ? "var(--good)" : "var(--hot)";

  return (
    <div className="overlay">
      {t.globalYellow && <div className="ov-yellow">YELLOW</div>}
      <div className="ov-row">
        <span className="ov-fuel">{t.fuel.toFixed(1)}<small>L</small></span>
        <span className="ov-laps">{s.lapsInTank.toFixed(1)} laps</span>
      </div>
      <div className="ov-call">
        {s.fuelToAdd > 0 ? `add +${s.fuelToAdd.toFixed(1)}L` : "fuel OK"}
      </div>
      <div className="ov-tyres">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ color: TEMP(t.tyreCoreTemp[i]) }}>
            {t.tyreCoreTemp[i].toFixed(0)}°
          </span>
        ))}
      </div>
      <div className="ov-last">{formatLapTime(t.iLastTime)}</div>
    </div>
  );
}
