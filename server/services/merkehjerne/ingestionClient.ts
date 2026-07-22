import { createHash, createHmac, randomUUID } from "node:crypto";
import { crawlResponseSchema, type CrawlResponse } from "./brandSchemas";

const ENDPOINT_PATH = "/v1/crawl";
const MAX_RESPONSE_BYTES = 1_500_000;
const TIMEOUT_MS = 45_000;

export class BrandIngestionError extends Error {
  constructor(
    public readonly code: string,
    public readonly publicMessage: string,
    public readonly status?: number,
  ) {
    super(publicMessage);
    this.name = "BrandIngestionError";
  }
}

function endpoint(): URL {
  const raw = process.env.BRAND_INGESTION_URL?.trim();
  if (!raw) throw new BrandIngestionError("not_configured", "Nettstedsanalyse er ikke konfigurert ennå.");
  let base: URL;
  try {
    base = new URL(raw);
  } catch {
    throw new BrandIngestionError("invalid_config", "Nettstedsanalyse er feilkonfigurert.");
  }
  const allowHttp = process.env.BRAND_INGESTION_ALLOW_HTTP === "true";
  if (base.protocol !== "https:" && !(allowHttp && base.protocol === "http:")) {
    throw new BrandIngestionError("invalid_config", "Nettstedsanalyse krever en sikker intern tilkobling.");
  }
  return new URL(ENDPOINT_PATH, base);
}

function signature(secret: string, timestamp: string, nonce: string, body: string): string {
  const bodyHash = createHash("sha256").update(body).digest("hex");
  const canonical = `POST\n${ENDPOINT_PATH}\n${timestamp}\n${nonce}\n${bodyHash}`;
  return `sha256=${createHmac("sha256", secret).update(canonical).digest("hex")}`;
}

async function readResponseBounded(response: Response): Promise<string> {
  const declared = response.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > MAX_RESPONSE_BYTES) {
    throw new BrandIngestionError("oversized_response", "Nettstedet er for stort til å analyseres.");
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel("response limit exceeded");
        throw new BrandIngestionError("oversized_response", "Nettstedet er for stort til å analyseres.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

export async function crawlBrandSiteSecure(websiteUrl: string, requestId: string): Promise<CrawlResponse> {
  const secret = process.env.BRAND_INGESTION_SECRET ?? "";
  if (secret.length < 32) {
    throw new BrandIngestionError("invalid_config", "Nettstedsanalyse er feilkonfigurert.");
  }
  const url = endpoint();
  const timestamp = Math.floor(Date.now() / 1_000).toString();
  const nonce = randomUUID().replaceAll("-", "");
  const body = JSON.stringify({ rootUrl: websiteUrl, requestId, maxPages: 8 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  let text: string;
  try {
    response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-penna-timestamp": timestamp,
        "x-penna-nonce": nonce,
        "x-penna-signature": signature(secret, timestamp, nonce, body),
      },
      body,
    });
    // Keep the same deadline active while consuming a possibly chunked body.
    text = await readResponseBounded(response);
  } catch (error) {
    if (error instanceof BrandIngestionError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new BrandIngestionError("timeout", "Nettstedet brukte for lang tid. Prøv igjen.");
    }
    throw new BrandIngestionError("worker_unavailable", "Nettstedsanalysen er midlertidig utilgjengelig.");
  } finally {
    clearTimeout(timer);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new BrandIngestionError("invalid_worker_response", "Nettstedsanalysen returnerte et ugyldig svar.");
  }
  if (!response.ok) {
    const error = payload && typeof payload === "object" && "error" in payload
      ? (payload as { error?: { code?: unknown; message?: unknown } }).error
      : undefined;
    const code = typeof error?.code === "string" ? error.code : "crawl_failed";
    const message = typeof error?.message === "string" && error.message.length <= 300
      ? error.message
      : "Kunne ikke analysere nettstedet.";
    throw new BrandIngestionError(code, message, response.status);
  }
  const parsed = crawlResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new BrandIngestionError("invalid_worker_response", "Nettstedsanalysen returnerte et ugyldig svar.");
  }
  return parsed.data;
}
