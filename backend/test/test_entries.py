import json
from app.models.project import Project
from app.models.entry import Entry
from datetime import date
from app.models.tag import Tag
from app.database import db


def _create_project(app, name="Тестовый проект"):
    from app.database import db
    with app.app_context():
        project = Project(name=name)
        db.session.add(project)
        db.session.commit()
        return project.id


class TestGetEntries:
    def test_404_for_unknown_project(self, client):
        response = client.get('/api/projects/999/entries')
        assert response.status_code == 404

    def test_empty_list_when_no_entries(self, client, app):
        project_id = _create_project(app)
        response = client.get(f'/api/projects/{project_id}/entries')

        assert response.status_code == 200
        assert response.get_json() == []

    def test_returns_only_entries_of_this_project(self, client, app):
        from app.database import db
        p1 = _create_project(app, "Проект 1")
        p2 = _create_project(app, "Проект 2")

        with app.app_context():
            db.session.add(Entry(project_id=p1, date=date(2026, 7, 10), duration_min=60))
            db.session.add(Entry(project_id=p2, date=date(2026, 7, 10), duration_min=30))
            db.session.commit()

        data = client.get(f'/api/projects/{p1}/entries').get_json()
        assert len(data) == 1
        assert data[0]['project_id'] == p1

    def test_sorted_newest_first(self, client, app):
        from app.database import db
        project_id = _create_project(app)

        with app.app_context():
            db.session.add(Entry(project_id=project_id, date=date(2026, 7, 1), duration_min=30))
            db.session.add(Entry(project_id=project_id, date=date(2026, 7, 10), duration_min=30))
            db.session.commit()

        data = client.get(f'/api/projects/{project_id}/entries').get_json()
        assert data[0]['date'] == "2026-07-10"
        assert data[1]['date'] == "2026-07-01"


class TestCreateEntry:
    def test_404_for_unknown_project(self, client):
        response = client.post(
            '/api/projects/999/entries',
            data=json.dumps({"duration_min": 60}),
            content_type='application/json'
        )
        assert response.status_code == 404

    def test_create_with_all_fields(self, client, app):
        project_id = _create_project(app)
        response = client.post(
            f'/api/projects/{project_id}/entries',
            data=json.dumps({"date": "2026-07-10", "duration_min": 90, "content": "сделал бэк"}),
            content_type='application/json'
        )
        data = response.get_json()

        assert response.status_code == 201
        assert data['project_id'] == project_id
        assert data['date'] == "2026-07-10"
        assert data['duration_min'] == 90
        assert data['content'] == "сделал бэк"

    def test_date_defaults_to_today_when_missing(self, client, app):
        project_id = _create_project(app)
        response = client.post(
            f'/api/projects/{project_id}/entries',
            data=json.dumps({"duration_min": 30}),
            content_type='application/json'
        )
        assert response.status_code == 201
        assert response.get_json()['date'] is not None

    def test_missing_duration_returns_400(self, client, app):
        project_id = _create_project(app)
        response = client.post(
            f'/api/projects/{project_id}/entries',
            data=json.dumps({"content": "без длительности"}),
            content_type='application/json'
        )
        assert response.status_code == 400

    def test_zero_duration_returns_400(self, client, app):
        project_id = _create_project(app)
        response = client.post(
            f'/api/projects/{project_id}/entries',
            data=json.dumps({"duration_min": 0}),
            content_type='application/json'
        )
        assert response.status_code == 400

    def test_invalid_date_returns_400(self, client, app):
        project_id = _create_project(app)
        response = client.post(
            f'/api/projects/{project_id}/entries',
            data=json.dumps({"duration_min": 30, "date": "10.07.2026"}),
            content_type='application/json'
        )
        assert response.status_code == 400


class TestGetEntry:
    def test_404_for_unknown_entry(self, client):
        assert client.get('/api/entries/999').status_code == 404

    def test_get_existing_entry(self, client, app):
        from app.database import db
        project_id = _create_project(app)
        with app.app_context():
            entry = Entry(project_id=project_id, date=date(2026, 7, 10), duration_min=45)
            db.session.add(entry)
            db.session.commit()
            entry_id = entry.id

        response = client.get(f'/api/entries/{entry_id}')
        assert response.status_code == 200
        assert response.get_json()['duration_min'] == 45


class TestUpdateEntry:
    def test_404_for_unknown_entry(self, client):
        response = client.put(
            '/api/entries/999',
            data=json.dumps({"duration_min": 20}),
            content_type='application/json'
        )
        assert response.status_code == 404

    def test_partial_update(self, client, app):
        from app.database import db
        project_id = _create_project(app)
        with app.app_context():
            entry = Entry(project_id=project_id, date=date(2026, 7, 10), duration_min=45, content="старый текст")
            db.session.add(entry)
            db.session.commit()
            entry_id = entry.id

        response = client.put(
            f'/api/entries/{entry_id}',
            data=json.dumps({"content": "новый текст"}),
            content_type='application/json'
        )
        data = response.get_json()

        assert response.status_code == 200
        assert data['content'] == "новый текст"
        assert data['duration_min'] == 45  # не тронуто

    def test_invalid_duration_returns_400(self, client, app):
        from app.database import db
        project_id = _create_project(app)
        with app.app_context():
            entry = Entry(project_id=project_id, date=date(2026, 7, 10), duration_min=45)
            db.session.add(entry)
            db.session.commit()
            entry_id = entry.id

        response = client.put(
            f'/api/entries/{entry_id}',
            data=json.dumps({"duration_min": -5}),
            content_type='application/json'
        )
        assert response.status_code == 400


class TestDeleteEntry:
    def test_404_for_unknown_entry(self, client):
        assert client.delete('/api/entries/999').status_code == 404

    def test_delete_removes_entry(self, client, app):
        from app.database import db
        project_id = _create_project(app)
        with app.app_context():
            entry = Entry(project_id=project_id, date=date(2026, 7, 10), duration_min=45)
            db.session.add(entry)
            db.session.commit()
            entry_id = entry.id

        response = client.delete(f'/api/entries/{entry_id}')
        assert response.status_code == 204

        with app.app_context():
            assert db.session.get(Entry, entry_id) is None


class TestEntryTags:
    def test_create_entry_with_tags(self, client, app):
        project_id = _create_project(app)
        response = client.post(
            f'/api/projects/{project_id}/entries',
            data=json.dumps({"duration_min": 30, "tags": ["bugfix", "api"]}),
            content_type='application/json'
        )
        data = response.get_json()

        assert response.status_code == 201
        assert set(data['tags']) == {"bugfix", "api"}

    def test_create_entry_without_tags_gives_empty_list(self, client, app):
        project_id = _create_project(app)
        response = client.post(
            f'/api/projects/{project_id}/entries',
            data=json.dumps({"duration_min": 30}),
            content_type='application/json'
        )
        data = response.get_json()

        assert response.status_code == 201
        assert data['tags'] == []

    def test_reuses_existing_tag_instead_of_duplicating(self, client, app):
        project_id = _create_project(app)

        client.post(
            f'/api/projects/{project_id}/entries',
            data=json.dumps({"duration_min": 30, "tags": ["bugfix"]}),
            content_type='application/json'
        )
        client.post(
            f'/api/projects/{project_id}/entries',
            data=json.dumps({"duration_min": 45, "tags": ["bugfix"]}),
            content_type='application/json'
        )

        with app.app_context():
            assert Tag.query.filter_by(name="bugfix").count() == 1

    def test_update_entry_replaces_tags(self, client, app):
        from app.database import db
        project_id = _create_project(app)
        with app.app_context():
            entry = Entry(project_id=project_id, date=date(2026, 7, 10), duration_min=30)
            db.session.add(entry)
            db.session.commit()
            entry_id = entry.id

        response = client.put(
            f'/api/entries/{entry_id}',
            data=json.dumps({"tags": ["refactor"]}),
            content_type='application/json'
        )
        data = response.get_json()

        assert response.status_code == 200
        assert data['tags'] == ["refactor"]

    def test_update_entry_can_clear_tags(self, client, app):
        from app.database import db
        project_id = _create_project(app)
        with app.app_context():
            entry = Entry(project_id=project_id, date=date(2026, 7, 10), duration_min=30)
            db.session.add(entry)
            db.session.commit()
            entry_id = entry.id

        client.put(
            f'/api/entries/{entry_id}',
            data=json.dumps({"tags": ["temp"]}),
            content_type='application/json'
        )
        response = client.put(
            f'/api/entries/{entry_id}',
            data=json.dumps({"tags": []}),
            content_type='application/json'
        )
        data = response.get_json()

        assert data['tags'] == []
