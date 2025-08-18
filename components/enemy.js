import { spawnPowerUp, POWERUP_TYPES } from "./powerup.js";
// Boss mechanics
const SUMMON_COOLDOWN = 9;
const SHOOT_COOLDOWN = 2;
const CHARGE_COOLDOWN = 5;
function bossChargeAttack(k, boss, player) {
  if (boss.isCharging) return;
  const BOSS_SPEED_CHARGE_MULTIPLIER = 6;
  const CHARGE_DURATION = 0.6; // how long the charge lasts

  boss.isCharging = true;

  // Lock direction toward the player
  const dir = player.pos.sub(boss.pos).unit();

  // Smooth charge-up → red flash
  let t = 0;
  const duration = 1;
  boss.onUpdate(() => {
    if (boss.isCharging && t < duration) {
      t += k.dt();
      const progress = t / duration;
      const r = Math.floor(
        boss.originalColor[0] * (1 - progress) + 200 * progress
      );
      const g = Math.floor(
        boss.originalColor[1] * (1 - progress) + 0 * progress
      );
      const b = Math.floor(
        boss.originalColor[2] * (1 - progress) + 0 * progress
      );
      boss.use(k.color(k.rgb(r, g, b)));
    }
  });

  // After charge-up, move fast in direction
  k.wait(duration, () => {
    boss.use(k.color(k.rgb(...boss.originalColor)));
    let chargeTime = 0;

    boss.onUpdate(() => {
      if (!boss.isCharging) return;
      if (chargeTime < CHARGE_DURATION) {
        chargeTime += k.dt();
        boss.pos = boss.pos.add(
          dir.scale(boss.speed * BOSS_SPEED_CHARGE_MULTIPLIER * k.dt())
        );
      } else {
        boss.isCharging = false;
      }
    });
  });
}
//laser not used, looks bad
function bossLaserAttack(k, boss, player) {
  if (boss.isAttacking) return;
  boss.isAttacking = true;

  const lockPos = player.pos.clone(); // locked target
  const dir = lockPos.sub(boss.pos).unit();
  const distance = boss.pos.dist(lockPos);

  // Step 1: Warning beam (thin red line)
  const warning = k.add([
    k.rect(distance, 4),
    k.color(k.rgb(255, 0, 0)),
    k.opacity(0.7),
    k.anchor("left"),
    k.pos(boss.pos),
    k.rotate(dir.angle()), // orient towards target
    "warningBeam",
  ]);

  // Step 2: After telegraph, replace with laser
  k.wait(0.6, () => {
    k.destroy(warning);

    const laser = k.add([
      k.rect(distance, 12),
      k.color(k.rgb(255, 200, 50)),
      k.opacity(0.9),
      k.anchor("left"),
      k.area(),
      k.pos(boss.pos),
      k.rotate(dir.angle()),
      "laserBeam",
      { lifetime: 0.5 }, // exists half a second
    ]);

    // Hit player
    laser.onCollide("player", (p) => {
      if (!p.isInvincible) {
        p.hurt(3);
      }
    });

    // Step 3: Lifetime handling
    laser.onUpdate(() => {
      laser.lifetime -= k.dt();
      if (laser.lifetime <= 0) {
        k.destroy(laser);
        boss.isAttacking = false;
      }
    });
  });
}

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
  // Smooth charge-up → green
  let t = 0;
  const duration = 0.6;
  boss.onUpdate(() => {
    if (t < duration) {
      t += k.dt();
      const progress = t / duration;
      const r = Math.floor(
        boss.originalColor[0] * (1 - progress) + 0 * progress
      );
      const g = Math.floor(
        boss.originalColor[1] * (1 - progress) + 200 * progress
      );
      const b = Math.floor(
        boss.originalColor[2] * (1 - progress) + 0 * progress
      );
      boss.use(k.color(k.rgb(r, g, b)));
      if (progress >= 1) {
        k.wait(0.2, () => boss.use(k.color(k.rgb(...boss.originalColor))));
      }
    }
  });

  // Delay actual spawn to match charge-up
  k.wait(duration, () => {
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
        null, // no forced type → random normal enemy
        pos // use override → spawn near boss
      );
    }
  });
}

function bossSpreadShot(
  k,
  boss,
  sharedState,
  damage = 2,
  speed = 120,
  count = 12
) {
  // Smooth charge-up → green
  let t = 0;
  const duration = 0.6;
  boss.onUpdate(() => {
    if (t < duration) {
      t += k.dt();
      const progress = t / duration;
      const r = Math.floor(
        boss.originalColor[0] * (1 - progress) + 200 * progress
      );
      const g = Math.floor(
        boss.originalColor[1] * (1 - progress) + 100 * progress
      );
      const b = Math.floor(
        boss.originalColor[2] * (1 - progress) + 0 * progress
      );
      boss.use(k.color(k.rgb(r, g, b)));
      if (progress >= 1) {
        k.wait(0.2, () => boss.use(k.color(k.rgb(...boss.originalColor))));
      }
    }
  });

  const step = (Math.PI * 2) / count;
  for (let i = 0; i < count; i++) {
    const dir = k.vec2(Math.cos(step * i), Math.sin(step * i));
    const bullet = k.add([
      k.rect(8, 8),
      k.color(k.rgb(255, 100, 0)),
      k.pos(boss.pos),
      k.area(),
      k.anchor("center"),
      k.offscreen({ destroy: true }),
      "bossBullet",
      { vel: dir.scale(speed), damage },
    ]);
    bullet.onUpdate(() => {
      if (!sharedState.isPaused)
        bullet.pos = bullet.pos.add(bullet.vel.scale(k.dt()));
    });
  }
}

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
  {
    name: "boss",
    score: 20,
    chance: 0,
    color: [40, 40, 40],
    size: 80,
    maxHp: 100,
    speed: 80,
    damage: 9,
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
  enemy.dead = true;
  enemy.solid = false;
  enemy.area.enabled = false;
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
}
export function spawnEnemy(
  k,
  player,
  updateHealthBar,
  updateScoreLabel,
  increaseScore,
  sharedState,
  forceType = null,
  posOverride = null
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

  const pos = posOverride ?? spawnPoints[k.randi(spawnPoints.length)];
  let type;
  if (forceType) {
    type = enemyTypes.find((t) => t.name === forceType);
    if (!type) {
      console.warn(
        `Enemy type "${forceType}" not found, falling back to random.`
      );
      type = chooseEnemyType(enemyTypes);
    }
  } else type = chooseEnemyType(enemyTypes);

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
    if (player.isInvincible || enemy.dead) return;
    player.hurt(enemy.damage);
    updateHealthBar?.();
    k.shake(10);
    if (player.hp() <= 0) k.go("gameover");
    k.destroy(enemy);
  });

  if (enemy.type === "boss") {
    enemy.isCharging = false;
    enemy.chargeAttackCooldown = CHARGE_COOLDOWN;
    enemy.shootCooldown = SHOOT_COOLDOWN;
    enemy.summonCooldown = SUMMON_COOLDOWN;
    enemy.phase = 1;
    enemy.onUpdate(() => {
      if (sharedState.isPaused || enemy.dead) return;

      const hpRatio = enemy.hp() / enemy.maxHp;

      // Phase transitions
      if (hpRatio <= 0.6 && enemy.phase === 1) {
        enemy.phase = 2;
        enemy.speed *= 1.2;
      }
      if (hpRatio <= 0.3 && enemy.phase === 2) {
        enemy.phase = 3;
        enemy.speed *= 1.4;
      }
      // Summoning mechanic
      enemy.summonCooldown -= k.dt();
      if (enemy.summonCooldown <= 0) {
        let count = enemy.phase === 1 ? 3 : enemy.phase === 2 ? 5 : 8;
        bossSummonMinions(
          k,
          enemy,
          player,
          updateHealthBar,
          updateScoreLabel,
          increaseScore,
          sharedState,
          count
        );
        enemy.summonCooldown = SUMMON_COOLDOWN;
      }
      // === Phase-specific mechanics ===
      if (enemy.phase === 1) {
        enemy.chargeAttackCooldown -= k.dt();
        if (enemy.chargeAttackCooldown <= 0) {
          bossChargeAttack(k, enemy, player);
          enemy.chargeAttackCooldown = CHARGE_COOLDOWN;
        }
      }
      // Shooting mechanic (only from phase 2+)
      if (enemy.phase === 2) {
        enemy.shootCooldown -= k.dt();
        if (enemy.shootCooldown <= 0) {
          bossSpreadShot(k, enemy, sharedState, 2, 120, 12); // radial
          enemy.shootCooldown = SHOOT_COOLDOWN;
        }
      }
      if (enemy.phase === 3) {
        if (enemy.shootCooldown <= 0) {
          bossSpreadShot(k, enemy, sharedState, 3, 160, 18);
          enemy.shootCooldown = SHOOT_COOLDOWN;
        }
        if (enemy.chargeAttackCooldown <= 0) {
          bossChargeAttack(k, enemy, player);
          enemy.chargeAttackCooldown = CHARGE_COOLDOWN * 4;
        }
      }
    });

    // Boss bullet collision with player
    k.onCollide("player", "bossBullet", (p, bullet) => {
      if (p.isInvincible) return;
      p.hurt(bullet.damage);
      updateHealthBar?.();
      k.destroy(bullet);
      if (p.hp() <= 0) k.go("gameover");
    });
  }

  // When hit by bullet
  enemy.onCollide("bullet", (bullet) => {
    if (enemy.dead) return;

    k.destroy(bullet);
    enemy.hurt(player.damage);

    if (enemy.hp() > 0) {
      const hpRatio = Math.max(enemy.hp() / enemy.maxHp, 0.01); // 1.0 = full HP, 0 = dead
      const fadeTo = [240, 240, 240];

      if (enemy.type === "rageTank") enemy.speed *= 1 + (1 - hpRatio) - 0.1;

      // Knockback effect (temporary slowdown)
      if (enemy.type !== "boss") {
        const originalSpeed = enemy.speed;
        enemy.speed = originalSpeed * 0.3;
        k.wait(0.2, () => {
          enemy.speed = originalSpeed;
        });
      }
      enemy.use(
        k.color(k.rgb(...fadeColor(enemy.originalColor, fadeTo, hpRatio)))
      );
    } else {
      enemyDeathAnimation(k, enemy);
      increaseScore(enemy.score);
      updateScoreLabel?.();
      if (enemy.type === "boss")
        k.wait(0.5, () => {
          k.go("victory"); // switch scene
        });
      dropPowerUp(k, player, enemy.pos, sharedState);
    }
  });
}
