import React, { useState, useEffect, useRef, useCallback } from 'react';
import authService, { axiosInstance } from '../../../services/authService';
import cloudinaryService from '../../../services/cloudinaryService';
import { BACKEND_URL } from '../../../config/api';
import { normalizeAiCategoryLabel } from '../../../utils/aiAnalysis';

const getPreferredContact = (user) => user?.contact || user?.phone || '';
const MAX_ACTIVE_GRIEVANCES = 5;
const ACTIVE_GRIEVANCE_LIMIT_BLOCK_MESSAGE =
  'You currently have 5 active grievances. Please wait for one of your existing grievances to be resolved or until an unresolved grievance exceeds the 72-hour processing period before submitting another concern.';
const ACTIVE_GRIEVANCE_LIMIT_EXCEPTION_MESSAGE =
  'You have reached the normal limit of 5 active grievances. However, because one or more of your unresolved grievances have exceeded the 72-hour processing period, you may submit another concern.';

const createDefaultSubmissionLimitStatus = () => ({
  activeGrievanceCount: 0,
  maxActiveGrievances: MAX_ACTIVE_GRIEVANCES,
  overdueUnresolvedCount: 0,
  eligibleOverdueExceptionCount: 0,
  hasReachedLimit: false,
  hasOverdueUnresolved: false,
  hasEligibleOverdueException: false,
  canSubmit: true,
});

const buildProcessedDescription = (rawDescription, details = {}) => {
  const lines = [];
  const rawText = String(rawDescription || '').trim();
  if (rawText) {
    lines.push(rawText);
  }

  const { location, incidentDate, involvedPerson, office, department } = details;
  if (location) lines.push(`Location: ${location}`);
  if (incidentDate) lines.push(`Incident Date: ${incidentDate}`);
  if (involvedPerson) lines.push(`Person Involved: ${involvedPerson}`);
  if (office) lines.push(`Office: ${office}`);
  if (department) lines.push(`Department: ${department}`);

  return lines.join('\n').trim();
};

const createInitialGrievanceData = () => ({
  category: '',
  office: '',
  department: '',
  subject: '',
  description: '',
  originalDescription: '',
  college: '',
  location: '',
  incidentDate: '',
  involvedPerson: '',
  documents: [],
  attachments: []
});

const filingGuideSections = [
  {
    title: 'What The Chatbot Collects',
    tone: 'blue',
    items: [
      'Submission type: anonymous or with identity',
      'Grievance title or main concern',
      'Detailed description of what happened',
      'Incident date and person involved',
      'Office and department for routing',
      'Optional supporting files or screenshots',
    ],
  },
  {
    title: 'Required To Submit',
    tone: 'emerald',
    items: [
      'Title of the grievance',
      'Detailed description',
      'Enough context for the office to review your case',
    ],
  },
  {
    title: 'Helpful Tips',
    tone: 'amber',
    items: [
      'You can type directly without clicking the quick button',
      'Include dates, names, and where the incident happened',
      'Attach files only if they help explain the issue',
    ],
  },
];

const DashboardModule = () => {
  const createInitialBotMessage = () => ({
    id: 1,
    text: "Hello! I'm your grievance assistant. How can I help you today?",
    sender: 'bot',
    timestamp: new Date(),
  });
  const nextMessageIdRef = useRef(2);
  const getNextMessageId = () => nextMessageIdRef.current++;
  const resetMessageIds = () => {
    nextMessageIdRef.current = 2;
  };
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeMode, setActiveMode] = useState(null); // null, 'anonymous', or 'regular'
  const _fileInputRef = useRef(null);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [, setReferenceNumber] = useState('');
  const [submissionProgress, setSubmissionProgress] = useState(0);
  const [submissionPhase, setSubmissionPhase] = useState('idle');
  const [submissionStatusText, setSubmissionStatusText] = useState('');
  const [submittedReferenceNumber, setSubmittedReferenceNumber] = useState('');
  const [messages, setMessages] = useState([createInitialBotMessage()]);
  const messagesRef = useRef(messages);
  const [submissionLimitStatus, setSubmissionLimitStatus] = useState(createDefaultSubmissionLimitStatus);
  const [checkingSubmissionLimit, setCheckingSubmissionLimit] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);  // true when waiting for user to confirm summary
  const [awaitingDescription, setAwaitingDescription] = useState(false); // true after Dialogflow asks for description
  const [awaitingDate, setAwaitingDate] = useState(false); // true when Dialogflow is asking for incident date
  const [awaitingPersonInvolved, setAwaitingPersonInvolved] = useState(false); // true when collecting person involved
  const [awaitingOffice, setAwaitingOffice] = useState(false); // true when collecting office selection
  const [awaitingDepartment, setAwaitingDepartment] = useState(false); // true when collecting department selection
  const [incidentDate] = useState(''); // retained for existing submission payload shape
  const [showEditModal, setShowEditModal] = useState(false); // show modal for editing title/description
  const [conversationContext, setConversationContext] = useState({
    lastEnglishIntent: '',
    descriptionAttempts: 0
  });
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [inFilingFlow, setInFilingFlow] = useState(false); // track if user is in the filing flow
  const [, setDetectedLanguage] = useState('en');
  const [grievanceData, setGrievanceData] = useState(createInitialGrievanceData);
  const latestGrievanceDataRef = useRef(createInitialGrievanceData());
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const updateMessages = (updater) => {
    setMessages((current) => {
      const nextMessages = typeof updater === 'function' ? updater(current) : updater;
      messagesRef.current = nextMessages;
      return nextMessages;
    });
  };

  useEffect(() => {
    latestGrievanceDataRef.current = grievanceData;
  }, [grievanceData]);

  // Keywords that should be treated as grievance titles
  const grievanceTitleKeywords = [

// 🎓 Academic Issues (EXPANDED)
  "failed", "failed me", "failing grade", "low grade", "low grades",
  "very low grade", "grade too low", "grades are low",
  "unfairly graded", "unfair grading", "grading issue",
  "grade manipulation", "wrong grade", "incorrect grade",
  "grade not updated", "grade not encoded", "missing grade",
  "no grade", "delayed grade", "late grading",


  // Harassment / Abuse (general)
  "harassed", "harass", "harassment", "bullied", "bully", "bullying",
  "abused", "abuse", "mistreated", "mistreated me", "ill-treated",

  // Sexual Misconduct (important)
  "sexual harassment", "sexually harassed", "molested", "molestation",
  "groped", "inappropriately touched", "touched me", "assaulted",
  "sexual assault", "rape", "raped", "coerced", "sexual coercion",
  "forced", "forced me", "taken advantage of", "exploited", "sexual exploitation",

  // Threat / Coercion / Power Abuse
  "threatened", "threat", "intimidated", "intimidation", "coerced",
  "pressured", "pressured me", "blackmailed", "blackmail", "extorted", "extortion",

  // Discrimination / Unfair Treatment
  "treated unfairly", "unfair treatment", "discriminated", "discrimination",
  "biased", "bias", "favoritism", "prejudice", "unjust", "injustice",

  // Academic Issues
  "failed", "failed me", "unfairly graded", "grade manipulation",
  "wrong grade", "incorrect grade", "grading issue",

  // Disciplinary Actions
  "suspended", "expelled", "penalized unfairly", "wrongfully suspended",

  // Neglect / Dismissal
  "neglected", "neglect", "ignored", "dismissed", "not taken seriously",

  // Verbal / Emotional Harm
  "verbal abuse", "emotionally abused", "emotional abuse",
  "insulted", "humiliated", "demeaned", "shamed", "mocked",
  "yelled at", "shouted at", "verbally attacked",

  // 🔥 Physical Harm 

  "physical abuse", "hurt", "injured", "attacked", "attack",
  "hit", "punched", "slapped", "kicked", "beaten", "beat me",
  "assaulted physically", "physically assaulted", "struck",
  "pushed", "pushed me", "shoved", "shoved me",
  "grabbed", "grabbed me", "dragged", "dragged me",
  "choked", "strangled", "elbowed", "headbutted",
  "threw something at me", "hit with an object",
  "violence", "violent behavior", "physically harmed",
  "injured me", "caused injury",

  // Misconduct / Ethics
  "misconduct", "unprofessional", "inappropriate behavior",
  "corruption", "bribery", "cheating", "fraud",

  // Privacy / Digital Issues
  "privacy violation", "data breach", "leaked", "leak", "doxxed", "doxxing",
  "cyberbullying", "online harassment", "hacked",

  // Authority Abuse
  "abuse of power", "power trip", "authority abuse", "misuse of authority",

    // 🏫 Facilities / Campus Environment (EXPANDED)

  // General Facility Issues
  "facility issue", "facility problem", "poor facilities",
  "broken facility", "damaged facility", "not maintained",
  "lack of facilities", "insufficient facilities",

  // Classrooms
  "classroom issue", "dirty classroom", "hot classroom",
  "no ventilation", "poor ventilation", "crowded classroom",
  "broken chairs", "broken tables", "damaged chairs",
  "not enough chairs", "no seats available",
  "broken projector", "projector not working",
  "no electric fan", "fan not working",
  "aircon not working", "no air conditioning",
  "lights not working", "no lights",

  // Buildings / Infrastructure
  "building issue", "building problem", "unsafe building",
  "poor maintenance", "damaged walls", "ceiling leak",
  "leaking roof", "flooding", "slippery floor",
  "broken windows", "unsafe stairs",
  "no emergency exit", "fire hazard",

  // Computer Laboratory
  "computer lab issue", "computer laboratory issue",
  "computer not working", "pc not working",
  "slow computers", "lagging computers",
  "no internet in lab", "internet not working",
  "broken keyboard", "broken mouse",
  "outdated computers", "insufficient computers",
  "cannot use computer", "system not working",

  // Laboratories (Science / Tech Labs)
  "laboratory issue", "lab equipment broken",
  "insufficient equipment", "lack of equipment",
  "unsafe laboratory", "hazardous lab",
  "no lab materials", "damaged equipment",
  "lab not accessible",

  // Library
  "library issue", "library problem",
  "no available books", "lack of books",
  "outdated books", "no space in library",
  "crowded library", "no seating in library",
  "library too noisy", "not conducive for studying",
  "library wifi not working", "library closed",

  // Comfort Rooms (CR)
  "comfort room issue", "cr issue", "restroom issue",
  "dirty cr", "dirty restroom", "unsanitary",
  "bad smell", "foul smell",
  "no water", "no running water",
  "no tissue", "no soap",
  "broken toilet", "clogged toilet",
  "not flushing", "flooded restroom",

  // Cafeteria / Food Services
  "cafeteria issue", "canteen issue",
  "expensive food", "overpriced food",
  "bad food quality", "spoiled food",
  "unhygienic food", "dirty cafeteria",
  "long lines", "slow service",
  "not enough food", "limited food options",

  // Internet / WiFi
  "wifi issue", "no wifi", "slow wifi",
  "internet issue", "no internet connection",
  "unstable connection", "connection is slow",

  // Utilities
  "no electricity", "power outage",
  "water interruption", "no water supply",

  // Safety / Security
  "security issue", "not safe", "unsafe environment",
  "no security guard", "lack of security",
  "theft", "stolen", "robbery",
  "no cctv", "cctv not working",

  // Accessibility
  "not accessible", "no wheelchair access",
  "no ramp", "poor accessibility",
  "elevator not working", "no elevator"
];

  const vagueDetailPhrases = [
  // Very generic
  "problem", "issue", "complaint", "something happened",
  "it happened", "someone did this", "bad experience",
  "not good", "unfair", "help me", "i need help",

  // Incomplete descriptions
  "it is about", "that is all", "nothing else",
  "you know", "just that", "etc", "and so on",

  // Weak context
  "they did something", "someone hurt me",
  "it was bad", "it was wrong", "i dont know how to explain",

  // Minimal responses
  "yes", "no", "maybe", "idk", "not sure",
  "just that", "that's it", "end",

  // Emotional but unclear
  "i feel bad", "i feel uncomfortable", "i feel weird",
  "it made me sad", "it made me upset",

  // Time vague
  "recently", "before", "earlier", "a while ago"
];

  const officeOptions = [
    "College of Technology (COT)",
    "College of Education (COE)",
    "College of Nursing (CON)",
    "College of Business (COB)",
    "College of Public Administration and Governance (CPAG)",
    "College of Arts and Sciences (CAS)",
    "College of Law (COL)"
  ];

  const departmentOptionsByOffice = {
    "College of Public Administration and Governance (CPAG)": [
      "Public Administration"
    ],
    "College of Arts and Sciences (CAS)": [
      "Community Development",
      "Development Communication",
      "Economics",
      "General Education",
      "Language and Letters",
      "Mathematics",
      "Natural Sciences",
      "Philosophy",
      "Sociology & Social Sciences"
    ],
    "College of Business (COB)": [
      "Accountancy",
      "Business Administration",
      "Hospitality Management"
    ],
    "College of Education (COE)": [
      "Elementary School Laboratory (ESL)",
      "Secondary School Laboratory (SSL)",
      "Early Childhood Education",
      "Elementary Education",
      "Physical Education",
      "Secondary Education"
    ],
    "College of Nursing (CON)": [
      "Nursing"
    ],
    "College of Technology (COT)": [
      "Automotive Technology",
      "Electronics Technology",
      "Food Technology",
      "Information Technology"
    ],
    "College of Law (COL)": []
  };

  const departmentFallbackMessage = "Please specify your concern, and we will route it accordingly.";

  // Function to extract grievance title from user input
  const extractGrievanceTitle = (userInput) => {
    const lowerInput = userInput.toLowerCase();

    const patternMatches = [
      /(?:about|regarding|concerning)\s+(.+)/i,
      /(?:i want to report|i want to complain about|i need to report)\s+(.+)/i,
      /(?:this is about|my complaint is about)\s+(.+)/i
    ];

    for (const pattern of patternMatches) {
      const match = userInput.match(pattern);
      if (match?.[1]) {
        const candidate = match[1].trim().replace(/[.?!]+$/, '');
        if (candidate.length > 4) {
          return candidate
            .split(' ')
            .slice(0, 8)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        }
      }
    }
    
    // Check for exact keyword matches
    for (const keyword of grievanceTitleKeywords) {
      if (lowerInput.includes(keyword)) {
        // Return the keyword as the title, properly capitalized
        return keyword.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
      }
    }
    
    // If no keyword match, return null to use full input as title
    return null;
  };

  const isEnglishIntent = (intentName) => typeof intentName === 'string' && intentName.includes('(Eng)');

  const addBotMessage = (text, extra = {}) => {
    const botReply = {
      id: getNextMessageId(),
      text,
      sender: 'bot',
      timestamp: new Date(),
      ...extra
    };
    updateMessages(prev => [...prev, botReply]);
    return botReply;
  };

  const normalizeText = (text = '') => text.toLowerCase().replace(/\s+/g, ' ').trim();

  const normalizeStructuredValue = (value) => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed || /^null$/i.test(trimmed) || /^not (provided|available|specified)$/i.test(trimmed)) {
      return '';
    }
    return trimmed;
  };

  const normalizeStructuredDepartment = (value) => {
    const normalized = normalizeStructuredValue(value);
    if (
      !normalized ||
      /^(n\/a|na|none|no department|not applicable|college only|college-level|college level)$/i.test(normalized)
    ) {
      return '';
    }

    return normalized;
  };

  const normalizeIncidentDateInput = (text = '') => {
    const normalized = String(text || '').trim();
    if (
      !normalized ||
      normalized.length > 80 ||
      /[{}\[\]]/.test(normalized)
    ) {
      return '';
    }

    const relativeMap = {
      today: new Date(),
      yesterday: new Date(Date.now() - (24 * 60 * 60 * 1000)),
    };

    const lowered = normalized.toLowerCase();
    if (relativeMap[lowered]) {
      return relativeMap[lowered].toLocaleDateString();
    }

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }

    return parsed.toLocaleDateString();
  };

  const applyStructuredGrievanceData = (baseData, structuredData = {}) => {
    if (!structuredData || typeof structuredData !== 'object') {
      return baseData;
    }

    const submissionType = normalizeStructuredValue(structuredData.submissionType);
    const college = normalizeStructuredValue(structuredData.college);
    const hasDepartmentField = Object.prototype.hasOwnProperty.call(structuredData, 'department');
    const department = normalizeStructuredDepartment(structuredData.department);
    const complaintType = normalizeStructuredValue(structuredData.complaintType);
    const description = normalizeStructuredValue(structuredData.description);
    const originalDescription = normalizeStructuredValue(structuredData.originalDescription);
    const location = normalizeStructuredValue(structuredData.location);
    const date = normalizeIncidentDateInput(normalizeStructuredValue(structuredData.date));
    const personInvolved = normalizeStructuredValue(structuredData.personInvolved);
    const resolvedOffice = resolveOfficeSelection(college) || college;
    const previousOffice = normalizeText(resolveOfficeSelection(baseData.college) || baseData.office || baseData.college);
    const nextOffice = normalizeText(resolvedOffice || baseData.office || baseData.college);
    const officeChanged = Boolean(resolvedOffice && previousOffice && nextOffice && nextOffice !== previousOffice);

    const next = {
      ...baseData,
      ...(submissionType ? { submissionType } : {}),
      ...(college ? { college } : {}),
      ...(complaintType ? { subject: complaintType, category: complaintType } : {}),
      ...(location ? { location } : {}),
      ...(date ? { incidentDate: date } : {}),
      ...(personInvolved ? { involvedPerson: personInvolved } : {}),
      ...(resolvedOffice ? { office: resolvedOffice } : {}),
    };

    if (officeChanged || hasDepartmentField) {
      next.department = department;
    }

    const rawDescription = originalDescription || description;
    if (rawDescription) {
      next.originalDescription = rawDescription;
    }

    if (description || rawDescription) {
      next.description = buildProcessedDescription(description || rawDescription, {
        location: location || next.location,
        incidentDate: date || next.incidentDate,
        involvedPerson: personInvolved || next.involvedPerson,
        office: next.office,
        department: next.department,
      });
    }

    return next;
  };

  const mergeStructuredGrievanceData = (structuredData = {}) => {
    const nextData = applyStructuredGrievanceData(latestGrievanceDataRef.current, structuredData);
    latestGrievanceDataRef.current = nextData;
    setGrievanceData(nextData);

    const submissionType = normalizeStructuredValue(structuredData?.submissionType);
    if (/anonymous/i.test(submissionType)) {
      setActiveMode('anonymous');
    } else if (submissionType) {
      setActiveMode('regular');
    }

    return nextData;
  };

  const hasMeaningfulSubmissionData = (data = latestGrievanceDataRef.current) =>
    Boolean(
      normalizeStructuredValue(data.subject) &&
      normalizeStructuredValue(data.description) &&
      (activeMode || normalizeStructuredValue(data.submissionType)) &&
      normalizeStructuredValue(data.office)
    );

  const isMainMenuReply = (text = '') => {
    const normalized = normalizeText(text);
    return (
      normalized.includes('what would you like to do') &&
      normalized.includes('file a grievance') &&
      normalized.includes('learn how to file')
    );
  };

  const isMissingFieldSatisfied = (field, data = latestGrievanceDataRef.current) => {
    const current = data || {};
    if (field === 'submissionType') {
      return Boolean(activeMode || normalizeStructuredValue(current.submissionType));
    }
    if (field === 'college') {
      return Boolean(normalizeStructuredValue(current.college) || normalizeStructuredValue(current.office));
    }
    if (field === 'department') {
      const office = normalizeStructuredValue(current.office);
      const departmentOptions = departmentOptionsByOffice[office] || [];
      return Boolean(normalizeStructuredValue(current.department) || (office && departmentOptions.length === 0));
    }
    if (field === 'complaintType') {
      return Boolean(normalizeStructuredValue(current.category) || normalizeStructuredValue(current.subject));
    }
    if (field === 'description') {
      return Boolean(normalizeStructuredValue(current.description) || normalizeStructuredValue(current.originalDescription));
    }
    if (field === 'location') {
      return Boolean(normalizeStructuredValue(current.location));
    }
    if (field === 'date') {
      return Boolean(normalizeStructuredValue(current.incidentDate));
    }
    if (field === 'personInvolved') {
      return Boolean(normalizeStructuredValue(current.involvedPerson));
    }
    if (field === 'name') {
      return activeMode === 'anonymous' || Boolean(userInfo?.name);
    }
    return false;
  };

  const normalizeMissingFieldsForDisplay = (fields = [], responseText = '', data = latestGrievanceDataRef.current) => {
    if (!Array.isArray(fields) || fields.length === 0 || isMainMenuReply(responseText)) {
      return [];
    }

    return fields.filter((field) => !isMissingFieldSatisfied(field, data));
  };

  const getLastBotMessageText = () =>
    [...messages].reverse().find((entry) => entry.sender === 'bot' && typeof entry.text === 'string')?.text || '';

  const isConfirmationPrompt = (text = '') => {
    const normalized = normalizeText(text);
    return (
      normalized.includes('is this information correct') ||
      normalized.includes('is the information correct') ||
      normalized.includes('is this correct') ||
      normalized.includes('are these details correct') ||
      normalized.includes('is this summary correct') ||
      (normalized.includes('please confirm') && (normalized.includes('yes/no') || normalized.includes('yes or no')))
    );
  };

  const isAffirmativeResponse = (text = '') => {
    const normalized = normalizeText(text);
    return [
      'yes',
      'yes it is',
      'yes it\'s correct',
      'yes this is correct',
      'yes that is correct',
      'correct',
      'confirmed',
      'looks correct',
      'looks good',
      'that is correct',
      'this is correct',
      'proceed',
      'submit',
      'go ahead',
      'okay',
      'ok',
      'sure',
    ].some((value) => normalized === value || normalized.includes(value));
  };

  const getConfirmationChoice = (text = '') => {
    const normalized = normalizeText(text);

    if (['1', '1.', 'one', 'option 1', 'submit grievance', 'yes submit my grievance'].includes(normalized)) {
      return 'submit';
    }

    if (['2', '2.', 'two', 'option 2', 'make a correction', 'i want to make a correction', 'correction', 'edit'].includes(normalized)) {
      return 'edit';
    }

    if (isAffirmativeResponse(normalized)) {
      return 'submit';
    }

    return '';
  };

  const isNonComplaintMessage = (text = '') => {
    const normalized = normalizeText(text);
    if (!normalized) return true;
    if (isAffirmativeResponse(normalized)) return true;
    if (isLocalCancelMessage(normalized)) return true;
    if (normalized === 'back' || normalized === 'menu' || normalized === 'back to help menu') return true;
    if (normalized.includes('filing process guide') || normalized.includes('required documents') || normalized.includes('office selection help')) {
      return true;
    }
    return false;
  };

  const buildRawTranscript = () =>
    messages
      .filter((entry) => entry.sender === 'user' && typeof entry.text === 'string')
      .map((entry) => entry.text.trim())
      .filter((text) => text && !isNonComplaintMessage(text))
      .join('\n');

  const isVagueComplaintInput = (text) => {
    const normalized = normalizeText(text);
    if (!normalized) return true;
    if (normalized.length < 20 || normalized.split(' ').length < 5) return true;
    return vagueDetailPhrases.some(phrase => normalized === phrase || normalized.includes(phrase));
  };

  const isDetailedComplaintInput = (text) => {
    const normalized = normalizeText(text);
    const wordCount = normalized.split(' ').filter(Boolean).length;
    const detailSignals = ['because', 'when', 'where', 'who', 'after', 'during', 'happened', 'said', 'message', 'office', 'teacher', 'staff'];
    return normalized.length >= 70 || wordCount >= 14 || detailSignals.some(signal => normalized.includes(signal));
  };

  const getDetailNudge = (subject) => {
    const normalized = normalizeText(subject);
    if (normalized.includes('grade') || normalized.includes('failed') || normalized.includes('graded')) {
      return 'If you can, include the subject, assessment, and why you believe the grading or outcome was unfair.';
    }
    if (normalized.includes('harass') || normalized.includes('bully') || normalized.includes('threat') || normalized.includes('abuse')) {
      return 'If you can, include what was said or done, who was involved, and whether there were witnesses or messages.';
    }
    return 'If you can, include what happened, who was involved, and the office or location connected to the concern.';
  };

  const hasDirectComplaintKeyword = (text = '') => {
    const normalized = normalizeText(text);
    return grievanceTitleKeywords.some(keyword => normalized.includes(keyword));
  };

  const isLocalCancelMessage = (text = '') => {
    const normalized = normalizeText(text);
    return ['cancel', 'stop', 'start over', 'never mind', 'nevermind', 'quit'].some(keyword => normalized.includes(keyword));
  };

  const isValidPersonInvolvedInput = (text = '') => {
    const normalized = normalizeText(text);
    if (normalized.length < 3) return false;
    const unclearValues = ['someone', 'somebody', 'person', 'people', 'staff', 'office', 'idk', 'not sure', 'unknown'];
    return !unclearValues.includes(normalized);
  };

  const resolveOfficeSelection = (text = '') => {
    const normalized = normalizeText(text);
    const officeAliases = {
      "College of Technology (COT)": ['technology', 'technologies', 'cot', 'college of technology', 'college of technologies', 'tech', 'engineering'],
      "College of Education (COE)": ['education', 'coe', 'college of education', 'teaching', 'education college'],
      "College of Nursing (CON)": ['nursing', 'con', 'college of nursing', 'nurse', 'nursing college'],
      "College of Business (COB)": ['business', 'cob', 'college of business', 'business college', 'commerce'],
      "College of Public Administration and Governance (CPAG)": ['public administration', 'cpag', 'governance', 'admin', 'public admin'],
      "College of Arts and Sciences (CAS)": ['arts and sciences', 'cas', 'college of arts and sciences', 'arts', 'sciences'],
      "College of Law (COL)": ['law', 'col', 'college of law', 'legal', 'law college']
    };

    for (const [office, aliases] of Object.entries(officeAliases)) {
      if (aliases.some(alias => normalized === alias || normalized.includes(alias))) {
        return office;
      }
    }

    if (officeOptions.includes(text)) {
      return text;
    }

    return null;
  };

  const resolveDepartmentSelection = (office, text = '') => {
    const normalized = normalizeText(text);
    const departmentOptions = departmentOptionsByOffice[office] || [];

    const normalizeDepartmentLabel = (value = '') =>
      normalizeText(
        String(value || '')
          .replace(/\bdepartment\b/gi, '')
          .replace(/\bdept\.?\b/gi, '')
      );

    return departmentOptions.find((department) => {
      const baseLabel = normalizeDepartmentLabel(department);
      return (
        normalizeText(department) === normalized ||
        baseLabel === normalized ||
        `${baseLabel} department` === normalized ||
        `${baseLabel} dept` === normalized ||
        `${baseLabel} dept.` === normalized
      );
    }) || null;
  };

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await authService.getProfile();
        if (response.success) {
          setUserInfo(response.user);
        }
      } catch (error) {
        console.error('Failed to fetch user info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, []);

  const refreshSubmissionLimitStatus = useCallback(async () => {
    setCheckingSubmissionLimit(true);

    try {
      const response = await axiosInstance.get('/grievances/submission-limit');
      const nextStatus = {
        ...createDefaultSubmissionLimitStatus(),
        ...(response.data?.data || {}),
      };
      setSubmissionLimitStatus(nextStatus);
      return nextStatus;
    } catch (error) {
      console.error('Failed to check grievance submission limit:', error);
      return null;
    } finally {
      setCheckingSubmissionLimit(false);
    }
  }, []);

  useEffect(() => {
    refreshSubmissionLimitStatus();
  }, [refreshSubmissionLimitStatus]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, showSubmissionModal, submissionProgress, submissionPhase]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const resetConversationState = () => {
    cleanupAttachments();
    resetMessageIds();
    updateMessages([createInitialBotMessage()]);
    setActiveMode(null);
    setCurrentStep(0);
    setInFilingFlow(false);
    setAwaitingDescription(false);
    setAwaitingDate(false);
    setAwaitingPersonInvolved(false);
    setAwaitingOffice(false);
    setAwaitingDepartment(false);
    setConfirmationPending(false);
    setDetectedLanguage('en');
    const emptyGrievanceData = createInitialGrievanceData();
    latestGrievanceDataRef.current = emptyGrievanceData;
    setGrievanceData(emptyGrievanceData);
    setReferenceNumber('');
    setSubmittedReferenceNumber('');
    setSubmissionProgress(0);
    setSubmissionPhase('idle');
    setSubmissionStatusText('');
    setInputValue('');
    setShowEditModal(false);
    setShowSubmissionModal(false);
  };

  const cleanupAttachments = () => {
    grievanceData.attachments.forEach((attachment) => {
      if (attachment.preview) {
        URL.revokeObjectURL(attachment.preview);
      }
    });
  };

  const queueConversationReset = (delay = 5000) => {
    window.setTimeout(() => {
      resetConversationState();
    }, delay);
  };

  const buildChatHistory = () =>
    messagesRef.current
      .filter(
        (entry) =>
          (entry.sender === 'user' || entry.sender === 'bot') &&
          typeof entry.text === 'string' &&
          entry.text.trim() &&
          !entry.text.includes("Here's a summary of your complaint") &&
          !entry.text.includes("You're almost done. I'll show the final submission options now")
      )
      .map((entry) => ({
        role: entry.sender === 'bot' ? 'assistant' : 'user',
        content: entry.text.trim()
      }));

  const buildConversationTranscript = () =>
    messagesRef.current
      .filter(
        (entry) =>
          (entry.sender === 'user' || entry.sender === 'bot') &&
          typeof entry.text === 'string' &&
          entry.text.trim()
      )
      .map((entry) => ({
        sender: entry.sender,
        message: entry.text.trim(),
        timestamp: entry.timestamp instanceof Date
          ? entry.timestamp.toISOString()
          : new Date(entry.timestamp || Date.now()).toISOString(),
      }));
  
  // --- Dialogflow helper ---------------------------------------------------
  const sendToDialogflow = async (text) => {
    console.debug("sending to Dialogflow:", text);
    try {
      const res = await fetch(`${BACKEND_URL}/api/dialogflow`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
          sessionId: "grievance-session",
          chatHistory: buildChatHistory(),
          userProfile: userInfo
            ? {
                name: userInfo.name || '',
                email: userInfo.email || '',
                contact: getPreferredContact(userInfo),
              }
            : null,
        }),
      });

      if (!res.ok) {
        console.error("Dialogflow server returned status", res.status);
        return null;
      }

      const data = await res.json();
      const normalizedData = data?.reply && !data?.text ? { ...data, text: data.reply } : data;
      if (normalizedData?.grievanceData) {
        normalizedData.mergedGrievanceData = mergeStructuredGrievanceData(normalizedData.grievanceData);
      }
      console.debug("Dialogflow response:", normalizedData);
      if (normalizedData?.intent && isEnglishIntent(normalizedData.intent)) {
        setConversationContext(prev => ({
          ...prev,
          lastEnglishIntent: normalizedData.intent
        }));
      }
      return normalizedData;
    } catch (error) {
      console.error("Dialogflow fetch error:", error);
      return null;
    }
  };

  // Edit Modal Component
  const EditModal = () => {
    const [tempSubject, setTempSubject] = useState(grievanceData.subject);
    const [tempDescription, setTempDescription] = useState(grievanceData.originalDescription || grievanceData.description);

    const handleSave = () => {
      setGrievanceData(prev => ({
        ...prev,
        subject: tempSubject,
        originalDescription: tempDescription,
        description: buildProcessedDescription(tempDescription, {
          incidentDate: prev.incidentDate,
          involvedPerson: prev.involvedPerson,
          office: prev.office,
          department: prev.department
        })
      }));
      setShowEditModal(false);
      // re-show confirmation with updated values
      handleSendConfirmation();
    };

    const handleSubmitEdit = () => {
      setGrievanceData(prev => ({
        ...prev,
        subject: tempSubject,
        originalDescription: tempDescription,
        description: buildProcessedDescription(tempDescription, {
          incidentDate: prev.incidentDate,
          involvedPerson: prev.involvedPerson,
          office: prev.office,
          department: prev.department
        })
      }));
      setShowEditModal(false);
      setShowSubmissionModal(true);
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Edit Grievance</h3>
          <div className="space-y-4 text-left">
            <div>
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input
                type="text"
                value={tempSubject}
                onChange={e => setTempSubject(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={tempDescription}
                onChange={e => setTempDescription(e.target.value)}
                rows={4}
                className="mt-1 block w-full border border-gray-300 rounded-md p-2 resize-none"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => setShowEditModal(false)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 px-4 rounded-xl font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-xl font-semibold"
            >
              Save
            </button>
            <button
              onClick={handleSubmitEdit}
              className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white py-2 px-4 rounded-xl font-semibold"
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    );
  };

  const waitForAiAnalysis = async (grievanceId, timeoutMs = 20000, intervalMs = 2000) => {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      try {
        const response = await axiosInstance.get(`/grievances/${grievanceId}`);
        const latestGrievance = response.data?.data;
        if (latestGrievance?.aiAnalysis || latestGrievance?.aiAnalysisStatus === 'failed') {
          return latestGrievance;
        }
      } catch (error) {
        console.error('Failed to poll grievance AI analysis:', error);
        return null;
      }

      await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
    }

    return null;
  };

  // Submission Modal Component
  const SubmissionModal = () => {
    const [wantToAttach, setWantToAttach] = useState(null); // null, true, false
    const [showFileUpload, setShowFileUpload] = useState(false);

    const closeSubmissionModal = () => {
      if (submissionPhase === 'uploading' || submissionPhase === 'submitting') {
        return;
      }

      setShowSubmissionModal(false);
      setWantToAttach(null);
      setShowFileUpload(false);
      setSubmissionProgress(0);
      setSubmissionPhase('idle');
      setSubmissionStatusText('');
      setSubmittedReferenceNumber('');
    };

    const handleFinalSubmit = async () => {
      let cloudinaryUrls = [];

      try {
        if (!hasMeaningfulSubmissionData(grievanceData)) {
          setSubmissionPhase('error');
          setSubmissionProgress(0);
          setSubmissionStatusText('Please complete the required grievance details in the chat before submitting.');
          return;
        }

        const latestLimitStatus = await refreshSubmissionLimitStatus();
        if (latestLimitStatus && !latestLimitStatus.canSubmit) {
          setSubmissionPhase('error');
          setSubmissionProgress(0);
          setSubmissionStatusText(ACTIVE_GRIEVANCE_LIMIT_BLOCK_MESSAGE);
          addBotMessage(ACTIVE_GRIEVANCE_LIMIT_BLOCK_MESSAGE);
          return;
        }

        setSubmissionPhase('uploading');
        setSubmissionProgress(8);
        setSubmissionStatusText(
          grievanceData.attachments.length > 0
            ? 'Preparing your files for upload...'
            : 'Preparing your grievance for submission...'
        );

        if (grievanceData.attachments.length > 0) {
          setSubmissionProgress(24);
          setSubmissionStatusText('Uploading supporting files...');

          const filesToUpload = grievanceData.attachments.map((attachment) => attachment.file);
          const uploadResults = await cloudinaryService.uploadMultipleFilesToCloudinary(filesToUpload);

          cloudinaryUrls = uploadResults
            .filter((result) => result?.success || result?.url)
            .map((result) => ({
              url: result.url,
              publicId: result.publicId,
              originalName: result.originalName,
              format: result.format,
              size: result.size
            }));

          const failedUploads = uploadResults.filter((result) => !(result?.success || result?.url));
          if (failedUploads.length > 0) {
            console.error('Some uploads failed:', failedUploads);
          }
        }

        setSubmissionPhase('submitting');
        setSubmissionProgress(74);
        setSubmissionStatusText('Sending your grievance to the Admin... Please wait, this may take a moment.');

        const grievanceResponse = await axiosInstance.post('/grievances', {
          subject: grievanceData.subject,
          description: grievanceData.description,
          originalDescription: grievanceData.originalDescription || grievanceData.description,
          category: grievanceData.category || undefined,
          office: grievanceData.office || undefined,
          department: grievanceData.department || undefined,
          personInvolved: grievanceData.involvedPerson || undefined,
          incidentDate: normalizeIncidentDateInput(grievanceData.incidentDate || incidentDate || ''),
          isAnonymous: activeMode === 'anonymous',
          attachments: cloudinaryUrls,
          conversationTranscript: buildConversationTranscript()
        });

        let savedGrievance = grievanceResponse.data?.data;
        let aiAnalysis = grievanceResponse.data?.aiAnalysis || savedGrievance?.aiAnalysis || null;

        if (savedGrievance?._id && !aiAnalysis) {
          setSubmissionProgress(88);
          setSubmissionStatusText('Your grievance was saved. Generating the AI analysis now...');

          const analyzedGrievance = await waitForAiAnalysis(savedGrievance._id);
          if (analyzedGrievance) {
            savedGrievance = analyzedGrievance;
            aiAnalysis = analyzedGrievance.aiAnalysis || null;
          }
        }

        const refNum = savedGrievance?.referenceNumber || '';
        const aiAnalysisStatus = savedGrievance?.aiAnalysisStatus || grievanceResponse.data?.aiAnalysisStatus || 'pending';

        setReferenceNumber(refNum);
        setSubmittedReferenceNumber(refNum);
        setSubmissionPhase('success');
        setSubmissionProgress(100);
        setSubmissionStatusText(
          aiAnalysis
            ? 'Your grievance and AI analysis are now available in your grievance records and admin review screens.'
            : aiAnalysisStatus === 'failed'
              ? 'Your grievance was submitted, but the AI analysis could not be generated yet.'
              : 'Your grievance was submitted. The AI analysis is still processing and will appear shortly in your grievance records and admin review screens.'
        );

        const fileList = grievanceData.attachments.map((file) => file.name).join(', ');
        const cloudinaryInfo = cloudinaryUrls.length > 0
          ? `\nFiles uploaded:\n${cloudinaryUrls.map((file) => `- ${file.originalName}`).join('\n')}`
          : '';
        const aiInfo = aiAnalysis
          ? `\n\nAI analysis:\nCategory: ${normalizeAiCategoryLabel(aiAnalysis.category?.label || 'N/A')}\nPriority: ${aiAnalysis.urgency?.label || 'N/A'}\nSentiment: ${aiAnalysis.sentiment?.label || 'N/A'}`
          : aiAnalysisStatus === 'failed'
            ? '\n\nAI analysis status: The complaint was saved, but the AI analysis could not be generated yet.'
            : '\n\nAI analysis status: Processing. It will appear shortly in My Grievances and the admin dashboard.';

        const finalResponse = {
          id: getNextMessageId(),
          text: activeMode === 'anonymous'
            ? `Grievance Submitted\n\nReference Number: ${refNum}${grievanceData.attachments.length > 0 ? `\n\nAttached files: ${fileList}${cloudinaryInfo}` : ''}${aiInfo}\n\nNo personal information was shared with the grievance record.`
            : `Grievance Submitted\n\nReference Number: ${refNum}\n\nName: ${userInfo?.name || 'N/A'}\nEmail: ${userInfo?.email || 'N/A'}${getPreferredContact(userInfo) ? `\nContact Number: ${getPreferredContact(userInfo)}` : ''}${grievanceData.attachments.length > 0 ? `\n\nAttached files: ${fileList}${cloudinaryInfo}` : ''}${aiInfo}\n\nYou can now track this grievance from your account.`,
          sender: 'bot',
          timestamp: new Date()
        };

        updateMessages((prev) => [...prev, finalResponse]);
        cleanupAttachments();
        refreshSubmissionLimitStatus();

        window.setTimeout(() => {
          setShowSubmissionModal(false);
          setWantToAttach(null);
          setShowFileUpload(false);
          queueConversationReset();
        }, 250);
      } catch (error) {
        console.error('Failed to submit grievance:', error);
        const backendMessage = error.response?.data?.message || error.response?.data?.error || 'I could not submit your grievance right now. Please try again.';
        setSubmissionPhase('error');
        setSubmissionStatusText(backendMessage);
        const failureMessage = {
          id: getNextMessageId(),
          text: backendMessage,
          sender: 'bot',
          timestamp: new Date()
        };
        updateMessages((prev) => [...prev, failureMessage]);
      }
    };

    if (submissionPhase === 'uploading' || submissionPhase === 'submitting' || submissionPhase === 'success' || submissionPhase === 'error') {
      const progressSteps = [
        { key: 'uploading', label: grievanceData.attachments.length > 0 ? 'Uploading files' : 'Preparing submission', icon: '1' },
        { key: 'submitting', label: 'Submitting grievance', icon: '2' },
        { key: 'success', label: 'Completed', icon: '3' }
      ];
      const displayPhase = submissionPhase === 'error' ? 'submitting' : submissionPhase;
      const phaseOrder = ['uploading', 'submitting', 'success'];
      const currentIndex = phaseOrder.indexOf(displayPhase);

      return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                submissionPhase === 'success'
                  ? 'bg-green-100 text-green-600'
                  : submissionPhase === 'error'
                    ? 'bg-red-100 text-red-600'
                    : 'bg-blue-100 text-blue-600'
              }`}>
                {submissionPhase === 'success' ? (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : submissionPhase === 'error' ? (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {submissionPhase === 'success' ? 'Grievance Submitted' : submissionPhase === 'error' ? 'Submission Failed' : 'Submitting Grievance'}
              </h3>
              <p className="text-gray-600 mb-6">{submissionStatusText}</p>

              <div className="space-y-3 mb-6 text-left">
                {progressSteps.map((step, index) => {
                  const isComplete = submissionPhase === 'success' ? true : index < currentIndex;
                  const isCurrent = submissionPhase !== 'success' && submissionPhase !== 'error' && step.key === submissionPhase;

                  return (
                    <div
                      key={step.key}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                        isComplete
                          ? 'border-green-200 bg-green-50 text-green-700'
                          : isCurrent
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-gray-50 text-gray-400'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        isComplete
                          ? 'bg-green-100'
                          : isCurrent
                            ? 'bg-blue-100 animate-pulse'
                            : 'bg-gray-100'
                      }`}>
                        {step.icon}
                      </div>
                      <span className="text-sm font-medium">{step.label}</span>
                    </div>
                  );
                })}
              </div>

              <div className="mb-3 flex items-center justify-between text-sm font-semibold text-gray-700">
                <span>Progress</span>
                <span>{submissionProgress}%</span>
              </div>
              <div className="h-3 rounded-full bg-gray-100 overflow-hidden mb-4">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    submissionPhase === 'error'
                      ? 'bg-red-500'
                      : submissionPhase === 'success'
                        ? 'bg-green-500'
                        : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                  }`}
                  style={{ width: `${submissionProgress}%` }}
                />
              </div>

              {submittedReferenceNumber && (
                <p className="text-sm text-gray-700">
                  <strong>Reference Number:</strong> {submittedReferenceNumber}
                </p>
              )}

              {submissionPhase === 'error' && (
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => {
                      setSubmissionPhase('idle');
                      setSubmissionProgress(0);
                      setSubmissionStatusText('');
                    }}
                    className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white py-3 px-4 rounded-xl font-semibold transition-all duration-200"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={closeSubmissionModal}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 px-4 rounded-xl font-semibold transition-all duration-200"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (wantToAttach === null) {
      return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Attach Supporting Files?</h3>
              <p className="text-gray-600 mb-6">You can add supporting documents, screenshots, images, or videos if they will help explain your concern. This step is optional.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setWantToAttach(true)}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white py-3 px-4 rounded-xl font-semibold transition-all duration-200"
                >
                  Yes, Attach Files
                </button>
                <button
                  onClick={() => setWantToAttach(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 px-4 rounded-xl font-semibold transition-all duration-200"
                >
                  No, Skip Attachment
                </button>
              </div>
              <button
                onClick={closeSubmissionModal}
                className="mt-4 text-gray-500 hover:text-gray-700 text-sm underline"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (wantToAttach && !showFileUpload) {
      return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">File Attachment</h3>
              <p className="text-gray-600 mb-6">Please select any files that support your grievance. You can continue without attachments if you do not have any right now.</p>

              <FileUploadComponent
                onFilesSelected={handleFilesSelected}
                currentAttachments={grievanceData.attachments}
              />

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowFileUpload(true)}
                  disabled={grievanceData.attachments.length === 0}
                  className="flex-1 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 px-4 rounded-xl font-semibold transition-all duration-200"
                >
                  Continue with {grievanceData.attachments.length} File(s)
                </button>
                <button
                  onClick={() => {
                    setWantToAttach(false);
                    setShowFileUpload(false);
                  }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 px-4 rounded-xl font-semibold transition-all duration-200"
                >
                  Skip Attachment
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Final Confirmation</h3>
            <p className="text-gray-600 mb-4">
              {grievanceData.attachments.length > 0
                ? `You're submitting with ${grievanceData.attachments.length} attached file(s). Please review the summary below before you send it.`
                : "You're submitting without any attachments. That's okay, and you can still continue."
              }
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              {activeMode !== 'anonymous' && (
                <>
                  <p className="text-sm text-gray-700"><strong>Name:</strong> {userInfo?.name || 'Not available'}</p>
                  <p className="text-sm text-gray-700"><strong>Email:</strong> {userInfo?.email || 'Not available'}</p>
                  {getPreferredContact(userInfo) && (
                    <p className="text-sm text-gray-700"><strong>Contact Number:</strong> {getPreferredContact(userInfo)}</p>
                  )}
                </>
              )}
              <p className="text-sm text-gray-700"><strong>Category:</strong> {grievanceData.category}</p>
              <p className="text-sm text-gray-700"><strong>Office:</strong> {grievanceData.office}</p>
              {grievanceData.department && (
                <p className="text-sm text-gray-700"><strong>Department:</strong> {grievanceData.department}</p>
              )}
              <p className="text-sm text-gray-700"><strong>Subject:</strong> {grievanceData.subject}</p>
              <p className="text-sm text-gray-700"><strong>Description:</strong> {(grievanceData.originalDescription || grievanceData.description).length > 120 ? `${(grievanceData.originalDescription || grievanceData.description).substring(0, 120)}...` : (grievanceData.originalDescription || grievanceData.description)}</p>
              {grievanceData.incidentDate && (
                <p className="text-sm text-gray-700"><strong>Date of Incident:</strong> {grievanceData.incidentDate}</p>
              )}
              {grievanceData.attachments.length > 0 && (
                <p className="text-sm text-gray-700 mt-2">
                  <strong>Files:</strong> {grievanceData.attachments.map((file) => file.name).join(', ')}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleFinalSubmit}
                className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white py-3 px-4 rounded-xl font-semibold transition-all duration-200"
              >
                Submit Grievance
              </button>
              <button
                onClick={closeSubmissionModal}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 px-4 rounded-xl font-semibold transition-all duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // File Upload Component

  const FileUploadComponent = ({ onFilesSelected, currentAttachments }) => {
    const fileInputRef = useRef(null);
    
    const handleFileSelect = (e) => {
      const files = Array.from(e.target.files);
      const validFiles = [];
      const validTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'video/mp4',
        'video/quicktime',
        'video/x-msvideo'
      ];
      const maxSize = 10 * 1024 * 1024; // 10MB limit
      
      files.forEach(file => {
        if (!validTypes.includes(file.type)) {
          alert(`Invalid file type: ${file.name}. Please upload PDF, JPEG, PNG, or video files only.`);
          return;
        }
        
        if (file.size > maxSize) {
          alert(`File too large: ${file.name}. Maximum size is 10MB.`);
          return;
        }
        
        validFiles.push({
          file: file,
          name: file.name,
          size: file.size,
          type: file.type,
          preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
        });
      });
      
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    };
    
    const removeFile = (index) => {
      const newAttachments = [...currentAttachments];
      const removedFile = newAttachments.splice(index, 1)[0];
      
      // Clean up preview URL if it's an image
      if (removedFile.preview) {
        URL.revokeObjectURL(removedFile.preview);
      }
      
      setGrievanceData(prev => ({
        ...prev,
        attachments: newAttachments
      }));
    };
    
    return (
      <div className="mt-4">
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-400 transition-colors duration-200">
          <div className="flex flex-col items-center">
            <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-gray-600 mb-2 font-medium">Drag & drop files here</p>
            <p className="text-gray-500 text-sm mb-4">or</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg"
            >
              Browse Files
            </button>
            <p className="text-gray-400 text-xs mt-3">
              Supports: PDF, JPEG, PNG, MP4, AVI, MOV (Max 10MB each)
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpeg,.jpg,.png,.mp4,.avi,.mov,.qt"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
        
        {/* File Previews */}
        {currentAttachments.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Attached Files:</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {currentAttachments.map((attachment, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <div className="flex items-center space-x-3">
                    {attachment.preview ? (
                      <img src={attachment.preview} alt={attachment.name} className="w-10 h-10 object-cover rounded" />
                    ) : (
                      <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900 truncate max-w-xs">{attachment.name}</p>
                      <p className="text-xs text-gray-500">
                        {(attachment.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors duration-200"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const grievanceSteps = [
    { question: "What category does your grievance fall under?", options: ["Academic Issues", "Administrative Concerns", "Facility Problems", "Financial Matters", "Other"] },
    { question: "Which office should handle this matter?", options: ["College of Technology (COT)", "College of Education (COE)", "College of Nursing (CON)", "College of Business (COB)", "College of Public Administration and Governance (CPAG)", "College of Arts and Sciences (CAS)", "College of Law (COL)"] },
    { question: "Please provide a brief subject for your grievance:", type: 'text' },
    { question: "Please describe your grievance in detail:", type: 'textarea' }
  ];

  const handleFilesSelected = (files) => {
    setGrievanceData(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...files]
    }));
  };

  // when user clicks the submit-grievance button, open the submission modal directly
  const handleOpenSubmissionModal = async (dataOverride = null) => {
    const explicitDataOverride =
      dataOverride && typeof dataOverride === 'object' && !dataOverride.nativeEvent
        ? dataOverride
        : null;

    if (explicitDataOverride) {
      const sanitizedOverride = {
        ...explicitDataOverride,
        incidentDate: normalizeIncidentDateInput(explicitDataOverride.incidentDate),
      };
      latestGrievanceDataRef.current = sanitizedOverride;
      setGrievanceData(sanitizedOverride);
    }

    const submissionData = explicitDataOverride
      ? {
          ...explicitDataOverride,
          incidentDate: normalizeIncidentDateInput(explicitDataOverride.incidentDate),
        }
      : {
          ...latestGrievanceDataRef.current,
          incidentDate: normalizeIncidentDateInput(latestGrievanceDataRef.current.incidentDate),
        };

    if (!hasMeaningfulSubmissionData(submissionData)) {
      addBotMessage(
        "I still need the complaint type, description, submission type, and college/office before I can show the final submission modal."
      );
      setConfirmationPending(false);
      setShowSubmissionModal(false);
      scrollToBottom();
      return;
    }

    const latestLimitStatus = await refreshSubmissionLimitStatus();
    if (latestLimitStatus && !latestLimitStatus.canSubmit) {
      addBotMessage(ACTIVE_GRIEVANCE_LIMIT_BLOCK_MESSAGE);
      setConfirmationPending(false);
      setShowSubmissionModal(false);
      scrollToBottom();
      return;
    }

    latestGrievanceDataRef.current = submissionData;
    setGrievanceData(submissionData);
    setSubmissionProgress(0);
    setSubmissionPhase('idle');
    setSubmissionStatusText('');
    setSubmittedReferenceNumber('');
    addBotMessage(
      latestLimitStatus?.hasEligibleOverdueException
        ? `${ACTIVE_GRIEVANCE_LIMIT_EXCEPTION_MESSAGE}\n\nYou're almost done. I'll show the final submission options now, including the optional file attachment step.`
        : "You're almost done. I'll show the final submission options now, including the optional file attachment step."
    );
    setShowSubmissionModal(true);
    scrollToBottom();
  };

  // when bot needs to show confirmation message with options (used by Dialogflow flow)
  const handleSendConfirmation = (dataOverride = {}) => {
    const summaryData = {
      ...grievanceData,
      ...dataOverride,
      incidentDate: normalizeIncidentDateInput(dataOverride.incidentDate || grievanceData.incidentDate),
    };
    setGrievanceData((prev) => ({
      ...prev,
      ...dataOverride,
      incidentDate: normalizeIncidentDateInput(dataOverride.incidentDate || prev.incidentDate),
    }));
    const summaryDescription = summaryData.originalDescription || summaryData.description;
    let summaryText = `Here's a summary of your complaint. Please review everything before submitting.\n\nTitle: '${summaryData.subject}'\nDescription: '${summaryDescription}'`;

    if (activeMode !== 'anonymous') {
      summaryText += `\nName: ${userInfo?.name || 'Not available'}\nEmail: ${userInfo?.email || 'Not available'}`;
      if (getPreferredContact(userInfo)) {
        summaryText += `\nContact Number: ${getPreferredContact(userInfo)}`;
      }
    }
    
    if (summaryData.incidentDate) {
      summaryText += `\nDate of Incident: ${summaryData.incidentDate}`;
    }

    if (summaryData.involvedPerson) {
      summaryText += `\nPerson Involved: ${summaryData.involvedPerson}`;
    }

    summaryText += `\nOffice: ${summaryData.office || 'Not provided yet'}`;

    if (summaryData.department) {
      summaryText += `\nDepartment: ${summaryData.department}`;
    }
    
    const summaryMsg = {
      id: getNextMessageId(),
      text: summaryText,
      sender: 'bot',
      timestamp: new Date(),
      options: ['Confirm & Submit', 'Edit'],
      disabledOptions: []
    };
    updateMessages(prev => [...prev, summaryMsg]);
    setConfirmationPending(true);
  };

  const handleSend = async (directMessage) => {
    const messageText = directMessage || inputValue;
    if (!messageText.trim()) return;
    const lastBotMessageText = getLastBotMessageText();
    const confirmationChoice = isConfirmationPrompt(lastBotMessageText)
      ? getConfirmationChoice(messageText)
      : '';
    
    // Add user message
    const newUserMessage = {
      id: getNextMessageId(),
      text: messageText,
      sender: 'user',
      timestamp: new Date()
    };
    
    updateMessages(prev => [...prev, newUserMessage]);
    setInputValue('');
    console.debug('user message sent, currentStep', currentStep, 'inFilingFlow', inFilingFlow);

    if (confirmationChoice === 'submit') {
      setConfirmationPending(false);
      handleOpenSubmissionModal(latestGrievanceDataRef.current);
      return;
    }

    if (confirmationChoice === 'edit') {
      setConfirmationPending(false);
      addBotMessage("No problem. Let's update the details before submitting.");
      setShowEditModal(true);
      scrollToBottom();
      return;
    }

    setIsTyping(true);
    const dfResponse = await sendToDialogflow(messageText);
    setIsTyping(false);

    if (dfResponse && dfResponse.text) {
      const shouldOpenSubmissionFlow = isConfirmationPrompt(dfResponse.text);

      if (shouldOpenSubmissionFlow) {
        setConfirmationPending(true);
        if (dfResponse.mergedGrievanceData) {
          latestGrievanceDataRef.current = dfResponse.mergedGrievanceData;
        }
      }

      addBotMessage(dfResponse.text, {
        missingFields: normalizeMissingFieldsForDisplay(
          dfResponse.missingFields,
          dfResponse.text,
          dfResponse.mergedGrievanceData || latestGrievanceDataRef.current
        ),
      });

      if (dfResponse.intent === 'iServe-BukSU-Complaints-Cancel_Complaint(Eng)' || isLocalCancelMessage(messageText)) {
        queueConversationReset(1500);
      }

      scrollToBottom();
      return;
    }

    addBotMessage(
      "I'm having trouble responding right now. Please try again."
    );
    scrollToBottom();
    return;
    
  };

  const handleOptionSelect = (option, messageId) => {
    // Disable ALL options in the specific message when any option is clicked
    updateMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, disabledOptions: [...(msg.options || [])] }
        : msg
    ));

    // if we're in the confirmation flow, intercept the choice
    if (confirmationPending) {
      const isConfirm = option === 'Confirm & Submit';
      const isEdit = option === 'Edit';

      if (isConfirm) {
        const isCebuano = false;
        setSubmissionProgress(0);
        setSubmissionPhase('idle');
        setSubmissionStatusText('');
        setSubmittedReferenceNumber('');
        addBotMessage(
          isCebuano
            ? "Salamat sa pagkumpirma. Sunod, pilion nato kung gusto ba nimo mu-attach ug file, dayon ipakita ko ang final confirmation."
            : "Thank you for confirming. Next is the optional file attachment step, then I'll show the final confirmation."
        );
        setShowSubmissionModal(true);
        scrollToBottom();
      } else if (isEdit) {
        // open edit modal with current values
        addBotMessage("No problem. Let's update the details before submitting.");
        setShowEditModal(true);
      }
      setConfirmationPending(false);
      return;
    }

    handleSend(option);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSend();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Chat Header */}
      <div className="border-b border-gray-200 bg-gradient-to-r from-blue-500 to-cyan-500 px-3 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1 text-left">
              {loading ? (
                <div className="animate-pulse">
                  <div className="h-4 bg-white/30 rounded w-32 mb-1"></div>
                  <div className="h-3 bg-white/20 rounded w-24"></div>
                </div>
              ) : (
                <>
                  <h2 className="truncate text-base font-semibold text-white sm:text-lg">Welcome, {userInfo?.name || 'User'}!</h2>
                  <p className="text-white/80 text-sm">How can I help you today?</p>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
            {(activeMode === 'selecting' || activeMode === 'anonymous' || activeMode === 'regular') && (
              <div className={`flex min-w-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-medium transition-all duration-300 sm:px-4 sm:text-sm ${
                activeMode === 'selecting' 
                  ? 'bg-white/15 text-white animate-pulse' 
                  : activeMode === 'anonymous'
                    ? 'bg-gradient-to-r from-purple-500/30 to-pink-500/30 text-white shadow-lg' 
                    : 'bg-gradient-to-r from-blue-500/30 to-cyan-500/30 text-white shadow-lg'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  activeMode === 'selecting' 
                    ? 'bg-white animate-ping' 
                    : activeMode === 'anonymous'
                      ? 'bg-purple-300' 
                      : 'bg-blue-300'
                }`}></div>
                <span>
                  {activeMode === 'selecting' ? 'Selecting Mode...' : 
                   activeMode === 'anonymous' ? 'Anonymous Mode' : 'Regular Mode'}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowGuide((prev) => !prev)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium backdrop-blur-sm transition-all duration-200 hover:scale-105 sm:text-sm ${
                showGuide
                  ? 'bg-white text-blue-700 border-white shadow-md'
                  : 'bg-white/20 hover:bg-white/30 text-white border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 21a9 9 0 100-18 9 9 0 000 18z" />
                </svg>
                <span>{showGuide ? 'Hide Guide' : 'Guide'}</span>
              </div>
            </button>
            <button
              onClick={() => {
                resetConversationState();
              }}
              className="rounded-lg border border-white/10 bg-white/20 px-3 py-2 text-xs font-medium text-white backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:border-white/20 hover:bg-white/30 sm:text-sm"
            >
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Reset</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-3 sm:p-4">
        <div
          className={`max-w-5xl mx-auto space-y-4 relative transition-all duration-300 ${
            showGuide ? 'xl:pr-[390px]' : ''
          }`}
        >
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.sender === 'bot' && (
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0 mr-3 mt-1">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
              )}
              
              <div className={`max-w-[70vw] rounded-2xl px-3 py-2.5 sm:max-w-md sm:px-4 sm:py-3 lg:max-w-lg xl:max-w-xl ${
                message.sender === 'user' 
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-br-none ml-3' 
                  : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none shadow-sm mr-3'
              }`}>
                <p className="text-sm leading-relaxed whitespace-pre-line text-left">{message.text}</p>

                {message.sender === 'bot' && Array.isArray(message.missingFields) && message.missingFields.length > 0 && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <span className="font-semibold">Still needed: </span>
                    {message.missingFields
                      .map((field) => field.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase()))
                      .join(', ')}
                  </div>
                )}
                
                {message.options && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.options.map((option, index) => {
                      const isDisabled = message.disabledOptions?.includes(option);
                      const isConfirmAction = option === 'Confirm & Submit';
                      let btnClass = '';

                      if (message.sender === 'user') {
                        btnClass = 'bg-white/20 text-white hover:bg-white/30';
                      } else if (isDisabled) {
                        btnClass = 'bg-gray-100 text-gray-400 cursor-not-allowed';
                      } else if (isConfirmAction) {
                        btnClass = 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white';
                      } else {
                        btnClass = 'bg-blue-100 hover:bg-blue-200 text-blue-800';
                      }

                      return (
                        <button
                          key={index}
                          onClick={() => !isDisabled && handleOptionSelect(option, message.id)}
                          disabled={isDisabled}
                          className={`text-xs px-3 py-1.5 rounded-full transition-colors duration-200 ${btnClass}`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                )}
                
                <p className={`text-xs mt-2 ${
                  message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              
              {message.sender === 'user' && (
                <div className="w-8 h-8 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full flex items-center justify-center flex-shrink-0 ml-3 mt-1">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0 mr-3 mt-1">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div className="bg-white text-gray-800 border border-gray-200 rounded-bl-none rounded-2xl rounded-tr-2xl px-4 py-3 shadow-sm mr-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />

          {showGuide && (
            <div className="absolute inset-x-0 top-0 z-20 sm:left-auto sm:right-0 sm:w-[360px] bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-700 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/15 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 21a9 9 0 100-18 9 9 0 000 18z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/80">Filing Guide</p>
                      <h3 className="text-lg font-semibold">What I Need From You</h3>
                      <p className="text-sm text-blue-100 mt-1">
                        Use this guide while chatting so you know what details help the grievance process move faster.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGuide(false)}
                    className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center flex-shrink-0"
                    aria-label="Close guide"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-5 space-y-4 bg-gradient-to-b from-white to-slate-50/80">
                {filingGuideSections.map((section) => {
                  const accentClass =
                    section.tone === 'emerald'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : section.tone === 'amber'
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-blue-200 bg-blue-50 text-blue-700';

                  return (
                    <section key={section.title} className="text-left">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-semibold ${accentClass}`}>
                        {section.title}
                      </div>
                      <ul className="mt-3 space-y-2">
                        {section.items.map((item) => (
                          <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="mt-1.5 h-2 w-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex-shrink-0"></span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}

                <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/70 p-4 text-left">
                  <p className="text-sm font-semibold text-blue-900">Quick reminder</p>
                  <p className="mt-1 text-sm text-blue-800">
                    You do not need to click the quick chip first. You can type your grievance concern directly, and the chatbot can still begin the filing flow.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white p-3 sm:p-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          {submissionLimitStatus.hasReachedLimit && (
            <div className={`mb-3 rounded-xl border px-4 py-3 text-left text-sm ${
              submissionLimitStatus.canSubmit
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}>
              {submissionLimitStatus.canSubmit
                ? ACTIVE_GRIEVANCE_LIMIT_EXCEPTION_MESSAGE
                : ACTIVE_GRIEVANCE_LIMIT_BLOCK_MESSAGE}
            </div>
          )}
          {grievanceSteps[(activeMode === 'regular' ? currentStep - 1 : currentStep - 2)]?.type === 'file' ? (
            <div className="space-y-4">
              <FileUploadComponent 
                onFilesSelected={handleFilesSelected}
                currentAttachments={grievanceData.attachments}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={isTyping}
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Submit with Files
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              {/* Main Input Field */}
              {(currentStep === 3) || grievanceSteps[(activeMode === 'regular' ? currentStep - 1 : currentStep - 2)]?.type === 'textarea' ? (
                <div className="flex-1 relative">
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Type your response..."
                    rows="2"
                    className="w-full rounded-xl border border-gray-300 p-3 text-gray-900 placeholder-gray-500 focus:border-transparent focus:ring-2 focus:ring-blue-500 sm:p-4"
                    disabled={isTyping}
                  />
                </div>
              ) : (
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message here..."
                    className="w-full rounded-xl border border-gray-300 p-3 text-gray-900 placeholder-gray-500 focus:border-transparent focus:ring-2 focus:ring-blue-500 sm:p-4"
                    disabled={isTyping}
                  />
                </div>
              )}
              
              {/* Send Button (for chatbot conversation) */}
              <button
                type="submit"
                disabled={!inputValue.trim() || isTyping}
                className="flex w-full flex-shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-3 font-semibold text-white transition-all duration-200 hover:from-blue-600 hover:to-cyan-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-6 sm:py-4"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <span className="hidden sm:inline">Send</span>
              </button>
              
              {/* Submit Grievance Button (always visible during filing mode) */}
              {activeMode && (
                <button
                  type="button"
                  onClick={handleOpenSubmissionModal}
                  disabled={checkingSubmissionLimit || !submissionLimitStatus.canSubmit}
                className="flex w-full flex-shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 px-5 py-3 font-semibold text-white shadow-lg transition-all duration-200 hover:from-purple-600 hover:to-indigo-600 hover:shadow-xl disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-400 sm:w-auto sm:px-6 sm:py-4"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="hidden sm:inline">Submit Grievance</span>
                </button>
              )}
            </div>
          )}
        </form>
      </div>
      
      {/* Edit Modal */}
      {showEditModal && <EditModal />}
      {/* Submission Modal */}
      {showSubmissionModal && <SubmissionModal />}
    </div>
  );
};

export default DashboardModule;
