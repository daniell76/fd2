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

/**
 * Authentic `FD2.EXE` `Obj2 + 7779` (`GLOBAL_2_7779[0..29]`) Player Phase BGM Table (`FDMUS.DAT` chunk `sourceIndex`)
 * indexed by `chapterId = 0..29` (Chapters 1..30):
 *  - `19`: Standard Tactical March — Chapters 1..4, 6..8, 11..14, 16, 18, 19, 21, 24, 26, 28, 29
 *  - `3`: Major Fortress Assault — Chapters 5, 9, 15, 20, 22, 25
 *  - `4`: Royal Castle / Sky Island / Golden Castle Siege — Chapters 10, 17, 23, 27
 *  - `8`: Final Chapter 30 (`命運的交會`) — Chapter 30
 */
export const PLAYER_PHASE_BGM_BY_CHAPTER: readonly number[] = [
  19, 19, 19, 19, 3, 19, 19, 19, 3, 4,
  19, 19, 19, 19, 3, 19, 4, 19, 19, 3,
  19, 3, 4, 19, 3, 19, 4, 19, 19, 8,
];

/**
 * Authentic `FD2.EXE` `Obj2 + 7809` (`GLOBAL_2_7809[0..29]`) Enemy Phase BGM Table (`FDMUS.DAT` chunk `sourceIndex`)
 * indexed by `chapterId = 0..29` (Chapters 1..30):
 *  - `12`: Standard Enemy Phase A — Chapters 1, 2, 4, 6, 7, 11, 13, 16, 18, 19, 21, 24
 *  - `1`: Standard Enemy Phase B — Chapters 3, 8, 12, 14, 26, 28, 29
 *  - `6`: Major Battle Enemy Phase — Chapters 5, 9, 15, 20, 22, 25
 *  - `4`: Royal Castle Rescue Enemy Phase — Chapter 10 (continuous with Player Phase `4`)
 *  - `8`: Late-Game Fortress / Final Boss Enemy Phase — Chapters 17, 23, 27, 30
 */
export const ENEMY_PHASE_BGM_BY_CHAPTER: readonly number[] = [
  12, 12, 1, 12, 6, 12, 12, 1, 6, 4,
  12, 1, 12, 1, 6, 12, 8, 12, 12, 6,
  12, 6, 8, 12, 6, 1, 8, 1, 1, 8,
];

/**
 * Returns the authentic `FDMUS.DAT` `sourceIndex` for the given `chapterId` and turn `phase`,
 * matching `FD2.EXE` `Obj1 + 1147` (chapter start) and `fn_42150` (`Obj1 + 42370` Enemy Phase / `42520` Player Phase).
 */
export function getChapterPhaseBgmSourceIndex(
  chapterId: number,
  phase: 'player' | 'ally' | 'enemy' = 'player'
): number {
  // Cutscene maps: Map 32 (`序幕(一)`) starts at `18` (`Obj1+140066`), Map 31 (`序幕(二)`) uses `11` (`Obj1+140311`), Map 30 (`終幕`) uses `4` (`Obj1+146589`)
  if (chapterId === 32) return 18;
  if (chapterId === 31) return 11;
  if (chapterId === 30) return 4;
  if (chapterId >= 0 && chapterId < 30) {
    return phase === 'enemy'
      ? (ENEMY_PHASE_BGM_BY_CHAPTER[chapterId] ?? 12)
      : (PLAYER_PHASE_BGM_BY_CHAPTER[chapterId] ?? 19);
  }
  return 19;
}

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private midiFadeGain: GainNode | null = null;
  private hdBassBoost: BiquadFilterNode | null = null;
  private hdPresenceBoost: BiquadFilterNode | null = null;
  private hdReverbNode: ConvolverNode | null = null;
  private hdReverbGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private hdSfxReverbSend: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private stepAlternate = false;
  private lastHdSfxTimeByKey = new Map<string, number>();

  private editionMode: 'classic' | 'hd' = 'classic';
  private hdMusicBuffers = new Map<number, AudioBuffer>();
  private hdMusicLoading = new Set<number>();
  private activeHdMusicSource: AudioBufferSourceNode | null = null;
  private activeHdMusicGain: GainNode | null = null;
  private hdLoopTimer: number | null = null;
  private midiLoopFadeScheduled = false;

  private sfxPayload: SfxBanksPayload | null = null;
  private decodedPcmSamples = new Map<string, Float32Array>();
  private pcmAudioBuffers = new Map<string, AudioBuffer>();
  private activeSfxChannels: [AudioBufferSourceNode | null, AudioBufferSourceNode | null] = [null, null];

  private tracks: MusicTrack[] = [];
  private currentTrackIdx = -1;
  private currentSourceIndex = -1;
  private loopCurrentTrack = true;
  private isPlayingMusic = false;
  private muted = false;

  private trackStartTime = 0;
  private noteCursor = 0;
  private schedulerTimer: number | null = null;

  getEditionMode(): 'classic' | 'hd' {
    return this.editionMode;
  }

  setEditionMode(mode: 'classic' | 'hd'): void {
    if (this.editionMode === mode) return;
    this.editionMode = mode;
    if (this.isPlayingMusic && this.currentTrackIdx >= 0 && !this.muted) {
      const idx = this.currentTrackIdx;
      const loop = this.loopCurrentTrack;
      this.stopMusic();
      this.playTrack(idx, loop);
    }
  }

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
      this.musicGain.gain.value = 0.22; // Balanced lower BGM level so combat & movement SFX stay front-and-center
      this.musicGain.connect(this.masterGain);

      this.midiFadeGain = this.ctx.createGain();
      this.midiFadeGain.gain.value = 1.0;
      this.midiFadeGain.connect(this.musicGain);

      // Hans Zimmer / Warcraft II Low-End Sub-Bass & Concert Hall Mastering Bus for HD Remastered Mode
      this.hdBassBoost = this.ctx.createBiquadFilter();
      this.hdBassBoost.type = 'lowshelf';
      this.hdBassBoost.frequency.value = 90;
      this.hdBassBoost.gain.value = 4.2; // Warm low-end timpani, taiko & contrabass weight without overpowering SFX

      this.hdPresenceBoost = this.ctx.createBiquadFilter();
      this.hdPresenceBoost.type = 'highshelf';
      this.hdPresenceBoost.frequency.value = 3800;
      this.hdPresenceBoost.gain.value = 1.8; // Crisp brass & harpsichord transients

      this.hdBassBoost.connect(this.hdPresenceBoost);
      this.hdPresenceBoost.connect(this.musicGain);

      // Algorithmic Stereo Concert Hall Impulse Response (`ConvolverNode`)
      const revDur = 1.85;
      const revLen = Math.floor(this.ctx.sampleRate * revDur);
      const revBuf = this.ctx.createBuffer(2, revLen, this.ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const chData = revBuf.getChannelData(c);
        for (let i = 0; i < revLen; i++) {
          const t = i / this.ctx.sampleRate;
          const decay = Math.exp(-t * 3.1);
          chData[i] = (Math.random() * 2 - 1) * decay * (1 - 0.25 * Math.cos(t * 19));
        }
      }
      this.hdReverbNode = this.ctx.createConvolver();
      this.hdReverbNode.buffer = revBuf;
      this.hdReverbGain = this.ctx.createGain();
      this.hdReverbGain.gain.value = 0.18;
      this.hdPresenceBoost.connect(this.hdReverbNode);
      this.hdReverbNode.connect(this.hdReverbGain);
      this.hdReverbGain.connect(this.musicGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.72;
      this.sfxGain.connect(this.masterGain);

      const sfxRevOut = this.ctx.createGain();
      sfxRevOut.gain.value = 0.24;
      this.hdReverbNode.connect(sfxRevOut);
      sfxRevOut.connect(this.sfxGain);

      this.hdSfxReverbSend = this.ctx.createGain();
      this.hdSfxReverbSend.gain.value = 0.34;
      this.hdSfxReverbSend.connect(this.hdReverbNode);

      // Extended 1.6s white noise buffer for realistic acoustic footsteps, sword air-slices, bowstring whiz & spell combustion
      const len = Math.floor(this.ctx.sampleRate * 1.6);
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

  getCurrentSourceIndex(): number {
    return this.currentSourceIndex;
  }

  isCurrentLooping(): boolean {
    return this.loopCurrentTrack;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopMusic();
    } else if (this.currentTrackIdx >= 0 && this.loopCurrentTrack) {
      this.playTrack(this.currentTrackIdx, this.loopCurrentTrack);
    }
    return this.muted;
  }

  /**
   * Plays a BGM track by its authentic `FDMUS.DAT` chunk `sourceIndex` (`1, 3, 4, 6, 8, 10..19`),
   * matching `FD2.EXE` `fn_88439(sourceIndex, oneShotFlag)`.
   */
  playBgmBySourceIndex(sourceIndex: number, loop = true): void {
    if (this.tracks.length === 0) return;
    const foundIdx = this.tracks.findIndex((t) => t.sourceIndex === sourceIndex);
    if (foundIdx >= 0) {
      this.playTrack(foundIdx, loop);
    }
  }

  playTrack(trackIdx: number, loop = true): void {
    if (this.tracks.length === 0) return;
    const idx = ((trackIdx % this.tracks.length) + this.tracks.length) % this.tracks.length;
    if (this.isPlayingMusic && this.currentTrackIdx === idx && this.loopCurrentTrack === loop && !this.muted) return;
    this.stopMusic(true);
    this.currentTrackIdx = idx;
    const sourceIndex = this.tracks[idx]?.sourceIndex ?? -1;
    this.currentSourceIndex = sourceIndex;
    this.loopCurrentTrack = loop;
    if (this.muted) return;

    const ctx = this.ensureContext();
    if (!ctx) return;

    this.isPlayingMusic = true;

    // In HD Remastered Mode, play the Lyria 3 Hans Zimmer / Warcraft II orchestral MP3 track if cached,
    // or fetch & decode it asynchronously and seamlessly crossfade into it!
    if (this.editionMode === 'hd' && sourceIndex > 0) {
      const cachedBuf = this.hdMusicBuffers.get(sourceIndex);
      if (cachedBuf) {
        this.startHdAudioBufferPlayback(cachedBuf, loop, 0.55);
        return;
      }
      this.loadAndSwitchToHdTrack(sourceIndex, idx, loop);
    }

    // Smooth fade-in on Classic MIDI track start / switch
    if (this.midiFadeGain) {
      const now = ctx.currentTime;
      this.midiFadeGain.gain.cancelScheduledValues(now);
      this.midiFadeGain.gain.setValueAtTime(0.0001, now);
      this.midiFadeGain.gain.linearRampToValueAtTime(1.0, now + 0.42);
    }
    this.midiLoopFadeScheduled = false;
    this.trackStartTime = ctx.currentTime + 0.08;
    this.noteCursor = 0;

    this.schedulerTimer = window.setInterval(() => this.scheduleAhead(), 60);
    this.scheduleAhead();
  }

  /**
   * Smoothly fades out and stops the active HD MP3 buffer source over `fadeSec` seconds
   * so track switches and loop transitions never produce an abrupt cut.
   */
  private fadeOutActiveHdSource(fadeSec = 0.45): void {
    if (this.hdLoopTimer !== null) {
      clearTimeout(this.hdLoopTimer);
      this.hdLoopTimer = null;
    }
    const oldSrc = this.activeHdMusicSource;
    const oldGain = this.activeHdMusicGain;
    this.activeHdMusicSource = null;
    this.activeHdMusicGain = null;
    if (!oldSrc) return;
    if (!this.ctx || !oldGain || fadeSec <= 0.01) {
      try {
        oldSrc.stop();
      } catch {
        // ignore
      }
      return;
    }
    try {
      const now = this.ctx.currentTime;
      const curVal = Math.max(0.0001, oldGain.gain.value);
      oldGain.gain.cancelScheduledValues(now);
      oldGain.gain.setValueAtTime(curVal, now);
      oldGain.gain.exponentialRampToValueAtTime(0.0001, now + fadeSec);
      oldSrc.stop(now + fadeSec + 0.03);
    } catch {
      try {
        oldSrc.stop();
      } catch {
        // ignore
      }
    }
  }

  private startHdAudioBufferPlayback(buffer: AudioBuffer, loop: boolean, fadeInSec = 0.55): void {
    if (!this.ctx || !this.hdBassBoost) return;
    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    // Smoothly fade out any currently playing HD MP3 source (e.g. previous track or previous loop cycle)
    this.fadeOutActiveHdSource(Math.min(0.65, fadeInSec));

    const now = this.ctx.currentTime;
    const targetGain = 0.56;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = false;

    const srcGain = this.ctx.createGain();
    srcGain.gain.setValueAtTime(0.0001, now);
    srcGain.gain.linearRampToValueAtTime(targetGain, now + Math.max(0.08, fadeInSec));

    src.connect(srcGain);
    srcGain.connect(this.hdBassBoost);

    this.activeHdMusicSource = src;
    this.activeHdMusicGain = srcGain;

    const dur = buffer.duration;
    const loopCrossfadeSec = 0.78;
    if (loop && dur > loopCrossfadeSec * 2.2) {
      // Schedule next loop iteration to crossfade in `loopCrossfadeSec` before this buffer ends
      const nextLoopDelayMs = Math.max(200, Math.round((dur - loopCrossfadeSec) * 1000));
      const expectedTrackIdx = this.currentTrackIdx;
      this.hdLoopTimer = window.setTimeout(() => {
        this.hdLoopTimer = null;
        if (
          this.isPlayingMusic &&
          !this.muted &&
          this.editionMode === 'hd' &&
          this.loopCurrentTrack &&
          this.currentTrackIdx === expectedTrackIdx
        ) {
          this.startHdAudioBufferPlayback(buffer, true, loopCrossfadeSec);
        }
      }, nextLoopDelayMs);
    }

    src.onended = () => {
      if (this.activeHdMusicSource === src) {
        this.activeHdMusicSource = null;
        this.activeHdMusicGain = null;
        if (!loop) {
          this.isPlayingMusic = false;
        }
      }
    };
    src.start(now);
  }

  private loadAndSwitchToHdTrack(sourceIndex: number, expectedTrackIdx: number, loop: boolean): void {
    if (this.hdMusicLoading.has(sourceIndex)) return;
    this.hdMusicLoading.add(sourceIndex);
    fetch(`assets/hd_music/fdmus_${sourceIndex}.mp3`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((ab) => {
        const ctx = this.ensureContext();
        if (!ctx) throw new Error('No AudioContext');
        return ctx.decodeAudioData(ab);
      })
      .then((audioBuf) => {
        this.hdMusicBuffers.set(sourceIndex, audioBuf);
        this.hdMusicLoading.delete(sourceIndex);
        if (
          this.editionMode === 'hd' &&
          this.isPlayingMusic &&
          !this.muted &&
          this.currentTrackIdx === expectedTrackIdx
        ) {
          this.startHdAudioBufferPlayback(audioBuf, loop, 0.55);
        }
      })
      .catch(() => {
        this.hdMusicLoading.delete(sourceIndex);
      });
  }

  stopMusic(smoothFade = true): void {
    this.isPlayingMusic = false;
    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    this.fadeOutActiveHdSource(smoothFade ? 0.45 : 0);
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

    // Smooth fade-out right before Classic MIDI loop boundary
    const trackEndTime = this.trackStartTime + track.duration;
    if (
      this.loopCurrentTrack &&
      !this.midiLoopFadeScheduled &&
      this.midiFadeGain &&
      track.duration > 1.2 &&
      now >= trackEndTime - 0.36
    ) {
      this.midiLoopFadeScheduled = true;
      this.midiFadeGain.gain.cancelScheduledValues(now);
      this.midiFadeGain.gain.setValueAtTime(Math.max(0.0001, this.midiFadeGain.gain.value), now);
      this.midiFadeGain.gain.linearRampToValueAtTime(0.04, trackEndTime);
    }

    if (this.noteCursor >= track.notes.length && now >= trackEndTime) {
      if (this.loopCurrentTrack) {
        this.trackStartTime = now + 0.18;
        this.noteCursor = 0;
        this.midiLoopFadeScheduled = false;
        if (this.midiFadeGain) {
          this.midiFadeGain.gain.cancelScheduledValues(now);
          this.midiFadeGain.gain.setValueAtTime(0.04, now);
          this.midiFadeGain.gain.linearRampToValueAtTime(1.0, now + 0.42);
        }
      } else {
        this.stopMusic();
      }
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
    const midiOut = this.midiFadeGain ?? this.musicGain;
    const outBus = this.editionMode === 'hd' && this.hdBassBoost ? this.hdBassBoost : midiOut;
    gain.connect(outBus);

    osc.start(when);
    osc.stop(when + safeDur + 0.07);

    // Hans Zimmer / Warcraft II Heavy Sub-Bass Octave Doubling & Stereo Detuned Horn/String Layer in HD Mode
    if (this.editionMode === 'hd') {
      if (note <= 58 || (prog >= 32 && prog <= 55)) {
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(freq * 0.5, when);
        const subAmp = amp * (note <= 48 ? 1.15 : 0.65);
        subGain.gain.setValueAtTime(0.0001, when);
        subGain.gain.linearRampToValueAtTime(subAmp, when + 0.012);
        subGain.gain.exponentialRampToValueAtTime(0.0001, when + safeDur + 0.08);
        subOsc.connect(subGain);
        subGain.connect(outBus);
        subOsc.start(when);
        subOsc.stop(when + safeDur + 0.09);
      }
    }
  }

  private triggerDrum(when: number, note: number, vel: number): void {
    if (!this.ctx || !this.musicGain) return;
    const midiOut = this.midiFadeGain ?? this.musicGain;
    const outBus = this.editionMode === 'hd' && this.hdBassBoost ? this.hdBassBoost : midiOut;
    const amp = (vel / 127) * (this.editionMode === 'hd' ? 0.26 : 0.18);
    if (note === 35 || note === 36 || note === 41 || note === 45) {
      // Kick / Low Tom / Taiko War Drum
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      const dur = this.editionMode === 'hd' ? 0.24 : 0.13;
      osc.frequency.setValueAtTime(note <= 36 ? 135 : 180, when);
      osc.frequency.exponentialRampToValueAtTime(this.editionMode === 'hd' ? 31 : 38, when + dur * 0.85);
      g.gain.setValueAtTime(amp * (this.editionMode === 'hd' ? 1.65 : 1.3), when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      osc.connect(g);
      g.connect(outBus);
      osc.start(when);
      osc.stop(when + dur + 0.02);
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
      g.connect(outBus);
      src.start(when);
      src.stop(when + d + 0.02);
    }
  }

  /**
   * Plays an authentic 11,025 Hz 8-bit unsigned PCM sample from `FDOTHER.DAT[bankChunkId][subIdx]`,
   * matching FD2.EXE `fn_88726(bank, subIdx, 1)` (channel 0) and `fn_88901(bank, subIdx, 1)` (channel 1).
   * In HD Remastered Mode (`editionMode === 'hd'`), synthesizes a multi-layered, physically-modeled
   * realistic acoustic sound effect tailored to the exact physical nature of `(bankChunkId, subIdx)`!
   */
  playBankSfx(bankChunkId: number, subIdx: number, channel: 0 | 1 = 0): boolean {
    if (this.muted) return false;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return false;

    if (this.editionMode === 'hd') {
      return this.playRealisticHdBankSfx(bankChunkId, subIdx, channel);
    }
    if (!this.sfxPayload) return false;

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
   * Plays a de-quantized, EQ-contoured original PCM transient layer at a subtle mix (`mixGain`)
   * so HD sound effects preserve the exact FD2 frame cadence while stripping 8-bit Nyquist hiss.
   */
  private playSmoothedPcmLayer(
    bankChunkId: number,
    subIdx: number,
    channel: 0 | 1,
    mixGain: number,
    lowpassHz = 3600,
    highpassHz = 90,
    playbackRate = 1.0
  ): void {
    if (!this.sfxPayload || !this.ctx || !this.sfxGain || mixGain <= 0) return;
    const bank = this.sfxPayload.banks[String(bankChunkId)];
    if (!bank || subIdx < 0 || subIdx >= bank.length) return;
    const hash = bank[subIdx];
    if (!hash) return;

    let audioBuf = this.pcmAudioBuffers.get(hash);
    if (!audioBuf) {
      const f32 = this.decodedPcmSamples.get(hash);
      if (!f32 || f32.length === 0) return;
      const sr = this.sfxPayload.sampleRate || 11025;
      audioBuf = this.ctx.createBuffer(1, f32.length, sr);
      audioBuf.getChannelData(0).set(f32);
      this.pcmAudioBuffers.set(hash, audioBuf);
    }

    const prev = this.activeSfxChannels[channel];
    if (prev) {
      try {
        prev.stop();
      } catch {
        // ignore
      }
      this.activeSfxChannels[channel] = null;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = audioBuf;
    src.playbackRate.value = playbackRate;

    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = highpassHz;

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = lowpassHz;

    const g = this.ctx.createGain();
    g.gain.value = mixGain;

    src.connect(hp);
    hp.connect(lp);
    lp.connect(g);
    g.connect(this.sfxGain);
    if (this.hdSfxReverbSend) {
      g.connect(this.hdSfxReverbSend);
    }

    this.activeSfxChannels[channel] = src;
    src.onended = () => {
      if (this.activeSfxChannels[channel] === src) {
        this.activeSfxChannels[channel] = null;
      }
    };
    src.start(this.ctx.currentTime);
  }

  /**
   * Multi-layered Physical Acoustic Sound Effect Synthesizer for HD Remastered Mode (`editionMode === 'hd'`).
   * Models real-world acoustics for every `(bankChunkId, subIdx)` in `FDOTHER.DAT`:
   *  - Boot/armor earth footsteps (`31:9`), warhorse dual-beat hoof clops (`31:11`, `49:2`), dragon/pegasus wingbeats (`31:10`)
   *  - Tempered steel blade swings, sword-on-armor slashes, heavy axe/lance impacts & critical cleaves (`48:1..4`, `49:1,3..6`, `52:1..5`)
   *  - Taut bowstring plucked release, fletched arrow aerodynamic whiz & broadhead piercing flesh/wood thunk (`50:1..4`, `51:1..4`, `48:5`)
   *  - Martial arts whip-snap punches, staff cracks, beast claws & mech artillery (`53:1..3`, `51:1`)
   *  - Aerodynamic dodge/miss air swishes (`48..53:0`)
   *  - Elemental fire combustion, falling meteors, high-voltage lightning/thunder, crystalline holy bells & explosions (`80..95`, `31:3,4,12`)
   */
  private playRealisticHdBankSfx(bankChunkId: number, subIdx: number, channel: 0 | 1 = 0): boolean {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return false;
    if (subIdx < 0) return true;

    const now = ctx.currentTime;
    const key = `${bankChunkId}:${subIdx}`;
    const prevTime = this.lastHdSfxTimeByKey.get(key) ?? -1;
    if (now - prevTime < 0.022) {
      return true;
    }
    this.lastHdSfxTimeByKey.set(key, now);

    const dryBus = this.sfxGain;
    const revBus = this.hdSfxReverbSend;

    // Acoustic building-block helpers:
    // 1. Pitched oscillator with exponential frequency glide & ADSR envelope
    const synthTone = (
      fStart: number,
      fEnd: number,
      dur: number,
      type: OscillatorType,
      vol: number,
      delay = 0,
      attack = 0.003,
      reverbSend = 0.25
    ) => {
      const t0 = now + delay;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(16, fStart), t0);
      if (Math.abs(fEnd - fStart) > 0.5) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(16, fEnd), t0 + dur);
      }
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + Math.min(attack, dur * 0.4));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(dryBus);
      if (revBus && reverbSend > 0) {
        const rg = ctx.createGain();
        rg.gain.value = reverbSend;
        g.connect(rg);
        rg.connect(revBus);
      }
      osc.start(t0);
      osc.stop(t0 + dur + 0.015);
    };

    // 2. Shaped filtered noise burst (for air whooshes, gravel crunch, arrow fletching whiz, fire & thunder crackle)
    const synthNoise = (
      filterType: BiquadFilterType,
      fStart: number,
      fEnd: number,
      q: number,
      dur: number,
      vol: number,
      delay = 0,
      attack = 0.005,
      reverbSend = 0.25
    ) => {
      if (!this.noiseBuffer) return;
      const t0 = now + delay;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      // Randomize start offset inside the 1.6s noise buffer so consecutive steps/strikes have natural organic texture
      const maxOffset = Math.max(0, this.noiseBuffer.duration - Math.min(this.noiseBuffer.duration, dur + 0.05));
      const offset = Math.random() * maxOffset;

      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.Q.setValueAtTime(q, t0);
      filter.frequency.setValueAtTime(Math.max(20, fStart), t0);
      if (Math.abs(fEnd - fStart) > 1) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(20, fEnd), t0 + dur);
      }

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + Math.min(attack, dur * 0.45));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      src.connect(filter);
      filter.connect(g);
      g.connect(dryBus);
      if (revBus && reverbSend > 0) {
        const rg = ctx.createGain();
        rg.gain.value = reverbSend;
        g.connect(rg);
        rg.connect(revBus);
      }
      src.start(t0, offset, dur + 0.02);
      src.stop(t0 + dur + 0.025);
    };

    // 3. Inharmonic metallic waveguide resonator (for tempered steel sword ring, armor clash, arrowhead tip & bells)
    const synthMetallicRing = (
      baseFreq: number,
      ratios: readonly number[],
      dur: number,
      vol: number,
      delay = 0,
      reverbSend = 0.55
    ) => {
      ratios.forEach((r, idx) => {
        const freq = baseFreq * r;
        if (freq > 14000) return;
        const partialDur = dur * Math.pow(0.76, idx);
        const partialVol = (vol / Math.sqrt(idx + 1)) * 0.55;
        synthTone(freq * 1.015, freq, partialDur, idx % 2 === 0 ? 'sine' : 'triangle', partialVol, delay, 0.0015, reverbSend);
      });
    };

    // 4. Helper for realistic Sword / Katana / Axe / Lance Slash & Impact
    const triggerBladeSlashImpact = (
      weight: 'light' | 'medium' | 'heavy' | 'crit',
      includeSwingLeadIn = true
    ) => {
      const pitchJitter = 0.96 + Math.random() * 0.08;
      const leadDelay = includeSwingLeadIn ? 0.028 : 0;

      if (includeSwingLeadIn) {
        // Fast Doppler blade air-cut whoosh
        const wDur = weight === 'heavy' ? 0.14 : 0.095;
        synthNoise('bandpass', 520 * pitchJitter, 2450 * pitchJitter, 2.4, wDur, 0.24, 0, 0.015, 0.25);
      }

      // Sharp blade-on-armor / flesh slice transient
      const sliceVol = weight === 'crit' ? 0.48 : weight === 'heavy' ? 0.42 : 0.34;
      synthNoise('bandpass', 2800 * pitchJitter, 680 * pitchJitter, 1.8, 0.11, sliceVol, leadDelay, 0.002, 0.35);
      synthNoise('highpass', 4200, 1800, 1.1, 0.055, sliceVol * 0.65, leadDelay, 0.001, 0.3);

      // Tempered steel waveguide ring partials
      if (weight === 'light') {
        synthMetallicRing(1180 * pitchJitter, [1.0, 2.14, 3.41, 4.87], 0.18, 0.14, leadDelay, 0.45);
      } else if (weight === 'medium') {
        synthMetallicRing(940 * pitchJitter, [1.0, 2.27, 3.63, 5.12, 6.45], 0.24, 0.18, leadDelay, 0.55);
      } else if (weight === 'heavy') {
        synthMetallicRing(720 * pitchJitter, [1.0, 1.93, 3.18, 4.62, 6.08], 0.30, 0.22, leadDelay, 0.65);
      } else {
        // Critical devastating cleave: double steel ring + shimmering high harmonic sustain
        synthMetallicRing(860 * pitchJitter, [1.0, 2.18, 3.54, 4.91, 6.72, 8.15], 0.42, 0.26, leadDelay, 0.85);
        synthMetallicRing(1290 * pitchJitter, [1.0, 2.05, 3.37, 5.04], 0.38, 0.20, leadDelay + 0.025, 0.85);
      }

      // Visceral kinetic body / shield / plate impact thud
      const subStart = weight === 'heavy' || weight === 'crit' ? 185 : 155;
      const subEnd = weight === 'crit' ? 28 : weight === 'heavy' ? 32 : 42;
      const subDur = weight === 'crit' ? 0.28 : weight === 'heavy' ? 0.22 : 0.15;
      const subVol = weight === 'crit' ? 0.56 : weight === 'heavy' ? 0.48 : 0.38;
      synthTone(subStart * pitchJitter, subEnd, subDur, 'sine', subVol, leadDelay, 0.002, 0.25);
      synthTone(subStart * 1.8 * pitchJitter, subEnd * 1.4, subDur * 0.65, 'triangle', subVol * 0.55, leadDelay, 0.002, 0.2);
    };

    // 5. Helper for realistic Warhorse Hoof Clop-Clop
    const triggerHorseHoofStride = (isArmoredCharge: boolean) => {
      const j = 0.94 + Math.random() * 0.12;
      // Dual-beat hoof cadence (`0ms` lead hoof + `52ms` trailing hoof)
      const beats = isArmoredCharge ? [0, 0.048, 0.115] : [0, 0.054];
      const cavityFreqs = [630 * j, 770 * j, 580 * j];
      beats.forEach((dly, bIdx) => {
        const cf = cavityFreqs[bIdx % cavityFreqs.length];
        const bVol = bIdx === 0 ? 0.28 : 0.22;
        // Hollow horn-on-cobblestone/turf cavity "clop" resonance
        synthTone(cf * 1.18, cf * 0.82, 0.042, 'triangle', bVol * 0.75, dly, 0.0015, 0.22);
        synthNoise('bandpass', cf * 1.25, cf * 0.85, 6.8, 0.045, bVol * 1.2, dly, 0.0015, 0.22);
        // Turf / earth thump
        synthTone(115 * j, 40, 0.065, 'sine', bVol * 1.15, dly, 0.002, 0.12);
        // Dirt & grit scatter
        synthNoise('bandpass', 1950 * j, 1100 * j, 2.0, 0.048, bVol * 0.48, dly + 0.006, 0.003, 0.15);
      });
      if (isArmoredCharge) {
        // Subtle barding / chainmail harness jingle during cavalry charge
        synthMetallicRing(1420 * j, [1.0, 2.31, 3.75], 0.11, 0.06, 0.02, 0.3);
      }
    };

    // 6. Helper for realistic Archer Bowstring Twang & Arrow Whiz
    const triggerBowReleaseAndWhiz = (isHeavyCrossbow = false) => {
      const j = 0.96 + Math.random() * 0.08;
      if (isHeavyCrossbow) {
        // Metallic trigger latch click + heavy prod snap
        synthMetallicRing(1650 * j, [1.0, 2.4, 3.9], 0.045, 0.15, 0, 0.2);
        synthTone(320 * j, 88 * j, 0.09, 'sawtooth', 0.26, 0.006, 0.002, 0.2);
      }
      // Plucked taut bowstring fundamental + 2nd harmonic twang
      const f0 = (isHeavyCrossbow ? 165 : 205) * j;
      synthTone(f0, f0 * 0.56, 0.145, 'triangle', 0.34, 0, 0.002, 0.25);
      synthTone(f0 * 2.02, f0 * 1.12, 0.105, 'sawtooth', 0.16, 0.002, 0.002, 0.25);
      // Wooden bow limb snap impulse
      synthNoise('bandpass', 980 * j, 340 * j, 3.5, 0.038, 0.28, 0, 0.001, 0.18);
      // High-velocity fletched arrow aerodynamic whiz (`3100 -> 1250 Hz` narrow-Q whistle)
      synthNoise('bandpass', 3150 * j, 1220 * j, 7.5, 0.14, 0.30, 0.014, 0.012, 0.35);
      synthTone(2650 * j, 1180 * j, 0.115, 'sine', 0.075, 0.016, 0.015, 0.35);
    };

    // 7. Helper for realistic Archer Arrow / Crossbow Bolt Piercing Target Impact
    const triggerArrowPiercingHit = (isHeavyBolt = false) => {
      const j = 0.95 + Math.random() * 0.1;
      // Terminal incoming arrow zip (`0..28ms`)
      synthNoise('bandpass', 2750 * j, 1050 * j, 6.5, 0.038, 0.24, 0, 0.002, 0.2);
      // Broadhead steel point puncture crack (`22ms`)
      synthNoise('bandpass', 2400 * j, 520 * j, 2.2, 0.068, 0.44, 0.018, 0.0015, 0.3);
      synthMetallicRing(1520 * j, [1.0, 2.28, 3.85], 0.075, isHeavyBolt ? 0.16 : 0.11, 0.018, 0.35);
      // Deep flesh / armor / shield thunk (`20ms`)
      const bodyStart = (isHeavyBolt ? 175 : 150) * j;
      synthTone(bodyStart, 42, isHeavyBolt ? 0.17 : 0.135, 'sine', isHeavyBolt ? 0.50 : 0.42, 0.018, 0.002, 0.22);
      synthTone(360 * j, 115 * j, 0.085, 'triangle', 0.28, 0.018, 0.002, 0.2);
      // Wooden arrow shaft flexural vibration shudder after embedding (`48..190ms`)
      synthTone(86 * j, 64 * j, 0.14, 'triangle', 0.16, 0.045, 0.008, 0.18);
      synthTone(275 * j, 210 * j, 0.11, 'sine', 0.10, 0.048, 0.008, 0.18);
    };

    // =========================================================================
    // BANK 31: TACTICAL MAP MOVEMENT STEPS, UI, CHEST, HEAL & EXPLOSION
    // =========================================================================
    if (bankChunkId === 31) {
      switch (subIdx) {
        case 0: // cursor (subtle warm wooden/stone tactical tile tick)
          synthTone(540, 380, 0.022, 'triangle', 0.11, 0, 0.001, 0.08);
          synthNoise('bandpass', 1650, 950, 4.0, 0.018, 0.08, 0, 0.001, 0.05);
          return true;
        case 1: // mechanical gate / drawbridge latch unlock
          synthTone(140, 48, 0.22, 'triangle', 0.36, 0, 0.003, 0.3);
          synthNoise('bandpass', 850, 280, 2.5, 0.24, 0.32, 0, 0.004, 0.3);
          synthMetallicRing(480, [1.0, 1.85, 2.95], 0.24, 0.16, 0.03, 0.4);
          this.playSmoothedPcmLayer(31, 1, channel, 0.22, 2800, 80);
          return true;
        case 2: // dialogue parchment/scroll tick
          synthTone(460, 310, 0.024, 'sine', 0.075, 0, 0.002, 0.05);
          synthNoise('bandpass', 2200, 1200, 3.5, 0.02, 0.06, 0, 0.002, 0.05);
          return true;
        case 3: // explosion (heavy concussive fireball & rock-shatter detonation)
          synthTone(155, 22, 0.56, 'sine', 0.62, 0, 0.003, 0.55);
          synthTone(95, 18, 0.62, 'triangle', 0.45, 0.015, 0.005, 0.55);
          synthNoise('lowpass', 1850, 110, 1.4, 0.58, 0.52, 0, 0.004, 0.6);
          synthNoise('bandpass', 640, 140, 2.0, 0.48, 0.38, 0.02, 0.01, 0.5);
          this.playSmoothedPcmLayer(31, 3, channel, 0.22, 3200, 50);
          return true;
        case 4: // heal (radiant crystalline chime & warm harmonic choir swell)
          [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, idx) => {
            synthTone(freq, freq * 1.003, 0.32, 'sine', 0.13, idx * 0.048, 0.012, 0.75);
            synthTone(freq * 2, freq * 2, 0.22, 'triangle', 0.045, idx * 0.048, 0.008, 0.75);
          });
          synthNoise('bandpass', 3600, 5200, 4.0, 0.34, 0.07, 0.02, 0.06, 0.7);
          return true;
        case 5: // confirm (warm resonant harp/chime double-note)
          synthTone(523.25, 523.25, 0.11, 'triangle', 0.16, 0, 0.003, 0.35);
          synthTone(783.99, 783.99, 0.16, 'sine', 0.18, 0.045, 0.003, 0.45);
          return true;
        case 6: // cancel (soft muted wood/horn descending interval)
          synthTone(440, 392, 0.08, 'triangle', 0.14, 0, 0.003, 0.25);
          synthTone(329.63, 261.63, 0.13, 'sine', 0.15, 0.045, 0.003, 0.25);
          return true;
        case 7: // click (crisp tactile UI button press)
          synthTone(720, 440, 0.018, 'triangle', 0.13, 0, 0.001, 0.08);
          synthNoise('bandpass', 2400, 1400, 3.0, 0.016, 0.09, 0, 0.001, 0.08);
          return true;
        case 8: // cross (tactical target lock metallic chink)
          synthMetallicRing(1320, [1.0, 2.15, 3.42], 0.14, 0.15, 0, 0.4);
          synthTone(280, 110, 0.07, 'triangle', 0.18, 0, 0.002, 0.2);
          return true;
        case 9: {
          // step_foot: Realistic Boot & Armor Footstep on Earth / Gravel / Stone
          // Alternates left/right foot weight with organic pitch/filter jitter
          this.stepAlternate = !this.stepAlternate;
          const footPitch = (this.stepAlternate ? 1.04 : 0.96) * (0.95 + Math.random() * 0.1);
          // 1) Low-end boot heel earth thud
          synthTone(122 * footPitch, 41 * footPitch, 0.062, 'sine', 0.30, 0, 0.002, 0.12);
          synthTone(215 * footPitch, 72 * footPitch, 0.045, 'triangle', 0.16, 0.002, 0.002, 0.1);
          // 2) Heel-to-toe gravel & turf crunch
          synthNoise('bandpass', 1120 * footPitch, 680 * footPitch, 2.3, 0.048, 0.24, 0, 0.003, 0.14);
          synthNoise('bandpass', 2850 * footPitch, 1650 * footPitch, 2.8, 0.044, 0.16, 0.016, 0.004, 0.14);
          // 3) Subtle armor / leather gear micro-rustle
          synthMetallicRing(1780 * footPitch, [1.0, 2.24], 0.036, 0.032, 0.012, 0.15);
          return true;
        }
        case 10: {
          // step_wing: Realistic Heavy Leathery / Feathered Wingbeat Air Displacement Whoosh
          const j = 0.94 + Math.random() * 0.12;
          // Deep chest air-displacement pulse
          synthTone(86 * j, 32, 0.21, 'sine', 0.34, 0.015, 0.035, 0.25);
          // Swept aerodynamic membrane downstroke whoosh
          synthNoise('bandpass', 160 * j, 540 * j, 2.4, 0.12, 0.32, 0, 0.045, 0.35);
          synthNoise('lowpass', 620 * j, 145 * j, 1.8, 0.18, 0.28, 0.075, 0.02, 0.35);
          // Leathery membrane snap at bottom of downstroke
          synthNoise('bandpass', 1480 * j, 620 * j, 3.2, 0.065, 0.14, 0.055, 0.005, 0.25);
          return true;
        }
        case 11: {
          // step_horse: Realistic Dual-Beat Warhorse Hoof Clop-Clop on Turf & Stone
          triggerHorseHoofStride(false);
          return true;
        }
        case 12: {
          // chest: Heavy iron-bound wooden chest latch unlock + golden treasure chime
          synthTone(145, 52, 0.11, 'triangle', 0.32, 0, 0.002, 0.25);
          synthMetallicRing(820, [1.0, 2.12, 3.45], 0.12, 0.16, 0.015, 0.35);
          [587.33, 739.99, 880, 1174.66].forEach((freq, idx) => {
            synthTone(freq, freq, 0.22, 'sine', 0.15, 0.06 + idx * 0.055, 0.004, 0.65);
            synthTone(freq * 2, freq * 2, 0.15, 'triangle', 0.06, 0.06 + idx * 0.055, 0.003, 0.65);
          });
          return true;
        }
      }
    }

    // =========================================================================
    // BANKS 48..53 SUB-INDEX 0: REALISTIC AERODYNAMIC DODGE / ATTACK MISS SWISH
    // =========================================================================
    if (bankChunkId >= 48 && bankChunkId <= 53 && subIdx === 0) {
      const j = 0.94 + Math.random() * 0.12;
      synthNoise('bandpass', 280 * j, 1480 * j, 3.2, 0.11, 0.28, 0, 0.035, 0.3);
      synthNoise('bandpass', 1480 * j, 240 * j, 2.8, 0.14, 0.26, 0.075, 0.01, 0.3);
      synthTone(340 * j, 145 * j, 0.17, 'sine', 0.12, 0.02, 0.03, 0.2);
      return true;
    }

    // =========================================================================
    // BANK 48: SNIPER / CROSSBOW VOLLEY & INFANTRY / THIEF / NINJA BLADE SLASHES
    // =========================================================================
    if (bankChunkId === 48) {
      if (subIdx === 5) {
        // 48:5 (`#23 羅蘭 / #40,#58 希莉亞` Sniper/Marksman windup): Heavy mechanical bow draw & multi-arrow release
        triggerBowReleaseAndWhiz(true);
        this.playSmoothedPcmLayer(48, 5, channel, 0.16, 3600, 140);
        return true;
      }
      if (subIdx === 2) {
        // 48:2: Fast blade slice / piercing arrow volley hit
        triggerBladeSlashImpact('light', true);
        this.playSmoothedPcmLayer(48, 2, channel, 0.18, 3800, 120);
        return true;
      }
      if (subIdx === 3) {
        // 48:3: Sharp dagger / ninja blade / sniper piercing hit
        triggerBladeSlashImpact('medium', false);
        this.playSmoothedPcmLayer(48, 3, channel, 0.18, 3800, 120);
        return true;
      }
      // 48:1, 48:4: Heavy infantry sword / halberd / marksman finisher impact
      triggerBladeSlashImpact(subIdx === 4 ? 'heavy' : 'medium', true);
      this.playSmoothedPcmLayer(48, subIdx, channel, 0.20, 3600, 100);
      return true;
    }

    // =========================================================================
    // BANK 49: WARRIOR, SWORDSMAN, KNIGHT, PALADIN & CAVALRY LANCE / AXE
    // =========================================================================
    if (bankChunkId === 49) {
      if (subIdx === 2) {
        // 49:2 (`#4 亞雷斯 / #5,#37 洛娜` Knight & Paladin attack windup): Armored warhorse charge gallop!
        triggerHorseHoofStride(true);
        return true;
      }
      if (subIdx === 6) {
        // 49:6 (`#6,#38 萊汀` Knight/Paladin windup): Heavy charging lance / battle-axe windup whoosh & armor rattle
        const j = 0.95 + Math.random() * 0.1;
        synthNoise('bandpass', 210 * j, 1180 * j, 2.2, 0.24, 0.34, 0, 0.04, 0.4);
        synthTone(165 * j, 75 * j, 0.25, 'sawtooth', 0.22, 0, 0.03, 0.3);
        synthMetallicRing(640 * j, [1.0, 2.15, 3.48], 0.22, 0.14, 0.04, 0.4);
        this.playSmoothedPcmLayer(49, 6, channel, 0.20, 3000, 90);
        return true;
      }
      if (subIdx === 1) {
        // 49:1 (`米亞斯多德 / 蜜蒂 / 索爾 / 洛娜 / 騎兵`): Crisp steel sword / lance slash & armor clash
        triggerBladeSlashImpact('medium', true);
        this.playSmoothedPcmLayer(49, 1, channel, 0.20, 3800, 110);
        return true;
      }
      if (subIdx === 3) {
        // 49:3 (`鐵諾 / 凱拉斯 / 謝多 / 精英戰士`): Broadsword / katana cleaving slash & metallic ring
        triggerBladeSlashImpact('medium', true);
        this.playSmoothedPcmLayer(49, 3, channel, 0.20, 3800, 110);
        return true;
      }
      if (subIdx === 4) {
        // 49:4 (`亞雷斯 / 哈瓦特 聖戰士 / 鎧甲武士 / 地獄騎士`): Heavy armor-crushing lance / halberd impact
        triggerBladeSlashImpact('heavy', true);
        this.playSmoothedPcmLayer(49, 4, channel, 0.22, 3400, 90);
        return true;
      }
      // 49:5 (`哈諾 / 哈瓦特 / 萊汀 / 羅德曼 / 索爾` finisher / `狂戰士`): Devastating greatsword / battle-axe smash
      triggerBladeSlashImpact('crit', true);
      this.playSmoothedPcmLayer(49, subIdx, channel, 0.22, 3400, 80);
      return true;
    }

    // =========================================================================
    // BANK 50: ARCHER BOWSTRING RELEASE, ARROW HIT & RANGED SWORD-WAVE / DRAGON BREATH
    // =========================================================================
    if (bankChunkId === 50) {
      if (subIdx === 2) {
        // 50:2 (`#8 希莉亞 / #87 弓箭手` attack windup): Realistic taut bowstring twang & arrow launch whiz!
        triggerBowReleaseAndWhiz(false);
        this.playSmoothedPcmLayer(50, 2, channel, 0.16, 4000, 150);
        return true;
      }
      if (subIdx === 1) {
        // 50:1 (`#8 希莉亞 / #87 弓箭手` impact): Realistic archer arrow broadhead piercing hit & shaft quiver!
        triggerArrowPiercingHit(false);
        this.playSmoothedPcmLayer(50, 1, channel, 0.18, 3600, 100);
        return true;
      }
      if (subIdx === 3) {
        // 50:3 (`#19 羅德曼 #28 淒煌斬` flurry / `#104,#105,#127` Dragon Breath windup, shared with `83:1`):
        // Blazing aerodynamic tempest / roaring flame draft
        const j = 0.95 + Math.random() * 0.1;
        synthTone(135 * j, 34, 0.48, 'sawtooth', 0.36, 0, 0.02, 0.45);
        synthNoise('bandpass', 420 * j, 1650 * j, 1.8, 0.46, 0.38, 0, 0.025, 0.5);
        synthNoise('lowpass', 950 * j, 220 * j, 1.4, 0.52, 0.36, 0.04, 0.03, 0.5);
        this.playSmoothedPcmLayer(50, 3, channel, 0.20, 3400, 80);
        return true;
      }
      // 50:4 (`#19 羅德曼 / #34 鐵諾` ranged sword-wave impact / `#104,#105,#127` Dragon Breath impact):
      // High-energy cleaving shockwave + searing elemental blast
      triggerBladeSlashImpact('heavy', false);
      synthNoise('lowpass', 1450, 180, 1.5, 0.42, 0.38, 0.02, 0.01, 0.5);
      this.playSmoothedPcmLayer(50, subIdx, channel, 0.20, 3400, 80);
      return true;
    }

    // =========================================================================
    // BANK 51: ARCHER / SNIPER / ELF VOLLEY & MECH ARTILLERY / LASER CANNON
    // =========================================================================
    if (bankChunkId === 51) {
      if (subIdx === 3 || subIdx === 4) {
        // 51:3, 51:4 (`#13 貝克威 弓兵` 3-shot bow draw & release): Rapid bowstring snap & arrow whiz
        triggerBowReleaseAndWhiz(subIdx === 3);
        this.playSmoothedPcmLayer(51, subIdx, channel, 0.16, 3800, 140);
        return true;
      }
      if (subIdx === 2) {
        // 51:2 (`#13,#45,#63 貝克威 / #72 精靈 / #88,#89 狙擊手 / #111,#114 機甲` impact): Heavy piercing arrow / bolt hit!
        triggerArrowPiercingHit(true);
        this.playSmoothedPcmLayer(51, 2, channel, 0.20, 3600, 100);
        return true;
      }
      // 51:1 (`#45,#63 貝克威 / #72 精靈 / #88,#89 狙擊手` windup AND `#112,#113,#115` Mech Laser/Assault impact):
      // High-velocity crossbow / rail-beam launch & kinetic impact
      triggerBowReleaseAndWhiz(true);
      synthTone(240, 44, 0.32, 'sine', 0.38, 0.025, 0.005, 0.35);
      synthNoise('bandpass', 1800, 420, 2.2, 0.34, 0.32, 0.02, 0.008, 0.4);
      this.playSmoothedPcmLayer(51, 1, channel, 0.22, 3600, 90);
      return true;
    }

    // =========================================================================
    // BANK 52: HERO SWORDSMAN THOR, PALADIN LANCELOT, DRAGON KNIGHTS & CRITICAL CLEAVE
    // =========================================================================
    if (bankChunkId === 52) {
      if (subIdx === 5) {
        // 52:5 (`#116 機甲隊長` windup): Heavy mechanical halberd windup whoosh & servo hum
        synthNoise('bandpass', 260, 1520, 2.5, 0.26, 0.32, 0, 0.03, 0.35);
        synthTone(140, 290, 0.24, 'sawtooth', 0.20, 0, 0.02, 0.3);
        this.playSmoothedPcmLayer(52, 5, channel, 0.20, 3400, 100);
        return true;
      }
      if (subIdx === 4) {
        // 52:4 (`#7 蘭斯洛特` 4th finisher, `#39 賢者長老` 4th finisher, `#56 萊汀 龍騎士`, and `crit`):
        // Devastating Critical Sword Cleave with resonant steel harmonic ring & sub-bass drop
        triggerBladeSlashImpact('crit', true);
        this.playSmoothedPcmLayer(52, 4, channel, 0.22, 4000, 80);
        return true;
      }
      if (subIdx === 2) {
        // 52:2 (`#36 亞雷斯 聖騎士 / #103 獸人隊長`): Heavy runeblade / battle-axe cleaving impact
        triggerBladeSlashImpact('heavy', true);
        this.playSmoothedPcmLayer(52, 2, channel, 0.22, 3600, 90);
        return true;
      }
      // 52:1, 52:3 (`#0 索爾 / #7 蘭斯洛特 / #20 莎拉 / #27 巴拿羅西亞 / #34 鐵諾 / #54 亞雷斯 龍騎士`):
      // Crisp heroic steel sword / dragon-lance slash & armor impact
      triggerBladeSlashImpact('medium', true);
      this.playSmoothedPcmLayer(52, subIdx, channel, 0.20, 3800, 100);
      return true;
    }

    // =========================================================================
    // BANK 53: MARTIAL ARTISTS, MONK/MAGE STAFF, PANTHER CLAWS, DEMONS & ARCHFIENDS
    // =========================================================================
    if (bankChunkId === 53) {
      const j = 0.95 + Math.random() * 0.1;
      if (subIdx === 3) {
        // 53:3 (`#22 卡里斯 / #30 蓋亞 / #47,#65 塞可邦勒` windup): Explosive martial Qi / hurricane kick windup whoosh
        synthNoise('bandpass', 220 * j, 1450 * j, 2.8, 0.28, 0.34, 0, 0.035, 0.4);
        synthTone(110 * j, 240 * j, 0.26, 'sine', 0.24, 0, 0.03, 0.35);
        this.playSmoothedPcmLayer(53, 3, channel, 0.20, 3200, 90);
        return true;
      }
      if (subIdx === 1) {
        // 53:1 (Martial punch / monk oak staff strike / beast claw tear):
        // Whip-crack air snap + solid hardwood/knuckle bone impact
        synthNoise('bandpass', 2200 * j, 580 * j, 2.6, 0.075, 0.38, 0, 0.0015, 0.25);
        synthTone(230 * j, 46, 0.145, 'sine', 0.46, 0.008, 0.002, 0.22);
        synthTone(680 * j, 190 * j, 0.065, 'triangle', 0.28, 0.008, 0.0015, 0.22);
        this.playSmoothedPcmLayer(53, 1, channel, 0.20, 3400, 100);
        return true;
      }
      // 53:2 (`塞可邦勒 / 卡里斯 / 達克塞 / 蓋亞 / 武術家 / 惡魔 / 魔神` heavy impact):
      // Crushing iron-fist / demon claw shockwave slam
      synthNoise('bandpass', 1650 * j, 260 * j, 1.9, 0.28, 0.44, 0, 0.002, 0.45);
      synthTone(185 * j, 27, 0.34, 'sine', 0.58, 0.005, 0.002, 0.4);
      synthTone(125 * j, 34, 0.28, 'sawtooth', 0.30, 0.01, 0.004, 0.35);
      this.playSmoothedPcmLayer(53, 2, channel, 0.22, 3200, 70);
      return true;
    }

    // =========================================================================
    // BANKS 80 & 82..95: SPELL CHANTS, ELEMENTAL MAGIC & SUMMONS
    // =========================================================================
    if (subIdx === 0 && ((bankChunkId >= 82 && bankChunkId <= 94) || bankChunkId === 80)) {
      // `bank:*:0` (Magic Chant / Arcane Invocation Shimmer):
      // Shimmering harmonic crystal choir & arcane resonance
      [528, 660, 792, 1056, 1320, 1584].forEach((freq, idx) => {
        synthTone(freq * 0.995, freq * 1.005, 0.44, 'sine', 0.11, idx * 0.042, 0.025, 0.85);
        synthTone(freq * 1.5, freq * 1.5, 0.32, 'triangle', 0.04, idx * 0.042 + 0.015, 0.02, 0.85);
      });
      synthNoise('bandpass', 2400, 4800, 5.0, 0.48, 0.09, 0, 0.08, 0.8);
      this.playSmoothedPcmLayer(bankChunkId, 0, channel, 0.14, 4200, 220);
      return true;
    }

    if (bankChunkId === 82 || bankChunkId === 83 || bankChunkId === 84) {
      // Fire Spells (`#0 火炎術`, `#1 烈炎術`, `#2 炎龍術`, `#3 天火術`)
      if (bankChunkId === 83 && subIdx === 3) {
        // 83:3 (`#2 炎龍術` Dragon entrance & coil whoosh): Giant fire-dragon wing beat & furnace draft
        synthTone(110, 36, 0.45, 'sine', 0.44, 0, 0.04, 0.5);
        synthNoise('bandpass', 220, 920, 2.2, 0.48, 0.40, 0, 0.05, 0.55);
        this.playSmoothedPcmLayer(83, 3, channel, 0.22, 3200, 70);
        return true;
      }
      if (bankChunkId === 84 && subIdx === 1) {
        // 84:1 (`#3 天火術` Falling Solar Meteor): Descending Doppler meteor whistle -> fiery ground impact!
        synthTone(1450, 240, 0.28, 'sine', 0.18, 0, 0.01, 0.5);
        synthNoise('bandpass', 2600, 480, 4.5, 0.28, 0.34, 0, 0.01, 0.5);
        synthTone(150, 25, 0.46, 'sine', 0.52, 0.14, 0.004, 0.6);
        synthNoise('lowpass', 1650, 140, 1.4, 0.48, 0.44, 0.14, 0.005, 0.6);
        this.playSmoothedPcmLayer(84, 1, channel, 0.22, 3400, 60);
        return true;
      }
      // Roaring inferno pillar combustion & crackling flames (`82:1`, `83:1,2`, `84:2`)
      synthTone(125, 28, 0.58, 'sine', 0.48, 0, 0.015, 0.55);
      synthTone(78, 24, 0.64, 'sawtooth', 0.28, 0.02, 0.025, 0.5);
      synthNoise('lowpass', 1400, 180, 1.5, 0.62, 0.44, 0, 0.015, 0.6);
      synthNoise('bandpass', 2400, 950, 2.8, 0.45, 0.24, 0.03, 0.01, 0.5);
      this.playSmoothedPcmLayer(bankChunkId, subIdx, channel, 0.22, 3600, 65);
      return true;
    }

    if (bankChunkId >= 85 && bankChunkId <= 88) {
      // Lightning & Thunder Spells (`#4 電擊術`, `#5 落雷術`, `#6 轟雷術`, `#7 神雷術`)
      if (bankChunkId === 87 && subIdx === 2) {
        // 87:2 (`#6 轟雷術` orbiting thunder spheres hum): High-voltage magnetic plasma oscillation
        synthTone(145, 290, 0.30, 'sawtooth', 0.24, 0, 0.02, 0.5);
        synthNoise('bandpass', 3200, 5400, 4.5, 0.28, 0.22, 0, 0.02, 0.5);
        this.playSmoothedPcmLayer(87, 2, channel, 0.18, 4200, 120);
        return true;
      }
      // Razor-sharp electric arc crackle + sky-splitting thunderclap sub-bass boom
      synthNoise('highpass', 3400, 1600, 1.8, 0.18, 0.42, 0, 0.001, 0.55);
      synthNoise('bandpass', 4800, 1100, 2.4, 0.34, 0.38, 0.015, 0.002, 0.6);
      synthTone(220, 26, 0.52, 'sine', 0.56, 0.006, 0.002, 0.6);
      synthTone(135, 22, 0.58, 'sawtooth', 0.34, 0.018, 0.004, 0.6);
      this.playSmoothedPcmLayer(bankChunkId, subIdx, channel, 0.22, 4200, 65);
      return true;
    }

    if (bankChunkId === 89 || bankChunkId === 91) {
      // `#8 聖光彈` (`89:1,2`) & `#32 熾天使` (`91:1,2`): Celestial holy light ray & Seraphim chime blast
      synthMetallicRing(1046.5, [1.0, 1.5, 2.0, 2.5, 3.0], 0.42, 0.24, 0, 0.85);
      synthNoise('bandpass', 2800, 950, 2.5, 0.36, 0.28, 0, 0.005, 0.65);
      synthTone(180, 45, 0.32, 'sine', 0.34, 0.01, 0.004, 0.45);
      this.playSmoothedPcmLayer(bankChunkId, subIdx, channel, 0.20, 4000, 110);
      return true;
    }

    if (bankChunkId === 90 || (bankChunkId >= 92 && bankChunkId <= 95)) {
      // `#9 咒殺術` (`90:1,2`) & Summons `#33..#35` (`92..94`) & `95`:
      // Ominous dark tritone bell toll + colossal tectonic energy eruption
      synthMetallicRing(220, [1.0, 1.414, 2.0, 2.828], 0.65, 0.26, 0, 0.8);
      synthTone(145, 24, 0.68, 'sine', 0.54, 0.02, 0.01, 0.65);
      synthNoise('lowpass', 1250, 130, 1.6, 0.65, 0.42, 0.02, 0.015, 0.65);
      this.playSmoothedPcmLayer(bankChunkId, subIdx, channel, 0.24, 3400, 60);
      return true;
    }

    if (bankChunkId === 80) {
      // On-Map Spells, Earth Quake (`80:2..6`), Heal (`80:7`), Level-Up Fanfare (`80:11`) & Buffs
      if (subIdx === 7) {
        return this.playRealisticHdBankSfx(31, 4, channel);
      }
      if (subIdx === 11) {
        // 80:11 (Level-Up / Promotion Royal Brass & Chime Flourish)
        const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
        notes.forEach((f, idx) => {
          const d = idx === 5 ? 0.45 : 0.12;
          const tDelay = idx * 0.085;
          synthTone(f, f, d, 'triangle', 0.20, tDelay, 0.006, 0.7);
          synthTone(f * 0.5, f * 0.5, d, 'sawtooth', 0.12, tDelay, 0.008, 0.6);
        });
        this.playSmoothedPcmLayer(80, 11, channel, 0.20, 3800, 120);
        return true;
      }
      if (subIdx >= 2 && subIdx <= 6) {
        // Tectonic Earth / Boulder Spells (`#10..#12 碎岩/地震/裂地`)
        synthTone(115, 22, 0.62, 'sine', 0.58, 0, 0.005, 0.6);
        synthTone(78, 26, 0.65, 'sawtooth', 0.36, 0.02, 0.01, 0.55);
        synthNoise('lowpass', 720, 110, 1.8, 0.64, 0.48, 0, 0.01, 0.6);
        this.playSmoothedPcmLayer(80, subIdx, channel, 0.25, 3000, 55);
        return true;
      }
      // Other on-map status / buff / teleport spells
      synthMetallicRing(660, [1.0, 1.5, 2.0, 3.0], 0.38, 0.20, 0, 0.75);
      synthNoise('bandpass', 1400, 3200, 3.0, 0.38, 0.22, 0, 0.02, 0.6);
      this.playSmoothedPcmLayer(80, subIdx, channel, 0.25, 3600, 100);
      return true;
    }

    // =========================================================================
    // BANKS 64, 77, 78 & ANY OTHER SFX: ENHANCED FULL-BANDWIDTH HYBRID
    // =========================================================================
    if (bankChunkId === 64) {
      if (subIdx === 1 || subIdx === 3) {
        triggerBladeSlashImpact(subIdx === 3 ? 'crit' : 'medium', true);
      } else if (subIdx === 5) {
        return this.playRealisticHdBankSfx(53, 1, channel);
      } else {
        synthTone(150, 38, 0.24, 'sine', 0.36, 0, 0.004, 0.35);
      }
      this.playSmoothedPcmLayer(64, subIdx, channel, 0.25, 3600, 80);
      return true;
    }

    // Default HD enhanced fallback for any remaining sample (e.g. bank 77, 78)
    synthTone(130, 36, 0.28, 'sine', 0.32, 0, 0.01, 0.4);
    this.playSmoothedPcmLayer(bankChunkId, subIdx, channel, 0.45, 3800, 70);
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

    if (this.sfxPayload || this.editionMode === 'hd') {
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
          if (this.playBankSfx(80, 3)) return;
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
