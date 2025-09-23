//components/effects/handlers/ricochet.js
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

      projectile._bouncesLeft ??= maxBounces;
      if (projectile._bouncesLeft <= 0) {
        projectile._shouldDestroyAfterHit = true;
        return;
      }
      projectile._bouncesLeft--;

      let newVel = null;
      if (projectile.velocity) {
        const speed =
          Math.hypot(projectile.velocity.x ?? 0, projectile.velocity.y ?? 0) ||
          fallbackSpeed;
        const incident = normalize(projectile.velocity);
        const surface = normalize(
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
        const cos = Math.cos(theta),
          sin = Math.sin(theta);
        const rx = refl.x * cos - refl.y * sin;
        const ry = refl.x * sin + refl.y * cos;
        newVel = scale({ x: rx, y: ry }, speed);
      } else {
        const a = Math.random() * Math.PI * 2;
        newVel = {
          x: Math.cos(a) * fallbackSpeed,
          y: Math.sin(a) * fallbackSpeed,
        };
      }

      setEntityVec(projectile, newVel, k, "velocity");
      if (projectile.pos && projectile.velocity)
        addVecToEntity(
          projectile,
          scale(normalize(projectile.velocity), 0.5),
          k,
          "pos"
        );
      projectile._shouldDestroyAfterHit = false;
    },
  };
};
