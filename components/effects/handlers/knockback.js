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
  
  // Behavior options
  const scaleMode = params.scaleMode ?? "sqrt";
  const minMultiplier = params.minMultiplier ?? 0.1;
  
  return {
    name: "knockback",
    
    apply(target, ctx = {}, projectile = {}) {
      if (!target) return;
      
      let force = baseForce;
      if (isBoss(target)) force = Math.floor(force / 3);
      
      // Determine attacker's projectile count
      const attackerProjectiles = Number(
        (ctx && ctx.source && ctx.source.projectiles) ||
        (projectile && projectile.source && projectile.source.projectiles) ||
        (ctx && ctx.attackerProjectiles) ||
        (projectile && projectile.owner && projectile.owner.projectiles) ||
        1
      );
      const projCount = Math.max(1, attackerProjectiles);
      
      // Compute per-hit multiplier
      let mult;
      if (scaleMode === "sqrt") {
        mult = 1 / Math.sqrt(projCount);
      } else {
        mult = 1 / projCount; // linear
      }
      mult = Math.max(minMultiplier, mult);
      force = Math.round(force * mult);
      
      let dir = null;
      
      const attackerPos = 
        (ctx?.source?.pos) || 
        (projectile?.source?.pos) || 
        (projectile?.owner?.pos) ||
        null;
      
      if (attackerPos && target?.pos) {
        dir = normalize(subtract(target.pos, attackerPos));
      }
      else if (projectile?.pos && target?.pos) {
        dir = normalize(subtract(target.pos, projectile.pos));
      }
      else if (projectile?.velocity) {
        dir = normalize(projectile.velocity);
      }
      
      dir = dir || { x: 0, y: -1 };
      
      const impulse = scale(dir, force);
      if (!impulse) return;
      
      // Apply knockback
      if (target.velocity) {
        addVecToEntity(target, impulse, k, "velocity");
      } else if (target.pos) {
        // For entities without velocity, apply to position directly
        addVecToEntity(target, scale(impulse, 0.03), k, "pos");
      }
      
      // Apply stun
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
        // Fallback for entities without buff manager
        target._isStunned = true;
        const unstun = () => {
          if (target && target.exists?.()) {
            target._isStunned = false;
          }
        };
        
        if (k.wait) {
          k.wait(stun, unstun);
        } else {
          setTimeout(unstun, stun * 1000);
        }
      }
    },
  };
};
