# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS frontend
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.ts tsconfig*.json ./
COPY src ./src
COPY public ./public
RUN npm run build

# Fit the existing deterministic classifiers once, at image build time.
# This stage is cached independently of changes to the frontend.
FROM python:3.12-slim-bookworm AS models
ENV VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH" \
    OPENBLAS_NUM_THREADS=1 \
    OMP_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    PYTHONDONTWRITEBYTECODE=1
WORKDIR /build
RUN python -m venv /opt/venv
COPY backend/requirements.lock.txt ./backend/requirements.lock.txt
RUN pip install --no-cache-dir --only-binary=:all: -r backend/requirements.lock.txt
COPY backend/__init__.py backend/ml.py backend/train.py ./backend/
RUN python -m backend.train

FROM python:3.12-slim-bookworm AS runtime
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    OPENBLAS_NUM_THREADS=1 \
    OMP_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    NUMEXPR_NUM_THREADS=1 \
    MALLOC_ARENA_MAX=2 \
    PORT=10000 \
    ZEN_FLOW_REQUIRE_ARTIFACT=1 \
    ZEN_FLOW_MODEL_PATH=/app/backend/artifacts/models.joblib \
    ZEN_FLOW_FRONTEND_DIST=/app/dist
WORKDIR /app
COPY --from=models /opt/venv /opt/venv
COPY backend ./backend
COPY --from=models /build/backend/artifacts ./backend/artifacts
COPY --from=frontend /build/dist ./dist
RUN useradd --create-home --uid 10001 zenflow
USER zenflow
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('PORT','10000')+'/api/health', timeout=4)" || exit 1
CMD ["python", "-m", "backend.serve"]
