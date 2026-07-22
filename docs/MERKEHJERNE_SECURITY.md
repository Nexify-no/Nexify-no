# Security model

## Trust boundaries

The user controls the submitted URL. DNS, redirects, HTML, headers, extracted text and linked pages are hostile input. The AI model is not a security boundary. The ingestion worker is internal infrastructure and must never have access to application secrets, TiDB, Redis, cloud metadata or the Penna session network.

## Required production controls

1. Run the worker as a separate non-root container/service.
2. Expose it only to the Penna backend. Never publish port 8080 to the internet.
3. Apply an infrastructure egress rule blocking loopback, RFC1918, link-local, multicast, reserved ranges and cloud metadata. The application-level pinned resolver is defense in depth, not a replacement for an egress firewall.
4. Give the worker no database, OpenAI, Stripe, Vipps, S3/R2 or Redis credentials.
5. Use HTTPS unless the connection stays entirely inside a trusted private container network.
6. Keep `PENNA_INGESTION_SECRET` and `BRAND_INGESTION_SECRET` identical, random, and at least 32 characters. Rotate them together.
7. Keep the server caps in place. Do not make page/byte/deadline limits user-configurable.
8. Keep `robots.txt` enforcement on. Do not add a client flag to bypass it.
9. Add a plan-based analysis quota before a broad public launch. `aiProcedure` is a backstop, not a commercial quota.
10. Log request IDs and error codes only. Do not log response bodies or the full extracted corpus.

## SSRF defense

The worker:

- accepts only HTTP/HTTPS and ports 80/443;
- rejects userinfo, backslashes, control characters and ambiguous URLs;
- rejects blocked hostnames and rebinding service suffixes;
- resolves all A/AAAA answers and rejects the hostname if any answer is non-global;
- connects the socket directly to one of those validated IPs;
- keeps the original hostname for the HTTP Host header and TLS SNI/certificate verification;
- repeats validation on each redirect.
- blocks HTTPS-to-HTTP downgrades and prevents secondary pages from redirecting the crawler to another origin.

This closes the key gap in both Hound's URL validator and Penna's current `brandCrawler.ts`: validation and connection no longer perform separate DNS resolutions.

## Prompt-injection defense

Website text remains untrusted after redaction. The code therefore uses multiple controls:

- script/navigation/footer content is removed during extraction;
- common prompt-like text is redacted and recorded;
- sources are serialized as JSON data, not concatenated as instructions;
- the system prompt explicitly treats source values as data;
- LLM output is Zod-validated;
- every factual claim needs a known source ID and a complete verbatim evidence quote;
- code checks that the quote exists in that source and persists the quote itself as the fact, discarding an unverifiable model paraphrase;
- `promptBuilder` again labels the stored Merkehjerne JSON as untrusted data.

No prompt-only solution is sufficient. The evidence check is the enforcement layer.

## Known limits

- The worker does not execute JavaScript. A hard client-rendered site may return little content.
- In-memory nonce replay protection is per worker instance. For multiple replicas, route consistently or move nonce claims to Redis. The endpoint is read-only, but replay can still consume resources.
- Evidence enforcement applies to the structured `facts` list. Summary, tone and strategy fields remain AI synthesis and should be presented as editable suggestions, not audited facts.
- `robots.txt` retrieval fails open when it is unreachable, matching common crawler behavior. Explicit `Disallow` rules fail closed.
- HMAC authenticates and detects tampering; it does not encrypt traffic.
- Docker installs direct and transitive runtime dependencies from `requirements.lock` with `--require-hashes`. Regenerate and review that lock on a regular dependency-update schedule.

The delivered lock was checked with `pip-audit` on 2026-07-22 and returned no known vulnerabilities. This is a point-in-time result, not a substitute for recurring scans.
