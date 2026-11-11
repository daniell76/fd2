import type { MusicTrack } from '../types';

export type SfxKind =
  | 'cursor'
  | 'confirm'
  | 'cancel'
  | 'step'
  | 'slash'
  | 'hit'
  | 'crit'
  | 'miss'
  | 'magic'
  | 'heal'
  | 'chest'
  | 'levelup'
  | 'fanfare'
  | 'explosion'
  | 'quake';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private tracks: MusicTrack[] = [];
  private currentTrackIdx = -1;
  private isPlayingMusic = false;
  private muted = false;

  private trackStartTime = 0;
  private noteCursor = 0;
  private schedulerTimer: number | null = null;

  setTracks(tracks: MusicTrack[]): void {
    this.tracks = tracks;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 4;
      comp.connect(this.ctx.destination);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.72;
      this.masterGain.connect(comp);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.42;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.65;
      this.sfxGain.connect(this.masterGain);

      // White noise buffer for percussion & combat impacts
      const len = this.ctx.sampleRate * 0.5;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  isMuted(): boolean {
    return this.muted;
  }

  getCurrentTrackIndex(): number {
    return this.currentTrackIdx;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopMusic();
    } else if (this.currentTrackIdx >= 0) {
      this.playTrack(this.currentTrackIdx);
    }
    return this.muted;
  }

  playTrack(trackIdx: number): void {
    if (this.tracks.length === 0) return;
    const idx = ((trackIdx % this.tracks.length) + this.tracks.length) % this.tracks.length;
    if (this.isPlayingMusic && this.currentTrackIdx === idx && !this.muted) return;
    this.stopMusic();
    this.currentTrackIdx = idx;
    if (this.muted) return;

    const ctx = this.ensureContext();
    if (!ctx) return;

    this.isPlayingMusic = true;
    this.trackStartTime = ctx.currentTime + 0.08;
    this.noteCursor = 0;

    this.schedulerTimer = window.setInterval(() => this.scheduleAhead(), 60);
    this.scheduleAhead();
  }

  stopMusic(): void {
    this.isPlayingMusic = false;
    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  private scheduleAhead(): void {
    if (!this.isPlayingMusic || !this.ctx || !this.musicGain || this.muted) return;
    const track = this.tracks[this.currentTrackIdx];
    if (!track || track.notes.length === 0) return;

    const lookahead = 0.22;
    const now = this.ctx.currentTime;

    while (this.noteCursor < track.notes.length) {
      const [startSec, ch, midiNote, vel, durSec, prog] = track.notes[this.noteCursor];
      const absTime = this.trackStartTime + startSec;
      if (absTime > now + lookahead) break;
      if (absTime >= now - 0.05) {
        if (ch === 9) {
          this.triggerDrum(absTime, midiNote, vel);
        } else {
          this.triggerMelodicNote(absTime, midiNote, vel, durSec, prog);
        }
      }
      this.noteCursor++;
    }

    if (this.noteCursor >= track.notes.length && now >= this.trackStartTime + track.duration) {
      this.trackStartTime = now + 0.25;
      this.noteCursor = 0;
    }
  }

  private triggerMelodicNote(when: number, note: number, vel: number, dur: number, prog: number): void {
    if (!this.ctx || !this.musicGain) return;
    const freq = 440 * Math.pow(2, (note - 69) / 12);
    const amp = (vel / 127) * 0.14;
    const safeDur = Math.min(2.4, Math.max(0.05, dur));

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    // OPL3 / General MIDI inspired timbre mapping
    if (prog >= 32 && prog <= 39) {
      // Bass
      osc.type = 'sawtooth';
      filter.type = 'lowpass';
      filter.frequency.value = 650;
    } else if (prog >= 40 && prog <= 55) {
      // Strings / Choir
      osc.type = 'sawtooth';
      filter.type = 'lowpass';
      filter.frequency.value = 1800;
    } else if (prog >= 56 && prog <= 79) {
      // Brass / Woodwinds
      osc.type = 'square';
      filter.type = 'lowpass';
      filter.frequency.value = 2400;
    } else {
      // Harpsichord / Piano / Fantasy Synth
      osc.type = 'triangle';
      filter.type = 'lowpass';
      filter.frequency.value = 3200;
    }

    osc.frequency.setValueAtTime(freq, when);
    const attack = prog >= 40 && prog <= 55 ? 0.035 : 0.008;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(amp, when + attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, amp * 0.45), when + safeDur);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + safeDur + 0.06);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(when);
    osc.stop(when + safeDur + 0.07);
  }

  private triggerDrum(when: number, note: number, vel: number): void {
    if (!this.ctx || !this.musicGain) return;
    const amp = (vel / 127) * 0.18;
    if (note === 35 || note === 36 || note === 41 || note === 45) {
      // Kick / Low Tom
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note <= 36 ? 135 : 180, when);
      osc.frequency.exponentialRampToValueAtTime(38, when + 0.11);
      g.gain.setValueAtTime(amp * 1.3, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.13);
      osc.connect(g);
      g.connect(this.musicGain);
      osc.start(when);
      osc.stop(when + 0.14);
    } else if (this.noiseBuffer) {
      // Snare / Hi-Hat / Crash
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      const isHat = note === 42 || note === 44 || note === 46;
      filter.type = isHat ? 'highpass' : 'bandpass';
      filter.frequency.value = isHat ? 6500 : 1600;
      const d = note === 49 || note === 57 ? 0.28 : isHat ? 0.05 : 0.12;
      g.gain.setValueAtTime(amp * (isHat ? 0.55 : 0.9), when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + d);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.musicGain);
      src.start(when);
      src.stop(when + d + 0.02);
    }
  }

  playSfx(kind: SfxKind): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    const tone = (freq1: number, freq2: number, dur: number, type: OscillatorType = 'square', delay = 0, vol = 0.18) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq1, now + delay);
      if (freq2 !== freq1) {
        o.frequency.exponentialRampToValueAtTime(freq2, now + delay + dur);
      }
      g.gain.setValueAtTime(vol, now + delay);
      g.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
      o.connect(g);
      g.connect(this.sfxGain!);
      o.start(now + delay);
      o.stop(now + delay + dur + 0.01);
    };

    switch (kind) {
      case 'cursor':
        tone(660, 720, 0.035, 'triangle', 0, 0.09);
        break;
      case 'confirm':
        tone(523, 784, 0.09, 'triangle', 0, 0.15);
        break;
      case 'cancel':
        tone(420, 260, 0.09, 'triangle', 0, 0.14);
        break;
      case 'step':
        tone(180, 120, 0.045, 'sine', 0, 0.12);
        break;
      case 'slash':
        tone(580, 160, 0.11, 'sawtooth', 0, 0.18);
        break;
      case 'hit':
        tone(160, 52, 0.15, 'sawtooth', 0, 0.24);
        break;
      case 'crit':
        tone(880, 220, 0.18, 'sawtooth', 0, 0.26);
        tone(190, 48, 0.22, 'square', 0.04, 0.26);
        break;
      case 'miss':
        tone(340, 620, 0.09, 'sine', 0, 0.12);
        break;
      case 'magic':
        tone(330, 990, 0.26, 'sawtooth', 0, 0.16);
        tone(440, 1320, 0.26, 'triangle', 0.06, 0.14);
        break;
      case 'heal':
        [523, 659, 784, 1046].forEach((f, idx) => tone(f, f, 0.12, 'triangle', idx * 0.06, 0.14));
        break;
      case 'chest':
        [587, 740, 880, 1175].forEach((f, idx) => tone(f, f, 0.13, 'triangle', idx * 0.07, 0.16));
        break;
      case 'levelup':
      case 'fanfare':
        [523, 659, 784, 1046, 784, 1046].forEach((f, idx) =>
          tone(f, f, idx === 5 ? 0.34 : 0.11, 'square', idx * 0.085, 0.15)
        );
        break;
      case 'explosion':
        tone(175, 28, 0.42, 'sawtooth', 0, 0.30);
        tone(110, 22, 0.48, 'square', 0.03, 0.24);
        if (this.noiseBuffer) {
          const src = ctx.createBufferSource();
          src.buffer = this.noiseBuffer;
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(1400, now);
          filter.frequency.exponentialRampToValueAtTime(160, now + 0.48);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.38, now);
          g.gain.exponentialRampToValueAtTime(0.0001, now + 0.50);
          src.connect(filter);
          filter.connect(g);
          g.connect(this.sfxGain);
          src.start(now);
          src.stop(now + 0.52);
        }
        break;
      case 'quake':
        tone(92, 34, 0.55, 'sawtooth', 0, 0.28);
        if (this.noiseBuffer) {
          const src = ctx.createBufferSource();
          src.buffer = this.noiseBuffer;
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 320;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.32, now);
          g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
          src.connect(filter);
          filter.connect(g);
          g.connect(this.sfxGain);
          src.start(now);
          src.stop(now + 0.57);
        }
        break;
    }
  }
}
