import type { MusicTrack, SfxBanksPayload } from '../types';

export type SfxKind =
  | 'cursor'
  | 'click'
  | 'dialogue'
  | 'confirm'
  | 'cancel'
  | 'cross'
  | 'step'
  | 'step_foot'
  | 'step_wing'
  | 'step_horse'
  | 'slash'
  | 'hit'
  | 'crit'
  | 'miss'
  | 'magic'
  | 'chant'
  | 'heal'
  | 'chest'
  | 'levelup'
  | 'fanfare'
  | 'explosion'
  | 'quake'
  | `bank:${number}:${number}`
  | `bank:${number}:${number}:${number}`;

// Verified FD2.EXE GLOBAL_2_9752[0..27] (`Obj2 + 9752`, `fn_117228` walk SFX cadence table by classId 1..28):
//   0 = Robed Mages/Clerics (classId 5,6,13,14,21,22) -> FDOTHER[31][9] every 6 4px sub-steps (1 tile)
//   1 = Infantry/Fighters/Archers/Thieves/Martial Artists/Mechs -> FDOTHER[31][9] every 4 4px sub-steps
//   2 = Cavalry/Knights/Paladins (classId 3,11) -> FDOTHER[31][11] every 9 4px sub-steps
//   3 = Flying classes (classId 15,19; handled by flying check `fn_61827`) -> FDOTHER[31][10] every 6 4px sub-steps
const WALK_TYPE_BY_CLASS: readonly number[] = [
  1, 1, 2, 1, 0, 0, 1, 1, 1, 1, 2, 1, 0, 0,
  3, 1, 1, 1, 3, 1, 0, 0, 1, 1, 1, 1, 1, 1,
];

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private sfxPayload: SfxBanksPayload | null = null;
  private decodedPcmSamples = new Map<string, Float32Array>();
  private pcmAudioBuffers = new Map<string, AudioBuffer>();
  private activeSfxChannels: [AudioBufferSourceNode | null, AudioBufferSourceNode | null] = [null, null];

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

  setSfxBanks(payload: SfxBanksPayload | null): void {
    this.sfxPayload = payload;
    this.decodedPcmSamples.clear();
    this.pcmAudioBuffers.clear();
    if (!payload) return;
    for (const [hash, b64] of Object.entries(payload.samples)) {
      const bin = atob(b64);
      const len = bin.length;
      const f32 = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        // Unsigned 8-bit PCM centered at 0x80 (128) -> [-1.0, +1.0]
        f32[i] = (bin.charCodeAt(i) - 128) / 128.0;
      }
      this.decodedPcmSamples.set(hash, f32);
    }
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

  /**
   * Plays an authentic 11,025 Hz 8-bit unsigned PCM sample from `FDOTHER.DAT[bankChunkId][subIdx]`,
   * matching FD2.EXE `fn_88726(bank, subIdx, 1)` (channel 0) and `fn_88901(bank, subIdx, 1)` (channel 1).
   */
  playBankSfx(bankChunkId: number, subIdx: number, channel: 0 | 1 = 0): boolean {
    if (this.muted || !this.sfxPayload) return false;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return false;

    const prev = this.activeSfxChannels[channel];
    if (prev) {
      try {
        prev.stop();
      } catch {
        // Ignore if already stopped
      }
      this.activeSfxChannels[channel] = null;
    }
    if (subIdx < 0) return true;

    const bank = this.sfxPayload.banks[String(bankChunkId)];
    if (!bank || subIdx >= bank.length) return false;
    const hash = bank[subIdx];
    if (!hash) return false;

    let audioBuf = this.pcmAudioBuffers.get(hash);
    if (!audioBuf) {
      const f32 = this.decodedPcmSamples.get(hash);
      if (!f32 || f32.length === 0) return false;
      const sr = this.sfxPayload.sampleRate || 11025;
      audioBuf = ctx.createBuffer(1, f32.length, sr);
      audioBuf.getChannelData(0).set(f32);
      this.pcmAudioBuffers.set(hash, audioBuf);
    }

    const src = ctx.createBufferSource();
    src.buffer = audioBuf;
    src.connect(this.sfxGain);
    this.activeSfxChannels[channel] = src;
    src.onended = () => {
      if (this.activeSfxChannels[channel] === src) {
        this.activeSfxChannels[channel] = null;
      }
    };
    src.start(ctx.currentTime);
    return true;
  }

  /**
   * Replicates FD2.EXE `fn_117228` (`L117228..L117462`): plays the exact unit movement sound
   * (`FDOTHER[31][9]` footstep, `FDOTHER[31][10]` wing flap, or `FDOTHER[31][11]` horse gallop)
   * on the exact `4px` sub-step cadence (`GLOBAL_2_16638`).
   */
  playUnitWalkStepSfx(
    unit: { uid: number; classId: number; raceId?: number; moveMode?: 'foot' | 'cavalry' | 'fly' },
    subStepCounter: number
  ): void {
    const isFlying =
      unit.moveMode === 'fly' ||
      unit.classId === 15 ||
      unit.classId === 19 ||
      ((unit.raceId === 4 || unit.raceId === 5) && unit.uid !== 28);
    if (isFlying) {
      if (subStepCounter % 6 === 0) {
        this.playSfx('step_wing');
      }
      return;
    }
    const walkType = WALK_TYPE_BY_CLASS[unit.classId - 1] ?? 1;
    if (walkType === 0) {
      // Robed Mage / Cleric (classId 5, 6, 13, 14, 21, 22): every 6 sub-steps (1 tile)
      if (subStepCounter % 6 === 0) {
        this.playSfx('step_foot');
      }
    } else if (walkType === 2 || unit.moveMode === 'cavalry') {
      // Cavalry / Knight / Paladin (classId 3, 11): every 9 sub-steps (1.5 tiles)
      if (subStepCounter % 9 === 0) {
        this.playSfx('step_horse');
      }
    } else {
      // Infantry / Fighter / Archer / Thief / Martial Artist / Mech: every 4 sub-steps
      if (subStepCounter % 4 === 0) {
        this.playSfx('step_foot');
      }
    }
  }

  playSfx(kind: SfxKind): void {
    if (this.muted) return;
    if (kind.startsWith('bank:')) {
      const parts = kind.split(':');
      const bankId = Number(parts[1]);
      const subIdx = Number(parts[2]);
      const ch = parts[3] === '1' ? 1 : 0;
      if (!Number.isNaN(bankId) && !Number.isNaN(subIdx)) {
        this.playBankSfx(bankId, subIdx, ch);
      }
      return;
    }

    if (this.sfxPayload) {
      switch (kind) {
        case 'cursor':
          if (this.playBankSfx(31, 0)) return;
          break;
        case 'click':
          if (this.playBankSfx(31, 7)) return;
          break;
        case 'dialogue':
          if (this.playBankSfx(31, 2)) return;
          break;
        case 'confirm':
          if (this.playBankSfx(31, 5)) return;
          break;
        case 'cancel':
          if (this.playBankSfx(31, 6)) return;
          break;
        case 'cross':
          if (this.playBankSfx(31, 8)) return;
          break;
        case 'step':
        case 'step_foot':
          if (this.playBankSfx(31, 9)) return;
          break;
        case 'step_wing':
          if (this.playBankSfx(31, 10)) return;
          break;
        case 'step_horse':
          if (this.playBankSfx(31, 11)) return;
          break;
        case 'chest':
          if (this.playBankSfx(31, 12)) return;
          break;
        case 'explosion':
          if (this.playBankSfx(31, 3)) return;
          break;
        case 'heal':
          if (this.playBankSfx(31, 4)) return;
          break;
        case 'slash':
          if (this.playBankSfx(52, 1)) return;
          break;
        case 'hit':
          if (this.playBankSfx(49, 1)) return;
          break;
        case 'crit':
          if (this.playBankSfx(52, 4)) return;
          break;
        case 'miss':
          if (this.playBankSfx(52, 0)) return;
          break;
        case 'magic':
          if (this.playBankSfx(80, 1)) return;
          break;
        case 'chant':
          if (this.playBankSfx(82, 0)) return;
          break;
        case 'levelup':
        case 'fanfare':
          if (this.playBankSfx(80, 11)) return;
          break;
        case 'quake':
          if (this.playBankSfx(85, 1)) return;
          break;
      }
    }

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
