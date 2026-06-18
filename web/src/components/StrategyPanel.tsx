import { useEffect, useState } from "react";
import type { PitCommand, Strategy } from "../types";

interface Props {
  driver: string;
  recommended: Strategy;
  onSend: (target: string, cmd: PitCommand) => void;
  ack: { driver: string; applied: boolean } | null;
}

/**
 * The remote pit control. An engineer fills the MFD-equivalent here and pushes
 * it at the driver's agent. Fuel pre-fills from the rolling recommendation.
 */
export function StrategyPanel({ driver, recommended, onSend, ack }: Props) {
  const [fuel, setFuel] = useState(0);
  const [changeTyres, setChangeTyres] = useState(true);
  const [tyreSet, setTyreSet] = useState(1);
  const [pressures, setPressures] = useState([27.5, 27.5, 27.5, 27.5]);
  const [sentAt, setSentAt] = useState<number | null>(null);

  // Keep the fuel field tracking the engineer's recommendation until they edit.
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setFuel(Math.ceil(recommended.fuelToAdd));
  }, [recommended.fuelToAdd, touched]);

  const send = () => {
    onSend(driver, { fuelToAdd: fuel, changeTyres, pressures, tyreSet });
    setSentAt(Date.now());
  };

  const setP = (i: number, v: number) =>
    setPressures((p) => p.map((x, idx) => (idx === i ? v : x)));

  return (
    <div className="panel strat-panel">
      <h3 className="panel-title">Pit Strategy → {driver}</h3>

      <label className="field">
        <span>Fuel to add (L)</span>
        <input type="number" value={fuel} min={0} max={120}
          onChange={(e) => { setTouched(true); setFuel(Number(e.target.value)); }} />
        <button className="link" onClick={() => setTouched(false)}>use rec.</button>
      </label>

      <label className="field check">
        <input type="checkbox" checked={changeTyres} onChange={(e) => setChangeTyres(e.target.checked)} />
        <span>Change tyres</span>
      </label>

      {changeTyres && (
        <>
          <label className="field">
            <span>Tyre set</span>
            <input type="number" value={tyreSet} min={1} max={50} onChange={(e) => setTyreSet(Number(e.target.value))} />
          </label>
          <div className="press-grid">
            {["LF", "RF", "LR", "RR"].map((lbl, i) => (
              <label key={lbl} className="press">
                <span>{lbl}</span>
                <input type="number" step={0.1} value={pressures[i]} onChange={(e) => setP(i, Number(e.target.value))} />
              </label>
            ))}
          </div>
        </>
      )}

      <button className="send" onClick={send}>Send to car</button>

      {ack && ack.driver === driver && sentAt && (
        <div className={`callout ${ack.applied ? "ok" : "warn"}`}>
          {ack.applied ? "✓ Strategy applied on the car" : "✗ Driver couldn't apply it"}
        </div>
      )}
    </div>
  );
}
