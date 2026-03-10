/**
 * core/editor.js
 *
 * CodeMirror-first editor creation.
 * The editor works standalone - Yjs sync is an optional add-on.
 */

import { EditorView, keymap } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import {
  defaultKeymap,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { tags } from "@lezer/highlight";

const highlight = HighlightStyle.define([
  {
    tag: tags.heading1,
    color: "var(--fg)",
    fontWeight: "bold",
    fontSize: "1.5em",
  },
  {
    tag: tags.heading2,
    color: "var(--fg)",
    fontWeight: "bold",
    fontSize: "1.25em",
  },
  {
    tag: tags.heading3,
    color: "var(--fg)",
    fontWeight: "bold",
    fontSize: "1.2em",
  },
  { tag: tags.strong, color: "var(--fg)", fontWeight: "bold" },
  { tag: tags.emphasis, color: "var(--fg)", fontStyle: "italic" },
  { tag: tags.link, color: "var(--accent)" },
  { tag: tags.monospace, color: "var(--accent-dim)" },
  { tag: tags.punctuation, color: "var(--fg-dim)" },
]);

const baseTheme = EditorView.theme({
  "&": {
    height: "100%",
    background: "transparent",
    color: "var(--fg)",
    fontSize: "var(--font-size)",
  },
  ".cm-content": {
    fontFamily: "var(--font)",
    lineHeight: "var(--line-height)",
    maxWidth: "var(--max-width)",
    margin: "0 auto",
    padding: "48px 24px 200px",
    caretColor: "var(--accent)",
  },
  ".cm-cursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
  ".cm-focused": { outline: "none" },
  ".cm-activeLine": { background: "transparent" },
  ".cm-gutters": { display: "none" },
  ".cm-scroller": { overflow: "auto", height: "100%" },
  ".cm-wikilink": {
    color: "var(--accent)",
    textDecoration: "underline dotted",
    cursor: "pointer",
  },
});

/**
 * Create a standalone CodeMirror editor.
 * @param {HTMLElement} container - Parent element
 * @param {Object} options
 * @param {string} [options.content=""] - Initial content
 * @param {Array} [options.extensions=[]] - Additional extensions
 * @param {boolean} [options.lineWrapping=true] - Enable line wrapping
 * @returns {EditorView}
 */
export function createEditorView(container, options = {}) {
  const {
    content = "",
    extensions = [],
    lineWrapping = true,
  } = options;

  const view = new EditorView({
    state: EditorState.create({
      doc: content,
      extensions: [
        baseTheme,
        syntaxHighlighting(highlight),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        lineWrapping ? EditorView.lineWrapping : [],
        ...extensions,
      ],
    }),
    parent: container,
  });

  return view;
}

/**
 * Compartment for dynamically swapping sync extensions.
 * Use this to attach/detach Yjs sync without recreating the editor.
 */
export const syncCompartment = new Compartment();

/**
 * Get the current content as a string.
 * @param {EditorView} view
 * @returns {string}
 */
export function getContent(view) {
  return view.state.doc.toString();
}

/**
 * Set the content.
 * @param {EditorView} view
 * @param {string} content
 */
export function setContent(view, content) {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: content },
  });
}

/**
 * Attach sync extension to an existing editor view.
 * @param {EditorView} view
 * @param {Function} getCollabExtension - Function that returns the yCollab extension
 */
export function attachSyncExtension(view, getCollabExtension) {
  view.dispatch({
    effects: syncCompartment.reconfigure(getCollabExtension()),
  });
}
