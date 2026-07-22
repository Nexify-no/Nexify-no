FROM python:3.12.10-slim-bookworm AS build

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /build
COPY requirements.lock ./
RUN python -m pip wheel --no-cache-dir --require-hashes --wheel-dir /wheels -r requirements.lock

FROM python:3.12.10-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8080 \
    MAX_CONCURRENT_JOBS=2

RUN groupadd --system penna && useradd --system --gid penna --home-dir /app penna
COPY --from=build /wheels /wheels
COPY requirements.lock /tmp/requirements.lock
RUN python -m pip install --no-cache-dir --no-index --require-hashes \
      --find-links=/wheels -r /tmp/requirements.lock && \
    rm -rf /wheels /tmp/requirements.lock

USER penna:penna
WORKDIR /app
COPY --chown=penna:penna penna_ingestion ./penna_ingestion
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/healthz', timeout=2).read()"
CMD ["python", "-m", "penna_ingestion.app"]
