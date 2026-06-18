import { useState } from "react";
import { HudBar } from "./components/HudBar";
import { FuelStrategy } from "./components/FuelStrategy";
import { StrategyPanel } from "./components/StrategyPanel";
import { PitwallPro } from "./components/PitwallPro";
import { Weather } from "./components/Weather";
import { PitExit } from "./components/PitExit";
import { TelemetryTab } from "./components/TelemetryTab";
import { SettingsTab } from "./components/SettingsTab";
import type { DriverFeed } from "./useRelay";
import type { PitCommand } from "./types";

interface Props {
  driver: string;
  feed: DriverFeed;
  drivers: string[];
  viewers: string[];
  onSelectDriver: (d: string) => void;
  onSend: (target: string, cmd: PitCommand) => void;
  ack: { driver: string; applied: boolean } | null;
}

type TabKey = "pitwall" | "telemetry" | "weather" | "pitstrat" | "settings";
const TABS: { key: TabKey; label: string }[] = [
  { key: "pitwall", label: "Pitwall" },
  { key: "telemetry", label: "Telemetry" },
  { key: "weather", label: "Weather" },
  { key: "pitstrat", label: "Pit Strat" },
  { key: "settings", label: "Settings" },
];

export function Dashboard({ driver, feed, drivers, viewers, onSelectDriver, onSend, ack }: Props) {
  const { telemetry: t, strategy: s } = feed;
  const [tab, setTab] = useState<TabKey>("pitwall");
  const standings = t.standings ?? [];
  // Prefer the in-car nick from telemetry; fall back to the relay driver tag.
  const drivingName = t.playerNick || driver;

  return (
    <div className="shell">
      <header className="topline">
        <span className="brand">ACC PITWALL</span>
        <div className="driver-tabs">
          {drivers.map((d) => (
            <button key={d} className={d === driver ? "tab active" : "tab"} onClick={() => onSelectDriver(d)}>
              {d}
            </button>
          ))}
        </div>
        <span className="ctx">{t.track} · {t.carModel}</span>
        {t.globalYellow && <span className="flag yellow">YELLOW</span>}
        {t.rainIn30min > 0 && <span className="flag rain">RAIN ~30m</span>}
        <span className="viewers subtle">👁 {viewers.length}</span>
      </header>

      <nav className="tabbar">
        {TABS.map((tb) => (
          <button key={tb.key} className={tb.key === tab ? "tabbtn active" : "tabbtn"} onClick={() => setTab(tb.key)}>
            {tb.label}
          </button>
        ))}
      </nav>

      {tab === "pitwall" && (
        <>
          <HudBar t={t} driver={drivingName} />
          <PitwallPro feed={feed} viewers={viewers.length} />
        </>
      )}

      {tab === "telemetry" && <TelemetryTab feed={feed} />}

      {tab === "weather" && <Weather t={t} />}

      {tab === "pitstrat" && (
        <div className="pitstrat-grid">
          <PitExit standings={standings} />
          <FuelStrategy t={t} s={s} />
          <StrategyPanel driver={driver} recommended={s} onSend={onSend} ack={ack} />
        </div>
      )}

      {tab === "settings" && <SettingsTab />}

      <footer className="footer subtle">
        Air {t.airTemp.toFixed(0)}° · Track {t.roadTemp.toFixed(0)}° · Grip {t.trackGripStatus}
      </footer>
    </div>
  );
}
