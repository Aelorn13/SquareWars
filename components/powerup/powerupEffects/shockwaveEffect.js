
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
    segmentsCount = Math.max(6, opts.segments ?? 28), 
    segmentSize = Math.max(6, opts.segSize ?? 10),   
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