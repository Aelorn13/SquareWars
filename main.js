import kaplay from "https://unpkg.com/kaplay@3001.0.19/dist/kaplay.mjs";
import { defineGameScene } from "./scenes/game.js";
import { defineGameOverScene } from "./scenes/gameover.js";
import { TutorialScene } from "./scenes/tutorial.js";
import { initControls } from "./components/player/controls.js";
import { defineVictoryScene } from "./scenes/victory.js";
import { defineDebugScene } from "./scenes/debug.js";
import { initLayoutManager } from "./layoutManager.js"; 

// --- 1. Initialize Kaplay ---
const k = kaplay({
  width: 1024,
  height: 820,
  letterBox: true,
  debug: true,
  global: false,
  background: [0, 0, 0],
  touchToMouse: true,
  debugKey: "f4",
});

// --- 2. Define Game Scenes and Controls ---
defineGameScene(k, /*scoreRef*/ {});
defineGameOverScene(k, () => 0);
defineVictoryScene(k, () => 0);
TutorialScene(k);
defineDebugScene(k);
// 3) Init input (keyboard/mouse + mobile manager)
initControls(k);
initControls(k);

// 4) Init layout manager (handles mobile shell + controllers)
initLayoutManager(k);

// --- 5. Start the Game ---
k.go("tutorial");