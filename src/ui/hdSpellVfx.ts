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
    durationMs: 1180,
    accentColor: '#fb923c',
    summaryZh: '火球隕落 → 熔岩焰池 → 烈焰光柱衝天 (sp_018/020)',
    summaryEn: 'Falling ember streak → lava pool → rising flame pillar (sp_018/020)',
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
    hitTimesMs: [310, 760],
    durationMs: 1320,
    accentColor: '#f97316',
    summaryZh: '二段極熱雙擊：先白藍高溫光柱 → 再赤紅煉獄爆炎 (sp_019/021)',
    summaryEn: 'Twin thermal strike: blue-white plasma pillar → crimson inferno (sp_019/021)',
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
    durationMs: 1400,
    accentColor: '#ef4444',
    summaryZh: '星焰起爆 → 巨型斜向天降太陽烈焰光束轟擊 (sp_039/043)',
    summaryEn: 'Ignition ring → colossal diagonal orbital solar fire beam (sp_039/043)',
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
    hitTimesMs: [280, 660],
    durationMs: 1120,
    accentColor: '#38bdf8',
    summaryZh: '雙發高壓裂閃青白電弧直劈目標 (sp_022/023)',
    summaryEn: 'Twin jagged cyan-white forked lightning bolts (sp_022/023)',
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
    hitTimesMs: [260, 680],
    durationMs: 1200,
    accentColor: '#60a5fa',
    summaryZh: '雙重粗壯落雷分叉劈擊與地面電棘擴散 (sp_024/025)',
    summaryEn: 'Heavy double thunderbolt slam with radial ground spark bursts (sp_024/025)',
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
    hitTimesMs: [400, 660, 880],
    durationMs: 1300,
    accentColor: '#818cf8',
    summaryZh: '蒼藍高能電球飛馳聚能 → 爆裂星芒雷環衝擊波 (sp_032/033)',
    summaryEn: 'Rushing indigo plasma orb imploding into spiked thunder nova rings (sp_032/033)',
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
    hitTimesMs: [220, 480, 740],
    durationMs: 1180,
    accentColor: '#93c5fd',
    summaryZh: '貫穿天地的巨型鈷藍審判雷柱直轟大地 (sp_037/038)',
    summaryEn: 'Massive vertical cobalt-white pillar of heavenly thunder (sp_037/038)',
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
    hitTimesMs: [260, 560, 860],
    durationMs: 1320,
    accentColor: '#fde047',
    summaryZh: '連發聖光穿空射線與菱形星環爆裂 (sp_028/030)',
    summaryEn: 'Converging holy laser volley shattering in crystal starbursts (sp_028/030)',
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
    accentColor: '#bef264',
    summaryZh: '【召喚】蒼藍巨腹暗邪鬼凌空施咒，劇毒螢綠狂雷橫掃戰場 (sp_068)',
    summaryEn: '[Summon] Towering blue fiend flinging venomous acid-lime curse lightning (sp_068)',
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

export function ensureHdSpellAssets(versionTag: string): Promise<HdSpellImageMap> {
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
  ]).then(([dragon, dragonBreath, reaper, skull, seraph, sylph, destroyer, fiend]) => {
    spellImages.dragon = dragon;
    spellImages.dragonBreath = dragonBreath;
    spellImages.reaper = reaper;
    spellImages.skull = skull;
    spellImages.seraph = seraph;
    spellImages.sylph = sylph;
    spellImages.destroyer = destroyer;
    spellImages.fiend = fiend;
    return spellImages;
  });
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
 * Draw authentic HD Stage 2 cutaway spell / summon VFX for any of the 14 FDOTHER.DAT spells.
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
  imgs: HdSpellImageMap = spellImages
): void {
  const p = clamp01(progress);
  if (p <= 0 || p >= 1) return;
  const sc = W / 1600; // resolution-independent factor (1.0 on 1600×900 stage!)
  const dir = targetIsHeroSide ? -1 : 1; // polarity mirror between enemyStrip vs heroStrip!

  ctx.save();

  // =========================================================================
  // #00 火炎術 Fireball (sp_018 / sp_020)
  // =========================================================================
  if (spellId === 0) {
    ctx.globalCompositeOperation = 'screen';
    if (p < 0.36) {
      // Falling ember droplet streaking straight into a pooling magma glow beneath target
      const fp = p / 0.36;
      const fx = targetX + dir * (1 - fp) * 70 * sc;
      const fy = (groundY - 720 * sc) + fp * 700 * sc;
      const tailY = fy - 120 * sc;
      const lg = ctx.createLinearGradient(fx, tailY, fx, fy + 25 * sc);
      lg.addColorStop(0, 'rgba(239,68,68,0)');
      lg.addColorStop(0.55, 'rgba(249,115,22,0.85)');
      lg.addColorStop(1, 'rgba(255,250,210,1)');
      ctx.strokeStyle = lg;
      ctx.lineWidth = 22 * sc;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(fx + dir * 18 * sc, tailY);
      ctx.lineTo(fx, fy);
      ctx.stroke();
      drawTaperedStarburst(ctx, fx, fy, 75 * sc, 6, p * 8, 'rgba(251,146,60,0.9)', '#ffffff');
    } else {
      const ep = (p - 0.36) / 0.64;
      const fade = ep < 0.18 ? ep / 0.18 : ep > 0.74 ? (1 - ep) / 0.26 : 1;
      // Glowing magma caldera pool beneath feet
      ctx.save();
      ctx.translate(targetX, groundY - 8 * sc);
      ctx.scale(1, 0.26);
      const pg = ctx.createRadialGradient(0, 0, 8 * sc, 0, 0, (190 + ep * 45) * sc);
      pg.addColorStop(0, `rgba(255,245,190,${0.95 * fade})`);
      pg.addColorStop(0.5, `rgba(239,68,68,${0.75 * fade})`);
      pg.addColorStop(1, 'rgba(185,28,28,0)');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(0, 0, (190 + ep * 45) * sc, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const colH = (220 + Math.sin(Math.min(1, ep * 1.45) * Math.PI * 0.5) * 510) * sc;
      drawOrganicFlamePillar(
        ctx,
        targetX,
        groundY - 4 * sc,
        colH,
        108 * sc * (0.7 + 0.3 * fade),
        p,
        {
          outer: 'rgba(220, 38, 38, 0.48)',
          mid: 'rgba(249, 115, 22, 0.72)',
          core: 'rgba(254, 215, 102, 0.88)',
          hot: 'rgba(255, 252, 235, 0.96)',
        },
        fade
      );
    }
    ctx.restore();
    return;
  }

  // =========================================================================
  // #01 烈炎術 Scorching Flame (sp_019 / sp_021) — Authentic 2-stage BLUE then RED pillar!
  // =========================================================================
  if (spellId === 1) {
    ctx.globalCompositeOperation = 'screen';
    if (p < 0.50) {
      const bp = p / 0.50;
      const fade = bp < 0.22 ? bp / 0.22 : bp > 0.72 ? (1 - bp) / 0.28 : 1;
      const colH = Math.min(1, bp * 2.4) * 760 * sc;
      drawOrganicFlamePillar(
        ctx,
        targetX,
        groundY - 6 * sc,
        colH,
        125 * sc,
        bp * 1.5,
        {
          outer: 'rgba(37, 99, 235, 0.52)',
          mid: 'rgba(56, 189, 248, 0.76)',
          core: 'rgba(224, 242, 254, 0.92)',
          hot: 'rgba(255, 255, 255, 0.98)',
        },
        fade
      );
      drawTaperedStarburst(ctx, targetX, groundY - 120 * sc, 185 * sc * fade, 8, bp * 3, 'rgba(96,165,250,0.85)', '#ffffff');
    } else {
      const rp = (p - 0.50) / 0.50;
      const fade = rp < 0.16 ? rp / 0.16 : rp > 0.70 ? (1 - rp) / 0.30 : 1;
      const colH = Math.min(1, rp * 2.5) * 810 * sc;
      drawOrganicFlamePillar(
        ctx,
        targetX,
        groundY - 6 * sc,
        colH,
        148 * sc,
        rp * 1.6,
        {
          outer: 'rgba(185, 28, 28, 0.62)',
          mid: 'rgba(239, 68, 68, 0.84)',
          core: 'rgba(251, 146, 60, 0.94)',
          hot: 'rgba(254, 249, 195, 0.99)',
        },
        fade
      );
      drawTaperedStarburst(ctx, targetX, groundY - 170 * sc, 255 * sc * fade, 10, rp * 4, 'rgba(249,115,22,0.9)', '#fef9c3');
    }
    ctx.restore();
    return;
  }

  // =========================================================================
  // #02 炎龍術 Flame Dragon (sp_026 / sp_027) — Baroque Roaring Dragon + Hand-Painted Mouth Breath Wave!
  // =========================================================================
  if (spellId === 2) {
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
  // #03 天火術 Heaven's Fire / Orbital Sky Beam (sp_039 / sp_043)
  // =========================================================================
  if (spellId === 3) {
    ctx.fillStyle = `rgba(34, 10, 4, ${0.42 * (p < 0.8 ? 1 : (1 - p) / 0.2)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'screen';
    const impactX = targetX;
    const impactY = groundY - 120 * sc;
    const skyX = targetX + dir * 740 * sc;
    const skyY = -80 * sc;

    if (p < 0.24) {
      // Initial fire-spark target lock detonation ring (matching DOS sp_039 F5!)
      const ep = p / 0.24;
      drawTaperedStarburst(ctx, impactX, impactY, 175 * sc * Math.sin(ep * Math.PI), 10, ep * 3, 'rgba(249,115,22,0.95)', '#fef9c3');
      ctx.strokeStyle = `rgba(251, 146, 60, ${0.85 * (1 - ep)})`;
      ctx.lineWidth = 8 * sc;
      ctx.beginPath();
      ctx.arc(impactX, impactY, (40 + ep * 185) * sc, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const bp = (p - 0.24) / 0.76;
      const beamGrow = clamp01(bp / 0.14);
      const fade = bp > 0.74 ? (1 - bp) / 0.26 : 1;
      const curX = skyX + (impactX - skyX) * beamGrow;
      const curY = skyY + (impactY - skyY) * beamGrow;
      const pulse = 1 + Math.sin(bp * 40) * 0.16;

      // Diagonal slanted solar fire laser cannon!
      const drawBeam = (lw: number, col: string) => {
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(skyX, skyY);
        ctx.lineTo(curX, curY);
        ctx.stroke();
      };
      drawBeam(210 * sc * pulse * fade, `rgba(220, 38, 38, ${0.45 * fade})`);
      drawBeam(125 * sc * pulse * fade, `rgba(249, 115, 22, ${0.85 * fade})`);
      drawBeam(68 * sc * pulse * fade, `rgba(254, 240, 138, ${0.95 * fade})`);
      drawBeam(32 * sc * pulse * fade, `rgba(255, 255, 255, ${0.99 * fade})`);

      // Concentric glowing plasma pressure rings sliding downward along the beam
      if (beamGrow >= 0.9) {
        for (let ri = 0; ri < 4; ri++) {
          const ru = (bp * 2.2 + ri * 0.25) % 1;
          const rx = skyX + (impactX - skyX) * ru;
          const ry = skyY + (impactY - skyY) * ru;
          ctx.save();
          ctx.translate(rx, ry);
          ctx.rotate(Math.atan2(impactY - skyY, impactX - skyX) + Math.PI / 2);
          ctx.scale(1, 0.34);
          ctx.strokeStyle = `rgba(254, 240, 138, ${(1 - Math.abs(ru - 0.5) * 1.4) * 0.85 * fade})`;
          ctx.lineWidth = 10 * sc;
          ctx.beginPath();
          ctx.arc(0, 0, (95 + ri * 18) * sc, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        drawTaperedStarburst(ctx, impactX, impactY + 25 * sc, 310 * sc * fade * pulse, 14, bp * 4, 'rgba(249,115,22,0.92)', '#ffffff');
      }
    }
    ctx.restore();
    return;
  }

  // =========================================================================
  // #04 電擊術 Lightning Shock (sp_022 / sp_023)
  // =========================================================================
  if (spellId === 4) {
    ctx.globalCompositeOperation = 'screen';
    const strike = (u: number, seedBase: number) => {
      if (u <= 0 || u >= 1) return;
      const a = u < 0.2 ? u / 0.2 : (1 - u) / 0.8;
      const sTick = Math.floor(u * 10);
      drawLightningBolt(
        ctx,
        targetX + dir * 48 * sc,
        -20 * sc,
        targetX,
        groundY - 40 * sc,
        26 * sc * a,
        58 * sc,
        14,
        seedBase + sTick * 3.7,
        `rgba(56,189,248,${0.8 * a})`,
        `rgba(186,230,253,${0.92 * a})`,
        `rgba(255,255,255,${a})`,
        3
      );
      drawTaperedStarburst(ctx, targetX, groundY - 90 * sc, 155 * sc * a, 8, u * 6, 'rgba(56,189,248,0.85)', '#ffffff');
    };
    strike(clamp01(p / 0.48), 41);
    strike(clamp01((p - 0.45) / 0.55), 119);
    ctx.restore();
    return;
  }

  // =========================================================================
  // #05 落雷術 Falling Bolt (sp_024 / sp_025)
  // =========================================================================
  if (spellId === 5) {
    ctx.fillStyle = `rgba(12, 24, 52, ${0.32 * Math.sin(p * Math.PI)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'screen';
    const slam = (u: number, offX: number, seedBase: number) => {
      if (u <= 0 || u >= 1) return;
      const a = u < 0.14 ? u / 0.14 : Math.pow(1 - (u - 0.14) / 0.86, 0.8);
      const tick = Math.floor(u * 8);
      drawLightningBolt(
        ctx,
        targetX + offX * sc,
        -30 * sc,
        targetX,
        groundY - 22 * sc,
        58 * sc * a,
        72 * sc,
        12,
        seedBase + tick * 5.3,
        `rgba(37,99,235,${0.72 * a})`,
        `rgba(125,211,252,${0.95 * a})`,
        `rgba(255,255,255,${a})`,
        4
      );
      // Spiky upward ground lightning discharge fan (`matching DOS sp_024 F3!`)
      for (let k = -4; k <= 4; k++) {
        const ang = -Math.PI * 0.5 + k * 0.28;
        const r = (90 + (k % 2 === 0 ? 110 : 60)) * sc * Math.min(1, u * 3);
        ctx.strokeStyle = `rgba(224,242,254,${0.9 * a})`;
        ctx.lineWidth = (k % 2 === 0 ? 7 : 4) * sc;
        ctx.beginPath();
        ctx.moveTo(targetX, groundY - 25 * sc);
        ctx.lineTo(targetX + Math.cos(ang) * r, groundY - 25 * sc + Math.sin(ang) * r);
        ctx.stroke();
      }
      drawTaperedStarburst(ctx, targetX, groundY - 40 * sc, 220 * sc * a, 10, seedBase, 'rgba(96,165,250,0.9)', '#ffffff');
    };
    slam(clamp01(p / 0.52), -45, 73);
    slam(clamp01((p - 0.42) / 0.58), 55, 197);
    ctx.restore();
    return;
  }

  // =========================================================================
  // #06 轟雷術 Thunder Storm (sp_032 / sp_033) — Plasma Orb -> Spiky Ring Nova!
  // =========================================================================
  if (spellId === 6) {
    ctx.fillStyle = `rgba(10, 14, 42, ${0.44 * (p < 0.8 ? 1 : (1 - p) / 0.2)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'screen';
    const cy = groundY - 185 * sc;
    if (p < 0.38) {
      const rp = p / 0.38;
      const sx = targetX + dir * (1 - rp) * 620 * sc;
      const sy = cy - (1 - rp) * 180 * sc;
      // Crackling electric trailing lightning behind flying plasma orb!
      drawLightningBolt(
        ctx,
        sx + dir * 240 * sc,
        sy - 70 * sc,
        sx,
        sy,
        24 * sc,
        40 * sc,
        10,
        Math.floor(rp * 14) * 7,
        'rgba(99,102,241,0.75)',
        'rgba(125,211,252,0.92)',
        '#ffffff',
        2
      );
      const orbG = ctx.createRadialGradient(sx, sy, 8 * sc, sx, sy, 88 * sc);
      orbG.addColorStop(0, '#ffffff');
      orbG.addColorStop(0.35, 'rgba(96,165,250,0.95)');
      orbG.addColorStop(0.7, 'rgba(67,56,202,0.75)');
      orbG.addColorStop(1, 'rgba(30,27,75,0)');
      ctx.fillStyle = orbG;
      ctx.beginPath();
      ctx.arc(sx, sy, 88 * sc, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const ep = (p - 0.38) / 0.62;
      const fade = ep > 0.72 ? (1 - ep) / 0.28 : 1;
      // Expanding spiked indigo-cyan nova ring + 4 orbiting high-voltage bolts!
      const ringR = (60 + ep * 360) * sc;
      drawTaperedStarburst(ctx, targetX, cy, ringR * (0.95 - ep * 0.2), 18, ep * 2.4, `rgba(96,165,250,${0.92 * fade})`, `rgba(255,255,255,${fade})`);
      ctx.strokeStyle = `rgba(165, 180, 252, ${0.85 * (1 - ep)})`;
      ctx.lineWidth = (18 - ep * 12) * sc;
      ctx.beginPath();
      ctx.arc(targetX, cy, ringR, 0, Math.PI * 2);
      ctx.stroke();

      for (let i = 0; i < 4; i++) {
        const ang = ep * Math.PI * 4.5 + (i * Math.PI) / 2;
        const bx = targetX + Math.cos(ang) * (160 + ep * 80) * sc;
        const by = cy + Math.sin(ang) * 95 * sc;
        drawLightningBolt(
          ctx,
          targetX,
          cy,
          bx,
          by,
          16 * sc * fade,
          28 * sc,
          6,
          i * 31 + Math.floor(ep * 15),
          'rgba(99,102,241,0.75)',
          'rgba(56,189,248,0.9)',
          '#ffffff'
        );
      }
    }
    ctx.restore();
    return;
  }

  // =========================================================================
  // #07 神雷術 Divine Thunder (sp_037 / sp_038) — Monolithic Sky-to-Earth Pillar!
  // =========================================================================
  if (spellId === 7) {
    ctx.fillStyle = `rgba(12, 22, 58, ${0.5 * (p < 0.75 ? 1 : (1 - p) / 0.25)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'screen';
    const fade = p < 0.12 ? p / 0.12 : p > 0.65 ? (1 - p) / 0.35 : 1;
    const pulse = 0.85 + 0.25 * Math.sin(p * 55);
    const pw = (175 * pulse * Math.pow(fade, 0.55)) * sc;
    const pg = ctx.createLinearGradient(targetX - pw, 0, targetX + pw, 0);
    pg.addColorStop(0, 'rgba(37,99,235,0)');
    pg.addColorStop(0.22, `rgba(59,130,246,${0.65 * fade})`);
    pg.addColorStop(0.42, `rgba(186,230,253,${0.92 * fade})`);
    pg.addColorStop(0.5, `rgba(255,255,255,${fade})`);
    pg.addColorStop(0.58, `rgba(186,230,253,${0.92 * fade})`);
    pg.addColorStop(0.78, `rgba(59,130,246,${0.65 * fade})`);
    pg.addColorStop(1, 'rgba(37,99,235,0)');
    ctx.fillStyle = pg;
    ctx.fillRect(targetX - pw, -20 * sc, pw * 2, groundY + 40 * sc);

    for (let k = -1; k <= 1; k++) {
      drawLightningBolt(
        ctx,
        targetX + k * 70 * sc,
        -20 * sc,
        targetX + k * 25 * sc,
        groundY - 10 * sc,
        24 * sc * fade,
        46 * sc,
        14,
        k * 43 + Math.floor(p * 24) * 3.1,
        `rgba(56,189,248,${0.85 * fade})`,
        `rgba(224,242,254,${0.95 * fade})`,
        '#ffffff',
        2
      );
    }
    drawTaperedStarburst(ctx, targetX, groundY - 30 * sc, 290 * sc * fade, 12, p * 2, 'rgba(96,165,250,0.9)', '#ffffff');
    ctx.restore();
    return;
  }

  // =========================================================================
  // #08 聖光彈 Holy Bolt (sp_028 / sp_030) — Rapid White-Gold Laser Volley + Rings!
  // =========================================================================
  if (spellId === 8) {
    ctx.globalCompositeOperation = 'screen';
    const cy = groundY - 190 * sc;
    // 3 rhythmic soaring laser rays bursting straight across the defender!
    const volleys = [
      { t0: 0.0, sx: targetX + dir * 720 * sc, sy: cy - 170 * sc, ox: -35 * sc, oy: -25 * sc },
      { t0: 0.28, sx: targetX + dir * 780 * sc, sy: cy + 40 * sc, ox: 25 * sc, oy: 15 * sc },
      { t0: 0.56, sx: targetX + dir * 680 * sc, sy: cy - 320 * sc, ox: 0, oy: 0 },
    ];
    for (let i = 0; i < volleys.length; i++) {
      const v = volleys[i];
      const u = (p - v.t0) / 0.44;
      if (u <= 0 || u >= 1) continue;
      const ex = targetX + v.ox;
      const ey = cy + v.oy;
      if (u < 0.42) {
        const sp = u / 0.42;
        const bx = v.sx + (ex - v.sx) * sp;
        const by = v.sy + (ey - v.sy) * sp;
        const tx = v.sx + (ex - v.sx) * Math.max(0, sp - 0.55);
        const ty = v.sy + (ey - v.sy) * Math.max(0, sp - 0.55);
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.72)';
        ctx.lineWidth = 42 * sc;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 16 * sc;
        ctx.stroke();
      } else {
        const bp = (u - 0.42) / 0.58;
        const f = 1 - bp;
        drawTaperedStarburst(ctx, ex, ey, (120 + bp * 210) * sc, 12, i * 0.7 + bp * 2, `rgba(253,224,71,${0.9 * f})`, `rgba(255,255,255,${f})`);
        drawTaperedStarburst(ctx, ex, ey, (85 + bp * 160) * sc, 8, -bp * 3, `rgba(125,211,252,${0.85 * f})`, `rgba(255,255,255,${f})`);
        ctx.strokeStyle = `rgba(254, 249, 195, ${0.85 * f})`;
        ctx.lineWidth = (10 * f + 2) * sc;
        ctx.beginPath();
        ctx.arc(ex, ey, (35 + bp * 200) * sc, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
    return;
  }

  // =========================================================================
  // #09 咒殺術 Death Curse (sp_044) — Crimson Grim Reaper + Haunted Skull Pillar!
  // =========================================================================
  if (spellId === 9) {
    const dim = p < 0.14 ? p / 0.14 : p > 0.85 ? (1 - p) / 0.15 : 1;
    ctx.fillStyle = `rgba(8, 18, 10, ${0.58 * dim})`;
    ctx.fillRect(0, 0, W, H);

    // Phase 1 (0..0.44): Crimson-shrouded Grim Reaper scythe swing!
    if (p < 0.48) {
      const rp = p / 0.48;
      const alpha = rp < 0.18 ? rp / 0.18 : rp > 0.72 ? (1 - rp) / 0.28 : 1;
      const rImg = imgs.reaper;
      if (rImg && rImg.naturalWidth > 0) {
        const rh = 620 * sc;
        const rw = (rh * rImg.naturalWidth) / rImg.naturalHeight;
        const rx = targetX - dir * (220 - rp * 110) * sc;
        const ry = groundY - rh * 0.86;
        ctx.save();
        ctx.globalAlpha = clamp01(alpha * 0.96);
        ctx.translate(rx, ry + rh * 0.5);
        if (targetIsHeroSide) ctx.scale(-1, 1);
        ctx.drawImage(rImg, -rw * 0.5, -rh * 0.5, rw, rh);
        ctx.restore();
      }
      // Razor blood-silver crescent scythe arc cutting horizontally across the defender
      if (rp > 0.34 && rp < 0.88) {
        const sp = (rp - 0.34) / 0.54;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = `rgba(239, 68, 68, ${(1 - sp) * 0.95})`;
        ctx.lineWidth = (42 * (1 - sp) + 8) * sc;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(targetX, groundY - 190 * sc, 210 * sc, -Math.PI * 0.72, -Math.PI * 0.72 + Math.PI * 1.1 * Math.min(1, sp * 1.9));
        ctx.stroke();
        ctx.strokeStyle = `rgba(255, 240, 240, ${(1 - sp) * 0.95})`;
        ctx.lineWidth = 10 * sc * (1 - sp);
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
  // #35 暗邪鬼 DARK FIEND SUMMON (sp_068) — Blue Imp + Venom-Lime Lightning!
  // =========================================================================
  if (spellId === 35) {
    const enter = clamp01(p / 0.20);
    const fade = p > 0.84 ? (1 - p) / 0.16 : 1;
    ctx.fillStyle = `rgba(10, 22, 12, ${0.60 * enter * fade})`;
    ctx.fillRect(0, 0, W, H);

    const sImg = imgs.fiend;
    const hoverY = Math.sin(p * Math.PI * 5) * 14 * sc;
    const fSh = 670 * sc;
    const fSw = sImg && sImg.naturalWidth > 0 ? (fSh * sImg.naturalWidth) / sImg.naturalHeight : 700 * sc;
    const fX0 = W * 0.52 - fSw * 0.5;
    const fY0 = H * 0.12 + hoverY + (1 - enter) * 110 * sc;
    if (sImg && sImg.naturalWidth > 0) {
      ctx.save();
      ctx.globalAlpha = clamp01(enter * fade);
      ctx.drawImage(sImg, fX0, fY0, fSw, fSh);
      ctx.restore();
    }

    // Venomous lime-green acid curse lightning erupting from BOTH clawed hands (matching sp_068 F1..F8!)
    if (p > 0.16) {
      const tick = Math.floor(p * 14);
      // Exact measured splayed palm/fingertip anchors on `summon_35_fiend.webp` (909x868)
      const lHandX = fX0 + fSw * 0.088;
      const lHandY = fY0 + fSh * 0.118;
      const rHandX = fX0 + fSw * 0.842;
      const rHandY = fY0 + fSh * 0.205;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      drawTaperedStarburst(ctx, lHandX, lHandY, 130 * sc * fade, 8, p * 6, 'rgba(163,230,53,0.9)', '#fef9c3');
      drawTaperedStarburst(ctx, rHandX, rHandY, 130 * sc * fade, 8, -p * 6, 'rgba(163,230,53,0.9)', '#fef9c3');
      const bolts: Array<[number, number, number, number]> = [
        [lHandX, lHandY, 0, H * 0.12],
        [lHandX, lHandY, W * 0.06, H * 0.88],
        [lHandX, lHandY, W * 0.22, H],
        [rHandX, rHandY, W, H * 0.18],
        [rHandX, rHandY, W * 0.92, H * 0.92],
        [rHandX, rHandY, W * 0.68, H],
      ];
      for (let i = 0; i < bolts.length; i++) {
        const [x0, y0, x1, y1] = bolts[i];
        drawLightningBolt(
          ctx,
          x0,
          y0,
          x1,
          y1,
          30 * sc * fade,
          65 * sc,
          9,
          i * 53 + tick * 7,
          `rgba(101,163,13,${0.75 * fade})`,
          `rgba(163,230,53,${0.95 * fade})`,
          `rgba(247,254,231,${fade})`,
          2
        );
      }
      ctx.restore();
    }
    ctx.restore();
    return;
  }

  ctx.restore();
}
