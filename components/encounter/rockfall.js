// ===== components/encounter/rockfall.js =====

import { showEncounterFeedback } from "./circle.js";

export const rockfallEncounter = {
  name: "Rockfall",
  isFinished: true,

  start(k, gameContext) {
    this.isFinished = false;
    const { player, sharedState: gameState, increaseScore } = gameContext;

    // --- Configuration ---
    const GRAVITY = 1800;
    const ENCOUNTER_DURATION = 12;
    const SPAWN_INTERVAL = 0.42;
    const ROCK_DAMAGE = 1;
    const KNOCKBACK_MULTIPLIER = 3500;
    const BASE_SCORE_REWARD = 10;
    const TIME_SCORE_MODIFIER = 0.15;

    let encounterFinished = false;
    let mainController = null;

    // --- Announce the Encounter ---
    k.shake(12);
    k.add([
      k.text("ROCKFALL", { size: 64, width: k.width() - 100, align: "center" }),
      k.pos(k.center().x, k.height() * 0.3),
      k.anchor("center"),
      k.color(180, 50, 50),
      k.opacity(1),
      k.lifespan(1.5, { fade: 0.5 }),
      k.z(500),
    ]);

    const endEncounter = () => {
      if (encounterFinished) return;
      encounterFinished = true;
      this.isFinished = true;

      if (mainController) k.destroy(mainController);
      k.get("rock").forEach((rock) => k.destroy(rock));

      const timeBonus = Math.floor(gameState.elapsedTime * TIME_SCORE_MODIFIER);
      const totalReward = BASE_SCORE_REWARD + timeBonus;
      increaseScore(totalReward);
      this.encounterResult = { scoreAwarded: totalReward };
      
      showEncounterFeedback(
        k,
        player.pos.add(0, -60),
        `Survived! +${totalReward} Score`,
        k.rgb(255, 215, 0)
      );
    };
    
    // --- Rock Spawner Loop ---
    const rockSpawner = k.loop(SPAWN_INTERVAL, () => {
      if (gameState.isPaused || gameState.upgradeOpen) return;

      const spawnX = k.rand(gameState.area.x, gameState.area.x + gameState.area.w);
      const spawnY = gameState.area.y - 30;
      const size = k.rand(30, 65);
      const shape = k.rand() > 0.5 ? k.rect(size, size) : k.rect(size * 1.5, size * 0.7);

      k.add([
        k.pos(spawnX, spawnY), shape, k.anchor("center"),
        k.color(100, 100, 110), k.outline(2, k.rgb(50, 50, 55)),
        k.area(), k.rotate(k.rand(0, 360)), "rock",
        {
          rockDamage: ROCK_DAMAGE,
          vel: k.vec2(k.rand(-80, 80), 0),
          rotationSpeed: k.rand(-270, 270),
        },
      ]);
    });

    // --- Manual Physics and Movement for ALL rocks ---
    k.onUpdate("rock", (rock) => {
      if (gameState.isPaused || gameState.upgradeOpen) return;
      rock.vel.y += GRAVITY * k.dt();
      rock.angle += rock.rotationSpeed * k.dt();
      rock.move(rock.vel.scale(k.dt()));
      
      if (rock.pos.y > gameState.area.y + gameState.area.h + 200) {
        k.destroy(rock);
      }
    });

    // --- Collision Handlers ---
    k.onCollide("rock", "player", (rock, player) => {
      if (player.isInvincible) return;
      player.takeDamage(rock.rockDamage);
      k.destroy(rock);
    });

    k.onCollide("rock", "projectile", (rock, proj) => {
      const direction = rock.pos.sub(proj.pos).unit();
      direction.y = Math.min(direction.y, -0.2);
      const finalDir = direction.unit();
      const force = (proj.damage ?? 1) * KNOCKBACK_MULTIPLIER;
      rock.vel = rock.vel.add(finalDir.scale(force));
      k.destroy(proj);
    });

    // --- Encounter State Controller ---
    mainController = k.add([
      {
        phase: 'spawning',
        timeLeft: ENCOUNTER_DURATION,
        update() {
          if (gameState.isPaused || gameState.upgradeOpen) return;
          
          if (this.phase === 'spawning') {
            this.timeLeft -= k.dt();
            if (this.timeLeft <= 0) {
              rockSpawner.cancel();
              this.phase = 'clearing';
            }
          } else if (this.phase === 'clearing') {
            const rocks = k.get("rock");
            const arenaBottom = gameState.area.y + gameState.area.h;
            const anyRockStillOnScreen = rocks.some(rock => rock.pos.y < arenaBottom);

            if (!anyRockStillOnScreen) {
              endEncounter();
            }
          }
        },
      },
    ]);
  },
};