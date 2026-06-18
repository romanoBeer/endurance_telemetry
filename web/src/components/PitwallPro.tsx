import { useEffect, useRef } from "react";
import type { DriverFeed } from "../useRelay";
import type { Standing, Telemetry, Strategy } from "../types";
import { formatLapTime } from "../types";
import { useSettings } from "../settings";
import { speed as cvSpeed, pressure as cvPress, temp as cvTemp, volume as cvVol } from "../units";

/**
 * "Pro" pitwall — a full race-engineer wall modelled on a broadcast/RaceLab
 * timing screen: class leaderboard with sectors on the left, a live track radar
 * and tyre/telemetry/damage stacks on the right. Driven entirely by the data the
 * agent already streams (the sim synthesises the field; a real UDP feed slots in
 * the same shape).
 */

// ---- shared helpers -------------------------------------------------------
function fmtSec(ms?: number): string {
  if (!ms || ms <= 0) return "—";
  const s = ms / 1000;
  return s < 60 ? s.toFixed(3) : formatLapTime(ms);
}
function fmtGap(ms: number): string {
  if (ms === 0) return "";
  const a = Math.abs(ms);
  if (a >= 60000) {
    const m = Math.floor(a / 60000);
    return `+${m}:${Math.floor((a % 60000) / 1000).toString().padStart(2, "0")}`;
  }
  return `+${(a / 1000).toFixed(2)}`;
}

const CLASS_COLOR: Record<string, string> = {
  GOL: "#d8a516", PLA: "#7c3aed", SIL: "#9aa6b2", BRO: "#b06a2c",
};
const TYRE_COLORS = ["var(--hot)", "var(--warm)", "var(--cold)", "#a78bfa"];

// A stylised closed loop reused for the radar (same shape as TrackMap).
function loopPoint(p: number, cx: number, cy: number, r: number) {
  const a = p * Math.PI * 2;
  const x = cx + r * (0.92 * Math.cos(a) + 0.16 * Math.cos(2 * a + 0.6) - 0.11 * Math.cos(3 * a));
  const y = cy + r * (0.82 * Math.sin(a) - 0.19 * Math.sin(2 * a) + 0.13 * Math.sin(3 * a + 0.4));
  return { x, y };
}

// ===========================================================================
export function PitwallPro({ feed, viewers }: { feed: DriverFeed; viewers: number }) {
  const t = feed.telemetry;
  const s = feed.strategy;
  const standings = (t.standings ?? []).slice().sort((a, b) => a.position - b.position);
  const me = standings.find((c) => c.isPlayer);

  return (
    <div className="pw2">
      <div className="pw2-left">
        <Leaderboard t={t} standings={standings} />
        <TrackRelative standings={standings} />
        <div className="pw2-strip">
          <LapTimes t={t} />
          <Sectors t={t} />
          <VehicleSettings t={t} />
          <Fuel t={t} s={s} />
        </div>
      </div>

      <div className="pw2-right">
        <TrackRadar t={t} standings={standings} viewers={viewers} />
        <div className="pw2-rgrid">
          <TelemetryMini feed={feed} />
          <Tires t={t} title="TIRES" />
          <Tires t={t} title="2 LAP TIRE AVG" />
          <SpeedGear t={t} />
          <Damage t={t} me={me} />
          <TireHistory feed={feed} />
        </div>
      </div>
    </div>
  );
}

// ---- LEADERBOARD ----------------------------------------------------------
function Leaderboard({ t, standings }: { t: Telemetry; standings: Standing[] }) {
  const leaderBest = Math.min(...standings.map((c) => c.bestLapMs ?? Infinity));
  return (
    <div className="panel lbp">
      <div className="lbp-title">CLASS LEADERBOARD</div>
      <div className="lbp-hdr">
        <Stat label="RACE" value={`L${t.completedLaps + 1}`} />
        <Stat label="POSITION" value={`${t.position}/${standings.length}`} />
        <Stat label="TIME LEFT" value={mmss(t.sessionTimeLeft)} sub />
        <Stat label="LAST LAP" value={formatLapTime(t.iLastTime)} color="var(--warm)" big />
        <Stat label="BEST LAP" value={formatLapTime(t.iBestTime)} color="var(--good)" big />
        <Stat label="CLASS BEST" value={fmtSec(leaderBest)} color="#ff3bd0" big />
      </div>

      <div className="lbt-head">
        <span>DRIVER</span><span>PIT</span><span>LAP</span><span className="r">GAP</span>
        <span className="r">INT</span><span className="r">BEST</span><span className="r">LAST</span>
        <span className="r">S1</span><span className="r">S2</span><span className="r">S3</span>
      </div>
      <div className="lbt-body">
        {standings.map((c, i) => (
          <div key={c.carNumber}
            className={`lbt-row${c.isPlayer ? " me" : ""}${c.inPit ? " pit" : ""}${i === 2 ? " sep" : ""}`}>
            <div className="lbt-driver">
              <span className="pos-badge">{c.position}</span>
              <span className="cls-badge" style={{ background: CLASS_COLOR[c.carClass ?? "SIL"] }}>{c.carClass ?? "SIL"}</span>
              <span className="brand-dot" title={c.carBrand}>{(c.carBrand ?? "?")[0].toUpperCase()}</span>
              <span className="dn">{c.name}</span>
            </div>
            <span className="pit-info">{c.pitCount ?? 0} ({c.tyreAgeLaps}L)</span>
            <span>L{c.lapsCompleted}</span>
            <span className="r">{c.position === 1 ? "" : fmtGap(c.gapToLeaderMs)}</span>
            <span className="r">+{(c.intervalMs / 1000).toFixed(2)}</span>
            <span className={`r best${(c.bestLapMs ?? Infinity) === leaderBest ? " classbest" : ""}`}>{fmtSec(c.bestLapMs)}</span>
            <span className="r last">{c.inPit ? "IN PIT" : fmtSec(c.lastLapMs)}</span>
            <span className="r sct">{fmtSec(c.sectors?.[0])}</span>
            <span className="r sct">{fmtSec(c.sectors?.[1])}</span>
            <span className="r sct">{fmtSec(c.sectors?.[2])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrackRelative({ standings }: { standings: Standing[] }) {
  if (standings.length < 2) return <div className="panel tr-rel subtle">TRACK RELATIVE · no field</div>;
  const byTrack = [...standings].sort((a, b) => b.trackPos - a.trackPos);
  const idx = byTrack.findIndex((c) => c.isPlayer);
  const ahead = byTrack[(idx - 1 + byTrack.length) % byTrack.length];
  const behind = byTrack[(idx + 1) % byTrack.length];
  const me = byTrack[idx];
  const dAhead = ((ahead.trackPos - me.trackPos + 1) % 1) * (me.lastLapMs / 1000);
  const dBehind = ((me.trackPos - behind.trackPos + 1) % 1) * (me.lastLapMs / 1000);
  return (
    <div className="panel tr-rel">
      <div className="tr-title">TRACK RELATIVE</div>
      <div className="tr-body">
        <span className="tr-side">{fmtSec(behind.lastLapMs)}</span>
        <span className="tr-car"><b>{behind.name}</b> <i className="num">{behind.carNumber}</i> +{dBehind.toFixed(2)}</span>
        <div className="tr-bar"><span className="tr-marker">◄</span></div>
        <span className="tr-car r">-{dAhead.toFixed(2)} <i className="num">{ahead.carNumber}</i> <b>{ahead.name}</b></span>
        <span className="tr-side">{fmtSec(ahead.lastLapMs)}</span>
      </div>
    </div>
  );
}

// ---- BOTTOM STRIP ---------------------------------------------------------
function LapTimes({ t }: { t: Telemetry }) {
  return (
    <div className="panel mini">
      <div className="mini-title">LAP TIMES</div>
      <div className="lt-big" style={{ color: "#ff3bd0" }}>{formatLapTime(t.estimatedLapMs ?? 0)}</div>
      <div className="mini-sub">ESTIMATED</div>
      <div className="lt-big" style={{ color: "var(--warm)" }}>{formatLapTime(t.iLastTime)}</div>
      <div className="mini-sub">LAST LAP</div>
      <div className="lt-big" style={{ color: "var(--good)" }}>{formatLapTime(t.iBestTime)}</div>
      <div className="mini-sub">BEST LAP</div>
    </div>
  );
}

function Sectors({ t }: { t: Telemetry }) {
  const ls = t.lastSectors ?? [];
  const cur = t.curSector ?? 0;
  return (
    <div className="panel mini">
      <div className="mini-title">SECTORS</div>
      <div className="lt-big" style={{ color: "#ff3bd0" }}>{formatLapTime(t.iCurrentTime)}</div>
      <div className="mini-sub">CURRENT LAP</div>
      {[0, 1, 2].map((i) => (
        <div key={i} className={`sec-row${i === cur ? " on" : ""}`}>
          <span>S{i + 1}</span>
          <span className="num">{i <= cur ? fmtSec(ls[i]) : "—"}</span>
        </div>
      ))}
    </div>
  );
}

function VehicleSettings({ t }: { t: Telemetry }) {
  const e = t.electronics;
  const cells: [string, string, string][] = e
    ? [
        ["TC", String(e.tc), "var(--cool)"],
        ["TC CUT", String(e.tcCut), "var(--cool)"],
        ["ABS", String(e.abs), "var(--accent)"],
        ["BB", e.bb.toFixed(1), "var(--hot)"],
        ["MAP", String(e.map), "var(--good)"],
        ["F-ARB", String(e.fArb), "var(--warm)"],
        ["R-ARB", String(e.rArb), "var(--warm)"],
      ]
    : [];
  return (
    <div className="panel mini vs">
      <div className="mini-title">VEHICLE SETTINGS</div>
      <div className="vs-grid">
        {cells.map(([l, v, c]) => (
          <div key={l} className="vs-cell">
            <span className="vs-val" style={{ color: c }}>{v}</span>
            <span className="vs-lbl">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Fuel({ t, s }: { t: Telemetry; s: Strategy }) {
  const { settings } = useSettings();
  const f = cvVol(t.fuel, settings.vol);
  const avg = cvVol(s.avgFuelPerLap, settings.vol);
  const add = cvVol(s.fuelToAdd, settings.vol);
  return (
    <div className="panel mini fuelp">
      <div className="mini-title">FUEL</div>
      <div className="fp-grid">
        <FCell v={f.value.toFixed(1)} l="LITERS" />
        <FCell v={avg.value.toFixed(2)} l="AVG" />
        <FCell v={s.lapsInTank.toFixed(1)} l="LAPS" />
        <FCell v={mmss(s.lapsInTank * (t.iLastTime / 1000))} l="EST LEFT" />
        <FCell v={`${add.value.toFixed(1)}`} l="REFUEL" hl />
      </div>
    </div>
  );
}
const FCell = ({ v, l, hl }: { v: string; l: string; hl?: boolean }) => (
  <div className="fp-cell"><span className={`fp-v${hl ? " hl" : ""}`}>{v}</span><span className="fp-l">{l}</span></div>
);

// ---- TRACK RADAR ----------------------------------------------------------
function TrackRadar({ t, standings, viewers }: { t: Telemetry; standings: Standing[]; viewers: number }) {
  const { settings } = useSettings();
  const air = cvTemp(t.airTemp, settings.temp);
  const road = cvTemp(t.roadTemp, settings.temp);
  const ticks = Array.from({ length: 19 }, (_, i) => i);
  return (
    <div className="panel radar">
      <div className="rdr-top">
        <div>
          <div className="rdr-track">{t.track || "Track"}</div>
          <div className="rdr-corner subtle">{t.cornerName ?? ""}</div>
        </div>
        <div className="rdr-clock">{mmss(t.sessionTimeLeft)}</div>
      </div>
      <svg viewBox="0 0 200 180" className="rdr-svg">
        <circle cx={100} cy={88} r={84} className="rdr-ring" />
        {ticks.map((i) => {
          const a = (i / 19) * Math.PI * 2 - Math.PI / 2;
          const x1 = 100 + Math.cos(a) * 84, y1 = 88 + Math.sin(a) * 84;
          const x2 = 100 + Math.cos(a) * 78, y2 = 88 + Math.sin(a) * 78;
          const lx = 100 + Math.cos(a) * 92, ly = 88 + Math.sin(a) * 92;
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} className="rdr-tick" />
              <text x={lx} y={ly} className="rdr-ticklbl">{i + 1}</text>
            </g>
          );
        })}
        <path d={radarPath()} className="rdr-ribbon" />
        {standings.map((c) => {
          const { x, y } = loopPoint(c.trackPos, 100, 92, 52);
          return (
            <g key={c.carNumber} transform={`translate(${x} ${y})`}>
              <circle r={c.isPlayer ? 6.5 : 5} className={c.isPlayer ? "rdr-car me" : "rdr-car"} />
              <text y={2.2} className="rdr-carnum">{c.position}</text>
            </g>
          );
        })}
      </svg>
      <div className="rdr-foot">
        <span className="subtle">🌡 {air.value.toFixed(0)}{air.unit} · {road.value.toFixed(0)}{road.unit}</span>
        <span className="subtle">💨 {(t.windSpeedMs ?? 0).toFixed(1)} m/s</span>
        <span className="subtle">👁 {viewers}</span>
      </div>
    </div>
  );
}
function radarPath(): string {
  const pts: string[] = [];
  for (let i = 0; i <= 100; i++) {
    const { x, y } = loopPoint(i / 100, 100, 92, 52);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return "M" + pts.join(" L") + " Z";
}

// ---- TELEMETRY MINI -------------------------------------------------------
function TelemetryMini({ feed }: { feed: DriverFeed }) {
  const buf = useRef<{ g: number; b: number }[]>([]);
  const t = feed.telemetry;
  useEffect(() => {
    buf.current.push({ g: t.gas, b: t.brake });
    if (buf.current.length > 200) buf.current.shift();
  }, [feed.lastUpdate]);
  const pts = (sel: (x: { g: number; b: number }) => number) => {
    const a = buf.current;
    if (a.length < 2) return "";
    return a.map((x, i) => `${(i / (a.length - 1)) * 100},${(1 - sel(x)) * 60}`).join(" ");
  };
  return (
    <div className="panel rmini">
      <div className="mini-title">TELEMETRY</div>
      <div className="tm-row">
        <svg viewBox="0 0 100 60" className="tm-svg" preserveAspectRatio="none">
          <polyline points={pts((x) => x.g)} className="tm-thr" vectorEffect="non-scaling-stroke" />
          <polyline points={pts((x) => x.b)} className="tm-brk" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="tm-bars">
          <Bar v={t.gas} c="var(--good)" />
          <Bar v={t.brake} c="var(--hot)" />
        </div>
      </div>
    </div>
  );
}
const Bar = ({ v, c }: { v: number; c: string }) => (
  <div className="tm-bar"><div className="tm-fill" style={{ height: `${v * 100}%`, background: c }} /></div>
);

// ---- TIRES ----------------------------------------------------------------
function Tires({ t, title }: { t: Telemetry; title: string }) {
  const { settings } = useSettings();
  const P = (i: number) => cvPress(t.tyrePressure?.[i] ?? 0, settings.press).value;
  const C = (i: number) => cvTemp(t.tyreCoreTemp?.[i] ?? 0, settings.temp).value;
  const B = (i: number) => t.brakeTemp?.[i] ?? 0;
  const corner = (i: number) => (
    <div className="tcorner">
      <span className="tc-press">{P(i).toFixed(settings.press === "kpa" ? 0 : 1)}</span>
      <div className="tc-sub">
        <span>{C(i).toFixed(0)}°</span>
        <span className="tc-bt">{B(i).toFixed(0)}°</span>
      </div>
    </div>
  );
  return (
    <div className="panel tirep">
      <div className="mini-title">{title}</div>
      <div className="tire-quad">
        {corner(0)}{corner(1)}
        <div className="tire-mid">{title.includes("AVG") ? "2 LAP AVG" : `DRY ${t.tyreSetLaps ?? 0}`}</div>
        {corner(2)}{corner(3)}
      </div>
    </div>
  );
}

// ---- SPEED / GEAR ---------------------------------------------------------
function SpeedGear({ t }: { t: Telemetry }) {
  const { settings } = useSettings();
  const sp = cvSpeed(t.speedKmh, settings.speed);
  const g = t.gear === 0 ? "R" : t.gear === 1 ? "N" : String(t.gear - 1);
  const rpmPct = t.maxRpm ? t.rpm / t.maxRpm : 0;
  return (
    <div className="panel sgp">
      <div className="mini-title">SPEED / GEAR / RPM</div>
      <div className="sg-row">
        <div className="rpm-mini"><div className="rpm-mini-fill" style={{ width: `${rpmPct * 100}%` }} /></div>
        <div className="sg-big">{Math.round(sp.value)}<small>{sp.unit}</small></div>
      </div>
      <div className="sg-row">
        <div className="rpm-mini"><div className="rpm-mini-fill" style={{ width: `${rpmPct * 100}%`, background: "var(--cool)" }} /></div>
        <div className="sg-big gear">{g}<small>{t.rpm}</small></div>
      </div>
    </div>
  );
}

// ---- DAMAGE ---------------------------------------------------------------
function Damage({ t, me }: { t: Telemetry; me?: Standing }) {
  const d = t.carDamage ?? [0, 0, 0, 0, 0];
  const zone = (v: number) => (v < 0.5 ? "OK" : `${v.toFixed(1)}s`);
  return (
    <div className="panel dmgp">
      <div className="mini-title">DAMAGE {me ? `· P${me.position}` : ""}</div>
      <div className="dmg-grid">
        <span className={d[0] < 0.5 ? "ok" : "bad"}>{zone(d[0])}<i>FRONT</i></span>
        <div className="dmg-car" />
        <span className={d[2] < 0.5 ? "ok" : "bad"}>{zone(d[2])}<i>LEFT</i></span>
        <span className={d[3] < 0.5 ? "ok" : "bad"}>{zone(d[3])}<i>RIGHT</i></span>
        <span className={d[1] < 0.5 ? "ok" : "bad"}>{zone(d[1])}<i>REAR</i></span>
      </div>
    </div>
  );
}

// ---- TIRE HISTORY (pressure sparkline) ------------------------------------
function TireHistory({ feed }: { feed: DriverFeed }) {
  const { settings } = useSettings();
  const buf = useRef<number[][]>([]);
  const t = feed.telemetry;
  useEffect(() => {
    buf.current.push([0, 1, 2, 3].map((i) => t.tyrePressure?.[i] ?? 0));
    if (buf.current.length > 240) buf.current.shift();
  }, [feed.lastUpdate]);
  const line = (i: number) => {
    const a = buf.current;
    if (a.length < 2) return "";
    return a.map((row, k) => `${(k / (a.length - 1)) * 100},${(1 - (row[i] - 24.5) / 4) * 60}`).join(" ");
  };
  return (
    <div className="panel thp">
      <div className="mini-title">TIRE HISTORY</div>
      <div className="th-chips">
        {["FL", "FR", "RL", "RR"].map((lbl, i) => (
          <span key={lbl} className="th-chip" style={{ background: TYRE_COLORS[i] }}>
            {lbl} {cvPress(t.tyrePressure?.[i] ?? 0, settings.press).value.toFixed(settings.press === "kpa" ? 0 : 1)}
          </span>
        ))}
      </div>
      <svg viewBox="0 0 100 60" className="th-svg" preserveAspectRatio="none">
        {[0, 1, 2, 3].map((i) => (
          <polyline key={i} points={line(i)} fill="none" stroke={TYRE_COLORS[i]} strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
    </div>
  );
}

// ---- tiny shared bits -----------------------------------------------------
function Stat({ label, value, color, big, sub }: { label: string; value: string; color?: string; big?: boolean; sub?: boolean }) {
  return (
    <div className="hstat">
      <span className="hstat-l">{label}</span>
      <span className={`hstat-v${big ? " big" : ""}${sub ? " sub" : ""}`} style={color ? { color } : undefined}>{value}</span>
    </div>
  );
}
function mmss(sec: number): string {
  if (sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  return `${m}:${Math.floor(sec % 60).toString().padStart(2, "0")}`;
}
