namespace EnduranceTelemetry
{
    // Persisted via SimHub's common-settings store (see plugin Init/End).
    public class PluginSettings
    {
        public int HttpPort = 8765;
        public bool EnablePitMfd = false;   // off until you wire your ACC binds
        public string DriverName = "romanoBeer";
    }
}
