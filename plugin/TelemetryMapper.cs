using System;
using System.Collections;
using System.Collections.Generic;
using System.Reflection;
using GameReaderCommon;

namespace EnduranceTelemetry
{
    // Maps SimHub's normalized GameData into our flat Telemetry. Normalized fields
    // (StatusDataBase) cover every sim SimHub reads. ACC-only extras (tyre wear,
    // electronics, rain forecast, pit-MFD state) are pulled from the raw data
    // object via reflection so a missing field degrades to a default instead of a
    // crash — and other sims simply leave those zeroed.
    public static class TelemetryMapper
    {
        public static Telemetry Map(GameData data)
        {
            var t = new Telemetry { Game = data.GameName ?? "" };
            var d = data.NewData;
            if (d == null || !data.GameRunning)
                return t;

            t.Connected = true;
            t.Status = data.GameRunning ? 2 : 0;
            t.SpeedKmh = d.SpeedKmh;
            t.Rpm = (int)d.Rpms;
            t.MaxRpm = (int)d.MaxRpm;
            t.Gear = ParseGear(d.Gear);
            t.Fuel = d.Fuel;
            t.MaxFuel = d.MaxFuel;
            t.Gas = d.Throttle / 100.0;
            t.Brake = d.Brake / 100.0;
            t.CompletedLaps = d.CompletedLaps;
            t.ICurrentTime = Ms(d.CurrentLapTime);
            t.ILastTime = Ms(d.LastLapTime);
            t.IBestTime = Ms(d.BestLapTime);
            t.SessionTimeLeft = d.SessionTimeLeft.TotalSeconds;
            t.IsInPit = d.IsInPit > 0;
            t.IsInPitLane = d.IsInPitLane > 0;
            t.Position = d.Position;
            t.AirTemp = d.AirTemperature;
            t.RoadTemp = d.RoadTemperature;
            t.TrackPos = d.TrackPositionPercent;
            t.CarModel = d.CarModel ?? "";
            t.Track = d.TrackName ?? "";
            t.PlayerNick = d.PlayerName ?? "";

            t.TyrePressure = new[] {
                d.TyrePressureFrontLeft, d.TyrePressureFrontRight,
                d.TyrePressureRearLeft, d.TyrePressureRearRight };
            t.TyreCoreTemp = new[] {
                d.TyreTemperatureFrontLeft, d.TyreTemperatureFrontRight,
                d.TyreTemperatureRearLeft, d.TyreTemperatureRearRight };
            t.BrakeTemp = new[] {
                d.BrakeTemperatureFrontLeft, d.BrakeTemperatureFrontRight,
                d.BrakeTemperatureRearLeft, d.BrakeTemperatureRearRight };

            t.Standings = MapStandings(d.Opponents);

            // ACC and a few others expose richer engineer data on the raw object.
            try { MapRawExtras(data.NewData.GetRawDataObject(), t); }
            catch { /* raw layout varies by sim/version — extras are best-effort */ }

            return t;
        }

        private static List<Standing> MapStandings(IEnumerable<Opponent> opponents)
        {
            var list = new List<Standing>();
            if (opponents == null) return list;
            foreach (var o in opponents)
            {
                if (o == null) continue;
                list.Add(new Standing
                {
                    Position = o.Position,
                    Name = o.Name ?? "",
                    CarNumber = ParseInt(o.CarNumber),
                    TrackPos = o.TrackPositionPercent ?? 0.0,
                    GapToLeaderMs = (int)((o.GaptoLeader ?? 0.0) * 1000),
                    IntervalMs = (int)((o.GaptoPlayer ?? 0.0) * 1000),
                    LastLapMs = Ms(o.LastLapTime),
                    BestLapMs = Ms(o.BestLapTime),
                    LapsCompleted = o.CurrentLap ?? 0,
                    CarClass = o.CarClass ?? "",
                    InPit = o.IsCarInPit || o.IsCarInPitLane,
                    IsPlayer = o.IsPlayer,
                });
            }
            return list;
        }

        // --- raw object access via reflection (resilient to version drift) -------

        private static void MapRawExtras(object raw, Telemetry t)
        {
            if (raw == null) return;
            // ACC raw exposes .Physics / .Graphics / .StaticInfo (mirrors the SDK).
            object phys = Get(raw, "Physics");
            object gfx = Get(raw, "Graphics");
            object stat = Get(raw, "StaticInfo");
            if (phys == null && gfx == null) return; // not an ACC-style payload

            // ACC tyreWear is 0.0–1.0 remaining; convert to 0–100% for display.
            var rawWear = Floats(Get(phys, "tyreWear"), 4, null);
            if (rawWear != null)
                t.TyreWear = new[] { rawWear[0] * 100, rawWear[1] * 100, rawWear[2] * 100, rawWear[3] * 100 };
            t.PadLife = Floats(Get(phys, "padLife"), 4, t.PadLife);
            t.DiscLife = Floats(Get(phys, "discLife"), 4, t.DiscLife);
            t.CarDamage = Floats(Get(phys, "carDamage"), 5, t.CarDamage);
            t.BrakeBias = ToD(Get(phys, "brakeBias")) * 100.0;

            t.TyreCompound = (Get(gfx, "tyreCompound") as string) ?? t.TyreCompound;
            t.CurSector = ToI(Get(gfx, "currentSectorIndex"));
            t.Flag = ToI(Get(gfx, "flag"));
            t.GlobalYellow = ToI(Get(gfx, "globalYellow")) > 0;
            t.TrackGripStatus = ToI(Get(gfx, "trackGripStatus"));
            t.RainIntensity = ToI(Get(gfx, "rainIntensity"));
            t.RainIn10min = ToI(Get(gfx, "rainIntensityIn10min"));
            t.RainIn30min = ToI(Get(gfx, "rainIntensityIn30min"));
            t.WindSpeedMs = ToD(Get(gfx, "windSpeed"));
            t.WindDir = (int)(ToD(Get(gfx, "windDirection")) * 180.0 / Math.PI) % 360;
            t.EstimatedLapMs = ToI(Get(gfx, "iEstimatedLapTime"));
            t.TyreSetLaps = ToI(Get(gfx, "currentTyreSet"));
            t.FuelPerLap = ToD(Get(gfx, "fuelXLap"));
            t.FuelEstimatedLaps = ToD(Get(gfx, "fuelEstimatedLaps"));
            if (t.TrackPos == 0.0) t.TrackPos = ToD(Get(gfx, "normalizedCarPosition"));

            // Sector times (ACC graphics: lastSectorTime / bestSectorTime are int[3] in ms).
            t.LastSectors = Ints(Get(gfx, "lastSectorTime"), 3, t.LastSectors);
            t.BestSectors = Ints(Get(gfx, "bestSectorTime"), 3, t.BestSectors);

            t.Electronics = new Electronics
            {
                Tc = ToI(Get(gfx, "tc")),
                TcCut = ToI(Get(gfx, "tcCut")),
                Abs = ToI(Get(gfx, "abs")),
                Map = ToI(Get(gfx, "engineMap")),
                Bb = t.BrakeBias,
                FArb = 0,
                RArb = 0,
            };

            // Synthesize a short forecast curve from the three ACC rain points so
            // the Weather dashboard has a trend, not just a single number.
            t.Forecast = new List<ForecastSlot>
            {
                Slot(0,  t.RainIntensity, t.AirTemp, t.RoadTemp),
                Slot(10, t.RainIn10min,   t.AirTemp, t.RoadTemp),
                Slot(30, t.RainIn30min,   t.AirTemp, t.RoadTemp),
            };

            if (t.MaxFuel <= 0) t.MaxFuel = ToD(Get(stat, "maxFuel"));
            if (t.MaxRpm <= 0) t.MaxRpm = ToI(Get(stat, "maxRpm"));
        }

        private static ForecastSlot Slot(int min, int rainEnum, double air, double road)
        {
            double rain = Math.Min(rainEnum / 6.0, 1.0); // ACC rain enum 0..6 -> 0..1
            return new ForecastSlot
            {
                Minutes = min,
                Rain = Math.Round(rain, 2),
                AirTemp = Math.Round(air, 1),
                TrackTemp = Math.Round(road, 1),
                Grip = Math.Round(Math.Max(0.0, 1.0 - rain * 0.6), 2),
            };
        }

        // --- tiny reflection + parse helpers -------------------------------------

        private static object Get(object obj, string name)
        {
            if (obj == null) return null;
            var ty = obj.GetType();
            var p = ty.GetProperty(name, BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
            if (p != null) return p.GetValue(obj);
            var f = ty.GetField(name, BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
            return f?.GetValue(obj);
        }

        private static double[] Floats(object arr, int n, double[] fallback)
        {
            if (!(arr is IEnumerable e)) return fallback;
            var outv = new double[n];
            int i = 0;
            foreach (var x in e) { if (i >= n) break; outv[i++] = ToD(x); }
            return i == 0 ? fallback : outv;
        }

        private static int[] Ints(object arr, int n, int[] fallback)
        {
            if (!(arr is IEnumerable e)) return fallback;
            var outv = new int[n];
            int i = 0;
            foreach (var x in e) { if (i >= n) break; outv[i++] = ToI(x); }
            return i == 0 ? fallback : outv;
        }

        private static double ToD(object o)
        {
            try { return o == null ? 0.0 : Convert.ToDouble(o); } catch { return 0.0; }
        }

        private static int ToI(object o)
        {
            try { return o == null ? 0 : Convert.ToInt32(o); } catch { return 0; }
        }

        private static int Ms(TimeSpan ts) => (int)ts.TotalMilliseconds;
        private static int Ms(TimeSpan? ts) => ts.HasValue ? (int)ts.Value.TotalMilliseconds : 0;

        private static int ParseInt(string s) => int.TryParse(s, out var v) ? v : 0;

        private static int ParseGear(string g)
        {
            if (string.IsNullOrEmpty(g)) return 0;
            if (g == "N") return 0;
            if (g == "R") return -1;
            return int.TryParse(g, out var v) ? v : 0;
        }
    }
}
