from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.complaint import Complaint
from models.notification import Notification
from models.user import User
from models.vote import Vote
from models.comment import Comment
from models.internal_note import InternalNote
from datetime import datetime
from werkzeug.utils import secure_filename
import os
from uuid import uuid4

complaint_bp = Blueprint("complaint", __name__, url_prefix="/complaints")


def parse_bool(value):
    if isinstance(value, bool):
        return value
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def save_uploaded_file(file_storage, prefix):
    if not file_storage or not file_storage.filename:
        return ""
    filename = secure_filename(file_storage.filename)
    if not filename:
        return ""
    unique_name = f"{prefix}_{uuid4().hex}_{filename}"
    destination = os.path.join(current_app.config["UPLOAD_FOLDER"], unique_name)
    file_storage.save(destination)
    return unique_name


def serialize_complaint(complaint):
    user = User.query.get(complaint.user_id) if complaint.user_id else None
    assigned_user = User.query.get(complaint.assigned_to) if complaint.assigned_to else None
    score = db.session.query(db.func.coalesce(db.func.sum(Vote.value), 0)).filter_by(
        complaint_id=complaint.id
    ).scalar() or 0
    comment_count = Comment.query.filter_by(complaint_id=complaint.id).count()
    comments = Comment.query.filter_by(complaint_id=complaint.id).order_by(Comment.created_at.asc()).all()
    comment_authors = {
        comment.user_id: User.query.get(comment.user_id) if comment.user_id else None
        for comment in comments
    }
    notes = InternalNote.query.filter_by(complaint_id=complaint.id).order_by(InternalNote.created_at.desc()).all()
    note_authors = {
        note.user_id: User.query.get(note.user_id) if note.user_id else None
        for note in notes
    }
    payload = complaint.to_dict(
        author_name="Anonymous" if complaint.anonymous else (
            (user.name if user and user.name else (user.email.split("@")[0] if user else "Anonymous"))
        ),
        score=score,
        comment_count=comment_count,
        assigned_name=assigned_user.name if assigned_user and assigned_user.name else (assigned_user.email if assigned_user else None),
        internal_notes=[
            note.to_dict(
                author_name=(
                    note_authors[note.user_id].name
                    if note_authors.get(note.user_id) and note_authors[note.user_id].name
                    else (
                        note_authors[note.user_id].email
                        if note_authors.get(note.user_id)
                        else "Admin"
                    )
                )
            )
            for note in notes
        ],
    )
    base = request.host_url.rstrip("/")
    payload["imageUrl"] = f"{base}/static/uploads/{complaint.image}" if complaint.image else ""
    payload["resolutionImageUrl"] = (
        f"{base}/static/uploads/{complaint.resolution_image}" if complaint.resolution_image else ""
    )
    payload["commentItems"] = [
        comment.to_dict(
            author_name=(
                comment_authors[comment.user_id].name
                if comment_authors.get(comment.user_id) and comment_authors[comment.user_id].name
                else (
                    comment_authors[comment.user_id].email.split("@")[0]
                    if comment_authors.get(comment.user_id) and comment_authors[comment.user_id].email
                    else "User"
                )
            )
        )
        for comment in comments
    ]
    return payload

@complaint_bp.route("/create", methods=["POST"])
@jwt_required()
def create_complaint():
    data = request.form or request.json or {}
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    evidence_name = save_uploaded_file(request.files.get("evidence"), "complaint")

    complaint = Complaint(
        title=data["title"],
        description=data["description"],
        category=data["category"],
        department=data["department"],
        image=evidence_name,
        anonymous=parse_bool(data.get("anonymous", False)),
        user_id=user_id,
        updated_at=datetime.utcnow(),
    )

    db.session.add(complaint)
    db.session.commit()

    dept_admins = User.query.filter(
        User.role.in_(["dept_admin", "super_admin"]),
        User.department == complaint.department
    ).all()
    super_admins = User.query.filter_by(role="super_admin").all()
    notified_ids = set()
    for admin in [*dept_admins, *super_admins]:
        if admin.id in notified_ids:
            continue
        notified_ids.add(admin.id)
        db.session.add(Notification(
            user_id=admin.id,
            message=f"New complaint in {complaint.department}: '{complaint.title}'"
        ))
    db.session.commit()

    return jsonify({
        "message": "Complaint submitted successfully",
        "complaint": serialize_complaint(complaint),
    }), 201


@complaint_bp.route("/<int:complaint_id>/vote", methods=["POST"])
@jwt_required()
def vote_complaint(complaint_id):
    complaint = Complaint.query.get_or_404(complaint_id)
    user_id = int(get_jwt_identity())
    data = request.json or {}
    direction = int(data.get("value", 0))

    if direction not in (-1, 1):
        return jsonify({"error": "Vote must be 1 or -1"}), 400

    existing = Vote.query.filter_by(complaint_id=complaint.id, user_id=user_id).first()
    if existing and existing.value == direction:
        db.session.delete(existing)
    elif existing:
        existing.value = direction
    else:
        db.session.add(Vote(complaint_id=complaint.id, user_id=user_id, value=direction))

    db.session.commit()
    return jsonify({
        "message": "Vote recorded",
        "complaint": serialize_complaint(complaint),
    })


@complaint_bp.route("/<int:complaint_id>/comments", methods=["GET"])
@jwt_required(optional=True)
def list_comments(complaint_id):
    complaint = Complaint.query.get_or_404(complaint_id)
    return jsonify({
        "comments": serialize_complaint(complaint)["commentItems"],
        "complaint": serialize_complaint(complaint),
    })


@complaint_bp.route("/<int:complaint_id>/comments", methods=["POST"])
@jwt_required()
def add_comment(complaint_id):
    complaint = Complaint.query.get_or_404(complaint_id)
    actor = User.query.get_or_404(int(get_jwt_identity()))
    data = request.json or {}
    text = (data.get("text") or data.get("content") or "").strip()

    if not text:
        return jsonify({"error": "Comment cannot be empty."}), 400
    if len(text) > 1000:
        return jsonify({"error": "Comment is too long."}), 400

    comment = Comment(
        content=text,
        user_id=actor.id,
        complaint_id=complaint.id,
    )
    complaint.updated_at = datetime.utcnow()
    db.session.add(comment)

    if complaint.user_id and complaint.user_id != actor.id:
        db.session.add(Notification(
            user_id=complaint.user_id,
            message=f"{actor.name or actor.email} commented on your complaint '{complaint.title}'"
        ))

    db.session.commit()

    return jsonify({
        "message": "Comment added",
        "comment": comment.to_dict(author_name=actor.name or actor.email.split("@")[0]),
        "complaint": serialize_complaint(complaint),
    }), 201


@complaint_bp.route("/", methods=["GET"])
@jwt_required(optional=True)
def list_complaints():
    complaints = Complaint.query.order_by(Complaint.created_at.desc()).all()
    return jsonify([serialize_complaint(complaint) for complaint in complaints])


@complaint_bp.route("/<int:complaint_id>", methods=["DELETE"])
@jwt_required()
def delete_complaint(complaint_id):
    complaint = Complaint.query.get_or_404(complaint_id)
    actor = User.query.get_or_404(int(get_jwt_identity()))

    can_delete_any = actor.role in {"admin", "super_admin", "dept_admin"}
    is_owner = complaint.user_id == actor.id

    if not can_delete_any and not is_owner:
        return jsonify({"error": "You do not have permission to delete this complaint."}), 403

    if complaint.status == "resolved" and not can_delete_any:
        return jsonify({"error": "Only admins can delete resolved complaints."}), 403

    Vote.query.filter_by(complaint_id=complaint.id).delete()
    Comment.query.filter_by(complaint_id=complaint.id).delete()
    InternalNote.query.filter_by(complaint_id=complaint.id).delete()
    Notification.query.filter_by(user_id=complaint.user_id).filter(
        Notification.message.contains(complaint.title)
    ).delete(synchronize_session=False)
    db.session.delete(complaint)
    db.session.commit()

    return jsonify({"message": "Complaint deleted successfully", "deletedId": str(complaint_id)})
