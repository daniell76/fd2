# Flame Dragon II: Legend of Golden Castle — Modern Web Edition (`炎龍騎士團II：黃金城之謎`)

A native HTML5 Canvas, TypeScript, WebAudio, and Vanilla CSS conversion of the classic 1995 DOS tactical RPG in `../fd2`.

## Engine & Archive Knowledge Base

- **[FD2 Engine & Archive Knowledge Base](docs/FD2_ENGINE_KNOWLEDGE_BASE.md)** — Authoritative reverse-engineered specification of `FD2.EXE` and all 11 binary archives (`.DAT` / `.B24`), covering the three RLE/pixel codecs, cutaway vs map-only combat pipelines, dialogue bytecode VM (`0xFFEC..0xFFFF`), static `Obj 2` / `Obj 3` data tables, 80-byte runtime unit struct, exact combat/magic/EXP/promotion/AI formulas, and the complete `#000..#135` character & NPC role taxonomy.

## Highlights

- **100% Authentic Asset & Data Extraction** (`tools/extract_fd2.py` from clean `FD2.EXE` + `.DAT`/`.B24`):
  - **30 Campaign Battlefields + 3 Scripted Cutscene/Epilogue Maps** (`FDFIELD.DAT` + `FDSHAP.DAT`) with original terrain tilesets, passability/combat bonus tables, treasure chests, turn triggers, and enemy/ally formations.
  - **1,680 Battlefield Unit & Cursor Sprites** (`FDICON.B24`), **136 4-Frame Talking Portraits** (`DATO.DAT`), **56 Battle Cutaway Backdrops & Platforms** (`BG.DAT` + `TAI.DAT`), and **All Populated Combat & Spell Animation Strips** (`FIGANI.DAT` + `FDOTHER.DAT`).
  - **1,824 Monochrome 16×16 Calligraphy Glyphs** (`FDOTHER.DAT[4]`) rendering original `FDTXT.DAT` character names, item names, spell names, and all 33 chapters' story scripts cleanly at any resolution.
  - **Original Game Balance Tables** (`FD2.EXE` `Obj 2` & `Obj 3`): 215 weapons/armors/items, 36 spells & summons, 28 hero classes, 68 enemy/NPC classes, 32 playable heroes, 68 growth curves, and 26 town/secret shop inventories.
  - **15 Polyphonic XMI Soundtrack Tracks** (`FDMUS.DAT` -> WebAudio FM/GM synthesizer) + procedural retro tactical SFX.
- **Modern Web UX**:
  - Smooth pan & cursor-centered zoom (`1.25×`–`4×`), live Pre-Combat Forecast, one-click Move Undo, Spell AoE blast preview, Minimap, `1×`/`2×`/`Instant` cutaway animation toggle, 6-slot `localStorage` Save/Load + JSON export/import, Intermission Camp (Armory, Provisioner, Sanctuary Class Promotion), Chapter Select (`1–33`), and Archives Codex.

## Quick Start

```bash
# Re-extract assets from ../fd2 (already pre-extracted into public/assets/)
npm run extract

# Launch local development server
npm run dev

# Type-check and build production bundle
npm run build
```

## Controls

- **Left Click / Drag**: Select units, move/attack, or drag to pan battlefield
- **Right Click / `Esc`**: Undo move / cancel submenu
- **Mouse Wheel / `+` `−`**: Zoom battlefield (`1.25×`–`4.0×`)
- **`W` `A` `S` `D` / Arrow Keys**: Pan camera
- **`Space`**: Cycle & center on next ready hero (or advance story dialogue)
- **`E`**: End Player Phase
