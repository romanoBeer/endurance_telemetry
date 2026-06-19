using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;

namespace EnduranceTelemetry
{
    // In-process HTTP server: the plugin's whole remote/team surface in one place,
    // replacing the old Python relay. The rig driver uses native SimHub dashboards;
    // an engineer's phone hits this on the LAN.
    //
    //   GET  /                -> the control page (plain HTML, no build step)
    //   GET  /telemetry       -> latest { telemetry, strategy } as camelCase JSON
    //   POST /strategy        -> apply a PitCommand (engineer pushes), returns ack
    //   GET  /health          -> { ok: true }
    //
    // CORS-open and GET-pollable so any device on the LAN can read it. Binding to
    // a non-localhost prefix needs a URL ACL on Windows (see README).
    public class CommandServer
    {
        private static readonly JsonSerializerSettings JsonOpts = new JsonSerializerSettings
        {
            ContractResolver = new CamelCasePropertyNamesContractResolver(),
            NullValueHandling = NullValueHandling.Ignore,
        };

        private readonly Func<PitCommand, bool> _onCommand;
        private readonly Action<string> _log;
        private readonly string _htmlPath;

        private HttpListener _listener;
        private Thread _thread;
        private volatile string _latestJson = "{}";
        private volatile bool _running;

        public CommandServer(Func<PitCommand, bool> onCommand, Action<string> log, string htmlPath)
        {
            _onCommand = onCommand;
            _log = log;
            _htmlPath = htmlPath;
        }

        // Called each tick with the combined payload to serve to pollers.
        public void Publish(object payload)
        {
            try { _latestJson = JsonConvert.SerializeObject(payload, JsonOpts); }
            catch { /* keep last good */ }
        }

        public void Start(int port)
        {
            Stop();
            _listener = new HttpListener();
            // "+" binds all interfaces; falls back to localhost if the ACL is missing.
            _listener.Prefixes.Add($"http://+:{port}/");
            try
            {
                _listener.Start();
            }
            catch (HttpListenerException)
            {
                _log($"no URL ACL for port {port}; binding localhost only " +
                     "(run the netsh command in the README for LAN access).");
                _listener = new HttpListener();
                _listener.Prefixes.Add($"http://localhost:{port}/");
                _listener.Start();
            }

            _running = true;
            _thread = new Thread(Loop) { IsBackground = true, Name = "EnduranceTelemetry.Http" };
            _thread.Start();
            _log($"command server listening on :{port}");
        }

        public void Stop()
        {
            _running = false;
            try { _listener?.Stop(); } catch { }
            try { _listener?.Close(); } catch { }
            _listener = null;
        }

        private void Loop()
        {
            while (_running && _listener != null && _listener.IsListening)
            {
                HttpListenerContext ctx;
                try { ctx = _listener.GetContext(); }
                catch { break; } // listener stopped
                try { Handle(ctx); }
                catch (Exception e) { _log($"http error: {e.Message}"); }
            }
        }

        private void Handle(HttpListenerContext ctx)
        {
            var req = ctx.Request;
            var res = ctx.Response;
            res.AddHeader("Access-Control-Allow-Origin", "*");
            res.AddHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
            res.AddHeader("Access-Control-Allow-Headers", "Content-Type");

            if (req.HttpMethod == "OPTIONS") { res.StatusCode = 204; res.Close(); return; }

            string path = req.Url.AbsolutePath.TrimEnd('/');
            switch (path)
            {
                case "":
                case "/index.html":
                    ServeHtml(res);
                    break;
                case "/telemetry":
                    Write(res, _latestJson, "application/json");
                    break;
                case "/health":
                    Write(res, "{\"ok\":true}", "application/json");
                    break;
                case "/strategy":
                    HandleStrategy(req, res);
                    break;
                default:
                    res.StatusCode = 404;
                    Write(res, "{\"error\":\"not found\"}", "application/json");
                    break;
            }
        }

        private void HandleStrategy(HttpListenerRequest req, HttpListenerResponse res)
        {
            if (req.HttpMethod != "POST") { res.StatusCode = 405; res.Close(); return; }
            string body;
            using (var sr = new StreamReader(req.InputStream, req.ContentEncoding))
                body = sr.ReadToEnd();

            PitCommand cmd;
            try { cmd = JsonConvert.DeserializeObject<PitCommand>(body, JsonOpts); }
            catch
            {
                res.StatusCode = 400;
                Write(res, "{\"error\":\"bad command\"}", "application/json");
                return;
            }

            bool applied = false;
            try { applied = _onCommand(cmd ?? new PitCommand()); }
            catch (Exception e) { _log($"apply error: {e.Message}"); }

            Write(res, $"{{\"applied\":{applied.ToString().ToLowerInvariant()}}}", "application/json");
        }

        private void ServeHtml(HttpListenerResponse res)
        {
            if (File.Exists(_htmlPath))
            {
                Write(res, File.ReadAllText(_htmlPath), "text/html");
                return;
            }
            res.StatusCode = 500;
            Write(res, "control.html not found next to the plugin", "text/plain");
        }

        private static void Write(HttpListenerResponse res, string body, string contentType)
        {
            var bytes = Encoding.UTF8.GetBytes(body);
            res.ContentType = contentType;
            res.ContentLength64 = bytes.Length;
            res.OutputStream.Write(bytes, 0, bytes.Length);
            res.OutputStream.Close();
        }
    }
}
