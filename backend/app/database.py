# backend/app/database.py
#
# Этот файл — единая точка входа для работы с базой данных.
# Все модели и все роуты импортируют объект `db` отсюда,
# а не создают свои подключения — иначе будет несколько несвязанных баз.

import os
from platformdirs import user_data_dir
from flask_sqlalchemy import SQLAlchemy

# db=мост между Flask и SQLite.
# Создаётся один раз здесь. В models/project.py и models/entry.py
# нужно писать: from app.database import db
# и наследовать классы моделей от db.Model
db = SQLAlchemy()

# имя приложения используется platformdirs чтобы создать
# правильную системную папку данных на любой ОС
APP_NAME = "folio.ink"


def get_db_path():
    """
    Возвращает кроссплатформенный путь к файлу базы данных.
    """
    # appname и appauthor — platformdirs использует их чтобы построить путь.
    # Если appauthor не указан явно, на Windows он по умолчанию
    # дублирует appname, отсюда и вложенность folio.ink/folio.ink
    data_dir = user_data_dir(appname=APP_NAME, appauthor=False)

    os.makedirs(data_dir, exist_ok=True)

    return os.path.join(data_dir, "folioink.db")


def init_db(app):
    """
    Подключает базу данных к Flask-приложению.
    Вызывается один раз при старте — внутри create_app() в run.py.
    Больше нигде вызывать не нужно.
    """

    db_path = get_db_path()

    # sqlite:/// + абсолютный путь к файлу.
    # Раньше здесь было относительное 'sqlite:///folioink.db' —
    # проблема была в том что относительный путь зависит от того,
    # ИЗ КАКОЙ ПАПКИ запущен процесс, а не от того где лежит код.
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'

    # отключаем трекинг изменений SQLAlchemy — фича которая нам не нужна
    # и создаёт лишнюю нагрузку, стандартно отключается везде
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # привязываем db к конкретному Flask-приложению
    db.init_app(app)

    # app_context нужен потому что Flask требует явно сказать
    # "сейчас мы работаем в контексте приложения" перед операциями с базой
    with app.app_context():
        # create_all() смотрит на все классы-модели (Project, Entry и т.д.)
        # и создаёт для них таблицы, ЕСЛИ они ещё не существуют.
        # Если таблицы уже есть — ничего не делает, безопасно вызывать много раз.
        #
        # ВАЖНО: чтобы это сработало, модели (Project, Entry) должны быть
        # импортированы ДО вызова create_all(), иначе SQLAlchemy о них не узнает.
        db.create_all()


def get_db():
    """
    Хелпер для получения текущей сессии базы данных.
    Используется в routes.py для запросов, например:

        from app.database import get_db
        session = get_db()
        projects = session.query(Project).all()

    Хотя чаще пишут напрямую через db.session — это то же самое,
    просто get_db() как явная точка входа, если понадобится подменить логику.
    """
    return db.session
