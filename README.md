# 🎵 Psychiatric Sonification — 3D Facial Dynamics Visualization

Interactive 3D visualization and sonification of psychiatric conditions based on facial landmark movement analysis.

![Dashboard Preview](docs/preview.png)

## 🧠 About

This project transforms facial movement data (extracted via MediaPipe Face Mesh from psychiatric patient videos) into both **musical compositions** and **3D mathematical visualizations**. Each psychiatric condition produces a unique audiovisual signature.

### Conditions Analyzed
| Condition | Tempo | Character | Color |
|-----------|-------|-----------|-------|
| **Catatonia** | 40 BPM | Minimal, rigid | 🟢 Cyan |
| **Depression** | 55 BPM | Slow, dampened | 🔵 Steel Blue |
| **Paranoid** | 140 BPM | Rapid, erratic | 🔴 Red |
| **Mania** | 170 BPM | Hyperkinetic | 🟡 Gold |
| **Healthy** | 90 BPM | Balanced, regular | 🟢 Green |

### Landmark → Instrument Mapping
| Facial Region | Instrument | Synthesis |
|--------------|------------|-----------|
| Left Eye | Violin | FM Synth |
| Right Eye | Cello | AM Synth |
| Mouth | Trumpet | Sawtooth |
| Left Eyebrow | Flute | Sine |
| Right Eyebrow | Oboe | FM Synth |

## ✨ Features

- **3D Mathematical Visualizations**: Lissajous orbits, Lorenz strange attractors, torus knots — all parameterized by real movement data
- **Real-time Audio Synthesis**: 5 simultaneous instruments via Tone.js, each driven by a different facial landmark
- **3 View Modes**: Grid (5-case overview), Focus (single case detail), Compare (side-by-side with metrics)
- **Interactive**: Mouse drag to rotate 3D, click conditions to switch, audio syncs with visualization
- **Responsive**: Works on desktop and mobile browsers

## 🚀 Live Demo

**[→ View Live Demo](https://YOUR_GITHUB_USERNAME.github.io/psychiatric-sonification-viz/)**

## 🛠️ Tech Stack

- **React 18** + Vite
- **Tone.js** — Web Audio synthesis
- **Canvas API** — 3D rendering (no WebGL dependency)
- **GitHub Pages** — Static hosting

## 📦 Local Development

```bash
git clone https://github.com/YOUR_USERNAME/psychiatric-sonification-viz.git
cd psychiatric-sonification-viz
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## 🚢 Deploy to GitHub Pages

```bash
npm run deploy
```

## 📚 Research Context

This visualization is part of a computational psychiatry research project investigating AI-generated psychiatric content detection through biophysical analysis. The sonification system maps facial movement patterns to musical parameters, enabling auditory discrimination between psychiatric conditions.

### Related Publications
- Facial Dynamics Sonification for Psychiatric Assessment (IEEE FG 2026, submitted)
- Deepfake Detection via Oculomotor Biophysics Violations

## 📄 License

MIT License — See [LICENSE](LICENSE) for details.

## 🏢 Affiliation

**TenkaiAI** — Deep Tech Research  
Trakya University Medical Faculty

---

*Built with ❤️ for computational psychiatry research*
