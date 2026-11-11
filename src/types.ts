export interface AtlasMeta {
  w: number;
  h: number;
  count: number;
  cols: number;
  rows: number;
}

export interface FontMeta {
  glyphCount: number;
  cols: number;
  rows: number;
  glyphSize: number;
}

export interface TaiPlatformMeta {
  id: number;
  w: number;
  h: number;
  valid: boolean;
}

export interface FigAniFrame {
  sx: number;
  w: number;
  h: number;
  ox: number;
  oy: number;
  delay: number;
  sfx?: number;
  hitFlag?: number;
  fgLayer?: boolean; // FD2.EXE FIGANI frame byte 7 (`M1[fr+7] & 1`): draws active frame on foreground layer in front of opponent
}

export interface FigAniStrip {
  file: string;
  frameCount: number;
  stripW: number;
  stripH: number;
  isRemote?: boolean;
  splitFrame?: number;
  sfxBankCode?: number;
  sfxBankChunk?: number;
  frames: FigAniFrame[];
}

export interface UnitFigAniSet {
  idle?: FigAniStrip;
  attack?: FigAniStrip;
  ranged?: FigAniStrip;
}

export interface LearnableSpellEntry {
  level: number;
  spellId: number;
  spellNameZh: string;
}

export interface GrowthDef {
  id: number;
  hp: [number, number];
  ap: [number, number];
  dp: [number, number];
  dx: [number, number];
  mp: [number, number];
  spellListId: number | null;
  learnableSpells: LearnableSpellEntry[];
}

export interface HeroPromotionTier {
  tier: 1 | 2 | 3;
  unitId: number;
  heroClassId: number;
  classNameZh: string;
  classGlyphs: number[];
  portraitId: number;
  spriteGroup: number;
  mvBonus?: number;
  reqItemId: number | null;
  reqItemNameZh: string | null;
  growth: GrowthDef | null;
}

export interface RaceDef {
  id: number;
  nameZh: string;
  nameGlyphs: number[];
  sysStringIndex: number;
}

export interface HeroClassDef {
  id: number;
  nameZh: string;
  nameGlyphs: number[];
  sysStringIndex: number;
  mv: number;
  critRate?: number;
  magicDamageTakenTenths?: number;
  moveMode: 'foot' | 'cavalry' | 'fly';
}

export interface EnemyClassDef {
  id: number;
  unitId: number;
  nameZh: string;
  nameGlyphs: number[];
  raceId: number;
  raceZh: string;
  heroClassEquiv: number;
  hpGrowth: number;
  mpGrowth: number;
  apGrowth: number;
  dpGrowth: number;
  dxGrowth: number;
  mv: number;
  expBase: number;
  moveMode: 'foot' | 'cavalry' | 'fly';
}

export interface ItemDef {
  id: number;
  nameZh: string;
  nameGlyphs: number[];
  sysStringIndex: number;
  category: 'weapon' | 'armor' | 'consumable' | 'special';
  itemType: number;
  ap: number;
  hit: number;
  dp: number;
  ev: number;
  statusEffect: number;
  statusRate: number;
  minRange: number;
  maxRange: number;
  useEffect: number;
  useVal: number;
  useRange?: number;
  useTarget?: 'ally' | 'enemy' | 'none';
  useAoe?: number;
  price: number;
}

export type SpellCategory = 'cutaway_attack' | 'map_attack' | 'special_tech' | 'support' | 'unused';

export interface SpellDef {
  id: number;
  nameZh: string;
  nameGlyphs: number[];
  sysStringIndex: number;
  power: number;
  hit: number;
  castRange: number;
  isLinear: boolean;
  aoe: number;
  mpCost: number;
  targetType: 'enemy' | 'ally';
  spellCategory?: SpellCategory;
  hasCutawayAnim?: boolean;
  isAttackMagic?: boolean;
  mapFxStart?: number | null;
  mapFxCount?: number | null;
  mapSfxIdx?: number | null;
  cutawaySfxBank?: number | null;
  animEnemyStripId?: number;
  animHeroStripId?: number;
  animAlign?: 'target_anchor' | 'screen_abs';
}

export interface HeroDef {
  id: number;
  hexId: string;
  nameZh: string;
  nameGlyphs: number[];
  sysStringIndex: number;
  portraitId: number;
  spriteGroup: number;
  race: number;
  raceZh: string;
  raceGlyphs: number[];
  classId: number;
  classNameZh: string;
  classGlyphs: number[];
  level: number;
  maxHp: number;
  maxMp: number;
  baseAp: number;
  baseDp: number;
  baseDx: number;
  mv: number;
  moveMode: 'foot' | 'cavalry' | 'fly';
  items: number[];
  spells: number[];
  growth: GrowthDef | null;
  promotions: HeroPromotionTier[];
}

export interface UnitDexEntry {
  id: number;
  hexId: string;
  role:
    | 'hero'
    | 'hero_promo_t2'
    | 'hero_promo_t3'
    | 'story_npc'
    | 'enemy'
    | 'boss'
    | 'ally_npc'
    | 'town_npc'
    | 'villager'
    | 'unused';
  appearsOnBattlefield: boolean;
  canAttack: boolean;
  usageNoteZh?: string;
  baseHeroId: number | null;
  nameZh: string;
  nameGlyphs: number[];
  rawSysStringIndex: number;
  rawSysGlyphs: number[];
  classNameZh: string;
  classGlyphs: number[];
  raceId: number;
  raceZh: string;
  portraitId: number;
  hasPortrait: boolean;
  rawSpriteRow: number;
  rawSpriteFrames: number;
  effectiveSpriteGroup: number;
  figani: UnitFigAniSet | null;
  growth: GrowthDef | null;
  enemyStats: EnemyClassDef | null;
  knownSpells?: number[];
  chapterAppearances: { chapter: number; faction: 'player' | 'enemy' | 'ally'; count: number }[];
  cutsceneAppearances?: { chapter: number; faction: 'player' | 'enemy' | 'ally'; count: number }[];
  dialogueSegments: number;
  dialogueChapters: number[];
}

export interface ShopDef {
  chapter: number;
  isCampOnly?: boolean;
  secretTrigger: [number, number, number];
  weaponShop: number[];
  itemShop: number[];
  secretShop: number[];
}

export interface ChapterSummary {
  id: number;
  chapterNumber: number;
  isCutsceneMap?: boolean;
  width: number;
  height: number;
  maxDeploy: number;
  enemyCount: number;
  titleZh: string;
  titleGlyphs: number[];
  winGlyphs: number[];
  loseGlyphs: number[];
}

export interface BattleHudMeta {
  file: string;
  rects: Record<string, [number, number, number, number]>;
  nameFgHex: string;
  nameShadowHex: string;
}

export interface CrossIconsMeta {
  file: string;
  w: number;
  h: number;
  iconCount: number;
  states: number;
}

export interface TacticalUiMeta {
  file: string;
  rects: Record<string, [number, number, number, number]>;
}

export interface FxAtlasMeta {
  file: string;
  sparkles: [number, number, number, number][];
  lightning: [number, number, number, number][];
  explosions?: [number, number, number, number][];
  phaseBanners?: [number, number, number, number][];
  mapSpellFx?: Record<string, [number, number, number, number]>;
}

export interface ChoreoCommand {
  kind: 'walk' | 'pose' | 'hop';
  val: number;
  actors: [number, number][];
}

export interface ChoreographyScript {
  id: number;
  commands: ChoreoCommand[];
}

export interface PostFormationDef {
  start: number;
  end: number;
  xs: number[];
  ys: number[];
  dirs: number[] | number;
  cam: [number, number];
  extra: [number, number, number, number] | null;
}

export interface GameData {
  font: FontMeta;
  unitsAtlas: AtlasMeta;
  uiIcons: AtlasMeta;
  itemIcons: AtlasMeta;
  battleHud?: BattleHudMeta;
  crossIcons?: CrossIconsMeta;
  tacticalUi?: TacticalUiMeta;
  fxAtlas?: FxAtlasMeta;
  classEquipMasks?: number[][];
  portraitCount: number;
  bgCount: number;
  taiPlatforms: TaiPlatformMeta[];
  figaniByUnit: Record<string, UnitFigAniSet>;
  spellStrips: Record<string, FigAniStrip>;
  sysStrings: number[][];
  races: RaceDef[];
  heroClasses: HeroClassDef[];
  enemyClasses: EnemyClassDef[];
  items: ItemDef[];
  spells: SpellDef[];
  heroes: HeroDef[];
  unitDex: UnitDexEntry[];
  shops: ShopDef[];
  terrainApMod?: number[];
  terrainDpMod?: number[];
  classMoveCosts?: number[][];
  chapters: ChapterSummary[];
}

export interface CharacterDexMeta {
  game: string;
  sourceExecutable: string;
  idConvention: string;
  totalUnitSlots: number;
  playableHeroes: number;
  promotedAndStorySlots: number;
  enemyAllyBossSummonSlots: number;
  battlefieldUnits?: number;
  nonBattlefieldNpcs?: number;
  protectedBattlefieldNpcs?: number;
  illustratedPortraits: number;
  activeMapSpriteRows: number;
  unitsWithBattleAnim: number;
  totalItems: number;
  totalSpells: number;
  totalChapters: number;
}

export interface CharacterDexData {
  meta: CharacterDexMeta;
  races: RaceDef[];
  heroClasses: HeroClassDef[];
  heroes: HeroDef[];
  unitDex: UnitDexEntry[];
  items: ItemDef[];
  spells: SpellDef[];
  spellStrips: Record<string, FigAniStrip>;
  taiPlatforms: TaiPlatformMeta[];
  terrainApMod?: number[];
  terrainDpMod?: number[];
  classMoveCosts?: number[][];
  chapters: ChapterSummary[];
}

export interface DialogueSegment {
  speaker: number | null;
  speakerSlot?: number;
  speakerNameZh?: string;
  speakerGlyphs?: number[];
  portraitId?: number;
  boxPos: 'top' | 'mid' | 'bottom';
  lines: number[][];
  linesZhTw?: string[];
  linesZhCn?: string[];
  linesEn?: string[];
}

export interface ChestDef {
  chestIndex: number;
  type: 'gold' | 'item' | 'event';
  value: number;
}

export interface ChapterUnitDef {
  index: number;
  urecIndex?: number;
  uid: number;
  nameZh: string;
  nameGlyphs: number[];
  classNameZh: string;
  classGlyphs: number[];
  portraitId: number;
  spriteGroup: number;
  faction: 'player' | 'enemy' | 'ally';
  classId: number;
  moveMode: 'foot' | 'cavalry' | 'fly';
  aiMode: number;
  aiTargetX?: number;
  aiTargetY?: number;
  aiChestIdx?: number;
  level: number;
  x: number;
  y: number;
  maxHp: number;
  maxMp: number;
  baseAp: number;
  baseDp: number;
  baseDx: number;
  mv: number;
  items: number[];
  spells: number[];
  waveGroup: number;
  isBoss: boolean;
  drop: { type: 'item' | 'gold' | 'event' | 'dialogue'; value: number } | null;
}

/** Cell tuple: [tileId, eventOrChestId, bonusIdx, bgId, flags] */
export type MapCellTuple = [number, number, number, number, number];

export interface ChapterData {
  id: number;
  chapterNumber: number;
  isCutsceneMap?: boolean;
  width: number;
  height: number;
  maxDeploy: number;
  titleZh: string;
  titleGlyphs: number[];
  winGlyphs: number[];
  loseGlyphs: number[];
  tileset: AtlasMeta;
  cells: MapCellTuple[][];
  playerSlots: [number, number][];
  turnEvents: { slot?: number; turn: number; eventId: number; phase?: number }[];
  stepEvents?: { triggerIndex: number; eventId: number; flag: number }[];
  chests: ChestDef[];
  units: ChapterUnitDef[];
  dialogues: DialogueSegment[][];
}

/** [startSec, channel, midiNote, velocity, durationSec, program] */
export type MusicNoteTuple = [number, number, number, number, number, number];

export interface MusicTrack {
  id: number;
  sourceIndex: number;
  name: string;
  duration: number;
  noteCount: number;
  notes: MusicNoteTuple[];
}

export interface BattleUnit {
  runtimeId: string;
  slotIndex: number;
  uid: number;
  baseHeroId?: number;
  nameZh: string;
  nameGlyphs: number[];
  classNameZh: string;
  portraitId: number;
  spriteGroup: number;
  faction: 'player' | 'enemy' | 'ally';
  classId: number;
  moveMode: 'foot' | 'cavalry' | 'fly';
  aiMode: number;
  aiTargetX: number;
  aiTargetY: number;
  aiChestIdx?: number;
  level: number;
  exp: number;
  x: number;
  y: number;
  renderX?: number;
  renderY?: number;
  hopOffsetY?: number;
  hidden?: boolean;
  dir: 0 | 1 | 2 | 3; // 0=down, 1=left, 2=up, 3=right
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  baseAp: number;
  baseDp: number;
  baseDx: number;
  mv: number;
  items: number[];
  equippedWeaponIdx: number;
  equippedArmorIdx: number;
  spells: number[];
  acted: boolean;
  moved: boolean;
  poisonTurns: number;
  paralyzeTurns: number;
  silenceTurns: number;
  apBuffTurns: number;
  dpBuffTurns: number;
  mvBuffTurns: number;
  isBoss: boolean;
  drop: { type: 'item' | 'gold' | 'event' | 'dialogue'; value: number } | null;
}

export interface CombatForecast {
  attackerHitPct: number;
  attackerDmg: number;
  attackerCritPct: number;
  canCounter: boolean;
  defenderHitPct: number;
  defenderDmg: number;
}

export interface CombatStrikeEvent {
  fromAttacker: boolean;
  hit: boolean;
  crit: boolean;
  damage: number;
  targetHpAfter: number;
  statusInflicted?: 'poison' | 'paralyze';
}

export interface LevelUpGain {
  newLevel: number;
  hp: number;
  mp: number;
  ap: number;
  dp: number;
  dx: number;
  learnedSpellIds: number[];
}

export interface CombatOutcome {
  attacker: BattleUnit;
  defender: BattleUnit;
  attackerStartHp: number;
  defenderStartHp: number;
  bgId: number;
  atkTaiId: number;
  defTaiId: number;
  isRangedAtk: boolean;
  strikes: CombatStrikeEvent[];
  expGained: number;
  levelUp: LevelUpGain | null;
  droppedReward: { type: 'item' | 'gold'; value: number } | null;
  droppedEventId?: number;
  droppedDialogueId?: number;
}

export interface PartyMemberSave {
  uid: number;
  baseHeroId?: number;
  nameZh?: string;
  nameGlyphs: number[];
  classNameZh?: string;
  portraitId: number;
  spriteGroup: number;
  classId: number;
  moveMode?: 'foot' | 'cavalry' | 'fly';
  level: number;
  exp: number;
  maxHp: number;
  maxMp: number;
  baseAp: number;
  baseDp: number;
  baseDx: number;
  mv: number;
  items: number[];
  spells: number[];
}

export interface SaveSlotData {
  version: number;
  timestamp: string;
  chapterId: number;
  gold: number;
  inBattle: boolean;
  note?: string;
  autoSaveKind?: 'camp' | 'turn';
  turn?: number;
  openedChests?: string[];
  triggeredEvents?: string[];
  chapterFlags?: number[];
  scheduledTurnEvents?: { slot?: number; turn: number; eventId: number; phase?: number }[];
  battleUnits?: BattleUnit[];
  party: PartyMemberSave[];
}

export interface SfxBanksPayload {
  sampleRate: number;
  samples: Record<string, string>;
  banks: Record<string, (string | null)[]>;
}

