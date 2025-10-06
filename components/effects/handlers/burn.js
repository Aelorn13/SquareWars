// components/effects/handlers/burn.js - Complete version
import { attachBuffManager } from "../../buffManager.js";
import { getKaboom, isBoss } from "../utils.js";
import { createOverlay, destroyOverlay } from "../vfx/overlayManager.js";
import { _randomLocalOffset } from "../vfx/utils.js";

export const burn = (kaboom, params = {}) => {
  const k = getKaboom(kaboom);
  const dmg = params.damagePerTick ?? 1;
  const duration = params.duration ?? 2;
  const interval = params.tickInterval ?? 0.5;
  const visualSize = params.visualSize ?? 18;
  const icon = params.icon ?? "🔥";
  const allowBossVfx = params.visualOnBoss !== false || params.forceVfx === true;
  
  // Calculate max stacks based on tick budget
  const tickBudget = params.tickBudgetPerTarget ?? 6;
  const ticksPerSecond = 1 / Math.max(0.0001, interval);
  const computedMaxStacks = Math.max(1, Math.floor(tickBudget / ticksPerSecond));
  const requestedMaxStacks = Number.isFinite(params.maxStacks) ? params.maxStacks : null;
  
  function getMaxStacks(target) {
    if (requestedMaxStacks !== null) return requestedMaxStacks;
    return isBoss(target) ? computedMaxStacks * 2 : computedMaxStacks;
  }

  return {
    name: "burn",

    install(target, ctx = {}) {
      if (!target) return false;
      
      // Prevent rapid duplicate installs in same frame
      if (target._pendingBurnInstall) return false;
      target._pendingBurnInstall = true;
      k.wait?.(0, () => {
        if (target && target.exists?.()) {
          target._pendingBurnInstall = false;
        }
      });
      
      // Get or create buff manager with pause support
      const pauseCheck = () => ctx.gameContext?.sharedState?.isPaused;
      const mgr = attachBuffManager(k, target, { pauseCheck });
      if (!mgr) return false;
      
      // Check current burn stacks
      const currentBurns = mgr.getBuffsByType("burn");
      const maxStacks = getMaxStacks(target);
      
      // If at max stacks, refresh all burn durations
      if (currentBurns.length >= maxStacks) {
        currentBurns.forEach(buff => {
          buff.duration = duration;
          buff.elapsed = 0;
        });
        if (mgr.debug) {
          console.log(`[burn] Refreshed ${currentBurns.length} stacks on ${target.id || "entity"}`);
        }
        return true;
      }
      
      // Create unique burn buff ID
      const sourceId = ctx.sourceId ?? "anon";
      const buffId = `burn_${sourceId}_${Date.now()}_${Math.random()}`;
      const shouldShowVfx = !(isBoss(target) && !allowBossVfx) && visualSize > 0;
      
      // Apply the burn buff
      mgr.applyBuff({
        id: buffId,
        type: "burn",
        duration,
        tickInterval: interval,
        pauseCheck, // Individual buff pause check
        data: { 
          damage: dmg,
          source: ctx.source,
          sourceId: sourceId
        },
        
        onApply(buff) {
          // Create VFX if appropriate
          if (shouldShowVfx) {
            try {
              const offset = _randomLocalOffset(k, target, 0.45);
              const vfxNode = createOverlay(k, target, {
                type: "burn_icon",
                icon,
                size: Math.max(12, visualSize - 4),
                offset,
                instanceId: buffId, // Link VFX to this specific buff
                forceNew: true,
                allowMultiple: true,
                respectsPause: true, // VFX animation pauses
                animated: true, // Enable wobble animation
              });
              
              buff._vfxNode = vfxNode;
              
              if (mgr.debug) {
                console.log(`[burn] Created VFX for ${buffId}`);
              }
            } catch (e) {
              console.error("[burn] Failed to create VFX:", e);
            }
          }
          
          if (mgr.debug) {
            const stacks = mgr.countBuffsByType("burn");
            console.log(`[burn] Applied to ${target.id || "entity"}: ${dmg} damage/tick, ${stacks} total stacks`);
          }
        },
        
        onTick(buff) {
          // Check if target still exists
          if (!target || !target.exists?.()) {
            mgr.removeBuff(buff.id);
            return;
          }
          
          const damage = buff.data?.damage ?? 0;
          if (damage <= 0) return;
          
          // Apply damage with source info
          try {
            if (typeof target.takeDamage === "function") {
              target.takeDamage(damage, { 
                source: buff.data?.source, 
                type: "burn",
                sourceId: buff.data?.sourceId
              });
            } else if (typeof target.hurt === "function") {
              target.hurt(damage);
            } else if (typeof target.health === "number") {
              target.health -= damage;
              if (target.health <= 0 && typeof target.die === "function") {
                target.die();
              }
            }
          } catch (e) {
            console.error("[burn] onTick damage error:", e);
          }
        },
        
        onRemove(buff) {
          // Clean up VFX
          if (buff._vfxNode) {
            destroyOverlay(k, buff._vfxNode);
          }
          
          if (mgr.debug) {
            const remaining = mgr.countBuffsByType("burn");
            console.log(`[burn] Removed from ${target.id || "entity"}, ${remaining} stacks remaining`);
          }
        },
      });
      
      return true;
    },

    // Fallback for instant visual feedback if buff can't be applied
    apply(target, ctx = {}) {
      if (!target) return;
      
      // Try to install persistent buff first
      if (this.install(target, ctx)) return;
      
      // Only show pop effect if install failed (no buff manager)
      if (isBoss(target) && !allowBossVfx) return;
      
      const offset = _randomLocalOffset(k, target, 0.45);
      const node = createOverlay(k, target, {
        type: "burn_icon_pop",
        icon,
        size: Math.max(12, visualSize - 4),
        offset,
        instanceId: `burn_pop_${Math.random()}`,
        animated: false, // No wobble for pop effect
      });
      
      if (node) {
        k.wait(0.45, () => destroyOverlay(k, node));
      }
    },
  };
};