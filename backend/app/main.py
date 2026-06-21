from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from app.config import FRONTEND_URL
from app.database import engine
from app.migrate import ensure_schema
from app.routers import github, heatmap, profiles, projects, reports, tags
from app.seed import seed_if_empty


@asynccontextmanager
async def lifespan(_app: FastAPI):
    ensure_schema()
    with Session(engine) as session:
        seed_if_empty(session)
    yield


app = FastAPI(title="PTES API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profiles.router)
app.include_router(projects.router)
app.include_router(tags.router)
app.include_router(heatmap.router)
app.include_router(reports.router)
app.include_router(github.router)


@app.get("/health")
def health():
    return {"ok": True}
