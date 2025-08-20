import { enemyTypes, chooseEnemyType } from "./enemyTypes.js";
import { fadeColor, dropPowerUp, enemyDeathAnimation } from "./enemyUtils.js";
import { attachBossBrain } from "./boss.js";

export function spawnEnemy(
  k,
  player,
  updateHealthBar,
  updateScoreLabel,
  increaseScore,
  sharedState,
  forceType = null,
  posOverride = null,
  progress = 0 // <-- NEW (0..1)
) {
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

  const spawnPoints = [
    k.vec2(k.width() / 2, k.height()),
    k.vec2(0, k.height()),
    k.vec2(k.width(), k.height()),
    k.vec2(0, k.height() / 2),
    k.vec2(k.width(), 0),
    k.vec2(0, -k.height()),
    k.vec2(0, -k.height() / 2),
  ];
  const pos = posOverride ?? spawnPoints[k.randi(spawnPoints.length)];

  let type;
  if (forceType) {
    type = enemyTypes.find((t) => t.name === forceType) ?? chooseEnemyType(enemyTypes, progress);
  } else {
    type = chooseEnemyType(enemyTypes, progress); // <-- pass progress
  }

  const enemy = k.add([
    k.rect(type.size, type.size),
    k.color(k.rgb(...type.color)),
    k.anchor("center"),
    k.area(),
    // k.body(),
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

  enemy.rotateTo(player.pos.angle(enemy.pos));
  enemy.onUpdate(() => {
    if (sharedState.isPaused || enemy.dead) return;
    if (enemy.type !== "boss" || (enemy.chargeState ?? "idle") === "idle") {
      enemy.moveTo(player.pos, enemy.speed);
    }
  });

  enemy.onCollide("bullet", (bullet) => {
    if (enemy.dead) return;
    k.destroy(bullet);
    enemy.hurt(player.damage);

    if (enemy.hp() > 0) {
      const hpRatio = Math.max(enemy.hp() / enemy.maxHp, 0.01);
      const fadeTo = [240, 240, 240];
      if (enemy.type === "rageTank") enemy.speed *= 1 + (1 - hpRatio) - 0.1;
      if (enemy.type !== "boss") {
        const originalSpeed = enemy.speed;
        enemy.speed = originalSpeed * 0.3;
        k.wait(0.2, () => (enemy.speed = originalSpeed));
      }
      enemy.use(k.color(k.rgb(...fadeColor(enemy.originalColor, fadeTo, hpRatio))));
    } else {
      enemyDeathAnimation(k, enemy);
      increaseScore?.(enemy.score);
      updateScoreLabel?.();
      if (enemy.type === "boss") k.wait(0.5, () => k.go("victory"));
      dropPowerUp(k, player, enemy.pos, sharedState);
    }
  });

  if (enemy.type === "boss") {
    attachBossBrain(k, enemy, player, updateHealthBar, updateScoreLabel, increaseScore, sharedState);
  }

  return enemy;
}
