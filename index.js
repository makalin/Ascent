/**
 * ASCENT | Toposonic Corpus Explorer
 * Web Audio grain engine, spatial map UI, presets & keyboard workflow
 */

const ASCENT_PRESETS = {
    default: {
        rate: 20,
        sizeMs: 100,
        radius: 0.2,
        spread: 0.5,
        jitter: 0.1,
        reverbMix: 0.3,
        delayFeedback: 0.4,
        delayTime: 0.25,
        masterGain: 0.8,
        envelope: 'gaussian',
        mode: 'point'
    },
    airy: {
        rate: 35,
        sizeMs: 180,
        radius: 0.45,
        spread: 0.85,
        jitter: 0.35,
        reverbMix: 0.65,
        delayFeedback: 0.55,
        delayTime: 0.42,
        masterGain: 0.75,
        envelope: 'gaussian',
        mode: 'cloud'
    },
    tight: {
        rate: 45,
        sizeMs: 40,
        radius: 0.08,
        spread: 0.15,
        jitter: 0.05,
        reverbMix: 0.12,
        delayFeedback: 0.2,
        delayTime: 0.12,
        masterGain: 0.85,
        envelope: 'triangle',
        mode: 'point'
    },
    dub: {
        rate: 12,
        sizeMs: 220,
        radius: 0.55,
        spread: 0.6,
        jitter: 0.2,
        reverbMix: 0.4,
        delayFeedback: 0.75,
        delayTime: 0.55,
        masterGain: 0.7,
        envelope: 'exp',
        mode: 'cloud'
    }
};

class AudioEngine {
    constructor() {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.buffer = null;
        this.isPlaying = false;
        this.isRecording = false;
        this.grainCount = 0;

        this.settings = {
            rate: 20,
            size: 0.1,
            radius: 0.2,
            spread: 0.5,
            jitter: 0.1,
            mode: 'point',
            reverbMix: 0.3,
            delayFeedback: 0.4,
            delayTime: 0.25,
            masterGain: 0.8,
            envelope: 'gaussian'
        };

        this.setupNodes();
    }

    setupNodes() {
        this.masterBus = this.ctx.createGain();
        this.masterBus.gain.value = this.settings.masterGain;

        this.recDest = this.ctx.createMediaStreamDestination();
        this.masterBus.connect(this.recDest);
        this.masterBus.connect(this.ctx.destination);

        this.reverbNode = this.ctx.createConvolver();
        this.reverbDry = this.ctx.createGain();
        this.reverbWet = this.ctx.createGain();

        this.delayNode = this.ctx.createDelay(2.0);
        this.delayNode.delayTime.value = this.settings.delayTime;
        this.delayFeedbackGain = this.ctx.createGain();
        this.delayWet = this.ctx.createGain();

        this.delayNode.connect(this.delayFeedbackGain);
        this.delayFeedbackGain.connect(this.delayNode);
        this.delayNode.connect(this.delayWet);

        this.reverbDry.connect(this.masterBus);
        this.reverbNode.connect(this.reverbWet);
        this.reverbWet.connect(this.masterBus);
        this.delayWet.connect(this.masterBus);

        this.updateFX();
        this.createSimpleReverb();
    }

    createSimpleReverb() {
        const length = this.ctx.sampleRate * 2;
        const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
        for (let i = 0; i < length; i++) {
            const decay = Math.pow(1 - i / length, 2);
            impulse.getChannelData(0)[i] = (Math.random() * 2 - 1) * decay;
            impulse.getChannelData(1)[i] = (Math.random() * 2 - 1) * decay;
        }
        this.reverbNode.buffer = impulse;
    }

    updateFX() {
        const t = this.ctx.currentTime;
        this.reverbWet.gain.setTargetAtTime(this.settings.reverbMix, t, 0.05);
        this.reverbDry.gain.setTargetAtTime(1 - this.settings.reverbMix, t, 0.05);
        this.delayFeedbackGain.gain.setTargetAtTime(this.settings.delayFeedback, t, 0.05);
        this.delayWet.gain.setTargetAtTime(0.35, t, 0.05);
        this.delayNode.delayTime.setTargetAtTime(
            Math.min(1.99, Math.max(0.01, this.settings.delayTime)),
            t,
            0.05
        );
        this.masterBus.gain.setTargetAtTime(
            Math.min(1, Math.max(0, this.settings.masterGain)),
            t,
            0.05
        );
    }

    async loadBuffer(file) {
        const arrayBuffer = await file.arrayBuffer();
        this.buffer = await this.ctx.decodeAudioData(arrayBuffer);
        return this.buffer;
    }

    start() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.isPlaying = true;
        this.scheduleGrains();
    }

    stop() {
        this.isPlaying = false;
        if (this.grainTimer) {
            clearTimeout(this.grainTimer);
            this.grainTimer = null;
        }
    }

    scheduleGrains() {
        if (!this.isPlaying) return;
        const interval = 1000 / this.settings.rate;
        const now = this.ctx.currentTime;
        if (this.settings.mode === 'cloud') {
            const n = Math.min(14, 3 + Math.floor(this.settings.radius * 10));
            for (let i = 0; i < n; i++) this.triggerGrain(now);
        } else {
            this.triggerGrain(now);
        }
        this.grainTimer = setTimeout(() => this.scheduleGrains(), interval);
    }

    sampleTimeOffset() {
        if (!this.buffer) return 0;
        const dur = this.buffer.duration;
        const px = this.currentX ?? 0.5;
        const py = this.currentY ?? 0.5;
        const windowSec = dur * this.settings.radius * 0.12;
        const jitter = (Math.random() - 0.5) * this.settings.jitter * dur * 0.02;
        const yBias = (py - 0.5) * this.settings.radius * dur * 0.08;
        let t = px * dur + yBias + jitter;
        if (this.settings.mode === 'cloud') {
            t += (Math.random() - 0.5) * 2 * windowSec;
        } else {
            t += (Math.random() - 0.5) * windowSec * 0.5;
        }
        return Math.min(Math.max(t, 0), Math.max(0, dur - 0.001));
    }

    triggerGrain(time) {
        if (!this.buffer) return;

        const duration = Math.min(
            this.settings.size * (1 + (Math.random() - 0.5) * this.settings.jitter),
            this.buffer.duration
        );
        const offset = this.sampleTimeOffset();

        const source = this.ctx.createBufferSource();
        source.buffer = this.buffer;

        const env = this.ctx.createGain();
        const panner = this.ctx.createStereoPanner();
        panner.pan.value = (Math.random() - 0.5) * this.settings.spread * 2;

        source.connect(env);
        env.connect(panner);
        panner.connect(this.reverbDry);
        panner.connect(this.reverbNode);
        panner.connect(this.delayNode);

        this.applyEnvelope(env, time, duration);

        source.start(time, offset, duration);
        source.stop(time + duration);
        this.grainCount++;

        source.onended = () => {
            source.disconnect();
            env.disconnect();
            panner.disconnect();
        };
    }

    applyEnvelope(node, time, duration) {
        const attack = duration * 0.1;
        const release = duration * 0.9;

        node.gain.setValueAtTime(0, time);

        if (this.settings.envelope === 'gaussian') {
            node.gain.setTargetAtTime(1, time, attack * 0.5);
            node.gain.setTargetAtTime(0, time + attack, release * 0.5);
        } else if (this.settings.envelope === 'triangle') {
            node.gain.linearRampToValueAtTime(1, time + duration / 2);
            node.gain.linearRampToValueAtTime(0, time + duration);
        } else {
            node.gain.exponentialRampToValueAtTime(1, time + attack);
            node.gain.exponentialRampToValueAtTime(0.001, time + duration);
        }
    }

    updatePosition(x, y) {
        this.currentX = x;
        this.currentY = y;
    }

    applyPreset(p) {
        if (!p) return;
        Object.assign(this.settings, {
            rate: p.rate,
            size: p.sizeMs / 1000,
            radius: p.radius,
            spread: p.spread,
            jitter: p.jitter,
            reverbMix: p.reverbMix,
            delayFeedback: p.delayFeedback,
            delayTime: p.delayTime,
            masterGain: p.masterGain,
            envelope: p.envelope,
            mode: p.mode
        });
        this.updateFX();
    }

    toPresetPayload() {
        return {
            rate: this.settings.rate,
            sizeMs: Math.round(this.settings.size * 1000),
            radius: this.settings.radius,
            spread: this.settings.spread,
            jitter: this.settings.jitter,
            reverbMix: this.settings.reverbMix,
            delayFeedback: this.settings.delayFeedback,
            delayTime: this.settings.delayTime,
            masterGain: this.settings.masterGain,
            envelope: this.settings.envelope,
            mode: this.settings.mode
        };
    }

    toggleRecording() {
        if (this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
        } else {
            this.chunks = [];
            const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/webm')
                  ? 'audio/webm'
                  : '';
            this.mediaRecorder = mime
                ? new MediaRecorder(this.recDest.stream, { mimeType: mime })
                : new MediaRecorder(this.recDest.stream);
            this.mediaRecorder.ondataavailable = (e) => this.chunks.push(e.data);
            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType });
                const ext = blob.type.includes('webm') ? 'webm' : 'wav';
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `ascent-session-${Date.now()}.${ext}`;
                a.click();
                URL.revokeObjectURL(url);
            };
            this.mediaRecorder.start();
            this.isRecording = true;
            this.recStartTime = Date.now();
        }
        return this.isRecording;
    }
}

class Visualizer {
    constructor(topoId, waveId) {
        this.topoCanvas = document.getElementById(topoId);
        this.waveCanvas = document.getElementById(waveId);
        this.topoCtx = this.topoCanvas.getContext('2d');
        this.waveCtx = this.waveCanvas.getContext('2d');

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.noiseData = [];
        this.generateNoise();
    }

    resize() {
        this.width = this.topoCanvas.parentElement.clientWidth;
        this.height = this.topoCanvas.parentElement.clientHeight;
        this.topoCanvas.width = this.width;
        this.topoCanvas.height = this.height;

        this.waveWidth = this.waveCanvas.parentElement.clientWidth;
        this.waveHeight = this.waveCanvas.parentElement.clientHeight;
        this.waveCanvas.width = this.waveWidth;
        this.waveCanvas.height = this.waveHeight;
    }

    generateNoise() {
        const res = 20;
        this.noiseData = [];
        for (let y = 0; y <= res; y++) {
            this.noiseData[y] = [];
            for (let x = 0; x <= res; x++) {
                this.noiseData[y][x] = Math.random();
            }
        }
    }

    getNoise(x, y) {
        const res = 20;
        const gx = x * res;
        const gy = y * res;
        const x0 = Math.floor(gx);
        const y0 = Math.floor(gy);
        const x1 = Math.min(x0 + 1, res);
        const y1 = Math.min(y0 + 1, res);
        const sx = gx - x0;
        const sy = gy - y0;
        const n0 = this.noiseData[y0][x0];
        const n1 = this.noiseData[y0][x1];
        const n2 = this.noiseData[y1][x0];
        const n3 = this.noiseData[y1][x1];
        const ix0 = n0 + sx * (n1 - n0);
        const ix1 = n2 + sx * (n3 - n2);
        return ix0 + sy * (ix1 - ix0);
    }

    drawWaveform(buffer) {
        if (!buffer) return;
        const data = buffer.getChannelData(0);
        const step = Math.ceil(data.length / this.waveWidth);
        const amp = this.waveHeight / 2;

        this.waveCtx.clearRect(0, 0, this.waveWidth, this.waveHeight);
        this.waveCtx.beginPath();
        this.waveCtx.strokeStyle = 'rgba(0, 242, 255, 0.5)';
        this.waveCtx.moveTo(0, amp);

        for (let i = 0; i < this.waveWidth; i++) {
            let min = 1.0;
            let max = -1.0;
            for (let j = 0; j < step; j++) {
                const datum = data[i * step + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            this.waveCtx.lineTo(i, (1 + min) * amp);
            this.waveCtx.lineTo(i, (1 + max) * amp);
        }
        this.waveCtx.stroke();
    }

    drawTopo() {
        this.topoCtx.clearRect(0, 0, this.width, this.height);
        const levels = 15;
        const res = 80;

        for (let l = 1; l <= levels; l++) {
            const threshold = l / levels;
            this.topoCtx.beginPath();
            this.topoCtx.strokeStyle = `hsla(${200 + l * 8}, 100%, 50%, ${0.1 + threshold * 0.4})`;

            for (let y = 0; y < res; y++) {
                for (let x = 0; x < res; x++) {
                    const nx = x / res;
                    const ny = y / res;
                    const val = this.getNoise(nx, ny);
                    if (Math.abs(val - threshold) < 0.015) {
                        const px = nx * this.width;
                        const py = ny * this.height;
                        if (x === 0) this.topoCtx.moveTo(px, py);
                        else this.topoCtx.lineTo(px, py);
                    }
                }
            }
            this.topoCtx.stroke();
        }
        requestAnimationFrame(() => this.drawTopo());
    }
}

function formatSliderLabel(id, raw) {
    const n = parseFloat(raw);
    if (id === 'grain-rate') return `${raw} Hz`;
    if (id === 'grain-size') return `${raw} ms`;
    if (id === 'fx-delay-time') return `${raw} s`;
    if (id === 'master-gain') return Number.isFinite(n) ? n.toFixed(2) : String(raw);
    return String(raw);
}

class App {
    constructor() {
        this.engine = new AudioEngine();
        this.visualizer = new Visualizer('topo-canvas', 'waveform-canvas');
        this.visualizer.drawTopo();
        this.initUI();
        this.startGrainMeter();
    }

    startGrainMeter() {
        setInterval(() => {
            const el = document.getElementById('grain-count');
            if (el) el.textContent = String(this.engine.grainCount);
        }, 200);
    }

    getSliderElements() {
        return {
            'grain-rate': { key: 'rate', map: (v) => v },
            'grain-size': { key: 'size', map: (v) => v / 1000 },
            'grain-radius': { key: 'radius', map: (v) => v },
            'grain-spread': { key: 'spread', map: (v) => v },
            'grain-jitter': { key: 'jitter', map: (v) => v },
            'fx-reverb': { key: 'reverbMix', map: (v) => v },
            'fx-delay': { key: 'delayFeedback', map: (v) => v },
            'fx-delay-time': { key: 'delayTime', map: (v) => v },
            'master-gain': { key: 'masterGain', map: (v) => v }
        };
    }

    syncSlidersFromEngine() {
        const map = this.getSliderElements();
        const p = this.engine.toPresetPayload();
        Object.entries(map).forEach(([id, spec]) => {
            const el = document.getElementById(id);
            if (!el) return;
            const v = spec.key === 'size' ? p.sizeMs : p[spec.key];
            el.value = v;
            const label = el.nextElementSibling;
            if (label && label.classList.contains('value')) {
                label.textContent = formatSliderLabel(id, String(el.value));
            }
        });
    }

    applyNamedPreset(name) {
        const preset = ASCENT_PRESETS[name];
        if (!preset) return;
        this.engine.applyPreset(preset);
        this.syncSlidersFromEngine();
        this.updateModeButtons();
        this.updateEnvButtons();
    }

    updateModeButtons() {
        const m = this.engine.settings.mode;
        document.getElementById('mode-point').classList.toggle('active', m === 'point');
        document.getElementById('mode-cloud').classList.toggle('active', m === 'cloud');
    }

    updateEnvButtons() {
        const env = this.engine.settings.envelope;
        document.querySelectorAll('.env-btn').forEach((b) => {
            b.classList.toggle('active', b.dataset.env === env);
        });
    }

    exportPresetJson() {
        const data = JSON.stringify(this.engine.toPresetPayload(), null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ascent-preset-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    importPresetFromFile(file) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const o = JSON.parse(reader.result);
                const merged = { ...ASCENT_PRESETS.default, ...o };
                this.engine.applyPreset(merged);
                this.syncSlidersFromEngine();
                this.updateModeButtons();
                this.updateEnvButtons();
            } catch (e) {
                console.error('Invalid preset JSON', e);
            }
        };
        reader.readAsText(file);
    }

    initUI() {
        const loadBtn = document.getElementById('load-btn');
        const audioInput = document.getElementById('audio-input');
        const playBtn = document.getElementById('play-btn');
        const recBtn = document.getElementById('rec-btn');
        const explorer = document.getElementById('explorer-container');
        const pin = document.getElementById('explorer-pin');
        const marker = document.getElementById('grain-marker');
        const status = document.getElementById('status-indicator');
        const presetSelect = document.getElementById('preset-select');
        const exportPresetBtn = document.getElementById('export-preset-btn');
        const importPresetInput = document.getElementById('import-preset-input');
        const importPresetBtn = document.getElementById('import-preset-btn');
        const regenTerrainBtn = document.getElementById('regen-terrain-btn');
        const reducedMotion = document.getElementById('opt-reduced-motion');
        const shortcutsPanel = document.getElementById('shortcuts-panel');

        document.querySelectorAll('.tab-link').forEach((link) => {
            link.addEventListener('click', () => {
                document.querySelectorAll('.tab-link').forEach((t) => {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
                link.classList.add('active');
                link.setAttribute('aria-selected', 'true');
                document.getElementById(link.dataset.tab).classList.add('active');
            });
        });

        document.querySelectorAll('.env-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.env-btn').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                this.engine.settings.envelope = btn.dataset.env;
            });
        });

        presetSelect.addEventListener('change', () => {
            if (presetSelect.value) this.applyNamedPreset(presetSelect.value);
        });

        exportPresetBtn.addEventListener('click', () => this.exportPresetJson());
        importPresetBtn.addEventListener('click', () => importPresetInput.click());
        importPresetInput.addEventListener('change', (e) => {
            const f = e.target.files[0];
            if (f) this.importPresetFromFile(f);
            importPresetInput.value = '';
        });

        regenTerrainBtn.addEventListener('click', () => {
            this.visualizer.generateNoise();
        });

        const savedMotion = localStorage.getItem('ascent_reduced_motion') === '1';
        if (reducedMotion) {
            reducedMotion.checked = savedMotion;
            if (savedMotion) document.body.classList.add('reduced-motion');
            reducedMotion.addEventListener('change', () => {
                document.body.classList.toggle('reduced-motion', reducedMotion.checked);
                localStorage.setItem('ascent_reduced_motion', reducedMotion.checked ? '1' : '0');
            });
        }

        document.getElementById('toggle-shortcuts')?.addEventListener('click', () => {
            shortcutsPanel.classList.toggle('hidden');
        });

        audioInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('loading-overlay').classList.remove('hidden');
                const buffer = await this.engine.loadBuffer(file);
                this.visualizer.drawWaveform(buffer);
                document.getElementById('loading-overlay').classList.add('hidden');
                loadBtn.textContent = file.name.length > 18 ? `${file.name.slice(0, 15)}…` : file.name;
            }
        });
        loadBtn.addEventListener('click', () => audioInput.click());

        playBtn.addEventListener('click', () => this.togglePlay(playBtn, status));

        recBtn.addEventListener('click', () => {
            const isRec = this.engine.toggleRecording();
            recBtn.classList.toggle('active', isRec);
            document.getElementById('rec-status').classList.toggle('hidden', !isRec);
            if (isRec) this.updateRecTimer();
        });

        document.getElementById('mode-point').addEventListener('click', () => {
            this.engine.settings.mode = 'point';
            this.updateModeButtons();
        });
        document.getElementById('mode-cloud').addEventListener('click', () => {
            this.engine.settings.mode = 'cloud';
            this.updateModeButtons();
        });

        const sliderMap = this.getSliderElements();
        Object.entries(sliderMap).forEach(([id, spec]) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                this.engine.settings[spec.key] = spec.map(val);
                if (id.startsWith('fx-') || id === 'master-gain') this.engine.updateFX();
                const label = el.nextElementSibling;
                if (label && label.classList.contains('value')) {
                    label.textContent = formatSliderLabel(id, e.target.value);
                }
            });
        });

        explorer.addEventListener('mousemove', (e) => {
            const rect = explorer.getBoundingClientRect();
            const x = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
            const y = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1);

            pin.style.left = `${x * 100}%`;
            pin.style.top = `${y * 100}%`;
            marker.style.left = `${x * 100}%`;

            this.engine.updatePosition(x, y);
        });

        document.addEventListener('keydown', (e) => {
            if (e.target.matches('input, textarea, select')) return;
            if (e.code === 'Space') {
                e.preventDefault();
                this.togglePlay(playBtn, status);
            } else if (e.key === 'r' || e.key === 'R') {
                recBtn.click();
            } else if (e.key === 'l' || e.key === 'L') {
                audioInput.click();
            } else if (e.key === '?' || (e.shiftKey && e.key === '/')) {
                shortcutsPanel.classList.toggle('hidden');
            }
        });

        this.syncSlidersFromEngine();
        this.updateModeButtons();

        window.AscentAPI = {
            engine: this.engine,
            visualizer: this.visualizer,
            applyPreset: (name) => this.applyNamedPreset(name),
            exportPreset: () => this.exportPresetJson(),
            getPresets: () => ({ ...ASCENT_PRESETS }),
            play: () => {
                if (!this.engine.isPlaying) this.togglePlay(playBtn, status);
            },
            stop: () => {
                if (this.engine.isPlaying) this.togglePlay(playBtn, status);
            }
        };
    }

    togglePlay(playBtn, status) {
        if (this.engine.isPlaying) {
            this.engine.stop();
            playBtn.classList.remove('active');
            status.className = 'idle';
        } else {
            this.engine.start();
            playBtn.classList.add('active');
            status.className = 'active';
        }
    }

    updateRecTimer() {
        if (!this.engine.isRecording) return;
        const sec = Math.floor((Date.now() - this.engine.recStartTime) / 1000);
        const m = Math.floor(sec / 60)
            .toString()
            .padStart(2, '0');
        const s = (sec % 60).toString().padStart(2, '0');
        document.getElementById('rec-time').textContent = `${m}:${s}`;
        setTimeout(() => this.updateRecTimer(), 1000);
    }
}

window.addEventListener('load', () => {
    window.ascent = new App();
});
