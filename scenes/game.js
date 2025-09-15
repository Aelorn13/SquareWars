// scenes/game.js

import { createPlayer } from "../components/player/player.js";
import { spawnEnemy } from "../components/enemy/enemySpawner.js";
import { setupEnemyPlayerCollisions } from "../components/enemy/enemyBehavior.js";
import { setupBossBehaviors } from "../components/enemy/boss/bossSetup.js";
import { createScoreLabel, updateScoreLabel, drawHealthBar, drawDashCooldownBar, createTimerLabel, updateTimerLabel, createPauseLabel, createBossHealthBar, } from "../components/ui/index.js";
import { setupPlayerShooting } from "../components/player/shooting.js";
import { applyPowerUp } from "../components/powerup/applyPowerup.js";
import { keysPressed } from "../components/player/controls.js";
import { maybeShowUpgrade } from "../components/upgrade/applyUpgrade.js";
import { summonMinions, spreadShot, chargeAttack } from "../components/enemy/boss/bossAbilities.js";

const MINIMAL_SPAWN_INTERVAL = 0.2;
const BOSS_SPAWN_TIME = 100;

// NEW: The function now accepts the 'isMobile' flag passed from main.js
export function defineGameScene(k, scoreRef, isMobile) {
  k.scene("game", () => {
    // --- Game Arena Setup ---
    const ARENA_MARGIN = Math.floor(Math.min(k.width(), k.height()) * 0.05);
    const ARENA = { x: ARENA_MARGIN, y: ARENA_MARGIN, w: k.width() - ARENA_MARGIN * 2, h: k.height() - ARENA_MARGIN * 2 };
    k.add([ k.rect(ARENA.w, ARENA.h), k.pos(ARENA.x, ARENA.y), k.color(20, 20, 20), k.outline(2, k.rgb(80, 80, 80)), k.fixed(), k.z(-50), "gameArena" ]);

    // --- Game State & Context ---
    const gameState = { isPaused: false, isUpgradePanelOpen: false, area: ARENA, spawnProgress: 0, elapsedTime: 0 };
    // NEW: Pass the 'isMobile' flag to the player creator
    const player = createPlayer(k, gameState, isMobile);
    let currentScore = 0;
    const nextUpgradeScoreThresholdRef = { value: 10 };

    const addScore = (amount) => {
      currentScore += amount;
      updateScoreLabel(scoreLabel, currentScore, nextUpgradeScoreThresholdRef.value);
      maybeShowUpgrade(k, player, gameState, currentScore, nextUpgradeScoreThresholdRef, addScore);
    };

    scoreRef.value = () => currentScore;
    // NEW: Pass the 'isMobile' flag to the shooting setup
    setupPlayerShooting(k, player, gameState, isMobile);

    const gameContext = { sharedState: gameState, increaseScore: addScore, updateHealthBar: () => drawHealthBar(k, player.hp()) };
    setupEnemyPlayerCollisions(k, gameContext);
    setupBossBehaviors(k, gameContext);

    // --- UI Elements ---
    let scoreLabel, healthBar, dashCooldownBar;
    const pauseLabel = createPauseLabel(k); // This is the central "PAUSED" text
    const timerLabel = createTimerLabel(k, BOSS_SPAWN_TIME);

    // NEW: Conditionally position UI elements based on platform
    if (isMobile) {
        // Mobile: Stack UI elements vertically on the right side
        scoreLabel = createScoreLabel(k, k.vec2(k.width() - 20, 20), "topright");
        healthBar = drawHealthBar(k, player.hp(), k.vec2(k.width() - 20, 60), "topright");
        dashCooldownBar = drawDashCooldownBar(k, k.vec2(k.width() - 20, 100), "topright");

        // NEW: Create a visible, tappable pause button for mobile
        const pauseButton = k.add([
            k.text("||", { size: 48 }),
            k.pos(40, 40),
            k.fixed(),
            k.area(),
            k.anchor("center"),
            "pause-button"
        ]);
        
        pauseButton.onClick(() => {
            gameState.isPaused = !gameState.isPaused;
            pauseLabel.hidden = !gameState.isPaused;
        });

    } else {
        // PC: Default layout (assuming top-left for score/health, bottom-left for dash)
        scoreLabel = createScoreLabel(k);
        healthBar = drawHealthBar(k, player.hp());
        dashCooldownBar = drawDashCooldownBar(k);
    }

    // --- Game Loop Variables ---
    const initialEnemySpawnInterval = 2;
    let enemySpawnInterval = initialEnemySpawnInterval;
    let timeUntilNextSpawn = enemySpawnInterval;
    let isBossSpawned = false;
    let wasPauseKeyPreviouslyPressed = false;
    let currentBoss = null;
    let firstMinibossSpawned = false;
    let secondMinibossSpawned = false;
    let firstMinibossAbility = null;
    const availableMinibossAbilities = [summonMinions, spreadShot, chargeAttack];

    // --- Main Game Loop (onUpdate) ---
    k.onUpdate(() => {
      // --- Pause Handling (PC remains) ---
      if (!isMobile && keysPressed["KeyP"]) {
        if (!wasPauseKeyPreviouslyPressed) {
          gameState.isPaused = !gameState.isPaused;
          pauseLabel.hidden = !gameState.isPaused;
          wasPauseKeyPreviouslyPressed = true;
        }
      } else {
        wasPauseKeyPreviouslyPressed = false;
      }
      k.paused = gameState.isPaused || gameState.isUpgradePanelOpen;
      if (k.paused) return;
      
      gameState.elapsedTime += k.dt();
      
      // --- UI Updates ---
      // NEW: Check if dashCooldownBar exists before updating.
      if (dashCooldownBar) {
          dashCooldownBar.width = dashCooldownBar.fullWidth * player.getDashCooldownProgress();
      }
      updateTimerLabel(timerLabel, k.dt());
      
      // ... (Rest of the game loop is unchanged) ...
      if (!firstMinibossSpawned && gameState.elapsedTime >= BOSS_SPAWN_TIME / 3) {
        firstMinibossSpawned = true;
        firstMinibossAbility = k.choose(availableMinibossAbilities);
        spawnEnemy(k, player, gameContext, { forceType: "miniboss", ability: firstMinibossAbility });
      }
      if (!secondMinibossSpawned && gameState.elapsedTime >= (BOSS_SPAWN_TIME * 2) / 3) {
        secondMinibossSpawned = true;
        const remainingAbilities = availableMinibossAbilities.filter((ab) => ab.name !== firstMinibossAbility.name);
        const secondAbility = k.choose(remainingAbilities);
        const scaling = { hpMultiplier: 1.5, speedMultiplier: 1.1 };
        spawnEnemy(k, player, gameContext, { forceType: "miniboss", ability: secondAbility, scaling: scaling });
      }
      if (!isBossSpawned) {
        timeUntilNextSpawn -= k.dt();
        if (timeUntilNextSpawn <= 0) {
          if (gameState.elapsedTime >= BOSS_SPAWN_TIME) {
            isBossSpawned = true;
            spawnEnemy(k, player, gameContext, { forceType: "boss", progress: 1.0 }).then((bossEntity) => {
              currentBoss = bossEntity;
              if (currentBoss) createBossHealthBar(k, currentBoss);
            }).catch(console.error);
          } else {
            const timeProgress = Math.min(gameState.elapsedTime / BOSS_SPAWN_TIME, 1.0);
            const easedProgress = timeProgress * timeProgress;
            gameState.spawnProgress = easedProgress;
            const spawnIntervalRange = initialEnemySpawnInterval - MINIMAL_SPAWN_INTERVAL;
            enemySpawnInterval = initialEnemySpawnInterval - (spawnIntervalRange * easedProgress);
            spawnEnemy(k, player, gameContext, { progress: gameState.spawnProgress });
            timeUntilNextSpawn = enemySpawnInterval;
          }
        }
      }
    });

    player.onCollide("powerup", (powerUp) => {
      // NEW: Pass the updated health bar reference to the function
      applyPowerUp(k, player, powerUp.type, gameContext, () => drawHealthBar(k, player.hp(), healthBar.pos, healthBar.anchor));
      k.destroy(powerUp);
    });
  });
}