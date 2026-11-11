import type { AssetManager } from '../engine/assets';
import type { FigAniStrip, GameData, SpellDef, UnitDexEntry } from '../types';

export type BattleMoveKind = 'melee' | 'ranged' | 'special' | 'magic';

export interface CombatantSpec {
  uid: number;
  nameZh: string;
  nameGlyphs: number[];
  portraitId: number;
  spriteGroup: number;
  isHeroSide: boolean; // true = right side on TAI; false = left side on BG strip
  level: number;
  maxHp: number;
  startHp: number;
  maxMp: number;
  startMp: number;
  taiId: number;
}

export type StageViewMode = 'both' | 'left_only' | 'right_only' | 'bridge';

export interface SpellBurstInstance {
  fIdx: number;
  dx: number; // screen X offset (`ox + dx`)
  dy: number; // screen Y offset (`oy + dy`)
  behindTarget?: boolean;
}

export interface TimelineStep {
  delay: number; // in 55ms DOS ticks
  mode: StageViewMode;
  showBothHuds?: boolean; // true in multi-target magic Stage B (`FD2.EXE` L108934 + L108954)
  stageLabel: string;
  leftUnit: CombatantSpec | null;
  rightUnit: CombatantSpec | null;
  leftPack: { img: HTMLImageElement; strip: FigAniStrip } | null;
  leftFrameIdx: number;
  leftSlideX?: number; // unit-only horizontal recoil / slide displacement
  leftSlideY?: number; // unit-only vertical diagonal recoil displacement (1-stage melee)
  leftFlash?: boolean;
  leftHp: number;
  leftMp: number;
  rightPack: { img: HTMLImageElement; strip: FigAniStrip } | null;
  rightFrameIdx: number;
  rightSlideX?: number; // unit-only horizontal recoil / slide displacement
  rightSlideY?: number; // unit-only vertical diagonal recoil displacement (1-stage melee)
  rightTaiSlideX?: number; // TAI platform slide displacement (used only during magic target slide-in/out; stationary 0 during hit recoil)
  rightFlash?: boolean;
  rightHp: number;
  rightMp: number;
  bridgeStep?: number;
  leftInFront?: boolean; // Exact FD2.EXE L104405/L105129 Z-order in `both` mode: when true, Left Enemy draws ON TOP OF Right Hero; when false (default), Right Hero draws ON TOP OF Left Enemy
  beamImpactFlash?: 'intense' | 'fade'; // Map-beam arrival flash on Target Screen for solo beam turret (`#113 光束砲座`, `fn_100228` + `L20919`)
  missileFrame?: { img: HTMLImageElement; strip: FigAniStrip; fIdx: number };
  spellFrame?: {
    img: HTMLImageElement;
    strip: FigAniStrip;
    fIdx: number;
    align: 'target_anchor' | 'screen_abs';
    targetCenterX: number;
    instances?: SpellBurstInstance[]; // authentic FD2.EXE GLOBAL_9145[0..9] multi-sprite trajectories
  };
  sfxTrigger?: 'slash' | 'hit' | 'crit' | 'miss' | 'magic' | 'heal';
}

export const REMOTE_BRIDGE_STEPS = 6;

/**
 * Exact target hit knockback / recoil curve extracted from `FD2.EXE` (Obj2:9567, `Func_103325`):
 * Counter `v6` initializes to `0` (`dx = 0`), jumps to `5` on each `b4 == 1` hit frame (when `dx == 0`),
 * and decrements `5 -> 4 -> 3 -> 2 -> 1 -> 0` once per DOS 55ms tick:
 *   v6:   5 ->  4 ->  3 -> 2 -> 1 -> 0
 *   dx:  14 -> 18 -> 14 -> 9 -> 4 -> 0  (Left enemy shifts -dx left; Right hero shifts +dx right; TAI stays fixed)
 */
export const PHYSICAL_HIT_RECOIL_CURVE = [0, 4, 9, 14, 18, 14] as const;

/**
 * Exact 1-stage melee vertical knockback component `dy` on the defender sprite from `FD2.EXE`
 * (Obj2:9591, `Func_103325` `L104467`/`L105191`: `dst_origin ± dx ± dy * 400`, while `BG.DAT` and `TAI.DAT` stay 100% stationary!).
 * Indexed by `v6` (`5 -> 0`) when `isRemote == 0`: `10 -> 8 -> 6 -> 4 -> 2 -> 0` px
 * (Left enemy shifts `-dy` up-left; Right hero shifts `+dy` down-right along the isometric battle line).
 */
export const MELEE_HIT_RECOIL_Y_CURVE = [0, 2, 4, 6, 8, 10] as const;

/**
 * Exact multi-target magic recoil curves from `FD2.EXE` (Obj2:9615 & Obj2:9631, `Func_108289`):
 * `dx = [6, 4, 2, 0]` (away from screen center) and `dy = [-3, -2, -1, 0]` across 4 ticks.
 */
export const MAGIC_HIT_RECOIL_X_CURVE = [6, 4, 2, 0] as const;

// Heroes with Special Combat Techniques (`#24 破龍擊`, `#28 淒煌斬`, `#29 熾炎刀`, `#30 音速刃`, matching `FD2.EXE` Func_95980):
// #18 蜜蒂 (`#30 音速刃`), #19 羅德曼 (`#28 淒煌斬`), #25 謝多 (`#28 淒煌斬`), #32/#50 索爾 (`#24 破龍擊`), #34 鐵諾 (`#29 熾炎刀`)
const HERO_SPECIAL_WAVE_UIDS = new Set<number>([18, 19, 25, 32, 34, 50]);

// Pure spellcaster classes whose `figani.ranged` (or `figani.attack`) is a spell-casting motion rather than a physical ranged weapon
const PURE_SPELLCASTER_UIDS = new Set<number>([
  9, 10, 11, 14, 21, 24, 29, 41, 42, 43, 46, 52, 59, 60, 61, 64,
  90, 91, 92, 93, 94, 95, 107,
]);

// Units with dedicated Solo Beam Turret Cutaway (`FD2.EXE` `fn_100228` + Item `#79 光束炮`, `b16 >= 16`):
// `#113 光束砲座` is stationary (`mv = 0`) and fires an 8-tile linear piercing laser beam alone on its screen (`fn_100228`), NEVER in 2-unit melee!
const SOLO_BEAM_TURRET_UIDS = new Set<number>([113]);

// Units equipped with multi-tile physical reach / breath / wave weapons (`maxRange >= 2` with `minRange == 1` in `FDFIELD.DAT` / `FD2.EXE` item table):
// Note: In `FD2.EXE` (`fn_100972`), ALL weapon attacks (both 1-tile and 2..3-tile reach/breath) use `3*uid + 1` (`figani.attack`), NEVER `3*uid + 2` (`figani.ranged`)!
// `3*uid + 2` (`figani.ranged`) is ONLY loaded by `fn_95980` (Special Techniques `#24/#28/#29/#30`) and `fn_108289` (Magic Casting chant, e.g. `#90..#92, #104, #105, #107, #110, #124..#127`)!
const HYBRID_REACH_WEAPON_UIDS = new Set<number>([
  // Heroes & Promoted Cavalry / Dragon Knights / Mechs with spears/halberds/flails/arms (`[1..2]`):
  4, 5, 6, 7, 14, 20, 31, 36, 37, 38, 54, 55, 56, 69,
  // Enemy Cavalry, Dragon Knights, Dark Mages/Priests with `[1..2]` lances/flails:
  82, 83, 84, 85, 86, 91, 94, 118, 120,
  // Mechs with `#78 光束槍 [1..2]`:
  112, 115,
  // Dragons & Demon Gods with 2..3-tile breath / wave weapons (`#103 火燄 [1..3]`, `#106 冰燄 [1..3]`, `#84 激水炮 [1..3]`, `#85 風牙斬 [1..2]`, `#86 魔燄波 [1..2]`, `#107 黑暗波 [1..3]`):
  104, 105, 123, 124, 125, 127,
]);

/** Returns true if a spell is a genuine 320x200 cutaway battle-stage attack spell (`#0..#9` or `#32 熾天使`). */
export function isCutawayAttackMagic(sp: SpellDef | undefined | null): boolean {
  if (!sp) return false;
  if (sp.spellCategory !== undefined) {
    return sp.spellCategory === 'cutaway_attack';
  }
  return (sp.id >= 0 && sp.id <= 9) || sp.id === 32;
}

export interface UnitMoveCapabilities {
  hasMelee: boolean;
  hasRanged: boolean;
  hasSpecial: boolean;
  hasMagic: boolean;
  spells: SpellDef[]; // Cutaway battle-stage attacking magic ONLY (#0..#9, #32)
  mapOnlyAttackSpells: SpellDef[]; // Tactical map-only AoE attack magic (#10..#12: 碎岩術/地震術/裂地術)
  supportSpells: SpellDef[]; // Non-attacking heal/buff/cure/status/teleport spells (#13..#23, #25..#27, #33..#35)
  specialTechniques: SpellDef[]; // Combat techniques (#24 破龍擊, #28 淒煌斬, #29 熾炎刀, #30 音速刃)
  meleeSlot: 'attack' | null;
  rangedSlot: 'attack' | 'ranged' | null;
  specialSlot: 'ranged' | 'attack' | null;
  magicCastSlot: 'ranged' | 'attack' | 'idle' | null;
}

/**
 * Resolves exact combat move availability for any unit (0..135) in Flame Dragon II,
 * matching the engine's binary `FIGANI.DAT`, `FD2.EXE` (`L21470`/`L54292`/`Func_108221`/`Func_95980`/`Func_98249`),
 * and `FDFIELD.DAT` spell bitmasks.
 */
export function getUnitMoveCapabilities(uid: number, gd: GameData, isHeroInitiator: boolean): UnitMoveCapabilities {
  const entry: UnitDexEntry | undefined = gd.unitDex[uid];
  // Non-battlefield NPCs (#39, #48, #57, #66, #67, #74, #75, #128..#132) and defenseless protected battlefield NPCs
  // (#133 女村民, #134 男村民, #135 卡納恩三世) NEVER attack, counterattack, or cast spells in FD2.EXE!
  if (entry && (!entry.appearsOnBattlefield || !entry.canAttack)) {
    return {
      hasMelee: false,
      hasRanged: false,
      hasSpecial: false,
      hasMagic: false,
      spells: [],
      mapOnlyAttackSpells: [],
      supportSpells: [],
      specialTechniques: [],
      meleeSlot: null,
      rangedSlot: null,
      specialSlot: null,
      magicCastSlot: null,
    };
  }
  const fig = entry?.figani;
  const atk = fig?.attack ?? null;
  const rng = fig?.ranged ?? null;

  // Pure ranged shooters (bows, crossbows, mech sniper `atk.isRemote`, plus stationary solo laser cannon `#113 光束砲座`):
  // Their primary `attack` strip is a remote/beam attack (`minRange >= 2` or `#79 光束炮` linear 8-tile ray), so they have Ranged and NO Melee.
  const isPureRangedShooter = Boolean(atk?.isRemote) || SOLO_BEAM_TURRET_UIDS.has(uid);

  const hasMelee = Boolean(atk && !isPureRangedShooter);

  // In FD2.EXE (`fn_100972` & `fn_100228`), ALL physical/breath/wave/beam weapon attacks use `3*uid + 1` (`figani.attack`)!
  // `3*uid + 2` (`figani.ranged`) is NEVER loaded by weapon combat — it is exclusively Special Techniques (`fn_95980`) or Magic Casting (`fn_108289`).
  let rangedSlot: 'attack' | 'ranged' | null = null;
  if ((isPureRangedShooter || HYBRID_REACH_WEAPON_UIDS.has(uid)) && atk) {
    rangedSlot = 'attack';
  }
  const hasRanged = rangedSlot !== null;

  // Gather known spells up to the exact selected promotion tier (not future promotions!)
  const spellIdSet = new Set<number>();
  if (entry) {
    const baseHid = entry.baseHeroId ?? (uid < 32 ? uid : null);
    if (baseHid !== null && gd.heroes[baseHid]) {
      const h = gd.heroes[baseHid];
      h.spells.forEach((s) => spellIdSet.add(s));
      const selectedPromo = h.promotions.find((p) => p.unitId === uid);
      const maxTier = selectedPromo?.tier ?? 1;
      for (const pr of h.promotions) {
        if (pr.tier < maxTier || pr.unitId === uid) {
          pr.growth?.learnableSpells.forEach((ls) => spellIdSet.add(ls.spellId));
        }
      }
    }
    if (entry.growth?.learnableSpells) {
      entry.growth.learnableSpells.forEach((ls) => spellIdSet.add(ls.spellId));
    }
    const ec = entry.enemyStats;
    const canUseFieldSpellMask =
      entry.role === 'hero' ||
      entry.role === 'hero_promo_t2' ||
      entry.role === 'hero_promo_t3' ||
      PURE_SPELLCASTER_UIDS.has(uid) ||
      entry.role === 'boss' ||
      (ec !== null && ec !== undefined && ec.mpGrowth > 0);
    if (canUseFieldSpellMask && entry.knownSpells) {
      entry.knownSpells.forEach((s) => spellIdSet.add(s));
    }
  }

  const allKnown = Array.from(spellIdSet)
    .map((sid) => gd.spells[sid])
    .filter((sp): sp is SpellDef => Boolean(sp && sp.id !== 31));

  // Partition into exact FD2.EXE categories:
  // 1) Cutaway Attack Magic (#0..#9 + #32 熾天使): ONLY these apply to "法術攻擊 (Magic)" cutaway battle animations!
  const spells = allKnown
    .filter((sp) => isCutawayAttackMagic(sp))
    .sort((a, b) => a.id - b.id);

  // 2) Map-only Attack Magic (#10 碎岩術, #11 地震術, #12 裂地術): AoE damage on tactical grid, NO cutaway stage animation!
  const mapOnlyAttackSpells = allKnown
    .filter((sp) => sp.spellCategory === 'map_attack' || (sp.id >= 10 && sp.id <= 12))
    .sort((a, b) => a.id - b.id);

  // 3) Special Combat Techniques (#24 破龍擊, #28 淒煌斬, #29 熾炎刀, #30 音速刃) -> routed to Func_95980 (`必殺/劍氣`)!
  // Note: #25 謝多 (Ninja) has #28 淒煌斬 in his `3*uid + 2` (`figani.ranged`) strip in FD2.EXE (`fn_95980`)!
  if (uid === 25 && gd.spells[28]) {
    spellIdSet.add(28);
  }
  const specialTechniques = Array.from(spellIdSet)
    .map((sid) => gd.spells[sid])
    .filter((sp): sp is SpellDef => Boolean(sp && (sp.spellCategory === 'special_tech' || sp.id === 24 || (sp.id >= 28 && sp.id <= 30))))
    .sort((a, b) => a.id - b.id);

  // 4) Non-attacking Support / Heal / Cure / Teleport / Buff / Debuff Magic (#13..#23, #25..#27, #33..#35)
  const supportSpells = allKnown
    .filter(
      (sp) =>
        !isCutawayAttackMagic(sp) &&
        sp.spellCategory !== 'map_attack' &&
        sp.spellCategory !== 'special_tech' &&
        !(sp.id >= 10 && sp.id <= 12) &&
        sp.id !== 24 &&
        !(sp.id >= 28 && sp.id <= 30)
    )
    .sort((a, b) => a.id - b.id);

  let specialSlot: 'ranged' | 'attack' | null = null;
  if (isHeroInitiator && (HERO_SPECIAL_WAVE_UIDS.has(uid) || specialTechniques.length > 0)) {
    if (rng) specialSlot = 'ranged';
    else if (atk && specialTechniques.length > 0) specialSlot = 'attack';
  }
  const hasSpecial = specialSlot !== null;

  // Exact FD2.EXE `fn_108289` (`L109053..109148`):
  // Whenever a unit casts cutaway magic (`#0..#9`), `FD2.EXE` ALWAYS loads `3*uid + 2` (`figani.ranged`) FIRST if non-empty
  // (e.g. `#90..#92` Mages, `#107` Dragon Mage, `#104` Fire Dragon, `#105` Thunder Dragon, `#127` Dark Dragon, `#110` Archdemon,
  // `#124..#126` Demon Gods, `#50` Sol Hero), and only falls back to `3*uid + 1` (`attack`) when `3*uid + 2` is empty!
  // (Exception: `#25 謝多` whose `3*uid + 2` is his `#28 淒煌斬` sword slash rather than a magic chant.)
  const magicCastSlot: 'ranged' | 'attack' | 'idle' | null =
    spells.length > 0
      ? rng && uid !== 25
        ? 'ranged'
        : atk && !atk.isRemote
          ? 'attack'
          : fig?.idle
            ? 'idle'
            : null
      : null;

  return {
    hasMelee,
    hasRanged,
    hasSpecial,
    hasMagic: spells.length > 0 && magicCastSlot !== null,
    spells,
    mapOnlyAttackSpells,
    supportSpells,
    specialTechniques,
    meleeSlot: hasMelee ? 'attack' : null,
    rangedSlot,
    specialSlot,
    magicCastSlot,
  };
}

/**
 * Extracts the exact hit-impact frame indices from a FIGANI or FDOTHER spell strip,
 * using the binary frame header boolean hit trigger `sfx` (`fr[4]` / `b4 == 1`).
 * Note: `hitFlag` (`fr[5]` / `b5 = 1..6`) is the Sound Effect ID (e.g. horse gallop `b5=2` on non-hit frames)
 * and must NOT be treated as a hit trigger!
 */
export function getHitFrameIndices(
  strip: FigAniStrip,
  startIdx = 0,
  endIdx = strip.frames.length,
  spellFallbackStripId?: number
): number[] {
  const hits: number[] = [];
  for (let i = startIdx; i < endIdx && i < strip.frames.length; i++) {
    const fr = strip.frames[i];
    if (fr.sfx && fr.sfx !== 0) {
      hits.push(i);
    }
  }
  if (hits.length > 0) return hits;

  // Deterministic peak-impact frames for FDOTHER spell strips that have b4=0 in raw data
  if (spellFallbackStripId !== undefined) {
    if (spellFallbackStripId === 26 || spellFallbackStripId === 27) return [Math.min(endIdx - 1, 14)]; // 炎龍術 Fire Dragon impact
    if (spellFallbackStripId === 32 || spellFallbackStripId === 33) return [Math.min(endIdx - 1, 5)]; // 聖光彈 / 治療術 burst
    if (spellFallbackStripId === 37 || spellFallbackStripId === 38) return [Math.min(endIdx - 1, 1)]; // 轟雷術 pillar strike
    if (spellFallbackStripId === 44) return [Math.min(endIdx - 1, 15)]; // 咒殺術 demon pillar
    if (spellFallbackStripId === 24 || spellFallbackStripId === 25) return [Math.min(endIdx - 1, 2), Math.min(endIdx - 1, 8)];
    if (spellFallbackStripId >= 65 && spellFallbackStripId <= 68) return [Math.max(startIdx, endIdx - 2)]; // Summons
  }

  const len = Math.max(1, endIdx - startIdx);
  return [startIdx + Math.min(len - 1, Math.floor(len * 0.6))];
}

/** Computes the visual horizontal center X of a combatant from their idle FIGANI frame (for target_anchor spells). */
export function getCombatantCenterX(
  idlePack: { img: HTMLImageElement; strip: FigAniStrip } | null,
  isHeroSide: boolean
): number {
  const f0 = idlePack?.strip.frames[0];
  if (f0 && f0.w > 0) {
    return Math.round(f0.ox + f0.w * 0.5);
  }
  return isHeroSide ? 240 : 72;
}

/** Splits total damage cleanly across `hitCount` hit frames so the sum equals `totalDamage` exactly. */
export function splitDamageAcrossHits(totalDamage: number, hitCount: number): number[] {
  const n = Math.max(1, hitCount);
  if (totalDamage <= 0) return Array(n).fill(0);
  const base = Math.floor(totalDamage / n);
  const rem = totalDamage - base * n;
  return Array.from({ length: n }, (_, idx) => base + (idx >= n - rem ? 1 : 0));
}

export interface PhysicalStrikeTimelineInput {
  bgId: number;
  actor: CombatantSpec;
  target: CombatantSpec;
  actorIdle: { img: HTMLImageElement; strip: FigAniStrip } | null;
  actorAct: { img: HTMLImageElement; strip: FigAniStrip } | null;
  targetIdle: { img: HTMLImageElement; strip: FigAniStrip } | null;
  hit: boolean;
  crit: boolean;
  totalDamage: number;
  actorCurHp: number;
  targetStartHp: number;
  actorMpCost?: number;
  specialTechId?: number | null; // e.g. 28 for `#19 羅德曼` (`淒煌斬`, `fn_95980`: Stage A `0..split-1` solo -> Stage B `split..end-1` shared)
}

/**
 * Builds frame-exact timeline steps for:
 *  1) 3-stage remote bridged attack (`atk.isRemote`: Stage 1 Attacker alone -> Stage 2 BG[0..2] speed lines -> Stage 3 Target alone + missile + multi-hit sync)
 *  2) Solo Beam Turret Cutaway (`#113 光束砲座`, `FD2.EXE` `fn_100228` + `L20885`: Stage 1 Turret alone firing `F00..F15` 320px laser beam -> Stage 2 BG[0..2] bridge -> Stage 3 Target alone struck by piercing beam flash + recoil + HP drain)
 *  3) 2-stage Special Technique `#28 淒煌斬` (`#19 羅德曼`, `FD2.EXE` `fn_95980`: Stage 1 solo stance `0..split-1` -> Stage 2 shared-screen rapid slash flurry `split..end-1` with MP deduction)
 *  4) 1-stage shared-screen attack (both units on screen, honoring exact `FD2.EXE` `L104405`/`L105129` `fgLayer` (`fr[7] & 1`) Z-order and multi-hit recoil sync)
 */
export function buildPhysicalStrikeTimeline(inp: PhysicalStrikeTimelineInput): TimelineStep[] {
  const steps: TimelineStep[] = [];
  const { actor, target, actorIdle, actorAct, targetIdle } = inp;
  const leftUnit = actor.isHeroSide ? target : actor;
  const rightUnit = actor.isHeroSide ? actor : target;

  const actPack = actorAct ?? actorIdle;
  const frames = actPack?.strip.frames ?? [];
  const splitVal = actPack?.strip.splitFrame ?? frames.length;
  const hasSubSplit = splitVal > 0 && splitVal < frames.length;
  const isRemote3Stage = Boolean(actPack?.strip.isRemote && hasSubSplit);
  const isSoloBeamTurret = SOLO_BEAM_TURRET_UIDS.has(actor.uid) && Boolean(actPack && frames.length > 0);
  const isSpecial2StageShared = Boolean(!isRemote3Stage && inp.specialTechId === 28 && hasSubSplit);

  let curTargetHp = inp.targetStartHp;
  let curActorMp = actor.startMp;
  const mpCost = inp.actorMpCost ?? 0;
  let mpDeducted = false;

  const makeStep = (partial: Partial<TimelineStep> & { delay: number; mode: StageViewMode; stageLabel: string }): TimelineStep => {
    const leftHp = actor.isHeroSide ? curTargetHp : inp.actorCurHp;
    const rightHp = actor.isHeroSide ? inp.actorCurHp : curTargetHp;
    const leftMp = actor.isHeroSide ? target.startMp : curActorMp;
    const rightMp = actor.isHeroSide ? curActorMp : target.startMp;
    return {
      leftUnit,
      rightUnit,
      leftPack: actor.isHeroSide ? targetIdle : actorIdle,
      leftFrameIdx: 0,
      leftHp,
      leftMp,
      rightPack: actor.isHeroSide ? actorIdle : targetIdle,
      rightFrameIdx: 0,
      rightHp,
      rightMp,
      ...partial,
    };
  };

  if (isSoloBeamTurret && actPack) {
    // Exact FD2.EXE `fn_100228` (`L100228..100971`) + Linear Ray Beam (`L20885..20955`):
    // Stage 1: `#113 光束砲座` stands ALONE on its screen (`actorMode`), slides in, charges (`F00..F05`),
    //          fires the full-screen 320x150 blinding laser beam (`F06`), and cools down (`F07..F15`) — NEVER sharing a melee screen with the target!
    const actorMode: StageViewMode = actor.isHeroSide ? 'right_only' : 'left_only';
    const targetMode: StageViewMode = target.isHeroSide ? 'right_only' : 'left_only';
    const SLIDE_IN_STEPS = 5;
    const maxOffset = actor.isHeroSide ? 140 : -140;

    for (let s = 0; s < SLIDE_IN_STEPS; s++) {
      const t = (s + 1) / SLIDE_IN_STEPS;
      const ease = 1 - Math.pow(1 - t, 2);
      const slideX = Math.round(maxOffset * (1 - ease));
      steps.push(
        makeStep({
          delay: 1,
          mode: actorMode,
          stageLabel: `[1/3 砲座就位] ${s + 1}/${SLIDE_IN_STEPS}`,
          leftPack: actor.isHeroSide ? targetIdle : (actorIdle ?? actPack),
          leftFrameIdx: 0,
          leftSlideX: actor.isHeroSide ? 0 : slideX,
          rightPack: actor.isHeroSide ? (actorIdle ?? actPack) : targetIdle,
          rightFrameIdx: 0,
          rightSlideX: actor.isHeroSide ? slideX : 0,
          rightTaiSlideX: actor.isHeroSide ? slideX : 0,
        })
      );
    }

    for (let i = 0; i < frames.length; i++) {
      const fr = frames[i];
      const dly = Math.max(1, fr.delay || 2);
      const isBeamFire = Boolean(fr.sfx && fr.sfx !== 0);
      steps.push(
        makeStep({
          delay: dly,
          mode: actorMode,
          stageLabel: `[1/3 光束砲發射] F${i + 1}/${frames.length}${isBeamFire ? ' ★BEAM' : ''}`,
          leftPack: actor.isHeroSide ? targetIdle : actPack,
          leftFrameIdx: actor.isHeroSide ? 0 : i,
          rightPack: actor.isHeroSide ? actPack : targetIdle,
          rightFrameIdx: actor.isHeroSide ? i : 0,
          sfxTrigger: isBeamFire ? 'magic' : i === 0 || fr.hitFlag ? 'slash' : undefined,
        })
      );
    }

    // Stage 2: Bridging horizontal speed-line strips BG.DAT[0..2] carrying the beam across the battlefield
    for (let b = 0; b < REMOTE_BRIDGE_STEPS; b++) {
      steps.push(
        makeStep({
          delay: 2,
          mode: 'bridge',
          stageLabel: `[2/3 光束貫穿] BG[${b % 3}] (${b + 1}/${REMOTE_BRIDGE_STEPS})`,
          bridgeStep: b,
        })
      );
    }

    // Stage 3: Target's screen alone struck by the arriving piercing laser beam + white flash (`L20919`) + 6-tick recoil + HP drain
    let recoilV6 = 0;
    const impactTicks = 10;
    for (let tick = 0; tick < impactTicks; tick++) {
      let frameSfx: TimelineStep['sfxTrigger'];
      let isFlashTick = false;
      let beamFlash: TimelineStep['beamImpactFlash'];

      if (tick === 1) {
        if (!inp.hit) {
          frameSfx = 'miss';
        } else {
          curTargetHp = Math.max(0, curTargetHp - inp.totalDamage);
          recoilV6 = 5;
          isFlashTick = true;
          beamFlash = 'intense';
          frameSfx = inp.crit ? 'crit' : 'hit';
        }
      } else if (inp.hit && (tick === 2 || tick === 3)) {
        beamFlash = tick === 2 ? 'intense' : 'fade';
      }

      const dx = PHYSICAL_HIT_RECOIL_CURVE[recoilV6];
      const signedRecoilX = target.isHeroSide ? dx : -dx;
      const recoilNote = dx > 0 ? ` · 擊退 ${signedRecoilX > 0 ? `+${signedRecoilX}` : signedRecoilX}px` : '';

      steps.push(
        makeStep({
          delay: 1,
          mode: targetMode,
          stageLabel: `[3/3 光束命中] T${tick + 1}/${impactTicks}${tick === 1 ? ' ★HIT 1/1' : ''}${recoilNote}`,
          leftSlideX: !target.isHeroSide ? signedRecoilX : 0,
          rightSlideX: target.isHeroSide ? signedRecoilX : 0,
          leftFlash: !target.isHeroSide && isFlashTick,
          rightFlash: target.isHeroSide && isFlashTick,
          beamImpactFlash: beamFlash,
          sfxTrigger: frameSfx,
        })
      );

      if (recoilV6 > 0) recoilV6--;
    }

    const settleTicks = Math.max(6, recoilV6 + 4);
    for (let h = 0; h < settleTicks; h++) {
      const dx = PHYSICAL_HIT_RECOIL_CURVE[recoilV6];
      const signedRecoilX = target.isHeroSide ? dx : -dx;
      steps.push(
        makeStep({
          delay: 1,
          mode: targetMode,
          stageLabel: `[結算] 總傷害 -${inp.hit ? inp.totalDamage : 0} (1 Hit)`,
          leftSlideX: !target.isHeroSide ? signedRecoilX : 0,
          rightSlideX: target.isHeroSide ? signedRecoilX : 0,
        })
      );
      if (recoilV6 > 0) recoilV6--;
    }

    return steps;
  }

  if (isRemote3Stage && actPack) {
    const split = actPack.strip.splitFrame!;
    const actorMode: StageViewMode = actor.isHeroSide ? 'right_only' : 'left_only';
    const targetMode: StageViewMode = target.isHeroSide ? 'right_only' : 'left_only';

    // Stage 1: Attacker performs ranged/wave launch on their own screen (no target)
    const launchTriggerIdx = frames.slice(0, split).findIndex((f) => f.sfx && f.sfx !== 0);
    const mpTriggerIdx = launchTriggerIdx >= 0 ? launchTriggerIdx : Math.max(0, split - 1);
    for (let i = 0; i < split; i++) {
      if (!mpDeducted && mpCost > 0 && i === mpTriggerIdx) {
        curActorMp = Math.max(0, curActorMp - mpCost);
        mpDeducted = true;
      }
      const dly = Math.max(1, frames[i].delay || 2);
      steps.push(
        makeStep({
          delay: dly,
          mode: actorMode,
          stageLabel: `[1/3 攻方發動] F${i + 1}/${frames.length}`,
          leftPack: actor.isHeroSide ? targetIdle : actPack,
          leftFrameIdx: actor.isHeroSide ? 0 : i,
          rightPack: actor.isHeroSide ? actPack : targetIdle,
          rightFrameIdx: actor.isHeroSide ? i : 0,
          sfxTrigger: i === 0 || frames[i].hitFlag ? 'slash' : undefined,
        })
      );
    }

    // Stage 2: Bridging horizontal speed-line strips BG.DAT[0..2]
    for (let b = 0; b < REMOTE_BRIDGE_STEPS; b++) {
      steps.push(
        makeStep({
          delay: 2,
          mode: 'bridge',
          stageLabel: `[2/3 遠程過場] BG[${b % 3}] (${b + 1}/${REMOTE_BRIDGE_STEPS})`,
          bridgeStep: b,
        })
      );
    }

    // Stage 3: Target's screen alone + arriving missile frames [split..end-1],
    // running tick-by-tick so FD2.EXE's 6-step recoil curve [0,4,9,14,18,14] (v6: 5->0) plays at 55ms resolution!
    const hitFrames = getHitFrameIndices(actPack.strip, split, frames.length);
    const hitDamages = splitDamageAcrossHits(inp.hit ? inp.totalDamage : 0, hitFrames.length);
    const hitMap = new Map<number, { idx: number; dmg: number }>();
    hitFrames.forEach((fIdx, k) => hitMap.set(fIdx, { idx: k, dmg: hitDamages[k] }));

    let recoilV6 = 0; // FD2.EXE Func_103325 recoil index (0..5)

    for (let i = split; i < frames.length; i++) {
      const dly = Math.max(1, frames[i].delay || 2);
      const hitInfo = hitMap.get(i);
      let frameSfx: TimelineStep['sfxTrigger'];
      let isHitFrame = false;

      if (hitInfo) {
        if (!inp.hit) {
          frameSfx = 'miss';
        } else {
          curTargetHp = Math.max(0, curTargetHp - hitInfo.dmg);
          isHitFrame = true;
          // Exact FD2.EXE trigger (L104317..104324): if recoil dx == 0, set v6 = 5 (recoil 14->18->14->9->4->0)
          if (PHYSICAL_HIT_RECOIL_CURVE[recoilV6] === 0) {
            recoilV6 = 5;
          }
          frameSfx = inp.crit ? 'crit' : 'hit';
        }
      }

      for (let tick = 0; tick < dly; tick++) {
        const dx = PHYSICAL_HIT_RECOIL_CURVE[recoilV6];
        const signedRecoilX = target.isHeroSide ? dx : -dx;
        const isFlashTick = isHitFrame && tick === 0;
        const recoilNote = dx > 0 ? ` · 擊退 ${signedRecoilX > 0 ? `+${signedRecoilX}` : signedRecoilX}px` : '';

        steps.push(
          makeStep({
            delay: 1,
            mode: targetMode,
            stageLabel: `[3/3 命中目標] F${i + 1}/${frames.length} (T${tick + 1}/${dly})${hitInfo && tick === 0 ? ` ★HIT ${hitInfo.idx + 1}/${hitFrames.length}` : ''}${recoilNote}`,
            leftSlideX: !target.isHeroSide ? signedRecoilX : 0,
            rightSlideX: target.isHeroSide ? signedRecoilX : 0,
            leftFlash: !target.isHeroSide && isFlashTick,
            rightFlash: target.isHeroSide && isFlashTick,
            missileFrame: { img: actPack.img, strip: actPack.strip, fIdx: i },
            sfxTrigger: tick === 0 ? frameSfx : undefined,
          })
        );

        if (recoilV6 > 0) recoilV6--;
      }
    }

    // Settle hold on target screen (draining any remaining recoilV6 smoothly to 0 first)
    const settleTicks = Math.max(8, recoilV6 + 4);
    for (let h = 0; h < settleTicks; h++) {
      const dx = PHYSICAL_HIT_RECOIL_CURVE[recoilV6];
      const signedRecoilX = target.isHeroSide ? dx : -dx;
      const recoilNote = dx > 0 ? ` · 歸位 ${signedRecoilX > 0 ? `+${signedRecoilX}` : signedRecoilX}px` : '';
      steps.push(
        makeStep({
          delay: 1,
          mode: targetMode,
          stageLabel: `[結算] 總傷害 -${inp.hit ? inp.totalDamage : 0} (${hitFrames.length} Hits)${recoilNote}`,
          leftSlideX: !target.isHeroSide ? signedRecoilX : 0,
          rightSlideX: target.isHeroSide ? signedRecoilX : 0,
        })
      );
      if (recoilV6 > 0) recoilV6--;
    }
  } else {
    // 1-Stage Shared Screen Attack (Melee, Reach/Breath, or `#28 淒煌斬` Special Technique)
    // Runs tick-by-tick at 55ms resolution with exact FD2.EXE diagonal unit recoil [0,4,9,14,18,14] / [0,2,4,6,8,10]
    // and exact FD2.EXE `L104405`/`L105129` `fgLayer` (`M1[fr+7] & 1`) foreground/background sprite Z-order!
    const count = Math.max(1, frames.length);
    const sharedStartIdx = isSpecial2StageShared ? splitVal : 0;

    // For `#19 羅德曼`'s `#28 淒煌斬` (`fn_95980` `L96945..97046` + `fn_112217` `L112613`),
    // Stage A (`0 .. splitVal-1`) plays the Hero ALONE (`actorMode`) with target HUD shown (`showBothHuds: true`),
    // deducting MP on `b4 == 1`, and then Stage B (`sharedStartIdx .. count-1`) brings the target onto the shared screen for the 8-slash flurry!
    if (isSpecial2StageShared && actPack) {
      const actorMode: StageViewMode = actor.isHeroSide ? 'right_only' : 'left_only';
      for (let i = 0; i < sharedStartIdx; i++) {
        const fr = frames[i];
        if (!mpDeducted && mpCost > 0 && ((fr.sfx && fr.sfx !== 0) || i === sharedStartIdx - 1)) {
          curActorMp = Math.max(0, curActorMp - mpCost);
          mpDeducted = true;
        }
        const dly = Math.max(1, fr.delay || 2);
        steps.push(
          makeStep({
            delay: dly,
            mode: actorMode,
            showBothHuds: true,
            stageLabel: `[1/2 必殺蓄力] F${i + 1}/${count}`,
            leftPack: actor.isHeroSide ? targetIdle : actPack,
            leftFrameIdx: actor.isHeroSide ? 0 : i,
            rightPack: actor.isHeroSide ? actPack : targetIdle,
            rightFrameIdx: actor.isHeroSide ? i : 0,
            sfxTrigger: i === 0 || fr.hitFlag ? 'slash' : undefined,
          })
        );
      }
    }

    const hitFrames = actPack ? getHitFrameIndices(actPack.strip, sharedStartIdx, count) : [0];
    const hitDamages = splitDamageAcrossHits(inp.hit ? inp.totalDamage : 0, hitFrames.length);
    const hitMap = new Map<number, { idx: number; dmg: number }>();
    hitFrames.forEach((fIdx, k) => hitMap.set(fIdx, { idx: k, dmg: hitDamages[k] }));
    const isStripRemote = Boolean(actPack?.strip.isRemote) || Boolean(inp.specialTechId);

    let recoilV6 = 0; // FD2.EXE Func_103325 recoil index (0..5)

    for (let i = sharedStartIdx; i < count; i++) {
      const fr = frames[i];
      const dly = fr ? Math.max(1, fr.delay || 2) : 3;
      const hitInfo = hitMap.get(i);
      let frameSfx: TimelineStep['sfxTrigger'] =
        i === sharedStartIdx || (fr?.hitFlag && !hitInfo) ? 'slash' : undefined;
      let isHitFrame = false;

      // Exact FD2.EXE `Func_103325` Z-order (`L104405..104529` when Hero attacks, `L105129..105250` when Enemy attacks):
      // - When Hero (`rightUnit`) attacks: default (`fgLayer == false`) draws Hero FIRST and Left Enemy ON TOP (`leftInFront = true`);
      //   when `fgLayer == true`, draws Left Enemy FIRST and Hero ON TOP (`leftInFront = false`).
      // - When Enemy (`leftUnit`) attacks: default (`fgLayer == false`) draws Right Hero ON TOP of Left Enemy (`leftInFront = false`);
      //   when `fgLayer == true` (e.g. `#104/#105/#127` Dragon Breath, `#111/#112/#115` Mech Laser, `#126` 空魔神 Thunder Pillar),
      //   draws Right Hero FIRST and Left Enemy ON TOP (`leftInFront = true`) so the breath/beam/pillar engulfs the Hero!
      const actorFg = Boolean(fr?.fgLayer);
      const leftInFront = actor.isHeroSide ? !actorFg : actorFg;

      if (!mpDeducted && mpCost > 0 && (hitInfo || i === hitFrames[0])) {
        curActorMp = Math.max(0, curActorMp - mpCost);
        mpDeducted = true;
      }

      if (hitInfo) {
        if (!inp.hit) {
          frameSfx = 'miss';
        } else {
          curTargetHp = Math.max(0, curTargetHp - hitInfo.dmg);
          isHitFrame = true;
          // Exact FD2.EXE trigger (L104317..104324): when dx == 0, set v6 = 5 (recoil 14->18->14->9->4->0)
          if (PHYSICAL_HIT_RECOIL_CURVE[recoilV6] === 0) {
            recoilV6 = 5;
          }
          frameSfx = inp.crit ? 'crit' : 'hit';
        }
      }

      const stagePrefix = isSpecial2StageShared ? '[2/2 淒煌連斬]' : inp.specialTechId ? '[必殺技]' : '[交鋒]';

      for (let tick = 0; tick < dly; tick++) {
        const dx = PHYSICAL_HIT_RECOIL_CURVE[recoilV6];
        const dy = isStripRemote ? 0 : MELEE_HIT_RECOIL_Y_CURVE[recoilV6];
        const signedRecoilX = target.isHeroSide ? dx : -dx;
        const signedRecoilY = target.isHeroSide ? dy : -dy;
        const isFlashTick = isHitFrame && tick === 0;
        const recoilNote =
          dx > 0
            ? ` · 擊退 (${signedRecoilX > 0 ? `+${signedRecoilX}` : signedRecoilX},${signedRecoilY > 0 ? `+${signedRecoilY}` : signedRecoilY})px`
            : '';

        steps.push(
          makeStep({
            delay: 1,
            mode: 'both',
            leftInFront,
            stageLabel: `${stagePrefix} F${i + 1}/${count} (T${tick + 1}/${dly})${hitInfo && tick === 0 ? ` ★HIT ${hitInfo.idx + 1}/${hitFrames.length}` : ''}${recoilNote}`,
            leftPack: actor.isHeroSide ? targetIdle : actPack,
            leftFrameIdx: actor.isHeroSide ? 0 : i,
            leftSlideX: !target.isHeroSide ? signedRecoilX : 0,
            leftSlideY: !target.isHeroSide ? signedRecoilY : 0,
            leftFlash: !target.isHeroSide && isFlashTick,
            rightPack: actor.isHeroSide ? actPack : targetIdle,
            rightFrameIdx: actor.isHeroSide ? i : 0,
            rightSlideX: target.isHeroSide ? signedRecoilX : 0,
            rightSlideY: target.isHeroSide ? signedRecoilY : 0,
            rightFlash: target.isHeroSide && isFlashTick,
            sfxTrigger: tick === 0 ? frameSfx : undefined,
          })
        );

        if (recoilV6 > 0) recoilV6--;
      }
    }

    const settleTicks = Math.max(8, recoilV6 + 4);
    for (let h = 0; h < settleTicks; h++) {
      const dx = PHYSICAL_HIT_RECOIL_CURVE[recoilV6];
      const dy = isStripRemote ? 0 : MELEE_HIT_RECOIL_Y_CURVE[recoilV6];
      const signedRecoilX = target.isHeroSide ? dx : -dx;
      const signedRecoilY = target.isHeroSide ? dy : -dy;
      const recoilNote =
        dx > 0
          ? ` · 歸位 (${signedRecoilX > 0 ? `+${signedRecoilX}` : signedRecoilX},${signedRecoilY > 0 ? `+${signedRecoilY}` : signedRecoilY})px`
          : '';

      steps.push(
        makeStep({
          delay: 1,
          mode: 'both',
          stageLabel: `[結算] 總傷害 -${inp.hit ? inp.totalDamage : 0} (${hitFrames.length} Hits)${recoilNote}`,
          leftSlideX: !target.isHeroSide ? signedRecoilX : 0,
          leftSlideY: !target.isHeroSide ? signedRecoilY : 0,
          rightSlideX: target.isHeroSide ? signedRecoilX : 0,
          rightSlideY: target.isHeroSide ? signedRecoilY : 0,
        })
      );
      if (recoilV6 > 0) recoilV6--;
    }
  }

  return steps;
}

export interface MagicTargetEntry {
  target: CombatantSpec;
  targetIdle: { img: HTMLImageElement; strip: FigAniStrip } | null;
  spellPack: { img: HTMLImageElement; strip: FigAniStrip; align: 'target_anchor' | 'screen_abs' } | null;
  spellStripId: number;
  isHeal: boolean;
  hit: boolean;
  amount: number; // positive damage or heal amount
}

export interface MagicSequenceTimelineInput {
  caster: CombatantSpec;
  casterIdle: { img: HTMLImageElement; strip: FigAniStrip } | null;
  casterCast: { img: HTMLImageElement; strip: FigAniStrip } | null;
  spell: SpellDef;
  targets: MagicTargetEntry[];
}

interface SpellTickPlan {
  instances: SpellBurstInstance[];
  isHit: boolean;
  delay: number;
}

/**
 * Reconstructs the authentic `FD2.EXE` (`GLOBAL_9145[0..9]` & `Func_98249`) multi-sprite trajectories
 * and exact hit-trigger ticks on the 320x200 battle stage for every cutaway attack spell (`#0..#9` & `#32 熾天使`).
 */
function buildCutawaySpellTicks(
  spellId: number,
  strip: FigAniStrip,
  targetIsHeroSide: boolean,
  targetCenterX: number,
  align: 'target_anchor' | 'screen_abs',
  fallbackStripId: number,
  isFirstTarget = true,
  isLastTarget = true
): SpellTickPlan[] {
  const fCount = strip.frames.length;
  if (fCount === 0) return [{ instances: [], isHit: true, delay: 2 }];

  // #0 火炎術 (GLOBAL_9145[0], L90450): 7 staggered fire pillars rising across the target area
  if (spellId === 0 && fCount >= 16) {
    const xs = [40, 70, 120, 80, 50, 100, 70].map((x) => (targetIsHeroSide ? x + 148 : x));
    const ys = [0, -10, -20, 0, -15, -5, 0];
    const behind = [false, false, true, false, true, false, false];
    const plans: SpellTickPlan[] = [];
    for (let t = 0; t < 28; t++) {
      const instances: SpellBurstInstance[] = [];
      let isHit = false;
      for (let k = 0; k < 7; k++) {
        const localF = t - 2 * k;
        if (localF >= 0 && localF < 16) {
          instances.push({ fIdx: localF, dx: xs[k], dy: ys[k], behindTarget: behind[k] });
          if (localF === 9 && (k === 0 || k === 3 || k === 6)) isHit = true;
        }
      }
      plans.push({ instances, isHit, delay: 1 });
    }
    return plans;
  }

  // #1 烈炎術 (GLOBAL_9145[1], L90863): 8 alternating blue + red inferno pillars in an elliptical ring around the target!
  if (spellId === 1 && fCount >= 30) {
    const baseX = targetIsHeroSide ? 228 : 80;
    const xOff = [-59, -39, 0, 39, 55, 39, 0, -39];
    const yOff = [-10, -24, -30, -24, -10, 4, 10, 4];
    const plans: SpellTickPlan[] = [];
    for (let t = 0; t < 31; t++) {
      const instances: SpellBurstInstance[] = [];
      let isHit = false;
      for (let k = 0; k < 8; k++) {
        const localF = t - 2 * k;
        if (localF >= 0 && localF < 15) {
          // Exact FD2.EXE L91025..91363:
          // - Phase 4 (`behindTarget = true`): k=0..3 draw blue `localF` at pos `k`, and k=4..7 draw red `localF+15` at pos `(k+4)%8` (back arc 0..3)!
          // - Phase 5 (`behindTarget = false`): k=0..3 draw red `localF+15` at pos `(k+4)%8` (front arc 4..7), and k=4..7 draw blue `localF` at pos `k`!
          const isBackStream = k < 4;
          const posBlue = k;
          const posRed = (k + 4) % 8;
          if (isBackStream) {
            instances.push({
              fIdx: localF,
              dx: baseX + xOff[posBlue],
              dy: yOff[posBlue],
              behindTarget: true,
            });
            instances.push({
              fIdx: localF + 15,
              dx: baseX + xOff[posRed],
              dy: yOff[posRed],
              behindTarget: false,
            });
          } else {
            instances.push({
              fIdx: localF + 15,
              dx: baseX + xOff[posRed],
              dy: yOff[posRed],
              behindTarget: true,
            });
            instances.push({
              fIdx: localF,
              dx: baseX + xOff[posBlue],
              dy: yOff[posBlue],
              behindTarget: false,
            });
          }
          if (localF === 10 && (k === 0 || k === 3 || k === 6)) isHit = true;
        }
      }
      plans.push({ instances, isHit, delay: 1 });
    }
    return plans;
  }

  // #2 炎龍術 (GLOBAL_9145[2], fn_91432 + Func_108289): Sweeping Fire Dragon (`FDOTHER[26]` vs Left Enemy, `FDOTHER[27]` vs Right Hero)
  // Exact 3-stage frame playback verified against `FD2.EXE` `fn_91432`:
  //   1) Stage 1 — Dragon Entrance & Coil (`Phase 0/1/2`, 29 ticks total — played ONCE on the first target):
  //      F00..F04 (2 ticks each = 10), F05..F07 (3 ticks each = 9), F08 (7 ticks mid-air hover/coil!), F09 (2 ticks lunge), F15 (1 tick snap-open).
  //      Z-layer: vs Left Enemy (`FDOTHER[26]`) in front (`behindTarget: false`); vs Right Hero (`FDOTHER[27]`) behind (`behindTarget: true`, with F15+F16 on tick 28).
  //   2) Stage 2 — Blazing Flame Breath Climax (`Phase 3/4/5`, 12 ticks at `delay: 1` — played on EACH target):
  //      Alternates `F16` (even ticks) and `F17` (odd ticks) every single tick while keeping roaring head `F15`!
  //      Z-layer: vs Left Enemy, `F15` behind (`true`) + `F16/F17` engulfing in front (`false`); vs Right Hero, BOTH `F15` and `F16/F17` in front (`false`).
  //   3) Stage 3 — Dragon Ascent / Exit (`Phase 6/7/8`, 10 ticks — `F10..F14` at 2 ticks each, closing jaws & soaring off the top edge!).
  if (spellId === 2 && fCount >= 18) {
    const plans: SpellTickPlan[] = [];
    if (isFirstTarget) {
      const introSeq: Array<[number, number]> = [
        [0, 2],
        [1, 2],
        [2, 2],
        [3, 2],
        [4, 2],
        [5, 3],
        [6, 3],
        [7, 3],
        [8, 7],
        [9, 2],
      ];
      for (const [fi, d] of introSeq) {
        plans.push({
          instances: [{ fIdx: fi, dx: 0, dy: 0, behindTarget: targetIsHeroSide }],
          isHit: false,
          delay: d,
        });
      }
      // Tick 28: Dragon snaps jaws open into F15 (vs Right Hero FDOTHER[27], tick 28 draws F15 + F16 behind)
      const snapInsts: SpellBurstInstance[] = [{ fIdx: 15, dx: 0, dy: 0, behindTarget: targetIsHeroSide }];
      if (targetIsHeroSide) {
        snapInsts.push({ fIdx: 16, dx: 0, dy: 0, behindTarget: true });
      }
      plans.push({ instances: snapInsts, isHit: false, delay: 1 });
    }

    // Stage 2: 12 rapid 1-tick flame breath pulses (`F16 <-> F17` over `F15`)
    for (let t = 0; t < 12; t++) {
      const flameIdx = t % 2 === 0 ? 16 : 17;
      plans.push({
        instances: [
          { fIdx: 15, dx: 0, dy: 0, behindTarget: !targetIsHeroSide },
          { fIdx: flameIdx, dx: 0, dy: 0, behindTarget: false },
        ],
        isHit: t === 2 || t === 7,
        delay: 1,
      });
    }

    // Stage 3: Dragon closes jaws and ascends off the top of the screen (`F10..F14`, 2 ticks each = 10 ticks)
    if (isLastTarget) {
      for (let fi = 10; fi <= 14; fi++) {
        plans.push({
          instances: [{ fIdx: fi, dx: 0, dy: 0, behindTarget: targetIsHeroSide }],
          isHit: false,
          delay: 2,
        });
      }
    }
    return plans;
  }

  // #3 天火術 (GLOBAL_9145[3], L92053): 12 staggered diagonal solar meteors & wide heaven-fire beams
  if (spellId === 3 && fCount >= 33) {
    const xs = [30, 0, 70, 40, 130, 70, -30, 30, 110, 80, -10, 30].map((x) =>
      targetIsHeroSide ? x + 20 : x
    );
    const ys = [-22, 0, 0, 0, 0, 0, -11, 0, -22, 0, 0, 0];
    // Clean sub-strip starts (0 = meteor 0..10, 11 = wide solar beam A 11..21, 22 = wide solar beam B 22..32)
    const subBases = [0, 11, 0, 22, 0, 22, 0, 11, 0, 22, 0, 11];
    const plans: SpellTickPlan[] = [];
    for (let t = 0; t < 33; t++) {
      const instances: SpellBurstInstance[] = [];
      let isHit = false;
      for (let k = 0; k < 12; k++) {
        const localF = t - 2 * k;
        if (localF >= 0 && localF < 11) {
          instances.push({ fIdx: subBases[k] + localF, dx: xs[k], dy: ys[k] });
          if (localF === 3 && (k === 1 || k === 3 || k === 7 || k === 9)) isHit = true;
        }
      }
      plans.push({ instances, isHit, delay: 1 });
    }
    return plans;
  }

  // #4 電擊術 (GLOBAL_9145[4], L92627): 6 staggered lightning bolts (`0..6` and `7..13` variants)
  if (spellId === 4 && fCount >= 14) {
    const xs = [30, 50, 70, 40, 80, 100].map((x) => (targetIsHeroSide ? x + 143 : x));
    const bases = [0, 7, 0, 7, 0, 7];
    const plans: SpellTickPlan[] = [];
    for (let t = 0; t < 18; t++) {
      const instances: SpellBurstInstance[] = [];
      let isHit = false;
      for (let k = 0; k < 6; k++) {
        const localF = t - 2 * k;
        if (localF >= 0 && localF < 7) {
          instances.push({ fIdx: bases[k] + localF, dx: xs[k], dy: 0 });
          if (localF === 2 && (k === 0 || k === 2 || k === 4)) isHit = true;
        }
      }
      plans.push({ instances, isHit, delay: 1 });
    }
    return plans;
  }

  // #5 落雷術 (GLOBAL_9145[5], L93181): 6 staggered heavy thunderbolts (`0..5` and `6..11` variants)
  if (spellId === 5 && fCount >= 12) {
    const xs = [30, 50, 70, 40, 80, 100].map((x) => (targetIsHeroSide ? x + 143 : x));
    const bases = [0, 6, 0, 6, 0, 6];
    const plans: SpellTickPlan[] = [];
    for (let t = 0; t < 17; t++) {
      const instances: SpellBurstInstance[] = [];
      let isHit = false;
      for (let k = 0; k < 6; k++) {
        const localF = t - 2 * k;
        if (localF >= 0 && localF < 6) {
          instances.push({ fIdx: bases[k] + localF, dx: xs[k], dy: 0 });
          if (localF === 2 && (k === 0 || k === 2 || k === 4)) isHit = true;
        }
      }
      plans.push({ instances, isHit, delay: 1 });
    }
    return plans;
  }

  // #6 轟雷術 (GLOBAL_9145[6], L93753): 5 orbiting thunder spheres converging into giant plasma detonations (`f5..9`)
  if (spellId === 6 && fCount >= 10) {
    const plans: SpellTickPlan[] = [];
    const orbFr = strip.frames[4];
    const cx = targetIsHeroSide ? 228 : 80;
    const cy = targetIsHeroSide ? 132 : 92;
    // Phase 1: 5 orbiting thunder spheres (`f4`) spiral inward toward the target
    for (let t = 0; t < 12; t++) {
      const radius = Math.max(8, Math.round(52 * (1 - t / 13)));
      const instances: SpellBurstInstance[] = [];
      for (let k = 0; k < 5; k++) {
        const ang = ((k * 72 + t * 24) * Math.PI) / 180;
        const ox = Math.round(cx + Math.cos(ang) * radius - orbFr.w * 0.5) - orbFr.ox;
        const oy = Math.round(cy + Math.sin(ang) * (radius * 0.55) - orbFr.h * 0.5) - orbFr.oy;
        instances.push({ fIdx: 4, dx: ox, dy: oy, behindTarget: Math.sin(ang) < 0 });
      }
      plans.push({ instances, isHit: false, delay: 1 });
    }
    // Phase 2: Staggered plasma detonations (`f5..9`) directly on the target (`screen_abs` coords in FDOTHER[32]/[33])
    const burstOffsets = [
      { dx: 0, dy: 0 },
      { dx: -18, dy: -12 },
      { dx: 18, dy: 8 },
    ];
    for (let t = 0; t < 11; t++) {
      const instances: SpellBurstInstance[] = [];
      let isHit = false;
      for (let b = 0; b < burstOffsets.length; b++) {
        const localF = t - 2 * b;
        if (localF >= 0 && localF < 5) {
          instances.push({
            fIdx: 5 + localF,
            dx: burstOffsets[b].dx,
            dy: burstOffsets[b].dy,
          });
          if (localF === 1) isHit = true;
        }
      }
      plans.push({ instances, isHit, delay: 2 });
    }
    return plans;
  }

  // #7 神雷術 (GLOBAL_9145[7], L94904): 6 massive divine thunder columns cycling across the target zone
  if (spellId === 7 && fCount >= 5) {
    const xs = [30, -10, 70, 20, 100, 60].map((x) => (targetIsHeroSide ? x + 130 : x));
    const plans: SpellTickPlan[] = [];
    for (let t = 0; t < 20; t++) {
      const instances: SpellBurstInstance[] = [];
      let isHit = false;
      for (let k = 0; k < 6; k++) {
        const localF = t - 3 * k;
        if (localF >= 0 && localF < 5) {
          instances.push({ fIdx: localF, dx: xs[k], dy: 0 });
          if (localF === 1 && (k === 0 || k === 2 || k === 4)) isHit = true;
        }
      }
      plans.push({ instances, isHit, delay: 2 });
    }
    return plans;
  }

  // #8 聖光彈 (GLOBAL_9145[8], L95408): Rapid-fire 12-ray holy light barrage (`0..7, 8..15, 16..23, 24..31`, `screen_abs`)
  if (spellId === 8 && fCount >= 32) {
    const groupBases = [0, 8, 24, 16, 8, 0, 24, 16, 0, 8, 24, 16];
    const plans: SpellTickPlan[] = [];
    for (let t = 0; t < 30; t++) {
      const instances: SpellBurstInstance[] = [];
      let isHit = false;
      for (let k = 0; k < 12; k++) {
        const localF = t - 2 * k;
        if (localF >= 0 && localF < 8) {
          instances.push({ fIdx: groupBases[k] + localF, dx: 0, dy: 0 });
          if (localF === 3 && k % 3 === 0) isHit = true;
        }
      }
      plans.push({ instances, isHit, delay: 1 });
    }
    return plans;
  }

  // #9 咒殺術 (GLOBAL_9145[9], L95702): Flashing Grim Reaper Skull (`f0`) -> Death Curse Pillar (`f1..29`)
  // Note: FDOTHER[44] `f1..29` has `ox=164..188` (Right Hero side); shift `-156` when previewed on a Left Enemy!
  if (spellId === 9 && fCount >= 30) {
    const plans: SpellTickPlan[] = [];
    // Phase 1: Grim Reaper Skull (`f0` at `(30, 0, 203x150)`) flashes ominously in the sky (`L95767..95812`)
    for (let f = 0; f < 8; f++) {
      plans.push({
        instances: f % 2 === 0 ? [{ fIdx: 0, dx: 28, dy: 8 }] : [],
        isHit: false,
        delay: 1,
      });
    }
    // Phase 2: Death Curse Pillar (`f1..29`) erupts over the target (`L95857..95976`)
    const pillarDx = targetIsHeroSide ? 0 : -156;
    const pillarDy = targetIsHeroSide ? 0 : -34;
    for (let i = 1; i <= 29 && i < fCount; i++) {
      plans.push({
        instances: [{ fIdx: i, dx: pillarDx, dy: pillarDy }],
        isHit: i === 7 || i === 18,
        delay: 1,
      });
    }
    return plans;
  }

  // #32 熾天使 (Func_98249, L98969..99360): Seraphim Angel descends (`f0..f2`) and flashes heavenly wings (`f3 <-> f4`)
  if (spellId === 32 && fCount >= 5) {
    const seq = [0, 1, 2, 3, 4, 3, 4, 3, 4, 3, 4];
    return seq.map((fi, idx) => ({
      instances: [{ fIdx: fi, dx: 0, dy: 0 }],
      isHit: idx === 3 || idx === 7,
      delay: idx < 3 ? 3 : 2,
    }));
  }

  // Generic fallback for any other single-strip effect
  const hitSet = new Set<number>(getHitFrameIndices(strip, 0, fCount, fallbackStripId));
  const maxExtent = Math.max(...strip.frames.map((f) => f.ox + f.w), 24);
  const anchorDx = align === 'target_anchor' ? Math.round(targetCenterX - maxExtent * 0.5) : 0;
  return strip.frames.map((fr, idx) => ({
    instances: [{ fIdx: idx, dx: anchorDx, dy: 0 }],
    isHit: hitSet.has(idx),
    delay: Math.max(1, Math.min(4, fr.delay || 1)),
  }));
}

/**
 * Builds the authentic Flame Dragon II Multi-Target Magic Sequence:
 *  1. Stage A (Caster Screen): Caster alone on their screen performs their magic spell-casting action.
 *  2. Stage B (Repeated per target on the Target Screen):
 *     - Each target slides horizontally into the screen one by one!
 *     - The FDOTHER spell effect (`GLOBAL_9145[0..9]` / `Func_98249`) plays over that target, triggering hit flashes, recoil & HP drain at exact hit frames.
 *     - If there are multiple targets, the current target slides off-screen before the next target slides in!
 */
export function buildMagicSequenceTimeline(inp: MagicSequenceTimelineInput): TimelineStep[] {
  const steps: TimelineStep[] = [];
  const { caster, casterIdle, casterCast, spell, targets } = inp;
  const castPack = casterCast ?? casterIdle;
  const castFrames = castPack?.strip.frames ?? [];
  const casterMode: StageViewMode = caster.isHeroSide ? 'right_only' : 'left_only';
  const firstTarget = targets[0]?.target ?? null;

  let curCasterMp = caster.startMp;
  const castMpCost = Math.max(0, spell.mpCost ?? 0);
  const castTriggerIdx = castFrames.findIndex((f) => f.sfx && f.sfx !== 0);
  const mpDeductFrameIdx = castTriggerIdx >= 0 ? castTriggerIdx : Math.max(0, Math.floor(castFrames.length * 0.5));
  let mpDeducted = false;

  // 1. Stage A: Caster performs magic chant/cast motion (`FD2.EXE` L108934+L108954 draws both caster & target[0] HUDs; `fn_112217` L112448 deducts MP on `b4 == 1`)
  const castCount = Math.max(1, castFrames.length);
  for (let i = 0; i < castCount; i++) {
    if (!mpDeducted && castMpCost > 0 && i === mpDeductFrameIdx) {
      curCasterMp = Math.max(0, curCasterMp - castMpCost);
      mpDeducted = true;
    }
    const dly = castFrames[i] ? Math.max(1, castFrames[i].delay || 2) : 2;
    const leftU = caster.isHeroSide ? firstTarget : caster;
    const rightU = caster.isHeroSide ? caster : firstTarget;
    steps.push({
      delay: dly,
      mode: casterMode,
      showBothHuds: firstTarget !== null,
      stageLabel: `[1/2 詠唱施法: ${spell.nameZh}] F${i + 1}/${castCount}`,
      leftUnit: leftU,
      rightUnit: rightU,
      leftPack: caster.isHeroSide ? null : castPack,
      leftFrameIdx: caster.isHeroSide ? 0 : i,
      leftHp: leftU ? leftU.startHp : 0,
      leftMp: caster.isHeroSide ? (leftU ? leftU.startMp : 0) : curCasterMp,
      rightPack: caster.isHeroSide ? castPack : null,
      rightFrameIdx: caster.isHeroSide ? i : 0,
      rightHp: rightU ? rightU.startHp : 0,
      rightMp: caster.isHeroSide ? curCasterMp : (rightU ? rightU.startMp : 0),
      sfxTrigger: i === 0 ? 'magic' : undefined,
    });
  }
  if (!mpDeducted && castMpCost > 0) {
    curCasterMp = Math.max(0, curCasterMp - castMpCost);
  }

  // 2. Stage B: Target screen — targets slide in one by one, authentic spell barrage plays per target
  const SLIDE_IN_STEPS = 5;
  const SLIDE_OUT_STEPS = 3;

  for (let tIdx = 0; tIdx < targets.length; tIdx++) {
    const entry = targets[tIdx];
    const { target, targetIdle, spellPack, spellStripId, isHeal } = entry;
    const targetMode: StageViewMode = target.isHeroSide ? 'right_only' : 'left_only';
    const targetTag = targets.length > 1 ? ` (${tIdx + 1}/${targets.length} ${target.nameZh})` : '';
    let curHp = target.startHp;
    const leftU = target.isHeroSide ? caster : target;
    const rightU = target.isHeroSide ? target : caster;
    const getLeftHp = () => (target.isHeroSide ? caster.startHp : curHp);
    const getRightHp = () => (target.isHeroSide ? curHp : caster.startHp);
    const getLeftMp = () => (target.isHeroSide ? curCasterMp : target.startMp);
    const getRightMp = () => (target.isHeroSide ? target.startMp : curCasterMp);

    // 2a. Target slides horizontally onto the screen (both unit and right-side TAI slide in together)
    const maxOffset = target.isHeroSide ? 140 : -140;
    for (let s = 0; s < SLIDE_IN_STEPS; s++) {
      const t = (s + 1) / SLIDE_IN_STEPS;
      const ease = 1 - Math.pow(1 - t, 2);
      const slideX = Math.round(maxOffset * (1 - ease));
      steps.push({
        delay: 1,
        mode: targetMode,
        showBothHuds: leftU !== rightU,
        stageLabel: `[2/2 目標滑入${targetTag}] ${s + 1}/${SLIDE_IN_STEPS}`,
        leftUnit: leftU,
        rightUnit: rightU,
        leftPack: target.isHeroSide ? null : targetIdle,
        leftFrameIdx: 0,
        leftSlideX: target.isHeroSide ? 0 : slideX,
        leftHp: getLeftHp(),
        leftMp: getLeftMp(),
        rightPack: target.isHeroSide ? targetIdle : null,
        rightFrameIdx: 0,
        rightSlideX: target.isHeroSide ? slideX : 0,
        rightTaiSlideX: target.isHeroSide ? slideX : 0,
        rightHp: getRightHp(),
        rightMp: getRightMp(),
      });
    }

    // 2b. Authentic FD2.EXE spell animation plan (`GLOBAL_9145[0..9]` / `Func_98249`) synced to hit ticks & recoil!
    const targetCenterX = getCombatantCenterX(targetIdle, target.isHeroSide);
    const tickPlans: SpellTickPlan[] = spellPack
      ? buildCutawaySpellTicks(
          spell.id,
          spellPack.strip,
          target.isHeroSide,
          targetCenterX,
          spellPack.align,
          spellStripId,
          tIdx === 0,
          tIdx === targets.length - 1
        )
      : [{ instances: [], isHit: true, delay: 2 }];

    let hitStepIndices = tickPlans
      .map((p, idx) => (p.isHit ? idx : -1))
      .filter((idx) => idx >= 0);
    if (hitStepIndices.length === 0) {
      hitStepIndices = [Math.min(tickPlans.length - 1, Math.floor(tickPlans.length * 0.6))];
    }

    const amounts = splitDamageAcrossHits(entry.hit ? entry.amount : 0, hitStepIndices.length);
    const hitMap = new Map<number, { idx: number; amt: number }>();
    hitStepIndices.forEach((pIdx, k) => hitMap.set(pIdx, { idx: k, amt: amounts[k] }));

    let recoilV6 = 0; // Target knockback counter (5->0 for offensive magic hits; TAI stays fixed at 0)

    for (let pIdx = 0; pIdx < tickPlans.length; pIdx++) {
      const plan = tickPlans[pIdx];
      const dly = Math.max(1, plan.delay);
      const hitInfo = hitMap.get(pIdx);
      let frameSfx: TimelineStep['sfxTrigger'] = pIdx === 0 ? (isHeal ? 'heal' : 'magic') : undefined;
      let isHitFrame = false;

      if (hitInfo) {
        if (!entry.hit && !isHeal) {
          frameSfx = 'miss';
        } else if (isHeal) {
          curHp = Math.min(target.maxHp, curHp + hitInfo.amt);
          frameSfx = 'heal';
        } else {
          curHp = Math.max(0, curHp - hitInfo.amt);
          isHitFrame = true;
          if (PHYSICAL_HIT_RECOIL_CURVE[recoilV6] === 0) {
            recoilV6 = 5;
          }
          frameSfx = 'hit';
        }
      }

      const primaryFrameIdx = plan.instances[0]?.fIdx ?? 0;

      for (let tick = 0; tick < dly; tick++) {
        const dx = PHYSICAL_HIT_RECOIL_CURVE[recoilV6];
        const signedRecoilX = target.isHeroSide ? dx : -dx;
        const isFlashTick = isHitFrame && tick === 0;
        const recoilNote = dx > 0 ? ` · 擊退 ${signedRecoilX > 0 ? `+${signedRecoilX}` : signedRecoilX}px` : '';

        steps.push({
          delay: 1,
          mode: targetMode,
          showBothHuds: leftU !== rightU,
          stageLabel: `[2/2 法術轟擊: ${spell.nameZh}${targetTag}] F${pIdx + 1}/${tickPlans.length}${hitInfo && tick === 0 ? ` ★HIT ${hitInfo.idx + 1}/${hitStepIndices.length}` : ''}${recoilNote}`,
          leftUnit: leftU,
          rightUnit: rightU,
          leftPack: target.isHeroSide ? null : targetIdle,
          leftFrameIdx: 0,
          leftSlideX: !target.isHeroSide ? signedRecoilX : 0,
          leftFlash: !target.isHeroSide && isFlashTick,
          leftHp: getLeftHp(),
          leftMp: getLeftMp(),
          rightPack: target.isHeroSide ? targetIdle : null,
          rightFrameIdx: 0,
          rightSlideX: target.isHeroSide ? signedRecoilX : 0,
          rightFlash: target.isHeroSide && isFlashTick,
          rightHp: getRightHp(),
          rightMp: getRightMp(),
          spellFrame: spellPack
            ? {
                img: spellPack.img,
                strip: spellPack.strip,
                fIdx: primaryFrameIdx,
                align: 'screen_abs',
                targetCenterX,
                instances: plan.instances,
              }
            : undefined,
          sfxTrigger: tick === 0 ? frameSfx : undefined,
        });

        if (recoilV6 > 0) recoilV6--;
      }
    }

    // Brief settle on hit target (completing any remaining recoil restoration back to 0)
    const settleText = !entry.hit && !isHeal ? 'MISS' : isHeal ? `+${entry.amount}` : `-${entry.amount}`;
    const settleTicks = Math.max(6, recoilV6 + 4);
    for (let h = 0; h < settleTicks; h++) {
      const dx = PHYSICAL_HIT_RECOIL_CURVE[recoilV6];
      const signedRecoilX = target.isHeroSide ? dx : -dx;
      const recoilNote = dx > 0 ? ` · 歸位 ${signedRecoilX > 0 ? `+${signedRecoilX}` : signedRecoilX}px` : '';
      steps.push({
        delay: 1,
        mode: targetMode,
        showBothHuds: leftU !== rightU,
        stageLabel: `[結算${targetTag}] ${spell.nameZh} ${settleText}${recoilNote}`,
        leftUnit: leftU,
        rightUnit: rightU,
        leftPack: target.isHeroSide ? null : targetIdle,
        leftFrameIdx: 0,
        leftSlideX: !target.isHeroSide ? signedRecoilX : 0,
        leftHp: getLeftHp(),
        leftMp: getLeftMp(),
        rightPack: target.isHeroSide ? targetIdle : null,
        rightFrameIdx: 0,
        rightSlideX: target.isHeroSide ? signedRecoilX : 0,
        rightHp: getRightHp(),
        rightMp: getRightMp(),
      });
      if (recoilV6 > 0) recoilV6--;
    }

    // 2c. If more targets remain in a multi-target AoE spell, slide current target out so next target slides in cleanly!
    if (tIdx < targets.length - 1) {
      const outDir = target.isHeroSide ? 140 : -140;
      for (let s = 0; s < SLIDE_OUT_STEPS; s++) {
        const slideX = Math.round((outDir * (s + 1)) / SLIDE_OUT_STEPS);
        steps.push({
          delay: 1,
          mode: targetMode,
          showBothHuds: leftU !== rightU,
          stageLabel: `[切換下一目標] ${tIdx + 1}/${targets.length}`,
          leftUnit: leftU,
          rightUnit: rightU,
          leftPack: target.isHeroSide ? null : targetIdle,
          leftFrameIdx: 0,
          leftSlideX: target.isHeroSide ? 0 : slideX,
          leftHp: getLeftHp(),
          leftMp: getLeftMp(),
          rightPack: target.isHeroSide ? targetIdle : null,
          rightFrameIdx: 0,
          rightSlideX: target.isHeroSide ? slideX : 0,
          rightTaiSlideX: target.isHeroSide ? slideX : 0,
          rightHp: getRightHp(),
          rightMp: getRightMp(),
        });
      }
    }
  }

  return steps;
}

/**
 * Shared 320x200 DOS Battle Stage Renderer used identically by both `CutscenePlayer` (in-game)
 * and `MappingGalleryApp` (interactive Gallery combat duel).
 *
 * Exact `FD2.EXE` Layering Order (`clean_bg_snapshot` -> `stage_buf`):
 *  1. `BG.DAT` (320x100 at `(0, 50)`)
 *  2. Right-hand `TAI.DAT` (at `(320 - w, 156)`)
 *  3. `FDOTHER[5]` 149x42 Battle HUD Panels (`fn_107145` -> `fn_35949`):
 *     - Top-Right `(171, 4)` for Right Hero / Friend (`faction != 0`)
 *     - Bottom-Left `(0, 154)` for Left Enemy (`faction == 0`)
 *     Layered BEHIND all character sprites, projectiles, and spell animations, with NO portrait avatars and NO floating damage numbers!
 *  4. Background spell layer (`behindTarget`)
 *  5. Left Enemy & Right Hero `FIGANI` unit sprites
 *  6. Arriving remote missile / foreground `FDOTHER` spell animation layer
 */
export function renderTimelineStep(
  ctx: CanvasRenderingContext2D,
  assets: AssetManager,
  bgId: number,
  step: TimelineStep,
  _talkTick = 0
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 320, 200);

  if (step.mode === 'bridge') {
    const speedBgId = (step.bridgeStep ?? 0) % 3;
    assets.drawBattleBg(ctx, speedBgId, 0, 50, 320, 100);
    return;
  }

  // 1. Authentic DOS 320x200 stage backdrop: BG.DAT at (0, 50) + single right-hand TAI.DAT at (320 - w, 156)
  // Both BG.DAT and TAI.DAT remain completely stationary during physical/magic hits (FD2.EXE L105058..105105).
  assets.drawBattleBg(ctx, bgId, 0, 50, 320, 100);

  const showLeft = (step.mode === 'both' || step.mode === 'left_only') && step.leftUnit !== null;
  const showRight = (step.mode === 'both' || step.mode === 'right_only') && step.rightUnit !== null;

  if (showRight && step.rightUnit) {
    const taiId = step.rightUnit.taiId;
    const rightTai = assets.gameData.taiPlatforms[taiId];
    if (rightTai && rightTai.valid) {
      // Note: TAI platform stays fixed at `320 - rightTai.w` during hit recoil (`rightTaiSlideX` is only set for magic slide-in/out)
      assets.drawTaiPlatform(ctx, taiId, 320 - rightTai.w + (step.rightTaiSlideX ?? 0), 156, false);
    }
  }

  // 2. Authentic FD2.EXE Battle HUD Panels (`fn_107145` -> `fn_35949`) drawn into the background layer BEHIND character animations!
  //    - Friend / Right Hero (`faction != 0`): Top-Right `(171, 4)`
  //    - Enemy / Left Unit (`faction == 0`): Bottom-Left `(0, 154)`
  const showLeftHud = (showLeft || Boolean(step.showBothHuds)) && step.leftUnit !== null;
  const showRightHud = (showRight || Boolean(step.showBothHuds)) && step.rightUnit !== null;

  if (showRightHud && step.rightUnit) {
    const u = step.rightUnit;
    assets.drawBattleHudPanel(
      ctx,
      171,
      4,
      u.nameGlyphs,
      u.level,
      step.rightHp,
      u.maxHp,
      step.rightMp,
      u.maxMp,
      u.nameZh
    );
  }

  if (showLeftHud && step.leftUnit) {
    const u = step.leftUnit;
    assets.drawBattleHudPanel(
      ctx,
      0,
      154,
      u.nameGlyphs,
      u.level,
      step.leftHp,
      u.maxHp,
      step.leftMp,
      u.maxMp,
      u.nameZh
    );
  }

  const drawUnit = (
    unit: CombatantSpec,
    pack: { img: HTMLImageElement; strip: FigAniStrip } | null,
    frameIdx: number,
    slideX: number,
    slideY: number,
    flashing: boolean
  ) => {
    ctx.save();
    if (flashing) {
      ctx.filter = 'brightness(2.5) contrast(1.35)';
    }
    if (pack && pack.strip.frames.length > 0) {
      const idx = Math.max(0, Math.min(pack.strip.frames.length - 1, frameIdx));
      const fr = pack.strip.frames[idx];
      ctx.drawImage(pack.img, fr.sx, 0, fr.w, fr.h, fr.ox + slideX, fr.oy + slideY, fr.w, fr.h);
    } else {
      assets.drawUnitSprite(
        ctx,
        unit.spriteGroup,
        unit.isHeroSide ? 1 : 3,
        0,
        (unit.isHeroSide ? 218 : 48) + slideX,
        (unit.isHeroSide ? 142 : 102) + slideY,
        48,
        false
      );
    }
    ctx.restore();
  };

  const drawSpellLayer = (behindPass: boolean) => {
    if (!step.spellFrame) return;
    const { img, strip, fIdx, align, targetCenterX, instances } = step.spellFrame;
    if (instances) {
      for (const inst of instances) {
        if (Boolean(inst.behindTarget) !== behindPass) continue;
        const fr = strip.frames[Math.max(0, Math.min(strip.frames.length - 1, inst.fIdx))];
        if (fr) {
          ctx.drawImage(img, fr.sx, 0, fr.w, fr.h, fr.ox + inst.dx, fr.oy + inst.dy, fr.w, fr.h);
        }
      }
      return;
    }
    if (behindPass) return;
    const fr = strip.frames[Math.max(0, Math.min(strip.frames.length - 1, fIdx))];
    if (fr) {
      let drawX = fr.ox;
      if (align === 'target_anchor') {
        const maxExtent = Math.max(...strip.frames.map((f) => f.ox + f.w), 24);
        const anchorBaseX = Math.round(targetCenterX - maxExtent * 0.5);
        drawX = anchorBaseX + fr.ox;
      }
      ctx.drawImage(img, fr.sx, 0, fr.w, fr.h, drawX, fr.oy, fr.w, fr.h);
    }
  };

  // Phase 4 (FD2.EXE GLOBAL_9145): Background-layer spell pillars/orbs drawn behind the target unit (and on top of HUD)
  drawSpellLayer(true);

  const renderLeft = () => {
    if (showLeft && step.leftUnit) {
      drawUnit(
        step.leftUnit,
        step.leftPack,
        step.leftFrameIdx,
        step.leftSlideX ?? 0,
        step.leftSlideY ?? 0,
        Boolean(step.leftFlash)
      );
    }
  };
  const renderRight = () => {
    if (showRight && step.rightUnit) {
      drawUnit(
        step.rightUnit,
        step.rightPack,
        step.rightFrameIdx,
        step.rightSlideX ?? 0,
        step.rightSlideY ?? 0,
        Boolean(step.rightFlash)
      );
    }
  };

  // Exact FD2.EXE `Func_103325` Z-order (`L104405` / `L105129` `M1[fr+7] & 1`):
  // When `leftInFront` is true, draw Right Hero first and Left Enemy on top (e.g. Dragon Breath `#104/#105/#127`,
  // Mech Laser `#111/#112/#115`, `#126 空魔神` Thunder Pillar, or Hero melee frames behind Left Enemy);
  // otherwise draw Left Enemy first and Right Hero on top.
  if (step.leftInFront) {
    renderRight();
    renderLeft();
  } else {
    renderLeft();
    renderRight();
  }

  // Arriving piercing laser beam impact flash on Target Screen for solo beam turret (`#113 光束砲座`, `fn_100228` + `L20919`)
  if (step.beamImpactFlash) {
    const intense = step.beamImpactFlash === 'intense';
    const targetIsHero = step.mode === 'right_only';
    ctx.save();
    // Diagonal/horizontal piercing energy beam cutting across the target stage
    const grad = ctx.createLinearGradient(0, targetIsHero ? 96 : 68, 320, targetIsHero ? 148 : 118);
    grad.addColorStop(0, intense ? 'rgba(255, 255, 220, 0.92)' : 'rgba(255, 220, 120, 0.45)');
    grad.addColorStop(0.5, intense ? 'rgba(255, 255, 255, 0.98)' : 'rgba(255, 248, 200, 0.65)');
    grad.addColorStop(1, intense ? 'rgba(255, 195, 90, 0.90)' : 'rgba(255, 160, 60, 0.40)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    if (targetIsHero) {
      ctx.moveTo(0, 74);
      ctx.lineTo(320, 126);
      ctx.lineTo(320, 162);
      ctx.lineTo(0, 102);
    } else {
      ctx.moveTo(320, 128);
      ctx.lineTo(0, 72);
      ctx.lineTo(0, 104);
      ctx.lineTo(320, 152);
    }
    ctx.closePath();
    ctx.fill();
    // Core white hot laser line + full-screen VGA white flash (`FD2.EXE` L20919..20955)
    ctx.strokeStyle = intense ? 'rgba(255, 255, 255, 0.98)' : 'rgba(255, 255, 224, 0.65)';
    ctx.lineWidth = intense ? 8 : 4;
    ctx.beginPath();
    if (targetIsHero) {
      ctx.moveTo(0, 88);
      ctx.lineTo(320, 144);
    } else {
      ctx.moveTo(320, 140);
      ctx.lineTo(0, 88);
    }
    ctx.stroke();
    if (intense) {
      ctx.fillStyle = 'rgba(255, 255, 245, 0.36)';
      ctx.fillRect(0, 50, 320, 150);
    }
    ctx.restore();
  }

  // Arriving remote missile / sword-wave overlay (Stage 3 of 3-stage remote attack)
  if (step.missileFrame) {
    const { img, strip, fIdx } = step.missileFrame;
    const fr = strip.frames[Math.max(0, Math.min(strip.frames.length - 1, fIdx))];
    if (fr) {
      ctx.drawImage(img, fr.sx, 0, fr.w, fr.h, fr.ox, fr.oy, fr.w, fr.h);
    }
  }

  // Phase 5 (FD2.EXE GLOBAL_9145): Foreground-layer FDOTHER.DAT spell / summon effect overlay
  drawSpellLayer(false);
}
