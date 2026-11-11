# Flame Dragon II (`炎龍騎士團II：黃金城之謎`) — Original Engine & Archive Knowledge Base

> **Authoritative Engineering Reference for `fd2-web`**
> Every specification, byte offset, codec rule, data table, rendering coordinate, AI behavior, and character classification in this document is verified directly against the clean 1995 Dynasty International (`漢堂國際`) DOS executable `FD2.EXE` and its 11 companion binary archives (`.DAT` / `.B24`).
> **Clean-Room Source Rule**: Only `FD2.EXE` and the original `.DAT` / `.B24` archives are used; `FD2.EX_` is never read.

---

## Table of Contents

1. [Executable Architecture, Display Hardware & Codec Specifications](#1-executable-architecture-display-hardware--codec-specifications)
   - 1.1 DOS/4GW Linear Executable (`FD2.EXE`) Memory Layout
   - 1.2 VGA Mode 13h (`320×200`), 6-Bit DAC Palettes & Hardware Fades/Flashes
   - 1.3 Archive Container Formats (`LLLLLL` & `LMI`)
   - 1.4 The Three Image & Sprite Codecs (FD 2-Bit RLE, `DATO` PCX-RLE, Raw HUD Columns)
2. [Complete Archive-by-Archive Asset & Rendering Specification](#2-complete-archive-by-archive-asset--rendering-specification)
   - 2.1 `FDOTHER.DAT` (103 Chunks: Master Palettes, Font, UI, Screens, Spells, Summons, SFX)
   - 2.2 `DATO.DAT` (136 `80×80` Portraits, Blink/Talk Offsets & Shopkeeper Special Offsets)
   - 2.3 `FDICON.B24` & `FD2.TMP` (140 Rows × 12 `24×24` Tactical Map Sprites & Cursors)
   - 2.4 `FIGANI.DAT` (408 Chunks = 136 Units × 3 Slots, Cutaway Stage Layout & Special Animations)
   - 2.5 `BG.DAT` & `TAI.DAT` (56 Cutaway Terrain Backdrops, Platforms & Chapter Sky Overrides)
   - 2.6 `FDSHAP.DAT` (33 Map Tilesets & 4-Byte Terrain Property Records)
   - 2.7 `FDFIELD.DAT` (33 Maps: Chapters `1..30` Tactical Battlefields vs Maps `31..33` Cutscenes)
   - 2.8 `FDTXT.DAT` (System String Dictionary & Chapter Dialogue Bytecode VM)
   - 2.9 `TITLE.DAT`, `ANI.DAT`, `FDMUS.DAT` & `FD2.SAV` (`22,987`-Byte Save File Format)
3. [Static Data Tables Embedded in `FD2.EXE` (`Obj 2` & `Obj 3`)](#3-static-data-tables-embedded-in-fd2exe-obj-2--obj-3)
   - 3.1 Master Offset Directory
   - 3.2 Item Table (`215 × 23 B`) & Weapon Map-Hit Effect Table (`21 × 8 B`)
   - 3.3 Hero Classes (`1..28`), Terrain Move Costs (`29 × 20 B`), Equip Masks (`29 × 7 B`), Crit Rates & Magic Multipliers
   - 3.4 Promoted Class & MV Bonus Table (`36 × 2 B`) & Secret Promotion Item Table
   - 3.5 Spell Table (`36 × 7 B`), Spell Animation Routing & 20 Spell-Learning Lists (`20 × 12 B`)
   - 3.6 Base Hero Table (`32 × 24 B`), Growth Table (`68 × 11 B`) & Enemy Class Table (`68 × 10 B`)
   - 3.7 Town Shop Inventories (`26 × 31 B`), Secret Shop Passwords & Camp-Only Chapters
4. [Runtime 80-Byte Unit Struct & Exact Gameplay Mechanics](#4-runtime-80-byte-unit-struct--exact-gameplay-mechanics)
   - 4.1 80-Byte Runtime Unit Record (`offset 0..79`)
   - 4.2 Hero Recruitment, Enemy Spawn Stat Initialization & Equipment Recalculation
   - 4.3 Physical Combat Pipeline (Cutaway vs Fast Map-Only Mode, Hit/Evade, Crit, Double-Attack, Status Procs, Counterattack)
   - 4.4 Magic & Summon Pipeline (Offensive, Healing, Buffs, Status Ailments, Summon Spirits)
   - 4.5 Turn Recovery, Resting (`20%` Max HP), EXP, Level-Up & Church Class Promotion
   - 4.6 AI Controller (`unit+52` Modes `0..11`) & Why Non-Combatant NPCs Never Attack
5. [Master 136-Slot Character & Entity Reference (`#000..#135` + `FDICON #136..#139`)](#5-master-136-slot-character--entity-reference-000135--fdicon-136139)
   - 5.1 Entity Role Taxonomy & Non-Battlefield / Non-Combatant Rules
   - 5.2 Complete Slot-by-Slot Reference (`#000..#031`, `#032..#067`, `#068..#075`, `#076..#127`, `#128..#135`, `#136..#139`)
6. [Game Flow, 4-Way Cross Menu, Choreography VM & Chapter-by-Chapter Scenario Anatomy](#6-game-flow-4-way-cross-menu-choreography-vm--chapter-by-chapter-scenario-anatomy)
   - 6.1 Complete Campaign State Machine, Starting Setup (`0 G`, Prologue `Map 32 -> 31 -> Ch 1`) & Branching Endings (`Ch 27` vs `Ch 30 -> Map 30`)
   - 6.2 Authentic 4-Way Cross Menu (`十字選單`) & Tactical Micro-HUD Specification
   - 6.3 Directing (`演出`) & Unit Choreography VM (`Obj 3 + 10,200`, `106` Scripts)
   - 6.4 Runtime Battlefield Slot Indexing (`slots[0..95]`), Wave Spawning & Post-Battle Formations (`fn_78790`)
   - 6.5 Complete Scenario-by-Scenario & Chapter-by-Chapter Anatomy (`Maps 32, 31` + `Chapters 1..30` + `Map 30` + `Events 0..89`)
7. [Battlefield Operations & On-Map Presentation Pipeline (`戰場操作與地圖演出邏輯`)](#7-battlefield-operations--on-map-presentation-pipeline-戰場操作與地圖演出邏輯)
   - 7.1 Unit Lifecycle, On-Map Death Spin & 12-Frame Explosion (`fn_56165`)
   - 7.2 Movement, Undo & Post-Move Magic Restriction (`fn_34960` & Sword Saints `#18/#19/#34`)
   - 7.3 Cutaway vs. On-Map Spell Execution (`FDOTHER[6]`), Earthquakes (`fn_70984`) & Bouncing Map Digits (`fn_57176`)
   - 7.4 Treasure Chest & Hidden Ground Item Operations (`fn_37036`, `fn_8803` Tile `+1` Swap & Full-Bag Item Swap)
   - 7.5 Rest Healing (`fn_16340`), Per-Faction Lethal Poison Tick (`fn_43110`) & Post-Action Pipeline (`fn_56165 -> fn_43549 -> fn_58002`)
8. [Post-Battle Conditional Rewards, Non-Kill Battlefield Events & Special Victory/Defeat Rules](#8-post-battle-conditional-rewards-non-kill-battlefield-events--special-victorydefeat-rules-戰後條件獎勵非擊殺觸發事件與特殊勝敗判定)
9. [Confirmed Original 1995 `FD2.EXE` Bugs & Intentional `fd2-web` Fixes (`ORIGINAL_GAME_BUGS_AND_FIXES.md`)](#9-confirmed-original-1995-fd2exe-bugs--intentional-fd2-web-fixes)
10. [Master `FD2.EXE` (`Obj 1`) Inspected Function Reference (`fn_1618` .. `fn_256175`)](#10-master-fd2exe-obj-1-inspected-function-reference-fn_1618--fn_256175)
   - 10.1 Watcom C/C++ 10.0 Calling Conventions & Global Pointer Map
   - 10.2 Chapter Loading, Unit Spawning, Recruitment & Stat Recalculation (`fn_1618` .. `fn_5505`)
   - 10.3 Viewport, Camera Scrolling, Map Compositing & Hardware Timing (`fn_6984` .. `fn_14790`, `fn_190564` .. `fn_190729`)
   - 10.4 Tactical AI Controller, 3-Way Action Arbiter & Pathfinding (`fn_15007` .. `fn_24300`, `fn_254016`, `fn_254374`)
   - 10.5 Dialogue Bytecode VM, 4-Way Cross Menu & Battlefield Player Loop (`fn_24452` .. `fn_42800`)
   - 10.6 Status Tick, Spoils, Inventory Helpers & On-Map Spell / Item Execution (`fn_43110` .. `fn_51800`, `fn_68719`, `fn_70984`)
   - 10.7 Turn Loop, On-Map Death Spin/Explosion, Bouncing Digits & Level-Up (`fn_54284` .. `fn_58900`)
   - 10.8 Physical Combat Math, Multi-Hit, Counterattack, Flying Check & Cutaway Battle Stage (`fn_59478` .. `fn_61827`, `fn_91432` .. `fn_108289`)
   - 10.9 Victory/Defeat Dispatch, Pre/Mid/Post-Battle Directing & Prologue (`fn_66935` .. `fn_88439`, `fn_140059` .. `fn_155000`)
   - 10.10 Town Shops, Tavern, Secret Shop, Church Promotion & Low-Level Codecs (`fn_117500` .. `fn_138900`, `fn_252888` .. `fn_256175`)

---

## 1. Executable Architecture, Display Hardware & Codec Specifications

### 1.1 DOS/4GW Linear Executable (`FD2.EXE`) Memory Layout

`FD2.EXE` (`362,671` bytes) is a 32-bit Watcom C/C++ 10.0 protected-mode DOS/4GW Linear Executable (`LE` header at file offset `0x28B8` = `10,424`) divided into three flat 32-bit objects:

| Object | Role | File Offset | Virtual Size | Key Contents |
| :--- | :--- | :--- | :--- | :--- |
| **Object 1** | Code Segment (`.text`) | `39,948` (`0x9C0C`) | `257,610` B | All game logic (`0..155,500`) + Watcom C/DOS4GW runtime (`155,500+`) |
| **Object 2** | Initialized Data & BSS (`.data` / `.bss`) | `297,558` (`0x48A56`) | `16,800+` B (`10,400` B in file) | Engine state globals, UI layout tables, crit rates, magic class multipliers, terrain AP/DP modifiers, secret promo items, shopkeeper portrait IDs, chapter sky overrides |
| **Object 3** | Gameplay Database Segment | `343,552` (`0x53DF0`) | `13,522` B | Items, promoted class/MV pairs, class move costs, class equip masks, weapon map-hit effects, spells, enemy classes, base heroes, growth curves, town shops, spell-learn lists, **106 choreography scripts (`+10,200 .. +13,522`)** |

---

### 1.2 VGA Mode 13h (`320×200`), 6-Bit DAC Palettes & Hardware Fades/Flashes

- **Native Framebuffer**: Standard VGA Mode `0x13` linear `320×200` 8-bit indexed color (`64,000` bytes at physical `0xA0000`), backed by offscreen compositing buffers (`320×200` for map/UI, and `640×200` or `400×200` wide scratch buffers during Battle Stage rendering so sprites with negative X offsets or recoil never wrap across scanlines).
- **6-Bit VGA DAC Palette (`768` bytes)**: Stored as `256 × (R, G, B)` bytes with values in `0..63`. Convert each channel to 8-bit sRGB via:
  ```text
  c8 = min(255, (c6 * 255 + 31) // 63)
  ```
- **Hardware Palette Effects**:
  - **Screen Fade In / Out**: Steps all 256 DAC entries linearly toward `(0, 0, 0)` or `(63, 63, 63)`.
  - **Critical Hit Flash**: Pulses the entire screen palette to bright white `(63, 63, 63)` twice before impact.
  - **Target Hit Flash (`colorOverride = 33`)**: During a hit frame on the cutaway Battle Stage, the defender sprite is blitted with flat palette index `33` (pure bright white in `FDOTHER[0]`), overriding every opaque pixel of the defender while preserving transparency.
  - **Poison / Paralysis Screen Flash**: On final hit frame of an attack that procs Poison (`(0, 1, 32)` blue-violet tint) or Paralysis (`(63, 63, 63)` white pulse), the engine flashes VGA DAC entry `0` (backdrop border/overscan).

---

### 1.3 Archive Container Formats (`LLLLLL` & `LMI`)

#### A. `LLLLLL` Top-Level Archive Container (`.DAT` & Nested Sub-Archives)
Used by `FDOTHER.DAT`, `DATO.DAT`, `FIGANI.DAT`, `BG.DAT`, `TAI.DAT`, `FDSHAP.DAT`, `FDFIELD.DAT`, `FDTXT.DAT`, `TITLE.DAT`, `ANI.DAT`, `FDMUS.DAT`, and nested sub-archives inside `FDOTHER.DAT`:
- `bytes[0..5]`: 6-byte ASCII signature `"LLLLLL"`.
- `bytes[6..first_off - 1]`: Array of `N` little-endian `uint32` chunk start offsets (`offs[0..N-1]`). Note that **there is no explicit count field** — the chunk count is strictly `N = (offs[0] - 6) // 4`.
- Chunk `i` spans `raw[offs[i] : offs[i + 1]]` (with `offs[N] = len(raw)`). Empty placeholder chunks have length `0` or `3` bytes (`[0, 0, 0]`).

#### B. `LMI` Sprite Bank Format (`FDICON.B24`, `FDSHAP[2*m]`, `FDOTHER[1,3,5,6,9,13,14,29,96]`)
- `bytes[0..3]`: `"LMI\x00"` (or `"LMI1"`).
- `bytes[4..5]`: `uint16` `sprite_count`.
- `bytes[6 .. 6 + 4*sprite_count]`: `uint32` offset table `soffs[0..sprite_count-1]` relative to byte `0` of the `LMI` bank.
- Fixed-cell banks (`FDICON.B24`, `FDOTHER[1]`, `FDOTHER[96]`, `FDSHAP[2*m]`) store raw FD-RLE streams directly at `bank[soffs[i] : soffs[i+1]]` with implicit `24×24` dimensions.
- Variable-size UI banks (`FDOTHER[3, 5, 6, 9, 13, 14, 29]`) prefix each entry with `<uint16 width, uint16 height>` followed by the compressed pixel stream.

---

### 1.4 The Three Image & Sprite Codecs

> [!IMPORTANT]
> `FD2.EXE` uses **three distinct pixel decoders** across different asset types. Mixing them up causes severe visual corruption (such as horizontal wrap shifts on portraits or broken HUD bars).

#### Codec 1: Flame Dragon 2-Bit Control RLE (`decode_fd_rle`)
Used by almost all transparent sprites and screens (`FDICON.B24`, `FIGANI.DAT`, `FDSHAP.DAT`, `BG.DAT`, `TAI.DAT`, `TITLE.DAT`, `FDOTHER` animations/icons):
Each command byte `cmd` encodes `mode = cmd & 0xC0` (top 2 bits) and `count = cmd & 0x3F` (bottom 6 bits):
- `mode == 0x00` (**Skip / Transparent Run**): Advance `x` by `count` pixels (leaving alpha `0`, or palette index `0` when `opaque_bg=True`).
- `mode == 0x40` (**Literal Run or Dithered Shadow Mesh**):
  - Normal case (`count > 0`): Copy the next `count` raw palette bytes to `(x, y)` and advance `x += count`.
  - **Shadow / Mesh Sub-Mode (`cmd == 0x40`, i.e., `count == 0`)**: Read `n = next_byte`, `color = next_byte`, then write `n` alternating `(transparent, color)` pairs (`2 * n` pixels total) — used for drop shadows under platforms and spell overlays.
- `mode == 0x80` (**Solid Color Run**): Read 1 `color` byte and repeat it `count` times (`x += count`).
- `mode == 0xC0` (**Newline / Row Advance**): Reset `x = 0`:
  - If `count == 0` (`cmd == 0xC0`): `y += 1`.
  - If `count > 0`: `y += count` (multi-scanline vertical skip).

#### Codec 2: `DATO` PCX-Style RLE (`decode_pcx_rle` — Strict Unsigned `> 0xC0`)
Used by **all `DATO.DAT` `80×80` character portraits** and **`FDOTHER[5]` Sprite `22` (`149×42` Battle HUD base panel)**:
- Portraits are **100% opaque rectangles** (there is no skip/transparent command; palette index `0` is genuine black hair/outline ink!).
- Scan stream until `width * height` pixels are emitted:
  - **CRITICAL**: Compare **strictly `b > 0xC0`** (`0xC1..0xFF`), **NOT** `(b & 0xC0) == 0xC0`!
  - Why: When `b == 0xC0` (`192`), `FD2.EXE`'s `cmp al, 0xC0; jbe literal` treats `0xC0` as a **single literal pixel of palette index `192`**, NOT a `0`-length RLE run! Treating `0xC0` as a `0`-run consumes the next byte as a color and shifts every subsequent scanline horizontally (which previously distorted `#13 貝克威` and 15 other portraits whose artwork uses palette index `192`).
  - If `b > 0xC0`: `run_len = b & 0x3F` (`1..63`), `color = next_byte`; emit `color` `run_len` times.
  - If `b <= 0xC0`: emit single literal pixel `b`.

#### Codec 3: Uncompressed Raw Column Strips
Used by **`FDOTHER[5]` Sprites `23..30`** (`1×5` HP/MP bar fill columns) and `64,004`-byte raw `320×200` screens (`FDOTHER[15]`, `FDOTHER[55]`):
- Header `<uint16 w, uint16 h>` followed immediately by `w * h` raw palette index bytes (`5` bytes for `1×5` HUD columns; `64,000` bytes for `320×200` full screens).

---

## 2. Complete Archive-by-Archive Asset & Rendering Specification

### 2.1 `FDOTHER.DAT` (`103` Chunks: `0..102`)

| Chunk(s) | Format | Dimensions / Count | Exact Role & Where Rendered in `FD2.EXE` |
| :--- | :--- | :--- | :--- |
| **`0`** | `PAL_768` | `256 × 3B` | **Master Game Palette** (used by tactical maps, `DATO`, `FDICON`, `BG`, `TAI`, `FIGANI` default, `Shop`, `Camp`, `HUD`) |
| **`1`** | `LMI` (`24×24`) | `10` icons | Map/status UI icons (cursor markers, turn/status emblems) |
| **`2`** | `78 × (4B+480B)` | `78` sprites (`24×20`) | **4-Way Cross Menu (`十字選單`) Icon Atlas**: `26` icons × `3` states (`[normal, hover/alt, disabled]`), uncompressed `24×20` palette bytes (`0` = transparent corner key) |
| **`3`** | `23 × 256B` raw | `23` tiles (`16×16`) | **Scripted Lightning / Energy Bolt Segments** (`fn_83480`, used in Ch 22, 23, 27, 28, 30 cutscenes) |
| **`4`** | `1bpp` Font | `1,824` glyphs (`16×16`, `32 B` each) | **Master Traditional Chinese Calligraphy Font** (`58,368 B`). Rendered row-by-row (`MSB` = leftmost pixel, `2 B` per row) with 1px drop shadow (`fg = 205`, `shadow = 76` in dialogues & HUD) |
| **`5`** | `LMI` | `138` sprites | **Battle Stage HUD, Tactical Micro-HUD, Situation Scroll & Status Window Atlas**:<br>• `20` (`223×86`), `21` (`310×99`): **Battle Situation Parchment Scroll (`戰況`)**<br>• `22`: `149×42` PCX-RLE HUD base frame (drawn at `(8, 154)` left & `(163, 154)` right)<br>• `23..26`: `1×5` raw **HP bar** columns (yellow/gold fg `#23`, red depleted bg `#25`, bevel caps `#24/#26`), max width `100 px` at `panel + (42, 23)`<br>• `27..30`: `1×5` raw **MP bar** columns (blue fg `#27`, red depleted bg `#29`, bevel caps `#28/#30`), max width `100 px` at `panel + (42, 31)`<br>• `31..40`: Ice-blue HUD digits `0..9` (`41` = `???` when `HP >= 1000`)<br>• `42..51`: Sage-green HUD digits `0..9` (`52` = `???`, `93` = `??` when `MP >= 100`)<br>• `55..67`: Equipment / item stat badges (`AP`, `DP`, `HIT`, `EV`, `E` equipped tags)<br>• `130` (`69×34`): **Tactical Corner Terrain / Unit Micro-HUD Frame**<br>• `133..137` (`170×117`, `86×86`, etc.): **Slide-Out Unit Status, Inventory & Spell List Panels** |
| **`6`** | `LMI` | `230` sprites | Tactical command/phase emblems, target cursors, status window labels & small numbers |
| **`7`** | `LLLLLL` (`7`) | `320×200` + plates | **Title Screen Pack** (byte-for-byte identical to `TITLE.DAT`): `sub 0` = 100% opaque `320×200` FD-RLE full-screen illustration + `subs 1..6` = `61×7` / `62×8` menu button plates |
| **`8`** | `PAL_768` | `256 × 3B` | **Title Screen Palette** (static 256-color DAC loaded for `FDOTHER[7]` / `TITLE.DAT`; index `0xF0` is genuine `RGB(16, 28, 89)` navy shading used on the silver `"2"` bevel and `"LEGEND OF GOLDEN CASTLE"` ribbon — never a colorkey!) |
| **`9`** | `LMI` (`FD-RLE`)| `12` sprites (`42..70×24`)| **Teleport Spawn & End-Turn `20%` HP Rest-Heal Sparkle Sequence** (`fn_141721`) |
| **`10`** | FD-RLE | `62×26` | Mini UI badge / prompt plate |
| **`11`** | `IMG_320x200` | `320×200` | **Intermission Camp Background** (`camp.png`, palette `0`) |
| **`12`, `13`, `29`, `63`** | `LLLLLL` / `LMI` | `320×200` + `24×20` icons | **Town Shop, Tavern, Church & Camp Sub-Screen UI Kits** (`sub 0` `320×200` frame + `24×20` shop/camp cross icons) |
| **`14`** | `LMI` | `32` sprites | Roster / equipment UI scroll arrows & slot icons |
| **`15`** | Raw `320×200` | `64,004 B` | **Town Shop / Tavern Interior Background** (`shop.png`, palette `0`) |
| **`16`, `17`** | UI Anim | `206×113` | Dialogue / Camp parchment scroll unfurl overlay |
| **`18`..`27`** | `ANIM_SEQ` | Paired `[enemy, hero]` | **Cutaway Offensive Spell Animations**:<br>• `18 / 19`: Fire (`熾炎 / 爆炎 / 狂燄`)<br>• `20 / 21`: Ice (`冰凍 / 凝冰 / 暴雪`)<br>• `22 / 23`: Thunder (`雷電 / 奔雷`)<br>• `24 / 25`: Wind (`疾風 / 狂風`)<br>• `26 / 27`: Meteor (`天雷 / 星落`, full-screen `screen_abs`) |
| **`28`, `30`** | `ANIM_SEQ` | `32` frames each | Dark Magic (`28`: `暗黑`) & Holy Light (`30`: `聖光`) cutaway animations |
| **`31`** | `LLLLLL` (`14`) | VOC SFX bank | UI & menu sound effects |
| **`32`, `33`** | `ANIM_SEQ` | `10` frames each | Earth Spike (`地矛`, `[enemy=32, hero=33]`) cutaway animation |
| **`34`** | `ANIM_SEQ` | `101×101` | **Ch 21 Post-Battle 6-Crystal Sky Key Beam Animation** (`fn_82742`, unlocks Item `100 天空之鑰`) |
| **`35`, `36`** | UI Anim | `408×138` | Status / Inventory slide-out window frame |
| **`37`, `38`** | `ANIM_SEQ` | `5` frames each | Tornado / Whirlwind (`龍捲`) cutaway animation |
| **`39`, `43`, `44`**| `ANIM_SEQ` | `31..33` frames | Boss / Ultimate dark & elemental spell cutaway sequences (`咒殺 / 死神 / 再生`) |
| **`40`, `41`** | UI Anim | `408×128` | Secondary dialog/shop sub-panel |
| **`42`** | FD-RLE | `312×192` | Full status / roster overview frame |
| **`45`** | `ANIM_SEQ` | `59×59` | **Ch 26 (`m=25`) `#31 渥德` Awakening Event Animation** (`EV 61`, triggered when standing on `(1,46)` with Item `208 控制中樞`!) |
| **`46`, `47`** | UI Anim | `206×122` | Church class promotion transformation aura |
| **`48`..`53`** | `LLLLLL` | VOC SFX banks | Cutaway combat weapon swing, hit, crit, bow, and projectile `.VOC` sound banks |
| **`54`** | Raw Anim | `111×111` | Church class promotion light pillar sequence (`fn_107240`) |
| **`55`, `56`, `57`**| Screen + Pal | `320×200` + `768B` | **Church / Sanctuary Interior** (`55` raw bg, `56` overlay, `57` Church palette) |
| **`58`** | `ANIM_SEQ` | `20` frames | Special boss / dragon breath effect |
| **`59`** | `LMI` / Sprites | Multi-sprite | **Fast Map-Only Combat Overlay Bank**:<br>• Frames `0..38`: Weapon-type map-tile slash/pierce/impact animations (indexed via `GLOBAL_3_6485`)<br>• Frames `39..48`: Floating `69px` mini HP bar frames drawn above attacker/defender on the map |
| **`60`** | FD-RLE | `320×200` | Map overlay / border mask |
| **`61`, `62`** | `IMG_320x200` | `320×200` | **Ending Epilogue Screens** (`ending.png`) |
| **`63`, `64`** | `LLLLLL` | Sequence + VOC | Ending credits & fanfare audio/visual pack |
| **`65`..`68`** | `ANIM_SEQ` | `5..14` frames | **The Four Summon Spirit Animations** (`fn_98249`, `chunk = spell_id + 33`):<br>• `65`: Spell `32 熾天使` (Seraphim, 5 frames)<br>• `66`: Spell `33 風妖精` (Sylph, 14 frames)<br>• `67`: Spell `34 破壞神` (Destroyer God, 9 frames)<br>• `68`: Spell `35 暗邪鬼` (Dark Fiend, 9 frames) |
| **`69`..`73`** | `320×147` | `5` backdrops | **Special Scripted Boss / Fortress Cutaway Backdrops** (`L1885..L2020`, overriding normal `BG.DAT` in late-game chapters `Ch 27..30`) |
| **`74`, `75`, `76`**| Screen + Pal | `320×200` + `768B` | **World Map Travel Screen** (`75` map bg, `74` route markers, `76` World Map palette) |
| **`77`, `78`, `79`**| `LLLLLL` / Anim| VOC + `2` frames | World map & chapter title transition effects |
| **`80`..`95`** | `LLLLLL` | `16` VOC banks | **Spell & Summon Digital `.VOC` Sound Effects** (`91..94` = Summon SFX for spells `32..35`) |
| **`96`** | `LMI` (`24×24`) | `225` icons | **Item Icon Atlas** (`item_icons.png`, 1-to-1 icon for `iid = 0..214`) |
| **`97`..`102`** | Screen + Pal | `320×200` + `768B` | **Game Over Screen** (`97` bg, `98` text anim, `99` Game Over palette; `100..102` logo screen + palettes) |

---

### 2.2 `DATO.DAT` (`136` `80×80` Portraits: `0..135`)

Each chunk `pid` (`0..135`) starts with `4 × uint32` frame offsets (`16` bytes: `[16, off1, off2, off3]`) pointing to 4 sub-frames:
- **Sub-frame `0`**: Full `80×80` base portrait (`uint16 w=80, uint16 h=80`, PCX-RLE `strict > 0xC0`).
- **Sub-frames `1, 2, 3`**: Partial facial expression patches (blinking eyes / talking mouth) blitted over Sub-frame `0`.
  - **Normal Portraits (`0..127`, `133..135`)**: Rendered inside map dialogue boxes (`fn_26028`) at left `(x=2, y)` or right `(x=112, y)` of the dialogue box.
  - **Town Building NPCs (`128..132`) & UI Guide (`75`)**: Rendered by `fn_38251` inside the **top-right `80×80` portrait window** of the Town Shop / Tavern / Church / Camp screen (`vram_offset = 4696` -> `(x = 216, y = 14)`). Because `128..132` are animated directly inside the shop loop, `fn_38251` hardcodes custom byte offsets for their blink patches (`128 -> +4283`, `129 -> +1707`, `130 -> +3939`, `131 -> +1398`, `132 -> +3644`).
- **Blank Placeholder Slots in Original `DATO.DAT`**: Only **3 slots** (`#57`, `#105 雷龍`, `#127 暗黑龍`) are solid single-color blue squares (`unique_colors <= 3`); the remaining **133 slots** contain hand-drawn pixel art.

---

### 2.3 `FDICON.B24` & `FD2.TMP` (`140` Rows × `12` `24×24` Sprites = `1,680` Frames)

`FDICON.B24` is an `LMI` bank of `1,680` FD-RLE `24×24` sprites arranged in **140 rows of 12 frames**:
- **Rows `0..135`**: Map unit sprites corresponding 1-to-1 with `unit_id = 0..135`:
  - Columns `0..2`: Facing **Down** (`South`, 3-frame walk/idle cycle)
  - Columns `3..5`: Facing **Up** (`North`, 3-frame walk/idle cycle)
  - Columns `6..8`: Facing **Left** (`West`, 3-frame walk/idle cycle)
  - Columns `9..11`: Facing **Right** (`East`, 3-frame walk/idle cycle)
- **Rows `136..139` (System Map Cursors & Markers — NOT Units!)**:
  - `136`: Player map selection cursor box
  - `137`: Attack / Spell target reticle cursor
  - `138`: Movement range / path marker tiles
  - `139`: Area-of-Effect / special event tile indicator
- **`FD2.TMP` Runtime Cache (`fn_4121`, `L136630`)**: Because DOS memory could not hold all 140 rows simultaneously, `FD2.EXE` dynamically packs only the active chapter's unit `FDICON` rows into a temporary file `FD2.TMP` when loading a chapter or completing a Church promotion (`unit+9` stores the unit's remapped slot index in `FD2.TMP`).
- **Immobile Multi-Tile Bosses (`#104 火龍`, `#105 雷龍`, `#121 沼澤怪物`, `#127 暗黑龍`)**: Their `FDICON` rows (`104, 105, 121, 127`) have `0` opaque pixels because their bodies are drawn directly into the `FDSHAP` map background tiles (`mv = 0`, stationary bosses)! Note also that in `FD2.EXE` (`L5650`, `L6656`), `uid == 121` (`沼澤怪物`) and `race_id == 10` (`#127 暗黑龍`, `L6669`) are explicitly excluded from normal unit status inspection / cycling when hidden or embedded in map geometry.
- **3-Frame-Only Cutscene Actors (`#48 渥特王`, `#66 王后`, `#67`, `#74`, `#75`)**: Have only `3` populated `24×24` frames (a single facing direction) used solely for standing/talking in scripted cutscenes (`Ch 32 / Ch 33`), never full 4-directional tactical combat.

---

### 2.4 `FIGANI.DAT` (`408` Chunks = `136` Units × `3` Slots)

Every unit `uid` (`0..135`) owns 3 consecutive chunks in `FIGANI.DAT`:
- `3 * uid + 0` (**Slot 0 — `idle`**): Cutaway standing/breathing idle loop (typically 1 or 4 frames). Frame `0` is also used for defender **hit flash** and **knockback recoil**.
- `3 * uid + 1` (**Slot 1 — `attack`**): Primary physical attack animation (melee swing, bow shot, or solo ranged beam).
- `3 * uid + 2` (**Slot 2 — `ranged` / `cast`**): Secondary ranged weapon throw/projection (`#0/#32/#50 索爾`, `#2/#34 鐵諾`, `#50 劍聖`) or boss/mage spellcast animation (`#110`, `#124..#127`).

#### Chunk & Frame Binary Layout
- **Chunk Header**:
  - `byte[0]`: `frame_count` (`0` in 3-byte `[0, 0, 0]` empty chunks).
  - `byte[1]`: `is_remote` (`0` = full-stage / melee / solo camera; `1` = split-camera ranged attack!).
  - `byte[2]`: `split_frame` (for `is_remote == 1`, frames `0 .. split_frame - 1` play on the attacker's solo/origin screen, then camera pans `320px` across the `640×200` wide stage and frames `split_frame .. frame_count - 1` play over the defender!).
  - `bytes[3..7]`: Reserved / padding (`5` bytes).
  - `bytes[8 .. 8 + 4*frame_count]`: `uint32` frame offsets relative to chunk start.
- **Frame Header (`13` bytes before FD-RLE pixel stream)**:
  - `int16 ox` (`+0`), `int16 oy` (`+2`): Signed top-left screen coordinates `(ox, oy)` in native `320×200` space!
    - **Coordinate Convention**: Enemy sprites in `FIGANI` are authored facing **Right** on the left half of the `320×200` canvas; Player/Ally sprites are authored facing **Left** on the right half of the `320×200` canvas. When two same-side units duel in a custom viewer, mirroring one side maps `drawX = 320 - ox - fw`.
  - `uint8 sfx_id` (`+4`): Sound trigger index (`0` = silent).
  - `uint8 hit_flag` (`+5`): Wait — note exact byte order in `FD2.EXE`:
    - In `FIGANI` frame header `fr[0..12]`: `fr[4]` is `hit_trigger` (`1` = impact frame that deducts HP, triggers white flash `color=33` and knockback recoil; verified at `L103447` `M1[v3+4]` and `L104220` `cmp8(M1[v3+4], 0)`!), `fr[5]` is `sfx_id` (`L103903` `M1[v3+5]` passed to `play_sfx`), `fr[6]` is `delay_ticks` (in `~18.2 Hz` PIT / `70 Hz` VGA ticks, `L104081` `M1[v3+6]`), `fr[7]` bit `0` (`fr[7] & 1`) is **Foreground Z-Layer flag** (`0` = draw attacker behind defender; `1` = draw attacker in front of defender, `L104405` & `L104505`), `fr[8]` is reserved, and `uint16 fw, fh` are at `fr[9..12]`.

#### Cutaway Battle Stage (`fn_100972` & `fn_103325`) Exact Visual Layout & Layering
1. **Viewport & Canvas (`320×200`)**:
   - `BG.DAT` (`320×100`) is drawn at `(0, 0)` (occupying `y = 0..99`) and vertically/gradient-extended or composited above the lower stage (`y = 100..199` solid black `0` border below backdrop/platforms; **never** shifted upward when enemies counterattack!).
   - Left `TAI.DAT` platform is drawn at `(8, 92)` (enemy ground) and Right `TAI.DAT` platform at `(157, 82)` (player ground) — omitted if the respective combatant is a flying unit (`fn_61827 != 0`).
2. **Strict Z-Order (Back to Front)**:
   1. `BG.DAT` sky/horizon backdrop + `TAI.DAT` terrain platforms
   2. **Left & Right HUD Panels (`FDOTHER[5]` sprite `22` at `(8, 154)` and `(163, 154)`)** — **drawn BEHIND character animations** so large melee swoops and spell effects overlap cleanly in front of the HUD bars!
      - Inside each HUD panel: Character name (`FDTXT[0][uid + 1]`, shadow `76`, fg `205`), **HP bar** (yellow `23` over red `25` background + ice-blue digits `31..41`), **MP bar** (blue `27` over red `29` background + sage-green digits `42..52` / `93`). **No floating damage numbers** are ever drawn in `FD2.EXE`!
   3. Attacker frame (if `fgLayer == false`)
   4. Defender idle/hit frame (with white flash `palette 33` on hit frame `t = 0` and horizontal knockback recoil `GLOBAL_2_9567` / `GLOBAL_2_9591` = `[-16, -12, -8, -4, -2, 0]` px for left-side defender or `[+16, +12, +8, +4, +2, 0]` px for right-side defender across `v6 = 5..0` ticks!)
   5. Attacker frame (if `fgLayer == true`)
3. **Special `FIGANI` Cases Verified in `FD2.EXE`**:
   - **`#113 光束砲座` (Beam Turret)**: Weapon `36 死光` has range `2..5` (`minRange = 2`), so it **only** attacks at range. However, its `FIGANI` Slot 1 header has `is_remote = 0, split_frame = 16` (`fcnt = 16`). In `L103696`, because `M1[v5+1] == 0`, `FD2.EXE` takes the solo/melee camera branch, EXCEPT in `fn_100972` (`L101217`), when `distance > 1` and `is_remote == 0`, the defender is NOT drawn on the attacker's platform — `#113` fires its beam off-screen from its solo platform, followed by target impact!
   - **2-Stage Martial Artist Specials (`#12 凱麗`, `#15 塞可邦勒`, `#44`, `#47`, `#62`, `#65`)**: Triggered on critical hit or special proc (`L101650`), chaining an extra finisher strike sequence.
   - **`#121 沼澤怪物` (Swamp Monster)**: Slot 0 (`idle`) is a `1`-frame `320×200` 0-opaque placeholder (`1,025 B`), while Slot 1 (`attack`) has `5` active frames (`2,942 B`).
   - **`#133 女村民`, `#134 男村民`, `#135 卡納恩三世` (Defenseless Battlefield NPCs)**: Slot 0 (`idle`) is **populated** (`4` frames each: `16,410 B`, `17,590 B`, `36,349 B`) so when enemies attack them on the battlefield, they appear on the right platform of the cutaway Battle Stage, recoil, flash white, and lose HP! Their Slot 1 (`attack`) and Slot 2 (`ranged`) chunks are **3-byte `[0, 0, 0]` empty chunks** because they never attack or counterattack.

---

### 2.5 `BG.DAT` (`56` Backdrops) & `TAI.DAT` (`56` Platforms)

- `BG.DAT[0..55]`: `56` FD-RLE `320×100` horizon backdrops.
- `TAI.DAT[0..55]`: `56` FD-RLE `~155×42` combat platforms (`46` populated, `10` empty sky/void slots where units float without a platform).
- **Selection Logic (`L101217..L101441`)**:
  1. Look up the tile under the defender (for `BG` + defender `TAI`) and the tile under the attacker (for attacker `TAI`) in `FDSHAP[2*m + 1]` property byte `2` (`bg_tai_id` in `0..55`).
  2. **Chapter Sky Backdrop Override (`GLOBAL_2_9059`, `56 B`)**: Certain late-game/indoors/fortress chapters override outdoor sky `BG` IDs so indoor/night chapters never show daytime blue skies.
  3. **Flying Unit Rule (`fn_61827`)**: If a unit is flying (`class_id == 19 飛龍騎士`, or `race_id in (4 鳥人, 5 精靈)` and `uid != 28 達克塞`), its `TAI` platform is suppressed or switched to aerial mode (`L101340`).

---

### 2.6 `FDSHAP.DAT` (`66` Chunks = `33` Maps × `2`)

For each map `m` (`0..32`):
- `FDSHAP[2*m]`: `LMI` bank of opaque `24×24` map terrain tiles.
- `FDSHAP[2*m + 1]`: Array of **4-byte tile property records** `prop[tile_id] = [b0, b1, b2, b3]` loaded into `GLOBAL_2_14953` (`tprop_buf`, `9,366` tiles total across all 33 maps):
  - `b0` (`tp[0]` — takes only 8 distinct values across all 33 maps: `[0x00, 0x04, 0x10, 0x20, 0x40, 0x80, 0x88, 0xC0]`):
    - **Visual occlusion & chest/treasure flags** (NEVER blocks movement in `fn_254016`!):
    - `b0 & 0x08`: **Full Bridge / Archway / Tunnel Occlusion** (`fn_8690 @8776` & `fn_10621 @11100`: unit walking underneath is completely occluded by the bridge/archway, e.g., Ch 10 prison arches and Ch 25, 27..30 archways).
    - `b0 & 0x20`: Visible treasure chest tile (`fn_11832 -> fn_37036`; once opened via `fn_8803`, tile ID increments by `+1` to the open-chest sprite).
    - `b0 & 0x40`: Hidden ground treasure / searchable tile (`fn_11832 -> fn_37036`, e.g., Ch 2 `(21, 17)` `b0 = 0xC0` behind the brown shed roof, Ch 20 `(30, 7)` `#212 暗之眼`).
    - `b0 & 0x80`: **Half-Height Roof / Canopy Overhang Occlusion** (`fn_10621 @11115`: walkable `cost = 1` tile at the top ridge of a building or giant tree where the lower half of the standing unit's `24×24` sprite is clipped behind the roof ridge/tree crown, such as Ch 2 `(12, 7)` cathedral roof ridge and `(21, 17)` shed roof!).
    - `b0 & 0x04` and `b0 & 0x10`: Leftover map-editor flags (appear in Ch 20, 24, 27..30) that are **never tested anywhere in `FD2.EXE`** at runtime (verified across all 20 code references to `GLOBAL_2_14953`).
  - `b1` (`tp[1]` in `0..5`): **Terrain Movement Cost & Combat Bonus Group** indexing BOTH `GLOBAL_3_5702[class_id][b1]` AND `GLOBAL_2_6674[b1]` (Attacker AP % modifier `[+5, 0, -5, -5, -5, 0]`) / `GLOBAL_2_6698[b1]` (Defender DP % modifier `[0, 0, +10, +10, -5, 0]`):
    - `b1 == 0` (`6,529` tiles): **Road / Town Street / Stone Bridge / Indoor Floor / Overhang Edge** (`Foot = 1, Cavalry = 1, Flyer = 1`, `AP +5%, DP 0%`).
    - `b1 == 1` (`2,200` tiles): **Ground-Impassable / Flyer-Passable Terrain** (`Foot = 20 [Impassable], Cavalry = 20 [Impassable], Flyer = 1`, `AP 0%, DP 0%`). Used for **both** vertical structures (town houses, walls, giant trees — all of which sit directly beneath a `b0 & 0x80` roof/canopy overhang row in the same column `x`; e.g., `207/207` `b1 == 1` cells in Chapter 2 `羅德鎮` are house/building bodies beneath a `0x80` roof ridge!) **and** open hazards (rivers, lakes, harbor water, cliffs, lava pools, sky chasms).
    - `b1 == 2` (`347` tiles): **Grassland / Light Woods / Snowfield** (`Foot = 1, Cavalry = 2, Flyer = 1`, `AP -5%, DP +10%`).
    - `b1 == 3` (`16` tiles, `400` cells in Ch 19): **Dense Forest / Thicket** (`Foot = 2, Cavalry = 3, Flyer = 1`, `AP -5%, DP +10%`).
    - `b1 == 4` (`41` tiles, `709` cells in Ch 20): **Swamp / Marsh** (`Foot = 2, Cavalry = 3, Flyer = 1, Class 28 Swamp Monster = 1`, `AP -5%, DP -5%`).
    - `b1 == 5` (`233` tiles): **Strictly Impassable Barrier / Castle Wall / Indoor Pillar** (`Foot = 20, Cavalry = 20, Flyer = 20` — blocks **all** units including Flying units!).
  - `b2` (`tp[2]` in `0..55`): **Cutaway Battle `BG.DAT` / `TAI.DAT` index** for fights occurring on this tile (`0` on ground-impassable `b1 == 1` tiles in chapters without flying combatants).
  - `b3` (`tp[3]`): Always `0` across all `9,366` tiles in all 33 maps (4-byte alignment padding).

---

### 2.7 `FDFIELD.DAT` (`99` Chunks = `33` Maps × `3`)

> [!IMPORTANT]
> **Critical Discovery — Tactical Battlefields (`m = 0..29`) vs Scripted Cutscene Maps (`m = 30..32`) & Exact `playerSlots` Offset**:
> `FDFIELD.DAT` contains `33` map triplets (`m = 0..32`), **NOT** 33 playable battles!
> - **`m = 0..29` (Chapters `1..30`, titles at `FDTXT[0][550..579]`)**: The **30 playable tactical campaign chapters**.
> - **`m = 32` (`18×51`, `max_deploy = 0`, `enemy_cnt = 30`, `FDTXT[33]`)**: **Opening Prologue Part 1 — Royal Throne Room Departure (`序幕(一)・王城啟程`)** (`fn_140059` `L140070: GLOBAL_2_15363 = 32`! `#48 渥特王` at `(7,5)`, `#66 王后` at `(10,5)`, `#0 索爾` walks up from `(8,42)` via `Choreo 99..105`).
> - **`m = 31` (`20×50`, `max_deploy = 0`, `enemy_cnt = 30`, `FDTXT[32]`)**: **Opening Prologue Part 2 — Sea Voyage & Ship Ambush (`序幕(二)・海上遇襲`)** (`fn_140059` sets `GLOBAL_2_15363 = 31`, spawns `#0 索爾, #4 亞雷斯, #75 米蘭, #30 蓋亞, #9 悠妮` via Waves `1, 3, 5` + `Choreo 90..98`, recruits `[#0, #9, #4, #30]`, and transitions directly into `m = 0` Chapter 1!).
> - **`m = 30` (`35×45`, `max_deploy = 31`, `enemy_cnt = 1` `#30 蓋亞`, `FDTXT[31]`)**: **True Ending Epilogue — Royal Castle Reunion (`終章・王城凱旋`)** (`fn_87895` `L88100: GLOBAL_2_15363 = 30` after defeating `#127 暗黑龍` in Chapter 30, deploying up to 31 surviving party heroes at `playerSlots[0..30]` with `Choreo 89` before `ENDING_SEQUENCE()`).

For each map `m` (`0..32`):
1. **`FDFIELD[3*m + 0]` (Grid Chunk)**:
   - `uint16 width`, `uint16 height`, followed by `width * height` 4-byte cells `<uint16 tile_id, uint16 event_id>`:
     - `event_id == 0`: Normal tile.
     - `1 <= event_id <= 16`: Treasure chest / searchable ground item index (`chest_idx = event_id - 1` into `ctrl_raw[83..130]`).
     - `event_id >= 17`: Step-on coordinate event trigger (`mid_event_id = event_id - 17`, fired once when a player unit stops on the tile and `eventFlags[event_id] == 0`).
2. **`FDFIELD[3*m + 1]` (Control Header + 26-Byte Unit Definitions)**:
   - `byte[0]`: `tileset_id` (`0..32`).
   - `byte[1]`: `max_deploy` (`GLOBAL_2_15335`, number of player party deployment slots; `0` on Prologue maps `31, 32`, `31` on True Ending Epilogue map `30`).
   - `byte[2]`: `active_enemy_count` (`GLOBAL_2_15331`, active count of `urec` unit records `0 .. active_enemy_count - 1`).
   - `bytes[3..50]` (`16 × 3 B`): Turn Event Triggers `<uint8 turn_number, uint16 mid_event_id>` (`0xFF` = unused).
   - `bytes[51..82]` (`32 B`): Initial event flag mask (`GLOBAL_2_15061`).
   - `bytes[83..130]` (`16 × 3 B`): Treasure Chest Definitions `<uint8 type (0=item, 1=gold, 2=mid_event), uint16 item_id_or_gold_or_event>`.
   - `bytes[131..end]` (`N × 26 B`): **26-Byte Map Unit Spawn Records (`urec[0..active_enemy_count-1]`, verified in `fn_3152 @4022..4040`)**:
     - `urec[0]`: `alignment` (`0` = Enemy, `1` = NPC Ally, `2` = Joining/Scripted Player Hero)
     - `urec[1]`: `uid` (`0..135`, 0-indexed character/entity ID!)
     - `urec[2]`: `ai_chest_idx` (`unit+61`: target treasure chest index `0..15` for Mode `5` thieves!)
     - `urec[3]`: Reserved / unused (`0` or `1`)
     - `urec[4]`: `level` (`1..99`)
     - `urec[5..12]`: Up to `8` inventory item IDs (`0xFF` = empty; first valid weapon & first valid armor auto-equipped on spawn!)
     - `urec[13..16]`: `uint32` little-endian **known spell bitmask** for spells `0..31`
     - `urec[17]`: `ai_mode` (`unit+52`: `bits 0..5` = AI behavior `0..11`; `bits 6..7` `0x40/0x80` = spell/heal preference flags in `fn_20208`)
     - `urec[18]`: `ai_target_x_or_uid` (`unit+53`: target tile `X` for Modes `4/5/7/10`, or escorted/followed character `uid` for Modes `3/9`!)
     - `urec[19]`: `ai_target_y` (`unit+54`: target tile `Y` for Modes `4/5/7/10` — e.g. in Ch 2 `羅德鎮`, all 6 civilians have `urec[17]=4` with `(urec[18], urec[19]) = (19,6), (16,0), (15,0)` fleeing east/north away from the bandits!)
     - `urec[20]`: Reserved
     - `urec[21]`: `wave_group` (`0` = spawned immediately at chapter load; `1..N` = reinforcement/cutscene wave spawned by Pre-Battle, Mid-Battle, or Post-Battle script; `255` = inactive pool slot)
     - `urec[22]`: `drop_type` (`0` = drops item `drop_val`, `1` = drops `drop_val` gold, `2` = triggers mid-battle event `drop_val` on death, `0xFF` = no drop)
     - `urec[23..24]`: `uint16 drop_val`
     - `urec[25]`: Reserved
3. **`FDFIELD[3*m + 2]` (Spawn Coordinate Table — Exact `fn_2189` Alignment)**:
   - `uint16 total_spawns`, followed by `total_spawns × 6 B` `<uint16 x, uint16 y, uint16 tag>`.
   - **Exact Engine Formula (`L2651: v0 = GLOBAL_2_15331 * 6`)**:
     - `urec[i]` (`0 <= i < active_enemy_count`) spawns at `raw_spawns[i]`.
     - **Player party deployment coordinates** are strictly `raw_spawns[active_enemy_count : active_enemy_count + max_deploy]`, **NOT** `raw_spawns[total_spawns - max_deploy :]`! (For example, Chapter 1 `m = 0` has `active_enemy_count = 30`, `max_deploy = 4`, `total_spawns = 34`, placing the 4 starting heroes on the southern beach at `(7,20), (10,21), (8,22), (11,23)`.)

---

### 2.8 `FDTXT.DAT` (`34` Chunks: Bank `0` System Strings + Banks `1..33` Scripts)

#### Bank `0` (`FDTXT[0]` — `661` System Strings, `16`-Bit Offset Table)
| Index Range | Count | Exact Meaning in `FD2.EXE` |
| :--- | :--- | :--- |
| **`1 .. 136`** | `136` | Unit / Character Display Names for `uid = 0..135` (`sys_idx = uid + 1`). Note: `129..133` (`uid 128..132`) are blank because shopkeepers have no HUD nameplate; `75..76` (`uid 74..75`) are blank or dialogue-only. |
| **`141 .. 150`** | `10` | Race Names (`race_id = 1..10`: `人類, 精靈, 獸人, 鳥人, 龍人, 機械, 魔族, 不死, 怪物, 邪神`) |
| **`151 .. 178`** | `28` | Hero Class Names (`class_id = 1..28`: `戰士 .. 龍戰士`) |
| **`181 .. 395`** | `215` | Item Names (`iid = 0..214`: `sys_idx = 181 + iid`) |
| **`400 .. 435`** | `36` | Camp, Save/Load, Inventory, Discard, Give & Equip Prompt Strings (`410..420` spoken with `#75` portrait!) |
| **`441 .. 476`** | `36` | Spell & Summon Names (`sid = 0..35`: `sys_idx = 441 + sid`) |
| **`480 .. 549`** | `70` | Level-Up Stat Gain Templates (`490..494`: `AP/DP/DX/HP/MP`), Combat Prompts & Status Messages |
| **`550 .. 579`** | `30` | Campaign Chapter Titles (`Ch 1..30`) |
| **`580 .. 596`** | `17` | Town Shop, Tavern, Secret Shop & Church Promotion Prompts (`591..596`) |
| **`597 .. 656`** | `60` | Chapter Victory & Defeat Condition Strings (`597 + 2*m` = Win, `598 + 2*m` = Lose for `m = 0..29`) |
| **`657 .. 660`** | `4` | Town Departure Confirmation Prompts (`657..658` spoken with `#75` portrait!) |

#### Banks `1..33` (`FDTXT[1..33]` — Chapter Dialogue Bytecode Interpreter `fn_24452`)
Each bank begins with a `uint16` offset table into arrays of `uint16` words (`int16` signed opcodes when `< 0`, or `FDOTHER[4]` glyph indices `0..1823` when `>= 0`):

| Opcode (`uint16` / `int16`) | Arguments | Exact Execution in `fn_24452` |
| :--- | :--- | :--- |
| **`0x0000 .. 0x071F`** | None | Draw `16×16` glyph `code` from `FDOTHER[4]`, advance cursor `x += 16` |
| **`0xFFFF` (`-1`)** | None | End of dialogue entry (wait for key if box open, close box, return) |
| **`0xFFFE` (`-2`)** | None | Line break (`y += line_height`; if 3 lines full, scroll text box up 1 line via `fn_28196`) |
| **`0xFFFD` (`-3`)** | None | Wait for keypress, then clear/scroll page within current speaker box |
| **`0xFFFC` (`-4`)** | None | Interpolate dynamic string `GLOBAL_2_15065` (`sys_strings[idx]`, e.g., hero or item name) |
| **`0xFFFB` (`-5`)** | None | Interpolate secondary dynamic string `GLOBAL_2_15069` |
| **`0xFFFA` (`-6`)** | None | Interpolate decimal integer `GLOBAL_2_15073` (e.g., gold price, EXP, stat gain) |
| **`0xFFEF` (`-17`)** | `uint16 uid` | Open **Top** dialogue box (`vram + 1832`) for **Direct Character `uid` (`0..135`)** (`fn_11360` searches map for `unit+8 == uid`; `uid == 39` forces `DATO[39]` Elder portrait; else uses `unit+7` promoted portrait if on map!) |
| **`0xFFEE` (`-18`)** | `uint16 uid` | Open **Bottom** dialogue box (`vram + 36887`) for **Direct Character `uid` (`0..135`)** |
| **`0xFFED` (`-19`)** | `uint16 slot` | Open **Top** dialogue box (`vram + 1832`) for **Map Runtime Unit Slot `slot`** (`M4[GLOBAL_2_14917] + 80 * slot` -> portrait `unit+7`! Note: on battle maps, `slot = max_deploy + urec_index`!) |
| **`0xFFEC` (`-20`)** | `uint16 slot` | Open **Bottom** dialogue box (`vram + 36887`) for **Map Runtime Unit Slot `slot`** |

> [!WARNING]
> **Why `0xFFEC/0xFFED` vs `0xFFEE/0xFFEF` Matters**:
> `0xFFEE` and `0xFFEF` take a **direct `0..135` Character ID** (`uid`), whereas `0xFFEC` and `0xFFED` take a **runtime map array index `slot`** (`0 .. max_deploy - 1` = deployed party members; `max_deploy + i` = `urec[i]` in `FDFIELD[3*m + 1]`)! Treating `0xFFED`'s `slot` as a direct `uid` previously misattributed enemy soldier lines (`slot = 32..65`) to promoted hero portraits `#32..#65`!

---

### 2.9 `TITLE.DAT`, `ANI.DAT`, `FDMUS.DAT` & `FD2.SAV`

- **`TITLE.DAT`** (`23,377 B`, byte-for-byte identical to `FDOTHER[7]`, paired with palette `FDOTHER[8]`):
  - `TITLE[0]` (`21,953 B`): **100% opaque** `320×200` FD-RLE full-screen title illustration (`0` skip runs — only `0x40` literal and `0x80` solid-color runs). Palette index `0xF0` (`RGB(16, 28, 89)` dark navy) is an opaque shading color used in two horizontal bevel stripes across the silver `"2"` (`y = 11..12, 20..21`) and inside the `"LEGEND OF GOLDEN CASTLE"` banner (`y = 141..154`), **never** a transparency colorkey!
  - `TITLE[1..6]`: `61×7` / `62×8` menu option highlight plates (`開始新遊戲`, `讀取進度`, etc.).
- **`ANI.DAT`**: Intro & ending cinematic animation banks.
- **`FDMUS.DAT`**: Miles Sound System `XMI` (`FORM:XDIR` / `XMID` `EVNT` at `120 Hz` tick rate) FM/GM soundtrack tracks.
- **`FD2.SAV` (`22,987` bytes per save file, `L40826..L41260`)**:
  - `0..2210` (`2,211 B`): Map dynamic tile/chest state
  - `2211..4770` (`2,560 B` = `32 × 80 B`): Persistent **Player Party Roster** (`GLOBAL_2_15351`, max 32 heroes)
  - `4771..12450` (`7,680 B` = `96 × 80 B`): Active **Battlefield Unit Array** (`GLOBAL_2_14917`, max 96 units)
  - `12451..12482` (`32 B`): Chapter event/quest flags (`GLOBAL_2_15061`, e.g., `+0` = Ch 19 duel flag, `+12` = Item `208 時空之輪` used, `+16..19` = secret flags)
  - `12483..12500`: Campaign scalars (`chapter_id`, `unit_count`, `turn_number`, camera X/Y, cursor X/Y, `party_count`, `uint32 gold`)
  - `15147, 17747, 20347, 22947`: 4 Camp save slots + XOR/additive integrity checksum (`fn_252888`; if corrupted on boot at `L189`, `#75` appears to report corrupt save data).

---

## 3. Static Data Tables Embedded in `FD2.EXE` (`Obj 2` & `Obj 3`)

### 3.1 Master Offset Directory

| Table Symbol | Segment | File Offset | Size | Record Count × Width | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GLOBAL_2_6674` | `Obj 2` | `333,842` | `24 B` | `6 × int32` | Terrain Attacker AP % Bonus (`[+5, 0, -5, -5, -5, 0]`) |
| `GLOBAL_2_6698` | `Obj 2` | `333,866` | `24 B` | `6 × int32` | Terrain Defender DP % Bonus (`[0, 0, +10, +10, -5, 0]`) |
| `GLOBAL_2_8086` | `Obj 2` | `335,254` | `112 B` | `28 × int32` | Target Class Magic Damage-Taken Tenths (`10` = `100%`, `7` = `70%`, `5` = `50%`, `4` = `40%`, `L51061..L51125`) |
| `GLOBAL_2_9059` | `Obj 2` | `336,227` | `56 B` | `56 × uint8` | Chapter Sky Backdrop Override Table |
| `GLOBAL_2_9115` | `Obj 2` | `336,283` | `28 B` | `28 × uint8` | Base Critical Hit Rate % by Class (`class_id 1..28`) |
| `GLOBAL_2_9567/9591`| `Obj 2` | `336,735` | `48 B` | `2 × 6 × int32` | Cutaway Defender Hit Recoil Curves (`dx = [0, 4, 9, 14, 18, 14]`, `dy = [0, 2, 4, 6, 8, 10]` indexed by `v6 = 0..5`) |
| `GLOBAL_2_9817/9821`| `Obj 2` | `336,985` | `6 B` | `6 × uint8` | Town Building Portrait IDs (`[129, 128, 0, 130]`, `[131, 132]`) |
| `GLOBAL_2_9895` | `Obj 2` | `337,063` | `18 B` | `18 × uint8` | Secret Tier-3 Promotion Required Item ID (`hero 0..17`) |
| `GLOBAL_2_9913` | `Obj 2` | `337,081` | `31 B` | `31 × uint8` | 1-Indexed Intermission **Camp-Only** Flags (`M1[GLOBAL_2_9913 + ch] != 0` for `ch in [22, 23, 24, 27, 28, 29, 30]`) |
| `GLOBAL_3_685` | `Obj 3` | `344,237` | `4,945 B`| `215 × 23 B` | Master Item Database (`iid = 0..214`) |
| `GLOBAL_3_5630` | `Obj 3` | `349,182` | `72 B` | `36 × 2 B` | Promoted Slot (`32..67`) -> `(hero_class_id, mv_bonus)` |
| `GLOBAL_3_5702` | `Obj 3` | `349,254` | `580 B` | `29 × 20 B` | Class × Terrain Movement Cost Matrix (`20` = impassable) |
| `GLOBAL_3_6282` | `Obj 3` | `349,834` | `203 B` | `29 × 7 B` | Class Equipable `itemType` Allow-List (`0xFF` = unused) |
| `GLOBAL_3_6485` | `Obj 3` | `350,037` | `168 B` | `21 × 8 B` | Weapon `itemType` (`0..20`) Fast Map-Hit Effect Frames & SFX |
| `GLOBAL_3_6653` | `Obj 3` | `350,205` | `252 B` | `36 × 7 B` | Master Spell & Summon Database (`sid = 0..35`) |
| `GLOBAL_3_6905` | `Obj 3` | `350,457` | `680 B` | `68 × 10 B` | Enemy / NPC / Boss Class Stats (`uid = 68..135`) |
| `GLOBAL_3_7585` | `Obj 3` | `351,137` | `768 B` | `32 × 24 B` | Base Playable Hero Definitions (`uid = 0..31`) |
| `GLOBAL_3_8353` | `Obj 3` | `351,905` | `748 B` | `68 × 11 B` | Level-Up Stat Growth Ranges & Spell List Link (`id = 0..67`) |
| `GLOBAL_3_9101` | `Obj 3` | `352,653` | `806 B` | `26 × 31 B` | Town Shop Inventories (`ch = 1..26`, `fn_255161` `(ch - 1) * 31`) & Secret Shop Scan-Codes |
| `GLOBAL_3_9907` | `Obj 3` | `353,459` | `240 B` | `20 × 12 B` | Spell-Learning Level Progression Lists (`0..19`) |

---

### 3.2 Item Table (`215 × 23 B` at `344,237`) & Weapon Map-Hit Effects (`350,037`)

Each 23-byte item record `rec[0..22]` (`iid = 0..214`, name at `FDTXT[0][181 + iid]`, icon at `FDOTHER[96][iid]`):
- `rec[0]`: `itemType` (`1..20` = Weapon subtypes: Sword, Greatsword, Lance, Axe, Bow, Crossbow, Claw, Staff, Fan, Boomerang, Dark/Beam, Dragon Breath; `21..31` = Armor/Shield/Robe/Mantle subtypes; `32` = Single-Use Usable Consumable / Stat Potion / `#102 修理套件`; `33` = Sellable Gem `201..204`; `34` = Special Key / Promotion / Quest Item).
- `rec[1..2]`: `int16 ap` (Attack Power bonus when equipped).
- `rec[3..4]`: `int16 hit` (Hit % bonus when equipped).
- `rec[5..6]`: `int16 dp` (Defense Power bonus when equipped).
- `rec[7..8]`: `int16 ev` (Evade % bonus when equipped).
- `rec[9]`, `rec[10]`: Weapon Passive / On-Hit Special (`statusEffect`, `statusRate`):
  - `0`: None
  - `1`: **Poison On-Hit** (`statusRate`% chance on hit to inflict Poison)
  - `2`: **Paralysis On-Hit** (`statusRate`% chance on hit to inflict `2..5` turns of Paralysis, `L60969`)
  - `3`: **Innate Double-Strike Weapon** (`2` attacks per combat round!)
  - `4`: **Critical Hit Bonus Weapon** (`+statusRate`% added directly to class Crit %, `L60955`!)
  - `5`: **HP Regen / Special Aura**
- `rec[11]`, `rec[12]`: `uint8 minRange`, `uint8 maxRange` (`1..1` = melee; `2..2` or `2..3` or `2..5` = ranged-only; `1..2` = melee+ranged).
- `rec[13]`, `rec[14..15]`, `rec[16]`, `rec[17]`, `rec[18]`: `uint8 useEffect`, `uint16 useVal`, `uint8 useRange`, `uint8 useTarget` (`1` = ally, `0` = enemy, `5` = not usable), `uint8 useAoe` (`fn_68719` master `道具 -> 使用` & AI `fn_22142 / fn_20565` effect table):
  - `useEffect = 5` (Single-use HP heal, `itemType = 32`): `#192 藥草 (+40, r=1, aoe=0)`, `#193 回復劑 (+120, r=1, aoe=0)`, `#194 再生藥 (+300, r=1, aoe=0)`, `#195 神聖之水 (+999, r=1, aoe=0)`, and **`#102 修理套件` (`+500 HP, useRange = 4, useAoe = 2`)**!
  - `useEffect = 6 / 7 / 11`: `#196 解毒劑`, `#197 退麻劑`, `#206 魔法水 (+80 MP)`, `#207 水晶粒 (+200 MP)` (`r=1, aoe=0`).
  - `useEffect = 8 / 9 / 10 / 17 / 18 / 19` (Permanent self-only stat boosts, `useRange = 0`): `#198 力量藥水 (+9 AP)`, `#199 耐力藥水 (+9 DP)`, `#200 速度藥水 (+7 DX)`, `#94 生命之實 (+20 MaxHP)`, `#95 魔力水晶 (+20 MaxMP)`, `#96 風精之羽 (+1 MV)`.
  - `useEffect = 13` (Reusable weapon/relic HP heal, NOT consumed): `#40 光之斧 (+100, r=2, aoe=1)`, `#58 力之杖 (+300, r=2, aoe=0)`, `#61 光之杖 (+500, r=3, aoe=2)`, `#211 光之眼 (+200, r=4, aoe=1)`.
  - `useEffect = 20..23` (Reusable 0-MP spell-casting weapons): `#56 魔法杖 (火炎術, r=2)`, `#11 炎龍劍 / #60 龍之杖 (炎龍術, r=3/2)`, `#38 閃雷鎚 (電擊術, r=2, aoe=1)`, `#29 戰神戟 / #99 雷神鞭 (轟雷術, r=3, aoe=2/1)`, `#51 風神弓 (神雷術, r=2, aoe=1)`, `#57 封咒杖 (封咒術, r=3)`, `#101 傳送法杖 (傳送術, r=1)`.
- `rec[19..20]`: `uint16 price` (Buy price in Gold; **Sell price** in shops is `price * 3 / 4` = `75%`!).

---

### 3.3 Hero Classes (`1..28`), Move Costs, Equip Masks, Crit Rates & Magic Multipliers

| Class ID | Name (`sys[150+id]`) | Base Crit % (`GLOBAL_2_9115`) | Magic Mult % (`GLOBAL_2_8086`) | Equipable `itemType`s (`GLOBAL_3_6282`) | Movement Notes (`GLOBAL_3_5702`) |
| :---: | :--- | :---: | :---: | :--- | :--- |
| **1** | 戰士 | `5%` | `100%` | `1, 2, 21, 22` | Standard foot |
| **2** | 步兵 | `3%` | `100%` | `4, 21, 23` | Heavy armor foot |
| **3** | 騎士 | `3%` | `100%` | `3, 5, 21, 22` | Cavalry (fast plains, slow forest/sand) |
| **4** | 弓兵 | `5%` | `100%` | `6, 7, 24` | Standard foot |
| **5** | 僧侶 | `3%` | `100%` | `9, 25` | Robed foot |
| **6** | 法師 | `3%` | `110%` | `9, 25` | Mage foot (`+10%` spell dmg) |
| **7** | 機械兵 | `0%` | `100%` | *(unused base)* | Mechanical |
| **8** | 武者 | `18%` | `100%` | `8, 26` | Agile martial artist (`18%` crit!) |
| **9** | 劍士 | `5%` | `105%` | `1, 2, 21, 22` | Promoted swordsman |
| **10** | 重甲步兵 | `3%` | `100%` | `4, 5, 21, 23` | Promoted heavy infantry |
| **11** | 聖騎士 | `3%` | `100%` | `3, 5, 21, 22` | Promoted paladin |
| **12** | 狙擊手 | `12%` | `100%` | `6, 7, 24` | Promoted sniper (`12%` crit) |
| **13** | 祭司 | `3%` | `105%` | `9, 25` | Promoted priest |
| **14** | 大法師 | `3%` | `120%` | `9, 25` | Archmage (`+20%` spell dmg) |
| **15** | 龍劍士 | `12%` | `100%` | `1, 2, 21, 24` | Birdman/winged swordsman (`12%` crit) |
| **16** | 武術家 | `10%` | `100%` | `8, 26` | Promoted martial artist |
| **17** | 劍聖 | `6%` | `110%` | `1, 2, 11, 21, 22` | Sol's Tier-3 Sword Saint |
| **18** | 神將 | `3%` | `105%` | `4, 5, 12, 21, 23` | Tier-3 Divine General |
| **19** | 飛龍騎士 | `3%` | `100%` | `3, 5, 13, 21, 22` | **Flying** Dragon Knight (cost `1` across all passable terrain!) |
| **20** | 魔弓手 | `7%` | `110%` | `6, 7, 14, 24` | Tier-3 Magic Archer |
| **21** | 召喚師 | `3%` | `120%` | `9, 10, 25` | **Summoner** (can cast Spells `32..35`, `+20%` magic!) |
| **22** | 聖者 | `3%` | `130%` | `9, 10, 25` | Tier-3 Saint (`+30%` spell dmg!) |
| **23** | 忍者 | `30%` | `110%` | `1, 8, 26` | Ninja (`30%` highest innate crit in game!) |
| **24** | 武聖 | `18%` | `105%` | `8, 26` | Tier-3 Martial Saint (`18%` crit) |
| **25** | 機甲神兵 | `0%` | `100%` | `4, 5, 27` | Cyborg / Mecha (`#30 蓋亞`, `#31 渥德`, `#113`) |
| **26** | 魔神 | `0%` | `130%` | Demon Gods / Bosses (`+30%` spell dmg) | |
| **27** | 村民 / 王族 | `0%` | `100%` | `#133..#135` Non-combatant NPCs | |
| **28** | 龍戰士 | `0%` | `110%` | `#28 達克塞` (grounded Dragonkin; uses row `1` move costs at `L5823`) | |

---

### 3.4 Promoted Class & MV Bonus Table (`36 × 2 B` at `349,182`) & Secret Promotions

When a hero promotes at the Church (`fn_136069` & `fn_137107`):
- **Eligibility (`fn_137107`, `L137182..L137290`)**:
  - Hero must be in `uid = 0..17`, **`uid != 7`** (`#7 蘭斯洛特` starts pre-promoted as `聖騎士`), and **`level >= 20`**.
  - Note: Although `L137195` only filters `uid < 18` and `uid != 7`, **`#16 凱拉斯`** is recruited as `龍劍士` (`class 15`) with pre-promoted stat totals (`HP 330, AP 210, DP 160`) and **`DATO[48]` is usurped by King Walt (`渥特王`) with empty `FIGANI[48] = (3,3,3)`**, so `#16` is already promoted and must NOT promote to `#48`! Meanwhile, **`#17 米亞斯多德`** joins at Lv 21 as unpromoted `戰士` (`class 1`) and **DOES** promote at the Church to **`#49 龍劍士`** (`GLOBAL_2_9895[17] == 255`, so `#17` has no Tier-3 secret promotion; `#67` is an unused leftover slot with empty `FIGANI`!).
- **Target Slot Selection**:
  1. Default Tier-2 slot = `uid + 32` (`#32..#49`).
  2. If the hero holds their **Secret Promotion Item** `GLOBAL_2_9895[uid]` (`[89, 93, 255, 93, 205, 205, 205, 205, 92, 88, 88, 88, 91, 92, 88, 91, 255, 255]`), target upgrades to **`uid + 50`** (`#50..#65`) and consumes the item!
     - `88 聖者之戒` -> `#9 悠妮 (#59 聖者)`, `#10 瑪琳 (#60 聖者)`, `#11 索菲亞 (#61 聖者)`, `#14 珊 (#64 聖者)`
     - `89 勇者徽章` -> `#0 索爾 (#50 劍聖)` (awarded via Ch 18 hidden event `L151036`!)
     - `90 精靈契印` -> **Special override for `#9 悠妮` (`L137257`)**: promotes to **`#52 召喚師`**!
     - `91 領悟之書` -> `#12 凱麗 (#62 武聖)`, `#15 塞可邦勒 (#65 武聖)`
     - `92 心眼之書` -> `#8 希莉亞 (#58 魔弓手)`, `#13 貝克威 (#63 魔弓手)`
     - `93 白金徽章` -> `#1 哈諾 (#51 神將)`, `#3 哈瓦特 (#53 神將)` *(Note: `DATO[53]` portrait is borrowed by an Imperial General NPC, so `#53` uses `FIGANI[53]` + `FDICON[53]` while keeping `#35` portrait in UI where appropriate)*
     - `205 飛龍卵` -> `#4 亞雷斯 (#54 飛龍騎士)`, `#5 洛娜 (#55 飛龍騎士)`, `#6 萊汀 (#56 飛龍騎士)`
- **Stat Changes Upon Promotion (`L136549..L137095`)**:
  - `unit.portrait_id (unit+7) = target_promo_uid` (note: `unit.hero_id (unit+8)` stays the original `0..17` ID so dialogue lookups and save tracking still recognize the hero!).
  - `unit.class_id (unit+32) = GLOBAL_3_5630[target_promo_uid - 32].class_id`.
  - One immediate growth roll (`fn_58665`) is applied using `GLOBAL_3_8353[target_promo_uid]`.
  - `unit.mv (unit+59) += GLOBAL_3_5630[target_promo_uid - 32].mv_bonus` (`+0`, `+1`, or `+2` MV!).
  - `unit.level (unit+33)` resets to **`1`**, `unit.exp (unit+60)` resets to **`0`**, HP & MP refill to `100%`, and any Lv 1 spells in the new class's `spellListId` are learned (`fn_46928`).

---

### 3.5 Spell Table (`36 × 7 B` at `350,205`) & Spell Routing

Each 7-byte spell record `rec[0..6]` (`sid = 0..35`, name at `FDTXT[0][441 + sid]`):
- `rec[0..1]`: `uint16 base_power`
- `rec[2]`: `uint8 base_hit_rate` (`%`)
- `rec[3]`: `uint8 range_flags` (`rec[3] & 0x0F` = cast range `0..15`; `rec[3] & 0x10` = linear directional beam AoE!)
- `rec[4]`: `uint8 aoe_radius` (`0` = single target, `1..4` = diamond Manhattan blast radius around target tile)
- `rec[5]`: `uint8 mp_cost`
- `rec[6]`: `uint8 target_type` (`0` = Enemy target, `1` = Ally target)

#### Exact Engine Dispatch by Spell ID (`fn_21185` & `fn_98249`)
- **`sid = 0..9` (Cutaway Offensive Elemental / Dark / Holy Spells — `Func_108289` & `GLOBAL_9145[0..9]`)**:
  - Have **full Cutaway Battle Stage animations** (`FDOTHER` chunks `18..28, 30, 32, 33, 37..39, 43, 44`) when `GLOBAL_2_15097 == 0`, or on-map impact effects when fast combat is enabled.
  - **`#2 炎龍術` (`GLOBAL_9145[2]`, `fn_91432`, `FDOTHER[26]` vs Left Enemy / `FDOTHER[27]` vs Right Hero, `18` frames `F00..F17`) — Exact 3-Stage Non-Linear Frame Order**:
    - **Crucial Archive Layout**: Frames `F10..F14` inside `FDOTHER[26]/[27]` are **NOT** pre-impact frames — they are the **post-impact exit frames** where the dragon closes its jaws and ascends off the top edge (`h = 118 -> 89 -> 61 -> 35`)! Playing `0..14` linearly before `15` causes the dragon to fly off-screen prematurely and teleport back down.
    - **Stage 1 — Entrance & Mid-Air Coil (`Phase 0/1/2`, `29` ticks total — played ONCE before Target 0)**:
      `F00`(2), `F01`(2), `F02`(2), `F03`(2), `F04`(2), `F05`(3), `F06`(3), `F07`(3, `SFX 7`), **`F08`(7 ticks hover/coil!)**, `F09`(2 lunge), `F15`(1 tick snap-open; vs Right Hero `FDOTHER[27]`, tick 28 draws `F15 + F16` behind). Z-layer: in front (`Phase 1`) vs Left Enemy; behind (`Phase 2`) vs Right Hero.
    - **Stage 2 — Blazing Flame Breath Impact (`Phase 3/4/5`, `12` ticks at `1` tick each — played on EACH target)**:
      Alternates **`F16` (even ticks `0,2,4,6,8,10` + `SFX 17`)** and **`F17` (odd ticks `1,3,5,7,9,11`)** every single `55ms` tick over the roaring dragon head **`F15`**! Z-layer: vs Left Enemy, `F15` is drawn behind (`Phase 4`) while `F16/F17` engulfs in front (`Phase 5`); vs Right Hero, both `F15` and `F16/F17` are drawn in front (`Phase 5`).
    - **Stage 3 — Ascent / Exit (`Phase 6/7/8`, `10` ticks total)**:
      Triggers `SFX 6` and plays **`F10`(2) $\rightarrow$ `F11`(2) $\rightarrow$ `F12`(2) $\rightarrow$ `F13`(2) $\rightarrow$ `F14`(2)** (in front vs Left Enemy, behind vs Right Hero), smoothly closing its jaws and soaring out the top of the screen.
  - Note: **`sid = 24, 28, 29, 30` (`破龍擊, 淒煌斬, 熾炎刀, 音速刃`)** route to `fn_95980` (`必殺/劍氣` special techniques), and **`sid = 31` (`再生`)** is an unused dummy/monster slot masked out of player spell lists.
- **`sid = 10..28` (Healing, Cure, Stat Buff & Status Ailment Support Spells)**:
  - **NEVER enter the cutaway Battle Stage** (`L21365`)! They execute **strictly on the tactical map** using `FDOTHER[29]` sparkle/aura sprites!
  - Includes Healing (`醫療, 恢復, 治癒, 大地之癒`), Detox/Unparalyze (`解毒, 醒覺`), Turn/Action Reset (`再動`), AP/DP Buffs (`神聖之光, 保護之光, 加速`), Poison/Paralysis/Silence Debuffs (`施毒, 麻痺, 封魔`), and HP Transfer/Drain.
- **`sid = 32..35` (The Four Summon Spells — `熾天使, 風妖精, 破壞神, 暗邪鬼`)**:
  - Learned only by `#52 召喚師` (`悠妮` promoted with `90 精靈契印`, `spellListId = 19`).
  - Rendered as **full-screen/map-wide summon animations** by `fn_98249` using **`FDOTHER[65..68]`** (`sid + 33`) and `.VOC` sound banks **`FDOTHER[91..94]`**! (Completely unrelated to `DATO[128..132]`!)

---

### 3.6 Base Hero Table (`32 × 24 B` at `351,137`), Growth Table (`68 × 11 B` at `351,905`) & Enemy Class Table (`68 × 10 B` at `350,457`)

#### A. Growth Record (`11` bytes at `351,905 + id * 11` for `id = 0..67`)
> [!WARNING]
> **Exact Byte Order Verified in `fn_4773` (`L4854..L5155`) & Church Promotion (`L136860..L136950`)**:
> - `r[0], r[1]`: **`AP` growth `[min, max]`** (NOT HP!)
> - `r[2], r[3]`: **`DP` growth `[min, max]`**
> - `r[4], r[5]`: **`DX` growth `[min, max]`**
> - `r[6], r[7]`: **`HP` growth `[min, max]`**
> - `r[8], r[9]`: **`MP` growth `[min, max]`**
> - `r[10]`: `spellListId` (`0..19` into `GLOBAL_3_9907`, or `0xFF` = learns no spells)

#### B. Base Hero Record (`24` bytes at `351,137 + hid * 24` for `hid = 0..31`)
- `r[0]`: `race_id` (`1..6`)
- `r[1]`: `class_id` (`1..28`)
- `r[2]`: `join_level`
- `r[3..4]`: `uint16 base_hp`
- `r[5..6]`: `uint16 base_mp`
- `r[7]`: `uint8 base_mv`
- `r[8..11]`: `uint32 initial_spell_bitmask`
- `r[12..17]`: `6 × uint8` starting inventory items (`r[12]` auto-equipped as weapon `0x40`, `r[13]` auto-equipped as armor `0x40`, `r[14..17]` unequipped `0x00` or empty `0x80` if `0xFF`)
- `r[18..19]`: `uint16 base_ap`
- `r[20..21]`: `uint16 base_dp`
- `r[22..23]`: `uint16 base_dx`

#### C. Enemy / NPC Class Record (`10` bytes at `350,457 + (uid - 68) * 10` for `uid = 68..135`)
- `r[0]`: `race_id` (`1..10`)
- `r[1]`: `equiv_class_id` (`1..28`, governs move costs, crit rate, and magic multiplier!)
- `r[2..3]`: `uint16 hp_per_lv` (note `16`-bit! For `128..131` dummy records, `u16 = 500`)
- `r[4]`: `uint8 mp_per_lv`
- `r[5]`: `uint8 ap_per_lv`
- `r[6]`: `uint8 dp_per_lv`
- `r[7]`: `uint8 dx_per_lv`
- `r[8]`: `uint8 mv` (`0` for stationary bosses/turrets `#104, #105, #113, #127`!)
- `r[9]`: `uint8 exp_base` (base EXP yield factor on hit/kill; `1` for `#132..#135`)

---

### 3.7 Town Shop Inventories (`26 × 31 B` at `352,653`), Secret Shops & Camp-Only Chapters

- **Camp-Only Chapters (`GLOBAL_2_9913`, `337,081`)**: Indexed by 1-based chapter `M1[GLOBAL_2_9913 + ch]`: when `!= 0` (Chapters **`22, 23, 24, 27, 28, 29, 30`** — the Sky Journey & Final Golden Castle chapters), there is **NO Town** — the player goes straight to the Intermission Camp (`FDOTHER[11]`, Save/Load & Inventory management only).
- **Town Chapters (`26 × 31 B` records at `GLOBAL_3_9101`, `fn_255161` `(ch - 1) * 31` for `ch = 1..26`, with `22..24` zeroed)**:
  - `rec[0..2]`: **Secret Shop Trigger & Unlock Key** (`rec[0..1]` condition flags, `rec[2]` ASCII key code checked in shop UI to open `#132 秘密商人` Imp Merchant)!
  - `rec[3..14]` (`12` bytes): **Weapon & Armor Shop** item IDs (`#128 武器店老闆`, `0xFF` = empty).
  - `rec[15..22]` (`8` bytes): **Item / Provisioner Shop** item IDs (`#130 道具店店員`, `0xFF` = empty).
  - `rec[23..30]` (`8` bytes): **Secret Shop** rare/hidden item IDs (`#132 秘密商人`, `0xFF` = empty).

---

## 4. Runtime 80-Byte Unit Struct & Exact Gameplay Mechanics

### 4.1 80-Byte Runtime Unit Record (`offset 0..79`)

Both the persistent 32-hero party array (`GLOBAL_2_15351`) and the active 96-unit map array (`GLOBAL_2_14917`) use the exact same 80-byte struct:

| Byte Offset | Type | Field Name | Exact Meaning in `FD2.EXE` |
| :---: | :--- | :--- | :--- |
| **`0`, `1`** | `uint8, uint8` | `x, y` | Current map tile coordinates |
| **`2`, `3`, `4`** | `uint8 × 3` | `anim_frame, dir, vis` | Walk frame (`+2`: `0..2`), map sprite facing (`+3`: `0=Down/Front, 1=Left, 2=Up, 3=Right`; reset to `0` post-action by `fn_13540()`!), visibility (`+4`) |
| **`5`** | `uint8` | `state_flags` | `0x01`: Dead/Hidden (`!rendered`); `0x02`: Moved; `0x80`: Acted this turn (grayed out) |
| **`6`** | `uint8` | `faction` | `0` = Enemy, `1` = NPC Ally, `2` = Player Party |
| **`7`** | `uint8` | `portrait_uid` | **Visual Unit / Portrait / `FIGANI` ID (`0..135`)** — updates to `32..65` upon promotion! |
| **`8`** | `uint8` | `identity_uid` | **Base Character Identity ID (`0..135`)** — stays `0..31` across promotions! |
| **`9`** | `uint8` | `tmp_icon_slot` | Remapped row index inside `FD2.TMP` map sprite cache |
| **`10 .. 25`** | `8 × 2 B` | `inventory[8]` | 8 item slots `<uint8 flags, uint8 item_id>`: `flags = 0x80` empty, `0x00` carried, `0x40` **equipped**! |
| **`26 .. 29`** | `uint32` | `spell_mask` | Bitmask of learned spells (`bits 0..31`; Summoner `class 21` also unlocks `32..35`) |
| **`31`** | `uint8` | `race_id` | Race (`1..10`) |
| **`32`** | `uint8` | `class_id` | Hero/Equivalent Class (`1..28`) |
| **`33`** | `uint8` | `level` | Current Level (`1..40` unpromoted/T2, `1..30` T3, `1..99` for `#30 蓋亞` & `#31 渥德`) |
| **`34 .. 39`** | `uint8 × 6` | `status_timers` | `+34`:AP buff turns, `+35`:DP buff turns, `+36`:Poison turns, `+37`:Paralysis turns, `+38`:Silence/Sleep, `+39`:MV buff |
| **`49 .. 51`** | `u8, u16` | `drop_type, drop_val`| Enemy defeat drop (`0`=item, `1`=gold, `2/3`=boss event, `0xFF`=none) |
| **`52 .. 54`** | `uint8 × 3` | `ai_mode, ai_x, ai_y`| AI mode (`+52`) and target unit/coordinates (`+53, +54`) |
| **`55 .. 58`** | `i16, i16` | `base_ap, base_dp` | Naked AP and DP (before equipment) |
| **`59`, `60`** | `u8, u8` | `mv, exp` | Movement range (`mv`) and current EXP (`0..99`; `>= 100` triggers level-up!) |
| **`61`** | `uint8` | `ai_chest_idx` | Target treasure chest index for AI mode `5` thieves |
| **`62 .. 63`** | `int16` | `base_dx` | Naked Dexterity (`DX`, base for both Hit and Evade) |
| **`64 .. 67`** | `u16, u16` | `hp, max_hp` | Current HP and Maximum HP |
| **`68 .. 71`** | `u16, u16` | `mp, max_mp` | Current MP and Maximum MP |
| **`72 .. 79`** | `i16 × 4` | `eff_ap, eff_dp, hit, ev`| **Equipped Combat Totals** recalculated by `fn_5210` (`+72`=AP, `+74`=DP, `+76`=Hit, `+78`=Evade) |

---

### 4.2 Hero Recruitment, Enemy Spawn Stat Initialization & Equipment Recalculation

1. **Hero Recruitment Initialization (`fn_4773`, `L4846..L5188`)**:
   Given Hero `H = GLOBAL_3_7585[hid]` (`lv = H.join_level`) and Growth `G = GLOBAL_3_8353[hid]`:
   ```text
   max_hp  = H.base_hp + (lv - 1) * G.hp_min     // G[6]
   max_mp  = H.base_mp + (lv - 1) * G.mp_min     // G[8]
   base_ap = H.base_ap + lv * G.ap_min           // G[0]
   base_dp = H.base_dp + lv * G.dp_min           // G[2]
   base_dx = H.base_dx + lv * G.dx_min           // G[4]
   mv      = H.base_mv
   ```
2. **Enemy / NPC Spawn Initialization (`uid = 68..135` from `GLOBAL_3_6905[uid - 68]`)**:
   Given map spawn level `lv = urec[4]` and Enemy Class `E = GLOBAL_3_6905[uid - 68]`:
   ```text
   max_hp  = lv * uint16(E[2..3])
   max_mp  = lv * E[4]
   base_ap = lv * E[5]
   base_dp = lv * E[6]
   base_dx = lv * E[7]
   mv      = E[8]
   ```
   *(First weapon and first armor in `urec[5..12]` have their `0x40` equipped flag set automatically!)*
3. **Equipment Stat Recalculation (`fn_5210`, `L5210..L5381`)**:
   ```text
   eff_ap = base_ap + sum(item.ap  for equipped items)
   eff_dp = base_dp + sum(item.dp  for equipped items)
   hit    = base_dx + sum(item.hit for equipped items)
   evade  = base_dx + sum(item.ev  for equipped items)
   ```

---

### 4.3 Physical Combat Pipeline (`fn_60615` & `fn_103325`)

1. **Multi-Attack / Double & Triple Strike Check (`fn_59478 @59569..59599`, `fn_103325 @103530`, `fn_106354 @106811`)**:
   - **Zero Stat / Profession Scaling**: Exhaustively verified across all 28 classes (`class_id = 1..28`), `HIT`, `EV`, `DX`, `LV`, and `race_id` — **NO character stat or profession affects multi-attack rate** (professions only affect **Critical Hit %** via `GLOBAL_2_9115`, e.g. `忍者 30%`, `武者/武聖 18%`, `狙擊手/龍劍士 12%`, `鬥士 10%`).
   - **Two Independent Extra-Swing Sources**:
     1. **Innate `3%` Proc (`fn_103325 @103530` / `fn_59478 @59582`)**: Rolls `fn_256147(1, 100) <= 3` (**flat `3%` chance** to grant `+1` extra attack).
     2. **Weapon `statusEffect == 3` (`#71 魔龍爪` ONLY, `fn_106354 @106811`)**: Among all 215 items in `GLOBAL_3_685`, `#71 魔龍爪` (`statusRate = 0`) is the **only** item with `statusEffect == 3`, granting a **`100%` guaranteed extra attack** via `Obj2+533628 = 1`.
   - **How a Character Attacks 3 Times (`3%` + `#71 魔龍爪` Stacking in `fn_103325`)**:
     - In Fast Map Combat (`fn_59478 @59569..59599`), if `statusEffect == 3` is equipped, the `3%` branch is skipped (`swings = 2` max).
     - In Cutaway Combat (`fn_103325`), **`@103530` rolls the `3%` innate extra swing BEFORE `fn_106354` checks `statusEffect == 3` (`Obj2+533628`)**, and the loop tail (`@105312..105596 -> 103560`) consumes **both** independently! Thus:
       - Normal weapons (`iid != 71`): **1 attack (`97%`)** or **2 attacks (`3%`)**.
       - **`#71 魔龍爪` (`statusEffect == 3`)**: **2 attacks (`97%`)** or **3 attacks (`3%`)** when the innate `3%` roll ALSO hits! (And in Cutaway Combat `fn_100972 @102112`, a retaliating defender also executes `fn_103325`, inheriting the same `3%` / `#71` rule!)
   - **Original 1995 `FD2.EXE` Multi-Hit EXP Overwrite Bug & `fd2-web` Fix**:
     - In `FD2.EXE`, `fn_60615` (`@61477/@61501`) and `fn_106354` (`@107100/@107126`) run once per strike and **assign** `GLOBAL_2_16072 = strike_exp` (`=`) rather than accumulating (`+=`), causing a non-lethal 2nd or 3rd hit to overwrite all earlier hits' EXP!
     - In `fd2-web` (`resolveCombat`), EXP is computed from the **overall effective HP removed across all 1, 2, or 3 hits** (`defenderStartHp - defender.hp`), or awards **full kill EXP** (`fullKillExp`) when `defender.hp <= 0`!
2. **Terrain AP / DP Modifiers (`L60798..L60935`)**:
   - Skipped if the unit is **Flying** (`fn_61827(u) != 0`).
   - Otherwise:
     - `att_ap = eff_ap + (eff_ap * GLOBAL_2_6674[att_tile_bonus_idx]) // 100` (`[+5%, 0%, -5%, -5%, -5%, 0%]`)
     - `def_dp = eff_dp + (eff_dp * GLOBAL_2_6698[def_tile_bonus_idx]) // 100` (`[0%, 0%, +10%, +10%, -5%, 0%]`)
   - Temporary spell buffs (`unit+34` AP buff, `unit+35` DP buff) add `+25%` while active.
3. **Hit / Evade Roll (`L61116`)**:
   - `hit_chance = attacker.hit - defender.evade` (clamped to `0..100` in práctica via `rand() % 100 < hit_chance`).
   - On miss: `damage = 0`, no white flash, no knockback recoil, no weapon status proc.
4. **Critical Hit Roll & Effect (`L60936`, `L61156`)**:
   - `crit_rate = GLOBAL_2_9115[attacker.class_id - 1] + (weapon.statusRate if weapon.statusEffect == 4 else 0)`.
   - On crit (`rand() % 100 < crit_rate`): screen flashes white twice and **halves defender's effective DP**:
     ```text
     def_dp = def_dp // 2
     ```
5. **Physical Damage Formula (`L61294..L61385`)**:
   ```text
   delta    = max(0, att_ap - def_dp)
   base_dmg = (delta * 9) // 10
   spread   = base_dmg // 9
   damage   = base_dmg + (rand() % spread if spread > 0 else 0)
   ```
   *(Uniformly `90% .. 100%` of `att_ap - def_dp`; minimum `0` or `1` scratch if `delta <= 1`.)*
   - Note: Multi-hit `FIGANI` animations (`sp+96 > 1` frames with `hit_flag != 0`) split `damage` evenly across each impact frame (`cum_dmg = (hit_idx * total_dmg) // total_hits`, `L104238`) so the HUD HP bar drains smoothly on every strike!
6. **Weapon Status Ailment Procs (`L60969` & `L104605..L104895`)**:
   - If `damage > 0` and defender survives (`hp > 0`):
     - `weapon.statusEffect == 1` (**Poison**) & `rand() % 100 < statusRate`: inflicts Poison (`unit+36`), flashes dark blue-violet.
     - `weapon.statusEffect == 2` (**Paralysis**) & `rand() % 100 < statusRate`: inflicts `2..5` turns of Paralysis (`unit+37 = (rand() % 4) + 2`), flashes white.
7. **Counterattack Eligibility (`fn_61660`, `L61660..L61826`)**:
   Defender counterattacks (`1` swing, no double-attack) **if and only if ALL four conditions hold**:
   1. Defender survived (`defender.hp > 0`),
   2. Defender is not paralyzed/incapacitated (`unit+37 == 0` and `unit+38 == 0`),
   3. Combat distance is strictly **adjacent melee** (`|ax - dx| + |ay - dy| == 1`),
   4. Defender has an **equipped weapon** (`fn_47165(defender, 0) != -1`) whose **`minRange == 1`**!

---

### 4.4 Magic & Summon Pipeline

- **Offensive Magic & Summon Damage**:
  - Caster class magic multiplier `M = GLOBAL_2_8086[caster.class_id - 1]` (`100` to `130`).
  - Effective spell power scales by `spell.power * M // 100` with ±10% random variance, reduced by target magical resistance / level factor; hits if `rand() % 100 < spell.hit`.
- **Healing Magic**:
  - Restores `spell.power * M // 100` HP (clamped to `target.max_hp`) directly on the map with `FDOTHER[29]` sparkles.

---

### 4.5 Turn Recovery, Resting (`20%` Max HP), EXP & Level-Up

- **Idle Rest Healing (`fn_16340`, `L16340..L16672`)**:
  - If a unit ends its turn **without moving and without acting**, has `hp < max_hp`, and is not poisoned/paralyzed, it automatically recovers **`max_hp // 5` (`20%` Max HP)** with green `FDOTHER[29]` sparkles!
- **Poison Tick**: Deals `10%` Max HP per turn at turn start (non-lethal floor `1 HP`).
- **Equipment Eligibility Rule (`fn_3152`, `fn_47165`, `fn_49602`)**:
  - `fn_49602` (`GLOBAL_3_6282` `classEquipMasks`) has **only two callers** in `FD2.EXE`: `fn_49149` (Battlefield Player Equip UI) and `fn_127151` (Town/Camp Equip UI).
  - Map-spawned enemies & NPC allies (`fn_3152`) **unconditionally equip** their first weapon (`0x40`) and first armor (`0x40`) from `urec[5..12]`, and `fn_47165` returns that equipped slot without filtering against `GLOBAL_3_6282` (essential so units like Ch 1 `#96 盜賊` with `#0 短劍` and `#113 光束砲座` with `#79 光束炮` equip their weapons and retaliate properly!).
- **Combat, Counterattack & Support EXP Formula (`fn_60615`, `fn_51231`, `fn_51478`, `fn_6118`, `fn_21264`)**:
  - Effective unit level `eff_lv = unit.level + (30 if (9 <= class_id <= 24 or identity_uid == 28) else 0)` (promoted classes & `#28 達克塞` count as `level + 30`!).
  - **Kill EXP**: `(enemy_exp_base * enemy_lv) // eff_lv` (clamped `1..99` at `fn_6118 L6489`).
  - **Non-Lethal Hit EXP (Attack, Offensive Spell, AND Enemy-Phase Retaliation!)**: `((enemy_exp_base * enemy_lv) // eff_lv) * damage // enemy_max_hp` (e.g., in Ch 1, Lv.1 `#0 索爾` dealing `20` damage to Lv.2 `#96 盜賊` (`exp_base=21, max_hp=28`) earns `(42 * 20) // 28 = 30 EXP`, or `42 EXP` on kill!).
  - **Healing Magic EXP (`fn_51478`)**: `((40 * target_eff_lv) // caster_eff_lv) * actual_hp_healed // target_max_hp`.
- **Post-Action Character EXP & Level-Up Portrait Dialogue (`fn_58002`, called at `fn_6118 @6509` & `fn_21264 @22122`)**:
  - Whenever a surviving player character earns `GLOBAL_2_16072 > 0` EXP (on Player Phase OR Enemy Phase counterattack), `fn_58002` opens the character's `DATO` portrait dialogue box and prints **`FDTXT[0][488]` (`得到經驗 XX 點！`)**.
  - When `exp >= 100` (**Level-Up**): `exp -= 100`, `level += 1` (caps: `40` unpromoted/T2, `30` T3, `99` `#30/#31`), plays fanfare `fn_55196`, rolls `[min..max]` stat gains from `GLOBAL_3_8353[portrait_uid]`, and prints **`FDTXT[0][489]` (`等級上升了！！`)**, **`FDTXT[0][490..494]` (`力量/耐力/速度/ＭＨＰ/ＭＭＰ上升 X 點！`)**, and **`FDTXT[0][587]` (`學會了 [法術名稱]！`)** for any newly unlocked spell in `GLOBAL_3_9907[spellListId]`.

---

### 4.6 AI Controller (`fn_15007`), Unified Action Arbiter (`fn_20208`) &Consumable Item Logic (`fn_22142 / fn_22656`)

- **Phase Calling Convention (`fn_55307`, `fn_55482`, `fn_55762`)**:
  - `fn_55307` (Ally Phase) and `fn_55762` (Player `委任行動`) pass `side_flag = 1` (`edx = 1`) to `fn_15007(slot, side_flag)`, while `fn_55482` (Enemy Phase) passes `side_flag = 0`. Friendly units (`Player` + `Ally`) never exert ZOC on one another, so Ally units (`#2 鐵諾`, `#68..#73` troops, and Ch 2 `#133/#134` civilians) move their full `MV` per turn.
- **Exact `ITEM_TABLE` (`Obj 3 + 685`) HP Consumable Heal Amounts (`useConsumable` / `resolveAreaItemUse`)**:
  - `192 藥草`: **`+40 HP`** (`useRange = 1, useAoe = 0`)
  - `193 回復劑`: **`+120 HP`** (`useRange = 1, useAoe = 0`)
  - `194 再生藥`: **`+300 HP`** (`useRange = 1, useAoe = 0`)
  - **`102 修理套件`**: **`+500 HP` (`useRange = 4, useAoe = 2`)** — ranged radius-2 AoE heal carried (`6` copies per unit!) by **`#115 機甲守衛`** in Chapters `23, 26, 27, 28, 29` (reaches friendly units up to `4 + 2 = 6` tiles away and heals all friendly units within `2` tiles of the aimed center!).
  - `195 神聖之水`: **`+999 HP`** (`useRange = 1, useAoe = 0`)
- **Master 3-Way Action Arbiter (`fn_20208`, called in Modes `0, 1, 2, 3, 5, 10`)**:
  `fn_20208` evaluates **Usable Items (`fn_22142`)**, **Magic Spells (`fn_22922`)**, and **Physical Weapon Attacks (`fn_16951`)** on a shared integer score scale (`GLOBAL_2_15411`, `GLOBAL_2_15395`, `GLOBAL_2_15439`) with a **minimum execution gate of `score >= 4` (`> 3`)**:
  1. **Usable Healing & Spell-Casting Items (`fn_22142 -> fn_22656 -> fn_20565 -> fn_68719`)**:
     - **Eligible Items**: Single-use HP consumables **`192..195`** & **`102 修理套件`** (`useEffect = 5`), reusable healing staves/axes **`40, 58, 61`** (`useEffect = 13`), and 0-MP spell-casting staves/weapons **`11, 29, 38, 51, 56, 60, 99`** (`useEffect = 20, 21`). AI units never consume permanent stat potions (`94..96`, `198..200`), sellable gems (`201..204`), or promotion/story items (`88..93, 205, 208..214`).
     - **Range & AoE**: Evaluated strictly from `(unit.x, unit.y)` without moving, using `rec[16]` (`useRange`) and `rec[18]` (`useAoe`)! For `#102 修理套件` (`useRange = 4, useAoe = 2`), `fn_22142` sums `fn_22656` scores across every hurt friendly unit within `2` tiles of any aimed center within `4` tiles!
     - **Raw HP Threshold Scores (`fn_22656`)**:
       - `target.hp > floor(target.maxHp / 2)` (`> 50%` MaxHP): **`0`**
       - `floor(target.maxHp / 3) < target.hp <= floor(target.maxHp / 2)` (`33% < hp <= 50%` MaxHP): **`3`**
       - `target.hp <= floor(target.maxHp / 3)` (`<= 33%` MaxHP): **`8`**
     - **`0x80` Self-Preservation Multiplier (`(unit.aiMode & 0x80) != 0` at `@20302` & `@22739`)**:
       - Set on key named allies & elite/commander enemies (`#2 鐵諾` `0x81` in Ch 3, `#12 凱麗` `0x82` in Ch 7, `#117 卡特那` `0x82` in Ch 5, `#118 萊汀` `0x82` in Ch 9, `#68/#69/#70/#72` ally troops, and elite `#77` guards).
       - Multiplies **self-heal** score by **`3`** (`3 -> 9` at `<= 50%` HP; `8 -> 24` at `<= 33%` HP)!
       - Consequence:
         - **`0x80` units (`#2 鐵諾`, MaxHP `61`)**: At `21..30 HP` (`<= 50%`), `itemScore = 9` beats a normal weapon attack (`8`) so Tieno drinks `#192 藥草` (`+40 HP`), while still taking a guaranteed lethal blow (`18 > 9`); at `1..20 HP` (`<= 33%`), `itemScore = 24` beats **even a lethal blow (`24 > 18`)** so survival takes absolute priority!
         - **Non-`0x80` grunts (`0x00 / 0x01 / 0x02`)**: At `33% < hp <= 50%`, `rawItemScore = 3` falls below the `>= 4` gate, so grunts keep fighting until **`hp <= 33%` MaxHP (`itemScore = 8`)**, where `8 >= 8` (Item tie-break) triggers their herb unless they have a lethal blow (`18 > 8`)!
  2. **Magic Spells (`fn_22922 -> fn_23415 -> fn_20565 / fn_21265`)**:
     - Cast from `(unit.x, unit.y)` without moving (except Sword Saints `#18/#19/#34`).
     - **Healing (`13..16`)**: `3` per ally in `33%..50%` HP (`9` on self with `0x80`), `8` per ally `<= 33%` HP (`24` on self with `0x80`).
     - **Support / Status (`17, 18, 20, 21`, `22 封咒術` vs un-silenced spellcasters)**: **`6`**.
     - **Offensive (`0..12, 24, 28..35`)**: **`24`** per valid target (`> 18` single physical kill & `> 8` normal hit).
  3. **Physical Weapon Attacks (`fn_16951 -> fn_21646`)**:
     - Evaluated across reachable tiles (`MV + weaponRange`, or current tile only in Mode `2`).
     - **Non-lethal hit**: **`8`**; **Lethal kill (`damage >= target.hp`)**: **`18`**.
  4. **Movement & `+20%` MaxHP Rest (`fn_16340`)**:
     - If no action scores `>= 4`, the unit executes its AI Mode movement (`0, 1, 3, 5, 10, 11`).
     - If the unit ends its turn **without moving and without acting** (`!didMove && !didAct`), has `0 < hp < maxHp`, and is not poisoned/paralyzed, `fn_16340` restores **`floor(maxHp / 5)` (`20%` MaxHP)** with on-map heal sparkles.

AI mode is loaded from `urec[17]` into `unit+52` (`mode = unit[52] & 0x3F = 0..11`; `0x80` = self-preservation `×3` heal multiplier):
- **`0` (`0x00 / 0x80 / 0xC0` — Aggressive Charge)**: Try spell/item (`fn_20208`) or attack in reachable range (`fn_16673`); otherwise march along BFS shortest path toward the nearest opponent (`fn_16028`).
- **`1` (`0x01 / 0x81` — Proximity Engage)**: Engage if an opponent is within `fn_16673` proximity (`~2 × MV + range`); otherwise hold formation (`fn_16340` `+20%` HP rest if hurt). Mid-battle wake events (`EV 10, 13, 23, 26, 28, 29, 33, 34, 36`) overwrite `unit[52] &= 0xC0` (`Mode 0` Aggressive Charge)!
- **`2` (`0x02 / 0x82 / 0xC2` — Hold Position / Stationary Guard)**: Calls `fn_20208` / `fn_16951` from current tile `(x, y)` **only** — **never moves** (`#113 光束砲座`, gatekeepers, throne/altar bosses).
- **`3` (`0x03 / 0x83` — Escort / Protect Character `uid == unit[53]`)**: Attacks enemies in reach (`fn_20208 -> fn_16673`), otherwise follows & guards character `uid = urec[18]` (`fn_11360 -> fn_19320`):
  - Ch 11 `#14 珊` escorts `#13 貝克威`; Ch 16 `#68 士兵` (`slots 66..73`) escort `#18 蜜蒂`; Ch 20 `#72 精靈` (`slots 53..60`) escort `#25 謝多`; Ch 21 `#72 精靈` escort `#24 希爾法` & `#23 羅蘭`; Ch 25 `#73 龍人` escort `#26 聖寇拉斯`.
- **`4` (`0x04 / 0x84` — Non-Combat March / Flee to `(unit[53], unit[54])`)**: Calls `fn_19320(unit[53], unit[54])` directly **without initiating combat**:
  - **Ch 2 (`羅德鎮`) `#133/#134` Civilians (`slots 5..10`)**: `slots 5..6` at `(16,12),(15,12)` flee across the inner east bridge to **`(19, 6)`**; `slot 7` at `(9,12)` flees north to **`(16, 0)`**; `slots 8..10` at `(7,7),(6,10),(23,6)` flee north to **`(15, 0)`** — running *away* from the West `(1..3, 8..11)` & South `(9, 20)` bandits and holding safely once arrived!
  - **Ch 12 `#17 米亞斯多德`**: retreats from `(15, 19)` toward `(15, 31)`.
  - **Ch 15 `#15 塞可邦勒`, `#71 豹人` & Beastmen**: march toward center island `(15..16, 15..16)` until **Turn 4 `EV 13`** switches them to `Mode 0` all-out battle!
- **`5` (`0x05` — Treasure Thief)**: Pathfinds to unopened chest `unit[61]` (`urec[2]`), opens it (`cell[0] += 1`), calls **`fn_48012`** (`@15608`) to append the stolen item directly into **`unit.items` (`unit+10..25`)** (so inspecting the thief on the map displays the stolen treasure in its inventory!) AND writes `unit.drop` (`unit[49..51]`) so killing the fleeing thief awards the stolen item/gold to the player killer, then switches `unit[52] = 7` to flee to `(unit[53], unit[54])` (Ch 11/13 `#102/#103`, Ch 16/19 `#98 影之忍者`).
- **`6` & `8` (Completely Passive / Immobile)**: Never moves or initiates attacks (`Mode 8`: Ch 10 `#135 卡納恩三世`; `Mode 6`: Ch 25 optional duel boss `#104 火龍`).
- **`7` (`0x07` — Retreat to `(unit[53], unit[54])` & Vanish)**: Moves toward `(unit[53], unit[54])` and vanishes off-map with `FDOTHER[9]` sparkles via `fn_141685` upon arrival (Ch 15 Turn 7 `#102 獸人` carrying `#211 光之眼` fleeing to `(29, 13)`, plus Mode `5` thieves after looting).
- **`9` (`0x89` — Follow Character `uid == unit[53]`)**: Follows character `uid = urec[18]` (Ch 18 `#21 約拿` & `#7 蘭斯洛特`).
- **`10` (`0x0A` — Combat March to `(unit[53], unit[54])`)**: Attacks targets in range (`fn_20208 -> fn_16673`), otherwise marches toward `(unit[53], unit[54])` (Ch 26 Mechs).
- **`11` (`0x0B / 0x8B / 0xCB` — Dual-Action Demon God Boss Engage, `fn_15007 @15881..15954`)**: Used by **`#126 空魔神`** (`slot 20`) in Chapter 30 once unlocked by `EV 80`. First evaluates and casts an offensive magic spell from its current position (`fn_22922 -> fn_21265`, `@15887..15912`), and **in the very same turn** (`@15917..15954`) evaluates physical weapon attack (`fn_16951 -> fn_21646`) or advances toward the party (`fn_16673`)!

**Triple Engine Safeguard Preventing `#133..#135` From Ever Attacking**:
1. **No Weapon Equipped**: `#133/#134` carry only `128 布衣` (armor) and `#135` carries only `187 王袍` (armor). `fn_16951` (AI physical evaluator), `fn_36236` (Player Action Menu), and `fn_61660` (Counterattack check) all require an equipped weapon (`fn_47165(unit, 0) != -1`).
2. **Non-Combat AI Modes**: `#133/#134` use AI mode `4` (non-combat flee to `(19,6)/(16,0)/(15,0)`) and `#135` uses AI mode `8` (passive).
3. **Empty `FIGANI` Attack Slots**: Their `FIGANI` Slot 1 & Slot 2 chunks are `3`-byte `[0, 0, 0]` stubs, while Slot 0 (`idle`) has `4` full frames so they render properly as **defenders/targets** when attacked by enemies!

---

## 5. Master 136-Slot Character & Entity Reference (`#000..#135` + `FDICON #136..#139`)

### 5.1 Entity Role Taxonomy & Battlefield / Combat Rules

Every slot `0..135` falls into one of **8 strict engine roles**:

| `entityRole` | Appears on Tactical Battlefield (`Ch 1..30`)? | Can Attack / Counterattack? | Valid in Battle Stage Dueler? | Slots |
| :--- | :---: | :---: | :--- | :--- |
| **`playable_hero`** | **Yes** (Player Party) | **Yes** | Attacker & Target | `#000 .. #031` (`32` heroes) |
| **`promoted_hero`** | **Yes** (via Lv20 Church Promo) | **Yes** | Attacker & Target | `31` reachable slots in `#032 .. #065` |
| **`ally_combatant`** | **Yes** (Friendly AI Troops) | **Yes** | Attacker & Target | `#068 .. #073` (`6` troop types) |
| **`enemy_combatant`** | **Yes** (Enemy Troops) | **Yes** | Attacker & Target | `#076 .. #096`, `#098 .. #102`, `#106 .. #115` |
| **`boss_combatant`** | **Yes** (Chapter / Final Bosses) | **Yes** | Attacker & Target | `#097`, `#103 .. #105`, `#116 .. #127` |
| **`battlefield_npc_noncombatant`** | **Yes** (Protected / Rescued NPC) | **NO (Target Only!)** | **Target Only** (Never Attacker!) | **`#133 女村民`, `#134 男村民`, `#135 卡納恩三世`** |
| **`town_npc`** | **NEVER** (Town Shop / Tavern / Church UI) | **NO** | **Excluded** (Portrait only) | **`#128 .. #132`** (`5` Town NPCs) |
| **`dialogue_or_cutscene_npc`** / **`unused`** | **NEVER** (Dialogue / Camp UI / Epilogue Cutscene / Unused) | **NO** | **Excluded** | **`#039`, `#048`, `#057`, `#066`, `#067`, `#074`, `#075`** |

---

### 5.2 Complete Slot-by-Slot Reference (`#000 .. #139`)

#### A. Base Playable Heroes (`#000 .. #031`) — All `appearsOnBattlefield = true, canAttack = true`

| ID | Name | Base Class | Join Lv | Default Lv20 Promo | Secret Lv20 Promo (Item) | Engine Notes |
| :---: | :--- | :--- | :---: | :--- | :--- | :--- |
| **`#000`** | 索爾 (Sol) | `1 戰士` | 1 | `#032 劍士` | `#050 劍聖` (`89 勇者徽章`) | Protagonist; Slot 2 `FIGANI` = ranged sword-wave (`雷光劍` etc.) |
| **`#001`** | 哈諾 | `2 步兵` | 3 | `#033 重甲步兵` | `#051 神將` (`93 白金徽章`) | Joins Ch 1 |
| **`#002`** | 鐵諾 | `1 戰士` | 4 | `#034 劍士` | — | Joins Ch 4; Slot 2 `FIGANI` = ranged |
| **`#003`** | 哈瓦特 | `2 步兵` | 23 | `#035 重甲步兵` | `#053 神將` (`93 白金徽章`) | `DATO[53]` is Imperial General; `#053` uses `FIGANI[53]` + `DATO[35]` |
| **`#004`** | 亞雷斯 (Ares) | `3 騎士` | 1 | `#036 聖騎士` | `#054 飛龍騎士` (`205 飛龍卵`) | Deuteragonist |
| **`#005`** | 洛娜 | `3 騎士` | 8 | `#037 聖騎士` | `#055 飛龍騎士` (`205 飛龍卵`) | Cavalry -> Flying Dragon Knight |
| **`#006`** | 萊汀 | `3 騎士` | 18 | `#038 聖騎士` | `#056 飛龍騎士` (`205 飛龍卵`) | Cavalry -> Flying Dragon Knight |
| **`#007`** | 蘭斯洛特 | `11 聖騎士`| 4 | *(Pre-promoted)* | — | Excluded from promotion (`L137200`); `#039` & `#057` are non-hero slots |
| **`#008`** | 希莉亞 | `4 弓兵` | 3 | `#040 狙擊手` | `#058 魔弓手` (`92 心眼之書`) | Split-camera ranged bow animation |
| **`#009`** | 悠妮 (Yuni) | `5 僧侶` | 1 | `#041 祭司` | `#059 聖者` (`88`) **OR** `#052 召喚師` (`90`) | **Only hero in FD2 who can become `#052 召喚師`** and cast Summons `32..35`! |
| **`#010`** | 瑪琳 | `6 法師` | 8 | `#042 大法師` | `#060 聖者` (`88 聖者之戒`) | Offensive & support mage |
| **`#011`** | 索菲亞 | `6 法師` | 16 | `#043 大法師` | `#061 聖者` (`88 聖者之戒`) | Offensive & support mage |
| **`#012`** | 凱麗 | `8 武者` | 10 | `#044 武術家` | `#062 武聖` (`91 領悟之書`) | 2-stage martial arts critical animation |
| **`#013`** | 貝克威 | `4 弓兵` | 8 | `#045 狙擊手` | `#063 魔弓手` (`92 心眼之書`) | Elf archer (`DATO` uses palette `192` `0xC0`) |
| **`#014`** | 珊 | `5 僧侶` | 16 | `#046 祭司` | `#064 聖者` (`88 聖者之戒`) | Elf healer |
| **`#015`** | 塞可邦勒 | `8 武者` | 23 | `#047 武術家` | `#065 武聖` (`91 領悟之書`) | Beastman martial artist |
| **`#016`** | 凱拉斯 | `15 龍劍士`| 2 | *(Pre-promoted)* | — | Winged flyer (`fn_61827`); `#048` & `#066` are King/Queen NPCs! |
| **`#017`** | 米亞斯多德 | `1 戰士` | 21 | `#049 龍劍士` | — | Promotes to `#049 龍劍士`; `#067` is unreachable/empty `FIGANI` |
| **`#018`..`#027`**| 蜜蒂, 羅德曼, 洛加, 潔西卡, 巴拿羅西亞, 希爾法, 莎拉, 卡里斯, 希瓦, 亞克 | Pre-promoted T2/T3 | `1..15`| *(Pre-promoted)* | — | Late-game pre-promoted recruits (`uid >= 18`, excluded at `L137195`) |
| **`#028`** | 達克塞 | `28 龍戰士`| 10 | *(Pre-promoted)* | — | Grounded Dragonkin (`L5823` uses foot move costs; `+30` EXP level) |
| **`#029`** | 亞齊梅吉 | `13 祭司` | 20 | *(Guest / Pre-promoted)*| — | Guest high priest |
| **`#030`, `#031`**| 蓋亞, 渥德 | `25 機甲神兵`| `1 / 25`| *(Cyborge Lv Cap 99)*| — | Level cap `99` instead of `40` |

#### B. Promoted Hero Templates & Story Portrait Slots (`#032 .. #067`)

- **31 Reachable Promoted Combatant Slots (`appearsOnBattlefield = true, canAttack = true`)**:
  - Tier 2 (`16` slots): `#032..#038`, `#040..#047`, `#049`.
  - Tier 3 (`15` slots): `#050..#056`, `#058..#065`. (Note: `#053` is Havart's `神將` combat template with full `FIGANI[53]` & `FDICON[53]`, while `DATO[53]` stores the Armored General portrait).
- **5 Non-Battlefield Story / Unused Slots (`appearsOnBattlefield = false, canAttack = false`)**:
  - **`#039 賢者長老` (Sage Elder)**: Dialogue-only portrait in Ch 13 (`0xFFEF 39`, explicitly special-cased at `L24994` in `fn_24452`!). `FDICON` = 0 frames. *(Has unused paladin dummy `FIGANI` left over from `7+32` slot layout, never spawned on any map).*
  - **`#048 渥特王` (King Walt)**: Dialogue/Prologue NPC (appears only in non-playable Opening Prologue Map 32 `m=32`, seated at `(7, 5)`). `FIGANI` = empty `(3,3,3)`, `FDICON` = 3 south-facing (`dir = 0`, `col = 0..2`) cutscene frames (`fn_3152` initializes `slot.dir = 0`).
  - **`#057` (Blank Unused Slot)**: Solid blue placeholder `DATO`, `0` `FDICON` frames, empty `FIGANI (3,3,3)`, `0` appearances.
  - **`#066 王后` (Queen)**: Prologue Cutscene NPC (appears only in non-playable Opening Prologue Map 32 `m=32`, seated at `(10, 5)`). `FIGANI` = empty `(3,3,3)`, `FDICON` = 3 south-facing (`dir = 0`, `col = 0..2`) cutscene frames (`fn_3152` initializes `slot.dir = 0`).
  - **`#067` (Unused Unreachable Template)**: `GLOBAL_2_9895[17] == 255`, `FIGANI` = empty `(3,3,3)`, `0` appearances anywhere.

#### C. Friendly Troop Units & Dialogue/UI NPCs (`#068 .. #075`)

- **`#068 士兵`, `#069 騎兵`, `#070 傭兵`, `#071 豹人`, `#072 精靈`, `#073 龍人`**: Friendly AI battlefield combatants (`ally_combatant`, `appearsOnBattlefield = true, canAttack = true`).
- **`#074 惡魔` (Dark Imp Messenger)**: **Dialogue-Only NPC** (`appearsOnBattlefield = false, canAttack = false`). Empty `FIGANI (3,3,3)`, `0` map appearances in `Ch 1..30`.
- **`#075 米蘭` (Milan — Young Boy Messenger & Camp/Town UI Guide)**: **Dialogue, Camp/Town UI & Epilogue NPC** (`appearsOnBattlefield = false, canAttack = false`).
  - **NEVER appears on any playable tactical battlefield (`Ch 1..30`)**!
  - Used in **9 UI prompt locations in `FD2.EXE`** (`L191` corrupt save notice, `L29138 / L40732 / L41388 / L41565 / L117803` End-Turn & Camp Save/Load/Quit confirmations, `L118995 / L138558 / L138765` Town departure confirmations) plus **Opening Prologue Map 31 (`m=31`, Forest Road Departure)** and **True Ending Map 30 (`m=30`, Royal Triumph)**! Empty `FIGANI (3,3,3)`.

#### D. Battlefield Enemies & Bosses (`#076 .. #127`) — All `appearsOnBattlefield = true, canAttack = true`

- **`#076 .. #127`**: All 52 slots are genuine tactical battlefield enemies and chapter bosses across `Ch 1..30`:
  - `#104 火龍`, `#105 雷龍`, `#121 沼澤怪物`, `#127 暗黑龍`: Stationary (`mv = 0`) multi-tile bosses embedded in map tiles (`FDICON` empty; `#121` uses `FIGANI` Slot 1 `attack` frames).
  - `#113 光束砲座`: Stationary (`mv = 0`) ranged-only (`2..5` range) solo-stage beam turret.
  - `#122 炎魔神, #123 冰魔神, #124 風魔神, #125 地魔神, #126 暗魔神`: The Five Elemental Demon Gods (`Ch 22..30`).
  - `#127 暗黑龍`: Final Boss (`race_id = 10`).

#### E. Town Shop/Tavern/Church NPCs (`#128 .. #132`) — **NEVER on Battlefield** (`appearsOnBattlefield = false, canAttack = false`)

| ID | True Role & Identity in `FD2.EXE` | Town Pointer | Blink Offset (`fn_38251`) | `FDICON` / `FIGANI` |
| :---: | :--- | :--- | :---: | :---: |
| **`#128`** | **武器店老闆** (Weapon & Armor Shop Blacksmith — Blue Giant) | `GLOBAL_2_9817[1,2] = 128` | `+4283` | `0` frames / Empty `(3,3,3)` |
| **`#129`** | **酒店女郎** (Tavern Waitress — Blonde Girl) | `GLOBAL_2_9817[0] = 129` | `+1707` | `0` frames / Empty `(3,3,3)` |
| **`#130`** | **道具店店員** (Item Shopkeeper — Blue-Haired Elf Girl) | `GLOBAL_2_9817[3] = 130` | `+3939` | `0` frames / Empty `(3,3,3)` |
| **`#131`** | **教會神父** (Church Priest — White-Turbaned Cleric) | `GLOBAL_2_9821[0] = 131` | `+1398` | `0` frames / Empty `(3,3,3)` |
| **`#132`** | **秘密商人** (Secret Shop Merchant — Horned Imp) | `GLOBAL_2_9821[1] = 132` | `+3644` | `0` frames / Empty `(3,3,3)` |

*(Note: Summon spells `#32..#35` are rendered from `FDOTHER[65..68]`, never `DATO[128..132]`.)*

#### F. Defenseless Battlefield NPCs (`#133 .. #135`) — **On Battlefield, Target-Only, NEVER Attack** (`appearsOnBattlefield = true, canAttack = false`)

| ID | Name (`sys[uid+1]`) | Battlefield Chapter(s) | Inventory & AI | `FDICON` | `FIGANI` Slots |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **`#133`** | **女村民** (Female Villager) | **Ch 2** (`align=1` Ally) | `128 布衣` (no weapon), AI `4` (flee to `(19,6)/(15,0)`) | `12` frames | **`idle` (4 frames)**; `attack` & `ranged` empty! |
| **`#134`** | **男村民** (Male Villager) | **Ch 2** (`align=1` Ally) | `128 布衣` (no weapon), AI `4` (flee to `(19,6)/(16,0)/(15,0)`) | `12` frames | **`idle` (4 frames)**; `attack` & `ranged` empty! |
| **`#135`** | **卡納恩三世** (King Canaan III)| **Ch 10** (`align=1` Ally) | `187 王袍` (no weapon), AI `8` (passive) | `12` frames | **`idle` (4 frames)**; `attack` & `ranged` empty! |

#### G. System Map Cursors (`FDICON.B24` Rows `#136 .. #139`)
- Rows `136..139` exist **only** in `FDICON.B24` (`4 × 12` `24×24` UI tile cursors, target reticles, and range markers) and are not character IDs.


---

## 6. Game Flow, 4-Way Cross Menu, Choreography VM & Chapter-by-Chapter Scenario Anatomy

### 6.1 Complete Campaign State Machine, Starting Setup (`0 G`) & Branching Endings

1. **Title Screen (`fn_63636`)**:
   - Plays `ANI.DAT[0]` opening animation -> displays `TITLE.DAT[0]` over `FDOTHER[7][0]` animated sword fire + `FDOTHER[8]` palette, with 3 menu plates (`TITLE.DAT[1..6]`):
     - **`新的傳奇` (New Legend)**: Plays `ANI.DAT[1]` intro -> sets `chapterId = 0`, `gold = 0`, `party = []` -> invokes `fn_140059()` (**Prologue `Map 32` -> `Map 31` -> `Chapter 1` Beach**).
     - **`再續前緣` (Continue / Load Save)**: Loads Battlefield Save (`FD2.SAV` slot 0) or Camp Save (`slots 1..4`).
     - **`戰場回憶` / `角色與圖像驗證` (Chapter Replay / Asset Verification)**: Jump into any chapter `1..30` with canonical cumulative party roster & equipment.
2. **Exact New Game Starting Setup & Sub-Map Cutscene Architecture (`fn_140059`, `L140059..L141345`)**:
   - **`13 × 8` (`312 × 192` px) Viewport Isolation (`fn_7340` & `fn_13789(topLeftX, topLeftY)`)**:
     - `FD2.EXE` renders exactly `13` columns × `8` rows (`312 × 192` px centered at `(4, 4)` inside `320 × 200` Mode 13h), anchored by `(GLOBAL_2_15017, GLOBAL_2_15021) = (camTopLeftX, camTopLeftY)`.
     - Cutscene maps pack **multiple separate locations or off-screen staging actors** into a single `FDFIELD` map, relying strictly on the `13 × 8` viewport clip so adjacent scenes never bleed into view!
     - During directing (`GLOBAL_2_6787 = 0`), the tile cursor reticle (`FDICON[136..139]`) and status overlays are completely hidden.
   - **Camera-Scrolling Walk (`fn_12677(slotId)`, `L12677..L12915`)**:
     - Steps `slots[slotId]` 1 tile (`6 × 4 px` sub-frames); whenever `unit.y - camTopLeftY < 2` while walking north (`dir = 2`), scrolls `camTopLeftY` UP by `1` tile (`6 × 4 px`) in exact lockstep with the unit's walk!
   - **Dialogue Active-Speaker Auto-Scroll (`fn_24452 -> fn_26028 -> fn_11498`, `L24958..L26078`)**:
     - Whenever `FDTXT` emits a speaker header (`0xFFEF / 0xFFEE` = `uid` lookup via `fn_11360`, or `0xFFED / 0xFFEC` = direct runtime `slots[slot]` lookup), `fn_26028` calls **`fn_11498(unit.x, unit.y)`**, smoothly scrolling `(camTopLeftX, camTopLeftY)` via `fn_6984..7257` until the active speaker sits inside the inner **`[camTopLeftX + 2 .. camTopLeftX + 10] × [camTopLeftY + 2 .. camTopLeftY + 5]`** zone before opening their dialogue box!
   - **Gradual Walk Fade-Out (`GLOBAL_2_15099 = 1` in `fn_13930`, `L14520..L14575`)**:
     - Setting `GLOBAL_2_15099 = 1` before `fn_13930(choreoId)` increments `GLOBAL_2_15099` (`1..63`) on every walking sub-frame (`6` per tile) and calls `fn_7488(0, 255, fade)`, smoothly fading the screen to black while characters walk off (`Choreo 100`, `Choreo 105`, `Choreo 98`, `Choreo 34`), followed by `fn_62757()` to fade back in on the next scene!
   - **Prologue Part 1 (`Map 32`, `18 × 51`, `FDTXT[33]`) — Packs TWO Sub-Maps**:
     - **Scene 1A: Royal Palace Throne Hall (`y = 0..42`)**:
       - Spawned at `wave 0`: `slot 0 = #48 渥特王` at `(7, 5)` (left red throne), `slot 1 = #66 王后` at `(10, 5)` (right red throne), `slot 2 = #0 索爾` at `(8, 42)`.
       - `fn_13789(3, 34)` frames `x: 3..15, y: 34..41` (pure Palace; Woods `y = 43..50` completely outside the `13 × 8` viewport!).
       - `Choreo 99`: `slot 2` walks 6 tiles north `(8, 42) -> (8, 36)`.
       - **`15 × fn_12677(2)`**: `slot 2` walks 15 tiles north `(8, 36) -> (8, 21)`, smoothly scrolling `camTopLeftY` UP `34 -> 20`!
       - `dlg[0]`: Sol calls out at `(8, 21)`, then `#48 渥特王` (`-19, slot=0` at `(7, 5)`) and `#66 王后` (`-19, slot=1` at `(10, 5)`) speak — `fn_11498` smoothly scrolls `camTopLeftY` UP to **`3` (`x: 3..15, y: 3..10`)**, revealing **King Walt and the Queen** on their twin thrones!
       - **`13 × fn_12677(2)`**: `slot 2` walks 13 tiles north `(8, 21) -> (8, 8)` right up to the thrones!
       - `dlg[1]`: With `camTopLeft = (3, 3)` (`y: 3..10`), **King Walt `(7, 5)`, the Queen `(10, 5)`, AND Sol `(8, 8)`** are all simultaneously inside `[5..8]` on screen together!
       - `GLOBAL_2_15099 = 1` + `Choreo 100`: `slot 2` walks 10 tiles south `(8, 8) -> (8, 18)` while fading to black!
     - **Scene 1B: Palace Outskirts Woods (`x: 0..12, y: 43..50`)**:
       - While black, snaps `camTopLeft = (0, 43)` (exact `13 × 8` Woods clearing `x: 0..12, y: 43..50`; Palace `y = 0..42` completely clipped!), switches BGM (`fn_88439(11, 0)`), and fades in (`fn_62757`)!
       - `slot 3 = #0 索爾` stands at `(4, 46)`; `slot 4 = #4 亞雷斯` starts 1 tile off-screen at `(13, 47)` and walks in via `Choreo 101` (`(13, 47) -> (10, 47)`), followed by `dlg[2..5]` + `Choreo 102..104` (including Ares's startled `-17px` hop `Choreo 103`), then `GLOBAL_2_15099 = 1` + `Choreo 105` fades to black as both walk east!
   - **Prologue Part 2 (`Map 31`, `20 × 50`, `FDTXT[32]`) — Forest Road Departure (`序幕(二)・森林啟程`)**:
     - Fades in at `camTopLeft = (5, 42)` (`x: 5..17, y: 42..49`; off-screen staging tiles `(19, 46)`, `(19, 47)`, `(0, 0)` cleanly outside the `13 × 8` frame!).
     - Spawns Wave `1` (`#0 索爾` at `(5, 46)`, `#4 亞雷斯` at `(5, 47)`), plays `Choreo 90..92` + `FDTXT[32][0..2]`, spawns Wave `3` (`#75 米蘭` at `(19, 46)`, `#30 蓋亞` at `(19, 47)`), pans to `(4, 41)` (`fn_13789(4, 41)`), plays `FDTXT[32][3]` + `Choreo 93` + `FDTXT[32][4]`, hides `#75 米蘭` (`slot 2`), spawns Wave `5` (`#9 悠妮`) + `Choreo 94..97` + `FDTXT[32][5..9]`, then `GLOBAL_2_15099 = 1` + `Choreo 98` fades to black as the 4 heroes walk east!
   - **Initial Party Recruitment (`L142290..142325`)**: Recruits **strictly 4 heroes** in order:
     1. **`#0 索爾`** (Lv 1 `戰士`, `0 短劍`, `128 布衣`, `189 藥草`)
     2. **`#9 悠妮`** (Lv 1 `僧侶`, `80 木杖`, `128 布衣`, Spell `19 醫療術`)
     3. **`#4 亞雷斯`** (Lv 1 `騎士`, `22 長矛`, `129 皮甲`, `189 藥草`)
     4. **`#30 蓋亞`** (Lv 1 `機甲神兵`, `64 鐵拳`, `155 鋼鐵裝甲`)
     *(Note: `#1 哈諾` is **NOT** in the starting party — he joins on **Chapter 1 Turn 3** via `EV 0`!)*
   - **Initial Gold (`L142590`)**: Explicitly set to **`0 G`** (`M4[GLOBAL_2_15347] = 0`) at the end of `fn_140059`!
   - **Chapter 1 (`m = 0`) Opening Directing**: Loads `Map 0` (`playerSlots = [(7,20), (10,21), (8,22), (11,23)]`, **zero** enemies at `wave_group == 0`!), walks the 4 shipwrecked heroes 6 tiles north (`Choreo 0`: `y = 20..23 -> 14..17`), speaks `FDTXT[1][0]`, pans to `(0,0)` and teleports **Wave 1** (`slots 4..7` brigands) with `FDOTHER[9]` sparkles (`Choreo 1`), pans to `(0,15)` and teleports **Wave 2** (`slots 8..11` brigands + thief) (`Choreo 2`, `FDTXT[1][1]`), then `#96 盜賊` (`slot 9`) flees 4 tiles south (`Choreo 5`) and vanishes (`hide_slot(9)`), speaks `FDTXT[1][2]`, focuses `#0 索爾`, and begins Turn 1!
3. **Intermission Town vs Camp-Only Progression (`GLOBAL_2_9913`)**:
   - Between chapters, `GLOBAL_2_9913[next_ch_1based]` controls intermission type:
     - **`0` (Full Town Intermission — Chapters `2..21`, `25`, `26`)**: Full town hub with **武器店** (`#128`), **道具店** (`#130`), **酒店** (`#129`), **教會** (`#131`, Save / Promote Lv 20+ / Revive), **秘密商店** (`#132`, password-unlocked), and **米蘭總部** (`#75` Party/Equip/Departure).
     - **`1` (Camp-Only Field Intermission — Chapters `22, 23, 24, 27, 28, 29, 30`)**: No shops or church; field camp (`FDOTHER[11]`) for Item Transfer/Equip, Save/Load, Roster inspection, and Marching directly into the next battle.
4. **The Sky Key (`100 天空之鑰`), `#31 渥德` Awakening (`208 控制中樞`) & Branching Endings (`Ch 26 -> Ch 27` vs `Ch 28..30 -> Map 30`)**:
   - **Collecting the 6 Sacred Artifacts (`iid = 209..214`: `#209 黃金徽章`, `#210 星之眼`, `#211 光之眼`, `#212 暗之眼`, `#213 冰之眼`, `#214 火之眼`)** across Chapters `10..20` triggers the **6-Crystal Beam (`fn_82742`, `FDOTHER[34]`)** in **Chapter 21 Post-Battle**, consuming all 6 artifacts and awarding **`Item 100 天空之鑰`** alongside **`#24 希爾法`** and **`#23 羅蘭`** (if fewer than 6 are held, `#24 希爾法` and `#23 羅蘭` still join via `dlg[6]` without the Sky Key).
   - **Awakening `#31 渥德` in Chapter 26 (`m = 25`)**: Carrying **`Item 208 控制中樞`** (found in **Ch 17 `chestIndex = 1` at `(0, 1)`**) onto tile **`(1, 46)`** in Chapter 26 triggers **`EV 61` (`FDOTHER[45]` 59-frame core animation)**, spawns Wave 1, and recruits **`#31 渥德`**!
   - **Chapter 27 (`m = 26`, Golden Castle Control Core)**:
     - **Without `Item 100 天空之鑰` (Normal / Tragic Ending)**: In `fn_86220` (Ch 27 Post-Battle), `#9 悠妮` stays behind to halt the fortress (`dlg[13..16]`, `Choreo 84, 82`), and the game proceeds directly to **`ENDING_SEQUENCE()`** (`Game Complete — Normal Ending`).
     - **With `Item 100 天空之鑰` (True Route — Chapters `28 -> 29 -> 30 -> Map 30`)**: Having `Item 100 天空之鑰` in the party triggers the core resonance sequence (`dlg[9..12]`, `Choreo 83, 84`) and unlocks the True Final Chapters (`Ch 28, 29, 30`). Defeating **`#126 空魔神`** in **Chapter 30** runs `fn_87895`, transitioning to **`Map 30` (`終章・王城凱旋`)** with surviving heroes in formation (`Choreo 89`, `FDTXT[31][0..1]`) before **`ENDING_SEQUENCE()` (`True Ending`)**!

---

### 6.2 Authentic 4-Way Cross Menu (`十字選單`) & Tactical Micro-HUD Specification

`FDOTHER[2]` contains `78` `24×20` sprites (`26` icons × `3` frames: `frame 0` = normal, `frame 1` = active/toggle-alt, `frame 2` = disabled red background). When opened (`fn_29724`), the 4 arms `[Top, Left, Right, Bottom]` animate outward over **4 expansion steps** (`6px` per step -> final offsets `Top: (0, -20)`, `Left: (-24, 0)`, `Right: (+24, 0)`, `Bottom: (0, +20)` around the `24×24` center tile):

| Cross Menu Mode | `Obj 2` Table | `[Top, Left, Right, Bottom]` Icon IDs | Exact Commands & Sub-Menus |
| :--- | :--- | :--- | :--- |
| **Unit Action Cross** | `GLOBAL_2_7893` | `[0, 1, 2, 3]` | • **Top (`0` 攻擊)**: Physical weapon target reticle (`disabled` if unarmed, NPC, or no enemy in weapon `[minRange..maxRange]`)<br>• **Left (`1` 法術)**: Spell book selector (`disabled` if unit knows 0 spells or is silenced `unit+39 > 0`)<br>• **Right (`2` 道具)**: Opens **Item Sub-Cross**<br>• **Bottom (`3` 休息 / 寶箱)**: Ends unit action; if standing on unopened chest/hidden ground item (`(flags & 2) != 0` and 0-based `evid 0..15`), prompts to open/pick up (`fn_37036`)! |
| **Item Sub-Cross** | `GLOBAL_2_7941` | `[8, 9, 10, 11]` | • **Top (`8` 使用)**: Use consumable/special item (`藥草`, `時空之輪`, stat potions)<br>• **Left (`9` 交換)**: Give/trade item with adjacent ally (`dist == 1`)<br>• **Right (`10` 裝備)**: Change equipped Weapon / Armor in `8`-slot bag<br>• **Bottom (`11` 丟棄)**: Discard item from inventory |
| **Empty-Tile Cross** | `GLOBAL_2_7839` | `[7, 5, 6, 4]` | • **Top (`7` 戰況)**: Opens **System / Info Cross (`[12, 13, 14, 15]`)** & **Battle Situation Scroll (`FDOTHER[5][20, 21]`)**<br>• **Left (`5` 委任)**: `#0 索爾` Yes/No confirmation (`[16, 17]`) to delegate remaining unmoved allies to Auto-AI for this turn<br>• **Right (`6` 系統)**: Opens **Settings Toggle Cross (`[18/19, 20/21, 22/23, 24/25]`)**<br>• **Bottom (`4` 回合結束)**: `#75 米蘭` Yes/No confirmation (`[16, 17]`) -> heals all unacted player units by **`+20% Max HP`** with `FDOTHER[9]` sparkles and starts Ally/Enemy phase! |
| **System / Save Cross**| `GLOBAL_2_7925` | `[12, 13, 14, 15]` | • **Top (`12` 戰況一覽)**: Parchment scroll (`Chapter`, `Turn`, `Gold`, `Win/Lose`, `Roster`)<br>• **Left (`13` 戰場存檔)**: Save mid-battle state<br>• **Right (`14` 戰場讀檔)**: Load mid-battle state<br>• **Bottom (`15` 離開戰場)**: Return to Title Screen |
| **Settings Cross** | `GLOBAL_2_7855` | `[18, 20, 22, 24]` | • **Top (`18/19`)**: Music ON/OFF<br>• **Left (`20/21`)**: SFX ON/OFF<br>• **Right (`22/23`)**: Cutaway Combat Animation ON / Fast Map-Only Combat OFF<br>• **Bottom (`24/25`)**: Status Bar / Grid Overlay ON/OFF |

---

### 6.3 Directing (`演出`) & Unit Choreography VM (`Obj 3 + 10,200`, `106` Scripts)

At `Obj 3 + 10,200` (`FD2.EXE` file offset `353,752`), `FD2.EXE` stores `106 × uint32` script pointers (`choreo_id = 0..105`, spanning `Obj 3[10624..13522]`). `fn_13930(choreo_id)` executes `cmd_count = obj3[ptr]` sequential multi-actor commands:
- Each command reads `step_byte`, `n_actors`, and `n_actors × (slot_id, dir_or_pose)` where `dir` is:
  - **`0` = Down (`+y`)**, **`1` = Left (`-x`)**, **`2` = Up (`-y`)**, **`3` = Right (`+x`)**.
- **Mode A — Simultaneous Multi-Unit Tile Walk (`(step_byte & 0x80) == 0`)**:
  - `steps = step_byte & 0x7F` (`1..127` tiles).
  - Repeats `steps` times: sets `slots[slot_id].dir = dir` for all listed actors and smoothly interpolates their pixel positions by `6 × 4px = 24px` (`1` tile) simultaneously while cycling their 3-frame `FDICON` walk animation, then commits `(x + dx, y + dy)`.
- **Mode B — Excited/Startled Jump-Hop (`step_byte == 0x80`, i.e., `flag = 1, val = 0`)**:
  - Sets `slots[slot_id].dir = dir` and hops all listed actors vertically by **`-17 px`** (`5,472 / 320` scanlines) for 1 beat before landing back on their tile (used e.g. in `Choreo 7` `#1 哈諾`, `Choreo 11` Ch 2 villager, `Choreo 15` Ch 2 party cheer).
- **Mode C — Synchronized Facing & Beat Pause (`(step_byte & 0x80) != 0` and `(step_byte & 0x7F) > 0`)**:
  - `ticks = step_byte & 0x7F`. Sets `slots[slot_id].dir = dir` on all listed actors and holds for `ticks` animation ticks (used for looking left/right in surprise before speaking!).

---

### 6.4 Runtime Battlefield Slot Indexing (`slots[0..95]`), Wave Spawning & Post-Battle Formations

- **Slot Allocation (`fn_2189`, `fn_2894`, `fn_3152`)**:
  1. On chapter load (`fn_2189(m)`), `slots[0 .. max_deploy - 1]` are populated from `party[0..]` at `playerSlots[0 .. max_deploy - 1]`, setting `numUnits = max_deploy`.
     - **Slot 6 Reservation Rule (`L2785..2805`)**: When `m < 13` (`Ch 1..13`) and `slot == 6`, if the next party hero is **not** `uid == 2` (`#2 鐵諾`), `slot 6` is left as a reserved dead placeholder (`status |= 1`) so subsequent waves land at exact deterministic `slots[max_deploy..]` indices expected by `Choreo` scripts!
  2. Immediately at end of `fn_2189`, `spawnWave(0)` iterates `urec[0 .. active_enemy_count - 1]` in order; every record with `wave_group == 0` is appended at `slots[numUnits++]`.
  3. Whenever a Pre-Battle, Mid-Battle, or Post-Battle script calls `spawnWave(w)` (`fn_2894(w)`) or `sparkleWave(w)` (`fn_141721(w)`):
     - Iterates `urec[0 .. active_enemy_count - 1]` where `wave_group == w`, appending each unit to `slots[numUnits++]`!
     - If `forcedExact == false` (mid-battle reinforcement), if target `(sx, sy)` is occupied or impassable, `fn_3152` searches the entire map for the **nearest passable unoccupied tile by Manhattan distance** (`|x - sx| + |y - sy|`).
     - `sparkleWave(w)` additionally plays the 12-frame `FDOTHER[9]` teleportation sparkle animation centered over each newly spawned unit.
- **Hero Recruitment & Level Sync (`fn_4773`, `fn_3152`, `fn_5382`)**:
  - `fn_4773(heroId)` (`L4773..5209`) initializes a newly recruited party entry strictly from `HERO_BASE[heroId]` (`level = rec[2]`, e.g., **`Lv 1`** for `#0 索爾, #9 悠妮, #4 亞雷斯, #30 蓋亞`) and **never** reads dummy cutscene actor levels (such as `Map 31`'s `lv = 2` actors) or `ally`/`enemy` NPC slots!
  - `fn_3152` (`L3624..3770`) spawns map `urec` hero records (`uid < 68`) using **`lv = urec[4]`** directly (`maxHp = rec_hp + (lv - 1) * gr.hp[0]`, `baseAp = rec_ap + lv * gr.ap[0]`, etc.) — so in Chapter 1 Turn 3 (`EV 0`), `#1 哈諾` (`wave 3`) enters at **`Lv 1`** and temporary guest `#3 哈瓦特` (`wave 7`) enters at **`Lv 3`** (not his Chapter 13 `HERO_BASE` `Lv 23`).
  - `fn_5382()` (`L5382..5505`) syncs surviving `slots` back into `party` **only** for `uid`s already present in `party`: when a hero fought as `faction == player` (`align = 2`), `FD2.EXE` calls `fn_4773` *before* `fn_5382` so their `urec` level + earned EXP overwrite `party`; when a hero was an `ally`/`enemy` NPC, `fn_5382` runs *before* `fn_4773` so they join cleanly at `HERO_BASE[heroId]`. Temporary unrecruited guests (`#3 哈瓦特` in Ch 1) are never added to `party`.
- **Post-Battle Formation Helper (`fn_78790`)**:
  - Revives/gathers surviving party slots `startSlot .. endSlot` (`0..max_deploy-1`), places each `slot` at `(xArr[slot], yArr[slot])` with facing `dirMode` (either uniform `0..3` or per-slot `dirArr[slot]`), optionally places a guest/boss slot `extraSlot` at `(extraX, extraY, extraDir)`, snaps camera to `(camX, camY)`, and fades in for the post-battle cutscene!

---

### 6.5 Complete Scenario-by-Scenario & Chapter-by-Chapter Anatomy (`Maps 32, 31` + `Ch 1..30` + `Map 30`)

| Chapter / Map | Map `m` | `maxDeploy` | Opening Directing (`PRE`) | Special Mid-Battle Events (`EV`) & Triggers | Victory / Defeat Overrides (`VIC`) | Post-Battle Directing & Recruits (`POST`) |
| :--- | :---: | :---: | :--- | :--- | :--- | :--- |
| **Prologue 1** (`王城啟程` + `郊外樹林`) | `32` | `0` | **Sub-Map 1A (`y=0..42` Palace, `cam=(3,34)->(3,3)`)**: `Choreo 99`, `15×fn_12677(2)`, `dlg[0]` (auto-scrolls to `#48 渥特王` `(7,5)` & `#66 王后` `(10,5)`), `13×fn_12677(2)`, `dlg[1]`, `Choreo 100` (walk fade-out) -> **Sub-Map 1B (`y=43..50` Woods, `cam=(0,43)`)**: `Choreo 101..104`, `dlg[2..5]`, `Choreo 105` (walk fade-out) | *(Cutscene Map)* | — | Transitions into `Map 31` |
| **Prologue 2** (`森林啟程`) | `31` | `0` | Forest road `cam=(5,42)->(4,41)`, Waves `1, 3, 5` + `Choreo 90..98` (`98` walk fade-out), `FDTXT[32][0..9]`; recruits **`#0 索爾, #9 悠妮, #4 亞雷斯, #30 蓋亞`**; sets `Gold = 0` | *(Cutscene Map)* | — | Transitions into `Ch 1 (Map 0)` |
| **Ch 1** `孤島` | `0` | `4` | Beach walk (`Choreo 0`), `txt[0]`, `sparkleWave(1)` (`Choreo 1`), `sparkleWave(2)` (`Choreo 2`, `txt[1]`), thief flees (`Choreo 5`, `hideSlot(9)`), `txt[2]` | • **Turn 3 (`EV 0`)**: Recruits **`#1 哈諾`** + `spawnWave(3)` (`Choreo 7`, `txt[11]`) + `spawnWave(7)` (`Choreo 8`, `txt[3]`)<br>• **Turn 5 (`EV 1`)**: `sparkleWave(4)` (`Choreo 3`, `txt[4]`)<br>• **Turn 6 (`EV 2`)**: `sparkleWave(5)` (`Choreo 4`)<br>• **Turn 8 (`EV 3`)**: `spawnWave(6)` (`Choreo 6`)<br>• **Defeat Boss (`EV 4`)**: `txt[7]` | Rout all enemies (`#0 索爾` death = defeat) | `txt[9]` -> Town 1 |
| **Ch 2** `羅德鎮` | `1` | `5` | Gate entry (`Choreo 9, 10`, `txt[0,1]`), villager `spawnWave(1)` (`Choreo 11`, `txt[2]`), brigands `spawnWave(2)` (`Choreo 12`) | • **Villager AI `4`**: `#133/#134` (`slots 5..10`) flee east/north to `(19,6)`, `(16,0)`, `(15,0)` away from bandits<br>• **Turn 4 (`EV 6`)**: `spawnWave(3)` (`Choreo 13`, `txt[4]`) | Defeat all enemies; **fail if all 6 villagers die** (`fn_67269`) | **If 0 villagers died**: `txt[6]` + **`#198 力量藥水`**; **else (`>= 1` died)**: `txt[7]` (no item); then `spawnWave(4)` `#8 希莉亞` (`Choreo 14..16`, `txt[8..10]`), recruits **`#8 希莉亞`** |
| **Ch 3** `森林小徑` | `2` | `5` | `txt[0]`, `Choreo 18`, `spawnWave(1)` (`#2 鐵諾` ally `slot 6`), `Choreo 17, 19`, `txt[1, 2]` | • **Turn 4 (`EV 9`)**: `spawnWave(2)`, `txt[4]` | Rout all enemies | **If `slot 6` (`#2 鐵諾`) survived**: Formation + `txt[7]` + recruits **`#2 鐵諾`**; **if died**: `txt[6]` only (`#2 鐵諾` lost!) |
| **Ch 4** `塞拉村` | `3` | `7` | `Choreo 20`, `txt[0]`, `spawnWave(1)` | • **Turn 5 (`EV 11`)**: `spawnWave(2)`<br>• **Step/Boss (`EV 12, 13`)**: Bridge/gate tile swap + `txt[3, 6]` | Rout all enemies | `txt[4]` |
| **Ch 5** `古代遺跡` | `4` | `7` | `txt[0]`, `spawnWave(1)` (`#10 瑪琳` `slot 8`), `Choreo 22`, `txt[1]`, `Choreo 21`, `txt[2]` | • **Turn/Step (`EV 14..19`)**: Ruins wall traps, `spawnWave(2, 3)` (`Choreo 23, 24`), `txt[6, 8, 11]` | Rout all enemies | Formation (`[8, 12]`) + `txt[9]`, recruits **`#10 瑪琳`** |
| **Ch 6** `精靈森林` | `5` | `8` | Standard deploy (`#13 貝克威` rescue) | • **Turn/Step (`EV 21, 22`)**: `spawnWave(1)`<br>• **Drop `slot 8` (`EV 23`)**: Wakes AI, `txt[4]`; **if `turn < 15`**: `spawnWave(2)`, `Choreo 25 -> txt[5] -> Choreo 26`, `hideSlot(33)` (`#118 萊汀` retreats!) | Rout all enemies | Recruits **`#13 貝克威`**, `spawnWave(3)`, pan `(5,14)`, `Choreo 27 -> txt[6]` |
| **Ch 7** `獸人峽谷` | `6` | `9` | `txt[0]`, `spawnWave(1)`, `Choreo 28, 29`, `txt[1]` | • **Step `(9,13)..(14,15)` (`EV 26`)**: Wakes AI & sets `flag[16]=1`<br>• **Turn 10 (`EV 25`)**: **iff `flag[16]==1`**, `spawnWave(2)` (`slot 43` `#12 凱麗`), `Choreo 30 -> txt[2]`, sets `flag[17]=1` | Rout all enemies | **If `flag[17]==1` and `slot 43` (`#12 凱麗`) survived**: Formation (`[7, 12]`) + `txt[4]` + recruits **`#12 凱麗`**; **else**: `txt[5]` (`#12` does NOT join!) |
| **Ch 8** `渡河作戰` | `7` | `10`| `Choreo 31`, `txt[0]`, `Choreo 32` | • **Turn (`EV 27`)**: `spawnWave(turn)` river reinforcements | Rout all enemies | Formation (`[16, 14]`) + `txt[3]`, `Choreo 33`, `txt[4]`, `Choreo 34` (fadeOut), recruits **`#5 洛娜`**! |
| **Ch 9** `沙漠追擊` | `8` | `10`| `txt[0]`, `Choreo 35`, `txt[1]` | • **Step (`EV 28, 29`)**: Wakes enemy squads & sets `flag[16/17]`<br>• **Defeat `#118 萊汀` (`slot 30`, `EV 30`)**: Non-lethal defeat (`hp = 1`, `0 EXP` on final blow) -> `txt[2]`, defects in-place at `(x,y)` to **`1 HP` Ally `#6 萊汀`** (`slot 46`), `txt[3]`! | Rout all enemies | `spawnWave(4)`, `Choreo 36`, `txt[4]` |
| **Ch 10** `王城救出` | `9` | `10`| Camera pan `(10, 0)` (`#135 卡納恩三世`, `#11 索菲亞`, `#6 萊汀`) | • **Prison Switch (`EV 31`)**: Opens cell gates, wakes `#11/#6/#135`, `txt[2]`, `spawnWave(1)`, `txt[3]` | Defeat if `#135 卡納恩三世` (`slot 11`) dies (`txt[1]`) | `txt[4]`, `Choreo 37`, `txt[5]`, recruits **`#11 索菲亞`** (carries **`#209 黃金徽章`**!) & **`#6 萊汀`** |
| **Ch 11** `迷霧森林` | `10`| `12`| `txt[0]`, `spawnWave(1)` (`#14 珊`), `Choreo 38`, `txt[1]` | • **Wave spawns (`EV 32..34`)**: `spawnWave`, `txt[2]`, AI wake<br>• **Chest `0` `(18,37)`**: **`#210 星之眼`**! | Rout all enemies | `txt[3]`, recruits **`#14 珊`** |
| **Ch 12** `雙子要塞` | `11`| `13`| `spawnWave(1)` (`slot 13` `#17 米亞斯多德`), `Choreo 40, 41` | • **Reinforcements (`EV 35..37`)**: `spawnWave(2, 3, 4)` (`Choreo 42..44`), `txt[1]` | Defeat if `#17 米亞斯多德` (`slot 13`) dies (`txt[2]`) | Formation + `txt[3]`, `Choreo 45`, `txt[4]`, recruits **`#17 米亞斯多德`** |
| **Ch 13** `哈斯米爾之戰` | `12`| `14`| Standard deploy (`slot 14` `#3 哈瓦特` ally) | • **Turn 4/9 (`EV 5, 7`)**: Reinforcements<br>• **Sol Step `(24,5)` (`EV 8`)**: `#0 索爾` steps on `(24,5)` -> **`#89 勇者徽章`** + `txt[11]`!<br>• **Chest `8` `(38,18)`**: **`#214 火之眼`**! | Defeat if `#3 哈瓦特` (`slot 14`) dies (`txt[10]`); victory when active non-`#121` enemies die | `txt[9]`, recruits **`#3 哈瓦特`** |
| **Ch 14** `熔岩洞窟` | `13`| `15`| Camera pan `(20, 20)`, `txt[0]` | • **Step (`EV 10`)**: Wakes inner guards + `txt[1]` | Rout all enemies | `spawnWave(1)`, Formation + `txt[2]`, `Choreo 47`, `txt[3]` |
| **Ch 15** `拉卡湖的激戰` | `14`| `15`| `txt[partyHas(#12) ? 2 : 5]`, `Choreo 48` | • **Turn 7 (`EV 38`)**: `spawnWave(1)` (`slot 74` `#102 獸人`)<br>• **Drop `slot 74` (`EV 39`)**: Awards **`#211 光之眼`** + `txt[11]`! | Defeat if `#15 塞可邦勒` (`slot 15`) dies (`txt[7]`) | `txt[partyHas(#12) ? 12 : 13]`, recruits **`#15 塞可邦勒`** |
| **Ch 16** `冰原之戰` | `15`| `15`| `txt[0]` (`#18 蜜蒂` `slot 15` + 8 NPC guards `slots 66..73`) | • Standard combat & 6 chests | Defeat if `#18 蜜蒂` (`slot 15`) dies (`txt[1]`) | **Triple Check (`deadGuards <= 4` AND `turn <= 18` AND `#0 索爾 maxHp >= 320`)**: Pass -> `txt[4]` + recruits **`#18 蜜蒂`**; Fail -> `txt[2] -> Choreo 49 -> txt[3]` (`#18` leaves!) |
| **Ch 17** `血與冰之刃` | `16`| `15`| If `!partyHas(#18)`: `spawnWave(1)` (`slot 52` `#18` guest); `txt[0]` | • **Turn 4 (`EV 40`)**: `spawnWave(2)`<br>• **Drop `#123 水魔神` (`EV 41`)**: `txt[3]` + **`#213 冰之眼`** + `txt[4]`!<br>• **Chest `1` `(0,1)`**: **`#208 控制中樞`**! | Defeat if guest `#18 蜜蒂` (`slot 52`) dies (`txt[2]`) | Branches on `partyHas(#18)` (`txt[5]`/`Choreo 52` vs `txt[7]`/`Choreo 50..51`), then `txt[6] -> Choreo 53 -> txt[8]`, recruits **`#16 凱拉斯`** |
| **Ch 18** `遙遠的彼岸` | `17`| `16`| `txt[0]`, `Choreo 54`, `txt[1]` | • **Turn 3/8 (`EV 43, 42`)**: Reinforcements (`#21 約拿` `slot 16`, `#7 蘭斯洛特` `slot 17`) | Defeat if `#21 約拿` (`txt[3]`) or `#7 蘭斯洛特` (`txt[4]`) dies | Formation (`[8, 25]`) + `Choreo 56..58`, `txt[7..10]`, recruits **`#21 約拿`** & **`#7 蘭斯洛特`** |
| **Ch 19** `雷龍的試煉` | `18`| `16`| `txt[0]` | • **Turn 6 (`EV 46`)**: `spawnWave(1)` (`slot 64` `#27 巴拿羅西亞`), `txt[1]`, recruits **`#27 巴拿羅西亞`**! | Defeat if `turn > 6` and `slot 64` died; victory on rout | `txt[3]` |
| **Ch 20** `死亡般的沈寂` | `19`| `16`| `txt[0]` (`#25 謝多` `slot 52` + 8 Elves `slots 53..60`) | • **Chest `7` `(30,7)` (Hidden Ground `0x40`)**: **`#212 暗之眼`**! | Defeat (`txt[10]`) if `#25 謝多` dies OR all 8 Elves die; victory when non-`#121` enemies die | `txt[11] -> Choreo 59 -> txt[12]`, recruits **`#25 謝多`**; **if `turn <= 15`**: `spawnWave(1)` (`#28`), `Choreo 60..62`, `txt[14..16]`, recruits **`#28 達克塞`**; then `txt[13]` |
| **Ch 21** `亞述森林` | `20`| `16`| `txt[0]` (`#24 希爾法` `slot 16`, `#23 羅蘭` `slot 17`) | • **Turns 2/3/4/6/8 (`EV 47, 48`)**: Forest waves | Defeat if `#24 希爾法` (`txt[3]`) or `#23 羅蘭` (`txt[4]`) dies | Formation (`[14, 23]`) + `txt[5]`; **if party holds all 6 Artifacts (`209..214`)**: consumes all 6, grants **`#100 天空之鑰`**, `txt[7] -> Choreo 63 -> txt[8] -> Choreo 64 -> FDOTHER[34] Beam -> txt[10]`; else `txt[6]`. Recruits **`#24 希爾法`** & **`#23 羅蘭`**! *(Next: Camp-Only)* |
| **Ch 22** `遠古的呼喚` *(Camp)* | `21`| `15`| Camera pan `(16, 28)`, `txt[0]` | • **Turn 5 (`EV 50`)**: `spawnWave(2)` (`slot 72` `#20 莎拉`), recruits **`#20 莎拉`**, `txt[2]`!<br>• **Drop `#124 風魔神` (`EV 51`)**: Grants **`#101 傳送法杖`** + `txt[3]`! | Defeat if `turn >= 5` and `#20 莎拉` (`slot 72`) dies | Formation (`[25, 22]`) + `Choreo 65, 66`, `txt[4..6]`, **`FDOTHER[3]` Lightning Strike**! *(Next: Camp-Only)* |
| **Ch 23** `魔神殿前門` *(Camp)* | `22`| `16`| Lightning arrival (`FDOTHER[3]`), `txt[0]`, `Choreo 68..70`, `txt[1..3]`, `spawnWave(1)`, `txt[4]` (`#22 卡里斯` `slot 16`, `#19 羅德曼` `slot 17`) | • **Turn/Gate (`EV 52..54`)**: Reinforcements & seal unlock | Defeat if `#22 卡里斯` (`txt[6]`) or `#19 羅德曼` (`txt[7]`) dies | Formation (`[21, 21]`):<br>• **`#22 卡里斯`**: if `partyHasItem(100)` -> `txt[8]` + recruits **`#22 卡里斯`**; else `txt[9] -> Choreo 71`<br>• **`#19 羅德曼`**: if `partyHas(#18)` -> `txt[10] -> Choreo 72 -> txt[11]`; else if `turn >= 15` -> `txt[12] -> Choreo 72`; else (`!#18 && turn < 15`) -> `txt[13]` + recruits **`#19 羅德曼`**!<br>• `txt[14..17]` + Earthquakes + `Choreo 73` *(Next: Camp-Only)* |
| **Ch 24** `崩壞的迴廊` *(Camp)* | `23`| `16`| `txt[0]`, `spawnWave(2, 4, 7, 10)`, 4-corner camera tour | • Reinforcements (`spawnWave(1)`) | Rout all enemies | `txt[2, 3]` + teleport flash -> Town 25 |
| **Ch 25** `火焰的審判` | `24`| `16`| `txt[1]`, **4× Earthquakes (`20, 20, 20, 60`)**, `txt[2]` (`#26 聖寇拉斯` `slot 16`, `#29 亞齊梅吉` `slot 18`) | • **Sol Step `(10,1)` (`EV 55`)**: `#0 索爾` 1v1 cutaway duel vs `#104 火龍` (`slot 17`) -> awards **`#11 炎龍劍`**!<br>• **Turn 6 (`EV 56`)**: Reinforcements | Defeat if `#26` (`txt[3]`) or `#29` (`txt[4]`) dies; victory when non-`#104` enemies die | `txt[6]`, `spawnWave(2)`, `Choreo 75`, `txt[7]`, recruits **`#26 聖寇拉斯`** & **`#29 亞齊梅吉`** -> Town 26 |
| **Ch 26** `未知的迴廊` | `25`| `15`| `Choreo 76`, `txt[0]` | • **Chests `0..4` (`EV 58`)**: **Choose-1-of-5 Legendary Weapons** (`#29 戰神戟 / #43 魔神斧 / #51 風神弓 / #61 光之杖 / #71 魔龍爪`; opening 1 locks the other 4!)<br>• **Tile `(1,46)` (`EV 61`)**: Without `#208 控制中樞` -> `txt[2]`; with `#208` -> consumes `#208`, `txt[3]`, **`FDOTHER[45]`**, `spawnWave(1)`, recruits **`#31 渥德`**, `txt[4]`!<br>• **Switches (`EV 59, 60`)** & **Turn Waves (`EV 57`)** | Defeat if `#0 索爾`, `#9 悠妮` (`txt[7]`), or awakened `#31 渥德` (`txt[11]`) dies | Formation + `Choreo 77..80`, `txt[8..10]` (`txt[9]` if `#31` awakened, else `txt[10]`) *(Next: Camp-Only)* |
| **Ch 27** `命運的交會點` *(Camp)* | `26`| `15`| `Choreo 76`, `txt[0]`, Sky Key check (`txt[3/4]`), **3× Lightning Strikes** + `Choreo 81`, `txt[5, 6]` | • **Core Switches & Scheduled Waves (`EV 62, 63, 65, 84`)** | Defeat if `#0 索爾` or `#9 悠妮` (`txt[8]`) dies | Formation + `Choreo 82`:<br>• **Has `Item 100 天空之鑰`**: `txt[9] -> Choreo 83 -> txt[10] -> Choreo 84 -> txt[11, 12]` + Core Pulses & Lightning -> **True Route Ch 28**!<br>• **No `Item 100 天空之鑰`**: `txt[13] -> Choreo 84 -> txt[14] -> Choreo 82 -> txt[15, 16]` -> **Normal Ending (`ENDING_SEQUENCE`)**! |
| **Ch 28** `探索者` *(Camp)* | `27`| `20`| Lightning teleport (`20` heroes!), `Choreo 85 × 3`, `txt[0]`, `spawnWave(6)` | • **Switches & Scheduled Waves (`EV 65..70`)** | Defeat if `#0 索爾` or `#9 悠妮` dies | `txt[7]` -> Proceeds to **Ch 29** |
| **Ch 29** `無邊的黑暗之中` *(Camp)* | `28`| `20`| `Choreo 86`, `txt[7]`, `spawnWave(8)` (`56` guards!) | • **Step `(15,21)` (`EV 75`)**: Non-`#9` unit -> `txt[0]`; **`#9 悠妮`** -> `txt[1]`, schedules `EV 74` & `EV 76` (`spawnWave(1)`: **`#104 火龍 / #127 暗黑龍 / #105 雷龍`**, `txt[2..6]`, `EV 79`) | Victory iff **all 3 Dragons (`EV 73, 77, 78` -> `flag[18..20]`)** defeated; defeat if `#0 索爾` or `#9 悠妮` (`txt[9]`) dies | `txt[10..15]`, `spawnWave(9)` (`#126 空魔神`), **9× Earthquakes** as sanctum collapses -> **Ch 30** |
| **Ch 30** `傳說的終章` *(Camp)* | `29`| `20`| `Choreo 87`, `txt[0]`, altar pillars (`fn_147320`), `txt[1]` (`#126 空魔神` + 4 Elemental Demon Gods `#122..#125`) | • **Defeat Each Elemental Demon God (`EV 81 -> EV 82`)**: Plays `txt[2..5]`, spawns Waves `1..3`, and unlocks `#126 空魔神` (`txt[6]`)<br>• **Defeat `#126 空魔神` (`EV 83`)**: `txt[8]`, wipes remaining enemies | Victory when **`#126 空魔神` (`slot 20`)** defeated; defeat if `#0 索爾` or `#9 悠妮` (`txt[7]`) dies | Formation + `Choreo 88`, `txt[9, 10]`, Lightning -> **Loads `Map 30` (`終章・王城凱旋`)** -> `txt[0]`, `Choreo 89`, `txt[1]` -> **True Ending (`ENDING_SEQUENCE`)**! |

---

## 7. Battlefield Operations & On-Map Presentation Pipeline (`戰場操作與地圖演出邏輯`)

> [!IMPORTANT]
> Every tactical action on the map follows a deterministic multi-stage visual state machine in `FD2.EXE`. In particular, **reducing a unit's `HP` (`unit+64`) to `0` does NOT hide or remove the unit from the map immediately** — `unit+5` bit `0` (`dead / hidden`) remains `0` until `fn_56165()` plays the unit's clockwise death spin and 12-frame explosion directly on the tactical map!

### 7.1 Unit Lifecycle, On-Map Death Spin & 12-Frame Explosion (`fn_56165`)

1. **Two-Flag Unit Visibility (`unit+5` vs `unit+64`)**:
   - While `unit.hp == 0` (`unit+64 == 0`) and `(unit.flags & 1) == 0` (`!unit.hidden`), the unit is **still rendered on the battlefield** (`fn_10153` / `fn_10208` check `unit+5 & 1`, NOT `unit+64`).
   - Thus, when a cutaway duel or spell ends with `defender.hp == 0` (or `attacker.hp == 0` from a lethal counterattack!), returning to the tactical map still shows the defeated unit standing on its tile so `fn_56165()` can animate its demise.
2. **`fn_56165()` Exact Two-Phase Death Sequence**:
   - Collects all units `slot = 0 .. numUnits - 1` with `!(unit+5 & 1)` and `unit.hp == 0` (up to simultaneous multi-target AoE / poison deaths!).
   - If none are within the active camera viewport, marks `unit+5 = 1` immediately and returns. Otherwise:
   - **Phase A — Clockwise Circle Spin (`step = 0 .. 12`, 13 ticks)**:
     - On each tick `step` (`0..12`), updates every dying unit's facing direction `unit+3 = step % 4` (`0 = Down -> 1 = Left -> 2 = Up -> 3 = Right`, completing **3 full clockwise circles** and ending facing `0 = Down`), redraws the tactical map (`fn_7918` + `fn_10208`), and waits 1 frame tick (`~55 ms`, `~715 ms` total).
   - **Phase B — Unit Vanish + 12-Frame `FDOTHER[5][68..79]` Explosion (`frame = 0 .. 11`)**:
     - Sets `unit+5 = 1` (`unit.hidden = true`) on all `hp == 0` units **at the exact start of Phase B**, re-renders the clean map without those units into a scratch buffer, and triggers **Explosion SFX `#3`** (`FDSND[0][3]`).
     - Blits `FDOTHER[5][68 + frame]` (`frame = 0..11`) via **`fn_256091`** (PCX-RLE `strict > 0xC0` with **palette index `0` transparent**) at top-left anchor **`((unit.x - 1) * 24, (unit.y - 1) * 24 - 6)`** (`(-24, -30)` px relative to the unit's `24×24` tile top-left, because `68..75` include built-in top-left transparent padding inside a `72×71` blast envelope!).
     - **Cumulative Fireball (`frames 0..5`) vs. Clean Expanding Smoke (`frames 6..11`)**:
       - For `frame = 0..5` (`FDOTHER[5][68..73]`), `FD2.EXE` blits each sprite **cumulatively** over the previous explosion frames without restoring the background, building a dense fiery core.
       - For `frame = 6..11` (`FDOTHER[5][74..79]`), `FD2.EXE` restores the clean unit-less map background before blitting each frame so the smoke ring expands and dissipates cleanly into thin air!

### 7.2 Movement, Friendly Pass-Through, Enemy ZOC, Undo & Post-Move Magic Restriction (`fn_34960`, `fn_17869`, `fn_254016`, `fn_18129`)

- **Exact 5-Step Movement Pipeline (`fn_34960` & `fn_16673`)**:
  1. **Flying Cost-Table Override (`fn_61827` at `@35046`)**: `GLOBAL_3_5702` (`29 × 20 B`) is indexed **1-based by `class_id` (`1..28`)** (`row 0` is an unused all-`1` dummy row; `20` = impassable). If `fn_61827(unit) != 0` (`class_id == 19 飛龍騎士`, or `race_id in (4 鳥人, 5 龍人)` except `uid == 28 達克塞`), the engine overrides the cost row to **`row 19` (`[1, 1, 1, 1, 1, 20, ...]`)** so Flyers cross deep water/cliffs (`tp[1] == 1`), sand (`2`), forests (`3`), and swamps (`4`) at cost `1`, blocked only by walls (`tp[1] == 5` or `tp[0] & 0x80`).
  2. **Hostile Occupancy (`0x40`) & 4-Neighbor ZOC (`0x80`) (`fn_17869` at `@35112`)**:
     - **Friendly units (`Player <-> Player`, `Player <-> NPC Ally`, `Enemy <-> Enemy`) write NOTHING in `fn_17869`** — friendly units **never** block passing through and **never** exert Zone of Control!
     - Only active **hostile** units set `cell[2] |= 0x40` on their own tile (completely impassable to both ground and flying units) and `cell[2] |= 0x80` on their 4 orthogonal neighbors (`left, up, right, down`).
  3. **Shortest-Path Flood (`fn_254016` at `@35149`)**:
     - Traverses passable tiles (`stepCost < 20`), passing straight through friendly units at normal terrain cost.
     - Stepping **onto** an enemy-adjacent ZOC tile (`cell[2] & 0x80`) is allowed if `rem_mv >= stepCost`, and clamps remaining MV on that tile to `0` (ending movement there); starting a turn already adjacent to an enemy starts with full `mv` so the unit can freely step away!
  4. **Friendly Stop-Exclusion (`fn_18129` at `@35160`)**:
     - Runs **after** `fn_254016` completes: marks friendly-occupied tiles `cell[3] = 0xFF` solely so the unit cannot **end** its move standing on top of a friendly unit, while keeping the path chain through the friendly unit intact!
  5. **Step-by-Step Walk, Hardware Frame Pacing & Right-Click Undo (`fn_254374 -> fn_13448 -> fn_11946/12301/12677/13077`)**:
     - Reconstructs the full tile-by-tile path right through any friendly units, breaking equal-cost ties in **`East (3) -> North (2) -> West (1) -> South (0)`** priority (`fn_254374`).
     - **Exact Hardware Timing per Tile (`6 × 4 px = 24 px`)**:
       - Each 1-tile directional walker (`fn_11946` South, `fn_12301` West, `fn_12677` North, `fn_13077` East) runs a **6-iteration loop** advancing the sprite (and the camera in lockstep whenever within `2` tiles of the `13 × 8` viewport border) by **`4` native pixels per sub-step** (`4, 8, 12, 16, 20, 24` px).
       - Inside each of the 6 sub-steps, `FD2.EXE` composites the frame (`fn_10153`), waits on **VGA Vertical Retrace (`port 0x3DA` bit 3 in `fn_7856`, `70.086 Hz` = `14.27 ms`)**, synchronizes against the **DOS BIOS Tick Counter (`[0x46C]` vs `GLOBAL_2_14860` in `fn_13408`)**, and updates non-blocking water palette (`fn_253900`) and 4-beat ping-pong stride (`0 -> 1 -> 2 -> 1` in `fn_7918` / `fn_10621`).
       - In `fd2-web`, `animateUnitWalk`, `playChoreo`, and `walkUnitWithCameraScroll` quantize positions to exact `1/6`-tile (`4px`) steps at `18 ms` per sub-step (`6 × 18 ms = 108 ms/tile` at `1x`, `54 ms/tile` at `2x`) so all 6 `4px` sub-steps render cleanly on 60Hz displays without frame-skipping blur or multi-second turn lag.
     - **AI Ally 1-Tile Self-ZOC Rule (`fn_19320 -> fn_17869(0)`)**:
       - In AI movement (`fn_19320`), `FD2.EXE` passes `side_flag = 0` to `fn_17869`, marking all non-Enemy (`Player` + `Ally`) ground units' 4 orthogonal neighbors with `0x80` — including a moving `Ally` (`faction == 1`) unit's own 4 neighbors! Consequently, ground `Ally` NPCs (such as Chapter 2 `#133/#134` civilians) step **`1` tile per turn** (`East` first on ties), matching native `FD2.EXE` (`V5:(16,14)->(17,14)->...->(19,6)`, `V8:(7,7)->(8,7)->(8,8)->...`).
     - **`urec[22]` Death Trigger Split (`2` = `EV` Event vs `3` = `FDTXT` Dying Dialogue)**:
       - `urec[22] == 2` triggers mid-battle event `EV = urec[23..24]`, whereas `urec[22] == 3` plays chapter dialogue `FDTXT[m+1][urec[23..24]]` directly (e.g. Ch 2 civilians `dlg[11..16]`, Ch 1 boss `dlg[8]`, Ch 3 `#2 鐵諾` `dlg[9]`).
     - Pressing **Cancel / Right-Click** from the Unit Action Cross Menu before committing an action snaps the unit back to `(origX, origY, origDir)` with `moved = false`.
- **Post-Move Magic Rule (`Move + Cast` Restriction)**:
  - In `fn_34960`, whenever a unit moves `dist > 0` tiles (`moved == true`), `disableMagic` is set to `1` (**Magic arm disabled after moving!**) **EXCEPT** when `unit.uid` (`unit+7`) is **`18` (`#18 蜜蒂`)**, **`19` (`#19 羅德曼`)**, or **`34` (`#34 鐵諾` Sword Saint `劍聖`)**! Only those three Sword Saint slots can both move and cast spells/sword-arts on the same turn.

### 7.3 Cutaway vs. On-Map Spell Execution (`FDOTHER[6]`), Earthquakes (`fn_70984`) & Bouncing Map Digits (`fn_57176`)

- **Cutaway Spells vs. Map-Only Spells (`fn_54284`)**:
  - **Cutaway Battle Stage Spells (`fn_108221` / `fn_98249`)**: Spells **`0..9`** (`火炎術..咒殺術`), **`24`** (`破龍擊`), and **`28..35`** (`淒煌斬 / 熾炎刀 / 音速刃` & Summons `熾天使 / 風妖精 / 破壞神 / 暗邪鬼`) transition into the `320×200` cutaway stage when combat animations are enabled (and fall back to `FDOTHER[6]` on-map FX when fast map-only mode is active!).
  - **Earthquake Spells (`10 碎岩術`, `11 地震術`, `12 裂地術` -> `fn_70984`)**: **Always execute directly on the tactical map**! They shake the map viewport (`fn_62808`), affect all **non-flying** (`fn_61827 == 0`) enemies in AoE, and pop bouncing damage/MISS numbers over every target on the map.
  - **Healing, Buff, Status & Utility Spells (`13..22`, `25..27` -> `fn_50380`)**: **Always execute directly on the tactical map** (never opening the `320×200` cutaway stage!):
    - `fn_50380(spellId)` looks up `start = GLOBAL_2_7987[spellId]`, `count = GLOBAL_2_8020[spellId]`, and `sfx = GLOBAL_2_8053[spellId]` (`Obj 2 + 7987 / 8020 / 8053`), and plays `FDOTHER[6][start .. start + count - 1]` (PCX-RLE with color `0` transparent) simultaneously over all affected target tiles at `(tileX * 24, tileY * 24 - 6)`!
    - `23 傳送術` (`fn_68719`): Teleports an adjacent/selected ally to an unoccupied passable tile with `FDOTHER[9]` sparkles.
- **Bouncing On-Map Damage / Heal / `MISS` Sprites (`fn_57176`, `fn_57563`, `fn_57820`)**:
  - All `FDOTHER[5][94..118]` pop-up glyphs are `6×7` (or `5×7` / `7×7`) PCX-RLE sprites with palette index `0` transparent:
    - **`94..103`**: Orange-gold **Damage** digits `0..9` (`base = 94`)
    - **`105..114`**: Emerald-green **Heal** digits `0..9` (`base = 105`)
    - **`[116, 117, 118, 118]`** (`GLOBAL_2_8266`): **`M-I-S-S`** letter tiles!
  - `fn_57176` animates them for `22` ticks over every target tile using the 2-bounce parabola `GLOBAL_2_8236 = [15, 15, 15, 15, 7, 3, 1, 0, 0, 1, 3, 7, 15, 15, 11, 9, 8, 8, 9, 11, 15, 15]` (`yOffset = curve[tick] - 3` px from tile top, staggered by `targetIdx // 4` ticks!).

### 7.4 Treasure Chest & Hidden Ground Item Operations (`fn_37036`, `fn_8803` Tile `+1` Swap & Full-Bag Item Swap)

- **0-Based Chest Indexing & Terrain Flags (`tp[0] & 0x60` + `cell.eventId = 0..15`)**:
  - In `FDFIELD.DAT`, `ctrl_raw[83 + ci * 3]` defines `16` chest slots (`ci = 0..15`, **0-based!**), and map cells reference them directly via `cell.eventId = 0..15` whenever the tile's terrain property flag `(tp[0] & 0x60) != 0` (`(cellFlags & 2) != 0`).
  - **Visible Treasure Chests (`tp[0] & 0x20`, `(cellFlags & 0x40) == 0`)**: Rendered with chest graphics in `FDSHAP.DAT`; standing on the tile and choosing **Rest (`休息`)** prompts `發現寶箱！是否打開寶箱？` (`[YES / NO!]`).
  - **Hidden Ground Treasures (`tp[0] & 0x40`, `(cellFlags & 0x40) != 0`, e.g., Ch 20 `(30, 7)` `#212 暗之眼`)**: Visually indistinguishable from normal ground (never draws a chest glint on the map!). When a player unit ends its move / chooses **Rest (`休息`)** on the cell, `fn_37036` prompts `發現東西！是否拾取？` (`[YES / NO!]`) and **never** increments `cell.tileId` upon pickup!
- **Visual Open-Chest Tile Swap (`fn_8803`)**:
  - When a visible chest (`(cellFlags & 0x40) == 0`) is emptied (gold taken, item placed into a non-full bag, or chest event triggered), `fn_8803` **increments the map cell's tile ID by `+1`** (`cell.tileId += 1`) and clears `cell.eventId = 0` (removing the chest flag)! Every `FDSHAP.DAT` tileset stores `[closed_chest_tile, open_chest_tile]` as adjacent tile indices `(t, t + 1)`, so incrementing `tileId` immediately updates the map graphic to an open empty chest!
- **Full 8-Slot Inventory Item Swap (`fn_37036`)**:
  - Items are never converted into gold when a unit's 8-slot bag is full!
  - Instead, if `unit.items.length >= 8`, the game asks `道具袋已滿，是否交換道具？` (`[YES / NO!]`):
    - Choosing **`YES`** lets the player pick one of the unit's 8 items to **swap into the chest** (`chest.value = swappedItemId`; the chest remains closed/active holding that swapped item so another unit can still retrieve it later!).
    - Choosing **`NO`** leaves the original item untouched inside the unopened chest.
  - Similarly, when an enemy drops an item (`fn_43549`) and the killer's 8-slot bag is full, the player is prompted to pick an item from the 8-slot bag (or decline the drop) rather than silently losing it.

### 7.5 Rest Healing (`fn_16340`), Per-Faction Lethal Poison Tick (`fn_43110`) & Post-Action Pipeline (`fn_56165 -> fn_43549 -> fn_58002`)

1. **Unmoved Unit Rest Healing (`fn_16340` / `fn_41739`)**:
   - When a unit ends its action via **Rest (`休息`)** without having moved (`moved == false`) — or stands unacted when **End Turn (`回合結束`)** is confirmed — AND is **neither Poisoned (`unit+37 == 0`) nor Paralyzed (`unit+38 == 0`)** AND `hp < maxHp`:
   - Plays `FDOTHER[9]` sparkle / white flash + Heal SFX `#4` and restores **`floor(maxHp / 5)` (`20% MaxHP`, min `1`)**!
2. **Per-Faction Start-of-Phase Status & Lethal Poison Tick (`fn_43110(faction)`)**:
   - Runs at the start of **each faction's phase** (`player`, `enemy`, `ally`) solely for units of that faction:
     - Decrements remaining turns of Poison, Paralysis, Silence, and `AP / DP / MV` buffs.
     - **Poison Damage (`10% MaxHP`, Lethal!)**: Deals `max(1, floor(maxHp / 10))` damage and **can reduce `hp` all the way to `0`** (never clamped to `1`!).
     - Immediately after scanning the faction, calls **`fn_56165()`** so any unit whose HP hit `0` from poison **spins in a circle, explodes (`FDOTHER[5][68..79]`), and disappears on the map**, followed by victory/defeat evaluation!
3. **Strict Post-Action Resolution Order**:
   - Every attack or offensive spell strictly executes in this exact sequence:
     1. Cutaway animation (`fn_100972` / `fn_108221`) OR on-map animation (`fn_50380` / `fn_70984` + `fn_57176` bouncing digits) applies HP/status changes and returns to the tactical map.
     2. **`fn_56165()` On-Map Death Spin + Explosion + Vanish** plays for **any** combatant (`defender` OR counterattacked `attacker`) whose `hp <= 0`.
     3. **`fn_43549()` Enemy Spoils & Boss Death Events**: Awards Gold, Item drop (with 8-slot bag full swap/discard prompt), or triggers scripted death `eventId`.
     4. **`fn_58002()` EXP Gain, Level-Up & Spell Learning**:
        - Single-action EXP gain is capped at **`99`** (`if (exp > 99) exp = 99`).
        - Standard hero level cap is **`Lv 40`**, while **`#30 蓋亞`** and **`#31 渥德`** cap at **`Lv 99`** (`exp` locked at `0` upon reaching cap).
        - Displays EXP gained, rolls level-up stat increases from `GLOBAL_3_8265`, and checks the hero's 6-slot learnable spell list (`GLOBAL_3_9771`) to grant and announce any newly learned spell at the new level!
     5. **Post-Action Front-View Facing Reset (`fn_13540()`, `Obj1+13540..13585`)**:
        - Loops across all living battlefield units (`for (i = 0; i < numUnits; i++) units[i].dir = 0;`), turning every surviving unit back to **`0 = Down / Front View`** after completing any action:
          1. `fn_34960 @35418` — after any Player unit completes its action (move + rest/chest/item/attack/spell),
          2. `fn_21646 @21916 & @22055` — immediately after Physical Combat (turning **both** surviving attacker and surviving defender back to front view!),
          3. `fn_20565 @21255` — immediately after Spell / Teleport execution,
          4. `fn_15007 @16008` — at the end of every Ally / Enemy AI unit's turn!
     6. **Victory / Defeat Check (`fn_66935`)**.


---

## 8. Post-Battle Conditional Rewards, Non-Kill Battlefield Events & Special Victory/Defeat Rules (`戰後條件獎勵、非擊殺觸發事件與特殊勝敗判定`)

> [!IMPORTANT]
> Many chapters in `FD2.EXE` evaluate **post-battle (`POST`) conditional checks** that are **not** triggered by killing an enemy — including friendly NPC survival counts, battle turn limits, Sol's Max HP threshold, party roster checks, and carried sacred artifacts — alongside **non-kill mid-battle events** (character/item-specific step tiles, 1-of-5 vault chests, `0x40` hidden ground treasures, and dynamically scheduled turn events).

### 8.1 Post-Battle (`POST`) Conditional Item Rewards, Recruitments & Route Splits (`Ch 1..30`)

| Chapter | Target Reward / Recruit / Route | Exact `FD2.EXE` Condition | Pass Outcome | Fail / Alternate Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **Ch 2** (`m=1` `羅德鎮`) | **`#198 力量藥水`** (`fn_49696(198)`) | **Zero** villagers killed among `slots[5..10]` (`#133/#134` × 6 fleeing to `(19,6)/(16,0)/(15,0)`) | Plays **`dlg[6]`** and grants **`#198 力量藥水`** to party inventory | Plays **`dlg[7]`**, **no item awarded** (`#8 希莉亞` still joins afterward in both cases) |
| **Ch 3** (`m=2` `森林小徑`) | **`#2 鐵諾`** (`fn_4773(2)`) | Ally `slot 6` (`#2 鐵諾`) survived the battle (`hp > 0`) | Applies formation, plays **`dlg[7]`**, recruits **`#2 鐵諾`** | Plays **`dlg[6]`** only; **`#2 鐵諾` permanently fails to join** |
| **Ch 7** (`m=6` `獸人峽谷`) | **`#12 凱麗`** (`fn_4773(12)`) | Player triggered road step **`EV 26`** (`flag[16]=1`) before Turn 10 -> spawned **`EV 25`** (`flag[17]=1`, `slot 43` `#12 凱麗`), AND `slot 43` survived (`hp > 0`) | Applies formation, plays **`dlg[4]`**, recruits **`#12 凱麗`** | Plays **`dlg[5]`**; **`#12 凱麗` does not join** |
| **Ch 8** (`m=7` `渡河作戰`) | **`#5 洛娜`** (`fn_4773(5)`) | Clear Chapter 8 | Plays `dlg[3] -> Choreo 33 -> dlg[4] -> Choreo 34`, recruits **`#5 洛娜`** | — |
| **Ch 15** (`m=14` `拉卡湖的激戰`) | Dialogue branch + **`#15 塞可邦勒`** | Checks `partyHasHero(12)` (`#12 凱麗` in roster) | `PRE` plays **`dlg[2]`**, `POST` plays **`dlg[12]`**, recruits **`#15 塞可邦勒`** | `PRE` plays **`dlg[5]`**, `POST` plays **`dlg[13]`**, recruits **`#15 塞可邦勒`** |
| **Ch 16** (`m=15` `冰原之戰`) | **`#18 蜜蒂`** (`fn_4773(18)`) | **All 3 conditions** must hold simultaneously:<br>1. Dead friendly guards among `slots[66..73]` **`<= 4`** (at least 4 of 8 survive)<br>2. Battle cleared on **`turn <= 18`**<br>3. `#0 索爾` (`slot 0`) **`maxHp >= 320`** | Plays **`dlg[4]`**, recruits **`#18 蜜蒂`**! | Plays **`dlg[2] -> Choreo 49 -> dlg[3]`**; `#18 蜜蒂` walks off and **does not join** (appears as unrecruited guest `slot 52` in Ch 17) |
| **Ch 17** (`m=16` `血與冰之刃`) | Cutscene branch + **`#16 凱拉斯`** | Checks `partyHasHero(18)` (`#18 蜜蒂` recruited in Ch 16) | `POST` plays `dlg[5] -> spawnWave(3) -> Choreo 52 -> dlg[6] -> Choreo 53 -> dlg[8]`, recruits **`#16 凱拉斯`** | `PRE` spawns guest `slot 52` (`#18`); `POST` plays `dlg[7] -> Choreo 50 -> spawnWave(3) -> Choreo 51 -> dlg[6] -> Choreo 53 -> dlg[8]`, recruits **`#16 凱拉斯`** |
| **Ch 20** (`m=19` `死亡般的沈寂`) | **`#28 達克塞`** (`fn_4773(28)`) | Battle cleared on **`turn <= 15`** (`#25 謝多` always joins first) | Spawns Wave 1 (`slot 83` `#28`), plays `Choreo 60 -> dlg[14] -> Choreo 61 -> dlg[15] -> Choreo 62 -> dlg[16]`, recruits **`#28 達克塞`**, then plays `dlg[13]` | Skips Wave 1 (`#28 達克塞` does not appear or join), plays **`dlg[13]`** directly |
| **Ch 21** (`m=20` `亞述森林`) | **`#100 天空之鑰`** (`fn_49696(100)`) | Party (`slots[0..15]`) collectively holds **all 6 Sacred Artifacts (`#209..#214`)** | Removes `#209..#214`, grants **`#100 天空之鑰`**, plays `dlg[7] -> Choreo 63 -> dlg[8] -> Choreo 64 -> FDOTHER[34] Crystal Beam -> dlg[10]`; recruits **`#24 希爾法`** & **`#23 羅蘭`** | Plays **`dlg[6]`** (no Sky Key); still recruits **`#24 希爾法`** & **`#23 羅蘭`** |
| **Ch 23** (`m=22` `魔神殿前門`) | **1. `#22 卡里斯`**<br>**2. `#19 羅德曼`** | **1.** `partyHasItem(100)` (`#100 天空之鑰` held)<br>**2.** `!partyHasHero(18)` (`#18 蜜蒂` NOT in party) **AND** **`turn < 15`** | **1.** Plays **`dlg[8]`**, recruits **`#22 卡里斯`**<br>**2.** Plays **`dlg[13]`**, recruits **`#19 羅德曼`** | **1.** No `#100`: `dlg[9] -> Choreo 71` (`#22` leaves)<br>**2a.** Has `#18`: `dlg[10] -> Choreo 72 -> hideSlot(17) -> dlg[11]` (`#19` leaves; mutually exclusive with `#18`!)<br>**2b.** `!#18` & `turn >= 15`: `dlg[12] -> Choreo 72 -> hideSlot(17)` (`#19` leaves!) |
| **Ch 25** (`m=24` `火焰的審判`) | **`#26 聖寇拉斯`** & **`#29 亞齊梅吉`** | Clear Chapter 25 (`#26` & `#29` must survive battle) | Plays `dlg[6] -> spawnWave(2) -> Choreo 75 -> dlg[7]`, recruits **both `#26 聖寇拉斯` and `#29 亞齊梅吉`** | — |
| **Ch 26** (`m=25` `未知的迴廊`) | Dialogue branch (`#31 渥德`) | Checks `flag[12] == 1` (or `partyHasHero(31)` from `EV 61`) | Plays **`dlg[8] -> Choreo 77..80 -> dlg[9] -> dlg[11]`** | Plays **`dlg[8] -> Choreo 77..80 -> dlg[10] -> dlg[11]`** |
| **Ch 27** (`m=26` `命運的交會點`) | **True Route (`Ch 28..30`) vs Normal Ending** | Checks `partyHasItem(100)` (`#100 天空之鑰` in party) | Plays `dlg[9] -> Choreo 83 -> dlg[10] -> pan(9,8) -> Choreo 84 -> dlg[11..12]` + Core Pulses & Lightning -> **advances to Chapter 28 (`探索者`)**! | Plays `dlg[13] -> Choreo 84 -> dlg[14] -> Choreo 82 -> dlg[15..16]` -> **Normal Ending (`ENDING_SEQUENCE`)**! |

---

### 8.2 Complete 6 Sacred Artifacts (`#209..#214`) -> `#100 天空之鑰` Acquisition Map

| Item ID & Name | Chapter | Acquisition Method & Exact Coordinates |
| :--- | :---: | :--- |
| **`#209 黃金徽章`** | **Ch 10** (`m=9`) | Carried in **`#11 索菲亞`**'s initial inventory (`[54, 167, 209]`) when she joins in Ch 10 Post-Battle |
| **`#210 星之眼`** | **Ch 11** (`m=10`) | Inside **Chest `0`** (`chestIndex = 0`) at tile **`(18, 37)`** |
| **`#214 火之眼`** | **Ch 13** (`m=12`) | Inside **Chest `8`** (`chestIndex = 8`) at tile **`(38, 18)`** |
| **`#211 光之眼`** | **Ch 15** (`m=14`) | Turn 7 `EV 38` spawns Wave 1 (`slot 74` `#102 獸人`); defeating `slot 74` triggers **`EV 39`** (`dlg[11]` + **`#211 光之眼`**) |
| **`#213 冰之眼`** | **Ch 17** (`m=16`) | Defeating boss `#123 水魔神` (`slot 16`) triggers **`EV 41`** (`dlg[3]` + **`#213 冰之眼`** + `dlg[4]`) |
| **`#212 暗之眼`** | **Ch 20** (`m=19`) | **Hidden Ground Treasure** (`chestIndex = 7`, `cellFlags & 0x40`) at tile **`(30, 7)`** |

---

### 8.3 Non-Kill Battlefield Events (`Step Triggers`, `Choose-1-of-5 Vault`, `Scheduled Turn Events`)

1. **Character- & Item-Specific Step Events (`FDFIELD` `stepEvents` `triggerIndex = 1..16`)**:
   - **Ch 7 `EV 26` (`triggerIndex = 1`, `(9,13)..(14,15)`)**: Stepping onto the canyon road wakes `slots[9..27]` AI and sets `flag[16] = 1` (prerequisite for Turn 10 `EV 25` `#12 凱麗` arrival!).
   - **Ch 13 `EV 8` (`triggerIndex = 1`, `(24, 5)`)**: When **`#0 索爾` (`slot 0`)** steps on `(24, 5)` with `< 8` items and `flag[16] == 0`, awards **`#89 勇者徽章`**, plays `dlg[11]`, and sets `flag[16] = 1` (if another unit steps on `(24, 5)`, `flag[16]` stays `0` so Sol can still claim it!).
   - **Ch 25 `EV 55` (`triggerIndex = 1`, `(10, 1)`)**: When **`#0 索爾` (`slot 0`)** steps on `(10, 1)` while `flag[0] == 0`, plays `dlg[0]` and launches a scripted 1v1 cutaway duel between `slot 17` (`#104 火龍`) and `slot 0` (`#0 索爾`); if `#104 火龍` is slain, plays on-map death spin+explosion, sets `flag[0] = 1`, and awards **`#11 炎龍劍`**!
   - **Ch 26 `EV 61` (`triggerIndex = 3`, `(1, 46)`)**: Stepping on `(1, 46)` while `flag[12] == 0`:
     - Without `#208 控制中樞` (from Ch 17 Chest `1` at `(0, 1)`): plays **`dlg[2]`** and leaves `flag[12] = 0`.
     - Carrying `#208 控制中樞`: removes `#208` from the unit's bag, plays **`dlg[3]`**, plays **`FDOTHER[45]`** (`59` frames), sets `flag[12] = 1`, spawns Wave 1 (`slot 84` `#31 渥德` at `(1, 45)`), recruits **`#31 渥德`**, and plays **`dlg[4]`**!
   - **Ch 29 `EV 75` (`triggerIndex = 2`, `(15, 21)`)**: Stepping on `(15, 21)` while `flag[17] == 0`:
     - Any unit other than `#9 悠妮`: plays **`dlg[0]`** and leaves `flag[17] = 0`.
     - **`#9 悠妮`**: plays **`dlg[1]`**, sets `flag[17] = 1, flag[16] = 4`, and schedules `turnEvents[0]` (`EV 74` reinforcement waves `4..7`) and `turnEvents[1]` (`EV 76` countdown -> spawns Wave 1 `#104 火龍 / #127 暗黑龍 / #105 雷龍`, white flashes + `dlg[2..6]`, schedules `EV 79`).
2. **Chapter 26 Choose-1-of-5 Legendary Weapons Vault (`EV 58`, `chestIndex = 0..4`)**:
   - Located in the central vault at **`(14, 3)` (`#29 戰神戟`)**, **`(16, 3)` (`#43 魔神斧`)**, **`(15, 4)` (`#51 風神弓`)**, **`(14, 5)` (`#61 光之杖`)**, and **`(16, 5)` (`#71 魔龍爪`)**.
   - All 5 chests have `type = "event", value = 58`. Opening any 1 chest (`ci = 0..4`) when `unit.items.length < 8` awards `GLOBAL_2_10062[ci]`, visually opens that chest (`tileId + 1`), and sets **`flag[0..4] = 1`**, permanently locking the other 4 chests (`dlg` / sealed vault)! If `unit.items.length >= 8`, displays `道具袋已滿` without locking or consuming any chest.
3. **Mid-Battle Non-Kill Turn Recruitments & Dormant Scheduled Turn Slots (`turn == 0xFF`)**:
   - **Turn-Triggered Hero Recruitments**: **Ch 1 Turn 3 `EV 0`** (`#1 哈諾`), **Ch 19 Turn 6 `EV 46`** (`#27 巴拿羅西亞`), and **Ch 22 Turn 5 `EV 50`** (`#20 莎拉`).
   - **Dormant `turn == 255` (`0xFF`) Turn Slots**: Chapters **9, 27, 28, 29, 30** store `turnEvents` entries with initial `turn = 255` (`0xFF`). Step switches or boss deaths dynamically write `turn = currentTurn + 1` (or `currentTurn + 2`) into `turnEvents[slot].turn` to trigger delayed gate openings, dragon awakenings, and Demon God phase transitions!

---

### 8.4 Complete 30-Chapter Victory & Defeat Evaluators (`GLOBAL_2_6937[0..29]`: `fn_66996 .. fn_68597`, Verified vs `FD2.EXE` + Chiuinan Walkthrough)

- **Default Rout (`fn_66996` — Ch 1, 3, 4, 5, 6, 7, 8, 9, 11, 14, 24)**:
  - **Victory (`fn_67006()`)**: All enemies defeated (`敵全滅`).
  - **Defeat (`fn_148798(0)`)**: `#0 索爾` (`slot 0`) dies (`索爾死亡`). *(Note: `#10 瑪琳` in Ch 5 and `#14 珊` in Ch 11 use `fn_66996` and are NOT defeat conditions if knocked out; in Ch 1, `#1 哈諾` only joins if Turn 3 `EV 0` triggers before rout!)*
- **Ch 2 (`m=1`, `fn_67269`)**: Victory = Enemy rout; Defeat = `#0 索爾` dies OR **all 6 villagers (`slots[5..10]`)** are killed (`hp <= 0`; escaped villagers have `hp > 0, hidden = true` and count as surviving!).
- **Ch 10 (`m=9`, `fn_67335`)**: Victory = Enemy rout; Defeat = `#0 索爾` (`slot 0`), **`#135 卡納恩三世` (`slot 50`, `dlg[1]`)**, OR **`#11 索菲亞` (`slot 51`, `dlg[2]`)** dies.
- **Ch 12 (`m=11`, `fn_67397`)**: Victory = Enemy rout; Defeat = `#0 索爾` (`slot 0`) OR **`#17 米亞斯多德` (`slot 14`, `dlg[2]`)** dies.
- **Ch 13 (`m=12`, `fn_67429`)**: Victory = Enemy rout; Defeat = `#0 索爾` (`slot 0`) dies, OR **all 12 friendly Elves (`slots[15..26]`)** die (`精靈族全滅`), OR (`turn > 5` and **`#3 哈瓦特` `slot 59`** dies, `dlg[10]`). In Ch 13 Post (`fn_80031`), `#3 哈瓦特` joins even if cleared before Turn 4!
- **Ch 15 (`m=14`, `fn_67580`)**: Victory = Enemy rout; Defeat = `#0 索爾` (`slot 0`) OR **`#15 塞可邦勒` (`slot 64`, `dlg[7]`)** dies.
- **Ch 16 (`m=15`, `fn_67642`)**: Victory = Enemy rout; Defeat = `#0 索爾` (`slot 0`) OR **`#18 蜜蒂` (`slot 65`, `dlg[1]`)** dies.
- **Ch 17 (`m=16`, `fn_67698`)**: Mandatory `#18 蜜蒂` (`slot 1` if in party, or guest `slot 52` via `Wave 1` if not in party). Victory = Enemy rout; Defeat = `#0 索爾` (`slot 0`) dies, OR (`!partyHasHero(18)` and guest **`#18 蜜蒂` `slot 52`** dies, `dlg[2]`).
- **Ch 18 (`m=17`, `fn_67791`)**: Mandatory `#9 悠妮` (`slot 1`). **Victory** = **Boss `#85 黑暗騎士` (`slot 52`) dies** (`勝利條件：黑暗騎士死亡`) OR Enemy rout; **Defeat** = `#0 索爾` (`slot 0`), **`#21 約拿` (`slot 16`, `dlg[3]`)**, OR **`#7 蘭斯洛特` (`slot 17`, `dlg[4]`)** dies.
- **Ch 19 (`m=18`, `fn_67878`)**: Mandatory `#16 凱拉斯` (`slot 1`). **Victory** = Enemy rout (`fn_67006()`); **Defeat** = `#0 索爾` (`slot 0`) dies, OR (`turn > 6` and **`#27 巴拿羅西亞` (`slot 64`)** dies, `dlg[2]`). *(Note: `#27 巴拿羅西亞` is recruited ONLY by Turn 6 `EV 46`, so clearing before Turn 6 skips his recruitment!)*
- **Ch 20 (`m=19`, `fn_67927`)**: Mandatory `#9 悠妮` (`slot 1`). **Victory** = **All enemies OTHER than `#121 沼澤怪物` (`slots[16..35]`) are defeated** (`slots[36..51]` and `slots[61..82]`, `勝利條件：沼澤怪物之外的敵人全滅`); **Defeat** = `#0 索爾` (`slot 0`) dies, **`#25 謝多` (`slot 52`)** dies, OR **all 8 friendly Elves (`slots[53..60]`)** die (`dlg[10]`).
- **Ch 21 (`m=20`, `fn_68177`)**: Mandatory `#21 約拿` (`slot 1`). Victory = Enemy rout; Defeat = `#0 索爾` (`slot 0`), **`#24 希爾法` (`slot 16`, `dlg[3]`)**, OR **`#23 羅蘭` (`slot 17`, `dlg[4]`)** dies.
- **Ch 22 (`m=21`, `fn_68245`)**: Mandatory `#24 希爾法` (`slot 1`). Victory = Enemy rout; Defeat = `#0 索爾` (`slot 0`) dies, OR (`turn >= 5` and **`#20 莎拉` (`slot 72`)** dies). *(Note: `#20 莎拉` is recruited ONLY by Turn 5 `EV 50`!)*
- **Ch 23 (`m=22`, `fn_68287`)**: Mandatory `#24 希爾法` (`slot 1`). Victory = Defeating Boss `#116 機甲隊長` (`slot 18`, triggers `EV 53 -> fn_154554(18)` wiping all remaining enemies); Defeat = `#0 索爾` (`slot 0`), **`#22 卡里斯` (`slot 16`, `dlg[6]`)**, OR **`#19 羅德曼` (`slot 17`, `dlg[7]`)** dies.
- **Ch 25 (`m=24`, `fn_68355`)**: Victory = All enemies other than optional duel boss `#104 火龍` (`slot 17`, `slots[23..60]`) defeated; Defeat = `#0 索爾` (`slot 0`), **`#26 聖寇拉斯` (`slot 16`, `dlg[3]`)**, OR **`#29 亞齊梅吉` (`slot 18`, `dlg[4]`)** dies.
- **Ch 26 (`m=25`, `fn_68452`)**: Mandatory `#29 亞齊梅吉` (`slot 1`) & `#9 悠妮` (`slot 2`). Victory = Enemy rout; Defeat = `#0 索爾` (`slot 0`), **`#9 悠妮` (`slot 2`, `dlg[7]`)**, OR (when `flag[12] == 1`) awakened **`#31 渥德` (`slot 84`, `dlg[11]`)** dies.
- **Ch 27 (`m=26`, `fn_68520`) & Ch 28 (`m=27`, `fn_68520`)**: Mandatory `#9 悠妮` (`slot 1`). Victory = Enemy rout (3rd `#116 機甲隊長` kill in Ch 27 `EV 64` or 2nd `#116 機甲隊長` kill in Ch 28 `EV 71` runs `fn_154554` to wipe all remaining enemies); Defeat = `#0 索爾` (`slot 0`) OR **`#9 悠妮` (`slot 1`, `dlg[8]`)** dies.
- **Ch 29 (`m=28`, `fn_68576`)**: Mandatory `#9 悠妮` (`slot 1`, `slots[20..22]` reserved for `Wave 1` 3 Dragons). **Victory** = **All 3 awakened Dragons (`#104 火龍, #127 暗黑龍, #105 雷龍`) defeated** (`flag[18] == 1 && flag[19] == 1 && flag[20] == 1` via `EV 73, 77, 78`; killing all `Wave 8` guards before `EV 76` does NOT win early!); **Defeat** = `#0 索爾` (`slot 0`) OR **`#9 悠妮` (`slot 1`, `dlg[9]`)** dies.
- **Ch 30 (`m=29`, `fn_68597`)**: Mandatory `#9 悠妮` (`slot 1`). **Victory** = **Final Boss `#126 空魔神` (`slot 20`) defeated** (`EV 83` runs `fn_154554(21)` wiping remaining adds); **Defeat** = `#0 索爾` (`slot 0`) OR **`#9 悠妮` (`slot 1`, `dlg[7]`)** dies.

---

## 9. Confirmed Original 1995 `FD2.EXE` Bugs & Intentional `fd2-web` Fixes

See **`docs/ORIGINAL_GAME_BUGS_AND_FIXES.md`** for the full tracking log of every confirmed bug in the 1995 DOS release and the exact intentional fixes made in `fd2-web`:

1. **Multi-Hit (`連擊`) EXP Overwrite & Miss-Zeroing (`fn_60615` & `fn_106354`)**:
   - Original `FD2.EXE` resets `GLOBAL_2_16072 = 0` at the start of every swing and assigns `GLOBAL_2_16072 = strike_exp` (`=`) instead of accumulating (`+=`) — causing non-lethal 2-hit / 3-hit combos to discard earlier hits' EXP, and awarding **`0 EXP`** if Hit 1 dealt heavy damage while Hit 2 missed!
   - **Fixed in `fd2-web`**: Calculates EXP from the **cumulative effective HP removed across all swings** (`defenderStartHp - defender.hp`), or awards **full kill EXP** (`fullKillExp`) when `defender.hp <= 0`.
2. **`#71 魔龍爪` Capped at 2 Hits & Retaliation Multi-Hit Suppressed When Battle Anim Is OFF (`fn_59478` vs `fn_103325`)**:
   - Original `FD2.EXE` `fn_59478` (`@59569..@59599`, Fast Map-Only Combat when Battle Anim is OFF) used a mutually exclusive `if (statusEffect == 3) ... else if (rand <= 3)` branch that skipped the `3%` innate roll for `#71 魔龍爪` (capping it at 2 hits instead of `97%` 2 hits / `3%` 3 hits as in Cutaway `fn_103325`) and called `fn_60615` only once on counterattack without running the multi-hit check.
   - **Fixed in `fd2-web`**: `resolveCombat` uses the unified Cutaway Combat (`fn_103325`) rules regardless of whether animations are ON, Fast, or OFF.
3. **`#121 沼澤怪物` Transparent `FIGANI` Slot 0 (`idle`) Placeholder (`FIGANI.DAT[363]`)**:
   - Original `FIGANI.DAT` chunk `363` is a single `320×200` `0`-opaque-pixel placeholder, while chunk `364` (`attack`) has `5` drawn frames.
   - **Fixed in `fd2-web`**: Extractor skips 0-opaque single-frame `idle` placeholders so `#121` cleanly falls back to `attack` Frame `0` instead of rendering invisible.


---

## 10. Master `FD2.EXE` (`Obj 1`) Inspected Function Reference (`fn_1618` .. `fn_256175`)

> [!IMPORTANT]
> **Calling Convention & Relocation Note**:
> All function offsets `fn_<offset>` below are byte offsets within **`Obj 1`** (the 32-bit flat code segment of `FD2.EXE`, starting at file offset `39,948` / `0x9C0C` and spanning `257,610` bytes).
> Watcom C/C++ 10.0 uses its **`__watcall` register calling convention** for 1 to 4 arguments (passing arguments 1..4 in **`eax`, `edx`, `ebx`, `ecx`**, and any 5th+ arguments on the stack `[esp+4], [esp+8], ...`, callee-popped with `ret N`), or **`__cdecl` stack calling convention** (`[esp+4], [esp+8], ...`, caller-popped) for multi-parameter helpers such as `fn_254016` and `fn_254374`. Return values are always placed in **`eax`** (or `al` / `ax`).

---

### 10.1 Key `Obj 2` (`GLOBAL_2_*`) Runtime State Globals Referenced by Inspected Functions

| Symbol (`Obj 2` Offset) | Type | Exact Purpose in `FD2.EXE` |
| :--- | :--- | :--- |
| `GLOBAL_2_6787` | `uint8` | Tactical Map UI / Cursor Visibility Flag (`1` = normal gameplay cursor active; `0` = hidden during cutscenes/directing) |
| `GLOBAL_2_14860` | `uint32` | Last synchronized DOS BIOS tick counter (`[0x46C]`, `18.2065 Hz` default or `72.8 Hz` when PIT `divisor = 16,384` is active) |
| `GLOBAL_2_14917` | `void*` | Pointer to active 96-slot **Battlefield Unit Array** (`96 × 80 B = 7,680 B`) |
| `GLOBAL_2_14929` | `void*` | Pointer to active **Map Grid Buffer** (`4 B` header `<u16 W, u16 H>` + `W × H × 4 B` cells `[u16 tileId, u8 zocAndEventFlags, u8 pathCost]`) |
| `GLOBAL_2_14953` | `void*` | Pointer to active **Tile Property Buffer** (`FDSHAP.DAT[2*m + 1]`, `N × 4 B` records `[tp[0] flags, tp[1] moveBonusIdx, tp[2] bgTaiId, tp[3] pad]`) |
| `GLOBAL_2_15017`, `15021` | `i32, i32` | Active `13 × 8` (`312×192` px) Camera Viewport Top-Left Tile `(camTopLeftX, camTopLeftY)` |
| `GLOBAL_2_15025`, `15029` | `i32, i32` | Active Map Cursor / Selected Unit Tile Coordinates `(cursorX, cursorY)` |
| `GLOBAL_2_15033`, `15037` | `i32, i32` | AI / Pathfinding Target Destination Coordinates `(destX, destY)` |
| `GLOBAL_2_15041`, `15045` | `i32, i32` | Current Map Dimensions `(mapWidth, mapHeight)` in tiles |
| `GLOBAL_2_15061` | `u8[32]` | 32-Byte Chapter Event / Quest Flag Array (`flag[0..31]`) |
| `GLOBAL_2_15065/69/73` | `i32 × 3` | Dynamic string/number interpolation slots (`0xFFFC` string 1, `0xFFFB` string 2, `0xFFFA` integer) for `fn_24452` |
| `GLOBAL_2_15097` | `uint8` | Combat Animation Toggle (`0` = Full Cutaway `320×200` Battle Stage ON; `1` = Fast Map-Only Combat) |
| `GLOBAL_2_15099` | `uint8` | Walk Fade-Out Counter (`0` = off; `1..63` = increments each walking sub-frame in `fn_13930` to fade palette to black) |
| `GLOBAL_2_15327` | `int32` | Current Battle Turn Number (`1..N`) |
| `GLOBAL_2_15331` | `int32` | `FDFIELD` Header `active_enemy_count` (`urec` count in `FDFIELD[3*m + 1]`) |
| `GLOBAL_2_15335` | `int32` | `FDFIELD` Header `max_deploy` (number of player party deployment slots `0 .. max_deploy - 1`) |
| `GLOBAL_2_15339` | `int32` | Total Populated Battlefield Unit Slots (`numUnits` in `slots[0 .. numUnits - 1]`) |
| `GLOBAL_2_15343` | `int32` | Total Recruited Heroes in Persistent Party (`partyCount` in `party[0 .. 31]`) |
| `GLOBAL_2_15347` | `uint32` | Party Gold (`0 .. 9,999,999 G`) |
| `GLOBAL_2_15351` | `void*` | Pointer to Persistent 32-Slot **Player Party Roster** (`32 × 80 B = 2,560 B`) |
| `GLOBAL_2_15363` | `int32` | Active 0-Based Map / Chapter Index `m` (`0..29` = Chapters `1..30`; `30` = True Ending Epilogue; `31, 32` = Opening Prologue) |
| `GLOBAL_2_15383` | `int32` | Currently Acting Battlefield Unit Slot Index (`activeSlot` in `0 .. numUnits - 1`) |
| `GLOBAL_2_15395/99/15403/07`| `i32 × 4` | AI Magic Evaluator Outputs (`magicScore`, `bestSpellSlot`, `magicTargetX`, `magicTargetY`) |
| `GLOBAL_2_15411/15/19/23`| `i32 × 4` | AI Item Evaluator Outputs (`itemScore`, `bestItemBagSlot`, `itemTargetX`, `itemTargetY`) |
| `GLOBAL_2_15427/31/35/39`| `i32 × 4` | AI Physical Attack Evaluator Outputs (`moveX`, `moveY`, `targetSlot`, `attackScore`) |
| `GLOBAL_2_16072` | `int32` | Pending EXP Awarded to Player Unit by Last Combat / Spell / Item Action (`0..99`, consumed by `fn_58002`) |

---

### 10.2 Chapter Loading, Unit Spawning, Recruitment & Stat Recalculation (`fn_1618` .. `fn_5505`)

| Function | Calling Convention & Input Arguments | Return Value (`eax`) & Side Effects | Exact Behavior Verified in `FD2.EXE` |
| :--- | :--- | :--- | :--- |
| **`fn_1618`** | `void fn_1618(void)`<br>• Reads `GLOBAL_2_15363` (`m`) | `void`<br>• Populates `GLOBAL_2_14929`, `GLOBAL_2_14953`, `GLOBAL_2_14917` | Top-level battlefield map & tileset initializer: loads `FDSHAP.DAT[2*m, 2*m+1]`, calls `fn_2189`, builds `FD2.TMP` icon cache (`fn_4121`), and initializes camera & palette. |
| **`fn_2189`** | `void fn_2189(void)`<br>• Reads `GLOBAL_2_15363` (`m`), `GLOBAL_2_15351` (`party`) | `void`<br>• Writes `GLOBAL_2_15331`, `GLOBAL_2_15335`, `GLOBAL_2_15339`, `GLOBAL_2_15061[0..31]` | Parses `FDFIELD.DAT[3*m .. 3*m+2]`: copies deployed party heroes into `slots[0 .. max_deploy-1]` at `raw_spawns[enemy_cnt : enemy_cnt + max_deploy]` (reserving `slot 6` in `m < 13` if `uid != 2` `#2 鐵諾`), then calls `fn_2894(0)` to spawn all `wave_group == 0` map units. |
| **`fn_2894`** | `int fn_2894(int wave_group)`<br>• **`eax`** = `wave_group` (`0..N`) | **`eax`** = count of units spawned in wave<br>• Appends units to `slots[GLOBAL_2_15339++]` | Iterates `urec[0 .. GLOBAL_2_15331 - 1]` in `FDFIELD[3*m+1]`; for each record with `urec[21] == wave_group`, calls `fn_3152(urec_idx, forced_exact)` to instantiate the unit. |
| **`fn_3152`** | `int fn_3152(int urec_idx, int forced_exact)`<br>• **`eax`** = `urec_idx` (`0 .. enemy_cnt-1`)<br>• **`edx`** = `forced_exact` (`1` = exact spawn coord; `0` = nearest passable free tile by Manhattan dist) | **`eax`** = allocated `slot_idx` in `slots[0..95]`<br>• Writes 80-byte struct at `GLOBAL_2_14917 + 80 * slot_idx` | Instantiates a 26-byte `FDFIELD` `urec` into an 80-byte runtime unit: sets `dir = 0` (`South`), computes stats from `HERO_BASE[uid]` (if `uid < 68` using `lv = urec[4]`) or `ENEMY_CLASS_BASE[uid-68]` (`lv * per_lv`), auto-equips (`0x40`) first weapon & first armor in `urec[5..12]`, copies `ai_chest_idx = urec[2]`, `ai_mode = urec[17]`, `ai_x = urec[18]`, `ai_y = urec[19]`, `drop_type = urec[22]`, `drop_val = urec[23..24]`, and calls `fn_5210`. |
| **`fn_4121`** | `void fn_4121(void)`<br>• Reads `GLOBAL_2_14917`, `GLOBAL_2_15339` | `void`<br>• Writes `FD2.TMP` & updates `unit+9` (`tmp_icon_slot`) | Scans all active units on the map, extracts their required 12-frame `24×24` rows from `FDICON.B24` into `FD2.TMP`, and stores each unit's remapped cache index in `unit+9`. |
| **`fn_4538`** | `int fn_4538(const char *path, int chunk_idx, void *dst_buf)`<br>• **`eax`** = archive filename<br>• **`edx`** = `chunk_idx` (`0..N-1`)<br>• **`ebx`** = destination buffer | **`eax`** = chunk byte length read | Reads chunk `chunk_idx` from an `LLLLLL` archive file (`.DAT`) directly into `dst_buf`. |
| **`fn_4773`** | `int fn_4773(int hero_uid)`<br>• **`eax`** = `hero_uid` (`0..31`) | **`eax`** = new party slot index (`GLOBAL_2_15343 - 1`)<br>• Writes 80-byte struct in `GLOBAL_2_15351` & increments `GLOBAL_2_15343` | Recruits Playable Hero `hero_uid` (`0..31`) into persistent `party`: initializes `level = HERO_BASE[uid].join_level`, `max_hp = base_hp + (lv-1)*G.hp_min`, `max_mp = base_mp + (lv-1)*G.mp_min`, `base_ap = ap + lv*G.ap_min`, `base_dp = dp + lv*G.dp_min`, `base_dx = dx + lv*G.dx_min`, equips starting weapon/armor (`0x40`), learns all spells up to `lv` (`fn_46928`), and calls `fn_5210`. |
| **`fn_5210`** | `void fn_5210(Unit80 *unit)`<br>• **`eax`** = pointer to 80-byte `unit` struct | `void`<br>• Updates `unit+72..79` (`eff_ap, eff_dp, hit, evade`) | Recalculates equipped combat totals: starts from `base_ap (+55)`, `base_dp (+57)`, `base_dx (+62)` and adds `ITEM_TABLE[iid].(ap, dp, hit, ev)` for every inventory slot `0..7` with equipped flag `(unit[10 + 2*i] & 0x40) != 0`. |
| **`fn_5382`** | `void fn_5382(void)`<br>• Reads `GLOBAL_2_14917` (`slots`), `GLOBAL_2_15351` (`party`) | `void`<br>• Syncs `slots` -> `party` & refills HP/MP to 100% | Post-battle party synchronization: for each hero in `party[0 .. partyCount-1]`, finds the matching battlefield slot (`unit+8 == party_unit+8`), copies level, EXP, stats, items, and spells back into `party`, clears status ailments, and restores `hp = max_hp, mp = max_mp`. |

---

### 10.3 Viewport, Camera Scrolling, Map Compositing & Hardware Timing (`fn_6984` .. `fn_14790`, `fn_190564` .. `fn_190729`)

| Function | Calling Convention & Input Arguments | Return Value (`eax`) & Side Effects | Exact Behavior Verified in `FD2.EXE` |
| :--- | :--- | :--- | :--- |
| **`fn_6984`** | `void fn_6984(void)` | `void`<br>• `GLOBAL_2_15017--` | Smoothly pans the `13×8` tactical camera **1 tile West (`Left`)** in `6 × 4 px` sub-steps (`24 px`), redrawing map + units and waiting 1 frame tick per sub-step. |
| **`fn_7075`** | `void fn_7075(void)` | `void`<br>• `GLOBAL_2_15017++` | Smoothly pans the `13×8` tactical camera **1 tile East (`Right`)** in `6 × 4 px` sub-steps. |
| **`fn_7166`** | `void fn_7166(void)` | `void`<br>• `GLOBAL_2_15021--` | Smoothly pans the `13×8` tactical camera **1 tile North (`Up`)** in `6 × 4 px` sub-steps. |
| **`fn_7257`** | `void fn_7257(void)` | `void`<br>• `GLOBAL_2_15021++` | Smoothly pans the `13×8` tactical camera **1 tile South (`Down`)** in `6 × 4 px` sub-steps. |
| **`fn_7340`** | `void fn_7340(int top_left_x, int top_left_y)`<br>• **`eax`** = `top_left_x`<br>• **`edx`** = `top_left_y` | `void`<br>• Sets `GLOBAL_2_15017`, `GLOBAL_2_15021` | Clamps `(top_left_x, top_left_y)` to `[0 .. mapW-13] × [0 .. mapH-8]` and redraws the `13×8` (`312×192` px) tactical viewport into the offscreen buffer. |
| **`fn_7488`** | `void fn_7488(int start_idx, int end_idx, int fade_step)`<br>• **`eax`** = first DAC color (`0`)<br>• **`edx`** = last DAC color (`255`)<br>• **`ebx`** = fade level (`0..63`) | `void`<br>• Programs VGA DAC ports `0x3C8 / 0x3C9` | Scales VGA palette entries `start_idx .. end_idx` by `(63 - fade_step) / 63` toward black (used by screen fades and `GLOBAL_2_15099` walk fade-outs). |
| **`fn_7666`** | `void fn_7666(void)` | `void` | Copies the `320×200` offscreen compositing buffer to VGA physical VRAM (`0xA0000`) after waiting for vertical retrace (`fn_7856`). |
| **`fn_7856`** | `void fn_7856(void)` | `void` | Polls VGA Input Status Register 1 (`port 0x3DA` bit 3 = `0x08`) to synchronize presentation to the **`70.086 Hz` (`14.27 ms`) VGA Vertical Retrace**. |
| **`fn_7918`** | `void fn_7918(void)` | `void` | Main tactical map background tile renderer + 4-step unit idle animation ticker (`[0, 1, 2, 1]` ping-pong walk/idle frame cycle). |
| **`fn_8690`** | `void fn_8690(int tile_x, int tile_y, int screen_x, int screen_y)` | `void` | Blits a single `24×24` terrain tile from `FDSHAP[2*m]` onto the offscreen buffer, checking `tp[0] & 0x08` (`@8776`) for bridge/archway foreground masking. |
| **`fn_8803`** | `void fn_8803(void)`<br>• Reads `GLOBAL_2_15061[0..15]`, `GLOBAL_2_14933 + 131` (`map_change[0..15]`), and `GLOBAL_2_14929` | `void`<br>• Applies dynamic map tile swaps (`new_tile`) & clears `cell[2] &= 0xE0` | **Dynamic Map Tile & Chest State Swapper**: scans the entire map (`y = 0..H-1, x = 0..W-1`); for any cell with `idx = (cell[2] & 0x1F) > 0` where `GLOBAL_2_15061[idx - 1] != 0`, looks up `new_tile = map_change[idx - 1]` (`FDFIELD` control offset `131..162`, `16 × uint16` for `idx = 1..16`). If `new_tile != 0` (e.g. Ch 25 `EV 55` unlocking gate `(10, 0)` from `48 -> 49`, or Ch 26 `EV 61` opening `#31 渥德`'s capsule `(1, 44)/(1, 45)` from `88,90 -> 89,91`), sets `cell.tileId = new_tile`; else if visible chest (`(tp[0] & 0x20) != 0`), increments `cell.tileId += 1`. Clears `cell[2] &= 0xE0` so the trigger/chest is consumed. |
| **`fn_10153` / `fn_10208`**| `void fn_10153(void)` / `void fn_10208(void)` | `void` | Composites all visible battlefield units (`(unit+5 & 1) == 0`), map cursor reticles (`FDICON[136..139]`), and corner micro-HUD (`FDOTHER[5][130]`) over the `13×8` terrain viewport. |
| **`fn_10621`** | `void fn_10621(int slot_idx, int px_x, int px_y)`<br>• **`eax`** = `slot_idx`<br>• **`edx`** = `px_x`<br>• **`ebx`** = `px_y` | `void` | Draws unit `slots[slot_idx]`'s `24×24` sprite (graying palette if `unit+5 & 0x80` acted), then checks `GLOBAL_2_14953` (`@11092`):<br>• If `tp[0] & 0x08` (`@11100`): completely occludes unit under bridge/archway.<br>• Else if `tp[0] & 0x80` (`@11115`): clips the bottom half (`12 px`) of the unit behind the roof ridge / tree canopy overhang! |
| **`fn_11360`** | `int fn_11360(int character_uid)`<br>• **`eax`** = `character_uid` (`0..135`) | **`eax`** = matching `slot_idx` (`0..numUnits-1`), or `-1` if not found | Searches active battlefield units (`(unit+5 & 1) == 0`) for `unit+8 == character_uid` (`identity_uid`) or `unit+7 == character_uid` (`portrait_uid`). Used by `0xFFEE/0xFFEF` dialogues and AI Modes `3` & `9` escort targeting! |
| **`fn_11498`** | `void fn_11498(int target_x, int target_y)`<br>• **`eax`** = `target_x`<br>• **`edx`** = `target_y` | `void`<br>• Scrolls `GLOBAL_2_15017`, `GLOBAL_2_15021` | Smoothly scrolls the `13×8` camera one tile at a time (`fn_6984..7257`) until `(target_x, target_y)` sits inside the inner `[camX+2 .. camX+10] × [camY+2 .. camY+5]` safe zone. |
| **`fn_11832`** | `void fn_11832(int x, int y, uint8 out_tp[4])`<br>• **`eax`** = `x`<br>• **`edx`** = `y`<br>• **`ebx`** = pointer to 4-byte output buffer | `void`<br>• Writes `tp[0..3]` into `out_tp[0..3]` | Looks up `tile_id` at `(x, y)` in `GLOBAL_2_14929` and copies the 4-byte `FDSHAP[2*m+1]` property record (`GLOBAL_2_14953 + 4 * tile_id`) into `out_tp[0..3]`. |
| **`fn_11946` / `12301` / `12677` / `13077`** | `void fn_11946(int slot_idx)` (`South +y`)<br>`void fn_12301(int slot_idx)` (`West -x`)<br>`void fn_12677(int slot_idx)` (`North -y`)<br>`void fn_13077(int slot_idx)` (`East +x`)<br>• **`eax`** = `slot_idx` | `void`<br>• Updates `unit.x / unit.y`, `unit.dir`, and `camX / camY`, then calls **`fn_14916(x, y, 0)`** | 1-tile directional unit walkers: each runs a **6-iteration loop (`4 px` per sub-step = `24 px`)**, scrolling the camera in lockstep if the unit is within 2 tiles of the viewport edge, calling `fn_10153 -> fn_7856 -> fn_13408` on every sub-step, and calling **`fn_14916(unit.x, unit.y, 0)`** upon completing each 1-tile step to fire pass-through tripwire step events (`flag == 0`)! |
| **`fn_13408`** | `void fn_13408(int ticks)`<br>• **`eax`** = tick count (`1..N`) | `void`<br>• Updates `GLOBAL_2_14860` | Frame-rate pacing barrier: loops calling `fn_253900` (water palette animation) until DOS BIOS tick counter `[0x46C]` advances by `ticks` beyond `GLOBAL_2_14860`. |
| **`fn_13448`** | `void fn_13448(int slot_idx, const uint8 *dir_list)`<br>• **`eax`** = `slot_idx`<br>• **`edx`** = `0xFF`-terminated array of directions (`0=S, 1=W, 2=N, 3=E`) | `void`<br>• Moves unit tile-by-tile along `dir_list` | Iterates `dir_list[0..k]` until `0xFF`, dispatching `0 -> fn_11946`, `1 -> fn_12301`, `2 -> fn_12677`, `3 -> fn_13077` for each tile step. |
| **`fn_13540`** | `void fn_13540(void)` | `void`<br>• Sets `unit+3 (dir) = 0` on all active units | Post-action front-view reset: loops across `slots[0 .. GLOBAL_2_15339 - 1]` and resets every unit's facing direction `unit+3 = 0` (`South / Front View`). |
| **`fn_13622`** | `void fn_13622(int faction_id)`<br>• **`eax`** = `faction_id` (`2` = Player, `1` = Ally, `0` = Enemy) | `void`<br>• Clears `unit+5 &= ~0x80` (`acted = false`) for `faction_id` | Per-Faction Acted-Flag Reset: called **before** `fn_43027(phase)` so that any scheduled turn event (`fn_43027`) that intentionally sets `unit+5 \|= 0x80` (`acted = true`, such as Ch 29 `EV 76` channeling on `#9 悠妮` or `EV 79` rotating 2 of the 3 Dragons) is preserved for that phase! |
| **`fn_13789`** | `void fn_13789(int top_left_x, int top_left_y)`<br>• **`eax`** = `top_left_x`<br>• **`edx`** = `top_left_y` | `void`<br>• Pans camera to `(top_left_x, top_left_y)` | Smoothly pans `(GLOBAL_2_15017, GLOBAL_2_15021)` tile-by-tile from its current position to exact `(top_left_x, top_left_y)`. |
| **`fn_13930`** | `void fn_13930(int choreo_id)`<br>• **`eax`** = `choreo_id` (`0..105`) | `void`<br>• Executes multi-actor script from `Obj 3 + 10,200` | Multi-Actor Choreography VM: executes simultaneous multi-unit walks (`6 × 4 px` sub-steps per tile, fading screen if `GLOBAL_2_15099 > 0`), `-17 px` startled jump-hops (`step_byte == 0x80`), and synchronized facing pauses. |
| **`fn_14916`** | `void __cdecl fn_14916(int x, int y, int mode)`<br>• Stack `[esp+4]` = `x`, `[esp+8]` = `y`, `[esp+12]` = `mode` (`0` = pass-through step during walk; `1` = final stop-on tile at end of turn) | `void`<br>• Fires matching `stepEvents` via `GLOBAL_2_7057[eventId](slot_idx)` | **Step-Tile Event Tripwire & Stop-On Dispatcher**: checks `(tp[0] & 0x60) == 0` (not a chest) and `trig_idx = cell[2] & 0x1F` (`1..16`). Scans `FDFIELD` `step_ev[0..6]` (`35 + 3*i`) for `step_ev.triggerIndex == trig_idx` and **`step_ev.flag == mode`**:<br>• **`mode == 0` (`flag == 0` pass-through tripwire)**: called at every tile stepped across during `fn_11946..13077` (`Ch 7 EV 26`, `Ch 14 EV 10`, `Ch 26 EV 59/60`, `Ch 27 EV 62/84`, `Ch 28 EV 65/69`).<br>• **`mode == 1` (`flag == 1` stop-on tile)**: called at `(unit.x, unit.y)` after action commits (`fn_34960 @35512`: `Ch 13 EV 8`, `Ch 25 EV 55`, `Ch 26 EV 61`, `Ch 29 EV 75`, `Ch 30 EV 80`). |
| **`fn_190564` / `190612` / `190729`** | `void fn_190564(void)` (init INT 08h)<br>`void fn_190612(uint16 divisor)` (`eax = 16384`)<br>`void fn_190729(void)` (restore PIT) | `void`<br>• Programs 8253 PIT port `0x43 / 0x40` | Reprograms DOS system timer (8253 PIT Channel 0) with divisor `16,384` (`0x4000`, `4×` base `18.2065 Hz` = `72.826 Hz`) during active sound/music playback and chains original BIOS `INT 08h` every 4th interrupt. |

---

### 10.4 Tactical AI Controller, 3-Way Action Arbiter & Pathfinding (`fn_15007` .. `fn_24300`, `fn_254016`, `fn_254374`)

| Function | Calling Convention & Input Arguments | Return Value (`eax`) & Side Effects | Exact Behavior Verified in `FD2.EXE` |
| :--- | :--- | :--- | :--- |
| **`fn_15007`** | `void fn_15007(int slot_idx, int side_flag)`<br>• **`eax`** = `slot_idx` (`0..numUnits-1`)<br>• **`edx`** = `side_flag` (`0` = Enemy Phase; `1` = Ally Phase / Player Auto-AI) | `void`<br>• Executes full AI turn for `slots[slot_idx]`, sets `unit+5 \|= 0x80`, calls `fn_13540` | Master AI Controller for all 12 AI modes (`mode = unit[52] & 0x3F = 0..11`):<br>• Modes `0, 1, 2, 3, 5, 10`: calls `fn_20208(slot_idx, side_flag)` for 3-way Item/Magic/Attack decision.<br>• Mode `4`: non-combat march/flee via `fn_19320(slot_idx, unit[53], unit[54])`.<br>• Mode `5`: pathfinds to chest `unit[61]`, opens tile (`fn_8803`), calls **`fn_48012`** (`@15608`) to add item to `unit.items` (`unit+10..25`) and set `unit.drop` (`unit+49..51`), switches `unit[52] = 7`.<br>• Mode `7`: retreats to `(unit[53], unit[54])` and vanishes via `fn_141685`.<br>• Modes `6, 8`: passive/immobile.<br>• **Mode `11` (`@15881..15954`, `#126 空魔神`)**: first casts magic from current tile (`fn_22922 -> fn_21265`) and **in the very same turn** executes physical attack (`fn_16951 -> fn_21646`) or advances (`fn_16673`).<br>• Calls `fn_16340(slot_idx)` at turn end for `+20%` MaxHP rest heal if unmoved & unacted. |
| **`fn_16028`** | `void fn_16028(int slot_idx, int side_flag)`<br>• **`eax`** = `slot_idx`<br>• **`edx`** = `side_flag` | `void`<br>• Moves unit toward nearest hostile unit | Mode `0` fallback pursuit: finds nearest hostile combatant (`fn_18231`) and calls `fn_19320(slot_idx, target.x, target.y)` to march toward them. |
| **`fn_16340`** | `void fn_16340(int slot_idx)`<br>• **`eax`** = `slot_idx` | `void`<br>• Restores `unit.hp += max_hp // 5` | Idle Rest Healing: if `slots[slot_idx]` did not move and did not act this turn, has `0 < hp < max_hp`, and is neither poisoned (`unit+36 == 0`) nor paralyzed (`unit+37 == 0`), plays `FDOTHER[9]` sparkles and heals `20%` MaxHP. |
| **`fn_16673`** | `int fn_16673(int slot_idx, int side_flag)`<br>• **`eax`** = `slot_idx`<br>• **`edx`** = `side_flag` | **`eax`** = `1` if moved/engaged, `0` otherwise | Proximity engagement helper for Modes `1, 3, 10, 11`: checks if any opponent is within extended engagement range (`fn_17107`) and advances/attacks (`fn_21646`). |
| **`fn_16951`** | `int fn_16951(int slot_idx, int side_flag)`<br>• **`eax`** = `slot_idx`<br>• **`edx`** = `side_flag` | **`eax`** = best physical `attackScore` (`GLOBAL_2_15439`)<br>• Writes `GLOBAL_2_15427..15439` (`moveX, moveY, targetSlot, attackScore`) | AI Physical Attack Evaluator: floods reachable tiles (`fn_17107`, or current tile only if Mode `2`), checks equipped weapon `[minRange..maxRange]` (`fn_47165`), estimates damage against every reachable hostile unit, and scores **`8`** for non-lethal hit or **`18`** for lethal kill (`damage >= target.hp`). |
| **`fn_17107`** | `void fn_17107(int slot_idx, int side_flag, int mv_override)`<br>• **`eax`** = `slot_idx`<br>• **`edx`** = `side_flag`<br>• **`ebx`** = `mv_override` (`0` = use `unit.mv`) | `void`<br>• Populates `cell[3]` (`pathCost`) in `GLOBAL_2_14929` | Computes AI unit's reachable movement grid: selects `GLOBAL_3_5702` row (`row 19` if `fn_61827 != 0`, `row 1` if `class == 28 && uid == 28`), marks hostile occupancy & ZOC (`fn_17869(side_flag)`), runs `fn_254016`, and marks friendly-occupied tiles `0xFF` via `fn_18129`. |
| **`fn_17869`** | `void fn_17869(int side_flag)`<br>• **`eax`** = `side_flag` (`0` = Enemy is friendly / Player+Ally are hostile; `1` = Player+Ally are friendly / Enemy is hostile) | `void`<br>• Sets `0x40` (occupied) and `0x80` (4-neighbor ZOC) in `cell[2]` of `GLOBAL_2_14929` | Zone-of-Control & Hostile Occupancy Marker: iterates all active units (`(unit+5 & 1) == 0`); **skips friendly units completely** (so friendly units never block passing through and never exert ZOC on same-side phases), and writes `0x40` on hostile unit tiles plus `0x80` on their 4 orthogonal neighbors (if non-flying). |
| **`fn_18129`** | `void fn_18129(int self_slot_idx)`<br>• **`eax`** = `self_slot_idx` | `void`<br>• Sets `cell[3] = 0xFF` on all other units' tiles | Post-flood stop-exclusion marker: runs **after** `fn_254016` so the moving unit can walk *through* friendly units during path reconstruction (`fn_254374`) but cannot *stop* on an occupied tile. |
| **`fn_19222`** | `void fn_19222(const uint8 *dir_list, int max_mv, int *out_x, int *out_y)`<br>• **`eax`** = `dir_list`<br>• **`edx`** = `max_mv`<br>• **`ebx`** = `out_x`<br>• **`ecx`** = `out_y` | `void`<br>• Writes ideal waypoint `(subX, subY)` into `*out_x, *out_y` | Traces up to `max_mv` steps along the full ideal `fn_254374` direction list from `(startX, startY)` to determine the sub-goal waypoint `(subX, subY)` for `fn_19320`. |
| **`fn_19320`** | `int fn_19320(int slot_idx, int goal_x, int goal_y)`<br>• **`eax`** = `slot_idx`<br>• **`edx`** = `goal_x`<br>• **`ebx`** = `goal_y` | **`eax`** = `1` if moved, `0` if stayed<br>• Walks unit along chosen path via `fn_13448` | Long-range AI pathfinder toward `(goal_x, goal_y)`:<br>1. Runs `fn_254016` with `mv = 250` (`@19632`) and traces proportional diagonal path `fn_254374` (`@19581`) + `fn_19222` (`@19865`) to get `(subX, subY)`.<br>2. Runs `fn_254016` with actual `unit.mv` (`@19811`) + `fn_18129` (`@19843`).<br>3. If `(subX, subY)` is reachable & unoccupied, moves there; else picks reachable tile minimizing `(|x - subX| + |y - subY|) * 100 + 5 * ||x - subX| - |y - subY||` (`@19950..20014`). |
| **`fn_20208`** | `int fn_20208(int slot_idx, int side_flag)`<br>• **`eax`** = `slot_idx`<br>• **`edx`** = `side_flag` | **`eax`** = `1` if action executed, `0` if all scores `< 4` | **Master 3-Way AI Action Arbiter**:<br>1. Calls `fn_22142(slot_idx)` -> `itemScore` (`GLOBAL_2_15411`).<br>2. Calls `fn_22922(slot_idx)` -> `magicScore` (`GLOBAL_2_15395`).<br>3. Calls `fn_16951(slot_idx, side_flag)` -> `attackScore` (`GLOBAL_2_15439`).<br>4. Applies `0x80` self-heal `×3` multiplier (`@20302`).<br>5. If `max(itemScore, magicScore, attackScore) < 4` (`<= 3`), returns `0`; else executes the highest-scoring action (`fn_20565` for item/magic or `fn_21646` for physical attack). |
| **`fn_20565`** | `void fn_20565(int slot_idx, int action_kind)`<br>• **`eax`** = `slot_idx`<br>• **`edx`** = `action_kind` (`0` = Magic Spell from `GLOBAL_2_15399..15407`; `1` = Usable Item from `GLOBAL_2_15415..15423`) | `void`<br>• Executes AI spell or item, consumes single-use item (`fn_48169`), calls `fn_13540` | AI Magic & Item Executor: centers camera on caster/user (`fn_11498`), displays top notice banner (`fn_28783`: spell name or item name), routes `action_kind == 1` to `fn_68719` (`useEffect 5/13` heal) or `fn_21265` (`useEffect 20..23` item-cast spell), removes consumed item (`useEffect == 5`) via `fn_48169`, and resets facings (`fn_13540`). |
| **`fn_21265`** | `void fn_21265(int caster_slot, int spell_id, int target_x, int target_y)`<br>• **`eax`** = `caster_slot`<br>• **`edx`** = `spell_id` (`0..35`)<br>• **`ebx`** = `target_x`<br>• **`ecx`** = `target_y` | `void`<br>• Deducts MP, runs cutaway/map spell, calls `fn_56165 -> fn_43549 -> fn_58002` | Core Spell Execution Pipeline (shared by Player & AI): collects targets in `spell.aoe` around `(target_x, target_y)`, routes cutaway spells (`0..9, 24, 28..35`) to `fn_108221 / fn_98249`, earthquakes (`10..12`) to `fn_70984`, and support/heal spells (`13..22, 25..27`) to `fn_50380` + `fn_57176` bouncing digits, then runs death spin (`fn_56165`), drops (`fn_43549`), and EXP/level-up (`fn_58002`). |
| **`fn_21646`** | `void fn_21646(int attacker_slot)`<br>• **`eax`** = `attacker_slot`<br>• Reads `GLOBAL_2_15427..15435` (`moveX, moveY, targetSlot`) | `void`<br>• Walks to `(moveX, moveY)`, runs duel, calls `fn_56165 -> fn_43549 -> fn_58002 -> fn_13540` | AI Physical Attack Executor: walks `slots[attacker_slot]` to `(GLOBAL_2_15427, GLOBAL_2_15431)` if not already there, faces `targetSlot`, runs Cutaway (`fn_100972`) or Fast Map Combat (`fn_59478`), plays death spin/explosion (`fn_56165`), awards drops/EXP (`fn_43549`, `fn_58002`), and resets all facings to front view (`fn_13540`). |
| **`fn_22142`** | `int fn_22142(int slot_idx)`<br>• **`eax`** = `slot_idx` | **`eax`** = best `itemScore` (`GLOBAL_2_15411`)<br>• Writes `GLOBAL_2_15411..15423` | AI Usable Item Evaluator: scans `unit.items[0..7]` for `useEffect in (5, 13)` (`fn_22656`: `#192..195`, `#102 修理套件` `useRange=4, useAoe=2`, staves `#40, 58, 61`) and `useEffect in (20, 21)` (`fn_23415`: spell-casting weapons `#11, 29, 38, 51, 56, 60, 99`). Evaluates targets within `useRange` (`rec[16]`) + `useAoe` (`rec[18]`) from `(unit.x, unit.y)`. |
| **`fn_22656`** | `int fn_22656(int user_slot, int target_slot, int item_id)`<br>• **`eax`** = `user_slot`<br>• **`edx`** = `target_slot`<br>• **`ebx`** = `item_id` | **`eax`** = single-target heal score (`0, 3, 8, 9, 24`) | Scores healing `slots[target_slot]` with `item_id`: returns `0` if `hp > max_hp // 2`, `3` if `max_hp // 3 < hp <= max_hp // 2`, or `8` if `hp <= max_hp // 3`. If `user_slot == target_slot` and `(user.ai_mode & 0x80) != 0` (`@22739`), multiplies score by **`3`** (`3 -> 9`, `8 -> 24`). |
| **`fn_22922`** | `int fn_22922(int slot_idx)`<br>• **`eax`** = `slot_idx` | **`eax`** = best `magicScore` (`GLOBAL_2_15395`)<br>• Writes `GLOBAL_2_15395..15407` | AI Magic Spell Evaluator: if `unit.silenceTurns == 0`, iterates learned spells (`unit+26..29` bitmask) with `mp_cost <= unit.mp` and evaluates every aim tile within `castRange` via `fn_23415`. |
| **`fn_23415`** | `int fn_23415(int caster_slot, int spell_id, int aim_x, int aim_y)`<br>• **`eax`** = `caster_slot`<br>• **`edx`** = `spell_id`<br>• **`ebx`** = `aim_x`<br>• **`ecx`** = `aim_y` | **`eax`** = total AoE score for casting `spell_id` at `(aim_x, aim_y)` | Sums per-target spell scores across `spell.aoe`:<br>• Healing (`13..16`): `3` (`33% < hp <= 50%`) or `8` (`hp <= 33%`), `×3` on self if `0x80`.<br>• Buff/Debuff (`17..22, 25..27`): `6` per valid un-buffed/un-debuffed target.<br>• Offensive (`0..12, 24, 28..35`): `24` per hostile target hit. |
| **`fn_254016`** | `void __cdecl fn_254016(void *grid_buf, const uint8 *move_cost_row, void *tprop_buf, int start_x, int start_y, int max_mv, int zoc_mode)`<br>• Stack `[esp+4..28]` (`7 × int32`) | `void`<br>• Writes remaining MV (`0..max_mv`, or `0xFF` unreachable) into `cell[3]` of `grid_buf` | Native Shortest-Path / Reachability Flood-Fill: expands from `(start_x, start_y)` with `rem_mv = max_mv`. For each neighbor `(nx, ny)`: blocks if `(cell[2] & 0x40) != 0` (hostile unit) or `step_cost = move_cost_row[tprop[tile_id].b1] >= 20` (`tp[1] in (1, 5)`). If `(cell[2] & 0x80) != 0` (hostile ZOC) and `rem_mv >= step_cost`, clamps `next_rem_mv = 0`. |
| **`fn_254374`** | `int __cdecl fn_254374(void *grid_buf, const uint8 *move_cost_row, void *tprop_buf, int start_x, int start_y, int dest_x, int dest_y, uint8 *out_dirs)`<br>• Stack `[esp+4..32]` (`8 × int32`) | **`eax`** = path step count<br>• Writes `0xFF`-terminated direction sequence (`0=S, 1=W, 2=N, 3=E`) into `out_dirs` | Native Walk Path Reconstructor: backtracks from `(dest_x, dest_y)` to `(start_x, start_y)` across `cell[3]`, using a **proportional `dx / dy` accumulator** so diagonal paths alternate orthogonal steps smoothly (`[3, 2, 3, 2]`) rather than wall-hugging L-shapes, with `East (3) -> North (2) -> West (1) -> South (0)` tie-break order. |

---

### 10.5 Dialogue Bytecode VM, 4-Way Cross Menu & Battlefield Player Loop (`fn_24452` .. `fn_42800`)

| Function | Calling Convention & Input Arguments | Return Value (`eax`) & Side Effects | Exact Behavior Verified in `FD2.EXE` |
| :--- | :--- | :--- | :--- |
| **`fn_24452`** | `void fn_24452(int bank_idx, int dialogue_idx)`<br>• **`eax`** = `bank_idx` (`1..33` into `FDTXT.DAT`)<br>• **`edx`** = `dialogue_idx` (`0..N-1`) | `void`<br>• Scrolls camera to speakers (`fn_11498`), renders `DATO` portraits & `FDOTHER[4]` glyphs | Chapter Dialogue Bytecode Interpreter: executes `int16` opcodes (`-1` end, `-2` newline, `-3` pause/clear, `-4/-5/-6` interpolate `GLOBAL_2_15065..15073`, `-17/-18` top/bottom box by character `uid` via `fn_11360`, `-19/-20` top/bottom box by direct `slots[slot]` index via `fn_26028`). |
| **`fn_26028`** | `void fn_26028(int portrait_uid, int box_pos, int slot_or_uid)`<br>• **`eax`** = `portrait_uid` (`0..135`)<br>• **`edx`** = `box_pos` (`0` = Top, `1` = Bottom) | `void` | Scrolls camera to speaker (`fn_11498`), opens parchment dialogue box, decodes `DATO.DAT[portrait_uid]` (`strict > 0xC0` PCX-RLE), and animates blinking eyes & talking mouth patches while text prints. |
| **`fn_28783`** | `void fn_28783(const uint16 *glyph_str, int duration_ticks)`<br>• **`eax`** = `0xFFFF`-terminated glyph array | `void` | Renders a centered top-of-screen notification banner (used for spell names, item names, turn headers, and treasure notifications). |
| **`fn_29724`** | `int fn_29724(const uint8 icon_ids[4], const uint8 disabled_mask[4])`<br>• **`eax`** = 4-icon array `[Top, Left, Right, Bottom]`<br>• **`edx`** = disabled flags `[0/1 × 4]` | **`eax`** = selected arm (`0=Top, 1=Left, 2=Right, 3=Bottom`, or `-1` on Esc / Right-Click cancel) | Authentic 4-Way Cross Menu (`十字選單`, `FDOTHER[2]`): animates the 4 `24×20` arms expanding outward by `6 px × 4` steps around the `24×24` center tile, handles arrow/mouse selection, and animates contraction. |
| **`fn_34960`** | `void fn_34960(int slot_idx)`<br>• **`eax`** = `slot_idx` (`0..numUnits-1`) | `void`<br>• Handles player unit move, undo, & action cross menu | Player Unit Turn Controller:<br>1. Computes reachable tiles (`fn_61827 -> fn_17869(1) -> fn_254016 -> fn_18129`).<br>2. When player selects destination `(dx, dy)`, walks unit via `fn_254374 -> fn_13448`.<br>3. Sets `disableMagic = 1` if `moved` (`steps > 0`) **unless `unit.portraitUid in (18, 19, 34)`** (`@35423..35458`: Sword Saints `#18 蜜蒂, #19 羅德曼, #34 鐵諾` are the **only** units in `FD2.EXE` that can move and cast spells/techniques in the same turn!).<br>4. Opens Unit Action Cross (`fn_36236(&out_var, did_move, slot_idx, disableMagic)`); if cancelled (`Right-Click / Esc`), snaps unit back to `(origX, origY, origDir)`; if committed, sets `unit+5 \|= 0x80` and calls `fn_13540()`. |
| **`fn_36236`** | `int __cdecl fn_36236(int *out_var, int did_move, int slot_idx, int disable_magic)`<br>• Stack `[esp+4..16]` (`4 × int32`) | **`eax`** = `1` if action committed, `0` if cancelled (undo move) | Unit Action Cross Menu (`[0 攻擊, 1 法術, 2 道具, 3 休息]`): disables arm `1` (`fn_53232`) when `disable_magic == 1` or `unit.silenceTurns > 0` or no castable spells exist; checks weapon targets in range, item sub-cross (`[8 使用, 9 交換, 10 裝備, 11 丟棄]`), and Rest / Treasure Chest pickup (`fn_37036`). |
| **`fn_37036`** | `void fn_37036(int slot_idx)`<br>• **`eax`** = `slot_idx` | `void`<br>• Awards chest item/gold/event, calls `fn_8803` | Player Treasure Chest & Hidden Ground Item Handler: checks `fn_11832(unit.x, unit.y, tp)`; if `(tp[0] & 0x60) != 0` and `0 <= event_id <= 15`, prompts to open chest (`0x20`) or pick up hidden item (`0x40`). If 8-slot bag is full, prompts to swap an item from bag into the chest! |
| **`fn_38251`** | `void fn_38251(int building_npc_uid)`<br>• **`eax`** = `128..132` or `75` | `void` | Renders & animates Town Shopkeeper / Cleric (`#128..#132`) or `#75 米蘭` `80×80` portrait at `(x=216, y=14)` (`vram + 4696`) using hardcoded blink patch offsets. |
| **`fn_40826`** | `int fn_40826(int save_or_load, int slot_idx)`<br>• **`eax`** = `0` (Save) or `1` (Load)<br>• **`edx`** = `0` (Battlefield) or `1..4` (Camp slots) | **`eax`** = `1` on success, `0` on checksum/IO error | Reads or writes the `22,987`-byte `FD2.SAV` file and verifies/updates the additive+XOR integrity checksum via `fn_252888`. |
| **`fn_42150` .. `fn_42936`** | `void fn_42150(void)` | `void`<br>• Drives full Battle Turn & Phase Loop (`1 -> 0 -> turn++ -> 2`) | **Master Battle Phase & Turn Transition Loop**:<br>1. **Ally Phase (`phase == 1`, `turn == T`)**: `fn_13622(1)` (reset Ally acted) -> `fn_43027(1)` (run `phase == 1` turn events) -> `fn_55307()` (`fn_43110(1)` Ally poison/status tick + Ally AI loop).<br>2. **Enemy Phase (`phase == 0`, `turn == T`)**: `fn_13622(0)` (reset Enemy acted) -> `fn_43027(0)` (run `phase == 0` turn events, preserving `acted` flags set by events like `EV 79`) -> `fn_55482()` (`fn_43110(0)` Enemy poison/status tick + Enemy AI loop).<br>3. **Next Turn Player Phase (`turn = T + 1`, `phase == 2`)**: increments `turn += 1`, calls `fn_13622(2)` (reset Player acted) **before** `fn_43027(2)` (so `EV 76` channeling on `#9 悠妮` preserves `yuni.acted = true`), then runs `fn_43110(2)` (Player poison/status tick). |
| **`fn_43027`** | `void __cdecl fn_43027(int target_phase)`<br>• Stack `[esp+4]` = `target_phase` (`1` = Ally Phase, `0` = Enemy Phase, `2` = Player Phase) | `void`<br>• Dispatches matching `turnEvents` via `GLOBAL_2_7057[eventId]()` | **Scheduled Turn-Event Phase Dispatcher**: scans `FDFIELD` `turn_ev[0..15]` (`offset 3..50`, `16 × 3 B [turn, eventId, phase]`); for every entry with `te.turn == current_turn` (`< 255`) and `te.phase == target_phase`, invokes `GLOBAL_2_7057[te.eventId]()`. |

---

### 10.6 Status Tick, Spoils, Inventory Helpers & On-Map Spell / Item Execution (`fn_43110` .. `fn_51800`, `fn_68719`, `fn_70984`)

| Function | Calling Convention & Input Arguments | Return Value (`eax`) & Side Effects | Exact Behavior Verified in `FD2.EXE` |
| :--- | :--- | :--- | :--- |
| **`fn_43110`** | `void fn_43110(int faction_id)`<br>• **`eax`** = `faction_id` (`2` = Player, `1` = Ally, `0` = Enemy) | `void`<br>• Decrements status timers, applies lethal `10%` poison tick, calls `fn_56165` | Start-of-Phase Status & Poison Ticker: scans all active units with `unit.faction == faction_id`, decrements `unit+34..39` timers, deals **`max(1, max_hp // 10)` lethal poison damage** (can reach `0 HP`!), and immediately calls `fn_56165()` to spin & explode any unit killed by poison. |
| **`fn_43549`** | `void fn_43549(int killer_slot)`<br>• **`eax`** = `killer_slot` | `void`<br>• Awards enemy `drop_type` (`0`=item, `1`=gold, `2`=EV event, `3`=FDTXT dialogue) | Post-Action Enemy Spoils & Death Event Processor: checks defeated units (`hp == 0`); awards dropped Item (with full-bag swap prompt if killer is Player) or Gold, or triggers scripted mid-battle event (`drop_type == 2 -> fn_67450`) or dying dialogue (`drop_type == 3 -> fn_24452`). |
| **`fn_46928`** | `void fn_46928(Unit80 *unit)`<br>• **`eax`** = pointer to 80-byte `unit` | `void`<br>• Updates `unit+26..29` (`spell_mask`) | Checks `GROWTH_TABLE[unit.portraitUid].spellListId` (`0..19`); unlocks every `(req_level, spell_id)` entry in `GLOBAL_3_9907[spellListId]` where `req_level <= unit.level`. |
| **`fn_47165`** | `int fn_47165(const Unit80 *unit, int equip_kind)`<br>• **`eax`** = pointer to 80-byte `unit`<br>• **`edx`** = `0` (Weapon `itemType 0..20`) or `1` (Armor `itemType 21..31`) | **`eax`** = equipped inventory bag index (`0..7`), or `-1` if none equipped | Scans `unit.inventory[0..7]` (`unit+10..25`) for a slot with equipped flag `(flags & 0x40) != 0` matching `equip_kind` (does NOT filter against `GLOBAL_3_6282`, allowing enemies/turrets to use their map-assigned weapons!). |
| **`fn_48012`** | `int fn_48012(Unit80 *unit, int item_id)`<br>• **`eax`** = pointer to 80-byte `unit`<br>• **`edx`** = `item_id` (`0..214`) | **`eax`** = bag slot index (`0..7`) written, or `-1` if all 8 slots full | Appends `item_id` (unequipped `flags = 0x00`) into the first empty slot (`flags & 0x80`) of `unit.inventory[0..7]`. Called when a unit receives an item or when a **Mode `5` Treasure Thief** loots an item chest (`fn_15007 @15608`)! |
| **`fn_48169`** | `void fn_48169(Unit80 *unit, int bag_slot)`<br>• **`eax`** = pointer to 80-byte `unit`<br>• **`edx`** = `bag_slot` (`0..7`) | `void`<br>• Removes item at `bag_slot` and compacts `inventory[0..7]` | Deletes `unit.inventory[bag_slot]`, shifts subsequent inventory items down so no gaps remain, marks trailing slot empty (`0x80, 0xFF`), and calls `fn_5210(unit)`. |
| **`fn_49602`** | `int fn_49602(const Unit80 *unit, int item_id)`<br>• **`eax`** = pointer to 80-byte `unit`<br>• **`edx`** = `item_id` (`0..214`) | **`eax`** = `1` if class can equip `item_id`, `0` otherwise | Checks if `ITEM_TABLE[item_id].itemType` is present in `GLOBAL_3_6282[unit.classId][0..6]`. Called **only** by Player Equip UI (`fn_49149` battlefield & `fn_127151` camp/shop). |
| **`fn_49696`** | `int fn_49696(int item_id)`<br>• **`eax`** = `item_id` (`0..214`) | **`eax`** = `1` if placed in a party hero's bag, `0` if all party bags full | Grants a story/reward item (`#198 力量藥水` in Ch 2, `#100 天空之鑰` in Ch 21, etc.) to the first party member with an open inventory slot via `fn_48012`. |
| **`fn_50380`** | `void fn_50380(int spell_id)`<br>• **`eax`** = `spell_id` (`0..32`) | `void` | On-Map Spell Animation Player: looks up `start = GLOBAL_2_7987[spell_id]`, `count = GLOBAL_2_8020[spell_id]`, `sfx = GLOBAL_2_8053[spell_id]`, and plays `FDOTHER[6][start .. start+count-1]` over all target tiles on the map. |
| **`fn_51231` / `fn_51478`** | `void fn_51231(int caster_slot, int target_slot, int dmg)`<br>`void fn_51478(int caster_slot, int target_slot, int coeff_or_healed)` | `void`<br>• Accumulates EXP into `GLOBAL_2_16072` (skipped when `is_from_item == 1`) | Computes offensive magic EXP (`fn_51231`) and healing/support magic EXP (`fn_51478`), adding `+30` to `eff_lv` for promoted classes (`9..24`) and `#28 達克塞`:<br>• Healing (`#13..16, #33`): `((40 * target_eff_lv) // caster_eff_lv) * actual_healed // target_max_hp`.<br>• `#17 魔刃術, #18 魔鎧術, #19 風行術`: `(2 * target_eff_lv) // caster_eff_lv` per target.<br>• `#20 解毒術, #21 祛麻術`: `((40 * target_eff_lv) // caster_eff_lv) * actual_healed // target_max_hp` (heals `+9 HP`!).<br>• `#23 傳送術`: `(10 * target_eff_lv) // caster_eff_lv`.<br>• `#25 行動術`: `(8 * target_eff_lv) // caster_eff_lv`.<br>• `#34 破壞神`: `(6 * target_eff_lv) // caster_eff_lv` per target. |
| **`fn_68719` & `GLOBAL_2_7425[0..35]`** | `void fn_68719(int user_slot, int bag_slot, int target_x, int target_y)`<br>• **`eax`** = `user_slot`<br>• **`edx`** = `bag_slot` (`0..7`)<br>• **`ebx`** = `target_x`<br>• **`ecx`** = `target_y`<br>• Dispatches `GLOBAL_2_7425[0..35]` (`fn_75498..fn_77377`) | `void`<br>• Applies spell or item effect across `aoe`, plays `fn_50380` & `fn_57176` | **Unified Spell & Item Effect Table (`GLOBAL_2_7425[0..35]`)**:<br>• Item `useEffect` (`rec[13]`): `5/13` = HP heal `+useVal` (`#102 修理套件 +500`, `#192..195`, `#40, #58, #61, #211`), `6` = cure poison (`#196`), `7` = cure paralysis (`#197`), `8..10/17..19` = permanent stat boosts (`#198 +9 AP, #199 +9 DP, #200 +7 DX, #94 +20 HP, #95 +20 MP, #96 +1 MV`), `11` = MP restore (`#206 +80, #207 +200`), `12` = `#19 風行術` (`#210 星之眼`), `14` = `#27 麻痹術` (`#212 暗之眼`), `15` = `#18 魔鎧術` (`#213 冰之眼`), `16` = `#17 魔刃術` (`#214 火之眼`), `20` = fire spell `useVal` (`#56/#11/#60`), `21` = lightning spell (`#38/#29/#51/#99`), `22` = `#22 封咒術` (`#57`), `23` = `#23 傳送術` (`#101`), `24` = `#3 天火術` (`#79 光束砲` range 15, AoE 4).<br>• **Item-cast spells (`is_from_item == 1`) consume `0 MP` and award `0 EXP`!** |
| **`fn_70984`** | `void fn_70984(int caster_slot, int spell_id, int aim_x, int aim_y)` | `void` | Earthquake Spell Executor (`10 碎岩術, 11 地震術, 12 裂地術`): shakes tactical viewport (`fn_62808`), automatically misses flying units (`fn_61827 != 0`), deals spell damage (`fn_74814`) to ground enemies in radius `5`, and pops bouncing damage digits (`fn_57176`). |
| **`fn_74122` (`GLOBAL_2_7425[23]`)** | `int fn_74122(int caster_slot, int target_slot, int is_from_item)`<br>• **`eax`** = `caster_slot`<br>• **`edx`** = `target_slot` (`dist 0..1` for spell `#23 傳送術`; `dist == 1` only for `#101 傳送法杖`) | **`eax`** = `1` if destination committed, `0` if cancelled | **Two-Step Map-Wide Teleport Handler (`#23 傳送術` & `#101 傳送法杖`)**:<br>1. **Step 1**: `#23 傳送術` (pre-move only) selects self or adjacent ally (`dist 0..1`); `#101 傳送法杖` (usable after moving!) selects adjacent ally only (`dist == 1`).<br>2. **Step 2**: Prompts player to select any unoccupied passable map tile (`stepCost < 20`), plays `FDOTHER[6]` teleport beam (`fn_50380(23)`) at origin, moves `slots[target_slot]` to `(destX, destY)`, plays arrival sparkles (`fn_141685 / fn_50380`), and awards `(10 * target_eff_lv) // caster_eff_lv` EXP (for `#23 傳送術`; `0 EXP` for `#101 傳送法杖`). |
| **`fn_74764` (`#34 破壞神`)** | `void fn_74764(int caster_slot, int target_slot)`<br>• **`eax`** = `caster_slot`<br>• **`edx`** = `target_slot` | `void`<br>• Applies all 3 buffs (`unit+34, +35, +36`) for `2..4` turns | **Summon Spirit `#34 破壞神` (`GLOBAL_2_7425[34]`)**: calls `fn_76589` (`#17 魔刃術`, `unit+34 = rand(2..4)` `+15% AP`), `fn_76708` (`#18 魔鎧術`, `unit+35 = rand(2..4)` `+15% DP`), and `fn_76387` (`#19 風行術`, `unit+36 = rand(2..4)` `+15 HIT & +15 EV`) on every ally in radius `3`, and awards `(6 * target_eff_lv) // caster_eff_lv` EXP per target. |
| **`fn_74789` (`#35 暗邪鬼`)** | `void fn_74789(int caster_slot, int target_slot)`<br>• **`eax`** = `caster_slot`<br>• **`edx`** = `target_slot` | `void`<br>• On `50%` hit roll, applies all 3 status ailments (`unit+37, +38, +39`) for `2..4` turns + `9` HP dmg | **Summon Spirit `#35 暗邪鬼` (`GLOBAL_2_7425[35]`)**: on hit (`spell.hit = 50%`), calls `fn_76505` (`#27 麻痹術`, `unit+37 = rand(2..4)`), `fn_76994` (`#22 封咒術`, `unit+38 = rand(2..4)`), and `fn_76870` (`#26 毒擊術`, `unit+39 = rand(2..4)`), plus deals `9` HP damage and awards combat EXP (`fn_51231`). |
| **`fn_74814`** | `int fn_74814(int caster_slot, int target_slot, int base_power)` | **`eax`** = spell damage dealt | Offensive Spell Damage Calculator (`#0..#12, #31, #32`): scales `base_power` by `GLOBAL_2_8086[target.classId]` tenths (`10 = 100%, 7 = 70%, 5 = 50%, 4 = 40%`), then rolls `fn_256147(90, 100)%`. |
| **`fn_75498` .. `fn_77377`** | `void fn_76123..76177(int caster, int target)` (Heals `#13..16, #33`)<br>`void fn_76387/76589/76708` (`#19/#17/#18`)<br>`void fn_76421/76742` (`#20 解毒/#21 祛麻`)<br>`void fn_76505/76870/76994` (`#27 麻痹/#26 毒擊/#22 封咒`) | `void` | Individual On-Map Spell Effect Handlers:<br>• Heals (`#13..16, #33`): restore `fn_256147(90, 100)%` of `spell.power`.<br>• `#20 解毒術 / #21 祛麻術`: clear `unit+39 / unit+37` **and heal `+9 HP`** (`fn_51478` EXP).<br>• `#22 封咒術 / #26 毒擊術 / #27 麻痹術`: on `50%` hit roll, set `unit+38 / unit+39 / unit+37 = fn_256147(2, 4)` **and deal `9` HP damage** (`fn_51231` EXP). |

---

### 10.7 Turn Loop, On-Map Death Spin/Explosion, Bouncing Digits & Level-Up (`fn_54284` .. `fn_58900`)

| Function | Calling Convention & Input Arguments | Return Value (`eax`) & Side Effects | Exact Behavior Verified in `FD2.EXE` |
| :--- | :--- | :--- | :--- |
| **`fn_55307`** | `void fn_55307(void)` | `void` | **NPC Ally Phase Loop (`faction == 1`)**: runs `fn_43110(1)` poison/status tick, then iterates all unacted living Ally units and calls `fn_15007(slot_idx, 1)` (`side_flag = 1`). |
| **`fn_55482`** | `void fn_55482(void)` | `void` | **Enemy Phase Loop (`faction == 0`)**: runs `fn_43110(0)` poison/status tick, then iterates all unacted living Enemy units and calls `fn_15007(slot_idx, 0)` (`side_flag = 0`). |
| **`fn_55762`** | `void fn_55762(void)` | `void` | **Player Auto-AI Delegation Loop (`委任行動`, `faction == 2`)**: iterates remaining unacted living Player units and calls `fn_15007(slot_idx, 1)` (`side_flag = 1`). |
| **`fn_56165`** | `void fn_56165(void)` | `void`<br>• Spins & explodes all `hp == 0` units, then sets `unit+5 \|= 1` (`hidden`) | **Two-Phase On-Map Death Animation**:<br>• **Phase A (`13` ticks)**: Rotates dying units clockwise (`unit.dir = step % 4` for `step = 0..12`, 3 full turns ending at `dir = 0`).<br>• **Phase B (`12` frames)**: Sets `unit+5 \|= 1` (`hidden`), plays SFX `#3`, and blits `FDOTHER[5][68..79]` explosion at `((x-1)*24, (y-1)*24 - 6)` (frames `0..5` cumulative fireball, frames `6..11` clean dissipating smoke). |
| **`fn_57176`** | `void fn_57176(int mode)`<br>• **`eax`** = `0` (Orange Damage `FDOTHER[5][94..103]`) or `1` (Green Heal `105..114` / `MISS` `116..118`) | `void` | Animates bouncing on-map damage/heal/`MISS` digit sprites over affected target tiles for `22` ticks using the 2-bounce parabola `GLOBAL_2_8236[0..21]`. |
| **`fn_58002`** | `void fn_58002(int player_slot)`<br>• **`eax`** = `player_slot`<br>• Reads & consumes `GLOBAL_2_16072` (`pendingExp`) | `void`<br>• Updates `unit.exp (+60)`, `unit.level (+33)`, stats, and spells | Post-Action EXP & Level-Up Processor: clamps `GLOBAL_2_16072` to `1..99`, opens `DATO` portrait box to print **`得到經驗 XX 點！`** (`FDTXT[0][488]`), adds to `unit.exp`, and if `unit.exp >= 100`, subtracts `100`, increments `unit.level` (cap `40` standard, `30` T3, `99` `#30/#31`), plays level-up fanfare, calls `fn_58665` to roll stat gains (`FDTXT[0][489..494]`), and checks `fn_46928` for newly learned spells (`FDTXT[0][587]`). |
| **`fn_58665`** | `void fn_58665(Unit80 *unit)`<br>• **`eax`** = pointer to 80-byte `unit` | `void`<br>• Rolls random `[min..max]` stat gains from `GLOBAL_3_8353[unit.portraitUid]` | Rolls `fn_256147(min, max)` for `AP (r[0..1])`, `DP (r[2..3])`, `DX (r[4..5])`, `HP (r[6..7])`, and `MP (r[8..9])` from `GROWTH_TABLE[unit.portraitUid]`, adds them to `unit`, and calls `fn_5210(unit)`. |

---

### 10.8 Physical Combat Math, Multi-Hit, Counterattack, Flying Check & Cutaway Battle Stage (`fn_59478` .. `fn_61827`, `fn_91432` .. `fn_108289`)

| Function | Calling Convention & Input Arguments | Return Value (`eax`) & Side Effects | Exact Behavior Verified in `FD2.EXE` |
| :--- | :--- | :--- | :--- |
| **`fn_59478`** | `void fn_59478(int attacker_slot, int defender_slot)`<br>• **`eax`** = `attacker_slot`<br>• **`edx`** = `defender_slot` | `void`<br>• Resolves Fast Map-Only Combat using `FDOTHER[59]` weapon slash & floating HP bars | Fast Map-Only Physical Combat (`GLOBAL_2_15097 == 1`): checks `statusEffect == 3` (`#71 魔龍爪`) or `3%` innate double attack (`fn_256147(1,100) <= 3`), calls `fn_60615` for each strike while animating `GLOBAL_3_6485` weapon impact frames on the map, then checks counterattack via `fn_61660`. |
| **`fn_60615`** | `int fn_60615(int attacker_slot, int defender_slot)`<br>• **`eax`** = `attacker_slot`<br>• **`edx`** = `defender_slot` | **`eax`** = damage dealt (`0` on miss)<br>• Deducts `defender.hp`, inflicts weapon status procs, updates `GLOBAL_2_16072` | Core Single-Strike Physical Combat Math:<br>1. Applies terrain AP/DP modifiers (`GLOBAL_2_6674 / 6698`) unless flying (`fn_61827 != 0`), plus **`+15% AP` (`unit+34` `#17 魔刃術`), `+15% DP` (`unit+35` `#18 魔鎧術`), and `+15 HIT / +15 EV` (`unit+36` `#19 風行術`)**.<br>2. Rolls hit `rand(1..100) <= attacker.hit - defender.evade`.<br>3. Rolls crit `rand(1..100) <= GLOBAL_2_9115[class-1] + weaponCrit`, halving `def_dp //= 2` on crit.<br>4. Computes `damage = 90%..100% of max(0, att_ap - def_dp)`.<br>5. Rolls weapon poison (`statusEffect == 1`) or paralysis (`statusEffect == 2`, `2..5` turns).<br>6. Computes combat EXP into `GLOBAL_2_16072`. |
| **`fn_61660`** | `int fn_61660(int attacker_slot, int defender_slot)`<br>• **`eax`** = `attacker_slot`<br>• **`edx`** = `defender_slot` | **`eax`** = `1` if defender can counterattack, `0` otherwise | Counterattack Eligibility Check: returns `1` iff `defender.hp > 0`, `defender.paralyzeTurns == 0`, Manhattan distance `|ax - dx| + |ay - dy| == 1`, and defender has an equipped weapon (`fn_47165(def, 0) != -1`) with `minRange == 1`. |
| **`fn_61827`** | `int fn_61827(const Unit80 *unit)`<br>• **`eax`** = pointer to 80-byte `unit` | **`eax`** = `1` if unit is **Flying**, `0` if Ground/Cavalry | **Authoritative Flying-Unit Predicate**: returns `1` iff **`unit.classId == 19` (`龍騎士`) OR (`unit.raceId in (4 龍人, 5 魔族)` AND `unit.portraitUid != 28` `#28 達克塞`)**. Governs flying movement cost override (`row 19`), terrain bonus bypass, Earthquake immunity, and cutaway `TAI.DAT` platform suppression! |
| **`fn_91432`** | `void fn_91432(int phase, int side, ...)` | `void` | Cutaway `#2 炎龍術` (`FDOTHER[26]/[27]`, 18 frames `F00..F17`) 3-stage non-linear renderer: plays entrance & 7-tick hover coil (`F00..F09 -> F15`), 12-tick rapid `F16/F17` flame breath impact per target, and post-impact ascent exit (`F10..F14`). |
| **`fn_95980`** | `int fn_95980(int caster_slot, int target_slot, int spell_id)`<br>• **`eax`** = `caster_slot`<br>• **`edx`** = `target_slot`<br>• **`ebx`** = `spell_id` (`24, 28, 29, 30`) | **`eax`** = damage dealt (`100%` hit rate) | **Sword Saint Special Techniques Damage Calculator (`#24 破龍擊`, `#28 淒煌斬`, `#29 熾炎刀`, `#30 音速刃`)**: uses physical `caster.ap` (with `#17 魔刃術 +15%`) and `target.dp` (with `#18 魔鎧術 +15%`) rather than `spell.power = 0`, with `100%` hit rate:<br>• `#29 熾炎刀` (`29`): `max_dmg = max(1, (caster.ap * 12) // 10 - target.dp)` (`1.2× AP - DP`)<br>• `#24 破龍擊` (`24`): `max_dmg = max(1, (caster.ap * 15) // 10 - target.dp)` (`1.5× AP - DP`)<br>• `#30 音速刃` (`30`): `max_dmg = max(1, (caster.ap * 18) // 10 - target.dp)` (`1.8× AP - DP`)<br>• `#28 淒煌斬` (`28`): `max_dmg = max(1, (caster.ap * 20) // 10 - target.dp)` (`2.0× AP - DP`)<br>Rolls `damage = (max_dmg * fn_256147(90, 100)) // 100` (`90%..100%`). |
| **`fn_98249`** | `void fn_98249(int caster_slot, int summon_spell_id, ...)`<br>• `summon_spell_id` in `32..35` | `void` | Cutaway Summon Spirit Renderer (`#32 熾天使, #33 風妖精, #34 破壞神, #35 暗邪鬼`): loads `FDOTHER[spell_id + 33]` (`chunks 65..68`) and `.VOC` bank `FDOTHER[91..94]`. |
| **`fn_100972`** | `void fn_100972(int attacker_slot, int defender_slot)`<br>• **`eax`** = `attacker_slot`<br>• **`edx`** = `defender_slot` | `void` | Top-Level `320×200` Cutaway Battle Stage Director: selects `BG.DAT[tp[2]]` (with `GLOBAL_2_9059` sky override) and left/right `TAI.DAT` platforms (suppressed for flyers via `fn_61827`), draws `FDOTHER[5][22]` HUD panels behind sprites, invokes `fn_103325` for attacker swing(s), and if `fn_61660` passes, invokes `fn_103325` (`@102112`) for defender counterattack! |
| **`fn_103325` & `fn_106354`** | `void fn_103325(int actor_slot, int target_slot, int is_counter)`<br>`void fn_106354(int actor_slot, int target_slot)` | `void` | Cutaway `FIGANI.DAT` Animation & Multi-Hit Loop: rolls `3%` innate extra attack (`@103530`) AND checks `weapon.statusEffect == 3` (`#71 魔龍爪` at `fn_106354 @106811`, allowing `2` attacks `97%` or `3` attacks `3%` when both proc!), splits strike damage evenly across impact frames (`fr[4] != 0`), triggers white flash (`color 33`), knockback recoil (`GLOBAL_2_9567/9591`), and smooth HUD HP bar drain. |
| **`fn_108221` / `fn_108289`** | `void fn_108221(int caster_slot, int spell_id, ...)` | `void` | Cutaway Offensive Spell Stage Director (`spells 0..9, 24, 28..30`): composites `BG.DAT` + `TAI.DAT` + HUD, plays caster's `FIGANI` Slot 2 cast animation, and dispatches `GLOBAL_9145[spell_id]` (`FDOTHER[18..28, 30, 32..33, 37..39, 43..44]`) across all AoE targets. |

---

### 10.9 Victory/Defeat Dispatch, Pre/Mid/Post-Battle Directing & Prologue (`fn_66935` .. `fn_88439`, `fn_140059` .. `fn_155000`)

| Function | Calling Convention & Input Arguments | Return Value (`eax`) & Side Effects | Exact Behavior Verified in `FD2.EXE` |
| :--- | :--- | :--- | :--- |
| **`fn_66935` & `GLOBAL_2_6937`** | `int fn_66935(void)`<br>• Reads `GLOBAL_2_15363` (`m`), `GLOBAL_2_14917` (`slots`)<br>• Dispatches `GLOBAL_2_6937[0..29]` | **`eax`** = `0` (Battle continues), `1` (Victory -> runs `POST`), `2` (Defeat -> Game Over) | Master Per-Action Victory & Defeat Evaluator (`GLOBAL_2_6937[30]` chapter handlers): checks if `#0 索爾` died (`Defeat`), dispatches chapter-specific victory/defeat overrides (`fn_67269` etc., e.g. Ch 2 all 6 villagers dead, Ch 10 `#135` dead, Ch 20 `#25` or all 8 elves dead, Ch 29 all 3 Dragons slain, Ch 30 `#126 空魔神` slain), and defaults to Enemy Rout (excluding `#121` hazards and Ch 25 optional `#104 火龍`). |
| **`fn_67450` & `GLOBAL_2_7057`** | `void fn_67450(int mid_event_id)`<br>• **`eax`** = `mid_event_id` (`0..84`)<br>• Dispatches `GLOBAL_2_7057[0..84]` | `void` | Mid-Battle Event Dispatcher (`EV 0..84` in `GLOBAL_2_7057[85]`): executes turn-triggered, step-triggered, chest-triggered (`EV 58`), and boss-drop-triggered (`drop_type == 2`) events (wave spawns, AI wake-ups, tile swaps, Ch 9 `EV 30` `#118 萊汀` in-place defection to `1 HP` Ally `#6 萊汀`, Ch 13 `EV 8` `#89 勇者徽章`, Ch 25 `EV 55` `#104 火龍` 1v1 duel, Ch 26 `EV 61` `#31 渥德` awakening, Ch 29 dragon scheduling, Ch 30 `EV 80..83` Elemental & Void Demon God sequences). |
| **`fn_71450` & `GLOBAL_2_7537`** | `void fn_71450(void)`<br>• Dispatches `GLOBAL_2_7537[0..29]` on `GLOBAL_2_15363` (`m = 0..32`) | `void` | Pre-Battle (`PRE`) Opening Cutscene Dispatcher (`GLOBAL_2_7537[30]`): runs camera pans, `fn_13930` choreography, `fn_141721` sparkle waves, earthquakes, lightning strikes (`FDOTHER[3]`), and `FDTXT` opening dialogues before Turn 1 begins. |
| **`fn_78790`** | `void fn_78790(int start_slot, int end_slot, const uint8 *x_arr, const uint8 *y_arr, int dir_mode, ...)` | `void` | Post-Battle Party Formation Helper: gathers surviving party heroes `slots[start_slot .. end_slot]`, places them at formation coordinates `(x_arr[i], y_arr[i])` facing the speaker/leader, repositions the camera, and fades in for the post-battle cutscene. |
| **`fn_79100` .. `fn_87895` & `GLOBAL_2_7657`** | `void fn_79100(void)` (`GLOBAL_2_7657[0..29]` Post-Battle Dispatcher)<br>• Includes `fn_82742` (`FDOTHER[34]` Ch 21 6-Crystal Sky Key Beam), `fn_86220` (Ch 27 Sky Key route split), `fn_87895` (Ch 30 -> `Map 30` True Ending Epilogue) | `void` | Post-Battle (`POST`) Directing & Conditional Recruitment/Reward Dispatcher: evaluates NPC survival / turn count / Sol MaxHP / 6 Sacred Artifacts (`#209..#214 -> #100 天空之鑰`), recruits joining heroes (`fn_4773`), syncs surviving party stats (`fn_5382`), and transitions to Town, Camp, Normal Ending (`Ch 27`), or True Ending (`Map 30`). |
| **`fn_83480`** | `void __cdecl fn_83480(int tile_x, int tile_y, int flash_r, int flash_g)`<br>• Stack `[esp+4..16]` (`4 × int32`) | `void` | Renders the 8-frame `FDOTHER[3]` vertical lightning bolt strike over `(tile_x, tile_y)` with palette flash (used in Ch 22, 23, 27, 28, 30 cutscenes). |
| **`fn_84756` / `fn_84813` / `fn_84958`** | `int __cdecl fn_84756(int item_id)` (find party item holder)<br>`void __cdecl fn_84813(int duration_ticks)` (map earthquake)<br>`int __cdecl fn_84958(int hero_uid)` (`partyHasHero`) | **`fn_84756`**: **`eax`** = `1` if any `slots[0..15]` holds `item_id`, else `-1`<br>**`fn_84958`**: **`eax`** = `1` if `hero_uid` is in `party`, else `0` | Cutscene & Post-Battle Helpers:<br>• `fn_84756(item_id)`: checks if any deployed party unit `slots[0..15]` holds `item_id` via `fn_137312` (used for `#100 天空之鑰` checks in Ch 23, 27).<br>• `fn_84813(ticks)`: shakes the map viewport vertically for `ticks` frames (`(v3 & 1) * 456` stride offset).<br>• `fn_84958(hero_uid)`: scans persistent party `GLOBAL_2_15351[0..partyCount-1]` for `unit+8 == hero_uid` (`identity_uid`), returning `1` if present or `0` if absent (used at `L84024` in Ch 23 Post `fn_83796` to check `fn_84958(18)` for `#18 蜜蒂` before evaluating `#19 羅德曼` recruitment!). |
| **`fn_88439`** | `void fn_88439(int track_id, int loop_flag)`<br>• **`eax`** = `track_id` in `FDMUS.DAT` | `void` | Starts playing `FDMUS.DAT` XMI music track `track_id` via Miles Sound System (`120 Hz` EVNT tick rate). |
| **`fn_137312`** | `int __cdecl fn_137312(int slot_idx, int item_id)`<br>• Stack `[esp+4]` = `slot_idx`, `[esp+8]` = `item_id` | **`eax`** = bag slot (`0..7`) in `slots[slot_idx]`, or `-1` | Searches a specific battlefield unit `slots[slot_idx]`'s 8-slot inventory for `item_id` (used in Ch 26 `EV 61` to check if the unit stepping on `(1, 46)` is carrying `#208 控制中樞`). |
| **`fn_139720`** | `void fn_139720(void)`<br>• Reads `GLOBAL_2_15363` (`m`), `GLOBAL_2_15351` (`party`) | `void`<br>• Sorts mandatory chapter heroes (`必出人物`) to `party[1]` (and `party[2]` in Ch 26) | **Pre-Deployment Mandatory Hero Sorter**: keeps `#0 索爾` at `slot 0` and swaps chapter-mandatory heroes to `slot 1` (and `slot 2`) before `fn_2189` allocates `slots[0..max_deploy-1]`:<br>• Ch 17 (`m=16`): `#18 蜜蒂` -> `slot 1` (if recruited in Ch 16)<br>• Ch 18 (`m=17`), Ch 20 (`m=19`), Ch 27..30 (`m=26..29`): `#9 悠妮` -> `slot 1`<br>• Ch 19 (`m=18`): `#16 凱拉斯` -> `slot 1`<br>• Ch 21 (`m=20`): `#21 約拿` -> `slot 1`<br>• Ch 22 (`m=21`), Ch 23 (`m=22`): `#24 希爾法` -> `slot 1`<br>• Ch 26 (`m=25`): `#29 亞齊梅吉` -> `slot 1`, `#9 悠妮` -> `slot 2`. |
| **`fn_140059`** | `void fn_140059(void)` | `void`<br>• Runs `Map 32 -> Map 31`, recruits `[#0, #9, #4, #30]`, sets `Gold = 0`, launches `Ch 1` | **New Game Opening Prologue Director**:<br>1. Loads `Map 32` (`GLOBAL_2_15363 = 32`): plays Sub-Map 1A Royal Throne Hall (`y=0..42`, `Choreo 99`, `15×fn_12677(2)`, `dlg[0]`, `13×fn_12677(2)`, `dlg[1]`, `Choreo 100` fade-out) -> Sub-Map 1B Woods (`y=43..50`, `Choreo 101..105`).<br>2. Loads `Map 31` (`GLOBAL_2_15363 = 31`): plays Forest Departure (`Waves 1, 3, 5`, `Choreo 90..98`, `FDTXT[32][0..9]`).<br>3. Calls `fn_4773` for `#0 索爾`, `#9 悠妮`, `#4 亞雷斯`, `#30 蓋亞`, sets `GLOBAL_2_15347 = 0` (`0 G`), and sets `GLOBAL_2_15363 = 0` (`Chapter 1`). |
| **`fn_141685` / `fn_141721`** | `void fn_141685(int slot_idx)` (vanish unit)<br>`void fn_141721(int wave_group)` (spawn wave with sparkles) | `void` | Plays the 12-frame `FDOTHER[9]` teleportation sparkle animation over a retreating unit (`fn_141685`, setting `unit+5 \|= 1`) or over every newly spawned unit in `wave_group` (`fn_141721 -> fn_2894`). |
| **`fn_147320`** | `void __cdecl fn_147320(int slot_idx, int dest_x, int dest_y)`<br>• Stack `[esp+4..12]` (`3 × int32`) | `void`<br>• Teleports `slots[slot_idx]` to `(dest_x, dest_y)` with `FDOTHER[9]` sparkles | **Unit Teleportation Cutscene Helper**: pans camera to `slots[slot_idx]`, plays departure sparkles (`FDOTHER[9]`), hides unit from old tile, pans camera to `(dest_x, dest_y)`, moves `slots[slot_idx]` to `(dest_x, dest_y)` (`hidden = false`), and plays arrival sparkles (`FDOTHER[9]`). Used in Ch 30 (`Pre 29` & `EV 82`) to teleport Elemental Demon Gods `#122..#125` and `#126 空魔神` between the top sanctuary pillars and the central altar `(22, 18)`. |
| **`fn_147868`** | `void __cdecl fn_147868(int start_slot, int end_slot_inclusive, int new_ai_mode)`<br>• Stack `[esp+4..12]` (`3 × int32`) | `void`<br>• Sets `slots[s].aiMode = new_ai_mode` for `s = start_slot .. end_slot_inclusive` | Batch AI Mode Setter used by mid-battle wake events (`EV 10, 12, 13, 19, 23, 26, 28, 29, 31, 33, 34, 36, 45`) to switch enemy/ally squads from passive/guard modes (`Mode 1, 2, 4, 8`) to active engagement (`Mode 0` or `Mode 3`). |
| **`fn_148798`** | `int __cdecl fn_148798(int slot_idx)`<br>• Stack `[esp+4]` = `slot_idx` | **`eax`** = `1` if `slots[slot_idx]` is dead/hidden (`(unit+5 & 1) != 0`), `0` if alive on map | Unit Death / Absence Predicate used by mid-battle events (`EV 4, 9, 13, 23, 27, 46, 80`) and defeat evaluators (`GLOBAL_2_6937`) to gate commander dialogue or defeat conditions on whether a specific runtime `slot_idx` is still alive. |
| **`fn_153634`** | `void __cdecl fn_153634(int pan_x, int pan_y, int wave_group)`<br>• Stack `[esp+4..12]` (`3 × int32`) | `void`<br>• Pans camera via `fn_13789(pan_x, pan_y)` and spawns `wave_group` via `fn_141721(wave_group)` | Combined Camera Pan & Sparkle Wave Spawner used across mid-battle reinforcement events (`EV 5, 7, 11, 14..18, 22, 24, 27, 31, 32, 35, 37, 38, 40, 42..44, 46..50, 52, 54, 56, 57, 65, 72, 74, 82, 84`). |
| **`fn_154554`** | `void __cdecl fn_154554(int start_slot)`<br>• Stack `[esp+4]` = `start_slot` (`16, 21, 51, 56`) | `void`<br>• Sets `hp = 0` on living enemies `slots[start_slot .. 79]` and calls `fn_56165()` | Mass On-Map Enemy Wipe Helper: triggered when a chapter's central seal or master boss is destroyed (`EV 53` in Ch 23 at `(20,7)`, `EV 64` in Ch 27 boss `#120 蓋亞`, `EV 71` in Ch 28 boss `#119 恰吉`, `EV 83` in Ch 30 final boss `#126 空魔神`), spinning and exploding all remaining subordinate enemies on the map simultaneously! |

---

### 10.10 Town Shops, Tavern, Secret Shop, Church Promotion & Low-Level Codecs (`fn_117500` .. `fn_138900`, `fn_252888` .. `fn_256175`)

| Function | Calling Convention & Input Arguments | Return Value (`eax`) & Side Effects | Exact Behavior Verified in `FD2.EXE` |
| :--- | :--- | :--- | :--- |
| **`fn_118500` / `fn_127151`** | `void fn_118500(void)` (Town Hub Loop)<br>`void fn_127151(void)` (Shop / Camp Inventory & Equip UI) | `void` | Intermission Town (`GLOBAL_2_9913[ch] == 0`) & Field Camp (`GLOBAL_2_9913[ch] != 0`) UI controllers: Weapon/Armor Shop (`#128`), Tavern (`#129`), Item Shop (`#130`), Church (`#131`), Secret Shop (`#132`, unlocked by `SHOP_TABLE[ch-1].secretTrigger[0..2]` hotkey), and `#75 米蘭` Camp HQ. |
| **`fn_136069` & `fn_137107`** | `int fn_137107(int party_idx)` (eligibility & target promo UID)<br>`void fn_136069(int party_idx)` (Church promotion sequence) | **`eax`** = target promoted `uid` (`32..65`), or `-1` if ineligible | **Church Class Promotion Controller**:<br>• `fn_137107`: verifies `uid < 18`, `uid != 7` (`#7 蘭斯洛特`), and `level >= 20`; selects default Tier-2 `uid + 32`, or Tier-3 `uid + 50` if holding secret promotion item `GLOBAL_2_9895[uid]` (or `#52 召喚師` if `#9 悠妮` holds `#90 精靈契印`).<br>• `fn_136069`: plays `FDOTHER[46, 47, 54]` light pillar transformation, sets `unit+7 = target_promo_uid` (keeping `unit+8` base identity), updates `class_id` and `mv += mv_bonus` from `GLOBAL_3_5630`, resets `level = 1, exp = 0`, applies one growth roll (`fn_58665`), and learns Lv 1 spells (`fn_46928`). |
| **`fn_252888`** | `uint32 fn_252888(const void *buf, int len)`<br>• **`eax`** = buffer pointer<br>• **`edx`** = byte length | **`eax`** = 32-bit save-file integrity checksum | Computes the `FD2.SAV` additive/XOR checksum across each save slot block. |
| **`fn_252924`** | `void fn_252924(void *ptr)`<br>• **`eax`** = heap pointer | `void` | Watcom C `free(ptr)` memory deallocator. |
| **`fn_253900`** | `void fn_253900(void)` | `void` | Non-blocking water/lava palette cycling ticker called inside every frame-wait loop (`fn_13408`). |
| **`fn_255161`** | `int fn_255161(int chapter_1based)`<br>• **`eax`** = `1..26` | **`eax`** = byte offset `(ch - 1) * 31` into `GLOBAL_3_9101` (`SHOP_TABLE`) | Computes the 31-byte Town Shop record offset for `chapter_1based` (`[0..2]` secret trigger, `[3..14]` weapon shop, `[15..22]` item shop, `[23..30]` secret shop). |
| **`fn_256091`** | `void fn_256091(const uint8 *rle_src, uint8 *vram_dst, int w, int h)` | `void` | Transparent PCX-RLE Sprite Blitter (`strict b > 0xC0` run-length decoding with palette index `0` treated as transparent; used for `FDOTHER[5][68..79]` death explosions, `FDOTHER[6]` on-map spell FX, and `FDOTHER[5][94..118]` bouncing digits). |
| **`fn_256147`** | `int fn_256147(int min_val, int max_val)`<br>• **`eax`** = `min_val`<br>• **`edx`** = `max_val` | **`eax`** = pseudo-random integer in `[min_val .. max_val]` | Inclusive uniform random number generator `min_val + (rand() % (max_val - min_val + 1))` used for all hit, crit, `3%` multi-hit (`fn_256147(1, 100) <= 3`), status proc, damage spread, and level-up growth rolls. |
