// components/enemy/enemyUtils.js
import { POWERUP_TYPES } from "../powerup/powerupTypes.js";
import { spawnPowerUp } from "../powerup/spawnPowerup.js";
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

/**
 * Pick a spawn position on the edge of the arena (just outside by `off`).
 * If sharedState.arena is not available, falls back to full screen.
 */
export function pickEdgeSpawnPos(k, sharedState, off = 24) {
  const a = sharedState?.area ?? { x: 0, y: 0, w: k.width(), h: k.height() };
  const side = Math.floor(Math.random() * 4); // 0..3
  switch (side) {
    case 0: // top
      return k.vec2(k.rand(a.x, a.x + a.w), a.y - off);
    case 1: // bottom
      return k.vec2(k.rand(a.x, a.x + a.w), a.y + a.h + off);
    case 2: // left
      return k.vec2(a.x - off, k.rand(a.y, a.y + a.h));
    default: // right
      return k.vec2(a.x + a.w + off, k.rand(a.y, a.y + a.h));
  }
}

/**
 * Try several times to pick an edge spawn pos that is at least minDist away from player.
 * Falls back to last attempted pos if tries exhausted.
 */
export function pickEdgeSpawnPosFarFromPlayer(k, sharedState, player, minDist = 120, off = 24, tries = 8) {
  let pos;
  do {
    pos = pickEdgeSpawnPos(k, sharedState, off);
    tries--;
  } while (tries > 0 && pos.dist(player.pos) < minDist);
  return pos;
}

/**
 * Visual telegraph at `pos` that points toward arena center and pulses.
 * lasts `duration` seconds. Does not spawn the enemy itself.
 */
export function showSpawnTelegraph(k, pos, sharedState, duration = 0.6) {
  const arena = sharedState?.area ?? { x: 0, y: 0, w: k.width(), h: k.height() };
  const center = k.vec2(arena.x + arena.w / 2, arena.y + arena.h / 2);
  const dir = center.sub(pos).unit();
  const angle = dir.angle();

  // ring pulse
  const ring = k.add([
    k.rect(18, 18, { radius: 9 }),
    k.pos(pos),
    k.anchor("center"),
    k.color(255, 255, 255),
    k.opacity(0.9),
    k.z(60),
    "spawnTelegraph",
    {
      t: 0,
      update() {
        this.t += k.dt();
        const p = Math.min(1, this.t / duration);
        // pulse scale and fade
        const s = 0.6 + Math.sin(p * Math.PI) * 0.6;
        this.scale = k.vec2(s, s);
        this.opacity = Math.max(0, 1 - p);
        if (this.t >= duration) k.destroy(this);
      },
    },
  ]);

  // directional pointer (thin rectangle pointing inward)
  const pointer = k.add([
    k.rect(36, 6, { radius: 3 }),
    k.pos(pos),
    k.anchor("center"),
    k.rotate(angle),
    k.color(255, 255, 255),
    k.opacity(0.9),
    k.z(61),
    "spawnTelegraph",
    {
      t: 0,
      update() {
        this.t += k.dt();
        const p = Math.min(1, this.t / duration);
        // move slightly toward center while fading
        const move = dir.scale(8 * p);
        this.pos = pos.add(move);
        this.scale = k.vec2(1 + p * 0.4, 1 + p * 0.4);
        this.opacity = Math.max(0, 1 - p);
        if (this.t >= duration) k.destroy(this);
      },
    },
  ]);

  // return the entities in case caller wants to examine (optional)
  return { ring, pointer };
}