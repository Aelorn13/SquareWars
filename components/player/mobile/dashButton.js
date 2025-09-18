// components/player/mobile/dashButton.js
// createDashButton(options) -> { getDash(), destroy() }
// getDash() returns boolean while touched (edge-detection done by central controls.js if needed)

export function createDashButton({
  container = document.body,
  size = 76,
  marginX = 24,
  marginY = 40,
  align = "right",
  sticky = true,
} = {}) {
  let pressed = false;
  const btn = document.createElement("div");

  const baseStyle = {
    position: "fixed",
    right: `${marginX}px`,
    bottom: `${marginY}px`,
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.14)",
    display: sticky ? "block" : "none",
    touchAction: "none",
    zIndex: 9999,
    pointerEvents: "auto",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    border: "2px solid rgba(255,255,255,0.06)",
  };

  // Conditionally set left or right based on the 'align' property
  if (align === "right") {
    baseStyle.right = `${marginX}px`;
  } else {
    baseStyle.left = `${marginX}px`;
  }

  Object.assign(btn.style, baseStyle);
  // optional inner glyph
  const label = document.createElement("div");
  label.textContent = "⇢"; // dash glyph
  Object.assign(label.style, {
    fontSize: `${size * 0.45}px`,
    lineHeight: "1",
    textAlign: "center",
    width: "100%",
    transform: "translateY(-6%)",
    userSelect: "none",
    pointerEvents: "none",
  });

  btn.appendChild(label);
  container.appendChild(btn);

  function onPointerDown(e) {
    pressed = true;
    btn.style.background = "rgba(255,255,255,0.26)";
    btn.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }
  function onPointerUp(e) {
    pressed = false;
    btn.style.background = "rgba(255,255,255,0.14)";
    try {
      btn.releasePointerCapture(e.pointerId);
    } catch {}
  }

  btn.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  btn.addEventListener("pointercancel", onPointerUp);

  return {
    getDash() {
      return !!pressed;
    },
    destroy() {
      btn.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      btn.removeEventListener("pointercancel", onPointerUp);
      if (container && container.contains(btn)) {
        container.removeChild(btn);
      }
    },
  };
}
