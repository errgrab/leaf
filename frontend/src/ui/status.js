/**
 * ui/status.js
 *
 * Connection status dot — top right corner.
 * Green = connected, red = disconnected.
 */

export function statusIndicator(app) {
  const dot = document.createElement("div");
  dot.style.cssText =
    "position:fixed; top:12px; right:16px; width:6px; height:6px;" +
    "border-radius:50%; background:var(--fg-dim); transition:background .3s";
  document.body.appendChild(dot);

  if (app.sync) {
    app.sync.on("status", ({ connected }) => {
      dot.style.background = connected ? "var(--accent)" : "var(--error)";
    });
  }

  return dot;
}