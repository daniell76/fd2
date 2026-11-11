import './style.css';
import { SoundEngine } from './audio/soundEngine';
import { AssetManager } from './engine/assets';
import {
  ScenarioDirector,
  type ActiveLightningFx,
  type ActiveSparkleFx,
  type ActiveSpecialStripFx,
} from './engine/director';
import {
  applyExpAndCheckLevelUp,
  areHostile,
  buildPartyForChapter,
  canUnitAttack,
  canUnitEquipItem,
  chooseAiAction,
  computeReachableTiles,
  coordKey,
  evaluateChapterBattleStatus,
  getAttackableCoordinates,
  getEquippedStats,
  getItemEquivalentSpellId,
  getSpellBlastTiles,
  getSpellCastCoordinates,
  getTerrainInfo,
  getUnitClassLabel,
  getUnitEffectiveExpLevel,
  getValidTeleportDestinationTiles,
  initChapterSlots,
  isItemUsableInBattle,
  isUnitActiveOnMap,
  isUnitRenderedOnMap,
  manhattan,
  predictCombat,
  reconstructPath,
  resolveAreaItemUse,
  resolveCombat,
  resolveSpellCast,
  syncUnitEquipmentIndices,
  useConsumable,
  type MoveNode,
} from './engine/tactical';
import type {
  BattleUnit,
  ChapterData,
  DialogueSegment,
  LevelUpGain,
  PartyMemberSave,
  SaveSlotData,
  SpellDef,
} from './types';
import {
  SUPPORTED_LOCALES,
  applyLocaleToGameState,
  getLocale,
  getLocalizedChapterLose,
  getLocalizedChapterWin,
  getLocalizedUnitName,
  setLocale,
  tr,
  type LocaleCode,
} from './i18n';
import { CrossMenuController, renderTacticalCornerHud, type CrossArmOption } from './ui/crossMenu';
import { CutscenePlayer } from './ui/cutscene';
import { ModalController, loadAutoSaveSlot, markChapterCleared, saveAutoSaveSlot } from './ui/modals';

type UiState =
  | 'idle'
  | 'unit_selected'
  | 'unit_cross'
  | 'item_sub_cross'
  | 'empty_cross'
  | 'system_sub_cross'
  | 'settings_sub_cross'
  | 'targeting_attack'
  | 'choosing_spell'
  | 'targeting_spell'
  | 'choosing_item_list'
  | 'targeting_use_item'
  | 'targeting_give_ally'
  | 'targeting_teleport_dest'
  | 'busy';

class FlameDragonWebApp {
  private assets = new AssetManager();
  private sound = new SoundEngine();
  private cutscene!: CutscenePlayer;
  private modals!: ModalController;
  private director!: ScenarioDirector;
  private crossMenu = new CrossMenuController();

  // Persistent Campaign State (`FD2.EXE` New Game starts with `0 G` and `[#0 索爾, #9 悠妮, #4 亞雷斯, #30 蓋亞]`)
  private currentChapterId = 0;
  private gold = 0;
  private party: PartyMemberSave[] = [];

  // Active Battlefield State (`slots[0..95]` deterministic slot indexing)
  private chapter: ChapterData | null = null;
  private tilesetImg: HTMLImageElement | null = null;
  private slots: (BattleUnit | null)[] = [];
  private nextSlotIndex = 0;
  private openedChests = new Set<string>();
  private triggeredEvents = new Set<string>();
  private turn = 1;
  private phase: 'player' | 'ally' | 'enemy' = 'player';
  private uiState: UiState = 'idle';
  private showHpBarsOnMap = true;
  private sfxEnabled = true;

  // Selection & Tactical Overlays
  private selectedUnit: BattleUnit | null = null;
  private moveOrigin: [number, number] | null = null;
  private moveOriginDir: 0 | 1 | 2 | 3 = 0;
  private lastWalkPath: [number, number][] = [];
  private reachableMap = new Map<string, MoveNode>();
  private targetTiles = new Set<string>();
  private activeSpell: SpellDef | null = null;
  private pendingUseItemBagIdx: number | null = null;
  private pendingGiveItemBagIdx: number | null = null;
  private pendingTeleportTargetUnit: BattleUnit | null = null;
  private pendingTeleportFromItemBagIdx: number | null = null;
  private hoverTile: [number, number] = [0, 0];

  // Directing & Map Visual FX Overlays
  private mapFlashes: { x: number; y: number; color: string; startMs: number; durMs: number; text?: string }[] = [];
  private sparkleOverlays: ActiveSparkleFx[] = [];
  private explosionOverlays: { x: number; y: number; frameIdx: number }[] = [];
  private mapSpellFxOverlays: { x: number; y: number; frameId: number }[] = [];
  private mapPopupOverlays: { x: number; y: number; yOffsetNativePx: number; kind: 'damage' | 'heal' | 'miss'; amount: number }[] = [];
  private lightningOverlay: ActiveLightningFx | null = null;
  private specialStripOverlay: ActiveSpecialStripFx | null = null;
  private screenShake: [number, number] = [0, 0];
  private screenFlashColor = '#ffffff';
  private screenFlashAlpha = 0;

  // Camera (`camTilePos` tracks the exact `FD2.EXE` `13 × 8` viewport top-left `(GLOBAL_2_15017, GLOBAL_2_15021)` for `isCutsceneMap`!)
  private camX = 0;
  private camY = 0;
  private cutsceneCamTopLeft: [number, number] = [0, 0];
  private zoom = 2; // 2x => 48px tiles
  private isDragging = false;
  private dragMoved = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private camStartX = 0;
  private camStartY = 0;

  // DOM Elements
  private titleScreenEl!: HTMLElement;
  private titleCanvas!: HTMLCanvasElement;
  private battleCanvas!: HTMLCanvasElement;
  private battleCtx!: CanvasRenderingContext2D;
  private subPopupEl!: HTMLElement;
  private forecastEl!: HTMLElement;
  private turnBannerEl!: HTMLElement;
  private battleLogEl!: HTMLElement;

  /** Returns all currently alive, non-hidden battlefield units in deterministic slot order. */
  private get activeUnits(): BattleUnit[] {
    return this.slots.filter(isUnitActiveOnMap);
  }

  /**
   * Returns all battlefield units currently visible on the tactical map (`!u.hidden`),
   * including `u.hp <= 0` units awaiting `fn_56165` clockwise spin + 12-frame explosion!
   */
  private get renderedUnits(): BattleUnit[] {
    return this.slots.filter(isUnitRenderedOnMap);
  }

  async mount(root: HTMLElement): Promise<void> {
    const langButtonsHtml = SUPPORTED_LOCALES.map(
      (loc) =>
        `<button class="btn btn-sm ${getLocale() === loc.code ? 'btn-gold' : ''}" data-set-locale="${loc.code}" type="button" title="${loc.label}" style="padding:3px 8px; font-size:11.5px;">${loc.shortLabel}</button>`
    ).join('');

    root.innerHTML = `
      <!-- Title Screen -->
      <section class="title-screen" id="title-screen" aria-label="Title Screen">
        <div class="title-heading-group">
          <h1 id="title-main-h1">炎龍騎士團II · 黃金城之謎</h1>
          <p class="title-subtitle" id="title-subtitle-p">Flame Dragon II: Legend of Golden Castle — Authentic 1995 DOS Engine & Directing Edition</p>
          <div style="display:flex; justify-content:center; align-items:center; gap:6px; margin-top:8px;">
            <span id="title-lang-label" style="font-size:11.5px; color:var(--ink-300);">語言 / Language:</span>
            ${langButtonsHtml}
          </div>
        </div>

        <div class="title-art-frame">
          <canvas id="title-canvas" class="pixel-crisp" width="320" height="200"></canvas>
        </div>

        <nav class="title-menu" aria-label="Main Menu">
          <button class="btn btn-gold" id="btn-new-game" type="button">新的傳奇 · New Legend</button>
          <button class="btn" id="btn-continue-game" type="button">再續前緣 · Continue</button>
          <button class="btn" id="btn-chapter-select" type="button">戰場回憶 · Chapter Select</button>
          <button class="btn" id="btn-open-codex" type="button">炎龍圖鑑 · Codex</button>
          <a class="btn btn-gold" href="./gallery.html" id="btn-asset-gallery" style="text-decoration:none; text-align:center;">角色與圖像驗證 · Asset Gallery</a>
        </nav>
      </section>

      <!-- Top Tactical Command Bar -->
      <header class="top-bar">
        <div class="brand-group">
          <div class="brand-crest">
            <img src="./favicon.ico" width="20" height="20" class="pixel-crisp" alt="Flame Dragon Crest" />
          </div>
          <span class="brand-title" id="brand-title-text">炎龍騎士團II</span>
          <div class="chapter-badge" id="hud-chapter-badge">第 1 章</div>
        </div>

        <div class="turn-status">
          <span id="hud-turn-counter">TURN 1</span>
          <span class="phase-indicator player" id="hud-phase-pill">PLAYER PHASE</span>
          <span style="color: var(--gold-300);" id="hud-gold-label">0 G</span>
        </div>

        <div class="toolbar-actions">
          <button class="btn btn-sm" id="btn-next-hero" type="button" title="定位下一位未行動隊員 (Tab)">下一隊員</button>
          <button class="btn btn-sm" id="btn-situation-top" type="button" title="開啟戰況一覽">戰況</button>
          <button class="btn btn-sm btn-gold" id="btn-end-turn" type="button" title="結束回合 (E)">回合結束</button>
          <button class="btn btn-sm" id="btn-anim-speed" type="button">動畫: 1x</button>
          <button class="btn btn-sm" id="btn-bgm-toggle" type="button">音樂: 開</button>
          <button class="btn btn-sm" id="btn-save-load" type="button">存取進度</button>
          <button class="btn btn-sm" id="btn-chapters-top" type="button">選關</button>
          <div style="display:inline-flex; gap:3px; align-items:center; padding-left:4px; border-left:1px solid var(--border-subtle);">
            ${langButtonsHtml}
          </div>
          <a class="btn btn-sm btn-gold" id="btn-gallery-top" href="./gallery.html" style="text-decoration:none;">圖像驗證</a>
        </div>
      </header>

      <!-- Main Tactical Stage + Right Inspector -->
      <main class="workspace">
        <div class="viewport-stage" id="viewport-stage">
          <canvas id="battle-canvas" class="pixel-crisp"></canvas>

          <div class="forecast-card hidden" id="forecast-card"></div>
          <!-- Floating FD2 Blue Beveled Sub-List Popup (for Spells & 8-Slot Inventory Selection from Cross Menu) -->
          <div class="action-dock hidden" id="action-dock"></div>

          <div class="camera-controls">
            <button class="btn btn-sm" id="btn-zoom-out" type="button" aria-label="Zoom Out">−</button>
            <span id="hud-zoom-label" style="font-family:var(--font-mono); font-size:11px; padding:0 6px;">2.0×</span>
            <button class="btn btn-sm" id="btn-zoom-in" type="button" aria-label="Zoom In">+</button>
            <button class="btn btn-sm" id="btn-center-cam" type="button">置中</button>
          </div>
        </div>

        <aside class="inspector-sidebar" aria-label="Tactical Inspector">
          <div class="panel-section" id="unit-inspector-panel">
            <div class="panel-heading">
              <span id="heading-unit-status">單位狀態 · STATUS</span>
              <span id="inspector-faction-tag" style="font-family:var(--font-mono); font-size:10.5px;">—</span>
            </div>
            <div id="unit-inspector-body" style="color:var(--ink-400); font-size:12.5px;">
              點選我軍開啟十字選單（攻擊 / 法術 / 道具 / 休息）；點選空白格開啟戰場系統十字選單（戰況 / 委任 / 設定 / 回合結束）。
            </div>
          </div>

          <div class="panel-section">
            <div class="panel-heading">
              <span id="heading-terrain-goal">地形與戰場目標</span>
              <span id="terrain-coords" style="font-family:var(--font-mono); font-size:11px; color:var(--ink-400);">(0, 0)</span>
            </div>
            <div id="terrain-info-body" style="font-size:12.5px; color:var(--ink-200);"></div>
          </div>

          <div class="panel-section" style="flex:1; display:flex; flex-direction:column; min-height:140px;">
            <div class="panel-heading"><span id="heading-chronicle">戰場紀錄 · CHRONICLE</span></div>
            <div class="battle-log" id="battle-log"></div>
          </div>
        </aside>
      </main>

      <!-- Turn Transition Banner -->
      <div class="turn-banner hidden" id="turn-banner">PLAYER PHASE</div>

      <!-- 320x200 Cutaway Combat Viewport -->
      <div class="overlay-backdrop hidden" id="cutscene-backdrop">
        <div class="cutscene-window">
          <canvas id="cutscene-canvas" class="pixel-crisp" width="320" height="200"></canvas>
          <div class="cutscene-footer">
            <span id="cutscene-window-title" style="font-size:12px; color:var(--ink-200);">炎龍騎士團II 戰鬥動畫視窗</span>
            <button class="btn btn-sm" id="btn-skip-cutscene" type="button">略過戰鬥動畫</button>
          </div>
        </div>
      </div>

      <!-- Talking Portrait Story Dialogue Box -->
      <div class="dialogue-overlay hidden" id="dialogue-overlay">
        <div class="dialogue-box">
          <div class="portrait-frame">
            <canvas id="dialogue-portrait" class="pixel-crisp" width="80" height="80"></canvas>
          </div>
          <div class="dialogue-content">
            <div id="dialogue-speaker"></div>
            <div class="dialogue-lines" id="dialogue-lines"></div>
            <div class="dialogue-footer">
              <span id="dialogue-progress">點擊或按空白鍵繼續</span>
              <button class="btn btn-sm" id="btn-skip-dialogue" type="button">略過對話 / 演出</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Multi-Purpose Modal (Camp, Situation, Chapter Select, Save/Load, Ending, Codex) -->
      <div class="overlay-backdrop hidden" id="modal-backdrop">
        <div class="modal-card" role="dialog" aria-modal="true">
          <div class="modal-header">
            <h2 id="modal-title">Chronicle</h2>
            <button class="btn btn-sm" id="btn-close-modal" type="button">關閉</button>
          </div>
          <div class="modal-tabs" id="modal-tabs"></div>
          <div class="modal-body" id="modal-body"></div>
        </div>
      </div>
    `;

    this.titleScreenEl = document.getElementById('title-screen')!;
    this.titleCanvas = document.getElementById('title-canvas') as HTMLCanvasElement;
    this.battleCanvas = document.getElementById('battle-canvas') as HTMLCanvasElement;
    this.battleCtx = this.battleCanvas.getContext('2d')!;
    this.subPopupEl = document.getElementById('action-dock')!;
    this.forecastEl = document.getElementById('forecast-card')!;
    this.turnBannerEl = document.getElementById('turn-banner')!;
    this.battleLogEl = document.getElementById('battle-log')!;

    await this.assets.init();
    this.sound.setTracks(this.assets.musicTracks);
    if (this.assets.sfxBanks) {
      this.sound.setSfxBanks(this.assets.sfxBanks);
    }
    this.cutscene = new CutscenePlayer(this.assets, this.sound);
    this.modals = new ModalController(
      this.assets,
      this.sound,
      document.getElementById('modal-backdrop')!,
      document.getElementById('modal-title')!,
      document.getElementById('modal-tabs')!,
      document.getElementById('modal-body')!,
      document.getElementById('btn-close-modal') as HTMLButtonElement
    );

    this.director = new ScenarioDirector({
      assets: this.assets,
      sound: this.sound,
      getChapter: () => this.chapter,
      getSlots: () => this.slots,
      getNextSlotIndex: () => this.nextSlotIndex,
      setNextSlotIndex: (idx) => {
        this.nextSlotIndex = idx;
      },
      getParty: () => this.party,
      setParty: (p) => {
        this.party = p;
      },
      getGold: () => this.gold,
      setGold: (g) => {
        this.gold = g;
        this.updateTopHud();
      },
      getTurn: () => this.turn,
      loadMapForDirecting: (cid) => this.loadMapOnly(cid),
      panCameraSmooth: (tx, ty, dur) => this.panCameraSmoothToTile(tx, ty, dur),
      snapCameraToTile: (tx, ty) => this.centerCameraOnTile(tx, ty),
      setCameraTopLeft: (tlX, tlY) => this.setCameraTopLeft(tlX, tlY),
      panCameraTopLeft: (tlX, tlY, dur) => this.panCameraTopLeft(tlX, tlY, dur),
      getCameraTopLeft: () => this.getCameraTopLeft(),
      stepCameraTopLeft: (tlX, tlY) => this.setCameraTopLeftFractional(tlX, tlY),
      fadeScreen: (color, toAlpha, dur) => this.fadeScreenTo(color, toAlpha, dur),
      setScreenShake: (ox, oy) => {
        this.screenShake = [ox, oy];
      },
      setScreenFlashAlpha: (color, alpha) => {
        this.screenFlashColor = color;
        this.screenFlashAlpha = alpha;
      },
      setSparkleOverlays: (sp) => {
        this.sparkleOverlays = sp;
      },
      setLightningOverlay: (fx) => {
        this.lightningOverlay = fx;
      },
      setSpecialStripOverlay: (fx) => {
        this.specialStripOverlay = fx;
      },
      playDialogueIndex: (idx) => this.playDialogueByIndex(idx),
      playScriptedCutawayDuel: (aSlot, dSlot) => this.runScriptedDuel(aSlot, dSlot),
      playDyingUnitsOnMapAnim: () => this.playDyingUnitsOnMapAnim(),
      logMessage: (html) => this.logMessage(html),
      updateHud: () => this.updateTopHud(),
    });

    const contBtn = document.getElementById('btn-continue-game') as HTMLButtonElement;
    contBtn.disabled = !ModalController.hasAnySave();

    this.bindUiEvents();
    this.refreshLocaleUi();
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());

    requestAnimationFrame((t) => this.frameLoop(t));
  }

  private refreshLocaleUi(): void {
    const loc = getLocale();
    document.querySelectorAll<HTMLButtonElement>('[data-set-locale]').forEach((btn) => {
      if (btn.dataset.setLocale === loc) {
        btn.classList.add('btn-gold');
      } else {
        btn.classList.remove('btn-gold');
      }
    });

    applyLocaleToGameState(
      this.assets.gameData,
      this.chapter,
      this.slots.filter((u): u is BattleUnit => u !== null),
      this.party
    );

    const setTxt = (id: string, text: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setTxt('title-main-h1', tr('炎龍騎士團II · 黃金城之謎', '炎龙骑士团II · 黄金城之谜', 'Flame Dragon II: Legend of Golden Castle'));
    setTxt(
      'title-subtitle-p',
      tr(
        'Flame Dragon II: Legend of Golden Castle — Authentic 1995 DOS Engine & Directing Edition',
        '炎龙骑士团II：黄金城之谜 — 1995 DOS 原版引擎与演出忠实重制版',
        'Flame Dragon II: Legend of Golden Castle — Authentic 1995 DOS Engine & Directing Edition'
      )
    );
    setTxt('title-lang-label', tr('語言 / Language:', '语言 / Language:', 'Language:'));
    setTxt('btn-new-game', tr('新的傳奇 · New Legend', '新的传奇 · New Legend', 'New Legend (New Game)'));
    setTxt('btn-continue-game', tr('再續前緣 · Continue', '再续前缘 · Continue', 'Continue / Load Save'));
    setTxt('btn-chapter-select', tr('戰場回憶 · Chapter Select', '战场回忆 · Chapter Select', 'Chapter Select'));
    setTxt('btn-open-codex', tr('炎龍圖鑑 · Codex', '炎龙图鉴 · Codex', 'Encyclopedia / Codex'));
    setTxt('btn-asset-gallery', tr('角色與圖像驗證 · Asset Gallery', '角色与图像验证 · Asset Gallery', 'Character & Asset Gallery'));

    setTxt('brand-title-text', tr('炎龍騎士團II', '炎龙骑士团II', 'Flame Dragon II'));
    setTxt('btn-next-hero', tr('下一隊員', '下一队员', 'Next Hero'));
    setTxt('btn-situation-top', tr('戰況', '战况', 'Overview'));
    setTxt('btn-end-turn', tr('回合結束', '回合结束', 'End Turn'));

    const rawSpeed = this.cutscene.getSpeedLabel().replace('Anim: ', '');
    setTxt('btn-anim-speed', `${tr('動畫', '动画', 'Anim')}: ${rawSpeed}`);
    setTxt('btn-bgm-toggle', `${tr('音樂', '音乐', 'BGM')}: ${this.sound.isMuted() ? tr('關', '关', 'Off') : tr('開', '开', 'On')}`);
    setTxt('btn-save-load', tr('存取進度', '存取进度', 'Save / Load'));
    setTxt('btn-chapters-top', tr('選關', '选关', 'Chapters'));
    setTxt('btn-gallery-top', tr('圖像驗證', '图像验证', 'Gallery'));
    setTxt('btn-center-cam', tr('置中', '居中', 'Center'));

    setTxt('heading-unit-status', tr('單位狀態 · STATUS', '单位状态 · STATUS', 'UNIT STATUS'));
    setTxt('heading-terrain-goal', tr('地形與戰場目標', '地形与战场目标', 'TERRAIN & OBJECTIVES'));
    setTxt('heading-chronicle', tr('戰場紀錄 · CHRONICLE', '战场纪录 · CHRONICLE', 'BATTLE CHRONICLE'));
    setTxt('cutscene-window-title', tr('炎龍騎士團II 戰鬥動畫視窗', '炎龙骑士团II 战斗动画视窗', 'Flame Dragon II Combat Animation'));
    setTxt('btn-skip-cutscene', tr('略過戰鬥動畫', '跳过战斗动画', 'Skip Combat Anim'));
    setTxt('dialogue-progress', tr('點擊或按空白鍵繼續', '点击或按空格键继续', 'Click or Press Space to Continue'));
    setTxt('btn-skip-dialogue', tr('略過對話 / 演出', '跳过对话 / 演出', 'Skip Cutscene'));
    setTxt('btn-close-modal', tr('關閉', '关闭', 'Close'));

    document.title = tr(
      '炎龍騎士團II：黃金城之謎 — Web Tactical Edition',
      '炎龙骑士团II：黄金城之谜 — Web Tactical Edition',
      'Flame Dragon II: Legend of Golden Castle — Web Tactical Edition'
    );
    const setAttrTitle = (id: string, text: string) => {
      const el = document.getElementById(id);
      if (el) el.title = text;
    };
    setAttrTitle('btn-next-hero', tr('切換至下一名尚未行動的我軍隊員 (Tab)', '切换至下一名尚未行动的我军队员 (Tab)', 'Focus next unacted hero (Tab)'));
    setAttrTitle('btn-situation-top', tr('開啟戰況一覽 (S)', '开启战况一览 (S)', 'Open Battle Situation Overview (S)'));
    setAttrTitle('btn-end-turn', tr('結束我軍回合 (E)', '结束我军回合 (E)', 'End Player Turn (E)'));

    this.modals.refreshIfOpen();
    if (this.uiState === 'choosing_spell' && this.selectedUnit) {
      this.openSpellBookPopup(this.selectedUnit);
    }

    const hoveredUnit = this.activeUnits.find((u) => u.x === this.hoverTile[0] && u.y === this.hoverTile[1]);
    const unitToInspect = this.selectedUnit ?? hoveredUnit ?? this.activeUnits.find((u) => u.faction === 'player') ?? null;
    if (unitToInspect) {
      this.updateInspectorPanel(unitToInspect);
    } else {
      const bodyEl = document.getElementById('unit-inspector-body');
      if (bodyEl) {
        bodyEl.textContent = tr(
          '點選我軍開啟十字選單（攻擊 / 法術 / 道具 / 休息）；點選空白格開啟戰場系統十字選單（戰況 / 委任 / 設定 / 回合結束）。',
          '点选我军开启十字选单（攻击 / 法术 / 道具 / 休息）；点选空白格开启战场系统十字选单（战况 / 委任 / 设定 / 回合结束）。',
          'Click a hero to open the 4-Way Cross Menu (Attack / Magic / Items / Rest); click an empty tile for the System Cross Menu.'
        );
      }
    }

    if (this.chapter) {
      this.updateTopHud();
      this.updateTerrainPanel(this.hoverTile[0], this.hoverTile[1]);
    } else {
      const badge = document.getElementById('hud-chapter-badge');
      if (badge) badge.textContent = tr('第 1 章', '第 1 章', 'Ch. 1');
    }
  }

  private playUiSfx(kind: Parameters<SoundEngine['playSfx']>[0]): void {
    if (this.sfxEnabled) this.sound.playSfx(kind);
  }

  private bindUiEvents(): void {
    // Language Switcher Buttons (Title Screen & Top Toolbar)
    document.querySelectorAll<HTMLButtonElement>('[data-set-locale]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const code = btn.dataset.setLocale as LocaleCode;
        if (!code) return;
        this.playUiSfx('cursor');
        setLocale(code);
        this.refreshLocaleUi();
      });
    });

    // Title Menu
    document.getElementById('btn-new-game')!.addEventListener('click', () => {
      this.playUiSfx('confirm');
      void this.startNewLegendWithPrologue();
    });

    document.getElementById('btn-continue-game')!.addEventListener('click', () => {
      this.modals.openSaveLoadModal('load', null, (save) => {
        void this.loadFromSaveData(save);
      });
    });

    document.getElementById('btn-chapter-select')!.addEventListener('click', () => {
      this.modals.openChapterSelect((cid, useCampaignParty) => {
        void this.startChapterReplay(cid, useCampaignParty);
      }, this.party.length > 0);
    });

    document.getElementById('btn-open-codex')!.addEventListener('click', () => {
      this.modals.openCodex();
    });

    // Skip dialogue also fast-forwards active choreography/directing!
    document.getElementById('btn-skip-dialogue')!.addEventListener('click', () => {
      this.director.requestSkip();
    });

    // Top Toolbar
    document.getElementById('btn-next-hero')!.addEventListener('click', () => this.focusNextReadyHero());
    document.getElementById('btn-situation-top')!.addEventListener('click', () => {
      if (this.chapter && this.uiState !== 'busy') {
        this.modals.openBattleSituationModal(this.chapter, this.turn, this.gold, this.activeUnits, (u) => {
          this.centerCameraOnTile(u.x, u.y);
          this.updateInspectorPanel(u);
        });
      }
    });

    document.getElementById('btn-end-turn')!.addEventListener('click', () => {
      if (this.phase === 'player' && this.uiState !== 'busy') {
        this.promptEndTurnWithMilan(this.hoverTile[0], this.hoverTile[1]);
      }
    });

    const speedBtn = document.getElementById('btn-anim-speed')!;
    speedBtn.addEventListener('click', () => {
      const rawSpeed = this.cutscene.cycleSpeed().replace('Anim: ', '');
      speedBtn.textContent = `${tr('動畫', '动画', 'Anim')}: ${rawSpeed}`;
      this.playUiSfx('cursor');
    });

    const bgmBtn = document.getElementById('btn-bgm-toggle')!;
    bgmBtn.addEventListener('click', () => {
      const muted = this.sound.toggleMute();
      bgmBtn.textContent = `${tr('音樂', '音乐', 'BGM')}: ${muted ? tr('關', '关', 'Off') : tr('開', '开', 'On')}`;
    });

    document.getElementById('btn-save-load')!.addEventListener('click', () => {
      if (this.uiState === 'busy') return;
      this.modals.openSaveLoadModal(
        'save',
        () => this.snapshotSaveData(),
        (save) => void this.loadFromSaveData(save)
      );
    });

    document.getElementById('btn-chapters-top')!.addEventListener('click', () => {
      if (this.uiState === 'busy') return;
      this.modals.openChapterSelect((cid, useCampaignParty) => void this.startChapterReplay(cid, useCampaignParty), this.party.length > 0);
    });

    // Zoom & Camera
    document.getElementById('btn-zoom-in')!.addEventListener('click', () => this.adjustZoom(0.5));
    document.getElementById('btn-zoom-out')!.addEventListener('click', () => this.adjustZoom(-0.5));
    document.getElementById('btn-center-cam')!.addEventListener('click', () => this.centerCameraOnParty());

    // Canvas Mouse & Touch Controls
    const stage = document.getElementById('viewport-stage')!;
    stage.addEventListener('mousedown', (ev) => {
      if (ev.button === 2) {
        ev.preventDefault();
        this.handleRightClickCancel();
        return;
      }
      if (ev.button !== 0 || (ev.target as HTMLElement) !== this.battleCanvas) return;
      this.isDragging = true;
      this.dragMoved = false;
      this.dragStartX = ev.clientX;
      this.dragStartY = ev.clientY;
      this.camStartX = this.camX;
      this.camStartY = this.camY;
    });

    stage.addEventListener('contextmenu', (ev) => ev.preventDefault());

    window.addEventListener('mousemove', (ev) => {
      if (this.isDragging) {
        const dx = ev.clientX - this.dragStartX;
        const dy = ev.clientY - this.dragStartY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) this.dragMoved = true;
        if (this.dragMoved && !this.crossMenu.isActive()) {
          this.camX = this.camStartX - dx;
          this.camY = this.camStartY - dy;
          this.clampCamera();
        }
      }
      if ((ev.target as HTMLElement) === this.battleCanvas) {
        if (this.crossMenu.isActive()) {
          const rect = this.battleCanvas.getBoundingClientRect();
          const cx = ev.clientX - rect.left;
          const cy = ev.clientY - rect.top;
          const tilePx = Math.round(24 * this.zoom);
          this.crossMenu.handleMouseMove(
            cx,
            cy,
            -Math.round(this.camX),
            -Math.round(this.camY),
            tilePx,
            this.battleCanvas.width,
            this.battleCanvas.height,
            performance.now()
          );
        } else {
          this.updateHoverTileFromMouse(ev.clientX, ev.clientY);
        }
      }
    });

    window.addEventListener('mouseup', (ev) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      if (!this.dragMoved && (ev.target as HTMLElement) === this.battleCanvas) {
        const rect = this.battleCanvas.getBoundingClientRect();
        const cx = ev.clientX - rect.left;
        const cy = ev.clientY - rect.top;
        const tilePx = Math.round(24 * this.zoom);

        if (this.crossMenu.isActive()) {
          const handled = this.crossMenu.handleMouseClick(
            cx,
            cy,
            -Math.round(this.camX),
            -Math.round(this.camY),
            tilePx,
            this.battleCanvas.width,
            this.battleCanvas.height,
            performance.now()
          );
          if (handled) return;
        }

        this.updateHoverTileFromMouse(ev.clientX, ev.clientY);
        void this.handleTileClick(this.hoverTile[0], this.hoverTile[1]);
      }
    });

    stage.addEventListener(
      'wheel',
      (ev) => {
        ev.preventDefault();
        if (!this.crossMenu.isActive()) {
          this.adjustZoom(ev.deltaY < 0 ? 0.25 : -0.25);
        }
      },
      { passive: false }
    );

    // Keyboard Shortcuts (Cross Menu navigation + Map cursor/camera)
    window.addEventListener('keydown', (ev) => {
      if (!this.titleScreenEl.classList.contains('hidden')) return;
      if (!document.getElementById('modal-backdrop')!.classList.contains('hidden')) return;
      if (!document.getElementById('dialogue-overlay')!.classList.contains('hidden')) return;

      if (this.crossMenu.isActive()) {
        if (this.crossMenu.handleKeyDown(ev.key)) {
          ev.preventDefault();
          this.playUiSfx('cursor');
          return;
        }
      }

      if (!this.subPopupEl.classList.contains('hidden')) {
        const items = Array.from(this.subPopupEl.querySelectorAll<HTMLButtonElement>('.dos-popup-item:not(:disabled)'));
        if (items.length > 0) {
          let curIdx = items.findIndex((b) => b.classList.contains('focused'));
          if (curIdx < 0) curIdx = 0;
          if (ev.key === 'ArrowUp' || ev.key === 'w' || ev.key === 'W') {
            ev.preventDefault();
            items.forEach((b) => b.classList.remove('focused'));
            const next = items[(curIdx - 1 + items.length) % items.length];
            next.classList.add('focused');
            next.scrollIntoView({ block: 'nearest' });
            this.playUiSfx('cursor');
            return;
          }
          if (ev.key === 'ArrowDown' || ev.key === 's' || ev.key === 'S') {
            ev.preventDefault();
            items.forEach((b) => b.classList.remove('focused'));
            const next = items[(curIdx + 1) % items.length];
            next.classList.add('focused');
            next.scrollIntoView({ block: 'nearest' });
            this.playUiSfx('cursor');
            return;
          }
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            items[curIdx]?.click();
            return;
          }
        }
      }

      if (this.uiState === 'busy') return;

      const step = 48;
      if (ev.key === 'w' || ev.key === 'ArrowUp') {
        this.camY -= step;
        this.clampCamera();
      } else if (ev.key === 's' || ev.key === 'ArrowDown') {
        this.camY += step;
        this.clampCamera();
      } else if (ev.key === 'a' || ev.key === 'ArrowLeft') {
        this.camX -= step;
        this.clampCamera();
      } else if (ev.key === 'd' || ev.key === 'ArrowRight') {
        this.camX += step;
        this.clampCamera();
      } else if (ev.key === 'Escape') {
        this.handleRightClickCancel();
      } else if (ev.key === 'Tab') {
        ev.preventDefault();
        this.focusNextReadyHero();
      } else if ((ev.key === 'e' || ev.key === 'E') && this.uiState === 'idle' && this.phase === 'player') {
        this.promptEndTurnWithMilan(this.hoverTile[0], this.hoverTile[1]);
      }
    });
  }

  private handleResize(): void {
    const stage = document.getElementById('viewport-stage');
    if (!stage) return;
    this.battleCanvas.width = stage.clientWidth;
    this.battleCanvas.height = stage.clientHeight;
    this.clampCamera();
  }

  private adjustZoom(delta: number): void {
    const prevTilePx = 24 * this.zoom;
    const centerMapX = (this.camX + this.battleCanvas.width / 2) / prevTilePx;
    const centerMapY = (this.camY + this.battleCanvas.height / 2) / prevTilePx;

    this.zoom = Math.max(1.25, Math.min(4, Math.round((this.zoom + delta) * 4) / 4));
    document.getElementById('hud-zoom-label')!.textContent = `${this.zoom.toFixed(2).replace(/\.00$/, '.0')}×`;

    const newTilePx = 24 * this.zoom;
    this.camX = centerMapX * newTilePx - this.battleCanvas.width / 2;
    this.camY = centerMapY * newTilePx - this.battleCanvas.height / 2;
    this.clampCamera();
  }

  /**
   * Computes the authentic `FD2.EXE` `13 × 8` (`312 × 192` px) centered cutscene viewport box
   * (`Map 32` Palace / Woods, `Map 31` Forest Road, `Map 30` Royal Triumph) so packed sub-maps and
   * off-screen staging actors NEVER bleed into the visible frame!
   */
  private getCutsceneViewportRect(W: number, H: number): {
    tilePx: number;
    viewLeft: number;
    viewTop: number;
    viewW: number;
    viewH: number;
  } {
    const tilePx = Math.max(24, Math.floor(Math.min((W - 24) / 13, (H - 24) / 8)));
    const viewW = 13 * tilePx;
    const viewH = 8 * tilePx;
    const viewLeft = Math.floor((W - viewW) / 2);
    const viewTop = Math.floor((H - viewH) / 2);
    return { tilePx, viewLeft, viewTop, viewW, viewH };
  }

  private clampCamera(): void {
    if (!this.chapter) return;
    if (this.chapter.isCutsceneMap) {
      const maxTlX = Math.max(0, this.chapter.width - 13);
      const maxTlY = Math.max(0, this.chapter.height - 8);
      this.cutsceneCamTopLeft = [
        Math.max(0, Math.min(maxTlX, this.cutsceneCamTopLeft[0])),
        Math.max(0, Math.min(maxTlY, this.cutsceneCamTopLeft[1])),
      ];
      return;
    }
    const tilePx = 24 * this.zoom;
    const mapW = this.chapter.width * tilePx;
    const mapH = this.chapter.height * tilePx;
    const pad = 96;
    const minX = mapW < this.battleCanvas.width ? (mapW - this.battleCanvas.width) / 2 : -pad;
    const maxX = mapW < this.battleCanvas.width ? minX : mapW - this.battleCanvas.width + pad;
    const minY = mapH < this.battleCanvas.height ? (mapH - this.battleCanvas.height) / 2 : -pad;
    const maxY = mapH < this.battleCanvas.height ? minY : mapH - this.battleCanvas.height + pad;

    this.camX = Math.max(minX, Math.min(maxX, this.camX));
    this.camY = Math.max(minY, Math.min(maxY, this.camY));
    if (this.subPopupEl && !this.subPopupEl.classList.contains('hidden') && this.selectedUnit) {
      this.positionSubPopupNearUnit(
        this.selectedUnit,
        this.subPopupEl.classList.contains('hint-mode') ? 'hint' : 'list'
      );
    }
  }

  private getCameraTopLeft(): [number, number] {
    if (!this.chapter) return [0, 0];
    if (this.chapter.isCutsceneMap) {
      return [Math.round(this.cutsceneCamTopLeft[0]), Math.round(this.cutsceneCamTopLeft[1])];
    }
    const tilePx = 24 * this.zoom;
    const centerTileX = (this.camX + this.battleCanvas.width / 2) / tilePx;
    const centerTileY = (this.camY + this.battleCanvas.height / 2) / tilePx;
    return [Math.round(centerTileX - 6.5), Math.round(centerTileY - 4)];
  }

  private setCameraTopLeftFractional(topLeftX: number, topLeftY: number): void {
    if (!this.chapter) return;
    const maxTlX = Math.max(0, this.chapter.width - 13);
    const maxTlY = Math.max(0, this.chapter.height - 8);
    const clampedX = Math.max(0, Math.min(maxTlX, topLeftX));
    const clampedY = Math.max(0, Math.min(maxTlY, topLeftY));
    if (this.chapter.isCutsceneMap) {
      this.cutsceneCamTopLeft = [clampedX, clampedY];
      return;
    }
    const tilePx = 24 * this.zoom;
    this.camX = (clampedX + 6.5) * tilePx - this.battleCanvas.width / 2;
    this.camY = (clampedY + 4) * tilePx - this.battleCanvas.height / 2;
    this.clampCamera();
  }

  private setCameraTopLeft(topLeftX: number, topLeftY: number): void {
    this.setCameraTopLeftFractional(topLeftX, topLeftY);
  }

  private async panCameraTopLeft(topLeftX: number, topLeftY: number, durationMs = 380): Promise<void> {
    if (!this.chapter) return;
    const maxTlX = Math.max(0, this.chapter.width - 13);
    const maxTlY = Math.max(0, this.chapter.height - 8);
    const goalX = Math.max(0, Math.min(maxTlX, topLeftX));
    const goalY = Math.max(0, Math.min(maxTlY, topLeftY));
    const [startX, startY] = this.chapter.isCutsceneMap
      ? [this.cutsceneCamTopLeft[0], this.cutsceneCamTopLeft[1]]
      : this.getCameraTopLeft();
    const dist = Math.hypot(goalX - startX, goalY - startY);
    if (dist < 0.05) {
      this.setCameraTopLeftFractional(goalX, goalY);
      return;
    }

    const effDur = Math.max(80, durationMs);
    const t0 = performance.now();
    await new Promise<void>((resolve) => {
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / effDur);
        const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        this.setCameraTopLeftFractional(startX + (goalX - startX) * ease, startY + (goalY - startY) * ease);
        if (p < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  private async fadeScreenTo(color: string, toAlpha: number, durationMs: number): Promise<void> {
    this.screenFlashColor = color;
    const fromAlpha = this.screenFlashAlpha;
    if (durationMs <= 0 || Math.abs(toAlpha - fromAlpha) < 0.01) {
      this.screenFlashAlpha = toAlpha;
      return;
    }
    const t0 = performance.now();
    await new Promise<void>((resolve) => {
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / durationMs);
        this.screenFlashAlpha = fromAlpha + (toAlpha - fromAlpha) * p;
        if (p < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  private centerCameraOnTile(tx: number, ty: number): void {
    if (this.chapter?.isCutsceneMap) {
      this.setCameraTopLeft(tx - 6, ty - 4);
      return;
    }
    const tilePx = 24 * this.zoom;
    this.camX = (tx + 0.5) * tilePx - this.battleCanvas.width / 2;
    this.camY = (ty + 0.5) * tilePx - this.battleCanvas.height / 2;
    this.clampCamera();
  }

  private async panCameraSmoothToTile(tx: number, ty: number, durationMs = 380): Promise<void> {
    if (!this.chapter) return;
    if (this.chapter.isCutsceneMap) {
      await this.panCameraTopLeft(tx - 6, ty - 4, durationMs);
      return;
    }
    const startX = this.camX;
    const startY = this.camY;
    this.centerCameraOnTile(tx, ty);
    const goalX = this.camX;
    const goalY = this.camY;
    this.camX = startX;
    this.camY = startY;

    const t0 = performance.now();
    await new Promise<void>((resolve) => {
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / Math.max(16, durationMs));
        const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        this.camX = startX + (goalX - startX) * ease;
        this.camY = startY + (goalY - startY) * ease;
        if (p < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  /**
   * Authentic `FD2.EXE` Dialogue Speaker Auto-Scroll (`fn_24452 -> fn_26028 -> fn_11498`, `L24958..L26078`):
   *  - For `-19 / -20` (`seg.speakerSlot !== undefined`), looks up `this.slots[seg.speakerSlot]`.
   *  - For `-17 / -18` (`seg.speaker !== null`), looks up the first active unit on `this.slots` with `uid === seg.speaker` (`fn_11360`).
   *  - Smoothly scrolls the camera so `(unit.x, unit.y)` sits comfortably inside the inner `[+2..+10, +2..+5]`
   *    zone of the `13 × 8` viewport (`fn_11498`), revealing off-screen speakers such as `#48 渥特王` `(7, 5)`
   *    and `#66 王后` `(10, 5)` on their twin thrones in `Map 32`!
   */
  private async ensureSpeakerInView(seg: { speaker: number | null; speakerSlot?: number }): Promise<void> {
    if (!this.chapter || seg.speaker === null) return;

    let spkUnit: BattleUnit | null | undefined = null;
    if (seg.speakerSlot !== undefined) {
      const candidate = this.slots[seg.speakerSlot];
      if (candidate && isUnitActiveOnMap(candidate)) {
        spkUnit = candidate;
      }
    }
    if (!spkUnit) {
      spkUnit = this.slots.find((u): u is BattleUnit => Boolean(u && isUnitActiveOnMap(u) && u.uid === seg.speaker));
    }
    if (!spkUnit) return;

    if (this.chapter.isCutsceneMap) {
      const [curTlX, curTlY] = this.cutsceneCamTopLeft;
      let goalTlX = curTlX;
      let goalTlY = curTlY;

      // Exact `fn_11498` (`L11509..L11635`) inner `[+2..+10, +2..+5]` margin rule!
      if (spkUnit.x < goalTlX + 2) goalTlX = spkUnit.x - 2;
      else if (spkUnit.x > goalTlX + 10) goalTlX = spkUnit.x - 10;

      if (spkUnit.y < goalTlY + 2) goalTlY = spkUnit.y - 2;
      else if (spkUnit.y > goalTlY + 5) goalTlY = spkUnit.y - 5;

      goalTlX = Math.max(0, Math.min(Math.max(0, this.chapter.width - 13), goalTlX));
      goalTlY = Math.max(0, Math.min(Math.max(0, this.chapter.height - 8), goalTlY));

      const tileDist = Math.hypot(goalTlX - curTlX, goalTlY - curTlY);
      if (tileDist >= 0.25) {
        // Scroll at crisp DOS tile-scroll cadence (~34ms per tile, capped for comfort)
        const durMs = Math.min(680, Math.max(140, Math.round(tileDist * 36)));
        await this.panCameraTopLeft(goalTlX, goalTlY, durMs);
      }
      return;
    }

    // Tactical Maps (`Ch 1..30`): ensure speaking unit is comfortably inside the visible canvas margin
    const tilePx = Math.round(24 * this.zoom);
    const W = this.battleCanvas.width;
    const H = this.battleCanvas.height;
    const screenX = (spkUnit.x + 0.5) * tilePx - this.camX;
    const screenY = (spkUnit.y + 0.5) * tilePx - this.camY;
    const marginX = Math.min(W * 0.25, tilePx * 2.5);
    const marginTop = Math.min(H * 0.22, tilePx * 2.2);
    const marginBot = Math.min(H * 0.34, tilePx * 3.5);
    if (screenX < marginX || screenX > W - marginX || screenY < marginTop || screenY > H - marginBot) {
      await this.panCameraSmoothToTile(spkUnit.x, spkUnit.y, 320);
    }
  }

  private centerCameraOnParty(): void {
    const p =
      this.activeUnits.find((u) => u.faction === 'player') ??
      this.activeUnits[0];
    if (p) this.centerCameraOnTile(p.x, p.y);
  }

  private focusNextReadyHero(): void {
    if (this.phase !== 'player' || this.uiState === 'busy') return;
    if (this.selectedUnit && this.moveOrigin && !this.selectedUnit.acted) {
      this.selectedUnit.x = this.moveOrigin[0];
      this.selectedUnit.y = this.moveOrigin[1];
      this.selectedUnit.dir = this.moveOriginDir;
      this.selectedUnit.moved = false;
    }
    this.activeSpell = null;
    this.pendingUseItemBagIdx = null;
    this.pendingGiveItemBagIdx = null;
    this.pendingTeleportTargetUnit = null;
    this.pendingTeleportFromItemBagIdx = null;
    this.targetTiles.clear();
    this.reachableMap.clear();
    const ready = this.activeUnits.filter((u) => u.faction === 'player' && !u.acted && !u.moved && u.paralyzeTurns === 0);
    if (ready.length === 0) return;
    const curIdx = this.selectedUnit ? ready.findIndex((u) => u.runtimeId === this.selectedUnit!.runtimeId) : -1;
    const next = ready[(curIdx + 1) % ready.length];
    this.playUiSfx('cursor');
    this.crossMenu.close();
    this.hideSubPopupAndForecast();
    this.centerCameraOnTile(next.x, next.y);
    this.selectPlayerUnit(next);
  }

  // =========================================================================
  // CAMPAIGN ENTRY POINTS (`新的傳奇`, `戰場回憶`, `再續前緣`)
  // =========================================================================

  /**
   * `新的傳奇` (New Game):
   * Plays the authentic 2-part Opening Prologue (`Map 32` Throne Departure -> `Map 31` Sea Voyage Ambush),
   * recruits `[#0 索爾, #9 悠妮, #4 亞雷斯, #30 蓋亞]`, sets `Gold = 0`, and launches Chapter 1 (`孤島`)!
   */
  private async startNewLegendWithPrologue(): Promise<void> {
    this.titleScreenEl.classList.add('hidden');
    this.uiState = 'busy';
    this.crossMenu.close();
    this.hideSubPopupAndForecast();
    this.battleLogEl.innerHTML = '';
    this.logMessage(
      tr(
        '<strong>新的傳奇開始</strong> — 羅特帝亞王城啟程……',
        '<strong>新的传奇开始</strong> — 罗特帝亚王城启程……',
        '<strong>A New Legend Begins</strong> — Departing from the Royal Palace of Lotedia...'
      )
    );

    await this.director.runNewGamePrologue();
    await this.beginChapterBattle(0, true);
  }

  /**
   * `戰場回憶` (Chapter Select `0..32`):
   *  - `32`: Replays Prologue 1 (`Map 32` -> `Map 31` -> `Ch 1`)
   *  - `31`: Replays Prologue 2 (`Map 31` -> `Ch 1`)
   *  - `30`: Replays True Ending Royal Triumph Epilogue (`Map 30`)
   *  - `0..29`: Starts Chapter `1..30` with either the Sandbox cumulative preset party or the player's current Campaign party!
   */
  private async startChapterReplay(chapterId: number, useCampaignParty = false): Promise<void> {
    this.titleScreenEl.classList.add('hidden');
    if (chapterId === 32) {
      await this.startNewLegendWithPrologue();
      return;
    }
    if (chapterId === 31) {
      this.uiState = 'busy';
      this.crossMenu.close();
      this.hideSubPopupAndForecast();
      this.battleLogEl.innerHTML = '';
      this.logMessage(
        tr(
          '<strong>序幕(二)・森林啟程</strong> — 羅特帝亞森林道路……',
          '<strong>序幕(二)・森林启程</strong> — 罗特帝亚森林道路……',
          '<strong>Prologue II: Forest Departure</strong> — Lotedia Forest Road...'
        )
      );
      await this.director.runNewGamePrologue(true);
      await this.beginChapterBattle(0, true);
      return;
    }
    if (chapterId === 30) {
      if (!useCampaignParty || this.party.length === 0) {
        this.party = buildPartyForChapter(29, this.assets.gameData);
        this.gold = 15000;
      }
      this.uiState = 'busy';
      this.screenFlashColor = '#ffffff';
      this.screenFlashAlpha = 1;
      await this.loadMapOnly(30);
      this.setCameraTopLeft(11, 5); // Exact `FD2.EXE` `L88184: (11, 5)`!
      await this.fadeScreenTo('#ffffff', 0, 420);
      await this.playDialogueByIndex(0);
      await this.panCameraTopLeft(11, 12, 420); // Exact `FD2.EXE` `L88371: fn_13789(11, 12)`!
      await this.director.playChoreo(89);
      await this.playDialogueByIndex(1);
      this.modals.openEndingModal('true', this.party, () => {
        this.titleScreenEl.classList.remove('hidden');
        this.uiState = 'idle';
      });
      return;
    }

    this.currentChapterId = chapterId;
    if (!useCampaignParty || this.party.length === 0) {
      this.gold = chapterId === 0 ? 0 : 800 + chapterId * 650;
      this.party = buildPartyForChapter(chapterId, this.assets.gameData);
    }
    await this.beginChapterBattle(chapterId, true);
  }

  /** Loads map geometry, tileset, and initial `waveGroup === 0` slots without starting player turn. */
  private async loadMapOnly(chapterId: number): Promise<ChapterData> {
    // Deep-clone chapter cells, chests, and turnEvents so mid-battle swaps/schedules don't mutate cached JSON!
    const loaded = await this.assets.loadChapter(chapterId);
    const clonedData: ChapterData = {
      ...loaded.data,
      cells: loaded.data.cells.map((row) => row.map((cell) => [...cell] as [number, number, number, number, number])),
      chests: loaded.data.chests.map((c) => ({ ...c })),
      turnEvents: loaded.data.turnEvents.map((te) => ({ ...te })),
    };
    this.chapter = clonedData;
    this.tilesetImg = loaded.tileset;
    this.currentChapterId = chapterId;
    this.turn = 1;
    this.phase = 'player';
    this.selectedUnit = null;
    this.moveOrigin = null;
    this.reachableMap.clear();
    this.targetTiles.clear();
    this.openedChests.clear();
    this.triggeredEvents.clear();
    this.director.resetChapterFlags();
    this.sparkleOverlays = [];
    this.explosionOverlays = [];
    this.mapSpellFxOverlays = [];
    this.mapPopupOverlays = [];
    this.lightningOverlay = null;
    this.specialStripOverlay = null;

    if (this.assets.musicTracks.length > 0) {
      this.sound.playTrack(chapterId % this.assets.musicTracks.length);
    }

    const init = initChapterSlots(clonedData, this.party, this.assets.gameData);
    this.slots = init.slots;
    this.nextSlotIndex = init.nextSlotIndex;

    this.handleResize();
    this.centerCameraOnParty();
    this.updateTopHud();
    this.updateTerrainPanel(0, 0);
    return clonedData;
  }

  private async beginChapterBattle(chapterId: number, runPreDirecting: boolean): Promise<void> {
    this.uiState = 'busy';
    this.crossMenu.close();
    this.hideSubPopupAndForecast();
    this.battleLogEl.innerHTML = '';

    // Auto-Save A: Camp / Chapter Start Checkpoint (before battle directing begins)
    saveAutoSaveSlot('camp', {
      version: 2,
      timestamp: new Date().toLocaleString(),
      chapterId,
      gold: this.gold,
      inBattle: false,
      party: this.party.map((m) => ({ ...m, items: [...m.items], spells: [...m.spells] })),
    });

    const data = await this.loadMapOnly(chapterId);
    this.logMessage(
      tr(
        `<strong>第 ${data.chapterNumber} 章《${data.titleZh}》</strong> 揭開序幕！`,
        `<strong>第 ${data.chapterNumber} 章《${data.titleZh}》</strong> 揭开序幕！`,
        `<strong>Chapter ${data.chapterNumber}: ${data.titleZh}</strong> begins!`
      )
    );

    if (runPreDirecting) {
      await this.director.runPreBattleDirecting(chapterId);
    } else {
      // If loading from a camp save without replaying story, still ensure initial wave 1/2 enemies exist!
      await this.director.runPreBattleDirecting(chapterId);
    }

    // Check Turn 1 scheduled turnEvents (e.g. Ch 12 Turn 1 EV 35)
    await this.checkScheduledTurnEvents(0);

    // Auto-Save B: Turn 1 Start Checkpoint
    saveAutoSaveSlot('turn', this.snapshotSaveData());
    this.updateTopHud();

    await this.showPhaseBanner(
      tr(`第 ${this.turn} 回合 · 我軍行動`, `第 ${this.turn} 回合 · 我军行动`, `TURN ${this.turn} · PLAYER PHASE`)
    );
    const firstHero = this.activeUnits.find((u) => u.faction === 'player');
    if (firstHero) {
      this.hoverTile = [firstHero.x, firstHero.y];
      this.centerCameraOnTile(firstHero.x, firstHero.y);
      this.updateInspectorPanel(firstHero);
    }
    this.uiState = 'idle';
  }

  // =========================================================================
  // SAVE / LOAD SNAPSHOTS (Mid-Battle & Camp Saves!)
  // =========================================================================

  private snapshotSaveData(): SaveSlotData {
    const syncedParty = this.syncPartyFromBattlefield();
    return {
      version: 2,
      timestamp: new Date().toLocaleString(),
      chapterId: this.currentChapterId,
      gold: this.gold,
      inBattle: true,
      turn: this.turn,
      party: syncedParty,
      openedChests: Array.from(this.openedChests),
      triggeredEvents: Array.from(this.triggeredEvents),
      chapterFlags: Array.from(this.director.getFlags()),
      scheduledTurnEvents: this.chapter?.turnEvents.map((te) => ({ ...te })),
      battleUnits: this.slots.filter((u): u is BattleUnit => u !== null).map((u) => ({
        ...u,
        items: [...u.items],
        spells: [...u.spells],
      })),
    };
  }

  private async loadFromSaveData(save: SaveSlotData): Promise<void> {
    this.currentChapterId = save.chapterId;
    this.gold = save.gold;
    this.party = save.party;
    this.titleScreenEl.classList.add('hidden');

    if (save.inBattle && save.battleUnits && save.battleUnits.length > 0) {
      this.uiState = 'busy';
      this.crossMenu.close();
      this.hideSubPopupAndForecast();
      await this.loadMapOnly(save.chapterId);
      this.turn = save.turn ?? 1;
      this.openedChests = new Set(save.openedChests ?? []);
      this.director.resetChapterFlags(save.chapterFlags);
      if (this.chapter && save.scheduledTurnEvents) {
        this.chapter.turnEvents = save.scheduledTurnEvents.map((te) => ({ ...te }));
      }
      // Re-apply visual open-chest tile swaps (`fn_8803`: `tileId + 1`, clear chest flags) for already-opened chests!
      if (this.chapter) {
        for (const key of this.openedChests) {
          const [cx, cy] = key.split(',').map(Number);
          const cell = this.chapter.cells[cy]?.[cx];
          if (cell && (cell[4] & 2) !== 0 && cell[1] >= 0 && cell[1] <= 15) {
            if ((cell[4] & 0x40) === 0) {
              cell[0] += 1;
            }
            cell[1] = 0;
            cell[4] &= ~(2 | 0x40);
          }
        }
      }
      this.triggeredEvents = new Set(save.triggeredEvents ?? []);
      this.slots = new Array(96).fill(null);
      let maxSlot = 0;
      for (const bu of save.battleUnits) {
        const sIdx = bu.slotIndex ?? maxSlot;
        this.slots[sIdx] = { ...bu, slotIndex: sIdx, items: [...bu.items], spells: [...bu.spells] };
        maxSlot = Math.max(maxSlot, sIdx + 1);
      }
      this.nextSlotIndex = maxSlot;
      applyLocaleToGameState(
        this.assets.gameData,
        this.chapter,
        this.slots.filter((u): u is BattleUnit => u !== null),
        this.party
      );
      this.updateTopHud();
      this.centerCameraOnParty();
      this.logMessage(
        tr(
          `已讀取第 ${save.chapterId + 1} 章 第 ${this.turn} 回合戰場存檔。`,
          `已读取第 ${save.chapterId + 1} 章 第 ${this.turn} 回合战场存档。`,
          `Loaded Chapter ${save.chapterId + 1} Turn ${this.turn} battlefield save.`
        )
      );
      this.uiState = 'idle';
      return;
    }

    await this.beginChapterBattle(save.chapterId, true);
  }

  private syncPartyFromBattlefield(): PartyMemberSave[] {
    const byBaseHid = new Map<number, PartyMemberSave>();
    for (const m of this.party) {
      const b = m.baseHeroId ?? this.assets.gameData.unitDex[m.uid]?.baseHeroId ?? m.uid;
      byBaseHid.set(b, { ...m, baseHeroId: b, items: [...m.items], spells: [...m.spells] });
    }
    if (this.chapter?.isCutsceneMap) {
      return Array.from(byBaseHid.values());
    }
    for (const u of this.slots) {
      if (u && u.faction === 'player') {
        const baseHid = this.assets.gameData.unitDex[u.uid]?.baseHeroId ?? u.uid;
        // Exact `FD2.EXE` `fn_5382`: ONLY update heroes already recruited into `this.party`
        // (so temporary unrecruited guests like `#3 哈瓦特` in Ch 1 do NOT get added to `this.party`!)
        if (!byBaseHid.has(baseHid)) continue;
        byBaseHid.set(baseHid, {
          uid: u.uid,
          baseHeroId: baseHid,
          nameZh: u.nameZh,
          nameGlyphs: u.nameGlyphs,
          classNameZh: u.classNameZh,
          portraitId: u.portraitId,
          spriteGroup: u.spriteGroup,
          classId: u.classId,
          moveMode: u.moveMode,
          level: u.level,
          exp: u.exp,
          maxHp: u.maxHp,
          maxMp: u.maxMp,
          baseAp: u.baseAp,
          baseDp: u.baseDp,
          baseDx: u.baseDx,
          mv: u.mv,
          items: [...u.items].slice(0, 8),
          spells: [...u.spells],
        });
      }
    }
    return Array.from(byBaseHid.values());
  }

  private async playDialogueByIndex(dlgIdx: number): Promise<void> {
    if (!this.chapter) return;
    const segs = this.chapter.dialogues[dlgIdx];
    if (!segs || segs.length === 0) return;
    await this.cutscene.playDialogueSequence(
      segs,
      document.getElementById('dialogue-overlay')!,
      document.getElementById('dialogue-portrait') as HTMLCanvasElement,
      document.getElementById('dialogue-speaker')!,
      document.getElementById('dialogue-lines')!,
      document.getElementById('dialogue-progress')!,
      document.getElementById('btn-skip-dialogue') as HTMLButtonElement,
      (seg) => this.ensureSpeakerInView(seg)
    );
  }

  private async runScriptedDuel(attackerSlot: number, defenderSlot: number): Promise<void> {
    const atk = this.slots[attackerSlot];
    const def = this.slots[defenderSlot];
    if (!atk || !def || !this.chapter) return;
    const outcome = resolveCombat(atk, def, this.chapter, this.assets.gameData);
    await this.cutscene.playCombatCutscene(
      outcome,
      document.getElementById('cutscene-backdrop')!,
      document.getElementById('cutscene-canvas') as HTMLCanvasElement,
      document.getElementById('btn-skip-cutscene') as HTMLButtonElement
    );
    await this.playDyingUnitsOnMapAnim();
  }

  // =========================================================================
  // HUD, TERRAIN & UNIT INSPECTOR UPDATES
  // =========================================================================

  private updateTopHud(): void {
    if (!this.chapter) return;
    const badge = document.getElementById('hud-chapter-badge')!;
    if (this.chapter.isCutsceneMap) {
      badge.innerHTML = `<span style="color:var(--gold-200);">${this.chapter.titleZh}</span>`;
    } else {
      const chNumStr = tr(
        `第 ${this.chapter.chapterNumber} 章`,
        `第 ${this.chapter.chapterNumber} 章`,
        `Ch. ${this.chapter.chapterNumber}`
      );
      badge.innerHTML = `<span>${chNumStr}</span> ${this.assets.glyphsToHtml(this.chapter.titleGlyphs, 'gold', 15, this.chapter.titleZh)}`;
    }
    document.getElementById('hud-turn-counter')!.textContent = `TURN ${this.turn}`;
    document.getElementById('hud-gold-label')!.textContent = `${this.gold} G`;

    const pill = document.getElementById('hud-phase-pill')!;
    pill.className = `phase-indicator ${this.phase}`;
    pill.textContent =
      this.phase === 'player'
        ? tr('我軍行動', '我军行动', 'PLAYER PHASE')
        : this.phase === 'ally'
          ? tr('友軍行動', '友军行动', 'ALLY PHASE')
          : tr('敵軍行動', '敌军行动', 'ENEMY PHASE');

    const contBtn = document.getElementById('btn-continue-game') as HTMLButtonElement | null;
    if (contBtn) contBtn.disabled = !ModalController.hasAnySave();
  }

  private logMessage(html: string): void {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = html;
    this.battleLogEl.prepend(div);
    while (this.battleLogEl.children.length > 50) {
      this.battleLogEl.lastChild?.remove();
    }
  }

  private async showPhaseBanner(text: string): Promise<void> {
    this.turnBannerEl.textContent = text;
    this.turnBannerEl.classList.remove('hidden');
    await new Promise((r) => setTimeout(r, 680));
    this.turnBannerEl.classList.add('hidden');
  }

  private updateHoverTileFromMouse(clientX: number, clientY: number): void {
    if (!this.chapter) return;
    const rect = this.battleCanvas.getBoundingClientRect();
    const tilePx = Math.round(24 * this.zoom);
    const tx = Math.floor((clientX - rect.left + Math.round(this.camX)) / tilePx);
    const ty = Math.floor((clientY - rect.top + Math.round(this.camY)) / tilePx);
    if (tx < 0 || ty < 0 || tx >= this.chapter.width || ty >= this.chapter.height) return;
    if (tx === this.hoverTile[0] && ty === this.hoverTile[1]) return;

    this.hoverTile = [tx, ty];
    this.updateTerrainPanel(tx, ty);

    const hoveredUnit = this.activeUnits.find((u) => u.x === tx && u.y === ty);
    if (hoveredUnit) {
      this.updateInspectorPanel(hoveredUnit);
    } else if (this.selectedUnit) {
      this.updateInspectorPanel(this.selectedUnit);
    }

    // Show Pre-Combat Forecast when targeting an attack!
    if (
      this.uiState === 'targeting_attack' &&
      this.selectedUnit &&
      hoveredUnit &&
      areHostile(this.selectedUnit.faction, hoveredUnit.faction) &&
      this.targetTiles.has(coordKey(tx, ty))
    ) {
      const fc = predictCombat(this.selectedUnit, hoveredUnit, this.chapter, this.assets.gameData);
      this.forecastEl.innerHTML = `
        <div class="forecast-side">
          <div>${this.assets.glyphsToHtml(this.selectedUnit.nameGlyphs, 'gold', 16, this.selectedUnit.nameZh)}</div>
          <div style="font-family:var(--font-mono); font-size:12px;">${tr('預計傷害', '预计伤害', 'Est. DMG')} <strong style="color:var(--gold-200);">${fc.attackerDmg}</strong> · ${tr('命中', '命中', 'HIT')} ${fc.attackerHitPct}% · ${tr('暴擊', '暴击', 'CRIT')} ${fc.attackerCritPct}%</div>
        </div>
        <div class="forecast-vs">VS</div>
        <div class="forecast-side right">
          <div>${this.assets.glyphsToHtml(hoveredUnit.nameGlyphs, 'crimson', 16, hoveredUnit.nameZh)}</div>
          <div style="font-family:var(--font-mono); font-size:12px;">
            ${
              fc.canCounter
                ? `${tr('反擊傷害', '反击伤害', 'Counter DMG')} <strong>${fc.defenderDmg}</strong> · ${tr('命中', '命中', 'HIT')} ${fc.defenderHitPct}%`
                : tr('無法反擊', '无法反击', 'No Counter')
            }
          </div>
        </div>
      `;
      this.forecastEl.classList.remove('hidden');
    } else {
      this.forecastEl.classList.add('hidden');
    }
  }

  private updateTerrainPanel(tx: number, ty: number): void {
    if (!this.chapter) return;
    document.getElementById('terrain-coords')!.textContent = `(${tx}, ${ty})`;
    const tinfo = getTerrainInfo(this.chapter, tx, ty);
    const cellFlags = this.chapter.cells[ty]?.[tx]?.[4] ?? 0;
    const isVisibleChest = tinfo.isChestTile && (cellFlags & 0x40) === 0;
    const chestOpened = this.openedChests.has(coordKey(tx, ty));
    const winFallback = getLocalizedChapterWin(this.chapter.id, tr('擊敗所有敵軍', '击败所有敌军', 'Defeat all enemies'));
    const loseFallback = getLocalizedChapterLose(this.chapter.id, tr('索爾陣亡', '索尔阵亡', 'Thor falls in battle'));

    document.getElementById('terrain-info-body')!.innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
        <strong>${tinfo.name}</strong>
        <span style="font-family:var(--font-mono); color:var(--gold-300);">AP ${tinfo.apBonus >= 0 ? '+' : ''}${tinfo.apBonus}% · DP ${tinfo.defBonus >= 0 ? '+' : ''}${tinfo.defBonus}%</span>
      </div>
      ${
        isVisibleChest
          ? `<div style="font-size:11.5px; color:${chestOpened ? 'var(--ink-400)' : 'var(--gold-200)'}; margin-bottom:6px;">
               ${
                 chestOpened
                   ? tr('寶箱（已開啟）', '宝箱（已开启）', 'Treasure Chest (Opened)')
                   : tr(
                       '未開啟寶箱 — 站上此格選擇「休息/開寶箱」取得寶物！',
                       '未开启宝箱 — 站上此格选择「休息/开宝箱」取得宝物！',
                       'Unopened Chest — Stand here and select "Open Chest / Rest" to loot!'
                     )
               }
             </div>`
          : ''
      }
      <div style="border-top:1px solid var(--border-subtle); padding-top:6px; margin-top:4px; font-size:11.5px; color:var(--ink-400);">
        <div>${tr('勝利', '胜利', 'Win')}：${this.assets.glyphsToHtml(this.chapter.winGlyphs, 'emerald', 14, winFallback)}</div>
        <div style="margin-top:3px;">${tr('失敗', '失败', 'Lose')}：${this.assets.glyphsToHtml(this.chapter.loseGlyphs, 'crimson', 14, loseFallback)}</div>
      </div>
    `;
  }

  private updateInspectorPanel(unit: BattleUnit): void {
    const gd = this.assets.gameData;
    const clsName = unit.classNameZh || getUnitClassLabel(unit.uid, unit.classId, gd);
    const eq = getEquippedStats(unit, gd);
    const isTw = getLocale() === 'zh-TW';

    const tagEl = document.getElementById('inspector-faction-tag')!;
    tagEl.textContent = `${unit.faction.toUpperCase()}${unit.isBoss ? ' · BOSS' : ''}`;
    tagEl.style.color =
      unit.faction === 'player' ? 'var(--player-blue)' : unit.faction === 'ally' ? 'var(--ally-green)' : 'var(--enemy-red)';

    const hpPct = Math.round((unit.hp / Math.max(1, unit.maxHp)) * 100);
    const hpColor = hpPct > 55 ? 'var(--hp-fill)' : hpPct > 25 ? 'var(--hp-warn)' : 'var(--hp-low)';
    const mpPct = unit.maxMp > 0 ? Math.round((unit.mp / unit.maxMp) * 100) : 0;

    const statusTags: string[] = [];
    if (unit.poisonTurns > 0)
      statusTags.push(`<span style="color:#a3e635;">${tr('中毒', '中毒', 'PSN')}(${unit.poisonTurns})</span>`);
    if (unit.paralyzeTurns > 0)
      statusTags.push(`<span style="color:#facc15;">${tr('麻痺', '麻痹', 'PAR')}(${unit.paralyzeTurns})</span>`);
    if ((unit.silenceTurns ?? 0) > 0)
      statusTags.push(`<span style="color:#f87171;">${tr('封咒', '封咒', 'SIL')}(${unit.silenceTurns})</span>`);
    if ((unit.apBuffTurns ?? 0) > 0)
      statusTags.push(`<span style="color:#fb923c;">${tr('魔刃+AP', '魔刃+AP', '+AP Buff')}</span>`);
    if ((unit.dpBuffTurns ?? 0) > 0)
      statusTags.push(`<span style="color:#60a5fa;">${tr('魔鎧+DP', '魔铠+DP', '+DP Buff')}</span>`);

    const itemsHtml =
      unit.items.length === 0
        ? `<div style="color:var(--ink-400); font-size:11.5px;">${tr('未攜帶道具', '未携带道具', 'No items carried')}</div>`
        : unit.items
            .slice(0, 8)
            .map((iid, idx) => {
              const it = gd.items[iid];
              if (!it) return '';
              const badge =
                idx === eq.weaponIdx
                  ? `<span style="font-size:10px; color:var(--gold-300); font-weight:700;">${tr('裝備中(武)', '装备中(武)', '[WPN]')}</span>`
                  : idx === eq.armorIdx
                    ? `<span style="font-size:10px; color:var(--player-blue); font-weight:700;">${tr('裝備中(防)', '装备中(防)', '[ARM]')}</span>`
                    : '';
              return `<div class="item-chip" style="padding:3px 7px;">
                <span>${this.assets.glyphsToHtml(it.nameGlyphs, 'ivory', 14, it.nameZh)}${isTw ? ` <small style="color:var(--ink-400);">${it.nameZh}</small>` : ''}</span>
                ${badge}
              </div>`;
            })
            .join('');

    const spellsHtml =
      unit.spells.length > 0
        ? `<div style="margin-top:6px; display:flex; flex-wrap:wrap; gap:4px;">
             ${unit.spells
               .map((sid) => {
                 const sp = gd.spells[sid];
                 return sp
                   ? `<span style="padding:2px 6px; border-radius:4px; background:var(--surface-1); border:1px solid var(--border-subtle); font-size:11px;">
                        ${this.assets.glyphsToHtml(sp.nameGlyphs, 'azure', 13, sp.nameZh)} <small style="color:var(--ink-400);">${sp.mpCost}MP</small>
                      </span>`
                   : '';
               })
               .join('')}
           </div>`
        : '';

    document.getElementById('unit-inspector-body')!.innerHTML = `
      <div class="unit-card-header">
        <div class="portrait-frame">
          <img class="pixel-crisp" src="${this.assets.portraitToDataUrl(unit.portraitId, 0)}" width="80" height="80" alt="" />
        </div>
        <div class="unit-meta">
          <div class="unit-name-row">
            ${this.assets.glyphsToHtml(unit.nameGlyphs, 'gold', 18, unit.nameZh || `Unit #${unit.uid}`)}
            ${isTw ? `<span style="font-size:12.5px; color:var(--ink-200); margin-left:4px;">${unit.nameZh}</span>` : ''}
          </div>
          <div style="font-size:12px; color:var(--ink-200);">Lv ${unit.level} · ${clsName}</div>
          <div style="font-family:var(--font-mono); font-size:11px; color:var(--ink-400);">
            EXP ${unit.exp}/100 · ${tr('射程', '射程', 'RNG')} ${eq.minRange}–${eq.maxRange}
          </div>
          ${statusTags.length > 0 ? `<div style="font-size:11px; display:flex; gap:6px;">${statusTags.join('')}</div>` : ''}
        </div>
      </div>

      <div class="stat-bars">
        <div class="bar-row">
          <span>HP</span>
          <div class="bar-track"><div class="bar-fill" style="width:${hpPct}%; background:${hpColor};"></div></div>
          <span style="text-align:right;">${unit.hp}/${unit.maxHp}</span>
        </div>
        <div class="bar-row">
          <span>MP</span>
          <div class="bar-track"><div class="bar-fill" style="width:${mpPct}%; background:var(--mp-fill);"></div></div>
          <span style="text-align:right;">${unit.mp}/${unit.maxMp}</span>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-cell"><div class="stat-label">AP</div><div class="stat-val">${eq.ap}</div></div>
        <div class="stat-cell"><div class="stat-label">DP</div><div class="stat-val">${eq.dp}</div></div>
        <div class="stat-cell"><div class="stat-label">HIT/EV</div><div class="stat-val">${eq.hit}/${eq.ev}</div></div>
        <div class="stat-cell"><div class="stat-label">MV</div><div class="stat-val">${unit.mv}</div></div>
      </div>

      <div style="margin-top:8px;" class="item-chip-list">${itemsHtml}</div>
      ${spellsHtml}
    `;
  }

  // =========================================================================
  // AUTHENTIC 4-WAY CROSS MENU (`十字選單`) & TACTICAL COMMAND FLOW
  // =========================================================================

  private selectPlayerUnit(unit: BattleUnit): void {
    if (!this.chapter) return;
    if (unit.faction !== 'player' || unit.acted || unit.moved || unit.paralyzeTurns > 0) {
      this.selectedUnit = null;
      this.moveOrigin = null;
      this.reachableMap.clear();
      this.targetTiles.clear();
      this.uiState = 'idle';
      this.crossMenu.close();
      this.hideSubPopupAndForecast();
      this.updateInspectorPanel(unit);
      return;
    }
    this.selectedUnit = unit;
    this.moveOrigin = [unit.x, unit.y];
    this.moveOriginDir = unit.dir;
    this.lastWalkPath = [];
    this.reachableMap = computeReachableTiles(unit, this.chapter, this.activeUnits, this.assets.gameData);
    this.targetTiles.clear();
    this.uiState = 'unit_selected';
    this.crossMenu.close();
    this.hideSubPopupAndForecast();
    this.updateInspectorPanel(unit);
  }

  private hideSubPopupAndForecast(): void {
    this.subPopupEl.classList.add('hidden');
    this.subPopupEl.classList.remove('hint-mode');
    this.subPopupEl.innerHTML = '';
    this.forecastEl.classList.add('hidden');
  }

  /**
   * Positions the classic DOS-blue tactical popup (`#action-sub-popup`) directly next to the character `(u.x, u.y)`
   * on the battlefield canvas (`mode === 'list'` immediately to the right/left of the unit; `mode === 'hint'` floating above/below).
   */
  private positionSubPopupNearUnit(u?: BattleUnit | null, mode: 'list' | 'hint' = 'list'): void {
    const unit = u ?? this.selectedUnit;
    this.subPopupEl.classList.toggle('hint-mode', mode === 'hint');
    this.subPopupEl.classList.remove('hidden');

    const W = this.battleCanvas.width || 800;
    const H = this.battleCanvas.height || 600;
    const tilePx = Math.round(24 * this.zoom);
    const cx = unit ? (unit.x + 0.5) * tilePx - this.camX : W * 0.5;
    const cy = unit ? (unit.y + 0.5) * tilePx - this.camY : H * 0.5;

    const popW = this.subPopupEl.offsetWidth || (mode === 'hint' ? 280 : 246);
    const popH = this.subPopupEl.offsetHeight || (mode === 'hint' ? 40 : 180);
    const pad = 10;

    let left: number;
    let top: number;
    if (mode === 'hint') {
      left = Math.round(cx - popW * 0.5);
      top = Math.round(cy - tilePx * 0.65 - popH - 10);
      if (top < pad) {
        top = Math.round(cy + tilePx * 0.65 + 10);
      }
    } else {
      const gap = Math.round(tilePx * 0.58) + 8;
      left = Math.round(cx + gap);
      if (left + popW > W - pad) {
        left = Math.round(cx - gap - popW);
      }
      top = Math.round(cy - Math.min(84, popH * 0.35));
    }

    left = Math.max(pad, Math.min(Math.max(pad, W - popW - pad), left));
    top = Math.max(pad, Math.min(Math.max(pad, H - popH - pad), top));
    this.subPopupEl.style.left = `${left}px`;
    this.subPopupEl.style.top = `${top}px`;
    this.subPopupEl.style.bottom = 'auto';
    this.subPopupEl.style.transform = 'none';
  }

  private showUnitTargetingHint(u: BattleUnit, html: string): void {
    this.subPopupEl.innerHTML = `
      <span style="color:#ffffff; font-size:12.5px; font-weight:600;">${html}</span>
      <button class="dos-popup-back" id="act-back" type="button" style="margin-top:0; padding:3px 9px;">${tr('取消', '取消', 'Cancel')}</button>
    `;
    this.positionSubPopupNearUnit(u, 'hint');
    this.subPopupEl.querySelector('#act-back')?.addEventListener('click', () => this.handleRightClickCancel());
  }

  private handleRightClickCancel(): void {
    if (this.uiState === 'busy') return;
    this.playUiSfx('cancel');

    if (this.crossMenu.yesNoPrompt) {
      const p = this.crossMenu.yesNoPrompt;
      this.crossMenu.close();
      p.onCancelNo();
      return;
    }

    if (this.uiState === 'targeting_teleport_dest') {
      const fromItem = this.pendingTeleportFromItemBagIdx !== null;
      this.targetTiles.clear();
      this.pendingTeleportTargetUnit = null;
      this.pendingTeleportFromItemBagIdx = null;
      this.pendingUseItemBagIdx = null;
      this.activeSpell = null;
      this.hideSubPopupAndForecast();
      if (fromItem) {
        this.openItemSubCrossMenu();
      } else {
        this.openUnitActionCrossMenu();
      }
      return;
    }

    if (
      this.uiState === 'targeting_attack' ||
      this.uiState === 'choosing_spell' ||
      this.uiState === 'targeting_spell'
    ) {
      this.targetTiles.clear();
      this.activeSpell = null;
      this.hideSubPopupAndForecast();
      this.openUnitActionCrossMenu();
      return;
    }

    if (
      this.uiState === 'choosing_item_list' ||
      this.uiState === 'targeting_use_item' ||
      this.uiState === 'targeting_give_ally'
    ) {
      this.targetTiles.clear();
      this.pendingUseItemBagIdx = null;
      this.pendingGiveItemBagIdx = null;
      this.hideSubPopupAndForecast();
      this.openItemSubCrossMenu();
      return;
    }

    if (this.uiState === 'item_sub_cross') {
      this.openUnitActionCrossMenu('right');
      return;
    }

    if (this.uiState === 'system_sub_cross' || this.uiState === 'settings_sub_cross') {
      this.openEmptyTileCrossMenu(this.crossMenu.tileX, this.crossMenu.tileY);
      return;
    }

    if (this.uiState === 'empty_cross') {
      this.crossMenu.close();
      this.uiState = 'idle';
      return;
    }

    if (this.uiState === 'unit_cross' && this.selectedUnit && this.moveOrigin) {
      this.crossMenu.close();
      this.selectedUnit.x = this.moveOrigin[0];
      this.selectedUnit.y = this.moveOrigin[1];
      this.selectedUnit.dir = this.moveOriginDir;
      this.selectedUnit.moved = false;
      this.selectPlayerUnit(this.selectedUnit);
      return;
    }

    this.crossMenu.close();
    this.selectedUnit = null;
    this.reachableMap.clear();
    this.targetTiles.clear();
    this.hideSubPopupAndForecast();
    this.uiState = 'idle';
  }

  /**
   * Opens the Authentic `FD2.EXE` Unit Action 4-Way Cross Menu (`GLOBAL_2_7893`: `[0 攻擊, 1 法術, 2 道具, 3 休息]`)!
   */
  private openUnitActionCrossMenu(defaultDir?: 'top' | 'left' | 'right' | 'bottom'): void {
    if (!this.chapter || !this.selectedUnit) return;
    this.uiState = 'unit_cross';
    this.reachableMap.clear();
    this.targetTiles.clear();
    this.hideSubPopupAndForecast();

    const u = this.selectedUnit;
    const gd = this.assets.gameData;
    const eq = getEquippedStats(u, gd);

    const unitCanAtk = canUnitAttack(u, gd);
    const isLinearBeam = eq.weapon?.id === 79;
    const atkCoords = unitCanAtk
      ? getAttackableCoordinates(u.x, u.y, eq.minRange, eq.maxRange, this.chapter, isLinearBeam)
      : [];
    const hasEnemyInRange =
      unitCanAtk &&
      atkCoords.some(([ax, ay]) =>
        this.activeUnits.some((other) => other.x === ax && other.y === ay && areHostile(u.faction, other.faction))
      );

    // Exact `FD2.EXE` `fn_34960` (`L35423..L35450`) Post-Move Magic Rule:
    // Moving disables Magic EXCEPT for the three Sword Saint (`劍聖`) slots: `#18 蜜蒂`, `#19 羅德曼`, and `#34 鐵諾`!
    const didMove = this.moveOrigin ? u.x !== this.moveOrigin[0] || u.y !== this.moveOrigin[1] : u.moved;
    const canMoveAndCast = !didMove || u.uid === 18 || u.uid === 19 || u.uid === 34;
    const hasCastableSpell =
      canMoveAndCast &&
      (u.silenceTurns ?? 0) === 0 &&
      u.spells.some((sid) => gd.spells[sid] && u.mp >= gd.spells[sid].mpCost);
    const hasItems = u.items.length > 0;
    const tinfo = getTerrainInfo(this.chapter, u.x, u.y);
    const cellFlags = this.chapter.cells[u.y]?.[u.x]?.[4] ?? 0;
    const isHiddenGround = (cellFlags & 0x40) !== 0;
    // In Ch 26 (`id === 25`), vault chests `0..4` (`EV 58`) are sealed once `director.getFlags()[0..4] !== 0`!
    const isSealedVaultChest =
      this.chapter.id === 25 && tinfo.eventId >= 0 && tinfo.eventId <= 4 && this.director.getFlags()[tinfo.eventId] !== 0;
    const canLootChest = tinfo.isChestTile && !this.openedChests.has(coordKey(u.x, u.y)) && !isSealedVaultChest;

    const arms: CrossArmOption[] = [
      { dir: 'top', iconId: 0, state: 0, labelZh: tr('攻擊 (Attack)', '攻击 (Attack)', 'Attack'), enabled: hasEnemyInRange, action: 'attack' },
      { dir: 'left', iconId: 1, state: 0, labelZh: tr('法術 (Magic)', '法术 (Magic)', 'Magic'), enabled: hasCastableSpell, action: 'magic' },
      { dir: 'right', iconId: 2, state: 0, labelZh: tr('道具 (Items)', '道具 (Items)', 'Items'), enabled: hasItems, action: 'item' },
      {
        dir: 'bottom',
        iconId: 3,
        state: 0,
        labelZh:
          canLootChest && !isHiddenGround
            ? tr('開啟寶箱並待機', '开启宝箱并待机', 'Open Chest & Rest')
            : tr('休息待機 (Rest)', '休息待机 (Rest)', 'Rest / Wait'),
        enabled: true,
        action: 'rest',
      },
    ];

    this.playUiSfx('cross');
    this.crossMenu.openCross(
      u.x,
      u.y,
      arms,
      (action) => {
        this.playUiSfx('confirm');
        if (action === 'attack') {
          this.crossMenu.close();
          this.reachableMap.clear();
          this.uiState = 'targeting_attack';
          this.targetTiles = new Set(atkCoords.map(([x, y]) => coordKey(x, y)));
          this.showUnitTargetingHint(
            u,
            tr(
              '請點選紅框內的敵軍發動攻擊（右鍵取消）',
              '请点选红框内的敌军发动攻击（右键取消）',
              'Click a highlighted enemy to attack (Right-click to cancel)'
            )
          );
        } else if (action === 'magic') {
          this.crossMenu.close();
          this.openSpellBookPopup(u);
        } else if (action === 'item') {
          this.openItemSubCrossMenu();
        } else if (action === 'rest') {
          this.crossMenu.close();
          void this.executeUnitRestOrChest(u, canLootChest);
        }
      },
      () => this.handleRightClickCancel(),
      defaultDir ?? (hasEnemyInRange ? 'top' : 'bottom')
    );
  }

  /**
   * Opens the Authentic `FD2.EXE` Item Sub-Cross Menu (`GLOBAL_2_7941`: `[8 使用, 9 交換, 10 裝備, 11 丟棄]`)!
   */
  private openItemSubCrossMenu(): void {
    if (!this.chapter || !this.selectedUnit) return;
    this.uiState = 'item_sub_cross';
    this.reachableMap.clear();
    this.targetTiles.clear();
    this.hideSubPopupAndForecast();

    const u = this.selectedUnit;
    const gd = this.assets.gameData;

    const hasUsable = u.items.some((iid) => isItemUsableInBattle(gd.items[iid]));
    const adjacentAllies = this.activeUnits.filter(
      (other) =>
        other.faction === 'player' &&
        other.runtimeId !== u.runtimeId &&
        manhattan(u.x, u.y, other.x, other.y) === 1 &&
        other.items.length < 8
    );
    const hasEquippable = u.items.some((iid) => {
      const it = gd.items[iid];
      return it && (it.category === 'weapon' || it.category === 'armor') && canUnitEquipItem(u, it, gd);
    });

    const arms: CrossArmOption[] = [
      { dir: 'top', iconId: 8, state: 0, labelZh: tr('使用道具 (Use)', '使用道具 (Use)', 'Use Item'), enabled: hasUsable, action: 'use' },
      {
        dir: 'left',
        iconId: 9,
        state: 0,
        labelZh: tr('交換傳遞 (Give)', '交换传递 (Give)', 'Give Item'),
        enabled: u.items.length > 0 && adjacentAllies.length > 0,
        action: 'give',
      },
      { dir: 'right', iconId: 10, state: 0, labelZh: tr('更換裝備 (Equip)', '更换装备 (Equip)', 'Equip Item'), enabled: hasEquippable, action: 'equip' },
      { dir: 'bottom', iconId: 11, state: 0, labelZh: tr('丟棄道具 (Discard)', '丢弃道具 (Discard)', 'Discard Item'), enabled: u.items.length > 0, action: 'discard' },
    ];

    this.playUiSfx('cross');
    this.crossMenu.openCross(
      u.x,
      u.y,
      arms,
      (action) => {
        this.playUiSfx('confirm');
        this.crossMenu.close();
        this.openItemBagSelectionPopup(u, action as 'use' | 'give' | 'equip' | 'discard');
      },
      () => this.handleRightClickCancel()
    );
  }

  /**
   * Opens the Authentic `FD2.EXE` Empty-Tile 4-Way Cross Menu (`GLOBAL_2_7839`: `[7 戰況, 5 委任, 6 設定, 4 回合結束]`)!
   */
  private openEmptyTileCrossMenu(tx: number, ty: number): void {
    if (!this.chapter) return;
    this.uiState = 'empty_cross';
    this.reachableMap.clear();
    this.targetTiles.clear();
    this.hideSubPopupAndForecast();

    const anyUnactedPlayer = this.activeUnits.some((u) => u.faction === 'player' && !u.acted && u.paralyzeTurns === 0);

    const arms: CrossArmOption[] = [
      { dir: 'top', iconId: 7, state: 0, labelZh: tr('戰況與存取 (System)', '战况与存取 (System)', 'System & Save'), enabled: true, action: 'system' },
      { dir: 'left', iconId: 5, state: 0, labelZh: tr('委任行動 (Auto AI)', '委任行动 (Auto AI)', 'Auto Delegate (AI)'), enabled: anyUnactedPlayer, action: 'auto_ai' },
      { dir: 'right', iconId: 6, state: 0, labelZh: tr('環境設定 (Settings)', '环境设定 (Settings)', 'Settings'), enabled: true, action: 'settings' },
      { dir: 'bottom', iconId: 4, state: 0, labelZh: tr('回合結束 (End Turn)', '回合结束 (End Turn)', 'End Turn'), enabled: true, action: 'end_turn' },
    ];

    this.playUiSfx('cross');
    this.crossMenu.openCross(
      tx,
      ty,
      arms,
      (action) => {
        this.playUiSfx('confirm');
        if (action === 'system') {
          this.openSystemSubCrossMenu(tx, ty);
        } else if (action === 'settings') {
          this.openSettingsSubCrossMenu(tx, ty);
        } else if (action === 'auto_ai') {
          // `#0 索爾` Yes/No confirmation (`[16 YES, 17 NO!]`) to delegate remaining heroes this turn!
          this.crossMenu.openYesNo({
            tileX: tx,
            tileY: ty,
            speakerPortraitId: 0,
            speakerNameZh: getLocalizedUnitName(0, '索爾'),
            promptZh: tr('要將本回合剩餘夥伴交由委任行動嗎？', '要将本回合剩余伙伴交由委任行动吗？', 'Delegate remaining heroes to AI for this turn?'),
            selected: 'yes',
            onConfirmYes: () => {
              void this.runPlayerAutoDelegateTurn();
            },
            onCancelNo: () => {
              this.uiState = 'idle';
            },
          });
        } else if (action === 'end_turn') {
          this.promptEndTurnWithMilan(tx, ty);
        }
      },
      () => this.handleRightClickCancel()
    );
  }

  /** Opens `GLOBAL_2_7925` System / Save Sub-Cross (`[12 戰況一覽, 13 戰場存檔, 14 戰場讀檔, 15 離開戰場]`). */
  private openSystemSubCrossMenu(tx: number, ty: number): void {
    if (!this.chapter) return;
    this.uiState = 'system_sub_cross';
    const ch = this.chapter;

    const arms: CrossArmOption[] = [
      { dir: 'top', iconId: 12, state: 0, labelZh: tr('戰況一覽 (Overview)', '战况一览 (Overview)', 'Battle Overview'), enabled: true, action: 'overview' },
      { dir: 'left', iconId: 13, state: 0, labelZh: tr('戰場存檔 (Save)', '战场存档 (Save)', 'Save Game'), enabled: true, action: 'save' },
      { dir: 'right', iconId: 14, state: 0, labelZh: tr('戰場讀檔 (Load)', '战场读档 (Load)', 'Load Game'), enabled: true, action: 'load' },
      { dir: 'bottom', iconId: 15, state: 0, labelZh: tr('返回標題 (Quit)', '返回标题 (Quit)', 'Return to Title'), enabled: true, action: 'quit' },
    ];

    this.crossMenu.openCross(
      tx,
      ty,
      arms,
      (action) => {
        this.playUiSfx('confirm');
        if (action === 'overview') {
          this.crossMenu.close();
          this.uiState = 'idle';
          this.modals.openBattleSituationModal(ch, this.turn, this.gold, this.activeUnits, (u) => {
            this.centerCameraOnTile(u.x, u.y);
            this.updateInspectorPanel(u);
          });
        } else if (action === 'save') {
          this.crossMenu.close();
          this.uiState = 'idle';
          this.modals.openSaveLoadModal(
            'save',
            () => this.snapshotSaveData(),
            (s) => void this.loadFromSaveData(s)
          );
        } else if (action === 'load') {
          this.crossMenu.close();
          this.uiState = 'idle';
          this.modals.openSaveLoadModal(
            'load',
            () => this.snapshotSaveData(),
            (s) => void this.loadFromSaveData(s)
          );
        } else if (action === 'quit') {
          this.crossMenu.openYesNo({
            tileX: tx,
            tileY: ty,
            speakerPortraitId: 75,
            speakerNameZh: getLocalizedUnitName(75, '系統侍女'),
            promptZh: tr('確定要離開戰場返回標題畫面嗎？', '确定要离开战场返回标题画面吗？', 'Leave the battlefield and return to the Title Screen?'),
            selected: 'no',
            onConfirmYes: () => {
              this.uiState = 'idle';
              this.titleScreenEl.classList.remove('hidden');
            },
            onCancelNo: () => {
              this.uiState = 'idle';
            },
          });
        }
      },
      () => this.handleRightClickCancel()
    );
  }

  /** Opens `GLOBAL_2_7855` Settings Sub-Cross (`[18/19 音樂, 20/21 音效, 22/23 戰鬥動畫, 24/25 血條顯示]`). */
  private openSettingsSubCrossMenu(tx: number, ty: number): void {
    this.uiState = 'settings_sub_cross';
    const bgmMuted = this.sound.isMuted();
    const fastCombat = this.cutscene.getSpeedLabel().includes('Instant');

    const arms: CrossArmOption[] = [
      {
        dir: 'top',
        iconId: bgmMuted ? 19 : 18,
        state: 0,
        labelZh: `${tr('背景音樂', '背景音乐', 'BGM')}：${bgmMuted ? tr('關', '关', 'Off') : tr('開', '开', 'On')}`,
        enabled: true,
        action: 'toggle_bgm',
      },
      {
        dir: 'left',
        iconId: this.sfxEnabled ? 20 : 21,
        state: 0,
        labelZh: `${tr('戰場音效', '战场音效', 'SFX')}：${this.sfxEnabled ? tr('開', '开', 'On') : tr('關', '关', 'Off')}`,
        enabled: true,
        action: 'toggle_sfx',
      },
      {
        dir: 'right',
        iconId: fastCombat ? 23 : 22,
        state: 0,
        labelZh: `${tr('戰鬥動畫', '战斗动画', 'Combat Anim')}：${this.cutscene.getSpeedLabel().replace('Anim: ', '')}`,
        enabled: true,
        action: 'toggle_anim',
      },
      {
        dir: 'bottom',
        iconId: this.showHpBarsOnMap ? 24 : 25,
        state: 0,
        labelZh: `${tr('地圖血條', '地图血条', 'Map HP Bars')}：${this.showHpBarsOnMap ? tr('顯示', '显示', 'Shown') : tr('隱藏', '隐藏', 'Hidden')}`,
        enabled: true,
        action: 'toggle_bars',
      },
    ];

    this.crossMenu.openCross(
      tx,
      ty,
      arms,
      (action) => {
        if (action === 'toggle_bgm') {
          const muted = this.sound.toggleMute();
          document.getElementById('btn-bgm-toggle')!.textContent = `${tr('音樂', '音乐', 'BGM')}: ${muted ? tr('關', '关', 'Off') : tr('開', '开', 'On')}`;
        } else if (action === 'toggle_sfx') {
          this.sfxEnabled = !this.sfxEnabled;
        } else if (action === 'toggle_anim') {
          const lbl = this.cutscene.cycleSpeed().replace('Anim: ', '');
          document.getElementById('btn-anim-speed')!.textContent = `${tr('動畫', '动画', 'Anim')}: ${lbl}`;
        } else if (action === 'toggle_bars') {
          this.showHpBarsOnMap = !this.showHpBarsOnMap;
        }
        this.playUiSfx('cursor');
        this.openSettingsSubCrossMenu(tx, ty);
      },
      () => this.handleRightClickCancel()
    );
  }

  private promptEndTurnWithMilan(tx: number, ty: number): void {
    const unacted = this.activeUnits.filter((u) => u.faction === 'player' && !u.acted && u.paralyzeTurns === 0).length;
    this.crossMenu.openYesNo({
      tileX: tx,
      tileY: ty,
      speakerPortraitId: 75, // `#75 系統侍女`!
      speakerNameZh: getLocalizedUnitName(75, '系統侍女'),
      promptZh:
        unacted > 0
          ? tr(
              `還有 ${unacted} 名隊員未行動，要結束本回合嗎？`,
              `还有 ${unacted} 名队员未行动，要结束本回合吗？`,
              `${unacted} hero(es) have not acted yet. End this turn?`
            )
          : tr('要結束本回合的行動嗎？', '要结束本回合的行动吗？', 'End Player Phase for this turn?'),
      selected: 'yes',
      onConfirmYes: () => {
        void this.endPlayerPhase();
      },
      onCancelNo: () => {
        this.uiState = 'idle';
      },
    });
  }

  private openSpellBookPopup(u: BattleUnit): void {
    const gd = this.assets.gameData;
    const isTw = getLocale() === 'zh-TW';
    this.reachableMap.clear();
    this.targetTiles.clear();
    this.uiState = 'choosing_spell';
    const didMove = this.moveOrigin ? u.x !== this.moveOrigin[0] || u.y !== this.moveOrigin[1] : u.moved;
    let firstActiveMarked = false;
    const btns = u.spells
      .map((sid) => {
        const sp = gd.spells[sid];
        if (!sp) return '';
        // `#23 傳送術` (Teleport Spell) can only be cast BEFORE moving (`!didMove`, matching `FD2.EXE` and Chiuinan line 1082)!
        const ok = u.mp >= sp.mpCost && (sp.id !== 23 || !didMove);
        const isFirstActive = ok && !firstActiveMarked;
        if (isFirstActive) firstActiveMarked = true;
        return `<button class="dos-popup-item ${isFirstActive ? 'active' : ''}" data-sp="${sid}" ${ok ? '' : 'disabled'} type="button">
          <span class="dos-popup-item-main">
            <span class="dos-popup-cursor">▶</span>
            ${this.assets.glyphsToHtml(sp.nameGlyphs, 'ivory', 16, sp.nameZh)}
            ${isTw ? `<span style="color:#ffffff;">${sp.nameZh}</span>` : ''}
          </span>
          <span class="dos-popup-meta">${sp.mpCost} MP</span>
        </button>`;
      })
      .join('');
    this.subPopupEl.innerHTML = `
      <div class="dos-popup-header">
        <span>${tr('選擇法術', '选择法术', 'Select Spell')}</span>
        <span style="color:#7fe0ff;">MP ${u.mp}/${u.maxMp}</span>
      </div>
      <div class="dos-popup-list">${btns}</div>
      <button class="dos-popup-back" id="act-back" type="button">✕ ${tr('返回選單 (右鍵)', '返回选单 (右键)', 'Back (Right-Click)')}</button>
    `;
    this.positionSubPopupNearUnit(u, 'list');

    this.subPopupEl.querySelector('#act-back')?.addEventListener('click', () => this.handleRightClickCancel());
    this.subPopupEl.querySelectorAll<HTMLButtonElement>('[data-sp]').forEach((b) => {
      b.addEventListener('mouseenter', () => {
        this.subPopupEl.querySelectorAll('.dos-popup-item').forEach((el) => el.classList.remove('active'));
        b.classList.add('active');
      });
      b.addEventListener('click', () => {
        const sp = gd.spells[Number(b.dataset.sp)];
        if (!sp || !this.chapter) return;
        this.playUiSfx('confirm');
        this.reachableMap.clear();
        this.activeSpell = sp;
        this.uiState = 'targeting_spell';
        if (sp.id === 23) {
          // `#23 傳送術` Step 1: Select self (`dist === 0`) or an adjacent friendly unit (`dist === 1`)!
          const coords = getAttackableCoordinates(u.x, u.y, 0, Math.max(1, sp.castRange), this.chapter);
          this.targetTiles = new Set(coords.map(([x, y]) => coordKey(x, y)));
          this.showUnitTargetingHint(
            u,
            tr(
              `施展 <strong>${sp.nameZh}</strong> —（步驟 1/2）請點選自身或相鄰我軍目標`,
              `施展 <strong>${sp.nameZh}</strong> —（步骤 1/2）请点选自身或相邻我军目标`,
              `Cast <strong>${sp.nameZh}</strong> — (Step 1/2) Select self or an adjacent ally`
            )
          );
        } else {
          const coords = getSpellCastCoordinates(u.x, u.y, sp, this.chapter);
          this.targetTiles = new Set(coords.map(([x, y]) => coordKey(x, y)));
          this.showUnitTargetingHint(
            u,
            tr(
              `施展 <strong>${sp.nameZh}</strong>（範圍 ${sp.aoe}）— 請點選目標格`,
              `施展 <strong>${sp.nameZh}</strong>（范围 ${sp.aoe}）— 请点选目标格`,
              `Cast <strong>${sp.nameZh}</strong> (AoE ${sp.aoe}) — Click target tile`
            )
          );
        }
      });
    });
  }

  private openItemBagSelectionPopup(u: BattleUnit, mode: 'use' | 'give' | 'equip' | 'discard'): void {
    const gd = this.assets.gameData;
    const eq = getEquippedStats(u, gd);
    const isTw = getLocale() === 'zh-TW';
    this.reachableMap.clear();
    this.targetTiles.clear();
    this.uiState = 'choosing_item_list';

    const modeTitle =
      mode === 'use'
        ? tr('使用道具', '使用道具', 'Use Item')
        : mode === 'give'
          ? tr('傳遞道具', '传递道具', 'Give Item')
          : mode === 'equip'
            ? tr('更換裝備', '更换装备', 'Equip Item')
            : tr('丟棄道具', '丢弃道具', 'Discard Item');

    let firstActiveMarked = false;
    const btns = u.items
      .map((iid, idx) => {
        const it = gd.items[iid];
        if (!it) return '';
        let enabled = true;
        if (mode === 'use') enabled = isItemUsableInBattle(it);
        else if (mode === 'equip') enabled = (it.category === 'weapon' || it.category === 'armor') && canUnitEquipItem(u, it, gd);

        const isEq = idx === eq.weaponIdx || idx === eq.armorIdx;
        const eqTag = isEq
          ? tr('[裝備中]', '[装备中]', '[E]')
          : it.category === 'weapon'
            ? `AP+${it.ap}`
            : it.category === 'armor'
              ? `DP+${it.dp}`
              : '';
        const isFirstActive = enabled && !firstActiveMarked;
        if (isFirstActive) firstActiveMarked = true;
        return `<button class="dos-popup-item ${isFirstActive ? 'active' : ''}" data-bag="${idx}" ${enabled ? '' : 'disabled'} type="button">
          <span class="dos-popup-item-main">
            <span class="dos-popup-cursor">▶</span>
            ${this.assets.glyphsToHtml(it.nameGlyphs, 'ivory', 16, it.nameZh)}
            ${isTw ? `<span style="color:#ffffff;">${it.nameZh}</span>` : ''}
          </span>
          <span class="dos-popup-meta" style="${isEq ? 'color:#86efac;' : ''}">${eqTag}</span>
        </button>`;
      })
      .join('');

    this.subPopupEl.innerHTML = `
      <div class="dos-popup-header">
        <span>${modeTitle}</span>
        <span style="color:#e8f1ff;">${u.items.length}/8</span>
      </div>
      <div class="dos-popup-list">${btns}</div>
      <button class="dos-popup-back" id="act-back" type="button">✕ ${tr('返回選單 (右鍵)', '返回选单 (右键)', 'Back (Right-Click)')}</button>
    `;
    this.positionSubPopupNearUnit(u, 'list');

    this.subPopupEl.querySelector('#act-back')?.addEventListener('click', () => this.handleRightClickCancel());
    this.subPopupEl.querySelectorAll<HTMLButtonElement>('[data-bag]').forEach((b) => {
      b.addEventListener('mouseenter', () => {
        this.subPopupEl.querySelectorAll('.dos-popup-item').forEach((el) => el.classList.remove('active'));
        b.classList.add('active');
      });
      b.addEventListener('click', () => {
        const slotIdx = Number(b.dataset.bag);
        const it = gd.items[u.items[slotIdx]];
        if (!it || !this.chapter) return;

        if (mode === 'use') {
          const useRange = it.useRange ?? 1;
          if (useRange === 0) {
            // Self-only permanent stat potions (`#94..#96`, `#198..#200`) execute immediately on `u`
            const msg = useConsumable(u, slotIdx, gd, u);
            this.playUiSfx('heal');
            this.spawnMapFlash(u.x, u.y, '#68dfa0', msg);
            this.logMessage(`${this.assets.glyphsToHtml(u.nameGlyphs, 'gold', 14, u.nameZh)} ${msg}`);
            void this.finishSelectedUnitTurn();
          } else {
            // Ranged / Adjacent / AoE item (`#192..#197` at range 0..1, `#102 修理套件` at range 0..4 AoE 2, `#101 傳送法杖` at range 1..1, or reusable staves/weapons!)
            this.reachableMap.clear();
            this.pendingUseItemBagIdx = slotIdx;
            this.uiState = 'targeting_use_item';
            // `#101 傳送法杖` (`useEffect === 23`) targets an adjacent ally (`dist === 1`, cannot target self, per `fn_74122` & Chiuinan line 1082)!
            const minR = it.useEffect === 23 || it.useTarget === 'enemy' ? 1 : 0;
            const coords = getAttackableCoordinates(u.x, u.y, minR, Math.max(minR, useRange), this.chapter);
            this.targetTiles = new Set(coords.map(([cx, cy]) => coordKey(cx, cy)));
            if (it.useEffect === 23) {
              this.showUnitTargetingHint(
                u,
                tr(
                  `使用 <strong>${it.nameZh}</strong> —（步驟 1/2）請點選相鄰我軍目標`,
                  `使用 <strong>${it.nameZh}</strong> —（步骤 1/2）请点选相邻我军目标`,
                  `Use <strong>${it.nameZh}</strong> — (Step 1/2) Select an adjacent ally`
                )
              );
            } else {
              const aoeLabel =
                (it.useAoe ?? 0) > 0
                  ? tr(`（射程 ${useRange} · 範圍 ${it.useAoe}）`, `（射程 ${useRange} · 范围 ${it.useAoe}）`, ` (RNG ${useRange} · AoE ${it.useAoe})`)
                  : tr(`（射程 ${useRange}）`, `（射程 ${useRange}）`, ` (RNG ${useRange})`);
              this.showUnitTargetingHint(
                u,
                tr(
                  `請點選目標格使用 <strong>${it.nameZh}</strong>${aoeLabel}`,
                  `请点选目标格使用 <strong>${it.nameZh}</strong>${aoeLabel}`,
                  `Click target tile to use <strong>${it.nameZh}</strong>${aoeLabel}`
                )
              );
            }
          }
        } else if (mode === 'equip') {
          if (it.category === 'weapon') u.equippedWeaponIdx = slotIdx;
          else if (it.category === 'armor') u.equippedArmorIdx = slotIdx;
          syncUnitEquipmentIndices(u, gd);
          this.playUiSfx('confirm');
          this.updateInspectorPanel(u);
          this.openUnitActionCrossMenu('top');
        } else if (mode === 'discard') {
          u.items.splice(slotIdx, 1);
          syncUnitEquipmentIndices(u, gd);
          this.playUiSfx('cancel');
          this.logMessage(
            `${this.assets.glyphsToHtml(u.nameGlyphs, 'gold', 14, u.nameZh)} ${tr(`丟棄了 ${it.nameZh}。`, `丢弃了 ${it.nameZh}。`, `discarded ${it.nameZh}.`)}`
          );
          this.updateInspectorPanel(u);
          this.openUnitActionCrossMenu('bottom');
        } else if (mode === 'give') {
          this.reachableMap.clear();
          this.pendingGiveItemBagIdx = slotIdx;
          this.uiState = 'targeting_give_ally';
          const adjAllies = this.activeUnits.filter(
            (other) =>
              other.faction === 'player' &&
              other.runtimeId !== u.runtimeId &&
              manhattan(u.x, u.y, other.x, other.y) === 1 &&
              other.items.length < 8
          );
          this.targetTiles = new Set(adjAllies.map((a) => coordKey(a.x, a.y)));
          this.showUnitTargetingHint(
            u,
            tr(
              `請點選相鄰隊員傳遞 <strong>${it.nameZh}</strong>`,
              `请点选相邻队员传递 <strong>${it.nameZh}</strong>`,
              `Select an adjacent ally to give <strong>${it.nameZh}</strong>`
            )
          );
        }
      });
    });
  }

  /**
   * Step 2 of `fn_74122` (`GLOBAL_2_7425[23]` — `#23 傳送術` & `#101 傳送法杖`):
   * Highlights all passable, unoccupied destination tiles on the map for `targetUnit`.
   */
  private beginTeleportDestinationSelection(targetUnit: BattleUnit, fromItemBagIdx: number | null): void {
    if (!this.chapter) return;
    this.playUiSfx('confirm');
    this.reachableMap.clear();
    this.pendingTeleportTargetUnit = targetUnit;
    this.pendingTeleportFromItemBagIdx = fromItemBagIdx;
    this.uiState = 'targeting_teleport_dest';

    const validDest = getValidTeleportDestinationTiles(
      targetUnit,
      this.chapter,
      this.activeUnits,
      this.assets.gameData
    );
    this.targetTiles = new Set(validDest.map(([dx, dy]) => coordKey(dx, dy)));

    const sourceLabel =
      fromItemBagIdx !== null && this.selectedUnit
        ? this.assets.gameData.items[this.selectedUnit.items[fromItemBagIdx]]?.nameZh ?? tr('傳送法杖', '传送法杖', 'Warp Staff')
        : this.activeSpell?.nameZh ?? tr('傳送術', '传送术', 'Teleport');
    this.showUnitTargetingHint(
      targetUnit,
      tr(
        `<strong>${sourceLabel}</strong> —（步驟 2/2）請點選地圖上任意可通行空地傳送 <strong>${targetUnit.nameZh}</strong>`,
        `<strong>${sourceLabel}</strong> —（步骤 2/2）请点选地图上任意可通行空地传送 <strong>${targetUnit.nameZh}</strong>`,
        `<strong>${sourceLabel}</strong> — (Step 2/2) Click any open passable tile to warp <strong>${targetUnit.nameZh}</strong>`
      )
    );
  }

  /**
   * Executes Step 2 of `fn_74122` (`#23 傳送術` or `#101 傳送法杖` `useEffect === 23`):
   *  - Teleports `targetUnit` to `(destX, destY)` with `FDOTHER[9]` sparkles.
   *  - If cast via `#23 傳送術` (`fromItemBagIdx === null`), deducts `spell.mpCost` (`15 MP`) and grants support spell EXP (`fn_51478`).
   *  - If used via `#101 傳送法杖` (`fromItemBagIdx !== null`), consumes 0 MP and grants 0 EXP (per `fn_74122` & Chiuinan line 1082).
   */
  private async executeTeleportToTile(
    actor: BattleUnit,
    targetUnit: BattleUnit,
    destX: number,
    destY: number,
    spell: SpellDef | null,
    fromItemBagIdx: number | null
  ): Promise<void> {
    if (!this.chapter) return;
    const gd = this.assets.gameData;

    if (fromItemBagIdx === null && spell) {
      actor.mp = Math.max(0, actor.mp - spell.mpCost);
    }

    await this.director.playSparklesOnUnits([targetUnit]);
    targetUnit.x = destX;
    targetUnit.y = destY;
    await this.ensureTileVisibleOnMap(destX, destY, 160);
    await this.director.playSparklesOnUnits([targetUnit]);

    const sourceLabel =
      fromItemBagIdx !== null
        ? gd.items[actor.items[fromItemBagIdx]]?.nameZh ?? tr('傳送法杖', '传送法杖', 'Teleport Staff')
        : spell?.nameZh ?? tr('傳送術', '传送术', 'Teleport');
    this.logMessage(
      `${this.assets.glyphsToHtml(actor.nameGlyphs, 'azure', 14, actor.nameZh)} ${tr('使用', '使用', 'used')} <strong>${sourceLabel}</strong> ${tr('將', '将', 'to teleport')} ${this.assets.glyphsToHtml(targetUnit.nameGlyphs, 'gold', 14, targetUnit.nameZh)} ${tr(`傳送至 (${destX}, ${destY})！`, `传送至 (${destX}, ${destY})！`, `to (${destX}, ${destY})!`)}`
    );

    // `#23 傳送術` (spell) awards support spell EXP (`fn_51478`: `floor(10 * targetEffLv / casterEffLv)`), whereas `#101 傳送法杖` (item) awards 0 EXP!
    if (fromItemBagIdx === null && actor.faction === 'player' && actor.hp > 0) {
      const casterEffLv = getUnitEffectiveExpLevel(actor, gd);
      const targetEffLv = getUnitEffectiveExpLevel(targetUnit, gd);
      const expGain = Math.min(99, Math.max(1, Math.floor((10 * targetEffLv) / casterEffLv)));
      const levelUp = applyExpAndCheckLevelUp(actor, expGain, gd);
      await this.showUnitExpAndLevelUpDialogue(actor, expGain, levelUp);
    }

    if (targetUnit.runtimeId !== actor.runtimeId && targetUnit.faction === 'player' && targetUnit.hp > 0) {
      await this.checkUnitStepTileEvent(targetUnit);
    }

    this.resetAllUnitsToFrontView();
    this.updateTopHud();
    if (actor.hp > 0) this.updateInspectorPanel(actor);
  }

  private async handleTileClick(tx: number, ty: number): Promise<void> {
    if (!this.chapter || this.phase !== 'player' || this.uiState === 'busy') return;

    const clickedUnit = this.activeUnits.find((u) => u.x === tx && u.y === ty);

    if (this.uiState === 'idle') {
      if (clickedUnit) {
        this.playUiSfx('cursor');
        this.updateInspectorPanel(clickedUnit);
        if (
          clickedUnit.faction === 'player' &&
          !clickedUnit.acted &&
          !clickedUnit.moved &&
          clickedUnit.paralyzeTurns === 0
        ) {
          this.selectPlayerUnit(clickedUnit);
        } else {
          // Do NOT show movement range for already moved/acted player units, enemy units, or ally NPC units!
          this.reachableMap.clear();
          this.targetTiles.clear();
        }
      } else {
        this.reachableMap.clear();
        this.targetTiles.clear();
        this.playUiSfx('cursor');
        this.openEmptyTileCrossMenu(tx, ty);
      }
      return;
    }

    if (this.uiState === 'unit_selected' && this.selectedUnit) {
      const key = coordKey(tx, ty);
      if (this.reachableMap.has(key)) {
        const path = reconstructPath(this.reachableMap, tx, ty);
        this.reachableMap.clear();
        await this.animateUnitWalk(this.selectedUnit, path);
        this.selectedUnit.moved = path.length > 1;
        this.openUnitActionCrossMenu();
      } else if (
        clickedUnit &&
        clickedUnit.faction === 'player' &&
        !clickedUnit.acted &&
        !clickedUnit.moved &&
        clickedUnit.paralyzeTurns === 0
      ) {
        this.playUiSfx('cursor');
        this.selectPlayerUnit(clickedUnit);
      } else {
        if (clickedUnit) {
          this.updateInspectorPanel(clickedUnit);
        }
        this.handleRightClickCancel();
      }
      return;
    }

    if (this.uiState === 'choosing_spell' || this.uiState === 'choosing_item_list') {
      this.handleRightClickCancel();
      return;
    }

    if (this.uiState === 'targeting_teleport_dest' && this.selectedUnit && this.pendingTeleportTargetUnit) {
      if (this.targetTiles.has(coordKey(tx, ty))) {
        const actor = this.selectedUnit;
        const targetUnit = this.pendingTeleportTargetUnit;
        const sp = this.activeSpell;
        const bagIdx = this.pendingTeleportFromItemBagIdx;
        this.uiState = 'busy';
        this.pendingTeleportTargetUnit = null;
        this.pendingTeleportFromItemBagIdx = null;
        this.pendingUseItemBagIdx = null;
        this.activeSpell = null;
        this.targetTiles.clear();
        this.hideSubPopupAndForecast();
        await this.executeTeleportToTile(actor, targetUnit, tx, ty, sp, bagIdx);
        await this.finishSelectedUnitTurn();
      } else {
        this.handleRightClickCancel();
      }
      return;
    }

    if (this.uiState === 'targeting_use_item' && this.selectedUnit && this.pendingUseItemBagIdx !== null) {
      if (this.targetTiles.has(coordKey(tx, ty))) {
        const bagIdx = this.pendingUseItemBagIdx;
        const usedItem = this.assets.gameData.items[this.selectedUnit.items[bagIdx]];
        if (usedItem?.useEffect === 23) {
          // `#101 傳送法杖` Step 1: Must click an adjacent friendly unit (`dist === 1`, cannot target self)!
          if (
            clickedUnit &&
            !areHostile(this.selectedUnit.faction, clickedUnit.faction) &&
            clickedUnit.runtimeId !== this.selectedUnit.runtimeId
          ) {
            this.beginTeleportDestinationSelection(clickedUnit, bagIdx);
          } else {
            this.handleRightClickCancel();
          }
          return;
        }
        this.uiState = 'busy';
        this.pendingUseItemBagIdx = null;
        this.targetTiles.clear();
        this.hideSubPopupAndForecast();
        await this.performItemUseAtTile(this.selectedUnit, bagIdx, tx, ty);
        await this.finishSelectedUnitTurn();
      } else {
        this.handleRightClickCancel();
      }
      return;
    }

    if (this.uiState === 'targeting_give_ally' && this.selectedUnit && this.pendingGiveItemBagIdx !== null) {
      if (clickedUnit && clickedUnit.faction === 'player' && this.targetTiles.has(coordKey(tx, ty))) {
        const [givenId] = this.selectedUnit.items.splice(this.pendingGiveItemBagIdx, 1);
        syncUnitEquipmentIndices(this.selectedUnit, this.assets.gameData);
        clickedUnit.items.push(givenId);
        syncUnitEquipmentIndices(clickedUnit, this.assets.gameData);
        const it = this.assets.gameData.items[givenId];
        this.pendingGiveItemBagIdx = null;
        this.targetTiles.clear();
        this.hideSubPopupAndForecast();
        this.playUiSfx('chest');
        this.logMessage(
          `${this.assets.glyphsToHtml(this.selectedUnit.nameGlyphs, 'gold', 14, this.selectedUnit.nameZh)} ${tr('將', '将', 'gave')} <strong>${it?.nameZh ?? tr('道具', '道具', 'Item')}</strong> ${tr('交給了', '交给了', 'to')} ${this.assets.glyphsToHtml(clickedUnit.nameGlyphs, 'gold', 14, clickedUnit.nameZh)}${tr('。', '。', '.')}`
        );
        await this.finishSelectedUnitTurn();
      } else {
        this.handleRightClickCancel();
      }
      return;
    }

    if (this.uiState === 'targeting_attack' && this.selectedUnit) {
      if (
        clickedUnit &&
        areHostile(this.selectedUnit.faction, clickedUnit.faction) &&
        this.targetTiles.has(coordKey(tx, ty))
      ) {
        this.uiState = 'busy';
        this.targetTiles.clear();
        this.hideSubPopupAndForecast();
        await this.performAttack(this.selectedUnit, clickedUnit);
        await this.finishSelectedUnitTurn();
      } else {
        this.handleRightClickCancel();
      }
      return;
    }

    if (this.uiState === 'targeting_spell' && this.selectedUnit && this.activeSpell) {
      if (this.targetTiles.has(coordKey(tx, ty))) {
        if (this.activeSpell.id === 23) {
          // `#23 傳送術` Step 1: Must click self or an adjacent friendly unit (`dist <= 1`)!
          if (clickedUnit && !areHostile(this.selectedUnit.faction, clickedUnit.faction)) {
            this.beginTeleportDestinationSelection(clickedUnit, null);
          } else {
            this.handleRightClickCancel();
          }
          return;
        }
        const sp = this.activeSpell;
        this.uiState = 'busy';
        this.targetTiles.clear();
        this.activeSpell = null;
        this.hideSubPopupAndForecast();
        await this.performSpellCast(this.selectedUnit, sp, tx, ty);
        await this.finishSelectedUnitTurn();
      } else {
        this.handleRightClickCancel();
      }
    }
  }

  /**
   * Authentic `FD2.EXE` `fn_13540()` (`Obj1+13540..13585`) Post-Action Front-View Facing Reset:
   *  - Loops through every active battlefield unit (`u.hp > 0`) and sets `u.dir = 0` (`0 = Down / Front View`).
   *  - Called in `FD2.EXE` after every Player action (`fn_34960`), Physical Combat (`fn_21646`, resetting both
   *    attacker and defender!), Spell/Teleport (`fn_20565`), and Ally/Enemy AI unit turn (`fn_15007 @16008`).
   */
  private resetAllUnitsToFrontView(): void {
    for (const u of this.renderedUnits) {
      if (u.hp > 0) {
        u.dir = 0;
      }
    }
  }

  /** Ensures at least one tactical map animation frame renders visibly before entering cutaway combat. */
  private async waitMapBeat(baseMs = 45): Promise<void> {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    const scale = Math.max(0.5, this.cutscene.getTickScale());
    const dur = Math.max(16, Math.round(baseMs * scale));
    await new Promise<void>((r) => setTimeout(r, dur));
  }

  /** Fast camera scroll if `(tx, ty)` lies outside the visible tactical viewport (`fn_11498`). */
  private async ensureTileVisibleOnMap(tx: number, ty: number, panMs = 150): Promise<void> {
    if (!this.chapter) return;
    if (this.chapter.isCutsceneMap) {
      this.centerCameraOnTile(tx, ty);
      return;
    }
    const tilePx = Math.round(24 * this.zoom);
    const W = this.battleCanvas.width;
    const H = this.battleCanvas.height;
    const screenX = (tx + 0.5) * tilePx - this.camX;
    const screenY = (ty + 0.5) * tilePx - this.camY;
    const marginX = Math.min(W * 0.18, tilePx * 2.0);
    const marginTop = Math.min(H * 0.18, tilePx * 1.8);
    const marginBot = Math.min(H * 0.24, tilePx * 2.4);
    if (screenX < marginX || screenX > W - marginX || screenY < marginTop || screenY > H - marginBot) {
      const scale = Math.max(0.5, this.cutscene.getTickScale());
      await this.panCameraSmoothToTile(tx, ty, Math.max(70, Math.round(panMs * scale)));
    }
  }

  /**
   * Authentic `FD2.EXE` `fn_13448 -> fn_11946/12301/12677/13077` Tactical Unit Walk:
   *  - Each `24×24` tile step executes `6` discrete `4-pixel` sub-steps (`4, 8, 12, 16, 20, 24` px = `1/6 .. 6/6` tile),
   *    synchronized in `FD2.EXE` via `fn_7856` (`0x3DA` VGA VSync) + `fn_13408` (`[0x46C]` timer tick gate).
   *  - At `18 ms` per `4px` sub-step (`6 × 18 ms = 108 ms/tile` at `1x`, `54 ms/tile` at `2x`), every single one of the
   *    original 6 `4px` sub-steps renders cleanly on a 60Hz display while keeping 4–5 tile moves crisp (~0.43–0.54s).
   *  - Camera scrolls in exact `4px` lockstep whenever the unit steps within `2` tiles of the viewport border.
   */
  private async animateUnitWalk(unit: BattleUnit, path: [number, number][]): Promise<void> {
    this.lastWalkPath = path.slice();
    if (path.length <= 1) return;
    const prevState = this.uiState;
    this.uiState = 'busy';

    await this.ensureTileVisibleOnMap(path[0][0], path[0][1], 150);

    const totalSegments = path.length - 1;
    const scale = Math.max(0.5, this.cutscene.getTickScale());
    const subStepMs = Math.max(9, Math.round(18 * scale));
    const msPerTile = subStepMs * 6;
    const totalDurationMs = totalSegments * msPerTile;
    let lastSubStepCounter = -1;

    const updateFacing = (ax: number, ay: number, bx: number, by: number) => {
      const dx = bx - ax;
      const dy = by - ay;
      if (dx > 0) unit.dir = 3;
      else if (dx < 0) unit.dir = 1;
      else if (dy < 0) unit.dir = 2;
      else unit.dir = 0;
    };

    const t0 = performance.now();
    await new Promise<void>((resolve) => {
      const step = (now: number) => {
        const elapsed = Math.max(0, now - t0);
        const progress = Math.min(totalSegments, elapsed / msPerTile);
        const segIdx = Math.min(totalSegments - 1, Math.floor(progress));
        const rawFrac = progress - segIdx;
        // Quantize to `FD2.EXE`'s 6 discrete `4px` (`1/6` tile) sub-steps (`1/6, 2/6, 3/6, 4/6, 5/6, 6/6`)
        const subStepInSeg = Math.min(5, Math.floor(rawFrac * 6));
        const quantFrac = (subStepInSeg + 1) / 6;
        const totalSubStep = segIdx * 6 + subStepInSeg;

        if (totalSubStep !== lastSubStepCounter) {
          for (let s = lastSubStepCounter + 1; s <= totalSubStep; s++) {
            if (this.sfxEnabled) {
              this.sound.playUnitWalkStepSfx(unit, s);
            }
          }
          lastSubStepCounter = totalSubStep;
        }

        const [sx, sy] = path[segIdx];
        const [nx, ny] = path[segIdx + 1];
        updateFacing(sx, sy, nx, ny);
        unit.x = sx;
        unit.y = sy;
        unit.renderX = sx + (nx - sx) * quantFrac;
        unit.renderY = sy + (ny - sy) * quantFrac;

        if (!this.chapter?.isCutsceneMap) {
          const tilePx = Math.round(24 * this.zoom);
          const W = this.battleCanvas.width;
          const H = this.battleCanvas.height;
          const scrX = (unit.renderX + 0.5) * tilePx - this.camX;
          const scrY = (unit.renderY + 0.5) * tilePx - this.camY;
          const pad = tilePx * 2.0;
          if (scrX < pad) this.camX -= pad - scrX;
          else if (scrX > W - pad) this.camX += scrX - (W - pad);
          if (scrY < pad) this.camY -= pad - scrY;
          else if (scrY > H - pad * 1.3) this.camY += scrY - (H - pad * 1.3);
          this.clampCamera();
        }

        if (elapsed < totalDurationMs) {
          requestAnimationFrame(step);
        } else {
          const [fx, fy] = path[totalSegments];
          const [px, py] = path[totalSegments - 1];
          updateFacing(px, py, fx, fy);
          unit.x = fx;
          unit.y = fy;
          unit.renderX = undefined;
          unit.renderY = undefined;
          resolve();
        }
      };
      requestAnimationFrame(step);
    });

    this.uiState = prevState;
  }

  private async executeUnitRestOrChest(u: BattleUnit, canLootChest: boolean): Promise<void> {
    const didMove = this.moveOrigin ? u.x !== this.moveOrigin[0] || u.y !== this.moveOrigin[1] : u.moved;
    // Exact `FD2.EXE` (`L36983..L37008`): Unmoved rest heal (`fn_16340`) runs BEFORE checking/prompting chest (`fn_37036`)!
    if (!didMove && u.hp > 0 && u.hp < u.maxHp && u.poisonTurns === 0 && u.paralyzeTurns === 0) {
      const restHeal = Math.max(1, Math.floor(u.maxHp * 0.2));
      u.hp = Math.min(u.maxHp, u.hp + restHeal);
      this.playUiSfx('heal');
      this.spawnMapFlash(u.x, u.y, '#68dfa0', `${tr('休息', '休息', 'REST')} +${restHeal}`);
      await this.director.playSparklesOnUnits([u]);
    }
    if (canLootChest) {
      await this.lootTreasureAt(u);
    }
    await this.finishSelectedUnitTurn();
  }

  /**
   * Authentic `FD2.EXE` `fn_37036` + `fn_8803` Treasure Chest & Hidden Ground Item Operation:
   *  1. Prompts `[YES / NO!]` with the unit's own portrait (`是否打開寶箱？` or `發現東西，是否拾取？`).
   *  2. On opening a visible chest (`(flags & 0x40) === 0`), increments `cell[0] += 1` (swapping to the `FDSHAP` open-chest tile!)
   *     and sets `cell[1] = 0`.
   *  3. If the unit's 8-slot bag is full (`unit.items.length >= 8`), NEVER converts items into gold — instead prompts to swap
   *     one of the 8 carried items into the chest (`chestDef.value = swappedItemId`) or leave the chest unopened!
   */
  private async lootTreasureAt(unit: BattleUnit): Promise<void> {
    if (!this.chapter) return;
    const cell = this.chapter.cells[unit.y]?.[unit.x];
    if (!cell) return;
    const isHiddenGroundItem = (cell[4] & 0x40) !== 0;

    const wantOpen = await new Promise<boolean>((resolve) => {
      this.crossMenu.openYesNo({
        tileX: unit.x,
        tileY: unit.y,
        speakerPortraitId: unit.portraitId,
        speakerNameZh: unit.nameZh,
        promptZh: isHiddenGroundItem
          ? tr('發現東西！是否拾取？', '发现东西！是否拾取？', 'Found something on the ground! Pick it up?')
          : tr('發現寶箱！是否打開寶箱？', '发现宝箱！是否打开宝箱？', 'Found a treasure chest! Open it?'),
        selected: 'yes',
        onConfirmYes: () => resolve(true),
        onCancelNo: () => resolve(false),
      });
    });
    if (!wantOpen || !this.chapter) return;

    const markChestOpenedOnMap = () => {
      const key = coordKey(unit.x, unit.y);
      this.openedChests.add(key);
      // Exact `FD2.EXE` `fn_8803` (`L8885..L8916`): increment map cell tileId by +1 for visible chests and clear chest flags!
      if (!isHiddenGroundItem) {
        cell[0] += 1;
      }
      cell[1] = 0;
      cell[4] &= ~(2 | 0x40);
    };

    const tinfo = getTerrainInfo(this.chapter, unit.x, unit.y);
    const chestDef =
      this.chapter.chests.find((c) => c.chestIndex === tinfo.eventId) ??
      null;

    if (chestDef && chestDef.type === 'event') {
      const openedOk = await this.director.runMidBattleEvent(chestDef.value, unit, chestDef.chestIndex);
      if (openedOk) {
        markChestOpenedOnMap();
        this.playUiSfx('chest');
        syncUnitEquipmentIndices(unit, this.assets.gameData);
      }
      return;
    }

    if (chestDef && chestDef.type === 'gold' && chestDef.value > 0) {
      markChestOpenedOnMap();
      this.playUiSfx('chest');
      this.gold += chestDef.value;
      this.updateTopHud();
      this.spawnMapFlash(unit.x, unit.y, '#f0c869', `+${chestDef.value} G!`);
      this.logMessage(
        `${this.assets.glyphsToHtml(unit.nameGlyphs, 'gold', 14, unit.nameZh)} ${tr(
          `打開寶箱獲得 <strong>${chestDef.value} G</strong>！`,
          `打开宝箱获得 <strong>${chestDef.value} G</strong>！`,
          `opened the chest and found <strong>${chestDef.value} G</strong>!`
        )}`
      );
      return;
    }

    if (chestDef && chestDef.value > 0) {
      const iid = chestDef.value < this.assets.gameData.items.length ? chestDef.value : 192;
      const it = this.assets.gameData.items[iid];
      const itemName = it?.nameZh ?? tr('寶物', '宝物', 'Treasure');
      if (unit.items.length < 8) {
        markChestOpenedOnMap();
        this.playUiSfx('chest');
        unit.items.push(iid);
        syncUnitEquipmentIndices(unit, this.assets.gameData);
        this.spawnMapFlash(unit.x, unit.y, '#f0c869', `${itemName}!`);
        this.logMessage(
          `${this.assets.glyphsToHtml(unit.nameGlyphs, 'gold', 14, unit.nameZh)} ${tr(
            '打開寶箱獲得',
            '打开宝箱获得',
            'opened the chest and obtained'
          )} ${this.assets.glyphsToHtml(it?.nameGlyphs ?? [], 'gold', 14, itemName)} <strong>(${itemName})</strong>！`
        );
      } else {
        // 8-slot bag is full -> `FD2.EXE` `L37538..L37780`: prompt to swap an item into the chest!
        const swappedSlotIdx = await this.promptFullBagItemChoice(
          unit,
          iid,
          tr(
            `寶箱內有「${itemName}」，但道具袋已滿（8/8）！請選擇要放入寶箱交換的道具，或放回寶箱：`,
            `宝箱内有「${itemName}」，但道具袋已满（8/8）！请选择要放入宝箱交换的道具，或放回宝箱：`,
            `Chest contains "${itemName}", but inventory is full (8/8)! Choose an item to swap into the chest:`
          )
        );
        if (swappedSlotIdx !== null) {
          const oldItemId = unit.items[swappedSlotIdx];
          const oldItem = this.assets.gameData.items[oldItemId];
          unit.items[swappedSlotIdx] = iid;
          chestDef.value = oldItemId; // Swapped item stays inside the chest for another unit!
          syncUnitEquipmentIndices(unit, this.assets.gameData);
          this.playUiSfx('chest');
          this.spawnMapFlash(unit.x, unit.y, '#f0c869', `${itemName}!`);
          this.logMessage(
            `${this.assets.glyphsToHtml(unit.nameGlyphs, 'gold', 14, unit.nameZh)} ${tr(
              `將 <strong>${oldItem?.nameZh ?? '道具'}</strong> 放入寶箱，換取了 <strong>${itemName}</strong>！`,
              `将 <strong>${oldItem?.nameZh ?? '道具'}</strong> 放入宝箱，换取了 <strong>${itemName}</strong>！`,
              `placed <strong>${oldItem?.nameZh ?? 'Item'}</strong> in the chest and took <strong>${itemName}</strong>!`
            )}`
          );
        } else {
          this.logMessage(
            `${this.assets.glyphsToHtml(unit.nameGlyphs, 'ivory', 14, unit.nameZh)} ${tr(
              '將寶物留在了寶箱中。',
              '将宝物留在了宝箱中。',
              'left the treasure in the chest.'
            )}`
          );
        }
      }
    }
  }

  /** Prompts the player when a unit's 8-slot bag is full (for chest item swap or enemy item drop discard). */
  private promptFullBagItemChoice(unit: BattleUnit, incomingItemId: number, messageZh: string): Promise<number | null> {
    const gd = this.assets.gameData;
    const incoming = gd.items[incomingItemId];
    const isTw = getLocale() === 'zh-TW';
    return new Promise<number | null>((resolve) => {
      const btns = unit.items
        .map((cid, idx) => {
          const cit = gd.items[cid];
          const cName = cit?.nameZh ?? tr('道具', '道具', 'Item');
          return `<button class="dos-popup-item ${idx === 0 ? 'active' : ''}" data-swap-slot="${idx}" type="button">
            <span class="dos-popup-item-main">
              <span class="dos-popup-cursor">▶</span>
              ${this.assets.glyphsToHtml(cit?.nameGlyphs ?? [], 'ivory', 15, cName)}
              ${isTw ? `<span style="color:#ffffff;">${cName}</span>` : ''}
            </span>
          </button>`;
        })
        .join('');
      this.subPopupEl.innerHTML = `
        <div class="dos-popup-header" style="flex-direction:column; align-items:flex-start; gap:3px;">
          <div style="display:flex; align-items:center; gap:5px; color:#fde68a;">
            ${this.assets.glyphsToHtml(incoming?.nameGlyphs ?? [], 'gold', 15, incoming?.nameZh ?? '')}
            <span>${incoming?.nameZh ?? ''}</span>
          </div>
          <span style="color:#ffffff; font-size:11.5px; font-weight:500;">${messageZh}</span>
        </div>
        <div class="dos-popup-list">${btns}</div>
        <button class="dos-popup-back" id="btn-cancel-fullbag" type="button">✕ ${tr('放棄 / 保持原狀', '放弃 / 保持原状', 'Leave It / Cancel')}</button>
      `;
      this.positionSubPopupNearUnit(unit, 'list');
      const finish = (choice: number | null) => {
        this.hideSubPopupAndForecast();
        resolve(choice);
      };
      this.subPopupEl.querySelector('#btn-cancel-fullbag')?.addEventListener('click', () => finish(null));
      this.subPopupEl.querySelectorAll<HTMLButtonElement>('[data-swap-slot]').forEach((b) => {
        b.addEventListener('mouseenter', () => {
          this.subPopupEl.querySelectorAll('.dos-popup-item').forEach((el) => el.classList.remove('active'));
          b.classList.add('active');
        });
        b.addEventListener('click', () => finish(Number(b.dataset.swapSlot)));
      });
    });
  }

  /**
   * 100% Authentic `FD2.EXE` `fn_56165` (`L56165..L57021`) On-Map Unit Death Sequence:
   *  - Finds all units with `!u.hidden && u.hp <= 0` (supports single combat kill, counterattack death, multi-target AoE spell kills, and lethal poison!).
   *  - **Phase A (`step = 0..12`, 13 ticks)**: Rotates dying units clockwise in a circle (`u.dir = (step % 4)` -> 3 full circles + final South pose).
   *  - **Phase B (`frame = 0..11`, 12 frames)**: Hides dying units (`u.hidden = true`), plays `'explosion'` SFX (`FDSND[0][3]`),
   *    and plays the 12 `FDOTHER[5][68..79]` PCX-RLE explosion sprites (`0..5` cumulative fireball + `6..11` expanding smoke ring) at `(-24, -30)`!
   */
  private async playDyingUnitsOnMapAnim(): Promise<void> {
    if (!this.chapter) return;
    const dying = this.slots.filter((u): u is BattleUnit => Boolean(u && !u.hidden && u.hp <= 0));
    if (dying.length === 0) return;

    // Ensure at least the first dying unit is visible in the tactical viewport
    this.centerCameraOnTile(dying[0].x, dying[0].y);

    const tickScale = this.cutscene.getTickScale();
    const spinStepMs = Math.max(22, Math.round(52 * tickScale));
    const expFrameMs = Math.max(24, Math.round(55 * tickScale));

    // Phase A: 13-step clockwise spin (`0=Down -> 1=Left -> 2=Up -> 3=Right` x 3 + `0=Down`)
    for (let step = 0; step < 13; step++) {
      const dir = (step % 4) as 0 | 1 | 2 | 3;
      for (const u of dying) {
        u.dir = dir;
      }
      await new Promise((r) => setTimeout(r, spinStepMs));
    }

    // Phase B: Hide units (`M1[slot+5] = 1`) and play 12-frame `FDOTHER[5][68..79]` explosion + SFX `#3`!
    for (const u of dying) {
      u.hidden = true;
    }
    this.playUiSfx('explosion');

    for (let frameIdx = 0; frameIdx < 12; frameIdx++) {
      this.explosionOverlays = dying.map((u) => ({ x: u.x, y: u.y, frameIdx }));
      await new Promise((r) => setTimeout(r, expFrameMs));
    }
    this.explosionOverlays = [];
  }

  /**
   * Plays `FD2.EXE` `fn_50380` on-map `FDOTHER[6]` spell sprite animation + `fn_70984` earthquake shake
   * + `fn_57176` bouncing pixel digits (`FDOTHER[5][94..118]`) directly on the tactical map!
   */
  private async playOnMapSpellAndNumbersAnim(
    spell: SpellDef,
    targets: { unit: BattleUnit; amount: number; isHeal: boolean; hit: boolean }[]
  ): Promise<void> {
    const tickScale = this.cutscene.getTickScale();
    const stepMs = Math.max(20, Math.round(48 * tickScale));
    const isEarthquake = spell.id >= 10 && spell.id <= 12;

    if (isEarthquake) {
      this.playUiSfx('quake');
      for (let i = 0; i < 14; i++) {
        this.screenShake = [(i % 2 === 0 ? -1 : 1) * 6, ((i >> 1) % 2 === 0 ? -1 : 1) * 5];
        await new Promise((r) => setTimeout(r, Math.max(18, Math.round(36 * tickScale))));
      }
      this.screenShake = [0, 0];
    } else if (spell.mapFxStart !== null && spell.mapFxStart !== undefined && spell.mapFxCount && spell.mapFxCount > 0 && targets.length > 0) {
      if (spell.mapSfxIdx && spell.mapSfxIdx > 0) {
        this.playUiSfx(`bank:80:${spell.mapSfxIdx}`);
      } else {
        this.playUiSfx(spell.targetType === 'ally' ? 'heal' : 'magic');
      }
      for (let f = 0; f < spell.mapFxCount; f++) {
        const frameId = spell.mapFxStart + f;
        this.mapSpellFxOverlays = targets.map((t) => ({ x: t.unit.x, y: t.unit.y, frameId }));
        await new Promise((r) => setTimeout(r, stepMs));
      }
      this.mapSpellFxOverlays = [];
    } else {
      if (spell.mapSfxIdx && spell.mapSfxIdx > 0) {
        this.playUiSfx(`bank:80:${spell.mapSfxIdx}`);
      } else {
        this.playUiSfx(spell.targetType === 'ally' ? 'heal' : 'magic');
      }
      await new Promise((r) => setTimeout(r, 220));
    }

    // `fn_57176` 22-tick bouncing pixel numbers (`GLOBAL_2_8236` parabola) for damage / heal / MISS!
    const numberTargets = targets.filter((t) => !t.hit || t.amount > 0);
    if (numberTargets.length > 0) {
      const bounceCurve = [15, 15, 15, 15, 7, 3, 1, 0, 0, 1, 3, 7, 15, 15, 11, 9, 8, 8, 9, 11, 15, 15, 15, 15, 15];
      for (let tick = 0; tick < 22; tick++) {
        this.mapPopupOverlays = numberTargets.map((t, idx) => {
          const curveIdx = Math.min(bounceCurve.length - 1, tick + Math.floor(idx / 4));
          return {
            x: t.unit.x,
            y: t.unit.y,
            yOffsetNativePx: bounceCurve[curveIdx] - 3,
            kind: !t.hit ? 'miss' : t.isHeal ? 'heal' : 'damage',
            amount: t.amount,
          };
        });
        await new Promise((r) => setTimeout(r, Math.max(16, Math.round(32 * tickScale))));
      }
      this.mapPopupOverlays = [];
    }
  }

  private async performAttack(attacker: BattleUnit, defender: BattleUnit): Promise<void> {
    if (!this.chapter) return;
    const outcome = resolveCombat(attacker, defender, this.chapter, this.assets.gameData);

    await this.cutscene.playCombatCutscene(
      outcome,
      document.getElementById('cutscene-backdrop')!,
      document.getElementById('cutscene-canvas') as HTMLCanvasElement,
      document.getElementById('btn-skip-cutscene') as HTMLButtonElement
    );

    // 1. Authentic `FD2.EXE` `fn_56165`: Spin in a circle -> Explode (`FDOTHER[5][68..79]`) -> Vanish on the map
    //    for ANY combatant (`defender` OR counterattacked `attacker`) whose HP reached 0!
    await this.playDyingUnitsOnMapAnim();
    // Exact `FD2.EXE` `fn_21646 @21916 & @22055` (`fn_13540()`): both surviving combatants turn back to front view (`dir = 0`)!
    this.resetAllUnitsToFrontView();

    const totalDmgToDef = outcome.strikes.filter((s) => s.fromAttacker).reduce((acc, s) => acc + s.damage, 0);
    const totalDmgToAtk = outcome.strikes.filter((s) => !s.fromAttacker).reduce((acc, s) => acc + s.damage, 0);
    const atkHtml = this.assets.glyphsToHtml(attacker.nameGlyphs, attacker.faction === 'player' ? 'gold' : 'crimson', 14, attacker.nameZh);
    const defHtml = this.assets.glyphsToHtml(defender.nameGlyphs, defender.faction === 'player' ? 'gold' : 'crimson', 14, defender.nameZh);
    this.logMessage(
      tr(
        `${atkHtml} 攻擊 ${defHtml} 造成 <strong>${totalDmgToDef}</strong> 傷害${defender.hp <= 0 ? '（擊破！）' : ''}${totalDmgToAtk > 0 ? `，反擊受創 <strong>${totalDmgToAtk}</strong>${attacker.hp <= 0 ? '（陣亡！）' : ''}` : ''}。`,
        `${atkHtml} 攻击 ${defHtml} 造成 <strong>${totalDmgToDef}</strong> 伤害${defender.hp <= 0 ? '（击破！）' : ''}${totalDmgToAtk > 0 ? `，反击受创 <strong>${totalDmgToAtk}</strong>${attacker.hp <= 0 ? '（阵亡！）' : ''}` : ''}。`,
        `${atkHtml} attacked ${defHtml} for <strong>${totalDmgToDef}</strong> damage${defender.hp <= 0 ? ' (Defeated!)' : ''}${totalDmgToAtk > 0 ? `, counter-hit for <strong>${totalDmgToAtk}</strong>${attacker.hp <= 0 ? ' (Fallen!)' : ''}` : ''}.`
      )
    );

    // 2. Enemy Spoils (`fn_43549`) — Gold or Item Drop (with 8-slot full-bag prompt!)
    const victor = attacker.faction === 'player' && attacker.hp > 0 ? attacker : defender.faction === 'player' && defender.hp > 0 ? defender : null;
    if (outcome.droppedReward && victor) {
      this.playUiSfx('chest');
      if (outcome.droppedReward.type === 'gold') {
        this.gold += outcome.droppedReward.value;
        this.spawnMapFlash(victor.x, victor.y, '#f0c869', `+${outcome.droppedReward.value} G!`);
        this.logMessage(
          tr(
            `獲得戰利品：<strong>+${outcome.droppedReward.value} G</strong>！`,
            `获得战利品：<strong>+${outcome.droppedReward.value} G</strong>！`,
            `Obtained spoils: <strong>+${outcome.droppedReward.value} G</strong>!`
          )
        );
      } else {
        const it = this.assets.gameData.items[outcome.droppedReward.value];
        if (it) {
          if (victor.items.length < 8) {
            victor.items.push(it.id);
            syncUnitEquipmentIndices(victor, this.assets.gameData);
            this.spawnMapFlash(victor.x, victor.y, '#f0c869', `${it.nameZh}!`);
            this.logMessage(
              `${tr('獲得戰利品：', '获得战利品：', 'Obtained spoils: ')}${this.assets.glyphsToHtml(it.nameGlyphs, 'gold', 14, it.nameZh)} <strong>(${it.nameZh})</strong>！`
            );
          } else {
            const discardIdx = await this.promptFullBagItemChoice(
              victor,
              it.id,
              tr(
                `敵軍掉落「${it.nameZh}」，但 ${victor.nameZh} 道具袋已滿（8/8）！請選擇要丟棄換取的道具：`,
                `敌军掉落「${it.nameZh}」，但 ${victor.nameZh} 道具袋已满（8/8）！请选择要丢弃换取的道具：`,
                `Enemy dropped "${it.nameZh}", but ${victor.nameZh}'s bag is full (8/8)! Choose an item to discard:`
              )
            );
            if (discardIdx !== null) {
              const oldIt = this.assets.gameData.items[victor.items[discardIdx]];
              victor.items[discardIdx] = it.id;
              syncUnitEquipmentIndices(victor, this.assets.gameData);
              this.logMessage(
                tr(
                  `丟棄了 ${oldIt?.nameZh ?? '道具'}，獲得戰利品 <strong>${it.nameZh}</strong>！`,
                  `丢弃了 ${oldIt?.nameZh ?? '道具'}，获得战利品 <strong>${it.nameZh}</strong>！`,
                  `Discarded ${oldIt?.nameZh ?? 'Item'} and took <strong>${it.nameZh}</strong>!`
                )
              );
            }
          }
        }
      }
    }

    // 3. Authentic `FD2.EXE` `fn_58002`: Character Portrait Dialogue (`得到經驗 XX 點！` + `等級上升了！！` + Stat Gains + Learned Spells)
    if (victor && outcome.expGained > 0) {
      await this.showUnitExpAndLevelUpDialogue(victor, outcome.expGained, outcome.levelUp);
    }

    // 4. Unit Dying Dialogue (`urec[22] === 3` -> `FDTXT` dialogue index, e.g. Ch 2 Villagers `dlg[11..16]`)
    if (outcome.droppedDialogueId !== undefined) {
      const deadSlotIdx = defender.hp <= 0 ? defender.slotIndex : attacker.slotIndex;
      const dlgKey = `drop_dlg_${outcome.droppedDialogueId}_${deadSlotIdx}`;
      if (!this.triggeredEvents.has(dlgKey)) {
        this.triggeredEvents.add(dlgKey);
        await this.playDialogueByIndex(outcome.droppedDialogueId);
      }
    }

    // 5. Boss / Unit Death Event (`urec[22] === 2` -> `EV` mid-battle event)
    if (outcome.droppedEventId !== undefined) {
      const deadSlotIdx = defender.hp <= 0 ? defender.slotIndex : attacker.slotIndex;
      const evKey = `drop_ev_${outcome.droppedEventId}_${deadSlotIdx}`;
      if (!this.triggeredEvents.has(evKey)) {
        this.triggeredEvents.add(evKey);
        await this.director.runMidBattleEvent(outcome.droppedEventId, victor ?? attacker);
      }
    }

    this.updateTopHud();
    if (attacker.hp > 0) this.updateInspectorPanel(attacker);
  }

  private async performSpellCast(
    caster: BattleUnit,
    spell: SpellDef,
    tx: number,
    ty: number,
    options?: { fromItem?: boolean }
  ): Promise<void> {
    if (!this.chapter) return;

    // Special handling for `#23 傳送術` (Teleport ally/self to target passable empty tile!)
    if (spell.id === 23) {
      if (!options?.fromItem) {
        caster.mp = Math.max(0, caster.mp - spell.mpCost);
      }
      const tinfo = getTerrainInfo(this.chapter, tx, ty);
      const occupied = this.activeUnits.some((u) => u.x === tx && u.y === ty);
      const canLand = caster.moveMode === 'fly' ? tinfo.bonusIdx !== 5 : tinfo.moveCostFoot < 99;
      if (canLand && !occupied) {
        caster.x = tx;
        caster.y = ty;
        await this.director.playSparklesOnUnits([caster]);
        this.logMessage(
          `${this.assets.glyphsToHtml(caster.nameGlyphs, 'azure', 14, caster.nameZh)} ${tr(
            `施展傳送術移動至 (${tx}, ${ty})！`,
            `施展传送术移动至 (${tx}, ${ty})！`,
            `teleported to (${tx}, ${ty})!`
          )}`
        );
      }
      this.resetAllUnitsToFrontView();
      this.updateTopHud();
      return;
    }

    const preHpById = new Map<string, number>();
    for (const u of this.activeUnits) {
      preHpById.set(u.runtimeId, u.hp);
    }

    const blast = getSpellBlastTiles(caster.x, caster.y, tx, ty, spell, this.chapter);
    const fxColor = spell.targetType === 'ally' ? '#68dfa0' : '#ff7b54';
    for (const [bx, by] of blast) {
      this.spawnMapFlash(bx, by, fxColor);
    }

    const res = resolveSpellCast(caster, spell, tx, ty, this.chapter, this.activeUnits, this.assets.gameData, options);

    // Exact `FD2.EXE` (`L54292..L54403`) Cutaway vs. On-Map Spell Routing:
    // - ONLY spells with `hasCutawayAnim` (`0..9`, `24`, `28..35`) enter the 320x200 cutaway stage when animations are ON!
    // - Earthquakes (`10..12`), Heals/Buffs/Cures (`13..22`), and `25..27` (`行動/毒擊/麻痺`) ALWAYS execute directly on the tactical map!
    const useCutawayStage = Boolean(spell.hasCutawayAnim) && !this.cutscene.isInstantMode() && res.affected.length > 0;

    if (useCutawayStage) {
      await this.cutscene.playMagicCutscene(
        caster,
        spell,
        res.affected.map((entry) => ({
          unit: entry.unit,
          amount: entry.amount,
          isHeal: entry.isHeal,
          preHp: preHpById.get(entry.unit.runtimeId) ?? entry.unit.hp,
        })),
        this.chapter,
        document.getElementById('cutscene-backdrop')!,
        document.getElementById('cutscene-canvas') as HTMLCanvasElement,
        document.getElementById('btn-skip-cutscene') as HTMLButtonElement
      );
    } else {
      await this.playOnMapSpellAndNumbersAnim(spell, res.affected);
    }

    // Authentic `FD2.EXE` `fn_56165`: Simultaneous clockwise spin + 12-frame explosion on the map for all enemies killed by the spell!
    await this.playDyingUnitsOnMapAnim();
    // Exact `FD2.EXE` `fn_20565 @21255` (`fn_13540()`): surviving units turn back to front view (`dir = 0`)!
    this.resetAllUnitsToFrontView();

    for (const d of res.drops) {
      if (d.type === 'gold') {
        this.gold += d.value;
        this.spawnMapFlash(caster.x, caster.y, '#f0c869', `+${d.value} G!`);
      } else {
        const it = this.assets.gameData.items[d.value];
        if (it) {
          if (caster.items.length < 8) {
            caster.items.push(d.value);
            syncUnitEquipmentIndices(caster, this.assets.gameData);
          } else if (caster.faction === 'player') {
            const discardIdx = await this.promptFullBagItemChoice(
              caster,
              it.id,
              tr(
                `敵軍掉落「${it.nameZh}」，但 ${caster.nameZh} 道具袋已滿（8/8）！請選擇要丟棄換取的道具：`,
                `敌军掉落「${it.nameZh}」，但 ${caster.nameZh} 道具袋已满（8/8）！请选择要丢弃换取的道具：`,
                `Enemy dropped "${it.nameZh}", but ${caster.nameZh}'s bag is full (8/8)! Choose an item to discard:`
              )
            );
            if (discardIdx !== null) {
              caster.items[discardIdx] = it.id;
              syncUnitEquipmentIndices(caster, this.assets.gameData);
            }
          }
        }
      }
    }

    this.logMessage(
      `${this.assets.glyphsToHtml(caster.nameGlyphs, 'azure', 14, caster.nameZh)} ${tr('施展', '施展', 'cast')} ${this.assets.glyphsToHtml(spell.nameGlyphs, 'azure', 14, spell.nameZh)}${tr(`（影響 ${res.affected.length} 目標）。`, `（影响 ${res.affected.length} 目标）。`, ` (affected ${res.affected.length} target${res.affected.length === 1 ? '' : 's'}).`)}`
    );

    if (caster.faction === 'player' && caster.hp > 0 && res.expGained > 0) {
      await this.showUnitExpAndLevelUpDialogue(caster, res.expGained, res.levelUp);
    }

    for (const dlgId of res.dialogueDrops) {
      const dlgKey = `sp_drop_dlg_${dlgId}`;
      if (!this.triggeredEvents.has(dlgKey)) {
        this.triggeredEvents.add(dlgKey);
        await this.playDialogueByIndex(dlgId);
      }
    }

    for (const evId of res.eventDrops) {
      const evKey = `sp_drop_ev_${evId}`;
      if (!this.triggeredEvents.has(evKey)) {
        this.triggeredEvents.add(evKey);
        await this.director.runMidBattleEvent(evId, caster);
      }
    }

    this.updateTopHud();
    if (caster.hp > 0) this.updateInspectorPanel(caster);
  }

  /** Converts a non-negative integer to `FDOTHER[4]` full-width digit glyph IDs (`0..9` = `'0'..'9'`). */
  private intToCalligraphyGlyphs(val: number): number[] {
    return String(Math.max(0, Math.floor(val)))
      .split('')
      .map((ch) => Math.max(0, Math.min(9, ch.charCodeAt(0) - 48)));
  }

  /**
   * Authentic `FD2.EXE` `fn_58002` (`Obj1+58002..58895`) Post-Action Character EXP & Level-Up Dialogue:
   *  1. Opens the character's portrait dialogue box and displays `FDTXT[0][488]`: `得到經驗 XX 點！`
   *  2. If `levelUp` occurred (`exp >= 100`), plays the level-up fanfare and displays `FDTXT[0][489..494]`
   *     (`等級上升了！！` + `力量/耐力/速度/ＭＨＰ/ＭＭＰ上升 X 點！`) and `FDTXT[0][587]` (`學會了 [法術]！`).
   */
  private async showUnitExpAndLevelUpDialogue(
    unit: BattleUnit,
    expGained: number,
    levelUp: LevelUpGain | null
  ): Promise<void> {
    if (unit.faction !== 'player' || unit.hp <= 0 || expGained <= 0) return;

    this.centerCameraOnTile(unit.x, unit.y);
    this.logMessage(
      `${this.assets.glyphsToHtml(unit.nameGlyphs, 'gold', 14, unit.nameZh)} ${tr(
        `得到經驗 <strong>${expGained}</strong> 點！`,
        `得到经验 <strong>${expGained}</strong> 点！`,
        `gained <strong>${expGained}</strong> EXP!`
      )}`
    );

    const overlayEl = document.getElementById('dialogue-overlay')!;
    const portraitCanvas = document.getElementById('dialogue-portrait') as HTMLCanvasElement;
    const speakerEl = document.getElementById('dialogue-speaker')!;
    const linesEl = document.getElementById('dialogue-lines')!;
    const progressEl = document.getElementById('dialogue-progress')!;
    const skipBtn = document.getElementById('btn-skip-dialogue') as HTMLButtonElement;

    const makeSeg = (lines: number[][], linesZhCn: string[], linesEn: string[]): DialogueSegment => ({
      speaker: unit.uid,
      portraitId: unit.portraitId,
      speakerNameZh: unit.nameZh,
      speakerGlyphs: unit.nameGlyphs,
      boxPos: 'bottom',
      lines,
      linesZhCn,
      linesEn,
    });

    // Step 1: `FDTXT[0][488]` -> `得到經驗 XX 點！` (`[386, 387, 449, 450, ...digits, 448, 342]`)
    const expLine = [386, 387, 449, 450, ...this.intToCalligraphyGlyphs(expGained), 448, 342];
    await this.cutscene.playDialogueSequence(
      [makeSeg([expLine], [`得到经验 ${expGained} 点！`], [`Gained ${expGained} EXP!`])],
      overlayEl,
      portraitCanvas,
      speakerEl,
      linesEl,
      progressEl,
      skipBtn
    );

    if (!levelUp) return;

    // Step 2: `FDTXT[0][489..494]` -> `等級上升了！！` + Stat Gains + `FDTXT[0][587]` `學會了 [法術]！`
    this.playUiSfx('levelup');
    this.spawnMapFlash(unit.x, unit.y, '#ffd466', `LEVEL UP ${levelUp.newLevel}!`);
    const learnedNames = levelUp.learnedSpellIds
      .map((sid) => this.assets.gameData.spells[sid]?.nameZh)
      .filter(Boolean)
      .join(tr('、', '、', ', '));
    this.logMessage(
      `<strong>${tr('等級提升！', '等级提升！', 'LEVEL UP!')}</strong> ${this.assets.glyphsToHtml(unit.nameGlyphs, 'gold', 14, unit.nameZh)} ${tr('升至', '升至', 'reached')} Lv.${levelUp.newLevel} (HP+${levelUp.hp}, MP+${levelUp.mp}, AP+${levelUp.ap}, DP+${levelUp.dp}, DX+${levelUp.dx})${learnedNames ? ` · ${tr('學會了：', '学会了：', 'Learned: ')}<strong>${learnedNames}</strong>` : ''}！`
    );

    const lvLines: number[][] = [
      [352, 451, 391, 452, 341, 342, 342], // 等級上升了！！ (`sys[489]`)
    ];
    const lvLinesCn: string[] = ['等级上升了！！'];
    const lvLinesEn: string[] = ['Level Up!!'];
    if (levelUp.ap > 0) {
      lvLines.push([213, 214, 391, 452, ...this.intToCalligraphyGlyphs(levelUp.ap), 448, 342]); // 力量上升 X 點！ (`sys[490]`)
      lvLinesCn.push(`力量上升 ${levelUp.ap} 点！`);
      lvLinesEn.push(`STR increased by ${levelUp.ap}!`);
    }
    if (levelUp.dp > 0) {
      lvLines.push([317, 213, 391, 452, ...this.intToCalligraphyGlyphs(levelUp.dp), 448, 342]); // 耐力上升 X 點！ (`sys[491]`)
      lvLinesCn.push(`耐力上升 ${levelUp.dp} 点！`);
      lvLinesEn.push(`VIT increased by ${levelUp.dp}!`);
    }
    if (levelUp.dx > 0) {
      lvLines.push([318, 319, 391, 452, ...this.intToCalligraphyGlyphs(levelUp.dx), 448, 342]); // 速度上升 X 點！ (`sys[492]`)
      lvLinesCn.push(`速度上升 ${levelUp.dx} 点！`);
      lvLinesEn.push(`AGI increased by ${levelUp.dx}!`);
    }
    if (levelUp.hp > 0) {
      lvLines.push([22, 17, 25, 391, 452, ...this.intToCalligraphyGlyphs(levelUp.hp), 448, 342]); // ＭＨＰ上升 X 點！ (`sys[493]`)
      lvLinesCn.push(`MHP上升 ${levelUp.hp} 点！`);
      lvLinesEn.push(`MHP increased by ${levelUp.hp}!`);
    }
    if (levelUp.mp > 0) {
      lvLines.push([22, 22, 25, 391, 452, ...this.intToCalligraphyGlyphs(levelUp.mp), 448, 342]); // ＭＭＰ上升 X 點！ (`sys[494]`)
      lvLinesCn.push(`MMP上升 ${levelUp.mp} 点！`);
      lvLinesEn.push(`MMP increased by ${levelUp.mp}!`);
    }
    for (const sid of levelUp.learnedSpellIds) {
      const sp = this.assets.gameData.spells[sid];
      if (sp && sp.nameGlyphs.length > 0) {
        lvLines.push([537, 458, 341, ...sp.nameGlyphs, 342]); // 學會了 [法術名稱]！ (`sys[587]`)
        lvLinesCn.push(`学会了 ${sp.nameZh}！`);
        lvLinesEn.push(`Learned ${sp.nameZh}!`);
      }
    }

    // Group into crisp 3-line pages matching `FD2.EXE`'s 3-line dialogue box (`fn_24452`)
    const lvSegments: DialogueSegment[] = [];
    for (let i = 0; i < lvLines.length; i += 3) {
      lvSegments.push(makeSeg(lvLines.slice(i, i + 3), lvLinesCn.slice(i, i + 3), lvLinesEn.slice(i, i + 3)));
    }

    await this.cutscene.playDialogueSequence(
      lvSegments,
      overlayEl,
      portraitCanvas,
      speakerEl,
      linesEl,
      progressEl,
      skipBtn
    );
  }

  private spawnMapFlash(x: number, y: number, color: string, text?: string): void {
    this.mapFlashes.push({ x, y, color, startMs: performance.now(), durMs: 760, text });
  }

  /**
   * Authentic `FD2.EXE` `fn_14916(x, y, mode)` (`14916..15007`) Step-Event Detector:
   *  - `mode === 0` (`stepDef.flag === 0` pass-through tripwire, e.g. Ch 7 `EV 26`, Ch 14 `EV 10`, Ch 26 `EV 59, 60`,
   *    Ch 27 `EV 62, 84`, Ch 28 `EV 65, 69`, Ch 30 `EV 80`): checked at every tile stepped onto along `walkedPath`
   *    (`fn_11946/12301/12677/13077 @12647`) and latched into `latchedDef` (`GLOBAL_2_6799`).
   *  - `mode === 1` (`stepDef.flag === 1` stop-on destination, e.g. Ch 13 `EV 8`, Ch 25 `EV 55`, Ch 26 `EV 61`, Ch 29 `EV 75`):
   *    checked ONLY at the unit's final tile `(unit.x, unit.y)` after completing its action (`fn_34960` / `fn_15007 @15994`).
   */
  private async checkUnitStepTileEvent(unit: BattleUnit, walkedPath?: [number, number][]): Promise<void> {
    if (!this.chapter || unit.faction === 'enemy') return;

    const pathToScan = walkedPath && walkedPath.length > 0 ? walkedPath : this.lastWalkPath;
    let latchedDef: { triggerIndex: number; eventId: number; flag: number } | undefined;

    const lookupStepDefAt = (tx: number, ty: number, requiredFlag?: number) => {
      const cell = this.chapter?.cells[ty]?.[tx];
      if (!cell || (cell[4] & 2) !== 0) return undefined;
      const evid = cell[1];
      if (evid <= 0) return undefined;
      const def = this.chapter?.stepEvents?.find((se) => se.triggerIndex === evid);
      if (!def) return undefined;
      if (requiredFlag !== undefined && def.flag !== requiredFlag) return undefined;
      return def;
    };

    // 1. Scan traversed path tiles for pass-through tripwires (`stepDef.flag === 0`, `fn_14916(x, y, 0)`)
    if (pathToScan.length > 1) {
      for (let i = 1; i < pathToScan.length; i++) {
        const [wx, wy] = pathToScan[i];
        const def = lookupStepDefAt(wx, wy, 0);
        if (def) {
          latchedDef = def;
        }
      }
    } else {
      const def0 = lookupStepDefAt(unit.x, unit.y, 0);
      if (def0) latchedDef = def0;
    }

    // 2. Check final destination tile `(unit.x, unit.y)` for stop-on triggers (`stepDef.flag === 1`, `fn_14916(x, y, 1)`)
    const finalDef1 = lookupStepDefAt(unit.x, unit.y, 1);
    if (finalDef1) {
      latchedDef = finalDef1;
    }

    if (latchedDef) {
      const key = `step_${this.chapter.id}_${latchedDef.triggerIndex}_${latchedDef.eventId}`;
      if (!this.triggeredEvents.has(key)) {
        const completed = await this.director.runMidBattleEvent(latchedDef.eventId, unit);
        // Only lock one-shot step events once `runMidBattleEvent` returns `true` (so character/item-specific triggers
        // like Ch 13 EV 8 Sol, Ch 25 EV 55 Sol, Ch 26 EV 61 `#208 控制中樞`, and Ch 29 EV 75 `#9 悠妮` stay active until fulfilled!)
        if (completed) {
          this.triggeredEvents.add(key);
          syncUnitEquipmentIndices(unit, this.assets.gameData);
        }
      }
    }
  }

  private async finishSelectedUnitTurn(): Promise<void> {
    const finishedUnit = this.selectedUnit;
    const walkedPath = this.lastWalkPath.slice();
    this.lastWalkPath = [];
    if (finishedUnit) {
      finishedUnit.acted = true;
    }
    this.selectedUnit = null;
    this.moveOrigin = null;
    this.pendingGiveItemBagIdx = null;
    this.pendingUseItemBagIdx = null;
    this.pendingTeleportTargetUnit = null;
    this.pendingTeleportFromItemBagIdx = null;
    this.reachableMap.clear();
    this.targetTiles.clear();
    this.activeSpell = null;
    this.crossMenu.close();
    this.hideSubPopupAndForecast();

    // Exact `FD2.EXE` `fn_34960 @35418` (`fn_13540()`): after completing any move/fight/spell/item/rest action,
    // reset all living units to front-facing pose (`dir = 0`)!
    this.resetAllUnitsToFrontView();

    if (finishedUnit && finishedUnit.hp > 0) {
      await this.checkUnitStepTileEvent(finishedUnit, walkedPath);
    }

    if (this.checkBattleEndConditions()) return;

    const anyLeft = this.activeUnits.some((u) => u.faction === 'player' && !u.acted && u.paralyzeTurns === 0);
    if (!anyLeft) {
      await this.endPlayerPhase();
    } else {
      this.uiState = 'idle';
    }
  }

  /**
   * Authentic `FD2.EXE` `fn_68719` / `fn_20565` Usable & Consumable Item Executor (for both Player & AI!):
   *  - Supports single-target herbs (`192..197`, `206..207`), ranged radius-2 AoE `#102 修理套件` (`range=4, aoe=2, +500 HP`
   *    carried 6x by `#115 機甲守衛` in Ch 23, 26..29), reusable heals (`#40 光之斧 / #58 力之杖 / #61 光之杖`),
   *    and 0-MP spell-casting staves/weapons (`#11 炎龍劍 / #29 戰神戟 / #38 閃雷鎚 / #51 風神弓 / #56 魔法杖 / #57 封咒杖 / #60 龍之杖 / #99 雷神鞭 / #101 傳送法杖`).
   */
  private async performItemUseAtTile(
    actor: BattleUnit,
    bagIdx: number,
    tx: number,
    ty: number,
    fallbackTarget?: BattleUnit
  ): Promise<void> {
    const gd = this.assets.gameData;
    const itemId = actor.items[bagIdx];
    const item = gd.items[itemId];
    if (!item || !this.chapter) return;

    await this.ensureTileVisibleOnMap(tx, ty, 100);
    await this.waitMapBeat(45);

    // 1. Reusable spell-casting weapons & relics (`useEffect 12, 14..16, 20..24`: `#56 魔法杖`, `#60 龍之杖`, `#79 光束砲`, `#99 雷神鞭`, `#101 傳送法杖`, `#210..#214`, etc.)
    const eqSpellId = getItemEquivalentSpellId(item);
    if (eqSpellId !== null) {
      const sp = gd.spells[eqSpellId];
      if (sp) {
        const customSp: SpellDef = {
          ...sp,
          mpCost: 0,
          castRange: item.useRange ?? sp.castRange,
          aoe: item.useAoe ?? sp.aoe,
          isLinear: (item.useAoe ?? 0) > 0 ? false : sp.isLinear,
        };
        await this.performSpellCast(actor, customSp, tx, ty, { fromItem: true });
        return;
      }
    }

    // 2. Consumable / Reusable Healing & Status Cure Items (`useEffect 5..11, 13, 17..19`, including `#102 修理套件` AoE 2 `+500 HP`!)
    const aoe = item.useAoe ?? 0;
    if (aoe > 0) {
      for (const [bx, by] of getAttackableCoordinates(tx, ty, 0, aoe, this.chapter)) {
        this.spawnMapFlash(bx, by, '#68dfa0');
      }
    }

    const res = resolveAreaItemUse(actor, bagIdx, tx, ty, this.activeUnits, gd);
    const affectedUnits =
      res.healed.length > 0
        ? res.healed.map((h) => h.unit)
        : fallbackTarget
          ? [fallbackTarget]
          : [actor];

    this.playUiSfx('heal');
    for (const h of res.healed) {
      this.spawnMapFlash(h.unit.x, h.unit.y, '#68dfa0', `+${h.amount}`);
    }
    if (res.healed.length === 0) {
      this.spawnMapFlash(tx, ty, '#68dfa0', res.summaryZh);
    }
    await this.director.playSparklesOnUnits(affectedUnits);

    if (res.healed.length > 0) {
      const tickScale = this.cutscene.getTickScale();
      const bounceCurve = [15, 15, 15, 15, 7, 3, 1, 0, 0, 1, 3, 7, 15, 15, 11, 9, 8, 8, 9, 11, 15, 15, 15, 15, 15];
      for (let tick = 0; tick < 22; tick++) {
        this.mapPopupOverlays = res.healed.map((h, idx) => ({
          x: h.unit.x,
          y: h.unit.y,
          yOffsetNativePx: bounceCurve[Math.min(bounceCurve.length - 1, tick + Math.floor(idx / 4))] - 3,
          kind: 'heal',
          amount: h.amount,
        }));
        await new Promise((r) => setTimeout(r, Math.max(16, Math.round(32 * tickScale))));
      }
      this.mapPopupOverlays = [];
    }

    const actorTone = actor.faction === 'player' ? 'gold' : actor.faction === 'ally' ? 'emerald' : 'crimson';
    let targetClause = '';
    if (res.healed.length === 1 && res.healed[0].unit.runtimeId !== actor.runtimeId) {
      const tu = res.healed[0].unit;
      const targetTone = tu.faction === 'player' ? 'gold' : tu.faction === 'ally' ? 'emerald' : 'crimson';
      targetClause = `${tr('對', '对', 'on')} ${this.assets.glyphsToHtml(tu.nameGlyphs, targetTone, 14, tu.nameZh)} `;
    }
    this.logMessage(
      `${this.assets.glyphsToHtml(actor.nameGlyphs, actorTone, 14, actor.nameZh)} ${targetClause}${res.summaryZh}`
    );
    this.updateTopHud();
    if (actor.hp > 0) this.updateInspectorPanel(actor);
  }

  /** Executes `委任行動` (Auto-AI delegation for all remaining unacted player units this turn). */
  private async runPlayerAutoDelegateTurn(): Promise<void> {
    if (!this.chapter) return;
    this.uiState = 'busy';
    const readyPlayers = this.activeUnits.filter((u) => u.faction === 'player' && !u.acted && u.paralyzeTurns === 0);

    for (const actor of readyPlayers) {
      if (!isUnitActiveOnMap(actor)) continue;
      const decision = chooseAiAction(actor, this.chapter, this.activeUnits, this.assets.gameData);

      if (decision.destX !== actor.x || decision.destY !== actor.y) {
        const moveMap = computeReachableTiles(actor, this.chapter, this.activeUnits, this.assets.gameData);
        const path = reconstructPath(moveMap, decision.destX, decision.destY);
        await this.animateUnitWalk(actor, path);
        actor.moved = true;
      } else if (decision.targetUnit || decision.useItemBagIdx !== undefined) {
        await this.ensureTileVisibleOnMap(actor.x, actor.y, 105);
      }
      if (decision.useItemBagIdx !== undefined && decision.targetUnit) {
        const ix = decision.itemTargetX ?? decision.targetUnit.x;
        const iy = decision.itemTargetY ?? decision.targetUnit.y;
        await this.performItemUseAtTile(actor, decision.useItemBagIdx, ix, iy, decision.targetUnit);
      } else if (decision.spell && decision.targetUnit && isUnitActiveOnMap(decision.targetUnit)) {
        await this.ensureTileVisibleOnMap(decision.targetUnit.x, decision.targetUnit.y, 100);
        await this.waitMapBeat(45);
        await this.performSpellCast(actor, decision.spell, decision.targetUnit.x, decision.targetUnit.y);
      } else if (decision.targetUnit && isUnitActiveOnMap(decision.targetUnit)) {
        await this.ensureTileVisibleOnMap(decision.targetUnit.x, decision.targetUnit.y, 100);
        await this.waitMapBeat(45);
        await this.performAttack(actor, decision.targetUnit);
      }
      actor.acted = true;
      this.resetAllUnitsToFrontView();
      await this.checkUnitStepTileEvent(actor);
      if (this.checkBattleEndConditions()) return;
    }

    await this.endPlayerPhase();
  }

  private checkBattleEndConditions(): boolean {
    if (!this.chapter) return false;
    const status = evaluateChapterBattleStatus(this.chapter, this.slots, this.turn, this.director.getFlags());
    if (status === 'victory') {
      void this.handleChapterVictory();
      return true;
    }
    if (status === 'defeat') {
      this.handleChapterDefeat();
      return true;
    }
    return false;
  }

  private async handleChapterVictory(): Promise<void> {
    if (!this.chapter) return;
    this.uiState = 'busy';
    this.crossMenu.close();
    this.hideSubPopupAndForecast();
    this.playUiSfx('fanfare');
    markChapterCleared(this.chapter.chapterNumber);
    await this.showPhaseBanner(tr('戰場勝利 · VICTORY!', '战场胜利 · VICTORY!', 'VICTORY!'));

    // Sync surviving & fallen heroes before Post-Battle Directing so newly recruited heroes append cleanly!
    this.party = this.syncPartyFromBattlefield();

    // Run authentic Chapter-by-Chapter Post-Battle Directing, Formations, Hero Recruitments & Ending Branch Checks!
    const postOutcome = await this.director.runPostBattleDirecting(this.currentChapterId);
    this.party = this.syncPartyFromBattlefield();

    if (postOutcome.kind === 'ending') {
      this.modals.openEndingModal(postOutcome.route, this.party, () => {
        this.titleScreenEl.classList.remove('hidden');
        this.uiState = 'idle';
      });
      return;
    }

    const nextChapter = postOutcome.nextChapterId;
    this.currentChapterId = nextChapter;

    // Auto-Save A: Camp / Chapter Start Checkpoint upon entering Town/Camp!
    saveAutoSaveSlot('camp', {
      version: 2,
      timestamp: new Date().toLocaleString(),
      chapterId: nextChapter,
      gold: this.gold,
      inBattle: false,
      party: this.party.map((m) => ({ ...m, items: [...m.items], spells: [...m.spells] })),
    });

    this.modals.openTownCamp(
      nextChapter,
      this.party,
      () => this.gold,
      (g) => {
        this.gold = g;
        this.updateTopHud();
      },
      () => {
        this.modals.openSaveLoadModal(
          'save',
          () => ({
            version: 2,
            timestamp: new Date().toLocaleString(),
            chapterId: nextChapter,
            gold: this.gold,
            inBattle: false,
            party: this.party,
          }),
          (s) => void this.loadFromSaveData(s)
        );
      },
      () => {
        void this.beginChapterBattle(nextChapter, true);
      }
    );
  }

  private handleChapterDefeat(): void {
    this.uiState = 'busy';
    this.crossMenu.close();
    this.playUiSfx('cancel');
    this.logMessage(
      tr(
        `<strong style="color:var(--enemy-red);">戰敗 (GAME OVER)！</strong> 我軍指揮官倒下或保護對象全滅。`,
        `<strong style="color:var(--enemy-red);">战败 (GAME OVER)！</strong> 我军指挥官倒下或保护对象全灭。`,
        `<strong style="color:var(--enemy-red);">DEFEAT (GAME OVER)!</strong> Our commander fell or the protected target was lost.`
      )
    );

    this.subPopupEl.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px;">
        <img class="pixel-crisp" src="assets/screens/gameover.png" width="96" height="60" style="border-radius:4px; border:1px solid var(--border-brass);" alt="Game Over" />
        <div>
          <div style="color:var(--enemy-red); font-weight:700; margin-bottom:6px;">${tr('遠征挫敗 · GAME OVER', '远征挫败 · GAME OVER', 'EXPEDITION DEFEATED · GAME OVER')}</div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-gold btn-sm" id="btn-retry-chapter" type="button">${tr('重戰本章', '重战本章', 'Retry Chapter')}</button>
            <button class="btn btn-sm" id="btn-defeat-load" type="button">${tr('讀取存檔', '读取存档', 'Load Save')}</button>
            <button class="btn btn-sm" id="btn-defeat-title" type="button">${tr('返回標題', '返回标题', 'Return to Title')}</button>
          </div>
        </div>
      </div>
    `;
    this.subPopupEl.classList.remove('hidden');

    this.subPopupEl.querySelector('#btn-retry-chapter')?.addEventListener('click', () => {
      const campSnap = loadAutoSaveSlot('camp');
      if (campSnap && campSnap.chapterId === this.currentChapterId && campSnap.party.length > 0) {
        this.gold = campSnap.gold;
        this.party = campSnap.party.map((m) => ({ ...m, items: [...m.items], spells: [...m.spells] }));
      }
      void this.beginChapterBattle(this.currentChapterId, true);
    });
    this.subPopupEl.querySelector('#btn-defeat-load')?.addEventListener('click', () => {
      this.modals.openSaveLoadModal('load', null, (s) => void this.loadFromSaveData(s));
    });
    this.subPopupEl.querySelector('#btn-defeat-title')?.addEventListener('click', () => {
      this.hideSubPopupAndForecast();
      this.titleScreenEl.classList.remove('hidden');
      this.uiState = 'idle';
    });
  }

  private async checkScheduledTurnEvents(targetPhase?: number): Promise<void> {
    if (!this.chapter) return;
    for (const te of this.chapter.turnEvents) {
      if (te.turn !== this.turn || te.turn >= 255) continue;
      if (targetPhase !== undefined && te.phase !== undefined && te.phase !== targetPhase) continue;
      const key = `turn_${this.chapter.id}_${te.slot ?? -1}_${te.turn}_${te.eventId}_${te.phase ?? 0}`;
      if (this.triggeredEvents.has(key)) continue;
      this.triggeredEvents.add(key);
      await this.director.runMidBattleEvent(te.eventId);
    }
  }

  private resetFactionActedFlags(faction: 'player' | 'ally' | 'enemy'): void {
    for (const u of this.activeUnits) {
      if (u.faction === faction) {
        u.acted = false;
        u.moved = false;
      }
    }
  }

  /**
   * Authentic `FD2.EXE` `fn_43110(faction)` Per-Faction Start-of-Phase Status & Lethal Poison Tick:
   *  - Decrements status/buff timers ONLY for `faction`.
   *  - Poison deals `max(1, floor(maxHp / 10))` (`10% MaxHP`) and **CAN reduce `u.hp` to `0`** (`L43214`)!
   *  - Immediately calls `playDyingUnitsOnMapAnim()` (`fn_56165`) so units killed by poison spin in a circle,
   *    explode (`FDOTHER[5][68..79]`), and disappear on the map!
   */
  private async tickFactionPhaseStartStatus(faction: 'player' | 'ally' | 'enemy'): Promise<boolean> {
    const members = this.activeUnits.filter((u) => u.faction === faction);
    let anyPoisoned = false;
    for (const u of members) {
      if (u.poisonTurns > 0) {
        anyPoisoned = true;
        const psnDmg = Math.max(1, Math.floor(u.maxHp / 10));
        u.hp = Math.max(0, u.hp - psnDmg);
        this.centerCameraOnTile(u.x, u.y);
        this.spawnMapFlash(u.x, u.y, '#a3e635', `${tr('中毒', '中毒', 'PSN')} -${psnDmg}`);
        this.logMessage(
          `${this.assets.glyphsToHtml(u.nameGlyphs, u.faction === 'player' ? 'gold' : 'crimson', 14, u.nameZh)} ${tr(
            `受到毒傷 <strong>-${psnDmg}</strong>${u.hp <= 0 ? '（毒發倒下！）' : ''}。`,
            `受到毒伤 <strong>-${psnDmg}</strong>${u.hp <= 0 ? '（毒发倒下！）' : ''}。`,
            `took poison damage <strong>-${psnDmg}</strong>${u.hp <= 0 ? ' (Fallen!)' : ''}.`
          )}`
        );
        u.poisonTurns--;
      }
      if (u.paralyzeTurns > 0) u.paralyzeTurns--;
      if ((u.silenceTurns ?? 0) > 0) u.silenceTurns!--;
      if ((u.apBuffTurns ?? 0) > 0) u.apBuffTurns!--;
      if ((u.dpBuffTurns ?? 0) > 0) u.dpBuffTurns!--;
      if ((u.mvBuffTurns ?? 0) > 0) u.mvBuffTurns!--;
    }
    if (anyPoisoned) {
      await new Promise((r) => setTimeout(r, 260));
      await this.playDyingUnitsOnMapAnim();
      this.updateTopHud();
      if (this.checkBattleEndConditions()) return true;
    }
    return false;
  }

  /**
   * Authentic `FD2.EXE` `fn_42150..fn_42936` Phase Transition & Turn Event Dispatch Loop:
   *  - In `FD2.EXE`, unit faction IDs (`unit[6]`) are `1 = Ally`, `0 = Enemy`, `2 = Player`.
   *  - When Player Phase of Turn `T` ends:
   *    1. **NPC Ally Phase (`phase === 1` on Turn `T`)**:
   *       Resets Ally `acted/moved`, runs `fn_43027(1)` (`checkScheduledTurnEvents(1)`), runs `fn_43110(1)` (Ally poison/status tick),
   *       and executes `fn_55307()` (Ally AI turns).
   *    2. **Enemy Phase (`phase === 0` on Turn `T`)**:
   *       Resets Enemy `acted/moved` BEFORE `fn_43027(0)` (`checkScheduledTurnEvents(0)` — so events like Ch 29 `EV 79` that set
   *       `acted = true` on 2 of the 3 Dragons are preserved!), runs `fn_43110(0)` (Enemy poison/status tick), and executes `fn_55482()` (Enemy AI turns).
   *    3. **Next Turn Player Phase (`this.turn = T + 1`, `phase === 2`)**:
   *       Increments `GLOBAL_2_15343 += 1` (`this.turn += 1`), resets Player `acted/moved` (`fn_13622`) BEFORE `fn_43027(2)`
   *       (`checkScheduledTurnEvents(2)` — so events like Ch 29 `EV 76` that set `acted = true` on `#9 悠妮` during her 3-turn
   *       Dragon Seal channeling are preserved!), shows the Turn `T + 1` banner, and runs `fn_43110(2)` (Player poison/status tick).
   */
  private async endPlayerPhase(): Promise<void> {
    if (!this.chapter) return;
    this.uiState = 'busy';
    this.selectedUnit = null;
    this.reachableMap.clear();
    this.targetTiles.clear();
    this.crossMenu.close();
    this.hideSubPopupAndForecast();

    // Authentic `FD2.EXE` (`fn_41739` `L41970..42111`) End-Turn Rest Recovery:
    // Any unacted, unmoved, unpoisoned, unparalyzed player unit recovers +20% Max HP with `FDOTHER[9]` sparkles
    // and calls `fn_13586(v6)` (`L42103: u.acted = true`)!
    const restedHealed: BattleUnit[] = [];
    for (const u of this.activeUnits) {
      if (
        u.faction === 'player' &&
        !u.acted &&
        !u.moved &&
        u.hp < u.maxHp &&
        u.poisonTurns === 0 &&
        u.paralyzeTurns === 0
      ) {
        const heal = Math.max(1, Math.floor(u.maxHp * 0.2));
        u.hp = Math.min(u.maxHp, u.hp + heal);
        this.spawnMapFlash(u.x, u.y, '#68dfa0', `+${heal}`);
        restedHealed.push(u);
        u.acted = true;
      }
    }
    if (restedHealed.length > 0) {
      this.playUiSfx('heal');
      await this.director.playSparklesOnUnits(restedHealed);
    }

    // 1. NPC Ally Phase (`phase === 1` on current `this.turn`)
    this.resetFactionActedFlags('ally');
    await this.checkScheduledTurnEvents(1);
    if (this.checkBattleEndConditions()) return;
    const allies = this.activeUnits.filter((u) => u.faction === 'ally');
    if (allies.length > 0) {
      this.phase = 'ally';
      this.updateTopHud();
      await this.showPhaseBanner(tr('友軍行動 · ALLY PHASE', '友军行动 · ALLY PHASE', 'ALLY PHASE'));
      if (await this.tickFactionPhaseStartStatus('ally')) return;
      await this.runAiFactionTurn('ally');
      if (this.checkBattleEndConditions()) return;
    }

    // 2. Enemy Phase (`phase === 0` on current `this.turn`)
    // Exact `FD2.EXE` `L42279..42307`: Show Enemy Phase banner, then `fn_13622()` clears `acted` (`M1[unit+5] &= 0x7F`)
    // across ALL units on the map (restoring full color & idle motion to all Player and Ally units!) before `fn_43027(0)`.
    this.phase = 'enemy';
    this.updateTopHud();
    await this.showPhaseBanner(tr('敵軍行動 · ENEMY PHASE', '敌军行动 · ENEMY PHASE', 'ENEMY PHASE'));
    this.resetFactionActedFlags('player');
    this.resetFactionActedFlags('ally');
    this.resetFactionActedFlags('enemy');
    await this.checkScheduledTurnEvents(0);
    if (this.checkBattleEndConditions()) return;
    if (await this.tickFactionPhaseStartStatus('enemy')) return;
    await this.runAiFactionTurn('enemy');
    if (this.checkBattleEndConditions()) return;

    // 3. Advance Turn & Player Phase (`phase === 2` on `this.turn + 1`)
    // Exact `FD2.EXE` `L42449..42490`: `fn_13622()` clears `acted` (`M1[unit+5] &= 0x7F`) across ALL units on the map
    // (restoring full color & idle motion to all Enemy units!).
    this.turn += 1;
    this.phase = 'player';
    this.resetFactionActedFlags('player');
    this.resetFactionActedFlags('ally');
    this.resetFactionActedFlags('enemy');
    this.updateTopHud();

    // Check battle end conditions at turn increment (e.g. Ch 19 `turn > 6` survival victory `fn_67878`)
    if (this.checkBattleEndConditions()) return;

    await this.showPhaseBanner(
      tr(`第 ${this.turn} 回合 · 我軍行動`, `第 ${this.turn} 回合 · 我军行动`, `TURN ${this.turn} · PLAYER PHASE`)
    );
    await this.checkScheduledTurnEvents(2);
    if (this.checkBattleEndConditions()) return;
    if (await this.tickFactionPhaseStartStatus('player')) return;

    // Auto-Save B: Turn Start Checkpoint
    saveAutoSaveSlot('turn', this.snapshotSaveData());

    this.centerCameraOnParty();
    this.uiState = 'idle';
  }

  private async runAiFactionTurn(faction: 'ally' | 'enemy'): Promise<void> {
    if (!this.chapter) return;
    const actors = this.activeUnits.filter((u) => u.faction === faction);

    for (const actor of actors) {
      if (!isUnitActiveOnMap(actor) || actor.acted || actor.paralyzeTurns > 0) continue;
      this.lastWalkPath = [];

      // Exact `FD2.EXE` AI Mode `11` (`fn_15007 @15881..15954` — Ch 30 `#126 空魔神` after `EV 80`):
      //  1. First evaluates and casts an offensive magic spell from its current position (`fn_22922 -> fn_21265`).
      //  2. In the VERY SAME turn (`@15917..15954`), evaluates physical attack (`fn_16951 -> fn_21646`) or advances (`fn_16673`)!
      const isMode11DualAction = (actor.aiMode & 0x3f) === 11;
      let didMode11Magic = false;
      if (isMode11DualAction) {
        const magicDecision = chooseAiAction(actor, this.chapter, this.activeUnits, this.assets.gameData, {
          stationaryMagicOnly: true
        });
        if (magicDecision.spell && magicDecision.targetUnit && isUnitActiveOnMap(magicDecision.targetUnit)) {
          didMode11Magic = true;
          await this.ensureTileVisibleOnMap(actor.x, actor.y, 105);
          await this.ensureTileVisibleOnMap(magicDecision.targetUnit.x, magicDecision.targetUnit.y, 100);
          await this.waitMapBeat(45);
          await this.performSpellCast(
            actor,
            magicDecision.spell,
            magicDecision.targetUnit.x,
            magicDecision.targetUnit.y
          );
          if (this.checkBattleEndConditions()) return;
          if (!isUnitActiveOnMap(actor)) continue;
        }
      }

      const decision = chooseAiAction(
        actor,
        this.chapter,
        this.activeUnits,
        this.assets.gameData,
        isMode11DualAction ? { skipMagicAndItems: true } : undefined
      );

      const didMove = decision.destX !== actor.x || decision.destY !== actor.y;
      const didAct = Boolean(
        didMode11Magic ||
          decision.useItemBagIdx !== undefined ||
          decision.targetUnit ||
          decision.lootChestAtDest ||
          decision.escapedMap
      );

      if (didMove) {
        const moveMap = computeReachableTiles(actor, this.chapter, this.activeUnits, this.assets.gameData);
        const path = reconstructPath(moveMap, decision.destX, decision.destY);
        if (path.length > 1) {
          await this.animateUnitWalk(actor, path);
        } else {
          actor.x = decision.destX;
          actor.y = decision.destY;
        }
        actor.moved = true;
      } else if (didAct) {
        await this.ensureTileVisibleOnMap(actor.x, actor.y, 105);
      }

      // Mode 5 (`#98 影之忍者`, `#102/#103` Treasure Thief `fn_15007 @15487..15648`):
      //  1. Opens target chest (`cell[0] += 1`).
      //  2. Calls `fn_48012(actor, chestDef.value)` when `chestDef.type === 'item'`, placing the stolen item directly into
      //     `actor.items` (so inspecting the enemy thief on the map shows the looted treasure in its inventory!) AND sets `actor.drop`,
      //     so defeating the fleeing thief transfers that item/gold to the player killer!
      //  3. Switches `actor.aiMode = 7` to retreat off-map!
      if (decision.lootChestAtDest && this.chapter) {
        const cell = this.chapter.cells[actor.y]?.[actor.x];
        if (cell && (cell[4] & 2) !== 0) {
          const chestIdx = cell[1];
          const chestDef = this.chapter.chests.find((c) => c.chestIndex === chestIdx);
          const isHiddenGround = (cell[4] & 0x40) !== 0;
          this.openedChests.add(coordKey(actor.x, actor.y));
          if (!isHiddenGround) {
            cell[0] += 1;
          }
          cell[1] = 0;
          cell[4] &= ~(2 | 0x40);
          let stolenLabelZh = tr('寶物', '宝物', 'Treasure');
          if (chestDef && chestDef.type === 'item' && chestDef.value > 0) {
            const stolenIt = this.assets.gameData.items[chestDef.value];
            stolenLabelZh = stolenIt?.nameZh ?? tr('寶物', '宝物', 'Treasure');
            if (actor.items.length < 8) {
              actor.items.push(chestDef.value);
              syncUnitEquipmentIndices(actor, this.assets.gameData);
            }
            actor.drop = { type: 'item', value: chestDef.value };
          } else if (chestDef && chestDef.type === 'gold' && chestDef.value > 0) {
            stolenLabelZh = `${chestDef.value} G`;
            actor.drop = { type: 'gold', value: chestDef.value };
          }
          actor.aiMode = 7;
          this.playUiSfx('chest');
          this.spawnMapFlash(actor.x, actor.y, '#f0c869', `${tr('盜取', '盗取', 'Stole')} ${stolenLabelZh}!`);
          this.logMessage(
            `${this.assets.glyphsToHtml(actor.nameGlyphs, 'crimson', 14, actor.nameZh)} ${tr(
              `打開寶箱奪取了 <strong>${stolenLabelZh}</strong>，準備逃離戰場！`,
              `打开宝箱夺取了 <strong>${stolenLabelZh}</strong>，准备逃离战场！`,
              `opened the chest and stole <strong>${stolenLabelZh}</strong>, preparing to flee!`
            )}`
          );
          if (this.selectedUnit?.runtimeId === actor.runtimeId) {
            this.updateInspectorPanel(actor);
          }
          await this.waitMapBeat(55);
        }
      }

      // Mode 7 (`fn_141685` — Ch 15 fleeing `#102` & Mode 5 thieves reaching `(aiTargetX, aiTargetY)`):
      // Plays `FDOTHER[9]` vanish sparkle and removes unit from the map!
      if (decision.escapedMap) {
        await this.director.playSparklesOnUnits([actor]);
        actor.hidden = true;
        this.logMessage(
          `${this.assets.glyphsToHtml(actor.nameGlyphs, actor.faction === 'ally' ? 'emerald' : 'crimson', 14, actor.nameZh)} ${tr(
            '脫離了戰場！',
            '脱离了战场！',
            'escaped the battlefield!'
          )}`
        );
        this.resetAllUnitsToFrontView();
        if (this.checkBattleEndConditions()) return;
        continue;
      }

      if (decision.useItemBagIdx !== undefined && decision.targetUnit) {
        const ix = decision.itemTargetX ?? decision.targetUnit.x;
        const iy = decision.itemTargetY ?? decision.targetUnit.y;
        await this.performItemUseAtTile(actor, decision.useItemBagIdx, ix, iy, decision.targetUnit);
      } else if (decision.spell && decision.targetUnit && isUnitActiveOnMap(decision.targetUnit)) {
        await this.ensureTileVisibleOnMap(decision.targetUnit.x, decision.targetUnit.y, 100);
        await this.waitMapBeat(45);
        await this.performSpellCast(actor, decision.spell, decision.targetUnit.x, decision.targetUnit.y);
      } else if (decision.targetUnit && isUnitActiveOnMap(decision.targetUnit)) {
        await this.ensureTileVisibleOnMap(decision.targetUnit.x, decision.targetUnit.y, 100);
        await this.waitMapBeat(45);
        await this.performAttack(actor, decision.targetUnit);
      } else if (
        !didMove &&
        !didMode11Magic &&
        actor.hp > 0 &&
        actor.hp < actor.maxHp &&
        actor.poisonTurns === 0 &&
        actor.paralyzeTurns === 0
      ) {
        // Exact `FD2.EXE` `fn_16340` (`fn_15007 @15990`): Unmoved, unacted AI unit with `< MaxHP` recovers `+20% MaxHP`!
        const restHeal = Math.max(1, Math.floor(actor.maxHp * 0.2));
        actor.hp = Math.min(actor.maxHp, actor.hp + restHeal);
        await this.ensureTileVisibleOnMap(actor.x, actor.y, 100);
        this.playUiSfx('heal');
        this.spawnMapFlash(actor.x, actor.y, '#68dfa0', `+${restHeal}`);
        await this.director.playSparklesOnUnits([actor]);
      }

      actor.acted = true;
      const aiWalkedPath = this.lastWalkPath.slice();
      this.lastWalkPath = [];
      if (actor.hp > 0 && actor.faction !== 'enemy') {
        await this.checkUnitStepTileEvent(actor, aiWalkedPath);
      }
      // Exact `FD2.EXE` `fn_15007 @16008` (`fn_13540()`): turn all living units back to front view (`dir = 0`)!
      this.resetAllUnitsToFrontView();

      if (this.checkBattleEndConditions()) return;
    }
  }

  // =========================================================================
  // 60FPS RENDER LOOP (Title Fire + Tactical Map + Directing FX + Cross Menu)
  // =========================================================================

  private frameLoop(nowMs: number): void {
    if (!this.titleScreenEl.classList.contains('hidden')) {
      this.renderTitleCanvas();
    } else if (
      this.chapter &&
      this.tilesetImg &&
      document.getElementById('cutscene-backdrop')?.classList.contains('hidden') !== false
    ) {
      this.renderBattlefield(nowMs);
    }
    requestAnimationFrame((t) => this.frameLoop(t));
  }

  private renderTitleCanvas(): void {
    const ctx = this.titleCanvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 320, 200);

    const logo = this.assets.screens.title;
    if (logo) {
      ctx.drawImage(logo, 0, 0, 320, 200);
    }
  }

  private renderBattlefield(nowMs: number): void {
    const ch = this.chapter!;
    const ts = this.tilesetImg!;
    const ctx = this.battleCtx;
    const W = this.battleCanvas.width;
    const H = this.battleCanvas.height;

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#090b10';
    ctx.fillRect(0, 0, W, H);

    const isCutscene = Boolean(ch.isCutsceneMap);
    const cutRect = isCutscene ? this.getCutsceneViewportRect(W, H) : null;
    const tilePx = cutRect ? cutRect.tilePx : Math.round(24 * this.zoom);
    const ox = cutRect
      ? cutRect.viewLeft - Math.round(this.cutsceneCamTopLeft[0] * tilePx) + this.screenShake[0]
      : -Math.round(this.camX) + this.screenShake[0];
    const oy = cutRect
      ? cutRect.viewTop - Math.round(this.cutsceneCamTopLeft[1] * tilePx) + this.screenShake[1]
      : -Math.round(this.camY) + this.screenShake[1];

    if (cutRect) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(cutRect.viewLeft, cutRect.viewTop, cutRect.viewW, cutRect.viewH);
      ctx.clip();
    }

    const visLeft = cutRect ? cutRect.viewLeft : 0;
    const visRight = cutRect ? cutRect.viewLeft + cutRect.viewW : W;
    const visTop = cutRect ? cutRect.viewTop : 0;
    const visBottom = cutRect ? cutRect.viewTop + cutRect.viewH : H;

    const startCol = Math.max(0, Math.floor((visLeft - ox) / tilePx));
    const endCol = Math.min(ch.width - 1, Math.ceil((visRight - ox) / tilePx));
    const startRow = Math.max(0, Math.floor((visTop - oy) / tilePx));
    const endRow = Math.min(ch.height - 1, Math.ceil((visBottom - oy) / tilePx));

    const tsCols = ch.tileset.cols;

    // 1. Terrain Tiles (pure `FDSHAP.DAT` pixel art — no artificial flashing overlay on treasure chests, matching `FD2.EXE`!)
    for (let y = startRow; y <= endRow; y++) {
      for (let x = startCol; x <= endCol; x++) {
        const [tid] = ch.cells[y][x];
        const sx = (tid % tsCols) * 24;
        const sy = Math.floor(tid / tsCols) * 24;
        const dx = ox + x * tilePx;
        const dy = oy + y * tilePx;
        ctx.drawImage(ts, sx, sy, 24, 24, dx, dy, tilePx, tilePx);
      }
    }

    // 2. Movement Reachable Overlay (Azure — strictly shown ONLY when selecting a ready player unit's move destination)
    if (this.uiState === 'unit_selected' && this.targetTiles.size === 0 && this.reachableMap.size > 0) {
      ctx.fillStyle = 'rgba(56, 156, 244, 0.30)';
      ctx.strokeStyle = 'rgba(115, 198, 255, 0.68)';
      ctx.lineWidth = 1;
      for (const node of this.reachableMap.values()) {
        const dx = ox + node.x * tilePx;
        const dy = oy + node.y * tilePx;
        ctx.fillRect(dx + 1, dy + 1, tilePx - 2, tilePx - 2);
        ctx.strokeRect(dx + 1.5, dy + 1.5, tilePx - 3, tilePx - 3);
      }
    }

    // 3. Attack / Spell / Item / Trade Target Overlay (strictly shown ONLY during active targeting modes)
    if (
      this.targetTiles.size > 0 &&
      (this.uiState === 'targeting_attack' ||
        this.uiState === 'targeting_spell' ||
        this.uiState === 'targeting_use_item' ||
        this.uiState === 'targeting_give_ally' ||
        this.uiState === 'targeting_teleport_dest')
    ) {
      const pendingUseItem =
        this.uiState === 'targeting_use_item' && this.selectedUnit && this.pendingUseItemBagIdx !== null
          ? this.assets.gameData.items[this.selectedUnit.items[this.pendingUseItemBagIdx]]
          : undefined;
      const isFriendlyTarget =
        this.uiState === 'targeting_give_ally' ||
        this.uiState === 'targeting_teleport_dest' ||
        (this.uiState === 'targeting_spell' && this.activeSpell?.targetType === 'ally') ||
        (this.uiState === 'targeting_use_item' && pendingUseItem?.useTarget !== 'enemy');
      ctx.fillStyle = isFriendlyTarget ? 'rgba(82, 222, 151, 0.32)' : 'rgba(235, 68, 60, 0.32)';
      ctx.strokeStyle = isFriendlyTarget ? 'rgba(128, 245, 182, 0.8)' : 'rgba(255, 128, 118, 0.75)';
      ctx.lineWidth = 1;
      for (const key of this.targetTiles) {
        const [tx, ty] = key.split(',').map(Number);
        const dx = ox + tx * tilePx;
        const dy = oy + ty * tilePx;
        ctx.fillRect(dx + 1, dy + 1, tilePx - 2, tilePx - 2);
        ctx.strokeRect(dx + 1.5, dy + 1.5, tilePx - 3, tilePx - 3);
      }

      const [hx, hy] = this.hoverTile;
      if (
        this.uiState === 'targeting_spell' &&
        this.activeSpell &&
        this.activeSpell.id !== 23 &&
        this.targetTiles.has(coordKey(hx, hy)) &&
        this.selectedUnit
      ) {
        const blast = getSpellBlastTiles(this.selectedUnit.x, this.selectedUnit.y, hx, hy, this.activeSpell, ch);
        ctx.fillStyle =
          this.activeSpell.targetType === 'ally' ? 'rgba(92, 224, 154, 0.38)' : 'rgba(255, 186, 66, 0.42)';
        for (const [bx, by] of blast) {
          ctx.fillRect(ox + bx * tilePx + 2, oy + by * tilePx + 2, tilePx - 4, tilePx - 4);
        }
      } else if (
        this.uiState === 'targeting_use_item' &&
        pendingUseItem &&
        pendingUseItem.useEffect !== 23 &&
        this.targetTiles.has(coordKey(hx, hy))
      ) {
        const itemAoe = pendingUseItem.useAoe ?? 0;
        const blast = getAttackableCoordinates(hx, hy, 0, itemAoe, ch);
        ctx.fillStyle =
          pendingUseItem.useTarget === 'enemy' ? 'rgba(255, 186, 66, 0.42)' : 'rgba(92, 224, 154, 0.38)';
        for (const [bx, by] of blast) {
          ctx.fillRect(ox + bx * tilePx + 2, oy + by * tilePx + 2, tilePx - 4, tilePx - 4);
        }
      }
    }

    // 4. Hover Cursor Frame (`FDICON` reticle style — hidden when `GLOBAL_2_6787 == 0`, i.e., during directing or cutscene maps!)
    if (!isCutscene && this.uiState !== 'busy') {
      const [hx, hy] = this.hoverTile;
      const dx = ox + hx * tilePx;
      const dy = oy + hy * tilePx;
      ctx.strokeStyle = '#f0c869';
      ctx.lineWidth = 2;
      ctx.strokeRect(dx + 1, dy + 1, tilePx - 2, tilePx - 2);
    }

    // 5. Battlefield Units (Renders `this.renderedUnits` so `hp <= 0` units remain visible during `fn_56165` clockwise spin!)
    const animTick = Math.floor(nowMs / 240) % 4;
    const idleFrame = animTick === 3 ? 1 : animTick;
    // Authentic `FD2.EXE` `fn_7918` / `fn_10621` 4-beat ping-pong stride (`0 -> 1 -> 2 -> 1`, 2 BIOS ticks ~90–110ms per pose)
    const walkTick = Math.floor(nowMs / 90) % 4;
    const walkFrame = walkTick === 3 ? 1 : walkTick;
    // Authentic `FD2.EXE` `fn_10208` (`L10225..10256` & `L10471..10485`):
    // `M1[GLOBAL_2_14852] ^= 1` toggles every 1 BIOS tick (~55ms) and adds `+1` native pixel to X when `paralyzeTurns > 0`!
    const paralyzeShakePx = (Math.floor(nowMs / 55) & 1) * Math.max(1, Math.round(tilePx / 24));

    for (const u of this.renderedUnits) {
      const rx = u.renderX ?? u.x;
      const ry = u.renderY ?? u.y;
      if (rx < startCol - 2 || rx > endCol + 2 || ry < startRow - 2 || ry > endRow + 2) continue;

      const dx = Math.round(ox + rx * tilePx);
      const hopPx = Math.round((u.hopOffsetY ?? 0) * (tilePx / 24));
      const dy = Math.round(oy + ry * tilePx + hopPx);

      // Subtle faction ring beneath feet (tactical battlefields only; pure sprite art on story cutscene maps!)
      if (!isCutscene) {
        ctx.fillStyle =
          u.faction === 'player'
            ? 'rgba(52, 160, 248, 0.42)'
            : u.faction === 'ally'
              ? 'rgba(66, 206, 134, 0.42)'
              : 'rgba(238, 72, 66, 0.44)';
        ctx.beginPath();
        ctx.ellipse(dx + tilePx / 2, oy + ry * tilePx + tilePx * 0.85, tilePx * 0.38, tilePx * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!isCutscene && this.selectedUnit && this.selectedUnit.runtimeId === u.runtimeId) {
        ctx.strokeStyle = '#ffd666';
        ctx.lineWidth = 2;
        ctx.strokeRect(dx + 2, dy + 2, tilePx - 4, tilePx - 4);
      }

      const isMovingNow = u.renderX !== undefined || u.renderY !== undefined;
      const isDyingSpin = u.hp <= 0;
      const isParalyzed = !isDyingSpin && u.paralyzeTurns > 0;
      const spriteDx = isParalyzed ? dx + paralyzeShakePx : dx;
      const cellFlags = !isMovingNow ? (ch.cells[u.y]?.[u.x]?.[4] ?? 0) : 0;
      if ((cellFlags & 0x08) === 0) {
        const isHalfBehindRoof = (cellFlags & 0x80) !== 0;
        if (isHalfBehindRoof) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(dx, dy, tilePx, Math.round(tilePx * 0.54));
          ctx.clip();
        }
        // Exact `FD2.EXE` `fn_10208` (`L10471..10613`) + `fn_13586` / `fn_13622`:
        // - Unacted non-paralyzed units (Player, Ally, and Enemy) play the 4-beat `0 -> 1 -> 2 -> 1` idle stomping animation.
        // - When any unit (Player, Ally, or Enemy) finishes its move/action (`u.acted === true`, `M1[unit+5] & 0x80`),
        //   it renders greyed out (`fn_253526`) and stops idle stomping (`frame 0`) until `fn_13622` resets all units on phase switch!
        // - Paralyzed units (`M1[unit+38] != 0`) lock their pose to frame `0` (`L10524`) and tremble horizontally (`v3 += GLOBAL_2_14852` at `L10479`)!
        this.assets.drawUnitSprite(
          ctx,
          u.spriteGroup,
          u.dir,
          isDyingSpin || isParalyzed || u.acted ? 0 : isMovingNow ? walkFrame : idleFrame,
          spriteDx,
          dy,
          tilePx,
          !isDyingSpin && u.acted
        );
        if (isHalfBehindRoof) {
          ctx.restore();
        }
      }

      // Crisp HP micro-bar under unit (hidden during cutscenes & directing!)
      if (this.showHpBarsOnMap && !isCutscene && this.uiState !== 'busy' && u.hp > 0 && (u.hp < u.maxHp || tilePx >= 36)) {
        const bw = tilePx - 6;
        const bh = Math.max(3, Math.round(tilePx * 0.08));
        const bx = dx + 3;
        const by = Math.round(oy + ry * tilePx + tilePx - bh - 1);
        ctx.fillStyle = 'rgba(6, 8, 14, 0.85)';
        ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
        const ratio = Math.max(0, u.hp / Math.max(1, u.maxHp));
        ctx.fillStyle =
          u.faction === 'player' ? '#49b6ff' : u.faction === 'ally' ? '#52de97' : '#f05a50';
        ctx.fillRect(bx, by, Math.round(bw * ratio), bh);
      }
    }

    // 6a. Authentic `FD2.EXE` `fn_56165` 12-Frame Unit Death Explosions (`FDOTHER[5][68..79]`)!
    for (const ex of this.explosionOverlays) {
      this.assets.drawExplosionFrame(ctx, ex.frameIdx, ox + ex.x * tilePx, oy + ex.y * tilePx, tilePx / 24);
    }

    // 6b. Authentic `FD2.EXE` `fn_50380` On-Map Spell / Status FX (`FDOTHER[6]`)!
    for (const mfx of this.mapSpellFxOverlays) {
      this.assets.drawMapSpellFxFrame(ctx, mfx.frameId, ox + mfx.x * tilePx, oy + mfx.y * tilePx, tilePx / 24);
    }

    // 6c. Authentic `FD2.EXE` `fn_57176` Bouncing Pixel Damage / Heal / `MISS` Numbers (`FDOTHER[5][94..118]`)!
    for (const pop of this.mapPopupOverlays) {
      this.assets.drawBouncingMapPopup(
        ctx,
        ox + pop.x * tilePx,
        oy + pop.y * tilePx,
        pop.yOffsetNativePx,
        pop.kind,
        pop.amount,
        tilePx / 24
      );
    }

    // 6d. Directing FX: `FDOTHER[9]` Teleportation / Rest-Heal Sparkles!
    for (const sp of this.sparkleOverlays) {
      const cx = ox + (sp.x + 0.5) * tilePx;
      const cy = oy + (sp.y + 0.5) * tilePx;
      this.assets.drawSparkleFrame(ctx, sp.frameIdx, cx, cy, tilePx / 24);
    }

    // 7. Directing FX: `FDOTHER[34]` Crystal Beam / `FDOTHER[45]` Golden Castle Rising!
    if (this.specialStripOverlay) {
      const fx = this.specialStripOverlay;
      const dw = Math.round(fx.frameW * (tilePx / 24));
      const dh = Math.round(fx.frameH * (tilePx / 24));
      const cx = Math.round(ox + (fx.tileX + 0.5) * tilePx - dw / 2);
      const cy = Math.round(oy + (fx.tileY + 0.5) * tilePx - dh / 2);
      ctx.drawImage(fx.img, fx.sx, 0, fx.frameW, fx.frameH, cx, cy, dw, dh);
    }

    // 8. Directing FX: `FDOTHER[3]` Jagged Lightning Bolt!
    if (this.lightningOverlay) {
      const lx = ox + (this.lightningOverlay.tileX + 0.5) * tilePx;
      const ly = oy + (this.lightningOverlay.tileY + 0.5) * tilePx;
      ctx.save();
      ctx.strokeStyle = '#e8f7ff';
      ctx.shadowColor = '#6cc8ff';
      ctx.shadowBlur = 18;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(lx - 18, 0);
      ctx.lineTo(lx + 14, ly * 0.32);
      ctx.lineTo(lx - 12, ly * 0.58);
      ctx.lineTo(lx + 10, ly * 0.8);
      ctx.lineTo(lx, ly);
      ctx.stroke();
      ctx.restore();
    }

    // 9. Map Spell / Heal / Level-Up Flash & Floating Text FX
    this.mapFlashes = this.mapFlashes.filter((fx) => nowMs - fx.startMs < fx.durMs);
    for (const fx of this.mapFlashes) {
      const p = (nowMs - fx.startMs) / fx.durMs;
      const dx = ox + fx.x * tilePx;
      const dy = oy + fx.y * tilePx;
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = fx.color;
      ctx.fillRect(dx + 2, dy + 2, tilePx - 4, tilePx - 4);
      if (fx.text) {
        ctx.font = 'bold 13px "Noto Sans TC", "JetBrains Mono", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#07090e';
        ctx.fillText(fx.text, dx + tilePx / 2 + 1, dy - p * 22 + 1);
        ctx.fillStyle = fx.color;
        ctx.fillText(fx.text, dx + tilePx / 2, dy - p * 22);
      }
      ctx.restore();
    }

    if (cutRect) {
      ctx.restore();
      // Subtle DOS 312x192 brass frame around the `13 × 8` story viewport!
      ctx.strokeStyle = 'rgba(212, 168, 86, 0.55)';
      ctx.lineWidth = 2;
      ctx.strokeRect(cutRect.viewLeft - 1, cutRect.viewTop - 1, cutRect.viewW + 2, cutRect.viewH + 2);
    }

    // 10. Top-Left Mini-Radar
    if (!ch.isCutsceneMap) {
      const miniScale = 3;
      const mw = ch.width * miniScale;
      const mh = ch.height * miniScale;
      const mx = 14;
      const my = 14;
      ctx.fillStyle = 'rgba(10, 13, 20, 0.78)';
      ctx.fillRect(mx - 3, my - 3, mw + 6, mh + 6);
      ctx.strokeStyle = 'rgba(212, 168, 86, 0.45)';
      ctx.lineWidth = 1;
      ctx.strokeRect(mx - 3, my - 3, mw + 6, mh + 6);

      for (let y = 0; y < ch.height; y++) {
        for (let x = 0; x < ch.width; x++) {
          const bonusIdx = ch.cells[y][x][2];
          ctx.fillStyle = bonusIdx === 5 ? '#1b202c' : bonusIdx >= 2 ? '#1f3628' : '#2d3b2d';
          ctx.fillRect(mx + x * miniScale, my + y * miniScale, miniScale, miniScale);
        }
      }
      for (const u of this.activeUnits) {
        ctx.fillStyle = u.faction === 'player' ? '#58beff' : u.faction === 'ally' ? '#5ce09a' : '#ff5e54';
        ctx.fillRect(mx + u.x * miniScale, my + u.y * miniScale, miniScale, miniScale);
      }
      const vx = mx + (-ox / tilePx) * miniScale;
      const vy = my + (-oy / tilePx) * miniScale;
      const vw = (W / tilePx) * miniScale;
      const vh = (H / tilePx) * miniScale;
      ctx.strokeStyle = '#f5efe2';
      ctx.strokeRect(Math.max(mx, vx), Math.max(my, vy), Math.min(mw, vw), Math.min(mh, vh));

      // 11. Authentic `FDOTHER[5][130]` Bottom-Left Terrain Micro-HUD!
      const hoveredUnit = this.activeUnits.find((u) => u.x === this.hoverTile[0] && u.y === this.hoverTile[1]);
      renderTacticalCornerHud(
        ctx,
        this.assets,
        ch,
        ts,
        this.hoverTile[0],
        this.hoverTile[1],
        hoveredUnit,
        W,
        H
      );
    }

    // 12. Authentic Animated 4-Way Cross Menu (`十字選單`) & `#75 米蘭` `[YES / NO!]` Confirmation!
    this.crossMenu.render(ctx, this.assets, ox, oy, tilePx, W, H, nowMs);

    // 13. Full-Screen Flash Overlay (Lightning / Teleport / Transformation)
    if (this.screenFlashAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.screenFlashAlpha);
      ctx.fillStyle = this.screenFlashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }
}

const app = new FlameDragonWebApp();
const winRef = window as unknown as { __FD2_APP__?: FlameDragonWebApp; __fd2Game?: FlameDragonWebApp };
winRef.__FD2_APP__ = app;
winRef.__fd2Game = app;
void app.mount(document.getElementById('app')!);
