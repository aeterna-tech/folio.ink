[![en](https://img.shields.io/badge/lang-en-red.svg)](README.md)
[![ru](https://img.shields.io/badge/lang-ru-blue.svg)](README.ru.md)

# folio.ink

Локальный десктопный дневник разработчика. Трекинг проектов, ведение записей по дням, просмотр статистики потраченного времени. Все данные хранятся локально в SQLite.

> **Статус:** ранний MVP, активная разработка.

## Стек

| Слой | Технология |
|---|---|
| Десктоп-оболочка | Tauri v2 (Rust) |
| Фронтенд | React + Vite + Tailwind CSS |
| Бэкенд | Python + Flask + SQLAlchemy |
| БД | SQLite (локальный файл) |
| CI/CD | GitHub Actions + PyInstaller |

## Экраны

1. **Проекты** — список: название, цвет, описание
2. **Записи** — таймлайн по датам, время, что сделано (Markdown)
3. **Статистика** — часы по проектам, разбивка по неделям/месяцам, графики

## Вне скоупа MVP

Облачная синхронизация, авторизация, кастомные темы, экспорт, мобильная версия — задачи следующих фаз, не входят в первый релиз.

## Как запустить локально

### Backend

```bash
cd backend
pip install -r requirements.txt
python run.py
```

Сервер поднимается на `http://localhost:5000`

### Тестовые данные

```bash
python seed.py
```

База данных хранится в системной папке приложения, а не в папке проекта:

| ОС | Путь |
|---|---|
| Windows | `%LOCALAPPDATA%\folio.ink\` |
| macOS | `~/Library/Application Support/folio.ink/` |
| Linux | `~/.local/share/folio.ink/` |

## Тестирование

### Backend

Тесты используют `pytest` с in-memory SQLite базой, поэтому они не трогают локальный файл `folioink.db`.

```bash
cd backend
venv\Scripts\activate      # Windows
source venv/bin/activate   # macOS/Linux
pytest
```

Сейчас покрывает роуты `/api/projects` (GET/POST) — 10 тестов. При добавлении новых роутов (например `/api/entries`) тесты нужно добавлять в `backend/test/`.

### Frontend

Пока не настроено — планируется: Vitest + React Testing Library для компонентных тестов, Playwright для E2E когда появится больше экранов.

### Frontend

```bash
npm install
npm run dev
```

## Лицензия

Apache License 2.0 — см. [LICENSE](LICENSE).