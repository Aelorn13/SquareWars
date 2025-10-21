// game.js
import { createPlayer } from "../components/player/player.js";
import { spawnEnemy } from "../components/enemy/enemySpawner.js";
import { setupEnemyPlayerCollisions } from "../components/enemy/enemyBehavior.js";
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
  showVictoryPrompt,
  getPlayerStatsSnapshot,
} from "../components/ui/index.js";
import { setupPlayerShooting } from "../components/player/shooting.js";
import { applyPowerUp } from "../components/powerup/applyPowerup.js";
import { inputState, keysPressed,updateMobileUIMode  } from "../components/player/controls.js";
import { maybeShowUpgrade } from "../components/upgrade/applyUpgrade.js";
import { summonMinions, spreadShot, chargeAttack } from "../components/enemy/boss/bossAbilities.js";
import { isMobileDevice, registerMobileController, unregisterMobileController } from "../components/player/controls.js";
import { makeMobileController } from "../components/player/mobile/index.js";
import { makeSecretToggle } from "../components/utils/secretToggle.js";
import { toggleAutoShoot, autoShootTick } from "../components/player/autoShoot.js";
import { createDpsHud } from "../components/utils/dpsHud.js";
import { setupEnemyMerging } from "../components/enemy/enemyMerger.js";
import { getSelectedDifficultyConfig } from "../components/utils/difficultyManager.js";
import { DifficultyController } from "../components/utils/difficultyController.js";
import { createEncounterManager } from "../components/encounter/encounterManager.js";

export function defineGameScene(k, scoreRef) {
  function spawnMiniboss(gameContext, ability, scaling, spawnTime) {
    const maybePromise = spawnEnemy(k, gameContext.player, gameContext, {
      forceType: "miniboss",
      ability,
      scaling,
      progress: gameContext.sharedState.spawnProgress,
      difficulty: gameContext.difficulty,
    });

    if (maybePromise && typeof maybePromise.then === "function") {
      maybePromise
        .then((miniboss) => {
          console.log("[game.js] Miniboss promise resolved. entity:", miniboss);
        })
        .catch((err) => {
          console.error("[game.js] Miniboss spawn promise rejected:", err);
        });
    } else if (maybePromise) {
      console.log("[game.js] Miniboss spawned immediately:", maybePromise);
    }

    return maybePromise;
  }

  k.scene("game", () => {
    let mobileControllerIsRegistered = false;
    if (isMobileDevice()) {
      registerMobileController(() => makeMobileController(k));
      mobileControllerIsRegistered = true;
    }

    const GamePhase = {
      PRE_BOSS: "PRE_BOSS",
      BOSS_FIGHT: "BOSS_FIGHT",
      VICTORY_PROMPT: "VICTORY_PROMPT",
      ENDLESS: "ENDLESS",
    };

    // --- Difficulty Setup ---
    const difficultyConfig = getSelectedDifficultyConfig();
    const difficulty = new DifficultyController(difficultyConfig);
    const BOSS_SPAWN_TIME = difficulty.getBossSpawnTime();

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
      upgradeOpen: false,
      area: ARENA,
      spawnProgress: 0,
      elapsedTime: 0,
    };
    const player = createPlayer(k, gameState);
    let currentScore = 0;
    const nextUpgradeScoreThresholdRef = { value: 10 };
    //specific easy case
    if (difficulty.config.name == "Easy") {
      player.heal(3);
    }
    const addScore = (amount) => {
      currentScore += amount;
      updateScoreLabel(scoreLabel, currentScore, nextUpgradeScoreThresholdRef.value);
      maybeShowUpgrade(k, player, gameState, currentScore, nextUpgradeScoreThresholdRef, addScore, isMobileDevice);
    };

    scoreRef.value = () => currentScore;
    setupPlayerShooting(k, player, gameState);

    const gameContext = {
      sharedState: gameState,
      player,
      increaseScore: addScore,
      updateHealthBar: () => drawHealthBar(k, player.hp()),
      difficulty: difficulty,
      getCurrentGamePhase: () => currentGamePhase,
    };
    setupEnemyPlayerCollisions(k, gameContext);
    setupEnemyMerging(k, gameContext);

    // --- UI Elements ---
    const scoreLabel = createScoreLabel(k);
    drawHealthBar(k, player.hp());
    const dashCooldownBar = drawDashCooldownBar(k);
    const pauseLabel = createPauseLabel(k);
    const timerLabel = createTimerLabel(k, BOSS_SPAWN_TIME);
    let statsUI = null;

    // --- Game Loop Variables ---
    let timeUntilNextSpawn = difficulty.getSpawnInterval(0);
    let isBossSpawned = false;
    let wasPauseKeyPreviouslyPressed = false;
    let currentBoss = null;
    let wasAutoTogglePreviouslyPressed = false;
    let currentGamePhase = GamePhase.PRE_BOSS;
    let endlessStartTime = 0;

    // --- Encounter State ---
    const encounterManager = createEncounterManager(k, gameContext);

    const dpsHud = createDpsHud(k, player, gameState, {
      initialSpawnInterval: difficulty.config.spawnInterval.start,
      minimalSpawnInterval: difficulty.config.spawnInterval.end,
      labelPos: { x: 200, y: 14 },
      fontSize: 12,
      updateInterval: 2,
      safetyFactor: 1.2,
    });

    // Debug things
    const checkSecretToggle = makeSecretToggle(k, "debug", keysPressed);

    // Miniboss things
    const minibossSchedule = [
      {
        time: BOSS_SPAWN_TIME / 2,
        scaling: { hpMultiplier: 1, speedMultiplier: 1 },
      },
    ];

    let minibossesSpawned = 0;
    let usedAbilities = [];

    // --- Helper functions for each game state ---
    function handleEnemySpawning(progress) {
      timeUntilNextSpawn -= k.dt();
      if (timeUntilNextSpawn <= 0) {
        gameState.spawnProgress = progress;
        spawnEnemy(k, player, gameContext, { progress, difficulty });
        timeUntilNextSpawn = difficulty.getSpawnInterval(progress);
      }
    }

    function runPreBossLogic() {
      const progress = Math.min(gameState.elapsedTime / BOSS_SPAWN_TIME, 1.0);
      handleEnemySpawning(progress);

      // Check for transition to the boss fight
      if (gameState.elapsedTime >= BOSS_SPAWN_TIME) {
        currentGamePhase = GamePhase.BOSS_FIGHT;
        spawnTheBoss();
      }
    }

    function runBossFightLogic() {
      // While in this state, we simply wait for the boss to be destroyed
      if (currentBoss && !currentBoss.exists()) {
        currentGamePhase = GamePhase.VICTORY_PROMPT;
        gameState.isPaused = true;

        const snapshot = getPlayerStatsSnapshot(player);

        showVictoryPrompt(k, {
          onContinue: startEndlessMode,
          onEnd: () => k.go("victory", { statsSnapshot: snapshot }),
        });
      }
    }

    function runEndlessLogic() {
      const timeSinceEndless = gameState.elapsedTime - endlessStartTime;
      const progress = 1.0 + timeSinceEndless / BOSS_SPAWN_TIME;
      handleEnemySpawning(progress);
    }

    function startEndlessMode() {
      console.log("Player chose to continue! Starting Endless Mode.");
      endlessStartTime = gameState.elapsedTime;
      currentGamePhase = GamePhase.ENDLESS;
      gameState.isPaused = false;

      // Give the player a reward
      player.heal(3);
      gameContext.updateHealthBar();
    }

    function spawnTheBoss() {
      isBossSpawned = true;
      timerLabel.destroy();
      const bossSpawnPromise = spawnEnemy(k, player, gameContext, {
        forceType: "boss",
        progress: 1.0,
        difficulty: difficulty,
      });

      if (bossSpawnPromise && typeof bossSpawnPromise.then === "function") {
        bossSpawnPromise
          .then((bossEntity) => {
            console.log("[game.js] Boss promise resolved. bossEntity is:", bossEntity);
            currentBoss = bossEntity;
            if (currentBoss && currentBoss.exists()) {
              createBossHealthBar(k, currentBoss);

              // Listen for boss death
              currentBoss.onDestroy(() => {
                console.log("[game.js] Boss destroyed!");
              });
            } else {
              console.error("[game.js] Boss entity is NULL or was destroyed before the health bar could be created!");
            }
          })
          .catch((err) => {
            console.error("[game.js] The boss spawn promise was REJECTED. Error:", err);
          });
      } else {
        console.error("[game.js] spawnEnemy did NOT return a promise for the boss!");
      }
    }

    // --- Main Game Loop (onUpdate) ---
    k.onUpdate(() => {
      checkSecretToggle();
      if (isMobileDevice()) {
        const shouldBeRegistered = !gameState.isPaused && !gameState.upgradeOpen;

        if (shouldBeRegistered && !mobileControllerIsRegistered) {
          registerMobileController(() => makeMobileController(k));
          mobileControllerIsRegistered = true;
        } else if (!shouldBeRegistered && mobileControllerIsRegistered) {
          unregisterMobileController();
          mobileControllerIsRegistered = false;
        }
      }

      // --- Pause Handling ---
      if (keysPressed["KeyP"] && !gameState.upgradeOpen) {
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

      const autoToggleActive = !!inputState.autoShoot || !!keysPressed["KeyR"];
      if (autoToggleActive) {
        if (!wasAutoTogglePreviouslyPressed) {
          const isNowActive = toggleAutoShoot(player, { range: 9999 });
          updateMobileUIMode(isNowActive);
        }
        wasAutoTogglePreviouslyPressed = true;
      } else {
        wasAutoTogglePreviouslyPressed = false;
      }

      dpsHud.update(k.dt(), keysPressed, gameState.isPaused || gameState.upgradeOpen);
      autoShootTick(k, player, gameState);

      if (gameState.isPaused || gameState.upgradeOpen) {
        return;
      }

      gameState.elapsedTime += k.dt();

      // --- UI Updates ---
      dashCooldownBar.width = dashCooldownBar.fullWidth * player.getDashCooldownProgress();
      updateTimerLabel(timerLabel, k.dt());

      encounterManager.update(k.dt());
      // --- State Machine ---
      switch (currentGamePhase) {
        case GamePhase.PRE_BOSS:
          runPreBossLogic();
          break;
        case GamePhase.BOSS_FIGHT:
          runBossFightLogic();
          break;
        case GamePhase.VICTORY_PROMPT:
          // Game is effectively paused by the prompt UI
          break;
        case GamePhase.ENDLESS:
          runEndlessLogic();
          break;
      }

      // Miniboss spawning (independent of main state for now)
      if (currentGamePhase !== GamePhase.BOSS_FIGHT && currentGamePhase !== GamePhase.VICTORY_PROMPT) {
        if (minibossesSpawned < minibossSchedule.length) {
          const schedule = minibossSchedule[minibossesSpawned];
          if (gameState.elapsedTime >= schedule.time) {
            const availableAbilities = [summonMinions, spreadShot, chargeAttack].filter(
              (a) => !usedAbilities.includes(a.name)
            );

            const ability = k.choose(
              availableAbilities.length ? availableAbilities : [summonMinions, spreadShot, chargeAttack]
            );
            usedAbilities.push(ability.name);

            spawnMiniboss(gameContext, ability, schedule.scaling, schedule.time);
            minibossesSpawned++;
          }
        }
      }
    });

    // --- Event Handlers ---
    player.onCollide("powerup", (powerUp) => {
      applyPowerUp(k, player, powerUp.type, gameContext, () => drawHealthBar(k, player.hp()));
      k.destroy(powerUp);
    });
  });
}
