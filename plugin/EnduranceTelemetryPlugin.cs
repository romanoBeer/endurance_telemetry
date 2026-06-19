using System;
using System.IO;
using System.Reflection;
using System.Windows.Media;
using GameReaderCommon;
using SimHub.Plugins;

namespace EnduranceTelemetry
{
    // Endurance Telemetry — a team race-engineer pitwall, rebuilt as a SimHub plugin.
    //
    // Reads SimHub's normalized telemetry (every supported sim), computes the
    // engineer numbers (rolling fuel/lap, laps-to-go, fuel-to-add), and:
    //   * surfaces everything as SimHub properties for native dashboards/overlays,
    //   * hosts a tiny HTTP endpoint + phone control page so a remote engineer can
    //     read the data and push a pit strategy back to the rig (which applies it
    //     to the ACC pit MFD).
    //
    // This is the whole project: the old Python agent + relay and the React UI are
    // replaced by this single plugin.
    [PluginDescription("Team race-engineer pitwall: strategy, leaderboard, weather, remote pit commands.")]
    [PluginAuthor("romanoBeer")]
    [PluginName("Endurance Telemetry")]
    public class EnduranceTelemetryPlugin : IPlugin, IDataPlugin, IWPFSettingsV2
    {
        public PluginManager PluginManager { get; set; }
        public PluginSettings Settings { get; private set; }

        public ImageSource PictureIcon => null;
        public string LeftMenuTitle => "Endurance Telemetry";

        private readonly StrategyEngine _engine = new StrategyEngine();
        private CommandServer _server;

        // Latest computed values; property delegates and the HTTP server read these.
        private volatile Telemetry _t = new Telemetry();
        private volatile Strategy _s = new Strategy();

        public void Init(PluginManager pluginManager)
        {
            Settings = this.ReadCommonSettings("GeneralSettings", () => new PluginSettings());

            PitMfd.Enabled = () => Settings.EnablePitMfd;
            PitMfd.Log = s => SimHub.Logging.Current.Info($"[EnduranceTelemetry] {s}");

            // Phone control page ships next to the DLL / in PluginsData.
            string html = ResolveHtmlPath();
            _server = new CommandServer(ApplyCommand,
                s => SimHub.Logging.Current.Info($"[EnduranceTelemetry] {s}"), html);
            _server.Start(Settings.HttpPort);

            AttachProperties();
            SimHub.Logging.Current.Info("[EnduranceTelemetry] initialised");
        }

        public void End(PluginManager pluginManager)
        {
            _server?.Stop();
            this.SaveCommonSettings("GeneralSettings", Settings);
        }

        public void DataUpdate(PluginManager pluginManager, ref GameData data)
        {
            if (data?.NewData == null) return;

            var t = TelemetryMapper.Map(data);
            var s = _engine.Update(t);
            _t = t;
            _s = s;

            _server?.Publish(new { telemetry = t, strategy = s, driver = Settings.DriverName });
        }

        // Engineer's pit request arrives from the control page -> apply in-game.
        private bool ApplyCommand(PitCommand cmd) => PitMfd.Apply(cmd);

        // Called by the settings UI after the port changes.
        public void RestartServer()
        {
            _server?.Stop();
            _server?.Start(Settings.HttpPort);
        }

        public void Save() => this.SaveCommonSettings("GeneralSettings", Settings);

        // --- SimHub property surface (bind from dashboards as [Endurance Telemetry.X]) ---

        private void AttachProperties()
        {
            // Strategy — the headline engineer numbers.
            this.AttachDelegate("Strategy.FuelToAdd", () => _s.FuelToAdd);
            this.AttachDelegate("Strategy.FuelToFinish", () => _s.FuelToFinish);
            this.AttachDelegate("Strategy.AvgFuelPerLap", () => _s.AvgFuelPerLap);
            this.AttachDelegate("Strategy.LapsInTank", () => _s.LapsInTank);
            this.AttachDelegate("Strategy.LapsRemaining", () => _s.LapsRemainingInSession);
            this.AttachDelegate("Strategy.HasData", () => _s.HasData);

            // Core telemetry mirrors.
            this.AttachDelegate("Fuel", () => _t.Fuel);
            this.AttachDelegate("MaxFuel", () => _t.MaxFuel);
            this.AttachDelegate("Position", () => _t.Position);
            this.AttachDelegate("CompletedLaps", () => _t.CompletedLaps);
            this.AttachDelegate("LastLapMs", () => _t.ILastTime);
            this.AttachDelegate("BestLapMs", () => _t.IBestTime);
            this.AttachDelegate("SessionTimeLeft", () => _t.SessionTimeLeft);
            this.AttachDelegate("TrackPos", () => _t.TrackPos);
            this.AttachDelegate("BrakeBias", () => _t.BrakeBias);
            this.AttachDelegate("TyreCompound", () => _t.TyreCompound);

            // Weather / rain.
            this.AttachDelegate("Rain.Now", () => _t.RainIntensity);
            this.AttachDelegate("Rain.In10min", () => _t.RainIn10min);
            this.AttachDelegate("Rain.In30min", () => _t.RainIn30min);
            this.AttachDelegate("TrackGrip", () => _t.TrackGripStatus);

            // Per-corner arrays as indexed properties for tyre/brake widgets.
            string[] corner = { "FL", "FR", "RL", "RR" };
            for (int i = 0; i < 4; i++)
            {
                int idx = i;
                this.AttachDelegate($"Tyre.{corner[i]}.Pressure", () => Arr(_t.TyrePressure, idx));
                this.AttachDelegate($"Tyre.{corner[i]}.CoreTemp", () => Arr(_t.TyreCoreTemp, idx));
                this.AttachDelegate($"Tyre.{corner[i]}.Wear", () => Arr(_t.TyreWear, idx));
                this.AttachDelegate($"Brake.{corner[i]}.Temp", () => Arr(_t.BrakeTemp, idx));
            }

            // Whole-payload JSON for richer custom dashboards (leaderboard, map).
            this.AttachDelegate("FieldCount", () => _t.Standings.Count);
            this.AttachDelegate("Game", () => _t.Game);
        }

        private static double Arr(double[] a, int i) => (a != null && i < a.Length) ? a[i] : 0.0;

        public System.Windows.Controls.Control GetWPFSettingsControl(PluginManager pluginManager)
            => new SettingsControl(this);

        private string ResolveHtmlPath()
        {
            string dir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location) ?? ".";
            string[] candidates =
            {
                Path.Combine(dir, "PluginsData", "EnduranceTelemetry", "control.html"),
                Path.Combine(dir, "control.html"),
            };
            foreach (var c in candidates) if (File.Exists(c)) return c;
            return candidates[0];
        }
    }
}
