# API بک‌اند

بک‌اند تسک فرانت. فرانت با این API کار می‌کند و Swagger را منبع حقیقت می‌بیند. همهٔ مسیرها، بدنه‌ها و رویدادهای پایین باید در Swagger باشند.

Base URL کلاینت: `/api/v1`

Swagger UI: `/docs`

## محدوده

- ثبت‌نام، ورود، خروج و اطلاعات کاربر جاری
- لیست کاربران برای ادمین
- وضعیت آنلاین / آفلاین
- درخواست ادمین به کاربر، و قبول یا رد با متن

لاگ ورود، خروج و تغییر وضعیت API ندارد. فرانت خودش آن را محلی نگه می‌دارد.

وضعیت زنده فقط با REST خوانده می‌شود. روی SSE و سوکت رویداد وضعیت نفرست.

درخواست زنده را هم SSE بده هم WebSocket، با رویداد و بدنهٔ یکسان. فرانت یکی را انتخاب می‌کند.

## مشترک

احراز هویت REST: هدر `Authorization: Bearer <token>`

SSE و سوکت هدر نمی‌گیرند. توکن در query است: `?token=<token>`

خطاها همیشه این شکل را دارند:

```json
{ "detail": "پیام قابل‌خواندن" }
```

| کد | معنی |
|---|---|
| 401 | توکن نیست، نامعتبر است، یا منقضی شده |
| 403 | نقش اجازه ندارد |
| 404 | کاربر یا درخواست پیدا نشد |
| 409 | تعارض؛ تکراری بودن نام کاربری یا درخواست باز |
| 422 | بدنهٔ نامعتبر |

خروج باید توکن فعلی را بی‌اعتبار کند. بعد از خروج همان توکن 401 بدهد.

یک حساب ادمین از env ساخته شود.

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

نقش‌ها: `admin` و `user`. وضعیت‌ها: `online` و `offline`. کاربر تازه‌ثبت‌نام‌شده `offline` است.

## مدل‌ها

کاربر:

```json
{
  "id": "uuid",
  "username": "sara",
  "role": "user",
  "status": "offline",
  "status_updated_at": "2026-10-25T10:00:00Z",
  "created_at": "2026-10-25T09:00:00Z"
}
```

رمز در هیچ پاسخی برنگردد.

درخواست:

```json
{
  "id": "uuid",
  "from_user_id": "uuid",
  "from_username": "admin",
  "to_user_id": "uuid",
  "to_username": "sara",
  "state": "pending",
  "message": "",
  "created_at": "2026-10-25T10:15:00Z",
  "responded_at": null
}
```

`state`: `pending` | `accepted` | `rejected`

`message` متنی است که کاربر همراه قبول یا رد می‌فرستد. تا قبل از جواب خالی است.

## ورود و خروج

### `POST /auth/register`

عمومی. کاربر با نقش `user` می‌سازد.

```json
{ "username": "sara", "password": "secret12" }
```

`username` یکتا است، فاصله ندارد، و به‌صورت lowercase ذخیره می‌شود. رمز حداقل ۸ کاراکتر.

پاسخ `201`: آبجکت کاربر.

نام تکراری: `409`.

### `POST /auth/login`

عمومی.

```json
{ "username": "sara", "password": "secret12" }
```

پاسخ `200`:

```json
{
  "access_token": "jwt",
  "token_type": "bearer",
  "user": {}
}
```

`user` همان مدل کاربر است. نام کاربری یا رمز اشتباه: `401`.

### `POST /auth/logout`

کاربر واردشده. پاسخ `204` بدون بدنه. توکن جاری از این به بعد نامعتبر است.

### `GET /auth/me`

کاربر واردشده. پاسخ `200`: مدل کاربر. هدر پنل کاربر از همین تغذیه می‌شود.

## کاربران و وضعیت

### `GET /users`

فقط `admin`. پاسخ `200`: آرایهٔ مدل کاربر.

### `GET /users/{user_id}/status`

فقط `admin`. این مسیر خواندن وضعیت زنده است. فرانت خودش آن را تکرار می‌کند. پاسخ را cache نکن.

پاسخ `200`:

```json
{
  "user_id": "uuid",
  "username": "sara",
  "status": "online",
  "status_updated_at": "2026-10-25T10:20:00Z"
}
```

### `PATCH /users/me/status`

کاربر واردشده، وضعیت خودش را عوض می‌کند. ادمین با این مسیر وضعیت کس دیگری را عوض نمی‌کند.

```json
{ "status": "online" }
```

`status` فقط `online` یا `offline`. پاسخ `200`: همان بدنهٔ `GET /users/{user_id}/status` برای خود کاربر.

## درخواست

برای هر کاربر مقصد فقط یک درخواست `pending` می‌تواند وجود داشته باشد.

### `POST /requests`

فقط `admin`.

```json
{ "user_id": "uuid" }
```

مقصد باید کاربر با نقش `user` باشد. پاسخ `201`: مدل درخواست با `state: "pending"`.

همان لحظه رویداد `request` فقط برای همان کاربر مقصد فرستاده می‌شود.

اگر برای آن کاربر درخواست `pending` مانده باشد: `409`.

### `POST /requests/{request_id}/respond`

فقط کاربر مقصد همان درخواست.

```json
{ "action": "accept", "message": "الان هستم" }
```

`action`: `accept` | `reject`. `message` رشته است و می‌تواند خالی باشد.

پاسخ `200`: مدل درخواست. `state` برابر `accepted` یا `rejected` می‌شود، `message` پر می‌شود، `responded_at` زمان جواب است.

همان لحظه رویداد `request_answered` فقط برای ادمینی که درخواست را ساخته فرستاده می‌شود.

اگر درخواست مال این کاربر نباشد: `403`. اگر دیگر `pending` نباشد: `409`.

GET برای خواندن یا پول کردن درخواست نساز. نتیجه فقط از کانال لایو می‌رسد.

## کانال لایو درخواست

هر دو را بساز. رویدادها، فیلدها و مخاطب یکی باشد.

| کانال | آدرس |
|---|---|
| SSE | `GET /events/stream?token=<token>` |
| WebSocket | `GET /events/ws?token=<token>` ارتقا به سوکت |

توکن نامعتبر: SSE با `401` بسته شود. سوکت قبل از مکالمه بسته شود.

رویدادها JSON هستند.

SSE:

```text
data: {"type":"snapshot","requests":[]}

data: {"type":"request","request":{}}

data: {"type":"request_answered","request":{}}
```

هر ۲۵ ثانیه یک keepalive بفرست تا اتصال قطع نشود:

```text
: keepalive
```

هدرهای SSE: `Content-Type: text/event-stream` و `Cache-Control: no-cache`.

WebSocket همان JSON را در یک text frame می‌فرستد. هر ۲۵ ثانیه:

```json
{ "type": "ping" }
```

کلاینت لازم نیست چیزی بفرستد. ساخت و جواب درخواست فقط از REST است.

### رویدادها

اولین پیام بعد از اتصال، برای هر دو کانال:

```json
{ "type": "snapshot", "requests": [] }
```

برای کاربر، `requests` درخواست `pending` خودش است؛ صفر یا یک آیتم. برای ادمین، درخواست‌های `pending` که خودش ساخته. درخواست جواب‌داده‌شده در snapshot نیست.

درخواست جدید، فقط به کاربر مقصد:

```json
{ "type": "request", "request": {} }
```

`request` مدل کامل درخواست است.

جواب کاربر، فقط به ادمین سازنده:

```json
{ "type": "request_answered", "request": {} }
```

`request.state` این‌جا `accepted` یا `rejected` است و `message` متن کاربر است.

تغییر آنلاین / آفلاین روی این کانال‌ها ارسال نمی‌شود.
