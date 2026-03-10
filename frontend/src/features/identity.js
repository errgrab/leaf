/**
 * features/identity.js
 *
 * User identity for collaboration.
 * Stores user name and color, injects cursor styles.
 */

const STORAGE_KEY = "leaf-identity";

export const PEER_COLORS = [
  "#e2b714",
  "#5cb8e4",
  "#c97bbd",
  "#56c99d",
  "#e07b54",
  "#e05471",
];

const NAMES = [
  "swift-fox",
  "quiet-owl",
  "bright-cat",
  "calm-wolf",
  "bold-bear",
  "sharp-hawk",
  "warm-deer",
  "cool-frog",
];

function randomName() {
  return NAMES[Math.floor(Math.random() * NAMES.length)];
}

/**
 * Load or create user identity.
 * @param {Object} app
 */
export function loadIdentity(app) {
  let identity;
  try {
    identity = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {}

  if (!identity?.name) {
    identity = {
      name: randomName(),
      color: PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  }

  // Inject cursor CSS for all peer colors
  if (!document.getElementById("leaf-cursors")) {
    const style = document.createElement("style");
    style.id = "leaf-cursors";
    style.textContent = PEER_COLORS.map((c, i) => `
      .leaf-cursor-${i} .cm-ySelectionCaret { border-left-color:${c}!important; background:${c}!important }
      .leaf-cursor-${i} .cm-ySelectionInfo  { background:${c}!important; color:#111!important }
      .leaf-cursor-${i} .cm-ySelection      { background:${c}33!important }
    `).join("");
    document.head.appendChild(style);
  }

  // Set awareness state if available
  if (app.awareness) {
    app.awareness.setLocalStateField("user", {
      name: identity.name,
      color: identity.color,
      colorIndex: PEER_COLORS.indexOf(identity.color),
    });
  }

  app.identity = identity;
}
