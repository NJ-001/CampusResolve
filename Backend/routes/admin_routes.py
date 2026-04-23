from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.decorators import role_required
from extensions import db
from models.complaint import Complaint
from models.notification import Notification
from models.user import User
from models.internal_note import InternalNote
from datetime import datetime
from routes.complaint_routes import serialize_complaint
from routes.complaint_routes import save_uploaded_file

admin_bp = Blueprint("admin", __name__, url_prefix="/admin")

PROMOTABLE_ROLES = {"student", "staff", "dept_admin", "admin", "super_admin"}


@admin_bp.route("/users", methods=["GET"])
@jwt_required()
@role_required(["admin", "dept_admin", "super_admin"])
def list_users():
    users = User.query.order_by(User.created_at.desc(), User.id.desc()).all()
    return jsonify([user.to_dict() for user in users])


@admin_bp.route("/users/<int:user_id>/role", methods=["POST"])
@jwt_required()
@role_required(["super_admin"])
def update_user_role(user_id):
    actor_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    data = request.json or {}
    new_role = (data.get("role") or "").strip()

    if new_role not in PROMOTABLE_ROLES:
        return jsonify({"error": "Invalid role"}), 400
    if user.id == actor_id and new_role != "super_admin":
        return jsonify({"error": "Super admins cannot demote themselves."}), 400
    if user.role == "super_admin" and new_role != "super_admin":
        return jsonify({"error": "Use a different super admin account before changing this role."}), 400

    user.role = new_role
    db.session.commit()

    return jsonify({
        "message": "User role updated successfully",
        "user": user.to_dict(),
    })

@admin_bp.route("/update-status/<int:cid>", methods=["POST"])
@jwt_required()
@role_required(["admin", "dept_admin", "super_admin"])
def update_status(cid):
    complaint = Complaint.query.get_or_404(cid)
    data = request.form or request.json or {}
    complaint.status = data["status"]
    complaint.updated_at = datetime.utcnow()
    if complaint.status == "resolved":
        resolution_image = save_uploaded_file(request.files.get("resolutionImage"), "resolution")
        if resolution_image:
            complaint.resolution_image = resolution_image

    notification = Notification(
        user_id=complaint.user_id,
        message=f"Your complaint '{complaint.title}' is now {complaint.status}"
    )

    db.session.add(notification)
    db.session.commit()

    return jsonify({
        "message": "Status updated and user notified",
        "complaint": serialize_complaint(complaint),
    })


@admin_bp.route("/assign/<int:cid>", methods=["POST"])
@jwt_required()
@role_required(["admin", "dept_admin", "super_admin"])
def assign_complaint(cid):
    complaint = Complaint.query.get_or_404(cid)
    data = request.json or {}
    staff_id = data.get("staffId")

    if not staff_id:
        return jsonify({"error": "Staff user is required"}), 400

    assignee = User.query.get_or_404(int(staff_id))
    if assignee.role not in {"staff", "admin", "dept_admin", "super_admin"}:
        return jsonify({"error": "Selected user cannot be assigned complaints"}), 400

    complaint.assigned_to = assignee.id
    complaint.status = "assigned"
    complaint.updated_at = datetime.utcnow()
    db.session.add(Notification(
        user_id=assignee.id,
        message=f"You were assigned complaint '{complaint.title}'"
    ))
    db.session.commit()

    return jsonify({
        "message": "Complaint assigned successfully",
        "complaint": serialize_complaint(complaint),
    })


@admin_bp.route("/notes/<int:cid>", methods=["POST"])
@jwt_required()
@role_required(["admin", "dept_admin", "super_admin"])
def add_internal_note(cid):
    complaint = Complaint.query.get_or_404(cid)
    data = request.json or {}
    text = (data.get("text") or "").strip()
    actor = User.query.get_or_404(int(get_jwt_identity()))

    if not text:
        return jsonify({"error": "Note text is required"}), 400

    note = InternalNote(
        text=text,
        user_id=actor.id,
        complaint_id=complaint.id,
    )
    complaint.updated_at = datetime.utcnow()

    db.session.add(note)
    db.session.commit()

    return jsonify({
        "message": "Internal note added successfully",
        "note": note.to_dict(author_name=actor.name or actor.email),
        "complaint": serialize_complaint(complaint),
    }), 201
