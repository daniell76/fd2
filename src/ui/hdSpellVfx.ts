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

export const HD_SPELL_ASSET_VERSION = '?v=91';

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
    hitTimesMs: [360, 620, 880],
    durationMs: 1420,
    paintedSprite: 'spell_02_dragon.webp',
    secondarySprite: 'spell_02_breath.webp',
    accentColor: '#f59e0b',
    summaryZh: '手繪赤焰炎龍凌空嘶吼，噴吐熾烈龍炎席捲敵陣 (sp_026/027)',
    summaryEn: 'Painted roaring Flame Dragon blasting molten golden breath (sp_026/027)',
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
  dragonBreath: HTMLImageElement | null;
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
  dragonBreath: null,
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
    loadOptImg(`${base}/spell_02_breath.webp${versionTag}`),
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
      dragonBreath,
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
      spellImages.dragonBreath = dragonBreath;
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
 *   - `0..4.5`  (F0–F4): Thin blazing spark needle plunges vertically from sky straight to ground.
 *   - `4.0..8.8`(F5–F8): Elliptical glowing magma / plasma disc widens under column base.
 *   - `8.0..12.6`(F9–F12): Heavy-detail hand-painted spiral flame column erupts surging skyward.
 *   - `12.4..16`(F13–F15): Entire pillar DETACHES from ground & rockets straight UP off the top edge!
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
  const phase = localF / totalF; // normalized 0..1 inside this single pillar!

  // 1) Falling luminous spark needle (`F0..F4`, fast top-down drop straight into floor)
  if (phase < 0.30) {
    const dp = phase / 0.30;
    const headY = -40 * sc + dp * (gy + 40 * sc);
    const tailY = Math.max(-80 * sc, headY - (120 + (1 - dp) * 260) * sc);
    const a = dp > 0.85 ? (1 - dp) / 0.15 : 1;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const ng = ctx.createLinearGradient(x, tailY, x, headY);
    ng.addColorStop(0, 'rgba(0,0,0,0)');
    ng.addColorStop(0.65, isBlue ? `rgba(56,189,248,${0.88 * a * alphaScale})` : `rgba(249,115,22,${0.88 * a * alphaScale})`);
    ng.addColorStop(1, `rgba(255,255,245,${0.98 * a * alphaScale})`);
    ctx.strokeStyle = ng;
    ctx.lineCap = 'round';
    ctx.lineWidth = (isBlue ? 12 : 10) * sc;
    ctx.beginPath();
    ctx.moveTo(x, tailY);
    ctx.lineTo(x, headY);
    ctx.stroke();
    drawTaperedStarburst(
      ctx,
      x,
      headY,
      26 * sc * a,
      4,
      0,
      isBlue ? 'rgba(96,165,250,0.9)' : 'rgba(251,146,60,0.9)',
      '#ffffff'
    );
    ctx.restore();
  }

  // 2) Glowing caldera puddle disc widening under column (`F5..F12`)
  if (phase >= 0.25 && phase < 0.82) {
    const pp = (phase - 0.25) / 0.57;
    const expand = Math.min(1, pp * 3.0);
    const fade = pp > 0.65 ? (1 - pp) / 0.35 : 1;
    const rad = width * (0.42 + 0.48 * expand);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.translate(x, gy);
    ctx.scale(1, 0.27);
    const dg = ctx.createRadialGradient(0, 0, 2, 0, 0, Math.max(8, rad));
    if (isBlue) {
      dg.addColorStop(0, `rgba(240,249,255,${0.92 * fade * alphaScale})`);
      dg.addColorStop(0.45, `rgba(56,189,248,${0.78 * fade * alphaScale})`);
      dg.addColorStop(0.85, `rgba(37,99,235,${0.45 * fade * alphaScale})`);
    } else {
      dg.addColorStop(0, `rgba(255,248,200,${0.92 * fade * alphaScale})`);
      dg.addColorStop(0.45, `rgba(249,115,22,${0.78 * fade * alphaScale})`);
      dg.addColorStop(0.85, `rgba(220,38,38,${0.48 * fade * alphaScale})`);
    }
    dg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 3) Erupting hand-painted heavy-detail flame pillar (`F9..F12`) → DETACHES & ROCKETS SKYWARD (`F13..F15`)!
  if (phase >= 0.46) {
    const ep = (phase - 0.46) / 0.54; // 0..1 from base rise -> top launch!
    const riseGrow = clamp01(ep / 0.22);
    const curH = maxH * (0.28 + 0.72 * Math.sin(riseGrow * Math.PI * 0.5));
    // Launch straight off the floor skyward past `y=0` during second half (`exact DOS F13–F15 feel!`)
    const liftT = ep > 0.48 ? Math.pow((ep - 0.48) / 0.52, 1.45) : 0;
    const baseLiftY = gy - liftT * (gy + maxH * 0.65);
    const fadeOut = ep < 0.08 ? ep / 0.08 : ep > 0.76 ? clamp01((1 - ep) / 0.24) : 1;
    const pulseW = width * (1 + Math.sin(localF * 2.8) * 0.08) * (1 - liftT * 0.22);

    if (img && img.naturalWidth > 0) {
      const topY = baseLiftY - curH;
      ctx.save();
      ctx.globalAlpha = clamp01(fadeOut * alphaScale * 0.96);
      ctx.translate(x, topY + curH * 0.5);
      if (flipX) ctx.scale(-1, 1);
      // Warm soft under-glow right behind the pillar
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const glowR = Math.max(pulseW * 0.85, curH * 0.28);
      const bgG = ctx.createRadialGradient(0, 0, pulseW * 0.05, 0, 0, glowR);
      bgG.addColorStop(0, isBlue ? `rgba(186,230,253,${0.48 * fadeOut})` : `rgba(254,215,102,${0.48 * fadeOut})`);
      bgG.addColorStop(0.55, isBlue ? `rgba(37,99,235,${0.26 * fadeOut})` : `rgba(220,38,38,${0.28 * fadeOut})`);
      bgG.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bgG;
      ctx.beginPath();
      ctx.ellipse(0, 0, pulseW * 0.88, curH * 0.54, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Primary richly painted spiral dragonfire column (`source-over` preserves crimson/indigo curls!)
      ctx.drawImage(img, -pulseW * 0.5, -curH * 0.5, pulseW, curH);
      // Luminous subtle additive core overlay for dynamic shimmering flare
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = clamp01(fadeOut * alphaScale * 0.42);
      ctx.drawImage(img, -pulseW * 0.48, -curH * 0.52, pulseW * 0.96, curH * 1.04);
      ctx.restore();
    } else {
      drawOrganicFlamePillar(
        ctx,
        x,
        baseLiftY,
        curH,
        pulseW * 0.4,
        localF * 0.08,
        isBlue
          ? { outer: 'rgba(37,99,235,0.52)', mid: 'rgba(56,189,248,0.78)', core: 'rgba(224,242,254,0.92)', hot: 'rgba(255,255,255,0.98)' }
          : { outer: 'rgba(220,38,38,0.52)', mid: 'rgba(249,115,22,0.78)', core: 'rgba(254,215,102,0.9)', hot: 'rgba(255,252,235,0.96)' },
        fadeOut * alphaScale
      );
    }

    // Spark embers bursting off the climbing bottom tail during liftoff (`F13..F15`)
    if (liftT > 0.02 && liftT < 0.92) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = isBlue ? `rgba(224,242,254,${0.85 * fadeOut})` : `rgba(254,240,138,${0.85 * fadeOut})`;
      for (let s = 0; s < 5; s++) {
        const sx = x + Math.sin(s * 5.7 + localF * 2.1) * pulseW * 0.36;
        const sy = baseLiftY + s * 22 * sc + (liftT * 90 * sc);
        if (sy <= gy + 12 * sc) {
          ctx.beginPath();
          ctx.ellipse(sx, sy, 2.8 * sc, 7.5 * sc, 0, 0, Math.PI * 2);
          ctx.fill();
        }
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
  // #02 炎龍術 Flame Dragon (sp_026 / sp_027) — Baroque Roaring Dragon + Hand-Painted Mouth Breath Wave!
  // =========================================================================
  if (spellId === 2) {
    if (!drawFront) {
      ctx.restore();
      return;
    }
    const enter = clamp01(p / 0.22);
    const exitFade = p > 0.80 ? clamp01((1 - p) / 0.20) : 1;
    // Cinematic warm volcanic twilight scrim so ornate golden scales & painted roaring breath pop vividly
    ctx.fillStyle = `rgba(22, 7, 4, ${0.46 * enter * exitFade})`;
    ctx.fillRect(0, 0, W, H);

    // Coordinate space mirrored smoothly around canvas center when an enemy casts Flame Dragon at a hero!
    ctx.save();
    if (targetIsHeroSide) {
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
    }

    const dragSlide = 1 - Math.pow(1 - enter, 3);
    const dImg = imgs.dragon;
    const bImg = imgs.dragonBreath;
    const dw = 820 * sc;
    const dh = dImg && dImg.naturalWidth > 0 ? (dw * dImg.naturalHeight) / dImg.naturalWidth : 651 * sc;
    // Base upper-right frame sweeping smoothly inward-left (matching 1995 DOS sp_026 F15, horns & bottom waves unclipped!)
    const dx0 = W - dw + 46 * sc + (1 - dragSlide) * 440 * sc;
    const dy0 = 6 * sc - (1 - dragSlide) * 120 * sc;
    const roarBob = p > 0.20 ? Math.sin(p * Math.PI * 10) * 7 * sc * exitFade : 0;
    const dTop = dy0 + roarBob;

    // Exact open glowing molten throat core inside `spell_02_dragon.webp` (nx=0.244, ny=0.551)
    const throatX = dx0 + dw * 0.244;
    const throatY = dTop + dh * 0.551;

    // 1) Charging incandescent throat core before & during breath eruption
    const chargeFade = p < 0.22 ? clamp01(p / 0.22) : exitFade;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const backGlow = ctx.createRadialGradient(dx0 + dw * 0.44, dTop + dh * 0.48, 40 * sc, dx0 + dw * 0.44, dTop + dh * 0.48, dw * 0.62);
    backGlow.addColorStop(0, `rgba(255, 165, 40, ${0.42 * chargeFade})`);
    backGlow.addColorStop(0.55, `rgba(220, 38, 38, ${0.20 * chargeFade})`);
    backGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = backGlow;
    ctx.beginPath();
    ctx.arc(dx0 + dw * 0.44, dTop + dh * 0.48, dw * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2) Authentic hand-painted swirling dragonfire breath (`spell_02_breath.webp`, remade from sp_026 F17!)
    //    Drawn FIRST directly beneath `spell_02_dragon.webp` so the open jaws & razor fangs literally frame the stream!
    if (p >= 0.16) {
      const bp = clamp01((p - 0.16) / 0.66);
      // Fast dramatic eruption sweep straight down-left from the roaring jaws (0..1 over ~230ms!)
      const sweep = clamp01(bp / 0.28);
      const bEase = 1 - Math.pow(1 - sweep, 2.4);
      const bFade = bp < 0.08 ? bp / 0.08 : exitFade;

      if (bImg && bImg.naturalWidth > 0) {
        // Fit heroically from throat straight diagonally down-left across the target enemy (100% unclipped inside 900px height!)
        const bw = 960 * sc;
        const bh = (bw * bImg.naturalHeight) / bImg.naturalWidth;
        // Exact top-right pressurized nozzle coordinate inside `spell_02_breath.webp` (`nx=0.931, ny=0.073`)
        const nozX = bw * 0.931;
        const nozY = bh * 0.073;
        // Anchor nozzle firmly tucked INSIDE the roaring open throat (slightly right & up of teeth gap)
        const bx0 = throatX - nozX + 26 * sc;
        const by0 = throatY - nozY - 16 * sc;

        // Subtle animated pulsing billowing waves matching twin DOS blast frames (F16 <-> F17)
        const waveScaleX = 1 + Math.sin(p * Math.PI * 18) * 0.025;
        const waveScaleY = 1 + Math.cos(p * Math.PI * 14) * 0.038;
        const tiltJitter = Math.sin(p * Math.PI * 12) * 0.024;

        // Ambient radial fiery blaze halo under the painted curling flame waves so target burns vividly
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const blazeX = bx0 + bw * (1 - 0.58 * bEase);
        const blazeY = by0 + bh * 0.66;
        const bgFire = ctx.createRadialGradient(blazeX, blazeY, 24 * sc, blazeX, blazeY, 460 * sc * bEase);
        bgFire.addColorStop(0, `rgba(254, 240, 138, ${0.46 * bFade * bEase})`);
        bgFire.addColorStop(0.45, `rgba(249, 115, 22, ${0.38 * bFade * bEase})`);
        bgFire.addColorStop(0.82, `rgba(220, 38, 38, ${0.18 * bFade * bEase})`);
        bgFire.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bgFire;
        ctx.beginPath();
        ctx.arc(blazeX, blazeY, 460 * sc * Math.max(0.2, bEase), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Progressive jet-sweep circular clip anchored at the dragon's mouth (`expands outward ↙ during eruption!`)
        const maxReach = Math.hypot(bw * 1.15, bh * 1.15);
        const clipR = Math.max(40 * sc, maxReach * bEase);

        ctx.save();
        ctx.beginPath();
        ctx.arc(throatX, throatY, clipR, 0, Math.PI * 2);
        ctx.clip();

        // Primary rich hand-painted roaring dragonfire wave (`source-over` keeps deep crimson wave crests!)
        ctx.save();
        ctx.translate(throatX, throatY);
        ctx.rotate(tiltJitter);
        ctx.scale(waveScaleX, waveScaleY);
        ctx.globalAlpha = clamp01(bFade * 0.98);
        ctx.drawImage(bImg, bx0 - throatX, by0 - throatY, bw, bh);
        ctx.restore();

        // Second slightly phase-shifted additive surge layer giving silky blazing luminous flicker & shimmer!
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.translate(throatX, throatY);
        ctx.rotate(-tiltJitter * 0.7);
        ctx.scale(1.02 + Math.cos(p * Math.PI * 22) * 0.025, 1.01 + Math.sin(p * Math.PI * 19) * 0.03);
        ctx.globalAlpha = clamp01(bFade * (0.28 + 0.14 * Math.sin(p * Math.PI * 26)));
        ctx.drawImage(bImg, bx0 - throatX - 10 * sc, by0 - throatY - 4 * sc, bw, bh);
        ctx.restore();

        ctx.restore();

        // Fast fiery streaming ember flecks & heat-sparks flying down-left across the target
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (let ei = 0; ei < 22; ei++) {
          const eu = (bp * 2.4 + ei * 0.097) % 1;
          if (eu > bEase * 1.05) continue;
          // Follow the sweeping curved diagonal breath arc from throat -> lower-left wave curl!
          const ex = throatX - eu * bw * 0.94 + Math.sin(ei * 4.3 + p * 22) * 45 * sc;
          const arcDrop = Math.sin(Math.min(1, eu * 1.35) * Math.PI * 0.5) * bh * 0.62 - Math.pow(Math.max(0, eu - 0.52), 1.6) * bh * 0.95;
          const ey = throatY + arcDrop + Math.cos(ei * 6.7 - p * 18) * (35 + eu * 65) * sc;
          const sr = (3.0 + (ei % 3) * 2.2) * sc * (1 - eu * 0.35);
          ctx.fillStyle = ei % 3 === 0 ? `rgba(255, 250, 210, ${0.9 * bFade * (1 - eu * 0.3)})` : `rgba(251, 146, 60, ${0.85 * bFade * (1 - eu * 0.3)})`;
          ctx.beginPath();
          ctx.ellipse(ex, ey, sr * 2.8, sr * 0.72, -0.45 + eu * 0.95, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else {
        // Fallback soft plume burst if WebP is still downloading
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

    // 3) Draw roaring heavy-ornament Flame Dragon head OVER the breath nozzle so fangs frame the jet cleanly!
    if (dImg && dImg.naturalWidth > 0) {
      ctx.save();
      ctx.globalAlpha = clamp01(enter * exitFade * 1.06);
      ctx.drawImage(dImg, dx0, dTop, dw, dh);
      ctx.restore();
    }

    // 4) Soft blinding incandescent mouth-core flare shimmering over the inner jaws & fangs
    {
      const mouthPulse = p >= 0.16 ? 0.85 + 0.15 * Math.sin(p * Math.PI * 24) : clamp01(p / 0.16) * 0.72;
      const jawGlowX = throatX - 24 * sc;
      const jawGlowY = throatY + 12 * sc;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const mg = ctx.createRadialGradient(jawGlowX, jawGlowY, 4 * sc, jawGlowX, jawGlowY, 170 * sc * mouthPulse);
      mg.addColorStop(0, `rgba(255, 255, 235, ${0.58 * exitFade * mouthPulse})`);
      mg.addColorStop(0.32, `rgba(253, 224, 71, ${0.38 * exitFade * mouthPulse})`);
      mg.addColorStop(0.68, `rgba(249, 115, 22, ${0.18 * exitFade * mouthPulse})`);
      mg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(jawGlowX, jawGlowY, 170 * sc * mouthPulse, 0, Math.PI * 2);
      ctx.fill();
      if (p < 0.28) {
        // Quick dramatic ignition star glare inside throat just before eruption!
        const sp = Math.sin(clamp01(p / 0.28) * Math.PI);
        drawTaperedStarburst(ctx, throatX, throatY, 145 * sc * sp, 8, p * 4, 'rgba(253, 224, 71, 0.85)', '#ffffff');
      }
      ctx.restore();
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
        const isBlue = base === 11;
        const beamImg = isBlue ? imgs.solarBeamBlue : imgs.solarBeamGold;
        const bw = 920 * sc;
        const bh = beamImg && beamImg.naturalWidth > 0 ? (bw * beamImg.naturalHeight) / beamImg.naturalWidth : 700 * sc;
        // Slide-in (`0..1.4`), roar full blast (`1.4..7.2`), downward shear dissolution (`7.2..11.0`)!
        const entryT = clamp01(localF / 1.4);
        const exitT = localF > 7.0 ? clamp01((localF - 7.0) / 4.0) : 0;
        const alpha = localF < 0.8 ? localF / 0.8 : exitT > 0 ? Math.pow(1 - exitT, 0.75) : 1;
        const pulse = 1 + Math.sin(localF * 5.2 + k) * 0.06;

        ctx.save();
        // Anchor lower-left tip cleanly right onto `(ix, iy)` (mirror around `ix` when striking hero right side!)
        ctx.translate(ix, iy);
        if (targetIsHeroSide) ctx.scale(-1, 1);

        // Clip progress along the diagonal direction (entering down-left on `entryT`, shrinking down-left on `exitT`!)
        const tipStartX = -bw * 0.05;
        const tipStartY = -bh + bh * 0.05;
        const slideDown = exitT * bw * 0.45;
        ctx.save();
        if (entryT < 1) {
          const rMax = Math.hypot(bw, bh) * 1.15;
          ctx.beginPath();
          ctx.arc(bw * 0.92, -bh * 0.92, rMax * entryT, 0, Math.PI * 2);
          ctx.clip();
        }
        if (beamImg && beamImg.naturalWidth > 0) {
          ctx.globalAlpha = clamp01(alpha * 0.96);
          ctx.drawImage(
            beamImg,
            tipStartX - slideDown * 0.55,
            tipStartY + slideDown * 0.42,
            bw * pulse,
            bh * pulse
          );
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = clamp01(alpha * 0.56);
          ctx.drawImage(
            beamImg,
            tipStartX - slideDown * 0.55 - 12 * sc,
            tipStartY + slideDown * 0.42 + 8 * sc,
            bw * pulse,
            bh * pulse
          );
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

        // Blazing starburst flare right at the diagonal impact tip!
        if (entryT > 0.65) {
          ctx.globalCompositeOperation = 'screen';
          drawTaperedStarburst(
            ctx,
            0,
            0,
            (180 + Math.sin(localF * 6) * 28) * sc * alpha,
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

      if (localF < 3.4) {
        // Descending strike `F0..F2`: jagged bolt shoots down from `y=0` straight into ground!
        const dropFrac = clamp01(localF / 1.75);
        const fade = localF > 2.3 ? clamp01((3.4 - localF) / 1.1) : 1;
        const bH = gy + 30 * sc;
        const bW = bImg && bImg.naturalWidth > 0 ? Math.max(220 * sc, (bH * bImg.naturalWidth) / bImg.naturalHeight * 0.85) : 260 * sc;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, Math.max(10, (gy + 40 * sc) * dropFrac));
        ctx.clip();
        if (bImg && bImg.naturalWidth > 0) {
          ctx.translate(bx, gy * 0.5);
          if (flip) ctx.scale(-1, 1);
          ctx.globalAlpha = clamp01(fade * 0.96);
          ctx.drawImage(bImg, -bW * 0.5, -bH * 0.5, bW, bH);
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = clamp01(fade * 0.65);
          ctx.drawImage(bImg, -bW * 0.52, -bH * 0.5, bW * 1.04, bH);
        } else {
          ctx.globalCompositeOperation = 'screen';
          drawLightningBolt(ctx, bx, -20 * sc, bx, gy, 24 * sc, 54 * sc, 12, k * 37, 'rgba(139,92,246,0.88)', 'rgba(216,180,254,0.95)', '#ffffff', 2);
        }
        ctx.restore();
        if (dropFrac >= 0.85) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          drawTaperedStarburst(ctx, bx, gy - 16 * sc, 108 * sc * fade, 8, k * 0.5, 'rgba(167,139,250,0.92)', '#faf5ff');
          ctx.restore();
        }
      }

      // Authentic `sp_022 F3..F6` rebound flare crown shooting BACK UP straight out of the top sky!
      if (localF >= 2.2) {
        const up = clamp01((localF - 2.2) / 4.8);
        const ry = gy - up * (gy + 120 * sc);
        const fade = up < 0.15 ? up / 0.15 : Math.pow(1 - up, 0.7);
        const rw = (72 - up * 20) * sc;
        const rh = (175 - up * 55) * sc;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const fg = ctx.createLinearGradient(bx, ry - rh, bx, ry + 18 * sc);
        fg.addColorStop(0, 'rgba(109,40,217,0)');
        fg.addColorStop(0.32, `rgba(167,139,250,${0.92 * fade})`);
        fg.addColorStop(0.68, `rgba(245,243,255,${0.98 * fade})`);
        fg.addColorStop(1, 'rgba(109,40,217,0)');
        ctx.fillStyle = fg;
        // Three jagged upward W-crown ribbon spikes echoing `sp_022 F4/F5`!
        ctx.beginPath();
        ctx.moveTo(bx - rw * 0.5, ry + 10 * sc);
        ctx.lineTo(bx - rw * 0.45, ry - rh * 0.88);
        ctx.lineTo(bx - rw * 0.18, ry - rh * 0.42);
        ctx.lineTo(bx, ry - rh);
        ctx.lineTo(bx + rw * 0.18, ry - rh * 0.45);
        ctx.lineTo(bx + rw * 0.45, ry - rh * 0.85);
        ctx.lineTo(bx + rw * 0.5, ry + 10 * sc);
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

      if (localF < 2.8) {
        const dropFrac = clamp01(localF / 1.45);
        const fade = localF > 2.0 ? clamp01((2.8 - localF) / 0.8) : 1;
        const bH = gy + 24 * sc;
        const bW = hImg && hImg.naturalWidth > 0 ? Math.max(300 * sc, (bH * hImg.naturalWidth) / hImg.naturalHeight * 0.92) : 340 * sc;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, Math.max(10, (gy + 55 * sc) * dropFrac));
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

      // Iconic DOS `sp_032 F0` dramatic charging lightning tether feeding the sphere from sky-corner!
      if (op < 0.28 && drawFront) {
        const ta = clamp01(1 - op / 0.28);
        const startX = targetX - dir * 560 * sc;
        const startY = -40 * sc;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        drawLightningBolt(
          ctx,
          startX,
          startY,
          targetX + Math.cos((spinDeg * Math.PI) / 180) * radX,
          cy + Math.sin((spinDeg * Math.PI) / 180) * radY,
          28 * sc * ta,
          48 * sc,
          8,
          Math.floor(p * 30),
          `rgba(124,58,237,${0.84 * ta})`,
          `rgba(216,180,254,${0.95 * ta})`,
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

      if (localF < 0.85) {
        // `F0`: Razor-tapered downward lightning spearhead piercing straight out of the upper sky edge!
        const tp = localF / 0.85;
        const tipH = (120 + tp * 310) * sc;
        const tipW = (32 + tp * 28) * sc;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        drawLightningBolt(ctx, px, -10, px, tipH, 28 * sc, 20 * sc, 5, k * 29, 'rgba(124,58,237,0.85)', 'rgba(216,180,254,0.96)', '#ffffff', 1);
        const sg = ctx.createLinearGradient(px, 0, px, tipH);
        sg.addColorStop(0, 'rgba(139,92,246,0.75)');
        sg.addColorStop(0.7, 'rgba(221,214,254,0.92)');
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.moveTo(px - tipW, -8);
        ctx.lineTo(px + tipW, -8);
        ctx.lineTo(px, tipH + 14 * sc);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        // `F1`: Massive thick monolithic violet thunder column → `F2..F4`: pinches thin flanked by twin discharge needles!
        const dp = (localF - 0.85) / 4.35; // 0..1
        const fade = dp > 0.65 ? clamp01((1 - dp) / 0.35) : 1;
        const pinch = Math.max(0.22, 1 - Math.pow(dp, 0.78) * 0.76);
        const fullW = 560 * sc * pinch;

        // Soft glowing wide violet-white atmospheric pillar core sheath behind the painted spiral column
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const sheathHalf = fullW * 0.42;
        const sg = ctx.createLinearGradient(px - sheathHalf, 0, px + sheathHalf, 0);
        sg.addColorStop(0, 'rgba(109,40,217,0)');
        sg.addColorStop(0.22, `rgba(124,58,237,${0.56 * fade})`);
        sg.addColorStop(0.42, `rgba(216,180,254,${0.86 * fade})`);
        sg.addColorStop(0.5, `rgba(252,248,255,${0.95 * fade})`);
        sg.addColorStop(0.58, `rgba(216,180,254,${0.86 * fade})`);
        sg.addColorStop(0.78, `rgba(124,58,237,${0.56 * fade})`);
        sg.addColorStop(1, 'rgba(109,40,217,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(px - sheathHalf, 0, sheathHalf * 2, gy + 10 * sc);
        ctx.restore();

        ctx.save();
        if (pImg && pImg.naturalWidth > 0) {
          ctx.beginPath();
          ctx.rect(0, 0, W, gy + 12 * sc);
          ctx.clip();
          ctx.translate(px, (gy + 60 * sc) - colH * 0.5);
          if (k % 2 === 1) ctx.scale(-1, 1);
          ctx.globalAlpha = clamp01(fade * 0.98);
          ctx.drawImage(pImg, -fullW * 0.5, -colH * 0.5, fullW, colH);
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = clamp01(fade * 0.68);
          ctx.drawImage(pImg, -fullW * 0.58, -colH * 0.5, fullW * 1.16, colH);
        } else {
          ctx.globalCompositeOperation = 'screen';
          drawLightningBolt(ctx, px, -20, px, gy, 110 * sc * pinch, 30 * sc, 10, k * 13, 'rgba(124,58,237,0.85)', 'rgba(216,180,254,0.95)', '#ffffff', 0);
        }
        ctx.restore();

        // Twin flanking ground spark spikes left & right matching `sp_037 F2/F3`!
        if (dp > 0.16 && dp < 0.88) {
          const sa = Math.sin(((dp - 0.16) / 0.72) * Math.PI);
          const off = (112 + dp * 46) * sc;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          for (const side of [-1, 1]) {
            drawLightningBolt(
              ctx,
              px + side * off,
              gy - 210 * sc * sa,
              px + side * (off * 0.84),
              gy - 4 * sc,
              18 * sc * sa,
              16 * sc,
              4,
              k * 17 + side * 9,
              `rgba(139,92,246,${0.86 * sa})`,
              `rgba(221,214,254,${0.95 * sa})`,
              '#faf5ff'
            );
          }
          ctx.restore();
        }
        if (dp < 0.52) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          drawTaperedStarburst(ctx, px, gy - 26 * sc, 280 * sc * (1 - dp / 0.52), 10, k * 0.6, 'rgba(167,139,250,0.92)', '#faf5ff');
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

      if (lf < 2.1) {
        // Tapered blinding white-sapphire wedge beam slashing rapidly straight to the target!
        const sp = clamp01(lf / 1.9);
        const headX = sx + (ex - sx) * sp;
        const headY = sy + (ey - sy) * sp;
        const ang = Math.atan2(ey - sy, ex - sx);
        const len = Math.max(40 * sc, Math.hypot(headX - sx, headY - sy));
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.translate(headX, headY);
        ctx.rotate(ang);
        const wedge = ctx.createLinearGradient(-len, 0, 10 * sc, 0);
        wedge.addColorStop(0, 'rgba(96,165,250,0)');
        wedge.addColorStop(0.45, 'rgba(186,230,253,0.9)');
        wedge.addColorStop(1, '#ffffff');
        ctx.fillStyle = wedge;
        ctx.beginPath();
        ctx.moveTo(0, -14 * sc);
        ctx.arc(0, 0, 14 * sc, -Math.PI * 0.5, Math.PI * 0.5);
        ctx.lineTo(-len, 42 * sc);
        ctx.lineTo(-len, -42 * sc);
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

    // Phase 1 (0..0.52): Floating HoMM V Wight / Arch-Wraith reaping scythe swoop!
    if (p < 0.54) {
      const rp = p / 0.54;
      const alpha = rp < 0.16 ? rp / 0.16 : rp > 0.72 ? (1 - rp) / 0.28 : 1;
      const rImg = imgs.reaper;
      if (rImg && rImg.naturalWidth > 0) {
        const rh = 610 * sc;
        const rw = (rh * rImg.naturalWidth) / rImg.naturalHeight;
        // Glide forward across the target (`hover slightly above floor since legless phantom!`)
        const swoop = 1 - Math.pow(1 - Math.min(1, rp * 1.45), 2.2);
        const rx = targetX - dir * (270 - swoop * 150) * sc;
        const hoverY = Math.sin(rp * Math.PI * 2.5) * 16 * sc;
        const ry = groundY - rh * 0.96 + hoverY;
        // Subtle ghostly emerald spirit aura hovering behind the floating shroud
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const wg = ctx.createRadialGradient(rx, ry + rh * 0.45, 20 * sc, rx, ry + rh * 0.45, rw * 0.52);
        wg.addColorStop(0, `rgba(132, 204, 22, ${0.32 * alpha})`);
        wg.addColorStop(0.55, `rgba(22, 101, 52, ${0.20 * alpha})`);
        wg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = wg;
        ctx.beginPath();
        ctx.arc(rx, ry + rh * 0.45, rw * 0.52, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = clamp01(alpha * 0.98);
        ctx.translate(rx, ry + rh * 0.5);
        if (targetIsHeroSide) ctx.scale(-1, 1);
        const tilt = rp > 0.30 ? Math.sin(Math.min(1, (rp - 0.30) / 0.35) * Math.PI) * 0.09 : -0.04 * (1 - swoop);
        ctx.rotate(tilt);
        ctx.drawImage(rImg, -rw * 0.5, -rh * 0.5, rw, rh);
        ctx.restore();
      }
      // Razor necrotic crimson-emerald reaping scythe crescent cutting across the defender
      if (rp > 0.32 && rp < 0.90) {
        const sp = (rp - 0.32) / 0.58;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = `rgba(163, 230, 53, ${(1 - sp) * 0.65})`;
        ctx.lineWidth = (54 * (1 - sp) + 12) * sc;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(targetX, groundY - 190 * sc, 215 * sc, -Math.PI * 0.72, -Math.PI * 0.72 + Math.PI * 1.15 * Math.min(1, sp * 1.9));
        ctx.stroke();
        ctx.strokeStyle = `rgba(239, 68, 68, ${(1 - sp) * 0.88})`;
        ctx.lineWidth = (28 * (1 - sp) + 6) * sc;
        ctx.stroke();
        ctx.strokeStyle = `rgba(247, 254, 231, ${(1 - sp) * 0.95})`;
        ctx.lineWidth = 9 * sc * (1 - sp);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Phase 2 (0.36..1.0): Translucent Haunted Emerald Coffin Pillar + Screaming Wraith Skull!
    if (p >= 0.36) {
      const cp = (p - 0.36) / 0.64;
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
