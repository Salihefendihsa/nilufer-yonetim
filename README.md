# Nilüfer İlaçlama — Yönetim Sistemi

Nilüfer İlaçlama'nın iç yönetim sistemi: backend API + web yönetim paneli. Sistem, ilaçlama/PCO (haşere kontrol) işletmesinin müşteri, personel, iş, sözleşme, ödeme ve teklif süreçlerini tek bir çatı altında yönetir.

## Klasör Yapısı

```
nilufer-yonetim/
├── backend/          Express + TypeScript + Prisma API
│   ├── prisma/       Veritabanı şeması ve migration'lar
│   └── src/
│       ├── controllers/
│       ├── routes/
│       ├── middleware/
│       └── lib/
├── web/              Next.js 14 (App Router) yönetim paneli
│   └── src/
│       ├── app/      Sayfalar (dashboard, giriş vb.)
│       ├── components/
│       └── lib/
└── docker-compose.yml  Yerel PostgreSQL
```

## Rol Hiyerarşisi

| Rol | Açıklama |
|---|---|
| **OWNER** (Patron) | Sistemin tamamına erişir, finansal verileri (net kâr/marj) görebilir |
| **MANAGER** (Müdür) | Operasyonel erişimde OWNER ile eşit, finansal detaylara izinle erişir |
| **TEAM_LEAD** (Şef) | Sadece kendi ekibindeki personelin işlerini görür/atar |
| **STAFF** (Personel) | Sadece kendine atanan işleri görür, iş raporu oluşturur, avans talep eder |
| **CUSTOMER** (Müşteri) | Sadece kendi geçmiş/aktif işlerini ve kendine atanan personelle mesajlaşmayı görür |

Ayrıca granüler bir **izin sistemi** (Permission) ile OWNER, belirli STAFF/TEAM_LEAD kullanıcılarına normalde rolünün üstünde olan yetkiler (örn. finans görüntüleme, müşteri silme) tanımlayabilir.

## Teknoloji Stack'i

**Backend:** Node.js, Express, TypeScript, Prisma ORM, PostgreSQL, JWT (jsonwebtoken), bcrypt, zod (validasyon)

**Web:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion, lucide-react

**Öne çıkan özellikler:** rol bazlı yetkilendirme, personel↔patron/müdür/şef/müşteri mesajlaşma sistemi, bildirim sistemi, denetim logları (audit log), bekleyen onaylar kuyruğu, sistem sağlık izleme, "Komuta Merkezi" canlı dashboard.

## Kurulum

### Gereksinimler
- Node.js 18+
- Docker (yerel PostgreSQL için)

### 1. Veritabanını başlat

Proje kökünde:

```bash
cp .env.example .env
docker compose up -d
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env   # DATABASE_URL, JWT_SECRET, PORT değerlerini ayarla
npx prisma migrate dev
npm run dev             # http://localhost:4000
```

### 3. Web paneli

```bash
cd web
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL değerini ayarla
npm run dev                   # http://localhost:3000
```

### Doğrulama

```bash
# backend
cd backend && npx tsc --noEmit

# web
cd web && npx tsc --noEmit && npx next lint
```

## Ortam Değişkenleri

`.env` ve `.env.local` dosyaları repo'ya dahil değildir (bkz. `.gitignore`). Örnek şablonlar için `.env.example` dosyalarına bakın.
