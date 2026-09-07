import os
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
    # debug=True запускает Flask reloader, который порождает ДВА процесса
    # (родительский монитор + рабочий) — это ломает graceful shutdown
    # sidecar-процесса из Tauri, потому что kill() убивает только один
    # из двух. Debug включаем явно через переменную окружения — для
    # обычной разработки (python run.py вручную), но не для sidecar
    # внутри собранного приложения, где reloader не нужен и вреден.
    is_dev = os.environ.get('FOLIO_DEV') == '1'
    app.run(debug=is_dev, port=5000)
