# دليل نشر التطبيق على Vercel

## المتطلبات
- حساب GitHub (تم إنشاء repository بالفعل)
- حساب Vercel (مجاني)
- جميع متغيرات البيئة المطلوبة

## خطوات النشر

### 1. إنشاء حساب Vercel وربطه مع GitHub
```bash
# اذهب إلى https://vercel.com
# انقر على "Sign Up" واختر "Continue with GitHub"
# وافق على الأذونات المطلوبة
```

### 2. استيراد المشروع
```bash
# في لوحة تحكم Vercel:
# 1. انقر على "Add New..." > "Project"
# 2. اختر "Import Git Repository"
# 3. ابحث عن "innlegg-production"
# 4. انقر على "Import"
```

### 3. إعداد متغيرات البيئة
في صفحة إعدادات المشروع، أضف جميع المتغيرات التالية:

**قاعدة البيانات**:
```
DATABASE_URL=mysql://user:password@host:port/database
```

**المصادقة**:
```
JWT_SECRET=your-secret-key-here
VITE_APP_ID=your-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
OWNER_OPEN_ID=your-owner-id
OWNER_NAME=Your Name
```

**Manus APIs**:
```
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=your-api-key
VITE_FRONTEND_FORGE_API_KEY=your-frontend-key
VITE_FRONTEND_FORGE_API_URL=https://forge.manus.im
```

**Stripe (الدفع)**:
```
STRIPE_SECRET_KEY=sk_test_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Google OAuth**:
```
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

**APIs الأخرى**:
```
OPENAI_API_KEY=sk-...
HUGGINGFACE_API_KEY=hf_...
TELEGRAM_BOT_TOKEN=your-bot-token
```

**Analytics**:
```
VITE_ANALYTICS_ENDPOINT=https://analytics.example.com
VITE_ANALYTICS_WEBSITE_ID=your-website-id
```

**التطبيق**:
```
VITE_APP_TITLE=Innlegg
VITE_APP_LOGO=https://your-logo-url.png
```

### 4. النشر
```bash
# بعد إضافة جميع المتغيرات:
# 1. انقر على "Deploy"
# 2. انتظر اكتمال البناء (عادة 3-5 دقائق)
# 3. سيتم إعطاؤك رابط مؤقت مثل: https://innlegg-production.vercel.app
```

### 5. إعداد النطاق المخصص (اختياري)
```bash
# في إعدادات المشروع > Domains:
# 1. انقر على "Add Domain"
# 2. أدخل نطاقك (مثل: innlegg.no)
# 3. اتبع التعليمات لتحديث DNS
```

### 6. إعداد Stripe Webhook
```bash
# في لوحة تحكم Stripe:
# 1. اذهب إلى Developers > Webhooks
# 2. انقر على "Add endpoint"
# 3. أدخل رابط Webhook:
#    https://your-vercel-domain.com/api/stripe/webhook
# 4. اختر الأحداث:
#    - checkout.session.completed
#    - payment_intent.succeeded
#    - invoice.paid
# 5. انسخ "Signing secret" وأضفه كـ STRIPE_WEBHOOK_SECRET
```

## التحقق من النشر

### 1. اختبر الصفحة الرئيسية
```bash
curl https://your-vercel-domain.com
```

### 2. اختبر API
```bash
curl https://your-vercel-domain.com/api/trpc/auth.me
```

### 3. اختبر المصادقة
```bash
# اذهب إلى https://your-vercel-domain.com
# انقر على "Prov gratis"
# تحقق من أن المصادقة تعمل بشكل صحيح
```

### 4. اختبر الدفع
```bash
# في لوحة التحكم:
# 1. اذهب إلى "Billing"
# 2. اختر خطة Pro
# 3. استخدم بطاقة الاختبار: 4242 4242 4242 4242
# 4. تحقق من أن الدفع يعمل بشكل صحيح
```

## استكشاف الأخطاء

### خطأ: "Build failed"
```bash
# تحقق من:
# 1. جميع متغيرات البيئة موجودة
# 2. DATABASE_URL صحيح
# 3. لا توجد أخطاء TypeScript
```

### خطأ: "Function timed out"
```bash
# زيادة timeout في vercel.json:
# "maxDuration": 60  # من 60 إلى 300 ثانية
```

### خطأ: "Database connection failed"
```bash
# تحقق من:
# 1. DATABASE_URL صحيح
# 2. قاعدة البيانات متاحة من Vercel
# 3. جدران الحماية تسمح بالاتصال من Vercel IPs
```

## المراقبة والتحديثات

### عرض السجلات
```bash
# في لوحة تحكم Vercel:
# 1. اذهب إلى "Deployments"
# 2. اختر آخر نشر
# 3. انقر على "Logs" لعرض السجلات
```

### تحديث التطبيق
```bash
# كل push إلى main سيؤدي إلى نشر جديد تلقائياً:
git add .
git commit -m "Update: your changes"
git push origin main
```

### إعادة النشر اليدوي
```bash
# في لوحة تحكم Vercel:
# 1. اذهب إلى "Deployments"
# 2. انقر على "..." بجانب آخر نشر
# 3. اختر "Redeploy"
```

## الأمان

### حماية متغيرات البيئة
```bash
# في إعدادات المشروع > Environment Variables:
# 1. جميع المفاتيح السرية محمية تلقائياً
# 2. لا تشاركها في الكود
# 3. استخدم .env.local للتطوير المحلي
```

### تفعيل HTTPS
```bash
# Vercel يفعل HTTPS تلقائياً لجميع النطاقات
# تحقق من شهادة SSL في إعدادات المشروع
```

### حماية Webhook
```bash
# تحقق من توقيع Webhook في الكود:
# server/routers/paymentRouter.ts
# يتحقق من STRIPE_WEBHOOK_SECRET
```

## الخطوات التالية

1. **إضافة مراقبة Sentry** - تتبع الأخطاء
2. **إضافة Google Analytics** - تتبع الزوار
3. **إعداد CDN** - تسريع تسليم الملفات
4. **إضافة Caching** - تحسين الأداء
5. **إعداد CI/CD** - أتمتة الاختبارات والنشر

## المراجع

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Vercel Deployment](https://vercel.com/docs/concepts/deployments/overview)
- [Node.js on Vercel](https://vercel.com/docs/concepts/runtimes/nodejs)
