const BASE_PROJECTILE_SIZE = 6;
const DEFAULT_BULLET_SPREAD_DEG = 10;
const MIN_FIRE_RATE = 0.04; // Minimum time between shots in seconds

// Calculates damage scaling for multiple projectiles.
// Returns a multiplier (0.1 to 1) based on the number of projectiles.
const MULTIPLE_PROJECTILE_SCALLING = 0.6;
function getMultiProjectileDamageScale(numProjectiles) {
  if (numProjectiles <= 1) return 1; // Single projectile gets 100% damage.
  if (numProjectiles === 3) return MULTIPLE_PROJECTILE_SCALLING; // Baseline for 3 projectiles.

  // For every projectile beyond 3, damage is reduced.
  const extraProjectiles = numProjectiles - 3;
  // Floor at 10% to prevent damage from hitting zero or going negative.
  return Math.max(0.1, MULTIPLE_PROJECTILE_SCALLING - 0.05 * extraProjectiles);
}

export function setupPlayerShooting(k, player, gameState) {
  let canFire = true; // Controls the fire rate.
  const degToRad = (degrees) => (degrees * Math.PI) / 180;

  // Calculates a multiplier indicating if the player's current damage is buffed
  // compared to their base damage. Returns 1 if no base damage is found or is zero.
  const getDamageBuffMultiplier = () => {
    const baseDamage = player._baseStats?.damage;
    if (typeof baseDamage === "number" && baseDamage > 0) {
      return player.damage / baseDamage;
    }
    return 1; // No discernible buff/debuff or base damage is zero.
  };

  // Handles the logic for a single shot, including multiple projectiles.
  const fireProjectile = () => {
    // Determine the target direction based on mouse position.
    const mousePosition = k.mousePos();
    const targetDirectionX = mousePosition.x - player.pos.x;
    const targetDirectionY = mousePosition.y - player.pos.y;
    const baseShotAngleRad = Math.atan2(targetDirectionY, targetDirectionX);

    const damageBuffMultiplier = getDamageBuffMultiplier();
    const hasDamageBuff = Math.abs(damageBuffMultiplier - 1) > 0.0001; // Check if there's a significant damage buff.

    // Calculate projectile count, defaulting to 1.
    const numProjectiles = Math.max(1, Math.floor(player.projectiles || 1));

    // Determine total spread angle for multiple projectiles.
    const baseSpreadDegrees = player.bulletSpreadDeg ?? DEFAULT_BULLET_SPREAD_DEG;
    const totalSpreadDegrees =
      numProjectiles === 1 ? 0 : baseSpreadDegrees * Math.sqrt(numProjectiles);

    // Calculate individual angle offsets for each projectile to create the spread.
    const projectileAngleOffsetsDeg = [];
    if (numProjectiles === 1) {
      projectileAngleOffsetsDeg.push(0); // No offset for single projectile.
    } else {
      const angleStep = totalSpreadDegrees / (numProjectiles - 1);
      const startAngle = -totalSpreadDegrees / 2;
      for (let i = 0; i < numProjectiles; i++) {
        projectileAngleOffsetsDeg.push(startAngle + i * angleStep);
      }
    }

    // Perform a single critical hit roll for the entire volley of projectiles.
    const critChance = Math.max(0, Math.min(1, player.critChance || 0));
    const isCriticalHit = Math.random() < critChance;
    const critDamageMultiplier = isCriticalHit ? (player.critMultiplier ?? 2) : 1;

    // Calculate base damage for each individual projectile, considering multi-projectile penalty and crit.
    const multiProjectileDamageScale = getMultiProjectileDamageScale(numProjectiles);
    const damagePerProjectile = player.damage * critDamageMultiplier * multiProjectileDamageScale;

    // Calculate projectile size based on current damage vs. base damage and crit multiplier.
    // Damage buff no longer affects size, only color.
    const basePlayerDamage = player._baseStats?.damage || player.damage; // Use current damage if base not found
    const damageSizeMultiplier = player.damage / basePlayerDamage;
    const projectileSize = Math.max(
      2,
      BASE_PROJECTILE_SIZE * damageSizeMultiplier * critDamageMultiplier,
    );

    // Iterate through each projectile to create and launch it.
    for (const offsetDeg of projectileAngleOffsetsDeg) {
      const finalProjectileAngleRad = baseShotAngleRad + degToRad(offsetDeg);
      const projectileDirection = k.vec2(
        Math.cos(finalProjectileAngleRad),
        Math.sin(finalProjectileAngleRad),
      );

      // Determine projectile color: magenta for damage buff, red for critical, yellow otherwise.
      let projectileColor = hasDamageBuff ? k.rgb(255, 0, 255) : k.rgb(255, 255, 0);
      if (isCriticalHit) projectileColor = k.rgb(255, 0, 0);

      // Create and add the projectile to the game.
      const projectile = k.add([
        k.rect(projectileSize, projectileSize),
        k.color(projectileColor),
        k.pos(player.pos), // Projectile starts at player's position.
        k.area(),
        k.anchor("center"),
        k.offscreen({ destroy: true }), // Destroy projectile when it goes off-screen.
        "projectile", // Tag for collision detection.
        {
          velocity: projectileDirection.scale(player.bulletSpeed), // Store initial velocity.
          damage: damagePerProjectile,
          isCritical: isCriticalHit,
        },
      ]);

      // Update projectile position each frame.
      projectile.onUpdate(() => {
        if (!gameState.isPaused) {
          projectile.pos = projectile.pos.add(projectile.velocity.scale(k.dt()));
        }
      });
    }
  };

  // Attempts to fire a projectile, respecting the player's fire rate.
  const tryFire = () => {
    if (!canFire) return; // Cannot fire if on cooldown.

    fireProjectile(); // Execute the shot.
    canFire = false; // Set cooldown.

    // Calculate fire rate, ensuring it's not faster than MIN_FIRE_RATE.
    const fireRate = Math.max(MIN_FIRE_RATE, player.attackSpeed || 0.1);

    // Reset canFire after the cooldown period.
    k.wait(fireRate, () => {
      canFire = true;
    });
  };

  // Event listeners for mouse input to control player shooting state.
  k.onMouseDown(() => (player.isShooting = true));
  k.onMouseRelease(() => (player.isShooting = false));

  // Game update loop: check if player is shooting and game is not paused.
  k.onUpdate(() => {
    if (gameState.isPaused) return; // Do nothing if game is paused.
    if (player.isShooting) tryFire(); // Attempt to shoot if player is holding mouse down.
  });
}