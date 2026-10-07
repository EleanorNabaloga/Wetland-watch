import fs from 'fs';
import crypto from 'crypto';
import { checkDuplicate, saveReport } from './dedupe.js';
import { loadWetlands, checkLocation } from './geocheck.js';
import { newProfile, applyEvent, levelOf, rewardMultiplier, rewardFor, dailyCap, reviewPolicy } from './trust.js';

const BASE_REWARD = 1; // reward units for a verified report before the trust multiplier
const REPORTS = 'reports.json';
const REPORTERS = 'reporters.json';
const wetlands = loadWetlands();

const readJson = (f, fallback) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : fallback);
const writeJson = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

function getProfile(id) {
  const all = readJson(REPORTERS, {});
  return all[id] || { ...newProfile(), history: [] };
}

function trustEvent(id, event, reportId) {
  const all = readJson(REPORTERS, {});
  const cur = all[id] || { ...newProfile(), history: [] };
  const next = applyEvent(cur, event);
  all[id] = {
    ...next,
    history: [...cur.history, { event, reportId: reportId || null, at: Date.now(), scoreAfter: next.score }].slice(-100),
  };
  writeJson(REPORTERS, all);
  return all[id];
}

export function summary(p) {
  return {
    score: p.score,
    verifiedCount: p.verifiedCount,
    level: levelOf(p),
    rewardMultiplier: rewardMultiplier(p),
    dailyCap: dailyCap(p),
    review: reviewPolicy(p),
  };
}

export const getReporter = (id) => ({ code: 200, body: { ...summary(getProfile(id)), history: getProfile(id).history } });
export const listReports = () => readJson(REPORTS, []);

export async function submitReport(photo, f) {
  const profile = getProfile(f.reporterId);
  const reports = readJson(REPORTS, []);
  const todays = reports.filter((r) => r.reporterId === f.reporterId && r.createdAt > Date.now() - 86400000).length;
  if (todays >= dailyCap(profile))
    return { code: 429, body: { decision: 'reject', reasons: ['daily_limit_reached'], reporter: summary(profile) } };

  const results = {
    location: checkLocation(f, wetlands),
    duplicate: await checkDuplicate(photo),
  };
  const entries = Object.entries(results);

  const rejects = entries.filter(([, r]) => r.status === 'reject');
  if (rejects.length) {
    let latest = profile;
    if (results.duplicate.status === 'reject') latest = trustEvent(f.reporterId, 'duplicate_upload');
    if (results.location.reason === 'outside_wetland') latest = trustEvent(f.reporterId, 'repeated_location_flag');
    if (results.location.reason === 'low_gps_accuracy') latest = trustEvent(f.reporterId, 'retake_requested');
    return {
      code: 422,
      body: {
        decision: 'reject',
        reasons: rejects.map(([k, r]) => `${k}: ${r.reason}${r.detail ? ' (' + r.detail + ')' : ''}`),
        reporter: summary(latest),
      },
    };
  }

  const flags = entries.filter(([, r]) => r.status === 'flag').map(([k, r]) => `${k}: ${r.reason}`);
  const id = crypto.randomUUID();
  saveReport(id, results.duplicate.sha, results.duplicate.phash);

  const report = {
    id,
    reporterId: f.reporterId,
    lat: f.lat, lng: f.lng, accuracyM: f.accuracyM, capturedAt: f.capturedAt,
    wetland: results.location.wetland,
    status: flags.length ? 'needs_review' : 'pending',
    flags,
    reporterLevel: levelOf(profile),
    review: reviewPolicy(profile),
    rewardStatus: 'none',
    rewardAmount: 0,
    confirmations: [],
    createdAt: Date.now(),
  };
  reports.push(report);
  writeJson(REPORTS, reports);
  return { code: 201, body: { decision: flags.length ? 'flag' : 'accept', report, reporter: summary(profile) } };
}

function findReport(id) {
  const reports = readJson(REPORTS, []);
  return { reports, report: reports.find((r) => r.id === id) };
}
const OPEN = ['pending', 'needs_review'];

export function verifyReport(id, severity = 'medium') {
  if (!['low', 'medium', 'high', 'critical'].includes(severity))
    return { code: 400, body: { error: 'severity must be low, medium, high or critical' } };
  const { reports, report: r } = findReport(id);
  if (!r) return { code: 404, body: { error: 'not found' } };
  if (!OPEN.includes(r.status)) return { code: 409, body: { error: `cannot verify a report that is ${r.status}` } };
  const before = getProfile(r.reporterId);
  const reward = rewardFor(before, BASE_REWARD); // reward uses trust level at the time of verification
  r.status = 'verified';
  r.severity = severity;
  r.rewardAmount = reward;
  r.rewardStatus = reward > 0 ? 'payable' : 'paused';
  r.reviewedAt = Date.now();
  writeJson(REPORTS, reports);
  const after = trustEvent(r.reporterId, 'report_verified', r.id);
  return { code: 200, body: { report: r, reporter: summary(after) } };
}

// falseReport = true only when the officer judges the report false or fraudulent;
// an honest mistake is dismissed without a trust penalty
export function dismissReport(id, falseReport = false) {
  const { reports, report: r } = findReport(id);
  if (!r) return { code: 404, body: { error: 'not found' } };
  if (!OPEN.includes(r.status)) return { code: 409, body: { error: `cannot dismiss a report that is ${r.status}` } };
  r.status = 'dismissed';
  r.rewardStatus = 'none';
  r.reviewedAt = Date.now();
  writeJson(REPORTS, reports);
  const after = falseReport ? trustEvent(r.reporterId, 'report_dismissed', r.id) : getProfile(r.reporterId);
  return { code: 200, body: { report: r, reporter: summary(after) } };
}

export function auditReport(id, passed) {
  const { reports, report: r } = findReport(id);
  if (!r) return { code: 404, body: { error: 'not found' } };
  if (r.status !== 'verified') return { code: 409, body: { error: 'only verified reports can be audited' } };
  if (!passed) { r.rewardStatus = 'cancelled'; r.rewardAmount = 0; }
  r.audit = passed ? 'passed' : 'failed';
  writeJson(REPORTS, reports);
  const after = trustEvent(r.reporterId, passed ? 'audit_passed' : 'audit_failed', r.id);
  return { code: 200, body: { report: r, reporter: summary(after) } };
}

export function confirmReport(id, byReporterId) {
  const { reports, report: r } = findReport(id);
  if (!r) return { code: 404, body: { error: 'not found' } };
  if (r.status === 'dismissed') return { code: 409, body: { error: 'report was dismissed' } };
  if (byReporterId === r.reporterId) return { code: 400, body: { error: 'you cannot confirm your own report' } };
  if (r.confirmations.includes(byReporterId)) return { code: 409, body: { error: 'already confirmed by this reporter' } };
  r.confirmations.push(byReporterId);
  writeJson(REPORTS, reports);
  const after = trustEvent(r.reporterId, 'confirmed_by_other', r.id);
  return { code: 200, body: { report: r, reporter: summary(after) } };
}
