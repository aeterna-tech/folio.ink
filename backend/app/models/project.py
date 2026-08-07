from datetime import datetime, timezone
from app.database import db


def utc_now():
    """Возвращает наивный datetime, но всегда в UTC.
    SQLite не хранит таймзоны — если писать aware-datetime,
    смещение молча теряется при сохранении. Явно приводим
    к наивному представлению, чтобы семантика 'всегда UTC'
    была осознанной, а не случайным побочным эффектом."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Project(db.Model):
    """
    Модель проекта — таблица 'project' в SQLite.
    Каждая строка = один проект пользователя (например "folio.ink", "Pet-проект")
    """

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    color = db.Column(db.String(7), nullable=True)
    description = db.Column(db.Text, nullable=True)

    # используем utc_now (без tzinfo) вместо datetime.now(timezone.utc) —
    # SQLite всё равно не хранит offset, поэтому явно приводим к наивному
    # UTC-времени, чтобы не было расхождения между тем что записано
    # в объект Python и тем что реально сохранится в базе
    created_at = db.Column(db.DateTime, default=utc_now)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "color": self.color,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }