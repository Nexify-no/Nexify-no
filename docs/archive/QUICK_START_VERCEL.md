# البدء السريع - نشر على Vercel

## الخطوات السريعة (5 دقائق)

### 1. انسخ رابط GitHub
```
https://github.com/Tamerb86/innlegg-production
```

### 2. اذهب إلى Vercel
```
https://vercel.com/new
```

### 3. استيراد المشروع
- انقر على "Import Git Repository"
- الصق الرابط أعلاه
- انقر على "Import"

### 4. أضف متغيرات البيئة
انسخ جميع المتغيرات أدناه وأضفها في Vercel

### 5. انقر على "Deploy"
- انتظر 3-5 دقائق
- سيتم إعطاؤك رابط مثل: `https://innlegg-production.vercel.app`

---

## 📋 متغيرات البيئة الكاملة

### 🔴 الإلزامية (يجب إضافتها)

```
DATABASE_URL=mysql://user:password@host:port/database
JWT_SECRET=your-random-secret-key-min-32-chars
VITE_APP_ID=your-manus-app-id
```

**الشرح**:
- `DATABASE_URL`: رابط قاعدة البيانات MySQL (TiDB أو أي MySQL متوافق)
- `JWT_SECRET`: مفتاح سري عشوائي (استخدم: `openssl rand -base64 32`)
- `VITE_APP_ID`: معرف التطبيق من Manus

---

### 🟡 مهمة جداً (OAuth والمصادقة)

```
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
OWNER_OPEN_ID=your-owner-id
OWNER_NAME=Your Name
```

**الشرح**:
- `OAUTH_SERVER_URL`: خادم OAuth (ثابت: https://api.manus.im)
- `VITE_OAUTH_PORTAL_URL`: بوابة تسجيل الدخول (ثابت: https://portal.manus.im)
- `OWNER_OPEN_ID`: معرفك الفريد في Manus
- `OWNER_NAME`: اسمك الكامل

---

### 💳 Stripe (الدفع)

```
STRIPE_SECRET_KEY=sk_test_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**الشرح**:
- `STRIPE_SECRET_KEY`: المفتاح السري من لوحة تحكم Stripe
- `VITE_STRIPE_PUBLISHABLE_KEY`: المفتاح العام من Stripe
- `STRIPE_WEBHOOK_SECRET`: سر Webhook من إعدادات Stripe

**كيفية الحصول عليها**:
1. اذهب إلى https://dashboard.stripe.com
2. اختر "Developers" > "API Keys"
3. انسخ المفاتيح
4. أضف Webhook في "Webhooks" وانسخ السر

---

### 🔐 Google OAuth (تسجيل الدخول)

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

**الشرح**:
- للسماح بتسجيل الدخول عبر Google

**كيفية الحصول عليها**:
1. اذهب إلى https://console.cloud.google.com
2. أنشئ مشروع جديد
3. اذهب إلى "OAuth consent screen"
4. أنشئ "Credentials" > "OAuth 2.0 Client ID"
5. اختر "Web application"
6. أضف Authorized redirect URI: `https://your-domain.vercel.app/api/oauth/callback`
7. انسخ Client ID و Client Secret

---

### 🤖 Manus APIs (LLM والخدمات)

```
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=your-forge-api-key
VITE_FRONTEND_FORGE_API_KEY=your-frontend-forge-key
VITE_FRONTEND_FORGE_API_URL=https://forge.manus.im
```

**الشرح**:
- للوصول إلى خدمات Manus (LLM, Image Generation, Data API, etc.)

---

### 🔑 OpenAI (توليد النصوص)

```
OPENAI_API_KEY=sk-...
```

**الشرح**:
- للوصول إلى نماذج GPT

**كيفية الحصول عليها**:
1. اذهب إلى https://platform.openai.com/api-keys
2. أنشئ مفتاح جديد
3. انسخه

---

### 🤗 Hugging Face (نماذج AI)

```
HUGGINGFACE_API_KEY=hf_...
```

**الشرح**:
- للوصول إلى نماذج Hugging Face

---

### 📱 Telegram (البوت)

```
TELEGRAM_BOT_TOKEN=your-bot-token
```

**الشرح**:
- لتفعيل بوت Telegram

**كيفية الحصول عليها**:
1. تحدث مع @BotFather على Telegram
2. اكتب `/newbot`
3. اتبع التعليمات
4. انسخ Token

---

### 📊 Analytics (تحليل الزوار)

```
VITE_ANALYTICS_ENDPOINT=https://analytics.example.com
VITE_ANALYTICS_WEBSITE_ID=your-website-id
```

**الشرح**:
- لتتبع الزوار والإحصائيات

---

### 🎨 التطبيق (التخصيص)

```
VITE_APP_TITLE=Innlegg
VITE_APP_LOGO=https://your-logo-url.png
```

**الشرح**:
- `VITE_APP_TITLE`: اسم التطبيق
- `VITE_APP_LOGO`: رابط شعار التطبيق

---

## ✅ قائمة التحقق

قبل النشر، تأكد من:

- [ ] `DATABASE_URL` صحيح وقاعدة البيانات متاحة
- [ ] `JWT_SECRET` مفتاح عشوائي قوي (32+ حرف)
- [ ] `STRIPE_SECRET_KEY` و `STRIPE_WEBHOOK_SECRET` من Stripe
- [ ] `GOOGLE_CLIENT_ID` و `GOOGLE_CLIENT_SECRET` من Google Cloud
- [ ] جميع المفاتيح السرية محمية (لا تشاركها في الكود)
- [ ] Webhook URLs محدثة في Stripe و Google

---

## 🚀 اختبر التطبيق

بعد النشر:

```bash
# الصفحة الرئيسية
https://your-domain.vercel.app

# API
https://your-domain.vercel.app/api/trpc/auth.me

# لوحة التحكم
https://your-domain.vercel.app/dashboard

# اختبر تسجيل الدخول
# انقر على "Prov gratis" واختبر OAuth
```

---

## 📝 تحديث التطبيق

```bash
git add .
git commit -m "Update: your changes"
git push origin main
# سيتم النشر تلقائياً!
```

---

## ⚠️ المشاكل الشائعة

| المشكلة | الحل |
|--------|------|
| Build failed | تحقق من DATABASE_URL وجميع المتغيرات الإلزامية |
| Function timed out | زيادة maxDuration في vercel.json من 60 إلى 300 |
| Database connection error | تحقق من جدران الحماية وأن قاعدة البيانات متاحة من Vercel |
| Webhook failed | تأكد من STRIPE_WEBHOOK_SECRET صحيح |
| OAuth failed | تحقق من GOOGLE_CLIENT_ID و Redirect URI |
| API errors | تحقق من BUILT_IN_FORGE_API_KEY صحيح |

---

## 🔗 الروابط المفيدة

- [Vercel Docs](https://vercel.com/docs)
- [Stripe Dashboard](https://dashboard.stripe.com)
- [Google Cloud Console](https://console.cloud.google.com)
- [OpenAI API Keys](https://platform.openai.com/api-keys)
- [GitHub Repository](https://github.com/Tamerb86/innlegg-production)

---

## 💡 نصائح

1. **استخدم متغيرات البيئة المختلفة** للتطوير والإنتاج
2. **احفظ المفاتيح السرية** في مكان آمن (مثل 1Password أو LastPass)
3. **راجع السجلات** في Vercel إذا حدثت مشاكل
4. **اختبر الميزات الحرجة** بعد كل نشر
5. **فعّل HTTPS** (يتم تلقائياً في Vercel)
