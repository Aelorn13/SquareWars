// src/components/player/PlayerBarrels.js
import { clamp, toRadians, toDegrees } from "./playerCosmeticUtils.js";
import { BARREL_CONFIG } from "./playerCosmeticConfig.js";

/**
 * Computes angular offsets for multiple barrels relative to a central aiming angle.
 * @param {object} player - The player object, used for `bulletSpreadDeg`.
 * @param {number} numBarrels - The number of barrels to compute offsets for.
 * @returns {number[]} An array of angular offsets in radians.
 */
function computeBarrelOffsets(player, numBarrels) {
  // Ensure numBarrels is a positive integer, clamped to a reasonable max
  const maxBarrels = BARREL_CONFIG.maxBarrels; // Use config here as well
  numBarrels = clamp(Math.floor(numBarrels), 1, maxBarrels);

  if (numBarrels === 1) return [0]; // No spread needed for a single barrel

  const baseSpreadDeg = Number(player.bulletSpreadDeg ?? 10);
  // Spread grows non-linearly with number of barrels for a more visually pleasing distribution
  const totalSpreadDeg = baseSpreadDeg * Math.sqrt(numBarrels);

  const stepDeg = totalSpreadDeg / (numBarrels - 1);
  const startDeg = -totalSpreadDeg / 2;

  const offsets = new Array(numBarrels);
  for (let i = 0; i < numBarrels; i++) {
    offsets[i] = toRadians(startDeg + i * stepDeg);
  }
  return offsets;
}

/**
 * Creates options for a Kaboom.js rectangle component based on barrel configuration.
 * @param {object} cfg - Barrel configuration.
 * @returns {object|undefined} An object with `radius` if `rounded` is true, otherwise undefined.
 */
function getRectOptions(cfg) {
  if (cfg.rounded) {
    return { radius: cfg.radius ?? Math.min(cfg.width, cfg.height) / 4 };
  }
  return undefined;
}

/**
 * Creates a single barrel entity and adds it to the Kaboom.js scene.
 * @param {object} k - The Kaboom.js context object.
 * @param {object} player - The player entity this barrel belongs to.
 * @param {object} cfg - The barrel configuration.
 * @returns {object} The newly created Kaboom.js barrel entity.
 */
function createBarrelEntity(k, player, cfg) {
  const { width, height, colour, outlineWidth, outlineColour, zOffset, z } = cfg;

  const components = [
    k.rect(width, height, getRectOptions(cfg)),
    k.pos(player.pos.x, player.pos.y), // Initial position, will be updated per frame
    k.anchor("center"),
    k.color(k.rgb(...(colour || BARREL_CONFIG.colour))), // Default to config if not provided
    k.outline(outlineWidth ?? 1, k.rgb(...(outlineColour || BARREL_CONFIG.outlineColour))),
    // Determine z-index: specific barrel z, player z + offset, or default 0
    k.z(typeof z === "number" ? z : (typeof player.z === "number" ? player.z + (zOffset ?? 0) : 0)),
    "playerBarrel", // Tag for all barrel entities
    { _isBarrel: true }, // Custom property for identification
  ];

  return k.add(components);
}

/**
 * Rebuilds the player's weapon barrel entities based on current `player.projectiles` count.
 * Destroys existing barrels and creates new ones.
 * @param {object} k - The Kaboom.js context object.
 * @param {object} player - The player entity.
 * @param {object} [barrelConfig={}] - Configuration overrides for the barrels.
 */
export function rebuildBarrelsAsEntities(k, player, barrelConfig = {}) {
  player._cosmetics = player._cosmetics || {};

  // Define default barrel configuration and merge with overrides
  const cfg = {
    ...BARREL_CONFIG, // Start with base config
    ...barrelConfig, // Apply overrides
  };
  player._cosmetics._barrelCfg = cfg; // Store the merged config

  // Destroy all previously tracked barrel entities
  player._cosmetics.barrels?.forEach(b => {
    try { b?.destroy?.(); } catch (e) { /* Ignore if already destroyed */ }
  });
  player._cosmetics.barrels = []; // Clear the array

  // Clean up any untracked 'playerBarrel' entities that might be lingering nearby
  try {
    k.get("playerBarrel")
      .filter(s => s.pos?.dist?.(player.pos) < (Math.max(player.width ?? 50, player.height ?? 50) * 2))
      .forEach(s => { s?.destroy?.(); });
  } catch (e) {
    // Ignore if k.get or destroy fails
  }

  // Create new barrel entities based on the player's `projectiles` count
  const desiredBarrelCount = clamp(Math.floor(player.projectiles ?? 1), 1, cfg.maxBarrels);
  for (let i = 0; i < desiredBarrelCount; i++) {
    const entity = createBarrelEntity(k, player, cfg);
    player._cosmetics.barrels.push(entity);
  }

  // Immediately update positions to avoid a visual flicker on rebuild
  updateBarrelsEntities(k, player);
}

/**
 * Updates the position, rotation, and color of all barrel entities attached to the player.
 * @param {object} k - The Kaboom.js context object.
 * @param {object} player - The player entity.
 */
export function updateBarrelsEntities(k, player) {
  player._cosmetics = player._cosmetics || {};
  player._cosmetics.barrels = player._cosmetics.barrels || [];
  const cfg = player._cosmetics._barrelCfg || BARREL_CONFIG; // Use stored config or default

  // Rebuild if no barrels exist but player has projectiles, or if projectile count changed
  const desiredBarrelCount = clamp(Math.floor(player.projectiles ?? 1), 1, cfg.maxBarrels);
  if (player._cosmetics.barrels.length !== desiredBarrelCount) {
    rebuildBarrelsAsEntities(k, player, cfg);
    return;
  }
  // If no barrels are being tracked and 0 desired, just exit.
  if (desiredBarrelCount === 0) return;

  // Calculate the base angle towards the mouse cursor (or a default forward direction)
  const mousePos = k.mousePos?.() ?? { x: player.pos.x + 1, y: player.pos.y };
  const baseAimAngleRad = Math.atan2(mousePos.y - player.pos.y, mousePos.x - player.pos.x);

  // Calculate the distance from the player's center to the barrel's mounting point
  const playerHalfSize = Math.max(Number(player.width ?? 0), Number(player.height ?? 0)) * 0.5 || 25;
  const barrelHalfWidth = (cfg.width ?? BARREL_CONFIG.width) * 0.5;
  const mountDistance = playerHalfSize + barrelHalfWidth - (cfg.inset ?? BARREL_CONFIG.inset);

  // Compute individual angular offsets for each barrel
  const barrelOffsetsRad = computeBarrelOffsets(player, desiredBarrelCount);

  // Use the barrel's configured color (it's typically static, unlike player body color)
  const barrelColor = cfg.colour ?? BARREL_CONFIG.colour;
  const rgbColor = k.rgb(Math.round(barrelColor[0]), Math.round(barrelColor[1]), Math.round(barrelColor[2]));

  // Update each barrel entity's position, rotation, and color
  for (let i = 0; i < player._cosmetics.barrels.length; i++) {
    const barrel = player._cosmetics.barrels[i];
    if (!barrel) continue;

    const offsetRad = barrelOffsetsRad[i] ?? 0;
    const finalAngleRad = baseAimAngleRad + offsetRad;

    // Calculate barrel position based on player position, mount distance, and final angle
    const posX = player.pos.x + Math.cos(finalAngleRad) * mountDistance;
    const posY = player.pos.y + Math.sin(finalAngleRad) * mountDistance;

    try {
      barrel.pos = k.vec2(posX, posY);
      barrel.angle = toDegrees(finalAngleRad); // Kaboom.js expects degrees for the 'angle' property
      barrel.use(k.color(rgbColor)); // Reapply color to ensure it's consistent
    } catch (e) {
      // Catch errors if a barrel entity might have been destroyed externally mid-loop
    }
  }
}

/**
 * Destroys all barrel entities associated with a player.
 * @param {object} k - The Kaboom.js context object.
 * @param {object} player - The player entity.
 */
export function destroyAllBarrels(k, player) {
  player._cosmetics?.barrels?.forEach(b => {
    try { b?.destroy?.(); } catch (e) { /* Ignore if already destroyed */ }
  });
  player._cosmetics.barrels = []; // Clear the array to ensure no stale references
}