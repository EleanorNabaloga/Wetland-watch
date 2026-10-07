const SEVERITY_WEIGHT = { low: 1, medium: 2, high: 4, critical: 8 };
const HALF_LIFE_DAYS = 14;      // a report counts half as much every 14 days
const CELL_M = 200;             // grid cell size in metres
const REPEAT_REPORTER_FACTOR = 0.1;  // extra reports from the same reporter in one cell count 10%
const MIN_SCORE = 4;            // cells below this are not shown as hotspots
const DAY = 86400000;

function level(score, reporterCount) {
  if (reporterCount < 2) return 'yellow'; // a single reporter can never create a red or orange hotspot
  if (score >= 16) return 'red';
  if (score >= 8) return 'orange';
  return 'yellow';
}

// reports: array of report objects; only status === 'verified' counts
export function computeHotspots(reports, now = Date.now()) {
  const verified = reports.filter((r) => r.status === 'verified' && SEVERITY_WEIGHT[r.severity]);
  if (!verified.length) return [];

  const lat0 = verified.reduce((s, r) => s + r.lat, 0) / verified.length;
  const mPerDegLat = 110574;
  const mPerDegLng = 111320 * Math.cos((lat0 * Math.PI) / 180);

  const cells = new Map();
  for (const r of verified) {
    const iy = Math.floor((r.lat * mPerDegLat) / CELL_M);
    const ix = Math.floor((r.lng * mPerDegLng) / CELL_M);
    const key = ix + ':' + iy;
    if (!cells.has(key)) cells.set(key, { ix, iy, reports: [] });
    cells.get(key).reports.push(r);
  }

  const out = [];
  for (const cell of cells.values()) {
    // per reporter: strongest report counts fully, the rest count 10%
    const byReporter = new Map();
    for (const r of cell.reports) {
      const ageDays = Math.max(0, (now - r.capturedAt) / DAY);
      const value = SEVERITY_WEIGHT[r.severity] * Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
      if (!byReporter.has(r.reporterId)) byReporter.set(r.reporterId, []);
      byReporter.get(r.reporterId).push(value);
    }
    let score = 0;
    for (const values of byReporter.values()) {
      values.sort((a, b) => b - a);
      values.forEach((v, i) => { score += i === 0 ? v : v * REPEAT_REPORTER_FACTOR; });
    }
    if (score < MIN_SCORE) continue;

    // trend: last 14 days versus the 14 days before that (undecayed severity weights)
    let recent = 0, previous = 0;
    for (const r of cell.reports) {
      const ageDays = (now - r.capturedAt) / DAY;
      if (ageDays < HALF_LIFE_DAYS) recent += SEVERITY_WEIGHT[r.severity];
      else if (ageDays < HALF_LIFE_DAYS * 2) previous += SEVERITY_WEIGHT[r.severity];
    }
    const trend = recent > previous * 1.25 ? 'worsening' : recent < previous * 0.75 ? 'improving' : 'steady';

    out.push({
      level: level(score, byReporter.size),
      singleSource: byReporter.size < 2,
      score: Math.round(score * 10) / 10,
      reportCount: cell.reports.length,
      reporterCount: byReporter.size,
      criticalCount: cell.reports.filter((r) => r.severity === 'critical').length,
      trend,
      lastReportAt: Math.max(...cell.reports.map((r) => r.capturedAt)),
      lat: Math.round((((cell.iy + 0.5) * CELL_M) / mPerDegLat) * 1e5) / 1e5,
      lng: Math.round((((cell.ix + 0.5) * CELL_M) / mPerDegLng) * 1e5) / 1e5,
      reportIds: cell.reports.map((r) => r.id),
    });
  }
  return out.sort((a, b) => b.score - a.score).map((h, i) => ({ rank: i + 1, ...h }));
}
