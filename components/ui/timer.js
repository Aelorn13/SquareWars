const UI_LAYER = "ui";
const TIMER_LABEL_TAG = "timerLabel";
const TIMER_TEXT_SIZE = 20;
const Z_INDEX = 100;
const TIMER_LABEL_POSITION = { x: 20, y: 50 };
const MAX_DIFFICULTY_TEXT = "BOSS INCOMING!";
const TIME_LEFT_PREFIX = "Time left: ";

/**
 * Creates and initializes a timer label element in the game UI.
 * @param {number} totalTime The total time in seconds for the countdown.
 * @returns {KaboomGameObj} The created timer label game object.
 */
export function createTimerLabel(k, totalTime) {
  const timerLabel = k.add([
    k.text(`${TIME_LEFT_PREFIX}${totalTime}`, { size: TIMER_TEXT_SIZE }),
    k.pos(TIMER_LABEL_POSITION.x, TIMER_LABEL_POSITION.y),
    k.layer(UI_LAYER),
    k.fixed(),
    k.z(Z_INDEX),
    TIMER_LABEL_TAG,
    {
      timeLeft: totalTime,
    },
  ]);

  return timerLabel;
}

/**
 * Updates the timer label's display based on the elapsed time.
 * @param {KaboomGameObj} label The timer label game object to update.
 * @param {number} deltaTime The time elapsed since the last frame (delta time).
 */
export function updateTimerLabel(label, deltaTime) {
  if (label.timeLeft > 0) {
    label.timeLeft = Math.max(0, label.timeLeft - deltaTime);
    label.text = `${TIME_LEFT_PREFIX}${Math.ceil(label.timeLeft)}`;
  } else if (label.text !== MAX_DIFFICULTY_TEXT) {
    label.text = MAX_DIFFICULTY_TEXT;
  }
}