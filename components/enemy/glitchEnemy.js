// ===== components/enemy/glitchEnemy.js =====
import { ENEMY_CONFIGS } from "./enemyConfig.js";
import { createEnemyGameObject, handleProjectileCollision, lerpAngle } from "./enemyBehavior.js";

const TELEPORT_COOLDOWN = 3.5;
const TELEPORT_FADE_TIME = 0.15;
const TELEPORT_MIN_DIST = 100;
const TELEPORT_MAX_DIST = 200;

export function createGlitchEnemy(k, player, gameContext, spawnPos) {
  const cfg = ENEMY_CONFIGS.glitch;
  const glitch = createEnemyGameObject(k, player, cfg, spawnPos, gameContext);

  glitch._teleportTimer = k.rand(1.0, TELEPORT_COOLDOWN);
  glitch._isVanishing = false;

  const getArena = () => gameContext.sharedState?.area ?? { x: 0, y: 0, w: k.width(), h: k.height() };

  function executeTeleport() {
    if (glitch._isVanishing || glitch.dead) return;
    glitch._isVanishing = true;

    // Fade out
    k.tween(glitch.opacity, 0, TELEPORT_FADE_TIME, (o) => (glitch.opacity = o)).then(() => {
      if (glitch.dead) return;

      // Find a new position
      const arena = getArena();
      const margin = glitch._size ?? 30;
      const randomDir = k.Vec2.fromAngle(k.rand(0, 360));
      const newPos = player.pos.add(randomDir.scale(k.rand(TELEPORT_MIN_DIST, TELEPORT_MAX_DIST)));

      // Clamp position to stay within the arena
      glitch.pos.x = k.clamp(newPos.x, arena.x + margin, arena.x + arena.w - margin);
      glitch.pos.y = k.clamp(newPos.y, arena.y + margin, arena.y + arena.h - margin);

      // Fade back in
      k.tween(glitch.opacity, cfg.opacity ?? 0.9, TELEPORT_FADE_TIME, (o) => (glitch.opacity = o)).then(() => {
        glitch._isVanishing = false;
        glitch._teleportTimer = TELEPORT_COOLDOWN * k.rand(0.8, 1.2);
      });
    });
  }

  glitch.onUpdate(() => {
    if (glitch.dead || glitch._isVanishing || gameContext.sharedState.isPaused) return;

    // Countdown to next teleport
    glitch._teleportTimer -= k.dt();
    if (glitch._teleportTimer <= 0) {
      executeTeleport();
      return;
    }

    // Standard movement behavior while not teleporting
    const dir = player.pos.sub(glitch.pos);
    const targetAngle = dir.angle() + 90;
    glitch.angle = lerpAngle(glitch.angle, targetAngle, k.dt() * 10);
    glitch.moveTo(player.pos, glitch.speed);
  });

  glitch.onCollide("projectile", (proj) => handleProjectileCollision(k, glitch, proj));

  return glitch;
}
