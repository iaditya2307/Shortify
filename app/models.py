from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean
from .database import Base


class URLMapping(Base):
    __tablename__ = "url_mappings"

    id = Column(Integer, primary_key=True, index=True)
    short_code = Column(String(20), unique=True, nullable=False, index=True)
    long_url = Column(String(2048), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    click_count = Column(Integer, default=0, nullable=False)
