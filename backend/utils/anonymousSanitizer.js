const ANONYMOUS_LABEL = 'Anonymous';

const normalizeSpace = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const hasAlphaNumeric = (value = '') => /[A-Za-z0-9]/.test(value);

const getPlainObject = (value) => {
  if (!value) {
    return {};
  }

  if (typeof value.toObject === 'function') {
    return value.toObject({ virtuals: true });
  }

  return { ...value };
};

const addUnique = (values, value) => {
  const normalized = normalizeSpace(value);
  if (!normalized || !hasAlphaNumeric(normalized)) {
    return;
  }

  const key = normalized.toLowerCase();
  if (!values.some((item) => item.toLowerCase() === key)) {
    values.push(normalized);
  }
};

const buildNamePatterns = (identity = {}) => {
  const values = [];
  const fullName = normalizeSpace(identity.name);
  const givenName = normalizeSpace(identity.givenName);
  const familyName = normalizeSpace(identity.familyName);

  addUnique(values, fullName);

  const fullNameParts = fullName.split(' ').filter(Boolean);
  if (fullNameParts.length >= 2) {
    addUnique(values, `${fullNameParts[0]} ${fullNameParts[fullNameParts.length - 1]}`);
  }

  if (givenName && familyName) {
    addUnique(values, `${givenName} ${familyName}`);
  }

  return values.filter((value) => value.split(' ').filter(Boolean).length >= 2);
};

const buildDirectIdentifierPatterns = (identity = {}) => {
  const values = [];
  addUnique(values, identity.email);
  addUnique(values, identity.contact);
  addUnique(values, identity.phone);
  addUnique(values, identity.studentId);
  addUnique(values, identity.studentID);
  addUnique(values, identity.idNumber);
  return values;
};

const replacePattern = (text, value, useWordBoundaries = false) => {
  if (!value) {
    return text;
  }

  const parts = normalizeSpace(value).split(' ').filter(Boolean).map(escapeRegex);
  if (!parts.length) {
    return text;
  }

  const pattern = parts.join('\\s+');
  const wrappedPattern = useWordBoundaries
    ? `(?<![A-Za-z])${pattern}(?![A-Za-z])`
    : pattern;

  return text.replace(new RegExp(wrappedPattern, 'gi'), ANONYMOUS_LABEL);
};

const sanitizeAnonymousText = (value, complainantIdentity = {}) => {
  if (typeof value !== 'string' || !value) {
    return value;
  }

  let sanitized = value;

  buildDirectIdentifierPatterns(complainantIdentity).forEach((identifier) => {
    sanitized = replacePattern(sanitized, identifier, false);
  });

  buildNamePatterns(complainantIdentity).forEach((name) => {
    sanitized = replacePattern(sanitized, name, true);
  });

  return sanitized;
};

const sanitizeAnonymousTranscript = (transcript, complainantIdentity = {}) => {
  if (!Array.isArray(transcript)) {
    return [];
  }

  return transcript.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      return entry;
    }

    return {
      ...entry,
      message: sanitizeAnonymousText(entry.message, complainantIdentity),
      text: sanitizeAnonymousText(entry.text, complainantIdentity),
      content: sanitizeAnonymousText(entry.content, complainantIdentity),
    };
  });
};

const getComplainantIdentity = (grievance = {}, fallbackIdentity = {}) => {
  const source = getPlainObject(grievance);
  const complainant = getPlainObject(source.complainantId);

  return {
    name: source.complainantName || complainant.name || fallbackIdentity.name,
    givenName: complainant.givenName || fallbackIdentity.givenName,
    familyName: complainant.familyName || fallbackIdentity.familyName,
    email: source.complainantEmail || complainant.email || fallbackIdentity.email,
    contact: complainant.contact || fallbackIdentity.contact,
    phone: complainant.phone || fallbackIdentity.phone,
    studentId: complainant.studentId || complainant.studentID || fallbackIdentity.studentId || fallbackIdentity.studentID,
    idNumber: complainant.idNumber || fallbackIdentity.idNumber,
  };
};

const anonymizeComplainant = (complainant) => {
  if (!complainant || typeof complainant !== 'object') {
    return null;
  }

  if (
    !complainant.name &&
    !complainant.email &&
    !complainant.contact &&
    !complainant.phone &&
    (typeof complainant.toHexString === 'function' || typeof complainant.toString === 'function')
  ) {
    return null;
  }

  return {
    ...complainant,
    name: ANONYMOUS_LABEL,
    email: null,
    contact: null,
    phone: null,
    studentId: null,
    studentID: null,
    idNumber: null,
    givenName: null,
    familyName: null,
  };
};

const sanitizeAnonymousGrievanceForResponse = (grievance, fallbackIdentity = {}) => {
  if (!grievance) {
    return grievance;
  }

  const source = getPlainObject(grievance);
  if (!source.isAnonymous) {
    return grievance;
  }

  const identity = getComplainantIdentity(source, fallbackIdentity);
  return {
    ...source,
    complainantName: ANONYMOUS_LABEL,
    complainantEmail: null,
    complainantId: anonymizeComplainant(source.complainantId),
    description: sanitizeAnonymousText(source.description, identity),
    originalDescription: sanitizeAnonymousText(source.originalDescription, identity),
    conversationTranscript: sanitizeAnonymousTranscript(source.conversationTranscript, identity),
  };
};

const sanitizeAnonymousGrievancesForResponse = (grievances, fallbackIdentity = {}) => {
  if (!Array.isArray(grievances)) {
    return grievances;
  }

  return grievances.map((grievance) => sanitizeAnonymousGrievanceForResponse(grievance, fallbackIdentity));
};

module.exports = {
  ANONYMOUS_LABEL,
  getComplainantIdentity,
  sanitizeAnonymousText,
  sanitizeAnonymousTranscript,
  sanitizeAnonymousGrievanceForResponse,
  sanitizeAnonymousGrievancesForResponse,
};
