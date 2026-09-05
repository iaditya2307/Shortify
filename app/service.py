import re
from dataclasses import dataclass
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from .base62 import encode_base62
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

        existing = (
            supabase.table("url_mappings")
            .select("*")
            .eq("short_code", custom_alias)
            .execute()
        )

        if existing.data and len(existing.data) > 0:
            raise AliasAlreadyExists("Custom alias already exists.")

        payload = {
            "short_code": custom_alias,
            "long_url": long_url,
            "expires_at": expires_at.isoformat() if expires_at else None,
            "is_active": True,
            "click_count": 0,
        }

        res = supabase.table("url_mappings").insert(payload).execute()
        if not res.data:
            raise RuntimeError("Failed to insert URL mapping into Supabase.")
        return _supabase_row_to_dto(res.data[0])

    # Case: Generate unique short code
    temp_payload = {
        "short_code": "pending_" + str(datetime.now(timezone.utc).timestamp()),
        "long_url": long_url,
        "expires_at": expires_at.isoformat() if expires_at else None,
        "is_active": True,
        "click_count": 0,
    }

    insert_res = supabase.table("url_mappings").insert(temp_payload).execute()
    if not insert_res.data:
        raise RuntimeError("Failed to create short URL in Supabase.")

    inserted_row = insert_res.data[0]
    row_id = inserted_row["id"]
    generated_code = encode_base62(row_id + 1_000_000)

    # Update with generated base62 short_code
    update_res = (
        supabase.table("url_mappings")
        .update({"short_code": generated_code})
        .eq("id", row_id)
        .execute()
    )

    if not update_res.data:
        raise RuntimeError("Failed to update short code in Supabase.")

    return _supabase_row_to_dto(update_res.data[0])


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
