from functools import wraps
from flask_jwt_extended import get_jwt_identity
from flask import jsonify
from models.user import User

def role_required(roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = User.query.get(get_jwt_identity())
            if user.role not in roles:
                return jsonify({"error": "Access denied"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator
