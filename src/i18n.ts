import { GLYPHS_CN, GLYPHS_TW } from './glyphTable';
import type { BattleUnit, ChapterData, GameData, PartyMemberSave } from './types';

export type LocaleCode = 'zh-TW' | 'zh-CN' | 'en';

export interface LocaleMeta {
  code: LocaleCode;
  label: string;
  shortLabel: string;
}

export const SUPPORTED_LOCALES: LocaleMeta[] = [
  { code: 'zh-TW', label: '繁體中文', shortLabel: '繁中' },
  { code: 'zh-CN', label: '简体中文', shortLabel: '简中' },
  { code: 'en', label: 'English', shortLabel: 'EN' },
];

const LOCALE_STORAGE_KEY = 'fd2_locale';

let currentLocale: LocaleCode = (() => {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY) as LocaleCode | null;
    if (saved && SUPPORTED_LOCALES.some((l) => l.code === saved)) {
      return saved;
    }
  } catch {
    // ignore storage errors
  }
  return 'zh-TW';
})();

const localeListeners = new Set<(locale: LocaleCode) => void>();

export function getLocale(): LocaleCode {
  return currentLocale;
}

export function setLocale(locale: LocaleCode): void {
  if (currentLocale === locale) return;
  currentLocale = locale;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore
  }
  for (const fn of localeListeners) {
    fn(locale);
  }
}

export function onLocaleChange(fn: (locale: LocaleCode) => void): () => void {
  localeListeners.add(fn);
  return () => localeListeners.delete(fn);
}

export function tr(zhTw: string, zhCn: string, en: string, loc: LocaleCode = currentLocale): string {
  if (loc === 'zh-CN') return zhCn;
  if (loc === 'en') return en;
  return zhTw;
}

/** Decodes an array of 16-bit glyph IDs (`0..1823`) into a Traditional or Simplified Chinese string. */
export function decodeGlyphsToText(glyphs: number[], loc: LocaleCode = currentLocale): string {
  const table = loc === 'zh-CN' ? GLYPHS_CN : GLYPHS_TW;
  return glyphs.map((g) => table[g] ?? '').join('');
}

// 1. Races (1..10)
export const RACE_LOCALES: Record<number, [string, string, string]> = {
  1: ['人類', '人类', 'Human'],
  2: ['精靈', '精灵', 'Elf'],
  3: ['豹人', '豹人', 'Beastman'],
  4: ['龍人', '龙人', 'Dragonkin'],
  5: ['魔族', '魔族', 'Demon'],
  6: ['機械', '机械', 'Mecha'],
  7: ['元素', '元素', 'Elemental'],
  8: ['獸人', '兽人', 'Orc'],
  9: ['其他', '其他', 'Other'],
  10: ['龍', '龙', 'Dragon'],
};

// 2. Hero & Unit Classes (1..28) + Story NPC Class Labels
export const CLASS_LOCALES: Record<number, [string, string, string]> = {
  1: ['劍士', '剑士', 'Swordsman'],
  2: ['戰士', '战士', 'Warrior'],
  3: ['騎士', '骑士', 'Knight'],
  4: ['弓兵', '弓兵', 'Archer'],
  5: ['法師', '法师', 'Mage'],
  6: ['僧侶', '僧侣', 'Cleric'],
  7: ['盜賊', '盗贼', 'Thief'],
  8: ['武者', '武者', 'Monk'],
  9: ['劍聖', '剑圣', 'Sword Saint'],
  10: ['聖戰士', '圣战士', 'Paladin Warrior'],
  11: ['聖騎士', '圣骑士', 'Holy Knight'],
  12: ['狙擊手', '狙击手', 'Sniper'],
  13: ['大法師', '大法师', 'Archmage'],
  14: ['祭師', '祭师', 'High Priest'],
  15: ['龍劍士', '龙剑士', 'Dragon Swordsman'],
  16: ['鬥士', '斗士', 'Fighter'],
  17: ['英雄', '英雄', 'Hero'],
  18: ['魔戰士', '魔战士', 'Magic Warrior'],
  19: ['龍騎士', '龙骑士', 'Dragon Knight'],
  20: ['神射手', '神射手', 'Marksman'],
  21: ['召喚師', '召唤师', 'Summoner'],
  22: ['聖者', '圣者', 'Saint'],
  23: ['忍者', '忍者', 'Ninja'],
  24: ['武聖', '武圣', 'Martial Saint'],
  25: ['機兵', '机兵', 'Cyborg'],
  26: ['？？？', '？？？', '???'],
  27: ['村民', '村民', 'Villager'],
  28: ['魔戰士', '魔战士', 'Magic Warrior'],
};

const SPECIAL_CLASS_LABELS: Record<string, [string, string, string]> = {
  長老: ['長老', '长老', 'Elder'],
  國王: ['國王', '国王', 'King'],
  王族: ['王族', '王族', 'Royalty'],
  未使用: ['未使用', '未使用', 'Unused'],
  城鎮NPC: ['城鎮NPC', '城镇NPC', 'Town NPC'],
};

// 3. Base Playable Heroes (0..31)
export const HERO_LOCALES: Record<number, [string, string, string]> = {
  0: ['索爾', '索尔', 'Thor'],
  1: ['哈諾', '哈诺', 'Hano'],
  2: ['鐵諾', '铁诺', 'Tino'],
  3: ['哈瓦特', '哈瓦特', 'Hawat'],
  4: ['亞雷斯', '亚雷斯', 'Ares'],
  5: ['洛娜', '洛娜', 'Lorna'],
  6: ['萊汀', '莱汀', 'Raiden'],
  7: ['蘭斯洛特', '兰斯洛特', 'Lancelot'],
  8: ['希莉亞', '希莉亚', 'Celia'],
  9: ['悠妮', '悠妮', 'Uni'],
  10: ['瑪琳', '玛琳', 'Marin'],
  11: ['索菲亞', '索菲亚', 'Sophia'],
  12: ['凱麗', '凯丽', 'Kelly'],
  13: ['貝克威', '贝克威', 'Beckway'],
  14: ['珊', '珊', 'Shan'],
  15: ['塞可邦勒', '塞可邦勒', 'Secobang'],
  16: ['凱拉斯', '凯拉斯', 'Karas'],
  17: ['米亞斯多德', '米亚斯多德', 'Miastod'],
  18: ['蜜蒂', '蜜蒂', 'Midi'],
  19: ['羅德曼', '罗德曼', 'Rodman'],
  20: ['莎拉', '莎拉', 'Sarah'],
  21: ['約拿', '约拿', 'Jonah'],
  22: ['卡里斯', '卡里斯', 'Karis'],
  23: ['羅蘭', '罗兰', 'Roland'],
  24: ['希爾法', '希尔法', 'Sylpha'],
  25: ['謝多', '谢多', 'Shadow'],
  26: ['聖寇拉斯', '圣寇拉斯', 'St. Koulas'],
  27: ['巴拿羅西亞', '巴拿罗西亚', 'Banarossia'],
  28: ['達克塞', '达克塞', 'Darksey'],
  29: ['亞齊梅吉', '亚齐梅吉', 'Archmage'],
  30: ['蓋亞', '盖亚', 'Gaia'],
  31: ['渥德', '渥德', 'Ward'],
};

// 4. Full 0..135 Unit Dex Locales (Promoted slots 32..67 & Enemy/Ally/Boss/Town NPC slots 68..135)
export const UNIT_LOCALES: Record<number, [string, string, string]> = {
  ...HERO_LOCALES,
  32: HERO_LOCALES[0],
  33: HERO_LOCALES[1],
  34: HERO_LOCALES[2],
  35: HERO_LOCALES[3],
  36: HERO_LOCALES[4],
  37: HERO_LOCALES[5],
  38: HERO_LOCALES[6],
  39: ['賢者長老', '贤者长老', 'Sage Elder'],
  40: HERO_LOCALES[8],
  41: HERO_LOCALES[9],
  42: HERO_LOCALES[10],
  43: HERO_LOCALES[11],
  44: HERO_LOCALES[12],
  45: HERO_LOCALES[13],
  46: HERO_LOCALES[14],
  47: HERO_LOCALES[15],
  48: ['渥特王', '渥特王', 'King Walt'],
  49: HERO_LOCALES[17],
  50: HERO_LOCALES[0],
  51: HERO_LOCALES[1],
  52: HERO_LOCALES[9],
  53: HERO_LOCALES[3],
  54: HERO_LOCALES[4],
  55: HERO_LOCALES[5],
  56: HERO_LOCALES[6],
  57: ['保留空位#57', '保留空位#57', 'Reserved #57'],
  58: HERO_LOCALES[8],
  59: HERO_LOCALES[9],
  60: HERO_LOCALES[10],
  61: HERO_LOCALES[11],
  62: HERO_LOCALES[12],
  63: HERO_LOCALES[13],
  64: HERO_LOCALES[14],
  65: HERO_LOCALES[15],
  66: ['王后', '王后', 'Queen'],
  67: ['保留空位#67', '保留空位#67', 'Reserved #67'],
  68: ['士兵', '士兵', 'Soldier'],
  69: ['騎兵', '骑兵', 'Cavalry'],
  70: ['傭兵', '佣兵', 'Mercenary'],
  71: ['豹人', '豹人', 'Beastman'],
  72: ['精靈', '精灵', 'Elf'],
  73: ['龍人', '龙人', 'Dragonkin'],
  74: ['惡魔', '恶魔', 'Demon'],
  75: ['米蘭', '米兰', 'Milan'],
  76: ['士兵', '士兵', 'Soldier'],
  77: ['精英戰士', '精英战士', 'Elite Warrior'],
  78: ['鎧甲武士', '铠甲武士', 'Armored Samurai'],
  79: ['傭兵', '佣兵', 'Mercenary'],
  80: ['黑暗戰士', '黑暗战士', 'Dark Warrior'],
  81: ['狂戰士', '狂战士', 'Berserker'],
  82: ['騎兵', '骑兵', 'Cavalry'],
  83: ['突擊騎兵', '突击骑兵', 'Assault Cavalry'],
  84: ['地獄騎士', '地狱骑士', 'Hell Knight'],
  85: ['黑暗騎士', '黑暗骑士', 'Dark Knight'],
  86: ['龍騎士', '龙骑士', 'Dragon Knight'],
  87: ['弓箭手', '弓箭手', 'Archer'],
  88: ['黑暗射手', '黑暗射手', 'Dark Archer'],
  89: ['狙擊手', '狙击手', 'Sniper'],
  90: ['魔法師', '魔法师', 'Magician'],
  91: ['黑暗法師', '黑暗法师', 'Dark Mage'],
  92: ['巫師', '巫师', 'Sorcerer'],
  93: ['僧侶', '僧侣', 'Cleric'],
  94: ['黑暗僧侶', '黑暗僧侣', 'Dark Cleric'],
  95: ['大祭師', '大祭师', 'High Priest'],
  96: ['盜賊', '盗贼', 'Bandit'],
  97: ['盜賊頭目', '盗贼头目', 'Bandit Leader'],
  98: ['影之忍者', '影之忍者', 'Shadow Ninja'],
  99: ['黑暗殺手', '黑暗杀手', 'Dark Assassin'],
  100: ['武術家', '武术家', 'Martial Artist'],
  101: ['黑暗鬥士', '黑暗斗士', 'Dark Fighter'],
  102: ['獸人', '兽人', 'Orc'],
  103: ['獸人隊長', '兽人队长', 'Orc Captain'],
  104: ['火龍', '火龙', 'Fire Dragon'],
  105: ['雷龍', '雷龙', 'Thunder Dragon'],
  106: ['龍人戰士', '龙人战士', 'Dragonkin Warrior'],
  107: ['龍人法師', '龙人法师', 'Dragonkin Mage'],
  108: ['魔鬼', '魔鬼', 'Fiend'],
  109: ['惡魔', '恶魔', 'Demon'],
  110: ['大惡魔', '大恶魔', 'Archdemon'],
  111: ['機甲兵', '机甲兵', 'Mech Soldier'],
  112: ['機甲突擊兵', '机甲突击兵', 'Mech Trooper'],
  113: ['光束砲座', '光束炮座', 'Beam Turret'],
  114: ['機甲射手', '机甲射手', 'Mech Gunner'],
  115: ['機甲守衛', '机甲守卫', 'Mech Guard'],
  116: ['機甲隊長', '机甲队长', 'Mech Captain'],
  117: ['卡特那', '卡特那', 'Katana'],
  118: ['萊汀', '莱汀', 'Raiden'],
  119: ['薩卡', '萨卡', 'Saka'],
  120: ['瑪爾', '玛尔', 'Mal'],
  121: ['沼澤怪物', '沼泽怪物', 'Swamp Monster'],
  122: ['地魔神', '地魔神', 'Earth Demon God'],
  123: ['水魔神', '水魔神', 'Water Demon God'],
  124: ['風魔神', '风魔神', 'Wind Demon God'],
  125: ['火魔神', '火魔神', 'Fire Demon God'],
  126: ['空魔神', '空魔神', 'Void Demon God'],
  127: ['暗黑龍', '暗黑龙', 'Dark Dragon'],
  128: ['武器店老闆', '武器店老板', 'Armorer'],
  129: ['酒店女郎', '酒店女郎', 'Tavern Hostess'],
  130: ['道具店店員', '道具店店员', 'Item Shop Clerk'],
  131: ['教會神父', '教会神父', 'Church Priest'],
  132: ['秘密商人', '秘密商人', 'Secret Merchant'],
  133: ['女村民', '女村民', 'Villager (F)'],
  134: ['男村民', '男村民', 'Villager (M)'],
  135: ['卡納恩三世', '卡纳恩三世', 'Canaan III'],
};

// 5. Spells & Special Techniques (0..35)
export const SPELL_LOCALES: Record<number, [string, string, string]> = {
  0: ['火炎術', '火炎术', 'Fireball'],
  1: ['烈炎術', '烈炎术', 'Blaze'],
  2: ['炎龍術', '炎龙术', 'Flame Dragon'],
  3: ['天火術', '天火术', "Heaven's Fire"],
  4: ['電擊術', '电击术', 'Lightning'],
  5: ['落雷術', '落雷术', 'Thunderbolt'],
  6: ['轟雷術', '轰雷术', 'Thunderstorm'],
  7: ['神雷術', '神雷术', 'Divine Thunder'],
  8: ['聖光彈', '圣光弹', 'Holy Bolt'],
  9: ['咒殺術', '咒杀术', 'Death Curse'],
  10: ['碎岩術', '碎岩术', 'Rock Crush'],
  11: ['地震術', '地震术', 'Earthquake'],
  12: ['裂地術', '裂地术', 'Earth Rend'],
  13: ['治療術', '治疗术', 'Heal'],
  14: ['回復術', '回复术', 'Recover'],
  15: ['再生術', '再生术', 'Regenerate'],
  16: ['神恩術', '神恩术', 'Divine Grace'],
  17: ['魔刃術', '魔刃术', 'Magic Blade'],
  18: ['魔鎧術', '魔铠术', 'Magic Armor'],
  19: ['風行術', '风行术', 'Wind Walk'],
  20: ['解毒術', '解毒术', 'Detoxify'],
  21: ['祛麻術', '祛麻术', 'Cure Paralysis'],
  22: ['封咒術', '封咒术', 'Silence'],
  23: ['傳送術', '传送术', 'Teleport'],
  24: ['破龍擊', '破龙击', 'Dragon Slayer'],
  25: ['行動術', '行动术', 'Act Again'],
  26: ['毒擊術', '毒击术', 'Venom Strike'],
  27: ['麻痺術', '麻痹术', 'Paralyze'],
  28: ['淒煌斬', '凄煌斩', 'Radiant Slash'],
  29: ['熾炎刀', '炽炎刀', 'Blazing Edge'],
  30: ['音速刃', '音速刃', 'Sonic Blade'],
  31: ['（保留）', '（保留）', '(Reserved)'],
  32: ['熾天使', '炽天使', 'Seraphim'],
  33: ['風妖精', '风妖精', 'Wind Sylph'],
  34: ['破壞神', '破坏神', 'God of Destruction'],
  35: ['暗邪鬼', '暗邪鬼', 'Dark Fiend'],
};

// 6. All 215 Items (0..214)
export const ITEM_LOCALES: Record<number, [string, string, string]> = {
  0: ['短劍', '短剑', 'Short Sword'],
  1: ['闊劍', '阔剑', 'Broadsword'],
  2: ['長劍', '长剑', 'Longsword'],
  3: ['巨劍', '巨剑', 'Greatsword'],
  4: ['黑暗劍', '黑暗剑', 'Dark Sword'],
  5: ['戰士劍', '战士剑', 'Warrior Sword'],
  6: ['巨魔劍', '巨魔剑', 'Troll Sword'],
  7: ['斬鐵劍', '斩铁剑', 'Ironcutter'],
  8: ['流水劍', '流水剑', 'Flowing Blade'],
  9: ['大地之劍', '大地之剑', 'Earth Sword'],
  10: ['龍神劍', '龙神剑', 'Dragon God Sword'],
  11: ['炎龍劍', '炎龙剑', 'Flame Dragon Sword'],
  12: ['小刀', '小刀', 'Pocket Knife'],
  13: ['匕首', '匕首', 'Dagger'],
  14: ['淬毒刀', '淬毒刀', 'Poison Dagger'],
  15: ['盜賊匕首', '盗贼匕首', 'Thief Dagger'],
  16: ['暗殺刀', '暗杀刀', 'Assassin Blade'],
  17: ['護手刀', '护手刀', 'Guard Dagger'],
  18: ['忍者刀', '忍者刀', 'Ninja Blade'],
  19: ['地獄刀', '地狱刀', 'Hell Blade'],
  20: ['刺矛', '刺矛', 'Spear'],
  21: ['騎槍', '骑枪', 'Lance'],
  22: ['長戟', '长戟', 'Halberd'],
  23: ['先鋒矛', '先锋矛', 'Vanguard Spear'],
  24: ['斬馬刀', '斩马刀', 'Zhanmadao'],
  25: ['惡魔之矛', '恶魔之矛', 'Demon Spear'],
  26: ['黃金之戟', '黄金之戟', 'Golden Halberd'],
  27: ['龍之槍', '龙之枪', 'Dragon Lance'],
  28: ['破魔槍', '破魔枪', 'Spellbreaker Lance'],
  29: ['戰神戟', '战神戟', 'War God Halberd'],
  30: ['聖之槍', '圣之枪', 'Holy Lance'],
  31: ['巨神戟', '巨神戟', 'Titan Halberd'],
  32: ['手斧', '手斧', 'Hand Axe'],
  33: ['迴旋斧', '回旋斧', 'Boomerang Axe'],
  34: ['戰斧', '战斧', 'Battle Axe'],
  35: ['戰鎚', '战锤', 'Warhammer'],
  36: ['巨斧', '巨斧', 'Greataxe'],
  37: ['血之斧', '血之斧', 'Blood Axe'],
  38: ['閃雷鎚', '闪雷锤', 'Thunder Hammer'],
  39: ['狂暴之斧', '狂暴之斧', 'Berserk Axe'],
  40: ['光之斧', '光之斧', 'Light Axe'],
  41: ['力量之斧', '力量之斧', 'Power Axe'],
  42: ['大地之鎚', '大地之锤', 'Earth Hammer'],
  43: ['魔神斧', '魔神斧', 'Demon God Axe'],
  44: ['短弓', '短弓', 'Shortbow'],
  45: ['長弓', '长弓', 'Longbow'],
  46: ['黑暗弓', '黑暗弓', 'Dark Bow'],
  47: ['巨弓', '巨弓', 'Greatbow'],
  48: ['精靈弓', '精灵弓', 'Elven Bow'],
  49: ['狙擊弓', '狙击弓', 'Sniper Bow'],
  50: ['封魔弓', '封魔弓', 'Silence Bow'],
  51: ['風神弓', '风神弓', 'Wind God Bow'],
  52: ['長棍', '长棍', 'Quarterstaff'],
  53: ['釘頭鎚', '钉头锤', 'Mace'],
  54: ['巨鎚', '巨锤', 'Great Maul'],
  55: ['槤枷', '连枷', 'Flail'],
  56: ['魔法杖', '魔法杖', 'Magic Staff'],
  57: ['封咒杖', '封咒杖', 'Silence Staff'],
  58: ['力之杖', '力之杖', 'Power Staff'],
  59: ['黑暗杖', '黑暗杖', 'Dark Staff'],
  60: ['龍之杖', '龙之杖', 'Dragon Staff'],
  61: ['光之杖', '光之杖', 'Staff of Light'],
  62: ['鐵指套', '铁指套', 'Brass Knuckles'],
  63: ['鐵爪', '铁爪', 'Iron Claws'],
  64: ['皇帝指環', '皇帝指环', 'Emperor Ring'],
  65: ['毒爪', '毒爪', 'Venom Claws'],
  66: ['殭屍爪', '僵尸爪', 'Zombie Claws'],
  67: ['碎岩爪', '碎岩爪', 'Rockcrusher Claws'],
  68: ['金鋼指環', '金刚指环', 'Vajra Knuckles'],
  69: ['裂刃爪', '裂刃爪', 'Rending Claws'],
  70: ['巨神指環', '巨神指环', 'Titan Knuckles'],
  71: ['魔龍爪', '魔龙爪', 'Demon Dragon Claws'],
  72: ['威力手臂', '威力手臂', 'Power Arm'],
  73: ['金鋼手臂', '金刚手臂', 'Vajra Arm'],
  74: ['雷神手臂', '雷神手臂', 'Thunder God Arm'],
  75: ['衝擊手臂', '冲击手臂', 'Impact Arm'],
  76: ['光束劍', '光束剑', 'Beam Saber'],
  77: ['狙擊槍', '狙击枪', 'Sniper Rifle'],
  78: ['光束槍', '光束枪', 'Beam Rifle'],
  79: ['光束炮', '光束炮', 'Beam Cannon'],
  80: ['拳頭', '拳头', 'Fist'],
  81: ['利爪', '利爪', 'Sharp Claws'],
  82: ['觸手', '触手', 'Tentacle'],
  83: ['巨岩手臂', '巨岩手臂', 'Boulder Arm'],
  84: ['激水炮', '激水炮', 'Hydro Cannon'],
  85: ['風牙斬', '风牙斩', 'Wind Fang'],
  86: ['魔燄波', '魔焰波', 'Hellfire Wave'],
  87: ['空雷震', '空雷震', 'Void Thunder'],
  88: ['聖者之戒', '圣者之戒', "Saint's Ring"],
  89: ['勇者徽章', '勇者徽章', "Hero's Crest"],
  90: ['精靈契印', '精灵契印', 'Spirit Pact'],
  91: ['領悟之書', '领悟之书', 'Tome of Enlightenment'],
  92: ['心眼之書', '心眼之书', "Tome of Mind's Eye"],
  93: ['白金徽章', '白金徽章', 'Platinum Crest'],
  94: ['生命之實', '生命之实', 'Fruit of Life'],
  95: ['魔力水晶', '魔力水晶', 'Mana Crystal'],
  96: ['風精之羽', '风精之羽', 'Sylph Feather'],
  97: ['十字弓', '十字弓', 'Crossbow'],
  98: ['水晶弓', '水晶弓', 'Crystal Bow'],
  99: ['雷神鞭', '雷神鞭', 'Thunder Whip'],
  100: ['天空之鑰', '天空之钥', 'Sky Key'],
  101: ['傳送法杖', '传送法杖', 'Warp Staff'],
  102: ['修理套件', '修理套件', 'Repair Kit'],
  103: ['火燄', '火焰', 'Flame Breath'],
  104: ['火神弓', '火神弓', 'Fire God Bow'],
  105: ['鬥神指環', '斗神指环', 'Battle God Ring'],
  106: ['冰燄', '冰焰', 'Frost Breath'],
  107: ['黑暗波', '黑暗波', 'Dark Wave'],
  123: ['巨岩鎧', '巨岩铠', 'Boulder Armor'],
  124: ['魔神甲', '魔神甲', 'Demon God Armor'],
  125: ['11', '11', '11'],
  126: ['22', '22', '22'],
  127: ['魔岩鎧', '魔岩铠', 'Demon Rock Armor'],
  128: ['布衣', '布衣', 'Cloth Tunic'],
  129: ['旅行裝', '旅行装', "Traveler's Garb"],
  130: ['精靈披風', '精灵披风', 'Elven Cloak'],
  131: ['元素護體', '元素护体', 'Elemental Ward'],
  132: ['皮甲', '皮甲', 'Leather Armor'],
  133: ['硬皮甲', '硬皮甲', 'Hard Leather'],
  134: ['夜行裝', '夜行装', 'Night Garb'],
  135: ['魔法皮甲', '魔法皮甲', 'Magic Leather'],
  136: ['盜賊之衣', '盗贼之衣', "Thief's Garb"],
  137: ['忍者裝', '忍者装', 'Ninja Suit'],
  138: ['潛行服', '潜行服', 'Stealth Suit'],
  139: ['神祕裝', '神秘装', 'Mystic Garb'],
  140: ['暗殺服', '暗杀服', 'Assassin Garb'],
  141: ['黑暗之衣', '黑暗之衣', 'Dark Garb'],
  142: ['惡魔皮甲', '恶魔皮甲', 'Demon Leather'],
  143: ['雷神服', '雷神服', 'Thunder Garb'],
  144: ['環狀甲', '环状甲', 'Ring Mail'],
  145: ['鎖子甲', '锁子甲', 'Chainmail'],
  146: ['鱗甲', '鳞甲', 'Scale Mail'],
  147: ['連環鋼甲', '连环钢甲', 'Steel Chainmail'],
  148: ['合金鎖甲', '合金锁甲', 'Alloy Chainmail'],
  149: ['魔法鱗甲', '魔法鳞甲', 'Magic Scale Mail'],
  150: ['血環甲', '血环甲', 'Blood Ring Mail'],
  151: ['金鋼鎖甲', '金刚锁甲', 'Vajra Chainmail'],
  152: ['黑暗鱗甲', '黑暗鳞甲', 'Dark Scale Mail'],
  153: ['力量鎖甲', '力量锁甲', 'Power Chainmail'],
  154: ['惡魔鱗甲', '恶魔鳞甲', 'Demon Scale Mail'],
  155: ['龍鱗甲', '龙鳞甲', 'Dragon Scale Mail'],
  156: ['鎧甲', '铠甲', 'Plate Armor'],
  157: ['銀鎧甲', '银铠甲', 'Silver Armor'],
  158: ['魔法鎧甲', '魔法铠甲', 'Magic Armor'],
  159: ['重鎧甲', '重铠甲', 'Heavy Armor'],
  160: ['地獄鎧甲', '地狱铠甲', 'Hell Armor'],
  161: ['聖鎧甲', '圣铠甲', 'Holy Armor'],
  162: ['大地鎧甲', '大地铠甲', 'Earth Armor'],
  163: ['龍神鎧甲', '龙神铠甲', 'Dragon God Armor'],
  164: ['長袍', '长袍', 'Robe'],
  165: ['法師袍', '法师袍', 'Mage Robe'],
  166: ['僧侶袍', '僧侣袍', 'Cleric Vestment'],
  167: ['祭司袍', '祭司袍', 'Priest Robe'],
  168: ['聖者袍', '圣者袍', "Saint's Robe"],
  169: ['霧之袍', '雾之袍', 'Mist Robe'],
  170: ['黑暗之袍', '黑暗之袍', 'Dark Robe'],
  171: ['天之袍', '天之袍', 'Celestial Robe'],
  172: ['武道服', '武道服', 'Martial Gi'],
  173: ['武鬥裝', '武斗装', 'Combat Gi'],
  174: ['鬥士服', '斗士服', 'Fighter Gi'],
  175: ['武者鎧甲', '武者铠甲', 'Monk Armor'],
  176: ['妖魔鬥服', '妖魔斗服', 'Fiend Gi'],
  177: ['武神護甲', '武神护甲', 'Martial God Armor'],
  178: ['戰鬥裝甲', '战斗装甲', 'Combat Frame'],
  179: ['突擊裝甲', '突击装甲', 'Assault Frame'],
  180: ['重裝甲', '重装甲', 'Heavy Frame'],
  181: ['特殊裝甲', '特殊装甲', 'Special Frame'],
  182: ['硬皮', '硬皮', 'Tough Hide'],
  183: ['青色硬皮', '青色硬皮', 'Azure Hide'],
  184: ['龍鱗', '龙鳞', 'Dragon Scales'],
  185: ['軟皮', '软皮', 'Soft Hide'],
  186: ['虛無護甲', '虚无护甲', 'Void Armor'],
  187: ['王袍', '王袍', 'Royal Robe'],
  188: ['鬥士護甲', '斗士护甲', 'Gladiator Armor'],
  189: ['地之袍', '地之袍', 'Earth Robe'],
  190: ['水之袍', '水之袍', 'Water Robe'],
  191: ['大地裝甲', '大地装甲', 'Gaia Frame'],
  192: ['藥草', '药草', 'Herb'],
  193: ['回復劑', '回复剂', 'Healing Potion'],
  194: ['再生藥', '再生药', 'Elixir of Life'],
  195: ['神聖之水', '神圣之水', 'Holy Water'],
  196: ['解毒劑', '解毒剂', 'Antidote'],
  197: ['退麻劑', '退麻剂', 'Paralysis Cure'],
  198: ['力量藥水', '力量药水', 'Power Potion'],
  199: ['耐力藥水', '耐力药水', 'Endurance Potion'],
  200: ['速度藥水', '速度药水', 'Speed Potion'],
  201: ['綠寶石', '绿宝石', 'Emerald'],
  202: ['紅寶石', '红宝石', 'Ruby'],
  203: ['藍寶石', '蓝宝石', 'Sapphire'],
  204: ['鑽石', '钻石', 'Diamond'],
  205: ['飛龍卵', '飞龙卵', 'Wyvern Egg'],
  206: ['魔法水', '魔法水', 'Magic Water'],
  207: ['水晶粒', '水晶粒', 'Crystal Shard'],
  208: ['控制中樞', '控制中枢', 'Control Core'],
  209: ['黃金徽章', '黄金徽章', 'Golden Crest'],
  210: ['星之眼', '星之眼', 'Eye of Star'],
  211: ['光之眼', '光之眼', 'Eye of Light'],
  212: ['暗之眼', '暗之眼', 'Eye of Darkness'],
  213: ['冰之眼', '冰之眼', 'Eye of Ice'],
  214: ['火之眼', '火之眼', 'Eye of Fire'],
};

// 7. All 33 Chapters (0..32) — Title, Victory Condition, Defeat Condition
export interface ChapterLocaleInfo {
  title: [string, string, string];
  win: [string, string, string];
  lose: [string, string, string];
}

const WIN_ROUT: [string, string, string] = ['敵軍全滅', '敌军全灭', 'Rout all enemies'];
const LOSE_THOR: [string, string, string] = ['索爾死亡', '索尔死亡', 'Thor falls in battle'];
const LOSE_THOR_UNI: [string, string, string] = ['索爾或悠妮死亡', '索尔或悠妮死亡', 'Thor or Uni falls in battle'];

export const CHAPTER_LOCALES: Record<number, ChapterLocaleInfo> = {
  0: { title: ['孤島', '孤岛', 'Isolated Island'], win: WIN_ROUT, lose: LOSE_THOR },
  1: {
    title: ['羅德鎮', '罗德镇', 'Rhodes Town'],
    win: WIN_ROUT,
    lose: ['索爾死亡、村民全滅', '索尔死亡、村民全灭', 'Thor falls or all villagers perish'],
  },
  2: { title: ['往塞拉村途中', '往塞拉村途中', 'Road to Sera Village'], win: WIN_ROUT, lose: LOSE_THOR },
  3: { title: ['塞拉村前', '塞拉村前', 'Before Sera Village'], win: WIN_ROUT, lose: LOSE_THOR },
  4: { title: ['塞拉村', '塞拉村', 'Sera Village'], win: WIN_ROUT, lose: LOSE_THOR },
  5: { title: ['普里茲港', '普里兹港', 'Port Priz'], win: WIN_ROUT, lose: LOSE_THOR },
  6: { title: ['往王城的途中', '往王城的途中', 'Road to the Royal Capital'], win: WIN_ROUT, lose: LOSE_THOR },
  7: { title: ['王城前的戰鬥', '王城前的战斗', 'Battle Before the Capital'], win: WIN_ROUT, lose: LOSE_THOR },
  8: { title: ['騎士的抉擇', '骑士的抉择', "A Knight's Choice"], win: WIN_ROUT, lose: LOSE_THOR },
  9: {
    title: ['洞窟中的激戰', '洞窟中的激战', 'Fierce Battle in the Cavern'],
    win: WIN_ROUT,
    lose: ['索爾、索菲亞或卡納恩三世死亡', '索尔、索菲亚或卡纳恩三世死亡', 'Thor, Sophia, or Canaan III falls'],
  },
  10: { title: ['幻之森林', '幻之森林', 'Forest of Illusion'], win: WIN_ROUT, lose: LOSE_THOR },
  11: {
    title: ['北山道', '北山道', 'Northern Mountain Pass'],
    win: WIN_ROUT,
    lose: ['索爾或米亞斯多德死亡', '索尔或米亚斯多德死亡', 'Thor or Miastod falls'],
  },
  12: {
    title: ['哈斯米爾之戰', '哈斯米尔之战', 'Battle of Hasmir'],
    win: WIN_ROUT,
    lose: ['索爾死亡、精靈族全滅', '索尔死亡、精灵族全灭', 'Thor falls or all Elves perish'],
  },
  13: { title: ['平原的會戰', '平原的会战', 'Clash on the Plains'], win: WIN_ROUT, lose: LOSE_THOR },
  14: {
    title: ['拉卡湖的激戰', '拉卡湖的激战', 'Battle of Lake Laka'],
    win: WIN_ROUT,
    lose: ['索爾或塞可邦勒死亡', '索尔或塞可邦勒死亡', 'Thor or Secobang falls'],
  },
  15: {
    title: ['冰原之戰', '冰原之战', 'Battle on the Icefield'],
    win: WIN_ROUT,
    lose: ['索爾或蜜蒂死亡', '索尔或蜜蒂死亡', 'Thor or Midi falls'],
  },
  16: { title: ['血與冰之刃', '血与冰之刃', 'Blade of Blood and Ice'], win: WIN_ROUT, lose: LOSE_THOR },
  17: {
    title: ['遙遠的彼岸', '遥远的彼岸', 'The Distant Shore'],
    win: ['黑暗騎士死亡', '黑暗骑士死亡', 'Defeat the Dark Knight'],
    lose: ['索爾、約拿或蘭斯洛特死亡', '索尔、约拿或兰斯洛特死亡', 'Thor, Jonah, or Lancelot falls'],
  },
  18: {
    title: ['黑暗中的狙擊', '黑暗中的狙击', 'Ambush in the Dark'],
    win: WIN_ROUT,
    lose: ['索爾或巴拿羅西亞死亡', '索尔或巴拿罗西亚死亡', 'Thor or Banarossia falls'],
  },
  19: {
    title: ['死亡般的沈寂', '死亡般的沉寂', 'Deathly Silence'],
    win: ['沼澤怪物之外的敵人全滅', '沼泽怪物之外的敌人全灭', 'Rout all enemies except Swamp Monsters'],
    lose: ['索爾、謝多死亡或精靈全滅', '索尔、谢多死亡或精灵全灭', 'Thor or Shadow falls, or all Elves perish'],
  },
  20: {
    title: ['亞述森林', '亚述森林', 'Assur Forest'],
    win: WIN_ROUT,
    lose: ['索爾、羅蘭或希爾法死亡', '索尔、罗兰或希尔法死亡', 'Thor, Roland, or Sylpha falls'],
  },
  21: {
    title: ['遠古的呼喚', '远古的呼唤', 'Call of the Ancients'],
    win: WIN_ROUT,
    lose: ['索爾或希爾法死亡', '索尔或希尔法死亡', 'Thor or Sylpha falls'],
  },
  22: {
    title: ['向天空之旅', '向天空之旅', 'Journey to the Sky'],
    win: ['擊敗機甲隊長', '击败机甲队长', 'Defeat the Mech Captain'],
    lose: ['索爾、希爾法、卡里斯或羅德曼死亡', '索尔、希尔法、卡里斯或罗德曼死亡', 'Thor, Sylpha, Karis, or Rodman falls'],
  },
  23: { title: ['在天空的彼方', '在天空的彼方', 'Beyond the Sky'], win: WIN_ROUT, lose: LOSE_THOR },
  24: {
    title: ['火焰的審判', '火焰的审判', 'Trial by Fire'],
    win: WIN_ROUT,
    lose: ['索爾或聖寇拉斯死亡', '索尔或圣寇拉斯死亡', 'Thor or St. Koulas falls'],
  },
  25: {
    title: ['未知的迴廊', '未知的回廊', 'Corridor of the Unknown'],
    win: WIN_ROUT,
    lose: ['索爾、悠妮或亞齊梅吉死亡', '索尔、悠妮或亚齐梅吉死亡', 'Thor, Uni, or Archmage falls'],
  },
  26: {
    title: ['命運的交會點', '命运的交会点', 'Crossroads of Destiny'],
    win: ['擊敗機甲隊長', '击败机甲队长', 'Defeat the Mech Captain'],
    lose: LOSE_THOR_UNI,
  },
  27: {
    title: ['探索者', '探索者', 'The Seekers'],
    win: ['擊敗機甲隊長', '击败机甲队长', 'Defeat the Mech Captain'],
    lose: LOSE_THOR_UNI,
  },
  28: {
    title: ['無邊的黑暗之中', '无边的黑暗之中', 'In Boundless Darkness'],
    win: ['解除防衛系統', '解除防卫系统', 'Disable the Defense System'],
    lose: LOSE_THOR_UNI,
  },
  29: {
    title: ['傳說的終章', '传说的终章', 'Finale of the Legend'],
    win: ['空魔神死亡', '空魔神死亡', 'Defeat the Void Demon God'],
    lose: LOSE_THOR_UNI,
  },
  30: { title: ['終章・王城凱旋', '终章・王城凯旋', 'Epilogue: Royal Triumph'], win: WIN_ROUT, lose: LOSE_THOR },
  31: { title: ['序幕(二)・森林啟程', '序幕(二)・森林启程', 'Prologue II: Forest Departure'], win: WIN_ROUT, lose: LOSE_THOR },
  32: { title: ['序幕(一)・王城啟程', '序幕(一)・王城启程', 'Prologue I: Royal Departure'], win: WIN_ROUT, lose: LOSE_THOR },
};

// 8. Terrain Locales
export const TERRAIN_LOCALES: Record<number, [string, string, string]> = {
  0: ['平原', '平原', 'Plains'],
  1: ['黑曜地面', '黑曜地面', 'Obsidian Floor'],
  2: ['森林', '森林', 'Forest'],
  3: ['樹林 / 柱群', '树林 / 柱群', 'Woods / Pillars'],
  4: ['高山 / 岩壁', '高山 / 岩壁', 'Cliff / Wall'],
  5: ['水域 / 建築', '水域 / 建筑', 'Water / Building'],
};

export function getLocalizedUnitName(uid: number, fallback = ''): string {
  const entry = UNIT_LOCALES[uid];
  if (entry) return tr(entry[0], entry[1], entry[2]);
  return fallback || `#${uid}`;
}

export function getLocalizedClassName(classId: number, fallback = ''): string {
  const entry = CLASS_LOCALES[classId];
  if (entry) return tr(entry[0], entry[1], entry[2]);
  if (fallback && SPECIAL_CLASS_LABELS[fallback]) {
    const sp = SPECIAL_CLASS_LABELS[fallback];
    return tr(sp[0], sp[1], sp[2]);
  }
  return fallback;
}

export function getLocalizedRaceName(raceId: number, fallback = ''): string {
  const entry = RACE_LOCALES[raceId];
  if (entry) return tr(entry[0], entry[1], entry[2]);
  return fallback;
}

export function getLocalizedItemName(itemId: number, fallback = ''): string {
  const entry = ITEM_LOCALES[itemId];
  if (entry) return tr(entry[0], entry[1], entry[2]);
  return fallback;
}

export function getLocalizedSpellName(spellId: number, fallback = ''): string {
  const entry = SPELL_LOCALES[spellId];
  if (entry) return tr(entry[0], entry[1], entry[2]);
  return fallback;
}

export function getLocalizedChapterTitle(chapterId: number, fallback = ''): string {
  const entry = CHAPTER_LOCALES[chapterId];
  if (entry) return tr(entry.title[0], entry.title[1], entry.title[2]);
  return fallback;
}

export function getLocalizedChapterWin(chapterId: number, fallback = ''): string {
  const entry = CHAPTER_LOCALES[chapterId];
  if (entry) return tr(entry.win[0], entry.win[1], entry.win[2]);
  return fallback || tr('敵軍全滅', '敌军全灭', 'Rout all enemies');
}

export function getLocalizedChapterLose(chapterId: number, fallback = ''): string {
  const entry = CHAPTER_LOCALES[chapterId];
  if (entry) return tr(entry.lose[0], entry.lose[1], entry.lose[2]);
  return fallback || tr('索爾死亡', '索尔死亡', 'Thor falls in battle');
}

export function getLocalizedSpeakerName(speakerId: number | null, fallbackZh = ''): string {
  if (speakerId === null || speakerId < 0) {
    return tr('旁白', '旁白', 'Narrator');
  }
  if (speakerId === 53 && fallbackZh.includes('將')) {
    return tr('帝國將軍', '帝国将军', 'Imperial General');
  }
  return getLocalizedUnitName(speakerId, fallbackZh);
}

/**
 * Applies the active locale in-place to `gameData`, any active `ChapterData`,
 * live `BattleUnit[]`, and `PartyMemberSave[]`, so all downstream rendering
 * (`u.nameZh`, `it.nameZh`, `sp.nameZh`, `ch.titleZh`) reflects the selected language immediately.
 */
export function applyLocaleToGameState(
  gameData: GameData,
  activeChapter?: ChapterData | null,
  battleUnits?: BattleUnit[],
  party?: PartyMemberSave[]
): void {
  if (!gameData) return;

  for (const r of gameData.races ?? []) {
    r.nameZh = getLocalizedRaceName(r.id, r.nameZh);
  }
  for (const hc of gameData.heroClasses ?? []) {
    hc.nameZh = getLocalizedClassName(hc.id, hc.nameZh);
  }
  for (const ec of gameData.enemyClasses ?? []) {
    const uid = 68 + ec.id;
    ec.nameZh = getLocalizedUnitName(uid, ec.nameZh);
  }
  for (const it of gameData.items ?? []) {
    if (ITEM_LOCALES[it.id]) {
      it.nameZh = getLocalizedItemName(it.id, it.nameZh);
    }
  }
  for (const sp of gameData.spells ?? []) {
    if (SPELL_LOCALES[sp.id]) {
      sp.nameZh = getLocalizedSpellName(sp.id, sp.nameZh);
    }
  }
  for (const u of gameData.unitDex ?? []) {
    u.nameZh = getLocalizedUnitName(u.id, u.nameZh);
    u.raceZh = getLocalizedRaceName(u.raceId, u.raceZh);
    // Find matching class ID if hero/promoted
    const matchingClass = (gameData.heroClasses ?? []).find(
      (c) => JSON.stringify(c.nameGlyphs) === JSON.stringify(u.classGlyphs)
    );
    if (matchingClass) {
      u.classNameZh = getLocalizedClassName(matchingClass.id, u.classNameZh);
    } else if (u.id === 39) {
      u.classNameZh = tr('長老', '长老', 'Elder');
    } else if (u.id === 48) {
      u.classNameZh = tr('國王', '国王', 'King');
    } else if (u.id === 66) {
      u.classNameZh = tr('王族', '王族', 'Royalty');
    } else if (u.id === 57 || u.id === 67) {
      u.classNameZh = tr('未使用', '未使用', 'Unused');
    } else if (u.id >= 128 && u.id <= 132) {
      u.classNameZh = tr('城鎮NPC', '城镇NPC', 'Town NPC');
    } else if (u.id === 133 || u.id === 134) {
      u.classNameZh = getLocalizedClassName(27, u.classNameZh);
    } else if (u.id >= 68) {
      u.classNameZh = getLocalizedUnitName(u.id, u.classNameZh);
    }
  }
  for (const h of gameData.heroes ?? []) {
    h.nameZh = getLocalizedUnitName(h.id, h.nameZh);
    h.raceZh = getLocalizedRaceName(h.race, h.raceZh);
    h.classNameZh = getLocalizedClassName(h.classId, h.classNameZh);
    for (const p of h.promotions ?? []) {
      p.classNameZh = getLocalizedClassName(p.heroClassId, p.classNameZh);
      if (p.reqItemId && p.reqItemId > 0) {
        p.reqItemNameZh = getLocalizedItemName(p.reqItemId, p.reqItemNameZh ?? '');
      }
    }
  }
  for (const ch of gameData.chapters ?? []) {
    ch.titleZh = getLocalizedChapterTitle(ch.id, ch.titleZh);
  }

  if (activeChapter) {
    activeChapter.titleZh = getLocalizedChapterTitle(activeChapter.id, activeChapter.titleZh);
    for (const cu of activeChapter.units ?? []) {
      cu.nameZh = getLocalizedUnitName(cu.uid, cu.nameZh);
      cu.classNameZh = getLocalizedClassName(cu.classId, cu.classNameZh);
    }
    for (const dlgEntry of activeChapter.dialogues ?? []) {
      for (const seg of dlgEntry ?? []) {
        seg.speakerNameZh = getLocalizedSpeakerName(seg.speaker, seg.speakerNameZh ?? '');
      }
    }
  }

  if (battleUnits) {
    for (const bu of battleUnits) {
      bu.nameZh = getLocalizedUnitName(bu.uid, bu.nameZh);
      bu.classNameZh = getLocalizedClassName(bu.classId, bu.classNameZh);
    }
  }

  if (party) {
    for (const pm of party) {
      pm.nameZh = getLocalizedUnitName(pm.uid, pm.nameZh ?? '');
      pm.classNameZh = getLocalizedClassName(pm.classId, pm.classNameZh ?? '');
    }
  }
}
