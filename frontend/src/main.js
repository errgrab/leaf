//import "./style.css";

import { EditorState } from "@codemirror/state";
import { EditorView, keymap, drawSelection } from "@codemirror/view";
import {
  history,
  defaultKeymap,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

const leafHighlight = HighlightStyle.define([
  {
    tag: t.heading1,
    fontSize: "1.58em",
    fontWeight: "500",
    color: "var(--fg)",
    lineHeight: "1.3",
  },
  {
    tag: t.heading2,
    fontSize: "1.22em",
    fontWeight: "500",
    color: "var(--fg)",
  },
  {
    tag: t.heading3,
    fontSize: "1.04em",
    fontWeight: "500",
    color: "var(--fg-muted)",
  },
  {
    tag: t.processingInstruction,
    color: "var(--fg-faint)",
    fontFamily: "var(--font-mono)",
  },
  { tag: t.strong, fontWeight: "600", color: "var(--fg)" },
  { tag: t.emphasis, fontStyle: "italic" },
  {
    tag: t.strikethrough,
    textDecoration: "line-through",
    color: "var(--fg-muted)",
  },
  {
    tag: t.monospace,
    fontFamily: "var(--font-mono)",
    fontSize: "0.83em",
    color: "var(--accent)",
  },
  { tag: t.link, color: "var(--accent)", textDecoration: "underline" },
  { tag: t.url, color: "var(--accent)" },
  { tag: t.quote, color: "var(--fg-muted)", fontStyle: "italic" },
  { tag: t.list, color: "var(--fg-faint)" },
  {
    tag: t.meta,
    color: "var(--fg-faint)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.8em",
  },
  { tag: t.contentSeparator, color: "var(--fg-faint)" },
  { tag: t.content, color: "var(--fg)" },
]);

const view = new EditorView({
  state: EditorState.create({
    doc: "# Leaf",
    extensions: [
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      drawSelection(),
      EditorView.lineWrapping,
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      syntaxHighlighting(leafHighlight),
      EditorView.theme({
        "&": { background: "transparent", color: "var(--fg)" },
        ".cm-content": { caretColor: "var(--accent)" },
        ".cm-cursor": { borderLeftColor: "var(--accent)" },
        ".cm-selectionBackground": {
          background: "var(--selection) !important",
        },
        "&.cm-focused .cm-selectionBackground": {
          background: "var(--selection) !important",
        },
      }),
    ],
  }),
  parent: document.getElementById("editor"),
});

view.focus();
