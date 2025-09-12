/**
 * @file Contains setup functions required for the boss fight, like global collision handlers.
 */

/**
 * Sets up global collision handlers and other scene-level logic for the boss.
 * This should be called ONCE when the game scene is initialized.
 * @param {object} k - The Kaboom.js context.
 * @param {object} gameContext - Shared game state and callbacks, like updateHealthBar.
 */
export function setupBossBehaviors(k, gameContext) {
  // Registers a global handler for player collision with boss bullets.
  k.onCollide("player", "bossBullet", (player, bullet) => {
      console.log(`Collision detected! Player invincible: ${player.isInvincible}`);
    if (player.isInvincible) return;

    player.hurt(bullet.damage ?? 1);
     k.shake(10);
    gameContext.updateHealthBar?.();
    k.destroy(bullet);
    if (player.hp() <= 0) {
      k.go("gameover");
    }
  });
}