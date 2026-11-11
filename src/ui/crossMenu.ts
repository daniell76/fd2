import type { AssetManager } from '../engine/assets';
import { getTerrainInfo } from '../engine/tactical';
import { tr } from '../i18n';
import type { BattleUnit, ChapterData } from '../types';

export type CrossArmDir = 'top' | 'left' | 'right' | 'bottom';

export interface CrossArmOption {
  dir: CrossArmDir;
  iconId: number;
  state: 0 | 1 | 2; // 0 = normal, 1 = active/alt-toggle, 2 = disabled (red backing)
  labelZh: string;
  enabled: boolean;
  action: string;
}

export interface YesNoPromptState {
  tileX: number;
  tileY: number;
  speakerPortraitId: number; // e.g. `75` (`#75 米蘭`) for End Turn / Quit, `0` (`#0 索爾`) for Auto-AI
  speakerNameZh: string;
  promptZh: string;
  selected: 'yes' | 'no';
  onConfirmYes: () => void;
  onCancelNo: () => void;
}

/**
 * Authentic 1995 `FD2.EXE` (`fn_29724` & `FDOTHER[2]`) Animated 4-Way Cross Menu (`十字選單`)
 * & Tactical Corner Micro-HUD (`FDOTHER[5][130, 133..137]`).
 *
 * Supports both Keyboard (`ArrowUp/Left/Right/Down` + `Enter/Space` + `Escape`) AND Mouse hover/click!
 */
export class CrossMenuController {
  public visible = false;
  public tileX = 0;
  public tileY = 0;
  public openTimeMs = 0;
  public arms: CrossArmOption[] = [];
  public focusedDir: CrossArmDir = 'top';
  public yesNoPrompt: YesNoPromptState | null = null;

  private onSelectAction: ((action: string) => void) | null = null;
  private onCancelMenu: (() => void) | null = null;

  openCross(
    tileX: number,
    tileY: number,
    arms: CrossArmOption[],
    onSelect: (action: string) => void,
    onCancel: () => void,
    defaultDir?: CrossArmDir
  ): void {
    this.yesNoPrompt = null;
    this.visible = true;
    this.tileX = tileX;
    this.tileY = tileY;
    this.openTimeMs = performance.now();
    this.arms = arms;
    this.onSelectAction = onSelect;
    this.onCancelMenu = onCancel;

    const firstEnabled = arms.find((a) => a.enabled)?.dir ?? 'bottom';
    this.focusedDir =
      defaultDir && arms.find((a) => a.dir === defaultDir && a.enabled)
        ? defaultDir
        : firstEnabled;
  }

  openYesNo(prompt: YesNoPromptState): void {
    this.visible = false;
    this.yesNoPrompt = prompt;
    this.openTimeMs = performance.now();
  }

  close(): void {
    this.visible = false;
    this.yesNoPrompt = null;
    this.arms = [];
    this.onSelectAction = null;
    this.onCancelMenu = null;
  }

  isActive(): boolean {
    return this.visible || this.yesNoPrompt !== null;
  }

  /** Computes screen rectangles `[x, y, w, h]` for each of the 4 Cross Menu arms (or 2 Yes/No icons). */
  private getArmRects(
    ox: number,
    oy: number,
    tilePx: number,
    canvasW: number,
    canvasH: number,
    nowMs: number
  ): { dir: CrossArmDir; option: CrossArmOption; x: number; y: number; w: number; h: number }[] {
    // Expand smoothly over 110ms (4 steps of 6px in original 320x200)
    const elapsed = Math.max(0, nowMs - this.openTimeMs);
    const t = Math.min(1, elapsed / 110);

    const scale = Math.max(1.5, Math.min(2.5, tilePx / 24));
    const iw = Math.round(24 * scale);
    const ih = Math.round(20 * scale);

    // Center of target tile on canvas, clamped inside viewport so arms are never clipped off-screen!
    const rawCx = ox + (this.tileX + 0.5) * tilePx;
    const rawCy = oy + (this.tileY + 0.5) * tilePx;
    const marginX = iw * 1.7 + 12;
    const marginY = ih * 1.9 + 28;
    const cx = Math.max(marginX, Math.min(canvasW - marginX, rawCx));
    const cy = Math.max(marginY, Math.min(canvasH - marginY, rawCy));

    const distH = Math.round((tilePx * 0.52 + iw * 0.54) * t);
    const distV = Math.round((tilePx * 0.52 + ih * 0.56) * t);

    return this.arms.map((opt) => {
      let ax = cx - iw / 2;
      let ay = cy - ih / 2;
      if (opt.dir === 'top') ay -= distV;
      else if (opt.dir === 'bottom') ay += distV;
      else if (opt.dir === 'left') ax -= distH;
      else if (opt.dir === 'right') ax += distH;
      return { dir: opt.dir, option: opt, x: Math.round(ax), y: Math.round(ay), w: iw, h: ih };
    });
  }

  private getYesNoRects(
    ox: number,
    oy: number,
    tilePx: number,
    canvasW: number,
    canvasH: number
  ): { choice: 'yes' | 'no'; iconId: number; x: number; y: number; w: number; h: number }[] {
    if (!this.yesNoPrompt) return [];
    const scale = 2;
    const iw = 24 * scale;
    const ih = 20 * scale;
    const rawCx = ox + (this.yesNoPrompt.tileX + 0.5) * tilePx;
    const rawCy = oy + (this.yesNoPrompt.tileY + 0.5) * tilePx;
    const cx = Math.max(140, Math.min(canvasW - 140, rawCx));
    const cy = Math.max(120, Math.min(canvasH - 90, rawCy));

    return [
      { choice: 'yes', iconId: 16, x: Math.round(cx - iw - 10), y: Math.round(cy - ih / 2), w: iw, h: ih },
      { choice: 'no', iconId: 17, x: Math.round(cx + 10), y: Math.round(cy - ih / 2), w: iw, h: ih },
    ];
  }

  /** Handles mouse movement over canvas; returns `true` if hovering an arm. */
  handleMouseMove(
    canvasX: number,
    canvasY: number,
    ox: number,
    oy: number,
    tilePx: number,
    canvasW: number,
    canvasH: number,
    nowMs: number
  ): boolean {
    if (this.yesNoPrompt) {
      const rects = this.getYesNoRects(ox, oy, tilePx, canvasW, canvasH);
      for (const r of rects) {
        if (canvasX >= r.x && canvasX <= r.x + r.w && canvasY >= r.y && canvasY <= r.y + r.h) {
          this.yesNoPrompt.selected = r.choice;
          return true;
        }
      }
      return false;
    }

    if (!this.visible) return false;
    const rects = this.getArmRects(ox, oy, tilePx, canvasW, canvasH, nowMs);
    for (const r of rects) {
      if (canvasX >= r.x && canvasX <= r.x + r.w && canvasY >= r.y && canvasY <= r.y + r.h) {
        this.focusedDir = r.dir;
        return true;
      }
    }
    return false;
  }

  /** Handles mouse click on canvas; returns `true` if consumed by Cross Menu or Yes/No prompt. */
  handleMouseClick(
    canvasX: number,
    canvasY: number,
    ox: number,
    oy: number,
    tilePx: number,
    canvasW: number,
    canvasH: number,
    nowMs: number
  ): boolean {
    if (this.yesNoPrompt) {
      const rects = this.getYesNoRects(ox, oy, tilePx, canvasW, canvasH);
      for (const r of rects) {
        if (canvasX >= r.x && canvasX <= r.x + r.w && canvasY >= r.y && canvasY <= r.y + r.h) {
          const p = this.yesNoPrompt;
          this.close();
          if (r.choice === 'yes') p.onConfirmYes();
          else p.onCancelNo();
          return true;
        }
      }
      // Click outside cancels (`NO!`)
      const p = this.yesNoPrompt;
      this.close();
      p.onCancelNo();
      return true;
    }

    if (!this.visible) return false;
    const rects = this.getArmRects(ox, oy, tilePx, canvasW, canvasH, nowMs);
    for (const r of rects) {
      if (canvasX >= r.x && canvasX <= r.x + r.w && canvasY >= r.y && canvasY <= r.y + r.h) {
        this.focusedDir = r.dir;
        if (!r.option.enabled) return true;
        const cb = this.onSelectAction;
        const act = r.option.action;
        cb?.(act);
        return true;
      }
    }

    // Clicking outside the cross menu cancels back one step
    const cancelCb = this.onCancelMenu;
    cancelCb?.();
    return true;
  }

  /** Handles keyboard navigation (`ArrowUp/Down/Left/Right`, `Enter`/`Space`, `Escape`). */
  handleKeyDown(key: string): boolean {
    if (this.yesNoPrompt) {
      if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
        this.yesNoPrompt.selected = 'yes';
        return true;
      }
      if (key === 'ArrowRight' || key === 'd' || key === 'D') {
        this.yesNoPrompt.selected = 'no';
        return true;
      }
      if (key === 'Enter' || key === ' ') {
        const p = this.yesNoPrompt;
        this.close();
        if (p.selected === 'yes') p.onConfirmYes();
        else p.onCancelNo();
        return true;
      }
      if (key === 'Escape') {
        const p = this.yesNoPrompt;
        this.close();
        p.onCancelNo();
        return true;
      }
      return true;
    }

    if (!this.visible) return false;

    const dirMap: Record<string, CrossArmDir> = {
      ArrowUp: 'top',
      w: 'top',
      W: 'top',
      ArrowLeft: 'left',
      a: 'left',
      A: 'left',
      ArrowRight: 'right',
      d: 'right',
      D: 'right',
      ArrowDown: 'bottom',
      s: 'bottom',
      S: 'bottom',
    };

    if (key in dirMap) {
      this.focusedDir = dirMap[key];
      return true;
    }

    if (key === 'Enter' || key === ' ') {
      const opt = this.arms.find((a) => a.dir === this.focusedDir);
      if (opt && opt.enabled) {
        this.onSelectAction?.(opt.action);
      }
      return true;
    }

    if (key === 'Escape') {
      this.onCancelMenu?.();
      return true;
    }

    return false;
  }

  /** Renders the active 4-Way Cross Menu (`FDOTHER[2]`) or Yes/No Prompt (`[16 YES, 17 NO!]`) onto the Canvas! */
  render(
    ctx: CanvasRenderingContext2D,
    assets: AssetManager,
    ox: number,
    oy: number,
    tilePx: number,
    canvasW: number,
    canvasH: number,
    nowMs: number
  ): void {
    if (this.yesNoPrompt) {
      const p = this.yesNoPrompt;
      const rects = this.getYesNoRects(ox, oy, tilePx, canvasW, canvasH);
      if (rects.length < 2) return;

      // Draw `#75 米蘭` / `#0 索爾` prompt banner above the `[YES] [NO!]` icons!
      const bannerW = 256;
      const bannerH = 66;
      const bx = Math.max(12, Math.min(canvasW - bannerW - 12, Math.round((rects[0].x + rects[1].x + rects[1].w) / 2 - bannerW / 2)));
      const by = Math.max(10, rects[0].y - bannerH - 12);

      ctx.save();
      ctx.fillStyle = 'rgba(12, 17, 30, 0.95)';
      ctx.fillRect(bx, by, bannerW, bannerH);
      ctx.strokeStyle = '#d8af57';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, bannerW, bannerH);

      assets.drawPortrait(ctx, p.speakerPortraitId, Math.floor(nowMs / 180) % 2, bx + 6, by + 6, 54, 54);
      ctx.font = 'bold 13px "Noto Sans TC", sans-serif';
      ctx.fillStyle = '#f0c869';
      ctx.textAlign = 'left';
      ctx.fillText(p.speakerNameZh, bx + 68, by + 24);
      ctx.font = '12.5px "Noto Sans TC", sans-serif';
      ctx.fillStyle = '#f5efe2';
      ctx.fillText(p.promptZh, bx + 68, by + 46);

      for (const r of rects) {
        const isSel = p.selected === r.choice;
        ctx.fillStyle = 'rgba(5, 8, 16, 0.7)';
        ctx.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
        assets.drawCrossIcon(ctx, r.iconId, isSel ? 1 : 0, r.x, r.y, r.w / 24);
        if (isSel) {
          ctx.strokeStyle = '#ffd86b';
          ctx.lineWidth = 2;
          ctx.strokeRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
        }
      }
      ctx.restore();
      return;
    }

    if (!this.visible || this.arms.length === 0) return;

    const rects = this.getArmRects(ox, oy, tilePx, canvasW, canvasH, nowMs);
    ctx.save();

    for (const r of rects) {
      const isFocused = r.dir === this.focusedDir;
      const drawState: 0 | 1 | 2 = !r.option.enabled ? 2 : r.option.state === 1 ? 1 : isFocused ? 1 : 0;

      // crisp dark shadow behind each 24x20 icon
      ctx.fillStyle = 'rgba(5, 7, 13, 0.72)';
      ctx.fillRect(r.x + 2, r.y + 3, r.w, r.h);

      assets.drawCrossIcon(ctx, r.option.iconId, drawState, r.x, r.y, r.w / 24);

      if (isFocused) {
        const pulse = 0.7 + 0.3 * Math.sin(nowMs * 0.01);
        ctx.strokeStyle = r.option.enabled ? `rgba(255, 220, 108, ${pulse})` : 'rgba(245, 110, 100, 0.85)';
        ctx.lineWidth = 2;
        ctx.strokeRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
      }
    }

    // Draw crisp Chinese label pill for the currently focused arm below the cross!
    const focusedRect = rects.find((r) => r.dir === this.focusedDir);
    if (focusedRect) {
      const bottomY = Math.max(...rects.map((r) => r.y + r.h));
      const centerX = Math.round(rects.reduce((s, r) => s + r.x + r.w / 2, 0) / rects.length);
      const label = focusedRect.option.enabled
        ? focusedRect.option.labelZh
        : `${focusedRect.option.labelZh} (${tr('無法使用', '无法使用', 'Unavailable')})`;
      ctx.font = 'bold 12px "Noto Sans TC", sans-serif';
      const tw = Math.ceil(ctx.measureText(label).width) + 18;
      const lx = Math.max(8, Math.min(canvasW - tw - 8, Math.round(centerX - tw / 2)));
      const ly = Math.min(canvasH - 28, bottomY + 7);

      ctx.fillStyle = 'rgba(11, 15, 26, 0.92)';
      ctx.fillRect(lx, ly, tw, 22);
      ctx.strokeStyle = focusedRect.option.enabled ? '#d8af57' : '#a84a46';
      ctx.lineWidth = 1;
      ctx.strokeRect(lx + 0.5, ly + 0.5, tw - 1, 21);
      ctx.fillStyle = focusedRect.option.enabled ? '#fce192' : '#f28b84';
      ctx.textAlign = 'center';
      ctx.fillText(label, lx + tw / 2, ly + 15);
    }

    ctx.restore();
  }
}

/**
 * Renders the authentic `FD2.EXE` (`FDOTHER[5][130]`) Bottom-Left Tactical Terrain Micro-HUD
 * (`69x34` scaled 2x -> `138x68`: live 24x24 terrain tile preview on left + `AP% / DP%` bonus on right)!
 */
export function renderTacticalCornerHud(
  ctx: CanvasRenderingContext2D,
  assets: AssetManager,
  chapter: ChapterData,
  tilesetImg: HTMLImageElement,
  hoverX: number,
  hoverY: number,
  hoveredUnit: BattleUnit | undefined,
  canvasW: number,
  canvasH: number
): void {
  const cell = chapter.cells[hoverY]?.[hoverX];
  if (!cell) return;
  const tinfo = getTerrainInfo(chapter, hoverX, hoverY);

  const scale = 2;
  const hx = 14;
  const hy = canvasH - 34 * scale - 14;

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // 1. Draw `FDOTHER[5][130]` (`69x34` -> `138x68`) Corner Terrain Micro-HUD backing
  const [hudW] = assets.drawTacticalUiSprite(ctx, 130, hx, hy, scale);
  if (hudW > 0) {
    // Blit exact 24x24 terrain tile into the left inset window (`+5, +5`)!
    const tid = cell[0];
    const tsCols = chapter.tileset.cols;
    const sx = (tid % tsCols) * 24;
    const sy = Math.floor(tid / tsCols) * 24;
    ctx.drawImage(tilesetImg, sx, sy, 24, 24, hx + 5 * scale, hy + 5 * scale, 24 * scale, 24 * scale);

    // Draw crisp AP% and DP% modifiers in the right slots of `FDOTHER[5][130]`
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    const apStr = `${tinfo.apBonus >= 0 ? '+' : ''}${tinfo.apBonus}%`;
    const dpStr = `${tinfo.defBonus >= 0 ? '+' : ''}${tinfo.defBonus}%`;
    ctx.fillStyle = tinfo.apBonus > 0 ? '#78e8a8' : tinfo.apBonus < 0 ? '#ff8b80' : '#f5efe2';
    ctx.fillText(apStr, hx + 65 * scale, hy + 14 * scale);
    ctx.fillStyle = tinfo.defBonus > 0 ? '#78e8a8' : tinfo.defBonus < 0 ? '#ff8b80' : '#f5efe2';
    ctx.fillText(dpStr, hx + 65 * scale, hy + 28 * scale);
  }

  // 2. If hovering a unit on the map, show a compact FD2 status pill right beside the terrain box
  if (hoveredUnit && hoveredUnit.hp > 0 && !hoveredUnit.hidden && canvasW > 520) {
    const ux = hx + 148;
    const uy = hy + 10;
    const uw = 216;
    const uh = 56;
    ctx.fillStyle = 'rgba(11, 16, 28, 0.90)';
    ctx.fillRect(ux, uy, uw, uh);
    ctx.strokeStyle =
      hoveredUnit.faction === 'player'
        ? '#4eaef5'
        : hoveredUnit.faction === 'ally'
          ? '#55d896'
          : '#e85d54';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(ux, uy, uw, uh);

    assets.drawGlyphs(ctx, hoveredUnit.nameGlyphs, ux + 8, uy + 6, 'gold', 1, true, hoveredUnit.nameZh);
    ctx.font = 'bold 11.5px "JetBrains Mono", monospace';
    ctx.fillStyle = '#d5deef';
    ctx.textAlign = 'right';
    ctx.fillText(`Lv.${hoveredUnit.level}`, ux + uw - 8, uy + 19);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd56b';
    ctx.fillText(`HP ${hoveredUnit.hp}/${hoveredUnit.maxHp}`, ux + 8, uy + 42);
    ctx.fillStyle = '#7cd2ff';
    ctx.textAlign = 'right';
    ctx.fillText(`MP ${hoveredUnit.mp}/${hoveredUnit.maxMp}`, ux + uw - 8, uy + 42);
  }

  ctx.restore();
}
