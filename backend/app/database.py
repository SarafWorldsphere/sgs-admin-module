"""Database session. RLS-aware, per the tenant kit."""

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool

from saraswati_tenant import apply_rls, current_school
from app.config import settings
from app.table_config import DB_TABLE_PREFIX

# Import Base so main.py can import it from here
from app.models import Base

# NullPool: fresh connection per request, so SET LOCAL never leaks between
# requests. Required for RLS to work correctly.
engine = create_engine(
    settings.DATABASE_URL,
    poolclass=NullPool,
    future=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _reassert_rls(db: Session) -> None:
    """Apply tenant context. Call at session open AND at each transaction begin."""
    try:
        if current_school() is not None:
            apply_rls(db)
    except Exception:
        pass


@event.listens_for(Session, "after_begin")
def _on_transaction_begin(session, transaction, connection):
    _reassert_rls(session)


def get_db():
    db = SessionLocal()
    try:
        _reassert_rls(db)
        yield db
    finally:
        db.close()