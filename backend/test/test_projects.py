import json
from app.models.project import Project
from datetime import date


class TestGetProjects:
    def test_empty_list_when_no_projects(self, client):
        response = client.get('/api/projects')

        assert response.status_code == 200
        assert response.get_json() == []

    def test_returns_created_projects(self, client, app):
        from app.database import db

        with app.app_context():
            db.session.add(Project(name="folio.ink", color="#1D9E75", description="дневник разработчика"))
            db.session.add(Project(name="Pet-проект"))
            db.session.commit()

        response = client.get('/api/projects')
        data = response.get_json()

        assert response.status_code == 200
        assert len(data) == 2
        names = {p['name'] for p in data}
        assert names == {"folio.ink", "Pet-проект"}

    def test_response_shape(self, client, app):
        from app.database import db

        with app.app_context():
            db.session.add(Project(name="Тест", color="#ABCDEF", description="описание"))
            db.session.commit()

        data = client.get('/api/projects').get_json()[0]

        assert set(data.keys()) == {"id", "name", "color", "description", "created_at"}
        assert data["name"] == "Тест"
        assert data["color"] == "#ABCDEF"
        assert data["description"] == "описание"
        assert data["created_at"] is not None


class TestCreateProject:
    def test_create_with_all_fields(self, client):
        response = client.post(
            '/api/projects',
            data=json.dumps({
                "name": "Новый проект",
                "color": "#112233",
                "description": "описание проекта"
            }),
            content_type='application/json'
        )
        data = response.get_json()

        assert response.status_code == 201
        assert data["name"] == "Новый проект"
        assert data["color"] == "#112233"
        assert data["description"] == "описание проекта"
        assert data["id"] is not None

    def test_create_with_only_required_field(self, client):
        response = client.post(
            '/api/projects',
            data=json.dumps({"name": "Минимальный проект"}),
            content_type='application/json'
        )
        data = response.get_json()

        assert response.status_code == 201
        assert data["name"] == "Минимальный проект"
        assert data["color"] is None
        assert data["description"] is None

    def test_missing_name_returns_400(self, client):
        response = client.post(
            '/api/projects',
            data=json.dumps({"color": "#000000"}),
            content_type='application/json'
        )

        assert response.status_code == 400
        assert "error" in response.get_json()

    def test_empty_name_returns_400(self, client):
        response = client.post(
            '/api/projects',
            data=json.dumps({"name": ""}),
            content_type='application/json'
        )

        assert response.status_code == 400

    def test_empty_body_returns_400(self, client):
        response = client.post(
            '/api/projects',
            data=json.dumps({}),
            content_type='application/json'
        )

        assert response.status_code == 400

    def test_created_project_is_persisted(self, client, app):
        client.post(
            '/api/projects',
            data=json.dumps({"name": "Проверка сохранения"}),
            content_type='application/json'
        )

        with app.app_context():
            saved = Project.query.filter_by(name="Проверка сохранения").first()
            assert saved is not None

    def test_create_then_get_returns_it(self, client):
        client.post(
            '/api/projects',
            data=json.dumps({"name": "Видимый проект"}),
            content_type='application/json'
        )

        response = client.get('/api/projects')
        names = [p['name'] for p in response.get_json()]

        assert "Видимый проект" in names


class TestUpdateProject:
    def test_404_for_unknown_project(self, client):
        response = client.put(
            '/api/projects/999',
            data=json.dumps({"name": "новое имя"}),
            content_type='application/json'
        )
        assert response.status_code == 404

    def test_partial_update(self, client, app):
        from app.database import db
        with app.app_context():
            project = Project(name="Старое имя", color="#111111")
            db.session.add(project)
            db.session.commit()
            project_id = project.id

        response = client.put(
            f'/api/projects/{project_id}',
            data=json.dumps({"color": "#222222"}),
            content_type='application/json'
        )
        data = response.get_json()

        assert response.status_code == 200
        assert data['color'] == "#222222"
        assert data['name'] == "Старое имя"  # не тронуто

    def test_empty_name_returns_400(self, client, app):
        from app.database import db
        with app.app_context():
            project = Project(name="Проект")
            db.session.add(project)
            db.session.commit()
            project_id = project.id

        response = client.put(
            f'/api/projects/{project_id}',
            data=json.dumps({"name": ""}),
            content_type='application/json'
        )
        assert response.status_code == 400


class TestExportProject:
    def test_exports_project_with_its_entries(self, client, app):
        from app.database import db
        from app.models.entry import Entry
        from app.models.tag import Tag

        with app.app_context():
            project = Project(
                name="Экспортируемый проект",
                color="#123456",
                description="Описание"
            )
            other_project = Project(name="Другой проект")
            tag = Tag(name="backend")
            db.session.add_all([project, other_project, tag])
            db.session.flush()

            older_entry = Entry(
                project_id=project.id,
                date=date(2026, 7, 10),
                duration_min=30,
                content="Первая запись",
                tags=[tag]
            )
            newer_entry = Entry(
                project_id=project.id,
                date=date(2026, 7, 11),
                duration_min=45,
                content="Вторая запись"
            )
            other_entry = Entry(
                project_id=other_project.id,
                date=date(2026, 7, 12),
                duration_min=60,
                content="Чужая запись"
            )
            db.session.add_all([older_entry, newer_entry, other_entry])
            db.session.commit()
            project_id = project.id

        response = client.get(f'/api/projects/{project_id}/export')
        data = response.get_json()

        assert response.status_code == 200
        assert response.mimetype == 'application/json'
        assert response.headers['Content-Disposition'] == (
            f'attachment; filename="project-{project_id}-export.json"'
        )
        assert data['project']['id'] == project_id
        assert data['project']['name'] == "Экспортируемый проект"
        assert [entry['content'] for entry in data['entries']] == [
            "Вторая запись",
            "Первая запись"
        ]
        assert data['entries'][1]['tags'] == ["backend"]
        assert all(
            entry['project_id'] == project_id
            for entry in data['entries']
        )

    def test_404_for_unknown_project(self, client):
        response = client.get('/api/projects/999/export')

        assert response.status_code == 404
        assert "error" in response.get_json()

    def test_export_as_markdown(self, client, app):
        from app.database import db
        from app.models.entry import Entry
        from app.models.tag import Tag

        with app.app_context():
            project = Project(
                name="Экспортируемый проект",
                color="#123456",
                description="Описание проекта"
            )
            tag = Tag(name="backend")
            db.session.add_all([project, tag])
            db.session.flush()

            entry = Entry(
                project_id=project.id,
                date=date(2026, 7, 10),
                duration_min=30,
                content="Первая запись",
                tags=[tag]
            )
            db.session.add(entry)
            db.session.commit()
            project_id = project.id

        response = client.get(f'/api/projects/{project_id}/export?format=md')
        text = response.get_data(as_text=True)

        assert response.status_code == 200
        assert response.mimetype == 'text/markdown'
        assert response.headers['Content-Disposition'] == (
            f'attachment; filename="project-{project_id}-export.md"'
        )
        assert text.startswith("# Экспортируемый проект")
        assert "Описание проекта" in text
        assert "## 2026-07-10 · #backend" in text
        assert "**30 мин**" in text
        assert "Первая запись" in text

    def test_export_markdown_without_description_or_tags(self, client, app):
        from app.database import db
        from app.models.entry import Entry

        with app.app_context():
            project = Project(name="Простой проект")
            db.session.add(project)
            db.session.flush()

            entry = Entry(
                project_id=project.id,
                date=date(2026, 7, 10),
                duration_min=15
            )
            db.session.add(entry)
            db.session.commit()
            project_id = project.id

        response = client.get(f'/api/projects/{project_id}/export?format=md')
        text = response.get_data(as_text=True)

        assert response.status_code == 200
        assert text.startswith("# Простой проект")
        assert "## 2026-07-10" in text
        assert "·" not in text

    def test_json_is_still_default_format(self, client, app):
        with app.app_context():
            project = Project(name="Проект по умолчанию")
            from app.database import db
            db.session.add(project)
            db.session.commit()
            project_id = project.id

        response = client.get(f'/api/projects/{project_id}/export')

        assert response.mimetype == 'application/json'

    def test_404_for_unknown_project_markdown(self, client):
        response = client.get('/api/projects/999/export?format=md')

        assert response.status_code == 404


class TestDeleteProject:
    def test_404_for_unknown_project(self, client):
        assert client.delete('/api/projects/999').status_code == 404

    def test_delete_removes_project(self, client, app):
        from app.database import db
        with app.app_context():
            project = Project(name="На удаление")
            db.session.add(project)
            db.session.commit()
            project_id = project.id

        response = client.delete(f'/api/projects/{project_id}')
        assert response.status_code == 204

        with app.app_context():
            assert db.session.get(Project, project_id) is None

    def test_delete_cascades_to_entries(self, client, app):
        from app.database import db
        from app.models.entry import Entry

        with app.app_context():
            project = Project(name="С записями")
            db.session.add(project)
            db.session.commit()
            project_id = project.id
            db.session.add(Entry(project_id=project_id, date=date(2026, 7, 10), duration_min=30))
            db.session.commit()

        client.delete(f'/api/projects/{project_id}')

        with app.app_context():
            assert Entry.query.filter_by(project_id=project_id).count() == 0


class TestGetProjectById:
    def test_404_for_unknown_project(self, client):
        response = client.get('/api/projects/999')

        assert response.status_code == 404
        assert "error" in response.get_json()

    def test_returns_project_with_null_next_step(self, client, app):
        from app.database import db

        with app.app_context():
            project = Project(name="Проект по id", color="#AABBCC", description="описание")
            db.session.add(project)
            db.session.commit()
            project_id = project.id

        data = client.get(f'/api/projects/{project_id}').get_json()

        assert data["name"] == "Проект по id"
        assert data["color"] == "#AABBCC"
        assert data["last_next_step"] is None

    def test_returns_last_next_step(self, client, app):
        from app.database import db
        from app.models.entry import Entry

        with app.app_context():
            project = Project(name="С шагами")
            db.session.add(project)
            db.session.flush()

            older = Entry(project_id=project.id, date=date(2026, 9, 1),
                          duration_min=30, next_step="старый шаг")
            newer = Entry(project_id=project.id, date=date(2026, 9, 3),
                          duration_min=45, next_step="свежий шаг")
            db.session.add_all([older, newer])
            db.session.commit()
            project_id = project.id
            newer_id = newer.id

        data = client.get(f'/api/projects/{project_id}').get_json()

        assert data["last_next_step"]["text"] == "свежий шаг"
        assert data["last_next_step"]["entry_id"] == newer_id
        assert data["last_next_step"]["entry_date"] == "2026-09-03"

    def test_null_when_entries_have_no_next_step(self, client, app):
        from app.database import db
        from app.models.entry import Entry

        with app.app_context():
            project = Project(name="Без шагов")
            db.session.add(project)
            db.session.flush()

            db.session.add(Entry(project_id=project.id, date=date(2026, 9, 1),
                                 duration_min=30, content="просто запись"))
            db.session.add(Entry(project_id=project.id, date=date(2026, 9, 2),
                                 duration_min=30, next_step=""))
            db.session.commit()
            project_id = project.id

        data = client.get(f'/api/projects/{project_id}').get_json()

        assert data["last_next_step"] is None

    def test_same_date_picks_newer_entry(self, client, app):
        from app.database import db
        from app.models.entry import Entry

        with app.app_context():
            project = Project(name="Одна дата")
            db.session.add(project)
            db.session.flush()

            first = Entry(project_id=project.id, date=date(2026, 9, 3),
                          duration_min=10, next_step="первый")
            second = Entry(project_id=project.id, date=date(2026, 9, 3),
                           duration_min=20, next_step="второй")
            db.session.add_all([first, second])
            db.session.commit()
            project_id = project.id

        data = client.get(f'/api/projects/{project_id}').get_json()

        assert data["last_next_step"]["text"] == "второй"

    def test_does_not_mix_entries_of_other_projects(self, client, app):
        from app.database import db
        from app.models.entry import Entry

        with app.app_context():
            project = Project(name="Свой")
            other = Project(name="Чужой")
            db.session.add_all([project, other])
            db.session.flush()

            db.session.add(Entry(project_id=project.id, date=date(2026, 9, 1),
                                 duration_min=10, next_step="свой шаг"))
            db.session.add(Entry(project_id=other.id, date=date(2026, 9, 4),
                                 duration_min=10, next_step="чужой шаг"))
            db.session.commit()
            project_id = project.id

        data = client.get(f'/api/projects/{project_id}').get_json()

        assert data["last_next_step"]["text"] == "свой шаг"
