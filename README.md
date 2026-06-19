# Endurance Telemetry — SimHub plugin

A **team race-engineer pitwall**, rebuilt as a single [SimHub](https://www.simhubdash.com/)
plugin. It reads SimHub's telemetry (so it works in **every sim SimHub supports** —
ACC, iRacing, AC, rF2, …), computes the engineer numbers (rolling fuel/lap,
laps-to-go, fuel-to-add), and:

- surfaces everything as **SimHub properties** so you build the HUD / overlay /
  leaderboard with native SimHub dashboards (no separate web app to host), and
- hosts a tiny **HTTP control page** so a remote engineer (phone on the LAN) can
  watch the strategy and **push a pit command** back to the rig, which applies it
  to the ACC pit MFD.

```
   Any sim ──▶ SimHub ──▶ Endurance Telemetry plugin
                              │
              ┌───────────────┼────────────────────────┐
        SimHub dashboards   [Endurance Telemetry.*]   HTTP :8765
        (HUD / overlay        properties            ┌──────────────┐
         on the rig)                                │ phone control │
                                                    │  page (LAN)   │
                                                    └──────┬───────┘
                                          POST /strategy   │
                                          ──── pit MFD ◀────┘
```

This replaces the previous Python agent + relay and the React UI — one plugin
does the whole job. (Prior architecture is in git history if you need it.)

---

## Build & install

Needs Windows, [SimHub](https://www.simhubdash.com/) installed, and either Visual
Studio or the .NET Framework MSBuild.

```powershell
cd plugin
msbuild EnduranceTelemetry.csproj /p:Configuration=Release
# If SimHub isn't at the default path:
#   msbuild ... /p:SimHubDir="D:\SimHub"
```

The build drops `EnduranceTelemetry.dll` into the SimHub folder and copies
`control.html` to `SimHub\PluginsData\EnduranceTelemetry\`. Launch SimHub and
enable **Endurance Telemetry** when prompted (or in *Settings → Plugins*).

> macOS/Linux: you can edit the source anywhere, but a SimHub plugin only builds
> and runs on Windows against the SimHub assemblies.

---

## Use it

1. Start your sim; SimHub starts reading telemetry.
2. Open SimHub → **Endurance Telemetry** in the left menu. Set the HTTP **port**
   and driver name; tick *Apply pit commands* only once you've wired your binds.
3. **Dashboards:** in the SimHub dashboard editor, bind controls to
   `[Endurance Telemetry.Strategy.FuelToAdd]`, `[…Tyre.FL.Wear]`, `[…Rain.In30min]`,
   etc. (full list below). Show them as a HUD or transparent overlay on the rig.
4. **Engineer's phone:** browse to `http://<rig-LAN-ip>:<port>/`. Live strategy
   numbers, and a form to push fuel / tyres / pressures / set to the driver.

### LAN access (URL ACL)

`HttpListener` needs a one-time URL reservation to accept connections from other
devices. Run once, elevated (match the port):

```powershell
netsh http add urlacl url=http://+:8765/ user=Everyone
```

Without it the server falls back to localhost-only (phone won't connect, the
rig's own browser still will).

---

## Exposed SimHub properties

Bind from any dashboard as `[Endurance Telemetry.<name>]`:

| Property | Meaning |
|---|---|
| `Strategy.FuelToAdd` | litres to add at the next stop |
| `Strategy.FuelToFinish` | fuel needed to reach the flag (+0.5 L margin) |
| `Strategy.AvgFuelPerLap` | rolling 5-lap burn |
| `Strategy.LapsInTank` | laps the current fuel covers |
| `Strategy.LapsRemaining` | laps left in the session |
| `Strategy.HasData` | true once a lap has been measured |
| `Fuel`, `MaxFuel`, `Position`, `CompletedLaps` | core race state |
| `LastLapMs`, `BestLapMs`, `SessionTimeLeft`, `TrackPos` | timing |
| `Tyre.{FL,FR,RL,RR}.{Pressure,CoreTemp,Wear}` | per-corner tyre data |
| `Brake.{FL,FR,RL,RR}.Temp` | per-corner brake temp |
| `Rain.{Now,In10min,In30min}`, `TrackGrip` | weather (ACC) |
| `BrakeBias`, `TyreCompound`, `FieldCount`, `Game` | misc |

ACC-only fields (tyre wear, electronics, rain forecast, pit MFD) come from the
raw data object and degrade to defaults on other sims.

## HTTP control API

| Method | Path | Body / result |
|---|---|---|
| `GET` | `/` | the phone control page |
| `GET` | `/telemetry` | `{ telemetry, strategy, driver }` (camelCase) |
| `POST` | `/strategy` | `{ fuelToAdd, changeTyres, pressures[4], tyreSet }` → `{ applied }` |
| `GET` | `/health` | `{ ok: true }` |

## Pit-MFD application

ACC has no API to set the pit MFD, so a real apply diffs the current MFD state
against the request and walks it with keypresses — keybind-dependent, so it's left
as a clearly marked TODO in [plugin/PitMfd.cs](plugin/PitMfd.cs). The `SendInput`
scaffold and the enable flag are in place; wire the MFD walk to your binds, then
tick *Apply pit commands* in settings. Until then, commands are acknowledged and
logged but not actuated.

## Layout

```
plugin/
  EnduranceTelemetry.csproj      net48 plugin, references SimHub assemblies
  EnduranceTelemetryPlugin.cs    IDataPlugin: lifecycle + property surface
  TelemetryMapper.cs             SimHub GameData (+ACC raw) -> Telemetry
  StrategyEngine.cs              rolling fuel/lap, laps-to-go, fuel-to-add
  Models.cs                      Telemetry / Strategy / Standing / PitCommand
  CommandServer.cs               in-process HTTP: control page + command channel
  PitMfd.cs                      ACC pit-MFD keypress application (scaffold)
  SettingsControl.cs             SimHub settings panel
  PluginSettings.cs              persisted settings
  web/control.html               engineer's phone page (plain HTML/JS)
```
