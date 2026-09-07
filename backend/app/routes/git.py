from flask import Blueprint, jsonify, request

from app.git.service import get_recent_commits


git_bp = Blueprint("git", __name__, url_prefix="/api/git")


@git_bp.get("/commits")
def recent_commits():
    repo_path = request.args.get("path")
    limit = request.args.get("limit", default=10, type=int)

    if not repo_path:
        return jsonify({
            "error": "path is required"
        }), 400

    if limit < 1 or limit > 100:
        return jsonify({
            "error": "limit must be between 1 and 100"
        }), 400

    try:
        commits = get_recent_commits(repo_path, limit)
    except ValueError as exc:
        return jsonify({
            "error": str(exc)
        }), 400

    return jsonify({
        "commits": commits
    })
