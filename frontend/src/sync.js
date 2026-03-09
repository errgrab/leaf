/**
 * sync.js
 *
 * Y.js provider for the dumb WebSocket relay.
 *
 * Protocol (binary messages, all prefixed with a varuint message type):
 *   0 (SYNC_STEP1)  + state_vector  → "here is what I have, send me the diff"
 *   1 (SYNC_STEP2)  + update        → "here is the diff you requested"
 *   2 (UPDATE)      + update        → "here is a live update, apply it"
 *   3 (AWARENESS)   + awareness_update → cursor/presence data
 *
 * Full handshake on connect (fixes one-sided sync bug):
 *   → we send SYNC_STEP1 (our state vector)
 *   → we send UPDATE     (our full state, for peers with empty docs)
 *   ← peer sends SYNC_STEP1 (their state vector) → we reply with SYNC_STEP2
 *   ← peer sends SYNC_STEP2 / UPDATE → we apply it
 *
 * Swapping CRDTs: replace Y.* and Awareness calls. WS/encoding logic unchanged.
 */

import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { Awareness } from "y-protocols/awareness";

const MSG_SYNC_STEP1 = 0;
const MSG_SYNC_STEP2 = 1;
const MSG_UPDATE = 2;
const MSG_AWARENESS = 3;

const RECONNECT_MS = 2000;
const SAVE_DELAY_MS = 4000;

export class RelayProvider {
  /**
   * @param {string} serverUrl  e.g. "ws://leaf.local/ws/files"
   * @param {string} filePath   e.g. "tokyo.md"
   * @param {Y.Doc}  doc
   */
  constructor(serverUrl, filePath, doc) {
    this.url = `${serverUrl}/${filePath}`;
    this.filePath = filePath;
    this.doc = doc;
    this.ws = null;
    this.connected = false;
    this._saveTimer = null;
    this._handlers = {};

    // FIX 4: real Awareness so cursors broadcast correctly
    this.awareness = new Awareness(doc);

    // Broadcast local doc updates to peers
    this._onDocUpdate = (update, origin) => {
      if (origin === this) return;
      this._send(MSG_UPDATE, update);
      this._scheduleSave();
    };
    this.doc.on("update", this._onDocUpdate);

    // Broadcast awareness updates (cursors/presence) to peers
    this._onAwarenessUpdate = ({ added, updated, removed }) => {
      const changed = [...added, ...updated, ...removed];
      const payload = encodeAwarenessUpdate(this.awareness, changed);
      this._send(MSG_AWARENESS, payload);
    };
    this.awareness.on("update", this._onAwarenessUpdate);

    this._connect();
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  _connect() {
    this.ws = new WebSocket(this.url);
    this.ws.binaryType = "arraybuffer";

    this.ws.onopen = () => {
      this.connected = true;
      this._emit("status", { connected: true });

      // FIX 3: send both SYNC_STEP1 and our full state so the handshake is
      // symmetric — peers will reply with SYNC_STEP1 back, completing the sync.
      this._send(MSG_SYNC_STEP1, Y.encodeStateVector(this.doc));
      this._send(MSG_UPDATE, Y.encodeStateAsUpdate(this.doc));

      // Announce our presence
      this._send(
        MSG_AWARENESS,
        encodeAwarenessUpdate(this.awareness, [this.doc.clientID]),
      );
    };

    this.ws.onmessage = ({ data }) => {
      const dec = decoding.createDecoder(new Uint8Array(data));
      const msgType = decoding.readVarUint(dec);
      const payload = decoding.readTailAsUint8Array(dec);

      switch (msgType) {
        case MSG_SYNC_STEP1:
          // Peer sent their state vector → reply with what they're missing.
          // Do NOT send our own SYNC_STEP1 back — that causes an infinite
          // ping-pong loop through the dumb relay. Our onopen already sent
          // our full state, so peers have everything they need.
          this._send(MSG_SYNC_STEP2, Y.encodeStateAsUpdate(this.doc, payload));
          break;

        case MSG_SYNC_STEP2:
        case MSG_UPDATE:
          Y.applyUpdate(this.doc, payload, this);
          break;

        case MSG_AWARENESS:
          applyAwarenessUpdate(this.awareness, payload, this);
          break;
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      this._emit("status", { connected: false });
      // Remove remote awareness states on disconnect
      this.awareness.setLocalState(null);
      setTimeout(() => this._connect(), RECONNECT_MS);
    };

    this.ws.onerror = () => this.ws.close();
  }

  _send(msgType, payload) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, msgType);
    encoding.writeUint8Array(enc, payload);
    this.ws.send(encoding.toUint8Array(enc));
  }

  _scheduleSave() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._save(), SAVE_DELAY_MS);
  }

  async _save() {
    try {
      const content = this.doc.getText("content").toString();
      await fetch(`/api/files/${this.filePath}`, {
        method: "PUT",
        body: content,
      });
    } catch (e) {
      console.warn("[sync] save failed, will retry on next change", e);
    }
  }

  // ---------------------------------------------------------------------------
  // Public
  // ---------------------------------------------------------------------------

  saveNow() {
    clearTimeout(this._saveTimer);
    return this._save();
  }

  on(event, fn) {
    (this._handlers[event] ??= new Set()).add(fn);
  }
  off(event, fn) {
    this._handlers[event]?.delete(fn);
  }
  _emit(event, data) {
    this._handlers[event]?.forEach((fn) => fn(data));
  }

  destroy() {
    clearTimeout(this._saveTimer);
    this.awareness.off("update", this._onAwarenessUpdate);
    this.doc.off("update", this._onDocUpdate);
    this.awareness.destroy();
    this.ws?.close();
  }
}

// ---------------------------------------------------------------------------
// Awareness helpers (y-protocols/awareness encoding)
// ---------------------------------------------------------------------------

function encodeAwarenessUpdate(awareness, clients) {
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, clients.length);
  for (const clientID of clients) {
    const state = awareness.getStates().get(clientID);
    encoding.writeVarUint(enc, clientID);
    encoding.writeVarString(enc, state ? JSON.stringify(state) : "null");
  }
  return encoding.toUint8Array(enc);
}

function applyAwarenessUpdate(awareness, update, origin) {
  const dec = decoding.createDecoder(update);
  const nClients = decoding.readVarUint(dec);
  for (let i = 0; i < nClients; i++) {
    const clientID = decoding.readVarUint(dec);
    const stateStr = decoding.readVarString(dec);
    const state = stateStr === "null" ? null : JSON.parse(stateStr);
    if (state === null) {
      awareness.getStates().delete(clientID);
    } else {
      awareness.getStates().set(clientID, state);
    }
  }
  // Notify listeners so yCollab re-renders remote cursors
  awareness.emit("change", [{ added: [], updated: [], removed: [] }, origin]);
}
