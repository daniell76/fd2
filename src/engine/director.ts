import type { SoundEngine } from '../audio/soundEngine';
import { getLocale, getLocalizedClassName, getLocalizedItemName, getLocalizedUnitName, tr } from '../i18n';
import type { AssetManager } from './assets';
import {
  createPartyMemberFromHeroDef,
  isUnitActiveOnMap,
  spawnChapterWave,
} from './tactical';
import type { BattleUnit, ChapterData, PartyMemberSave } from '../types';

export interface ActiveSparkleFx {
  x: number; // tile X
  y: number; // tile Y
  frameIdx: number; // 0..11
}

export interface ActiveLightningFx {
  tileX: number;
  tileY: number;
  intensity: number; // 0..1
}

export interface ActiveSpecialStripFx {
  img: HTMLImageElement;
  sx: number;
  frameW: number;
  frameH: number;
  tileX: number;
  tileY: number;
}

export interface DirectorHost {
  assets: AssetManager;
  sound: SoundEngine;
  getChapter: () => ChapterData | null;
  getSlots: () => (BattleUnit | null)[];
  getNextSlotIndex: () => number;
  setNextSlotIndex: (idx: number) => void;
  getParty: () => PartyMemberSave[];
  setParty: (p: PartyMemberSave[]) => void;
  getGold: () => number;
  setGold: (g: number) => void;
  getTurn: () => number;
  loadMapForDirecting: (chapterId: number) => Promise<ChapterData>;
  panCameraSmooth: (tileX: number, tileY: number, durationMs?: number) => Promise<void>;
  snapCameraToTile: (tileX: number, tileY: number) => void;
  setCameraTopLeft: (topLeftX: number, topLeftY: number) => void;
  panCameraTopLeft: (topLeftX: number, topLeftY: number, durationMs?: number) => Promise<void>;
  getCameraTopLeft: () => [number, number];
  stepCameraTopLeft: (nextTopLeftX: number, nextTopLeftY: number, progress01: number) => void;
  fadeScreen: (color: string, toAlpha: number, durationMs: number) => Promise<void>;
  setScreenShake: (offsetX: number, offsetY: number) => void;
  setScreenFlashAlpha: (color: string, alpha: number) => void;
  setSparkleOverlays: (sparkles: ActiveSparkleFx[]) => void;
  setLightningOverlay: (fx: ActiveLightningFx | null) => void;
  setSpecialStripOverlay: (fx: ActiveSpecialStripFx | null) => void;
  playDialogueIndex: (dlgIdx: number) => Promise<void>;
  playScriptedCutawayDuel: (attackerSlot: number, defenderSlot: number) => Promise<void>;
  playDyingUnitsOnMapAnim: () => Promise<void>;
  logMessage: (html: string) => void;
  updateHud: () => void;
}

export type PostBattleOutcome =
  | { kind: 'next_chapter'; nextChapterId: number }
  | { kind: 'ending'; route: 'normal' | 'true' };

const DIR_DELTAS: Record<number, [number, number]> = {
  0: [0, 1],  // Down (+y)
  1: [-1, 0], // Left (-x)
  2: [0, -1], // Up (-y)
  3: [1, 0],  // Right (+x)
};

/**
 * Complete Directing (`演出 / 導演系統`) & Chapter-by-Chapter Scenario Engine for Flame Dragon II (`FD2.EXE`).
 * Executes:
 *  - All 106 Unit Choreography Bytecode Scripts (`public/assets/choreography.json`)
 *  - Opening Prologue (`Map 32` Royal Throne Departure -> `Map 31` Sea Ambush -> `Ch 1` Shipwreck Beach, `0 G`, `[#0, #9, #4, #30]`)
 *  - Pre-Battle Directing (`fn_140059 .. fn_147004`) across all 30 Chapters
 *  - Mid-Battle Turn / Step / Chest / Death-Drop Events (`EV 0 .. EV 84`)
 *  - Post-Battle Formations (`public/assets/post_formations.json`), Hero Recruitments, Ch 21 6-Crystal Sky Key Beam (`FDOTHER[34]`),
 *    Ch 22 Golden Castle Rising (`FDOTHER[45]`), Ch 23 Earthquakes & Map Transformation, and Branching Endings (`Ch 27` vs `Ch 30 -> Map 30`)!
 */
export class ScenarioDirector {
  private skipRequested = false;
  /** Per-chapter 32-byte event flag array (`GLOBAL_2_15375` in `FD2.EXE`), reset on each chapter load! */
  private flags = new Uint8Array(32);

  constructor(private host: DirectorHost) {}

  requestSkip(): void {
    this.skipRequested = true;
  }

  resetChapterFlags(savedFlags?: number[]): void {
    this.flags.fill(0);
    if (savedFlags) {
      for (let i = 0; i < Math.min(this.flags.length, savedFlags.length); i++) {
        this.flags[i] = savedFlags[i] & 0xff;
      }
    }
  }

  getFlags(): Uint8Array {
    return this.flags;
  }

  setFlag(idx: number, val: number): void {
    if (idx >= 0 && idx < this.flags.length) {
      this.flags[idx] = val & 0xff;
    }
  }

  partyHasHero(baseHeroId: number): boolean {
    const gd = this.host.assets.gameData;
    return this.host.getParty().some((p) => (p.baseHeroId ?? gd.unitDex[p.uid]?.baseHeroId ?? p.uid) === baseHeroId);
  }

  /** Dynamically schedules a dormant `turnEvents` slot (`turn == 255`) in `this.chapter.turnEvents`! */
  scheduleTurnEventSlot(slotIdx: number, targetTurn: number, phaseOverride?: number): void {
    const ch = this.host.getChapter();
    if (!ch) return;
    const te = ch.turnEvents.find((e) => e.slot === slotIdx) ?? ch.turnEvents[slotIdx];
    if (te) {
      te.turn = targetTurn;
      if (phaseOverride !== undefined) te.phase = phaseOverride;
    }
  }

  private async sleep(ms: number): Promise<void> {
    if (this.skipRequested || ms <= 0) return;
    await new Promise((r) => setTimeout(r, ms));
  }

  // =========================================================================
  // CORE DIRECTING PRIMITIVES
  // =========================================================================

  /**
   * Executes one of the 106 `FD2.EXE` Choreography Scripts (`Obj 3 + 10,200` -> `fn_13930(choreoId)`):
   *  - `'walk'`: Simultaneous multi-unit tile-by-tile movement (`24px` interpolated per tile)
   *  - `'hop'`: Excited/startled `-17px` vertical jump-hop (`step_byte == 0x80`)
   *  - `'pose'`: Synchronized facing turn & beat pause
   *  - `options.fadeOutDuringWalk`: Matches `GLOBAL_2_15099 = 1` in `FD2.EXE` (`L14520..14575`),
   *    gradually fading the screen to black (`#000000`) across each walking sub-frame (`Choreo 100, 105, 98, 34`)!
   */
  async playChoreo(choreoId: number, options?: { fadeOutDuringWalk?: boolean }): Promise<void> {
    const script = this.host.assets.choreography[choreoId];
    if (!script) return;
    const slots = this.host.getSlots();
    const fadeOut = Boolean(options?.fadeOutDuringWalk);

    let totalWalkSubFrames = 0;
    if (fadeOut) {
      for (const cmd of script.commands) {
        if (cmd.kind === 'walk') totalWalkSubFrames += Math.max(1, cmd.val) * 6;
      }
      totalWalkSubFrames = Math.max(1, totalWalkSubFrames);
    }
    let elapsedWalkSubFrames = 0;

    for (const cmd of script.commands) {
      if (cmd.kind === 'walk') {
        const steps = Math.max(1, cmd.val);
        for (let step = 0; step < steps; step++) {
          const moving: { unit: BattleUnit; startX: number; startY: number; dx: number; dy: number }[] = [];
          for (const [slotId, rawDir] of cmd.actors) {
            const u = slots[slotId];
            if (!u || u.hidden) continue;
            const d = (rawDir & 3) as 0 | 1 | 2 | 3;
            u.dir = d;
            const [dx, dy] = DIR_DELTAS[d] ?? [0, 0];
            moving.push({ unit: u, startX: u.x, startY: u.y, dx, dy });
          }

          const subFrames = 6;
          if (moving.length > 0 && !this.skipRequested) {
            for (let f = 1; f <= subFrames; f++) {
              this.host.sound.playUnitWalkStepSfx(moving[0].unit, step * subFrames + (f - 1));
              const t = f / subFrames;
              for (const m of moving) {
                m.unit.renderX = m.startX + m.dx * t;
                m.unit.renderY = m.startY + m.dy * t;
              }
              if (fadeOut) {
                elapsedWalkSubFrames++;
                this.host.setScreenFlashAlpha('#000000', Math.min(1, elapsedWalkSubFrames / totalWalkSubFrames));
              }
              await this.sleep(18);
            }
          } else if (fadeOut) {
            elapsedWalkSubFrames += subFrames;
            this.host.setScreenFlashAlpha('#000000', Math.min(1, elapsedWalkSubFrames / totalWalkSubFrames));
          }

          const ch = this.host.getChapter();
          for (const m of moving) {
            const nx = ch ? Math.max(0, Math.min(ch.width - 1, m.startX + m.dx)) : m.startX + m.dx;
            const ny = ch ? Math.max(0, Math.min(ch.height - 1, m.startY + m.dy)) : m.startY + m.dy;
            m.unit.x = nx;
            m.unit.y = ny;
            m.unit.renderX = undefined;
            m.unit.renderY = undefined;
          }
        }
      } else if (cmd.kind === 'hop') {
        const hopping: BattleUnit[] = [];
        for (const [slotId, rawDir] of cmd.actors) {
          const u = slots[slotId];
          if (!u || u.hidden) continue;
          u.dir = (rawDir & 3) as 0 | 1 | 2 | 3;
          hopping.push(u);
        }
        if (hopping.length > 0 && !this.skipRequested) {
          this.host.sound.playSfx('cursor');
          const arc = [-8, -15, -17, -12, -5, 0];
          for (const offY of arc) {
            for (const u of hopping) u.hopOffsetY = offY;
            await this.sleep(28);
          }
          for (const u of hopping) u.hopOffsetY = 0;
        }
      } else if (cmd.kind === 'pose') {
        for (const [slotId, rawDir] of cmd.actors) {
          const u = slots[slotId];
          if (!u || u.hidden) continue;
          u.dir = (rawDir & 3) as 0 | 1 | 2 | 3;
        }
        await this.sleep(Math.min(360, Math.max(40, cmd.val * 26)));
      }
    }

    if (fadeOut) {
      this.host.setScreenFlashAlpha('#000000', 1);
    }
  }

  /**
   * Authentic `FD2.EXE` `fn_12677(slotId)` (`L12677..L12915`):
   * Walks `slots[slotId]` step-by-step in `dir` (`6` sub-frames per tile), and whenever the unit steps
   * within `2` tiles of the `13x8` viewport border (`L12695: unit.y - camTileY < 2` when walking north),
   * scrolls the camera smoothly in lockstep with the unit's 6 sub-frames!
   * Used in `Map 32` (`L140119..140138` 15 steps north & `L140182..140201` 13 steps north) as Sol walks up the Royal Palace carpet!
   */
  async walkUnitWithCameraScroll(slotId: number, steps: number, dir: 0 | 1 | 2 | 3 = 2): Promise<void> {
    const ch = this.host.getChapter();
    const u = this.host.getSlots()[slotId];
    if (!ch || !u || u.hidden) return;

    const [dx, dy] = DIR_DELTAS[dir] ?? [0, -1];
    u.dir = dir;

    for (let step = 0; step < steps; step++) {
      const startX = u.x;
      const startY = u.y;
      const [camStartX, camStartY] = this.host.getCameraTopLeft();

      // Exact `fn_12677` margin check (`2` tiles from top/left, `5`/`10` from bottom/right of `13x8` viewport):
      let camGoalX = camStartX;
      let camGoalY = camStartY;
      if (dy < 0 && startY - camStartY <= 2 && camStartY > 0) {
        camGoalY = Math.max(0, camStartY - 1);
      } else if (dy > 0 && startY - camStartY >= 5 && camStartY < Math.max(0, ch.height - 8)) {
        camGoalY = Math.min(Math.max(0, ch.height - 8), camStartY + 1);
      }
      if (dx < 0 && startX - camStartX <= 2 && camStartX > 0) {
        camGoalX = Math.max(0, camStartX - 1);
      } else if (dx > 0 && startX - camStartX >= 10 && camStartX < Math.max(0, ch.width - 13)) {
        camGoalX = Math.min(Math.max(0, ch.width - 13), camStartX + 1);
      }

      if (!this.skipRequested) {
        const subFrames = 6;
        for (let f = 1; f <= subFrames; f++) {
          this.host.sound.playUnitWalkStepSfx(u, step * subFrames + (f - 1));
          const t = f / subFrames;
          u.renderX = startX + dx * t;
          u.renderY = startY + dy * t;
          this.host.stepCameraTopLeft(
            camStartX + (camGoalX - camStartX) * t,
            camStartY + (camGoalY - camStartY) * t,
            t
          );
          await this.sleep(18);
        }
      } else {
        this.host.setCameraTopLeft(camGoalX, camGoalY);
      }

      u.x = Math.max(0, Math.min(ch.width - 1, startX + dx));
      u.y = Math.max(0, Math.min(ch.height - 1, startY + dy));
      u.renderX = undefined;
      u.renderY = undefined;
      this.host.setCameraTopLeft(camGoalX, camGoalY);
    }
  }

  /** Spawns all units in `waveGroup` (`forcedExact = true` during PRE/POST cutscenes, `false` during mid-battle). */
  spawnWave(waveGroup: number, forcedExact = true): BattleUnit[] {
    const ch = this.host.getChapter();
    if (!ch) return [];
    const res = spawnChapterWave(
      ch,
      this.host.getSlots(),
      this.host.getNextSlotIndex(),
      waveGroup,
      this.host.getParty(),
      this.host.assets.gameData,
      forcedExact
    );
    this.host.setNextSlotIndex(res.nextSlotIndex);
    return res.spawned;
  }

  /**
   * Authentic `FD2.EXE` `fn_141721(waveGroup)` Teleportation Sparkle Wave:
   * Plays `FDOTHER[9]` 12-frame sparkles at the wave's target coordinates while materializing the units!
   */
  async sparkleWave(waveGroup: number, forcedExact = true): Promise<BattleUnit[]> {
    const spawned = this.spawnWave(waveGroup, forcedExact);
    if (spawned.length === 0) return [];
    for (const u of spawned) u.hidden = true;

    this.host.sound.playSfx('magic');
    for (let f = 0; f < 12; f++) {
      if (f === 6) {
        for (const u of spawned) u.hidden = false;
      }
      this.host.setSparkleOverlays(spawned.map((u) => ({ x: u.x, y: u.y, frameIdx: f })));
      await this.sleep(42);
    }
    for (const u of spawned) u.hidden = false;
    this.host.setSparkleOverlays([]);
    return spawned;
  }

  /** Plays `FDOTHER[9]` sparkles over an explicit list of units (e.g. End-Turn `+20% HP` rest heal!). */
  async playSparklesOnUnits(units: BattleUnit[]): Promise<void> {
    if (units.length === 0) return;
    this.host.sound.playSfx('heal');
    for (let f = 0; f < 12; f++) {
      this.host.setSparkleOverlays(units.map((u) => ({ x: u.x, y: u.y, frameIdx: f })));
      await this.sleep(34);
    }
    this.host.setSparkleOverlays([]);
  }

  hideSlot(slotIdx: number): void {
    const u = this.host.getSlots()[slotIdx];
    if (u) {
      u.hidden = true;
      u.hp = 0;
    }
  }

  focusSlot(slotIdx: number): void {
    const u = this.host.getSlots()[slotIdx];
    if (u && !u.hidden) {
      this.host.snapCameraToTile(u.x, u.y);
    }
  }

  /**
   * Recruits canonical hero `heroId` (`0..31`) into persistent `party` (`FD2.EXE` `fn_4773` + `fn_5382`):
   *  - Initializes strictly from `HERO_BASE[heroId]` (`heroDef.level`, e.g., `Lv 1` for `#0 索爾, #9 悠妮, #4 亞雷斯, #30 蓋亞`)!
   *  - NEVER reads dummy actor levels from `isCutsceneMap` (`Map 31` has `lv = 2` cutscene actors) or `ally`/`enemy` NPC slots!
   *  - Only when the hero already fought under player control (`faction === 'player'`) on a playable battlefield (`!ch.isCutsceneMap`)
   *    prior to post-battle recruitment (`fn_4773` followed by `fn_5382`) do we copy their live battlefield `level / exp / stats / items`.
   */
  recruitHero(heroId: number): PartyMemberSave | null {
    const gd = this.host.assets.gameData;
    const heroDef = gd.heroes[heroId];
    if (!heroDef) return null;

    const party = this.host.getParty();
    const existing = party.find((p) => (p.baseHeroId ?? p.uid) === heroId || p.uid === heroId);
    if (existing) return existing;

    const ch = this.host.getChapter();
    const livePlayerSlot =
      ch && !ch.isCutsceneMap
        ? this.host
            .getSlots()
            .find((u) => u && u.faction === 'player' && (u.uid === heroId || gd.unitDex[u.uid]?.baseHeroId === heroId))
        : undefined;

    const member = createPartyMemberFromHeroDef(heroDef, gd, heroDef.level);
    if (livePlayerSlot) {
      member.level = livePlayerSlot.level;
      member.exp = livePlayerSlot.exp;
      member.maxHp = livePlayerSlot.maxHp;
      member.maxMp = livePlayerSlot.maxMp;
      member.baseAp = livePlayerSlot.baseAp;
      member.baseDp = livePlayerSlot.baseDp;
      member.baseDx = livePlayerSlot.baseDx;
      member.mv = livePlayerSlot.mv;
      member.items = [...livePlayerSlot.items].slice(0, 8);
      member.spells = [...livePlayerSlot.spells];
    }
    member.nameZh = getLocalizedUnitName(member.uid, member.nameZh ?? '');
    member.classNameZh = getLocalizedClassName(member.classId, member.classNameZh ?? '');
    party.push(member);
    this.host.setParty(party);
    this.host.sound.playSfx('fanfare');
    this.host.logMessage(
      `${this.host.assets.glyphsToHtml(member.nameGlyphs, 'gold', 15, member.nameZh)} <strong>(${member.classNameZh})</strong> ${tr('加入隊伍！', '加入队伍！', 'joined the party!')}`
    );
    return member;
  }

  partyHasItem(itemId: number): { holder: { items: number[] }; bagIdx: number } | null {
    // Check live player battlefield slots first during mid-battle / pre-sync checks, then persistent `party`!
    for (const u of this.host.getSlots()) {
      if (u && u.faction === 'player') {
        const idx = u.items.indexOf(itemId);
        if (idx >= 0) return { holder: u, bagIdx: idx };
      }
    }
    for (const p of this.host.getParty()) {
      const idx = p.items.indexOf(itemId);
      if (idx >= 0) return { holder: p, bagIdx: idx };
    }
    return null;
  }

  grantItemToParty(itemId: number, preferredUnit?: BattleUnit): boolean {
    const it = this.host.assets.gameData.items[itemId];
    if (!it) return false;

    let awarded = false;
    if (preferredUnit && preferredUnit.faction === 'player' && preferredUnit.items.length < 8) {
      preferredUnit.items.push(itemId);
      awarded = true;
    } else {
      for (const u of this.host.getSlots()) {
        if (u && u.faction === 'player' && u.items.length < 8) {
          u.items.push(itemId);
          awarded = true;
          break;
        }
      }
      if (!awarded) {
        const pWithRoom = this.host.getParty().find((p) => p.items.length < 8);
        if (pWithRoom) {
          pWithRoom.items.push(itemId);
          awarded = true;
        }
      }
    }
    if (!awarded) return false;
    this.host.sound.playSfx('chest');
    const itemName = getLocalizedItemName(itemId, it.nameZh);
    const subTag = getLocale() === 'zh-TW' ? ` <strong>(${itemName})</strong>` : '';
    this.host.logMessage(
      `${tr('獲得關鍵寶物：', '获得关键宝物：', 'Obtained key relic: ')}${this.host.assets.glyphsToHtml(it.nameGlyphs, 'gold', 15, itemName)}${subTag}！`
    );
    return true;
  }

  /** Plays `FDOTHER[3]` Lightning Bolt + white screen flash at `(tileX, tileY)`. */
  async playLightning(tileX: number, tileY: number): Promise<void> {
    this.host.sound.playSfx('magic');
    for (let i = 0; i < 6; i++) {
      const on = i % 2 === 0;
      this.host.setLightningOverlay(on ? { tileX, tileY, intensity: 1 } : null);
      this.host.setScreenFlashAlpha('#ffffff', on ? 0.65 : 0.12);
      await this.sleep(50);
    }
    this.host.setLightningOverlay(null);
    this.host.setScreenFlashAlpha('#ffffff', 0);
  }

  /** Plays `FD2.EXE` `fn_71935` Screen Earthquake (`ticks` vertical/horizontal rumble). */
  async playEarthquake(ticks = 24): Promise<void> {
    this.host.sound.playSfx('hit');
    const count = Math.max(6, Math.min(36, Math.round(ticks * 0.6)));
    for (let i = 0; i < count; i++) {
      const amp = i < count - 4 ? 6 : 3;
      const ox = (i % 2 === 0 ? 1 : -1) * amp;
      const oy = (i % 3 === 0 ? -1 : 1) * amp;
      this.host.setScreenShake(ox, oy);
      await this.sleep(28);
    }
    this.host.setScreenShake(0, 0);
  }

  /** Plays a special `FDOTHER` strip (`34` = 6-Crystal Beam `101x101`, `45` = Golden Castle Rising `59x59`). */
  async playSpecialStripOnMap(stripId: number, tileX: number, tileY: number): Promise<void> {
    const pack = await this.host.assets.loadSpecialStrip(stripId);
    if (!pack || !pack.strip.frames.length) return;
    this.host.sound.playSfx('magic');
    for (const fr of pack.strip.frames) {
      this.host.setSpecialStripOverlay({
        img: pack.img,
        sx: fr.sx,
        frameW: fr.w,
        frameH: fr.h,
        tileX,
        tileY,
      });
      await this.sleep(Math.max(45, (fr.delay || 4) * 16));
    }
    await this.sleep(260);
    this.host.setSpecialStripOverlay(null);
  }

  /**
   * Applies the authentic `FD2.EXE` `fn_78790` Post-Battle Formation (`public/assets/post_formations.json`)
   * so all surviving party heroes & guest NPCs stand in exact formation before `Choreo` & `talk`!
   */
  applyPostFormation(chapterNumber1Based: number): void {
    const def = this.host.assets.postFormations[String(chapterNumber1Based)];
    const slots = this.host.getSlots();
    const ch = this.host.getChapter();
    if (!def || !ch) return;

    for (let s = def.start; s <= def.end; s++) {
      const idx = s - def.start;
      const u = slots[s];
      if (!u) continue;
      // Revive fallen party slots at 1 HP visually for post-battle story formation
      if (u.faction === 'player' && u.hp <= 0) u.hp = 1;
      u.hidden = false;
      if (idx < def.xs.length && idx < def.ys.length) {
        u.x = Math.max(0, Math.min(ch.width - 1, def.xs[idx]));
        u.y = Math.max(0, Math.min(ch.height - 1, def.ys[idx]));
      }
      const d = Array.isArray(def.dirs) ? (def.dirs[idx] ?? 0) : def.dirs;
      u.dir = (d & 3) as 0 | 1 | 2 | 3;
      u.acted = false;
    }

    if (def.extra) {
      const [extraSlot, ex, ey, edir] = def.extra;
      const eu = slots[extraSlot];
      if (eu) {
        if (eu.hp <= 0) eu.hp = 1;
        eu.hidden = false;
        eu.x = Math.max(0, Math.min(ch.width - 1, ex));
        eu.y = Math.max(0, Math.min(ch.height - 1, ey));
        eu.dir = (edir & 3) as 0 | 1 | 2 | 3;
      }
    }

    // Hide any leftover dead enemy corpses
    for (let i = def.end + 1; i < slots.length; i++) {
      const u = slots[i];
      if (u && u.faction === 'enemy' && (!def.extra || i !== def.extra[0])) {
        u.hidden = true;
      }
    }

    const [camX, camY] = def.cam;
    if (camX > 0 || camY > 0) {
      this.host.setCameraTopLeft(camX, camY);
    } else if (slots[0]) {
      this.host.snapCameraToTile(slots[0].x, slots[0].y);
    }
  }

  /** Unlocks blocked gate/bridge/altar tiles within a rectangular area. */
  unlockMapPassagesNear(cx: number, cy: number, radius = 3): void {
    const ch = this.host.getChapter();
    if (!ch) return;
    for (let y = Math.max(0, cy - radius); y <= Math.min(ch.height - 1, cy + radius); y++) {
      for (let x = Math.max(0, cx - radius); x <= Math.min(ch.width - 1, cx + radius); x++) {
        const cell = ch.cells[y][x];
        if ((cell[4] & 1) !== 0 || cell[2] === 5) {
          cell[2] = 0; // Road / passable floor
          cell[4] = cell[4] & ~1;
        }
      }
    }
  }

  /**
   * Authentic `FD2.EXE` `fn_8803()` (`Obj 1 + 8803..8923`) Dynamic Map Tile Swapper:
   * Scans all map cells `(x, y)` with `(cell_flags & 0x60) == 0x20` (`(cell[4] & 0x42) === 0x02`);
   * whenever `this.flags[cell[1]] !== 0`, increments `cell[0] += 1` (`tileId + 1`), clears `cell[1] = 0`,
   * and marks the tile as open passable floor (`cell[2] = 0`, `cell[4] &= ~(1 | 2 | 0x40)`).
   * Used in:
   *  - Ch 25 `EV 55` (`flag[0] = 1` -> unlocks north gate at `(10, 0)` from tile `48` to `49`)
   *  - Ch 26 `EV 58` (`flag[0..4] = 1` -> seals & flips all 5 Legendary Weapon vault chests `0..4`)
   *  - Ch 26 `EV 61` (`flag[12] = 1` -> unlocks `#31 渥德` stasis pod at `(1, 44)` & `(1, 45)` from tiles `88, 90` to `89, 91`)
   */
  applyDynamicMapTileSwaps(): void {
    const ch = this.host.getChapter();
    if (!ch) return;
    for (let y = 0; y < ch.height; y++) {
      for (let x = 0; x < ch.width; x++) {
        const cell = ch.cells[y][x];
        const flagIdx = cell[1];
        if ((cell[4] & 0x42) === 0x02 && flagIdx >= 0 && flagIdx < this.flags.length && this.flags[flagIdx] !== 0) {
          cell[0] += 1;
          cell[1] = 0;
          cell[2] = 0;
          cell[4] &= ~(1 | 2 | 0x40);
        }
      }
    }
  }

  /**
   * Authentic `FD2.EXE` `fn_147320(slotIdx, destX, destY)` (`Obj 1 + 147320..147644`):
   * Teleports `slots[slotIdx]` to `(destX, destY)` with `FDOTHER[9]` 12-frame sparkles!
   */
  async teleportSlotWithSparkles(slotIdx: number, destX: number, destY: number): Promise<void> {
    const u = this.host.getSlots()[slotIdx];
    if (!u || u.hp <= 0) return;
    const origX = u.x;
    const origY = u.y;
    u.hidden = false;
    this.host.sound.playSfx('magic');
    for (let f = 0; f < 12; f++) {
      if (f === 6) {
        u.x = destX;
        u.y = destY;
      }
      this.host.setSparkleOverlays([
        { x: origX, y: origY, frameIdx: f },
        { x: destX, y: destY, frameIdx: f },
      ]);
      await this.sleep(36);
    }
    u.x = destX;
    u.y = destY;
    this.host.setSparkleOverlays([]);
  }

  /**
   * Authentic `FD2.EXE` `fn_148798(slotIdx)` (`Obj 1 + 148798`):
   * Returns `true` if `slots[slotIdx]` is dead/removed (`(u.flags & 1) != 0`), or `false` if alive on the map.
   */
  isSlotDead(slotIdx: number): boolean {
    const u = this.host.getSlots()[slotIdx];
    return !u || u.hp <= 0 || Boolean(u.hidden);
  }

  /**
   * Authentic `FD2.EXE` `fn_147868(startSlot, endSlotInclusive, newAiMode)` (`Obj 1 + 147868`):
   * Loops `s = startSlot .. endSlotInclusive` and updates `u[s].aiMode` (`u+52`),
   * preserving the high nibble (`0x80 | 0x40` heal/attack flags) when `newAiMode < 0x10` (`L147915: v3_lo &= -16; v3_lo |= newAiMode`)!
   */
  setSlotsAiMode(startSlot: number, endSlotInclusive: number, newAiMode: number): void {
    const slots = this.host.getSlots();
    const maxS = Math.min(slots.length - 1, endSlotInclusive);
    for (let s = Math.max(0, startSlot); s <= maxS; s++) {
      const u = slots[s];
      if (u && u.hp > 0 && !u.hidden) {
        u.aiMode = newAiMode < 0x10 ? ((u.aiMode & 0xf0) | (newAiMode & 0x0f)) : (newAiMode & 0xff);
      }
    }
  }

  /**
   * Authentic `FD2.EXE` `fn_153634(panX, panY, waveGroup)` (`Obj 1 + 153634`):
   * Smooth-pans camera to `(panX, panY)` and spawns `waveGroup`.
   */
  async panAndSpawnWave(panX: number, panY: number, waveGroup: number): Promise<BattleUnit[]> {
    await this.host.panCameraSmooth(panX, panY, 340);
    return this.spawnWave(waveGroup, false);
  }

  /**
   * Authentic `FD2.EXE` `fn_154554(startSlot)` (`Obj 1 + 154554`):
   * Loops `s = startSlot .. 79`, sets `u[s].hp = 0` for all living enemies, and runs `fn_56165()`
   * so all remaining enemies spin in a circle, explode (`FDOTHER[5][68..79]`), and vanish on the map!
   * Used in `EV 53` (Ch 23), `EV 64` (Ch 27), `EV 71` (Ch 28), and `EV 83` (Ch 30).
   */
  async wipeEnemiesFromSlot(startSlot: number): Promise<void> {
    const slots = this.host.getSlots();
    let anyDying = false;
    for (let s = Math.max(0, startSlot); s < slots.length; s++) {
      const u = slots[s];
      if (u && u.faction === 'enemy' && !u.hidden && u.hp > 0) {
        u.hp = 0;
        anyDying = true;
      }
    }
    if (anyDying) {
      await this.host.playDyingUnitsOnMapAnim();
    }
  }

  // =========================================================================
  // 1. NEW GAME PROLOGUE (`Map 32` Palace + Woods -> `Map 31` Forest -> `Ch 1`, `0 G`)
  // =========================================================================

  /**
   * Exact instruction-for-instruction `FD2.EXE` Opening Prologue (`fn_140059 .. L141345`):
   *  - **Map 32 (`18 × 51`) packs TWO distinct `13 × 8` scenes**:
   *      1. **Scene 1 — Royal Palace Throne Hall (`y = 0..42`)**:
   *         - Starts at `camTopLeft = (3, 34)` (`x: 3..15, y: 34..41` — pure Palace; Woods `y = 43..50` completely clipped!).
   *         - `Choreo 99`: `#0 索爾` (`slot 2`) enters `(8, 42) -> (8, 36)`.
   *         - `15 × fn_12677(2)`: Sol walks `(8, 36) -> (8, 21)` while the camera scrolls smoothly UP `34 -> 20`!
   *         - `dlg[0]`: Speaker auto-scroll (`fn_26028 -> fn_11498`) scrolls UP to `#48 渥特王` `(7, 5)` & `#66 王后` `(10, 5)` (`camTileY = 3`) and back to Sol `(8, 21)`!
   *         - `13 × fn_12677(2)`: Sol walks `(8, 21) -> (8, 8)` right up to the thrones!
   *         - `dlg[1]`: Camera frames `(3, 3)` (`x: 3..15, y: 3..10`), showing King Walt `(7, 5)`, the Queen `(10, 5)`, AND Sol `(8, 8)` together!
   *         - `Choreo 100` (`fadeOutDuringWalk`): Sol walks south `(8, 8) -> (8, 18)` while fading to black (`GLOBAL_2_15099 = 1`)!
   *      2. **Scene 2 — Palace Outskirts Woods (`y = 43..50`)**:
   *         - While screen is black: retires Palace `slot 2`, snaps `13 × 8` camera to `(0, 43)` (`x: 0..12, y: 43..50` — pure Woods; Palace `y = 0..42` completely clipped!), switches BGM, and fades in (`fn_62757`)!
   *         - `Choreo 101..104` + `dlg[2..5]`: `#4 亞雷斯` (`slot 4`) walks in from off-screen `(13, 47) -> (10, 47)`, hops (`Choreo 103`), and joins `#0 索爾` (`slot 3` at `(4, 46)`).
   *         - `Choreo 105` (`fadeOutDuringWalk`): Sol & Ares walk east out of the Woods while fading to black!
   *  - **Map 31 (`20 × 50`) — Forest Road (`camTopLeft = (5, 42) -> (4, 41)`)**:
   *      - Fades in on `(5, 42)` (`x: 5..17, y: 42..49` — staging actors at `(19, 46)`, `(19, 47)`, `(0, 0)` cleanly off-screen!).
   *      - `Wave 1` (`索爾`, `亞雷斯`) -> `Choreo 90..92` + `dlg[0..2]` -> `Wave 3` (`#75 米蘭`, `#30 蓋亞`) -> pan `(4, 41)` -> `dlg[3]` -> `Choreo 93` -> `dlg[4]` -> `hideSlot(2)` -> `Wave 5` (`#9 悠妮`) -> `dlg[5..9]` + `Choreo 94..97` -> `Choreo 98` (`fadeOutDuringWalk`)!
   *  - Recruits `[#0 索爾, #9 悠妮, #4 亞雷斯, #30 蓋亞]` with `Gold = 0`!
   */
  async runNewGamePrologue(startFromMap31 = false): Promise<void> {
    this.skipRequested = false;

    // Reset Campaign State to authentic `FD2.EXE` New Game values: empty party, 0 Gold!
    this.host.setParty([]);
    this.host.setGold(0);
    this.host.updateHud();

    if (!startFromMap31) {
      // --- PART 1A: Map 32 Scene 1 (`序幕(一)・王城啟程` — Royal Palace Throne Hall `y = 0..42`) ---
      this.host.setScreenFlashAlpha('#000000', 1);
      await this.host.loadMapForDirecting(32);
      // Keep Woods duplicate Sol (`slot 3` at `(4, 46)`) & Ares (`slot 4` at `(13, 47)`) hidden during Scene 1
      const m32Slots = this.host.getSlots();
      if (m32Slots[3]) m32Slots[3].hidden = true;
      if (m32Slots[4]) m32Slots[4].hidden = true;

      this.host.setCameraTopLeft(3, 34); // Exact `L140090: fn_13789(3, 34)` (`x: 3..15, y: 34..41`)
      await this.host.fadeScreen('#000000', 0, 360);

      await this.playChoreo(99); // `slot 2` Sol walks 6 tiles north `(8, 42) -> (8, 36)`
      await this.walkUnitWithCameraScroll(2, 15, 2); // `15 × fn_12677(2)`: `(8, 36) -> (8, 21)`, camera scrolls UP `34 -> 20`!
      await this.host.playDialogueIndex(0); // King Walt `(7, 5)` & Queen `(10, 5)` auto-scroll into view & summon Sol forward!
      await this.walkUnitWithCameraScroll(2, 13, 2); // `13 × fn_12677(2)`: `(8, 21) -> (8, 8)` right before the twin thrones!
      await this.host.playDialogueIndex(1); // King Walt `(7, 5)`, Queen `(10, 5)`, and Sol `(8, 8)` together in `(3, 3)`!
      await this.playChoreo(100, { fadeOutDuringWalk: true }); // Sol departs `(8, 8) -> (8, 18)` while fading to black!

      // --- PART 1B: Map 32 Scene 2 (`王城郊外樹林` — Woods Clearing `x: 0..12, y: 43..50`) ---
      this.hideSlot(2); // Retire Palace Sol (`slot 2`)
      if (m32Slots[3]) {
        m32Slots[3].hidden = false;
        m32Slots[3].hp = m32Slots[3].maxHp;
      }
      if (m32Slots[4]) {
        m32Slots[4].hidden = false;
        m32Slots[4].hp = m32Slots[4].maxHp;
      }
      this.host.setCameraTopLeft(0, 43); // Exact `L140268: GLOBAL_2_15017 = 0, GLOBAL_2_15021 = 43`!
      if (this.host.assets.musicTracks.length > 0) {
        this.host.sound.playTrack(11 % this.host.assets.musicTracks.length); // `L140319: fn_88439(11, 0)`
      }
      await this.host.fadeScreen('#000000', 0, 380); // `L140314: fn_62757()` fade-in!

      await this.playChoreo(101); // `#4 亞雷斯` (`slot 4`) walks in `(13, 47) -> (10, 47)`!
      await this.host.playDialogueIndex(2);
      await this.playChoreo(102);
      await this.host.playDialogueIndex(3);
      await this.playChoreo(103); // Ares startled `-17px` hop!
      await this.host.playDialogueIndex(4);
      await this.playChoreo(104); // Sol turns east toward Ares
      await this.host.playDialogueIndex(5);
      await this.playChoreo(105, { fadeOutDuringWalk: true }); // Sol & Ares walk east while fading to black!
    } else {
      this.host.setScreenFlashAlpha('#000000', 1);
    }

    // --- PART 2: Map 31 (`序幕(二)・森林啟程`, `FDTXT[32]`) ---
    await this.host.loadMapForDirecting(31);
    this.host.setCameraTopLeft(5, 42); // Exact `L140500: GLOBAL_2_15017 = 5, GLOBAL_2_15021 = 42` (`x: 5..17, y: 42..49`)
    await this.host.fadeScreen('#000000', 0, 380); // `L140560: fn_62757()`

    this.spawnWave(1, true); // `#0 索爾` (`slot 0` at `(5, 46)`), `#4 亞雷斯` (`slot 1` at `(5, 47)`)
    await this.playChoreo(90);
    await this.host.playDialogueIndex(0);
    await this.playChoreo(91);
    await this.host.playDialogueIndex(1);
    await this.playChoreo(92);
    await this.host.playDialogueIndex(2);

    this.spawnWave(3, true); // `#75 米蘭` (`slot 2` at `(19, 46)`), `#30 蓋亞` (`slot 3` at `(19, 47)`)
    await this.host.panCameraTopLeft(4, 41, 350); // Exact `L140748: fn_13789(4, 41)`!
    await this.host.playDialogueIndex(3);
    await this.playChoreo(93);
    await this.host.playDialogueIndex(4);
    this.hideSlot(2); // `#75 米蘭` departs (`L140846: M1[slot2 + 5] = 0`)

    this.spawnWave(5, true); // `#9 悠妮` (`slot 4`)
    await this.host.playDialogueIndex(5);
    await this.playChoreo(94);
    await this.host.playDialogueIndex(6);
    await this.playChoreo(95);
    await this.host.playDialogueIndex(7);
    await this.playChoreo(96);
    await this.host.playDialogueIndex(8);
    await this.playChoreo(97);
    await this.host.playDialogueIndex(9);
    await this.playChoreo(98, { fadeOutDuringWalk: true }); // Party walks east off-map while fading to black!

    // Exact `FD2.EXE` `L142290..142325` + `L142590`:
    // Recruit strictly `[#0 索爾, #9 悠妮, #4 亞雷斯, #30 蓋亞]` and set Gold = 0!
    this.host.setParty([]);
    this.recruitHero(0);  // #0 索爾
    this.recruitHero(9);  // #9 悠妮
    this.recruitHero(4);  // #4 亞雷斯
    this.recruitHero(30); // #30 蓋亞
    this.host.setGold(0);
    this.host.updateHud();
    this.host.setScreenFlashAlpha('#000000', 0);
  }

  // =========================================================================
  // 2. PRE-BATTLE CHAPTER DIRECTING (`fn_140059 .. fn_147004`, Chapters `0..29`)
  // =========================================================================

  async runPreBattleDirecting(chapterId: number): Promise<void> {
    this.skipRequested = false;
    const ch = this.host.getChapter();
    if (!ch) return;

    switch (chapterId) {
      case 0: {
        // Chapter 1 (`孤島`): Shipwrecked 4 heroes walk north on beach -> Wave 1 & Wave 2 teleport with sparkles -> Thief flees!
        this.host.snapCameraToTile(9, 18);
        await this.playChoreo(0); // Slots 0..3 walk 6 tiles north (y=20..23 -> 14..17) & Sol looks around
        await this.host.playDialogueIndex(0);
        await this.host.panCameraSmooth(6, 5, 420);
        await this.sparkleWave(1, true); // Slots 4..7 brigands materialize with FDOTHER[9] sparkles!
        await this.playChoreo(1);
        await this.host.panCameraSmooth(6, 18, 420);
        await this.sparkleWave(2, true); // Slots 8..11 brigands + thief materialize!
        await this.playChoreo(2);
        await this.host.playDialogueIndex(1);
        await this.playChoreo(5); // Thief (`slot 9`) flees 4 tiles south!
        this.hideSlot(9);
        await this.host.playDialogueIndex(2);
        this.focusSlot(0);
        break;
      }

      case 1: {
        // Chapter 2 (`羅德鎮`): 5 heroes enter east town gate (`Choreo 9, 10`) -> Villagers (`Wave 1`) -> Brigands (`Wave 2`)!
        this.host.snapCameraToTile(22, 15);
        await this.playChoreo(9);
        await this.host.playDialogueIndex(0);
        await this.playChoreo(10);
        await this.host.playDialogueIndex(1);
        this.spawnWave(1, true); // 6 Villagers (`slots 5..10`, `#133/#134`)
        await this.playChoreo(11);
        await this.host.playDialogueIndex(2);
        await this.host.panCameraSmooth(9, 16, 450);
        this.spawnWave(2, true); // Brigands (`slots 11..20`)
        await this.playChoreo(12);
        this.focusSlot(0);
        break;
      }

      case 2: {
        // Chapter 3 (`往塞拉村途中`): `#2 鐵諾` (`Wave 1`) holds off imperial soldiers
        this.host.snapCameraToTile(9, 21);
        await this.host.playDialogueIndex(0);
        await this.playChoreo(18);
        this.spawnWave(1, true);
        await this.host.panCameraSmooth(9, 10, 420);
        await this.playChoreo(17);
        await this.host.playDialogueIndex(1);
        await this.playChoreo(19);
        await this.host.playDialogueIndex(2);
        await this.host.panCameraSmooth(9, 21, 380);
        this.focusSlot(0);
        break;
      }

      case 3: {
        // Chapter 4 (`塞拉村前`)
        this.host.snapCameraToTile(10, 15);
        await this.playChoreo(20);
        await this.host.playDialogueIndex(0);
        this.spawnWave(1, true);
        await this.host.panCameraSmooth(10, 5, 400);
        this.focusSlot(0);
        break;
      }

      case 4: {
        // Chapter 5 (`塞拉村`): `#10 瑪琳` (`Wave 1`) debuts
        await this.host.playDialogueIndex(0);
        await this.host.panCameraSmooth(9, 7, 380);
        this.spawnWave(1, true);
        await this.playChoreo(22);
        await this.host.playDialogueIndex(1);
        await this.host.panCameraSmooth(14, 18, 380);
        await this.playChoreo(21);
        await this.host.playDialogueIndex(2);
        this.focusSlot(0);
        break;
      }

      case 5: {
        // Chapter 6 (`普里茲港`)
        await this.host.playDialogueIndex(0);
        this.focusSlot(0);
        break;
      }

      case 6: {
        // Chapter 7 (`往王城的途中`): `#12 凱麗` (`Wave 1`) debuts
        await this.host.playDialogueIndex(0);
        this.spawnWave(1, true);
        await this.host.panCameraSmooth(14, 5, 380);
        await this.playChoreo(28);
        await this.playChoreo(29);
        await this.host.playDialogueIndex(1);
        this.focusSlot(0);
        break;
      }

      case 7: {
        // Chapter 8 (`王城前的戰鬥`)
        this.host.snapCameraToTile(13, 36);
        await this.playChoreo(31);
        await this.host.playDialogueIndex(0);
        await this.host.panCameraSmooth(13, 27, 380);
        await this.playChoreo(32);
        this.focusSlot(0);
        break;
      }

      case 8: {
        // Chapter 9 (`騎士的抉擇`)
        await this.host.panCameraSmooth(12, 5, 380);
        await this.host.playDialogueIndex(0);
        await this.playChoreo(35);
        await this.host.playDialogueIndex(1);
        this.focusSlot(0);
        break;
      }

      case 9: {
        // Chapter 10 (`洞窟中的激戰` — King Canaan III `#135`, `#11 索菲亞`, `#6 萊汀`)
        await this.host.panCameraSmooth(15, 5, 380);
        await this.host.playDialogueIndex(0);
        this.focusSlot(0);
        break;
      }

      case 10: {
        // Chapter 11 (`幻之森林` — `#14 珊` in Wave 1)
        await this.host.playDialogueIndex(0);
        await this.host.panCameraSmooth(16, 11, 380);
        this.spawnWave(1, true);
        await this.playChoreo(38);
        await this.host.playDialogueIndex(1);
        this.focusSlot(0);
        break;
      }

      case 11: {
        // Chapter 12 (`北山道`)
        await this.host.panCameraSmooth(10, 8, 380);
        this.spawnWave(1, true);
        await this.playChoreo(40);
        await this.host.panCameraSmooth(16, 42, 420);
        await this.playChoreo(41);
        await this.host.playDialogueIndex(0);
        this.focusSlot(0);
        break;
      }

      case 12:
      case 13: {
        // Chapter 13 & 14 (`哈斯米爾之戰` / `平原的會戰`)
        if (chapterId === 13) await this.host.panCameraSmooth(24, 22, 380);
        await this.host.playDialogueIndex(0);
        this.focusSlot(0);
        break;
      }

      case 14: {
        // Chapter 15 (`拉卡湖的激戰`): Branches opening dialogue on `partyHasHero(12)` (`#12 凱麗`)!
        await this.host.playDialogueIndex(this.partyHasHero(12) ? 2 : 5);
        await this.host.panCameraSmooth(28, 20, 380);
        await this.playChoreo(48);
        this.focusSlot(0);
        break;
      }

      case 15: {
        // Chapter 16 (`冰原之戰`)
        await this.host.playDialogueIndex(0);
        this.focusSlot(0);
        break;
      }

      case 16: {
        // Chapter 17 (`血與冰之刃`): Only spawns Wave 1 (`slot 52` guest `#18 蜜蒂`) if `#18 蜜蒂` did NOT join in Ch 16!
        if (!this.partyHasHero(18)) {
          this.spawnWave(1, true);
        }
        await this.host.playDialogueIndex(0);
        this.focusSlot(0);
        break;
      }

      case 17: {
        // Chapter 18 (`遙遠的彼岸`)
        await this.host.playDialogueIndex(0);
        await this.host.panCameraSmooth(20, 8, 380);
        await this.playChoreo(54);
        await this.host.playDialogueIndex(1);
        this.focusSlot(0);
        break;
      }

      case 18:
      case 19:
      case 20: {
        // Chapters 19, 20, 21
        await this.host.playDialogueIndex(0);
        this.focusSlot(0);
        break;
      }

      case 21: {
        // Chapter 22 (`遠古的呼喚` — Golden Castle Awakening)
        await this.host.panCameraSmooth(20, 30, 380);
        await this.host.playDialogueIndex(0);
        this.focusSlot(0);
        break;
      }

      case 22: {
        // Chapter 23 (`向天空之旅`): Party arrives via Lightning Teleportation!
        const partySlots = this.host.getSlots().slice(0, ch.maxDeploy).filter((u): u is BattleUnit => Boolean(u));
        for (const u of partySlots) u.hidden = true;
        this.host.snapCameraToTile(19, 34);
        await this.playLightning(19, 34);
        for (const u of partySlots) u.hidden = false;
        await this.host.playDialogueIndex(0);
        await this.host.panCameraSmooth(19, 30, 360);
        await this.playChoreo(68);
        await this.host.playDialogueIndex(1);
        await this.playChoreo(69);
        await this.host.playDialogueIndex(2);
        await this.playChoreo(70);
        await this.host.playDialogueIndex(3);
        await this.host.panCameraSmooth(19, 16, 420);
        this.spawnWave(1, true);
        await this.host.playDialogueIndex(4);
        this.focusSlot(0);
        break;
      }

      case 23: {
        // Chapter 24 (`在天空的彼方` — `fn_145604`): Plays `dlg[0]`, spawns `Wave 1` (`fn_2894(1)`), and pans 4 corners!
        await this.host.playDialogueIndex(0);
        this.spawnWave(1, true);
        await this.host.panCameraSmooth(6, 6, 320);
        await this.host.panCameraSmooth(6, 24, 320);
        await this.host.panCameraSmooth(28, 24, 320);
        await this.host.panCameraSmooth(28, 6, 320);
        this.focusSlot(0);
        break;
      }

      case 24: {
        // Chapter 25 (`火焰的審判`): 4 escalating earthquakes (`20, 20, 20, 60`)!
        await this.host.panCameraSmooth(11, 5, 360);
        await this.host.playDialogueIndex(1);
        await this.playEarthquake(20);
        await this.playEarthquake(20);
        await this.playEarthquake(20);
        await this.playEarthquake(45);
        await this.host.playDialogueIndex(2);
        this.focusSlot(0);
        break;
      }

      case 25: {
        // Chapter 26 (`未知的迴廊`)
        this.host.snapCameraToTile(15, 42);
        await this.playChoreo(76);
        await this.host.playDialogueIndex(0);
        this.focusSlot(0);
        break;
      }

      case 26: {
        // Chapter 27 (`命運的交會點`): Checks `100 天空之鑰` + 3 Lightning strikes!
        this.host.snapCameraToTile(15, 50);
        await this.playChoreo(76);
        await this.host.playDialogueIndex(0);
        const hasSkyKey = Boolean(this.partyHasItem(100));
        await this.host.playDialogueIndex(hasSkyKey ? 3 : 4);
        await this.playLightning(15, 49);
        await this.host.playDialogueIndex(5);
        await this.playLightning(15, 47);
        await this.playChoreo(81);
        await this.host.playDialogueIndex(6);
        await this.playLightning(15, 46);
        this.focusSlot(0);
        break;
      }

      case 27: {
        // Chapter 28 (`探索者` — True Route, `fn_146589`):
        // 20 heroes materialize by lightning + `Choreo 85 x 3` + `dlg[0]` + `Wave 6` (`#116/#115` guards) & `Wave 7` (`#112/#115` guards)!
        const partySlots = this.host.getSlots().slice(0, ch.maxDeploy).filter((u): u is BattleUnit => Boolean(u));
        for (const u of partySlots) u.hidden = true;
        this.host.snapCameraToTile(31, 18);
        await this.playLightning(31, 18);
        for (const u of partySlots) u.hidden = false;
        await this.playChoreo(85);
        await this.playChoreo(85);
        await this.playChoreo(85);
        await this.host.playDialogueIndex(0);
        await this.panAndSpawnWave(0, 16, 6);
        await this.panAndSpawnWave(7, 16, 7);
        this.focusSlot(0);
        break;
      }

      case 28: {
        // Chapter 29 (`無邊的黑暗之中`): Spawns initial `Wave 8` (`56` fortress guards; `slots 20..22` reserved for `Wave 1` 3 Dragons)!
        // Reserve `slots 20..22` for Wave 1's 3 Dragons (`#104 火龍 / #127 暗黑龍 / #105 雷龍`) if needed:
        if (this.host.getNextSlotIndex() === 20) {
          this.host.setNextSlotIndex(23);
        }
        this.spawnWave(8, true);
        this.host.snapCameraToTile(15, 56);
        await this.playChoreo(86);
        await this.host.playDialogueIndex(7);
        this.focusSlot(0);
        break;
      }

      case 29: {
        // Chapter 30 (`傳說的終章` — `fn_147004`: Final Boss `#126 空魔神` + 4 Elemental Demon Gods `#122..#125`!)
        await this.playChoreo(87);
        await this.host.panCameraSmooth(22, 22, 380);
        await this.host.playDialogueIndex(0);
        await this.host.panCameraSmooth(22, 6, 420);
        await this.teleportSlotWithSparkles(21, 21, 5); // `#125 火魔神`
        await this.teleportSlotWithSparkles(22, 23, 5); // `#124 風魔神`
        await this.teleportSlotWithSparkles(23, 20, 5); // `#123 水魔神`
        await this.teleportSlotWithSparkles(24, 24, 5); // `#122 地魔神`
        await this.host.playDialogueIndex(1);
        this.host.setScreenFlashAlpha('#ffffff', 0.85);
        await this.sleep(180);
        this.host.setScreenFlashAlpha('#ffffff', 0);
        await this.host.playDialogueIndex(2);
        await this.host.panCameraSmooth(22, 18, 380);
        await this.teleportSlotWithSparkles(24, 22, 18); // `#122 地魔神` steps down to central altar `(22, 18)`!
        await this.teleportSlotWithSparkles(25, 21, 18); // Bodyguard `#111 黑暗法師`
        await this.teleportSlotWithSparkles(26, 23, 18); // Bodyguard `#111 黑暗法師`
        this.focusSlot(0);
        break;
      }
    }
  }

  // =========================================================================
  // 3. MID-BATTLE EVENTS (`EV 0 .. EV 84`: Turn, Step-On, Chest & Death Drops)
  // =========================================================================

  /**
   * Executes mid-battle event `eventId`.
   * For Ch 26 `EV 58` (Choose-1-of-5 Legendary Weapons Vault), `chestIndexOverride` (`0..4`) selects which weapon chest was opened!
   */
  async runMidBattleEvent(
    eventId: number,
    triggerUnit?: BattleUnit,
    chestIndexOverride?: number
  ): Promise<boolean> {
    this.skipRequested = false;
    const ch = this.host.getChapter();
    if (!ch) return false;

    switch (eventId) {
      case 0: {
        // EV 0 (Ch 1 Turn 3): `#1 哈諾` arrives (`Wave 3` at `Lv 1`, `HP 36, AP 7, DP 4, [32 手斧, 128 布衣]`) + `#3 哈瓦特` (`Wave 7`)!
        const w3 = this.spawnWave(3, false); // `#1 哈諾` controllable player unit on map!
        this.recruitHero(1); // Permanently adds `#1 哈諾` copying `w3[0]`'s authentic Lv 1 stats!
        if (w3[0]) await this.host.panCameraSmooth(w3[0].x, w3[0].y, 380);
        await this.playChoreo(7);
        await this.host.playDialogueIndex(11);
        this.spawnWave(7, false); // `#3 哈瓦特` guest ally!
        await this.playChoreo(8);
        await this.host.playDialogueIndex(3);
        break;
      }

      case 1: {
        // EV 1 (Ch 1 Turn 5): Wave 4 brigands teleport with sparkles!
        await this.host.panCameraSmooth(15, 18, 380);
        await this.sparkleWave(4, false);
        await this.playChoreo(3);
        await this.host.playDialogueIndex(4);
        break;
      }

      case 2: {
        // EV 2 (Ch 1 Turn 5): Wave 5 Boss brigand leader teleports with sparkles (`fn_141721(5)`) + `Choreo 4` + `dlg[5]`!
        await this.host.panCameraSmooth(4, 18, 380);
        await this.sparkleWave(5, false);
        await this.playChoreo(4);
        await this.host.playDialogueIndex(5);
        break;
      }

      case 3: {
        // EV 3 (Ch 1 Turn 6): Wave 6 imperial patrol arrives (`GLOBAL_2_15098 = 1`, `fn_2894(6)`) + `Choreo 6` + `dlg[6]`!
        await this.host.panCameraSmooth(15, 14, 380);
        this.spawnWave(6, true);
        await this.playChoreo(6);
        await this.host.playDialogueIndex(6);
        break;
      }

      case 4: {
        // EV 4 (Ch 1 death of `#1 哈諾`): `#3 哈瓦特` (`slots[13]`) goes berserk (`faction = 'ally', aiMode = 0`) + `dlg[7]`!
        const harvard =
          this.host.getSlots()[13] ??
          this.host.getSlots().find((u) => u && (u.baseHeroId ?? u.uid) === 3);
        if (harvard && harvard.hp > 0 && !harvard.hidden) {
          harvard.faction = 'ally';
          harvard.aiMode = 0;
        }
        await this.host.playDialogueIndex(7);
        break;
      }

      case 5: {
        // EV 5 (Ch 13 Turn 4): Wave 1 reinforcements + `dlg[1]`!
        this.spawnWave(1, false);
        await this.host.playDialogueIndex(1);
        break;
      }

      case 6: {
        // EV 6 (Ch 2 Turn 3): Northern brigand reinforcements (`GLOBAL_2_15098 = 1`, `Wave 3`, `Choreo 13`, `dlg[4]`),
        // and updates villagers `slots[5..10]` (`#133/#134`) escape destination to `(26, 15)`!
        await this.host.panCameraSmooth(9, 1, 380);
        this.spawnWave(3, true);
        await this.playChoreo(13);
        await this.host.playDialogueIndex(4);
        for (const u of this.host.getSlots()) {
          if (u && (u.uid === 133 || u.uid === 134)) {
            u.aiTargetX = 26;
            u.aiTargetY = 15;
          }
        }
        break;
      }

      case 7: {
        // EV 7 (Ch 13 Turn 9): `pan(12, 3)` + `Wave 2` (`GLOBAL_2_15098 = 1`) + `Choreo 46` + `dlg[8]`!
        await this.host.panCameraSmooth(12, 3, 380);
        this.spawnWave(2, true);
        await this.playChoreo(46);
        await this.host.playDialogueIndex(8);
        break;
      }

      case 8: {
        // EV 8:
        // - Ch 1 (`ch.id === 0`): `#3 哈瓦特` death speech `dlg[8]`.
        // - Ch 13 (`ch.id === 12`): Non-kill Sol step trigger at `(24, 5)`!
        //   ONLY triggers when `#0 索爾` (`slot 0` / `baseHeroId === 0`) steps on `(24, 5)` with `< 8` items and `flag[16] === 0`!
        if (ch.id === 0) {
          await this.host.playDialogueIndex(8);
        } else {
          if (this.flags[16] !== 0) return false;
          const isSol = triggerUnit && (triggerUnit.slotIndex === 0 || (triggerUnit.baseHeroId ?? triggerUnit.uid) === 0);
          if (!isSol) return false;
          if (triggerUnit.items.length >= 8) {
            this.host.logMessage(
              tr(
                '索爾的道具袋已滿（8/8），無法拾取地上閃光的物品！',
                '索尔的道具袋已满（8/8），无法拾取地上闪光的物品！',
                "Sol's item bag is full (8/8); cannot pick up the sparkling item on the ground!"
              )
            );
            return false;
          }
          this.flags[16] = 1;
          this.grantItemToParty(89, triggerUnit); // `#89 勇者徽章`!
          await this.host.playDialogueIndex(11);
        }
        break;
      }

      case 9: {
        // EV 9 (Ch 3 Turn 3): Checks `!fn_148798(6)` (`slot 6` `#2 鐵諾` alive) before spawning `Wave 2` + `dlg[4]`!
        if (!this.isSlotDead(6)) {
          this.spawnWave(2, false);
          await this.host.panCameraSmooth(3, 0, 320);
          await this.host.panCameraSmooth(3, 17, 320);
          await this.host.playDialogueIndex(4);
        }
        break;
      }

      case 10: {
        // EV 10 (Ch 14 step event): Wakes `slots[16..71]` (`fn_147868(16, 71, 0)`), sets `flag[16] = 1`, plays `dlg[1]`!
        if (triggerUnit) this.unlockMapPassagesNear(triggerUnit.x, triggerUnit.y, 4);
        this.setSlotsAiMode(16, 71, 0);
        this.flags[16] = 1;
        await this.host.playDialogueIndex(1);
        break;
      }

      case 11: {
        // EV 11 (Ch 4 Turn 4): Spawns `Wave 2` + `dlg[2]`!
        if (ch.id === 3) {
          this.spawnWave(2, false);
          await this.host.playDialogueIndex(2);
        } else if (ch.id === 1) {
          await this.host.playDialogueIndex(3);
        }
        break;
      }

      case 12: {
        // EV 12 (Ch 4 defeat of any of the 4 corner Beastmen `slots[24..27]`):
        // Sets remaining corner Beastmen `slots[24..27]` to `aiMode = 7` (Retreat / Escape, `fn_147868(24, 27, 7)`),
        // sets `flag[16] = 1`, and plays `dlg[3]`!
        this.setSlotsAiMode(24, 27, 7);
        this.flags[16] = 1;
        await this.host.playDialogueIndex(3);
        break;
      }

      case 13: {
        // EV 13 (Ch 15 Turn 4):
        // Plays `dlg[6]`, wakes enemy Beastmen `slots[35..49]` to `aiMode = 0` (`fn_147868(35, 49, 0)`),
        // and sets `#15 塞可邦勒` + 9 `#71 豹人` (`slots[64..73]`) to `aiMode = 3, aiTargetX = 0` (escort `#0 索爾`)!
        await this.host.playDialogueIndex(this.CreateSafeDlgIdx(ch, 6));
        this.setSlotsAiMode(35, 49, 0);
        const slots = this.host.getSlots();
        for (let s = 64; s <= 73; s++) {
          const u = slots[s];
          if (u && u.hp > 0 && !u.hidden) {
            u.aiMode = (u.aiMode & 0xc0) | 3;
            u.aiTargetX = 0;
          }
        }
        break;
      }

      case 14: {
        // EV 14 (Ch 5 Turn 3): Wakes `slots[13..24]` & `slots[37..40]` to `aiMode = 0` + `dlg[3]`!
        this.setSlotsAiMode(13, 24, 0);
        this.setSlotsAiMode(37, 40, 0);
        await this.host.playDialogueIndex(3);
        break;
      }

      case 15: {
        // EV 15 (Ch 5 Turn 4): Spawns `Wave 2` (`GLOBAL_2_15098 = 1`), pans `(14, 0)`, plays `Choreo 23`, wakes `slots[7..12]` & `slots[33..35]`, plays `dlg[4]`!
        this.spawnWave(2, true);
        await this.host.panCameraSmooth(14, 0, 380);
        await this.playChoreo(23);
        this.setSlotsAiMode(7, 12, 0);
        this.setSlotsAiMode(33, 35, 0);
        await this.host.playDialogueIndex(4);
        break;
      }

      case 16: {
        // EV 16 (Ch 5 Turn 7): Spawns `Wave 3` (`slots[48..51]` 4 corner Beastmen) + `dlg[5]`!
        this.spawnWave(3, false);
        await this.host.playDialogueIndex(5);
        break;
      }

      case 17: {
        // EV 17 (Ch 5 Turn 8): Sets `slots[48..51]` to `aiMode = 7` (Retreat), plays `dlg[6]`, `Choreo 24`, `dlg[7]`!
        this.setSlotsAiMode(48, 51, 7);
        await this.host.playDialogueIndex(6);
        await this.playChoreo(24);
        await this.host.playDialogueIndex(7);
        break;
      }

      case 18: {
        // EV 18 (Ch 15 Turn 9): Plays `dlg[8]` and wakes `slots[16..34]` to `aiMode = 0` (`fn_147868(16, 34, 0)`)!
        await this.host.playDialogueIndex(this.CreateSafeDlgIdx(ch, 8));
        this.setSlotsAiMode(16, 34, 0);
        break;
      }

      case 19: {
        // EV 19 (Ch 5 defeat of Boss `#117 卡特那`):
        // Sets remaining enemies `slots[7..36]` to `aiMode = 7` (Retreat), plays `dlg[8]`,
        // and if any enemy in `slots[7..36]` is still alive, plays `dlg[11]` ("快逃啊！")!
        this.setSlotsAiMode(7, 36, 7);
        await this.host.playDialogueIndex(8);
        let anyEnemyAlive = false;
        for (let s = 7; s <= 36; s++) {
          if (!this.isSlotDead(s)) {
            anyEnemyAlive = true;
            break;
          }
        }
        if (anyEnemyAlive) {
          await this.host.playDialogueIndex(this.CreateSafeDlgIdx(ch, 11));
        }
        break;
      }

      case 20: {
        // EV 20 (Ch 6 Turn 5): Plays `dlg[1]`!
        await this.host.playDialogueIndex(1);
        break;
      }

      case 21: {
        // EV 21 (Ch 6 Turn 10): ONLY plays `dlg[2]` if `slot 8` (`#77 精英戰士`) is still alive (`!fn_148798(8)`)!
        if (!this.isSlotDead(8)) {
          await this.host.playDialogueIndex(2);
        }
        break;
      }

      case 22: {
        // EV 22 (Ch 6 Turn 15): ONLY spawns `Wave 1` (4 ally mercenaries) + `dlg[3]` if `slot 8` (`#77 精英戰士`) is still alive!
        if (!this.isSlotDead(8)) {
          this.spawnWave(1, false);
          await this.host.playDialogueIndex(3);
        }
        break;
      }

      case 23: {
        // EV 23 (Ch 6 drop of `slot 8` `#77 精英戰士`):
        // Wakes `slots[8..28]` AI (`fn_147868(8, 28, 0)`), plays `dlg[4]`, and ONLY if `turn < 15`, spawns Wave 2 & `#118 萊汀` (`slot 33`) retreats!
        this.setSlotsAiMode(8, 28, 0);
        await this.host.playDialogueIndex(4);
        if (this.host.getTurn() < 15) {
          this.spawnWave(2, false);
          await this.host.panCameraSmooth(9, 19, 380);
          await this.playChoreo(25);
          await this.host.playDialogueIndex(5);
          await this.playChoreo(26);
          this.hideSlot(33); // `#118 萊汀` retreats!
        }
        break;
      }

      case 24: {
        // EV 24 (Ch 7 defeat of `#83 突擊騎兵` commander): Plays `dlg[3]`!
        await this.host.playDialogueIndex(3);
        break;
      }

      case 25: {
        // EV 25 (Ch 7 Turn 10 Phase 0): ONLY spawns Wave 2 (`slot 43` `#12 凱麗`, `GLOBAL_2_15098 = 1`) if road step `EV 26` set `flag[16] === 1`!
        if (this.flags[16] === 1) {
          this.spawnWave(2, true);
          await this.host.panCameraSmooth(16, 10, 380);
          await this.playChoreo(30);
          await this.host.playDialogueIndex(2);
          this.flags[17] = 1;
        }
        break;
      }

      case 26: {
        // EV 26 (Ch 7 road step trigger `(9,13)..(14,15)`): Wakes `slots[9..27]` AI and sets `flag[16] = 1`!
        this.setSlotsAiMode(9, 27, 0);
        this.flags[16] = 1;
        break;
      }

      case 27: {
        // EV 27 (Ch 8 Turn-based river reinforcements `fn_153634(7, 0, turn)`)!
        await this.panAndSpawnWave(7, 0, this.host.getTurn());
        break;
      }

      case 28: {
        // EV 28 (Ch 8 Turn 15): Wakes `slots[10..27]` to `aiMode = 0` (`fn_147868(10, 27, 0)`)!
        this.setSlotsAiMode(10, 27, 0);
        break;
      }

      case 29: {
        // EV 29 (Ch 8 defeat of `#83 突擊騎兵` commander): Plays `dlg[2]` and wakes `slots[10..27]` to `aiMode = 0`!
        await this.host.playDialogueIndex(2);
        this.setSlotsAiMode(10, 27, 0);
        break;
      }

      case 30: {
        // EV 30 (Ch 9 `騎士的抉擇` defeat of Enemy Boss `#118 萊汀` `slot 11` — `fn_150138`):
        //  1. `#118 萊汀` (`slot 11`) survives at `1 HP` and defects in-place to Ally `#6 萊汀` (`aiMode = 0x80`)!
        //  2. Wakes remaining enemies `slots[12..33]` to `aiMode = 0`.
        //  3. Plays `dlg[2]`, spawns `Wave 1` (top cavalry reinforcements), plays `dlg[3]`.
        //  4. Sets `flag[16] = 2` and schedules `turnEvents[0]` (`EV 31` at `turn + 1` -> `Wave 2`)
        //     and `turnEvents[1]` (`EV 31` at `turn + 2` -> `Wave 3`)!
        const leiding =
          this.host.getSlots()[11] ??
          this.host.getSlots().find((u) => u && (u.uid === 118 || u.uid === 6));
        if (leiding) {
          leiding.hp = 1;
          leiding.hidden = false;
          leiding.faction = 'ally';
          leiding.uid = 6;
          leiding.baseHeroId = 6;
          leiding.portraitId = 6;
          leiding.aiMode = 0x80;
          leiding.drop = null;
        }
        this.setSlotsAiMode(12, 33, 0);
        await this.host.playDialogueIndex(2);
        this.spawnWave(1, false);
        await this.host.playDialogueIndex(3);
        this.flags[16] = 2;
        this.scheduleTurnEventSlot(0, this.host.getTurn() + 1, 0);
        this.scheduleTurnEventSlot(1, this.host.getTurn() + 2, 0);
        break;
      }

      case 31: {
        // EV 31 (Ch 9 Dynamically Scheduled Side Reinforcements `Wave 2` & `Wave 3` — `fn_150410`):
        const wave = this.flags[16] >= 2 ? this.flags[16] : 2;
        this.spawnWave(wave, false);
        await this.host.panCameraSmooth(0, 0, 240);
        await this.host.panCameraSmooth(12, 0, 240);
        await this.host.panCameraSmooth(12, 11, 240);
        await this.host.panCameraSmooth(0, 11, 240);
        this.flags[16] = wave + 1;
        break;
      }

      case 32: {
        // EV 32 (Ch 10 Turn 5): `fn_153634(9, 25, 1)` + `dlg[1]`!
        await this.panAndSpawnWave(9, 25, 1);
        await this.host.playDialogueIndex(1);
        break;
      }

      case 33: {
        // EV 33 (Ch 10 Turn 20): Plays `dlg[2]` and wakes `slots[12..13]` to `aiMode = 0` (`fn_147868(12, 13, 0)`)!
        await this.host.playDialogueIndex(2);
        this.setSlotsAiMode(12, 13, 0);
        break;
      }

      case 34: {
        // EV 34 (Ch 10 defeat of Boss `#122 地魔神`): Plays `dlg[3]`!
        await this.host.playDialogueIndex(3);
        break;
      }

      case 35: {
        // EV 35 (Ch 11 Turn 3): `pan(9, 4)` + `Wave 2` (`GLOBAL_2_15098 = 1`) + `Choreo 39` + `dlg[2]`!
        await this.host.panCameraSmooth(9, 4, 360);
        this.spawnWave(2, true);
        await this.playChoreo(39);
        await this.host.playDialogueIndex(2);
        break;
      }

      case 36: {
        // EV 36 (Ch 12 Turn 5): Sets `slot 14` (`#17 米亞斯多德`) to `aiMode = 0x83` (`131` = self-preservation + follow `#13 貝克威 / #14 珊`)!
        this.setSlotsAiMode(14, 14, 0x83);
        break;
      }

      case 37: {
        // EV 37 (Ch 12 Turn 6): `dlg[1]` + `Wave 2 (Choreo 42)` + `Wave 3 (Choreo 43)` + `Wave 4 (Choreo 44)` (`GLOBAL_2_15098 = 1`) + `dlg[2]`!
        await this.host.playDialogueIndex(1);
        await this.host.panCameraSmooth(12, 30, 340);
        this.spawnWave(2, true);
        await this.playChoreo(42);
        await this.host.panCameraSmooth(0, 22, 340);
        this.spawnWave(3, true);
        await this.playChoreo(43);
        await this.host.panCameraSmooth(18, 22, 340);
        this.spawnWave(4, true);
        await this.playChoreo(44);
        await this.host.playDialogueIndex(2);
        break;
      }

      case 38: {
        // EV 38 (Ch 15 Turn 7): Spawns Wave 1 (`slot 74` `#102 獸人` carrying `#211 光之眼` event drop!) + `dlg[10]`
        await this.panAndSpawnWave(15, 0, 1);
        await this.host.playDialogueIndex(this.CreateSafeDlgIdx(ch, 10));
        break;
      }

      case 39: {
        // EV 39 (Ch 15 drop of `slot 74` `#102 獸人`): Awards Sacred Artifact `#211 光之眼` (`GLOBAL_2_10050 = 211`) + `dlg[11]`!
        this.grantItemToParty(211, triggerUnit); // `#211 光之眼`!
        await this.host.playDialogueIndex(11);
        break;
      }

      case 40: {
        // EV 40 (Ch 17 Turn 4): Spawns `Wave 2`, pans `(14, 33)`, plays `dlg[1]`!
        this.spawnWave(2, false);
        await this.host.panCameraSmooth(14, 33, 360);
        await this.host.playDialogueIndex(1);
        break;
      }

      case 41: {
        // EV 41 (Ch 17 drop of `#123 水魔神` `slot 16`): Plays `dlg[3]`, awards Sacred Artifact `#213 冰之眼` (`GLOBAL_2_10053 = 213`), plays `dlg[4]`!
        await this.host.playDialogueIndex(3);
        this.grantItemToParty(213, triggerUnit); // `#213 冰之眼`!
        await this.host.playDialogueIndex(4);
        break;
      }

      case 42: {
        // EV 42 (Ch 18 Turn 8): `fn_153634(14, 32, 1)` + `dlg[6]`!
        await this.panAndSpawnWave(14, 32, 1);
        await this.host.playDialogueIndex(6);
        break;
      }

      case 43: {
        // EV 43 (Ch 18 Turn 3): Sets `slot 16` to `aiMode = 3` (`fn_147868(16, 16, 3)`)!
        this.setSlotsAiMode(16, 16, 3);
        break;
      }

      case 44: {
        // EV 44 (Ch 19 Turn 4): Sets `slots[29..59]` to `aiMode = 3` (`fn_147868(29, 59, 3)`)!
        this.setSlotsAiMode(29, 59, 3);
        break;
      }

      case 45: {
        // EV 45 (Ch 19 Turn 10): Sets `slots[16..31]` to `aiMode = 3` (`fn_147868(16, 31, 3)`)!
        this.setSlotsAiMode(16, 31, 3);
        break;
      }

      case 46: {
        // EV 46 (Ch 19 Turn 6 Phase 1): `#27 巴拿羅西亞` arrives (`fn_153634(6, 0, 1)`) + `dlg[1]` + joins!
        await this.panAndSpawnWave(6, 0, 1);
        await this.host.playDialogueIndex(1);
        this.recruitHero(27); // `#27 巴拿羅西亞`!
        break;
      }

      case 47: {
        // EV 47 (Ch 21 Turns 2, 4, 6, 8 — `fn_151826`): Spawns `Wave 1..4` (`turn / 2`), pans 4 corners, plays `dlg[3]` on Turn 2!
        const w = Math.max(1, Math.min(4, Math.floor(this.host.getTurn() / 2)));
        this.spawnWave(w, false);
        await this.host.panCameraSmooth(0, 0, 220);
        await this.host.panCameraSmooth(28, 0, 220);
        await this.host.panCameraSmooth(28, 32, 220);
        await this.host.panCameraSmooth(0, 32, 220);
        if (this.host.getTurn() === 2) {
          await this.host.playDialogueIndex(this.CreateSafeDlgIdx(ch, 3));
        }
        break;
      }

      case 48: {
        // EV 48 (Ch 21 Turn 3 — `fn_152006`): Sets `slots[35..42]` and `slots[67..74]` to `aiMode = 3`!
        this.setSlotsAiMode(35, 42, 3);
        this.setSlotsAiMode(67, 74, 3);
        break;
      }

      case 49: {
        // EV 49 (Ch 22 Turns 3, 7): Spawns `Wave 1` (Turn 3) or `Wave 3` (Turn 7) at `(15, 0)` + `dlg[1]` on Turn 3!
        const w = this.host.getTurn() <= 3 ? 1 : 3;
        await this.panAndSpawnWave(15, 0, w);
        if (w === 1) {
          await this.host.playDialogueIndex(1);
        }
        break;
      }

      case 50: {
        // EV 50 (Ch 22 Turn 5 Phase 2): `#20 莎拉` arrives and joins!
        this.spawnWave(2, false);
        await this.host.panCameraSmooth(10, 42, 360);
        this.recruitHero(20); // `#20 莎拉`!
        await this.host.playDialogueIndex(2);
        break;
      }

      case 51: {
        // EV 51 (Ch 22 drop of `#124 風魔神`): Awards `#101 傳送法杖` (`GLOBAL_2_10056 = 101`) + `dlg[3]`!
        this.grantItemToParty(101, triggerUnit); // `#101 傳送法杖`!
        await this.host.playDialogueIndex(3);
        break;
      }

      case 52: {
        // EV 52 (Ch 23 Turns 13, 15, 18, 22): Spawns left & right mecha waves (`(2,11)` & `(26,11)`)!
        const t = this.host.getTurn();
        const baseW = t <= 13 ? 2 : t <= 15 ? 4 : t <= 18 ? 6 : 8;
        await this.panAndSpawnWave(2, 11, baseW);
        await this.panAndSpawnWave(26, 11, baseW + 1);
        break;
      }

      case 53: {
        // EV 53 (Ch 23 defeat of `#116 機甲隊長` `slot 18`):
        // Plays `dlg[5]` and calls `fn_154554(18)` (`wipeEnemiesFromSlot(18)`), causing all remaining enemy mecha
        // to spin & explode on the map, winning Chapter 23 immediately!
        await this.host.playDialogueIndex(5);
        await this.wipeEnemiesFromSlot(18);
        break;
      }

      case 54: {
        // EV 54 (Ch 24 Turns 2, 4, 7, 10 — `fn_152413`): Spawns 4-corner fortress waves (`2, 4, 7, 10`)!
        const t = this.host.getTurn();
        const w = t <= 2 ? 2 : t <= 4 ? 4 : t <= 7 ? 7 : 10;
        this.spawnWave(w, false);
        await this.host.panCameraSmooth(0, 4, 220);
        await this.host.panCameraSmooth(0, 22, 220);
        await this.host.panCameraSmooth(26, 24, 220);
        await this.host.panCameraSmooth(26, 2, 220);
        break;
      }

      case 55: {
        // EV 55 (Ch 25 step at `(10, 1)` — `fn_152538`):
        // ONLY triggers when `#0 索爾` (`slot 0` / `baseHeroId === 0`) steps on `(10, 1)` while `flag[0] === 0`!
        // Runs scripted 1v1 cutaway duel vs `#104 火龍` (`slot 17`); if `#104 火龍` is defeated, sets `flag[0] = 1`,
        // calls `fn_8803()` (`applyDynamicMapTileSwaps` unlocking gate `(10, 0)`), & awards `#11 炎龍劍`!
        if (this.flags[0] !== 0) return false;
        const isSol = triggerUnit && (triggerUnit.slotIndex === 0 || (triggerUnit.baseHeroId ?? triggerUnit.uid) === 0);
        if (!isSol) return false;
        const dragon = this.host.getSlots()[17];
        if (!dragon || dragon.hp <= 0) return false;

        await this.host.playDialogueIndex(0);
        await this.host.playScriptedCutawayDuel(triggerUnit.slotIndex, 17);
        if (dragon.hp <= 0 && triggerUnit.hp > 0) {
          this.flags[0] = 1;
          this.applyDynamicMapTileSwaps();
          this.grantItemToParty(11, triggerUnit); // `#11 炎龍劍` (`GLOBAL_2_10059 = 11`)!
          await this.host.playDialogueIndex(this.CreateSafeDlgIdx(ch, 5));
        } else {
          return false; // Allow Sol to step again next turn if `#104 火龍` survived the round!
        }
        break;
      }

      case 56: {
        await this.host.panCameraSmooth(10, 38, 360);
        this.spawnWave(1, true);
        await this.playChoreo(74);
        await this.host.playDialogueIndex(this.CreateSafeDlgIdx(ch, 5));
        break;
      }

      case 57: {
        // Ch 26 Turn-based reinforcement waves (`waveGroup == turn`)!
        this.spawnWave(this.host.getTurn(), false);
        break;
      }

      case 58: {
        // EV 58 (Ch 26 Central Vault `chestIndex = 0..4` — Choose-1-of-5 Legendary Weapons, `fn_152830`):
        // `GLOBAL_2_10062 = [29 戰神戟, 43 魔神斧, 51 風神弓, 61 光之杖, 71 魔龍爪]`!
        // Opening ANY 1 chest sets `flag[0..4] = 1` and calls `fn_8803()` (`applyDynamicMapTileSwaps`), permanently sealing the other 4 chests!
        const VAULT_WEAPONS = [29, 43, 51, 61, 71];
        const ci = Math.max(0, Math.min(4, chestIndexOverride ?? 0));
        if (this.flags[ci] !== 0) {
          this.host.logMessage(
            tr(
              '其他四座神兵寶箱已被古代機關永久封印！',
              '其他四座神兵宝箱已被古代机关永久封印！',
              'The other four sacred weapon chests have been permanently sealed by the ancient mechanism!'
            )
          );
          return false;
        }
        if (triggerUnit && triggerUnit.items.length >= 8) {
          this.host.logMessage(
            tr(
              `${triggerUnit.nameZh} 的道具袋已滿（8/8），請先空出欄位再開啟神兵寶箱！`,
              `${triggerUnit.nameZh} 的道具袋已满（8/8），请先空出栏位再开启神兵宝箱！`,
              `${triggerUnit.nameZh}'s inventory is full (8/8). Free a slot before opening the sacred chest!`
            )
          );
          return false;
        }
        const weaponId = VAULT_WEAPONS[ci];
        const ok = this.grantItemToParty(weaponId, triggerUnit);
        if (!ok) return false;
        for (let k = 0; k < 5; k++) this.flags[k] = 1;
        this.applyDynamicMapTileSwaps();
        this.host.logMessage(
          tr(
            '<strong>古代封印發動：</strong> 其餘四座神兵寶箱隨之沉入封印！',
            '<strong>古代封印发动：</strong> 其余四座神兵宝箱随之沉入封印！',
            '<strong>Ancient Seal Activated:</strong> The remaining four sacred chests sink into the seal!'
          )
        );
        break;
      }

      case 59: {
        // EV 59 (Ch 26 step trigger — `fn_153153`): Wakes `slots[39..44]` to `aiMode = 0` (`fn_147868(39, 44, 0)`)!
        this.setSlotsAiMode(39, 44, 0);
        break;
      }

      case 60: {
        // EV 60 (Ch 26 step trigger — `fn_153205`): Wakes `slots[23..24]` & `slots[53..56]` to `aiMode = 0`!
        this.setSlotsAiMode(23, 24, 0);
        this.setSlotsAiMode(53, 56, 0);
        break;
      }

      case 61: {
        // EV 61 (Ch 26 step at `(1, 46)` — `#208 控制中樞` awakens `#31 渥德` via `FDOTHER[45]` + `fn_8803()`, `fn_153271`!):
        if (this.flags[12] !== 0) return false;
        const unitIdx = triggerUnit ? triggerUnit.items.indexOf(208) : -1;
        if (unitIdx < 0) {
          // Stepping unit does NOT hold `#208 控制中樞` -> plays `dlg[2]` and leaves `flag[12] = 0`!
          await this.host.playDialogueIndex(2);
          return false;
        }
        // Consume `#208 控制中樞` from stepping unit's bag!
        triggerUnit!.items.splice(unitIdx, 1);

        await this.host.playDialogueIndex(3);
        const tx = triggerUnit ? triggerUnit.x : 1;
        const ty = triggerUnit ? triggerUnit.y : 46;
        await this.playSpecialStripOnMap(45, tx, ty); // `FDOTHER[45]` 59-frame Awakening Animation!
        this.flags[12] = 1;
        this.applyDynamicMapTileSwaps(); // Unlocks `(1, 44)` & `(1, 45)` from tiles `88, 90` to open floor `89, 91`!
        this.spawnWave(1, false); // Spawns `slot 84` `#31 渥德` at `(1, 45)`!
        this.recruitHero(31); // `#31 渥德`!
        await this.host.playDialogueIndex(4);
        break;
      }

      case 62: {
        // EV 62 (Ch 27 step trigger below stele — `fn_153752`): Sets `flag[17] = 1` and schedules `turnEvents[0]` (`EV 63`) for `turn + 1`!
        if (this.flags[17] === 0) {
          this.flags[17] = 1;
          this.scheduleTurnEventSlot(0, this.host.getTurn() + 1, 0);
        }
        break;
      }

      case 63: {
        // EV 63 (Ch 27 scheduled Wave 1 & Wave 2): `fn_153634(3, 27, 1)` + `fn_153634(15, 27, 2)`!
        await this.panAndSpawnWave(3, 27, 1);
        await this.panAndSpawnWave(15, 27, 2);
        break;
      }

      case 64: {
        // EV 64 (Ch 27 death event on the three `#116 機甲隊長` bosses — `fn_153834`):
        // - 1st killed (`flag[16]: 0 -> 1`): increments `flag[16] = 1`.
        // - 2nd killed (`flag[16]: 1 -> 2`): plays `dlg[1]`, spawns Waves 3, 4, 5, sets `flag[16] = 2`.
        // - 3rd killed (`flag[16]: 2 -> 3`): plays `dlg[2]`, sets `flag[16] = 3`, and calls `fn_154554(16)`
        //   (`wipeEnemiesFromSlot(16)`) to spin & explode all remaining enemies, winning Ch 27!
        const stage = this.flags[16];
        if (stage === 0) {
          this.flags[16] = 1;
        } else if (stage === 1) {
          this.flags[16] = 2;
          await this.host.playDialogueIndex(1);
          await this.panAndSpawnWave(9, 44, 3);
          await this.panAndSpawnWave(0, 9, 4);
          await this.panAndSpawnWave(17, 9, 5);
        } else {
          this.flags[16] = 3;
          await this.host.playDialogueIndex(2);
          await this.wipeEnemiesFromSlot(16);
        }
        break;
      }

      case 65: {
        // EV 65 (Ch 28 step trigger crossing left of blue platform — `fn_154011`):
        // Sets `flag[16] = 1` & schedules `turnEvents[0]` (`EV 66`, `phase 0`) for current `turn` (Enemy Phase of same turn)!
        if (this.flags[16] === 0) {
          this.flags[16] = 1;
          this.scheduleTurnEventSlot(0, this.host.getTurn(), 0);
        }
        break;
      }

      case 66: {
        // EV 66 (Ch 28 scheduled Wave 1 — `fn_154056`): `dlg[3]` + `fn_153634(17, 18, 1)` + `dlg[6]`!
        await this.host.playDialogueIndex(this.CreateSafeDlgIdx(ch, 3));
        await this.panAndSpawnWave(17, 18, 1);
        await this.host.playDialogueIndex(this.CreateSafeDlgIdx(ch, 6));
        break;
      }

      case 67: {
        // EV 67 (Ch 28 death event on Wave 1's `#112 機甲突擊兵` — `fn_154159`):
        // Schedules `turnEvents[1]` (`EV 68`, `phase 0`) for current `turn` (or `turn + 1` if killed during Enemy Phase counterattack)!
        const targetTurn = ch.turnEvents[0]?.turn === this.host.getTurn() ? this.host.getTurn() + 1 : this.host.getTurn();
        this.scheduleTurnEventSlot(1, targetTurn, 0);
        break;
      }

      case 68: {
        // EV 68 (Ch 28 scheduled Wave 2 — `fn_154184`): `dlg[4]` + `fn_153634(14, 7, 2)` + `dlg[6]` + `flag[18] = 1`!
        await this.host.playDialogueIndex(this.CreateSafeDlgIdx(ch, 4));
        await this.panAndSpawnWave(14, 7, 2);
        await this.host.playDialogueIndex(this.CreateSafeDlgIdx(ch, 6));
        this.flags[18] = 1;
        break;
      }

      case 69: {
        // EV 69 (Ch 28 step trigger crossing Wave 2 beam turret line — `fn_154296`):
        // ONLY triggers once Wave 2 has spawned (`flag[18] !== 0`) and `flag[17] === 0`;
        // sets `flag[17] = 1` and schedules `turnEvents[2]` (`EV 70`, `phase 0`) for current `turn`!
        if (this.flags[17] !== 0 || this.flags[18] === 0) return false;
        this.flags[17] = 1;
        this.scheduleTurnEventSlot(2, this.host.getTurn(), 0);
        break;
      }

      case 70: {
        // EV 70 (Ch 28 scheduled Waves 3, 4, 5 — `fn_154373`): Wakes `slots[41..45]`, plays `dlg[5]`, spawns Waves 3, 4, 5, plays `dlg[6]`!
        this.setSlotsAiMode(41, 45, 0);
        await this.host.playDialogueIndex(this.CreateSafeDlgIdx(ch, 5));
        await this.panAndSpawnWave(8, 7, 3);
        await this.panAndSpawnWave(4, 7, 4);
        await this.panAndSpawnWave(0, 7, 5);
        await this.host.playDialogueIndex(this.CreateSafeDlgIdx(ch, 6));
        break;
      }

      case 71: {
        // EV 71 (Ch 28 death event on the two `#116 機甲隊長` bosses — `fn_154475`):
        // - 1st killed (`flag[19]: 0 -> 1`): increments `flag[19] = 1`.
        // - 2nd killed (`flag[19]: 1 -> 2`): plays `dlg[2]` and calls `fn_154554(20)` (`wipeEnemiesFromSlot(20)`),
        //   wiping all remaining enemies with explosions and winning Ch 28 immediately!
        if (this.flags[19] === 0) {
          this.flags[19] = 1;
        } else {
          this.flags[19] = 2;
          await this.host.playDialogueIndex(2);
          await this.wipeEnemiesFromSlot(20);
        }
        break;
      }

      case 72: {
        // EV 72 (Ch 29 drop of `idx=17` `#116 機甲隊長` at `(15, 44)` — `fn_154632`): Spawns Waves 2 & 3 + `dlg[8]`!
        await this.panAndSpawnWave(1, 29, 2);
        await this.panAndSpawnWave(18, 29, 3);
        await this.host.playDialogueIndex(8);
        break;
      }

      case 73: {
        // EV 73 (Ch 29 defeat `#104 火龍` — `fn_154715`): Marks `flag[18] = 1`!
        this.flags[18] = 1;
        break;
      }

      case 74: {
        // EV 74 (Ch 29 scheduled reinforcement waves `4..7` — `fn_154731`):
        const w = Math.min(7, Math.max(4, this.flags[16] || 4));
        await this.panAndSpawnWave(10, 29, w);
        if (w < 7) {
          this.flags[16] = w + 1;
          this.scheduleTurnEventSlot(0, this.host.getTurn() + 1, 0);
        }
        break;
      }

      case 75: {
        // EV 75 (Ch 29 step at `(15, 21)` — `#9 悠妮` Dragon Seal Awakening, `fn_154800`!):
        if (this.flags[17] !== 0) return false;
        const isYuni = triggerUnit && (triggerUnit.slotIndex === 1 || (triggerUnit.baseHeroId ?? triggerUnit.uid) === 9);
        if (!isYuni) {
          // Non-Yuni unit steps on `(15, 21)`: plays `dlg[0]` and leaves `flag[17] = 0` so `#9 悠妮` can still step on it!
          await this.host.playDialogueIndex(0);
          return false;
        }
        this.flags[17] = 1;
        this.flags[16] = 4;
        await this.host.playDialogueIndex(1);
        this.scheduleTurnEventSlot(0, this.host.getTurn(), 0); // EV 74 waves 4..7 starting this Enemy Phase!
        this.scheduleTurnEventSlot(1, this.host.getTurn() + 1, 2); // EV 76 3-turn Yuni channeling & 3-Dragon awakening!
        break;
      }

      case 76: {
        // EV 76 (Ch 29 Scheduled 3-Turn Yuni Channeling & Awakening of `#104 火龍`, `#127 暗黑龍`, `#105 雷龍` — `fn_154990`!):
        if (this.flags[17] < 4) {
          // Turns 1..3 of channeling (`flag[17] === 1, 2, 3`): `#9 悠妮` (`slot 1`) is paralyzed/channeling (`fn_13586(1)`)!
          const yuni =
            this.host.getSlots()[1] ??
            this.host.getSlots().find((u) => u && (u.baseHeroId ?? u.uid) === 9);
          if (yuni && yuni.hp > 0 && !yuni.hidden) {
            yuni.acted = true;
            yuni.moved = true;
          }
          this.flags[17] += 1;
          this.scheduleTurnEventSlot(1, this.host.getTurn() + 1, 2);
          break;
        }
        // `flag[17] === 4`: The 3 Dragons awaken at `slots 20..22`!
        await this.host.playDialogueIndex(2);
        await this.host.panCameraSmooth(15, 8, 380);
        const savedNext = this.host.getNextSlotIndex();
        const slots = this.host.getSlots();
        let dragonBaseSlot = 20;
        if (!slots[20] && !slots[21] && !slots[22]) {
          this.host.setNextSlotIndex(20);
          this.spawnWave(1, true);
          this.host.setNextSlotIndex(Math.max(savedNext, 23));
          dragonBaseSlot = 20;
        } else {
          const spawned = this.spawnWave(1, false);
          if (spawned[0]) dragonBaseSlot = spawned[0].slotIndex;
        }
        this.flags[21] = dragonBaseSlot;
        this.host.setScreenFlashAlpha('#ffffff', 0.9);
        await this.sleep(160);
        this.host.setScreenFlashAlpha('#ffffff', 0);
        await this.host.playDialogueIndex(3);
        this.host.setScreenFlashAlpha('#ffffff', 0.9);
        await this.sleep(160);
        this.host.setScreenFlashAlpha('#ffffff', 0);
        await this.host.playDialogueIndex(4);
        this.host.setScreenFlashAlpha('#ffffff', 0.9);
        await this.sleep(160);
        this.host.setScreenFlashAlpha('#ffffff', 0);
        await this.host.playDialogueIndex(5);
        await this.host.playDialogueIndex(6);
        this.scheduleTurnEventSlot(2, this.host.getTurn(), 0); // EV 79 Dragon rotation controller!
        break;
      }

      case 77: {
        // EV 77 (Ch 29 defeat `#127 暗黑龍` — `fn_155329`): Marks `flag[19] = 1`!
        this.flags[19] = 1;
        break;
      }

      case 78: {
        // EV 78 (Ch 29 defeat `#105 雷龍` — `fn_155345`): Marks `flag[20] = 1`!
        this.flags[20] = 1;
        break;
      }

      case 79: {
        // EV 79 (Ch 29 Three-Dragon Turn Rotation Controller — `fn_155361`):
        // Reschedules itself for `turn + 1` (`phase 0`), and marks 2 of the 3 Dragons (`slots[base..base+2]`) as `acted = true`
        // so that only 1 randomly chosen Dragon attacks each turn!
        this.scheduleTurnEventSlot(2, this.host.getTurn() + 1, 0);
        const base = this.flags[21] || 20;
        const r = Math.floor(Math.random() * 3);
        const slots = this.host.getSlots();
        const s1 = slots[base + (r % 3)];
        const s2 = slots[base + ((r + 1) % 3)];
        if (s1 && s1.hp > 0 && !s1.hidden) s1.acted = true;
        if (s2 && s2.hp > 0 && !s2.hidden) s2.acted = true;
        break;
      }

      case 80: {
        // EV 80 (Ch 30 step trigger on stairs — `fn_155482`): Switches `#126 空魔神` (`slot 20`) to `aiMode = 11`
        // (Cast Spell + Move & Physical Attack in the same turn, `fn_147868(20, 20, 11)`)!
        this.setSlotsAiMode(20, 20, 11);
        break;
      }

      case 81: {
        // EV 81 (Ch 30 defeat of any of the 4 Elemental Demon Gods `#122..#125` — `fn_155503`):
        // Increments `flag[16] += 1` and schedules `turnEvents[0]` (`EV 82`, `phase 0`) for `turn + 1`!
        this.flags[16] += 1;
        this.scheduleTurnEventSlot(0, this.host.getTurn() + 1, 0);
        break;
      }

      case 82: {
        // EV 82 (Ch 30 Scheduled Elemental Pillar Transition — `fn_155538`):
        // For `stage = flag[16]` (`1..4`):
        // - Pans to `(22, 6)`, plays `dlg[2 + stage]`, pans to `(22, 18)`, teleports `slot (24 - stage)` to `(22, 18)`.
        // - If `stage < 4`: spawns `Wave stage` (`1..3`), wakes `slot (24 - stage)` to `aiMode = 0`,
        //   and teleports its two bodyguards `slot (25 + 2 * stage)` to `(21, 18)` and `slot (26 + 2 * stage)` to `(23, 18)`!
        // - If `stage === 4`: wakes Final Boss `#126 空魔神` (`slot 20`) to `aiMode = 11`!
        const stage = Math.max(1, Math.min(4, this.flags[16] || 1));
        await this.host.panCameraSmooth(22, 6, 380);
        await this.host.playDialogueIndex(this.CreateSafeDlgIdx(ch, 2 + stage));
        await this.host.panCameraSmooth(22, 18, 380);
        const bossSlot = 24 - stage; // stage 1 -> 23 (#123 水魔神), stage 2 -> 22 (#124 風魔神), stage 3 -> 21 (#125 火魔神), stage 4 -> 20 (#126 空魔神)
        await this.teleportSlotWithSparkles(bossSlot, 22, 18);
        if (stage < 4) {
          this.spawnWave(stage, true);
          this.setSlotsAiMode(bossSlot, bossSlot, 0);
          await this.teleportSlotWithSparkles(25 + stage * 2, 21, 18);
          await this.teleportSlotWithSparkles(26 + stage * 2, 23, 18);
        } else {
          this.setSlotsAiMode(20, 20, 11);
        }
        break;
      }

      case 83: {
        // EV 83 (Ch 30 defeat of Final Boss `#126 空魔神` `slot 20`): Plays `dlg[8]` and wipes remaining enemy adds (`fn_154554(20)`)!
        await this.host.playDialogueIndex(8);
        await this.wipeEnemiesFromSlot(20);
        break;
      }

      case 84: {
        // EV 84 (Ch 27 step trigger entering upper blue zone): Wakes all enemies `slots[16..79]` to `aiMode = 0` (`fn_147868(16, 79, 0)`)!
        this.unlockMapPassagesNear(triggerUnit?.x ?? Math.floor(ch.width / 2), triggerUnit?.y ?? Math.floor(ch.height / 2), 8);
        this.setSlotsAiMode(16, 79, 0);
        break;
      }

      default:
        break;
    }

    this.host.updateHud();
    return true;
  }

  // =========================================================================
  // 4. POST-BATTLE DIRECTING, RECRUITMENTS & BRANCHING ENDINGS (`fn_77558 .. fn_87895`)
  // =========================================================================

  async runPostBattleDirecting(chapterId: number): Promise<PostBattleOutcome> {
    this.skipRequested = false;
    const ch = this.host.getChapter();
    if (!ch) return { kind: 'next_chapter', nextChapterId: chapterId + 1 };

    switch (chapterId) {
      case 0: {
        // Ch 1 (`初試身手`) Post (`fn_77558`):
        // NOTE: `#1 哈諾` is recruited ONLY by Turn 3 `EV 0` (`fn_147931`), NOT in Post!
        // ("若哈諾還未出現便已消滅完敵人，那麼哈諾便不會加入了。")
        await this.host.playDialogueIndex(9);
        return { kind: 'next_chapter', nextChapterId: 1 };
      }

      case 1: {
        // Ch 2 (`羅德鎮`) Post (`L77623`):
        // Checks `slots[5..10]` (`#133/#134` villagers):
        // - Escaped villagers have `hp > 0, hidden = true` (ALIVE!).
        // - Killed villagers have `hp <= 0, hidden = true` (DEAD!).
        // -> 0 villagers killed: `dlg[6]` + `#198 力量藥水` (`fn_49696(198)`)!
        // -> >= 1 villager killed: `dlg[7]` (NO `#198 力量藥水`)!
        this.applyPostFormation(2);
        const villagers = this.host.getSlots().filter((u): u is BattleUnit => Boolean(u && (u.uid === 133 || u.uid === 134)));
        const anyVillagerKilled = villagers.some((v) => v.hp <= 0);
        if (!anyVillagerKilled) {
          await this.host.playDialogueIndex(6);
          this.grantItemToParty(198); // `#198 力量藥水`!
        } else {
          await this.host.playDialogueIndex(7);
        }
        await this.host.panCameraSmooth(14, 2, 380);
        const w4 = this.spawnWave(4, true); // `#8 希莉亞` (`slot 27`)
        if (w4[0]) {
          this.host.getSlots()[27] = w4[0];
        }
        await this.playChoreo(14);
        await this.host.playDialogueIndex(8);
        await this.playChoreo(15);
        await this.host.playDialogueIndex(9);
        await this.playChoreo(16);
        await this.host.playDialogueIndex(10);
        this.recruitHero(8); // `#8 希莉亞`!
        return { kind: 'next_chapter', nextChapterId: 2 };
      }

      case 2: {
        // Ch 3 (`森林小徑`) Post (`L78066`):
        // Checks if ally `#2 鐵諾` (`slot 6`) survived (`hp > 0`):
        // - Survived -> Formation + `dlg[7]` + recruits `#2 鐵諾`!
        // - Died -> `dlg[6]` ONLY (`#2 鐵諾` does NOT join!)
        const tieno =
          this.host.getSlots()[6] ??
          this.host.getSlots().find((u) => u && (u.baseHeroId ?? u.uid) === 2);
        if (tieno && tieno.hp <= 0) {
          await this.host.playDialogueIndex(6);
        } else {
          this.applyPostFormation(4);
          await this.host.playDialogueIndex(7);
          this.recruitHero(2); // `#2 鐵諾`!
        }
        return { kind: 'next_chapter', nextChapterId: 3 };
      }

      case 3: {
        // Ch 4 Post:
        this.applyPostFormation(4);
        await this.host.playDialogueIndex(4);
        return { kind: 'next_chapter', nextChapterId: 4 };
      }

      case 4: {
        // Ch 5 (`塞拉村`) Post: `#10 瑪琳` joins!
        this.applyPostFormation(6);
        await this.host.playDialogueIndex(9);
        this.recruitHero(10); // `#10 瑪琳`!
        return { kind: 'next_chapter', nextChapterId: 5 };
      }

      case 5: {
        // Ch 6 (`普里茲港`) Post (`L78486`): Recruits `#13 貝克威` (`#5 洛娜` joins in Ch 8 Post!)
        this.recruitHero(13); // `#13 貝克威`!
        this.spawnWave(3, true);
        await this.host.panCameraSmooth(5, 14, 360);
        await this.playChoreo(27);
        await this.host.playDialogueIndex(this.CreateSafeDlgIdx(ch, 6));
        return { kind: 'next_chapter', nextChapterId: 6 };
      }

      case 6: {
        // Ch 7 (`獸人峽谷`) Post (`L78568`):
        // ONLY recruits `#12 凱麗` (`slot 43`) if `flag[17] === 1` (`EV 26 -> EV 25` triggered) AND `#12 凱麗` survived (`hp > 0`)!
        // Otherwise plays `dlg[5]` and `#12 凱麗` does NOT join!
        const kaili =
          this.host.getSlots()[43] ??
          this.host.getSlots().find((u) => u && (u.baseHeroId ?? u.uid) === 12);
        if (this.flags[17] === 1 && kaili && kaili.hp > 0) {
          this.applyPostFormation(7);
          await this.host.playDialogueIndex(4);
          this.recruitHero(12); // `#12 凱麗`!
        } else {
          await this.host.playDialogueIndex(5);
        }
        return { kind: 'next_chapter', nextChapterId: 7 };
      }

      case 7: {
        // Ch 8 (`渡河作戰`) Post (`L79035`): Recruits `#5 洛娜` (`L79285: push(5)`) + Walk Fade-Out (`Choreo 34`)!
        this.applyPostFormation(16);
        await this.host.playDialogueIndex(3);
        await this.playChoreo(33);
        await this.host.playDialogueIndex(4);
        await this.playChoreo(34, { fadeOutDuringWalk: true });
        await this.sleep(160);
        this.host.setScreenFlashAlpha('#000000', 0);
        this.recruitHero(5); // `#5 洛娜`!
        return { kind: 'next_chapter', nextChapterId: 8 };
      }

      case 8: {
        // Ch 9 Post:
        await this.host.panCameraSmooth(12, 4, 360);
        this.spawnWave(4, true);
        await this.playChoreo(36);
        await this.host.playDialogueIndex(this.CreateSafeDlgIdx(ch, 4));
        return { kind: 'next_chapter', nextChapterId: 9 };
      }

      case 9: {
        // Ch 10 (`洞窟中的激戰`) Post: `#11 索菲亞` (carrying `#209 黃金徽章`!) & `#6 萊汀` join!
        await this.host.playDialogueIndex(4);
        await this.playChoreo(37);
        await this.host.playDialogueIndex(5);
        this.recruitHero(11); // `#11 索菲亞`!
        this.recruitHero(6);  // `#6 萊汀`!
        return { kind: 'next_chapter', nextChapterId: 10 };
      }

      case 10: {
        // Ch 11 (`幻之森林`) Post: `#14 珊` joins!
        this.applyPostFormation(11);
        await this.host.playDialogueIndex(3);
        this.recruitHero(14); // `#14 珊`!
        return { kind: 'next_chapter', nextChapterId: 11 };
      }

      case 11: {
        // Ch 12 (`北山道`) Post: `#17 米亞斯多德` joins!
        this.applyPostFormation(13);
        await this.host.playDialogueIndex(3);
        await this.playChoreo(45);
        await this.host.playDialogueIndex(4);
        this.recruitHero(17); // `#17 米亞斯多德`!
        return { kind: 'next_chapter', nextChapterId: 12 };
      }

      case 12: {
        // Ch 13 (`哈斯米爾之戰`) Post (`L80031`): Plays `dlg[9]`, recruits `#3 哈瓦特` (`L80085: push(3)`)!
        await this.host.playDialogueIndex(9);
        this.recruitHero(3); // `#3 哈瓦特`!
        return { kind: 'next_chapter', nextChapterId: 13 };
      }

      case 13: {
        // Ch 14 (`平原的會戰`) Post:
        this.spawnWave(1, true);
        this.applyPostFormation(15);
        await this.host.playDialogueIndex(2);
        await this.playChoreo(47);
        await this.host.playDialogueIndex(3);
        return { kind: 'next_chapter', nextChapterId: 14 };
      }

      case 14: {
        // Ch 15 (`拉卡湖的激戰`) Post (`L80317`): Branches `dlg[12]` (has `#12 凱麗`) vs `dlg[13]` (no `#12`), recruits `#15 塞可邦勒`!
        await this.host.playDialogueIndex(this.partyHasHero(12) ? 12 : 13);
        this.recruitHero(15); // `#15 塞可邦勒`!
        return { kind: 'next_chapter', nextChapterId: 15 };
      }

      case 15: {
        // Ch 16 (`冰原之戰`) Post (`L80394`) — `#18 蜜蒂` Secret Triple Condition:
        // 1. Dead friendly guards among `slots[66..73]` <= 4 (at least half of the 8 guards survive)
        // 2. `turn <= 18`
        // 3. `#0 索爾` (`slot 0`) `maxHp >= 320`
        this.applyPostFormation(15);
        const guards = this.host.getSlots().slice(66, 74).filter((u): u is BattleUnit => u !== null);
        const deadGuardCount = guards.filter((g) => g.hp <= 0).length;
        const sol =
          this.host.getSlots()[0] ??
          this.host.getSlots().find((u) => u && (u.baseHeroId ?? u.uid) === 0);
        const solMaxHp = sol ? sol.maxHp : (this.host.getParty().find((p) => (p.baseHeroId ?? p.uid) === 0)?.maxHp ?? 0);

        if (deadGuardCount <= 4 && this.host.getTurn() <= 18 && solMaxHp >= 320) {
          await this.host.playDialogueIndex(4);
          this.recruitHero(18); // `#18 蜜蒂` joins!
        } else {
          await this.host.playDialogueIndex(2);
          await this.playChoreo(49);
          await this.host.playDialogueIndex(3);
        }
        return { kind: 'next_chapter', nextChapterId: 16 };
      }

      case 16: {
        // Ch 17 (`血與冰之刃`) Post (`L80735`): Branches on `partyHasHero(18)` (`#18 蜜蒂`), then recruits `#16 凱拉斯`!
        if (this.partyHasHero(18)) {
          this.applyPostFormation(17);
          await this.host.playDialogueIndex(5);
          this.spawnWave(3, true);
          await this.playChoreo(52);
        } else {
          this.applyPostFormation(17);
          await this.host.playDialogueIndex(7);
          await this.playChoreo(50);
          this.spawnWave(3, true);
          await this.playChoreo(51);
        }
        await this.host.playDialogueIndex(6);
        await this.playChoreo(53);
        await this.host.playDialogueIndex(8);
        this.recruitHero(16); // `#16 凱拉斯`!
        return { kind: 'next_chapter', nextChapterId: 17 };
      }

      case 17: {
        // Ch 18 (`遙遠的彼岸`) Post: `#21 約拿` & `#7 蘭斯洛特` join!
        this.applyPostFormation(20);
        await this.host.playDialogueIndex(7);
        await this.playChoreo(56);
        await this.host.playDialogueIndex(8);
        await this.playChoreo(57);
        await this.host.playDialogueIndex(9);
        await this.playChoreo(58);
        await this.host.playDialogueIndex(10);
        this.recruitHero(21); // `#21 約拿`!
        this.recruitHero(7);  // `#7 蘭斯洛特`!
        return { kind: 'next_chapter', nextChapterId: 18 };
      }

      case 18: {
        // Ch 19 (`黑暗中的狙擊`) Post (`fn_81451`):
        // NOTE: `#27 巴拿羅西亞` is recruited ONLY by Turn 6 `EV 46` (`fn_151657`), NOT in Post!
        // ("若巴拿羅西亞尚未出現便消滅完敵人，則巴拿羅西亞不會加入。")
        await this.host.playDialogueIndex(3);
        return { kind: 'next_chapter', nextChapterId: 19 };
      }

      case 19: {
        // Ch 20 (`死亡般的沈寂`) Post (`L81524`):
        // Always recruits `#25 謝多`; if `turn <= 15`, spawns Wave 1 & recruits `#28 達克塞`; then BOTH branches play `dlg[13]`!
        await this.host.playDialogueIndex(11);
        await this.playChoreo(59);
        await this.host.playDialogueIndex(12);
        this.recruitHero(25); // `#25 謝多`!
        if (this.host.getTurn() <= 15) {
          this.spawnWave(1, true);
          await this.playChoreo(60);
          await this.host.playDialogueIndex(14);
          await this.playChoreo(61);
          await this.host.playDialogueIndex(15);
          await this.playChoreo(62);
          await this.host.playDialogueIndex(16);
          this.recruitHero(28); // `#28 達克塞`!
        }
        await this.host.playDialogueIndex(13);
        return { kind: 'next_chapter', nextChapterId: 20 };
      }

      case 20: {
        // Ch 21 (`亞述森林` — 6 Sacred Artifacts `#209..#214` Resonance -> `#100 天空之鑰` + `FDOTHER[34]` Crystal Beam!):
        this.applyPostFormation(21);
        await this.host.playDialogueIndex(5);

        const crystalIds = [209, 210, 211, 212, 213, 214];
        const hasAll6Crystals = crystalIds.every((cid) => Boolean(this.partyHasItem(cid)));

        if (hasAll6Crystals) {
          // Remove all 6 artifacts from EVERY unit in `slots` AND EVERY member in `party`, then forge `#100 天空之鑰`!
          for (const cid of crystalIds) {
            for (const u of this.host.getSlots()) {
              if (u && u.faction === 'player') {
                u.items = u.items.filter((id) => id !== cid);
              }
            }
            for (const p of this.host.getParty()) {
              p.items = p.items.filter((id) => id !== cid);
            }
          }
          await this.host.playDialogueIndex(7);
          await this.playChoreo(63);
          await this.host.playDialogueIndex(8);
          await this.playChoreo(64);
          await this.playSpecialStripOnMap(34, 22, 21); // `FDOTHER[34]` 6-Crystal Sky Key Beam!
          this.grantItemToParty(100); // `#100 天空之鑰`!
          await this.host.playDialogueIndex(this.CreateSafeDlgIdx(ch, 10));
        } else {
          await this.host.playDialogueIndex(6);
        }

        this.recruitHero(24); // `#24 希爾法`!
        this.recruitHero(23); // `#23 羅蘭`!
        return { kind: 'next_chapter', nextChapterId: 21 };
      }

      case 21: {
        // Ch 22 (`遠古的呼喚`) Post: Formation + `Choreo 65, 66` + Lightning Teleportation into Sky!
        this.applyPostFormation(22);
        await this.host.playDialogueIndex(4);
        await this.playChoreo(65);
        await this.host.playDialogueIndex(5);
        await this.host.panCameraSmooth(22, 20, 360);
        await this.playChoreo(66);
        await this.host.playDialogueIndex(6);
        await this.playLightning(22, 20);
        return { kind: 'next_chapter', nextChapterId: 22 };
      }

      case 22: {
        // Ch 23 (`向天空之旅`) Post (`L83796`) — Dual Conditional Recruitment:
        // 1. `#22 卡里斯` (`slot 16`): Joins iff `partyHasItem(100)` (`#100 天空之鑰`)!
        // 2. `#19 羅德曼` (`slot 17`):
        //    - If `partyHasHero(18)` (`#18 蜜蒂` in party): leaves (`dlg[10] -> Choreo 72 -> hideSlot(17) -> dlg[11]`).
        //    - Else if `turn >= 15`: leaves (`dlg[12] -> Choreo 72 -> hideSlot(17)`).
        //    - Else (`!partyHasHero(18) && turn < 15`): plays `dlg[13]` and joins!
        this.applyPostFormation(22);

        if (this.partyHasItem(100)) {
          await this.host.playDialogueIndex(8);
          this.recruitHero(22); // `#22 卡里斯` joins!
        } else {
          await this.host.playDialogueIndex(9);
          await this.playChoreo(71);
          this.hideSlot(16);
        }

        if (this.partyHasHero(18)) {
          await this.host.playDialogueIndex(10);
          await this.playChoreo(72);
          this.hideSlot(17);
          await this.host.playDialogueIndex(11);
        } else if (this.host.getTurn() >= 15) {
          await this.host.playDialogueIndex(12);
          await this.playChoreo(72);
          this.hideSlot(17);
        } else {
          await this.host.playDialogueIndex(13);
          this.recruitHero(19); // `#19 羅德曼` joins!
        }

        await this.host.playDialogueIndex(14);
        await this.playEarthquake(30);
        await this.host.playDialogueIndex(15);
        await this.playEarthquake(30);
        await this.host.playDialogueIndex(16);
        this.host.setScreenFlashAlpha('#ffffff', 0.9);
        await this.sleep(280);
        this.host.setScreenFlashAlpha('#ffffff', 0);
        await this.playChoreo(73);
        await this.host.playDialogueIndex(17);
        return { kind: 'next_chapter', nextChapterId: 23 };
      }

      case 23: {
        // Ch 24 Post:
        await this.host.playDialogueIndex(2);
        await this.host.playDialogueIndex(3);
        this.host.setScreenFlashAlpha('#ffffff', 0.85);
        await this.sleep(240);
        this.host.setScreenFlashAlpha('#ffffff', 0);
        return { kind: 'next_chapter', nextChapterId: 24 };
      }

      case 24: {
        // Ch 25 (`火焰的審判`) Post (`L85490`): Recruits BOTH `#26 聖寇拉斯` AND `#29 亞齊梅吉`!
        await this.host.playDialogueIndex(6);
        await this.host.panCameraSmooth(10, 18, 360);
        this.spawnWave(2, true);
        await this.playChoreo(75);
        await this.host.playDialogueIndex(7);
        this.recruitHero(26); // `#26 聖寇拉斯`!
        this.recruitHero(29); // `#29 亞齊梅吉`!
        return { kind: 'next_chapter', nextChapterId: 25 };
      }

      case 25: {
        // Ch 26 (`未知的迴廊`) Post (`fn_85632`, `L85632..86097`):
        // - If `#31 渥德` is on the map (`fn_84958(31) != -1`), moves him to `(16, 6)` alongside the party formation.
        // - Plays `dlg[hasWard ? 6 : 5]` -> `Choreo 77` -> `dlg[7]` -> `Choreo 78` -> `dlg[hasWard ? 9 : 8]` -> `Choreo 79` -> `dlg[10]` -> `Choreo 80` -> `dlg[11]`!
        const wardUnit = this.host.getSlots().find((u) => u && (u.baseHeroId ?? u.uid) === 31);
        this.applyPostFormation(25);
        if (wardUnit) {
          wardUnit.x = 16;
          wardUnit.y = 6;
          wardUnit.hidden = false;
        }
        const hasWard = Boolean(wardUnit) || this.flags[12] === 1 || this.partyHasHero(31);
        await this.host.playDialogueIndex(hasWard ? 6 : 5);
        await this.playChoreo(77);
        await this.host.playDialogueIndex(7);
        await this.playChoreo(78);
        await this.host.playDialogueIndex(hasWard ? 9 : 8);
        await this.playChoreo(79);
        await this.host.playDialogueIndex(10);
        await this.playChoreo(80);
        await this.host.playDialogueIndex(11);
        return { kind: 'next_chapter', nextChapterId: 26 };
      }

      case 26: {
        // Ch 27 (`命運的交會點`) Post — THE EXACT BRANCHING ENDING CHECK (`fn_86220`, `L86404..87138`)!
        this.applyPostFormation(26);
        await this.host.playDialogueIndex(8);
        await this.playChoreo(82);

        const hasSkyKey = Boolean(this.partyHasItem(100));
        if (hasSkyKey) {
          // TRUE ROUTE UNLOCKED (`L86423..86851`): `#100 天空之鑰` resonates with the Control Core -> Chapter 28!
          await this.host.playDialogueIndex(9);
          await this.playChoreo(83);
          await this.host.playDialogueIndex(10);
          await this.host.panCameraSmooth(15, 12, 400);
          await this.playChoreo(84);
          await this.host.playDialogueIndex(11);
          await this.playEarthquake(28);
          await this.host.playDialogueIndex(12);
          await this.playLightning(15, 12);
          return { kind: 'next_chapter', nextChapterId: 27 };
        }

        // NORMAL ENDING (`L86856..87138`): Without `#100 天空之鑰`, Yuni stays behind to halt Golden Castle!
        await this.host.playDialogueIndex(13);
        await this.playChoreo(84);
        await this.host.playDialogueIndex(14);
        await this.playChoreo(82);
        await this.host.playDialogueIndex(15);
        await this.playLightning(15, 12);
        await this.host.playDialogueIndex(16);
        return { kind: 'ending', route: 'normal' };
      }

      case 27: {
        // Ch 28 (`探索者`) Post (`L87140`): Plays `dlg[7]` -> Proceeds to Ch 29!
        await this.host.playDialogueIndex(7);
        return { kind: 'next_chapter', nextChapterId: 28 };
      }

      case 28: {
        // Ch 29 (`無邊的黑暗之中`) Post: Collapsing Sanctum Earthquakes -> Proceeds to Final Chapter 30!
        await this.host.playDialogueIndex(10);
        await this.host.playDialogueIndex(11);
        this.spawnWave(9, true);
        await this.host.panCameraSmooth(15, 12, 380);
        await this.host.playDialogueIndex(12);
        await this.playEarthquake(24);
        await this.host.playDialogueIndex(13);
        await this.playEarthquake(24);
        await this.host.playDialogueIndex(14);
        await this.playEarthquake(40);
        await this.host.playDialogueIndex(15);
        return { kind: 'next_chapter', nextChapterId: 29 };
      }

      case 29: {
        // Ch 30 (`傳說的終章` — `#126 空魔神` Defeated!) -> Transitions to `Map 30` (`終章・王城凱旋`) -> TRUE ENDING!
        this.applyPostFormation(29);
        await this.host.playDialogueIndex(9);
        await this.playChoreo(88);
        await this.host.playDialogueIndex(10);
        await this.playLightning(22, 22);

        // Load True Ending Royal Triumph Epilogue (`Map 30`, `maxDeploy = 31`, `FDTXT[31]`)!
        this.host.setScreenFlashAlpha('#ffffff', 1);
        await this.host.loadMapForDirecting(30);
        this.host.setCameraTopLeft(11, 5); // Exact `L88184: GLOBAL_2_15017 = 11, GLOBAL_2_15021 = 5`!
        await this.host.fadeScreen('#ffffff', 0, 420); // `L88254: fn_7666` white fade-in!
        await this.host.playDialogueIndex(0);
        await this.host.panCameraTopLeft(11, 12, 420); // Exact `L88371: fn_13789(11, 12)`!
        await this.playChoreo(89);
        await this.host.playDialogueIndex(1);

        return { kind: 'ending', route: 'true' };
      }

      default: {
        const active = this.host.getSlots().filter(isUnitActiveOnMap);
        void active;
        return { kind: 'next_chapter', nextChapterId: Math.min(29, chapterId + 1) };
      }
    }
  }

  private CreateSafeDlgIdx(ch: ChapterData, preferred: number): number {
    if (preferred >= 0 && preferred < ch.dialogues.length && ch.dialogues[preferred].length > 0) {
      return preferred;
    }
    return Math.max(0, ch.dialogues.length - 1);
  }
}
