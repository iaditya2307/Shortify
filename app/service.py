import re
from dataclasses import dataclass
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from .base62 import encode_base62, generate_random_code
from .database import get_supabase_client
from .models import URLMapping

ALIAS_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")


class AliasAlreadyExists(Exception):
    pass


class InvalidAlias(Exception):
    pass


class URLNotFound(Exception):
    pass


class URLExpired(Exception):
    pass


@dataclass
class URLMappingDTO:
    id: int
    short_code: str
    long_url: str
    created_at: datetime
    expires_at: datetime | None
    is_active: bool
    click_count: int


def _parse_datetime(val) -> datetime | None:
    if not val:
        return None
    if isinstance(val, datetime):
        return val
    try:
        return datetime.fromisoformat(val.replace("Z", "+00:00"))
    except ValueError:
        return None


def _supabase_row_to_dto(row: dict) -> URLMappingDTO:
    return URLMappingDTO(
        id=row["id"],
        short_code=row["short_code"],
        long_url=row["long_url"],
        created_at=_parse_datetime(row.get("created_at")),
        expires_at=_parse_datetime(row.get("expires_at")),
        is_active=bool(row.get("is_active", True)),
        click_count=int(row.get("click_count", 0)),
    )


def create_short_url(
    db: Session | None,
    long_url: str,
    custom_alias: str | None = None,
    expires_at: datetime | None = None,
) -> URLMappingDTO:
    supabase = get_supabase_client()

    if custom_alias:
        if not ALIAS_PATTERN.match(custom_alias):
            raise InvalidAlias("Alias may contain only letters, numbers, - and _.")

        payload = {
            "short_code": custom_alias,
            "long_url": long_url,
            "expires_at": expires_at.isoformat() if expires_at else None,
            "is_active": True,
            "click_count": 0,
        }

        try:
            res = supabase.table("url_mappings").insert(payload).execute()
            if res.data and len(res.data) > 0:
                return _supabase_row_to_dto(res.data[0])
            raise RuntimeError("Failed to insert custom alias URL mapping into Supabase.")
        except Exception as exc:
            err_msg = str(exc).lower()
            if "23505" in err_msg or "duplicate" in err_msg or "already exists" in err_msg:
                raise AliasAlreadyExists("Custom alias already exists.")
            raise

    # Deduplication / Idempotency check for standard short link requests
    if not expires_at:
        try:
            existing = (
                supabase.table("url_mappings")
                .select("*")
                .eq("long_url", long_url)
                .eq("is_active", True)
                .is_("expires_at", "null")
                .limit(1)
                .execute()
            )
            if existing.data and len(existing.data) > 0:
                return _supabase_row_to_dto(existing.data[0])
        except Exception:
            pass

    # Auto-generate cryptographically secure 7-character Base62 code with retry on collision
    max_retries = 5
    for _ in range(max_retries):
        short_code = generate_random_code(7)
        payload = {
            "short_code": short_code,
            "long_url": long_url,
            "expires_at": expires_at.isoformat() if expires_at else None,
            "is_active": True,
            "click_count": 0,
        }

        try:
            res = supabase.table("url_mappings").insert(payload).execute()
            if res.data and len(res.data) > 0:
                return _supabase_row_to_dto(res.data[0])
        except Exception as exc:
            err_msg = str(exc).lower()
            if "23505" in err_msg or "duplicate" in err_msg or "already exists" in err_msg:
                # Collision occurred on unique constraint, retry with new random code
                continue
            raise

    raise RuntimeError("Failed to generate a unique short code after multiple attempts.")



def resolve_short_code(db: Session | None, short_code: str) -> URLMappingDTO:
    supabase = get_supabase_client()

    res = (
        supabase.table("url_mappings")
        .select("*")
        .eq("short_code", short_code)
        .eq("is_active", True)
        .execute()
    )

    if not res.data or len(res.data) == 0:
        raise URLNotFound()

    row = res.data[0]
    expires_at_dt = _parse_datetime(row.get("expires_at"))

    if expires_at_dt:
        now = datetime.now(timezone.utc)
        if expires_at_dt.tzinfo is None:
            expires_at_dt = expires_at_dt.replace(tzinfo=timezone.utc)
        if expires_at_dt <= now:
            raise URLExpired()

    new_count = int(row.get("click_count", 0)) + 1
    try:
        update_res = (
            supabase.table("url_mappings")
            .update({"click_count": new_count})
            .eq("id", row["id"])
            .execute()
        )
        updated_row = update_res.data[0] if update_res.data else row
    except Exception:
        updated_row = row

    updated_row["click_count"] = new_count
    return _supabase_row_to_dto(updated_row)


def get_stats(db: Session | None, short_code: str) -> URLMappingDTO:
    supabase = get_supabase_client()

    res = (
        supabase.table("url_mappings")
        .select("*")
        .eq("short_code", short_code)
        .execute()
    )

    if not res.data or len(res.data) == 0:
        raise URLNotFound()

    return _supabase_row_to_dto(res.data[0])


def delete_short_url(db: Session | None, short_code: str) -> None:
    supabase = get_supabase_client()

    res = (
        supabase.table("url_mappings")
        .select("*")
        .eq("short_code", short_code)
        .execute()
    )

    if not res.data or len(res.data) == 0:
        raise URLNotFound()

    # Perform delete or soft-delete update
    try:
        supabase.table("url_mappings").delete().eq("short_code", short_code).execute()
    except Exception:
        supabase.table("url_mappings").update({"is_active": False}).eq("short_code", short_code).execute()
