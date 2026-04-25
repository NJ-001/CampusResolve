# CampusResolve

CampusResolve is a full-stack campus complaint management portal where students can raise issues, attach evidence, vote on complaints, comment on updates, and track resolution progress. Admins and department staff can review complaints, assign work, update statuses, add internal notes, upload resolution proof, and notify users.

## Features

- Student registration and login with JWT authentication
- Profile setup for students and staff
- Complaint submission with category, department, anonymity option, and evidence upload
- Public complaint feed with search, filters, sorting, voting, and comments
- Admin dashboard for complaint status updates, staff assignment, and internal notes
- Role-based access for students, staff, department admins, admins, and super admins
- Notifications for complaint updates, assignments, and comments
- SQLite support for local development and PostgreSQL support through `DATABASE_URL`
- Static frontend served directly from the Flask backend

## Tech Stack

**Backend**

- Python
- Flask
- Flask-SQLAlchemy
- Flask-Migrate
- Flask-JWT-Extended
- SQLite / PostgreSQL

**Frontend**

- HTML
- CSS
- JavaScript
- Browser local storage for client-side session and cache handling

## Project Structure

```text
Campus Ressolve/
|-- Backend/
|   |-- app.py
|   |-- config.py
|   |-- extensions.py
|   |-- requirements.txt
|   |-- models/
|   |-- routes/
|   |-- migrations/
|   |-- static/uploads/
|   `-- templates/
|-- Frontend/
|   `-- New folder/resolve_fixed/resolve_fixed/
|       |-- index.html
|       |-- login.html
|       |-- signup.html
|       |-- profile-setup.html
|       |-- profile.html
|       |-- admin.html
|       `-- js/
`-- static/uploads/
```

## Getting Started

### Prerequisites

- Python 3.10 or newer
- `pip`
- Git

### Installation

1. Clone the repository:

```bash
git clone https://github.com/your-username/campusresolve.git
cd campusresolve
```

2. Create and activate a virtual environment:

```bash
cd Backend
python -m venv venv
```

On Windows:

```bash
venv\Scripts\activate
```

On macOS/Linux:

```bash
source venv/bin/activate
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

4. Run the Flask application:

```bash
python app.py
```

5. Open the app in your browser:

```text
http://127.0.0.1:5000
```

The backend serves the frontend pages automatically.

## Default Accounts

When the application starts, it seeds default staff/admin accounts if they do not already exist.

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@campusresolve.com | Admin@123 |
| Staff | rahul@campusresolve.com | Staff@123 |
| Staff | anjali@campusresolve.com | Staff@123 |

Students can create their own account from the signup page.

## Environment Variables

The app works locally without extra configuration because it defaults to SQLite.

Optional environment variable:

```text
DATABASE_URL=postgresql://username:password@host:port/database_name
```

If `DATABASE_URL` is not set, the app uses:

```text
sqlite:///campusresolve.db
```

For production, update `SECRET_KEY` and `JWT_SECRET_KEY` in `Backend/config.py` or load them from environment variables.

## Main API Routes

### Authentication

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/auth/register` | Register a new user |
| POST | `/auth/login` | Login and receive JWT token |
| GET | `/auth/me` | Get current logged-in user |
| PUT | `/auth/profile` | Update user profile |
| POST | `/auth/reset-password` | Reset account password |
| GET | `/auth/notifications` | Get user notifications |
| GET | `/auth/public-stats` | Get public platform stats |

### Complaints

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/feed/` | Get public complaint feed |
| GET | `/complaints/` | List complaints |
| POST | `/complaints/create` | Create a complaint |
| POST | `/complaints/<id>/vote` | Upvote or downvote a complaint |
| GET | `/complaints/<id>/comments` | Get complaint comments |
| POST | `/complaints/<id>/comments` | Add a comment |
| DELETE | `/complaints/<id>` | Delete a complaint |

### Admin

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/admin/users` | List users |
| POST | `/admin/users/<id>/role` | Update user role |
| POST | `/admin/update-status/<id>` | Update complaint status |
| POST | `/admin/assign/<id>` | Assign complaint to staff |
| POST | `/admin/notes/<id>` | Add internal admin note |

## Database

The application initializes tables automatically on startup using SQLAlchemy. Flask-Migrate files are also included under `Backend/migrations`.

To use migrations manually:

```bash
flask db init
flask db migrate -m "Initial migration"
flask db upgrade
```

## File Uploads

Complaint evidence and resolution images are stored in:

```text
Backend/static/uploads/
```

Make sure this directory exists and is writable in production.

## Deployment Notes

This project is deployed using Render.

Recommended Render settings:

```text
Root Directory: Backend
Build Command: pip install -r requirements.txt
Start Command: gunicorn app:app
```

For production deployment:

- Use Render PostgreSQL or another PostgreSQL database by setting `DATABASE_URL`.
- Replace local development secrets with secure environment variables.
- Use Gunicorn as the production server.
- Configure upload storage carefully because Render's filesystem can be ephemeral.
- Restrict CORS settings before production use if the frontend and backend are hosted on known domains.

Example Gunicorn command:

```bash
gunicorn app:app
```

## Future Improvements

- Email or SMS notifications
- Password reset through OTP or email verification
- Complaint analytics dashboard
- Department-wise SLA tracking
- Cloud storage for uploaded files
- Automated tests for API routes

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
