import { applyLocaleToGameState, decodeGlyphsToText, getLocale } from '../i18n';
import type {
  ChapterData,
  ChoreographyScript,
  FigAniStrip,
  GameData,
  MusicTrack,
  PostFormationDef,
} from '../types';

export type GlyphColor = 'ivory' | 'gold' | 'crimson' | 'azure' | 'emerald' | 'shadow' | 'hud_fg' | 'hud_shadow';

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

  private tintedFonts = new Map<GlyphColor, HTMLCanvasElement>();
  private glyphUrlCache = new Map<string, string>();
  private portraitUrlCache = new Map<string, string>();
  private spriteUrlCache = new Map<string, string>();
  private chibiUrlCache = new Map<string, string>();
  private chapterCache = new Map<number, { data: ChapterData; tileset: HTMLImageElement }>();
  private figaniStripCache = new Map<string, HTMLImageElement | null>();

  async init(onProgress?: (label: string) => void): Promise<void> {
    onProgress?.('Loading Flame Dragon II archives...');
    const [
      gdRes,
      musRes,
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
      churchBg,
      worldBg,
      endingBg,
      gameoverBg,
    ] = await Promise.all([
      fetch('assets/gamedata.json').then((r) => r.json() as Promise<GameData>),
      fetch('assets/music.json').then((r) => r.json() as Promise<MusicTrack[]>),
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
      loadImage('assets/screens/church.png'),
      loadImage('assets/screens/world.png'),
      loadImage('assets/screens/ending.png'),
      loadImage('assets/screens/gameover.png'),
    ]);

    this.gameData = gdRes;
    applyLocaleToGameState(this.gameData);
    this.musicTracks = musRes;
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
      church: churchBg,
      world: worldBg,
      ending: endingBg,
      gameover: gameoverBg,
    };

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

  /** Draws an array of 16-bit glyph IDs (or localized fallback text when locale !== 'zh-TW') onto any Canvas context with crisp 1px drop shadow. */
  drawGlyphs(
    ctx: CanvasRenderingContext2D,
    glyphs: number[],
    x: number,
    y: number,
    color: GlyphColor = 'ivory',
    scale = 1,
    withShadow = true,
    fallbackText?: string
  ): number {
    const resolvedFallback =
      getLocale() !== 'zh-TW'
        ? fallbackText || decodeGlyphsToText(glyphs)
        : fallbackText;
    if (getLocale() !== 'zh-TW' && resolvedFallback) {
      ctx.save();
      const fontSize = Math.round(13 * scale);
      ctx.font = `700 ${fontSize}px "Noto Serif TC", "Cinzel", Georgia, serif`;
      ctx.textBaseline = 'top';
      if (withShadow) {
        ctx.fillStyle = GLYPH_HEX.shadow;
        ctx.fillText(resolvedFallback, Math.round(x + Math.max(1, scale)), Math.round(y + 1 + Math.max(1, scale)));
      }
      ctx.fillStyle = GLYPH_HEX[color] ?? GLYPH_HEX.ivory;
      ctx.fillText(resolvedFallback, Math.round(x), Math.round(y + 1));
      const w = ctx.measureText(resolvedFallback).width;
      ctx.restore();
      return Math.ceil(w);
    }
    const sheet = this.tintedFonts.get(color) ?? this.tintedFonts.get('ivory')!;
    const shadowSheet = this.tintedFonts.get('shadow')!;
    const cols = this.gameData.font.cols;
    const size = 16 * scale;
    const step = Math.round(16 * scale + scale);
    ctx.imageSmoothingEnabled = false;
    let cx = Math.round(x);
    const cy = Math.round(y);
    for (const gid of glyphs) {
      if (gid < 0 || gid >= this.gameData.font.glyphCount) continue;
      const sx = (gid % cols) * 16;
      const sy = Math.floor(gid / cols) * 16;
      if (withShadow) {
        ctx.drawImage(shadowSheet, sx, sy, 16, 16, cx + Math.max(1, scale), cy + Math.max(1, scale), size, size);
      }
      ctx.drawImage(sheet, sx, sy, 16, 16, cx, cy, size, size);
      cx += step;
    }
    return cx - x;
  }

  /** Renders a glyph array to a cached transparent PNG data-URL for crisp HTML UI labels, or styled localized text when locale !== 'zh-TW'. */
  glyphsToHtml(glyphs: number[], color: GlyphColor = 'ivory', heightPx = 16, fallback = '—'): string {
    const loc = getLocale();
    const resolvedText =
      fallback && fallback !== '—'
        ? fallback
        : loc !== 'zh-TW' && glyphs && glyphs.length > 0
          ? decodeGlyphsToText(glyphs, loc)
          : fallback;
    if (loc !== 'zh-TW' && resolvedText && resolvedText !== '—') {
      const hex = GLYPH_HEX[color] ?? GLYPH_HEX.ivory;
      const fSize = Math.max(12, heightPx - 2);
      return `<span class="localized-glyph" style="color:${hex}; font-weight:700; font-size:${fSize}px; text-shadow:1px 1px 0 #07090e; display:inline-block;">${resolvedText}</span>`;
    }
    const valid = (glyphs ?? []).filter((g) => g >= 0 && g < this.gameData.font.glyphCount);
    if (valid.length === 0) {
      return `<span>${fallback}</span>`;
    }
    const key = `${valid.join(',')}:${color}`;
    let url = this.glyphUrlCache.get(key);
    if (!url) {
      const c = document.createElement('canvas');
      c.width = valid.length * 17 + 1;
      c.height = 18;
      const ctx = c.getContext('2d')!;
      this.drawGlyphs(ctx, valid, 0, 1, color, 1, true);
      url = c.toDataURL();
      this.glyphUrlCache.set(key, url);
    }
    const w = Math.round(((valid.length * 17 + 1) * heightPx) / 18);
    return `<img class="pixel-crisp" src="${url}" width="${w}" height="${heightPx}" alt="${fallback}" style="vertical-align: -3px; display: inline-block;" />`;
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
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.portraitsAtlas, sx, sy, 80, 80, dx, dy, dw, dh);
  }

  portraitToDataUrl(portraitId: number, frameIdx = 0): string {
    const key = `${portraitId}:${frameIdx}`;
    const cached = this.portraitUrlCache.get(key);
    if (cached) return cached;
    const c = document.createElement('canvas');
    c.width = 80;
    c.height = 80;
    const ctx = c.getContext('2d')!;
    this.drawPortrait(ctx, portraitId, frameIdx, 0, 0, 80, 80);
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
    // 3-frame NPC rows in `FDICON.B24` (`#48 渥特王`, `#66 王后`, `#67`, `#74`, `#75 米蘭`) only populate `col 0..2` (`dir = 0`)!
    const rawFrames = this.gameData.unitDex?.[row]?.rawSpriteFrames ?? 12;
    const effDir = rawFrames > 0 && rawFrames <= 3 ? 0 : (dir & 3);
    const col = effDir * 3 + (animFrame % 3);
    const sx = col * 24;
    const sy = row * 24;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (greyedOut) {
      ctx.filter = 'grayscale(85%) brightness(0.68)';
    }
    ctx.drawImage(this.unitsAtlas, sx, sy, 24, 24, dx, dy, size, size);
    ctx.restore();
  }

  spriteToDataUrl(spriteGroup: number, dir = 0, animFrame = 0, size = 48): string {
    const key = `${spriteGroup}:${dir}:${animFrame}:${size}`;
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
    const key = `${idx}:${size}`;
    const cached = this.chibiUrlCache.get(key);
    if (cached) return cached;
    const cols = this.gameData.itemIcons.cols;
    const sx = (idx % cols) * 24;
    const sy = Math.floor(idx / cols) * 24;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.itemIcons, sx, sy, 24, 24, 0, 0, size, size);
    const url = c.toDataURL();
    this.chibiUrlCache.set(key, url);
    return url;
  }

  /** Draws a 320x100 cutaway battle background from bgs_atlas.png. */
  drawBattleBg(ctx: CanvasRenderingContext2D, bgId: number, dx: number, dy: number, dw: number, dh: number): void {
    const bid = Math.max(0, Math.min(this.gameData.bgCount - 1, bgId));
    const sx = (bid % 4) * 320;
    const sy = Math.floor(bid / 4) * 100;
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
    ctx.imageSmoothingEnabled = false;

    const blitHudSprite = (id: number, dx: number, dy: number) => {
      const r = rects[String(id)];
      if (!r) return;
      ctx.drawImage(this.battleHudAtlas, r[0], r[1], r[2], r[3], dx, dy, r[2], r[3]);
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

    // 4. Unit Name 16x16 Calligraphy Glyphs at `(bx+5, by+4)`, 16px advance, exact `fn_256554` dual shadow
    if (getLocale() !== 'zh-TW' && nameText) {
      ctx.save();
      ctx.font = '700 11px "Cinzel", "Noto Serif TC", Georgia, serif';
      ctx.textBaseline = 'top';
      ctx.fillStyle = GLYPH_HEX.hud_shadow;
      ctx.fillText(nameText, bx + 4, by + 6);
      ctx.fillText(nameText, bx + 5, by + 6);
      ctx.fillStyle = GLYPH_HEX.hud_fg;
      ctx.fillText(nameText, bx + 5, by + 5);
      ctx.restore();
      return;
    }
    const fgSheet = this.tintedFonts.get('hud_fg') ?? this.tintedFonts.get('ivory')!;
    const shSheet = this.tintedFonts.get('hud_shadow') ?? this.tintedFonts.get('shadow')!;
    const cols = this.gameData.font.cols;
    let cx = bx + 5;
    const cy = by + 4;
    for (const gid of nameGlyphs) {
      if (gid < 0 || gid >= this.gameData.font.glyphCount) continue;
      const sx = (gid % cols) * 16;
      const sy = Math.floor(gid / cols) * 16;
      // Exact fn_256554 row-major overwrite behavior: shadow at (x-1, y+1) and (x, y+1), foreground on top at (x, y)
      ctx.drawImage(shSheet, sx, sy, 16, 16, cx - 1, cy + 1, 16, 16);
      ctx.drawImage(shSheet, sx, sy, 16, 16, cx, cy + 1, 16, 16);
      ctx.drawImage(fgSheet, sx, sy, 16, 16, cx, cy, 16, 16);
      cx += 16;
    }
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
    const r = fx.sparkles[Math.max(0, Math.min(fx.sparkles.length - 1, frameIdx))];
    if (!r) return;
    const dw = Math.round(r[2] * scale);
    const dh = Math.round(r[3] * scale);
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
    const r = fx.explosions[Math.max(0, Math.min(fx.explosions.length - 1, frameIdx))];
    if (!r) return;
    const dx = Math.round(tileLeftPx - 24 * scale);
    const dy = Math.round(tileTopPx - 30 * scale);
    const dw = Math.round(r[2] * scale);
    const dh = Math.round(r[3] * scale);
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
