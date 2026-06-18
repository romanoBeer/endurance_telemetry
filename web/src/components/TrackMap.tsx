import type { Standing } from "../types";

/**
 * Live track map. We don't have real ACC track splines in the sim, so the ribbon
 * is a stylised closed loop and each car is placed on it by its `trackPos`
 * (0..1). On a real feed with car coordinates you'd swap `pointAt` for the
 * track's actual centreline — the car-placement logic stays the same.
 */

// A smooth closed loop (rough Spa-ish silhouette) as a periodic parametric curve.
function pointAt(p: number): { x: number; y: number } {
  const a = p * Math.PI * 2;
  // Sum of a few harmonics → an irregular, circuit-like loop inside a 100x100 box.
  const x = 50 + 34 * Math.cos(a) + 6 * Math.cos(2 * a + 0.6) - 4 * Math.cos(3 * a);
  const y = 50 + 30 * Math.sin(a) - 7 * Math.sin(2 * a) + 5 * Math.sin(3 * a + 0.4);
  return { x, y };
}

function ribbonPath(): string {
  const pts: string[] = [];
  for (let i = 0; i <= 120; i++) {
    const { x, y } = pointAt(i / 120);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return "M" + pts.join(" L") + " Z";
}

const PATH = ribbonPath();

export function TrackMap({ standings, track }: { standings: Standing[]; track: string }) {
  return (
    <div className="panel map-panel">
      <h3 className="panel-title">Track Map · {track || "—"}</h3>
      <svg viewBox="0 0 100 100" className="track-map" preserveAspectRatio="xMidYMid meet">
        <path d={PATH} className="track-ribbon" />
        <path d={PATH} className="track-edge" />
        {standings.map((c) => {
          const { x, y } = pointAt(c.trackPos);
          return (
            <g key={c.carNumber} transform={`translate(${x} ${y})`}>
              <circle r={c.isPlayer ? 3.4 : 2.4} className={c.isPlayer ? "car me" : "car"} />
              <text className="car-label" x={0} y={c.isPlayer ? -4.6 : -3.6}>
                {c.isPlayer ? "YOU" : c.carNumber}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="subtle">{standings.length} cars · live spline position</div>
    </div>
  );
}
