import { computeHotspots } from './hotspots.js';

const now = Date.now();
let n = 0;
const rep = (reporterId, lat, lng, severity, daysAgo) => ({
  id: 'r' + ++n, status: 'verified', reporterId, lat, lng, severity,
  capturedAt: now - daysAgo * 86400000,
});

const reports = [
  // A: several different people, serious and recent (should rank first)
  rep('u1', 0.3351, 32.5351, 'critical', 2),
  rep('u2', 0.3352, 32.5352, 'high', 3),
  rep('u3', 0.3350, 32.5353, 'critical', 5),
  rep('u4', 0.3353, 32.5350, 'medium', 9),

  // B: ONE person sending 6 reports of the same spot (stays yellow at most)
  rep('spam', 0.3381, 32.5321, 'high', 1),
  rep('spam', 0.3381, 32.5322, 'high', 1),
  rep('spam', 0.3382, 32.5321, 'high', 2),
  rep('spam', 0.3382, 32.5322, 'high', 2),
  rep('spam', 0.3381, 32.5323, 'high', 3),
  rep('spam', 0.3383, 32.5321, 'high', 3),

  // C: serious but older, nothing in the last 14 days (shows 'improving')
  rep('u5', 0.3320, 32.5380, 'critical', 20),
  rep('u6', 0.3321, 32.5381, 'critical', 22),
  rep('u11', 0.3320, 32.5381, 'critical', 24),
  rep('u12', 0.3321, 32.5380, 'high', 25),

  // D: many minor reports from different people (yellow)
  rep('u7', 0.3395, 32.5395, 'low', 1),
  rep('u8', 0.3396, 32.5394, 'low', 2),
  rep('u9', 0.3395, 32.5396, 'low', 4),
  rep('u13', 0.3396, 32.5395, 'low', 1),
  rep('u14', 0.3395, 32.5394, 'low', 2),
  rep('u15', 0.3396, 32.5396, 'low', 3),

  // E: unverified report (must be ignored)
  { id: 'x', status: 'pending', reporterId: 'u10', lat: 0.3351, lng: 32.5351, severity: 'critical', capturedAt: now },
];

const hs = computeHotspots(reports, now);
console.log('rank level   score reports reporters critical trend      center');
for (const h of hs) {
  console.log(
    String(h.rank).padEnd(4), h.level.padEnd(7), String(h.score).padStart(5),
    String(h.reportCount).padStart(7), String(h.reporterCount).padStart(9),
    String(h.criticalCount).padStart(8), h.trend.padEnd(10), h.lat + ', ' + h.lng
  );
}
