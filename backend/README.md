# Civix Backend — Milestone 1

**Civix: Digital Civic Engagement & Petition Platform**

## Milestone 1 Scope
User Roles & Verification — registration, login, JWT auth, role-based access, verification status.

## Tech Stack
- Python 3.11+
- FastAPI
- SQLAlchemy + PyMySQL
- MySQL
- JWT (python-jose)
- bcrypt (passlib)
- python-dotenv

## Installation

### 1. Create and activate virtual environment
```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure environment
Copy `.env` and fill in your values:
```
DB_PASSWORD=your_mysql_password
JWT_SECRET_KEY=your_strong_random_secret
```

### 4. MySQL setup
Create the database (tables are auto-created on startup):
```sql
CREATE DATABASE civix_db;
```

### 5. Run the server
```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Swagger UI
```
http://127.0.0.1:8000/docs
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | None | Health check |
| POST | `/api/auth/register` | None | Register citizen or official |
| POST | `/api/auth/login` | None | Login and receive JWT |
| GET | `/api/auth/me` | Bearer JWT | Get current user profile |

## Authentication Flow

1. Register via `POST /api/auth/register` with role `citizen` or `official`
2. Citizens are immediately verified (`is_verified: true`)
3. Officials start as `verification_status: pending` and cannot login until verified
4. To test official login: manually update `verification_status` to `verified` and `is_verified` to `1` in MySQL
5. Login via `POST /api/auth/login` to receive a JWT
6. Pass JWT as `Authorization: Bearer <token>` header on protected endpoints

## Verification Status Values
| Status | Meaning |
|--------|---------|
| `not_required` | Citizen — no verification needed |
| `pending` | Official — awaiting verification |
| `verified` | Official — verified and fully active |
| `rejected` | Official — verification denied |
