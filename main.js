import kaplay from "https://unpkg.com/kaplay@3001.0.19/dist/kaplay.mjs";

const k = kaplay({
  height: 720,
  width:720,
  letterBox: true,
  debug: true, //change to false later
  global: false,
  background: [100, 100, 200],
  touchToMouse: true,
  debugKey: "f4",
});


k.scene("game", () => {
  k.SetCamScale=1.5;
  const player = k.add([
    k.rect(32, 32), 
    k.anchor("center"),
    k.pos(360,360),
    k.color(0, 0, 255),
    k.rotate(0),
    k.area(),
    k.health(3),

    "player",
    {
      speed: 120
    }
  ]);
  player.add([
    k.rect(25, 8),
    k.pos(0, -4),
    k.color(255, 255, 0),

  ]);

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
  });

  k.onClick(() => {
    k.add([
      k.rect(10, 10, { radius: 6 }),
      k.pos(player.pos),
      k.area(),
      k.anchor("center"),
      k.offscreen({
        destroy: true,
      }), 
      k.rotate(player.angle),
      k.move(k.mousePos().sub(player.pos).unit(), 1200),
      "bullet",
    ]);
})

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
  ]);

  enemy.rotateTo(player.pos.angle(enemy.pos));
  
  enemy.onUpdate(() => {
    enemy.moveTo(player.pos, 100);
  });
  enemy.onCollide("player", (player) => {
    player.hurt(1);
    k.destroy(enemy);
    k.shake(10);
    if (player.hp() === 0) {
      k.go("gameover");
    }
  });

  enemy.onCollide("bullet", (bullet) => {
    k.destroy(bullet);
    if (enemy.hp() > 0) {
      enemy.hurt();
      enemy.use(k.color(200, 0, 0));
      k.wait(0.2, () => enemy.unuse("color"));

      return;
    }
    k.destroy(enemy);
  });
}
// this will spawn a new enemy every second
k.loop(1, () => {
makeEnemy();
});

})

k.scene("gameover", () => {
  k.add([
    k.text("GAME OVER"),
    k.anchor("center"),
    k.pos(360,360),
  ])
  k.onClick(() => k.go("game"));
});


k.go("game");