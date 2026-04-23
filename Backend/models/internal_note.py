from extensions import db
from datetime import datetime


class InternalNote(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    complaint_id = db.Column(db.Integer, db.ForeignKey("complaint.id"), nullable=False)

    def to_dict(self, *, author_name="Admin"):
        return {
            "id": self.id,
            "by": author_name,
            "text": self.text,
            "at": self.created_at.isoformat() if self.created_at else None,
        }
