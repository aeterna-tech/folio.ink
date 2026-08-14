# backend/seed.py

from run import create_app
from app.database import db
from app.models.project import Project

app = create_app()

with app.app_context():
    Project.query.delete()

    projects = [
        Project(name="folio.ink", color="#1D9E75", description="Основной проект — дневник разработчика"),
        Project(name="Тестовый проект", color="#534AB7", description="Для проверки функционала"),
        Project(name="Pet-проект", color="#D85A30", description="Второй пример для статистики"),
    ]

    db.session.add_all(projects)
    db.session.commit()

    print(f"Создано {len(projects)} проектов")
