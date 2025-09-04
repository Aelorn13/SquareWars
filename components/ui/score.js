// --- Constants for UI elements ---
const SCORE_LABEL_TEXT_PREFIX = "Score: ";
const INITIAL_SCORE = 0;
const INITIAL_THRESHOLD = 10;
const SCORE_FONT_SIZE = 24;
const THRESHOLD_FONT_SIZE = 12;
const Z_INDEX = 100;
const SCORE_LABEL_POS_X = 20;
const SCORE_LABEL_POS_Y = 20;
const THRESHOLD_LABEL_POS_X = 150;
const THRESHOLD_LABEL_POS_Y = 28; // Adjusted for alignment with score label

/**
 * Creates and initializes the score and threshold UI labels.
 * These labels are fixed on the screen and belong to the "ui" layer.
 * @param {object} k - The Kaboom.js context object.
 * @returns {{scoreLabel: object, thresholdLabel: object}} An object containing the Kaboom game objects for the score and threshold labels.
 */
export function createScoreLabel(k) {
  // Main score display label
  const scoreLabel = k.add([
    k.text(`${SCORE_LABEL_TEXT_PREFIX}${INITIAL_SCORE}`, { size: SCORE_FONT_SIZE }),
    k.pos(SCORE_LABEL_POS_X, SCORE_LABEL_POS_Y),
    k.layer("ui"),
    k.fixed(), // Stays fixed relative to the camera
    k.z(Z_INDEX), // Ensures it's drawn on top of game elements
    "scoreLabel", // Tag 
  ]);

  // Smaller label for displaying the next score threshold
  const thresholdLabel = k.add([
    k.text(`/ ${INITIAL_THRESHOLD}`, { size: THRESHOLD_FONT_SIZE }),
    k.pos(THRESHOLD_LABEL_POS_X, THRESHOLD_LABEL_POS_Y),
    k.layer("ui"),
    k.fixed(), // Stays fixed relative to the camera
    k.z(Z_INDEX), // Ensures it's drawn on top
    "thresholdLabel", // Tag 
  ]);

  return { scoreLabel, thresholdLabel };
}

/**
 * Updates the text content of the score and threshold labels.
 * @param {{scoreLabel: object, thresholdLabel: object}} labels - The object containing the score and threshold Kaboom game objects,
 *                                                                as returned by `createScoreLabel`.
 * @param {number} score - The current score to display.
 * @param {number} nextThreshold - The score value for the next threshold.
 */
export function updateScoreLabel(labels, score, nextThreshold) {
  labels.scoreLabel.text = `${SCORE_LABEL_TEXT_PREFIX}${score}`;
  labels.thresholdLabel.text = `/ ${nextThreshold}`;
}