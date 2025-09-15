// components/player/controls.js

export const keysPressed = {};
export const mobileControls = {
  movement: { x: 0, y: 0 },
  shooting: { x: 0, y: 0, active: false },
  dash: false,
};

export function initControls(k, isMobile) {
  if (window._controlsInitialized) return;
  window._controlsInitialized = true;

  if (isMobile) {
    createMobileControls(k);
  } else {
    // PC keyboard controls
    window.addEventListener("keydown", (e) => { keysPressed[e.code] = true; });
    window.addEventListener("keyup", (e) => { keysPressed[e.code] = false; });
  }
}

function createMobileControls(k) {
    const JOYSTICK_BASE_RADIUS = 70;
    const JOYSTICK_KNOB_RADIUS = 35;
  
    // --- UI Elements ---
    const moveStickBase = k.add([ k.pos(120, k.height() - 200), k.circle(JOYSTICK_BASE_RADIUS), k.color(128, 128, 128), k.opacity(0.5), k.fixed(), k.z(100), k.stay(), "joystick-base" ]);
    const moveStickKnob = k.add([ k.pos(moveStickBase.pos), k.circle(JOYSTICK_KNOB_RADIUS), k.color(200, 200, 200), k.opacity(0.7), k.fixed(), k.z(101), k.stay(), "joystick-knob" ]);
    const fireStickBase = k.add([ k.pos(k.width() - 120, k.height() - 200), k.circle(JOYSTICK_BASE_RADIUS), k.color(128, 128, 128), k.opacity(0.5), k.fixed(), k.z(100), k.stay(), "joystick-base" ]);
    const fireStickKnob = k.add([ k.pos(fireStickBase.pos), k.circle(JOYSTICK_KNOB_RADIUS), k.color(200, 200, 200), k.opacity(0.7), k.fixed(), k.z(101), k.stay(), "joystick-knob" ]);
    const dashButton = k.add([ k.pos(k.width() - 120, k.height() - 400), k.circle(50), k.color(255, 0, 0), k.opacity(0.5), k.fixed(), k.z(100), k.area(), k.stay(), "dash-button" ]);

    // --- State & Logic ---
    let moveStickActive = false;
    let fireStickActive = false;

    k.onMouseDown((mouseBtn) => {
        const mousePos = k.mousePos();
        // Check if we're starting a drag on the movement stick
        if (!moveStickActive && moveStickBase.pos.dist(mousePos) < JOYSTICK_BASE_RADIUS * 1.5) {
            moveStickActive = true;
        } 
        // Check if we're starting a drag on the fire stick
        else if (!fireStickActive && fireStickBase.pos.dist(mousePos) < JOYSTICK_BASE_RADIUS * 1.5) {
            fireStickActive = true;
            mobileControls.shooting.active = true;
        } 
        // Check for a press on the dash button
        else if (dashButton.hasPoint(mousePos)) {
            mobileControls.dash = true;
            dashButton.opacity = 0.9;
        }
    });

    k.onMouseMove((mousePos) => {
        // Only handle joystick movement if the corresponding stick is active
        if (moveStickActive) {
            handleJoystick(mousePos, moveStickBase, moveStickKnob, mobileControls.movement);
        } else if (fireStickActive) {
            handleJoystick(mousePos, fireStickBase, fireStickKnob, mobileControls.shooting);
        }
    });

    // FIXED: The correct function name is onMouseRelease, not onMouseUp
    k.onMouseRelease(() => {
        // Deactivate and reset movement stick
        if (moveStickActive) {
            moveStickActive = false;
            resetJoystick(moveStickBase, moveStickKnob, mobileControls.movement);
        }
        // Deactivate and reset fire stick
        if (fireStickActive) {
            fireStickActive = false;
            resetJoystick(fireStickBase, fireStickKnob, mobileControls.shooting);
            mobileControls.shooting.active = false;
        }
        // Always reset dash button state on release
        mobileControls.dash = false;
        dashButton.opacity = 0.5;
    });

    function handleJoystick(touchPos, base, knob, controlState) {
        const diff = touchPos.sub(base.pos);
        let dist = diff.len();
        
        if (dist > JOYSTICK_BASE_RADIUS) {
            knob.pos = base.pos.add(diff.unit().scale(JOYSTICK_BASE_RADIUS));
        } else {
            knob.pos = touchPos;
        }
        
        if (dist > 0) {
            const dir = diff.unit();
            controlState.x = dir.x;
            controlState.y = dir.y;
        }
    }

    function resetJoystick(base, knob, controlState) {
        knob.pos = base.pos;
        controlState.x = 0;
        controlState.y = 0;
    }
}