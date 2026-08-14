[![en](https://img.shields.io/badge/lang-en-red.svg)](README.md)
[![ru](https://img.shields.io/badge/lang-ru-blue.svg)](README.ru.md)

# folio.ink

A local desktop developer journal. Track projects, log daily entries, and view time spent statistics. All data is stored locally in SQLite.

> **Status:** early MVP, active development.

## Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri v2 (Rust) |
| Frontend | React + Vite + Tailwind CSS |
| Backend | Python + Flask + SQLAlchemy |
| Database | SQLite (local file) |
| CI/CD | GitHub Actions + PyInstaller |

## Screens

1. **Projects** — list view: name, color, description
2. **Entries** — timeline by date, time spent, what was done (Markdown)
3. **Stats** — hours per project, weekly/monthly breakdown, charts

## Out of scope for MVP

Cloud sync, authentication, custom themes, export, mobile version — planned for later phases, not part of the initial release.

## Running locally

### Backend
```bash
cd backend
pip install -r requirements.txt
python run.py
```
Server runs on `http://localhost:5000`

### Test data (optional)
```bash
python seed.py
```

Database is stored in the system app data folder, not in the project folder:

| OS | Path |
|---|---|
| Windows | `%LOCALAPPDATA%\folio.ink\` |
| macOS | `~/Library/Application Support/folio.ink/` |
| Linux | `~/.local/share/folio.ink/` |

### Frontend
```bash
npm install
npm run dev
```

## Testing

### Backend

Tests use `pytest` with an in-memory SQLite database, so they don't touch your local `folioink.db` file.

```bash
cd backend
venv\Scripts\activate      # Windows
source venv/bin/activate   # macOS/Linux
pytest
```

Currently covers the `/api/projects` routes (GET/POST) — 10 tests. As new routes (e.g. `/api/entries`) are added, tests should be added under `backend/test/`.

### Frontend

Not set up yet — planned: Vitest + React Testing Library for component tests, Playwright for E2E once more screens exist.

## License

Apache License 2.0 — see [LICENSE](LICENSE).