import { Video, StudyDay } from "../types";

export function createSchedule(
  videos: Video[],
  budget: number,
  speed: number,
  startDate: string,
  skipWeekends: boolean
): StudyDay[] {
  const available = videos.filter((video) => !video.unavailable);
  if (!available.length || budget <= 0 || speed <= 0) return [];
  const days: StudyDay[] = [];
  let current: Video[] = [];
  let currentDuration = 0;
  let date = new Date(`${startDate}T12:00:00`);
  const epsilon = 0.000001;

  const pushDay = () => {
    if (!current.length) return;
    while (skipWeekends && (date.getDay() === 0 || date.getDay() === 6)) {
      date.setDate(date.getDate() + 1);
    }
    days.push({ date: new Date(date), videos: current, duration: currentDuration });
    current = [];
    currentDuration = 0;
    date.setDate(date.getDate() + 1);
  };

  for (const video of available) {
    let startSeconds = 0;
    while (startSeconds < video.duration) {
      const remainingWatchTime = budget - currentDuration;
      if (remainingWatchTime <= epsilon) {
        pushDay();
        continue;
      }

      const endSeconds = Math.min(video.duration, startSeconds + remainingWatchTime * speed);
      if (endSeconds <= startSeconds) break;

      const watchDuration = (endSeconds - startSeconds) / speed;
      current.push({
        ...video,
        duration: endSeconds - startSeconds,
        startSeconds,
        endSeconds,
        sourceDuration: video.duration,
        watchDuration,
      });
      currentDuration += watchDuration;
      startSeconds = endSeconds;
      if (currentDuration >= budget - epsilon) pushDay();
    }
  }
  pushDay();
  return days;
}
