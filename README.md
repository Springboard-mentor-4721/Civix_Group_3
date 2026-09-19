# CIVIX — Civic Engagement & Regional Governance Platform

> **Your Voice. Your City.**  
> A full-stack digital civic engagement platform enabling citizens to create and sign petitions, participate in local governance, track regional civic statistics, and interact directly with verified local officials.

---

## 📌 Table of Contents
- [Overview](#-overview)
- [Key Features & Capabilities](#-key-features--capabilities)
- [Tech Stack](#-tech-stack)
- [Environment Configuration (`.env`)](#-environment-configuration-env)
- [Project Directory Structure](#-project-directory-structure)
- [Installation & Getting Started](#-installation--getting-started)
  - [Backend Setup (FastAPI & MySQL)](#1-backend-setup-fastapi--mysql)
  - [Frontend Setup (Angular 21)](#2-frontend-setup-angular-21)
- [API Endpoints Summary](#-api-endpoints-summary)
- [UI & Mobile Responsiveness](#-ui--mobile-responsiveness)
- [Project Metadata](#-project-metadata)

---

## 🏙️ Overview

**CIVIX** bridges the gap between urban residents and local municipal administration. It allows citizens to publish petitions, gather verified digital signatures, report local infrastructure/service issues, and track official status updates (e.g. *Active*, *Review*, *Resolved*). Dedicated dashboards for government officials streamline public grievance handling with evidence inspection and status transitions.

---

## ⚡ Key Features & Capabilities

### 🔐 1. Authentication & Security Portal
- **Dual-Role Registration**:
  - **Citizen Registration**: Email verification + location detection.
  - **Official Registration**: Department ID, Department Name, and pre-approved official status.
- **Biometric Photo Verification**:
  - WebRTC live camera viewfinder with oval face positioning guide.
  - Profile image capture and photo upload for verified civic identity.
- **Security & Rate Limiting**:
  - JWT Bearer Authentication (`python-jose`).
  - Brute-force protection (Account lockout for 15 minutes after 5 failed attempts).
  - Server-side token blacklisting on logout.
- **Password Recovery & Reset Flow**:
  - Email link verification for password reset.
  - One-Time Token Authorization for permanent password update.
  - Live 3-bar password strength meter (`Weak`, `Medium`, `Strong`) and real-time password matching badge.

### 🏛️ 2. Citizen Dashboard & Petition Management
- **Interactive Dashboard Hub**:
  - Regional statistics overview (Total Created, Active, Closed petitions, and percentage distribution bars).
  - Search & filter petitions by category (*Infrastructure*, *Sanitation*, *Safety*, *Environment*, *Public Transport*) and status (*Active*, *Under Review*, *Resolved*).
- **Petition Lifecycle**:
  - Create new petitions with detailed description, target signature threshold, location tagging, and Cloudinary media/evidence uploads.
  - Digital petition signing with instant vote count updates.
  - Track user's signed and created petitions in **My Signatures**.
- **Interactive App Tour**:
  - Guided step-by-step walkthrough explaining all tabs and features.
  - Includes **Skip**, **Previous**, and **Next** navigation controls.

### 🏢 3. Official Department Portal
- **Departmental Dashboard**:
  - View all civic petitions assigned to or relevant to the official's jurisdiction.
- **Full-Page Petition Detail View**:
  - Deep-dive petition details page showing full evidence gallery, submission timestamp, citizen details, and signature counts.
  - Official response and status update mechanism.
- **Streamlined Workspace**:
  - Cleaned navigation interface tailored for rapid administrative review.

### 📱 4. Responsiveness & Design System
- **100% Mobile Responsive**:
  - Zero horizontal scroll overflow across mobile viewports (`< 1024px`, `< 900px`, `< 480px`).
  - Responsive tab wrapping, collapsible sidebars, and auto-adapting grid cards.
- **CIVIX Light Theme**:
  - Modern aesthetic using `#f0f4f8` light background, `#0d9488` teal accents, `#ffffff` glass cards, and high-legibility `#0f172a` slate typography.

---

## 🛠️ Tech Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| **Frontend Framework** | **Angular 21** | Standalone Components, Reactive Forms, RxJS, Angular Router |
| **Styling & Icons** | **CSS3 / GFM** | CIVIX Light Theme, Custom Inline Vector SVGs |
| **Backend Framework** | **FastAPI (Python 3.11+)** | Asynchronous REST API, Pydantic v2 validation |
| **Database** | **MySQL 8.x** | Managed via SQLAlchemy ORM & DB migrations |
| **Authentication** | **JWT & Bcrypt** | `python-jose`, `passlib[bcrypt]`, `smtplib` |
| **Media & Storage** | **Cloudinary API** | Image and petition evidence file hosting |
| **Mailing System** | **SMTP / MIME** | Multipart HTML email with embedded CID header banners |

---

## 🔑 Environment Configuration (`.env`)

The backend requires environment variables configured in `backend/.env`. Below is the complete specification of all required `.env` parameters:

```env
# ==============================================================================
# CIVIX BACKEND ENVIRONMENT CONFIGURATION
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Application Metadata & Server Settings
# ------------------------------------------------------------------------------
APP_NAME=Civix API
APP_VERSION=1.0.0
APP_HOST=127.0.0.1
APP_PORT=8000

# ------------------------------------------------------------------------------
# 2. Database Connection (MySQL)
# ------------------------------------------------------------------------------
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=civix_db

# ------------------------------------------------------------------------------
# 3. Security & JWT Token Settings
# ------------------------------------------------------------------------------
JWT_SECRET_KEY=civix_project_2026_INFOSYS_GROUP_3
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60

# Rate Limiting & Account Security
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_MINUTES=15
MAX_ACTIVE_SESSIONS=2

# ------------------------------------------------------------------------------
# 4. SMTP Mail Server Settings (Gmail TLS / Custom SMTP)
# ------------------------------------------------------------------------------
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM_EMAIL=your_email@gmail.com
SMTP_FROM_NAME=Civix

# ------------------------------------------------------------------------------
# 5. Domain & Portal URLs
# ------------------------------------------------------------------------------
FRONTEND_URL=http://localhost:4200
BACKEND_URL=http://127.0.0.1:8000

# Token Expirations (in Minutes)
EMAIL_VERIFICATION_EXPIRE_MINUTES=30
PASSWORD_RESET_EXPIRE_MINUTES=30

# ------------------------------------------------------------------------------
# 6. Cloudinary Storage (Image & Evidence Hosting)
# ------------------------------------------------------------------------------
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

---

## 📂 Project Directory Structure

```text
civix-backend/
├── backend/                        # Python FastAPI Backend
│   ├── app/
│   │   ├── models/                 # SQLAlchemy Database Models (User, Petition, Signature)
│   │   ├── routes/                 # REST API Routes (auth.py, petition.py, admin.py)
│   │   ├── schemas/                # Pydantic Request/Response Schemas
│   │   ├── static/                 # Static Email Assets (CIVIX_TOP.png, CIVIX_BELOW.png)
│   │   ├── utils/                  # Utilities (email.py, security.py, jwt.py, cloudinary_utils.py)
│   │   ├── database.py             # Database Engine & Session Generator
│   │   └── main.py                 # FastAPI Application Entrypoint
│   ├── .env                        # Environment Variables Configuration
│   └── requirements.txt            # Python Dependencies
│
├── frontend/                       # Angular 21 Frontend Application
│   ├── src/
│   │   ├── app/
│   │   │   ├── auth/               # Auth Flow Components
│   │   │   │   ├── login/
│   │   │   │   ├── register/
│   │   │   │   ├── verify-email/
│   │   │   │   ├── face-verification/
│   │   │   │   ├── forgot-password/
│   │   │   │   ├── reset-password/
│   │   │   │   └── change-password/
│   │   │   ├── dashboard/          # Citizen Dashboard Component
│   │   │   ├── official-dashboard/ # Official Departmental Dashboard Component
│   │   │   ├── petitions/          # Petition List & Create Components
│   │   │   └── app.routes.ts       # Angular Application Routes
│   │   └── environments/           # Frontend Environment Configurations
│   ├── angular.json
│   └── package.json
│
├── README.md                       # Project Documentation
└── .gitignore
```

---

## 🚀 Installation & Getting Started

### Prerequisites
- **Node.js** v18+ & **npm** v9+
- **Python** v3.11+
- **MySQL Server** v8.0+ running on `localhost:3306`

---

### 1. Backend Setup (FastAPI & MySQL)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   - **Windows**:
     ```bash
     python -m venv venv
     venv\Scripts\activate
     ```
   - **Linux / macOS**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. Install required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create the MySQL Database:
   ```sql
   CREATE DATABASE civix_db;
   ```

5. Configure your `.env` file inside `backend/` with your MySQL and SMTP credentials.

6. Launch the FastAPI server:
   ```bash
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

   - **API Server**: `http://127.0.0.1:8000`
   - **Swagger Docs**: `http://127.0.0.1:8000/docs`

---

### 2. Frontend Setup (Angular 21)

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install Node packages:
   ```bash
   npm install
   ```

3. Start the Angular development server:
   ```bash
   npm start
   ```

4. Open your browser and navigate to:
   ```text
   http://localhost:4200
   ```

---

## 📡 API Endpoints Summary

### Authentication (`/api/auth`)
- `POST /api/auth/register/citizen` — Register citizen account.
- `POST /api/auth/register/official` — Register official account.
- `POST /api/auth/login` — Authenticate and receive JWT access token.
- `GET  /api/auth/verify-email` — Verify email via token.
- `POST /api/auth/face-verification` — Upload biometric profile picture.
- `POST /api/auth/request-password-change` — Send password reset link to user's registered email.
- `POST /api/auth/change-password` — Update password using one-time token.
- `GET  /api/auth/me` — Fetch current logged-in user profile.
- `PUT  /api/auth/me` — Update user profile information.

### Petitions (`/api/petitions`)
- `GET  /api/petitions` — List all petitions with filter & search query parameters.
- `POST /api/petitions` — Create a new petition with image upload support.
- `GET  /api/petitions/{id}` — Fetch detailed petition view.
- `POST /api/petitions/{id}/sign` — Sign a petition as a citizen.
- `PUT  /api/petitions/{id}/status` — Update petition status (*Official only*).

---

## 🎨 UI & Mobile Responsiveness

- **Zero Horizontal Scrolling**: Enforced `box-sizing: border-box`, `max-width: 100%`, and overflow containment across all pages.
- **Adaptive Layouts**:
  - On viewports `< 1024px`: Right sidebars collapse automatically to preserve main view real-estate.
  - On viewports `< 900px`: Multi-column forms and grids adapt to single-column flex/grid layouts.
  - Search and filter toolbars wrap cleanly without pushing viewport boundaries.

---

## 👥 Project Metadata

- **Project Name**: CIVIX (Civic Engagement Platform)
- **Group**: Springboard Mentorship / Infosys Group 3
- **License**: MIT License
