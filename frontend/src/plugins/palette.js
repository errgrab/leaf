/**
 * plugins/palette.js
 *
 * Command palette — triggered by typing "/" at line start or after whitespace.
 * Export: paletteExtension(app) → CodeMirror extensions[]
 *
 * Reads commands from app.getCommands() at trigger time, so commands registered
 * after the editor starts still appear.
 */

import { EditorView, keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";

// ---------------------------------------------------------------------------
// Dropdown state — one palette per page
// ---------------------------------------------------------------------------

let el       = null;
let sel      = 0;
let items    = [];
let onSelect = null;
let isOpen   = false;

function ensureEl() {
  if (el) return;
  el = document.createElement("div");
  Object.assign(el.style, {
    position: "fixed", zIndex: "1000",
    background: "var(--bg-secondary)", border: "1px solid var(--fg-dim)",
    borderRadius: "6px", padding: "4px 0",
    minWidth: "240px", maxHeight: "260px", overflowY: "auto",
    fontFamily: "var(--font-mono)", fontSize: "13px",
    boxShadow: "0 4px 16px rgba(0,0,0,.4)", display: "none",
  });
  document.body.appendChild(el);
  document.addEventListener("mousedown", (e) => {
    if (!el.contains(e.target)) close();
  });
}

function render() {
  el.innerHTML = "";
  items.forEach((item, i) => {
    const row = document.createElement("div");
    const lbl = document.createElement("span");
    const det = document.createElement("span");
    Object.assign(row.style, {
      padding: "7px 14px", cursor: "pointer",
      display: "flex", justifyContent: "space-between", gap: "16px",
    });
    lbl.textContent = item.label;
    det.textContent = typeof item.detail === "function" ? item.detail() : (item.detail ?? "");
    det.style.cssText = "color:var(--fg-dim); font-size:11px";
    row.append(lbl, det);
    row.addEventListener("mouseenter", () => highlight(i));
    row.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); confirm(); });
    el.appendChild(row);
  });
  highlight(0);
}

function highlight(i) {
  if (!items.length) return;
  sel = (i + items.length) % items.length;
  Array.from(el.children).forEach((row, j) => {
    const on = j === sel;
    row.style.background = on ? "var(--accent)" : "";
    row.style.color      = on ? "var(--bg)"     : "var(--fg)";
    const det = row.querySelector("span:last-child");
    if (det) det.style.color = on ? "var(--bg)" : "var(--fg-dim)";
  });
}

function open({ x, y, cursorTop, matched, view, deleteFrom }) {
  if (!matched.length) return;
  ensureEl();
  items    = matched;
  isOpen   = true;
  onSelect = (item) => {
    view.dispatch({
      changes: { from: deleteFrom, to: view.state.selection.main.from, insert: "" },
    });
    item.run(view);
  };
  render();
  el.style.display = "block";
  const left = Math.min(x, window.innerWidth - 260);
  const h    = el.offsetHeight;
  const top  = y + 4 + h > window.innerHeight ? cursorTop - h - 4 : y + 4;
  Object.assign(el.style, { left: `${left}px`, top: `${top}px` });
}

function close() {
  if (el) el.style.display = "none";
  items = []; isOpen = false; onSelect = null;
}

function confirm() {
  if (!isOpen || !items.length) return false;
  const item = items[sel];
  const cb   = onSelect;
  close();
  if (cb && item) cb(item);
  return true;
}

// ---------------------------------------------------------------------------
// Trigger detection
// ---------------------------------------------------------------------------

function getSlashQuery(state) {
  const { from } = state.selection.main;
  const line     = state.doc.lineAt(from);
  const before   = line.text.slice(0, from - line.from);
  const m        = before.match(/(?:^|\s)(\/\w*)$/);
  return m ? { query: m[1], deleteFrom: from - m[1].length } : null;
}

// ---------------------------------------------------------------------------
// CodeMirror extensions — returned for app.js to attach via pluginsSlot
// ---------------------------------------------------------------------------

export function paletteExtension(app) {
  return [
    EditorView.updateListener.of((update) => {
      if (!update.docChanged && !update.selectionSet) return;
      const trigger = getSlashQuery(update.state);
      if (!trigger) { close(); return; }

      const pos    = update.state.selection.main.from;
      const coords = update.view.coordsAtPos(pos);
      if (!coords) return;

      const q       = trigger.query.toLowerCase();
      const matched = app.getCommands().filter(
        (c) => c.label.startsWith(q) || q === "/"
      );
      if (!matched.length) { close(); return; }

      open({
        x: coords.left, y: coords.bottom, cursorTop: coords.top,
        matched, view: update.view, deleteFrom: trigger.deleteFrom,
      });
    }),

    Prec.high(keymap.of([
      { key: "Escape",    run: () => { if (!isOpen) return false; close(); return true; } },
      { key: "ArrowDown", run: () => { if (!isOpen) return false; highlight(sel + 1); return true; } },
      { key: "ArrowUp",   run: () => { if (!isOpen) return false; highlight(sel - 1); return true; } },
      { key: "Enter",     run: () => { if (!isOpen) return false; return confirm(); } },
      { key: "Tab",       run: () => { if (!isOpen) return false; return confirm(); } },
    ])),
  ];
}