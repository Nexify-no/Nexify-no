# Fix: generated post images not saved / not visible later

## Symptom
In "Mine innlegg" the image button on a post shows nothing. Every post has
`imageUrl = null` — the AI image is visible while generating, but gone afterwards.

## Root cause (two layers)
1. **No working object storage on production.** `render.yaml` declared no
   `R2_*`/`S3_*`/`AWS_*` storage vars, and the legacy "forge" fallback points at
   `api.openai.com` (not a storage service). So `storagePut` fails and
   `generateImage` returns an inline **`data:` URL**.
2. **The code discarded that image.** `content.attachImage` only persisted
   `http(s)://` URLs and silently dropped `data:` URIs; and `putToObjectStore`
   only recognized `R2_*`/`S3_*` names **and required a custom endpoint**, so a
   standard AWS S3 config (AWS_* + S3_BUCKET + AWS_REGION, no endpoint) was
   ignored too.

## Code fixes (this branch)
- `server/storage.ts` — `putToObjectStore` now also accepts standard
  `AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY` + `AWS_REGION`, and treats a missing
  custom endpoint as **AWS S3** (SDK derives the endpoint from the region;
  returns `https://<bucket>.s3.<region>.amazonaws.com/<key>` or `*_PUBLIC_URL`).
- `server/routers/contentRouter.ts` — `attachImage` now, when it receives a
  `data:` image, uploads it to object storage and persists the resulting hosted
  URL (instead of dropping it).
- `render.yaml` — documents the storage env vars on the production service.

## REQUIRED operational step (you)
Set object-storage credentials on Render, or images still cannot persist.
**Recommended: Cloudflare R2** (zero egress):
```
R2_ACCOUNT_ID=...
R2_BUCKET=penna-images
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_PUBLIC_URL=https://<your-public-r2-domain>     # bucket/prefix must be public-readable
```
**Or AWS S3:**
```
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=eu-north-1
S3_BUCKET=penna-images
S3_PUBLIC_URL=https://<cdn-or-bucket-public-base>  # optional
```
The images bucket/prefix must be **publicly readable** (posts render the URL
directly in an `<img>`). If you must keep the bucket private, serve images
through a signed-URL/proxy route instead — tell me and I'll wire that.

## After configuring
New generations persist automatically. Existing image-less posts: open and
"Regenerer bilde" (or re-generate) to attach a now-hosted image.
