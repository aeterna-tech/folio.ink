from app.database import db


entry_tags = db.Table(
    'entry_tags',
    db.Column('entry_id', db.Integer, db.ForeignKey('entry.id'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('tag.id'), primary_key=True)
)


class Tag(db.Model):
    """
    Модель тега — таблица 'tag' в SQLite.
    Теги общие для всего приложения, не привязаны к конкретному проекту:
    один и тот же тег ('bugfix') может встречаться в записях разных проектов.
    """

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(50), nullable=False, unique=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name
        }
