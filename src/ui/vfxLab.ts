import type { SfxKind, SoundEngine } from '../audio/soundEngine';
import type { AssetManager } from '../engine/assets';
import { getLocale, tr } from '../i18n';
import type { FigAniStrip } from '../types';

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
  projectileType?: 'bolt' | 'arrow' | 'beam' | 'orb';
  /** Normalized [0..1] sprite-space coordinates (680x680 frame) where the missile/bolt leaves the weapon on Stage 1. */
  muzzleAnchor?: { x: number; y: number };
  /** Exact firing frame index when the projectile releases on Stage 1. */
  rangedFireFrame?: { nb6: number; omni: number };
  hasMagic?: boolean;
  magicElement?: 'fire' | 'holy' | 'thunder' | 'ice' | 'arcane';
  magicNameZh?: string;
  magicNameEn?: string;
  isFlying?: boolean;
  sfxProfile?: UnitSfxProfile;
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

const VFX_ASSET_VERSION = '?v=23';

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
    if (spellIds.has(0) || spellIds.has(1) || spellIds.has(2)) magicElement = 'fire';
    else if (spellIds.has(3) || spellIds.has(4) || spellIds.has(5)) magicElement = 'thunder';
    else if (spellIds.has(6) || spellIds.has(7) || spellIds.has(8)) magicElement = 'ice';
    else if (spellIds.has(13) || spellIds.has(14) || spellIds.has(32)) magicElement = 'holy';
    else magicElement = 'arcane';
  }
  const isFlying =
    entry.isFlying ??
    Boolean(
      dex &&
        (dex.classNameZh?.includes('龍騎士') ||
          dex.classNameZh?.includes('飛龍') ||
          ((dex.raceId === 4 || dex.raceId === 5) && entry.uid !== 28))
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

  return {
    ...entry,
    isRemote,
    projectileType,
    hasMagic,
    magicElement,
    isFlying,
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
  const [nb6, omni, cutIn, cIdle, cAtk] = await Promise.all([
    Promise.all([0, 1, 2, 3, 4, 5].map((i) => loadImg(`${entry.dir}/nb6_${i}.webp${cb}`))),
    Promise.all(omniIndices.map((i) => loadImg(`${entry.dir}/omni_${i}.webp${cb}`))),
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

  vfxAssetsCache.forestBg = forestBg;
  vfxAssetsCache.loaded = true;
  return vfxAssetsCache;
}

export type DuelScenario = 'thor_first_duel' | 'bandit_first_duel' | 'thor_crit' | 'bandit_crit' | 'hero_magic';

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

    this.thorStrikeDmg = scenario === 'thor_crit' ? 35 : scenario === 'hero_magic' ? 28 : 22;
    this.banditStrikeDmg = scenario === 'bandit_crit' ? 28 : 7;
    this.activeStageBadge = '';
  }

  public getTotalDurationMs(): number {
    if (this.scenario === 'hero_magic') return 3150;
    if (this.scenario === 'thor_crit') {
      return this.vfxAssets.rightUnit.isRemote ? 2850 : 2600;
    }
    if (this.scenario === 'bandit_crit') {
      return this.vfxAssets.leftUnit.isRemote ? 2850 : 2600;
    }
    if (this.vfxAssets.rightUnit.isRemote || this.vfxAssets.leftUnit.isRemote) {
      return 4850;
    }
    return 4400;
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
    const thorDur = this.vfxAssets.rightUnit.isRemote ? 2450 : 1830;
    const banditDur = this.vfxAssets.leftUnit.isRemote ? 2450 : 1850;
    if (this.scenario === 'hero_magic') {
      return { thorStart: 120, banditStart: -1, thorDur: 2950, banditDur: 0 };
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

    const thorSpec: PoseRenderSpec = {
      primaryIdx: 0,
      x: thorHomeX,
      y: thorHomeY,
      scaleX: 1.0 - breath * 0.5,
      scaleY: 1.0 + breath,
      rot: 0,
      flashWhite: 0,
      afterimages: 0,
      dashDirX: -1,
      dashDirY: -0.48,
    };

    const banditSpec: PoseRenderSpec = {
      primaryIdx: 0,
      x: banditHomeX,
      y: banditHomeY,
      scaleX: 1.0,
      scaleY: 1.0 + Math.sin(t * 0.005 + 1.4) * (this.config.enableAfterimagesAndSpring ? 0.014 : 0),
      rot: 0,
      flashWhite: 0,
      afterimages: 0,
      dashDirX: 1,
      dashDirY: 0.48,
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
    const thorDrawsInFront = true;

    // -------------------------------------------------------------------------
    // Hero Diagonal Up-Left (↖) Strike Sequence (supports both 1-hit & Multi-Hit units!)
    // -------------------------------------------------------------------------
    const srcMode = this.config.animSource;
    const rightHitFrames = this.vfxAssets.rightUnit.hitFrames;
    const isRightMultiHit =
      srcMode === 'omni_video' &&
      Array.isArray(rightHitFrames) &&
      rightHitFrames.length > 1 &&
      this.vfxAssets.thorOmniPoses.length > 10;
    const rightOmniMax = Math.max(1, this.vfxAssets.thorOmniPoses.length - 1);

    if (thorStart >= 0 && t >= thorStart && t < thorStart + 1830) {
      const localT = t - thorStart;
      if (isRightMultiHit && rightHitFrames) {
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
        // 3. Diagonal Up-Left Cleave Impact & Follow-Through
        const p = (localT - 820) / 580;
        if (srcMode === 'omni_video') {
          if (p < 0.65) {
            this.setContinuousFrame(thorSpec, 4.0 + (p / 0.65) * 5.0, 9);
          } else {
            thorSpec.primaryIdx = 9;
          }
        } else if (srcMode === 'nb2_6frame') {
          if (p < 0.28) {
            this.setContinuousFrame(thorSpec, 3.0 + (p / 0.28) * 1.0, 5);
          } else if (p < 0.55) {
            this.setContinuousFrame(thorSpec, 4.0 + ((p - 0.28) / 0.27) * 1.0, 5);
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
        thorSpec.y = thorHomeY + recoil * 22;
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
        banditSpec.y = startY + ease * (banditHomeY - startY);
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

    this.drawGroundShadow(ctx, banditSpec.x, banditSpec.y, 195);
    this.drawGroundShadow(ctx, thorSpec.x, thorSpec.y, 215);

    if (shockwaveProgress >= 0 && shockwaveProgress <= 1 && this.config.enableHitStopAndSparks) {
      this.drawGroundShockwave(ctx, shockwaveCenter.x, shockwaveGroundY - 10, shockwaveProgress);
    }

    // Render Bandit (Top-Left, lower Y -> drawn first in painter's algorithm)
    const activeBanditPoses = this.getActivePoseList('bandit');
    const activeThorPoses = this.getActivePoseList('thor');
    this.renderCombatantWithBlend(ctx, activeBanditPoses, banditSpec, '#ef4444', 495);
    if (banditSpec.primaryIdx >= 1 && banditSpec.primaryIdx <= 6) {
      this.drawBanditVisorGlint(ctx, banditSpec.x + 24, banditSpec.y - 340, t);
    }

    // Render Thor (Bottom-Right Foreground, higher Y -> drawn on top in painter's algorithm!)
    if (thorDrawsInFront) {
      const thorDispSize = 720;
      this.renderCombatantWithBlend(ctx, activeThorPoses, thorSpec, '#38bdf8', thorDispSize);
    }

    if (
      thorSpec.primaryIdx === 1 &&
      thorStart >= 0 &&
      t >= thorStart &&
      t < thorStart + 820 &&
      this.config.enableVolumetricSlash
    ) {
      this.drawBladeChargeAura(ctx, thorSpec.x + 55, thorSpec.y - 420, (t - thorStart) / 820);
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
      this.drawRangedSpeedLineBridge(ctx, W, H, bp, isHeroAtk ? -1 : 1, projectileType);
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
      if (isCrit && this.config.enableAnimeCutIn && p >= 0.14 && p <= 0.48) {
        cutInProgress = (p - 0.14) / 0.34;
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

      // Map launch progress cleanly through Ready -> Wind-Up/Aim -> Exact Firing Frame -> Recoil Hold!
      // Fire release happens at p = 0.56, synced to per-unit `rangedFireFrame` (e.g., Celia nb6=4, omni=5).
      const fireOmni = actorUnit.rangedFireFrame?.omni ?? Math.min(actorMaxIdx, 5);
      const fireNb6 = actorUnit.rangedFireFrame?.nb6 ?? 3;
      if (srcMode === 'omni_video') {
        if (p < 0.54) {
          this.setContinuousFrame(actorSpec, (p / 0.54) * Math.max(1, fireOmni - 0.6), actorMaxIdx);
        } else if (p < 0.84) {
          const fp = (p - 0.54) / 0.3;
          this.setContinuousFrame(actorSpec, Math.min(actorMaxIdx, fireOmni + fp * (actorMaxIdx - fireOmni)), actorMaxIdx);
        } else {
          actorSpec.primaryIdx = actorMaxIdx;
        }
      } else if (srcMode === 'nb2_6frame') {
        if (p < 0.54) {
          this.setContinuousFrame(actorSpec, (p / 0.54) * Math.max(1, fireNb6 - 0.6), 5);
        } else if (p < 0.84) {
          const fp = (p - 0.54) / 0.3;
          this.setContinuousFrame(actorSpec, Math.min(5, fireNb6 + fp * (5 - fireNb6)), 5);
        } else {
          actorSpec.primaryIdx = 5;
        }
      } else {
        actorSpec.primaryIdx = p < 0.25 ? 0 : p < 0.54 ? 1 : 2;
      }

      // Per-unit normalized muzzle anchor in 680x680 sprite space (matches drawCharacterSprite anchorRatioY = 648/680)
      const actorDispSize = isHeroAtk ? 720 : 510;
      const muzzleAnchor =
        actorUnit.muzzleAnchor ?? (isHeroAtk ? { x: 0.22, y: 0.54 } : { x: 0.78, y: 0.54 });
      const getMuzzlePos = () => ({
        x: actorSpec.x + (muzzleAnchor.x - 0.5) * actorDispSize * actorSpec.scaleX,
        y: actorSpec.y + (muzzleAnchor.y - 648 / 680) * actorDispSize * actorSpec.scaleY,
      });

      // Slight recoil kickback on release at p = 0.56
      let camShake = 0;
      if (p >= 0.56) {
        const rp = Math.min(1, (p - 0.56) / 0.22);
        const kick = Math.sin(rp * Math.PI) * 18;
        actorSpec.x += isHeroAtk ? kick : -kick;
        camShake = (1 - rp) * 7;
        const mPos = getMuzzlePos();
        this.fireOnce(`ranged_fire_sfx_${attackerSide}`, () => {
          // Authentic FD2 ranged launch SFX from unit's FIGANI bank (e.g., Celia bowstring `bank:50:2`, Beckwith `bank:51:4`, Mech gun `bank:51:1`)!
          const launchSfx: SfxKind = actorUnit.sfxProfile?.launchSfx ?? 'bank:50:2';
          this.sound.playSfx(launchSfx);
          this.spawnDustPlume(actorSpec.x, actorSpec.y, isHeroAtk ? 1 : -1, 0.2, 12);
          this.spawnImpactSparks(
            mPos.x,
            mPos.y,
            actorSpec.y,
            24,
            ['#ffffff', '#fde047', '#f59e0b', '#fb923c'],
            isHeroAtk ? -1 : 1,
            0
          );
        });
      }

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

      // Blazing crossbow bolt / arrow streaks out from per-unit `muzzleAnchor` off screen edge!
      if (p >= 0.56 && p <= 0.94) {
        const boltP = Math.min(1, (p - 0.56) / 0.22);
        const mPos = getMuzzlePos();
        const muzzleX = mPos.x;
        const muzzleY = mPos.y;
        const endX = isHeroAtk ? -160 : W + 160;
        const bx = muzzleX + (endX - muzzleX) * boltP;
        this.drawHdProjectile(ctx, bx, muzzleY, isHeroAtk ? -1 : 1, projectileType, 1.15);

        // Muzzle burst flash at launch moment
        if (boltP < 0.45) {
          const mf = 1 - boltP / 0.45;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          const grad = ctx.createRadialGradient(muzzleX, muzzleY, 4, muzzleX, muzzleY, 125 * mf + 20);
          grad.addColorStop(0, `rgba(255, 255, 240, ${0.95 * mf})`);
          grad.addColorStop(0.4, `rgba(253, 224, 71, ${0.65 * mf})`);
          grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(muzzleX, muzzleY, 125 * mf + 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
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

    const hitAt = 0.19;
    let camShake = 0;
    let camZoom = 1.04;
    let impactFlashAlpha = 0;
    let shockwaveProgress = -1;

    if (p3 >= hitAt) {
      const hp = (p3 - hitAt) / (1 - hitAt);
      this.fireOnce(`ranged_impact_${attackerSide}`, () => {
        // Authentic FD2 ranged impact SFX from unit's FIGANI bank (e.g., Celia arrow pierce `bank:50:1`, Sniper/Mech `bank:51:2`)!
        const hitList = actorUnit.sfxProfile?.hitSfxList ?? [];
        const hitSfx: SfxKind = hitList[0] ?? 'bank:50:1';
        this.sound.playSfx(hitSfx);
        if (this.config.enableHitStopAndSparks) {
          this.hitStopRemainingMs = isCrit ? 95 : 70;
        }
        this.spawnImpactSparks(
          impactX,
          impactY,
          targetHomeY,
          isCrit ? 85 : 58,
          ['#ffffff', '#fde047', '#f59e0b', '#ef4444', '#fb923c'],
          isHeroAtk ? -1 : 1,
          -0.25
        );
        this.spawnDustPlume(targetHomeX, targetHomeY, isHeroAtk ? -1 : 1, -0.2, 16);
        if (isHeroAtk) {
          this.banditTargetHp = Math.max(0, this.banditTargetHp - this.thorStrikeDmg);
        } else {
          this.thorTargetHp = Math.max(1, this.thorTargetHp - this.banditStrikeDmg);
        }
      });

      const recoil = Math.sin(Math.min(1, hp * 2.1) * Math.PI);
      const dir = isHeroAtk ? -1 : 1;
      targetSpec.x = targetHomeX + dir * recoil * 62;
      targetSpec.y = targetHomeY + dir * recoil * 18;
      targetSpec.rot = dir * recoil * 0.11;
      targetSpec.scaleX = 1.0 - recoil * 0.08;
      targetSpec.scaleY = 1.0 + recoil * 0.06;
      targetSpec.flashWhite = Math.max(0, 1 - hp * 3.2);
      impactFlashAlpha = Math.max(0, 1 - hp * 4.2);
      shockwaveProgress = Math.min(1, hp * 1.9);
      camZoom = 1.15 - hp * 0.11;
      camShake = this.config.enableHitStopAndSparks ? Math.max(0, (1 - hp * 2.4) * 24) : 0;
    }

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
      isHeroAtk ? 545 : 700
    );

    // Arriving HD projectile streaking in horizontally from the edge into the target's torso!
    if (p3 < hitAt) {
      const ap = p3 / hitAt;
      const startX = isHeroAtk ? W + 120 : -120;
      const bx = startX + (impactX - startX) * ap;
      this.drawHdProjectile(ctx, bx, impactY, isHeroAtk ? -1 : 1, projectileType, 1.25);
    } else if (p3 < hitAt + 0.16) {
      // Brief embedded/piercing bolt flash & starburst right on impact!
      const bp = (p3 - hitAt) / 0.16;
      const vibY = Math.sin(bp * 45) * 4 * (1 - bp);
      ctx.save();
      ctx.globalAlpha = 1 - bp;
      this.drawHdProjectile(ctx, targetSpec.x + (isHeroAtk ? 30 : -30), impactY + vibY, isHeroAtk ? -1 : 1, projectileType, 1.0);
      ctx.restore();
    }

    this.drawDustAndSparks(ctx);
    this.drawForegroundLeaves(ctx, targetBgId);
    ctx.restore();

    if ((this.hitStopRemainingMs > 0 || impactFlashAlpha > 0.05) && this.config.enableHitStopAndSparks) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const grad = ctx.createRadialGradient(impactX, impactY, 16, impactX, impactY, W * 0.65);
      const a = this.hitStopRemainingMs > 0 ? 0.55 : impactFlashAlpha * 0.45;
      grad.addColorStop(0, `rgba(255, 252, 220, ${a})`);
      grad.addColorStop(0.35, `rgba(245, 158, 11, ${a * 0.45})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

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
    const element = caster.magicElement ?? 'fire';
    const spellName = isEn
      ? (caster.magicNameEn ?? (element === 'holy' ? 'Holy Radiance' : element === 'fire' ? 'Flame Dragon' : 'Arcane Nova'))
      : (caster.magicNameZh ?? (element === 'holy' ? '聖光審判' : element === 'fire' ? '炎龍術' : '星辰秘法'));

    const srcMode = this.config.animSource;
    const casterPoses = this.getActivePoseList('thor');
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

      if (srcMode === 'omni_video') {
        this.setContinuousFrame(casterSpec, Math.min(casterMaxIdx, p * (casterMaxIdx + 0.4)), casterMaxIdx);
      } else if (srcMode === 'nb2_6frame') {
        this.setContinuousFrame(casterSpec, Math.min(5, p * 5.3), 5);
      } else {
        casterSpec.primaryIdx = p < 0.28 ? 0 : p < 0.62 ? 1 : 2;
      }

      if (p >= 0.48) {
        this.fireOnce('magic_chant_sfx', () => {
          this.sound.playSfx(caster.sfxProfile?.magicChantSfx ?? 'bank:83:0');
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
      this.renderCombatantWithBlend(ctx, casterPoses, casterSpec, element === 'holy' ? '#fde047' : '#f97316', 720);

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

    const hitTimes = element === 'holy' ? [420, 760] : [340, 580, 820];
    let activeRecoil = 0;
    let activeFlash = 0;
    let camShake = 0;
    let shockwaveProgress = -1;

    for (let hi = 0; hi < hitTimes.length; hi++) {
      const ht = hitTimes[hi];
      if (s2 >= ht) {
        const isLast = hi === hitTimes.length - 1;
        this.fireOnce(`magic_hit_${hi}`, () => {
          const mHits = caster.sfxProfile?.magicHitSfx ?? ['bank:83:1'];
          const mSfx: SfxKind = mHits[hi] ?? mHits[mHits.length - 1] ?? 'bank:83:1';
          this.sound.playSfx(mSfx);
          if (this.config.enableHitStopAndSparks && isLast) {
            this.hitStopRemainingMs = 75;
          }
          const pal =
            element === 'holy'
              ? ['#ffffff', '#fef08a', '#fde047', '#7dd3fc']
              : element === 'fire'
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

    const spellStart = 180;
    const spellEnd = 1220;
    const spellP = s2 >= spellStart && s2 <= spellEnd ? (s2 - spellStart) / (spellEnd - spellStart) : -1;

    const camZoom = 1.04 + (spellP >= 0 ? Math.sin(spellP * Math.PI) * 0.1 : 0);
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

    this.renderCombatantWithBlend(ctx, targetPoses, targetSpec, '#ef4444', 550);

    // Front-layer elemental spell pillar & vortex over Target!
    if (spellP >= 0) {
      this.drawModernSpellEffect(ctx, targetHomeX, targetHomeY, spellP, element);
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
        1 - b * 0.75,
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
        b,
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
        1.0,
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
    const bgX = -W * 0.06 + camX * pFactor;
    const bgY = -H * 0.06 + camY * pFactor;
    const bgW = W * 1.12;
    const bgH = H * 1.12;

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
    projectileType: 'bolt' | 'arrow' | 'beam' | 'orb'
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

    // Central glowing supersonic slipstream + large HD projectile tearing across the screen!
    const startX = dirX < 0 ? W * 0.96 : W * 0.04;
    const endX = dirX < 0 ? W * 0.04 : W * 0.96;
    const projX = startX + (endX - startX) * progress;
    const projY = H * 0.5 + Math.sin(progress * Math.PI * 4) * 4;

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
    ctx.lineTo(tailX, projY - 34);
    ctx.lineTo(tailX, projY + 34);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    this.drawHdProjectile(ctx, projX, projY, dirX, projectileType, 1.85);

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

  /** Draws a crisp HD painted crossbow bolt / arrow / beam with supersonic flare cone. */
  private drawHdProjectile(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    dirX: -1 | 1,
    projectileType: 'bolt' | 'arrow' | 'beam' | 'orb',
    scale = 1.0
  ): void {
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
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-180, -8, 250, 16);
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

  private drawGroundShadow(ctx: CanvasRenderingContext2D, x: number, y: number, radiusX: number): void {
    ctx.save();
    ctx.translate(x, y - 10);
    ctx.scale(1, 0.24);
    const grad = ctx.createRadialGradient(0, 0, radiusX * 0.1, 0, 0, radiusX);
    grad.addColorStop(0, 'rgba(5, 8, 6, 0.74)');
    grad.addColorStop(0.6, 'rgba(5, 8, 6, 0.36)');
    grad.addColorStop(1, 'rgba(5, 8, 6, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radiusX, 0, Math.PI * 2);
    ctx.fill();
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
