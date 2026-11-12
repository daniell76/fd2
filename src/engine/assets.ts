import { CHAR_TO_GID_EN, GLYPH_WIDTHS } from '../glyphTable';
import { applyLocaleToGameState, resolveLocaleGlyphs } from '../i18n';
import type {
  ChapterData,
  ChoreographyScript,
  FigAniStrip,
  GameData,
  MusicTrack,
  PostFormationDef,
  SfxBanksPayload,
} from '../types';

export type GlyphColor = 'ivory' | 'gold' | 'crimson' | 'azure' | 'emerald' | 'shadow' | 'hud_fg' | 'hud_shadow';
export type EditionMode = 'classic' | 'hd';

const EDITION_STORAGE_KEY = 'fd2_edition_mode';

function detectInitialEditionMode(): EditionMode {
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('edition')?.toLowerCase();
    if (q === 'hd' || q === 'remaster') return 'hd';
    if (q === 'classic' || q === 'dos') return 'classic';
    const saved = localStorage.getItem(EDITION_STORAGE_KEY);
    if (saved === 'hd' || saved === 'classic') return saved;
  } catch {
    // ignore storage errors
  }
  return 'classic';
}

/**
 * High-speed Edge-Directed Pixel-Art 2x Upscaling Pass (`EPX / Scale2x + xBR Knight-Slope Contour Blending`).
 * Preserves crisp dark silhouettes and alpha boundaries while smoothing jagged 45° and 2:1 pixel stair-stepping.
 */
function upscaleImageData2x(src: ImageData): ImageData {
  const sw = src.width;
  const sh = src.height;
  const dw = sw * 2;
  const dh = sh * 2;
  const dst = new ImageData(dw, dh);
  const s32 = new Uint32Array(src.data.buffer);
  const d32 = new Uint32Array(dst.data.buffer);

  const getPx = (x: number, y: number): number => {
    const cx = x < 0 ? 0 : x >= sw ? sw - 1 : x;
    const cy = y < 0 ? 0 : y >= sh ? sh - 1 : y;
    return s32[cy * sw + cx];
  };

  const similar = (c1: number, c2: number): boolean => {
    if (c1 === c2) return true;
    const a1 = (c1 >>> 24) & 0xff;
    const a2 = (c2 >>> 24) & 0xff;
    if (a1 < 32 && a2 < 32) return true;
    if ((a1 < 32) !== (a2 < 32)) return false;
    const r1 = c1 & 0xff;
    const g1 = (c1 >>> 8) & 0xff;
    const b1 = (c1 >>> 16) & 0xff;
    const r2 = c2 & 0xff;
    const g2 = (c2 >>> 8) & 0xff;
    const b2 = (c2 >>> 16) & 0xff;
    const dr = r1 > r2 ? r1 - r2 : r2 - r1;
    const dg = g1 > g2 ? g1 - g2 : g2 - g1;
    const db = b1 > b2 ? b1 - b2 : b2 - b1;
    return dr * 3 + dg * 4 + db * 2 < 155;
  };

  const blend3 = (cA: number, cB: number, cBase: number, wAB: number): number => {
    const aA = (cA >>> 24) & 0xff;
    const aB = (cB >>> 24) & 0xff;
    if (aA < 32 || aB < 32) return cBase;
    const rAB = ((cA & 0xff) + (cB & 0xff)) >> 1;
    const gAB = (((cA >>> 8) & 0xff) + ((cB >>> 8) & 0xff)) >> 1;
    const bAB = (((cA >>> 16) & 0xff) + ((cB >>> 16) & 0xff)) >> 1;
    const aBase = (cBase >>> 24) & 0xff;
    if (aBase < 32) {
      return (235 << 24) | (bAB << 16) | (gAB << 8) | rAB;
    }
    const r0 = cBase & 0xff;
    const g0 = (cBase >>> 8) & 0xff;
    const b0 = (cBase >>> 16) & 0xff;
    const r = Math.round(rAB * wAB + r0 * (1 - wAB));
    const g = Math.round(gAB * wAB + g0 * (1 - wAB));
    const b = Math.round(bAB * wAB + b0 * (1 - wAB));
    return (aBase << 24) | (b << 16) | (g << 8) | r;
  };

  for (let y = 0; y < sh; y++) {
    const rowOut0 = (y * 2) * dw;
    const rowOut1 = rowOut0 + dw;
    for (let x = 0; x < sw; x++) {
      const P = getPx(x, y);
      const N = getPx(x, y - 1);
      const S = getPx(x, y + 1);
      const W = getPx(x - 1, y);
      const E = getPx(x + 1, y);
      const NW = getPx(x - 1, y - 1);
      const NE = getPx(x + 1, y - 1);
      const SW = getPx(x - 1, y + 1);
      const SE = getPx(x + 1, y + 1);

      let e0 = P;
      let e1 = P;
      let e2 = P;
      let e3 = P;

      if (!similar(N, S) && !similar(W, E)) {
        if (similar(W, N) && (!similar(P, NW) || !similar(W, S) || !similar(N, E))) {
          e0 = blend3(W, N, P, 0.82);
          if (similar(N, NE) && !similar(P, NE)) e1 = blend3(W, N, P, 0.36);
          if (similar(W, SW) && !similar(P, SW)) e2 = blend3(W, N, P, 0.36);
        }
        if (similar(N, E) && (!similar(P, NE) || !similar(N, W) || !similar(E, S))) {
          e1 = blend3(N, E, P, 0.82);
          if (similar(N, NW) && !similar(P, NW) && e0 === P) e0 = blend3(N, E, P, 0.36);
          if (similar(E, SE) && !similar(P, SE)) e3 = blend3(N, E, P, 0.36);
        }
        if (similar(W, S) && (!similar(P, SW) || !similar(W, N) || !similar(S, E))) {
          e2 = blend3(W, S, P, 0.82);
          if (similar(W, NW) && !similar(P, NW) && e0 === P) e0 = blend3(W, S, P, 0.36);
          if (similar(S, SE) && !similar(P, SE) && e3 === P) e3 = blend3(W, S, P, 0.36);
        }
        if (similar(S, E) && (!similar(P, SE) || !similar(S, W) || !similar(E, N))) {
          e3 = blend3(S, E, P, 0.82);
          if (similar(E, NE) && !similar(P, NE) && e1 === P) e1 = blend3(S, E, P, 0.36);
          if (similar(S, SW) && !similar(P, SW) && e2 === P) e2 = blend3(S, E, P, 0.36);
        }
      }

      const ox = x * 2;
      d32[rowOut0 + ox] = e0;
      d32[rowOut0 + ox + 1] = e1;
      d32[rowOut1 + ox] = e2;
      d32[rowOut1 + ox + 1] = e3;
    }
  }
  return dst;
}

const GLYPH_HEX: Record<GlyphColor, string> = {
  ivory: '#f5efe2',
  gold: '#f0c869',
  crimson: '#f2746b',
  azure: '#70bef7',
  emerald: '#68dfa0',
  shadow: '#07090e',
  hud_fg: '#6989ca',
  hud_shadow: '#102465',
};

// Front / 3-Quarter Camera-Facing Units whose 1995 DOS FIGANI head region had a blank faceless skin oval
const FRONT_FACE_UNIT_IDS = new Set<number>([
  76, 80, 87, 96, 97, 100, 101, 102, 103, 106, 108, 109,
  117, 118, 119, 120, 122, 123, 124, 125, 126,
]);

// Side-Profile Camera-Visible Heroes facing top-left whose cheek/profile is visible
const SIDE_PROFILE_UNIT_IDS = new Set<number>([
  8, 9, 10, 11, 12, 14, 18, 20, 23, 35,
  40, 41, 42, 43, 44, 46, 53,
  58, 59, 60, 61, 62, 64, 133,
]);

// Battle Stage Background IDs repainted in 4K HD by Nano Banana 2 (models/gempix2-flash)
const HD_REPAINTED_BG_IDS = new Set<number>([
  4, 5, 6, 9, 10, 14, 16, 18, 19, 21, 25, 28, 29, 31, 33, 38, 40, 42, 44, 45, 48, 49, 50, 51, 52, 53, 55,
]);

function isSkinTonePixel(r: number, g: number, b: number, a: number): boolean {
  if (a < 200) return false;
  return r > 145 && g > 78 && b < 142 && r - g > 16 && g - b >= 10;
}

/**
 * Replaces the 1995 DOS 1-pixel checkerboard ground shadow mesh (`(x+y)%2` alternating black & transparent pixels)
 * at the base of `FIGANI` combat sprites with a smooth, soft alpha-gradient contact shadow before `4x` upscaling.
 */
function deDitherShadowInPlace(src: ImageData): void {
  const w = src.width;
  const h = src.height;
  const d = src.data;
  const startY = Math.floor(h * 0.52);
  const shadowMask = new Uint8Array(w * h);

  const isTrans = (x: number, y: number): boolean => {
    if (x < 0 || x >= w || y < 0 || y >= h) return true;
    return d[(y * w + x) * 4 + 3] < 32;
  };

  for (let y = startY; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = d[idx];
      const g = d[idx + 1];
      const b = d[idx + 2];
      const a = d[idx + 3];
      if (a > 128 && r < 28 && g < 28 && b < 36) {
        let transOrth = 0;
        if (isTrans(x - 1, y)) transOrth++;
        if (isTrans(x + 1, y)) transOrth++;
        if (isTrans(x, y - 1)) transOrth++;
        if (isTrans(x, y + 1)) transOrth++;
        if (transOrth >= 3) {
          shadowMask[y * w + x] = 1;
        }
      }
    }
  }

  for (let y = startY; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isTrans(x, y)) {
        let shOrth = 0;
        if (x > 0 && shadowMask[y * w + (x - 1)] === 1) shOrth++;
        if (x + 1 < w && shadowMask[y * w + (x + 1)] === 1) shOrth++;
        if (y > startY && shadowMask[(y - 1) * w + x] === 1) shOrth++;
        if (y + 1 < h && shadowMask[(y + 1) * w + x] === 1) shOrth++;
        if (shOrth >= 2) {
          shadowMask[y * w + x] = 2;
        }
      }
    }
  }

  for (let y = startY; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const m = shadowMask[y * w + x];
      if (m > 0) {
        let neigh = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < w && ny >= startY && ny < h && shadowMask[ny * w + nx] > 0) {
              neigh++;
            }
          }
        }
        const idx = (y * w + x) * 4;
        d[idx] = 8;
        d[idx + 1] = 10;
        d[idx + 2] = 18;
        d[idx + 3] = Math.min(118, 42 + neigh * 9);
      }
    }
  }
}

/**
 * Multi-pass HD Cel-Shading & Directional Specular Rim-Light Polish on `4x` upscaled sprite frames.
 * Smooths stepped 16-color palette bands inside interior material surfaces while sharpening dark ink outlines.
 */
function polishHdSpriteCelShading4x(img4x: ImageData): void {
  const w = img4x.width;
  const h = img4x.height;
  const src = new Uint8ClampedArray(img4x.data);
  const dst = img4x.data;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      const a = src[i + 3];
      if (a < 140) continue;
      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];
      const luma = (r * 77 + g * 150 + b * 29) >> 8;

      // Keep dark ink contour lines crisp and slightly deepened
      if (luma < 42) {
        dst[i] = (r * 215) >> 8;
        dst[i + 1] = (g * 215) >> 8;
        dst[i + 2] = (b * 225) >> 8;
        continue;
      }

      // Edge-preserving bilateral smooth across 4-neighborhood + top-left directional specular micro-gradient
      let sr = r * 4;
      let sg = g * 4;
      let sb = b * 4;
      let sw = 4;
      const nOffsets = [-w * 4, w * 4, -4, 4];
      for (let k = 0; k < 4; k++) {
        const ni = i + nOffsets[k];
        if (src[ni + 3] > 140) {
          const nr = src[ni];
          const ng = src[ni + 1];
          const nb = src[ni + 2];
          const diff = Math.abs(r - nr) + Math.abs(g - ng) + Math.abs(b - nb);
          if (diff < 88) {
            sr += nr;
            sg += ng;
            sb += nb;
            sw++;
          }
        }
      }

      let outR = Math.round(sr / sw);
      let outG = Math.round(sg / sw);
      let outB = Math.round(sb / sw);

      // Subtle top-left rim highlight where top-left neighbor is dark outline or brighter ridge
      const nwIdx = i - w * 4 - 4;
      const seIdx = i + w * 4 + 4;
      const nwLuma = src[nwIdx + 3] > 120 ? (src[nwIdx] * 77 + src[nwIdx + 1] * 150 + src[nwIdx + 2] * 29) >> 8 : luma;
      const seLuma = src[seIdx + 3] > 120 ? (src[seIdx] * 77 + src[seIdx + 1] * 150 + src[seIdx + 2] * 29) >> 8 : luma;
      const slope = (nwLuma - seLuma) * 0.14;
      outR = Math.max(0, Math.min(255, Math.round(outR + slope)));
      outG = Math.max(0, Math.min(255, Math.round(outG + slope)));
      outB = Math.max(0, Math.min(255, Math.round(outB + slope)));

      dst[i] = outR;
      dst[i + 1] = outG;
      dst[i + 2] = outB;
    }
  }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

export class AssetManager {
  public gameData!: GameData;
  public musicTracks: MusicTrack[] = [];
  public sfxBanks: SfxBanksPayload | null = null;
  public choreography: ChoreographyScript[] = [];
  public postFormations: Record<string, PostFormationDef> = {};

  public fontAtlas!: HTMLImageElement;
  public unitsAtlas!: HTMLImageElement;
  public portraitsAtlas!: HTMLImageElement;
  public bgsAtlas!: HTMLImageElement;
  public taisAtlas!: HTMLImageElement;
  public uiIcons!: HTMLImageElement;
  public itemIcons!: HTMLImageElement;
  public battleHudAtlas!: HTMLImageElement;
  public crossIconsAtlas!: HTMLImageElement;
  public tacticalUiAtlas!: HTMLImageElement;
  public fxAtlas!: HTMLImageElement;

  public screens: Record<string, HTMLImageElement> = {};
  public hdScreens: Record<string, HTMLImageElement> = {};

  private tintedFonts = new Map<GlyphColor, HTMLCanvasElement>();
  private glyphUrlCache = new Map<string, string>();
  private portraitUrlCache = new Map<string, string>();
  private spriteUrlCache = new Map<string, string>();
  private chibiUrlCache = new Map<string, string>();
  private chapterCache = new Map<number, { data: ChapterData; tileset: HTMLImageElement }>();
  private figaniStripCache = new Map<string, HTMLImageElement | null>();
  private hdRegionCache = new Map<string, HTMLCanvasElement>();
  private hdBgImages = new Map<number, HTMLImageElement | 'loading' | 'none'>();
  private portraitFaceCropCache = new Map<number, HTMLCanvasElement>();
  private editionMode: EditionMode = detectInitialEditionMode();

  constructor() {
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('edition-hd', this.editionMode === 'hd');
    }
  }

  getEditionMode(): EditionMode {
    return this.editionMode;
  }

  isHdMode(): boolean {
    return this.editionMode === 'hd';
  }

  setEditionMode(mode: EditionMode): void {
    if (this.editionMode === mode) return;
    this.editionMode = mode;
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('edition-hd', this.editionMode === 'hd');
    }
    try {
      localStorage.setItem(EDITION_STORAGE_KEY, mode);
    } catch {
      // ignore
    }
    this.portraitUrlCache.clear();
    this.spriteUrlCache.clear();
    this.chibiUrlCache.clear();
    this.glyphUrlCache.clear();
  }

  getScreenUrl(name: 'title_0' | 'shop' | 'camp' | 'town' | 'church' | 'world' | 'ending' | 'gameover'): string {
    return this.editionMode === 'hd' ? `assets/hd_screens/${name}.png` : `assets/screens/${name}.png`;
  }

  getScreenImage(key: 'title' | 'shop' | 'camp' | 'town' | 'church' | 'world' | 'ending' | 'gameover'): HTMLImageElement {
    if (this.editionMode === 'hd' && this.hdScreens[key]) {
      return this.hdScreens[key];
    }
    return this.screens[key];
  }

  /**
   * Extracts and caches the face bounding-box region from a unit's `80x80` portrait (`portraits_atlas.png`)
   * so it can guide high-resolution facial detail synthesis onto `4x` HD `FIGANI` battle animation frames.
   */
  private getPortraitFaceCanvas(unitId: number): HTMLCanvasElement {
    const pid = Math.max(0, Math.min((this.gameData?.portraitCount ?? 136) - 1, unitId));
    const cached = this.portraitFaceCropCache.get(pid);
    if (cached) return cached;

    const sx = (pid % 4) * 320;
    const sy = Math.floor(pid / 4) * 80;
    const c = document.createElement('canvas');
    c.width = 80;
    c.height = 80;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(this.portraitsAtlas, sx, sy, 80, 80, 0, 0, 80, 80);
    const idata = ctx.getImageData(0, 0, 80, 80);
    const d = idata.data;

    let minX = 70;
    let maxX = 10;
    let minY = 70;
    let maxY = 10;
    let count = 0;
    for (let y = 12; y < 70; y++) {
      for (let x = 12; x < 68; x++) {
        const i = (y * 80 + x) * 4;
        if (isSkinTonePixel(d[i], d[i + 1], d[i + 2], d[i + 3])) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          count++;
        }
      }
    }

    const x0 = count >= 40 ? Math.max(8, minX) : 20;
    const y0 = count >= 40 ? Math.max(8, minY) : 20;
    const x1 = count >= 40 ? Math.min(72, maxX) : 60;
    const y1 = count >= 40 ? Math.min(72, maxY) : 64;
    const cw = Math.max(12, x1 - x0 + 1);
    const ch = Math.max(12, y1 - y0 + 1);

    const faceC = document.createElement('canvas');
    faceC.width = cw;
    faceC.height = ch;
    const faceCtx = faceC.getContext('2d')!;
    faceCtx.drawImage(c, x0, y0, cw, ch, 0, 0, cw, ch);
    this.portraitFaceCropCache.set(pid, faceC);
    return faceC;
  }

  /**
   * Synthesizes fine facial features (eyes, iris/sclera catchlights, eyebrows, nose shadow, mouth,
   * and portrait facial shading) onto blank faceless head regions of `4x` HD `FIGANI` battle sprites.
   */
  private synthesizePortraitFaceOnFigAni4x(
    src1x: ImageData,
    ctx4: CanvasRenderingContext2D,
    unitId: number
  ): void {
    const isFront = FRONT_FACE_UNIT_IDS.has(unitId);
    const isSide = SIDE_PROFILE_UNIT_IDS.has(unitId);
    if (!isFront && !isSide) return;

    const w = src1x.width;
    const h = src1x.height;
    const d1 = src1x.data;
    const maxY = Math.min(h, Math.floor(h * 0.42));
    const visited = new Uint8Array(w * maxY);

    let bestMinY = 9999;
    let bestX0 = 0;
    let bestY0 = 0;
    let bestX1 = 0;
    let bestY1 = 0;
    let found = false;

    for (let y = 0; y < maxY; y++) {
      for (let x = 0; x < w; x++) {
        if (visited[y * w + x]) continue;
        const idx = (y * w + x) * 4;
        if (!isSkinTonePixel(d1[idx], d1[idx + 1], d1[idx + 2], d1[idx + 3])) continue;

        const qx: number[] = [x];
        const qy: number[] = [y];
        visited[y * w + x] = 1;
        let minX = x;
        let maxX = x;
        let minY = y;
        let maxYComp = y;
        let count = 0;

        while (qx.length > 0) {
          const cx = qx.pop()!;
          const cy = qy.pop()!;
          count++;
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxYComp) maxYComp = cy;

          for (let ny = cy - 1; ny <= cy + 1; ny++) {
            for (let nx = cx - 1; nx <= cx + 1; nx++) {
              if (nx >= 0 && nx < w && ny >= 0 && ny < maxY && !visited[ny * w + nx]) {
                const ni = (ny * w + nx) * 4;
                if (isSkinTonePixel(d1[ni], d1[ni + 1], d1[ni + 2], d1[ni + 3])) {
                  visited[ny * w + nx] = 1;
                  qx.push(nx);
                  qy.push(ny);
                }
              }
            }
          }
        }

        // For bare-chested monk/colossus (#100, #122), clamp vertical extent to top head oval (10px)
        if ((unitId === 100 || unitId === 122) && maxYComp - minY > 10) {
          maxYComp = minY + 9;
        }

        const bw = maxX - minX + 1;
        const bh = maxYComp - minY + 1;
        const minPts = isSide ? 7 : 10;
        if (count >= minPts && bw >= 3 && bw <= 18 && bh >= 4 && bh <= 18) {
          if (minY < bestMinY) {
            bestMinY = minY;
            bestX0 = minX;
            bestY0 = minY;
            bestX1 = maxX;
            bestY1 = maxYComp;
            found = true;
          }
        }
      }
    }

    if (!found) return;

    const fx0 = bestX0 * 4;
    const fy0 = bestY0 * 4;
    const fw = (bestX1 - bestX0 + 1) * 4;
    const fh = (bestY1 - bestY0 + 1) * 4;
    if (fw < 12 || fh < 14) return;

    // 1. Project & blend the character's 80x80 portrait face shading into the 4x HD skin region
    if (this.portraitsAtlas) {
      const pFace = this.getPortraitFaceCanvas(unitId);
      const tmp = document.createElement('canvas');
      tmp.width = fw;
      tmp.height = fh;
      const tCtx = tmp.getContext('2d')!;
      tCtx.imageSmoothingEnabled = true;
      tCtx.imageSmoothingQuality = 'high';
      tCtx.drawImage(pFace, 0, 0, pFace.width, pFace.height, 0, 0, fw, fh);

      const pData = tCtx.getImageData(0, 0, fw, fh).data;
      const patch = ctx4.getImageData(fx0, fy0, fw, fh);
      const pd = patch.data;
      for (let i = 0; i < pd.length; i += 4) {
        if (isSkinTonePixel(pd[i], pd[i + 1], pd[i + 2], pd[i + 3])) {
          pd[i] = Math.round(pData[i] * 0.56 + pd[i] * 0.44);
          pd[i + 1] = Math.round(pData[i + 1] * 0.56 + pd[i + 1] * 0.44);
          pd[i + 2] = Math.round(pData[i + 2] * 0.56 + pd[i + 2] * 0.44);
        }
      }
      ctx4.putImageData(patch, fx0, fy0);
    }

    // 2. Render crisp high-resolution anime eyes, catchlights, eyebrows, nose shadow & mouth in 4x HD space
    ctx4.save();
    const eyeY = fy0 + Math.round(fh * 0.36);
    const browY = eyeY - Math.max(2, Math.round(fh * 0.09));
    const eyeW = Math.max(3, Math.round(fw * 0.14));
    const eyeH = Math.max(2, Math.round(fh * 0.11));

    if (isFront) {
      const lx = fx0 + Math.round(fw * 0.25);
      const rx = fx0 + Math.round(fw * 0.65);

      if (unitId === 117) {
        // #117 Katana (卡特那): Signature dark eyepatch over her right eye (viewer's left) + diagonal strap
        ctx4.fillStyle = 'rgba(20, 24, 34, 0.96)';
        ctx4.fillRect(lx - 1, browY, eyeW + 3, eyeH + 3);
        ctx4.strokeStyle = 'rgba(20, 24, 34, 0.9)';
        ctx4.lineWidth = 1.5;
        ctx4.beginPath();
        ctx4.moveTo(fx0 + 1, browY);
        ctx4.lineTo(lx + eyeW + 3, eyeY + 1);
        ctx4.stroke();
      } else {
        // Viewer's left eye
        ctx4.fillStyle = 'rgba(244, 240, 234, 0.92)';
        ctx4.fillRect(lx, eyeY, eyeW, eyeH);
        ctx4.fillStyle = 'rgba(26, 20, 22, 0.96)';
        ctx4.fillRect(lx + 1, eyeY, Math.max(1, eyeW - 1), eyeH);
        ctx4.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx4.fillRect(lx + 1, eyeY, 1, 1);
        // Eyebrow
        ctx4.fillStyle = 'rgba(36, 26, 24, 0.88)';
        ctx4.fillRect(lx - 1, browY, eyeW + 2, 1);
      }

      // Viewer's right eye
      ctx4.fillStyle = 'rgba(244, 240, 234, 0.92)';
      ctx4.fillRect(rx, eyeY, eyeW, eyeH);
      ctx4.fillStyle = 'rgba(26, 20, 22, 0.96)';
      ctx4.fillRect(rx + 1, eyeY, Math.max(1, eyeW - 1), eyeH);
      ctx4.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx4.fillRect(rx + 1, eyeY, 1, 1);
      // Eyebrow
      ctx4.fillStyle = 'rgba(36, 26, 24, 0.88)';
      ctx4.fillRect(rx - 1, browY, eyeW + 2, 1);

      // Nose bridge shadow & mouth
      const nx = fx0 + Math.round(fw * 0.52);
      const ny = fy0 + Math.round(fh * 0.57);
      ctx4.fillStyle = 'rgba(130, 72, 52, 0.78)';
      ctx4.fillRect(nx, eyeY + 2, 1, Math.max(2, ny - (eyeY + 2)));
      ctx4.fillRect(nx - 1, ny, 2, 1);

      const my = fy0 + Math.round(fh * 0.75);
      const mw = Math.max(3, Math.round(fw * 0.28));
      ctx4.fillStyle = 'rgba(118, 54, 46, 0.85)';
      ctx4.fillRect(fx0 + Math.round(fw * 0.37), my, mw, 1);
    } else if (isSide) {
      // Side-profile hero facing top-left: draw profile eye near left edge of cheek
      const px = fx0 + Math.max(2, Math.round(fw * 0.22));
      ctx4.fillStyle = 'rgba(244, 240, 234, 0.9)';
      ctx4.fillRect(px, eyeY, eyeW, eyeH);
      ctx4.fillStyle = 'rgba(26, 20, 22, 0.95)';
      ctx4.fillRect(px, eyeY, Math.max(1, eyeW - 1), eyeH);
      ctx4.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx4.fillRect(px, eyeY, 1, 1);
      ctx4.fillStyle = 'rgba(36, 26, 24, 0.85)';
      ctx4.fillRect(px, browY, eyeW + 1, 1);
    }
    ctx4.restore();
  }

  /**
   * Lazily upscales any sub-rectangle `(sx, sy, sw, sh)` of `img` by `4x` (`1x -> 2x -> 4x`)
   * using our edge-directed `xBR`/`Scale4x` pixel-art contour reconstruction and caches the result.
   */
  getHdRegion4x(
    cacheKey: string,
    img: HTMLImageElement | HTMLCanvasElement,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    options?: { isFigAniSprite?: boolean; unitId?: number }
  ): HTMLCanvasElement {
    const cached = this.hdRegionCache.get(cacheKey);
    if (cached) return cached;

    const c1 = document.createElement('canvas');
    c1.width = sw;
    c1.height = sh;
    const ctx1 = c1.getContext('2d')!;
    ctx1.imageSmoothingEnabled = false;
    ctx1.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    const srcData = ctx1.getImageData(0, 0, sw, sh);
    if (options?.isFigAniSprite) {
      deDitherShadowInPlace(srcData);
    }
    const pass2x = upscaleImageData2x(srcData);
    const pass4x = upscaleImageData2x(pass2x);
    if (options?.isFigAniSprite) {
      polishHdSpriteCelShading4x(pass4x);
    }

    const c4 = document.createElement('canvas');
    c4.width = sw * 4;
    c4.height = sh * 4;
    const ctx4 = c4.getContext('2d')!;
    ctx4.putImageData(pass4x, 0, 0);

    if (options?.isFigAniSprite && options.unitId !== undefined) {
      this.synthesizePortraitFaceOnFigAni4x(srcData, ctx4, options.unitId);
    }

    this.hdRegionCache.set(cacheKey, c4);
    return c4;
  }

  /** Lazily upscales an entire image (e.g. a chapter tileset or a FIGANI combat strip) by `4x`. */
  getHdImage4x(cacheKey: string, img: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement {
    return this.getHdRegion4x(cacheKey, img, 0, 0, img.width, img.height);
  }

  async init(onProgress?: (label: string) => void): Promise<void> {
    onProgress?.('Loading Flame Dragon II archives...');
    const [
      gdRes,
      musRes,
      sfxRes,
      choreoRes,
      postFormRes,
      fontAtlas,
      unitsAtlas,
      portraitsAtlas,
      bgsAtlas,
      taisAtlas,
      uiIcons,
      itemIcons,
      battleHudAtlas,
      crossIconsAtlas,
      tacticalUiAtlas,
      fxAtlas,
      title0,
      shopBg,
      campBg,
      townBg,
      churchBg,
      worldBg,
      endingBg,
      gameoverBg,
    ] = await Promise.all([
      fetch('assets/gamedata.json').then((r) => r.json() as Promise<GameData>),
      fetch('assets/music.json').then((r) => r.json() as Promise<MusicTrack[]>),
      fetch('assets/sfx_banks.json').then((r) => (r.ok ? (r.json() as Promise<SfxBanksPayload>) : null)).catch(() => null),
      fetch('assets/choreography.json').then((r) => r.json() as Promise<ChoreographyScript[]>),
      fetch('assets/post_formations.json').then((r) => r.json() as Promise<Record<string, PostFormationDef>>),
      loadImage('assets/font_atlas.png'),
      loadImage('assets/units_atlas.png'),
      loadImage('assets/portraits_atlas.png'),
      loadImage('assets/bgs_atlas.png'),
      loadImage('assets/tais_atlas.png'),
      loadImage('assets/ui_icons.png'),
      loadImage('assets/item_icons.png'),
      loadImage('assets/battle_hud.png'),
      loadImage('assets/cross_icons.png'),
      loadImage('assets/tactical_ui.png'),
      loadImage('assets/fx_atlas.png'),
      loadImage('assets/screens/title_0.png'),
      loadImage('assets/screens/shop.png'),
      loadImage('assets/screens/camp.png'),
      loadImage('assets/screens/town.png'),
      loadImage('assets/screens/church.png'),
      loadImage('assets/screens/world.png'),
      loadImage('assets/screens/ending.png'),
      loadImage('assets/screens/gameover.png'),
    ]);

    this.gameData = gdRes;
    applyLocaleToGameState(this.gameData);
    this.musicTracks = musRes;
    this.sfxBanks = sfxRes;
    this.choreography = choreoRes;
    this.postFormations = postFormRes;
    this.fontAtlas = fontAtlas;
    this.unitsAtlas = unitsAtlas;
    this.portraitsAtlas = portraitsAtlas;
    this.bgsAtlas = bgsAtlas;
    this.taisAtlas = taisAtlas;
    this.uiIcons = uiIcons;
    this.itemIcons = itemIcons;
    this.battleHudAtlas = battleHudAtlas;
    this.crossIconsAtlas = crossIconsAtlas;
    this.tacticalUiAtlas = tacticalUiAtlas;
    this.fxAtlas = fxAtlas;
    this.screens = {
      title: title0,
      shop: shopBg,
      camp: campBg,
      town: townBg,
      church: churchBg,
      world: worldBg,
      ending: endingBg,
      gameover: gameoverBg,
    };

    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('edition-hd', this.editionMode === 'hd');
    }

    // Asynchronously warm Nano Banana 2 (gempix2-flash) 1280x800 HD repainted screens
    const hdScreenFiles: Array<[string, string]> = [
      ['title', 'assets/hd_screens/title_0.png'],
      ['shop', 'assets/hd_screens/shop.png'],
      ['camp', 'assets/hd_screens/camp.png'],
      ['town', 'assets/hd_screens/town.png'],
      ['church', 'assets/hd_screens/church.png'],
      ['world', 'assets/hd_screens/world.png'],
      ['ending', 'assets/hd_screens/ending.png'],
      ['gameover', 'assets/hd_screens/gameover.png'],
    ];
    for (const [k, url] of hdScreenFiles) {
      loadImage(url)
        .then((img) => {
          this.hdScreens[k] = img;
        })
        .catch(() => {
          // fallback to 4x upscaled classic screen
        });
    }

    onProgress?.('Preparing 16x16 calligraphy glyph sheets...');
    (Object.keys(GLYPH_HEX) as GlyphColor[]).forEach((color) => {
      const c = document.createElement('canvas');
      c.width = fontAtlas.width;
      c.height = fontAtlas.height;
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(fontAtlas, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = GLYPH_HEX[color];
      ctx.fillRect(0, 0, c.width, c.height);
      this.tintedFonts.set(color, c);
    });
  }

  async loadChapter(chapterId: number): Promise<{ data: ChapterData; tileset: HTMLImageElement }> {
    const cached = this.chapterCache.get(chapterId);
    if (cached) {
      applyLocaleToGameState(this.gameData, cached.data);
      return cached;
    }
    const pad = String(chapterId).padStart(2, '0');
    const [data, tileset] = await Promise.all([
      fetch(`assets/chapters/ch_${pad}.json`).then((r) => r.json() as Promise<ChapterData>),
      loadImage(`assets/tilesets/map_${pad}.png`),
    ]);
    applyLocaleToGameState(this.gameData, data);
    const entry = { data, tileset };
    this.chapterCache.set(chapterId, entry);
    return entry;
  }

  getUnitFigAniStripMeta(unitId: number, slot: 'idle' | 'attack' | 'ranged'): FigAniStrip | null {
    const set = this.gameData.figaniByUnit[String(unitId)];
    if (!set) return null;
    return set[slot] ?? null;
  }

  async loadUnitFigAni(
    unitId: number,
    slot: 'idle' | 'attack' | 'ranged'
  ): Promise<{ img: HTMLImageElement; strip: FigAniStrip } | null> {
    const strip = this.getUnitFigAniStripMeta(unitId, slot);
    if (!strip) return null;
    const key = `${unitId}:${slot}`;
    if (this.figaniStripCache.has(key)) {
      const img = this.figaniStripCache.get(key);
      return img ? { img, strip } : null;
    }
    try {
      const url = strip.file.replace(/^\//, '');
      const img = await loadImage(url);
      this.figaniStripCache.set(key, img);
      return { img, strip };
    } catch {
      return null;
    }
  }

  getSpellStripMeta(stripId: number): FigAniStrip | null {
    return this.gameData.spellStrips?.[String(stripId)] ?? null;
  }

  async loadSpellAnim(
    spellId: number,
    targetIsHeroSide: boolean
  ): Promise<{ img: HTMLImageElement; strip: FigAniStrip; align: 'target_anchor' | 'screen_abs' } | null> {
    const sp = this.gameData.spells[spellId];
    if (!sp) return null;
    const stripId = targetIsHeroSide ? sp.animHeroStripId : sp.animEnemyStripId;
    if (stripId === undefined || stripId === null) return null;
    const align = sp.animAlign ?? 'target_anchor';
    const strip = this.getSpellStripMeta(stripId);
    if (!strip) return null;
    const key = `spell_strip:${stripId}`;
    if (this.figaniStripCache.has(key)) {
      const img = this.figaniStripCache.get(key);
      return img ? { img, strip, align } : null;
    }
    try {
      const url = strip.file.replace(/^\//, '');
      const img = await loadImage(url);
      this.figaniStripCache.set(key, img);
      return { img, strip, align };
    } catch {
      return null;
    }
  }

  /** Returns the total pixel width of a resolved glyph array at the given scale. */
  measureGlyphs(glyphs: number[], fallbackText?: string, scale = 1, forceBitmap = false): number {
    const valid = resolveLocaleGlyphs(glyphs, fallbackText, forceBitmap).filter(
      (g) => g >= 0 && g < this.gameData.font.glyphCount
    );
    if (valid.length === 0) return 0;
    let total = 0;
    for (const gid of valid) {
      const gw = GLYPH_WIDTHS[gid] ?? 16;
      total += Math.round((gw + 1) * scale);
    }
    return total;
  }

  /** Draws an array of 16-bit glyph IDs (or localized text in zh-TW, zh-CN, or en) onto any Canvas context as crisp 1-bit DOS bitmap glyphs with 1px drop shadow. */
  drawGlyphs(
    ctx: CanvasRenderingContext2D,
    glyphs: number[],
    x: number,
    y: number,
    color: GlyphColor = 'ivory',
    scale = 1,
    withShadow = true,
    fallbackText?: string,
    forceBitmap = false
  ): number {
    const valid = resolveLocaleGlyphs(glyphs, fallbackText, forceBitmap).filter(
      (g) => g >= 0 && g < this.gameData.font.glyphCount
    );
    if (valid.length === 0) return 0;
    const sheet = this.tintedFonts.get(color) ?? this.tintedFonts.get('ivory')!;
    const shadowSheet = this.tintedFonts.get('shadow')!;
    const cols = this.gameData.font.cols;
    const cellH = Math.round(16 * scale);
    const shOff = Math.max(1, Math.round(scale));
    const isHd = this.editionMode === 'hd';
    ctx.save();
    ctx.imageSmoothingEnabled = isHd;
    if (isHd) {
      ctx.imageSmoothingQuality = 'high';
    }
    let cx = Math.round(x);
    const cy = Math.round(y);
    for (const gid of valid) {
      const gw = GLYPH_WIDTHS[gid] ?? 16;
      const drawW = Math.round(gw * scale);
      const step = Math.round((gw + 1) * scale);
      const sx = (gid % cols) * 16;
      const sy = Math.floor(gid / cols) * 16;
      if (isHd) {
        if (withShadow) {
          const hdSh = this.getHdRegion4x(`font:shadow:${gid}`, shadowSheet, sx, sy, gw, 16);
          ctx.drawImage(hdSh, 0, 0, gw * 4, 64, cx + shOff, cy + shOff, drawW, cellH);
        }
        const hdFg = this.getHdRegion4x(`font:${color}:${gid}`, sheet, sx, sy, gw, 16);
        ctx.drawImage(hdFg, 0, 0, gw * 4, 64, cx, cy, drawW, cellH);
      } else {
        if (withShadow) {
          ctx.drawImage(shadowSheet, sx, sy, gw, 16, cx + shOff, cy + shOff, drawW, cellH);
        }
        ctx.drawImage(sheet, sx, sy, gw, 16, cx, cy, drawW, cellH);
      }
      cx += step;
    }
    ctx.restore();
    return cx - Math.round(x);
  }

  private renderGlyphRunImg(
    run: number[],
    color: GlyphColor,
    heightPx: number,
    altText: string
  ): string {
    const nativeW = run.reduce((acc, g) => acc + (GLYPH_WIDTHS[g] ?? 16) + 1, 0) + 1;
    const key = `${run.join(',')}:${color}`;
    let url = this.glyphUrlCache.get(key);
    if (!url) {
      const c = document.createElement('canvas');
      c.width = nativeW;
      c.height = 18;
      const ctx = c.getContext('2d')!;
      this.drawGlyphs(ctx, run, 0, 1, color, 1, true, undefined, true);
      url = c.toDataURL();
      this.glyphUrlCache.set(key, url);
    }
    const w = Math.max(1, Math.round((nativeW * heightPx) / 18));
    const safeAlt = altText.replace(/"/g, '&quot;');
    return `<img class="pixel-crisp" src="${url}" width="${w}" height="${heightPx}" alt="${safeAlt}" style="vertical-align: -3px; display: inline-block;" />`;
  }

  /** Renders a glyph array (or localized text in zh-TW, zh-CN, or en) to cached transparent 1-bit DOS bitmap PNG data-URLs for crisp retro HTML UI labels. */
  glyphsToHtml(
    glyphs: number[],
    color: GlyphColor = 'ivory',
    heightPx = 16,
    fallback = '—',
    forceBitmap = false
  ): string {
    const valid = resolveLocaleGlyphs(glyphs, fallback, forceBitmap).filter(
      (g) => g >= 0 && g < this.gameData.font.glyphCount
    );
    if (valid.length === 0) {
      return `<span>${fallback}</span>`;
    }
    const totalNativeW = valid.reduce((acc, g) => acc + (GLYPH_WIDTHS[g] ?? 16) + 1, 0) + 1;
    const spaceGid = CHAR_TO_GID_EN[' '];

    // If a long English/spaced string exceeds 190px native width, split on spaces so words wrap naturally inside narrow panels
    if (!forceBitmap && totalNativeW > 190 && spaceGid !== undefined && valid.includes(spaceGid)) {
      const words: number[][] = [];
      let cur: number[] = [];
      for (const g of valid) {
        if (g === spaceGid) {
          if (cur.length > 0) {
            words.push(cur);
            cur = [];
          }
        } else {
          cur.push(g);
        }
      }
      if (cur.length > 0) words.push(cur);
      if (words.length > 1) {
        return words.map((w) => this.renderGlyphRunImg(w, color, heightPx, '')).join(' ');
      }
    }

    // If a long unspaced CJK sentence exceeds 235px (>13 full-width chars, e.g. 19-char lose objective in sidebar), chunk into 2-char inline-block runs so it can wrap cleanly
    if (!forceBitmap && totalNativeW > 235) {
      const chunks: string[] = [];
      for (let i = 0; i < valid.length; i += 2) {
        chunks.push(this.renderGlyphRunImg(valid.slice(i, i + 2), color, heightPx, ''));
      }
      return chunks.join('');
    }

    return this.renderGlyphRunImg(valid, color, heightPx, fallback);
  }

  /** Draws an 80x80 portrait frame (0..3) from portraits_atlas.png (0-indexed: 0 = Sol). */
  drawPortrait(
    ctx: CanvasRenderingContext2D,
    portraitId: number,
    frameIdx: number,
    dx: number,
    dy: number,
    dw = 80,
    dh = 80
  ): void {
    const pid = Math.max(0, Math.min(this.gameData.portraitCount - 1, portraitId));
    const f = ((frameIdx % 4) + 4) % 4;
    const sx = (pid % 4) * 320 + f * 80;
    const sy = Math.floor(pid / 4) * 80;
    if (this.editionMode === 'hd') {
      const hdCanvas = this.getHdRegion4x(`portrait:${pid}:${f}`, this.portraitsAtlas, sx, sy, 80, 80);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(hdCanvas, 0, 0, 320, 320, dx, dy, dw, dh);
      ctx.restore();
      return;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.portraitsAtlas, sx, sy, 80, 80, dx, dy, dw, dh);
  }

  portraitToDataUrl(portraitId: number, frameIdx = 0): string {
    const key = `${this.editionMode}:${portraitId}:${frameIdx}`;
    const cached = this.portraitUrlCache.get(key);
    if (cached) return cached;
    const size = this.editionMode === 'hd' ? 160 : 80;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d')!;
    this.drawPortrait(ctx, portraitId, frameIdx, 0, 0, size, size);
    const url = c.toDataURL();
    this.portraitUrlCache.set(key, url);
    return url;
  }

  /** Draws a 24x24 battlefield unit sprite (spriteGroup 0..139, dir 0..3, animFrame 0..2). */
  drawUnitSprite(
    ctx: CanvasRenderingContext2D,
    spriteGroup: number,
    dir: number,
    animFrame: number,
    dx: number,
    dy: number,
    size: number,
    greyedOut = false
  ): void {
    const row = Math.max(0, Math.min(this.gameData.unitsAtlas.rows - 1, spriteGroup));
    // 3-frame NPC rows in `FDICON.B24` (`#48 雷特王`, `#66 米蘭王后`, `#67`, `#74`, `#75 米蘭`) only populate `col 0..2` (`dir = 0`)!
    const rawFrames = this.gameData.unitDex?.[row]?.rawSpriteFrames ?? 12;
    const effDir = rawFrames > 0 && rawFrames <= 3 ? 0 : (dir & 3);
    const col = effDir * 3 + (animFrame % 3);
    const sx = col * 24;
    const sy = row * 24;
    ctx.save();
    if (greyedOut) {
      ctx.filter = 'grayscale(85%) brightness(0.68)';
    }
    if (this.editionMode === 'hd') {
      const hdRow = this.getHdRegion4x(`unit_row:${row}`, this.unitsAtlas, 0, sy, 288, 24);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(hdRow, col * 96, 0, 96, 96, dx, dy, size, size);
    } else {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.unitsAtlas, sx, sy, 24, 24, dx, dy, size, size);
    }
    ctx.restore();
  }

  spriteToDataUrl(spriteGroup: number, dir = 0, animFrame = 0, size = 48): string {
    const key = `${this.editionMode}:${spriteGroup}:${dir}:${animFrame}:${size}`;
    const cached = this.spriteUrlCache.get(key);
    if (cached) return cached;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d')!;
    this.drawUnitSprite(ctx, spriteGroup, dir, animFrame, 0, 0, size, false);
    const url = c.toDataURL();
    this.spriteUrlCache.set(key, url);
    return url;
  }

  /** Draws a 24x24 save-slot chibi hero icon from item_icons.png (FDOTHER[96]). */
  chibiToDataUrl(chibiIdx: number, size = 48): string {
    const idx = Math.max(0, Math.min(67, chibiIdx));
    const key = `${this.editionMode}:${idx}:${size}`;
    const cached = this.chibiUrlCache.get(key);
    if (cached) return cached;
    const cols = this.gameData.itemIcons.cols;
    const sx = (idx % cols) * 24;
    const sy = Math.floor(idx / cols) * 24;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d')!;
    if (this.editionMode === 'hd') {
      const hdIcon = this.getHdRegion4x(`chibi:${idx}`, this.itemIcons, sx, sy, 24, 24);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(hdIcon, 0, 0, 96, 96, 0, 0, size, size);
    } else {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.itemIcons, sx, sy, 24, 24, 0, 0, size, size);
    }
    const url = c.toDataURL();
    this.chibiUrlCache.set(key, url);
    return url;
  }

  /** Draws a 320x100 cutaway battle background from bgs_atlas.png (or Nano Banana 2 1280x400 HD repainted background in HD mode). */
  drawBattleBg(ctx: CanvasRenderingContext2D, bgId: number, dx: number, dy: number, dw: number, dh: number): void {
    const bid = Math.max(0, Math.min(this.gameData.bgCount - 1, bgId));
    const sx = (bid % 4) * 320;
    const sy = Math.floor(bid / 4) * 100;
    if (this.editionMode === 'hd') {
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      if (HD_REPAINTED_BG_IDS.has(bid)) {
        const entry = this.hdBgImages.get(bid);
        if (entry && entry !== 'loading' && entry !== 'none') {
          ctx.drawImage(entry, 0, 0, entry.width, entry.height, dx, dy, dw, dh);
          ctx.restore();
          return;
        }
        if (!entry) {
          this.hdBgImages.set(bid, 'loading');
          loadImage(`assets/hd_bgs/bg_${bid}.png`)
            .then((img) => {
              this.hdBgImages.set(bid, img);
            })
            .catch(() => {
              this.hdBgImages.set(bid, 'none');
            });
        }
      }
      const hdBg = this.getHdRegion4x(`bg:${bid}`, this.bgsAtlas, sx, sy, 320, 100);
      ctx.drawImage(hdBg, 0, 0, 1280, 400, dx, dy, dw, dh);
      ctx.restore();
      return;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.bgsAtlas, sx, sy, 320, 100, dx, dy, dw, dh);
  }

  /** Draws a TAI.DAT cutaway combat platform from tais_atlas.png (4 cols x 160x48 cells). */
  drawTaiPlatform(ctx: CanvasRenderingContext2D, taiId: number, dx: number, dy: number, flipX = false): void {
    const meta = this.gameData.taiPlatforms?.[taiId];
    if (!meta || !meta.valid || meta.w <= 0 || meta.h <= 0) return;
    const sx = (taiId % 4) * 160;
    const sy = Math.floor(taiId / 4) * 48;
    ctx.save();
    if (this.editionMode === 'hd') {
      const hdTai = this.getHdRegion4x(`tai:${taiId}`, this.taisAtlas, sx, sy, meta.w, meta.h);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      if (flipX) {
        ctx.translate(dx + meta.w, dy);
        ctx.scale(-1, 1);
        ctx.drawImage(hdTai, 0, 0, meta.w * 4, meta.h * 4, 0, 0, meta.w, meta.h);
      } else {
        ctx.drawImage(hdTai, 0, 0, meta.w * 4, meta.h * 4, dx, dy, meta.w, meta.h);
      }
      ctx.restore();
      return;
    }
    ctx.imageSmoothingEnabled = false;
    if (flipX) {
      ctx.translate(dx + meta.w, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(this.taisAtlas, sx, sy, meta.w, meta.h, 0, 0, meta.w, meta.h);
    } else {
      ctx.drawImage(this.taisAtlas, sx, sy, meta.w, meta.h, dx, dy, meta.w, meta.h);
    }
    ctx.restore();
  }

  /**
   * Renders the 100% authentic `FD2.EXE` (`fn_107145` -> `fn_35949`) 149x42 cutaway battle HUD panel
   * using extracted `FDOTHER.DAT[5]` sprites (`battle_hud.png`), without portrait avatars:
   *  - Top-Right `(171, 4)` (`1451 = 4*320 + 171`) for Right Hero / Friend (`faction != 0`)
   *  - Bottom-Left `(0, 154)` (`49280 = 154*320 + 0`) for Left Enemy (`faction == 0`)
   *  - HP bar at `(bx+21, by+22)` (golden-yellow `[195,197,199]` on dark-red `[35,37]`)
   *  - MP bar at `(bx+31 -> bx+21, by+31)` (olive-green `[155,157,165]` on dark-red `[35,37]`)
   *  - Level at `(bx+132, by+4)`, HP digits at `(bx+126, by+21)`, MP digits at `(bx+126, by+30)`
   *  - Unit name 16x16 glyphs at `(bx+5, by+4)` with `pal[205]` (`#6989ca`) + `pal[76]` (`#102465`) dual shadow (`fn_256554`).
   */
  drawBattleHudPanel(
    ctx: CanvasRenderingContext2D,
    bx: number,
    by: number,
    nameGlyphs: number[],
    level: number,
    curHp: number,
    maxHp: number,
    curMp: number,
    maxMp: number,
    nameText?: string
  ): void {
    const hudMeta = this.gameData.battleHud;
    if (!hudMeta || !this.battleHudAtlas) return;
    const rects = hudMeta.rects;
    const isHd = this.editionMode === 'hd';
    ctx.save();
    ctx.imageSmoothingEnabled = isHd;
    if (isHd) {
      ctx.imageSmoothingQuality = 'high';
    }

    const hdHudSheet = isHd ? this.getHdImage4x('battle_hud_4x', this.battleHudAtlas) : null;
    const blitHudSprite = (id: number, dx: number, dy: number) => {
      const r = rects[String(id)];
      if (!r) return;
      if (isHd && hdHudSheet) {
        ctx.drawImage(hdHudSheet, r[0] * 4, r[1] * 4, r[2] * 4, r[3] * 4, dx, dy, r[2], r[3]);
      } else {
        ctx.drawImage(this.battleHudAtlas, r[0], r[1], r[2], r[3], dx, dy, r[2], r[3]);
      }
    };

    // 1. Base 149x42 steel-blue panel with dark-red empty HP/MP troughs (`FDOTHER[5][22]`)
    blitHudSprite(22, bx, by);

    // 2. HP & MP Bars (`fn_34709` -> `fn_32111`: 102px fill math `floor(cur * 101 / max) + 1`)
    const drawBar = (barX: number, barY: number, curVal: number, maxVal: number, baseSpriteId: number) => {
      if (maxVal <= 0) return;
      const clampedCur = Math.max(0, Math.min(maxVal, Math.round(curVal)));
      if (clampedCur <= 0) return;
      const fillLen = Math.min(102, Math.floor((clampedCur * 101) / maxVal) + 1);
      blitHudSprite(baseSpriteId, barX, barY);
      for (let c = 1; c < fillLen; c++) {
        blitHudSprite(baseSpriteId + 1, barX + c, barY);
      }
      blitHudSprite(baseSpriteId + 2, barX + fillLen, barY);
    };

    drawBar(bx + 21, by + 22, curHp, maxHp, 23);
    drawBar(bx + 21, by + 31, curMp, maxMp, 26);

    // 3. Level (`2` digits at `+132, +4`), Current HP (`3` digits at `+126, +21`), Current MP (`3` digits at `+126, +30`)
    const drawHudDigits = (nx: number, ny: number, rawVal: number, fontBase: number, numDigits: 2 | 3) => {
      const val = Math.max(0, Math.round(rawVal));
      if (numDigits === 3 && val > 999) {
        blitHudSprite(fontBase + 10, nx, ny); // `???` (`41` or `52`)
        return;
      }
      if (numDigits === 2 && val > 99) {
        blitHudSprite(93, nx, ny); // `??` (`93`)
        return;
      }
      const str = String(val).padStart(numDigits, '0').slice(-numDigits);
      for (let k = 0; k < numDigits; k++) {
        const d = str.charCodeAt(k) - 48;
        if (d >= 0 && d <= 9) {
          blitHudSprite(fontBase + d, nx + k * 6, ny);
        }
      }
    };

    const dispHp = Math.max(0, Math.round(curHp));
    const dispMp = Math.max(0, Math.round(curMp));
    drawHudDigits(bx + 132, by + 4, level, 31, 2);
    drawHudDigits(bx + 126, by + 21, dispHp, dispHp === Math.round(maxHp) ? 31 : 42, 3);
    drawHudDigits(bx + 126, by + 30, dispMp, dispMp === Math.round(maxMp) ? 31 : 42, 3);

    // 4. Unit Name 16x16 Calligraphy Glyphs at `(bx+5, by+4)`, exact `fn_256554` dual shadow across zh-TW, zh-CN, and en
    const resolvedNameGlyphs = resolveLocaleGlyphs(nameGlyphs, nameText, false).filter(
      (g) => g >= 0 && g < this.gameData.font.glyphCount
    );
    const fgSheet = this.tintedFonts.get('hud_fg') ?? this.tintedFonts.get('ivory')!;
    const shSheet = this.tintedFonts.get('hud_shadow') ?? this.tintedFonts.get('shadow')!;
    const cols = this.gameData.font.cols;
    let cx = bx + 5;
    const cy = by + 4;
    for (const gid of resolvedNameGlyphs) {
      const gw = GLYPH_WIDTHS[gid] ?? 16;
      const adv = gid in GLYPH_WIDTHS ? gw + 1 : 16;
      if (cx + gw > bx + 131) break;
      const sx = (gid % cols) * 16;
      const sy = Math.floor(gid / cols) * 16;
      // Exact fn_256554 row-major overwrite behavior: shadow at (x-1, y+1) and (x, y+1), foreground on top at (x, y)
      if (isHd) {
        const hdSh = this.getHdRegion4x(`font:hud_shadow:${gid}`, shSheet, sx, sy, gw, 16);
        const hdFg = this.getHdRegion4x(`font:hud_fg:${gid}`, fgSheet, sx, sy, gw, 16);
        ctx.drawImage(hdSh, 0, 0, gw * 4, 64, cx - 1, cy + 1, gw, 16);
        ctx.drawImage(hdSh, 0, 0, gw * 4, 64, cx, cy + 1, gw, 16);
        ctx.drawImage(hdFg, 0, 0, gw * 4, 64, cx, cy, gw, 16);
      } else {
        ctx.drawImage(shSheet, sx, sy, gw, 16, cx - 1, cy + 1, gw, 16);
        ctx.drawImage(shSheet, sx, sy, gw, 16, cx, cy + 1, gw, 16);
        ctx.drawImage(fgSheet, sx, sy, gw, 16, cx, cy, gw, 16);
      }
      cx += adv;
    }
    ctx.restore();
  }

  /**
   * Draws a 24x20 4-Way Cross Menu icon from `cross_icons.png` (`FDOTHER[2]`):
   *  - `iconId`: `0..25`
   *  - `state`: `0` = normal, `1` = active/toggle-off, `2` = disabled (red backing)
   */
  drawCrossIcon(
    ctx: CanvasRenderingContext2D,
    iconId: number,
    state: 0 | 1 | 2,
    dx: number,
    dy: number,
    scale = 1
  ): void {
    if (!this.crossIconsAtlas) return;
    const id = Math.max(0, Math.min(25, iconId));
    const st = Math.max(0, Math.min(2, state));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.crossIconsAtlas,
      id * 24,
      st * 20,
      24,
      20,
      Math.round(dx),
      Math.round(dy),
      Math.round(24 * scale),
      Math.round(20 * scale)
    );
  }

  /** Renders a 24x20 Cross Menu icon to a cached data URL for interactive DOM/tooltip badges. */
  crossIconToDataUrl(iconId: number, state: 0 | 1 | 2 = 0, scale = 2): string {
    const key = `cross:${iconId}:${state}:${scale}`;
    const cached = this.spriteUrlCache.get(key);
    if (cached) return cached;
    const c = document.createElement('canvas');
    c.width = Math.round(24 * scale);
    c.height = Math.round(20 * scale);
    const ctx = c.getContext('2d')!;
    this.drawCrossIcon(ctx, iconId, state, 0, 0, scale);
    const url = c.toDataURL();
    this.spriteUrlCache.set(key, url);
    return url;
  }

  /** Draws a tactical UI panel/badge sprite (`FDOTHER[5]`, e.g. `20, 21, 130, 133..137`) from `tactical_ui.png`. */
  drawTacticalUiSprite(
    ctx: CanvasRenderingContext2D,
    spriteId: number,
    dx: number,
    dy: number,
    scale = 1
  ): [number, number] {
    const meta = this.gameData.tacticalUi;
    if (!meta || !this.tacticalUiAtlas) return [0, 0];
    const r = meta.rects[String(spriteId)];
    if (!r) return [0, 0];
    ctx.imageSmoothingEnabled = false;
    const dw = Math.round(r[2] * scale);
    const dh = Math.round(r[3] * scale);
    ctx.drawImage(this.tacticalUiAtlas, r[0], r[1], r[2], r[3], Math.round(dx), Math.round(dy), dw, dh);
    return [dw, dh];
  }

  /** Draws a 24x24 terrain tile from a chapter tileset (using `4x` edge-directed HD tileset in HD mode). */
  drawTerrainTile(
    ctx: CanvasRenderingContext2D,
    chapterId: number,
    tileset: HTMLImageElement,
    sx: number,
    sy: number,
    dx: number,
    dy: number,
    tilePx: number
  ): void {
    if (this.editionMode === 'hd') {
      const hdTs = this.getHdImage4x(`tileset:${chapterId}`, tileset);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(hdTs, sx * 4, sy * 4, 96, 96, dx, dy, tilePx, tilePx);
      return;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tileset, sx, sy, 24, 24, dx, dy, tilePx, tilePx);
  }

  /** Draws a FIGANI combat/spell frame (using `4x` edge-directed HD frame + de-dithered shadow + portrait-guided face synthesis in HD mode). */
  drawFigAniFrame(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw = sw,
    dh = sh,
    unitId?: number
  ): void {
    if (sw <= 0 || sh <= 0) return;
    if (this.editionMode === 'hd') {
      const hdFrame = this.getHdRegion4x(
        `fig:${unitId ?? 'fx'}:${img.src}:${sx}:${sy}:${sw}:${sh}`,
        img,
        sx,
        sy,
        sw,
        sh,
        { isFigAniSprite: true, unitId }
      );
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(hdFrame, 0, 0, sw * 4, sh * 4, dx, dy, dw, dh);
      ctx.restore();
      return;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  /** Draws a 12-frame `FDOTHER[9]` teleportation / rest-heal sparkle centered at `(cx, cy)`. */
  drawSparkleFrame(
    ctx: CanvasRenderingContext2D,
    frameIdx: number,
    cx: number,
    cy: number,
    scale = 1
  ): void {
    const fx = this.gameData.fxAtlas;
    if (!fx || !this.fxAtlas || !fx.sparkles.length) return;
    const idx = Math.max(0, Math.min(fx.sparkles.length - 1, frameIdx));
    const r = fx.sparkles[idx];
    if (!r) return;
    const dw = Math.round(r[2] * scale);
    const dh = Math.round(r[3] * scale);
    if (this.editionMode === 'hd') {
      const hdSp = this.getHdRegion4x(`sparkle:${idx}`, this.fxAtlas, r[0], r[1], r[2], r[3]);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(hdSp, 0, 0, r[2] * 4, r[3] * 4, Math.round(cx - dw / 2), Math.round(cy - dh / 2), dw, dh);
      ctx.restore();
      return;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.fxAtlas,
      r[0],
      r[1],
      r[2],
      r[3],
      Math.round(cx - dw / 2),
      Math.round(cy - dh / 2),
      dw,
      dh
    );
  }

  /**
   * Draws a 12-frame `FDOTHER[5][68..79]` on-map unit death explosion (`fn_56165`, `72x71` envelope)
   * anchored at `FD2.EXE`'s exact `(tileLeft - 24*scale, tileTop - 30*scale)`!
   */
  drawExplosionFrame(
    ctx: CanvasRenderingContext2D,
    frameIdx: number,
    tileLeftPx: number,
    tileTopPx: number,
    scale = 1
  ): void {
    const fx = this.gameData.fxAtlas;
    if (!fx || !this.fxAtlas || !fx.explosions?.length) return;
    const idx = Math.max(0, Math.min(fx.explosions.length - 1, frameIdx));
    const r = fx.explosions[idx];
    if (!r) return;
    const dx = Math.round(tileLeftPx - 24 * scale);
    const dy = Math.round(tileTopPx - 30 * scale);
    const dw = Math.round(r[2] * scale);
    const dh = Math.round(r[3] * scale);
    if (this.editionMode === 'hd') {
      const hdExp = this.getHdRegion4x(`exp:${idx}`, this.fxAtlas, r[0], r[1], r[2], r[3]);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(hdExp, 0, 0, r[2] * 4, r[3] * 4, dx, dy, dw, dh);
      ctx.restore();
      return;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.fxAtlas, r[0], r[1], r[2], r[3], dx, dy, dw, dh);
  }

  /**
   * Draws an on-map spell/status FX sprite from `FDOTHER[6][frameId]` (`fn_50380`)
   * anchored at `(tileLeftPx, tileTopPx - 6*scale)`.
   */
  drawMapSpellFxFrame(
    ctx: CanvasRenderingContext2D,
    frameId: number,
    tileLeftPx: number,
    tileTopPx: number,
    scale = 1
  ): void {
    const fx = this.gameData.fxAtlas;
    if (!fx || !this.fxAtlas || !fx.mapSpellFx) return;
    const r = fx.mapSpellFx[String(frameId)];
    if (!r) return;
    const dw = Math.round(r[2] * scale);
    const dh = Math.round(r[3] * scale);
    // Center horizontally on 24px tile if smaller/larger, and anchor at `-6px` vertically like `fn_50380` (`L50683: -2736 / 456 = -6`)
    const dx = Math.round(tileLeftPx + (24 * scale - dw) / 2);
    const dy = Math.round(tileTopPx - 6 * scale + (24 * scale - dh) / 2);
    if (this.editionMode === 'hd') {
      const hdMfx = this.getHdRegion4x(`mfx:${frameId}`, this.fxAtlas, r[0], r[1], r[2], r[3]);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(hdMfx, 0, 0, r[2] * 4, r[3] * 4, dx, dy, dw, dh);
      ctx.restore();
      return;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.fxAtlas, r[0], r[1], r[2], r[3], dx, dy, dw, dh);
  }

  /**
   * Draws authentic `FDOTHER[5]` on-map bouncing pixel digits (`94..103` orange damage, `105..114` green heal, `116..118` `MISS`)
   * matching `FD2.EXE` `fn_57176` (`GLOBAL_2_8236` bounce parabola).
   */
  drawBouncingMapPopup(
    ctx: CanvasRenderingContext2D,
    tileLeftPx: number,
    tileTopPx: number,
    yOffsetNativePx: number,
    kind: 'damage' | 'heal' | 'miss',
    amount: number,
    scale = 1
  ): void {
    const meta = this.gameData.tacticalUi;
    if (!meta || !this.tacticalUiAtlas) return;
    ctx.imageSmoothingEnabled = false;

    const spriteIds: number[] = [];
    if (kind === 'miss') {
      spriteIds.push(116, 117, 118, 118); // `M-I-S-S` (`GLOBAL_2_8266`)
    } else {
      const base = kind === 'heal' ? 105 : 94;
      const digits = String(Math.max(0, Math.min(9999, Math.round(amount))));
      for (let i = 0; i < digits.length; i++) {
        const d = digits.charCodeAt(i) - 48;
        if (d >= 0 && d <= 9) spriteIds.push(base + d);
      }
    }
    if (spriteIds.length === 0) return;

    const totalNativeW = spriteIds.length * 5 + 1;
    let curX = tileLeftPx + ((24 - totalNativeW) / 2) * scale;
    const drawY = Math.round(tileTopPx + yOffsetNativePx * scale);

    for (const sid of spriteIds) {
      const r = meta.rects[String(sid)];
      if (r) {
        ctx.drawImage(
          this.tacticalUiAtlas,
          r[0],
          r[1],
          r[2],
          r[3],
          Math.round(curX),
          drawY,
          Math.round(r[2] * scale),
          Math.round(r[3] * scale)
        );
      }
      curX += 5 * scale;
    }
  }

  /** Loads any `spellStrips` special animation strip by numeric stripId (e.g. `34` Crystal Beam, `45` Golden Castle Rising). */
  async loadSpecialStrip(stripId: number): Promise<{ img: HTMLImageElement; strip: FigAniStrip } | null> {
    const strip = this.getSpellStripMeta(stripId);
    if (!strip) return null;
    const key = `spell_strip:${stripId}`;
    if (this.figaniStripCache.has(key)) {
      const img = this.figaniStripCache.get(key);
      return img ? { img, strip } : null;
    }
    try {
      const url = strip.file.replace(/^\//, '');
      const img = await loadImage(url);
      this.figaniStripCache.set(key, img);
      return { img, strip };
    } catch {
      return null;
    }
  }
}
