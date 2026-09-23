const OFFICE_ACRONYM_MAP = {
  cas: "CAS",
  cob: "COB",
  coe: "COE",
  col: "COL",
  con: "CON",
  cot: "COT",
  cpag: "CPAG",
  emc: "EMC",
  esl: "ESL",
  it: "IT",
  ssl: "SSL",
};

const normalizeUppercaseText = (value = "") =>
  String(value || "")
    .trim()
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .toUpperCase();

export const formatOfficeReference = (value) => {
  const normalized = String(value || "").trim();

  if (!normalized || /^unassigned$/i.test(normalized)) {
    return "UNASSIGNED";
  }

  const lowered = normalized.toLowerCase();
  const structuredMatch = lowered.match(
    /^(college_of_[a-z_]+)_(cpag|cas|cob|coe|con|cot|col)_(.+)$/
  );

  if (structuredMatch) {
    const [, collegePart, acronymKey, departmentPart] = structuredMatch;
    return `${normalizeUppercaseText(collegePart)} (${OFFICE_ACRONYM_MAP[acronymKey]}) ${normalizeUppercaseText(
      departmentPart
    )}`;
  }

  const collegeOnlyMatch = lowered.match(/^(college_of_[a-z_]+)_(cpag|cas|cob|coe|con|cot|col)$/);
  if (collegeOnlyMatch) {
    const [, collegePart, acronymKey] = collegeOnlyMatch;
    return `${normalizeUppercaseText(collegePart)} (${OFFICE_ACRONYM_MAP[acronymKey]})`;
  }

  return normalized
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => OFFICE_ACRONYM_MAP[part.toLowerCase()] || part.toUpperCase())
    .join(" ");
};

export const formatNotificationMessage = (notification = {}) => {
  const message = String(notification?.message || "").trim();

  if (!message) {
    return "";
  }

  if (notification?.type !== "office_handler_office_updated") {
    return message;
  }

  const officeUpdateMatch = message.match(/^Your office assignment was updated from (.+) to (.+)\.$/i);
  if (!officeUpdateMatch) {
    return message;
  }

  const [, previousOffice, nextOffice] = officeUpdateMatch;
  return `Your office assignment was updated from ${formatOfficeReference(previousOffice)} to ${formatOfficeReference(nextOffice)}.`;
};
