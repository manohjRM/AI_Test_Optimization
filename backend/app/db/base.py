# ABOUTME: Declarative base for all SQLAlchemy ORM models.
# ABOUTME: Every model inherits from Base defined here.

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
