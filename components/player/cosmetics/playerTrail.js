// src/components/player/PlayerTrail.js
import { clamp, lerp, getNumericProp, getPlayerPosition } from "./playerCosmeticUtils.js";
import { TRAIL_CONFIG } from "./playerCosmeticConfig.js";

/**
 * Initializes and manages the player's movement trail effect.
 * @param {object} k - The Kaboom.js context object.
 * @param {object} player - The player object.
 * @param {object} [opts={}] - Optional configuration overrides.
 */
export function setupPlayerTrail(k, player, opts = {}) {
  const trailConfig = { ...TRAIL_CONFIG, ...(opts.trailConfig || {}) };

  player._cosmetics = player._cosmetics || {};
  Object.assign(player._cosmetics, {
    _trailConfig: trailConfig,
    _trail: { // State for the movement trail effect
      timer: 0,
      lastPos: getPlayerPosition(k, player),
      baselineSpeed: getNumericProp(player._baseStats, "speed", getNumericProp(player, "speed")),
    },
  });
}

/**
 * Updates the player's movement trail, emitting particles based on speed.
 * Call this in the main `onUpdate` loop.
 * @param {object} k - The Kaboom.js context object.
 * @param {object} player - The player object.
 */
export function updatePlayerTrail(k, player) {
  const { _cosmetics } = player;
  if (!_cosmetics || !_cosmetics._trailConfig || !_cosmetics._trail) return;

  const { _trailConfig, _trail, _attackColorCurrent } = _cosmetics; // Need current color for trail particle
  if (!_trailConfig.enabled) return;

  const dt = k.dt();
  const currentPos = player.pos;

  // Estimate instantaneous speed based on displacement since last frame
  const displacement = currentPos.sub(_trail.lastPos);
  const currentSpeed = dt > 0 ? displacement.len() / dt : 0;
  _trail.lastPos = getPlayerPosition(k, player); // Update last position for next frame

  const baselineSpeed = _trail.baselineSpeed > 0 ? _trail.baselineSpeed : getNumericProp(player, "speed");

  if (baselineSpeed > 0) {
    const speedThreshold = baselineSpeed * _trailConfig.speedThresholdMultiplier;
    // Trail intensity increases once speed surpasses the threshold
    const intensity = clamp(
      (currentSpeed - speedThreshold) / speedThreshold,
      0,
      1
    );

    _trail.timer -= dt;

    if (intensity > 0 && _trail.timer <= 0) {
      // Adjust emission cadence based on intensity (faster for higher intensity)
      // `1 - intensity` is used because maxEmissionInterval is a *smaller* number (faster rate).
      _trail.timer = lerp(
        _trailConfig.minEmissionInterval,
        _trailConfig.maxEmissionInterval,
        1 - intensity
      );

      // Get player dimensions for trail particle size
      const playerWidth = player.width ?? 20;
      const playerHeight = player.height ?? 20;
      const particleRadius = Math.min(playerWidth, playerHeight) * _trailConfig.particleRadiusFactor;

      // Trail particle components
      const trailComps = [
        k.rect(playerWidth, playerHeight, { radius: particleRadius }),
        k.pos(player.pos),
        k.anchor("center"),
        k.rotate(player.angle ?? 0),
        // Use the player's current interpolated color for the trail
        k.color(k.rgb(Math.round(_attackColorCurrent[0]), Math.round(_attackColorCurrent[1]), Math.round(_attackColorCurrent[2]))),
        k.opacity(lerp(_trailConfig.minParticleAlpha, _trailConfig.maxParticleAlpha, intensity)),
        k.lifespan(
          lerp(_trailConfig.minParticleLifespan, _trailConfig.maxParticleLifespan, intensity),
          { fade: lerp(0.1, 0.4, intensity) } // Fade duration scales with lifespan
        ),
        "playerTrail", // Tag for easy identification/deletion
      ];

      // Apply Z-offset if player has a Z-index
      if (typeof player.z === "number") {
        trailComps.push(k.z(player.z + (_trailConfig.zOffset ?? -1)));
      }

      k.add(trailComps);
    }
  }
}