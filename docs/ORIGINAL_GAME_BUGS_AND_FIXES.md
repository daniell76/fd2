# Original 1995 `FD2.EXE` Bugs & Intentional `fd2-web` Fixes

> **Purpose of This Document**
> While `fd2-web` aims for 100% mechanical, visual, and directing fidelity to Dynasty International's 1995 DOS classic *Flame Dragon II: Legend of Golden Castle* (`炎龍騎士團II：黃金城之謎`), reverse-engineering `FD2.EXE` and its `.DAT` archives has uncovered several genuine programming bugs in the original 1995 release.
>
> This log records **every confirmed bug in the original game** alongside the **exact intentional fix / divergence** implemented in `fd2-web`, so we always have a clear boundary between authentic 1995 behavior and deliberate bug fixes.

---

## Summary Table of Intentional Fixes Over Original 1995 `FD2.EXE`

| # | Bug / Discrepancy in 1995 `FD2.EXE` | Original `FD2.EXE` Location | Original Buggy Behavior | Intentional `fd2-web` Fix | Implementation Location |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **1** | **Multi-Hit (`連擊`) EXP Overwrite / Zeroing Bug** | `fn_60615` (`@60615..@61501`) & `fn_106354` (`@106354..@107126`) | Each strike overwrites `GLOBAL_2_16072 = strike_exp` (`=`) instead of accumulating (`+=`), and resets `GLOBAL_2_16072 = 0` at swing start. Non-lethal multi-hits only grant the **last** hit's EXP — and if Hit 1 lands (`20` dmg) but Hit 2 **misses**, the player gets **`0 EXP`**! | Computes EXP from **overall effective HP removed across all hits** (`defenderStartHp - defender.hp`), or awards **full kill EXP** (`fullKillExp`) when `defender.hp <= 0` (still capped at `99` per action). | `src/engine/tactical.ts` (`resolveCombat`, `computeEnemyCombatExp`) |
| **2** | **`#71 魔龍爪` Capped at 2 Hits When Battle Anim Is OFF** | `fn_59478` (`@59569..@59599`) vs `fn_103325` (`@103530`) + `fn_106354` (`@106811`) | With Battle Anim **ON** (`fn_103325`), the flat `3%` innate extra-swing roll and `#71 魔龍爪` (`statusEffect == 3`) are independent and stack (**`97%` 2 hits / `3%` 3 hits**). With Battle Anim **OFF** (`fn_59478`), an `if / else if` branch skips the `3%` roll when `statusEffect == 3`, silently capping `#71 魔龍爪` at **2 hits (`100%`)**! | Uses the unified Cutaway Combat (`fn_103325`) multi-hit rules regardless of animation speed/toggle — `#71 魔龍爪` always has **`97%` 2 hits / `3%` 3 hits** whether animations are ON, Fast, or OFF. | `src/engine/tactical.ts` (`resolveCombat`) |
| **3** | **Retaliation Multi-Hit Inconsistency When Battle Anim Is OFF** | `fn_59478` (`@60250`) vs `fn_100972` (`@102112` $\rightarrow$ `fn_103325`) | With Battle Anim **ON**, a counterattacking melee defender runs through `fn_103325` and can trigger the `3%` innate double-hit (or `#71 魔龍爪` extra hit). With Battle Anim **OFF** (`fn_59478`), retaliation calls `fn_60615` once directly, suppressing counterattack multi-hits. | Uses the unified Cutaway Combat (`fn_100972` $\rightarrow$ `fn_103325`) rule in all animation modes so turning animations OFF is purely visual and never alters combat RNG or outcomes. | `src/engine/tactical.ts` (`resolveCombat`) |
| **4** | **`#121 沼澤怪物` Blank `FIGANI` Slot 0 (`idle`) Placeholder** | `FIGANI.DAT` chunk `363` (`3 * 121 + 0`) | `#121 沼澤怪物` (Swamp Monster) has a `1`-frame `320×200` completely transparent (`0` opaque pixels) placeholder in `FIGANI` Slot 0 (`idle`), while Slot 1 (`attack`) has `5` drawn frames. | Extractor skips 0-opaque single-frame `idle` placeholders so `#121` cleanly falls back to `attack` Frame `0` when targeted in cutaway view instead of rendering invisible. | `tools/extract_fd2.py` (`extract_figani`) & `src/ui/battleStage.ts` |

---

## Detailed Notes on Each Original Bug

### Bug 1: Multi-Hit (`連擊`) Experience Overwrite & Miss-Zeroing (`fn_60615` & `fn_106354`)
- **How `FD2.EXE` Behaved**:
  - `FD2.EXE` stores the EXP earned by the active combat round in the single global integer `GLOBAL_2_16072` (`Obj2 + 16072`), which `fn_58002` reads after combat ends to award EXP and show `得到經驗 XX 點！`.
  - Both per-swing strike functions (`fn_60615` for Fast Map Combat and `fn_106354` for Cutaway Combat) clear `GLOBAL_2_16072 = 0` at the beginning of each swing and assign `GLOBAL_2_16072 = strike_exp` (`=`) at `@61477/@61501` and `@107100/@107126` rather than adding (`+=`).
  - **Consequences Verified by Direct Simulation of `FD2.EXE`**:
    1. **Hit 1 Lands + Hit 2 Lands (Non-Lethal)**: Hit 1's EXP is completely discarded; only Hit 2's EXP is awarded (for example, a Critical 1st hit for `18` dmg followed by a normal 2nd hit for `10` dmg against a `60 HP` enemy only awards the `10`-dmg EXP!).
    2. **Hit 1 Lands + Hit 2 Misses**: Hit 2 clears `GLOBAL_2_16072 = 0` on entry and returns early on miss — awarding **`0 EXP` total** even though Hit 1 dealt heavy damage!
    3. **Lethal Final Hit**: Only worked by coincidence because the killing blow branch assigned full `kill_exp = (exp_base * enemy_lv) // actor_eff_lv`, overwriting earlier swings with the full kill value.
- **What `fd2-web` Does Instead**:
  - `resolveCombat` records `attackerStartHp` and `defenderStartHp` before Swing 1, executes all swings (1, 2, or 3), and then calculates `expGained` once from:
    - **Full Kill EXP (`fullKillExp`)** if the enemy's HP reached `0` (`target.hp <= 0`), or
    - **Cumulative Effective Damage (`startHp - endHp`)** across all hits that landed (`floor(fullKillExp * effectiveDamage / enemyMaxHp)`, clamped to `1..99` whenever at least one hit landed).

---

### Bug 2 & Bug 3: Combat Rule Divergence When Battle Animation Is Turned OFF (`fn_59478` vs `fn_100972` / `fn_103325`)
*(Note: Item **`#71 魔龍爪`** — Demon Dragon Claw — is the sole weapon among all 215 items in `GLOBAL_3_685` with `statusEffect == 3`; `#97` is `十字弓` Crossbow with `statusEffect == 0`.)*

- **How `FD2.EXE` Behaved**:
  - `FD2.EXE` maintained **two separate combat loop implementations**:
    1. **Cutaway Combat (`fn_100972` $\rightarrow$ `fn_103325` $\rightarrow$ `fn_106354`)** when Battle Animations are **ON** (`GLOBAL_2_15097 == 0`).
    2. **Fast Map-Only Combat (`fn_59478` $\rightarrow$ `fn_60615`)** when Battle Animations are **OFF** (`GLOBAL_2_15097 != 0`).
  - Inside **Cutaway Combat (`fn_103325`)**:
    - Before Swing 1, `@103530` rolls `rand(1, 100) <= 3` (`3%` innate proc) to set a local extra-swing counter.
    - During Swing 1, `fn_106354 @106811` checks `weapon.statusEffect == 3` (`#71 魔龍爪`) and sets `Obj2 + 533628 = 1`.
    - Because the swing loop tail (`@105312..@105596`) checks both variables independently, `#71 魔龍爪` attacks **2 times (`97%`)** and **3 times (`3%`)**!
    - Furthermore, when an adjacent melee defender survives and retaliates (`fn_100972 @102112`), `fn_100972` calls `fn_103325` for the defender as well, giving the counterattacking unit the same `3%` / `#71` multi-hit check.
  - Inside **Fast Map-Only Combat (`fn_59478`)**:
    - `@59569..@59599` wrote a mutually exclusive `if (weapon.statusEffect == 3) swings = 2; else if (rand(1, 100) <= 3) swings = 2;`, accidentally preventing `#71 魔龍爪` from ever rolling its 3rd hit when animations were turned off!
    - `@60250` invoked `fn_60615` only once for the retaliating defender without any multi-hit check.
- **What `fd2-web` Does Instead**:
  - Combat resolution (`resolveCombat` in `src/engine/tactical.ts`) is **100% decoupled from presentation speed** (`Full` / `Fast` / `Skip`). Turning off battle animations never downgrades `#71 魔龍爪` from `2..3` hits to `2` hits and never changes counterattack mechanics.

---

### Authentic 1995 Behaviors Intentionally Preserved (Not Bugs, Even Though Unusual!)
For clarity, the following quirks in `FD2.EXE` were verified to be **intentional design rules** by the original developers and are **preserved faithfully** in `fd2-web`:
1. **Non-Player Equipment Bypass (`fn_3152` & `fn_47165` vs `fn_49602`)**: Map-spawned enemies and NPC allies auto-equip their carried weapon and armor unconditionally without checking `GLOBAL_3_6282` (`classEquipMasks` is checked *only* in the player Equip UI `fn_49149` / `fn_127151`). Preserved so enemies like Chapter 1 `#96 盜賊` (`classId = 7`, carrying `#0 短劍`) properly equip their weapons and retaliate in melee.
2. **Post-Move Magic Restriction Exception (`fn_34960`)**: Units cannot cast spells after moving `> 0` tiles *except* `#18 蜜蒂`, `#19 羅德曼`, and `#34 鐵諾 (劍聖)`. Preserved 100%.
3. **Promoted Effective Level `+30` in EXP Formula (`fn_60615`, `fn_51231`, `fn_51478`)**: Promoted classes (`classId = 9..24`) and `#28 達克塞` add `+30` to `level` when dividing EXP (`eff_lv = level + 30`). Preserved 100%.
4. **Lethal Start-of-Phase Poison (`fn_43110`)**: Unlike many SRPGs that clamp poison at `1 HP`, `FD2.EXE` poison deals `floor(maxHp / 10)` and *can* kill a unit at phase start (triggering `fn_56165` spin + explosion). Preserved 100%.
