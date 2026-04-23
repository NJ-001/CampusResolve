from extensions import db

class Vote(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    value = db.Column(db.Integer)  # +1 or -1

    user_id = db.Column(db.Integer, db.ForeignKey("user.id"))
    complaint_id = db.Column(db.Integer, db.ForeignKey("complaint.id"))
