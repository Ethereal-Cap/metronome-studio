# Apex Metronome Studio ⏱️

**Apex Metronome Studio** is a high-precision, standalone metronome and rhythm training web application built with HTML5, Vanilla CSS, and the Web Audio API. 

It is engineered with sub-millisecond lookahead scheduling, zero backend dependencies, and works 100% offline or hosted online across any device (PC, Mac, iPhone, iPad, Android).

---

## 🌟 Key Features

* **🔊 Sub-Millisecond Precision**: Powered by the Web Audio API lookahead scheduler (20–300 BPM).
* **🎨 Studio Emerald Theme**: Sleek, glassmorphic dark mode design fitted for single-page viewports.
* **🎯 Mute / Gap Trainer**: Set *Bars Played* vs *Bars Muted* (e.g. 1 Played / 3 Muted). Synchronized text and color transitions to **Golden Yellow** on Beat 1 when muted to build your internal clock.
* **📈 Independent Tempo Ramp**:
  * **Time Mode**: Start BPM to End/Max BPM (*e.g. 100 ➔ 135 BPM, +10 BPM every 1 min*).
  * **Bar Mode**: Increment tempo starting on Bar 5 or every N measures.
* **🔄 Routine Presets with Silent Rest Breaks**:
  * **`Full Hand`**: 120 ➔ 160 BPM, 3 Runs, 2-Minute Silent Break Countdowns between sets.
  * **`Full Leg`**: 100 ➔ 135 BPM, 3 Runs, 2-Minute Silent Break Countdowns between sets.
  * **`Hand Single`**: 120 ➔ 160 BPM single 5-minute run.
  * **`Leg Single`**: 100 ➔ 135 BPM single 5-minute run.
* **⏸️ Pause & Resume**: Freeze audio and all timers (*Bar counter, stopwatch, session limit, break timers*) at any instant and resume right where you left off.
* **🎚️ Mouse Scroll-Wheel Controls**: Scroll your mouse wheel directly over the Tempo Slider or Master Volume Bar to adjust values smoothly.
* **⏱️ All-in-One Main Panel Status**: All time readouts (*Bar Number, Elapsed Stopwatch, Session Limits, Break Countdowns*) consolidated under the main BPM display.

---

## 📱 Online Deployment & Mobile Usage

Because Apex Metronome Studio runs entirely client-side, it can be hosted online for **100% free** with unlimited bandwidth.

### Method 1: GitHub Pages (Recommended)

1. Create a repository on [GitHub.com](https://github.com) (*e.g.* `metronome-studio`).
2. Push your project files:
   - `index.html`
   - `metronome.html`
   - `styles.css`
   - `metronome.js`
3. Go to **Settings ➔ Pages** in your GitHub repository.
4. Select `main` branch under **Source** and click **Save**.
5. Your live URL will be:
   ```text
   https://<your-username>.github.io/metronome-studio/
   ```

### Method 2: Netlify Drop (Instant 30-Second Hosting)

1. Go to [Netlify Drop](https://app.netlify.com/drop).
2. Drag and drop the project folder onto the dropzone.
3. Open the generated live HTTPS URL on your phone or tablet immediately!

---

## 📲 Add to Phone Home Screen (Mobile App Mode)

Open your live web link on your mobile browser and add it to your home screen to launch full-screen like a native app:

* **iPhone (Safari)**: Tap the **Share icon** (square with arrow) ➔ Tap **"Add to Home Screen"**.
* **Android (Chrome)**: Tap the **3-dots menu (⋮)** ➔ Tap **"Add to Home Screen"** or **"Install App"**.

---

## 🖥️ Local PC Execution

Run locally on Windows, macOS, or Linux using Python:

```bash
python run_metronome.py
```

This launches a zero-dependency HTTP server on port 8000 and opens `http://localhost:8000/metronome.html` in your web browser.

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| **`Space`** | Start / Stop Metronome |
| **`P`** | Pause / Resume |
| **`T`** | Tap Tempo |
| **`↑ / ↓`** | Adjust BPM (+1 / -1) |
| **`Shift + ↑ / ↓`** | Adjust BPM (+5 / -5) |
| **`Scroll Wheel`** | Smooth BPM / Volume adjustment |
| **`M`** | Mute / Unmute Master Volume |
