import { showEncounterFeedback } from "./circle.js";

export const sequenceEncounter = {
  name: "Sequence Puzzle",
  isFinished: true,

  start(k, gameContext) {
    this.isFinished = false;
    const { player, increaseScore, sharedState: gameState } = gameContext;

    function getHexagonPoints(size) {
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle = k.deg2rad(60 * i - 30);
            points.push(k.vec2(Math.cos(angle) * size, Math.sin(angle) * size));
        }
        return points;
    }

    // --- Configuration ---
    const ENCOUNTER_DURATION = 40;
    const PILLAR_COUNT = k.randi(4, 8);
    const PILLAR_SIZE = 25;
    const MIN_DISTANCE_BETWEEN_PILLARS = 150;
    const BASE_SCORE_REWARD = 10;
    const TIME_SCORE_MODIFIER = 0.33;

    const rewardMultiplier = 1 + Math.max(0, PILLAR_COUNT - 4) * 0.25;

    // --- Colors ---
    const COLOR_DEFAULT = k.rgb(100, 100, 100);
    const COLOR_SOLVED = k.rgb(0, 200, 0);
    const COLOR_SUCCESS_BLINK = k.rgb(150, 255, 150);
    const COLOR_FAIL_BLINK = k.rgb(255, 100, 100);

    // --- State ---
    let encounterTimeLeft = ENCOUNTER_DURATION;
    let pillars = [];
    let correctSequence = [];
    let currentStep = 0;
    let isEncounterOver = false;

    // --- Helper function for visual feedback ---
    function blink(gameObject, blinkColor, finalColor) {
        const originalColor = gameObject.color.clone();
        k.tween(gameObject.color, blinkColor, 0.1, (c) => gameObject.color = c, k.easings.linear)
         .then(() => {
             k.tween(gameObject.color, originalColor, 0.1, (c) => gameObject.color = c, k.easings.linear)
              .then(() => {
                  gameObject.color = finalColor;
              });
         });
    }
    
    // --- Helper for the success particle explosion ---
    function spawnSuccessParticles(pos) {
        for (let i = 0; i < 30; i++) {
            const angle = k.rand(0, 360);
            const speed = k.rand(120, 300);
            const life = k.rand(0.5, 1.2);
            k.add([
                k.pos(pos),
                k.circle(k.rand(2, 5)),
                k.color(k.choose([COLOR_SOLVED, k.rgb(255,255,0)])),
                k.opacity(1),
                k.lifespan(life, { fade: 0.5 }),
                k.move(angle, speed),
                k.z(50),
            ]);
        }
    }

    const endEncounter = (didSucceed) => {
        if (isEncounterOver) return;
        isEncounterOver = true;

        if (didSucceed) {
            const timeBonus = Math.floor(gameState.elapsedTime * TIME_SCORE_MODIFIER);
            const scaledBaseReward = BASE_SCORE_REWARD * rewardMultiplier;
            const totalReward = Math.floor(scaledBaseReward + timeBonus);
            increaseScore(totalReward);
            showEncounterFeedback(k, k.vec2(k.center().x, k.height() - 40), `+${totalReward} Score!`, COLOR_SOLVED);
        } else {
             showEncounterFeedback(k, k.vec2(k.center().x, k.height() - 40), "Time's Up!", COLOR_FAIL_BLINK);
        }

        pillars.forEach(p => k.destroy(p));
        mainUpdate.cancel();
        this.isFinished = true;
    };

    // --- Pillar Placement Logic ---
    let pillarPositions = [];
    let attempts = 0;
    while (pillarPositions.length < PILLAR_COUNT && attempts < 200) {
        attempts++;
        const candidatePos = k.vec2(
            k.rand(gameState.area.x + 50, gameState.area.x + gameState.area.w - 50),
            k.rand(gameState.area.y + 50, gameState.area.y + gameState.area.h - 50)
        );
        let isValid = true;
        for (const pos of pillarPositions) {
            if (candidatePos.dist(pos) < MIN_DISTANCE_BETWEEN_PILLARS) {
                isValid = false;
                break;
            }
        }
        if (isValid) {
            pillarPositions.push(candidatePos);
        }
    }

    // --- Create Pillar Game Objects ---
    for (const pos of pillarPositions) {
        const pillar = k.add([
            k.pos(pos),
            k.polygon(getHexagonPoints(PILLAR_SIZE)),
            k.color(COLOR_DEFAULT),
            k.area(),
            k.body({ isStatic: true }), 
            k.anchor("center"),
            k.z(-10),
            "sequencePillar",
            { isSolved: false },
        ]);

        pillar.onCollide("projectile", (proj) => {
            if (isEncounterOver || pillar.isSolved || gameState.isPaused || gameState.upgradeOpen) return;
            k.destroy(proj);

            if (pillar.id === correctSequence[currentStep]) {
                pillar.isSolved = true;
                blink(pillar, COLOR_SUCCESS_BLINK, COLOR_SOLVED);
                currentStep++;

                if (currentStep >= correctSequence.length) {
                    spawnSuccessParticles(pillar.pos);
                    endEncounter(true);
                }
            } else {
                currentStep = 0;
                pillars.forEach(p => {
                    if (p.isSolved) {
                        p.isSolved = false;
                        blink(p, COLOR_FAIL_BLINK, COLOR_DEFAULT);
                    }
                });
            }
        });
        pillars.push(pillar);
    }
    
    correctSequence = k.shuffle(pillars.slice()).map(p => p.id);

    // --- Main Update Loop for the Timer ---
    const mainUpdate = k.onUpdate(() => {
        if (isEncounterOver || gameState.isPaused || gameState.upgradeOpen) {
            return;
        }
        encounterTimeLeft -= k.dt();
        if (encounterTimeLeft <= 0) {
            endEncounter(false);
        }
    });
  },
};