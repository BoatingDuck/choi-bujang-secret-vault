const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 120;

// Receives only engine-verified virtual events.
export function detect(events) {
  if (!Array.isArray(events)) {
    throw new TypeError('invalid_detection_events');
  }

  const bySubject = new Map();

  for (const event of events) {
    if (event?.method !== 'GET') continue;

    const sub = event?.identity?.sub;
    if (typeof sub !== 'string' || !sub) continue;

    const timestamp = Date.parse(event.at);
    if (!Number.isFinite(timestamp)) continue;

    if (!bySubject.has(sub)) bySubject.set(sub, []);
    bySubject.get(sub).push(timestamp);
  }

  for (const [subject, timestamps] of bySubject) {
    timestamps.sort((a, b) => a - b);

    let left = 0;

    for (let right = 0; right < timestamps.length; right++) {
      while (timestamps[right] - timestamps[left] >= WINDOW_MS) {
        left++;
      }

      if (right - left + 1 > LIMIT) {
        return {
          action: 'propose_revocation',
          reasonCode: 'burst_read',
          subject
        };
      }
    }
  }

  return { action: 'observe' };
}
