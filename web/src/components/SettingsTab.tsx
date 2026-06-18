import { useSettings } from "../settings";
import type { Settings } from "../units";

/** Engineer's display preferences. Persisted to localStorage via the provider. */
export function SettingsTab() {
  const { settings, update } = useSettings();

  return (
    <div className="settings-tab">
      <div className="panel">
        <h3 className="panel-title">Units</h3>
        <div className="set-grid">
          <Toggle<Settings["speed"]> label="Speed" value={settings.speed}
            options={[["kmh", "km/h"], ["mph", "mph"]]} onPick={(v) => update({ speed: v })} />
          <Toggle<Settings["vol"]> label="Fuel volume" value={settings.vol}
            options={[["l", "Litres"], ["gal", "Gallons"]]} onPick={(v) => update({ vol: v })} />
          <Toggle<Settings["press"]> label="Tyre pressure" value={settings.press}
            options={[["psi", "psi"], ["kpa", "kPa"]]} onPick={(v) => update({ press: v })} />
          <Toggle<Settings["temp"]> label="Temperature" value={settings.temp}
            options={[["c", "°C"], ["f", "°F"]]} onPick={(v) => update({ temp: v })} />
        </div>
      </div>

      <div className="panel">
        <h3 className="panel-title">Strategy</h3>
        <label className="field">
          <span>Pit-lane time loss (s)</span>
          <input type="number" min={5} max={90} step={0.5} value={settings.pitLossSec}
            onChange={(e) => update({ pitLossSec: Number(e.target.value) })} />
        </label>
        <div className="subtle">Drives the Pit Exit Predictor on the Pit Strat tab.</div>
      </div>
    </div>
  );
}

function Toggle<T extends string>({ label, value, options, onPick }: {
  label: string; value: T; options: [T, string][]; onPick: (v: T) => void;
}) {
  return (
    <div className="set-row">
      <span className="set-label">{label}</span>
      <div className="seg">
        {options.map(([v, lbl]) => (
          <button key={v} className={`seg-btn${v === value ? " on" : ""}`} onClick={() => onPick(v)}>
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}
