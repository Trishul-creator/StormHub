export const POLICY_EFFECTIVE_DATE = "July 30, 2026";
export const PRIVACY_POLICY_VERSION = "2026-07-30";
export const TERMS_VERSION = "2026-07-30";
export const ACCEPTABLE_USE_VERSION = "2026-07-30";

export const PILOT_MINIMUM_AGE = 13;
export const PILOT_MINIMUM_GRADE = 9;
export const PILOT_MAXIMUM_GRADE = 12;

export const POLICY_ACCEPTANCE_METADATA = {
  privacy: "stormhub_privacy_version",
  terms: "stormhub_terms_version",
  acceptableUse: "stormhub_acceptable_use_version",
  ageAssurance: "stormhub_age_assurance",
} as const;

export const HIGH_SCHOOL_AGE_ASSURANCE = "13_or_older" as const;
