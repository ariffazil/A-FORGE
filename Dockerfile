# AF FORGE — TypeScript Runtime Container
# Stage 1: build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci && npm cache clean --force
COPY src/ ./src/
COPY examples/ ./examples/
COPY test/ ./test/
RUN npm run build

# Stage 2: runtime
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# Security Hardening
RUN addgroup -S arifos && adduser -S arifos -G arifos

COPY --chown=arifos:arifos package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
# MiniMax MCP runtime — required by MiniMaxMcpClient.ts
RUN npm install -g minimax-coding-plan-mcp@0.1.2 --force && npm cache clean --force
COPY --from=builder --chown=arifos:arifos /app/dist ./dist

USER arifos

LABEL org.opencontainers.image.source="https://github.com/ariffazil/A-FORGE" \
      org.opencontainers.image.description="Execution shell — 75 forge_* governed tools" \
      org.opencontainers.image.version="kanon-1.0.0" \
      org.opencontainers.image.licenses="BSL-1.1" \
      arifos.organ="A-FORGE" \
      arifos.authority="F13_SOVEREIGN"

EXPOSE 7071
CMD ["node", "dist/src/interfaces/server.js"]
