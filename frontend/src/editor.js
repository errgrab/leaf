/**
 * editor.js
 *
 * Compatibility wrapper - re-exports from core/editor.js.
 * New code should import from ./core/editor.js directly.
 */

export {
  createEditorView,
  syncCompartment,
  getContent,
  setContent,
} from "./core/editor.js";
