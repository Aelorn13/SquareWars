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
// Reference holder for dynamic score access
const scoreRef = { value: () => 0 };

// --- 2. Define Game Scenes and Controls ---
defineGameScene(k, scoreRef);
defineGameOverScene(k, () => scoreRef.value());
defineVictoryScene(k, () => scoreRef.value());
TutorialScene(k);
defineDebugScene(k);
// 3) Init input (keyboard/mouse + mobile manager)
initControls(k);

// 4) Init layout manager (handles mobile shell + controllers)
initLayoutManager(k);

// --- 5. Start the Game ---
k.go("tutorial");
// k.go("debug");