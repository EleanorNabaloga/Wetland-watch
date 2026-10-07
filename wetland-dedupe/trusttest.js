import { newProfile, applyEvent, levelOf, rewardMultiplier, dailyCap, reviewPolicy } from './trust.js';

const times = (n, e) => Array(n).fill(e);

function run(label, events) {
  let p = newProfile();
  for (const e of events) p = applyEvent(p, e);
  console.log(
    label.padEnd(38), '| score', String(p.score).padStart(5),
    '|', levelOf(p).padEnd(10),
    '| reward x' + rewardMultiplier(p).toFixed(2),
    '| cap', String(dailyCap(p)).padStart(2) + '/day',
    '|', reviewPolicy(p)
  );
}

run('1. brand new reporter', []);
run('2. 10 verified reports', times(10, 'report_verified'));
run('3. 40 verified reports', times(40, 'report_verified'));
run('4. 40 verified, then failed audit', [...times(40, 'report_verified'), 'audit_failed']);
run('5. 40 verified, then 3 dismissed', [...times(40, 'report_verified'), ...times(3, 'report_dismissed')]);
run('6. new user, 3 duplicate uploads', times(3, 'duplicate_upload'));
run('7. 10 verified + 5 blurry retakes', [...times(10, 'report_verified'), ...times(5, 'retake_requested')]);
run('8. 10 verified + 5 confirmations', [...times(10, 'report_verified'), ...times(5, 'confirmed_by_other')]);
