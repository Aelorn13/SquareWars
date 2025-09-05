/**
 * @file Contains the logic for the shockwave power-up effect.
 */

/**
 * Spawns a circular shockwave that expands outwards, damaging enemies.
 *
 * @param {object} k - The Kaboom.js context.
 * @param {Vec2} centerPosition - The shockwave's origin point.
 * @param {object} player - The player entity that triggered the shockwave.
 * @param {object} gameContext - Contains shared game state and logic, like `enemyDeathLogic`.
 * @param {object} [options={}] - Configuration for the shockwave.
 */
export function spawnShockwave(k, centerPosition, player, gameContext, options = {}) {
  // --- Configuration ---
  const {
    damage = 15,
    maxRadius = 400,
    expansionSpeed = 700,
    segmentCount = 28,
    segmentSize = 10,
    color = k.rgb(255, 150, 150),
  } = options;

  // Take a snapshot of enemies to avoid issues with newly spawned enemies.
  const enemiesInScene = k.get("enemy");
  const hitEnemies = new Set(); // Tracks enemies already hit to prevent multiple hits.

  // --- Visuals Setup ---
  // Pre-calculate direction vectors for each segment of the shockwave ring.
  const directionVectors = Array.from({ length: segmentCount }, (_, i) => {
    const angle = k.map(i, 0, segmentCount, 0, 360);
    return k.Vec2.fromAngle(angle);
  });

  const segments = directionVectors.map(() => k.add([
    k.rect(segmentSize, segmentSize, { radius: segmentSize / 2 }),
    k.color(color),
    k.pos(centerPosition),
    k.anchor("center"),
    k.opacity(1),
    k.z(210),
  ]));

  // --- Controller Logic ---
  // An invisible entity that manages the state and behavior of the shockwave.
  const shockwaveController = k.add([
    {
      currentRadius: 0,
      update() {
        // Expand the radius over time.
        this.currentRadius += expansionSpeed * k.dt();
        const progress = Math.min(1, this.currentRadius / maxRadius);

        this.updateVisuals(progress);
        this.checkCollisions();

        // When the shockwave reaches its max radius, destroy it and its visual segments.
        if (progress >= 1) {
          segments.forEach(k.destroy);
          k.destroy(this);
        }
      },
      updateVisuals(progress) {
        // As the shockwave expands, it fades out and has a subtle pulse.
        const opacity = 1 - progress;
        const pulseScale = 1 + 0.6 * (1 - Math.abs(0.5 - progress) * 2);

        segments.forEach((segment, i) => {
          segment.pos = centerPosition.add(directionVectors[i].scale(this.currentRadius));
          segment.opacity = opacity;
          segment.scale = pulseScale;
        });
      },
      checkCollisions() {
        for (const enemy of enemiesInScene) {
          if (!enemy.exists() || hitEnemies.has(enemy)) continue;

          // Simple circular collision check.
          const distanceToEnemy = enemy.pos.dist(centerPosition);
          if (distanceToEnemy <= this.currentRadius) {
            enemy.hurt(damage);
            hitEnemies.add(enemy); // Mark as hit.

            if (enemy.hp() <= 0) {
              gameContext.enemyDeathLogic(k, enemy, player, gameContext);
            }
          }
        }
      },
    },
  ]);

  // --- Initial Flash Effect ---
  k.add([
    k.text("💥", { size: 32 }),
    k.pos(centerPosition),
    k.anchor("center"),
    k.opacity(1), 
    k.lifespan(0.36),
    k.z(220),
  ]);
}