// High-Energy Web Audio Engine for Kahoot Clone Pro
// Upbeat danceable lobby groove with kick/snare/hihats & accelerating high-tension question music

class KahootAudio {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.volume = 0.65;
        this.currentMusicLoop = null;
        this.musicPlaying = false;
        this.noiseBuffer = null;
        this.currentMode = null;
        this.init();
    }

    init() {
        const initOnGesture = () => {
            if (!this.ctx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                    this.ctx = new AudioCtx();
                    this.generateNoiseBuffer();
                }
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            window.removeEventListener('click', initOnGesture);
            window.removeEventListener('keydown', initOnGesture);
            window.removeEventListener('touchstart', initOnGesture);
        };
        window.addEventListener('click', initOnGesture);
        window.addEventListener('keydown', initOnGesture);
        window.addEventListener('touchstart', initOnGesture);
    }

    ensureContext() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
                this.generateNoiseBuffer();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        return this.ctx;
    }

    generateNoiseBuffer() {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise
        this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
    }

    setMuted(muted) {
        this.isMuted = muted;
        if (muted) {
            this.stopMusic();
        }
    }

    setVolume(val) {
        this.volume = Math.max(0, Math.min(1, val));
    }

    // Single synthesized tone
    playTone(freq, type = 'sine', duration = 0.2, gainLevel = 0.3, delay = 0) {
        if (this.isMuted) return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        const startTime = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(gainLevel * this.volume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
    }

    // Drum: Punchy Kick
    playKick(delay = 0) {
        if (this.isMuted) return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        const startTime = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, startTime);
        osc.frequency.exponentialRampToValueAtTime(32, startTime + 0.12);

        gain.gain.setValueAtTime(0.6 * this.volume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.18);
    }

    // Drum: Crisp Snare / Clap
    playSnare(delay = 0) {
        if (this.isMuted || !this.noiseBuffer) return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        const startTime = ctx.currentTime + delay;

        // White noise through bandpass
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = this.noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200, startTime);
        filter.Q.setValueAtTime(1.5, startTime);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.4 * this.volume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.16);

        noiseSource.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        // Body pop
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(190, startTime);
        osc.frequency.exponentialRampToValueAtTime(60, startTime + 0.08);

        oscGain.gain.setValueAtTime(0.3 * this.volume, startTime);
        oscGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.08);

        osc.connect(oscGain);
        oscGain.connect(ctx.destination);

        noiseSource.start(startTime);
        noiseSource.stop(startTime + 0.16);
        osc.start(startTime);
        osc.stop(startTime + 0.08);
    }

    // Drum: High-hat
    playHiHat(delay = 0, open = false) {
        if (this.isMuted || !this.noiseBuffer) return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        const startTime = ctx.currentTime + delay;
        const duration = open ? 0.15 : 0.04;

        const source = ctx.createBufferSource();
        source.buffer = this.noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(7500, startTime);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime((open ? 0.28 : 0.18) * this.volume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        source.start(startTime);
        source.stop(startTime + duration);
    }

    // Interactive Sound Effects
    playClick() {
        this.playTone(850, 'triangle', 0.06, 0.25);
    }

    playJoin() {
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
            this.playTone(freq, 'triangle', 0.14, 0.22, idx * 0.045);
        });
    }

    playCorrect() {
        const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
        notes.forEach((freq, idx) => {
            this.playTone(freq, 'triangle', 0.25, 0.35, idx * 0.05);
        });
    }

    playIncorrect() {
        this.playTone(280, 'sawtooth', 0.18, 0.25, 0);
        this.playTone(210, 'sawtooth', 0.28, 0.25, 0.12);
    }

    playTick() {
        this.playTone(1300, 'square', 0.03, 0.25);
    }

    playTimesUp() {
        if (this.isMuted) return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(340, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.85);

        gain.gain.setValueAtTime(0.45 * this.volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.85);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.85);
    }

    playFanfare() {
        const fanfareNotes = [
            { f: 523.25, d: 0.14, t: 0 },
            { f: 523.25, d: 0.14, t: 0.14 },
            { f: 523.25, d: 0.14, t: 0.28 },
            { f: 659.25, d: 0.45, t: 0.42 },
            { f: 587.33, d: 0.18, t: 0.88 },
            { f: 659.25, d: 0.18, t: 1.06 },
            { f: 783.99, d: 0.65, t: 1.25 },
            { f: 1046.50, d: 1.10, t: 1.90 }
        ];
        fanfareNotes.forEach(n => {
            this.playTone(n.f, 'sawtooth', n.d, 0.38, n.t);
            this.playTone(n.f * 0.5, 'triangle', n.d, 0.25, n.t);
        });
    }

    // =========================================================================
    // 🕺 MÚSICA DE LOBBY SUPER MOVIDA (134 BPM - Electro Dance Party Groove)
    // =========================================================================
    startLobbyMusic() {
        if (this.isMuted || this.musicPlaying) return;
        this.ensureContext();
        this.musicPlaying = true;
        this.currentMode = 'lobby';

        const bpm = 134; // Upbeat dance tempo!
        const beatDuration = 60 / bpm;
        const stepTime = beatDuration / 4; // 16th note steps
        let step = 0;

        // Slap Bassline with octave jumps and syncopation
        const bassLine = [
            130.81, 0, 261.63, 130.81,  155.56, 0, 311.13, 155.56,
            174.61, 0, 349.23, 174.61,  196.00, 174.61, 155.56, 146.83,
            130.81, 130.81, 261.63, 0,  155.56, 0, 311.13, 155.56,
            196.00, 0, 392.00, 196.00,  233.08, 0, 261.63, 0
        ];

        // Catchy Disco / Electro Chords
        const leadArp = [
            523.25, 659.25, 783.99, 1046.50,
            587.33, 698.46, 880.00, 1046.50,
            659.25, 783.99, 1046.50, 1318.51,
            783.99, 987.77, 1174.66, 1567.98
        ];

        this.currentMusicLoop = setInterval(() => {
            if (!this.musicPlaying || this.isMuted) return;

            const beatStep = step % 16;
            const fullStep = step % 32;

            // 1. Kick on every quarter note (0, 4, 8, 12) + double kick for groove!
            if (beatStep === 0 || beatStep === 4 || beatStep === 8 || beatStep === 12 || beatStep === 14) {
                this.playKick();
            }

            // 2. Snare / Clap on beats 4 and 12 (beats 2 & 4 of bar)
            if (beatStep === 4 || beatStep === 12) {
                this.playSnare();
            }

            // 3. Hi-hats: closed on every 16th, open on the off-beats (2, 6, 10, 14)
            if (beatStep === 2 || beatStep === 6 || beatStep === 10 || beatStep === 14) {
                this.playHiHat(0, true); // Open sizzle!
            } else {
                this.playHiHat(0, false); // Closed tick
            }

            // 4. Punchy Bass
            const bass = bassLine[fullStep];
            if (bass > 0) {
                this.playTone(bass, 'triangle', 0.12, 0.42);
                this.playTone(bass * 0.5, 'sine', 0.14, 0.48); // Deep sub
            }

            // 5. Catchy lead hook
            if (beatStep % 2 === 0) {
                const leadFreq = leadArp[(Math.floor(step / 2)) % leadArp.length];
                if (leadFreq > 0) {
                    this.playTone(leadFreq, 'square', 0.09, 0.18);
                }
            }

            step++;
        }, stepTime * 1000);
    }

    // =========================================================================
    // 🔥 MÚSICA DE PREGUNTA: ADRENALINA & CUENTA REGRESIVA ACELERADA
    // =========================================================================
    startQuestionMusic(duration = 20) {
        this.stopMusic();
        if (this.isMuted) return;
        this.ensureContext();
        this.musicPlaying = true;
        this.currentMode = 'question';

        let tickCount = 0;
        let bpm = 138;
        let step = 0;

        const loop = () => {
            if (!this.musicPlaying || this.isMuted) return;

            // 4-on-the-floor driving kick
            if (step % 2 === 0) {
                this.playKick();
            }

            // Driving 16th-note sub bass pulse
            const bassNotes = [110, 110, 130.81, 146.83, 164.81, 146.83, 130.81, 110];
            const bFreq = bassNotes[step % bassNotes.length];
            this.playTone(bFreq, 'sawtooth', 0.12, 0.32);

            // Shaker / Hi-Hat
            this.playHiHat(0, step % 2 !== 0);

            // High tension ticking
            const pitch = 500 + Math.min(600, tickCount * 14);
            this.playTone(pitch, 'square', 0.04, 0.22);

            step++;
            tickCount++;

            // Accelerate tempo dynamically over the duration
            let nextDelay = Math.max(160, 260 - (tickCount * 2.8));
            this.currentMusicLoop = setTimeout(loop, nextDelay);
        };

        this.currentMusicLoop = setTimeout(loop, 200);
    }

    stopMusic() {
        this.musicPlaying = false;
        if (this.currentMusicLoop) {
            clearInterval(this.currentMusicLoop);
            clearTimeout(this.currentMusicLoop);
            this.currentMusicLoop = null;
        }
    }
}

// Global audio singleton
window.kahootAudio = new KahootAudio();
