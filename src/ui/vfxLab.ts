import type { SfxKind, SoundEngine } from '../audio/soundEngine';
import type { AssetManager } from '../engine/assets';
import { getLocale, tr } from '../i18n';
import type { FigAniStrip } from '../types';
import {
  HD_SPELL_CATALOG,
  defaultSpellIdForUnit,
  drawHdSpellEffect,
  ensureHdSpellAssets,
  getHdSpellEntry,
  getLoadedHdSpellAssets,
} from './hdSpellVfx';

// Authentic FD2.EXE `fn_113818` (`GLOBAL_2_9686 = [48, 49, 50, 51, 52, 53, 51]`):
// Maps `FIGANI.DAT` chunk_header[4] (`sfxBankCode = 1..7`) to `FDOTHER.DAT[48..53]`.
const FIGANI_SFX_BANK_TABLE = [48, 49, 50, 51, 52, 53, 51];

export interface UnitSfxProfile {
  bankChunk: number;
  stepSfx: SfxKind;
  /** Non-hit windup/launch SFX (e.g., Celia bowstring `bank:50:2`, Beckwith crossbow `bank:51:4`, Mech gun `bank:51:1`, Ares/Lorna spin `bank:49:2`). */
  launchSfx: SfxKind | null;
  /** Ordered per-hit impact SFX from `FIGANI.DAT` (e.g., Celia `['bank:50:1']`, Uni/Marin `['bank:53:1']`, Lancelot `['bank:52:1','bank:52:1','bank:52:1','bank:52:4']`). */
  hitSfxList: SfxKind[];
  magicChantSfx: SfxKind;
  magicHitSfx: SfxKind[];
}

interface VfxSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  bounces: number;
  groundY: number;
}

interface VfxDust {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  growRate: number;
  alpha: number;
  color: string;
}

interface VfxLeaf {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  size: number;
  hue: number;
  depth: number;
}

export type AnimSourceMode = 'omni_video' | 'nb2_6frame' | 'nb2_3pose';

export interface ModernVfxConfig {
  animSource: AnimSourceMode;
  enableParallaxAndGodRays: boolean;
  enableAfterimagesAndSpring: boolean;
  enableVolumetricSlash: boolean;
  enableAnimeCutIn: boolean;
  enableHitStopAndSparks: boolean;
  slowMotion: boolean;
}

interface ClassicFigBundle {
  img: HTMLImageElement;
  strip: FigAniStrip;
}

export interface VfxHitFrameSpec {
  frame: number;
  weight: number;
  sfx?: 'slash' | 'crit';
  color?: 'gold' | 'azure';
}

export type FlightPattern = 'climb_dive' | 'dip_rise' | 'dash_past' | 'soar_plunge' | 'sky_strafe' | 'hover_swoop';

export interface VfxManifestUnitEntry {
  uid: number;
  nameZh: string;
  nameEn: string;
  classNameZh: string;
  classEn: string;
  role: string;
  side: 'player' | 'enemy';
  cameraOrientation: 'up_left' | 'down_right';
  cutinFacing: 'left' | 'right';
  dir: string;
  omniFrameCount?: number;
  hitFrames?: VfxHitFrameSpec[];
  isRemote?: boolean;
  projectileType?: 'bolt' | 'sniper_bolt' | 'arrow' | 'beam' | 'cryo_beam' | 'orb';
  /** Normalized [0..1] sprite-space coordinates (680x680 frame) where the missile/bolt leaves the weapon on Stage 1. */
  muzzleAnchor?: { x: number; y: number };
  /** Exact firing frame index when the projectile releases on Stage 1. */
  rangedFireFrame?: { nb6: number; omni: number };
  /** Number of rapid consecutive projectiles/hits in a ranged volley (e.g., 3 for #013 Beckway plasma burst, 1 default). */
  rangedBurstCount?: number;
  hasMagic?: boolean;
  magicElement?: 'fire' | 'holy' | 'thunder' | 'ice' | 'arcane';
  magicNameZh?: string;
  magicNameEn?: string;
  isFlying?: boolean;
  /** Authentic 1995 DOS FIGANI.DAT aerial prelude trajectory for Dragon Knights & Dragonkin. */
  flightPattern?: FlightPattern;
  /** Authentic stationary long-range beam/energy wave (e.g., #022 Karis Kamehameha Ki-Wave, #065 Secobang gold beam, or #044/#062 Kelly 'qi_splash' rising golden dragon-fan blast matching DOS FIGANI.DAT F7-F9!). */
  stationaryBeam?: {
    originAnchor: { x: number; y: number };
    color: 'azure' | 'gold' | 'crimson' | 'emerald';
    /** 'beam' = continuous Kamehameha cylinder (Karis / Secobang). 'qi_splash' = explosive wide upward-left fan-shaped jagged Qi splash & trailing streaks (Kelly Fighter/Martial Master!). */
    style?: 'beam' | 'qi_splash';
    thickness?: number;
  };
  /** Canonical standing height (cm) used for cross-character proportional biometric scaling (`1.80 world-px / cm`). */
  heightCm?: number;
  /** Optional total mounted height (cm) including horse or wyvern (e.g., 242 for #007 Lancelot, 325 for #020 Sara). */
  mountHeightCm?: number;
  /** Calibrated render scale multiplier so every unit matches its canonical heightCm without destructive WebP resampling! */
  displayScale?: number;
  sfxProfile?: UnitSfxProfile;
  /** Optional HD secondary skill / spell-chanting strip (`u_XXX/ranged_0..5.webp`, Phase A). */
  rangedSkill?: {
    nameZh: string;
    nameEn: string;
    mode:
      | 'sonic_crescent'
      | 'radiant_blade_cone'
      | 'shadow_wave'
      | 'flame_blade_beam'
      | 'sky_pillar'
      | 'hero_chant';
    frameCount: number;
    isRemote: boolean;
  };
  /** Optional dedicated 2026 HD 6-frame spell-chanting strip (`u_XXX/chant_0..5.webp` + `chant_sheet.jpg`). */
  hasChantAnim?: boolean;
  overallPass?: boolean;
}

export interface HdTerrainPreset {
  id: number;
  zh: string;
  en: string;
  hasTai: boolean;
  outdoor: boolean;
  weather?: 'leaves' | 'snow' | 'embers' | 'dust';
}

export const HD_TERRAIN_PRESETS: HdTerrainPreset[] = [
  { id: 4, zh: '村郊林地', en: 'Village Meadow', hasTai: true, outdoor: true, weather: 'leaves' },
  { id: 5, zh: '幽深森林', en: 'Deep Forest', hasTai: true, outdoor: true, weather: 'leaves' },
  { id: 6, zh: '海岸沙灘', en: 'Coastal Beach', hasTai: true, outdoor: true, weather: 'dust' },
  { id: 9, zh: '荒山峽谷', en: 'Mountain Pass', hasTai: true, outdoor: true, weather: 'dust' },
  { id: 10, zh: '城鎮街道', en: 'Town Street', hasTai: true, outdoor: true, weather: 'dust' },
  { id: 14, zh: '赤岩洞窟', en: 'Red Rock Cavern', hasTai: true, outdoor: false, weather: 'embers' },
  { id: 16, zh: '斷崖高地', en: 'Highland Cliff', hasTai: true, outdoor: true, weather: 'dust' },
  { id: 18, zh: '河畔水域', en: 'Riverbank Shore', hasTai: true, outdoor: true, weather: 'leaves' },
  { id: 19, zh: '沼澤濕地', en: 'Swamp Marsh', hasTai: true, outdoor: false, weather: 'dust' },
  { id: 21, zh: '城牆雉堞', en: 'Castle Battlement', hasTai: true, outdoor: true, weather: 'dust' },
  { id: 25, zh: '高空雲海 (飛兵)', en: 'Sky Clouds (Flyers)', hasTai: false, outdoor: true, weather: 'dust' },
  { id: 28, zh: '熔岩洞穴', en: 'Lava Cavern', hasTai: true, outdoor: false, weather: 'embers' },
  { id: 29, zh: '要塞通道', en: 'Fortress Hallway', hasTai: true, outdoor: false, weather: 'dust' },
  { id: 31, zh: '熔岩鐵網', en: 'Lava Iron Grate', hasTai: true, outdoor: false, weather: 'embers' },
  { id: 33, zh: '鋼鐵神殿', en: 'Steel Sanctuary', hasTai: true, outdoor: false, weather: 'dust' },
  { id: 38, zh: '廣闊草原', en: 'Open Grassland', hasTai: true, outdoor: true, weather: 'leaves' },
  { id: 40, zh: '雪原道路', en: 'Snowfield Road', hasTai: true, outdoor: true, weather: 'snow' },
  { id: 42, zh: '冰封海岸', en: 'Frozen Coast', hasTai: true, outdoor: true, weather: 'snow' },
  { id: 44, zh: '古城鎮路', en: 'Old Town Road', hasTai: true, outdoor: true, weather: 'dust' },
  { id: 45, zh: '城堡石橋', en: 'Castle Stone Bridge', hasTai: true, outdoor: true, weather: 'dust' },
  { id: 48, zh: '烈焰深淵 (飛兵)', en: 'Fiery Abyss (Flyers)', hasTai: false, outdoor: false, weather: 'embers' },
  { id: 49, zh: '松林草坡', en: 'Pine Forest Meadow', hasTai: true, outdoor: true, weather: 'leaves' },
  { id: 50, zh: '林間大路', en: 'Forest Highway', hasTai: true, outdoor: true, weather: 'leaves' },
  { id: 51, zh: '沙地松林', en: 'Sandy Pine Field', hasTai: true, outdoor: true, weather: 'dust' },
  { id: 52, zh: '邊境驛道', en: 'Frontier Road', hasTai: true, outdoor: true, weather: 'dust' },
  { id: 53, zh: '山丘斷崖', en: 'Hilltop Cliff', hasTai: true, outdoor: true, weather: 'leaves' },
  { id: 55, zh: '黃金城堡', en: 'Golden Castle Gate', hasTai: true, outdoor: true, weather: 'dust' },
];

export function getTerrainPreset(bgId: number): HdTerrainPreset {
  return HD_TERRAIN_PRESETS.find((p) => p.id === bgId) ?? HD_TERRAIN_PRESETS[0];
}

interface VfxLabAssets {
  loaded: boolean;
  assetManager: AssetManager | null;
  manifestUnits: VfxManifestUnitEntry[];
  rightUnit: VfxManifestUnitEntry;
  leftUnit: VfxManifestUnitEntry;
  rightCutIn: HTMLImageElement | null;
  leftCutIn: HTMLImageElement | null;
  thorPoses: HTMLImageElement[];
  banditPoses: HTMLImageElement[];
  thorNb6Poses: HTMLImageElement[];
  banditNb6Poses: HTMLImageElement[];
  thorOmniPoses: HTMLImageElement[];
  banditOmniPoses: HTMLImageElement[];
  thorRangedPoses: HTMLImageElement[];
  thorChantPoses: HTMLImageElement[];
  thorRangedProj: HTMLImageElement | null;
  thorSheetRaw: HTMLImageElement;
  banditSheetRaw: HTMLImageElement;
  clashKeyArt: HTMLImageElement;
  forestBg: HTMLImageElement | null;
  heroBgId: number;
  enemyBgId: number;
  bgImages: Map<number, HTMLImageElement>;
  classicThorIdle: ClassicFigBundle | null;
  classicThorAtk: ClassicFigBundle | null;
  classicBanditIdle: ClassicFigBundle | null;
  classicBanditAtk: ClassicFigBundle | null;
}

const DEFAULT_RIGHT_UNIT: VfxManifestUnitEntry = {
  uid: 0,
  nameZh: '索爾',
  nameEn: 'Thor',
  classNameZh: '劍士',
  classEn: 'Swordsman',
  role: 'hero',
  side: 'player',
  cameraOrientation: 'up_left',
  cutinFacing: 'left',
  dir: 'assets/vfx_lab/units/u_000',
  overallPass: true,
};

const DEFAULT_LEFT_UNIT: VfxManifestUnitEntry = {
  uid: 96,
  nameZh: '盜賊',
  nameEn: 'Bandit',
  classNameZh: '盜賊',
  classEn: 'Bandit',
  role: 'enemy',
  side: 'enemy',
  cameraOrientation: 'down_right',
  cutinFacing: 'right',
  dir: 'assets/vfx_lab/units/u_096',
  overallPass: true,
};

const vfxAssetsCache: VfxLabAssets = {
  loaded: false,
  assetManager: null,
  manifestUnits: [DEFAULT_RIGHT_UNIT, DEFAULT_LEFT_UNIT],
  rightUnit: DEFAULT_RIGHT_UNIT,
  leftUnit: DEFAULT_LEFT_UNIT,
  rightCutIn: null,
  leftCutIn: null,
  thorPoses: [],
  banditPoses: [],
  thorNb6Poses: [],
  banditNb6Poses: [],
  thorOmniPoses: [],
  banditOmniPoses: [],
  thorRangedPoses: [],
  thorChantPoses: [],
  thorRangedProj: null,
  thorSheetRaw: new Image(),
  banditSheetRaw: new Image(),
  clashKeyArt: new Image(),
  forestBg: null,
  heroBgId: 4,
  enemyBgId: 4,
  bgImages: new Map<number, HTMLImageElement>(),
  classicThorIdle: null,
  classicThorAtk: null,
  classicBanditIdle: null,
  classicBanditAtk: null,
};

function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

const VFX_ASSET_VERSION = '?v=95';

function enrichUnitMetadataFromGameData(assets: AssetManager, entry: VfxManifestUnitEntry): VfxManifestUnitEntry {
  const dex = assets.gameData.unitDex?.[entry.uid];
  const hero = entry.uid < (assets.gameData.heroes?.length ?? 0) ? assets.gameData.heroes[entry.uid] : null;
  const isRemote = entry.isRemote ?? Boolean(dex?.figani?.attack?.isRemote);
  const spellIds = new Set<number>([...(dex?.knownSpells ?? []), ...(hero?.spells ?? [])]);
  if (hero?.promotions) {
    for (const pr of hero.promotions) {
      if (pr.tier === 1 && pr.growth?.learnableSpells) {
        for (const ls of pr.growth.learnableSpells) spellIds.add(ls.spellId);
      }
    }
  }
  const hasMagic = entry.hasMagic ?? spellIds.size > 0;
  let magicElement = entry.magicElement;
  if (!magicElement && hasMagic) {
    if (spellIds.has(0) || spellIds.has(1) || spellIds.has(2) || spellIds.has(3)) magicElement = 'fire';
    else if (spellIds.has(4) || spellIds.has(5) || spellIds.has(6) || spellIds.has(7)) magicElement = 'thunder';
    else if (spellIds.has(8) || spellIds.has(13) || spellIds.has(14) || spellIds.has(15) || spellIds.has(16) || spellIds.has(32)) magicElement = 'holy';
    else magicElement = 'arcane';
  }
  const isFlying =
    entry.isFlying ??
    Boolean(
      dex &&
        (dex.classNameZh?.includes('龍騎士') ||
          dex.classNameZh?.includes('飛龍') ||
          ((dex.raceId === 4 || dex.raceId === 5) && entry.uid !== 28 && entry.uid !== 29))
    );
  const projectileType = entry.projectileType ?? (isRemote ? 'bolt' : undefined);

  // Derive authentic FD2.EXE per-unit audio profile directly from `gamedata.json` (`FIGANI.DAT` bank + frame headers)!
  const atkStrip = dex?.figani?.attack;
  const bc = atkStrip?.sfxBankCode ?? 0;
  const bankChunk =
    atkStrip?.sfxBankChunk && atkStrip.sfxBankChunk > 0
      ? atkStrip.sfxBankChunk
      : bc >= 1 && bc <= FIGANI_SFX_BANK_TABLE.length
        ? FIGANI_SFX_BANK_TABLE[bc - 1]
        : 0;
  const frames = atkStrip?.frames ?? [];
  let launchSfx: SfxKind | null = null;
  const hitSfxList: SfxKind[] = [];
  if (bankChunk > 0) {
    for (const fr of frames) {
      const subIdx = fr.hitFlag ?? 0;
      const isImpact = Boolean(fr.sfx && fr.sfx !== 0);
      if (isImpact) {
        if (subIdx > 0) {
          hitSfxList.push(`bank:${bankChunk}:${subIdx}` as SfxKind);
        }
      } else if (subIdx > 0 && !launchSfx) {
        launchSfx = `bank:${bankChunk}:${subIdx}` as SfxKind;
      }
    }
  }
  const isMounted = Boolean(
    dex?.classNameZh?.includes('騎士') || entry.classEn.toLowerCase().includes('knight')
  );
  const stepSfx: SfxKind = isFlying ? 'step_wing' : isMounted ? 'step_horse' : 'step_foot';

  // Elemental spell banks (`FDOTHER.DAT[82..94]`): Fire Dragon `83`, Holy Seraphim `91`, Thunder `85`, Ice `87`, Arcane `88`
  let magicChantSfx: SfxKind = 'bank:83:0';
  let magicHitSfx: SfxKind[] = ['bank:83:3', 'bank:83:1', 'bank:83:2'];
  if (magicElement === 'holy') {
    magicChantSfx = 'bank:91:0';
    magicHitSfx = ['bank:91:1', 'bank:91:1'];
  } else if (magicElement === 'thunder') {
    magicChantSfx = 'bank:85:0';
    magicHitSfx = ['bank:85:1', 'bank:86:1', 'bank:87:3'];
  } else if (magicElement === 'ice') {
    magicChantSfx = 'bank:87:0';
    magicHitSfx = ['bank:87:2', 'bank:87:3'];
  } else if (magicElement === 'arcane') {
    magicChantSfx = 'bank:88:0';
    magicHitSfx = ['bank:88:1', 'bank:89:1'];
  }

  const sfxProfile: UnitSfxProfile = {
    bankChunk,
    stepSfx,
    launchSfx,
    hitSfxList,
    magicChantSfx,
    magicHitSfx,
  };

  // Auto-derive authentic 1995 DOS FIGANI.DAT aerial prelude pattern from per-frame (ox, oy, w, h, delay, sfx)!
  let flightPattern: FlightPattern | undefined = entry.flightPattern;
  if (!flightPattern && isFlying && frames.length >= 4) {
    const firstHitIdx = frames.findIndex((fr) => Boolean(fr.sfx && fr.sfx !== 0));
    const preEnd = firstHitIdx > 0 ? firstHitIdx : frames.length;
    const pre = frames.slice(0, preEnd);
    const realPre = pre.filter((fr) => !(fr.w >= 316 && fr.h >= 196 && !fr.sfx));
    const init = realPre[0] ?? frames[0];
    const initBot = init.oy + init.h;
    const minPreBot = realPre.reduce((m, fr) => Math.min(m, fr.oy + fr.h), initBot);
    const maxPreOy = realPre.reduce((m, fr) => Math.max(m, fr.oy), init.oy);
    const minPreOx = realPre.reduce((m, fr) => Math.min(m, fr.ox), init.ox);
    const maxPreDelay = pre.reduce((m, fr) => Math.max(m, fr.delay ?? 0), 0);
    const hitFrame = firstHitIdx >= 0 ? frames[firstHitIdx] : null;
    const post = firstHitIdx >= 0 ? frames.slice(firstHitIdx + 1) : [];
    const minPostBot = post
      .filter((fr) => !(fr.w >= 316 && fr.h >= 196))
      .reduce((m, fr) => Math.min(m, fr.oy + fr.h), 200);

    if (maxPreOy - init.oy >= 45 && (!hitFrame || hitFrame.oy <= 10) && minPostBot <= 80) {
      // Low ground-skim dip -> soaring skyward upward slash (e.g., #055 Lorna Dragon Knight!)
      flightPattern = 'dip_rise';
    } else if (init.ox >= 100 && minPreOx <= 10 && maxPreDelay >= 4 && initBot - minPreBot < 140) {
      // Low horizontal wing-dash past screen edge -> brief blur -> cross-slash return (#016 Kailas, #026!)
      flightPattern = 'dash_past';
    } else if (initBot - minPreBot >= 35) {
      // High climbing wing-flap prelude -> steep diagonal dive-bomb (#020 Sara, #054, #056, #027, #049!)
      flightPattern = 'climb_dive';
    } else {
      // Buoyant hover bob -> crisp horizontal aerial swoop (#017 Miasdod, #073, #086!)
      flightPattern = 'hover_swoop';
    }
  }

  // Auto-count exact DOS impact frames (`fr.sfx !== 0`) for remote ranged units so future snipers/archers match DOS automatically!
  const dosImpactCount = frames.filter((fr) => Boolean(fr.sfx && fr.sfx !== 0)).length;
  const rangedBurstCount =
    entry.rangedBurstCount ?? (isRemote && dosImpactCount > 1 ? dosImpactCount : undefined);

  return {
    ...entry,
    isRemote,
    projectileType,
    rangedBurstCount,
    hasMagic,
    magicElement,
    isFlying,
    flightPattern,
    sfxProfile,
  };
}

export async function loadTerrainBgIntoVfxAssets(
  target: VfxLabAssets,
  side: 'hero' | 'enemy',
  bgId: number
): Promise<HTMLImageElement | null> {
  if (side === 'hero') target.heroBgId = bgId;
  else target.enemyBgId = bgId;

  const cached = target.bgImages.get(bgId);
  if (cached) return cached;

  try {
    const img = await loadImg(`assets/hd_bgs/bg_${bgId}.png`);
    target.bgImages.set(bgId, img);
    return img;
  } catch {
    return target.forestBg;
  }
}

export async function loadUnitSlotIntoVfxAssets(
  assets: AssetManager,
  target: VfxLabAssets,
  side: 'player' | 'enemy',
  rawEntry: VfxManifestUnitEntry
): Promise<void> {
  target.assetManager = assets;
  const entry = enrichUnitMetadataFromGameData(assets, rawEntry);
  const cb = VFX_ASSET_VERSION;
  const omniCount = Math.max(10, entry.omniFrameCount ?? 10);
  const omniIndices = Array.from({ length: omniCount }, (_, i) => i);
  const [nb6, omni, rangedPoses, chantPoses, rangedProj, cutIn, cIdle, cAtk] = await Promise.all([
    Promise.all([0, 1, 2, 3, 4, 5].map((i) => loadImg(`${entry.dir}/nb6_${i}.webp${cb}`))),
    Promise.all(omniIndices.map((i) => loadImg(`${entry.dir}/omni_${i}.webp${cb}`))),
    side === 'player' && entry.rangedSkill
      ? Promise.all(
          Array.from({ length: entry.rangedSkill.frameCount }, (_, i) =>
            loadImg(`${entry.dir}/ranged_${i}.webp${cb}`).catch(() => null)
          )
        ).then((arr) => arr.filter((x): x is HTMLImageElement => Boolean(x)))
      : Promise.resolve([] as HTMLImageElement[]),
    side === 'player' && entry.hasChantAnim
      ? Promise.all(
          [0, 1, 2, 3, 4, 5].map((i) => loadImg(`${entry.dir}/chant_${i}.webp${cb}`).catch(() => null))
        ).then((arr) => arr.filter((x): x is HTMLImageElement => Boolean(x)))
      : Promise.resolve([] as HTMLImageElement[]),
    side === 'player' &&
    (entry.rangedSkill?.mode === 'sonic_crescent' || entry.rangedSkill?.mode === 'flame_blade_beam')
      ? loadImg(`${entry.dir}/ranged_proj.webp${cb}`).catch(() => null)
      : Promise.resolve(null),
    loadImg(`${entry.dir}/cutin.jpg${cb}`).catch(() => null),
    assets.loadUnitFigAni(entry.uid, 'idle').catch(() => null),
    assets.loadUnitFigAni(entry.uid, 'attack').catch(() => null),
  ]);

  if (side === 'player') {
    target.rightUnit = entry;
    target.rightCutIn = cutIn;
    target.thorNb6Poses = nb6;
    target.thorPoses = [nb6[0], nb6[2], nb6[3]];
    target.thorOmniPoses = omni;
    target.thorRangedPoses = rangedPoses;
    target.thorChantPoses = chantPoses;
    target.thorRangedProj = rangedProj;
    target.classicThorIdle = cIdle;
    target.classicThorAtk = cAtk;
  } else {
    target.leftUnit = entry;
    target.leftCutIn = cutIn;
    target.banditNb6Poses = nb6;
    target.banditPoses = [nb6[0], nb6[2], nb6[3]];
    target.banditOmniPoses = omni;
    target.classicBanditIdle = cIdle;
    target.classicBanditAtk = cAtk;
  }
}

export async function ensureVfxLabAssets(assets: AssetManager): Promise<VfxLabAssets> {
  vfxAssetsCache.assetManager = assets;
  // Always refresh manifest so newly refactored batch units appear immediately
  try {
    const resp = await fetch(`assets/vfx_lab/units_manifest.json?t=${Date.now()}`);
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data?.units) && data.units.length > 0) {
        vfxAssetsCache.manifestUnits = data.units.map((u: VfxManifestUnitEntry) =>
          enrichUnitMetadataFromGameData(assets, u)
        );
      }
    }
  } catch {
    // fallback to default manifest units
  }

  if (vfxAssetsCache.loaded) {
    return vfxAssetsCache;
  }

  const defaultRight =
    vfxAssetsCache.manifestUnits.find((u) => u.uid === 0) ||
    vfxAssetsCache.manifestUnits.find((u) => u.side === 'player') ||
    DEFAULT_RIGHT_UNIT;
  const defaultLeft =
    vfxAssetsCache.manifestUnits.find((u) => u.uid === 96) ||
    vfxAssetsCache.manifestUnits.find((u) => u.side === 'enemy') ||
    DEFAULT_LEFT_UNIT;

  const [forestBg] = await Promise.all([
    loadTerrainBgIntoVfxAssets(vfxAssetsCache, 'hero', vfxAssetsCache.heroBgId),
    loadTerrainBgIntoVfxAssets(vfxAssetsCache, 'enemy', vfxAssetsCache.enemyBgId),
    loadUnitSlotIntoVfxAssets(assets, vfxAssetsCache, 'player', defaultRight),
    loadUnitSlotIntoVfxAssets(assets, vfxAssetsCache, 'enemy', defaultLeft),
  ]);
  void ensureHdSpellAssets(VFX_ASSET_VERSION);

  vfxAssetsCache.forestBg = forestBg;
  vfxAssetsCache.loaded = true;
  return vfxAssetsCache;
}

export type DuelScenario = 'thor_first_duel' | 'bandit_first_duel' | 'thor_crit' | 'bandit_crit' | 'hero_magic' | 'hero_skill';

interface PoseRenderSpec {
  primaryIdx: number;
  secondaryIdx?: number;
  blend?: number; // 0..1 cross-fade / sub-frame swing blend
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rot: number;
  flashWhite: number;
  afterimages: number;
  dashDirX: number;
  dashDirY: number;
  opacity?: number;
}

/**
 * Self-contained 60fps Modern 2.5D Anime VFX Combat Renderer for Thor (#0) vs. Bandit (#96).
 * Preserves the authentic Flame Dragon II diagonal isometric battle stage:
 *  - Left Enemy (Bandit #96) at Top-Left facing diagonally Down-Right (↘), HUD at Bottom-Left
 *  - Right Hero (Thor #0) at Bottom-Right facing diagonally Up-Left (↖, 3/4 rear view), HUD at Top-Right
 *  - Smooth HP/MP bar drain from Green (right full end) -> Yellow (middle) -> Red (left 0-HP anchor)
 */
export class Modern25DCombatRenderer {
  private sparks: VfxSpark[] = [];
  private dust: VfxDust[] = [];
  private leaves: VfxLeaf[] = [];
  private scenario: DuelScenario = 'thor_first_duel';
  private elapsedMs = 0;
  private hitStopRemainingMs = 0;
  private triggeredEvents = new Set<string>();

  private thorMaxHp = 38;
  private thorTargetHp = 38;
  private thorDisplayedHp = 38;
  private thorMaxMp = 10;
  private thorMp = 10;

  private banditMaxHp = 35;
  private banditTargetHp = 35;
  private banditDisplayedHp = 35;
  private banditMaxMp = 0;
  private banditMp = 0;

  private thorStrikeDmg = 22;
  private banditStrikeDmg = 7;

  // Reusable offscreen scratch canvas so hit-flash & afterimage tinting only affects
  // the character sprite's own alpha silhouette (never painting a square over the background).
  private spriteTintCanvas: HTMLCanvasElement | null = null;
  private spriteTintCtx: CanvasRenderingContext2D | null = null;
  private activeStageBadge = '';
  /** Optional explicit Phase B HD spell/summon override (`null` = auto signature spell for caster). */
  public previewSpellId: number | null = null;

  constructor(
    private vfxAssets: VfxLabAssets,
    private sound: SoundEngine,
    public config: ModernVfxConfig = {
      animSource: 'omni_video',
      enableParallaxAndGodRays: true,
      enableAfterimagesAndSpring: true,
      enableVolumetricSlash: true,
      enableAnimeCutIn: true,
      enableHitStopAndSparks: true,
      slowMotion: false,
    }
  ) {
    this.initAmbientLeaves();
  }

  private getActivePoseList(unit: 'thor' | 'bandit'): HTMLImageElement[] {
    if (this.config.animSource === 'omni_video') {
      return unit === 'thor' ? this.vfxAssets.thorOmniPoses : this.vfxAssets.banditOmniPoses;
    }
    if (this.config.animSource === 'nb2_6frame') {
      return unit === 'thor' ? this.vfxAssets.thorNb6Poses : this.vfxAssets.banditNb6Poses;
    }
    return unit === 'thor' ? this.vfxAssets.thorPoses : this.vfxAssets.banditPoses;
  }

  private setContinuousFrame(spec: PoseRenderSpec, floatIdx: number, maxIdx: number): void {
    const clamped = Math.max(0, Math.min(maxIdx, floatIdx));
    const idx0 = Math.floor(clamped);
    const idx1 = Math.min(maxIdx, idx0 + 1);
    const frac = clamped - idx0;
    spec.primaryIdx = idx0;
    if (idx1 !== idx0 && frac > 0.02 && this.config.enableAfterimagesAndSpring) {
      spec.secondaryIdx = idx1;
      spec.blend = frac;
    } else {
      spec.secondaryIdx = undefined;
      spec.blend = 0;
    }
  }

  private initAmbientLeaves(): void {
    this.leaves = [];
    for (let i = 0; i < 28; i++) {
      this.leaves.push({
        x: Math.random() * 1600,
        y: Math.random() * 900,
        vx: -28 - Math.random() * 45,
        vy: 18 + Math.random() * 32,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 3.2,
        size: 6 + Math.random() * 10,
        hue: 85 + Math.random() * 45,
        depth: 0.6 + Math.random() * 0.85,
      });
    }
  }

  public startScenario(scenario: DuelScenario): void {
    this.scenario = scenario;
    this.elapsedMs = 0;
    this.hitStopRemainingMs = 0;
    this.triggeredEvents.clear();
    this.sparks = [];
    this.dust = [];

    this.thorMaxHp = 38;
    this.thorTargetHp = 38;
    this.thorDisplayedHp = 38;
    this.thorMaxMp = 10;
    this.thorMp = 10;

    this.banditMaxHp = 35;
    this.banditTargetHp = 35;
    this.banditDisplayedHp = 35;
    this.banditMaxMp = 0;
    this.banditMp = 0;

    this.thorStrikeDmg = scenario === 'thor_crit' ? 35 : scenario === 'hero_magic' || scenario === 'hero_skill' ? 28 : 22;
    this.banditStrikeDmg = scenario === 'bandit_crit' ? 28 : 7;
    this.activeStageBadge = '';
  }

  private hasLongFlyPrelude(unit: VfxManifestUnitEntry): boolean {
    if (!unit.isFlying || unit.isRemote) return false;
    const p = unit.flightPattern;
    return p === 'climb_dive' || p === 'dip_rise' || p === 'dash_past' || p === 'soar_plunge' || p === 'sky_strafe';
  }

  public getTotalDurationMs(): number {
    if (this.scenario === 'hero_magic') {
      const caster = this.vfxAssets.rightUnit;
      const el = caster.magicElement ?? 'fire';
      const sid = this.previewSpellId ?? defaultSpellIdForUnit(caster.uid, el, caster.magicNameZh);
      const sp = getHdSpellEntry(sid);
      return sp ? 1380 + sp.durationMs + 340 : 3150;
    }
    if (this.scenario === 'hero_skill') {
      const sk = this.vfxAssets.rightUnit.rangedSkill;
      if (sk?.mode === 'hero_chant') return 3150;
      if (sk?.mode === 'radiant_blade_cone') return 2950;
      return sk?.isRemote ? 2950 : 2550;
    }
    const heroFlyExtra = this.hasLongFlyPrelude(this.vfxAssets.rightUnit)
      ? 330
      : this.vfxAssets.rightUnit.stationaryBeam
        ? 290
        : 0;
    if (this.scenario === 'thor_crit') {
      return this.vfxAssets.rightUnit.isRemote ? 2850 : 2600 + heroFlyExtra;
    }
    if (this.scenario === 'bandit_crit') {
      return this.vfxAssets.leftUnit.isRemote ? 2850 : 2600;
    }
    if (this.vfxAssets.rightUnit.isRemote || this.vfxAssets.leftUnit.isRemote) {
      return 4850;
    }
    return 4400 + heroFlyExtra;
  }

  public isFinished(): boolean {
    return this.elapsedMs >= this.getTotalDurationMs();
  }

  private fireOnce(key: string, fn: () => void): void {
    if (!this.triggeredEvents.has(key)) {
      this.triggeredEvents.add(key);
      fn();
    }
  }

  private spawnImpactSparks(
    cx: number,
    cy: number,
    groundY: number,
    count: number,
    palette: string[],
    dirBiasX: number,
    dirBiasY: number
  ): void {
    if (!this.config.enableHitStopAndSparks) return;
    for (let i = 0; i < count; i++) {
      const angle = (Math.random() - 0.5) * Math.PI * 1.45 + (dirBiasX < 0 ? Math.PI : 0);
      const speed = 260 + Math.random() * 760;
      this.sparks.push({
        x: cx + (Math.random() - 0.5) * 24,
        y: cy + (Math.random() - 0.5) * 24,
        vx: Math.cos(angle) * speed + dirBiasX * 150,
        vy: Math.sin(angle) * speed - 160 - Math.random() * 200 + dirBiasY * 90,
        size: 2.2 + Math.random() * 4.5,
        color: palette[i % palette.length],
        alpha: 1,
        life: 0,
        maxLife: 320 + Math.random() * 450,
        bounces: 0,
        groundY,
      });
    }
  }

  private spawnDustPlume(x: number, y: number, dirX: number, dirY: number, count = 10): void {
    if (!this.config.enableHitStopAndSparks) return;
    for (let i = 0; i < count; i++) {
      this.dust.push({
        x: x + (Math.random() - 0.5) * 38,
        y: y + (Math.random() - 0.5) * 14,
        vx: dirX * (60 + Math.random() * 180) + (Math.random() - 0.5) * 55,
        vy: dirY * (30 + Math.random() * 80) - 25 - Math.random() * 55,
        radius: 15 + Math.random() * 22,
        growRate: 45 + Math.random() * 55,
        alpha: 0.52 + Math.random() * 0.25,
        color: i % 2 === 0 ? 'rgba(218, 202, 168, 1)' : 'rgba(175, 162, 134, 1)',
      });
    }
  }

  /** Cool swirling pale-sky/white wing-beat wind gusts for airborne Dragon Knights & Dragonkin! */
  private spawnAirGustPlume(x: number, y: number, dirX: number, dirY: number, count = 10): void {
    if (!this.config.enableHitStopAndSparks) return;
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 2.0;
      this.dust.push({
        x: x + (Math.random() - 0.5) * 95,
        y: y + (Math.random() - 0.5) * 34,
        vx: dirX * (90 + Math.random() * 210) + spread * 120,
        vy: dirY * (70 + Math.random() * 140) + 45 + Math.random() * 65,
        radius: 14 + Math.random() * 26,
        growRate: 62 + Math.random() * 75,
        alpha: 0.42 + Math.random() * 0.22,
        color: i % 2 === 0 ? 'rgba(224, 242, 254, 1)' : 'rgba(241, 245, 249, 1)',
      });
    }
  }

  public stepAndRender(ctx: CanvasRenderingContext2D, rawDtMs: number, splitCompareClassic = false): void {
    const dtMs = Math.min(50, rawDtMs) * (this.config.slowMotion ? 0.32 : 1.0);
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;

    if (this.hitStopRemainingMs > 0) {
      this.hitStopRemainingMs = Math.max(0, this.hitStopRemainingMs - dtMs);
    } else {
      this.elapsedMs += dtMs;
      this.updateParticlesAndBars(dtMs, W, H);
    }

    if (splitCompareClassic) {
      ctx.save();
      this.renderModernScene(ctx, W, H);
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, Math.floor(W * 0.48), H);
      ctx.clip();
      this.renderClassic1995Scene(ctx, W, H);
      ctx.restore();

      const splitX = Math.floor(W * 0.48);
      ctx.save();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, H);
      ctx.stroke();

      ctx.fillStyle = 'rgba(12, 14, 22, 0.88)';
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.fillRect(18, 18, 290, 36);
      ctx.strokeRect(18, 18, 290, 36);
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 15px monospace';
      ctx.fillText('◀ 1995 DOS VGA (320×200 Indexed)', 30, 41);

      ctx.fillStyle = 'rgba(12, 14, 22, 0.88)';
      ctx.fillRect(splitX + 18, 18, 340, 36);
      ctx.strokeRect(splitX + 18, 18, 340, 36);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('2026 Modern 2.5D Anime VFX Engine ▶', splitX + 30, 41);
      ctx.restore();
    } else {
      this.renderModernScene(ctx, W, H);
    }
  }

  private updateParticlesAndBars(dtMs: number, W: number, H: number): void {
    const dt = dtMs / 1000;

    // Smoothly drain displayed HP from Green right tip toward Red left anchor (~38 HP/sec)
    const drainRate = 38 * dt;
    if (this.banditDisplayedHp > this.banditTargetHp) {
      this.banditDisplayedHp = Math.max(this.banditTargetHp, this.banditDisplayedHp - drainRate);
    }
    if (this.thorDisplayedHp > this.thorTargetHp) {
      this.thorDisplayedHp = Math.max(this.thorTargetHp, this.thorDisplayedHp - drainRate);
    }

    for (const leaf of this.leaves) {
      leaf.x += leaf.vx * leaf.depth * dt;
      leaf.y += leaf.vy * leaf.depth * dt + Math.sin(this.elapsedMs * 0.003 + leaf.hue) * 12 * dt;
      leaf.rot += leaf.vRot * dt;
      if (leaf.x < -40) leaf.x = W + 30;
      if (leaf.y > H + 40) {
        leaf.y = -30;
        leaf.x = Math.random() * W;
      }
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life += dtMs;
      if (s.life >= s.maxLife) {
        this.sparks.splice(i, 1);
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= Math.pow(0.92, dt * 60);
      s.vy += 1650 * dt;
      if (s.y >= s.groundY && s.vy > 0 && s.bounces < 2) {
        s.y = s.groundY;
        s.vy = -s.vy * 0.46;
        s.vx *= 0.78;
        s.bounces++;
      }
      s.alpha = Math.max(0, 1 - s.life / s.maxLife);
    }

    for (let i = this.dust.length - 1; i >= 0; i--) {
      const d = this.dust[i];
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vx *= Math.pow(0.9, dt * 60);
      d.radius += d.growRate * dt;
      d.alpha -= 0.72 * dt;
      if (d.alpha <= 0) {
        this.dust.splice(i, 1);
      }
    }
  }

  private getPhaseStartTimes(): { thorStart: number; banditStart: number; thorDur: number; banditDur: number } {
    const thorDur = this.vfxAssets.rightUnit.isRemote
      ? 2450
      : this.hasLongFlyPrelude(this.vfxAssets.rightUnit)
        ? 2160
        : this.vfxAssets.rightUnit.stationaryBeam
          ? 2120
          : 1830;
    const banditDur = this.vfxAssets.leftUnit.isRemote ? 2450 : 1850;
    if (this.scenario === 'hero_magic') {
      return { thorStart: 120, banditStart: -1, thorDur: 2950, banditDur: 0 };
    }
    if (this.scenario === 'hero_skill') {
      const sk = this.vfxAssets.rightUnit.rangedSkill;
      return { thorStart: 120, banditStart: -1, thorDur: sk?.isRemote ? 2800 : 2400, banditDur: 0 };
    }
    if (this.scenario === 'bandit_first_duel') {
      return { banditStart: 220, thorStart: 220 + banditDur + 140, thorDur, banditDur };
    }
    if (this.scenario === 'bandit_crit') {
      return { banditStart: 220, thorStart: -1, thorDur, banditDur };
    }
    if (this.scenario === 'thor_crit') {
      return { thorStart: 220, banditStart: -1, thorDur, banditDur };
    }
    return { thorStart: 220, banditStart: 220 + thorDur + 140, thorDur, banditDur };
  }

  private renderClassic1995Scene(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    // Emulate exact 1995 320x200 diagonal battle stage (BG.DAT at y=50..150 + right-hand TAI.DAT at (320-w, 156))
    // Supports authentic 1-stage shared melee, 3-stage ranged cutaway (with BG[0..2] speed-line strips!), and 2-stage magic!
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#05080c';
    ctx.fillRect(0, 0, W, H);

    const scaleX = W / 320;
    const scaleY = H / 200;
    const am = this.vfxAssets.assetManager;
    const heroBgId = this.vfxAssets.heroBgId;
    const enemyBgId = this.vfxAssets.enemyBgId;

    const t = this.elapsedMs;
    const { thorStart, banditStart, thorDur, banditDur } = this.getPhaseStartTimes();

    const cThorIdle = this.vfxAssets.classicThorIdle;
    const cThorAtk = this.vfxAssets.classicThorAtk;
    const cBanditIdle = this.vfxAssets.classicBanditIdle;
    const cBanditAtk = this.vfxAssets.classicBanditAtk;

    const drawClassicBgAndTai = (bgId: number, showHeroTai: boolean) => {
      if (am) {
        ctx.save();
        ctx.scale(scaleX, scaleY);
        am.drawBattleBg(ctx, bgId, 0, 50, 320, 100);
        if (showHeroTai && !this.vfxAssets.rightUnit.isFlying) {
          const rightTai = am.gameData.taiPlatforms?.[heroBgId];
          if (rightTai && rightTai.valid) {
            am.drawTaiPlatform(ctx, heroBgId, 320 - rightTai.w, 156, false);
          }
        }
        ctx.restore();
      } else {
        const bgImg = this.vfxAssets.bgImages.get(bgId) ?? this.vfxAssets.forestBg;
        if (bgImg) {
          ctx.drawImage(bgImg, 0, 50 * scaleY, W, 100 * scaleY);
        }
      }
    };

    // Draw using exact FD2.EXE `f.ox, f.oy` 320x200 screen coordinates!
    const drawClassicFigExact = (
      bundle: ClassicFigBundle | null,
      fIdx: number,
      slideX: number,
      slideY: number,
      flash = false
    ) => {
      if (!bundle || bundle.strip.frames.length === 0) return;
      const frames = bundle.strip.frames;
      const f = frames[Math.max(0, Math.min(frames.length - 1, fIdx))];
      const imgScale = bundle.img.naturalHeight / Math.max(1, bundle.strip.stripH);
      const sx = f.sx * imgScale;
      const sw = f.w * imgScale;
      const sh = f.h * imgScale;
      const dx = (f.ox + slideX) * scaleX;
      const dy = (f.oy + slideY) * scaleY;
      const dw = f.w * scaleX;
      const dh = f.h * scaleY;
      ctx.save();
      if (flash) {
        ctx.filter = 'brightness(2.6) contrast(1.4)';
      }
      ctx.drawImage(bundle.img, sx, 0, sw, sh, dx, dy, dw, dh);
      ctx.restore();
    };

    // Case A: Classic 2-Stage Magic Cutaway (`hero_magic`)
    if (this.scenario === 'hero_magic') {
      const localT = Math.max(0, t - thorStart);
      if (localT < 1380) {
        // Stage 1: Caster alone on Hero's tile terrain
        drawClassicBgAndTai(heroBgId, true);
        const strip = cThorAtk ?? cThorIdle;
        const fCount = Math.max(1, strip?.strip.frames.length ?? 1);
        const fIdx = Math.min(fCount - 1, Math.floor((localT / 1380) * fCount));
        drawClassicFigExact(strip, fIdx, 0, 0, false);
      } else {
        // Stage 2: Target alone on Enemy's tile terrain
        drawClassicBgAndTai(enemyBgId, false);
        const s2 = localT - 1380;
        const slideInX = s2 < 180 ? -Math.round((1 - s2 / 180) * 140) : 0;
        const hitPulse = s2 >= 320 && s2 < 950;
        const recoil = hitPulse ? -Math.round(Math.abs(Math.sin((s2 - 320) * 0.025)) * 16) : 0;
        const isFlash = hitPulse && Math.floor((s2 - 320) / 160) % 2 === 0 && ((s2 - 320) % 160) < 70;
        drawClassicFigExact(cBanditIdle, 0, slideInX + recoil, 0, isFlash);
      }
      ctx.restore();
      this.drawModernDualHud(ctx, W, H);
      return;
    }

    // Case B: Classic 3-Stage Ranged Cutaway (`isRemote = true`, e.g., #008 Celia!)
    const isHeroRemoteActive =
      this.vfxAssets.rightUnit.isRemote &&
      thorStart >= 0 &&
      (this.scenario === 'thor_crit' ||
        (t >= thorStart && t < thorStart + thorDur) ||
        (this.scenario === 'thor_first_duel' && t < thorStart)) &&
      cThorAtk &&
      cThorAtk.strip.frames.length > 0;
    if (isHeroRemoteActive && cThorAtk) {
      const localT = Math.max(0, Math.min(thorDur, t - thorStart));
      const split = cThorAtk.strip.splitFrame && cThorAtk.strip.splitFrame > 0 && cThorAtk.strip.splitFrame < cThorAtk.strip.frames.length
        ? cThorAtk.strip.splitFrame
        : Math.max(1, cThorAtk.strip.frames.length - 5);
      if (localT < 1120) {
        // Stage 1: Attacker solo on Hero's tile terrain
        drawClassicBgAndTai(heroBgId, true);
        const p = Math.min(0.999, localT / 1120);
        const fIdx = Math.floor(p * split);
        drawClassicFigExact(cThorAtk, fIdx, 0, 0, false);
      } else if (localT < 1460) {
        // Stage 2: Authentic 1995 horizontal speed-line strips BG.DAT[0..2]!
        const bIdx = Math.floor((localT - 1120) / 60) % 3;
        drawClassicBgAndTai(bIdx, false);
      } else {
        // Stage 3: Target solo on Enemy's tile terrain + arriving DOS missile frames [split..end-1]
        drawClassicBgAndTai(enemyBgId, false);
        const p3 = Math.min(0.999, (localT - 1460) / (thorDur - 1460));
        const missileCount = Math.max(1, cThorAtk.strip.frames.length - split);
        const mIdx = split + Math.min(missileCount - 1, Math.floor(p3 * missileCount * 1.4));
        const hitP = Math.max(0, (p3 - 0.19) / 0.35);
        const recoilX = p3 >= 0.19 && hitP <= 1 ? -Math.round(Math.sin(hitP * Math.PI) * 18) : 0;
        const isFlash = p3 >= 0.19 && p3 < 0.28;
        drawClassicFigExact(cBanditIdle, 0, recoilX, 0, isFlash);
        if (p3 < 0.68) {
          drawClassicFigExact(cThorAtk, mIdx, 0, 0, false);
        }
      }
      ctx.restore();
      this.drawModernDualHud(ctx, W, H);
      return;
    }

    // Default: Authentic 1-Stage Shared Melee (`BG[enemyBgId]` + right-hand `TAI[heroBgId]`)
    drawClassicBgAndTai(enemyBgId, true);

    let thorSprite = cThorIdle;
    let thorFrameIdx = Math.floor(t / 180) % Math.max(1, cThorIdle?.strip.frames.length ?? 1);
    let thorRecoilX = 0;
    let thorRecoilY = 0;
    let thorFlash = false;

    let banditSprite = cBanditIdle;
    let banditFrameIdx = Math.floor(t / 180) % Math.max(1, cBanditIdle?.strip.frames.length ?? 1);
    let banditRecoilX = 0;
    let banditRecoilY = 0;
    let banditFlash = false;

    if (thorStart >= 0 && t >= thorStart && t < thorStart + thorDur && cThorAtk && cThorAtk.strip.frames.length > 0) {
      thorSprite = cThorAtk;
      const p = Math.min(0.999, (t - thorStart) / Math.max(1, thorDur - 100));
      thorFrameIdx = Math.floor(p * cThorAtk.strip.frames.length);
      if (p >= 0.52 && p <= 0.78) {
        const rp = Math.sin(((p - 0.52) / 0.26) * Math.PI);
        banditRecoilX = -Math.round(rp * 16);
        banditRecoilY = -Math.round(rp * 8);
        banditFlash = p < 0.6;
      }
    }

    if (
      banditStart >= 0 &&
      t >= banditStart &&
      t < banditStart + banditDur &&
      cBanditAtk &&
      cBanditAtk.strip.frames.length > 0
    ) {
      banditSprite = cBanditAtk;
      const p = Math.min(0.999, (t - banditStart) / Math.max(1, banditDur - 100));
      banditFrameIdx = Math.floor(p * cBanditAtk.strip.frames.length);
      if (p >= 0.52 && p <= 0.78) {
        const rp = Math.sin(((p - 0.52) / 0.26) * Math.PI);
        thorRecoilX = Math.round(rp * 16);
        thorRecoilY = Math.round(rp * 8);
        thorFlash = p < 0.6;
      }
    }

    drawClassicFigExact(banditSprite, banditFrameIdx, banditRecoilX, banditRecoilY, banditFlash);
    drawClassicFigExact(thorSprite, thorFrameIdx, thorRecoilX, thorRecoilY, thorFlash);
    ctx.restore();

    this.drawModernDualHud(ctx, W, H);
  }

  private renderModernScene(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const t = this.elapsedMs;
    const { thorStart, banditStart, thorDur, banditDur } = this.getPhaseStartTimes();

    // 1. Dedicated 2-Stage Remote Magic Cutaway (`hero_magic`: Caster Solo -> Target Solo + Elemental Spell)
    if (this.scenario === 'hero_magic') {
      this.renderModernMagicScene(ctx, W, H, thorStart);
      return;
    }

    // 1b. Dedicated Phase A Secondary Hero Skill / Spell-Chanting Scene (`ranged_0..5.webp`)
    if (this.scenario === 'hero_skill') {
      this.renderHeroSkillScene(ctx, W, H, thorStart);
      return;
    }

    // 2. Dedicated 3-Stage Ranged Cutaway (`isRemote = true`, e.g., #008 Celia, #013 Beckwith, Snipers!)
    //    Stage 1: Attacker Solo on Attacker's Terrain -> Stage 2: HD Horizontal Speed-Line Transit Bridge -> Stage 3: Target Solo on Target's Terrain
    if (this.vfxAssets.rightUnit.isRemote && thorStart >= 0) {
      const inHeroRange =
        this.scenario === 'thor_crit' ||
        (t >= thorStart && t < thorStart + thorDur) ||
        (this.scenario === 'thor_first_duel' && t < thorStart);
      if (inHeroRange) {
        const localT = Math.max(0, Math.min(thorDur, t - thorStart));
        this.renderModernRangedAttackScene(ctx, W, H, 'hero', localT, thorDur, this.scenario === 'thor_crit');
        return;
      }
    }
    if (this.vfxAssets.leftUnit.isRemote && banditStart >= 0) {
      const inEnemyRange =
        this.scenario === 'bandit_crit' ||
        (t >= banditStart && t < banditStart + banditDur) ||
        (this.scenario === 'bandit_first_duel' && t < banditStart);
      if (inEnemyRange) {
        const localT = Math.max(0, Math.min(banditDur, t - banditStart));
        this.renderModernRangedAttackScene(ctx, W, H, 'enemy', localT, banditDur, this.scenario === 'bandit_crit');
        return;
      }
    }

    const isEn = getLocale() === 'en';
    const enemyTerrain = getTerrainPreset(this.vfxAssets.enemyBgId);
    this.activeStageBadge = isEn
      ? `⚔️ Melee Unified Stage · ${enemyTerrain.en} (#${enemyTerrain.id})`
      : `⚔️ 近戰統一場景 · ${enemyTerrain.zh} (#${enemyTerrain.id})`;

    // -------------------------------------------------------------------------
    // Authentic Flame Dragon II Diagonal Isometric Battle Geometry:
    //  - Enemy Bandit (#96): Top-Left (x = 0.25W, y = 0.67H), facing Down-Right (↘)
    //  - Hero Thor (#0): Bottom-Right (x = 0.72W, y = 0.90H on TAI), facing Up-Left (↖)
    // -------------------------------------------------------------------------
    const banditHomeX = W * 0.25;
    const banditHomeY = H * 0.67;
    const thorHomeX = W * 0.71;
    const thorHomeY = H * 0.91;

    const breath = this.config.enableAfterimagesAndSpring ? Math.sin(t * 0.0055) * 0.014 : 0;
    const rightIsFlying = Boolean(this.vfxAssets.rightUnit.isFlying);
    const leftIsFlying = Boolean(this.vfxAssets.leftUnit.isFlying);
    const rightFlyPattern: FlightPattern | null = rightIsFlying
      ? (this.vfxAssets.rightUnit.flightPattern ?? 'hover_swoop')
      : null;
    // Calm gentle hover buoyancy while resting idle (avoid erratic bobbing/wobble!)
    const rightHoverBob = rightIsFlying ? -16 + Math.sin(t * 0.0021) * 5 : 0;
    const leftHoverBob = leftIsFlying ? -14 + Math.sin(t * 0.0022 + 1.2) * 5 : 0;

    const thorSpec: PoseRenderSpec = {
      primaryIdx: 0,
      x: thorHomeX,
      y: thorHomeY + rightHoverBob,
      scaleX: 1.0 - breath * 0.5,
      scaleY: 1.0 + breath,
      rot: 0,
      flashWhite: 0,
      afterimages: 0,
      dashDirX: -1,
      dashDirY: -0.48,
      opacity: 1,
    };

    const banditSpec: PoseRenderSpec = {
      primaryIdx: 0,
      x: banditHomeX,
      y: banditHomeY + leftHoverBob,
      scaleX: 1.0,
      scaleY: 1.0 + Math.sin(t * 0.005 + 1.4) * (this.config.enableAfterimagesAndSpring ? 0.014 : 0),
      rot: 0,
      flashWhite: 0,
      afterimages: 0,
      dashDirX: 1,
      dashDirY: 0.48,
      opacity: 1,
    };

    let camX = 0;
    let camY = 0;
    let camZoom = 1.0;
    let camTilt = 0;
    let camShake = 0;

    let slashArcProgress = -1;
    let banditSlashProgress = -1;
    let cutInProgress = -1;
    let cutInUnit: 'thor' | 'bandit' = 'thor';
    let impactFlashAlpha = 0;
    let shockwaveProgress = -1;
    let shockwaveCenter = { x: banditHomeX + 40, y: banditHomeY - 180 };
    let shockwaveGroundY = banditHomeY;
    let aerialSpeedLinesIntensity = 0;
    let aerialSpeedLinesAngle = 0;
    let aerialSpeedLinesRgb = '254, 240, 138';
    let stationaryBeamState: {
      originX: number;
      originY: number;
      targetX: number;
      targetY: number;
      progress: number;
      chargeOnly?: boolean;
      color: 'azure' | 'gold' | 'crimson' | 'emerald';
      style: 'beam' | 'qi_splash';
      thickness: number;
    } | null = null;
    const thorDrawsInFront = true;

    // -------------------------------------------------------------------------
    // Hero Diagonal Up-Left (↖) Strike Sequence (supports Ground, Multi-Hit & Authentic 1995 DOS Flying Preludes!)
    // -------------------------------------------------------------------------
    const srcMode = this.config.animSource;
    const rightHitFrames = this.vfxAssets.rightUnit.hitFrames;
    const isRightMultiHit =
      srcMode === 'omni_video' &&
      Array.isArray(rightHitFrames) &&
      rightHitFrames.length > 1 &&
      this.vfxAssets.thorOmniPoses.length > 10;
    const rightOmniMax = Math.max(1, this.vfxAssets.thorOmniPoses.length - 1);

    const rightStationaryBeam = this.vfxAssets.rightUnit.stationaryBeam;
    if (thorStart >= 0 && t >= thorStart && t < thorStart + thorDur) {
      const localT = t - thorStart;
      if (rightStationaryBeam) {
        // Authentic 1995 DOS Stationary Long-Range Ki/Energy Wave (e.g., #022 Karis `f00..f19`):
        // Fighter stays PLANTED at home right-foreground (`ZERO approaching dash!`), gathers Qi centered
        // in cupped hands, and blasts a thick solid volumetric beam diagonally UP-LEFT (↖) all the way
        // onto the enemy's body with sustained knockback and massive exploding hit splash!
        const thorDispSize = Math.round(720 * (this.vfxAssets.rightUnit.displayScale ?? 1));
        const getBeamOrigin = () => ({
          x: thorSpec.x + (rightStationaryBeam.originAnchor.x - 0.5) * thorDispSize * thorSpec.scaleX,
          y: thorSpec.y + (rightStationaryBeam.originAnchor.y - 648 / 680) * thorDispSize * thorSpec.scaleY,
        });
        const beamColor = rightStationaryBeam.color;
        const beamStyle: 'beam' | 'qi_splash' = rightStationaryBeam.style ?? 'beam';
        const beamThick = rightStationaryBeam.thickness ?? 116;

        if (localT < 500) {
          // 1. Stationary Ryu-style Qi Vortex Gather centered on cupped hands (F0 -> F1)
          const p = localT / 500;
          const ease = 1 - Math.pow(1 - p, 3);
          if (srcMode === 'omni_video') {
            this.setContinuousFrame(thorSpec, p * (beamStyle === 'qi_splash' ? 2.1 : 1.25), rightOmniMax);
          } else if (srcMode === 'nb2_6frame') {
            this.setContinuousFrame(thorSpec, p * (beamStyle === 'qi_splash' ? 2.1 : 1.05), 5);
          } else {
            thorSpec.primaryIdx = p < 0.35 ? 0 : 1;
          }
          thorSpec.x = thorHomeX + ease * 10;
          thorSpec.y = thorHomeY + ease * 4;
          thorSpec.scaleY = 1.0 - Math.sin(p * Math.PI) * 0.035;
          camZoom = 1.0 + ease * 0.05;
          camX = ease * W * 0.03;
          this.fireOnce('beam_gather_sfx', () => {
            const prof = this.vfxAssets.rightUnit.sfxProfile;
            this.sound.playSfx(prof?.launchSfx ?? 'step_foot');
            this.spawnDustPlume(thorHomeX, thorHomeY, 1, 0.3, 10);
          });
          const org = getBeamOrigin();
          stationaryBeamState = {
            originX: org.x,
            originY: org.y,
            targetX: banditHomeX + 35,
            targetY: banditHomeY - 195,
            progress: p * 0.45,
            chargeOnly: true,
            color: beamColor,
            style: beamStyle,
            thickness: beamThick,
          };
        } else if (localT < 880) {
          // 2. Hadouken Launch Sphere Charge IN PLACE + Optional Critical Cut-In (F1 -> F2/F4 crouch)
          const p = (localT - 500) / 380;
          const ease = 1 - Math.pow(1 - p, 2);
          if (this.config.enableAnimeCutIn && this.scenario === 'thor_crit') {
            cutInProgress = p;
            cutInUnit = 'thor';
          }
          if (srcMode === 'omni_video') {
            if (beamStyle === 'qi_splash') {
              // Authentic DOS #044/#062 Kelly crouch spark frame (`omni_3` = F4) held briefly before explosive uppercut!
              this.setContinuousFrame(thorSpec, 2.1 + p * 0.9, rightOmniMax);
            } else {
              this.setContinuousFrame(thorSpec, 1.25 + p * 2.1, rightOmniMax);
            }
          } else if (srcMode === 'nb2_6frame') {
            if (beamStyle === 'qi_splash') {
              this.setContinuousFrame(thorSpec, 2.1 + p * 0.9, 5);
            } else {
              this.setContinuousFrame(thorSpec, 1.05 + p * 1.15, 5);
            }
          } else {
            thorSpec.primaryIdx = 1;
          }
          thorSpec.x = thorHomeX + 10 + ease * 10;
          thorSpec.y = thorHomeY + 4 + ease * 4;
          camZoom = 1.05 + ease * 0.04;
          camX = W * 0.03 * (1 - ease * 0.6);
          const org = getBeamOrigin();
          stationaryBeamState = {
            originX: org.x,
            originY: org.y,
            targetX: banditHomeX + 35,
            targetY: banditHomeY - 195,
            progress: 0.45 + p * 0.55,
            chargeOnly: true,
            color: beamColor,
            style: beamStyle,
            thickness: beamThick,
          };
          this.fireOnce('beam_charge_dust', () => {
            this.spawnDustPlume(thorHomeX, thorHomeY, 1, 0.45, 12);
          });
        } else if (localT < 1720) {
          // 3. MASSIVE UP-LEFT (↖) KI DISCHARGE ACROSS BATTLEFIELD (`beam` tube OR Kelly `qi_splash` rising fan cone!)
          // Attacker remains STATIONARY at thorHomeX with intense ground-brace recoil & skid dust!
          const p = (localT - 880) / 840;
          const isFading = p > 0.78;
          if (srcMode === 'omni_video') {
            if (beamStyle === 'qi_splash') {
              // Authentic DOS F7 -> F8 -> F9 -> F10: instant F5 golden uppercut splash -> bloom -> fading streaks -> crisp F6 stance!
              if (p < 0.22) {
                thorSpec.primaryIdx = Math.min(rightOmniMax, 4);
              } else if (p < 0.44) {
                thorSpec.primaryIdx = Math.min(rightOmniMax, 5);
              } else if (p < 0.68) {
                thorSpec.primaryIdx = Math.min(rightOmniMax, 6);
              } else {
                thorSpec.primaryIdx = Math.min(rightOmniMax, 7);
              }
            } else if (p < 0.72) {
              this.setContinuousFrame(thorSpec, 4.0 + Math.sin(p * Math.PI * 6) * 0.5 + 0.5, rightOmniMax);
            } else if (p < 0.88) {
              this.setContinuousFrame(thorSpec, 6.0 + ((p - 0.72) / 0.16) * 1.5, rightOmniMax);
            } else {
              this.setContinuousFrame(thorSpec, 7.5 + ((p - 0.88) / 0.12) * 1.5, rightOmniMax);
            }
          } else if (srcMode === 'nb2_6frame') {
            if (beamStyle === 'qi_splash') {
              thorSpec.primaryIdx = p < 0.56 ? 4 : 5;
            } else if (p < 0.74) {
              thorSpec.primaryIdx = 3;
            } else if (p < 0.9) {
              thorSpec.primaryIdx = 4;
            } else {
              thorSpec.primaryIdx = 5;
            }
          } else {
            thorSpec.primaryIdx = 2;
          }
          // Heavy recoil brace right on home spot (NO approaching dash toward enemy!)
          const braceRecoil = p < 0.75 ? Math.min(1, p * 6) * (16 + Math.sin(p * 42) * 2.5) : 16 * (1 - (p - 0.75) / 0.25);
          thorSpec.x = thorHomeX + 18 + braceRecoil;
          thorSpec.y = thorHomeY + 6 + braceRecoil * 0.28;
          thorSpec.scaleX = 1.0 + (p < 0.15 ? 0.04 * (1 - p / 0.15) : 0);

          const targetHitX = banditHomeX + 26;
          const targetHitY = banditHomeY - 190;
          const org = getBeamOrigin();
          stationaryBeamState = {
            originX: org.x,
            originY: org.y,
            targetX: targetHitX,
            targetY: targetHitY,
            progress: p,
            chargeOnly: false,
            color: beamColor,
            style: beamStyle,
            thickness: beamThick,
          };

          // Ground shockwave right beneath enemy + skid dust under Karis's braced boots!
          shockwaveProgress = Math.min(1, p * 1.35);
          shockwaveCenter = { x: targetHitX, y: targetHitY };
          shockwaveGroundY = banditHomeY;
          slashArcProgress = -1; // Suppress golden melee sword crescent arc!

          this.fireOnce('beam_impact_1', () => {
            const hitList = this.vfxAssets.rightUnit.sfxProfile?.hitSfxList ?? [];
            const impactSfx: SfxKind = hitList[0] ?? (this.scenario === 'thor_crit' ? 'crit' : 'hit');
            this.sound.playSfx(impactSfx);
            if (this.config.enableHitStopAndSparks) {
              this.hitStopRemainingMs = 75;
            }
            const sparkPal =
              beamColor === 'gold'
                ? ['#ffffff', '#fef9c3', '#fde047', '#f59e0b', '#ea580c']
                : beamColor === 'crimson'
                  ? ['#ffffff', '#fee2e2', '#fb923c', '#ef4444', '#dc2626']
                  : beamColor === 'emerald'
                    ? ['#ffffff', '#d1fae5', '#6ee7b7', '#10b981', '#059669']
                    : ['#ffffff', '#e0f2fe', '#7dd3fc', '#38bdf8', '#2563eb'];
            this.spawnImpactSparks(
              targetHitX,
              targetHitY,
              banditHomeY,
              85,
              sparkPal,
              -1,
              -0.42
            );
            this.spawnDustPlume(banditHomeX, banditHomeY, -1, -0.35, 18);
            this.spawnDustPlume(thorHomeX + 15, thorHomeY + 6, 1, 0.35, 14);
            this.banditTargetHp = Math.max(0, this.banditTargetHp - Math.round(this.thorStrikeDmg * 0.55));
          });
          if (p > 0.34) {
            this.fireOnce('beam_impact_2', () => {
              const sparkPal2 =
                beamColor === 'gold'
                  ? ['#ffffff', '#fef08a', '#facc15', '#f59e0b']
                  : beamColor === 'crimson'
                    ? ['#ffffff', '#fed7aa', '#f97316', '#ef4444']
                    : beamColor === 'emerald'
                      ? ['#ffffff', '#a7f3d0', '#34d399', '#10b981']
                      : ['#ffffff', '#bae6fd', '#38bdf8', '#60a5fa'];
              this.spawnImpactSparks(
                targetHitX - 18,
                targetHitY - 12,
                banditHomeY,
                65,
                sparkPal2,
                -1,
                -0.38
              );
              this.spawnDustPlume(banditHomeX - 24, banditHomeY, -1, -0.35, 14);
              this.spawnDustPlume(thorHomeX + 20, thorHomeY + 6, 1, 0.35, 10);
              this.banditTargetHp = Math.max(
                0,
                this.banditTargetHp - (this.thorStrikeDmg - Math.round(this.thorStrikeDmg * 0.55))
              );
            });
          }

          // Enemy sustained up-left diagonal pushback & white flash under roaring beam pressure!
          const beamTravel = Math.min(1, p / 0.14);
          const sustainRecoil =
            p < 0.78
              ? beamTravel * (46 + Math.sin(p * 55) * 6)
              : 46 * Math.max(0, 1 - (p - 0.78) / 0.22);
          banditSpec.x = banditHomeX - sustainRecoil;
          banditSpec.y = banditHomeY - sustainRecoil * 0.42;
          banditSpec.rot = -(sustainRecoil / 46) * 0.12;
          banditSpec.scaleX = 1.0 - (sustainRecoil / 46) * 0.08;
          banditSpec.scaleY = 1.0 + (sustainRecoil / 46) * 0.06;
          banditSpec.flashWhite =
            p < 0.12
              ? 0
              : p < 0.76
                ? 0.35 + 0.5 * Math.abs(Math.sin(p * 28))
                : Math.max(0, (1 - (p - 0.76) / 0.18) * 0.5);
          impactFlashAlpha = p < 0.18 ? Math.max(0, 1 - p / 0.18) * 0.7 : isFading ? 0 : 0.16;

          // Keep wide cinematic framing so BOTH Karis (right) and Bandit (left) + full beam are 100% visible!
          camZoom = 1.08 - p * 0.04;
          camX = -W * 0.02;
          camY = -H * 0.025;
          camTilt = 0.01 * (1 - p);
          camShake =
            this.config.enableHitStopAndSparks && p >= 0.06 && p < 0.78
              ? (p < 0.26 ? 22 : 12) * (1 - Math.max(0, p - 0.55) * 1.4)
              : 0;
        } else {
          // 4. Clean stationary recovery IN PLACE (F5 -> F0, ZERO sliding return!)
          const p = (localT - 1720) / Math.max(1, thorDur - 1720);
          const ease = 1 - Math.pow(1 - p, 2);
          const endIdx = srcMode === 'omni_video' ? rightOmniMax : srcMode === 'nb2_6frame' ? 5 : 2;
          if (p < 0.45) {
            thorSpec.primaryIdx = endIdx;
            thorSpec.secondaryIdx = 0;
            thorSpec.blend = p / 0.45;
          } else {
            thorSpec.primaryIdx = 0;
          }
          thorSpec.x = thorHomeX + 18 * (1 - ease);
          thorSpec.y = thorHomeY + 6 * (1 - ease);
          camZoom = 1.04 - ease * 0.04;
          camX = -W * 0.02 * (1 - ease);
          camY = -H * 0.025 * (1 - ease);
        }
      } else if (isRightMultiHit && rightHitFrames && rightIsFlying) {
        // Authentic 1995 DOS Double-Hit Aerial Plunge Loop (`#049 米亞斯多德 龍劍士`, FIGANI.DAT 14f!):
        //   F00..F04: Smooth steep climb up-right `(0,0) -> (+0.07W, -0.32H)`
        //   F05 (d=6): Dramatic high-sky apex hover glide across `(+0.07W -> -0.22W, -0.32H)`
        //   F06..F08*: Steep plunge DOWN-LEFT into **HIT #1 (`omni_3..4` gold crescent slash!)**
        //   F09..F11*: Low crisp horizontal rebound rightward into **HIT #2 (`omni_7..8` overhead finish!)**
        //   F12..F13: Smooth descending glide smoothly right back to perch `(0, 0)`!
        const hit1 = rightHitFrames[0];
        const hit2 = rightHitFrames[rightHitFrames.length - 1];
        const baseFlyY = thorHomeY - 16;
        const ss = (u: number) => {
          const c = Math.max(0, Math.min(1, u));
          return c * c * (3 - 2 * c);
        };
        let activeRecoil = 0;
        let activeFlash = 0;
        let activeShake = 0;

        if (localT < 500) {
          // Climb smoothly up-right (`F00..F04`, steady continuous altitude gain — zero jitter!)
          const u = ss(localT / 500);
          thorSpec.x = thorHomeX + u * (W * 0.07);
          thorSpec.y = baseFlyY - u * (H * 0.30);
          thorSpec.rot = -0.05 * Math.sin(u * Math.PI);
          thorSpec.primaryIdx = localT < 210 ? 0 : 1;
          if (localT >= 210 && localT < 310) {
            thorSpec.primaryIdx = 0;
            thorSpec.secondaryIdx = 1;
            thorSpec.blend = (localT - 210) / 100;
          }
          thorSpec.afterimages = this.config.enableAfterimagesAndSpring && u > 0.25 ? 2 : 0;
          thorSpec.dashDirX = 0.25;
          thorSpec.dashDirY = -0.97;
          camZoom = 1.0 + u * 0.05;
          camX = u * W * 0.04;
          camY = -u * H * 0.09;
          this.fireOnce('thor_windup_sfx', () => {
            this.sound.playSfx('step_wing');
            this.spawnAirGustPlume(thorSpec.x, thorSpec.y - 40, 0.2, 1.0, 12);
          });
        } else if (localT < 740) {
          // Dramatic DOS F05 (`d=6`) high-sky hover glide overhead toward left dive slot
          const p = (localT - 500) / 240;
          const u = ss(p);
          if (this.config.enableAnimeCutIn && this.scenario === 'thor_crit') {
            cutInProgress = p;
            cutInUnit = 'thor';
          }
          thorSpec.x = thorHomeX + W * 0.07 - u * (W * 0.30);
          thorSpec.y = baseFlyY - H * 0.30 - Math.sin(p * Math.PI) * (H * 0.035);
          thorSpec.opacity = 0.65 + 0.35 * Math.abs(Math.cos(p * Math.PI));
          thorSpec.primaryIdx = 2;
          thorSpec.rot = -0.06 * u;
          thorSpec.afterimages = this.config.enableAfterimagesAndSpring ? 4 : 0;
          thorSpec.dashDirX = -1;
          thorSpec.dashDirY = 0;
          camZoom = 1.05 + u * 0.04;
          camX = W * 0.04 - u * W * 0.10;
          camY = -H * 0.09;
        } else if (localT < 930) {
          // Fast steep plunge straight down onto target (`F06..F08` — long accelerated dive distance!)
          const p = (localT - 740) / 190;
          const dive = Math.pow(p, 1.45);
          thorSpec.x = thorHomeX - W * 0.23 - dive * (W * 0.08);
          thorSpec.y = baseFlyY - H * 0.30 + dive * (H * 0.16);
          thorSpec.primaryIdx = p < 0.62 ? 2 : hit1.frame;
          thorSpec.rot = -0.06 - dive * 0.06;
          thorSpec.afterimages = this.config.enableAfterimagesAndSpring ? 5 : 0;
          thorSpec.dashDirX = -0.45;
          thorSpec.dashDirY = 0.89;
          aerialSpeedLinesIntensity = Math.sin(p * Math.PI) * 0.88;
          aerialSpeedLinesAngle = Math.atan2(0.89, -0.45);
          aerialSpeedLinesRgb = '253, 224, 71';
          camZoom = 1.09 + dive * 0.11;
          camX = -W * 0.06 - dive * W * 0.04;
          camY = -H * 0.09 + dive * H * 0.04;
          this.fireOnce('thor_dash_sfx', () => {
            this.sound.playSfx(this.vfxAssets.rightUnit.sfxProfile?.launchSfx ?? 'step_wing');
            this.spawnAirGustPlume(thorSpec.x, thorSpec.y - 60, -0.4, -0.8, 12);
          });
        } else if (localT < 1300) {
          // Hold HIT #1 (`F08*`, crisp vertical downward cleave!) -> smoothly cross right into windup for HIT #2
          const p = (localT - 930) / 370;
          const hold = p < 0.45;
          thorSpec.x = thorHomeX - W * 0.31 + (hold ? -Math.sin((p / 0.45) * Math.PI * 0.5) * 14 : ss((p - 0.45) / 0.55) * (W * 0.10));
          thorSpec.y = baseFlyY - H * 0.14 + (hold ? Math.sin((p / 0.45) * Math.PI * 0.5) * 18 : 18 - ss((p - 0.45) / 0.55) * (H * 0.04));
          thorSpec.rot = hold ? -0.10 * (1 - p) : 0.05 * ((p - 0.45) / 0.55);
          if (p < 0.32) thorSpec.primaryIdx = hit1.frame;
          else if (p < 0.58) thorSpec.primaryIdx = Math.min(rightOmniMax, hit1.frame + 1);
          else this.setContinuousFrame(thorSpec, hit1.frame + 2 + ((p - 0.58) / 0.42), rightOmniMax);
          this.fireOnce('thor_multihit_0', () => {
            const hl = this.vfxAssets.rightUnit.sfxProfile?.hitSfxList ?? [];
            this.sound.playSfx(hl[0] ?? 'slash');
            if (this.config.enableHitStopAndSparks) this.hitStopRemainingMs = 65;
            this.spawnImpactSparks(banditHomeX + 45, banditHomeY - 220, banditHomeY, 48, ['#ffffff', '#fde047', '#f59e0b'], -1, -0.35);
            this.spawnDustPlume(banditHomeX, banditHomeY, -1, -0.3, 10);
            this.banditTargetHp = Math.max(0, this.banditTargetHp - Math.max(1, Math.round(this.thorStrikeDmg * hit1.weight)));
          });
          if (p < 0.52) {
            const hp = p / 0.52;
            activeRecoil = Math.sin(Math.min(1, hp * 1.4) * Math.PI) * 0.65;
            activeFlash = Math.max(0, 1 - hp * 2.6) * 0.72;
            activeShake = this.config.enableHitStopAndSparks ? Math.max(0, (1 - hp * 2) * 14) : 0;
          }
          camZoom = 1.20 - p * 0.04;
          camX = -W * 0.10 + p * W * 0.03;
          camY = -H * 0.05;
        } else if (localT < 1660) {
          // Explosive HIT #2 overhead dual cross-slash (`F11*`) held crisp with strong finisher pop!
          const p = (localT - 1300) / 360;
          const hold = p < 0.52;
          thorSpec.x = thorHomeX - W * 0.21 - (hold ? Math.sin((p / 0.52) * Math.PI * 0.5) * 28 : 28 - ss((p - 0.52) / 0.48) * (W * 0.09));
          thorSpec.y = baseFlyY - H * 0.16;
          thorSpec.rot = hold ? -0.05 * (1 - p) : 0.02;
          if (p < 0.36) thorSpec.primaryIdx = hit2.frame;
          else if (p < 0.68) thorSpec.primaryIdx = Math.min(rightOmniMax, hit2.frame + 1);
          else this.setContinuousFrame(thorSpec, hit2.frame + 2 + ((p - 0.68) / 0.32), rightOmniMax);
          this.fireOnce('thor_multihit_1', () => {
            const hl = this.vfxAssets.rightUnit.sfxProfile?.hitSfxList ?? [];
            this.sound.playSfx(hl[1] ?? hl[0] ?? 'crit');
            if (this.config.enableHitStopAndSparks) this.hitStopRemainingMs = 95;
            this.spawnImpactSparks(banditHomeX + 45, banditHomeY - 195, banditHomeY, 85, ['#ffffff', '#fde047', '#f59e0b', '#fbbf24'], -1, -0.45);
            this.spawnDustPlume(banditHomeX, banditHomeY, -1, -0.35, 16);
            const firstDmg = Math.max(1, Math.round(this.thorStrikeDmg * hit1.weight));
            this.banditTargetHp = Math.max(0, this.banditTargetHp - Math.max(1, this.thorStrikeDmg - firstDmg));
          });
          slashArcProgress = Math.min(1, p * 2.2);
          shockwaveProgress = Math.min(1, p * 1.9);
          shockwaveCenter = { x: banditHomeX + 45, y: banditHomeY - 195 };
          shockwaveGroundY = banditHomeY;
          activeRecoil = Math.sin(Math.min(1, p * 1.8) * Math.PI);
          activeFlash = Math.max(0, 1 - p * 3.0);
          activeShake = this.config.enableHitStopAndSparks ? Math.max(0, (1 - p * 2.2) * 24) : 0;
          camZoom = 1.16 - p * 0.06;
          camX = -W * 0.07 * (1 - p * 0.3);
          camY = -H * 0.05 * (1 - p * 0.3);
        } else {
          // Graceful smooth recovery glide home (`F12..F13`)
          const p = Math.min(1, (localT - 1660) / Math.max(1, thorDur - 1660));
          const u = ss(p);
          const sx = thorHomeX - W * 0.14;
          const sy = baseFlyY - H * 0.16;
          thorSpec.x = sx + u * (thorHomeX - sx);
          thorSpec.y = sy + u * (thorHomeY + rightHoverBob - sy) - Math.sin(p * Math.PI) * (H * 0.025);
          thorSpec.rot = 0;
          if (p < 0.45) {
            thorSpec.primaryIdx = rightOmniMax;
            thorSpec.secondaryIdx = 0;
            thorSpec.blend = p / 0.45;
          } else {
            thorSpec.primaryIdx = 0;
          }
          camZoom = 1.10 - u * 0.10;
          camX = -W * 0.049 * (1 - u);
          camY = -H * 0.035 * (1 - u);
        }
        banditSpec.x = banditHomeX - activeRecoil * 52;
        banditSpec.y = banditHomeY + leftHoverBob - activeRecoil * 24;
        banditSpec.rot = -activeRecoil * 0.1;
        banditSpec.scaleX = 1.0 - activeRecoil * 0.07;
        banditSpec.scaleY = 1.0 + activeRecoil * 0.05;
        banditSpec.flashWhite = activeFlash;
        impactFlashAlpha = activeFlash * 0.82;
        camShake = activeShake;
      } else if (isRightMultiHit && rightHitFrames) {
        // Multi-Hit Combo Sequence (e.g., #007 Lancelot: 3 Spear Thrusts + Rising Azure Crescent Finisher!)
        const firstHitFrame = rightHitFrames[0].frame;
        if (localT < 260) {
          const p = localT / 260;
          const ease = 1 - Math.pow(1 - p, 3);
          this.setContinuousFrame(thorSpec, p * Math.max(1, firstHitFrame - 0.8), rightOmniMax);
          thorSpec.x = thorHomeX + ease * 20;
          thorSpec.y = thorHomeY + ease * 8;
          camZoom = 1.0 + ease * 0.11;
          camX = ease * W * 0.06;
          camY = ease * H * 0.04;
          camTilt = -ease * 0.012;
          this.fireOnce('thor_windup_sfx', () => {
            this.sound.playSfx(this.vfxAssets.rightUnit.sfxProfile?.stepSfx ?? 'step_foot');
            this.spawnDustPlume(thorSpec.x, thorSpec.y, 1, 0.4, 8);
          });
        } else if (localT < 460) {
          const p = (localT - 260) / 200;
          if (this.config.enableAnimeCutIn && this.scenario === 'thor_crit') {
            cutInProgress = p;
            cutInUnit = 'thor';
          }
          const dashEase = 1 - Math.pow(1 - p, 3);
          thorSpec.x = thorHomeX + 20 - dashEase * (W * 0.28);
          thorSpec.y = thorHomeY + 8 - dashEase * (H * 0.17);
          thorSpec.afterimages = this.config.enableAfterimagesAndSpring ? 4 : 0;
          this.setContinuousFrame(
            thorSpec,
            Math.max(1, firstHitFrame - 0.8) + dashEase * 0.8,
            rightOmniMax
          );
          camZoom = 1.11 + dashEase * 0.1;
          camX = W * 0.06 - dashEase * (W * 0.16);
          camY = H * 0.04 - dashEase * (H * 0.1);
          camTilt = -0.012 + dashEase * 0.026;
          this.fireOnce('thor_dash_sfx', () => {
            const launch = this.vfxAssets.rightUnit.sfxProfile?.launchSfx;
            if (launch) {
              this.sound.playSfx(launch);
            }
            this.spawnDustPlume(thorHomeX, thorHomeY, 1, 0.5, 14);
          });
        } else if (localT < 1520) {
          // Full multi-hit combo playback across frames [firstHitFrame .. rightOmniMax]
          const p = (localT - 460) / 1060;
          const curFrame = firstHitFrame + p * (rightOmniMax - firstHitFrame);
          // Snap crisply near hit frames so every thrust & finisher pops cleanly without muddy blending
          const nearestHit = rightHitFrames.find((h) => Math.abs(curFrame - h.frame) < 0.35);
          if (nearestHit) {
            thorSpec.primaryIdx = Math.min(rightOmniMax, Math.max(0, nearestHit.frame));
            thorSpec.secondaryIdx = undefined;
            thorSpec.blend = 0;
          } else {
            this.setContinuousFrame(thorSpec, curFrame, rightOmniMax);
          }

          thorSpec.x = thorHomeX + 20 - W * 0.28 - Math.min(1, p * 2.5) * 20;
          thorSpec.y = thorHomeY + 8 - H * 0.17 - Math.min(1, p * 2.5) * 10;

          let activeRecoil = 0;
          let activeFlash = 0;
          let activeShake = 0;

          for (let hi = 0; hi < rightHitFrames.length; hi++) {
            const hit = rightHitFrames[hi];
            const isFinisher = hi === rightHitFrames.length - 1;
            const deltaF = curFrame - hit.frame;
            if (deltaF >= 0) {
              this.fireOnce(`thor_multihit_${hi}`, () => {
                const hitList = this.vfxAssets.rightUnit.sfxProfile?.hitSfxList ?? [];
                const hitSfx: SfxKind =
                  hitList[hi] ?? hitList[hitList.length - 1] ?? (hit.sfx === 'crit' ? 'crit' : 'slash');
                this.sound.playSfx(hitSfx);
                if (this.config.enableHitStopAndSparks) {
                  this.hitStopRemainingMs = isFinisher ? 95 : 30;
                }
                const palette =
                  hit.color === 'azure'
                    ? ['#ffffff', '#bae6fd', '#38bdf8', '#0ea5e9', '#fde047']
                    : ['#ffffff', '#fde047', '#f59e0b', '#fbbf24'];
                const yOff = isFinisher ? -195 : hi === 0 ? -245 : hi === 1 ? -195 : -145;
                this.spawnImpactSparks(
                  banditHomeX + 45,
                  banditHomeY + yOff,
                  banditHomeY,
                  isFinisher ? 85 : 34,
                  palette,
                  -1,
                  -0.45
                );
                this.spawnDustPlume(banditHomeX, banditHomeY, -1, -0.35, isFinisher ? 16 : 6);
                const hitDmg = isFinisher
                  ? Math.max(1, this.thorStrikeDmg - rightHitFrames.slice(0, -1).reduce((s, x) => s + Math.max(1, Math.round(this.thorStrikeDmg * x.weight)), 0))
                  : Math.max(1, Math.round(this.thorStrikeDmg * hit.weight));
                this.banditTargetHp = Math.max(0, this.banditTargetHp - hitDmg);
              });

              const hitSpan = isFinisher ? 2.4 : 1.15;
              if (deltaF < hitSpan) {
                const hp = deltaF / hitSpan;
                const rVal = Math.sin(Math.min(1, hp * 1.4) * Math.PI) * (isFinisher ? 1.0 : 0.45);
                activeRecoil = Math.max(activeRecoil, rVal);
                activeFlash = Math.max(activeFlash, Math.max(0, 1 - hp * 3.0) * (isFinisher ? 1.0 : 0.65));
                activeShake = Math.max(
                  activeShake,
                  this.config.enableHitStopAndSparks ? Math.max(0, (1 - hp * 2.0) * (isFinisher ? 26 : 11)) : 0
                );
                if (isFinisher) {
                  slashArcProgress = Math.min(1, hp * 1.8);
                  shockwaveProgress = Math.min(1, hp * 1.6);
                  shockwaveCenter = { x: banditHomeX + 45, y: banditHomeY - 195 };
                  shockwaveGroundY = banditHomeY;
                }
              }
            }
          }

          banditSpec.x = banditHomeX - activeRecoil * 54;
          banditSpec.y = banditHomeY - activeRecoil * 26;
          banditSpec.rot = -activeRecoil * 0.1;
          banditSpec.scaleX = 1.0 - activeRecoil * 0.07;
          banditSpec.scaleY = 1.0 + activeRecoil * 0.05;
          banditSpec.flashWhite = activeFlash;
          impactFlashAlpha = activeFlash * 0.85;
          camZoom = 1.21 - p * 0.1;
          camX = -W * 0.1 * (1 - p * 0.45);
          camY = -H * 0.06 * (1 - p * 0.45);
          camTilt = 0.014 * (1 - p);
          camShake = activeShake;
        } else {
          const p = (localT - 1520) / 310;
          const ease = 1 - Math.pow(1 - p, 2);
          if (p < 0.45) {
            thorSpec.primaryIdx = rightOmniMax;
            thorSpec.secondaryIdx = 0;
            thorSpec.blend = p / 0.45;
          } else {
            thorSpec.primaryIdx = 0;
          }
          const startX = thorHomeX + 20 - W * 0.28 - 20;
          const startY = thorHomeY + 8 - H * 0.17 - 10;
          thorSpec.x = startX + ease * (thorHomeX - startX);
          thorSpec.y = startY + ease * (thorHomeY - startY);
          thorSpec.afterimages = this.config.enableAfterimagesAndSpring && p < 0.65 ? 2 : 0;
          thorSpec.dashDirX = 1;
          thorSpec.dashDirY = 0.48;
          camZoom = 1.11 - ease * 0.11;
          camX = -W * 0.055 * (1 - ease);
          camY = -H * 0.033 * (1 - ease);
        }
      } else if (rightFlyPattern) {
        // =====================================================================
        // Authentic 1995 FD2 Smooth Aerial Track Engine (`FIGANI.DAT` splines)!
        // Matches real per-unit frame geometry (`ox, oy, delay, sfx`):
        //   - ZERO erratic sine-wave wobble or blurry `0 ↔ 1` wing-blend spam!
        //   - Smooth continuous glide curves with crisp velocity differentials:
        //       * Controlled approach/climb wing stroke
        //       * Dramatic apex/coil HOLD (`delay=4/6/10` matching DOS!)
        //       * Fast explosive LONG-REACH surge leap into the HIT frame
        //       * Sharp extended IMPACT pose hold (no premature wash!)
        //       * Graceful banking deceleration arc back to hover station
        // =====================================================================
        const isLongFly =
          rightFlyPattern === 'climb_dive' ||
          rightFlyPattern === 'dip_rise' ||
          rightFlyPattern === 'dash_past' ||
          rightFlyPattern === 'soar_plunge' ||
          rightFlyPattern === 'sky_strafe';
        const baseFlyY = thorHomeY - 16;
        const unitId = this.vfxAssets.rightUnit.uid;
        const smooth = (u: number) => {
          const c = Math.max(0, Math.min(1, u));
          return c * c * (3 - 2 * c);
        };
        const snapPose = (omniIdx: number, nb6Idx: number, p3Idx: number) => {
          if (srcMode === 'omni_video') {
            thorSpec.primaryIdx = Math.max(0, Math.min(rightOmniMax, Math.round(omniIdx)));
            thorSpec.secondaryIdx = undefined;
            thorSpec.blend = 0;
          } else if (srcMode === 'nb2_6frame') {
            thorSpec.primaryIdx = Math.max(0, Math.min(5, Math.round(nb6Idx)));
            thorSpec.secondaryIdx = undefined;
            thorSpec.blend = 0;
          } else {
            thorSpec.primaryIdx = p3Idx;
            thorSpec.secondaryIdx = undefined;
            thorSpec.blend = 0;
          }
        };
        const blendPose = (fromO: number, toO: number, mix: number, nb6From: number, nb6To: number, p3: number) => {
          const m = Math.max(0, Math.min(1, mix));
          if (srcMode === 'omni_video') {
            thorSpec.primaryIdx = Math.min(rightOmniMax, fromO);
            thorSpec.secondaryIdx = Math.min(rightOmniMax, toO);
            thorSpec.blend = m;
          } else if (srcMode === 'nb2_6frame') {
            thorSpec.primaryIdx = nb6From;
            thorSpec.secondaryIdx = nb6To;
            thorSpec.blend = m;
          } else {
            thorSpec.primaryIdx = p3;
            thorSpec.secondaryIdx = undefined;
            thorSpec.blend = 0;
          }
        };
        /** Piecewise cubic quadratic spline (`C¹` continuous motion along normalized `t` with per-segment speed curves!) */
        interface FlyWp {
          t: number; // ms inside attack window
          dx: number; // fraction of W relative to thorHomeX
          dy: number; // fraction of H relative to baseFlyY
          ease?: 'smooth' | 'accel' | 'decel' | 'linear';
        }
        const evalPath = (wps: FlyWp[], ms: number): { x: number; y: number; vx: number; vy: number } => {
          if (ms <= wps[0].t) {
            return { x: thorHomeX + wps[0].dx * W, y: baseFlyY + wps[0].dy * H, vx: 0, vy: 0 };
          }
          const last = wps[wps.length - 1];
          if (ms >= last.t) {
            return { x: thorHomeX + last.dx * W, y: baseFlyY + last.dy * H, vx: 0, vy: 0 };
          }
          for (let i = 0; i < wps.length - 1; i++) {
            const a = wps[i];
            const b = wps[i + 1];
            if (ms >= a.t && ms <= b.t) {
              const span = Math.max(1, b.t - a.t);
              const u = (ms - a.t) / span;
              const mode = b.ease ?? 'smooth';
              const s =
                mode === 'accel'
                  ? Math.pow(u, 1.85) // whip acceleration straight INTO hit!
                  : mode === 'decel'
                    ? 1 - Math.pow(1 - u, 2.35) // crisp punchy deceleration after impact!
                    : mode === 'linear'
                      ? u
                      : smooth(u);
              const ds =
                mode === 'accel'
                  ? 1.85 * Math.pow(Math.max(0.01, u), 0.85)
                  : mode === 'decel'
                    ? 2.35 * Math.pow(Math.max(0.01, 1 - u), 1.35)
                    : mode === 'linear'
                      ? 1
                      : 6 * u * (1 - u);
              const px = thorHomeX + (a.dx + (b.dx - a.dx) * s) * W;
              const py = baseFlyY + (a.dy + (b.dy - a.dy) * s) * H;
              const vx = ((b.dx - a.dx) * W * ds) / span;
              const vy = ((b.dy - a.dy) * H * ds) / span;
              return { x: px, y: py, vx, vy };
            }
          }
          return { x: thorHomeX, y: baseFlyY, vx: 0, vy: 0 };
        };

        const patternBadgeZh =
          rightFlyPattern === 'climb_dive'
            ? '🐉 順滑航跡 · 盤升俯衝突刺 (龍騎士)'
            : rightFlyPattern === 'sky_strafe'
              ? '🐉 順滑航跡 · 高空蓄勢超高速水平穿刺 (巴拿羅西亞)'
              : rightFlyPattern === 'soar_plunge'
                ? '🐉 順滑航跡 · 高空斜升停頓急墜斬 (聖寇拉斯)'
                : rightFlyPattern === 'dip_rise'
                  ? '🐉 順滑航跡 · 低空掠地升龍迴旋 (洛娜)'
                  : rightFlyPattern === 'dash_past'
                    ? '🐉 順滑航跡 · 疾風橫掠反身迴斬 (凱拉斯)'
                    : '🐉 順滑航跡 · 展翅蓄力高速突襲 (龍劍士)';
        const patternBadgeEn =
          rightFlyPattern === 'climb_dive'
            ? '🐉 Aerial Track · Climb & Dive-Bomb Loop'
            : rightFlyPattern === 'sky_strafe'
              ? '🐉 Aerial Track · High Apex Hold & Horizontal Strafe'
              : rightFlyPattern === 'soar_plunge'
                ? '🐉 Aerial Track · High Diagonal Soar & Plunge'
                : rightFlyPattern === 'dip_rise'
                  ? '🐉 Aerial Track · Low Ground-Skim & Rising Loop'
                  : rightFlyPattern === 'dash_past'
                    ? '🐉 Aerial Track · Low Sweep-Past & Cross-Slash'
                    : '🐉 Aerial Track · Coiled Hover & Lunge';
        this.activeStageBadge = isEn
          ? `${patternBadgeEn} · ${enemyTerrain.en}`
          : `${patternBadgeZh} · ${enemyTerrain.zh}`;

        // Each flying unit's REAL DOS `FIGANI.DAT` waypoint timing + hit timestamp
        let path: FlyWp[];
        let tApexStart = 500;
        let tSurgeStart = 680;
        let tHit = 900;
        let tFollowEnd = 1480;
        let speedRgb = '125, 211, 252';
        let maxRotScale = 0.08;
        let apexOpacity = 1;

        if (rightFlyPattern === 'climb_dive') {
          // #020 Sara / #054 Ares / #056 Raiden — EXACT clockwise swoop loop (`climb up-right -> brief coil apex -> explosive long dive HIT! -> low under-arc glide home!`)
          path = [
            { t: 0, dx: 0, dy: 0 },
            { t: 500, dx: 0.075, dy: -0.24, ease: 'smooth' },       // steady steady wing-climb (NO wobble!)
            { t: 690, dx: 0.085, dy: -0.26, ease: 'decel' },        // poised apex coil before strike!
            { t: 910, dx: -0.305, dy: -0.145, ease: 'accel' },      // HUGE fast diagonal plunge right into HIT!
            { t: 1180, dx: -0.345, dy: -0.09, ease: 'decel' },      // extended heavy impact momentum hold!
            { t: 1520, dx: -0.185, dy: 0.015, ease: 'smooth' },     // DOS F08..F10 low pull-out under-curve
            { t: 2160, dx: 0, dy: 0, ease: 'smooth' },              // smooth gliding ascent back home
          ];
          tApexStart = 500; tSurgeStart = 690; tHit = 910; tFollowEnd = 1520;
          speedRgb = unitId === 56 ? '251, 146, 60' : '125, 211, 252';
        } else if (rightFlyPattern === 'dip_rise') {
          // #055 Lorna — EXACT counter-clockwise loop (`low skim left -> explosive rising uppercut HIT! -> high overhead crest -> graceful drop home!`)
          path = [
            { t: 0, dx: 0, dy: 0 },
            { t: 510, dx: -0.125, dy: 0.075, ease: 'smooth' },      // sleek ground-skim swoop down-left
            { t: 680, dx: -0.155, dy: 0.088, ease: 'decel' },       // brief tense ground-skim coil!
            { t: 900, dx: -0.315, dy: -0.19, ease: 'accel' },       // long blazing rising slash surge!
            { t: 1170, dx: -0.325, dy: -0.275, ease: 'decel' },     // crisp impact hold riding momentum skyward!
            { t: 1580, dx: -0.07, dy: -0.30, ease: 'smooth' },      // DOS F08..F10 high overhead arch right
            { t: 2160, dx: 0, dy: 0, ease: 'smooth' },              // smooth descending glide home
          ];
          tApexStart = 510; tSurgeStart = 680; tHit = 900; tFollowEnd = 1580;
          speedRgb = '254, 240, 138';
        } else if (rightFlyPattern === 'dash_past') {
          // #016 Kailas — EXACT DOS slip-past & rising cross-slash (`level glide past left -> d=4 blur hold -> soaring diagonal cross-slash HIT! -> top-right arc drop home!`)
          path = [
            { t: 0, dx: 0, dy: 0 },
            { t: 490, dx: -0.385, dy: 0.032, ease: 'smooth' },      // flat wing-glide left across lower track
            { t: 720, dx: -0.425, dy: 0.04, ease: 'decel' },        // DOS F06 `delay=4` pause coil at far left!
            { t: 910, dx: -0.285, dy: -0.165, ease: 'accel' },      // blistering rising slash right into HIT!
            { t: 1180, dx: -0.165, dy: -0.225, ease: 'decel' },     // follow-through diagonal rise hold
            { t: 1580, dx: 0.04, dy: -0.23, ease: 'smooth' },       // DOS F08..F09 bank up-right
            { t: 2160, dx: 0, dy: 0, ease: 'smooth' },              // clean descending settle to station
          ];
          tApexStart = 490; tSurgeStart = 720; tHit = 910; tFollowEnd = 1580;
          speedRgb = '253, 224, 71';
        } else if (rightFlyPattern === 'soar_plunge') {
          // #026 St. Koulas — EXACT DOS diagonal UP-LEFT ascent -> F05 `delay=6` sky apex hold -> reverse plunging cleave DOWN-RIGHT!
          path = [
            { t: 0, dx: 0, dy: 0 },
            { t: 480, dx: -0.34, dy: -0.33, ease: 'smooth' },       // sleek straight upward-left climb!
            { t: 760, dx: -0.365, dy: -0.35, ease: 'decel' },       // DOS F05 `delay=6` dramatic apex hover!
            { t: 950, dx: -0.245, dy: -0.135, ease: 'accel' },      // steep reverse plunging dive into HIT!
            { t: 1220, dx: -0.145, dy: -0.05, ease: 'decel' },      // extended sweeping cleave follow-through!
            { t: 1620, dx: 0.045, dy: 0.035, ease: 'smooth' },      // DOS F08..F09 glide past right edge
            { t: 2160, dx: 0, dy: 0, ease: 'smooth' },              // smooth return lift to home perch
          ];
          tApexStart = 480; tSurgeStart = 760; tHit = 950; tFollowEnd = 1620;
          speedRgb = '253, 224, 71';
        } else if (rightFlyPattern === 'sky_strafe') {
          // #027 Banarossia — EXACT DOS steep climb right -> MASSIVE `delay=10` sky pause -> SUPERSONIC horizontal strafe straight across left -> overhead return drop!
          path = [
            { t: 0, dx: 0, dy: 0 },
            { t: 430, dx: 0.11, dy: -0.35, ease: 'smooth' },        // steep rapid up-right takeoff off sky edge
            { t: 720, dx: 0.125, dy: -0.185, ease: 'smooth' },      // DOS F05 `delay=10` hold dipping into strafe lane!
            { t: 920, dx: -0.295, dy: -0.185, ease: 'accel' },      // SUPERSONIC horizontal dart strafe right->left!
            { t: 1210, dx: -0.45, dy: -0.185, ease: 'decel' },      // piercing lance carries straight through target!
            { t: 1570, dx: -0.055, dy: -0.28, ease: 'smooth' },     // DOS F11..F12 soaring loop-back overhead
            { t: 2160, dx: 0, dy: 0, ease: 'smooth' },              // crisp vertical descent settling home!
          ];
          tApexStart = 430; tSurgeStart = 720; tHit = 920; tFollowEnd = 1570;
          speedRgb = '163, 230, 53';
        } else {
          // #017 Miasdod Swordsman (`hover_swoop`): calm wing draw back -> explosive long horizontal lunge -> smooth return!
          path = [
            { t: 0, dx: 0, dy: 0 },
            { t: 320, dx: 0.032, dy: -0.035, ease: 'smooth' },      // steady poise back with wings unfurled
            { t: 480, dx: 0.038, dy: -0.04, ease: 'decel' },        // tight cocked hold right before strike
            { t: 690, dx: -0.305, dy: -0.145, ease: 'accel' },      // BIG instant hawk lunge leap (DOS F04->F05*!)
            { t: 1020, dx: -0.335, dy: -0.145, ease: 'decel' },     // solid blade-impact hold & slide!
            { t: 1410, dx: -0.21, dy: -0.095, ease: 'smooth' },     // follow-through deceleration
            { t: 1830, dx: 0, dy: 0, ease: 'smooth' },              // steady horizontal glide home
          ];
          tApexStart = 320; tSurgeStart = 480; tHit = 690; tFollowEnd = 1410;
          speedRgb = '254, 240, 138';
          maxRotScale = 0.05;
        }

        const sample = evalPath(path, localT);
        const speedMag = Math.hypot(sample.vx, sample.vy);
        thorSpec.x = sample.x;
        thorSpec.y = sample.y;

        // Smooth organic aerodynamic bank pitch pointing lightly along velocity (capped softly, ZERO jitter!)
        if (speedMag > 0.05) {
          const ndx = sample.vx / speedMag;
          const ndy = sample.vy / speedMag;
          thorSpec.dashDirX = ndx;
          thorSpec.dashDirY = ndy;
          const pitchTarget = Math.max(-maxRotScale, Math.min(maxRotScale, ndy * maxRotScale * (ndx < 0 ? 1.15 : -0.75)));
          thorSpec.rot = pitchTarget;
        } else {
          thorSpec.rot = 0;
        }

        // Authentic wing/dash cues + frame sequence with crisp sharp pose holds (`no blurry oscillation!`)
        this.fireOnce('thor_fly_flap_1', () => {
          this.sound.playSfx('step_wing');
          this.spawnAirGustPlume(thorSpec.x, thorSpec.y - 40, 0.25, 1.0, 11);
        });
        if (isLongFly && localT >= 270) {
          this.fireOnce('thor_fly_flap_2', () => {
            this.sound.playSfx('step_wing');
            this.spawnAirGustPlume(thorSpec.x, thorSpec.y - 40, 0.35, 1.0, 10);
          });
        }
        if (rightFlyPattern === 'dip_rise' && localT >= 390) {
          this.fireOnce('thor_fly_ground_skim', () => {
            this.spawnDustPlume(thorSpec.x, thorHomeY, 1, 0.2, 12);
          });
        }

        // Pose selection locked cleanly to each phase's exact visual beat (with #026 crescent cue override!)
        if (localT < tApexStart) {
          // Single smooth wing spread transitioning `0 -> 1 -> 2` (NO chaotic wing-flap spasm!)
          const u = localT / Math.max(1, tApexStart);
          if (u < 0.22) {
            blendPose(0, 1, u / 0.22, 0, 1, 0);
          } else if (u < 0.72) {
            snapPose(1, 1, 1);
          } else {
            blendPose(1, 2, (u - 0.72) / 0.28, 1, 2, 1);
          }
          thorSpec.afterimages = this.config.enableAfterimagesAndSpring && u > 0.35 ? 2 : 0;
        } else if (localT < tSurgeStart) {
          // Coiled apex / pause hold (`DOS delay=4/6/10` tension beat!)
          const p = (localT - tApexStart) / Math.max(1, tSurgeStart - tApexStart);
          snapPose(unitId === 26 ? 2 : 2, 2, 1);
          if (rightFlyPattern === 'dash_past' || rightFlyPattern === 'soar_plunge' || rightFlyPattern === 'sky_strafe') {
            apexOpacity = 0.58 + 0.42 * Math.abs(Math.cos(p * Math.PI));
            thorSpec.opacity = apexOpacity;
          }
          thorSpec.afterimages = this.config.enableAfterimagesAndSpring ? 3 : 0;
          if (this.config.enableAnimeCutIn && this.scenario === 'thor_crit') {
            cutInProgress = p;
            cutInUnit = 'thor';
          }
        } else if (localT < tHit) {
          // Explosive LONG-REACH lunge flying directly into the enemy!
          const p = (localT - tSurgeStart) / Math.max(1, tHit - tSurgeStart);
          thorSpec.opacity = 1;
          // Stay sharp tucked diving pose until final micro-frames right before contact
          const preHitO = unitId === 27 ? 3 : unitId === 26 ? 2 : 3;
          if (p < 0.78) {
            snapPose(preHitO, 2, 1);
          } else {
            blendPose(preHitO, unitId === 26 ? 3 : 4, (p - 0.78) / 0.22, 2, 3, 2);
          }
          thorSpec.afterimages = this.config.enableAfterimagesAndSpring ? 5 : 0;
          aerialSpeedLinesIntensity = Math.sin(p * Math.PI) * 0.9;
          aerialSpeedLinesAngle = Math.atan2(sample.vy, sample.vx);
          aerialSpeedLinesRgb = speedRgb;
          this.fireOnce('thor_dash_sfx', () => {
            const prof = this.vfxAssets.rightUnit.sfxProfile;
            this.sound.playSfx(prof?.launchSfx ?? prof?.stepSfx ?? 'step_wing');
            this.spawnAirGustPlume(thorSpec.x, thorSpec.y - 60, -thorSpec.dashDirX * 0.7, -thorSpec.dashDirY * 0.7, 14);
          });
        } else if (localT < tFollowEnd) {
          // IMPACT HOLD & FOLLOW-THROUGH (`crisp weapon flash frame held SOLID longer for strike power!`)
          const p = (localT - tHit) / Math.max(1, tFollowEnd - tHit);
          thorSpec.opacity = 1;
          if (unitId === 26) {
            // #026 St. Koulas has golden blade arcs across omni_3 (overhead) -> omni_4/5 (sweeping horizontal ring)
            if (p < 0.24) snapPose(3, 3, 2);
            else if (p < 0.56) snapPose(4, 3, 2);
            else if (p < 0.76) blendPose(5, 6, (p - 0.56) / 0.20, 4, 4, 2);
            else blendPose(6, 7, (p - 0.76) / 0.24, 4, 5, 2);
          } else {
            // Standard 10-frame flyers: crisp golden peak hit held solid across `omni_4..5` (`p = 0..0.48`!)
            if (p < 0.28) snapPose(4, 3, 2);
            else if (p < 0.48) snapPose(5, 3, 2);
            else if (p < 0.72) blendPose(6, 7, (p - 0.48) / 0.24, 4, 4, 2);
            else blendPose(7, 8, (p - 0.72) / 0.28, 4, 5, 2);
          }
          thorSpec.afterimages = this.config.enableAfterimagesAndSpring && p < 0.35 ? 3 : 0;

          slashArcProgress = Math.min(1, p * 2.2);
          shockwaveProgress = Math.min(1, p * 1.9);
          shockwaveCenter = { x: banditHomeX + 45, y: banditHomeY - 195 };
          shockwaveGroundY = banditHomeY;

          this.fireOnce('thor_impact', () => {
            const hitList = this.vfxAssets.rightUnit.sfxProfile?.hitSfxList ?? [];
            const impactSfx: SfxKind = hitList[0] ?? (this.scenario === 'thor_crit' ? 'crit' : 'hit');
            this.sound.playSfx(impactSfx);
            if (this.config.enableHitStopAndSparks) {
              this.hitStopRemainingMs = 95;
            }
            this.spawnImpactSparks(
              banditHomeX + 45,
              banditHomeY - 195,
              banditHomeY,
              85,
              ['#ffffff', '#fde047', '#f59e0b', '#38bdf8', '#7dd3fc'],
              -1,
              -0.45
            );
            this.spawnAirGustPlume(banditHomeX + 20, banditHomeY - 140, -1, -0.3, 14);
            this.spawnDustPlume(banditHomeX, banditHomeY, -1, -0.35, 10);
            this.banditTargetHp = Math.max(0, this.banditTargetHp - this.thorStrikeDmg);
          });

          const recoil = Math.sin(Math.min(1, p * 2.3) * Math.PI);
          banditSpec.x = banditHomeX - recoil * 52;
          banditSpec.y = banditHomeY + leftHoverBob - recoil * 26;
          banditSpec.rot = -recoil * 0.1;
          banditSpec.scaleX = 1.0 - recoil * 0.07;
          banditSpec.scaleY = 1.0 + recoil * 0.05;
          banditSpec.flashWhite = Math.max(0, 1 - p * 3.5);
          impactFlashAlpha = Math.max(0, 1 - p * 4.5);
          camShake = this.config.enableHitStopAndSparks ? Math.max(0, (1 - p * 2.6) * 22) : 0;
        } else {
          // Graceful soaring banking glide back home -> smooth wing fold into idle `0`
          const endMs = path[path.length - 1].t;
          const p = Math.min(1, (localT - tFollowEnd) / Math.max(1, endMs - tFollowEnd));
          thorSpec.opacity = 1;
          if (p < 0.35) {
            blendPose(8, 9, p / 0.35, 5, 5, 0);
          } else if (p < 0.72) {
            blendPose(9, 0, (p - 0.35) / 0.37, 5, 0, 0);
          } else {
            snapPose(0, 0, 0);
          }
          // Smoothly blend vertical settle right onto idle `rightHoverBob` at exit end
          thorSpec.y = sample.y + p * (thorHomeY + rightHoverBob - baseFlyY);
          thorSpec.afterimages = this.config.enableAfterimagesAndSpring && p < 0.45 ? 2 : 0;
          this.fireOnce('thor_fly_return_flap', () => {
            this.sound.playSfx('step_wing');
            this.spawnAirGustPlume(thorSpec.x, thorSpec.y - 30, -0.5, 0.8, 8);
          });
        }

        // Smooth continuous subtle camera follow tied directly to aircraft position (ZERO harsh tilt/zoom jumps!)
        const relX = (thorSpec.x - thorHomeX) / W;
        const relY = (thorSpec.y - baseFlyY) / H;
        const hitZoomEnv =
          localT >= tSurgeStart && localT <= tFollowEnd + 240
            ? Math.sin(
                Math.max(0, Math.min(1, (localT - tSurgeStart) / Math.max(1, tFollowEnd + 240 - tSurgeStart))) *
                  Math.PI
              )
            : 0;
        camZoom = 1.0 + hitZoomEnv * 0.12;
        camX = relX * W * 0.20;
        camY = Math.max(-H * 0.11, Math.min(H * 0.05, relY * H * 0.28));
        camTilt = (localT >= tSurgeStart && localT < tHit + 180) ? -relX * 0.032 * hitZoomEnv : 0;
      } else if (localT < 460) {
        // 1. Coiled Wind-Up at Bottom-Right
        const p = localT / 460;
        const ease = 1 - Math.pow(1 - p, 3);
        if (srcMode === 'omni_video') {
          this.setContinuousFrame(thorSpec, p * 2.5, 9);
        } else if (srcMode === 'nb2_6frame') {
          this.setContinuousFrame(thorSpec, p * 2.0, 5);
        } else if (p < 0.28) {
          thorSpec.primaryIdx = 0;
          thorSpec.secondaryIdx = 1;
          thorSpec.blend = p / 0.28;
        } else {
          thorSpec.primaryIdx = 1;
        }
        thorSpec.x = thorHomeX + ease * 24;
        thorSpec.y = thorHomeY + ease * 10;
        thorSpec.scaleY = 1.0 - Math.sin(p * Math.PI) * 0.04;
        camZoom = 1.0 + ease * 0.13;
        camX = ease * W * 0.08;
        camY = ease * H * 0.05;
        camTilt = -ease * 0.016;
        this.fireOnce('thor_windup_sfx', () => {
          const prof = this.vfxAssets.rightUnit.sfxProfile;
          this.sound.playSfx(prof?.stepSfx ?? 'step_foot');
          this.spawnDustPlume(thorSpec.x, thorSpec.y, 1, 0.4, 8);
        });
      } else if (localT < 820) {
        // 2. Diagonal Up-Left (↖) High-Speed Lunge + Critical-Only Avatar Cut-In Strip
        const p = (localT - 460) / 360;
        if (this.config.enableAnimeCutIn && this.scenario === 'thor_crit') {
          cutInProgress = p;
          cutInUnit = 'thor';
        }
        const dashP = Math.max(0, (p - 0.2) / 0.8);
        const dashEase = 1 - Math.pow(1 - dashP, 3);
        thorSpec.x = thorHomeX + 24 - dashEase * (W * 0.31);
        thorSpec.y = thorHomeY + 10 - dashEase * (H * 0.19);
        thorSpec.afterimages = this.config.enableAfterimagesAndSpring && dashP > 0.05 ? 4 : 0;

        if (srcMode === 'omni_video') {
          this.setContinuousFrame(thorSpec, 2.5 + dashP * 1.5, 9);
        } else if (srcMode === 'nb2_6frame') {
          if (dashP > 0.65) {
            this.setContinuousFrame(thorSpec, 2.0 + ((dashP - 0.65) / 0.35) * 1.0, 5);
          } else {
            thorSpec.primaryIdx = 2;
          }
        } else {
          thorSpec.primaryIdx = 1;
          if (dashP > 0.7) {
            const whipP = (dashP - 0.7) / 0.3;
            thorSpec.secondaryIdx = 2;
            thorSpec.blend = whipP * 0.55;
            thorSpec.rot = -whipP * 0.06;
          }
        }

        camZoom = 1.13 + dashEase * 0.09;
        camX = W * 0.08 - dashEase * (W * 0.18);
        camY = H * 0.05 - dashEase * (H * 0.11);
        camTilt = -0.016 + dashEase * 0.032;
        this.fireOnce('thor_dash_sfx', () => {
          const prof = this.vfxAssets.rightUnit.sfxProfile;
          // Play unit-specific launch/spin SFX if present (e.g., Ares/Lorna spear spin, Raiden poleaxe);
          // avoid playing a generic sword slash for mages/clerics/warriors whose authentic SFX is on impact!
          if (prof?.launchSfx) {
            this.sound.playSfx(prof.launchSfx);
          } else {
            this.sound.playSfx(prof?.stepSfx ?? 'step_foot');
          }
          this.spawnDustPlume(thorHomeX, thorHomeY, 1, 0.5, 14);
        });
      } else if (localT < 1400) {
        // 3. Diagonal Up-Left Cleave Impact & Follow-Through (hold crisp peak slash frame for real strike power!)
        const p = (localT - 820) / 580;
        if (srcMode === 'omni_video') {
          if (p < 0.26) {
            thorSpec.primaryIdx = 4;
            thorSpec.secondaryIdx = undefined;
            thorSpec.blend = 0;
          } else if (p < 0.44) {
            thorSpec.primaryIdx = 5;
            thorSpec.secondaryIdx = undefined;
            thorSpec.blend = 0;
          } else if (p < 0.80) {
            this.setContinuousFrame(thorSpec, 6.0 + ((p - 0.44) / 0.36) * 3.0, 9);
          } else {
            thorSpec.primaryIdx = 9;
          }
        } else if (srcMode === 'nb2_6frame') {
          if (p < 0.34) {
            thorSpec.primaryIdx = 3;
            thorSpec.secondaryIdx = undefined;
            thorSpec.blend = 0;
          } else if (p < 0.62) {
            this.setContinuousFrame(thorSpec, 4.0 + ((p - 0.34) / 0.28) * 1.0, 5);
          } else {
            thorSpec.primaryIdx = 5;
          }
        } else if (p < 0.12) {
          thorSpec.primaryIdx = 1;
          thorSpec.secondaryIdx = 2;
          thorSpec.blend = 0.55 + (p / 0.12) * 0.45;
        } else {
          thorSpec.primaryIdx = 2;
        }
        thorSpec.x = thorHomeX + 24 - W * 0.31 - Math.min(1, p * 4) * 24;
        thorSpec.y = thorHomeY + 10 - H * 0.19 - Math.min(1, p * 4) * 12;

        slashArcProgress = Math.min(1, p * 2.1);
        shockwaveProgress = Math.min(1, p * 1.8);
        shockwaveCenter = { x: banditHomeX + 45, y: banditHomeY - 195 };
        shockwaveGroundY = banditHomeY;

        this.fireOnce('thor_impact', () => {
          const hitList = this.vfxAssets.rightUnit.sfxProfile?.hitSfxList ?? [];
          const impactSfx: SfxKind = hitList[0] ?? (this.scenario === 'thor_crit' ? 'crit' : 'hit');
          this.sound.playSfx(impactSfx);
          if (this.config.enableHitStopAndSparks) {
            this.hitStopRemainingMs = 95;
          }
          this.spawnImpactSparks(
            banditHomeX + 45,
            banditHomeY - 195,
            banditHomeY,
            80,
            ['#ffffff', '#fde047', '#f59e0b', '#38bdf8', '#7dd3fc'],
            -1,
            -0.5
          );
          this.spawnDustPlume(banditHomeX, banditHomeY, -1, -0.4, 16);
          this.banditTargetHp = Math.max(0, this.banditTargetHp - this.thorStrikeDmg);
        });

        // Bandit diagonal Up-Left recoil (matching FD2.EXE dx < 0, dy < 0!)
        const recoil = Math.sin(Math.min(1, p * 2.2) * Math.PI);
        banditSpec.x = banditHomeX - recoil * 52;
        banditSpec.y = banditHomeY - recoil * 26;
        banditSpec.rot = -recoil * 0.1;
        banditSpec.scaleX = 1.0 - recoil * 0.07;
        banditSpec.scaleY = 1.0 + recoil * 0.05;
        banditSpec.flashWhite = Math.max(0, 1 - p * 3.5);
        impactFlashAlpha = Math.max(0, 1 - p * 4.5);

        camZoom = 1.22 - p * 0.12;
        camX = -W * 0.1 * (1 - p * 0.5);
        camY = -H * 0.06 * (1 - p * 0.5);
        camTilt = 0.016 * (1 - p);
        camShake = this.config.enableHitStopAndSparks ? Math.max(0, (1 - p * 2.4) * 24) : 0;
      } else {
        // 4. Diagonal Down-Right (↘) Backstep Return to Bottom-Right TAI Platform
        const p = (localT - 1400) / 430;
        const ease = 1 - Math.pow(1 - p, 2);
        const endIdx = srcMode === 'omni_video' ? 9 : srcMode === 'nb2_6frame' ? 5 : 2;
        if (p < 0.4) {
          thorSpec.primaryIdx = endIdx;
          thorSpec.secondaryIdx = 0;
          thorSpec.blend = p / 0.4;
        } else {
          thorSpec.primaryIdx = 0;
        }
        const startX = thorHomeX + 24 - W * 0.31 - 24;
        const startY = thorHomeY + 10 - H * 0.19 - 12;
        thorSpec.x = startX + ease * (thorHomeX - startX);
        thorSpec.y = startY + ease * (thorHomeY - startY);
        thorSpec.afterimages = this.config.enableAfterimagesAndSpring && p < 0.65 ? 2 : 0;
        thorSpec.dashDirX = 1;
        thorSpec.dashDirY = 0.48;
        camZoom = 1.1 - ease * 0.1;
        camX = -W * 0.05 * (1 - ease);
        camY = -H * 0.03 * (1 - ease);
      }
    }

    // -------------------------------------------------------------------------
    // Bandit Diagonal Down-Right (↘) Strike Sequence
    // -------------------------------------------------------------------------
    if (banditStart >= 0 && t >= banditStart && t < banditStart + 1850) {
      const localB = t - banditStart;
      if (localB < 520) {
        // 1. Bandit Overhead Wind-Up at Top-Left
        const p = localB / 520;
        const ease = 1 - Math.pow(1 - p, 3);
        if (srcMode === 'omni_video') {
          this.setContinuousFrame(banditSpec, p * 5.0, 9);
        } else if (srcMode === 'nb2_6frame') {
          this.setContinuousFrame(banditSpec, p * 2.0, 5);
        } else if (p < 0.28) {
          banditSpec.primaryIdx = 0;
          banditSpec.secondaryIdx = 1;
          banditSpec.blend = p / 0.28;
        } else {
          banditSpec.primaryIdx = 1;
        }
        banditSpec.x = banditHomeX - ease * 18;
        banditSpec.y = banditHomeY - ease * 10;
        camZoom = 1.0 + ease * 0.12;
        camX = -ease * W * 0.08;
        camY = -ease * H * 0.05;
        camTilt = ease * 0.015;
        this.fireOnce('bandit_windup', () => {
          const prof = this.vfxAssets.leftUnit.sfxProfile;
          this.sound.playSfx(prof?.stepSfx ?? 'step_foot');
          this.spawnDustPlume(banditSpec.x, banditSpec.y, -1, -0.4, 8);
        });
      } else if (localB < 820) {
        // 2. Bandit Diagonal Down-Right (↘) Lunge toward Bottom-Right Thor + Critical-Only Right-Facing Avatar Cut-In Strip
        const p = (localB - 520) / 300;
        if (this.config.enableAnimeCutIn && this.scenario === 'bandit_crit') {
          cutInProgress = p;
          cutInUnit = 'bandit';
        }
        const ease = 1 - Math.pow(1 - p, 3);
        banditSpec.x = banditHomeX - 18 + ease * (W * 0.3);
        banditSpec.y = banditHomeY - 10 + ease * (H * 0.18);
        banditSpec.afterimages = this.config.enableAfterimagesAndSpring ? 3 : 0;
        banditSpec.dashDirX = -1;
        banditSpec.dashDirY = -0.48;

        if (srcMode === 'omni_video') {
          this.setContinuousFrame(banditSpec, 5.0 + p * 2.2, 9);
        } else if (srcMode === 'nb2_6frame') {
          if (p > 0.65) {
            this.setContinuousFrame(banditSpec, 2.0 + ((p - 0.65) / 0.35) * 1.0, 5);
          } else {
            banditSpec.primaryIdx = 2;
          }
        } else {
          banditSpec.primaryIdx = 1;
          if (p > 0.7) {
            const whipP = (p - 0.7) / 0.3;
            banditSpec.secondaryIdx = 2;
            banditSpec.blend = whipP * 0.55;
            banditSpec.rot = whipP * 0.06;
          }
        }

        camZoom = 1.12 + ease * 0.07;
        camX = -W * 0.08 + ease * (W * 0.16);
        camY = -H * 0.05 + ease * (H * 0.1);
        this.fireOnce('bandit_dash', () => {
          const prof = this.vfxAssets.leftUnit.sfxProfile;
          if (prof?.launchSfx) {
            this.sound.playSfx(prof.launchSfx);
          } else {
            this.sound.playSfx(prof?.stepSfx ?? 'step_foot');
          }
          this.spawnDustPlume(banditHomeX, banditHomeY, -1, -0.4, 12);
        });
      } else if (localB < 1400) {
        // 3. Bandit Down-Right Cleave Impact
        const p = (localB - 820) / 580;
        if (srcMode === 'omni_video') {
          if (p < 0.48) {
            this.setContinuousFrame(banditSpec, 7.2 + (p / 0.48) * 1.8, 9);
          } else {
            banditSpec.primaryIdx = 9;
          }
        } else if (srcMode === 'nb2_6frame') {
          if (p < 0.28) {
            this.setContinuousFrame(banditSpec, 3.0 + (p / 0.28) * 1.0, 5);
          } else if (p < 0.55) {
            this.setContinuousFrame(banditSpec, 4.0 + ((p - 0.28) / 0.27) * 1.0, 5);
          } else {
            banditSpec.primaryIdx = 5;
          }
        } else if (p < 0.12) {
          banditSpec.primaryIdx = 1;
          banditSpec.secondaryIdx = 2;
          banditSpec.blend = 0.55 + (p / 0.12) * 0.45;
        } else {
          banditSpec.primaryIdx = 2;
        }
        banditSpec.x = banditHomeX - 18 + W * 0.3 + Math.min(1, p * 4) * 20;
        banditSpec.y = banditHomeY - 10 + H * 0.18 + Math.min(1, p * 4) * 10;

        banditSlashProgress = Math.min(1, p * 2.2);
        shockwaveProgress = Math.min(1, p * 1.9);
        shockwaveCenter = { x: thorHomeX - 35, y: thorHomeY - 210 };
        shockwaveGroundY = thorHomeY;

        this.fireOnce('bandit_impact', () => {
          const isBanditCrit = this.scenario === 'bandit_crit';
          const hitList = this.vfxAssets.leftUnit.sfxProfile?.hitSfxList ?? [];
          const impactSfx: SfxKind = hitList[0] ?? (isBanditCrit ? 'crit' : 'hit');
          this.sound.playSfx(impactSfx);
          if (this.config.enableHitStopAndSparks) {
            this.hitStopRemainingMs = isBanditCrit ? 95 : 75;
          }
          this.spawnImpactSparks(
            thorHomeX - 35,
            thorHomeY - 210,
            thorHomeY,
            isBanditCrit ? 85 : 55,
            ['#ffffff', '#fca5a5', '#ef4444', '#fb923c', '#fde047'],
            1,
            0.5
          );
          this.spawnDustPlume(thorHomeX, thorHomeY, 1, 0.4, 14);
          this.thorTargetHp = Math.max(1, this.thorTargetHp - this.banditStrikeDmg);
        });

        // Thor diagonal Down-Right recoil (matching FD2.EXE dx > 0, dy > 0!)
        const recoil = Math.sin(Math.min(1, p * 2.2) * Math.PI);
        thorSpec.x = thorHomeX + recoil * 44;
        thorSpec.y = thorHomeY + rightHoverBob + recoil * 22;
        thorSpec.rot = recoil * 0.08;
        thorSpec.flashWhite = Math.max(0, 1 - p * 3.8);
        impactFlashAlpha = Math.max(0, (1 - p * 4.8) * 0.7);

        camZoom = 1.19 - p * 0.1;
        camX = W * 0.08 * (1 - p * 0.5);
        camY = H * 0.05 * (1 - p * 0.5);
        camShake = this.config.enableHitStopAndSparks ? Math.max(0, (1 - p * 2.5) * 18) : 0;
      } else {
        // 4. Bandit leaps diagonally Up-Left (↖) back to Top-Left
        const p = (localB - 1400) / 450;
        const ease = 1 - Math.pow(1 - p, 2);
        const endIdx = srcMode === 'omni_video' ? 9 : srcMode === 'nb2_6frame' ? 5 : 2;
        if (p < 0.4) {
          banditSpec.primaryIdx = endIdx;
          banditSpec.secondaryIdx = 0;
          banditSpec.blend = p / 0.4;
        } else {
          banditSpec.primaryIdx = 0;
        }
        const startX = banditHomeX - 18 + W * 0.3 + 20;
        const startY = banditHomeY - 10 + H * 0.18 + 10;
        banditSpec.x = startX + ease * (banditHomeX - startX);
        banditSpec.y = startY + ease * (banditHomeY + leftHoverBob - startY);
        banditSpec.afterimages = this.config.enableAfterimagesAndSpring && p < 0.6 ? 2 : 0;
        banditSpec.dashDirX = 1;
        banditSpec.dashDirY = 0.48;
        camZoom = 1.09 - ease * 0.09;
        camX = W * 0.04 * (1 - ease);
        camY = H * 0.025 * (1 - ease);
      }
    }

    // -------------------------------------------------------------------------
    // Apply Dynamic Camera Transform
    // -------------------------------------------------------------------------
    const shakeX = camShake > 0 ? (Math.random() - 0.5) * camShake * 2 : 0;
    const shakeY = camShake > 0 ? (Math.random() - 0.5) * camShake * 1.6 : 0;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.translate(W * 0.5 + shakeX, H * 0.5 + shakeY);
    ctx.scale(camZoom, camZoom);
    ctx.rotate(camTilt);
    ctx.translate(-W * 0.5 - camX, -H * 0.5 - camY);

    // Unified single terrain backdrop for melee (uses Enemy's tile, no floating TAI disc)
    this.drawTerrainBackdrop(ctx, W, H, this.vfxAssets.enemyBgId, camX, camY, thorHomeY);

    // Optional directional anime velocity lines behind high-speed aerial dive / rising slash / flash cross-slash!
    if (aerialSpeedLinesIntensity > 0.02) {
      this.drawAerialSpeedLines(ctx, W, H, aerialSpeedLinesAngle, aerialSpeedLinesIntensity, aerialSpeedLinesRgb);
    }

    // Ground shadows stay anchored on the ground plane beneath airborne units, shrinking & softening with altitude!
    const leftScale = this.vfxAssets.leftUnit.displayScale ?? 1;
    const rightScale = this.vfxAssets.rightUnit.displayScale ?? 1;
    const leftShadowBase = Math.round(195 * Math.min(1.45, Math.max(0.75, 0.55 + 0.45 * leftScale)));
    const rightShadowBase = Math.round(215 * Math.min(1.5, Math.max(0.75, 0.55 + 0.45 * rightScale)));
    if (leftIsFlying) {
      const lAlt = Math.max(0, banditHomeY - banditSpec.y);
      const lRad = leftShadowBase * Math.max(0.36, 1 - lAlt / 540);
      const lAlpha = Math.max(0.24, 1 - lAlt / 430);
      this.drawGroundShadow(ctx, banditSpec.x, banditHomeY, lRad, lAlpha);
    } else {
      this.drawGroundShadow(ctx, banditSpec.x, banditSpec.y, leftShadowBase);
    }
    if (rightIsFlying) {
      const groundRatio = Math.max(0, Math.min(1, (thorHomeX - thorSpec.x) / Math.max(1, thorHomeX - banditHomeX)));
      const thorGroundY = thorHomeY - groundRatio * (thorHomeY - banditHomeY);
      const rAlt = Math.max(0, thorGroundY - thorSpec.y);
      const rRad = rightShadowBase * Math.max(0.35, 1 - rAlt / 540);
      const rAlpha = Math.max(0.22, 1 - rAlt / 420);
      this.drawGroundShadow(ctx, thorSpec.x, thorGroundY, rRad, rAlpha);
    } else {
      this.drawGroundShadow(ctx, thorSpec.x, thorSpec.y, rightShadowBase);
    }

    if (shockwaveProgress >= 0 && shockwaveProgress <= 1 && this.config.enableHitStopAndSparks) {
      this.drawGroundShockwave(ctx, shockwaveCenter.x, shockwaveGroundY - 10, shockwaveProgress);
    }

    // Render Bandit (Top-Left, lower Y -> drawn first in painter's algorithm; 545px base = 75.7% perspective depth vs 720px foreground!)
    const activeBanditPoses = this.getActivePoseList('bandit');
    const activeThorPoses = this.getActivePoseList('thor');
    const banditDispSize = Math.round(545 * leftScale);
    this.renderCombatantWithBlend(ctx, activeBanditPoses, banditSpec, '#ef4444', banditDispSize);
    if (banditSpec.primaryIdx >= 1 && banditSpec.primaryIdx <= 6) {
      this.drawBanditVisorGlint(ctx, banditSpec.x + 24, banditSpec.y - 340, t);
    }

    // Render Thor (Bottom-Right Foreground, higher Y -> drawn on top in painter's algorithm!)
    if (thorDrawsInFront) {
      const thorDispSize = Math.round(720 * (this.vfxAssets.rightUnit.displayScale ?? 1));
      const thorAfterimageColor =
        rightFlyPattern === 'dash_past' || rightFlyPattern === 'soar_plunge' ? '#fde047' : '#38bdf8';
      this.renderCombatantWithBlend(ctx, activeThorPoses, thorSpec, thorAfterimageColor, thorDispSize);
    }

    if (
      !rightIsFlying &&
      !rightStationaryBeam &&
      thorSpec.primaryIdx === 1 &&
      thorStart >= 0 &&
      t >= thorStart &&
      t < thorStart + 820 &&
      this.config.enableVolumetricSlash
    ) {
      this.drawBladeChargeAura(ctx, thorSpec.x + 55, thorSpec.y - 420, (t - thorStart) / 820);
    }

    // Authentic Full-Screen Diagonal Stationary Ki Beam (`beam`) OR Rising Fan-Splash Wave (`qi_splash`, e.g. #044/#062 Kelly!)
    if (stationaryBeamState) {
      if (stationaryBeamState.style === 'qi_splash') {
        this.drawStationaryKiSplash(
          ctx,
          stationaryBeamState.originX,
          stationaryBeamState.originY,
          stationaryBeamState.targetX,
          stationaryBeamState.targetY,
          stationaryBeamState.progress,
          Boolean(stationaryBeamState.chargeOnly),
          stationaryBeamState.color,
          stationaryBeamState.thickness,
          t
        );
      } else {
        this.drawStationaryKiBeam(
          ctx,
          stationaryBeamState.originX,
          stationaryBeamState.originY,
          stationaryBeamState.targetX,
          stationaryBeamState.targetY,
          stationaryBeamState.progress,
          Boolean(stationaryBeamState.chargeOnly),
          stationaryBeamState.color,
          stationaryBeamState.thickness,
          t
        );
      }
    }

    // Volumetric Crescent Slash Shaders aligned with the diagonal swing plane!
    if (slashArcProgress >= 0 && slashArcProgress <= 1 && this.config.enableVolumetricSlash) {
      this.drawVolumetricCrescentSlash(
        ctx,
        banditHomeX + 85,
        banditHomeY - 190,
        330,
        slashArcProgress,
        'thor_golden_azure'
      );
    }

    if (banditSlashProgress >= 0 && banditSlashProgress <= 1 && this.config.enableVolumetricSlash) {
      this.drawVolumetricCrescentSlash(
        ctx,
        thorHomeX - 65,
        thorHomeY - 210,
        305,
        banditSlashProgress,
        'bandit_crimson_steel'
      );
    }

    this.drawDustAndSparks(ctx);
    this.drawForegroundLeaves(ctx);

    ctx.restore(); // End camera transform

    if ((this.hitStopRemainingMs > 0 || impactFlashAlpha > 0.05) && this.config.enableHitStopAndSparks) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const grad = ctx.createRadialGradient(
        shockwaveCenter.x,
        shockwaveCenter.y,
        20,
        shockwaveCenter.x,
        shockwaveCenter.y,
        W * 0.75
      );
      const a = this.hitStopRemainingMs > 0 ? 0.55 : impactFlashAlpha * 0.45;
      grad.addColorStop(0, `rgba(255, 252, 220, ${a})`);
      grad.addColorStop(0.35, `rgba(56, 189, 248, ${a * 0.5})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    if (cutInProgress >= 0 && cutInProgress <= 1 && this.config.enableAnimeCutIn) {
      this.drawAnimeCutInBanner(ctx, W, H, cutInProgress, cutInUnit);
    }

    this.drawModernDualHud(ctx, W, H);
  }

  /**
   * Authentic Flame Dragon II 3-Stage Remote Ranged Cutaway (e.g., #008 Celia, #013 Beckwith, Snipers):
   *  - Stage 1 (0 .. 1120ms): Attacker stands ALONE on Attacker's own tile terrain (`actorBgId`), aims & fires off-screen.
   *  - Stage 2 (1120 .. 1460ms): Full-width HD horizontal speed-line transit strip (modern homage to `BG.DAT[0..2]`) with blazing projectile!
   *  - Stage 3 (1460 .. 2450ms): Target stands ALONE on Target's own tile terrain (`targetBgId`); arriving projectile strikes with silhouette flash, recoil & sparks!
   */
  private renderModernRangedAttackScene(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    attackerSide: 'hero' | 'enemy',
    localT: number,
    totalDur: number,
    isCrit: boolean
  ): void {
    const isEn = getLocale() === 'en';
    const isHeroAtk = attackerSide === 'hero';
    const actorBgId = isHeroAtk ? this.vfxAssets.heroBgId : this.vfxAssets.enemyBgId;
    const targetBgId = isHeroAtk ? this.vfxAssets.enemyBgId : this.vfxAssets.heroBgId;
    const actorTerrain = getTerrainPreset(actorBgId);
    const targetTerrain = getTerrainPreset(targetBgId);
    const actorUnit = isHeroAtk ? this.vfxAssets.rightUnit : this.vfxAssets.leftUnit;
    const projectileType = actorUnit.projectileType ?? 'bolt';
    const burstCount = Math.max(1, actorUnit.rangedBurstCount ?? 1);

    const stage1End = 1120;
    const bridgeEnd = 1460;

    const banditHomeX = W * 0.29;
    const banditHomeY = H * 0.70;
    const thorHomeX = W * 0.67;
    const thorHomeY = H * 0.89;

    const srcMode = this.config.animSource;
    const actorPoses = this.getActivePoseList(isHeroAtk ? 'thor' : 'bandit');
    const targetPoses = this.getActivePoseList(isHeroAtk ? 'bandit' : 'thor');
    const actorMaxIdx = Math.max(1, actorPoses.length - 1);

    // -------------------------------------------------------------------------
    // STAGE 2: Horizontal Speed-Line Transit Bridge (`BG.DAT[0..2]` HD Homage)
    // -------------------------------------------------------------------------
    if (localT >= stage1End && localT < bridgeEnd) {
      const bp = (localT - stage1End) / (bridgeEnd - stage1End);
      this.activeStageBadge = isEn
        ? `[2/3 Ranged Transit] Speed-Line Bridge (${actorTerrain.en} → ${targetTerrain.en})`
        : `[2/3 遠程飛行過場] 水平速度線 (${actorTerrain.zh} → ${targetTerrain.zh})`;
      // Authentic FD2: Stage 2 speed-line transit is a clean visual cut between bow/gun fire (Stage 1) and arrow/bolt hit (Stage 3)!
      this.drawRangedSpeedLineBridge(ctx, W, H, bp, isHeroAtk ? -1 : 1, projectileType, burstCount);
      this.drawModernDualHud(ctx, W, H);
      return;
    }

    // -------------------------------------------------------------------------
    // STAGE 1: Attacker Solo Screen on Attacker's Own Tile Terrain (`actorBgId`)
    // -------------------------------------------------------------------------
    if (localT < stage1End) {
      const p = Math.min(1, localT / stage1End);
      this.activeStageBadge = isEn
        ? `[1/3 Ranged Launch] ${actorUnit.nameEn} Solo · ${actorTerrain.en} (#${actorTerrain.id})`
        : `[1/3 攻方遠程發射] ${actorUnit.nameZh} 獨屏 · ${actorTerrain.zh} (#${actorTerrain.id})`;

      let cutInProgress = -1;
      if (isCrit && this.config.enableAnimeCutIn && p >= 0.14 && p <= 0.44) {
        cutInProgress = (p - 0.14) / 0.30;
      }

      const actorSpec: PoseRenderSpec = {
        primaryIdx: 0,
        x: isHeroAtk ? thorHomeX : banditHomeX,
        y: isHeroAtk ? thorHomeY : banditHomeY,
        scaleX: 1.0,
        scaleY: 1.0,
        rot: 0,
        flashWhite: 0,
        afterimages: 0,
        dashDirX: isHeroAtk ? -1 : 1,
        dashDirY: 0,
      };

      // Map launch progress cleanly through Ready -> Wind-Up/Aim -> Exact Firing Frame(s) -> Recoil Hold!
      const fireOmni = actorUnit.rangedFireFrame?.omni ?? Math.min(actorMaxIdx, 5);
      const fireNb6 = actorUnit.rangedFireFrame?.nb6 ?? 3;
      const isArrowVolley = projectileType === 'arrow' && burstCount >= 2;
      const isSniperVolley = projectileType === 'sniper_bolt' && burstCount >= 2;

      // Exact 1995 DOS #023 Loran (u_023_attack.png):
      //   - Frames 1..4 (p < 0.44): draw & tension build
      //   - Frame 5 (p = 0.44..0.59): vibrating bow release peak (5 spirit arrows still on bow!)
      //   - JUST AFTER Frame 5 (p >= 0.59): crisp snap to empty-bow Frame 6 (`nb6_5` / `omni_8..9`),
      //     and ALL 5 razor-thin spirit arrows immediately erupt together just past the bow in an
      //     ultra-tight staggered pack (DOS f13: ~15ms between arrows, 62ms total spread — NOT slow 1-by-1!)
      const arrowLeadRelease = 0.59;
      const arrowVolleySpec: Array<{ slotIdx: number; yOffPx: number; releaseT: number; tipLeadPx: number }> =
        burstCount === 5
          ? [
              // Exact DOS f13 order & HD Frame 5 (nb6_4.webp) bundle y-offsets (`y = 368, 378, 390, 404, 421` around 393):
              // Ultra-tight simultaneous volley pack (~8ms between arrows, 35ms total spread — ALL 5 leave her bow together!)
              { slotIdx: 2, yOffPx: -2, releaseT: arrowLeadRelease + 0.000, tipLeadPx: 16 },
              { slotIdx: 4, yOffPx: 25, releaseT: arrowLeadRelease + 0.007, tipLeadPx: 10 },
              { slotIdx: 0, yOffPx: -24, releaseT: arrowLeadRelease + 0.015, tipLeadPx: 6 },
              { slotIdx: 3, yOffPx: 11, releaseT: arrowLeadRelease + 0.023, tipLeadPx: 18 },
              { slotIdx: 1, yOffPx: -13, releaseT: arrowLeadRelease + 0.031, tipLeadPx: 2 },
            ]
          : Array.from({ length: burstCount }, (_, i) => {
              const frac = burstCount === 1 ? 0 : i / (burstCount - 1) - 0.5;
              return {
                slotIdx: i,
                yOffPx: Math.round(frac * 52),
                releaseT: arrowLeadRelease + i * (0.034 / Math.max(1, burstCount - 1)),
                tipLeadPx: Math.round((1 - Math.abs(frac) * 2) * 12),
              };
            });

      // Authentic 1995 DOS #040/#058 Celia (`u_058_attack.png` F7 -> F8):
      //   ALL 3 heavy steel-tipped arbalest bolts erupt ALMOST SIMULTANEOUSLY in one razor-tight overlapping
      //   salvo pack (`~24ms` stagger, 48ms total spread!) — NOT slow one-by-one shots!
      const sniperLeadRelease = 0.52;
      const sniperVolleySpec: Array<{ yOffPx: number; releaseT: number; tipLeadPx: number }> =
        Array.from({ length: burstCount }, (_, i) => {
          const order = burstCount === 3 ? [1, 0, 2][i] : i;
          const frac = burstCount === 1 ? 0 : order / (burstCount - 1) - 0.5;
          return {
            yOffPx: Math.round(frac * 24),
            releaseT: sniperLeadRelease + i * (0.044 / Math.max(1, burstCount - 1)),
            tipLeadPx: burstCount === 3 ? [18, 4, -8][i] : Math.round((1 - Math.abs(frac) * 2) * 14),
          };
        });

      const shotTimes = isArrowVolley
        ? arrowVolleySpec.map((s) => s.releaseT)
        : isSniperVolley
          ? sniperVolleySpec.map((s) => s.releaseT)
          : burstCount === 1
            ? [0.56]
            : Array.from({ length: burstCount }, (_, i) => 0.36 + i * (0.42 / Math.max(1, burstCount - 1)));
      const firstShot = shotTimes[0];

      if (isArrowVolley) {
        if (srcMode === 'omni_video') {
          if (p < 0.44) {
            // Smooth draw across F1..F4 (`omni_0..4`)
            this.setContinuousFrame(actorSpec, (p / 0.44) * Math.max(1, fireOmni - 1), actorMaxIdx);
          } else if (p < arrowLeadRelease) {
            // Hold Frame 5 (`omni_5` bloom -> `omni_6`, 5 arrows vibrating on bow — ZERO loose missiles yet!)
            actorSpec.primaryIdx = p < 0.51 ? fireOmni : Math.min(actorMaxIdx, fireOmni + 1);
          } else {
            // JUST AFTER Frame 5: crisp empty-bow follow-through (`omni_8..9` = `nb6_5`, no ghost arrows stuck on bow!)
            actorSpec.primaryIdx = Math.min(actorMaxIdx, Math.max(fireOmni + 3, actorMaxIdx - 1));
          }
        } else if (srcMode === 'nb2_6frame') {
          if (p < 0.44) {
            this.setContinuousFrame(actorSpec, (p / 0.44) * Math.max(1, fireNb6 - 1), 5);
          } else if (p < arrowLeadRelease) {
            // Crisp Frame 5 (`nb6_4`) — vibrating bow releasing the 5-arrow bundle!
            actorSpec.primaryIdx = fireNb6;
          } else {
            // Crisp Frame 6 (`nb6_5`) — empty bow as the 5 arrows immediately leave her bow!
            actorSpec.primaryIdx = 5;
          }
        } else {
          actorSpec.primaryIdx = p < 0.25 ? 0 : p < arrowLeadRelease ? 1 : 2;
        }
      } else if (isSniperVolley) {
        // Authentic 1995 DOS #040/#058 Celia (`u_058_attack.png`): hold crisp F5 muzzle burst on simultaneous salvo launch, then drop smoothly to F6 reload!
        if (srcMode === 'omni_video') {
          if (p < sniperLeadRelease - 0.04) {
            this.setContinuousFrame(actorSpec, (p / Math.max(0.1, sniperLeadRelease - 0.04)) * Math.max(1, fireOmni - 1), actorMaxIdx);
          } else if (p < sniperLeadRelease + 0.24) {
            actorSpec.primaryIdx = p < sniperLeadRelease + 0.11 ? fireOmni : Math.min(actorMaxIdx, fireOmni + 1);
          } else {
            actorSpec.primaryIdx = Math.min(actorMaxIdx, Math.max(fireOmni + 2, actorMaxIdx - 1));
          }
        } else if (srcMode === 'nb2_6frame') {
          if (p < sniperLeadRelease - 0.04) {
            this.setContinuousFrame(actorSpec, (p / Math.max(0.1, sniperLeadRelease - 0.04)) * Math.max(1, fireNb6 - 1), 5);
          } else if (p < sniperLeadRelease + 0.24) {
            actorSpec.primaryIdx = fireNb6;
          } else {
            actorSpec.primaryIdx = 5;
          }
        } else {
          actorSpec.primaryIdx = p < 0.25 ? 0 : p < sniperLeadRelease + 0.24 ? 1 : 2;
        }
      } else if (srcMode === 'omni_video') {
        if (p < firstShot - 0.02) {
          this.setContinuousFrame(actorSpec, (p / (firstShot - 0.02)) * Math.max(1, fireOmni - 0.6), actorMaxIdx);
        } else if (p < 0.88) {
          const fp = (p - (firstShot - 0.02)) / (0.88 - (firstShot - 0.02));
          this.setContinuousFrame(actorSpec, Math.min(actorMaxIdx, fireOmni + fp * (actorMaxIdx - fireOmni)), actorMaxIdx);
        } else {
          actorSpec.primaryIdx = actorMaxIdx;
        }
      } else if (srcMode === 'nb2_6frame') {
        if (p < firstShot - 0.02) {
          this.setContinuousFrame(actorSpec, (p / (firstShot - 0.02)) * Math.max(1, fireNb6 - 0.6), 5);
        } else if (p < 0.88) {
          const fp = (p - (firstShot - 0.02)) / (0.88 - (firstShot - 0.02));
          this.setContinuousFrame(actorSpec, Math.min(5, fireNb6 + fp * (5 - fireNb6)), 5);
        } else {
          actorSpec.primaryIdx = 5;
        }
      } else {
        actorSpec.primaryIdx = p < 0.25 ? 0 : p < firstShot - 0.02 ? 1 : 2;
      }

      // Per-unit normalized muzzle anchor in 680x680 sprite space (matches drawCharacterSprite anchorRatioY = 648/680)
      const actorDispSize = Math.round((isHeroAtk ? 720 : 510) * (actorUnit.displayScale ?? 1));
      const muzzleAnchor =
        actorUnit.muzzleAnchor ?? (isHeroAtk ? { x: 0.22, y: 0.54 } : { x: 0.78, y: 0.54 });
      const getMuzzlePos = () => ({
        x: actorSpec.x + (muzzleAnchor.x - 0.5) * actorDispSize * actorSpec.scaleX,
        y: actorSpec.y + (muzzleAnchor.y - 648 / 680) * actorDispSize * actorSpec.scaleY,
      });

      // Trigger recoil kickback & authentic FD2 launch SFX
      let camShake = 0;
      let totalKick = 0;
      if (isArrowVolley) {
        // Authentic 1995 DOS #023 f12: ONE crisp bow-twang release (`bank:48:5`) right at bow snap (`p = 0.58`),
        // subtle kick & clean subtle dust — zero chunky white spark bars cluttering the delicate 5-arrow bundle!
        if (p >= arrowLeadRelease - 0.01) {
          const rp = Math.min(1, (p - (arrowLeadRelease - 0.01)) / 0.2);
          totalKick = Math.sin(rp * Math.PI) * 10;
          camShake = (1 - rp) * 5;
          this.fireOnce(`ranged_fire_sfx_${attackerSide}_volley`, () => {
            const launchSfx: SfxKind = actorUnit.sfxProfile?.launchSfx ?? 'bank:48:5';
            this.sound.playSfx(launchSfx);
            this.spawnDustPlume(actorSpec.x, actorSpec.y, isHeroAtk ? 1 : -1, 0.14, 7);
          });
        }
      } else {
        for (let si = 0; si < shotTimes.length; si++) {
          const st = shotTimes[si];
          if (p >= st) {
            const rp = Math.min(1, (p - st) / 0.18);
            totalKick = Math.max(totalKick, Math.sin(rp * Math.PI) * (burstCount > 1 ? 14 : 18));
            camShake = Math.max(camShake, (1 - rp) * (burstCount > 1 ? 9 : 7));
            const mPos = getMuzzlePos();
            this.fireOnce(`ranged_fire_sfx_${attackerSide}_${si}`, () => {
              const launchSfx: SfxKind = actorUnit.sfxProfile?.launchSfx ?? 'bank:50:2';
              this.sound.playSfx(launchSfx);
              this.spawnDustPlume(actorSpec.x, actorSpec.y, isHeroAtk ? 1 : -1, 0.2, si === 0 ? 12 : 6);
              this.spawnImpactSparks(
                mPos.x,
                mPos.y,
                actorSpec.y,
                burstCount > 1 ? 18 : 24,
                ['#ffffff', '#fde047', '#f59e0b', '#fb923c'],
                isHeroAtk ? -1 : 1,
                0
              );
            });
          }
        }
      }
      actorSpec.x += isHeroAtk ? totalKick : -totalKick;

      const camZoom = 1.02 + Math.min(1, p * 1.4) * 0.11;
      const camX = (isHeroAtk ? 1 : -1) * W * 0.05 * Math.min(1, p * 1.5);
      const camY = (isHeroAtk ? 1 : -1) * H * 0.03 * Math.min(1, p * 1.5);
      const shakeX = camShake > 0 ? (Math.random() - 0.5) * camShake * 2 : 0;
      const shakeY = camShake > 0 ? (Math.random() - 0.5) * camShake * 1.5 : 0;

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.translate(W * 0.5 + shakeX, H * 0.5 + shakeY);
      ctx.scale(camZoom, camZoom);
      ctx.translate(-W * 0.5 - camX, -H * 0.5 - camY);

      this.drawTerrainBackdrop(ctx, W, H, actorBgId, camX, camY, actorSpec.y);
      this.drawGroundShadow(ctx, actorSpec.x, actorSpec.y, isHeroAtk ? 225 : 195);
      this.renderCombatantWithBlend(
        ctx,
        actorPoses,
        actorSpec,
        isHeroAtk ? '#38bdf8' : '#ef4444',
        actorDispSize
      );

      // Render outgoing projectiles streaking off screen edge!
      const mPos = getMuzzlePos();
      const dirX: -1 | 1 = isHeroAtk ? -1 : 1;
      if (isArrowVolley) {
        const spriteScale = actorDispSize / 680;
        // Exact outer bow rim in empty Frame 6 (`nb6_5.webp`: x = 162/680 = 0.238 vs muzzleAnchor 0.194 -> delta 0.044)
        // Clamping the trailing energy wake right at the bow rim prevents any tail overlap over Loran's arm/face!
        const bowRimX = mPos.x - dirX * (0.044 * actorDispSize * actorSpec.scaleX);
        const endX = isHeroAtk ? -260 : W + 260;

        // Subtle crisp sapphire release sheen right along the bowstring/grip just as the 5 arrows depart
        if (p >= arrowLeadRelease - 0.02 && p <= arrowLeadRelease + 0.14) {
          const mf = 1 - Math.abs(p - (arrowLeadRelease + 0.02)) / 0.12;
          if (mf > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.translate(bowRimX, mPos.y);
            const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 48 * mf + 14);
            g.addColorStop(0, `rgba(255, 255, 255, ${0.88 * mf})`);
            g.addColorStop(0.42, `rgba(125, 211, 252, ${0.58 * mf})`);
            g.addColorStop(1, 'rgba(37, 99, 235, 0)');
            ctx.fillStyle = g;
            ctx.scale(0.55, 1.45);
            ctx.beginPath();
            ctx.arc(0, 0, 48 * mf + 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }

        // Launch ALL 5 razor-thin spirit arrows together as one tight staggered pack JUST AFTER Frame 5!
        const travelSpan = 0.285; // ~320ms rapid dash across left half of screen (all 5 visible flying together!)
        for (const av of arrowVolleySpec) {
          if (p >= av.releaseT && p <= av.releaseT + travelSpan + 0.06) {
            const ap = Math.min(1.18, (p - av.releaseT) / travelSpan);
            const startTipX = mPos.x + dirX * (av.tipLeadPx * spriteScale);
            const tipX = startTipX + (endX - startTipX) * Math.pow(ap, 1.04);
            const ay = mPos.y + av.yOffPx * spriteScale;
            const maxTail = Math.max(28, Math.abs(tipX - bowRimX));
            this.drawElvenSpiritArrow(ctx, tipX, ay, dirX, 1.0, Math.min(255, maxTail));
          }
        }
      } else if (projectileType === 'cryo_beam') {
        // Authentic 1995 DOS #045 Beckway (Sniper T2) single roaring cryo-sapphire plasma shockwave cannon discharge!
        const endX = isHeroAtk ? -220 : W + 220;
        const st = shotTimes[0] ?? 0.56;
        if (p >= st && p <= st + 0.42) {
          const beamP = Math.min(1, (p - st) / 0.28);
          const bx = mPos.x + (endX - mPos.x) * Math.pow(beamP, 0.92);
          this.drawCryoPlasmaWave(ctx, bx, mPos.y, dirX, 1.05, Math.min(1, (p - st) / 0.34));
          if (beamP < 0.65) {
            const mf = 1 - beamP / 0.65;
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            const grad = ctx.createRadialGradient(mPos.x, mPos.y, 4, mPos.x, mPos.y, 155 * mf + 28);
            grad.addColorStop(0, `rgba(255, 255, 255, ${0.98 * mf})`);
            grad.addColorStop(0.32, `rgba(125, 211, 252, ${0.86 * mf})`);
            grad.addColorStop(0.68, `rgba(37, 99, 235, ${0.48 * mf})`);
            grad.addColorStop(1, 'rgba(30, 64, 175, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(mPos.x, mPos.y, 155 * mf + 28, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      } else {
        const endX = isHeroAtk ? -160 : W + 160;
        const isSniperBolt = projectileType === 'sniper_bolt';
        for (let si = 0; si < shotTimes.length; si++) {
          const st = shotTimes[si];
          const yJitter = isSniperVolley
            ? sniperVolleySpec[si].yOffPx
            : isSniperBolt
              ? (si - (shotTimes.length - 1) * 0.5) * 9
              : 0;
          const leadPx = isSniperVolley ? sniperVolleySpec[si].tipLeadPx : 0;
          const travelDur = isSniperVolley ? 0.28 : 0.2;
          const windowDur = isSniperVolley ? 0.34 : 0.28;
          if (p >= st && p <= st + windowDur) {
            const boltP = Math.min(1.05, (p - st) / travelDur);
            const startX = mPos.x + dirX * leadPx;
            const bx = startX + (endX - startX) * boltP;
            this.drawHdProjectile(ctx, bx, mPos.y + yJitter, dirX, projectileType, isSniperBolt ? 1.08 : 1.15);

            if (boltP < (isSniperBolt ? 0.28 : 0.48)) {
              const mf = 1 - boltP / (isSniperBolt ? 0.28 : 0.48);
              ctx.save();
              ctx.globalCompositeOperation = 'screen';
              const rad = isSniperBolt ? 52 * mf + 12 : 130 * mf + 22;
              const grad = ctx.createRadialGradient(mPos.x, mPos.y + yJitter, 2, mPos.x, mPos.y + yJitter, rad);
              grad.addColorStop(0, `rgba(255, 255, 240, ${(isSniperBolt ? 0.78 : 0.95) * mf})`);
              grad.addColorStop(0.4, isSniperBolt ? `rgba(253, 224, 71, ${0.44 * mf})` : `rgba(253, 224, 71, ${0.65 * mf})`);
              grad.addColorStop(1, isSniperBolt ? 'rgba(148, 163, 184, 0)' : 'rgba(245, 158, 11, 0)');
              ctx.fillStyle = grad;
              ctx.beginPath();
              ctx.arc(mPos.x, mPos.y + yJitter, rad, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
          }
        }
      }

      this.drawDustAndSparks(ctx);
      this.drawForegroundLeaves(ctx, actorBgId);
      ctx.restore();

      if (cutInProgress >= 0 && cutInProgress <= 1) {
        this.drawAnimeCutInBanner(ctx, W, H, cutInProgress, isHeroAtk ? 'thor' : 'bandit');
      }
      this.drawModernDualHud(ctx, W, H);
      return;
    }

    // -------------------------------------------------------------------------
    // STAGE 3: Target Solo Screen on Target's Own Tile Terrain (`targetBgId`)
    // -------------------------------------------------------------------------
    const p3 = Math.min(1, (localT - bridgeEnd) / Math.max(1, totalDur - bridgeEnd));
    const targetUnit = isHeroAtk ? this.vfxAssets.leftUnit : this.vfxAssets.rightUnit;
    this.activeStageBadge = isEn
      ? `[3/3 Target Impact] ${targetUnit.nameEn} Solo · ${targetTerrain.en} (#${targetTerrain.id})`
      : `[3/3 目標受擊] ${targetUnit.nameZh} 獨屏 · ${targetTerrain.zh} (#${targetTerrain.id})`;

    const targetHomeX = isHeroAtk ? W * 0.34 : W * 0.66;
    const targetHomeY = isHeroAtk ? H * 0.72 : H * 0.88;
    const impactY = targetHomeY - (isHeroAtk ? 185 : 220);
    const impactX = targetHomeX + (isHeroAtk ? 25 : -25);

    const targetSpec: PoseRenderSpec = {
      primaryIdx: 0,
      x: targetHomeX,
      y: targetHomeY,
      scaleX: 1.0,
      scaleY: 1.0,
      rot: 0,
      flashWhite: 0,
      afterimages: 0,
      dashDirX: isHeroAtk ? -1 : 1,
      dashDirY: 0,
    };

    const isArrowVolley3 = projectileType === 'arrow' && burstCount >= 2;
    const isSniperVolley3 = projectileType === 'sniper_bolt' && burstCount >= 2;
    // Authentic 1995 DOS #023 Loran Stage 3 target barrage (`u_023_attack.png` f16..f23):
    // 5 exact hits (`f17..f21`), each `delay=2` DOS ticks (~55ms apart, `Δp3 = 0.056` -> 224ms blistering rapid barrage!)
    // And authentic 1995 DOS #040/#058 Celia triple bolt volley (`u_058_attack.png` f12..f14):
    // 3 rapid consecutive impacts ~50ms apart (`Δp3 = 0.055`) right after launching together as a tight salvo!
    const hitTimes3 = isArrowVolley3
      ? burstCount === 5
        ? [0.15, 0.206, 0.262, 0.318, 0.374]
        : Array.from({ length: burstCount }, (_, i) => 0.15 + i * Math.min(0.06, 0.26 / Math.max(1, burstCount - 1)))
      : isSniperVolley3
        ? Array.from({ length: burstCount }, (_, i) => 0.16 + i * (burstCount === 3 ? 0.055 : Math.min(0.06, 0.18 / Math.max(1, burstCount - 1))))
        : burstCount === 1
          ? [0.19]
          : Array.from({ length: burstCount }, (_, i) => 0.14 + i * ((burstCount >= 5 ? 0.42 : 0.36) / Math.max(1, burstCount - 1)));
    const yOffsets3 = isArrowVolley3 && burstCount === 5
      ? [44, 0, 20, -52, -16]
      : burstCount >= 5
        ? [-48, -22, 2, 26, 50]
        : burstCount === 1
          ? [0]
          : [-36, 6, 40];
    const xOffsets3 = isArrowVolley3 && burstCount === 5
      ? [0, 22, -24, 14, -6]
      : Array.from({ length: hitTimes3.length }, () => 0);

    let camShake = 0;
    let camZoom = 1.04;
    let impactFlashAlpha = 0;
    let shockwaveProgress = -1;
    let activeRecoil = 0;
    let activeFlash = 0;

    for (let hi = 0; hi < hitTimes3.length; hi++) {
      const hitAt = hitTimes3[hi];
      const isLastHit = hi === hitTimes3.length - 1;
      const hx = impactX + (xOffsets3[hi] ?? 0) * (isHeroAtk ? 1 : -1);
      const hy = impactY + (yOffsets3[hi % yOffsets3.length] ?? 0);
      if (p3 >= hitAt) {
        const span = isLastHit ? Math.max(0.32, 1 - hitAt) : isArrowVolley3 ? 0.16 : 0.28;
        const hp = Math.min(1, (p3 - hitAt) / span);
        this.fireOnce(`ranged_impact_${attackerSide}_${hi}`, () => {
          const hitList = actorUnit.sfxProfile?.hitSfxList ?? [];
          const hitSfx: SfxKind = hitList[hi] ?? hitList[hitList.length - 1] ?? 'bank:50:1';
          this.sound.playSfx(hitSfx);
          if (this.config.enableHitStopAndSparks) {
            this.hitStopRemainingMs = isLastHit
              ? (isCrit ? 88 : 60)
              : isArrowVolley3 || isSniperVolley3
                ? 12
                : 28;
          }
          this.spawnImpactSparks(
            hx,
            hy,
            targetHomeY,
            isArrowVolley3
              ? (isLastHit ? (isCrit ? 34 : 20) : 7)
              : (isLastHit ? (isCrit ? 85 : 58) : 34),
            projectileType === 'arrow' || projectileType === 'cryo_beam'
              ? ['#ffffff', '#e0f2fe', '#7dd3fc', '#38bdf8', '#2563eb']
              : projectileType === 'sniper_bolt'
                ? ['#ffffff', '#e2e8f0', '#cbd5e1', '#fde68a', '#f97316']
                : ['#ffffff', '#fde047', '#f59e0b', '#ef4444', '#fb923c'],
            isHeroAtk ? -1 : 1,
            -0.2
          );
          this.spawnDustPlume(targetHomeX, targetHomeY, isHeroAtk ? -1 : 1, -0.18, isLastHit ? 14 : isArrowVolley3 ? 4 : 7);
          const totalDmg = isHeroAtk ? this.thorStrikeDmg : this.banditStrikeDmg;
          const partDmg = isLastHit
            ? Math.max(1, totalDmg - Math.floor(totalDmg / hitTimes3.length) * (hitTimes3.length - 1))
            : Math.max(1, Math.floor(totalDmg / hitTimes3.length));
          if (isHeroAtk) {
            this.banditTargetHp = Math.max(0, this.banditTargetHp - partDmg);
          } else {
            this.thorTargetHp = Math.max(1, this.thorTargetHp - partDmg);
          }
        });

        const r = Math.sin(Math.min(1, hp * (isArrowVolley3 ? 2.5 : 2.1)) * Math.PI) * (isLastHit ? 1.0 : isArrowVolley3 ? 0.52 : 0.62);
        activeRecoil = Math.max(activeRecoil, r);
        activeFlash = Math.max(activeFlash, Math.max(0, 1 - hp * (isArrowVolley3 ? 3.8 : 3.2)) * (isLastHit ? 1.0 : 0.72));
        impactFlashAlpha = Math.max(impactFlashAlpha, Math.max(0, 1 - hp * 4.5) * (isLastHit ? 0.92 : isArrowVolley3 ? 0.48 : 0.65));
        if (isLastHit) shockwaveProgress = Math.min(1, hp * 1.9);
        camZoom = Math.max(camZoom, (isArrowVolley3 ? 1.11 : 1.14) - hp * 0.08);
        camShake = Math.max(
          camShake,
          this.config.enableHitStopAndSparks ? Math.max(0, (1 - hp * 2.6) * (isLastHit ? 22 : isArrowVolley3 ? 11 : 14)) : 0
        );
      }
    }

    const dir = isHeroAtk ? -1 : 1;
    targetSpec.x = targetHomeX + dir * activeRecoil * 62;
    targetSpec.y = targetHomeY + dir * activeRecoil * 18;
    targetSpec.rot = dir * activeRecoil * 0.11;
    targetSpec.scaleX = 1.0 - activeRecoil * 0.08;
    targetSpec.scaleY = 1.0 + activeRecoil * 0.06;
    targetSpec.flashWhite = activeFlash;

    const shakeX = camShake > 0 ? (Math.random() - 0.5) * camShake * 2 : 0;
    const shakeY = camShake > 0 ? (Math.random() - 0.5) * camShake * 1.5 : 0;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(W * 0.5 + shakeX, H * 0.5 + shakeY);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-W * 0.5, -H * 0.5);

    this.drawTerrainBackdrop(ctx, W, H, targetBgId, 0, 0, targetHomeY);
    this.drawGroundShadow(ctx, targetSpec.x, targetSpec.y, isHeroAtk ? 210 : 225);

    if (shockwaveProgress >= 0 && shockwaveProgress <= 1 && this.config.enableHitStopAndSparks) {
      this.drawGroundShockwave(ctx, impactX, targetHomeY - 12, shockwaveProgress);
    }

    this.renderCombatantWithBlend(
      ctx,
      targetPoses,
      targetSpec,
      isHeroAtk ? '#ef4444' : '#38bdf8',
      Math.round((isHeroAtk ? 610 : 700) * (targetUnit.displayScale ?? 1))
    );

    // Render all arriving projectiles streaking in horizontally from the edge into the target's torso!
    const approachSpan = isArrowVolley3 ? 0.115 : isSniperVolley3 ? 0.13 : 0.17;
    const projDir: -1 | 1 = isHeroAtk ? -1 : 1;
    for (let hi = 0; hi < hitTimes3.length; hi++) {
      const hitAt = hitTimes3[hi];
      const hx = impactX + (xOffsets3[hi] ?? 0) * (isHeroAtk ? 1 : -1);
      const hy = impactY + (yOffsets3[hi % yOffsets3.length] ?? 0);
      const enterAt = Math.max(0, hitAt - approachSpan);
      if (isArrowVolley3) {
        // Authentic DOS f16..f23 overlapping needle barrage:
        //  1) Entering arrow streaks rapidly in from the screen edge right to (hx, hy)
        //     (because `approachSpan` 0.115 > interval 0.068, the NEXT arrow already enters on the right
        //      at the exact moment the previous arrow strikes — just like DOS f16..f20!)
        //  2) On impact (`p3 >= hitAt`), NO clunky vibrating bolt stuck outside! The long luminous
        //     sapphire-white needle shaft rapidly collapses tail-into-tip (`280px -> 110px -> 36px -> 0`)
        //     straight into the wound point `(hx, hy)` with a razor-sharp cyan-white piercing star flash!
        if (p3 >= enterAt && p3 < hitAt) {
          const ap = (p3 - enterAt) / Math.max(0.01, hitAt - enterAt);
          const startX = isHeroAtk ? W + 40 : -40;
          const tipX = startX + (hx - startX) * ap;
          this.drawElvenSpiritArrow(ctx, tipX, hy, projDir, 1.04, 240);
        } else if (p3 >= hitAt && p3 < hitAt + 0.165) {
          const bp = (p3 - hitAt) / 0.165;
          const recoilShiftX = targetSpec.x - targetHomeX;
          this.drawSpiritArrowImpactStreak(ctx, hx + recoilShiftX * 0.45, hy, projDir, bp, hi === hitTimes3.length - 1);
        }
      } else if (projectileType === 'sniper_bolt') {
        // Authentic 1995 DOS #040 Celia (Sniper T2) F12..F17 triple heavy crossbow bolt volley:
        // Three sleek mahogany-shafted barbed steel bolts strike in rapid staggered order and remain
        // SIMULTANEOUSLY EMBEDDED & VIBRATING vertically stacked in the target's torso!
        const tightY = impactY + ([-18, 0, 18][hi % 3] ?? 0);
        const tailLead = [0, 8, -6][hi % 3] ?? 0;
        if (p3 >= enterAt && p3 < hitAt) {
          const ap = (p3 - enterAt) / Math.max(0.01, hitAt - enterAt);
          const startX = isHeroAtk ? W + 100 : -100;
          const tipX = startX + (impactX - startX) * ap;
          this.drawSniperCrossbowBolt(ctx, tipX, tightY, projDir, 1.12, true);
        } else if (p3 >= hitAt) {
          const holdAge = Math.max(0, p3 - hitAt);
          const vibFade = Math.max(0, 1 - holdAge / 0.24);
          const vibY = Math.sin(holdAge * 125 + hi * 1.4) * 3.8 * vibFade;
          const tailFade = p3 > 0.84 ? Math.max(0, 1 - (p3 - 0.84) / 0.16) : 1;
          ctx.save();
          ctx.globalAlpha = tailFade;
          const pinX = targetSpec.x + (isHeroAtk ? 24 + tailLead : -24 - tailLead);
          this.drawSniperCrossbowBolt(ctx, pinX, tightY + vibY, projDir, 1.0, false);
          ctx.restore();
        }
      } else if (projectileType === 'cryo_beam') {
        // Authentic 1995 DOS #045 Beckway (Sniper T2) F18..F20 roaring ice-blue plasma cannon wave!
        if (p3 >= enterAt && p3 < hitAt) {
          const ap = (p3 - enterAt) / Math.max(0.01, hitAt - enterAt);
          const startX = isHeroAtk ? W + 180 : -180;
          const bx = startX + (impactX - startX) * ap;
          this.drawCryoPlasmaWave(ctx, bx, hy, projDir, 1.38, ap);
        } else if (p3 >= hitAt && p3 < hitAt + 0.34) {
          const bp = (p3 - hitAt) / 0.34;
          this.drawCryoPlasmaImpact(ctx, impactX + (targetSpec.x - targetHomeX) * 0.45, hy, projDir, bp);
        }
      } else {
        if (p3 >= enterAt && p3 < hitAt) {
          const ap = (p3 - enterAt) / Math.max(0.01, hitAt - enterAt);
          const startX = isHeroAtk ? W + 120 : -120;
          const bx = startX + (impactX - startX) * ap;
          this.drawHdProjectile(ctx, bx, hy, projDir, projectileType, 1.25);
        } else if (p3 >= hitAt && p3 < hitAt + 0.14) {
          const bp = (p3 - hitAt) / 0.14;
          const vibY = Math.sin(bp * 45) * 4 * (1 - bp);
          ctx.save();
          ctx.globalAlpha = 1 - bp;
          this.drawHdProjectile(ctx, targetSpec.x + (isHeroAtk ? 30 : -30), hy + vibY, projDir, projectileType, 1.0);
          ctx.restore();
        }
      }
    }

    this.drawDustAndSparks(ctx);
    this.drawForegroundLeaves(ctx, targetBgId);
    ctx.restore();

    if ((this.hitStopRemainingMs > 0 || impactFlashAlpha > 0.05) && this.config.enableHitStopAndSparks) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const grad = ctx.createRadialGradient(impactX, impactY, 16, impactX, impactY, W * 0.65);
      const a = this.hitStopRemainingMs > 0 ? (isArrowVolley3 ? 0.42 : 0.55) : impactFlashAlpha * (isArrowVolley3 ? 0.36 : 0.45);
      if (projectileType === 'arrow' || projectileType === 'cryo_beam') {
        grad.addColorStop(0, `rgba(240, 249, 255, ${a})`);
        grad.addColorStop(0.35, `rgba(56, 189, 248, ${a * (projectileType === 'cryo_beam' ? 0.68 : 0.48)})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        grad.addColorStop(0, `rgba(255, 252, 220, ${a})`);
        grad.addColorStop(0.35, `rgba(245, 158, 11, ${a * 0.45})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    this.drawModernDualHud(ctx, W, H);
  }

  /**
   * Authentic Phase A Secondary Hero Skill / Spell-Chanting Playback (`u_XXX/ranged_0..5.webp`):
   *  - #018 Midi   (`sonic_crescent`)    : 3-stage remote crescent blade wave (音速刃)
   *  - #019 Rodman (`radiant_blade_cone`): blazing overhead ignite -> alternating gold/blue strobe flashes (淒煌斬)
   *  - #025 Shadow (`shadow_wave`)       : leaping ninja dual-blade electric crescent arc (影流斬)
   *  - #032 Thor   (`flame_blade_beam`)  : 3-stage vertical energy wall -> horizontal blazing flame beam (熾炎刀)
   *  - #034 Teno   (`sky_pillar`)        : 3-stage earth-plunge -> golden ground seal -> dropping sky pillar (天火劍柱)
   *  - #050 Thor   (`hero_chant`)        : delegates to 2-stage chanting cutaway using ranged_0..5.webp (英雄詠唱)
   */
  private renderHeroSkillScene(ctx: CanvasRenderingContext2D, W: number, H: number, startMs: number): void {
    const hero = this.vfxAssets.rightUnit;
    const target = this.vfxAssets.leftUnit;
    const sk = hero.rangedSkill;
    const poses = this.vfxAssets.thorRangedPoses;
    if (!sk || poses.length < 6 || sk.mode === 'hero_chant') {
      this.renderModernMagicScene(ctx, W, H, startMs);
      return;
    }

    const isEn = getLocale() === 'en';
    const localT = Math.max(0, this.elapsedMs - startMs);
    const heroBgId = this.vfxAssets.heroBgId;
    const enemyBgId = this.vfxAssets.enemyBgId;
    const heroTerrain = getTerrainPreset(heroBgId);
    const enemyTerrain = getTerrainPreset(enemyBgId);
    const skillName = isEn ? sk.nameEn : sk.nameZh;
    const heroDisp = Math.round(720 * (hero.displayScale ?? 1));
    const targetDisp = Math.round(610 * (target.displayScale ?? 1));
    const targetPoses = this.getActivePoseList('bandit');

    // Helper 1: draw #018 Midi's EXACT F5 jagged ice-blue/gold sonic blade-wave (`ranged_proj.webp`)
    // extracted directly from u_018/ranged_4.webp (with leading fire-gold aura glow, trailing wake ghost & sparks!).
    const drawSonicWaveProj = (
      destX: number,
      destY: number,
      dispW: number,
      dispH: number,
      alpha: number,
      showTrail = true
    ) => {
      const a = Math.max(0, Math.min(1, alpha));
      if (a <= 0.01) return;
      const projImg = this.vfxAssets.thorRangedProj;
      ctx.save();
      if (projImg && projImg.complete && projImg.naturalWidth > 0) {
        // Luminous golden-cyan bow halo behind the painted wave front edge
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const glowCx = destX + dispW * 0.20;
        const glowCy = destY + dispH * 0.72;
        const gGlow = ctx.createRadialGradient(glowCx, glowCy, 10, glowCx, glowCy, dispW * 0.56);
        gGlow.addColorStop(0, `rgba(255, 248, 210, ${0.42 * a})`);
        gGlow.addColorStop(0.38, `rgba(253, 224, 71, ${0.28 * a})`);
        gGlow.addColorStop(0.68, `rgba(56, 189, 248, ${0.22 * a})`);
        gGlow.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = gGlow;
        ctx.beginPath();
        ctx.arc(glowCx, glowCy, dispW * 0.56, 0, Math.PI * 2);
        ctx.fill();
        if (showTrail) {
          // Soft icy-blue high-speed afterimage echoes streaming right behind the cutting wave
          for (let g = 2; g >= 1; g--) {
            ctx.globalAlpha = a * (0.30 / g);
            ctx.drawImage(projImg, destX + g * 46, destY + g * 3, dispW * (1 + g * 0.03), dispH);
          }
        }
        ctx.restore();
        // Crisp actual F5 painted blade wave (matches u_018/ranged_4.webp 1:1!)
        ctx.globalAlpha = a;
        ctx.drawImage(projImg, destX, destY, dispW, dispH);
        // Subtle crisp energy flicker highlight in additive pass so edges sing over any backdrop
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = a * 0.42;
        ctx.drawImage(projImg, destX - 2, destY, dispW, dispH);
        // Flying hot ember / frost flecks trailing off the leading gold-flame rim
        for (let k = 0; k < 10; k++) {
          const u = k / 9;
          const sx = destX + dispW * (0.04 + u * 0.65) + Math.sin(localT * 0.04 + k * 2.1) * 14;
          const sy = destY + dispH * (0.90 - Math.sin(u * Math.PI * 0.52) * 0.84) + Math.cos(localT * 0.05 + k) * 9;
          const len = 18 + (k % 3) * 16;
          ctx.strokeStyle = k % 2 === 0 ? `rgba(253, 224, 71, ${0.82 * a})` : `rgba(186, 230, 253, ${0.78 * a})`;
          ctx.lineWidth = k % 2 === 0 ? 3 : 2;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + len, sy + (k % 2 === 0 ? -4 : 4));
          ctx.stroke();
        }
        ctx.restore();
      } else {
        // Fallback if sprite still decoding
        const rad = dispH * 0.5;
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = a;
        ctx.translate(destX + rad, destY + rad);
        const g = ctx.createRadialGradient(rad * 0.12, 0, rad * 0.45, 0, 0, rad * 1.08);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.65, 'rgba(186,230,253,0.92)');
        g.addColorStop(0.9, 'rgba(253,224,71,0.95)');
        g.addColorStop(1, 'rgba(249,115,22,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, rad, Math.PI * 0.56, Math.PI * 1.46);
        ctx.arc(rad * 0.46, 0, rad * 0.78, Math.PI * 1.38, Math.PI * 0.62, true);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    };

    // Helper 2: draw #032 Thor (Sword Saint) organic roaring `熾炎刀` blazing Qi-beam missile!
    // Authentic homage to 1995 DOS `u_032_ranged.png` F9..F13: rounded incandescent comet nose pointing LEFT,
    // sweeping serrated flame-crown edge, turbulent billowing Qi shaft with braided golden-white ribbons,
    // and torn asymmetrical jagged dragon-fire shark-tooth tail (zero flat rectangular edges!).
    const drawFlameBladeQiBeam = (
      frontX: number,
      tailX: number,
      cy: number,
      halfH: number,
      alpha: number,
      tMs: number,
      pinTailToBlade = false
    ) => {
      const a = Math.max(0, Math.min(1, alpha));
      if (a <= 0.01 || tailX <= frontX + 12) return;
      const bodyLen = tailX - frontX;
      const noseRx = Math.min(halfH * 1.35, bodyLen * 0.45);
      const phase = tMs * 0.022;

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = a;

      // Helper to trace an organic turbulent beam contour (rounded bow nose LEFT -> wavy body -> jagged spiked flame tail RIGHT!)
      const traceQiSilhouette = (
        hScale: number,
        nosePad: number,
        tailStretch: number,
        ripAmp: number,
        tailTeeth: number,
        phaseShift: number
      ) => {
        const hh = halfH * hScale;
        const fx = frontX - nosePad;
        const bowEnd = Math.min(tailX, fx + noseRx * hScale);
        const topSegs = 26;
        const botSegs = 26;
        ctx.beginPath();
        // Rounded fiery parabolic comet head (bottom -> nose tip -> top, sweeping curving bow!)
        for (let i = 0; i <= 16; i++) {
          const ang = Math.PI * 0.5 + (i / 16) * Math.PI; // +90° (bottom) -> 180° (left nose) -> 270° (top)
          const r = 1 + Math.sin(i * 1.9 + phase * 1.4 + phaseShift) * 0.045 * (i > 1 && i < 15 ? 1 : 0);
          const px = fx + noseRx * hScale + Math.cos(ang) * (noseRx * hScale) * r;
          const py = cy + Math.sin(ang) * hh * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        // Top turbulent licking fire border from bowEnd -> tailX
        for (let i = 1; i <= topSegs; i++) {
          const u = i / topSegs;
          const px = bowEnd + (tailX - bowEnd) * u;
          const taper = pinTailToBlade
            ? 1 - Math.pow(u, 2.2) * 0.52
            : 1 - Math.pow(u, 3.0) * 0.24;
          const wave =
            Math.sin(u * 14 - phase * 1.3 + phaseShift) * ripAmp * 0.55 +
            Math.sin(u * 31 - phase * 2.4 + phaseShift * 1.7) * ripAmp * 0.45;
          // Licking fire crest flares up more near head collar & tail edge
          const flare = Math.sin(u * Math.PI) * 0.14 + (u < 0.22 ? (0.22 - u) * 0.35 : 0);
          ctx.lineTo(px, cy - hh * (taper + flare) - wave);
        }
        // Jagged asymmetrical serrated shark-tooth flame tail (replaces blunt flat right wall!)
        const teeth = tailTeeth;
        for (let ti = 0; ti <= teeth; ti++) {
          const v = ti / teeth; // 0 (top) -> 1 (bottom)
          const yBase = cy - hh * (pinTailToBlade ? 0.48 : 0.78) + v * hh * (pinTailToBlade ? 0.96 : 1.56);
          const centerEnv = 1 - Math.pow(Math.abs(v - 0.5) * 2, 1.8) * 0.42;
          const spikeLen =
            ti % 2 === 0
              ? tailStretch * centerEnv * (0.45 + 0.55 * Math.abs(Math.sin(ti * 2.13 + phase * 0.7 + phaseShift)))
              : -tailStretch * 0.38 * (0.4 + 0.6 * Math.abs(Math.cos(ti * 1.67 + phase * 0.9)));
          ctx.lineTo(tailX + spikeLen, yBase);
        }
        // Bottom turbulent licking fire border returning from tailX -> bowEnd
        for (let i = botSegs - 1; i >= 0; i--) {
          const u = i / botSegs;
          const px = bowEnd + (tailX - bowEnd) * u;
          const taper = pinTailToBlade
            ? 1 - Math.pow(u, 2.2) * 0.52
            : 1 - Math.pow(u, 3.0) * 0.24;
          const wave =
            Math.sin(u * 15 - phase * 1.4 + phaseShift + 1.4) * ripAmp * 0.55 +
            Math.cos(u * 29 - phase * 2.2 + phaseShift) * ripAmp * 0.45;
          const flare = Math.sin(u * Math.PI) * 0.14 + (u < 0.22 ? (0.22 - u) * 0.35 : 0);
          ctx.lineTo(px, cy + hh * (taper + flare) + wave);
        }
        ctx.closePath();
      };

      // Layer 1: Soft wide crimson-orange burning atmospheric haze enveloping comet head & plume
      const noseGlow = ctx.createRadialGradient(
        frontX + noseRx * 0.65,
        cy,
        halfH * 0.12,
        frontX + noseRx * 0.65,
        cy,
        halfH * 2.35
      );
      noseGlow.addColorStop(0, 'rgba(255, 251, 224, 0.78)');
      noseGlow.addColorStop(0.28, 'rgba(253, 224, 71, 0.52)');
      noseGlow.addColorStop(0.58, 'rgba(234, 88, 12, 0.28)');
      noseGlow.addColorStop(1, 'rgba(154, 52, 18, 0)');
      ctx.fillStyle = noseGlow;
      ctx.beginPath();
      ctx.ellipse(frontX + noseRx * 0.65, cy, halfH * 2.2, halfH * 1.9, 0, 0, Math.PI * 2);
      ctx.fill();

      // Layer 2: Outer roaring crimson-amber serrated Qi fire plume
      const outerGrad = ctx.createLinearGradient(0, cy - halfH * 1.5, 0, cy + halfH * 1.5);
      outerGrad.addColorStop(0, 'rgba(185, 28, 28, 0.10)');
      outerGrad.addColorStop(0.18, 'rgba(234, 88, 12, 0.88)');
      outerGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.96)');
      outerGrad.addColorStop(0.82, 'rgba(234, 88, 12, 0.88)');
      outerGrad.addColorStop(1, 'rgba(185, 28, 28, 0.10)');
      traceQiSilhouette(1.24, 18, pinTailToBlade ? 65 : 195, halfH * 0.18, 24, 0);
      ctx.fillStyle = outerGrad;
      ctx.fill();

      // Layer 3: Mid glowing solar-gold body shell
      const midGrad = ctx.createLinearGradient(0, cy - halfH, 0, cy + halfH);
      midGrad.addColorStop(0, 'rgba(245, 158, 11, 0.25)');
      midGrad.addColorStop(0.22, 'rgba(253, 224, 71, 0.95)');
      midGrad.addColorStop(0.5, 'rgba(254, 249, 195, 1)');
      midGrad.addColorStop(0.78, 'rgba(253, 224, 71, 0.95)');
      midGrad.addColorStop(1, 'rgba(245, 158, 11, 0.25)');
      traceQiSilhouette(0.88, 8, pinTailToBlade ? 42 : 138, halfH * 0.12, 20, 1.3);
      ctx.fillStyle = midGrad;
      ctx.fill();

      // Layer 4: Blinding pure white-cream incandescent Qi plasma core (DOS F9..F11 core!)
      traceQiSilhouette(0.56, 2, pinTailToBlade ? 22 : 85, halfH * 0.08, 16, 2.7);
      ctx.fillStyle = 'rgba(255, 255, 244, 0.98)';
      ctx.fill();

      // Layer 5: Authentic swept-back bow-shock crescent collar & fiery comet nose horns!
      ctx.lineCap = 'round';
      for (let side of [-1, 1]) {
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.86)';
        ctx.lineWidth = Math.max(4, halfH * 0.09);
        ctx.beginPath();
        ctx.moveTo(frontX - 10, cy + side * halfH * 0.12);
        ctx.quadraticCurveTo(
          frontX + noseRx * 0.45,
          cy + side * halfH * 1.18,
          frontX + noseRx * 2.15,
          cy + side * halfH * 1.48
        );
        ctx.stroke();
        // Thin crackling sky-cyan rim accent tying straight back to Thor's blue-gold F4 vertical wall!
        ctx.strokeStyle = 'rgba(125, 211, 252, 0.55)';
        ctx.lineWidth = Math.max(2, halfH * 0.032);
        ctx.beginPath();
        ctx.moveTo(frontX + noseRx * 0.15, cy + side * halfH * 0.52);
        ctx.quadraticCurveTo(
          frontX + noseRx * 0.85,
          cy + side * halfH * 1.24,
          frontX + noseRx * 2.55,
          cy + side * halfH * 1.22
        );
        ctx.stroke();
      }

      // Layer 6: Organic fiery bow-shock licks sweeping back along the curved rounded dome nose (never a flat vertical column!)
      for (let s = 0; s < 13; s++) {
        const v = (s / 12) * 2 - 1; // -1 (top) -> +1 (bottom)
        const ang = Math.PI + v * Math.PI * 0.44;
        const arcX = frontX + noseRx * (0.95 + Math.cos(ang) * 0.85);
        const fy = cy + Math.sin(ang) * halfH * 0.96;
        const jitter = 0.45 + 0.55 * Math.abs(Math.sin(s * 3.17 + phase * 1.4));
        const slen = (32 + (s % 3) * 26) * jitter * (1 - Math.abs(v) * 0.35);
        ctx.fillStyle =
          s % 2 === 0 ? 'rgba(249, 115, 22, 0.42)' : 'rgba(253, 224, 71, 0.36)';
        ctx.beginPath();
        ctx.moveTo(arcX, fy - 4.5);
        ctx.lineTo(arcX + slen, fy + v * 5);
        ctx.lineTo(arcX, fy + 4.5);
        ctx.closePath();
        ctx.fill();
      }

      // Layer 7: Swirling braided double-helix Qi energy ribbons weaving smoothly down the shaft!
      const ribSpan = Math.max(40, bodyLen - noseRx * 0.5);
      for (let h = 0; h < 2; h++) {
        ctx.beginPath();
        const steps = 28;
        for (let i = 0; i <= steps; i++) {
          const u = i / steps;
          const rx = frontX + noseRx * 0.45 + ribSpan * u;
          const amp = halfH * (0.58 - u * (pinTailToBlade ? 0.28 : 0.06));
          const ry = cy + Math.sin(u * Math.PI * 5 - phase * 1.8 + h * Math.PI) * amp;
          if (i === 0) ctx.moveTo(rx, ry);
          else ctx.lineTo(rx, ry);
        }
        ctx.strokeStyle = h === 0 ? 'rgba(255, 250, 220, 0.72)' : 'rgba(251, 146, 60, 0.65)';
        ctx.lineWidth = h === 0 ? 5.5 : 4.0;
        ctx.stroke();
      }

      // Layer 8: Detached tapered flame-spear embers & Qi wisps streaking back past the jagged tail!
      const sparkCount = pinTailToBlade ? 9 : 16;
      for (let k = 0; k < sparkCount; k++) {
        const f = ((k * 0.37 + phase * 0.09) % 1);
        const sx = tailX - 25 + f * (pinTailToBlade ? 90 : 280);
        const sy = cy + Math.sin(k * 4.3 + phase * 0.4) * halfH * 1.25;
        const slen = (32 + (k % 4) * 28) * (1 - f * 0.7);
        ctx.fillStyle =
          k % 3 === 0
            ? `rgba(255, 252, 220, ${(1 - f) * 0.92})`
            : k % 3 === 1
              ? `rgba(253, 224, 71, ${(1 - f) * 0.85})`
              : `rgba(249, 115, 22, ${(1 - f) * 0.78})`;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + slen * 0.35, sy - 3.2);
        ctx.lineTo(sx + slen, sy);
        ctx.lineTo(sx + slen * 0.35, sy + 3.2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    };

    // Helper 3: draw #032 Thor (Sword Saint) roaring ABSTRACTED FLAME-DRAGON head (`u_032/ranged_proj.webp`)
    // seamlessly grafted onto our turbulent organic blazing fire-beam shaft + jagged dragon-fire tail!
    const drawFlameDragonMissile = (
      snoutX: number,
      tailX: number,
      cy: number,
      halfH: number,
      alpha: number,
      tMs: number,
      pinTailToBlade = false
    ) => {
      const a = Math.max(0, Math.min(1, alpha));
      if (a <= 0.01) return;
      const dImg = this.vfxAssets.thorRangedProj;
      if (dImg && dImg.complete && dImg.naturalWidth > 0) {
        // Aspect 880x491: glowing right shaft spans roughly middle 42% height -> scale dragon height generously!
        const dragonH = Math.round(halfH * 3.85);
        const dragonW = Math.round(dragonH * (dImg.naturalWidth / dImg.naturalHeight));
        const headLeft = snoutX - dragonW * 0.06;
        const headTop = cy - dragonH * 0.494;
        // Start continuous roaring horizontal beam tucked cleanly INSIDE the dragon throat (`x = headLeft + 0.46 * dragonW`)
        const throatX = headLeft + dragonW * 0.48;
        if (tailX > throatX + 24) {
          drawFlameBladeQiBeam(throatX, tailX, cy, halfH * 0.88, a, tMs, pinTailToBlade);
        }
        // Rich opaque fiery dragon head (crystal-sharp claws/fangs/cyan eye even over sunlit meadow!)
        ctx.save();
        if (pinTailToBlade) {
          // Clip dragon plume cleanly right at Thor's sword launch plane so it erupts forward, never behind his cape!
          ctx.beginPath();
          ctx.rect(-800, -200, tailX + 836, H + 400);
          ctx.clip();
        }
        ctx.globalAlpha = a;
        // Subtle animated vibration flicker matching roaring live dragon flames
        const vibY = Math.sin(tMs * 0.045) * 3.5;
        const stretchX = 1 + Math.sin(tMs * 0.06) * 0.018;
        ctx.drawImage(dImg, headLeft, headTop + vibY, dragonW * stretchX, dragonH);
        // Additive blazing bloom pass intensifying the molten core, glowing cyan eye & soaring fire whiskers
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = a * 0.48;
        ctx.drawImage(dImg, headLeft - 4, headTop + vibY, dragonW * stretchX, dragonH);
        // Incandescent ambient aura halo wrapping the roaring mouth fireball
        const mx = headLeft + dragonW * 0.21;
        const mg = ctx.createRadialGradient(mx, cy + 4, 8, mx, cy + 4, dragonH * 0.46);
        mg.addColorStop(0, `rgba(255, 252, 224, ${0.44 * a})`);
        mg.addColorStop(0.42, `rgba(253, 224, 71, ${0.24 * a})`);
        mg.addColorStop(1, 'rgba(234, 88, 12, 0)');
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.arc(mx, cy + 4, dragonH * 0.46, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        drawFlameBladeQiBeam(snoutX, tailX, cy, halfH, a, tMs, pinTailToBlade);
      }
    };

    // -------------------------------------------------------------------------
    // A. UNIFIED MELEE/CLOSE SKILLS: #019 Rodman (`radiant_blade_cone`) & #025 Shadow (`shadow_wave`)
    // -------------------------------------------------------------------------
    if (!sk.isRemote) {
      const isRadiantCone = sk.mode === 'radiant_blade_cone';
      const totalDur = isRadiantCone ? 2780 : 2350;
      const p = Math.min(1, localT / totalDur);
      const banditHomeX = W * 0.27;
      const banditHomeY = H * 0.68;
      const heroHomeX = W * 0.70;
      const heroHomeY = H * 0.90;
      this.activeStageBadge = isEn
        ? `🌀 Signature Skill: ${hero.nameEn} · ${skillName}`
        : `🌀 專屬劍技：${hero.nameZh} · ${skillName}`;

      const heroSpec: PoseRenderSpec = {
        primaryIdx: 0,
        x: heroHomeX,
        y: heroHomeY,
        scaleX: 1,
        scaleY: 1,
        rot: 0,
        flashWhite: 0,
        afterimages: 0,
        dashDirX: -1,
        dashDirY: -0.35,
      };
      const enemySpec: PoseRenderSpec = {
        primaryIdx: 0,
        x: banditHomeX,
        y: banditHomeY,
        scaleX: 1,
        scaleY: 1,
        rot: 0,
        flashWhite: 0,
        afterimages: 0,
        dashDirX: 1,
        dashDirY: 0.35,
      };

      let camShake = 0;
      let camZoom = 1.0 + Math.sin(Math.min(1, p * 1.35) * Math.PI) * (isRadiantCone ? 0.11 : 0.07);
      let strobeIdx = -1; // >=0 during #019 rapid gold/blue wave pulse!
      let r19ChargeP = -1; // 0..1 during overhead solar ignition windup (F2..F3)
      let r19StrikeP = -1; // 0..1 during grand climax strobe release (F4 <-> F5)
      let r19AfterP = -1; // 0..1 cooling aftermath ember fade (F6)
      let r19DimAlpha = 0;
      let cutInP = -1;

      if (isRadiantCone) {
        if (this.config.enableAnimeCutIn && p >= 0.06 && p <= 0.32) {
          cutInP = (p - 0.06) / 0.26;
        }
        if (p < 0.12) {
          heroSpec.primaryIdx = 0;
          r19DimAlpha = (p / 0.12) * 0.30;
        } else if (p < 0.26) {
          heroSpec.primaryIdx = 1;
          r19ChargeP = ((p - 0.12) / 0.32);
          r19DimAlpha = 0.30 + ((p - 0.12) / 0.14) * 0.20;
          this.fireOnce('r19_ignite_sfx', () => {
            this.sound.playSfx('bank:49:1');
          });
        } else if (p < 0.44) {
          heroSpec.primaryIdx = 2;
          r19ChargeP = (p - 0.12) / 0.32;
          r19DimAlpha = 0.50 + ((p - 0.26) / 0.18) * 0.10;
          camShake = 2.6 * ((p - 0.26) / 0.18);
          this.fireOnce('r19_charge_sparks', () => {
            this.spawnImpactSparks(
              heroHomeX + 35,
              heroHomeY - 265,
              heroHomeY,
              24,
              ['#ffffff', '#fef08a', '#f59e0b', '#fb923c'],
              0,
              -0.9
            );
          });
        } else if (p < 0.82) {
          // Alternating GOLD (F4, idx 3) <-> ELECTRIC SAPPHIRE-WHITE (F5, idx 4) matching DOS u_019_ranged F7..F14!
          const sp = (p - 0.44) / 0.38;
          r19StrikeP = sp;
          const toggle = Math.floor(sp * 10) % 2;
          heroSpec.primaryIdx = toggle === 0 ? 3 : 4;
          strobeIdx = toggle;
          r19DimAlpha = 0.62 * (1 - sp * 0.18);
          const strikeX = banditHomeX + 205;
          const strikeY = banditHomeY + 112;
          const slide = Math.min(1, sp * 7.5);
          heroSpec.x = heroHomeX + (strikeX - heroHomeX) * slide;
          heroSpec.y = heroHomeY + (strikeY - heroHomeY) * slide;
          heroSpec.afterimages = slide < 0.98 ? 4 : 0;
          const hitPulse = Math.sin(((sp * 4) % 1) * Math.PI);
          enemySpec.x = banditHomeX - hitPulse * 46;
          enemySpec.y = banditHomeY - hitPulse * 16;
          enemySpec.flashWhite = toggle === 0 ? 0.72 : 0.94;
          camShake = 14 * (1 - sp * 0.35);
          const hitTick = Math.min(3, Math.floor(sp * 4));
          this.fireOnce(`r19_hit_${hitTick}`, () => {
            this.sound.playSfx(hitTick === 3 ? 'crit' : 'bank:50:1');
            if (hitTick === 3) {
              this.hitStopRemainingMs = 65;
            }
            this.spawnImpactSparks(
              banditHomeX + 18,
              banditHomeY - 195,
              banditHomeY,
              hitTick === 3 ? 52 : 28,
              toggle === 0
                ? ['#ffffff', '#fef08a', '#fde047', '#f59e0b']
                : ['#ffffff', '#e0f2fe', '#7dd3fc', '#38bdf8'],
              -1,
              -0.32
            );
            this.banditTargetHp = Math.max(0, this.banditTargetHp - 7);
          });
        } else {
          const ep = (p - 0.82) / 0.18;
          r19AfterP = ep;
          r19DimAlpha = 0.48 * (1 - ep);
          heroSpec.primaryIdx = 5;
          const strikeX = banditHomeX + 205;
          const strikeY = banditHomeY + 112;
          heroSpec.x = strikeX + (heroHomeX - strikeX) * ep;
          heroSpec.y = strikeY + (heroHomeY - strikeY) * ep;
        }
      } else {
        // #025 Shadow (`shadow_wave` — 影流斬!)
        if (this.config.enableAnimeCutIn && p >= 0.06 && p <= 0.30) {
          cutInP = (p - 0.06) / 0.24;
        }
        const strikeX = banditHomeX + 210;
        const strikeY = banditHomeY + 95;
        if (p < 0.16) {
          heroSpec.primaryIdx = 0;
        } else if (p < 0.30) {
          heroSpec.primaryIdx = 1;
        } else if (p < 0.42) {
          const dp = (p - 0.30) / 0.12;
          heroSpec.primaryIdx = 2;
          heroSpec.x = heroHomeX + (strikeX - heroHomeX) * dp;
          heroSpec.y = heroHomeY + (strikeY - heroHomeY) * dp;
          heroSpec.afterimages = 3;
        } else if (p < 0.62) {
          heroSpec.primaryIdx = 3;
          heroSpec.x = strikeX;
          heroSpec.y = strikeY;
          const rp = (p - 0.42) / 0.20;
          enemySpec.x = banditHomeX - Math.sin(rp * Math.PI) * 52;
          enemySpec.flashWhite = Math.max(0, 1 - rp * 2.2);
          camShake = (1 - rp) * 14;
          this.fireOnce('s25_hit', () => {
            this.sound.playSfx('crit');
            this.hitStopRemainingMs = 70;
            this.spawnImpactSparks(banditHomeX + 20, banditHomeY - 190, banditHomeY, 48, ['#ffffff', '#e0f2fe', '#38bdf8', '#22d3ee'], -1, -0.15);
            this.banditTargetHp = Math.max(0, this.banditTargetHp - 28);
          });
        } else if (p < 0.78) {
          heroSpec.primaryIdx = 4;
          heroSpec.x = strikeX;
          heroSpec.y = strikeY;
        } else {
          const ep = (p - 0.78) / 0.22;
          heroSpec.primaryIdx = 5;
          heroSpec.x = strikeX + (heroHomeX - strikeX) * ep;
          heroSpec.y = strikeY + (heroHomeY - strikeY) * ep;
        }
      }

      const sx = camShake > 0 ? (Math.random() - 0.5) * camShake * 2 : 0;
      const sy = camShake > 0 ? (Math.random() - 0.5) * camShake * 1.4 : 0;
      ctx.save();
      ctx.translate(W * 0.5 + sx, H * 0.5 + sy);
      ctx.scale(camZoom, camZoom);
      ctx.translate(-W * 0.5, -H * 0.5);
      this.drawTerrainBackdrop(ctx, W, H, enemyBgId, 0, 0, banditHomeY);

      // Dramatic darkened atmosphere sky backdrop during #019 淒煌斬 so golden/sapphire flare shines epic!
      if (isRadiantCone && r19DimAlpha > 0.01) {
        const skyDim = ctx.createRadialGradient(
          strobeIdx >= 0 ? banditHomeX + 100 : heroSpec.x,
          strobeIdx >= 0 ? banditHomeY - 110 : heroSpec.y - 180,
          140,
          W * 0.5,
          H * 0.5,
          W * 0.85
        );
        skyDim.addColorStop(0, `rgba(10, 14, 34, ${r19DimAlpha * 0.52})`);
        skyDim.addColorStop(1, `rgba(3, 6, 18, ${r19DimAlpha})`);
        ctx.fillStyle = skyDim;
        ctx.fillRect(-140, -140, W + 280, H + 280);
      }

      this.drawGroundShadow(ctx, enemySpec.x, enemySpec.y, 210);
      this.drawGroundShadow(ctx, heroSpec.x, heroSpec.y, 230);

      // #019 Stage A (F2..F3): Towering vertical solar ignition column & pulsing ground pressure rings behind Rodman!
      if (isRadiantCone && r19ChargeP >= 0) {
        const cp = Math.min(1, r19ChargeP);
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        // Expanding horizontal ground wind/qi rings beneath Rodman's stance
        for (let r = 0; r < 3; r++) {
          const rp = (cp * 2.2 + r * 0.33) % 1;
          const rad = 75 + rp * 195;
          ctx.save();
          ctx.translate(heroSpec.x + 8, heroSpec.y - 16);
          ctx.scale(1, 0.27);
          ctx.strokeStyle =
            r % 2 === 0
              ? `rgba(253, 224, 71, ${(1 - rp) * 0.72 * cp})`
              : `rgba(254, 249, 195, ${(1 - rp) * 0.65 * cp})`;
          ctx.lineWidth = 6 - rp * 3.5;
          ctx.beginPath();
          ctx.arc(0, 0, rad, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        // Sky-piercing solar ignition beam radiating up from Rodman's raised greatsword
        const bx = heroSpec.x + 36;
        const bw = (38 + cp * 110) * (0.85 + 0.15 * Math.sin(localT * 0.03));
        const colGrad = ctx.createLinearGradient(bx - bw, 0, bx + bw, 0);
        colGrad.addColorStop(0, 'rgba(245, 158, 11, 0)');
        colGrad.addColorStop(0.28, `rgba(251, 191, 36, ${0.32 * cp})`);
        colGrad.addColorStop(0.5, `rgba(255, 251, 220, ${0.68 * cp})`);
        colGrad.addColorStop(0.72, `rgba(251, 191, 36, ${0.32 * cp})`);
        colGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
        ctx.fillStyle = colGrad;
        ctx.fillRect(bx - bw, -120, bw * 2, heroSpec.y - 110);
        // Subtle crackling radial flare rays converging into raised greatsword core
        const bladeX = heroSpec.x + 65;
        const bladeY = heroSpec.y - 295;
        const starGrad = ctx.createRadialGradient(bladeX, bladeY, 6, bladeX, bladeY, 170 * cp);
        starGrad.addColorStop(0, `rgba(255, 255, 245, ${0.88 * cp})`);
        starGrad.addColorStop(0.35, `rgba(253, 224, 71, ${0.52 * cp})`);
        starGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
        ctx.fillStyle = starGrad;
        ctx.beginPath();
        ctx.arc(bladeX, bladeY, 170 * cp, 0, Math.PI * 2);
        ctx.fill();
        for (let k = 0; k < 10; k++) {
          const ang = (k * Math.PI * 2) / 10 + localT * 0.005;
          const rIn = 18 + ((1 - ((cp * 2.5 + k * 0.19) % 1)) * 165);
          const rOut = rIn + 48;
          ctx.strokeStyle = k % 2 === 0 ? `rgba(254, 240, 138, ${0.62 * cp})` : `rgba(125, 211, 252, ${0.42 * cp})`;
          ctx.lineWidth = k % 2 === 0 ? 3.2 : 2.0;
          ctx.beginPath();
          ctx.moveTo(bladeX + Math.cos(ang) * rIn, bladeY + Math.sin(ang) * rIn);
          ctx.lineTo(bladeX + Math.cos(ang) * rOut, bladeY + Math.sin(ang) * rOut);
          ctx.stroke();
        }
        ctx.restore();
      }

      // #019 Stage B BACKDROP (behind enemy & Rodman): Twin shockwave rings + epic fan sunrays
      if (isRadiantCone && strobeIdx >= 0 && r19StrikeP >= 0) {
        const sp = r19StrikeP;
        const isGold = strobeIdx === 0;
        const impX = banditHomeX + 32;
        const impY = banditHomeY - 175;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        // Dramatic sky-filling directional starburst spikes fanning from behind Bandit/blade
        const burstGrad = ctx.createRadialGradient(impX, impY, 14, impX, impY, 540);
        burstGrad.addColorStop(0, isGold ? 'rgba(255, 255, 235, 0.78)' : 'rgba(240, 249, 255, 0.82)');
        burstGrad.addColorStop(0.28, isGold ? 'rgba(253, 224, 71, 0.44)' : 'rgba(56, 189, 248, 0.48)');
        burstGrad.addColorStop(0.65, isGold ? 'rgba(234, 88, 12, 0.16)' : 'rgba(37, 99, 235, 0.18)');
        burstGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = burstGrad;
        ctx.beginPath();
        ctx.arc(impX, impY, 540, 0, Math.PI * 2);
        ctx.fill();

        // Twin sweeping ground crater rings pulsing out under combatants
        for (let r = 0; r < 2; r++) {
          const rp = (sp * 3.2 + r * 0.5) % 1;
          const rw = 120 + rp * 440;
          ctx.save();
          ctx.translate(banditHomeX + 90, banditHomeY + 28);
          ctx.scale(1, 0.25);
          ctx.strokeStyle = isGold
            ? `rgba(253, 224, 71, ${(1 - rp) * 0.82})`
            : `rgba(125, 211, 252, ${(1 - rp) * 0.86})`;
          ctx.lineWidth = 10 * (1 - rp * 0.65);
          ctx.beginPath();
          ctx.arc(0, 0, rw, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        ctx.restore();
      }

      this.renderCombatantWithBlend(ctx, targetPoses, enemySpec, '#ef4444', targetDisp);

      if (strobeIdx >= 0) {
        const isGold = strobeIdx === 0;
        // Colossal golden/sapphire fan blast radiating diagonally past Bandit to edge of viewport!
        this.drawStationaryKiSplash(
          ctx,
          heroSpec.x - 135,
          heroSpec.y - 195,
          banditHomeX + 10,
          banditHomeY - 185,
          0.16 + ((localT % 240) / 240) * 0.18,
          false,
          isGold ? 'gold' : 'azure',
          152,
          localT
        );
      }

      this.renderCombatantWithBlend(
        ctx,
        poses,
        heroSpec,
        strobeIdx === 0 ? '#fde047' : '#38bdf8',
        heroDisp
      );

      // #019 Stage B FOREGROUND: Sky-cleaving diagonal cross-slash spears & crackling lightning bolts!
      if (isRadiantCone && strobeIdx >= 0 && r19StrikeP >= 0) {
        const sp = r19StrikeP;
        const isGold = strobeIdx === 0;
        const impX = banditHomeX + 18;
        const impY = banditHomeY - 175;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        // Razor-tapered diagonal diamond blade slash smears cutting sharply across Bandit (tapered needle tips, no blunt rods!)
        const slashSpecs = [
          { dx: 365, dy: -215, w: 12, a: 0.86 },
          { dx: -335, dy: -195, w: 9, a: 0.74 },
          { dx: 410, dy: -52, w: 8, a: 0.62 },
        ];
        const flicker = 0.75 + 0.25 * Math.sin(localT * 0.08);
        const phaseTick = Math.floor(sp * 10);
        for (let si = 0; si < slashSpecs.length; si++) {
          const s = slashSpecs[si];
          const rotOff = Math.sin(phaseTick * 2.3 + si * 1.7) * 26;
          const x1 = impX - s.dx * 0.72;
          const y1 = impY - s.dy * 0.72 + rotOff;
          const x2 = impX + s.dx * 0.68;
          const y2 = impY + s.dy * 0.68 - rotOff;
          const len = Math.max(1, Math.hypot(x2 - x1, y2 - y1));
          const nx = -(y2 - y1) / len;
          const ny = (x2 - x1) / len;
          const mx = (x1 + x2) * 0.5;
          const my = (y1 + y2) * 0.5;
          // Soft outer luminous diamond sheath
          const outW = s.w * 1.7;
          ctx.fillStyle = isGold
            ? `rgba(245, 158, 11, ${s.a * 0.52 * flicker})`
            : `rgba(56, 189, 248, ${s.a * 0.58 * flicker})`;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(mx + nx * outW, my + ny * outW);
          ctx.lineTo(x2, y2);
          ctx.lineTo(mx - nx * outW, my - ny * outW);
          ctx.closePath();
          ctx.fill();
          // Crisp incandescent razor core
          const inW = s.w * 0.48;
          ctx.fillStyle = isGold
            ? `rgba(255, 253, 224, ${s.a * 0.92 * flicker})`
            : `rgba(240, 249, 255, ${s.a * 0.95 * flicker})`;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(mx + nx * inW, my + ny * inW);
          ctx.lineTo(x2, y2);
          ctx.lineTo(mx - nx * inW, my - ny * inW);
          ctx.closePath();
          ctx.fill();
        }
        // Jagged vertical lightning lance descending from the sky onto the impact locus
        for (let b = 0; b < 2; b++) {
          const bx0 = impX + (b === 0 ? -42 : 58) + Math.sin(phaseTick * 3.1 + b) * 35;
          ctx.beginPath();
          const segs = 9;
          for (let k = 0; k <= segs; k++) {
            const u = k / segs;
            const py = -40 + (banditHomeY - 40 + 40) * u;
            const j = k === 0 || k === segs ? 0 : Math.sin(k * 4.7 + phaseTick * 2.9 + b * 1.9) * 36;
            const px = bx0 + j;
            if (k === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.strokeStyle = isGold ? 'rgba(253, 224, 71, 0.72)' : 'rgba(56, 189, 248, 0.78)';
          ctx.lineWidth = b === 0 ? 14 : 9;
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.94)';
          ctx.lineWidth = b === 0 ? 4.5 : 2.8;
          ctx.stroke();
        }
        // Subtle crisp screen-edge strobe flash pulse on frame switch
        const pulseA = Math.max(0, 1 - ((sp * 10) % 1) * 2.8) * 0.20;
        if (pulseA > 0.01) {
          ctx.fillStyle = isGold
            ? `rgba(254, 243, 199, ${pulseA})`
            : `rgba(224, 242, 254, ${pulseA})`;
          ctx.fillRect(-120, -120, W + 240, H + 240);
        }
        ctx.restore();
      } else if (isRadiantCone && r19AfterP >= 0) {
        // Cooling golden aftermath glow fading around the battle scar
        const fade = Math.max(0, 1 - r19AfterP);
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const ag = ctx.createRadialGradient(banditHomeX + 18, banditHomeY - 175, 10, banditHomeX + 18, banditHomeY - 175, 290);
        ag.addColorStop(0, `rgba(254, 240, 138, ${0.42 * fade})`);
        ag.addColorStop(0.5, `rgba(125, 211, 252, ${0.22 * fade})`);
        ag.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = ag;
        ctx.beginPath();
        ctx.arc(banditHomeX + 18, banditHomeY - 175, 290, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      this.drawDustAndSparks(ctx);
      ctx.restore();
      if (cutInP >= 0 && cutInP <= 1) {
        this.drawAnimeCutInBanner(ctx, W, H, cutInP, 'thor');
      }
      this.drawModernDualHud(ctx, W, H);
      return;
    }

    // -------------------------------------------------------------------------
    // B. 3-STAGE REMOTE SWORD-SAINT SKILLS (#018 Midi, #032 Thor SS, #034 Teno SS)
    // -------------------------------------------------------------------------
    const s1End = 1180;
    const s2End = 1520;
    const totalDur = 2780;

    if (localT < s1End) {
      // STAGE 1: Hero Solo Cast/Launch Screen
      const p = Math.min(1, localT / s1End);
      this.activeStageBadge = isEn
        ? `[1/3 Skill Launch: ${skillName}] ${hero.nameEn} · ${heroTerrain.en}`
        : `[1/3 劍技發動：${skillName}] ${hero.nameZh} · ${heroTerrain.zh}`;
      const hx = W * 0.67;
      const hy = H * 0.89;
      const spec: PoseRenderSpec = {
        primaryIdx: Math.min(5, Math.floor(p * 6)),
        x: hx,
        y: hy,
        scaleX: 1,
        scaleY: 1,
        rot: 0,
        flashWhite: 0,
        afterimages: 0,
        dashDirX: -1,
        dashDirY: 0,
      };
      if (p < 0.14) spec.primaryIdx = 0;
      else if (p < 0.28) spec.primaryIdx = 1;
      else if (p < 0.42) spec.primaryIdx = 2;
      else if (p < 0.56) spec.primaryIdx = 3;
      else if (p < 0.80) spec.primaryIdx = 4;
      else spec.primaryIdx = 5;

      if (sk.mode === 'flame_blade_beam' || sk.mode === 'sky_pillar') {
        if (p >= 0.44 && p < 0.66) spec.primaryIdx = 3;
        else if (p >= 0.66 && p < 0.86) spec.primaryIdx = 4;
        else if (p >= 0.86) spec.primaryIdx = 5;
      }

      if (p >= 0.50) {
        this.fireOnce(`sk_sfx_${sk.mode}`, () => {
          this.sound.playSfx(sk.mode === 'flame_blade_beam' ? 'bank:53:1' : sk.mode === 'sonic_crescent' ? 'bank:49:1' : 'bank:50:1');
          this.spawnDustPlume(hx, hy, 1, 0.2, 12);
        });
      }

      let cutInP = -1;
      if (this.config.enableAnimeCutIn && p >= 0.10 && p <= 0.38) cutInP = (p - 0.10) / 0.28;

      ctx.save();
      this.drawTerrainBackdrop(ctx, W, H, heroBgId, 0, 0, hy);
      this.drawGroundShadow(ctx, hx, hy, 225);

      // #032 Thor (Sword Saint — 熾炎刀) Stage 1 vertical sky-pillar curtain bridging cleanly off top of canvas!
      if (sk.mode === 'flame_blade_beam' && p >= 0.44 && p < 0.86) {
        const wallL = hx + (296 / 960 - 0.5) * heroDisp;
        const wallR = hx + (563 / 960 - 0.5) * heroDisp;
        const wallTop = hy + (438 / 960 - 648 / 680) * heroDisp;
        const wSpan = wallR - wallL;
        const fadeOut = p < 0.66 ? 1 : Math.max(0, 1 - (p - 0.66) / 0.20);
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        if (p < 0.66) {
          const topY = -40;
          const overlapY = wallTop + 56;
          const vg = ctx.createLinearGradient(wallL - 18, 0, wallR + 18, 0);
          vg.addColorStop(0, 'rgba(56, 189, 248, 0)');
          vg.addColorStop(0.09, 'rgba(56, 189, 248, 0.85)');
          vg.addColorStop(0.18, 'rgba(253, 224, 71, 0.90)');
          vg.addColorStop(0.50, 'rgba(255, 253, 232, 0.95)');
          vg.addColorStop(0.82, 'rgba(253, 224, 71, 0.90)');
          vg.addColorStop(0.91, 'rgba(56, 189, 248, 0.85)');
          vg.addColorStop(1, 'rgba(56, 189, 248, 0)');
          ctx.fillStyle = vg;
          ctx.fillRect(wallL - 18, topY, wSpan + 36, wallTop - topY + 10);
          // Smooth stepped fade downward into ranged_3.webp feathered top so bridge seam disappears
          for (let f = 0; f < 4; f++) {
            ctx.save();
            ctx.globalAlpha = 0.72 * (1 - f / 4);
            ctx.fillRect(wallL - 14, wallTop + 10 + f * 9, wSpan + 28, 9);
            ctx.restore();
          }
          // Crackling side electric ripples along both left and right curtains
          for (const ex of [wallL + 3, wallR - 3]) {
            ctx.beginPath();
            for (let s = 0; s <= 12; s++) {
              const py = topY + ((overlapY - topY) * s) / 12;
              const jit = Math.sin(s * 2.9 + localT * 0.045) * 6;
              if (s === 0) ctx.moveTo(ex + jit, py);
              else ctx.lineTo(ex + jit, py);
            }
            ctx.strokeStyle = 'rgba(125, 211, 252, 0.92)';
            ctx.lineWidth = 4.5;
            ctx.stroke();
          }
        } else {
          // Receding jagged electric sapphire-white/gold pillar shards flaring skyward on F5!
          const sp = (p - 0.66) / 0.20;
          const shards = 11;
          for (let i = 0; i < shards; i++) {
            const sx = wallL + (i / (shards - 1)) * wSpan;
            const shH = (1 - sp * 0.72) * (wallTop + 60) * (0.45 + 0.55 * Math.abs(Math.sin(i * 1.9 + sp * 4)));
            ctx.fillStyle =
              i % 2 === 0
                ? `rgba(254, 249, 195, ${0.72 * fadeOut})`
                : `rgba(125, 211, 252, ${0.78 * fadeOut})`;
            ctx.beginPath();
            ctx.moveTo(sx - 12, wallTop + 34);
            ctx.lineTo(sx, wallTop + 34 - shH);
            ctx.lineTo(sx + 12, wallTop + 34);
            ctx.closePath();
            ctx.fill();
          }
        }
        ctx.restore();
      }

      this.renderCombatantWithBlend(ctx, poses, spec, '#38bdf8', heroDisp);

      if (sk.mode === 'sonic_crescent' && p >= 0.80) {
        // Launch Midi's EXACT painted F5 sonic wave sprite at blistering transit speed (~6.8 px/ms!)
        const launchMs = localT - s1End * 0.80; // 0..236ms
        const srcX = hx + (129 / 680 - 0.5) * heroDisp;
        const srcY = hy + (285 / 680 - 648 / 680) * heroDisp;
        const projW = (445 / 680) * heroDisp;
        const projH = (358 / 680) * heroDisp;
        const slideX = srcX - launchMs * 6.8;
        if (slideX + projW > -140) {
          drawSonicWaveProj(slideX, srcY - launchMs * 0.04, projW * 1.04, projH * 1.04, 1.0, launchMs > 18);
        }
      } else if (sk.mode === 'flame_blade_beam' && p >= 0.52) {
        // #032 Thor (Sword Saint): Blazing FLAME-DRAGON head Qi missile blasting straight left at ~6.8 px/ms!
        const flyMs = localT - s1End * 0.52; // 0..566ms
        const bladeX = hx - heroDisp * 0.14;
        const beamCy = hy - heroDisp * 0.27;
        const snoutX = bladeX - 40 - flyMs * 6.8;
        const tailDetachMs = 175; // Brief roar anchored at blade then whip-launches free off left border!
        const tailDetached = flyMs > tailDetachMs;
        const tailX = tailDetached ? bladeX - (flyMs - tailDetachMs) * 6.8 : bladeX;
        const beamH = 82;
        if (tailX > -320) {
          drawFlameDragonMissile(
            snoutX,
            tailX,
            beamCy,
            beamH,
            flyMs < 35 ? flyMs / 35 : 1,
            localT,
            !tailDetached
          );
        }
        // Subtle glowing ring shockburst right around the blade launch point on emission!
        if (flyMs < 240) {
          const rp = flyMs / 240;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.strokeStyle = `rgba(253, 224, 71, ${(1 - rp) * 0.88})`;
          ctx.lineWidth = 6 * (1 - rp * 0.6);
          ctx.beginPath();
          ctx.ellipse(bladeX - 18, beamCy, 18 + rp * 58, 48 + rp * 125, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
      this.drawDustAndSparks(ctx);
      ctx.restore();
      if (cutInP >= 0 && cutInP <= 1) this.drawAnimeCutInBanner(ctx, W, H, cutInP, 'thor');
      this.drawModernDualHud(ctx, W, H);
      return;
    }

    if (localT < s2End) {
      // STAGE 2: High-Speed Transit Bridge (~340ms total, speed ~7.0 px/ms!)
      const s2Ms = localT - s1End;
      const bp = s2Ms / (s2End - s1End);
      this.activeStageBadge = isEn
        ? `[2/3 Skill Transit: ${skillName}] ${heroTerrain.en} → ${enemyTerrain.en}`
        : `[2/3 劍氣過場：${skillName}] ${heroTerrain.zh} → ${enemyTerrain.zh}`;
      ctx.save();
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#040a18');
      grad.addColorStop(0.5, sk.mode === 'sky_pillar' ? '#241404' : sk.mode === 'flame_blade_beam' ? '#281205' : '#082040');
      grad.addColorStop(1, '#040a18');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      // Speed streaks
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 24; i++) {
        const y = ((i * 53) % H);
        const speedCol = sk.mode === 'sonic_crescent' ? 'rgba(125,211,252,0.35)' : 'rgba(253,224,71,0.38)';
        ctx.fillStyle = speedCol;
        ctx.fillRect(((W - bp * W * 1.9 + i * 190) % (W + 400)) - 200, y, 220 + (i % 4) * 90, 2 + (i % 3));
      }
      ctx.globalCompositeOperation = 'source-over';
      if (sk.mode === 'sonic_crescent') {
        const pw = 600;
        const ph = Math.round(pw * (358 / 445));
        const sx = W + 60 - s2Ms * 6.8;
        drawSonicWaveProj(sx, H * 0.5 - ph * 0.5, pw, ph, 1, true);
      } else if (sk.mode === 'flame_blade_beam') {
        // Abstracted roaring flame-dragon head streaking across transit at matching 6.8 px/ms!
        const snoutX = W + 80 - s2Ms * 6.8;
        const tailX = snoutX + 1280;
        drawFlameDragonMissile(snoutX, tailX, H * 0.5, 108, 1, localT, false);
      } else {
        // Vertical roaring amber energy pulse signaling incoming sky pillar
        ctx.globalCompositeOperation = 'screen';
        const rg = ctx.createRadialGradient(W * 0.5, H * (0.85 - bp * 0.6), 20, W * 0.5, H * 0.5, 340);
        rg.addColorStop(0, 'rgba(255,255,240,0.95)');
        rg.addColorStop(0.4, 'rgba(253,224,71,0.65)');
        rg.addColorStop(1, 'rgba(234,88,12,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
      this.drawModernDualHud(ctx, W, H);
      return;
    }

    // STAGE 3: Target Solo Impact (`#018` F5 sonic wave slice / `#032` blazing flame-dragon Qi beam / `#034` sky pillar!)
    const s3Dur = Math.max(1, totalDur - s2End); // 1260ms
    const s3Ms = Math.max(0, localT - s2End);
    const p3 = Math.min(1, s3Ms / s3Dur);
    this.activeStageBadge = isEn
      ? `[3/3 Impact: ${skillName}] ${target.nameEn} · ${enemyTerrain.en}`
      : `[3/3 目標受擊：${skillName}] ${target.nameZh} · ${enemyTerrain.zh}`;
    const tx = W * 0.36;
    const ty = H * 0.72;
    // Exact missile speed = 6.8 px/ms matching Stage 2 transit!
    // Leading edge enters W + 60 at t=0 and collides with Bandit (tx = 576) at ~160ms (p3 ~ 0.127)!
    const hitAt = sk.mode === 'sky_pillar' ? 0.30 : 0.125;
    const hp = p3 >= hitAt ? Math.min(1, (p3 - hitAt) / (1 - hitAt)) : 0;
    const recoil = p3 >= hitAt ? Math.sin(Math.min(1, hp * 2.1) * Math.PI) * 58 : 0;
    const enemySpec: PoseRenderSpec = {
      primaryIdx: 0,
      x: tx - recoil,
      y: ty - recoil * 0.25,
      scaleX: 1,
      scaleY: 1,
      rot: -recoil * 0.002,
      flashWhite: p3 >= hitAt && hp < 0.55 ? 1 - hp / 0.55 : 0,
      afterimages: 0,
      dashDirX: -1,
      dashDirY: 0,
    };
    if (p3 >= hitAt) {
      this.fireOnce(`sk_hit_${sk.mode}`, () => {
        this.sound.playSfx('crit');
        this.hitStopRemainingMs = 80;
        this.spawnImpactSparks(
          tx,
          ty - 190,
          ty,
          68,
          sk.mode === 'sonic_crescent'
            ? ['#ffffff', '#e0f2fe', '#7dd3fc', '#fde047', '#f59e0b']
            : ['#ffffff', '#fef9c3', '#fde047', '#f59e0b', '#ea580c'],
          -1,
          -0.25
        );
        this.spawnDustPlume(tx, ty, -1, -0.2, 16);
        this.banditTargetHp = Math.max(0, this.banditTargetHp - 28);
      });
    }
    const shake = p3 >= hitAt && hp < 0.65 ? (1 - hp / 0.65) * 18 : 0;
    ctx.save();
    ctx.translate(shake ? (Math.random() - 0.5) * shake * 2 : 0, shake ? (Math.random() - 0.5) * shake * 1.4 : 0);
    this.drawTerrainBackdrop(ctx, W, H, enemyBgId, 0, 0, ty);
    this.drawGroundShadow(ctx, enemySpec.x, enemySpec.y, 210);
    if (sk.mode === 'sky_pillar' && p3 < 0.85) {
      // Expanding golden seal circle on the earth under target (DOS F11-F13!)
      const sealP = Math.min(1, p3 / 0.30);
      const sealFade = p3 < 0.68 ? 1 : Math.max(0, 1 - (p3 - 0.68) / 0.17);
      const sealRx = 28 + sealP * 155;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const sg = ctx.createRadialGradient(tx, ty - 6, 4, tx, ty - 6, sealRx);
      sg.addColorStop(0, `rgba(255,255,235,${0.95 * sealFade})`);
      sg.addColorStop(0.65, `rgba(253,224,71,${0.82 * sealFade})`);
      sg.addColorStop(1, 'rgba(234,88,12,0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.ellipse(tx, ty - 6, sealRx, sealRx * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    this.renderCombatantWithBlend(ctx, targetPoses, enemySpec, '#ef4444', targetDisp);

    if (sk.mode === 'sonic_crescent') {
      // Midi's EXACT painted F5 sonic wave at IDENTICAL Stage-2 blistering speed (6.8 px/ms)!
      const pw = Math.round(heroDisp * (445 / 680) * 1.24);
      const ph = Math.round(heroDisp * (358 / 680) * 1.24);
      const waveLeft = W + 60 - s3Ms * 6.8;
      if (waveLeft + pw > -200) {
        drawSonicWaveProj(waveLeft, ty - ph + 28, pw, ph, 1.0, true);
      }
      // Sharp glowing after-slash sonic wake ringing across Bandit immediately after passage!
      if (s3Ms >= 150 && s3Ms < 620) {
        const wf = 1 - (s3Ms - 150) / 470;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const wg = ctx.createLinearGradient(tx - 260, ty - 205, tx + 290, ty - 140);
        wg.addColorStop(0, 'rgba(125,211,252,0)');
        wg.addColorStop(0.35, `rgba(224,242,254,${0.85 * wf})`);
        wg.addColorStop(0.5, `rgba(253,224,71,${0.95 * wf})`);
        wg.addColorStop(0.7, `rgba(125,211,252,${0.65 * wf})`);
        wg.addColorStop(1, 'rgba(56,189,248,0)');
        ctx.fillStyle = wg;
        ctx.beginPath();
        ctx.moveTo(tx - 270, ty - 180);
        ctx.lineTo(tx, ty - 180 - 16 * wf);
        ctx.lineTo(tx + 310, ty - 180);
        ctx.lineTo(tx, ty - 180 + 16 * wf);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    } else if (sk.mode === 'flame_blade_beam') {
      // #032 Thor SS roaring FLAME-DRAGON head + golden Qi shaft whipping right -> left at 6.8 px/ms!
      const snoutX = W + 90 - s3Ms * 6.8;
      const tailX = snoutX + 1280;
      const cy = ty - 190;
      if (tailX > -360) {
        drawFlameDragonMissile(snoutX, tailX, cy, 108, 1.0, localT, false);
      }
      // Roaring fiery impact corona lingering across Bandit after the flame dragon tears right through!
      if (s3Ms >= 150 && s3Ms < 780) {
        const impFade = Math.max(0, 1 - (s3Ms - 150) / 630);
        const rad = 180 + (1 - impFade) * 140;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const cg = ctx.createRadialGradient(tx + 12, cy, 10, tx + 12, cy, rad);
        cg.addColorStop(0, `rgba(255, 255, 240, ${0.88 * impFade})`);
        cg.addColorStop(0.36, `rgba(253, 224, 71, ${0.58 * impFade})`);
        cg.addColorStop(0.72, `rgba(234, 88, 12, ${0.28 * impFade})`);
        cg.addColorStop(1, 'rgba(234, 88, 12, 0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(tx + 12, cy, rad, 0, Math.PI * 2);
        ctx.fill();
        // Rapidly expanding fiery ring shockwave around dragon chomp site
        if (s3Ms < 460) {
          const rp = (s3Ms - 150) / 310;
          ctx.strokeStyle = `rgba(253, 224, 71, ${(1 - rp) * 0.85})`;
          ctx.lineWidth = 8 * (1 - rp * 0.7);
          ctx.beginPath();
          ctx.arc(tx + 10, cy, 65 + rp * 255, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    } else if (sk.mode === 'sky_pillar' && p3 >= 0.28) {
      // Massive vertical golden light pillar crashing from the sky onto enemy (DOS F14..F16!)
      const pp = (p3 - 0.28) / 0.72;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      if (pp < 0.62) {
        const pw = 135 * (pp < 0.12 ? pp / 0.12 : 1.0);
        const dropH = pp < 0.14 ? (ty + 10) * (pp / 0.14) : ty + 10;
        const pg = ctx.createLinearGradient(tx - pw, 0, tx + pw, 0);
        pg.addColorStop(0, 'rgba(180,45,6,0)');
        pg.addColorStop(0.18, 'rgba(234,88,12,0.94)');
        pg.addColorStop(0.38, 'rgba(253,224,71,0.98)');
        pg.addColorStop(0.5, 'rgba(255,255,245,1)');
        pg.addColorStop(0.62, 'rgba(253,224,71,0.98)');
        pg.addColorStop(0.82, 'rgba(234,88,12,0.94)');
        pg.addColorStop(1, 'rgba(180,45,6,0)');
        ctx.fillStyle = pg;
        ctx.fillRect(tx - pw, 0, pw * 2, dropH);
      } else {
        // DOS F15-F16 receding vertical jagged ceiling flame spears!
        const sp = (pp - 0.62) / 0.38;
        const spikeCount = 13;
        for (let i = 0; i < spikeCount; i++) {
          const frac = (i / (spikeCount - 1) - 0.5) * 2;
          const sx = tx + frac * 115;
          const len = (1 - sp) * (ty * (0.45 + ((i * 7) % 5) * 0.12));
          ctx.fillStyle = i % 2 === 0 ? `rgba(254,240,138,${1 - sp})` : `rgba(245,158,11,${0.9 * (1 - sp)})`;
          ctx.beginPath();
          ctx.moveTo(sx - 12, 0);
          ctx.lineTo(sx, len);
          ctx.lineTo(sx + 12, 0);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
    }
    this.drawDustAndSparks(ctx);
    ctx.restore();
    this.drawModernDualHud(ctx, W, H);
  }

  /**
   * Authentic Flame Dragon II 2-Stage Remote Magic Cutaway (e.g., #009 Uni Fire Dragon, #010 Marin Holy Radiance):
   *  - Stage 1 (0 .. 1380ms): Caster stands ALONE on Caster's tile terrain (`heroBgId`), rotating magic circle + wand chant + MP drain!
   *  - Stage 2 (1380 .. 2950ms): Target slides ALONE onto Target's tile terrain (`enemyBgId`) and takes full elemental HD spell VFX!
   */
  private renderModernMagicScene(ctx: CanvasRenderingContext2D, W: number, H: number, startMs: number): void {
    const isEn = getLocale() === 'en';
    const localT = Math.max(0, this.elapsedMs - startMs);
    const stage1End = 1380;
    const heroBgId = this.vfxAssets.heroBgId;
    const enemyBgId = this.vfxAssets.enemyBgId;
    const heroTerrain = getTerrainPreset(heroBgId);
    const enemyTerrain = getTerrainPreset(enemyBgId);
    const caster = this.vfxAssets.rightUnit;
    const target = this.vfxAssets.leftUnit;
    const baseElement = caster.magicElement ?? 'fire';
    const activeSpellId =
      this.previewSpellId ?? defaultSpellIdForUnit(caster.uid, baseElement, caster.magicNameZh);
    const spellEntry = getHdSpellEntry(activeSpellId);
    const element = spellEntry?.element ?? baseElement;
    const spellName = isEn
      ? (spellEntry
          ? `#${String(spellEntry.id).padStart(2, '0')} ${spellEntry.nameEn}`
          : (caster.magicNameEn ?? (element === 'holy' ? 'Holy Radiance' : element === 'fire' ? 'Flame Dragon' : 'Arcane Nova')))
      : (spellEntry
          ? `#${String(spellEntry.id).padStart(2, '0')} ${spellEntry.nameZh}`
          : (caster.magicNameZh ?? (element === 'holy' ? '聖光審判' : element === 'fire' ? '炎龍術' : '星辰秘法')));

    const srcMode = this.config.animSource;
    const useDedicatedChant = this.vfxAssets.thorChantPoses.length >= 6;
    const useHeroChantStrip =
      !useDedicatedChant &&
      caster.rangedSkill?.mode === 'hero_chant' &&
      this.vfxAssets.thorRangedPoses.length >= 6;
    const casterPoses = useDedicatedChant
      ? this.vfxAssets.thorChantPoses
      : useHeroChantStrip
        ? this.vfxAssets.thorRangedPoses
        : this.getActivePoseList('thor');
    const targetPoses = this.getActivePoseList('bandit');
    const casterMaxIdx = Math.max(1, casterPoses.length - 1);

    // -------------------------------------------------------------------------
    // STAGE 1: Caster Solo Screen (`heroBgId`) + Rotating 3D Magic Circle + MP Drain
    // -------------------------------------------------------------------------
    if (localT < stage1End) {
      const p = Math.min(1, localT / stage1End);
      this.activeStageBadge = isEn
        ? `[1/2 Spell Chant: ${spellName}] ${caster.nameEn} Solo · ${heroTerrain.en} (#${heroTerrain.id})`
        : `[1/2 法術詠唱：${spellName}] ${caster.nameZh} 獨屏 · ${heroTerrain.zh} (#${heroTerrain.id})`;

      const casterHomeX = W * 0.63;
      const casterHomeY = H * 0.89;
      const casterSpec: PoseRenderSpec = {
        primaryIdx: 0,
        x: casterHomeX,
        y: casterHomeY,
        scaleX: 1.0,
        scaleY: 1.0,
        rot: 0,
        flashWhite: 0,
        afterimages: 0,
        dashDirX: -1,
        dashDirY: 0,
      };

      if (useDedicatedChant || useHeroChantStrip) {
        this.setContinuousFrame(casterSpec, Math.min(5, p * 5.25), 5);
      } else if (srcMode === 'omni_video') {
        this.setContinuousFrame(casterSpec, Math.min(casterMaxIdx, p * (casterMaxIdx + 0.4)), casterMaxIdx);
      } else if (srcMode === 'nb2_6frame') {
        this.setContinuousFrame(casterSpec, Math.min(5, p * 5.3), 5);
      } else {
        casterSpec.primaryIdx = p < 0.28 ? 0 : p < 0.62 ? 1 : 2;
      }

      if (p >= 0.48) {
        this.fireOnce('magic_chant_sfx', () => {
          const chantSfx: SfxKind = spellEntry
            ? (`bank:${spellEntry.sfxBank}:0` as SfxKind)
            : (caster.sfxProfile?.magicChantSfx ?? 'bank:83:0');
          this.sound.playSfx(chantSfx);
          this.thorMp = Math.max(0, this.thorMp - 4);
          this.spawnImpactSparks(
            casterHomeX - 45,
            casterHomeY - 310,
            casterHomeY,
            32,
            element === 'holy'
              ? ['#ffffff', '#fef08a', '#fde047', '#7dd3fc']
              : element === 'fire'
                ? ['#ffffff', '#fde047', '#f97316', '#ef4444']
                : ['#ffffff', '#c084fc', '#38bdf8', '#fde047'],
            0,
            -0.8
          );
        });
      }

      let cutInProgress = -1;
      if (this.config.enableAnimeCutIn && p >= 0.12 && p <= 0.45) {
        cutInProgress = (p - 0.12) / 0.33;
      }

      const camZoom = 1.02 + Math.sin(Math.min(1, p * 1.1) * Math.PI * 0.5) * 0.12;
      const camX = W * 0.04 * p;
      const camY = H * 0.02 * p;

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.translate(W * 0.5, H * 0.5);
      ctx.scale(camZoom, camZoom);
      ctx.translate(-W * 0.5 - camX, -H * 0.5 - camY);

      this.drawTerrainBackdrop(ctx, W, H, heroBgId, camX, camY, casterHomeY);

      // Rotating 3D Perspective Arcane/Holy/Fire Magic Circle beneath Caster!
      this.drawMagicCastCircle(ctx, casterHomeX, casterHomeY - 12, p, element);

      this.drawGroundShadow(ctx, casterSpec.x, casterSpec.y, 215);
      this.renderCombatantWithBlend(
        ctx,
        casterPoses,
        casterSpec,
        element === 'holy' ? '#fde047' : '#f97316',
        Math.round(720 * (caster.displayScale ?? 1))
      );

      // Luminous mana convergence pillar around caster at chant peak
      if (p >= 0.44) {
        const gp = Math.sin(Math.min(1, (p - 0.44) / 0.5) * Math.PI);
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const grad = ctx.createRadialGradient(casterHomeX - 40, casterHomeY - 260, 12, casterHomeX - 40, casterHomeY - 260, 290);
        const coreCol = element === 'holy' ? '254, 240, 138' : element === 'fire' ? '251, 146, 60' : '168, 85, 247';
        grad.addColorStop(0, `rgba(255, 255, 255, ${0.75 * gp})`);
        grad.addColorStop(0.45, `rgba(${coreCol}, ${0.52 * gp})`);
        grad.addColorStop(1, `rgba(${coreCol}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(casterHomeX - 40, casterHomeY - 260, 290, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      this.drawDustAndSparks(ctx);
      this.drawForegroundLeaves(ctx, heroBgId);
      ctx.restore();

      // Luminous screen flash transition into Target Screen at end of Stage 1
      if (p > 0.88) {
        const wp = (p - 0.88) / 0.12;
        ctx.save();
        ctx.fillStyle =
          element === 'holy'
            ? `rgba(255, 252, 230, ${wp * 0.88})`
            : element === 'fire'
              ? `rgba(255, 230, 180, ${wp * 0.85})`
              : `rgba(220, 210, 255, ${wp * 0.85})`;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }

      if (cutInProgress >= 0 && cutInProgress <= 1) {
        this.drawAnimeCutInBanner(ctx, W, H, cutInProgress, 'thor');
      }
      this.drawModernDualHud(ctx, W, H);
      return;
    }

    // -------------------------------------------------------------------------
    // STAGE 2: Target Solo Screen (`enemyBgId`) + Slide-In + Elemental HD Spell Barrage!
    // -------------------------------------------------------------------------
    const s2 = localT - stage1End;
    this.activeStageBadge = isEn
      ? `[2/2 ${spellName} Impact] ${target.nameEn} Solo · ${enemyTerrain.en} (#${enemyTerrain.id})`
      : `[2/2 ${spellName} 轟擊] ${target.nameZh} 獨屏 · ${enemyTerrain.zh} (#${enemyTerrain.id})`;

    const targetHomeX = W * 0.42;
    const targetHomeY = H * 0.75;
    const slideP = Math.min(1, s2 / 190);
    const slideEase = 1 - Math.pow(1 - slideP, 3);
    const slideOffsetX = -260 * (1 - slideEase);

    const targetSpec: PoseRenderSpec = {
      primaryIdx: 0,
      x: targetHomeX + slideOffsetX,
      y: targetHomeY,
      scaleX: 1.0,
      scaleY: 1.0,
      rot: 0,
      flashWhite: 0,
      afterimages: 0,
      dashDirX: -1,
      dashDirY: 0,
    };

    const hitTimes = spellEntry?.hitTimesMs ?? (element === 'holy' ? [420, 760] : [340, 580, 820]);
    let activeRecoil = 0;
    let activeFlash = 0;
    let camShake = 0;
    let shockwaveProgress = -1;

    for (let hi = 0; hi < hitTimes.length; hi++) {
      const ht = hitTimes[hi];
      if (s2 >= ht) {
        const isLast = hi === hitTimes.length - 1;
        this.fireOnce(`magic_hit_${hi}`, () => {
          const mSfx: SfxKind = spellEntry
            ? (`bank:${spellEntry.sfxBank}:${hi === 0 ? 1 : isLast ? 2 : 1}` as SfxKind)
            : ((caster.sfxProfile?.magicHitSfx?.[hi] ?? caster.sfxProfile?.magicHitSfx?.[0] ?? 'bank:83:1') as SfxKind);
          this.sound.playSfx(mSfx);
          if (this.config.enableHitStopAndSparks && isLast) {
            this.hitStopRemainingMs = spellEntry?.isSummon ? 85 : 75;
          }
          const pal =
            spellEntry?.id === 9 || spellEntry?.id === 35
              ? ['#f7fee7', '#bef264', '#84cc16', '#22c55e']
              : spellEntry?.element === 'holy'
                ? ['#ffffff', '#fef08a', '#fde047', '#7dd3fc']
                : spellEntry?.element === 'thunder'
                  ? ['#ffffff', '#bae6fd', '#38bdf8', '#818cf8']
                  : spellEntry?.element === 'fire'
                    ? ['#ffffff', '#fde047', '#f97316', '#ef4444']
                    : ['#ffffff', '#e879f9', '#38bdf8', '#fde047'];
          this.spawnImpactSparks(targetHomeX, targetHomeY - 190, targetHomeY, isLast ? 75 : 36, pal, -0.3, -0.65);
          this.spawnDustPlume(targetHomeX, targetHomeY, -0.5, -0.3, isLast ? 16 : 8);
          const dmgPart = isLast
            ? Math.max(1, this.thorStrikeDmg - Math.floor(this.thorStrikeDmg / hitTimes.length) * (hitTimes.length - 1))
            : Math.max(1, Math.floor(this.thorStrikeDmg / hitTimes.length));
          this.banditTargetHp = Math.max(0, this.banditTargetHp - dmgPart);
        });
        const span = isLast ? 420 : 210;
        const delta = s2 - ht;
        if (delta < span) {
          const hp = delta / span;
          activeRecoil = Math.max(activeRecoil, Math.sin(Math.min(1, hp * 1.5) * Math.PI) * (isLast ? 1.0 : 0.55));
          activeFlash = Math.max(activeFlash, Math.max(0, 1 - hp * 2.8) * (isLast ? 1.0 : 0.72));
          camShake = Math.max(camShake, this.config.enableHitStopAndSparks ? (1 - hp) * (isLast ? 24 : 13) : 0);
          if (isLast) shockwaveProgress = Math.min(1, hp * 1.6);
        }
      }
    }

    targetSpec.x = targetHomeX + slideOffsetX - activeRecoil * 48;
    targetSpec.y = targetHomeY - activeRecoil * 20;
    targetSpec.rot = -activeRecoil * 0.09;
    targetSpec.scaleX = 1.0 - activeRecoil * 0.07;
    targetSpec.scaleY = 1.0 + activeRecoil * 0.06;
    targetSpec.flashWhite = activeFlash;

    const spellStart = 120;
    const spellEnd = spellStart + (spellEntry?.durationMs ?? 1200);
    const spellP = s2 >= spellStart && s2 <= spellEnd ? (s2 - spellStart) / (spellEnd - spellStart) : -1;

    const camZoom = spellEntry?.isSummon
      ? 1.0 + (spellP >= 0 ? Math.sin(spellP * Math.PI) * 0.03 : 0)
      : 1.04 + (spellP >= 0 ? Math.sin(spellP * Math.PI) * 0.1 : 0);
    const shakeX = camShake > 0 ? (Math.random() - 0.5) * camShake * 2 : 0;
    const shakeY = camShake > 0 ? (Math.random() - 0.5) * camShake * 1.5 : 0;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(W * 0.5 + shakeX, H * 0.5 + shakeY);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-W * 0.5, -H * 0.5);

    this.drawTerrainBackdrop(ctx, W, H, enemyBgId, 0, 0, targetHomeY);
    this.drawGroundShadow(ctx, targetSpec.x, targetSpec.y, 210);

    // Back-layer magic seal beneath Target
    if (spellP >= 0) {
      this.drawMagicCastCircle(ctx, targetHomeX, targetHomeY - 12, spellP, element);
    }
    if (shockwaveProgress >= 0 && shockwaveProgress <= 1 && this.config.enableHitStopAndSparks) {
      this.drawGroundShockwave(ctx, targetHomeX, targetHomeY - 10, shockwaveProgress);
    }

    // Back-layer Phase B HD spell pillars / orbiting spheres wrapping BEHIND Target (3D depth layering!)
    if (spellP >= 0 && spellEntry) {
      drawHdSpellEffect(ctx, W, H, spellEntry.id, targetHomeX, targetHomeY, spellP, false, getLoadedHdSpellAssets(), 'behind');
    }

    this.renderCombatantWithBlend(
      ctx,
      targetPoses,
      targetSpec,
      '#ef4444',
      Math.round(620 * (target.displayScale ?? 1))
    );

    // Front-layer Phase B HD elemental spell / summon cutaway VFX (all 25 FDOTHER.DAT strips)!
    if (spellP >= 0) {
      if (spellEntry) {
        drawHdSpellEffect(ctx, W, H, spellEntry.id, targetHomeX, targetHomeY, spellP, false, getLoadedHdSpellAssets(), 'front');
      } else {
        this.drawModernSpellEffect(ctx, targetHomeX, targetHomeY, spellP, element);
      }
    }

    this.drawDustAndSparks(ctx);
    this.drawForegroundLeaves(ctx, enemyBgId);
    ctx.restore();

    // Soft transition fade-in from Stage 1 flash
    if (s2 < 140) {
      const fp = 1 - s2 / 140;
      ctx.save();
      ctx.fillStyle = `rgba(255, 250, 225, ${fp * 0.85})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    } else if (activeFlash > 0.1 && this.config.enableHitStopAndSparks) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const grad = ctx.createRadialGradient(targetHomeX, targetHomeY - 180, 20, targetHomeX, targetHomeY - 180, W * 0.65);
      const col = element === 'holy' ? '254, 240, 138' : element === 'fire' ? '249, 115, 22' : '168, 85, 247';
      grad.addColorStop(0, `rgba(255, 255, 240, ${activeFlash * 0.42})`);
      grad.addColorStop(0.4, `rgba(${col}, ${activeFlash * 0.3})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    this.drawModernDualHud(ctx, W, H);
  }

  private renderCombatantWithBlend(
    ctx: CanvasRenderingContext2D,
    poses: HTMLImageElement[],
    spec: PoseRenderSpec,
    afterimageColor: string,
    displaySize: number
  ): void {
    const img1 = poses[spec.primaryIdx] || poses[0];
    if (spec.afterimages > 0) {
      for (let g = spec.afterimages; g >= 1; g--) {
        this.drawCharacterSprite(
          ctx,
          img1,
          spec.x - spec.dashDirX * g * 34,
          spec.y - spec.dashDirY * g * 34,
          spec.scaleX,
          spec.scaleY,
          spec.rot,
          0.24 * (1 - g / (spec.afterimages + 1)),
          displaySize,
          afterimageColor,
          0.72
        );
      }
    }

    const baseOpacity = Math.max(0, Math.min(1, spec.opacity ?? 1.0));
    const flashStrength = Math.max(0, Math.min(1, spec.flashWhite));
    const tint = flashStrength > 0.04 ? '#ffffff' : undefined;
    const tintAlpha = flashStrength * 0.82;
    if (spec.secondaryIdx !== undefined && spec.blend !== undefined && spec.blend > 0.02) {
      const img2 = poses[spec.secondaryIdx] || img1;
      const b = Math.max(0, Math.min(1, spec.blend));
      this.drawCharacterSprite(
        ctx,
        img1,
        spec.x,
        spec.y,
        spec.scaleX,
        spec.scaleY,
        spec.rot * (1 - b),
        (1 - b * 0.75) * baseOpacity,
        displaySize,
        tint,
        tintAlpha
      );
      this.drawCharacterSprite(
        ctx,
        img2,
        spec.x,
        spec.y,
        spec.scaleX,
        spec.scaleY,
        spec.rot * b,
        b * baseOpacity,
        displaySize,
        tint,
        tintAlpha
      );
    } else {
      this.drawCharacterSprite(
        ctx,
        img1,
        spec.x,
        spec.y,
        spec.scaleX,
        spec.scaleY,
        spec.rot,
        baseOpacity,
        displaySize,
        tint,
        tintAlpha
      );
    }
  }

  private drawTerrainBackdrop(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    bgId: number,
    camX: number,
    camY: number,
    groundY: number
  ): void {
    const preset = getTerrainPreset(bgId);
    const pFactor = this.config.enableParallaxAndGodRays ? 0.35 : 0;
    const bgX = -W * 0.11 + camX * pFactor;
    const bgY = -H * 0.14 + camY * pFactor;
    const bgW = W * 1.22;
    const bgH = H * 1.26;

    const bgImg = this.vfxAssets.bgImages.get(bgId) ?? this.vfxAssets.forestBg;
    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
      ctx.drawImage(bgImg, bgX, bgY, bgW, bgH);
    } else {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#0f291e');
      sky.addColorStop(1, '#1e3a29');
      ctx.fillStyle = sky;
      ctx.fillRect(bgX, bgY, bgW, bgH);
    }

    const stageGrade = ctx.createLinearGradient(0, 0, 0, H);
    if (preset.weather === 'embers') {
      stageGrade.addColorStop(0, 'rgba(32, 8, 6, 0.36)');
      stageGrade.addColorStop(0.55, 'rgba(48, 14, 8, 0.14)');
      stageGrade.addColorStop(1, 'rgba(16, 6, 4, 0.68)');
    } else if (preset.weather === 'snow') {
      stageGrade.addColorStop(0, 'rgba(14, 28, 48, 0.24)');
      stageGrade.addColorStop(0.55, 'rgba(200, 228, 255, 0.06)');
      stageGrade.addColorStop(1, 'rgba(12, 20, 32, 0.52)');
    } else {
      stageGrade.addColorStop(0, 'rgba(8, 22, 16, 0.30)');
      stageGrade.addColorStop(0.55, 'rgba(16, 38, 24, 0.10)');
      stageGrade.addColorStop(0.82, 'rgba(28, 24, 14, 0.24)');
      stageGrade.addColorStop(1, 'rgba(10, 12, 8, 0.62)');
    }
    ctx.fillStyle = stageGrade;
    ctx.fillRect(bgX, bgY, bgW, bgH);

    if (!this.config.enableParallaxAndGodRays || !preset.outdoor) return;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const rays = [
      { x: W * 0.22, w: 170, alpha: 0.11, phase: 0.4 },
      { x: W * 0.48, w: 240, alpha: 0.15, phase: 1.7 },
      { x: W * 0.74, w: 190, alpha: 0.12, phase: 3.1 },
    ];
    for (const r of rays) {
      const sway = Math.sin(this.elapsedMs * 0.0012 + r.phase) * 28;
      const topX = r.x + sway - 140;
      const botX = r.x + sway + 160;
      const grad = ctx.createLinearGradient(topX, 0, botX, groundY);
      const rayRgb = preset.weather === 'snow' ? '186, 230, 253' : '254, 240, 138';
      grad.addColorStop(0, `rgba(${rayRgb}, ${r.alpha * 1.25})`);
      grad.addColorStop(0.6, `rgba(${rayRgb}, ${r.alpha * 0.65})`);
      grad.addColorStop(1, `rgba(${rayRgb}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(topX - r.w * 0.4, -40);
      ctx.lineTo(topX + r.w * 0.4, -40);
      ctx.lineTo(botX + r.w * 0.85, groundY + 40);
      ctx.lineTo(botX - r.w * 0.85, groundY + 40);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Stage 2 of Ranged 3-Stage Cutaway: Modern HD horizontal speed-line parallax bands
   * (direct homage to 1995 `BG.DAT[0..2]`'s iconic horizontal navy speed strips) + supersonic projectile!
   */
  private drawRangedSpeedLineBridge(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    progress: number,
    dirX: -1 | 1,
    projectileType: 'bolt' | 'sniper_bolt' | 'arrow' | 'beam' | 'cryo_beam' | 'orb',
    burstCount = 1
  ): void {
    ctx.save();
    // Deep cobalt-navy horizontal speed backdrop matching BG.DAT[0..2] palette
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#04091a');
    bg.addColorStop(0.22, '#0c1e46');
    bg.addColorStop(0.5, '#173672');
    bg.addColorStop(0.78, '#0c1e46');
    bg.addColorStop(1, '#04091a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Classic horizontal alternating speed bands (modernized BG.DAT[0..2] strips!)
    const stripeCount = 26;
    const stripeH = H / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      const y = i * stripeH;
      const distFromMid = Math.abs(i - stripeCount * 0.5) / (stripeCount * 0.5);
      const wave = Math.sin(i * 1.7 + progress * 22);
      const bandAlpha = (0.14 + (1 - distFromMid) * 0.24) * (0.65 + 0.35 * wave);
      ctx.fillStyle = i % 2 === 0 ? `rgba(56, 142, 232, ${bandAlpha})` : `rgba(8, 16, 44, ${bandAlpha * 1.4})`;
      ctx.fillRect(0, y, W, stripeH * 0.86);
    }

    // High-speed parallax anime streak needles zipping opposite to bolt travel
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 46; i++) {
      const seed = (i * 197.3) % 1;
      const y = ((i * 73.1) % H);
      const len = 180 + (i % 7) * 95;
      const speed = 1.6 + (i % 5) * 0.55;
      const rawX = (seed * W + (-dirX) * progress * W * speed * 1.4) % (W + len * 2);
      const x = rawX < -len ? rawX + W + len * 2 : rawX - len;
      const thickness = i % 5 === 0 ? 4.2 : 1.8;
      const isGold = i % 6 === 0 && Math.abs(y - H * 0.5) < H * 0.26;
      const grad = ctx.createLinearGradient(x, y, x + len, y);
      const col = isGold ? '253, 224, 71' : '147, 197, 253';
      grad.addColorStop(0, `rgba(${col}, 0)`);
      grad.addColorStop(0.5, `rgba(${col}, ${isGold ? 0.82 : 0.55})`);
      grad.addColorStop(1, `rgba(${col}, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, len, thickness);
    }
    ctx.restore();

    // Central glowing supersonic slipstream + large HD projectile(s) tearing across the screen!
    const startX = dirX < 0 ? W * 0.98 : W * 0.02;
    const endX = dirX < 0 ? W * 0.02 : W * 0.98;
    const bCount = Math.max(1, burstCount);

    if (projectileType === 'arrow') {
      // Tight, razor-thin 5-arrow spirit volley pack matching #023 Loran Frame 5 (`nb6_4.webp`) & DOS `f13`!
      // Tight vertical spread (`[-44..+44]` instead of wide `[-108..+108]`) & ultra-short stagger (`±0.05` total)!
      const arrowYOffs =
        bCount === 5
          ? [-44, -22, 0, 22, 44]
          : bCount > 1
            ? Array.from({ length: bCount }, (_, i) => Math.round(((i / (bCount - 1)) - 0.5) * 86))
            : [0];
      const arrowStaggers =
        bCount === 5
          ? [0.022, -0.048, 0.056, -0.020, 0.004] // DOS f13 pack: center leads, bottom 2nd, top 3rd, tight cluster!
          : Array.from({ length: bCount }, (_, i) => (bCount === 1 ? 0 : (i - (bCount - 1) * 0.5) * 0.032));

      for (let bi = 0; bi < bCount; bi++) {
        const bp = progress - (arrowStaggers[bi] ?? 0);
        if (bp < -0.22 || bp > 1.25) continue;
        const tipX = startX + (endX - startX) * bp;
        const projY = H * 0.5 + (arrowYOffs[bi % arrowYOffs.length] ?? 0);

        // Razor-slim horizontal cyan-white slipstream needle trail (NO bulky ±30px bolt cone!)
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const wakeLen = 520;
        const tailX = tipX - dirX * wakeLen;
        const wakeGrad = ctx.createLinearGradient(tipX, projY, tailX, projY);
        wakeGrad.addColorStop(0, 'rgba(255, 255, 255, 0.78)');
        wakeGrad.addColorStop(0.28, 'rgba(125, 211, 252, 0.52)');
        wakeGrad.addColorStop(0.68, 'rgba(56, 189, 248, 0.20)');
        wakeGrad.addColorStop(1, 'rgba(37, 99, 235, 0)');
        ctx.fillStyle = wakeGrad;
        ctx.beginPath();
        ctx.moveTo(tipX - dirX * 14, projY - 3.6);
        ctx.lineTo(tailX, projY - 0.8);
        ctx.lineTo(tailX, projY + 0.8);
        ctx.lineTo(tipX - dirX * 14, projY + 3.6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        this.drawElvenSpiritArrow(ctx, tipX, projY, dirX, 1.08, 300);
      }
    } else if (projectileType === 'sniper_bolt') {
      // Authentic 1995 DOS #040/#058 Celia (Sniper/Sharpshooter) ultra-tight almost-simultaneous triple bolt salvo!
      const boltYOffs = bCount === 3 ? [-20, 0, 20] : Array.from({ length: bCount }, (_, i) => (bCount === 1 ? 0 : (i / (bCount - 1) - 0.5) * 44));
      const boltStaggers = bCount === 3 ? [-0.028, 0.0, 0.032] : Array.from({ length: bCount }, (_, i) => (bCount === 1 ? 0 : (i - (bCount - 1) * 0.5) * 0.032));
      for (let bi = 0; bi < bCount; bi++) {
        const bp = progress - (boltStaggers[bi] ?? 0);
        if (bp < -0.22 || bp > 1.25) continue;
        const projX = startX + (endX - startX) * bp;
        const projY = H * 0.5 + (boltYOffs[bi % boltYOffs.length] ?? 0);
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const wakeLen = 420;
        const tailX = projX - dirX * wakeLen;
        const wg = ctx.createLinearGradient(projX, projY, tailX, projY);
        wg.addColorStop(0, 'rgba(226, 232, 240, 0.72)');
        wg.addColorStop(0.32, 'rgba(148, 163, 184, 0.36)');
        wg.addColorStop(1, 'rgba(100, 116, 139, 0)');
        ctx.fillStyle = wg;
        ctx.beginPath();
        ctx.moveTo(projX - dirX * 10, projY - 3.2);
        ctx.lineTo(tailX, projY - 0.8);
        ctx.lineTo(tailX, projY + 0.8);
        ctx.lineTo(projX - dirX * 10, projY + 3.2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        this.drawSniperCrossbowBolt(ctx, projX, projY, dirX, 1.65, true);
      }
    } else if (projectileType === 'cryo_beam') {
      // Authentic 1995 DOS #045 Beckway (Sniper T2) SINGLE colossal swirling ice-blue plasma cannon beam wave!
      const projX = startX + (endX - startX) * progress;
      const projY = H * 0.5;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const wakeLen = 780;
      const tailX = projX - dirX * wakeLen;
      const wg = ctx.createLinearGradient(projX, projY, tailX, projY);
      wg.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
      wg.addColorStop(0.22, 'rgba(186, 230, 253, 0.84)');
      wg.addColorStop(0.55, 'rgba(56, 189, 248, 0.45)');
      wg.addColorStop(1, 'rgba(30, 64, 175, 0)');
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.moveTo(projX + dirX * 20, projY);
      ctx.lineTo(tailX, projY - 46);
      ctx.lineTo(tailX, projY + 46);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      this.drawCryoPlasmaWave(ctx, projX, projY, dirX, 1.75, progress);
    } else {
      const yOffs =
        bCount >= 5
          ? [-108, -54, 0, 54, 108]
          : bCount > 1
            ? [-72, 12, 84]
            : [0];
      for (let bi = 0; bi < bCount; bi++) {
        const stagger = bCount === 1 ? 0 : (bi - (bCount - 1) * 0.5) * (bCount >= 5 ? 0.105 : 0.16);
        const bp = progress - stagger;
        if (bp < -0.2 || bp > 1.25) continue;
        const projX = startX + (endX - startX) * bp;
        const projY = H * 0.5 + (yOffs[bi % yOffs.length] ?? 0) + Math.sin(progress * Math.PI * 4 + bi) * 4;

        // Full-span luminous wake trail behind projectile
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const wakeLen = 580;
        const tailX = projX - dirX * wakeLen;
        const wakeGrad = ctx.createLinearGradient(projX, projY, tailX, projY);
        wakeGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        wakeGrad.addColorStop(0.25, 'rgba(253, 224, 71, 0.72)');
        wakeGrad.addColorStop(0.65, 'rgba(56, 189, 248, 0.35)');
        wakeGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = wakeGrad;
        ctx.beginPath();
        ctx.moveTo(projX + dirX * 35, projY);
        ctx.lineTo(tailX, projY - 30);
        ctx.lineTo(tailX, projY + 30);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        this.drawHdProjectile(ctx, projX, projY, dirX, projectileType, bCount >= 5 ? 1.38 : bCount > 1 ? 1.55 : 1.85);
      }
    }

    // Subtle dark vignette top & bottom framing like dramatic widescreen anime cutaway
    const vig = ctx.createLinearGradient(0, 0, 0, H);
    vig.addColorStop(0, 'rgba(2, 6, 18, 0.65)');
    vig.addColorStop(0.18, 'rgba(2, 6, 18, 0)');
    vig.addColorStop(0.82, 'rgba(2, 6, 18, 0)');
    vig.addColorStop(1, 'rgba(2, 6, 18, 0.65)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /**
   * Draws a razor-thin, needle-sharp luminous sapphire-white elven spirit arrow matching #023 Loran Frame 5 (`nb6_4.webp`)
   * and 1995 DOS `u_023_attack.png` (3px-tall streaks — NOT a chunky crossbow bolt cone!).
   * Origin `(tipX, y)` is the EXACT front needle tip of the arrowhead; `tailLen` extends backward opposite `dirX`.
   */
  private drawElvenSpiritArrow(
    ctx: CanvasRenderingContext2D,
    tipX: number,
    y: number,
    dirX: -1 | 1,
    scale = 1.0,
    tailLen = 220
  ): void {
    const localTail = Math.max(36, tailLen / Math.max(0.25, scale));
    ctx.save();
    ctx.translate(tipX, y);
    ctx.scale(dirX * scale, scale);

    // 1. Delicate tapering sapphire-blue energy slipstream aura along shaft (ONLY ±4.5px tall, tapering to 0.5px!)
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const auraGrad = ctx.createLinearGradient(0, 0, -localTail, 0);
    auraGrad.addColorStop(0, 'rgba(255, 255, 255, 0.86)');
    auraGrad.addColorStop(0.14, 'rgba(125, 211, 252, 0.82)');
    auraGrad.addColorStop(0.55, 'rgba(56, 189, 248, 0.36)');
    auraGrad.addColorStop(1, 'rgba(37, 99, 235, 0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.lineTo(-18, -5.2);
    ctx.lineTo(-localTail, -0.8);
    ctx.lineTo(-localTail, 0.8);
    ctx.lineTo(-18, 5.2);
    ctx.closePath();
    ctx.fill();

    // Fine wispy parallel energy threads right behind the arrowhead barbs (matching Frame 5 nb6_4.webp!)
    const wispLen = Math.min(localTail * 0.72, 130);
    const wispGrad = ctx.createLinearGradient(-22, 0, -22 - wispLen, 0);
    wispGrad.addColorStop(0, 'rgba(186, 230, 253, 0.62)');
    wispGrad.addColorStop(0.55, 'rgba(56, 189, 248, 0.25)');
    wispGrad.addColorStop(1, 'rgba(37, 99, 235, 0)');
    ctx.strokeStyle = wispGrad;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-24, -4.6);
    ctx.lineTo(-24 - wispLen, -3.2);
    ctx.moveTo(-24, 4.6);
    ctx.lineTo(-24 - wispLen, 3.2);
    ctx.stroke();
    ctx.restore();

    // 2. Crisp razor-thin azure energy sheath & pure crystalline white needle shaft (matching Frame 5!)
    const shaftLen = Math.max(24, localTail);
    const sheathGrad = ctx.createLinearGradient(-14, 0, -shaftLen, 0);
    sheathGrad.addColorStop(0, 'rgba(56, 189, 248, 0.96)');
    sheathGrad.addColorStop(0.42, 'rgba(96, 165, 250, 0.84)');
    sheathGrad.addColorStop(0.78, 'rgba(59, 130, 246, 0.32)');
    sheathGrad.addColorStop(1, 'rgba(37, 99, 235, 0)');
    ctx.fillStyle = sheathGrad;
    ctx.beginPath();
    ctx.moveTo(-14, -2.5);
    ctx.lineTo(-shaftLen, -0.5);
    ctx.lineTo(-shaftLen, 0.5);
    ctx.lineTo(-14, 2.5);
    ctx.closePath();
    ctx.fill();

    const coreLen = Math.min(shaftLen, shaftLen * 0.88);
    const coreGrad = ctx.createLinearGradient(-12, 0, -coreLen, 0);
    coreGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    coreGrad.addColorStop(0.5, 'rgba(240, 249, 255, 0.92)');
    coreGrad.addColorStop(0.85, 'rgba(186, 230, 253, 0.45)');
    coreGrad.addColorStop(1, 'rgba(186, 230, 253, 0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.moveTo(-12, -1.25);
    ctx.lineTo(-coreLen, -0.35);
    ctx.lineTo(-coreLen, 0.35);
    ctx.lineTo(-12, 1.25);
    ctx.closePath();
    ctx.fill();

    // 3. Sleek swept-back barbed elven spirit arrowhead (exact proportions of Frame 5 `nb6_4.webp`: ~34px long × 15px tall!)
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-34, -7.2);
    ctx.lineTo(-22, -1.7);
    ctx.lineTo(-22, 1.7);
    ctx.lineTo(-34, 7.2);
    ctx.closePath();
    ctx.fill();

    // Outer luminous sapphire ink rim around the arrowhead
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Inner bright ice-blue barb bevel accent
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.85)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(-24, -4.4);
    ctx.moveTo(-4, 0);
    ctx.lineTo(-24, 4.4);
    ctx.stroke();
    ctx.restore();

    // Subtle compact tip glint (radius 10px — keeps arrow razor-sharp, never bloated!)
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const glint = ctx.createRadialGradient(-2, 0, 0.5, -2, 0, 11);
    glint.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    glint.addColorStop(0.45, 'rgba(125, 211, 252, 0.55)');
    glint.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = glint;
    ctx.beginPath();
    ctx.arc(-2, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  /**
   * Authentic 1995 DOS `#023 Loran` (`f17..f23`) Stage 3 target landing / absorption effect:
   * As each thin spirit arrow pierces `(hitX, hitY)`, its long luminous white-blue needle streak
   * collapses rapidly tail-into-tip (`280px -> 108px -> 36px -> vanish`) straight into the wound,
   * paired with a crisp sapphire-white piercing star flash and vertical elliptical shock ring.
   */
  private drawSpiritArrowImpactStreak(
    ctx: CanvasRenderingContext2D,
    hitX: number,
    hitY: number,
    dirX: -1 | 1,
    bp: number,
    isFinisher: boolean
  ): void {
    const t = Math.max(0, Math.min(1, bp));
    const fade = 1 - t;
    const streakLen = Math.max(8, (isFinisher ? 310 : 270) * Math.pow(fade, 1.55));
    const halfH = Math.max(0.8, (isFinisher ? 2.8 : 2.3) * (1 - t * 0.45));

    ctx.save();
    ctx.translate(hitX, hitY);
    ctx.scale(dirX, 1);
    ctx.globalCompositeOperation = 'screen';

    // 1. Collapsing needle-thin energy streak zipping straight into the impact point!
    const haloGrad = ctx.createLinearGradient(8, 0, -streakLen, 0);
    haloGrad.addColorStop(0, `rgba(255, 255, 255, ${0.95 * fade})`);
    haloGrad.addColorStop(0.28, `rgba(125, 211, 252, ${0.88 * fade})`);
    haloGrad.addColorStop(0.72, `rgba(56, 189, 248, ${0.42 * fade})`);
    haloGrad.addColorStop(1, 'rgba(37, 99, 235, 0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-streakLen, -halfH * 2.2);
    ctx.lineTo(-streakLen, halfH * 2.2);
    ctx.closePath();
    ctx.fill();

    // Pure razor-white interior needle line (matching DOS 3px white-blue hit streak!)
    const coreGrad = ctx.createLinearGradient(6, 0, -streakLen * 0.92, 0);
    coreGrad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(1, fade * 1.4)})`);
    coreGrad.addColorStop(0.58, `rgba(224, 242, 254, ${0.92 * fade})`);
    coreGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(0, -halfH);
    ctx.lineTo(-streakLen * 0.92, -0.45);
    ctx.lineTo(-streakLen * 0.92, 0.45);
    ctx.lineTo(0, halfH);
    ctx.closePath();
    ctx.fill();

    // 2. Sharp piercing burst flash right at the wound point (`t < 0.72`)
    if (t < 0.72) {
      const ft = t / 0.72;
      const fa = Math.pow(1 - ft, 1.35);

      // Vertical elliptical shock ring perpendicular to arrow trajectory
      ctx.strokeStyle = `rgba(186, 230, 253, ${0.86 * fa})`;
      ctx.lineWidth = (isFinisher ? 2.6 : 1.8) * (1 - ft * 0.5);
      ctx.beginPath();
      ctx.ellipse(0, 0, (7 + ft * (isFinisher ? 20 : 14)), (14 + ft * (isFinisher ? 54 : 38)), 0, 0, Math.PI * 2);
      ctx.stroke();

      // Razor 4-point ice-white piercing star flash (`+` + angled `×` micro needles)
      const starR = (isFinisher ? 52 : 34) * (0.45 + ft * 0.85);
      const starW = (isFinisher ? 4.2 : 3.0) * fa;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.96 * fa})`;
      ctx.beginPath();
      ctx.moveTo(0, -starR);
      ctx.lineTo(starW, 0);
      ctx.lineTo(0, starR);
      ctx.lineTo(-starW, 0);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-starR * 1.15, 0);
      ctx.lineTo(0, -starW * 0.8);
      ctx.lineTo(starR * 0.75, 0);
      ctx.lineTo(0, starW * 0.8);
      ctx.closePath();
      ctx.fill();

      // Diagonal fine splinter spark lines flying back off impact
      ctx.strokeStyle = `rgba(125, 211, 252, ${0.9 * fa})`;
      ctx.lineWidth = 1.4;
      const dLen = (isFinisher ? 44 : 28) * (0.4 + ft * 0.9);
      for (const ang of [-2.45, -1.9, 1.9, 2.45]) {
        const r0 = 6 + ft * 12;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0);
        ctx.lineTo(Math.cos(ang) * (r0 + dLen), Math.sin(ang) * (r0 + dLen));
        ctx.stroke();
      }

      // Pinpoint incandescent wound core glow
      const coreR = (isFinisher ? 26 : 18) * fa + 4;
      const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, coreR);
      glow.addColorStop(0, `rgba(255, 255, 255, ${0.98 * fa})`);
      glow.addColorStop(0.45, `rgba(56, 189, 248, ${0.72 * fa})`);
      glow.addColorStop(1, 'rgba(37, 99, 235, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, coreR, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /** Draws a crisp HD painted crossbow bolt / arrow / beam with supersonic flare cone. */
  private drawHdProjectile(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    dirX: -1 | 1,
    projectileType: 'bolt' | 'sniper_bolt' | 'arrow' | 'beam' | 'cryo_beam' | 'orb',
    scale = 1.0
  ): void {
    if (projectileType === 'arrow') {
      // Dedicated razor-thin elven spirit arrow (never draw Celia's wide crossbow shock-cone triangle!)
      this.drawElvenSpiritArrow(ctx, x, y, dirX, scale, 220 * scale);
      return;
    }
    if (projectileType === 'sniper_bolt') {
      this.drawSniperCrossbowBolt(ctx, x, y, dirX, scale, true);
      return;
    }
    if (projectileType === 'cryo_beam') {
      this.drawCryoPlasmaWave(ctx, x, y, dirX, scale, 0.5);
      return;
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dirX * scale, scale);

    // Glowing aerodynamic energy wake
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const aura = ctx.createLinearGradient(75, 0, -240, 0);
    aura.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    aura.addColorStop(0.28, 'rgba(253, 224, 71, 0.78)');
    aura.addColorStop(0.65, 'rgba(249, 115, 22, 0.35)');
    aura.addColorStop(1, 'rgba(249, 115, 22, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.moveTo(86, 0);
    ctx.lineTo(-240, -24);
    ctx.lineTo(-240, 24);
    ctx.closePath();
    ctx.fill();

    // Shock cone rings right behind tip
    ctx.strokeStyle = 'rgba(254, 249, 195, 0.78)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(64, 0);
    ctx.lineTo(14, -22);
    ctx.moveTo(64, 0);
    ctx.lineTo(14, 22);
    ctx.stroke();
    ctx.restore();

    if (projectileType === 'beam') {
      // High-energy golden-white plasma cannon lance (matching #013 Beckway's iconic yellow plasma bolts!)
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const outer = ctx.createLinearGradient(95, 0, -240, 0);
      outer.addColorStop(0, 'rgba(255, 255, 255, 1)');
      outer.addColorStop(0.25, 'rgba(253, 224, 71, 0.95)');
      outer.addColorStop(0.7, 'rgba(249, 115, 22, 0.65)');
      outer.addColorStop(1, 'rgba(249, 115, 22, 0)');
      ctx.fillStyle = outer;
      ctx.beginPath();
      ctx.roundRect(-230, -16, 320, 32, 16);
      ctx.fill();

      const core = ctx.createLinearGradient(88, 0, -200, 0);
      core.addColorStop(0, '#ffffff');
      core.addColorStop(0.55, '#fef9c3');
      core.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.roundRect(-195, -7, 280, 14, 7);
      ctx.fill();
      ctx.restore();
    } else {
      // Dark mahogany & crimson-banded shaft
      ctx.fillStyle = '#7c2d12';
      ctx.fillRect(-88, -3.5, 134, 7);
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(-88, -1.2, 134, 2.4);

      // Fletching feathers at tail (crisp silver-white & crimson trim)
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(-64, -3);
      ctx.lineTo(-96, -15);
      ctx.lineTo(-108, -13);
      ctx.lineTo(-84, -3);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-64, 3);
      ctx.lineTo(-96, 15);
      ctx.lineTo(-108, 13);
      ctx.lineTo(-84, 3);
      ctx.closePath();
      ctx.fill();

      // Gilded steel broadhead bolt tip
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(76, 0);
      ctx.lineTo(36, -11);
      ctx.lineTo(44, 0);
      ctx.lineTo(36, 11);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // White-hot impact glare at tip
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const tipGlow = ctx.createRadialGradient(70, 0, 2, 70, 0, 34);
      tipGlow.addColorStop(0, 'rgba(255, 255, 255, 1)');
      tipGlow.addColorStop(0.45, 'rgba(253, 224, 71, 0.85)');
      tipGlow.addColorStop(1, 'rgba(253, 224, 71, 0)');
      ctx.fillStyle = tipGlow;
      ctx.beginPath();
      ctx.arc(70, 0, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Authentic 1995 DOS `#040 Celia (Sniper T2)` repeating heavy steel-tipped arbalest bolt (`u_040_attack.png` F11..F17):
   * Sleek deep mahogany-rust shaft (`#9a3412`), razor-sharp flanged steel broadhead point (`#e2e8f0`),
   * and triple-ribbed iron-grey feathered tail fletching — clean & tactical, zero orange fireball cone!
   */
  private drawSniperCrossbowBolt(
    ctx: CanvasRenderingContext2D,
    tipX: number,
    y: number,
    dirX: -1 | 1,
    scale = 1.0,
    inFlight = true
  ): void {
    ctx.save();
    ctx.translate(tipX, y);
    ctx.scale(dirX * scale, scale);

    if (inFlight) {
      // Razor-slim pale silver supersonic slipstream wake (clean steel arrow look from DOS F12/F13!)
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const wg = ctx.createLinearGradient(0, 0, -210, 0);
      wg.addColorStop(0, 'rgba(241, 245, 249, 0.85)');
      wg.addColorStop(0.25, 'rgba(203, 213, 225, 0.42)');
      wg.addColorStop(1, 'rgba(148, 163, 184, 0)');
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(-22, -6.5);
      ctx.lineTo(-210, -1.2);
      ctx.lineTo(-210, 1.2);
      ctx.lineTo(-22, 6.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Long slender rust-mahogany wooden sniper shaft (matching DOS F11..F17 `u_040_attack.png` exact tone!)
    ctx.fillStyle = '#451a03';
    ctx.fillRect(-132, -3.1, 108, 6.2);
    ctx.fillStyle = '#b45309';
    ctx.fillRect(-130, -2.1, 106, 4.2);
    ctx.fillStyle = '#9a3412';
    ctx.fillRect(-130, -1.6, 106, 2.2);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-124, -0.7, 94, 0.9);

    // Metallic steel collar rings holding broadhead & fletching
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-30, -2.6, 7, 5.2);
    ctx.fillRect(-108, -2.6, 5, 5.2);

    // Classic DOS silver-grey triple-ribbed metallic feather fletching vanes at tail
    ctx.fillStyle = '#cbd5e1';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-102, -2.2);
    ctx.lineTo(-132, -8.4);
    ctx.lineTo(-144, -7.2);
    ctx.lineTo(-124, -2.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-102, 2.2);
    ctx.lineTo(-132, 8.4);
    ctx.lineTo(-144, 7.2);
    ctx.lineTo(-124, 2.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Tiny ribbed dark tick notches matching pixel fletching feathers in DOS F15..F17
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.65)';
    ctx.lineWidth = 1.0;
    for (let tx = -109; tx >= -130; tx -= 5.5) {
      ctx.beginPath();
      ctx.moveTo(tx, -2.5);
      ctx.lineTo(tx - 5, -6.8);
      ctx.moveTo(tx, 2.5);
      ctx.lineTo(tx - 5, 6.8);
      ctx.stroke();
    }

    if (inFlight) {
      // Gleaming beveled broadhead silver sniper steel point (only visible while flying; buried inside wound when stuck!)
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(-28, -5.8);
      ctx.lineTo(-22, 0);
      ctx.lineTo(-28, 5.8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.0;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(-26, -4.2);
      ctx.lineTo(-22, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      // Embedded into enemy target: dark wound shadow ring right at the buried entry collar
      ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
      ctx.beginPath();
      ctx.ellipse(-24, 0, 3.5, 6.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Authentic 1995 DOS `#045 Beckway (Sniper T2)` roaring single cryo-sapphire plasma shock-cannon beam wave
   * (`u_045_attack.png` F12..F14, F18..F20): blazing ice-white needle core tearing jagged spiraling
   * azure/sapphire crescent shock-fronds curving dramatically backward (`distinct from base #013's golden beams!`).
   */
  private drawCryoPlasmaWave(
    ctx: CanvasRenderingContext2D,
    tipX: number,
    y: number,
    dirX: -1 | 1,
    scale = 1.0,
    phase = 0.5
  ): void {
    ctx.save();
    ctx.translate(tipX, y);
    ctx.scale(dirX * scale, scale);
    ctx.globalCompositeOperation = 'screen';

    // 1. Massive outer electric sapphire energy shroud around the beam shaft
    const bodyLen = 360;
    const outer = ctx.createLinearGradient(42, 0, -bodyLen, 0);
    outer.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
    outer.addColorStop(0.18, 'rgba(125, 211, 252, 0.88)');
    outer.addColorStop(0.55, 'rgba(59, 130, 246, 0.55)');
    outer.addColorStop(1, 'rgba(30, 64, 175, 0)');
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.moveTo(42, 0);
    ctx.quadraticCurveTo(18, -32, -bodyLen, -14);
    ctx.lineTo(-bodyLen, 14);
    ctx.quadraticCurveTo(18, 32, 42, 0);
    ctx.closePath();
    ctx.fill();

    // 2. Iconic curving ice-blue bow-shockwave umbrella & swept plasma fins (`matching DOS #045 F18 & F19!`)
    const waveRings = [
      { ox: 26, rx: 46, ry: 58, alpha: 0.95 },
      { ox: -38, rx: 44, ry: 48, alpha: 0.78 },
      { ox: -108, rx: 40, ry: 38, alpha: 0.56 },
      { ox: -178, rx: 34, ry: 28, alpha: 0.36 },
    ];
    for (let wi = 0; wi < waveRings.length; wi++) {
      const wr = waveRings[wi];
      const wobble = Math.sin(phase * 18 + wi * 2.1) * 5;
      ctx.strokeStyle = wi === 0 ? `rgba(224, 242, 254, ${wr.alpha})` : `rgba(96, 165, 250, ${wr.alpha})`;
      ctx.lineWidth = wi === 0 ? 6.5 : 4.2 - wi * 0.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(wr.ox - wr.rx * 1.45, -wr.ry + wobble);
      ctx.quadraticCurveTo(wr.ox + wr.rx * 0.45, -wr.ry * 0.42, wr.ox + 10, 0);
      ctx.quadraticCurveTo(wr.ox + wr.rx * 0.45, wr.ry * 0.42, wr.ox - wr.rx * 1.45, wr.ry - wobble);
      ctx.stroke();

      // Jagged crisp cyan plasma barbs flaking backward off each swept shock collar
      ctx.strokeStyle = `rgba(186, 230, 253, ${wr.alpha * 0.85})`;
      ctx.lineWidth = 2.0;
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(wr.ox - wr.rx * 0.25, sgn * wr.ry * 0.48);
        ctx.quadraticCurveTo(wr.ox - wr.rx * 0.9, sgn * (wr.ry * 0.85 + 8), wr.ox - wr.rx * 1.85, sgn * (wr.ry * 0.72));
        ctx.stroke();
      }
    }

    // 3. Blinding opaque-feeling crystalline white-blue plasma beam core
    const core = ctx.createLinearGradient(34, 0, -bodyLen * 0.92, 0);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.45, '#e0f2fe');
    core.addColorStop(0.82, 'rgba(125, 211, 252, 0.55)');
    core.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.roundRect(-bodyLen * 0.88, -10.5, bodyLen * 0.88 + 30, 21, 10.5);
    ctx.fill();

    // Rounded leading headlight bloom at bow tip
    const tipG = ctx.createRadialGradient(24, 0, 3, 24, 0, 56);
    tipG.addColorStop(0, 'rgba(255, 255, 255, 1)');
    tipG.addColorStop(0.35, 'rgba(186, 230, 253, 0.9)');
    tipG.addColorStop(0.7, 'rgba(59, 130, 246, 0.45)');
    tipG.addColorStop(1, 'rgba(30, 64, 175, 0)');
    ctx.fillStyle = tipG;
    ctx.beginPath();
    ctx.arc(24, 0, 56, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** Dramatic sapphire plasma shockwave dissipation right after `#045 Beckway`'s beam hits (`DOS F19->F20`). */
  private drawCryoPlasmaImpact(
    ctx: CanvasRenderingContext2D,
    hitX: number,
    hitY: number,
    dirX: -1 | 1,
    bp: number
  ): void {
    const t = Math.max(0, Math.min(1, bp));
    const fade = 1 - t;
    ctx.save();
    ctx.translate(hitX, hitY);
    ctx.scale(dirX, 1);
    ctx.globalCompositeOperation = 'screen';

    // Collapsing crisp pale ice-blue plasma tail streaking straight into the enemy (`DOS F20!`)
    const tailLen = Math.max(24, 420 * Math.pow(fade, 1.35));
    const halfH = Math.max(2, 22 * Math.pow(fade, 0.9));
    const tg = ctx.createLinearGradient(16, 0, -tailLen, 0);
    tg.addColorStop(0, `rgba(255, 255, 255, ${0.98 * fade})`);
    tg.addColorStop(0.35, `rgba(186, 230, 253, ${0.88 * fade})`);
    tg.addColorStop(0.75, `rgba(59, 130, 246, ${0.45 * fade})`);
    tg.addColorStop(1, 'rgba(30, 64, 175, 0)');
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(22, -halfH * 0.4);
    ctx.lineTo(-tailLen, -halfH * 1.15);
    ctx.lineTo(-tailLen, halfH * 1.15);
    ctx.lineTo(22, halfH * 0.4);
    ctx.closePath();
    ctx.fill();

    // Expanding elliptical cryo-plasma impact shock ring (`DOS F18/F19 swirl collar!`)
    const ringR = 26 + t * 145;
    ctx.strokeStyle = `rgba(186, 230, 253, ${0.9 * fade})`;
    ctx.lineWidth = Math.max(1.5, 9 * fade);
    ctx.beginPath();
    ctx.ellipse(0, 0, ringR * 0.48, ringR, 0, 0, Math.PI * 2);
    ctx.stroke();

    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 95 * (0.4 + 0.8 * t));
    g.addColorStop(0, `rgba(255, 255, 255, ${0.95 * fade})`);
    g.addColorStop(0.4, `rgba(125, 211, 252, ${0.72 * fade})`);
    g.addColorStop(1, 'rgba(37, 99, 235, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 95 * (0.4 + 0.8 * t), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Draws a rotating 3D perspective ground magic circle for Stage 1 Chant & Stage 2 Spell Seal. */
  private drawMagicCastCircle(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    progress: number,
    element: 'fire' | 'holy' | 'thunder' | 'ice' | 'arcane'
  ): void {
    const fade = progress < 0.15 ? progress / 0.15 : progress > 0.88 ? (1 - progress) / 0.12 : 1;
    if (fade <= 0.01) return;

    const primary =
      element === 'holy'
        ? '254, 240, 138'
        : element === 'fire'
          ? '249, 115, 22'
          : element === 'ice'
            ? '56, 189, 248'
            : element === 'thunder'
              ? '250, 204, 21'
              : '168, 85, 247';
    const secondary = element === 'holy' ? '125, 211, 252' : element === 'fire' ? '253, 224, 71' : '232, 121, 249';

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.translate(cx, cy);
    ctx.scale(1, 0.3);

    const rOuter = 230 + Math.sin(progress * Math.PI) * 35;
    const rot = progress * Math.PI * 2.4;

    // Radiant floor glow
    const glow = ctx.createRadialGradient(0, 0, 20, 0, 0, rOuter * 1.25);
    glow.addColorStop(0, `rgba(255, 255, 240, ${0.42 * fade})`);
    glow.addColorStop(0.55, `rgba(${primary}, ${0.38 * fade})`);
    glow.addColorStop(1, `rgba(${primary}, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, rOuter * 1.25, 0, Math.PI * 2);
    ctx.fill();

    // Outer double concentric rings
    ctx.strokeStyle = `rgba(${primary}, ${0.9 * fade})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, rOuter, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(${secondary}, ${0.8 * fade})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, rOuter * 0.84, 0, Math.PI * 2);
    ctx.stroke();

    // Rotating 6-point hexagram / arcane star
    ctx.save();
    ctx.rotate(rot);
    ctx.strokeStyle = `rgba(255, 252, 230, ${0.85 * fade})`;
    ctx.lineWidth = 3.5;
    for (let tri = 0; tri < 2; tri++) {
      ctx.beginPath();
      for (let k = 0; k <= 3; k++) {
        const a = (k * Math.PI * 2) / 3 + (tri * Math.PI) / 3;
        const px = Math.cos(a) * rOuter * 0.84;
        const py = Math.sin(a) * rOuter * 0.84;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // Rune tick marks around perimeter
    for (let k = 0; k < 18; k++) {
      const a = (k * Math.PI * 2) / 18;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * rOuter * 0.86, Math.sin(a) * rOuter * 0.86);
      ctx.lineTo(Math.cos(a) * rOuter * 0.98, Math.sin(a) * rOuter * 0.98);
      ctx.stroke();
    }
    ctx.restore();

    ctx.restore();
  }

  /** Draws Stage 2 Modern 2.5D Elemental Spell Shader (Fire Dragon Pillar / Holy Radiance / Arcane Nova). */
  private drawModernSpellEffect(
    ctx: CanvasRenderingContext2D,
    cx: number,
    groundY: number,
    progress: number,
    element: 'fire' | 'holy' | 'thunder' | 'ice' | 'arcane'
  ): void {
    const fade = progress < 0.14 ? progress / 0.14 : progress > 0.78 ? (1 - progress) / 0.22 : 1;
    if (fade <= 0.01) return;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    if (element === 'holy') {
      // Descending Celestial Cathedral Light Pillar + Golden Cross Starbursts (#010 Marin)
      const pillarW = (175 + Math.sin(progress * Math.PI * 3) * 28) * fade;
      const topY = -40;
      const beamGrad = ctx.createLinearGradient(cx - pillarW, 0, cx + pillarW, 0);
      beamGrad.addColorStop(0, 'rgba(125, 211, 252, 0)');
      beamGrad.addColorStop(0.24, `rgba(253, 224, 71, ${0.48 * fade})`);
      beamGrad.addColorStop(0.5, `rgba(255, 255, 245, ${0.95 * fade})`);
      beamGrad.addColorStop(0.76, `rgba(253, 224, 71, ${0.48 * fade})`);
      beamGrad.addColorStop(1, 'rgba(125, 211, 252, 0)');
      ctx.fillStyle = beamGrad;
      ctx.fillRect(cx - pillarW, topY, pillarW * 2, groundY - topY + 25);

      // Celestial halo rings descending down the light beam
      for (let r = 0; r < 3; r++) {
        const rp = (progress * 1.8 + r * 0.33) % 1;
        const ry = groundY - 460 * (1 - rp);
        const rad = 120 + Math.sin(rp * Math.PI) * 75;
        ctx.save();
        ctx.translate(cx, ry);
        ctx.scale(1, 0.28);
        ctx.strokeStyle = `rgba(254, 249, 195, ${(1 - rp) * 0.9 * fade})`;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Radiant golden cross flare at torso impact
      const crossY = groundY - 210;
      const cSize = 180 * Math.sin(Math.min(1, progress * 1.3) * Math.PI) * fade;
      ctx.strokeStyle = `rgba(255, 255, 240, ${0.92 * fade})`;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(cx - cSize, crossY);
      ctx.lineTo(cx + cSize, crossY);
      ctx.moveTo(cx, crossY - cSize * 1.25);
      ctx.lineTo(cx, crossY + cSize * 1.05);
      ctx.stroke();
    } else if (element === 'thunder') {
      // Sky-Splitting Jagged Lightning Bolts + Orbiting High-Voltage Plasma Spheres (#014 Shan 轟雷術!)
      const boltSeeds = [0, -68, 62];
      for (let bi = 0; bi < boltSeeds.length; bi++) {
        const bx0 = cx + boltSeeds[bi];
        const flicker = 0.65 + 0.35 * Math.sin(progress * 42 + bi * 2.1);
        const segs = 14;
        const pts: { x: number; y: number }[] = [];
        for (let s = 0; s <= segs; s++) {
          const u = s / segs;
          const y = -40 + (groundY - 20 + 40) * u;
          const jitter = s === 0 || s === segs ? 0 : Math.sin(s * 5.7 + Math.floor(progress * 18) * 3.1 + bi) * 38;
          pts.push({ x: bx0 + jitter, y });
        }
        // Electric cyan outer glow
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.72 * fade * flicker})`;
        ctx.lineWidth = bi === 0 ? 28 : 16;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        pts.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
        ctx.stroke();

        // White-hot plasma core
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.96 * fade * flicker})`;
        ctx.lineWidth = bi === 0 ? 9 : 5;
        ctx.stroke();
      }

      // Orbiting electric plasma spheres (classic FD2 #6 轟雷術 signature!)
      for (let oi = 0; oi < 4; oi++) {
        const ang = progress * Math.PI * 5 + (oi * Math.PI) / 2;
        const ox = cx + Math.cos(ang) * 145;
        const oy = groundY - 190 + Math.sin(ang) * 55;
        const sGrad = ctx.createRadialGradient(ox, oy, 2, ox, oy, 48 * fade);
        sGrad.addColorStop(0, `rgba(255, 255, 255, ${0.95 * fade})`);
        sGrad.addColorStop(0.4, `rgba(56, 189, 248, ${0.75 * fade})`);
        sGrad.addColorStop(1, 'rgba(99, 102, 241, 0)');
        ctx.fillStyle = sGrad;
        ctx.beginPath();
        ctx.arc(ox, oy, 48 * fade, 0, Math.PI * 2);
        ctx.fill();
      }

      // High-voltage ground discharge burst
      const gGrad = ctx.createRadialGradient(cx, groundY - 130, 10, cx, groundY - 130, 210 * fade);
      gGrad.addColorStop(0, `rgba(255, 255, 255, ${0.92 * fade})`);
      gGrad.addColorStop(0.35, `rgba(125, 211, 252, ${0.65 * fade})`);
      gGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = gGrad;
      ctx.beginPath();
      ctx.arc(cx, groundY - 130, 210 * fade, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Spiraling Twin Flame Dragon / Arcane Inferno Pillar erupting skyward (#009 Uni)
      const isFire = element === 'fire';
      const cOuter = isFire ? '239, 68, 68' : '168, 85, 247';
      const cMid = isFire ? '249, 115, 22' : '56, 189, 248';
      const cCore = isFire ? '254, 240, 138' : '240, 249, 255';

      const colH = 660 * Math.min(1, progress * 2.2);
      const colW = (160 + Math.sin(progress * Math.PI * 6) * 26) * fade;
      const pGrad = ctx.createLinearGradient(cx - colW, groundY, cx + colW, groundY);
      pGrad.addColorStop(0, `rgba(${cOuter}, 0)`);
      pGrad.addColorStop(0.22, `rgba(${cOuter}, ${0.55 * fade})`);
      pGrad.addColorStop(0.42, `rgba(${cMid}, ${0.78 * fade})`);
      pGrad.addColorStop(0.5, `rgba(255, 255, 240, ${0.95 * fade})`);
      pGrad.addColorStop(0.58, `rgba(${cMid}, ${0.78 * fade})`);
      pGrad.addColorStop(0.78, `rgba(${cOuter}, ${0.55 * fade})`);
      pGrad.addColorStop(1, `rgba(${cOuter}, 0)`);
      ctx.fillStyle = pGrad;
      ctx.fillRect(cx - colW, groundY - colH, colW * 2, colH + 10);

      // Twin helical flame ribbons coiling upward around the target!
      for (let strand = 0; strand < 2; strand++) {
        ctx.beginPath();
        const segs = 28;
        for (let i = 0; i <= segs; i++) {
          const u = i / segs;
          const y = groundY - u * colH;
          const angle = u * Math.PI * 3.6 - progress * 14 + strand * Math.PI;
          const x = cx + Math.cos(angle) * (105 + Math.sin(u * Math.PI) * 58);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(${cCore}, ${0.92 * fade})`;
        ctx.lineWidth = 22 * fade;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.strokeStyle = `rgba(${cOuter}, ${0.65 * fade})`;
        ctx.lineWidth = 42 * fade;
        ctx.stroke();
      }

      // Erupting ground fireball bloom
      const bloomR = 230 * fade;
      const bGrad = ctx.createRadialGradient(cx, groundY - 110, 12, cx, groundY - 110, bloomR);
      bGrad.addColorStop(0, `rgba(255, 255, 245, ${0.95 * fade})`);
      bGrad.addColorStop(0.4, `rgba(${cMid}, ${0.7 * fade})`);
      bGrad.addColorStop(1, `rgba(${cOuter}, 0)`);
      ctx.fillStyle = bGrad;
      ctx.beginPath();
      ctx.arc(cx, groundY - 110, bloomR, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawGroundShadow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radiusX: number,
    alphaScale = 1.0
  ): void {
    const a = Math.max(0.12, Math.min(1.0, alphaScale));
    ctx.save();
    ctx.translate(x, y - 10);
    ctx.scale(1, 0.24);
    const grad = ctx.createRadialGradient(0, 0, radiusX * 0.1, 0, 0, radiusX);
    grad.addColorStop(0, `rgba(5, 8, 6, ${(0.74 * a).toFixed(3)})`);
    grad.addColorStop(0.6, `rgba(5, 8, 6, ${(0.36 * a).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(5, 8, 6, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radiusX, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Dynamic directional anime speed-lines painted behind soaring / dive-bombing flying units. */
  private drawAerialSpeedLines(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    angleRad: number,
    intensity: number,
    colorRgb = '254, 240, 138'
  ): void {
    if (intensity <= 0.02 || !this.config.enableVolumetricSlash) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.translate(W * 0.5, H * 0.5);
    ctx.rotate(angleRad);
    const diag = Math.hypot(W, H) * 0.65;
    const lineCount = 18;
    for (let i = 0; i < lineCount; i++) {
      const seed = (i * 137.5) % 100;
      const y = ((i / (lineCount - 1)) - 0.5) * H * 1.05 + Math.sin(seed) * 28;
      const speedShift = ((this.elapsedMs * 3.8 + seed * 42) % (diag * 2)) - diag;
      const len = 180 + (seed % 32) * 14;
      const lineAlpha = (0.14 + (i % 3) * 0.09) * Math.min(1, intensity);
      const grad = ctx.createLinearGradient(speedShift - len, y, speedShift + len * 0.25, y);
      grad.addColorStop(0, `rgba(${colorRgb}, 0)`);
      grad.addColorStop(0.45, `rgba(${colorRgb}, ${lineAlpha.toFixed(3)})`);
      grad.addColorStop(0.82, `rgba(255, 255, 255, ${(lineAlpha * 1.15).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = i % 4 === 0 ? 4.5 : 2.2;
      ctx.beginPath();
      ctx.moveTo(speedShift - len, y);
      ctx.lineTo(speedShift + len * 0.25, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawGroundShockwave(ctx: CanvasRenderingContext2D, cx: number, cy: number, progress: number): void {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const radius = 50 + progress * 340;
    const alpha = Math.max(0, (1 - progress) * 0.75);
    ctx.translate(cx, cy);
    ctx.scale(1, 0.28);
    ctx.strokeStyle = `rgba(253, 224, 71, ${alpha})`;
    ctx.lineWidth = Math.max(2, (1 - progress) * 18);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.8})`;
    ctx.lineWidth = Math.max(1, (1 - progress) * 8);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private getTintedSpriteCanvas(
    img: HTMLImageElement,
    tintColor: string,
    tintAlpha: number
  ): HTMLCanvasElement | null {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return null;
    if (!this.spriteTintCanvas) {
      this.spriteTintCanvas = document.createElement('canvas');
      this.spriteTintCtx = this.spriteTintCanvas.getContext('2d');
    }
    const canvas = this.spriteTintCanvas;
    const tctx = this.spriteTintCtx;
    if (!tctx) return null;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    tctx.globalCompositeOperation = 'source-over';
    tctx.globalAlpha = 1;
    tctx.clearRect(0, 0, w, h);
    tctx.drawImage(img, 0, 0, w, h);
    tctx.globalCompositeOperation = 'source-atop';
    tctx.fillStyle = tintColor;
    tctx.globalAlpha = Math.max(0, Math.min(1, tintAlpha));
    tctx.fillRect(0, 0, w, h);
    tctx.globalCompositeOperation = 'source-over';
    tctx.globalAlpha = 1;
    return canvas;
  }

  private drawCharacterSprite(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    footX: number,
    footY: number,
    scaleX: number,
    scaleY: number,
    rotation: number,
    alpha: number,
    displaySize: number,
    tintColor?: string,
    tintAlpha = 0.65
  ): void {
    if (!img || !img.complete || img.naturalWidth === 0) return;
    const anchorRatioX = 0.5;
    const anchorRatioY = 648 / 680;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(footX, footY);
    ctx.rotate(rotation);
    ctx.scale(scaleX, scaleY);

    const dx = -displaySize * anchorRatioX;
    const dy = -displaySize * anchorRatioY;

    if (tintColor && tintAlpha > 0.01) {
      const tinted = this.getTintedSpriteCanvas(img, tintColor, tintAlpha);
      ctx.drawImage(tinted ?? img, dx, dy, displaySize, displaySize);
    } else {
      ctx.drawImage(img, dx, dy, displaySize, displaySize);
    }
    ctx.restore();
  }

  /**
   * Draws an authentic full-screen thick volumetric Ki / Energy Beam (e.g., #022 Karis Hadouken / Kamehameha)
   * shooting diagonally from the stationary attacker's cupped palms straight into the enemy's chest
   * with surging shock-rings and a massive exploding impact splash on the target's body!
   */
  private drawStationaryKiBeam(
    ctx: CanvasRenderingContext2D,
    originX: number,
    originY: number,
    targetX: number,
    targetY: number,
    progress: number,
    chargeOnly: boolean,
    color: 'azure' | 'gold' | 'crimson' | 'emerald',
    thickness: number,
    t: number
  ): void {
    const pal =
      color === 'gold'
        ? { outer: '245, 158, 11', mid: '253, 224, 71', light: '254, 249, 195' }
        : color === 'crimson'
          ? { outer: '220, 38, 38', mid: '251, 146, 60', light: '254, 240, 138' }
          : color === 'emerald'
            ? { outer: '5, 150, 105', mid: '52, 211, 153', light: '209, 250, 229' }
            : { outer: '37, 99, 235', mid: '56, 189, 248', light: '224, 242, 254' };

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    if (chargeOnly) {
      // Swirling inward suction particles & gathering palm glow right on Karis's hands!
      const p = Math.max(0, Math.min(1, progress));
      const r = 24 + p * 46;
      const g = ctx.createRadialGradient(originX, originY, 2, originX, originY, r * 1.45);
      g.addColorStop(0, `rgba(255, 255, 255, ${0.45 + p * 0.45})`);
      g.addColorStop(0.35, `rgba(${pal.mid}, ${0.35 + p * 0.45})`);
      g.addColorStop(1, `rgba(${pal.outer}, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(originX, originY, r * 1.45, 0, Math.PI * 2);
      ctx.fill();

      // 6 smooth curved suction arcs pulling INTO the hands
      for (let i = 0; i < 6; i++) {
        const baseAng = (i * Math.PI) / 3 + t * 0.008;
        const dist = (1 - ((p * 2.2 + i * 0.17) % 1)) * 125;
        const px = originX + Math.cos(baseAng) * dist;
        const py = originY + Math.sin(baseAng) * dist;
        const grad = ctx.createLinearGradient(px, py, originX, originY);
        grad.addColorStop(0, `rgba(${pal.mid}, 0)`);
        grad.addColorStop(0.55, `rgba(${pal.light}, ${0.55 * p})`);
        grad.addColorStop(1, `rgba(255, 255, 255, 0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.5 + p * 2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(
          originX + Math.cos(baseAng + 0.55) * dist * 0.55,
          originY + Math.sin(baseAng + 0.55) * dist * 0.55,
          originX + Math.cos(baseAng + 0.15) * (dist * 0.12),
          originY + Math.sin(baseAng + 0.15) * (dist * 0.12)
        );
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    const p = Math.max(0, Math.min(1, progress));
    const dx = targetX - originX;
    const dy = targetY - originY;
    const totalLen = Math.max(40, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);

    // Beam envelope: instant explosive launch (`0..0.11`), roaring full-span sustain (`0.11..0.78`), snappy taper (`0.78..1.0`)
    const reach = Math.min(1, p / 0.11);
    const curLen = totalLen * reach;
    const fade = p < 0.76 ? 1.0 : Math.max(0, 1 - (p - 0.76) / 0.24);
    const widthScale =
      p < 0.09
        ? 0.55 + (p / 0.09) * 0.55
        : p < 0.76
          ? 1.0 + Math.sin(t * 0.055) * 0.09 + (p < 0.2 ? (1 - p / 0.2) * 0.22 : 0)
          : Math.max(0.08, fade * fade);
    const halfH = thickness * 0.5 * widthScale;

    if (fade <= 0.01) {
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(originX, originY);
    ctx.rotate(angle);

    // 1. Massive outer corona aura sheath
    const coronaH = halfH * 1.65;
    const coronaGrad = ctx.createLinearGradient(0, -coronaH, 0, coronaH);
    coronaGrad.addColorStop(0, `rgba(${pal.outer}, 0)`);
    coronaGrad.addColorStop(0.24, `rgba(${pal.outer}, ${0.52 * fade})`);
    coronaGrad.addColorStop(0.5, `rgba(${pal.mid}, ${0.88 * fade})`);
    coronaGrad.addColorStop(0.76, `rgba(${pal.outer}, ${0.52 * fade})`);
    coronaGrad.addColorStop(1, `rgba(${pal.outer}, 0)`);
    ctx.fillStyle = coronaGrad;
    ctx.beginPath();
    ctx.roundRect(-24, -coronaH, curLen + 48, coronaH * 2, coronaH);
    ctx.fill();

    // 2. Crisp blazing cylindrical mid-beam (electric sky-blue!)
    const midH = halfH * 1.02;
    const midGrad = ctx.createLinearGradient(0, -midH, 0, midH);
    midGrad.addColorStop(0, `rgba(${pal.outer}, ${0.15 * fade})`);
    midGrad.addColorStop(0.18, `rgba(${pal.mid}, ${0.95 * fade})`);
    midGrad.addColorStop(0.5, `rgba(255, 255, 255, ${0.98 * fade})`);
    midGrad.addColorStop(0.82, `rgba(${pal.mid}, ${0.95 * fade})`);
    midGrad.addColorStop(1, `rgba(${pal.outer}, ${0.15 * fade})`);
    ctx.fillStyle = midGrad;
    ctx.beginPath();
    ctx.roundRect(-14, -midH, curLen + 28, midH * 2, midH);
    ctx.fill();

    // 3. Pure incandescent solid white-hot inner core (`source-over` crisp brightness!)
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    const coreH = halfH * 0.56;
    const coreGrad = ctx.createLinearGradient(0, -coreH, 0, coreH);
    coreGrad.addColorStop(0, `rgba(${pal.light}, ${0.25 * fade})`);
    coreGrad.addColorStop(0.25, `rgba(255, 255, 255, ${0.98 * fade})`);
    coreGrad.addColorStop(0.5, `rgba(255, 255, 255, ${1.0 * fade})`);
    coreGrad.addColorStop(0.75, `rgba(255, 255, 255, ${0.98 * fade})`);
    coreGrad.addColorStop(1, `rgba(${pal.light}, ${0.25 * fade})`);
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.roundRect(-8, -coreH, curLen + 16, coreH * 2, coreH);
    ctx.fill();
    ctx.restore();

    // 4. High-velocity supersonic energy streaks & helical crackling lines rushing down the shaft
    for (let si = 0; si < 7; si++) {
      const sy = ((si - 3) / 3.2) * (halfH * 0.85) + Math.sin(t * 0.04 + si * 2.1) * 4;
      const sx = ((t * 1.85 + si * 137) % Math.max(120, curLen)) * 0.85;
      const slen = Math.min(curLen - sx, 90 + (si % 3) * 55);
      if (slen > 15) {
        const sg = ctx.createLinearGradient(sx, sy, sx + slen, sy);
        sg.addColorStop(0, 'rgba(255,255,255,0)');
        sg.addColorStop(0.5, `rgba(255,255,255,${0.9 * fade})`);
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = sg;
        ctx.lineWidth = si % 2 === 0 ? 4 : 2.2;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + slen, sy);
        ctx.stroke();
      }
    }

    // 5. Concentric glowing shockwave rings pulsing rapidly outward from palms toward enemy!
    for (let ri = 0; ri < 4; ri++) {
      const rp = (p * 3.8 + ri * 0.25) % 1;
      const rx = 24 + rp * Math.max(40, curLen - 40);
      const rAlpha = (1 - Math.abs(rp - 0.5) * 1.4) * fade * 0.85;
      if (rAlpha > 0.05) {
        ctx.strokeStyle = `rgba(${pal.light}, ${rAlpha})`;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.ellipse(rx, 0, halfH * 0.22, halfH * (1.28 + rp * 0.22), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 6. Blazing launch sphere right between Karis's cupped palms!
    const launchR = halfH * 1.55;
    const lg = ctx.createRadialGradient(0, 0, 4, 0, 0, launchR);
    lg.addColorStop(0, `rgba(255, 255, 255, ${1.0 * fade})`);
    lg.addColorStop(0.4, `rgba(${pal.light}, ${0.92 * fade})`);
    lg.addColorStop(0.7, `rgba(${pal.mid}, ${0.55 * fade})`);
    lg.addColorStop(1, `rgba(${pal.outer}, 0)`);
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(0, 0, launchR, 0, Math.PI * 2);
    ctx.fill();

    // Crisp leading wavefront / hemispherical blast head while traveling!
    if (reach < 0.99) {
      const headG = ctx.createRadialGradient(curLen, 0, 6, curLen, 0, halfH * 1.7);
      headG.addColorStop(0, 'rgba(255,255,255,1)');
      headG.addColorStop(0.45, `rgba(${pal.mid},0.9)`);
      headG.addColorStop(1, `rgba(${pal.outer},0)`);
      ctx.fillStyle = headG;
      ctx.beginPath();
      ctx.arc(curLen, 0, halfH * 1.7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // 7. MASSIVE EXPLODING IMPACT SPLASH ON ENEMY'S BODY (`reach >= 0.88`)!
    if (reach >= 0.85) {
      const impactIntensity = Math.min(1, (reach - 0.85) / 0.15) * fade;
      const pulse = 1 + Math.sin(t * 0.065) * 0.12;
      const splashR = halfH * 2.55 * pulse;

      // Intense inner white-cyan collision burst wrapping enemy chest
      const ig = ctx.createRadialGradient(targetX, targetY, 6, targetX, targetY, splashR);
      ig.addColorStop(0, `rgba(255, 255, 255, ${1.0 * impactIntensity})`);
      ig.addColorStop(0.28, `rgba(${pal.light}, ${0.95 * impactIntensity})`);
      ig.addColorStop(0.58, `rgba(${pal.mid}, ${0.65 * impactIntensity})`);
      ig.addColorStop(1, `rgba(${pal.outer}, 0)`);
      ctx.fillStyle = ig;
      ctx.beginPath();
      ctx.arc(targetX, targetY, splashR, 0, Math.PI * 2);
      ctx.fill();

      // Splashing liquid-light burst spikes & back-blast tendrils spraying outward behind enemy!
      ctx.save();
      ctx.translate(targetX, targetY);
      ctx.rotate(angle); // +X points past enemy (up-left direction of beam!)
      for (let ti = 0; ti < 12; ti++) {
        const spread = ((ti / 11) - 0.5) * Math.PI * 1.55;
        const wobble = Math.sin(t * 0.045 + ti * 1.9) * 0.14;
        const ang = spread + wobble;
        const len = (halfH * (1.85 + (ti % 3) * 0.65)) * pulse * impactIntensity;
        const baseW = (9 + (ti % 4) * 3.5) * widthScale;
        ctx.fillStyle = ti % 2 === 0 ? `rgba(255, 255, 255, ${0.92 * impactIntensity})` : `rgba(${pal.mid}, ${0.85 * impactIntensity})`;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang + 1.57) * baseW, Math.sin(ang + 1.57) * baseW);
        ctx.lineTo(Math.cos(ang) * len, Math.sin(ang) * len);
        ctx.lineTo(Math.cos(ang - 1.57) * baseW, Math.sin(ang - 1.57) * baseW);
        ctx.closePath();
        ctx.fill();
      }

      // Twin impact shockwave oval rings flattening perpendicular to beam impact plane!
      for (let kr = 0; kr < 2; kr++) {
        const kp = (p * 4.2 + kr * 0.5) % 1;
        const ka = (1 - kp) * impactIntensity * 0.9;
        ctx.strokeStyle = `rgba(${pal.light}, ${ka})`;
        ctx.lineWidth = 4.5 * (1 - kp * 0.5);
        ctx.beginPath();
        ctx.ellipse(-8 + kp * 26, 0, halfH * (0.35 + kp * 0.35), halfH * (1.1 + kp * 1.95), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Authentic 1995 DOS `#044/#062 Kelly (Fighter / Martial Master)` wide explosive fan-shaped
   * golden Qi shockwave splash (`u_044/u_062_attack.png` F7 -> F8 -> F9):
   * Instead of a static straight laser tube, bursts outward from the attacker's braced fist in a
   * sweeping diagonal upper-left (↖) blade-fan spray of jagged golden-amber speed-streaks that
   * tear straight across & past the enemy, then fracture and dissipate into trailing outer embers!
   */
  private drawStationaryKiSplash(
    ctx: CanvasRenderingContext2D,
    originX: number,
    originY: number,
    targetX: number,
    targetY: number,
    progress: number,
    chargeOnly: boolean,
    color: 'azure' | 'gold' | 'crimson' | 'emerald',
    thickness: number,
    t: number
  ): void {
    const pal =
      color === 'gold'
        ? { outer: '234, 88, 12', mid: '245, 158, 11', bright: '253, 224, 71', light: '254, 249, 195' }
        : color === 'crimson'
          ? { outer: '185, 28, 28', mid: '239, 68, 68', bright: '251, 146, 60', light: '254, 240, 138' }
          : color === 'emerald'
            ? { outer: '4, 120, 87', mid: '16, 185, 129', bright: '110, 231, 183', light: '209, 250, 229' }
            : { outer: '29, 78, 216', mid: '56, 189, 248', bright: '125, 211, 252', light: '224, 242, 254' };

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    if (chargeOnly) {
      // Crisp, restrained floor-spark & rising golden tension flare right beside Kelly's crouched stance (no chunky beam ball!)
      const p = Math.max(0, Math.min(1, progress));
      const g = ctx.createRadialGradient(originX, originY + 55, 2, originX, originY + 55, 42 + p * 68);
      g.addColorStop(0, `rgba(255, 255, 255, ${0.28 * p})`);
      g.addColorStop(0.35, `rgba(${pal.bright}, ${0.32 * p})`);
      g.addColorStop(1, `rgba(${pal.outer}, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(originX, originY + 55, 42 + p * 68, 0, Math.PI * 2);
      ctx.fill();
      if (p > 0.45) {
        const sp = (p - 0.45) / 0.55;
        for (let i = 0; i < 6; i++) {
          const ang = Math.PI * 0.92 + ((i - 2.5) * 0.14);
          const r0 = 26 + ((i * 19 + t * 0.18) % 34);
          const len = 28 + (i % 3) * 18;
          ctx.strokeStyle = i % 2 === 0 ? `rgba(${pal.light}, ${0.58 * sp})` : `rgba(${pal.bright}, ${0.46 * sp})`;
          ctx.lineWidth = 2.0 + (i % 2);
          ctx.beginPath();
          ctx.moveTo(originX + Math.cos(ang) * r0, originY + 42 + Math.sin(ang) * r0);
          ctx.lineTo(originX + Math.cos(ang) * (r0 + len), originY + 42 + Math.sin(ang) * (r0 + len));
          ctx.stroke();
        }
      }
      ctx.restore();
      return;
    }

    const p = Math.max(0, Math.min(1, progress));
    const dx = targetX - originX;
    const dy = targetY - originY;
    const totalLen = Math.max(80, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const sweepSpan = totalLen * 1.48; // Fires cleanly past the enemy into top-left edge like DOS F7-F9!

    // Authentic DOS F7 -> F8 -> F9 timing:
    //  0.00..0.14 : explosive radial fan burst snapping all the way across enemy
    //  0.14..0.52 : peak wide roaring jagged golden fan cone blasting diagonally up-left
    //  0.52..1.00 : core clears rapidly while outer jagged golden needle-streaks shoot free past the target & dissipate!
    const coreEnv =
      p < 0.10
        ? p / 0.10
        : p < 0.40
          ? 1.0 - (p - 0.10) * 0.45
          : Math.max(0, 0.865 * (1 - (p - 0.40) / 0.24));
    const reach = Math.min(1, Math.pow(p / 0.16, 0.72));
    const tailRelease = p < 0.36 ? 0 : Math.min(1, (p - 0.36) / 0.64);
    const fanHalfSpread = 0.46; // ~±26 deg wide triangular dragon-wave fan (matches Kelly F5 artwork + DOS F7!)

    ctx.save();
    ctx.translate(originX, originY + 12);
    ctx.rotate(angle);

    // 1. Soft atmospheric fan-shaped golden glow envelope (kept restrained so jagged amber/gold spears pop cleanly like DOS F7!)
    if (coreEnv > 0.02) {
      const fanReach = sweepSpan * (0.38 + reach * 0.62);
      const flare = ctx.createRadialGradient(-10, 0, 12, 0, 0, fanReach);
      flare.addColorStop(0, `rgba(255, 255, 235, ${0.52 * coreEnv})`);
      flare.addColorStop(0.24, `rgba(${pal.light}, ${0.38 * coreEnv})`);
      flare.addColorStop(0.52, `rgba(${pal.mid}, ${0.26 * coreEnv})`);
      flare.addColorStop(0.82, `rgba(${pal.outer}, ${0.14 * coreEnv})`);
      flare.addColorStop(1, `rgba(${pal.outer}, 0)`);
      ctx.fillStyle = flare;
      ctx.beginPath();
      ctx.moveTo(-20, -thickness * 0.28);
      ctx.lineTo(fanReach, -Math.tan(fanHalfSpread * 1.05) * fanReach - thickness * 0.16);
      ctx.lineTo(fanReach, Math.tan(fanHalfSpread * 0.95) * fanReach + thickness * 0.16);
      ctx.lineTo(-20, thickness * 0.32);
      ctx.closePath();
      ctx.fill();
    }

    // 2. Jagged feathered blade-fan wedges (`DOS F7` solid golden-to-orange splash cones!)
    const rayCount = 26;
    for (let i = 0; i < rayCount; i++) {
      const frac = i / (rayCount - 1) - 0.5; // -0.5 .. +0.5
      // Pseudo-deterministic variance so every ray feels sharp, hand-drawn & explosive!
      const h1 = Math.sin(i * 12.9898 + 4.1) * 43758.5453;
      const rnd1 = h1 - Math.floor(h1);
      const h2 = Math.sin(i * 78.233 + 1.7) * 23421.631;
      const rnd2 = h2 - Math.floor(h2);
      const rayAng = frac * fanHalfSpread * 2.05 + (rnd1 - 0.5) * 0.045;
      const baseLen = sweepSpan * (0.72 + rnd2 * 0.42 - Math.abs(frac) * 0.22);

      // On F7 (coreEnv > 0), crisp blazing white-gold-to-deep-amber flame blades launch straight from origin!
      if (coreEnv > 0.02) {
        const curTip = baseLen * Math.min(1, reach * (0.9 + rnd1 * 0.28));
        const rStart = 4 + rnd1 * 34;
        const wNear = (i % 3 === 0 ? 15 : 8.5) * (0.72 + (1 - Math.abs(frac)) * 0.55);
        const wFar = (i % 2 === 0 ? 6 : 3.5);
        const grad = ctx.createLinearGradient(rStart, 0, curTip, 0);
        grad.addColorStop(0, `rgba(255, 250, 215, ${0.78 * coreEnv})`);
        grad.addColorStop(0.24, `rgba(${pal.bright}, ${0.82 * coreEnv})`);
        grad.addColorStop(0.54, `rgba(${pal.mid}, ${0.86 * coreEnv})`);
        grad.addColorStop(0.84, `rgba(${pal.outer}, ${0.76 * coreEnv})`);
        grad.addColorStop(1, `rgba(${pal.outer}, 0)`);
        ctx.save();
        ctx.rotate(rayAng);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(rStart, -wNear * 0.5);
        ctx.lineTo(curTip, -wFar * 0.18);
        ctx.lineTo(curTip + 24, 0);
        ctx.lineTo(curTip, wFar * 0.18);
        ctx.lineTo(rStart, wNear * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // 3. `DOS F8 -> F9` trailing jagged golden-amber dissipation streaks racing outward past enemy!
      if (p >= 0.26) {
        const sp = Math.min(1, (p - 0.26) / 0.74);
        const travel = sweepSpan * (0.28 + rnd1 * 0.24 + sp * (0.68 + rnd2 * 0.25));
        const needleLen = (155 + rnd2 * 155) * (1 - sp * 0.76);
        const alpha = (1 - Math.pow(sp, 1.35)) * (i % 2 === 0 ? 0.92 : 0.68);
        if (alpha > 0.04 && needleLen > 12) {
          ctx.save();
          ctx.rotate(rayAng);
          const sg = ctx.createLinearGradient(travel - needleLen, 0, travel, 0);
          sg.addColorStop(0, `rgba(${pal.outer}, 0)`);
          sg.addColorStop(0.35, `rgba(${pal.mid}, ${alpha * 0.85})`);
          sg.addColorStop(0.78, `rgba(${pal.bright}, ${alpha})`);
          sg.addColorStop(1, `rgba(255, 255, 255, ${alpha * (1 - tailRelease * 0.6)})`);
          ctx.fillStyle = sg;
          const nw = (3.4 + (i % 3) * 1.9) * (1 - sp * 0.45);
          ctx.beginPath();
          ctx.moveTo(travel - needleLen, 0);
          ctx.lineTo(travel - needleLen * 0.18, -nw);
          ctx.lineTo(travel + 12, 0);
          ctx.lineTo(travel - needleLen * 0.18, nw);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
    }
    ctx.restore();

    // 4. Crisp enemy torso radial impact burst (peaks cleanly as fan front hits at p ~ 0.14..0.52!)
    if (p >= 0.06 && p <= 0.64) {
      const hitFade = p < 0.18 ? (p - 0.06) / 0.12 : Math.max(0, 1 - (p - 0.18) / 0.46);
      const splashR = thickness * (1.25 + (1 - hitFade) * 0.55);
      const ig = ctx.createRadialGradient(targetX, targetY, 4, targetX, targetY, splashR);
      ig.addColorStop(0, `rgba(255, 255, 255, ${0.92 * hitFade})`);
      ig.addColorStop(0.32, `rgba(${pal.light}, ${0.78 * hitFade})`);
      ig.addColorStop(0.65, `rgba(${pal.bright}, ${0.42 * hitFade})`);
      ig.addColorStop(1, `rgba(${pal.outer}, 0)`);
      ctx.fillStyle = ig;
      ctx.beginPath();
      ctx.arc(targetX, targetY, splashR, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawBanditVisorGlint(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const pulse = 0.7 + Math.sin(t * 0.025) * 0.3;
    const grad = ctx.createRadialGradient(x, y, 2, x, y, 42 * pulse);
    grad.addColorStop(0, 'rgba(163, 230, 53, 0.95)');
    grad.addColorStop(0.4, 'rgba(74, 222, 128, 0.5)');
    grad.addColorStop(1, 'rgba(74, 222, 128, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, 42 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(217, 249, 157, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - 48 * pulse, y);
    ctx.lineTo(x + 48 * pulse, y);
    ctx.stroke();
    ctx.restore();
  }

  private drawBladeChargeAura(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number): void {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const r = 30 + progress * 95;
    const grad = ctx.createRadialGradient(x, y, 4, x, y, r);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    grad.addColorStop(0.35, 'rgba(251, 191, 36, 0.65)');
    grad.addColorStop(0.7, 'rgba(56, 189, 248, 0.35)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawVolumetricCrescentSlash(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    progress: number,
    theme: 'thor_golden_azure' | 'bandit_crimson_steel'
  ): void {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    const fade = progress < 0.25 ? progress / 0.25 : Math.max(0, 1 - (progress - 0.25) / 0.75);
    if (fade <= 0.01) {
      ctx.restore();
      return;
    }

    ctx.translate(cx, cy);
    if (theme === 'thor_golden_azure') {
      // Sweeps diagonally from top-right (↗) across to up-left/bottom-left (↖) matching Thor's Pose 1 -> Pose 2 swing!
      ctx.rotate(-0.42);
    } else {
      ctx.scale(-1, 1);
      ctx.rotate(-0.22);
    }

    const startAngle = -Math.PI * 0.62;
    const endAngle = startAngle + Math.PI * 1.18 * Math.min(1, progress * 1.45);

    const drawTaperedCrescent = (
      rOuter: number,
      thickness: number,
      colorStart: string,
      colorMid: string,
      colorEnd: string,
      alpha: number
    ) => {
      ctx.save();
      ctx.globalAlpha = alpha * fade;
      const grad = ctx.createLinearGradient(0, -rOuter, -rOuter, rOuter);
      grad.addColorStop(0, colorStart);
      grad.addColorStop(0.5, colorMid);
      grad.addColorStop(1, colorEnd);
      ctx.fillStyle = grad;

      ctx.beginPath();
      const steps = 36;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const a = startAngle + (endAngle - startAngle) * u;
        const r = rOuter + Math.sin(u * Math.PI) * 14;
        const px = -Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      for (let i = steps; i >= 0; i--) {
        const u = i / steps;
        const a = startAngle + (endAngle - startAngle) * u;
        const taper = Math.sin(u * Math.PI);
        const r = rOuter - thickness * taper;
        const px = -Math.cos(a) * r;
        const py = Math.sin(a) * r;
        ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    if (theme === 'thor_golden_azure') {
      drawTaperedCrescent(radius * 1.06, 118, '#0284c7', '#38bdf8', '#7dd3fc', 0.65);
      drawTaperedCrescent(radius * 0.99, 76, '#ea580c', '#f59e0b', '#fde047', 0.92);
      drawTaperedCrescent(radius * 0.95, 28, '#fef08a', '#ffffff', '#e0f2fe', 1.0);
    } else {
      drawTaperedCrescent(radius * 1.04, 98, '#991b1b', '#ef4444', '#fb923c', 0.68);
      drawTaperedCrescent(radius * 0.98, 58, '#dc2626', '#f97316', '#fde047', 0.88);
      drawTaperedCrescent(radius * 0.94, 22, '#fecaca', '#ffffff', '#fef08a', 0.98);
    }

    const impactX = -radius * 0.78;
    const impactY = radius * 0.12;
    const starGrad = ctx.createRadialGradient(impactX, impactY, 2, impactX, impactY, 130 * fade);
    starGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    starGrad.addColorStop(0.3, 'rgba(253, 224, 71, 0.85)');
    starGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = starGrad;
    ctx.beginPath();
    ctx.arc(impactX, impactY, 130 * fade, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 255, 255, ${fade * 0.95})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(impactX - 180 * fade, impactY);
    ctx.lineTo(impactX + 180 * fade, impactY);
    ctx.moveTo(impactX, impactY - 120 * fade);
    ctx.lineTo(impactX, impactY + 120 * fade);
    ctx.stroke();

    ctx.restore();
  }

  private drawDustAndSparks(ctx: CanvasRenderingContext2D): void {
    for (const d of this.dust) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, d.alpha);
      const grad = ctx.createRadialGradient(d.x, d.y, d.radius * 0.1, d.x, d.y, d.radius);
      grad.addColorStop(0, d.color);
      grad.addColorStop(1, 'rgba(180, 170, 145, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const s of this.sparks) {
      ctx.globalAlpha = s.alpha;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * 0.028, s.y - s.vy * 0.028);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawForegroundLeaves(ctx: CanvasRenderingContext2D, bgId?: number): void {
    if (!this.config.enableParallaxAndGodRays) return;
    const weather = getTerrainPreset(bgId ?? this.vfxAssets.enemyBgId).weather ?? 'leaves';
    for (const leaf of this.leaves) {
      ctx.save();
      ctx.translate(leaf.x, leaf.y);
      ctx.rotate(leaf.rot);
      if (weather === 'snow') {
        ctx.globalAlpha = leaf.depth > 1.15 ? 0.55 : 0.82;
        ctx.fillStyle = '#e0f2fe';
        ctx.beginPath();
        ctx.arc(0, 0, leaf.size * 0.42 * leaf.depth, 0, Math.PI * 2);
        ctx.fill();
      } else if (weather === 'embers') {
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = leaf.depth > 1.15 ? 0.55 : 0.85;
        ctx.fillStyle = leaf.hue > 108 ? '#fde047' : '#f97316';
        ctx.beginPath();
        ctx.arc(0, 0, leaf.size * 0.36 * leaf.depth, 0, Math.PI * 2);
        ctx.fill();
      } else if (weather === 'dust') {
        ctx.globalAlpha = leaf.depth > 1.15 ? 0.22 : 0.36;
        ctx.fillStyle = '#fef3c7';
        ctx.beginPath();
        ctx.arc(0, 0, leaf.size * 0.3 * leaf.depth, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = leaf.depth > 1.15 ? 0.45 : 0.72;
        ctx.fillStyle = `hsl(${leaf.hue}, 58%, ${leaf.depth > 1.15 ? 32 : 44}%)`;
        ctx.beginPath();
        ctx.ellipse(0, 0, leaf.size * leaf.depth, leaf.size * 0.48 * leaf.depth, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawAnimeCutInBanner(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    progress: number,
    unit: 'thor' | 'bandit' = 'thor'
  ): void {
    const open = progress < 0.18 ? progress / 0.18 : progress > 0.82 ? (1 - progress) / 0.18 : 1;
    if (open <= 0.01) return;

    const bannerH = 175 * open;
    const cy = H * 0.34;
    const isBandit = unit === 'bandit';

    ctx.save();
    ctx.translate(W * 0.5, cy);
    // Thor lunges Up-Left (↖, tilt -0.06, avatar facing left ←); Bandit lunges Down-Right (↘, tilt +0.06, avatar facing right →)
    ctx.rotate(isBandit ? 0.06 : -0.06);

    ctx.beginPath();
    ctx.rect(-W * 0.65, -bannerH * 0.5, W * 1.3, bannerH);
    ctx.clip();

    const bgGrad = ctx.createLinearGradient(-W * 0.5, 0, W * 0.5, 0);
    if (isBandit) {
      bgGrad.addColorStop(0, 'rgba(120, 28, 18, 0.94)');
      bgGrad.addColorStop(0.5, 'rgba(68, 18, 24, 0.96)');
      bgGrad.addColorStop(1, 'rgba(10, 28, 22, 0.94)');
    } else {
      bgGrad.addColorStop(0, 'rgba(8, 15, 32, 0.94)');
      bgGrad.addColorStop(0.5, 'rgba(15, 38, 72, 0.96)');
      bgGrad.addColorStop(1, 'rgba(120, 28, 18, 0.94)');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(-W * 0.65, -bannerH * 0.5, W * 1.3, bannerH);

    ctx.strokeStyle = isBandit ? 'rgba(253, 224, 71, 0.32)' : 'rgba(125, 211, 252, 0.32)';
    for (let i = 0; i < 18; i++) {
      const ly = -bannerH * 0.45 + (i / 17) * bannerH * 0.9;
      const offset = (this.elapsedMs * 3.5 + i * 190) % (W * 0.8);
      const lx = isBandit ? -W * 0.6 + offset : W * 0.34 - offset;
      ctx.lineWidth = 1.5 + (i % 3);
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + 260, ly);
      ctx.stroke();
    }

    const customCutIn = isBandit ? this.vfxAssets.leftCutIn : this.vfxAssets.rightCutIn;

    if (customCutIn && customCutIn.complete && customCutIn.naturalWidth > 0) {
      const slideX = isBandit ? (progress - 0.5) * 70 : (0.5 - progress) * 70;
      ctx.drawImage(
        customCutIn,
        0,
        0,
        customCutIn.naturalWidth,
        customCutIn.naturalHeight,
        -250 + slideX,
        -bannerH * 0.52,
        500,
        bannerH * 1.06
      );
    }

    ctx.shadowBlur = 0;
    ctx.strokeStyle = isBandit ? '#f87171' : '#fde047';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-W * 0.65, -bannerH * 0.5 + 2);
    ctx.lineTo(W * 0.65, -bannerH * 0.5 + 2);
    ctx.moveTo(-W * 0.65, bannerH * 0.5 - 2);
    ctx.lineTo(W * 0.65, bannerH * 0.5 - 2);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draws the authentic Flame Dragon II diagonal HUD placement:
   *  - Enemy Unit (Top-Left stage): Bottom-Left `(38, H - 124)`
   *  - Hero/Ally Unit (Bottom-Right stage): Top-Right `(W - 38 - cardW, 24)`
   * Both HP and MP bars anchor on the LEFT (`0` at left, `max` at right) and reduce from RIGHT (Green) -> Middle (Yellow) -> LEFT (Red)!
   */
  private drawModernDualHud(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const isEn = getLocale() === 'en';
    const cardW = 450;
    const cardH = 96;

    const drawHudCard = (
      x: number,
      y: number,
      name: string,
      lv: number,
      dispHp: number,
      targetHp: number,
      maxHp: number,
      mp: number,
      maxMp: number,
      accentColor: string
    ) => {
      ctx.save();
      ctx.fillStyle = 'rgba(10, 14, 24, 0.88)';
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 20px "Cinzel", "Noto Serif TC", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${name}   Lv.${lv}`, x + 20, y + 27);

      const shownHpInt = Math.ceil(dispHp);
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`HP ${shownHpInt}/${maxHp}   MP ${mp}/${maxMp}`, x + cardW - 20, y + 27);

      const barX = x + 64;
      const barW = cardW - 84;

      // 1. HP Bar: Anchored on the LEFT (0% = Red left end, 50% = Yellow middle, 100% = Green right end).
      // As HP decreases, the fill width shrinks from the RIGHT (Green) toward the LEFT (Red)!
      const hpBarY = y + 40;
      const hpBarH = 15;
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('HP', x + 20, hpBarY + 12);

      // Empty trough
      ctx.fillStyle = 'rgba(42, 16, 22, 0.95)';
      ctx.fillRect(barX, hpBarY, barW, hpBarH);

      const dispRatio = Math.max(0, Math.min(1, dispHp / Math.max(1, maxHp)));
      const targRatio = Math.max(0, Math.min(1, targetHp / Math.max(1, maxHp)));
      const dispFillW = barW * dispRatio;
      const targFillW = barW * targRatio;

      // Fixed full-width gradient from Left (0% Red) -> Middle (50% Yellow) -> Right (100% Green)
      const hpGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      hpGrad.addColorStop(0, '#ef4444');
      hpGrad.addColorStop(0.45, '#f59e0b');
      hpGrad.addColorStop(1, '#22c55e');

      if (dispFillW > 0) {
        ctx.fillStyle = hpGrad;
        ctx.fillRect(barX, hpBarY, dispFillW, hpBarH);
      }

      // Highlight ONLY the actively draining segment [targFillW .. dispFillW] with a subtle white flash overlay
      if (dispFillW > targFillW + 0.5) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.fillRect(barX + targFillW, hpBarY, dispFillW - targFillW, hpBarH);
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, hpBarY, barW, hpBarH);

      // 2. MP Bar (also left-anchored, reducing from right to left)
      const mpBarY = y + 64;
      const mpBarH = 12;
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('MP', x + 20, mpBarY + 11);

      ctx.fillStyle = 'rgba(18, 28, 46, 0.95)';
      ctx.fillRect(barX, mpBarY, barW, mpBarH);

      const mpRatio = maxMp > 0 ? Math.max(0, Math.min(1, mp / maxMp)) : 0;
      const mpFillW = barW * mpRatio;
      if (mpFillW > 0) {
        const mpGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        mpGrad.addColorStop(0, '#1d4ed8');
        mpGrad.addColorStop(0.5, '#0284c7');
        mpGrad.addColorStop(1, '#38bdf8');
        ctx.fillStyle = mpGrad;
        ctx.fillRect(barX, mpBarY, mpFillW, mpBarH);
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, mpBarY, barW, mpBarH);

      ctx.restore();
    };

    const lu = this.vfxAssets.leftUnit;
    const ru = this.vfxAssets.rightUnit;
    const leftLabel = isEn ? `${lu.nameEn} (#${lu.uid})` : `${lu.nameZh} (#${lu.uid})`;
    const rightLabel = isEn ? `${ru.nameEn} (#${ru.uid})` : `${ru.nameZh} (#${ru.uid})`;

    // Bottom-Left: Enemy Unit (matching FD2.EXE `(0, 154)`)
    drawHudCard(
      38,
      H - 122,
      leftLabel,
      1,
      this.banditDisplayedHp,
      this.banditTargetHp,
      this.banditMaxHp,
      this.banditMp,
      this.banditMaxMp,
      '#ef4444'
    );

    // Top-Right: Hero/Ally Unit (matching FD2.EXE `(171, 4)`)
    drawHudCard(
      W - 38 - cardW,
      24,
      rightLabel,
      1,
      this.thorDisplayedHp,
      this.thorTargetHp,
      this.thorMaxHp,
      this.thorMp,
      this.thorMaxMp,
      '#38bdf8'
    );

    // Top-Left: Active Stage, Terrain & Combat Mode Indicator Badge
    ctx.save();
    ctx.fillStyle = 'rgba(10, 14, 24, 0.88)';
    ctx.strokeStyle =
      this.scenario === 'hero_magic'
        ? '#c084fc'
        : this.vfxAssets.rightUnit.isRemote
          ? '#fbbf24'
          : '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.font = 'bold 14px monospace';
    const fallbackLabel =
      this.config.animSource === 'omni_video'
        ? isEn
          ? '🎬 Pipeline: Full Action Sequence (10–14F)'
          : '🎬 當前管線：完整去背連段序列 (10–14 幀)'
        : this.config.animSource === 'nb2_6frame'
          ? isEn
            ? '🖼️ Pipeline: 6-Frame Keyframes'
            : '🖼️ 當前管線：6 幀關鍵序列'
          : isEn
            ? '🎨 Pipeline: 3-Pose Baseline'
            : '🎨 當前管線：3 幀基準組';
    const badgeText = this.activeStageBadge || fallbackLabel;
    const badgeW = Math.max(460, Math.min(820, ctx.measureText(badgeText).width + 36));
    ctx.beginPath();
    ctx.roundRect(38, 24, badgeW, 38, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    ctx.fillText(badgeText, 54, 48);
    ctx.restore();
  }
}

let activeLabCleanup: (() => void) | null = null;

export interface VfxLabMountOptions {
  initialRightUid?: number;
  initialLeftUid?: number;
  initialInspectUid?: number;
  initialSpellId?: number;
  onMatchupChange?: (rightUid: number, leftUid: number, inspectUid: number) => void;
}

/**
 * Mounts the interactive "Modern 2.5D VFX Lab" directly inside a Gallery tab container,
 * supporting one-by-one inspection and dynamic matchup selection across all 121 generated
 * player/ally (`↖`) and enemy/boss (`↘`) combat units.
 */
export async function mountVfxLabInGallery(
  container: HTMLElement,
  assets: AssetManager,
  sound: SoundEngine,
  opts?: VfxLabMountOptions
): Promise<void> {
  if (activeLabCleanup) {
    activeLabCleanup();
    activeLabCleanup = null;
  }

  container.innerHTML = `
    <div style="padding: 28px; text-align: center; color: var(--ink-300); font-family: var(--font-mono);">
      Loading 2026 Modern 2.5D Anime VFX Keyframes & Shaders (121 / 121 Units)...
    </div>
  `;

  const vfxAssets = await ensureVfxLabAssets(assets);
  const allUnits = [...vfxAssets.manifestUnits].sort((a, b) => a.uid - b.uid);
  const playerUnits = allUnits.filter((u) => u.side === 'player');
  const enemyUnits = allUnits.filter((u) => u.side === 'enemy');
  if (playerUnits.length === 0) playerUnits.push(DEFAULT_RIGHT_UNIT);
  if (enemyUnits.length === 0) enemyUnits.push(DEFAULT_LEFT_UNIT);

  // Apply initial requested right/left/inspect units if provided
  if (opts?.initialRightUid !== undefined) {
    const reqR = playerUnits.find((u) => u.uid === opts.initialRightUid);
    if (reqR && reqR.uid !== vfxAssets.rightUnit.uid) {
      await loadUnitSlotIntoVfxAssets(assets, vfxAssets, 'player', reqR);
    }
  }
  if (opts?.initialLeftUid !== undefined) {
    const reqL = enemyUnits.find((u) => u.uid === opts.initialLeftUid);
    if (reqL && reqL.uid !== vfxAssets.leftUnit.uid) {
      await loadUnitSlotIntoVfxAssets(assets, vfxAssets, 'enemy', reqL);
    }
  }

  let focusedUnit: VfxManifestUnitEntry = vfxAssets.rightUnit;
  if (opts?.initialInspectUid !== undefined) {
    const found = allUnits.find((u) => u.uid === opts.initialInspectUid);
    if (found) {
      focusedUnit = found;
      if (found.side === 'player' && found.uid !== vfxAssets.rightUnit.uid) {
        await loadUnitSlotIntoVfxAssets(assets, vfxAssets, 'player', found);
      } else if (found.side === 'enemy' && found.uid !== vfxAssets.leftUnit.uid) {
        await loadUnitSlotIntoVfxAssets(assets, vfxAssets, 'enemy', found);
      }
    }
  }

  const renderer = new Modern25DCombatRenderer(vfxAssets, sound);
  const isEn = getLocale() === 'en';

  const formatUnitOption = (u: VfxManifestUnitEntry) =>
    isEn
      ? `#${String(u.uid).padStart(3, '0')} ${u.nameEn} (${u.classEn})`
      : `#${String(u.uid).padStart(3, '0')} ${u.nameZh} (${u.classNameZh})`;

  type RosterCat = 'all' | 'hero' | 'promo' | 'ally' | 'enemy';
  let activeRosterCat: RosterCat = 'all';
  let rosterSearchQuery = '';

  const getFilteredRoster = (): VfxManifestUnitEntry[] => {
    const q = rosterSearchQuery.trim().toLowerCase();
    return allUnits.filter((u) => {
      if (activeRosterCat === 'hero' && u.role !== 'hero') return false;
      if (activeRosterCat === 'promo' && u.role !== 'hero_promo_t2' && u.role !== 'hero_promo_t3') return false;
      if (activeRosterCat === 'ally' && u.role !== 'ally_npc') return false;
      if (activeRosterCat === 'enemy' && u.side !== 'enemy') return false;
      if (!q) return true;
      return (
        String(u.uid).includes(q) ||
        u.nameZh.toLowerCase().includes(q) ||
        u.nameEn.toLowerCase().includes(q) ||
        u.classNameZh.toLowerCase().includes(q) ||
        u.classEn.toLowerCase().includes(q)
      );
    });
  };

  container.innerHTML = `
    <div style="max-width: 1480px; margin: 0 auto; padding: 12px 16px 32px; display: flex; flex-direction: column; gap: 14px;">
      <!-- TOP HEADER & VIEW MODE TABS -->
      <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; background: var(--bg-panel, #0f172a); border: 1px solid var(--border-subtle, #334155); border-radius: 12px;">
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
          <span id="vfx-title-banner" style="font-size: 18px; font-weight: 800; color: #38bdf8;">
            ⚡ ${tr(
              `2026 現代 2.5D 戰鬥動畫全角色檢視 — ${vfxAssets.rightUnit.nameZh} (#${vfxAssets.rightUnit.uid} 右下↖) vs ${vfxAssets.leftUnit.nameZh} (#${vfxAssets.leftUnit.uid} 左上↘)`,
              `2026 现代 2.5D 战斗动画全角色检视 — ${vfxAssets.rightUnit.nameZh} (#${vfxAssets.rightUnit.uid} 右下↖) vs ${vfxAssets.leftUnit.nameZh} (#${vfxAssets.leftUnit.uid} 左上↘)`,
              `2026 Modern 2.5D All-121 Inspector — ${vfxAssets.rightUnit.nameEn} (#${vfxAssets.rightUnit.uid} ↖) vs. ${vfxAssets.leftUnit.nameEn} (#${vfxAssets.leftUnit.uid} ↘)`
            )}
          </span>
          <span style="font-size: 12px; padding: 3px 10px; border-radius: 999px; background: rgba(34, 197, 94, 0.14); color: #86efac; border: 1px solid rgba(34, 197, 94, 0.35);">
            ✅ ${tr(
              `已精修重製角色：${allUnits.length} / 121 (WebP 高速載入)`,
              `已精修重制角色：${allUnits.length} / 121 (WebP 高速加载)`,
              `Refactored HD Units: ${allUnits.length} / 121 (Fast WebP)`
            )}
          </span>
        </div>

        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <button class="gal-btn active" id="vfx-tab-stage" type="button">🎬 ${tr('2.5D 現代演武舞台', '2.5D 现代演武舞台', 'Live 2.5D Combat Stage')}</button>
          <button class="gal-btn" id="vfx-tab-split" type="button">🔀 ${tr('1995 原版 vs 2026 分割畫面對照', '1995 原版 vs 2026 分割画面对照', '1995 DOS vs 2026 Split-Screen')}</button>
          <button class="gal-btn" id="vfx-tab-art" type="button">🎨 ${tr('雙人對戰關鍵幀原稿與特寫', '双人对战关键帧原稿与特写', 'Matchup Sheets & Cut-Ins')}</button>
        </div>
      </div>

      <!-- MASTER ONE-BY-ONE STEPPER BAR -->
      <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 18px; background: linear-gradient(90deg, rgba(30, 41, 59, 0.96), rgba(15, 23, 42, 0.96)); border: 1.5px solid #eab308; border-radius: 10px; box-shadow: 0 6px 20px rgba(0,0,0,0.35);">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span style="font-size: 13.5px; font-weight: 800; color: #fde047;">
            🔍 ${tr(`逐一檢視已精修角色 (${allUnits.length})：`, `逐一检视已精修角色 (${allUnits.length})：`, `Inspect Refactored Units (${allUnits.length}):`)}
          </span>
          <button class="gal-btn gold" id="vfx-btn-master-prev" type="button" title="Shortcut: [">
            ◀ ${tr('上一位 (Prev)', '上一位 (Prev)', 'Prev Unit')}
          </button>
          <select id="vfx-sel-master-unit" style="background: #090d16; color: #fde047; border: 1.5px solid #eab308; border-radius: 6px; padding: 5px 12px; font-size: 13.5px; font-weight: 700; min-width: 250px;">
            ${allUnits
              .map(
                (u, idx) =>
                  `<option value="${u.uid}" ${u.uid === focusedUnit.uid ? 'selected' : ''}>[${idx + 1}/${allUnits.length}] ${formatUnitOption(u)} ${u.side === 'player' ? '↖' : '↘'}</option>`
              )
              .join('')}
          </select>
          <button class="gal-btn gold" id="vfx-btn-master-next" type="button" title="Shortcut: ]">
            ${tr('下一位 (Next)', '下一位 (Next)', 'Next Unit')} ▶
          </button>
          <span id="vfx-master-counter" class="mono-tag" style="padding: 4px 10px; border-radius: 6px; background: rgba(234, 179, 8, 0.16); color: #fde047; border: 1px solid rgba(234, 179, 8, 0.4); font-weight: 700;">
            1 / ${allUnits.length}
          </span>
        </div>

        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <span class="mono-tag" style="color: #94a3b8; font-size: 11.5px;">
            💡 ${tr('切換角色時自動播放「會心一擊特寫 + 完整攻擊動畫」並同步下方逐幀面板 (快捷鍵 [ / ])', '切换角色时自动播放「会心一击特写 + 完整攻击动画」并同步下方逐帧面板 (快捷键 [ / ])', 'Stepping auto-plays Critical Cut-In + Attack and updates the frame strip below (Keys: [ / ])')}
          </span>
        </div>
      </div>

      <!-- DUAL MATCHUP SELECTOR (WITH INDEPENDENT PREV/NEXT STEPPERS) + PIPELINE SWITCHER -->
      <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 18px; background: rgba(15, 23, 42, 0.92); border: 1px solid rgba(56, 189, 248, 0.38); border-radius: 10px;">
        <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
          <div style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #38bdf8;">
            <span>🛡️ ${tr(`我方/友軍 (${playerUnits.length}位 右下↖)：`, `我方/友军 (${playerUnits.length}位 右下↖)：`, `Hero/Ally (${playerUnits.length} ↖):`)}</span>
            <button class="gal-btn sm" id="vfx-btn-right-prev" type="button" title="Previous Hero/Ally">◀</button>
            <select id="vfx-sel-right-unit" style="background: #0f172a; color: #f8fafc; border: 1px solid #38bdf8; border-radius: 6px; padding: 4px 10px; font-size: 13px; font-weight: 600;">
              ${playerUnits
                .map(
                  (u) =>
                    `<option value="${u.uid}" ${u.uid === vfxAssets.rightUnit.uid ? 'selected' : ''}>${formatUnitOption(u)}</option>`
                )
                .join('')}
            </select>
            <button class="gal-btn sm" id="vfx-btn-right-next" type="button" title="Next Hero/Ally">▶</button>
          </div>
          <div style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #f87171;">
            <span>⚔️ ${tr(`敵軍/頭目 (${enemyUnits.length}位 左上↘)：`, `敌军/头目 (${enemyUnits.length}位 左上↘)：`, `Enemy/Boss (${enemyUnits.length} ↘):`)}</span>
            <button class="gal-btn sm" id="vfx-btn-left-prev" type="button" title="Previous Enemy/Boss">◀</button>
            <select id="vfx-sel-left-unit" style="background: #0f172a; color: #f8fafc; border: 1px solid #f87171; border-radius: 6px; padding: 4px 10px; font-size: 13px; font-weight: 600;">
              ${enemyUnits
                .map(
                  (u) =>
                    `<option value="${u.uid}" ${u.uid === vfxAssets.leftUnit.uid ? 'selected' : ''}>${formatUnitOption(u)}</option>`
                )
                .join('')}
            </select>
            <button class="gal-btn sm" id="vfx-btn-left-next" type="button" title="Next Enemy/Boss">▶</button>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span style="font-size: 13px; font-weight: 700; color: #fde047;">
            🔬 ${tr('管線：', '管线：', 'Pipeline:')}
          </span>
          <button class="gal-btn active" id="vfx-src-omni" type="button">
            🎬 ${tr('完整連段序列 (10–14 幀)', '完整连段序列 (10–14 帧)', 'Full Action Sequence (10–14F)')}
          </button>
          <button class="gal-btn" id="vfx-src-nb6" type="button">
            🖼️ ${tr('關鍵幀 (6 幀)', '关键帧 (6 帧)', 'Keyframes (6F)')}
          </button>
          <button class="gal-btn" id="vfx-src-nb3" type="button">
            🎨 ${tr('基準組 (3 幀)', '基准组 (3 帧)', 'Baseline (3F)')}
          </button>
        </div>
      </div>

      <!-- INDEPENDENT TERRAIN SELECTORS (UNIFIED ENEMY BG IN MELEE / SEPARATE SCREENS IN RANGED & MAGIC) -->
      <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 18px; background: rgba(12, 20, 34, 0.92); border: 1px solid rgba(34, 197, 94, 0.35); border-radius: 10px;">
        <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
          <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 700; color: #86efac;">
            <span>🗺️ ${tr('我方地形 (遠程/法術 攻方獨屏)：', '我方地形 (远程/法术 攻方独屏)：', 'Hero Tile (Ranged/Magic Stage 1):')}</span>
            <select id="vfx-sel-hero-bg" style="background: #090d16; color: #f8fafc; border: 1px solid #22c55e; border-radius: 6px; padding: 4px 8px; font-size: 12.5px; font-weight: 600;">
              ${HD_TERRAIN_PRESETS.map(
                (tp) =>
                  `<option value="${tp.id}" ${tp.id === vfxAssets.heroBgId ? 'selected' : ''}>#${String(tp.id).padStart(2, '0')} ${isEn ? tp.en : tp.zh}</option>`
              ).join('')}
            </select>
          </label>
          <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 700; color: #fca5a5;">
            <span>🏞️ ${tr('敵方地形 (近戰統一背景 / 遠程受擊背景)：', '敌方地形 (近战统一背景 / 远程受击背景)：', 'Enemy Tile (Unified Melee BG / Remote Target):')}</span>
            <select id="vfx-sel-enemy-bg" style="background: #090d16; color: #f8fafc; border: 1px solid #f87171; border-radius: 6px; padding: 4px 8px; font-size: 12.5px; font-weight: 600;">
              ${HD_TERRAIN_PRESETS.map(
                (tp) =>
                  `<option value="${tp.id}" ${tp.id === vfxAssets.enemyBgId ? 'selected' : ''}>#${String(tp.id).padStart(2, '0')} ${isEn ? tp.en : tp.zh}</option>`
              ).join('')}
            </select>
          </label>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <button class="gal-btn sm" data-terrain-preset="4,4" type="button">🌲 ${tr('林地 (Forest)', '林地 (Forest)', 'Forest')}</button>
          <button class="gal-btn sm" data-terrain-preset="4,45" type="button">🌲→🏰 ${tr('遠程異地 (林地→石橋)', '远程异地 (林地→石桥)', 'Remote (Forest→Bridge)')}</button>
          <button class="gal-btn sm" data-terrain-preset="40,21" type="button">❄️→🏰 ${tr('遠程異地 (雪原→城牆)', '远程异地 (雪原→城墙)', 'Remote (Snow→Wall)')}</button>
          <button class="gal-btn sm" data-terrain-preset="28,33" type="button">🌋→🏛️ ${tr('遠程異地 (熔岩→神殿)', '远程异地 (熔岩→神殿)', 'Remote (Lava→Temple)')}</button>
        </div>
      </div>

      <!-- LIVE 2.5D COMBAT STAGE CANVAS -->
      <div id="vfx-stage-container" style="position: relative; width: 100%; aspect-ratio: 16 / 9; max-height: 68vh; background: #05080f; border: 1px solid var(--border-subtle, #334155); border-radius: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: 0 18px 48px rgba(0,0,0,0.6);">
        <canvas id="vfx-lab-canvas" width="1600" height="900" style="width: 100%; height: 100%; object-fit: contain;"></canvas>
      </div>

      <!-- DUAL MATCHUP SHEETS & CUT-INS VIEW (LAZY-LOADED ONLY WHEN OPENED) -->
      <div id="vfx-art-container" style="display: none; padding: 20px; background: var(--bg-panel, #090d16); border: 1px solid var(--border-subtle, #334155); border-radius: 12px;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 18px;">
          <div style="background: #1e293b; padding: 14px; border-radius: 10px; border: 1px solid #38bdf8;">
            <h4 id="vfx-art-title-a1" style="margin: 0 0 8px 0; color: #38bdf8;">🖼️ #${vfxAssets.rightUnit.uid} ${vfxAssets.rightUnit.nameZh} 6-Frame Sheet</h4>
            <img id="vfx-art-img-a1" loading="lazy" style="width: 100%; border-radius: 8px; background: #fff;" />
          </div>
          <div style="background: #1e293b; padding: 14px; border-radius: 10px; border: 1px solid #f87171;">
            <h4 id="vfx-art-title-a2" style="margin: 0 0 8px 0; color: #f87171;">🖼️ #${vfxAssets.leftUnit.uid} ${vfxAssets.leftUnit.nameZh} 6-Frame Sheet</h4>
            <img id="vfx-art-img-a2" loading="lazy" style="width: 100%; border-radius: 8px; background: #fff;" />
          </div>
          <div style="background: #1e293b; padding: 14px; border-radius: 10px; border: 1px solid #38bdf8;">
            <h4 id="vfx-art-title-c1" style="margin: 0 0 8px 0; color: #7dd3fc;">🔥 Crit Cut-In (←): #${vfxAssets.rightUnit.uid} ${vfxAssets.rightUnit.nameZh}</h4>
            <img id="vfx-art-img-c1" loading="lazy" style="width: 100%; border-radius: 8px; background: #0f172a;" />
          </div>
          <div style="background: #1e293b; padding: 14px; border-radius: 10px; border: 1px solid #f87171;">
            <h4 id="vfx-art-title-c2" style="margin: 0 0 8px 0; color: #fca5a5;">💥 Crit Cut-In (→): #${vfxAssets.leftUnit.uid} ${vfxAssets.leftUnit.nameZh}</h4>
            <img id="vfx-art-img-c2" loading="lazy" style="width: 100%; border-radius: 8px; background: #0f172a;" />
          </div>
        </div>
      </div>

      <!-- PLAYBACK SCENARIO & SHADER TOGGLES BAR -->
      <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; background: var(--bg-panel, #0f172a); border: 1px solid var(--border-subtle, #334155); border-radius: 12px;">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <button class="gal-btn active" id="vfx-play-thor-first" type="button">
            ⚔️ ${tr('我方先攻 + 敵方反擊 (右下↖ → 左上↘)', '我方先攻 + 敌方反击 (右下↖ → 左上↘)', 'Hero Initiates (↖) + Enemy Retaliates (↘)')}
          </button>
          <button class="gal-btn" id="vfx-play-bandit-first" type="button">
            🛡️ ${tr('敵方先攻 + 我方反擊 (左上↘ → 右下↖)', '敌方先攻 + 我方反击 (左上↘ → 右下↖)', 'Enemy Initiates (↘) + Hero Retaliates (↖)')}
          </button>
          <button class="gal-btn" id="vfx-play-crit" type="button">
            🔥 ${tr('我方會心一擊 (頭像向左←)', '我方会心一击 (头像向左←)', 'Hero Crit (Cut-In ←)')}
          </button>
          <button class="gal-btn" id="vfx-play-magic" type="button" style="border-color: rgba(192, 132, 252, 0.7);">
            ✨ ${tr('我方遠程法術 (2段切屏施法)', '我方远程法术 (2段切屏施法)', 'Hero Magic Cast (2-Stage Remote)')}
          </button>
          <select id="vfx-sel-spell" title="Phase B: Select FDOTHER.DAT HD Spell / Summon VFX" style="background: #140c24; color: #e9d5ff; border: 1px solid rgba(192, 132, 252, 0.75); border-radius: 6px; padding: 5px 10px; font-size: 12.5px; font-weight: 700;">
            <option value="auto">🔮 ${tr('法術/召喚：自動預設', '法术/召唤：自动预设', 'Spell FX: Auto (Unit Signature)')}</option>
            ${HD_SPELL_CATALOG.map(
              (sp) =>
                `<option value="${sp.id}">${sp.isSummon ? '🌟' : sp.category === 'fire' ? '🔥' : sp.category === 'thunder' ? '⚡' : sp.category === 'holy' ? '☀️' : '💀'} #${String(sp.id).padStart(2, '0')} ${isEn ? sp.nameEn : sp.nameZh}</option>`
            ).join('')}
          </select>
          <button class="gal-btn" id="vfx-play-skill" type="button" style="display:none; border-color: rgba(56, 189, 248, 0.85); color: #7dd3fc;">
            🌀 ${tr('專屬劍技 / 詠唱動畫', '专属剑技 / 咏唱动画', 'Signature Skill / Chant')}
          </button>
          <button class="gal-btn" id="vfx-play-bandit-crit" type="button">
            💥 ${tr('敵方會心一擊 (頭像向右→)', '敌方会心一击 (头像向右→)', 'Enemy Crit (Cut-In →)')}
          </button>
          <label style="display: inline-flex; align-items: center; gap: 6px; margin-left: 8px; font-size: 13px; color: #fde047; cursor: pointer;">
            <input type="checkbox" id="vfx-chk-slowmo" /> 🐢 ${tr('0.32x 慢動作檢視', '0.32x 慢动作检视', '0.32x Slow-Mo')}
          </label>
        </div>

        <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap; font-size: 12.5px; color: #cbd5e1;">
          <label style="display: inline-flex; align-items: center; gap: 5px; cursor: pointer;">
            <input type="checkbox" id="vfx-chk-parallax" checked /> ${tr('林間光束與景深落葉', '林间光束与景深落叶', 'Sunbeams & Parallax')}
          </label>
          <label style="display: inline-flex; align-items: center; gap: 5px; cursor: pointer;">
            <input type="checkbox" id="vfx-chk-cutin" checked /> ${tr('會心一擊頭像特寫切入', '会心一击头像特写切入', 'Crit Avatar Cut-In')}
          </label>
          <label style="display: inline-flex; align-items: center; gap: 5px; cursor: pointer;">
            <input type="checkbox" id="vfx-chk-slash" checked /> ${tr('體積烈焰刀光特效', '体积烈焰刀光特效', 'Volumetric Crescent Shader')}
          </label>
          <label style="display: inline-flex; align-items: center; gap: 5px; cursor: pointer;">
            <input type="checkbox" id="vfx-chk-sparks" checked /> ${tr('90ms 頓幀與物理火花', '90ms 顿帧与物理火花', '90ms Hit-Stop & Sparks')}
          </label>
          <label style="display: inline-flex; align-items: center; gap: 5px; cursor: pointer;">
            <input type="checkbox" id="vfx-chk-spring" checked /> ${tr('高速殘影與補間律動', '高速残影与补间律动', 'Dash Afterimages & Blend')}
          </label>
        </div>
      </div>

      <!-- SINGLE-UNIT COMPLETE FRAME-BY-FRAME & ASSET INSPECTOR (10F + 6F + VIDEO + CUT-IN + DOS REF) -->
      <div id="vfx-single-inspector" style="padding: 18px; background: var(--bg-panel, #0f172a); border: 1.5px solid rgba(56, 189, 248, 0.45); border-radius: 12px; display: flex; flex-direction: column; gap: 14px;">
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; border-bottom: 1px solid #334155; padding-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <span id="vfx-focus-title" style="font-size: 16px; font-weight: 800; color: #fde047;"></span>
            <span id="vfx-focus-badges" class="mono-tag" style="color: #86efac;"></span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <button class="gal-btn sm" id="vfx-btn-focus-right" type="button">🛡️ ${tr('檢視當前右側我方角色', '检视当前右侧我方角色', 'Inspect Active Right Hero')}</button>
            <button class="gal-btn sm" id="vfx-btn-focus-left" type="button">⚔️ ${tr('檢視當前左側敵方角色', '检视当前左侧敌方角色', 'Inspect Active Left Enemy')}</button>
          </div>
        </div>

        <!-- 3-Card Primary Deliverables Row: Cut-In + 6F Sheet + 1995 DOS Reference (No Heavy MP4!) -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px;">
          <div style="background: #090d16; padding: 12px; border-radius: 10px; border: 1px solid #334155;">
            <div style="font-size: 12.5px; font-weight: 700; color: #fde047; margin-bottom: 6px;">
              💥 ${tr('會心一擊專屬頭像橫幅 (cutin.jpg · 無文字)', '会心一击专属头像横幅 (cutin.jpg · 无文字)', 'Critical-Only Avatar Cut-In Strip (cutin.jpg)')}
            </div>
            <img id="vfx-focus-cutin" src="" loading="lazy" style="width: 100%; aspect-ratio: 2 / 1; object-fit: cover; border-radius: 6px; border: 1px solid #475569; background: #05080f;" />
          </div>
          <div style="background: #090d16; padding: 12px; border-radius: 10px; border: 1px solid #334155;">
            <div style="font-size: 12.5px; font-weight: 700; color: #a855f7; margin-bottom: 6px;">
              🖼️ ${tr('精修重製六幀分解原稿 (nb6_sheet.jpg)', '精修重制六帧分解原稿 (nb6_sheet.jpg)', 'Refactored HD 6-Frame Sheet (nb6_sheet.jpg)')}
            </div>
            <img id="vfx-focus-nb6sheet" src="" loading="lazy" style="width: 100%; aspect-ratio: 16 / 9; object-fit: contain; border-radius: 6px; background: #ffffff;" />
          </div>
          <div style="background: #090d16; padding: 12px; border-radius: 10px; border: 1px solid #334155;">
            <div style="font-size: 12.5px; font-weight: 700; color: #94a3b8; margin-bottom: 6px;">
              🕹️ ${tr('1995 DOS 原版 FIGHT.DAT 六幀基準圖 (dos_ref.jpg)', '1995 DOS 原版 FIGHT.DAT 六帧基准图 (dos_ref.jpg)', '1995 DOS Original 6-Frame Reference (dos_ref.jpg)')}
            </div>
            <img id="vfx-focus-dosref" src="" loading="lazy" style="width: 100%; aspect-ratio: 16 / 9; object-fit: contain; border-radius: 6px; background: #0f172a;" />
          </div>
        </div>

        <!-- Dynamic Full Sequence Strip (omni_0..N-1.webp) -->
        <div style="background: #090d16; padding: 12px; border-radius: 10px; border: 1px solid #334155;">
          <div id="vfx-focus-omni-title" style="font-size: 12.5px; font-weight: 700; color: #fde047; margin-bottom: 8px;">
            🎞️ ${tr('完整去背連段序列逐幀檢視 (omni_*.webp)', '完整去背连段序列逐帧检视 (omni_*.webp)', 'Alpha-Matted Full Action Sequence (omni_*.webp)')}
          </div>
          <div id="vfx-focus-omni-strip" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 8px; overflow-x: auto;"></div>
        </div>

        <!-- 6-Frame Alpha-Matted Keyframe Strip (nb6_0..5.webp) -->
        <div style="background: #090d16; padding: 12px; border-radius: 10px; border: 1px solid #334155;">
          <div style="font-size: 12.5px; font-weight: 700; color: #38bdf8; margin-bottom: 8px;">
            🧩 ${tr('去背 6 幀關鍵序列逐幀檢視 (nb6_0..5.webp)', '去背 6 帧关键序列逐帧检视 (nb6_0..5.webp)', 'Alpha-Matted 6-Frame Keyframes (nb6_0..5.webp)')}
          </div>
          <div id="vfx-focus-nb6-strip" style="display: grid; grid-template-columns: repeat(6, minmax(120px, 1fr)); gap: 8px; overflow-x: auto;"></div>
        </div>

        <!-- Secondary Skill / Spell-Chanting Strip (ranged_0..5.webp — shown only for units with FIGANI.DAT secondary ranged strip!) -->
        <div id="vfx-focus-ranged-panel" style="display: none; background: #09111e; padding: 14px; border-radius: 10px; border: 1.5px solid rgba(56, 189, 248, 0.55); flex-direction: column; gap: 10px;">
          <div id="vfx-focus-ranged-title" style="font-size: 13px; font-weight: 800; color: #7dd3fc;"></div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px;">
            <div>
              <div class="mono-tag" style="font-size: 11px; color: #7dd3fc; margin-bottom: 4px;">🌀 HD Skill / Chant Sheet (ranged_sheet.jpg)</div>
              <img id="vfx-focus-ranged-sheet" loading="lazy" style="width: 100%; aspect-ratio: 16 / 9; object-fit: contain; border-radius: 6px; background: #ffffff;" />
            </div>
            <div>
              <div class="mono-tag" style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">🕹️ 1995 DOS FIGANI.DAT Ranged Blueprint (dos_ranged_ref.jpg)</div>
              <img id="vfx-focus-ranged-dos" loading="lazy" style="width: 100%; aspect-ratio: 16 / 9; object-fit: contain; border-radius: 6px; background: #ffffff;" />
            </div>
          </div>
          <div id="vfx-focus-ranged-strip" style="display: grid; grid-template-columns: repeat(6, minmax(120px, 1fr)); gap: 8px; overflow-x: auto;"></div>
        </div>

        <!-- Dedicated Spell-Chanting Strip (chant_0..5.webp + chant_sheet.jpg) -->
        <div id="vfx-focus-chant-panel" style="display: none; background: #120b1f; padding: 14px; border-radius: 10px; border: 1.5px solid rgba(192, 132, 252, 0.55); flex-direction: column; gap: 10px;">
          <div id="vfx-focus-chant-title" style="font-size: 13px; font-weight: 800; color: #e9d5ff;"></div>
          <div>
            <div class="mono-tag" style="font-size: 11px; color: #d8b4fe; margin-bottom: 4px;">✨ HD Dedicated Spell-Chant Sheet (chant_sheet.jpg)</div>
            <img id="vfx-focus-chant-sheet" loading="lazy" style="width: 100%; max-width: 720px; aspect-ratio: 16 / 9; object-fit: contain; border-radius: 6px; background: #ffffff;" />
          </div>
          <div id="vfx-focus-chant-strip" style="display: grid; grid-template-columns: repeat(6, minmax(120px, 1fr)); gap: 8px; overflow-x: auto;"></div>
        </div>
      </div>

      <!-- PHASE B: 25 DOS FDOTHER.DAT SPELL VFX & 4 SUMMON CUTAWAYS GALLERY -->
      <div id="vfx-phase-b-spells" style="padding: 16px 18px; background: linear-gradient(180deg, #100b1d 0%, #0b1120 100%); border: 1.5px solid rgba(168, 85, 247, 0.45); border-radius: 12px; display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px;">
          <span style="font-size: 14.5px; font-weight: 800; color: #e9d5ff;">
            🌟 ${tr(
              'Phase B · 25 組 FDOTHER.DAT 法術特效 & 4 大經典召喚獸重製 (點擊立即在舞台播放)',
              'Phase B · 25 组 FDOTHER.DAT 法术特效 & 4 大经典召唤兽重制 (点击立即在舞台播放)',
              'Phase B · 25 FDOTHER.DAT Spell VFX & 4 Iconic Summons (Click any card to play live)'
            )}
          </span>
          <span class="mono-tag" style="font-size: 11px; color: #c4b5fd;">sp_018..sp_068 · SFX Banks 82–94 · Canvas2D + Painted HD WebP</span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(128px, 1fr)); gap: 8px;">
          ${[
            { id: 32, tag: 'sp_065', file: 'summon_32_seraph.webp', zh: '熾天使 (召喚)', en: 'Seraph', col: '#fef08a' },
            { id: 33, tag: 'sp_066', file: 'summon_33_sylph.webp', zh: '風妖精 (召喚)', en: 'Wind Fairy', col: '#7dd3fc' },
            { id: 34, tag: 'sp_067', file: 'summon_34_destroyer.webp', zh: '破壞神 (召喚)', en: 'Destroyer God', col: '#f87171' },
            { id: 35, tag: 'sp_068', file: 'summon_35_fiend.webp', zh: '暗邪鬼 (召喚)', en: 'Dark Fiend', col: '#bef264' },
            { id: 2, tag: 'sp_026 3段動畫', file: 'spell_02_dragon.webp', zh: '炎龍術 (張口/閉口)', en: 'Flame Dragon', col: '#fb923c' },
            { id: 2, tag: 'sp_026 4幀連播', file: 'spell_02_breath.webp', zh: '炎龍術 (4幀龍息)', en: 'Dragon Breath (4F)', col: '#f59e0b' },
            { id: 9, tag: 'sp_044', file: 'spell_09_reaper.webp', zh: '咒殺術 (死神)', en: 'Death Reaper', col: '#a3e635' },
            { id: 0, tag: 'sp_018/20', file: 'fx_fire_pillar_red.webp', zh: '火炎術 (7柱)', en: 'Fireball (7x)', col: '#fb923c' },
            { id: 1, tag: 'sp_019/21', file: 'fx_fire_pillar_blue.webp', zh: '烈炎術 (8柱環)', en: 'Scorching (8x)', col: '#38bdf8' },
            { id: 3, tag: 'sp_039/43', file: 'fx_solar_beam_gold.webp', zh: '天火術 (12波)', en: "Heaven's Fire", col: '#f97316' },
            { id: 4, tag: 'sp_022/23', file: 'fx_bolt_thin.webp', zh: '電擊術 (6閃)', en: 'Lightning (6x)', col: '#a78bfa' },
            { id: 5, tag: 'sp_024/25', file: 'fx_bolt_heavy.webp', zh: '落雷術 (6雷)', en: 'Falling Bolt', col: '#c084fc' },
            { id: 6, tag: 'sp_032/33', file: 'fx_thunder_orb.webp', zh: '轟雷術 (5球)', en: 'Thunder Storm', col: '#8b5cf6' },
            { id: 7, tag: 'sp_037/38', file: 'fx_divine_pillar.webp', zh: '神雷術 (6柱)', en: 'Divine Thunder', col: '#c4b5fd' },
            { id: 8, tag: 'sp_028/30', file: 'fx_holy_nova.webp', zh: '聖光彈 (12連)', en: 'Holy Bolt (12x)', col: '#fde047' },
            { id: 35, tag: 'sp_068 毒霧', file: 'fx_curse_fog.webp', zh: '暗邪鬼 (毒霧)', en: 'Curse Miasma', col: '#84cc16' },
          ]
            .map(
              (c) => `
              <button type="button" data-play-spell="${c.id}" style="background: #141828; border: 1.5px solid ${c.col}55; border-radius: 9px; padding: 6px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; color: #f8fafc; text-align: center; transition: transform 0.12s;">
                <img src="assets/hd_spells/${c.file}${VFX_ASSET_VERSION}" loading="lazy" alt="${c.en}" style="width: 100%; height: 92px; object-fit: contain; background: radial-gradient(circle, rgba(22,30,46,0.95), rgba(6,8,14,0.98)); border-radius: 6px; padding: 3px;" />
                <div style="font-size: 11px; font-weight: 800; color: ${c.col}; line-height: 1.2;">▶ #${String(c.id).padStart(2, '0')} ${isEn ? c.en : c.zh}</div>
                <div class="mono-tag" style="font-size: 9.5px; color: #94a3b8;">${c.tag}</div>
              </button>`
            )
            .join('')}
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
          ${HD_SPELL_CATALOG.map(
            (sp) => `
            <button type="button" class="gal-btn sm" data-play-spell="${sp.id}" title="${isEn ? sp.summaryEn : sp.summaryZh}" style="border-color: ${sp.accentColor}88; color: ${sp.accentColor}; font-size: 11.5px; padding: 3px 9px;">
              ${sp.isSummon ? '🌟' : sp.category === 'fire' ? '🔥' : sp.category === 'thunder' ? '⚡' : sp.category === 'holy' ? '☀️' : '💀'} #${String(sp.id).padStart(2, '0')} ${isEn ? sp.nameEn : sp.nameZh}
            </button>`
          ).join('')}
        </div>
        <div class="mono-tag" style="font-size: 11px; color: #94a3b8; border-top: 1px solid rgba(148,163,184,0.2); padding-top: 6px;">
          🗺️ ${tr(
            '範圍攻擊（#10–#12 碎岩／地震／裂地）、治療（#13–#16）、輔助／異常（#17–#27）：原版無獨立轟擊動畫 → 實戰中先播放「施法者詠唱過場」後切回戰棋地圖執行原版地圖特效。',
            '范围攻击（#10–#12 碎岩／地震／裂地）、治疗（#13–#16）、辅助／异常（#17–#27）：原版无独立轰击动画 → 实战中先播放「施法者咏唱过场」后切回战棋地图执行原版地图特效。',
            'Mass/Earth (#10–#12), Heals (#13–#16), Buffs/Debuffs/Teleport (#17–#27): no DOS strike sprite → live gameplay now plays the regular caster chant cutaway, then transitions back to the original tactical map effect.'
          )}
        </div>
      </div>

      <!-- REFACTORED UNITS QUICK-JUMP VISUAL ROSTER GRID -->
      <div style="padding: 18px; background: var(--bg-panel, #0f172a); border: 1px solid var(--border-subtle, #334155); border-radius: 12px; display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="font-size: 15px; font-weight: 800; color: #f8fafc;">
              📋 ${tr(`已精修戰鬥角色一覽表 (${allUnits.length} 位 · 點擊立即播放)`, `已精修战斗角色一览表 (${allUnits.length} 位 · 点击立即播放)`, `Refactored Combat Units (${allUnits.length} Ready — Click to Play)`)}
            </span>
            <button class="gal-btn sm active" data-rcat="all" type="button">${tr(`全部 (${allUnits.length})`, `全部 (${allUnits.length})`, `All (${allUnits.length})`)}</button>
            <button class="gal-btn sm" data-rcat="hero" type="button">${tr('基礎英雄', '基础英雄', 'Base Heroes')}</button>
            <button class="gal-btn sm" data-rcat="promo" type="button">${tr('轉職職業', '转职职业', 'Promoted')}</button>
            <button class="gal-btn sm" data-rcat="ally" type="button">${tr('戰場友軍', '战场友军', 'Allied NPCs')}</button>
            <button class="gal-btn sm" data-rcat="enemy" type="button">${tr('敵軍與Boss', '敌军与Boss', 'Enemies & Bosses')}</button>
          </div>
          <input
            type="search"
            id="vfx-roster-search"
            class="gal-input"
            style="max-width: 260px; padding: 5px 10px; font-size: 12.5px;"
            placeholder="${tr('搜尋角色編號 / 名稱 / 職業...', '搜索角色编号 / 名称 / 职业...', 'Search ID / Name / Class...')}"
          />
        </div>
        <div id="vfx-all121-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; max-height: 460px; overflow-y: auto; padding-right: 4px;"></div>
      </div>
    </div>
  `;

  const canvas = container.querySelector('#vfx-lab-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const stageContainer = container.querySelector('#vfx-stage-container') as HTMLDivElement;
  const artContainer = container.querySelector('#vfx-art-container') as HTMLDivElement;
  const tabStage = container.querySelector('#vfx-tab-stage') as HTMLButtonElement;
  const tabSplit = container.querySelector('#vfx-tab-split') as HTMLButtonElement;
  const tabArt = container.querySelector('#vfx-tab-art') as HTMLButtonElement;

  const srcOmniBtn = container.querySelector('#vfx-src-omni') as HTMLButtonElement;
  const srcNb6Btn = container.querySelector('#vfx-src-nb6') as HTMLButtonElement;
  const srcNb3Btn = container.querySelector('#vfx-src-nb3') as HTMLButtonElement;

  const btnThorFirst = container.querySelector('#vfx-play-thor-first') as HTMLButtonElement;
  const btnBanditFirst = container.querySelector('#vfx-play-bandit-first') as HTMLButtonElement;
  const btnCrit = container.querySelector('#vfx-play-crit') as HTMLButtonElement;
  const btnMagic = container.querySelector('#vfx-play-magic') as HTMLButtonElement;
  const btnSkill = container.querySelector('#vfx-play-skill') as HTMLButtonElement;
  const btnBanditCrit = container.querySelector('#vfx-play-bandit-crit') as HTMLButtonElement;

  const selRightUnit = container.querySelector('#vfx-sel-right-unit') as HTMLSelectElement;
  const selLeftUnit = container.querySelector('#vfx-sel-left-unit') as HTMLSelectElement;
  const selHeroBg = container.querySelector('#vfx-sel-hero-bg') as HTMLSelectElement;
  const selEnemyBg = container.querySelector('#vfx-sel-enemy-bg') as HTMLSelectElement;
  const selMasterUnit = container.querySelector('#vfx-sel-master-unit') as HTMLSelectElement;
  const masterCounter = container.querySelector('#vfx-master-counter') as HTMLSpanElement;
  const titleBanner = container.querySelector('#vfx-title-banner') as HTMLSpanElement;

  let splitCompare = false;
  let activeScenario: DuelScenario = focusedUnit.side === 'enemy' ? 'bandit_crit' : 'thor_crit';
  renderer.startScenario(activeScenario);

  const updateScenarioBtns = (scen: DuelScenario) => {
    activeScenario = scen;
    btnThorFirst.classList.toggle('active', scen === 'thor_first_duel');
    btnBanditFirst.classList.toggle('active', scen === 'bandit_first_duel');
    btnCrit.classList.toggle('active', scen === 'thor_crit');
    btnMagic.classList.toggle('active', scen === 'hero_magic');
    btnSkill.classList.toggle('active', scen === 'hero_skill');
    btnBanditCrit.classList.toggle('active', scen === 'bandit_crit');
    renderer.startScenario(scen);
  };
  updateScenarioBtns(activeScenario);

  const renderAll121Grid = () => {
    const gridEl = container.querySelector('#vfx-all121-grid') as HTMLDivElement | null;
    if (!gridEl) return;
    const list = getFilteredRoster();
    gridEl.innerHTML = list
      .map((u) => {
        const isFocused = u.uid === focusedUnit.uid;
        const isActiveRight = u.uid === vfxAssets.rightUnit.uid;
        const isActiveLeft = u.uid === vfxAssets.leftUnit.uid;
        const borderCol = isFocused
          ? '#fde047'
          : isActiveRight
            ? '#38bdf8'
            : isActiveLeft
              ? '#f87171'
              : '#334155';
        const bgCol = isFocused ? 'rgba(234, 179, 8, 0.16)' : '#090d16';
        const modeTag = u.isRemote
          ? isEn ? '🏹 Ranged' : '🏹 遠程3段'
          : u.hasMagic
            ? isEn ? '✨ Melee+Magic' : '✨ 近戰+法術'
            : (u.hitFrames?.length ?? 0) > 1
              ? isEn ? `⚔️ ${u.hitFrames!.length}-Hit` : `⚔️ ${u.hitFrames!.length}連擊`
              : u.side === 'player'
                ? '🛡️↖'
                : '⚔️↘';
        const titleStr = isEn ? `${u.nameEn}` : `${u.nameZh} (${u.nameEn})`;
        const clsStr = isEn ? u.classEn : `${u.classNameZh} · ${u.classEn}`;
        return `
          <button
            type="button"
            data-jump-uid="${u.uid}"
            style="display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: 8px; background: ${bgCol}; border: ${isFocused ? '2px' : '1px'} solid ${borderCol}; color: #f8fafc; text-align: left; cursor: pointer; transition: transform 0.1s;"
          >
            <img src="${u.dir}/cutin.jpg${VFX_ASSET_VERSION}" loading="lazy" style="width: 68px; height: 34px; object-fit: cover; border-radius: 4px; border: 1px solid #475569; flex-shrink: 0;" />
            <div style="min-width: 0; flex: 1;">
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 4px; font-size: 12px; font-weight: 700;">
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">#${String(u.uid).padStart(3, '0')} ${titleStr}</span>
                <span style="font-size: 10.5px; color: ${u.isRemote ? '#fbbf24' : u.hasMagic ? '#c084fc' : '#94a3b8'}; flex-shrink: 0;">${modeTag}</span>
              </div>
              <div style="font-size: 11px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${clsStr}
              </div>
            </div>
          </button>
        `;
      })
      .join('');

    gridEl.querySelectorAll<HTMLButtonElement>('[data-jump-uid]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uid = Number(btn.dataset.jumpUid);
        void selectAndInspectUnitById(uid);
      });
    });
  };

  const refreshSingleUnitInspector = () => {
    const u = focusedUnit;
    const idx = allUnits.findIndex((item) => item.uid === u.uid);
    selMasterUnit.value = String(u.uid);
    masterCounter.textContent = `${idx + 1} / ${allUnits.length}`;

    const focusTitle = container.querySelector('#vfx-focus-title') as HTMLSpanElement | null;
    const focusBadges = container.querySelector('#vfx-focus-badges') as HTMLSpanElement | null;
    if (focusTitle) {
      focusTitle.textContent = `🔎 ${tr('當前逐一檢視角色：', '当前逐一检视角色：', 'Currently Inspecting Unit: ')}#${String(u.uid).padStart(3, '0')} ${u.nameZh} (${u.nameEn}) — ${u.classNameZh} / ${u.classEn}`;
    }
    if (focusBadges) {
      focusBadges.textContent = `[${u.side === 'player' ? tr('我方/友軍 右下↖ · 特寫向左←', '我方/友军 右下↖ · 特写向左←', 'Player/Ally ↖ · Cut-In ←') : tr('敵軍/Boss 左上↘ · 特寫向右→', '敌军/Boss 左上↘ · 特写向右→', 'Enemy/Boss ↘ · Cut-In →')} | KP1..KP7: PASS]`;
    }

    const btnFocusRight = container.querySelector('#vfx-btn-focus-right') as HTMLButtonElement | null;
    const btnFocusLeft = container.querySelector('#vfx-btn-focus-left') as HTMLButtonElement | null;
    btnFocusRight?.classList.toggle('active', u.uid === vfxAssets.rightUnit.uid);
    btnFocusLeft?.classList.toggle('active', u.uid === vfxAssets.leftUnit.uid);

    const cb = VFX_ASSET_VERSION;
    const cutinImg = container.querySelector('#vfx-focus-cutin') as HTMLImageElement | null;
    const nb6Img = container.querySelector('#vfx-focus-nb6sheet') as HTMLImageElement | null;
    const dosImg = container.querySelector('#vfx-focus-dosref') as HTMLImageElement | null;
    if (cutinImg) cutinImg.src = `${u.dir}/cutin.jpg${cb}`;
    if (nb6Img) nb6Img.src = `${u.dir}/nb6_sheet.jpg${cb}`;
    if (dosImg) dosImg.src = `${u.dir}/dos_ref.jpg${cb}`;

    const omniCount = Math.max(10, u.omniFrameCount ?? 10);
    const hitFrameSet = new Set((u.hitFrames ?? []).map((h) => h.frame));
    const omniTitle = container.querySelector('#vfx-focus-omni-title') as HTMLDivElement | null;
    if (omniTitle) {
      omniTitle.textContent = `🎞️ ${tr(
        `完整去背連段序列逐幀檢視 (${omniCount} 幀 · omni_0..${omniCount - 1}.webp)`,
        `完整去背连段序列逐帧检视 (${omniCount} 帧 · omni_0..${omniCount - 1}.webp)`,
        `Alpha-Matted Full Sequence (${omniCount}F · omni_0..${omniCount - 1}.webp)`
      )}`;
    }
    const omniStrip = container.querySelector('#vfx-focus-omni-strip') as HTMLDivElement | null;
    if (omniStrip) {
      const defaultLabels = ['F0 Ready', 'F1 Step', 'F2 Wind1', 'F3 Wind2', 'F4 Pre-Hit', 'F5 Impact', 'F6 Bloom', 'F7 Follow1', 'F8 Fade', 'F9 Finish'];
      const indices = Array.from({ length: omniCount }, (_, i) => i);
      omniStrip.innerHTML = indices
        .map((i) => {
          const isHit = hitFrameSet.has(i);
          const lbl = isHit ? `F${i} HIT!` : (defaultLabels[i] ?? `F${i}`);
          return `
            <div style="background: #141c2e; border: 1px solid ${isHit ? '#eab308' : '#334155'}; border-radius: 6px; padding: 6px; text-align: center;">
              <img src="${u.dir}/omni_${i}.webp${cb}" loading="lazy" style="width: 100%; height: 78px; object-fit: contain; display: block;" />
              <div class="mono-tag" style="font-size: 10.5px; color: ${isHit ? '#fde047' : '#cbd5e1'}; margin-top: 4px;">${lbl}</div>
            </div>
          `;
        })
        .join('');
    }

    const nb6Strip = container.querySelector('#vfx-focus-nb6-strip') as HTMLDivElement | null;
    if (nb6Strip) {
      const nb6Labels = ['NB6 #0 Ready', 'NB6 #1 Wind-Up 1', 'NB6 #2 Wind-Up 2', 'NB6 #3 Peak Slash', 'NB6 #4 Follow 1', 'NB6 #5 Finish'];
      nb6Strip.innerHTML = [0, 1, 2, 3, 4, 5]
        .map(
          (i) => `
            <div style="background: #141c2e; border: 1px solid #334155; border-radius: 6px; padding: 6px; text-align: center;">
              <img src="${u.dir}/nb6_${i}.webp${cb}" loading="lazy" style="width: 100%; height: 84px; object-fit: contain; display: block;" />
              <div class="mono-tag" style="font-size: 10.5px; color: #cbd5e1; margin-top: 4px;">${nb6Labels[i]}</div>
            </div>
          `
        )
        .join('');
    }

    const rangedPanel = container.querySelector('#vfx-focus-ranged-panel') as HTMLDivElement | null;
    if (rangedPanel) {
      if (u.rangedSkill) {
        rangedPanel.style.display = 'flex';
        const rTitle = container.querySelector('#vfx-focus-ranged-title') as HTMLDivElement | null;
        if (rTitle) {
          rTitle.textContent = `🌀 ${tr(
            `專屬遠程劍技 / 詠唱動畫：${u.rangedSkill.nameZh} (6 幀 · ranged_0..5.webp)`,
            `专属远程剑技 / 咏唱动画：${u.rangedSkill.nameZh} (6 帧 · ranged_0..5.webp)`,
            `Secondary Skill / Chant Animation: ${u.rangedSkill.nameEn} (6F · ranged_0..5.webp)`
          )}`;
        }
        const rSheet = container.querySelector('#vfx-focus-ranged-sheet') as HTMLImageElement | null;
        const rDos = container.querySelector('#vfx-focus-ranged-dos') as HTMLImageElement | null;
        if (rSheet) rSheet.src = `${u.dir}/ranged_sheet.jpg${cb}`;
        if (rDos) rDos.src = `${u.dir}/dos_ranged_ref.jpg${cb}`;
        const rStrip = container.querySelector('#vfx-focus-ranged-strip') as HTMLDivElement | null;
        if (rStrip) {
          rStrip.innerHTML = Array.from({ length: u.rangedSkill.frameCount }, (_, i) => `
            <div style="background: #141c2e; border: 1px solid #38bdf8; border-radius: 6px; padding: 6px; text-align: center;">
              <img src="${u.dir}/ranged_${i}.webp${cb}" loading="lazy" style="width: 100%; height: 84px; object-fit: contain; display: block;" />
              <div class="mono-tag" style="font-size: 10.5px; color: #7dd3fc; margin-top: 4px;">Skill F${i + 1}</div>
            </div>
          `).join('');
        }
      } else {
        rangedPanel.style.display = 'none';
      }
    }

    const chantPanel = container.querySelector('#vfx-focus-chant-panel') as HTMLDivElement | null;
    if (chantPanel) {
      if (u.hasChantAnim) {
        chantPanel.style.display = 'flex';
        const cTitle = container.querySelector('#vfx-focus-chant-title') as HTMLDivElement | null;
        if (cTitle) {
          const spZh = u.magicNameZh ?? '魔法詠唱';
          const spEn = u.magicNameEn ?? 'Spell Chant';
          cTitle.textContent = `✨ ${tr(
            `專屬法術詠唱動畫：${spZh} (6 幀 · chant_0..5.webp)`,
            `专属法术咏唱动画：${spZh} (6 帧 · chant_0..5.webp)`,
            `Dedicated Spell-Chant Animation: ${spEn} (6F · chant_0..5.webp)`
          )}`;
        }
        const cSheet = container.querySelector('#vfx-focus-chant-sheet') as HTMLImageElement | null;
        if (cSheet) cSheet.src = `${u.dir}/chant_sheet.jpg${cb}`;
        const cStrip = container.querySelector('#vfx-focus-chant-strip') as HTMLDivElement | null;
        if (cStrip) {
          cStrip.innerHTML = [0, 1, 2, 3, 4, 5]
            .map(
              (i) => `
            <div style="background: #1a112b; border: 1px solid #c084fc; border-radius: 6px; padding: 6px; text-align: center;">
              <img src="${u.dir}/chant_${i}.webp${cb}" loading="lazy" style="width: 100%; height: 84px; object-fit: contain; display: block;" />
              <div class="mono-tag" style="font-size: 10.5px; color: #e9d5ff; margin-top: 4px;">Chant F${i + 1}</div>
            </div>
          `
            )
            .join('');
        }
      } else {
        chantPanel.style.display = 'none';
      }
    }

    renderAll121Grid();
  };

  let isArtTabOpen = false;
  const populateArtTabImages = () => {
    const ru = vfxAssets.rightUnit;
    const lu = vfxAssets.leftUnit;
    const cb = VFX_ASSET_VERSION;
    const setEl = <T extends HTMLElement>(id: string, fn: (el: T) => void) => {
      const el = container.querySelector(id) as T | null;
      if (el) fn(el);
    };
    setEl<HTMLHeadingElement>('#vfx-art-title-a1', (el) => {
      el.textContent = `🖼️ #${ru.uid} ${ru.nameZh} (${ru.nameEn}) 6-Frame Sheet`;
    });
    setEl<HTMLImageElement>('#vfx-art-img-a1', (el) => {
      el.src = `${ru.dir}/nb6_sheet.jpg${cb}`;
    });
    setEl<HTMLHeadingElement>('#vfx-art-title-a2', (el) => {
      el.textContent = `🖼️ #${lu.uid} ${lu.nameZh} (${lu.nameEn}) 6-Frame Sheet`;
    });
    setEl<HTMLImageElement>('#vfx-art-img-a2', (el) => {
      el.src = `${lu.dir}/nb6_sheet.jpg${cb}`;
    });
    setEl<HTMLHeadingElement>('#vfx-art-title-c1', (el) => {
      el.textContent = `🔥 Crit Cut-In (←): #${ru.uid} ${ru.nameZh} (${ru.nameEn})`;
    });
    setEl<HTMLImageElement>('#vfx-art-img-c1', (el) => {
      el.src = `${ru.dir}/cutin.jpg${cb}`;
    });
    setEl<HTMLHeadingElement>('#vfx-art-title-c2', (el) => {
      el.textContent = `💥 Crit Cut-In (→): #${lu.uid} ${lu.nameZh} (${lu.nameEn})`;
    });
    setEl<HTMLImageElement>('#vfx-art-img-c2', (el) => {
      el.src = `${lu.dir}/cutin.jpg${cb}`;
    });
  };

  const refreshMatchupLabelsAndArt = () => {
    const ru = vfxAssets.rightUnit;
    const lu = vfxAssets.leftUnit;
    selRightUnit.value = String(ru.uid);
    selLeftUnit.value = String(lu.uid);
    selHeroBg.value = String(vfxAssets.heroBgId);
    selEnemyBg.value = String(vfxAssets.enemyBgId);

    // Update Crit & Magic scenario button labels dynamically for Ranged (#008 Celia) & Dual-Form Casters (#009 Uni, #010 Marin)!
    if (ru.isRemote) {
      btnCrit.textContent = `🏹 ${tr(
        `${ru.nameZh} 3段遠程射擊 (速度線過場)`,
        `${ru.nameZh} 3段远程射击 (速度线过场)`,
        `${ru.nameEn} 3-Stage Ranged Shot (Speed-Lines)`
      )}`;
    } else {
      btnCrit.textContent = `🔥 ${tr('我方會心一擊 (物理攻擊 ←)', '我方会心一击 (物理攻击 ←)', 'Hero Physical Crit (Cut-In ←)')}`;
    }
    if (ru.hasMagic) {
      const spZh = ru.magicNameZh ?? '元素法術';
      const spEn = ru.magicNameEn ?? 'Spell';
      btnMagic.textContent = `✨ ${tr(
        `${ru.nameZh} 遠程法術：${spZh} (2段切屏)`,
        `${ru.nameZh} 远程法术：${spZh} (2段切屏)`,
        `${ru.nameEn} Remote Magic: ${spEn} (2-Stage)`
      )}`;
      btnMagic.style.borderColor = '#c084fc';
      btnMagic.style.boxShadow = '0 0 12px rgba(192, 132, 252, 0.35)';
    } else {
      btnMagic.textContent = `✨ ${tr('我方遠程法術切屏預覽 (2段切屏)', '我方远程法术切屏预览 (2段切屏)', 'Preview Remote Magic (2-Stage)')}`;
      btnMagic.style.borderColor = 'rgba(148, 163, 184, 0.45)';
      btnMagic.style.boxShadow = 'none';
    }

    if (ru.rangedSkill) {
      const sk = ru.rangedSkill;
      btnSkill.style.display = '';
      btnSkill.textContent = `🌀 ${tr(
        `${ru.nameZh} 專屬技能：${sk.nameZh}${sk.isRemote ? ' (3段切屏)' : sk.mode === 'hero_chant' ? ' (2段詠唱)' : ''}`,
        `${ru.nameZh} 专属技能：${sk.nameZh}${sk.isRemote ? ' (3段切屏)' : sk.mode === 'hero_chant' ? ' (2段咏唱)' : ''}`,
        `${ru.nameEn}: ${sk.nameEn}${sk.isRemote ? ' (3-Stage)' : ''}`
      )}`;
      btnSkill.style.boxShadow = '0 0 12px rgba(56, 189, 248, 0.35)';
    } else {
      btnSkill.style.display = 'none';
      btnSkill.style.boxShadow = 'none';
    }

    titleBanner.textContent = `⚡ ${tr(
      `2026 現代 2.5D 戰鬥動畫精修檢視 — ${ru.nameZh} (#${ru.uid} 右下↖) vs ${lu.nameZh} (#${lu.uid} 左上↘)`,
      `2026 现代 2.5D 战斗动画精修检视 — ${ru.nameZh} (#${ru.uid} 右下↖) vs ${lu.nameZh} (#${lu.uid} 左上↘)`,
      `2026 Modern 2.5D HD Inspector — ${ru.nameEn} (#${ru.uid} ↖) vs. ${lu.nameEn} (#${lu.uid} ↘)`
    )}`;

    if (isArtTabOpen) {
      populateArtTabImages();
    }

    refreshSingleUnitInspector();
    opts?.onMatchupChange?.(ru.uid, lu.uid, focusedUnit.uid);
  };

  const selectAndInspectUnitById = async (uid: number) => {
    const entry = allUnits.find((u) => u.uid === uid);
    if (!entry) return;
    focusedUnit = entry;
    if (entry.side === 'player') {
      await loadUnitSlotIntoVfxAssets(assets, vfxAssets, 'player', entry);
      refreshMatchupLabelsAndArt();
      updateScenarioBtns('thor_crit');
    } else {
      await loadUnitSlotIntoVfxAssets(assets, vfxAssets, 'enemy', entry);
      refreshMatchupLabelsAndArt();
      updateScenarioBtns('bandit_crit');
    }
  };

  // Initial render of single-unit inspector and 121-grid
  refreshMatchupLabelsAndArt();

  selMasterUnit.addEventListener('change', () => {
    void selectAndInspectUnitById(Number(selMasterUnit.value));
  });

  const stepMasterUnit = (delta: number) => {
    const list = getFilteredRoster();
    if (list.length === 0) return;
    const curIdx = list.findIndex((u) => u.uid === focusedUnit.uid);
    const nextIdx = curIdx < 0 ? 0 : (curIdx + delta + list.length) % list.length;
    void selectAndInspectUnitById(list[nextIdx].uid);
  };

  container.querySelector('#vfx-btn-master-prev')?.addEventListener('click', () => stepMasterUnit(-1));
  container.querySelector('#vfx-btn-master-next')?.addEventListener('click', () => stepMasterUnit(1));

  // Right Hero/Ally selector & Prev/Next
  selRightUnit.addEventListener('change', async () => {
    const uid = Number(selRightUnit.value);
    const entry = playerUnits.find((u) => u.uid === uid);
    if (!entry) return;
    focusedUnit = entry;
    await loadUnitSlotIntoVfxAssets(assets, vfxAssets, 'player', entry);
    refreshMatchupLabelsAndArt();
    updateScenarioBtns('thor_crit');
  });

  const stepSideUnit = (side: 'player' | 'enemy', delta: number) => {
    const list = side === 'player' ? playerUnits : enemyUnits;
    const curUid = side === 'player' ? vfxAssets.rightUnit.uid : vfxAssets.leftUnit.uid;
    const idx = list.findIndex((u) => u.uid === curUid);
    const next = list[(idx + delta + list.length) % list.length];
    if (next) void selectAndInspectUnitById(next.uid);
  };

  container.querySelector('#vfx-btn-right-prev')?.addEventListener('click', () => stepSideUnit('player', -1));
  container.querySelector('#vfx-btn-right-next')?.addEventListener('click', () => stepSideUnit('player', 1));
  container.querySelector('#vfx-btn-left-prev')?.addEventListener('click', () => stepSideUnit('enemy', -1));
  container.querySelector('#vfx-btn-left-next')?.addEventListener('click', () => stepSideUnit('enemy', 1));

  // Left Enemy/Boss selector
  selLeftUnit.addEventListener('change', async () => {
    const uid = Number(selLeftUnit.value);
    const entry = enemyUnits.find((u) => u.uid === uid);
    if (!entry) return;
    focusedUnit = entry;
    await loadUnitSlotIntoVfxAssets(assets, vfxAssets, 'enemy', entry);
    refreshMatchupLabelsAndArt();
    updateScenarioBtns('bandit_crit');
  });

  // Focus Right vs Left buttons in Single-Unit Inspector
  container.querySelector('#vfx-btn-focus-right')?.addEventListener('click', () => {
    focusedUnit = vfxAssets.rightUnit;
    refreshSingleUnitInspector();
    updateScenarioBtns('thor_crit');
  });
  container.querySelector('#vfx-btn-focus-left')?.addEventListener('click', () => {
    focusedUnit = vfxAssets.leftUnit;
    refreshSingleUnitInspector();
    updateScenarioBtns('bandit_crit');
  });

  // Category filter pills & search in All-121 Grid
  container.querySelectorAll<HTMLButtonElement>('[data-rcat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeRosterCat = (btn.dataset.rcat as RosterCat) || 'all';
      container.querySelectorAll<HTMLButtonElement>('[data-rcat]').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      renderAll121Grid();
    });
  });

  const rosterSearchInput = container.querySelector('#vfx-roster-search') as HTMLInputElement | null;
  rosterSearchInput?.addEventListener('input', () => {
    rosterSearchQuery = rosterSearchInput.value;
    renderAll121Grid();
  });

  // Keyboard shortcuts [ and ] to step through units one-by-one
  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement || ev.target instanceof HTMLTextAreaElement) {
      return;
    }
    if (ev.key === '[') {
      ev.preventDefault();
      stepMasterUnit(-1);
    } else if (ev.key === ']') {
      ev.preventDefault();
      stepMasterUnit(1);
    }
  };
  window.addEventListener('keydown', onKeyDown);

  const updateAnimSource = (src: AnimSourceMode) => {
    renderer.config.animSource = src;
    srcOmniBtn.classList.toggle('active', src === 'omni_video');
    srcNb6Btn.classList.toggle('active', src === 'nb2_6frame');
    srcNb3Btn.classList.toggle('active', src === 'nb2_3pose');
    renderer.startScenario(activeScenario);
  };

  srcOmniBtn.addEventListener('click', () => updateAnimSource('omni_video'));
  srcNb6Btn.addEventListener('click', () => updateAnimSource('nb2_6frame'));
  srcNb3Btn.addEventListener('click', () => updateAnimSource('nb2_3pose'));

  const updateViewMode = (mode: 'stage' | 'split' | 'art') => {
    tabStage.classList.toggle('active', mode === 'stage');
    tabSplit.classList.toggle('active', mode === 'split');
    tabArt.classList.toggle('active', mode === 'art');
    stageContainer.style.display = mode === 'art' ? 'none' : 'flex';
    artContainer.style.display = mode === 'art' ? 'block' : 'none';
    splitCompare = mode === 'split';
    isArtTabOpen = mode === 'art';
    if (isArtTabOpen) {
      populateArtTabImages();
    }
  };

  tabStage.addEventListener('click', () => updateViewMode('stage'));
  tabSplit.addEventListener('click', () => updateViewMode('split'));
  tabArt.addEventListener('click', () => updateViewMode('art'));

  btnThorFirst.addEventListener('click', () => updateScenarioBtns('thor_first_duel'));
  btnBanditFirst.addEventListener('click', () => updateScenarioBtns('bandit_first_duel'));
  btnCrit.addEventListener('click', () => updateScenarioBtns('thor_crit'));
  btnMagic.addEventListener('click', () => updateScenarioBtns('hero_magic'));
  const selSpell = container.querySelector('#vfx-sel-spell') as HTMLSelectElement | null;
  const playSpellPreview = (spellId: number | null, scrollUp = false) => {
    renderer.previewSpellId = spellId;
    if (selSpell) selSpell.value = spellId === null ? 'auto' : String(spellId);
    void ensureHdSpellAssets(VFX_ASSET_VERSION).then(() => {
      updateScenarioBtns('hero_magic');
    });
    updateViewMode('stage');
    if (scrollUp) {
      stageContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
  selSpell?.addEventListener('change', () => {
    const val = selSpell.value;
    playSpellPreview(val === 'auto' ? null : Number(val), false);
  });
  container.querySelectorAll<HTMLButtonElement>('[data-play-spell]').forEach((btn) => {
    btn.addEventListener('click', () => {
      playSpellPreview(Number(btn.dataset.playSpell), true);
    });
  });
  if (opts?.initialSpellId !== undefined) {
    playSpellPreview(opts.initialSpellId, false);
  }
  btnSkill.addEventListener('click', () => updateScenarioBtns('hero_skill'));
  btnBanditCrit.addEventListener('click', () => updateScenarioBtns('bandit_crit'));

  // Independent Hero & Enemy Terrain Selectors + Quick Presets
  selHeroBg.addEventListener('change', async () => {
    await loadTerrainBgIntoVfxAssets(vfxAssets, 'hero', Number(selHeroBg.value));
    renderer.startScenario(activeScenario);
  });
  selEnemyBg.addEventListener('change', async () => {
    await loadTerrainBgIntoVfxAssets(vfxAssets, 'enemy', Number(selEnemyBg.value));
    renderer.startScenario(activeScenario);
  });
  container.querySelectorAll<HTMLButtonElement>('[data-terrain-preset]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const [hId, eId] = (btn.dataset.terrainPreset || '4,10').split(',').map(Number);
      await Promise.all([
        loadTerrainBgIntoVfxAssets(vfxAssets, 'hero', hId),
        loadTerrainBgIntoVfxAssets(vfxAssets, 'enemy', eId),
      ]);
      selHeroBg.value = String(hId);
      selEnemyBg.value = String(eId);
      renderer.startScenario(activeScenario);
    });
  });

  const bindToggle = (selector: string, key: Exclude<keyof ModernVfxConfig, 'animSource'>) => {
    const el = container.querySelector(selector) as HTMLInputElement;
    el.addEventListener('change', () => {
      renderer.config[key] = el.checked;
    });
  };
  bindToggle('#vfx-chk-slowmo', 'slowMotion');
  bindToggle('#vfx-chk-parallax', 'enableParallaxAndGodRays');
  bindToggle('#vfx-chk-cutin', 'enableAnimeCutIn');
  bindToggle('#vfx-chk-slash', 'enableVolumetricSlash');
  bindToggle('#vfx-chk-sparks', 'enableHitStopAndSparks');
  bindToggle('#vfx-chk-spring', 'enableAfterimagesAndSpring');

  let disposed = false;
  let rafId = 0;
  let lastTime = performance.now();

  const loop = (now: number) => {
    if (disposed || !document.body.contains(canvas)) return;
    const dt = now - lastTime;
    lastTime = now;
    if (renderer.isFinished()) {
      renderer.startScenario(activeScenario);
    }
    renderer.stepAndRender(ctx, dt, splitCompare);
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);

  activeLabCleanup = () => {
    disposed = true;
    window.removeEventListener('keydown', onKeyDown);
    cancelAnimationFrame(rafId);
  };
}
