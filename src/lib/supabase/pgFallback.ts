export function sanitizePgConnectionString(raw: string): string {
  try {
    const parsed = new URL(raw);
    parsed.searchParams.delete("sslmode");
    parsed.searchParams.delete("uselibpqcompat");
    return parsed.toString();
  } catch {
    return raw.replace(/([?&])(sslmode|uselibpqcompat)=[^&]*/gi, "$1").replace(/[?&]$/, "");
  }
}

export function getPostgresCandidates(): string[] {
  const raw = [
    process.env.POSTGRES_URL,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.DATABASE_URL,
  ]
    .map((v) => (v || "").trim())
    .filter(Boolean)
    .map(sanitizePgConnectionString);
  return Array.from(new Set(raw));
}

export async function withPgClient<T>(
  fn: (client: import("pg").Client) => Promise<T>
): Promise<{ ok: true; value: T } | { ok: false; errorCode: string }> {
  const candidates = getPostgresCandidates();
  if (candidates.length === 0) {
    return { ok: false, errorCode: "missing_postgres_url" };
  }
  const { Client } = await import("pg");
  let lastErrorCode = "pg_connect_failed";

  for (const connStr of candidates) {
    const client = new Client({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 6000,
    });
    try {
      await client.connect();
      const value = await fn(client);
      await client.end().catch(() => {});
      return { ok: true, value };
    } catch (err) {
      await client.end().catch(() => {});
      const e = err as { code?: string; message?: string };
      lastErrorCode = e?.code || (e?.message ? e.message.slice(0, 48) : "pg_error");
    }
  }
  return { ok: false, errorCode: lastErrorCode };
}
