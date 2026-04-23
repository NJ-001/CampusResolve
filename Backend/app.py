from flask import Flask, render_template
from config import Config
from extensions import db, jwt, migrate
from routes import auth_routes, complaint_routes, admin_routes, feed_routes
from models.user import User
from models.internal_note import InternalNote
from sqlalchemy import text
import os


USER_COLUMN_DEFS = {
    "college_id": "VARCHAR(50)",
    "mobile": "VARCHAR(20)",
    "branch": "VARCHAR(100)",
    "year": "VARCHAR(20)",
    "division": "VARCHAR(20)",
    "roll_no": "VARCHAR(50)",
    "position": "VARCHAR(100)",
    "emp_id": "VARCHAR(50)",
    "profile_done": "BOOLEAN DEFAULT 0",
    "created_at": "DATETIME",
}

COMPLAINT_COLUMN_DEFS = {
    "anonymous": "BOOLEAN DEFAULT 0",
    "updated_at": "DATETIME",
    "resolution_image": "VARCHAR(200)",
}


def _ensure_table_columns(connection, table_name, column_defs):
    existing = {
        row[1]
        for row in connection.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
    }
    for column_name, column_def in column_defs.items():
        if column_name not in existing:
            connection.execute(
                text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_def}")
            )


def _ensure_schema(app):
    with app.app_context():
        db.create_all()
        with db.engine.begin() as connection:
            _ensure_table_columns(connection, "user", USER_COLUMN_DEFS)
            _ensure_table_columns(connection, "complaint", COMPLAINT_COLUMN_DEFS)


def _seed_default_staff():
    seed_users = [
        {
            "name": "Super Admin",
            "email": "admin@campusresolve.com",
            "password": "Admin@123",
            "role": "admin",
            "department": "Administration Office",
            "profile_done": True,
        },
        {
            "name": "Rahul Sharma",
            "email": "rahul@campusresolve.com",
            "password": "Staff@123",
            "role": "staff",
            "department": "Facilities Management",
            "profile_done": True,
        },
        {
            "name": "Anjali Verma",
            "email": "anjali@campusresolve.com",
            "password": "Staff@123",
            "role": "staff",
            "department": "Information Technology",
            "profile_done": True,
        },
    ]

    for payload in seed_users:
        if User.query.filter_by(email=payload["email"]).first():
            continue
        user = User(
            name=payload["name"],
            email=payload["email"],
            role=payload["role"],
            department=payload["department"],
            verified=True,
            profile_done=payload["profile_done"],
        )
        user.set_password(payload["password"])
        db.session.add(user)
    db.session.commit()


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    jwt.init_app(app)
    migrate.init_app(app, db)

    app.register_blueprint(auth_routes.auth_bp)
    app.register_blueprint(complaint_routes.complaint_bp)
    app.register_blueprint(admin_routes.admin_bp)
    app.register_blueprint(feed_routes.feed_bp)

    @app.after_request
    def add_cors_headers(response):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        return response

    _ensure_schema(app)
    with app.app_context():
        os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
        _seed_default_staff()

    return app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True)

@app.route("/")
def home():
    return render_template("index.html")
