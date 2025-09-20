// components/ui/dubug/enemySpawnerUI.js
/**
 * Builds the enemy-spawn section of the debug panel:
 * - "ENEMY SPAWN" title
 * - clickable enemy type labels
 * - "SPAWN ENEMY" button
 *
 * Returns { currentPanelY } so caller can continue placing UI below it.
 */
export function createEnemySpawner(k, debugPanelX, currentPanelY, {
  ENEMY_CONFIGS,
  spawnEnemy,
  player,
  gameContext,
  gameState,
  isDebugUIVisible = () => true,
  debugPanelWidth = 240,
} = {}) {
  k.add([k.text("ENEMY SPAWN", { size: 16 }), k.pos(debugPanelX, currentPanelY), k.fixed(), k.z(101), "debugUI"]);
  currentPanelY += 25;

  let selectedEnemyType = Object.values(ENEMY_CONFIGS).find((e) => e.spawnWeight > 0)?.name || "normal";
  const typeLabels = [];

  Object.values(ENEMY_CONFIGS).forEach((enemyConfig) => {
    if (enemyConfig.spawnWeight === 0) return;
    const label = k.add([
      k.text(enemyConfig.name.toUpperCase(), { size: 12 }),
      k.pos(debugPanelX + 5, currentPanelY),
      k.area(),
      k.fixed(),
      k.z(101),
      "debugUI",
      { typeName: enemyConfig.name },
    ]);
    label.onClick(() => {
      if (gameState.isPaused || !isDebugUIVisible()) return;
      selectedEnemyType = enemyConfig.name;
      typeLabels.forEach((l) => (l.color = l.typeName === selectedEnemyType ? k.rgb(255, 255, 0) : k.rgb(200, 200, 200)));
    });
    typeLabels.push(label);
    currentPanelY += 20;
  });

  // try to highlight initial
  const initial = typeLabels.find((l) => l.typeName === selectedEnemyType);
  if (initial) initial.color = k.rgb(255, 255, 0);
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
  spawnEnemyButton.add([k.text("SPAWN ENEMY", { size: 14, font: "sans-serif" }), k.anchor("center"), k.pos(spawnEnemyButton.width / 2, spawnEnemyButton.height / 2), k.z(102)]);
  spawnEnemyButton.onClick(() => {
    if (gameState.isPaused || !isDebugUIVisible()) return;
    spawnEnemy(k, player, gameContext, { forceType: selectedEnemyType });
  });
  currentPanelY += 50;

  return { currentPanelY, selectedEnemyTypeGetter: () => selectedEnemyType, typeLabels };
}
