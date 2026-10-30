declare const process: {
  env: {
    UPSTASH_REDIS_REST_URL?: string;
    UPSTASH_REDIS_REST_TOKEN?: string;
  };
};

const FEED_KEY_PREFIX = "studysync:calendar:";
const LEGACY_FEED_KEY_PREFIX = "playlistlength:calendar:";
const MAX_FEED_SIZE = 3_000_000;

type RedisResponse = { result?: unknown; error?: string };
export type StoredCalendarFeed = { calendar: string; managementTokenHash: string };

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Calendar feed storage is not configured.");
  return { url: url.replace(/\/+$/, ""), token };
}

export async function redisCommand(command: (string | number)[]) {
  const { url, token } = redisConfig();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  const result = await response.json() as RedisResponse;
  if (!response.ok || result.error) {
    throw new Error(result.error || "Calendar feed storage request failed.");
  }
  return result.result;
}

export function isValidFeedToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function isValidCalendarFeed(value: unknown): value is string {
  return typeof value === "string"
    && value.length <= MAX_FEED_SIZE
    && value.startsWith("BEGIN:VCALENDAR\r\n")
    && value.endsWith("\r\nEND:VCALENDAR");
}

export async function hashManagementToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function parseStoredFeed(value: unknown): StoredCalendarFeed | null {
  if (typeof value !== "string") return null;
  try {
    const stored = JSON.parse(value) as Partial<StoredCalendarFeed>;
    if (isValidCalendarFeed(stored.calendar) && typeof stored.managementTokenHash === "string") {
      return { calendar: stored.calendar, managementTokenHash: stored.managementTokenHash };
    }
    return null;
  } catch {
    return null;
  }
}

export function feedKey(token: string) {
  return `${FEED_KEY_PREFIX}${token}`;
}

export function legacyFeedKey(token: string) {
  return `${LEGACY_FEED_KEY_PREFIX}${token}`;
}

export async function getStoredFeed(token: string) {
  const current = parseStoredFeed(await redisCommand(["GET", feedKey(token)]));
  if (current) return current;
  return parseStoredFeed(await redisCommand(["GET", legacyFeedKey(token)]));
}

export function responseError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export function createFeedToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function enforceRateLimit(request: Request) {
  const address = request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(address));
  const addressHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const bucket = Math.floor(Date.now() / 3_600_000);
  const key = `studysync:calendar-rate:${addressHash}:${bucket}`;
  const count = Number(await redisCommand(["INCR", key]));
  if (count === 1) await redisCommand(["EXPIRE", key, 3600]);
  return count <= 20;
}
