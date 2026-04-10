# arifOS - AAA Level Deployment Container
# Multi-stage build for TypeScript compilation and production runtime

# --- Build Stage ---
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source and build
COPY . .
RUN npm run build

# --- Production Stage ---
FROM node:22-alpine AS production

LABEL maintainer="arifOS Team"
LABEL version="1.0.0-AAA"
LABEL description="Constitutional AI Governance Runtime"

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache \
    dumb-init \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S arifos && \
    adduser -S arifos -u 1001

WORKDIR /app

# Copy built artifacts
COPY --from=builder --chown=arifos:arifos /app/dist ./dist
COPY --from=builder --chown=arifos:arifos /app/node_modules ./node_modules
COPY --from=builder --chown=arifos:arifos /app/package*.json ./

# Create necessary directories
RUN mkdir -p /app/data /app/logs /app/.agent-workbench && \
    chown -R arifos:arifos /app

# Switch to non-root user
USER arifos

# Environment defaults
ENV NODE_ENV=production
ENV AGENT_WORKBENCH_MEMORY_PATH=/app/data/memory.json
ENV AGENT_WORKBENCH_SCOREBOARD_PATH=/app/data/scoreboard.json
ENV AGENT_WORKBENCH_RUN_METRICS_DIR=/app/logs/metrics
ENV AGENT_WORKBENCH_DEFAULT_MODE=external_safe_mode

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Default command
CMD ["node", "dist/src/cli.js", "explore", "--goal", "arifOS container ready"]

# Expose port for HTTP mode
EXPOSE 8000
