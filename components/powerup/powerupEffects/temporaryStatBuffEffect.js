// ==============================
// applyTemporaryStatBuff
// ==============================
/**
 * Applies a time-limited stat buff to an object. Buffs are layered,
 * allowing multiple buffs to stack or replace each other based on their mode.
 *
 * - Maintains a base snapshot per stat (`obj._baseStats`) to ensure buffs
 *   work correctly with permanent upgrades. This base is set on the first buff.
 * - Active buffs for a stat are stored in `obj._buffLayers[stat]`.
 * - Extending an existing buff updates its expiry time rather than adding a new entry.
 * - When all buffs for a stat expire, the stat is restored to its base value,
 *   and the base is then synced to the current value for future buffs.
 *
 * @param {object} k - The Kaboom.js context object, used for `k.wait`.
 * @param {object} obj - The object receiving the buff (e.g., player, enemy).
 * @param {string} statName - The name of the stat to buff (e.g., "attackSpeed", "damage").
 * @param {number} value - The value associated with the buff (multiplier, absolute value, or additive amount).
 * @param {number} durationSeconds - The duration of the buff in seconds.
 * @param {"multiplier" | "absolute" | "additive"} mode - The mode of the buff.
 *   - "multiplier" (default): `stat = base * value`
 *   - "absolute": `stat = value` (overrides all other buffs)
 *   - "additive": `stat = base + value`
 */
export function applyTemporaryStatBuff(
  k,
  obj,
  statName,
  value,
  durationSeconds,
  mode = "multiplier",
) {
  if (!obj) {
    console.warn("applyTemporaryStatBuff called with nullish object.");
    return;
  }

  // Initialize buff layers and base stats if they don't exist.
  const buffLayers = (obj._buffLayers ??= {});
  const baseStats = (obj._baseStats ??= {});
  const now = Date.now();
  const durationMs = Math.max(0, durationSeconds * 1000);

  // If this is the first time we're buffing this specific stat,
  // snapshot its current value as the base.
  if (baseStats[statName] === undefined) {
    baseStats[statName] = Number(obj[statName]) || 0;
  }

  /**
   * Recalculates the stat's effective value based on its base and all active buffs.
   * This function also handles syncing the base stat if no buffs remain.
   */
  const recomputeStat = () => {
    let currentVal = baseStats[statName];
    const activeBuffs = buffLayers[statName] || [];

    if (activeBuffs.length > 0) {
      let absoluteBuffApplied = false;
      for (const buff of activeBuffs) {
        if (buff.mode === "absolute") {
          // Absolute buffs override all others. If multiple absolute buffs exist,
          // the last one in the array (most recently applied) will take precedence
          // due to the loop order.
          currentVal = buff.value;
          absoluteBuffApplied = true;
        } else if (!absoluteBuffApplied) {
          // Apply multiplier or additive buffs only if no absolute buff is active.
          if (buff.mode === "multiplier") {
            currentVal *= buff.value;
          } else if (buff.mode === "additive") {
            currentVal += buff.value;
          }
        }
      }
    }

    obj[statName] = currentVal;

    // Special handling for attackSpeed to trigger UI updates if necessary.
    if (statName === "attackSpeed") {
      obj._cosmetics?.updateAttackSpeedColor?.();
    }

    // If no active buffs remain for this stat, sync the base value to the
    // current (potentially permanently upgraded) value for future buffs.
    if (activeBuffs.length === 0) {
      baseStats[statName] = Number(obj[statName]) || 0;
      // Clean up the empty layer array to keep `_buffLayers` tidy.
      delete buffLayers[statName];
    }
  };

  /**
   * Schedules the expiry of a specific buff entry.
   * @param {object} buffEntry - The buff object to schedule for expiry.
   */
  const scheduleBuffExpiry = (buffEntry) => {
    // Calculate remaining time for the buff. Ensure at least a small delay.
    const remainingTimeSeconds = Math.max(0.001, (buffEntry.endTime - Date.now()) / 1000);

    // Cancel any pre-existing timer for this buff to prevent multiple expirations.
    buffEntry.timer?.cancel?.();

    buffEntry.timer = k.wait(remainingTimeSeconds, () => {
      const activeBuffs = buffLayers[statName];
      if (activeBuffs) {
        // Remove the expired buff from the array.
        const buffIndex = activeBuffs.indexOf(buffEntry);
        if (buffIndex >= 0) {
          activeBuffs.splice(buffIndex, 1);
        }
      }
      recomputeStat(); // Recalculate stat after buff removal.
    });
  };

  // Get or initialize the array of buffs for this specific stat.
  const statBuffs = (buffLayers[statName] ??= []);

  // Check if an identical buff (same mode and value) already exists.
  // If so, just extend its duration.
  const existingBuff = statBuffs.find(
    (b) => b.mode === mode && b.value === value,
  );

  if (existingBuff) {
    existingBuff.endTime += durationMs;
    scheduleBuffExpiry(existingBuff); // Reschedule with new end time.
  } else {
    // Create a new buff entry and add it to the active buffs.
    const newBuffEntry = {
      mode,
      value,
      endTime: now + durationMs,
      timer: null, // Will be set by scheduleBuffExpiry
    };
    statBuffs.push(newBuffEntry);
    recomputeStat(); // Recalculate stat immediately as a new buff is active.
    scheduleBuffExpiry(newBuffEntry); // Schedule its expiry.
  }
}

// ==============================
// spawnShockwave
// ==============================
/**
 * Spawns a circular "shockwave" that expands from a `centerPos`.
 * It damages each enemy (present at cast time) once when the ring reaches them,
 * and then fades out, cleaning up its visual components.
 *
 * @param {object} k - The Kaboom.js context object.
 * @param {object} centerPos - A `k.Vec2` object indicating the center of the shockwave.
 * @param {object} opts - Configuration options for the shockwave.
 * @param {number} [opts.damage=5] - The amount of damage to deal to enemies.
 * @param {number} [opts.maxRadius=320] - The maximum radius the shockwave will expand to.
 * @param {number} [opts.speed=600] - The expansion speed of the shockwave in pixels per second.
 * @param {number} [opts.segments=28] - The number of visual segments forming the shockwave ring (min 6).
 * @param {number} [opts.segSize=10] - The size (width/height) of each individual segment.
 * @param {object} [opts.color=k.rgb(200,200,255)] - The `k.Color` of the shockwave segments.
 *
 * @returns {object} The Kaboom.js game object controlling the shockwave's expansion and logic.
 */
export function spawnShockwave(k, centerPos, opts = {}) {
  // Destructure and set default values for options.
  const {
    damage = 5,
    maxRadius = 320,
    speed = 600, // px / second
    segmentsCount = Math.max(6, opts.segments ?? 28), // Renamed for clarity, min 6 segments
    segmentSize = Math.max(6, opts.segSize ?? 10),    // Renamed for clarity, min 6 size
    segmentColor = opts.color ?? k.rgb(200, 200, 255),
  } = opts;

  // Snapshot of enemies at the moment of cast.
  // This prevents newly spawned enemies from being affected by this specific shockwave.
  // Ensure 'enemy' tag exists and create a shallow copy.
  const enemySnapshot = ((k.get && k.get("enemy")) || []).slice();

  // Precompute evenly distributed unit direction vectors around the circle.
  // This avoids redundant Math.cos/sin calculations in the update loop.
  const directionVectors = new Array(segmentsCount);
  for (let i = 0; i < segmentsCount; i++) {
    const angle = (i / segmentsCount) * Math.PI * 2;
    directionVectors[i] = k.vec2(Math.cos(angle), Math.sin(angle));
  }

  // Create visual ring segments (small rounded squares).
  const visualSegments = new Array(segmentsCount);
  for (let i = 0; i < segmentsCount; i++) {
    visualSegments[i] = k.add([
      k.rect(segmentSize, segmentSize, { radius: segmentSize / 2 }),
      k.color(segmentColor),
      k.pos(centerPos), // Use centerPos directly as k.pos can take a vec2
      k.anchor("center"),
      k.z(210), // Ensures segments are drawn above most other game elements.
      "shockSeg", // Tag for easy identification/selection if needed.
    ]);
  }

  // Set to track which enemies have already been damaged by this shockwave,
  // ensuring each enemy is hit only once.
  const hitEnemies = new Set();

  // The main controller game object drives the shockwave's expansion,
  // visual updates, and collision checks.
  const shockwaveController = k.add([
    {
      // Custom component properties
      currentRadius: 0,
      expansionSpeed: speed,
      maxExpansionRadius: maxRadius,

      // Kaboom's update method, called every frame.
      update() {
        // Expand the ring's radius over time.
        this.currentRadius += this.expansionSpeed * k.dt();

        // Calculate progress (0 to 1) and alpha (1 to 0) for fading.
        const progress = Math.min(1, this.currentRadius / this.maxExpansionRadius);
        const alpha = Math.max(0, 1 - progress); // Fades out as it expands

        // Update position, opacity, and scale for each visual segment.
        for (let i = 0; i < segmentsCount; i++) {
          const segment = visualSegments[i];
          // Basic existence checks for robustness, although `k.destroy` handles this
          // for the controller. Segments might be destroyed earlier if the game state changes
          // or if other systems interfere (though unlikely here).
          if (!segment || !segment.exists()) continue;

          // Position: center + (direction vector * current radius)
          segment.pos = centerPos.add(directionVectors[i].scale(this.currentRadius));
          segment.opacity = alpha;

          // Gentle "breathing" scale effect: 1x -> 1.6x -> 1x
          const pulseScale = 1 + 0.6 * (1 - Math.abs(0.5 - progress) * 2);
          segment.scale = k.vec2(pulseScale, pulseScale);
        }

        // Damage enemies that the ring has reached.
        for (const enemy of enemySnapshot) {
          // Skip if enemy is invalid, doesn't exist, is dead, or already hit.
          if (
            !enemy ||
            !enemy.exists() ||
            enemy.dead ||
            !enemy.pos ||
            hitEnemies.has(enemy)
          ) {
            continue;
          }

          // Approximate enemy as a circle for collision detection.
          const enemyHitboxRadius = Math.max(enemy.width ?? 0, enemy.height ?? 0) * 0.5;

          // Check if the shockwave's edge has reached or passed the enemy's center
          // plus its hitbox radius.
          if (enemy.pos.dist(centerPos) <= this.currentRadius + enemyHitboxRadius) {
            try {
              // Prefer `hurt` method if available, otherwise reduce `hp`.
              if (typeof enemy.hurt === "function") {
                enemy.hurt(damage);
              } else if (typeof enemy.hp === "number") {
                enemy.hp = Math.max(0, enemy.hp - damage);
              }
            } catch (err) {
              console.warn("Shockwave: Failed to apply damage to enemy:", enemy, err);
            }
            hitEnemies.add(enemy); // Mark enemy as hit.
          }
        }

        // Cleanup: If the wave has finished expanding, destroy all segments and the controller.
        if (this.currentRadius >= this.maxExpansionRadius) {
          for (const segment of visualSegments) {
            if (segment && segment.exists()) {
              k.destroy(segment);
            }
          }
          k.destroy(this); // Destroy the controller itself.
        }
      },
    },
  ]);

  // Visual feedback: A quick central flash at the start.
  const flashEffect = k.add([
    k.text("💥", { size: 32 }),
    k.pos(centerPos), // Use centerPos directly
    k.anchor("center"),
    k.z(220), // Higher z-index for flash to appear on top.
  ]);

  // Schedule the flash to be destroyed after a short delay.
  k.wait(0.36, () => {
    if (flashEffect && flashEffect.exists()) {
      k.destroy(flashEffect);
    }
  });

  return shockwaveController;
}