from flask import Blueprint, jsonify
from app.database import db
from app.models.project import Project
from app.models.entry import Entry
from app.models.tag import Tag

tags_bp = Blueprint('tags', __name__)


@tags_bp.route('/api/projects/<int:project_id>/tags', methods=['GET'])
def get_project_tags(project_id):

    project = db.session.get(Project, project_id)
    if project is None:
        return jsonify({"error": "Проект не найден"}), 404

    tags = (
        Tag.query
        .join(Tag.entries)
        .filter(Entry.project_id == project_id)
        .distinct()
        .order_by(Tag.name)
        .all()
    )

    return jsonify([t.to_dict() for t in tags])
