from extensions import db
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256))
    role = db.Column(db.String(20))  # student, staff, dept_admin, super_admin
    department = db.Column(db.String(100))
    college_id = db.Column(db.String(50))
    mobile = db.Column(db.String(20))
    branch = db.Column(db.String(100))
    year = db.Column(db.String(20))
    division = db.Column(db.String(20))
    roll_no = db.Column(db.String(50))
    position = db.Column(db.String(100))
    emp_id = db.Column(db.String(50))
    profile_done = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    verified = db.Column(db.Boolean, default=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name or "",
            "email": self.email,
            "role": self.role,
            "department": self.department or "",
            "collegeId": self.college_id or "",
            "mobile": self.mobile or "",
            "branch": self.branch or "",
            "year": self.year or "",
            "division": self.division or "",
            "rollNo": self.roll_no or "",
            "position": self.position or "",
            "empId": self.emp_id or "",
            "profileDone": bool(self.profile_done),
            "verified": bool(self.verified),
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
