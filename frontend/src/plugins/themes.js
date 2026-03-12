/**
 * plugins/themes.js
 *
 * Manages color themes. Stores preference in localStorage.
 * Registers a /theme command on app.
 */

const STORAGE_KEY = "leaf-theme";

const THEMES = {
  leaf: {
    "--bg": "#0e0c0a", "--bg-secondary": "#131008",
    "--fg": "#b5a98a", "--fg-dim": "#4a3f2e",
    "--accent": "#7a9e6e", "--accent-dim": "#4d6b42",
    "--error": "#b85c4a",
    "--font-mono": "'Roboto Mono', 'Fira Code', monospace",
    "--font-size": "16px", "--line-height": "1.75", "--max-width": "720px",
  },
  dark: {
    "--bg": "#323437", "--bg-secondary": "#2c2e31",
    "--fg": "#d1d0c5", "--fg-dim": "#646669",
    "--accent": "#e2b714", "--accent-dim": "#a07d0e",
    "--error": "#ca4754",
    "--font-mono": "'Roboto Mono', monospace",
    "--font-size": "16px", "--line-height": "1.75", "--max-width": "720px",
  },
  light: {
    "--bg": "#f5f5f0", "--bg-secondary": "#e8e8e3",
    "--fg": "#323437", "--fg-dim": "#999995",
    "--accent": "#4a90d9", "--accent-dim": "#2f6aa8",
    "--error": "#ca4754",
    "--font-mono": "'Roboto Mono', monospace",
    "--font-size": "16px", "--line-height": "1.75", "--max-width": "720px",
  },
  nord: {
    "--bg": "#2e3440", "--bg-secondary": "#272c36",
    "--fg": "#d8dee9", "--fg-dim": "#4c566a",
    "--accent": "#88c0d0", "--accent-dim": "#5a8a96",
    "--error": "#bf616a",
    "--font-mono": "'Roboto Mono', monospace",
    "--font-size": "16px", "--line-height": "1.75", "--max-width": "720px",
  },
};

function applyTheme(name) {
  const t = THEMES[name] ?? THEMES.leaf;
  for (const [k, v] of Object.entries(t))
    document.documentElement.style.setProperty(k, v);
  localStorage.setItem(STORAGE_KEY, name);
}

function cycleTheme() {
  const keys    = Object.keys(THEMES);
  const current = localStorage.getItem(STORAGE_KEY) ?? "leaf";
  applyTheme(keys[(keys.indexOf(current) + 1) % keys.length]);
}

export function themes(app) {
  applyTheme(localStorage.getItem(STORAGE_KEY) ?? "leaf");

  app.addCommand({
    label: "/theme",
    detail: () => Object.keys(THEMES).join(", "),
    run: () => cycleTheme(),
  });
}