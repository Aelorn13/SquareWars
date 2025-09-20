// src/scenes/debug.js
import { createPlayer } from "../components/player/player.js";
import { setupEnemyPlayerCollisions } from "../components/enemy/enemyBehavior.js";
import { spawnEnemy } from "../components/enemy/enemySpawner.js";
import { setupBossBehaviors } from "../components/enemy/boss/bossSetup.js";

import {
  createScoreLabel,
  updateScoreLabel,
  drawHealthBar,
  drawDashCooldownBar,
  createPauseLabel,
  createBossHealthBar,
  createPlayerStatsUI,
  createTimerLabel,
  updateTimerLabel,
} from "../components/ui/index.js";
import { setupPlayerShooting } from "../components/player/shooting.js";
import { applyPowerUp } from "../components/powerup/applyPowerup.js";
import { ENEMY_CONFIGS } from "../components/enemy/enemyConfig.js";
import { maybeShowUpgrade } from "../components/upgrade/applyUpgrade.js";
import { keysPressed, isMobileDevice, registerMobileController } from "../components/player/controls.js";
import { makeMobileController } from "../components/player/mobile/index.js";
import { summonMinions, spreadShot, chargeAttack } from "../components/enemy/boss/bossAbilities.js";
import { makeSecretToggle } from "../components/utils/secretToggle.js";
import {
  createDebugToggleButton,
  spawnAllDebugPowerUps,
  createEnemySpawner,   
  createBossSpawner,    
} from "../components/ui/debug/index.js";

/**
 * Defines the debug game scene for testing game mechanics.
 */
export function defineDebugScene(k) {
  const BOSS_SPAWN_TIME = 100;

  k.scene("debug", () => {
    // mobile controller
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
      spawnProgress: 1,
      elapsedTime: 0,
    };

    const player = createPlayer(k, gameState);

    // create score label early so UI functions can safely update it
    const scoreLabel = createScoreLabel(k);
    let currentScore = 0;
    const nextUpgradeScoreThresholdRef = { value: 10 };

    // addScore updates both the visible label and the internal scoreboard used by some debug UIs
    const addScore = (amount) => {
      currentScore += amount;
      // keep a snapshot on the gameContext for legacy debug UI parity
      gameContext._currentScore = currentScore;
      gameContext.nextUpgradeScoreThreshold = nextUpgradeScoreThresholdRef.value;

      updateScoreLabel(scoreLabel, currentScore, nextUpgradeScoreThresholdRef.value);
      maybeShowUpgrade(
        k,
        player,
        gameState,
        currentScore,
        nextUpgradeScoreThresholdRef,
        addScore
      );
    };

    setupPlayerShooting(k, player, gameState);

    // include player reference in the context (consistent with game.js)
    const gameContext = {
      sharedState: gameState,
      player,
      increaseScore: addScore,
      updateHealthBar: () => drawHealthBar(k, player.hp()),
      // legacy debug UI parity fields (kept in-sync by addScore)
      _currentScore: currentScore,
      nextUpgradeScoreThreshold: nextUpgradeScoreThresholdRef.value,
    };

    setupEnemyPlayerCollisions(k, gameContext);
    setupBossBehaviors(k, gameContext);

    const checkSecretToggle = makeSecretToggle(k, "game", keysPressed);

    // --- UI Elements ---
    drawHealthBar(k, player.hp());
    const dashCooldownBar = drawDashCooldownBar(k);
    const pauseLabel = createPauseLabel(k);
    const timerLabel = createTimerLabel(k, BOSS_SPAWN_TIME);
    let statsUI = null;

    // --- Debug UI Panel ---
    const debugPanelWidth = 240;
    const debugPanelMargin = 10;
    const debugPanelX = k.width() - debugPanelWidth - debugPanelMargin;
    let currentPanelY = debugPanelMargin;
    let isDebugUIVisible = true;

    const debugUIBase = k.add([
      k.rect(debugPanelWidth + 20, k.height() - debugPanelMargin * 2),
      k.pos(debugPanelX - 10, debugPanelMargin),
      k.color(15, 15, 15, 0.8),
      k.outline(2, k.rgb(60, 60, 60)),
      k.fixed(),
      k.z(99),
    ]);

    // --- UI Toggle Button (from your debug index) ---
    createDebugToggleButton(k, {
      debugPanelX,
      y: currentPanelY,
      debugPanelWidth,
      debugUIBase,
      initialVisible: true,
      onToggle: (visible) => {
        isDebugUIVisible = visible;
      },
    });
    currentPanelY += 40;

    // --- Power-up Spawner (moved into debug UI bundle) ---
    spawnAllDebugPowerUps(k, ARENA, gameState);

    // --- Enemy Spawner UI (from debug bundle) ---
    const enemyUIResult = createEnemySpawner(k, debugPanelX, currentPanelY, {
      ENEMY_CONFIGS,
      spawnEnemy,
      player,
      gameContext,
      gameState,
      isDebugUIVisible: () => isDebugUIVisible,
      debugPanelWidth,
    });
    currentPanelY = enemyUIResult.currentPanelY;

    // --- Boss & Miniboss Spawner UI (from debug bundle) ---
    const bossUIResult = createBossSpawner(k, currentPanelY ? debugPanelX : debugPanelX, currentPanelY, {
      spawnEnemy,
      player,
      gameContext,
      summonMinions,
      spreadShot,
      chargeAttack,
      createBossHealthBar,
      gameState,
      isDebugUIVisible: () => isDebugUIVisible,
      debugPanelWidth,
    });
    currentPanelY = bossUIResult.currentPanelY;

    // --- Main Game Loop ---
    let wasPauseKeyPreviouslyPressed = false;
    k.onUpdate(() => {
      checkSecretToggle();

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

      // keep tracking elapsed time (useful if you extend debug to timed events)
      gameState.elapsedTime += k.dt();

      // Update UI elements (dash cooldown + timer)
      if (dashCooldownBar && typeof dashCooldownBar.fullWidth === "number") {
        dashCooldownBar.width = dashCooldownBar.fullWidth * player.getDashCooldownProgress();
      }
      updateTimerLabel(timerLabel, k.dt());
    });

    // --- Event Handlers ---
    player.onCollide("powerup", (powerUp) => {
      applyPowerUp(k, player, powerUp.type, gameContext, () => drawHealthBar(k, player.hp()));
      k.destroy(powerUp);
    });
  });
}
