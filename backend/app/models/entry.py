from datetime import datetime, timezone
from app.database import db
from app.models.tag import entry_tags


def utc_now():
    """Возвращает наивный datetime, но всегда в UTC."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Entry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    date = db.Column(db.Date, nullable=False, default=lambda: datetime.now(timezone.utc).date())
    duration_min = db.Column(db.Integer, nullable=False)
    content = db.Column(db.Text, nullable=True)
    # --- НОВОЕ ПОЛЕ ---
    next_step = db.Column(db.Text, nullable=True)

    tags = db.relationship('Tag', secondary=entry_tags, backref='entries')

    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "date": self.date.isoformat() if self.date else None,
            "duration_min": self.duration_min,
            "content": self.content,
            "next_step": self.next_step,   # <- вернётся как есть (None = null в JSON)
            "tags": [tag.name for tag in self.tags]
        }
