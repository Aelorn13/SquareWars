import { createPlayer } from "../components/player/player.js";
// UPDATED: Import the refactored functions
import {
  spawnEnemy,
  setupEnemyPlayerCollisions,
  enemyDeathLogic,
} from "../components/enemy/enemy.js";
import {
  createScoreLabel,
  updateScoreLabel,
  drawHealthBar,
  drawDashCooldownBar,
  createPauseLabel,
} from "../components/ui/index.js";
import { setupPlayerShooting } from "../components/player/shooting.js";
import { applyPowerUp } from "../components/powerup/applyPowerup.js";
import { spawnPowerUp } from "../components/powerup/spawnPowerup.js";
import { POWERUP_TYPES } from "../components/powerup/powerupTypes.js";
import { ENEMY_TYPES } from "../components/enemy/enemyTypes.js";
import { maybeShowUpgrade } from "../components/upgrade/applyUpgrade.js";
import { keysPressed } from "../components/player/controls.js";

/**
 * Defines the debug game scene.
 * @param {kaboomCtx} k - The Kaboom.js/kaplay context object.
 */
export function defineDebugScene(k) {
  k.scene("debug", () => {
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

    // --- Game State Management ---
    const gameState = {
      isPaused: false,
      upgradeOpen: false,
      area: ARENA,
      spawnProgress: 1, // Max difficulty in debug mode
    };

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

    // --- Player Setup ---
    const player = createPlayer(k, gameState);
    setupPlayerShooting(k, player, gameState);

    // --- UI Elements ---
    const scoreLabel = createScoreLabel(k);
    updateScoreLabel(
      scoreLabel,
      currentScore,
      nextUpgradeScoreThresholdRef.value
    );
    drawHealthBar(k, player.hp());
    const dashCooldownBar = drawDashCooldownBar(k);
    const pauseLabel = createPauseLabel(k);
    pauseLabel.hidden = true;

    // --- Game Context (NEW: Bundles state for cleaner function calls) ---
const gameContext = {
    sharedState: gameState,
    increaseScore: addScore,
    updateHealthBar: () => drawHealthBar(k, player.hp()),
    enemyDeathLogic, // ES6 shorthand for enemyDeathLogic: enemyDeathLogic
};


    // --- Global Collision Setup (NEW: Call the refactored function once) ---
    setupEnemyPlayerCollisions(k, gameContext);

    // --- Debug UI Panel ---
    const debugPanelWidth = 240;
    const debugPanelMargin = 10;
    const debugPanelX = k.width() - debugPanelWidth - debugPanelMargin;
    let currentPanelY = debugPanelMargin;
    let isDebugUIVisible = true;

    k.add([
      k.rect(debugPanelWidth + 20, k.height() - debugPanelMargin * 2),
      k.pos(debugPanelX - 10, debugPanelMargin),
      k.color(15, 15, 15, 0.8),
      k.outline(2, k.rgb(60, 60, 60)),
      k.fixed(),
      k.z(99),
      "debugUI",
    ]);

    const toggleUIButton = k.add([
      k.rect(debugPanelWidth, 30),
      k.pos(debugPanelX, currentPanelY),
      k.color(100, 100, 100),
      k.area(),
      k.fixed(),
      k.z(101),
    ]);
    const toggleUIText = toggleUIButton.add([
      k.text("Hide UI", { size: 14, font: "sans-serif" }),
      k.anchor("center"),
      k.pos(toggleUIButton.width / 2, toggleUIButton.height / 2),
      k.z(102),
    ]);
    toggleUIButton.onClick(() => {
      isDebugUIVisible = !isDebugUIVisible;
      k.get("debugUI", { recursive: true }).forEach((el) => {
        el.hidden = !isDebugUIVisible;
      });
      toggleUIText.text = isDebugUIVisible ? "Hide UI" : "Show UI";
    });
    currentPanelY += 40;

    // --- Power-Up Spawner ---
    const spawnAllDebugPowerUps = () => {
      const startX = ARENA.x + 50;
      const spawnY = ARENA.y + 50;
      const spacing = 40;
      let locIndex = 0;
      for (const typeKey in POWERUP_TYPES) {
        const type = POWERUP_TYPES[typeKey];
        const spawnPos = k.vec2(startX + locIndex * spacing, spawnY);
        const createAndMonitorPowerup = (pos, powerupType) => {
          const powerup = spawnPowerUp(k, pos, powerupType, gameState);
          powerup.onDestroy(() => {
            k.wait(10, () => createAndMonitorPowerup(pos, powerupType));
          });
        };
        createAndMonitorPowerup(spawnPos, type);
        locIndex++;
      }
    };
    spawnAllDebugPowerUps();

    // --- Enemy Spawner UI ---
    k.add([
      k.text("ENEMY SPAWN", { size: 16 }),
      k.pos(debugPanelX, currentPanelY),
      k.fixed(),
      k.z(101),
      "debugUI",
    ]);
    currentPanelY += 25;
    let selectedEnemyType = ENEMY_TYPES[0].name;
    const typeLabels = [];
    ENEMY_TYPES.forEach((enemy) => {
      const label = k.add([
        k.text(enemy.name.toUpperCase(), { size: 12 }),
        k.pos(debugPanelX + 5, currentPanelY),
        k.area(),
        k.fixed(),
        k.z(101),
        "debugUI",
        { typeName: enemy.name },
      ]);
      label.onClick(() => {
        if (gameState.isPaused || !isDebugUIVisible) return;
        selectedEnemyType = enemy.name;
        typeLabels.forEach(
          (l) =>
            (l.color =
              l.typeName === selectedEnemyType
                ? k.rgb(255, 255, 0)
                : k.rgb(200, 200, 200))
        );
      });
      typeLabels.push(label);
      currentPanelY += 20;
    });
    typeLabels.find((l) => l.typeName === selectedEnemyType).color = k.rgb(
      255,
      255,
      0
    );
    currentPanelY += 10;

    const spawnEnemyButton = k.add([
      k.rect(debugPanelWidth - 20, 30),
      k.pos(debugPanelX + 10, currentPanelY),
      k.color(60, 180, 60),
      k.area(),
      k.fixed(),
      k.z(101),
      "debugUI",
    ]);
    spawnEnemyButton.add([
      k.text("SPAWN ENEMY", { size: 14, font: "sans-serif" }),
      k.anchor("center"),
      k.pos(spawnEnemyButton.width / 2, spawnEnemyButton.height / 2),
      k.z(102),
    ]);

    // UPDATED: The onClick handler now uses the new spawnEnemy signature
    spawnEnemyButton.onClick(() => {
      if (gameState.isPaused || gameState.upgradeOpen || !isDebugUIVisible)
        return;

      spawnEnemy(k, player, gameContext, {
        forceType: selectedEnemyType,
        progress: gameState.spawnProgress,
        showTelegraph: false, // Spawn instantly for debug purposes
      });
    });
    currentPanelY += 50;

    // --- Score & Upgrade UI ---
    k.add([
      k.text("PLAYER STATS", { size: 16 }),
      k.pos(debugPanelX, currentPanelY),
      k.fixed(),
      k.z(101),
      "debugUI",
    ]);
    currentPanelY += 25;
    const addScoreButton = k.add([
      k.rect(debugPanelWidth - 20, 30),
      k.pos(debugPanelX + 10, currentPanelY),
      k.color(50, 150, 200),
      k.area(),
      k.fixed(),
      k.z(101),
      "debugUI",
    ]);
    addScoreButton.add([
      k.text("ADD 100 SCORE", { size: 14, font: "sans-serif" }),
      k.anchor("center"),
      k.pos(addScoreButton.width / 2, addScoreButton.height / 2),
      k.z(102),
    ]);
    addScoreButton.onClick(() => {
      if (gameState.isPaused || gameState.upgradeOpen || !isDebugUIVisible)
        return;
      addScore(100);
    });
    currentPanelY += 40;

    const forceUpgradeButton = k.add([
      k.rect(debugPanelWidth - 20, 30),
      k.pos(debugPanelX + 10, currentPanelY),
      k.color(200, 100, 50),
      k.area(),
      k.fixed(),
      k.z(101),
      "debugUI",
    ]);
    forceUpgradeButton.add([
      k.text("FORCE UPGRADE", { size: 14, font: "sans-serif" }),
      k.anchor("center"),
      k.pos(forceUpgradeButton.width / 2, forceUpgradeButton.height / 2),
      k.z(102),
    ]);
    forceUpgradeButton.onClick(() => {
      if (gameState.isPaused || gameState.upgradeOpen || !isDebugUIVisible)
        return;
      const scoreNeeded = nextUpgradeScoreThresholdRef.value - currentScore;
      addScore(Math.max(1, scoreNeeded));
    });

    // --- Main Game Loop ---
    let wasPauseKeyPreviouslyPressed = false;
    k.onUpdate(() => {
      if (keysPressed["KeyP"]) {
        if (!wasPauseKeyPreviouslyPressed && !gameState.upgradeOpen) {
          gameState.isPaused = !gameState.isPaused;
          pauseLabel.hidden = !gameState.isPaused;
          wasPauseKeyPreviouslyPressed = true;
        }
      } else {
        wasPauseKeyPreviouslyPressed = false;
      }
      if (gameState.isPaused || gameState.upgradeOpen) return;
      dashCooldownBar.width =
        dashCooldownBar.fullWidth * player.getDashCooldownProgress();
    });

    // --- Event Handlers ---
player.onCollide("powerup", (powerUp) => {
  // The onHeal callback is the LAST argument.
  applyPowerUp(k, player, powerUp.type, gameContext, () => {
    drawHealthBar(k, player.hp());
  });
  k.destroy(powerUp);
});

  });
}
