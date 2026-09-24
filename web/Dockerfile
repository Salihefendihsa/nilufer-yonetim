# --- deps
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- build (NEXT_PUBLIC_* değişkenleri build-time'da gömülür — build-arg olarak verilmeli)
FROM node:20-slim AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_RECAPTCHA_SITE_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_RECAPTCHA_SITE_KEY=$NEXT_PUBLIC_RECAPTCHA_SITE_KEY
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- runtime: next.config.mjs'deki output:"standalone" sayesinde minimal
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Ay/gün sınırları (tahsilat özeti, bordro, izin yılı) ve node-cron saatleri
# (08:00 hatırlatmalar vb.) yerel saate göre hesaplanır — konteyner varsayılanı
# UTC olduğunda 3 saat kayıyordu (docs/HEALTH_AUDIT.md §2.3). Node'un gömülü
# ICU'su saat dilimi verisini içerir; ayrıca tzdata paketi gerekmez.
ENV TZ=Europe/Istanbul
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
