//components/powerup/powerupEffects/shockwaveEffect.js
export function spawnShockwave(k, centerPosition, options = {}) {
  const {
    damage = 15,
    maxRadius = 400,
    expansionSpeed = 700,
    segmentCount = 28,
    segmentSize = 10,
    color = k.rgb(255, 150, 150),
    sharedHitEnemies,
    sharedState,
  } = options;

  const hitEnemies = sharedHitEnemies || new Set();

  // Precompute direction unit vectors
  const directions = Array.from({ length: segmentCount }, (_, i) => {
    const angle = (i / segmentCount) * Math.PI * 2;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  });

  const segments = directions.map(() =>
    k.add([
      k.rect(segmentSize, segmentSize, { radius: segmentSize / 2 }),
      k.color(color),
      k.pos(centerPosition),
      k.anchor("center"),
      k.opacity(1),
      k.z(210),
    ])
  );

  const controller = k.add([
    {
      currentRadius: 0,
      update() {
        if (sharedState.isPaused || sharedState.upgradeOpen) return;
        this.currentRadius += expansionSpeed * k.dt();
        const progress = Math.min(1, this.currentRadius / maxRadius);

        // update visuals
        const opacity = 1 - progress;
        const pulseScale = 1 + 0.6 * (1 - Math.abs(0.5 - progress) * 2);

        for (let i = 0; i < segments.length; i++) {
          const dir = directions[i];
          const seg = segments[i];
          // safe add: handle kaboom vec2 or plain object
          const px = (centerPosition.x ?? centerPosition[0] ?? 0) + dir.x * this.currentRadius;
          const py = (centerPosition.y ?? centerPosition[1] ?? 0) + dir.y * this.currentRadius;
          if (typeof seg.pos === "function") {
            seg.pos(px, py);
          } else {
            seg.pos.x = px;
            seg.pos.y = py;
          }
          seg.opacity = opacity;
          seg.scale = pulseScale;
        }

        // collisions
        for (const enemy of k.get("enemy")) {
          if (!enemy.exists() || hitEnemies.has(enemy)) {
            continue;
          }
          const dist = enemy.pos.dist(centerPosition);

          if (dist <= this.currentRadius) {
            if (typeof enemy.takeDamage === "function") {
              enemy.takeDamage(damage, { source: controller });
            } else {
              enemy.hurt(damage);
            }
            hitEnemies.add(enemy);
          }
        }

        if (progress >= 1) {
          segments.forEach((s) => k.destroy(s));
          k.destroy(this);
        }
      },
    },
  ]);

  // initial flash
  k.add([
    k.text("💥", { size: 32 }),
    k.pos(centerPosition),
    k.anchor("center"),
    k.opacity(1),
    k.lifespan(0.36),
    k.z(220),
  ]);
}
