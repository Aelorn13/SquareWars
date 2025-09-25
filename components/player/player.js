//components/player/player.js
import {
  updateInput,
  consumeDash,
  moveVec,
  aimWorldTarget,
} from "./controls.js";
import { setupPlayerCosmetics } from "./cosmetics/playerCosmetic.js";
import { applyInvincibility as applyInvincibilityBuff } from "../powerup/powerupEffects/temporaryStatBuffEffect.js";

const PLAYER_CONFIG = {
  SIZE: 28,
  INITIAL_STATS: {
    bulletSpreadDeg: 10,
    critChance: 0.1,
    critMultiplier: 2,
    projectiles: 1,
    damage: 1,
    speed: 95,
    luck: 0.1,
    bulletSpeed: 300,
    attackSpeed: 0.5,
    dashDuration: 0.2,
    dashCooldown: 2.5,
    dashSpeedMultiplier: 4,
  },
};

export function createPlayer(k, sharedState) {
  // Dash state machine
  const dash = {
    active: false,
    cooldown: 0,
    duration: 0,

    update(dt) {
      this.cooldown = Math.max(0, this.cooldown - dt);
      if (this.duration > 0) {
        this.duration = Math.max(0, this.duration - dt);
        if (this.duration === 0) this.active = false;
      }
    },

    trigger(player) {
      if (this.cooldown > 0 || this.active) return;
      this.active = true;
      this.duration = player.dashDuration;
      this.cooldown = player.dashCooldown;
    },

    getCooldownProgress(player) {
      return player.dashCooldown === 0
        ? 1
        : 1 - this.cooldown / player.dashCooldown;
    },
  };

  const { area } = sharedState;
  const centerPos = k.vec2(area.x + area.w / 2, area.y + area.h / 2);

  const player = k.add([
    k.rect(PLAYER_CONFIG.SIZE, PLAYER_CONFIG.SIZE),
    k.anchor("center"),
    k.pos(centerPos),
    k.color(0, 0, 255),
    k.rotate(0),
    k.area(),
    k.body({ isSensor: true }),
    k.health(3, 10),
    k.scale(1),
    k.z(0),
    "player",
    {
      ...PLAYER_CONFIG.INITIAL_STATS,
      isShooting: false,
      isInvincible: false,

      takeDamage(amount) {
        if (this.isInvincible) return;
        this.hurt(amount);
        // delegate to central buff system; pass sharedState so pause works
        this.applyInvincibility(2);
        k.shake(10);
      },

      applyInvincibility(seconds) {
        // delegate to the unified implementation and pass sharedState
        applyInvincibilityBuff(k, this, seconds, { sharedState });
      },
    },
  ]);

  player.onUpdate(() => {
    if (sharedState.isPaused) return;

    updateInput(k, player.pos);
    dash.update(k.dt());

    if (consumeDash()) dash.trigger(player);

    // Face cursor/aim direction
    const target = aimWorldTarget(k, player.pos);
    player.rotateTo(target.angle(player.pos));

    // Movement with dash boost
    const move = moveVec(k);
    const speed = dash.active
      ? player.speed * player.dashSpeedMultiplier
      : player.speed;
    player.move(move.scale(speed));

    // Constrain to arena
    const half = PLAYER_CONFIG.SIZE / 2;
    player.pos.x = k.clamp(player.pos.x, area.x + half, area.x + area.w - half);
    player.pos.y = k.clamp(player.pos.y, area.y + half, area.y + area.h - half);
  });

  player.getDashCooldownProgress = () => dash.getCooldownProgress(player);
  setupPlayerCosmetics(k, player);

  return player;
}
