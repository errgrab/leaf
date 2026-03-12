/**
 * plugins/identity.js
 *
 * Local user identity: name + color, stored in localStorage.
 * Sets awareness state so other peers can see cursor/name.
 */

const STORAGE_KEY = "leaf-identity";

export const PEER_COLORS = [
  "#e2b714", "#5cb8e4", "#c97bbd",
  "#56c99d", "#e07b54", "#e05471",
];

const SAMPLE_NAMES = [
  "united-states", "united-kingdom", "canada",
  "france", "germany", "spain",
  "italy",  "japan", "brazil", "russia"
];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function loadOrCreate() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored?.name) return stored;
  } catch {}
  const identity = { name: randomItem(SAMPLE_NAMES), color: randomItem(PEER_COLORS) };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  return identity;
}

function injectCursorStyles() {
  if (document.getElementById("leaf-cursors")) return;
  const style = document.createElement("style");
  style.id = "leaf-cursors";
  style.textContent = PEER_COLORS.map((c, i) => `
    .leaf-cursor-${i} .cm-ySelectionCaret { border-left-color:${c}!important; background:${c}!important }
    .leaf-cursor-${i} .cm-ySelectionInfo  { background:${c}!important; color:#111!important }
    .leaf-cursor-${i} .cm-ySelection      { background:${c}33!important }
  `).join("");
  document.head.appendChild(style);
}

export function identity(app) {
  const id = loadOrCreate();
  injectCursorStyles();

  app.sync.awareness.setLocalStateField("user", {
    name: id.name,
    color: id.color,
    colorIndex: PEER_COLORS.indexOf(id.color),
  });

  app.identity = id;
}