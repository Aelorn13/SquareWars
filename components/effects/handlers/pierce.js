import {
  normalize,
  scale,
  getKaboom as getK,
  addVecToEntity,
} from "../utils.js";

/*
  params.pierces | params.count | params.pierceCount
    -> number of ADDITIONAL enemies the projectile may pass through after the first hit.
*/
export const pierce = (kaboom, params = {}) => {
  const k = getK(kaboom);
  const initialPierces = Math.max(
    0,
    Math.floor(params.pierces ?? params.count ?? params.pierceCount ?? 0)
  );
  const pushAfterHit = params.pushAfterHit ?? 8;

  return {
    name: "pierce",
    apply(target, ctx = {}, projectile = {}) {
      if (!projectile || !target) return;

      // Detect ricochet config even if ricochet handler hasn't run yet.
      const effects = Array.isArray(projectile.effects) ? projectile.effects : [];
      const ricEff = effects.find(e => e && e.type === "ricochet");
      const ricochetConfigBounces = Number(
        ricEff?.params?.bounces ?? ricEff?.params?.count ?? 0
      );

      const ricochetMax = projectile._ricochetMax ?? ricochetConfigBounces ?? 0;
      const hasRicochetConfig = projectile._hasRicochet || ricochetMax > 0;

      const bLeft = typeof projectile._bouncesLeft === "number" ? projectile._bouncesLeft : undefined;

      // If ricochet exists and is still "running" (bounces left, just ricocheted this hit,
      // or ricochet present but not initialized yet) then defer pierce until ricochet finishes.
      const ricochetRunning =
        (typeof bLeft === "number" && bLeft > 0) ||
        projectile._wasRicochetThisHit ||
        (typeof bLeft !== "number" && ricochetMax > 0);

      if (hasRicochetConfig && ricochetRunning) {
        // ensure ricochet keeps control of destroy flag for this collision
        projectile._shouldDestroyAfterHit ??= false;
        return;
      }

      // initialize pierce counter once
      if (typeof projectile._piercesLeft !== "number") {
        const raw = projectile.pierces ?? projectile.pierceCount ?? projectile.count ?? initialPierces;
        projectile._piercesLeft = Math.max(0, Math.floor(Number(raw) || 0));
      }

      // avoid duplicate hits for overlapping collisions
      projectile._hitTargets ??= new Set();
      if (projectile._hitTargets.has(target)) {
        projectile._shouldDestroyAfterHit = false;
        return;
      }
      projectile._hitTargets.add(target);

      if (projectile._piercesLeft > 0) {
        projectile._piercesLeft -= 1;
        projectile._shouldDestroyAfterHit = false;

        // nudge forward to avoid immediate re-collision
        if (projectile.pos && projectile.velocity) {
          const dir = normalize(projectile.velocity);
          if (dir) addVecToEntity(projectile, scale(dir, pushAfterHit), k, "pos");
        }
      } else {
        projectile._shouldDestroyAfterHit = true;
      }
    },
  };
};
