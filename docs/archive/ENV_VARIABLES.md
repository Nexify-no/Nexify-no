# متغيرات البيئة - Innlegg

## 📋 قائمة جميع متغيرات البيئة المستخدمة في المشروع

---

## 🔴 الإلزامية (REQUIRED)

هذه المتغيرات **يجب** أن تكون موجودة لكي يعمل التطبيق:

### قاعدة البيانات
```
DATABASE_URL=mysql://user:password@host:port/innlegg
```
- **الوصف**: رابط الاتصال بقاعدة البيانات MySQL
- **مثال**: `mysql://admin:pass123@db.example.com:3306/innlegg`

### المصادقة والأمان
```
JWT_SECRET=your-random-secret-key-min-32-characters-long
```
- **الوصف**: مفتاح سري لتوقيع JWT tokens
- **الحد الأدنى**: 32 حرف عشوائي قوي
- **توليد**: `openssl rand -base64 32`

```
OAUTH_SERVER_URL=https://api.manus.im
```
- **الوصف**: خادم OAuth (ثابت)
- **القيمة**: `https://api.manus.im`

```
VITE_APP_ID=your-manus-app-id
```
- **الوصف**: معرف التطبيق من Manus
- **الحصول عليها**: من لوحة تحكم Manus

```
OWNER_OPEN_ID=your-owner-id
```
- **الوصف**: معرف المالك الفريد في Manus
- **الحصول عليها**: من حسابك في Manus

```
OWNER_NAME=Your Name
```
- **الوصف**: اسم مالك التطبيق
- **مثال**: `Ahmed Mohamed`

### Stripe (الدفع)
```
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
```
- **الوصف**: المفتاح السري من Stripe
- **الحصول عليها**: https://dashboard.stripe.com/apikeys

```
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```
- **الوصف**: سر Webhook من Stripe
- **الحصول عليها**: https://dashboard.stripe.com/webhooks

```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
```
- **الوصف**: المفتاح العام من Stripe
- **الحصول عليها**: https://dashboard.stripe.com/apikeys

### Manus APIs
```
BUILT_IN_FORGE_API_URL=https://forge.manus.im
```
- **الوصف**: عنوان خدمات Manus المدمجة
- **القيمة**: `https://forge.manus.im`

```
BUILT_IN_FORGE_API_KEY=your-forge-api-key
```
- **الوصف**: مفتاح API لخدمات Manus
- **الحصول عليها**: من Manus dashboard

```
VITE_FRONTEND_FORGE_API_URL=https://forge.manus.im
```
- **الوصف**: عنوان خدمات Manus للـ Frontend
- **القيمة**: `https://forge.manus.im`

---

## 🟡 مهمة جداً (HIGHLY RECOMMENDED)

هذه المتغيرات مهمة جداً للعمل الصحيح:

### Google OAuth
```
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```
- **الوصف**: بيانات اعتماد Google OAuth
- **الحصول عليها**: https://console.cloud.google.com
- **الفائدة**: تسجيل الدخول عبر Google

---

## 🟢 اختيارية (OPTIONAL)

هذه المتغيرات اختيارية - الميزات ستكون معطلة إذا لم تُضف:

### OpenAI
```
OPENAI_API_KEY=sk-your-openai-api-key
```
- **الوصف**: مفتاح API لـ OpenAI
- **الحصول عليها**: https://platform.openai.com/api-keys
- **الفائدة**: توليد النصوص والمحتوى

### Hugging Face
```
HUGGINGFACE_API_KEY=hf_your-huggingface-api-key
```
- **الوصف**: مفتاح API لـ Hugging Face
- **الحصول عليها**: https://huggingface.co/settings/tokens
- **الفائدة**: نماذج ML متقدمة

### Telegram
```
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
```
- **الوصف**: توكن بوت Telegram
- **الحصول عليها**: تحدث مع @BotFather على Telegram
- **الفائدة**: تفعيل بوت Telegram

### LinkedIn OAuth
```
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret
LINKEDIN_REDIRECT_URI=http://localhost:3000/api/oauth/linkedin/callback
```
- **الفائدة**: تسجيل الدخول عبر LinkedIn

### Twitter OAuth
```
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret
TWITTER_REDIRECT_URI=http://localhost:3000/api/oauth/twitter/callback
```
- **الفائدة**: تسجيل الدخول عبر Twitter

### Facebook OAuth
```
FACEBOOK_CLIENT_ID=your-facebook-client-id
FACEBOOK_CLIENT_SECRET=your-facebook-client-secret
FACEBOOK_REDIRECT_URI=http://localhost:3000/api/oauth/facebook/callback
```
- **الفائدة**: تسجيل الدخول عبر Facebook

### Instagram OAuth
```
INSTAGRAM_CLIENT_ID=your-instagram-client-id
INSTAGRAM_CLIENT_SECRET=your-instagram-client-secret
INSTAGRAM_REDIRECT_URI=http://localhost:3000/api/oauth/instagram/callback
```
- **الفائدة**: تسجيل الدخول عبر Instagram

### Sentry (مراقبة الأخطاء)
```
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```
- **الوصف**: DSN لـ Sentry
- **الحصول عليها**: https://sentry.io
- **الفائدة**: تتبع الأخطاء والأداء

---

## 🖥️ متغيرات النظام

```
NODE_ENV=development
```
- **القيم**: `development` أو `production`
- **الافتراضي**: `development`

```
PORT=3000
```
- **الوصف**: منفذ الخادم
- **الافتراضي**: `3000`

---

## 📝 ملخص سريع

### للتطوير المحلي
أضف على الأقل:
- `DATABASE_URL`
- `JWT_SECRET`
- `VITE_APP_ID`
- `OAUTH_SERVER_URL`
- `OWNER_OPEN_ID`
- `OWNER_NAME`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `VITE_STRIPE_PUBLISHABLE_KEY`
- `BUILT_IN_FORGE_API_KEY`
- `BUILT_IN_FORGE_API_URL`

### للإنتاج على Vercel
أضف جميع المتغيرات الإلزامية + المهمة جداً:
- جميع المتغيرات أعلاه
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

---

## 🔒 نصائح الأمان

1. **لا تشارك المفاتيح السرية** - احفظها في مكان آمن
2. **استخدم قيم مختلفة** للتطوير والإنتاج
3. **راجع الأذونات** - تأكد من أن المفاتيح لها الأذونات المطلوبة فقط
4. **غيّر المفاتيح بانتظام** - خاصة إذا تم تسريبها
5. **استخدم .env.local** - لا تلتزم ملفات .env بـ Git

---

## ✅ قائمة التحقق قبل النشر

- [ ] جميع المتغيرات الإلزامية موجودة
- [ ] لا توجد قيم وهمية في الإنتاج
- [ ] المفاتيح السرية قوية (32+ حرف)
- [ ] Webhook URLs محدثة
- [ ] OAuth Redirect URIs صحيحة
- [ ] قاعدة البيانات متاحة من Vercel
- [ ] Stripe keys من الحساب الصحيح
