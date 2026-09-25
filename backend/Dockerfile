# --- deps: bağımlılıkları ayrı katmanda kur, kaynak değişince yeniden kurulmasın
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- build: TypeScript -> dist, Prisma Client üret
FROM node:20-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# --- runtime: yalnızca prod bağımlılıkları + derlenmiş çıktı
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Ay/gün sınırları (tahsilat özeti, bordro, izin yılı) ve node-cron saatleri
# (08:00 hatırlatmalar vb.) yerel saate göre hesaplanır — konteyner varsayılanı
# UTC olduğunda 3 saat kayıyordu (docs/HEALTH_AUDIT.md §2.3). Node'un gömülü
# ICU'su saat dilimi verisini içerir; ayrıca tzdata paketi gerekmez.
ENV TZ=Europe/Istanbul
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 4000
CMD ["node", "dist/index.js"]
