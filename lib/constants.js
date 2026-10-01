// The phone sends KEYS (never translated text). Screens translate keys; NEMA always sees English.
export const CATEGORY_KEYS = ["dumping", "sewage", "encroachment", "burning", "drainage", "other"];
export const SEVERITY_KEYS = ["low", "medium", "high"];
export const OUTCOME_KEYS = ["", "inspector", "referred", "moreinfo"];

export const CATEGORY_EN = {
  dumping: "Dumping / waste", sewage: "Sewage", encroachment: "Encroachment / construction",
  burning: "Burning", drainage: "Drainage", other: "Other",
};
export const SEVERITY_EN = { low: "Low", medium: "Medium", high: "High" };
export const OUTCOME_EN = { "": "Choose…", inspector: "Inspector will visit", referred: "Referred to another agency", moreinfo: "Need more information" };
export const STATUS_EN = { new: "New", viewed: "Reviewed", verified: "Verified" };