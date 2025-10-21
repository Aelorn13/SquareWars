// components/player/skills.js

import { spawnShockwave } from "../powerup/powerupEffects/shockwaveEffect.js";

/**
 * Fires a single, high-damage projectile that pierces all enemies.
 */
function strongShoot(k, player, aimPos, sharedState) {
  const angleRad = Math.atan2(aimPos.y - player.pos.y, aimPos.x - player.pos.x);
  const damage = player.damage * 3;
  const speed = player.bulletSpeed * 1.5;
  const size = 20;

  const proj = k.add([
    k.rect(size, size),
    k.color(255, 165, 0),
    k.pos(player.pos),
    k.anchor("center"),
    k.area(),
    k.offscreen({ destroy: true }),
    k.z(player.z),
    "projectile",
    {
      velocity: k.vec2(Math.cos(angleRad), Math.sin(angleRad)).scale(speed),
      damage: damage,
      source: player,
      sourceId: player.id,
      effects: [],
      _shouldDestroyAfterHit: false,
    },
  ]);

  proj.onUpdate(() => {
    if (sharedState.isPaused || sharedState.upgradeOpen) return;
    proj.pos = proj.pos.add(proj.velocity.scale(k.dt()));
  });
}

/**
 * Instantly moves the player to the aim position with a fixed cooldown.
 */
function teleport(k, player, aimPos, arena) {
  const half = player.width / 2;
  const targetX = k.clamp(aimPos.x, arena.x + half, arena.x + arena.w - half);
  const targetY = k.clamp(aimPos.y, arena.y + half, arena.y + arena.h - half);

  player.pos.x = targetX;
  player.pos.y = targetY;

  k.add([
    k.circle(player.width),
    k.pos(player.pos),
    k.anchor("center"),
    k.scale(1),
    k.color(100, 100, 255),
    k.opacity(0.8),
    k.lifespan(0.3, { fade: 0.3 }),
    k.z(player.z),
  ]);
}

/**
 * Launches a rotating grenade that arms and then explodes with a shockwave.
 */
function grenade(k, player, aimPos, sharedState) {
  const speed = 400;
  const armDistance = 300;
  const armedLifetime = 2;

  const direction = aimPos.sub(player.pos).unit();
  const currentPlayerRadius = player.width / 2;
  const spawnBuffer = 5;
  const spawnOffset = direction.scale(currentPlayerRadius + spawnBuffer);
  const spawnPos = player.pos.add(spawnOffset);

  const grenadeObj = k.add([
    k.rect(12, 12),
    k.color(0, 100, 0),
    k.pos(spawnPos),
    k.anchor("center"),
    k.rotate(0),
    k.area(),
    k.body(), 
    k.z(player.z),
    {
      state: "moving",
      velocity: direction.scale(speed),
      originalPos: spawnPos.clone(),
      detonationTimer: armedLifetime,
    },
  ]);

  const explode = () => {
    if (!grenadeObj.exists()) return;
    const explosionPos = grenadeObj.pos.clone();
    k.destroy(grenadeObj);

    spawnShockwave(k, explosionPos, {
      damage: player.damage * 4,
      maxRadius: 250,
      sharedState: sharedState,
    });
  };

  const armGrenade = () => {
    if (grenadeObj.state === "armed") return;
    grenadeObj.state = "armed";
    grenadeObj.velocity = grenadeObj.velocity.scale(0.1);
    grenadeObj.color = k.rgb(255, 0, 0);
  };

  grenadeObj.onUpdate(() => {
    if (sharedState.isPaused || sharedState.upgradeOpen) return;
    grenadeObj.pos = grenadeObj.pos.add(grenadeObj.velocity.scale(k.dt()));
    grenadeObj.angle += 480 * k.dt();

    if (grenadeObj.state === "moving" && grenadeObj.pos.dist(grenadeObj.originalPos) >= armDistance) {
      armGrenade();
    }
    if (grenadeObj.state === "armed") {
      grenadeObj.detonationTimer -= k.dt();
      if (grenadeObj.detonationTimer <= 0) {
        explode();
      }
    }
  });

  grenadeObj.onCollide("enemy", () => {
    if (grenadeObj.state === "moving") {
      armGrenade();
    }
  });
}

// Defines cooldowns and execution logic for each skill.
export const skills = {
  strongShoot: {
    cooldown: 5,
    execute: strongShoot,
  },
  teleport: {
    cooldown: 20, // Fixed 20-second cooldown
    execute: teleport,
  },
  grenade: {
    cooldown: 15,
    execute: grenade,
  },
  none: {
    cooldown: 0,
    execute: () => {},
  },
};
