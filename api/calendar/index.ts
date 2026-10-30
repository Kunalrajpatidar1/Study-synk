import {
  createFeedToken,
  enforceRateLimit,
  feedKey,
  hashManagementToken,
  isValidCalendarFeed,
  redisCommand,
  responseError,
} from "../../server/calendarStore";

export const config = { runtime: "edge" };

export default async function handler(request: Request) {
  if (request.method !== "POST") {
    return responseError("Method not allowed.", 405);
  }

  try {
    if (!await enforceRateLimit(request)) {
      return responseError("Too many calendar feeds created. Please try again later.", 429);
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

    const token = createFeedToken();
    const managementToken = createFeedToken();
    const managementTokenHash = await hashManagementToken(managementToken);
    const stored = JSON.stringify({ calendar: body.calendar, managementTokenHash });
    await redisCommand(["SET", feedKey(token), stored]);
    return new Response(JSON.stringify({ token, managementToken }), {
      status: 201,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (error) {
    console.error("Could not create calendar feed.", error);
    return responseError("Could not create the calendar feed. Check the server's storage configuration and try again.", 503);
  }
}
