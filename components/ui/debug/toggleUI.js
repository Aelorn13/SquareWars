// components/ui/debug/toggleUI.js
// Creates the "Hide UI / Show UI" toggle button and manages hiding elements tagged "debugUI"
export function createDebugToggleButton(k, { debugPanelX, y, debugPanelWidth, debugUIBase = null, initialVisible = true, onToggle = null } = {}) {
  let visible = !!initialVisible;

  const button = k.add([
    k.rect(debugPanelWidth, 30),
    k.pos(debugPanelX, y),
    k.color(100, 100, 100),
    k.area(),
    k.fixed(),
    k.z(101),
  ]);
  const txt = button.add([
    k.text(visible ? "Hide UI" : "Show UI", { size: 14, font: "sans-serif" }),
    k.anchor("center"),
    k.pos(button.width / 2, button.height / 2),
    k.z(102),
  ]);

  function setVisible(v) {
    visible = !!v;
    // toggle everything tagged debugUI
    k.get("debugUI", { recursive: true }).forEach((el) => (el.hidden = !visible));
    if (debugUIBase) debugUIBase.hidden = !visible;
    txt.text = visible ? "Hide UI" : "Show UI";
    if (typeof onToggle === "function") onToggle(visible);
  }

  button.onClick(() => setVisible(!visible));

  return {
    toggleButton: button,
    toggleText: txt,
    isVisible: () => visible,
    setVisible,
  };
}
