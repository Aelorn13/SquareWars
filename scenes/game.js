import { createPlayer } from "../components/player/player.js";
import { spawnEnemy } from "../components/enemy/enemySpawner.js";
import { setupEnemyPlayerCollisions } from "../components/enemy/enemyBehavior.js";
import { setupBossBehaviors } from "../components/enemy/boss/bossSetup.js";
import { createScoreLabel, updateScoreLabel, drawHealthBar, drawDashCooldownBar, createTimerLabel, updateTimerLabel, createPauseLabel, createBossHealthBar, } from "../components/ui/index.js";
import { setupPlayerShooting } from "../components/player/shooting.js";
import { applyPowerUp } from "../components/powerup/applyPowerup.js";
import { keysPressed } from "../components/player/controls.js";
import { maybeShowUpgrade } from "../components/upgrade/applyUpgrade.js";
import { summonMinions, spreadShot,chargeAttack } from "../components/enemy/boss/bossAbilities.js";
import { isMobileDevice, registerMobileController } from "../components/player/controls.js";
import { makeMobileController } from "../components/player/mobile/index.js";


const MINIMAL_SPAWN_INTERVAL = 0.2;
const BOSS_SPAWN_TIME = 100;

export function defineGameScene(k, scoreRef) {
  k.scene("game", () => {

if (isMobileDevice()) {
registerMobileController(() => makeMobileController(k));

}

    // --- Game Arena Setup ---
    const ARENA_MARGIN = Math.floor(Math.min(k.width(), k.height()) * 0.05);
    const ARENA = { x: ARENA_MARGIN, y: ARENA_MARGIN, w: k.width() - ARENA_MARGIN * 2, h: k.height() - ARENA_MARGIN * 2 };
    k.add([ k.rect(ARENA.w, ARENA.h), k.pos(ARENA.x, ARENA.y), k.color(20, 20, 20), k.outline(2, k.rgb(80, 80, 80)), k.fixed(), k.z(-50), "gameArena" ]);

    // --- Game State & Context ---
    const gameState = { isPaused: false, isUpgradePanelOpen: false, area: ARENA, spawnProgress: 0, elapsedTime: 0 };
    const player = createPlayer(k, gameState);
    let currentScore = 0;
    const nextUpgradeScoreThresholdRef = { value: 10 };

    const addScore = (amount) => {
      currentScore += amount;
      updateScoreLabel(scoreLabel, currentScore, nextUpgradeScoreThresholdRef.value);
      maybeShowUpgrade(k, player, gameState, currentScore, nextUpgradeScoreThresholdRef, addScore);
    };

    scoreRef.value = () => currentScore;
    setupPlayerShooting(k, player, gameState);

    const gameContext = { sharedState: gameState, increaseScore: addScore, updateHealthBar: () => drawHealthBar(k, player.hp()) };
    setupEnemyPlayerCollisions(k, gameContext);
    setupBossBehaviors(k, gameContext);

    // --- UI Elements ---
    const scoreLabel = createScoreLabel(k);
    drawHealthBar(k, player.hp());
    const dashCooldownBar = drawDashCooldownBar(k);
    const pauseLabel = createPauseLabel(k);
    const timerLabel = createTimerLabel(k, BOSS_SPAWN_TIME);

    // --- Game Loop Variables ---
    const initialEnemySpawnInterval = 2;
    let enemySpawnInterval = initialEnemySpawnInterval;
    let timeUntilNextSpawn = enemySpawnInterval;
    let isBossSpawned = false;
    let wasPauseKeyPreviouslyPressed = false;
    let currentBoss = null;

     // --- MINIBOSS STATE TRACKING ---
    let firstMinibossSpawned = false;
    let secondMinibossSpawned = false;
    let firstMinibossAbility = null;
    const availableMinibossAbilities = [summonMinions, spreadShot, chargeAttack];

    // --- Main Game Loop (onUpdate) ---
    k.onUpdate(() => {
      // --- Pause Handling ---
      if (keysPressed["KeyP"]) {
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
      dashCooldownBar.width = dashCooldownBar.fullWidth * player.getDashCooldownProgress();
      updateTimerLabel(timerLabel, k.dt());
      
         // Spawn first miniboss at 1/3 of the total time
      if (!firstMinibossSpawned && gameState.elapsedTime >= BOSS_SPAWN_TIME / 3) {
        firstMinibossSpawned = true;
        firstMinibossAbility = k.choose(availableMinibossAbilities);
        
        console.log("Spawning first miniboss with ability:", firstMinibossAbility.name);
        spawnEnemy(k, player, gameContext, {
            forceType: "miniboss",
            ability: firstMinibossAbility,
        });
      }

      // Spawn second, scaled miniboss at 2/3 of the total time
      if (!secondMinibossSpawned && gameState.elapsedTime >= (BOSS_SPAWN_TIME * 2) / 3) {
        secondMinibossSpawned = true;
        
        // Filter out the first ability to guarantee a different one
        const remainingAbilities = availableMinibossAbilities.filter(
          (ab) => ab.name !== firstMinibossAbility.name
        );
        const secondAbility = k.choose(remainingAbilities);

        // Define scaling for the second miniboss
        const scaling = { hpMultiplier: 1.5, speedMultiplier: 1.1 };
        
        console.log("Spawning second miniboss with ability:", secondAbility.name);
        spawnEnemy(k, player, gameContext, {
            forceType: "miniboss",
            ability: secondAbility,
            scaling: scaling, // Pass the scaling object
        });
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
            
            if (bossSpawnPromise && typeof bossSpawnPromise.then === 'function') {
                bossSpawnPromise.then((bossEntity) => {
                    currentBoss = bossEntity;
                    if (currentBoss) {
                        createBossHealthBar(k, currentBoss);
                    }
                }).catch(console.error);
            }
          } else {
            // Calculate progress based on the (now correctly updated) elapsed time
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

    // --- Event Handlers ---
    player.onCollide("powerup", (powerUp) => {
      applyPowerUp(k, player, powerUp.type, gameContext, () => drawHealthBar(k, player.hp()));
      k.destroy(powerUp);
    });
  });
}