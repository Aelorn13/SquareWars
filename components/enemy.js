import { spawnPowerUp,POWERUP_TYPES } from "./powerup.js";
export function spawnEnemy(k, player, onPlayerHit, onEnemyKilled) {
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
  const enemy = k.add([
    k.rect(32, 32),
    k.color(255, 0, 0),
    k.anchor("center"),
    k.area(),
    k.body(),
    k.pos(pos),
    k.rotate(0),
    k.health(3),
    {
      speed: 100,
      maxHp: 3,
      damage: 1,
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
    onPlayerHit?.();
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

    // Knockback effect (temporary slowdown)
    const originalSpeed = enemy.speed;
    enemy.speed = originalSpeed * 0.5;
    k.wait(0.2, () => {
      enemy.speed = originalSpeed;
    });

    if (enemy.hp() > 0) {
      // Color feedback
      const hpRatio = 1 - enemy.hp() / enemy.maxHp;
      const green = Math.floor(50 + 150 * hpRatio);
      const blue = Math.floor(50 + 150 * hpRatio);
      enemy.use(k.color(255, green, blue));
      return;
    }

    k.destroy(enemy);
    onEnemyKilled?.();
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
