# Decibel Meter (Mascot Edition)

A professional-grade, sound-reactive Progressive Web App (PWA) that measures sound pressure levels (dB SPL) and features an interactive mascot that responds to your volume.

## 🌟 Key Features

- **Real-Time SPL Monitoring:** Measures sound pressure levels from **0 to 120 dB SPL**.
- **Interactive Mascot:** A high-quality SVG mascot (The Bride) that reacts to audio peaks with different poses (Calm, Happy, Excited).
- **Dynamic Encouragement:** Visual text feedback that updates as you get louder, culminating in a "WELCOME!" state.
- **Smart Calibration:**
  - Internal +90 dB baseline.
  - Relative UI display (starts at +0 dB).
  - Press-and-hold adjustment for fine-tuning.
  - Settings persist across sessions via LocalStorage.
- **State Persistence:** Reaching the highest volume level locks the "WELCOME!" state until the session is stopped.
- **Mobile Optimized (PWA):**
  - Full-screen experience using `100dvh`.
  - Offline support via Service Workers.
  - Installable on iOS and Android.
  - Responsive layout that fits all screen sizes.

## 🚀 Getting Started

### Prerequisites
- A modern web browser (Chrome, Safari, Firefox).
- A microphone (permission will be requested).

### Running Locally
You can serve the application using any static file server. For example, using Python:
```bash
python3 -m http.server 8000
```
Then visit `http://localhost:8000`.

## 🛠 Tech Stack
- **Frontend:** Vanilla HTML5, CSS3 (Flexbox, Grid, Clamp), and JavaScript.
- **Audio:** Web Audio API (AnalyserNode) with exponential smoothing and peak-hold logic.
- **PWA:** Web App Manifest and Service Workers.
- **Mascot:** Optimized SVG assets with `mix-blend-mode` for seamless background integration.

## 🧪 Testing
The project includes a comprehensive test suite covering audio logic, calibration, and UI state transitions.
```bash
npm install
npm test
```

## 📝 Usage Notes
- **Accuracy:** While calibrated to approximate SPL, results vary based on hardware microphone sensitivity. Use an external reference for professional calibration.
- **Browser Compatibility:** Requires a "Secure Context" (HTTPS or localhost) for microphone access.
