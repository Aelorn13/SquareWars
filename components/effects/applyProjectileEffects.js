// components/effects/applyProjectileEffects.js
import { EFFECT_HANDLERS } from "./effectRegistry.js";

export function applyProjectileEffects(k, projectile, target, ctx = {}) {
  const effects = projectile.effects || [];
  const source = projectile.owner ?? projectile.source ?? ctx.source ?? null;
  const sourceId = projectile.owner?.id ?? projectile.source?.id ?? projectile._ownerId ?? ctx.sourceId;

  for (const e of effects) {
    try {
      const factory = EFFECT_HANDLERS[e.type];
      if (!factory) {
        console.warn("Unknown effect type:", e.type);
        continue;
      }
      const handler = factory(k, e.params || {});
      const effectCtx = {
        ...ctx,
        k,
        params: e.params || {},
        rarity: e.rarity,
        sourceUpgrade: e.sourceUpgrade,
        source,
        sourceId,
        projectile,
      };
      if (handler.install) handler.install(target, effectCtx);
      if (handler.apply) handler.apply(target, effectCtx, projectile);
    } catch (err) {
      console.error("Error applying effect", e, err);
    }
  }
}
