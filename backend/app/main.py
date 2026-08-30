import os
import sys
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError

from app.database import engine, Base
from app.routes.auth import router as auth_router

load_dotenv()

APP_NAME = os.getenv("APP_NAME", "Civix API")
APP_VERSION = os.getenv("APP_VERSION", "1.0.0")
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:4200").split(",")]


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables ready")
    except OperationalError as e:
        code = e.orig.args[0] if e.orig else 0
        msg  = e.orig.args[1] if e.orig else str(e)
        errors = {
            1045: "DB Error: Wrong username or password. Check DB_USER and DB_PASSWORD in .env",
            1049: "DB Error: Database does not exist → run: CREATE DATABASE civix_db;",
            2003: "DB Error: Cannot connect to MySQL. Make sure MySQL is running.",
            2005: "DB Error: Unknown host. Check DB_HOST in .env",
        }
        print(f"\n❌ {errors.get(code, f'DB Error ({code}): {msg}')}\n")
        sys.exit(1)
    yield


app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="Civix: Digital Civic Engagement & Petition Platform — Milestone 1",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)


@app.get("/", tags=["Health"])
def root():
    return {
        "message": "Civix Backend is running",
        "version": APP_VERSION,
        "milestone": "Milestone 1",
    }
