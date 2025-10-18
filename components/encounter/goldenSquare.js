// components/encounter/goldenSquare.js

import { spawnPowerUp } from "../powerup/spawnPowerup.js";
import { POWERUP_TYPES } from "../powerup/powerupTypes.js";
import { createEnemyGameObject, handleProjectileCollision, lerpAngle } from "../enemy/enemyBehavior.js";

export const goldenSquareEncounter = {
  name: "Golden Square",
  isFinished: true,

  start(k, gameContext) {
    this.isFinished = false;
    const { player, increaseScore, sharedState: gameState } = gameContext;

    // --- Balance Changes Applied ---
    const BASE_HP = 15;
    const BASE_SPEED = 120;
    const HP_SCALING_PER_SECOND = 35 / 120;
    const SPEED_SCALING_PER_SECOND = 120 / 120;

    const scaledHp = Math.floor(BASE_HP + (gameState.elapsedTime * HP_SCALING_PER_SECOND));
    const scaledSpeed = Math.floor(BASE_SPEED + (gameState.elapsedTime * SPEED_SCALING_PER_SECOND));

    const config = {
      name: "goldenSquare", maxHp: scaledHp, speed: scaledSpeed,
      damage: 0, score: 10, size: 32, color: [255, 215, 0], hasBody: false,
    };

    const startPos = k.vec2(
      k.rand(gameState.area.x + 50, gameState.area.x + gameState.area.w - 50),
      k.rand(gameState.area.y + 50, gameState.area.y + gameState.area.h - 50)
    );
    const treasureSquare = createEnemyGameObject(k, player, config, startPos, gameContext);

    // --- Add custom properties ---
    treasureSquare.lifespan = 30;
    treasureSquare.fadeTime = 5;
    treasureSquare.direction = k.Vec2.fromAngle(k.rand(0, 360));
    treasureSquare.changeDirTimer = 2;
    treasureSquare.shineTimer = 0.15;
    // Properties for our manual death animation
    treasureSquare.isDying = false;
    treasureSquare.deathAnimTimer = 0;

    // Spawn animation
    treasureSquare.scale = k.vec2(0); 
    k.tween(treasureSquare.scale, k.vec2(1), 0.4, (s) => (treasureSquare.scale = s), k.easings.easeOutBack);

    // --- Main Update Loop ---
    treasureSquare.onUpdate(() => {
      if (treasureSquare.isDying) {
        treasureSquare.deathAnimTimer -= k.dt();
        const duration = 0.3;
        // Calculate raw progress (from 0 to 1)
        let progress = 1 - (treasureSquare.deathAnimTimer / duration);
        progress = Math.min(1, Math.max(0, progress)); // Clamp it

        // Apply an easing function to the progress
        const easedProgress = k.easings.easeInQuad(progress);

        treasureSquare.scale = k.lerp(treasureSquare.startScale, k.vec2(0), easedProgress);
        treasureSquare.angle = k.lerp(treasureSquare.startAngle, treasureSquare.startAngle + 270, easedProgress);

        if (treasureSquare.deathAnimTimer <= 0) {
          k.destroy(treasureSquare);
        }
        return; // Stop all other logic while dying
      }

      if (gameState.isPaused || gameState.upgradeOpen || treasureSquare.dead || treasureSquare._isStunned) return;
      
      const dt = k.dt();
      const targetAngle = treasureSquare.direction.angle() + 90;
      treasureSquare.angle = lerpAngle(treasureSquare.angle, targetAngle, dt * 8);

      treasureSquare.lifespan -= dt;
      if (treasureSquare.lifespan <= treasureSquare.fadeTime) treasureSquare.opacity = treasureSquare.lifespan / treasureSquare.fadeTime;
      if (treasureSquare.lifespan <= 0) k.destroy(treasureSquare);

      treasureSquare.changeDirTimer -= dt;
      if (treasureSquare.changeDirTimer <= 0) {
        treasureSquare.direction = k.Vec2.fromAngle(k.rand(0, 360));
        treasureSquare.changeDirTimer = k.rand(1.5, 3);
      }
      treasureSquare.move(treasureSquare.direction.scale(treasureSquare.speed));

      // Robust boundary collision
      const { x, y, w, h } = gameState.area;
      if (treasureSquare.pos.x < x) { treasureSquare.pos.x = x; treasureSquare.direction.x = Math.abs(treasureSquare.direction.x); treasureSquare.changeDirTimer = 0; }
      else if (treasureSquare.pos.x > x + w) { treasureSquare.pos.x = x + w; treasureSquare.direction.x = -Math.abs(treasureSquare.direction.x); treasureSquare.changeDirTimer = 0; }
      if (treasureSquare.pos.y < y) { treasureSquare.pos.y = y; treasureSquare.direction.y = Math.abs(treasureSquare.direction.y); treasureSquare.changeDirTimer = 0; }
      else if (treasureSquare.pos.y > y + h) { treasureSquare.pos.y = y + h; treasureSquare.direction.y = -Math.abs(treasureSquare.direction.y); treasureSquare.changeDirTimer = 0; }
        
      treasureSquare.shineTimer -= dt;
      if (treasureSquare.shineTimer <= 0) {
          const shineAngle = k.rand(0, 360);
          const shinePos = treasureSquare.pos.add(k.Vec2.fromAngle(shineAngle).scale(k.rand(5, 15)));
          k.add([ k.pos(shinePos), k.rect(k.rand(2, 4), k.rand(2, 4)), k.color(255, 255, 150), k.opacity(0.8), k.lifespan(0.3, { fade: 0.2 }), k.anchor("center") ]);
          treasureSquare.shineTimer = k.rand(0.1, 0.25);
      }
    });

        treasureSquare.onDraw(() => {
      // We manually apply the object's rotation and scale. This ensures the outline
      // spins and shrinks correctly during the death animation.
      k.pushTransform();
      k.pushRotate(treasureSquare.angle);
      k.pushScale(treasureSquare.scale);
      
      k.drawRect({
          width: treasureSquare.width,
          height: treasureSquare.height,
          anchor: "center",
          fill: false, 
          opacity: treasureSquare.opacity,
          outline: {
              color: k.rgb(255, 255, 150), // A bright, shiny yellow
              // This makes the outline's width "breathe" in and out, creating a pulse effect.
              width: k.wave(1, 3, k.time() * 6), 
          },
      });

      k.popTransform();
    });
    
    treasureSquare.onCollide("projectile", (proj) => {
        handleProjectileCollision(k, treasureSquare, proj);
    });

    // --- DEATH LOGIC ---
    treasureSquare.die = () => {
        if (treasureSquare.dead) return;
        treasureSquare.dead = true;
        treasureSquare.area.enabled = false;

        increaseScore(treasureSquare.score);
        spawnPowerUp(k, treasureSquare.pos, POWERUP_TYPES.HEAL, gameState);
        const availablePowerups = Object.values(POWERUP_TYPES).filter(type => type !== POWERUP_TYPES.HEAL);
        spawnPowerUp(k, treasureSquare.pos, k.choose(availablePowerups), gameState);
        
        treasureSquare.isDying = true;
        treasureSquare.deathAnimTimer = 0.3; // Animation duration
        treasureSquare.startScale = treasureSquare.scale.clone();
        treasureSquare.startAngle = treasureSquare.angle;
    };

    treasureSquare.onDestroy(() => {
      this.isFinished = true;
    });
  },
};