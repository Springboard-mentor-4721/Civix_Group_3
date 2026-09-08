# CIVIX — Civic Engagement Platform

> **Your Voice. Your City.**
> A full-stack digital platform for civic participation — petitions, polls, and direct engagement with local officials.

---

## Repository Structure

```
civix-backend/
├── backend/          # Python · FastAPI · MySQL
├── frontend/         # TypeScript · Angular 21
├── .gitignore
└── README.md
```

---

## Quick Start

### Backend

```bash
cd backend
python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt
# Set up .env (see backend/README.md)
uvicorn app.main:app --reload
```

→ **http://127.0.0.1:8000** | Docs → **http://127.0.0.1:8000/docs**

### Frontend

```bash
cd frontend
npm install
npm start
```

→ **http://localhost:4200**

---

## Current Features (Milestone 1)

### Auth & Users
- ✅ Register as **Citizen** or **Official**
- ✅ Email verification flow (Officials must verify before login)
- ✅ JWT-based login / logout (token blacklisting on server)
- ✅ Forgot password / Reset password via email token
- ✅ Get & update user profile (`/api/auth/me`)
- ✅ Auto location detection (GPS → Nominatim → IP fallback chain)

### Frontend UI
- ✅ Light theme throughout — background `#f0f4f8`
- ✅ Auth pages — teal gradient left panel + white card right panel
- ✅ Register — 2-column form, confirm password, role selector
- ✅ Dashboard — sidebar with nav links, user card, topbar
- ✅ HTTP interceptor — auto-attaches JWT, handles 401 globally
- ✅ Environment config via `src/environments/`

### Coming Soon
- 🔜 Role-based dashboards (Citizen vs Official separate UI)
- 🔜 Profile page
- 🔜 Settings page
- 🔜 Petitions — create, sign, track
- 🔜 Polls & Ballots
- 🔜 Officials Directory
- 🔜 Analytics

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 21, TypeScript 5.9, RxJS 7.8 |
| Backend | FastAPI, SQLAlchemy, Pydantic v2 |
| Database | MySQL 8.x |
| Auth | JWT (python-jose), bcrypt (passlib) |
| Dev Server | Uvicorn (backend), Angular CLI (frontend) |

---

## Docs

- [Frontend README](./frontend/README.md)
- [Backend README](./backend/README.md)

---

**Group 3 — Infosys Internship Project**
