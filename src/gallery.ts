import './gallery.css';
import { AssetManager } from './engine/assets';
import type {
  ChapterData,
  CharacterDexData,
  GrowthDef,
  HeroDef,
  UnitDexEntry,
} from './types';
import {
  buildMagicSequenceTimeline,
  buildPhysicalStrikeTimeline,
  getUnitMoveCapabilities,
  renderTimelineStep,
  type BattleMoveKind,
  type CombatantSpec,
  type TimelineStep,
} from './ui/battleStage';

type GalleryTab = 'duel' | 'catalog' | 'chapters';
type EnemyListFilter = 'enemy_boss' | 'all_battlefield';
type HeroListFilter = 'heroes_32' | 'battlefield_allies_npcs' | 'non_battlefield_npcs';
type CatalogSubTab = 'items' | 'spells' | 'classes';

class MappingGalleryApp {
  private assets = new AssetManager();
  private dex!: CharacterDexData;

  // Top-level Navigation (Combined Battle Duel + Catalog + Chapters)
  private activeTab: GalleryTab = 'duel';

  // Left Column: Enemy / Boss Selector (stands on Left BG strip)
  private enemyFilter: EnemyListFilter = 'enemy_boss';
  private enemySearch = '';
  private selectedEnemyUid = 85; // Default: 黑暗騎士 (#85)
  private enemyRosterScrollTop = 0;

  // Right Column: Hero / Promotion / Ally Selector (stands on Right TAI platform)
  private heroFilter: HeroListFilter = 'heroes_32';
  private heroSearch = '';
  private selectedHeroId = 0; // Default: 索爾 (#0)
  private selectedRightUid = 0; // Active promoted or right-side unit ID
  private heroRosterScrollTop = 0;

  // Duel Stage Controls
  private initiator: 'hero' | 'enemy' = 'hero';
  private selectedMove: BattleMoveKind = 'melee';
  private selectedSpellId: number | null = null;
  private previewBgId = 4;
  private previewSpriteDir: 0 | 1 | 2 | 3 = 0;

  // Timeline Playback State (plays once and holds on final post-attack frame by default; optional loop toggle)
  private duelTimeline: TimelineStep[] = [];
  private duelPlaying = true;
  private duelLoop = false;
  private manualStepIdx = 0;
  private pausedElapsedMs = 0;
  private animStartMs = performance.now();
  private lastRafMs = performance.now();
  private syncSeq = 0;

  // Catalog & Chapter Validation Tabs
  private catalogSubTab: CatalogSubTab = 'items';
  private itemCategoryFilter: 'all' | 'weapon' | 'armor' | 'consumable' | 'special' = 'all';
  private catalogSearch = '';
  private selectedChapterId = 0;
  private loadedChapter: ChapterData | null = null;

  private rootEl!: HTMLElement;

  async mount(root: HTMLElement): Promise<void> {
    this.rootEl = root;
    root.innerHTML = `
      <div style="min-height:100vh; display:grid; place-items:center; padding:32px; text-align:center;">
        <div>
          <div class="gal-title" style="font-size:22px; margin-bottom:8px;">載入炎龍騎士團II 原始檔案與戰鬥動畫圖鑑...</div>
          <div id="gal-loading-msg" style="color:var(--ink-400); font-family:var(--font-mono); font-size:12.5px;">Initializing atlases...</div>
        </div>
      </div>
    `;

    const msgEl = document.getElementById('gal-loading-msg');
    const [, dexRes] = await Promise.all([
      this.assets.init((msg) => {
        if (msgEl) msgEl.textContent = msg;
      }),
      fetch('assets/character_dex.json').then((r) => r.json() as Promise<CharacterDexData>),
    ]);
    this.dex = dexRes;

    // Support URL deep-links (`?hero=9&tier=41&enemy=90&init=hero&move=magic&spell=2`)
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'catalog' || tabParam === 'chapters') {
      this.activeTab = tabParam;
    } else {
      this.activeTab = 'duel';
    }

    const heroParam = params.get('hero');
    if (heroParam !== null && Number.isFinite(Number(heroParam))) {
      this.selectedHeroId = Math.max(0, Math.min(31, Number(heroParam)));
      this.selectedRightUid = this.selectedHeroId;
    }
    const tierParam = params.get('tier');
    if (tierParam !== null && Number.isFinite(Number(tierParam))) {
      this.selectedRightUid = Math.max(0, Math.min(135, Number(tierParam)));
      const rightUnit = this.dex.unitDex[this.selectedRightUid];
      const owner = rightUnit?.baseHeroId;
      if (owner !== null && owner !== undefined) {
        this.selectedHeroId = owner;
        this.heroFilter = 'heroes_32';
      } else if (this.selectedRightUid < 32) {
        this.selectedHeroId = this.selectedRightUid;
        this.heroFilter = 'heroes_32';
      } else if (rightUnit && !rightUnit.appearsOnBattlefield) {
        this.heroFilter = 'non_battlefield_npcs';
      } else if (rightUnit && (rightUnit.role === 'ally_npc' || rightUnit.role === 'villager')) {
        this.heroFilter = 'battlefield_allies_npcs';
      }
    }
    const enemyParam = params.get('enemy');
    if (enemyParam !== null && Number.isFinite(Number(enemyParam))) {
      const requestedEnemy = Math.max(0, Math.min(135, Number(enemyParam)));
      const eu = this.dex.unitDex[requestedEnemy];
      if (eu && eu.appearsOnBattlefield) {
        this.selectedEnemyUid = requestedEnemy;
        if (eu.role !== 'enemy' && eu.role !== 'boss') {
          this.enemyFilter = 'all_battlefield';
        }
      }
    }
    const initParam = params.get('init');
    if (initParam === 'enemy' || initParam === 'hero') {
      this.initiator = initParam;
    }
    const moveParam = params.get('move');
    if (moveParam === 'melee' || moveParam === 'ranged' || moveParam === 'special' || moveParam === 'magic') {
      this.selectedMove = moveParam;
    }
    const spellParam = params.get('spell');
    if (spellParam !== null && Number.isFinite(Number(spellParam))) {
      this.selectedSpellId = Number(spellParam);
    }
    const stepParam = params.get('step');
    const initialStep = stepParam !== null && Number.isFinite(Number(stepParam)) ? Number(stepParam) : null;
    const chParam = params.get('ch');
    if (chParam !== null && Number.isFinite(Number(chParam))) {
      this.selectedChapterId = Math.max(0, Math.min(32, Number(chParam)));
    }

    this.ensureValidMoveAndSpellSelection();
    await this.rebuildDuelTimeline();
    if (initialStep !== null && this.duelTimeline.length > 0) {
      this.duelPlaying = false;
      this.manualStepIdx = Math.max(0, Math.min(this.duelTimeline.length - 1, initialStep));
      this.pausedElapsedMs = this.getTicksBeforeStep(this.manualStepIdx) * 55;
    }
    if (this.activeTab === 'chapters') {
      const { data } = await this.assets.loadChapter(this.selectedChapterId);
      this.loadedChapter = data;
    }

    this.renderShell();
    requestAnimationFrame((t) => this.animLoop(t));
  }

  private runAuditSummary() {
    const units = this.dex.unitDex;
    const portraitsOk = units.filter((u) => u.hasPortrait).length;
    const spritesOk = units.filter((u) => u.rawSpriteFrames > 0).length;
    const figOk = units.filter((u) => u.figani && (u.figani.idle || u.figani.attack || u.figani.ranged)).length;
    const spellAnimsCount = Object.keys(this.dex.spellStrips ?? {}).length;
    const solDialogues = units[0]?.dialogueSegments ?? 0;

    return {
      portraitsOk,
      spritesOk,
      figOk,
      spellAnimsCount,
      totalItems: this.dex.items.length,
      totalSpells: this.dex.spells.length,
      solDialogues,
    };
  }

  private getActiveAttackerUid(): number {
    return this.initiator === 'hero' ? this.selectedRightUid : this.selectedEnemyUid;
  }

  private ensureValidMoveAndSpellSelection(): void {
    const leftEntry = this.dex.unitDex[this.selectedEnemyUid];
    const rightEntry = this.dex.unitDex[this.selectedRightUid];

    // Protected defenseless battlefield NPCs (#133 女村民, #134 男村民, #135 卡納恩三世) or non-battlefield NPCs
    // NEVER initiate attacks or counterattacks in FD2.EXE (`canAttack === false`). Lock initiator to the combatant side!
    if (rightEntry && (!rightEntry.appearsOnBattlefield || !rightEntry.canAttack)) {
      if (leftEntry?.appearsOnBattlefield && leftEntry?.canAttack) {
        this.initiator = 'enemy';
      }
    } else if (leftEntry && (!leftEntry.appearsOnBattlefield || !leftEntry.canAttack)) {
      if (rightEntry?.appearsOnBattlefield && rightEntry?.canAttack) {
        this.initiator = 'hero';
      }
    }

    const atkUid = this.getActiveAttackerUid();
    const isHeroInit = this.initiator === 'hero';
    const caps = getUnitMoveCapabilities(atkUid, this.assets.gameData, isHeroInit);

    // Enemy initiator does not have Special Attack
    if (!isHeroInit && this.selectedMove === 'special') {
      this.selectedMove = 'melee';
    }

    const moveOk =
      (this.selectedMove === 'melee' && caps.hasMelee) ||
      (this.selectedMove === 'ranged' && caps.hasRanged) ||
      (this.selectedMove === 'special' && isHeroInit && caps.hasSpecial) ||
      (this.selectedMove === 'magic' && caps.hasMagic);

    if (!moveOk) {
      if (caps.hasMelee) this.selectedMove = 'melee';
      else if (caps.hasRanged) this.selectedMove = 'ranged';
      else if (isHeroInit && caps.hasSpecial) this.selectedMove = 'special';
      else if (caps.hasMagic) this.selectedMove = 'magic';
      else this.selectedMove = 'melee';
    }

    if (caps.spells.length > 0) {
      if (this.selectedSpellId === null || !caps.spells.some((s) => s.id === this.selectedSpellId)) {
        this.selectedSpellId = caps.spells[0].id;
      }
    } else {
      this.selectedSpellId = null;
    }
  }

  private buildCombatantSpec(uid: number, isHeroSide: boolean): CombatantSpec {
    const entry = this.dex.unitDex[uid] ?? this.dex.unitDex[0];
    const baseHid = entry.baseHeroId ?? (uid < 32 ? uid : null);
    let level = 12;
    let maxHp = 180;
    let maxMp = 0;

    if (baseHid !== null && this.dex.heroes[baseHid]) {
      const h = this.dex.heroes[baseHid];
      level = uid >= 50 ? Math.max(25, h.level) : uid >= 32 ? Math.max(20, h.level) : h.level;
      const diff = Math.max(0, level - h.level);
      const gr = entry.growth ?? h.growth;
      const avgHp = gr ? (gr.hp[0] + gr.hp[1]) * 0.5 : 7;
      const avgMp = gr ? (gr.mp[0] + gr.mp[1]) * 0.5 : 0;
      maxHp = Math.max(40, Math.round(h.maxHp + diff * avgHp));
      maxMp = Math.max(0, Math.round(h.maxMp + diff * avgMp));
    } else if (entry.enemyStats) {
      const ec = entry.enemyStats;
      level = entry.role === 'boss' ? 26 : 15;
      maxHp = Math.max(50, Math.round((24 + level * ec.hpGrowth * 0.62) * (entry.role === 'boss' ? 1.35 : 1)));
      if (ec.mpGrowth > 0 || (entry.knownSpells && entry.knownSpells.length > 0)) {
        maxMp = Math.max(18, Math.round(level * Math.max(2, ec.mpGrowth) * 0.55));
      }
    }

    return {
      uid: entry.id,
      nameZh: entry.nameZh,
      nameGlyphs: entry.nameGlyphs,
      portraitId: entry.portraitId,
      spriteGroup: entry.effectiveSpriteGroup,
      isHeroSide,
      level,
      maxHp,
      startHp: maxHp,
      maxMp,
      startMp: maxMp,
      taiId: this.previewBgId,
    };
  }

  private async rebuildDuelTimeline(): Promise<void> {
    const reqId = ++this.syncSeq;
    this.ensureValidMoveAndSpellSelection();

    const leftEntry = this.dex.unitDex[this.selectedEnemyUid];
    const rightEntry = this.dex.unitDex[this.selectedRightUid];
    // Non-battlefield NPCs (#39, #48, #57, #66, #67, #74, #75, #128..#132) NEVER appear on the 320x200 combat stage!
    if ((leftEntry && !leftEntry.appearsOnBattlefield) || (rightEntry && !rightEntry.appearsOnBattlefield)) {
      this.duelTimeline = [];
      this.manualStepIdx = 0;
      this.pausedElapsedMs = 0;
      return;
    }

    const leftSpec = this.buildCombatantSpec(this.selectedEnemyUid, false);
    const rightSpec = this.buildCombatantSpec(this.selectedRightUid, true);

    const isHeroInit = this.initiator === 'hero';
    const attacker = isHeroInit ? rightSpec : leftSpec;
    const defender = isHeroInit ? leftSpec : rightSpec;
    const caps = getUnitMoveCapabilities(attacker.uid, this.assets.gameData, isHeroInit);

    // Total damage is fixed at half (50%) of the target's Max HP, synced across exact hit frames!
    const halfTargetHp = Math.max(1, Math.floor(defender.maxHp * 0.5));

    if (this.selectedMove === 'magic' && caps.hasMagic && this.selectedSpellId !== null) {
      const spell = this.assets.gameData.spells[this.selectedSpellId] ?? caps.spells[0];
      const castSlot = caps.magicCastSlot ?? 'attack';

      // All spells in `caps.spells` are genuine cutaway attacking magic (`#0..#9` + `#32 熾天使`) targeting `defender`!
      const [casterIdle, casterCast, targetIdle, spellPack] = await Promise.all([
        this.assets.loadUnitFigAni(attacker.uid, 'idle'),
        this.assets.loadUnitFigAni(attacker.uid, castSlot),
        this.assets.loadUnitFigAni(defender.uid, 'idle'),
        this.assets.loadSpellAnim(spell.id, defender.isHeroSide),
      ]);
      if (reqId !== this.syncSeq) return;

      const stripId = defender.isHeroSide ? (spell.animHeroStripId ?? -1) : (spell.animEnemyStripId ?? -1);
      this.duelTimeline = buildMagicSequenceTimeline({
        caster: attacker,
        casterIdle,
        casterCast,
        spell,
        targets: [
          {
            target: defender,
            targetIdle,
            spellPack,
            spellStripId: stripId,
            isHeal: false,
            hit: true,
            amount: halfTargetHp,
          },
        ],
      });
    } else {
      let actionSlot: 'attack' | 'ranged' | 'idle' = 'attack';
      if (this.selectedMove === 'ranged' && caps.rangedSlot) {
        actionSlot = caps.rangedSlot;
      } else if (this.selectedMove === 'special' && caps.specialSlot) {
        actionSlot = caps.specialSlot;
      } else if (caps.meleeSlot) {
        actionSlot = caps.meleeSlot;
      } else {
        actionSlot = 'idle';
      }

      const [actorIdle, actorAct, targetIdle] = await Promise.all([
        this.assets.loadUnitFigAni(attacker.uid, 'idle'),
        this.assets.loadUnitFigAni(attacker.uid, actionSlot),
        this.assets.loadUnitFigAni(defender.uid, 'idle'),
      ]);
      if (reqId !== this.syncSeq) return;

      const activeSpecialTech =
        this.selectedMove === 'special' && caps.specialTechniques.length > 0 ? caps.specialTechniques[0] : null;
      const specialMpCost = activeSpecialTech ? Math.max(0, activeSpecialTech.mpCost ?? 0) : 0;

      this.duelTimeline = buildPhysicalStrikeTimeline({
        bgId: this.previewBgId,
        actor: attacker,
        target: defender,
        actorIdle,
        actorAct,
        targetIdle,
        hit: true,
        crit: false,
        totalDamage: halfTargetHp,
        actorCurHp: attacker.startHp,
        targetStartHp: defender.startHp,
        actorMpCost: specialMpCost,
        specialTechId: activeSpecialTech?.id ?? null,
      });
    }

    this.manualStepIdx = 0;
    this.pausedElapsedMs = 0;
    this.animStartMs = performance.now();
  }

  private captureRosterScrollPositions(): void {
    const prevEnemyList = document.getElementById('enemy-roster-list');
    if (prevEnemyList) {
      this.enemyRosterScrollTop = prevEnemyList.scrollTop;
    }
    const prevHeroList = document.getElementById('hero-roster-list');
    if (prevHeroList) {
      this.heroRosterScrollTop = prevHeroList.scrollTop;
    }
  }

  private restoreRosterScrollPositions(): void {
    const nextEnemyList = document.getElementById('enemy-roster-list');
    if (nextEnemyList) {
      nextEnemyList.scrollTop = this.enemyRosterScrollTop;
    }
    const nextHeroList = document.getElementById('hero-roster-list');
    if (nextHeroList) {
      nextHeroList.scrollTop = this.heroRosterScrollTop;
    }
  }

  private renderShell(): void {
    this.captureRosterScrollPositions();
    const audit = this.runAuditSummary();

    this.rootEl.innerHTML = `
      <header class="gal-header">
        <div class="gal-topbar">
          <div class="gal-brand">
            <div class="gal-crest">
              <img src="./favicon.ico" width="20" height="20" class="pixel-crisp" alt="FD2" />
            </div>
            <div>
              <div class="gal-title">炎龍騎士團II · 戰鬥演武與全單位圖鑑總覽 (Battle & Asset Gallery)</div>
              <div class="gal-subtitle">0-Indexed Clean FD2.EXE + DATO.DAT + FDICON.B24 + FIGANI.DAT + FDOTHER.DAT (法術特效)</div>
            </div>
          </div>

          <nav class="gal-nav-tabs" aria-label="Gallery Sections">
            <button class="gal-btn ${this.activeTab === 'duel' ? 'active' : ''}" data-gtab="duel" type="button">
              ⚔ 戰鬥演武與全單位圖鑑 (0..135)
            </button>
            <button class="gal-btn ${this.activeTab === 'catalog' ? 'active' : ''}" data-gtab="catalog" type="button">
              道具 · 法術 · 職業 (${audit.totalItems}/${audit.totalSpells})
            </button>
            <button class="gal-btn ${this.activeTab === 'chapters' ? 'active' : ''}" data-gtab="chapters" type="button">
              33 章對話與出場驗證
            </button>
            <a class="gal-btn gold" href="./index.html" id="link-back-to-game">進入戰棋主遊戲 · Launch Game →</a>
          </nav>
        </div>

        <div class="audit-strip">
          <div class="audit-strip-inner">
            <span class="audit-pill">✓ 左側敵方 (BG) vs 右側我方 (TAI) 實機演武</span>
            <span class="audit-pill">✓ ${audit.portraitsOk}/136 DATO 頭像 · ${audit.spritesOk} 組地圖走圖</span>
            <span class="audit-pill">✓ ${audit.figOk} 單位 FIGANI + ${audit.spellAnimsCount} 組 FDOTHER 法術/召喚特效</span>
            <span class="audit-pill">✓ 打擊幀 (b4=1) 同步扣血 + 原版擊退歸位曲線 (14→18→14→9→4→0 px)</span>
            <span class="audit-pill info">來源：乾淨原版 FD2.EXE (已忽略 FD2.EX_)</span>
          </div>
        </div>
      </header>

      <main class="gal-main" id="gal-tab-body"></main>
    `;

    this.rootEl.querySelectorAll<HTMLButtonElement>('[data-gtab]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const next = btn.dataset.gtab as GalleryTab;
        this.activeTab = next;
        if (next === 'duel') {
          await this.rebuildDuelTimeline();
          this.renderShell();
        } else if (next === 'chapters' && !this.loadedChapter) {
          await this.selectChapterForValidation(this.selectedChapterId);
        } else {
          this.renderShell();
        }
      });
    });

    this.renderActiveTabBody();
  }

  private renderActiveTabBody(): void {
    const container = document.getElementById('gal-tab-body')!;
    if (this.activeTab === 'duel') {
      this.renderUnifiedDuelTab(container);
    } else if (this.activeTab === 'catalog') {
      this.renderCatalogTab(container);
    } else {
      this.renderChaptersTab(container);
    }
  }

  // =========================================================================
  // TAB 1: COMBINED BATTLE DUEL & ALL-UNITS INSPECTOR
  //        Left = Enemy Selector | Center = Live Duel Stage + Inspectors | Right = Hero Selector
  // =========================================================================
  private renderUnifiedDuelTab(container: HTMLElement): void {
    // Capture live scroll positions before re-rendering `container.innerHTML` so clicking any character never resets scroll to top!
    this.captureRosterScrollPositions();

    const eqQuery = this.enemySearch.trim().toLowerCase();
    const filteredEnemies = this.dex.unitDex.filter((u) => {
      // Never mix non-battlefield NPCs (#39, #48, #57, #66, #67, #74, #75, #128..#132) into the combat stage roster!
      if (!u.appearsOnBattlefield) return false;
      if (this.enemyFilter === 'enemy_boss' && u.role !== 'enemy' && u.role !== 'boss') return false;
      if (!eqQuery) return true;
      return (
        String(u.id).includes(eqQuery) ||
        u.hexId.toLowerCase().includes(eqQuery) ||
        u.nameZh.toLowerCase().includes(eqQuery) ||
        u.classNameZh.toLowerCase().includes(eqQuery) ||
        u.raceZh.toLowerCase().includes(eqQuery)
      );
    });

    const hqQuery = this.heroSearch.trim().toLowerCase();
    let rightListHtml = '';
    if (this.heroFilter === 'heroes_32') {
      const filteredHeroes = this.dex.heroes.filter((h) => {
        if (!hqQuery) return true;
        return (
          String(h.id).includes(hqQuery) ||
          h.hexId.toLowerCase().includes(hqQuery) ||
          h.nameZh.toLowerCase().includes(hqQuery) ||
          h.classNameZh.toLowerCase().includes(hqQuery) ||
          h.promotions.some((p) => p.classNameZh.toLowerCase().includes(hqQuery) || String(p.unitId).includes(hqQuery))
        );
      });
      rightListHtml = filteredHeroes
        .map((h) => {
          const isSel = h.id === this.selectedHeroId && (this.selectedRightUid === h.id || h.promotions.some((p) => p.unitId === this.selectedRightUid));
          return `
            <button class="hero-roster-item ${isSel ? 'selected' : ''}" data-rhid="${h.id}" type="button">
              <img class="hero-thumb pixel-crisp" src="${this.assets.portraitToDataUrl(h.portraitId, 0)}" alt="${h.nameZh}" />
              <div class="hero-roster-meta">
                <div class="hero-roster-top">
                  <span>
                    ${this.assets.glyphsToHtml(h.nameGlyphs, isSel ? 'gold' : 'ivory', 15, h.nameZh)}
                    <strong style="margin-left:4px; font-size:13px;">${h.nameZh}</strong>
                  </span>
                  <span class="mono-tag">#${String(h.id).padStart(2, '0')}</span>
                </div>
                <div style="font-size:11.5px; color:var(--ink-400); margin-top:2px; display:flex; justify-content:space-between;">
                  <span>${h.raceZh} · ${h.classNameZh}</span>
                  <span>${h.promotions.length}階轉職</span>
                </div>
              </div>
            </button>
          `;
        })
        .join('');
    } else {
      const filteredRightUnits = this.dex.unitDex.filter((u) => {
        if (this.heroFilter === 'battlefield_allies_npcs') {
          if (!u.appearsOnBattlefield || (u.role !== 'ally_npc' && u.role !== 'villager')) return false;
        } else if (this.heroFilter === 'non_battlefield_npcs') {
          if (u.appearsOnBattlefield) return false;
        }
        if (!hqQuery) return true;
        return (
          String(u.id).includes(hqQuery) ||
          u.hexId.toLowerCase().includes(hqQuery) ||
          u.nameZh.toLowerCase().includes(hqQuery) ||
          u.classNameZh.toLowerCase().includes(hqQuery) ||
          (u.usageNoteZh ?? '').toLowerCase().includes(hqQuery)
        );
      });
      rightListHtml = filteredRightUnits
        .map((u) => {
          const isSel = u.id === this.selectedRightUid;
          const subTag = !u.appearsOnBattlefield
            ? '非戰場NPC'
            : !u.canAttack
              ? '受保護(僅受擊)'
              : '戰場友軍';
          return `
            <button class="hero-roster-item ${isSel ? 'selected' : ''}" data-ruid="${u.id}" type="button">
              <img class="hero-thumb pixel-crisp" src="${this.assets.portraitToDataUrl(u.portraitId, 0)}" alt="${u.nameZh}" />
              <div class="hero-roster-meta">
                <div class="hero-roster-top">
                  <span>
                    ${this.assets.glyphsToHtml(u.nameGlyphs, isSel ? 'gold' : 'ivory', 15, u.nameZh)}
                    <strong style="margin-left:4px; font-size:13px;">${u.nameZh}</strong>
                  </span>
                  <span class="mono-tag">#${String(u.id).padStart(3, '0')}</span>
                </div>
                <div style="font-size:11.5px; color:var(--ink-400); margin-top:2px; display:flex; justify-content:space-between;">
                  <span>${u.raceZh} · ${u.classNameZh}</span>
                  <span>${subTag}</span>
                </div>
              </div>
            </button>
          `;
        })
        .join('');
    }

    const leftListHtml = filteredEnemies
      .map((u) => {
        const isSel = u.id === this.selectedEnemyUid;
        return `
          <button class="hero-roster-item ${isSel ? 'selected-enemy' : ''}" data-euid="${u.id}" type="button">
            <img class="hero-thumb pixel-crisp" src="${this.assets.portraitToDataUrl(u.portraitId, 0)}" alt="${u.nameZh}" />
            <div class="hero-roster-meta">
              <div class="hero-roster-top">
                <span>
                  ${this.assets.glyphsToHtml(u.nameGlyphs, isSel ? 'crimson' : 'ivory', 15, u.nameZh)}
                  <strong style="margin-left:4px; font-size:13px;">${u.nameZh}</strong>
                </span>
                <span class="mono-tag">#${String(u.id).padStart(3, '0')}</span>
              </div>
              <div style="font-size:11.5px; color:var(--ink-400); margin-top:2px; display:flex; justify-content:space-between;">
                <span>${u.raceZh} · ${u.classNameZh}</span>
                <span>${u.role === 'boss' ? 'BOSS' : u.role.toUpperCase()}</span>
              </div>
            </div>
          </button>
        `;
      })
      .join('');

    const leftEntry = this.dex.unitDex[this.selectedEnemyUid] ?? this.dex.unitDex[85];
    const rightEntry = this.dex.unitDex[this.selectedRightUid] ?? this.dex.unitDex[0];
    const ownerHero: HeroDef | null =
      rightEntry.baseHeroId !== null && this.dex.heroes[rightEntry.baseHeroId]
        ? this.dex.heroes[rightEntry.baseHeroId]
        : this.selectedRightUid < 32
          ? this.dex.heroes[this.selectedRightUid]
          : null;

    const promoStripHtml = ownerHero
      ? `
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:8px 10px; border-radius:8px; background:var(--bg-deep); border:1px solid var(--border-subtle);">
          <span class="mono-tag" style="color:var(--gold-300);">右側英雄轉職切換 (${ownerHero.nameZh})：</span>
          ${ownerHero.promotions
            .map((p) => {
              const active = p.unitId === rightEntry.id;
              return `
                <button class="gal-btn sm ${active ? 'active' : ''}" data-ptier="${p.unitId}" type="button">
                  T${p.tier} · ${p.classNameZh} (#${p.unitId})
                </button>
              `;
            })
            .join('')}
        </div>
      `
      : '';

    const isHeroInit = this.initiator === 'hero';
    const atkEntry = isHeroInit ? rightEntry : leftEntry;
    const caps = getUnitMoveCapabilities(atkEntry.id, this.assets.gameData, isHeroInit);

    const spellSelectHtml =
      caps.hasMagic && caps.spells.length > 0
        ? `
          <div style="display:flex; align-items:center; gap:6px; margin-left:auto;">
            <span class="mono-tag" style="color:var(--azure);">施放攻擊法術：</span>
            <select class="gal-select" id="duel-spell-select" style="width:auto; min-width:175px; padding:5px 9px; font-size:12.5px;">
              ${caps.spells
                .map(
                  (sp) =>
                    `<option value="${sp.id}" ${sp.id === this.selectedSpellId ? 'selected' : ''}>#${sp.id} ${sp.nameZh} (${sp.mpCost}MP · AoE ${sp.aoe})</option>`
                )
                .join('')}
            </select>
          </div>
        `
        : '';

    const nonCutawayNotes: string[] = [];
    if (caps.mapOnlyAttackSpells.length > 0) {
      nonCutawayNotes.push(
        `地圖範圍法術 (原版無切入動畫)：${caps.mapOnlyAttackSpells.map((s) => s.nameZh).join('、')}`
      );
    }
    if (caps.supportSpells.length > 0) {
      nonCutawayNotes.push(
        `輔助/治療/狀態 (非攻擊動畫)：${caps.supportSpells.map((s) => s.nameZh).join('、')}`
      );
    }
    if (caps.specialTechniques.length > 0) {
      nonCutawayNotes.push(
        `必殺戰技 (歸屬必殺/劍氣)：${caps.specialTechniques.map((s) => s.nameZh).join('、')}`
      );
    }
    const nonCutawayHintHtml =
      nonCutawayNotes.length > 0
        ? `<div class="mono-tag" style="font-size:11px; color:var(--ink-400); padding:2px 4px;">ℹ ${nonCutawayNotes.join(' ｜ ')}</div>`
        : '';

    const bgOptions = Array.from({ length: this.assets.gameData.bgCount }, (_, bid) => {
      const hasTai = this.assets.gameData.taiPlatforms[bid]?.valid;
      return `<option value="${bid}" ${bid === this.previewBgId ? 'selected' : ''}>戰場背景 BG/TAI #${bid}${hasTai ? ' (含戰台)' : ''}</option>`;
    }).join('');

    const maxStep = Math.max(0, this.duelTimeline.length - 1);
    const isNonBattlefieldSelected = !leftEntry.appearsOnBattlefield || !rightEntry.appearsOnBattlefield;
    const nonBattlefieldEntry = !rightEntry.appearsOnBattlefield ? rightEntry : leftEntry;
    const isRightTargetOnlyNpc = rightEntry.appearsOnBattlefield && !rightEntry.canAttack;
    const isLeftTargetOnlyNpc = leftEntry.appearsOnBattlefield && !leftEntry.canAttack;

    const targetOnlyBannerHtml =
      isRightTargetOnlyNpc || isLeftTargetOnlyNpc
        ? `
          <div style="padding:8px 12px; border-radius:8px; background:rgba(224,180,86,0.12); border:1px solid var(--border-brass); font-size:12.5px; color:var(--gold-200);">
            🛡 <strong>受保護戰場NPC (${isRightTargetOnlyNpc ? `#${rightEntry.id} ${rightEntry.nameZh}` : `#${leftEntry.id} ${leftEntry.nameZh}`})</strong>：
            ${(isRightTargetOnlyNpc ? rightEntry.usageNoteZh : leftEntry.usageNoteZh) ?? '在戰場上僅作為受保護/撤離目標承受敵軍攻擊，無武器且絕不主動攻擊或反擊。'}
          </div>
        `
        : '';

    const centerStageCardHtml = isNonBattlefieldSelected
      ? `
          <div class="duel-stage-card">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
              <div>
                <div class="card-title">非戰場角色檢視模式 (Non-Battlefield Town / Story / Unused Slot)</div>
                <div class="mono-tag" style="margin-top:2px; color:var(--gold-200);">
                  檢視編號：<strong>#${nonBattlefieldEntry.id} (${nonBattlefieldEntry.hexId}) · ${nonBattlefieldEntry.nameZh} (${nonBattlefieldEntry.classNameZh})</strong>
                </div>
              </div>
              <span class="role-badge role-npc">絕不上戰場 (appearsOnBattlefield = false)</span>
            </div>

            <div style="padding:18px; border-radius:10px; background:var(--bg-deep); border:1px solid var(--border-brass); display:flex; gap:18px; align-items:center; flex-wrap:wrap;">
              <img
                class="pixel-crisp"
                src="${this.assets.portraitToDataUrl(nonBattlefieldEntry.portraitId, 0)}"
                width="96"
                height="96"
                style="border-radius:8px; border:2px solid var(--border-brass); background:#05070b;"
                alt="${nonBattlefieldEntry.nameZh}"
              />
              <div style="flex:1; min-width:240px;">
                <div style="font-size:15px; font-weight:700; color:var(--gold-200); margin-bottom:6px;">
                  #${nonBattlefieldEntry.id} ${nonBattlefieldEntry.nameZh} — 原版 FD2.EXE 用途考證
                </div>
                <div style="font-size:13px; line-height:1.6; color:var(--ink-200);">
                  ${nonBattlefieldEntry.usageNoteZh ?? '非戰鬥角色，不會出現在第 1～30 章戰術地圖或 320×200 戰鬥畫面中。'}
                </div>
                <div class="mono-tag" style="margin-top:8px;">
                  戰術地圖出場：0 章 ｜ 過場劇情地圖：${nonBattlefieldEntry.cutsceneAppearances?.length ?? 0} 幕 ｜ 對話台詞：${nonBattlefieldEntry.dialogueSegments} 段 (${nonBattlefieldEntry.dialogueChapters.length > 0 ? nonBattlefieldEntry.dialogueChapters.map((c) => `Ch${c}`).join(', ') : '城鎮商店/營地介面'})
                </div>
              </div>
            </div>
          </div>
      `
      : `
          <div class="duel-stage-card">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
              <div>
                <div class="card-title">實機引擎戰鬥動畫演武台 (320×200 原生對戰 · 單目標法術滑入 · 打擊幀同步扣血)</div>
                <div class="mono-tag" style="margin-top:2px;">
                  左側敵方：<strong>#${leftEntry.id} ${leftEntry.nameZh} (${leftEntry.classNameZh})</strong>
                  &nbsp;VS&nbsp;
                  右側我方：<strong>#${rightEntry.id} ${rightEntry.nameZh} (${rightEntry.classNameZh})</strong>
                </div>
              </div>
              <select class="gal-select" id="duel-bg-select" style="width:auto; padding:5px 9px; font-size:12px;">
                ${bgOptions}
              </select>
            </div>

            ${promoStripHtml}
            ${targetOnlyBannerHtml}

            <!-- Initiator Toggle: Enemy Attacks vs Hero Attacks (disabled for target-only protected NPCs!) -->
            <div class="initiator-bar">
              <button
                class="init-toggle-btn ${!isHeroInit ? 'active-enemy' : ''}"
                data-init="enemy"
                ${isLeftTargetOnlyNpc ? 'disabled title="受保護戰場NPC (#133-#135) 絕不主動攻擊"' : ''}
                type="button"
              >
                <span>⚔ ${isLeftTargetOnlyNpc ? '左側為受保護NPC (不可攻擊)' : '敵方發動攻擊 (Left Enemy Initiates →)'}</span>
              </button>
              <button
                class="init-toggle-btn ${isHeroInit ? 'active-hero' : ''}"
                data-init="hero"
                ${isRightTargetOnlyNpc ? 'disabled title="受保護戰場NPC (#133-#135) 僅承受敵方攻擊，絕不主動攻擊或反擊"' : ''}
                type="button"
              >
                <span>✦ ${isRightTargetOnlyNpc ? '右側為受保護NPC (僅承受攻擊)' : '我方發動攻擊 (← Right Hero Initiates)'}</span>
              </button>
            </div>

            <!-- Move Type Buttons: Hero has 4 (Melee, Ranged, Special, Magic); Enemy has 3 (Melee, Ranged, Magic) -->
            <div class="move-buttons-row">
              <span class="mono-tag" style="margin-right:4px;">
                ${isHeroInit ? '我方招式：' : '敵方招式：'}
              </span>
              <button
                class="move-btn ${this.selectedMove === 'melee' && caps.hasMelee ? 'active' : ''}"
                data-move="melee"
                ${caps.hasMelee ? '' : 'disabled'}
                type="button"
              >
                近戰攻擊 (Melee)
              </button>
              <button
                class="move-btn ${this.selectedMove === 'ranged' && caps.hasRanged ? 'active' : ''}"
                data-move="ranged"
                ${caps.hasRanged ? '' : 'disabled'}
                type="button"
              >
                遠程攻擊 (Ranged)
              </button>
              ${
                isHeroInit
                  ? `
                    <button
                      class="move-btn ${this.selectedMove === 'special' && caps.hasSpecial ? 'active' : ''}"
                      data-move="special"
                      ${caps.hasSpecial ? '' : 'disabled'}
                      type="button"
                    >
                      必殺/劍氣 (Special)
                    </button>
                  `
                  : ''
              }
              <button
                class="move-btn ${this.selectedMove === 'magic' && caps.hasMagic ? 'active' : ''}"
                data-move="magic"
                ${caps.hasMagic ? '' : 'disabled'}
                type="button"
              >
                法術攻擊 (Magic)
              </button>

              ${spellSelectHtml}
            </div>

            ${nonCutawayHintHtml}

            <!-- 320x200 Authentic Combat Stage Canvas -->
            <div class="duel-canvas-shell">
              <canvas id="duel-stage-canvas" class="duel-canvas pixel-crisp" width="320" height="200"></canvas>
            </div>

            <!-- Playback Controls & Frame Scrubber -->
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
              <button class="gal-btn sm gold" id="duel-btn-replay" type="button">↻ 重播攻擊</button>
              <button class="gal-btn sm" id="duel-btn-playpause" type="button">
                ${this.getPlayPauseLabel()}
              </button>
              <button class="gal-btn sm ${this.duelLoop ? 'active' : ''}" id="duel-btn-loop" type="button">
                🔁 自動循環：${this.duelLoop ? '開' : '關'}
              </button>
              <span class="mono-tag" id="duel-step-label" style="min-width:255px; color:var(--gold-200);">
                Step 1 / ${Math.max(1, this.duelTimeline.length)}
              </span>
              <input
                type="range"
                id="duel-scrubber"
                min="0"
                max="${maxStep}"
                value="${Math.min(maxStep, this.manualStepIdx)}"
                style="flex:1; min-width:140px; accent-color: #e0b456;"
              />
            </div>
          </div>
      `;

    container.innerHTML = `
      <div class="duel-workspace">
        <!-- LEFT COLUMN: ENEMY / LEFT-SIDE BATTLEFIELD SELECTOR -->
        <aside class="roster-panel">
          <div class="duel-column-header">
            <div class="duel-side-title enemy">
              <span>← 左側戰場敵陣 (Standing on BG)</span>
              <span class="mono-tag">#${leftEntry.id}</span>
            </div>
            <div class="duel-filter-pills">
              <button class="gal-btn sm ${this.enemyFilter === 'enemy_boss' ? 'active' : ''}" data-efilt="enemy_boss" type="button">敵軍/Boss (52)</button>
              <button class="gal-btn sm ${this.enemyFilter === 'all_battlefield' ? 'active' : ''}" data-efilt="all_battlefield" type="button">全戰場單位 (124)</button>
            </div>
            <input
              type="search"
              class="gal-input"
              id="enemy-search-input"
              placeholder="搜尋左側戰場敵軍 / Boss / ID..."
              value="${this.escapeAttr(this.enemySearch)}"
            />
          </div>
          <div class="roster-list" id="enemy-roster-list">
            ${leftListHtml || `<div style="padding:16px; color:var(--ink-400); text-align:center;">無符合條件的戰場單位</div>`}
          </div>
        </aside>

        <!-- CENTER COLUMN: LIVE ENGINE COMBAT DUEL STAGE + DUAL ASSET INSPECTORS -->
        <section class="inspector-stack">
          ${centerStageCardHtml}

          <!-- Side-by-Side Detailed Asset & Stats Proof Cards for Selected Enemy (Left) & Selected Hero (Right) -->
          <div class="duel-inspectors-grid">
            ${this.buildUnitInspectorCardHtml(leftEntry, 'left', null)}
            ${this.buildUnitInspectorCardHtml(rightEntry, 'right', ownerHero)}
          </div>
        </section>

        <!-- RIGHT COLUMN: HERO / BATTLEFIELD ALLIES / NON-BATTLEFIELD NPC SELECTOR -->
        <aside class="roster-panel">
          <div class="duel-column-header">
            <div class="duel-side-title hero">
              <span>右側我方 / NPC 檢視 →</span>
              <span class="mono-tag">#${rightEntry.id}</span>
            </div>
            <div class="duel-filter-pills">
              <button class="gal-btn sm ${this.heroFilter === 'heroes_32' ? 'active' : ''}" data-hfilt="heroes_32" type="button">32名英雄</button>
              <button class="gal-btn sm ${this.heroFilter === 'battlefield_allies_npcs' ? 'active' : ''}" data-hfilt="battlefield_allies_npcs" type="button">戰場友軍/受保護NPC</button>
              <button class="gal-btn sm ${this.heroFilter === 'non_battlefield_npcs' ? 'active' : ''}" data-hfilt="non_battlefield_npcs" type="button">非戰場NPC (商店/劇情)</button>
            </div>
            <input
              type="search"
              class="gal-input"
              id="hero-search-input"
              placeholder="搜尋右側英雄 / 友軍 / 商店劇情NPC..."
              value="${this.escapeAttr(this.heroSearch)}"
            />
          </div>
          <div class="roster-list" id="hero-roster-list">
            ${rightListHtml || `<div style="padding:16px; color:var(--ink-400); text-align:center;">無符合條件的角色</div>`}
          </div>
        </aside>
      </div>
    `;

    // Restore exact scroll positions immediately before paint so the selected character never jumps back to top!
    this.restoreRosterScrollPositions();

    this.bindUnifiedDuelEvents(container);
  }

  private buildUnitInspectorCardHtml(
    entry: UnitDexEntry,
    side: 'left' | 'right',
    ownerHero: HeroDef | null
  ): string {
    const portraitStrip = [0, 1, 2, 3]
      .map(
        (f) => `
          <div class="frame-mini-cell">
            <img class="pixel-crisp" src="${this.assets.portraitToDataUrl(entry.portraitId, f)}" alt="F${f}" />
            <span class="mono-tag" style="font-size:9.5px;">F${f}</span>
          </div>
        `
      )
      .join('');

    const dirLabels = ['↓南', '←西', '↑北', '→東'];
    const spriteRows = [0, 1, 2, 3]
      .map((dir) => {
        const cells = [0, 1, 2]
          .map(
            (fr) => `
              <div class="sprite-cell">
                <img class="pixel-crisp" src="${this.assets.spriteToDataUrl(entry.effectiveSpriteGroup, dir, fr, 28)}" width="28" height="28" alt="" />
              </div>
            `
          )
          .join('');
        return `<div>${dirLabels[dir]}</div>${cells}`;
      })
      .join('');

    const g: GrowthDef | null = entry.growth ?? ownerHero?.growth ?? null;
    const ec = entry.enemyStats;
    const statsHtml = ownerHero
      ? `
        <div class="kv-grid">
          <div class="kv-box"><div class="kv-label">初始HP</div><div class="kv-val">${ownerHero.maxHp}</div></div>
          <div class="kv-box"><div class="kv-label">初始MP</div><div class="kv-val">${ownerHero.maxMp}</div></div>
          <div class="kv-box"><div class="kv-label">AP / DP</div><div class="kv-val">${ownerHero.baseAp}/${ownerHero.baseDp}</div></div>
          <div class="kv-box"><div class="kv-label">DX / MV</div><div class="kv-val">${ownerHero.baseDx}/${ownerHero.mv}</div></div>
        </div>
        ${
          g
            ? `<div class="mono-tag" style="margin-top:6px;">成長範圍：HP+${g.hp[0]}~${g.hp[1]} · MP+${g.mp[0]}~${g.mp[1]} · AP+${g.ap[0]}~${g.ap[1]} · DP+${g.dp[0]}~${g.dp[1]}</div>`
            : ''
        }
      `
      : ec
        ? `
          <div class="kv-grid">
            <div class="kv-box"><div class="kv-label">HP成長</div><div class="kv-val">${ec.hpGrowth}</div></div>
            <div class="kv-box"><div class="kv-label">MP成長</div><div class="kv-val">${ec.mpGrowth}</div></div>
            <div class="kv-box"><div class="kv-label">AP / DP</div><div class="kv-val">${ec.apGrowth}/${ec.dpGrowth}</div></div>
            <div class="kv-box"><div class="kv-label">DX / MV</div><div class="kv-val">${ec.dxGrowth}/${ec.mv}</div></div>
          </div>
        `
        : '';

    const figIdle = entry.figani?.idle?.frameCount ?? 0;
    const figAtk = entry.figani?.attack?.frameCount ?? 0;
    const figRng = entry.figani?.ranged?.frameCount ?? 0;

    return `
      <div class="mini-inspector-card">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; border-bottom:1px solid var(--border-subtle); padding-bottom:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <canvas id="${side}-portrait-canvas" class="pixel-crisp" width="80" height="80" style="width:52px; height:52px; border-radius:5px; border:1px solid var(--border-brass); background:#05070b;"></canvas>
            <canvas id="${side}-sprite-canvas" class="pixel-crisp" width="24" height="24" style="width:42px; height:42px; border-radius:5px; border:1px solid var(--border-subtle); background:#0b0e15;"></canvas>
            <div>
              <div class="mono-tag">${side === 'left' ? 'LEFT ENEMY' : 'RIGHT HERO'} · SLOT #${entry.id} (${entry.hexId})</div>
              <div style="display:flex; align-items:center; gap:6px; margin-top:2px;">
                ${this.assets.glyphsToHtml(entry.nameGlyphs, side === 'left' ? 'crimson' : 'gold', 17, entry.nameZh)}
                <strong>${entry.nameZh}</strong>
                <span class="mono-tag">(${entry.classNameZh})</span>
              </div>
            </div>
          </div>
        </div>

        <div class="mono-tag">
          DATO[${entry.portraitId}] · FDICON[${entry.effectiveSpriteGroup}] · FIGANI(Idle:${figIdle}f, Atk:${figAtk}f${entry.figani?.attack?.isRemote ? '·遠程' : entry.id === 113 ? '·單屏光束砲' : ''}, Slot2:${figRng}f${figRng > 0 ? (entry.id === 18 || entry.id === 19 || entry.id === 25 || entry.id === 32 || entry.id === 34 ? '·必殺技' : entry.id === 50 ? '·必殺/詠唱' : '·施法詠唱') : ''})
        </div>

        <div class="portrait-frames-strip">${portraitStrip}</div>

        <div class="sprite-matrix">
          <div>方向</div><div style="text-align:center;">F0</div><div style="text-align:center;">F1</div><div style="text-align:center;">F2</div>
          ${spriteRows}
        </div>

        ${statsHtml}

        ${
          entry.usageNoteZh
            ? `<div style="font-size:11.5px; color:${!entry.appearsOnBattlefield ? 'var(--gold-200)' : !entry.canAttack ? 'var(--gold-300)' : 'var(--ink-300)'}; padding:4px 6px; border-radius:4px; background:var(--bg-deep); border:1px solid var(--border-subtle);">${entry.usageNoteZh}</div>`
            : ''
        }

        <div class="mono-tag">
          戰場出場：${entry.chapterAppearances.length} 章${entry.cutsceneAppearances && entry.cutsceneAppearances.length > 0 ? ` · 過場劇情：${entry.cutsceneAppearances.length} 幕` : ''} · 對話台詞：${entry.dialogueSegments} 段
        </div>
      </div>
    `;
  }

  private bindUnifiedDuelEvents(container: HTMLElement): void {
    // Continuously persist scroll positions of both rosters
    const enemyListEl = document.getElementById('enemy-roster-list');
    enemyListEl?.addEventListener(
      'scroll',
      () => {
        this.enemyRosterScrollTop = enemyListEl.scrollTop;
      },
      { passive: true }
    );
    const heroListEl = document.getElementById('hero-roster-list');
    heroListEl?.addEventListener(
      'scroll',
      () => {
        this.heroRosterScrollTop = heroListEl.scrollTop;
      },
      { passive: true }
    );

    // Search inputs (preserve cursor focus & position, reset filtered list scroll to top)
    const enemyInput = document.getElementById('enemy-search-input') as HTMLInputElement | null;
    enemyInput?.addEventListener('input', () => {
      const pos = enemyInput.selectionStart ?? enemyInput.value.length;
      this.enemySearch = enemyInput.value;
      this.enemyRosterScrollTop = 0;
      if (enemyListEl) enemyListEl.scrollTop = 0;
      this.renderActiveTabBody();
      const next = document.getElementById('enemy-search-input') as HTMLInputElement | null;
      if (next) {
        next.focus();
        next.setSelectionRange(pos, pos);
      }
    });

    const heroInput = document.getElementById('hero-search-input') as HTMLInputElement | null;
    heroInput?.addEventListener('input', () => {
      const pos = heroInput.selectionStart ?? heroInput.value.length;
      this.heroSearch = heroInput.value;
      this.heroRosterScrollTop = 0;
      if (heroListEl) heroListEl.scrollTop = 0;
      this.renderActiveTabBody();
      const next = document.getElementById('hero-search-input') as HTMLInputElement | null;
      if (next) {
        next.focus();
        next.setSelectionRange(pos, pos);
      }
    });

    // Left / Right roster filter pills (reset only that column's scroll when switching filter tabs)
    container.querySelectorAll<HTMLButtonElement>('[data-efilt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.enemyFilter = btn.dataset.efilt as EnemyListFilter;
        this.enemyRosterScrollTop = 0;
        if (enemyListEl) enemyListEl.scrollTop = 0;
        this.renderActiveTabBody();
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-hfilt]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const nextFilt = btn.dataset.hfilt as HeroListFilter;
        this.heroFilter = nextFilt;
        this.heroRosterScrollTop = 0;
        if (heroListEl) heroListEl.scrollTop = 0;
        // Auto-select a representative unit when switching right-hand category tabs so the center panel updates immediately!
        if (nextFilt === 'heroes_32' && this.dex.unitDex[this.selectedRightUid]?.baseHeroId === null && this.selectedRightUid >= 32) {
          this.selectedRightUid = this.selectedHeroId;
          this.duelPlaying = true;
          await this.rebuildDuelTimeline();
        } else if (nextFilt === 'battlefield_allies_npcs') {
          const cur = this.dex.unitDex[this.selectedRightUid];
          if (!cur || !cur.appearsOnBattlefield || (cur.role !== 'ally_npc' && cur.role !== 'villager')) {
            const firstAlly = this.dex.unitDex.find((u) => u.appearsOnBattlefield && (u.role === 'ally_npc' || u.role === 'villager'));
            if (firstAlly) this.selectedRightUid = firstAlly.id;
            this.duelPlaying = true;
            await this.rebuildDuelTimeline();
          }
        } else if (nextFilt === 'non_battlefield_npcs') {
          const cur = this.dex.unitDex[this.selectedRightUid];
          if (!cur || cur.appearsOnBattlefield) {
            const firstNpc = this.dex.unitDex.find((u) => !u.appearsOnBattlefield && u.hasPortrait);
            if (firstNpc) this.selectedRightUid = firstNpc.id;
            await this.rebuildDuelTimeline();
          }
        }
        this.renderActiveTabBody();
      });
    });

    // Select Left Enemy (preserve exact scroll position in both rosters!)
    container.querySelectorAll<HTMLButtonElement>('[data-euid]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        this.captureRosterScrollPositions();
        this.selectedEnemyUid = Number(btn.dataset.euid);
        this.duelPlaying = true;
        await this.rebuildDuelTimeline();
        this.renderActiveTabBody();
      });
    });

    // Select Right Hero (0..31) or arbitrary Right Unit (0..135) (preserve exact scroll position in both rosters!)
    container.querySelectorAll<HTMLButtonElement>('[data-rhid]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        this.captureRosterScrollPositions();
        const hid = Number(btn.dataset.rhid);
        this.selectedHeroId = hid;
        this.selectedRightUid = hid;
        this.duelPlaying = true;
        await this.rebuildDuelTimeline();
        this.renderActiveTabBody();
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-ruid]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        this.captureRosterScrollPositions();
        const uid = Number(btn.dataset.ruid);
        this.selectedRightUid = uid;
        const owner = this.dex.unitDex[uid]?.baseHeroId;
        if (owner !== null && owner !== undefined) this.selectedHeroId = owner;
        this.duelPlaying = true;
        await this.rebuildDuelTimeline();
        this.renderActiveTabBody();
      });
    });

    // Select Promotion Tier for Right Hero
    container.querySelectorAll<HTMLButtonElement>('[data-ptier]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        this.selectedRightUid = Number(btn.dataset.ptier);
        this.duelPlaying = true;
        await this.rebuildDuelTimeline();
        this.renderActiveTabBody();
      });
    });

    // Initiator toggle (Hero Attacks vs Enemy Attacks)
    container.querySelectorAll<HTMLButtonElement>('[data-init]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        this.initiator = btn.dataset.init as 'hero' | 'enemy';
        this.duelPlaying = true;
        await this.rebuildDuelTimeline();
        this.renderActiveTabBody();
      });
    });

    // Move buttons (Melee, Ranged, Special, Magic)
    container.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (btn.disabled) return;
        this.selectedMove = btn.dataset.move as BattleMoveKind;
        this.duelPlaying = true;
        await this.rebuildDuelTimeline();
        this.renderActiveTabBody();
      });
    });

    // Spell dropdown selector (auto-switches to Magic move when changed!)
    const spellSel = document.getElementById('duel-spell-select') as HTMLSelectElement | null;
    spellSel?.addEventListener('change', async () => {
      this.selectedSpellId = Number(spellSel.value);
      this.selectedMove = 'magic';
      this.duelPlaying = true;
      await this.rebuildDuelTimeline();
      this.renderActiveTabBody();
    });

    // Terrain BG/TAI selector
    const bgSel = document.getElementById('duel-bg-select') as HTMLSelectElement | null;
    bgSel?.addEventListener('change', async () => {
      this.previewBgId = Number(bgSel.value);
      this.duelPlaying = true;
      await this.rebuildDuelTimeline();
      this.syncPlaybackControlsUi();
    });

    // Replay, Play/Pause, Loop Toggle & Scrubber (millisecond-exact pause/resume with zero DOM thrash)
    document.getElementById('duel-btn-replay')?.addEventListener('click', () => {
      this.manualStepIdx = 0;
      this.pausedElapsedMs = 0;
      this.animStartMs = performance.now();
      this.duelPlaying = true;
      this.syncPlaybackControlsUi();
    });

    document.getElementById('duel-btn-playpause')?.addEventListener('click', () => {
      if (this.duelPlaying) {
        this.pausedElapsedMs = Math.max(0, this.lastRafMs - this.animStartMs);
        this.duelPlaying = false;
      } else {
        const lastIdx = Math.max(0, this.duelTimeline.length - 1);
        if (this.manualStepIdx >= lastIdx) {
          this.manualStepIdx = 0;
          this.pausedElapsedMs = 0;
          this.animStartMs = performance.now();
        } else {
          const baseMs = Math.max(this.pausedElapsedMs, this.getTicksBeforeStep(this.manualStepIdx) * 55);
          this.animStartMs = Math.min(this.lastRafMs, performance.now()) - baseMs;
        }
        this.duelPlaying = true;
      }
      this.syncPlaybackControlsUi();
    });

    document.getElementById('duel-btn-loop')?.addEventListener('click', () => {
      this.duelLoop = !this.duelLoop;
      if (this.duelLoop && !this.duelPlaying) {
        const lastIdx = Math.max(0, this.duelTimeline.length - 1);
        if (this.manualStepIdx >= lastIdx) {
          this.manualStepIdx = 0;
          this.pausedElapsedMs = 0;
          this.animStartMs = performance.now();
        } else {
          const baseMs = Math.max(this.pausedElapsedMs, this.getTicksBeforeStep(this.manualStepIdx) * 55);
          this.animStartMs = Math.min(this.lastRafMs, performance.now()) - baseMs;
        }
        this.duelPlaying = true;
      }
      this.syncPlaybackControlsUi();
    });

    const scrubber = document.getElementById('duel-scrubber') as HTMLInputElement | null;
    scrubber?.addEventListener('input', () => {
      this.duelPlaying = false;
      this.manualStepIdx = Number(scrubber.value);
      this.pausedElapsedMs = this.getTicksBeforeStep(this.manualStepIdx) * 55;
      this.syncPlaybackControlsUi();
    });
  }

  // =========================================================================
  // TAB 2: ITEMS (0..214), SPELLS (0..35) & HERO CLASSES (1..28)
  // =========================================================================
  private renderCatalogTab(container: HTMLElement): void {
    const q = this.catalogSearch.trim().toLowerCase();

    let tableHtml = '';
    if (this.catalogSubTab === 'items') {
      const items = this.dex.items.filter((it) => {
        if (it.nameGlyphs.length === 0 && !it.nameZh) return false;
        if (this.itemCategoryFilter !== 'all' && it.category !== this.itemCategoryFilter) return false;
        if (!q) return true;
        return (
          String(it.id).includes(q) ||
          it.nameZh.toLowerCase().includes(q) ||
          it.category.toLowerCase().includes(q)
        );
      });

      tableHtml = `
        <div class="gal-table-wrap">
          <table class="gal-table">
            <thead>
              <tr>
                <th>Item ID</th>
                <th>FDTXT 字模</th>
                <th>UTF-8 名稱</th>
                <th>分類 (Type)</th>
                <th>AP / DP</th>
                <th>HIT / EV</th>
                <th>射程</th>
                <th>價格 (G)</th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map(
                  (it) => `
                    <tr>
                      <td class="mono-tag">#${it.id} (sys[${it.sysStringIndex}])</td>
                      <td>${this.assets.glyphsToHtml(it.nameGlyphs, 'gold', 16, it.nameZh)}</td>
                      <td><strong>${it.nameZh || '—'}</strong></td>
                      <td><span class="mono-tag">${it.category.toUpperCase()} (t=${it.itemType})</span></td>
                      <td class="mono-tag">+${it.ap} / +${it.dp}</td>
                      <td class="mono-tag">${it.hit} / ${it.ev}</td>
                      <td class="mono-tag">${it.minRange}–${it.maxRange}</td>
                      <td class="mono-tag" style="color:var(--gold-200);">${it.price} G</td>
                    </tr>
                  `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    } else if (this.catalogSubTab === 'spells') {
      const spells = this.dex.spells.filter((sp) => {
        if (!q) return true;
        return String(sp.id).includes(q) || sp.nameZh.toLowerCase().includes(q);
      });

      const categoryLabelMap: Record<string, { label: string; cls: string }> = {
        cutaway_attack: { label: '戰鬥切入攻擊 (Func_108221)', cls: 'role-hero' },
        map_attack: { label: '地圖範圍攻擊 (無切入動畫)', cls: 'role-promo' },
        special_tech: { label: '必殺戰技 (Func_95980)', cls: 'role-hero' },
        support: { label: '輔助/治療/召喚 (非攻擊)', cls: 'role-npc' },
        unused: { label: '保留空位', cls: 'role-npc' },
      };

      tableHtml = `
        <div class="gal-table-wrap">
          <table class="gal-table">
            <thead>
              <tr>
                <th>Spell ID</th>
                <th>FDTXT[441+id] 字模</th>
                <th>UTF-8 名稱</th>
                <th>原版引擎動畫分類</th>
                <th>耗魔 MP</th>
                <th>威力 Power</th>
                <th>FDOTHER 特效塊</th>
                <th>射程 / 範圍 AoE</th>
              </tr>
            </thead>
            <tbody>
              ${spells
                .map((sp) => {
                  const catInfo = categoryLabelMap[sp.spellCategory ?? ''] ?? {
                    label: sp.targetType,
                    cls: 'role-npc',
                  };
                  const stripTxt =
                    sp.animEnemyStripId !== null || sp.animHeroStripId !== null
                      ? `OTHER[${sp.animEnemyStripId ?? '—'}/${sp.animHeroStripId ?? '—'}]`
                      : '— (無切入特效塊)';
                  return `
                    <tr>
                      <td class="mono-tag">#${sp.id} (sys[${sp.sysStringIndex}])</td>
                      <td>${this.assets.glyphsToHtml(sp.nameGlyphs, 'azure', 16, sp.nameZh)}</td>
                      <td><strong>${sp.nameZh || '(保留空位)'}</strong></td>
                      <td><span class="role-badge ${catInfo.cls}">${catInfo.label}</span></td>
                      <td class="mono-tag" style="color:var(--azure);">${sp.mpCost} MP</td>
                      <td class="mono-tag">${sp.power}</td>
                      <td class="mono-tag">${stripTxt}</td>
                      <td class="mono-tag">Rng ${sp.castRange} · AoE ${sp.aoe}${sp.isLinear ? ' (直線穿透)' : ''}</td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    } else {
      tableHtml = `
        <div class="gal-table-wrap">
          <table class="gal-table">
            <thead>
              <tr>
                <th>Class ID</th>
                <th>FDTXT[150+id] 字模</th>
                <th>UTF-8 職業名稱</th>
                <th>基礎移動力 MV</th>
                <th>移動模式 MoveMode</th>
              </tr>
            </thead>
            <tbody>
              ${this.dex.heroClasses
                .map(
                  (c) => `
                    <tr>
                      <td class="mono-tag">#${c.id} (sys[${c.sysStringIndex}])</td>
                      <td>${this.assets.glyphsToHtml(c.nameGlyphs, 'gold', 16, c.nameZh)}</td>
                      <td><strong>${c.nameZh}</strong></td>
                      <td class="mono-tag">${c.mv}</td>
                      <td class="mono-tag">${c.moveMode.toUpperCase()}</td>
                    </tr>
                  `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="filter-bar">
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          <button class="gal-btn sm ${this.catalogSubTab === 'items' ? 'active' : ''}" data-csub="items" type="button">武器與道具 (${this.dex.items.length})</button>
          <button class="gal-btn sm ${this.catalogSubTab === 'spells' ? 'active' : ''}" data-csub="spells" type="button">法術與召喚 (${this.dex.spells.length})</button>
          <button class="gal-btn sm ${this.catalogSubTab === 'classes' ? 'active' : ''}" data-csub="classes" type="button">職業定義 (${this.dex.heroClasses.length})</button>

          ${
            this.catalogSubTab === 'items'
              ? `
                <span style="margin-left:8px; color:var(--ink-400);">|</span>
                ${(['all', 'weapon', 'armor', 'consumable', 'special'] as const)
                  .map(
                    (cat) =>
                      `<button class="gal-btn sm ${this.itemCategoryFilter === cat ? 'active' : ''}" data-icat="${cat}" type="button">${cat.toUpperCase()}</button>`
                  )
                  .join('')}
              `
              : ''
          }
        </div>
        <div style="min-width:240px; flex:0 1 320px;">
          <input
            type="search"
            class="gal-input"
            id="catalog-search-input"
            placeholder="搜尋道具或法術名稱 / ID..."
            value="${this.escapeAttr(this.catalogSearch)}"
          />
        </div>
      </div>

      ${tableHtml}
    `;

    container.querySelectorAll<HTMLButtonElement>('[data-csub]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.catalogSubTab = btn.dataset.csub as CatalogSubTab;
        this.renderActiveTabBody();
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-icat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.itemCategoryFilter = btn.dataset.icat as typeof this.itemCategoryFilter;
        this.renderActiveTabBody();
      });
    });

    const searchInput = document.getElementById('catalog-search-input') as HTMLInputElement;
    searchInput.addEventListener('input', () => {
      const pos = searchInput.selectionStart ?? searchInput.value.length;
      this.catalogSearch = searchInput.value;
      this.renderActiveTabBody();
      const next = document.getElementById('catalog-search-input') as HTMLInputElement | null;
      if (next) {
        next.focus();
        next.setSelectionRange(pos, pos);
      }
    });
  }

  // =========================================================================
  // TAB 3: 33 CHAPTERS DIALOGUE SPEAKER & SPAWN VALIDATOR
  // =========================================================================
  private async selectChapterForValidation(chapterId: number): Promise<void> {
    this.selectedChapterId = chapterId;
    const { data } = await this.assets.loadChapter(chapterId);
    this.loadedChapter = data;
    this.renderShell();
  }

  private renderChaptersTab(container: HTMLElement): void {
    const chOptions = this.dex.chapters
      .map(
        (c) =>
          `<option value="${c.id}" ${c.id === this.selectedChapterId ? 'selected' : ''}>Chapter ${c.chapterNumber}${c.isCutsceneMap ? ' [過場劇情地圖]' : ''} — ${c.titleZh} (${c.width}×${c.height})</option>`
      )
      .join('');

    const ch = this.loadedChapter;
    if (!ch) {
      container.innerHTML = `<div class="gal-card">載入章節資料中...</div>`;
      void this.selectChapterForValidation(this.selectedChapterId);
      return;
    }

    const unitRosterHtml = ch.units
      .map((u) => {
        const badgeCls =
          u.faction === 'player' ? 'role-hero' : u.faction === 'ally' ? 'role-npc' : 'role-enemy';
        return `
          <div class="data-chip" style="padding:6px 10px;">
            <img class="pixel-crisp" src="${this.assets.portraitToDataUrl(u.portraitId, 0)}" width="36" height="36" style="border-radius:4px; border:1px solid var(--border-brass);" alt="" />
            <img class="pixel-crisp" src="${this.assets.spriteToDataUrl(u.spriteGroup, 0, 0, 28)}" width="28" height="28" alt="" />
            <div>
              <div>
                <span class="mono-tag">uid=${u.uid}</span>
                <strong>${u.nameZh}</strong>
                <span class="role-badge ${badgeCls}">${u.faction}</span>
              </div>
              <div class="mono-tag">Lv${u.level} · (${u.x},${u.y}) · HP ${u.maxHp}</div>
            </div>
          </div>
        `;
      })
      .join('');

    const scenesHtml = ch.dialogues
      .map((scene, sIdx) => {
        if (!scene || scene.length === 0) return '';
        const rows = scene
          .map((seg, bIdx) => {
            const isNarrator = seg.speaker === null || seg.speaker < 0;
            const pid = seg.portraitId !== undefined && seg.portraitId >= 0 ? seg.portraitId : seg.speaker ?? -1;
            const dexSpeaker = !isNarrator && seg.speaker !== null ? this.dex.unitDex[seg.speaker] : null;
            const spkZh = isNarrator ? '旁白 (無說話者標記)' : seg.speakerNameZh ?? dexSpeaker?.nameZh ?? `Speaker #${seg.speaker}`;
            const spkGlyphs = isNarrator ? [] : seg.speakerGlyphs ?? dexSpeaker?.nameGlyphs ?? [];

            const linesHtml = seg.lines
              .map((ln) => `<div style="margin-top:3px;">${this.assets.glyphsToHtml(ln, 'ivory', 17, '')}</div>`)
              .join('');

            return `
              <div class="dlg-row">
                ${
                  isNarrator
                    ? `<div class="dlg-narrator-box">旁白<br/>NULL</div>`
                    : `<img class="dlg-portrait pixel-crisp" src="${this.assets.portraitToDataUrl(pid, 0)}" alt="${spkZh}" />`
                }
                <div style="flex:1; min-width:0;">
                  <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
                    <span class="mono-tag">[Scene ${sIdx} · Box ${bIdx + 1}]</span>
                    <span class="role-badge ${isNarrator ? 'role-npc' : seg.speaker === 0 ? 'role-hero' : 'role-promo'}">
                      ${isNarrator ? 'speaker: null' : `speaker: ${seg.speaker} -> DATO[${pid}]`}
                    </span>
                    ${spkGlyphs.length > 0 ? this.assets.glyphsToHtml(spkGlyphs, 'gold', 16, spkZh) : ''}
                    <strong style="color:var(--gold-200);">${spkZh}</strong>
                  </div>
                  <div>${linesHtml}</div>
                </div>
              </div>
            `;
          })
          .join('');

        return `
          <div class="dlg-scene-block">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="color:var(--gold-300);">劇情事件段落 Scene #${sIdx}</strong>
              <span class="mono-tag">${scene.length} 個對話框</span>
            </div>
            <div class="dlg-line-list">${rows}</div>
          </div>
        `;
      })
      .join('');

    container.innerHTML = `
      <div class="filter-bar">
        <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          <span style="font-weight:600; color:var(--gold-200);">選擇檢視章節：</span>
          <select class="gal-select" id="chapter-val-select" style="width:auto; min-width:290px;">
            ${chOptions}
          </select>
          <span class="mono-tag">
            地圖尺寸 ${ch.width}×${ch.height} · 我方出擊上限 ${ch.maxDeploy} · 地圖預設單位 ${ch.units.length} 名
          </span>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <span>章節標題字模：${this.assets.glyphsToHtml(ch.titleGlyphs, 'gold', 18, ch.titleZh)}</span>
        </div>
      </div>

      <div class="gal-card" style="margin-bottom:16px;">
        <div class="card-header-row">
          <div class="card-title">本章地圖配置單位驗證 (FDFIELD.DAT Units — 0-Indexed uid)</div>
          <span class="mono-tag">共 ${ch.units.length} 名預設出場單位</span>
        </div>
        <div class="tag-list">${unitRosterHtml}</div>
      </div>

      <div>
        ${scenesHtml || `<div class="gal-card">本章無對話事件。</div>`}
      </div>
    `;

    document.getElementById('chapter-val-select')?.addEventListener('change', (ev) => {
      const cid = Number((ev.target as HTMLSelectElement).value);
      void this.selectChapterForValidation(cid);
    });
  }

  // =========================================================================
  // 60FPS ANIMATION LOOP: LIVE DUEL STAGE + DUAL PORTRAIT/SPRITE INSPECTORS
  // =========================================================================
  private animLoop(nowMs: number): void {
    this.lastRafMs = nowMs;
    if (this.activeTab === 'duel') {
      const cycle = Math.floor(nowMs / 160) % 16;
      const pFrame = cycle === 15 ? 3 : cycle < 8 ? [0, 1, 2, 1][cycle % 4] : 0;
      const tick = Math.floor(nowMs / 240) % 4;
      const sFrame = tick === 3 ? 1 : tick;

      const leftEntry = this.dex.unitDex[this.selectedEnemyUid];
      const rightEntry = this.dex.unitDex[this.selectedRightUid];

      if (leftEntry) {
        const lp = document.getElementById('left-portrait-canvas') as HTMLCanvasElement | null;
        if (lp) {
          const ctx = lp.getContext('2d')!;
          ctx.clearRect(0, 0, 80, 80);
          this.assets.drawPortrait(ctx, leftEntry.portraitId, pFrame, 0, 0, 80, 80);
        }
        const ls = document.getElementById('left-sprite-canvas') as HTMLCanvasElement | null;
        if (ls) {
          const ctx = ls.getContext('2d')!;
          ctx.clearRect(0, 0, 24, 24);
          this.assets.drawUnitSprite(ctx, leftEntry.effectiveSpriteGroup, 3, sFrame, 0, 0, 24, false);
        }
      }

      if (rightEntry) {
        const rp = document.getElementById('right-portrait-canvas') as HTMLCanvasElement | null;
        if (rp) {
          const ctx = rp.getContext('2d')!;
          ctx.clearRect(0, 0, 80, 80);
          this.assets.drawPortrait(ctx, rightEntry.portraitId, pFrame, 0, 0, 80, 80);
        }
        const rs = document.getElementById('right-sprite-canvas') as HTMLCanvasElement | null;
        if (rs) {
          const ctx = rs.getContext('2d')!;
          ctx.clearRect(0, 0, 24, 24);
          this.assets.drawUnitSprite(ctx, rightEntry.effectiveSpriteGroup, this.previewSpriteDir || 1, sFrame, 0, 0, 24, false);
        }
      }

      const stageCanvas = document.getElementById('duel-stage-canvas') as HTMLCanvasElement | null;
      if (stageCanvas && this.duelTimeline.length > 0) {
        const lastIdx = this.duelTimeline.length - 1;
        let stepIdx = Math.max(0, Math.min(lastIdx, this.manualStepIdx));
        if (this.duelPlaying) {
          const totalTicks = Math.max(
            1,
            this.duelTimeline.reduce((acc, st) => acc + Math.max(1, st.delay), 0)
          );
          const elapsedMs = Math.max(0, nowMs - this.animStartMs);
          this.pausedElapsedMs = elapsedMs;
          const rawElapsedTicks = Math.floor(elapsedMs / 55);

          if (!this.duelLoop && rawElapsedTicks >= totalTicks) {
            // Single-shot playback complete: settle and hold on the final post-attack step!
            stepIdx = lastIdx;
            this.manualStepIdx = lastIdx;
            this.pausedElapsedMs = totalTicks * 55;
            this.duelPlaying = false;
            this.syncPlaybackControlsUi();
          } else {
            const elapsedTicks = this.duelLoop ? rawElapsedTicks % totalTicks : rawElapsedTicks;
            let acc = 0;
            stepIdx = 0;
            for (let i = 0; i < this.duelTimeline.length; i++) {
              acc += Math.max(1, this.duelTimeline[i].delay);
              if (elapsedTicks < acc) {
                stepIdx = i;
                break;
              }
            }
            this.manualStepIdx = stepIdx;
            const scrub = document.getElementById('duel-scrubber') as HTMLInputElement | null;
            if (scrub && document.activeElement !== scrub) {
              scrub.value = String(stepIdx);
            }
          }
        }

        const step = this.duelTimeline[stepIdx];
        const ctx = stageCanvas.getContext('2d')!;
        renderTimelineStep(ctx, this.assets, this.previewBgId, step, Math.floor(nowMs / 180));

        const lbl = document.getElementById('duel-step-label');
        if (lbl) {
          const doneTag = !this.duelPlaying && stepIdx >= lastIdx ? ' · 已完成' : '';
          lbl.textContent = `${step.stageLabel} (Step ${stepIdx + 1}/${this.duelTimeline.length}${doneTag})`;
        }
      }
    }

    requestAnimationFrame((t) => this.animLoop(t));
  }

  private getTicksBeforeStep(stepIdx: number): number {
    let ticks = 0;
    const clamped = Math.max(0, Math.min(this.duelTimeline.length, stepIdx));
    for (let i = 0; i < clamped; i++) {
      ticks += Math.max(1, this.duelTimeline[i].delay);
    }
    return ticks;
  }

  private getPlayPauseLabel(): string {
    if (this.duelPlaying) return '⏸ 暫停逐格檢視';
    const lastIdx = Math.max(0, this.duelTimeline.length - 1);
    return this.manualStepIdx >= lastIdx ? '▶ 播放攻擊' : '▶ 繼續播放';
  }

  private syncPlaybackControlsUi(): void {
    const ppBtn = document.getElementById('duel-btn-playpause');
    if (ppBtn) {
      ppBtn.textContent = this.getPlayPauseLabel();
    }
    const loopBtn = document.getElementById('duel-btn-loop');
    if (loopBtn) {
      loopBtn.classList.toggle('active', this.duelLoop);
      loopBtn.textContent = `🔁 自動循環：${this.duelLoop ? '開' : '關'}`;
    }
    const scrub = document.getElementById('duel-scrubber') as HTMLInputElement | null;
    if (scrub && document.activeElement !== scrub) {
      const maxStep = Math.max(0, this.duelTimeline.length - 1);
      scrub.max = String(maxStep);
      scrub.value = String(Math.min(maxStep, this.manualStepIdx));
    }
  }

  private escapeAttr(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }
}

const galleryApp = new MappingGalleryApp();
void galleryApp.mount(document.getElementById('gallery-app')!);
