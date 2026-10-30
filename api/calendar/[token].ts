import {
  enforceRateLimit,
  feedKey,
  getStoredFeed,
  hashManagementToken,
  isValidCalendarFeed,
  isValidFeedToken,
  legacyFeedKey,
  redisCommand,
  responseError,
} from "../../server/calendarStore";

export const config = { runtime: "edge" };

function getToken(request: Request) {
  return new URL(request.url).pathname.split("/").filter(Boolean).pop() || "";
}

export default async function handler(request: Request) {
  const token = getToken(request);
  if (!isValidFeedToken(token)) return responseError("Calendar feed not found.", 404);

  try {
    const key = feedKey(token);
    if (request.method === "GET" || request.method === "HEAD") {
      const feed = await getStoredFeed(token);
      if (!feed) return responseError("Calendar feed not found.", 404);
      return new Response(request.method === "HEAD" ? null : feed.calendar, {
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Content-Disposition": 'inline; filename="study-plan.ics"',
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    if (request.method === "PUT") {
      if (!await enforceRateLimit(request)) {
        return responseError("Too many calendar feed updates. Please try again later.", 429);
      }
      if (Number(request.headers.get("content-length") || 0) > 3_000_000) {
        return responseError("The calendar feed is too large.", 413);
      }
      let body: { calendar?: unknown };
      try {
        body = await request.json() as { calendar?: unknown };
      } catch {
        return responseError("The request body must be valid JSON.", 400);
      }
      if (JSON.stringify(body).length > 3_000_000) {
        return responseError("The calendar feed is too large.", 413);
      }
      if (!isValidCalendarFeed(body.calendar)) {
        return responseError("The calendar feed is invalid or too large.", 400);
      }
      const feed = await getStoredFeed(token);
      if (!feed) return responseError("Calendar feed not found.", 404);
      if (!await hasManagementAccess(request, feed.managementTokenHash)) {
        return responseError("A valid calendar management token is required.", 401);
      }
      await redisCommand(["SET", key, JSON.stringify({ ...feed, calendar: body.calendar })]);
      await redisCommand(["DEL", legacyFeedKey(token)]);
      return new Response(null, { status: 204 });
    }

    if (request.method === "DELETE") {
      const feed = await getStoredFeed(token);
      if (!feed) return responseError("Calendar feed not found.", 404);
      if (!await hasManagementAccess(request, feed.managementTokenHash)) {
        return responseError("A valid calendar management token is required.", 401);
      }
      const deleted = await redisCommand(["DEL", key, legacyFeedKey(token)]);
      return Number(deleted) ? new Response(null, { status: 204 }) : responseError("Calendar feed not found.", 404);
    }

    return responseError("Method not allowed.", 405);
  } catch (error) {
    console.error("Could not serve calendar feed.", error);
    return responseError("Calendar feed storage is unavailable. Try again later.", 503);
  }
}

async function hasManagementAccess(request: Request, storedHash: string) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  if (!token) return false;
  return await hashManagementToken(token) === storedHash;
}
