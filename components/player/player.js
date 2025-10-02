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
     hasGhost: false,
    _isGhosting: false,
  },
};

export function createPlayer(k, sharedState) {
  // Dash state machine
  const dash = {
    active: false,
    cooldown: 0,
    duration: 0,
    // last dash direction (kaboom vec2)
    lastDir: null,

    update(dt) {
      this.cooldown = Math.max(0, this.cooldown - dt);

      if (this.duration > 0) {
        const prev = this.duration;
        this.duration = Math.max(0, this.duration - dt);
        if (prev > 0 && this.duration === 0) {
          this.active = false;

          // end ghost state and restore body if it was removed for dash
          try {
            if (player?._isGhosting) {
              player._isGhosting = false;
              player.isInvincible = false;
            }

            if (player?._bodyRemovedForDash) {
              // restore body (use same options used at creation)
              if (typeof player.use === "function") {
                player.use(k.body({ isSensor: true }));
              }
              player._bodyRemovedForDash = false;

              // if we re-added body while overlapping enemies, try to nudge out
              const maxTries = 8;
              const nudgeStep = 4;
              const dir = this.lastDir ?? k.vec2(0, -1);
              let tries = 0;
              const overlapsAny = () => {
                const pw = player.width ?? player._size ?? 32;
                return k.get("enemy").some((e) => {
                  if (e.dead) return false;
                  const ew = e.width ?? e._size ?? 32;
                  return player.pos.dist(e.pos) <= (pw + ew) * 0.5;
                });
              };
              while (tries < maxTries && overlapsAny()) {
                player.pos = player.pos.add(dir.scale(nudgeStep));
                tries++;
              }
            }
          } catch (e) {
            /* ignore safety errors */
            player._isGhosting = false;
            player.isInvincible = false;
            player._bodyRemovedForDash = false;
          }
        }
      }
    },

    trigger(player) {
      if (this.cooldown > 0 || this.active) return;
      this.active = true;
      this.duration = player.dashDuration;
      this.cooldown = player.dashCooldown;

      // compute dash direction from input; fallback to aim if no move
      const mv = moveVec(k);
      let dirVec = k.vec2(mv.x || 0, mv.y || 0);
      if (Math.hypot(dirVec.x, dirVec.y) === 0) {
        const tgt = aimWorldTarget(k, player.pos);
        dirVec = tgt.sub(player.pos).unit();
      } else {
        dirVec = dirVec.unit();
      }
      this.lastDir = dirVec;

      // Ghost upgrade: remove body so physics does not block pass-through,
      // set invincibility flag and transient ghost flag.
      if (player.hasGhost) {
        // set transient state
        player._isGhosting = true;
        player.isInvincible = true;

        // remove body component so physics won't block movement
        try {
          if (typeof player.has === "function" && player.has("body")) {
            if (typeof player.unuse === "function") {
              player.unuse("body");
              player._bodyRemovedForDash = true;
            }
          }
        } catch (e) {
          // fallback: do nothing if unuse not available
          player._bodyRemovedForDash = false;
        }

        // also apply invincibility buff (pause-aware) if you use that system
        try {
          applyInvincibilityBuff(k, player, player.dashDuration, { sharedState });
        } catch (e) {
          // fallback timing if buff helper not compatible
          if (k.wait) {
            k.wait(player.dashDuration, () => {
              player._isGhosting = false;
              player.isInvincible = false;
            });
          } else {
            setTimeout(() => {
              player._isGhosting = false;
              player.isInvincible = false;
            }, player.dashDuration * 1000);
          }
        }
      }
    },

    getCooldownProgress(player) {
      return player.dashCooldown === 0 ? 1 : 1 - this.cooldown / player.dashCooldown;
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
    if (sharedState.isPaused || sharedState.upgradeOpen) return;

    updateInput(k);
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
