# Prayer Times for Windows

A free Windows tray app for Islamic prayer times, Adhan notifications, manual jamaat schedules, a live next-prayer countdown, and a draggable desktop widget.

![Latest release](https://img.shields.io/github/v/release/wdmahbubur/prayer-time-windows?label=latest)
![Downloads](https://img.shields.io/github/downloads/wdmahbubur/prayer-time-windows/total)
![Windows](https://img.shields.io/badge/Windows-10%20%2F%2011-0078D4)
![Tauri](https://img.shields.io/badge/Tauri-v2-24C8DB)

---

**Prayer Times for Windows** is a lightweight desktop app that keeps the next **Islamic prayer time** (Salah / Namaz) visible from the Windows tray, shows a live countdown in the app and floating widget, plays **Adhan (Azan)** audio, and sends per-prayer reminders.

It works offline from your coordinates and supports manual fixed jamaat schedules, multiple calculation methods, Standard / Hanafi Asr, high-latitude handling, Hijri date display, and a fullscreen Focus Mode that can block the screen at prayer time.

This project is inspired by [`tareq1988/prayer-times-macos`](https://github.com/tareq1988/prayer-times-macos), rebuilt for Windows with **Tauri, React, TypeScript, and Rust**.

## Install

Download the latest Windows installer from [Releases](https://github.com/wdmahbubur/prayer-time-windows/releases/latest).

Recommended:

- `Prayer.Times_0.1.10_x64_en-US.msi` for standard Windows installation.
- `Prayer.Times_0.1.10_x64-setup.exe` as an alternative setup installer.

> **First launch / SmartScreen:** the installers are currently unsigned. Windows SmartScreen may show a warning until the app is signed with a trusted code-signing certificate and builds reputation.

Requirements: **Windows 10 or Windows 11** with Microsoft Edge WebView2 Runtime. WebView2 is normally already installed on modern Windows.

## Features

- **Tray-first Windows app** - show, hide, quit, and close-to-tray behavior.
- **Live countdown** - next prayer countdown in the main app, tray label, and floating widget.
- **Desktop widget** - draggable, frameless widget with next prayer, countdown, and Hijri date.
- **Glanceable prayer panel** - today's prayer list, next prayer highlight, current method, timezone, location, and Hijri date.
- **Calculation methods** - Muslim World League, ISNA, Umm al-Qura, Egyptian, Karachi, Moonsighting Committee, Diyanet, JAKIM, Kemenag, and Manual.
- **Madhab and latitude controls** - Standard / Hanafi Asr plus configurable high-latitude rules.
- **Manual jamaat schedule** - fixed local jamaat times for Fajr, Dhuhr, Asr, Maghrib, and Isha.
- **Adhan and notifications** - per-prayer at-time alerts, before-prayer reminders, iqamah reminders, and full Adhan playback.
- **Focus Mode** - fullscreen prayer-time screen blocker with configurable duration and emergency exit.
- **Location aware** - manual coordinates or one-shot browser location detection.
- **Hijri date** - app and widget display with day adjustment for local moon sighting.
- **Launch at login** - optional Windows startup behavior.
- **Private by design** - no account, no ads, no analytics, and no external prayer-time API.

## Why Prayer Times?

- **Made for Windows** - a resident tray utility with MSI and setup EXE installers.
- **Lightweight** - Tauri desktop shell instead of a heavy Electron runtime.
- **Offline calculation** - prayer times are computed locally from coordinates and settings.
- **User controlled** - manual schedule, per-prayer notifications, and local Hijri adjustment.
- **Tested core** - calculation adapters, high-latitude behavior, manual offsets, Ishraq, current waqt, and notification defaults are covered by automated tests.

## FAQ

**Is it free?**  
Yes. The app is free to download and use.

**Does it work offline?**  
Yes. Prayer times are calculated locally after your location or coordinates are configured.

**Does it track me?**  
No. There is no account, telemetry, analytics, or ads. Location is used locally to compute prayer times.

**Which calculation methods are supported?**  
Diyanet, Muslim World League, ISNA, Umm al-Qura, Egyptian General Authority, University of Islamic Sciences Karachi, Moonsighting Committee, JAKIM, Kemenag, and Manual.

**Does it play the full Adhan?**  
Yes. The app can play Makkah or Madinah Adhan audio and includes a Stop control.

**What is the difference between At time and Before?**  
`At time` sends an alert at the prayer time. `Before` sends an early reminder before the prayer. `Adhan` controls full Adhan playback for eligible prayers.

**Can I use my mosque's fixed jamaat times?**  
Yes. Switch to Manual fixed schedule and enter local jamaat times. Editing a jamaat time automatically activates manual mode.

**Why does Windows show a SmartScreen warning?**  
The current installers are unsigned. To remove most warnings, release builds need to be Authenticode-signed with a trusted code-signing certificate and build Microsoft Defender SmartScreen reputation over time.

## Architecture

```text
src/
  core/       Pure TypeScript prayer calculation engine, adapters, settings, tests
  ui/         React app shell, settings UI, panel, widget, notifications, focus mode

src-tauri/
  src/        Rust Tauri shell, tray integration, native commands
  icons/      Windows app icons
  capabilities/
              Tauri permissions

public/audio/
  Adhan and alert audio assets

scripts/
  sign-windows.ps1
              Local Windows installer signing helper
```

The calculation core is UI-free and tested separately from the desktop shell. The Tauri layer owns Windows tray behavior, native window commands, installer output, and app packaging.

## Build & Run

Install dependencies:

```powershell
npm install
```

Run the web preview:

```powershell
npm run dev
```

Run the native Tauri app:

```powershell
npm run tauri:dev
```

Run tests:

```powershell
npm test
```

Build the web bundle:

```powershell
npm run build
```

Build Windows installers:

```powershell
$env:CARGO_TARGET_DIR = "$env:LOCALAPPDATA\prayer-times-windows\cargo-target"
npm run tauri:build
```

If Cargo cannot find the MSVC linker, install **Visual Studio 2022 Build Tools** with **Desktop development with C++**, then run from a Visual Studio developer shell or initialize the environment first:

```powershell
cmd /c "call ""C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvars64.bat"" && npm run tauri:build"
```

## Installer Output

After a successful Tauri build, installers are written under:

```text
%LOCALAPPDATA%\prayer-times-windows\cargo-target\release\bundle\
```

Typical outputs:

```text
msi\Prayer Times_0.1.10_x64_en-US.msi
nsis\Prayer Times_0.1.10_x64-setup.exe
```

## Code Signing

Windows SmartScreen warnings are controlled by Microsoft Defender reputation and Authenticode signing. Installer design cannot remove the warning by itself.

Recommended production path:

1. Use a trusted Windows code-signing certificate.
2. Prefer EV code signing or Azure Trusted Signing for fastest reputation.
3. Sign every `.msi` and `.exe` release asset.
4. Timestamp signatures so they remain valid after certificate expiry.
5. Keep the same publisher identity across releases.

Local signing helper:

```powershell
$env:WINDOWS_CERT_THUMBPRINT = "YOUR_CERTIFICATE_THUMBPRINT"
$env:WINDOWS_TIMESTAMP_URL = "http://timestamp.digicert.com"
.\scripts\sign-windows.ps1
```

See Tauri's Windows signing guide: <https://v2.tauri.app/distribute/sign/windows/>

## Releasing

GitHub Actions builds and publishes Windows releases automatically from version tags.

1. Bump the version in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.
2. Add release notes in this README.
3. Run local verification:

```powershell
npm test
npm run build
```

4. Commit the version bump.
5. Tag the release and push the tag:

```powershell
git tag v0.1.10
git push origin main
git push origin v0.1.10
```

6. The `Release` workflow builds on `windows-latest`, runs tests, creates the MSI and setup EXE, uploads workflow artifacts, and attaches both installers to the GitHub Release.

To re-run a release for an existing tag, open **Actions -> Release -> Run workflow** and enter the tag, for example `v0.1.10`.

## Release Notes

### 0.1.10

- Changed Focus Mode exit behavior so dismissing the screen blocker hides the blocker without opening the main app window.

### 0.1.9

- Added real updater signing and release plumbing.
- Added a native runtime scheduler for notifications and focus events.
- Fixed GitHub Actions lockfile compatibility and release source selection.

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

- Initial Windows Tauri app with prayer calculation, settings, tray, notifications, audio playback, onboarding, and installer output.

## Attribution

Inspired by [`tareq1988/prayer-times-macos`](https://github.com/tareq1988/prayer-times-macos).

Audio assets were copied from the referenced macOS project resources during the porting work. Verify redistribution rights before publishing a public release.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

---

Keywords: Windows prayer times app · tray Adhan / Azan app for Windows · Islamic Salah / Namaz times · Muslim prayer reminder · Diyanet namaz vakti · waktu solat Malaysia JAKIM · jadwal sholat Indonesia Kemenag · free prayer time app for Windows · ISNA · Umm al-Qura · Muslim World League · Karachi · Egyptian calculation methods.
