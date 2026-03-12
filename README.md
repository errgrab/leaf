<div align="center">
  <img src="frontend/public/leaf.svg" alt="Leaf Logo" width="120" height="120" />
  <h1>Leaf</h1>
  <p><em>A minimalist collaborative digital garden app</em></p>
  <p>
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" />
    <img src="https://img.shields.io/badge/python-3.12+-blue.svg" alt="Python" />
    <img src="https://img.shields.io/badge/node-20+-green.svg" alt="Node" />
  </p>
</div>

---

## ✨ Features

- Real-time file editing and collaboration (Yjs CRDT)
- Minimal markdown editor (CodeMirror 6)
- Real-time markdown preview
- Obsidian-style wiki-links (`[[link]]`)
- Command palette (`/` for quick actions)
- Built-in themes (Leaf, Dark, Light, Nord)
- Local persistence (IndexedDB)
- Clean, distraction-free UI

---

## 🚀 Quick Start

### With Docker Compose

```bash
docker compose up --build
```

Production:

```bash
docker compose -f compose.release.yaml up --build -d
```

Access the app at **http://localhost:8000**

### Manual Setup

#### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend

```bash
cd frontend
npm install
npm run dev # or npm run build (to build the final aplication)
```

---

## 📝 Usage

- Open the app in your browser.
- The URL path is the filepath of the note (e.g., `/my-note` for `my-note.md`).
- Edit files collaboratively in real time.

---

## 📁 Project Structure

```
leaf/
├── backend/
│   ├── main.py           # FastAPI application
│   ├── requirements.txt  # Python dependencies
│   └── ...
├── frontend/
│   ├── src/              # JS source code
│   └── ...
├── data/                 # Markdown files
├── compose.yaml          # Docker Compose (dev)
├── compose.release.yaml  # Docker Compose (prod)
└── README.md
```

---

### Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend  | Vite, CodeMirror 6, Vanilla JS |
| Editor    | CodeMirror 6 with markdown support |
| Sync      | Yjs CRDT over WebSocket |
| Backend   | FastAPI, Uvicorn |
| Storage   | File system + IndexedDB |

---