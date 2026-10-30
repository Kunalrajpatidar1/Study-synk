import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Play } from "lucide-react";
import { Playlist, Video } from "./types";
import { formatDuration, localToday } from "./utils/time";
import { loadPlaylist, resolveInput } from "./utils/youtube";
import { createSchedule } from "./utils/scheduler";
import { Navbar } from "./components/Navbar";
import { HeroSection } from "./components/HeroSection";
import { PlaylistOverview } from "./components/PlaylistOverview";
import { StatGrid } from "./components/StatGrid";
import { SpeedSelector } from "./components/SpeedSelector";
import { StudyPlanner } from "./components/StudyPlanner";
import { VideoChecklist } from "./components/VideoChecklist";
import { HowItWorks } from "./components/HowItWorks";
import { FaqSection } from "./components/FaqSection";
import { BottomCta } from "./components/BottomCta";
import { Footer } from "./components/Footer";
import { Toast } from "./components/Toast";

const speeds = [1, 1.25, 1.5, 1.75, 2];
const examples = [
  { label: "CS50P (Harvard)", id: "PLhQjrBD2T3817j24-GogXmWqO5Q5vYy0V" },
  { label: "MIT 6.100L", id: "PLUl4u3cNGP63WbdFxL8giv4yhgdMGaZNA" },
  { label: "C++ DSA (Love Babbar)", id: "PL_c9BZzLwBRKKqOc9TJz1pP0ASrxLMG7e" },
];

const faqs: [string, string][] = [
  [
    "Is there a playlist size limit?",
    "Study Sync paginates through YouTube's API and supports up to 5,000 videos per playlist.",
  ],
  [
    "Where is my study progress stored?",
    "Your watched progress stays in this browser's local storage. Study Sync doesn't create accounts or send your watch data to a server.",
  ],
  [
    "Why might my total watch time differ from YouTube?",
    "Private, region-restricted, or deleted videos may not have a duration available. Unavailable items are excluded from your active study schedule.",
  ],
  [
    "Can I export my study plan to Google Calendar?",
    "Yes. Add individual sessions, import the full plan as an .ics file, or subscribe to a live calendar feed.",
  ],
  [
    "Does this work on mobile devices?",
    "Yes. The calculator, study schedule, video checklist, and calendar exports are responsive on mobile, tablet, and desktop.",
  ],
];

export function App() {
  const [dark, setDark] = useState(true);
  const routeMatch = window.location.pathname.match(/^\/(playlist|video|channel)\/([^/]+)/);
  const initialQuery = routeMatch
    ? routeMatch[1] === "video"
      ? `https://youtube.com/watch?v=${decodeURIComponent(routeMatch[2])}`
      : routeMatch[1] === "channel"
        ? routeMatch[2].startsWith("UC")
          ? `https://youtube.com/channel/${routeMatch[2]}`
          : `https://youtube.com/@${decodeURIComponent(routeMatch[2])}`
        : decodeURIComponent(routeMatch[2])
    : "";

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [speed, setSpeed] = useState(1);
  const [customSpeed, setCustomSpeed] = useState(1);
  const [hoursPerDay, setHoursPerDay] = useState(1);
  const [minutesPerSession, setMinutesPerSession] = useState(60);
  const [startDate, setStartDate] = useState(localToday);
  const [skipWeekends, setSkipWeekends] = useState(false);
  const [completion, setCompletion] = useState(100);
  const [startTime, setStartTime] = useState("09:00");
  const [reminder, setReminder] = useState(15);
  const [filter, setFilter] = useState("");
  const [watched, setWatched] = useState<Record<string, string[]>>({});
  const [scheduledWatched, setScheduledWatched] = useState<Record<string, string[]>>({});
  const [reschedulePreview, setReschedulePreview] = useState(false);
  const [toast, setToast] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const active = results[0];
  const storageKey = active ? `studysync-watched-${active.id}` : "";
  const watchedIds = active ? watched[active.id] || [] : [];
  const currentSpeed = speed === -1 ? customSpeed : speed;
  const watchable = active?.videos.filter((video) => !video.unavailable) || [];
  const watchedDuration = watchable
    .filter((video) => watchedIds.includes(video.id))
    .reduce((sum, video) => sum + video.duration, 0);
  const totalDuration = watchable.reduce((sum, video) => sum + video.duration, 0);
  const remaining = totalDuration - watchedDuration;
  const currentProgress = active ? watched[active.id] || [] : [];
  const scheduledProgress = active ? scheduledWatched[active.id] || [] : [];
  const progressChanged =
    currentProgress.length !== scheduledProgress.length ||
    currentProgress.some((id) => !scheduledProgress.includes(id));

  const playlistDays = useMemo(() => {
    if (!active) return [];
    const count = Math.ceil((watchable.length * completion) / 100);
    const remainingVideos = watchable.slice(0, count).filter((video) => !scheduledProgress.includes(video.id));
    return createSchedule(
      remainingVideos,
      Math.min(hoursPerDay * 3600, minutesPerSession * 60),
      currentSpeed,
      startDate,
      skipWeekends
    );
  }, [active, watchable, scheduledProgress, completion, hoursPerDay, minutesPerSession, currentSpeed, startDate, skipWeekends]);

  const previewDays = useMemo(() => {
    if (!active) return [];
    const count = Math.ceil((watchable.length * completion) / 100);
    const remainingVideos = watchable.slice(0, count).filter((video) => !currentProgress.includes(video.id));
    return createSchedule(
      remainingVideos,
      Math.min(hoursPerDay * 3600, minutesPerSession * 60),
      currentSpeed,
      startDate,
      skipWeekends
    );
  }, [active, watchable, currentProgress, completion, hoursPerDay, minutesPerSession, currentSpeed, startDate, skipWeekends]);

  const visibleVideos =
    active?.videos.filter((video) => video.title.toLowerCase().includes(filter.toLowerCase())) || [];

  useEffect(() => {
    if (!storageKey || !active) return;
    try {
      const current = localStorage.getItem(storageKey);
      const legacyKey = `playlistlength-watched-${active.id}`;
      const legacy = current === null ? localStorage.getItem(legacyKey) : null;
      const saved = current ?? legacy;
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === "string")) {
        throw new Error("Saved watch progress has an invalid format.");
      }
      const ids = parsed as string[];
      if (current === null && legacy !== null) {
        localStorage.setItem(storageKey, legacy);
        localStorage.removeItem(legacyKey);
      }
      setWatched((previous) => ({ ...previous, [active.id]: ids }));
      setScheduledWatched((previous) => ({ ...previous, [active.id]: ids }));
      setReschedulePreview(false);
    } catch {
      setError("Couldn't read saved progress from this browser.");
    }
  }, [storageKey, active]);

  useEffect(() => {
    if (initialQuery) void calculate(undefined, initialQuery);
  }, []);

  useEffect(() => {
    if (!active) {
      document.title = "Study Sync | YouTube Playlist Study Planner";
      return;
    }
    document.title = `${active.title} — ${formatDuration(totalDuration, true)} | Study Sync`;
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", document.title);
    document.querySelector('meta[name="description"]')?.setAttribute(
      "content",
      `${formatDuration(totalDuration, true)} of watch time, a personalized study schedule, and calendar export for ${active.title}.`
    );
  }, [active, totalDuration]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }

  async function calculate(event?: FormEvent, value = query) {
    event?.preventDefault();
    const links = value.split(/\n/).map((line) => line.trim()).filter(Boolean).slice(0, 5);
    if (!links.length) {
      setError("Paste a YouTube playlist, video, or channel link to get started.");
      return;
    }

    setLoading(true);
    setError("");
    setResults([]);
    try {
      const loaded = await Promise.all(links.map(loadPlaylist));
      setResults(loaded);
      setSpeed(1);
      setFilter("");
      if (loaded.length > 1) setQuery(links.join("\n"));
      if (loaded.length === 1) {
        const route = resolveInput(links[0]);
        window.history.replaceState({}, "", `/${route.mode}/${encodeURIComponent(route.value)}`);
      } else {
        window.history.replaceState({}, "", "/");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function setVideoWatched(video: Video, checked: boolean) {
    if (!active || video.unavailable) return;
    const updated = checked ? [...new Set([...watchedIds, video.id])] : watchedIds.filter((id) => id !== video.id);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      setError("Couldn't save your progress in this browser. Check your storage settings and try again.");
      return;
    }
    setWatched((previous) => ({ ...previous, [active.id]: updated }));
  }

  function confirmReschedule() {
    if (!active) return;
    setScheduledWatched((previous) => ({ ...previous, [active.id]: currentProgress }));
    setReschedulePreview(false);
    notify("Your study plan has been rescheduled around your progress.");
  }

  function selectExample(id: string) {
    setQuery(id);
    void calculate(undefined, id);
  }

  function handleStartCta() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.querySelector("textarea")?.focus();
  }

  return (
    <main className={dark ? "app dark" : "app"}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="ambient ambient-three" />
      <Navbar dark={dark} onToggleTheme={() => setDark(!dark)} />
      <HeroSection
        query={query}
        onQueryChange={setQuery}
        onSubmit={(event) => void calculate(event)}
        loading={loading}
        error={error}
        onRetry={() => void calculate()}
        examples={examples}
        onSelectExample={selectExample}
      />
      {!active && !loading && (
        <section className="demo-section" aria-label="Study plan preview">
          <article className="demo-playlist">
            <div className="demo-heading">
              <p>Study plan <em>— playlist preview</em></p>
              <span>PREVIEW</span>
            </div>
            <strong className="demo-total">1h 00m</strong>
            <div className="demo-speed-row">
              <span>Daily target <small>1 hour</small></span>
              <span>Playback <small>1× speed</small></span>
              <span>Sessions <small>Time-capped</small></span>
              <span>Calendar <small>Ready to export</small></span>
            </div>
            <ul className="demo-videos">
              <li><span className="demo-play"><Play size={11} fill="currentColor" /></span><span>Video 1 · first watch segment</span><time>0:00–18:24</time></li>
              <li><span className="demo-play"><Play size={11} fill="currentColor" /></span><span>Video 2 · completes the session</span><time>0:00–41:36</time></li>
            </ul>
          </article>
          <article className="demo-calendar">
            <div className="demo-calendar-heading">
              <p>Your calendar <em>— study sessions</em></p>
              <span>GOOGLE CALENDAR · ICS</span>
            </div>
            <div className="demo-calendar-meta"><span>● Daily study plan</span><span>One-hour sessions</span></div>
            <div className="demo-calendar-grid" aria-hidden="true">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span className="demo-weekday" key={`day-${index}`}>{day}</span>)}
              {Array.from({ length: 28 }, (_, index) => (
                <span className={`demo-date${[2, 5, 9, 12, 16, 19, 23].includes(index) ? " has-lesson" : ""}`} key={`date-${index}`}>
                  {index + 1}
                  {[2, 5, 9, 12, 16, 19, 23].includes(index) && <small>1h</small>}
                </span>
              ))}
            </div>
            <p className="demo-finish">Each session has a precise video timestamp <span>Export or subscribe</span></p>
          </article>
        </section>
      )}
      {loading && (
        <section className="results-wrap">
          <div className="skeleton-card">
            <div className="skeleton-cover shimmer" />
            <div className="skeleton-lines">
              <i className="shimmer" />
              <i className="shimmer" />
              <i className="shimmer" />
            </div>
            <div className="skeleton-total shimmer" />
          </div>
          <div className="loading-copy">
            <span className="loading-pulse" /> Fetching course details and video durations…
          </div>
        </section>
      )}
      <AnimatePresence>
        {results.length > 0 && !loading && active && (
          <motion.section
            className="results-wrap"
            id="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.4 }}
          >
            <PlaylistOverview active={active} results={results} totalDuration={totalDuration} onNotify={notify} />
            <StatGrid
              watchable={watchable}
              unavailableCount={active.videos.filter((video) => video.unavailable).length}
              totalDuration={totalDuration}
            />
            <SpeedSelector
              speed={speed}
              customSpeed={customSpeed}
              currentSpeed={currentSpeed}
              totalDuration={totalDuration}
              speeds={speeds}
              onSetSpeed={setSpeed}
              onSetCustomSpeed={setCustomSpeed}
            />
            <StudyPlanner
              active={active}
              hoursPerDay={hoursPerDay}
              setHoursPerDay={setHoursPerDay}
              minutesPerSession={minutesPerSession}
              setMinutesPerSession={setMinutesPerSession}
              startDate={startDate}
              setStartDate={setStartDate}
              speed={speed}
              setSpeed={setSpeed}
              customSpeed={customSpeed}
              speeds={speeds}
              completion={completion}
              setCompletion={setCompletion}
              skipWeekends={skipWeekends}
              setSkipWeekends={setSkipWeekends}
              playlistDays={playlistDays}
              previewDays={previewDays}
              startTime={startTime}
              setStartTime={setStartTime}
              reminder={reminder}
              setReminder={setReminder}
              progressChanged={progressChanged}
              reschedulePreview={reschedulePreview}
              setReschedulePreview={setReschedulePreview}
              onConfirmReschedule={confirmReschedule}
              onNotify={notify}
            />
            <VideoChecklist
              active={active}
              watchable={watchable}
              watchedIds={watchedIds}
              remaining={remaining}
              filter={filter}
              setFilter={setFilter}
              visibleVideos={visibleVideos}
              progressChanged={progressChanged}
              onSetReschedulePreview={setReschedulePreview}
              onMarkAllWatched={() => {
                const ids = watchable.map((video) => video.id);
                try {
                  localStorage.setItem(storageKey, JSON.stringify(ids));
                  setWatched((previous) => ({ ...previous, [active.id]: ids }));
                } catch {
                  setError("Couldn't save your progress in this browser.");
                }
              }}
              onToggleVideo={setVideoWatched}
            />
          </motion.section>
        )}
      </AnimatePresence>
      <HowItWorks />
      <FaqSection
        faqs={faqs}
        openIndex={openFaq}
        onToggle={(index) => setOpenFaq(openFaq === index ? null : index)}
      />
      <BottomCta onStart={handleStartCta} />
      <Footer />
      <Toast toast={toast} />
    </main>
  );
}

export default App;
