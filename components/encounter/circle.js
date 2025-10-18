import { spawnEnemy } from "../enemy/enemySpawner.js";

export const circleEncounter = {
  // A name for debugging or potential future logic
  name: "Circle",

  // This will be set to true when the encounter is over
  isFinished: true,

  // The start method will kick off the encounter
  start(k, gameContext) {
    this.isFinished = false;
    const { player, increaseScore, sharedState: gameState } = gameContext;

    // --- Configuration ---
    const ARENA = gameState.area;
    const CIRCLE_CHARGE_TIME = 5;
    const BASE_CIRCLE_SCORE_REWARD = 5;
    const TIME_SCORE_MODIFIER = 0.33;
    const BAD_OUTCOME_ENEMY_COUNT = 10;

    // --- Helper Functions for this encounter ---
    const onComplete = (type) => {
      if (type === "good") {
        const timeBonus = Math.floor(gameState.elapsedTime * TIME_SCORE_MODIFIER);
        const totalReward = Math.floor(BASE_CIRCLE_SCORE_REWARD + timeBonus);
        increaseScore(totalReward);
      } else if (type === "bad") {
        console.log("Circle Encounter: Bad outcome! Spawning enemies.");
        for (let i = 0; i < BAD_OUTCOME_ENEMY_COUNT; i++) {
          // We'll spawn them with the current game progress.
          spawnEnemy(k, player, gameContext, {
            progress: gameState.spawnProgress,
            difficulty: gameContext.difficulty,
          });
        }
      }
      this.isFinished = true; // Signal completion
    };

    const onCancel = () => {
      this.isFinished = true; // Also signal completion on cancel
    };

    // --- Position Logic ---
    const circlePos = k.vec2(
      k.rand(ARENA.x + 75, ARENA.x + ARENA.w - 75),
      k.rand(ARENA.y + 75, ARENA.y + ARENA.h - 75)
    );

    // --- Create the Kaboom Game Object ---
    const encounter = k.add([
      k.pos(circlePos),
      k.z(-25),
      "encounterCircle",
      {
        charge: 0,
        maxCharge: CIRCLE_CHARGE_TIME,
        radius: 75,
        isPlayerInside: false,
        outcomeType: null, // Can be 'good', 'bad', or null
        update() {
          if (gameState.isPaused || gameState.upgradeOpen) {
            return;
          }

          const distance = this.pos.dist(player.pos);
          this.isPlayerInside = distance <= this.radius;

          if (this.isPlayerInside) {
            // If this is the first time the player enters, determine the outcome
            if (this.outcomeType === null) {
              this.outcomeType = k.choose(["good", "bad"]);
            }
            this.charge = Math.min(this.maxCharge, this.charge + k.dt());
          } else {
            this.charge = Math.max(0, this.charge - k.dt() * 1.8);
            // If charge depletes fully, reset the outcome type
            if (this.charge === 0) {
              this.outcomeType = null;
            }
          }

          if (this.charge >= this.maxCharge) {
            onComplete(this.outcomeType);
            k.destroy(this);
          }
        },
        draw() {
          // Draw the base circle
          k.drawCircle({
            pos: k.vec2(0, 0),
            radius: this.radius,
            fill: true,
            color: k.rgb(20, 20, 20),
            outline: { color: k.rgb(80, 80, 80), width: 4 },
          });

          const progress = this.charge / this.maxCharge;
          if (progress > 0) {
            // Determine the color of the progress arc
            let arcColor = k.rgb(255, 255, 255); // Default to white
            if (progress > 0.5 && this.outcomeType) {
              const transitionProgress = (progress - 0.5) * 2; // Scale 0.5-1.0 to 0-1
              if (this.outcomeType === "good") {
                arcColor = k.rgb(255, 255, 255).lerp(k.rgb(0, 255, 0), transitionProgress);
              } else {
                // 'bad'
                arcColor = k.rgb(255, 255, 255).lerp(k.rgb(255, 0, 0), transitionProgress);
              }
            }

            // Draw the progress arc
            const endAngleRad = k.deg2rad(360 * progress);
            const resolution = 60;
            const arcPoints = [];
            for (let i = 0; i <= resolution; i++) {
              const currentAngle = (i / resolution) * endAngleRad;
              arcPoints.push(
                k.vec2(Math.cos(currentAngle) * this.radius, Math.sin(currentAngle) * this.radius)
              );
            }
            k.drawLines({
              pts: arcPoints,
              width: 4,
              color: arcColor,
            });
          }
        },
      },
    ]);

    // If the encounter object is destroyed for any other reason (e.g., scene change)
    encounter.onDestroy(onCancel);
  },
};