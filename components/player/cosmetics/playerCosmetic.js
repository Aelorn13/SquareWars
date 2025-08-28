import { HP_SIZE_CONFIG, ATTACK_SPEED_COLOR_CONFIG, TRAIL_CONFIG, BARREL_CONFIG } from "./playerCosmeticConfig.js";
import { setupPlayerScale, updatePlayerScale } from "./playerHPScale.js";
import { setupPlayerAttackColor, updatePlayerAttackColor } from "./playerColourAttackSpeed.js";
import { setupPlayerTrail, updatePlayerTrail } from "./playerTrail.js";
import { updateBarrelsEntities, rebuildBarrelsAsEntities, destroyAllBarrels } from "./playerBarrels.js";

/**
 * Sets up various cosmetic effects for a player, including scale based on HP,
 * color based on attack speed, a movement trail, and dynamic weapon barrels.
 * This function orchestrates the setup of individual cosmetic components.
 * @param {object} k - The Kaboom.js context object.
 * @param {object} player - The player object to apply cosmetics to.
 * @param {object} [opts={}] - Optional configuration overrides for cosmetics.
 * @param {object} [opts.hpSizeConfig={}] - Overrides for HP size configuration.
 * @param {object} [opts.attackColorConfig={}] - Overrides for attack speed color configuration.
 * @param {object} [opts.trailConfig={}] - Overrides for movement trail configuration.
 * @param {object} [opts.barrelConfig={}] - Overrides for weapon barrel configuration.
 */
export function setupPlayerCosmetics(k, player, opts = {}) {
  // Initialize a dedicated object for cosmetics if it doesn't exist
  player._cosmetics = player._cosmetics || {};

  // Setup individual cosmetic components
  setupPlayerScale(k, player, opts);
  setupPlayerAttackColor(k, player, opts);
  setupPlayerTrail(k, player, opts);

  // Initialize barrels. The rebuild function handles initial creation.
  rebuildBarrelsAsEntities(k, player, opts.barrelConfig);


  // --- Frame Update Logic ---
  // This onUpdate callback orchestrates the updates for all cosmetic effects.
  player.onUpdate(() => {
    // Exit early if player no longer exists in the scene
    if (!player.exists?.()) return;

    // Update each cosmetic component
    updatePlayerScale(k, player);
    updatePlayerAttackColor(k, player);
    updatePlayerTrail(k, player);
    updateBarrelsEntities(k, player); // Barrels update also handles rebuilds
  });
}

// Re-export barrel functions for external access if needed (e.g., if projectiles change)
export { rebuildBarrelsAsEntities, destroyAllBarrels };