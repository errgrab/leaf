/**
 * plugins/commands.js
 *
 * Built-in commands. Just another plugin — registers commands on app
 * the same way a user plugin would. No special treatment.
 */

export function commands(app) {
  app.addCommand({
    label: "/home",
    detail: "go to scratch buffer",
    run: () => { window.location.href = "/"; },
  });

  app.addCommand({
    label: "/open",
    detail: "open note by name",
    run: () => {
      const name = window.prompt("Note name:");
      if (name) window.location.href = "/" + name.replace(/\.md$/, "");
    },
  });

  app.addCommand({
    label: "/save",
    detail: "save now",
    run: () => app.sync.saveNow(),
  });
}