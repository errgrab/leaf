/**
 * router.js
 *
 * URL routing. Reads the current path and mounts the appropriate app instance.
 * This is the only place that knows about URL structure.
 */

import { createApp } from "./app.js";

export function route() {
  const raw = decodeURIComponent(location.pathname).slice(1);

  if (!raw) {
    createApp({ container: document.getElementById("app") });
    return;
  }

  // Normalize path to always have .md extension
  const filePath = raw.endsWith(".md") ? raw : raw + ".md";
  if (!raw.endsWith(".md")) {
    history.replaceState(null, "", "/" + filePath);
  }

  createApp({ filePath, container: document.getElementById("app") });
}