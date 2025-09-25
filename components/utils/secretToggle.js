// components/utils/secretToggle.js
export function makeSecretToggle(k, targetScene, keysPressed, opts = {}) {
  const COOLDOWN_MS = opts.cooldown ?? 1000;
  // id lets you have multiple independent toggles if needed
  const id = opts.id ?? "default";

  // persistent global state so scene switches don't reset locks
  const store = (window.__secretToggleState = window.__secretToggleState || {});
  store[id] = store[id] || { last: 0, prevActive: false };

  function isTypingInInput() {
    const el = document.activeElement;
    return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
  }

  return function checkSecretToggle() {
    const now = Date.now();
    // quick cooldown check
    if (now - store[id].last < COOLDOWN_MS) {
      // update prevActive so edge-detection stays correct while cooling down
      const ctrlOrMeta =
        !!keysPressed["ControlLeft"] ||
        !!keysPressed["ControlRight"] ||
        !!keysPressed["MetaLeft"] ||
        !!keysPressed["MetaRight"];
      const shift = !!keysPressed["ShiftLeft"] || !!keysPressed["ShiftRight"];
      const alt = !!keysPressed["AltLeft"] || !!keysPressed["AltRight"];
      const d = !!keysPressed["KeyD"];
      store[id].prevActive = !isTypingInInput() && ctrlOrMeta && shift && alt && d;
      return;
    }

    const ctrlOrMeta =
      !!keysPressed["ControlLeft"] ||
      !!keysPressed["ControlRight"] ||
      !!keysPressed["MetaLeft"] ||
      !!keysPressed["MetaRight"];
    const shift = !!keysPressed["ShiftLeft"] || !!keysPressed["ShiftRight"];
    const alt = !!keysPressed["AltLeft"] || !!keysPressed["AltRight"];
    const d = !!keysPressed["KeyD"];

    const keysArePressed = !isTypingInInput() && ctrlOrMeta && shift && alt && d;

    // Only trigger on the rising edge (not while key is held)
    if (keysArePressed && !store[id].prevActive) {
      store[id].last = now;
      store[id].prevActive = true;
      k.go(targetScene);
      return;
    }

    // update previous state for edge detection
    store[id].prevActive = keysArePressed;
  };
}
