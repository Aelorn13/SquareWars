import { inputState, updateInput, aimWorldTarget } from "./controls.js";
import { attachBuffManager } from "../buffManager.js";

const CONFIG = {
  BASE_SIZE: 6,
  DEFAULT_SPREAD: 10,
  MIN_FIRE_RATE: 0.04,
  MULTI_SCALE: 0.65
};

function getDamageScale(numProjectiles) {
  if (numProjectiles <= 1) return 1;
  if (numProjectiles === 3) return CONFIG.MULTI_SCALE;
  // Further reduction for 4+ projectiles
  return Math.max(0.1, CONFIG.MULTI_SCALE - 0.05 * (numProjectiles - 3));
}

export function setupPlayerShooting(k, player, gameState) {
  let canFire = true;
  attachBuffManager(k, player);
  
  const getBuffMultiplier = () => {
    const base = player._baseStats?.damage;
    return (base > 0) ? player.damage / base : 1;
  };
  
  const createProjectile = (angle, damage, size, color, effects, speed) => {
    const dir = k.vec2(Math.cos(angle), Math.sin(angle));
    const sourceId = player.id ?? `p_${Date.now()}_${Math.random()}`;
    
    const proj = k.add([
      k.rect(size, size),
      k.color(color),
      k.pos(player.pos),
      k.z(player.z),
      k.area(),
      k.anchor("center"),
      k.offscreen({ destroy: true }),
      "projectile",
      {
        velocity: dir.scale(speed),
        damage,
        isCritical: color.eq(k.rgb(255, 0, 0)), // Red = crit
        effects: effects.map(e => ({ ...e, params: { ...e.params } })),
        source: player,
        sourceId,
        _bouncesLeft: 0
      }
    ]);
    
    // Initialize ricochet bounces
    const ricochet = proj.effects?.find(e => e.type === "ricochet");
    if (ricochet?.params?.bounces) {
      proj._bouncesLeft = Math.floor(ricochet.params.bounces);
    }
    
    proj.onUpdate(() => {
      if (!gameState.isPaused) {
        proj.pos = proj.pos.add(proj.velocity.scale(k.dt()));
      }
    });
    
    return proj;
  };
  
   const fire = (forcedTarget) => {
    // prefer explicit auto-aim world target when provided
    const target = forcedTarget ?? (player._autoAimTarget ?? aimWorldTarget(k, player.pos));
    const baseAngle = Math.atan2(target.y - player.pos.y, target.x - player.pos.x);

    // rest of existing logic unchanged...
    // Calculate damage modifiers
    const hasBuff = Math.abs(getBuffMultiplier() - 1) > 0.0001;
    const isCrit = Math.random() < (player.critChance || 0);
    const critMult = isCrit ? (player.critMultiplier ?? 2) : 1;

    const count = Math.max(1, Math.floor(player.projectiles || 1));
    const spread = count === 1 ? 0 : (player.bulletSpreadDeg ?? CONFIG.DEFAULT_SPREAD) * Math.sqrt(count);

    const angles = count === 1 
      ? [0]
      : Array.from({ length: count }, (_, i) => -spread/2 + (spread/(count-1)) * i);

    const damagePerProj = player.damage * critMult * getDamageScale(count);
    const size = Math.max(2, CONFIG.BASE_SIZE * (player.damage / 1) * critMult);

    let color = hasBuff ? k.rgb(255, 0, 255) : k.rgb(255, 255, 0);
    if (isCrit) color = k.rgb(255, 0, 0);

    const effects = player._projectileEffects ?? [];
    angles.forEach(offsetDeg => {
      createProjectile(
        baseAngle + offsetDeg * Math.PI / 180,
        damagePerProj,
        size,
        color,
        effects,
        player.bulletSpeed
      );
    });
  };

  const tryFire = () => {
    if (!canFire) return;
    fire();
    canFire = false;
    const rate = Math.max(CONFIG.MIN_FIRE_RATE, player.attackSpeed || 0.1);
    k.wait(rate, () => canFire = true);
  };

  // expose for auto-aim and provide helpers to manage the explicit target
  player.tryFire = tryFire;
  player.setAutoAimTarget = (vec) => { player._autoAimTarget = vec; };
  player.clearAutoAimTarget = () => { player._autoAimTarget = null; };

  // Input handlers
  k.onMouseDown(() => player.isShooting = true);
  k.onMouseRelease(() => player.isShooting = false);
  
  k.onUpdate(() => {
    if (gameState.isPaused) return;
    updateInput(k, player.pos);
    if (player.isShooting || inputState.firing) tryFire();
  });
}