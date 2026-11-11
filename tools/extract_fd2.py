#!/usr/bin/env python3
"""
Flame Dragon II (炎龍騎士團II：黃金城之謎) — Verified Binary Asset & Mapping Extractor
Reads original 1995 DOS archives from ../fd2 (using clean FD2.EXE + .DAT/.B24 archives;
ignores FD2.EX_) and outputs web-ready PNG atlases, verified character/image mappings
(character_dex.json & gamedata.json), 33 chapters, dialogues, and XMI music into public/assets/.
"""

import base64
import hashlib
import json
import shutil
import struct
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FD2_DIR = (ROOT.parent / "fd2").resolve()
OUT_DIR = ROOT / "public" / "assets"

# Verified UTF-8 Traditional Chinese transcriptions matching FDTXT.DAT Bank 0 glyph strings
HERO_NAMES_ZH = [
    "索爾", "哈諾", "鐵諾", "哈瓦特", "亞雷斯", "洛娜", "萊汀", "蘭斯洛特",
    "希莉亞", "悠妮", "瑪琳", "索菲亞", "凱麗", "貝克威", "珊", "塞可邦勒",
    "凱拉斯", "米亞斯多德", "蜜蒂", "羅德曼", "莎拉", "約拿", "卡里斯", "羅蘭",
    "希爾法", "謝多", "聖寇拉斯", "巴拿羅西亞", "達克塞", "亞齊梅吉", "蓋亞", "渥德",
]

RACE_NAMES_ZH = {
    1: "人類", 2: "精靈", 3: "豹人", 4: "龍人", 5: "魔族",
    6: "機械", 7: "元素", 8: "獸人", 9: "其他", 10: "龍",
}

HERO_CLASS_NAMES_ZH = {
    1: "劍士", 2: "戰士", 3: "騎士", 4: "弓兵", 5: "法師", 6: "僧侶", 7: "盜賊", 8: "武者",
    9: "劍聖", 10: "聖戰士", 11: "聖騎士", 12: "狙擊手", 13: "大法師", 14: "祭師", 15: "龍劍士", 16: "鬥士",
    17: "英雄", 18: "魔戰士", 19: "龍騎士", 20: "神射手", 21: "召喚師", 22: "聖者", 23: "忍者", 24: "武聖",
    25: "機兵", 26: "？？？", 27: "村民", 28: "魔戰士",
}

# Exact names for enemy/ally/boss/town_npc/villager IDs 68..135
# Verified against FDTXT.DAT[0][69..136] and FD2.EXE fn_38251 / GLOBAL_2_9817..9821!
# Note: 128..132 are the 5 Town Building Shopkeeper/Cleric portraits (Weapon/Armor, Tavern, Item, Church, Secret Shop);
# Summon spells #32..#35 are rendered from FDOTHER.DAT[65..68] via fn_98249, NEVER DATO[128..132]!
UNIT_68_135_NAMES_ZH = {
    68: "士兵", 69: "騎兵", 70: "傭兵", 71: "豹人", 72: "精靈", 73: "龍人",
    74: "惡魔", 75: "米蘭",
    76: "士兵", 77: "精英戰士", 78: "鎧甲武士", 79: "傭兵", 80: "黑暗戰士", 81: "狂戰士", 82: "騎兵", 83: "突擊騎兵",
    84: "地獄騎士", 85: "黑暗騎士", 86: "龍騎士", 87: "弓箭手", 88: "黑暗射手", 89: "狙擊手", 90: "魔法師", 91: "黑暗法師",
    92: "巫師", 93: "僧侶", 94: "黑暗僧侶", 95: "大祭師", 96: "盜賊", 97: "盜賊頭目", 98: "影之忍者", 99: "黑暗殺手",
    100: "武術家", 101: "黑暗鬥士", 102: "獸人", 103: "獸人隊長", 104: "火龍", 105: "雷龍", 106: "龍人戰士", 107: "龍人法師",
    108: "魔鬼", 109: "惡魔", 110: "大惡魔", 111: "機甲兵", 112: "機甲突擊兵", 113: "光束砲座", 114: "機甲射手", 115: "機甲守衛",
    116: "機甲隊長", 117: "卡特那", 118: "萊汀", 119: "薩卡", 120: "瑪爾", 121: "沼澤怪物", 122: "地魔神", 123: "水魔神",
    124: "風魔神", 125: "火魔神", 126: "空魔神", 127: "暗黑龍",
    128: "武器店老闆", 129: "酒店女郎", 130: "道具店店員", 131: "教會神父", 132: "秘密商人",
    133: "女村民", 134: "男村民", 135: "卡納恩三世",
}

# Story / Cutscene / Unused NPC overrides inside promoted range (32..67)
STORY_NPC_SLOTS = {
    39: ("賢者長老", "長老"),
    48: ("渥特王", "國王"),
    57: ("保留空位#57", "未使用"),
    66: ("王后", "王族"),
    67: ("保留空位#67", "未使用"),
}

# Secret promotion item required per hero (0..17) for Tier 3 promotion (verified from FD2.EXE GLOBAL_2_9895 at file 337,063!)
# Note: GLOBAL_2_9895[17] == 255, so #17 米亞斯多德 promotes to #49 龍劍士 (Tier 2) and has NO Tier 3 (#67 is unused)!
HERO_SECRET_PROMO_ITEMS = {
    0: (50, 89),   # 索爾 -> 英雄 (勇者徽章)
    1: (51, 93),   # 哈諾 -> 魔戰士 (白金徽章)
    3: (53, 93),   # 哈瓦特 -> 魔戰士 (白金徽章)
    4: (54, 205),  # 亞雷斯 -> 龍騎士 (飛龍卵)
    5: (55, 205),  # 洛娜 -> 龍騎士 (飛龍卵)
    6: (56, 205),  # 萊汀 -> 龍騎士 (飛龍卵)
    8: (58, 92),   # 希莉亞 -> 神射手 (心眼之書)
    9: (59, 88),   # 悠妮 -> 聖者 (聖者之戒) — plus special slot 52 召喚師 via 精靈契印 (90) at L137257!
    10: (60, 88),  # 瑪琳 -> 聖者 (聖者之戒)
    11: (61, 88),  # 索菲亞 -> 聖者 (聖者之戒)
    12: (62, 91),  # 凱麗 -> 武聖 (領悟之書)
    13: (63, 92),  # 貝克威 -> 神射手 (心眼之書)
    14: (64, 88),  # 珊 -> 聖者 (聖者之戒)
    15: (65, 91),  # 塞可邦勒 -> 武聖 (領悟之書)
}

SPELL_NAMES_ZH = [
    "火炎術", "烈炎術", "炎龍術", "天火術", "電擊術", "落雷術", "轟雷術", "神雷術",
    "聖光彈", "咒殺術", "碎岩術", "地震術", "裂地術", "治療術", "回復術", "再生術",
    "神恩術", "魔刃術", "魔鎧術", "風行術", "解毒術", "祛麻術", "封咒術", "傳送術",
    "破龍擊", "行動術", "毒擊術", "麻痺術", "淒煌斬", "熾炎刀", "音速刃", "（保留）",
    "熾天使", "風妖精", "破壞神", "暗邪鬼",
]

# Authentic FDOTHER.DAT spell/summon animation chunk mapping extracted 100% from `FD2.EXE`
# (`Func_108221` Obj2:9657 & Obj2:9666, `Func_95980`, `Func_98249`, and `L21470`/`L54292` dispatchers):
#   - Spells #0..#9: Cutaway Battle-Stage Attack Magic (`Func_108221`, `Obj2:9657` vs enemy left, `Obj2:9666` vs hero right).
#   - Spells #10..#12 (`碎岩術/地震術/裂地術`): Tactical Map-Only AoE Attack Magic (`L21514`/`L54342` -> `M4[7425+id*4]`, NO cutaway anim!).
#   - Spells #13..#23, #25..#27: Non-attacking Heal/Support/Status/Teleport Magic (Map-only, NO cutaway attack anim!).
#   - Techniques #24 (`破龍擊`), #28 (`淒煌斬`), #29 (`熾炎刀`), #30 (`音速刃`): Special Combat Techniques (`Func_95980`, uses caster FIGANI ranged/attack!).
#   - Summon #32 (`熾天使`): Cutaway Attacking Summon (`Func_98249`, `FDOTHER[65]`, power 800).
#   - Summons #33 (`風妖精`), #34 (`破壞神`), #35 (`暗邪鬼`): Non-damage Heal/Buff/Debuff Summons (`FDOTHER[66..68]`).
FDOTHER_SPELL_CHUNKS = [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 30, 32, 33, 34, 37, 38, 39, 43, 44, 45, 65, 66, 67, 68]

# Tuple: (enemyTargetOtherIdx | None, heroTargetOtherIdx | None, alignMode, spellCategory, hasCutawayAnim, isAttackMagic)
# spellCategory: "cutaway_attack" | "map_attack" | "special_tech" | "support" | "unused"
SPELL_META_MAP: dict[int, tuple[int | None, int | None, str, str, bool, bool]] = {
    0:  (18, 20, "target_anchor", "cutaway_attack", True,  True),   # 火炎術 (7-burst fire pillars, GLOBAL_9145[0])
    1:  (19, 21, "target_anchor", "cutaway_attack", True,  True),   # 烈炎術 (8-ring twin fire pillars, GLOBAL_9145[1])
    2:  (26, 27, "screen_abs",    "cutaway_attack", True,  True),   # 炎龍術 (Fire Dragon flight across screen, GLOBAL_9145[2])
    3:  (39, 43, "screen_abs",    "cutaway_attack", True,  True),   # 天火術 (Diagonal solar fire beams from heaven, GLOBAL_9145[3])
    4:  (22, 23, "target_anchor", "cutaway_attack", True,  True),   # 電擊術 (Multi-bolt lightning strike, GLOBAL_9145[4])
    5:  (24, 25, "target_anchor", "cutaway_attack", True,  True),   # 落雷術 (Heavy twin thunderbolts, GLOBAL_9145[5])
    6:  (32, 33, "screen_abs",    "cutaway_attack", True,  True),   # 轟雷術 (Converging plasma thunder orb explosion, GLOBAL_9145[6])
    7:  (37, 38, "target_anchor", "cutaway_attack", True,  True),   # 神雷術 (3-column divine lightning pillars, GLOBAL_9145[7])
    8:  (28, 30, "screen_abs",    "cutaway_attack", True,  True),   # 聖光彈 (Multi-ray holy light barrage, GLOBAL_9145[8])
    9:  (44, 44, "screen_abs",    "cutaway_attack", True,  True),   # 咒殺術 (Grim reaper curse pillar, GLOBAL_9145[9])
    10: (None, None, "screen_abs", "map_attack",    False, True),   # 碎岩術 (Map-only self-centered AoE, no cutaway anim)
    11: (None, None, "screen_abs", "map_attack",    False, True),   # 地震術 (Map-only self-centered AoE, no cutaway anim)
    12: (None, None, "screen_abs", "map_attack",    False, True),   # 裂地術 (Map-only self-centered AoE, no cutaway anim)
    13: (None, None, "screen_abs", "support",       False, False),  # 治療術
    14: (None, None, "screen_abs", "support",       False, False),  # 回復術
    15: (None, None, "screen_abs", "support",       False, False),  # 再生術
    16: (None, None, "screen_abs", "support",       False, False),  # 神恩術
    17: (None, None, "screen_abs", "support",       False, False),  # 魔刃術
    18: (None, None, "screen_abs", "support",       False, False),  # 魔鎧術
    19: (None, None, "screen_abs", "support",       False, False),  # 風行術
    20: (None, None, "screen_abs", "support",       False, False),  # 解毒術
    21: (None, None, "screen_abs", "support",       False, False),  # 祛麻術
    22: (None, None, "screen_abs", "support",       False, False),  # 封咒術
    23: (None, None, "screen_abs", "support",       False, False),  # 傳送術
    24: (None, None, "screen_abs", "special_tech",  True,  False),  # 破龍擊 (Special combat technique, 1.5x AP via Func_95980)
    25: (None, None, "screen_abs", "support",       False, False),  # 行動術
    26: (None, None, "screen_abs", "support",       False, False),  # 毒擊術 (Status spell, map-only)
    27: (None, None, "screen_abs", "support",       False, False),  # 麻痺術 (Status spell, map-only)
    28: (None, None, "screen_abs", "special_tech",  True,  False),  # 淒煌斬 (Special combat technique, 2.0x AP via Func_95980)
    29: (None, None, "screen_abs", "special_tech",  True,  False),  # 熾炎刀 (Special combat technique, 1.2x AP via Func_95980)
    30: (None, None, "screen_abs", "special_tech",  True,  False),  # 音速刃 (Special combat technique, 1.8x AP via Func_95980)
    31: (None, None, "screen_abs", "unused",        False, False),  # （保留）
    32: (65, 65, "screen_abs",    "cutaway_attack", True,  True),   # 熾天使 (Seraphim attacking summon, Func_98249)
    33: (66, 66, "screen_abs",    "support",        True,  False),  # 風妖精 (Wind Sylph healing summon, non-attacking)
    34: (67, 67, "screen_abs",    "support",        True,  False),  # 破壞神 (Destruction God AP-buff summon, non-attacking)
    35: (68, 68, "screen_abs",    "support",        True,  False),  # 暗邪鬼 (Dark Fiend debuff summon, 0 damage)
}

ITEM_NAMES_ZH = [
    "短劍", "闊劍", "長劍", "巨劍", "黑暗劍", "戰士劍", "巨魔劍", "斬鐵劍", "流水劍", "大地之劍", "龍神劍", "炎龍劍",
    "小刀", "匕首", "淬毒刀", "盜賊匕首", "暗殺刀", "護手刀", "忍者刀", "地獄刀",
    "刺矛", "騎槍", "長戟", "先鋒矛", "斬馬刀", "惡魔之矛", "黃金之戟", "龍之槍", "破魔槍", "戰神戟", "聖之槍", "巨神戟",
    "手斧", "迴旋斧", "戰斧", "戰鎚", "巨斧", "血之斧", "閃雷鎚", "狂暴之斧", "光之斧", "力量之斧", "大地之鎚", "魔神斧",
    "短弓", "長弓", "黑暗弓", "巨弓", "精靈弓", "狙擊弓", "封魔弓", "風神弓",
    "長棍", "釘頭鎚", "巨鎚", "槤枷", "魔法杖", "封咒杖", "力之杖", "黑暗杖", "龍之杖", "光之杖",
    "鐵指套", "鐵爪", "皇帝指環", "毒爪", "殭屍爪", "碎岩爪", "金鋼指環", "裂刃爪", "巨神指環", "魔龍爪",
    "威力手臂", "金鋼手臂", "雷神手臂", "衝擊手臂", "光束劍", "狙擊槍", "光束槍", "光束炮", "拳頭", "利爪", "觸手", "巨岩手臂",
    "激水炮", "風牙斬", "魔燄波", "空雷震",
    "聖者之戒", "勇者徽章", "精靈契印", "領悟之書", "心眼之書", "白金徽章", "生命之實", "魔力水晶", "風精之羽",
    "十字弓", "水晶弓", "雷神鞭", "天空之鑰", "傳送法杖", "修理套件", "火燄", "火神弓", "鬥神指環", "冰燄", "黑暗波",
    "", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
    "巨岩鎧", "魔神甲", "11", "22", "魔岩鎧",
    "布衣", "旅行裝", "精靈披風", "元素護體", "皮甲", "硬皮甲", "夜行裝", "魔法皮甲", "盜賊之衣", "忍者裝", "潛行服",
    "神祕裝", "暗殺服", "黑暗之衣", "惡魔皮甲", "雷神服", "環狀甲", "鎖子甲", "鱗甲", "連環鋼甲", "合金鎖甲", "魔法鱗甲",
    "血環甲", "金鋼鎖甲", "黑暗鱗甲", "力量鎖甲", "惡魔鱗甲", "龍鱗甲", "鎧甲", "銀鎧甲", "魔法鎧甲", "重鎧甲",
    "地獄鎧甲", "聖鎧甲", "大地鎧甲", "龍神鎧甲", "長袍", "法師袍", "僧侶袍", "祭司袍", "聖者袍", "霧之袍", "黑暗之袍",
    "天之袍", "武道服", "武鬥裝", "鬥士服", "武者鎧甲", "妖魔鬥服", "武神護甲", "戰鬥裝甲", "突擊裝甲", "重裝甲",
    "特殊裝甲", "硬皮", "青色硬皮", "龍鱗", "軟皮", "虛無護甲", "王袍", "鬥士護甲", "地之袍", "水之袍", "大地裝甲",
    "藥草", "回復劑", "再生藥", "神聖之水", "解毒劑", "退麻劑", "力量藥水", "耐力藥水", "速度藥水",
    "綠寶石", "紅寶石", "藍寶石", "鑽石", "飛龍卵", "魔法水", "水晶粒", "控制中樞", "黃金徽章",
    "星之眼", "光之眼", "暗之眼", "冰之眼", "火之眼",
]

CHAPTER_TITLES_ZH = [
    "孤島", "羅德鎮", "往塞拉村途中", "塞拉村前", "塞拉村", "普里茲港", "往王城的途中", "王城前的戰鬥",
    "騎士的抉擇", "洞窟中的激戰", "幻之森林", "北山道", "哈斯米爾之戰", "平原的會戰", "拉卡湖的激戰", "冰原之戰",
    "血與冰之刃", "遙遠的彼岸", "黑暗中的狙擊", "死亡般的沈寂", "亞述森林", "遠古的呼喚", "向天空之旅", "在天空的彼方",
    "火焰的審判", "未知的迴廊", "命運的交會點", "探索者", "無邊的黑暗之中", "傳說的終章",
    "隱藏關・蓋亞試煉", "片頭演武", "終章凱旋",
]


def read_llll_chunks(path: Path) -> list[bytes]:
    data = path.read_bytes()
    assert data[:6] == b"LLLLLL", f"Unexpected header in {path}"
    first_off = struct.unpack_from("<I", data, 6)[0]
    n_offs = (first_off - 6) // 4
    offs = list(struct.unpack_from(f"<{n_offs}I", data, 6))
    if offs[-1] < len(data):
        offs.append(len(data))
    return [data[offs[i] : offs[i + 1]] for i in range(len(offs) - 1) if offs[i + 1] >= offs[i]]


def load_palette(vga_768: bytes) -> list[tuple[int, int, int]]:
    return [
        (
            min(255, (vga_768[i * 3] * 255) // 63),
            min(255, (vga_768[i * 3 + 1] * 255) // 63),
            min(255, (vga_768[i * 3 + 2] * 255) // 63),
        )
        for i in range(256)
    ]


def decode_fd_rle(data: bytes, w: int, h: int, opaque_bg: bool = False) -> tuple[bytearray, bytearray]:
    total = w * h
    idx_buf = bytearray(total)
    alpha = bytearray(b"\xff" * total) if opaque_bg else bytearray(total)
    i = 0
    pos = 0
    n = len(data)
    while i < n and pos < total:
        c = data[i]
        i += 1
        top = c >> 6
        cnt = (c & 0x3F) + 1
        if top == 0:
            val = data[i] if i < n else 0
            i += 1
            end = min(pos + cnt, total)
            idx_buf[pos:end] = bytes([val]) * (end - pos)
            alpha[pos:end] = b"\xff" * (end - pos)
            pos = end
        elif top == 1:
            # 50% dithered checkerboard mesh (e.g. ground shadow under feet & platforms):
            # cnt pairs of (1 transparent skip pixel, 1 solid pixel of `val`) = 2 * cnt pixels
            val = data[i] if i < n else 0
            i += 1
            for _ in range(cnt):
                pos += 1
                if pos < total:
                    idx_buf[pos] = val
                    alpha[pos] = 255
                    pos += 1
                else:
                    break
        elif top == 2:
            end = min(pos + cnt, total)
            actual = end - pos
            idx_buf[pos:end] = data[i : i + actual]
            alpha[pos:end] = b"\xff" * actual
            i += cnt
            pos = end
        else:
            pos = min(pos + cnt, total)
    return idx_buf, alpha


def decode_pcx_rle(data: bytes, w: int, h: int) -> tuple[bytearray, bytearray]:
    """Decodes DATO.DAT 80x80 portrait RLE exactly matching FD2.EXE fn_256175 / fn_256278:
    - Uses strict unsigned `b > 0xC0` (`JA`), NOT `b >= 0xC0`! Run lengths 1..63 are encoded
      as `0xC1..0xFF` followed by `val`, while palette index `0xC0` (golden-blonde highlight)
      is stored directly as a single literal byte `0xC0` (fixes horizontal shear on #13 貝克威 & #129 熾天使).
    - Blits all 6,400 pixels opaquely (`alpha = 255`), preserving `0xFF` pure-white highlights (#10 瑪琳).
    """
    total = w * h
    idx_buf = bytearray(total)
    alpha = bytearray(b"\xff" * total)
    i = 0
    pos = 0
    n = len(data)
    while i < n and pos < total:
        b = data[i]
        i += 1
        if b > 0xC0:
            cnt = b & 0x3F
            val = data[i] if i < n else 0
            i += 1
        else:
            cnt = 1
            val = b
        end = min(pos + cnt, total)
        idx_buf[pos:end] = bytes([val]) * (end - pos)
        pos = end
    return idx_buf, alpha


def indices_to_rgba(idx_buf: bytearray, alpha: bytearray, w: int, h: int, pal: list[tuple[int, int, int]]) -> Image.Image:
    rgba = bytearray(w * h * 4)
    for p in range(w * h):
        a = alpha[p]
        if a:
            r, g, b = pal[idx_buf[p]]
            o = p * 4
            rgba[o] = r
            rgba[o + 1] = g
            rgba[o + 2] = b
            rgba[o + 3] = a
    return Image.frombytes("RGBA", (w, h), bytes(rgba))


def extract_font_atlas(font_bytes: bytes, out_path: Path) -> dict:
    n_glyphs = len(font_bytes) // 32
    cols = 32
    rows = (n_glyphs + cols - 1) // cols
    img_w, img_h = cols * 16, rows * 16
    rgba = bytearray(img_w * img_h * 4)
    for gid in range(n_glyphs):
        gx = (gid % cols) * 16
        gy = (gid // cols) * 16
        base = gid * 32
        for r in range(16):
            bits = (font_bytes[base + r * 2] << 8) | font_bytes[base + r * 2 + 1]
            row_off = (gy + r) * img_w
            for c in range(16):
                if bits & (1 << (15 - c)):
                    p = (row_off + gx + c) * 4
                    rgba[p] = 255
                    rgba[p + 1] = 255
                    rgba[p + 2] = 255
                    rgba[p + 3] = 255
    Image.frombytes("RGBA", (img_w, img_h), bytes(rgba)).save(out_path, optimize=True)
    return {"glyphCount": n_glyphs, "cols": cols, "rows": rows, "glyphSize": 16}


def extract_sprite_bank_to_atlas(data: bytes, pal: list[tuple[int, int, int]], cols: int, out_path: Path, opaque_bg: bool = False) -> dict:
    w, h, cnt = struct.unpack_from("<HHH", data, 0)
    offs = list(struct.unpack_from(f"<{cnt}I", data, 6)) + [len(data)]
    rows = (cnt + cols - 1) // cols
    atlas = Image.new("RGBA", (cols * w, rows * h), (0, 0, 0, 0))
    for i in range(cnt):
        idx_buf, alpha = decode_fd_rle(data[offs[i] : offs[i + 1]], w, h, opaque_bg=opaque_bg)
        tile_img = indices_to_rgba(idx_buf, alpha, w, h, pal)
        atlas.paste(tile_img, ((i % cols) * w, (i // cols) * h))
    atlas.save(out_path, optimize=True)
    return {"w": w, "h": h, "count": cnt, "cols": cols, "rows": rows}


def extract_battle_hud_atlas(chunk5: bytes, pal: list[tuple[int, int, int]], out_path: Path) -> dict:
    """Extracts the authentic FD2.EXE battle cutaway HUD sprites from FDOTHER.DAT[5] (`LMI1` bank, `fn_35949`):
    - Sprite 22: 149x42 HUD base panel (PCX-RLE `fn_256175`, with steel-blue background, `LV.`/`HP`/`MP` labels & dark-red bar troughs).
    - Sprites 23..30: 1x5 raw column sprites (`fn_26716`) for HP golden-yellow bar (23..25), MP olive-green bar (26..28), & dark-red trough (29..30).
    - Sprites 31..52, 93: 6x8 / 5x8 / 18x8 / 12x8 FD-RLE digit sprites (`fn_26758`) for ice-blue full-stat digits (31..40, 41=`???`),
      sage-green damaged-stat digits (42..51, 52=`???`), and level overflow 93 (`??`).
    """
    assert chunk5[:4] == b"LMI1", "Expected LMI1 header in FDOTHER[5]"
    cnt = struct.unpack_from("<H", chunk5, 4)[0]
    soffs = list(struct.unpack_from(f"<{cnt}I", chunk5, 6)) + [len(chunk5)]

    atlas = Image.new("RGBA", (192, 68), (0, 0, 0, 0))
    rects: dict[str, list[int]] = {}

    # 1. Sprite 22: 149x42 base panel at (0, 0)
    b22 = chunk5[soffs[22] : soffs[23]]
    w22, h22 = struct.unpack_from("<HH", b22, 0)
    ib22, ab22 = decode_pcx_rle(b22[4:], w22, h22)
    atlas.paste(indices_to_rgba(ib22, ab22, w22, h22, pal), (0, 0))
    rects["22"] = [0, 0, w22, h22]

    # 2. Sprites 23..30: 1x5 raw column segments placed starting at y = 44, x = (idx - 23) * 2
    for idx in range(23, 31):
        sp = chunk5[soffs[idx] : soffs[idx + 1]]
        sw, sh = struct.unpack_from("<HH", sp, 0)
        raw_col = bytearray(sp[4 : 4 + sw * sh])
        alpha_col = bytearray(b"\xff" * (sw * sh))
        dx = (idx - 23) * 2
        dy = 44
        atlas.paste(indices_to_rgba(raw_col, alpha_col, sw, sh, pal), (dx, dy))
        rects[str(idx)] = [dx, dy, sw, sh]

    # 3. Sprites 31..41 (ice-blue digits 0..9 + `???`) at y = 50
    cur_x = 0
    for idx in range(31, 42):
        sp = chunk5[soffs[idx] : soffs[idx + 1]]
        sw, sh = struct.unpack_from("<HH", sp, 0)
        ib, ab = decode_fd_rle(sp[4:], sw, sh, opaque_bg=False)
        atlas.paste(indices_to_rgba(ib, ab, sw, sh, pal), (cur_x, 50))
        rects[str(idx)] = [cur_x, 50, sw, sh]
        cur_x += sw + 1

    # 4. Sprites 42..52 (sage-green digits 0..9 + `???`) + Sprite 93 (`??`) at y = 59
    cur_x = 0
    for idx in list(range(42, 53)) + [93]:
        sp = chunk5[soffs[idx] : soffs[idx + 1]]
        sw, sh = struct.unpack_from("<HH", sp, 0)
        ib, ab = decode_fd_rle(sp[4:], sw, sh, opaque_bg=False)
        atlas.paste(indices_to_rgba(ib, ab, sw, sh, pal), (cur_x, 59))
        rects[str(idx)] = [cur_x, 59, sw, sh]
        cur_x += sw + 1

    atlas.save(out_path, optimize=True)
    return {
        "file": "assets/battle_hud.png",
        "rects": rects,
        "nameFgHex": f"#{pal[205][0]:02x}{pal[205][1]:02x}{pal[205][2]:02x}",
        "nameShadowHex": f"#{pal[76][0]:02x}{pal[76][1]:02x}{pal[76][2]:02x}",
    }


def extract_cross_icons_atlas(chunk2: bytes, pal: list[tuple[int, int, int]], out_path: Path) -> dict:
    """Extracts the 78 (26 icons x 3 states) 24x20 4-Way Cross Menu (`十字選單`) icons from FDOTHER.DAT[2]."""
    offs = list(struct.unpack_from("<78I", chunk2, 0)) + [len(chunk2)]
    w, h = 24, 20
    cols = 26
    rows = 3
    atlas = Image.new("RGBA", (cols * w, rows * h), (0, 0, 0, 0))
    for idx in range(78):
        sub = chunk2[offs[idx] : offs[idx + 1]]
        sw, sh = struct.unpack_from("<HH", sub, 0)
        raw = bytearray(sub[4 : 4 + sw * sh])
        alpha = bytearray(0 if b == 0 else 255 for b in raw)
        icon_id = idx // 3
        state = idx % 3
        atlas.paste(indices_to_rgba(raw, alpha, sw, sh, pal), (icon_id * w, state * h))
    atlas.save(out_path, optimize=True)
    return {"file": "assets/cross_icons.png", "w": w, "h": h, "iconCount": 26, "states": 3}


def extract_tactical_ui_atlas(chunk5: bytes, pal: list[tuple[int, int, int]], out_path: Path) -> dict:
    """Extracts authentic FDOTHER.DAT[5] tactical HUD, unit status sheet, item sub-icons & battle situation panels."""
    assert chunk5[:4] == b"LMI1", "Expected LMI1 header in FDOTHER[5]"
    cnt = struct.unpack_from("<H", chunk5, 4)[0]
    soffs = list(struct.unpack_from(f"<{cnt}I", chunk5, 6)) + [len(chunk5)]

    target_ids = (
        [0, 18, 19, 20, 21, 53, 54]
        + list(range(55, 68))
        + [92]
        + list(range(94, 138))
    )
    atlas_w, atlas_h = 640, 420
    atlas = Image.new("RGBA", (atlas_w, atlas_h), (0, 0, 0, 0))
    rects: dict[str, list[int]] = {}
    cx, cy, row_h = 0, 0, 0

    for idx in target_ids:
        if idx >= cnt:
            continue
        sp = chunk5[soffs[idx] : soffs[idx + 1]]
        if len(sp) < 4:
            continue
        sw, sh = struct.unpack_from("<HH", sp, 0)
        if sw <= 0 or sh <= 0 or sw > 320 or sh > 200:
            continue
        if len(sp) == 4 + sw * sh:
            ib = bytearray(sp[4 : 4 + sw * sh])
            ab = bytearray(0 if b in (0, 73) else 255 for b in ib)
        elif idx in (20, 21) or (94 <= idx <= 118):
            ib, ab = decode_pcx_rle(sp[4:], sw, sh)
            if 94 <= idx <= 118:
                ab = bytearray(0 if b == 0 else 255 for b in ib)
        else:
            ib, ab = decode_fd_rle(sp[4:], sw, sh, opaque_bg=False)
        if cx + sw + 2 > atlas_w:
            cx = 0
            cy += row_h + 2
            row_h = 0
        atlas.paste(indices_to_rgba(ib, ab, sw, sh, pal), (cx, cy))
        rects[str(idx)] = [cx, cy, sw, sh]
        cx += sw + 2
        row_h = max(row_h, sh)

    atlas.save(out_path, optimize=True)
    return {"file": "assets/tactical_ui.png", "rects": rects}


def extract_fx_atlas(other_chunks: list[bytes], pal: list[tuple[int, int, int]], out_path: Path) -> dict:
    """Extracts directing & battlefield FX sprites into `fx_atlas.png`:
    - `FDOTHER[9]`: 12 teleport/rest-heal sparkles
    - `FDOTHER[3]`: 23 scripted lightning bolt segments
    - `FDOTHER[5][68..79]`: 12 on-map unit death explosion frames (`fn_56165`, `72x71` envelope, cumulative `0..5` + clean smoke `6..11`, PCX-RLE color 0 transparent)
    - `FDOTHER[5][80..82]`: 3 turn-phase calligraphic banners (`我軍行動`, `敵軍行動`, `友軍行動`)
    - `FDOTHER[6][0..229]`: 230 on-map spell/status FX sprites (`fn_50380`, PCX-RLE color 0 transparent)
    """
    atlas_w, atlas_h = 1024, 512
    atlas = Image.new("RGBA", (atlas_w, atlas_h), (0, 0, 0, 0))
    sparkles = []
    c9 = other_chunks[9]
    if c9[:4] == b"LMI1":
        n9 = struct.unpack_from("<H", c9, 4)[0]
        o9 = list(struct.unpack_from(f"<{n9}I", c9, 6)) + [len(c9)]
        cx = 0
        for i in range(n9):
            sp = c9[o9[i] : o9[i + 1]]
            sw, sh = struct.unpack_from("<HH", sp, 0)
            ib, ab = decode_fd_rle(sp[4:], sw, sh, opaque_bg=False)
            atlas.paste(indices_to_rgba(ib, ab, sw, sh, pal), (cx, 0))
            sparkles.append([cx, 0, sw, sh])
            cx += sw + 2

    lightning = []
    c3 = other_chunks[3]
    if c3[:4] == b"LMI1":
        n3 = struct.unpack_from("<H", c3, 4)[0]
        o3 = list(struct.unpack_from(f"<{n3}I", c3, 6)) + [len(c3)]
        cx = 0
        for i in range(n3):
            sp = c3[o3[i] : o3[i + 1]]
            if len(sp) == 256:
                ib = bytearray(sp)
                ab = bytearray(0 if b == 0 else 255 for b in ib)
                atlas.paste(indices_to_rgba(ib, ab, 16, 16, pal), (cx, 32))
                lightning.append([cx, 32, 16, 16])
                cx += 18

    # FDOTHER[5][68..79]: 12-frame unit death explosion (`fn_56165`, 72x71 envelope at (-24, -30) from unit tile)
    explosions = []
    phase_banners = []
    c5 = other_chunks[5]
    if c5[:4] == b"LMI1":
        n5 = struct.unpack_from("<H", c5, 4)[0]
        o5 = list(struct.unpack_from(f"<{n5}I", c5, 6)) + [len(c5)]
        cum_canvas = Image.new("RGBA", (72, 71), (0, 0, 0, 0))
        cx = 0
        ey = 56
        for f_idx in range(12):
            sp = c5[o5[68 + f_idx] : o5[69 + f_idx]]
            sw, sh = struct.unpack_from("<HH", sp, 0)
            ib, _ = decode_pcx_rle(sp[4:], sw, sh)
            ab = bytearray(0 if b == 0 else 255 for b in ib)
            fr_img = indices_to_rgba(ib, ab, sw, sh, pal)
            if f_idx < 6:
                # Exact FD2.EXE L56758..L56858: frames 0..5 blit cumulatively onto the fireball core!
                cum_canvas.alpha_composite(fr_img, (0, 0))
                out_fr = cum_canvas.copy()
            else:
                # Exact FD2.EXE L56867..L56990: frames 6..11 restore clean background each frame!
                out_fr = Image.new("RGBA", (72, 71), (0, 0, 0, 0))
                out_fr.alpha_composite(fr_img, (0, 0))
            atlas.paste(out_fr, (cx, ey))
            explosions.append([cx, ey, 72, 71])
            cx += 74

        # FDOTHER[5][80..82]: Phase banners (`我軍行動`, `敵軍行動`, `友軍行動`)
        bx = 440
        by = 30
        for b_idx in (80, 81, 82):
            if b_idx < n5:
                sp = c5[o5[b_idx] : o5[b_idx + 1]]
                sw, sh = struct.unpack_from("<HH", sp, 0)
                ib, _ = decode_pcx_rle(sp[4:], sw, sh)
                ab = bytearray(0 if b == 0 else 255 for b in ib)
                atlas.paste(indices_to_rgba(ib, ab, sw, sh, pal), (bx, by))
                phase_banners.append([bx, by, sw, sh])
                bx += sw + 4

    # FDOTHER[6][0..229]: On-map spell/status FX frames (`fn_50380`)
    map_spell_fx: dict[str, list[int]] = {}
    c6 = other_chunks[6]
    cx, cy, row_h = 0, 132, 0
    if c6[:4] == b"LMI1":
        n6 = struct.unpack_from("<H", c6, 4)[0]
        o6 = list(struct.unpack_from(f"<{n6}I", c6, 6)) + [len(c6)]
        for i in range(n6):
            sp = c6[o6[i] : o6[i + 1]]
            if len(sp) < 4:
                continue
            sw, sh = struct.unpack_from("<HH", sp, 0)
            if sw <= 0 or sh <= 0 or sw > 120 or sh > 60:
                continue
            ib, _ = decode_pcx_rle(sp[4:], sw, sh)
            ab = bytearray(0 if b == 0 else 255 for b in ib)
            if cx + sw + 2 > atlas_w:
                cx = 0
                cy += row_h + 2
                row_h = 0
            if cy + sh < atlas_h:
                atlas.paste(indices_to_rgba(ib, ab, sw, sh, pal), (cx, cy))
                map_spell_fx[str(i)] = [cx, cy, sw, sh]
                cx += sw + 2
                row_h = max(row_h, sh)

    atlas.save(out_path, optimize=True)
    return {
        "file": "assets/fx_atlas.png",
        "sparkles": sparkles,
        "lightning": lightning,
        "explosions": explosions,
        "phaseBanners": phase_banners,
        "mapSpellFx": map_spell_fx,
    }


def parse_xmi_evnt(evnt_payload: bytes) -> list[list]:
    events = []
    programs = [0] * 16
    volumes = [100] * 16
    tick = 0
    i = 0
    n = len(evnt_payload)
    while i < n:
        b = evnt_payload[i]
        if b < 0x80:
            while i < n and evnt_payload[i] < 0x80:
                tick += evnt_payload[i]
                i += 1
            continue
        i += 1
        if b == 0xFF:
            if i >= n:
                break
            meta_type = evnt_payload[i]
            i += 1
            if meta_type == 0x2F:
                break
            mlen = 0
            while i < n:
                mb = evnt_payload[i]
                i += 1
                mlen = (mlen << 7) | (mb & 0x7F)
                if not (mb & 0x80):
                    break
            i += mlen
        elif 0xF0 <= b <= 0xFE:
            slen = 0
            while i < n:
                sb = evnt_payload[i]
                i += 1
                slen = (slen << 7) | (sb & 0x7F)
                if not (sb & 0x80):
                    break
            i += slen
        else:
            cmd = b & 0xF0
            ch = b & 0x0F
            if cmd == 0x90:
                if i + 2 > n:
                    break
                note = evnt_payload[i]
                vel = evnt_payload[i + 1]
                i += 2
                dur = 0
                while i < n:
                    db = evnt_payload[i]
                    i += 1
                    dur = (dur << 7) | (db & 0x7F)
                    if not (db & 0x80):
                        break
                if vel > 0 and dur > 0:
                    eff_vel = max(1, min(127, (vel * volumes[ch]) // 100))
                    events.append([
                        round(tick / 120.0, 4),
                        ch,
                        note,
                        eff_vel,
                        round(max(1, dur) / 120.0, 4),
                        programs[ch],
                    ])
            elif cmd in (0x80, 0xA0, 0xE0):
                i += 2
            elif cmd == 0xB0:
                if i + 2 <= n:
                    cc, cv = evnt_payload[i], evnt_payload[i + 1]
                    if cc == 7:
                        volumes[ch] = cv
                i += 2
            elif cmd == 0xC0:
                if i < n:
                    programs[ch] = evnt_payload[i]
                i += 1
            elif cmd == 0xD0:
                i += 1
    return events


def parse_dialogue_entry(
    raw: bytes,
    max_deploy: int = 0,
    urec_uids: list[int] | None = None,
    canonical_party: list[int] | None = None,
) -> list[dict]:
    """Splits a chapter FDTXT entry into speaker segments matching FD2.EXE fn_24452 (L24896..L25690):
    - 0xFFEF (top) & 0xFFEE (bottom): Direct 0..135 Character ID `uid` (`fn_11360`).
    - 0xFFED (top) & 0xFFEC (bottom): Runtime map unit array index `slot` (`M4[GLOBAL_2_14917] + 80 * slot`),
      where `slot < max_deploy` refers to deployed party hero slot `slot`, and `slot >= max_deploy` refers to
      `urec[slot - max_deploy]` (`uid = ctrl_raw[131 + (slot - max_deploy)*26 + 1]`)!
    - Narration boxes without a speaker header have `speaker = None` so speaker 0 (Sol 索爾) is NEVER confused with narrator!
    """
    u16s = list(struct.unpack(f"<{len(raw) // 2}H", raw))
    segments = []
    cur = {"speaker": None, "boxPos": "mid", "lines": [[]]}
    i = 0
    party_order = canonical_party or [0, 4, 1, 8, 9, 3, 5, 10, 2, 12, 13, 14, 6, 7, 11, 15, 16, 17]
    while i < len(u16s):
        code = u16s[i]
        i += 1
        if code == 0xFFFF:
            break
        elif code in (0xFFEC, 0xFFED, 0xFFEE, 0xFFEF):
            if any(cur["lines"]):
                segments.append(cur)
            arg = u16s[i] if i < len(u16s) else None
            i += 1
            spk: int | None = None
            spk_slot: int | None = None
            if arg is not None:
                if code in (0xFFEE, 0xFFEF):
                    spk = arg
                else:
                    # 0xFFEC / 0xFFED: runtime map slot!
                    spk_slot = arg
                    if arg < max_deploy:
                        spk = party_order[arg] if arg < len(party_order) else 0
                    elif urec_uids is not None and (arg - max_deploy) < len(urec_uids):
                        spk = urec_uids[arg - max_deploy]
                    else:
                        spk = arg
            pos = "top" if code in (0xFFED, 0xFFEF) else "bottom"
            cur = {"speaker": spk, "boxPos": pos, "lines": [[]]}
            if spk_slot is not None:
                cur["speakerSlot"] = spk_slot
        elif code == 0xFFFE:
            cur["lines"].append([])
        elif code in (0xFFFD, 0xFFFC, 0xFFFB, 0xFFFA):
            if any(cur["lines"]):
                segments.append(cur)
            cur = {"speaker": cur["speaker"], "boxPos": cur["boxPos"], "lines": [[]]}
            if "speakerSlot" in segments[-1]:
                cur["speakerSlot"] = segments[-1]["speakerSlot"]
        elif code < 1824:
            cur["lines"][-1].append(code)
    if any(cur["lines"]):
        segments.append(cur)
    for s in segments:
        s["lines"] = [ln for ln in s["lines"] if len(ln) > 0]
    return [s for s in segments if len(s["lines"]) > 0]


def main():
    print(f"Extracting verified Flame Dragon II assets from {FD2_DIR} -> {OUT_DIR} ...")
    for sub_clean in ["figani", "spells"]:
        if (OUT_DIR / sub_clean).exists():
            for old_f in (OUT_DIR / sub_clean).glob("*.png"):
                old_f.unlink()
    for sub in ["tilesets", "chapters", "screens", "figani", "spells"]:
        (OUT_DIR / sub).mkdir(parents=True, exist_ok=True)

    # 1. FDOTHER.DAT -> Palette, 16x16 Font, UI Icons, Screens
    other_chunks = read_llll_chunks(FD2_DIR / "FDOTHER.DAT")
    pal = load_palette(other_chunks[0])
    title_pal = load_palette(other_chunks[8]) if len(other_chunks[8]) == 768 else pal

    font_meta = extract_font_atlas(other_chunks[4], OUT_DIR / "font_atlas.png")
    ui_icons_meta = extract_sprite_bank_to_atlas(other_chunks[1], pal, 10, OUT_DIR / "ui_icons.png")
    item_icons_meta = extract_sprite_bank_to_atlas(other_chunks[96], pal, 12, OUT_DIR / "item_icons.png")
    battle_hud_meta = extract_battle_hud_atlas(other_chunks[5], pal, OUT_DIR / "battle_hud.png")
    cross_icons_meta = extract_cross_icons_atlas(other_chunks[2], pal, OUT_DIR / "cross_icons.png")
    tactical_ui_meta = extract_tactical_ui_atlas(other_chunks[5], pal, OUT_DIR / "tactical_ui.png")
    fx_atlas_meta = extract_fx_atlas(other_chunks, pal, OUT_DIR / "fx_atlas.png")
    print(
        f"  [OK] font_atlas.png ({font_meta['glyphCount']}), ui_icons.png ({ui_icons_meta['count']}), "
        f"item_icons.png ({item_icons_meta['count']}), cross_icons.png (26x3), "
        f"tactical_ui.png ({len(tactical_ui_meta['rects'])}), fx_atlas.png ({len(fx_atlas_meta['sparkles'])} sparkles)"
    )

    pal_57 = load_palette(other_chunks[57]) if len(other_chunks[57]) == 768 else pal
    pal_76 = load_palette(other_chunks[76]) if len(other_chunks[76]) == 768 else pal
    pal_99 = load_palette(other_chunks[99]) if len(other_chunks[99]) == 768 else pal

    # Composite title_0 + menu button plates title_1..6 (61x7 / 62x8)
    title_chunks = read_llll_chunks(FD2_DIR / "TITLE.DAT")
    for idx, ch in enumerate(title_chunks):
        if len(ch) >= 4:
            w, h = struct.unpack_from("<HH", ch, 0)
            if 5 <= w <= 320 and 5 <= h <= 200:
                ibuf, abuf = decode_fd_rle(ch[4:], w, h, opaque_bg=(idx == 0))
                indices_to_rgba(ibuf, abuf, w, h, title_pal).save(OUT_DIR / "screens" / f"title_{idx}.png", optimize=True)

    screen_pals = {
        "camp": (11, pal),
        "shop": (15, pal),
        "church": (55, pal_57),
        "ending": (61, pal),
        "world": (75, pal_76),
        "gameover": (97, pal_99),
    }
    for sidx, (oidx, spal) in screen_pals.items():
        ch = other_chunks[oidx]
        w, h = struct.unpack_from("<HH", ch, 0)
        if w == 320 and h == 200:
            if len(ch) == 64004:
                ibuf = bytearray(ch[4:64004])
                abuf = bytearray(b"\xff" * 64000)
            else:
                ibuf, abuf = decode_fd_rle(ch[4:], w, h, opaque_bg=True)
            indices_to_rgba(ibuf, abuf, w, h, spal).save(OUT_DIR / "screens" / f"{sidx}.png", optimize=True)

    # 2. FDICON.B24 -> 1,680 24x24 battlefield unit sprites (140 rows x 12 cols, 0-indexed!)
    fdicon_bytes = (FD2_DIR / "FDICON.B24").read_bytes()
    units_atlas_meta = extract_sprite_bank_to_atlas(fdicon_bytes, pal, 12, OUT_DIR / "units_atlas.png")
    u_cnt = struct.unpack_from("<H", fdicon_bytes, 4)[0]
    u_offs = list(struct.unpack_from(f"<{u_cnt}I", fdicon_bytes, 6)) + [len(fdicon_bytes)]
    sprite_row_active_frames: dict[int, int] = {}
    for r_idx in range(u_cnt // 12):
        active_f = 0
        for f_col in range(12):
            f_data = fdicon_bytes[u_offs[r_idx * 12 + f_col] : u_offs[r_idx * 12 + f_col + 1]]
            _, a_check = decode_fd_rle(f_data, 24, 24)
            if any(a_check):
                active_f += 1
        sprite_row_active_frames[r_idx] = active_f
    print(f"  [OK] units_atlas.png ({u_cnt // 12} rows, {sum(1 for v in sprite_row_active_frames.values() if v > 0)} non-empty rows)")

    # 3. DATO.DAT -> 136 character portraits x 4 frames (80x80, 0-indexed!)
    dato_chunks = read_llll_chunks(FD2_DIR / "DATO.DAT")
    p_cols = 4
    p_rows = (len(dato_chunks) + p_cols - 1) // p_cols
    p_atlas = Image.new("RGBA", (p_cols * 320, p_rows * 80), (0, 0, 0, 0))
    portrait_has_art: dict[int, bool] = {}
    for pid, ch in enumerate(dato_chunks):
        portrait_has_art[pid] = False
        if len(ch) < 4:
            continue
        scnt = min(4, struct.unpack_from("<I", ch, 0)[0] // 4)
        soffs = list(struct.unpack_from(f"<{scnt}I", ch, 0)) + [len(ch)]
        base_x = (pid % p_cols) * 320
        base_y = (pid // p_cols) * 80
        for fidx in range(scnt):
            fr = ch[soffs[fidx] : soffs[fidx + 1]]
            if len(fr) < 4:
                continue
            fw, fh = struct.unpack_from("<HH", fr, 0)
            if fw == 80 and fh == 80:
                ibuf, abuf = decode_pcx_rle(fr[4:], fw, fh)
                # Blank blue placeholder portraits (57, 105, 127) are solid single-color squares
                unique_colors = len(set(ibuf[k] for k in range(fw * fh) if abuf[k] > 0))
                if fidx == 0 and unique_colors > 3:
                    portrait_has_art[pid] = True
                p_atlas.paste(indices_to_rgba(ibuf, abuf, fw, fh, pal), (base_x + fidx * 80, base_y))
    p_atlas.save(OUT_DIR / "portraits_atlas.png", optimize=True)
    print(f"  [OK] portraits_atlas.png ({len(dato_chunks)} portraits, {sum(portrait_has_art.values())} illustrated)")

    # 4. BG.DAT (56 320x100 backgrounds) + TAI.DAT (56 ~155x42 combat platforms)
    bg_chunks = read_llll_chunks(FD2_DIR / "BG.DAT")
    bg_cols = 4
    bg_rows = (len(bg_chunks) + bg_cols - 1) // bg_cols
    bg_atlas = Image.new("RGBA", (bg_cols * 320, bg_rows * 100), (0, 0, 0, 0))
    for bid, ch in enumerate(bg_chunks):
        if len(ch) >= 4:
            bw, bh = struct.unpack_from("<HH", ch, 0)
            if bw == 320 and bh == 100:
                ibuf, abuf = decode_fd_rle(ch[4:], bw, bh, opaque_bg=True)
                bg_atlas.paste(indices_to_rgba(ibuf, abuf, bw, bh, pal), ((bid % bg_cols) * 320, (bid // bg_cols) * 100))
    bg_atlas.save(OUT_DIR / "bgs_atlas.png", optimize=True)

    tai_chunks = read_llll_chunks(FD2_DIR / "TAI.DAT")
    tai_cols = 4
    tai_cell_w, tai_cell_h = 160, 48
    tai_rows = (len(tai_chunks) + tai_cols - 1) // tai_cols
    tai_atlas = Image.new("RGBA", (tai_cols * tai_cell_w, tai_rows * tai_cell_h), (0, 0, 0, 0))
    tai_meta = []
    for tid, ch in enumerate(tai_chunks):
        if len(ch) >= 6:
            tw, th = struct.unpack_from("<HH", ch, 0)
            if 20 < tw <= 160 and 10 < th <= 48:
                ibuf, abuf = decode_fd_rle(ch[4:], tw, th, opaque_bg=False)
                tai_atlas.paste(
                    indices_to_rgba(ibuf, abuf, tw, th, pal),
                    ((tid % tai_cols) * tai_cell_w, (tid // tai_cols) * tai_cell_h),
                )
                tai_meta.append({"id": tid, "w": tw, "h": th, "valid": True})
            else:
                tai_meta.append({"id": tid, "w": 0, "h": 0, "valid": False})
        else:
            tai_meta.append({"id": tid, "w": 0, "h": 0, "valid": False})
    tai_atlas.save(OUT_DIR / "tais_atlas.png", optimize=True)
    print(f"  [OK] bgs_atlas.png ({len(bg_chunks)}) & tais_atlas.png ({sum(1 for t in tai_meta if t['valid'])} active platforms)")

    # 5. FIGANI.DAT -> All 136 unit triplets (408 = 136 * 3: slot 0=idle, slot 1=attack, slot 2=ranged/cast)
    fig_chunks = read_llll_chunks(FD2_DIR / "FIGANI.DAT")
    assert len(fig_chunks) == 408, f"Expected 408 FIGANI chunks, got {len(fig_chunks)}"
    figani_by_unit: dict[str, dict] = {}
    slot_names = ["idle", "attack", "ranged"]
    extracted_strips = 0

    for uid in range(136):
        unit_slots = {}
        for s_idx, s_name in enumerate(slot_names):
            ch = fig_chunks[3 * uid + s_idx]
            if len(ch) < 12:
                continue
            fcnt = ch[0]
            is_remote = bool(ch[1])
            split_frame = int(ch[2])
            sfx_bank_code = int(ch[4]) if len(ch) > 4 else 0
            sfx_bank_table = [48, 49, 50, 51, 52, 53, 51]
            sfx_bank_chunk = sfx_bank_table[sfx_bank_code - 1] if 1 <= sfx_bank_code <= len(sfx_bank_table) else 0
            if fcnt <= 0 or len(ch) < 8 + fcnt * 4:
                continue
            foffs = list(struct.unpack_from(f"<{fcnt}I", ch, 8)) + [len(ch)]
            decoded_imgs = []
            for k in range(fcnt):
                fr = ch[foffs[k] : foffs[k + 1]]
                if len(fr) < 14:
                    continue
                ox, oy = struct.unpack_from("<hh", fr, 0)
                sfx, hit_flag, dly, fg_layer = fr[4], fr[5], max(1, fr[6]), bool(fr[7] & 1)
                fw, fh = struct.unpack_from("<HH", fr, 9)
                if 1 <= fw <= 320 and 1 <= fh <= 220:
                    ibuf, abuf = decode_fd_rle(fr[13:], fw, fh, opaque_bg=False)
                    # Note: UID #121 (沼澤怪物) slot 0 (`idle`) is a 320x200 0-opaque placeholder in FIGANI.DAT;
                    # skip completely empty single-frame idle placeholders so the engine falls back cleanly to `attack` F00 or map sprite!
                    if s_name == "idle" and fcnt == 1 and not any(abuf):
                        continue
                    decoded_imgs.append((ox, oy, dly, sfx, hit_flag, fg_layer, fw, fh, indices_to_rgba(ibuf, abuf, fw, fh, pal)))
            if decoded_imgs:
                strip_w = sum(x[6] for x in decoded_imgs)
                strip_h = max(x[7] for x in decoded_imgs)
                strip = Image.new("RGBA", (strip_w, strip_h), (0, 0, 0, 0))
                frames_info = []
                cx = 0
                for ox, oy, dly, sfx, hit_flag, fg_layer, fw, fh, im in decoded_imgs:
                    strip.paste(im, (cx, 0))
                    f_meta = {"sx": cx, "w": fw, "h": fh, "ox": ox, "oy": oy, "delay": dly, "sfx": sfx}
                    if hit_flag:
                        f_meta["hitFlag"] = hit_flag
                    if fg_layer:
                        f_meta["fgLayer"] = True
                    frames_info.append(f_meta)
                    cx += fw
                rel_file = f"figani/u_{uid:03d}_{s_name}.png"
                strip.save(OUT_DIR / rel_file, optimize=True)
                has_valid_split = 0 < split_frame < len(frames_info)
                eff_split = split_frame if has_valid_split else len(frames_info)
                unit_slots[s_name] = {
                    "file": f"assets/{rel_file}",
                    "frameCount": len(frames_info),
                    "stripW": strip_w,
                    "stripH": strip_h,
                    "isRemote": bool(is_remote and has_valid_split),
                    "splitFrame": eff_split,
                    "sfxBankCode": sfx_bank_code,
                    "sfxBankChunk": sfx_bank_chunk,
                    "frames": frames_info,
                }
                extracted_strips += 1
        if unit_slots:
            figani_by_unit[str(uid)] = unit_slots
    print(f"  [OK] Extracted {extracted_strips} FIGANI strips across {len(figani_by_unit)} / 136 unit IDs")

    # 5b. FDOTHER.DAT -> Spell & Summon Effect Animation Strips (`spells/sp_XXX.png`)
    spell_strips: dict[str, dict] = {}
    for oidx in FDOTHER_SPELL_CHUNKS:
        if oidx >= len(other_chunks):
            continue
        ch = other_chunks[oidx]
        if len(ch) < 12:
            continue
        fcnt = ch[0]
        if fcnt <= 0 or len(ch) < 8 + fcnt * 4:
            continue
        foffs = list(struct.unpack_from(f"<{fcnt}I", ch, 8)) + [len(ch)]
        decoded_imgs = []
        for k in range(fcnt):
            fr = ch[foffs[k] : foffs[k + 1]]
            if len(fr) < 14:
                continue
            ox, oy = struct.unpack_from("<hh", fr, 0)
            sfx, hit_flag, dly = fr[4], fr[5], max(1, fr[6])
            fw, fh = struct.unpack_from("<HH", fr, 9)
            if 1 <= fw <= 320 and 1 <= fh <= 220:
                ibuf, abuf = decode_fd_rle(fr[13:], fw, fh, opaque_bg=False)
                decoded_imgs.append((ox, oy, dly, sfx, hit_flag, fw, fh, indices_to_rgba(ibuf, abuf, fw, fh, pal)))
        if decoded_imgs:
            strip_w = sum(x[5] for x in decoded_imgs)
            strip_h = max(x[6] for x in decoded_imgs)
            strip = Image.new("RGBA", (strip_w, strip_h), (0, 0, 0, 0))
            frames_info = []
            cx = 0
            for ox, oy, dly, sfx, hit_flag, fw, fh, im in decoded_imgs:
                strip.paste(im, (cx, 0))
                f_meta = {"sx": cx, "w": fw, "h": fh, "ox": ox, "oy": oy, "delay": dly, "sfx": sfx}
                if hit_flag:
                    f_meta["hitFlag"] = hit_flag
                frames_info.append(f_meta)
                cx += fw
            rel_file = f"spells/sp_{oidx:03d}.png"
            strip.save(OUT_DIR / rel_file, optimize=True)
            spell_strips[str(oidx)] = {
                "file": f"assets/{rel_file}",
                "frameCount": len(frames_info),
                "stripW": strip_w,
                "stripH": strip_h,
                "frames": frames_info,
            }
    print(f"  [OK] Extracted {len(spell_strips)} FDOTHER spell & summon animation strips")

    # 6. FDSHAP.DAT -> 33 battlefield tilesets + terrain tables
    shap_chunks = read_llll_chunks(FD2_DIR / "FDSHAP.DAT")
    terrain_tables = []
    tileset_metas = []
    for m in range(33):
        tmeta = extract_sprite_bank_to_atlas(
            shap_chunks[2 * m], pal, 16, OUT_DIR / "tilesets" / f"map_{m:02d}.png", opaque_bg=True
        )
        tileset_metas.append(tmeta)
        tprop_raw = shap_chunks[2 * m + 1]
        props = [list(tprop_raw[ti * 4 : (ti + 1) * 4]) for ti in range(len(tprop_raw) // 4)]
        terrain_tables.append(props)
    print("  [OK] Extracted 33 map tileset PNGs and terrain property tables")

    # 7. FDTXT.DAT -> Bank 0 system strings + Banks 1..33 chapter dialogues
    txt_chunks = read_llll_chunks(FD2_DIR / "FDTXT.DAT")
    b0 = txt_chunks[0]
    n_sys = struct.unpack_from("<H", b0, 0)[0] // 2
    sys_offs = list(struct.unpack_from(f"<{n_sys}H", b0, 0)) + [len(b0)]
    sys_strings = []
    for i in range(n_sys):
        raw = b0[sys_offs[i] : sys_offs[i + 1]]
        gids = [g for g in struct.unpack(f"<{len(raw) // 2}H", raw) if g < 1824]
        sys_strings.append(gids)

    # 8. FD2.EXE (clean original executable; FD2.EX_ is NOT read!)
    exe = (FD2_DIR / "FD2.EXE").read_bytes()
    item_needle = b"\x01\x0a\x00\x5f\x00\x00\x00\x00\x00\x00\x00\x01\x01"
    ITEM_BASE = exe.find(item_needle)
    assert ITEM_BASE == 344237, f"Unexpected FD2.EXE item table offset: {ITEM_BASE}"
    PROMO_PAIR_BASE = ITEM_BASE + (0x7A612 - 0x792C1)   # 349182 (36 * 2B for id 32..67)
    SPELL_BASE = ITEM_BASE + (0x7AA11 - 0x792C1)        # 350205 (36 * 7B)
    ENEMY_CLASS_BASE = ITEM_BASE + (0x7AB0D - 0x792C1)  # 350457 (68 * 10B for id 68..135)
    HERO_BASE = ITEM_BASE + (0x7ADB5 - 0x792C1)         # 351137 (32 * 24B for id 0..31)
    GROWTH_BASE = ITEM_BASE + (0x7B0B5 - 0x792C1)       # 351905 (68 * 11B for id 0..67)
    SHOP_BASE = ITEM_BASE + (0x7B3A1 - 0x792C1)         # 352653 (30 * 31B for ch 1..30)
    SPELL_LEARN_BASE = ITEM_BASE + (0x7B6C7 - 0x792C1)  # 353459 (20 * 12B)

    # Items (215 genuine items: 0..214, mapped to sysStrings[181..395])
    items = []
    for iid in range(215):
        rec = exe[ITEM_BASE + iid * 23 : ITEM_BASE + (iid + 1) * 23]
        itype = rec[0]
        ap, hit, dp, ev = struct.unpack_from("<hhhh", rec, 1)
        status_eff, status_rate, r_min, r_max = rec[9], rec[10], rec[11], rec[12]
        use_eff, use_val = rec[13], struct.unpack_from("<H", rec, 14)[0]
        use_range, use_tgt_raw, use_aoe = rec[16], rec[17], rec[18]
        use_target = "ally" if use_tgt_raw == 1 else ("enemy" if use_tgt_raw == 0 else "none")
        price = struct.unpack_from("<H", rec, 19)[0]
        name_glyphs = sys_strings[181 + iid] if (181 + iid) < len(sys_strings) else []
        name_zh = ITEM_NAMES_ZH[iid] if iid < len(ITEM_NAMES_ZH) else f"道具#{iid}"
        if itype == 34:
            cat = "special"
        elif itype in (32, 33):
            cat = "consumable"
        elif 21 <= itype <= 31:
            cat = "armor"
        else:
            cat = "weapon"
        items.append({
            "id": iid,
            "nameZh": name_zh,
            "nameGlyphs": name_glyphs,
            "sysStringIndex": 181 + iid,
            "category": cat,
            "itemType": itype,
            "ap": ap,
            "hit": hit,
            "dp": dp,
            "ev": ev,
            "statusEffect": status_eff,
            "statusRate": status_rate,
            "minRange": max(1, r_min) if cat == "weapon" else 1,
            "maxRange": max(1, r_max) if cat == "weapon" else 1,
            "useEffect": use_eff,
            "useVal": use_val,
            "useRange": use_range,
            "useTarget": use_target,
            "useAoe": use_aoe,
            "price": max(0, price),
        })

    # Spells (36 spells: 0..35, mapped to sysStrings[441..476]!)
    OBJ2_SPELL_FX_BASE = 327168
    map_fx_starts = list(exe[OBJ2_SPELL_FX_BASE + 7987 : OBJ2_SPELL_FX_BASE + 7987 + 33])
    map_fx_counts = list(exe[OBJ2_SPELL_FX_BASE + 8020 : OBJ2_SPELL_FX_BASE + 8020 + 33])
    map_sfx_indices = list(exe[OBJ2_SPELL_FX_BASE + 8053 : OBJ2_SPELL_FX_BASE + 8053 + 36])
    cutaway_spell_sfx_banks = list(exe[OBJ2_SPELL_FX_BASE + 9676 : OBJ2_SPELL_FX_BASE + 9676 + 10])
    summon_sfx_banks = list(exe[OBJ2_SPELL_FX_BASE + 9563 : OBJ2_SPELL_FX_BASE + 9563 + 4])
    spells = []
    for sid in range(36):
        rec = exe[SPELL_BASE + sid * 7 : SPELL_BASE + (sid + 1) * 7]
        power = struct.unpack_from("<H", rec, 0)[0]
        hit, dist_raw, aoe, mp, target = rec[2], rec[3], rec[4], rec[5], rec[6]
        name_glyphs = sys_strings[441 + sid] if (441 + sid) < len(sys_strings) else []
        anim_e, anim_h, anim_align, sp_cat, has_cutaway, is_atk_magic = SPELL_META_MAP.get(
            sid, (None, None, "screen_abs", "unused", False, False)
        )
        m_start = map_fx_starts[sid] if sid < len(map_fx_starts) else 0
        m_cnt = map_fx_counts[sid] if sid < len(map_fx_counts) else 0
        m_sfx = map_sfx_indices[sid] if sid < len(map_sfx_indices) else 0
        cut_sfx_bank = (
            cutaway_spell_sfx_banks[sid]
            if sid < 10
            else (summon_sfx_banks[sid - 32] if 32 <= sid <= 35 else 0)
        )
        sp_obj = {
            "id": sid,
            "nameZh": SPELL_NAMES_ZH[sid],
            "nameGlyphs": name_glyphs,
            "sysStringIndex": 441 + sid,
            "power": power,
            "hit": hit,
            "castRange": max(0, dist_raw & 0x0F),
            "isLinear": bool(dist_raw & 0x10),
            "aoe": aoe,
            "mpCost": mp,
            "targetType": "ally" if target == 1 else "enemy",
            "spellCategory": sp_cat,
            "hasCutawayAnim": has_cutaway,
            "isAttackMagic": is_atk_magic,
            "mapFxStart": m_start if m_cnt > 0 else None,
            "mapFxCount": m_cnt if m_cnt > 0 else None,
            "mapSfxIdx": m_sfx if m_sfx > 0 else None,
            "cutawaySfxBank": cut_sfx_bank if cut_sfx_bank > 0 else None,
        }
        if anim_e is not None:
            sp_obj["animEnemyStripId"] = anim_e
        if anim_h is not None:
            sp_obj["animHeroStripId"] = anim_h
        if anim_e is not None or anim_h is not None:
            sp_obj["animAlign"] = anim_align
        spells.append(sp_obj)

    # Spell Learning Lists (20 lists x 6 (level, spellId) pairs)
    spell_learn_lists = []
    for lid in range(20):
        raw = exe[SPELL_LEARN_BASE + lid * 12 : SPELL_LEARN_BASE + (lid + 1) * 12]
        entries = []
        for k in range(6):
            lv, sid = raw[2 * k], raw[2 * k + 1]
            if lv != 0xFF and sid < len(spells):
                entries.append({"level": lv, "spellId": sid, "spellNameZh": SPELL_NAMES_ZH[sid]})
        spell_learn_lists.append(entries)

    # Growth Records for IDs 0..67 (32 base heroes + 36 promoted slots)
    # Verified in FD2.EXE fn_4773 (L4854..L5155) & Church Promotion (L136860..L136950):
    # Byte order is AP=[r[0],r[1]], DP=[r[2],r[3]], DX=[r[4],r[5]], HP=[r[6],r[7]], MP=[r[8],r[9]], spellListId=r[10]!
    growth_records = []
    for gid in range(68):
        r = exe[GROWTH_BASE + gid * 11 : GROWTH_BASE + (gid + 1) * 11]
        slist_id = None if r[10] == 0xFF or r[10] >= len(spell_learn_lists) else r[10]
        growth_records.append({
            "id": gid,
            "ap": [r[0], r[1]],
            "dp": [r[2], r[3]],
            "dx": [r[4], r[5]],
            "hp": [r[6], r[7]],
            "mp": [r[8], r[9]],
            "spellListId": slist_id,
            "learnableSpells": spell_learn_lists[slist_id] if slist_id is not None else [],
        })

    # Obj 2 combat tables (Obj 2 starts at file offset 327,168 in FD2.EXE)
    OBJ2_BASE = 327168
    OBJ3_BASE = 343552
    terrain_ap_mod = list(struct.unpack("<6i", exe[OBJ2_BASE + 6674 : OBJ2_BASE + 6674 + 24]))
    terrain_dp_mod = list(struct.unpack("<6i", exe[OBJ2_BASE + 6698 : OBJ2_BASE + 6698 + 24]))
    class_magic_def_tenths = list(struct.unpack("<28i", exe[OBJ2_BASE + 8086 : OBJ2_BASE + 8086 + 112]))
    class_crit_rates = list(exe[OBJ2_BASE + 9115 : OBJ2_BASE + 9115 + 28])
    camp_only_flags = list(exe[OBJ2_BASE + 9913 : OBJ2_BASE + 9913 + 31])  # 1-indexed by chapter 1..30
    class_move_costs = [
        list(exe[OBJ3_BASE + 5702 + r * 20 : OBJ3_BASE + 5702 + (r + 1) * 20]) for r in range(29)
    ]

    # Promoted Slot -> (heroClassId, mvBonus) pairs (32..67)
    promo_slot_info: dict[int, dict] = {}
    for pid in range(32, 68):
        b0, b1 = exe[PROMO_PAIR_BASE + (pid - 32) * 2 : PROMO_PAIR_BASE + (pid - 31) * 2]
        promo_slot_info[pid] = {
            "heroClassId": b0,
            "classNameZh": HERO_CLASS_NAMES_ZH.get(b0, f"職業#{b0}"),
            "classGlyphs": sys_strings[150 + b0] if (150 + b0) < len(sys_strings) else [],
            "promoFlag": b1,
            "mvBonus": b1,
        }

    # Hero Classes Dictionary (1..28, mapped to sysStrings[151..178])
    hero_classes = []
    for hcid in range(1, 29):
        is_flyer = hcid in (15, 19)
        is_cav = hcid in (3, 11)
        mv_default = 8 if is_flyer else (7 if is_cav else (6 if hcid in (15, 23, 28) else (5 if hcid in (8, 9, 10, 12, 16, 17, 18, 20, 24) else 4)))
        hero_classes.append({
            "id": hcid,
            "nameZh": HERO_CLASS_NAMES_ZH.get(hcid, "？？？"),
            "nameGlyphs": sys_strings[150 + hcid] if (150 + hcid) < len(sys_strings) else [],
            "sysStringIndex": 150 + hcid,
            "mv": mv_default,
            "critRate": class_crit_rates[hcid - 1] if (hcid - 1) < len(class_crit_rates) else 0,
            "magicDamageTakenTenths": class_magic_def_tenths[hcid - 1] if (hcid - 1) < len(class_magic_def_tenths) else 10,
            "moveMode": "fly" if is_flyer else ("cavalry" if is_cav else "foot"),
        })
    hero_class_by_id = {c["id"]: c for c in hero_classes}

    # Enemy Unit Classes (68 records at ENEMY_CLASS_BASE, corresponding to unit IDs 68..135!)
    # Verified in FD2.EXE GLOBAL_3_6905: rec[2..3] is uint16 hpPerLv!
    # Exact FD2.EXE fn_61827(unit) flying rule: class_id == 19 or (race_id in (4, 5) and uid != 28) (plus class 15 龍劍士 in GLOBAL_3_5702).
    enemy_classes = []
    for cid in range(68):
        uid = 68 + cid
        rec_bytes = exe[ENEMY_CLASS_BASE + cid * 10 : ENEMY_CLASS_BASE + (cid + 1) * 10]
        rec = list(rec_bytes)
        hp_per_lv = struct.unpack_from("<H", rec_bytes, 2)[0]
        race_id = rec[0] if 1 <= rec[0] <= 10 else 9
        hcid = rec[1]
        zh = UNIT_68_135_NAMES_ZH.get(uid, f"單位#{uid}")
        is_flyer = (hcid in (15, 19)) or (race_id in (4, 5) and uid != 28)
        is_cav = (not is_flyer) and (hcid in (3, 11))
        enemy_classes.append({
            "id": cid,
            "unitId": uid,
            "nameZh": zh,
            "nameGlyphs": sys_strings[uid + 1] if (uid + 1) < len(sys_strings) else [],
            "raceId": race_id,
            "raceZh": RACE_NAMES_ZH.get(race_id, "其他"),
            "heroClassEquiv": hcid,
            "hpGrowth": max(1, hp_per_lv),
            "mpGrowth": rec[4],
            "apGrowth": rec[5],
            "dpGrowth": rec[6],
            "dxGrowth": rec[7],
            "mv": max(0, min(12, rec[8])),
            "expBase": max(1, rec[9]),
            "moveMode": "fly" if is_flyer else ("cavalry" if is_cav else "foot"),
        })

    # Playable Heroes (32 heroes: 0..31, 0-INDEXED!)
    # Exact recruitment stat initialization verified in FD2.EXE fn_4773 (L4846..L5188):
    #   maxHp = rec_hp + (lv - 1) * gr.hp[0]
    #   maxMp = rec_mp + (lv - 1) * gr.mp[0]
    #   baseAp = rec_ap + lv * gr.ap[0]
    #   baseDp = rec_dp + lv * gr.dp[0]
    #   baseDx = rec_dx + lv * gr.dx[0]
    heroes = []
    for hid in range(32):
        rec = exe[HERO_BASE + hid * 24 : HERO_BASE + (hid + 1) * 24]
        race_id, hcls_id, lv = rec[0], rec[1], max(1, rec[2])
        rec_hp = struct.unpack_from("<H", rec, 3)[0]
        rec_mp = struct.unpack_from("<H", rec, 5)[0]
        mv = max(4, rec[7])
        spell_mask = int.from_bytes(rec[8:12], "little")
        sp_list = [bit for bit in range(36) if (spell_mask >> bit) & 1]
        inv_list = [b for b in rec[12:18] if b != 0xFF and b < len(items)]
        b_ap, b_dp, b_dx = struct.unpack_from("<HHH", rec, 18)
        gr = growth_records[hid]
        hp = max(12, rec_hp + (lv - 1) * gr["hp"][0])
        mp = max(0, rec_mp + (lv - 1) * gr["mp"][0])
        ap = max(1, b_ap + lv * gr["ap"][0])
        dp = max(1, b_dp + lv * gr["dp"][0])
        dx = max(1, b_dx + lv * gr["dx"][0])

        # Build verified promotion chain for this hero
        promotions = [
            {
                "tier": 1,
                "unitId": hid,
                "heroClassId": hcls_id,
                "classNameZh": HERO_CLASS_NAMES_ZH.get(hcls_id, "？？？"),
                "classGlyphs": sys_strings[150 + hcls_id] if (150 + hcls_id) < len(sys_strings) else [],
                "portraitId": hid,
                "spriteGroup": hid,
                "mvBonus": 0,
                "reqItemId": None,
                "reqItemNameZh": None,
                "growth": gr,
            }
        ]
        # Heroes 0..17 (except pre-promoted 7=蘭斯洛特 and 16=凱拉斯) promote at Lv20!
        if hid < 18 and hid not in (7, 16):
            t2_uid = hid + 32
            p2 = promo_slot_info[t2_uid]
            promotions.append({
                "tier": 2,
                "unitId": t2_uid,
                "heroClassId": p2["heroClassId"],
                "classNameZh": p2["classNameZh"],
                "classGlyphs": p2["classGlyphs"],
                "portraitId": t2_uid,
                "spriteGroup": t2_uid if sprite_row_active_frames.get(t2_uid, 0) > 0 else hid,
                "mvBonus": p2["mvBonus"],
                "reqItemId": None,
                "reqItemNameZh": "Lv20 教會轉職",
                "growth": growth_records[t2_uid],
            })
            if hid in HERO_SECRET_PROMO_ITEMS:
                t3_uid, req_iid = HERO_SECRET_PROMO_ITEMS[hid]
                p3 = promo_slot_info[t3_uid]
                # Note: slot 53 DATO is borrowed by Armored General NPC, so Havart Tier 3 keeps DATO 35 portrait with FIG/ICO 53!
                t3_portrait = 35 if t3_uid == 53 else t3_uid
                t3_sprite = t3_uid if sprite_row_active_frames.get(t3_uid, 0) >= 4 else (hid + 32)
                promotions.append({
                    "tier": 3,
                    "unitId": t3_uid,
                    "heroClassId": p3["heroClassId"],
                    "classNameZh": p3["classNameZh"],
                    "classGlyphs": p3["classGlyphs"],
                    "portraitId": t3_portrait,
                    "spriteGroup": t3_sprite,
                    "mvBonus": p3["mvBonus"],
                    "reqItemId": req_iid,
                    "reqItemNameZh": items[req_iid]["nameZh"],
                    "growth": growth_records[t3_uid],
                })
            # Special FD2 secret promotion: 悠妮 (hid=9) + 精靈契印 (item 90) -> slot 52 召喚師!
            if hid == 9:
                p_sum = promo_slot_info[52]
                promotions.append({
                    "tier": 3,
                    "unitId": 52,
                    "heroClassId": p_sum["heroClassId"],
                    "classNameZh": p_sum["classNameZh"],
                    "classGlyphs": p_sum["classGlyphs"],
                    "portraitId": 52,
                    "spriteGroup": 52,
                    "mvBonus": p_sum["mvBonus"],
                    "reqItemId": 90,
                    "reqItemNameZh": items[90]["nameZh"],
                    "growth": growth_records[52],
                })

        heroes.append({
            "id": hid,
            "hexId": f"0x{hid:02x}",
            "nameZh": HERO_NAMES_ZH[hid],
            "nameGlyphs": sys_strings[hid + 1],
            "sysStringIndex": hid + 1,
            "portraitId": hid,
            "spriteGroup": hid,
            "race": race_id,
            "raceZh": RACE_NAMES_ZH.get(race_id, "人類"),
            "raceGlyphs": sys_strings[140 + race_id] if (140 + race_id) < len(sys_strings) else [],
            "classId": hcls_id,
            "classNameZh": HERO_CLASS_NAMES_ZH.get(hcls_id, "？？？"),
            "classGlyphs": sys_strings[150 + hcls_id] if (150 + hcls_id) < len(sys_strings) else [],
            "level": lv,
            "maxHp": hp,
            "maxMp": mp,
            "baseAp": ap,
            "baseDp": dp,
            "baseDx": dx,
            "mv": mv,
            "moveMode": (
                "fly"
                if (hcls_id in (15, 19) or (race_id in (4, 5) and hid != 28))
                else ("cavalry" if hcls_id in (3, 11) else "foot")
            ),
            "items": inv_list,
            "spells": sp_list,
            "growth": gr,
            "promotions": promotions,
        })

    # Chapter Shops: 26 * 31-byte town records at SHOP_BASE (352,653 .. 353,459; fn_255161 `(ch - 1) * 31` for ch 1..26),
    # while GLOBAL_2_9913[ch] != 0 marks Camp-only chapters (22, 23, 24, 27, 28, 29, 30 — no Town!).
    # Do NOT read past 26 * 31 bytes (offset 353,459 is SPELL_LEARN_BASE!).
    shops = []
    last_town_shop = {"secretTrigger": [0, 0, 0], "weaponShop": [], "itemShop": [], "secretShop": []}
    for ch_idx in range(30):
        ch_num = ch_idx + 1
        is_camp_only = bool(camp_only_flags[ch_num]) if ch_num < len(camp_only_flags) else True
        if not is_camp_only and ch_idx < 26:
            rec = list(exe[SHOP_BASE + ch_idx * 31 : SHOP_BASE + (ch_idx + 1) * 31])
            w_shop = [x for x in rec[3:15] if x != 0xFF and x < len(items)]
            i_shop = [x for x in rec[15:23] if x != 0xFF and x < len(items)]
            s_shop = [x for x in rec[23:31] if x != 0xFF and x < len(items)]
            last_town_shop = {
                "secretTrigger": rec[:3],
                "weaponShop": w_shop,
                "itemShop": i_shop,
                "secretShop": s_shop,
            }
            shops.append({
                "chapter": ch_num,
                "isCampOnly": False,
                **last_town_shop,
            })
        else:
            shops.append({
                "chapter": ch_num,
                "isCampOnly": True,
                "secretTrigger": [0, 0, 0],
                "weaponShop": list(last_town_shop["weaponShop"]),
                "itemShop": list(last_town_shop["itemShop"]),
                "secretShop": [],
            })

    # Helper to resolve any 0-indexed unit/speaker ID (0..135) cleanly with strict FD2.EXE role & battlefield flags!
    hero_by_id = {h["id"]: h for h in heroes}
    promo_hero_owner: dict[int, int] = {}
    for h in heroes:
        for pr in h["promotions"]:
            if pr["tier"] > 1:
                promo_hero_owner[pr["unitId"]] = h["id"]

    def resolve_unit_identity(uid: int) -> dict:
        if 0 <= uid <= 31:
            h = hero_by_id[uid]
            return {
                "nameZh": h["nameZh"],
                "nameGlyphs": h["nameGlyphs"],
                "classNameZh": h["classNameZh"],
                "classGlyphs": h["classGlyphs"],
                "raceId": h["race"],
                "raceZh": h["raceZh"],
                "portraitId": uid,
                "spriteGroup": uid,
                "role": "hero",
                "appearsOnBattlefield": True,
                "canAttack": True,
                "usageNoteZh": "我方參戰英雄",
                "baseHeroId": uid,
            }
        elif 32 <= uid <= 67:
            bh_id = promo_hero_owner.get(uid)
            pinfo = promo_slot_info[uid]
            if bh_id is not None:
                bh = hero_by_id[bh_id]
                tier = 2 if uid < 50 else 3
                # Note: DATO[53] is borrowed by Armored Imperial General NPC in dialogues, so Havart Tier-3 (#53) uses DATO[35] portrait!
                eff_pid = 35 if uid == 53 else uid
                return {
                    "nameZh": bh["nameZh"],
                    "nameGlyphs": bh["nameGlyphs"],
                    "classNameZh": pinfo["classNameZh"],
                    "classGlyphs": pinfo["classGlyphs"],
                    "raceId": bh["race"],
                    "raceZh": bh["raceZh"],
                    "portraitId": eff_pid,
                    "spriteGroup": uid if sprite_row_active_frames.get(uid, 0) >= 4 else bh_id,
                    "role": f"hero_promo_t{tier}",
                    "appearsOnBattlefield": True,
                    "canAttack": True,
                    "usageNoteZh": f"我方 Lv20 {'隱藏道具' if tier == 3 else '教會'}轉職英雄",
                    "baseHeroId": bh_id,
                }
            if uid in STORY_NPC_SLOTS:
                npc_zh, npc_cls = STORY_NPC_SLOTS[uid]
                has_art = portrait_has_art.get(uid, False) and uid not in (57, 67)
                note = (
                    "第13章劇情對話長老 (不上戰場)"
                    if uid == 39
                    else "序幕與終章王城過場劇情王族 (不上戰場)"
                    if uid in (48, 66)
                    else "原版未使用保留空位 (不上戰場)"
                )
                return {
                    "nameZh": npc_zh,
                    "nameGlyphs": [],
                    "classNameZh": npc_cls,
                    "classGlyphs": [],
                    "raceId": 1,
                    "raceZh": "人類",
                    "portraitId": uid,
                    "spriteGroup": uid if sprite_row_active_frames.get(uid, 0) > 0 else 0,
                    "role": "story_npc" if has_art else "unused",
                    "appearsOnBattlefield": False,
                    "canAttack": False,
                    "usageNoteZh": note,
                    "baseHeroId": None,
                }
            return {
                "nameZh": f"保留#{uid}",
                "nameGlyphs": [],
                "classNameZh": pinfo["classNameZh"],
                "classGlyphs": pinfo["classGlyphs"],
                "raceId": 1,
                "raceZh": "人類",
                "portraitId": uid,
                "spriteGroup": 0,
                "role": "unused",
                "appearsOnBattlefield": False,
                "canAttack": False,
                "usageNoteZh": "原版未使用保留空位 (不上戰場)",
                "baseHeroId": None,
            }
        else:
            ec = enemy_classes[uid - 68]
            zh = UNIT_68_135_NAMES_ZH.get(uid, f"單位#{uid}")
            gids = sys_strings[uid + 1] if (uid + 1) < len(sys_strings) else []

            if 128 <= uid <= 132:
                town_notes = {
                    128: "城鎮武器/防具店老闆頭像 (不上戰場)",
                    129: "城鎮酒店女郎頭像 (不上戰場)",
                    130: "城鎮道具店店員頭像 (不上戰場)",
                    131: "城鎮教會神父頭像 (不上戰場)",
                    132: "城鎮秘密商店商人頭像 (不上戰場)",
                }
                role = "town_npc"
                appears_on_bf = False
                can_atk = False
                note = town_notes[uid]
            elif uid in (74, 75):
                role = "story_npc"
                appears_on_bf = False
                can_atk = False
                note = (
                    "營地存讀檔/城鎮出發確認與序幕/終章劇情NPC (絕不上戰場)"
                    if uid == 75
                    else "劇情對話專用惡魔頭像 (絕不上戰場)"
                )
            elif uid in (133, 134, 135):
                role = "villager"
                appears_on_bf = True
                can_atk = False
                note = "受保護戰場NPC：僅承受敵軍攻擊，無武器且絕不主動攻擊或反擊"
            elif uid in (68, 69, 70, 71, 72, 73):
                role = "ally_npc"
                appears_on_bf = True
                can_atk = True
                note = "戰場友軍作戰部隊"
            elif uid >= 116 or uid in (97, 103, 104, 105):
                role = "boss"
                appears_on_bf = True
                can_atk = True
                note = "戰場敵軍頭目 / 魔神 Boss"
            else:
                role = "enemy"
                appears_on_bf = True
                can_atk = True
                note = "戰場敵軍作戰部隊"

            # Stationary multi-tile bosses (104, 105, 121, 127) use fallback dragon/monster icon on tactical grid if needed
            fallback_spr = {104: 106, 105: 106, 121: 108, 127: 126}.get(uid, 76)
            spr = uid if sprite_row_active_frames.get(uid, 0) > 0 else fallback_spr
            return {
                "nameZh": zh,
                "nameGlyphs": gids,
                "classNameZh": "國王" if uid == 135 else zh,
                "classGlyphs": gids,
                "raceId": ec["raceId"],
                "raceZh": ec["raceZh"],
                "portraitId": min(135, uid),
                "spriteGroup": spr,
                "role": role,
                "appearsOnBattlefield": appears_on_bf,
                "canAttack": can_atk,
                "usageNoteZh": note,
                "baseHeroId": None,
            }

    # 9. FDFIELD.DAT -> 30 Tactical Battlefields (m=0..29) + 3 Scripted Cutscene Maps (m=30..32)
    field_chunks = read_llll_chunks(FD2_DIR / "FDFIELD.DAT")
    chapters_index = []
    unit_chapter_occ: dict[int, list[dict]] = {u: [] for u in range(136)}
    unit_cutscene_occ: dict[int, list[dict]] = {u: [] for u in range(136)}
    unit_chapter_spells: dict[int, set[int]] = {u: set() for u in range(136)}
    for h_init in heroes:
        if h_init["spells"]:
            unit_chapter_spells[h_init["id"]].update(h_init["spells"])
    speaker_occ: dict[int, dict] = {u: {"count": 0, "chapters": set()} for u in range(136)}

    for m in range(33):
        is_cutscene_map = m >= 30
        grid_raw = field_chunks[3 * m]
        ctrl_raw = field_chunks[3 * m + 1]
        spawn_raw = field_chunks[3 * m + 2]

        mw, mh = struct.unpack_from("<HH", grid_raw, 0)
        tprops = terrain_tables[m]
        cells = []
        for y in range(mh):
            row = []
            for x in range(mw):
                tid, evid = struct.unpack_from("<HH", grid_raw, 4 + (y * mw + x) * 4)
                tp = tprops[tid] if tid < len(tprops) else [0, 0, 4, 0]
                # [tileId, eventId, terrainBonusIdx (0..5), bgTaiId (0..55), tileFlags]
                # Exact `FD2.EXE` `fn_254016` & `fn_10621`:
                # - Passability is controlled strictly by `tp[1]` (`classMoveCosts[classId][tp[1]] >= 20`, i.e. `tp[1] in (1, 5)`).
                # - `tp[0] & 0x80` is NEVER blocked: it marks foreground roof/canopy overhang (`fn_10621 @11115`, clips bottom half of unit sprite).
                # - `tp[0] & 0x08` marks full bridge/archway occlusion (`fn_10621 @11100`).
                # - `tp[0] & 0x60` marks treasure chest (`0x20`) or hidden ground item (`0x40`).
                is_blocked = 1 if tp[1] == 5 else 0
                is_chest_flag = 2 if (tp[0] & 0x60) else 0
                is_hidden_ground = 0x40 if (tp[0] & 0x40) else 0
                is_roof_overhang = 0x80 if (tp[0] & 0x80) else 0
                is_bridge_tunnel = 0x08 if (tp[0] & 0x08) else 0
                row.append([tid, evid, tp[1], tp[2], is_blocked | is_chest_flag | is_hidden_ground | is_roof_overhang | is_bridge_tunnel])
            cells.append(row)

        map_id, max_deploy, enemy_cnt = ctrl_raw[0], ctrl_raw[1], ctrl_raw[2]
        turn_events = []
        for te in range(16):
            tr, ev_id, ev_phase = ctrl_raw[3 + te * 3], ctrl_raw[4 + te * 3], ctrl_raw[5 + te * 3]
            if ev_id != 0xFF:
                turn_events.append({"slot": te, "turn": tr, "eventId": ev_id, "phase": ev_phase})

        step_events = []
        for se in range(16):
            ev_id, ev_flag = ctrl_raw[51 + se * 2], ctrl_raw[52 + se * 2]
            if ev_id != 0xFF:
                step_events.append({"triggerIndex": se + 1, "eventId": ev_id, "flag": ev_flag})

        chests = []
        for ci in range(16):
            ct = ctrl_raw[83 + ci * 3]
            cv = struct.unpack_from("<H", ctrl_raw, 84 + ci * 3)[0]
            ctype = "gold" if ct == 1 else ("event" if ct == 2 else "item")
            chests.append({"chestIndex": ci, "type": ctype, "value": cv})

        # Parse Spawn Slots (`fn_2189` L2651: `v0 = GLOBAL_2_15331 * 6`):
        # `urec[0..enemy_cnt-1]` pair 1-to-1 with `raw_spawns[0..enemy_cnt-1]`;
        # `player_slots` are strictly `raw_spawns[enemy_cnt : enemy_cnt + max_deploy]`!
        sp_cnt = struct.unpack_from("<H", spawn_raw, 0)[0]
        raw_spawns = []
        for si in range(sp_cnt):
            if 2 + (si + 1) * 6 <= len(spawn_raw):
                raw_spawns.append(struct.unpack_from("<HHH", spawn_raw, 2 + si * 6))

        n_urecs = (len(ctrl_raw) - 131) // 26
        active_urec_limit = min(n_urecs, enemy_cnt) if m < 30 else n_urecs
        all_urec_uids = [ctrl_raw[131 + ui * 26 + 1] for ui in range(n_urecs)]
        player_slots = (
            [[sx, sy] for (sx, sy, _) in raw_spawns[enemy_cnt : enemy_cnt + max_deploy]]
            if max_deploy > 0
            else []
        )

        units = []
        ch_uid_counter: dict[tuple[int, str], int] = {}
        for ui in range(active_urec_limit):
            urec = ctrl_raw[131 + ui * 26 : 131 + (ui + 1) * 26]
            align_byte = urec[0]  # 0=enemy, 1=npc_ally, 2=player_join
            uid = urec[1]         # 0-INDEXED unit ID (0..135)!
            # Exact FD2.EXE `fn_3152` (`@4022..4040`):
            # - `urec[2]`  -> `unit[61]` (`aiChestIdx`, target chest index `0..15` for Mode 5 Treasure Thieves!)
            # - `urec[17]` -> `unit[52]` (`aiMode`: low 6 bits `0..11` = AI behavior, `0x80`/`0x40` = heal/item/spell flags)
            # - `urec[18]` -> `unit[53]` (`aiTargetX` coordinate or `escortUid` character ID in Mode 3 / 9)
            # - `urec[19]` -> `unit[54]` (`aiTargetY` coordinate)
            ai_chest_idx = urec[2]
            lv = max(1, urec[4])
            inv = [b for b in urec[5:13] if b != 0xFF and b < len(items)]
            sp_mask = int.from_bytes(urec[13:17], "little")
            sp_ids = [bit for bit in range(32) if bit != 31 and ((sp_mask >> bit) & 1)]
            ai_mode = urec[17]
            ai_tx = urec[18]
            ai_ty = urec[19]
            wave_group = urec[21]
            drop_type = urec[22]
            drop_val = struct.unpack_from("<H", urec, 23)[0]

            # Skip inactive placeholder filler records (wave_group == 255 at (0,0) or excess pool templates)
            if wave_group == 255 and m < 30:
                continue

            if ui < len(raw_spawns):
                sx, sy, _ = raw_spawns[ui]
            else:
                sx, sy = 2 + (ui % max(1, mw - 4)), 2 + (ui // max(1, mw - 4))

            faction = "enemy" if align_byte == 0 else ("ally" if align_byte == 1 else "player")
            ident = resolve_unit_identity(uid)
            ch_uid_counter[(uid, faction)] = ch_uid_counter.get((uid, faction), 0) + 1
            if not is_cutscene_map and sp_ids and 0 <= uid < 136 and ident["canAttack"]:
                unit_chapter_spells[uid].update(sp_ids)

            if uid in hero_by_id:
                h = hero_by_id[uid]
                # Exact FD2.EXE `fn_3152` (`L3624..L3770`): map-spawned hero `urec` uses `lv = urec[4]` directly
                # against `HERO_BASE[uid]` + `GROWTH_BASE[uid]` (NEVER `max(lv, h["level"])`, so Ch 1 `#1 哈諾` is Lv 1 and `#3 哈瓦特` guest is Lv 3)!
                hrec = exe[HERO_BASE + uid * 24 : HERO_BASE + (uid + 1) * 24]
                rec_hp = struct.unpack_from("<H", hrec, 3)[0]
                rec_mp = struct.unpack_from("<H", hrec, 5)[0]
                b_ap, b_dp, b_dx = struct.unpack_from("<HHH", hrec, 18)
                gr = growth_records[uid]
                max_hp = max(12, rec_hp + (lv - 1) * gr["hp"][0])
                max_mp = max(0, rec_mp + (lv - 1) * gr["mp"][0])
                base_ap = max(1, b_ap + lv * gr["ap"][0])
                base_dp = max(1, b_dp + lv * gr["dp"][0])
                base_dx = max(1, b_dx + lv * gr["dx"][0])
                mv = h["mv"]
                move_mode = h["moveMode"]
                class_id = h["classId"]
                if not inv:
                    inv = list(h["items"])
                if not sp_ids:
                    sp_ids = list(h["spells"])
                # In FD2.EXE, heroes who spawn as `player` (`align_byte == 2`) on a playable map (except Ch 1 temporary
                # guest `#3 哈瓦特`, who permanently joins in Ch 13 via `HERO_BASE[3]`) are recruited via `fn_4773(uid)`
                # followed by `fn_5382()`, which overwrites `HERO_BASE[uid]` dummy placeholders (`items=[0, 128/129], spells=[]`)
                # with their authentic battlefield `urec` level, stats, items, and initial spells (e.g. `#10 瑪琳` Lv 6 `[#13 治療術]`,
                # `#19 羅德曼` Lv 20 `[#28 淒煌斬]`, `#24 希爾法` Lv 8 8 spells, `#25 謝多` Lv 7 4 spells).
                if not is_cutscene_map and faction == "player" and uid != 3:
                    h["level"] = lv
                    h["maxHp"] = max_hp
                    h["maxMp"] = max_mp
                    h["baseAp"] = base_ap
                    h["baseDp"] = base_dp
                    h["baseDx"] = base_dx
                    h["items"] = list(inv)
                    h["spells"] = list(sp_ids)
                    unit_chapter_spells[uid].update(sp_ids)
            elif 68 <= uid <= 135:
                ec = enemy_classes[uid - 68]
                # Exact FD2.EXE GLOBAL_3_6905 spawn formula: stat = lv * perLv!
                max_hp = max(1, lv * ec["hpGrowth"])
                max_mp = max(0, lv * ec["mpGrowth"])
                base_ap = max(0, lv * ec["apGrowth"])
                base_dp = max(0, lv * ec["dpGrowth"])
                base_dx = max(0, lv * ec["dxGrowth"])
                mv = ec["mv"]
                move_mode = ec["moveMode"]
                class_id = ec["heroClassEquiv"]
                if not ident["canAttack"]:
                    sp_ids = []
            else:
                max_hp, max_mp, base_ap, base_dp, base_dx, mv, move_mode, class_id = 60, 0, 24, 14, 18, 5, "foot", 1

            units.append({
                "index": len(units),
                "urecIndex": ui,
                "uid": uid,
                "nameZh": ident["nameZh"],
                "nameGlyphs": ident["nameGlyphs"],
                "classNameZh": ident["classNameZh"],
                "classGlyphs": ident["classGlyphs"],
                "portraitId": ident["portraitId"],
                "spriteGroup": ident["spriteGroup"],
                "faction": faction,
                "classId": class_id,
                "moveMode": move_mode,
                "aiMode": ai_mode,
                "aiTargetX": ai_tx,
                "aiTargetY": ai_ty,
                "aiChestIdx": ai_chest_idx,
                "level": lv,
                "x": min(mw - 1, max(0, sx)),
                "y": min(mh - 1, max(0, sy)),
                "maxHp": max_hp,
                "maxMp": max_mp,
                "baseAp": base_ap,
                "baseDp": base_dp,
                "baseDx": base_dx,
                "mv": mv,
                "items": inv,
                "spells": sp_ids,
                "waveGroup": wave_group,
                "isBoss": drop_type in (2, 3) or ident["role"] == "boss",
                "drop": None if drop_type in (0xFF, 203) else {
                    "type": (
                        "item" if drop_type == 0
                        else "gold" if drop_type == 1
                        else "event" if drop_type == 2
                        else "dialogue"
                    ),
                    "value": drop_val,
                },
            })

        for (u_key, fac), cnt in ch_uid_counter.items():
            if 0 <= u_key < 136:
                if is_cutscene_map:
                    unit_cutscene_occ[u_key].append({"chapter": m + 1, "faction": fac, "count": cnt})
                else:
                    unit_chapter_occ[u_key].append({"chapter": m + 1, "faction": fac, "count": cnt})

        # Parse Chapter Dialogues from FDTXT[m + 1] with exact 0xFFEC/0xFFED slot resolution!
        dialogues = []
        if (m + 1) < len(txt_chunks):
            tb = txt_chunks[m + 1]
            if len(tb) >= 2:
                nd = struct.unpack_from("<H", tb, 0)[0] // 2
                doffs = list(struct.unpack_from(f"<{nd}H", tb, 0)) + [len(tb)]
                for di in range(nd):
                    segs = parse_dialogue_entry(tb[doffs[di] : doffs[di + 1]], max_deploy, all_urec_uids)
                    for seg in segs:
                        spk = seg["speaker"]
                        if spk is not None and 0 <= spk < 136:
                            speaker_occ[spk]["count"] += 1
                            speaker_occ[spk]["chapters"].add(m + 1)
                            s_ident = resolve_unit_identity(spk)
                            # Direct DATO[53] in 0xFFEE/0xFFEF is the Armored Imperial General NPC portrait!
                            if spk == 53:
                                seg["speakerNameZh"] = "帝國將軍"
                                seg["speakerGlyphs"] = []
                                seg["portraitId"] = 53
                            else:
                                seg["speakerNameZh"] = s_ident["nameZh"]
                                seg["speakerGlyphs"] = s_ident["nameGlyphs"]
                                seg["portraitId"] = spk if portrait_has_art.get(spk, False) else -1
                        else:
                            seg["speakerNameZh"] = "旁白"
                            seg["speakerGlyphs"] = []
                            seg["portraitId"] = -1
                    dialogues.append(segs)

        title_glyphs = sys_strings[550 + m] if (550 + m) < 580 else []
        win_glyphs = sys_strings[597 + 2 * m] if (597 + 2 * m) < 657 else sys_strings[597]
        lose_glyphs = sys_strings[598 + 2 * m] if (598 + 2 * m) < 657 else sys_strings[598]
        cutscene_titles_zh = {
            30: "終章・王城凱旋",
            31: "序幕(二)・森林啟程",
            32: "序幕(一)・王城啟程",
        }
        title_zh = cutscene_titles_zh.get(m, CHAPTER_TITLES_ZH[m] if m < len(CHAPTER_TITLES_ZH) else f"第{m+1}章")
        eff_max_deploy = max(1, max_deploy) if m < 30 else max_deploy

        ch_obj = {
            "id": m,
            "chapterNumber": m + 1,
            "isCutsceneMap": is_cutscene_map,
            "width": mw,
            "height": mh,
            "maxDeploy": eff_max_deploy,
            "titleZh": title_zh,
            "titleGlyphs": title_glyphs,
            "winGlyphs": win_glyphs,
            "loseGlyphs": lose_glyphs,
            "tileset": tileset_metas[m],
            "cells": cells,
            "playerSlots": player_slots,
            "turnEvents": turn_events,
            "stepEvents": step_events,
            "chests": chests,
            "units": units,
            "dialogues": dialogues,
        }
        (OUT_DIR / "chapters" / f"ch_{m:02d}.json").write_text(
            json.dumps(ch_obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )
        chapters_index.append({
            "id": m,
            "chapterNumber": m + 1,
            "isCutsceneMap": is_cutscene_map,
            "width": mw,
            "height": mh,
            "maxDeploy": ch_obj["maxDeploy"],
            "enemyCount": sum(1 for u in units if u["faction"] == "enemy"),
            "titleZh": title_zh,
            "titleGlyphs": title_glyphs,
            "winGlyphs": win_glyphs,
            "loseGlyphs": lose_glyphs,
        })
    print(f"  [OK] Extracted all 30 playable battlefields + 3 scripted cutscene maps + verified speaker dialogues")

    # 10. Build Canonical 0..135 Master Character & Image Dex (`character_dex.json`)
    unit_dex = []
    for uid in range(136):
        ident = resolve_unit_identity(uid)
        raw_sidx = uid + 1
        raw_glyphs = sys_strings[raw_sidx] if raw_sidx < len(sys_strings) else []
        # Non-battlefield NPCs (#39 Elder has leftover dummy paladin FIGANI from 7+32) never use combat FIGANI!
        eff_figani = figani_by_unit.get(str(uid), None) if ident["appearsOnBattlefield"] else None
        unit_dex.append({
            "id": uid,
            "hexId": f"0x{uid:02x}",
            "role": ident["role"],
            "appearsOnBattlefield": ident["appearsOnBattlefield"],
            "canAttack": ident["canAttack"],
            "usageNoteZh": ident["usageNoteZh"],
            "baseHeroId": ident["baseHeroId"],
            "nameZh": ident["nameZh"],
            "nameGlyphs": ident["nameGlyphs"],
            "rawSysStringIndex": raw_sidx,
            "rawSysGlyphs": raw_glyphs,
            "classNameZh": ident["classNameZh"],
            "classGlyphs": ident["classGlyphs"],
            "raceId": ident["raceId"],
            "raceZh": ident["raceZh"],
            "portraitId": ident["portraitId"],
            "hasPortrait": portrait_has_art.get(ident["portraitId"], False),
            "rawSpriteRow": uid,
            "rawSpriteFrames": sprite_row_active_frames.get(uid, 0),
            "effectiveSpriteGroup": ident["spriteGroup"],
            "figani": eff_figani,
            "growth": growth_records[uid] if uid < 68 else None,
            "enemyStats": enemy_classes[uid - 68] if uid >= 68 else None,
            "knownSpells": sorted(unit_chapter_spells[uid]) if ident["canAttack"] else [],
            "chapterAppearances": unit_chapter_occ[uid],
            "cutsceneAppearances": unit_cutscene_occ[uid],
            "dialogueSegments": speaker_occ[uid]["count"],
            "dialogueChapters": sorted(speaker_occ[uid]["chapters"]),
        })

    dex_payload = {
        "meta": {
            "game": "炎龍騎士團II：黃金城之謎 (Flame Dragon II: Legend of Golden Castle)",
            "sourceExecutable": "FD2.EXE (clean original; FD2.EX_ ignored)",
            "idConvention": "0-indexed across DATO.DAT (0..135), FDICON.B24 (0..139), FIGANI.DAT (3*id..3*id+2), FDFIELD.DAT (uid), and FDTXT.DAT speaker tags; FDTXT Bank 0 names at sysStrings[id + 1].",
            "totalUnitSlots": 136,
            "playableHeroes": 32,
            "promotedAndStorySlots": 36,
            "enemyAllyBossSummonSlots": 68,
            "battlefieldUnits": sum(1 for u in unit_dex if u["appearsOnBattlefield"]),
            "nonBattlefieldNpcs": sum(1 for u in unit_dex if not u["appearsOnBattlefield"]),
            "protectedBattlefieldNpcs": sum(1 for u in unit_dex if u["appearsOnBattlefield"] and not u["canAttack"]),
            "illustratedPortraits": sum(portrait_has_art.values()),
            "activeMapSpriteRows": sum(1 for v in sprite_row_active_frames.values() if v > 0),
            "unitsWithBattleAnim": sum(1 for u in unit_dex if u["figani"] is not None),
            "totalItems": len(items),
            "totalSpells": len(spells),
            "totalChapters": len(chapters_index),
        },
        "races": [
            {"id": rid, "nameZh": rzh, "nameGlyphs": sys_strings[140 + rid], "sysStringIndex": 140 + rid}
            for rid, rzh in sorted(RACE_NAMES_ZH.items())
        ],
        "heroClasses": hero_classes,
        "heroes": heroes,
        "unitDex": unit_dex,
        "items": items,
        "spells": spells,
        "spellStrips": spell_strips,
        "taiPlatforms": tai_meta,
        "terrainApMod": terrain_ap_mod,
        "terrainDpMod": terrain_dp_mod,
        "classMoveCosts": class_move_costs,
        "chapters": chapters_index,
    }
    (OUT_DIR / "character_dex.json").write_text(
        json.dumps(dex_payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("  [OK] Wrote public/assets/character_dex.json")

    # 11. FDMUS.DAT -> XMI Soundtrack JSON
    mus_chunks = read_llll_chunks(FD2_DIR / "FDMUS.DAT")
    tracks = []
    for midx, mch in enumerate(mus_chunks):
        ev_pos = mch.find(b"EVNT")
        if ev_pos >= 0 and ev_pos + 8 <= len(mch):
            ev_len = struct.unpack_from(">I", mch, ev_pos + 4)[0]
            payload = mch[ev_pos + 8 : ev_pos + 8 + ev_len]
            notes = parse_xmi_evnt(payload)
            if notes:
                dur = max(n[0] + n[4] for n in notes)
                tracks.append({
                    "id": len(tracks),
                    "sourceIndex": midx,
                    "name": f"BGM #{len(tracks) + 1:02d} (FD2 Track {midx})",
                    "duration": round(dur, 2),
                    "noteCount": len(notes),
                    "notes": notes,
                })
    (OUT_DIR / "music.json").write_text(json.dumps(tracks, separators=(",", ":")), encoding="utf-8")

    # 11b. Choreography Bytecode Table (Obj 3 + 10,200: 106 scripts `choreo_id = 0..105`)
    choreo_ptrs = list(struct.unpack_from("<106I", exe, OBJ3_BASE + 10200))
    choreography_scripts = []
    for cid, ptr in enumerate(choreo_ptrs):
        cur = OBJ3_BASE + ptr
        cmd_cnt = exe[cur]
        cur += 1
        cmds = []
        for _ in range(cmd_cnt):
            step_byte = exe[cur]
            n_actors = exe[cur + 1]
            cur += 2
            actors = []
            for _ in range(n_actors):
                actors.append([exe[cur], exe[cur + 1]])
                cur += 2
            is_flag = bool(step_byte & 0x80)
            val = step_byte & 0x7F
            kind = "hop" if (is_flag and val == 0) else ("pose" if is_flag else "walk")
            cmds.append({"kind": kind, "val": val, "actors": actors})
        choreography_scripts.append({"id": cid, "commands": cmds})
    (OUT_DIR / "choreography.json").write_text(
        json.dumps(choreography_scripts, separators=(",", ":")), encoding="utf-8"
    )

    # 11c. Post-Battle Formation Tables from Obj 2 (`fn_78790` sites across Ch 1..30)
    def read_obj2_bytes(off: int, length: int) -> list[int]:
        return list(exe[OBJ2_BASE + off : OBJ2_BASE + off + length])

    post_formations = {
        "2":  {"start": 0, "end": 6,  "xs": read_obj2_bytes(8385, 7),  "ys": read_obj2_bytes(8392, 7),  "dirs": read_obj2_bytes(8378, 7),  "cam": [0, 2],   "extra": [6, 2, 0, 2]},
        "4":  {"start": 0, "end": 6,  "xs": read_obj2_bytes(8399, 7),  "ys": read_obj2_bytes(8406, 7),  "dirs": read_obj2_bytes(8413, 7),  "cam": [4, 6],   "extra": [41, 12, 8, 0]},
        "6":  {"start": 0, "end": 8,  "xs": read_obj2_bytes(8420, 9),  "ys": read_obj2_bytes(8429, 9),  "dirs": read_obj2_bytes(8438, 9),  "cam": [2, 6],   "extra": [43, 12, 7, 2]},
        "7":  {"start": 0, "end": 9,  "xs": read_obj2_bytes(8447, 10), "ys": read_obj2_bytes(8457, 10), "dirs": 2,                         "cam": [14, 8],  "extra": [28, 14, 16, 0]},
        "11": {"start": 0, "end": 13, "xs": read_obj2_bytes(8489, 14), "ys": read_obj2_bytes(8503, 14), "dirs": read_obj2_bytes(8517, 14), "cam": [0, 4],   "extra": [14, 10, 2, 0]},
        "13": {"start": 0, "end": 15, "xs": read_obj2_bytes(8531, 16), "ys": read_obj2_bytes(8547, 16), "dirs": read_obj2_bytes(8563, 16), "cam": [10, 12], "extra": None},
        "15": {"start": 0, "end": 15, "xs": read_obj2_bytes(8579, 16), "ys": read_obj2_bytes(8595, 16), "dirs": 0,                         "cam": [25, 22], "extra": [65, 28, 30, 2]},
        "16": {"start": 0, "end": 15, "xs": read_obj2_bytes(8611, 16), "ys": read_obj2_bytes(8627, 16), "dirs": 0,                         "cam": [17, 17], "extra": [52, 23, 23, 2]},
        "17": {"start": 0, "end": 16, "xs": read_obj2_bytes(8643, 17), "ys": read_obj2_bytes(8660, 17), "dirs": read_obj2_bytes(8677, 17), "cam": [4, 18],  "extra": [17, 25, 8, 1]},
        "20": {"start": 0, "end": 24, "xs": read_obj2_bytes(8744, 25), "ys": read_obj2_bytes(8769, 25), "dirs": read_obj2_bytes(8794, 25), "cam": [10, 14], "extra": [25, 23, 14, 1]},
        "21": {"start": 0, "end": 15, "xs": read_obj2_bytes(8819, 16), "ys": read_obj2_bytes(8835, 16), "dirs": read_obj2_bytes(8851, 16), "cam": [18, 16], "extra": [72, 22, 25, 2]},
        "22": {"start": 0, "end": 16, "xs": read_obj2_bytes(8867, 17), "ys": read_obj2_bytes(8884, 17), "dirs": read_obj2_bytes(8901, 17), "cam": [14, 14], "extra": [17, 21, 21, 2]},
        "25": {"start": 0, "end": 15, "xs": read_obj2_bytes(8918, 16), "ys": read_obj2_bytes(8934, 16), "dirs": read_obj2_bytes(8950, 16), "cam": [5, 9],   "extra": None},
        "26": {"start": 0, "end": 15, "xs": read_obj2_bytes(8966, 16), "ys": read_obj2_bytes(8982, 16), "dirs": 2,                         "cam": [8, 9],   "extra": None},
        "29": {"start": 0, "end": 19, "xs": read_obj2_bytes(8999, 20), "ys": read_obj2_bytes(9019, 20), "dirs": read_obj2_bytes(9039, 20), "cam": [18, 16], "extra": None},
    }
    (OUT_DIR / "post_formations.json").write_text(
        json.dumps(post_formations, separators=(",", ":")), encoding="utf-8"
    )
    print(f"  [OK] choreography.json ({len(choreography_scripts)} scripts) & post_formations.json ({len(post_formations)} formations)")

    # 11d. FDOTHER.DAT -> Authentic 8-Bit Unsigned PCM Sound Effects Bundle (sfx_banks.json)
    # Verified in FD2.EXE fn_88726 / fn_88901 (AIL_init_sample default 11,025 Hz 8-bit unsigned mono PCM):
    #   - Bank 31 (GLOBAL_2_16108): Tactical UI & Unit Movement SFX (0=cursor, 2=dialogue, 3=death explosion,
    #     4=rest heal/turn phase, 5=confirm, 6=cancel, 7=click, 8=cross menu open, 9=footstep, 10=wing flap,
    #     11=horse gallop, 12=treasure chest)
    #   - Banks 48..53 (GLOBAL_2_9686[sfxBankCode-1]): Cutaway Combat Weapon & Motion SFX ([bank][0] = dodge/miss,
    #     [bank][1..6] = weapon swings, horse charge, bowstring, arrow/sword/axe/lance/punch/beam impacts)
    #   - Bank 64 (GLOBAL_2_15119): Map Item / Promotion / Event SFX
    #   - Bank 80 (GLOBAL_2_15123): On-Map Spell Cast ([80][1]), Spell Impacts ([80][GLOBAL_2_8053[sid]]), & Level-Up ([80][11])
    #   - Banks 82..94 (GLOBAL_2_16671): Cutaway Spell & Summon SFX ([bank][0] = caster magic chant, [bank][1..3] = spell impacts)
    sfx_target_chunks = [31, 48, 49, 50, 51, 52, 53, 64, 77, 78, 80, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95]
    sfx_samples: dict[str, str] = {}
    sfx_banks: dict[str, list[str | None]] = {}
    for sfx_cid in sfx_target_chunks:
        if sfx_cid >= len(other_chunks):
            continue
        raw_bank = other_chunks[sfx_cid]
        if raw_bank[:6] != b"LLLLLL":
            continue
        sf_off = struct.unpack_from("<I", raw_bank, 6)[0]
        sn_offs = (sf_off - 6) // 4
        soffs = list(struct.unpack_from(f"<{sn_offs}I", raw_bank, 6))
        if soffs[-1] < len(raw_bank):
            soffs.append(len(raw_bank))
        bank_items: list[str | None] = []
        for s_i in range(len(soffs) - 1):
            sub_pcm = raw_bank[soffs[s_i] : soffs[s_i + 1]]
            if not sub_pcm:
                bank_items.append(None)
                continue
            digest = hashlib.md5(sub_pcm).hexdigest()[:10]
            if digest not in sfx_samples:
                sfx_samples[digest] = base64.b64encode(sub_pcm).decode("ascii")
            bank_items.append(digest)
        sfx_banks[str(sfx_cid)] = bank_items
    (OUT_DIR / "sfx_banks.json").write_text(
        json.dumps({"sampleRate": 11025, "samples": sfx_samples, "banks": sfx_banks}, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"  [OK] sfx_banks.json ({len(sfx_samples)} unique 11025Hz PCM samples across {len(sfx_banks)} FDOTHER sound banks)")

    # 12. Master gamedata.json
    gamedata = {
        "font": font_meta,
        "unitsAtlas": units_atlas_meta,
        "uiIcons": ui_icons_meta,
        "itemIcons": item_icons_meta,
        "battleHud": battle_hud_meta,
        "crossIcons": cross_icons_meta,
        "tacticalUi": tactical_ui_meta,
        "fxAtlas": fx_atlas_meta,
        "classEquipMasks": [
            list(exe[OBJ3_BASE + 6282 + r * 7 : OBJ3_BASE + 6282 + (r + 1) * 7]) for r in range(29)
        ],
        "portraitCount": len(dato_chunks),
        "bgCount": len(bg_chunks),
        "taiPlatforms": tai_meta,
        "figaniByUnit": figani_by_unit,
        "spellStrips": spell_strips,
        "sysStrings": sys_strings,
        "races": dex_payload["races"],
        "heroClasses": hero_classes,
        "enemyClasses": enemy_classes,
        "items": items,
        "spells": spells,
        "heroes": heroes,
        "unitDex": unit_dex,
        "shops": shops,
        "terrainApMod": terrain_ap_mod,
        "terrainDpMod": terrain_dp_mod,
        "classMoveCosts": class_move_costs,
        "chapters": chapters_index,
    }
    (OUT_DIR / "gamedata.json").write_text(
        json.dumps(gamedata, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    print("Done! All verified atlases, character_dex.json, and gamedata.json generated.")


if __name__ == "__main__":
    main()
