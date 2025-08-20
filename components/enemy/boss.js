// components/enemy/boss.js
import { spawnEnemy } from "./enemy.js";

export const SUMMON_COOLDOWN = 9;
export const SHOOT_COOLDOWN = 2;
export const CHARGE_COOLDOWN = 5;

// --- helpers used by boss brain ---

function bossSummonMinions(
  k,
  boss,
  player,
  updateHealthBar,
  updateScoreLabel,
  increaseScore,
  sharedState,
  count = 3
) {
  // small green telegraph
  boss._telegraphT = 0;
  boss._telegraphLen = 0.4;
  boss._telegraphFrom = boss.originalColor;
  boss._telegraphTo = [0, 200, 0];
  boss._telegraphBack = true;

  k.wait(boss._telegraphLen, () => {
    for (let i = 0; i < count; i++) {
      const offset = k.vec2(k.rand(-100, 100), k.rand(-100, 100));
      const pos = boss.pos.add(offset);

      spawnEnemy(
        k,
        player,
        updateHealthBar,
        updateScoreLabel,
        increaseScore,
        sharedState,
        null,   // random type
        pos,     // near boss
        sharedState.spawnProgress ?? 1
      );
    }
  });
}

function bossSpreadShot(k, boss, sharedState, damage = 2, speed = 120, count = 12) {
  // orange telegraph
  boss._telegraphT = 0;
  boss._telegraphLen = 0.25;
  boss._telegraphFrom = boss.originalColor;
  boss._telegraphTo = [200, 100, 0];
  boss._telegraphBack = true;

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
      if (!sharedState.isPaused) bullet.pos = bullet.pos.add(bullet.vel.scale(k.dt()));
    });
  }
}

// Sets up a state-driven charge (no nested onUpdate registration)
function startCharge(boss, player) {
  if (boss.chargeState !== "idle") return;
  boss.chargeState = "windup";
  boss.chargeTimer = 0;
  boss.chargeDir = player.pos.sub(boss.pos).unit();
}

// call once when creating boss
export function attachBossBrain(
  k,
  boss,
  player,
  updateHealthBar,
  updateScoreLabel,
  increaseScore,
  sharedState
) {
  // prevent duplicate global listeners across runs
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

  // init boss state
  boss.phase = 1;
  boss.summonCooldown = SUMMON_COOLDOWN;
  boss.shootCooldown = SHOOT_COOLDOWN;
  boss.chargeCooldown = CHARGE_COOLDOWN;
  boss.chargeState = "idle"; // "idle" | "windup" | "moving"
  boss.chargeTimer = 0;
  boss.chargeDir = k.vec2(0, 0);

  // simple color telegraph driver (used by summon/spread)
  boss.onUpdate(() => {
    if (sharedState.isPaused || boss.dead) return;

    // color telegraph (optional)
    if (boss._telegraphT != null) {
      boss._telegraphT += k.dt();
      const p = Math.min(1, boss._telegraphT / boss._telegraphLen);
      const r = Math.floor(boss._telegraphFrom[0] * (1 - p) + boss._telegraphTo[0] * p);
      const g = Math.floor(boss._telegraphFrom[1] * (1 - p) + boss._telegraphTo[1] * p);
      const b = Math.floor(boss._telegraphFrom[2] * (1 - p) + boss._telegraphTo[2] * p);
      boss.use(k.color(k.rgb(r, g, b)));
      if (p >= 1) {
        if (boss._telegraphBack) {
          // fade back quickly
          boss._telegraphFrom = [r, g, b];
          boss._telegraphTo = boss.originalColor;
          boss._telegraphLen = 0.2;
          boss._telegraphT = 0;
          boss._telegraphBack = false;
        } else {
          boss._telegraphT = null;
          boss.use(k.color(k.rgb(...boss.originalColor)));
        }
      }
    }

    // phase logic / transitions
    const hpRatio = boss.hp() / boss.maxHp;
    if (hpRatio <= 0.6 && boss.phase === 1) {
      boss.phase = 2;
      boss.speed *= 1.2;
    }
    if (hpRatio <= 0.3 && boss.phase === 2) {
      boss.phase = 3;
      boss.speed *= 1.4;
    }

    // cooldown ticking
    boss.summonCooldown -= k.dt();
    boss.shootCooldown -= k.dt();
    boss.chargeCooldown -= k.dt();

    // actions
    if (boss.summonCooldown <= 0) {
      const count = boss.phase === 1 ? 3 : boss.phase === 2 ? 5 : 8;
      bossSummonMinions(
        k, boss, player, updateHealthBar, updateScoreLabel, increaseScore, sharedState, count
      );
      boss.summonCooldown = SUMMON_COOLDOWN;
    }

    if (boss.phase >= 2 && boss.shootCooldown <= 0) {
      if (boss.phase === 2) bossSpreadShot(k, boss, sharedState, 2, 120, 12);
      else bossSpreadShot(k, boss, sharedState, 3, 160, 18);
      boss.shootCooldown = SHOOT_COOLDOWN;
    }

    if (boss.phase === 1 && boss.chargeCooldown <= 0 && boss.chargeState === "idle") {
      startCharge(boss, player);
      boss.chargeCooldown = CHARGE_COOLDOWN;
    }
    if (boss.phase === 3 && boss.chargeCooldown <= 0 && boss.chargeState === "idle") {
      startCharge(boss, player);
      boss.chargeCooldown = CHARGE_COOLDOWN * 4;
    }

    // charge state machine
    const CHARGE_UP = 1.0;
    const CHARGE_DURATION = 0.6;
    const MULT = 6;

    if (boss.chargeState === "windup") {
      boss.chargeTimer += k.dt();
      // fade to red during windup
      const p = Math.min(1, boss.chargeTimer / CHARGE_UP);
      const r = Math.floor(boss.originalColor[0] * (1 - p) + 200 * p);
      const g = Math.floor(boss.originalColor[1] * (1 - p) + 0 * p);
      const b = Math.floor(boss.originalColor[2] * (1 - p) + 0 * p);
      boss.use(k.color(k.rgb(r, g, b)));
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
