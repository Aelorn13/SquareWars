// components/player/shooting.js
import { inputState, updateInput, aimWorldTarget } from "./controls.js";
import { attachBuffManager } from "../effects/buffs/buffManager.js";

const BASE_PROJECTILE_SIZE = 6;
const DEFAULT_BULLET_SPREAD_DEG = 10;
const MIN_FIRE_RATE = 0.04;
const MULTIPLE_PROJECTILE_SCALLING = 0.65;

function getMultiProjectileDamageScale(numProjectiles) {
  if (numProjectiles <= 1) return 1;
  if (numProjectiles === 3) return MULTIPLE_PROJECTILE_SCALLING;
  const extraProjectiles = numProjectiles - 3;
  return Math.max(0.1, MULTIPLE_PROJECTILE_SCALLING - 0.05 * extraProjectiles);
}

export function setupPlayerShooting(k, player, gameState) {
  let canFire = true;
  const degToRad = (degrees) => (degrees * Math.PI) / 180;

  attachBuffManager(k, player);

  const getDamageBuffMultiplier = () => {
    const baseDamage = player._baseStats?.damage;
    if (typeof baseDamage === "number" && baseDamage > 0) return player.damage / baseDamage;
    return 1;
  };

  const fireProjectile = () => {
    const targetVec = aimWorldTarget(k, player.pos);
    const baseShotAngleRad = Math.atan2(targetVec.y - player.pos.y, targetVec.x - player.pos.x);

    const damageBuffMultiplier = getDamageBuffMultiplier();
    const hasDamageBuff = Math.abs(damageBuffMultiplier - 1) > 0.0001;

    const numProjectiles = Math.max(1, Math.floor(player.projectiles || 1));
    const baseSpreadDegrees = player.bulletSpreadDeg ?? DEFAULT_BULLET_SPREAD_DEG;
    const totalSpreadDegrees = numProjectiles === 1 ? 0 : baseSpreadDegrees * Math.sqrt(numProjectiles);

    const projectileAngleOffsetsDeg = [];
    if (numProjectiles === 1) projectileAngleOffsetsDeg.push(0);
    else {
      const step = totalSpreadDegrees / (numProjectiles - 1);
      const start = -totalSpreadDegrees / 2;
      for (let i = 0; i < numProjectiles; i++) projectileAngleOffsetsDeg.push(start + i * step);
    }

    const critChance = Math.max(0, Math.min(1, player.critChance || 0));
    const isCriticalHit = Math.random() < critChance;
    const critDamageMultiplier = isCriticalHit ? (player.critMultiplier ?? 2) : 1;

    const multiProjectileDamageScale = getMultiProjectileDamageScale(numProjectiles);
    const damagePerProjectile = player.damage * critDamageMultiplier * multiProjectileDamageScale;

    const damageSizeMultiplier = player.damage / 1;
    const projectileSize = Math.max(2, BASE_PROJECTILE_SIZE * damageSizeMultiplier * critDamageMultiplier);

    const projectileEffects = (player._projectileEffects ?? []).map(e => ({ ...e, params: { ...(e.params || {}) } }));

    for (const offsetDeg of projectileAngleOffsetsDeg) {
      const finalAngle = baseShotAngleRad + degToRad(offsetDeg);
      const dir = k.vec2(Math.cos(finalAngle), Math.sin(finalAngle));

      let color = hasDamageBuff ? k.rgb(255, 0, 255) : k.rgb(255, 255, 0);
      if (isCriticalHit) color = k.rgb(255, 0, 0);

      const sourceId = player.id ?? `player_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      const projectile = k.add([
        k.rect(projectileSize, projectileSize),
        k.color(color),
        k.pos(player.pos),
        k.area(),
        k.anchor("center"),
        k.offscreen({ destroy: true }),
        "projectile",
        {
          velocity: dir.scale(player.bulletSpeed),
          damage: damagePerProjectile,
          isCritical: isCriticalHit,
          effects: projectileEffects.map(pe => ({ ...pe, params: { ...(pe.params || {}) } })),
          source: player,
          sourceId,
        },
      ]);

      // initialize ricochet bounces if effect present
      const ric = projectile.effects?.find(ef => ef.type === "ricochet");
      if (ric?.params?.bounces) projectile._bouncesLeft = Math.max(0, Math.floor(ric.params.bounces));
      else projectile._bouncesLeft = projectile._bouncesLeft ?? 0;

      projectile.onUpdate(() => {
        if (!gameState.isPaused) projectile.pos = projectile.pos.add(projectile.velocity.scale(k.dt()));
      });

      // DO NOT register collision handlers on projectiles here.
      // enemy.onCollide("projectile", ...) handles collision, effects application and destruction.
    }
  };

  const tryFire = () => {
    if (!canFire) return;
    fireProjectile();
    canFire = false;
    const fireRate = Math.max(MIN_FIRE_RATE, player.attackSpeed || 0.1);
    k.wait(fireRate, () => { canFire = true; });
  };

  k.onMouseDown(() => (player.isShooting = true));
  k.onMouseRelease(() => (player.isShooting = false));

  k.onUpdate(() => {
    if (gameState.isPaused) return;
    updateInput(k, player.pos);
    const shootingNow = !!player.isShooting || !!inputState.firing;
    if (shootingNow) tryFire();
  });
}
