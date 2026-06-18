import type { Standing } from "../types";
import { useSettings } from "../settings";
import { gap } from "../units";

/**
 * "If I pit at the end of this lap, where do I come out?" — the undercut/overcut
 * read. Model: the player loses `pitLossSec` to the leader's clock; everyone else
 * is assumed to hold station for that lap. We re-slot the player into the field
 * by the new gap-to-leader and report the rejoin position plus the cars they'd
 * come out between.
 */
export function PitExit({ standings }: { standings: Standing[] }) {
  const { settings } = useSettings();
  const me = standings.find((c) => c.isPlayer);

  if (!me || standings.length < 2) {
    return (
      <div className="panel">
        <h3 className="panel-title">Pit Exit Predictor</h3>
        <div className="subtle">Needs live field data to project a rejoin.</div>
      </div>
    );
  }

  const pitLossMs = settings.pitLossSec * 1000;
  const newGap = me.gapToLeaderMs + pitLossMs;

  // Everyone except me, by gap-to-leader. Find where the new gap slots in.
  const others = standings.filter((c) => !c.isPlayer).sort((a, b) => a.gapToLeaderMs - b.gapToLeaderMs);
  const ahead = [...others].reverse().find((c) => c.gapToLeaderMs <= newGap); // last car still in front
  const behind = others.find((c) => c.gapToLeaderMs > newGap);                // first car now behind
  const newPos = others.filter((c) => c.gapToLeaderMs <= newGap).length + 1;
  const lost = newPos - me.position;

  return (
    <div className="panel pitexit-panel">
      <h3 className="panel-title">Pit Exit Predictor</h3>
      <div className="pe-headline">
        <div className="pe-pos">
          <span className="pe-from">P{me.position}</span>
          <span className="pe-arrow">→</span>
          <span className="pe-to">P{newPos}</span>
        </div>
        <div className={`pe-delta ${lost > 0 ? "warn" : "ok"}`}>
          {lost === 0 ? "hold position" : lost > 0 ? `−${lost} place${lost > 1 ? "s" : ""}` : `+${-lost}`}
        </div>
      </div>

      <div className="pe-between">
        <Row label="Out ahead of" car={behind} gapMs={behind ? newGap - behind.gapToLeaderMs : null} sign="-" />
        <Row label="Out behind" car={ahead && ahead.carNumber !== me.carNumber ? ahead : undefined}
             gapMs={ahead ? newGap - ahead.gapToLeaderMs : null} sign="+" />
      </div>

      <div className="subtle pe-foot">
        Assumes {settings.pitLossSec}s pit loss (set in Settings) and the field holds station for the in-lap.
      </div>
    </div>
  );
}

function Row({ label, car, gapMs, sign }: {
  label: string; car?: Standing; gapMs: number | null; sign: "+" | "-";
}) {
  if (!car) return <div className="pe-row empty subtle">{label}: clear air</div>;
  const g = gapMs == null ? "" : gap(sign === "-" ? -Math.abs(gapMs) : Math.abs(gapMs));
  return (
    <div className="pe-row">
      <span className="pe-row-label subtle">{label}</span>
      <span className="pe-row-car">#{car.carNumber} {car.name}</span>
      <span className="pe-row-gap num">{g}</span>
    </div>
  );
}
