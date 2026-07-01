FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json tsup.config.ts ./
COPY src ./src

RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    CONTEXT_PATH=/apigee-wrapper \
    CORS_ORIGIN=http://localhost:5173,https://probestack.io,https://prod.probestack.io,https://*.probestack.io \
    REQUEST_TIMEOUT_MS=10000 \
    AXIOS_RETRY_COUNT=2 \
    APIGEE_AUTH_SCOPE=https://www.googleapis.com/auth/cloud-platform \
    # APIGEE_SERVICE_ACCOUNT_KEY_PATH=/app/gen-ai-poc-onboarding-18-may.json \
    AXIOS_RETRY_DELAY_MS=300 \
    APIGEE_BASE_URL=https://apigee.googleapis.com/v1 \
    MONGODB_URI=mongodb+srv://admin_db_user:HdhPLHmhHEhxSUTa@probestack-prod.mby902c.mongodb.net/probestack-forgesphere?appName=probestack-prod \
    MONGODB_DB_NAME=probestack-forgesphere

EXPOSE 3000

CMD ["node", "dist/server.js"]
