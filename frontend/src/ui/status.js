/**
 * ui/status.js
 *
 * Sync status indicator UI.
 * Shows a colored dot indicating connection status.
 */

/**
 * Create a sync status indicator.
 * @param {Object} app
 * @returns {HTMLElement} The status dot element
 */
export function createSyncStatus(app) {
  const dot = document.createElement("div");
  dot.style.cssText =
    "position:fixed;top: 12px; right: 16px; width: 6px; height: 6px; border-radius: 50%; background: var(--fg-dim); transition:background .3s";
  document.body.appendChild(dot);

  if (app.sync) {
    app.sync.on("status", ({ connected }) => {
      dot.style.background = connected ? "var(--accent)" : "var(--error)";
    });
  }

  return dot;
}
