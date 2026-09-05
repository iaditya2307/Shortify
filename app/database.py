import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Load environment variables from .env and .env.local
env_path = Path(__file__).parent.parent / ".env"
env_local_path = Path(__file__).parent.parent / ".env.local"

if env_local_path.exists():
    load_dotenv(dotenv_path=env_local_path)
elif env_path.exists():
    load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL", "https://eoysygjxazvltwfzvcsv.supabase.co")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") or os.getenv("SUPABASE_KEY", "sb_publishable_p-oNgBmJus9lsR3aEy_cyg_hh5KL35j")

db_url = os.getenv("DATABASE_URL")
if not db_url:
    # Use /tmp for serverless environment compatibility (Vercel, AWS Lambda, Cloud Functions)
    if os.getenv("VERCEL") or os.path.exists("/tmp"):
        db_url = "sqlite:////tmp/url_shortener.db"
    else:
        db_url = "sqlite:///./url_shortener.db"

DATABASE_URL = db_url

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_supabase_client():
    from supabase import create_client, Client
    return create_client(SUPABASE_URL, SUPABASE_KEY)
