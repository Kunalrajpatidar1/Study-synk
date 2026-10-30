import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Copy, ExternalLink, RefreshCw, Trash2 } from "lucide-react";
import { Playlist, StudyDay } from "../types";
import { createCalendarContent } from "../utils/calendar";

interface CalendarSubscriptionProps {
  playlist: Playlist;
  days: StudyDay[];
  startTime: string;
  reminder: number;
}

interface Subscription {
  token: string;
  managementToken: string;
}

interface ApiResponse {
  token?: string;
  managementToken?: string;
  error?: string;
}

function isApiResponse(value: unknown): value is ApiResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    (!("token" in value) || typeof value.token === "string") &&
    (!("managementToken" in value) || typeof value.managementToken === "string") &&
    (!("error" in value) || typeof value.error === "string")
  );
}

function readSubscription(key: string, playlistId: string): { subscription: Subscription | null; error: string } {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const value: unknown = JSON.parse(saved);
      if (
        typeof value === "object" &&
        value !== null &&
        "token" in value &&
        typeof value.token === "string" &&
        /^[A-Za-z0-9_-]{43}$/.test(value.token) &&
        "managementToken" in value &&
        typeof value.managementToken === "string" &&
        /^[A-Za-z0-9_-]{43}$/.test(value.managementToken)
      ) {
        return { subscription: { token: value.token, managementToken: value.managementToken }, error: "" };
      }
      return { subscription: null, error: "Saved calendar subscription data is invalid. Create a new feed to continue." };
    }

    const legacyKeys = [
      [`studysync-calendar-${playlistId}`, `studysync-calendar-management-${playlistId}`],
      [`playlistlength-calendar-${playlistId}`, `playlistlength-calendar-management-${playlistId}`],
    ];
    for (const [tokenKey, managementKey] of legacyKeys) {
      const token = localStorage.getItem(tokenKey);
      if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) continue;
      const managementToken = localStorage.getItem(managementKey) || "";
      const migrated = {
        token,
        managementToken: /^[A-Za-z0-9_-]{43}$/.test(managementToken) ? managementToken : "",
      };
      localStorage.setItem(key, JSON.stringify(migrated));
      localStorage.removeItem(tokenKey);
      localStorage.removeItem(managementKey);
      return {
        subscription: migrated,
        error: migrated.managementToken ? "" : "This feed has no saved management key. Create a replacement feed to manage it.",
      };
    }
    return { subscription: null, error: "" };
  } catch {
    return { subscription: null, error: "Couldn't read the saved calendar subscription from this browser." };
  }
}

async function readApiResponse(response: Response): Promise<ApiResponse> {
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (response.status === 404 && isLocal) {
    throw new Error('Vite does not run Vercel Functions. Start the app with "npx vercel dev", or deploy it to Vercel with Upstash Redis configured.');
  }
  if (response.status === 404) {
    throw new Error("Calendar API was not found. Confirm the Vercel API functions are deployed.");
  }

  const body = await response.text();
  let value: unknown;
  try {
    value = body ? JSON.parse(body) : null;
  } catch {
    throw new Error(`Calendar API returned invalid JSON (HTTP ${response.status}).`);
  }
  if (!isApiResponse(value)) {
    throw new Error(`Calendar API returned an empty or invalid response (HTTP ${response.status}).`);
  }
  return value;
}

function feedUrl(token: string) {
  return new URL(`/api/calendar/${encodeURIComponent(token)}`, window.location.origin).toString();
}

export function CalendarSubscription({ playlist, days, startTime, reminder }: CalendarSubscriptionProps) {
  const storageKey = `studysync-calendar-subscription-${playlist.id}`;
  const initial = useMemo(() => readSubscription(storageKey, playlist.id), [storageKey, playlist.id]);
  const [subscription, setSubscription] = useState(initial.subscription);
  const [status, setStatus] = useState<"idle" | "syncing" | "ready" | "error">(
    initial.error ? "error" : "idle"
  );
  const [message, setMessage] = useState(initial.error);
  const [retryCount, setRetryCount] = useState(0);
  const lastSyncedContent = useRef("");
  const content = useMemo(
    () => createCalendarContent(playlist, days, startTime, reminder, true),
    [playlist, days, startTime, reminder]
  );

  useEffect(() => {
    if (!subscription?.managementToken || !days.length || content === lastSyncedContent.current) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const sync = async () => {
        setStatus("syncing");
        setMessage("Updating your subscribed calendar…");
        try {
          const response = await fetch(`/api/calendar/${encodeURIComponent(subscription.token)}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${subscription.managementToken}`,
            },
            body: JSON.stringify({ calendar: content }),
          });
          if (cancelled) return;
          if (response.status === 404) {
            localStorage.removeItem(storageKey);
            setSubscription(null);
            throw new Error("The saved feed no longer exists. Create a new calendar feed to subscribe again.");
          }
          if (!response.ok) {
            const result = await readApiResponse(response);
            throw new Error(result.error || "Could not update the calendar feed.");
          }
          lastSyncedContent.current = content;
          setStatus("ready");
          setMessage("Calendar feed is up to date. Google Calendar may take some time to refresh it.");
        } catch (reason) {
          if (cancelled) return;
          console.error("Could not sync Study Sync calendar subscription:", reason);
          setStatus("error");
          setMessage(reason instanceof Error ? reason.message : "Could not update the calendar feed.");
        }
      };
      void sync();
    }, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [content, days.length, retryCount, storageKey, subscription]);

  async function createSubscription() {
    if (!days.length || subscription?.managementToken) return;
    setStatus("syncing");
    setMessage("Creating your live calendar feed…");
    try {
      const response = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendar: content }),
      });
      const result = await readApiResponse(response);
      if (
        !response.ok ||
        !result.token ||
        !/^[A-Za-z0-9_-]{43}$/.test(result.token) ||
        !result.managementToken ||
        !/^[A-Za-z0-9_-]{43}$/.test(result.managementToken)
      ) {
        throw new Error(result.error || "Could not create the calendar feed.");
      }
      const created = { token: result.token, managementToken: result.managementToken };
      try {
        localStorage.setItem(storageKey, JSON.stringify(created));
      } catch {
        await fetch(`/api/calendar/${encodeURIComponent(created.token)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${created.managementToken}` },
        });
        throw new Error("The feed was created, but this browser couldn't save its management key. Check browser storage and try again.");
      }
      lastSyncedContent.current = content;
      setSubscription(created);
      setStatus("ready");
      setMessage("Calendar feed is ready. Subscribe in Google Calendar using the link below.");
    } catch (reason) {
      console.error("Could not create Study Sync calendar subscription:", reason);
      setStatus("error");
      setMessage(reason instanceof Error ? reason.message : "Could not create the calendar feed.");
    }
  }

  async function copyFeedUrl() {
    if (!subscription?.token) return;
    try {
      await navigator.clipboard.writeText(feedUrl(subscription.token));
      setMessage("Calendar subscription URL copied.");
    } catch {
      setStatus("error");
      setMessage("Clipboard access isn't available. Select and copy the subscription URL below.");
    }
  }

  async function revokeSubscription() {
    if (!subscription?.managementToken) return;
    setStatus("syncing");
    setMessage("Revoking your calendar feed…");
    try {
      const response = await fetch(`/api/calendar/${encodeURIComponent(subscription.token)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${subscription.managementToken}` },
      });
      if (!response.ok && response.status !== 404) {
        const result = await readApiResponse(response);
        throw new Error(result.error || "Could not revoke the calendar feed.");
      }
      localStorage.removeItem(storageKey);
      setSubscription(null);
      lastSyncedContent.current = "";
      setStatus("idle");
      setMessage("Calendar feed revoked.");
    } catch (reason) {
      setStatus("error");
      setMessage(reason instanceof Error ? reason.message : "Could not revoke the calendar feed.");
    }
  }

  const url = subscription?.token ? feedUrl(subscription.token) : "";
  const googleCalendarUrl = url
    ? `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(url.replace(/^https:/, "webcal:"))}`
    : "";

  return (
    <div className="calendar-subscription">
      {!subscription?.managementToken && (
        <button className="export-button" onClick={() => void createSubscription()} disabled={!days.length || status === "syncing"}>
          <CalendarDays size={15} /> {subscription?.token ? "Create replacement feed" : "Create calendar feed"}
        </button>
      )}
      {subscription?.token && (
        <>
          <button className="export-button" onClick={() => void copyFeedUrl()}>
            <Copy size={15} /> Copy subscription URL
          </button>
          <input
            className="subscription-url"
            aria-label="Google Calendar subscription URL"
            value={url}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
          <a className="subscription-google-link" href={googleCalendarUrl} target="_blank" rel="noreferrer">
            Subscribe in Google Calendar <ExternalLink size={12} />
          </a>
          {subscription.managementToken && (
            <button className="text-button revoke-feed" onClick={() => void revokeSubscription()} disabled={status === "syncing"}>
              <Trash2 size={13} /> Revoke feed
            </button>
          )}
        </>
      )}
      {status === "error" && subscription?.managementToken && (
        <button
          className="subscription-retry"
          onClick={() => {
            lastSyncedContent.current = "";
            setRetryCount((count) => count + 1);
          }}
        >
          <RefreshCw size={13} /> Retry sync
        </button>
      )}
      <p className={`subscription-status${status === "error" ? " is-error" : ""}`} aria-live="polite">
        {message ||
          (subscription
            ? "This feed updates when your study plan changes in this browser."
            : "Create a private feed, then subscribe to it from Google Calendar. Google refreshes external calendars periodically.")}
      </p>
    </div>
  );
}
