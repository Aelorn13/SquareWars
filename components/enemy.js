import { spawnPowerUp, POWERUP_TYPES } from "./powerup.js";

const enemyTypes = [
  {
    name: "normal",
    score: 1,
    chance: 80,
    color: [245, 74, 74],
    size: 32,
    maxHp: 4,
    speed: 100,
    damage: 1,
  },
  {
    name: "fast",
    score: 1,
    chance: 15,
    color: [248, 175, 39],
    size: 28,
    maxHp: 2,
    speed: 180,
    damage: 1,
  },
  {
    name: "tank",
    score: 2,
    chance: 10,
    color: [100, 100, 255],
    size: 40,
    maxHp: 10,
    speed: 60,
    damage: 3,
  },
  {
    name: "rageTank",
    score: 3,
    chance: 3,
    color: [153, 36, 27],
    size: 36,
    maxHp: 8,
    speed: 45,
    damage: 2,
  },
];

function chooseEnemyType(enemyTypes) {
  const totalChance = enemyTypes.reduce((sum, t) => sum + t.chance, 0);
  const roll = Math.random() * totalChance;
  let sum = 0;

  for (const type of enemyTypes) {
    sum += type.chance;
    if (roll < sum) return type;
  }
  return enemyTypes[0];
}
function fadeColor(original, fadeTo, ratio) {
  const r = Math.floor(original[0] * ratio + fadeTo[0] * (1 - ratio));
  const g = Math.floor(original[1] * ratio + fadeTo[1] * (1 - ratio));
  const b = Math.floor(original[2] * ratio + fadeTo[2] * (1 - ratio));
  return [r, g, b];
}
function dropPowerUp(k, player, pos, sharedState) {
  const dropChance = player.luck ?? 0;
  if (Math.random() < dropChance) {
    const choice = k.choose(POWERUP_TYPES);
    spawnPowerUp(k, pos, choice, sharedState);
  }
}
function enemyDeathAnimation(k, enemy) {
  // Animate scale down and fade out over 0.4 seconds
  const duration = 0.4;
  const startScale = 1;
  const endScale = 0.1;
  const startOpacity = 1;
  const endOpacity = 0;

  let t = 0;
  enemy.onUpdate(() => {
    t += k.dt();
    const progress = Math.min(t / duration, 1);
    const scale = startScale + (endScale - startScale) * progress;
    const opacity = startOpacity + (endOpacity - startOpacity) * progress;
    enemy.scale = k.vec2(scale, scale);
    enemy.opacity = opacity;
    if (progress >= 1) {
      k.destroy(enemy);
    }
  });
  enemy.solid = false;
  enemy.area.enabled = false;
}
export function spawnEnemy(
  k,
  player,
  updateHealthBar,
  updateScoreLabel,
  increaseScore,
  sharedState
) {
  const spawnPoints = [
    k.vec2(k.width() / 2, k.height()),
    k.vec2(0, k.height()),
    k.vec2(k.width(), k.height()),
    k.vec2(0, k.height() / 2),
    k.vec2(k.width(), 0),
    k.vec2(0, -k.height()),
    k.vec2(0, -k.height() / 2),
  ];

  const pos = spawnPoints[k.randi(spawnPoints.length)];
  const type = chooseEnemyType(enemyTypes);

  const enemy = k.add([
    k.rect(type.size, type.size),
    k.color(k.rgb(...type.color)),
    k.anchor("center"),
    k.area(),
    k.body(),
    k.pos(pos),
    k.rotate(0),
    k.health(type.maxHp),
    {
      originalColor: type.color,
      score: type.score,
      speed: type.speed,
      maxHp: type.maxHp,
      damage: type.damage,
      type: type.name,
    },
  ]);

  // Face player
  enemy.rotateTo(player.pos.angle(enemy.pos));

  // Move towards player
  enemy.onUpdate(() => {
    if (sharedState.isPaused) return;
    enemy.moveTo(player.pos, enemy.speed);
  });

  // When hitting player
  enemy.onCollide("player", () => {
    if (player.isInvincible) return;
    player.hurt(enemy.damage);
    updateHealthBar?.();
    k.shake(10);
    if (player.hp() <= 0) k.go("gameover");
    k.destroy(enemy);
  });

  // When hit by bullet
  enemy.onCollide("bullet", (bullet) => {
    k.destroy(bullet);
    enemy.hurt(player.damage);

    if (enemy.hp() > 0) {
      const hpRatio = Math.max(enemy.hp() / enemy.maxHp, 0.01); // 1.0 = full HP, 0 = dead
      const fadeTo = [240, 240, 240];

      if (enemy.type === "rageTank") enemy.speed *= 1 + (1 - hpRatio) - 0.1;

      // Knockback effect (temporary slowdown)
      const originalSpeed = enemy.speed;
      enemy.speed = originalSpeed * 0.3;
      k.wait(0.2, () => {
        enemy.speed = originalSpeed;
      });
      enemy.use(
        k.color(k.rgb(...fadeColor(enemy.originalColor, fadeTo, hpRatio)))
      );
      return;
    }

    enemyDeathAnimation(k, enemy);
    increaseScore(enemy.score);
    updateScoreLabel?.();
    dropPowerUp(k, player, enemy.pos,sharedState);
  });
}
