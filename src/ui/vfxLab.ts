import type { SoundEngine } from '../audio/soundEngine';
import type { AssetManager } from '../engine/assets';
import { getLocale } from '../i18n';
import type { CombatOutcome, FigAniStrip } from '../types';

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
  depth: number; // 0.5 (far) .. 1.4 (foreground bokeh)
}

interface DamagePopup {
  x: number;
  y: number;
  vy: number;
  text: string;
  subText?: string;
  isCrit: boolean;
  ageMs: number;
  durationMs: number;
}

export interface ModernVfxConfig {
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
  const [
    t0,
    t1,
    t2,
    b0,
    b1,
    b2,
    tRaw,
    bRaw,
    clashImg,
    forestBg,
    cThorIdle,
    cThorAtk,
    cBanditIdle,
    cBanditAtk,
  ] = await Promise.all([
    loadImg('assets/vfx_lab/thor_pose_0.png'),
    loadImg('assets/vfx_lab/thor_pose_1.png'),
    loadImg('assets/vfx_lab/thor_pose_2.png'),
    loadImg('assets/vfx_lab/bandit_pose_0.png'),
    loadImg('assets/vfx_lab/bandit_pose_1.png'),
    loadImg('assets/vfx_lab/bandit_pose_2.png'),
    loadImg('assets/vfx_lab/thor_sheet_raw.png'),
    loadImg('assets/vfx_lab/bandit_sheet_raw.png'),
    loadImg('assets/vfx_lab/clash_keyart.jpg'),
    loadImg('assets/hd_bgs/bg_4.png').catch(() => loadImg('assets/bgs/bg_4.png')),
    assets.loadUnitFigAni(0, 'idle'),
    assets.loadUnitFigAni(0, 'attack'),
    assets.loadUnitFigAni(96, 'idle'),
    assets.loadUnitFigAni(96, 'attack'),
  ]);

  vfxAssetsCache.thorPoses = [t0, t1, t2];
  vfxAssetsCache.banditPoses = [b0, b1, b2];
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

export type DuelScenario = 'full_duel' | 'thor_crit' | 'bandit_cleave';

/**
 * Self-contained 60fps Modern 2.5D Anime VFX Combat Renderer for Thor (#0) vs. Bandit (#96).
 */
export class Modern25DCombatRenderer {
  private sparks: VfxSpark[] = [];
  private dust: VfxDust[] = [];
  private leaves: VfxLeaf[] = [];
  private popups: DamagePopup[] = [];
  private scenario: DuelScenario = 'full_duel';
  private elapsedMs = 0;
  private hitStopRemainingMs = 0;
  private triggeredEvents = new Set<string>();

  private thorHp = 35;
  private thorMaxHp = 35;
  private banditHp = 35;
  private banditMaxHp = 35;
  private thorTargetDamage = 24;
  private banditTargetDamage = 7;

  constructor(
    private vfxAssets: VfxLabAssets,
    private sound: SoundEngine,
    public config: ModernVfxConfig = {
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

  public startScenario(
    scenario: DuelScenario,
    opts?: {
      thorStartHp?: number;
      thorMaxHp?: number;
      banditStartHp?: number;
      banditMaxHp?: number;
      thorDmg?: number;
      banditDmg?: number;
    }
  ): void {
    this.scenario = scenario;
    this.elapsedMs = 0;
    this.hitStopRemainingMs = 0;
    this.triggeredEvents.clear();
    this.sparks = [];
    this.dust = [];
    this.popups = [];
    this.thorMaxHp = opts?.thorMaxHp ?? 35;
    this.thorHp = opts?.thorStartHp ?? this.thorMaxHp;
    this.banditMaxHp = opts?.banditMaxHp ?? 35;
    this.banditHp = opts?.banditStartHp ?? this.banditMaxHp;
    this.thorTargetDamage = opts?.thorDmg ?? (scenario === 'thor_crit' ? 28 : 22);
    this.banditTargetDamage = opts?.banditDmg ?? 7;
  }

  public getTotalDurationMs(): number {
    if (this.scenario === 'thor_crit') return 2600;
    if (this.scenario === 'bandit_cleave') return 2400;
    return 4400;
  }

  public isFinished(): boolean {
    return this.elapsedMs >= this.getTotalDurationMs();
  }

  public getElapsedMs(): number {
    return this.elapsedMs;
  }

  private fireOnce(key: string, fn: () => void): void {
    if (!this.triggeredEvents.has(key)) {
      this.triggeredEvents.add(key);
      fn();
    }
  }

  private spawnImpactSparks(cx: number, cy: number, count: number, palette: string[], dirBiasX: number): void {
    if (!this.config.enableHitStopAndSparks) return;
    for (let i = 0; i < count; i++) {
      const angle = (Math.random() - 0.5) * Math.PI * 1.45 + (dirBiasX < 0 ? Math.PI : 0);
      const speed = 260 + Math.random() * 780;
      this.sparks.push({
        x: cx + (Math.random() - 0.5) * 24,
        y: cy + (Math.random() - 0.5) * 24,
        vx: Math.cos(angle) * speed + dirBiasX * 140,
        vy: Math.sin(angle) * speed - 180 - Math.random() * 220,
        size: 2.2 + Math.random() * 4.5,
        color: palette[i % palette.length],
        alpha: 1,
        life: 0,
        maxLife: 320 + Math.random() * 450,
        bounces: 0,
      });
    }
  }

  private spawnDustPlume(x: number, y: number, dirX: number, count = 10): void {
    if (!this.config.enableHitStopAndSparks) return;
    for (let i = 0; i < count; i++) {
      this.dust.push({
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 12,
        vx: dirX * (60 + Math.random() * 190) + (Math.random() - 0.5) * 60,
        vy: -25 - Math.random() * 65,
        radius: 16 + Math.random() * 24,
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
      this.updateParticles(dtMs, W, H);
    }

    if (splitCompareClassic) {
      // Left half: 1995 Classic DOS 320x200 view; Right half: 2026 Modern 2.5D view
      ctx.save();
      this.renderModernScene(ctx, W, H);
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, Math.floor(W * 0.48), H);
      ctx.clip();
      this.renderClassic1995Scene(ctx, W, H);
      ctx.restore();

      // Split divider bar & badges
      const splitX = Math.floor(W * 0.48);
      ctx.save();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, H);
      ctx.stroke();

      ctx.fillStyle = 'rgba(12, 14, 22, 0.85)';
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.fillRect(18, 18, 290, 36);
      ctx.strokeRect(18, 18, 290, 36);
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 15px monospace';
      ctx.fillText('◀ 1995 DOS VGA (320×200 Indexed)', 30, 41);

      ctx.fillStyle = 'rgba(12, 14, 22, 0.85)';
      ctx.fillRect(splitX + 18, 18, 340, 36);
      ctx.strokeRect(splitX + 18, 18, 340, 36);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('2026 Modern 2.5D Anime VFX Engine ▶', splitX + 30, 41);
      ctx.restore();
    } else {
      this.renderModernScene(ctx, W, H);
    }
  }

  private updateParticles(dtMs: number, W: number, H: number): void {
    const dt = dtMs / 1000;
    const groundY = H * 0.81;

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
      s.vy += 1650 * dt; // Gravity
      if (s.y >= groundY && s.vy > 0 && s.bounces < 2) {
        s.y = groundY;
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

    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.ageMs += dtMs;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
      if (p.vy > 0) p.vy = 0;
      if (p.ageMs >= p.durationMs) {
        this.popups.splice(i, 1);
      }
    }
  }

  private renderClassic1995Scene(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    // Emulate exact 1995 320x200 nearest-neighbor look scaled to canvas
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (this.vfxAssets.forestBg) {
      ctx.drawImage(this.vfxAssets.forestBg, 0, 0, W, H);
    } else {
      ctx.fillStyle = '#183018';
      ctx.fillRect(0, 0, W, H);
    }

    const scaleX = W / 320;
    const scaleY = H / 200;
    const t = this.elapsedMs;

    // Determine classic frame states synchronized with modern timeline
    const cThorIdle = this.vfxAssets.classicThorIdle;
    const cThorAtk = this.vfxAssets.classicThorAtk;
    const cBanditIdle = this.vfxAssets.classicBanditIdle;
    const cBanditAtk = this.vfxAssets.classicBanditAtk;

    let thorSprite = cThorIdle;
    let thorFrameIdx = Math.floor(t / 180) % Math.max(1, cThorIdle?.strip.frames.length ?? 1);
    let thorGridX = 0;

    let banditSprite = cBanditIdle;
    let banditFrameIdx = Math.floor(t / 180) % Math.max(1, cBanditIdle?.strip.frames.length ?? 1);
    let banditGridX = 0;

    if (this.scenario !== 'bandit_cleave' && t >= 350 && t < 1850 && cThorAtk && cThorAtk.strip.frames.length > 0) {
      thorSprite = cThorAtk;
      const p = Math.min(0.999, (t - 350) / 1450);
      thorFrameIdx = Math.floor(p * cThorAtk.strip.frames.length);
      if (p < 0.65) {
        thorGridX = Math.floor((p / 0.65) * 4) * 28;
      } else {
        thorGridX = Math.floor(((1 - p) / 0.35) * 4) * 28;
      }
    }

    const banditStart = this.scenario === 'bandit_cleave' ? 250 : 2100;
    if (
      this.scenario !== 'thor_crit' &&
      t >= banditStart &&
      t < banditStart + 1500 &&
      cBanditAtk &&
      cBanditAtk.strip.frames.length > 0
    ) {
      banditSprite = cBanditAtk;
      const p = Math.min(0.999, (t - banditStart) / 1450);
      banditFrameIdx = Math.floor(p * cBanditAtk.strip.frames.length);
      if (p < 0.65) {
        banditGridX = Math.floor((p / 0.65) * 4) * 28;
      } else {
        banditGridX = Math.floor(((1 - p) / 0.35) * 4) * 28;
      }
    }

    const drawClassicFig = (bundle: ClassicFigBundle | null, fIdx: number, anchorX: number, anchorY: number) => {
      if (!bundle || bundle.strip.frames.length === 0) return;
      const frames = bundle.strip.frames;
      const f = frames[Math.max(0, Math.min(frames.length - 1, fIdx))];
      const imgScale = bundle.img.naturalHeight / Math.max(1, bundle.strip.stripH);
      const sx = f.sx * imgScale;
      const sw = f.w * imgScale;
      const sh = f.h * imgScale;
      const dx = (anchorX - f.ox) * scaleX;
      const dy = (anchorY - f.oy) * scaleY;
      const dw = f.w * scaleX;
      const dh = f.h * scaleY;
      ctx.drawImage(bundle.img, sx, 0, sw, sh, dx, dy, dw, dh);
    };

    drawClassicFig(banditSprite, banditFrameIdx, 76 + banditGridX, 146);
    drawClassicFig(thorSprite, thorFrameIdx, 240 - thorGridX, 152);
    ctx.restore();
  }

  private renderModernScene(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const t = this.elapsedMs;
    const groundY = H * 0.82;

    // -------------------------------------------------------------------------
    // 1. Choreograph Timeline State (Thor Strike + Bandit Counter)
    // -------------------------------------------------------------------------
    let thorPoseIdx = 0;
    let thorX = W * 0.73;
    let thorY = groundY;
    let thorScaleX = 1.0;
    let thorScaleY = 1.0;
    let thorRot = 0;
    let thorFlashWhite = 0;
    let thorAfterimages = 0;

    let banditPoseIdx = 0;
    let banditX = W * 0.27;
    let banditY = groundY;
    let banditScaleX = 1.0;
    let banditScaleY = 1.0;
    let banditRot = 0;
    let banditFlashWhite = 0;
    let banditAfterimages = 0;

    let camX = 0;
    let camY = 0;
    let camZoom = 1.0;
    let camTilt = 0;
    let camShake = 0;

    let slashArcProgress = -1; // 0..1 active Thor golden-azure crescent slash
    let banditSlashProgress = -1; // 0..1 active Bandit crimson-steel cleave
    let cutInProgress = -1; // 0..1 active Anime Eye Cut-In banner
    let impactFlashAlpha = 0;
    let shockwaveProgress = -1;
    let shockwaveCenter = { x: W * 0.36, y: groundY - 210 };

    // Subtle 60fps breathing spring
    const breath = this.config.enableAfterimagesAndSpring ? Math.sin(t * 0.0055) * 0.014 : 0;
    thorScaleY += breath;
    thorScaleX -= breath * 0.5;
    banditScaleY += Math.sin(t * 0.005 + 1.4) * (this.config.enableAfterimagesAndSpring ? 0.014 : 0);

    // Phase A: Thor's Attack (runs in 'full_duel' and 'thor_crit')
    if (this.scenario === 'full_duel' || this.scenario === 'thor_crit') {
      if (t >= 320 && t < 780) {
        // Wind-up & camera dolly-in on Thor
        const p = (t - 320) / 460;
        const ease = 1 - Math.pow(1 - p, 3);
        thorPoseIdx = 1;
        thorX = W * 0.73 + ease * 26;
        thorScaleY = 1.0 - Math.sin(p * Math.PI) * 0.05;
        camZoom = 1.0 + ease * 0.14;
        camX = ease * W * 0.09;
        camTilt = -ease * 0.018;
        this.fireOnce('thor_windup_sfx', () => {
          this.sound.playSfx('step_foot');
          this.spawnDustPlume(thorX, groundY, 1, 8);
        });
      } else if (t >= 780 && t < 1140) {
        // Optional Anime Critical Eye Cut-In + Forward High-Speed Dash!
        const p = (t - 780) / 360;
        thorPoseIdx = 1;
        if (this.config.enableAnimeCutIn) {
          cutInProgress = p;
        }
        const dashP = Math.max(0, (p - 0.25) / 0.75);
        const dashEase = 1 - Math.pow(1 - dashP, 3);
        thorX = W * 0.75 - dashEase * (W * 0.31);
        thorAfterimages = this.config.enableAfterimagesAndSpring && dashP > 0.05 ? 4 : 0;
        camZoom = 1.14 + dashEase * 0.08;
        camX = W * 0.09 - dashEase * (W * 0.19);
        camTilt = -0.018 + dashEase * 0.036;
        this.fireOnce('thor_dash_sfx', () => {
          this.sound.playSfx('slash');
          this.spawnDustPlume(W * 0.74, groundY, 1, 14);
        });
      } else if (t >= 1140 && t < 1720) {
        // Impact Cleave & Follow-Through!
        const p = (t - 1140) / 580;
        thorPoseIdx = 2;
        thorX = W * 0.44 - Math.min(1, p * 4) * 28;
        slashArcProgress = Math.min(1, p * 2.1);
        shockwaveProgress = Math.min(1, p * 1.8);
        shockwaveCenter = { x: banditX + 55, y: groundY - 210 };

        this.fireOnce('thor_impact', () => {
          this.sound.playSfx('crit');
          if (this.config.enableHitStopAndSparks) {
            this.hitStopRemainingMs = 95;
          }
          this.spawnImpactSparks(
            banditX + 55,
            groundY - 210,
            80,
            ['#ffffff', '#fde047', '#f59e0b', '#38bdf8', '#7dd3fc'],
            -1
          );
          this.spawnDustPlume(banditX, groundY, -1, 16);
          this.banditHp = Math.max(0, this.banditHp - this.thorTargetDamage);
          this.popups.push({
            x: banditX - 20,
            y: groundY - 380,
            vy: -260,
            text: `-${this.thorTargetDamage}`,
            subText: this.scenario === 'thor_crit' || this.config.enableAnimeCutIn ? 'CRITICAL!' : undefined,
            isCrit: true,
            ageMs: 0,
            durationMs: 1250,
          });
        });

        // Bandit recoil & flash
        const recoil = Math.sin(Math.min(1, p * 2.2) * Math.PI);
        banditX = W * 0.27 - recoil * 58;
        banditRot = -recoil * 0.11;
        banditScaleX = 1.0 - recoil * 0.08;
        banditScaleY = 1.0 + recoil * 0.06;
        banditFlashWhite = Math.max(0, 1 - p * 3.5);
        impactFlashAlpha = Math.max(0, 1 - p * 4.5);

        camZoom = 1.22 - p * 0.12;
        camX = -W * 0.1 * (1 - p * 0.5);
        camTilt = 0.018 * (1 - p);
        camShake = this.config.enableHitStopAndSparks ? Math.max(0, (1 - p * 2.4) * 24) : 0;
      } else if (t >= 1720 && t < 2150) {
        // Recover & backstep to right side
        const p = (t - 1720) / 430;
        const ease = 1 - Math.pow(1 - p, 2);
        thorPoseIdx = p < 0.35 ? 2 : 0;
        thorX = W * 0.42 + ease * (W * 0.31);
        thorAfterimages = this.config.enableAfterimagesAndSpring && p < 0.65 ? 2 : 0;
        camZoom = 1.1 - ease * 0.1;
        camX = -W * 0.05 * (1 - ease);
      }
    }

    // Phase B: Bandit Counter-Attack (runs in 'full_duel' after t=2250ms, or 'bandit_cleave' at t=250ms)
    const bStart = this.scenario === 'bandit_cleave' ? 250 : 2250;
    if (this.scenario === 'full_duel' || this.scenario === 'bandit_cleave') {
      if (t >= bStart && t < bStart + 520) {
        // Bandit Overhead Cleave Wind-Up
        const p = (t - bStart) / 520;
        const ease = 1 - Math.pow(1 - p, 3);
        banditPoseIdx = 1;
        banditX = W * 0.27 - ease * 18;
        camZoom = 1.0 + ease * 0.12;
        camX = -ease * W * 0.08;
        camTilt = ease * 0.015;
        this.fireOnce('bandit_windup', () => {
          this.sound.playSfx('step_foot');
          this.spawnDustPlume(banditX, groundY, -1, 8);
        });
      } else if (t >= bStart + 520 && t < bStart + 820) {
        // Bandit Forward Lunge
        const p = (t - (bStart + 520)) / 300;
        const ease = 1 - Math.pow(1 - p, 3);
        banditPoseIdx = 1;
        banditX = W * 0.26 + ease * (W * 0.3);
        banditAfterimages = this.config.enableAfterimagesAndSpring ? 3 : 0;
        camZoom = 1.12 + ease * 0.07;
        camX = -W * 0.08 + ease * (W * 0.16);
        this.fireOnce('bandit_dash', () => {
          this.sound.playSfx('slash');
          this.spawnDustPlume(W * 0.27, groundY, -1, 12);
        });
      } else if (t >= bStart + 820 && t < bStart + 1400) {
        // Bandit Downward Cleave Impact!
        const p = (t - (bStart + 820)) / 580;
        banditPoseIdx = 2;
        banditX = W * 0.56 + Math.min(1, p * 4) * 22;
        banditSlashProgress = Math.min(1, p * 2.2);
        shockwaveProgress = Math.min(1, p * 1.9);
        shockwaveCenter = { x: thorX - 45, y: groundY - 210 };

        this.fireOnce('bandit_impact', () => {
          this.sound.playSfx('hit');
          if (this.config.enableHitStopAndSparks) {
            this.hitStopRemainingMs = 75;
          }
          this.spawnImpactSparks(
            thorX - 45,
            groundY - 210,
            55,
            ['#ffffff', '#fca5a5', '#ef4444', '#fb923c', '#fde047'],
            1
          );
          this.spawnDustPlume(thorX, groundY, 1, 14);
          this.thorHp = Math.max(1, this.thorHp - this.banditTargetDamage);
          this.popups.push({
            x: thorX + 10,
            y: groundY - 370,
            vy: -230,
            text: `-${this.banditTargetDamage}`,
            isCrit: false,
            ageMs: 0,
            durationMs: 1100,
          });
        });

        const recoil = Math.sin(Math.min(1, p * 2.2) * Math.PI);
        thorX = W * 0.73 + recoil * 44;
        thorRot = recoil * 0.08;
        thorFlashWhite = Math.max(0, 1 - p * 3.8);
        impactFlashAlpha = Math.max(0, (1 - p * 4.8) * 0.7);

        camZoom = 1.19 - p * 0.1;
        camX = W * 0.08 * (1 - p * 0.5);
        camShake = this.config.enableHitStopAndSparks ? Math.max(0, (1 - p * 2.5) * 18) : 0;
      } else if (t >= bStart + 1400 && t < bStart + 1850) {
        // Bandit leaps back to left position
        const p = (t - (bStart + 1400)) / 450;
        const ease = 1 - Math.pow(1 - p, 2);
        banditPoseIdx = p < 0.35 ? 2 : 0;
        banditX = W * 0.58 - ease * (W * 0.31);
        banditAfterimages = this.config.enableAfterimagesAndSpring && p < 0.6 ? 2 : 0;
        camZoom = 1.09 - ease * 0.09;
        camX = W * 0.04 * (1 - ease);
      }
    }

    // -------------------------------------------------------------------------
    // 2. Apply Dynamic Camera Transform (Dolly Zoom, Pan, Shake, Tilt)
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

    // -------------------------------------------------------------------------
    // 3. Multi-Plane 2.5D Forest Stage & Volumetric Sunbeams
    // -------------------------------------------------------------------------
    this.drawForestBackground(ctx, W, H, camX, camY, groundY);

    // -------------------------------------------------------------------------
    // 4. Ground Contact Shadows & Shockwave Ring
    // -------------------------------------------------------------------------
    this.drawGroundShadow(ctx, banditX, groundY, 210);
    this.drawGroundShadow(ctx, thorX, groundY, 210);

    if (shockwaveProgress >= 0 && shockwaveProgress <= 1 && this.config.enableHitStopAndSparks) {
      this.drawGroundShockwave(ctx, shockwaveCenter.x, groundY - 12, shockwaveProgress);
    }

    // -------------------------------------------------------------------------
    // 5. Characters + High-Speed Dash Afterimages
    // -------------------------------------------------------------------------
    const banditImg = this.vfxAssets.banditPoses[banditPoseIdx] || this.vfxAssets.banditPoses[0];
    const thorImg = this.vfxAssets.thorPoses[thorPoseIdx] || this.vfxAssets.thorPoses[0];

    // Draw Bandit
    if (banditAfterimages > 0) {
      for (let g = banditAfterimages; g >= 1; g--) {
        this.drawCharacterSprite(
          ctx,
          banditImg,
          banditX - g * 34,
          banditY,
          banditScaleX,
          banditScaleY,
          banditRot,
          0.16 * (1 - g / (banditAfterimages + 1)),
          '#ef4444'
        );
      }
    }
    this.drawCharacterSprite(
      ctx,
      banditImg,
      banditX,
      banditY,
      banditScaleX,
      banditScaleY,
      banditRot,
      1.0,
      banditFlashWhite > 0.15 ? '#ffffff' : undefined
    );

    // Bandit glowing green visor optics accent during wind-up
    if (banditPoseIdx === 1) {
      this.drawBanditVisorGlint(ctx, banditX + 26, banditY - 375, t);
    }

    // Draw Thor
    if (thorAfterimages > 0) {
      for (let g = thorAfterimages; g >= 1; g--) {
        this.drawCharacterSprite(
          ctx,
          thorImg,
          thorX + g * 38,
          thorY,
          thorScaleX,
          thorScaleY,
          thorRot,
          0.22 * (1 - g / (thorAfterimages + 1)),
          '#38bdf8'
        );
      }
    }
    this.drawCharacterSprite(
      ctx,
      thorImg,
      thorX,
      thorY,
      thorScaleX,
      thorScaleY,
      thorRot,
      1.0,
      thorFlashWhite > 0.15 ? '#ffffff' : undefined
    );

    // Sword gathering energy aura during Thor's wind-up
    if (thorPoseIdx === 1 && t >= 320 && t < 1140 && this.config.enableVolumetricSlash) {
      this.drawBladeChargeAura(ctx, thorX + 45, thorY - 430, (t - 320) / 820);
    }

    // -------------------------------------------------------------------------
    // 6. Procedural Volumetric Crescent Sword Slash Shaders
    // -------------------------------------------------------------------------
    if (slashArcProgress >= 0 && slashArcProgress <= 1 && this.config.enableVolumetricSlash) {
      this.drawVolumetricCrescentSlash(
        ctx,
        banditX + 85,
        groundY - 225,
        345,
        slashArcProgress,
        'thor_golden_azure'
      );
    }

    if (banditSlashProgress >= 0 && banditSlashProgress <= 1 && this.config.enableVolumetricSlash) {
      this.drawVolumetricCrescentSlash(
        ctx,
        thorX - 75,
        groundY - 220,
        310,
        banditSlashProgress,
        'bandit_crimson_steel'
      );
    }

    // -------------------------------------------------------------------------
    // 7. Dust Plumes, Physics Sparks & Foreground Bokeh Leaves
    // -------------------------------------------------------------------------
    this.drawDustAndSparks(ctx);
    this.drawForegroundLeaves(ctx);

    // -------------------------------------------------------------------------
    // 8. Animated Damage Popups
    // -------------------------------------------------------------------------
    this.drawDamagePopups(ctx);

    ctx.restore(); // End camera transform

    // -------------------------------------------------------------------------
    // 9. Screen-Space Impact Flash, Anime Critical Cut-In Banner & Modern HUD
    // -------------------------------------------------------------------------
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

    // Subtle atmospheric depth vignette & warm sunlit ground grade
    const stageGrade = ctx.createLinearGradient(0, 0, 0, H);
    stageGrade.addColorStop(0, 'rgba(8, 22, 16, 0.35)');
    stageGrade.addColorStop(0.55, 'rgba(16, 38, 24, 0.12)');
    stageGrade.addColorStop(0.82, 'rgba(28, 24, 14, 0.28)');
    stageGrade.addColorStop(1, 'rgba(10, 12, 8, 0.65)');
    ctx.fillStyle = stageGrade;
    ctx.fillRect(bgX, bgY, bgW, bgH);

    if (!this.config.enableParallaxAndGodRays) return;

    // Animated Volumetric Sunbeam God-Rays filtering through the canopy
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
    grad.addColorStop(0, 'rgba(5, 8, 6, 0.72)');
    grad.addColorStop(0.6, 'rgba(5, 8, 6, 0.35)');
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
    tintColor?: string
  ): void {
    if (!img || !img.complete || img.naturalWidth === 0) return;
    // Standardized 680x680 pose canvas with foot anchor at (340, 648)
    const displaySize = 530;
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
      // Rim / hit flash overlay
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

    // Horizontal lens flare streak
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

  /**
   * Procedural Multi-Layered Volumetric Crescent Sword Slash Shader
   * Renders an anime-grade tapered crescent energy ribbon (Outer Aura + Flame Mid-Core + White-Hot Blade Edge + Impact Cross-Flare).
   */
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
      ctx.rotate(-0.32);
    } else {
      ctx.scale(-1, 1);
      ctx.rotate(-0.25);
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
        // Taper thickness cleanly to 0 at both tips of the crescent
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
      // Layer 1: Wide Cyan-Azure Outer Glow
      drawTaperedCrescent(radius * 1.06, 118, '#0284c7', '#38bdf8', '#7dd3fc', 0.65);
      // Layer 2: Golden-Amber Flame Ribbon
      drawTaperedCrescent(radius * 0.99, 76, '#ea580c', '#f59e0b', '#fde047', 0.92);
      // Layer 3: White-Hot Razor Leading Core
      drawTaperedCrescent(radius * 0.95, 28, '#fef08a', '#ffffff', '#e0f2fe', 1.0);
    } else {
      // Bandit Crimson-Steel Cleave
      drawTaperedCrescent(radius * 1.04, 98, '#991b1b', '#ef4444', '#fb923c', 0.68);
      drawTaperedCrescent(radius * 0.98, 58, '#dc2626', '#f97316', '#fde047', 0.88);
      drawTaperedCrescent(radius * 0.94, 22, '#fecaca', '#ffffff', '#fef08a', 0.98);
    }

    // Impact Anamorphic Starburst at the Clash Point
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

    // Cross-flare spikes
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
    // Dust clouds
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

    // Velocity-stretched glowing metallic sparks
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

  private drawDamagePopups(ctx: CanvasRenderingContext2D): void {
    for (const p of this.popups) {
      const progress = p.ageMs / p.durationMs;
      const alpha = progress < 0.75 ? 1 : Math.max(0, 1 - (progress - 0.75) / 0.25);
      const popScale = progress < 0.12 ? 0.6 + (progress / 0.12) * 0.65 : Math.max(1.0, 1.25 - (progress - 0.12) * 0.8);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.scale(popScale, popScale);

      if (p.subText) {
        ctx.font = 'italic 900 22px "Cinzel", "Noto Serif TC", serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 6;
        ctx.strokeText(p.subText, 0, -48);
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(p.subText, 0, -48);
      }

      ctx.font = p.isCrit
        ? 'italic 900 56px "Cinzel", "Noto Serif TC", serif'
        : 'bold 44px "Cinzel", "Noto Serif TC", serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 9;
      ctx.strokeText(p.text, 0, 0);

      const grad = ctx.createLinearGradient(0, -45, 0, 10);
      if (p.isCrit) {
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.45, '#fde047');
        grad.addColorStop(1, '#ea580c');
      } else {
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(1, '#f87171');
      }
      ctx.fillStyle = grad;
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
  }

  /**
   * Renders an authentic modern tactical RPG Critical Eye Cut-In Banner across the stage.
   */
  private drawAnimeCutInBanner(ctx: CanvasRenderingContext2D, W: number, H: number, progress: number): void {
    const open = progress < 0.18 ? progress / 0.18 : progress > 0.82 ? (1 - progress) / 0.18 : 1;
    if (open <= 0.01) return;

    const bannerH = 175 * open;
    const cy = H * 0.34;

    ctx.save();
    ctx.translate(W * 0.5, cy);
    ctx.rotate(-0.06);

    // Dark backing & speed lines
    ctx.beginPath();
    ctx.rect(-W * 0.65, -bannerH * 0.5, W * 1.3, bannerH);
    ctx.clip();

    const bgGrad = ctx.createLinearGradient(-W * 0.5, 0, W * 0.5, 0);
    bgGrad.addColorStop(0, 'rgba(8, 15, 32, 0.94)');
    bgGrad.addColorStop(0.5, 'rgba(15, 38, 72, 0.96)');
    bgGrad.addColorStop(1, 'rgba(120, 28, 18, 0.94)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(-W * 0.65, -bannerH * 0.5, W * 1.3, bannerH);

    // Horizontal anime speed lines
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

    // Draw close-up crop of Thor's eyes/face from clashKeyArt or thorPose0
    const faceImg = this.vfxAssets.clashKeyArt;
    if (faceImg && faceImg.complete && faceImg.naturalWidth > 0) {
      const slideX = (0.5 - progress) * 70;
      // In clash_keyart.jpg (1376x768), Thor's face is around (x=820..1080, y=170..340)
      ctx.drawImage(faceImg, 800, 175, 330, 165, -40 + slideX, -bannerH * 0.52, 460, bannerH * 1.06);
    }

    // Banner text
    const isEn = getLocale() === 'en';
    ctx.font = 'italic 900 42px "Cinzel", "Noto Serif TC", serif';
    ctx.fillStyle = '#fde047';
    ctx.shadowColor = '#0284c7';
    ctx.shadowBlur = 16;
    ctx.fillText(isEn ? 'THOR — FLAME SLASH!' : '索爾 — 烈焰斬！', -W * 0.42, 14);

    // Glowing gold top/bottom border rails
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

  private drawModernDualHud(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const isEn = getLocale() === 'en';
    const padX = 42;
    const topY = H - 104;
    const cardW = 430;
    const cardH = 74;

    const drawHudCard = (
      x: number,
      y: number,
      name: string,
      lv: number,
      hp: number,
      maxHp: number,
      accentColor: string,
      alignRight: boolean
    ) => {
      ctx.save();
      ctx.fillStyle = 'rgba(10, 14, 24, 0.82)';
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 20px "Cinzel", "Noto Serif TC", sans-serif';
      ctx.textAlign = alignRight ? 'right' : 'left';
      const textX = alignRight ? x + cardW - 20 : x + 20;
      ctx.fillText(`${name}   Lv.${lv}`, textX, y + 28);

      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 17px monospace';
      ctx.textAlign = alignRight ? 'left' : 'right';
      const hpTextX = alignRight ? x + 20 : x + cardW - 20;
      ctx.fillText(`HP ${hp}/${maxHp}`, hpTextX, y + 28);

      // Smooth HP Bar
      const barX = x + 20;
      const barY = y + 43;
      const barW = cardW - 40;
      const barH = 14;
      ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
      ctx.fillRect(barX, barY, barW, barH);

      const ratio = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
      const fillW = barW * ratio;
      const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      if (alignRight) {
        barGrad.addColorStop(0, '#0284c7');
        barGrad.addColorStop(1, '#38bdf8');
      } else {
        barGrad.addColorStop(0, '#dc2626');
        barGrad.addColorStop(1, '#f97316');
      }
      ctx.fillStyle = barGrad;
      ctx.fillRect(alignRight ? barX + (barW - fillW) : barX, barY, fillW, barH);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);
      ctx.restore();
    };

    // Left: Enemy Bandit (#96)
    drawHudCard(
      padX,
      topY,
      isEn ? 'Bandit (#96)' : '盜賊 (#96)',
      1,
      this.banditHp,
      this.banditMaxHp,
      '#ef4444',
      false
    );

    // Right: Hero Thor (#0)
    drawHudCard(
      W - padX - cardW,
      topY,
      isEn ? 'Thor (#0)' : '索爾 (#0)',
      1,
      this.thorHp,
      this.thorMaxHp,
      '#38bdf8',
      true
    );
  }
}

/**
 * Checks whether a live in-game CombatOutcome is a duel between Thor (#0) and Bandit (#96).
 */
export function isThorVsBanditCombat(outcome: CombatOutcome): boolean {
  const a = outcome.attacker.uid;
  const d = outcome.defender.uid;
  return (a === 0 && d === 96) || (a === 96 && d === 0);
}

/**
 * Plays the Modern 2.5D Anime VFX Cutscene directly on the in-game battle canvas when Thor (#0) fights Bandit (#96) in HD Mode.
 */
export async function playInGameModern25DThorBandit(
  outcome: CombatOutcome,
  assets: AssetManager,
  sound: SoundEngine,
  backdropEl: HTMLElement,
  canvas: HTMLCanvasElement,
  skipBtn: HTMLButtonElement,
  speedMult = 1
): Promise<void> {
  const vfxAssets = await ensureVfxLabAssets(assets);
  const renderer = new Modern25DCombatRenderer(vfxAssets, sound);

  const thorIsAttacker = outcome.attacker.uid === 0;
  const thorUnit = thorIsAttacker ? outcome.attacker : outcome.defender;
  const banditUnit = thorIsAttacker ? outcome.defender : outcome.attacker;
  const thorStartHp = thorIsAttacker ? outcome.attackerStartHp : outcome.defenderStartHp;
  const banditStartHp = thorIsAttacker ? outcome.defenderStartHp : outcome.attackerStartHp;

  let thorDmg = 0;
  let banditDmg = 0;
  let hasCounter = false;
  for (const s of outcome.strikes) {
    const strikeByThor = (s.fromAttacker && thorIsAttacker) || (!s.fromAttacker && !thorIsAttacker);
    if (strikeByThor) {
      thorDmg += s.damage;
    } else {
      banditDmg += s.damage;
      hasCounter = true;
    }
  }

  const scenario: DuelScenario = !thorIsAttacker
    ? 'bandit_cleave'
    : hasCounter
      ? 'full_duel'
      : 'thor_crit';

  renderer.startScenario(scenario, {
    thorStartHp,
    thorMaxHp: thorUnit.maxHp,
    banditStartHp,
    banditMaxHp: banditUnit.maxHp,
    thorDmg: Math.max(1, thorDmg),
    banditDmg: Math.max(1, banditDmg),
  });

  backdropEl.classList.remove('hidden');
  canvas.width = 1600;
  canvas.height = 900;
  const ctx = canvas.getContext('2d')!;

  let skipped = false;
  const onSkip = () => {
    skipped = true;
  };
  skipBtn.addEventListener('click', onSkip, { once: true });

  await new Promise<void>((resolve) => {
    let lastTime = performance.now();
    const tick = (now: number) => {
      if (skipped || renderer.isFinished()) {
        resolve();
        return;
      }
      const dt = (now - lastTime) / speedMult;
      lastTime = now;
      renderer.stepAndRender(ctx, dt, false);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  skipBtn.removeEventListener('click', onSkip);
  backdropEl.classList.add('hidden');
}

/**
 * Opens the interactive "Modern 2.5D VFX Lab: Thor vs. Bandit" modal showcase.
 */
export async function openVfxLabModal(assets: AssetManager, sound: SoundEngine): Promise<void> {
  let modal = document.getElementById('vfx-lab-modal') as HTMLDivElement | null;
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    return;
  }

  const vfxAssets = await ensureVfxLabAssets(assets);
  const renderer = new Modern25DCombatRenderer(vfxAssets, sound);

  modal = document.createElement('div');
  modal.id = 'vfx-lab-modal';
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(6, 9, 16, 0.92);
    backdrop-filter: blur(8px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 16px;
    color: #f8fafc;
    font-family: system-ui, -apple-system, sans-serif;
  `;

  modal.innerHTML = `
    <div style="width: min(1420px, 96vw); background: #0f172a; border: 1px solid #334155; border-radius: 14px; box-shadow: 0 24px 60px rgba(0,0,0,0.75); overflow: hidden; display: flex; flex-direction: column; max-height: 95vh;">
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; background: linear-gradient(90deg, #0f172a, #1e293b); border-bottom: 1px solid #334155;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 20px; font-weight: 800; color: #38bdf8;">⚡ Modern 2.5D VFX Lab — Chapter 1: Thor (#0 索爾) vs. Bandit (#96 盜賊)</span>
          <span style="font-size: 12px; padding: 3px 9px; border-radius: 999px; background: rgba(56, 189, 248, 0.15); color: #7dd3fc; border: 1px solid rgba(56, 189, 248, 0.35);">2026 Modern Tech Experiment</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button id="vfx-tab-stage" style="padding: 6px 14px; border-radius: 6px; border: 1px solid #38bdf8; background: #0284c7; color: #fff; font-weight: 600; cursor: pointer;">🎬 Live 2.5D Combat Stage</button>
          <button id="vfx-tab-split" style="padding: 6px 14px; border-radius: 6px; border: 1px solid #475569; background: #1e293b; color: #cbd5e1; font-weight: 600; cursor: pointer;">🔀 1995 DOS vs 2026 Split-Screen</button>
          <button id="vfx-tab-art" style="padding: 6px 14px; border-radius: 6px; border: 1px solid #475569; background: #1e293b; color: #cbd5e1; font-weight: 600; cursor: pointer;">🎨 Keyframe Sheets & Key Art</button>
          <button id="vfx-close-btn" style="margin-left: 10px; padding: 6px 12px; border-radius: 6px; border: 1px solid #ef4444; background: rgba(239, 68, 68, 0.18); color: #fca5a5; font-weight: 700; cursor: pointer;">✕ Close</button>
        </div>
      </div>

      <div id="vfx-stage-container" style="position: relative; width: 100%; aspect-ratio: 16 / 9; max-height: 70vh; background: #05080f; display: flex; align-items: center; justify-content: center; overflow: hidden;">
        <canvas id="vfx-lab-canvas" width="1600" height="900" style="width: 100%; height: 100%; object-fit: contain;"></canvas>
      </div>

      <div id="vfx-art-container" style="display: none; padding: 20px; overflow-y: auto; max-height: 72vh; background: #090d16;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(410px, 1fr)); gap: 18px;">
          <div style="background: #1e293b; padding: 14px; border-radius: 10px; border: 1px solid #334155;">
            <h4 style="margin: 0 0 8px 0; color: #fde047;">1. Widescreen 16:9 Chapter 1 Clash Key Art</h4>
            <img src="assets/vfx_lab/clash_keyart.jpg" style="width: 100%; border-radius: 8px; border: 1px solid #475569;" />
          </div>
          <div style="background: #1e293b; padding: 14px; border-radius: 10px; border: 1px solid #334155;">
            <h4 style="margin: 0 0 8px 0; color: #38bdf8;">2. Thor (#0 索爾) 3-Pose Modern Anime Keyframe Sheet</h4>
            <img src="assets/vfx_lab/thor_sheet_raw.png" style="width: 100%; border-radius: 8px; background: #fff;" />
          </div>
          <div style="background: #1e293b; padding: 14px; border-radius: 10px; border: 1px solid #334155;">
            <h4 style="margin: 0 0 8px 0; color: #f87171;">3. Bandit (#96 盜賊) 3-Pose Modern Anime Keyframe Sheet</h4>
            <img src="assets/vfx_lab/bandit_sheet_raw.png" style="width: 100%; border-radius: 8px; background: #fff;" />
          </div>
        </div>
      </div>

      <div id="vfx-controls-bar" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 20px; background: #0f172a; border-top: 1px solid #334155;">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <button id="vfx-play-duel" style="padding: 7px 14px; border-radius: 6px; border: 1px solid #fbbf24; background: linear-gradient(180deg, #f59e0b, #d97706); color: #090d16; font-weight: 800; cursor: pointer;">⚔️ Play Full Duel (Thor + Bandit Counter)</button>
          <button id="vfx-play-crit" style="padding: 7px 14px; border-radius: 6px; border: 1px solid #38bdf8; background: rgba(2, 132, 199, 0.35); color: #e0f2fe; font-weight: 700; cursor: pointer;">🔥 Thor Critical Flame Slash</button>
          <button id="vfx-play-bandit" style="padding: 7px 14px; border-radius: 6px; border: 1px solid #f87171; background: rgba(185, 28, 28, 0.3); color: #fecaca; font-weight: 700; cursor: pointer;">🪓 Bandit Heavy Cleave</button>
          <label style="display: inline-flex; align-items: center; gap: 6px; margin-left: 8px; font-size: 13px; color: #fde047; cursor: pointer;">
            <input type="checkbox" id="vfx-chk-slowmo" /> 🐢 0.32x Slow-Mo Inspection
          </label>
        </div>

        <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap; font-size: 12.5px; color: #cbd5e1;">
          <label style="display: inline-flex; align-items: center; gap: 5px; cursor: pointer;">
            <input type="checkbox" id="vfx-chk-parallax" checked /> Sunbeams & Parallax
          </label>
          <label style="display: inline-flex; align-items: center; gap: 5px; cursor: pointer;">
            <input type="checkbox" id="vfx-chk-cutin" checked /> Anime Eye Cut-In
          </label>
          <label style="display: inline-flex; align-items: center; gap: 5px; cursor: pointer;">
            <input type="checkbox" id="vfx-chk-slash" checked /> Volumetric Crescent Shader
          </label>
          <label style="display: inline-flex; align-items: center; gap: 5px; cursor: pointer;">
            <input type="checkbox" id="vfx-chk-sparks" checked /> 90ms Hit-Stop & Physics Sparks
          </label>
          <label style="display: inline-flex; align-items: center; gap: 5px; cursor: pointer;">
            <input type="checkbox" id="vfx-chk-spring" checked /> Dash Afterimages
          </label>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const canvas = modal.querySelector('#vfx-lab-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const stageContainer = modal.querySelector('#vfx-stage-container') as HTMLDivElement;
  const artContainer = modal.querySelector('#vfx-art-container') as HTMLDivElement;
  const tabStage = modal.querySelector('#vfx-tab-stage') as HTMLButtonElement;
  const tabSplit = modal.querySelector('#vfx-tab-split') as HTMLButtonElement;
  const tabArt = modal.querySelector('#vfx-tab-art') as HTMLButtonElement;

  let splitCompare = false;
  let activeScenario: DuelScenario = 'full_duel';
  renderer.startScenario(activeScenario);

  const updateTabStyles = (mode: 'stage' | 'split' | 'art') => {
    const activeCss = 'background: #0284c7; color: #fff; border-color: #38bdf8;';
    const idleCss = 'background: #1e293b; color: #cbd5e1; border-color: #475569;';
    tabStage.style.cssText += mode === 'stage' ? activeCss : idleCss;
    tabSplit.style.cssText += mode === 'split' ? activeCss : idleCss;
    tabArt.style.cssText += mode === 'art' ? activeCss : idleCss;
    stageContainer.style.display = mode === 'art' ? 'none' : 'flex';
    artContainer.style.display = mode === 'art' ? 'block' : 'none';
    splitCompare = mode === 'split';
  };

  tabStage.addEventListener('click', () => updateTabStyles('stage'));
  tabSplit.addEventListener('click', () => updateTabStyles('split'));
  tabArt.addEventListener('click', () => updateTabStyles('art'));

  modal.querySelector('#vfx-play-duel')!.addEventListener('click', () => {
    activeScenario = 'full_duel';
    renderer.startScenario(activeScenario);
  });
  modal.querySelector('#vfx-play-crit')!.addEventListener('click', () => {
    activeScenario = 'thor_crit';
    renderer.startScenario(activeScenario);
  });
  modal.querySelector('#vfx-play-bandit')!.addEventListener('click', () => {
    activeScenario = 'bandit_cleave';
    renderer.startScenario(activeScenario);
  });

  const bindToggle = (selector: string, key: keyof ModernVfxConfig) => {
    const el = modal!.querySelector(selector) as HTMLInputElement;
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

  modal.querySelector('#vfx-close-btn')!.addEventListener('click', () => {
    modal!.classList.add('hidden');
    modal!.style.display = 'none';
  });

  let lastTime = performance.now();
  const loop = (now: number) => {
    const dt = now - lastTime;
    lastTime = now;
    if (modal && modal.style.display !== 'none' && !modal.classList.contains('hidden')) {
      if (renderer.isFinished()) {
        // Auto-loop after a brief pause in the lab
        renderer.startScenario(activeScenario);
      }
      renderer.stepAndRender(ctx, dt, splitCompare);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
