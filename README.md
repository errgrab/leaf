# Leaf

A minimalist, real-time collaborative markdown note-taking application.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.12+-blue.svg)
![Node](https://img.shields.io/badge/node-20+-green.svg)

## Features

- **Real-time Collaboration** - Multiple users can edit the same note simultaneously using Yjs CRDTs
- **Markdown Editor** - Powered by CodeMirror 6 with syntax highlighting
- **Wiki Links** - Create connections between notes using `[[link]]` syntax
- **Command Palette** - Type `/` to access commands (themes, navigation, etc.)
- **Themes** - Built-in themes: Leaf (default), Dark, Light, Nord
- **Local Persistence** - Notes are cached in IndexedDB for offline access
- **Clean UI** - Minimalist design focused on writing

## Quick Start

### Development

```bash
# Clone the repository
git clone https://github.com/your-org/leaf.git
cd leaf

# Start development servers
docker compose up --build
```

Access the app at **http://localhost:5173**

### Production

```bash
# Build and run production image
docker compose -f compose.release.yaml up --build -d
```

Access the app at **http://localhost:8000**

## Manual Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Frontend      │     │    Backend      │
│   (Vite +       │────▶│   (FastAPI +    │
│   CodeMirror 6) │◀────│    Uvicorn)     │
└─────────────────┘     └─────────────────┘
        │                       │
        │                       ▼
        │              ┌─────────────────┐
        │              │   File System   │
        │              │   (/data)       │
        │              └─────────────────┘
        ▼
┌─────────────────┐
│   Yjs CRDT      │
│   (Sync via     │
│   WebSocket)    │
└─────────────────┘
```

### Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | Vite, CodeMirror 6 |
| Editor | CodeMirror 6 with markdown support |
| Sync | Yjs CRDTs over WebSocket |
| Backend | FastAPI, Uvicorn |
| Storage | File system + IndexedDB |

## Project Structure

```
leaf/
├── backend/
│   ├── main.py           # FastAPI application
│   ├── Dockerfile        # Production backend
│   ├── Dockerfile.dev    # Development backend
│   └── requirements.txt  # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── main.js       # Entry point
│   │   ├── boot.js       # App initialization
│   │   ├── commands.js   # Command registry
│   │   ├── core/
│   │   │   ├── editor.js # CodeMirror wrapper
│   │   │   └── app.js    # App state + Yjs sync
│   │   ├── features/     # Editor extensions
│   │   │   ├── sync.js   # WebSocket sync provider
│   │   │   ├── palette.js# Command palette
│   │   │   ├── wiki.js   # Wiki link support
│   │   │   ├── themes.js # Theme management
│   │   │   └── identity.js# User identity
│   │   └── ui/
│   │       └── status.js # Sync status indicator
│   ├── Dockerfile        # Production frontend (nginx)
│   ├── Dockerfile.dev    # Development frontend
│   └── package.json      # Node dependencies
├── data/                 # Notes storage
├── Dockerfile            # Multi-stage production build
├── compose.yaml          # Development compose
└── compose.release.yaml  # Production compose
```

## Usage

### Creating Notes

1. Navigate to any URL path to create a note (e.g., `/my-note`)
2. Start writing markdown
3. Notes are auto-saved to the backend

### Wiki Links

Create links between notes using double brackets:

```markdown
Check out [[my-other-note]] for more details.
```

Click the link to navigate.

### Commands

Type `/` to open the command palette:

| Command | Description |
|---------|-------------|
| `/theme` | Cycle through color themes |
| `/home` | Go to scratch buffer (home) |
| `/open` | Open a note by name |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Y` | Redo |
| `Ctrl/Cmd + A` | Select all |
| `Tab` | Indent (when palette closed) / Select (when palette open) |
| `Enter` | New line / Select command (when palette open) |
| `Escape` | Close palette |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/files` | List all notes |
| `GET` | `/api/files/{path}` | Get a specific note |
| `PUT` | `/api/files/{path}` | Create/update a note |
| `DELETE` | `/api/files/{path}` | Delete a note |
| `PATCH` | `/api/files/{path}` | Move/rename a note |
| `WS` | `/ws/files/{path}` | WebSocket for real-time sync |

## Configuration

### Environment Variables

No environment variables are required. Data is stored in `/data` by default.

### Custom Themes

Edit `frontend/src/features/themes.js` to add custom themes:

```javascript
const THEMES = {
  myTheme: {
    "--bg": "#ffffff",
    "--fg": "#000000",
    "--accent": "#0066cc",
    // ... more CSS variables
  },
};
```

## Development

### Running Tests

```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
npm run build
```

### Hot Reload

Both development servers support hot reload:

- **Backend**: Uvicorn `--reload` flag
- **Frontend**: Vite HMR

## Deployment

### Docker (Recommended)

```bash
# Production
docker compose -f compose.release.yaml up -d --build
```

### Manual

1. Build frontend: `cd frontend && npm run build`
2. Copy `dist/` to backend's static folder
3. Run backend: `uvicorn main:app --host 0.0.0.0 --port 8000`

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Acknowledgments

- [CodeMirror 6](https://codemirror.net/) - Editor component
- [Yjs](https://yjs.dev/) - Real-time collaboration
- [FastAPI](https://fastapi.tiangolo.com/) - Backend framework
- [Vite](https://vitejs.dev/) - Build tool
