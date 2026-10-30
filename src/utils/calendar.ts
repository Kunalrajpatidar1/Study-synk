import { Playlist, StudyDay, Video } from "../types";

function formatClockDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function stamp(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(
    2,
    "0"
  )}T${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}${String(
    date.getSeconds()
  ).padStart(2, "0")}`;
}

export function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function getVideoUrl(playlist: Playlist, video: Video): string {
  const params = new URLSearchParams({ v: video.id });
  if (!playlist.id.startsWith("video-")) params.set("list", playlist.id);
  if (video.startSeconds) params.set("t", `${Math.ceil(video.startSeconds)}s`);
  return `https://www.youtube.com/watch?${params.toString()}`;
}

export function getVideoTimestampRange(video: Video): string {
  const start = video.startSeconds || 0;
  const end = video.endSeconds ?? start + video.duration;
  const sourceDuration = video.sourceDuration ?? video.duration;
  return `${formatClockDuration(start)}–${formatClockDuration(end)} of ${formatClockDuration(sourceDuration)}`;
}

function createSessionDescription(playlist: Playlist, day: StudyDay): string {
  const videos = day.videos.map((video) => {
    const index = playlist.videos.findIndex((playlistVideo) => playlistVideo.id === video.id) + 1;
    return `${index}. ${video.title} — ${getVideoTimestampRange(video)} · ${formatClockDuration(
      video.watchDuration ?? video.duration
    )} watch time at selected speed\n${getVideoUrl(playlist, video)}`;
  });
  return [
    `Study session for ${playlist.title}.`,
    `Session watch time: ${formatClockDuration(day.duration)}.`,
    "",
    ...videos.flatMap((video, index) => (index === videos.length - 1 ? [video] : [video, ""])),
    "",
    `Planned with ${new URL(`/playlist/${encodeURIComponent(playlist.id)}`, window.location.origin)}`,
  ].join("\n");
}

export function createCalendarContent(
  playlist: Playlist,
  days: StudyDay[],
  startTime: string,
  reminder: number,
  stableEventIds = false
): string {
  const [hours, minutes] = startTime.split(":").map(Number);
  const playlistId = playlist.id.replace(/[^A-Za-z0-9._-]/g, "-");
  const events = days
    .map((day, index) => {
      const start = new Date(day.date);
      start.setHours(hours, minutes, 0, 0);
      const end = new Date(start.getTime() + day.duration * 1000);
      const eventId = stableEventIds
        ? `studysync-${playlistId}-session-${index + 1}@studysync.app`
        : `${crypto.randomUUID()}@studysync.app`;
      const title = `Session ${index + 1} of ${days.length} · ${formatClockDuration(day.duration)}`;
      return `BEGIN:VEVENT\r\nUID:${eventId}\r\nDTSTAMP:${stamp(new Date())}\r\nDTSTART:${stamp(
        start
      )}\r\nDTEND:${stamp(end)}\r\nSUMMARY:${escapeIcs(title)}\r\nDESCRIPTION:${escapeIcs(
        createSessionDescription(playlist, day)
      )}\r\nBEGIN:VALARM\r\nTRIGGER:-PT${reminder}M\r\nACTION:DISPLAY\r\nDESCRIPTION:Study session reminder\r\nEND:VALARM\r\nEND:VEVENT`;
    })
    .join("\r\n");
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//StudySync//Study Plan//EN\r\nCALSCALE:GREGORIAN\r\n${events}\r\nEND:VCALENDAR`;
}

export function exportCalendar(playlist: Playlist, days: StudyDay[], startTime: string, reminder: number) {
  const file = new Blob([createCalendarContent(playlist, days, startTime, reminder)], {
    type: "text/calendar;charset=utf-8",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = `${playlist.title.replace(/[^\w-]+/g, "-").slice(0, 60) || "study-plan"}.ics`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function importAllSessions(playlist: Playlist, days: StudyDay[], startTime: string, reminder: number) {
  window.open("https://calendar.google.com/calendar/u/0/r/settings/import", "_blank", "noopener,noreferrer");
  exportCalendar(playlist, days, startTime, reminder);
}

export function googleCalendarEventUrl(
  playlist: Playlist,
  day: StudyDay,
  startTime: string,
  sessionIndex = 0,
  sessionCount = 1
): string {
  const [hours, minutes] = startTime.split(":").map(Number);
  const start = new Date(day.date);
  start.setHours(hours, minutes, 0, 0);
  const end = new Date(start.getTime() + day.duration * 1000);
  const title = `Session ${sessionIndex + 1} of ${sessionCount} · ${formatClockDuration(day.duration)}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${stamp(start)}/${stamp(end)}`,
    details: createSessionDescription(playlist, day),
    ctz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
