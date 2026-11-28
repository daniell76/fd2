/**
 * Authentic 2026 HD Spell & Summon Cutaway VFX Renderer (Phase B — all 25 FDOTHER.DAT strips).
 *
 * Covers the 10 cutaway attack spells (#00–#09, 19 strips `sp_018..sp_044`),
 * the 4 iconic full-screen summon cutaways (#32–#35, strips `sp_065..sp_068`),
 * and references the 2 cutscene strips (`sp_034` Crystal Beam, `sp_045` Golden Castle fade).
 *
 * Designed strictly for 1600×900 (or any scaled aspect ratio `W×H`) Canvas2D compositing with
 * hand-painted transparent HD sprites under `public/assets/hd_spells/*.webp` layered with
 * volumetric additive blooms, tapered lightning splines, and curved plasma beams.
 */

export const HD_SPELL_ASSET_VERSION = '?v=108';

export type HdSpellLayer = 'both' | 'behind' | 'front';

export interface HdSpellEntry {
  id: number;
  nameZh: string;
  nameEn: string;
  category: 'fire' | 'thunder' | 'holy' | 'dark' | 'summon';
  isSummon: boolean;
  dosEnemyStrip: number;
  dosHeroStrip: number;
  sfxBank: number;
  element: 'fire' | 'thunder' | 'holy' | 'arcane';
  /** Representative Stage 2 SFX cues (`bank:<chunk>:<sub>`) synced inside progress 0..1 */
  hitTimesMs: number[];
  /** Stage 2 animation window (ms) */
  durationMs: number;
  /** Optional key hand-painted asset relative path (under `assets/hd_spells/`) */
  paintedSprite?: string;
  secondarySprite?: string;
  /** Color flash / badge tint */
  accentColor: string;
  summaryZh: string;
  summaryEn: string;
}

export const HD_SPELL_CATALOG: HdSpellEntry[] = [
  {
    id: 0,
    nameZh: '火炎術',
    nameEn: 'Fireball',
    category: 'fire',
    isSummon: false,
    dosEnemyStrip: 18,
    dosHeroStrip: 20,
    sfxBank: 82,
    element: 'fire',
    hitTimesMs: [380, 680],
    durationMs: 1380,
    paintedSprite: 'fx_fire_pillar_red.webp',
    accentColor: '#fb923c',
    summaryZh: '7道交錯火柱：墜落火花 → 熔岩圓陣 → 手繪焰柱升空飛散 (sp_018/020)',
    summaryEn: '7 staggered rising flame pillars wrapping behind & ahead of target (sp_018/020)',
  },
  {
    id: 1,
    nameZh: '烈炎術',
    nameEn: 'Scorching Flame',
    category: 'fire',
    isSummon: false,
    dosEnemyStrip: 19,
    dosHeroStrip: 21,
    sfxBank: 82,
    element: 'fire',
    hitTimesMs: [280, 620, 960],
    durationMs: 1480,
    paintedSprite: 'fx_fire_pillar_blue.webp',
    secondarySprite: 'fx_fire_pillar_red.webp',
    accentColor: '#f97316',
    summaryZh: '8道藍白/赤紅交錯橢圓環陣包圍目標同時衝天 (sp_019/021)',
    summaryEn: '8 alternating blue & crimson inferno pillars forming a 360° ring (sp_019/021)',
  },
  {
    id: 2,
    nameZh: '炎龍術',
    nameEn: 'Flame Dragon',
    category: 'fire',
    isSummon: false,
    dosEnemyStrip: 26,
    dosHeroStrip: 27,
    sfxBank: 83,
    element: 'fire',
    hitTimesMs: [560, 860, 1140],
    durationMs: 1680,
    paintedSprite: 'spell_02_dragon.webp',
    secondarySprite: 'spell_02_breath.webp',
    accentColor: '#f59e0b',
    summaryZh: '3段式原版演繹：閉口降臨蓄勢盤旋 → 張口嘶吼4幀手繪龍息狂吐 → 咬合昂首飛昇 (sp_026/027)',
    summaryEn: '3-stage sp_026 sequence: closed-jaw swoop & coil → 4-frame animated breath → jaw-clamp ascent (sp_026/027)',
  },
  {
    id: 3,
    nameZh: '天火術',
    nameEn: "Heaven's Fire",
    category: 'fire',
    isSummon: false,
    dosEnemyStrip: 39,
    dosHeroStrip: 43,
    sfxBank: 84,
    element: 'fire',
    hitTimesMs: [280, 560, 860],
    durationMs: 1580,
    paintedSprite: 'fx_solar_beam_gold.webp',
    secondarySprite: 'fx_solar_beam_blue.webp',
    accentColor: '#ef4444',
    summaryZh: '12波斜向連襲：6發流星爆環交替3道蒼藍天火與3道金焰光束 (sp_039/043)',
    summaryEn: '12 staggered diagonal meteors alternating ice-blue & golden orbital beams (sp_039/043)',
  },
  {
    id: 4,
    nameZh: '電擊術',
    nameEn: 'Lightning Shock',
    category: 'thunder',
    isSummon: false,
    dosEnemyStrip: 22,
    dosHeroStrip: 23,
    sfxBank: 85,
    element: 'thunder',
    hitTimesMs: [240, 560, 880],
    durationMs: 1240,
    paintedSprite: 'fx_bolt_thin.webp',
    accentColor: '#a78bfa',
    summaryZh: '6道交錯裂閃紫電連劈，落地電芒回彈衝天 (sp_022/023)',
    summaryEn: '6 staggered forked violet whip-lightning bolts rebounding skyward (sp_022/023)',
  },
  {
    id: 5,
    nameZh: '落雷術',
    nameEn: 'Falling Bolt',
    category: 'thunder',
    isSummon: false,
    dosEnemyStrip: 24,
    dosHeroStrip: 25,
    sfxBank: 86,
    element: 'thunder',
    hitTimesMs: [220, 540, 880],
    durationMs: 1320,
    paintedSprite: 'fx_bolt_heavy.webp',
    secondarySprite: 'fx_thunder_crown.webp',
    accentColor: '#c084fc',
    summaryZh: '6道左右交替巨型折線紫雷，轟裂寬幅荊棘電冠衝擊波 (sp_024/025)',
    summaryEn: '6 alternating left/right heavy zig-zag violet thunderbolts with crown splashes (sp_024/025)',
  },
  {
    id: 6,
    nameZh: '轟雷術',
    nameEn: 'Thunder Storm',
    category: 'thunder',
    isSummon: false,
    dosEnemyStrip: 32,
    dosHeroStrip: 33,
    sfxBank: 87,
    element: 'thunder',
    hitTimesMs: [640, 860, 1080],
    durationMs: 1460,
    paintedSprite: 'fx_thunder_orb.webp',
    secondarySprite: 'fx_thunder_nova.webp',
    accentColor: '#8b5cf6',
    summaryZh: '5顆幽紫雷球3D螺旋繞身聚能 → 3連爆裂尖刺雷環 (sp_032/033)',
    summaryEn: '5 orbiting violet thunder spheres spiraling inward → 3 jagged nova detonations (sp_032/033)',
  },
  {
    id: 7,
    nameZh: '神雷術',
    nameEn: 'Divine Thunder',
    category: 'thunder',
    isSummon: false,
    dosEnemyStrip: 37,
    dosHeroStrip: 38,
    sfxBank: 88,
    element: 'thunder',
    hitTimesMs: [200, 520, 880],
    durationMs: 1380,
    paintedSprite: 'fx_divine_pillar.webp',
    accentColor: '#c4b5fd',
    summaryZh: '6道貫穿天地巨幅雷紫神柱連環轟擊收束 (sp_037/038)',
    summaryEn: '6 thick staggered vertical violet heavenly thunder columns (sp_037/038)',
  },
  {
    id: 8,
    nameZh: '聖光彈',
    nameEn: 'Holy Bolt',
    category: 'holy',
    isSummon: false,
    dosEnemyStrip: 28,
    dosHeroStrip: 30,
    sfxBank: 89,
    element: 'holy',
    hitTimesMs: [200, 480, 760, 1040],
    durationMs: 1440,
    paintedSprite: 'fx_holy_nova.webp',
    accentColor: '#fde047',
    summaryZh: '12發四向高速聖光穿空連射，空心蒼藍星環連續爆裂 (sp_028/030)',
    summaryEn: '12 rapid multi-angle holy lance strikes bursting into crystal star rings (sp_028/030)',
  },
  {
    id: 9,
    nameZh: '咒殺術',
    nameEn: 'Death Curse',
    category: 'dark',
    isSummon: false,
    dosEnemyStrip: 44,
    dosHeroStrip: 44,
    sfxBank: 90,
    element: 'arcane',
    hitTimesMs: [340, 760, 1080],
    durationMs: 1560,
    paintedSprite: 'spell_09_reaper.webp',
    secondarySprite: 'spell_09_skull.webp',
    accentColor: '#a3e635',
    summaryZh: '赤紅死神揮鐮斬裂 → 怨綠光柱升起嚎叫骷髏幽魂 (sp_044)',
    summaryEn: 'Crimson Grim Reaper scythe slash → cursed emerald pillar & wraith skull (sp_044)',
  },
  {
    id: 32,
    nameZh: '熾天使',
    nameEn: 'Seraph (Summon)',
    category: 'summon',
    isSummon: true,
    dosEnemyStrip: 65,
    dosHeroStrip: 65,
    sfxBank: 91,
    element: 'holy',
    hitTimesMs: [480, 820, 1120],
    durationMs: 1700,
    paintedSprite: 'summon_32_seraph.webp',
    accentColor: '#fef08a',
    summaryZh: '【召喚】六翼純白熾天使降臨，漫天湛藍神雷覆蓋全場 (sp_065)',
    summaryEn: '[Summon] Colossal white-winged Seraph shrouding the arena in lightning (sp_065)',
  },
  {
    id: 33,
    nameZh: '風妖精',
    nameEn: 'Wind Fairy (Summon)',
    category: 'summon',
    isSummon: true,
    dosEnemyStrip: 66,
    dosHeroStrip: 66,
    sfxBank: 92,
    element: 'holy',
    hitTimesMs: [650, 1100],
    durationMs: 1650,
    paintedSprite: 'summon_33_sylph.webp',
    accentColor: '#7dd3fc',
    summaryZh: '【召喚】冰髮羽翼風妖精凌空旋舞，湛藍光球淨化治癒全軍 (sp_066)',
    summaryEn: '[Summon] Ice-haired winged Sylph unleashing an expanding healing sky-orb (sp_066)',
  },
  {
    id: 34,
    nameZh: '破壞神',
    nameEn: 'Destroyer God (Summon)',
    category: 'summon',
    isSummon: true,
    dosEnemyStrip: 67,
    dosHeroStrip: 67,
    sfxBank: 93,
    element: 'fire',
    hitTimesMs: [620, 1080],
    durationMs: 1650,
    paintedSprite: 'summon_34_destroyer.webp',
    accentColor: '#f87171',
    summaryZh: '【召喚】赤甲犄角戰神策馬騰躍，腥紅戰意光球震撼蒼穹 (sp_067)',
    summaryEn: '[Summon] Horned crimson war god mounted on a rearing steed flaring a blood-nova (sp_067)',
  },
  {
    id: 35,
    nameZh: '暗邪鬼',
    nameEn: 'Dark Fiend (Summon)',
    category: 'summon',
    isSummon: true,
    dosEnemyStrip: 68,
    dosHeroStrip: 68,
    sfxBank: 94,
    element: 'arcane',
    hitTimesMs: [480, 860, 1140],
    durationMs: 1680,
    paintedSprite: 'summon_35_fiend.webp',
    secondarySprite: 'fx_curse_fog.webp',
    accentColor: '#84cc16',
    summaryZh: '【召喚】蒼藍巨腹暗邪鬼雙掌釋放劇毒翠綠瘴氣濃霧，施降全場異常狀態 (sp_068)',
    summaryEn: '[Summon] Towering blue fiend releasing rolling emerald debuff miasma fog (sp_068)',
  },
];

export function getHdSpellEntry(id: number): HdSpellEntry | undefined {
  return HD_SPELL_CATALOG.find((s) => s.id === id);
}

/** Picks an authentic signature HD spell ID for a hero caster in VFX Lab default mode (`auto`). */
export function defaultSpellIdForUnit(
  uid: number,
  element: 'fire' | 'holy' | 'thunder' | 'ice' | 'arcane',
  magicNameZh?: string
): number {
  const n = magicNameZh ?? '';
  if (n.includes('天火')) return 3;
  if (n.includes('烈炎')) return 1;
  if (n.includes('火炎')) return 0;
  if (n.includes('炎龍')) return 2;
  if (n.includes('神雷')) return 7;
  if (n.includes('轟雷')) return 6;
  if (n.includes('落雷')) return 5;
  if (n.includes('電擊')) return 4;
  if (n.includes('咒殺')) return 9;
  if (n.includes('熾天使')) return 32;
  if (n.includes('風妖精')) return 33;
  if (n.includes('破壞神')) return 34;
  if (n.includes('暗邪鬼')) return 35;
  if (uid === 52) return 32; // #052 悠妮 召喚師 -> 熾天使!
  if (uid === 41) return 3;  // #041 悠妮 大法師 -> 天火術!
  if (uid === 29) return 7;  // #029 亞齊梅吉 大法師 -> 神雷術!
  if (uid === 28) return 9;  // #028 達克塞 魔戰士 -> 咒殺術!
  if (uid === 24) return 33; // #024 希爾法 祭師 -> 風妖精!
  if (uid === 51) return 34; // #051 哈諾 魔戰士 -> 破壞神!
  if (uid === 53) return 33; // #053 哈瓦特 魔戰士 -> 風妖精!
  if (uid === 59) return 32; // #059 悠妮 聖者 -> 熾天使!
  if (element === 'fire') return 2;
  if (element === 'thunder') return 6;
  if (element === 'holy') return 8;
  return 9;
}

export interface HdSpellImageMap {
  dragon: HTMLImageElement | null;
  dragonClosed: HTMLImageElement | null;
  dragonBreath: HTMLImageElement | null;
  dragonBreath1: HTMLImageElement | null;
  dragonBreath2: HTMLImageElement | null;
  dragonBreath3: HTMLImageElement | null;
  reaper: HTMLImageElement | null;
  skull: HTMLImageElement | null;
  seraph: HTMLImageElement | null;
  sylph: HTMLImageElement | null;
  destroyer: HTMLImageElement | null;
  fiend: HTMLImageElement | null;
  firePillarRed: HTMLImageElement | null;
  firePillarBlue: HTMLImageElement | null;
  fireRing: HTMLImageElement | null;
  solarBeamBlue: HTMLImageElement | null;
  solarBeamGold: HTMLImageElement | null;
  boltThin: HTMLImageElement | null;
  boltHeavy: HTMLImageElement | null;
  thunderCrown: HTMLImageElement | null;
  thunderOrb: HTMLImageElement | null;
  thunderNova: HTMLImageElement | null;
  holyNova: HTMLImageElement | null;
  divinePillar: HTMLImageElement | null;
  curseFog: HTMLImageElement | null;
}

const spellImages: HdSpellImageMap = {
  dragon: null,
  dragonClosed: null,
  dragonBreath: null,
  dragonBreath1: null,
  dragonBreath2: null,
  dragonBreath3: null,
  reaper: null,
  skull: null,
  seraph: null,
  sylph: null,
  destroyer: null,
  fiend: null,
  firePillarRed: null,
  firePillarBlue: null,
  fireRing: null,
  solarBeamBlue: null,
  solarBeamGold: null,
  boltThin: null,
  boltHeavy: null,
  thunderCrown: null,
  thunderOrb: null,
  thunderNova: null,
  holyNova: null,
  divinePillar: null,
  curseFog: null,
};

let loadStartedVersion = '';
let loadPromise: Promise<HdSpellImageMap> | null = null;
/** Reusable offscreen layer for soft feathered eruption/cutoff wipes on #02 Flame Dragon & column spells. */
let breathMaskCanvas: HTMLCanvasElement | null = null;

function acquireMaskCanvas(W: number, H: number): { canvas: HTMLCanvasElement; mctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  if (!breathMaskCanvas) breathMaskCanvas = document.createElement('canvas');
  const iw = Math.max(1, Math.ceil(W));
  const ih = Math.max(1, Math.ceil(H));
  // Grow-only so successive staggered pillars never thrash GPU texture allocations
  if (breathMaskCanvas.width < iw) breathMaskCanvas.width = iw;
  if (breathMaskCanvas.height < ih) breathMaskCanvas.height = ih;
  const mctx = breathMaskCanvas.getContext('2d');
  if (!mctx) return null;
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  mctx.globalCompositeOperation = 'source-over';
  mctx.globalAlpha = 1;
  mctx.clearRect(0, 0, iw, ih);
  return { canvas: breathMaskCanvas, mctx };
}

function loadOptImg(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0 ? img : null);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function ensureHdSpellAssets(versionTag: string = HD_SPELL_ASSET_VERSION): Promise<HdSpellImageMap> {
  if (loadPromise && loadStartedVersion === versionTag) return loadPromise;
  loadStartedVersion = versionTag;
  const base = 'assets/hd_spells';
  loadPromise = Promise.all([
    loadOptImg(`${base}/spell_02_dragon.webp${versionTag}`),
    loadOptImg(`${base}/spell_02_dragon_closed.webp${versionTag}`),
    loadOptImg(`${base}/spell_02_breath.webp${versionTag}`),
    loadOptImg(`${base}/spell_02_breath_1.webp${versionTag}`),
    loadOptImg(`${base}/spell_02_breath_2.webp${versionTag}`),
    loadOptImg(`${base}/spell_02_breath_3.webp${versionTag}`),
    loadOptImg(`${base}/spell_09_reaper.webp${versionTag}`),
    loadOptImg(`${base}/spell_09_skull.webp${versionTag}`),
    loadOptImg(`${base}/summon_32_seraph.webp${versionTag}`),
    loadOptImg(`${base}/summon_33_sylph.webp${versionTag}`),
    loadOptImg(`${base}/summon_34_destroyer.webp${versionTag}`),
    loadOptImg(`${base}/summon_35_fiend.webp${versionTag}`),
    loadOptImg(`${base}/fx_fire_pillar_red.webp${versionTag}`),
    loadOptImg(`${base}/fx_fire_pillar_blue.webp${versionTag}`),
    loadOptImg(`${base}/fx_fire_ring.webp${versionTag}`),
    loadOptImg(`${base}/fx_solar_beam_blue.webp${versionTag}`),
    loadOptImg(`${base}/fx_solar_beam_gold.webp${versionTag}`),
    loadOptImg(`${base}/fx_bolt_thin.webp${versionTag}`),
    loadOptImg(`${base}/fx_bolt_heavy.webp${versionTag}`),
    loadOptImg(`${base}/fx_thunder_crown.webp${versionTag}`),
    loadOptImg(`${base}/fx_thunder_orb.webp${versionTag}`),
    loadOptImg(`${base}/fx_thunder_nova.webp${versionTag}`),
    loadOptImg(`${base}/fx_holy_nova.webp${versionTag}`),
    loadOptImg(`${base}/fx_divine_pillar.webp${versionTag}`),
    loadOptImg(`${base}/fx_curse_fog.webp${versionTag}`),
  ]).then(
    ([
      dragon,
      dragonClosed,
      dragonBreath,
      dragonBreath1,
      dragonBreath2,
      dragonBreath3,
      reaper,
      skull,
      seraph,
      sylph,
      destroyer,
      fiend,
      firePillarRed,
      firePillarBlue,
      fireRing,
      solarBeamBlue,
      solarBeamGold,
      boltThin,
      boltHeavy,
      thunderCrown,
      thunderOrb,
      thunderNova,
      holyNova,
      divinePillar,
      curseFog,
    ]) => {
      spellImages.dragon = dragon;
      spellImages.dragonClosed = dragonClosed;
      spellImages.dragonBreath = dragonBreath;
      spellImages.dragonBreath1 = dragonBreath1;
      spellImages.dragonBreath2 = dragonBreath2;
      spellImages.dragonBreath3 = dragonBreath3;
      spellImages.reaper = reaper;
      spellImages.skull = skull;
      spellImages.seraph = seraph;
      spellImages.sylph = sylph;
      spellImages.destroyer = destroyer;
      spellImages.fiend = fiend;
      spellImages.firePillarRed = firePillarRed;
      spellImages.firePillarBlue = firePillarBlue;
      spellImages.fireRing = fireRing;
      spellImages.solarBeamBlue = solarBeamBlue;
      spellImages.solarBeamGold = solarBeamGold;
      spellImages.boltThin = boltThin;
      spellImages.boltHeavy = boltHeavy;
      spellImages.thunderCrown = thunderCrown;
      spellImages.thunderOrb = thunderOrb;
      spellImages.thunderNova = thunderNova;
      spellImages.holyNova = holyNova;
      spellImages.divinePillar = divinePillar;
      spellImages.curseFog = curseFog;
      return spellImages;
    }
  );
  return loadPromise;
}

export function getLoadedHdSpellAssets(): HdSpellImageMap {
  return spellImages;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Deterministic pseudo-random jitter in [-1, 1] for crisp jagged anime lightning. */
function hash1(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

/** Draw one tapered multi-layered jagged anime lightning bolt spline between `(x0,y0) -> (x1,y1)`. */
function drawLightningBolt(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  widthOuter: number,
  jitterAmt: number,
  segs: number,
  seed: number,
  outerRgba: string,
  midRgba: string,
  coreRgba: string,
  branches = 0
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / len;
  const ny = dx / len;
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const taper = i === 0 || i === segs ? 0 : Math.sin(u * Math.PI);
    const j = hash1(seed + i * 19.3) * jitterAmt * (0.45 + 0.55 * taper);
    pts.push({
      x: x0 + dx * u + nx * j,
      y: y0 + dy * u + ny * j,
    });
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const strokePath = (ps: Array<{ x: number; y: number }>, w: number, col: string) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(0.8, w);
    ctx.beginPath();
    ps.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
  };
  strokePath(pts, widthOuter, outerRgba);
  strokePath(pts, widthOuter * 0.48, midRgba);
  strokePath(pts, widthOuter * 0.19, coreRgba);

  for (let b = 0; b < branches; b++) {
    const bi = Math.max(1, Math.min(segs - 1, Math.floor(((b + 1) / (branches + 1)) * segs)));
    const origin = pts[bi];
    const side = b % 2 === 0 ? 1 : -1;
    const bLen = len * (0.22 + 0.12 * Math.abs(hash1(seed + b * 41)));
    const ex = origin.x + (dx / len) * bLen * 0.55 + nx * side * bLen * 0.72;
    const ey = origin.y + (dy / len) * bLen * 0.55 + ny * side * bLen * 0.72;
    const sub: Array<{ x: number; y: number }> = [origin];
    for (let s = 1; s <= 4; s++) {
      const su = s / 4;
      const sj = s === 4 ? 0 : hash1(seed * 3.1 + b * 17 + s * 9.7) * jitterAmt * 0.45;
      sub.push({
        x: origin.x + (ex - origin.x) * su + nx * sj,
        y: origin.y + (ey - origin.y) * su + ny * sj,
      });
    }
    strokePath(sub, widthOuter * 0.42, outerRgba);
    strokePath(sub, widthOuter * 0.13, coreRgba);
  }
}

/** Tapered multi-point anime starburst diamond halo (`NO boxy bars!`). */
function drawTaperedStarburst(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  rays: number,
  rot: number,
  outerRgba: string,
  coreRgba: string
): void {
  if (radius <= 2) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.beginPath();
  const total = rays * 2;
  for (let i = 0; i < total; i++) {
    const ang = (i / total) * Math.PI * 2;
    const isTip = i % 2 === 0;
    const r = isTip ? radius * (i % 4 === 0 ? 1.0 : 0.66) : radius * 0.16;
    const x = Math.cos(ang) * r;
    const y = Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(0, 0, 1, 0, 0, radius);
  g.addColorStop(0, coreRgba);
  g.addColorStop(0.42, outerRgba);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

/** Volumetric billowing radial-gradient flame pillar (silky smooth turbulent plumes, zero flat polygon edges). */
function drawOrganicFlamePillar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  groundY: number,
  height: number,
  halfW: number,
  progress: number,
  palette: { outer: string; mid: string; core: string; hot: string },
  alpha: number
): void {
  if (height <= 4 || alpha <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const puffs = 16;
  // Subtle deep orange-crimson silhouette haze under-layer so flames stay vivid over bright daylight grass
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i <= puffs; i += 2) {
    const u = i / puffs;
    const py = groundY - u * height;
    const wobble = Math.sin(u * 8.5 - progress * 20 + i * 0.4) * halfW * 0.22 * (0.2 + u * 0.8);
    const px = cx + wobble;
    const rFactor = Math.sin(Math.min(1, u * 0.88 + 0.08) * Math.PI * 0.78) * (1 - u * 0.45);
    const rad = Math.max(18, halfW * (0.64 + 0.85 * rFactor));
    const g = ctx.createRadialGradient(px, py, rad * 0.08, px, py, rad);
    g.addColorStop(0, palette.mid);
    g.addColorStop(0.55, palette.outer);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = clamp01(alpha * (1 - u * 0.35) * 0.46);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'screen';
  // Soft vertical atmospheric bloom column (fades cleanly radially to zero on all sides!)
  for (let i = 0; i <= puffs; i++) {
    const u = i / puffs;
    const py = groundY - u * height;
    const wobble = Math.sin(u * 8.5 - progress * 20 + i * 0.4) * halfW * 0.22 * (0.2 + u * 0.8);
    const px = cx + wobble;
    const rFactor = Math.sin(Math.min(1, u * 0.88 + 0.08) * Math.PI * 0.78) * (1 - u * 0.48);
    const rad = Math.max(16, halfW * (0.58 + 0.92 * rFactor));
    const pAlpha = alpha * (1 - u * 0.36);

    const g = ctx.createRadialGradient(px, py, rad * 0.04, px, py, rad);
    g.addColorStop(0, palette.hot);
    g.addColorStop(0.24, palette.core);
    g.addColorStop(0.55, palette.mid);
    g.addColorStop(0.82, palette.outer);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = clamp01(pAlpha * 0.52);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Rolling twin spiral licking flame tongues rising around the column (smooth quadratic Bezier strokes w/ glowing width taper)
  for (let i = 0; i < 12; i++) {
    const u = ((progress * 1.65 + i / 12) % 1);
    const ang = u * Math.PI * 4.5 + i * 1.1;
    const orbit = halfW * (0.55 + 0.45 * Math.sin(u * Math.PI));
    const fx = cx + Math.cos(ang) * orbit;
    const fy = groundY - u * height * 0.96;
    const fr = halfW * (0.24 + 0.24 * Math.sin(u * Math.PI)) * (1 - u * 0.45);
    const fg = ctx.createRadialGradient(fx, fy, 1, fx, fy, Math.max(6, fr));
    fg.addColorStop(0, palette.hot);
    fg.addColorStop(0.45, palette.core);
    fg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = clamp01(alpha * Math.sin(u * Math.PI) * 0.72);
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(fx, fy, Math.max(6, fr), 0, Math.PI * 2);
    ctx.fill();
  }

  // Rising glowing ember sparks drifting smoothly upward
  for (let s = 0; s < 14; s++) {
    const su = ((progress * 2.1 + s * 0.071) % 1);
    const sx = cx + Math.sin(s * 9.3 + su * 6.5) * halfW * 1.05;
    const sy = groundY - su * height * 1.08;
    const sr = Math.max(2, (3 + (s % 3) * 1.8) * (1 - su * 0.5));
    ctx.globalAlpha = clamp01(alpha * (1 - su) * 0.92);
    ctx.fillStyle = palette.hot;
    ctx.beginPath();
    ctx.ellipse(sx, sy, sr * 0.7, sr * 2.4, Math.sin(s * 3.1) * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Renders ONE authentic 1995 `sp_018 / sp_019` rising vertical fire pillar cycle (`localF` in `0..16`):
 *   - `F0..F4` (`0..4.5`): Razor blazing spark needle shoots vertically from sky DOWN INTO ground (`tail chases tip into floor!`).
 *   - `F5..F8` (`4.2..8.8`): Elliptical glowing magma / ice-blue plasma caldera puddle widens on ground `gy`.
 *   - `F9..F12` (`8.0..12.4`): Pillar EMERGES STRAIGHT UP OUT OF GROUND `gy` (un-squashed, rising via crisp floor clip!).
 *   - `F13..F15` (`12.4..16`): Pillar DETACHES from ground `gy` & ROCKETS FULL-BRIGHTNESS STRAIGHT UP OFF TOP SCREEN EDGE `y=0`!
 */
function drawFirePillarInstance(
  ctx: CanvasRenderingContext2D,
  x: number,
  gy: number,
  localF: number,
  totalF: number,
  maxH: number,
  width: number,
  isBlue: boolean,
  img: HTMLImageElement | null,
  sc: number,
  flipX: boolean,
  alphaScale = 1.0
): void {
  if (localF < 0 || localF >= totalF) return;
  const isFullSky = totalF <= 15; // #01 sp_019 pierces ALL THE WAY off sky edge (`y=0..154`), #00 sp_018 ~60% compact torch!

  // 1) F00..F04: Razor blazing needle drops from top edge straight DOWN INTO ground `gy`!
  //    F00..F01 nose hits ground; F02..F04 tail plunges down and drains right INTO the ground impact dot!
  if (localF < 4.9) {
    const t = localF / 4.9;
    const headY = t < 0.28 ? (t / 0.28) * gy : gy;
    const tailY = t < 0.22 ? -24 * sc : Math.pow((t - 0.22) / 0.78, 1.35) * (gy - 6 * sc);
    const tailLen = Math.max(0, headY - tailY);
    if (tailLen > 2) {
      const a = t > 0.84 ? clamp01((1 - t) / 0.16) : 1;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const ng = ctx.createLinearGradient(x, tailY, x, headY);
      ng.addColorStop(0, 'rgba(0,0,0,0)');
      ng.addColorStop(0.55, isBlue ? `rgba(56,189,248,${0.92 * a * alphaScale})` : `rgba(249,115,22,${0.92 * a * alphaScale})`);
      ng.addColorStop(1, `rgba(255,255,245,${a * alphaScale})`);
      ctx.strokeStyle = ng;
      ctx.lineCap = 'round';
      ctx.lineWidth = (isBlue ? 12 : 10) * sc * (1 - Math.max(0, t - 0.65) * 1.4);
      ctx.beginPath();
      ctx.moveTo(x, tailY);
      ctx.lineTo(x, headY);
      ctx.stroke();
      drawTaperedStarburst(
        ctx,
        x,
        headY,
        (t < 0.35 ? 28 : 22) * sc * a,
        4,
        0,
        isBlue ? 'rgba(96,165,250,0.92)' : 'rgba(251,146,60,0.92)',
        '#ffffff'
      );
      ctx.restore();
    }
  }

  // 2) F05..F08 (+ lingering glow through F12): Molten circular puddle widening on floor `gy` BEFORE pillar erupts!
  if (localF >= 4.2 && localF < 13.0) {
    const enterP = clamp01((localF - 4.2) / 1.8);
    const fadeP = localF > 11.4 ? clamp01((13.0 - localF) / 1.6) : 1;
    const pulse = 1 + Math.sin(localF * 3.4) * 0.08;
    const rad = width * (0.28 + 0.56 * Math.sin(enterP * Math.PI * 0.5)) * pulse;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.translate(x, gy);
    ctx.scale(1, 0.29);
    const dg = ctx.createRadialGradient(0, 0, 2, 0, 0, Math.max(8, rad));
    if (isBlue) {
      dg.addColorStop(0, `rgba(240,249,255,${0.95 * fadeP * alphaScale})`);
      dg.addColorStop(0.45, `rgba(56,189,248,${0.84 * fadeP * alphaScale})`);
      dg.addColorStop(0.85, `rgba(37,99,235,${0.50 * fadeP * alphaScale})`);
    } else {
      dg.addColorStop(0, `rgba(255,248,200,${0.95 * fadeP * alphaScale})`);
      dg.addColorStop(0.45, `rgba(249,115,22,${0.84 * fadeP * alphaScale})`);
      dg.addColorStop(0.85, `rgba(220,38,38,${0.54 * fadeP * alphaScale})`);
    }
    dg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 3) F09..F15: Authentic DOS bottom-up EMERGENCE -> SUSTAIN -> ROCKETING SKYWARD OFF TOP EDGE!
  const eruptStart = 7.6;
  if (localF >= eruptStart) {
    // Rise straight OUT of the ground plane `gy` (zero squashing distortion!)
    const surgeT = clamp01((localF - eruptStart) / (isFullSky ? 2.1 : 1.7));
    const liftStart = isFullSky ? 12.0 : 12.15;
    const liftT = localF > liftStart ? clamp01((localF - liftStart) / (totalF - liftStart)) : 0;

    // Exact height of the flame body when fully emerged (`sp_018`: compact blazing plume; `sp_019`: sky-high column!)
    const fullColH = isFullSky ? Math.max(maxH, gy + 120 * sc) : maxH;
    // As pillar emerges (`surgeT: 0 -> 1`), it physically slides UP from beneath floor `gy` (`clipped strictly above `gy`!`).
    const riseOff = (1 - Math.sin(surgeT * Math.PI * 0.5)) * fullColH * 0.86;
    // As pillar exits (`liftT: 0 -> 1`), its bottom base DETACHES off floor `gy` and accelerates straight ABOVE `y = 0`!
    const flyEase = liftT > 0 ? Math.pow(liftT, 1.18) : 0;
    const bottomY = gy + riseOff - flyEase * (gy + (isFullSky ? 110 : 80) * sc);
    const topY = bottomY - fullColH;
    const pulseW = width * (1 + Math.sin(localF * 3.1) * 0.065) * (1 - flyEase * 0.14);
    // Keep blazing bright alpha all the way while flying upward off screen! Only gentle soft alpha entry & sky exit!
    const fadeAlpha =
      localF < eruptStart + 0.55
        ? (localF - eruptStart) / 0.55
        : liftT > 0.82
          ? clamp01((1 - liftT) / 0.18)
          : 1;

    if (bottomY > -40 * sc && fadeAlpha > 0.01) {
      ctx.save();
      // Hard floor horizon clip so emerging column literally erupts *out of* the magma puddle at `gy`!
      ctx.beginPath();
      ctx.rect(x - pulseW * 1.6, -260 * sc, pulseW * 3.2, gy + 275 * sc);
      ctx.clip();

      if (img && img.naturalWidth > 0) {
        const midY = topY + fullColH * 0.5;
        // Soft fiery atmospheric glow climbing right alongside the flying column
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const glowTop = Math.max(-200 * sc, midY);
        const glowR = Math.max(pulseW * 0.9, fullColH * 0.30);
        const bgG = ctx.createRadialGradient(x, glowTop, pulseW * 0.05, x, glowTop, glowR);
        bgG.addColorStop(0, isBlue ? `rgba(186,230,253,${0.48 * fadeAlpha * alphaScale})` : `rgba(254,215,102,${0.48 * fadeAlpha * alphaScale})`);
        bgG.addColorStop(0.55, isBlue ? `rgba(37,99,235,${0.25 * fadeAlpha * alphaScale})` : `rgba(220,38,38,${0.28 * fadeAlpha * alphaScale})`);
        bgG.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bgG;
        ctx.beginPath();
        ctx.ellipse(x, glowTop, pulseW * 0.92, fullColH * 0.54, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.translate(x, midY);
        if (flipX) ctx.scale(-1, 1);
        // Subtle vertical rising turbulence wave while firing so edges dance actively upward!
        const jitterY = Math.sin(localF * 6.0) * 10 * sc;
        ctx.globalAlpha = clamp01(fadeAlpha * alphaScale * 0.98);
        ctx.drawImage(img, -pulseW * 0.5, -fullColH * 0.5 + jitterY, pulseW, fullColH);
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = clamp01(fadeAlpha * alphaScale * 0.44);
        ctx.drawImage(img, -pulseW * 0.47, -fullColH * 0.52 - jitterY * 0.8, pulseW * 0.94, fullColH * 1.04);
        ctx.restore();

        // Crisp glowing jagged white-hot tail teeth under the lifting column base (matching `dos_sp_18 F13..F15`!)
        if (liftT > 0.02 && bottomY < gy) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          const tailH = 120 * sc * (1 - liftT * 0.35);
          const tg = ctx.createLinearGradient(x, bottomY - 30 * sc, x, bottomY + tailH);
          tg.addColorStop(0, isBlue ? `rgba(224,242,254,${0.86 * fadeAlpha})` : `rgba(255,250,210,${0.88 * fadeAlpha})`);
          tg.addColorStop(0.42, isBlue ? `rgba(56,189,248,${0.62 * fadeAlpha})` : `rgba(249,115,22,${0.62 * fadeAlpha})`);
          tg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = tg;
          ctx.beginPath();
          const hw = pulseW * 0.42;
          ctx.moveTo(x - hw, bottomY - 12 * sc);
          ctx.lineTo(x - hw * 0.65, bottomY + tailH * 0.72);
          ctx.lineTo(x - hw * 0.25, bottomY + tailH * 0.22);
          ctx.lineTo(x, bottomY + tailH);
          ctx.lineTo(x + hw * 0.28, bottomY + tailH * 0.28);
          ctx.lineTo(x + hw * 0.68, bottomY + tailH * 0.78);
          ctx.lineTo(x + hw, bottomY - 12 * sc);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      } else {
        drawOrganicFlamePillar(
          ctx,
          x,
          bottomY,
          fullColH,
          pulseW * 0.4,
          localF * 0.08,
          isBlue
            ? { outer: 'rgba(37,99,235,0.52)', mid: 'rgba(56,189,248,0.78)', core: 'rgba(224,242,254,0.92)', hot: 'rgba(255,255,255,0.98)' }
            : { outer: 'rgba(220,38,38,0.52)', mid: 'rgba(249,115,22,0.78)', core: 'rgba(254,215,102,0.9)', hot: 'rgba(255,252,235,0.96)' },
          fadeAlpha * alphaScale
        );
      }

      // Trailing falling/lingering glowing embers peeling beneath the rising base (`F13..F15`!)
      if (liftT > 0.02 && bottomY < gy + 20 * sc) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (let s = 0; s < 9; s++) {
          const sx = x + Math.sin(s * 4.9 + localF * 1.9) * pulseW * 0.44;
          const sy = bottomY + (8 + s * 28 + Math.sin(s * 7.3) * 16) * sc;
          if (sy <= gy + 8 * sc && sy >= -30 * sc) {
            const sa = clamp01((1 - s / 9) * fadeAlpha * 0.92);
            ctx.fillStyle = isBlue ? `rgba(224,242,254,${sa})` : `rgba(254,240,138,${sa})`;
            ctx.beginPath();
            ctx.ellipse(sx, sy, (2.6 + (s % 2) * 1.5) * sc, (7.5 + (s % 3) * 3.5) * sc, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }
      ctx.restore();
    }
  }
}

/**
 * Draw authentic HD Stage 2 cutaway spell / summon VFX for any of the 14 FDOTHER.DAT spells.
 * Supports true 3D depth separation (`layer: 'behind' | 'front' | 'both'`) so rising pillars
 * and orbiting plasma spheres wrap cleanly BOTH behind and in front of the defending combatant!
 * `progress` runs `0..1` inside the active spell window.
 */
export function drawHdSpellEffect(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  spellId: number,
  targetX: number,
  groundY: number,
  progress: number,
  targetIsHeroSide = false,
  imgs: HdSpellImageMap = spellImages,
  layer: HdSpellLayer = 'both'
): void {
  const p = clamp01(progress);
  if (p <= 0 || p >= 1) return;
  const sc = W / 1600; // resolution-independent factor (1.0 on 1600×900, 1.2 on 1920×1200!)
  const dosX = W / 320; // exact DOS 320x200 offset scale
  const dosY = H / 200;
  const dir = targetIsHeroSide ? -1 : 1; // polarity mirror between enemyStrip vs heroStrip!
  const drawBehind = layer === 'both' || layer === 'behind';
  const drawFront = layer === 'both' || layer === 'front';

  ctx.save();

  // =========================================================================
  // #00 火炎術 Fireball (sp_018 / sp_020) — Exact FD2 7 staggered rising flame pillars!
  // =========================================================================
  if (spellId === 0) {
    // Authentic `GLOBAL_9145[0]` (`xs = [40, 70, 120, 80, 50, 100, 70]` centered on `80`!)
    const dxOffs = [-40, -10, 40, 0, -30, 20, -10];
    const dyOffs = [0, -10, -20, 0, -15, -5, 0];
    const behindFlags = [false, false, true, false, true, false, false];
    if (drawBehind) {
      const dimA = Math.sin(p * Math.PI) * 0.24;
      ctx.fillStyle = `rgba(30, 8, 4, ${dimA})`;
      ctx.fillRect(0, 0, W, H);
    }
    const tick = p * 28;
    for (let k = 0; k < 7; k++) {
      const isBehind = behindFlags[k];
      if (isBehind && !drawBehind) continue;
      if (!isBehind && !drawFront) continue;
      const localF = tick - 2 * k;
      if (localF < 0 || localF >= 16) continue;
      const px = targetX + dxOffs[k] * dosX * 0.92 * dir;
      const py = groundY + dyOffs[k] * dosY * 0.9;
      drawFirePillarInstance(
        ctx,
        px,
        py,
        localF,
        16,
        (isBehind ? 560 : 620) * sc,
        (isBehind ? 195 : 225) * sc,
        false,
        imgs.firePillarRed,
        sc,
        k % 2 === 1,
        isBehind ? 0.90 : 0.98
      );
    }
    ctx.restore();
    return;
  }

  // =========================================================================
  // #01 烈炎術 Scorching Flame (sp_019 / sp_021) — Exact FD2 8-pillar alternating BLUE + RED elliptical cage!
  // =========================================================================
  if (spellId === 1) {
    // Exact `GLOBAL_9145[1]` ring around target (`k=0..3` blue back + red front; `k=4..7` red back + blue front!)
    const xOff = [-59, -39, 0, 39, 55, 39, 0, -39];
    const yOff = [-10, -24, -30, -24, -10, 4, 10, 4];
    if (drawBehind) {
      const dimA = Math.sin(p * Math.PI) * 0.34;
      ctx.fillStyle = `rgba(12, 10, 28, ${dimA})`;
      ctx.fillRect(0, 0, W, H);
    }
    const tick = p * 31;
    for (let k = 0; k < 8; k++) {
      const localF = tick - 2 * k;
      if (localF < 0 || localF >= 15) continue;
      const isBackBlue = k < 4;
      const posBlue = k;
      const posRed = (k + 4) % 8;

      if (isBackBlue) {
        if (drawBehind) {
          drawFirePillarInstance(
            ctx,
            targetX + xOff[posBlue] * dosX * 0.78 * dir,
            groundY + yOff[posBlue] * dosY * 0.95,
            localF,
            15,
            Math.max(680 * sc, H * 0.86),
            205 * sc,
            true,
            imgs.firePillarBlue,
            sc,
            k % 2 === 1,
            0.90
          );
        }
        if (drawFront) {
          drawFirePillarInstance(
            ctx,
            targetX + xOff[posRed] * dosX * 0.78 * dir,
            groundY + yOff[posRed] * dosY * 0.95,
            localF,
            15,
            Math.max(720 * sc, H * 0.92),
            220 * sc,
            false,
            imgs.firePillarRed,
            sc,
            k % 2 === 0,
            0.98
          );
        }
      } else {
        if (drawBehind) {
          drawFirePillarInstance(
            ctx,
            targetX + xOff[posRed] * dosX * 0.78 * dir,
            groundY + yOff[posRed] * dosY * 0.95,
            localF,
            15,
            Math.max(680 * sc, H * 0.86),
            205 * sc,
            false,
            imgs.firePillarRed,
            sc,
            k % 2 === 1,
            0.90
          );
        }
        if (drawFront) {
          drawFirePillarInstance(
            ctx,
            targetX + xOff[posBlue] * dosX * 0.78 * dir,
            groundY + yOff[posBlue] * dosY * 0.95,
            localF,
            15,
            Math.max(720 * sc, H * 0.92),
            220 * sc,
            true,
            imgs.firePillarBlue,
            sc,
            k % 2 === 0,
            0.98
          );
        }
      }
    }
    ctx.restore();
    return;
  }

  // =========================================================================
  // #02 炎龍術 Flame Dragon (sp_026 / sp_027) — Authentic 3-Stage Sequence!
  //   Stage 1 (p=0.00..0.28): Closed-jaw entrance swoop (`F00-F04`) -> high coil inhale (`F05-F08`) -> lunge & snap open (`F09->F15`).
  //   Stage 2 (p=0.28..0.79): Rapid 4-frame hand-painted roaring breath cycle (`f16 barrel -> c wave -> f17 -> f18 whip`) + sliding fire churn eddies & flying crescent embers!
  //   Stage 3 (p=0.79..1.00): Throat-first breath cutoff -> jaw snaps shut (`F10-F11`) -> dragon soars up-right off top edge (`F12-F14`).
  // =========================================================================
  if (spellId === 2) {
    const scrimFade =
      p < 0.10 ? p / 0.10 : p > 0.86 ? clamp01((1 - p) / 0.14) : 1;
    // Slight warm twilight backdrop tint drawn behind the defending sprite when layered
    if (drawBehind) {
      ctx.fillStyle = `rgba(24, 7, 4, ${0.44 * scrimFade})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (!drawFront) {
      ctx.restore();
      return;
    }

    const smoothStep = (t: number) => {
      const c = clamp01(t);
      return c * c * (3 - 2 * c);
    };

    // When only single-pass (`layer === 'both'`), `drawBehind` already painted the scrim above.
    ctx.save();
    // Mirror horizontally when an enemy casts Flame Dragon back at a hero (sp_027)!
    if (targetIsHeroSide) {
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
    }

    const dOpen = imgs.dragon;
    const dClosed = imgs.dragonClosed ?? dOpen;
    const dw = 820 * sc;
    const dh =
      dOpen && dOpen.naturalWidth > 0
        ? (dw * dOpen.naturalHeight) / dOpen.naturalWidth
        : 651 * sc;
    // Slight vertical shift on taller 16:10 canvas (`1920x1200` battleStage) to frame dragon breath majestically
    const aspectDrop = Math.max(0, (H - 900 * sc) * 0.24);
    const baseDx = W - dw + 48 * sc;
    const baseDy = 10 * sc + aspectDrop;

    // ------------------------------------------------------------------
    // Compute dragon head offset, tilt, and jaw open state (DOS sp_026!)
    // ------------------------------------------------------------------
    let offX = 0;
    let offY = 0;
    let headRot = 0;
    let openMix = 0; // 0 = closed jaw (`spell_02_dragon_closed.webp`), 1 = wide open roar (`spell_02_dragon.webp`)
    let headAlpha = 1;

    if (p < 0.11) {
      // F00..F04: Closed-jaw head swoops down-left from far right edge
      const t = 1 - Math.pow(1 - p / 0.11, 2.4);
      offX = (1 - t) * 600 * sc + 30 * sc;
      offY = (1 - t) * 32 * sc + 8 * sc;
      headRot = (1 - t) * 0.06;
      headAlpha = clamp01(p / 0.04);
    } else if (p < 0.18) {
      // F05..F07: Dragon recoils HIGH UP & right to coil and draw breath
      const t = smoothStep((p - 0.11) / 0.07);
      offX = 30 * sc + t * 92 * sc;
      offY = 8 * sc - t * 170 * sc;
      headRot = -t * 0.072;
    } else if (p < 0.235) {
      // F08 (`d=7` hover coil!): Poised high near upper screen margin inhaling fire
      const ht = (p - 0.18) / 0.055;
      offX = 122 * sc + Math.sin(ht * Math.PI) * 14 * sc;
      offY = -162 * sc - Math.sin(ht * Math.PI) * 16 * sc + Math.sin(ht * Math.PI * 6) * 2.5 * sc;
      headRot = -0.072 - Math.sin(ht * Math.PI) * 0.018;
    } else if (p < 0.285) {
      // F09 -> F15: Fierce downward lunge back into firing pose & jaw snap open!
      const raw = (p - 0.235) / 0.05;
      const t = raw * raw * (2.2 - 1.2 * raw); // snappy dive!
      offX = 122 * sc * (1 - t);
      offY = -162 * sc * (1 - t);
      headRot = -0.072 * (1 - t) + Math.sin(raw * Math.PI) * 0.032;
      openMix = smoothStep((p - 0.258) / 0.028);
    } else if (p < 0.765) {
      // F15: Locked low pouring blazing fire jet — recoil pushback & roaring tremble
      const bp = (p - 0.285) / 0.48;
      const kick = Math.exp(-bp * 16); // punchy recoil on breath launch
      const shudder = Math.sin(p * Math.PI * 44) * 4.8 * sc + Math.cos(p * Math.PI * 29) * 2.8 * sc;
      offX = kick * 24 * sc + shudder * 0.85;
      offY = -kick * 14 * sc - shudder * 0.42 + Math.sin(bp * Math.PI * 6) * 5 * sc;
      headRot = kick * -0.035 + Math.sin(p * Math.PI * 22) * 0.012;
      openMix = 1;
    } else if (p < 0.815) {
      // F10..F11: Jaws clamp shut firmly with slight forward bite thrust
      const t = smoothStep((p - 0.765) / 0.05);
      offX = -t * 34 * sc;
      offY = t * 18 * sc;
      headRot = t * 0.026;
      openMix = 1 - smoothStep((p - 0.762) / 0.03);
    } else {
      // F12..F14: Ascends powerfully UP-RIGHT off top screen edge!
      const raw = (p - 0.815) / 0.185;
      const t = raw * raw * (0.35 + 0.65 * raw);
      offX = -34 * sc + t * 295 * sc;
      offY = 18 * sc - t * (dh * 1.12);
      headRot = 0.026 - t * 0.12;
      headAlpha = raw > 0.74 ? clamp01((1 - raw) / 0.26) : 1;
      openMix = 0;
    }

    const dx0 = baseDx + offX;
    const dy0 = baseDy + offY;
    // Pivot dragon slight tilt around rear neck shoulder so snout dips organically
    const pivotX = dx0 + dw * 0.72;
    const pivotY = dy0 + dh * 0.36;
    // Exact open glowing molten throat core inside `spell_02_dragon.webp` (`nx=0.244, ny=0.551`)
    const relTx = dw * 0.244 - dw * 0.72;
    const relTy = dh * 0.551 - dh * 0.36;
    const cosR = Math.cos(headRot);
    const sinR = Math.sin(headRot);
    const throatX = pivotX + relTx * cosR - relTy * sinR;
    const throatY = pivotY + relTx * sinR + relTy * cosR;

    // 1) Radiant backing volcanic glow behind the dragon head
    {
      const glowA =
        p < 0.12
          ? (p / 0.12) * 0.6
          : p < 0.285
          ? 0.6 + 0.4 * ((p - 0.12) / 0.165)
          : p < 0.80
          ? 1.0
          : clamp01((1 - p) / 0.20);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const gx = dx0 + dw * 0.44;
      const gy = dy0 + dh * 0.48;
      const backGlow = ctx.createRadialGradient(gx, gy, 35 * sc, gx, gy, dw * 0.64);
      backGlow.addColorStop(0, `rgba(255, 165, 40, ${0.44 * glowA})`);
      backGlow.addColorStop(0.52, `rgba(220, 38, 38, ${0.22 * glowA})`);
      backGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = backGlow;
      ctx.beginPath();
      ctx.arc(gx, gy, dw * 0.64, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Helper: draw stylized curved glowing `C`-crescent ember (matching iconic DOS sp_026 F16/F17 shapes!)
    const drawFireCrescent = (cx: number, cy: number, r: number, ang: number, alpha: number, hot: boolean) => {
      if (alpha <= 0.02 || r <= 0.5) return;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.fillStyle = hot
        ? `rgba(255, 245, 185, ${alpha})`
        : `rgba(251, 146, 60, ${alpha})`;
      ctx.beginPath();
      ctx.arc(0, 0, r, -Math.PI * 0.68, Math.PI * 0.68, false);
      ctx.arc(r * 0.42, 0, r * 0.78, Math.PI * 0.56, -Math.PI * 0.56, true);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    // 1b) Stage 1 INTAKE sparks swirling INWARD toward clenched jaws during high coil (`F05..F08`)
    if (p >= 0.09 && p < 0.295) {
      const chargeT = clamp01((p - 0.09) / 0.18);
      const fadeEnd = p > 0.25 ? clamp01((0.295 - p) / 0.045) : 1;
      const mouthX = throatX - 42 * sc;
      const mouthY = throatY + 18 * sc;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.lineCap = 'round';
      for (let i = 0; i < 24; i++) {
        const ang = i * 2.39996 + chargeT * 2.8;
        const u = 1 - ((chargeT * 2.4 + i * 0.11) % 1); // rushes INWARD (1 -> 0)!
        const rad = (18 + u * 290) * sc;
        const px = mouthX + Math.cos(ang) * rad;
        const py = mouthY + Math.sin(ang) * rad * 0.72;
        const a = Math.sin(u * Math.PI) * 0.96 * fadeEnd * clamp01(chargeT * 2.8);
        ctx.strokeStyle = i % 3 === 0 ? `rgba(255, 252, 215, ${a})` : `rgba(251, 146, 60, ${a * 0.9})`;
        ctx.lineWidth = (3.0 + (i % 3) * 1.5) * sc;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - Math.cos(ang) * 34 * sc * u, py - Math.sin(ang) * 26 * sc * u);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 2) STAGE 2 MULTI-FRAME ANIMATED DRAGONFIRE BREATH (`p = 0.272..0.895`)
    //    Cycles rapidly across 4 distinct hand-painted breath sprites matching exact DOS nozzle coords!
    //    Drawn directly BEHIND the open dragon head so the interlocking fangs physically frame the blast.
    if (p >= 0.272 && p <= 0.895) {
      // Stationary mouth emission origin stays anchored even after head lifts off for smooth throat cutoff
      const emitX = p <= 0.765 ? throatX : baseDx + dw * 0.244;
      const emitY = p <= 0.765 ? throatY : baseDy + dh * 0.551;

      const sweepT = clamp01((p - 0.272) / 0.105); // fast explosive shoot-out (~175ms across whole screen!)
      const bEase = 1 - Math.pow(1 - sweepT, 2.3);
      const cutT = p > 0.742 ? clamp01((p - 0.742) / 0.148) : 0; // throat-first cutoff expanding outward!
      const bFade = p < 0.295 ? (p - 0.272) / 0.023 : cutT > 0 ? clamp01(Math.pow(1 - cutT, 1.45)) : 1;

      interface BreathFrameSpec {
        img: HTMLImageElement;
        bw: number;
        nx: number;
        ny: number;
        curlBiasY: number;
      }
      const frames: BreathFrameSpec[] = [];
      // Order: [f16 barrel curl -> c wide wave -> f17 fork -> f18 soaring whip] so every beat visibly flips curls!
      if (imgs.dragonBreath3 && imgs.dragonBreath3.naturalWidth > 0) {
        frames.push({ img: imgs.dragonBreath3, bw: 960 * sc, nx: 0.899, ny: 0.140, curlBiasY: 0 });
      }
      if (imgs.dragonBreath1 && imgs.dragonBreath1.naturalWidth > 0) {
        frames.push({ img: imgs.dragonBreath1, bw: 1005 * sc, nx: 0.945, ny: 0.262, curlBiasY: -6 * sc });
      }
      if (imgs.dragonBreath && imgs.dragonBreath.naturalWidth > 0) {
        frames.push({ img: imgs.dragonBreath, bw: 960 * sc, nx: 0.898, ny: 0.145, curlBiasY: 2 * sc });
      }
      if (imgs.dragonBreath2 && imgs.dragonBreath2.naturalWidth > 0) {
        frames.push({ img: imgs.dragonBreath2, bw: 965 * sc, nx: 0.897, ny: 0.149, curlBiasY: -4 * sc });
      }

      if (frames.length > 0) {
        // Primary cycle cursor (~14.3 beats per second -> snappy rapid DOS F16<->F17 flame roar!)
        const activeDur = p - 0.272;
        const beatPos = activeDur * 24.0; // ~12 crisp distinct frames inside breath window!
        const fIdx = Math.floor(beatPos) % frames.length;
        const nIdx = (fIdx + 1) % frames.length;
        const sub = beatPos - Math.floor(beatPos); // 0..1 within current beat
        // Crisp 2D sakuga snapping: hold clear silhouette for 70% of each beat, quick snappy whip crossfade for final 30%!
        const blendNext = sub > 0.68 ? smoothStep((sub - 0.68) / 0.32) : 0;

        const baseBw = 965 * sc;
        const baseBh = 535 * sc;
        const maxReach = Math.hypot(baseBw * 1.18, baseBh * 1.18);
        const clipOuterR = Math.max(52 * sc, maxReach * bEase);
        const cutInnerR = cutT > 0 ? Math.pow(cutT, 0.88) * maxReach * 0.98 : 0;

        // Layer A: Broad volcanic ground glow flickering rapidly beneath flame jet
        {
          const flick = 0.86 + 0.14 * Math.sin(beatPos * Math.PI * 2);
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          const blazeX = emitX - baseBw * 0.56 * bEase - cutT * 190 * sc;
          const blazeY = emitY + baseBh * 0.58;
          const bgR = Math.max(40 * sc, 480 * sc * bEase * (1 - cutT * 0.35));
          const bgFire = ctx.createRadialGradient(blazeX, blazeY, 20 * sc, blazeX, blazeY, bgR);
          bgFire.addColorStop(0, `rgba(254, 240, 138, ${0.50 * bFade * flick})`);
          bgFire.addColorStop(0.45, `rgba(249, 115, 22, ${0.40 * bFade * flick})`);
          bgFire.addColorStop(0.82, `rgba(220, 38, 38, ${0.18 * bFade})`);
          bgFire.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = bgFire;
          ctx.beginPath();
          ctx.arc(blazeX, blazeY, bgR, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Helper to paint one breath sprite anchored snugly at dragon's throat nozzle
        const drawBreathSprite = (
          tgt: CanvasRenderingContext2D,
          spec: BreathFrameSpec,
          alpha: number,
          pushPx: number,
          scaleX: number,
          scaleY: number,
          rotOff: number,
          additive = false
        ) => {
          if (alpha <= 0.01) return;
          const bh = (spec.bw * spec.img.naturalHeight) / spec.img.naturalWidth;
          const bx0 = emitX - spec.bw * spec.nx + 34 * sc - pushPx;
          const by0 = emitY - bh * spec.ny - 14 * sc + spec.curlBiasY + pushPx * 0.14;
          tgt.save();
          if (additive) tgt.globalCompositeOperation = 'screen';
          tgt.translate(emitX, emitY);
          tgt.rotate(rotOff);
          tgt.scale(scaleX, scaleY);
          tgt.globalAlpha = clamp01(alpha);
          tgt.drawImage(spec.img, bx0 - emitX, by0 - emitY, spec.bw, bh);
          tgt.restore();
        };

        // During eruption (`sweepT < 0.99`) or throat-first cutoff (`cutT > 0`), render into a
        // reusable offscreen buffer so a wide velvety feathered radial gradient (`destination-in`)
        // sweeps the breath softly with ZERO hard polygon or circular clip seam!
        const useFeatheredMask =
          (sweepT < 0.99 || cutT > 0) && typeof document !== 'undefined';
        let bCtx: CanvasRenderingContext2D = ctx;
        if (useFeatheredMask) {
          if (!breathMaskCanvas) breathMaskCanvas = document.createElement('canvas');
          if (breathMaskCanvas.width !== W || breathMaskCanvas.height !== H) {
            breathMaskCanvas.width = W;
            breathMaskCanvas.height = H;
          }
          const mc = breathMaskCanvas.getContext('2d');
          if (mc) {
            mc.setTransform(1, 0, 0, 1, 0, 0);
            mc.globalCompositeOperation = 'source-over';
            mc.globalAlpha = 1;
            mc.clearRect(0, 0, W, H);
            bCtx = mc;
          }
        }

        // Subtle forward traveling wave drift inside every beat so curls visibly roll outward ↙
        const pushCur = sub * 14 * sc + cutT * 105 * sc;
        const pushNext = (sub - 1) * 10 * sc + cutT * 105 * sc;
        const waveSx = 1 + Math.sin(beatPos * 1.9) * 0.032;
        const waveSy = 1 + Math.cos(beatPos * 2.3) * 0.048;
        const waveRot = Math.sin(beatPos * 1.55) * 0.032;

        // Layer B: Soft glowing tumbling `fx_fire_ring.webp` ground-churn eddies rushing physically LEFTWARD across target!
        if (imgs.fireRing && imgs.fireRing.naturalWidth > 0) {
          bCtx.save();
          bCtx.globalCompositeOperation = 'screen';
          for (let ri = 0; ri < 5; ri++) {
            const u = (activeDur * 4.4 + ri * 0.2) % 1;
            // Parametric breath curve from throat nozzle -> low ground bounce -> rising far-left curling crest!
            const rx = emitX - (0.14 + u * 0.78) * baseBw;
            const drop =
              Math.sin(Math.min(1, u * 1.48) * Math.PI * 0.5) * baseBh * 0.72 -
              Math.pow(Math.max(0, u - 0.62), 1.55) * baseBh * 0.85;
            const ry = emitY + drop;
            const rw = (195 + u * 140) * sc;
            const rh = (115 + u * 90) * sc;
            const ringA = Math.sin(u * Math.PI) * 0.44 * bFade;
            bCtx.save();
            bCtx.translate(rx, ry);
            bCtx.rotate(-0.42 + u * 1.45 - activeDur * 3.8);
            bCtx.globalAlpha = clamp01(ringA);
            bCtx.drawImage(imgs.fireRing, -rw * 0.5, -rh * 0.5, rw, rh);
            bCtx.restore();
          }
          bCtx.restore();
        }

        // Layer C: Primary 4-frame hand-painted dragonfire wave (crisp `source-over` preserves deep vermilion-crimson ribs!)
        const curSpec = frames[fIdx];
        const nextSpec = frames[nIdx];
        if (blendNext <= 0.01) {
          drawBreathSprite(bCtx, curSpec, bFade * 0.99, pushCur, waveSx, waveSy, waveRot, false);
        } else {
          drawBreathSprite(bCtx, curSpec, bFade * (1 - blendNext * 0.9), pushCur, waveSx, waveSy, waveRot, false);
          drawBreathSprite(
            bCtx,
            nextSpec,
            bFade * blendNext * 0.99,
            pushNext,
            1 + Math.sin((beatPos + 1) * 1.9) * 0.032,
            1 + Math.cos((beatPos + 1) * 2.3) * 0.048,
            -waveRot * 0.65,
            false
          );
        }

        // Fast-phase luminous additive shimmer frame pushed down-left (`boils the interior yellow-white heat core!`)
        const echoIdx = (fIdx + 2) % frames.length;
        const echoAlpha = bFade * (0.24 + 0.16 * Math.abs(Math.sin(beatPos * Math.PI)));
        drawBreathSprite(
          bCtx,
          frames[echoIdx],
          echoAlpha,
          16 * sc + sub * 28 * sc + cutT * 125 * sc,
          1.03,
          1.045,
          -waveRot * 0.8,
          true
        );

        // Layer D: High-velocity white-gold pressurized jet filaments surging straight down-left from the fangs!
        if (cutT < 0.72) {
          const jetFade = bFade * clamp01((0.72 - cutT) / 0.42);
          bCtx.save();
          bCtx.globalCompositeOperation = 'screen';
          for (let ji = 0; ji < 12; ji++) {
            const ju = (activeDur * 6.8 + ji * 0.083) % 1;
            const len = (95 + (ji % 3) * 58) * sc;
            const lane = (ji % 5 - 2) * (16 + ju * 46) * sc;
            // Travel angle along the pressurized mouth jet diagonal `(-0.79, +0.61)`
            const dist = ju * baseBw * 0.56;
            const jx0 = emitX - dist * 0.79 - lane * 0.42;
            const jy0 = emitY + dist * 0.56 + lane * 0.65;
            const jx1 = jx0 - len * 0.79;
            const jy1 = jy0 + len * 0.56;
            const ja = Math.sin(ju * Math.PI) * (ji % 2 === 0 ? 0.68 : 0.46) * jetFade;
            const g = bCtx.createLinearGradient(jx0, jy0, jx1, jy1);
            g.addColorStop(0, 'rgba(255,255,230,0)');
            g.addColorStop(0.55, `rgba(255, 250, 200, ${ja})`);
            g.addColorStop(1, 'rgba(251, 146, 60, 0)');
            bCtx.strokeStyle = g;
            bCtx.lineWidth = (3.5 + (ji % 3) * 2.2) * sc;
            bCtx.lineCap = 'round';
            bCtx.beginPath();
            bCtx.moveTo(jx0, jy0);
            bCtx.lineTo(jx1, jy1);
            bCtx.stroke();
          }
          bCtx.restore();
        }

        // Apply velvety feathered `destination-in` mask on offscreen buffer & composite onto main canvas
        if (bCtx !== ctx && breathMaskCanvas) {
          bCtx.save();
          bCtx.globalCompositeOperation = 'destination-in';
          if (sweepT < 0.99) {
            const feather = 240 * sc;
            const outerR = Math.max(48 * sc, clipOuterR + feather * 0.45);
            const innerStop = Math.max(0, outerR - feather);
            const mg = bCtx.createRadialGradient(emitX, emitY, innerStop, emitX, emitY, outerR);
            mg.addColorStop(0, 'rgba(255,255,255,1)');
            mg.addColorStop(0.6, 'rgba(255,255,255,0.65)');
            mg.addColorStop(1, 'rgba(255,255,255,0)');
            bCtx.fillStyle = mg;
            bCtx.fillRect(0, 0, W, H);
          }
          if (cutInnerR > 1) {
            const feather = 320 * sc;
            const r0 = Math.max(0, cutInnerR - feather * 0.35);
            const r1 = r0 + feather;
            const mg = bCtx.createRadialGradient(emitX + 18 * sc, emitY - 8 * sc, r0, emitX + 18 * sc, emitY - 8 * sc, r1);
            mg.addColorStop(0, 'rgba(255,255,255,0)');
            mg.addColorStop(0.45, 'rgba(255,255,255,0.32)');
            mg.addColorStop(1, 'rgba(255,255,255,1)');
            bCtx.fillStyle = mg;
            bCtx.fillRect(0, 0, W, H);
          }
          bCtx.restore();
          ctx.drawImage(breathMaskCanvas, 0, 0, W, H);
        }

        // Soft volumetric blazing plume masking the erupting leading wavefront (`p=0.272..0.38`) & cutoff tail (`p=0.76..0.90`)
        if (sweepT < 0.98) {
          const fx = emitX - bEase * baseBw * 0.84;
          const fy = emitY + Math.sin(bEase * Math.PI * 0.62) * baseBh * 0.58;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          const headA = Math.sin(sweepT * Math.PI) * 0.78;
          const rg = ctx.createRadialGradient(fx, fy, 12 * sc, fx, fy, 190 * sc);
          rg.addColorStop(0, `rgba(255, 252, 215, ${headA})`);
          rg.addColorStop(0.45, `rgba(251, 146, 60, ${headA * 0.65})`);
          rg.addColorStop(1, 'rgba(220, 38, 38, 0)');
          ctx.fillStyle = rg;
          ctx.beginPath();
          ctx.arc(fx, fy, 190 * sc, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        if (cutT > 0.02 && cutT < 0.96) {
          // Rising soft glowing ember-smoke wisps masking the receding cutoff edge
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          for (let ci = 0; ci < 9; ci++) {
            const ang = Math.PI * (0.58 + ci * 0.06);
            const ex = emitX + Math.cos(ang) * cutInnerR;
            const ey = emitY + Math.sin(ang) * cutInnerR * 0.88;
            if (ex < emitX - baseBw * 1.05 || ey > emitY + baseBh * 0.98) continue;
            const ra = Math.sin(cutT * Math.PI) * 0.62;
            const cr = (72 + (ci % 3) * 34) * sc;
            const cg = ctx.createRadialGradient(ex, ey, 4 * sc, ex, ey, cr);
            cg.addColorStop(0, `rgba(254, 240, 138, ${ra})`);
            cg.addColorStop(0.5, `rgba(249, 115, 22, ${ra * 0.55})`);
            cg.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = cg;
            ctx.beginPath();
            ctx.arc(ex, ey, cr, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        // Layer E: Flying stylized DOS-inspired glowing `C`-crescents & hot speed sparks flung outward above the crest!
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (let ei = 0; ei < 28; ei++) {
          const eu = (activeDur * 3.1 + ei * 0.073) % 1;
          if (eu > bEase * 1.08) continue;
          if (cutT > 0 && eu < cutT * 0.92) continue;
          const ex =
            emitX -
            eu * baseBw * 1.02 -
            cutT * 90 * sc +
            Math.sin(ei * 4.3 + activeDur * 18) * 52 * sc;
          const arcDrop =
            Math.sin(Math.min(1, eu * 1.4) * Math.PI * 0.5) * baseBh * 0.68 -
            Math.pow(Math.max(0, eu - 0.50), 1.55) * baseBh * 1.08;
          const ey =
            emitY +
            arcDrop +
            Math.cos(ei * 6.7 - activeDur * 16) * (36 + eu * 78) * sc -
            (ei % 4 === 0 ? (0.35 + eu) * 105 * sc : 0);
          const alpha = clamp01(Math.sin(eu * Math.PI) * 0.95 * (cutT > 0 ? 1 - cutT * 0.72 : 1));
          if (ei % 4 === 0) {
            drawFireCrescent(
              ex,
              ey,
              (8 + (ei % 3) * 5.5) * sc * (0.8 + eu * 0.45),
              -1.4 + eu * 2.8 + ei * 0.9 + activeDur * 4,
              alpha * 0.92,
              ei % 8 === 0
            );
          } else {
            const sr = (2.8 + (ei % 3) * 2.1) * sc * (1 - eu * 0.3);
            ctx.fillStyle =
              ei % 3 === 0
                ? `rgba(255, 250, 210, ${alpha})`
                : `rgba(251, 146, 60, ${alpha * 0.9})`;
            ctx.beginPath();
            ctx.ellipse(ex, ey, sr * 3.1, sr * 0.72, -0.48 + eu * 1.05, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      } else {
        // Fallback soft plume burst if WebP is still loading
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        drawOrganicFlamePillar(
          ctx,
          W * 0.34,
          groundY + 12 * sc,
          440 * sc * bEase,
          170 * sc,
          p * 1.4,
          {
            outer: 'rgba(220,38,38,0.56)',
            mid: 'rgba(249,115,22,0.82)',
            core: 'rgba(254,240,138,0.92)',
            hot: 'rgba(255,255,242,0.98)',
          },
          bFade
        );
        ctx.restore();
      }
    }

    // 3) Draw Flame Dragon head OVER the breath nozzle so the interlocking fangs frame the blast cleanly!
    //    `dragonClosed` (`980x778`) matches `dragon` (`980x778`) 1:1 on skull/horns/eye for a seamless jaw snap!
    if ((dOpen && dOpen.naturalWidth > 0) || (dClosed && dClosed.naturalWidth > 0)) {
      ctx.save();
      ctx.translate(pivotX, pivotY);
      ctx.rotate(headRot);
      const drawX = dx0 - pivotX;
      const drawY = dy0 - pivotY;
      if (openMix <= 0.01 && dClosed) {
        ctx.globalAlpha = clamp01(headAlpha);
        ctx.drawImage(dClosed, drawX, drawY, dw, dh);
      } else if (openMix >= 0.99 && dOpen) {
        ctx.globalAlpha = clamp01(headAlpha);
        ctx.drawImage(dOpen, drawX, drawY, dw, dh);
      } else {
        if (dClosed) {
          ctx.globalAlpha = clamp01(headAlpha * (1 - openMix));
          ctx.drawImage(dClosed, drawX, drawY, dw, dh);
        }
        if (dOpen) {
          ctx.globalAlpha = clamp01(headAlpha * openMix);
          ctx.drawImage(dOpen, drawX, drawY, dw, dh);
        }
      }
      ctx.restore();
    }

    // 4) Blinding incandescent mouth-core flare shimmering inside jaws during roar & bite spark-puff!
    {
      const jawGlowX = throatX - 24 * sc;
      const jawGlowY = throatY + 12 * sc;
      if (p >= 0.14 && p <= 0.85) {
        const mouthGlowA =
          p < 0.27
            ? ((p - 0.14) / 0.13) * 0.42
            : p < 0.765
            ? 0.85 + 0.15 * Math.sin(p * Math.PI * 38)
            : clamp01((0.83 - p) / 0.065) * 0.65;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const rad = (p < 0.27 ? 115 : 178) * sc * (0.85 + 0.15 * Math.sin(p * Math.PI * 26));
        const mg = ctx.createRadialGradient(jawGlowX, jawGlowY, 4 * sc, jawGlowX, jawGlowY, rad);
        mg.addColorStop(0, `rgba(255, 255, 235, ${0.58 * mouthGlowA})`);
        mg.addColorStop(0.32, `rgba(253, 224, 71, ${0.38 * mouthGlowA})`);
        mg.addColorStop(0.68, `rgba(249, 115, 22, ${0.18 * mouthGlowA})`);
        mg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.arc(jawGlowX, jawGlowY, rad, 0, Math.PI * 2);
        ctx.fill();
        // Soft dramatic ignition starburst tucked inside fang gap right when jaws snap wide open (`F09 -> F15`!)
        if (p >= 0.245 && p < 0.34) {
          const sp = Math.sin(clamp01((p - 0.245) / 0.095) * Math.PI);
          drawTaperedStarburst(
            ctx,
            throatX - 38 * sc,
            throatY + 18 * sc,
            132 * sc * sp,
            8,
            p * 9,
            'rgba(253, 224, 71, 0.85)',
            '#fffbeb'
          );
        }
        ctx.restore();
      }
      // Subtle amber ember puffs drifting off clenched teeth after jaw clamps shut (`F10..F12`)
      if (p >= 0.765 && p < 0.91) {
        const pt = (p - 0.765) / 0.145;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (let si = 0; si < 8; si++) {
          const sx = jawGlowX - (20 + si * 18 + pt * 130) * sc;
          const sy = jawGlowY + Math.sin(si * 2.1) * 26 * sc - pt * (35 + si * 9) * sc;
          const sa = Math.sin(pt * Math.PI) * 0.75;
          ctx.fillStyle = si % 2 === 0 ? `rgba(254, 240, 138, ${sa})` : `rgba(251, 146, 60, ${sa})`;
          ctx.beginPath();
          ctx.arc(sx, sy, (2.5 + (si % 3) * 1.8) * sc, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    ctx.restore();
    ctx.restore();
    return;
  }

  // =========================================================================
  // #03 天火術 Heaven's Fire (sp_039 / sp_043) — Exact 12-strike barrage (6 meteors + 3 ice-blue beams + 3 gold solar beams!)
  // =========================================================================
  if (spellId === 3) {
    if (drawBehind) {
      const dim = p < 0.14 ? p / 0.14 : p > 0.84 ? (1 - p) / 0.16 : 1;
      ctx.fillStyle = `rgba(26, 8, 6, ${0.42 * dim})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (!drawFront) {
      ctx.restore();
      return;
    }

    // Authentic `GLOBAL_9145[3]` offsets & sub-strips (`0 = meteor+ring`, `11 = blue sky beam`, `22 = gold solar beam`)
    const subBases = [0, 11, 0, 22, 0, 22, 0, 11, 0, 22, 0, 11];
    const relX = [-25, -45, 20, -10, 65, 18, -65, -18, 48, 28, -42, -5];
    const relY = [-36, 0, -10, 8, -14, -4, -22, 6, -30, 12, -8, -12];
    const tick = p * 33;

    for (let k = 0; k < 12; k++) {
      const localF = tick - 2 * k;
      if (localF < 0 || localF >= 11) continue;
      const base = subBases[k];
      const ix = targetX + relX[k] * dosX * 0.9 * dir;
      const iy = groundY - 125 * sc + relY[k] * dosY * 0.85;

      if (base === 0) {
        // METEOR + RING EXPLOSION (`F0..F2` diagonal fiery comet -> `F3..F10` hollow curling `fx_fire_ring.webp`!)
        if (localF < 3.0) {
          const mp = localF / 3.0;
          const sx = ix + dir * 560 * sc;
          const sy = iy - 420 * sc;
          const cx = sx + (ix - sx) * mp;
          const cy = sy + (iy - sy) * mp;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          const tailX = cx + dir * 210 * sc;
          const tailY = cy - 155 * sc;
          const mg = ctx.createLinearGradient(tailX, tailY, cx, cy);
          mg.addColorStop(0, 'rgba(220,38,38,0)');
          mg.addColorStop(0.55, 'rgba(249,115,22,0.88)');
          mg.addColorStop(1, 'rgba(255,252,225,1)');
          ctx.strokeStyle = mg;
          ctx.lineCap = 'round';
          ctx.lineWidth = 34 * sc;
          ctx.beginPath();
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(cx, cy);
          ctx.stroke();
          drawTaperedStarburst(ctx, cx, cy, 78 * sc, 6, mp * 5, 'rgba(251,146,60,0.95)', '#ffffff');
          ctx.restore();
        } else {
          const ep = (localF - 3.0) / 8.0; // 0..1 explosion -> expanding fading ring!
          const fade = ep < 0.14 ? ep / 0.14 : Math.pow(1 - ep, 0.72);
          const rSize = (170 + Math.pow(ep, 0.65) * 320) * sc;
          const ringImg = imgs.fireRing;
          if (ringImg && ringImg.naturalWidth > 0) {
            ctx.save();
            ctx.translate(ix, iy);
            ctx.rotate(k * 0.75 + ep * 0.45 * dir);
            ctx.globalAlpha = clamp01(fade * 0.96);
            ctx.drawImage(ringImg, -rSize * 0.5, -rSize * 0.5, rSize, rSize);
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = clamp01(fade * 0.52);
            ctx.drawImage(ringImg, -rSize * 0.46, -rSize * 0.46, rSize * 0.92, rSize * 0.92);
            ctx.restore();
          }
          if (ep < 0.28) {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            drawTaperedStarburst(ctx, ix, iy, rSize * 0.55 * (1 - ep / 0.28), 10, ep * 6, 'rgba(253,224,71,0.9)', '#ffffff');
            ctx.restore();
          }
        }
      } else {
        // DIAGONAL ORBITAL SKY-BEAM (`base === 11`: BLUE plasma, `base === 22`: GOLD solar fire!)
        // Authentic `dos_sp_39 F11..F21` track:
        //   - Entry (`F11..F12`): tip shoots DIAGONALLY ↙ from upper-right edge straight INTO impact point `(ix, iy)`.
        //   - Sustain (`F12..F18`): full towering sky-to-earth orbital laser blasting the crater!
        //   - Exit (`F19..F21`): stays PLANTED at `(ix, iy)` while TOP-RIGHT TAIL drains straight down-left INTO ground!
        const isBlue = base === 11;
        const beamImg = isBlue ? imgs.solarBeamBlue : imgs.solarBeamGold;
        const bw = 920 * sc;
        const bh = beamImg && beamImg.naturalWidth > 0 ? (bw * beamImg.naturalHeight) / beamImg.naturalWidth : 700 * sc;
        const entryT = clamp01(localF / 1.5);
        const exitT = localF > 6.8 ? clamp01((localF - 6.8) / 4.2) : 0;
        const alpha = localF < 0.5 ? localF / 0.5 : exitT > 0.78 ? clamp01((1 - exitT) / 0.22) : 1;
        const pulse = 1 + Math.sin(localF * 5.2 + k) * 0.045;

        ctx.save();
        // Anchor lower-left tip cleanly right onto `(ix, iy)` (mirror around `ix` when striking hero right side!)
        ctx.translate(ix, iy);
        if (targetIsHeroSide) ctx.scale(-1, 1);

        const tipStartX = -bw * 0.05;
        const tipStartY = -bh + bh * 0.05;
        const beamSpan = Math.hypot(bw, bh);
        const angRad = Math.atan2(-bh, bw); // direction pointing UP-RIGHT along the beam shaft

        // Directional progress clip in rotated beam-frame (`s = 0` at ground tip `(0,0)`, `s = beamSpan` at sky top-right!)
        const startS = (1 - entryT) * beamSpan; // shoots down from `beamSpan` -> `0`!
        const endS = (1 - Math.pow(exitT, 1.15)) * beamSpan; // exit drains from top-right (`beamSpan`) down INTO `0`!
        if (endS > startS + 4) {
          ctx.save();
          ctx.save();
          ctx.rotate(angRad);
          ctx.beginPath();
          ctx.rect(startS - 90 * sc, -360 * sc, endS - startS + 180 * sc, 720 * sc);
          ctx.restore();
          ctx.clip();

          if (beamImg && beamImg.naturalWidth > 0) {
            ctx.globalAlpha = clamp01(alpha * 0.96);
            ctx.drawImage(beamImg, tipStartX, tipStartY, bw * pulse, bh * pulse);
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = clamp01(alpha * 0.56);
            ctx.drawImage(beamImg, tipStartX - 10 * sc, tipStartY + 8 * sc, bw * pulse, bh * pulse);
          } else {
            ctx.globalCompositeOperation = 'screen';
            ctx.strokeStyle = isBlue ? `rgba(96,165,250,${0.9 * alpha})` : `rgba(251,146,60,${0.9 * alpha})`;
            ctx.lineWidth = 72 * sc;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(bw * 0.9, -bh * 0.9);
            ctx.lineTo(0, 0);
            ctx.stroke();
          }
          ctx.restore();
        }

        // Luminous leading cap softening the descending top-right tail during `exitT` retraction!
        if (exitT > 0.02 && exitT < 0.95) {
          const capX = Math.cos(angRad) * endS;
          const capY = Math.sin(angRad) * endS;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          const cg = ctx.createRadialGradient(capX, capY, 6 * sc, capX, capY, 120 * sc);
          cg.addColorStop(0, `rgba(255,255,255,${0.9 * alpha})`);
          cg.addColorStop(0.5, isBlue ? `rgba(96,165,250,${0.55 * alpha})` : `rgba(251,146,60,${0.55 * alpha})`);
          cg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = cg;
          ctx.beginPath();
          ctx.arc(capX, capY, 120 * sc, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Blazing starburst flare right at the diagonal impact crater tip!
        if (entryT > 0.65) {
          ctx.globalCompositeOperation = 'screen';
          const crFade = exitT > 0.65 ? clamp01((1 - exitT) / 0.35) : alpha;
          drawTaperedStarburst(
            ctx,
            0,
            0,
            (185 + Math.sin(localF * 6) * 28) * sc * crFade,
            10,
            localF * 0.8,
            isBlue ? 'rgba(96,165,250,0.92)' : 'rgba(251,146,60,0.92)',
            '#ffffff'
          );
        }
        ctx.restore();
      }
    }
    ctx.restore();
    return;
  }

  // =========================================================================
  // #04 電擊術 Lightning Shock (sp_022 / sp_023) — Exact 6 staggered crackling bolts + rising upward flare rebound!
  // =========================================================================
  if (spellId === 4) {
    if (drawBehind) {
      const dim = Math.sin(p * Math.PI) * 0.28;
      ctx.fillStyle = `rgba(22, 12, 46, ${dim})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (!drawFront) {
      ctx.restore();
      return;
    }
    // Authentic `GLOBAL_9145[4]` 6 bolts: `xs = [30, 50, 70, 40, 80, 100]` centered near `65`
    const xOffs = [-35, -15, 5, -25, 15, 35];
    const tick = p * 18;
    const bImg = imgs.boltThin;

    for (let k = 0; k < 6; k++) {
      const localF = tick - 2 * k;
      if (localF < 0 || localF >= 7) continue;
      const bx = targetX + xOffs[k] * dosX * 1.15 * dir;
      const gy = groundY - 6 * sc + (k % 2 === 0 ? -12 : 8) * sc;
      const flip = k % 2 === 1;

      if (localF < 3.6) {
        // Descending strike `F0..F2`: jagged bolt shoots TOP->BOTTOM straight into ground;
        // `F3` (`localF 1.9..3.6`): upper shaft PEELS DOWN TOP->BOTTOM right into the erupting impact flare!
        const dropFrac = clamp01(localF / 1.55);
        const peelFrac = localF > 1.85 ? clamp01((localF - 1.85) / 1.75) : 0;
        const clipTopY = Math.pow(peelFrac, 1.25) * (gy - 20 * sc);
        const clipBotY = Math.max(12, (gy + 42 * sc) * dropFrac);
        const fade = localF > 3.1 ? clamp01((3.6 - localF) / 0.5) : 1;
        const bH = gy + 30 * sc;
        const bW = bImg && bImg.naturalWidth > 0 ? Math.max(220 * sc, (bH * bImg.naturalWidth) / bImg.naturalHeight * 0.85) : 260 * sc;
        if (clipBotY > clipTopY + 4) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, clipTopY, W, clipBotY - clipTopY);
          ctx.clip();
          if (bImg && bImg.naturalWidth > 0) {
            ctx.translate(bx, gy * 0.5);
            if (flip) ctx.scale(-1, 1);
            ctx.globalAlpha = clamp01(fade * 0.98);
            ctx.drawImage(bImg, -bW * 0.5, -bH * 0.5, bW, bH);
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = clamp01(fade * 0.68);
            ctx.drawImage(bImg, -bW * 0.52, -bH * 0.5, bW * 1.04, bH);
          } else {
            ctx.globalCompositeOperation = 'screen';
            drawLightningBolt(ctx, bx, -20 * sc, bx, gy, 24 * sc, 54 * sc, 12, k * 37, 'rgba(139,92,246,0.88)', 'rgba(216,180,254,0.95)', '#ffffff', 2);
          }
          ctx.restore();
        }
        if (dropFrac >= 0.82 && localF < 3.4) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          drawTaperedStarburst(ctx, bx, gy - 16 * sc, 114 * sc * fade, 8, k * 0.5, 'rgba(167,139,250,0.94)', '#faf5ff');
          ctx.restore();
        }
      }

      // Authentic `sp_022 F3..F6` bright W-shaped plasma rebound crest LIFTING OFF ground `gy` & ROCKETING OFF TOP `y=0`!
      if (localF >= 2.15) {
        const up = clamp01((localF - 2.15) / 4.85);
        // Stay vividly bright right off the floor up to the top border (`y=0`), mirroring `dos_sp_22 F04..F06`!
        const ry = gy - Math.pow(up, 0.92) * (gy + 190 * sc);
        const fade = up < 0.14 ? up / 0.14 : up > 0.78 ? clamp01((1 - up) / 0.22) : 1;
        const rw = (96 - up * 16) * sc;
        const rh = (210 - up * 40) * sc;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        // Outer violet aura glow halo
        const og = ctx.createRadialGradient(bx, ry - rh * 0.42, 4 * sc, bx, ry - rh * 0.42, rw * 1.15);
        og.addColorStop(0, `rgba(196,181,253,${0.62 * fade})`);
        og.addColorStop(0.55, `rgba(139,92,246,${0.32 * fade})`);
        og.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = og;
        ctx.beginPath();
        ctx.arc(bx, ry - rh * 0.42, rw * 1.15, 0, Math.PI * 2);
        ctx.fill();
        const fg = ctx.createLinearGradient(bx, ry - rh, bx, ry + 26 * sc);
        fg.addColorStop(0, `rgba(139,92,246,${0.25 * fade})`);
        fg.addColorStop(0.28, `rgba(196,181,253,${0.95 * fade})`);
        fg.addColorStop(0.62, `rgba(252,248,255,${0.99 * fade})`);
        fg.addColorStop(1, 'rgba(109,40,217,0)');
        ctx.fillStyle = fg;
        // Bold jagged 4-peak `W`-crest ribbon surging skyward (`dos_sp_22 F04..F06`!)
        ctx.beginPath();
        ctx.moveTo(bx - rw * 0.52, ry + 14 * sc);
        ctx.lineTo(bx - rw * 0.48, ry - rh * 0.92);
        ctx.lineTo(bx - rw * 0.24, ry - rh * 0.36);
        ctx.lineTo(bx, ry - rh);
        ctx.lineTo(bx + rw * 0.24, ry - rh * 0.38);
        ctx.lineTo(bx + rw * 0.48, ry - rh * 0.90);
        ctx.lineTo(bx + rw * 0.52, ry + 14 * sc);
        ctx.lineTo(bx + rw * 0.28, ry - rh * 0.14);
        ctx.lineTo(bx, ry - rh * 0.42);
        ctx.lineTo(bx - rw * 0.28, ry - rh * 0.14);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
    return;
  }

  // =========================================================================
  // #05 落雷術 Falling Bolt (sp_024 / sp_025) — Exact 6 heavy zig-zag thunderbolts + jagged wide crown bursts!
  // =========================================================================
  if (spellId === 5) {
    if (drawBehind) {
      const dim = Math.sin(p * Math.PI) * 0.36;
      ctx.fillStyle = `rgba(24, 12, 48, ${dim})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (!drawFront) {
      ctx.restore();
      return;
    }
    const xOffs = [-36, -16, 4, -26, 16, 36];
    const tick = p * 17;
    const hImg = imgs.boltHeavy;
    const cImg = imgs.thunderCrown;

    for (let k = 0; k < 6; k++) {
      const localF = tick - 2 * k;
      if (localF < 0 || localF >= 6) continue;
      const bx = targetX + xOffs[k] * dosX * 1.15 * dir;
      const gy = groundY + 6 * sc;
      const mirror = k % 2 === 1; // exact alternation of LEFT (`0..5`) and RIGHT (`6..11`) jagged elbow bolts!

      if (localF < 3.1) {
        // Heavy zig-zag bolt shoots TOP->BOTTOM into `gy`, then upper shaft PEELS DOWN TOP->BOTTOM into the crown burst!
        const dropFrac = clamp01(localF / 1.35);
        const peelFrac = localF > 1.75 ? clamp01((localF - 1.75) / 1.35) : 0;
        const topCutY = Math.pow(peelFrac, 1.15) * (gy - 30 * sc);
        const botCutY = Math.max(12, (gy + 55 * sc) * dropFrac);
        const fade = localF > 2.65 ? clamp01((3.1 - localF) / 0.45) : 1;
        const bH = gy + 24 * sc;
        const bW = hImg && hImg.naturalWidth > 0 ? Math.max(300 * sc, (bH * hImg.naturalWidth) / hImg.naturalHeight * 0.92) : 340 * sc;
        if (botCutY > topCutY + 4) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, topCutY, W, botCutY - topCutY);
          ctx.clip();
          if (hImg && hImg.naturalWidth > 0) {
            ctx.translate(bx, gy * 0.5);
            if (mirror) ctx.scale(-1, 1);
            ctx.globalAlpha = clamp01(fade * 0.98);
            ctx.drawImage(hImg, -bW * 0.5, -bH * 0.5, bW, bH);
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = clamp01(fade * 0.65);
            ctx.drawImage(hImg, -bW * 0.52, -bH * 0.5, bW * 1.04, bH);
          }
          ctx.restore();
        }
      }

      // Colossal wide painted ground shockwave crown splash (`F2..F4` bursting outward & upward!)
      if (localF >= 1.35) {
        const cp = clamp01((localF - 1.35) / 4.2);
        const fade = cp < 0.14 ? cp / 0.14 : Math.pow(1 - cp, 0.85);
        const liftY = cp * 55 * sc;
        const spreadW = (320 + cp * 185) * sc;
        const spreadH = (195 + cp * 95) * sc;
        if (cImg && cImg.naturalWidth > 0) {
          ctx.save();
          ctx.translate(bx, gy - liftY);
          if (mirror) ctx.scale(-1, 1);
          ctx.globalAlpha = clamp01(fade * 0.96);
          ctx.drawImage(cImg, -spreadW * 0.5, -spreadH + 18 * sc, spreadW, spreadH);
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = clamp01(fade * 0.58);
          ctx.drawImage(cImg, -spreadW * 0.54, -spreadH + 10 * sc, spreadW * 1.08, spreadH * 1.04);
          ctx.restore();
        }
        // Subtle trailing smoke-blue vertical electric wisp lingering right behind (`sp_024 F5/F11!`)
        if (localF > 2.6) {
          const wa = clamp01(1 - (localF - 2.6) / 3.4) * 0.65;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          drawLightningBolt(
            ctx,
            bx + (mirror ? -22 : 22) * sc,
            gy - 340 * sc,
            bx,
            gy - 70 * sc,
            9 * sc,
            34 * sc,
            6,
            k * 19 + 4,
            `rgba(124,58,237,${wa * 0.65})`,
            `rgba(196,181,253,${wa * 0.88})`,
            `rgba(245,243,255,${wa})`,
            0
          );
          ctx.restore();
        }
      }
    }
    ctx.restore();
    return;
  }

  // =========================================================================
  // #06 轟雷術 Thunder Storm (sp_032 / sp_033) — 5 orbiting dark plasma spheres -> 3 jagged nova detonations!
  // =========================================================================
  if (spellId === 6) {
    const dim = p < 0.12 ? p / 0.12 : p > 0.84 ? (1 - p) / 0.16 : 1;
    if (drawBehind) {
      ctx.fillStyle = `rgba(20, 10, 44, ${0.46 * dim})`;
      ctx.fillRect(0, 0, W, H);
    }
    const cy = groundY - 210 * sc;
    const orbImg = imgs.thunderOrb;
    const novaImg = imgs.thunderNova;

    // Phase 1 (`p = 0..0.52`): 5 dark glossy thunder spheres spiraling tightly INWARD (72° apart, 3D depth sorted!)
    if (p < 0.56) {
      const op = clamp01(p / 0.52);
      const easeR = 1 - Math.pow(op, 1.35);
      const radX = (42 + easeR * 270) * sc;
      const radY = radX * 0.50;
      const oFade = p < 0.08 ? p / 0.08 : p > 0.48 ? clamp01((0.56 - p) / 0.08) : 1;
      const spinDeg = op * 310;

      // Iconic DOS `sp_032 F0->F2` dramatic charging lightning tether pulling INWARD from sky-corner INTO the lead sphere!
      if (op < 0.34 && drawFront) {
        const tt = op / 0.34;
        const ta = tt > 0.72 ? clamp01((1 - tt) / 0.28) : 1;
        const orbX = targetX + Math.cos((spinDeg * Math.PI) / 180) * radX;
        const orbY = cy + Math.sin((spinDeg * Math.PI) / 180) * radY;
        const skyX = targetX - dir * 560 * sc;
        const skyY = -40 * sc;
        // Shrinks start endpoint from sky corner straight INTO the spinning orb (`dos_sp_32 F0->F1->F2`!)
        const peel = Math.pow(tt, 1.3);
        const startX = skyX + (orbX - skyX) * peel;
        const startY = skyY + (orbY - skyY) * peel;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        drawLightningBolt(
          ctx,
          startX,
          startY,
          orbX,
          orbY,
          28 * sc * (1 - peel * 0.5),
          44 * sc * (1 - peel * 0.6),
          7,
          Math.floor(p * 30),
          `rgba(124,58,237,${0.88 * ta})`,
          `rgba(216,180,254,${0.96 * ta})`,
          `rgba(250,245,255,${ta})`,
          1
        );
        ctx.restore();
      }

      for (let k = 0; k < 5; k++) {
        const ang = ((k * 72 + spinDeg) * Math.PI) / 180;
        const isBehind = Math.sin(ang) < 0;
        if (isBehind && !drawBehind) continue;
        if (!isBehind && !drawFront) continue;
        const ox = targetX + Math.cos(ang) * radX;
        const oy = cy + Math.sin(ang) * radY;
        const depthScale = 0.78 + 0.28 * ((Math.sin(ang) + 1) * 0.5);
        const sz = (158 + (1 - easeR) * 32) * sc * depthScale;
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(op * Math.PI * (k % 2 === 0 ? 1.5 : -1.5));
        ctx.globalAlpha = clamp01(oFade * (isBehind ? 0.85 : 0.98));
        if (orbImg && orbImg.naturalWidth > 0) {
          ctx.drawImage(orbImg, -sz * 0.5, -sz * 0.5, sz, sz * (orbImg.naturalHeight / orbImg.naturalWidth));
        } else {
          const og = ctx.createRadialGradient(0, 0, 4, 0, 0, sz * 0.5);
          og.addColorStop(0, '#93c5fd');
          og.addColorStop(0.5, '#1e3a8a');
          og.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = og;
          ctx.beginPath();
          ctx.arc(0, 0, sz * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // Phase 2 (`p = 0.46..1.0`): 3 staggered hollow sapphire crystal-spiked nova ring detonations!
    if (p >= 0.46 && drawFront) {
      const bpTick = ((p - 0.46) / 0.54) * 11;
      const bursts = [
        { dx: 0, dy: 0 },
        { dx: -95 * sc * dir, dy: -62 * sc },
        { dx: 95 * sc * dir, dy: 42 * sc },
      ];
      for (let b = 0; b < 3; b++) {
        const lf = bpTick - 2 * b;
        if (lf < 0 || lf >= 6.5) continue;
        const ep = lf / 6.5;
        const fade = ep < 0.14 ? ep / 0.14 : Math.pow(1 - ep, 0.72);
        const bx = targetX + bursts[b].dx;
        const by = cy + bursts[b].dy;
        const sz = (220 + Math.pow(ep, 0.55) * 430) * sc;
        if (ep < 0.28) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          drawTaperedStarburst(ctx, bx, by, sz * 0.62 * (1 - ep / 0.30), 16, ep * 2 + b, 'rgba(167,139,250,0.95)', '#faf5ff');
          ctx.restore();
        }
        if (novaImg && novaImg.naturalWidth > 0) {
          ctx.save();
          ctx.translate(bx, by);
          ctx.rotate(b * 0.7 + ep * 0.4);
          ctx.globalAlpha = clamp01(fade * 0.96);
          ctx.drawImage(novaImg, -sz * 0.5, -sz * 0.5, sz, sz);
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = clamp01(fade * 0.62);
          ctx.drawImage(novaImg, -sz * 0.52, -sz * 0.52, sz * 1.04, sz * 1.04);
          ctx.restore();
        }
      }
    }
    ctx.restore();
    return;
  }

  // =========================================================================
  // #07 神雷術 Divine Thunder (sp_037 / sp_038) — Exact 6 staggered colossal vertical thunder columns!
  // =========================================================================
  if (spellId === 7) {
    if (drawBehind) {
      const dim = p < 0.12 ? p / 0.12 : p > 0.78 ? (1 - p) / 0.22 : 1;
      ctx.fillStyle = `rgba(22, 12, 48, ${0.48 * dim})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (!drawFront) {
      ctx.restore();
      return;
    }
    // Authentic `GLOBAL_9145[7]` 6 massive vertical judgment columns cycling across target (`[30,-10,70,20,100,60]` centered ~45)
    const xOffs = [-15, -55, 25, -25, 55, 15];
    const tick = p * 20;
    const pImg = imgs.divinePillar;

    for (let k = 0; k < 6; k++) {
      const localF = tick - 3 * k;
      if (localF < 0 || localF >= 5.2) continue;
      const px = targetX + xOffs[k] * dosX * 1.02 * dir;
      const gy = groundY + 12 * sc;
      const colH = gy + 125 * sc;

      if (localF < 0.95) {
        // `F0`: Massive violet spearhead shooting straight DOWN from sky edge `y=0` to ground `gy`!
        const tp = Math.pow(localF / 0.95, 0.72);
        const tipY = Math.max(80 * sc, tp * (gy + 12 * sc));
        const tipW = (46 + tp * 140) * sc;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        drawLightningBolt(ctx, px, -10, px, tipY, (42 + tp * 30) * sc, 24 * sc, 6, k * 29, 'rgba(124,58,237,0.9)', 'rgba(216,180,254,0.98)', '#ffffff', 1);
        const sg = ctx.createLinearGradient(px, 0, px, tipY);
        sg.addColorStop(0, 'rgba(139,92,246,0.88)');
        sg.addColorStop(0.65, 'rgba(221,214,254,0.95)');
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.moveTo(px - tipW, -8);
        ctx.lineTo(px + tipW, -8);
        ctx.lineTo(px, tipY + 18 * sc);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        // `F1`: Colossal full-height thick royal-violet thunder column (`localF: 0.95..2.05`),
        // `F2..F4`: DISAPPEARS FROM TOP TO BOTTOM (`top-down drain straight down into the ground crater `gy`!`)
        // using a silky feathered vertical gradient mask while narrowing toward a spear!
        const dp = (localF - 0.95) / 4.25; // 0..1 across strike + peel
        const peelT = dp > 0.24 ? Math.pow((dp - 0.24) / 0.76, 1.08) : 0; // sweeps `0 -> 1` (sky `y=0` -> floor `gy`!)
        const topEdgeY = peelT * (gy + 30 * sc);
        const fade = dp > 0.84 ? clamp01((1 - dp) / 0.16) : 1;
        const pinch = Math.max(0.26, 1 - Math.pow(dp, 0.88) * 0.72);
        const fullW = 580 * sc * pinch;
        const halfM = Math.max(120 * sc, fullW * 0.65);

        const drawColCore = (tgt: CanvasRenderingContext2D, ox: number) => {
          // Wide glowing atmospheric core sheath behind the painted spiral bolt column
          const sheathHalf = fullW * 0.44;
          tgt.save();
          tgt.globalCompositeOperation = 'screen';
          const sg = tgt.createLinearGradient(ox - sheathHalf, 0, ox + sheathHalf, 0);
          sg.addColorStop(0, 'rgba(109,40,217,0)');
          sg.addColorStop(0.20, `rgba(124,58,237,${0.62 * fade})`);
          sg.addColorStop(0.42, `rgba(216,180,254,${0.88 * fade})`);
          sg.addColorStop(0.5, `rgba(252,248,255,${0.98 * fade})`);
          sg.addColorStop(0.58, `rgba(216,180,254,${0.88 * fade})`);
          sg.addColorStop(0.80, `rgba(124,58,237,${0.62 * fade})`);
          sg.addColorStop(1, 'rgba(109,40,217,0)');
          tgt.fillStyle = sg;
          tgt.fillRect(ox - sheathHalf, 0, sheathHalf * 2, gy + 12 * sc);
          tgt.restore();

          tgt.save();
          if (pImg && pImg.naturalWidth > 0) {
            tgt.beginPath();
            tgt.rect(0, 0, ox * 2, gy + 14 * sc);
            tgt.clip();
            tgt.translate(ox, (gy + 60 * sc) - colH * 0.5);
            if (k % 2 === 1) tgt.scale(-1, 1);
            tgt.globalAlpha = clamp01(fade * 0.98);
            tgt.drawImage(pImg, -fullW * 0.5, -colH * 0.5, fullW, colH);
            tgt.globalCompositeOperation = 'screen';
            tgt.globalAlpha = clamp01(fade * 0.72);
            tgt.drawImage(pImg, -fullW * 0.58, -colH * 0.5, fullW * 1.16, colH);
          } else {
            tgt.globalCompositeOperation = 'screen';
            drawLightningBolt(tgt, ox, -20, ox, gy, 115 * sc * pinch, 30 * sc, 10, k * 13, 'rgba(124,58,237,0.88)', 'rgba(216,180,254,0.96)', '#ffffff', 0);
          }
          tgt.restore();
        };

        if (peelT > 0.005) {
          // Soft feathered TOP-TO-BOTTOM disappearance mask (`destination-in` vertical band sweeps DOWN from `y=0 -> gy`!)
          const boxW = Math.ceil(halfM * 2);
          const boxH = Math.ceil(gy + 32 * sc);
          const mask = acquireMaskCanvas(boxW, boxH);
          if (mask) {
            drawColCore(mask.mctx, boxW * 0.5);
            const feather = 185 * sc;
            const y0 = Math.max(0, topEdgeY - feather * 0.35);
            const y1 = y0 + feather;
            mask.mctx.save();
            mask.mctx.globalCompositeOperation = 'destination-in';
            const vg = mask.mctx.createLinearGradient(0, y0, 0, y1);
            vg.addColorStop(0, 'rgba(255,255,255,0)');
            vg.addColorStop(0.55, 'rgba(255,255,255,0.68)');
            vg.addColorStop(1, 'rgba(255,255,255,1)');
            mask.mctx.fillStyle = vg;
            mask.mctx.fillRect(0, 0, boxW, boxH);
            mask.mctx.restore();
            ctx.drawImage(mask.canvas, 0, 0, boxW, boxH, px - boxW * 0.5, 0, boxW, boxH);

            // Bright trailing ionization flare & falling spark tail tracking the top falling cutoff (`y = topEdgeY`)!
            if (topEdgeY > 10 * sc && topEdgeY < gy - 12 * sc) {
              ctx.save();
              ctx.globalCompositeOperation = 'screen';
              const tg = ctx.createRadialGradient(px, topEdgeY + 28 * sc, 4 * sc, px, topEdgeY + 28 * sc, fullW * 0.45);
              tg.addColorStop(0, `rgba(252,248,255,${0.86 * fade})`);
              tg.addColorStop(0.45, `rgba(196,181,253,${0.48 * fade})`);
              tg.addColorStop(1, 'rgba(109,40,217,0)');
              ctx.fillStyle = tg;
              ctx.beginPath();
              ctx.ellipse(px, topEdgeY + 28 * sc, fullW * 0.36, 95 * sc, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
          }
        } else {
          // Full solid column (`F1` impact beat — straight fast blit with zero offscreen overhead!)
          ctx.save();
          ctx.translate(px - halfM, 0);
          drawColCore(ctx, halfM);
          ctx.restore();
        }

        // Twin flanking ground spark spikes left & right matching `sp_037 F2/F3`!
        if (dp > 0.14 && dp < 0.92) {
          const sa = Math.sin(((dp - 0.14) / 0.78) * Math.PI);
          const off = (122 + dp * 42) * sc;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          for (const side of [-1, 1]) {
            drawLightningBolt(
              ctx,
              px + side * off,
              gy - 220 * sc * sa,
              px + side * (off * 0.86),
              gy - 4 * sc,
              18 * sc * sa,
              16 * sc,
              4,
              k * 17 + side * 9,
              `rgba(139,92,246,${0.88 * sa})`,
              `rgba(221,214,254,${0.96 * sa})`,
              '#faf5ff'
            );
          }
          ctx.restore();
        }
        // Bright impact shock dome pulsing at ground floor (`glows even as the upper pillar drains down into it!`)
        if (dp < 0.85) {
          const gFade = dp < 0.25 ? 1 : clamp01(1 - (dp - 0.25) / 0.60);
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          drawTaperedStarburst(ctx, px, gy - 24 * sc, 290 * sc * gFade, 10, k * 0.6, 'rgba(167,139,250,0.92)', '#faf5ff');
          ctx.restore();
        }
      }
    }
    ctx.restore();
    return;
  }

  // =========================================================================
  // #08 聖光彈 Holy Bolt (sp_028 / sp_030) — Rapid 12-ray 4-angle lance volley + painted hollow crystal rings!
  // =========================================================================
  if (spellId === 8) {
    if (!drawFront) {
      ctx.restore();
      return;
    }
    // Authentic `GLOBAL_9145[8]`: 4 distinct incoming angles (`groupBases = [0,8,24,16, 8,0,24,16, 0,8,24,16]`)!
    const groups = [0, 1, 3, 2, 1, 0, 3, 2, 0, 1, 3, 2];
    const baseY = groundY - 210 * sc;
    const angles = [
      { sx: 780, sy: 250, ox: -25, oy: -40 },  // 0: from lower-right sweeping up-left (`sp_028 F0..F7`)
      { sx: 820, sy: -260, ox: -10, oy: -120 }, // 1: from upper-right sweeping flat-left (`sp_028 F8..F15`)
      { sx: 840, sy: 10, ox: 20, oy: 40 },     // 2: from mid-right sweeping straight left (`sp_028 F16..F23`)
      { sx: 280, sy: 340, ox: -90, oy: -55 },  // 3: from bottom-right rising steeply (`sp_028 F24..F31`)
    ];
    const tick = p * 30;
    const novaImg = imgs.holyNova ?? imgs.thunderNova;

    for (let k = 0; k < 12; k++) {
      const lf = tick - 2 * k;
      if (lf < 0 || lf >= 8) continue;
      const g = angles[groups[k]];
      const ex = targetX + g.ox * sc * dir;
      const ey = baseY + g.oy * sc;
      const sx = ex + g.sx * sc * dir;
      const sy = ey + g.sy * sc;

      if (lf < 2.2) {
        // Tapered blinding white-sapphire lance shoots straight to impact, then trailing tail chases INTO orb (`sp_028 F0..F2`)!
        const sp = clamp01(lf / 1.35);
        const tailP = lf > 1.05 ? clamp01((lf - 1.05) / 1.15) : 0;
        const headX = sx + (ex - sx) * sp;
        const headY = sy + (ey - sy) * sp;
        const tailX = sx + (ex - sx) * (tailP * 0.94);
        const tailY = sy + (ey - sy) * (tailP * 0.94);
        const ang = Math.atan2(ey - sy, ex - sx);
        const len = Math.max(24 * sc, Math.hypot(headX - tailX, headY - tailY));
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.translate(headX, headY);
        ctx.rotate(ang);
        const wedge = ctx.createLinearGradient(-len, 0, 12 * sc, 0);
        wedge.addColorStop(0, 'rgba(96,165,250,0)');
        wedge.addColorStop(0.45, 'rgba(186,230,253,0.92)');
        wedge.addColorStop(1, '#ffffff');
        ctx.fillStyle = wedge;
        ctx.beginPath();
        ctx.moveTo(0, -14 * sc);
        ctx.arc(0, 0, 14 * sc, -Math.PI * 0.5, Math.PI * 0.5);
        ctx.lineTo(-len, 44 * sc * (1 - tailP * 0.55));
        ctx.lineTo(-len, -44 * sc * (1 - tailP * 0.55));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (lf < 3.0) {
        // Crisp luminous round hit-orb flash (`sp_028 F2`)!
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const og = ctx.createRadialGradient(ex, ey, 4 * sc, ex, ey, 95 * sc);
        og.addColorStop(0, '#ffffff');
        og.addColorStop(0.55, 'rgba(191,219,254,0.95)');
        og.addColorStop(1, 'rgba(96,165,250,0)');
        ctx.fillStyle = og;
        ctx.beginPath();
        ctx.arc(ex, ey, 95 * sc, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // Hollow spiky sapphire crystal ring burst (`sp_028 F3..F7`!) using hand-painted `fx_thunder_nova.webp`!
        const ep = (lf - 3.0) / 5.0;
        const fade = Math.pow(1 - ep, 0.72);
        const sz = (170 + Math.pow(ep, 0.6) * 290) * sc;
        if (novaImg && novaImg.naturalWidth > 0) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.translate(ex, ey);
          ctx.rotate(k * 0.55 + ep * 0.25);
          ctx.globalAlpha = clamp01(fade * 0.96);
          ctx.drawImage(novaImg, -sz * 0.5, -sz * 0.5, sz, sz);
          ctx.restore();
        } else {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          drawTaperedStarburst(ctx, ex, ey, sz * 0.5, 14, k * 0.4, `rgba(147,197,253,${fade})`, `rgba(255,255,255,${fade})`);
          ctx.restore();
        }
        // Soft warm holy gold sheen in early crystal burst frame
        if (ep < 0.35) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          drawTaperedStarburst(ctx, ex, ey, 140 * sc * (1 - ep / 0.35), 8, k * 0.8, 'rgba(254,240,138,0.85)', '#ffffff');
          ctx.restore();
        }
      }
    }
    ctx.restore();
    return;
  }

  // =========================================================================
  // #09 咒殺術 Death Curse (sp_044) — Crimson Grim Reaper + Haunted Skull Pillar!
  // =========================================================================
  if (spellId === 9) {
    if (!drawFront) {
      ctx.restore();
      return;
    }
    const dim = p < 0.14 ? p / 0.14 : p > 0.85 ? (1 - p) / 0.15 : 1;
    ctx.fillStyle = `rgba(8, 18, 10, ${0.58 * dim})`;
    ctx.fillRect(0, 0, W, H);

    // Phase 1 (0..0.50): Authentic FD2 `sp_044 F0` ominous stationary Grim Reaper apparition:
    //   Fade in smoothly -> rock-still brooding presence with brief ghostly flash/flicker pulses -> fade out cleanly
    //   (zero sideways slide, zero vertical wobble, zero rotation tilt!).
    if (p < 0.52) {
      const rp = p / 0.52;
      const baseFade = rp < 0.22 ? rp / 0.22 : rp > 0.76 ? clamp01((1 - rp) / 0.24) : 1;
      const rImg = imgs.reaper;
      if (rImg && rImg.naturalWidth > 0) {
        const rh = 650 * sc;
        const rw = (rh * rImg.naturalWidth) / rImg.naturalHeight;
        // Looming overhead apparition locked strictly stationary (`sc` scaled; hood left-of-scythe framing target!)
        const rx = targetX - dir * 55 * sc;
        const ry = groundY - rh * 0.92;

        // 3 ominous ghostly spectral flicker/flash beats in the middle window (`rp = 0.22..0.76`)
        let flickerAlpha = 1.0;
        let flashBoost = 0.0;
        if (rp >= 0.22 && rp <= 0.76) {
          const mp = (rp - 0.22) / 0.54; // 0..1 across 3 crisp haunting flashes
          const wave = Math.sin(mp * Math.PI * 6); // 3 bright peaks / 3 dim troughs
          flickerAlpha = 0.58 + 0.42 * (wave * 0.5 + 0.5);
          flashBoost = Math.pow(Math.max(0, wave), 3) * 0.65;
        }

        const finalAlpha = clamp01(baseFade * flickerAlpha * 0.96);

        // Subtle eerie necrotic emerald backlight aura behind the still looming shroud
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const wg = ctx.createRadialGradient(rx, ry + rh * 0.44, 24 * sc, rx, ry + rh * 0.44, rw * 0.54);
        wg.addColorStop(0, `rgba(132, 204, 22, ${(0.24 + flashBoost * 0.36) * baseFade})`);
        wg.addColorStop(0.55, `rgba(22, 101, 52, ${(0.16 + flashBoost * 0.22) * baseFade})`);
        wg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = wg;
        ctx.beginPath();
        ctx.arc(rx, ry + rh * 0.44, rw * 0.54, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Stationary Reaper sprite (`ZERO translation wobble, ZERO tilt!`)
        ctx.save();
        ctx.translate(rx, ry + rh * 0.5);
        if (targetIsHeroSide) ctx.scale(-1, 1);
        ctx.globalAlpha = finalAlpha;
        ctx.drawImage(rImg, -rw * 0.5, -rh * 0.5, rw, rh);
        // Brief additive spectral glow flash between fades echoing `FD2.EXE` strobe frames
        if (flashBoost > 0.02) {
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = clamp01(baseFade * flashBoost);
          ctx.drawImage(rImg, -rw * 0.5, -rh * 0.5, rw, rh);
        }
        ctx.restore();

        // Brief eerie soft emerald atmospheric flash pulse across the screen on strobe peaks
        if (flashBoost > 0.18) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.fillStyle = `rgba(190, 242, 100, ${baseFade * (flashBoost - 0.18) * 0.22})`;
          ctx.fillRect(0, 0, W, H);
          ctx.restore();
        }
      }
    }

    // Phase 2 (0.40..1.0): Translucent Haunted Emerald Coffin Pillar + Screaming Wraith Skull!
    if (p >= 0.40) {
      const cp = (p - 0.40) / 0.60;
      const cFade = cp < 0.14 ? cp / 0.14 : cp > 0.78 ? (1 - cp) / 0.22 : 1;
      const pW = 240 * sc * (0.85 + 0.15 * Math.sin(cp * Math.PI));
      const pTop = -20 * sc;
      const colGrad = ctx.createLinearGradient(targetX - pW, 0, targetX + pW, 0);
      colGrad.addColorStop(0, 'rgba(34, 80, 18, 0)');
      colGrad.addColorStop(0.14, `rgba(74, 134, 34, ${0.52 * cFade})`);
      colGrad.addColorStop(0.5, `rgba(163, 230, 53, ${0.44 * cFade})`);
      colGrad.addColorStop(0.86, `rgba(74, 134, 34, ${0.52 * cFade})`);
      colGrad.addColorStop(1, 'rgba(34, 80, 18, 0)');
      ctx.fillStyle = colGrad;
      ctx.fillRect(targetX - pW, pTop, pW * 2, groundY - pTop + 18 * sc);

      // Floor elliptic dark-jade seal ring
      ctx.save();
      ctx.translate(targetX, groundY - 6 * sc);
      ctx.scale(1, 0.25);
      ctx.strokeStyle = `rgba(190, 242, 100, ${0.8 * cFade})`;
      ctx.lineWidth = 9 * sc;
      ctx.beginPath();
      ctx.arc(0, 0, pW * 0.88, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Painted hovering screaming ghost skull rising straight up inside the emerald cylinder!
      const sImg = imgs.skull;
      if (sImg && sImg.naturalWidth > 0) {
        const sH = 440 * sc;
        const sW = (sH * sImg.naturalWidth) / sImg.naturalHeight;
        const riseY = groundY - 210 * sc - cp * 210 * sc;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = clamp01(Math.sin(Math.min(1, cp * 1.15) * Math.PI) * 1.15);
        ctx.drawImage(sImg, targetX - sW * 0.5, riseY - sH * 0.5, sW, sH);
        ctx.restore();
      }
    }
    ctx.restore();
    return;
  }

  // =========================================================================
  // #32 熾天使 SERAPH SUMMON (sp_065) — Towering White Angel + Sky Lightning!
  // =========================================================================
  if (spellId === 32) {
    if (!drawFront) {
      ctx.restore();
      return;
    }
    const enter = clamp01(p / 0.20);
    const fade = p > 0.84 ? (1 - p) / 0.16 : 1;
    // Dramatic indigo cathedral sky tint
    ctx.fillStyle = `rgba(10, 18, 48, ${0.62 * enter * fade})`;
    ctx.fillRect(0, 0, W, H);

    // Radiant golden aura behind soaring white wings
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const gGlow = ctx.createRadialGradient(W * 0.54, H * 0.44, 30 * sc, W * 0.54, H * 0.44, 580 * sc);
    gGlow.addColorStop(0, `rgba(254, 249, 195, ${0.62 * enter * fade})`);
    gGlow.addColorStop(0.45, `rgba(56, 189, 248, ${0.36 * enter * fade})`);
    gGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gGlow;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // Jagged blue-white lightning bolts webbing the entire screen around the Seraph (`sp_065 F1..F4!`)
    if (p > 0.18) {
      const lp = clamp01((p - 0.18) / 0.65);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const tick = Math.floor(p * 16);
      const webTargets: Array<[number, number, number, number]> = [
        [W * 0.54, H * 0.44, 0, H * 0.18],
        [W * 0.54, H * 0.44, 0, H * 0.65],
        [W * 0.54, H * 0.44, W, H * 0.14],
        [W * 0.54, H * 0.44, W, H * 0.72],
        [W * 0.54, H * 0.44, W * 0.28, H],
        [W * 0.54, H * 0.44, W * 0.78, H],
        [W * 0.54, H * 0.44, W * 0.22, 0],
        [W * 0.54, H * 0.44, W * 0.85, 0],
      ];
      const activeCnt = Math.min(webTargets.length, Math.ceil(lp * webTargets.length) + 1);
      for (let i = 0; i < activeCnt; i++) {
        const [x0, y0, x1, y1] = webTargets[i];
        drawLightningBolt(
          ctx,
          x0,
          y0,
          x1,
          y1,
          (28 + (i % 2) * 14) * sc * fade,
          68 * sc,
          10,
          i * 37 + tick * 11,
          `rgba(37,99,235,${0.72 * fade})`,
          `rgba(125,211,252,${0.95 * fade})`,
          `rgba(255,255,255,${fade})`,
          1
        );
      }
      ctx.restore();
    }

    // Colossal painted Seraph sprite hovering above arena!
    const sImg = imgs.seraph;
    if (sImg && sImg.naturalWidth > 0) {
      const sh = 790 * sc;
      const sw = (sh * sImg.naturalWidth) / sImg.naturalHeight;
      const hoverY = Math.sin(p * Math.PI * 3) * 14 * sc - (1 - enter) * 130 * sc;
      ctx.save();
      ctx.globalAlpha = clamp01(enter * fade);
      ctx.drawImage(sImg, W * 0.54 - sw * 0.5, H * 0.06 + hoverY, sw, sh);
      ctx.restore();
    }

    // Triumphant lightning screen flash peak near p ~ 0.68 (subtle enough to keep baroque gold filigree razor-crisp!)
    if (p > 0.58 && p < 0.88) {
      const fp = Math.sin(((p - 0.58) / 0.30) * Math.PI);
      ctx.fillStyle = `rgba(224, 242, 254, ${fp * 0.28})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
    return;
  }

  // =========================================================================
  // #33 風妖精 WIND FAIRY / SYLPH SUMMON (sp_066) — Ice-Blue Healing Sphere!
  // =========================================================================
  if (spellId === 33) {
    if (!drawFront) {
      ctx.restore();
      return;
    }
    const enter = clamp01(p / 0.20);
    const fade = p > 0.85 ? (1 - p) / 0.15 : 1;
    ctx.fillStyle = `rgba(12, 34, 62, ${0.46 * enter * fade})`;
    ctx.fillRect(0, 0, W, H);

    // Swirling luminous wind ribbons & azure petals
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let k = 0; k < 20; k++) {
      const ang = p * Math.PI * 3.5 + k * 0.314;
      const rad = (120 + (k % 5) * 85) * sc;
      const px = W * 0.52 + Math.cos(ang) * rad * 1.4;
      const py = H * 0.52 + Math.sin(ang) * rad * 0.45 - ((p * 240 + k * 25) % 380) * sc + 160 * sc;
      ctx.fillStyle = `rgba(186, 230, 253, ${0.72 * enter * fade})`;
      ctx.beginPath();
      ctx.ellipse(px, py, 9 * sc, 4 * sc, ang, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const sImg = imgs.sylph;
    if (sImg && sImg.naturalWidth > 0) {
      const sh = 680 * sc;
      const sw = (sh * sImg.naturalWidth) / sImg.naturalHeight;
      const floatY = Math.sin(p * Math.PI * 2.5) * 20 * sc + (1 - enter) * 90 * sc;
      ctx.save();
      ctx.globalAlpha = clamp01(enter * fade);
      ctx.drawImage(sImg, W * 0.52 - sw * 0.5, H * 0.11 + floatY, sw, sh);
      ctx.restore();
    }

    // Signature DOS sp_066 expanding glowing sky-blue healing sphere flooding screen!
    if (p > 0.44) {
      const sp = clamp01((p - 0.44) / 0.46);
      const r = Math.pow(sp, 2.2) * W * 0.90;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const sg = ctx.createRadialGradient(W * 0.48, H * 0.34, 4, W * 0.48, H * 0.34, Math.max(8, r));
      sg.addColorStop(0, `rgba(255, 255, 255, ${0.92 * fade})`);
      sg.addColorStop(0.55, `rgba(186, 230, 253, ${0.78 * fade})`);
      sg.addColorStop(0.92, `rgba(125, 211, 252, ${0.42 * fade})`);
      sg.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(W * 0.48, H * 0.34, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    return;
  }

  // =========================================================================
  // #34 破壞神 DESTROYER GOD SUMMON (sp_067) — Crimson War God & Red Nova!
  // =========================================================================
  if (spellId === 34) {
    if (!drawFront) {
      ctx.restore();
      return;
    }
    const enter = clamp01(p / 0.22);
    const fade = p > 0.85 ? (1 - p) / 0.15 : 1;
    ctx.fillStyle = `rgba(38, 6, 8, ${0.58 * enter * fade})`;
    ctx.fillRect(0, 0, W, H);

    // Backlit fiery amber shockwave behind rearing black warhorse
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const bgG = ctx.createRadialGradient(W * 0.52, H * 0.48, 25 * sc, W * 0.52, H * 0.48, 490 * sc);
    bgG.addColorStop(0, `rgba(239, 68, 68, ${0.55 * enter * fade})`);
    bgG.addColorStop(0.6, `rgba(185, 28, 28, ${0.28 * enter * fade})`);
    bgG.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bgG;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    const sImg = imgs.destroyer;
    if (sImg && sImg.naturalWidth > 0) {
      const sh = 740 * sc;
      const sw = (sh * sImg.naturalWidth) / sImg.naturalHeight;
      const rear = (1 - Math.pow(1 - enter, 3)) * 0 + (1 - enter) * 160 * sc;
      const stomp = p > 0.22 ? Math.sin(p * Math.PI * 6) * 8 * sc : 0;
      ctx.save();
      ctx.globalAlpha = clamp01(enter * fade);
      ctx.drawImage(sImg, W * 0.51 - sw * 0.5 + rear, H * 0.08 + stomp, sw, sh);
      ctx.restore();
    }

    // Iconic DOS sp_067 expanding blood-crimson war-aura sphere!
    if (p > 0.44) {
      const sp = clamp01((p - 0.44) / 0.46);
      const r = Math.pow(sp, 2.25) * W * 0.88;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const rg = ctx.createRadialGradient(W * 0.62, H * 0.36, 4, W * 0.62, H * 0.36, Math.max(8, r));
      rg.addColorStop(0, `rgba(255, 210, 180, ${0.88 * fade})`);
      rg.addColorStop(0.35, `rgba(239, 68, 68, ${0.82 * fade})`);
      rg.addColorStop(0.85, `rgba(185, 28, 28, ${0.58 * fade})`);
      rg.addColorStop(1, 'rgba(127, 29, 29, 0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(W * 0.62, H * 0.36, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    return;
  }

  // =========================================================================
  // #35 暗邪鬼 DARK FIEND SUMMON (sp_068) — Blue Imp + Swirling Emerald Curse / Debuff Fog!
  // =========================================================================
  if (spellId === 35) {
    if (!drawFront) {
      ctx.restore();
      return;
    }
    const enter = clamp01(p / 0.20);
    const fade = p > 0.82 ? clamp01((1 - p) / 0.18) : 1;
    // Sinister eerie emerald twilight tint blanketing the arena
    ctx.fillStyle = `rgba(10, 28, 14, ${0.58 * enter * fade})`;
    ctx.fillRect(0, 0, W, H);

    const fogImg = imgs.curseFog;
    const sImg = imgs.fiend;
    const hoverY = Math.sin(p * Math.PI * 4.5) * 14 * sc;
    const fSh = 670 * sc;
    const fSw = sImg && sImg.naturalWidth > 0 ? (fSh * sImg.naturalWidth) / sImg.naturalHeight : 700 * sc;
    const fX0 = W * 0.51 - fSw * 0.5;
    const fY0 = H * 0.11 + hoverY + (1 - enter) * 100 * sc;
    const lHandX = fX0 + fSw * 0.088;
    const lHandY = fY0 + fSh * 0.118;
    const rHandX = fX0 + fSw * 0.842;
    const rHandY = fY0 + fSh * 0.205;

    // 1) Deep swirling emerald curse halo & backlit toxic miasma drifting BEHIND the Dark Fiend
    {
      const mistP = clamp01((p - 0.06) / 0.86);
      const mistA = clamp01(enter * fade);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const backGlow = ctx.createRadialGradient(W * 0.51, H * 0.44, 40 * sc, W * 0.51, H * 0.44, 680 * sc);
      backGlow.addColorStop(0, `rgba(132, 204, 22, ${0.42 * mistA})`);
      backGlow.addColorStop(0.45, `rgba(34, 197, 94, ${0.24 * mistA})`);
      backGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = backGlow;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      if (fogImg && fogImg.naturalWidth > 0) {
        const fwBack = 1480 * sc * (0.72 + 0.55 * mistP);
        const fhBack = (fwBack * fogImg.naturalHeight) / fogImg.naturalWidth;
        ctx.save();
        ctx.globalAlpha = clamp01(mistA * 0.62 * (0.5 + 0.5 * mistP));
        ctx.drawImage(fogImg, W * 0.50 - fwBack * 0.5 - mistP * 90 * sc, H * 0.42 - fhBack * 0.5, fwBack, fhBack);
        ctx.restore();
      }
    }

    // 2) Draw our colossal sculpted blue-purple heavy-ornament Dark Fiend hovering heroically!
    if (sImg && sImg.naturalWidth > 0) {
      ctx.save();
      ctx.globalAlpha = clamp01(enter * fade);
      ctx.drawImage(sImg, fX0, fY0, fSw, fSh);
      ctx.restore();
    }

    // 3) Swirling toxic green curse/debuff miasma fog pouring straight outward from BOTH clawed hands
    //    and blanketing the battlefield floor & mid-air in billowing overlapping waves!
    if (p > 0.12) {
      const fp = clamp01((p - 0.12) / 0.78);
      const fogFade = fp < 0.18 ? fp / 0.18 : fade;
      const spread = 1 - Math.pow(1 - Math.min(1, fp * 1.45), 2.1);

      // Soft toxic emerald energy vents blooming at BOTH splayed clawed palms (NO thunderbolt stripes!)
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (const [hx, hy] of [
        [lHandX, lHandY],
        [rHandX, rHandY],
      ]) {
        const rPalm = (110 + spread * 145) * sc;
        const pg = ctx.createRadialGradient(hx, hy, 6 * sc, hx, hy, rPalm);
        pg.addColorStop(0, `rgba(236, 252, 203, ${0.86 * fogFade})`);
        pg.addColorStop(0.28, `rgba(163, 230, 53, ${0.62 * fogFade})`);
        pg.addColorStop(0.62, `rgba(22, 163, 74, ${0.28 * fogFade})`);
        pg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(hx, hy, rPalm, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (fogImg && fogImg.naturalWidth > 0) {
        const drawPlume = (
          cx: number,
          cy: number,
          pw: number,
          rot: number,
          alpha: number,
          flipX: boolean,
          screenGlow = false
        ) => {
          const ph = (pw * fogImg.naturalHeight) / fogImg.naturalWidth;
          ctx.save();
          if (screenGlow) ctx.globalCompositeOperation = 'screen';
          ctx.translate(cx, cy);
          ctx.rotate(rot);
          if (flipX) ctx.scale(-1, 1);
          ctx.globalAlpha = clamp01(alpha);
          ctx.drawImage(fogImg, -pw * 0.5, -ph * 0.5, pw, ph);
          ctx.restore();
        };

        // Twin curving toxic plumes billowing straight outward LEFT and RIGHT from both outstretched palms!
        drawPlume(
          lHandX - spread * 280 * sc,
          lHandY + spread * 180 * sc,
          (480 + spread * 560) * sc,
          -0.22 - fp * 0.14,
          fogFade * 0.76,
          false
        );
        drawPlume(
          rHandX + spread * 280 * sc,
          rHandY + spread * 170 * sc,
          (480 + spread * 560) * sc,
          0.22 + fp * 0.14,
          fogFade * 0.76,
          true
        );

        // Two counter-drifting wide lower rolling curse-fog banks engulfing the entire battlefield foreground!
        drawPlume(
          W * 0.34 - fp * 170 * sc,
          H * 0.78 - spread * 65 * sc,
          (1180 + spread * 460) * sc,
          0.03 * Math.sin(fp * 5),
          fogFade * 0.84,
          false
        );
        drawPlume(
          W * 0.68 + fp * 170 * sc,
          H * 0.76 - spread * 75 * sc,
          (1180 + spread * 460) * sc,
          -0.03 * Math.cos(fp * 5),
          fogFade * 0.84,
          true
        );

        // Soft luminous chartreuse mid-fog crest haze swirling gently forward during peak debuff release (`fp > 0.35`)
        if (fp > 0.25) {
          const hp = clamp01((fp - 0.25) / 0.75);
          drawPlume(
            W * 0.50 + Math.sin(fp * 6) * 65 * sc,
            H * 0.60 - hp * 110 * sc,
            (920 + hp * 640) * sc,
            Math.sin(fp * 3) * 0.08,
            fogFade * 0.34 * Math.sin(hp * Math.PI),
            false,
            true
          );
        }
      }

      // Soft toxic creeping chartreuse fog veil tint across lower half so the debuff haze blankets every edge
      const hazeG = ctx.createLinearGradient(0, H * 0.18, 0, H);
      hazeG.addColorStop(0, `rgba(22, 101, 52, ${0.06 * spread * fogFade})`);
      hazeG.addColorStop(0.55, `rgba(77, 124, 15, ${0.22 * spread * fogFade})`);
      hazeG.addColorStop(1, `rgba(101, 163, 13, ${0.38 * spread * fogFade})`);
      ctx.fillStyle = hazeG;
      ctx.fillRect(0, 0, W, H);

      // Slowly rising drifting toxic glowing chartreuse spores & floating debuff wisps!
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 36; i++) {
        const u = (fp * 0.9 + i * 0.063) % 1;
        const sx = ((i * 197 + 43) % 1000) * 0.001 * W + Math.sin(u * 6.2 + i) * 58 * sc;
        const sy = H * 0.94 - u * H * 0.82;
        const r = (3.5 + (i % 4) * 2.8) * sc * Math.sin(u * Math.PI);
        if (r <= 0.5) continue;
        const sg = ctx.createRadialGradient(sx, sy, 0.5, sx, sy, r * 2.2);
        sg.addColorStop(0, `rgba(236, 252, 203, ${0.9 * fogFade * Math.sin(u * Math.PI)})`);
        sg.addColorStop(0.45, `rgba(163, 230, 53, ${0.58 * fogFade * Math.sin(u * Math.PI)})`);
        sg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(sx, sy, r * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
    return;
  }

  ctx.restore();
}
