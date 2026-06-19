using System;
using System.Collections.Generic;
using System.Linq;

namespace EnduranceTelemetry
{
    // The "race engineer" math: rolling fuel-per-lap, laps remaining, fuel to add.
    // Direct port of the old Python StrategyEngine. Fed the mapped Telemetry each
    // tick; only acts on lap transitions, so it works across every sim SimHub reads
    // (it never touches sim-specific fields).
    public class StrategyEngine
    {
        private const int RollingLaps = 5;
        private const double SafetyMarginL = 0.5;

        private int _lastLaps = -1;
        private double _fuelAtLapStart;
        private readonly Queue<double> _burns = new Queue<double>();
        private int _lastLapMs;

        public Strategy Update(Telemetry t)
        {
            if (!t.Connected)
                return new Strategy();

            int laps = t.CompletedLaps;
            double fuel = t.Fuel;

            // On a completed lap, record fuel burned (ignoring refuel jumps).
            if (laps != _lastLaps)
            {
                if (_lastLaps >= 0)
                {
                    double burned = _fuelAtLapStart - fuel;
                    if (burned > 0.0 && burned < _fuelAtLapStart)
                    {
                        _burns.Enqueue(burned);
                        while (_burns.Count > RollingLaps) _burns.Dequeue();
                    }
                }
                _lastLaps = laps;
                _fuelAtLapStart = fuel;
                if (t.ILastTime > 0) _lastLapMs = t.ILastTime;
            }

            double avg = _burns.Count > 0
                ? _burns.Average()
                : Math.Max(t.FuelPerLap, 0.0);

            double lapsInTank = avg > 0 ? fuel / avg : 0.0;

            double timeLeft = t.SessionTimeLeft;
            double lapsRemaining;
            if (_lastLapMs > 0 && timeLeft > 0)
                // +1: most sims let you start a final lap if you cross the line in time.
                lapsRemaining = Math.Ceiling(timeLeft / (_lastLapMs / 1000.0)) + 1;
            else
                lapsRemaining = 0.0;

            double fuelToFinish = Math.Max(lapsRemaining * avg + SafetyMarginL, 0.0);
            double maxFuel = t.MaxFuel;
            double fuelToAdd = Math.Max(Math.Min(fuelToFinish - fuel, maxFuel - fuel), 0.0);

            return new Strategy
            {
                AvgFuelPerLap = Math.Round(avg, 3),
                LapsInTank = Math.Round(lapsInTank, 2),
                LapsRemainingInSession = lapsRemaining,
                FuelToFinish = Math.Round(fuelToFinish, 2),
                FuelToAdd = Math.Round(fuelToAdd, 2),
                HasData = _burns.Count > 0,
            };
        }
    }
}
