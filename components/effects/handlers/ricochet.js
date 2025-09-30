import {
  normalize,
  subtract,
  scale,
  getKaboom as getK,
  setEntityVec,
  addVecToEntity,
} from "../utils.js";

export const ricochet = (kaboom, params = {}) => {
  const k = getK(kaboom);
  const spreadDegrees = params.spread ?? 20;
  const fallbackSpeed = params.fallbackSpeed ?? 300;
  const maxBounces = Math.max(0, Math.floor(params.bounces ?? 0));

  return {
    name: "ricochet",
    apply(target, ctx = {}, projectile = {}) {
      if (!projectile) return;

      // mark capability and default max so other handlers can inspect
      projectile._ricochetMax ??= maxBounces;
      projectile._hasRicochet ??= maxBounces > 0;

      // initialize _bouncesLeft once
      if (typeof projectile._bouncesLeft !== "number") {
        projectile._bouncesLeft = maxBounces;
      }

      // if no bounces left do not force destruction here.
      // allow other handlers (pierce, etc.) to decide.
      if (projectile._bouncesLeft <= 0) {
        return;
      }

      // consume a bounce and reflect velocity
      projectile._bouncesLeft -= 1;

      let newVel = null;
      if (projectile.velocity) {
        const speed =
          Math.hypot(projectile.velocity.x ?? 0, projectile.velocity.y ?? 0) ||
          fallbackSpeed;
        const incident = normalize(projectile.velocity);
        const surface =
          normalize(
            subtract(
              projectile.pos ?? { x: 0, y: 0 },
              target?.pos ?? { x: 0, y: 0 }
            )
          ) || { x: -incident.x, y: -incident.y };
        const dot = incident.x * surface.x + incident.y * surface.y;
        const refl = {
          x: incident.x - 2 * dot * surface.x,
          y: incident.y - 2 * dot * surface.y,
        };

        const theta = (Math.random() - 0.5) * ((spreadDegrees * Math.PI) / 180);
        const cos = Math.cos(theta), sin = Math.sin(theta);
        const rx = refl.x * cos - refl.y * sin;
        const ry = refl.x * sin + refl.y * cos;
        newVel = scale({ x: rx, y: ry }, speed);
      } else {
        const a = Math.random() * Math.PI * 2;
        newVel = { x: Math.cos(a) * fallbackSpeed, y: Math.sin(a) * fallbackSpeed };
      }

      setEntityVec(projectile, newVel, k, "velocity");
      if (projectile.pos && projectile.velocity)
        addVecToEntity(projectile, scale(normalize(projectile.velocity), 0.5), k, "pos");

      // mark that a ricochet happened this hit so pierce can defer for the same frame
      projectile._wasRicochetThisHit = true;
      if (k.wait) {
        k.wait(0, () => (projectile._wasRicochetThisHit = false));
      } else {
        setTimeout(() => (projectile._wasRicochetThisHit = false), 0);
      }

      // keep projectile alive while ricochet bounces remain
      projectile._shouldDestroyAfterHit = false;
    },
  };
};
