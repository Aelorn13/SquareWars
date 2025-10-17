import { createCircleEncounter } from "./circle.js";
// Import other encounters here in the future
// import { createSquareEncounter } from "./square.js"; 

export function createEncounterManager(k, player, gameContext) {
  let availableEncounters = [];
  let activeEncounter = null;
  
  let cooldown = k.rand(10, 15); // Initial cooldown
  const MIN_COOLDOWN = 10;
  const MAX_COOLDOWN = 30;

  // --- Private Methods ---

  function registerEncounters() {
    // We wrap the creation function to fit a standard format
    availableEncounters.push(() => createCircleEncounter(k, player, gameContext, onEncounterComplete));
    // When you create a new encounter, just add it here!
    // availableEncounters.push(() => createSquareEncounter(k, player, gameContext, onEncounterComplete));
  }
  
  function onEncounterComplete() {
    console.log(`Encounter "${activeEncounter.name}" completed.`);
    activeEncounter = null;
    cooldown = k.rand(MIN_COOLDOWN, MAX_COOLDOWN);
  }

  function startRandomEncounter() {
    if (activeEncounter || availableEncounters.length === 0) {
      return;
    }

    const encounterFactory = k.choose(availableEncounters);
    activeEncounter = encounterFactory();
    console.log(`Starting encounter: "${activeEncounter.name}"`);
    activeEncounter.start();
  }

  // --- Public Interface ---

  const manager = {
    // The main update function to be called from game.js
    update: (dt, currentGamePhase) => {
      // Don't run encounters during boss fights or menus
      const canRunEncounter = currentGamePhase === "PRE_BOSS" || currentGamePhase === "ENDLESS";

      if (!canRunEncounter) {
        if (activeEncounter && activeEncounter.cancel) {
          activeEncounter.cancel();
        }
        return;
      }
      
      if (activeEncounter) {
        // If the active encounter has its own logic loop, run it
        activeEncounter.update(dt);
      } else {
        // Otherwise, tick down the cooldown to the next one
        cooldown -= dt;
        if (cooldown <= 0) {
          startRandomEncounter();
        }
      }
    },
  };
  
  // Initialize the manager
  registerEncounters();

  return manager;
}