// components/effects/handlers/slow.js
import { attachBuffManager } from "../../buffManager.js";
import { getKaboom, isBoss } from "../utils.js";
import { createTintVfx, destroyTintVfx } from "../vfx/tintManager.js";

export const slow = (kaboom, params = {}) => {
  const k = getKaboom(kaboom);
  const baseFactor = Math.max(0.01, Math.min(0.99, params.slowFactor ?? 0.3));
  const duration = params.duration ?? 2.0;
  const visualSize = params.visualSize ?? 16;
  const BUFF_ID = "slow_debuff";

  return {
    name: "slow",
    install(target, ctx = {}) {
      if (!target) return false;
      
      const pauseCheck = () => ctx.gameContext?.sharedState?.isPaused;
      const mgr = attachBuffManager(k, target, { pauseCheck });
      if (!mgr) return false;

      const slowFactor = isBoss(target) ? baseFactor / 3 : baseFactor;
      const speedMultiplier = 1 - slowFactor;
      
      mgr.applyBuff({
        id: BUFF_ID,
        type: "slow", // The enemy's recomputeStat function looks for this type
        duration,
        pauseCheck,
        data: { 
          factor: speedMultiplier
        },
        
        onApply(buff) {
          // This only runs the first time the buff is applied.
          if (!isBoss(target) || params.forceVfx) {
            try {
              const vfx = createTintVfx(k, target, {
                type: "slow",
                color: [0, 180, 255],
                alpha: 0.36,
                pulse: { freq: 6, amp: 0.6, baseline: 0.6 },
                size: visualSize,
                buffId: buff.id,
              });
              buff._vfx = vfx; // Link VFX to the buff for cleanup
            } catch (e) {
              console.error("Failed to create slow VFX:", e);
            }
          }
        },
        
        onRemove(buff) {
          if (buff._vfx) {
            destroyTintVfx(k, buff._vfx);
          }
        },
      });
      
      return true;
    },

    apply(target, ctx = {}) {
      return this.install(target, ctx);
    },
  };
};