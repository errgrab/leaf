import logging
import os
import shutil
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

# Data directory - configurable via environment variable
BASE_DIR = Path(os.environ.get("DATA_DIR", "/data"))
BASE_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

_rooms: dict[str, set[WebSocket]] = {}

app = FastAPI()

# Static file directory for production build
STATIC_DIR = Path("./static") if Path("./static").exists() else Path("../frontend/dist")
STATIC_DIR_AVAILABLE = STATIC_DIR.exists()

# Mount static files at /assets (this takes precedence over catch-all routes)
if STATIC_DIR_AVAILABLE and (STATIC_DIR / "assets").exists():
    app.mount(
        "/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets"
    )


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
        "path": str(path.relative_to(BASE_DIR)),
        "created": stat.st_ctime,
        "modified": stat.st_mtime,
        "size": stat.st_size,
    }


async def broadcast(room: str, data: bytes, exclude: WebSocket) -> None:
    for ws in list(_rooms.get(room, set())):
        if ws is not exclude:
            try:
                await ws.send_bytes(data)
            except Exception:
                _rooms[room].discard(ws)


@app.get("/api/files")
def list_files():
    return [meta(file) for file in BASE_DIR.rglob("*") if file.is_file()]


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


@app.websocket("/ws/files/{path:path}")
async def relay(ws: WebSocket, path: str):
    resolve(path)
    await ws.accept()
    _rooms.setdefault(path, set()).add(ws)
    log.info("connect %s peers=%d", path, len(_rooms.get(path, set())))
    try:
        while True:
            await broadcast(path, await ws.receive_bytes(), exclude=ws)
    except WebSocketDisconnect:
        pass
    finally:
        _rooms[path].discard(ws)
        if not _rooms[path]:
            del _rooms[path]
        log.info("disconnect %s peers=%d", path, len(_rooms.get(path, set())))


@app.get("/{path:path}", response_class=HTMLResponse, include_in_schema=False)
def spa(path: str):
    """Serve static files if they exist, otherwise serve index.html for SPA."""
    if not STATIC_DIR_AVAILABLE:
        raise HTTPException(503, "Frontend not built")

    # Try to serve the file directly if it exists (e.g., leaf.svg)
    file_path = STATIC_DIR / path
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)

    # Fall back to index.html for SPA routing
    index_path = STATIC_DIR / "index.html"
    if not index_path.exists():
        raise HTTPException(503, "Frontend not built")
    return FileResponse(index_path)
