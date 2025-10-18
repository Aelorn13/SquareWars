import { showEncounterFeedback } from "./circle.js";

export const tractorBeamsEncounter = {
  name: "Force Beams",
  isFinished: true,

  start(k, gameContext) {
    this.isFinished = false;
    const { player, sharedState: gameState } = gameContext;

    // --- Configuration ---
    const ENCOUNTER_DURATION = k.rand(15, 25);
    const BEAM_COUNT = k.randi(2, 4);
    const BEAM_WIDTH = 100;
    const BEAM_HEIGHT = 500;
    const BEAM_FORCE = 200;
    const ARROW_SPEED = 100;
    const ARROW_SPACING = 70;

    // --- Colors ---
    const PUSH_COLOR = k.rgb(255, 100, 100);
    const BACKGROUND_COLOR = k.rgb(20, 20, 20);
    const OUTLINE_COLOR = k.rgb(80, 80, 80);

    // --- State ---
    let encounterTimeLeft = ENCOUNTER_DURATION;
    let beams = [];
    let isEncounterOver = false;

    // --- Helper for drawing a chevron (arrow shape) ---
    const arrowShape = [k.vec2(-8, 5), k.vec2(0, -5), k.vec2(8, 5)];

    const endEncounter = () => {
      if (isEncounterOver) return;
      isEncounterOver = true;

      showEncounterFeedback(k, k.vec2(k.center().x, k.height() - 40), "Inertia Restored", k.rgb(200, 200, 200));

      beams.forEach((beam) => {
        k.tween(beam.opacity, 0, 0.5, (o) => (beam.opacity = o)).then(() => k.destroy(beam));
      });

      mainUpdate.cancel();
      this.isFinished = true;
    };

    // --- Beam Placement ---
    for (let i = 0; i < BEAM_COUNT; i++) {
      const angle = k.rand(0, 360);
      const forceAngleRad = k.deg2rad(angle - 90);

      const beam = k.add([
        k.pos(
          k.rand(gameState.area.x + 100, gameState.area.x + gameState.area.w - 100),
          k.rand(gameState.area.y + 100, gameState.area.y + gameState.area.h - 100)
        ),
        k.rotate(angle),
        k.opacity(0),
        k.anchor("center"),
        k.z(-20),
        "tractorBeam",
        {
          width: BEAM_WIDTH,
          height: BEAM_HEIGHT,
          forceDirection: k.vec2(Math.cos(forceAngleRad), Math.sin(forceAngleRad)),

          draw() {
            k.drawRect({
              pos: k.vec2(0, 0),
              width: this.width,
              height: this.height,
              anchor: "center",
              color: BACKGROUND_COLOR,
              opacity: 0.8 * this.opacity,
              outline: { color: OUTLINE_COLOR, width: 2 },
            });

            // Arrow Animation Logic (scrolling in the correct direction)
            const animationOffset = (-k.time() * ARROW_SPEED) % ARROW_SPACING;
             const halfArrowHeight = 5; 

            for (let x = -this.width / 2 + 25; x < this.width / 2; x += 50) {
              for (let y = animationOffset - this.height / 2; y < this.height / 2; y += ARROW_SPACING) {
                const arrowPos = k.vec2(x, y);

                if (
                  arrowPos.y - halfArrowHeight >= -this.height / 2 &&
                  arrowPos.y + halfArrowHeight <= this.height / 2
                ) {
                  k.drawLines({
                    pts: arrowShape.map((p) => p.add(arrowPos)),
                    color: PUSH_COLOR,
                    width: 2,
                    opacity: 0.8 * this.opacity,
                  });
                }
              }
            }
          },
        },
      ]);

      k.tween(beam.opacity, 1, 0.5, (o) => (beam.opacity = o));
      beams.push(beam);
    }

    // --- Main Update Loop for Timer and Force ---
    const mainUpdate = k.onUpdate(() => {
      if (isEncounterOver || gameState.isPaused || gameState.upgradeOpen) {
        return;
      }

      const calculateForceOn = (entity) => {
        let totalForce = k.vec2(0, 0);
        beams.forEach((beam) => {
          // Point-in-Rotated-Rectangle check
          const relativePos = entity.pos.sub(beam.pos);
          const angleRad = -k.deg2rad(beam.angle);
          const cosA = Math.cos(angleRad);
          const sinA = Math.sin(angleRad);
          const localX = relativePos.x * cosA - relativePos.y * sinA;
          const localY = relativePos.x * sinA + relativePos.y * cosA;

          if (Math.abs(localX) < beam.width / 2 && Math.abs(localY) < beam.height / 2) {
            totalForce = totalForce.add(beam.forceDirection.scale(BEAM_FORCE));
          }
        });
        return totalForce;
      };

      // Correctly apply force to player and enemies
      const playerForce = calculateForceOn(player);
      player.pos = player.pos.add(playerForce.scale(k.dt()));

      k.get("enemy").forEach((enemy) => {
        if (enemy.dead) return;
        const enemyForce = calculateForceOn(enemy);
        enemy.pos = enemy.pos.add(enemyForce.scale(k.dt()));
      });

      // --- Countdown timer ---
      encounterTimeLeft -= k.dt();
      if (encounterTimeLeft <= 0) {
        endEncounter();
      }
    });
  },
};
