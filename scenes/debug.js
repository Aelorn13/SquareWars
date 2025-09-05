import { createPlayer } from "../components/player/player.js";
import { setupEnemyPlayerCollisions } from "../components/enemy/enemyBehavior.js";
import { spawnEnemy } from "../components/enemy/enemySpawner.js";
// --- CHANGE: Added createBossHealthBar to the imports ---
import { createScoreLabel, updateScoreLabel, drawHealthBar, drawDashCooldownBar, createPauseLabel, createBossHealthBar, } from "../components/ui/index.js";
import { setupPlayerShooting } from "../components/player/shooting.js";
import { applyPowerUp } from "../components/powerup/applyPowerup.js";
import { spawnPowerUp } from "../components/powerup/spawnPowerup.js";
import { POWERUP_TYPES } from "../components/powerup/powerupTypes.js";
import { ENEMY_CONFIGS } from "../components/enemy/enemyConfig.js";
import { maybeShowUpgrade } from "../components/upgrade/applyUpgrade.js";
import { keysPressed } from "../components/player/controls.js";

/**
 * Defines the debug game scene.
 * @param {kaboomCtx} k - The Kaboom.js context object.
 */
export function defineDebugScene(k) {
  k.scene("debug", () => {
    // --- Game Arena Setup ---
    const ARENA_MARGIN = Math.floor(Math.min(k.width(), k.height()) * 0.05);
    const ARENA = { x: ARENA_MARGIN, y: ARENA_MARGIN, w: k.width() - ARENA_MARGIN * 2, h: k.height() - ARENA_MARGIN * 2 };
    k.add([ k.rect(ARENA.w, ARENA.h), k.pos(ARENA.x, ARENA.y), k.color(20, 20, 20), k.outline(2, k.rgb(80, 80, 80)), k.fixed(), k.z(-50), "gameArena" ]);

    // --- Game State Management ---
    const gameState = {
      isPaused: false,
      isUpgradePanelOpen: false,
      area: ARENA,
      spawnProgress: 1, // Max difficulty in debug mode
    };

    let currentScore = 0;
    const nextUpgradeScoreThresholdRef = { value: 10 };

    const addScore = (amount) => {
      currentScore += amount;
      updateScoreLabel(scoreLabel, currentScore, nextUpgradeScoreThresholdRef.value);
      maybeShowUpgrade(k, player, gameState, currentScore, nextUpgradeScoreThresholdRef, addScore);
    };

    // --- Player Setup ---
    const player = createPlayer(k, gameState);
    setupPlayerShooting(k, player, gameState);

    // --- UI Elements ---
    const scoreLabel = createScoreLabel(k);
    updateScoreLabel(scoreLabel, currentScore, nextUpgradeScoreThresholdRef.value);
    drawHealthBar(k, player.hp());
    const dashCooldownBar = drawDashCooldownBar(k);
    const pauseLabel = createPauseLabel(k);
    pauseLabel.hidden = true;

    const gameContext = {
        sharedState: gameState,
        increaseScore: addScore,
        updateHealthBar: () => drawHealthBar(k, player.hp()),
    };

    // --- Global Collision Setup ---
    setupEnemyPlayerCollisions(k, gameContext);

    // --- Debug UI Panel ---
    const debugPanelWidth = 240;
    const debugPanelMargin = 10;
    const debugPanelX = k.width() - debugPanelWidth - debugPanelMargin;
    let currentPanelY = debugPanelMargin;
    let isDebugUIVisible = true;
    // --- CHANGE: Added a flag to prevent multiple boss spawns ---
    let isBossSpawnedInDebug = false;

    k.add([ k.rect(debugPanelWidth + 20, k.height() - debugPanelMargin * 2), k.pos(debugPanelX - 10, debugPanelMargin), k.color(15, 15, 15, 0.8), k.outline(2, k.rgb(60, 60, 60)), k.fixed(), k.z(99), "debugUI", ]);
    const toggleUIButton = k.add([ k.rect(debugPanelWidth, 30), k.pos(debugPanelX, currentPanelY), k.color(100, 100, 100), k.area(), k.fixed(), k.z(101), ]);
    const toggleUIText = toggleUIButton.add([ k.text("Hide UI", { size: 14, font: "sans-serif" }), k.anchor("center"), k.pos(toggleUIButton.width / 2, toggleUIButton.height / 2), k.z(102), ]);
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
            k.wait(1, () => createAndMonitorPowerup(pos, powerupType));
          });
        };
        createAndMonitorPowerup(spawnPos, type);
        locIndex++;
      }
    };
    spawnAllDebugPowerUps();

    // --- Enemy Spawner UI ---
    k.add([ k.text("ENEMY SPAWN", { size: 16 }), k.pos(debugPanelX, currentPanelY), k.fixed(), k.z(101), "debugUI", ]);
    currentPanelY += 25;
    let selectedEnemyType = Object.values(ENEMY_CONFIGS)[0].name;
    const typeLabels = [];
    Object.values(ENEMY_CONFIGS).forEach((enemyConfig) => {
      if (enemyConfig.spawnWeight === 0) return; // Don't show the boss in the regular spawner
      const label = k.add([ k.text(enemyConfig.name.toUpperCase(), { size: 12 }), k.pos(debugPanelX + 5, currentPanelY), k.area(), k.fixed(), k.z(101), "debugUI", { typeName: enemyConfig.name }, ]);
      label.onClick(() => {
        if (gameState.isPaused || !isDebugUIVisible) return;
        selectedEnemyType = enemyConfig.name;
        typeLabels.forEach( (l) => (l.color = l.typeName === selectedEnemyType ? k.rgb(255, 255, 0) : k.rgb(200, 200, 200)) );
      });
      typeLabels.push(label);
      currentPanelY += 20;
    });
    typeLabels.find((l) => l.typeName === selectedEnemyType).color = k.rgb(255, 255, 0);
    currentPanelY += 10;

    const spawnEnemyButton = k.add([ k.rect(debugPanelWidth - 20, 30), k.pos(debugPanelX + 10, currentPanelY), k.color(60, 180, 60), k.area(), k.fixed(), k.z(101), "debugUI", ]);
    spawnEnemyButton.add([ k.text("SPAWN ENEMY", { size: 14, font: "sans-serif" }), k.anchor("center"), k.pos(spawnEnemyButton.width / 2, spawnEnemyButton.height / 2), k.z(102), ]);
    spawnEnemyButton.onClick(() => {
      if (gameState.isPaused || gameState.isUpgradePanelOpen || !isDebugUIVisible) return;
      const spawnPos = k.vec2( k.rand(ARENA.x + 30, ARENA.x + ARENA.w - 30), k.rand(ARENA.y + 30, ARENA.y + ARENA.h - 30) );
      spawnEnemy(k, player, gameContext, { forceType: selectedEnemyType, progress: gameState.spawnProgress, spawnPos: spawnPos });
    });
    currentPanelY += 40; // Add spacing for the next button

    // --- CHANGE: Added Spawn Boss Button ---
    const spawnBossButton = k.add([ k.rect(debugPanelWidth - 20, 30), k.pos(debugPanelX + 10, currentPanelY), k.color(200, 50, 50), k.area(), k.fixed(), k.z(101), "debugUI", ]);
    spawnBossButton.add([ k.text("SPAWN BOSS", { size: 14, font: "sans-serif" }), k.anchor("center"), k.pos(spawnBossButton.width / 2, spawnBossButton.height / 2), k.z(102), ]);
    spawnBossButton.onClick(() => {
        if (gameState.isPaused || gameState.isUpgradePanelOpen || !isDebugUIVisible || isBossSpawnedInDebug) return;
        
        isBossSpawnedInDebug = true; // Prevent spawning multiple bosses
        
        const bossSpawnPromise = spawnEnemy(k, player, gameContext, {
            forceType: "boss",
            progress: 1,
        });

        if (bossSpawnPromise && typeof bossSpawnPromise.then === 'function') {
            bossSpawnPromise.then((bossEntity) => {
                if (bossEntity) {
                    createBossHealthBar(k, bossEntity);
                }
            }).catch(console.error);
        }
    });
    currentPanelY += 50;

    // --- Score & Upgrade UI ---
    k.add([ k.text("PLAYER STATS", { size: 16 }), k.pos(debugPanelX, currentPanelY), k.fixed(), k.z(101), "debugUI", ]);
    currentPanelY += 25;

    // --- CHANGE: Removed the "Add 100 Score" button ---
    // (The entire block for addScoreButton has been deleted)

    const forceUpgradeButton = k.add([ k.rect(debugPanelWidth - 20, 30), k.pos(debugPanelX + 10, currentPanelY), k.color(200, 100, 50), k.area(), k.fixed(), k.z(101), "debugUI", ]);
    forceUpgradeButton.add([ k.text("FORCE UPGRADE", { size: 14, font: "sans-serif" }), k.anchor("center"), k.pos(forceUpgradeButton.width / 2, forceUpgradeButton.height / 2), k.z(102), ]);
    forceUpgradeButton.onClick(() => {
      if (gameState.isPaused || gameState.isUpgradePanelOpen || !isDebugUIVisible) return;
      const scoreNeeded = nextUpgradeScoreThresholdRef.value - currentScore;
      addScore(Math.max(1, scoreNeeded));
    });

    // --- Main Game Loop ---
    let wasPauseKeyPreviouslyPressed = false;
    k.onUpdate(() => {
      if (keysPressed["KeyP"]) {
        if (!wasPauseKeyPreviouslyPressed && !gameState.isUpgradePanelOpen) {
          gameState.isPaused = !gameState.isPaused;
          pauseLabel.hidden = !gameState.isPaused;
          wasPauseKeyPreviouslyPressed = true;
        }
      } else {
        wasPauseKeyPreviouslyPressed = false;
      }

      k.paused = gameState.isPaused || gameState.isUpgradePanelOpen;
      if (k.paused) return;

      dashCooldownBar.width = dashCooldownBar.fullWidth * player.getDashCooldownProgress();
    });

    // --- Event Handlers ---
    player.onCollide("powerup", (powerUp) => {
        applyPowerUp(k, player, powerUp.type, gameContext, () => drawHealthBar(k, player.hp()));
        k.destroy(powerUp);
    });
  });
}