// Procedural Web Audio API synthesizer + optional Web Speech API Text-to-Speech
import { WeatherType, ZoneId } from '../types/game';

export type FootstepSurface = 'grass' | 'gravel' | 'wood';
export type AmbientWildlifeKind = 'bird' | 'wind' | 'insect';

export interface AmbientEmitterAnchor {
  kind: AmbientWildlifeKind;
  x: number;
  y: number;
  z: number;
  zoneId?: ZoneId;
}

interface ZoneAmbienceProfile {
  weights: { bird: number; wind: number; insect: number };
  intervalMs: [number, number];
  birdStyle: 'village' | 'meadow' | 'forest';
  windDepth: 'light' | 'breezy' | 'pine';
  insectFocus: 'bee' | 'cricket' | 'cicada';
}

const ZONE_AMBIENCE: Record<ZoneId, ZoneAmbienceProfile> = {
  town_square: {
    weights: { bird: 0.55, wind: 0.25, insect: 0.2 },
    intervalMs: [2100, 4600],
    birdStyle: 'village',
    windDepth: 'light',
    insectFocus: 'bee',
  },
  bathhouse: {
    weights: { bird: 0.28, wind: 0.44, insect: 0.28 },
    intervalMs: [2300, 4800],
    birdStyle: 'meadow',
    windDepth: 'breezy',
    insectFocus: 'bee',
  },
  market: {
    weights: { bird: 0.48, wind: 0.34, insect: 0.18 },
    intervalMs: [2400, 5000],
    birdStyle: 'village',
    windDepth: 'light',
    insectFocus: 'bee',
  },
  sports_field: {
    weights: { bird: 0.32, wind: 0.43, insect: 0.25 },
    intervalMs: [1900, 4200],
    birdStyle: 'meadow',
    windDepth: 'breezy',
    insectFocus: 'cicada',
  },
  clinic: {
    weights: { bird: 0.36, wind: 0.42, insect: 0.22 },
    intervalMs: [2500, 5200],
    birdStyle: 'meadow',
    windDepth: 'light',
    insectFocus: 'cricket',
  },
  cozy_cottage: {
    weights: { bird: 0.24, wind: 0.38, insect: 0.38 },
    intervalMs: [2300, 4900],
    birdStyle: 'forest',
    windDepth: 'pine',
    insectFocus: 'cricket',
  },
  school: {
    weights: { bird: 0.5, wind: 0.3, insect: 0.2 },
    intervalMs: [2200, 4700],
    birdStyle: 'village',
    windDepth: 'light',
    insectFocus: 'cicada',
  },
  misty_forest: {
    weights: { bird: 0.34, wind: 0.34, insect: 0.32 },
    intervalMs: [1650, 3800],
    birdStyle: 'forest',
    windDepth: 'pine',
    insectFocus: 'cicada',
  },
};

class HealthQuestAudio {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private ambientNoiseBuffer: AudioBuffer | null = null;
  private enabled = true;
  private ttsEnabled = false;
  private musicTimer: number | null = null;
  private ambientTimer: number | null = null;
  private noteIndex = 0;
  private crystalCount = 0;
  private currentMode: 'village' | 'minigame' | 'forest' = 'village';

  private currentZoneId: ZoneId = 'town_square';
  private weather: WeatherType = 'sunny';
  private dayTime = 0.28;
  private listenerPos = { x: 0, y: 1.6, z: 6 };
  private ambientEmitters: AmbientEmitterAnchor[] = [];
  private lastFlutterSoundAt = 0;

  private ensureContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx) {
      this.applyListenerTransform(this.ctx);
    }
    return this.ctx;
  }

  private applyListenerTransform(ctx: AudioContext) {
    const listener = ctx.listener;
    if (!listener) return;
    const { x, y, z } = this.listenerPos;
    try {
      if (listener.positionX) {
        listener.positionX.setValueAtTime(x, ctx.currentTime);
        listener.positionY.setValueAtTime(y, ctx.currentTime);
        listener.positionZ.setValueAtTime(z, ctx.currentTime);
        listener.forwardX.setValueAtTime(0, ctx.currentTime);
        listener.forwardY.setValueAtTime(0, ctx.currentTime);
        listener.forwardZ.setValueAtTime(-1, ctx.currentTime);
        listener.upX.setValueAtTime(0, ctx.currentTime);
        listener.upY.setValueAtTime(1, ctx.currentTime);
        listener.upZ.setValueAtTime(0, ctx.currentTime);
      } else {
        const legacy = listener as AudioListener & {
          setPosition?: (x: number, y: number, z: number) => void;
          setOrientation?: (fx: number, fy: number, fz: number, ux: number, uy: number, uz: number) => void;
        };
        legacy.setPosition?.(x, y, z);
        legacy.setOrientation?.(0, 0, -1, 0, 1, 0);
      }
    } catch {
      // Ignore spatial listener fallback issues on restricted environments
    }
  }

  public updateListenerPosition(x: number, y: number, z: number) {
    this.listenerPos.x = x;
    this.listenerPos.y = y;
    this.listenerPos.z = z;
    if (this.ctx && this.ctx.state === 'running') {
      this.applyListenerTransform(this.ctx);
    }
  }

  public setAmbientEnvironment(zoneId: ZoneId, weather: WeatherType, dayTime: number) {
    this.currentZoneId = zoneId;
    this.weather = weather;
    this.dayTime = dayTime;
  }

  public setAmbientEmitters(emitters: AmbientEmitterAnchor[]) {
    this.ambientEmitters = emitters;
  }

  public unlock() {
    this.ensureContext();
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopMusic();
      this.stopAmbient();
    } else {
      this.startMusic();
      this.startAmbient();
    }
  }

  public setTtsEnabled(enabled: boolean) {
    this.ttsEnabled = enabled;
    if (!enabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public speak(text: string) {
    if (!this.ttsEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.96;
      utter.pitch = 1.05;
      utter.volume = 0.85;
      window.speechSynthesis.speak(utter);
    } catch {
      // Ignore TTS errors cleanly
    }
  }

  public setMusicContext(mode: 'village' | 'minigame' | 'forest', crystals: number) {
    this.currentMode = mode;
    this.crystalCount = crystals;
  }

  public startMusic() {
    if (!this.enabled) return;
    this.startAmbient();
    if (this.musicTimer !== null) return;
    const stepMs = () => (this.currentMode === 'minigame' ? 320 : Math.max(420, 620 - this.crystalCount * 35));

    const playStep = () => {
      if (!this.enabled) {
        this.musicTimer = null;
        return;
      }
      this.playMelodyStep();
      this.musicTimer = window.setTimeout(playStep, stepMs());
    };
    this.musicTimer = window.setTimeout(playStep, 500);
  }

  public stopMusic() {
    if (this.musicTimer !== null) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
    this.stopAmbient();
  }

  public startAmbient() {
    if (!this.enabled || this.ambientTimer !== null || typeof window === 'undefined') return;

    const scheduleNext = () => {
      if (!this.enabled) {
        this.ambientTimer = null;
        return;
      }
      this.triggerRandomZoneWildlife();
      const profile = ZONE_AMBIENCE[this.currentZoneId] ?? ZONE_AMBIENCE.town_square;
      const [minMs, maxMs] = profile.intervalMs;
      let nextDelay = minMs + Math.random() * (maxMs - minMs);
      if (this.currentMode === 'minigame') {
        nextDelay *= 2.0;
      } else if (this.weather === 'rain') {
        nextDelay *= 1.15;
      }
      this.ambientTimer = window.setTimeout(scheduleNext, nextDelay);
    };

    this.ambientTimer = window.setTimeout(scheduleNext, 900 + Math.random() * 1100);
  }

  public stopAmbient() {
    if (this.ambientTimer !== null) {
      clearTimeout(this.ambientTimer);
      this.ambientTimer = null;
    }
  }

  private playMelodyStep() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;

    // Gentle pentatonic scales that brighten as Crystals return
    const villageNotes = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 392.0, 329.63];
    const forestNotes = [220.0, 261.63, 293.66, 329.63, 293.66, 246.94, 220.0, 196.0];
    const minigameNotes = [392.0, 440.0, 523.25, 587.33, 659.25, 587.33, 523.25, 440.0];

    const pool =
      this.currentMode === 'minigame'
        ? minigameNotes
        : this.currentMode === 'forest'
        ? forestNotes
        : villageNotes;

    const freq = pool[this.noteIndex % pool.length];
    this.noteIndex++;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = this.currentMode === 'minigame' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, now);

    const vol = this.currentMode === 'minigame' ? 0.032 : 0.022 + this.crystalCount * 0.003;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(vol, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  public playChime(type: 'success' | 'tap' | 'hint' | 'crystal' | 'bubble' | 'fail' = 'tap') {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const playTone = (freq: number, delay: number, duration: number, wave: OscillatorType = 'sine', vol = 0.08) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, now + delay);
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(vol, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + duration + 0.02);
    };

    if (type === 'tap') {
      playTone(520, 0, 0.08, 'sine', 0.05);
    } else if (type === 'bubble') {
      playTone(620 + Math.random() * 240, 0, 0.09, 'sine', 0.05);
    } else if (type === 'hint') {
      playTone(392, 0, 0.14, 'triangle', 0.06);
      playTone(349.23, 0.1, 0.16, 'triangle', 0.05);
    } else if (type === 'fail') {
      playTone(311.13, 0, 0.16, 'sawtooth', 0.05);
      playTone(233.08, 0.14, 0.28, 'triangle', 0.07);
    } else if (type === 'success') {
      playTone(523.25, 0, 0.15, 'triangle', 0.08);
      playTone(659.25, 0.1, 0.16, 'triangle', 0.08);
      playTone(783.99, 0.2, 0.28, 'triangle', 0.09);
    } else if (type === 'crystal') {
      playTone(523.25, 0, 0.2, 'sine', 0.09);
      playTone(659.25, 0.1, 0.2, 'sine', 0.09);
      playTone(783.99, 0.2, 0.25, 'sine', 0.09);
      playTone(1046.5, 0.32, 0.45, 'triangle', 0.1);
    }
  }

  public playCelebrationFanfare() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
    notes.forEach((freq, idx) => {
      const delay = idx * 0.085;
      const dur = idx === notes.length - 1 ? 0.65 : 0.22;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx >= 3 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + delay);
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(idx === notes.length - 1 ? 0.11 : 0.08, now + delay + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + dur + 0.03);
    });
  }

  public playFireworkBurst() {
    if (!this.enabled) return;
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;

    // Soft low firework thump
    const thump = ctx.createOscillator();
    const tGain = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(145 + Math.random() * 45, now);
    thump.frequency.exponentialRampToValueAtTime(42, now + 0.22);
    tGain.gain.setValueAtTime(0.0001, now);
    tGain.gain.exponentialRampToValueAtTime(0.06, now + 0.015);
    tGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    thump.connect(tGain);
    tGain.connect(ctx.destination);
    thump.start(now);
    thump.stop(now + 0.26);

    // Sparkling crackle noise tail
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = this.getAmbientNoiseBuffer(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(2400 + Math.random() * 1400, now);
    hp.Q.setValueAtTime(1.1, now);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.0001, now);
    nGain.gain.exponentialRampToValueAtTime(0.045, now + 0.02);
    nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    noiseSrc.connect(hp);
    hp.connect(nGain);
    nGain.connect(ctx.destination);
    noiseSrc.start(now);
    noiseSrc.stop(now + 0.45);
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const len = Math.floor(ctx.sampleRate * 0.16);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buf;
    return buf;
  }

  private getAmbientNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.ambientNoiseBuffer && this.ambientNoiseBuffer.sampleRate === ctx.sampleRate) {
      return this.ambientNoiseBuffer;
    }
    const len = Math.floor(ctx.sampleRate * 1.8);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    // Soft pink-tinted noise (Paul Kellet approximation) for warm organic breeze
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.1848) * 0.22));
    }
    this.ambientNoiseBuffer = buf;
    return buf;
  }

  private createPositionalSink(
    ctx: AudioContext,
    x: number,
    y: number,
    z: number,
    baseVolume = 1.0,
    maxDistance = 30
  ): GainNode {
    const sink = ctx.createGain();
    const modeScale = this.currentMode === 'minigame' ? 0.35 : 1.0;
    sink.gain.setValueAtTime(baseVolume * modeScale, ctx.currentTime);

    try {
      const panner = ctx.createPanner();
      panner.panningModel = 'equalpower';
      panner.distanceModel = 'inverse';
      panner.refDistance = 3.5;
      panner.maxDistance = maxDistance;
      panner.rolloffFactor = 1.25;

      if (panner.positionX) {
        panner.positionX.setValueAtTime(x, ctx.currentTime);
        panner.positionY.setValueAtTime(y, ctx.currentTime);
        panner.positionZ.setValueAtTime(z, ctx.currentTime);
      } else {
        (
          panner as PannerNode & {
            setPosition?: (px: number, py: number, pz: number) => void;
          }
        ).setPosition?.(x, y, z);
      }
      sink.connect(panner);
      panner.connect(ctx.destination);
      return sink;
    } catch {
      // Fallback stereo panner + distance attenuation
      const dx = x - this.listenerPos.x;
      const dz = z - this.listenerPos.z;
      const dist = Math.hypot(dx, dz);
      const atten = Math.max(0.08, 1 - dist / maxDistance);
      sink.gain.setValueAtTime(baseVolume * modeScale * atten, ctx.currentTime);
      if (typeof ctx.createStereoPanner === 'function') {
        const stereo = ctx.createStereoPanner();
        stereo.pan.setValueAtTime(Math.max(-0.92, Math.min(0.92, dx / 14)), ctx.currentTime);
        sink.connect(stereo);
        stereo.connect(ctx.destination);
      } else {
        sink.connect(ctx.destination);
      }
      return sink;
    }
  }

  private triggerRandomZoneWildlife() {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;

    const profile = ZONE_AMBIENCE[this.currentZoneId] ?? ZONE_AMBIENCE.town_square;
    const tDay = ((this.dayTime % 1) + 1) % 1;
    const isNight = tDay < 0.12 || tDay >= 0.8;

    let birdW = profile.weights.bird;
    let windW = profile.weights.wind;
    let insectW = profile.weights.insect;

    if (isNight) {
      birdW *= this.currentZoneId === 'misty_forest' || this.currentZoneId === 'cozy_cottage' ? 0.35 : 0.14;
      insectW *= 1.85;
    }
    if (this.weather === 'rain') {
      birdW *= 0.3;
      insectW *= 0.15;
      windW *= 1.7;
    } else if (this.weather === 'cloudy') {
      birdW *= 0.85;
      windW *= 1.25;
    }

    const total = birdW + windW + insectW;
    if (total <= 0.001) return;

    const roll = Math.random() * total;
    const kind: AmbientWildlifeKind =
      roll < birdW ? 'bird' : roll < birdW + windW ? 'wind' : 'insect';

    const pos = this.pickPositionalCoordinates(kind);
    this.playPositionalWildlife(kind, pos.x, pos.y, pos.z);
  }

  private pickPositionalCoordinates(kind: AmbientWildlifeKind): { x: number; y: number; z: number } {
    const lx = this.listenerPos.x;
    const ly = this.listenerPos.y;
    const lz = this.listenerPos.z;

    if (this.ambientEmitters.length > 0) {
      const nearby = this.ambientEmitters.filter((e) => {
        if (e.kind !== kind) return false;
        const d = Math.hypot(e.x - lx, e.z - lz);
        return d >= 2.2 && d <= 22;
      });
      if (nearby.length > 0) {
        const chosen = nearby[Math.floor(Math.random() * nearby.length)];
        return {
          x: chosen.x + (Math.random() - 0.5) * 1.8,
          y: chosen.y + (Math.random() - 0.5) * 0.6,
          z: chosen.z + (Math.random() - 0.5) * 1.8,
        };
      }
    }

    const angle = Math.random() * Math.PI * 2;
    const radius = kind === 'wind' ? 6 + Math.random() * 10 : 4.5 + Math.random() * 10.5;
    const heightOffset = kind === 'bird' ? 2.4 + Math.random() * 2.5 : kind === 'wind' ? 2.0 + Math.random() * 2.0 : -0.6 + Math.random() * 0.8;
    return {
      x: lx + Math.cos(angle) * radius,
      y: ly + heightOffset,
      z: lz + Math.sin(angle) * radius,
    };
  }

  public playButterflyFlutterAt(x: number, y: number, z: number) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const nowMs = performance.now();
    if (nowMs - this.lastFlutterSoundAt < 900) return;
    this.lastFlutterSoundAt = nowMs;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const sink = this.createPositionalSink(ctx, x, y, z, 0.65, 18);

    // Light delicate wing-flutter puffs
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.055;
      const src = ctx.createBufferSource();
      src.buffer = this.getNoiseBuffer(ctx);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2200 + i * 240, t);
      bp.Q.setValueAtTime(2.6, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.015, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      src.connect(bp);
      bp.connect(g);
      g.connect(sink);
      src.start(t);
      src.stop(t + 0.055);
    }
  }

  public playPositionalWildlife(kind: AmbientWildlifeKind, x: number, y: number, z: number) {
    if (!this.enabled) return;
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;

    const profile = ZONE_AMBIENCE[this.currentZoneId] ?? ZONE_AMBIENCE.town_square;
    const tDay = ((this.dayTime % 1) + 1) % 1;
    const isNight = tDay < 0.12 || tDay >= 0.8;
    const now = ctx.currentTime;
    const sink = this.createPositionalSink(ctx, x, y, z, 1.0, 30);

    if (kind === 'bird') {
      this.synthBirdCall(ctx, sink, now, isNight, profile.birdStyle);
    } else if (kind === 'wind') {
      this.synthWindRustle(ctx, sink, now, profile.windDepth);
    } else {
      this.synthInsectSound(ctx, sink, now, isNight, profile.insectFocus);
    }
  }

  private synthBirdCall(
    ctx: AudioContext,
    sink: GainNode,
    now: number,
    isNight: boolean,
    style: ZoneAmbienceProfile['birdStyle']
  ) {
    const crystalBrightness = 1 + (this.crystalCount / 5) * 0.08;

    // Gentle distant owl hoot at night in forest / cozy cottage
    if (isNight) {
      const notes = Math.random() < 0.55 ? [0, 0.42] : [0, 0.38, 0.84];
      const baseFreq = (380 + Math.random() * 55) * crystalBrightness;
      notes.forEach((offset, idx) => {
        const t = now + offset;
        const dur = idx === notes.length - 1 ? 0.36 : 0.22;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, t);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.86, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.022, t + 0.045);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g);
        g.connect(sink);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      });
      return;
    }

    const variant = Math.random();
    if (style === 'forest' && variant < 0.5) {
      // Melodic woodland thrush 3-note flute call
      const base = (1320 + Math.random() * 280) * crystalBrightness;
      const pattern = [1.0, 1.24, 0.92];
      pattern.forEach((ratio, idx) => {
        const t = now + idx * 0.15;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(base * ratio, t);
        osc.frequency.exponentialRampToValueAtTime(base * ratio * (idx === 1 ? 1.09 : 0.94), t + 0.12);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.024, t + 0.025);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
        osc.connect(g);
        g.connect(sink);
        osc.start(t);
        osc.stop(t + 0.15);
      });
    } else if (variant < 0.65) {
      // Cheerful multi-syllable songbird chirp
      const count = 2 + Math.floor(Math.random() * 3);
      const basePitch = (style === 'meadow' ? 2350 : 2100) + Math.random() * 750;
      let cursor = 0;
      for (let i = 0; i < count; i++) {
        const t = now + cursor;
        const dur = 0.065 + Math.random() * 0.04;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        const f0 = basePitch * crystalBrightness * (0.92 + Math.random() * 0.18);
        const f1 = f0 * (Math.random() < 0.7 ? 1.28 : 0.78);
        osc.frequency.setValueAtTime(f0, t);
        osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.026, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g);
        g.connect(sink);
        osc.start(t);
        osc.stop(t + dur + 0.015);
        cursor += dur + 0.055 + Math.random() * 0.065;
      }
    } else {
      // Rapid FM warble trill
      const dur = 0.22 + Math.random() * 0.14;
      const carrier = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const g = ctx.createGain();

      const centerFreq = (2200 + Math.random() * 650) * crystalBrightness;
      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(centerFreq, now);
      carrier.frequency.exponentialRampToValueAtTime(centerFreq * 1.12, now + dur);

      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(28 + Math.random() * 14, now);
      lfoGain.gain.setValueAtTime(190, now);

      lfo.connect(lfoGain);
      lfoGain.connect(carrier.frequency);

      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.022, now + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      carrier.connect(g);
      g.connect(sink);
      lfo.start(now);
      carrier.start(now);
      lfo.stop(now + dur + 0.02);
      carrier.stop(now + dur + 0.02);
    }
  }

  private synthWindRustle(
    ctx: AudioContext,
    sink: GainNode,
    now: number,
    windDepth: ZoneAmbienceProfile['windDepth']
  ) {
    const dur = 1.8 + Math.random() * 1.4;
    const weatherMult = this.weather === 'rain' ? 1.45 : this.weather === 'cloudy' ? 1.2 : 1.0;

    // Layer 1: Smooth sweeping canopy breeze
    const breezeSrc = ctx.createBufferSource();
    breezeSrc.buffer = this.getAmbientNoiseBuffer(ctx);
    breezeSrc.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const lowFreq = windDepth === 'pine' ? 280 : windDepth === 'breezy' ? 390 : 450;
    const peakFreq = lowFreq * (1.65 + Math.random() * 0.45);
    filter.frequency.setValueAtTime(lowFreq, now);
    filter.frequency.exponentialRampToValueAtTime(peakFreq, now + dur * 0.45);
    filter.frequency.exponentialRampToValueAtTime(lowFreq * 0.9, now + dur);
    filter.Q.setValueAtTime(1.15, now);

    const bGain = ctx.createGain();
    const peakVol = Math.min(0.048, (windDepth === 'pine' ? 0.032 : 0.024) * weatherMult);
    bGain.gain.setValueAtTime(0.0001, now);
    bGain.gain.exponentialRampToValueAtTime(peakVol, now + dur * 0.42);
    bGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    breezeSrc.connect(filter);
    filter.connect(bGain);
    bGain.connect(sink);
    breezeSrc.start(now);
    breezeSrc.stop(now + dur + 0.04);

    // Layer 2: Soft high leaf shimmer
    const leafSrc = ctx.createBufferSource();
    leafSrc.buffer = this.getAmbientNoiseBuffer(ctx);
    leafSrc.loop = true;
    leafSrc.loopStart = 0.3;

    const leafFilter = ctx.createBiquadFilter();
    leafFilter.type = 'bandpass';
    leafFilter.frequency.setValueAtTime(1950 + Math.random() * 750, now);
    leafFilter.Q.setValueAtTime(1.8, now);

    const lGain = ctx.createGain();
    lGain.gain.setValueAtTime(0.0001, now);
    lGain.gain.exponentialRampToValueAtTime(0.011 * weatherMult, now + dur * 0.5);
    lGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    leafSrc.connect(leafFilter);
    leafFilter.connect(lGain);
    lGain.connect(sink);
    leafSrc.start(now);
    leafSrc.stop(now + dur + 0.04);
  }

  private synthInsectSound(
    ctx: AudioContext,
    sink: GainNode,
    now: number,
    isNight: boolean,
    focus: ZoneAmbienceProfile['insectFocus']
  ) {
    const mode = isNight ? 'cricket' : focus;

    if (mode === 'cricket') {
      // Rhythmic 3-4 chirp pulse cricket
      const chirps = 2 + Math.floor(Math.random() * 3);
      const pitch = 3950 + Math.random() * 650;
      for (let c = 0; c < chirps; c++) {
        const startC = now + c * 0.24;
        for (let p = 0; p < 3; p++) {
          const t = startC + p * 0.036;
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(pitch + (p % 2) * 35, t);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.016, t + 0.006);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.026);
          osc.connect(g);
          g.connect(sink);
          osc.start(t);
          osc.stop(t + 0.03);
        }
      }
    } else if (mode === 'cicada') {
      // Sunlit narrowband cicada shimmer
      const dur = 0.85 + Math.random() * 0.65;
      const src = ctx.createBufferSource();
      src.buffer = this.getAmbientNoiseBuffer(ctx);
      src.loop = true;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      const center = 4400 + Math.random() * 900;
      bp.frequency.setValueAtTime(center, now);
      bp.frequency.linearRampToValueAtTime(center * 0.92, now + dur);
      bp.Q.setValueAtTime(4.2, now);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.014, now + dur * 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      src.connect(bp);
      bp.connect(g);
      g.connect(sink);
      src.start(now);
      src.stop(now + dur + 0.03);
    } else {
      // Gentle passing garden bee / dragonfly hum
      const dur = 0.55 + Math.random() * 0.35;
      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();

      const f0 = 165 + Math.random() * 45;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f0, now);
      osc.frequency.linearRampToValueAtTime(f0 * (0.9 + Math.random() * 0.16), now + dur);

      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(460, now);

      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.013, now + dur * 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      osc.connect(lp);
      lp.connect(g);
      g.connect(sink);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    }
  }

  public playFootstep(surface: FootstepSurface) {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const jitter = 0.9 + Math.random() * 0.2;
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = this.getNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    const nGain = ctx.createGain();

    if (surface === 'grass') {
      // Soft meadow rustle + gentle muted thump
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1250 * jitter, now);
      filter.Q.setValueAtTime(1.05, now);

      nGain.gain.setValueAtTime(0.0001, now);
      nGain.gain.exponentialRampToValueAtTime(0.028, now + 0.012);
      nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

      noiseSrc.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noiseSrc.start(now);
      noiseSrc.stop(now + 0.075);

      const thud = ctx.createOscillator();
      const tGain = ctx.createGain();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(98 * jitter, now);
      thud.frequency.exponentialRampToValueAtTime(55, now + 0.055);
      tGain.gain.setValueAtTime(0.014, now);
      tGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      thud.connect(tGain);
      tGain.connect(ctx.destination);
      thud.start(now);
      thud.stop(now + 0.065);
    } else if (surface === 'gravel') {
      // Crisp cobblestone / gravel crunch with dual micro-grain texture
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2550 * jitter, now);
      filter.Q.setValueAtTime(1.4, now);

      nGain.gain.setValueAtTime(0.0001, now);
      nGain.gain.exponentialRampToValueAtTime(0.036, now + 0.008);
      nGain.gain.exponentialRampToValueAtTime(0.014, now + 0.032);
      nGain.gain.exponentialRampToValueAtTime(0.024, now + 0.044);
      nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);

      noiseSrc.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noiseSrc.start(now);
      noiseSrc.stop(now + 0.09);

      const tap = ctx.createOscillator();
      const tGain = ctx.createGain();
      tap.type = 'triangle';
      tap.frequency.setValueAtTime(185 * jitter, now);
      tap.frequency.exponentialRampToValueAtTime(90, now + 0.045);
      tGain.gain.setValueAtTime(0.02, now);
      tGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      tap.connect(tGain);
      tGain.connect(ctx.destination);
      tap.start(now);
      tap.stop(now + 0.055);
    } else {
      // Hollow resonant wooden bridge / cottage floor plank knock
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(760 * jitter, now);
      filter.Q.setValueAtTime(2.4, now);

      nGain.gain.setValueAtTime(0.0001, now);
      nGain.gain.exponentialRampToValueAtTime(0.024, now + 0.006);
      nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.048);

      noiseSrc.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noiseSrc.start(now);
      noiseSrc.stop(now + 0.055);

      const body = ctx.createOscillator();
      const bGain = ctx.createGain();
      body.type = 'triangle';
      body.frequency.setValueAtTime(158 * jitter, now);
      body.frequency.exponentialRampToValueAtTime(88, now + 0.075);
      bGain.gain.setValueAtTime(0.042, now);
      bGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);
      body.connect(bGain);
      bGain.connect(ctx.destination);
      body.start(now);
      body.stop(now + 0.09);
    }
  }
}

export const audioEngine = new HealthQuestAudio();

