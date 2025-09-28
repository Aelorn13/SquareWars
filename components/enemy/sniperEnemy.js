/**
 * components/enemy/sniperEnemy.js
 */

import { ENEMY_CONFIGS } from "./enemyConfig.js";
import { createEnemyGameObject } from "./enemyBehavior.js";
import { attachBuffManager } from "../buffManager.js";
import { applyProjectileEffects } from "../effects/applyProjectileEffects.js";
import { interpolateColor } from "./interpolateColor.js";

export function createSniperEnemy(k, player, gameContext, spawnPos) {
  const cfg = ENEMY_CONFIGS.sniper;
  const sniper = createEnemyGameObject(k, player, cfg, spawnPos, gameContext);

  // orbit / behavior state
  sniper._orbit = {
    angle: k.rand(0, Math.PI * 2),
    angSpeed: k.rand(0.9, 2.1) * (k.choose([1, -1])),
    minRadius: 150,
    radius: k.rand(150, 260),
    radiusTarget: k.rand(150, 260),
    changeTimer: k.rand(1.2, 3.0),
    centerOffset: k.vec2(k.rand(-120, 120), k.rand(-120, 120)),
    burstTimer: 0,
  };

  sniper._shootCooldown = k.rand(1.8, 3.2);

  const getArena = () => gameContext.sharedState?.area ?? { x: 0, y: 0, w: k.width(), h: k.height() };

  function computeMaxAllowedRadius(center) {
    const area = getArena();
    const margin = 8 + (sniper._size ?? 28);
    const maxX = Math.min(center.x - area.x, area.x + area.w - center.x);
    const maxY = Math.min(center.y - area.y, area.y + area.h - center.y);
    return Math.max(0, Math.min(maxX, maxY) - margin);
  }

  sniper.onUpdate(() => {
    if (sniper.gameContext.sharedState.isPaused || sniper.dead) return;
    const dt = k.dt();

    sniper._orbit.changeTimer -= dt;
    sniper._shootCooldown -= dt;
    if (sniper._orbit.burstTimer > 0) sniper._orbit.burstTimer -= dt;

    if (sniper._orbit.changeTimer <= 0) {
      sniper._orbit.angSpeed = k.rand(0.9, 2.6) * (k.choose([1, -1]));
      sniper._orbit.centerOffset = k.vec2(k.rand(-120, 120), k.rand(-120, 120));

      const desiredCenter = player.pos.add(sniper._orbit.centerOffset);
      const maxAllowed = computeMaxAllowedRadius(desiredCenter);
      const maxR = Math.max(sniper._orbit.minRadius, maxAllowed);
      sniper._orbit.radiusTarget = k.rand(sniper._orbit.minRadius, maxR);

      sniper._orbit.changeTimer = k.rand(1.0, 3.2);

      if (Math.random() < 0.28) {
        sniper._orbit.burstTimer = 0.18 + Math.random() * 0.4;
      }
    }

    sniper._orbit.radius += (sniper._orbit.radiusTarget - sniper._orbit.radius) * Math.min(1, dt * 2.6);
    const angMult = sniper._orbit.burstTimer > 0 ? 3 : 1;
    sniper._orbit.angle += sniper._orbit.angSpeed * angMult * dt;

    const desiredCenter = player.pos.add(sniper._orbit.centerOffset);
    sniper._orbit.center = sniper._orbit.center ? sniper._orbit.center.add(desiredCenter.sub(sniper._orbit.center).scale(Math.min(1, dt * 2.8))) : desiredCenter;

    const dir = k.vec2(Math.cos(sniper._orbit.angle), Math.sin(sniper._orbit.angle));
    let targetPos = sniper._orbit.center.add(dir.scale(sniper._orbit.radius));

    const area = getArena();
    const margin = 8 + (sniper._size ?? 28);
    const cx = Math.max(area.x + margin, Math.min(area.x + area.w - margin, targetPos.x));
    const cy = Math.max(area.y + margin, Math.min(area.y + area.h - margin, targetPos.y));
    const finalTarget = k.vec2(cx, cy);

    sniper.moveTo(finalTarget, sniper.speed);

    const lookDir = player.pos.sub(sniper.pos).unit();
    sniper.angle = lookDir.angle() + 90;

    if (sniper._shootCooldown <= 0 && !sniper.dead && !sniper.gameContext.sharedState.isPaused) {
      shootAtPlayer();
      sniper._shootCooldown = 2.8 + Math.random() * 1.2;
    }
  });

  function shootAtPlayer() {
    if (sniper.dead) return;
    const aim = player.pos.sub(sniper.pos).unit();
    const spawnPos = sniper.pos.add(aim.scale((sniper._size ?? 28) * 0.6 + 8));
    const projSpeed = 260;
    const proj = k.add([
      k.circle(5),
      k.pos(spawnPos),
      k.anchor("center"),
      k.area(),
      k.move(aim, projSpeed),
      k.rotate(aim.angle()),
      k.color(255, 165, 0),
      k.opacity(1),
      k.lifespan(4, { fade: 0.08 }),
      "enemyProjectile",
      { damage: sniper.damage ?? 2, source: sniper, sourceId: undefined, isCritical: false, _shouldDestroyAfterHit: true },
    ]);
    k.shake(0.04);
    return proj;
  }

  sniper.onCollide("projectile", (projectile) => {
    if (sniper.dead) return;
    if (projectile.source === sniper) return;

    try { attachBuffManager(k, sniper); } catch (e) {}

    try {
      applyProjectileEffects(k, projectile, sniper, { source: projectile.source, sourceId: projectile.sourceId });
    } catch (e) {}

    const damage = projectile.damage ?? 1;
    if (typeof sniper.takeDamage === "function") {
      sniper.takeDamage(damage, { source: projectile.source, isCrit: projectile.isCritical });
    } else if (typeof sniper.hurt === "function") {
      sniper.hurt(damage);
    } else {
      sniper.hp = Math.max(0, (sniper.hp ?? 0) - damage);
    }

    const hpNow = (typeof sniper.hp === "function" ? sniper.hp() : sniper.hp) ?? 0;
    if (hpNow > 0) {
      const hpRatio = Math.max(0.01, (typeof sniper.hp === "function" ? sniper.hp() : sniper.hp) / sniper.maxHp);
      sniper.color = k.rgb(...interpolateColor(sniper.originalColor, [240, 240, 240], hpRatio));
    } else {
      sniper.die();
    }

    const shouldDestroy = projectile._shouldDestroyAfterHit === undefined ? true : !!projectile._shouldDestroyAfterHit;
    if (shouldDestroy) {
      try { k.destroy(projectile); } catch (e) {}
    }
  });

  return sniper;
}
