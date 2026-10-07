const START_SCORE = 40;

const EVENTS = {
  report_verified:        { points: 3 },
  confirmed_by_other:     { points: 2 },
  audit_passed:           { points: 1 },
  report_dismissed:       { points: -8 },
  duplicate_upload:       { points: -10 },
  repeated_location_flag: { points: -3 },
  audit_failed:           { points: -30 },
  retake_requested:       { points: 0 },
};

export function newProfile() {
  return { score: START_SCORE, verifiedCount: 0 };
}

export function applyEvent(profile, name) {
  const ev = EVENTS[name];
  if (!ev) throw new Error('unknown event: ' + name);
  let delta = ev.points;
  if (delta > 0) delta = delta * (1 - profile.score / 120);
  const score = Math.min(100, Math.max(0, profile.score + delta));
  return {
    score: Math.round(score * 10) / 10,
    verifiedCount: profile.verifiedCount + (name === 'report_verified' ? 1 : 0),
  };
}

export function levelOf(profile) {
  if (profile.score < 20) return 'restricted';
  if (profile.verifiedCount < 5) return 'new';
  if (profile.score >= 70) return 'trusted';
  return 'standard';
}

export function rewardMultiplier(profile) {
  if (levelOf(profile) === 'restricted') return 0;
  const bonus = Math.min(1, Math.max(0, (profile.score - 40) / 60));
  return Math.round((1 + 0.5 * bonus) * 100) / 100;
}

export function rewardFor(profile, baseReward = 1) {
  return Math.round(baseReward * rewardMultiplier(profile) * 100) / 100;
}

export function dailyCap(profile) {
  return { restricted: 2, new: 3, standard: 5, trusted: 10 }[levelOf(profile)];
}

export function reviewPolicy(profile) {
  return {
    restricted: 'human review, rewards paused',
    new: 'human review of every report',
    standard: 'normal review queue',
    trusted: 'priority queue, random audits',
  }[levelOf(profile)];
}
