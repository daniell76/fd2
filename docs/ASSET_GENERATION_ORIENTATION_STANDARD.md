# Flame Dragon II HD — Mandatory Orientation & Camera-Depth Standard

Every image and video generation prompt for combat sprites, cut-ins, and VFX sheets **MUST** explicitly specify the isometric 2.5D battle-stage facing and attack orientation. Never leave facing vague as plain "left" or "right" (`0°` flat side-scroller).

## Battle Stage Geometry (`1600×900`)
- **Allies (Player Units)** stand in the **bottom-right foreground (`↘`)** and look/attack **into depth toward the upper-left (`↖`)**.
- **Enemies** stand in the **upper-left background (`↖`)** and look/attack **out toward the camera / bottom-right (`↘`)**.

---

## 1. Player / Ally Units (`#000–#065` & Allied NPCs)
Paste this mandatory block verbatim into every ally generation prompt:

```text
MANDATORY ALLY ORIENTATION & ISOMETRIC CAMERA-DEPTH LOCK:
- POSITION: Ally unit standing in the BOTTOM-RIGHT foreground fighting an enemy in the UPPER-LEFT background.
- CAMERA VIEW: 3/4 REAR / OVER-THE-SHOULDER ISOMETRIC VIEW looking AWAY from the camera toward UPPER-LEFT (↖, ~10:30 o'clock, 25°-35° diagonally upward-left into screen depth).
- FOOT STANCE: Isometric diagonal depth — front foot planted HIGHER & UPPER-LEFT, rear foot planted LOWER & LOWER-RIGHT (NOT aligned flat horizontally!).
- FACING DIRECTION: Head, eyes/visor, gaze, and weapon sightline MUST aim diagonally UPPER-LEFT (↖, ~10:30 o'clock) — NEVER flat horizontal 9:00 (←), NEVER front-facing 7:30 (↙) toward the viewer, NEVER turning right (→) away from the enemy!
- ATTACK DIRECTION: Punches, slashes, spear thrusts, arrows, beams, and crescent waves MUST drive diagonally UPWARD-LEFT (↖, ~25°-35° above horizontal) toward the enemy in the upper-left background (matching the original 1995 DOS FIGANI.DAT trajectories).
```

## 2. Enemy Units (`#066+` & Bosses)
Paste this mandatory block verbatim into every enemy generation prompt:

```text
MANDATORY ENEMY ORIENTATION & ISOMETRIC CAMERA-DEPTH LOCK:
- POSITION: Enemy unit standing in the UPPER-LEFT background fighting a player hero in the BOTTOM-RIGHT foreground.
- CAMERA VIEW: 3/4 FRONT ISOMETRIC VIEW facing TOWARD the camera & diagonally DOWNWARD-RIGHT (↘, ~4:30 o'clock, 25°-35° diagonally downward-right).
- FOOT STANCE: Isometric diagonal depth — rear foot planted HIGHER & UPPER-LEFT, front foot planted LOWER & LOWER-RIGHT (NOT aligned flat horizontally!).
- FACING DIRECTION: Head, eyes/visor, torso chest, and weapon sightline MUST face diagonally DOWNWARD-RIGHT (↘, ~4:30 o'clock) — NEVER flat horizontal 3:00 (→), NEVER facing away!
- ATTACK DIRECTION: Punches, slashes, projectiles, breaths, and spells MUST drive diagonally DOWNWARD-RIGHT (↘, ~25°-35° below horizontal) toward the hero standing in the bottom-right foreground (matching the original 1995 DOS FIGANI.DAT trajectories).
```

## Verification Checklist (Before Accepting Any Candidate Sheet)
1. **Footline stagger check**: For allies, front foot sits visually higher-left than rear foot; for enemies, front foot sits visually lower-right than rear foot.
2. **Weapon / strike elevation angle**: Measure `tip_rel_from_top` on follow-through (`F5`/`F6`) against the 1995 DOS `FIGANI.DAT` frame — allies striking `↖` must angle clearly upward-left (`~25°–35°`), NOT dead horizontal (`0°`). Enemies striking `↘` must angle clearly downward-right (`~25°–35°`).
3. **Post-attack gaze check**: On follow-through/recovery frames (`F4–F6`), the unit's head MUST stay facing the opponent (`↖` for allies, `↘` for enemies), never looking away behind its back.
4. **Hand consistency check (NO `flip_x` shortcut)**: Verify which arm holds each weapon/shield (`LEFT` vs `RIGHT`) strictly from the original 1995 DOS 6-frame sheet and encode it in `EquipmentHandSpec` in `tools/prompt_templates.py`. **Never horizontally flip (`flip_x` / `flip_indices`) asymmetric weapon/shield sprites in post-processing**, as mirroring reverses handedness.
5. **Slash-trail causality check**: F1–F3 must have zero slash light. On the impact frame (`F4`/`F5`), the physical weapon blade/fist MUST already be at its finished end-of-swing position with the golden/fiery energy trail **behind** it (connecting the F3 wind-up origin into the finished blade edge) — never floating ahead of a still-raised weapon.
6. **Heavy-decoration style lock**: All combat sheets must be generated through `tools/prompt_templates.py` using the version-controlled Vanillaware (*Unicorn Overlord*) anchors in `tools/style_anchors/` (`hero_vanillaware_anchor.png` and `enemy_vanillaware_anchor.png`).
