/**
 * features/palette.js
 *
 * Command palette extension.
 * Triggered by typing "/" at line start or after whitespace.
 */

import { EditorView, keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";

let _el = null;
let _items = [];
let _sel = 0;
let _onSelect = null;
let _isOpen = false;

function ensureEl() {
  if (_el) return;
  _el = document.createElement("div");
  Object.assign(_el.style, {
    position: "fixed",
    zIndex: "1000",
    background: "var(--bg-secondary)",
    border: "1px solid var(--fg-dim)",
    borderRadius: "6px",
    padding: "4px 0",
    minWidth: "240px",
    maxHeight: "260px",
    overflowY: "auto",
    fontFamily: "var(--font)",
    fontSize: "13px",
    boxShadow: "0 4px 16px rgba(0,0,0,.4)",
    display: "none",
  });
  document.body.appendChild(_el);
  document.addEventListener("mousedown", (e) => {
    if (!_el.contains(e.target)) close();
  });
}

function render() {
  _el.innerHTML = "";
  _items.forEach((item, i) => {
    const row = document.createElement("div");
    const lbl = document.createElement("span");
    const det = document.createElement("span");
    Object.assign(row.style, {
      padding: "7px 14px",
      cursor: "pointer",
      display: "flex",
      justifyContent: "space-between",
      gap: "16px",
    });
    lbl.textContent = item.label;
    det.textContent =
      typeof item.detail === "function" ? item.detail() : item.detail ?? "";
    det.style.cssText = "color:var(--fg-dim); font-size:11px";
    row.append(lbl, det);
    row.addEventListener("mouseenter", () => highlight(i));
    row.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      confirm(i);
    });
    _el.appendChild(row);
  });
  highlight(0);
}

function highlight(i) {
  if (_items.length === 0) return;
  _sel = (i + _items.length) % _items.length;
  Array.from(_el.children).forEach((row, j) => {
    const on = j === _sel;
    row.style.background = on ? "var(--accent)" : "";
    row.style.color = on ? "var(--bg)" : "var(--fg)";
    const det = row.querySelector("span:last-child");
    if (det) {
      det.style.color = on ? "var(--bg)" : "var(--fg-dim)";
    }
  });
}

function confirm() {
  if (!_isOpen || _items.length === 0) return false;
  const item = _items[_sel];
  const onSelect = _onSelect;
  if (!item) return false;
  close();
  if (onSelect) onSelect(item);
  return true;
}

function open({ x, y, cursorTop, items, onSelect }) {
  if (!items || items.length === 0) return;
  ensureEl();
  _items = items;
  _onSelect = onSelect;
  _isOpen = true;
  render();
  _el.style.display = "block";
  const left = Math.min(x, window.innerWidth - 260);
  const h = _el.offsetHeight;
  const top = y + 4 + h > window.innerHeight ? cursorTop - h - 4 : y + 4;
  Object.assign(_el.style, { left: `${left}px`, top: `${top}px` });
}

function close() {
  if (_el) _el.style.display = "none";
  _items = [];
  _onSelect = null;
  _isOpen = false;
}

function isOpen() {
  return _isOpen && _el && _el.style.display === "block";
}

// ---------------------------------------------------------------------------
// Trigger: type "/" at line start or after whitespace
// ---------------------------------------------------------------------------

function getSlashQuery(state) {
  const { from } = state.selection.main;
  const line = state.doc.lineAt(from);
  const before = line.text.slice(0, from - line.from);
  const m = before.match(/(?:^|\s)(\/\w*)$/);
  return m ? { query: m[1], deleteFrom: from - m[1].length } : null;
}

// ---------------------------------------------------------------------------
// Palette keymap - uses Prec.high to override default keybindings
// ---------------------------------------------------------------------------

const paletteKeymap = keymap.of([
  {
    key: "Escape",
    run: (view) => {
      if (!isOpen()) return false;
      close();
      return true;
    },
  },
  {
    key: "ArrowDown",
    run: (view) => {
      if (!isOpen()) return false;
      highlight(_sel + 1);
      return true;
    },
  },
  {
    key: "ArrowUp",
    run: (view) => {
      if (!isOpen()) return false;
      highlight(_sel - 1);
      return true;
    },
  },
  {
    key: "Enter",
    run: (view) => {
      if (!isOpen()) return false;
      return confirm();
    },
  },
  {
    key: "Tab",
    run: (view) => {
      if (!isOpen()) return false;
      return confirm();
    },
  },
]);

// ---------------------------------------------------------------------------
// CodeMirror extension
// ---------------------------------------------------------------------------

export function paletteExtension(app) {
  return [
    EditorView.updateListener.of((update) => {
      if (!update.docChanged && !update.selectionSet) return;

      const trigger = getSlashQuery(update.state);
      if (!trigger) {
        close();
        return;
      }

      const pos = update.state.selection.main.from;
      const coords = update.view.coordsAtPos(pos);
      if (!coords) return;

      const { left: x, bottom: y, top: cursorTop } = coords;
      const view = update.view;

      const q = trigger.query.toLowerCase();
      const matches = app.commands
        .all()
        .filter((c) => c.label.startsWith(q) || q === "/");
      if (!matches.length) {
        close();
        return;
      }

      open({
        x,
        y,
        cursorTop,
        items: matches,
        onSelect: (item) => {
          view.dispatch({
            changes: {
              from: trigger.deleteFrom,
              to: view.state.selection.main.from,
              insert: "",
            },
          });
          item.run(view);
        },
      });
    }),

    // Use Prec.high to ensure palette keys are handled before default keys
    Prec.high(paletteKeymap),
  ];
}
