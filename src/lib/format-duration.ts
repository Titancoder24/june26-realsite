/** Format milliseconds as `M min SS sec` for completion messages. */
export function formatDurationMinSec(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec} sec`;
  if (sec === 0) return `${min} min`;
  return `${min} min ${sec} sec`;
}

/** Format milliseconds as `MM:SS` for live elapsed / ETA display. */
export function formatTimerMmSs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
