# In-game overlay shell

The overlay is the *same* React app rendered in a transparent, always-on-top
Tauri window via the `?overlay=1` route — so there's no second UI to maintain.

## How it works
- The web app detects `?overlay=1` and renders the slim `Overlay` component with
  a transparent background.
- A tiny Tauri shell hosts it in a borderless, always-on-top window. The key
  settings are in `tauri.conf.json`: `transparent: true`, `decorations: false`,
  `alwaysOnTop: true`, `skipTaskbar: true`.

## Build
```bash
cd ../web && npm run build      # produces web/dist
# then scaffold a Tauri app around it (or reuse the shell from the earlier
# Tauri project) pointing frontendDist at ../web/dist and using the window
# config in tauri.conf.json here.
npm create tauri-app@latest     # if starting fresh; replace src-tauri/tauri.conf.json
npm run tauri build
```

## Click-through (optional)
To let mouse clicks pass through to ACC, call this once on startup in the Rust
side (`setup`):
```rust
window.set_ignore_cursor_events(true)?;
```
Bind a hotkey to toggle it when you want to drag/resize the overlay.

## ⚠️ ACC display-mode caveat
Overlays only draw over ACC in **Borderless / Windowed**, not exclusive
Fullscreen — same limitation every overlay tool (SimHub, etc.) has. Set ACC to
Borderless in Video settings. For triple-screen or VR, a second-monitor browser
dashboard is usually the better surface anyway.

## Lighter alternative
If you don't want to ship a Tauri build, any always-on-top browser window
pointed at `http://RIG_OR_LAN_IP:5173/?overlay=1&...` works as a quick overlay
on a second monitor — no native shell needed.
