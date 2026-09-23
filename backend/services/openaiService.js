const OpenAI = require('openai');
const { buildOfficeCatalogPrompt } = require('../utils/officeCategoryCatalog');

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

const ISERVE_PROMPT_ID =
  process.env.ISERVE_PROMPT_ID ||
  'pmpt_69d23f78ab1481978a529c61db367b3108e73f4e6a7ec72d';

const ISERVE_PROMPT_VERSION =
  process.env.ISERVE_PROMPT_VERSION || '5';

const SYSTEM_ERROR_REPLY = 'System error. Please try again.';
const SYSTEM_ERROR_REPLY_CEB =
  'Naay problema sa sistema. Palihug sulayi pag-usab.';

/*
 * ============================================================
 * I-SERVE CHAT - SAVED OPENAI PLAYGROUND PROMPT
 * ============================================================
 *
 * Main instructions are now stored in OpenAI Playground.
 *
 * Prompt:
 * I-Serve Chat
 *
 * Prompt ID:
 * pmpt_69d23f78ab1481978a529c61db367b3108e73f4e6a7ec72d
 *
 * Version:
 * 5
 *
 * This means you no longer need to maintain the long
 * SYSTEM_PROMPT inside this file.
 *
 * ============================================================
 */

const ASSISTANT_RESPONSE_FORMAT = {
  type: 'json_schema',
  name: 'iserve_chat_response',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      reply: {
        type: 'string',
        description:
          'The user-facing assistant reply in the same language as the latest user message.',
      },

      missingFields: {
        type: 'array',
        description:
          'A compact list of complaint fields that are still missing and need follow-up.',
        items: {
          type: 'string',
          enum: [
            'submissionType',
            'name',
            'college',
            'department',
            'complaintType',
            'description',
            'location',
            'date',
            'personInvolved',
          ],
        },
      },

      grievanceData: {
        type: 'object',
        additionalProperties: false,
        description:
          'Structured grievance fields supported by the current conversation only. Never invent missing information.',
        properties: {
          submissionType: {
            type: ['string', 'null'],
            description:
              'Anonymous, With identity, or another explicit submission type provided or confirmed by the user.',
          },
          name: {
            type: ['string', 'null'],
            description:
              'Complainant name only when provided by the user or explicitly applicable from authenticated user context.',
          },
          college: {
            type: ['string', 'null'],
            description:
              'College or office concerned, only when supported by the conversation or routing catalog.',
          },
          department: {
            type: ['string', 'null'],
            description:
              'Department concerned, or N/A only when the selected college does not require a department.',
          },
          complaintType: {
            type: ['string', 'null'],
            description:
              'Complaint/category type inferred from actual grievance facts already provided.',
          },
          description: {
            type: ['string', 'null'],
            description:
              'Meaningful English grievance description based only on facts actually provided by the user.',
          },
          originalDescription: {
            type: ['string', 'null'],
            description:
              'Original-language grievance description from the user when available.',
          },
          location: {
            type: ['string', 'null'],
            description:
              'Incident location only when provided or clearly stated.',
          },
          date: {
            type: ['string', 'null'],
            description:
              'Incident date only when provided or clearly stated.',
          },
          personInvolved: {
            type: ['string', 'null'],
            description:
              'Person, role, office, or party involved only when provided or clearly stated.',
          },
        },
        required: [
          'submissionType',
          'name',
          'college',
          'department',
          'complaintType',
          'description',
          'originalDescription',
          'location',
          'date',
          'personInvolved',
        ],
      },
    },

    required: ['reply', 'missingFields', 'grievanceData'],
  },
};

const MESSAGE_METADATA_FORMAT = {
  type: 'json_schema',
  name: 'iserve_chat_message_metadata',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      detectedLanguage: {
        type: 'string',
        enum: ['en', 'ceb'],
        description:
          'The language of the latest user message. Use "ceb" for Cebuano/Bisaya and "en" for English.',
      },

      englishTranslation: {
        type: 'string',
        description:
          'A faithful English translation of the latest user message only. If the user message is already English, copy it exactly.',
      },
    },

    required: ['detectedLanguage', 'englishTranslation'],
  },
};

let client;

const getOpenAIClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return client;
};


/*
 * ============================================================
 * CHAT HISTORY
 * ============================================================
 */

const normalizeChatHistory = (chatHistory = []) => {
  if (!Array.isArray(chatHistory)) {
    return [];
  }

  return chatHistory
    .filter(
      (entry) =>
        entry &&
        (entry.role === 'user' || entry.role === 'assistant') &&
        typeof entry.content === 'string' &&
        entry.content.trim()
    )
    .map((entry) => ({
      role: entry.role,
      content: entry.content.trim(),
    }));
};


/*
 * ============================================================
 * RESPONSE TEXT EXTRACTION
 * ============================================================
 */

const extractResponseText = (response) => {
  if (
    typeof response?.output_text === 'string' &&
    response.output_text.trim()
  ) {
    return response.output_text.trim();
  }

  for (const item of response?.output || []) {
    if (
      item?.type !== 'message' ||
      !Array.isArray(item.content)
    ) {
      continue;
    }

    for (const contentItem of item.content) {
      if (
        contentItem?.type === 'output_text' &&
        typeof contentItem.text === 'string' &&
        contentItem.text.trim()
      ) {
        return contentItem.text.trim();
      }
    }
  }

  return '';
};


/*
 * ============================================================
 * CEBUANO LANGUAGE FALLBACK
 * ============================================================
 */

const hasCebuanoSignals = (text = '') =>
  /\b(palihug|salamat|unsa|ngano|kinsa|mao|dili|wala|nasabtan|reklamo|opisina|nalambigit|sugod|motabang|kompleto|karon|pilia|kumpirma|ako|ikaw|nahitabo|pwede|ug|og|kani|gusto|bahin|mohangyo|musumite|mo-file|fileha|pwede ba)\b/i.test(String(text || ''));

const detectLanguageFallback = (text = '') =>
  hasCebuanoSignals(text) ? 'ceb' : 'en';


/*
 * ============================================================
 * OFFICE CATALOG
 * ============================================================
 */

const getOfficeCatalogPromptSafely = async () => {
  try {
    return await buildOfficeCatalogPrompt();
  } catch (error) {
    console.warn(
      'OpenAI office catalog prompt fallback activated:',
      error.message
    );

    return '';
  }
};


/*
 * ============================================================
 * USER PROFILE
 * ============================================================
 */

const buildUserProfilePrompt = (userProfile = null) => {
  if (!userProfile || typeof userProfile !== 'object') {
    return '';
  }

  const name = String(userProfile.name || '').trim();
  const email = String(userProfile.email || '').trim();
  const contact = String(
    userProfile.contact || userProfile.phone || ''
  ).trim();

  if (!name && !email && !contact) {
    return '';
  }

  return [
    'Authenticated user context:',
    `Full Name: ${name || 'Not available'}`,
    `Email: ${email || 'Not available'}`,
    `Contact Number: ${contact || 'Not available'}`,
    'If the user selects "With identity" and a verified full name is available here, you may use it or ask the user to confirm it.',
  ].join('\n');
};


/*
 * ============================================================
 * MESSAGE ANALYSIS
 * ============================================================
 *
 * This is intentionally kept as a separate small API call.
 *
 * Its job is ONLY:
 * - detect English/Cebuano
 * - translate the latest user message into English
 *
 * The actual grievance behavior comes from I-Serve Chat v5.
 */

const MESSAGE_ANALYSIS_PROMPT = [
  'You analyze a single user message for the I-Serve Chat grievance chatbot.',
  'Return structured metadata only.',
  '- Detect whether the latest user message is primarily English or Cebuano/Bisaya.',
  '- Set detectedLanguage to "ceb" for Cebuano/Bisaya and "en" for English.',
  '- Set englishTranslation to a faithful English translation of the latest user message only.',
  '- Never translate an assistant reply.',
  '- If the latest user message is already in English, copy it exactly into englishTranslation.',
].join('\n');


/*
 * ============================================================
 * RUNTIME APPLICATION CONTEXT
 * ============================================================
 *
 * The main I-Serve behavior is in the saved Playground prompt.
 *
 * This runtime context provides information that changes from
 * request to request.
 */

const buildRuntimeContextPrompt = ({
  officeCatalogPrompt,
  userProfilePrompt,
  messageMetadata,
}) => {
  const sections = [];

  sections.push(
    [
      'APPLICATION INTEGRATION REQUIREMENTS:',
      '',
      '- Return the user-facing assistant message in the "reply" field.',
      '- Return missing complaint fields in the "missingFields" array.',
      '- Return structured grievance fields in the "grievanceData" object.',
      '- If no required field is missing, return an empty missingFields array.',
      '- Reply in the same language as the latest user message.',
      '- English input -> English reply.',
      '- Cebuano/Bisaya input -> Cebuano/Bisaya reply.',
      '- Use the latest user message analysis below as the primary language signal.',
      '- If the latest user message already provides information required by the current step, do not ask for that information again.',
      '- Never invent grievance facts to complete the form. If a field is not supported by the current grievance conversation, set it to null.',
      '- A greeting such as "hi" is not a grievance description, complaint type, submission type, college, department, date, location, or person involved.',
      '- Use authenticated user information only when the user selected or confirmed a non-anonymous/with-identity submission.',
      '- Ask only ONE question at a time.',
      '- Preserve information already provided in the conversation.',
      '- Do not restart the grievance information collection unless the user explicitly requests a restart.',
      '',
      'FINAL SUMMARY LABELS:',
      'Submission Type:',
      'Name:',
      'College:',
      'Department:',
      'Complaint Type:',
      'Description (English):',
      'Original Language Version:',
      'Location:',
      'Date:',
      '',
      'After the final summary, ask exactly:',
      'Is this information correct? (Yes/No)',
      '',
      'If no department is required, use:',
      'Department: N/A',
      '',
      'If the live routing catalog below differs from any static routing information in the saved prompt, follow the live routing catalog.',
    ].join('\n')
  );

  if (messageMetadata) {
    sections.push(
      [
        'LATEST USER MESSAGE ANALYSIS:',
        `Detected Language: ${messageMetadata.detectedLanguage}`,
        `English Translation: ${
          messageMetadata.englishTranslation || 'Not available'
        }`,
      ].join('\n')
    );
  }

  if (officeCatalogPrompt) {
    sections.push(
      [
        'LIVE OFFICE ROUTING CATALOG:',
        officeCatalogPrompt,
      ].join('\n')
    );
  }

  if (userProfilePrompt) {
    sections.push(userProfilePrompt);
  }

  return sections.join('\n\n');
};


/*
 * ============================================================
 * MESSAGE METADATA NORMALIZATION
 * ============================================================
 */

const normalizeMessageMetadata = (
  payload,
  userMessage = ''
) => {
  const fallbackLanguage =
    detectLanguageFallback(userMessage);

  const detectedLanguage =
    payload?.detectedLanguage === 'ceb'
      ? 'ceb'
      : payload?.detectedLanguage === 'en'
        ? 'en'
        : fallbackLanguage;

  let englishTranslation =
    typeof payload?.englishTranslation === 'string'
      ? payload.englishTranslation.trim()
      : '';

  if (
    !englishTranslation &&
    detectedLanguage === 'en'
  ) {
    englishTranslation =
      String(userMessage || '').trim();
  }

  return {
    detectedLanguage,
    englishTranslation,
  };
};


/*
 * ============================================================
 * ASSISTANT REPLY NORMALIZATION
 * ============================================================
 */

const normalizeAssistantReply = (
  payload,
  userMessage = '',
  detectedLanguage = null
) => {
  if (
    typeof payload?.reply === 'string' &&
    payload.reply.trim()
  ) {
    return payload.reply.trim();
  }

  const fallbackLanguage =
    detectedLanguage ||
    detectLanguageFallback(userMessage);

  return fallbackLanguage === 'ceb'
    ? SYSTEM_ERROR_REPLY_CEB
    : SYSTEM_ERROR_REPLY;
};


/*
 * ============================================================
 * MISSING FIELD NORMALIZATION
 * ============================================================
 */

const normalizeMissingFields = (payload) => {
  if (!Array.isArray(payload?.missingFields)) {
    return [];
  }

  const allowedFields = new Set([
    'submissionType',
    'name',
    'college',
    'department',
    'complaintType',
    'description',
    'location',
    'date',
    'personInvolved',
  ]);

  return [
    ...new Set(payload.missingFields),
  ].filter((field) => allowedFields.has(field));
};

/*
 * ============================================================
 * GRIEVANCE DATA NORMALIZATION
 * ============================================================
 */

const normalizeOptionalString = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();

  if (!trimmed || /^null$/i.test(trimmed) || /^not (provided|available|specified)$/i.test(trimmed)) {
    return '';
  }

  return trimmed;
};

const normalizeGrievanceData = (payload) => {
  const source =
    payload?.grievanceData &&
    typeof payload.grievanceData === 'object'
      ? payload.grievanceData
      : {};

  return {
    submissionType: normalizeOptionalString(source.submissionType),
    name: normalizeOptionalString(source.name),
    college: normalizeOptionalString(source.college),
    department: normalizeOptionalString(source.department),
    complaintType: normalizeOptionalString(source.complaintType),
    description: normalizeOptionalString(source.description),
    originalDescription: normalizeOptionalString(source.originalDescription),
    location: normalizeOptionalString(source.location),
    date: normalizeOptionalString(source.date),
    personInvolved: normalizeOptionalString(source.personInvolved),
  };
};


/*
 * ============================================================
 * STRUCTURED RESPONSE EXTRACTION
 * ============================================================
 */

const extractParsedPayload = (response) => {
  if (
    response?.output_parsed &&
    typeof response.output_parsed === 'object'
  ) {
    return response.output_parsed;
  }

  const rawText = extractResponseText(response);

  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch (parseError) {
    console.warn(
      'OpenAI structured response parse fallback failed:',
      parseError.message
    );

    return null;
  }
};


/*
 * ============================================================
 * ANALYZE USER MESSAGE
 * ============================================================
 */

const analyzeUserMessage = async (userMessage = '') => {
  const safeUserMessage =
    String(userMessage || '').trim();

  try {
    const response =
      await getOpenAIClient().responses.parse({
        model: OPENAI_MODEL,

        instructions:
          MESSAGE_ANALYSIS_PROMPT,

        input: safeUserMessage,

        text: {
          format: MESSAGE_METADATA_FORMAT,
        },
      });

    return normalizeMessageMetadata(
      extractParsedPayload(response),
      safeUserMessage
    );
  } catch (error) {
    console.warn(
      'OpenAI message analysis fallback activated:',
      error.message
    );

    return normalizeMessageMetadata(
      null,
      safeUserMessage
    );
  }
};


/*
 * ============================================================
 * MAIN I-SERVE RESPONSE
 * ============================================================
 *
 * IMPORTANT:
 *
 * The long SYSTEM_PROMPT has been removed.
 *
 * Instead, this request calls:
 *
 * Prompt ID:
 * pmpt_69d23f78ab1481978a529c61db367b3108e73f4e6a7ec72d
 *
 * Version:
 * 5
 *
 * This is your I-Serve Chat Playground prompt.
 */

const generateOpenAIResponse = async (
  userMessage,
  chatHistory = [],
  userProfile = null
) => {
  const safeUserMessage =
    String(userMessage || '').trim();

  const messageMetadata =
    await analyzeUserMessage(safeUserMessage);

  try {
    const officeCatalogPrompt =
      await getOfficeCatalogPromptSafely();

    const userProfilePrompt =
      buildUserProfilePrompt(userProfile);

    const runtimeContextPrompt =
      buildRuntimeContextPrompt({
        officeCatalogPrompt,
        userProfilePrompt,
        messageMetadata,
      });

    /*
     * The saved Playground prompt provides the main
     * I-Serve Chat behavior.
     *
     * The runtime developer message provides:
     * - live office routing
     * - authenticated user information
     * - language metadata
     * - application output requirements
     */

    const response =
      await getOpenAIClient().responses.parse({
        prompt: {
          id: ISERVE_PROMPT_ID,
          version: ISERVE_PROMPT_VERSION,
        },

        input: [
          {
            role: 'developer',
            content: runtimeContextPrompt,
          },

          ...normalizeChatHistory(chatHistory),

          {
            role: 'user',
            content: safeUserMessage,
          },
        ],

        text: {
          format: ASSISTANT_RESPONSE_FORMAT,
        },
      });

    const parsedPayload =
      extractParsedPayload(response);

    return {
      reply: normalizeAssistantReply(
        parsedPayload,
        safeUserMessage,
        messageMetadata.detectedLanguage
      ),

      missingFields:
        normalizeMissingFields(parsedPayload),

      grievanceData:
        normalizeGrievanceData(parsedPayload),

      detectedLanguage:
        messageMetadata.detectedLanguage,

      englishTranslation:
        messageMetadata.englishTranslation,
    };
  } catch (error) {
    console.error('OpenAI Error:', error);

    return {
      reply:
        messageMetadata.detectedLanguage === 'ceb'
          ? SYSTEM_ERROR_REPLY_CEB
          : SYSTEM_ERROR_REPLY,

      missingFields: [],

      grievanceData:
        normalizeGrievanceData(null),

      detectedLanguage:
        messageMetadata.detectedLanguage,

      englishTranslation:
        messageMetadata.englishTranslation,
    };
  }
};


/*
 * ============================================================
 * EXPORT
 * ============================================================
 */

module.exports = {
  generateOpenAIResponse,
};

