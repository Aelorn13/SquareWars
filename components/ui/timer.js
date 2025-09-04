const UI_LAYER = "ui";
const TIMER_LABEL_TAG = "timerLabel";
const TIMER_TEXT_SIZE = 20;
const Z_INDEX = 100;
const TIMER_LABEL_POSITION = { x: 20, y: 50 };
const MAX_DIFFICULTY_TEXT = "BOSS INCOMING!";
const TIME_LEFT_PREFIX = "Time left: ";

/**
 * Calculates the initial total time based on spawn interval parameters.
 * @param {number} currentSpawnInterval The current interval at which objects are spawned.
 * @param {number} minSpawnInterval The minimum possible spawn interval (max difficulty).
 * @param {number} intervalDecrease The amount by which the spawn interval decreases over time.
 * @returns {number} The calculated total time in seconds.
 */
function calculateInitialTotalTime(currentSpawnInterval, minSpawnInterval, intervalDecrease) {
  // Calculates the total seconds remaining until the minimal spawn interval is reached.
  return Math.floor((currentSpawnInterval - minSpawnInterval) / intervalDecrease);
}

/**
 * Creates and initializes a timer label element in the game UI.
 * @param {KaboomCtx} k The Kaboom.js context object.
 * @param {number} spawnInterval The current interval at which objects are spawned.
 * @param {number} MINIMAL_SPAWN_INTERVAL The minimum possible spawn interval (max difficulty).
 * @param {number} INTERVAL_DECREASE The amount by which the spawn interval decreases over time.
 * @returns {KaboomGameObj} The created timer label game object.
 */
export function createTimerLabel(k, spawnInterval, MINIMAL_SPAWN_INTERVAL, INTERVAL_DECREASE) {
  // Calculate the total time remaining until max difficulty.
  const totalRemainingTime = calculateInitialTotalTime(
    spawnInterval,
    MINIMAL_SPAWN_INTERVAL,
    INTERVAL_DECREASE
  );

  // Add the timer label to the Kaboom scene with its initial properties.
  const timerLabel = k.add([
    k.text(`${TIME_LEFT_PREFIX}${totalRemainingTime}`, { size: TIMER_TEXT_SIZE }),
    k.pos(TIMER_LABEL_POSITION.x, TIMER_LABEL_POSITION.y),
    k.layer(UI_LAYER),
    k.fixed(), // Ensures the label stays in place relative to the camera.
    k.z(Z_INDEX), // Sets the Z-index to ensure it's rendered above other elements.
    TIMER_LABEL_TAG, // Tag for easy retrieval and manipulation of the label.
    {
      // Custom component to store and manage the time left.
      timeLeft: totalRemainingTime,
    },
  ]);

  return timerLabel;
}

/**
 * Updates the timer label's display based on the elapsed time and current game state.
 * @param {KaboomGameObj} label The timer label game object to update.
 * @param {number} deltaTime The time elapsed since the last frame (delta time).
 * @param {number} MINIMAL_SPAWN_INTERVAL The minimum possible spawn interval (max difficulty).
 * @param {number} INTERVAL_DECREASE The amount by which the spawn interval decreases over time.
 * @param {number} currentSpawnInterval The current interval at which objects are spawned.
 */
export function updateTimerLabel(
  label,
  deltaTime,
  MINIMAL_SPAWN_INTERVAL,
  INTERVAL_DECREASE,
  currentSpawnInterval
) {
  // Check if the game has not yet reached maximum difficulty.
  if (currentSpawnInterval > MINIMAL_SPAWN_INTERVAL) {
    // Decrease the remaining time, ensuring it doesn't go below zero.
    label.timeLeft = Math.max(0, label.timeLeft - deltaTime);
    // Update the displayed text with the rounded-up remaining time.
    label.text = `${TIME_LEFT_PREFIX}${Math.ceil(label.timeLeft)}`;
  } else {
    // If max difficulty is reached, display the corresponding message.
    label.text = MAX_DIFFICULTY_TEXT;
  }
}