// components/effects/effectRegistry.js
import * as vec from "./vectorUtils.js";
import { registerVisualEffects } from "./visualEffects.js";

/**
 * Defensive, Kaboom-safe effect handler registry.
 * Each factory creates a handler with one of two methods:
 * - install(target, ctx): Applies a continuous or timed effect (e.g., DoT, slow).
 * - apply(target, ctx, projectile): Applies an immediate, one-off action (e.g., knockback).
 */

/**
 * Generates a unique, non-stacking ID for a buff based on its source.
 * @param {string} effectType - The type of the effect (e.g., "burn").
 * @param {object} context - The effect context, containing source information.
 * @returns {string} A unique identifier string.
 */
const generateBuffId = (effectType, context) => {
  const sourceId = context.sourceId ?? context.projectile?.id ?? context.source?.id ?? Math.floor(Math.random() * 1e9);
  const sourceUpgrade = context.sourceUpgrade ?? "generic";
  return `${effectType}_${sourceId}_${sourceUpgrade}`;
};

export const EFFECT_HANDLERS = {
  // BURN (Damage over Time)
  burn: (kaboom, params = {}) => {
    const damagePerTick = params.damagePerTick ?? 1;
    const duration = params.duration ?? 3;
    const tickInterval = params.tickInterval ?? 1;

    return {
      name: "burn",
      install(target, context = {}) {
        if (!target?._buffManager) return;

        target._buffManager.applyBuff({
          id: generateBuffId("burn", context),
          type: "burn",
          duration,
          tickInterval,
          data: { damage: damagePerTick, source: context.source },
          onTick(buff) {
            const damage = buff.data.damage ?? 0;
            // Prefer the target's damage-taking method, but fall back to direct HP modification.
            if (typeof target.takeDamage === "function") {
              target.takeDamage(damage, { source: buff.data.source, type: "burn" });
            } else {
              target.hp = Math.max(0, (target.hp ?? 0) - damage);
            }
          },
        });
      },
    };
  },

  // KNOCKBACK (Pushes a target away from the effect source)
  knockback: (kaboom, params = {}) => {
    const force = params.force ?? 600;
    const stunDuration = params.duration ?? 0.14;

    return {
      name: "knockback",
      apply(target, context = {}, projectile = {}) {
        if (!target) return;
        const k = kaboom ?? globalThis.k;

        // Determine the direction of knockback.
        let direction = null;
        if (projectile?.pos && target?.pos) {
          direction = vec.normalize(vec.subtract(target.pos, projectile.pos));
        } else if (projectile?.velocity) {
          direction = vec.normalize(projectile.velocity);
        }
        
        direction ??= { x: 0, y: -1 }; // Default to upwards if no direction is found.

        const impulse = vec.scale(direction, force);
        if (!impulse) return;
        
        // Apply impulse, converting the result back to a kaboom.vec2 if the instance is available.
        if (target.velocity) {
          const newVelocity = vec.add(target.velocity, impulse);
          if (newVelocity && k?.vec2) {
            target.velocity = k.vec2(newVelocity.x, newVelocity.y);
          } else if (newVelocity) {
            target.velocity = newVelocity;
          }
        } else if (target.pos) {
          const positionNudge = vec.scale(impulse, 0.03); // A small multiplier to prevent excessive movement.
          const newPosition = vec.add(target.pos, positionNudge);
           if (newPosition && k?.vec2) {
            target.pos = k.vec2(newPosition.x, newPosition.y);
           } else if (newPosition) {
            target.pos = newPosition;
           }
        }

        // Apply a brief stun.
        if (target._buffManager) {
          target._buffManager.applyBuff({
            id: generateBuffId("knockback_stun", context),
            type: "knockback",
            duration: stunDuration,
            onApply() { target._isStunned = true; },
            onRemove() { target._isStunned = false; },
          });
        } else {
          target._isStunned = true;
          if (k?.wait) {
            k.wait(stunDuration, () => { target._isStunned = false; });
          } else {
            setTimeout(() => { target._isStunned = false; }, stunDuration * 1000);
          }
        }
      },
    };
  },

  // SLOW (Reduces movement speed)
  slow: (kaboom, params = {}) => {
    const slowFactor = Math.max(0, Math.min(0.99, params.slowFactor ?? 0.3));
    const duration = params.duration ?? 2.0;

    return {
      name: "slow",
      install(target, context = {}) {
        if (!target?._buffManager) return;
        
        target._buffManager.applyBuff({
          id: generateBuffId("slow", context),
          type: "slow",
          duration,
          data: { factor: slowFactor },
          onApply(buff) {
            target._slowMultipliers ??= [];
            target._slowMultipliers.push(buff.data.factor);
            target.recomputeStat?.("moveSpeed");
          },
          onRemove(buff) {
            if (!Array.isArray(target._slowMultipliers)) return;
            const index = target._slowMultipliers.indexOf(buff.data.factor);
            if (index > -1) {
              target._slowMultipliers.splice(index, 1);
            }
            target.recomputeStat?.("moveSpeed");
          },
        });
      },
    };
  },

  // RICOCHET (Causes a projectile to bounce off a target)
  ricochet: (kaboom, params = {}) => {
    const spreadDegrees = params.spread ?? 20;
    const fallbackSpeed = params.fallbackSpeed ?? 300;

    return {
      name: "ricochet",
      apply(target, context = {}, projectile = {}) {
        if (!projectile) return;
        const k = kaboom ?? globalThis.k;

        if (projectile._bouncesLeft === undefined) {
          projectile._bouncesLeft = Math.max(0, Math.floor(params.bounces ?? 0));
        }

        if (projectile._bouncesLeft <= 0) {
          projectile._shouldDestroyAfterHit = true;
          return;
        }
        
        projectile._bouncesLeft--;

        let newVelocity = null;
        if (projectile.velocity) {
          const speed = Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2);
          const incidentVector = vec.normalize(projectile.velocity);
          const surfaceNormal = vec.normalize(vec.subtract(projectile.pos, target.pos)) ?? { x: -incidentVector.x, y: -incidentVector.y };
          
          const dotProduct = (incidentVector.x * surfaceNormal.x) + (incidentVector.y * surfaceNormal.y);
          let reflection = {
            x: incidentVector.x - 2 * dotProduct * surfaceNormal.x,
            y: incidentVector.y - 2 * dotProduct * surfaceNormal.y,
          };

          const spreadRadians = (Math.random() - 0.5) * (spreadDegrees * Math.PI / 180);
          const cos = Math.cos(spreadRadians);
          const sin = Math.sin(spreadRadians);
          
          const rotatedX = reflection.x * cos - reflection.y * sin;
          const rotatedY = reflection.x * sin + reflection.y * cos;
          
          newVelocity = vec.scale({ x: rotatedX, y: rotatedY }, speed);
          
        } else {
          // Fallback: give it a new random velocity.
          const randomAngle = Math.random() * 2 * Math.PI;
          newVelocity = {
            x: Math.cos(randomAngle) * fallbackSpeed,
            y: Math.sin(randomAngle) * fallbackSpeed,
          };
        }
        
        if (newVelocity && k?.vec2) {
            projectile.velocity = k.vec2(newVelocity.x, newVelocity.y);
        } else if (newVelocity) {
            projectile.velocity = newVelocity;
        }

        // Nudge the projectile to prevent re-collision.
        if (projectile.pos && projectile.velocity) {
            const nudge = vec.scale(projectile.velocity, 0.02);
            const newPosition = vec.add(projectile.pos, nudge);

            if (newPosition && k?.vec2) {
                projectile.pos = k.vec2(newPosition.x, newPosition.y);
            } else if (newPosition) {
                projectile.pos = newPosition;
            }
        }
        
        projectile._shouldDestroyAfterHit = false;
      },
    };
  },
};
