// components/enemy/enemyUtils.js
import { spawnPowerUp, POWERUP_TYPES } from "../powerup.js";

export function fadeColor(original, fadeTo, ratio) {
  const r = Math.floor(original[0] * ratio + fadeTo[0] * (1 - ratio));
  const g = Math.floor(original[1] * ratio + fadeTo[1] * (1 - ratio));
  const b = Math.floor(original[2] * ratio + fadeTo[2] * (1 - ratio));
  return [r, g, b];
}

export function dropPowerUp(k, player, pos, sharedState) {
  const dropChance = player.luck ?? 0;
  if (Math.random() < dropChance) {
    const choice = k.choose(POWERUP_TYPES);
    spawnPowerUp(k, pos, choice, sharedState);
  }
}

export function enemyDeathAnimation(k, enemy) {
  enemy.dead = true;
  enemy.solid = false;
  enemy.area.enabled = false;

  const duration = 0.4;
  const startScale = 1;
  const endScale = 0.1;
  const startOpacity = 1;
  const endOpacity = 0;

  let t = 0;
  enemy.onUpdate(() => {
    t += k.dt();
    const progress = Math.min(t / duration, 1);
    enemy.scale = k.vec2(
      startScale + (endScale - startScale) * progress,
      startScale + (endScale - startScale) * progress
    );
    enemy.opacity = startOpacity + (endOpacity - startOpacity) * progress;
    if (progress >= 1) k.destroy(enemy);
  });
}
