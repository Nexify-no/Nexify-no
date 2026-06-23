# متغيرات البيئة - Environment Variables

## نظرة عامة
هذا الملف يوثق جميع متغيرات البيئة المستخدمة في تطبيق Innlegg (Nexify AI).

---

## متغيرات البيئة الأساسية

### المصادقة والأمان (Authentication & Security)

| المتغير | الوصف | الحالة | الملاحظات |
|--------|-------|--------|----------|
| `VITE_APP_ID` | معرّف تطبيق Manus OAuth | مطلوب | يستخدم لتسجيل الدخول عبر Manus |
| `OAUTH_SERVER_URL` | رابط خادم Manus OAuth | مطلوب | مثال: `https://api.manus.im` |
| `VITE_OAUTH_PORTAL_URL` | رابط بوابة تسجيل الدخول | مطلوب | يستخدم للتوجيه إلى صفحة تسجيل الدخول |
| `JWT_SECRET` | مفتاح التوقيع للـ JWT | مطلوب | يستخدم لتوقيع ملفات تعريف الجلسة |
| `OWNER_OPEN_ID` | معرّف المالك في Manus | مطلوب | معرّف فريد للمالك |
| `OWNER_NAME` | اسم المالك | اختياري | يستخدم في الإشعارات والتقارير |

### قاعدة البيانات (Database)

| المتغير | الوصف | الحالة | الملاحظات |
|--------|-------|--------|----------|
| `DATABASE_URL` | رابط اتصال قاعدة البيانات | مطلوب | MySQL/TiDB connection string |

### APIs الخارجية (External APIs)

| المتغير | الوصف | الحالة | الملاحظات |
|--------|-------|--------|----------|
| `BUILT_IN_FORGE_API_URL` | رابط Manus Forge API | مطلوب | للوصول إلى LLM والخدمات المدمجة |
| `BUILT_IN_FORGE_API_KEY` | مفتاح Manus Forge API | مطلوب | Bearer token للخادم |
| `VITE_FRONTEND_FORGE_API_KEY` | مفتاح Forge للـ Frontend | مطلوب | Bearer token للعميل |
| `VITE_FRONTEND_FORGE_API_URL` | رابط Forge للـ Frontend | مطلوب | يستخدم من المتصفح |
| `OPENAI_API_KEY` | مفتاح OpenAI API | مطلوب | للوصول إلى نماذج GPT |
| `HUGGINGFACE_API_KEY` | مفتاح Hugging Face API | مطلوب | للوصول إلى نماذج Hugging Face |

### الدفع (Payment)

| المتغير | الوصف | الحالة | الملاحظات |
|--------|-------|--------|----------|
| `STRIPE_SECRET_KEY` | مفتاح Stripe السري | مطلوب | للمعاملات المالية |
| `VITE_STRIPE_PUBLISHABLE_KEY` | مفتاح Stripe العام | مطلوب | يستخدم من المتصفح |
| `STRIPE_WEBHOOK_SECRET` | مفتاح Stripe Webhook | مطلوب | للتحقق من أحداث Stripe |

### التطبيق (Application)

| المتغير | الوصف | الحالة | الملاحظات |
|--------|-------|--------|----------|
| `VITE_APP_TITLE` | عنوان التطبيق | اختياري | يظهر في الـ Browser Tab |
| `VITE_APP_LOGO` | رابط شعار التطبيق | اختياري | يظهر في الـ Header |
| `NODE_ENV` | بيئة التشغيل | مطلوب | `development` أو `production` |

### التحليلات (Analytics)

| المتغير | الوصف | الحالة | الملاحظات |
|--------|-------|--------|----------|
| `VITE_ANALYTICS_ENDPOINT` | نقطة نهاية التحليلات | اختياري | لتتبع استخدام المستخدمين |
| `VITE_ANALYTICS_WEBSITE_ID` | معرّف موقع التحليلات | اختياري | معرّف فريد للموقع |

### التواصل الآلي (Messaging)

| المتغير | الوصف | الحالة | الملاحظات |
|--------|-------|--------|----------|
| `TELEGRAM_BOT_TOKEN` | رمز بوت Telegram | اختياري | للتكامل مع Telegram |

---

## متغيرات البيئة حسب البيئة

### بيئة التطوير (Development)

```env
NODE_ENV=development
VITE_APP_ID=<your-dev-app-id>
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
JWT_SECRET=<your-dev-jwt-secret>
DATABASE_URL=<your-dev-database-url>
BUILT_IN_FORGE_API_URL=https://api.manus.im/forge
BUILT_IN_FORGE_API_KEY=<your-forge-key>
VITE_FRONTEND_FORGE_API_KEY=<your-frontend-forge-key>
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im/forge
OPENAI_API_KEY=<your-openai-key>
HUGGINGFACE_API_KEY=<your-huggingface-key>
STRIPE_SECRET_KEY=sk_test_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
```

### بيئة الإنتاج (Production)

```env
NODE_ENV=production
VITE_APP_ID=<your-prod-app-id>
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
JWT_SECRET=<your-prod-jwt-secret>
DATABASE_URL=<your-prod-database-url>
BUILT_IN_FORGE_API_URL=https://api.manus.im/forge
BUILT_IN_FORGE_API_KEY=<your-prod-forge-key>
VITE_FRONTEND_FORGE_API_KEY=<your-prod-frontend-forge-key>
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im/forge
OPENAI_API_KEY=<your-prod-openai-key>
HUGGINGFACE_API_KEY=<your-prod-huggingface-key>
STRIPE_SECRET_KEY=sk_live_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_live_...
OWNER_OPEN_ID=<owner-id>
OWNER_NAME=<owner-name>
VITE_APP_TITLE=Innlegg - Din AI Innholdsassistent
VITE_APP_LOGO=<logo-url>
```

---

## تكوين Vercel

عند النشر على Vercel، تأكد من تعيين جميع المتغيرات المطلوبة في:
**Settings → Environment Variables**

### خطوات التكوين:

1. اذهب إلى [Vercel Dashboard](https://vercel.com)
2. اختر مشروع `innlegg-production`
3. انقر على **Settings**
4. اختر **Environment Variables**
5. أضف كل متغير من القائمة أعلاه
6. اختر البيئات المناسبة (Production/Preview/Development)
7. انقر **Save**

### متغيرات الإنتاج الحرجة:

```
✓ VITE_APP_ID
✓ OAUTH_SERVER_URL
✓ VITE_OAUTH_PORTAL_URL
✓ JWT_SECRET
✓ DATABASE_URL
✓ BUILT_IN_FORGE_API_URL
✓ BUILT_IN_FORGE_API_KEY
✓ OPENAI_API_KEY
✓ STRIPE_SECRET_KEY
✓ STRIPE_WEBHOOK_SECRET
```

---

## استكشاف الأخطاء

### خطأ: redirect_uri_mismatch

**السبب:** عدم تطابق رابط إعادة التوجيه في OAuth

**الحل:**
1. تحقق من `VITE_OAUTH_PORTAL_URL`
2. تأكد من أن رابط إعادة التوجيه يطابق: `https://your-domain.com/api/oauth/callback`
3. حدّث إعدادات OAuth في Manus

### خطأ: Database Connection Failed

**السبب:** `DATABASE_URL` غير صحيح

**الحل:**
1. تحقق من صيغة الاتصال
2. تأكد من أن قاعدة البيانات متاحة
3. تحقق من بيانات اعتماد الوصول

### خطأ: API Key Invalid

**السبب:** مفتاح API منتهي الصلاحية أو غير صحيح

**الحل:**
1. تحقق من صحة المفتاح
2. تأكد من عدم انتهاء صلاحيته
3. أنشئ مفتاح جديد إذا لزم الأمر

---

## الأمان (Security)

⚠️ **تنبيهات أمان مهمة:**

1. **لا تشارك مفاتيح API** - احفظها سراً
2. **استخدم متغيرات البيئة** - لا تضعها في الكود
3. **قم بتدوير المفاتيح بانتظام** - خاصة في الإنتاج
4. **استخدم HTTPS فقط** - لجميع الاتصالات
5. **راقب الأنشطة المريبة** - في لوحات تحكم الخدمات

---

## المراجع

- [Manus Documentation](https://docs.manus.im)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [OpenAI API Keys](https://platform.openai.com/account/api-keys)
- [Stripe API Keys](https://dashboard.stripe.com/apikeys)

---

**آخر تحديث:** مايو 2026
**الإصدار:** 1.0
