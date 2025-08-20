// components/ui/timer.js
export function createTimerLabel(k, spawnInterval, MINIMAL_SPAWN_INTERVAL, INTERVAL_DECREASE) {
  const totalSeconds = Math.floor((spawnInterval - MINIMAL_SPAWN_INTERVAL) / INTERVAL_DECREASE);
  const label = k.add([
    k.text(`Time left: ${totalSeconds}`, { size: 20 }),
    k.pos(20, 50),
    k.layer("ui"),
    k.fixed(),
    k.z(100),
    "timerLabel",
    { timeLeft: totalSeconds },
  ]);
  return label;
}

export function updateTimerLabel(label, delta, MINIMAL_SPAWN_INTERVAL, INTERVAL_DECREASE, spawnInterval) {
  if (spawnInterval > MINIMAL_SPAWN_INTERVAL) {
    label.timeLeft = Math.max(0, label.timeLeft - delta);
    label.text = `Time left: ${Math.ceil(label.timeLeft)}`;
  } else {
    label.text = "Max Difficulty!";
  }
}
