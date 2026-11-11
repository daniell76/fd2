import type { SoundEngine } from '../audio/soundEngine';
import type { AssetManager } from '../engine/assets';
import { getTerrainInfo } from '../engine/tactical';
import { decodeGlyphsToText, getLocale, getLocalizedSpeakerName, onLocaleChange, tr } from '../i18n';
import type { BattleUnit, ChapterData, CombatOutcome, DialogueSegment, SpellDef } from '../types';
import {
  buildMagicSequenceTimeline,
  buildPhysicalStrikeTimeline,
  getUnitMoveCapabilities,
  isCutawayAttackMagic,
  renderTimelineStep,
  type CombatantSpec,
  type MagicTargetEntry,
  type TimelineStep,
} from './battleStage';

export class CutscenePlayer {
  private speedMode: 1 | 2 | 0 = 1; // 1 = 1x, 2 = 2x, 0 = Instant

  constructor(
    private assets: AssetManager,
    private sound: SoundEngine
  ) {}

  getSpeedLabel(): string {
    return this.speedMode === 1 ? 'Anim: 1x' : this.speedMode === 2 ? 'Anim: 2x' : 'Anim: Instant';
  }

  isInstantMode(): boolean {
    return this.speedMode === 0;
  }

  getTickScale(): number {
    return this.speedMode === 2 ? 0.5 : this.speedMode === 0 ? 0.45 : 1;
  }

  cycleSpeed(): string {
    this.speedMode = this.speedMode === 1 ? 2 : this.speedMode === 2 ? 0 : 1;
    return this.getSpeedLabel();
  }

  private async runTimelineOnCanvas(
    steps: TimelineStep[],
    bgId: number,
    backdropEl: HTMLElement,
    canvas: HTMLCanvasElement,
    skipBtn: HTMLButtonElement
  ): Promise<void> {
    if (steps.length === 0) return;

    backdropEl.classList.remove('hidden');
    canvas.width = 320;
    canvas.height = 200;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    let skipped = false;
    const onSkip = () => {
      skipped = true;
    };
    skipBtn.addEventListener('click', onSkip, { once: true });

    const speedMult = this.speedMode === 2 ? 0.5 : 1;
    const tickMs = 55 * speedMult;

    // Precompute cumulative tick end-boundaries so playback is 100% locked to wall-clock `tickMs`
    // (identical to `gallery.ts` `animLoop`, eliminating per-step rAF / VSync overshoot accumulation!)
    const cumTicks: number[] = new Array(steps.length);
    let totalTicks = 0;
    for (let i = 0; i < steps.length; i++) {
      totalTicks += Math.max(1, steps[i].delay);
      cumTicks[i] = totalTicks;
    }

    await new Promise<void>((resolve) => {
      let animStartMs: number | null = null;
      let highestTriggeredStep = -1;
      let lastRenderedStep = -1;
      let lastIdleBucket = -1;

      const triggerSfxUpTo = (targetStepIdx: number) => {
        for (let s = highestTriggeredStep + 1; s <= targetStepIdx; s++) {
          const trig = steps[s]?.sfxTrigger;
          if (trig) {
            this.sound.playSfx(trig);
          }
        }
        if (targetStepIdx > highestTriggeredStep) {
          highestTriggeredStep = targetStepIdx;
        }
      };

      // Render Step 0 immediately so there isn't even a 1-frame blank canvas on open
      triggerSfxUpTo(0);
      renderTimelineStep(ctx, this.assets, bgId, steps[0], Math.floor(performance.now() / 180));
      lastRenderedStep = 0;

      const frame = (now: number) => {
        if (skipped) {
          resolve();
          return;
        }
        if (animStartMs === null) {
          animStartMs = now;
        }
        const elapsedTicks = (now - animStartMs) / tickMs;
        if (elapsedTicks >= totalTicks) {
          triggerSfxUpTo(steps.length - 1);
          renderTimelineStep(ctx, this.assets, bgId, steps[steps.length - 1], Math.floor(now / 180));
          resolve();
          return;
        }

        let stepIdx = 0;
        while (stepIdx < steps.length - 1 && elapsedTicks >= cumTicks[stepIdx]) {
          stepIdx++;
        }

        triggerSfxUpTo(stepIdx);
        const idleBucket = Math.floor(now / 180);
        if (stepIdx !== lastRenderedStep || idleBucket !== lastIdleBucket) {
          renderTimelineStep(ctx, this.assets, bgId, steps[stepIdx], idleBucket);
          lastRenderedStep = stepIdx;
          lastIdleBucket = idleBucket;
        }
        requestAnimationFrame(frame);
      };

      requestAnimationFrame(frame);
    });

    skipBtn.removeEventListener('click', onSkip);
    backdropEl.classList.add('hidden');
  }

  async playCombatCutscene(
    outcome: CombatOutcome,
    backdropEl: HTMLElement,
    canvas: HTMLCanvasElement,
    skipBtn: HTMLButtonElement
  ): Promise<void> {
    if (this.speedMode === 0) {
      const anyHit = outcome.strikes.some((s) => s.hit);
      this.sound.playSfx(anyHit ? 'hit' : 'miss');
      return;
    }

    // In FD2.EXE (`fn_100972` & `fn_100228`), ALL weapon attacks (melee, 2..3-tile reach/breath, bows, and `#113` laser cannon)
    // ALWAYS load `3*uid + 1` (`attack`), NEVER `3*uid + 2` (`ranged`, which is exclusively Special Techniques `fn_95980` or Magic Casting `fn_108289`)!
    const atkActionSlot: 'attack' = 'attack';

    const [atkIdle, atkAct, defIdle, defAct] = await Promise.all([
      this.assets.loadUnitFigAni(outcome.attacker.uid, 'idle'),
      this.assets.loadUnitFigAni(outcome.attacker.uid, atkActionSlot),
      this.assets.loadUnitFigAni(outcome.defender.uid, 'idle'),
      this.assets.loadUnitFigAni(outcome.defender.uid, 'attack'),
    ]);

    // Exact pre-combat HPs for live bar drain animation (never inflated by overkill damage!)
    let dispAtkHp = outcome.attackerStartHp;
    let dispDefHp = outcome.defenderStartHp;

    const atkSpec: CombatantSpec = {
      uid: outcome.attacker.uid,
      nameZh: outcome.attacker.nameZh,
      nameGlyphs: outcome.attacker.nameGlyphs,
      portraitId: outcome.attacker.portraitId,
      spriteGroup: outcome.attacker.spriteGroup,
      isHeroSide: outcome.attacker.faction !== 'enemy',
      level: outcome.attacker.level,
      maxHp: outcome.attacker.maxHp,
      startHp: dispAtkHp,
      maxMp: outcome.attacker.maxMp,
      startMp: outcome.attacker.mp,
      taiId: outcome.atkTaiId,
    };

    const defSpec: CombatantSpec = {
      uid: outcome.defender.uid,
      nameZh: outcome.defender.nameZh,
      nameGlyphs: outcome.defender.nameGlyphs,
      portraitId: outcome.defender.portraitId,
      spriteGroup: outcome.defender.spriteGroup,
      isHeroSide: outcome.defender.faction !== 'enemy',
      level: outcome.defender.level,
      maxHp: outcome.defender.maxHp,
      startHp: dispDefHp,
      maxMp: outcome.defender.maxMp,
      startMp: outcome.defender.mp,
      taiId: outcome.defTaiId,
    };

    const allSteps: TimelineStep[] = [];
    for (const strike of outcome.strikes) {
      const fromAtk = strike.fromAttacker;
      const preStrikeTargetHp = fromAtk ? dispDefHp : dispAtkHp;
      const effectiveBarDrain = strike.hit ? Math.max(0, preStrikeTargetHp - strike.targetHpAfter) : 0;
      const strikeSteps = buildPhysicalStrikeTimeline({
        bgId: outcome.bgId,
        actor: fromAtk ? atkSpec : defSpec,
        target: fromAtk ? defSpec : atkSpec,
        actorIdle: fromAtk ? atkIdle : defIdle,
        actorAct: fromAtk ? atkAct : defAct,
        targetIdle: fromAtk ? defIdle : atkIdle,
        hit: strike.hit,
        crit: strike.crit,
        totalDamage: effectiveBarDrain,
        actorCurHp: fromAtk ? dispAtkHp : dispDefHp,
        targetStartHp: preStrikeTargetHp,
      });
      allSteps.push(...strikeSteps);
      if (fromAtk) dispDefHp = strike.targetHpAfter;
      else dispAtkHp = strike.targetHpAfter;
    }

    await this.runTimelineOnCanvas(allSteps, outcome.bgId, backdropEl, canvas, skipBtn);
  }

  /**
   * Plays the authentic Flame Dragon II Magic / Multi-Target Spell Cutscene:
   *  1. Caster performs spell chant on their screen;
   *  2. Each affected target slides horizontally onto the target screen one-by-one while the spell effect plays!
   */
  async playMagicCutscene(
    caster: BattleUnit,
    spell: SpellDef,
    affected: { unit: BattleUnit; amount: number; isHeal: boolean; preHp: number }[],
    chapter: ChapterData,
    backdropEl: HTMLElement,
    canvas: HTMLCanvasElement,
    skipBtn: HTMLButtonElement
  ): Promise<void> {
    if (affected.length === 0) return;
    // In FD2.EXE (L21470 / L54292), map-only earth spells (#10..#12 碎岩/地震/裂地) and non-attacking
    // heal/support/status spells (#13..#23, #25..#27, #33..#35) execute directly on the tactical map
    // without entering the 320x200 cutaway battle stage (`Func_108221`).
    if (this.speedMode === 0 || !isCutawayAttackMagic(spell)) {
      this.sound.playSfx(spell.targetType === 'ally' ? 'heal' : 'magic');
      return;
    }

    const casterTerrain = getTerrainInfo(chapter, caster.x, caster.y);
    const caps = getUnitMoveCapabilities(caster.uid, this.assets.gameData, caster.faction !== 'enemy');
    const castSlot = caps.magicCastSlot ?? 'attack';

    const [casterIdle, casterCast] = await Promise.all([
      this.assets.loadUnitFigAni(caster.uid, 'idle'),
      this.assets.loadUnitFigAni(caster.uid, castSlot),
    ]);

    const casterPreMp = Math.min(caster.maxMp, caster.mp + Math.max(0, spell.mpCost ?? 0));
    const casterSpec: CombatantSpec = {
      uid: caster.uid,
      nameZh: caster.nameZh,
      nameGlyphs: caster.nameGlyphs,
      portraitId: caster.portraitId,
      spriteGroup: caster.spriteGroup,
      isHeroSide: caster.faction !== 'enemy',
      level: caster.level,
      maxHp: caster.maxHp,
      startHp: caster.hp,
      maxMp: caster.maxMp,
      startMp: casterPreMp,
      taiId: casterTerrain.bgId,
    };

    const targetEntries: MagicTargetEntry[] = await Promise.all(
      affected.map(async (aff) => {
        const tUnit = aff.unit;
        const tTerrain = getTerrainInfo(chapter, tUnit.x, tUnit.y);
        const tHeroSide = tUnit.faction !== 'enemy';
        const [tIdle, spPack] = await Promise.all([
          this.assets.loadUnitFigAni(tUnit.uid, 'idle'),
          this.assets.loadSpellAnim(spell.id, tHeroSide),
        ]);
        const stripId = tHeroSide ? (spell.animHeroStripId ?? -1) : (spell.animEnemyStripId ?? -1);
        return {
          target: {
            uid: tUnit.uid,
            nameZh: tUnit.nameZh,
            nameGlyphs: tUnit.nameGlyphs,
            portraitId: tUnit.portraitId,
            spriteGroup: tUnit.spriteGroup,
            isHeroSide: tHeroSide,
            level: tUnit.level,
            maxHp: tUnit.maxHp,
            startHp: aff.preHp,
            maxMp: tUnit.maxMp,
            startMp: tUnit.mp,
            taiId: tTerrain.bgId,
          },
          targetIdle: tIdle,
          spellPack: spPack,
          spellStripId: stripId,
          isHeal: aff.isHeal,
          hit: aff.isHeal || aff.amount > 0,
          amount: aff.amount,
        };
      })
    );

    const primaryBgId = getTerrainInfo(chapter, affected[0].unit.x, affected[0].unit.y).bgId;
    const steps = buildMagicSequenceTimeline({
      caster: casterSpec,
      casterIdle,
      casterCast,
      spell,
      targets: targetEntries,
    });

    await this.runTimelineOnCanvas(steps, primaryBgId, backdropEl, canvas, skipBtn);
  }

  async playDialogueSequence(
    segments: DialogueSegment[],
    overlayEl: HTMLElement,
    portraitCanvas: HTMLCanvasElement,
    speakerEl: HTMLElement,
    linesEl: HTMLElement,
    progressEl: HTMLElement,
    skipBtn: HTMLButtonElement,
    onSpeakerSegment?: (seg: DialogueSegment) => Promise<void> | void
  ): Promise<void> {
    if (!segments || segments.length === 0) return;

    portraitCanvas.width = 80;
    portraitCanvas.height = 80;
    const pCtx = portraitCanvas.getContext('2d')!;

    for (let idx = 0; idx < segments.length; idx++) {
      const seg = segments[idx];
      if (onSpeakerSegment) {
        // Authentic `FD2.EXE` `fn_24452 -> fn_26028 -> fn_11498`:
        // Hide the previous dialogue box while smoothly scrolling the camera to the speaking character's tile!
        overlayEl.classList.add('hidden');
        await onSpeakerSegment(seg);
      }
      overlayEl.classList.remove('hidden');
      overlayEl.classList.toggle('pos-top', seg.boxPos === 'top');

      // 0-indexed speaker: null = narrator, 0 = Sol (索爾, DATO[0]), 4 = Ares (亞雷斯, DATO[4])!
      const spkId = seg.speaker;
      const hasPortrait = spkId !== null && spkId >= 0 && spkId < this.assets.gameData.portraitCount;
      const pid = seg.portraitId !== undefined && seg.portraitId >= 0 ? seg.portraitId : (spkId ?? 0);
      portraitCanvas.parentElement!.style.display = hasPortrait ? 'block' : 'none';

      const dexEntry = spkId !== null && spkId >= 0 ? this.assets.gameData.unitDex[spkId] : undefined;
      const speakerGlyphs =
        seg.speakerGlyphs && seg.speakerGlyphs.length > 0
          ? seg.speakerGlyphs
          : dexEntry?.nameGlyphs ?? [];

      const renderSegmentText = () => {
        const loc = getLocale();
        const speakerZh = getLocalizedSpeakerName(spkId, seg.speakerNameZh ?? dexEntry?.nameZh ?? '');

        if (!hasPortrait) {
          speakerEl.innerHTML = `<span style="color: var(--gold-300); font-family: var(--font-display); font-size: 12.5px;">${tr('旁白 · Chronicle', '旁白 · Chronicle', 'Narrator · Chronicle')}</span>`;
        } else if (speakerGlyphs.length > 0 && loc === 'zh-TW') {
          speakerEl.innerHTML = `${this.assets.glyphsToHtml(speakerGlyphs, 'gold', 18, speakerZh)} <span style="font-size:12px; color:var(--ink-400); margin-left:6px;">${speakerZh}</span>`;
        } else {
          speakerEl.innerHTML = `<span style="color: var(--gold-200); font-weight: 700; font-size: 14px; text-shadow: 1px 1px 0 #07090e;">${speakerZh}</span>`;
        }

        if (loc === 'en') {
          const enLines =
            seg.linesEn && seg.linesEn.length > 0
              ? seg.linesEn
              : seg.lines.map((ln) => decodeGlyphsToText(ln, 'zh-TW'));
          linesEl.innerHTML = enLines
            .map(
              (ln) =>
                `<div style="color: var(--ink-100); font-weight: 600; font-size: 14.5px; line-height: 1.5; text-shadow: 1px 1px 0 #07090e;">${ln}</div>`
            )
            .join('');
        } else if (loc === 'zh-CN') {
          const cnLines =
            seg.linesZhCn && seg.linesZhCn.length > 0
              ? seg.linesZhCn
              : seg.lines.map((ln) => decodeGlyphsToText(ln, 'zh-CN'));
          linesEl.innerHTML = cnLines
            .map(
              (ln) =>
                `<div style="color: var(--ink-100); font-weight: 600; font-size: 15.5px; line-height: 1.55; text-shadow: 1px 1px 0 #07090e;">${ln}</div>`
            )
            .join('');
        } else {
          linesEl.innerHTML = seg.lines
            .map((ln) => `<div>${this.assets.glyphsToHtml(ln, 'ivory', 18)}</div>`)
            .join('');
        }

        progressEl.textContent = tr(
          `點擊或按空白鍵繼續 (${idx + 1} / ${segments.length})`,
          `点击或按空格键继续 (${idx + 1} / ${segments.length})`,
          `Click or press Space (${idx + 1} / ${segments.length})`
        );
      };

      renderSegmentText();
      const unsubLocale = onLocaleChange(() => renderSegmentText());

      let animId = 0;
      const t0 = performance.now();
      const animateLipSync = (now: number) => {
        if (hasPortrait) {
          const elapsed = now - t0;
          const talking = elapsed < 1050;
          const frame = talking
            ? [0, 1, 2, 1][Math.floor(elapsed / 120) % 4]
            : Math.floor(elapsed / 2200) % 6 === 5
              ? 3
              : 0;
          pCtx.clearRect(0, 0, 80, 80);
          this.assets.drawPortrait(pCtx, pid, frame, 0, 0, 80, 80);
        }
        animId = requestAnimationFrame(animateLipSync);
      };
      animId = requestAnimationFrame(animateLipSync);

      const skippedAll = await new Promise<boolean>((resolve) => {
        const box = overlayEl.querySelector('.dialogue-box') as HTMLElement;
        const cleanup = () => {
          box.removeEventListener('click', onNext);
          window.removeEventListener('keydown', onKey);
          skipBtn.removeEventListener('click', onSkipAll);
        };
        const onNext = () => {
          this.sound.playSfx('cursor');
          cleanup();
          resolve(false);
        };
        const onSkipAll = (ev: Event) => {
          ev.stopPropagation();
          this.sound.playSfx('cancel');
          cleanup();
          resolve(true);
        };
        const onKey = (ev: KeyboardEvent) => {
          if (ev.key === ' ' || ev.key === 'Enter') {
            ev.preventDefault();
            onNext();
          } else if (ev.key === 'Escape') {
            onSkipAll(ev);
          }
        };
        box.addEventListener('click', onNext);
        window.addEventListener('keydown', onKey);
        skipBtn.addEventListener('click', onSkipAll);
      });

      cancelAnimationFrame(animId);
      unsubLocale();
      if (skippedAll) break;
    }

    overlayEl.classList.add('hidden');
  }
}
