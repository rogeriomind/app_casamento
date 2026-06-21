FROM node:24-bookworm-slim

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

ARG BUILD_DATABASE_URL="postgresql://build:build@db:5432/album_casamento?schema=public"
ARG BUILD_APP_BASE_URL="http://localhost:3000"
ARG BUILD_ADMIN_API_KEY="build-admin-key"
ARG BUILD_CLIENT_HASH_SECRET="build-client-hash-secret"
ARG BUILD_BUNNY_STORAGE_ENDPOINT="https://storage.example.com/app-casamento"
ARG BUILD_BUNNY_STORAGE_PASSWORD="build-storage-password"
ARG BUILD_BUNNY_PUBLIC_BASE_URL="https://cdn.example.com"

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma

RUN DATABASE_URL="$BUILD_DATABASE_URL" npm ci
RUN DATABASE_URL="$BUILD_DATABASE_URL" npx prisma generate

COPY . .

RUN DATABASE_URL="$BUILD_DATABASE_URL" \
  APP_BASE_URL="$BUILD_APP_BASE_URL" \
  ADMIN_API_KEY="$BUILD_ADMIN_API_KEY" \
  CLIENT_HASH_SECRET="$BUILD_CLIENT_HASH_SECRET" \
  BUNNY_STORAGE_ENDPOINT="$BUILD_BUNNY_STORAGE_ENDPOINT" \
  BUNNY_STORAGE_PASSWORD="$BUILD_BUNNY_STORAGE_PASSWORD" \
  BUNNY_PUBLIC_BASE_URL="$BUILD_BUNNY_PUBLIC_BASE_URL" \
  npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start -- --hostname 0.0.0.0 --port 3000"]
