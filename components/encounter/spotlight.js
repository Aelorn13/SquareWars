//components/encounter/spotlight.js
import { showEncounterFeedback } from "./circle.js";

export const SPOTLIGHT_Z_INDEX = {
  VISIBLE: 42,
};

export const spotlightEncounter = {
  name: "Spotlight",
  isFinished: true,
  originalPlayerZ: null,

  start(k, gameContext) {
    this.isFinished = false;
    const { player, sharedState: gameState, increaseScore } = gameContext;

    // --- Configuration ---
    const ARENA = gameState.area;
    const ARENA_COLOR = k.rgb(20, 20, 20);
    const ENCOUNTER_DURATION = k.rand(12, 24);
    const FADE_IN_TIME = 1.5;
    const FADE_OUT_TIME = 1.0;
    const OPACITY_IN_DARK = 0.05;
    const BASE_SCORE_REWARD = 5;
    const TIME_SCORE_MODIFIER = 0.2;
    const PENUMBRA_BUFFER = 70;
    const MIN_SPOTLIGHT_SPEED = 30;
    const MAX_SPOTLIGHT_SPEED = 70;

    // --- Z-INDEX CONFIG ---
    const Z_DARKNESS = 40;
    const Z_LIGHT_BACKGROUND = 41;
    const Z_VISIBLE_IN_LIGHT = SPOTLIGHT_Z_INDEX.VISIBLE;
    const Z_LIGHT_GLOW = 43;

    // --- State ---
    let encounterTimeLeft = ENCOUNTER_DURATION;
    let encounterFinished = false;

    // --- Player Visibility ---
    this.originalPlayerZ = player.z;
    player.z = Z_VISIBLE_IN_LIGHT;

    // --- Darkness Overlay ---
    const darkness = k.add([
      k.rect(k.width(), k.height()),
      k.pos(0, 0),
      k.color(0, 0, 0),
      k.opacity(0),
      k.z(Z_DARKNESS),
      "darknessOverlay",
    ]);

    k.tween(darkness.opacity, 0.95, FADE_IN_TIME, (p) => (darkness.opacity = p));

    // --- Spotlight Creation ---
    const numSpotlights = k.randi(1, 4);
    const spotlights = [];
    let baseRadius = 200;

    for (let i = 0; i < numSpotlights; i++) {
      const innerRadius = baseRadius;
      const speed = k.rand(MIN_SPOTLIGHT_SPEED, MAX_SPOTLIGHT_SPEED);
      const angle = k.rand(0, 2 * Math.PI);
      const velocity = k.vec2(Math.cos(angle) * speed, Math.sin(angle) * speed);

      const spotlight = k.add([
        k.pos(
          k.rand(ARENA.x + innerRadius, ARENA.x + ARENA.w - innerRadius),
          k.rand(ARENA.y + innerRadius, ARENA.y + ARENA.h - innerRadius)
        ),
        "spotlight",
        {
          innerRadius: innerRadius,
          outerRadius: innerRadius + PENUMBRA_BUFFER,
          vel: velocity,
          update() {
            if (gameState.isPaused || gameState.upgradeOpen) {
              return; 
            }
            this.pos = this.pos.add(this.vel.scale(k.dt()));
            // Wall bounce logic
            if (this.pos.x - this.innerRadius < ARENA.x || this.pos.x + this.innerRadius > ARENA.x + ARENA.w) {
              this.pos.x = k.clamp(this.pos.x, ARENA.x + this.innerRadius, ARENA.x + ARENA.w - this.innerRadius);
              this.vel.x *= -1;
            }
            if (this.pos.y - this.innerRadius < ARENA.y || this.pos.y + this.innerRadius > ARENA.y + ARENA.h) {
                this.pos.y = k.clamp(this.pos.y, ARENA.y + this.innerRadius, ARENA.y + ARENA.h - this.innerRadius);
              this.vel.y *= -1;
            }
          },
        },
      ]);

      // Visuals
      spotlight.add([k.circle(innerRadius), k.color(ARENA_COLOR), k.z(Z_LIGHT_BACKGROUND)]);
      spotlight.add([k.circle(innerRadius), k.outline(4, k.rgb(255, 255, 150)), k.z(Z_LIGHT_GLOW), { fill: false }]);

      spotlights.push(spotlight);
      baseRadius = Math.max(120, baseRadius * 0.8);
    }

    // This function will be called to clean everything up
    const endEncounter = () => {
      if (encounterFinished) return;
      encounterFinished = true;

      k.tween(darkness.opacity, 0, FADE_OUT_TIME, (p) => (darkness.opacity = p)).then(() => {
        k.destroy(darkness);
      });

      const timeBonus = Math.floor(gameState.elapsedTime * TIME_SCORE_MODIFIER);
      const totalReward = Math.floor(BASE_SCORE_REWARD + timeBonus);
      increaseScore(totalReward);
      this.encounterResult = { scoreAwarded: totalReward };
      
      this.isFinished = true;
      visibilityUpdate.cancel();
      mainUpdate.cancel();
      spotlights.forEach((s) => k.destroy(s));

      if (this.originalPlayerZ !== null) {
        player.z = this.originalPlayerZ;
        this.originalPlayerZ = null;
      }

      k.get("enemy").forEach((enemy) => {
        enemy.opacity = 1;
        if (enemy.originalZ != null) {
          enemy.z = enemy.originalZ;
          delete enemy.originalZ;
        }
      });
    };

    // Enemy Visibility Logic
    const visibilityUpdate = k.onUpdate("enemy", (enemy) => {
      let minDistance = Infinity;
      spotlights.forEach((s) => { minDistance = Math.min(minDistance, enemy.pos.dist(s.pos)); });

      const closestSpotlight = spotlights.find((s) => enemy.pos.dist(s.pos) === minDistance);
      if (!closestSpotlight) return;

      if (minDistance <= closestSpotlight.innerRadius) {
        if (enemy.originalZ == null) enemy.originalZ = enemy.z;
        enemy.opacity = 1;
        enemy.z = Z_VISIBLE_IN_LIGHT;
      } else if (minDistance <= closestSpotlight.outerRadius) {
        if (enemy.originalZ == null) enemy.originalZ = enemy.z;
        const progress = 1 - (minDistance - closestSpotlight.innerRadius) / PENUMBRA_BUFFER;
        enemy.opacity = k.lerp(OPACITY_IN_DARK, 1, progress);
        enemy.z = Z_VISIBLE_IN_LIGHT;
      } else {
        enemy.opacity = OPACITY_IN_DARK;
        if (enemy.originalZ != null) enemy.z = enemy.originalZ;
      }
    });

    const mainUpdate = k.onUpdate(() => {
      if (gameState.isPaused || gameState.upgradeOpen) {
        return;
      }
      encounterTimeLeft -= k.dt();
      if (encounterTimeLeft <= 0) {
        endEncounter();
      }
    });
  },
};