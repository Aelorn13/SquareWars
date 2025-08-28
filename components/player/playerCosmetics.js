// --- Configuration Constants ---

/**
 * Configuration for player size scaling based on HP.
 * @type {object}
 * @property {number} minScale - Minimum scale factor for the player.
 * @property {number} maxScale - Maximum scale factor for the player.
 * @property {number} smoothingSpeed - Speed at which the scale interpolates towards the target.
 */
export const HP_SIZE_CONFIG = {
  minScale: 0.5,
  maxScale: 2,
  smoothingSpeed: 8,
};

/**
 * Configuration for player color change based on attack speed.
 * @type {object}
 * @property {number[]} baseColor - RGB array for the default color [R, G, B].
 * @property {number[]} targetColor - RGB array for the color at max attack speed difference [R, G, B].
 * @property {number} smoothingSpeed - Speed at which the color interpolates towards the target.
 */
export const ATTACK_SPEED_COLOR_CONFIG = {
  baseColor: [0, 0, 255],
  targetColor: [255, 255, 0],
  smoothingSpeed: 10,
};

/**
 * Configuration for the player's movement trail (for fast movement/dashing).
 * @type {object}
 * @property {boolean} enabled - Whether the trail effect is enabled.
 * @property {number} speedThresholdMultiplier - Multiplier for baseline speed to determine trail emission threshold.
 * @property {number} minEmissionInterval - Slowest interval (seconds) for trail particle emission.
 * @property {number} maxEmissionInterval - Fastest interval (seconds) for trail particle emission.
 * @property {number} minParticleLifespan - Minimum lifespan (seconds) for trail particles.
 * @property {number} maxParticleLifespan - Maximum lifespan (seconds) for trail particles.
 * @property {number} minParticleAlpha - Minimum opacity for trail particles.
 * @property {number} maxParticleAlpha - Maximum opacity for trail particles.
 * @property {number} particleRadiusFactor - Factor to determine the trail particle's corner radius relative to player size.
 * @property {number} zOffset - Z-index offset for trail particles relative to the player.
 */
export const TRAIL_CONFIG = {
  enabled: true,
  speedThresholdMultiplier: 3, // Trail emits when current speed exceeds baselineSpeed * this multiplier
  minEmissionInterval: 0.06, // Slowest emission cadence
  maxEmissionInterval: 0.015, // Fastest emission cadence (at max intensity)
  minParticleLifespan: 0.15,
  maxParticleLifespan: 0.35,
  minParticleAlpha: 0.15,
  maxParticleAlpha: 0.6,
  particleRadiusFactor: 0.25, // Rounded corners for trail quads
  zOffset: -1, // Render behind player (if player.z is set)
};

// --- Utility Functions ---

/**
 * Clamps a value between a minimum and maximum.
 * @param {number} value - The value to clamp.
 * @param {number} min - The minimum allowed value.
 * @param {number} max - The maximum allowed value.
 * @returns {number} The clamped value.
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linearly interpolates between two values.
 * @param {number} a - The start value.
 * @param {number} b - The end value.
 * @param {number} t - The interpolation factor (0.0 to 1.0).
 * @returns {number} The interpolated value.
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Safely retrieves a numerical property from an object, handling functions and nullish values.
 * @param {object} obj - The object to retrieve the property from.
 * @param {string} prop - The name of the property.
 * @param {number} [defaultValue=0] - The default value if the property is not found or invalid.
 * @returns {number} The numerical value of the property or the default value.
 */
function getNumericProp(obj, prop, defaultValue = 0) {
  const value = obj[prop];
  if (typeof value === "function") {
    return Number(value()) || defaultValue;
  }
  return Number(value) || defaultValue;
}

/**
 * Gets a player's position, ensuring it's a `k.Vec2` object.
 * @param {object} k - The Kaboom.js context object.
 * @param {object} player - The player object.
 * @returns {k.Vec2} The player's position as a k.Vec2.
 */
function getPlayerPosition(k, player) {
  if (player.pos && typeof player.pos.clone === "function") {
    return player.pos.clone();
  }
  return k.vec2(player.pos.x, player.pos.y);
}


// --- Main Setup Function ---

/**
 * Sets up various cosmetic effects for a player, including scale based on HP,
 * color based on attack speed, and a movement trail.
 * @param {object} k - The Kaboom.js context object.
 * @param {object} player - The player object to apply cosmetics to.
 * @param {object} [opts={}] - Optional configuration overrides for cosmetics.
 * @param {object} [opts.hpSizeConfig={}] - Overrides for HP size configuration.
 * @param {object} [opts.attackColorConfig={}] - Overrides for attack speed color configuration.
 * @param {object} [opts.trailConfig={}] - Overrides for movement trail configuration.
 */
export function setupPlayerCosmetics(k, player, opts = {}) {
  // Merge default configurations with any provided overrides
  const sizeConfig = { ...HP_SIZE_CONFIG, ...(opts.hpSizeConfig || {}) };
  const colorConfig = { ...ATTACK_SPEED_COLOR_CONFIG, ...(opts.attackColorConfig || {}) };
  const trailConfig = { ...TRAIL_CONFIG, ...(opts.trailConfig || {}) };

  // Initialize a dedicated object for cosmetics if it doesn't exist
  player._cosmetics = player._cosmetics || {};

  // Store configurations directly on the cosmetics object for easy access in update
  Object.assign(player._cosmetics, {
    _sizeConfig: sizeConfig,
    _colorConfig: colorConfig,
    _trailConfig: trailConfig,
    _targetScale: 1, // Target scale based on HP
    _attackSpeedBaseline: getNumericProp(player._baseStats, "attackSpeed", 0),
    _attackColorCurrent: [...colorConfig.baseColor], // Current interpolated color
    _attackColorTarget: [...colorConfig.baseColor], // Target color based on attack speed
    _trail: { // State for the movement trail effect
      timer: 0,
      lastPos: getPlayerPosition(k, player),
      baselineSpeed: getNumericProp(player._baseStats, "speed", getNumericProp(player, "speed")),
    },
  });

  // --- HP-based Scaling ---

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

  // --- Attack Speed-based Color ---

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

  // --- Frame Update Logic ---

  player.onUpdate(() => {
    // Exit early if player no longer exists in the scene
    if (!player.exists?.()) return;

    const { _cosmetics } = player;
    const { _sizeConfig, _colorConfig, _trailConfig, _trail } = _cosmetics;

    // --- Scale Smoothing ---
    const currentScale = player.scale?.x ?? 1;
    const targetScale = _cosmetics._targetScale ?? 1;
    const scaleAlpha = 1 - Math.exp(-_sizeConfig.smoothingSpeed * k.dt());
    const nextScale = lerp(currentScale, targetScale, scaleAlpha);
    player.scale = k.vec2(nextScale, nextScale);

    // --- Color Smoothing ---
    const currentColor = _cosmetics._attackColorCurrent;
    const targetColor = _cosmetics._attackColorTarget;
    const colorAlpha = 1 - Math.exp(-_colorConfig.smoothingSpeed * k.dt());

    // Interpolate each RGB component
    for (let i = 0; i < 3; i++) {
      currentColor[i] = lerp(currentColor[i], targetColor[i], colorAlpha);
    }

    player.use(
      k.color(
        k.rgb(
          Math.round(currentColor[0]),
          Math.round(currentColor[1]),
          Math.round(currentColor[2])
        )
      )
    );

    // --- Fast-Movement Trail ---
    if (_trailConfig.enabled) {
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
          _trail.timer = lerp(
            _trailConfig.minEmissionInterval,
            _trailConfig.maxEmissionInterval,
            1 - intensity // Invert intensity for lerp, as maxInterval is faster (lower value)
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
            k.color(k.rgb(Math.round(currentColor[0]), Math.round(currentColor[1]), Math.round(currentColor[2]))),
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

    // Call barrel update function on every frame
    updateBarrelsEntities(k, player);
  });
}

// ============================
// --- Barrel-Child Helper Functions ---
// These functions manage the visual representation of weapon barrels attached to the player.
// Note: 'colour' is used in config for consistency with provided code, but Kaboom.js functions use 'color'.
// ============================

/** Converts degrees to radians. */
const toRadians = (degrees) => (degrees * Math.PI) / 180;
/** Converts radians to degrees. */
const toDegrees = (radians) => (radians * 180) / Math.PI;

/**
 * Computes angular offsets for multiple barrels relative to a central aiming angle.
 * @param {object} player - The player object, used for `bulletSpreadDeg`.
 * @param {number} numBarrels - The number of barrels to compute offsets for.
 * @returns {number[]} An array of angular offsets in radians.
 */
function computeBarrelOffsets(player, numBarrels) {
  // Ensure numBarrels is a positive integer, clamped to a reasonable max
  const maxBarrels = 15;
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
    k.color(k.rgb(...(colour || [255, 220, 20]))),
    k.outline(outlineWidth ?? 1, k.rgb(...(outlineColour ?? [40, 40, 0]))),
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
    width: 32,
    height: 8,
    colour: [255, 220, 20],
    rounded: false,
    outlineWidth: 1,
    outlineColour: [40, 40, 0],
    zOffset: -0.5, // Render slightly in front of the player by default
    inset: 16, // How much the barrel "sinks" into the player graphic
    maxBarrels: 15,
    ...barrelConfig,
  };

  // Destroy all previously tracked barrel entities
  player._cosmetics.barrels?.forEach(b => {
    try { b?.destroy?.(); } catch (e) { /* Ignore if already destroyed */ }
  });
  player._cosmetics.barrels = []; // Clear the array

  // Clean up any untracked 'playerBarrel' entities that might be lingering nearby
  // This handles cases where barrels might have been added manually or tracked incorrectly.
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

  // Save the final barrel config for use in the update loop
  player._cosmetics._barrelCfg = cfg;

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
  const cfg = player._cosmetics._barrelCfg || {}; // Get stored config

  // Guard against missing barrels or config
  if (!player._cosmetics.barrels.length && !cfg.maxBarrels) {
    // If no barrels are being tracked and no maxBarrels config, it means barrels
    // haven't been set up yet or were explicitly removed.
    // If player.projectiles is present, we should attempt to rebuild.
    if (player.projectiles !== undefined) {
        rebuildBarrelsAsEntities(k, player, cfg);
        return;
    }
    return; // No barrels to update and no trigger to rebuild
  }


  // Rebuild if the number of projectiles has changed or if barrels haven't been created yet
  const desiredBarrelCount = clamp(Math.floor(player.projectiles ?? 1), 1, cfg.maxBarrels ?? 15);
  if (player._cosmetics.barrels.length !== desiredBarrelCount) {
    rebuildBarrelsAsEntities(k, player, cfg);
    return;
  }

  // Calculate the base angle towards the mouse cursor (or a default forward direction)
  const mousePos = k.mousePos?.() ?? { x: player.pos.x + 1, y: player.pos.y };
  const baseAimAngleRad = Math.atan2(mousePos.y - player.pos.y, mousePos.x - player.pos.x);

  // Calculate the distance from the player's center to the barrel's mounting point
  const playerHalfSize = Math.max(Number(player.width ?? 0), Number(player.height ?? 0)) * 0.5 || 25; // Default to 25 if no player size
  const barrelHalfWidth = (cfg.width ?? 32) * 0.5;
  const mountDistance = playerHalfSize + barrelHalfWidth - (cfg.inset ?? 8);

  // Compute individual angular offsets for each barrel
  const barrelOffsetsRad = computeBarrelOffsets(player, desiredBarrelCount);

  // Use the barrel's configured color (it's typically static, unlike player body color)
  const barrelColor = cfg.colour ?? [255, 220, 20];
  const rgbColor = k.rgb(Math.round(barrelColor[0]), Math.round(barrelColor[1]), Math.round(barrelColor[2]));

  // Update each barrel entity's position, rotation, and color
  for (let i = 0; i < player._cosmetics.barrels.length; i++) {
    const barrel = player._cosmetics.barrels[i];
    if (!barrel) continue; // Skip if barrel is somehow missing

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