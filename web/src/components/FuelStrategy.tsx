import type { Strategy, Telemetry } from "../types";
import { useSettings } from "../settings";
import { volume } from "../units";

export function FuelStrategy({ t, s }: { t: Telemetry; s: Strategy }) {
  const { settings } = useSettings();
  const V = (litres: number) => volume(litres, settings.vol);
  const fuelPct = t.maxFuel > 0 ? (t.fuel / t.maxFuel) * 100 : 0;
  const shortfall = s.lapsRemainingInSession - s.lapsInTank;
  const safe = shortfall <= 0;
  const fuelNow = V(t.fuel);
  const burn = V(s.avgFuelPerLap);
  const add = V(s.fuelToAdd);
  return (
    <div className="panel fuel-panel">
      <h3 className="panel-title">Race Engineer · Fuel</h3>
      <div className="fuel-gauge">
        <div className="fuel-track">
          <div className="fuel-fill" style={{ width: `${fuelPct}%`, background: t.fuel < s.avgFuelPerLap * 2 ? "var(--danger)" : "var(--accent)" }} />
        </div>
        <span className="fuel-num">{fuelNow.value.toFixed(1)} <span className="unit">{fuelNow.unit}</span></span>
      </div>
      <div className="stat-grid">
        <Stat label="Burn / lap" value={`${burn.value.toFixed(2)} ${burn.unit}`} note={s.hasData ? "rolling" : "estimate"} />
        <Stat label="Laps in tank" value={s.lapsInTank.toFixed(1)} />
        <Stat label="Laps to go" value={s.lapsRemainingInSession > 0 ? s.lapsRemainingInSession.toFixed(0) : "—"} />
        <Stat label="Add at stop" value={s.fuelToAdd > 0 ? `+${add.value.toFixed(1)} ${add.unit}` : `0 ${add.unit}`} highlight />
      </div>
      <div className={`callout ${safe ? "ok" : "warn"}`}>
        {s.lapsRemainingInSession <= 0
          ? "Waiting for a representative lap…"
          : safe
          ? `On target — ${Math.abs(shortfall).toFixed(1)} laps of margin.`
          : `Short by ~${shortfall.toFixed(1)} laps. Stop for +${s.fuelToAdd.toFixed(1)} L.`}
      </div>
    </div>
  );
}

function Stat({ label, value, note, highlight }: { label: string; value: string; note?: string; highlight?: boolean }) {
  return (
    <div className={`stat${highlight ? " hl" : ""}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-val">{value}</span>
      {note && <span className="stat-note">{note}</span>}
    </div>
  );
}
