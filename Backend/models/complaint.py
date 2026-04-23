from extensions import db
from datetime import datetime

class Complaint(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200))
    description = db.Column(db.Text)
    category = db.Column(db.String(100))
    department = db.Column(db.String(100))
    image = db.Column(db.String(200))
    resolution_image = db.Column(db.String(200))
    status = db.Column(db.String(30), default="open")
    anonymous = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    user_id = db.Column(db.Integer, db.ForeignKey("user.id"))
    assigned_to = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)

    def to_dict(self, *, author_name=None, score=0, comment_count=0, assigned_name=None, internal_notes=None):
        return {
            "id": str(self.id),
            "title": self.title,
            "description": self.description or "",
            "category": self.category or "",
            "department": self.department or "",
            "status": self.status or "open",
            "image": self.image or "",
            "resolutionImage": self.resolution_image or "",
            "anonymous": bool(self.anonymous),
            "authorId": str(self.user_id) if self.user_id is not None else None,
            "authorName": author_name or "Anonymous",
            "score": score,
            "upvotes": max(score, 0),
            "downvotes": abs(min(score, 0)),
            "comments": comment_count,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
            "assignedTo": str(self.assigned_to) if self.assigned_to is not None else None,
            "assignedName": assigned_name,
            "internalNotes": internal_notes or [],
        }
