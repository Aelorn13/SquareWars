import { spawnPowerUp, POWERUP_TYPES } from "./powerup.js";
function chooseEnemyType(enemyTypes) {
  const totalChance = enemyTypes.reduce((sum, t) => sum + t.chance, 0);
  const roll = Math.random() * totalChance;
  let sum = 0;

  for (const type of enemyTypes) {
    sum += type.chance;
    if (roll < sum) return type;
  }
  // Fallback
  return enemyTypes[0];
}

export function spawnEnemy(k, player, updateHealthBar, updadeScoreLabel,inceaseScore) {
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

  // Define enemy types
  const enemyTypes = [
    {
      name: "normal",
      score: 1,
      chance: 80,
      color: k.rgb(245, 74, 74, 1),
      size: 32,
      maxHp: 4,
      speed: 100,
      damage: 1,
    },
    {
      name: "fast",
            score: 1,

      chance: 15,
      color: k.rgb(248, 175, 39, 1),
      size: 28,
      maxHp: 2,
      speed: 180,
      damage: 1,
    },
    {
      name: "tank",
            score: 2,

      chance: 10,
      color: k.rgb(100, 100, 255),
      size: 40,
      maxHp: 10,
      speed: 60,
      damage: 3,
    },
    {
      name: "rageTank",
            score: 3,

      chance: 3,
      color: k.rgb(153, 36, 27, 1),
      size: 36,
      maxHp: 8,
      speed: 45,
      damage: 2,
    },
  ];

  const type = chooseEnemyType(enemyTypes);

  const enemy = k.add([
    k.rect(type.size, type.size),
    k.color(type.color),
    k.anchor("center"),
    k.area(),
    k.body(),
    k.pos(pos),
    k.rotate(0),
    k.health(type.maxHp),
    {
      score: type.score,
      speed: type.speed,
      maxHp: type.maxHp,
      damage: type.damage,
      type: type.name, // "normal", "rageTank", etc.
    },
  ]);

  // Face player
  enemy.rotateTo(player.pos.angle(enemy.pos));

  // Move towards player
  enemy.onUpdate(() => {
    enemy.moveTo(player.pos, enemy.speed);
  });

  // When hitting player
  enemy.onCollide("player", () => {
    if (player.isInvincible) return;
    player.hurt(enemy.damage);
    updateHealthBar?.();
    k.shake(10);
    if (player.hp() <= 0) {
      k.go("gameover");
    }
    k.destroy(enemy);
  });

  // When hit by bullet
  enemy.onCollide("bullet", (bullet) => {
    k.destroy(bullet);
    enemy.hurt(player.damage);

    if (enemy.hp() > 0) {
      const hpRatio = Math.max(enemy.hp() / enemy.maxHp, 0.01); // 1.0 = full HP, 0 = dead

      // Store original color on spawn if not already saved
      if (!enemy.originalColor) {
        enemy.originalColor = enemy.color.clone();
      }
      const fadeTo = k.rgb(240, 240, 240);
      const r = Math.floor(
        enemy.originalColor.r * hpRatio + fadeTo.r * (1 - hpRatio)
      );
      const g = Math.floor(
        enemy.originalColor.g * hpRatio + fadeTo.g * (1 - hpRatio)
      );
      const b = Math.floor(
        enemy.originalColor.b * hpRatio + fadeTo.b * (1 - hpRatio)
      );

      if (enemy.type === "rageTank") {
        const speedMultiplier = 1 + (1 - hpRatio) - 0.1;
        enemy.speed *= speedMultiplier;
      }

      // Knockback effect (temporary slowdown)
      const originalSpeed = enemy.speed;
      enemy.speed = originalSpeed * 0.5;
      k.wait(0.2, () => {
        enemy.speed = originalSpeed;
      });
      enemy.use(k.color(r, g, b));
      return;
    }

    k.destroy(enemy);
        inceaseScore(enemy.score);
    updadeScoreLabel?.();
    dropPowerUp(k, player, enemy.pos);
  });
}

function dropPowerUp(k, player, pos) {
  const dropChance = player.luck ?? 0;
  if (Math.random() < dropChance) {
    const choice = k.choose(POWERUP_TYPES);
    spawnPowerUp(k, pos, choice);
  }
}
