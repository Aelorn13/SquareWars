// applyProjectileEffects.js
import { EFFECT_HANDLERS } from "./index.js";

// Apply all effects from a projectile to a target
export function applyProjectileEffects(k, projectile, target, ctx = {}) {
  const effects = projectile.effects ?? [];
  const source = projectile.owner ?? projectile.source ?? ctx.source ?? null;
  const sourceId =
    projectile.owner?.id ??
    projectile.source?.id ??
    projectile._ownerId ??
    ctx.sourceId;

  for (const effect of effects) {
    try {
      const factory = EFFECT_HANDLERS[effect.type];
      if (!factory) {
        console.warn("Unknown effect type:", effect.type);
        continue;
      }

      const handler = factory(k, effect.params || {});
      const effectCtx = {
        ...ctx,
        k,
        params: effect.params || {},
        rarity: effect.rarity,
        sourceUpgrade: effect.sourceUpgrade,
        source,
        sourceId,
        projectile,
      };

      handler.install?.(target, effectCtx);
      handler.apply?.(target, effectCtx, projectile);
    } catch (err) {
      console.error("Error applying effect", effect, err);
    }
  }
}
