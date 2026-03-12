/**
 * sync.js — Yjs + WebSocket sync
 *
 * The server holds the Yjs state and acts as a y-websocket equivalent.
 * This means the client just needs to sync with the server on connect —
 * no special seeding logic, no fallback complexity.
 *
 * IDB is loaded before connecting so sync step 1 is accurate (we tell
 * the server what we already have, it sends only what we're missing).
 *
 * Public API:
 *   createSync(app) → sync
 *
 *   sync.synced    — Promise, resolves after first server sync round-trip
 *   sync.awareness — Yjs Awareness instance (cursors/presence)
 *   sync.saveNow() — flush pending .md export to server immediately
 *   sync.on("status", ({ connected }) => {})
 */

import * as Y from "yjs";
import * as syncProto from "y-protocols/sync";
import * as awaProto from "y-protocols/awareness";
import { Awareness } from "y-protocols/awareness";
import * as enc from "lib0/encoding";
import * as dec from "lib0/decoding";
import { IndexeddbPersistence } from "y-indexeddb";
import { yCollab } from "y-codemirror.next";
import { syncSlot } from "./editor.js";

const MSG_SYNC      = 0;
const MSG_AWARENESS = 1;
const RECONNECT_MS  = 2000;
const SAVE_DELAY_MS = 10000;

export function createSync(app) {
  const doc       = new Y.Doc();
  const ytext     = doc.getText("content");
  const awareness = new Awareness(doc);
  const listeners = {};
  let ws        = null;
  let saveTimer = null;

  // Attach yCollab + awareness to the editor so it can render collaborative cursors
  app.editor.dispatch({
    effects: syncSlot.reconfigure(yCollab(ytext, awareness)),
  });

  // Load IDB before connecting — so sync step 1 reflects local state
  const idbReady = app.filePath
    ? new IndexeddbPersistence(app.filePath, doc).whenSynced
    : Promise.resolve();

  // synced resolves after the first complete server sync round-trip
  let resolveSynced;
  const synced = new Promise((resolve) => { resolveSynced = resolve; });

  // Send local updates to server
  doc.on("update", (update, origin) => {
    if (origin === "sync") return;
    if (ws?.readyState !== WebSocket.OPEN) return;
    const e = enc.createEncoder();
    enc.writeVarUint(e, MSG_SYNC);
    syncProto.writeUpdate(e, update);
    ws.send(enc.toUint8Array(e));
    scheduleSave();
  });

  // Send local awareness to server
  awareness.on("update", ({ added, updated, removed }) => {
    if (ws?.readyState !== WebSocket.OPEN) return;
    const e = enc.createEncoder();
    enc.writeVarUint(e, MSG_AWARENESS);
    enc.writeVarUint8Array(e, awaProto.encodeAwarenessUpdate(awareness, [...added, ...updated, ...removed]));
    ws.send(enc.toUint8Array(e));
  });

  async function connect() {
    await idbReady;

    const proto = location.protocol === "https:" ? "wss" : "ws";
    const room  = app.filePath || "_scratch";
    ws = new WebSocket(`${proto}://${location.host}/ws/files/${room}`);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      emit("status", { connected: true });

      // Step 1: tell server what we have
      const e = enc.createEncoder();
      enc.writeVarUint(e, MSG_SYNC);
      syncProto.writeSyncStep1(e, doc);
      ws.send(enc.toUint8Array(e));

      // Announce our presence
      const ae = enc.createEncoder();
      enc.writeVarUint(ae, MSG_AWARENESS);
      enc.writeVarUint8Array(ae, awaProto.encodeAwarenessUpdate(awareness, [doc.clientID]));
      ws.send(enc.toUint8Array(ae));
    };

    ws.onmessage = ({ data }) => {
      const d    = dec.createDecoder(new Uint8Array(data));
      const type = dec.readVarUint(d);

      if (type === MSG_SYNC) {
        const e = enc.createEncoder();
        enc.writeVarUint(e, MSG_SYNC);
        syncProto.readSyncMessage(d, e, doc, "sync");
        if (enc.length(e) > 1) ws.send(enc.toUint8Array(e));
        resolveSynced(); // server replied — we're in sync
      }

      if (type === MSG_AWARENESS) {
        awaProto.applyAwarenessUpdate(awareness, dec.readVarUint8Array(d), "sync");
      }
    };

    ws.onclose = () => {
      emit("status", { connected: false });
      awareness.setLocalState(null);
      setTimeout(connect, RECONNECT_MS);
    };

    ws.onerror = () => ws.close();
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveMd, SAVE_DELAY_MS);
  }

  async function saveMd() {
    if (!app.filePath) return;
    try {
      await fetch(`/api/files/${app.filePath}`, {
        method: "PUT",
        body: ytext.toString(),
      });
    } catch (e) {
      console.debug("[sync] save failed", e);
    }
  }

  function on(ev, fn) {
    (listeners[ev] ??= new Set()).add(fn);
  }

  function emit(ev, data) {
    listeners[ev]?.forEach((fn) => fn(data));
  }

  connect();

  return {
    synced,
    awareness,
    on,
    saveNow() {
      clearTimeout(saveTimer);
      return saveMd();
    },
  };
}