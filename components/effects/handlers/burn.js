//components/effects/handlers/burn.js
import {
  getKaboom,
  isBoss,
  genBuffId,
  applyVfxViaBuff,
  normalize,
} from "../utils.js";
import { createBurnVfx, destroyBurnVfx } from "../vfx/index.js";

export const burn = (kaboom, params = {}) => {
  const k = getKaboom(kaboom);
  const damagePerTick = params.damagePerTick ?? 1;
  const duration = params.duration ?? 3;
  const tickInterval = params.tickInterval ?? 1;
  const allowBossVisual =
    params.visualOnBoss === true || params.forceVfx === true;
  const vfxSize = params.visualSize ?? 14;
  const vfxCount = params.visualCount ?? 1;

  return {
    name: "burn",
    install(target, ctx = {}) {
      if (!target?._buffManager) return;

      target._buffManager.applyBuff({
        id: genBuffId("burn", ctx),
        type: "burn",
        duration,
        tickInterval,
        data: { damage: damagePerTick, source: ctx.source },
        onTick(buff) {
          const dmg = buff.data?.damage ?? 0;
          if (typeof target.takeDamage === "function")
            target.takeDamage(dmg, { source: buff.data?.source, type: "burn" });
          else if (typeof target.hurt === "function") target.hurt(dmg);
          else target.hp = Math.max(0, (target.hp ?? 0) - dmg);
        },
      });

      if (isBoss(target) && !allowBossVisual) return;

      applyVfxViaBuff(
        k,
        target,
        target._buffManager,
        genBuffId("burn_vfx", ctx),
        duration,
        () =>
          createBurnVfx(k, target, {
            size: vfxSize,
            count: vfxCount,
            allowBoss: allowBossVisual,
          }),
        destroyBurnVfx
      );
    },

    apply(target) {
      if (!target || (isBoss(target) && !allowBossVisual)) return;
      const v = createBurnVfx(k, target, {
        size: Math.max(12, vfxSize - 4),
        count: 1,
        allowBoss: allowBossVisual,
      });
      if (v)
        k.wait?.(0.45, () => destroyBurnVfx(k, v)) ??
          setTimeout(() => destroyBurnVfx(k, v), 450);
    },
  };
};
