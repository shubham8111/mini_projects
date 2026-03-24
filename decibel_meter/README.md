# Decibel Meter

A simple web-based decibel meter that uses your device's microphone to display audio levels in real time.

## Features

- Real-time audio level monitoring via device microphone
- Visual bar meter with color-coded levels (green/yellow/red)
- Numeric dB readout
- Calibration offset to adjust readings (persisted across sessions)
- Works on desktop and mobile browsers

## How to Run

The app requires a secure context (HTTPS or localhost) for microphone access.

**Local development:**

```bash
cd mini_projects
python3 -m http.server 8000
```

Then open `http://localhost:8000/decibel_meter/` in your browser.

## Limitations

- Measures **dBFS** (decibels relative to full scale), not dB SPL (sound pressure level). Use the calibration feature to approximate real-world readings.
- Browser automatic gain control (AGC) may compress dynamic range. The app requests AGC/noise suppression to be disabled, but not all browsers honor this.
- Microphone sensitivity varies between devices — calibration helps normalize readings.
- Requires HTTPS or localhost for microphone access.
