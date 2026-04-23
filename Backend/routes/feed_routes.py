from flask import Blueprint, jsonify
from models.complaint import Complaint
from models.vote import Vote
from models.comment import Comment
from models.user import User
from extensions import db
from routes.complaint_routes import serialize_complaint

feed_bp = Blueprint("feed", __name__, url_prefix="/feed")

@feed_bp.route("/", methods=["GET"])
def feed():
    complaints = Complaint.query.order_by(Complaint.created_at.desc()).all()
    return jsonify([serialize_complaint(complaint) for complaint in complaints])
