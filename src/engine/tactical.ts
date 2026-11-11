import { tr } from '../i18n';
import type {
  BattleUnit,
  ChapterData,
  ChapterUnitDef,
  CombatForecast,
  CombatOutcome,
  CombatStrikeEvent,
  GameData,
  HeroDef,
  ItemDef,
  LevelUpGain,
  PartyMemberSave,
  SpellDef,
} from '../types';

export interface EquippedStats {
  ap: number;
  dp: number;
  hit: number;
  ev: number;
  minRange: number;
  maxRange: number;
  weapon: ItemDef | null;
  armor: ItemDef | null;
  weaponIdx: number;
  armorIdx: number;
  critBonus: number;
  statusEffect: number;
  statusRate: number;
}

export function coordKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function parseCoord(key: string): [number, number] {
  const [xs, ys] = key.split(',');
  return [Number(xs), Number(ys)];
}

export function manhattan(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

function randInclusive(minVal: number, maxVal: number): number {
  const lo = Math.min(minVal, maxVal);
  const hi = Math.max(minVal, maxVal);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

export function getUnitClassLabel(uid: number, classId: number, gd: GameData): string {
  if (uid === 48 || uid === 135) return tr('國王', '国王', 'King');
  const dex = gd.unitDex[uid];
  if (dex?.classNameZh) return dex.classNameZh;
  const hc = gd.heroClasses.find((c) => c.id === classId);
  return hc?.nameZh ?? tr('戰士', '战士', 'Fighter');
}

/**
 * Checks whether `unit` can equip `item` according to `FD2.EXE` `GLOBAL_3_6282` (`classEquipMasks`).
 * Each class `1..28` has a 24-byte bitmask covering equipment item IDs `0..191`.
 */
/**
 * Checks `FD2.EXE` `Obj 3 + 6,282` Class Equipment Type Table (`classEquipMasks`, 29 rows × 7 bytes):
 * - Row `classId` (`1..28`; row `0` is unused) stores up to 6 allowed `item.itemType` codes (`bytes[0..5]`, `255` = empty).
 * - Monsters/bosses (`uid >= 68`) can always equip their own innate monster weapons/hide (`itemType` `13..20`, `28..31`).
 */
export function canUnitEquipItem(unit: BattleUnit | PartyMemberSave, item: ItemDef, gd: GameData): boolean {
  if (item.category !== 'weapon' && item.category !== 'armor') return false;
  // Monster/boss natural weapons & hides (`拳頭/利爪/激水炮/硬皮/龍鱗/虛無護甲`)
  if (unit.uid >= 68 && ((item.itemType >= 13 && item.itemType <= 20) || (item.itemType >= 28 && item.itemType <= 31))) {
    return true;
  }
  const effClassId =
    unit.uid >= 68
      ? gd.unitDex[unit.uid]?.enemyStats?.heroClassEquiv ?? unit.classId
      : unit.classId;
  const row = gd.classEquipMasks?.[effClassId];
  if (!row || row.length < 6) return true;
  const allowedTypes = row.slice(0, 6).filter((t) => t !== 255);
  if (allowedTypes.length === 0) return unit.uid >= 68;
  return allowedTypes.includes(item.itemType);
}

/**
 * Ensures `equippedWeaponIdx` and `equippedArmorIdx` point to valid items in `unit.items`.
 * Exact `FD2.EXE` rule (`fn_3152`, `fn_47165`, `fn_49602`):
 *  - `fn_49602` (`GLOBAL_3_6282` `classEquipMasks`) is ONLY enforced in the player Equip UI (`fn_49149` / `fn_127151`).
 *  - Map-spawned enemies & NPC allies (`fn_3152`, e.g. Ch 1 `#96 盜賊` with `#0 短劍`, `#113 光束砲座` with `#79 光束炮`)
 *    ALWAYS equip their first weapon (`category === 'weapon'`) and first armor (`category === 'armor'`) unconditionally!
 *  - Player units prefer class-matching gear first, falling back to any carried weapon/armor if pre-assigned by a map `urec`.
 */
export function syncUnitEquipmentIndices(unit: BattleUnit, gd: GameData): void {
  const dex = gd.unitDex[unit.uid];
  const unitAllowsWeapon = !dex || (dex.appearsOnBattlefield && dex.canAttack);
  const enforceClassMask = unit.faction === 'player';

  const isClassValidWeapon = (iid: number) => {
    if (!unitAllowsWeapon) return false;
    const it = gd.items[iid];
    return Boolean(it && it.category === 'weapon' && (!enforceClassMask || canUnitEquipItem(unit, it, gd)));
  };
  const isAnyWeapon = (iid: number) => {
    if (!unitAllowsWeapon) return false;
    const it = gd.items[iid];
    return Boolean(it && it.category === 'weapon');
  };
  const isClassValidArmor = (iid: number) => {
    const it = gd.items[iid];
    return Boolean(it && it.category === 'armor' && (!enforceClassMask || canUnitEquipItem(unit, it, gd)));
  };
  const isAnyArmor = (iid: number) => {
    const it = gd.items[iid];
    return Boolean(it && it.category === 'armor');
  };

  if (
    unit.equippedWeaponIdx !== undefined &&
    unit.equippedWeaponIdx >= 0 &&
    unit.equippedWeaponIdx < unit.items.length
  ) {
    if (!isClassValidWeapon(unit.items[unit.equippedWeaponIdx])) {
      const nextW = unit.items.findIndex(isClassValidWeapon);
      unit.equippedWeaponIdx = nextW >= 0 ? nextW : unit.items.findIndex(isAnyWeapon);
    }
  } else {
    const nextW = unit.items.findIndex(isClassValidWeapon);
    unit.equippedWeaponIdx = nextW >= 0 ? nextW : unit.items.findIndex(isAnyWeapon);
  }

  if (
    unit.equippedArmorIdx !== undefined &&
    unit.equippedArmorIdx >= 0 &&
    unit.equippedArmorIdx < unit.items.length
  ) {
    if (!isClassValidArmor(unit.items[unit.equippedArmorIdx])) {
      const nextA = unit.items.findIndex(isClassValidArmor);
      unit.equippedArmorIdx = nextA >= 0 ? nextA : unit.items.findIndex(isAnyArmor);
    }
  } else {
    const nextA = unit.items.findIndex(isClassValidArmor);
    unit.equippedArmorIdx = nextA >= 0 ? nextA : unit.items.findIndex(isAnyArmor);
  }
}

export function getEquippedStats(unit: BattleUnit, gd: GameData): EquippedStats {
  syncUnitEquipmentIndices(unit, gd);
  const wIdx = unit.equippedWeaponIdx ?? -1;
  const aIdx = unit.equippedArmorIdx ?? -1;
  const weapon = wIdx >= 0 ? gd.items[unit.items[wIdx]] ?? null : null;
  const armor = aIdx >= 0 ? gd.items[unit.items[aIdx]] ?? null : null;

  // Exact FD2.EXE `fn_5210` + temporary spell buffs (`fn_75498 魔刃術`, `fn_75823 魔鎧術`, `fn_76128 風行術`):
  // AP = baseAp + weapon.ap (+15% if apBuffTurns > 0, `unit+34` A+)
  // DP = baseDp + armor.dp + weapon.dp (+15% if dpBuffTurns > 0, `unit+35` D+)
  // HIT = baseDx + weapon.hit (+15 if mvBuffTurns > 0, `unit+36` H+)
  // EV = baseDx + armor.ev + weapon.ev (+15 if mvBuffTurns > 0, `unit+36` H+)
  let ap = unit.baseAp + (weapon ? Math.max(0, weapon.ap) : 0);
  let dp = unit.baseDp + (armor ? Math.max(0, armor.dp) : 0) + (weapon ? Math.max(0, weapon.dp) : 0);
  if ((unit.apBuffTurns ?? 0) > 0) ap = Math.floor(ap * 1.15);
  if ((unit.dpBuffTurns ?? 0) > 0) dp = Math.floor(dp * 1.15);

  const windHitEvBonus = (unit.mvBuffTurns ?? 0) > 0 ? 15 : 0;
  const hit = unit.baseDx + (weapon ? Math.max(0, weapon.hit) : 0) + windHitEvBonus;
  const ev =
    unit.baseDx +
    (armor ? Math.max(0, armor.ev) : 0) +
    (weapon ? Math.max(0, weapon.ev) : 0) +
    windHitEvBonus;
  const minRange = weapon ? Math.max(1, weapon.minRange) : 1;
  const maxRange = weapon ? Math.max(minRange, weapon.maxRange) : 1;

  // FD2.EXE `GLOBAL_2_9115` class base crit % + weapon `statusEffect === 4` crit bonus
  const effClassId =
    unit.uid >= 68
      ? gd.unitDex[unit.uid]?.enemyStats?.heroClassEquiv ?? unit.classId
      : unit.classId;
  const hc = gd.heroClasses.find((c) => c.id === effClassId);
  const baseClassCrit = hc?.critRate ?? 3;
  const weaponCrit = weapon && weapon.statusEffect === 4 ? weapon.statusRate : 0;
  const critBonus = Math.min(80, baseClassCrit + weaponCrit);

  return {
    ap,
    dp,
    hit,
    ev,
    minRange,
    maxRange,
    weapon,
    armor,
    weaponIdx: wIdx,
    armorIdx: aIdx,
    critBonus,
    statusEffect: weapon?.statusEffect ?? 0,
    statusRate: weapon?.statusRate ?? 0,
  };
}

/**
 * True iff `unit` is a genuine battlefield combatant with an equipped weapon (`canAttack === true`).
 * Defenseless protected battlefield NPCs (`#133 女村民`, `#134 男村民`, `#135 卡納恩三世`) and non-battlefield
 * NPCs (`#39, #48, #57, #66, #67, #74, #75, #128..#132`) return `false` and NEVER attack or counterattack!
 */
export function canUnitAttack(unit: BattleUnit, gd: GameData): boolean {
  const dex = gd.unitDex[unit.uid];
  if (dex && (!dex.appearsOnBattlefield || !dex.canAttack)) return false;
  return getEquippedStats(unit, gd).weapon !== null;
}

const TERRAIN_AP_MOD_PCT = [5, 0, -5, -5, -5, 0];
const TERRAIN_DP_MOD_PCT = [0, 0, 10, 10, -5, 0];
const TOWN_CASTLE_BG_IDS = new Set([10, 14, 16, 21, 22, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 43, 44, 47, 48, 51, 52, 55]);

function classifyTerrainName(
  chapter: ChapterData,
  x: number,
  y: number,
  bonusIdx: number,
  bgId: number,
  flags: number,
  isVisibleChestTile: boolean
): string {
  if (isVisibleChestTile) return tr('寶箱 (可開啟)', '宝箱 (可开启)', 'Treasure Chest (Openable)');
  if (bonusIdx === 5 || (flags & 1) !== 0) return tr('城牆 / 障壁 (不可通行)', '城墙 / 障壁 (不可通行)', 'Wall / Barrier (Impassable)');

  if (bonusIdx === 1) {
    // In FD2.EXE, vertical buildings/walls and giant trees have a 0x80 overhang row at their top edge (yy)
    // followed by a contiguous column of bonusIdx === 1 tiles below it.
    let yy = y - 1;
    while (yy >= 0 && chapter.cells[yy]?.[x]?.[2] === 1) {
      yy--;
    }
    const topCell = yy >= 0 ? chapter.cells[yy]?.[x] : undefined;
    if (topCell && ((topCell[4] ?? 0) & 0x80) !== 0) {
      const topBg = topCell[3] ?? bgId;
      return TOWN_CASTLE_BG_IDS.has(topBg) || TOWN_CASTLE_BG_IDS.has(bgId)
        ? tr('建築 / 屋舍 (不可通行)', '建筑 / 屋舍 (不可通行)', 'Building / House (Impassable)')
        : tr('巨木 / 岩壁 (不可通行)', '巨木 / 岩壁 (不可通行)', 'Giant Tree / Cliff (Impassable)');
    }
    if (bgId === 48 || chapter.id === 24 || chapter.id === 25) return tr('熔岩 / 深淵 (飛兵可越)', '熔岩 / 深渊 (飞兵可越)', 'Lava / Abyss (Fliers Only)');
    if ([16, 21, 25, 29, 32, 33, 34, 35, 36].includes(bgId) || (chapter.id >= 21 && chapter.id <= 29)) {
      return tr('深淵 / 虛空 (飛兵可越)', '深渊 / 虚空 (飞兵可越)', 'Abyss / Void (Fliers Only)');
    }
    if ([40, 41, 42].includes(bgId) || chapter.id === 15 || chapter.id === 16) return tr('冰河 / 斷崖 (飛兵可越)', '冰河 / 断崖 (飞兵可越)', 'Glacier / Cliff (Fliers Only)');
    if ([0, 4, 5, 7, 14, 17].includes(chapter.id)) return tr('水域 / 河海 (飛兵可越)', '水域 / 河海 (飞兵可越)', 'Water / Sea (Fliers Only)');
    return tr('斷崖 / 深水 (飛兵可越)', '断崖 / 深水 (飞兵可越)', 'Cliff / Deep Water (Fliers Only)');
  }

  if (bonusIdx === 0) {
    if ((flags & 0x08) !== 0) return tr('拱門 / 廊橋 (AP +5%)', '拱门 / 廊桥 (AP +5%)', 'Archway / Bridge (AP +5%)');
    if ((flags & 0x80) !== 0) {
      return TOWN_CASTLE_BG_IDS.has(bgId)
        ? tr('屋簷 / 建築邊緣 (AP +5%)', '屋檐 / 建筑边缘 (AP +5%)', 'Roof Eaves (AP +5%)')
        : tr('樹蔭 / 林冠 (AP +5%)', '树荫 / 林冠 (AP +5%)', 'Tree Canopy (AP +5%)');
    }
    if ([10, 43, 44, 51, 52, 55].includes(bgId)) return tr('城鎮街道 / 石橋 (AP +5%)', '城镇街道 / 石桥 (AP +5%)', 'Town Street / Stone Bridge (AP +5%)');
    if ([14, 16, 21, 22, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 47].includes(bgId)) return tr('殿堂 / 石板地 (AP +5%)', '殿堂 / 石板地 (AP +5%)', 'Hall / Stone Floor (AP +5%)');
    if ([40, 42].includes(bgId)) return tr('冰原道路 (AP +5%)', '冰原道路 (AP +5%)', 'Icefield Path (AP +5%)');
    return tr('平原 / 道路 (AP +5%)', '平原 / 道路 (AP +5%)', 'Plains / Road (AP +5%)');
  }

  if (bonusIdx === 2) {
    return bgId === 41
      ? tr('雪地 / 冰林 (DP +10%, AP -5%)', '雪地 / 冰林 (DP +10%, AP -5%)', 'Snow / Ice Woods (DP +10%, AP -5%)')
      : tr('草地 / 樹林 (DP +10%, AP -5%)', '草地 / 树林 (DP +10%, AP -5%)', 'Grass / Woods (DP +10%, AP -5%)');
  }
  if (bonusIdx === 3) return tr('密林 / 叢林 (DP +10%, AP -5%)', '密林 / 丛林 (DP +10%, AP -5%)', 'Dense Forest (DP +10%, AP -5%)');
  if (bonusIdx === 4) return tr('沼澤 / 泥濘 (AP -5%, DP -5%)', '沼泽 / 泥泞 (AP -5%, DP -5%)', 'Swamp / Mire (AP -5%, DP -5%)');
  return tr('平原 / 道路 (AP +5%)', '平原 / 道路 (AP +5%)', 'Plains / Road (AP +5%)');
}

export function getTerrainInfo(chapter: ChapterData, x: number, y: number): {
  name: string;
  apBonus: number;
  defBonus: number;
  bonusIdx: number;
  moveCostFoot: number;
  moveCostCav: number;
  bgId: number;
  eventId: number;
  isChestTile: boolean;
  isStepEventTile: boolean;
} {
  const cell = chapter.cells[y]?.[x];
  if (!cell) {
    return {
      name: tr('地圖邊界', '地图边界', 'Map Boundary'),
      apBonus: 0,
      defBonus: 0,
      bonusIdx: 5,
      moveCostFoot: 99,
      moveCostCav: 99,
      bgId: 4,
      eventId: 0,
      isChestTile: false,
      isStepEventTile: false,
    };
  }
  const [, eventId, rawBonusIdx, bgId, flags] = cell;
  const bonusIdx = Math.max(0, Math.min(5, rawBonusIdx ?? 1));
  const isBlocked = (flags & 1) !== 0 || bonusIdx === 5;
  // Exact FD2.EXE distinction:
  // - Treasure chests & hidden ground items have `(flags & 2) !== 0` (`tp[0] & 0x60`) AND 0-based `0 <= eventId <= 15`!
  //   Visible chests have `(flags & 0x40) === 0`; hidden ground items (`tp[0] & 0x40`) have `(flags & 0x40) !== 0`.
  // - If `stepEvents` defines `triggerIndex === eventId` AND `(flags & 2) === 0`, it is a step-on coordinate trigger (`1..16`)!
  const hasStepEv = Boolean(chapter.stepEvents?.some((se) => se.triggerIndex === eventId));
  const isChestTile = Boolean((flags & 2) !== 0 && eventId >= 0 && eventId <= 15);
  const isVisibleChestTile = Boolean(isChestTile && (flags & 0x40) === 0);
  const isStepEventTile = Boolean(eventId >= 1 && eventId <= 16 && hasStepEv && !isChestTile);

  const apBonus = TERRAIN_AP_MOD_PCT[bonusIdx] ?? 0;
  const defBonus = TERRAIN_DP_MOD_PCT[bonusIdx] ?? 0;

  if (isBlocked) {
    return {
      name: tr('城牆 / 障壁 (不可通行)', '城墙 / 障壁 (不可通行)', 'Wall / Barrier (Impassable)'),
      apBonus,
      defBonus,
      bonusIdx,
      moveCostFoot: 99,
      moveCostCav: 99,
      bgId: bgId ?? 4,
      eventId,
      isChestTile: false,
      isStepEventTile: false,
    };
  }

  // Exact `FD2.EXE` `GLOBAL_3_5702` (`Obj 3 + 5702`) movement costs by `bonusIdx` (`0..5`):
  // - Standard Foot (`class 1, 2, 4..10, 12..14, 16..18, 20..27`): `[1, 20, 1, 2, 2, 20]`
  // - Cavalry (`class 3 騎士, 11 聖騎士`): `[1, 20, 2, 3, 3, 20]`
  // - Flyer (`class 15 龍劍士, 19 龍騎士`, `fn_61827 != 0`): `[1, 1, 1, 1, 1, 20]`
  const moveCostFoot = bonusIdx === 1 ? 99 : bonusIdx === 3 || bonusIdx === 4 ? 2 : 1;
  const moveCostCav = bonusIdx === 1 ? 99 : bonusIdx === 2 ? 2 : bonusIdx === 3 || bonusIdx === 4 ? 3 : 1;

  return {
    name: classifyTerrainName(chapter, x, y, bonusIdx, bgId ?? 4, flags ?? 0, isVisibleChestTile),
    apBonus,
    defBonus,
    bonusIdx,
    moveCostFoot,
    moveCostCav,
    bgId: bgId ?? 4,
    eventId,
    isChestTile,
    isStepEventTile,
  };
}

export function areHostile(a: BattleUnit['faction'], b: BattleUnit['faction']): boolean {
  if (a === 'enemy') return b !== 'enemy';
  return b === 'enemy';
}

export function isUnitActiveOnMap(u: BattleUnit | null | undefined): u is BattleUnit {
  return Boolean(u && u.hp > 0 && !u.hidden);
}

/**
 * Exact `FD2.EXE` `fn_10153` / `fn_56165` Map Unit Render Visibility:
 * While `u.hp <= 0` and `!u.hidden` (`(unit+5 & 1) == 0`), the unit is STILL drawn on the battlefield
 * until `fn_56165()` plays its 13-step clockwise death spin, sets `u.hidden = true`, and triggers the 12-frame explosion!
 */
export function isUnitRenderedOnMap(u: BattleUnit | null | undefined): u is BattleUnit {
  return Boolean(u && !u.hidden);
}

/**
 * Authentic `FD2.EXE` `fn_3152` Nearest Passable Free Tile search by Manhattan distance
 * when spawning mid-battle wave reinforcements (`forcedExact === false`).
 */
export function findNearestFreePassableTile(
  chapter: ChapterData,
  activeUnits: BattleUnit[],
  sx: number,
  sy: number,
  unitMoveMode: BattleUnit['moveMode'] = 'foot'
): [number, number] {
  const occupied = new Set(activeUnits.filter(isUnitActiveOnMap).map((u) => coordKey(u.x, u.y)));
  const isPassable = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= chapter.width || y >= chapter.height) return false;
    if (occupied.has(coordKey(x, y))) return false;
    const t = getTerrainInfo(chapter, x, y);
    if (unitMoveMode === 'fly') return t.bonusIdx !== 5;
    return t.moveCostFoot < 99 && t.bonusIdx !== 1;
  };

  if (isPassable(sx, sy)) return [sx, sy];

  let bestX = Math.max(0, Math.min(chapter.width - 1, sx));
  let bestY = Math.max(0, Math.min(chapter.height - 1, sy));
  let bestDist = Infinity;

  for (let y = 0; y < chapter.height; y++) {
    for (let x = 0; x < chapter.width; x++) {
      if (!isPassable(x, y)) continue;
      const d = manhattan(sx, sy, x, y);
      if (d < bestDist) {
        bestDist = d;
        bestX = x;
        bestY = y;
      }
    }
  }
  return [bestX, bestY];
}

/** Creates a `BattleUnit` from a `PartyMemberSave` at `slotIndex` & `(sx, sy)`. */
export function createBattleUnitFromPartyMember(
  member: PartyMemberSave,
  slotIndex: number,
  sx: number,
  sy: number,
  gd: GameData,
  dir: 0 | 1 | 2 | 3 = 2
): BattleUnit {
  const dexInfo = gd.unitDex[member.uid];
  const u: BattleUnit = {
    runtimeId: `slot_${slotIndex}_hero_${member.uid}`,
    slotIndex,
    uid: member.uid,
    nameZh: member.nameZh ?? dexInfo?.nameZh ?? `Hero #${member.uid}`,
    nameGlyphs: member.nameGlyphs,
    classNameZh: member.classNameZh ?? getUnitClassLabel(member.uid, member.classId, gd),
    portraitId: member.portraitId,
    spriteGroup: member.spriteGroup,
    faction: 'player',
    classId: member.classId,
    moveMode: member.moveMode ?? 'foot',
    aiMode: 0,
    aiTargetX: sx,
    aiTargetY: sy,
    level: member.level,
    exp: member.exp,
    x: sx,
    y: sy,
    dir,
    hp: member.maxHp,
    maxHp: member.maxHp,
    mp: member.maxMp,
    maxMp: member.maxMp,
    baseAp: member.baseAp,
    baseDp: member.baseDp,
    baseDx: member.baseDx,
    mv: member.mv,
    items: [...member.items].slice(0, 8),
    equippedWeaponIdx: -1,
    equippedArmorIdx: -1,
    spells: [...member.spells],
    acted: false,
    moved: false,
    poisonTurns: 0,
    paralyzeTurns: 0,
    silenceTurns: 0,
    apBuffTurns: 0,
    dpBuffTurns: 0,
    mvBuffTurns: 0,
    isBoss: false,
    drop: null,
  };
  syncUnitEquipmentIndices(u, gd);
  return u;
}

/** Creates a `BattleUnit` from a `ChapterUnitDef` (`urec`) at `slotIndex` & `(ux, uy)`. */
export function createBattleUnitFromChapterDef(
  cu: ChapterUnitDef,
  slotIndex: number,
  ux: number,
  uy: number,
  gd: GameData
): BattleUnit {
  const dexEntry = gd.unitDex[cu.uid];
  const cleanSpells = dexEntry && !dexEntry.canAttack ? [] : [...cu.spells];
  // Exact `FD2.EXE` `fn_3152` (`@4022..4040`):
  // - `cu.aiMode`     = `urec[17]` (`unit[52]`: low 6 bits `0..11` = AI mode, `0x80`/`0x40` = heal/magic flags)
  // - `cu.aiTargetX`  = `urec[18]` (`unit[53]`: target X or escorted character UID)
  // - `cu.aiTargetY`  = `urec[19]` (`unit[54]`: target Y)
  // - `cu.aiChestIdx` = `urec[2]`  (`unit[61]`: target chest index `0..15` for Mode 5 thieves)
  const rawAiMode = cu.uid === 135 ? 8 : (cu.aiMode ?? 0);
  const u: BattleUnit = {
    runtimeId: `slot_${slotIndex}_u_${cu.urecIndex ?? cu.index}`,
    slotIndex,
    uid: cu.uid,
    nameZh: cu.nameZh,
    nameGlyphs: cu.nameGlyphs,
    classNameZh: cu.classNameZh,
    portraitId: cu.portraitId,
    spriteGroup: cu.spriteGroup,
    faction: cu.faction,
    classId: cu.classId,
    moveMode: cu.moveMode,
    aiMode: rawAiMode,
    aiTargetX: cu.aiTargetX ?? 0,
    aiTargetY: cu.aiTargetY ?? 0,
    aiChestIdx: cu.aiChestIdx ?? 0,
    level: cu.level,
    exp: 0,
    x: ux,
    y: uy,
    // Exact `FD2.EXE` `fn_3152` `L3813: M1[slot + 3] = 0`: ALL map-spawned units start facing South (`dir = 0`)!
    // (Critically required for 3-frame NPC rows like `#48 渥特王`, `#66 王后`, and `#75 米蘭`, whose `FDICON` art exists ONLY in `dir = 0`!)
    dir: 0,
    hp: cu.maxHp,
    maxHp: cu.maxHp,
    mp: cu.maxMp,
    maxMp: cu.maxMp,
    baseAp: cu.baseAp,
    baseDp: cu.baseDp,
    baseDx: cu.baseDx,
    mv: cu.mv,
    items: [...cu.items].slice(0, 8),
    equippedWeaponIdx: -1,
    equippedArmorIdx: -1,
    spells: cleanSpells,
    acted: false,
    moved: false,
    poisonTurns: 0,
    paralyzeTurns: 0,
    silenceTurns: 0,
    apBuffTurns: 0,
    dpBuffTurns: 0,
    mvBuffTurns: 0,
    isBoss: cu.isBoss,
    drop: cu.drop ? { ...cu.drop } : null,
  };
  syncUnitEquipmentIndices(u, gd);
  return u;
}

/**
 * Populates initial battlefield `slots[0..95]` exactly matching `FD2.EXE` `fn_2189(chapterId)`:
 *  1. Deploys `party` into `slots[0 .. maxDeploy - 1]` using `chapter.playerSlots[0 .. maxDeploy - 1]`
 *     (including `L2785..2805` Slot 6 reservation rule for `chapterId < 13` when `uid !== 2` `#2 鐵諾`).
 *  2. Spawns ONLY `waveGroup === 0` units from `chapter.units` into `slots[maxDeploy..]`.
 *     (Later waves `1..N` are spawned dynamically by Pre-Battle and Mid-Battle Directing!)
 */
export function initChapterSlots(
  chapter: ChapterData,
  party: PartyMemberSave[],
  gd: GameData
): { slots: (BattleUnit | null)[]; nextSlotIndex: number } {
  const slots: (BattleUnit | null)[] = new Array(96).fill(null);

  if (chapter.isCutsceneMap) {
    // Cutscene maps (Map 30, 31, 32): Map 30 deploys up to 31 party heroes; Map 31 & 32 have maxDeploy = 0
    let slotCursor = 0;
    if (chapter.maxDeploy > 0 && chapter.playerSlots.length > 0) {
      for (let i = 0; i < Math.min(chapter.maxDeploy, party.length, chapter.playerSlots.length); i++) {
        const [sx, sy] = chapter.playerSlots[i];
        slots[slotCursor] = createBattleUnitFromPartyMember(party[i], slotCursor, sx, sy, gd, 2);
        slotCursor++;
      }
    }
    for (const cu of chapter.units) {
      if (cu.waveGroup === 0 && slotCursor < 96) {
        slots[slotCursor] = createBattleUnitFromChapterDef(cu, slotCursor, cu.x, cu.y, gd);
        slotCursor++;
      }
    }
    return { slots, nextSlotIndex: Math.max(slotCursor, chapter.maxDeploy) };
  }

  const maxDep = Math.max(0, chapter.maxDeploy);

  // Exact `FD2.EXE` `L138304..138553` & `fn_139720(heroId)` Mandatory Hero Deployment (`必出人物`):
  // Ensures `#0 索爾` is at `party[0]`, and moves chapter-mandatory heroes to `party[1]` (and `party[2]` in Ch 26)!
  const MANDATORY_HEROES_BY_CHAPTER: Record<number, number[]> = {
    16: [18],     // Ch 17: #18 蜜蒂 (if recruited in Ch 16) -> slot 1
    17: [9],      // Ch 18: #9 悠妮 -> slot 1
    18: [16],     // Ch 19: #16 凱拉斯 -> slot 1
    19: [9],      // Ch 20: #9 悠妮 -> slot 1
    20: [21],     // Ch 21: #21 約拿 -> slot 1
    21: [24],     // Ch 22: #24 希爾法 -> slot 1
    22: [24],     // Ch 23: #24 希爾法 -> slot 1
    25: [29, 9],  // Ch 26: #29 亞齊梅吉 -> slot 1, #9 悠妮 -> slot 2
    26: [9],      // Ch 27: #9 悠妮 -> slot 1
    27: [9],      // Ch 28: #9 悠妮 -> slot 1
    28: [9],      // Ch 29: #9 悠妮 -> slot 1
    29: [9],      // Ch 30: #9 悠妮 -> slot 1
  };
  const getBaseHid = (p: PartyMemberSave) => p.baseHeroId ?? gd.unitDex[p.uid]?.baseHeroId ?? p.uid;
  const solPartyIdx = party.findIndex((p) => getBaseHid(p) === 0);
  if (solPartyIdx > 0) {
    const [solMember] = party.splice(solPartyIdx, 1);
    party.unshift(solMember);
  }
  const mandatoryList = MANDATORY_HEROES_BY_CHAPTER[chapter.id] ?? [];
  let targetSlotIdx = 1;
  for (const mHid of mandatoryList) {
    const foundIdx = party.findIndex((p) => getBaseHid(p) === mHid);
    if (foundIdx >= 0) {
      if (foundIdx !== targetSlotIdx && targetSlotIdx < party.length) {
        const [mMember] = party.splice(foundIdx, 1);
        party.splice(targetSlotIdx, 0, mMember);
      }
      targetSlotIdx++;
    }
  }

  let partyIdx = 0;
  for (let s = 0; s < maxDep; s++) {
    // FD2.EXE `fn_2189` L2785: In Ch 1..13 (`chapter.id < 13`), `slot 6` is reserved unless the hero is `#2 鐵諾`
    if (chapter.id < 13 && s === 6) {
      const ironIdx = party.findIndex((p, idx) => idx >= partyIdx && (p.baseHeroId ?? p.uid) === 2);
      if (ironIdx >= 0) {
        const [iron] = party.splice(ironIdx, 1);
        party.splice(partyIdx, 0, iron);
      } else {
        slots[s] = null; // Leave slot 6 empty placeholder so wave slots align deterministically!
        continue;
      }
    }
    const member = party[partyIdx++];
    if (!member) {
      slots[s] = null;
      continue;
    }
    const fallbackCoord: [number, number] = [Math.floor(chapter.width / 2), Math.max(0, chapter.height - 3)];
    const [sx, sy] = chapter.playerSlots[s] ?? chapter.playerSlots[0] ?? fallbackCoord;
    slots[s] = createBattleUnitFromPartyMember(member, s, sx, sy, gd, 2);
  }

  let nextSlot = maxDep;
  // Spawn strictly `waveGroup === 0` map units at chapter start (`FD2.EXE` `fn_2894(0) -> fn_3152`):
  // Map `urec` units ALWAYS use their exact `ChapterUnitDef` (`cu`) stats (unless already deployed in `slots[0..maxDep-1]`).
  const deployedBaseHids = new Set(
    slots
      .slice(0, maxDep)
      .filter((u): u is BattleUnit => u !== null)
      .map((u) => gd.unitDex[u.uid]?.baseHeroId ?? u.uid)
  );
  for (const cu of chapter.units) {
    if (cu.waveGroup !== 0) continue;
    if (nextSlot >= 96) break;
    if (cu.faction === 'player' && deployedBaseHids.has(gd.unitDex[cu.uid]?.baseHeroId ?? cu.uid)) {
      slots[nextSlot] = null;
      nextSlot++;
      continue;
    }
    slots[nextSlot] = createBattleUnitFromChapterDef(cu, nextSlot, cu.x, cu.y, gd);
    nextSlot++;
  }

  return { slots, nextSlotIndex: nextSlot };
}

/**
 * Spawns all units in `chapter.units` with `waveGroup === targetWave` into `slots[nextSlotIndex..]`.
 * Matches `FD2.EXE` `fn_2894(wave) -> fn_3152` (`forcedExact = true` during scripted cutscenes, `false` for mid-battle waves).
 */
export function spawnChapterWave(
  chapter: ChapterData,
  slots: (BattleUnit | null)[],
  nextSlotIndex: number,
  targetWave: number,
  party: PartyMemberSave[],
  gd: GameData,
  forcedExact = false
): { spawned: BattleUnit[]; nextSlotIndex: number } {
  void party;
  const spawned: BattleUnit[] = [];
  let cursor = nextSlotIndex;
  const deployedBaseHids = new Set(
    slots
      .slice(0, Math.max(0, chapter.maxDeploy))
      .filter((u): u is BattleUnit => u !== null)
      .map((u) => gd.unitDex[u.uid]?.baseHeroId ?? u.uid)
  );

  for (const cu of chapter.units) {
    if (cu.waveGroup !== targetWave) continue;
    if (cursor >= 96) break;
    if (cu.faction === 'player' && deployedBaseHids.has(gd.unitDex[cu.uid]?.baseHeroId ?? cu.uid)) {
      slots[cursor] = null;
      cursor++;
      continue;
    }

    const activeUnits = slots.filter(isUnitActiveOnMap);
    const [ux, uy] = forcedExact
      ? [cu.x, cu.y]
      : findNearestFreePassableTile(chapter, activeUnits, cu.x, cu.y, cu.moveMode);

    const unit = createBattleUnitFromChapterDef(cu, cursor, ux, uy, gd);
    slots[cursor] = unit;
    spawned.push(unit);
    cursor++;
  }

  return { spawned, nextSlotIndex: cursor };
}

/**
 * Canonical map-spawned join base overrides where `FDFIELD.DAT` `player` `urec` (`align_byte == 2` + `fn_5382()`)
 * replaces unused `HERO_BASE` placeholder levels, equipment, and initial spells:
 *  - `#1 哈諾` joins in Ch 1 Turn 3 (`Wave 3` `urec[9]`) at `Lv 1` (`HP 36, AP 7, DP 4`, `[32 手斧, 128 布衣]`).
 *  - `#10 瑪琳` joins in Ch 5 (`urec[34]`) at `Lv 6` with `[53 釘頭鎚, 165 法師袍]` and initial spell `[#13 治療術]` (Heal).
 *  - `#19 羅德曼` joins in Ch 23 (`urec[1]`) at `Lv 20` with `[8 流水劍, 143 雷神服]` and initial technique `[#28 淒煌斬]`.
 *  - `#24 希爾法` joins in Ch 21 (`urec[0]`) at `Lv 8` with `[58 力之杖, 169 霧之袍]` and all 8 High Priest spells `[13, 14, 15, 16, 19, 20, 21, 22]`.
 *  - `#25 謝多` joins in Ch 20 (`urec[36]`) at `Lv 7` with `[17 護手刀, 141 黑暗之衣, 195 神聖之水, 195 神聖之水]` and 4 Ninja spells `[2, 6, 11, 19]`.
 */
const MAP_JOIN_BASE_OVERRIDES: Record<
  number,
  {
    level: number;
    maxHp: number;
    maxMp: number;
    baseAp: number;
    baseDp: number;
    baseDx: number;
    items: number[];
    spells?: number[];
  }
> = {
  1: { level: 1, maxHp: 36, maxMp: 0, baseAp: 7, baseDp: 4, baseDx: 1, items: [32, 128] },
  10: { level: 6, maxHp: 58, maxMp: 32, baseAp: 18, baseDp: 12, baseDx: 6, items: [53, 165], spells: [13] },
  19: { level: 20, maxHp: 500, maxMp: 114, baseAp: 360, baseDp: 250, baseDx: 80, items: [8, 143], spells: [28] },
  24: {
    level: 8,
    maxHp: 253,
    maxMp: 276,
    baseAp: 98,
    baseDp: 92,
    baseDx: 52,
    items: [58, 169],
    spells: [13, 14, 15, 16, 19, 20, 21, 22],
  },
  25: {
    level: 7,
    maxHp: 452,
    maxMp: 44,
    baseAp: 250,
    baseDp: 152,
    baseDx: 71,
    items: [17, 141, 195, 195],
    spells: [2, 6, 11, 19],
  },
};

/** Builds a `PartyMemberSave` from a base `HeroDef` (`0..31`) at `minLevel`. */
export function createPartyMemberFromHeroDef(hero: HeroDef, gd: GameData, minLevel?: number): PartyMemberSave {
  const joinBase = MAP_JOIN_BASE_OVERRIDES[hero.id];
  const baseLv = joinBase?.level ?? hero.level;
  const effLv = Math.max(baseLv, minLevel ?? baseLv);
  const diff = Math.max(0, effLv - baseLv);
  const g = hero.growth;
  const avg = (pair: [number, number] | undefined, fb: number) => (pair ? (pair[0] + pair[1]) * 0.5 : fb);

  const spells = [...(joinBase?.spells ?? hero.spells)];
  if (g?.learnableSpells) {
    for (const ls of g.learnableSpells) {
      // Exact FD2.EXE fn_4773 + fn_58002: a hero starts with their initial spell mask at `baseLv`,
      // and only learns spells from `SPELL_LEARN_BASE` on level-ups strictly after `baseLv` (`ls.level > baseLv`).
      if (ls.level > baseLv && ls.level <= effLv && !spells.includes(ls.spellId)) {
        spells.push(ls.spellId);
      }
    }
  }

  void gd;
  return {
    uid: hero.id,
    baseHeroId: hero.id,
    nameZh: hero.nameZh,
    nameGlyphs: hero.nameGlyphs,
    classNameZh: hero.classNameZh,
    portraitId: hero.portraitId,
    spriteGroup: hero.spriteGroup,
    classId: hero.classId,
    moveMode: hero.moveMode,
    level: effLv,
    exp: 0,
    maxHp: (joinBase?.maxHp ?? hero.maxHp) + Math.round(diff * avg(g?.hp, 6)),
    maxMp: (joinBase?.maxMp ?? hero.maxMp) + Math.round(diff * avg(g?.mp, 0)),
    baseAp: (joinBase?.baseAp ?? hero.baseAp) + Math.round(diff * avg(g?.ap, 3)),
    baseDp: (joinBase?.baseDp ?? hero.baseDp) + Math.round(diff * avg(g?.dp, 2)),
    baseDx: (joinBase?.baseDx ?? hero.baseDx) + Math.round(diff * avg(g?.dx, 5)),
    mv: hero.mv,
    items: [...(joinBase?.items ?? hero.items)].slice(0, 8),
    spells,
  };
}

/**
 * Builds the 100% authentic cumulative canonical party for any chapter `0..30`!
 *  - Chapter 1 (`chapterId === 0`): Strictly `[#0 索爾, #9 悠妮, #4 亞雷斯, #30 蓋亞]` at Lv 1!
 *    (`#1 哈諾` is NOT in the starting party — he joins on Ch 1 Turn 3 via `EV 0`!)
 *  - Chapter 2 (`chapterId === 1`): Adds `#1 哈諾`.
 *  - Subsequent chapters add each hero in the exact chapter they canonically join in `FD2.EXE`!
 */
export function buildPartyForChapter(chapterId: number, gd: GameData): PartyMemberSave[] {
  // Exact canonical FD2.EXE recruitment schedule (`[joinBeforeChapterId, heroId]`):
  // Note: `#19 羅德曼` is mutually exclusive with `#18 蜜蒂` in Ch 23 (`fn_83796`), so the canonical True Route party includes `#18 蜜蒂`.
  const CANONICAL_RECRUIT_SCHEDULE: [number, number][] = [
    [0, 0],  // #0 索爾 (Prologue -> Ch 1)
    [0, 9],  // #9 悠妮 (Prologue -> Ch 1)
    [0, 4],  // #4 亞雷斯 (Prologue -> Ch 1)
    [0, 30], // #30 蓋亞 (Prologue -> Ch 1)
    [1, 1],  // #1 哈諾 (Joins Ch 1 Turn 3 -> present from Ch 2)
    [2, 8],  // #8 希莉亞 (Joins Ch 2 Post -> present from Ch 3)
    [3, 2],  // #2 鐵諾 (Joins Ch 3 Post -> present from Ch 4)
    [5, 10], // #10 瑪琳 (Joins Ch 5 Post -> present from Ch 6)
    [6, 13], // #13 貝克威 (Joins Ch 6 Post -> present from Ch 7)
    [7, 12], // #12 凱麗 (Joins Ch 7 Post -> present from Ch 8)
    [8, 5],  // #5 洛娜 (Joins Ch 8 Post -> present from Ch 9)
    [10, 11],// #11 索菲亞 (Joins Ch 10 Post -> present from Ch 11; carries #209 黃金徽章)
    [10, 6], // #6 萊汀 (Joins Ch 10 Post -> present from Ch 11)
    [11, 14],// #14 珊 (Joins Ch 11 Post -> present from Ch 12)
    [12, 17],// #17 米亞斯多德 (Joins Ch 12 Post -> present from Ch 13)
    [13, 3], // #3 哈瓦特 (Joins Ch 13 Post -> present from Ch 14)
    [15, 15],// #15 塞可邦勒 (Joins Ch 15 Post -> present from Ch 16)
    [16, 18],// #18 蜜蒂 (Joins Ch 16 Post -> present from Ch 17)
    [17, 16],// #16 凱拉斯 (Joins Ch 17 Post -> present from Ch 18)
    [18, 21],// #21 約拿 (Joins Ch 18 Post -> present from Ch 19)
    [18, 7], // #7 蘭斯洛特 (Joins Ch 18 Post -> present from Ch 19)
    [19, 27],// #27 巴拿羅西亞 (Joins Ch 19 EV 46 -> present from Ch 20)
    [20, 25],// #25 謝多 (Joins Ch 20 Post -> present from Ch 21)
    [20, 28],// #28 達克塞 (Joins Ch 20 Post if turn <= 15 -> present from Ch 21)
    [21, 24],// #24 希爾法 (Joins Ch 21 Post -> present from Ch 22)
    [21, 23],// #23 羅蘭 (Joins Ch 21 Post -> present from Ch 22)
    [22, 20],// #20 莎拉 (Joins Ch 22 EV 50 -> present from Ch 23)
    [23, 22],// #22 卡里斯 (Joins Ch 23 Post with Sky Key -> present from Ch 24)
    [25, 26],// #26 聖寇拉斯 (Joins Ch 25 Post -> present from Ch 26)
    [25, 29],// #29 亞齊梅吉 (Joins Ch 25 Post -> present from Ch 26)
    [26, 31],// #31 渥德 (Joins Ch 26 EV 61 with #208 控制中樞 -> present from Ch 27)
  ];

  if (chapterId <= 0) {
    return [0, 9, 4, 30]
      .map((hid) => gd.heroes[hid])
      .filter((h): h is HeroDef => Boolean(h))
      .map((h) => createPartyMemberFromHeroDef(h, gd, h.level));
  }

  const effCh = chapterId === 30 ? 29 : chapterId;
  const targetLv = Math.min(35, Math.max(1, Math.round(effCh * 1.15 + 1)));
  const shopIdx = Math.min(gd.shops.length - 1, Math.max(0, effCh));
  const shopWeapons = gd.shops[shopIdx]?.weaponShop.filter((id) => gd.items[id]?.category === 'weapon') ?? [];
  const shopArmors = gd.shops[shopIdx]?.weaponShop.filter((id) => gd.items[id]?.category === 'armor') ?? [];

  const MAP_RECRUITED_DEFAULT_GEAR: Record<number, number[]> = {
    1: [32, 128],        // #1 哈諾 (Ch 1 urec: 手斧 + 布衣)
    5: [22, 135],        // #5 洛娜 (Ch 8 urec: 長戟 + 魔法皮甲)
    10: [53, 165],       // #10 瑪琳 (Ch 5 urec: 釘頭鎚 + 法師袍)
    13: [45, 135, 193],  // #13 貝克威 (Ch 6 urec: 長弓 + 魔法皮甲 + 回復劑)
    19: [8, 143],        // #19 羅德曼 (Ch 23 urec: 流水劍 + 雷神服)
    20: [27, 151, 195],  // #20 莎拉 (Ch 22 urec: 龍之槍 + 金鋼鎖甲 + 神聖之水)
    22: [69, 177],       // #22 卡里斯 (Ch 23 urec: 裂刃爪 + 武神護甲)
    23: [97, 151],       // #23 羅蘭 (Ch 21 urec: 十字弓 + 金鋼鎖甲)
    24: [58, 169],       // #24 希爾法 (Ch 21 urec: 力之杖 + 霧之袍)
    25: [17, 141, 195],  // #25 謝多 (Ch 20 urec: 護手刀 + 黑暗之衣 + 神聖之水)
    26: [10, 142, 195],  // #26 聖寇拉斯 (Ch 25 urec: 龍神劍 + 惡魔皮甲 + 神聖之水)
    31: [75, 181],       // #31 渥德 (Ch 26 urec: 衝擊手臂 + 特殊裝甲)
  };

  const party: PartyMemberSave[] = [];
  for (const [reqCh, hid] of CANONICAL_RECRUIT_SCHEDULE) {
    if (effCh < reqCh) continue;
    const h = gd.heroes[hid];
    if (!h) continue;
    const member = createPartyMemberFromHeroDef(h, gd, targetLv);
    if (MAP_RECRUITED_DEFAULT_GEAR[hid]) {
      member.items = [...MAP_RECRUITED_DEFAULT_GEAR[hid]];
    }

    // Upgrade gear appropriately for Chapter Replay (`戰場回憶`)
    if (effCh >= 2) {
      const compatWeapon = [...shopWeapons].reverse().find((wid) => {
        const it = gd.items[wid];
        return it && canUnitEquipItem(member, it, gd);
      });
      const compatArmor = [...shopArmors].reverse().find((aid) => {
        const it = gd.items[aid];
        return it && canUnitEquipItem(member, it, gd);
      });
      if (compatWeapon !== undefined) {
        const wPos = member.items.findIndex((iid) => gd.items[iid]?.category === 'weapon');
        if (wPos >= 0) member.items[wPos] = compatWeapon;
        else if (member.items.length < 8) member.items.unshift(compatWeapon);
      }
      if (compatArmor !== undefined) {
        const aPos = member.items.findIndex((iid) => gd.items[iid]?.category === 'armor');
        if (aPos >= 0) member.items[aPos] = compatArmor;
        else if (member.items.length < 8) member.items.push(compatArmor);
      }
      const healHerb = effCh >= 14 ? 194 : 192;
      if (!member.items.includes(healHerb) && member.items.length < 8) {
        member.items.push(healHerb);
      }
    }

    // Grant key story relics for late-game Chapter Replay testing:
    // - Ch 21 (`effCh === 20`): distribute the 6 Sacred Artifacts (`209..214`) across Thor & Uni so Ch 21 Post-Battle forges `#100 天空之鑰`!
    // - Ch 22+ (`effCh >= 21`): give Sol `#100 天空之鑰` (Sky Key), and in Ch 18..26 (`17 <= effCh <= 25`) give `#208 控制中樞` (for Ch 26 EV 61)!
    if (hid === 0) {
      if (effCh === 20) {
        for (const cid of [209, 210, 211]) {
          if (member.items.length < 8 && !member.items.includes(cid)) member.items.push(cid);
        }
      } else if (effCh >= 21) {
        if (!member.items.includes(100) && member.items.length < 8) member.items.push(100);
      }
      if (effCh >= 17 && effCh <= 25 && !member.items.includes(208) && member.items.length < 8) {
        member.items.push(208);
      }
    } else if (hid === 9 && effCh === 20) {
      for (const cid of [212, 213, 214]) {
        if (member.items.length < 8 && !member.items.includes(cid)) member.items.push(cid);
      }
    }

    party.push(member);
  }

  return party;
}

export interface MoveNode {
  x: number;
  y: number;
  cost: number;
  parent: string | null;
  parentNode?: MoveNode | null;
}

export function computeReachableTiles(
  unit: BattleUnit,
  chapter: ChapterData,
  units: BattleUnit[],
  gd: GameData
): Map<string, MoveNode> {
  const occupiedByPos = new Map<string, BattleUnit>();
  // Exact `FD2.EXE` `fn_17869`:
  // - Friendly units (`!areHostile`, i.e. `player <-> player`, `player <-> ally`, `enemy <-> enemy`) NEVER block movement
  //   and exert ZERO Zone of Control — units walk straight through friendly units at normal terrain cost!
  // - Only hostile units (`areHostile`) block their own tile (`0x40`) and mark their 4 orthogonal neighbor tiles (`0x80` ZOC,
  //   which allows stepping onto the adjacent tile and ends remaining movement there).
  const enemyZocSet = new Set<string>();
  const dirs = [
    [0, 1],
    [-1, 0],
    [0, -1],
    [1, 0],
  ];
  for (const u of units) {
    if (isUnitActiveOnMap(u) && u.runtimeId !== unit.runtimeId) {
      occupiedByPos.set(coordKey(u.x, u.y), u);
      if (areHostile(unit.faction, u.faction)) {
        for (const [zx, zy] of dirs) {
          const ex = u.x + zx;
          const ey = u.y + zy;
          if (ex >= 0 && ey >= 0 && ex < chapter.width && ey < chapter.height) {
            enemyZocSet.add(coordKey(ex, ey));
          }
        }
      }
    }
  }

  // Exact `FD2.EXE` `fn_34960 @35046` (`fn_61827`):
  // `GLOBAL_3_5702` (`gd.classMoveCosts`) has 29 rows (`0..28`) indexed 1-based by `classId` (`1..28`),
  // and any Flying unit (`moveMode === 'fly'`) uses row `19` (`飛龍騎士`: `[1, 1, 1, 1, 1, 20, ...]`)!
  const effClassRow = unit.moveMode === 'fly' ? 19 : Math.max(1, Math.min(28, unit.classId));
  const classCosts = gd.classMoveCosts?.[effClassRow];

  const effMv = unit.mv;
  const best = new Map<string, MoveNode>();
  const startKey = coordKey(unit.x, unit.y);
  const startNode: MoveNode = { x: unit.x, y: unit.y, cost: 0, parent: null, parentNode: null };
  best.set(startKey, startNode);

  const queue: MoveNode[] = [startNode];

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const cur = queue.shift()!;
    const curKey = coordKey(cur.x, cur.y);
    if ((best.get(curKey)?.cost ?? 999) < cur.cost) continue;

    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= chapter.width || ny >= chapter.height) continue;

      const occ = occupiedByPos.get(coordKey(nx, ny));
      // Hostile units (`0x40`) block movement; friendly units (`!areHostile`) NEVER block passing through!
      if (occ && areHostile(unit.faction, occ.faction)) continue;

      const tinfo = getTerrainInfo(chapter, nx, ny);
      const tableCost = classCosts ? classCosts[tinfo.bonusIdx] : undefined;
      const stepCost =
        tinfo.bonusIdx === 5
          ? 99
          : unit.moveMode === 'fly'
            ? 1
            : tableCost !== undefined && tableCost > 0
              ? tableCost >= 20
                ? 99
                : tableCost
              : tinfo.bonusIdx === 1
                ? 99
                : unit.moveMode === 'cavalry'
                  ? tinfo.moveCostCav
                  : tinfo.moveCostFoot;
      if (stepCost >= 99) continue;

      const rawNextCost = cur.cost + stepCost;
      if (rawNextCost > effMv) continue;

      const nKey = coordKey(nx, ny);
      // Exact `FD2.EXE` `fn_254016` + `fn_17869(side_flag)`:
      // - Stepping onto an enemy-adjacent ZOC tile (`0x80`) consumes remaining MV (`cost = effMv`),
      //   whereas starting the turn already adjacent to an enemy (`startNode` at `cost = 0`) allows moving away freely!
      // - `fn_55307` (Ally Phase) passes `side_flag = 1` and `fn_55482` (Enemy Phase) passes `side_flag = 0`,
      //   so friendly units (`Player` + `Ally`) NEVER exert ZOC on one another — only hostile ground units (`enemyZocSet`) exert ZOC!
      const nextCost = nKey !== startKey && enemyZocSet.has(nKey) ? effMv : rawNextCost;
      const prev = best.get(nKey);
      if (!prev || nextCost < prev.cost) {
        const node: MoveNode = { x: nx, y: ny, cost: nextCost, parent: curKey, parentNode: cur };
        best.set(nKey, node);
        queue.push(node);
      }
    }
  }

  // Exact `FD2.EXE` `fn_18129` (`@35160`, AFTER `fn_254016` finishes):
  // Remove friendly-occupied tiles from final stoppable destinations (`best`), while `node.parentNode` preserves
  // the complete step-by-step walk path right through every friendly unit!
  for (const key of Array.from(best.keys())) {
    if (key !== startKey && occupiedByPos.has(key)) {
      best.delete(key);
    }
  }
  return best;
}

export function reconstructPath(moveMap: Map<string, MoveNode>, targetX: number, targetY: number): [number, number][] {
  const path: [number, number][] = [];
  let node: MoveNode | null | undefined = moveMap.get(coordKey(targetX, targetY));
  while (node) {
    path.push([node.x, node.y]);
    node = node.parentNode !== undefined ? node.parentNode : node.parent ? moveMap.get(node.parent) : null;
  }
  return path.reverse();
}

export function getAttackableCoordinates(
  originX: number,
  originY: number,
  minRange: number,
  maxRange: number,
  chapter: ChapterData,
  isLinearRay = false
): [number, number][] {
  if (isLinearRay) {
    const res: [number, number][] = [];
    const dirs = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ];
    for (const [dx, dy] of dirs) {
      for (let d = minRange; d <= maxRange; d++) {
        const nx = originX + dx * d;
        const ny = originY + dy * d;
        if (nx >= 0 && ny >= 0 && nx < chapter.width && ny < chapter.height) {
          res.push([nx, ny]);
        }
      }
    }
    return res;
  }
  const res: [number, number][] = [];
  for (let y = Math.max(0, originY - maxRange); y <= Math.min(chapter.height - 1, originY + maxRange); y++) {
    for (let x = Math.max(0, originX - maxRange); x <= Math.min(chapter.width - 1, originX + maxRange); x++) {
      const d = manhattan(originX, originY, x, y);
      if (d >= minRange && d <= maxRange) {
        res.push([x, y]);
      }
    }
  }
  return res;
}

export function getSpellCastCoordinates(
  originX: number,
  originY: number,
  spell: SpellDef,
  chapter: ChapterData
): [number, number][] {
  if (spell.isLinear) {
    const coords: [number, number][] = [];
    const dirs = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ];
    for (const [dx, dy] of dirs) {
      for (let s = 1; s <= spell.castRange; s++) {
        const nx = originX + dx * s;
        const ny = originY + dy * s;
        if (nx >= 0 && ny >= 0 && nx < chapter.width && ny < chapter.height) {
          coords.push([nx, ny]);
        }
      }
    }
    return coords;
  }
  const minR = spell.targetType === 'ally' || spell.castRange === 0 ? 0 : 1;
  return getAttackableCoordinates(originX, originY, minR, Math.max(minR, spell.castRange), chapter);
}

export function getSpellBlastTiles(
  casterX: number,
  casterY: number,
  targetX: number,
  targetY: number,
  spell: SpellDef,
  chapter: ChapterData
): [number, number][] {
  if (spell.isLinear) {
    const dx = Math.sign(targetX - casterX);
    const dy = Math.sign(targetY - casterY);
    const res: [number, number][] = [];
    for (let s = 1; s <= spell.castRange; s++) {
      const nx = casterX + dx * s;
      const ny = casterY + dy * s;
      if (nx >= 0 && ny >= 0 && nx < chapter.width && ny < chapter.height) {
        res.push([nx, ny]);
      }
    }
    return res;
  }
  return getAttackableCoordinates(targetX, targetY, 0, spell.aoe, chapter);
}

export function predictCombat(
  attacker: BattleUnit,
  defender: BattleUnit,
  chapter: ChapterData,
  gd: GameData
): CombatForecast {
  const aStats = getEquippedStats(attacker, gd);
  const dStats = getEquippedStats(defender, gd);
  const aTerrain = getTerrainInfo(chapter, attacker.x, attacker.y);
  const dTerrain = getTerrainInfo(chapter, defender.x, defender.y);

  // FD2.EXE `fn_48690`: Terrain modifies Attacker AP by `apBonus%` and Defender DP by `defBonus%`
  const effAtkAp = Math.floor((aStats.ap * (100 + aTerrain.apBonus)) / 100);
  const effDefDp = Math.floor((dStats.dp * (100 + dTerrain.defBonus)) / 100);
  const attackerDmg = Math.max(1, effAtkAp - effDefDp);
  const attackerHitPct = defender.paralyzeTurns > 0 ? 100 : Math.max(15, Math.min(100, aStats.hit - dStats.ev));
  const attackerCritPct = Math.max(0, Math.min(80, aStats.critBonus));

  // FD2.EXE `fn_61660`: Counterattack ONLY triggers when adjacent (`dist === 1`), defender is not paralyzed,
  // defender `canUnitAttack`, and defender's equipped weapon has `minRange === 1`!
  const dist = manhattan(attacker.x, attacker.y, defender.x, defender.y);
  const canCounter =
    canUnitAttack(defender, gd) &&
    defender.paralyzeTurns === 0 &&
    dist === 1 &&
    dStats.minRange === 1;

  const effCounterAp = Math.floor((dStats.ap * (100 + dTerrain.apBonus)) / 100);
  const effAtkDp = Math.floor((aStats.dp * (100 + aTerrain.defBonus)) / 100);
  const defenderDmg = canCounter ? Math.max(1, effCounterAp - effAtkDp) : 0;
  const defenderHitPct = canCounter ? Math.max(15, Math.min(100, dStats.hit - aStats.ev)) : 0;

  return {
    attackerHitPct,
    attackerDmg,
    attackerCritPct,
    canCounter,
    defenderHitPct,
    defenderDmg,
  };
}

/**
 * Exact `FD2.EXE` (`L61394..L61412`, `fn_51231`, `fn_51478`) Effective Unit Level for EXP Scaling:
 * Promoted classes (`9 <= classId <= 24`) and `#28 達克塞` (`identity_uid === 28`) add `+30` to `unit.level`!
 */
export function getUnitEffectiveExpLevel(unit: BattleUnit, gd: GameData): number {
  const baseId = unit.baseHeroId ?? gd.unitDex[unit.uid]?.baseHeroId ?? unit.uid;
  const isPromotedOrDaksai = (unit.classId >= 9 && unit.classId <= 24) || baseId === 28;
  return Math.max(1, unit.level + (isPromotedOrDaksai ? 30 : 0));
}

/**
 * Exact `FD2.EXE` (`fn_60615` `L61394..L61505` & `fn_51231`) Combat / Offensive Spell EXP Formula:
 *  - `fullKillExp = floor((enemyExpBase * enemy.level) / actorEffLv)`
 *  - On Kill (`targetKilled === true`): `max(1, fullKillExp)`
 *  - On Non-Lethal Hit (`damageDealt > 0`): `floor((fullKillExp * damageDealt) / enemy.maxHp)`
 *  - On Miss (`damageDealt <= 0` and `!targetKilled`): `0`
 * Example (Chapter 1): Lv.1 `#0 索爾` dealing `20` damage to Lv.2 `#96 盜賊` (`expBase=21, maxHp=28`):
 *  `fullKillExp = (21 * 2) // 1 = 42` -> `(42 * 20) // 28 = 30 EXP` (or `42 EXP` on kill!).
 */
export function computeEnemyCombatExp(
  actor: BattleUnit,
  enemyTarget: BattleUnit,
  damageDealt: number,
  targetKilled: boolean,
  gd: GameData
): number {
  if (!targetKilled && damageDealt <= 0) return 0;
  const actorEffLv = getUnitEffectiveExpLevel(actor, gd);
  const expBase =
    enemyTarget.uid >= 68
      ? gd.unitDex[enemyTarget.uid]?.enemyStats?.expBase ?? 30
      : 35;
  const fullKillExp = Math.floor((expBase * Math.max(1, enemyTarget.level)) / actorEffLv);
  if (targetKilled) {
    return Math.max(1, fullKillExp);
  }
  const clampedDmg = Math.min(enemyTarget.maxHp, Math.max(0, damageDealt));
  return Math.max(1, Math.floor((fullKillExp * clampedDmg) / Math.max(1, enemyTarget.maxHp)));
}

/** Uses the clean unhacked [min..max] FD2.EXE growth table & spell-learning table for level-ups (`fn_58002`)! */
export function applyExpAndCheckLevelUp(unit: BattleUnit, expGain: number, gd: GameData): LevelUpGain | null {
  const lvCap = unit.uid === 30 || unit.uid === 31 ? 99 : 40;
  if (unit.faction !== 'player' || unit.hp <= 0 || unit.level >= lvCap) return null;
  // Exact FD2.EXE L6489: single-action EXP gain is capped at 99!
  const clampedGain = Math.min(99, Math.max(0, expGain));
  unit.exp += clampedGain;
  if (unit.exp < 100) return null;

  unit.exp -= 100;
  unit.level += 1;
  if (unit.level >= lvCap) {
    unit.exp = 0; // Exact FD2.EXE L58380: EXP locked at 0 upon reaching level cap!
  }

  const dexEntry = gd.unitDex[unit.uid];
  const g = dexEntry?.growth;
  const hpGain = g ? randInclusive(g.hp[0], g.hp[1]) : randInclusive(5, 8);
  const mpGain = g ? randInclusive(g.mp[0], g.mp[1]) : unit.maxMp > 0 ? randInclusive(3, 6) : 0;
  const apGain = g ? randInclusive(g.ap[0], g.ap[1]) : randInclusive(2, 5);
  const dpGain = g ? randInclusive(g.dp[0], g.dp[1]) : randInclusive(1, 3);
  const dxGain = g ? randInclusive(g.dx[0], g.dx[1]) : randInclusive(4, 8);

  unit.maxHp += hpGain;
  unit.hp = Math.min(unit.maxHp, unit.hp + hpGain);
  unit.maxMp += mpGain;
  unit.mp = Math.min(unit.maxMp, unit.mp + mpGain);
  unit.baseAp += apGain;
  unit.baseDp += dpGain;
  unit.baseDx += dxGain;

  const learnedSpellIds: number[] = [];
  if (g?.learnableSpells) {
    for (const ls of g.learnableSpells) {
      // Exact FD2.EXE fn_58002 L58546 (`if (a2[4] == *v0)`): learns spell only when new level matches `ls.level`.
      if (ls.level === unit.level && !unit.spells.includes(ls.spellId)) {
        unit.spells.push(ls.spellId);
        learnedSpellIds.push(ls.spellId);
      }
    }
  }

  return {
    newLevel: unit.level,
    hp: hpGain,
    mp: mpGain,
    ap: apGain,
    dp: dpGain,
    dx: dxGain,
    learnedSpellIds,
  };
}

export function resolveCombat(
  attacker: BattleUnit,
  defender: BattleUnit,
  chapter: ChapterData,
  gd: GameData
): CombatOutcome & { droppedEventId?: number } {
  const forecast = predictCombat(attacker, defender, chapter, gd);
  const aStats = getEquippedStats(attacker, gd);
  const aTerrain = getTerrainInfo(chapter, attacker.x, attacker.y);
  const dTerrain = getTerrainInfo(chapter, defender.x, defender.y);
  const dist = manhattan(attacker.x, attacker.y, defender.x, defender.y);
  const strikes: CombatStrikeEvent[] = [];

  const dx = defender.x - attacker.x;
  const dy = defender.y - attacker.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    attacker.dir = dx >= 0 ? 3 : 1;
    defender.dir = dx >= 0 ? 1 : 3;
  } else {
    attacker.dir = dy >= 0 ? 0 : 2;
    defender.dir = dy >= 0 ? 2 : 0;
  }

  const dStats = getEquippedStats(defender, gd);
  const effAtkAp = Math.floor((aStats.ap * (100 + aTerrain.apBonus)) / 100);
  const effDefDp = Math.floor((dStats.dp * (100 + dTerrain.defBonus)) / 100);
  const effCounterAp = Math.floor((dStats.ap * (100 + dTerrain.apBonus)) / 100);
  const effAtkDp = Math.floor((aStats.dp * (100 + aTerrain.defBonus)) / 100);

  // FD2.EXE `fn_48690`: Critical hit halves defender's effective DP (`effDp / 2`); damage rolls `90%..100%` of `(effAp - effDp)`!
  const doStrike = (
    fromAtk: boolean,
    hitPct: number,
    strikeEffAp: number,
    targetEffDp: number,
    critPct: number,
    strikeStats: EquippedStats,
    target: BattleUnit
  ) => {
    const hit = target.paralyzeTurns > 0 ? true : Math.random() * 100 < hitPct;
    if (!hit) {
      strikes.push({ fromAttacker: fromAtk, hit: false, crit: false, damage: 0, targetHpAfter: target.hp });
      return;
    }
    const crit = Math.random() * 100 < critPct;
    const usedDp = crit ? Math.floor(targetEffDp / 2) : targetEffDp;
    const rawDiff = Math.max(1, strikeEffAp - usedDp);
    const rollPct = 90 + Math.floor(Math.random() * 11); // 90..100%
    const dmg = Math.max(1, Math.floor((rawDiff * rollPct) / 100));
    target.hp = Math.max(0, target.hp - dmg);

    let statusInflicted: 'poison' | 'paralyze' | undefined;
    if (target.hp > 0 && strikeStats.statusRate > 0 && Math.random() * 100 < strikeStats.statusRate) {
      if (strikeStats.statusEffect === 1) {
        target.poisonTurns = 3;
        statusInflicted = 'poison';
      } else if (strikeStats.statusEffect === 2) {
        target.paralyzeTurns = randInclusive(2, 5);
        statusInflicted = 'paralyze';
      }
    }

    strikes.push({
      fromAttacker: fromAtk,
      hit: true,
      crit,
      damage: dmg,
      targetHpAfter: target.hp,
      statusInflicted,
    });
  };

  const attackerStartHp = attacker.hp;
  const defenderStartHp = defender.hp;

  doStrike(true, forecast.attackerHitPct, effAtkAp, effDefDp, forecast.attackerCritPct, aStats, defender);

  // Exact `FD2.EXE` Multi-Attack (`連擊`) Rule (`fn_103325 @103530` + `fn_106354 @106811`, `fn_59478 @59582`):
  // 1. Flat `3%` innate extra-swing roll (`rand(1, 100) <= 3` — independent of `classId`, `HIT`, `EV`, `DX`, or `LV`)!
  // 2. Weapon `statusEffect === 3` (`#71 魔龍爪`, `statusRate = 0`) sets `Obj2+533628 = 1` for a 100% guaranteed extra swing!
  // 3. In Cutaway Combat (`fn_103325`), BOTH mechanisms are independent and stack — so `#71 魔龍爪` attacks 2 times (97%)
  //    or **3 times (3%)** when the `3%` roll ALSO triggers!
  if (defender.hp > 0 && Math.random() * 100 < 3) {
    doStrike(true, forecast.attackerHitPct, effAtkAp, effDefDp, forecast.attackerCritPct, aStats, defender);
  }
  if (defender.hp > 0 && aStats.statusEffect === 3) {
    doStrike(true, forecast.attackerHitPct, effAtkAp, effDefDp, forecast.attackerCritPct, aStats, defender);
  }

  if (defender.hp > 0 && forecast.canCounter) {
    doStrike(false, forecast.defenderHitPct, effCounterAp, effAtkDp, dStats.critBonus, dStats, attacker);
    // Note: in `FD2.EXE` Cutaway Combat (`fn_100972 @102112` calling `fn_103325`), a retaliating defender also passes
    // through `fn_103325 @103530` (`3%` innate roll) and `fn_106354 @106811` (`statusEffect === 3`).
    if (attacker.hp > 0 && Math.random() * 100 < 3) {
      doStrike(false, forecast.defenderHitPct, effCounterAp, effAtkDp, dStats.critBonus, dStats, attacker);
    }
    if (attacker.hp > 0 && dStats.statusEffect === 3) {
      doStrike(false, forecast.defenderHitPct, effCounterAp, effAtkDp, dStats.critBonus, dStats, attacker);
    }
  }

  let expGained = 0;
  let droppedReward: { type: 'item' | 'gold'; value: number } | null = null;
  let droppedEventId: number | undefined;
  let droppedDialogueId: number | undefined;
  let levelUp: LevelUpGain | null = null;
  let skipFinalBlowExp = false;

  if (defender.hp <= 0 && defender.drop) {
    if (defender.drop.type === 'event') {
      droppedEventId = defender.drop.value;
      // Exact `FD2.EXE` `fn_63906` / `fn_150138`: in Ch 9 (`EV 30`), `#118 萊汀` survives at 1 HP to defect as Ally `#6 萊汀`
      // and the final blow grants 0 EXP!
      if (droppedEventId === 30) {
        defender.hp = 1;
        defender.drop = null;
        skipFinalBlowExp = true;
      }
    } else if (defender.drop.type === 'dialogue') {
      droppedDialogueId = defender.drop.value;
    } else if (attacker.faction === 'player') {
      droppedReward = { type: defender.drop.type, value: defender.drop.value };
    }
  }
  if (attacker.hp <= 0 && attacker.drop) {
    if (attacker.drop.type === 'event') {
      droppedEventId = attacker.drop.value;
      if (droppedEventId === 30) {
        attacker.hp = 1;
        attacker.drop = null;
        skipFinalBlowExp = true;
      }
    } else if (attacker.drop.type === 'dialogue') {
      droppedDialogueId = attacker.drop.value;
    }
  }

  // Cumulative Effective-Damage & Kill EXP (fixing original 1995 `FD2.EXE`'s `GLOBAL_2_16072 = exp` 2nd-hit overwrite bug!):
  // Calculates EXP from the total effective HP removed across ALL hits (`defenderStartHp - defender.hp`),
  // or awards full kill EXP (`fullKillExp`) when `defender.hp <= 0`!
  if (!skipFinalBlowExp && attacker.faction === 'player' && attacker.hp > 0) {
    const effectiveAtkDmg = Math.max(0, defenderStartHp - defender.hp);
    const anyAtkHit = strikes.some((s) => s.fromAttacker && s.hit);
    if (anyAtkHit || defender.hp <= 0) {
      const rawExp = computeEnemyCombatExp(attacker, defender, effectiveAtkDmg, defender.hp <= 0, gd);
      expGained = Math.min(99, rawExp);
      if (expGained > 0) {
        levelUp = applyExpAndCheckLevelUp(attacker, expGained, gd);
      }
    }
  } else if (!skipFinalBlowExp && defender.faction === 'player' && defender.hp > 0) {
    const effectiveDefDmg = Math.max(0, attackerStartHp - attacker.hp);
    const anyDefHit = strikes.some((s) => !s.fromAttacker && s.hit);
    if (anyDefHit || attacker.hp <= 0) {
      const rawExp = computeEnemyCombatExp(defender, attacker, effectiveDefDmg, attacker.hp <= 0, gd);
      expGained = Math.min(99, rawExp);
      if (expGained > 0) {
        levelUp = applyExpAndCheckLevelUp(defender, expGained, gd);
      }
    }
  }

  return {
    attacker,
    defender,
    attackerStartHp,
    defenderStartHp,
    bgId: dTerrain.bgId,
    atkTaiId: aTerrain.bgId,
    defTaiId: dTerrain.bgId,
    isRangedAtk: dist > 1,
    strikes,
    expGained,
    levelUp,
    droppedReward,
    droppedEventId,
    droppedDialogueId,
  };
}

export const SWORD_TECH_AP_MULTIPLIERS: Record<number, number> = {
  24: 1.5, // #24 破龍擊 (Sol #32/#50: 1.5x AP)
  28: 2.0, // #28 淒煌斬 (Rodman #19: 2.0x AP)
  29: 1.2, // #29 熾炎刀 (Tieno #34: 1.2x AP)
  30: 1.8, // #30 音速刃 (Midi #18: 1.8x AP)
};

export function resolveSpellCast(
  caster: BattleUnit,
  spell: SpellDef,
  targetX: number,
  targetY: number,
  chapter: ChapterData,
  units: BattleUnit[],
  gd: GameData,
  options?: { fromItem?: boolean }
): {
  affected: { unit: BattleUnit; amount: number; isHeal: boolean; killed: boolean; hit: boolean }[];
  expGained: number;
  levelUp: LevelUpGain | null;
  drops: { type: 'item' | 'gold'; value: number }[];
  eventDrops: number[];
  dialogueDrops: number[];
} {
  const fromItem = Boolean(options?.fromItem);
  if (!fromItem) {
    caster.mp = Math.max(0, caster.mp - spell.mpCost);
  }
  const blast = new Set(getSpellBlastTiles(caster.x, caster.y, targetX, targetY, spell, chapter).map(([x, y]) => coordKey(x, y)));
  const isSupport = spell.targetType === 'ally';
  const isEarthquakeSpell = spell.id >= 10 && spell.id <= 12; // `10 碎岩術`, `11 地震術`, `12 裂地術`
  const affected: { unit: BattleUnit; amount: number; isHeal: boolean; killed: boolean; hit: boolean }[] = [];
  const drops: { type: 'item' | 'gold'; value: number }[] = [];
  const eventDrops: number[] = [];
  const dialogueDrops: number[] = [];

  const casterEffLv = getUnitEffectiveExpLevel(caster, gd);
  let rawSpellExpTotal = 0;

  for (const u of units) {
    if (!isUnitActiveOnMap(u) || !blast.has(coordKey(u.x, u.y))) continue;
    const validTarget = isSupport ? !areHostile(caster.faction, u.faction) : areHostile(caster.faction, u.faction);
    if (!validTarget) continue;

    if (isSupport) {
      const targetEffLv = getUnitEffectiveExpLevel(u, gd);
      // Support / Heal / Status Cure / Turn Reset / Summon Buff spells (`13..21, 25, 33, 34`):
      if (spell.id === 17) {
        u.apBuffTurns = randInclusive(2, 4); // #17 魔刃術 (`fn_75498`: AP +15% for 2..4 turns, EXP = int(2 * targetLv / casterLv))
        affected.push({ unit: u, amount: 0, isHeal: true, killed: false, hit: true });
        rawSpellExpTotal += Math.max(1, Math.floor((2 * targetEffLv) / casterEffLv));
      } else if (spell.id === 18) {
        u.dpBuffTurns = randInclusive(2, 4); // #18 魔鎧術 (`fn_75823`: DP +15% for 2..4 turns, EXP = int(2 * targetLv / casterLv))
        affected.push({ unit: u, amount: 0, isHeal: true, killed: false, hit: true });
        rawSpellExpTotal += Math.max(1, Math.floor((2 * targetEffLv) / casterEffLv));
      } else if (spell.id === 19) {
        u.mvBuffTurns = randInclusive(2, 4); // #19 風行術 (`fn_76128`: HIT +15 & EV +15 for 2..4 turns, EXP = int(2 * targetLv / casterLv))
        affected.push({ unit: u, amount: 0, isHeal: true, killed: false, hit: true });
        rawSpellExpTotal += Math.max(1, Math.floor((2 * targetEffLv) / casterEffLv));
      } else if (spell.id === 34) {
        // #34 破壞神 (`fn_74764`): simultaneously applies #17 魔刃術 (AP+15%), #18 魔鎧術 (DP+15%), AND #19 風行術 (HIT+15, EV+15)!
        u.apBuffTurns = randInclusive(2, 4);
        u.dpBuffTurns = randInclusive(2, 4);
        u.mvBuffTurns = randInclusive(2, 4);
        affected.push({ unit: u, amount: 0, isHeal: true, killed: false, hit: true });
        rawSpellExpTotal += Math.max(1, Math.floor((6 * targetEffLv) / casterEffLv));
      } else if (spell.id === 20) {
        // #20 解毒術 (`fn_76421`): cures poison AND restores +9 HP!
        u.poisonTurns = 0;
        const beforeHp = u.hp;
        u.hp = Math.min(u.maxHp, u.hp + 9);
        const actualHealed = Math.max(0, u.hp - beforeHp);
        const fullHealPool = Math.floor((40 * targetEffLv) / casterEffLv);
        rawSpellExpTotal += Math.max(1, Math.floor((fullHealPool * 9) / Math.max(1, u.maxHp)));
        affected.push({ unit: u, amount: actualHealed > 0 ? actualHealed : 9, isHeal: true, killed: false, hit: true });
      } else if (spell.id === 21) {
        // #21 祛麻術 (`fn_76742`): cures paralysis AND restores +9 HP!
        u.paralyzeTurns = 0;
        const beforeHp = u.hp;
        u.hp = Math.min(u.maxHp, u.hp + 9);
        const actualHealed = Math.max(0, u.hp - beforeHp);
        const fullHealPool = Math.floor((40 * targetEffLv) / casterEffLv);
        rawSpellExpTotal += Math.max(1, Math.floor((fullHealPool * 9) / Math.max(1, u.maxHp)));
        affected.push({ unit: u, amount: actualHealed > 0 ? actualHealed : 9, isHeal: true, killed: false, hit: true });
      } else if (spell.id === 25) {
        // #25 行動術 (`fn_76804`: Re-Act, EXP = int(8 * targetLv / casterLv))
        if (u.runtimeId !== caster.runtimeId) {
          u.acted = false;
          u.moved = false;
        }
        affected.push({ unit: u, amount: 0, isHeal: true, killed: false, hit: true });
        rawSpellExpTotal += Math.max(1, Math.floor((8 * targetEffLv) / casterEffLv));
      } else {
        // Healing spells (`#13 治療術 70`, `#14 回復術 140`, `#15 再生術 260`, `#16 神恩術 500`, `#33 風妖精 800`):
        // Exact `FD2.EXE` `fn_72409..fn_74067`: heals `90%..100%` of `spell.power`!
        const beforeHp = u.hp;
        const rollPct = 90 + Math.floor(Math.random() * 11);
        const healAmt = Math.max(1, Math.floor(((spell.power || 70) * rollPct) / 100));
        u.hp = Math.min(u.maxHp, u.hp + healAmt);
        const actualHealed = Math.max(0, u.hp - beforeHp);
        // Exact `FD2.EXE` `fn_51478`: `((40 * targetEffLv) // casterEffLv) * actualHealed // u.maxHp`
        if (actualHealed > 0) {
          const fullHealPool = Math.floor((40 * targetEffLv) / casterEffLv);
          rawSpellExpTotal += Math.max(1, Math.floor((fullHealPool * actualHealed) / Math.max(1, u.maxHp)));
        }
        affected.push({ unit: u, amount: healAmt, isHeal: true, killed: false, hit: true });
      }
    } else {
      // Exact FD2.EXE L51142..L51179: Earthquake spells (`10..12`) automatically MISS flying units (`moveMode === 'fly'`)!
      if (isEarthquakeSpell && u.moveMode === 'fly') {
        affected.push({ unit: u, amount: 0, isHeal: false, killed: false, hit: false });
        continue;
      }

      const swordMult = SWORD_TECH_AP_MULTIPLIERS[spell.id];
      const isStatusAilmentSpell = spell.id === 22 || spell.id === 26 || spell.id === 27 || spell.id === 35;

      // Hit roll: Sword Techniques (`24, 28, 29, 30`) have 100% hit rate; Status spells (`22, 26, 27, 35`) have 50% hit rate;
      // Offensive spells (`0..12, 32`) use `spell.hit` (`80%` or `90%`).
      const hit =
        swordMult !== undefined
          ? true
          : Math.random() * 100 < (spell.hit || (isStatusAilmentSpell ? 50 : 90));

      if (!hit) {
        affected.push({ unit: u, amount: 0, isHeal: false, killed: false, hit: false });
        continue;
      }

      const beforeHp = u.hp;
      let dmg = 0;

      if (swordMult !== undefined) {
        // Exact `FD2.EXE` `fn_95980` Sword Technique (`劍技`) Physical Damage Formula:
        // `maxDmg = max(1, floor(caster.ap * mult) - target.dp)`, actual damage = `90%..100%` of `maxDmg`!
        const scaledAp = Math.floor(getEquippedStats(caster, gd).ap * swordMult);
        const targetDp = getEquippedStats(u, gd).dp;
        const maxDmg = Math.max(1, scaledAp - targetDp);
        const rollPct = 90 + Math.floor(Math.random() * 11);
        dmg = Math.max(1, Math.floor((maxDmg * rollPct) / 100));
      } else if (isStatusAilmentSpell) {
        // Exact `FD2.EXE` `fn_76769 / fn_76991 / fn_77377 / fn_74789`:
        // `#22 封咒術`, `#26 毒擊術`, `#27 麻痹術`, and `#35 暗邪鬼` (all 3 simultaneously!) inflict 2..4 turns of status AND deal 9 HP damage!
        if (spell.id === 22 || spell.id === 35) u.silenceTurns = randInclusive(2, 4);
        if (spell.id === 26 || spell.id === 35) u.poisonTurns = randInclusive(2, 4);
        if (spell.id === 27 || spell.id === 35) u.paralyzeTurns = randInclusive(2, 4);
        dmg = 9;
      } else {
        // Exact `FD2.EXE` `fn_51128` + `GLOBAL_2_8086` Offensive Magic Damage Formula:
        // `rawDmg = floor(spell.power * (90..100) / 100)`, `dmg = max(1, floor(rawDmg * targetMagicDamageTakenTenths / 10))`!
        const effTargetClassId =
          u.uid >= 68 ? gd.unitDex[u.uid]?.enemyStats?.heroClassEquiv ?? u.classId : u.classId;
        const targetClassDef = gd.heroClasses.find((c) => c.id === effTargetClassId);
        const tenths = targetClassDef?.magicDamageTakenTenths ?? 10;
        const rollPct = 90 + Math.floor(Math.random() * 11); // 90..100%
        const rawSpellDmg = Math.floor((Math.max(18, spell.power) * rollPct) / 100);
        dmg = Math.max(1, Math.floor((rawSpellDmg * tenths) / 10));
      }

      u.hp = Math.max(0, u.hp - dmg);
      const effectiveSpellDmg = Math.max(0, beforeHp - u.hp);
      let killed = u.hp <= 0;
      const isLeidingNonLethal = killed && u.drop?.type === 'event' && u.drop.value === 30;
      if (isLeidingNonLethal) {
        eventDrops.push(30);
        u.hp = 1;
        u.drop = null;
        killed = false;
      } else {
        rawSpellExpTotal += computeEnemyCombatExp(caster, u, effectiveSpellDmg, killed, gd);
        if (killed && u.drop) {
          if (u.drop.type === 'event') eventDrops.push(u.drop.value);
          else if (u.drop.type === 'dialogue') dialogueDrops.push(u.drop.value);
          else drops.push({ type: u.drop.type, value: u.drop.value });
        }
      }
      affected.push({ unit: u, amount: dmg, isHeal: false, killed, hit: true });
    }
  }

  let expGained = 0;
  let levelUp: LevelUpGain | null = null;
  // Exact `FD2.EXE` (`item.htm` L33): Item-invoked spell effects (`fromItem === true`) award 0 EXP!
  if (!fromItem && caster.faction === 'player' && rawSpellExpTotal > 0) {
    expGained = Math.min(99, rawSpellExpTotal);
    levelUp = applyExpAndCheckLevelUp(caster, expGained, gd);
  }

  return { affected, expGained, levelUp, drops, eventDrops, dialogueDrops };
}

/** Returns true if `item` can be actively invoked via `道具 -> 使用` (`fn_48150` / `fn_68719` `useEffect > 0`). */
export function isItemUsableInBattle(item: ItemDef | undefined): boolean {
  if (!item) return false;
  return item.useEffect > 0;
}

/**
 * For reusable spell-casting weapons & sacred relics (`useEffect 12, 14..16, 20..24`:
 * `#11 炎龍劍`, `#29 戰神戟`, `#38 閃雷鎚`, `#51 風神弓`, `#56 魔法杖`, `#57 封咒杖`, `#60 龍之杖`,
 * `#79 光束砲`, `#99 雷神鞭`, `#101 傳送法杖`, `#210 星之眼`, `#212 暗之眼`, `#213 冰之眼`, `#214 火之眼`),
 * returns the equivalent `SpellDef` ID (`fn_68719` / `GLOBAL_2_7425[12..24]`).
 */
export function getItemEquivalentSpellId(item: ItemDef): number | null {
  if (item.useEffect === 12) return 19; // 19 = 風行術 (#210 星之眼)
  if (item.useEffect === 14) return 27; // 27 = 麻痹術 (#212 暗之眼)
  if (item.useEffect === 15) return 18; // 18 = 魔鎧術 (#213 冰之眼)
  if (item.useEffect === 16) return 17; // 17 = 魔刃術 (#214 火之眼)
  if (item.useEffect === 20) return item.useVal; // 0 = 火炎術 (#56), 2 = 炎龍術 (#11, #60)
  if (item.useEffect === 21) return item.useVal === 1 ? 4 : item.useVal; // 4 = 電擊術 (#38), 6 = 轟雷術 (#29, #99), 7 = 神雷術 (#51)
  if (item.useEffect === 22) return 22; // 22 = 封咒術 (#57)
  if (item.useEffect === 23) return 23; // 23 = 傳送術 (#101)
  if (item.useEffect === 24) return 3;  // 3 = 天火術 (#79 光束砲)
  return null;
}

/**
 * Resolves ranged / AoE support or healing item use (`fn_68719` / `fn_20565`, including `#102 修理套件` `range=4, aoe=2, +500 HP`,
 * `#192..#197` herbs/cures, `#206..#207` MP items, and reusable heals `#40 光之斧 / #58 力之杖 / #61 光之杖 / #211 光之眼`)
 * centered on `(targetX, targetY)`.
 */
export function resolveAreaItemUse(
  actor: BattleUnit,
  itemIdxInBag: number,
  targetX: number,
  targetY: number,
  units: BattleUnit[],
  gd: GameData
): {
  item: ItemDef | undefined;
  healed: { unit: BattleUnit; amount: number }[];
  summaryZh: string;
} {
  const itemId = actor.items[itemIdxInBag];
  const item = gd.items[itemId];
  if (!item) return { item: undefined, healed: [], summaryZh: tr('無效果', '无效果', 'No effect') };

  // Self-only permanent stat potions (`useRange === 0`: `#94..#96`, `#198..#200`) delegate directly to `useConsumable`
  if ((item.useRange ?? 1) === 0) {
    const msg = useConsumable(actor, itemIdxInBag, gd, actor);
    return { item, healed: [], summaryZh: msg };
  }

  // Only single-use consumables (`itemType === 32`: `#102 修理套件`, `#192..#200`, `#206..#207`) are removed from the bag!
  if (item.itemType === 32) {
    actor.items.splice(itemIdxInBag, 1);
    syncUnitEquipmentIndices(actor, gd);
    if (actor.drop?.type === 'item' && actor.drop.value === itemId && !actor.items.includes(itemId)) {
      actor.drop = null;
    }
  }

  const aoe = item.useAoe ?? 0;
  const targets = units.filter(
    (u) => isUnitActiveOnMap(u) && !areHostile(actor.faction, u.faction) && manhattan(u.x, u.y, targetX, targetY) <= aoe
  );

  if (item.useEffect === 6 || itemId === 196) {
    for (const t of targets) t.poisonTurns = 0;
    return { item, healed: [], summaryZh: tr(`使用 ${item.nameZh}：解除中毒！`, `使用 ${item.nameZh}：解除中毒！`, `Used ${item.nameZh}: Cured poison!`) };
  }
  if (item.useEffect === 7 || itemId === 197) {
    for (const t of targets) t.paralyzeTurns = 0;
    return { item, healed: [], summaryZh: tr(`使用 ${item.nameZh}：解除麻痺！`, `使用 ${item.nameZh}：解除麻痹！`, `Used ${item.nameZh}: Cured paralysis!`) };
  }
  if (item.useEffect === 11 || itemId === 206 || itemId === 207) {
    const mpHeal = item.useVal || (itemId === 207 ? 200 : 80);
    for (const t of targets) {
      t.mp = Math.min(t.maxMp, t.mp + mpHeal);
    }
    return { item, healed: [], summaryZh: tr(`使用 ${item.nameZh}：回復 MP +${mpHeal}！`, `使用 ${item.nameZh}：回复 MP +${mpHeal}！`, `Used ${item.nameZh}: Restored MP +${mpHeal}!`) };
  }

  // HP Healing (`useEffect === 5` consumables `#102 修理套件 = +500`, `#192..#195 = +40/+120/+300/+999`,
  // and `useEffect === 13` reusable `#40 光之斧 = +100`, `#58 力之杖 = +300`, `#61 光之杖 = +500`, `#211 光之眼 = +200`):
  const hpHeal = item.useVal || 40;
  const healed: { unit: BattleUnit; amount: number }[] = [];
  for (const t of targets) {
    const beforeHp = t.hp;
    t.hp = Math.min(t.maxHp, t.hp + hpHeal);
    const actualGain = Math.max(0, t.hp - beforeHp);
    healed.push({ unit: t, amount: actualGain > 0 ? actualGain : hpHeal });
  }
  const totalTargets = healed.length;
  const firstAmt = healed[0]?.amount ?? hpHeal;
  const summaryZh =
    totalTargets > 1
      ? tr(`使用 ${item.nameZh}：範圍回復 ${totalTargets} 名友軍 HP（+${hpHeal}）！`, `使用 ${item.nameZh}：范围回复 ${totalTargets} 名友军 HP（+${hpHeal}）！`, `Used ${item.nameZh}: Restored HP (+${hpHeal}) to ${totalTargets} allies!`)
      : tr(`使用 ${item.nameZh}：回復 HP +${firstAmt}！`, `使用 ${item.nameZh}：回复 HP +${firstAmt}！`, `Used ${item.nameZh}: Restored HP +${firstAmt}!`);
  return { item, healed, summaryZh };
}

/**
 * Uses a consumable or permanent stat-boosting potion from `unit.items[itemIdxInBag]`,
 * applying its effect to `targetUnit` (`fn_68719` exact `ITEM_TABLE` `useVal` values).
 */
export function useConsumable(unit: BattleUnit, itemIdxInBag: number, gd: GameData, targetUnit: BattleUnit = unit): string {
  const itemId = unit.items[itemIdxInBag];
  const item = gd.items[itemId];
  if (!item) return tr('無效果', '无效果', 'No effect');

  // Key relics (`100 天空之鑰`, `208 控制中樞`, `209 黃金徽章`) are triggered on event tiles, not consumed manually
  if (itemId === 100 || itemId === 208 || itemId === 209) {
    return tr(`${item.nameZh} 發出微弱的光芒……`, `${item.nameZh} 发出微弱的光芒……`, `${item.nameZh} emits a faint glow...`);
  }

  if (item.itemType === 32) {
    unit.items.splice(itemIdxInBag, 1);
    syncUnitEquipmentIndices(unit, gd);
    if (unit.drop?.type === 'item' && unit.drop.value === itemId && !unit.items.includes(itemId)) {
      unit.drop = null;
    }
  }

  // Exact `FD2.EXE` `fn_68719` (`Obj 3 + 685` `useVal`) permanent stat-boosting items:
  // `#198 力量藥水 = +9 AP`, `#199 耐力藥水 = +9 DP`, `#200 速度藥水 = +7 DX`,
  // `#94 生命之實 = +20 MaxHP`, `#95 魔力水晶 = +20 MaxMP`, `#96 風精之羽 = +1 MV`
  if (itemId === 198 || item.useEffect === 8) {
    const gain = item.useVal || 9;
    targetUnit.baseAp += gain;
    return tr(`使用 ${item.nameZh}：AP 永久 +${gain}！`, `使用 ${item.nameZh}：AP 永久 +${gain}！`, `Used ${item.nameZh}: Permanent AP +${gain}!`);
  }
  if (itemId === 199 || item.useEffect === 9) {
    const gain = item.useVal || 9;
    targetUnit.baseDp += gain;
    return tr(`使用 ${item.nameZh}：DP 永久 +${gain}！`, `使用 ${item.nameZh}：DP 永久 +${gain}！`, `Used ${item.nameZh}: Permanent DP +${gain}!`);
  }
  if (itemId === 200 || item.useEffect === 10) {
    const gain = item.useVal || 7;
    targetUnit.baseDx += gain;
    return tr(`使用 ${item.nameZh}：DX 永久 +${gain}！`, `使用 ${item.nameZh}：DX 永久 +${gain}！`, `Used ${item.nameZh}: Permanent DX +${gain}!`);
  }
  if (itemId === 94 || item.useEffect === 17) {
    const gain = item.useVal || 20;
    targetUnit.maxHp += gain;
    targetUnit.hp = Math.min(targetUnit.maxHp, targetUnit.hp + gain);
    return tr(`使用 ${item.nameZh}：最大 HP +${gain}！`, `使用 ${item.nameZh}：最大 HP +${gain}！`, `Used ${item.nameZh}: Max HP +${gain}!`);
  }
  if (itemId === 95 || item.useEffect === 18) {
    const gain = item.useVal || 20;
    targetUnit.maxMp += gain;
    targetUnit.mp = Math.min(targetUnit.maxMp, targetUnit.mp + gain);
    return tr(`使用 ${item.nameZh}：最大 MP +${gain}！`, `使用 ${item.nameZh}：最大 MP +${gain}！`, `Used ${item.nameZh}: Max MP +${gain}!`);
  }
  if (itemId === 96 || item.useEffect === 19) {
    const gain = item.useVal || 1;
    targetUnit.mv = Math.min(12, targetUnit.mv + gain);
    return tr(`使用 ${item.nameZh}：移動力 MV +${gain}！`, `使用 ${item.nameZh}：移动力 MV +${gain}！`, `Used ${item.nameZh}: Movement MV +${gain}!`);
  }
  if (itemId === 196 || item.useEffect === 6) {
    targetUnit.poisonTurns = 0;
    return tr(`使用 ${item.nameZh}：解除中毒！`, `使用 ${item.nameZh}：解除中毒！`, `Used ${item.nameZh}: Cured poison!`);
  }
  if (itemId === 197 || item.useEffect === 7) {
    targetUnit.paralyzeTurns = 0;
    return tr(`使用 ${item.nameZh}：解除麻痺！`, `使用 ${item.nameZh}：解除麻痹！`, `Used ${item.nameZh}: Cured paralysis!`);
  }

  if (item.useEffect === 11 || item.useEffect === 2 || itemId === 206 || itemId === 207) {
    const mpHeal = itemId === 207 ? 200 : item.useVal || 80;
    targetUnit.mp = Math.min(targetUnit.maxMp, targetUnit.mp + mpHeal);
    return tr(`使用 ${item.nameZh}：回復 MP +${mpHeal}！`, `使用 ${item.nameZh}：回复 MP +${mpHeal}！`, `Used ${item.nameZh}: Restored MP +${mpHeal}!`);
  }

  // Exact `FD2.EXE` `ITEM_TABLE` (`Obj 3 + 685` `uint16 rec[14..15]`) HP heal amounts:
  // `192 藥草 = 40`, `193 回復劑 = 120`, `194 再生藥 = 300`, `102 修理套件 = 500`, `195 神聖之水 = 999`
  const hpHeal =
    itemId === 195
      ? 999
      : itemId === 102
        ? 500
        : itemId === 194
          ? 300
          : itemId === 193
            ? 120
            : item.useVal || 40;
  const beforeHp = targetUnit.hp;
  targetUnit.hp = Math.min(targetUnit.maxHp, targetUnit.hp + hpHeal);
  const actualGain = Math.max(0, targetUnit.hp - beforeHp);
  return tr(`使用 ${item.nameZh}：回復 HP +${actualGain > 0 ? actualGain : hpHeal}！`, `使用 ${item.nameZh}：回复 HP +${actualGain > 0 ? actualGain : hpHeal}！`, `Used ${item.nameZh}: Restored HP +${actualGain > 0 ? actualGain : hpHeal}!`);
}

/**
 * Evaluates per-chapter victory & defeat rules matching `FD2.EXE` `fn_66996 .. fn_68597` (`VIC` table)!
 */
export function evaluateChapterBattleStatus(
  chapter: ChapterData,
  slots: (BattleUnit | null)[],
  turn: number,
  flags?: ArrayLike<number>
): 'ongoing' | 'victory' | 'defeat' {
  if (chapter.isCutsceneMap) return 'ongoing';
  const active = slots.filter(isUnitActiveOnMap);

  const findHeroUnit = (baseHeroId: number): BattleUnit | undefined =>
    slots.find((u): u is BattleUnit => Boolean(u && (u.baseHeroId ?? u.uid) === baseHeroId));

  // 1. Defeat Checks:
  // - `#0 索爾` (`baseHeroId === 0` / `#0, #32, #50`) falling is ALWAYS immediate Game Over!
  const solSlot = findHeroUnit(0);
  if (solSlot && solSlot.hp <= 0) return 'defeat';

  const alivePlayers = active.filter((u) => u.faction === 'player');
  if (alivePlayers.length === 0) return 'defeat';

  // - Ch 26..30 (`id >= 25`): `#9 悠妮` (`baseHeroId === 9`) must survive (`fn_68412..fn_68597`)!
  if (chapter.id >= 25) {
    const uni = findHeroUnit(9);
    if (uni && uni.hp <= 0) return 'defeat';
  }

  // - Ch 2 (`id === 1`, `羅德鎮`): Defeat if ALL 6 villagers (`#133 / #134`, `slots[5..10]`) are killed (`fn_67269`)!
  //   (Escaped villagers have `hp > 0, hidden = true`, so checking `v.hp <= 0` properly treats escaped villagers as safe!)
  if (chapter.id === 1) {
    const allVillagers = slots.filter((u) => u && (u.uid === 133 || u.uid === 134));
    if (allVillagers.length > 0 && allVillagers.every((v) => !v || v.hp <= 0)) {
      return 'defeat';
    }
  }

  // - Ch 10 (`id === 9`): `#11 索菲亞` (`slot 50`) and `#135 卡納恩三世` (`slot 51`) must survive (`fn_67335`)!
  if (chapter.id === 9) {
    const sophia = findHeroUnit(11);
    const king = slots.find((u) => u && u.uid === 135);
    if ((sophia && sophia.hp <= 0) || (king && king.hp <= 0)) return 'defeat';
  }

  // - Ch 12 (`id === 11`): `#17 米亞斯多德` must survive (`fn_67389`)!
  if (chapter.id === 11) {
    const mias = findHeroUnit(17);
    if (mias && mias.hp <= 0) return 'defeat';
  }

  // - Ch 13 (`id === 12`): `#3 哈瓦特` (`slot 59`, after Turn 4 arrival) must survive AND at least 1 of the 12 allied prisoners (`slots[15..26]`) must survive (`fn_67429`)!
  if (chapter.id === 12) {
    const harvard = findHeroUnit(3);
    if (harvard && harvard.hp <= 0) return 'defeat';
    const prisoners = slots.slice(15, 27).filter((u): u is BattleUnit => u !== null);
    if (prisoners.length > 0 && prisoners.every((p) => p.hp <= 0)) return 'defeat';
  }

  // - Ch 15 (`id === 14`): `#15 塞可邦勒` must survive (`fn_67618`)!
  if (chapter.id === 14) {
    const sekb = findHeroUnit(15);
    if (sekb && sekb.hp <= 0) return 'defeat';
  }

  // - Ch 16 (`id === 15`): `#18 蜜蒂` must survive (`fn_67658`)!
  if (chapter.id === 15) {
    const midi = findHeroUnit(18);
    if (midi && midi.hp <= 0) return 'defeat';
  }

  // - Ch 17 (`id === 16`): If `#18 蜜蒂` did not join in Ch 16 (spawned at guest `slot 52`), `slot 52` must survive (`fn_67698`)!
  if (chapter.id === 16) {
    const guestMidi = slots[52];
    if (guestMidi && (guestMidi.baseHeroId ?? guestMidi.uid) === 18 && guestMidi.hp <= 0) return 'defeat';
  }

  // - Ch 18 (`id === 17`): `#21 約拿` (`slot 16`) and `#7 蘭斯洛特` (`slot 17`) must survive (`fn_67791`)!
  if (chapter.id === 17) {
    const jonah = findHeroUnit(21);
    const lancelot = findHeroUnit(7);
    if ((jonah && jonah.hp <= 0) || (lancelot && lancelot.hp <= 0)) return 'defeat';
  }

  // - Ch 19 (`id === 18`): After Turn 6 arrival, `#27 巴拿羅西亞` (`slot 64`) must survive (`fn_67878`)!
  if (chapter.id === 18) {
    if (turn > 6) {
      const bana = findHeroUnit(27);
      if (bana && bana.hp <= 0) return 'defeat';
    }
  }

  // - Ch 20 (`id === 19`): `#25 謝多` (`slot 52`) and at least 1 of the 8 Elves (`slots[53..60]`) must survive (`fn_67927`)!
  if (chapter.id === 19) {
    const shadow = findHeroUnit(25);
    if (shadow && shadow.hp <= 0) return 'defeat';
    const elves = slots.slice(53, 61).filter((u): u is BattleUnit => u !== null);
    if (elves.length > 0 && elves.every((e) => e.hp <= 0)) return 'defeat';
  }

  // - Ch 21 (`id === 20`): `#24 希爾法` (`slot 16`) and `#23 羅蘭` (`slot 17`) must survive (`fn_68177`)!
  if (chapter.id === 20) {
    const silva = findHeroUnit(24);
    const roland = findHeroUnit(23);
    if ((silva && silva.hp <= 0) || (roland && roland.hp <= 0)) return 'defeat';
  }

  // - Ch 22 (`id === 21`): `#24 希爾法` (`slot 1`) must survive (`fn_68231`)!
  if (chapter.id === 21) {
    const silva22 = findHeroUnit(24);
    if (silva22 && silva22.hp <= 0) return 'defeat';
  }

  // - Ch 23 (`id === 22`): `#24 希爾法` (`slot 1`), `#22 卡里斯` (`slot 16`), and `#19 羅德曼` (`slot 17`) must survive (`fn_68271`)!
  if (chapter.id === 22) {
    const silva23 = findHeroUnit(24);
    const karis = findHeroUnit(22);
    const rodman = findHeroUnit(19);
    if ((silva23 && silva23.hp <= 0) || (karis && karis.hp <= 0) || (rodman && rodman.hp <= 0)) return 'defeat';
  }

  // - Ch 25 (`id === 24`): `#26 聖寇拉斯` (`slot 16`) must survive (`fn_68372`)!
  if (chapter.id === 24) {
    const kouras = findHeroUnit(26);
    if (kouras && kouras.hp <= 0) return 'defeat';
  }

  // - Ch 26 (`id === 25`): `#29 亞齊梅吉` (`slot 1`) and `#9 悠妮` (`slot 2`) must survive (`fn_68412`)!
  if (chapter.id === 25) {
    const archmage26 = findHeroUnit(29);
    if (archmage26 && archmage26.hp <= 0) return 'defeat';
  }

  // 2. Special Victory Checks:
  // - Ch 18 (`id === 17`): Defeating Boss `#85 黑暗騎士` (`slot 52`) wins immediately (`fn_67791`: `if (fn_148798(52)) GLOBAL_2_16076 = 2`)!
  if (chapter.id === 17) {
    const darkKnightBoss = slots[52] ?? slots.find((u) => u && u.faction === 'enemy' && u.isBoss);
    if (darkKnightBoss && darkKnightBoss.hp <= 0) return 'victory';
  }

  // - Ch 23 (`id === 22`): Defeating Boss `#116 機甲隊長` (`slot 18`) wins immediately (`fn_68271`)!
  if (chapter.id === 22) {
    const mechaBoss23 = slots[18] ?? slots.find((u) => u && u.faction === 'enemy' && u.uid === 116);
    if (mechaBoss23 && mechaBoss23.hp <= 0) return 'victory';
  }

  // - Ch 29 (`id === 28`): Victory ONLY when all 3 awakened Dragons (`#104 火龍, #127 暗黑龍, #105 雷龍`) are defeated (`flag[18..20] == 1`)!
  if (chapter.id === 28) {
    if (flags && flags[18] && flags[19] && flags[20]) return 'victory';
    return 'ongoing';
  }

  // - Ch 30 (`id === 29`): Defeating Final Boss `#126 空魔神` (`slot 20`) wins immediately (`fn_68597`)!
  if (chapter.id === 29) {
    const voidGod = slots[20] ?? slots.find((u) => u && u.uid === 126 && u.faction === 'enemy');
    if (voidGod && voidGod.hp <= 0) return 'victory';
  }

  // - Standard Rout Check (excluding stationary hazard `#121` in Ch 13 & Ch 20, and optional duel `#104 火龍` `slot 17` in Ch 25!):
  const requiredEnemies = active.filter((u) => {
    if (u.faction !== 'enemy') return false;
    if ((chapter.id === 12 || chapter.id === 19) && u.uid === 121) return false;
    if (chapter.id === 24 && u.uid === 104 && u.slotIndex === 17) return false;
    return true;
  });
  if (requiredEnemies.length === 0) {
    return 'victory';
  }

  return 'ongoing';
}

export interface AiDecision {
  destX: number;
  destY: number;
  targetUnit?: BattleUnit;
  spell?: SpellDef;
  useItemBagIdx?: number;
  itemTargetX?: number;
  itemTargetY?: number;
  escapedMap?: boolean;
  lootChestAtDest?: boolean;
}

/**
 * Computes terrain- & ZOC-aware shortest-path cost from `(originX, originY)` (or `goals`) across the map (`fn_19320` / `fn_254016`),
 * and traces `FD2.EXE` `fn_254374` + `fn_19222`'s exact diagonal-balanced ideal path & sub-goal waypoint!
 */
function computeTileStepCostForUnit(unit: BattleUnit, chapter: ChapterData, gd: GameData, x: number, y: number): number {
  const effClassRow = unit.moveMode === 'fly' ? 19 : Math.max(1, Math.min(28, unit.classId));
  const classCosts = gd.classMoveCosts?.[effClassRow];
  const tinfo = getTerrainInfo(chapter, x, y);
  if (tinfo.moveCostFoot >= 99 && unit.moveMode !== 'fly') return 999;
  const tc = classCosts ? classCosts[tinfo.bonusIdx] : undefined;
  if (tc !== undefined && tc > 0) return tc >= 20 ? 999 : tc;
  if (unit.moveMode === 'fly') return tinfo.bonusIdx === 5 ? 999 : 1;
  if (tinfo.bonusIdx === 1 || tinfo.bonusIdx === 5) return 999;
  return unit.moveMode === 'cavalry' ? tinfo.moveCostCav : tinfo.moveCostFoot;
}

/**
 * Authentic `FD2.EXE` `fn_74122` (`GLOBAL_2_7425[23]` — `#23 傳送術` & `#101 傳送法杖`):
 * Returns all passable, unoccupied map tiles `(x, y)` on `chapter` that `targetUnit` can be teleported onto.
 */
export function getValidTeleportDestinationTiles(
  targetUnit: BattleUnit,
  chapter: ChapterData,
  units: BattleUnit[],
  gd: GameData
): [number, number][] {
  const occupied = new Set<string>();
  for (const u of units) {
    if (isUnitActiveOnMap(u)) {
      occupied.add(coordKey(u.x, u.y));
    }
  }
  const coords: [number, number][] = [];
  for (let y = 0; y < chapter.height; y++) {
    for (let x = 0; x < chapter.width; x++) {
      if (occupied.has(coordKey(x, y))) continue;
      if (computeTileStepCostForUnit(targetUnit, chapter, gd, x, y) < 999) {
        coords.push([x, y]);
      }
    }
  }
  return coords;
}

function computeGoalDistanceField(
  unit: BattleUnit,
  chapter: ChapterData,
  units: BattleUnit[],
  gd: GameData,
  goals: [number, number][]
): Float64Array {
  const W = chapter.width;
  const H = chapter.height;
  const dist = new Float64Array(W * H);
  dist.fill(1e9);

  const hostileSet = new Set<number>();
  const zocSet = new Set<number>();
  const zocDirs = [
    [0, 1],
    [-1, 0],
    [0, -1],
    [1, 0],
  ];
  for (const u of units) {
    if (isUnitActiveOnMap(u) && u.runtimeId !== unit.runtimeId && areHostile(unit.faction, u.faction)) {
      hostileSet.add(u.y * W + u.x);
      for (const [zx, zy] of zocDirs) {
        const ex = u.x + zx;
        const ey = u.y + zy;
        if (ex >= 0 && ey >= 0 && ex < W && ey < H) {
          zocSet.add(ey * W + ex);
        }
      }
    }
  }

  const startIdx = unit.y * W + unit.x;
  const queue: [number, number, number][] = [];
  for (const [gx, gy] of goals) {
    if (gx >= 0 && gy >= 0 && gx < W && gy < H) {
      const idx = gy * W + gx;
      dist[idx] = 0;
      queue.push([gx, gy, 0]);
    }
  }

  const dirs = [
    [1, 0],
    [0, -1],
    [-1, 0],
    [0, 1],
  ];
  while (queue.length > 0) {
    queue.sort((a, b) => a[2] - b[2]);
    const [cx, cy, cCost] = queue.shift()!;
    if (cCost > dist[cy * W + cx]) continue;

    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const sc = computeTileStepCostForUnit(unit, chapter, gd, nx, ny);
      if (sc >= 999) continue;
      const nIdx = ny * W + nx;
      // Hostile units (`0x40`) & hostile ZOC tiles (`0x80` in `19622 -> 17869`) add detour cost so fleeing civilians route cleanly around enemies
      const extra = hostileSet.has(nIdx) ? 60 : nIdx !== startIdx && zocSet.has(nIdx) ? 16 : 0;
      const next = cCost + sc + extra;
      if (next < dist[nIdx]) {
        dist[nIdx] = next;
        queue.push([nx, ny, next]);
      }
    }
  }
  return dist;
}

/**
 * Authentic `FD2.EXE` `fn_19320` (`19581 -> fn_254374`, `19865 -> fn_19222`, `19950..20014` `5 × abs()`):
 *  1. Forward-floods shortest path from `(unit.x, unit.y)` to the nearest goal `(gx, gy)` and backtracks via `fn_254374`
 *     (proportional/alternating orthogonal steps so diagonal paths step smoothly `[3, 2, 3, 2]` instead of wall-hugging L-shapes!).
 *  2. Walks along that ideal path up to `effMv` (`fn_19222`) to locate the ideal waypoint `(subX, subY)`.
 *  3. If `(subX, subY)` is reachable & unoccupied (`fn_18129`), steps directly onto it; otherwise picks the unoccupied reachable tile
 *     minimizing `(goalDist, manhattanToSubGoal, diagonalDiffToSubGoal)` (`19950..20014`)!
 */
function pickBestStepTowardGoals(
  unit: BattleUnit,
  reachable: Map<string, MoveNode>,
  chapter: ChapterData,
  units: BattleUnit[],
  gd: GameData,
  goals: [number, number][],
  stopDistance = 0
): MoveNode {
  const stayNode: MoveNode = reachable.get(coordKey(unit.x, unit.y)) ?? { x: unit.x, y: unit.y, cost: 0, parent: null };
  if (goals.length === 0 || unit.mv <= 0) return stayNode;
  if (goals.some(([gx, gy]) => manhattan(unit.x, unit.y, gx, gy) <= stopDistance)) {
    return stayNode;
  }

  const W = chapter.width;
  const H = chapter.height;
  const distToGoal = computeGoalDistanceField(unit, chapter, units, gd, goals);

  // Pick nearest reachable goal `(gx, gy)` and forward-flood from `(unit.x, unit.y)` to trace `fn_254374` ideal path
  const effMv = unit.mv;
  const hostilePosSet = new Set<number>();
  const zocPosSet = new Set<number>();
  const backDirs: [number, number][] = [
    [0, 1],  // 0 = South
    [-1, 0], // 1 = West
    [0, -1], // 2 = North
    [1, 0],  // 3 = East
  ];
  for (const u of units) {
    if (isUnitActiveOnMap(u) && u.runtimeId !== unit.runtimeId && areHostile(unit.faction, u.faction)) {
      hostilePosSet.add(u.y * W + u.x);
      for (const [dx, dy] of backDirs) {
        const ex = u.x + dx;
        const ey = u.y + dy;
        if (ex >= 0 && ey >= 0 && ex < W && ey < H) zocPosSet.add(ey * W + ex);
      }
    }
  }

  const fwdDist = new Float64Array(W * H);
  fwdDist.fill(1e9);
  fwdDist[unit.y * W + unit.x] = 0;
  const fq: [number, number, number][] = [[unit.x, unit.y, 0]];
  const goalKeySet = new Set(goals.map(([gx, gy]) => gy * W + gx));

  while (fq.length > 0) {
    fq.sort((a, b) => a[2] - b[2]);
    const [cx, cy, c] = fq.shift()!;
    if (c > fwdDist[cy * W + cx]) continue;
    for (const [dx, dy] of backDirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nIdx = ny * W + nx;
      if (hostilePosSet.has(nIdx) && !goalKeySet.has(nIdx)) continue;
      const sc = computeTileStepCostForUnit(unit, chapter, gd, nx, ny);
      if (sc >= 999) continue;
      const extra = zocPosSet.has(nIdx) && !goalKeySet.has(nIdx) ? 16 : 0;
      const nc = c + sc + extra;
      if (nc < fwdDist[nIdx]) {
        fwdDist[nIdx] = nc;
        fq.push([nx, ny, nc]);
      }
    }
  }

  let chosenGoal: [number, number] = goals[0];
  let bestGVal = 1e9;
  for (const [gx, gy] of goals) {
    if (gx >= 0 && gy >= 0 && gx < W && gy < H) {
      const d = fwdDist[gy * W + gx];
      if (d < bestGVal) {
        bestGVal = d;
        chosenGoal = [gx, gy];
      }
    }
  }

  let subX = unit.x;
  let subY = unit.y;
  if (bestGVal < 1e8) {
    // Backtrack from `chosenGoal` to `(unit.x, unit.y)` (`fn_254374` proportional/alternating axis trace)
    const path: [number, number][] = [[chosenGoal[0], chosenGoal[1]]];
    let cx = chosenGoal[0];
    let cy = chosenGoal[1];
    let lastDir = -1;
    let guard = 0;
    while ((cx !== unit.x || cy !== unit.y) && guard < W * H) {
      guard++;
      let bestPrev: [number, number, number] | null = null;
      let bestTuple: [number, number, number, number] = [1e9, 1e9, 1e9, 1e9];
      const remDx = Math.abs(cx - unit.x);
      const remDy = Math.abs(cy - unit.y);
      for (let dIdx = 0; dIdx < backDirs.length; dIdx++) {
        const [dx, dy] = backDirs[dIdx];
        const px = cx + dx;
        const py = cy + dy;
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        const pDist = fwdDist[py * W + px];
        if (pDist < fwdDist[cy * W + cx] - 1e-6) {
          const isHoriz = dx !== 0;
          const axisPref = remDx > remDy ? (isHoriz ? 0 : 1) : remDy > remDx ? (isHoriz ? 1 : 0) : dIdx === lastDir ? 1 : 0;
          const sameDirPen = dIdx === lastDir ? 1 : 0;
          const cand: [number, number, number, number] = [pDist, axisPref, sameDirPen, dIdx];
          if (
            cand[0] < bestTuple[0] - 1e-6 ||
            (Math.abs(cand[0] - bestTuple[0]) <= 1e-6 &&
              (cand[1] < bestTuple[1] ||
                (cand[1] === bestTuple[1] && (cand[2] < bestTuple[2] || (cand[2] === bestTuple[2] && cand[3] < bestTuple[3])))))
          ) {
            bestTuple = cand;
            bestPrev = [px, py, dIdx];
          }
        }
      }
      if (!bestPrev) break;
      cx = bestPrev[0];
      cy = bestPrev[1];
      lastDir = bestPrev[2];
      path.push([cx, cy]);
    }
    path.reverse();

    // `fn_19222`: walk forward along `path` up to `effMv` (respecting `stopDistance`) to locate `(subX, subY)`
    let remMv = effMv;
    for (let i = 1; i < path.length; i++) {
      const [px, py] = path[i];
      if (manhattan(px, py, chosenGoal[0], chosenGoal[1]) < stopDistance) break;
      if (hostilePosSet.has(py * W + px)) break;
      const sc = computeTileStepCostForUnit(unit, chapter, gd, px, py);
      if (sc > remMv || sc >= 999) break;
      subX = px;
      subY = py;
      remMv = zocPosSet.has(py * W + px) ? 0 : remMv - sc;
      if (remMv <= 0) break;
    }

    const directHit = reachable.get(coordKey(subX, subY));
    if (directHit && (subX !== unit.x || subY !== unit.y)) {
      return directHit;
    }
  }

  // `19950..20014` (`5 × abs()`): when `(subX, subY)` is occupied by a friendly unit (or unreachable due to stopDistance),
  // pick the unoccupied reachable node minimizing `(goalDist, manhattanToSub, diagDiffToSub)` in `(y, x)` order!
  const nodes = Array.from(reachable.values()).sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x));
  let bestNode = stayNode;
  let bestGoalDist = distToGoal[unit.y * W + unit.x];
  let bestSubManh = Math.abs(unit.x - subX) + Math.abs(unit.y - subY);
  let bestSubDiag = Math.abs(Math.abs(unit.x - subX) - Math.abs(unit.y - subY));

  for (const node of nodes) {
    if (node.x === unit.x && node.y === unit.y) continue;
    const d = distToGoal[node.y * W + node.x];
    const subManh = Math.abs(node.x - subX) + Math.abs(node.y - subY);
    const subDiag = Math.abs(Math.abs(node.x - subX) - Math.abs(node.y - subY));
    const strictlyCloserGoal = d < bestGoalDist - 1e-6;
    const tiedGoal = Math.abs(d - bestGoalDist) <= 1e-6;
    if (
      strictlyCloserGoal ||
      (tiedGoal && (subManh < bestSubManh || (subManh === bestSubManh && subDiag < bestSubDiag)))
    ) {
      bestGoalDist = d;
      bestSubManh = subManh;
      bestSubDiag = subDiag;
      bestNode = node;
    }
  }
  return bestNode;
}

/**
 * Authentic `FD2.EXE` `fn_15007` AI Controller (`mode = unit.aiMode & 0x3F = 0..11`, `0x80`/`0x40` = heal/spell flags):
 *  - Mode `0`: Aggressive Charge (`20208` -> `16673` -> `16028` march toward nearest foe)
 *  - Mode `1`: Proximity Engage (`20208` -> `16673` within ~2x MV + range; else hold)
 *  - Mode `2`: Hold Position / Stationary Guard (`20208` -> `16951` from current tile only; NEVER moves!)
 *  - Mode `3`: Escort / Protect Character `uid == aiTargetX` (`20208` -> `11360` -> `19320` follow character)
 *  - Mode `4`: Non-Combat March / Flee to `(aiTargetX, aiTargetY)` (`19320` directly — used by Ch 2 `#133/#134` Civilians!)
 *  - Mode `5`: Treasure Thief (`20208` -> `19320` to unopened chest `aiChestIdx` -> loot & switch to Mode `7` escape!)
 *  - Mode `6` / `8`: Passive / Hold Turn (never moves or initiates attacks — Ch 10 `#135`, Ch 25 `#104`)
 *  - Mode `7`: Retreat to `(aiTargetX, aiTargetY)` & Vanish off-map (`fn_141685`)
 *  - Mode `9`: Follow Character `uid == aiTargetX` (`11360` -> `19320`)
 *  - Mode `10`: Combat March to `(aiTargetX, aiTargetY)` (`20208` -> `19320`)
 *  - Mode `11`: Boss Tactical Engage (`16951` -> `16673`)
 */
export function chooseAiAction(
  unit: BattleUnit,
  chapter: ChapterData,
  units: BattleUnit[],
  gd: GameData,
  options?: { stationaryMagicOnly?: boolean; skipMagicAndItems?: boolean }
): AiDecision {
  const mode = unit.aiMode & 0x3f;
  const dex = gd.unitDex[unit.uid];
  const isNonCombatantNpc = Boolean(dex && (!dex.appearsOnBattlefield || !dex.canAttack));

  // Mode 6 & Mode 8 (Completely Passive — e.g. Ch 10 `#135 卡納恩三世`, Ch 25 `#104 火龍`): never move, never attack!
  if (mode === 6 || mode === 8) {
    return { destX: unit.x, destY: unit.y };
  }

  const reachable = computeReachableTiles(unit, chapter, units, gd);

  // Mode 7: Flee to `(aiTargetX, aiTargetY)` and vanish (`fn_141685` — Ch 15 fleeing `#102` & Mode 5 thieves post-loot)!
  if (mode === 7) {
    const gx = Math.max(0, Math.min(chapter.width - 1, unit.aiTargetX));
    const gy = Math.max(0, Math.min(chapter.height - 1, unit.aiTargetY));
    const step = pickBestStepTowardGoals(unit, reachable, chapter, units, gd, [[gx, gy]], 0);
    const arrived = step.x === gx && step.y === gy;
    return { destX: step.x, destY: step.y, escapedMap: arrived };
  }

  // Mode 4 (or any Defenseless Non-Combatant NPC `#133/#134`):
  // Strictly marches along shortest BFS path to `(aiTargetX, aiTargetY)` WITHOUT initiating combat (`fn_15007 @15324`)!
  // (In Ch 2 `羅德鎮`: Villagers flee to `(19,6)` inner bridge and `(15,0)/(16,0)` north escape road, away from bandits!)
  if (mode === 4 || isNonCombatantNpc) {
    if (isNonCombatantNpc && unit.aiTargetX === 0 && unit.aiTargetY === 0) {
      return { destX: unit.x, destY: unit.y };
    }
    const gx = Math.max(0, Math.min(chapter.width - 1, unit.aiTargetX));
    const gy = Math.max(0, Math.min(chapter.height - 1, unit.aiTargetY));
    const step = pickBestStepTowardGoals(unit, reachable, chapter, units, gd, [[gx, gy]], 0);
    return { destX: step.x, destY: step.y };
  }

  // Mode 9 (`fn_15007 @15776..15840`, e.g. Ch 18 `#21 約拿` `0x89` following `#0 索爾` `aiTargetX = 0` & `#7 蘭斯洛特` following `#21 約拿` `aiTargetX = 21`):
  // Calls `fn_11360(unit.aiTargetX)` and walks directly toward `leader` via `fn_19320` (or rests via `fn_16340` when adjacent) without initiating combat;
  // only if `leader` is not found on the map (`v0 == -1`, `goto L15091`) does Mode 9 fall back to Mode 0!
  if (mode === 9 && unit.aiTargetX >= 0) {
    const leader = units.find(
      (u) => isUnitActiveOnMap(u) && !areHostile(unit.faction, u.faction) && (u.uid === unit.aiTargetX || u.baseHeroId === unit.aiTargetX)
    );
    if (leader) {
      const step = pickBestStepTowardGoals(unit, reachable, chapter, units, gd, [[leader.x, leader.y]], 1);
      return { destX: step.x, destY: step.y };
    }
  }

  const stats = getEquippedStats(unit, gd);
  const hasWeapon = canUnitAttack(unit, gd);
  const friendlyUnits = units.filter((u) => isUnitActiveOnMap(u) && !areHostile(unit.faction, u.faction));
  const opponents = units.filter((u) => isUnitActiveOnMap(u) && areHostile(unit.faction, u.faction));

  // In `FD2.EXE` (`fn_15007 @15174..15204` -> `fn_20208` -> `fn_16951 @17090..17225`):
  // ALL combat modes (`0, 1, 2, 3, 5, 10, 11`) evaluate `fn_16951` across all reachable tiles within `unit.mv`!
  // Mode 2 (`0x02 / 0x82 / 0xC2`) moves within `unit.mv` to attack any opponent within `unit.mv + maxRange`,
  // and ONLY holds position at `(unit.x, unit.y)` if `fn_20208` finds no action (`maxActionScore < 6`)!
  const stayNode: MoveNode = { x: unit.x, y: unit.y, cost: 0, parent: null };
  const candidateNodes: MoveNode[] = unit.mv <= 0 ? [stayNode] : Array.from(reachable.values());

  // =========================================================================
  // Exact `FD2.EXE` `fn_20208` Unified 3-Way Action Arbiter (`Obj1 + 20208`):
  //   1. `fn_22142 / fn_22656` -> `itemScore`  (`GLOBAL_2_15411`):
  //      - Evaluates HP-healing items (`192 藥草, 193 回復劑, 194 再生藥, 195 神聖之水`) strictly from `(unit.x, unit.y)`
  //        on `self` (`dist === 0`) or an already-adjacent friendly unit (`dist === 1`, without walking!).
  //      - `hp > floor(maxHp / 2)` -> `0`; `floor(maxHp / 3) < hp <= floor(maxHp / 2)` -> `3`; `hp <= floor(maxHp / 3)` -> `8`.
  //      - When target `ally` has `(ally.aiMode & 0x80) !== 0` (`@22737: test(M1[v3+52], 128)`), heal score is multiplied by `3` (`3 -> 9`, `8 -> 24`)!
  //   2. `fn_22922 / fn_23415` -> `magicScore` (`GLOBAL_2_15395`):
  //      - Cast strictly from `(unit.x, unit.y)` (`fn_20565 / fn_21265` never walk, except Sword Saints `#18/#19/#34` if move+cast).
  //      - Healing (`13..16`): `3` at `<= 50%` HP (`9` with `0x80` / `6` with `0x01`), `8` at `<= 33%` HP (`24` with `0x80` / `16` with `0x01`).
  //      - Support / Status (`17..22`, `26`, `27`): `6` per valid target.
  //      - Offensive (`0..12, 24, 28..33`): `8` per non-lethal hit (`12` on `#0 索爾`), `24` per lethal hit (`opp.hp < power`).
  //   3. `fn_16951`            -> `attackScore` (`GLOBAL_2_15439`):
  //      - Evaluates reachable weapon attacks (`candidateNodes`): non-lethal hit = `8`, lethal kill (`dmg >= opp.hp`) = `18`!
  //   Minimum action gate in `fn_20208 @20322..20347` is `score >= 6`!
  // =========================================================================
  const hasSelfPreservationFlag = (unit.aiMode & 0x80) !== 0;
  const hasAttackPreferenceFlag = (unit.aiMode & 0x40) !== 0;

  // --- A. Usable / Consumable Item Evaluator (`fn_22142 / fn_22656`) ---
  let bestItemScore = 0;
  let bestItemSubTie = -1e9;
  let bestItemDecision: AiDecision | null = null;

  // Mode 11 (`fn_15007 @15874`) only calls `fn_22922` (Magic) + `fn_16951` (Attack), whereas Modes `0,1,2,3,5,10` call full `fn_20208`
  if (mode !== 11 && !options?.stationaryMagicOnly && !options?.skipMagicAndItems) {
    const evaluatedHealItemIds = new Set<number>();
    for (let bagIdx = 0; bagIdx < unit.items.length; bagIdx++) {
      const iid = unit.items[bagIdx];
      const item = gd.items[iid];
      if (!item || item.itemType === 34) continue;

      if (item.useEffect === 5 || item.useEffect === 13) {
        if (evaluatedHealItemIds.has(iid)) continue;
        evaluatedHealItemIds.add(iid);

        const useRange = item.useRange ?? 1;
        const useAoe = item.useAoe ?? 0;

        if (useAoe === 0) {
          for (const ally of friendlyUnits) {
            if (manhattan(unit.x, unit.y, ally.x, ally.y) > useRange) continue;
            const halfHp = Math.floor(ally.maxHp / 2);
            const thirdHp = Math.floor(ally.maxHp / 3);
            let rawScore = 0;
            if (ally.hp <= thirdHp) rawScore = 8;
            else if (ally.hp <= halfHp) rawScore = 3;
            if (rawScore <= 0) continue;

            const isSelf = ally.runtimeId === unit.runtimeId;
            const targetHas0x80 = (ally.aiMode & 0x80) !== 0 || (isSelf && hasSelfPreservationFlag);
            const itemScore = targetHas0x80 ? rawScore * 3 : rawScore;
            const subTie = (isSelf ? 1 : 0) + (1 - ally.hp / Math.max(1, ally.maxHp));
            if (itemScore > bestItemScore || (itemScore === bestItemScore && subTie > bestItemSubTie)) {
              bestItemScore = itemScore;
              bestItemSubTie = subTie;
              bestItemDecision = {
                destX: unit.x,
                destY: unit.y,
                targetUnit: ally,
                useItemBagIdx: bagIdx,
                itemTargetX: ally.x,
                itemTargetY: ally.y,
              };
            }
          }
        } else {
          // Ranged AoE heal (e.g. `#102 修理套件` `useRange = 4, useAoe = 2`, `#61 光之杖` `useRange = 3, useAoe = 2`, `#40 光之斧` `useRange = 2, useAoe = 1`):
          // Enumerate every map tile `(tx, ty)` within `useRange` of `(unit.x, unit.y)` and sum `fn_22656` scores across `useAoe`!
          const minX = Math.max(0, unit.x - useRange);
          const maxX = Math.min(chapter.width - 1, unit.x + useRange);
          const minY = Math.max(0, unit.y - useRange);
          const maxY = Math.min(chapter.height - 1, unit.y + useRange);
          for (let ty = minY; ty <= maxY; ty++) {
            for (let tx = minX; tx <= maxX; tx++) {
              if (manhattan(unit.x, unit.y, tx, ty) > useRange) continue;
              let sumScore = 0;
              let subTie = 0;
              let primaryTarget: BattleUnit | undefined;
              let worstRatio = 2;
              for (const ally of friendlyUnits) {
                if (manhattan(ally.x, ally.y, tx, ty) > useAoe) continue;
                const halfHp = Math.floor(ally.maxHp / 2);
                const thirdHp = Math.floor(ally.maxHp / 3);
                let s = 0;
                if (ally.hp <= thirdHp) s = 8;
                else if (ally.hp <= halfHp) s = 3;
                if (s <= 0) continue;
                const isSelf = ally.runtimeId === unit.runtimeId;
                if ((ally.aiMode & 0x80) !== 0 || (isSelf && hasSelfPreservationFlag)) s *= 3;
                sumScore += s;
                const ratio = ally.hp / Math.max(1, ally.maxHp);
                subTie += 1 - ratio;
                if (ratio < worstRatio) {
                  worstRatio = ratio;
                  primaryTarget = ally;
                }
              }
              if (
                sumScore > 0 &&
                primaryTarget &&
                (sumScore > bestItemScore || (sumScore === bestItemScore && subTie > bestItemSubTie))
              ) {
                bestItemScore = sumScore;
                bestItemSubTie = subTie;
                bestItemDecision = {
                  destX: unit.x,
                  destY: unit.y,
                  targetUnit: primaryTarget,
                  useItemBagIdx: bagIdx,
                  itemTargetX: tx,
                  itemTargetY: ty,
                };
              }
            }
          }
        }
      } else if ((item.useEffect === 20 || item.useEffect === 21) && opponents.length > 0) {
        const eqSpellId = getItemEquivalentSpellId(item);
        const eqSpell = eqSpellId !== null ? gd.spells[eqSpellId] : undefined;
        if (!eqSpell) continue;
        const useRange = item.useRange ?? 2;
        const useAoe = item.useAoe ?? 0;
        const perHitScore = item.useVal >= 2 ? 18 : 8; // Matches `ExtSim` verification (`#56/#38 = 8`, `#11/#29/#51/#60/#99 = 18`)!
        for (const opp of opponents) {
          const d = manhattan(unit.x, unit.y, opp.x, opp.y);
          if (d < 1 || d > useRange) continue;
          const hitOpps = opponents.filter((o) => manhattan(o.x, o.y, opp.x, opp.y) <= useAoe);
          const itemScore = perHitScore * Math.max(1, hitOpps.length);
          const subTie = hitOpps.length + (1 - opp.hp / Math.max(1, opp.maxHp));
          if (itemScore > bestItemScore || (itemScore === bestItemScore && subTie > bestItemSubTie)) {
            bestItemScore = itemScore;
            bestItemSubTie = subTie;
            bestItemDecision = {
              destX: unit.x,
              destY: unit.y,
              targetUnit: opp,
              useItemBagIdx: bagIdx,
              itemTargetX: opp.x,
              itemTargetY: opp.y,
            };
          }
        }
      }
    }
  }

  // --- B. Magic Spell Evaluator (`fn_22922 / fn_23415`) ---
  let bestMagicScore = 0;
  let bestMagicSubTie = -1e9;
  let bestMagicIsSupport = false;
  let bestMagicDecision: AiDecision | null = null;

  if (!options?.skipMagicAndItems && (unit.silenceTurns ?? 0) === 0 && unit.spells.length > 0) {
    // Only Sword Saints (`#18 蜜蒂`, `#19 羅德曼`, `#34 鐵諾`) can move and cast in the same turn (`fn_36236` / `fn_20565` / `fn_21265`);
    // Mode 11 (`#126 空魔神`, `stationaryMagicOnly`) casts strictly from `(unit.x, unit.y)` BEFORE moving + attacking!
    const canMoveCast = !options?.stationaryMagicOnly && (unit.uid === 18 || unit.uid === 19 || unit.uid === 34);
    const spellOriginNodes: MoveNode[] = canMoveCast ? candidateNodes : [stayNode];

    for (const sid of unit.spells) {
      const sp = gd.spells[sid];
      if (!sp || unit.mp < sp.mpCost || sp.id === 23 || sp.id === 31) continue;

      if (sp.targetType === 'ally') {
        for (const node of spellOriginNodes) {
          for (const ally of friendlyUnits) {
            if (manhattan(node.x, node.y, ally.x, ally.y) > sp.castRange) continue;
            let magScore = 0;
            let magSub = 0;

            if (sp.power > 0) {
              // Healing spells (`13 治療術, 14 回復術, 15 再生術, 16 神恩術` — `fn_23415 @23585..23726`)
              const blast = new Set(
                getSpellBlastTiles(node.x, node.y, ally.x, ally.y, sp, chapter).map(([bx, by]) => coordKey(bx, by))
              );
              for (const u of friendlyUnits) {
                if (!blast.has(coordKey(u.x, u.y))) continue;
                const halfHp = Math.floor(u.maxHp / 2);
                const thirdHp = Math.floor(u.maxHp / 3);
                let s = 0;
                if (u.hp <= thirdHp) s = 8;
                else if (u.hp <= halfHp) s = 3;
                if (s > 0) {
                  if ((u.aiMode & 0x80) !== 0 || (u.runtimeId === unit.runtimeId && hasSelfPreservationFlag)) {
                    s *= 3;
                  } else if ((u.aiMode & 1) !== 0) {
                    s *= 2;
                  }
                }
                magScore += s;
                magSub += 1 - u.hp / Math.max(1, u.maxHp);
              }
            } else if (sp.id === 20 && ally.poisonTurns > 0) {
              magScore = 6;
            } else if (sp.id === 21 && ally.paralyzeTurns > 0) {
              magScore = 6;
            } else if (sp.id === 18 && (ally.dpBuffTurns ?? 0) === 0 && opponents.length > 0) {
              magScore = 6;
            } else if (sp.id === 17 && (ally.apBuffTurns ?? 0) === 0 && canUnitAttack(ally, gd) && opponents.length > 0) {
              magScore = 6;
            } else if (sp.id === 19 && (ally.mvBuffTurns ?? 0) === 0 && opponents.length > 0) {
              magScore = 6;
            } else if (sp.id === 34 && opponents.length > 0) {
              const blast = new Set(
                getSpellBlastTiles(node.x, node.y, ally.x, ally.y, sp, chapter).map(([bx, by]) => coordKey(bx, by))
              );
              for (const u of friendlyUnits) {
                if (!blast.has(coordKey(u.x, u.y))) continue;
                if ((u.apBuffTurns ?? 0) === 0 || (u.dpBuffTurns ?? 0) === 0 || (u.mvBuffTurns ?? 0) === 0) {
                  magScore += 6;
                }
              }
            }

            if (magScore > bestMagicScore || (magScore === bestMagicScore && magScore > 0 && magSub > bestMagicSubTie)) {
              bestMagicScore = magScore;
              bestMagicSubTie = magSub;
              bestMagicIsSupport = true;
              bestMagicDecision = { destX: node.x, destY: node.y, targetUnit: ally, spell: sp };
            }
          }
        }
      } else if (opponents.length > 0) {
        for (const node of spellOriginNodes) {
          for (const opp of opponents) {
            const d = manhattan(node.x, node.y, opp.x, opp.y);
            const inRange = sp.castRange === 0 ? d <= sp.aoe : d >= 1 && d <= sp.castRange;
            if (!inRange) continue;
            const blast = new Set(
              getSpellBlastTiles(node.x, node.y, opp.x, opp.y, sp, chapter).map(([bx, by]) => coordKey(bx, by))
            );
            const hitOpps = opponents.filter((o) => blast.has(coordKey(o.x, o.y)));
            if (hitOpps.length === 0) continue;

            if (sp.id === 22 || sp.id === 26 || sp.id === 27 || sp.id === 35) {
              // Status ailment spells (`22 封咒術`, `26 毒擊術`, `27 麻痹術`, `35 暗邪鬼`):
              const validTargets = hitOpps.filter((o) => {
                if (sp.id === 22) return o.spells.length > 0 && o.mp > 0 && (o.silenceTurns ?? 0) === 0;
                if (sp.id === 26) return o.poisonTurns === 0;
                if (sp.id === 27) return o.paralyzeTurns === 0;
                return (o.silenceTurns ?? 0) === 0 || o.poisonTurns === 0 || o.paralyzeTurns === 0;
              });
              if (validTargets.length === 0) continue;
              const perTargetScore = sp.id === 35 ? 18 : 6;
              const magScore = perTargetScore * validTargets.length;
              if (magScore > bestMagicScore) {
                bestMagicScore = magScore;
                bestMagicSubTie = validTargets.length;
                bestMagicIsSupport = sp.id !== 35;
                bestMagicDecision = { destX: node.x, destY: node.y, targetUnit: opp, spell: sp };
              }
            } else if (sp.power > 0 || sp.spellCategory === 'special_tech') {
              // Offensive spells (`0..12, 24, 28..33` — `fn_23415 @23467..23583`):
              // Each hit target scores `24` if lethal (`o.hp < effPower`) or `8` if non-lethal (`1.5x` if hitting `#0 索爾`)!
              const nonImmuneHits =
                sp.id >= 10 && sp.id <= 12 ? hitOpps.filter((o) => o.moveMode !== 'fly') : hitOpps;
              if (nonImmuneHits.length === 0) continue;
              const swordMult = SWORD_TECH_AP_MULTIPLIERS[sp.id];
              const effPower =
                swordMult !== undefined ? Math.floor(stats.ap * swordMult) : Math.max(18, sp.power);
              let magScore = 0;
              for (const o of nonImmuneHits) {
                let s = o.hp < effPower ? 24 : 8;
                if ((o.baseHeroId ?? o.uid) === 0) {
                  s = Math.floor(s * 1.5);
                }
                magScore += s;
              }
              const magSub = effPower * nonImmuneHits.length * (Math.max(55, sp.hit) / 100);
              if (magScore > bestMagicScore || (magScore === bestMagicScore && magSub > bestMagicSubTie)) {
                bestMagicScore = magScore;
                bestMagicSubTie = magSub;
                bestMagicIsSupport = false;
                bestMagicDecision = { destX: node.x, destY: node.y, targetUnit: opp, spell: sp };
              }
            }
          }
        }
      }
    }
  }

  const MIN_AI_ACTION_SCORE = 6;
  if (options?.stationaryMagicOnly) {
    if (bestMagicDecision && bestMagicScore >= MIN_AI_ACTION_SCORE) {
      return bestMagicDecision;
    }
    return { destX: unit.x, destY: unit.y };
  }

  // --- C. Physical Weapon Attack Evaluator (`fn_16951`) ---
  let bestAttackScore = 0;
  let bestAttackSubTie = -1e9;
  let bestAttackRawDiff = 0;
  let bestAttackDecision: AiDecision | null = null;

  if (hasWeapon && opponents.length > 0) {
    const isLinearBeamWeapon = stats.weapon?.id === 79; // #79 光束炮 (#113 光束砲座): strictly orthogonal ray in FD2.EXE!
    for (const node of candidateNodes) {
      for (const opp of opponents) {
        const d = manhattan(node.x, node.y, opp.x, opp.y);
        if (isLinearBeamWeapon && node.x !== opp.x && node.y !== opp.y) continue;
        if (d >= stats.minRange && d <= stats.maxRange) {
          const tempAtk = { ...unit, x: node.x, y: node.y };
          const fc = predictCombat(tempAtk, opp, chapter, gd);
          // Exact `FD2.EXE` `fn_16951 @17529..17818`: if `rawDmg <= 2` -> `0`; if `dmg > opp.hp` -> `18`; else `8`!
          if (fc.attackerDmg <= 2) continue;
          const atkScore = fc.attackerDmg >= opp.hp ? 18 : 8;
          const expectedDmg = (fc.attackerDmg * fc.attackerHitPct) / 100;
          const counterPenalty = fc.canCounter ? (fc.defenderDmg * fc.defenderHitPct) / 220 : 0;
          const tBonus = getTerrainInfo(chapter, node.x, node.y).defBonus * 0.4;
          const isSolBonus = (opp.baseHeroId ?? opp.uid) === 0 ? 1.5 : 1.0;
          const subTie = (expectedDmg - counterPenalty) * isSolBonus + tBonus - node.cost * 0.01;
          if (atkScore > bestAttackScore || (atkScore === bestAttackScore && subTie > bestAttackSubTie)) {
            bestAttackScore = atkScore;
            bestAttackSubTie = subTie;
            bestAttackRawDiff = stats.ap - getEquippedStats(opp, gd).dp;
            bestAttackDecision = { destX: node.x, destY: node.y, targetUnit: opp };
          }
        }
      }
    }
  }

  // --- D. Exact `fn_20208 @20322..20545` Winner Selection (Minimum Gate `>= 6`) ---
  const maxActionScore = Math.max(bestItemScore, bestMagicScore, bestAttackScore);
  if (maxActionScore >= MIN_AI_ACTION_SCORE) {
    // 1. Strictly highest score wins (`L20356..20384`, `L20493..20542`)
    if (bestAttackDecision && bestAttackScore > bestMagicScore && bestAttackScore > bestItemScore) {
      return bestAttackDecision;
    }
    if (bestMagicDecision && bestMagicScore > bestAttackScore && bestMagicScore >= bestItemScore) {
      return bestMagicDecision;
    }
    if (bestItemDecision && bestItemScore > bestAttackScore && bestItemScore > bestMagicScore) {
      return bestItemDecision;
    }
    // 2. Attack == Item > Magic (`L20459..20491`): `0x40` (`v5 != 0`) prefers Attack, else Item!
    if (bestAttackScore === bestItemScore && bestAttackScore > bestMagicScore) {
      if (hasAttackPreferenceFlag && bestAttackDecision) return bestAttackDecision;
      if (bestItemDecision) return bestItemDecision;
    }
    // 3. Attack == Magic >= Item (`L20389..20457`):
    //    For single-target offensive spells (`id < 11`), compare `spell.power < (unit.ap - target.dp)`;
    //    for `id >= 11`, `0x40` (`v5 != 0`) prefers Attack unless support magic, else Magic!
    if (bestAttackScore === bestMagicScore && bestAttackScore >= bestItemScore) {
      const sp = bestMagicDecision?.spell;
      if (sp && sp.id < 11) {
        if (sp.power < bestAttackRawDiff && bestAttackDecision) return bestAttackDecision;
        if (bestMagicDecision) return bestMagicDecision;
      } else {
        if (hasAttackPreferenceFlag && !bestMagicIsSupport && bestAttackDecision) return bestAttackDecision;
        if (bestMagicDecision) return bestMagicDecision;
      }
    }
    if (bestItemDecision && bestItemScore === maxActionScore) return bestItemDecision;
    if (bestMagicDecision && bestMagicScore === maxActionScore) return bestMagicDecision;
    if (bestAttackDecision && bestAttackScore === maxActionScore) return bestAttackDecision;
  }

  // Mode 5 (`fn_15007 @15385..15652`, Treasure Thief `#98 影之忍者` in Ch 16/19, `#102/#103` in Ch 11/13):
  // If `fn_20208` found no combat/heal action (`< 6`), pathfind to unopened chest `aiChestIdx`!
  // If the chest was ALREADY opened (`L15437 / L15459: goto L15109`), fall through to Mode 0 to attack the player!
  if (mode === 5) {
    const targetChestIdx = unit.aiChestIdx ?? 0;
    let chestCoord: [number, number] | null = null;
    for (let y = 0; y < chapter.height && !chestCoord; y++) {
      for (let x = 0; x < chapter.width; x++) {
        const [, evid, , , flags] = chapter.cells[y][x];
        if ((flags & 2) !== 0 && evid === targetChestIdx) {
          chestCoord = [x, y];
          break;
        }
      }
    }
    if (chestCoord) {
      const step = pickBestStepTowardGoals(unit, reachable, chapter, units, gd, [chestCoord], 0);
      const onChest = step.x === chestCoord[0] && step.y === chestCoord[1];
      return { destX: step.x, destY: step.y, lootChestAtDest: onChest };
    }
  }

  if (opponents.length === 0) {
    return { destX: unit.x, destY: unit.y };
  }

  // Mode 2 (`fn_15007 @15174..15204`): holds position when `fn_20208` finds no reachable target within `unit.mv + maxRange`!
  if (mode === 2 || unit.mv <= 0) {
    return { destX: unit.x, destY: unit.y };
  }

  // 3. Mode 3: Escort / Follow / Hunt Character `uid === aiTargetX` (`fn_11360 -> fn_19320`, including `aiTargetX === 0` `#0 索爾`)!
  //    If target character is not found (`v0 == -1`, `L15244: goto L15109`), falls through to Mode 0!
  if (mode === 3 && unit.aiTargetX >= 0) {
    const targetChar = units.find(
      (u) => isUnitActiveOnMap(u) && (u.uid === unit.aiTargetX || u.baseHeroId === unit.aiTargetX)
    );
    if (targetChar) {
      const stopDist = areHostile(unit.faction, targetChar.faction) ? 1 : 2;
      const step = pickBestStepTowardGoals(unit, reachable, chapter, units, gd, [[targetChar.x, targetChar.y]], stopDist);
      return { destX: step.x, destY: step.y };
    }
  }

  // 4. Mode 10: Combat March to `(aiTargetX, aiTargetY)` (`fn_15007 @15852`)!
  if (mode === 10) {
    const gx = Math.max(0, Math.min(chapter.width - 1, unit.aiTargetX));
    const gy = Math.max(0, Math.min(chapter.height - 1, unit.aiTargetY));
    const step = pickBestStepTowardGoals(unit, reachable, chapter, units, gd, [[gx, gy]], 0);
    return { destX: step.x, destY: step.y };
  }

  // 5. Mode 1 & Mode 11 (Proximity Engage `fn_16673 @16808`): advances toward any opponent within `28` movement cost!
  const nearestOppDist = Math.min(...opponents.map((o) => manhattan(unit.x, unit.y, o.x, o.y)));
  if ((mode === 1 || mode === 11) && nearestOppDist > 28) {
    return { destX: unit.x, destY: unit.y };
  }

  // 6. Mode 0 (Aggressive Charge `fn_16028`) & awakened Proximity units: advance along true BFS shortest path toward nearest opponent!
  const oppGoals: [number, number][] = opponents.map((o) => [o.x, o.y]);
  const bestAdvance = pickBestStepTowardGoals(unit, reachable, chapter, units, gd, oppGoals, 1);
  return { destX: bestAdvance.x, destY: bestAdvance.y };
}
