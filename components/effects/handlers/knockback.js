//components/effects/handlers/knockback.js
import {
  normalize,
  subtract,
  scale,
  getKaboom as getK,
  isBoss,
  genBuffId,
  addVecToEntity,
} from "../utils.js";

export const knockback = (kaboom, params = {}) => {
  const k = getK(kaboom);
  const baseForce = params.force ?? 600;
  const stun = params.duration ?? 0.14;

  return {
    name: "knockback",
    apply(target, ctx = {}, projectile = {}) {
      if (!target) return;
      let force = baseForce;
      if (isBoss(target)) force = Math.floor(force / 3);

      let dir = null;
      if (projectile?.pos && target?.pos)
        dir = normalize(subtract(target.pos, projectile.pos));
      else if (projectile?.velocity) dir = normalize(projectile.velocity);
      dir ??= { x: 0, y: -1 };

      const impulse = scale(dir, force);
      if (!impulse) return;

      if (target.velocity) addVecToEntity(target, impulse, k, "velocity");
      else if (target.pos)
        addVecToEntity(target, scale(impulse, 0.03), k, "pos");

      if (target._buffManager) {
        target._buffManager.applyBuff({
          id: genBuffId("knockback_stun", ctx),
          type: "knockback_stun",
          duration: stun,
          onApply() {
            target._isStunned = true;
          },
          onRemove() {
            target._isStunned = false;
          },
        });
      } else {
        target._isStunned = true;
        k.wait?.(stun, () => {
          target._isStunned = false;
        }) ??
          setTimeout(() => {
            target._isStunned = false;
          }, stun * 1000);
      }
    },
  };
};
