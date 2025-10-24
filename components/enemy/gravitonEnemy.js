// ===== components/enemy/gravitonEnemy.js =====
import { ENEMY_CONFIGS } from "./enemyConfig.js";
import { createEnemyGameObject, attachEnemyBehaviors } from "./enemyBehavior.js";

const PULL_RADIUS = 320;
const PULL_STRENGTH = 70; // Max pull speed at close range
const ENEMY_PULL_MODIFIER = 0.4; // Other enemies are pulled at 40% of the strength

export function createGravitonEnemy(k, player, gameContext, spawnPos) {
  const cfg = ENEMY_CONFIGS.graviton;
  const graviton = createEnemyGameObject(k, player, cfg, spawnPos, gameContext);
  graviton.use("enemy");

  attachEnemyBehaviors(k, graviton, player);

  const particleLoop = k.loop(0.05, () => {
    // Stop spawning particles if the enemy is dead or the game is paused
    if (graviton.dead || gameContext.sharedState.isPaused) return;

    if (player.exists() && graviton.pos.dist(player.pos) < PULL_RADIUS * 1.5) {
      const angle = k.rand(0, 2 * Math.PI);
      const spawnOffset = k.vec2(Math.cos(angle), Math.sin(angle)).scale(PULL_RADIUS);
      const particlePos = graviton.pos.add(spawnOffset);

      const particle = k.add([
        k.pos(particlePos),
        k.circle(k.rand(1, 3)),
        k.color(180, 180, 255),
        k.opacity(0.7),
        k.lifespan(0.7, { fade: 0.4 }),
      ]);

      particle.onUpdate(() => {
        const moveDir = graviton.pos.sub(particle.pos).unit();
        const dist = particle.pos.dist(graviton.pos);
        const speed = k.lerp(350, 80, dist / PULL_RADIUS);
        particle.move(moveDir.scale(speed));
      });
    }
  });

  graviton.onDestroy(() => {
    particleLoop.cancel();
  });

  graviton.onUpdate(() => {
    if (graviton.dead || gameContext.sharedState.isPaused) return;

    if (player.exists()) {
      const dist = graviton.pos.dist(player.pos);
      if (dist > 0 && dist < PULL_RADIUS) {
        const dir = graviton.pos.sub(player.pos).unit();
        const strengthRatio = 1 - (dist / PULL_RADIUS);
        const currentPullForce = PULL_STRENGTH * strengthRatio;
        player.pos = player.pos.add(dir.scale(currentPullForce * k.dt()));
      }
    }

    for (const otherEnemy of k.get("enemy")) {
      if (otherEnemy === graviton || otherEnemy.dead) {
        continue;
      }

      const dist = graviton.pos.dist(otherEnemy.pos);
      if (dist > 0 && dist < PULL_RADIUS) {
        const dir = graviton.pos.sub(otherEnemy.pos).unit();
        const strengthRatio = 1 - (dist / PULL_RADIUS);
        const pullForce = PULL_STRENGTH * ENEMY_PULL_MODIFIER * strengthRatio;

        if (otherEnemy.body) {
          otherEnemy.body.applyForce(dir.scale(pullForce * 50));
        } else {
          otherEnemy.pos = otherEnemy.pos.add(dir.scale(pullForce * k.dt()));
        }
      }
    }
  });

  return graviton;
}