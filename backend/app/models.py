# Database models for SGS/SSS backend — saas branch
# Table names come from table_config.py — never hardcode here.

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Text
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declarative_base

from app.table_config import (
    TBL_USERS, TBL_SCHOOLS, TBL_STUDENTS, TBL_TEACHERS,
    TBL_CLASSES, TBL_NOTICE_BOARD,
)

Base = declarative_base()


class User(Base):
    __tablename__ = TBL_USERS

    user_id = Column(Integer, primary_key=True)
    username = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="user")
    school_id = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=True)  # RLS requirement
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())


class School(Base):
    __tablename__ = TBL_SCHOOLS

    school_id = Column(Integer, primary_key=True)
    school_name = Column(String(255), nullable=False)
    school_code = Column(String(50), unique=True)
    address = Column(Text)
    phone = Column(String(20))
    email = Column(String(255))
    is_active = Column(Boolean, default=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())


class Student(Base):
    __tablename__ = TBL_STUDENTS

    admission_no = Column(String(50), primary_key=True)
    full_name = Column(String(150), nullable=False)
    class_id = Column(Integer, nullable=True)  # Removed FK, class_master is shared
    section = Column(String(20))
    roll_no = Column(String(20))
    parent1_name = Column(String(150))
    parent1_phone = Column(String(20))
    parent1_email = Column(String(150))
    parent2_name = Column(String(150))
    parent2_phone = Column(String(20))
    parent2_email = Column(String(150))
    student_phone = Column(String(20))
    student_email = Column(String(150))
    guardian_name = Column(String(150))
    guardian_phone = Column(String(20))
    guardian_email = Column(String(150))
    record_status = Column(String(20), default="Active")
    tenant_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())


class Teacher(Base):
    __tablename__ = TBL_TEACHERS

    teacher_id = Column(String(50), primary_key=True)
    full_name = Column(String(150), nullable=False)
    subject_name = Column(String(100))
    qualification = Column(String(100))
    class_id = Column(Integer, nullable=True)
    section_1 = Column(String(20))
    section_2 = Column(String(20))
    role = Column(String(50))
    is_class_teacher = Column(Boolean, default=False)
    subjects = Column(Text)
    phone = Column(String(20))
    email_id = Column(String(150))
    is_active = Column(Boolean, default=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())


class Class(Base):
    __tablename__ = TBL_CLASSES

    class_id = Column(Integer, primary_key=True)
    class_name = Column(String(50))
    section_name = Column(String(20))
    record_status = Column(String(20), default="Active")
    tenant_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())


class Notice(Base):
    __tablename__ = TBL_NOTICE_BOARD

    notice_id = Column(Integer, primary_key=True)
    notice_title = Column(String(200), nullable=False)
    notice_text = Column(Text, nullable=False)
    notice_date = Column(DateTime, server_default=func.now())
    applicable_class = Column(String(50))
    record_status = Column(String(20), default="Active")
    tenant_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())