from datetime import datetime
from flask import Blueprint, request, jsonify
from app.database import db
from app.models.entry import Entry
from app.models.project import Project
from app.models.tag import Tag

entries_bp = Blueprint('entries', __name__)


def _parse_date(date_str):

    try:
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    except (ValueError, TypeError):
        return None


def _resolve_tags(tag_names):

    tags = []
    seen = set()

    for name in tag_names:
        name = name.strip()
        if not name or name in seen:
            continue
        seen.add(name)

        tag = Tag.query.filter_by(name=name).first()
        if tag is None:
            tag = Tag(name=name)
            db.session.add(tag)

        tags.append(tag)

    return tags


@entries_bp.route('/api/projects/<int:project_id>/entries', methods=['GET'])
def get_entries(project_id):
    """
    Список записей внутри конкретного проекта, свежие сверху.
    """
    project = db.session.get(Project, project_id)
    if project is None:
        return jsonify({"error": "Проект не найден"}), 404

    entries = (
        Entry.query
        .filter_by(project_id=project_id)
        .order_by(Entry.date.desc(), Entry.id.desc())
        .all()
    )
    return jsonify([e.to_dict() for e in entries])


@entries_bp.route('/api/projects/<int:project_id>/entries', methods=['POST'])
def create_entry(project_id):

    project = db.session.get(Project, project_id)
    if project is None:
        return jsonify({"error": "Проект не найден"}), 404

    data = request.json or {}

    if data.get('duration_min') is None:
        return jsonify({"error": "Поле 'duration_min' обязательно"}), 400

    try:
        duration_min = int(data['duration_min'])
    except (TypeError, ValueError):
        return jsonify({"error": "'duration_min' должно быть целым числом"}), 400

    if duration_min <= 0:
        return jsonify({"error": "'duration_min' должно быть больше нуля"}), 400

    if data.get('date'):
        entry_date = _parse_date(data['date'])
        if entry_date is None:
            return jsonify({"error": "Поле 'date' должно быть в формате YYYY-MM-DD"}), 400
    else:
        entry_date = datetime.utcnow().date()

    tags = _resolve_tags(data.get('tags', []))

    new_entry = Entry(
        project_id=project_id,
        date=entry_date,
        duration_min=duration_min,
        content=data.get('content'),
        tags=tags
    )

    db.session.add(new_entry)
    db.session.commit()

    return jsonify(new_entry.to_dict()), 201


@entries_bp.route('/api/entries/<int:entry_id>', methods=['GET'])
def get_entry(entry_id):
    entry = db.session.get(Entry, entry_id)
    if entry is None:
        return jsonify({"error": "Запись не найдена"}), 404
    return jsonify(entry.to_dict())


@entries_bp.route('/api/entries/<int:entry_id>', methods=['PUT'])
def update_entry(entry_id):

    entry = db.session.get(Entry, entry_id)
    if entry is None:
        return jsonify({"error": "Запись не найдена"}), 404

    data = request.json or {}

    if 'duration_min' in data:
        try:
            duration_min = int(data['duration_min'])
        except (TypeError, ValueError):
            return jsonify({"error": "'duration_min' должно быть целым числом"}), 400
        if duration_min <= 0:
            return jsonify({"error": "'duration_min' должно быть больше нуля"}), 400
        entry.duration_min = duration_min

    if 'date' in data:
        parsed = _parse_date(data['date'])
        if parsed is None:
            return jsonify({"error": "Поле 'date' должно быть в формате YYYY-MM-DD"}), 400
        entry.date = parsed

    if 'content' in data:
        entry.content = data['content']

    if 'tags' in data:
        entry.tags = _resolve_tags(data['tags'])

    db.session.commit()
    return jsonify(entry.to_dict())


@entries_bp.route('/api/entries/<int:entry_id>', methods=['DELETE'])
def delete_entry(entry_id):
    entry = db.session.get(Entry, entry_id)
    if entry is None:
        return jsonify({"error": "Запись не найдена"}), 404

    db.session.delete(entry)
    db.session.commit()

    return '', 204
