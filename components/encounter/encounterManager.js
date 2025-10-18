import { circleEncounter } from "./circle.js";
import { goldenSquareEncounter } from "./goldenSquare.js";
import { spotlightEncounter } from "./spotlight.js";
import { sequenceEncounter } from "./sequence.js"; 
import { tractorBeamsEncounter } from "./tractorBeams.js"; 
export function createEncounterManager(k, gameContext) {
  const availableEncounters = [
    circleEncounter, goldenSquareEncounter,
    spotlightEncounter, 
     sequenceEncounter,
     tractorBeamsEncounter
  ];

  const manager = {
    // --- State ---
    isEncounterActive: false,
    activeEncounter: null,
    cooldown: k.rand(8, 12), // Initial cooldown before the first encounter

    // --- Configuration ---
    MIN_COOLDOWN: 10,
    MAX_COOLDOWN: 25,

    // --- The main update loop to be called from game.js ---
    update(dt) {
      const { sharedState, getCurrentGamePhase } = gameContext;
      const gamePhase = getCurrentGamePhase();

      // Don't run encounters during the boss fight or while paused.
      const canRunEncounter = gamePhase === "PRE_BOSS" || gamePhase === "ENDLESS";
      if (!canRunEncounter || sharedState.isPaused || sharedState.upgradeOpen) {
        return;
      }

      if (this.isEncounterActive) {
        // An encounter is running. Check if it has finished.
        if (this.activeEncounter.isFinished) {
          console.log(`Encounter '${this.activeEncounter.name}' finished.`);
          this.isEncounterActive = false;
          this.activeEncounter = null;
          // Set a new cooldown for the next one
          this.cooldown = k.rand(this.MIN_COOLDOWN, this.MAX_COOLDOWN);
        }
      } else {
        // No encounter is active. Tick down the cooldown.
        this.cooldown -= dt;

        if (this.cooldown <= 0) {
          // Time to start a new encounter!
          this.startRandomEncounter();
        }
      }
    },

    startRandomEncounter() {
      // Choose a random encounter from our list
      const encounterBlueprint = k.choose(availableEncounters);

      console.log(`Starting encounter: '${encounterBlueprint.name}'`);

      // Set the manager's state
      this.isEncounterActive = true;
      this.activeEncounter = encounterBlueprint;

      // Kick off the encounter by calling its start method
      this.activeEncounter.start(k, gameContext);
    },
  };

  return manager;
}
