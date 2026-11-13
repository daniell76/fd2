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

interface VfxLabAssets {
  loaded: boolean;
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

const vfxAssetsCache: VfxLabAssets = {
  loaded: false,
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

export async function ensureVfxLabAssets(assets: AssetManager): Promise<VfxLabAssets> {
  if (vfxAssetsCache.loaded) {
    return vfxAssetsCache;
  }
  const cacheBust = '?v=8';
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

export type DuelScenario = 'thor_first_duel' | 'bandit_first_duel' | 'thor_crit';

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
    this.banditStrikeDmg = 7;
  }

  public getTotalDurationMs(): number {
    if (this.scenario === 'thor_crit') return 2600;
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
        // 2. Bandit Diagonal Down-Right (↘) Lunge toward Bottom-Right Thor
        const p = (localB - 520) / 300;
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
          this.sound.playSfx('hit');
          if (this.config.enableHitStopAndSparks) {
            this.hitStopRemainingMs = 75;
          }
          this.spawnImpactSparks(
            thorHomeX - 35,
            thorHomeY - 210,
            thorHomeY,
            55,
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
      this.drawAnimeCutInBanner(ctx, W, H, cutInProgress);
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

  private drawAnimeCutInBanner(ctx: CanvasRenderingContext2D, W: number, H: number, progress: number): void {
    const open = progress < 0.18 ? progress / 0.18 : progress > 0.82 ? (1 - progress) / 0.18 : 1;
    if (open <= 0.01) return;

    const bannerH = 175 * open;
    const cy = H * 0.34;

    ctx.save();
    ctx.translate(W * 0.5, cy);
    ctx.rotate(-0.06);

    ctx.beginPath();
    ctx.rect(-W * 0.65, -bannerH * 0.5, W * 1.3, bannerH);
    ctx.clip();

    const bgGrad = ctx.createLinearGradient(-W * 0.5, 0, W * 0.5, 0);
    bgGrad.addColorStop(0, 'rgba(8, 15, 32, 0.94)');
    bgGrad.addColorStop(0.5, 'rgba(15, 38, 72, 0.96)');
    bgGrad.addColorStop(1, 'rgba(120, 28, 18, 0.94)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(-W * 0.65, -bannerH * 0.5, W * 1.3, bannerH);

    ctx.strokeStyle = 'rgba(125, 211, 252, 0.32)';
    for (let i = 0; i < 18; i++) {
      const ly = -bannerH * 0.45 + (i / 17) * bannerH * 0.9;
      const lx = -W * 0.6 + ((this.elapsedMs * 3.5 + i * 190) % (W * 0.8));
      ctx.lineWidth = 1.5 + (i % 3);
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + 260, ly);
      ctx.stroke();
    }

    const faceImg = this.vfxAssets.clashKeyArt;
    if (faceImg && faceImg.complete && faceImg.naturalWidth > 0) {
      const slideX = (0.5 - progress) * 70;
      ctx.drawImage(faceImg, 800, 175, 330, 165, -250 + slideX, -bannerH * 0.52, 500, bannerH * 1.06);
    }

    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fde047';
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
   *  - Enemy Bandit (#96): Bottom-Left `(38, H - 124)`
   *  - Hero Thor (#0): Top-Right `(W - 38 - cardW, 24)`
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

    // Bottom-Left: Enemy Bandit (#96) (matching FD2.EXE `(0, 154)`)
    drawHudCard(
      38,
      H - 122,
      isEn ? 'Bandit (#96)' : '盜賊 (#96)',
      1,
      this.banditDisplayedHp,
      this.banditTargetHp,
      this.banditMaxHp,
      this.banditMp,
      this.banditMaxMp,
      '#ef4444'
    );

    // Top-Right: Hero Thor (#0) (matching FD2.EXE `(171, 4)`)
    drawHudCard(
      W - 38 - cardW,
      24,
      isEn ? 'Thor (#0)' : '索爾 (#0)',
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

/**
 * Mounts the interactive "Modern 2.5D VFX Lab: Thor (#0) vs. Bandit (#96)" directly inside a Gallery tab container.
 */
export async function mountVfxLabInGallery(
  container: HTMLElement,
  assets: AssetManager,
  sound: SoundEngine
): Promise<void> {
  if (activeLabCleanup) {
    activeLabCleanup();
    activeLabCleanup = null;
  }

  container.innerHTML = `
    <div style="padding: 28px; text-align: center; color: var(--ink-300); font-family: var(--font-mono);">
      Loading 2026 Modern 2.5D Anime VFX Keyframes & Shaders...
    </div>
  `;

  const vfxAssets = await ensureVfxLabAssets(assets);
  const renderer = new Modern25DCombatRenderer(vfxAssets, sound);

  container.innerHTML = `
    <div style="max-width: 1460px; margin: 0 auto; padding: 12px 16px 28px; display: flex; flex-direction: column; gap: 14px;">
      <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; background: var(--bg-panel, #0f172a); border: 1px solid var(--border-subtle, #334155); border-radius: 12px;">
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
          <span style="font-size: 18px; font-weight: 800; color: #38bdf8;">
            ⚡ ${tr(
              '2026 現代 2.5D 戰鬥動畫實驗室 — 第 1 章：索爾 (#0 右下↖) vs 盜賊 (#96 左上↘)',
              '2026 现代 2.5D 战斗动画实验室 — 第 1 章：索尔 (#0 右下↖) vs 盗贼 (#96 左上↘)',
              '2026 Modern 2.5D VFX Lab — Ch.1: Thor (#0 Bottom-Right ↖) vs. Bandit (#96 Top-Left ↘)'
            )}
          </span>
          <span style="font-size: 12px; padding: 3px 10px; border-radius: 999px; background: rgba(56, 189, 248, 0.14); color: #7dd3fc; border: 1px solid rgba(56, 189, 248, 0.35);">
            ${tr('Nano Banana 2 6幀原圖條件生成 vs Gemini Omni 1.2 影片 ffmpeg 抽幀對照', 'Nano Banana 2 6帧原图条件生成 vs Gemini Omni 1.2 视频 ffmpeg 抽帧对照', 'Compare Nano Banana 2 (6-Frame Strip) vs. Gemini Omni 1.2 Video (ffmpeg 10-Frame)')}
          </span>
        </div>

        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <button class="gal-btn active" id="vfx-tab-stage" type="button">🎬 ${tr('2.5D 現代演武舞台', '2.5D 现代演武舞台', 'Live 2.5D Combat Stage')}</button>
          <button class="gal-btn" id="vfx-tab-split" type="button">🔀 ${tr('1995 原版 vs 2026 分割畫面對照', '1995 原版 vs 2026 分割画面对照', '1995 DOS vs 2026 Split-Screen')}</button>
          <button class="gal-btn" id="vfx-tab-art" type="button">🎨 ${tr('Omni 原始影片與高解析關鍵幀原稿', 'Omni 原始视频与高解析关键帧原稿', 'Omni Raw Videos & Keyframe Sheets')}</button>
        </div>
      </div>

      <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 18px; background: rgba(15, 23, 42, 0.92); border: 1px solid rgba(251, 191, 36, 0.4); border-radius: 10px;">
        <span style="font-size: 13.5px; font-weight: 700; color: #fde047;">
          🔬 ${tr('切換動畫生成管線 (即時對比)：', '切换动画生成管线 (即时对比)：', 'Animation Generation Pipeline (Live Compare):')}
        </span>
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <button class="gal-btn active" id="vfx-src-omni" type="button">
            🎬 ${tr('方案 B：Gemini Omni 1.2 影片 + ffmpeg 抽幀 (10 幀)', '方案 B：Gemini Omni 1.2 视频 + ffmpeg 抽帧 (10 帧)', 'Option B: Gemini Omni 1.2 Video + ffmpeg (10 Frames)')}
          </button>
          <button class="gal-btn" id="vfx-src-nb6" type="button">
            🖼️ ${tr('方案 A：Nano Banana 2 餵入原版連續圖 (6 幀)', '方案 A：Nano Banana 2 喂入原版连续图 (6 帧)', 'Option A: Nano Banana 2 + Original Strip (6 Frames)')}
          </button>
          <button class="gal-btn" id="vfx-src-nb3" type="button">
            🎨 ${tr('基準組：Nano Banana 2 三關鍵幀 + 補間 (3 幀)', '基准组：Nano Banana 2 三关键帧 + 补间 (3 帧)', 'Baseline: Nano Banana 2 (3 Poses + Blend)')}
          </button>
        </div>
      </div>

      <div id="vfx-stage-container" style="position: relative; width: 100%; aspect-ratio: 16 / 9; max-height: 70vh; background: #05080f; border: 1px solid var(--border-subtle, #334155); border-radius: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: 0 18px 48px rgba(0,0,0,0.6);">
        <canvas id="vfx-lab-canvas" width="1600" height="900" style="width: 100%; height: 100%; object-fit: contain;"></canvas>
      </div>

      <div id="vfx-art-container" style="display: none; padding: 20px; background: var(--bg-panel, #090d16); border: 1px solid var(--border-subtle, #334155); border-radius: 12px;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 18px;">
          <div style="background: #1e293b; padding: 14px; border-radius: 10px; border: 1px solid #eab308;">
            <h4 style="margin: 0 0 8px 0; color: #fde047;">🎬 Option B1: Thor (#0 索爾) Gemini Omni 1.2 Raw Video (45° CW Up-Left Crescent Aligned)</h4>
            <video src="assets/vfx_lab/thor_omni_1p2.mp4?v=8" controls autoplay loop muted playsinline style="width: 100%; border-radius: 8px; background: #fff;"></video>
          </div>
          <div style="background: #1e293b; padding: 14px; border-radius: 10px; border: 1px solid #eab308;">
            <h4 style="margin: 0 0 8px 0; color: #fde047;">🎬 Option B2: Bandit (#96 盜賊) Gemini Omni 1.2 Raw Video (24fps MP4)</h4>
            <video src="assets/vfx_lab/bandit_omni_1p2.mp4?v=8" controls autoplay loop muted playsinline style="width: 100%; border-radius: 8px; background: #fff;"></video>
          </div>
          <div style="background: #1e293b; padding: 14px; border-radius: 10px; border: 1px solid #38bdf8;">
            <h4 style="margin: 0 0 8px 0; color: #38bdf8;">🖼️ Option A1: Thor (#0 索爾) Nano Banana 2 6-Frame Sheet (45° CW Up-Left Crescent Aligned)</h4>
            <img src="assets/vfx_lab/thor_nb6_sheet.jpg?v=8" style="width: 100%; border-radius: 8px; background: #fff;" />
          </div>
          <div style="background: #1e293b; padding: 14px; border-radius: 10px; border: 1px solid #f87171;">
            <h4 style="margin: 0 0 8px 0; color: #f87171;">🖼️ Option A2: Bandit (#96 盜賊) Nano Banana 2 6-Frame Sheet (Conditioned on 1995 Strip)</h4>
            <img src="assets/vfx_lab/bandit_nb6_sheet.jpg?v=8" style="width: 100%; border-radius: 8px; background: #fff;" />
          </div>
          <div style="background: #1e293b; padding: 14px; border-radius: 10px; border: 1px solid #334155;">
            <h4 style="margin: 0 0 8px 0; color: #94a3b8;">🎨 Baseline: Thor (#0) Transparent Sheet</h4>
            <img src="assets/vfx_lab/thor_sheet_raw.png?v=8" style="width: 100%; border-radius: 8px; background: #fff;" />
          </div>
          <div style="background: #1e293b; padding: 14px; border-radius: 10px; border: 1px solid #334155;">
            <h4 style="margin: 0 0 8px 0; color: #94a3b8;">🎨 Baseline: Bandit (#96) Transparent Sheet</h4>
            <img src="assets/vfx_lab/bandit_sheet_raw.png?v=8" style="width: 100%; border-radius: 8px; background: #fff;" />
          </div>
        </div>
      </div>

      <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; background: var(--bg-panel, #0f172a); border: 1px solid var(--border-subtle, #334155); border-radius: 12px;">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <button class="gal-btn active" id="vfx-play-thor-first" type="button">
            ⚔️ ${tr('我方先攻 + 敵方反擊 (索爾↖ → 盜賊↘)', '我方先攻 + 敌方反击 (索尔↖ → 盗贼↘)', 'Hero Initiates (↖) + Enemy Retaliates (↘)')}
          </button>
          <button class="gal-btn" id="vfx-play-bandit-first" type="button">
            🛡️ ${tr('敵方先攻 + 我方反擊 (盜賊↘ → 索爾↖)', '敌方先攻 + 我方反击 (盗贼↘ → 索尔↖)', 'Enemy Initiates (↘) + Hero Retaliates (↖)')}
          </button>
          <button class="gal-btn" id="vfx-play-crit" type="button">
            🔥 ${tr('索爾會心一擊必殺', '索尔会心一击必杀', 'Thor Critical Hit KO')}
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

  let splitCompare = false;
  let activeScenario: DuelScenario = 'thor_first_duel';
  renderer.startScenario(activeScenario);

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

  const updateScenarioBtns = (scen: DuelScenario) => {
    activeScenario = scen;
    btnThorFirst.classList.toggle('active', scen === 'thor_first_duel');
    btnBanditFirst.classList.toggle('active', scen === 'bandit_first_duel');
    btnCrit.classList.toggle('active', scen === 'thor_crit');
    renderer.startScenario(scen);
  };

  tabStage.addEventListener('click', () => updateViewMode('stage'));
  tabSplit.addEventListener('click', () => updateViewMode('split'));
  tabArt.addEventListener('click', () => updateViewMode('art'));

  btnThorFirst.addEventListener('click', () => updateScenarioBtns('thor_first_duel'));
  btnBanditFirst.addEventListener('click', () => updateScenarioBtns('bandit_first_duel'));
  btnCrit.addEventListener('click', () => updateScenarioBtns('thor_crit'));

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
    cancelAnimationFrame(rafId);
  };
}
