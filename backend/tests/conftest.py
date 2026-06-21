from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select

from app import database
from app.database import get_session
from app.main import app
from app.migrate import get_or_create_local_profile
from app.models import Profile, Tag


def minimal_seed(session: Session) -> Profile:
    profile = get_or_create_local_profile(session)
    if session.exec(select(Tag).where(Tag.profile_id == profile.id)).first():
        return profile
    tag = Tag(name="General", parent_id=None, profile_id=profile.id)
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return profile


def profile_headers(profile_id: int) -> dict[str, str]:
    return {"X-PTES-Profile-Id": str(profile_id)}


@pytest.fixture
def db_path(tmp_path: Path) -> Path:
    return tmp_path / "test.db"


@pytest.fixture
def db_url(db_path: Path) -> str:
    return f"sqlite:///{db_path}"


@pytest.fixture
def test_engine(db_url: str, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("DATABASE_URL", db_url)
    monkeypatch.setenv("GEMINI_API_KEY", "")
    monkeypatch.setenv("GOOGLE_API_KEY", "")

    import app.config as config

    monkeypatch.setattr(config, "GEMINI_API_KEY", "")
    monkeypatch.setattr("app.services.ai_report.GEMINI_API_KEY", "")
    monkeypatch.setattr("app.services.ai_report.is_ai_available", lambda: False)

    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    database.engine = engine
    monkeypatch.setattr("app.migrate.engine", engine)

    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        minimal_seed(session)

    return engine


@pytest.fixture
def session(test_engine) -> Generator[Session, None, None]:
    with Session(test_engine) as s:
        yield s


@pytest.fixture
def profile(session: Session) -> Profile:
    p = session.exec(select(Profile)).first()
    assert p is not None and p.id is not None
    return p


@pytest.fixture
def root_tag(session: Session, profile: Profile) -> Tag:
    tag = session.exec(select(Tag).where(Tag.profile_id == profile.id)).first()
    assert tag is not None and tag.id is not None
    return tag


@pytest.fixture
def headers(profile: Profile) -> dict[str, str]:
    assert profile.id is not None
    return profile_headers(profile.id)


@pytest.fixture
def client(test_engine, monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient, None, None]:
    def override_get_session():
        with Session(test_engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session
    monkeypatch.setattr("app.main.seed_if_empty", minimal_seed)

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()
