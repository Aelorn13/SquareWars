//game.js
import { createPlayer } from "../components/player/player.js";
import { spawnEnemy } from "../components/enemy/enemySpawner.js";
import { setupEnemyPlayerCollisions } from "../components/enemy/enemyBehavior.js";
import { setupBossBehaviors } from "../components/enemy/boss/bossSetup.js";
import {
  createPlayerStatsUI,
  createScoreLabel,
  updateScoreLabel,
  drawHealthBar,
  drawDashCooldownBar,
  createTimerLabel,
  updateTimerLabel,
  createPauseLabel,
  createBossHealthBar,
} from "../components/ui/index.js";
import { setupPlayerShooting } from "../components/player/shooting.js";
import { applyPowerUp } from "../components/powerup/applyPowerup.js";
import { keysPressed } from "../components/player/controls.js";
import { maybeShowUpgrade } from "../components/upgrade/applyUpgrade.js";
import {
  summonMinions,
  spreadShot,
  chargeAttack,
} from "../components/enemy/boss/bossAbilities.js";
import {
  isMobileDevice,
  registerMobileController,
} from "../components/player/controls.js";
import { makeMobileController } from "../components/player/mobile/index.js";
import { makeSecretToggle } from "../components/utils/secretToggle.js";
import { EFFECT_HANDLERS } from "../components/effects/effectRegistry.js";
// import { registerVisualEffects } from "../components/effects/visualEffects.js";
const MINIMAL_SPAWN_INTERVAL = 0.2;
const BOSS_SPAWN_TIME = 100;


export function defineGameScene(k, scoreRef) {
  function spawnMiniboss(gameContext, ability, scaling, spawnTime) {
  console.log(
    `Spawning miniboss at ${spawnTime} with ability: ${ability.name}`
  );
  return spawnEnemy(k, gameContext.player, gameContext, {
    forceType: "miniboss",
    ability,
    scaling,
  });
}
  k.scene("game", () => {
        // registerVisualEffects(EFFECT_HANDLERS, k);

    if (isMobileDevice()) {
      registerMobileController(() => makeMobileController(k));
    }

    // --- Game Arena Setup ---
    const ARENA_MARGIN = Math.floor(Math.min(k.width(), k.height()) * 0.05);
    const ARENA = {
      x: ARENA_MARGIN,
      y: ARENA_MARGIN,
      w: k.width() - ARENA_MARGIN * 2,
      h: k.height() - ARENA_MARGIN * 2,
    };
    k.add([
      k.rect(ARENA.w, ARENA.h),
      k.pos(ARENA.x, ARENA.y),
      k.color(20, 20, 20),
      k.outline(2, k.rgb(80, 80, 80)),
      k.fixed(),
      k.z(-50),
      "gameArena",
    ]);

    // --- Game State & Context ---
    const gameState = {
      isPaused: false,
      isUpgradePanelOpen: false,
      area: ARENA,
      spawnProgress: 0,
      elapsedTime: 0,
    };
    const player = createPlayer(k, gameState);
    let currentScore = 0;
    const nextUpgradeScoreThresholdRef = { value: 10 };

    const addScore = (amount) => {
      currentScore += amount;
      updateScoreLabel(
        scoreLabel,
        currentScore,
        nextUpgradeScoreThresholdRef.value
      );
      maybeShowUpgrade(
        k,
        player,
        gameState,
        currentScore,
        nextUpgradeScoreThresholdRef,
        addScore
      );
    };

    scoreRef.value = () => currentScore;
    setupPlayerShooting(k, player, gameState);

    const gameContext = {
      sharedState: gameState,
      player,
      increaseScore: addScore,
      updateHealthBar: () => drawHealthBar(k, player.hp()),
    };
    setupEnemyPlayerCollisions(k, gameContext);
    setupBossBehaviors(k, gameContext);
    
    // --- UI Elements ---
    const scoreLabel = createScoreLabel(k);
    drawHealthBar(k, player.hp());
    const dashCooldownBar = drawDashCooldownBar(k);
    const pauseLabel = createPauseLabel(k);
    const timerLabel = createTimerLabel(k, BOSS_SPAWN_TIME);
    let statsUI = null;

    // --- Game Loop Variables ---
    const initialEnemySpawnInterval = 2;
    let enemySpawnInterval = initialEnemySpawnInterval;
    let timeUntilNextSpawn = enemySpawnInterval;
    let isBossSpawned = false;
    let wasPauseKeyPreviouslyPressed = false;
    let currentBoss = null;

    //debug things
    const checkSecretToggle = makeSecretToggle(k, "debug", keysPressed);

    //miniboss things
    const minibossSchedule = [
      {
        time: BOSS_SPAWN_TIME / 2,
        scaling: { hpMultiplier: 1, speedMultiplier: 1 },
      },
      // {
      //   time: (BOSS_SPAWN_TIME * 3) / 4,
      //   scaling: { hpMultiplier: 1.5, speedMultiplier: 1.1 },
      // },
    ];

    let minibossesSpawned = 0;
    let usedAbilities = [];

    // --- Main Game Loop (onUpdate) ---
    k.onUpdate(() => {
      checkSecretToggle();

      // --- Pause Handling ---
      if (keysPressed["KeyP"]) {
        if (!wasPauseKeyPreviouslyPressed) {
          gameState.isPaused = !gameState.isPaused;
          pauseLabel.hidden = !gameState.isPaused;
          wasPauseKeyPreviouslyPressed = true;
          if (gameState.isPaused) {
            statsUI = createPlayerStatsUI(k, player, {
              x: 14,
              y: 14,
              width: 280,
              size: 16,
            });
          } else {
            statsUI?.destroy();
            statsUI = null;
          }
        }
      } else {
        wasPauseKeyPreviouslyPressed = false;
      }
      k.paused = gameState.isPaused || gameState.isUpgradePanelOpen;

      if (k.paused) return;

      gameState.elapsedTime += k.dt();

      // --- UI Updates ---
      dashCooldownBar.width =
        dashCooldownBar.fullWidth * player.getDashCooldownProgress();
      updateTimerLabel(timerLabel, k.dt());

      if (minibossesSpawned < minibossSchedule.length) {
        const schedule = minibossSchedule[minibossesSpawned];
        if (gameState.elapsedTime >= schedule.time) {
          const availableAbilities = [
            summonMinions,
            spreadShot,
            chargeAttack,
          ].filter((a) => !usedAbilities.includes(a.name));

          const ability = k.choose(
            availableAbilities.length
              ? availableAbilities
              : [summonMinions, spreadShot, chargeAttack]
          );
          usedAbilities.push(ability.name);

          spawnMiniboss(gameContext, ability, schedule.scaling, schedule.time);
          minibossesSpawned++;
        }
      }

      if (!isBossSpawned) {
        // This calculation was removed as it's not needed for the new time-based logic
        // and was causing confusion. spawnProgress is now calculated inside the spawn block.

        // --- Enemy Spawning Countdown ---
        timeUntilNextSpawn -= k.dt();
        if (timeUntilNextSpawn <= 0) {
          if (gameState.elapsedTime >= BOSS_SPAWN_TIME) {
            isBossSpawned = true;

            const bossSpawnPromise = spawnEnemy(k, player, gameContext, {
              forceType: "boss",
              progress: 1.0,
            });

            if (
              bossSpawnPromise &&
              typeof bossSpawnPromise.then === "function"
            ) {
              bossSpawnPromise
                .then((bossEntity) => {
                  currentBoss = bossEntity;
                  if (currentBoss) {
                    createBossHealthBar(k, currentBoss);
                  }
                })
                .catch(console.error);
            }
          } else {
            // Calculate progress based on the (now correctly updated) elapsed time
            const timeProgress = Math.min(
              gameState.elapsedTime / BOSS_SPAWN_TIME,
              1.0
            );
            const easedProgress = timeProgress * timeProgress;
            gameState.spawnProgress = easedProgress;

            const spawnIntervalRange =
              initialEnemySpawnInterval - MINIMAL_SPAWN_INTERVAL;
            enemySpawnInterval =
              initialEnemySpawnInterval - spawnIntervalRange * easedProgress;

            spawnEnemy(k, player, gameContext, {
              progress: gameState.spawnProgress,
            });

            timeUntilNextSpawn = enemySpawnInterval;
          }
        }
      }
    });

    // --- Event Handlers ---
    player.onCollide("powerup", (powerUp) => {
      applyPowerUp(k, player, powerUp.type, gameContext, () =>
        drawHealthBar(k, player.hp())
      );
      k.destroy(powerUp);
    });
  });
}
