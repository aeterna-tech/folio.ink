import json
from app.models.project import Project


def _create_project(app, name="Тестовый проект"):
    from app.database import db
    with app.app_context():
        project = Project(name=name)
        db.session.add(project)
        db.session.commit()
        return project.id


class TestGetProjectTags:
    def test_404_for_unknown_project(self, client):
        response = client.get('/api/projects/999/tags')
        assert response.status_code == 404

    def test_empty_list_when_no_tags(self, client, app):
        project_id = _create_project(app)
        response = client.get(f'/api/projects/{project_id}/tags')

        assert response.status_code == 200
        assert response.get_json() == []

    def test_returns_tags_used_in_project_entries(self, client, app):
        project_id = _create_project(app)

        client.post(
            f'/api/projects/{project_id}/entries',
            data=json.dumps({"duration_min": 30, "tags": ["bugfix", "api"]}),
            content_type='application/json'
        )

        response = client.get(f'/api/projects/{project_id}/tags')
        data = response.get_json()

        names = {t['name'] for t in data}
        assert names == {"bugfix", "api"}

    def test_does_not_return_tags_from_other_projects(self, client, app):
        p1 = _create_project(app, "Проект 1")
        p2 = _create_project(app, "Проект 2")

        client.post(
            f'/api/projects/{p1}/entries',
            data=json.dumps({"duration_min": 30, "tags": ["only-in-p1"]}),
            content_type='application/json'
        )
        client.post(
            f'/api/projects/{p2}/entries',
            data=json.dumps({"duration_min": 30, "tags": ["only-in-p2"]}),
            content_type='application/json'
        )

        data = client.get(f'/api/projects/{p1}/tags').get_json()
        names = {t['name'] for t in data}

        assert names == {"only-in-p1"}

    def test_no_duplicate_tags_when_used_in_multiple_entries(self, client, app):
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

        data = client.get(f'/api/projects/{project_id}/tags').get_json()

        assert len(data) == 1
        assert data[0]['name'] == "bugfix"

    def test_sorted_alphabetically(self, client, app):
        project_id = _create_project(app)

        client.post(
            f'/api/projects/{project_id}/entries',
            data=json.dumps({"duration_min": 30, "tags": ["zebra", "api"]}),
            content_type='application/json'
        )

        data = client.get(f'/api/projects/{project_id}/tags').get_json()
        names = [t['name'] for t in data]

        assert names == ["api", "zebra"]
