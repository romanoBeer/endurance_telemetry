using System.Windows;
using System.Windows.Controls;

namespace EnduranceTelemetry
{
    // Minimal settings panel shown under SimHub's left menu. Built in code so there's
    // no XAML build-action to wire; SimHub just needs a Control back.
    public class SettingsControl : UserControl
    {
        private readonly EnduranceTelemetryPlugin _plugin;

        public SettingsControl(EnduranceTelemetryPlugin plugin)
        {
            _plugin = plugin;
            var s = plugin.Settings;

            var root = new StackPanel { Margin = new Thickness(16) };

            root.Children.Add(Heading("Endurance Telemetry"));
            root.Children.Add(Note(
                "Telemetry is read from SimHub (any supported sim) and exposed as " +
                "[Endurance Telemetry.*] properties for dashboards. An engineer can " +
                "open the control page on a phone to push pit strategy to the rig."));

            // HTTP port.
            var port = new TextBox { Text = s.HttpPort.ToString(), Width = 90, HorizontalAlignment = HorizontalAlignment.Left };
            root.Children.Add(Field("Control page / HTTP port", port));

            // Driver name.
            var driver = new TextBox { Text = s.DriverName, Width = 200, HorizontalAlignment = HorizontalAlignment.Left };
            root.Children.Add(Field("Driver name", driver));

            // Enable pit-MFD automation.
            var enableMfd = new CheckBox
            {
                Content = "Apply pit commands to the ACC pit MFD (keypress automation)",
                IsChecked = s.EnablePitMfd,
                Margin = new Thickness(0, 10, 0, 0),
            };
            root.Children.Add(enableMfd);
            root.Children.Add(Note(
                "Off by default. The MFD walk is keybind-dependent and must be wired " +
                "in PitMfd.Apply before this actuates anything."));

            // Save.
            var save = new Button { Content = "Save & restart server", Width = 180, Margin = new Thickness(0, 16, 0, 0), HorizontalAlignment = HorizontalAlignment.Left };
            var status = new TextBlock { Margin = new Thickness(0, 8, 0, 0), Foreground = System.Windows.Media.Brushes.LightGreen };
            save.Click += (_, __) =>
            {
                if (int.TryParse(port.Text, out var p) && p > 0 && p < 65536) s.HttpPort = p;
                s.DriverName = string.IsNullOrWhiteSpace(driver.Text) ? "driver" : driver.Text.Trim();
                s.EnablePitMfd = enableMfd.IsChecked == true;
                _plugin.Save();
                _plugin.RestartServer();
                status.Text = $"Saved. Control page: http://<rig-ip>:{s.HttpPort}/";
            };
            root.Children.Add(save);
            root.Children.Add(status);

            Content = root;
        }

        private static UIElement Heading(string text) => new TextBlock
        {
            Text = text,
            FontSize = 18,
            FontWeight = FontWeights.Bold,
            Margin = new Thickness(0, 0, 0, 8),
        };

        private static UIElement Note(string text) => new TextBlock
        {
            Text = text,
            TextWrapping = TextWrapping.Wrap,
            Opacity = 0.7,
            Margin = new Thickness(0, 4, 0, 8),
            MaxWidth = 520,
            HorizontalAlignment = HorizontalAlignment.Left,
        };

        private static UIElement Field(string label, UIElement input)
        {
            var sp = new StackPanel { Orientation = Orientation.Vertical, Margin = new Thickness(0, 10, 0, 0) };
            sp.Children.Add(new TextBlock { Text = label, Margin = new Thickness(0, 0, 0, 4) });
            sp.Children.Add(input);
            return sp;
        }
    }
}
