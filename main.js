// main.js

import kaplay from "https://unpkg.com/kaplay@3001.0.19/dist/kaplay.mjs";
import { defineGameScene } from "./scenes/game.js";
import { defineGameOverScene } from "./scenes/gameover.js";
import { TutorialScene } from "./scenes/tutorial.js";
import { initControls } from "./components/player/controls.js";
import { defineVictoryScene } from "./scenes/victory.js";
import { defineDebugScene } from "./scenes/debug.js";

// --- Platform Detection ---
// This regex checks the user agent string for common mobile keywords.
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// --- Game Initialization ---
// Conditionally set the width and height based on the platform.
const k = kaplay({
  width: isMobile ? 820 : 1024,    // Portrait width for mobile
  height: isMobile ? 1024 : 820,   // Portrait height for mobile
  letterBox: true,
  debug: true,
  global: false,
  background: [0, 0, 0],
  touchToMouse: false, // Disable this to handle touch events manually for joysticks
  debugKey: "f4",
});

// Reference holder for dynamic score access
const scoreRef = { value: () => 0 };

// Pass the 'isMobile' flag to scenes and modules that need it.
// Note: You'll need to update defineGameScene to accept this object.
defineGameScene(k, scoreRef, isMobile);
defineGameOverScene(k, () => scoreRef.value());
defineVictoryScene(k, () => scoreRef.value());
TutorialScene(k, isMobile);
initControls(k, isMobile); // Pass kaboom context and mobile flag

k.go("tutorial");
defineDebugScene(k);
// k.go("debug")