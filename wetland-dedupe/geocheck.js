import fs from 'fs';

const MAX_ACCURACY_M = 50;        // reject GPS fixes worse than this
const MAX_AGE_MS = 15 * 60 * 1000; // flag photos older than 15 minutes
const FUTURE_SKEW_MS = 2 * 60 * 1000;

export function loadWetlands(file = 'wetlands.json') {
  const gj = JSON.parse(fs.readFileSync(file, 'utf8'));
  return gj.features.map((f) => ({ name: f.properties.name, ring: f.geometry.coordinates[0] }));
}

// ray casting; ring is [[lng, lat], ...]
function inside(lng, lat, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// metres from point to nearest polygon edge (flat-earth approx, fine for small areas)
function distanceToRingM(lng, lat, ring) {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180), ky = 110574;
  const px = 0, py = 0;
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const ax = (ring[i][0] - lng) * kx,     ay = (ring[i][1] - lat) * ky;
    const bx = (ring[i + 1][0] - lng) * kx, by = (ring[i + 1][1] - lat) * ky;
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(ax + t * dx - px, ay + t * dy - py));
  }
  return best;
}

// report: { lat, lng, accuracyM, capturedAt (ms since epoch) }
export function checkLocation(report, wetlands, now = Date.now()) {
  const { lat, lng, accuracyM, capturedAt } = report;
  const flags = [];

  if (accuracyM > MAX_ACCURACY_M)
    return { status: 'reject', reason: 'low_gps_accuracy', detail: `${accuracyM} m (max ${MAX_ACCURACY_M} m), ask user to retake` };

  const age = now - capturedAt;
  if (age < -FUTURE_SKEW_MS) return { status: 'reject', reason: 'capture_time_in_future' };
  if (age > MAX_AGE_MS) flags.push('stale_photo');

  let nearest = { name: null, dist: Infinity };
  for (const w of wetlands) {
    if (inside(lng, lat, w.ring)) {
      return flags.length
        ? { status: 'flag', reason: flags.join(','), wetland: w.name }
        : { status: 'accept', wetland: w.name };
    }
    const d = distanceToRingM(lng, lat, w.ring);
    if (d < nearest.dist) nearest = { name: w.name, dist: d };
  }

  if (nearest.dist <= accuracyM + 10)
    return { status: 'flag', reason: ['near_boundary', ...flags].join(','), wetland: nearest.name, detail: `${nearest.dist.toFixed(0)} m outside` };

  return { status: 'reject', reason: 'outside_wetland', detail: `${nearest.dist.toFixed(0)} m from nearest wetland` };
}
