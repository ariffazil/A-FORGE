FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy MCP server
COPY geox_mcp_server.py .

# Copy registry (mounted at runtime, but copy for fallback)
COPY registry.json . 2>/dev/null || echo "Registry will be mounted"

# Create geox-backend symlink (mounted at runtime)
RUN mkdir -p /app/geox-backend

EXPOSE 8000

CMD ["python", "geox_mcp_server.py"]
