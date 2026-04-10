FROM node:22-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim AS runtime

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

# MCP stdio server — consumed by pipe, not HTTP
# HTTP bridge server — port 7071
EXPOSE 7071

ENV NODE_ENV=production \
    AGENT_WORKBENCH_PROVIDER=mock \
    AGENT_WORKBENCH_DEFAULT_MODE=external_safe_mode

CMD ["node", "dist/src/server.js"]
