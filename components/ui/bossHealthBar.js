// components/ui/bossHealthBar.js

/**
 * Creates and manages a boss health bar UI element.
 * @param {kaboomCtx} k - The Kaboom.js/kaplay context object.
 * @param {object} boss - The boss entity whose health is to be displayed.
 * @returns {{
 *   background: kaboom.GameObj,
 *   foreground: kaboom.GameObj,
 *   update: Function,
 *   destroy: Function
 * }} An object containing references to the background and foreground bar entities,
 *    and functions to manually update and destroy them.
 */
export function createBossHealthBar(k, boss) {
  const BAR_WIDTH = k.width() * 0.8;
  const BAR_HEIGHT = 20;
  const BAR_Y_POS = k.height() - 30; // Position from bottom of screen

  // Health bar background (static dark grey bar)
  const background = k.add([
    k.rect(BAR_WIDTH, BAR_HEIGHT),
    k.pos(k.width() / 2, BAR_Y_POS),
    k.color(k.rgb(50, 50, 50)),
    k.anchor("center"),
    k.fixed(),
    k.z(100),
    "bossHealthBar",
  ]);

  const FOREGROUND_HORIZONTAL_PADDING = 4;
  const FOREGROUND_VERTICAL_PADDING = 4;

  // Health bar foreground (dynamic red bar)
  const foreground = k.add([
    k.rect(
      BAR_WIDTH - FOREGROUND_HORIZONTAL_PADDING,
      BAR_HEIGHT - FOREGROUND_VERTICAL_PADDING
    ),
    k.pos(k.width() / 2, BAR_Y_POS),
    k.color(k.rgb(200, 0, 0)),
    k.anchor("center"),
    k.fixed(),
    k.z(101),
    "bossHealthBar",
    {
      bossRef: boss, // Store a reference to the boss object
    },
  ]);

  /**
   * Updates the visual state of the boss health bar based on the boss's current health.
   * This function should be called in your game's onUpdate loop or when boss HP changes.
   */
  const updateHealthBar = () => {
    // Destroy the bar if the boss is gone or dead.
    if (!foreground.bossRef || foreground.bossRef.dead) {
      destroyHealthBar();
      return;
    }

    const currentBoss = foreground.bossRef;
    // Calculate health ratio, ensuring it doesn't go below 0.
    const healthRatio = Math.max(currentBoss.hp() / currentBoss.maxHp, 0);

    // Calculate the active width of the foreground bar.
    const activeBarWidth =
      (BAR_WIDTH - FOREGROUND_HORIZONTAL_PADDING) * healthRatio;
    foreground.width = activeBarWidth;

    // Adjust position for a left-to-right fill effect.
    // Anchor is center, so shift left by half the 'empty' portion.
    foreground.pos.x = k.width() / 2 - (foreground.width - activeBarWidth) / 2;
  };

  /**
   * Destroys both the background and foreground of the boss health bar.
   */
  const destroyHealthBar = () => {
      k.destroy(background);
      k.destroy(foreground);
  };

  // Attach the update function to Kaboom's global update loop.
  const updateEvent = k.onUpdate(updateHealthBar);

  // When the foreground bar is destroyed, also detach the onUpdate event and destroy background.
  k.on("destroy", foreground, () => {
    updateEvent.cancel();
    k.destroy(background);
    k.destroy(foreground);
  });

  return {
    background: background,
    foreground: foreground,
    update: updateHealthBar,
    destroy: destroyHealthBar,
  };
}
