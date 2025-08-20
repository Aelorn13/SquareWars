// components/ui/score.js
export function createScoreLabel(k) {
  const scoreLabel = k.add([
    k.text("Score: 0", { size: 24 }),
    k.pos(20, 20),
    k.layer("ui"),
    k.fixed(),
    k.z(100),
    "scoreLabel",
  ]);

  // smaller label for the "/ nextThreshold"
  const thresholdLabel = k.add([
    k.text("/ 10", { size: 12 }),
    k.pos(150, 28), // tweak if you need different spacing
    k.layer("ui"),
    k.fixed(),
    k.z(100),
    "thresholdLabel",
  ]);

  return { scoreLabel, thresholdLabel };
}

export function updateScoreLabel(labels, score, nextThreshold) {
  // labels is the object returned from createScoreLabel
  labels.scoreLabel.text = `Score: ${score}`;
  labels.thresholdLabel.text = `/ ${nextThreshold}`;
}
