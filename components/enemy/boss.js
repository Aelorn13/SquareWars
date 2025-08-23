// components/enemy/boss.js
import { spawnEnemy } from "./enemy.js";

export const SUMMON_COOLDOWN = 9;
export const SHOOT_COOLDOWN = 2;
export const CHARGE_COOLDOWN = 5;

// --- Utility functions ---

function lerpColor(from, to, t) {
  return [
    Math.floor(from[0] * (1 - t) + to[0] * t),
    Math.floor(from[1] * (1 - t) + to[1] * t),
    Math.floor(from[2] * (1 - t) + to[2] * t),
  ];
}

// Trigger a color telegraph animation on the boss
function startTelegraph(boss, toColor, duration, returnToOriginal = true) {
  boss._telegraphProgress = 0;
  boss._telegraphDuration = duration;
  boss._telegraphFrom = boss.originalColor;
  boss._telegraphTo = toColor;
  boss._telegraphReturn = returnToOriginal;
}

// --- Boss actions ---

function bossSummonMinions(k, boss, player, updateHealthBar, updateScoreLabel, increaseScore, sharedState, count = 3) {
  startTelegraph(boss, [0, 200, 0], 0.4); // green flash

  k.wait(0.4, () => {
    for (let i = 0; i < count; i++) {
      const offset = k.vec2(k.rand(-100, 100), k.rand(-100, 100));
      const pos = boss.pos.add(offset);

      spawnEnemy(k, player, updateHealthBar, updateScoreLabel, increaseScore, sharedState,
        null, // random type
        pos,  // near boss
        sharedState.spawnProgress ?? 1,
        false
      );
    }
  });
}

function bossSpreadShot(k, boss, sharedState, damage = 2, speed = 120, count = 12) {
  startTelegraph(boss, [200, 100, 0], 0.25); // orange flash

  const step = (Math.PI * 2) / count;
  for (let i = 0; i < count; i++) {
    const dir = k.vec2(Math.cos(step * i), Math.sin(step * i));
    const bullet = k.add([
      k.rect(8, 8),
      k.color(k.rgb(255, 120, 0)),
      k.pos(boss.pos),
      k.area(),
      k.anchor("center"),
      k.offscreen({ destroy: true }),
      "bossBullet",
      { vel: dir.scale(speed), damage },
    ]);
    bullet.onUpdate(() => {
      if (!sharedState.isPaused) {
        bullet.pos = bullet.pos.add(bullet.vel.scale(k.dt()));
      }
    });
  }
}

// Prepare the boss to charge at player
function startCharge(boss, player) {
  if (boss.chargeState !== "idle") return;
  boss.chargeState = "windup";
  boss.chargeTimer = 0;
  boss.chargeDir = player.pos.sub(boss.pos).unit();
}

// --- Brain attachment ---

export function attachBossBrain(k, boss, player, updateHealthBar, updateScoreLabel, increaseScore, sharedState) {
  // Prevent multiple global bullet collision handlers
  if (!sharedState._bossBulletHook) {
    sharedState._bossBulletHook = true;
    k.onCollide("player", "bossBullet", (p, bullet) => {
      if (p.isInvincible) return;
      p.hurt(bullet.damage ?? 2);
      updateHealthBar?.();
      k.destroy(bullet);
      if (p.hp() <= 0) k.go("gameover");
    });
  }

  // Initialise boss state
  boss.phase = 1;
  boss.cooldowns = {
    summon: SUMMON_COOLDOWN,
    shoot: SHOOT_COOLDOWN,
    charge: CHARGE_COOLDOWN,
  };
  boss.chargeState = "idle"; // "idle" | "windup" | "moving"
  boss.chargeTimer = 0;
  boss.chargeDir = k.vec2(0, 0);

  boss.onUpdate(() => {
    if (sharedState.isPaused || boss.dead) return;

    // --- Telegraph animation ---
    if (boss._telegraphProgress != null) {
      boss._telegraphProgress += k.dt();
      const p = Math.min(1, boss._telegraphProgress / boss._telegraphDuration);
      boss.use(k.color(k.rgb(...lerpColor(boss._telegraphFrom, boss._telegraphTo, p))));

      if (p >= 1) {
        if (boss._telegraphReturn) {
          // Fade back quickly
          boss._telegraphFrom = boss._telegraphTo;
          boss._telegraphTo = boss.originalColor;
          boss._telegraphDuration = 0.2;
          boss._telegraphProgress = 0;
          boss._telegraphReturn = false;
        } else {
          boss._telegraphProgress = null;
          boss.use(k.color(k.rgb(...boss.originalColor)));
        }
      }
    }

    // --- Phase transitions ---
    const hpRatio = boss.hp() / boss.maxHp;
    if (hpRatio <= 0.6 && boss.phase === 1) {
      boss.phase = 2;
      boss.speed *= 1.2;
    }
    if (hpRatio <= 0.3 && boss.phase === 2) {
      boss.phase = 3;
      boss.speed *= 1.4;
    }

    // --- Cooldowns ---
    boss.cooldowns.summon -= k.dt();
    boss.cooldowns.shoot -= k.dt();
    boss.cooldowns.charge -= k.dt();

    // --- Abilities ---
    if (boss.cooldowns.summon <= 0) {
      const count = boss.phase === 1 ? 3 : boss.phase === 2 ? 5 : 8;
      bossSummonMinions(k, boss, player, updateHealthBar, updateScoreLabel, increaseScore, sharedState, count);
      boss.cooldowns.summon = SUMMON_COOLDOWN;
    }

    if (boss.phase >= 2 && boss.cooldowns.shoot <= 0) {
      if (boss.phase === 2) bossSpreadShot(k, boss, sharedState, 2, 120, 12);
      else bossSpreadShot(k, boss, sharedState, 3, 160, 18);
      boss.cooldowns.shoot = SHOOT_COOLDOWN;
    }

    if (boss.phase === 1 && boss.cooldowns.charge <= 0 && boss.chargeState === "idle") {
      startCharge(boss, player);
      boss.cooldowns.charge = CHARGE_COOLDOWN;
    }
    if (boss.phase === 3 && boss.cooldowns.charge <= 0 && boss.chargeState === "idle") {
      startCharge(boss, player);
      boss.cooldowns.charge = CHARGE_COOLDOWN * 4;
    }

    // --- Charge state machine ---
    const CHARGE_UP = 1.0;
    const CHARGE_DURATION = 0.6;
    const MULT = 6;

    if (boss.chargeState === "windup") {
      boss.chargeTimer += k.dt();
      // fade to red during windup
      boss.use(k.color(k.rgb(...lerpColor(boss.originalColor, [200, 0, 0], boss.chargeTimer / CHARGE_UP))));
      if (boss.chargeTimer >= CHARGE_UP) {
        boss.chargeTimer = 0;
        boss.chargeState = "moving";
        boss.use(k.color(k.rgb(...boss.originalColor)));
      }
    } else if (boss.chargeState === "moving") {
      boss.chargeTimer += k.dt();
      boss.pos = boss.pos.add(boss.chargeDir.scale(boss.speed * MULT * k.dt()));
      if (boss.chargeTimer >= CHARGE_DURATION) {
        boss.chargeTimer = 0;
        boss.chargeState = "idle";
      }
    }
  });
}
