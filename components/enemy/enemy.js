// components/enemy/enemy.js
import { enemyTypes, chooseEnemyType } from "./enemyTypes.js";
import {
  fadeColor,
  dropPowerUp,
  enemyDeathAnimation,
  pickEdgeSpawnPosFarFromPlayer,
  showSpawnTelegraph,
} from "./enemyUtils.js";
import { attachBossBrain } from "./boss.js";

/**
 * spawnEnemy(...)
 *  - forceType: string name to force (e.g. "boss")
 *  - posOverride: if provided, spawn at this position (no edge telegraph by default)
 *  - progress: 0..1 used by chooseEnemyType (rarity ramping)
 *  - telegraph: if true and posOverride is null, show edge telegraph before spawn
 */
export function spawnEnemy(
  k,
  player,
  updateHealthBar,
  updateScoreLabel,
  increaseScore,
  sharedState,
  forceType = null,
  posOverride = null,
  progress = 0,
  telegraph = true
) {
  // ensure global player<->enemy collision hook exists (one-time)
  if (!sharedState._enemyPlayerHook) {
    sharedState._enemyPlayerHook = true;
    k.onCollide("enemy", "player", (e, p) => {
      if (!e || !p || e.dead) return;
      if (p.isInvincible) return;
      p.hurt(e.damage ?? 1);
      updateHealthBar?.();
      k.shake(10);
      if (p.hp && p.hp() <= 0) k.go("gameover");
      if (e.type !== "boss") k.destroy(e);
    });
  }

  // choose spawn position
  const defaultPos = pickEdgeSpawnPosFarFromPlayer(
    k,
    sharedState,
    player,
    120,
    28
  );
  const pos = posOverride ?? defaultPos;

  // choose enemy type (forceType overrides)
  const chosenType = forceType
    ? enemyTypes.find((t) => t.name === forceType) ??
      chooseEnemyType(enemyTypes, progress)
    : chooseEnemyType(enemyTypes, progress);

  // inner function that creates the enemy entity immediately
  const createNow = () => {
    const type = chosenType;
    const enemy = k.add([
      k.rect(type.size, type.size),
      k.color(k.rgb(...type.color)),
      k.anchor("center"),
      k.area(),
      k.body(),
      k.pos(pos),
      k.rotate(0),
      k.health(type.maxHp),
      "enemy",
      {
        originalColor: type.color,
        score: type.score,
        speed: type.speed,
        maxHp: type.maxHp,
        damage: type.damage,
        type: type.name,
        dead: false,
      },
    ]);

    // default movement / chase
    enemy.rotateTo(player.pos.angle(enemy.pos));
    enemy.onUpdate(() => {
      if (sharedState.isPaused || enemy.dead) return;
      if (enemy.type !== "boss" || (enemy.chargeState ?? "idle") === "idle") {
        enemy.moveTo(player.pos, enemy.speed);
      }

      if (enemy.dead) return; // already handled

      let hpVal;
      if (typeof enemy.hp === "function") {
        hpVal = enemy.hp();
      } else if (typeof enemy.hp === "number") {
        hpVal = enemy.hp;
      }

      // skip until health is properly initialized
      if (typeof hpVal !== "number" || Number.isNaN(hpVal)) return;

      if (hpVal <= 0) {
        enemyDeathAnimation(k, enemy);
        increaseScore(enemy.score);
        updateScoreLabel?.();
        dropPowerUp(k, player, enemy.pos, sharedState);
        // enemy.dead is set in enemyDeathAnimation
      }
    });

    // bullet collision (player bullets)
    enemy.onCollide("bullet", (bullet) => {
      if (enemy.dead) return;
      k.destroy(bullet);
      enemy.hurt(bullet.damage);
      //additional visual crit effect
      if (bullet.isCrit) {
        for (let i = 0; i < 8; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 100 + 50;
          const p = k.add([
            k.circle(2),
            k.color(255, 0, 0),
            k.pos(enemy.pos),
            k.anchor("center"),
          ]);
          const vel = k.vec2(Math.cos(angle), Math.sin(angle)).scale(speed);
          k.tween(p.pos, p.pos.add(vel.scale(0.2)), 0.2, (v) => (p.pos = v));
          k.wait(0.2, () => k.destroy(p));
        }
      }

      if (enemy.hp() > 0) {
        const hpRatio = Math.max(enemy.hp() / enemy.maxHp, 0.01);
        const fadeTo = [240, 240, 240];
        if (enemy.type === "rageTank") enemy.speed *= 1 + (1 - hpRatio) - 0.1;
        if (enemy.type !== "boss") {
          const originalSpeed = enemy.speed;
          enemy.speed = originalSpeed * 0.3;
          k.wait(0.2, () => (enemy.speed = originalSpeed));
        }
        enemy.use(
          k.color(k.rgb(...fadeColor(enemy.originalColor, fadeTo, hpRatio)))
        );
      } else {
        enemyDeathAnimation(k, enemy);
        increaseScore?.(enemy.score);
        updateScoreLabel?.();
        if (enemy.type === "boss") {
          k.wait(0.5, () => k.go("victory"));
        }
        dropPowerUp(k, player, enemy.pos, sharedState);
      }
    });

    // boss-specific initialization
    if (enemy.type === "boss") {
      attachBossBrain(
        k,
        enemy,
        player,
        updateHealthBar,
        updateScoreLabel,
        increaseScore,
        sharedState
      );
    }

    return enemy;
  };

  // If posOverride provided (spawn near boss etc) we usually skip edge telegraph:
  if (posOverride || !telegraph) {
    return createNow();
  }

  // Otherwise: telegraph visually, then spawn after delay
  const TELEGRAPH_DURATION = 0.6;
  showSpawnTelegraph(k, pos, sharedState, TELEGRAPH_DURATION);
  k.wait(TELEGRAPH_DURATION, () => {
    createNow();
  });

  // return nothing (spawn deferred) — callers in your code don't rely on return value
  return;
}
