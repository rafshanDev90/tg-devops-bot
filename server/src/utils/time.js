const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TZ = 'Asia/Dhaka';

export function getCurrentDayBDT() {
  const bdt = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
  return DAYS[bdt.getDay()];
}

export function getNextClassInfo(classes) {
  const bdt = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
  const nowMin = bdt.getHours() * 60 + bdt.getMinutes();

  for (const c of classes) {
    const [h, m] = c.start_time.split(':').map(Number);
    const diff = h * 60 + m - nowMin;
    if (diff > 0) {
      const hours = Math.floor(diff / 60);
      const mins = diff % 60;
      if (diff < 60) return `${diff} minutes`;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours} hours`;
    }
  }
  return null;
}

export function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} minutes ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hours ago`;
  if (s < 604800) return `${Math.floor(s / 86400)} days ago`;
  return new Date(date).toLocaleDateString();
}

export function timeAgoShort(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}
