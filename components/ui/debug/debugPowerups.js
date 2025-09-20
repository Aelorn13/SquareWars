// components/ui/dubug/debugPowerups.js
import { spawnPowerUp } from "../../powerup/spawnPowerup.js";
import { POWERUP_TYPES } from "../../powerup/powerupTypes.js";

/**
 * Spawns one of each power-up in the debug area and ensures they respawn when destroyed.
 * Keeps the original behaviour (respawn after 1s).
 */
export function spawnAllDebugPowerUps(k, ARENA, gameState) {
  const startX = ARENA.x + 50;
  const spawnY = ARENA.y + 50;
  const spacing = 40;

  Object.values(POWERUP_TYPES).forEach((type, index) => {
    const spawnPos = k.vec2(startX + index * spacing, spawnY);
    const createAndMonitorPowerup = (pos, powerupType) => {
      const powerup = spawnPowerUp(k, pos, powerupType, gameState);
      if (!powerup) return;
      powerup.onDestroy(() => {
        k.wait(1, () => createAndMonitorPowerup(pos, powerupType));
      });
    };
    createAndMonitorPowerup(spawnPos, type);
  });
}
