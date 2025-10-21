// components/ui/skill.js

/**
 * Draws a cooldown bar for the player's special skill, if they have an active one.
 * The bar is positioned directly below the dash cooldown bar.
 * If the player's skill is 'none' (passive), no bar is created.
 *
 * @param {KaboomCtx} k The Kaboom.js context object.
 * @param {Object} player The player game object, used to check for the selected skill.
 * @returns {KaboomComp | null} The fill component of the bar, or null if no bar is drawn.
 */
export function drawSkillCooldownBar(k, player) {
  // --- Conditional Rendering ---
  // If the player chose the passive skill, don't draw anything and exit the function.
  if (!player || player.specialSkillKey === 'none') {
    return null;
  }

  // --- Shared Layout Constants (to match the dash bar) ---
  const BAR_WIDTH = 76;
  const BAR_HEIGHT = 10;
  const X_OFFSET = 8;
  const Z_INDEX = 100;

  // --- Positioning Logic ---
  // Position the skill bar directly below the dash bar with a small gap.
  const DASH_BAR_Y_POS = 36;
  const GAP_BETWEEN_BARS = 4;
  const SKILL_BAR_Y_POS = DASH_BAR_Y_POS + BAR_HEIGHT + GAP_BETWEEN_BARS;
  const barX = k.width() - BAR_WIDTH - X_OFFSET;

  // Add the background rectangle.
  k.add([
    k.rect(BAR_WIDTH, BAR_HEIGHT),
    k.pos(barX, SKILL_BAR_Y_POS),
    k.color(60, 60, 60), // Dark grey background
    k.fixed(),
    k.z(Z_INDEX),
    'skillCooldownBarBg',
  ]);

  // Add the fill rectangle for the skill cooldown.
  const skillBarFill = k.add([
    k.rect(BAR_WIDTH, BAR_HEIGHT),
    k.pos(barX, SKILL_BAR_Y_POS),
    k.color(200, 0, 200), // Purple for the skill fill
    k.fixed(),
    k.z(Z_INDEX + 1),
    'skillCooldownBarFill',
    {
      fullWidth: BAR_WIDTH,
    },
  ]);

  return skillBarFill;
}