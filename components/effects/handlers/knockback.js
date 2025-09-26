// components/effects/handlers/knockback.js
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

  // Behavior options (optional params)
  // params.scaleMode: "linear" | "sqrt" (default "linear")
  // params.minMultiplier: minimum multiplier to avoid zero (~0.1 recommended)
  const scaleMode = params.scaleMode ?? "sqrt";
  const minMultiplier = params.minMultiplier ?? 0.1;

  return {
    name: "knockback",
    apply(target, ctx = {}, projectile = {}) {
      if (!target) return;
      let force = baseForce;
      if (isBoss(target)) force = Math.floor(force / 3);

      // --- new: determine attacker's projectile count robustly ---
      const attackerProjectiles = Number(
        (ctx && ctx.source && ctx.source.projectiles) ||
        (projectile && projectile.source && projectile.source.projectiles) ||
        (ctx && ctx.attackerProjectiles) ||
        (projectile && projectile.owner && projectile.owner.projectiles) ||
        1
      );
      const projCount = Math.max(1, attackerProjectiles);

      // compute per-hit multiplier
      let mult;
      if (scaleMode === "sqrt") mult = 1 / Math.sqrt(projCount);
      else mult = 1 / projCount; // linear default

      mult = Math.max(minMultiplier, mult);
      force = Math.round(force * mult);
      // --------------------------------------------------------

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
