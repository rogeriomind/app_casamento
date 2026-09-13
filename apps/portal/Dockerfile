FROM node:24-bookworm-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

ARG BUILD_DATABASE_URL="postgresql://build:build@db:5432/portal_casamento?schema=public"
ARG BUILD_BETTER_AUTH_URL="https://portal.productpulse.com.br"

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN DATABASE_URL="$BUILD_DATABASE_URL" npm ci \
  && DATABASE_URL="$BUILD_DATABASE_URL" npm run db:generate

COPY . .

RUN DATABASE_URL="$BUILD_DATABASE_URL" \
  BETTER_AUTH_URL="$BUILD_BETTER_AUTH_URL" \
  npm run build

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start -- --hostname 0.0.0.0 --port 3000"]
