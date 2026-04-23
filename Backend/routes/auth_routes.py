from flask import Blueprint, request, jsonify
from extensions import db
from models.user import User
from models.complaint import Complaint
from models.notification import Notification
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


def _token_response(user, status_code=200):
    token = create_access_token(identity=str(user.id))
    return jsonify({
        "access_token": token,
        "user": user.to_dict(),
    }), status_code

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.json or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    college_id = (data.get("collegeId") or data.get("college_id") or "").strip()

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already exists"}), 400

    user = User(
        name=data.get("name") or "",
        email=email,
        role=data.get("role") or "student",
        department=data.get("department") or "",
        college_id=college_id,
        verified=True
    )
    user.set_password(password)

    db.session.add(user)
    db.session.commit()

    return _token_response(user, 201)

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.json or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    user = User.query.filter_by(email=email).first()

    if user and user.check_password(password):
        return _token_response(user)

    return jsonify({"error": "Invalid credentials"}), 401


@auth_bp.route("/lookup", methods=["POST"])
def lookup_user():
    data = request.json or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "Email is required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "No account found with this email."}), 404

    return jsonify({"exists": True, "user": user.to_dict()})


@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.json or {}
    email = (data.get("email") or "").strip().lower()
    new_password = data.get("newPassword") or data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "No account found."}), 404
    if len(new_password) < 8:
        return jsonify({"error": "Password too short."}), 400

    user.set_password(new_password)
    db.session.commit()
    return jsonify({"message": "Password updated successfully"})


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user = User.query.get_or_404(int(get_jwt_identity()))
    return jsonify({"user": user.to_dict()})


@auth_bp.route("/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    user = User.query.get_or_404(int(get_jwt_identity()))
    data = request.json or {}

    user.name = (data.get("name") or user.name or "").strip()
    user.mobile = (data.get("mobile") or user.mobile or "").strip()
    user.department = (data.get("department") or user.department or "").strip()
    user.branch = (data.get("branch") or user.branch or "").strip()
    user.year = (data.get("year") or user.year or "").strip()
    user.division = (data.get("division") or user.division or "").strip()
    user.roll_no = (data.get("rollNo") or data.get("roll_no") or user.roll_no or "").strip()
    user.position = (data.get("position") or user.position or "").strip()
    user.emp_id = (data.get("empId") or data.get("emp_id") or user.emp_id or "").strip()
    user.profile_done = True

    db.session.commit()
    return _token_response(user)


@auth_bp.route("/notifications", methods=["GET"])
@jwt_required()
def notifications():
    user = User.query.get_or_404(int(get_jwt_identity()))
    items = Notification.query.filter_by(user_id=user.id).order_by(Notification.created_at.desc()).limit(20).all()
    unread_count = Notification.query.filter_by(user_id=user.id, is_read=False).count()
    return jsonify({
        "notifications": [item.to_dict() for item in items],
        "unreadCount": unread_count,
    })


@auth_bp.route("/notifications/read-all", methods=["POST"])
@jwt_required()
def mark_notifications_read():
    user = User.query.get_or_404(int(get_jwt_identity()))
    Notification.query.filter_by(user_id=user.id, is_read=False).update({"is_read": True})
    db.session.commit()
    return jsonify({"message": "Notifications marked as read"})


@auth_bp.route("/public-stats", methods=["GET"])
def public_stats():
    total_complaints = Complaint.query.count()
    resolved = Complaint.query.filter_by(status="resolved").count()
    active_users = User.query.count()
    resolution_rate = int((resolved / total_complaints) * 100) if total_complaints else 0
    return jsonify({
        "totalComplaints": total_complaints,
        "resolvedComplaints": resolved,
        "resolutionRate": resolution_rate,
        "activeUsers": active_users,
    })
