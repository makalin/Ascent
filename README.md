# Ascent — Toposonic Corpus Explorer (Web)

**Ascent** is a browser-based granular “corpus explorer”: load any audio file, explore it on a draggable 2D topographic map, and drive a **Web Audio** grain engine with reverb, delay, envelopes, and point vs cloud playback modes.

This repository ships as **vanilla HTML/CSS/JavaScript** — no build step, no framework. Run it locally behind any static file server (browser security requires a server for `AudioContext` + file loading in many setups).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What’s in the box

- **Grain engine**: rate, grain size, sampling radius (time window around the pin), stereo spread, jitter  
- **Playback modes**: **Point** (one grain per tick) and **Cloud** (burst of grains scaled by radius)  
- **FX chain**: dry/wet reverb (convolver impulse), delay with **feedback** and **delay time**  
- **Master output** level  
- **Envelopes**: Gaussian, triangle, exponential  
- **Factory presets** + **export/import** of settings as JSON  
- **Terrain**: regenerate contour noise (visual map)  
- **Recording**: capture the master bus (typically **WebM/Opus** in Chromium; format depends on the browser)  
- **Keyboard workflow**: Space, R, L, `?`  
- **`window.AscentAPI`**: scriptable hooks for automation or embedding  

> **Note:** An older README described a SwiftUI + AudioKit macOS app. The **current source in this repo is the web prototype** (`index.html`, `index.js`, `index.css`). A future native port could share the same interaction model.

## Quick start

**Requirements:** a modern desktop browser with Web Audio (Chrome, Edge, Firefox, Safari 14.2+).

1. Clone and enter the project:

   ```bash
   git clone https://github.com/frangedev/Ascent.git
   cd Ascent
   ```

2. Serve the folder (pick one):

   ```bash
   python3 -m http.server 8080
   ```

   Or, if you use Node:

   ```bash
   npx --yes serve . -p 8080
   ```

3. Open `http://localhost:8080` and click **LOAD AUDIO**.

4. Move the pointer over the map to move the pin; press **Space** to start/stop the engine.

## UI map

| Area | Purpose |
|------|---------|
| **ENGINE** | Grain rate/size, radius, spread, jitter |
| **FX / PRO** | Output level, reverb, delay feedback & time, envelope shape |
| **TOOLS** | Presets, JSON export/import, regenerate terrain, reduced motion, shortcuts |

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / stop grain engine |
| `R` | Toggle recording |
| `L` | Load audio file |
| `?` | Toggle shortcut list in **TOOLS** |

## `AscentAPI` (pro scripting)

After load, the app exposes:

```js
window.AscentAPI.engine      // AudioEngine instance (settings, buffer, etc.)
window.AscentAPI.visualizer  // canvas visualizer
window.AscentAPI.applyPreset('airy')
window.AscentAPI.exportPreset()
window.AscentAPI.getPresets() // factory preset objects
window.AscentAPI.play()
window.AscentAPI.stop()
```

Use this from the devtools console or from a bookmarklet to automate sessions.

## Preset JSON format

Export produces JSON compatible with import. Fields include:

`rate`, `sizeMs`, `radius`, `spread`, `jitter`, `reverbMix`, `delayFeedback`, `delayTime`, `masterGain`, `envelope` (`gaussian` | `triangle` | `exp`), `mode` (`point` | `cloud`).

## Roadmap ideas

- Real corpus features: onset detection, 2D embedding (t‑SNE/UMAP), segment metadata  
- WAV encoding for recordings where the browser only exposes WebM  
- MIDI/OSC control, saveable sessions  
- Optional packaged desktop wrapper (e.g. Tauri) while keeping the same web core  

## License

[MIT License](LICENSE) © 2026 FRANGE

## Acknowledgments

- Inspired by *Incline: Toposonic Corpus Explorer* and the work of Cristián Vogel / [NeverEngineLabs](https://neverenginelabs.com/)  
- Built with the **Web Audio API** and Canvas  

Istanbul · 2026
