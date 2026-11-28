#!/usr/bin/env python3
"""Categorized High-Ornament Vanillaware Prompt Template Engine for FD2-Web HD Combat Sheets.

Version-controlled single source of truth in `tools/prompt_templates.py`, paired with
`docs/ASSET_GENERATION_ORIENTATION_STANDARD.md` and `tools/style_anchors/`.

Composes every combat sprite-sheet prompt deterministically from 4 orthogonal layers:
  1. Faction & Isometric Camera-Depth Template (`player` 10:30 ↖ vs `enemy` 4:30 ↘)
  2. Global Heavy-Decoration Style Template (`STYLE_VANILLAWARE_ORNATE`)
  3. Categorized Combat Archetype Motion & VFX Causality Template (6 archetypes)
  4. Mandatory DOS Equipment-Handedness Table + Exact 6-Frame Pose Sequence

Hard Rules enforced by this module:
  - BAN horizontal flipping (`flip_x` / `flip_indices`) on asymmetric weapon/shield sprites.
  - Explicit LEFT HAND + RIGHT HAND anatomical & viewer-side mapping derived from 1995 DOS FIGANI,
    injected into the header AND reiterated inside F1..F6.
  - Isometric 10:30 o'clock (↖, ~25°-35° UP-LEFT) / 4:30 o'clock (↘, ~25°-35° DOWN-RIGHT) target vector
    and staggered diagonal foot stance — explicitly forbidding flat 9:00 West (←) / 3:00 East (→) profiles.
  - Strict Slash-Trail Causality Law: F1–F3 have ZERO slash light; on the impact frame the physical
    weapon/fist MUST ALREADY BE AT ITS FINISHED END-OF-SWING POSITION with the energy trail BEHIND it
    (connecting F3's windup start -> current finished blade edge), NEVER ahead of a still-raised blade!
"""
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

TOOLS_DIR = Path(__file__).resolve().parent
REPO_ROOT = TOOLS_DIR.parent
STYLE_ANCHORS_DIR = TOOLS_DIR / "style_anchors"
HERO_ORNATE_ANCHOR = str(STYLE_ANCHORS_DIR / "hero_vanillaware_anchor.png")
ENEMY_ORNATE_ANCHOR = str(STYLE_ANCHORS_DIR / "enemy_vanillaware_anchor.png")

Side = Literal["player", "enemy"]
Archetype = Literal[
    "MELEE_SLASH",      # Sword / Sabre / Axe / Greatsword / Scythe (1H or 2H)
    "MELEE_THRUST",     # Spear / Lance / Halberd / Trident
    "UNARMED_BRAWLER",  # Claws / Fists / Martial Arts
    "FLYING_MELEE",     # Winged Dragon-Kin / Dragon Knight / Flying Demon melee
    "REMOTE_SHOOTER",   # Bow / Crossbow / Bazooka / Beam Cannon / Sniper / Laser Turret
    "MAGIC_CASTER",     # Mage / Priest / Warlock staff or prayer-scroll casting
]

# ==============================================================================
# LAYER 1: FACTION & ISOMETRIC CAMERA-DEPTH TEMPLATES
# (Synchronized verbatim with docs/ASSET_GENERATION_ORIENTATION_STANDARD.md)
# ==============================================================================

CAMERA_TEMPLATES: dict[Side, str] = {
    "player": (
        "1. MANDATORY ALLY ORIENTATION & ISOMETRIC CAMERA-DEPTH LOCK (10:30 O'CLOCK NORTHWEST ↖):\n"
        "- POSITION: Ally unit standing in the BOTTOM-RIGHT foreground fighting an enemy in the UPPER-LEFT background.\n"
        "- CAMERA VIEW: 3/4 REAR / OVER-THE-SHOULDER ISOMETRIC VIEW looking AWAY from the camera toward UPPER-LEFT "
        "(↖, ~10:30 o'clock, 25°-35° diagonally upward-left into screen depth) in ALL 6 frames.\n"
        "- FOOT STANCE: Isometric diagonal depth — front foot planted HIGHER & UPPER-LEFT, rear foot planted LOWER & LOWER-RIGHT "
        "(NOT aligned flat horizontally!).\n"
        "- FACING DIRECTION: Head, eyes/visor, gaze, shoulder line, and weapon sightline MUST aim diagonally UPPER-LEFT "
        "(↖, ~10:30 o'clock) — NEVER flat horizontal 9:00 West (←), NEVER front-facing 7:30 (↙) toward the viewer, NEVER turning right (→/↗)!\n"
        "- CONCRETE CELL-CORNER LOCK: In EVERY SINGLE ONE of the 6 cells, the character's nose/visor/snout/eyes MUST point toward the **TOP-LEFT CORNER** of the cell; "
        "capes, cloaks, and tails trail toward the **BOTTOM-RIGHT CORNER** of the cell; and every spearhead, claw strike, and finished slash impact drives toward the **TOP-LEFT CORNER** — **NEVER toward the right edge of the cell!**\n"
        "- ATTACK DIRECTION: Punches, slashes, spear thrusts, arrows, beams, and crescent waves MUST drive diagonally UPWARD-LEFT "
        "(↖, ~25°-35° above horizontal) toward the enemy in the upper-left background (matching the original 1995 DOS FIGANI.DAT trajectories)."
    ),
    "enemy": (
        "1. MANDATORY ENEMY ORIENTATION & ISOMETRIC CAMERA-DEPTH LOCK (4:30 O'CLOCK SOUTHEAST ↘):\n"
        "- POSITION: Enemy unit standing in the UPPER-LEFT background fighting a player hero in the BOTTOM-RIGHT foreground.\n"
        "- CAMERA VIEW: 3/4 FRONT ISOMETRIC VIEW facing TOWARD the camera & diagonally DOWNWARD-RIGHT "
        "(↘, ~4:30 o'clock, 25°-35° diagonally downward-right) in ALL 6 frames.\n"
        "- FOOT STANCE: Isometric diagonal depth — rear foot planted HIGHER & UPPER-LEFT, front foot planted LOWER & LOWER-RIGHT "
        "(NOT aligned flat horizontally!).\n"
        "- FACING DIRECTION: Head, eyes/visor, torso chest, and weapon sightline MUST face diagonally DOWNWARD-RIGHT "
        "(↘, ~4:30 o'clock) — NEVER flat horizontal 3:00 East (→), NEVER facing away!\n"
        "- CONCRETE CELL-CORNER LOCK: In EVERY SINGLE ONE of the 6 cells, the character's face/visor/chest MUST face toward the **BOTTOM-RIGHT CORNER** of the cell; "
        "capes/cloaks trail toward the **TOP-LEFT CORNER**; and every thrust, punch, and finished slash impact drives toward the **BOTTOM-RIGHT CORNER** — **NEVER toward the left edge of the cell!**\n"
        "- ATTACK DIRECTION: Punches, slashes, projectiles, breaths, and spells MUST drive diagonally DOWNWARD-RIGHT "
        "(↘, ~25°-35° below horizontal) toward the hero standing in the bottom-right foreground (matching the original 1995 DOS FIGANI.DAT trajectories)."
    ),
}

# ==============================================================================
# LAYER 2: GLOBAL HEAVY-DECORATION STYLE TEMPLATE
# ==============================================================================

STYLE_VANILLAWARE_ORNATE = (
    "2. HEAVY-DECORATION / HIGH-ORNAMENT VANILLAWARE (*UNICORN OVERLORD*) STYLE LOCK:\n"
    "- **DO NOT DRAW FLAT, PLAIN CARTOON CEL-SHADING!** Match the baroque craft of the Vanillaware anchor reference(s)!\n"
    "- Every armor plate, cloak, tunic, loincloth, shield, and weapon MUST feature **LAVISH BAROQUE DETAIL**: "
    "embossed gold/silver/bronze filigree scrollwork on pauldrons, cuirasses, shields, bracers & greaves; "
    "intricate woven gold/bronze brocade embroidery along cloak, surcoat, tabard & loincloth hems; "
    "hammered-steel painterly brushwork, warm/cool metallic bounce highlights, brass rivets, layered buckled leather straps, and etched/filigree weapon guards!\n"
    "- Crisp dark anime ink outlines, **REALISTIC HEROIC 1:7 HEAD-TO-BODY PROPORTIONS** (never chibi/big-head), "
    "**100% IDENTICAL BODY SCALE** across all 6 cells!\n"
    "- **100% SOLID FLAT PURE WHITE `#FFFFFF` BACKGROUND**: ZERO grid lines, ZERO boxes, ZERO borders, ZERO text/numbers, ZERO floor shadows! "
    "Every weapon tip, wingtip, and energy trail MUST sit 100% completely inside its own cell with generous clean `#FFFFFF` margin on all 4 sides!"
)

# ==============================================================================
# LAYER 3: 6 CATEGORIZED COMBAT ARCHETYPE MOTION & VFX CAUSALITY TEMPLATES
# ==============================================================================

ARCHETYPE_TEMPLATES: dict[Archetype, str] = {
    "MELEE_SLASH": (
        "3. COMBAT ARCHETYPE [MELEE_SLASH] — STRICT SLASH-TRAIL CAUSALITY & KINEMATICS:\n"
        "- **NO MAGIC / PURE PHYSICAL STRIKE**: Pure martial blade/axe choreography matching the 1995 DOS FIGANI blueprint.\n"
        "- **SLASH-TRAIL CAUSALITY LAW (CRITICAL — NEVER DRAW SLASH LIGHT BEFORE THE BLADE SWINGS!!)**:\n"
        "  * **F1, F2, F3 (Ready & Wind-Up)**: STRICTLY **ZERO** slash light or energy arcs! The weapon rises cleanly into peak wind-up.\n"
        "  * **Impact Frame (F4 or F5 per sequence)**: The striking arm and **PHYSICAL WEAPON BLADE MUST ALREADY HAVE COMPLETED THE FULL SWING TO THE LOW/FORWARD IMPACT ENDPOINT**! "
        "The bright golden-white slash crescent MUST **TRAIL BEHIND THE SWUNG BLADE** — starting as a thin tapered tail back at the F3 wind-up origin (overhead/back) "
        "and sweeping continuously INTO the trailing back edge of the physical weapon resting at its completed forward/low strike position! "
        "**NEVER leave the sword still raised overhead with a golden arc floating ahead of it!!**\n"
        "  * **SINGLE-EDGED BLADE ORIENTATION LAW**: For any curved sword, sabre, katana, or single-bladed axe, the **SHARP CUTTING EDGE** MUST ALWAYS face **INTO the direction of the slash/target** (never backwards with the blunt spine leading the cut!), while the blunt spine trails into the golden slash arc!\n"
        "  * **Follow-Through Frame**: Compact golden impact sparks right at the blade tip at the finished strike position (no full crescent arc).\n"
        "  * **Recovery Frame (F6)**: Clean physical guard recovery with ZERO VFX."
    ),
    "MELEE_THRUST": (
        "3. COMBAT ARCHETYPE [MELEE_THRUST] — DIAGONAL SPEAR/LANCE PIERCING KINEMATICS:\n"
        "- **STRICT DIAGONAL SHAFT AXIS**: Keep the long spear/lance shaft angled along the **isometric diagonal target vector** "
        "(`~10:30 o'clock, 25°-35° UP-LEFT ↖` for Allies; `~4:30 o'clock, 25°-35° DOWN-RIGHT ↘` for Enemies) — NEVER flat horizontal 9:00/3:00!\n"
        "- **THRUST-CONE CAUSALITY LAW**:\n"
        "  * **F1, F2, F3 (Guard & Coiled Pullback)**: STRICTLY **ZERO** flash or wind lines! Arms & torso draw the spear shaft cleanly backward along the diagonal axis.\n"
        "  * **Impact Frame**: Arms & torso **FULLY EXTENDED FORWARD** along the diagonal axis! The golden-white piercing shock-cone & speed streaks erupt directly from the **FULLY EXTENDED SPEARHEAD** along that exact diagonal vector!\n"
        "  * **Follow-Through & Recovery**: Fading golden sparks at the spearhead, then clean diagonal retraction back to F1 guard."
    ),
    "UNARMED_BRAWLER": (
        "3. COMBAT ARCHETYPE [UNARMED_BRAWLER] — BARE CLAW/FIST DIAGONAL STRIKE KINEMATICS:\n"
        "- **STRICTLY UNARMED (ZERO SWORDS/WEAPONS)**: Pure bare claws/fists martial choreography matching DOS FIGANI.\n"
        "- **STRIKE-TRAIL CAUSALITY LAW**:\n"
        "  * **F1, F2, F3 (Crouch & Coil)**: STRICTLY **ZERO** energy streaks! Muscular torso twists & pulls the striking claw/fist tightly back while staying oriented along the **diagonal target vector** (`10:30 ↖` for Allies, `4:30 ↘` for Enemies — NEVER flat side profile!).\n"
        "  * **Impact Frame**: Striking arm **FULLY EXTENDED DIAGONALLY** (`↖` or `↘`) at the end of the punch/claw-rake, with the golden-white tearing claw-streak / shock-burst trailing directly **BEHIND & AROUND THE EXTENDED FIST/CLAW**!\n"
        "  * **Follow-Through & Recovery**: Compact dissipating sparks around the striking hand, then agile recovery back to diagonal crouched guard."
    ),
    "FLYING_MELEE": (
        "3. COMBAT ARCHETYPE [FLYING_MELEE] — AIRBORNE HOVERING SWOOP & SLASH CAUSALITY:\n"
        "- **HOVERING AIRBORNE STANCE**: Character stays cleanly airborne/hovering in all 6 cells (feet/talons lifted off ground, wings dynamically banking/flaring) with **ALL WINGTIPS 100% UNCLIPPED INSIDE EACH CELL**.\n"
        "- **STRICT HANDEDNESS & SLASH-TRAIL CAUSALITY LAW**:\n"
        "  * Shield and weapon stay **LOCKED TO THEIR EXACT ANATOMICAL ARMS IN ALL 6 CELLS** (NEVER swap hands mid-flight!).\n"
        "  * **F1, F2, F3 (Hover & Wind-Up)**: STRICTLY **ZERO** slash light! Weapon arm raises cleanly to peak wind-up.\n"
        "  * **Impact Frame (F4)**: Striking arm and **PHYSICAL WEAPON BLADE MUST ALREADY BE AT THE FINISHED LOW/FORWARD-DIAGONAL ENDPOINT OF THE SWING**! "
        "The fiery golden-white crescent arc MUST **TRAIL BEHIND THE SWUNG BLADE** from the F3 overhead wind-up origin down into the physical blade's finished strike position — **NEVER draw a golden arc ahead of a still-raised blade!!**\n"
        "  * **F5 & F6**: Mid-air follow-through with compact blade-tip sparks, then graceful hovering recovery to F1."
    ),
    "REMOTE_SHOOTER": (
        "3. COMBAT ARCHETYPE [REMOTE_SHOOTER] — RANGED AIM, CHARGE, FIRE & RECOIL KINEMATICS:\n"
        "- **STRICT TRIGGER/SUPPORT HAND LOCK**: Trigger hand and forward barrel/bow-support hand NEVER swap across all 6 frames.\n"
        "- **DIAGONAL AIM VECTOR**: Barrel / bow aims cleanly along the **diagonal target vector** (`10:30 ↖` for Allies, `4:30 ↘` for Enemies).\n"
        "- **FIRING CAUSALITY LAW**: F1 Ready carry -> F2 Draw/Level -> F3 Full Aim/Brace (ZERO muzzle blast yet) -> F4 Energy Charge / Full Draw -> F5 Muzzle Flash / Release Burst directly at muzzle/bowstring tip -> F6 Physical Recoil Kickback & smoke/sparks."
    ),
    "MAGIC_CASTER": (
        "3. COMBAT ARCHETYPE [MAGIC_CASTER] — AUTHENTIC DOS SPELL/PRAYER CASTING KINEMATICS:\n"
        "- **STAFF / SCROLL HAND LOCK**: Staff, wand, or sacred scroll stays in the exact DOS-prescribed hand across all 6 frames.\n"
        "- **CASTING PROGRESSION**: F1 Poised idle -> F2 Raise staff / unroll scroll -> F3 Elemental/holy aura gathering around staff finial/hands -> F4 Peak radiant invocation flare -> F5 Forward directional release along diagonal target vector (`10:30 ↖` or `4:30 ↘`) -> F6 Calm recovery."
    ),
}

# ==============================================================================
# LAYER 4: STRUCTURED UNIT SPEC + DETERMINISTIC PROMPT COMPILER
# ==============================================================================

@dataclass
class EquipmentHandSpec:
    """Explicit DOS-verified left/right anatomical hand ownership (NEVER left vague!)."""
    right_hand: str        # Anatomical RIGHT hand of character
    left_hand: str         # Anatomical LEFT hand of character
    two_handed: bool = False

    def format_block(self, side: Side) -> str:
        if side == "player":
            r_view = "viewer-RIGHT side (character's anatomical RIGHT arm)"
            l_view = "viewer-LEFT side (character's anatomical LEFT arm)"
        else:
            r_view = "viewer-LEFT side (character's anatomical RIGHT arm)"
            l_view = "viewer-RIGHT side (character's anatomical LEFT arm)"
        grip_note = (
            "TWO-HANDED GRIP: Both gauntlets grip this single weapon shaft consistently across all 6 frames."
            if self.two_handed
            else "STRICT ASYMMETRIC HAND LOCK: These two hands MUST NEVER SWAP EQUIPMENT OR DISAPPEAR in ANY of the 6 frames (F1, F2, F3, F4, F5, F6)!!"
        )
        return (
            "4. MANDATORY DOS EQUIPMENT-HANDEDNESS TABLE (VERIFIED FROM 1995 DOS FIGANI — OBEY IN ALL 6 FRAMES!!):\n"
            f"- **CHARACTER'S RIGHT HAND ({r_view})**: {self.right_hand}\n"
            f"- **CHARACTER'S LEFT HAND ({l_view})**: {self.left_hand}\n"
            f"- {grip_note}"
        )


@dataclass
class UnitPromptSpec:
    uid: int
    name: str
    side: Side
    archetype: Archetype
    hands: EquipmentHandSpec
    visual_design: str
    frames_f1_to_f6: list[str]  # Strictly 6 strings: F1..F6
    extra_refs: list[tuple[str, str, str]] = field(default_factory=list)  # (path, mime, legend_line)


def build_prompt_and_refs(spec: UnitPromptSpec, portrait_path: str, dos_blueprint_path: str) -> tuple[str, list[tuple[str, str]]]:
    assert len(spec.frames_f1_to_f6) == 6, f"Unit #{spec.uid} must define exactly 6 frames!"

    refs: list[tuple[str, str]] = [
        (dos_blueprint_path, "image/png"),
        (portrait_path, "image/jpeg"),
    ]
    legend = [
        "- **Reference Image 1** = ORIGINAL 1995 DOS `FIGANI` 6-FRAME ACTION BLUEPRINT (PRIMARY SPATIAL LAYOUT & POSE TRUTH — match its EXACT `10:30 ↖` or `4:30 ↘` facing direction, weapon handedness, and action progression!).",
        "- **Reference Image 2** = THIS UNIT'S APPROVED HD PORTRAIT (100% EXACT LIKENESS LOCK: helmet/mask/horns/hair/species/colors!).",
    ]
    if spec.side == "player":
        refs.append((HERO_ORNATE_ANCHOR, "image/png"))
        legend.append(
            "- **Reference Image 3** = HIGH-ORNAMENT VANILLAWARE (*UNICORN OVERLORD*) REAR-3/4 STYLE ANCHOR "
            "(copy this exact baroque filigree, embroidered brocade hems, layered straps, painterly metallic shading & rear-3/4 `↖` perspective!)."
        )
    else:
        refs.append((ENEMY_ORNATE_ANCHOR, "image/png"))
        refs.append((HERO_ORNATE_ANCHOR, "image/png"))
        legend.append(
            "- **Reference Image 3** = HIGH-ORNAMENT ENEMY/BOSS FRONT-3/4 VANILLAWARE STYLE ANCHOR "
            "(copy this exact heavy-decoration front-3/4 `↘` armor filigree, rivets, embroidered tabards & painterly shading!)."
        )
        legend.append(
            "- **Reference Image 4** = VANILLAWARE TEXTURE & BROCADE DETAIL ANCHOR "
            "(copy ONLY its baroque embroidery, filigree & brushwork — NOT its rear camera angle!)."
        )

    for idx_e, (ep, em, el) in enumerate(spec.extra_refs, start=len(refs) + 1):
        refs.append((ep, em))
        legend.append(f"- **Reference Image {idx_e}** = {el}")

    cell_labels = [
        "F1 (Top-Left)", "F2 (Top-Center)", "F3 (Top-Right)",
        "F4 (Bottom-Left)", "F5 (Bottom-Center)", "F6 (Bottom-Right)",
    ]
    pose_lines = "\n".join(f"  * **{cell_labels[i]}**: {spec.frames_f1_to_f6[i]}" for i in range(6))

    prompt = (
        f"Create a clean **16:9 WIDESCREEN `3×2` (3 columns × 2 rows = EXACTLY 6 POSES) HD 2D ANIME GAME SPRITE SHEET** "
        f"that **DIRECTLY BEAUTIFIES & ELEVATES EACH OF THE 6 EXACT 1995 DOS PIXEL-ART POSES IN REFERENCE IMAGE 1 CELL-FOR-CELL IN PLACE** "
        f"(Top-Left HD cell = exact pose, facing & handedness of Top-Left DOS cell; Top-Center = Top-Center; Top-Right = Top-Right; "
        f"Bottom-Left = Bottom-Left; Bottom-Center = Bottom-Center; Bottom-Right = Bottom-Right — completing any DOS edge-clipped slash/weapon tips cleanly!) "
        f"for **{spec.name}** (*Flame Dragon II* HD Remake) on a **100% SOLID FLAT PURE WHITE `#FFFFFF` BACKGROUND**.\n\n"
        f"{CAMERA_TEMPLATES[spec.side]}\n\n"
        f"{STYLE_VANILLAWARE_ORNATE}\n\n"
        f"{ARCHETYPE_TEMPLATES[spec.archetype]}\n\n"
        f"{spec.hands.format_block(spec.side)}\n\n"
        "5. REFERENCE IMAGES:\n" + "\n".join(legend) + "\n\n"
        f"6. UNIT VISUAL DESIGN (HEAVY-DECORATION VANILLAWARE ELEVATION):\n{spec.visual_design}\n\n"
        f"7. EXACT 6-FRAME KINEMATIC SEQUENCE (1-TO-1 CELL MATCH TO REFERENCE IMAGE 1, OBEYING SECTIONS 1, 3 & 4!!):\n{pose_lines}\n"
    )
    return prompt, refs
