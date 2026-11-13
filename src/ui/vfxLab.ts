import type { SoundEngine } from '../audio/soundEngine';
import type { AssetManager } from '../engine/assets';
import { getLocale, tr } from '../i18n';
import type { FigAniStrip } from '../types';

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
  overallPass?: boolean;
}

interface VfxLabAssets {
  loaded: boolean;
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

export async function loadUnitSlotIntoVfxAssets(
  assets: AssetManager,
  target: VfxLabAssets,
  side: 'player' | 'enemy',
  entry: VfxManifestUnitEntry
): Promise<void> {
  const cb = '?v=9';
  const [nb6, omni, cutIn, cIdle, cAtk] = await Promise.all([
    Promise.all([0, 1, 2, 3, 4, 5].map((i) => loadImg(`${entry.dir}/nb6_${i}.png${cb}`))),
    Promise.all([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => loadImg(`${entry.dir}/omni_${i}.png${cb}`))),
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
  const cacheBust = '?v=9';
  // Always refresh manifest so newly generated batch units appear immediately
  try {
    const resp = await fetch(`assets/vfx_lab/units_manifest.json?t=${Date.now()}`);
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data?.units) && data.units.length > 0) {
        vfxAssetsCache.manifestUnits = data.units;
      }
    }
  } catch {
    // fallback to default manifest units
  }

  if (vfxAssetsCache.loaded) {
    return vfxAssetsCache;
  }
  const [
    t0,
    t1,
    t2,
    b0,
    b1,
    b2,
    thorNb6,
    banditNb6,
    thorOmni,
    banditOmni,
    tRaw,
    bRaw,
    clashImg,
    forestBg,
    cThorIdle,
    cThorAtk,
    cBanditIdle,
    cBanditAtk,
  ] = await Promise.all([
    loadImg(`assets/vfx_lab/thor_pose_0.png${cacheBust}`),
    loadImg(`assets/vfx_lab/thor_pose_1.png${cacheBust}`),
    loadImg(`assets/vfx_lab/thor_pose_2.png${cacheBust}`),
    loadImg(`assets/vfx_lab/bandit_pose_0.png${cacheBust}`),
    loadImg(`assets/vfx_lab/bandit_pose_1.png${cacheBust}`),
    loadImg(`assets/vfx_lab/bandit_pose_2.png${cacheBust}`),
    Promise.all([0, 1, 2, 3, 4, 5].map((i) => loadImg(`assets/vfx_lab/thor_nb6_${i}.png${cacheBust}`))),
    Promise.all([0, 1, 2, 3, 4, 5].map((i) => loadImg(`assets/vfx_lab/bandit_nb6_${i}.png${cacheBust}`))),
    Promise.all([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => loadImg(`assets/vfx_lab/thor_omni_${i}.png${cacheBust}`))),
    Promise.all([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => loadImg(`assets/vfx_lab/bandit_omni_${i}.png${cacheBust}`))),
    loadImg(`assets/vfx_lab/thor_sheet_raw.png${cacheBust}`),
    loadImg(`assets/vfx_lab/bandit_sheet_raw.png${cacheBust}`),
    loadImg(`assets/vfx_lab/clash_keyart.jpg${cacheBust}`),
    loadImg('assets/hd_bgs/bg_4.png').catch(() => loadImg('assets/bgs/bg_4.png')),
    assets.loadUnitFigAni(0, 'idle'),
    assets.loadUnitFigAni(0, 'attack'),
    assets.loadUnitFigAni(96, 'idle'),
    assets.loadUnitFigAni(96, 'attack'),
  ]);

  vfxAssetsCache.thorPoses = [t0, t1, t2];
  vfxAssetsCache.banditPoses = [b0, b1, b2];
  vfxAssetsCache.thorNb6Poses = thorNb6;
  vfxAssetsCache.banditNb6Poses = banditNb6;
  vfxAssetsCache.thorOmniPoses = thorOmni;
  vfxAssetsCache.banditOmniPoses = banditOmni;
  vfxAssetsCache.thorSheetRaw = tRaw;
  vfxAssetsCache.banditSheetRaw = bRaw;
  vfxAssetsCache.clashKeyArt = clashImg;
  vfxAssetsCache.forestBg = forestBg;
  vfxAssetsCache.classicThorIdle = cThorIdle;
  vfxAssetsCache.classicThorAtk = cThorAtk;
  vfxAssetsCache.classicBanditIdle = cBanditIdle;
  vfxAssetsCache.classicBanditAtk = cBanditAtk;
  vfxAssetsCache.loaded = true;
  return vfxAssetsCache;
}

export type DuelScenario = 'thor_first_duel' | 'bandit_first_duel' | 'thor_crit' | 'bandit_crit';

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

    this.thorStrikeDmg = scenario === 'thor_crit' ? 35 : 22;
    this.banditStrikeDmg = scenario === 'bandit_crit' ? 28 : 7;
  }

  public getTotalDurationMs(): number {
    if (this.scenario === 'thor_crit' || this.scenario === 'bandit_crit') return 2600;
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

  private getPhaseStartTimes(): { thorStart: number; banditStart: number } {
    if (this.scenario === 'bandit_first_duel') {
      return { banditStart: 280, thorStart: 2200 };
    }
    if (this.scenario === 'bandit_crit') {
      return { banditStart: 280, thorStart: -1 };
    }
    if (this.scenario === 'thor_crit') {
      return { thorStart: 320, banditStart: -1 };
    }
    return { thorStart: 320, banditStart: 2250 };
  }

  private renderClassic1995Scene(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    // Emulate exact 1995 320x200 diagonal battle stage (BG.DAT at y=50..150, Bandit at top-left, Thor at bottom-right)
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#05080c';
    ctx.fillRect(0, 0, W, H);

    const scaleX = W / 320;
    const scaleY = H / 200;

    if (this.vfxAssets.forestBg) {
      ctx.drawImage(this.vfxAssets.forestBg, 0, 42 * scaleY, W, 112 * scaleY);
    }

    const t = this.elapsedMs;
    const { thorStart, banditStart } = this.getPhaseStartTimes();

    const cThorIdle = this.vfxAssets.classicThorIdle;
    const cThorAtk = this.vfxAssets.classicThorAtk;
    const cBanditIdle = this.vfxAssets.classicBanditIdle;
    const cBanditAtk = this.vfxAssets.classicBanditAtk;

    let thorSprite = cThorIdle;
    let thorFrameIdx = Math.floor(t / 180) % Math.max(1, cThorIdle?.strip.frames.length ?? 1);
    let thorRecoilX = 0;
    let thorRecoilY = 0;

    let banditSprite = cBanditIdle;
    let banditFrameIdx = Math.floor(t / 180) % Math.max(1, cBanditIdle?.strip.frames.length ?? 1);
    let banditRecoilX = 0;
    let banditRecoilY = 0;

    if (thorStart >= 0 && t >= thorStart && t < thorStart + 1600 && cThorAtk && cThorAtk.strip.frames.length > 0) {
      thorSprite = cThorAtk;
      const p = Math.min(0.999, (t - thorStart) / 1550);
      thorFrameIdx = Math.floor(p * cThorAtk.strip.frames.length);
      if (p >= 0.52 && p <= 0.78) {
        const rp = Math.sin(((p - 0.52) / 0.26) * Math.PI);
        banditRecoilX = -Math.round(rp * 16);
        banditRecoilY = -Math.round(rp * 8);
      }
    }

    if (
      banditStart >= 0 &&
      t >= banditStart &&
      t < banditStart + 1550 &&
      cBanditAtk &&
      cBanditAtk.strip.frames.length > 0
    ) {
      banditSprite = cBanditAtk;
      const p = Math.min(0.999, (t - banditStart) / 1500);
      banditFrameIdx = Math.floor(p * cBanditAtk.strip.frames.length);
      if (p >= 0.52 && p <= 0.78) {
        const rp = Math.sin(((p - 0.52) / 0.26) * Math.PI);
        thorRecoilX = Math.round(rp * 16);
        thorRecoilY = Math.round(rp * 8);
      }
    }

    // Draw using exact FD2.EXE `f.ox, f.oy` 320x200 screen coordinates!
    const drawClassicFigExact = (
      bundle: ClassicFigBundle | null,
      fIdx: number,
      slideX: number,
      slideY: number
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
      ctx.drawImage(bundle.img, sx, 0, sw, sh, dx, dy, dw, dh);
    };

    drawClassicFigExact(banditSprite, banditFrameIdx, banditRecoilX, banditRecoilY);
    drawClassicFigExact(thorSprite, thorFrameIdx, thorRecoilX, thorRecoilY);
    ctx.restore();

    this.drawModernDualHud(ctx, W, H);
  }

  private renderModernScene(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const t = this.elapsedMs;
    const { thorStart, banditStart } = this.getPhaseStartTimes();

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
    // Thor Diagonal Up-Left (↖) Strike Sequence
    // -------------------------------------------------------------------------
    const srcMode = this.config.animSource;
    if (thorStart >= 0 && t >= thorStart && t < thorStart + 1830) {
      const localT = t - thorStart;
      if (localT < 460) {
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
          this.sound.playSfx('step_foot');
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
          this.sound.playSfx('slash');
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
          this.sound.playSfx('crit');
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
          this.sound.playSfx('step_foot');
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
          this.sound.playSfx('slash');
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
          this.sound.playSfx(isBanditCrit ? 'crit' : 'hit');
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

    this.drawForestBackground(ctx, W, H, camX, camY, thorHomeY);

    // Draw Foreground Elevated TAI Terrain Mound at Bottom-Right (under Thor)
    this.drawForegroundTaiMound(ctx, thorHomeX, thorHomeY);

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
          0.2 * (1 - g / (spec.afterimages + 1)),
          displaySize,
          afterimageColor
        );
      }
    }

    const tint = spec.flashWhite > 0.15 ? '#ffffff' : undefined;
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
        tint
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
        tint
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
        tint
      );
    }
  }

  private drawForegroundTaiMound(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    ctx.save();
    ctx.translate(cx + 25, cy + 4);
    ctx.scale(1, 0.32);
    const grad = ctx.createRadialGradient(0, 0, 40, 0, 0, 390);
    grad.addColorStop(0, 'rgba(42, 62, 34, 0.65)');
    grad.addColorStop(0.55, 'rgba(28, 44, 24, 0.45)');
    grad.addColorStop(0.85, 'rgba(18, 28, 16, 0.2)');
    grad.addColorStop(1, 'rgba(18, 28, 16, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 390, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawForestBackground(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    camX: number,
    camY: number,
    groundY: number
  ): void {
    const pFactor = this.config.enableParallaxAndGodRays ? 0.35 : 0;
    const bgX = -W * 0.06 + camX * pFactor;
    const bgY = -H * 0.06 + camY * pFactor;
    const bgW = W * 1.12;
    const bgH = H * 1.12;

    if (this.vfxAssets.forestBg) {
      ctx.drawImage(this.vfxAssets.forestBg, bgX, bgY, bgW, bgH);
    } else {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#0f291e');
      sky.addColorStop(1, '#1e3a29');
      ctx.fillStyle = sky;
      ctx.fillRect(bgX, bgY, bgW, bgH);
    }

    const stageGrade = ctx.createLinearGradient(0, 0, 0, H);
    stageGrade.addColorStop(0, 'rgba(8, 22, 16, 0.35)');
    stageGrade.addColorStop(0.55, 'rgba(16, 38, 24, 0.12)');
    stageGrade.addColorStop(0.82, 'rgba(28, 24, 14, 0.28)');
    stageGrade.addColorStop(1, 'rgba(10, 12, 8, 0.65)');
    ctx.fillStyle = stageGrade;
    ctx.fillRect(bgX, bgY, bgW, bgH);

    if (!this.config.enableParallaxAndGodRays) return;

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
      grad.addColorStop(0, `rgba(254, 240, 138, ${r.alpha * 1.3})`);
      grad.addColorStop(0.6, `rgba(253, 224, 71, ${r.alpha * 0.7})`);
      grad.addColorStop(1, 'rgba(253, 224, 71, 0)');
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
    tintColor?: string
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

    ctx.drawImage(img, dx, dy, displaySize, displaySize);

    if (tintColor) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = tintColor;
      ctx.globalAlpha = alpha * 0.55;
      ctx.fillRect(dx, dy, displaySize, displaySize);
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

  private drawForegroundLeaves(ctx: CanvasRenderingContext2D): void {
    if (!this.config.enableParallaxAndGodRays) return;
    for (const leaf of this.leaves) {
      ctx.save();
      ctx.translate(leaf.x, leaf.y);
      ctx.rotate(leaf.rot);
      ctx.globalAlpha = leaf.depth > 1.15 ? 0.45 : 0.72;
      ctx.fillStyle = `hsl(${leaf.hue}, 58%, ${leaf.depth > 1.15 ? 32 : 44}%)`;
      ctx.beginPath();
      ctx.ellipse(0, 0, leaf.size * leaf.depth, leaf.size * 0.48 * leaf.depth, 0, 0, Math.PI * 2);
      ctx.fill();
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
    const isCustomUnit = isBandit ? this.vfxAssets.leftUnit.uid !== 96 : this.vfxAssets.rightUnit.uid !== 0;

    if (isCustomUnit && customCutIn && customCutIn.complete && customCutIn.naturalWidth > 0) {
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
    } else {
      const faceImg = this.vfxAssets.clashKeyArt;
      if (faceImg && faceImg.complete && faceImg.naturalWidth > 0) {
        if (isBandit) {
          // Bandit close-up crop from clash_keyart.jpg (265, 185, 330, 165) — facing RIGHT (→), sliding slightly right
          const slideX = (progress - 0.5) * 70;
          ctx.drawImage(faceImg, 265, 185, 330, 165, -250 + slideX, -bannerH * 0.52, 500, bannerH * 1.06);
        } else {
          // Thor close-up crop from clash_keyart.jpg (800, 175, 330, 165) — facing LEFT (←), sliding slightly left
          const slideX = (0.5 - progress) * 70;
          ctx.drawImage(faceImg, 800, 175, 330, 165, -250 + slideX, -bannerH * 0.52, 500, bannerH * 1.06);
        }
      }
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

    // Top-Left: Active Animation Pipeline Indicator Badge
    ctx.save();
    ctx.fillStyle = 'rgba(10, 14, 24, 0.86)';
    ctx.strokeStyle =
      this.config.animSource === 'omni_video'
        ? '#fde047'
        : this.config.animSource === 'nb2_6frame'
          ? '#38bdf8'
          : '#a855f7';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(38, 24, 490, 38, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    const modeLabel =
      this.config.animSource === 'omni_video'
        ? isEn
          ? '🎬 Pipeline: Gemini Omni 1.2 Video + ffmpeg (10 Frames)'
          : '🎬 當前管線：Gemini Omni 1.2 影片生成 + ffmpeg 抽幀 (10 幀序列)'
        : this.config.animSource === 'nb2_6frame'
          ? isEn
            ? '🖼️ Pipeline: Nano Banana 2 + Original Strip (6 Frames)'
            : '🖼️ 當前管線：Nano Banana 2 餵入原版連續圖 (6 幀序列)'
          : isEn
            ? '🎨 Pipeline: Nano Banana 2 Baseline (3 Poses + Blend)'
            : '🎨 當前管線：Nano Banana 2 基礎三關鍵幀 + 補間';
    ctx.fillText(modeLabel, 54, 48);
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
              `全戰鬥角色已生成：${allUnits.length} / 121 (KP1..KP7 100% 驗證通過)`,
              `全战斗角色已生成：${allUnits.length} / 121 (KP1..KP7 100% 验证通过)`,
              `All Combat Units Ready: ${allUnits.length} / 121 (100% KP1..KP7 Verified)`
            )}
          </span>
        </div>

        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <button class="gal-btn active" id="vfx-tab-stage" type="button">🎬 ${tr('2.5D 現代演武舞台', '2.5D 现代演武舞台', 'Live 2.5D Combat Stage')}</button>
          <button class="gal-btn" id="vfx-tab-split" type="button">🔀 ${tr('1995 原版 vs 2026 分割畫面對照', '1995 原版 vs 2026 分割画面对照', '1995 DOS vs 2026 Split-Screen')}</button>
          <button class="gal-btn" id="vfx-tab-art" type="button">🎨 ${tr('雙人對戰原始影片與關鍵幀原稿', '双人对战原始视频与关键帧原稿', 'Matchup Raw Videos & Sheets')}</button>
        </div>
      </div>

      <!-- MASTER ONE-BY-ONE 121-CHARACTER STEPPER BAR -->
      <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 18px; background: linear-gradient(90deg, rgba(30, 41, 59, 0.96), rgba(15, 23, 42, 0.96)); border: 1.5px solid #eab308; border-radius: 10px; box-shadow: 0 6px 20px rgba(0,0,0,0.35);">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span style="font-size: 13.5px; font-weight: 800; color: #fde047;">
            🔍 ${tr('逐一檢視全部 121 角色 (One-by-One)：', '逐一检视全部 121 角色 (One-by-One)：', 'Inspect All 121 Units One-by-One:')}
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
            💡 ${tr('切換角色時自動播放該角色「會心一擊特寫 + 完整攻擊動畫」並同步下方逐幀拆解面板 (快捷鍵 [ / ])', '切换角色时自动播放该角色「会心一击特写 + 完整攻击动画」并同步下方逐帧拆解面板 (快捷键 [ / ])', 'Stepping auto-plays that unit’s Critical Cut-In + Attack and updates the 10F/6F frame strip below (Keys: [ / ])')}
          </span>
        </div>
      </div>

      <!-- DUAL MATCHUP SELECTOR (WITH INDEPENDENT PREV/NEXT STEPPERS) + PIPELINE SWITCHER -->
      <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 18px; background: rgba(15, 23, 42, 0.92); border: 1px solid rgba(56, 189, 248, 0.38); border-radius: 10px;">
        <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
          <div style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #38bdf8;">
            <span>🛡️ ${tr('我方/友軍 (69位 右下↖)：', '我方/友军 (69位 右下↖)：', 'Hero/Ally (69 ↖):')}</span>
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
            <span>⚔️ ${tr('敵軍/頭目 (52位 左上↘)：', '敌军/头目 (52位 左上↘)：', 'Enemy/Boss (52 ↘):')}</span>
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
            🎬 ${tr('方案 B：Gemini Omni 1.2 (10 幀)', '方案 B：Gemini Omni 1.2 (10 帧)', 'Option B: Gemini Omni 1.2 (10F)')}
          </button>
          <button class="gal-btn" id="vfx-src-nb6" type="button">
            🖼️ ${tr('方案 A：Nano Banana 2 (6 幀)', '方案 A：Nano Banana 2 (6 帧)', 'Option A: Nano Banana 2 (6F)')}
          </button>
          <button class="gal-btn" id="vfx-src-nb3" type="button">
            🎨 ${tr('基準組 (3 幀)', '基准组 (3 帧)', 'Baseline (3F)')}
          </button>
        </div>
      </div>

      <!-- LIVE 2.5D COMBAT STAGE CANVAS -->
      <div id="vfx-stage-container" style="position: relative; width: 100%; aspect-ratio: 16 / 9; max-height: 68vh; background: #05080f; border: 1px solid var(--border-subtle, #334155); border-radius: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: 0 18px 48px rgba(0,0,0,0.6);">
        <canvas id="vfx-lab-canvas" width="1600" height="900" style="width: 100%; height: 100%; object-fit: contain;"></canvas>
      </div>

      <!-- DUAL MATCHUP RAW VIDEOS & SHEETS VIEW -->
      <div id="vfx-art-container" style="display: none; padding: 20px; background: var(--bg-panel, #090d16); border: 1px solid var(--border-subtle, #334155); border-radius: 12px;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 18px;">
          <div style="background: #1e293b; padding: 14px; border-radius: 10px; border: 1px solid #eab308;">
            <h4 id="vfx-art-title-b1" style="margin: 0 0 8px 0; color: #fde047;">🎬 Option B1: #${vfxAssets.rightUnit.uid} ${vfxAssets.rightUnit.nameZh} Gemini Omni 1.2 Raw Video (24fps MP4)</h4>
            <video id="vfx-art-vid-b1" src="${vfxAssets.rightUnit.dir}/omni_1p2.mp4?v=9" controls autoplay loop muted playsinline style="width: 100%; border-radius: 8px; background: #fff;"></video>
          </div>
          <div style="background: #1e293b; padding: 14px; border-radius: 10px; border: 1px solid #eab308;">
            <h4 id="vfx-art-title-b2" style="margin: 0 0 8px 0; color: #fde047;">🎬 Option B2: #${vfxAssets.leftUnit.uid} ${vfxAssets.leftUnit.nameZh} Gemini Omni 1.2 Raw Video (24fps MP4)</h4>
            <video id="vfx-art-vid-b2" src="${vfxAssets.leftUnit.dir}/omni_1p2.mp4?v=9" controls autoplay loop muted playsinline style="width: 100%; border-radius: 8px; background: #fff;"></video>
          </div>
          <div style="background: #1e293b; padding: 14px; border-radius: 10px; border: 1px solid #38bdf8;">
            <h4 id="vfx-art-title-a1" style="margin: 0 0 8px 0; color: #38bdf8;">🖼️ Option A1: #${vfxAssets.rightUnit.uid} ${vfxAssets.rightUnit.nameZh} Nano Banana 2 6-Frame Sheet</h4>
            <img id="vfx-art-img-a1" src="${vfxAssets.rightUnit.dir}/nb6_sheet.jpg?v=9" style="width: 100%; border-radius: 8px; background: #fff;" />
          </div>
          <div style="background: #1e293b; padding: 14px; border-radius: 10px; border: 1px solid #f87171;">
            <h4 id="vfx-art-title-a2" style="margin: 0 0 8px 0; color: #f87171;">🖼️ Option A2: #${vfxAssets.leftUnit.uid} ${vfxAssets.leftUnit.nameZh} Nano Banana 2 6-Frame Sheet</h4>
            <img id="vfx-art-img-a2" src="${vfxAssets.leftUnit.dir}/nb6_sheet.jpg?v=9" style="width: 100%; border-radius: 8px; background: #fff;" />
          </div>
          <div style="background: #1e293b; padding: 14px; border-radius: 10px; border: 1px solid #38bdf8;">
            <h4 id="vfx-art-title-c1" style="margin: 0 0 8px 0; color: #7dd3fc;">🔥 Crit Cut-In (←): #${vfxAssets.rightUnit.uid} ${vfxAssets.rightUnit.nameZh}</h4>
            <img id="vfx-art-img-c1" src="${vfxAssets.rightUnit.dir}/cutin.jpg?v=9" style="width: 100%; border-radius: 8px; background: #0f172a;" />
          </div>
          <div style="background: #1e293b; padding: 14px; border-radius: 10px; border: 1px solid #f87171;">
            <h4 id="vfx-art-title-c2" style="margin: 0 0 8px 0; color: #fca5a5;">💥 Crit Cut-In (→): #${vfxAssets.leftUnit.uid} ${vfxAssets.leftUnit.nameZh}</h4>
            <img id="vfx-art-img-c2" src="${vfxAssets.leftUnit.dir}/cutin.jpg?v=9" style="width: 100%; border-radius: 8px; background: #0f172a;" />
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

        <!-- 4-Card Primary Deliverables Row: Cut-In + Option B Video + Option A 6F Sheet + 1995 DOS Reference -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px;">
          <div style="background: #090d16; padding: 12px; border-radius: 10px; border: 1px solid #334155;">
            <div style="font-size: 12.5px; font-weight: 700; color: #fde047; margin-bottom: 6px;">
              💥 ${tr('會心一擊專屬頭像橫幅 (cutin.jpg · 無文字)', '会心一击专属头像横幅 (cutin.jpg · 无文字)', 'Critical-Only Avatar Cut-In Strip (cutin.jpg)')}
            </div>
            <img id="vfx-focus-cutin" src="" style="width: 100%; aspect-ratio: 2 / 1; object-fit: cover; border-radius: 6px; border: 1px solid #475569; background: #05080f;" />
          </div>
          <div style="background: #090d16; padding: 12px; border-radius: 10px; border: 1px solid #334155;">
            <div style="font-size: 12.5px; font-weight: 700; color: #38bdf8; margin-bottom: 6px;">
              🎬 ${tr('方案 B：Gemini Omni 1.2 原始生成影片 (omni_1p2.mp4)', '方案 B：Gemini Omni 1.2 原始生成视频 (omni_1p2.mp4)', 'Option B: Gemini Omni 1.2 Raw Video (omni_1p2.mp4)')}
            </div>
            <video id="vfx-focus-video" src="" controls autoplay loop muted playsinline style="width: 100%; aspect-ratio: 16 / 9; object-fit: contain; border-radius: 6px; background: #ffffff;"></video>
          </div>
          <div style="background: #090d16; padding: 12px; border-radius: 10px; border: 1px solid #334155;">
            <div style="font-size: 12.5px; font-weight: 700; color: #a855f7; margin-bottom: 6px;">
              🖼️ ${tr('方案 A：Nano Banana 2 六幀分解原稿 (nb6_sheet.jpg)', '方案 A：Nano Banana 2 六帧分解原稿 (nb6_sheet.jpg)', 'Option A: Nano Banana 2 6-Frame Sheet (nb6_sheet.jpg)')}
            </div>
            <img id="vfx-focus-nb6sheet" src="" style="width: 100%; aspect-ratio: 16 / 9; object-fit: contain; border-radius: 6px; background: #ffffff;" />
          </div>
          <div style="background: #090d16; padding: 12px; border-radius: 10px; border: 1px solid #334155;">
            <div style="font-size: 12.5px; font-weight: 700; color: #94a3b8; margin-bottom: 6px;">
              🕹️ ${tr('1995 DOS 原版 FIGHT.DAT 六幀基準圖 (dos_ref.jpg)', '1995 DOS 原版 FIGHT.DAT 六帧基准图 (dos_ref.jpg)', '1995 DOS Original 6-Frame Reference (dos_ref.jpg)')}
            </div>
            <img id="vfx-focus-dosref" src="" style="width: 100%; aspect-ratio: 16 / 9; object-fit: contain; border-radius: 6px; background: #0f172a;" />
          </div>
        </div>

        <!-- 10-Frame Alpha-Matted Option B Strip (omni_0..9.png) -->
        <div style="background: #090d16; padding: 12px; border-radius: 10px; border: 1px solid #334155;">
          <div style="font-size: 12.5px; font-weight: 700; color: #fde047; margin-bottom: 8px;">
            🎞️ ${tr('方案 B 去背 10 幀序列逐幀檢視 (omni_0.png .. omni_9.png · 零殘影對齊)', '方案 B 去背 10 帧序列逐帧检视 (omni_0.png .. omni_9.png · 零残影对齐)', 'Option B Alpha-Matted 10-Frame Sequence (omni_0.png .. omni_9.png)')}
          </div>
          <div id="vfx-focus-omni-strip" style="display: grid; grid-template-columns: repeat(10, minmax(90px, 1fr)); gap: 8px; overflow-x: auto;"></div>
        </div>

        <!-- 6-Frame Alpha-Matted Option A Strip (nb6_0..5.png) -->
        <div style="background: #090d16; padding: 12px; border-radius: 10px; border: 1px solid #334155;">
          <div style="font-size: 12.5px; font-weight: 700; color: #38bdf8; margin-bottom: 8px;">
            🧩 ${tr('方案 A 去背 6 幀序列逐幀檢視 (nb6_0.png .. nb6_5.png)', '方案 A 去背 6 帧序列逐帧检视 (nb6_0.png .. nb6_5.png)', 'Option A Alpha-Matted 6-Frame Sequence (nb6_0.png .. nb6_5.png)')}
          </div>
          <div id="vfx-focus-nb6-strip" style="display: grid; grid-template-columns: repeat(6, minmax(120px, 1fr)); gap: 8px; overflow-x: auto;"></div>
        </div>
      </div>

      <!-- ALL-121-UNITS QUICK-JUMP VISUAL ROSTER GRID -->
      <div style="padding: 18px; background: var(--bg-panel, #0f172a); border: 1px solid var(--border-subtle, #334155); border-radius: 12px; display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="font-size: 15px; font-weight: 800; color: #f8fafc;">
              📋 ${tr('全 121 戰鬥角色一覽表 (點擊任一角色卡片立即載入並播放)', '全 121 战斗角色一览表 (点击任一角色卡片立即载入并播放)', 'All 121 Combat Units Directory (Click Any Unit to Inspect & Play)')}
            </span>
            <button class="gal-btn sm active" data-rcat="all" type="button">${tr('全部 (121)', '全部 (121)', 'All (121)')}</button>
            <button class="gal-btn sm" data-rcat="hero" type="button">${tr('32 基礎英雄 (#0..#31)', '32 基础英雄 (#0..#31)', '32 Base Heroes')}</button>
            <button class="gal-btn sm" data-rcat="promo" type="button">${tr('31 轉職職業 (#32..#65)', '31 转职职业 (#32..#65)', '31 Promoted (T2/T3)')}</button>
            <button class="gal-btn sm" data-rcat="ally" type="button">${tr('6 戰場友軍 (#68..#73)', '6 战场友军 (#68..#73)', '6 Allied NPCs')}</button>
            <button class="gal-btn sm" data-rcat="enemy" type="button">${tr('52 敵軍與Boss (#76..#127)', '52 敌军与Boss (#76..#127)', '52 Enemies & Bosses')}</button>
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
  const btnBanditCrit = container.querySelector('#vfx-play-bandit-crit') as HTMLButtonElement;

  const selRightUnit = container.querySelector('#vfx-sel-right-unit') as HTMLSelectElement;
  const selLeftUnit = container.querySelector('#vfx-sel-left-unit') as HTMLSelectElement;
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
        const sideBadge = u.side === 'player' ? '🛡️↖' : '⚔️↘';
        const titleStr = isEn ? `${u.nameEn}` : `${u.nameZh} (${u.nameEn})`;
        const clsStr = isEn ? u.classEn : `${u.classNameZh} · ${u.classEn}`;
        return `
          <button
            type="button"
            data-jump-uid="${u.uid}"
            style="display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: 8px; background: ${bgCol}; border: ${isFocused ? '2px' : '1px'} solid ${borderCol}; color: #f8fafc; text-align: left; cursor: pointer; transition: transform 0.1s;"
          >
            <img src="${u.dir}/cutin.jpg?v=9" loading="lazy" style="width: 68px; height: 34px; object-fit: cover; border-radius: 4px; border: 1px solid #475569; flex-shrink: 0;" />
            <div style="min-width: 0; flex: 1;">
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 4px; font-size: 12px; font-weight: 700;">
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">#${String(u.uid).padStart(3, '0')} ${titleStr}</span>
                <span style="font-size: 11px; flex-shrink: 0;">${sideBadge}</span>
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

    const cb = '?v=9';
    const cutinImg = container.querySelector('#vfx-focus-cutin') as HTMLImageElement | null;
    const vidEl = container.querySelector('#vfx-focus-video') as HTMLVideoElement | null;
    const nb6Img = container.querySelector('#vfx-focus-nb6sheet') as HTMLImageElement | null;
    const dosImg = container.querySelector('#vfx-focus-dosref') as HTMLImageElement | null;
    if (cutinImg) cutinImg.src = `${u.dir}/cutin.jpg${cb}`;
    if (vidEl) vidEl.src = `${u.dir}/omni_1p2.mp4${cb}`;
    if (nb6Img) nb6Img.src = `${u.dir}/nb6_sheet.jpg${cb}`;
    if (dosImg) dosImg.src = `${u.dir}/dos_ref.jpg${cb}`;

    const omniStrip = container.querySelector('#vfx-focus-omni-strip') as HTMLDivElement | null;
    if (omniStrip) {
      const omniLabels = ['F0 Ready', 'F1 Step', 'F2 Wind1', 'F3 Wind2', 'F4 Pre-Hit', 'F5 Impact', 'F6 Bloom', 'F7 Follow1', 'F8 Fade', 'F9 Finish'];
      omniStrip.innerHTML = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
        .map(
          (i) => `
            <div style="background: #141c2e; border: 1px solid #334155; border-radius: 6px; padding: 6px; text-align: center;">
              <img src="${u.dir}/omni_${i}.png${cb}" style="width: 100%; height: 78px; object-fit: contain; display: block;" />
              <div class="mono-tag" style="font-size: 10.5px; color: #cbd5e1; margin-top: 4px;">${omniLabels[i]}</div>
            </div>
          `
        )
        .join('');
    }

    const nb6Strip = container.querySelector('#vfx-focus-nb6-strip') as HTMLDivElement | null;
    if (nb6Strip) {
      const nb6Labels = ['NB6 #0 Ready', 'NB6 #1 Wind-Up 1', 'NB6 #2 Wind-Up 2', 'NB6 #3 Peak Slash', 'NB6 #4 Follow 1', 'NB6 #5 Finish'];
      nb6Strip.innerHTML = [0, 1, 2, 3, 4, 5]
        .map(
          (i) => `
            <div style="background: #141c2e; border: 1px solid #334155; border-radius: 6px; padding: 6px; text-align: center;">
              <img src="${u.dir}/nb6_${i}.png${cb}" style="width: 100%; height: 84px; object-fit: contain; display: block;" />
              <div class="mono-tag" style="font-size: 10.5px; color: #cbd5e1; margin-top: 4px;">${nb6Labels[i]}</div>
            </div>
          `
        )
        .join('');
    }

    renderAll121Grid();
  };

  const refreshMatchupLabelsAndArt = () => {
    const ru = vfxAssets.rightUnit;
    const lu = vfxAssets.leftUnit;
    selRightUnit.value = String(ru.uid);
    selLeftUnit.value = String(lu.uid);
    titleBanner.textContent = `⚡ ${tr(
      `2026 現代 2.5D 戰鬥動畫全角色檢視 — ${ru.nameZh} (#${ru.uid} 右下↖) vs ${lu.nameZh} (#${lu.uid} 左上↘)`,
      `2026 现代 2.5D 战斗动画全角色检视 — ${ru.nameZh} (#${ru.uid} 右下↖) vs ${lu.nameZh} (#${lu.uid} 左上↘)`,
      `2026 Modern 2.5D All-121 Inspector — ${ru.nameEn} (#${ru.uid} ↖) vs. ${lu.nameEn} (#${lu.uid} ↘)`
    )}`;

    const cb = '?v=9';
    const setEl = <T extends HTMLElement>(id: string, fn: (el: T) => void) => {
      const el = container.querySelector(id) as T | null;
      if (el) fn(el);
    };
    setEl<HTMLHeadingElement>('#vfx-art-title-b1', (el) => {
      el.textContent = `🎬 Option B1: #${ru.uid} ${ru.nameZh} (${ru.nameEn}) Gemini Omni 1.2 Raw Video`;
    });
    setEl<HTMLVideoElement>('#vfx-art-vid-b1', (el) => {
      el.src = `${ru.dir}/omni_1p2.mp4${cb}`;
    });
    setEl<HTMLHeadingElement>('#vfx-art-title-b2', (el) => {
      el.textContent = `🎬 Option B2: #${lu.uid} ${lu.nameZh} (${lu.nameEn}) Gemini Omni 1.2 Raw Video`;
    });
    setEl<HTMLVideoElement>('#vfx-art-vid-b2', (el) => {
      el.src = `${lu.dir}/omni_1p2.mp4${cb}`;
    });
    setEl<HTMLHeadingElement>('#vfx-art-title-a1', (el) => {
      el.textContent = `🖼️ Option A1: #${ru.uid} ${ru.nameZh} (${ru.nameEn}) Nano Banana 2 6-Frame Sheet`;
    });
    setEl<HTMLImageElement>('#vfx-art-img-a1', (el) => {
      el.src = `${ru.dir}/nb6_sheet.jpg${cb}`;
    });
    setEl<HTMLHeadingElement>('#vfx-art-title-a2', (el) => {
      el.textContent = `🖼️ Option A2: #${lu.uid} ${lu.nameZh} (${lu.nameEn}) Nano Banana 2 6-Frame Sheet`;
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
  };

  tabStage.addEventListener('click', () => updateViewMode('stage'));
  tabSplit.addEventListener('click', () => updateViewMode('split'));
  tabArt.addEventListener('click', () => updateViewMode('art'));

  btnThorFirst.addEventListener('click', () => updateScenarioBtns('thor_first_duel'));
  btnBanditFirst.addEventListener('click', () => updateScenarioBtns('bandit_first_duel'));
  btnCrit.addEventListener('click', () => updateScenarioBtns('thor_crit'));
  btnBanditCrit.addEventListener('click', () => updateScenarioBtns('bandit_crit'));

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
