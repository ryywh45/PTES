# PTES backend — FastAPI (dev image; source is bind-mounted by docker-compose)
FROM python:3.12-slim

WORKDIR /app

# Install deps first so they're cached independently of source changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Baked-in copy is a fallback; in dev, ./backend is bind-mounted over /app.
COPY . .

EXPOSE 8000

# --reload picks up edits from the bind-mounted source.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
