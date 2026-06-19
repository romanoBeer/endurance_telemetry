using System.Collections.Generic;

namespace EnduranceTelemetry
{
    // Flat snapshot mirroring the old agent's Snapshot dict. Serialized to the
    // phone control page (camelCase) and surfaced field-by-field as SimHub
    // properties for native dashboards/overlays.
    public class Telemetry
    {
        public bool Connected;
        public int Status;
        public int Session;
        public int Gear;
        public int Rpm;
        public int MaxRpm;
        public double SpeedKmh;
        public double Fuel;
        public double MaxFuel;
        public double Gas;
        public double Brake;
        public double[] TyrePressure = new double[4];
        public double[] TyreCoreTemp = new double[4];
        public double[] TyreWear = new double[4];      // 0..100% tread remaining (FL,FR,RL,RR)
        public double[] BrakeTemp = new double[4];
        public double[] PadLife = new double[4];
        public double[] DiscLife = new double[4];
        public double[] CarDamage = new double[5];
        public double AirTemp;
        public double RoadTemp;
        public int Position;
        public int CompletedLaps;
        public int ICurrentTime;       // ms
        public int ILastTime;          // ms
        public int IBestTime;          // ms
        public double SessionTimeLeft; // seconds
        public bool IsInPit;
        public bool IsInPitLane;
        public double FuelPerLap;
        public double FuelEstimatedLaps;
        public bool IsValidLap;
        public bool GlobalYellow;
        public int Flag;
        public int RainIntensity;
        public int RainIn10min;
        public int RainIn30min;
        public int TrackGripStatus;
        public string CarModel = "";
        public string Track = "";
        public string PlayerNick = "";
        public string TyreCompound = "";
        public double TrackPos;        // 0..1 spline position of the player's car

        public List<Standing> Standings = new List<Standing>();
        public List<ForecastSlot> Forecast = new List<ForecastSlot>();
        public Electronics Electronics = new Electronics();
        public int[] LastSectors = new int[3];
        public int[] BestSectors = new int[3];
        public int CurSector;
        public int EstimatedLapMs;
        public double WindSpeedMs;
        public int WindDir;
        public string CornerName = "";
        public double BrakeBias;
        public int TyreSetLaps;

        // The sim SimHub is currently reading (so dashboards can branch on it).
        public string Game = "";
    }

    public class Electronics
    {
        public int Tc;
        public int TcCut;
        public int Abs;
        public double Bb;     // brake bias %
        public int Map;       // engine map
        public int FArb;      // front anti-roll bar
        public int RArb;      // rear anti-roll bar
    }

    public class Standing
    {
        public int Position;
        public string Name = "";
        public int CarNumber;
        public double TrackPos;       // 0..1 around the lap
        public int GapToLeaderMs;
        public int IntervalMs;
        public int LastLapMs;
        public int BestLapMs;
        public int[] Sectors = new int[3];
        public int LapsCompleted;
        public string TyreCompound = "";
        public int TyreAgeLaps;
        public string CarClass = "";
        public string CarBrand = "";
        public int PitCount;
        public bool InPit;
        public bool IsPlayer;
    }

    public class ForecastSlot
    {
        public int Minutes;
        public double Rain;       // 0..1
        public double AirTemp;
        public double TrackTemp;
        public double Grip;       // 0..1
    }

    public class Strategy
    {
        public double AvgFuelPerLap;
        public double LapsInTank;
        public double LapsRemainingInSession;
        public double FuelToFinish;
        public double FuelToAdd;
        public bool HasData;
    }

    // Engineer's pit request, pushed from the phone control page.
    public class PitCommand
    {
        public double FuelToAdd;
        public bool ChangeTyres;
        public double[] Pressures = new double[4];
        public int TyreSet;
    }
}
