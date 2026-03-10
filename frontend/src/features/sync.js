/**
 * features/sync.js
 *
 * WebSocket sync provider for Yjs.
 * Works with the core/app.js attachYjsSync function.
 */

import * as syncProto from "y-protocols/sync";
import * as awaProto from "y-protocols/awareness";
import * as enc from "lib0/encoding";
import * as dec from "lib0/decoding";
import { Awareness } from "y-protocols/awareness";

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;
const RECONNECT_MS = 2000;
const SAVE_DELAY_MS = 4000;

export class RelayProvider {
  constructor(app, doc, ytext) {
    this.app = app;
    this.doc = doc;
    this.ytext = ytext;
    this.ws = null;
    this.connected = false;
    this._saveTimer = null;
    this._listeners = {};
    this.awareness = new Awareness(doc);

    this.doc.on("update", (update, origin) => {
      if (origin === this) return;
      this._sendSync(update);
      this._scheduleSave();
    });

    this.awareness.on("update", ({ added, updated, removed }) => {
      const changed = [...added, ...updated, ...removed];
      this._sendAwareness(changed);
    });

    this._connect();
  }

  _connect() {
    const url = `ws://${location.host}/ws/files/${this.app.filePath}`;
    this.ws = new WebSocket(url);
    this.ws.binaryType = "arraybuffer";

    this.ws.onopen = () => {
      this.connected = true;
      this._emit("status", { connected: true });

      // Tell peers what we have — they reply with what we're missing
      const e = enc.createEncoder();
      enc.writeVarUint(e, MSG_SYNC);
      syncProto.writeSyncStep1(e, this.doc);
      this.ws.send(enc.toUint8Array(e));

      // Announce our presence
      this._sendAwareness([this.doc.clientID]);
    };

    this.ws.onmessage = ({ data }) => {
      const d = dec.createDecoder(new Uint8Array(data));
      const type = dec.readVarUint(d);

      if (type === MSG_SYNC) {
        const e = enc.createEncoder();
        enc.writeVarUint(e, MSG_SYNC);
        const reply = syncProto.readSyncMessage(d, e, this.doc, this);
        // Only send if there's actually something to reply with
        if (enc.length(e) > 1) this.ws.send(enc.toUint8Array(e));
      }

      if (type === MSG_AWARENESS) {
        awaProto.applyAwarenessUpdate(
          this.awareness,
          dec.readVarUint8Array(d),
          this,
        );
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      this._emit("status", { connected: false });
      this.awareness.setLocalState(null);
      setTimeout(() => this._connect(), RECONNECT_MS);
    };

    this.ws.onerror = () => this.ws.close();
  }

  _sendSync(update) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const e = enc.createEncoder();
    enc.writeVarUint(e, MSG_SYNC);
    syncProto.writeUpdate(e, update);
    this.ws.send(enc.toUint8Array(e));
  }

  _sendAwareness(clients) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const e = enc.createEncoder();
    enc.writeVarUint(e, MSG_AWARENESS);
    enc.writeVarUint8Array(
      e,
      awaProto.encodeAwarenessUpdate(this.awareness, clients),
    );
    this.ws.send(enc.toUint8Array(e));
  }

  _scheduleSave() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._save(), SAVE_DELAY_MS);
  }

  async _save() {
    try {
      await fetch(`/api/files/${this.app.filePath}`, {
        method: "PUT",
        body: this.ytext.toString(),
      });
    } catch (e) {
      console.warn("[sync] save failed", e);
    }
  }

  saveNow() {
    clearTimeout(this._saveTimer);
    return this._save();
  }

  on(ev, fn) {
    (this._listeners[ev] ??= new Set()).add(fn);
  }
  _emit(ev, d) {
    this._listeners[ev]?.forEach((fn) => fn(d));
  }
}

/**
 * Legacy export for backwards compatibility.
 * Use attachYjsSync from core/app.js instead.
 */
export function loadSync(app) {
  console.warn(
    "loadSync is deprecated. Use attachYjsSync from core/app.js instead.",
  );
  // This is a no-op now - sync is attached via attachYjsSync
}
