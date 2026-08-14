from flask import Flask
from flask_cors import CORS
from app.database import init_db
from app.routes.projects import projects_bp
from app.routes.entries import entries_bp
from app.routes.tags import tags_bp


def create_app():
    app = Flask(__name__)
    # CORS должен стоять именно здесь — это единственный Flask-инстанс,
    # который реально запускается через app.run() ниже. Раньше похожий
    # app = Flask(__name__) + CORS(app) жил в app/__init__.py, но то
    # приложение никогда не обслуживало запросы — из-за этого браузер
    # не находил Access-Control-Allow-Origin в ответе.
    CORS(app)
    init_db(app)
    app.register_blueprint(projects_bp)
    app.register_blueprint(entries_bp)
    app.register_blueprint(tags_bp)
    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, port=5000)
