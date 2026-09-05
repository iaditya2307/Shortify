from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .schemas import CreateURLRequest, CreateURLResponse, URLStatsResponse
from .service import (
    AliasAlreadyExists,
    InvalidAlias,
    URLExpired,
    URLNotFound,
    create_short_url,
    delete_short_url,
    get_stats,
    resolve_short_code,
)

try:
    Base.metadata.create_all(bind=engine)
except Exception as err:
    print("Database metadata creation skipped:", err)

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

if not (STATIC_DIR / "index.html").exists():
    STATIC_DIR = BASE_DIR.parent / "public" / "static"
    if not (STATIC_DIR / "index.html").exists():
        STATIC_DIR = BASE_DIR.parent / "public"

RESERVED_PATHS = frozenset({
    "api", "docs", "redoc", "health", "static", "openapi.json", "v1", "urls"
})

app = FastAPI(
    title="Shortify URL Shortener",
    version="1.0.0",
    description="URL shortener built with FastAPI and Supabase PostgreSQL.",
)

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def home():
    index_path = STATIC_DIR / "index.html"
    if not index_path.exists():
        index_path = BASE_DIR.parent / "public" / "index.html"
    return FileResponse(index_path)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/v1/urls", response_model=CreateURLResponse, status_code=201)
@app.post("/v1/urls", response_model=CreateURLResponse, status_code=201)
@app.post("/urls", response_model=CreateURLResponse, status_code=201)
def shorten_url(
    payload: CreateURLRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    try:
        mapping = create_short_url(
            db=db,
            long_url=str(payload.long_url),
            custom_alias=payload.custom_alias,
            expires_at=payload.expires_at,
        )
    except AliasAlreadyExists as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except InvalidAlias as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    base_url = str(request.base_url).rstrip("/")

    return CreateURLResponse(
        short_code=mapping.short_code,
        short_url=f"{base_url}/{mapping.short_code}",
        long_url=mapping.long_url,
    )


@app.get("/api/v1/urls/{short_code}", response_model=URLStatsResponse)
@app.get("/v1/urls/{short_code}", response_model=URLStatsResponse)
@app.get("/urls/{short_code}", response_model=URLStatsResponse)
def stats(short_code: str, db: Session = Depends(get_db)):
    try:
        mapping = get_stats(db, short_code)
    except URLNotFound:
        raise HTTPException(status_code=404, detail="Short URL not found.")

    return URLStatsResponse(
        short_code=mapping.short_code,
        long_url=mapping.long_url,
        click_count=mapping.click_count,
        created_at=mapping.created_at,
        expires_at=mapping.expires_at,
        is_active=mapping.is_active,
    )


@app.delete("/api/v1/urls/{short_code}", status_code=204)
@app.delete("/v1/urls/{short_code}", status_code=204)
@app.delete("/urls/{short_code}", status_code=204)
def delete_url(short_code: str, db: Session = Depends(get_db)):
    try:
        delete_short_url(db, short_code)
    except URLNotFound:
        raise HTTPException(status_code=404, detail="Short URL not found.")


@app.get("/{short_code}")
def redirect(short_code: str, db: Session = Depends(get_db)):
    if short_code in RESERVED_PATHS:
        raise HTTPException(status_code=404, detail="Not found.")

    try:
        mapping = resolve_short_code(db, short_code)
    except URLNotFound:
        raise HTTPException(status_code=404, detail="Short URL not found.")
    except URLExpired:
        raise HTTPException(status_code=410, detail="Short URL has expired.")

    return RedirectResponse(url=mapping.long_url, status_code=302)
