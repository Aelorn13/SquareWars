import kaplay from "https://unpkg.com/kaplay@3001.0.19/dist/kaplay.mjs";
import { defineGameScene } from "./scenes/game.js";
import { defineGameOverScene } from "./scenes/gameover.js";
import { TutorialScene } from "./scenes/tutorial.js";
import { initControls } from "./components/controls.js";

const k = kaplay({
  height: 960,
  width: 540,
  letterBox: true,
  scale: Math.min(window.innerWidth / 540, window.innerHeight / 960),
  debug: true,
  global: false,
  background: [10, 10, 10],
  touchToMouse: true,
  debugKey: "f4",
});

// Reference holder for dynamic score access
const scoreRef = { value: () => 0 };

defineGameScene(k, scoreRef);
defineGameOverScene(k, () => scoreRef.value());
TutorialScene(k);
initControls();
k.go("tutorial");


