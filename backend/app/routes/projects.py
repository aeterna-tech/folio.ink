from flask import Blueprint, request, jsonify
from app.models.entry import Entry
from app.database import db
from app.models.project import Project


projects_bp = Blueprint('projects', __name__)


@projects_bp.route('/api/projects', methods=['GET'])
def get_projects():

    all_projects = Project.query.all()
    return jsonify([p.to_dict() for p in all_projects])


@projects_bp.route('/api/projects', methods=['POST'])
def create_project():

    data = request.json

    if not data or not data.get('name'):
        return jsonify({"error": "Поле 'name' обязательно"}), 400

    new_project = Project(
        name=data.get('name'),
        color=data.get('color'),
        description=data.get('description')
    )

    db.session.add(new_project)
    db.session.commit()

    return jsonify(new_project.to_dict()), 201


@projects_bp.route('/api/projects/<int:project_id>/export', methods=['GET'])
def export_project(project_id):
    project = db.session.get(Project, project_id)
    if project is None:
        return jsonify({"error": "Проект не найден"}), 404

    entries = (
        Entry.query
        .filter_by(project_id=project_id)
        .order_by(Entry.date.desc(), Entry.id.desc())
        .all()
    )
    response = jsonify({
        "project": project.to_dict(),
        "entries": [entry.to_dict() for entry in entries]
    })
    response.headers['Content-Disposition'] = (
        f'attachment; filename="project-{project_id}-export.json"'
    )
    return response


@projects_bp.route('/api/projects/<int:project_id>', methods=['PUT'])
def update_project(project_id):

    project = db.session.get(Project, project_id)
    if project is None:
        return jsonify({"error": "Проект не найден"}), 404

    data = request.json or {}

    if 'name' in data:
        if not data['name']:
            return jsonify({"error": "Поле 'name' не может быть пустым"}), 400
        project.name = data['name']

    if 'color' in data:
        project.color = data['color']

    if 'description' in data:
        project.description = data['description']

    db.session.commit()
    return jsonify(project.to_dict())


@projects_bp.route('/api/projects/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):

    project = db.session.get(Project, project_id)
    if project is None:
        return jsonify({"error": "Проект не найден"}), 404

    Entry.query.filter_by(project_id=project_id).delete()

    db.session.delete(project)
    db.session.commit()

    return '', 204
