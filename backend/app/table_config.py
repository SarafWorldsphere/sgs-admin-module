"""Centralised config. All table names live here — never hardcode in models or routers."""

import os
from dotenv import load_dotenv

load_dotenv()

# ---- Database ----
DATABASE_URL = os.getenv("DATABASE_URL")
APP_ENV = os.getenv("APP_ENV", "development")

# Empty in saas mode. Set to "sgs_" only if running the legacy prefixed DB.
DB_TABLE_PREFIX = os.getenv("DB_TABLE_PREFIX", "").strip()

# ---- Business tables (unprefixed in saas) ----
TBL_USERS          = f"{DB_TABLE_PREFIX}users_masters"
TBL_SCHOOLS        = f"{DB_TABLE_PREFIX}school_masters"
TBL_STUDENTS       = f"{DB_TABLE_PREFIX}student_master"
TBL_TEACHERS       = f"{DB_TABLE_PREFIX}teacher_master"
TBL_CLASSES        = f"{DB_TABLE_PREFIX}class_master"
TBL_NOTICE_BOARD   = f"{DB_TABLE_PREFIX}notice_board"
TBL_PARENT_MASTER  = f"{DB_TABLE_PREFIX}parent_master"

# ---- Platform tables (never prefixed) ----
TBL_TENANTS        = "platform.tenants"
TBL_TENANT_DOMAINS = "platform.tenant_domains"