// components/ui/dubug/bossSpawner.js
/**
 * Boss spawner UI with several helper buttons.
 * Accepts an `isDebugUIVisible` function that returns whether debug UI is visible (used for guarding clicks).
 * Keeps an internal `isBossSpawned` flag (prevents double-spawn).
 */
export function createBossSpawner(k, debugPanelX, currentPanelY, {
  spawnEnemy,
  player,
  gameContext,
  summonMinions,
  spreadShot,
  chargeAttack,
  createBossHealthBar,
  gameState,
  isDebugUIVisible = () => true,
  debugPanelWidth = 240,
} = {}) {
  k.add([k.text("BOSS SPAWNERS", { size: 16 }), k.pos(debugPanelX, currentPanelY), k.fixed(), k.z(101), "debugUI"]);
  currentPanelY += 25;

  let isBossSpawned = false;

  const createDebugButton = (text, yPos, colorArray, onClickAction) => {
    const button = k.add([
      k.rect(debugPanelWidth - 20, 30),
      k.pos(debugPanelX + 10, yPos),
      k.color(...colorArray),
      k.area(),
      k.fixed(),
      k.z(101),
      "debugUI",
    ]);
    button.add([k.text(text, { size: 14, font: "sans-serif" }), k.anchor("center"), k.pos(button.width / 2, button.height / 2), k.z(102)]);
    button.onClick(() => {
      if (!gameState.isPaused && !gameState.isUpgradePanelOpen && isDebugUIVisible()) onClickAction();
    });
    return button;
  };

  // SPWAN BOSS
  createDebugButton("SPAWN BOSS", currentPanelY, [200, 50, 50], () => {
    if (isBossSpawned) return;
    isBossSpawned = true;
    const bossSpawnPromise = spawnEnemy(k, player, gameContext, { forceType: "boss", progress: 1 });
    if (bossSpawnPromise && typeof bossSpawnPromise.then === "function") {
      bossSpawnPromise.then((boss) => {
        if (boss && createBossHealthBar) createBossHealthBar(k, boss);
      }).catch(console.error);
    }
  });
  currentPanelY += 40;

  const spawnMinibossWithAbility = (ability, scaling = {}) => {
    const spawnPos = k.vec2(k.rand(gameContext.sharedState.area.x + 50, gameContext.sharedState.area.x + gameContext.sharedState.area.w - 50),
                            k.rand(gameContext.sharedState.area.y + 50, gameContext.sharedState.area.y + gameContext.sharedState.area.h - 50));
        spawnEnemy(k, player, gameContext, {
      forceType: "miniboss",
      ability,
      spawnPos,
      scaling,
      difficulty: gameContext.difficulty,
    });
  };
  

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

  // Force upgrade button (kept here as part of boss / debug controls).
  createDebugButton("FORCE UPGRADE", currentPanelY, [200, 100, 50], () => {
    // This button used to be defined in the main debug file where addScore is available.
    // We will check if gameContext.increaseScore exists and call it with the delta required.
    if (!gameContext || typeof gameContext.increaseScore !== "function") return;
    // try to approximate previous behavior: caller should set nextUpgradeScoreThresholdRef on gameContext.sharedState if they need full parity.
    const currentScore = typeof gameContext._currentScore === "number" ? gameContext._currentScore : 0;
    const nextThreshold = typeof gameContext.nextUpgradeScoreThreshold === "number" ? gameContext.nextUpgradeScoreThreshold : (currentScore + 10);
    const scoreNeeded = nextThreshold - currentScore;
    gameContext.increaseScore(Math.max(1, scoreNeeded));
  });
  currentPanelY += 0; // already placed

  return { currentPanelY, isBossSpawned: () => isBossSpawned };
}
