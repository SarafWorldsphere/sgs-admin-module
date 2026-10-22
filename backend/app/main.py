from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.table_config import DB_TABLE_PREFIX
from app import models
import logging
import os

logging.basicConfig(level=logging.INFO)

# ---- Tenant middleware from the kit ----
from saraswati_tenant import SchoolMiddleware

# ── Local dev only: auto-create missing tables ──────────────────────────────
if not DB_TABLE_PREFIX and not os.getenv("SARASWATI_MODE"):
    Base.metadata.create_all(bind=engine)

app = FastAPI(title="SGS Admin Dashboard API")

# CORS first
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tenant middleware
app.add_middleware(SchoolMiddleware)

# ---------------------------------------------------------
# ONLY the routers that belong to the Admin Dashboard
# ---------------------------------------------------------
from app.routers import auth

app.include_router(auth.router)


@app.get("/")
def read_root():
    return {"message": "SGS Admin Dashboard API is running"}