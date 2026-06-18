import { useEffect, useState } from "react";
import { useRelay, type RelayConfig } from "./useRelay";
import { Dashboard } from "./Dashboard";
import { Overlay } from "./Overlay";

const params = new URLSearchParams(location.search);
const isOverlay = params.get("overlay") === "1";

const DEFAULTS: RelayConfig = {
  url: params.get("url") ?? "ws://localhost:8765/ws",
  room: params.get("room") ?? "default",
  name: params.get("name") ?? "engineer",
};

export default function App() {
  const [cfg, setCfg] = useState<RelayConfig | null>(isOverlay ? DEFAULTS : null);
  const [form, setForm] = useState(DEFAULTS);
  const relay = useRelay(cfg);
  const [selected, setSelected] = useState<string | null>(null);

  // Default the selected driver to the first one we see.
  useEffect(() => {
    if (!selected && relay.drivers.length) setSelected(relay.drivers[0]);
    if (selected && !relay.drivers.includes(selected)) {
      setSelected(relay.drivers[0] ?? null);
    }
  }, [relay.drivers, selected]);

  // --- Connect form (skipped in overlay mode) ---
  if (!cfg) {
    return (
      <div className="connect">
        <div className="panel connect-card">
          <h1 className="brand">ACC PITWALL</h1>
          <p className="subtle">Connect to your team's relay to watch the car.</p>
          <label className="field"><span>Relay URL</span>
            <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></label>
          <label className="field"><span>Room</span>
            <input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} /></label>
          <label className="field"><span>Your name</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <button className="send" onClick={() => setCfg(form)}>Connect</button>
        </div>
      </div>
    );
  }

  const feed = selected ? relay.feeds[selected] : undefined;

  // --- Overlay mode ---
  if (isOverlay) {
    if (!feed) return <div className="overlay waiting-ov">…</div>;
    return <Overlay feed={feed} />;
  }

  // --- Dashboard ---
  if (relay.status !== "open" || !selected || !feed) {
    return (
      <div className="shell">
        <div className="waiting panel">
          <div className="pulse" />
          <h2>{relay.status === "open" ? "Waiting for a car…" : "Connecting to relay…"}</h2>
          <p className="subtle">
            Room <b>{cfg.room}</b> · {relay.drivers.length} driver(s) online.
            Start an agent on a rig to populate the wall.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Dashboard
      driver={selected}
      feed={feed}
      drivers={relay.drivers}
      viewers={relay.viewers}
      onSelectDriver={setSelected}
      onSend={relay.sendStrategy}
      ack={relay.lastAck}
    />
  );
}
