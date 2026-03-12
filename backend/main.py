import asyncio
import logging
import os
import shutil
import struct
from pathlib import Path

from fastapi import (
    Body,
    FastAPI,
    HTTPException,
    Request,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(os.environ.get("DATA_DIR", "/data"))
BASE_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ─── Room ────────────────────────────────────────────────────────────────────

class Room:
    """
    Holds the state for one note.

    Updates are stored as a list of raw WebSocket message bytes — exactly as
    received from clients, exactly as replayed to new peers. The server never
    inspects or reframes the content.

    Persisted to disk as a simple binary format:
        [4-byte big-endian length][message bytes] repeated
    """

    def __init__(self, path: str):
        self.path        = path
        self.peers: set[WebSocket] = set()
        self.updates: list[bytes] = []
        self._save_task  = None

    def state_path(self) -> Path:
        return resolve(self.path).with_suffix(".md.yjs")

    def load(self):
        """Load persisted updates from disk."""
        p = self.state_path()
        if not p.exists():
            return
        data = p.read_bytes()
        pos  = 0
        while pos + 4 <= len(data):
            length = struct.unpack_from(">I", data, pos)[0]
            pos   += 4
            if pos + length > len(data):
                log.warning("truncated state file %s, stopping at %d", p, pos)
                break
            self.updates.append(data[pos : pos + length])
            pos += length
        log.info("loaded %s (%d updates)", p, len(self.updates))

    def save(self):
        """Persist updates to disk as length-prefixed records."""
        if not self.updates:
            return
        p = self.state_path()
        p.parent.mkdir(parents=True, exist_ok=True)
        with p.open("wb") as f:
            for msg in self.updates:
                f.write(struct.pack(">I", len(msg)))
                f.write(msg)
        log.info("saved %s (%d updates, %d bytes)", p, len(self.updates),
                 sum(len(m) for m in self.updates))

    def schedule_save(self, delay: int = 30):
        """Debounced save — resets the timer on each call."""
        if self._save_task:
            self._save_task.cancel()
        self._save_task = asyncio.create_task(self._delayed_save(delay))

    async def _delayed_save(self, delay: int):
        await asyncio.sleep(delay)
        self.save()

    def add_update(self, data: bytes):
        """Store a raw message received from a client."""
        self.updates.append(data)


_rooms: dict[str, Room] = {}

# ─── App ─────────────────────────────────────────────────────────────────────

app = FastAPI()

STATIC_DIR           = Path("./static") if Path("./static").exists() else Path("../frontend/dist")
STATIC_DIR_AVAILABLE = STATIC_DIR.exists()

if STATIC_DIR_AVAILABLE and (STATIC_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")


def resolve(relative: str) -> Path:
    if ".." in Path(relative).parts:
        raise HTTPException(400, "Invalid path")
    fp = (BASE_DIR / relative).resolve()
    if not fp.is_relative_to(BASE_DIR.resolve()):
        raise HTTPException(400, "Invalid path")
    return fp


def meta(path: Path) -> dict:
    stat = path.stat()
    return {
        "path":     str(path.relative_to(BASE_DIR)),
        "created":  stat.st_ctime,
        "modified": stat.st_mtime,
        "size":     stat.st_size,
    }


async def broadcast(room: Room, data: bytes, exclude: WebSocket) -> None:
    for ws in list(room.peers):
        if ws is not exclude:
            try:
                await ws.send_bytes(data)
            except Exception:
                room.peers.discard(ws)


@app.get("/api/files")
def list_files():
    # Exclude .yjs state files — those are internal
    return [
        meta(f) for f in BASE_DIR.rglob("*")
        if f.is_file() and f.suffix != ".yjs"
    ]


@app.get("/api/files/{path:path}")
def get_file(path: str):
    fp = resolve(path)
    if not fp.is_file():
        raise HTTPException(404, "File not found")
    return FileResponse(fp)


@app.put("/api/files/{path:path}", status_code=204)
async def update_file(path: str, request: Request):
    fp = resolve(path)
    fp.parent.mkdir(parents=True, exist_ok=True)
    fp.write_bytes(await request.body())


@app.patch("/api/files/{path:path}", status_code=204)
async def move_file(path: str, new_path: str = Body(..., embed=True)):
    src, dst = resolve(path), resolve(new_path)
    if not src.is_file():
        raise HTTPException(404, "File not found")
    if dst.is_file():
        raise HTTPException(409, "File already exists")
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src), str(dst))


@app.delete("/api/files/{path:path}", status_code=204)
def delete_file(path: str):
    fp = resolve(path)
    if not fp.is_file():
        raise HTTPException(404, "File not found")
    fp.unlink()
    # Clean up state file too
    yjs = fp.with_suffix(".md.yjs")
    if yjs.exists():
        yjs.unlink()

@app.websocket("/ws/files/{path:path}")
async def relay(ws: WebSocket, path: str):
    resolve(path)  # validate — raises 400 on bad path
    await ws.accept()

    if path not in _rooms:
        room = Room(path)
        room.load()
        _rooms[path] = room
    else:
        room = _rooms[path]

    room.peers.add(ws)
    log.info("connect %s peers=%d", path, len(room.peers))

    # Replay all stored updates to the new peer so it gets full server state
    for msg in room.updates:
        try:
            await ws.send_bytes(msg)
        except Exception:
            break

    try:
        while True:
            data = await ws.receive_bytes()
            room.add_update(data)
            room.schedule_save()
            await broadcast(room, data, exclude=ws)
    except WebSocketDisconnect:
        pass
    finally:
        room.peers.discard(ws)
        log.info("disconnect %s peers=%d", path, len(room.peers))

        if not room.peers:
            # Last peer — save immediately and free memory
            if room._save_task:
                room._save_task.cancel()
            room.save()
            del _rooms[path]


@app.get("/{path:path}", response_class=HTMLResponse, include_in_schema=False)
def spa(path: str):
    if not STATIC_DIR_AVAILABLE:
        raise HTTPException(503, "Frontend not built")
    file_path = STATIC_DIR / path
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)
    index_path = STATIC_DIR / "index.html"
    if not index_path.exists():
        raise HTTPException(503, "Frontend not built")
    return FileResponse(index_path)