// components/utils/secretToggle.js
export function makeSecretToggle(k, targetScene, keysPressed) {
  let wasPressed = false;

  function isTypingInInput() {
    const el = document.activeElement;
    return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
  }

  return function checkSecretToggle() {
    const ctrlOrMeta =
      !!keysPressed["ControlLeft"] ||
      !!keysPressed["ControlRight"] ||
      !!keysPressed["MetaLeft"] ||
      !!keysPressed["MetaRight"];
    const shift = !!keysPressed["ShiftLeft"] || !!keysPressed["ShiftRight"];
    const alt = !!keysPressed["AltLeft"] || !!keysPressed["AltRight"];
    const d = !!keysPressed["KeyD"];

    if (!isTypingInInput() && ctrlOrMeta && shift && alt && d) {
      if (!wasPressed) {
        k.go(targetScene);
      }
      wasPressed = true;
    } else {
      wasPressed = false;
    }
  };
}
