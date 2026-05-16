FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends     build-essential     curl     git     libpq-dev     && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir     pandas     numpy     scipy     matplotlib     psycopg2-binary     redis     arifos     pydantic
CMD ["python3"]
