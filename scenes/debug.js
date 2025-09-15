import { createPlayer } from "../components/player/player.js";
import { setupEnemyPlayerCollisions } from "../components/enemy/enemyBehavior.js";
import { spawnEnemy } from "../components/enemy/enemySpawner.js";
import { setupBossBehaviors } from "../components/enemy/boss/bossSetup.js";
import { createScoreLabel, updateScoreLabel, drawHealthBar, drawDashCooldownBar, createPauseLabel, createBossHealthBar, } from "../components/ui/index.js";
import { setupPlayerShooting } from "../components/player/shooting.js";
import { applyPowerUp } from "../components/powerup/applyPowerup.js";
import { spawnPowerUp } from "../components/powerup/spawnPowerup.js";
import { POWERUP_TYPES } from "../components/powerup/powerupTypes.js";
import { ENEMY_CONFIGS } from "../components/enemy/enemyConfig.js";
import { maybeShowUpgrade } from "../components/upgrade/applyUpgrade.js";
import { keysPressed } from "../components/player/controls.js";
import { summonMinions, spreadShot, chargeAttack } from "../components/enemy/boss/bossAbilities.js";

/**
 * Defines the debug game scene for testing game mechanics.
 */
export function defineDebugScene(k) {
  k.scene("debug", () => {
    // --- Game Arena Setup ---
    const ARENA_MARGIN = Math.floor(Math.min(k.width(), k.height()) * 0.05);
    const ARENA = { x: ARENA_MARGIN, y: ARENA_MARGIN, w: k.width() - ARENA_MARGIN * 2, h: k.height() - ARENA_MARGIN * 2 };
    k.add([ k.rect(ARENA.w, ARENA.h), k.pos(ARENA.x, ARENA.y), k.color(20, 20, 20), k.outline(2, k.rgb(80, 80, 80)), k.fixed(), k.z(-50), "gameArena" ]);

    // --- Game State & Context ---
    const gameState = { isPaused: false, isUpgradePanelOpen: false, area: ARENA, spawnProgress: 1 };
    const player = createPlayer(k, gameState);
    let currentScore = 0;
    const nextUpgradeScoreThresholdRef = { value: 10 };
    const addScore = (amount) => {
      currentScore += amount;
      updateScoreLabel(scoreLabel, currentScore, nextUpgradeScoreThresholdRef.value);
      maybeShowUpgrade(k, player, gameState, currentScore, nextUpgradeScoreThresholdRef, addScore);
    };

    setupPlayerShooting(k, player, gameState);
    const gameContext = { sharedState: gameState, increaseScore: addScore, updateHealthBar: () => drawHealthBar(k, player.hp()) };
    setupEnemyPlayerCollisions(k, gameContext);
    setupBossBehaviors(k, gameContext);

    // --- UI Elements ---
    const scoreLabel = createScoreLabel(k);
    drawHealthBar(k, player.hp());
    const dashCooldownBar = drawDashCooldownBar(k);
    const pauseLabel = createPauseLabel(k);

    // --- Debug UI Panel ---
    const debugPanelWidth = 240;
    const debugPanelMargin = 10;
    const debugPanelX = k.width() - debugPanelWidth - debugPanelMargin;
    let currentPanelY = debugPanelMargin;
    let isDebugUIVisible = true;
    let isBossSpawnedInDebug = false;

    // --- UI Base Panel ---
    const debugUIBase = k.add([ k.rect(debugPanelWidth + 20, k.height() - debugPanelMargin * 2), k.pos(debugPanelX - 10, debugPanelMargin), k.color(15, 15, 15, 0.8), k.outline(2, k.rgb(60, 60, 60)), k.fixed(), k.z(99) ]);

    // --- UI Toggle Button ---
    const toggleUIButton = k.add([ k.rect(debugPanelWidth, 30), k.pos(debugPanelX, currentPanelY), k.color(100, 100, 100), k.area(), k.fixed(), k.z(101) ]);
    const toggleUIText = toggleUIButton.add([ k.text("Hide UI", { size: 14, font: "sans-serif" }), k.anchor("center"), k.pos(toggleUIButton.width / 2, toggleUIButton.height / 2), k.z(102) ]);
    toggleUIButton.onClick(() => {
      isDebugUIVisible = !isDebugUIVisible;
      k.get("debugUI", { recursive: true }).forEach((el) => { el.hidden = !isDebugUIVisible; });
      debugUIBase.hidden = !isDebugUIVisible;
      toggleUIText.text = isDebugUIVisible ? "Hide UI" : "Show UI";
    });
    currentPanelY += 40;

    // --- Power-up Spawner ---
    const spawnAllDebugPowerUps = () => {
      const startX = ARENA.x + 50;
      const spawnY = ARENA.y + 50;
      const spacing = 40;
      Object.values(POWERUP_TYPES).forEach((type, index) => {
        const spawnPos = k.vec2(startX + index * spacing, spawnY);
        const createAndMonitorPowerup = (pos, powerupType) => {
          const powerup = spawnPowerUp(k, pos, powerupType, gameState);
          powerup.onDestroy(() => {
            k.wait(1, () => createAndMonitorPowerup(pos, powerupType));
          });
        };
        createAndMonitorPowerup(spawnPos, type);
      });
    };
    spawnAllDebugPowerUps();

    // --- Enemy Spawner UI ---
    k.add([ k.text("ENEMY SPAWN", { size: 16 }), k.pos(debugPanelX, currentPanelY), k.fixed(), k.z(101), "debugUI" ]);
    currentPanelY += 25;
    let selectedEnemyType = Object.values(ENEMY_CONFIGS).find(e => e.spawnWeight > 0)?.name || 'normal';
    const typeLabels = [];
    Object.values(ENEMY_CONFIGS).forEach((enemyConfig) => {
      if (enemyConfig.spawnWeight === 0) return;
      const label = k.add([ k.text(enemyConfig.name.toUpperCase(), { size: 12 }), k.pos(debugPanelX + 5, currentPanelY), k.area(), k.fixed(), k.z(101), "debugUI", { typeName: enemyConfig.name } ]);
      label.onClick(() => {
        if (gameState.isPaused || !isDebugUIVisible) return;
        selectedEnemyType = enemyConfig.name;
        typeLabels.forEach((l) => (l.color = l.typeName === selectedEnemyType ? k.rgb(255, 255, 0) : k.rgb(200, 200, 200)));
      });
      typeLabels.push(label);
      currentPanelY += 20;
    });
    typeLabels.find((l) => l.typeName === selectedEnemyType).color = k.rgb(255, 255, 0);
    currentPanelY += 10;

    const spawnEnemyButton = k.add([ k.rect(debugPanelWidth - 20, 30), k.pos(debugPanelX + 10, currentPanelY), k.color(60, 180, 60), k.area(), k.fixed(), k.z(101), "debugUI" ]);
    spawnEnemyButton.add([ k.text("SPAWN ENEMY", { size: 14, font: "sans-serif" }), k.anchor("center"), k.pos(spawnEnemyButton.width / 2, spawnEnemyButton.height / 2), k.z(102) ]);
    spawnEnemyButton.onClick(() => {
      if (gameState.isPaused || !isDebugUIVisible) return;
      spawnEnemy(k, player, gameContext, { forceType: selectedEnemyType });
    });
    currentPanelY += 50;

    // --- Boss & Miniboss Spawners ---
    const createDebugButton = (text, yPos, color, onClickAction) => {
      const button = k.add([ k.rect(debugPanelWidth - 20, 30), k.pos(debugPanelX + 10, yPos), k.color(...color), k.area(), k.fixed(), k.z(101), "debugUI" ]);
      button.add([ k.text(text, { size: 14, font: "sans-serif" }), k.anchor("center"), k.pos(button.width / 2, button.height / 2), k.z(102) ]);
      button.onClick(() => { if (!gameState.isPaused && !gameState.isUpgradePanelOpen && isDebugUIVisible) onClickAction(); });
      return button;
    };
    const spawnMinibossWithAbility = (ability, scaling = {}) => {
      const spawnPos = k.vec2(k.rand(ARENA.x + 50, ARENA.x + ARENA.w - 50), k.rand(ARENA.y + 50, ARENA.y + ARENA.h - 50));
      spawnEnemy(k, player, gameContext, { forceType: "miniboss", ability, spawnPos, scaling });
    };

    k.add([ k.text("BOSS SPAWNERS", { size: 16 }), k.pos(debugPanelX, currentPanelY), k.fixed(), k.z(101), "debugUI" ]);
    currentPanelY += 25;

    createDebugButton("SPAWN BOSS", currentPanelY, [200, 50, 50], () => {
      if (isBossSpawnedInDebug) return;
      isBossSpawnedInDebug = true;
      const bossSpawnPromise = spawnEnemy(k, player, gameContext, { forceType: "boss", progress: 1 });
      if (bossSpawnPromise) {
        bossSpawnPromise.then((boss) => { if (boss) createBossHealthBar(k, boss); }).catch(console.error);
      }
    });
    currentPanelY += 40;

    createDebugButton("SPAWN SUMMONER", currentPanelY, [140, 40, 140], () => { spawnMinibossWithAbility(summonMinions); });
    currentPanelY += 40;
    
    createDebugButton("SPAWN SPREADER", currentPanelY, [140, 40, 140], () => { spawnMinibossWithAbility(spreadShot); });
    currentPanelY += 40;

    createDebugButton("SPAWN CHARGER", currentPanelY, [140, 40, 140], () => { spawnMinibossWithAbility(chargeAttack); });
    currentPanelY += 40;
    
    createDebugButton("SPAWN SCALED MINIBOSS", currentPanelY, [200, 100, 200], () => {
        const randomAbility = k.choose([summonMinions, spreadShot, chargeAttack]);
        spawnMinibossWithAbility(randomAbility, { hpMultiplier: 1.5, speedMultiplier: 1.2 });
    });
    currentPanelY += 50;

    // --- Player Stats & Upgrade UI ---
    k.add([ k.text("PLAYER STATS", { size: 16 }), k.pos(debugPanelX, currentPanelY), k.fixed(), k.z(101), "debugUI" ]);
    currentPanelY += 25;

    createDebugButton("FORCE UPGRADE", currentPanelY, [200, 100, 50], () => {
      const scoreNeeded = nextUpgradeScoreThresholdRef.value - currentScore;
      addScore(Math.max(1, scoreNeeded));
    });

    // --- Main Game Loop ---
    let wasPauseKeyPreviouslyPressed = false;
    k.onUpdate(() => {
      if (keysPressed["KeyP"] && !wasPauseKeyPreviouslyPressed && !gameState.isUpgradePanelOpen) {
        gameState.isPaused = !gameState.isPaused;
        pauseLabel.hidden = !gameState.isPaused;
        wasPauseKeyPreviouslyPressed = true;
      } else if (!keysPressed["KeyP"]) {
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