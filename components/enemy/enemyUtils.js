// components/enemy/enemyUtils.js
import { POWERUP_TYPES } from "../powerup/powerupTypes.js";
import { spawnPowerUp } from "../powerup/spawnPowerup.js";

/**
 * Linearly interpolates between two RGB colors based on a ratio.
 * @param {number[]} startColor - The starting RGB color [r, g, b].
 * @param {number[]} endColor - The ending RGB color [r, g, b].
 * @param {number} ratio - The interpolation ratio (0.0 to 1.0).
 * @returns {number[]} The interpolated RGB color.
 */
export function interpolateColor(startColor, endColor, ratio) {
  // Ensure ratio is clamped between 0 and 1 for proper interpolation
  const clampedRatio = Math.min(1, Math.max(0, ratio));
  const inverseRatio = 1 - clampedRatio;

  const r = Math.floor(startColor[0] * clampedRatio + endColor[0] * inverseRatio);
  const g = Math.floor(startColor[1] * clampedRatio + endColor[1] * inverseRatio);
  const b = Math.floor(startColor[2] * clampedRatio + endColor[2] * inverseRatio);

  return [r, g, b];
}

/**
 * Attempts to drop a power-up at a given position based on player's luck.
 * @param {KaboomCtx} k - The Kaboom context.
 * @param {GameObject} player - The player object with a 'luck' property.
 * @param {Vec2} position - The position where the power-up should spawn.
 * @param {object} sharedState - Global shared state object.
 */
export function dropPowerUp(k, player, position, sharedState) {
  const dropChance = player.luck ?? 0;

  // Only attempt to drop if there's a chance
  if (dropChance > 0 && Math.random() < dropChance) {
    const chosenPowerUpType = k.choose(Object.values(POWERUP_TYPES));
    spawnPowerUp(k, position, chosenPowerUpType, sharedState);
  }
}

/**
 * Applies a death animation to an enemy, involving scaling down and fading out.
 * Destroys the enemy object after the animation.
 * @param {KaboomCtx} k - The Kaboom context.
 * @param {GameObject} enemy - The enemy object to animate.
 */
export function enemyDeathAnimation(k, enemy) {
  enemy.dead = true;
  enemy.solid = false;
  enemy.area.enabled = false; // Disable collision detection

  const ANIM_DURATION = 0.4; // seconds
  const START_SCALE = 1;
  const END_SCALE = 0.1;
  const START_OPACITY = 1;
  const END_OPACITY = 0;

  let elapsedTime = 0;

  enemy.onUpdate(() => {
    elapsedTime += k.dt();
    // Calculate animation progress, clamping at 1 to prevent overshoot
    const progress = Math.min(elapsedTime / ANIM_DURATION, 1);

    // Interpolate scale from START_SCALE to END_SCALE
    const currentScale = START_SCALE + (END_SCALE - START_SCALE) * progress;
    enemy.scale = k.vec2(currentScale); // Use vec2(scalar) for uniform scaling

    // Interpolate opacity from START_OPACITY to END_OPACITY
    enemy.opacity = START_OPACITY + (END_OPACITY - START_OPACITY) * progress;

    // Destroy the enemy once animation is complete
    if (progress >= 1) {
      k.destroy(enemy);
    }
  });
}

/**
 * Picks a random spawn position just outside the edge of the game arena.
 * If sharedState.arena is not available, it defaults to the full screen dimensions.
 * @param {KaboomCtx} k - The Kaboom context.
 * @param {object} sharedState - Global shared state object, potentially containing 'arena' bounds.
 * @param {number} offset - The distance from the arena edge to spawn (default: 24).
 * @returns {Vec2} The calculated spawn position.
 */
export function pickEdgeSpawnPos(k, sharedState, offset = 24) {
  // Determine the effective arena boundaries
  const arenaBounds = sharedState?.area ?? { x: 0, y: 0, w: k.width(), h: k.height() };

  // Randomly select one of the four sides (0: top, 1: bottom, 2: left, 3: right)
  const side = Math.floor(Math.random() * 4);

  switch (side) {
    case 0: // Top edge
      return k.vec2(k.rand(arenaBounds.x, arenaBounds.x + arenaBounds.w), arenaBounds.y - offset);
    case 1: // Bottom edge
      return k.vec2(k.rand(arenaBounds.x, arenaBounds.x + arenaBounds.w), arenaBounds.y + arenaBounds.h + offset);
    case 2: // Left edge
      return k.vec2(arenaBounds.x - offset, k.rand(arenaBounds.y, arenaBounds.y + arenaBounds.h));
    case 3: // Right edge (default case)
      return k.vec2(arenaBounds.x + arenaBounds.w + offset, k.rand(arenaBounds.y, arenaBounds.y + arenaBounds.h));
    default:
        // This case should ideally not be reached, but good for robustness
        console.warn("Invalid side selected for spawn position.");
        return k.vec2(0,0); // Fallback to avoid errors
  }
}

/**
 * Tries multiple times to pick an edge spawn position that is a minimum distance
 * away from the player. Falls back to the last attempted position if all tries fail.
 * @param {KaboomCtx} k - The Kaboom context.
 * @param {object} sharedState - Global shared state object.
 * @param {GameObject} player - The player object with a 'pos' property.
 * @param {number} minDistance - Minimum required distance from the player (default: 120).
 * @param {number} edgeOffset - Distance from arena edge to spawn (default: 24).
 * @param {number} maxTries - Maximum number of attempts (default: 8).
 * @returns {Vec2} The chosen spawn position.
 */
export function pickEdgeSpawnPosFarFromPlayer(
  k,
  sharedState,
  player,
  minDistance = 120,
  edgeOffset = 24,
  maxTries = 8
) {
  let potentialPosition;
  let attempts = 0;

  do {
    potentialPosition = pickEdgeSpawnPos(k, sharedState, edgeOffset);
    attempts++;
    // Continue if still within maxTries AND the position is too close to the player
  } while (attempts < maxTries && potentialPosition.dist(player.pos) < minDistance);

  // Returns the first valid position found, or the last attempted position if all failed.
  return potentialPosition;
}

/**
 * Displays a visual telegraph (ring and pointer) at a given position,
 * indicating an upcoming enemy spawn. The telegraph points towards the arena center
 * and pulses before fading out.
 * @param {KaboomCtx} k - The Kaboom context.
 * @param {Vec2} spawnPosition - The position where the telegraph should appear.
 * @param {object} sharedState - Global shared state object, potentially containing 'arena' bounds.
 * @param {number} duration - The total duration of the telegraph animation in seconds (default: 0.6).
 * @returns {{ring: GameObject, pointer: GameObject}} An object containing references to the created Kaboom entities.
 */
export function showSpawnTelegraph(k, spawnPosition, sharedState, duration = 0.6) {
  // Determine the effective arena boundaries and center
  const arenaBounds = sharedState?.area ?? { x: 0, y: 0, w: k.width(), h: k.height() };
  const arenaCenter = k.vec2(arenaBounds.x + arenaBounds.w / 2, arenaBounds.y + arenaBounds.h / 2);

  // Calculate direction vector and angle from spawn position to arena center
  const directionToCenter = arenaCenter.sub(spawnPosition).unit();
  const rotationAngle = directionToCenter.angle(); // Angle in radians

  // --- Ring Pulse Component ---
  const ring = k.add([
    k.rect(18, 18, { radius: 9 }),
    k.pos(spawnPosition),
    k.anchor("center"),
    k.color(255, 255, 255),
    k.opacity(0.9),
    k.z(60), // Higher Z-index to be on top of most game elements
    "spawnTelegraph", // Tag for easy group management/destruction
    {
      // Custom component state and logic
      elapsedTime: 0,
      update() {
        this.elapsedTime += k.dt();
        const progress = Math.min(1, this.elapsedTime / duration);

        // Pulsing scale: starts at 0.6, goes up to 1.2, then back down
        const scalePulse = 0.6 + Math.sin(progress * Math.PI) * 0.6;
        this.scale = k.vec2(scalePulse); // Apply uniform scale

        // Fade out: goes from initial opacity to 0
        this.opacity = Math.max(0, 0.9 * (1 - progress)); // Using initial opacity as base

        if (this.elapsedTime >= duration) {
          k.destroy(this);
        }
      },
    },
  ]);

  // --- Directional Pointer Component ---
  const pointer = k.add([
    k.rect(36, 6, { radius: 3 }),
    k.pos(spawnPosition),
    k.anchor("center"),
    k.rotate(rotationAngle), // Rotate to point towards arena center
    k.color(255, 255, 255),
    k.opacity(0.9),
    k.z(61), // Even higher Z-index than the ring
    "spawnTelegraph",
    {
      // Custom component state and logic
      elapsedTime: 0,
      update() {
        this.elapsedTime += k.dt();
        const progress = Math.min(1, this.elapsedTime / duration);

        // Move slightly towards the center as it fades
        const movementOffset = directionToCenter.scale(8 * progress);
        this.pos = spawnPosition.add(movementOffset);

        // Slight scale increase while fading for visual effect
        const currentScale = 1 + progress * 0.4;
        this.scale = k.vec2(currentScale);

        // Fade out: goes from initial opacity to 0
        this.opacity = Math.max(0, 0.9 * (1 - progress)); // Using initial opacity as base

        if (this.elapsedTime >= duration) {
          k.destroy(this);
        }
      },
    },
  ]);

  return { ring, pointer };
}