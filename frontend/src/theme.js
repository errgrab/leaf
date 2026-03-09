/**
 * theme.js
 *
 * Monkeytype-inspired themes: clean, centered, typographic.
 * Themes are just CSS variable sets — trivial to add new ones.
 * Stored in localStorage so it persists across sessions.
 */

export const THEMES = {
  dark: {
    "--bg": "#323437",
    "--bg-secondary": "#2c2e31",
    "--fg": "#d1d0c5",
    "--fg-dim": "#646669",
    "--accent": "#e2b714",
    "--accent-dim": "#a07d0e",
    "--error": "#ca4754",
    "--font-mono": "'Roboto Mono', 'Fira Code', monospace",
    "--font-size": "16px",
    "--line-height": "1.75",
    "--max-width": "720px",
  },
  light: {
    "--bg": "#f5f5f0",
    "--bg-secondary": "#e8e8e3",
    "--fg": "#323437",
    "--fg-dim": "#999995",
    "--accent": "#e2b714",
    "--accent-dim": "#a07d0e",
    "--error": "#ca4754",
    "--font-mono": "'Roboto Mono', 'Fira Code', monospace",
    "--font-size": "16px",
    "--line-height": "1.75",
    "--max-width": "720px",
  },
  sepia: {
    "--bg": "#1a1a15",
    "--bg-secondary": "#141410",
    "--fg": "#c8b99a",
    "--fg-dim": "#5c5648",
    "--accent": "#c9a85c",
    "--accent-dim": "#8a6f3a",
    "--error": "#ca4754",
    "--font-mono": "'Roboto Mono', 'Fira Code', monospace",
    "--font-size": "16px",
    "--line-height": "1.75",
    "--max-width": "720px",
  },
};

const STORAGE_KEY = "leaf-theme";

export function applyTheme(name) {
  const theme = THEMES[name] ?? THEMES.dark;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme)) root.style.setProperty(k, v);
  localStorage.setItem(STORAGE_KEY, name);
}

export function loadTheme() {
  applyTheme(localStorage.getItem(STORAGE_KEY) ?? "dark");
}

export function cycleTheme() {
  const names = Object.keys(THEMES);
  const current = localStorage.getItem(STORAGE_KEY) ?? "dark";
  const next = names[(names.indexOf(current) + 1) % names.length];
  applyTheme(next);
  return next;
}
