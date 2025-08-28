// src/components/player/PlayerAttackColor.js
import { clamp, lerp, getNumericProp } from "./playerCosmeticUtils.js";
import { ATTACK_SPEED_COLOR_CONFIG } from "./playerCosmeticConfig.js";

/**
 * Initializes and manages player color based on attack speed.
 * @param {object} k - The Kaboom.js context object.
 * @param {object} player - The player object.
 * @param {object} [opts={}] - Optional configuration overrides.
 */
export function setupPlayerAttackColor(k, player, opts = {}) {
  const colorConfig = { ...ATTACK_SPEED_COLOR_CONFIG, ...(opts.attackColorConfig || {}) };

  player._cosmetics = player._cosmetics || {};
  Object.assign(player._cosmetics, {
    _colorConfig: colorConfig,
    _attackSpeedBaseline: getNumericProp(player._baseStats, "attackSpeed", 0),
    _attackColorCurrent: [...colorConfig.baseColor], // Current interpolated color
    _attackColorTarget: [...colorConfig.baseColor], // Target color based on attack speed
  });

  /**
   * Updates the player's target color based on the difference between current
   * and baseline attack speed. Faster attack speed (lower value) shifts towards `targetColor`.
   * This function is made accessible for external triggers if needed.
   */
  player._cosmetics.updateAttackSpeedColor = function () {
    const { _attackSpeedBaseline } = player._cosmetics;
    const currentAttackSpeed = Number(player.attackSpeed) || 0;

    if (!_attackSpeedBaseline || _attackSpeedBaseline <= 0) {
      player._cosmetics._attackColorTarget = [...colorConfig.baseColor];
      return;
    }

    // Calculate ratio based on how much current AS deviates from baseline
    // A lower currentAttackSpeed (faster) means a higher 'deviation'
    const attackSpeedDeviationRatio = clamp(
      (_attackSpeedBaseline - currentAttackSpeed) / _attackSpeedBaseline,
      0,
      1
    );

    // Apply a square root for a non-linear feel: smaller changes are more noticeable
    const intensity = Math.sqrt(attackSpeedDeviationRatio);

    player._cosmetics._attackColorTarget = [
      Math.round(lerp(colorConfig.baseColor[0], colorConfig.targetColor[0], intensity)),
      Math.round(lerp(colorConfig.baseColor[1], colorConfig.targetColor[1], intensity)),
      Math.round(lerp(colorConfig.baseColor[2], colorConfig.targetColor[2], intensity)),
    ];
  };

  player._cosmetics.updateAttackSpeedColor(); // Initial color setup
}

/**
 * Updates the player's color, smoothly interpolating towards the target color.
 * Applies the new color to the player entity. Call this in the main `onUpdate` loop.
 * @param {object} k - The Kaboom.js context object.
 * @param {object} player - The player object.
 */
export function updatePlayerAttackColor(k, player) {
  const { _cosmetics } = player;
  if (!_cosmetics || !_cosmetics._colorConfig) return;

  const { _colorConfig, _attackColorCurrent, _attackColorTarget } = _cosmetics;
  const colorAlpha = 1 - Math.exp(-_colorConfig.smoothingSpeed * k.dt());

  // Interpolate each RGB component
  for (let i = 0; i < 3; i++) {
    _attackColorCurrent[i] = lerp(_attackColorCurrent[i], _attackColorTarget[i], colorAlpha);
  }

  player.use(
    k.color(
      k.rgb(
        Math.round(_attackColorCurrent[0]),
        Math.round(_attackColorCurrent[1]),
        Math.round(_attackColorCurrent[2])
      )
    )
  );
}