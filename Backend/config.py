import os

class Config:
    SECRET_KEY = "campusresolve-secret-key-for-local-development-2026"
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        "sqlite:///campusresolve.db"
    )

    if SQLALCHEMY_DATABASE_URI.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URI = SQLALCHEMY_DATABASE_URI.replace(
            "postgres://",
            "postgresql://",
            1
        )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = "campusresolve-jwt-secret-key-for-local-development-2026"
    UPLOAD_FOLDER = "static/uploads"
