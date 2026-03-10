/**
 * features/reading.js
 *
 * Reading mode: when the editor loses focus, renders a clean HTML
 * overlay over the editor. Click anywhere to return to editing.
 *
 * Supports: headings, bold, italic, code, links, [[wikilinks]], hr.
 * Clicking a [[wikilink]] in reading mode navigates to that note.
 */

import { EditorView } from '@codemirror/view'
import { getContent } from './core/editor.js'

function navigateTo(path) {
  window.location.href = '/' + path.replace(/\.md$/, '')
}

function mdToHtml(md) {
  return md
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/^#{6} (.+)$/gm, '<h6>$1</h6>')
    .replace(/^#{5} (.+)$/gm, '<h5>$1</h5>')
    .replace(/^#{4} (.+)$/gm, '<h4>$1</h4>')
    .replace(/^#{3} (.+)$/gm, '<h3>$1</h3>')
    .replace(/^#{2} (.+)$/gm, '<h2>$1</h2>')
    .replace(/^#{1} (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/`([^`]+)`/g,     '<code>$1</code>')
    .replace(/\[\[([^\]]+)\]\]/g, (_,p) => `<a class="wikilink" data-link="${p}">${p}</a>`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^---$/gm,        '<hr>')
    .replace(/\n\n+/g,         '</p><p>')
    .replace(/^(?!<[h1-6]|<hr|<\/p|<p)(.+)$/gm, '<p>$1</p>')
}

let _overlay = null

function show(container, view) {
  if (_overlay) return
  const content = getContent(view)
  _overlay = document.createElement('div')
  _overlay.style.cssText = `
    position:absolute; inset:0; overflow:auto; cursor:text;
    background:var(--bg); color:var(--fg);
    font-family:var(--font-mono); font-size:var(--font-size);
    line-height:var(--line-height); padding:48px 24px 200px; box-sizing:border-box;
  `
  const inner = document.createElement('div')
  inner.style.cssText = 'max-width:var(--max-width); margin:0 auto;'
  inner.innerHTML = mdToHtml(content)

  const style = document.createElement('style')
  style.textContent = `
    .leaf-reading h1,.leaf-reading h2,.leaf-reading h3 { font-weight:bold; margin:1em 0 .3em }
    .leaf-reading h1 { font-size:1.3em } .leaf-reading h2 { font-size:1.15em }
    .leaf-reading code { color:var(--accent-dim) }
    .leaf-reading a { color:var(--accent); text-decoration:underline dotted; cursor:pointer }
    .leaf-reading p { margin:.5em 0 }
    .leaf-reading hr { border:none; border-top:1px solid var(--fg-dim); margin:1em 0 }
  `
  _overlay.className = 'leaf-reading'
  _overlay.append(style, inner)
  _overlay.addEventListener('click', e => {
    const link = e.target.closest('.wikilink')
    if (link) { navigateTo(link.getAttribute('data-link')); return }
    hide()
    view?.focus()
  })
  container.style.position = 'relative'
  container.appendChild(_overlay)
}

function hide() {
  _overlay?.remove()
  _overlay = null
}

/**
 * Reading mode feature - attach to editor.
 * @param {EditorView} view - CodeMirror editor view
 * @param {HTMLElement} container - Container element
 * @returns {Array} Extensions
 */
export function createReadingFeature(view, container) {
  return [
    EditorView.updateListener.of(u => {
      if (!u.focusChanged) return
      if (!u.view.hasFocus) show(container, u.view)
      else hide()
    }),
  ]
}
