
// ===== components/enemy/sniperEnemy.js =====
import { ENEMY_CONFIGS } from "./enemyConfig.js";
import { createEnemyGameObject, handleProjectileCollision } from "./enemyBehavior.js";

export function createSniperEnemy(k, player, gameContext, spawnPos) {
  const cfg = ENEMY_CONFIGS.sniper;
  const sniper = createEnemyGameObject(k, player, cfg, spawnPos, gameContext);

  // Initialize orbit behavior
  sniper._orbit = {
    angle: k.rand(0, Math.PI * 2),
    angSpeed: k.rand(0.9, 2.1) * k.choose([1, -1]),
    minRadius: 150,
    radius: k.rand(150, 260),
    radiusTarget: k.rand(150, 260),
    changeTimer: k.rand(1.2, 3.0),
    centerOffset: k.vec2(k.rand(-120, 120), k.rand(-120, 120)),
    burstTimer: 0,
    center: null,
  };

  sniper._shootCooldown = k.rand(1.8, 3.2);

  const getArena = () => gameContext.sharedState?.area ?? { 
    x: 0, y: 0, w: k.width(), h: k.height() 
  };

  function computeMaxRadius(center) {
    const area = getArena();
    const margin = 8 + (sniper._size ?? 28);
    const maxX = Math.min(center.x - area.x, area.x + area.w - center.x);
    const maxY = Math.min(center.y - area.y, area.y + area.h - center.y);
    return Math.max(0, Math.min(maxX, maxY) - margin);
  }

  function shootAtPlayer() {
    if (sniper.dead) return;
    
    const aim = player.pos.sub(sniper.pos).unit();
    const offset = (sniper._size ?? 28) * 0.6 + 8;
    const bulletPos = sniper.pos.add(aim.scale(offset));
    
    k.add([
      k.circle(5),
      k.pos(bulletPos),
      k.anchor("center"),
      k.area(),
      k.move(aim, 260),
      k.rotate(aim.angle()),
      k.color(255, 165, 0),
      k.opacity(1),
      k.lifespan(4, { fade: 0.08 }),
      "enemyProjectile",
      { 
        damage: sniper.damage ?? 2, 
        source: sniper, 
        _shouldDestroyAfterHit: true 
      },
    ]);
    
    k.shake(0.04);
  }

  sniper.onUpdate(() => {
    if (sniper.gameContext.sharedState.isPaused || sniper.dead) return;
    
    const dt = k.dt();
    const orbit = sniper._orbit;

    // Update timers
    orbit.changeTimer -= dt;
    sniper._shootCooldown -= dt;
    if (orbit.burstTimer > 0) orbit.burstTimer -= dt;

    // Change orbit parameters periodically
    if (orbit.changeTimer <= 0) {
      orbit.angSpeed = k.rand(0.9, 2.6) * k.choose([1, -1]);
      orbit.centerOffset = k.vec2(k.rand(-120, 120), k.rand(-120, 120));
      
      const desiredCenter = player.pos.add(orbit.centerOffset);
      const maxAllowed = computeMaxRadius(desiredCenter);
      orbit.radiusTarget = k.rand(orbit.minRadius, Math.max(orbit.minRadius, maxAllowed));
      orbit.changeTimer = k.rand(1.0, 3.2);
      
      // Occasional burst mode
      if (Math.random() < 0.28) {
        orbit.burstTimer = 0.18 + Math.random() * 0.4;
      }
    }

    // Smooth radius changes
    orbit.radius += (orbit.radiusTarget - orbit.radius) * Math.min(1, dt * 2.6);
    
    // Update angle (faster during burst)
    const speedMult = orbit.burstTimer > 0 ? 3 : 1;
    orbit.angle += orbit.angSpeed * speedMult * dt;

    // Smooth center tracking
    const desiredCenter = player.pos.add(orbit.centerOffset);
    orbit.center = orbit.center 
      ? orbit.center.lerp(desiredCenter, Math.min(1, dt * 2.8))
      : desiredCenter;

    // Calculate target position
    const dir = k.vec2(Math.cos(orbit.angle), Math.sin(orbit.angle));
    const targetPos = orbit.center.add(dir.scale(orbit.radius));

    // Keep within arena bounds
    const area = getArena();
    const margin = 8 + (sniper._size ?? 28);
    const clampedPos = k.vec2(
      Math.max(area.x + margin, Math.min(area.x + area.w - margin, targetPos.x)),
      Math.max(area.y + margin, Math.min(area.y + area.h - margin, targetPos.y))
    );

    // Move to position
    sniper.moveTo(clampedPos, sniper.speed);

    // Look at player
    const lookDir = player.pos.sub(sniper.pos).unit();
    sniper.angle = lookDir.angle() + 90;

    // Shoot periodically
    if (sniper._shootCooldown <= 0) {
      shootAtPlayer();
      sniper._shootCooldown = 2.8 + Math.random() * 1.2;
    }
  });

  // Use shared projectile handler
  sniper.onCollide("projectile", proj => handleProjectileCollision(k, sniper, proj));

  return sniper;
}