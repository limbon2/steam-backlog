const oneDecimal = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const wholeNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** 3732 minutes → "62.2 h" */
export function formatHours(minutes: number): string {
  return `${oneDecimal.format(minutes / 60)} h`;
}

/** 74048 minutes → "1,234 h" */
export function formatWholeHours(minutes: number): string {
  return `${wholeNumber.format(minutes / 60)} h`;
}

export function formatCount(value: number): string {
  return wholeNumber.format(value);
}

export function relativeTime(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return `on ${new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}
