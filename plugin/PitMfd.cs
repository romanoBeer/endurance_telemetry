using System;
using System.Runtime.InteropServices;
using System.Threading;

namespace EnduranceTelemetry
{
    // Applies an engineer's pit request in-game. ACC has no API to set the pit MFD
    // directly, so (like PyAccEngineer) you diff the current MFD state against the
    // desired one and emit keypresses to walk it there. That walk is keybind-
    // dependent, so the actual navigation is left as a clearly-marked TODO; the
    // SendInput scaffold below is ready to drive it once you wire your binds.
    //
    // Honors a global enable flag — off by default so nothing presses keys on your
    // rig until you opt in.
    public static class PitMfd
    {
        public static Func<bool> Enabled = () => false;
        public static Action<string> Log = _ => { };

        public static bool Apply(PitCommand cmd)
        {
            Log($"pit request: fuel=+{cmd.FuelToAdd:0.0}L tyres={cmd.ChangeTyres} " +
                $"set={cmd.TyreSet} press=[{string.Join(",", cmd.Pressures)}]");

            if (!Enabled())
            {
                Log("pit-MFD automation disabled (Settings → enable to apply); request logged only.");
                return true; // acknowledged; just not actuated
            }

            // TODO(real rig): read current MFD state from graphics (mfdFuelToAdd,
            // mfdTyreSet, mfdTyrePressure*), compute the delta to `cmd`, and walk
            // the MFD with TapKey() per your ACC keybinds. Example skeleton:
            //
            //   OpenPitMfd();
            //   AdjustFuel(currentFuelToAdd, cmd.FuelToAdd);
            //   if (cmd.ChangeTyres) SelectTyreSet(cmd.TyreSet);
            //   SetPressures(cmd.Pressures);
            //
            Log("pit-MFD walk not yet wired to your binds — see PitMfd.Apply TODO.");
            return false;
        }

        // --- SendInput keypress scaffold -----------------------------------------

        public static void TapKey(ushort scanCode, int holdMs = 25)
        {
            SendScan(scanCode, down: true);
            Thread.Sleep(holdMs);
            SendScan(scanCode, down: false);
            Thread.Sleep(holdMs);
        }

        private static void SendScan(ushort scanCode, bool down)
        {
            var input = new INPUT
            {
                type = INPUT_KEYBOARD,
                u = new InputUnion
                {
                    ki = new KEYBDINPUT
                    {
                        wVk = 0,
                        wScan = scanCode,
                        dwFlags = KEYEVENTF_SCANCODE | (down ? 0u : KEYEVENTF_KEYUP),
                        time = 0,
                        dwExtraInfo = IntPtr.Zero,
                    }
                }
            };
            SendInput(1, new[] { input }, Marshal.SizeOf(typeof(INPUT)));
        }

        private const int INPUT_KEYBOARD = 1;
        private const uint KEYEVENTF_KEYUP = 0x0002;
        private const uint KEYEVENTF_SCANCODE = 0x0008;

        [DllImport("user32.dll", SetLastError = true)]
        private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

        [StructLayout(LayoutKind.Sequential)]
        private struct INPUT { public int type; public InputUnion u; }

        [StructLayout(LayoutKind.Explicit)]
        private struct InputUnion { [FieldOffset(0)] public KEYBDINPUT ki; }

        [StructLayout(LayoutKind.Sequential)]
        private struct KEYBDINPUT
        {
            public ushort wVk;
            public ushort wScan;
            public uint dwFlags;
            public uint time;
            public IntPtr dwExtraInfo;
        }
    }
}
