# RWMS — Remote Work Management System

سیستم سبک‌وزن هماهنگی کار ریموت. حضور، کارکرد، وضعیت، گزارش روزانه و تایم‌لاین تیم — بدون چت، بدون ویدئو.

---

## فهرست

- [تکنولوژی‌ها](#تکنولوژیها)
- [پیش‌نیازها](#پیشنیازها)
- [راه‌اندازی سریع با Docker](#راهاندازی-سریع-با-docker)
- [متغیرهای محیطی](#متغیرهای-محیطی)
- [اجرای محلی بدون Docker](#اجرای-محلی-بدون-docker)
- [دیتابیس و داده‌های پایدار](#دیتابیس-و-دادههای-پایدار)
- [دستورات مفید](#دستورات-مفید)
- [ساختار پروژه](#ساختار-پروژه)
- [نقش‌ها و دسترسی‌ها](#نقشها-و-دسترسیها)
- [فیچرها](#فیچرها)

---

## تکنولوژی‌ها

### بک‌اند
| تکنولوژی | نسخه | کاربرد |
|-----------|------|---------|
| Python | 3.12 | زبان اصلی |
| FastAPI | 0.115 | فریم‌ورک API async |
| SQLModel | 0.0.21 | ORM روی SQLAlchemy |
| Alembic | 1.13 | مدیریت migration دیتابیس |
| asyncpg | 0.29 | درایور async PostgreSQL |
| python-jose | 3.3 | JWT auth |
| passlib / bcrypt | 1.7 / 4.0 | هش رمز عبور |
| Uvicorn | 0.30 | ASGI server |
| Gunicorn | 23.0 | process manager |

### فرانت‌اند
| تکنولوژی | نسخه | کاربرد |
|-----------|------|---------|
| Next.js | 15 (App Router) | فریم‌ورک React |
| TypeScript | 5 | تایپ‌سیف |
| TailwindCSS | 3 | استایل |
| React Query (TanStack) | 5 | مدیریت state سرور |
| Zustand | 4 | state management کلاینت |
| Axios | — | HTTP client |

### زیرساخت
| تکنولوژی | کاربرد |
|-----------|---------|
| PostgreSQL 16 | دیتابیس اصلی |
| Docker + Compose | containerization |
| SSE (Server-Sent Events) | real-time حضور |

---

## پیش‌نیازها

- **Docker Desktop** (شامل Docker Compose) — نسخه 24+
- پورت‌های `8080` (API) و `3010` (فرانت) آزاد باشند

> برای اجرای محلی بدون Docker: Python 3.12+، Node.js 20+، PostgreSQL 16

---

## راه‌اندازی سریع با Docker

### مرحله ۱ — کلون پروژه

```bash
git clone <repo-url>
cd remote-work
```

### مرحله ۲ — ساخت فایل `.env`

```bash
cp .env.example .env
```

محتوای `.env.example`:

```env
POSTGRES_USER=rwms
POSTGRES_PASSWORD=rwms
POSTGRES_DB=rwms
SECRET_KEY=changeme_in_production
CORS_ORIGINS=http://localhost:3010
NEXT_PUBLIC_API_URL=http://localhost:8080
```

> **مهم:** در production حتماً `SECRET_KEY` را به یک رشته تصادفی طولانی تغییر دهید.
> ```bash
> openssl rand -hex 32
> ```

### مرحله ۳ — build و اجرا

```bash
docker compose up --build
```

بار اول چند دقیقه طول می‌کشد (دانلود image‌ها + نصب dependency‌ها).

### مرحله ۴ — دسترسی به اپلیکیشن

| سرویس | آدرس |
|-------|------|
| فرانت‌اند | http://localhost:3010 |
| API بک‌اند | http://localhost:8080 |
| مستندات API | http://localhost:8080/docs |

### مرحله ۵ — ورود با حساب ادمین پیش‌فرض

```
نام کاربری: admin
رمز عبور:  admin123
```

> بعد از اولین ورود رمز را تغییر دهید.

---

## متغیرهای محیطی

### سطح ریشه (`.env`)

| متغیر | پیش‌فرض | توضیح |
|-------|---------|-------|
| `POSTGRES_USER` | `rwms` | نام کاربری PostgreSQL |
| `POSTGRES_PASSWORD` | `rwms` | رمز PostgreSQL |
| `POSTGRES_DB` | `rwms` | نام دیتابیس |
| `SECRET_KEY` | `changeme_in_production` | کلید امضای JWT — **حتماً عوض کنید** |
| `CORS_ORIGINS` | `http://localhost:3010` | origin مجاز برای CORS (چند origin با `,` جدا) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` | آدرس API برای فرانت‌اند |

### بک‌اند مجزا (`backend/.env`)

فقط برای اجرای بک‌اند بدون Docker:

```env
DATABASE_URL=postgresql+asyncpg://rwms:rwms@localhost:5432/rwms
SECRET_KEY=changeme_in_production
CORS_ORIGINS=http://localhost:3010
```

---

## اجرای محلی بدون Docker

### بک‌اند

```bash
cd backend

# ساخت محیط مجازی
python -m venv .venv
source .venv/bin/activate      # Linux/Mac
.venv\Scripts\activate         # Windows

# نصب dependency‌ها
pip install -r requirements.txt

# تنظیم متغیرهای محیطی
cp .env.example .env
# ویرایش .env و تنظیم DATABASE_URL به PostgreSQL محلی

# اجرای migration‌ها
alembic upgrade head

# اجرای سرور
uvicorn app.main:app --reload --port 8000
```

### فرانت‌اند

```bash
cd frontend

# نصب dependency‌ها
npm install

# ساخت فایل محیطی
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# اجرای سرور توسعه
npm run dev
```

فرانت‌اند روی http://localhost:3000 اجرا می‌شود.

---

## دیتابیس و داده‌های پایدار

### آیا با restart بک‌اند داده‌ها از دست می‌روند؟

**خیر.** دیتابیس کاملاً مستقل از بک‌اند زندگی می‌کند.

`docker compose.yml` از یک **named volume** استفاده می‌کند:

```yaml
volumes:
  postgres_data:   # روی هاست ذخیره می‌شود، نه داخل container
```

| دستور | اثر روی دیتابیس |
|-------|----------------|
| `docker compose restart backend` | هیچ — داده سالم است |
| `docker compose down` | هیچ — داده سالم است |
| `docker compose up` | هیچ — داده سالم است |
| `docker compose down -v` | ⚠️ **داده حذف می‌شود** — از این پرهیز کنید |

### Migration خودکار

هر بار که بک‌اند استارت می‌شود، `entrypoint.sh` اجرا می‌شود:

```sh
alembic upgrade head   # migration‌های جدید را اعمال می‌کند
uvicorn app.main:app   # سرور را می‌آورد بالا
```

Alembic در جدول `alembic_version` وضعیت را نگه می‌دارد و migration‌های قبلاً اجرا شده را تکرار نمی‌کند. **هیچ کار اضافه‌ای نیاز نیست.**

### بکاپ دیتابیس

```bash
# گرفتن dump
docker compose exec db pg_dump -U rwms rwms > backup.sql

# ریستور از dump
docker compose exec -T db psql -U rwms rwms < backup.sql
```

---

## دستورات مفید

### مدیریت سرویس‌ها

```bash
# اجرا در پس‌زمینه
docker compose up -d --build

# مشاهده لاگ‌ها
docker compose logs -f
docker compose logs -f backend
docker compose logs -f frontend

# ریستارت یک سرویس
docker compose restart backend
docker compose restart frontend

# متوقف کردن (داده حفظ می‌شود)
docker compose down

# build مجدد یک سرویس
docker compose up --build backend
```

### دیتابیس

```bash
# اتصال به PostgreSQL
docker compose exec db psql -U rwms rwms

# اجرای migration دستی
docker compose exec backend alembic upgrade head

# مشاهده تاریخچه migration‌ها
docker compose exec backend alembic history

# rollback به migration قبلی
docker compose exec backend alembic downgrade -1
```

### تست‌ها (بک‌اند)

```bash
# داخل container
docker compose exec backend pytest -v

# محلی
cd backend && pytest -v
```

---

## ساختار پروژه

```
remote-work/
├── docker-compose.yml
├── .env.example
│
├── backend/
│   ├── Dockerfile
│   ├── entrypoint.sh          # alembic migrate → uvicorn start
│   ├── requirements.txt
│   ├── alembic/
│   │   └── versions/          # migration فایل‌ها
│   └── app/
│       ├── main.py            # FastAPI app + lifespan
│       ├── core/
│       │   ├── config.py      # تنظیمات از env
│       │   ├── database.py    # async engine + session
│       │   ├── security.py    # JWT + bcrypt
│       │   ├── events.py      # SSE broadcast
│       │   └── scheduler.py   # midnight auto-close
│       ├── modules/
│       │   ├── auth/          # ورود + refresh token
│       │   ├── users/         # مدیریت کاربران
│       │   ├── work/          # سشن کارکرد
│       │   ├── status/        # وضعیت حضور
│       │   ├── reports/       # گزارش روزانه
│       │   ├── timeline/      # رویدادهای روزانه
│       │   └── calendar/      # تقویم + تأیید کارکرد
│       └── shared/
│           ├── dependencies.py
│           └── roles.py
│
└── frontend/
    ├── Dockerfile
    └── src/
        ├── app/               # Next.js App Router صفحات
        │   ├── dashboard/
        │   ├── presence/
        │   ├── team/
        │   ├── calendar/
        │   └── admin/
        ├── components/        # کامپوننت‌های قابل‌استفاده مجدد
        ├── services/          # API call‌ها (axios)
        ├── store/             # Zustand stores
        ├── hooks/
        ├── types/
        └── utils/
```

---

## نقش‌ها و دسترسی‌ها

```
ADMIN
  └── MANAGER
        └── SUPERVISOR
              └── MEMBER
```

| دسترسی | ADMIN | MANAGER | SUPERVISOR | MEMBER |
|--------|:-----:|:-------:|:----------:|:------:|
| مدیریت کاربران | ✓ | ✓ | ✓ (فقط member) | — |
| تقویم تیم | — | ✓ | ✓ | ✓ (فقط خود) |
| ست کردن روز ریموت/مرخصی | — | ✓ | ✓ | — |
| یادداشت روز (tasks) | — | ✓ | ✓ | فقط خواندن |
| تأیید کارکرد | — | — | ✓ | — |
| شروع/پایان کار (برای دیگری) | — | ✓ | ✓ (team) | — |
| پینگ حضور | — | ✓ | ✓ | — |
| داشبورد شخصی | — | — | ✓ | ✓ |
| پنل ادمین | ✓ | — | — | — |

---

## فیچرها

- **سشن کارکرد** — شروع/پایان با timer زنده
- **وضعیت حضور** — آنلاین، تمرکز، استراحت، جلسه، آفلاین (real-time SSE)
- **بورد حضور** — نمایش live وضعیت کل تیم
- **پینگ** — بررسی حضور با تأیید دو طرفه
- **گزارش روزانه** — متن بولت‌پوینتی با autosave
- **تایم‌لاین** — رویدادهای روز (شروع کار، تغییر وضعیت، گزارش)
- **تقویم تیم** — جلالی، با فیلتر سرپرست/شخص
- **تأیید کارکرد** — supervisor ساعت دقیق را تأیید یا رد می‌کند
- **یادداشت روز** — supervisor تسک و یادداشت روزانه تعریف می‌کند، member در داشبورد می‌بیند
- **کنترل سشن** — supervisor/manager می‌توانند سشن اعضا را شروع یا پایان دهند
- **بستن خودکار سشن** — هر شب ساعت ۰۰:۰۰ تهران، سشن‌های باز قدیمی بسته می‌شوند
- **پنل ادمین** — مدیریت کاربران، عملکرد، آمار
