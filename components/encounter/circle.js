// src/components/encounter/circle.js
export function createEncounterCircle(k, position, chargeTime, onComplete, onCancel, player, gameState) {
  const encounter = k.add([
    k.pos(position),
    k.z(-25), 
    "encounterCircle",
    {
      charge: 0,
      maxCharge: chargeTime,
      radius: 75,
      isPlayerInside: false,
      update() {
        if (gameState.isPaused || gameState.upgradeOpen) {
          return; // Do not update charge if the game is paused
        }

        const distance = this.pos.dist(player.pos);
        this.isPlayerInside = distance <= this.radius;

        if (this.isPlayerInside) {
          // Player is inside, so we charge up
          this.charge = Math.min(this.maxCharge, this.charge + k.dt());
        } else {
          // Player is outside, so we drain the charge
          this.charge = Math.max(0, this.charge - k.dt() * 1.8); // Drains slightly faster than it charges
        }

        // Check for completion
        if (this.charge >= this.maxCharge) {
          onComplete();
          k.destroy(this);
        }
      },
      draw() {
        // Draw the dark grey "track" for the circle's line.
        k.drawCircle({
          pos: k.vec2(0, 0),
          radius: this.radius,
          fill: true,
           color: k.rgb(20, 20, 20),  // Matches the arena background
          outline: { color: k.rgb(80, 80, 80), width: 4 },
        });

        // Calculate and draw the progress arc line on top of the track.
        const progress = this.charge / this.maxCharge;
        if (progress > 0) {
          // We use deg2rad because JS's Math functions use radians.
          const endAngleRad = k.deg2rad(360 * progress);
          // The number of small lines we'll draw to approximate a smooth arc.
          const resolution = 60;
          const arcPoints = [];

          for (let i = 0; i <= resolution; i++) {
            // Calculate the angle for the current point.
            const currentAngle = (i / resolution) * endAngleRad;
            // Convert polar coordinates (angle, radius) to cartesian (x, y) and add to our list.
            arcPoints.push(
              k.vec2(
                Math.cos(currentAngle) * this.radius,
                Math.sin(currentAngle) * this.radius
              )
            );
          }

          // drawLines connects each point in the array to the next one, creating the arc.
          k.drawLines({
            pts: arcPoints,
            width: 4,
            color: k.rgb(255, 255, 255), // Bright white for the progress line
          });
        }
      },
    },
  ]);

  return encounter;
}