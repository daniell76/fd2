#!/usr/bin/env python3
"""
Extends public/assets/font_atlas.png (starting at gid >= 1824, keeping original
FDOTHER.DAT[0] glyphs 0..1823 100% untouched) with:
  1. Proportional 1-bit DOS Serif ASCII & Latin glyphs (0x20..0x7E + punctuation)
     for retro bitmap rendering of English ('en') and ASCII substrings.
  2. Full-width 16x16 1-bit Songti/Mingti bitmap glyphs for all Simplified Chinese
     ('zh-CN') and extra Traditional Chinese ('zh-TW') characters across the game.
Also updates public/assets/gamedata.json (font.glyphCount, font.rows) and
src/glyphTable.ts (TW_TO_CN_GID, CHAR_TO_GID_TW, CHAR_TO_GID_CN, CHAR_TO_GID_EN, GLYPH_WIDTHS).
"""

import glob
import json
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ATLAS_PATH = ROOT / "public" / "assets" / "font_atlas.png"
GAMEDATA_PATH = ROOT / "public" / "assets" / "gamedata.json"
GLYPH_TABLE_PATH = ROOT / "src" / "glyphTable.ts"

ORIG_GLYPH_COUNT = 1824
COLS = 32
ORIG_ROWS = ORIG_GLYPH_COUNT // COLS  # 57 rows (512 x 912)

CJK_PUNCT_NATURAL_Y = set("，。、：；？！「」『』（）〔〕［］｛｝〈〉《》—…～·・")
PROP_EXTRA_CHARS = "’‘“”–—·é×±"


def load_base_tables() -> tuple[list[str], list[str]]:
    txt = GLYPH_TABLE_PATH.read_text(encoding="utf-8")
    m_tw = re.search(r"GLYPHS_TW:\s*readonly\s+string\[\]\s*=\s*(\[.*?\]);", txt)
    m_cn = re.search(r"GLYPHS_CN:\s*readonly\s+string\[\]\s*=\s*(\[.*?\]);", txt)
    if not m_tw or not m_cn:
        raise RuntimeError("Could not parse GLYPHS_TW / GLYPHS_CN from src/glyphTable.ts")
    return json.loads(m_tw.group(1)), json.loads(m_cn.group(1))


def render_proportional_glyph(ch: str, f_lat: ImageFont.FreeTypeFont, f_sym: ImageFont.FreeTypeFont) -> tuple[Image.Image, int]:
    """Renders a 1-bit left-aligned proportional 16x16 glyph cell and returns (rgba_cell, tight_width)."""
    cell = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    if ch == " ":
        return cell, 4

    im = Image.new("L", (24, 24), 0)
    dr = ImageDraw.Draw(im)
    dr.text((2, 16), ch, fill=255, font=f_lat, anchor="ls")
    crop = im.crop((0, 3, 24, 19))  # 24x16 with baseline at y=13
    bw = crop.point(lambda p: 255 if p >= 110 else 0)
    bbox = bw.getbbox()
    if not bbox:
        bw = crop.point(lambda p: 255 if p >= 60 else 0)
        bbox = bw.getbbox()
    if not bbox:
        im2 = Image.new("L", (24, 24), 0)
        dr2 = ImageDraw.Draw(im2)
        dr2.text((2, 3), ch, fill=255, font=f_sym)
        crop = im2.crop((0, 3, 24, 19))
        bw = crop.point(lambda p: 255 if p >= 85 else 0)
        bbox = bw.getbbox()

    if not bbox:
        return cell, 4

    x0, _, x1, _ = bbox
    w = max(2, min(15, x1 - x0))
    px_cell = cell.load()
    px_bw = bw.load()
    for y in range(16):
        for dx in range(w):
            if px_bw[x0 + dx, y] > 0:
                px_cell[dx, y] = (255, 255, 255, 255)
    return cell, w


def render_cjk_glyph(ch: str, f_cjk: ImageFont.FreeTypeFont, f_sym: ImageFont.FreeTypeFont) -> Image.Image:
    """Renders a 1-bit full-width 16x16 Songti/Mingti glyph cell matching FDOTHER.DAT[0] (15x14 active box)."""
    cell = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    if ch in (" ", "\u3000"):
        return cell

    im = Image.new("L", (24, 24), 0)
    dr = ImageDraw.Draw(im)
    dr.text((4, 2), ch, fill=255, font=f_cjk)
    bw = im.point(lambda p: 255 if p >= 95 else 0)
    bbox = bw.getbbox()
    if not bbox:
        bw = im.point(lambda p: 255 if p >= 65 else 0)
        bbox = bw.getbbox()
    if not bbox:
        im2 = Image.new("L", (24, 24), 0)
        dr2 = ImageDraw.Draw(im2)
        dr2.text((4, 2), ch, fill=255, font=f_sym)
        bw = im2.point(lambda p: 255 if p >= 85 else 0)
        bbox = bw.getbbox()
    if not bbox:
        return cell

    x0, y0, x1, y1 = bbox
    w = min(15, x1 - x0)
    h = min(15, y1 - y0)

    if ch in CJK_PUNCT_NATURAL_Y:
        ox = max(0, min(15 - w, (15 - w) // 2))
        oy = max(0, min(15 - h, y0 - 4))
    else:
        ox = max(0, min(15 - w, (15 - w) // 2))
        oy = max(0, min(14 - h, (14 - h) // 2))

    px_cell = cell.load()
    px_bw = bw.load()
    for dy in range(h):
        for dx in range(w):
            if px_bw[x0 + dx, y0 + dy] > 0 and ox + dx < 16 and oy + dy < 16:
                px_cell[ox + dx, oy + dy] = (255, 255, 255, 255)
    return cell


def main() -> None:
    tw_list, cn_list = load_base_tables()

    # Load immutable original 1,824 glyphs (57 rows x 32 cols = 512 x 912)
    orig_img = Image.open(ATLAS_PATH).convert("RGBA")
    orig_base = orig_img.crop((0, 0, COLS * 16, ORIG_ROWS * 16))

    # Map existing Traditional Chinese single-character glyphs in 36..1823
    tw_char_to_gid: dict[str, int] = {}
    for gid, tok in enumerate(tw_list):
        if len(tok) == 1 and gid >= 36 and tok not in tw_char_to_gid:
            tw_char_to_gid[tok] = gid
    # Also map full-width digits/uppercase 0..35 as fallback for TW if needed
    for gid in range(36):
        tok = tw_list[gid]
        if len(tok) == 1 and tok not in tw_char_to_gid:
            tw_char_to_gid[tok] = gid

    f_cjk = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc", 15, index=2)
    f_lat = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoSerif-SemiCondensedBold.ttf", 15)
    f_sym = ImageFont.truetype("/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf", 14)

    extra_cells: list[Image.Image] = []
    glyph_widths: dict[int, int] = {}

    # 1. Proportional ASCII (0x20..0x7E) + common typographic punctuation
    prop_chars: list[str] = [chr(c) for c in range(0x20, 0x7F)]
    for ch in PROP_EXTRA_CHARS:
        if ch not in prop_chars:
            prop_chars.append(ch)

    prop_char_to_gid: dict[str, int] = {}
    for ch in prop_chars:
        gid = ORIG_GLYPH_COUNT + len(extra_cells)
        cell, w = render_proportional_glyph(ch, f_lat, f_sym)
        extra_cells.append(cell)
        prop_char_to_gid[ch] = gid
        glyph_widths[gid] = w

    # 2. Collect all non-ASCII characters across GLYPHS_TW, GLYPHS_CN, src/, and public/assets/
    all_non_ascii: set[str] = set()
    for tok in tw_list + cn_list:
        for ch in tok:
            if ord(ch) >= 128:
                all_non_ascii.add(ch)

    scan_patterns = [
        str(ROOT / "src" / "**" / "*.ts"),
        str(ROOT / "src" / "*.ts"),
        str(ROOT / "public" / "assets" / "**" / "*.json"),
        str(ROOT / "public" / "assets" / "*.json"),
    ]
    for pat in scan_patterns:
        for path in glob.glob(pat, recursive=True):
            content = Path(path).read_text(encoding="utf-8")
            for ch in content:
                if ord(ch) >= 128 and ch not in "\n\r\t":
                    all_non_ascii.add(ch)

    cjk_extra_to_gid: dict[str, int] = {}
    for ch in sorted(all_non_ascii):
        if ch in tw_char_to_gid and gid >= 36:
            continue
        if ch in tw_char_to_gid:
            continue
        gid = ORIG_GLYPH_COUNT + len(extra_cells)
        cell = render_cjk_glyph(ch, f_cjk, f_sym)
        extra_cells.append(cell)
        cjk_extra_to_gid[ch] = gid

    total_glyphs = ORIG_GLYPH_COUNT + len(extra_cells)
    total_rows = (total_glyphs + COLS - 1) // COLS
    new_atlas = Image.new("RGBA", (COLS * 16, total_rows * 16), (0, 0, 0, 0))
    new_atlas.paste(orig_base, (0, 0))

    for idx, cell in enumerate(extra_cells):
        gid = ORIG_GLYPH_COUNT + idx
        r, c = divmod(gid, COLS)
        new_atlas.paste(cell, (c * 16, r * 16))

    new_atlas.save(ATLAS_PATH, optimize=True)

    # Build lookup tables for zh-TW, zh-CN, and en
    # - TW_TO_CN_GID[0..1823]: maps each original FD2 glyph ID to its Simplified Chinese glyph ID
    tw_to_cn_gid: list[int] = []
    for gid in range(ORIG_GLYPH_COUNT):
        tw_tok = tw_list[gid]
        cn_tok = cn_list[gid]
        if cn_tok == tw_tok:
            tw_to_cn_gid.append(gid)
        elif cn_tok in tw_char_to_gid:
            tw_to_cn_gid.append(tw_char_to_gid[cn_tok])
        elif cn_tok in cjk_extra_to_gid:
            tw_to_cn_gid.append(cjk_extra_to_gid[cn_tok])
        else:
            tw_to_cn_gid.append(gid)

    # - CHAR_TO_GID_TW: CJK -> full-width original/extra glyph; ASCII -> proportional DOS serif glyph
    char_to_gid_tw: dict[str, int] = {}
    char_to_gid_tw.update(cjk_extra_to_gid)
    char_to_gid_tw.update(tw_char_to_gid)
    for ch, pgid in prop_char_to_gid.items():
        if ord(ch) < 128:
            char_to_gid_tw[ch] = pgid

    # - CHAR_TO_GID_CN: Simplified CJK -> full-width glyph; ASCII -> proportional DOS serif glyph
    char_to_gid_cn: dict[str, int] = dict(char_to_gid_tw)
    for gid, cn_tok in enumerate(cn_list):
        if len(cn_tok) == 1 and gid >= 36:
            mapped = tw_to_cn_gid[gid]
            if cn_tok not in char_to_gid_cn:
                char_to_gid_cn[cn_tok] = mapped
    for ch, egid in cjk_extra_to_gid.items():
        if ch not in tw_char_to_gid:
            char_to_gid_cn[ch] = egid
    for ch, pgid in prop_char_to_gid.items():
        if ord(ch) < 128:
            char_to_gid_cn[ch] = pgid

    # - CHAR_TO_GID_EN: All proportional ASCII + typographic punctuation -> proportional DOS serif glyph,
    #   with fallback to CJK glyphs if any CJK char appears in English mode
    char_to_gid_en: dict[str, int] = dict(char_to_gid_tw)
    char_to_gid_en.update(prop_char_to_gid)

    # Update gamedata.json font metadata
    gd = json.loads(GAMEDATA_PATH.read_text(encoding="utf-8"))
    gd["font"]["glyphCount"] = total_glyphs
    gd["font"]["rows"] = total_rows
    GAMEDATA_PATH.write_text(json.dumps(gd, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # Write updated src/glyphTable.ts
    out_lines = [
        "// Auto-generated verified 1,824-glyph lookup tables (0..1823) from FDOTHER.DAT[0] (font_atlas.png)",
        "// plus extended 1-bit DOS bitmap glyphs (1824.." + str(total_glyphs - 1) + ") for Simplified Chinese (zh-CN) & English (en)",
        f"export const GLYPHS_TW: readonly string[] = {json.dumps(tw_list, ensure_ascii=False)};",
        f"export const GLYPHS_CN: readonly string[] = {json.dumps(cn_list, ensure_ascii=False)};",
        f"export const TW_TO_CN_GID: readonly number[] = {json.dumps(tw_to_cn_gid)};",
        f"export const CHAR_TO_GID_TW: Readonly<Record<string, number>> = {json.dumps(char_to_gid_tw, ensure_ascii=False)};",
        f"export const CHAR_TO_GID_CN: Readonly<Record<string, number>> = {json.dumps(char_to_gid_cn, ensure_ascii=False)};",
        f"export const CHAR_TO_GID_EN: Readonly<Record<string, number>> = {json.dumps(char_to_gid_en, ensure_ascii=False)};",
        f"export const GLYPH_WIDTHS: Readonly<Record<number, number>> = {json.dumps(glyph_widths)};",
        "",
    ]
    GLYPH_TABLE_PATH.write_text("\n".join(out_lines), encoding="utf-8")

    print(
        f"Extended font_atlas.png: {ORIG_GLYPH_COUNT} -> {total_glyphs} glyphs "
        f"({len(prop_chars)} proportional ASCII/Latin + {len(cjk_extra_to_gid)} extra CJK/symbols), "
        f"dimensions={new_atlas.width}x{new_atlas.height} ({total_rows} rows)"
    )


if __name__ == "__main__":
    main()
