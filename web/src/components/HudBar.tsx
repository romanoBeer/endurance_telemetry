import type { Telemetry } from "../types";
import { formatLapTime, formatClock, SESSION_NAMES } from "../types";
import { useSettings } from "../settings";
import { speed } from "../units";

function gearLabel(g: number): string {
  if (g === 0) return "R";
  if (g === 1) return "N";
  return String(g - 1);
}

export function HudBar({ t, driver }: { t: Telemetry; driver?: string }) {
  const { settings } = useSettings();
  const rpmPct = t.maxRpm > 0 ? Math.min(t.rpm / t.maxRpm, 1) : 0;
  const shift = rpmPct > 0.95;
  const spd = speed(t.speedKmh, settings.speed);
  return (
    <div className="hud-bar panel">
      {driver && (
        <div className="hud-driver">
          <span className="hud-driver-label">DRIVING</span>
          <span className="hud-driver-name">{driver}</span>
        </div>
      )}
      <div className="hud-gear">
        <span className={shift ? "gear shift" : "gear"}>{gearLabel(t.gear)}</span>
        <div className="rpm-track">
          <div className="rpm-fill" style={{ width: `${rpmPct * 100}%`, background: shift ? "var(--danger)" : "var(--accent)" }} />
        </div>
        <span className="rpm-num">{t.rpm.toLocaleString()} rpm</span>
      </div>
      <div className="hud-speed">
        <span className="big">{Math.round(spd.value)}</span>
        <span className="unit">{spd.unit}</span>
      </div>
      <div className="hud-times">
        <Time label="CUR" value={formatLapTime(t.iCurrentTime)} live />
        <Time label="LAST" value={formatLapTime(t.iLastTime)} />
        <Time label="BEST" value={formatLapTime(t.iBestTime)} best />
      </div>
      <div className="hud-meta">
        <Meta label="POS" value={`P${t.position}`} />
        <Meta label="LAP" value={String(t.completedLaps + 1)} />
        <Meta label={SESSION_NAMES[t.session] ?? "—"} value={formatClock(t.sessionTimeLeft)} />
      </div>
    </div>
  );
}

function Time({ label, value, best, live }: { label: string; value: string; best?: boolean; live?: boolean }) {
  return (
    <div className="time">
      <span className="time-label">{label}</span>
      <span className={`time-val${best ? " best" : ""}${live ? " live" : ""}`}>{value}</span>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="meta">
      <span className="meta-label">{label}</span>
      <span className="meta-val">{value}</span>
    </div>
  );
}
