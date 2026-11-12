import type { SoundEngine } from '../audio/soundEngine';
import type { AssetManager } from '../engine/assets';
import { canUnitEquipItem, getEquippedStats, getUnitClassLabel, isUnitActiveOnMap } from '../engine/tactical';
import {
  getLocalizedChapterLose,
  getLocalizedChapterTitle,
  getLocalizedChapterWin,
  getLocalizedSpellName,
  getLocalizedUnitName,
  tr,
} from '../i18n';
import type { BattleUnit, ChapterData, HeroPromotionTier, PartyMemberSave, SaveSlotData } from '../types';

export const SAVE_PREFIX = 'fd2_web_save_slot_';
export const MANUAL_SLOT_COUNT = 12;
export const AUTOSAVE_CAMP_KEY = 'fd2_web_autosave_camp';
export const AUTOSAVE_TURN_KEY = 'fd2_web_autosave_turn';
export const CLEARED_CHAPTERS_KEY = 'fd2_web_cleared_chapters';

export interface FullBackupPayload {
  fd2FullBackupVersion: 1;
  exportedAt: string;
  clearedChapters: number[];
  autoSaveCamp: SaveSlotData | null;
  autoSaveTurn: SaveSlotData | null;
  manualSlots: Record<number, SaveSlotData>;
}

export function saveAutoSaveSlot(kind: 'camp' | 'turn', data: SaveSlotData): void {
  try {
    const key = kind === 'camp' ? AUTOSAVE_CAMP_KEY : AUTOSAVE_TURN_KEY;
    const payload: SaveSlotData = { ...data, autoSaveKind: kind };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // ignore storage quota errors
  }
}

export function loadAutoSaveSlot(kind: 'camp' | 'turn'): SaveSlotData | null {
  try {
    const key = kind === 'camp' ? AUTOSAVE_CAMP_KEY : AUTOSAVE_TURN_KEY;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveSlotData;
    return parsed && Array.isArray(parsed.party) ? parsed : null;
  } catch {
    return null;
  }
}

export function getClearedChapters(): number[] {
  try {
    const raw = localStorage.getItem(CLEARED_CHAPTERS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((n) => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

export function markChapterCleared(chapterNumber: number): void {
  try {
    const set = new Set(getClearedChapters());
    set.add(chapterNumber);
    localStorage.setItem(CLEARED_CHAPTERS_KEY, JSON.stringify([...set].sort((a, b) => a - b)));
  } catch {
    // ignore
  }
}

function downloadJsonBlob(filename: string, obj: unknown): void {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

export class ModalController {
  private activeRenderFn: (() => void) | null = null;
  private activeCleanupFn: (() => void) | null = null;
  private onCloseOverride: (() => void) | null = null;

  constructor(
    private assets: AssetManager,
    private sound: SoundEngine,
    private backdropEl: HTMLElement,
    private titleEl: HTMLElement,
    private tabsEl: HTMLElement,
    private bodyEl: HTMLElement,
    private closeBtn: HTMLButtonElement
  ) {
    this.closeBtn.addEventListener('click', () => {
      this.sound.playSfx('cancel');
      if (this.onCloseOverride) {
        const fn = this.onCloseOverride;
        this.onCloseOverride = null;
        fn();
        return;
      }
      this.hide();
    });
  }

  private runCleanup(): void {
    if (this.activeCleanupFn) {
      const fn = this.activeCleanupFn;
      this.activeCleanupFn = null;
      fn();
    }
    this.onCloseOverride = null;
  }

  hide(): void {
    this.runCleanup();
    this.backdropEl.classList.add('hidden');
    this.activeRenderFn = null;
  }

  refreshIfOpen(): void {
    if (!this.backdropEl.classList.contains('hidden') && this.activeRenderFn) {
      this.activeRenderFn();
    }
  }

  private renderGlyphWithSub(
    glyphs: number[],
    color: 'ivory' | 'gold' | 'crimson' | 'azure' | 'emerald',
    heightPx: number,
    text: string,
    _subStyle = 'font-size:12px; color:var(--ink-200); margin-left:6px;'
  ): string {
    return this.assets.glyphsToHtml(glyphs, color, heightPx, text);
  }

  /**
   * Opens the authentic `FD2.EXE` (`FDOTHER[5][134, 135, 136]`) `戰況一覽` Battle Situation Overview Scroll
   * from the Empty-Tile 4-Way Cross Menu (`[7 戰況 -> 12 戰況一覽]`).
   */
  openBattleSituationModal(
    chapter: ChapterData,
    turn: number,
    gold: number,
    units: BattleUnit[],
    onSelectUnit?: (u: BattleUnit) => void
  ): void {
    this.sound.playSfx('confirm');
    this.closeBtn.style.display = 'inline-flex';
    const chTitle = getLocalizedChapterTitle(chapter.id, chapter.titleZh);
    this.titleEl.textContent = tr(
      `戰況一覽 · 第 ${chapter.chapterNumber} 章《${chTitle}》`,
      `战况一览 · 第 ${chapter.chapterNumber} 章《${chTitle}》`,
      `Battle Situation · Chapter ${chapter.chapterNumber}: "${chTitle}"`
    );

    const active = units.filter(isUnitActiveOnMap);
    const players = active.filter((u) => u.faction === 'player');
    const allies = active.filter((u) => u.faction === 'ally');
    const enemies = active.filter((u) => u.faction === 'enemy');

    let tab: 'overview' | 'player' | 'enemy' = 'overview';

    const render = () => {
      const chTitleNow = getLocalizedChapterTitle(chapter.id, chapter.titleZh);
      this.titleEl.textContent = tr(
        `戰況一覽 · 第 ${chapter.chapterNumber} 章《${chTitleNow}》`,
        `战况一览 · 第 ${chapter.chapterNumber} 章《${chTitleNow}》`,
        `Battle Situation · Chapter ${chapter.chapterNumber}: "${chTitleNow}"`
      );
      this.tabsEl.innerHTML = `
        <button class="btn ${tab === 'overview' ? 'btn-gold' : ''}" id="sit-tab-overview" type="button">${tr('戰場勝負條件', '战场胜负条件', 'Objectives & Forces')}</button>
        <button class="btn ${tab === 'player' ? 'btn-gold' : ''}" id="sit-tab-player" type="button">${tr('我軍部隊', '我军部队', 'Allied Party')} (${players.length})</button>
        <button class="btn ${tab === 'enemy' ? 'btn-gold' : ''}" id="sit-tab-enemy" type="button">${tr('敵軍與友軍', '敌军与友军', 'Enemies & NPCs')} (${enemies.length + allies.length})</button>
        <div style="flex:1"></div>
        <span style="align-self:center; font-family:var(--font-mono); color:var(--gold-200);">TURN ${turn} · $${gold} G</span>
      `;

      this.tabsEl.querySelector('#sit-tab-overview')?.addEventListener('click', () => {
        tab = 'overview';
        render();
      });
      this.tabsEl.querySelector('#sit-tab-player')?.addEventListener('click', () => {
        tab = 'player';
        render();
      });
      this.tabsEl.querySelector('#sit-tab-enemy')?.addEventListener('click', () => {
        tab = 'enemy';
        render();
      });

      if (tab === 'overview') {
        const unactedCount = players.filter((p) => !p.acted).length;
        const winText = getLocalizedChapterWin(chapter.id);
        const loseText = getLocalizedChapterLose(chapter.id);
        this.bodyEl.innerHTML = `
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:14px;">
            <div class="panel-section">
              <div class="panel-heading"><span>${tr('勝利條件 · VICTORY', '胜利条件 · VICTORY', 'VICTORY CONDITION')}</span></div>
              <div style="padding:8px 0;">
                ${this.assets.glyphsToHtml(chapter.winGlyphs, 'emerald', 18, winText)}
              </div>
              <div class="panel-heading" style="margin-top:14px;"><span>${tr('失敗條件 · DEFEAT', '失败条件 · DEFEAT', 'DEFEAT CONDITION')}</span></div>
              <div style="padding:8px 0;">
                ${this.assets.glyphsToHtml(chapter.loseGlyphs, 'crimson', 18, loseText)}
              </div>
            </div>
            <div class="panel-section">
              <div class="panel-heading"><span>${tr('戰場兵力統計 · FORCES', '战场兵力统计 · FORCES', 'BATTLEFIELD FORCES')}</span></div>
              <div class="item-chip-list">
                <div class="item-chip"><span>${tr('FRIEND (我軍存活 / 未行動)', 'FRIEND (我军存活 / 未行动)', 'PARTY (Alive / Ready)')}</span><strong style="color:var(--player-blue); font-family:var(--font-mono);">${players.length} (${tr(`未行動 ${unactedCount}`, `未行动 ${unactedCount}`, `${unactedCount} ready`)})</strong></div>
                <div class="item-chip"><span>${tr('NPC (友軍 / 保護對象)', 'NPC (友军 / 保护对象)', 'ALLY NPCs')}</span><strong style="color:var(--ally-green); font-family:var(--font-mono);">${allies.length}</strong></div>
                <div class="item-chip"><span>${tr('ENEMY (場上敵軍)', 'ENEMY (场上敌军)', 'ENEMY FORCES')}</span><strong style="color:var(--enemy-red); font-family:var(--font-mono);">${enemies.length}</strong></div>
                <div class="item-chip"><span>${tr('GOLD (軍資金)', 'GOLD (军资金)', 'WAR FUNDS')}</span><strong style="color:var(--gold-200); font-family:var(--font-mono);">${gold} G</strong></div>
                <div class="item-chip"><span>${tr('MAP SIZE (地圖尺寸)', 'MAP SIZE (地图尺寸)', 'MAP DIMENSIONS')}</span><strong style="font-family:var(--font-mono);">${chapter.width} × ${chapter.height}</strong></div>
              </div>
            </div>
          </div>
        `;
        return;
      }

      const list = tab === 'player' ? players : [...allies, ...enemies];
      const rows = list
        .map((u, i) => {
          const eq = getEquippedStats(u, this.assets.gameData);
          const cls = u.classNameZh || getUnitClassLabel(u.uid, u.classId, this.assets.gameData);
          return `
            <div class="item-chip clickable" data-pick-unit="${i}">
              <div style="display:flex; align-items:center; gap:10px;">
                <img class="pixel-crisp" src="${this.assets.portraitToDataUrl(u.portraitId, 0)}" width="40" height="40" style="border-radius:4px; border:1px solid var(--border-brass);" alt="" />
                <div>
                  <div>
                    ${this.assets.glyphsToHtml(u.nameGlyphs, u.faction === 'player' ? 'gold' : u.faction === 'ally' ? 'emerald' : 'crimson', 15, u.nameZh)}
                    <span style="font-size:12px; color:var(--ink-200); margin-left:6px;">Lv.${u.level} ${cls}</span>
                    ${u.acted && u.faction === 'player' ? `<span style="font-size:10.5px; color:var(--ink-400); margin-left:6px;">[${tr('已待機', '已待机', 'Wait')}]</span>` : ''}
                  </div>
                  <div style="font-family:var(--font-mono); font-size:11px; color:var(--ink-400);">
                    (${u.x}, ${u.y}) · HP ${u.hp}/${u.maxHp} · MP ${u.mp}/${u.maxMp} · AP ${eq.ap} · DP ${eq.dp}
                  </div>
                </div>
              </div>
              <span style="font-size:11.5px; color:var(--gold-300);">${tr('定位 →', '定位 →', 'Locate →')}</span>
            </div>
          `;
        })
        .join('');

      this.bodyEl.innerHTML = `<div class="item-chip-list">${rows || `<div style="color:var(--ink-400);">${tr('無單位', '无单位', 'No units')}</div>`}</div>`;
      this.bodyEl.querySelectorAll<HTMLElement>('[data-pick-unit]').forEach((el) => {
        el.addEventListener('click', () => {
          const u = list[Number(el.dataset.pickUnit)];
          if (u && onSelectUnit) {
            this.sound.playSfx('cursor');
            this.hide();
            onSelectUnit(u);
          }
        });
      });
    };

    this.activeRenderFn = render;
    render();
    this.backdropEl.classList.remove('hidden');
  }

  /** Opens the Ending Screen (`Normal Ending` after Ch 27 without Sky Key, or `True Ending` after Ch 30 + Map 30!). */
  openEndingModal(route: 'normal' | 'true', party: PartyMemberSave[], onReturnTitle: () => void): void {
    this.sound.playSfx('fanfare');
    this.closeBtn.style.display = 'none';
    const render = () => {
      this.titleEl.textContent =
        route === 'true'
          ? tr(
              '炎龍騎士團II：黃金城之謎 · 真結局 (TRUE ENDING — 傳說的凱旋)',
              '炎龙骑士团II：黄金城之谜 · 真结局 (TRUE ENDING — 传说的凯旋)',
              'Flame Dragon II: Legend of Golden Castle · TRUE ENDING'
            )
          : tr(
              '炎龍騎士團II：黃金城之謎 · 一般結局 (NORMAL ENDING — 命運的封印)',
              '炎龙骑士团II：黄金城之谜 · 一般结局 (NORMAL ENDING — 命运的封印)',
              'Flame Dragon II: Legend of Golden Castle · NORMAL ENDING'
            );
      this.tabsEl.innerHTML = `
        <span style="color:var(--gold-200); font-size:13px;">
          ${
            route === 'true'
              ? tr(
                  '集齊六顆元素水晶鍛造「天空之鑰」，擊破暗黑龍並迎來羅特帝亞王城凱旋大團圓！',
                  '集齐六颗元素水晶锻造「天空之钥」，击破暗黑龙并迎来罗特帝亚王城凯旋大团圆！',
                  'Forged the Sky Key from all six elemental crystals, defeated the Void Demon God, and returned in triumph to Rotoria!'
                )
              : tr(
                  '未持有「天空之鑰」：蜜蒂留在黃金城中樞封印動力爐（收集全部 6 顆水晶通過第 21 章可進入第 28–30 章真結局路線）。',
                  '未持有「天空之钥」：蜜蒂留在黄金城中枢封印动力炉（收集全部 6 颗水晶通过第 21 章可进入第 28–30 章真结局路线）。',
                  'Without the Sky Key, Midi remained behind to seal the Golden Castle reactor (collect all 6 Elemental Eyes by Chapter 21 to unlock Chapters 28–30 True Ending).'
                )
          }
        </span>
        <div style="flex:1"></div>
        <button class="btn btn-gold" id="ending-return-title" type="button">${tr('返回標題畫面', '返回标题画面', 'Return to Title')}</button>
      `;

      const rosterHtml = party
        .map(
          (m) => `
          <div class="panel-section" style="display:flex; align-items:center; gap:10px; padding:8px;">
            <img class="pixel-crisp" src="${this.assets.portraitToDataUrl(m.portraitId, 0)}" width="52" height="52" style="border-radius:4px; border:1px solid var(--border-brass);" alt="${m.nameZh ?? ''}" />
            <div>
              <div>${this.renderGlyphWithSub(m.nameGlyphs, 'gold', 15, m.nameZh ?? '', 'font-weight:700; margin-left:4px;')}</div>
              <div style="font-size:11.5px; color:var(--ink-200);">Lv.${m.level} ${m.classNameZh ?? ''}</div>
            </div>
          </div>
        `
        )
        .join('');

      this.bodyEl.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; gap:16px;">
          <img class="pixel-crisp" src="${this.assets.getScreenUrl('ending')}" style="width:min(760px, 100%); border-radius:8px; border:1px solid var(--border-brass); box-shadow:var(--shadow-elevated);" alt="Ending" />
          <div style="width:100%;">
            <div class="panel-heading"><span>${tr(`遠征英雄名錄 (${party.length} 名夥伴)`, `远征英雄名录 (${party.length} 名伙伴)`, `Expedition Heroes (${party.length} Companions)`)}</span></div>
            <div class="chapter-grid">${rosterHtml}</div>
          </div>
        </div>
      `;

      this.tabsEl.querySelector('#ending-return-title')?.addEventListener('click', () => {
        this.closeBtn.style.display = 'inline-flex';
        this.hide();
        onReturnTitle();
      });
    };

    this.activeRenderFn = render;
    render();
    this.backdropEl.classList.remove('hidden');
  }

  /**
   * Opens the 30-Battlefield + 3-Cutscene Chapter Selector (`戰場回憶`).
   * Lets players choose between using the Sandbox Preset Party (`buildPartyForChapter`) or carrying their Current Campaign Party.
   */
  openChapterSelect(
    onSelectChapter: (chapterId: number, useCampaignParty?: boolean) => void,
    hasActiveCampaignParty = false
  ): void {
    this.sound.playSfx('confirm');
    this.closeBtn.style.display = 'inline-flex';
    this.titleEl.textContent = tr(
      '戰場回憶 · 章節選擇 (30 戰役關卡 + 3 劇情演武)',
      '战场回忆 · 章节选择 (30 战役关卡 + 3 剧情演武)',
      'Chapter Select (30 Campaign Battlefields + 3 Story Cutscenes)'
    );

    let useCampaignParty = false;
    const clearedSet = new Set(getClearedChapters());

    const render = () => {
      this.titleEl.textContent = tr(
        '戰場回憶 · 章節選擇 (30 戰役關卡 + 3 劇情演武)',
        '战场回忆 · 章节选择 (30 战役关卡 + 3 剧情演武)',
        'Chapter Select (30 Campaign Battlefields + 3 Story Cutscenes)'
      );
      this.tabsEl.innerHTML = `
        <span style="color: var(--ink-200); font-size: 12px;">
          ${tr(
            '自由測試模式：預設為該章節標準等級隊伍；從「新的傳奇」或「再續前緣」過關時則會完整保留您的實際隊伍與等級。',
            '自由测试模式：默认为该章节标准等级队伍；从「新的传奇」或「再续前缘」过关时则会完整保留您的实际队伍与等级。',
            'Sandbox Mode uses a level-scaled preset party for instant testing. Normal Campaign progression carries your actual party and levels forward.'
          )}
        </span>
        <div style="flex:1"></div>
        ${
          hasActiveCampaignParty
            ? `
              <button class="btn btn-sm ${!useCampaignParty ? 'btn-gold' : ''}" id="ch-mode-preset" type="button">
                ${tr('使用章節預設隊伍', '使用章节预设队伍', 'Use Sandbox Preset Party')}
              </button>
              <button class="btn btn-sm ${useCampaignParty ? 'btn-gold' : ''}" id="ch-mode-campaign" type="button">
                ${tr('帶著目前戰役隊伍跳關', '带着目前战役队伍跳关', 'Use Current Campaign Party')}
              </button>
            `
            : ''
        }
      `;

      this.tabsEl.querySelector('#ch-mode-preset')?.addEventListener('click', () => {
        useCampaignParty = false;
        this.sound.playSfx('cursor');
        render();
      });
      this.tabsEl.querySelector('#ch-mode-campaign')?.addEventListener('click', () => {
        useCampaignParty = true;
        this.sound.playSfx('cursor');
        render();
      });

      const cards = this.assets.gameData.chapters
        .map((ch) => {
          const isCutscene = Boolean(ch.isCutsceneMap || ch.chapterNumber > 30);
          const isCleared = clearedSet.has(ch.chapterNumber);
          const locTitle = getLocalizedChapterTitle(ch.id, ch.titleZh);
          return `
            <button class="chapter-tile" id="select-chapter-${ch.id}" data-chid="${ch.id}" type="button" style="text-align:left; ${isCleared ? 'border-color: rgba(104, 223, 160, 0.55);' : ''}">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-family:var(--font-display); color:${isCutscene ? 'var(--ink-200)' : 'var(--gold-300)'}; font-weight:700; font-size:12.5px;">
                  ${
                    isCutscene
                      ? tr(`劇情 #${ch.chapterNumber}`, `剧情 #${ch.chapterNumber}`, `Cutscene #${ch.chapterNumber}`)
                      : tr(`第 ${ch.chapterNumber} 章`, `第 ${ch.chapterNumber} 章`, `Chapter ${ch.chapterNumber}`)
                  }
                  ${isCleared ? `<span style="color:var(--ally-green); font-size:11px; margin-left:4px;">★ ${tr('已通關', '已通关', 'Cleared')}</span>` : ''}
                </span>
                <span style="font-family:var(--font-mono); font-size:11px; color:var(--ink-400);">${ch.width}×${ch.height}</span>
              </div>
              <div>
                ${this.renderGlyphWithSub(ch.titleGlyphs, 'ivory', 17, locTitle)}
              </div>
              <div style="display:flex; justify-content:space-between; font-size:11.5px; color:var(--ink-400); margin-top:2px;">
                <span>${isCutscene ? tr('純劇情演武', '纯剧情演武', 'Scripted Story') : `${tr('出擊上限', '出击上限', 'Deploy')}: ${ch.maxDeploy}`}</span>
                <span>${isCutscene ? tr('過場角色', '过场角色', 'Cutscene Actors') : `${tr('敵軍數', '敌军数', 'Enemies')}: ${ch.enemyCount}`}</span>
              </div>
            </button>
          `;
        })
        .join('');

      this.bodyEl.innerHTML = `<div class="chapter-grid">${cards}</div>`;
      this.bodyEl.querySelectorAll<HTMLButtonElement>('.chapter-tile').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cid = Number(btn.dataset.chid);
          this.sound.playSfx('confirm');
          this.hide();
          onSelectChapter(cid, useCampaignParty);
        });
      });
    };

    this.activeRenderFn = render;
    render();
    this.backdropEl.classList.remove('hidden');
  }

  /**
   * Opens the authentic `FD2.EXE` (`Obj1 + 186583..188698`, `Obj2 + 9101..9946`) Interactive Town & Encampment Map
   * between chapters, featuring Thor's (`#0 索爾`) walking sprite moving between the 6 camp facilities:
   *  - `0`: Tavern & Quarters (`酒店 / 營帳整備`, `DATO[129]` / `DATO[75]`)
   *  - `1`: Armory (`武器店`, `DATO[128]`)
   *  - `2`: Palisade Exit Gate (`離開營地 / 出擊下一章`, `DATO[0]`)
   *  - `3`: Item Shop (`道具店`, `DATO[130]`)
   *  - `4`: Church Sanctuary (`教會轉職`, `DATO[131]`)
   *  - `5`: Secret Merchant (`秘密商店`, `DATO[132]`)
   */
  openTownCamp(
    nextChapterId: number,
    party: PartyMemberSave[],
    getGold: () => number,
    setGold: (g: number) => void,
    onSaveRequest: () => void,
    onDeployNext: () => void
  ): void {
    this.runCleanup();
    this.closeBtn.style.display = 'none';
    const nextChapterNumber = nextChapterId + 1;
    const nextChTitle = getLocalizedChapterTitle(nextChapterId, '');
    this.titleEl.textContent = tr(
      `城鎮與營地整備 — 準備出擊第 ${nextChapterNumber} 章《${nextChTitle}》`,
      `城镇与营地整备 — 准备出击第 ${nextChapterNumber} 章《${nextChTitle}》`,
      `Town & Encampment — Preparing for Chapter ${nextChapterNumber}: "${nextChTitle}"`
    );

    // Exact `FD2.EXE` `Obj2 + 9781` (X) and `Obj2 + 9799` (Y) 3x6 facility doorstep tables
    const CAMP_X_TABLE: readonly [number, number, number, number, number, number][] = [
      [29, 41, 59, 154, 182, 10],   // Variant 0: FDOTHER[12] Forest Encampment (camp.png)
      [90, 33, 53, 148, 222, 196],  // Variant 1: FDOTHER[62] Festive Striped-Tent Camp (ending.png)
      [59, 10, 59, 130, 242, 136],  // Variant 2: FDOTHER[63] Stone-Walled Town Bazaar (town.png)
    ];
    const CAMP_Y_TABLE: readonly [number, number, number, number, number, number][] = [
      [46, 109, 163, 139, 65, 10],
      [30, 105, 163, 139, 85, 8],
      [26, 144, 163, 150, 31, 20],
    ];

    const shopIdx = Math.min(this.assets.gameData.shops.length - 1, Math.max(0, nextChapterId));
    const shopDef = this.assets.gameData.shops[shopIdx] ?? this.assets.gameData.shops[0];
    // FD2.EXE `GLOBAL_2_9913`: Chapters 22, 23, 24, 27, 28, 29, 30 are Camp-Only intermissions (no town shops/church)
    const isCampOnlyChapter = Boolean(
      shopDef?.isCampOnly || [22, 23, 24, 27, 28, 29, 30].includes(nextChapterNumber)
    );
    const hasShopStock = !isCampOnlyChapter && (shopDef?.weaponShop.length > 0 || shopDef?.itemShop.length > 0);
    const hasSecretStock = !isCampOnlyChapter && (shopDef?.secretShop?.length ?? 0) > 0;

    // `Obj2 + 9943`: 0 -> FDOTHER[12] ('camp'), 1 -> FDOTHER[62] ('ending'), 2 -> FDOTHER[63] ('town')
    const rawVariant = isCampOnlyChapter ? 0 : (shopDef?.secretTrigger?.[0] ?? 0);
    const campVariant: 0 | 1 | 2 = rawVariant === 2 ? 2 : rawVariant === 1 ? 1 : 0;
    const campScreenKey: 'camp' | 'ending' | 'town' =
      campVariant === 2 ? 'town' : campVariant === 1 ? 'ending' : 'camp';

    type CampViewMode = 'map' | 'party' | 'weapon' | 'item' | 'church' | 'secret';
    let activeTab: CampViewMode = 'map';
    let selectedMemberIdx = 0;
    let facilityIdx = 0; // 0..5 matching `Obj2 + 16683`
    let hoveredFacilityIdx: number | null = null;
    let thorX = CAMP_X_TABLE[campVariant][0];
    let thorY = CAMP_Y_TABLE[campVariant][0];
    let thorDir = 0; // 0=Down/Front, 1=Left, 2=Up, 3=Right
    let walkAnim: {
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
      startMs: number;
      durMs: number;
      dir: number;
      onArrive?: () => void;
    } | null = null;
    let rafId: number | null = null;

    const getFacilityMeta = (fIdx: number) => {
      const gd = this.assets.gameData;
      const sysGlyphs = gd.sysStrings?.[495 + fIdx] ?? [];
      switch (fIdx) {
        case 0:
          return {
            idx: 0,
            sysGlyphs,
            shortLabel: isCampOnlyChapter
              ? tr('主營帳', '主营帐', 'Command Tent')
              : tr('酒店 · 整備', '酒店 · 整备', 'Tavern & Gear'),
            titleLabel: isCampOnlyChapter
              ? tr('野戰主營帳 (隊伍裝備與記錄)', '野战主营帐 (队伍装备与记录)', 'Field Command Tent (Party Gear & Save)')
              : tr('城鎮酒店 (隊伍整備與記錄進度)', '城镇酒店 (队伍整备与记录进度)', 'Town Tavern (Party Gear & Save Progress)'),
            npcId: isCampOnlyChapter ? 75 : 129,
            enabled: true,
            greeting: isCampOnlyChapter
              ? tr('在此整理各隊員的武器防具、使用能力藥水或記錄進度。', '在此整理各队员的武器防具、使用能力药水或记录进度。', 'Organize your heroes’ equipment, consume stat potions, or save your progress here.')
              : tr('「歡迎來到酒店！您可以在此整理隊伍裝備或記錄冒險進度。」', '“欢迎来到酒店！您可以在此整理队伍装备或记录冒险进度。”', '"Welcome to the Tavern! Manage your party’s gear or save your adventure progress here."'),
          };
        case 1:
          return {
            idx: 1,
            sysGlyphs,
            shortLabel: tr('武器店', '武器店', 'Armory'),
            titleLabel: tr('武器與防具店', '武器与防具店', 'Weapons & Armor Shop'),
            npcId: 128,
            enabled: hasShopStock,
            greeting: hasShopStock
              ? tr('「挑把稱手的兵器吧！本店販售本章最新鍛造的武器與防具。」', '“挑把称手的兵器吧！本店贩售本章最新锻造的武器与防具。”', '"Pick a fine blade! We carry freshly forged weapons and armor for this chapter."')
              : tr('（野戰行軍營地無武器店鋪，請於主營帳整備現有裝備）', '（野战行军营地无武器店铺，请于主营帐整备现有装备）', '(No Armory available in this field camp; manage existing gear in the Command Tent.)'),
          };
        case 2:
          return {
            idx: 2,
            sysGlyphs,
            shortLabel: tr('營門出擊', '营门出击', 'Exit Gate'),
            titleLabel: tr(`離開營地 → 出擊第 ${nextChapterNumber} 章`, `离开营地 → 出击第 ${nextChapterNumber} 章`, `Leave Camp → March to Chapter ${nextChapterNumber}`),
            npcId: (party.find((m) => (m.baseHeroId ?? m.uid) === 0) ?? party[0])?.portraitId ?? 0,
            enabled: true,
            greeting: tr(
              `整備完畢後，可由此離開營地並出擊第 ${nextChapterNumber} 章《${getLocalizedChapterTitle(nextChapterId, '')}》！`,
              `整备完毕后，可由此离开营地并出击第 ${nextChapterNumber} 章《${getLocalizedChapterTitle(nextChapterId, '')}》！`,
              `When your party is ready, pass through the gate to march into Chapter ${nextChapterNumber}: "${getLocalizedChapterTitle(nextChapterId, '')}"!`
            ),
          };
        case 3:
          return {
            idx: 3,
            sysGlyphs,
            shortLabel: tr('道具店', '道具店', 'Item Shop'),
            titleLabel: tr('道具與藥水店', '道具与药水店', 'Potions & Items Shop'),
            npcId: 130,
            enabled: hasShopStock,
            greeting: hasShopStock
              ? tr('「出征前別忘了添購療傷藥草與解毒劑！」', '“出征前别忘了添购疗伤药草与解毒剂！”', '"Don’t forget to stock up on healing herbs and antidotes before marching out!"')
              : tr('（野戰行軍營地無道具店鋪）', '（野战行军营地无道具店铺）', '(No Item Shop available in this field camp.)'),
          };
        case 4:
          return {
            idx: 4,
            sysGlyphs,
            shortLabel: tr('教會', '教会', 'Sanctuary'),
            titleLabel: tr('聖堂教會 (英雄轉職與記錄)', '圣堂教会 (英雄转职与记录)', 'Church Sanctuary (Class Promotion & Save)'),
            npcId: 131,
            enabled: !isCampOnlyChapter,
            greeting: !isCampOnlyChapter
              ? tr('「願聖光庇佑諸位。等級達 Lv 20 的夥伴可在此進行轉職儀式。」', '“愿圣光庇佑诸位。等级达 Lv 20 的伙伴可在此进行转职仪式。”', '"May the Light bless your company. Heroes at Lv 20 may undergo class promotion here."')
              : tr('（野戰行軍營地無聖堂教會）', '（野战行军营地无圣堂教会）', '(No Church Sanctuary available in this field camp.)'),
          };
        default:
          return {
            idx: 5,
            sysGlyphs,
            shortLabel: tr('秘密商店', '秘密商店', 'Secret Shop'),
            titleLabel: tr('神秘行商 (隱藏寶物與秘藥)', '神秘行商 (隐藏宝物与秘药)', 'Secret Merchant (Rare Relics & Elixirs)'),
            npcId: 132,
            enabled: hasSecretStock,
            greeting: hasSecretStock
              ? tr('「嘿嘿……居然被你找到這裡了！看看這些市面上買不到的稀世珍寶吧！」', '“嘿嘿……居然被你找到这里了！看看这些市面上买不到的稀世珍宝吧！”', '"Heh heh... so you found my hidden tent! Take a look at these rare treasures you won’t find anywhere else!"')
              : tr('（本章無秘密商人存貨）', '（本章无秘密商人存货）', '(The Secret Merchant has no wares in this chapter.)'),
          };
      }
    };

    const formatDosSecretHint = (): string => {
      if (!hasSecretStock || !shopDef?.secretTrigger) return '';
      const [, fromFac, scanCode] = shopDef.secretTrigger;
      const fromMeta = getFacilityMeta(fromFac);
      let keyDesc = `Key ${scanCode}`;
      if (scanCode >= 84 && scanCode <= 93) keyDesc = `Shift+F${scanCode - 83}`;
      else if (scanCode >= 94 && scanCode <= 103) keyDesc = `Ctrl+F${scanCode - 93}`;
      else if (scanCode >= 104 && scanCode <= 113) keyDesc = `Alt+F${scanCode - 103}`;
      return tr(
        `💡 原版秘技：站在【${fromMeta.shortLabel}】按 ${keyDesc}（或直接點擊地圖上 5 號「秘密商店」帳篷）可拜訪秘密商人！`,
        `💡 原版秘技：站在【${fromMeta.shortLabel}】按 ${keyDesc}（或直接点击地图上 5 号“秘密商店”帐篷）可拜访秘密商人！`,
        `💡 Classic Secret: Stand at [${fromMeta.shortLabel}] and press ${keyDesc} (or click Tent #5 "Secret Shop" on the map) to visit the Secret Merchant!`
      );
    };

    const syncTownTabBgm = () => {
      // Exact `FD2.EXE` Town / Camp BGM (`Obj1 + 187188, 188565..188670`):
      //  - `map` (Interactive Camp Map): `FDMUS[10]`
      //  - `party` (Tavern / Quarters): `FDMUS[13]` (or `10` in field camp)
      //  - `weapon` / `secret` (Armory / Secret Merchant): `FDMUS[14]`
      //  - `item` (Item Shop): `FDMUS[15]`
      //  - `church` (Sanctuary): `FDMUS[11]`
      if (activeTab === 'map') {
        this.sound.playBgmBySourceIndex(10);
      } else if (activeTab === 'party') {
        this.sound.playBgmBySourceIndex(isCampOnlyChapter ? 10 : 13);
      } else if (activeTab === 'weapon' || activeTab === 'secret') {
        this.sound.playBgmBySourceIndex(14);
      } else if (activeTab === 'item') {
        this.sound.playBgmBySourceIndex(15);
      } else if (activeTab === 'church') {
        this.sound.playBgmBySourceIndex(11);
      }
    };

    const enterFacility = (fIdx: number) => {
      const meta = getFacilityMeta(fIdx);
      if (fIdx === 2) {
        this.sound.playSfx('fanfare');
        this.closeBtn.style.display = 'inline-flex';
        this.hide();
        onDeployNext();
        return;
      }
      if (!meta.enabled) {
        this.sound.playSfx('cancel');
        return;
      }
      this.sound.playSfx('confirm');
      if (fIdx === 0) activeTab = 'party';
      else if (fIdx === 1) activeTab = 'weapon';
      else if (fIdx === 3) activeTab = 'item';
      else if (fIdx === 4) activeTab = 'church';
      else if (fIdx === 5) activeTab = 'secret';
      syncTownTabBgm();
      renderAll();
    };

    const walkThorToFacility = (targetIdx: number, enterOnArrive = false) => {
      const clamped = Math.max(0, Math.min(5, targetIdx));
      const destX = CAMP_X_TABLE[campVariant][clamped];
      const destY = CAMP_Y_TABLE[campVariant][clamped];
      if (clamped === facilityIdx && !walkAnim) {
        if (enterOnArrive) {
          enterFacility(clamped);
        } else {
          this.sound.playSfx('cursor');
          renderAll();
        }
        return;
      }
      facilityIdx = clamped;
      this.sound.playSfx('cursor');
      const dx = destX - thorX;
      const dy = destY - thorY;
      const dist = Math.hypot(dx, dy);
      const dir = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 3 : 1) : dy < 0 ? 2 : 0;
      const durMs = Math.max(140, Math.min(360, Math.round(dist * 2.1)));
      walkAnim = {
        fromX: thorX,
        fromY: thorY,
        toX: destX,
        toY: destY,
        startMs: performance.now(),
        durMs,
        dir,
        onArrive: enterOnArrive ? () => enterFacility(clamped) : undefined,
      };
      updateMapStatusBanner();
      renderTabs();
    };

    const updateMapStatusBanner = () => {
      const bannerEl = this.bodyEl.querySelector<HTMLElement>('#camp-active-facility-banner');
      if (!bannerEl) return;
      const meta = getFacilityMeta(facilityIdx);
      const gd = this.assets.gameData;
      const npcDex = gd.unitDex[meta.npcId];
      const npcName = getLocalizedUnitName(meta.npcId, npcDex?.nameZh ?? '');
      const actionLabel =
        facilityIdx === 2
          ? tr(`出擊第 ${nextChapterNumber} 章 →`, `出击第 ${nextChapterNumber} 章 →`, `March to Ch.${nextChapterNumber} →`)
          : meta.enabled
            ? tr(`進入${meta.shortLabel} (Enter)`, `进入${meta.shortLabel} (Enter)`, `Enter ${meta.shortLabel} (Enter)`)
            : tr('此設施未開放', '此设施未开放', 'Unavailable in Field Camp');
      bannerEl.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0;">
          <img class="pixel-crisp" src="${this.assets.portraitToDataUrl(meta.npcId, 0)}" width="56" height="56" style="border-radius:6px; border:1px solid var(--border-brass); flex-shrink:0;" alt="${npcName}" />
          <div style="min-width:0; flex:1;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span style="font-family:var(--font-display); font-size:15px; font-weight:700; color:var(--gold-200);">[${meta.idx + 1}] ${meta.titleLabel}</span>
              <span style="font-size:11.5px; color:var(--ink-400);">— ${npcName}</span>
            </div>
            <div style="font-size:12.5px; color:var(--ink-200); margin-top:3px;">${meta.greeting}</div>
          </div>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          ${
            facilityIdx === 0 || facilityIdx === 4
              ? `<button class="btn" id="camp-banner-save-btn" type="button">${tr('記錄進度 (Save)', '记录进度 (Save)', 'Save Progress')}</button>`
              : ''
          }
          <button class="btn ${meta.enabled ? 'btn-gold' : ''}" id="camp-banner-enter-btn" ${meta.enabled ? '' : 'disabled'} type="button">
            ${actionLabel}
          </button>
        </div>
      `;
      bannerEl.querySelector('#camp-banner-enter-btn')?.addEventListener('click', () => {
        enterFacility(facilityIdx);
      });
      bannerEl.querySelector('#camp-banner-save-btn')?.addEventListener('click', () => {
        this.sound.playBgmBySourceIndex(11);
        onSaveRequest();
      });
    };

    const drawCampMapFrame = (nowMs: number) => {
      const canvas = this.bodyEl.querySelector<HTMLCanvasElement>('#camp-interactive-canvas');
      if (!canvas) return;
      const isHd = this.assets.getEditionMode() === 'hd';
      const scale = isHd ? 4 : 1;
      const targetW = 320 * scale;
      const targetH = 200 * scale;
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = isHd;
      if (isHd) ctx.imageSmoothingQuality = 'high';

      // 1. Step Thor's walking interpolation if active
      if (walkAnim) {
        const t = Math.min(1, (nowMs - walkAnim.startMs) / Math.max(1, walkAnim.durMs));
        thorX = walkAnim.fromX + (walkAnim.toX - walkAnim.fromX) * t;
        thorY = walkAnim.fromY + (walkAnim.toY - walkAnim.fromY) * t;
        thorDir = walkAnim.dir;
        if (t >= 1) {
          thorX = walkAnim.toX;
          thorY = walkAnim.toY;
          thorDir = 0;
          const cb = walkAnim.onArrive;
          walkAnim = null;
          if (cb) {
            cb();
            return;
          }
        }
      } else {
        thorX = CAMP_X_TABLE[campVariant][facilityIdx];
        thorY = CAMP_Y_TABLE[campVariant][facilityIdx];
        thorDir = 0;
      }

      // 2. Draw 320x200 (or 1280x800 HD) Camp / Town background
      const bgImg = this.assets.getScreenImage(campScreenKey);
      if (bgImg) {
        ctx.drawImage(bgImg, 0, 0, bgImg.width, bgImg.height, 0, 0, targetW, targetH);
      } else {
        ctx.fillStyle = '#0b101b';
        ctx.fillRect(0, 0, targetW, targetH);
      }

      // 3. Draw facility doorstep markers & clickable labels for facilities 0..5
      const visibleFacilities = hasSecretStock ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4];
      const pulse = 0.5 + 0.5 * Math.sin(nowMs / 210);
      for (const fIdx of visibleFacilities) {
        const fx = CAMP_X_TABLE[campVariant][fIdx] * scale;
        const fy = CAMP_Y_TABLE[campVariant][fIdx] * scale;
        const boxPx = 24 * scale;
        const isSelected = fIdx === facilityIdx;
        const isHovered = fIdx === hoveredFacilityIdx;
        const meta = getFacilityMeta(fIdx);

        ctx.save();
        // Doorstep footring
        if (isSelected || isHovered) {
          ctx.strokeStyle = isSelected
            ? `rgba(248, 214, 110, ${0.75 + 0.25 * pulse})`
            : 'rgba(130, 210, 255, 0.85)';
          ctx.lineWidth = Math.max(1.5, 1.8 * scale);
          ctx.fillStyle = isSelected ? 'rgba(248, 204, 90, 0.20)' : 'rgba(120, 195, 255, 0.16)';
          ctx.beginPath();
          ctx.roundRect(fx - 2 * scale, fy - 2 * scale, boxPx + 4 * scale, boxPx + 4 * scale, 4 * scale);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.strokeStyle = meta.enabled ? 'rgba(218, 182, 98, 0.42)' : 'rgba(140, 145, 160, 0.25)';
          ctx.lineWidth = Math.max(1, 1 * scale);
          ctx.strokeRect(fx, fy, boxPx, boxPx);
        }

        // Floating facility badge above/below doorstep
        const badgeText = meta.shortLabel;
        const fontPx = Math.round(9.5 * scale);
        ctx.font = `700 ${fontPx}px "Noto Sans TC", "PingFang TC", system-ui, sans-serif`;
        const textW = ctx.measureText(badgeText).width;
        const padX = 5 * scale;
        const badgeW = textW + padX * 2;
        const badgeH = 13 * scale;
        const bx = Math.max(2 * scale, Math.min(targetW - badgeW - 2 * scale, fx + boxPx / 2 - badgeW / 2));
        const by = fy >= 152 * scale ? fy - badgeH - 3 * scale : fy + boxPx + 2 * scale;

        ctx.fillStyle = isSelected
          ? 'rgba(24, 18, 8, 0.92)'
          : isHovered
            ? 'rgba(14, 24, 38, 0.90)'
            : 'rgba(10, 13, 20, 0.78)';
        ctx.strokeStyle = isSelected
          ? '#f5d06c'
          : isHovered
            ? '#7cc8ff'
            : meta.enabled
              ? 'rgba(212, 168, 86, 0.55)'
              : 'rgba(130, 136, 150, 0.35)';
        ctx.lineWidth = Math.max(1, 1.1 * scale);
        ctx.beginPath();
        ctx.roundRect(bx, by, badgeW, badgeH, 3 * scale);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isSelected
          ? '#ffe28a'
          : !meta.enabled
            ? '#7c8292'
            : isHovered
              ? '#b8e2ff'
              : '#e6dec8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, bx + badgeW / 2, by + badgeH / 2 + 0.5 * scale);
        ctx.restore();
      }

      // 4. Draw Thor's (`#0 索爾`) animated 24x24 (96x96 HD) sprite (`L187905..187994`: 4-step cycle 0->1->2->1)
      const thorMember = party.find((m) => (m.baseHeroId ?? m.uid) === 0) ?? party[0];
      const thorSpriteGroup = thorMember?.spriteGroup ?? 0;
      const cycleStep = Math.floor(nowMs / (walkAnim ? 90 : 175)) % 4;
      const animFrame = cycleStep === 3 ? 1 : cycleStep;
      this.assets.drawUnitSprite(
        ctx,
        thorSpriteGroup,
        thorDir,
        animFrame,
        Math.round(thorX * scale),
        Math.round(thorY * scale),
        24 * scale,
        false
      );

      // 5. Draw authentic FD2.EXE top signboard (`L187850..187897`: `sysStrings[495 + facilityIdx]`)
      const activeMeta = getFacilityMeta(facilityIdx);
      ctx.save();
      const signW = 148 * scale;
      const signH = 22 * scale;
      const signX = Math.round((targetW - signW) / 2);
      const signY = 6 * scale;
      ctx.fillStyle = 'rgba(11, 15, 26, 0.88)';
      ctx.strokeStyle = 'rgba(232, 190, 96, 0.85)';
      ctx.lineWidth = Math.max(1, 1.4 * scale);
      ctx.beginPath();
      ctx.roundRect(signX, signY, signW, signH, 4 * scale);
      ctx.fill();
      ctx.stroke();

      if (activeMeta.sysGlyphs.length > 0) {
        const glyphW = this.assets.measureGlyphs(activeMeta.sysGlyphs, activeMeta.shortLabel, scale);
        const gx = Math.round(signX + (signW - glyphW) / 2);
        const gy = Math.round(signY + (signH - 16 * scale) / 2);
        this.assets.drawGlyphs(ctx, activeMeta.sysGlyphs, gx, gy, 'gold', scale, true, activeMeta.shortLabel);
      }
      ctx.restore();
    };

    const startCampLoop = () => {
      if (rafId !== null) return;
      const tick = (now: number) => {
        if (activeTab === 'map') {
          drawCampMapFrame(now);
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    };

    const onKeyDown = (ev: KeyboardEvent) => {
      if (this.backdropEl.classList.contains('hidden')) return;
      if (activeTab !== 'map') {
        if (ev.key === 'Escape') {
          ev.preventDefault();
          this.sound.playSfx('cancel');
          activeTab = 'map';
          syncTownTabBgm();
          renderAll();
        }
        return;
      }

      // Authentic FD2.EXE `L187614..187646`: Secret Shop hotkey trigger (`Shift/Ctrl/Alt + F1..F10`)!
      if (hasSecretStock && shopDef?.secretTrigger && ev.key.startsWith('F')) {
        const fNum = Number(ev.key.slice(1));
        if (fNum >= 1 && fNum <= 10) {
          let dosScan = 0;
          if (ev.shiftKey) dosScan = 83 + fNum;
          else if (ev.ctrlKey) dosScan = 93 + fNum;
          else if (ev.altKey) dosScan = 103 + fNum;
          if (dosScan === shopDef.secretTrigger[2] && facilityIdx === shopDef.secretTrigger[1]) {
            ev.preventDefault();
            walkThorToFacility(5, false);
            return;
          }
        }
      }

      // Number shortcuts 1..6
      if (ev.key >= '1' && ev.key <= '6') {
        const idx = Number(ev.key) - 1;
        if (idx < 5 || hasSecretStock) {
          ev.preventDefault();
          walkThorToFacility(idx, false);
          return;
        }
      }

      // Arrow keys / WASD matching `FD2.EXE` `L187514..187612` (`Left` increments 0..4, `Right` decrements 4..0)
      if (ev.key === 'ArrowLeft' || ev.key === 'a' || ev.key === 'A' || ev.key === 'ArrowDown' || ev.key === 's' || ev.key === 'S') {
        ev.preventDefault();
        const nextIdx = facilityIdx >= 4 ? 0 : facilityIdx + 1;
        walkThorToFacility(nextIdx, false);
      } else if (ev.key === 'ArrowRight' || ev.key === 'd' || ev.key === 'D' || ev.key === 'ArrowUp' || ev.key === 'w' || ev.key === 'W') {
        ev.preventDefault();
        const prevIdx = facilityIdx <= 0 || facilityIdx > 4 ? 4 : facilityIdx - 1;
        walkThorToFacility(prevIdx, false);
      } else if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        enterFacility(facilityIdx);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    this.activeCleanupFn = () => {
      window.removeEventListener('keydown', onKeyDown);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const renderTabs = () => {
      this.tabsEl.innerHTML = `
        <button class="btn ${activeTab === 'map' ? 'btn-gold' : ''}" id="camp-tab-map" type="button">🗺️ ${tr('營地地圖', '营地地图', 'Camp Map')}</button>
        <button class="btn ${activeTab === 'party' ? 'btn-gold' : ''}" id="camp-tab-party" type="button">${tr('1. 酒店整備', '1. 酒店整备', '1. Tavern & Gear')}</button>
        <button class="btn ${activeTab === 'weapon' ? 'btn-gold' : ''}" id="camp-tab-weapon" ${hasShopStock ? '' : 'disabled'} type="button">${tr('2. 武器店', '2. 武器店', '2. Armory')}</button>
        <button class="btn ${activeTab === 'item' ? 'btn-gold' : ''}" id="camp-tab-item" ${hasShopStock ? '' : 'disabled'} type="button">${tr('4. 道具店', '4. 道具店', '4. Item Shop')}</button>
        <button class="btn ${activeTab === 'church' ? 'btn-gold' : ''}" id="camp-tab-church" ${isCampOnlyChapter ? 'disabled' : ''} type="button">${tr('5. 教會轉職', '5. 教会转职', '5. Sanctuary')}</button>
        ${
          hasSecretStock
            ? `<button class="btn ${activeTab === 'secret' ? 'btn-gold' : ''}" id="camp-tab-secret" type="button">${tr('6. 秘密商店', '6. 秘密商店', '6. Secret Shop')}</button>`
            : ''
        }
        <div style="flex:1; min-width:8px;"></div>
        <span style="align-self:center; font-family:var(--font-mono); color:var(--gold-200); margin-right:6px; white-space:nowrap;">${tr('資金', '资金', 'Gold')}: ${getGold()} G</span>
        <button class="btn" id="camp-save-btn" type="button">${tr('記錄進度', '记录进度', 'Save')}</button>
        <button class="btn btn-gold" id="camp-deploy-btn" type="button">${tr(`3. 出擊第 ${nextChapterNumber} 章 →`, `3. 出击第 ${nextChapterNumber} 章 →`, `3. March to Ch.${nextChapterNumber} →`)}</button>
      `;

      this.tabsEl.querySelector('#camp-tab-map')?.addEventListener('click', () => {
        activeTab = 'map';
        this.sound.playSfx('cursor');
        syncTownTabBgm();
        renderAll();
      });
      this.tabsEl.querySelector('#camp-tab-party')?.addEventListener('click', () => {
        facilityIdx = 0;
        activeTab = 'party';
        this.sound.playSfx('cursor');
        syncTownTabBgm();
        renderAll();
      });
      this.tabsEl.querySelector('#camp-tab-weapon')?.addEventListener('click', () => {
        facilityIdx = 1;
        activeTab = 'weapon';
        this.sound.playSfx('cursor');
        syncTownTabBgm();
        renderAll();
      });
      this.tabsEl.querySelector('#camp-tab-item')?.addEventListener('click', () => {
        facilityIdx = 3;
        activeTab = 'item';
        this.sound.playSfx('cursor');
        syncTownTabBgm();
        renderAll();
      });
      this.tabsEl.querySelector('#camp-tab-church')?.addEventListener('click', () => {
        facilityIdx = 4;
        activeTab = 'church';
        this.sound.playSfx('cursor');
        syncTownTabBgm();
        renderAll();
      });
      this.tabsEl.querySelector('#camp-tab-secret')?.addEventListener('click', () => {
        facilityIdx = 5;
        activeTab = 'secret';
        this.sound.playSfx('cursor');
        syncTownTabBgm();
        renderAll();
      });
      this.tabsEl.querySelector('#camp-save-btn')?.addEventListener('click', () => {
        this.sound.playBgmBySourceIndex(11);
        onSaveRequest();
      });
      this.tabsEl.querySelector('#camp-deploy-btn')?.addEventListener('click', () => {
        if (activeTab === 'map' && facilityIdx !== 2) {
          walkThorToFacility(2, true);
          return;
        }
        this.sound.playSfx('fanfare');
        this.closeBtn.style.display = 'inline-flex';
        this.hide();
        onDeployNext();
      });
    };

    const renderMemberSelector = () =>
      party
        .map((m, idx) => {
          const clsLabel = m.classNameZh ?? getUnitClassLabel(m.uid, m.classId, this.assets.gameData);
          const active = idx === selectedMemberIdx;
          return `
            <button class="item-chip clickable" data-midx="${idx}" type="button" style="width:100%; border-color:${active ? 'var(--gold-400)' : 'var(--border-subtle)'};">
              <span>${this.assets.glyphsToHtml(m.nameGlyphs, active ? 'gold' : 'ivory', 15, m.nameZh ?? '')}</span>
              <span style="font-family:var(--font-mono); font-size:11px; color:var(--ink-400);">Lv${m.level} ${clsLabel} (${m.items.length}/8)</span>
            </button>
          `;
        })
        .join('');

    const bindMemberSelector = () => {
      this.bodyEl.querySelectorAll<HTMLButtonElement>('[data-midx]').forEach((b) => {
        b.addEventListener('click', () => {
          selectedMemberIdx = Number(b.dataset.midx);
          this.sound.playSfx('cursor');
          renderBody();
        });
      });
    };

    const renderBackToMapBtn = () => `
      <button class="btn btn-gold" id="camp-back-to-map-btn" type="button" style="width:100%; justify-content:center;">
        ← ${tr('返回營地地圖 (Esc)', '返回营地地图 (Esc)', 'Back to Camp Map (Esc)')}
      </button>
    `;

    const bindBackToMapBtn = () => {
      this.bodyEl.querySelector('#camp-back-to-map-btn')?.addEventListener('click', () => {
        this.sound.playSfx('cancel');
        activeTab = 'map';
        syncTownTabBgm();
        renderAll();
      });
    };

    const renderBody = () => {
      if (activeTab === 'map') {
        const visibleFacilities = hasSecretStock ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4];
        const quickChipsHtml = visibleFacilities
          .map((fIdx) => {
            const m = getFacilityMeta(fIdx);
            const active = fIdx === facilityIdx;
            return `
              <button class="btn btn-sm ${active ? 'btn-gold' : ''}" data-camp-fac="${fIdx}" type="button">
                ${fIdx + 1}. ${m.shortLabel}
              </button>
            `;
          })
          .join('');
        const secretHintText = formatDosSecretHint();

        this.bodyEl.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:10px;">
            <div class="camp-map-stage">
              <canvas id="camp-interactive-canvas" class="camp-map-canvas" width="320" height="200"></canvas>
            </div>
            <div id="camp-active-facility-banner" class="panel-section" style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; padding:10px 14px;"></div>
            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; font-size:12px; color:var(--ink-400);">
              <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                <span>${tr('移動索爾：方向鍵 ←/→ 或點擊帳篷 · Enter 進入設施', '移动索尔：方向键 ←/→ 或点击帐篷 · Enter 进入设施', 'Move Thor: Arrow Keys ←/→ or Click Tent · Enter to Operate')}:</span>
                ${quickChipsHtml}
              </div>
              ${secretHintText ? `<div style="color:var(--gold-300); font-size:11.5px;">${secretHintText}</div>` : ''}
            </div>
          </div>
        `;

        updateMapStatusBanner();
        this.bodyEl.querySelectorAll<HTMLButtonElement>('[data-camp-fac]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const targetIdx = Number(btn.dataset.campFac);
            if (targetIdx === facilityIdx) {
              enterFacility(targetIdx);
            } else {
              walkThorToFacility(targetIdx, targetIdx !== 2);
            }
          });
        });

        const canvas = this.bodyEl.querySelector<HTMLCanvasElement>('#camp-interactive-canvas');
        if (canvas) {
          const hitTestFacility = (ev: MouseEvent): number | null => {
            const rect = canvas.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return null;
            const nx = ((ev.clientX - rect.left) / rect.width) * 320;
            const ny = ((ev.clientY - rect.top) / rect.height) * 200;
            let bestIdx: number | null = null;
            let bestDist = 42; // generous click radius around 24x24 tent doorstep & badge
            for (const fIdx of visibleFacilities) {
              const cx = CAMP_X_TABLE[campVariant][fIdx] + 12;
              const cy = CAMP_Y_TABLE[campVariant][fIdx] + 14;
              const d = Math.hypot(nx - cx, ny - cy);
              if (d < bestDist) {
                bestDist = d;
                bestIdx = fIdx;
              }
            }
            return bestIdx;
          };

          canvas.addEventListener('mousemove', (ev) => {
            hoveredFacilityIdx = hitTestFacility(ev);
          });
          canvas.addEventListener('mouseleave', () => {
            hoveredFacilityIdx = null;
          });
          canvas.addEventListener('click', (ev) => {
            const hit = hitTestFacility(ev);
            if (hit === null) return;
            if (hit === facilityIdx && !walkAnim) {
              enterFacility(hit);
            } else {
              // Walk Thor to the clicked tent; auto-enter shops/tavern/church on arrival, or stop at Exit Gate first for safety
              walkThorToFacility(hit, hit !== 2);
            }
          });
        }

        drawCampMapFrame(performance.now());
        startCampLoop();
        return;
      }

      const member = party[selectedMemberIdx] ?? party[0];
      if (!member) return;
      const gd = this.assets.gameData;
      const clsLabel = member.classNameZh ?? getUnitClassLabel(member.uid, member.classId, gd);
      const artSrc =
        activeTab === 'church'
          ? this.assets.getScreenUrl('church')
          : this.assets.getScreenUrl(campScreenKey);
      const npcPid =
        activeTab === 'weapon'
          ? 128
          : activeTab === 'item'
            ? 130
            : activeTab === 'church'
              ? 131
              : activeTab === 'secret'
                ? 132
                : isCampOnlyChapter
                  ? 75
                  : 129;
      const npcDex = gd.unitDex[npcPid];
      const npcName = getLocalizedUnitName(npcPid, npcDex?.nameZh ?? '');
      const npcBannerHtml = npcDex
        ? `
          <div style="display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:6px; background:var(--surface-1); border:1px solid var(--border-subtle);">
            <img class="pixel-crisp" src="${this.assets.portraitToDataUrl(npcPid, 0)}" width="44" height="44" style="border-radius:4px; border:1px solid var(--border-brass);" alt="${npcName}" />
            <div style="font-size:11.5px; line-height:1.35;">
              <strong style="color:var(--gold-200);">${npcName} (DATO[${npcPid}])</strong>
              <div style="color:var(--ink-400);">${isCampOnlyChapter && activeTab === 'party' ? tr('野戰營地補給整備中', '野战营地补给整备中', 'Field Encampment Preparation') : getFacilityMeta(facilityIdx).shortLabel}</div>
            </div>
          </div>
        `
        : '';

      if (activeTab === 'party') {
        const permLabel = tr('永久', '永久', 'Permanent');
        const invHtml =
          member.items.length === 0
            ? `<div style="color:var(--ink-400); font-size:12.5px;">${tr('道具袋為空，可前往武器店或道具店添購裝備。', '道具袋为空，可前往武器店或道具店添购装备。', 'Inventory is empty. Visit the Armory or Item Shop to purchase gear.')}</div>`
            : member.items
                .map((iid, slotIdx) => {
                  const it = gd.items[iid];
                  if (!it) return '';
                  const sellVal = Math.max(1, Math.floor(it.price * 0.75));
                  const isCampStatPotion = [8, 9, 10, 17, 18, 19].includes(it.useEffect);
                  const statDesc =
                    it.category === 'weapon'
                      ? `AP +${it.ap} · HIT ${it.hit} · Rng ${it.minRange}-${it.maxRange}`
                      : it.category === 'armor'
                        ? `DP +${it.dp} · EV +${it.ev}`
                        : it.category === 'special'
                          ? tr('特殊轉職 / 劇情寶物', '特殊转职 / 剧情宝物', 'Promotion / Story Relic')
                          : it.useEffect === 5
                            ? `HP +${it.useVal} · Rng ${it.useRange ?? 1}${(it.useAoe ?? 0) > 0 ? ` · AoE ${it.useAoe}` : ''}`
                            : it.useEffect === 8
                              ? `AP +${it.useVal} (${permLabel})`
                              : it.useEffect === 9
                                ? `DP +${it.useVal} (${permLabel})`
                                : it.useEffect === 10
                                  ? `DX +${it.useVal} (${permLabel})`
                                  : it.useEffect === 17
                                    ? `MaxHP +${it.useVal} (${permLabel})`
                                    : it.useEffect === 18
                                      ? `MaxMP +${it.useVal} (${permLabel})`
                                      : it.useEffect === 19
                                        ? `MV +${it.useVal} (${permLabel})`
                                        : tr('消耗品', '消耗品', 'Consumable');
                  return `
                    <div class="item-chip">
                      <div>
                        ${this.renderGlyphWithSub(it.nameGlyphs, slotIdx === 0 && it.category === 'weapon' ? 'gold' : 'ivory', 16, it.nameZh, 'font-size:12px; color:var(--ink-200); margin-left:5px;')}
                        <span style="font-size:11px; color:var(--ink-400); margin-left:8px;">${statDesc}</span>
                      </div>
                      <div style="display:flex; gap:6px;">
                        ${
                          isCampStatPotion
                            ? `<button class="btn btn-gold btn-sm" data-camp-use="${slotIdx}" type="button">${tr('使用', '使用', 'Use')}</button>`
                            : ''
                        }
                        ${
                          slotIdx > 0 && (it.category === 'weapon' || it.category === 'armor')
                            ? `<button class="btn btn-sm" data-equip="${slotIdx}" type="button">${tr('主裝備', '主装备', 'Equip')}</button>`
                            : ''
                        }
                        <button class="btn btn-sm" data-sell="${slotIdx}" type="button">${tr('出售', '出售', 'Sell')} (+${sellVal}G)</button>
                      </div>
                    </div>
                  `;
                })
                .join('');

        const memberBaseHid = member.baseHeroId ?? gd.unitDex[member.uid]?.baseHeroId ?? member.uid;
        const memberBaseLv = gd.heroes[memberBaseHid]?.level ?? 1;
        const activeGrowth = gd.unitDex[member.uid]?.growth;
        const activeLearnable = (activeGrowth?.learnableSpells ?? []).filter(
          (ls) => member.uid >= 32 || ls.level > memberBaseLv
        );
        const knownSpellsHtml =
          member.spells.length > 0
            ? member.spells
                .map((sid) => {
                  const sp = gd.spells[sid];
                  if (!sp) return '';
                  const sName = getLocalizedSpellName(sid, sp.nameZh);
                  return `<span style="display:inline-flex; align-items:center; gap:3px; padding:2px 7px; border-radius:4px; background:rgba(212,175,55,0.12); border:1px solid var(--border-brass); font-size:11.5px; color:var(--gold-200);">${sName} <span style="color:var(--ink-400); font-size:10.5px;">(${sp.mpCost}MP)</span></span>`;
                })
                .join(' ')
            : `<span style="color:var(--ink-400); font-size:12px;">${tr('尚未習得法術或必殺技', '尚未习得法术或必杀技', 'No spells or techniques learned yet')}</span>`;
        const skillTreeHtml =
          activeLearnable.length > 0
            ? `<div style="margin-top:8px; font-size:11.5px; color:var(--ink-300);">${tr('本職業技能樹：', '本职业技能树：', 'Class Skill Tree: ')}${activeLearnable
                .map((ls) => {
                  const sp = gd.spells[ls.spellId];
                  const sName = getLocalizedSpellName(ls.spellId, sp?.nameZh ?? ls.spellNameZh);
                  const learned = member.spells.includes(ls.spellId) || ls.level <= member.level;
                  return `<span style="color:${learned ? 'var(--gold-300)' : 'var(--ink-300)'};">Lv${ls.level}:${sName}${learned ? '✓' : ''}</span>`;
                })
                .join(' · ')}</div>`
            : '';
        const magicPanelHtml =
          member.spells.length > 0 || activeLearnable.length > 0
            ? `
              <div class="panel-section">
                <div class="panel-heading"><span>${tr('習得法術與職業技能樹', '习得法术与职业技能树', 'Magic & Class Skill Tree')}</span></div>
                <div style="display:flex; flex-wrap:wrap; gap:6px;">${knownSpellsHtml}</div>
                ${skillTreeHtml}
              </div>
            `
            : '';

        this.bodyEl.innerHTML = `
          <div class="shop-layout">
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${renderBackToMapBtn()}
              <img class="camp-art pixel-crisp" src="${artSrc}" alt="Encampment" />
              ${npcBannerHtml}
              <div class="item-chip-list">${renderMemberSelector()}</div>
            </div>
            <div style="display:flex; flex-direction:column; gap:12px;">
              <div class="panel-section">
                <div class="unit-card-header">
                  <div class="portrait-frame">
                    <img class="pixel-crisp" src="${this.assets.portraitToDataUrl(member.portraitId, 0)}" width="80" height="80" alt="" />
                  </div>
                  <div class="unit-meta">
                    <div>
                      ${this.renderGlyphWithSub(member.nameGlyphs, 'gold', 20, member.nameZh ?? '', 'font-size:14px; color:var(--ink-200); margin-left:6px;')}
                    </div>
                    <div style="color:var(--ink-200); font-size:12.5px;">Lv ${member.level} · ${clsLabel} · MV ${member.mv}</div>
                    <div style="font-family:var(--font-mono); font-size:12px; color:var(--ink-400);">
                      HP ${member.maxHp} · MP ${member.maxMp} · Base AP ${member.baseAp} · Base DP ${member.baseDp} · DX ${member.baseDx}
                    </div>
                  </div>
                </div>
              </div>
              <div class="panel-section">
                <div class="panel-heading"><span>${tr('持有道具與裝備', '持有道具与装备', 'Hero Inventory')} (${member.items.length}/8)</span></div>
                <div class="item-chip-list">${invHtml}</div>
              </div>
              ${magicPanelHtml}
            </div>
          </div>
        `;

        bindBackToMapBtn();
        bindMemberSelector();
        this.bodyEl.querySelectorAll<HTMLButtonElement>('[data-camp-use]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const s = Number(btn.dataset.campUse);
            const iid = member.items[s];
            const it = gd.items[iid];
            if (!it) return;
            member.items.splice(s, 1);
            if (it.useEffect === 8) member.baseAp += it.useVal || 9;
            else if (it.useEffect === 9) member.baseDp += it.useVal || 9;
            else if (it.useEffect === 10) member.baseDx += it.useVal || 7;
            else if (it.useEffect === 17) member.maxHp += it.useVal || 20;
            else if (it.useEffect === 18) member.maxMp += it.useVal || 20;
            else if (it.useEffect === 19) member.mv = Math.min(12, member.mv + (it.useVal || 1));
            this.sound.playSfx('heal');
            renderAll();
          });
        });
        this.bodyEl.querySelectorAll<HTMLButtonElement>('[data-equip]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const s = Number(btn.dataset.equip);
            const [picked] = member.items.splice(s, 1);
            member.items.unshift(picked);
            this.sound.playSfx('confirm');
            renderBody();
          });
        });
        this.bodyEl.querySelectorAll<HTMLButtonElement>('[data-sell]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const s = Number(btn.dataset.sell);
            const iid = member.items[s];
            const it = gd.items[iid];
            member.items.splice(s, 1);
            setGold(getGold() + Math.max(1, Math.floor((it?.price ?? 20) * 0.75)));
            this.sound.playSfx('chest');
            renderAll();
          });
        });
        return;
      }

      if (activeTab === 'weapon' || activeTab === 'item' || activeTab === 'secret') {
        const rawStock =
          activeTab === 'secret'
            ? [...(shopDef.secretShop ?? [])]
            : activeTab === 'weapon'
              ? [...shopDef.weaponShop]
              : [...shopDef.itemShop, 192, 193, 196];
        const uniqueStock = Array.from(new Set(rawStock)).slice(0, 14);
        const incompatNote = tr(' (此職業不可裝備)', ' (此职业不可装备)', ' (Class cannot equip)');

        const stockHtml = uniqueStock
          .map((iid) => {
            const it = gd.items[iid];
            if (!it) return '';
            const compat =
              it.category === 'weapon' || it.category === 'armor'
                ? canUnitEquipItem(member, it, gd)
                : true;
            const canAfford = getGold() >= it.price && member.items.length < 8 && compat;
            const desc =
              it.category === 'weapon'
                ? `${tr('武器', '武器', 'Weapon')} · AP +${it.ap} · HIT ${it.hit} · Rng ${it.minRange}-${it.maxRange}${compat ? '' : incompatNote}`
                : it.category === 'armor'
                  ? `${tr('防具', '防具', 'Armor')} · DP +${it.dp} · EV +${it.ev}${compat ? '' : incompatNote}`
                  : tr('消耗品 / 寶物', '消耗品 / 宝物', 'Consumable / Relic');
            return `
              <div class="item-chip">
                <div>
                  ${this.renderGlyphWithSub(it.nameGlyphs, compat ? 'ivory' : 'crimson', 16, it.nameZh, 'font-size:12.5px; color:var(--ink-200); margin-left:6px;')}
                  <div style="font-size:11px; color:var(--ink-400);">${desc}</div>
                </div>
                <button class="btn btn-sm ${canAfford ? 'btn-gold' : ''}" data-buy="${iid}" ${canAfford ? '' : 'disabled'} type="button">
                  ${tr('購買', '购买', 'Buy')} (${it.price} G)
                </button>
              </div>
            `;
          })
          .join('');

        const shopHeading =
          activeTab === 'secret'
            ? tr('秘密商人珍品', '秘密商人珍品', 'Secret Merchant Wares')
            : activeTab === 'weapon'
              ? tr('武器店商品', '武器店商品', 'Chapter Armory')
              : tr('道具店商品', '道具店商品', 'Item Shop');

        this.bodyEl.innerHTML = `
          <div class="shop-layout">
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${renderBackToMapBtn()}
              <img class="camp-art pixel-crisp" src="${artSrc}" alt="Camp Shop" />
              ${npcBannerHtml}
              <div style="font-size:12px; color:var(--ink-200);">${tr('選擇購買角色：', '选择购买角色：', 'Select buyer:')}</div>
              <div class="item-chip-list">${renderMemberSelector()}</div>
            </div>
            <div class="panel-section">
              <div class="panel-heading">
                <span>${shopHeading}</span>
                <span>${tr('購買至', '购买至', 'Buying for')} ${this.assets.glyphsToHtml(member.nameGlyphs, 'gold', 15, member.nameZh ?? '')} (${member.items.length}/8)</span>
              </div>
              <div class="item-chip-list">${stockHtml}</div>
            </div>
          </div>
        `;

        bindBackToMapBtn();
        bindMemberSelector();
        this.bodyEl.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const iid = Number(btn.dataset.buy);
            const it = gd.items[iid];
            if (!it || getGold() < it.price || member.items.length >= 8) return;
            setGold(getGold() - it.price);
            member.items.push(iid);
            this.sound.playSfx('chest');
            renderAll();
          });
        });
        return;
      }

      // Sanctuary: Authentic FD2 Tier 2 / Secret-Item Tier 3 Promotion!
      const baseHid = member.baseHeroId ?? gd.unitDex[member.uid]?.baseHeroId ?? member.uid;
      const heroDef = gd.heroes[baseHid];
      const availablePromos: HeroPromotionTier[] = (heroDef?.promotions ?? []).filter(
        (p) => p.tier >= 2 && p.unitId !== member.uid && member.uid < 32
      );

      const promoOptionsHtml =
        availablePromos.length === 0
          ? `<div style="color:var(--ink-400); font-size:12.5px;">${tr(`此角色已完成高階轉職 (${clsLabel})。`, `此角色已完成高阶转职 (${clsLabel})。`, `This hero has already promoted to an advanced class (${clsLabel}).`)}</div>`
          : availablePromos
              .map((p, pidx) => {
                const hasItem = p.reqItemId === null || member.items.includes(p.reqItemId);
                const ready = member.level >= 20 && hasItem;
                const reqText =
                  p.reqItemId !== null
                    ? tr(
                        `需達 Lv 20 + 持有「${p.reqItemNameZh}」${hasItem ? ' (已持有 ✓)' : ' (未持有)'}`,
                        `需达 Lv 20 + 持有「${p.reqItemNameZh}」${hasItem ? ' (已持有 ✓)' : ' (未持有)'}`,
                        `Requires Lv 20 + ${p.reqItemNameZh} ${hasItem ? '(In Bag ✓)' : '(Missing)'}`
                      )
                    : tr('需達 Lv 20 (一般教會轉職)', '需达 Lv 20 (一般教会转职)', 'Requires Lv 20 (Standard Promotion)');
                const promoSpells = p.growth?.learnableSpells ?? [];
                const promoTreeText =
                  promoSpells.length > 0
                    ? `${tr('技能樹：', '技能树：', 'Skill Tree: ')}${promoSpells
                        .map((ls) => {
                          const sp = gd.spells[ls.spellId];
                          return `Lv${ls.level}:${getLocalizedSpellName(ls.spellId, sp?.nameZh ?? ls.spellNameZh)}`;
                        })
                        .join(' · ')}`
                    : tr('技能樹：(物理專精，無新增法術)', '技能树：(物理专精，无新增法术)', 'Skill Tree: (Physical specialist, no new spells)');
                const mvText = p.mvBonus ? ` · MV +${p.mvBonus}` : '';
                return `
                  <div class="item-chip" style="padding:10px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                      <img class="pixel-crisp" src="${this.assets.portraitToDataUrl(p.portraitId, 0)}" width="52" height="52" style="border-radius:4px; border:1px solid var(--border-brass);" alt="" />
                      <div>
                        <div>
                          ${this.renderGlyphWithSub(p.classGlyphs, 'gold', 16, p.classNameZh, 'font-weight:700; margin-left:6px;')}
                          <span style="font-size:11.5px; color:var(--gold-300); margin-left:4px;">(Tier ${p.tier}${mvText})</span>
                        </div>
                        <div style="font-size:11.5px; color:var(--ink-400);">${reqText}</div>
                        <div style="font-size:11px; color:var(--gold-200); margin-top:2px;">${promoTreeText}</div>
                      </div>
                    </div>
                    <button class="btn ${ready ? 'btn-gold' : ''}" data-promo-idx="${pidx}" ${ready ? '' : 'disabled'} type="button">
                      ${tr('轉職 →', '转职 →', 'Promote →')}
                    </button>
                  </div>
                `;
              })
              .join('');

      this.bodyEl.innerHTML = `
        <div class="shop-layout">
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${renderBackToMapBtn()}
            <img class="camp-art pixel-crisp" src="${artSrc}" alt="Sanctuary" />
            ${npcBannerHtml}
            <div class="item-chip-list">${renderMemberSelector()}</div>
          </div>
          <div class="panel-section" style="display:flex; flex-direction:column; gap:14px;">
            <div class="panel-heading"><span>${tr('聖堂教會 · 英雄轉職', '圣堂教会 · 英雄转职', 'Sanctuary · Class Promotion')}</span></div>
            <p style="color:var(--ink-200); font-size:13px;">
              ${tr(
                '等級達到 <strong>Lv 20</strong> 的夥伴可於教會進行轉職（若背包攜帶隱藏轉職道具則可轉職為隱藏三轉職業），解鎖全新肖像、地圖小人與戰鬥動畫！',
                '等级达到 <strong>Lv 20</strong> 的伙伴可于教会进行转职（若背包携带隐藏转职道具则可转职为隐藏三转职业），解锁全新肖像、地图小人与战斗动画！',
                'Heroes who reach <strong>Level 20</strong> may promote to Tier 2 (or secret Tier 3 if carrying a sacred promotion item), unlocking their promoted portrait, map sprite, and combat animation!'
              )}
            </p>
            <div class="item-chip-list">${promoOptionsHtml}</div>
          </div>
        </div>
      `;
      bindBackToMapBtn();
      bindMemberSelector();
      this.bodyEl.querySelectorAll<HTMLButtonElement>('[data-promo-idx]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const picked = availablePromos[Number(btn.dataset.promoIdx)];
          if (!picked) return;
          if (picked.reqItemId !== null) {
            const bagIdx = member.items.indexOf(picked.reqItemId);
            if (bagIdx >= 0) member.items.splice(bagIdx, 1);
          }
          const hc = gd.heroClasses.find((c) => c.id === picked.heroClassId);
          member.uid = picked.unitId;
          member.portraitId = picked.portraitId;
          member.spriteGroup = picked.spriteGroup;
          member.classId = picked.heroClassId;
          member.classNameZh = picked.classNameZh;
          member.moveMode = hc?.moveMode ?? member.moveMode;
          member.mv =
            picked.mvBonus !== undefined
              ? member.mv + picked.mvBonus
              : hc?.mv ?? Math.min(8, member.mv + 1);
          // Exact FD2.EXE fn_136706 (L136860..L136950): Church Promotion immediately rolls 1 level
          // of the new promoted class's stat growth (AP, DP, DX, HP, MP) before resetting Level=1, EXP=0!
          const pg = picked.growth ?? gd.unitDex[picked.unitId]?.growth;
          if (pg) {
            const roll = (pair: [number, number]) =>
              pair[0] + Math.floor(Math.random() * Math.max(1, pair[1] - pair[0] + 1));
            member.baseAp += roll(pg.ap);
            member.baseDp += roll(pg.dp);
            member.baseDx += roll(pg.dx);
            member.maxHp += roll(pg.hp);
            member.maxMp += roll(pg.mp);
          }
          member.level = 1;
          member.exp = 0;
          this.sound.playBgmBySourceIndex(15); // `Obj1 + 119522: fn_88439(15, 0)` (Church Hero Promotion Ceremony BGM)
          this.sound.playSfx('levelup');
          renderAll();
        });
      });
    };

    const renderAll = () => {
      const nextChTitleNow = getLocalizedChapterTitle(nextChapterId, '');
      this.titleEl.textContent = tr(
        `城鎮與營地整備 — 準備出擊第 ${nextChapterNumber} 章《${nextChTitleNow}》`,
        `城镇与营地整备 — 准备出击第 ${nextChapterNumber} 章《${nextChTitleNow}》`,
        `Town & Encampment — Preparing for Chapter ${nextChapterNumber}: "${nextChTitleNow}"`
      );
      renderTabs();
      renderBody();
    };

    syncTownTabBgm();
    this.activeRenderFn = renderAll;
    renderAll();
    this.backdropEl.classList.remove('hidden');
  }

  /**
   * Opens the Upgraded 2 Auto-Save + 12 Manual-Slot LocalStorage Save / Load & JSON Export/Import Manager.
   */
  openSaveLoadModal(
    mode: 'save' | 'load',
    buildCurrentSave: (() => SaveSlotData) | null,
    onLoadSave: (save: SaveSlotData) => void,
    onBackToCamp?: () => void
  ): void {
    this.runCleanup();
    this.sound.playSfx('confirm');
    this.closeBtn.style.display = 'inline-flex';
    if (onBackToCamp) {
      this.onCloseOverride = onBackToCamp;
    }
    let noteInputText = '';
    let statusBanner = '';

    const updateTitle = () => {
      this.titleEl.textContent =
        mode === 'save'
          ? tr('記錄進度 · 存檔管理 (瀏覽器本地儲存 & JSON 備份)', '记录进度 · 存档管理 (浏览器本地存储 & JSON 备份)', 'Save Progress (Browser LocalStorage & JSON Backup)')
          : tr('讀取進度 · 存檔管理 (瀏覽器本地儲存 & JSON 備份)', '读取进度 · 存档管理 (浏览器本地存储 & JSON 备份)', 'Load Progress (Browser LocalStorage & JSON Backup)');
    };

    const renderPortraitStrip = (party: PartyMemberSave[]): string => {
      const top = (party ?? []).slice(0, 6);
      if (top.length === 0) return '';
      return `
        <div style="display:flex; gap:3px; margin-top:5px; align-items:center;">
          ${top
            .map(
              (m) =>
                `<img class="pixel-crisp" src="${this.assets.portraitToDataUrl(m.portraitId ?? m.uid ?? 0, 0)}" width="28" height="28" title="Lv.${m.level}" style="border-radius:3px; border:1px solid var(--border-brass);" alt="" />`
            )
            .join('')}
          ${party.length > 6 ? `<span style="font-size:10.5px; color:var(--ink-400); margin-left:3px;">+${party.length - 6}</span>` : ''}
        </div>
      `;
    };

    const formatSlotCard = (
      slotTitle: string,
      parsed: SaveSlotData | null,
      actionsHtml: string,
      highlightBorder = ''
    ): string => {
      if (!parsed) {
        return `
          <div class="item-chip" style="padding:10px 12px; ${highlightBorder}">
            <div>
              <div style="font-family:var(--font-display); color:var(--ink-200); font-weight:600;">${slotTitle}</div>
              <div style="font-size:12px; color:var(--ink-400); margin-top:2px;">${tr('— 空白存檔槽位 —', '— 空白存档槽位 —', '— Empty Save Slot —')}</div>
            </div>
            <div style="display:flex; gap:6px; align-items:center;">${actionsHtml}</div>
          </div>
        `;
      }

      const chNum = (parsed.chapterId ?? 0) + 1;
      const chTitle = getLocalizedChapterTitle(parsed.chapterId ?? 0, '');
      const isBattle = Boolean(parsed.inBattle);
      const badgeHtml = isBattle
        ? `<span style="display:inline-block; padding:1px 6px; border-radius:4px; font-size:10.5px; font-weight:700; background:rgba(78,174,245,0.18); color:var(--player-blue); border:1px solid rgba(78,174,245,0.45); margin-left:6px;">${tr(`戰場 · 第 ${parsed.turn ?? 1} 回合`, `战场 · 第 ${parsed.turn ?? 1} 回合`, `Battle · Turn ${parsed.turn ?? 1}`)}</span>`
        : `<span style="display:inline-block; padding:1px 6px; border-radius:4px; font-size:10.5px; font-weight:700; background:rgba(240,200,105,0.18); color:var(--gold-200); border:1px solid rgba(240,200,105,0.45); margin-left:6px;">${tr('城鎮 / 營地整備', '城镇 / 营地整备', 'Town / Camp')}</span>`;
      const leader = parsed.party?.[0];
      const leaderLabel = leader
        ? `${getLocalizedUnitName(leader.uid, leader.nameZh ?? '')} Lv.${leader.level}`
        : '';

      return `
        <div class="item-chip" style="padding:10px 12px; align-items:center; ${highlightBorder}">
          <div style="flex:1; min-width:0;">
            <div style="display:flex; align-items:center; flex-wrap:wrap; gap:4px;">
              <span style="font-family:var(--font-display); color:var(--gold-300); font-weight:700;">${slotTitle}</span>
              ${badgeHtml}
              ${parsed.note ? `<span style="font-size:11px; color:var(--ally-green); margin-left:6px;">★ ${parsed.note}</span>` : ''}
            </div>
            <div style="font-size:12.5px; color:var(--ink-100); margin-top:3px;">
              <strong>${tr(`第 ${chNum} 章《${chTitle}》`, `第 ${chNum} 章《${chTitle}》`, `Ch.${chNum}: ${chTitle}`)}</strong>
              · ${leaderLabel}
              · ${parsed.party.length} ${tr('名夥伴', '名伙伴', 'Heroes')}
              · <span style="color:var(--gold-200); font-family:var(--font-mono);">${parsed.gold} G</span>
            </div>
            ${renderPortraitStrip(parsed.party)}
            <div style="font-size:10.5px; color:var(--ink-400); margin-top:3px; font-family:var(--font-mono);">${parsed.timestamp}</div>
          </div>
          <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
            ${actionsHtml}
          </div>
        </div>
      `;
    };

    const render = () => {
      updateTitle();
      this.tabsEl.innerHTML = `
        ${
          onBackToCamp
            ? `<button class="btn btn-gold" id="sl-back-camp-btn" type="button">← ${tr('返回城鎮營地', '返回城镇营地', 'Back to Town & Camp')}</button>`
            : ''
        }
        <button class="btn ${mode === 'save' ? 'btn-gold' : ''}" id="sl-mode-save" ${buildCurrentSave ? '' : 'disabled'} type="button">${tr('存檔模式', '存档模式', 'Save Mode')}</button>
        <button class="btn ${mode === 'load' ? 'btn-gold' : ''}" id="sl-mode-load" type="button">${tr('讀檔模式', '读档模式', 'Load Mode')}</button>
        ${
          mode === 'save' && buildCurrentSave
            ? `<input id="sl-note-input" type="text" maxlength="32" value="${noteInputText.replace(/"/g, '&quot;')}" placeholder="${tr('選填備註 (如：羅德曼路線)…', '选填备注 (如：罗德曼路线)…', 'Optional note (e.g. Rodman route)…')}" style="padding:4px 8px; border-radius:4px; border:1px solid var(--border-brass); background:var(--surface-1); color:var(--ink-100); font-size:12px; width:190px;" />`
            : ''
        }
        <div style="flex:1"></div>
        ${buildCurrentSave ? `<button class="btn btn-sm" id="sl-export-json" type="button">${tr('匯出當前進度 (.json)', '导出当前进度 (.json)', 'Export Current (.json)')}</button>` : ''}
        <button class="btn btn-sm" id="sl-export-all-json" type="button">${tr('匯出全部存檔備份', '导出全部存档备份', 'Export All Saves')}</button>
        <label class="btn btn-sm btn-gold" style="cursor:pointer;">
          ${tr('匯入存檔 / 備份 (.json)', '导入存档 / 备份 (.json)', 'Import Save / Backup (.json)')}
          <input type="file" id="sl-import-json" accept="application/json,.json" style="display:none;" />
        </label>
      `;

      this.tabsEl.querySelector('#sl-back-camp-btn')?.addEventListener('click', () => {
        this.sound.playSfx('cancel');
        this.onCloseOverride = null;
        onBackToCamp?.();
      });

      this.tabsEl.querySelector<HTMLInputElement>('#sl-note-input')?.addEventListener('input', (ev) => {
        noteInputText = (ev.target as HTMLInputElement).value;
      });
      this.tabsEl.querySelector('#sl-mode-save')?.addEventListener('click', () => {
        if (!buildCurrentSave) return;
        mode = 'save';
        render();
      });
      this.tabsEl.querySelector('#sl-mode-load')?.addEventListener('click', () => {
        mode = 'load';
        render();
      });
      this.tabsEl.querySelector('#sl-export-json')?.addEventListener('click', () => {
        if (!buildCurrentSave) return;
        const cur = buildCurrentSave();
        if (noteInputText.trim()) cur.note = noteInputText.trim();
        const tag = cur.inBattle ? `turn${cur.turn ?? 1}` : 'camp';
        downloadJsonBlob(`fd2-save-ch${cur.chapterId + 1}-${tag}.json`, cur);
      });
      this.tabsEl.querySelector('#sl-export-all-json')?.addEventListener('click', () => {
        const manualSlots: Record<number, SaveSlotData> = {};
        for (let i = 0; i < MANUAL_SLOT_COUNT; i++) {
          const raw = localStorage.getItem(`${SAVE_PREFIX}${i}`);
          if (raw) {
            try {
              manualSlots[i] = JSON.parse(raw) as SaveSlotData;
            } catch {
              // ignore
            }
          }
        }
        const backup: FullBackupPayload = {
          fd2FullBackupVersion: 1,
          exportedAt: new Date().toLocaleString(),
          clearedChapters: getClearedChapters(),
          autoSaveCamp: loadAutoSaveSlot('camp'),
          autoSaveTurn: loadAutoSaveSlot('turn'),
          manualSlots,
        };
        downloadJsonBlob(`fd2-all-saves-backup.json`, backup);
      });

      this.tabsEl.querySelector<HTMLInputElement>('#sl-import-json')?.addEventListener('change', (ev) => {
        const file = (ev.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const rawObj = JSON.parse(String(reader.result));
            // Case 1: Full All-Slots Backup JSON
            if (rawObj && rawObj.fd2FullBackupVersion === 1) {
              const fb = rawObj as FullBackupPayload;
              if (Array.isArray(fb.clearedChapters)) {
                fb.clearedChapters.forEach((c) => markChapterCleared(c));
              }
              if (fb.autoSaveCamp) saveAutoSaveSlot('camp', fb.autoSaveCamp);
              if (fb.autoSaveTurn) saveAutoSaveSlot('turn', fb.autoSaveTurn);
              let importedCount = 0;
              if (fb.manualSlots && typeof fb.manualSlots === 'object') {
                for (const [k, v] of Object.entries(fb.manualSlots)) {
                  const idx = Number(k);
                  if (idx >= 0 && idx < MANUAL_SLOT_COUNT && v && Array.isArray(v.party)) {
                    localStorage.setItem(`${SAVE_PREFIX}${idx}`, JSON.stringify(v));
                    importedCount++;
                  }
                }
              }
              this.sound.playSfx('chest');
              statusBanner = tr(
                `✓ 已成功匯入完整備份（共 ${importedCount} 個手動槽位與自動存檔）！`,
                `✓ 已成功导入完整备份（共 ${importedCount} 个手动槽位与自动存档）！`,
                `✓ Imported full backup (${importedCount} manual slots + auto-saves)!`
              );
              mode = 'load';
              render();
              return;
            }

            // Case 2: Single-Slot Save JSON — store in first empty slot (or Slot 12) AND load immediately!
            const parsed = rawObj as SaveSlotData;
            if (parsed && Array.isArray(parsed.party)) {
              let targetSlot = 0;
              for (let i = 0; i < MANUAL_SLOT_COUNT; i++) {
                if (!localStorage.getItem(`${SAVE_PREFIX}${i}`)) {
                  targetSlot = i;
                  break;
                }
                if (i === MANUAL_SLOT_COUNT - 1) targetSlot = MANUAL_SLOT_COUNT - 1;
              }
              if (!parsed.note) parsed.note = file.name.replace(/\.json$/i, '');
              localStorage.setItem(`${SAVE_PREFIX}${targetSlot}`, JSON.stringify(parsed));
              this.sound.playSfx('confirm');
              this.hide();
              onLoadSave(parsed);
            }
          } catch {
            // Ignore invalid JSON
          }
        };
        reader.readAsText(file);
      });

      // 1. Auto-Save Slots (Camp/Chapter Start & Turn Start)
      const autoCamp = loadAutoSaveSlot('camp');
      const autoTurn = loadAutoSaveSlot('turn');
      const autoCampHtml = formatSlotCard(
        tr('自動存檔 A · 營地 / 章節起點', '自动存档 A · 营地 / 章节起点', 'Auto-Save A · Camp / Chapter Start'),
        autoCamp,
        `
          ${autoCamp ? `<button class="btn btn-sm" data-export-auto="camp" type="button">${tr('匯出 .json', '导出 .json', 'Export')}</button>` : ''}
          <button class="btn btn-gold" data-load-auto="camp" ${autoCamp ? '' : 'disabled'} type="button">${tr('讀取', '读取', 'Load')}</button>
        `,
        'border-color: rgba(240, 200, 105, 0.45); background: rgba(240, 200, 105, 0.05);'
      );
      const autoTurnHtml = formatSlotCard(
        tr('自動存檔 B · 戰場回合開始', '自动存档 B · 战场回合开始', 'Auto-Save B · Battlefield Turn Start'),
        autoTurn,
        `
          ${autoTurn ? `<button class="btn btn-sm" data-export-auto="turn" type="button">${tr('匯出 .json', '导出 .json', 'Export')}</button>` : ''}
          <button class="btn btn-gold" data-load-auto="turn" ${autoTurn ? '' : 'disabled'} type="button">${tr('讀取', '读取', 'Load')}</button>
        `,
        'border-color: rgba(78, 174, 245, 0.45); background: rgba(78, 174, 245, 0.05);'
      );

      // 2. 12 Unified Manual Slots (Camp OR Mid-Battlefield in any slot)
      const slotsHtml = Array.from({ length: MANUAL_SLOT_COUNT }, (_, idx) => {
        const raw = localStorage.getItem(`${SAVE_PREFIX}${idx}`);
        let parsed: SaveSlotData | null = null;
        if (raw) {
          try {
            parsed = JSON.parse(raw) as SaveSlotData;
          } catch {
            parsed = null;
          }
        }
        const actions = `
          ${
            parsed
              ? `
                <button class="btn btn-sm" data-export-slot="${idx}" type="button" title="Export JSON">${tr('匯出 .json', '导出 .json', 'Export')}</button>
                <button class="btn btn-sm" data-delete-slot="${idx}" type="button" title="Delete Slot" style="color:var(--enemy-red);">${tr('刪除', '删除', 'Del')}</button>
              `
              : ''
          }
          <button class="btn ${mode === 'save' ? 'btn-gold' : parsed ? 'btn-gold' : ''}" data-slot="${idx}" ${mode === 'load' && !parsed ? 'disabled' : ''} type="button">
            ${mode === 'save' ? tr('存入此槽', '存入此槽', 'Save Here') : tr('讀取', '读取', 'Load')}
          </button>
        `;
        return formatSlotCard(
          tr(`存檔槽位 #${idx + 1}`, `存档槽位 #${idx + 1}`, `Slot #${idx + 1}`),
          parsed,
          actions
        );
      }).join('');

      this.bodyEl.innerHTML = `
        ${statusBanner ? `<div style="padding:8px 12px; margin-bottom:10px; border-radius:6px; background:rgba(104,223,160,0.14); border:1px solid var(--ally-green); color:var(--ally-green); font-size:12.5px;">${statusBanner}</div>` : ''}
        <div class="panel-heading" style="margin-bottom:6px;"><span>${tr('系統自動存檔 (每章開戰 / 營地整備 / 每回合開始自動記錄)', '系统自动存档 (每章开战 / 营地整备 / 每回合开始自动记录)', 'AUTOMATIC CHECKPOINTS (Saved automatically at Camp & Turn Start)')}</span></div>
        <div class="item-chip-list" style="margin-bottom:14px;">
          ${autoCampHtml}
          ${autoTurnHtml}
        </div>
        <div class="panel-heading" style="margin-bottom:6px;"><span>${tr('手動存檔槽位 (1–12 槽皆可記錄「營地整備」或「戰場中途」進度)', '手动存档槽位 (1–12 槽皆可记录「营地整备」或「战场中途」进度)', 'MANUAL SAVE SLOTS (Slots 1–12 support both Camp & Mid-Battle saves)')}</span></div>
        <div class="item-chip-list">${slotsHtml}</div>
      `;

      this.bodyEl.querySelectorAll<HTMLButtonElement>('[data-load-auto]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const kind = btn.dataset.loadAuto as 'camp' | 'turn';
          const data = loadAutoSaveSlot(kind);
          if (data) {
            this.sound.playSfx('confirm');
            this.hide();
            onLoadSave(data);
          }
        });
      });

      this.bodyEl.querySelectorAll<HTMLButtonElement>('[data-export-auto]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const kind = btn.dataset.exportAuto as 'camp' | 'turn';
          const data = loadAutoSaveSlot(kind);
          if (data) {
            downloadJsonBlob(`fd2-autosave-${kind}-ch${data.chapterId + 1}.json`, data);
          }
        });
      });

      this.bodyEl.querySelectorAll<HTMLButtonElement>('[data-export-slot]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const s = Number(btn.dataset.exportSlot);
          const raw = localStorage.getItem(`${SAVE_PREFIX}${s}`);
          if (!raw) return;
          try {
            const data = JSON.parse(raw) as SaveSlotData;
            const tag = data.inBattle ? `turn${data.turn ?? 1}` : 'camp';
            downloadJsonBlob(`fd2-slot${s + 1}-ch${data.chapterId + 1}-${tag}.json`, data);
          } catch {
            // ignore
          }
        });
      });

      this.bodyEl.querySelectorAll<HTMLButtonElement>('[data-delete-slot]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const s = Number(btn.dataset.deleteSlot);
          localStorage.removeItem(`${SAVE_PREFIX}${s}`);
          this.sound.playSfx('cancel');
          render();
        });
      });

      this.bodyEl.querySelectorAll<HTMLButtonElement>('[data-slot]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const s = Number(btn.dataset.slot);
          if (mode === 'save' && buildCurrentSave) {
            const data = buildCurrentSave();
            if (noteInputText.trim()) {
              data.note = noteInputText.trim();
            }
            localStorage.setItem(`${SAVE_PREFIX}${s}`, JSON.stringify(data));
            this.sound.playSfx('chest');
            statusBanner = tr(
              `✓ 已儲存至 存檔槽位 #${s + 1}！`,
              `✓ 已保存至 存档槽位 #${s + 1}！`,
              `✓ Saved to Slot #${s + 1}!`
            );
            render();
          } else if (mode === 'load') {
            const raw = localStorage.getItem(`${SAVE_PREFIX}${s}`);
            if (raw) {
              const data = JSON.parse(raw) as SaveSlotData;
              this.sound.playSfx('confirm');
              this.hide();
              onLoadSave(data);
            }
          }
        });
      });
    };

    this.activeRenderFn = render;
    render();
    this.backdropEl.classList.remove('hidden');
  }

  /** Opens the Flame Dragon II Asset Codex (0-Indexed Verified Portraits, Weapons/Items, Spells, Jukebox). */
  openCodex(): void {
    this.sound.playSfx('confirm');
    this.closeBtn.style.display = 'inline-flex';
    let tab: 'portraits' | 'items' | 'spells' | 'music' = 'portraits';

    const render = () => {
      this.titleEl.textContent = tr(
        '炎龍寶庫 · 角色、神兵、法術與原聲圖鑑',
        '炎龙宝库 · 角色、神兵、法术与原声图鉴',
        'Flame Dragon II Archives Codex (Portraits, Items, Spells & Jukebox)'
      );
      this.tabsEl.innerHTML = `
        <button class="btn ${tab === 'portraits' ? 'btn-gold' : ''}" id="codex-tab-portraits" type="button">${tr('登場人物', '登场人物', 'Units')} (${this.assets.gameData.unitDex.length})</button>
        <button class="btn ${tab === 'items' ? 'btn-gold' : ''}" id="codex-tab-items" type="button">${tr('武器與道具', '武器与道具', 'Items')} (${this.assets.gameData.items.length})</button>
        <button class="btn ${tab === 'spells' ? 'btn-gold' : ''}" id="codex-tab-spells" type="button">${tr('法術與特技', '法术与特技', 'Spells')} (${this.assets.gameData.spells.length})</button>
        <button class="btn ${tab === 'music' ? 'btn-gold' : ''}" id="codex-tab-music" type="button">${tr('原聲音樂', '原声音乐', 'Soundtrack')} (${this.assets.musicTracks.length})</button>
        <div style="flex:1"></div>
        <a class="btn btn-sm btn-gold" href="./gallery.html" style="text-decoration:none;">${tr('角色與圖像驗證專頁 · Full Gallery →', '角色与图像验证专页 · Full Gallery →', 'Full Verification Gallery →')}</a>
      `;

      this.tabsEl.querySelector('#codex-tab-portraits')?.addEventListener('click', () => {
        tab = 'portraits';
        render();
      });
      this.tabsEl.querySelector('#codex-tab-items')?.addEventListener('click', () => {
        tab = 'items';
        render();
      });
      this.tabsEl.querySelector('#codex-tab-spells')?.addEventListener('click', () => {
        tab = 'spells';
        render();
      });
      this.tabsEl.querySelector('#codex-tab-music')?.addEventListener('click', () => {
        tab = 'music';
        render();
      });

      if (tab === 'portraits') {
        const cards = this.assets.gameData.unitDex
          .map(
            (u) => `
              <div class="panel-section" style="display:flex; align-items:center; gap:10px; padding:8px;">
                <img class="pixel-crisp" src="${this.assets.portraitToDataUrl(u.portraitId, 0)}" width="60" height="60" style="border-radius:4px; border:1px solid var(--border-brass);" alt="${u.nameZh}" />
                <img class="pixel-crisp" src="${this.assets.spriteToDataUrl(u.effectiveSpriteGroup, 0, 0, 32)}" width="32" height="32" alt="" />
                <div>
                  <div style="font-family:var(--font-mono); font-size:10.5px; color:var(--ink-400);">SLOT #${u.id} (${u.hexId})</div>
                  <div>
                    ${this.renderGlyphWithSub(u.nameGlyphs, 'gold', 15, u.nameZh, 'font-weight:700; font-size:12.5px; margin-left:4px;')}
                  </div>
                  <div style="font-size:11px; color:var(--ink-400);">${u.classNameZh}</div>
                </div>
              </div>
            `
          )
          .join('');
        this.bodyEl.innerHTML = `<div class="chapter-grid">${cards}</div>`;
      } else if (tab === 'items') {
        const rows = this.assets.gameData.items
          .filter((it) => it.nameGlyphs.length > 0)
          .map(
            (it) => `
              <div class="item-chip">
                <div>
                  <span style="font-family:var(--font-mono); color:var(--ink-400); font-size:11px; margin-right:6px;">#${it.id}</span>
                  ${this.renderGlyphWithSub(it.nameGlyphs, 'ivory', 16, it.nameZh, 'font-weight:700; margin-left:6px; font-size:12.5px;')}
                </div>
                <span style="font-family:var(--font-mono); font-size:11.5px; color:var(--ink-200);">
                  ${it.category.toUpperCase()} · AP ${it.ap} · DP ${it.dp} · HIT ${it.hit} · ${it.price}G
                </span>
              </div>
            `
          )
          .join('');
        this.bodyEl.innerHTML = `<div class="item-chip-list">${rows}</div>`;
      } else if (tab === 'spells') {
        const rows = this.assets.gameData.spells
          .filter((sp) => sp.nameGlyphs.length > 0)
          .map(
            (sp) => `
              <div class="item-chip">
                <div>
                  <span style="font-family:var(--font-mono); color:var(--ink-400); font-size:11px; margin-right:6px;">#${sp.id}</span>
                  ${this.renderGlyphWithSub(sp.nameGlyphs, 'azure', 16, sp.nameZh, 'font-weight:700; margin-left:6px; font-size:12.5px;')}
                </div>
                <span style="font-family:var(--font-mono); font-size:11.5px; color:var(--ink-200);">
                  Pwr ${sp.power} · MP ${sp.mpCost} · Rng ${sp.castRange} · AoE ${sp.aoe} · ${sp.targetType}
                </span>
              </div>
            `
          )
          .join('');
        this.bodyEl.innerHTML = `<div class="item-chip-list">${rows}</div>`;
      } else {
        const rows = this.assets.musicTracks
          .map(
            (track, idx) => `
              <div class="item-chip">
                <div>
                  <div style="color:var(--gold-200); font-weight:600;">${track.name}</div>
                  <div style="font-size:11px; color:var(--ink-400);">${track.noteCount} XMI MIDI Events · ${track.duration}s loop</div>
                </div>
                <button class="btn btn-sm btn-gold" data-playtrack="${idx}" type="button">${tr('播放 BGM', '播放 BGM', 'Play BGM')}</button>
              </div>
            `
          )
          .join('');
        this.bodyEl.innerHTML = `<div class="item-chip-list">${rows}</div>`;
        this.bodyEl.querySelectorAll<HTMLButtonElement>('[data-playtrack]').forEach((b) => {
          b.addEventListener('click', () => {
            this.sound.playTrack(Number(b.dataset.playtrack));
          });
        });
      }
    };

    this.activeRenderFn = render;
    render();
    this.backdropEl.classList.remove('hidden');
  }

  static hasAnySave(): boolean {
    if (localStorage.getItem(AUTOSAVE_CAMP_KEY) || localStorage.getItem(AUTOSAVE_TURN_KEY)) {
      return true;
    }
    for (let i = 0; i < MANUAL_SLOT_COUNT; i++) {
      if (localStorage.getItem(`${SAVE_PREFIX}${i}`)) return true;
    }
    return false;
  }
}
