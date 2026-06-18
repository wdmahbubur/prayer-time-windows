# Prayer Times for Windows

A Windows desktop prayer-times app inspired by the macOS menu-bar app
[`tareq1988/prayer-times-macos`](https://github.com/tareq1988/prayer-times-macos).

This port is built with Tauri, React, TypeScript, and Rust. It runs as a lightweight
tray app on Windows, shows the next prayer with a live countdown, supports manual
jamaat schedules, notifications, Adhan playback, and a fullscreen Focus Mode.

## Highlights

- Windows tray app with show, hide, and quit actions.
- Close button hides the app to tray instead of exiting.
- Live next-prayer countdown and prayer list panel.
- Calculated prayer times with multiple calculation methods.
- Manual fixed jamaat schedule mode.
- Per-prayer notification controls.
- At-time alerts, before-prayer reminders, Adhan playback, and sample notification.
- Fullscreen Focus Mode that can block the screen at prayer time.
- Launch at login support through Tauri autostart.
- One-shot location detection.
- Neon material dark UI with responsive settings layout.
- MSI and NSIS installer generation.

## Current Version

`0.1.4`

## Tech Stack

- Tauri v2
- Rust
- React 19
- TypeScript
- Vite
- Vitest
- Lucide React icons

## Requirements

- Windows 10 or Windows 11
- Node.js and npm
- Rust with Cargo
- Visual Studio 2022 Build Tools with Desktop development with C++
- WebView2 Runtime, normally already present on modern Windows

## Getting Started

Install dependencies:

```powershell
npm install
```

Run the web preview:

```powershell
npm run dev
```

Run the Tauri app in development:

```powershell
npm run tauri:dev
```

Run tests:

```powershell
npm test
```

Build the web app:

```powershell
npm run build
```

Build the Windows desktop installers:

```powershell
npm run tauri:build
```

If Cargo cannot find the MSVC linker, run the build from a Visual Studio developer
shell or initialize the build environment first:

```powershell
cmd /c "call ""C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvars64.bat"" && npm run tauri:build"
```

## Code Signing and SmartScreen

Windows SmartScreen warnings are controlled by Microsoft Defender reputation and
Authenticode signing, not by installer artwork or UI design. To avoid warnings for
most users, publish installers signed with a trusted code-signing certificate.

Best production path:

1. Buy/use a trusted Windows code-signing certificate.
2. Prefer EV code signing or Azure Trusted Signing for fastest SmartScreen trust.
3. Sign every `.msi` and `.exe` release asset.
4. Timestamp signatures so they remain valid after the certificate expires.
5. Keep the same publisher identity across releases so reputation can accumulate.

Tauri's Windows signing guide explains the supported signing paths:
<https://v2.tauri.app/distribute/sign/windows/>

Microsoft's SmartScreen documentation explains that unknown files or publishers
may still show warnings until reputation is established:
<https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation>

### Local Signing

Import a trusted code-signing certificate into `Cert:\CurrentUser\My`, then set
its SHA-1 thumbprint:

```powershell
$env:WINDOWS_CERT_THUMBPRINT = "YOUR_CERTIFICATE_THUMBPRINT"
$env:WINDOWS_TIMESTAMP_URL = "http://timestamp.digicert.com"
.\scripts\sign-windows.ps1
```

The script signs and verifies the generated MSI and setup EXE under the Tauri
bundle output directory.

## Installer Output

After a successful Tauri build, installers are written under:

```text
%LOCALAPPDATA%\prayer-times-windows\cargo-target\release\bundle\
```

Typical outputs:

```text
msi\Prayer Times_0.1.4_x64_en-US.msi
nsis\Prayer Times_0.1.4_x64-setup.exe
```

## Project Structure

```text
src/
  core/       Prayer calculation engine, settings, adapters, tests
  ui/         React application shell and desktop UI

src-tauri/
  src/        Rust Tauri shell, tray integration, native commands
  icons/      App icons
  capabilities/
              Tauri permissions

public/audio/
  Adhan and alert audio assets
```

## Main Features

### Prayer Calculation

The TypeScript core includes built-in calculation adapters, high-latitude handling,
manual offsets, manual jamaat schedules, current waqt logic, Ishraq calculation,
and date/timezone helpers.

### Notifications

The Notifications screen uses these terms:

- `At time`: send an alert at the prayer time.
- `Before`: send an early reminder before the prayer time.
- `Adhan`: play full Adhan audio for eligible prayers.

If the default early reminder is off, enabling `Before` for a specific prayer uses
a 10 minute lead time by default.

### Manual Schedule

Manual fixed schedule mode lets users enter fixed jamaat times for Fajr, Dhuhr,
Asr, Maghrib, and Isha. Editing any manual time automatically switches the app to
manual mode.

### Focus Mode

Focus Mode can show the native app window fullscreen and always-on-top at prayer
time. It can be triggered from calculated times or exact manual jamaat times.

### Tray Behavior

The app is designed to behave like a resident tray utility:

- Clicking the window close button hides it to tray.
- The tray menu can show, hide, or quit the app.
- Quit exits the process fully.

## Verification

The current app has been verified with:

```powershell
npm test
npm run build
npm run tauri:build
```

Current test coverage includes prayer calculation adapters, golden rows, current
waqt behavior, manual offsets, high-latitude behavior, Ishraq, and notification
defaults.

## Attribution

This Windows app was inspired by and initially analyzed against
[`tareq1988/prayer-times-macos`](https://github.com/tareq1988/prayer-times-macos).

Audio assets were copied from the referenced macOS project resources during the
porting work. Verify redistribution rights before publishing a public release.

## Release Notes

### 0.1.8

- Added Hijri date display to both the main app panel and floating widget.
- Added Hijri day adjustment for local moon-sighting differences.
- Fixed the main app countdown so visible countdowns update every second.
- Kept hidden-window alert scheduling optimized for lower battery usage.

### 0.1.6

- Fixed floating widget dragging with Tauri native window drag support.
- Changed widget behavior so it is not always-on-top and can stay as a desktop-level widget.

### 0.1.5

- Added floating Windows prayer widget with next prayer time and live countdown.
- Added General settings toggle and tray menu control for the widget.
- Added a second Tauri `widget` window with always-on-top frameless styling.

### 0.1.4

- Clarified notification labels from `Notify` and `Remind` to `At time` and `Before`.
- Fixed per-prayer before-reminder toggles for Fajr, Sunrise, Asr, and Isha.
- Built Windows MSI and NSIS installers.
- Added Windows signing documentation and a local installer signing script.

### 0.1.3

- Added neon material dark UI redesign.
- Improved settings layout and internal scrolling.

### 0.1.2

- Made Focus Mode open the native window fullscreen and always-on-top.
- Fixed manual schedule Focus Mode timing.

### 0.1.1

- Fixed close-to-tray behavior.
- Improved manual schedule editing.

### 0.1.0

- Initial Windows Tauri app with prayer calculation, settings, tray, notifications,
  audio playback, onboarding, and installer output.
