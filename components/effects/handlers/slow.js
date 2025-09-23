//components/effects/handlers/slow.js
import {
  getKaboom as getK,
  isBoss,
  genBuffId,
  applyVfxViaBuff,
} from "../utils.js";
import { createSlowVfx, destroySlowVfx } from "../vfx/index.js";

export const slow = (kaboom, params = {}) => {
  const k = getK(kaboom);
  let factor = Math.max(0, Math.min(0.99, params.slowFactor ?? 0.3));
  const duration = params.duration ?? 2.0;

  return {
    name: "slow",
    install(target, ctx = {}) {
      if (!target?._buffManager) return;
      if (isBoss(target)) factor = factor / 3;

      target._buffManager.applyBuff({
        id: genBuffId("slow", ctx),
        type: "slow",
        duration,
        data: { factor },
        onApply(buff) {
          target._slowMultipliers ??= [];
          target._slowMultipliers.push(buff.data.factor);
          target.recomputeStat?.("moveSpeed");
        },
        onRemove(buff) {
          if (!Array.isArray(target._slowMultipliers)) return;
          const i = target._slowMultipliers.indexOf(buff.data.factor);
          if (i > -1) target._slowMultipliers.splice(i, 1);
          target.recomputeStat?.("moveSpeed");
        },
      });

      if (isBoss(target)) return;

      applyVfxViaBuff(
        k,
        target,
        target._buffManager,
        genBuffId("slow_vfx", ctx),
        duration,
        () => createSlowVfx(k, target, { size: params.visualSize ?? 16 }),
        destroySlowVfx
      );
    },
  };
};
