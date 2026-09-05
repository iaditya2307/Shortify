from datetime import datetime
from typing import Optional
from pydantic import BaseModel, AnyHttpUrl, Field


class CreateURLRequest(BaseModel):
    long_url: AnyHttpUrl
    custom_alias: Optional[str] = Field(default=None, min_length=3, max_length=20)
    expires_at: Optional[datetime] = None


class CreateURLResponse(BaseModel):
    short_code: str
    short_url: str
    long_url: str


class URLStatsResponse(BaseModel):
    short_code: str
    long_url: str
    click_count: int
    created_at: datetime
    expires_at: Optional[datetime]
    is_active: bool
