import type { Standing } from "../types";
import { formatLapTime } from "../types";
import { gap } from "../units";

/**
 * Live timing tower. Crucially the rows are sorted by **on-track order** (spline
 * position around the lap), not by race position — so the engineer reads who is
 * physically ahead of / behind the car right now, which is what matters for
 * traffic and undercut calls. The P-number column still carries the standings
 * position so both views are present at once.
 */
function compoundTag(c: string): string {
  const s = c.toLowerCase();
  if (s.includes("wet")) return "W";
  return "D";
}

export function Leaderboard({ standings }: { standings: Standing[] }) {
  if (!standings.length) {
    return (
      <div className="panel">
        <h3 className="panel-title">Live Timing · on-track order</h3>
        <div className="subtle">No field data on this feed.</div>
      </div>
    );
  }

  // On-track order: highest spline position first (car furthest round the lap).
  const onTrack = [...standings].sort((a, b) => b.trackPos - a.trackPos);

  return (
    <div className="panel lb-panel">
      <h3 className="panel-title">Live Timing · on-track order</h3>
      <div className="lb-head lb-row">
        <span>P</span><span>#</span><span>Driver</span>
        <span>Tyre</span><span className="num">Int</span><span className="num">Gap</span><span className="num">Last</span>
      </div>
      <div className="lb-body">
        {onTrack.map((c) => (
          <div key={c.carNumber} className={`lb-row${c.isPlayer ? " me" : ""}${c.inPit ? " pit" : ""}`}>
            <span className="lb-pos">P{c.position}</span>
            <span className="lb-num">{c.carNumber}</span>
            <span className="lb-name">{c.name}{c.inPit && <em className="pit-tag">PIT</em>}</span>
            <span className={`lb-tyre tyre-${compoundTag(c.tyreCompound).toLowerCase()}`}>
              {compoundTag(c.tyreCompound)}<small>{c.tyreAgeLaps}</small>
            </span>
            <span className="num">{c.intervalMs ? gap(c.intervalMs) : "—"}</span>
            <span className="num">{c.position === 1 ? "Leader" : gap(c.gapToLeaderMs)}</span>
            <span className="num">{formatLapTime(c.lastLapMs)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
