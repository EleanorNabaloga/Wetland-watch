// When a reporter may claim a reward.
//
// A reward unlocks only when NEMA has verified the report: an officer triaged
// it as Emergency, Enforcement or Referral (the same categories that raise the
// reporter's trust score on the dashboard) and did not mark it false.
// Being reviewed is not enough on its own.
export const VERIFIED_CATEGORIES = ["Emergency", "Enforcement", "Referral"];

export function rewardAvailable(report) {
  return (
    Boolean(report) &&
    report.status === "viewed" &&
    VERIFIED_CATEGORIES.includes(report.category) &&
    !report.markedFalse
  );
}
