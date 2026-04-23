from extensions import db
from datetime import datetime

class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user_id = db.Column(db.Integer, db.ForeignKey("user.id"))
    complaint_id = db.Column(db.Integer, db.ForeignKey("complaint.id"))

    def to_dict(self, author_name=None):
        return {
            "id": str(self.id),
            "text": self.content or "",
            "authorId": str(self.user_id) if self.user_id is not None else None,
            "authorName": author_name or "User",
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
