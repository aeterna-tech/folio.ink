import pytest
from app.database import db
from app.routes.projects import projects_bp
from app.routes.entries import entries_bp
from app.routes.tags import tags_bp
from app.models.project import Project  # noqa: F401
from app.models.entry import Entry  # noqa: F401
from app.models.tag import Tag  # noqa: F401


def create_test_app():
    from flask import Flask

    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['TESTING'] = True

    db.init_app(app)
    app.register_blueprint(projects_bp)
    app.register_blueprint(entries_bp)
    app.register_blueprint(tags_bp)

    return app


@pytest.fixture
def app():
    app = create_test_app()

    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()
