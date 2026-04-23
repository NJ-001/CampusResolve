import os

class Config:
    SECRET_KEY = "campusresolve-secret-key-for-local-development-2026"
    SQLALCHEMY_DATABASE_URI = "sqlite:///campusresolve.db"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = "campusresolve-jwt-secret-key-for-local-development-2026"
    UPLOAD_FOLDER = "static/uploads"
