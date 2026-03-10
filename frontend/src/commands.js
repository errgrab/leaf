/**
 * commands.js
 *
 * Command registry and default commands.
 * Commands are triggered via the palette extension (typing "/").
 */

/**
 * Register default commands for the app.
 * @param {Object} app
 */
export function registerDefaultCommands(app) {
  app.commands.register({
    label: "/theme",
    detail: () => "themes: " + app.theme.names().join(", "),
    run: () => app.theme.cycle(),
  });

  app.commands.register({
    label: "/home",
    detail: "scratch buffer",
    run: () => {
      window.location.href = "/";
    },
  });

  app.commands.register({
    label: "/open",
    detail: "open a note by name",
    run: () => {
      const name = window.prompt("Note name:");
      if (name) window.location.href = "/" + name.replace(/\.md$/, "");
    },
  });
}

/**
 * Register additional commands.
 * @param {Object} app
 * @param {Array} commands - Array of command objects { label, detail, run }
 */
export function registerCommands(app, commands) {
  for (const cmd of commands) {
    app.commands.register(cmd);
  }
}
