/**
 * Minimal structured (JSON-line) logger — dependency-free.
 *
 * Emits one JSON object per line so logs are parseable/filterable in any log
 * aggregator (Vercel, Datadog, CloudWatch). Use instead of bare console.* for
 * anything operational. Existing console.* calls still work; migrate hot paths
 * over time. Never log secrets/tokens — pass only safe fields.
 */
type Fields = Record<string, unknown>;
type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, msg: string, fields: Fields = {}): void {
  let line: string;
  try {
    line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...fields });
  } catch {
    // Circular/unserialisable field — fall back to a safe line.
    line = JSON.stringify({ t: new Date().toISOString(), level, msg });
  }
  // Warnings/errors to stderr, the rest to stdout.
  (level === "error" || level === "warn" ? process.stderr : process.stdout).write(line + "\n");
}

export const logger = {
  debug: (msg: string, fields?: Fields) => emit("debug", msg, fields),
  info: (msg: string, fields?: Fields) => emit("info", msg, fields),
  warn: (msg: string, fields?: Fields) => emit("warn", msg, fields),
  error: (msg: string, fields?: Fields) => emit("error", msg, fields),
};
