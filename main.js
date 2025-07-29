import kaplay from "https://unpkg.com/kaplay@3001.0.19/dist/kaplay.mjs";

const k = kaplay({
  height: 960,
  width: 540,
  letterBox: true,
  scale: Math.min(window.innerWidth / 540, window.innerHeight / 960),
  debug: true, //change to false later
  global: false,
  background: [10, 10, 10],
  touchToMouse: true,
  debugKey: "f4",
});
let score = 0;
const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
k.scene("game", () => {
  k.add([
    k.rect(k.height, k.width),
    k.pos(0, 0),
    k.color(20, 20, 20), // Very dark grey instead of black
    k.z(-1), // Make sure it's behind everything
    k.fixed(), // Stays static even if camera moves
  ]);

  const scoreLabel = k.add([
    k.text(`Score: ${score}`, {
      size: 24,
    }),
    k.pos(20, 20),
    k.layer("ui"),
    k.fixed(),
    k.z(100),
  ]);

  const player = k.add([
    k.rect(32, 32),
    k.anchor("center"),
    k.pos(360, 360),
    k.color(0, 0, 255),
    k.rotate(0),
    k.area(),
    k.health(3),

    "player",
    {
      speed: 120,
      bulletSpeed: 400,
      isShooting: false,
      attackSpeed: 0.3,
    },
  ]);
  player.add([k.rect(25, 8), k.pos(0, -4), k.color(255, 255, 0)]);

  player.onUpdate(() => {
    player.rotateTo(k.mousePos().angle(player.pos));

    // Movement
    let dir = k.vec2(0, 0);
    if (k.isKeyDown("left") || k.isKeyDown("a")) dir.x -= 1;
    if (k.isKeyDown("right") || k.isKeyDown("d")) dir.x += 1;
    if (k.isKeyDown("up") || k.isKeyDown("w")) dir.y -= 1;
    if (k.isKeyDown("down") || k.isKeyDown("s")) dir.y += 1;
    dir = dir.unit();
    player.move(dir.scale(player.speed));
    
    // if (isTouchDevice) {
    //   const leftBtn = k.add([
    //     k.rect(60, 60),
    //     k.pos(20, k.height() - 80),
    //     k.color(100, 100, 100),
    //     k.opacity(0.5),
    //     "leftBtn",
    //     k.fixed(),
    //   ]);

    //   k.onTouchStart((id, pos) => {
    //     if (leftBtn.worldArea().hasPt(pos)) {
    //       mobileDir.x = -1;
    //     }
    //   });

    //   k.onTouchEnd(() => {
    //     mobileDir = k.vec2(0, 0);
    //   });
    // }
  });

  k.onMouseDown(() => {
    player.isShooting = true;
  });

  k.onMouseRelease(() => {
    player.isShooting = false;
  });

  k.loop(player.attackSpeed, () => {
    if (!player.isShooting) return;
    shoot();
  });
  k.onClick(() => {
    shoot();
  });
  function shoot() {
    k.add([
      k.rect(10, 6, { radius: 6 }),
      k.color(255, 255, 0),
      k.pos(player.pos),
      k.area(),
      k.anchor("center"),
      k.offscreen({
        destroy: true,
      }),
      k.rotate(player.angle),
      k.move(k.mousePos().sub(player.pos).unit(), player.bulletSpeed),
      "bullet",
    ]);
  }
  function makeEnemy() {
    const spawnPoints = [
      k.vec2(k.width() / 2, k.height()),
      k.vec2(0, k.height()),
      k.vec2(k.width(), k.height()),
      k.vec2(0, k.height() / 2),
      k.vec2(k.width(), 0),
      k.vec2(0, -k.height()),
      k.vec2(0, -k.height() / 2),
    ];

    const selectedSpawnPoint = spawnPoints[k.randi(spawnPoints.length)];
    const enemy = k.add([
      k.rect(32, 32),
      k.color(255, 0, 0),
      k.anchor("center"),
      k.area(),
      k.pos(selectedSpawnPoint),
      k.rotate(0),
      k.health(3),
      {
        speed: 100,
        maxHp: 3,
        damage: 1,
      },
    ]);

    enemy.rotateTo(player.pos.angle(enemy.pos));

    enemy.onUpdate(() => {
      enemy.moveTo(player.pos, enemy.speed);
    });
    enemy.onCollide("player", (player) => {
      player.hurt(enemy.damage);
      k.destroy(enemy);
      k.shake(10);
      if (player.hp() === 0) {
        k.go("gameover");
      }
    });

    enemy.onCollide("bullet", (bullet) => {
      k.destroy(bullet);

      // Temporarily reduce speed (or stop movement)
      const originalSpeed = enemy.speed || 100;
      enemy.speed = originalSpeed * 0.5;

      // Restore after short delay

      k.wait(0.2, () => {
        enemy.speed = originalSpeed;
      });
      if (enemy.hp() > 0) {
        enemy.hurt();

        // Color intensity based on HP
        const hpRatio = 1 - enemy.hp() / enemy.maxHp;
        const green = Math.floor(50 + 150 * hpRatio); // gets brighter
        const blue = Math.floor(50 + 150 * hpRatio);
        enemy.use(k.color(255, green, blue));
        return;
      }

      k.destroy(enemy);
      score++;
      scoreLabel.text = `Score: ${score}`;
    });
  }
  // this will spawn a new enemy every second
  k.loop(1, () => {
    makeEnemy();
  });
});

k.scene("gameover", () => {
  k.add([
    k.text("GAME OVER"),
    k.anchor("center"),
    k.pos(k.width() / 2, k.height() / 2 - 100),
  ]);
  k.add([
    k.text("Final score: " + score),
    k.anchor("center"),
    k.pos(k.width() / 2, k.height() / 2 - 50),
  ]);
  k.add([
    k.text("Click to play again", { size: 24 }),
    k.anchor("center"),
    k.pos(k.width() / 2, k.height() / 2),
  ]);
  let canClick = false;

  // Enable click after 1.5 seconds
  k.wait(1.5, () => {
    canClick = true;
  });
  k.onClick(() => {
    if (!canClick) return; // ignore early clicks
    score = 0;
    k.go("game");
  });
});

k.go("game");
