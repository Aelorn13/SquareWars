import { clamp, lerp, getNumericProp } from "./playerCosmeticUtils.js";
import { HP_SIZE_CONFIG } from "./playerCosmeticConfig.js";

/**
 * Initializes and manages player scaling based on HP.
 * @param {object} k - The Kaboom.js context object.
 * @param {object} player - The player object.
 * @param {object} [opts={}] - Optional configuration overrides.
 */
export function setupPlayerScale(k, player, opts = {}) {
  const sizeConfig = { ...HP_SIZE_CONFIG, ...(opts.hpSizeConfig || {}) };

  player._cosmetics = player._cosmetics || {};
  Object.assign(player._cosmetics, {
    _sizeConfig: sizeConfig,
    _targetScale: 1, // Target scale based on HP
  });

  /**
   * Recalculates the player's target scale based on their current HP ratio.
   * The scale will then smoothly interpolate to this target.
   */
  const recalculateTargetScale = () => {
    const currentHP = getNumericProp(player, "hp", 1);
    const maxHP = getNumericProp(player, "maxHP", currentHP); // Fallback to currentHP if maxHP is not available
    const hpRatio = clamp(maxHP > 0 ? currentHP / maxHP : 0, 0, 1);
    player._cosmetics._targetScale = lerp(
      sizeConfig.minScale,
      sizeConfig.maxScale,
      hpRatio
    );
  };

  // Subscribe to player HP change events to update scale
  if (typeof player.onHurt === "function") player.onHurt(recalculateTargetScale);
  if (typeof player.onHeal === "function") player.onHeal(recalculateTargetScale);
  if (typeof player.on === "function") {
    try {
      player.on("setMaxHP", recalculateTargetScale); // Assuming a custom event for max HP changes
    } catch (e) {
      // Ignore if 'on' method doesn't support custom events or throws
    }
  }
  recalculateTargetScale(); // Initial calculation
}

/**
 * Updates the player's scale, smoothly interpolating towards the target scale.
 * Call this in the main `onUpdate` loop.
 * @param {object} k - The Kaboom.js context object.
 * @param {object} player - The player object.
 */
export function updatePlayerScale(k, player) {
  const { _cosmetics } = player;
  if (!_cosmetics || !_cosmetics._sizeConfig) return;

  const { _sizeConfig, _targetScale } = _cosmetics;
  const currentScale = player.scale?.x ?? 1;
  const targetScale = _targetScale ?? 1;
  const scaleAlpha = 1 - Math.exp(-_sizeConfig.smoothingSpeed * k.dt());
  const nextScale = lerp(currentScale, targetScale, scaleAlpha);
  player.scale = k.vec2(nextScale, nextScale);
}