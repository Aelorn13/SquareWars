/** components/enemy/boss/bossSetup.js
 * @file Contains setup functions required for the boss fight, like global collision handlers.
 */

/**
 * Sets up global collision handlers and other scene-level logic for the boss.
 * This should be called ONCE when the game scene is initialized.
 */
export function setupBossBehaviors(k, gameContext) {
  // Registers a global handler for player collision with boss bullets.
  k.onCollide("player", "bossBullet", (player, bullet) => {
    player.takeDamage(bullet.damage ?? 1);
    gameContext.updateHealthBar?.();
    k.destroy(bullet);
    if (player.hp() <= 0) {
      k.go("gameover");
    }
  });
}