const express = require('express');
const router = express.Router();
const dialogflow = require('@google-cloud/dialogflow');
const fs = require('fs');
const path = require('path');
const { generateOpenAIResponse } = require('../services/openaiService');

const backendRoot = path.resolve(__dirname, '..');

const resolveCredentialsPath = (credentialsPath) => {
  if (!credentialsPath) {
    return null;
  }

  if (path.isAbsolute(credentialsPath)) {
    return credentialsPath;
  }

  return path.resolve(backendRoot, credentialsPath);
};

// project id from your Dialogflow agent (can also be set via env var)
let projectId = process.env.DF_PROJECT_ID;
const credentialsPath = resolveCredentialsPath(process.env.GOOGLE_APPLICATION_CREDENTIALS);
let credentialsJson = null;
let disabledReasonCode = null;
let disabledUntil = 0;
let lastDisabledLogAt = 0;
const DISABLE_RETRY_WINDOW_MS = 5 * 60 * 1000;

// if DF_PROJECT_ID isn't provided explicitly, and we have a credentials file,
// try to infer from it.
if (!projectId && credentialsPath) {
  try {
    credentialsJson = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    if (credentialsJson && credentialsJson.project_id) {
      projectId = credentialsJson.project_id;
      console.log('inferred projectId from credentials file:', projectId);
    }
  } catch (e) {
    console.warn('unable to read project_id from credentials file', e);
  }
}

if (!projectId) {
  console.error('DF_PROJECT_ID environment variable is not set and could not be inferred');
}

// The client will automatically pick up the credentials pointed to by
// GOOGLE_APPLICATION_CREDENTIALS. Make sure the JSON key is available on the
// server and the environment variable points to it.
let sessionClient;

const ENGLISH_ONLY_FALLBACK = 'I can help you in English only. Please continue in English and tell me what you need.';
const FILE_COMPLAINT_INTENT = 'iServe-BukSU-Complaints-File_Complaint(Eng)';
const CANCEL_COMPLAINT_INTENT = 'iServe-BukSU-Complaints-Cancel_Complaint(Eng)';

const normalizeIntentName = (intentName) => {
  if (typeof intentName !== 'string') {
    return null;
  }

  return intentName.replace(/\(Ceb\)$/i, '(Eng)');
};

const hasCebuanoSignals = (text = '') => {
  const matches = text.match(/\b(palihug|salamat|unsa|ngano|kinsa|mao|dili|wala|nasabtan|reklamo|opisina|nalambigit|sugod|motabang|kompleto|karon|pilia|usba|kumpirma)\b/gi);
  if (!matches) {
    return false;
  }

  const uniqueMatches = new Set(matches.map((match) => match.toLowerCase()));
  const strongSignals = ['palihug', 'nasabtan', 'nalambigit', 'motabang', 'kumpirma', 'pilia'];

  return strongSignals.some((signal) => uniqueMatches.has(signal)) || uniqueMatches.size >= 2;
};

const getEnglishFallbackText = (intentName) => {
  if (intentName?.includes('Cancel_Complaint')) {
    return 'Your grievance filing has been cancelled. If you want to start again, say "File a new grievance".';
  }

  if (intentName?.includes('File_Complaint')) {
    return 'I can help you file a grievance. Please choose whether you want to submit anonymously or with your identity.';
  }

  return ENGLISH_ONLY_FALLBACK;
};

const sanitizeDialogflowResponse = (queryResult = {}) => {
  const rawIntentName = queryResult.intent?.displayName || null;
  const intentName = normalizeIntentName(rawIntentName);
  const fulfillmentText = queryResult.fulfillmentText || '';
  const shouldReplaceText = /\(Ceb\)$/i.test(rawIntentName || '') || hasCebuanoSignals(fulfillmentText);

  if (shouldReplaceText) {
    console.warn('Blocked Cebuano Dialogflow response', {
      rawIntentName,
      fulfillmentText,
    });
  }

  return {
    intent: intentName,
    text: shouldReplaceText ? getEnglishFallbackText(intentName) : fulfillmentText,
    parameters: queryResult.parameters,
  };
};

const normalizeMessage = (message = '') => String(message || '').toLowerCase().replace(/\s+/g, ' ').trim();

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

const deriveIntentFromMessage = (message = '') => {
  const normalized = normalizeMessage(message);

  if (['cancel', 'stop', 'start over', 'never mind', 'nevermind', 'quit'].some((keyword) => normalized.includes(keyword))) {
    return CANCEL_COMPLAINT_INTENT;
  }

  if (['file', 'report', 'grievance', 'complaint', 'submit'].some((keyword) => normalized.includes(keyword))) {
    return FILE_COMPLAINT_INTENT;
  }

  return null;
};

const buildLocalFallbackResponse = (message = '', reasonCode = 'DIALOGFLOW_UNAVAILABLE') => {
  const normalized = normalizeMessage(message);
  const isCancel = ['cancel', 'stop', 'start over', 'never mind', 'nevermind', 'quit'].some((keyword) =>
    normalized.includes(keyword)
  );
  const isFilingIntent = ['file', 'report', 'grievance', 'complaint', 'submit'].some((keyword) =>
    normalized.includes(keyword)
  );
  const isHelpIntent = ['help', 'assist', 'guide', 'how do i', 'how to'].some((keyword) =>
    normalized.includes(keyword)
  );

  if (isCancel) {
    return {
      intent: CANCEL_COMPLAINT_INTENT,
      text: 'Your grievance filing has been cancelled. If you want to start again, say "File a new grievance".',
      parameters: {},
      source: 'local_fallback',
      unavailable: true,
      reasonCode,
    };
  }

  if (isFilingIntent) {
    return {
      intent: FILE_COMPLAINT_INTENT,
      text: 'I can still help you file a grievance. Please choose whether you want to submit anonymously or with your identity.',
      parameters: {},
      source: 'local_fallback',
      unavailable: true,
      reasonCode,
    };
  }

  if (isHelpIntent) {
    return {
      intent: null,
      text: 'The chatbot service is temporarily unavailable, but I can still help with grievance filing. You can describe what happened or choose "File a new grievance".',
      parameters: {},
      source: 'local_fallback',
      unavailable: true,
      reasonCode,
    };
  }

  return {
    intent: null,
    text: 'The chatbot service is temporarily unavailable. You can still file a grievance by describing what happened or by choosing "File a new grievance".',
    parameters: {},
    source: 'local_fallback',
    unavailable: true,
    reasonCode,
  };
};

const isDialogflowAuthError = (error) =>
  error?.code === 16 ||
  error?.code === 7 ||
  /UNAUTHENTICATED|PERMISSION_DENIED|invalid authentication credentials|oauth/i.test(
    `${error?.message || ''} ${error?.details || ''}`
  );

const isTemporarilyDisabled = () => disabledReasonCode && Date.now() < disabledUntil;

const disableDialogflowTemporarily = (reasonCode) => {
  disabledReasonCode = reasonCode;
  disabledUntil = Date.now() + DISABLE_RETRY_WINDOW_MS;
};

const logDisabledState = (message) => {
  const now = Date.now();
  if (now - lastDisabledLogAt < 30000) {
    return;
  }

  lastDisabledLogAt = now;
  console.warn(message);
};

if (credentialsPath) {
  if (!fs.existsSync(credentialsPath)) {
    console.error(`Dialogflow credentials file not found at ${credentialsPath}`);
  } else {
    try {
      if (!credentialsJson) {
        credentialsJson = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      }

      sessionClient = new dialogflow.SessionsClient({
        projectId,
        keyFilename: credentialsPath,
        credentials:
          credentialsJson?.client_email && credentialsJson?.private_key
            ? {
                client_email: credentialsJson.client_email,
                private_key: credentialsJson.private_key,
              }
            : undefined,
      });
      console.log('created Dialogflow SessionsClient with keyFilename', credentialsPath);
    } catch (err) {
      console.error('failed to create dialogflow session client', err);
    }
  }
} else {
  console.error('GOOGLE_APPLICATION_CREDENTIALS not set');
}

router.post('/', async (req, res) => {
  const { message, sessionId, intentName, chatHistory = [], userProfile = null } = req.body;
  console.log(`Dialogflow hit, message="${message}", sessionId=${sessionId}, intentName=${intentName}`);

  if (!projectId) {
    console.error('DF_PROJECT_ID is missing, cannot send request');
    // OpenAI is now the primary chatbot provider, so Dialogflow config is only needed for fallback.
  }

  if (!sessionClient) {
    console.error('sessionClient not initialized');
    // OpenAI is now the primary chatbot provider, so Dialogflow client is only needed for fallback.
  }

  if (!message && !intentName) {
    console.warn('Dialogflow request missing fields');
    return res.status(400).json({ error: 'message or intentName is required' });
  }

  try {
    const sanitizedChatHistory = normalizeChatHistory(chatHistory);
    const openAIResult = await generateOpenAIResponse(message || intentName, sanitizedChatHistory, userProfile);
    const normalizedOpenAIResult =
      typeof openAIResult === 'string'
        ? {
            reply: openAIResult,
            detectedLanguage: 'en',
            englishTranslation: String(message || intentName || '').trim(),
          }
        : openAIResult;

    return res.json({
      intent: deriveIntentFromMessage(message || intentName),
      reply: normalizedOpenAIResult.reply,
      text: normalizedOpenAIResult.reply,
      missingFields: normalizedOpenAIResult.missingFields || [],
      grievanceData: normalizedOpenAIResult.grievanceData || {},
      detectedLanguage: normalizedOpenAIResult.detectedLanguage,
      englishTranslation: normalizedOpenAIResult.englishTranslation,
      parameters: {},
      source: 'openai',
    });
  } catch (openAIError) {
    console.error('OpenAI route request failed', openAIError);
  }

  // OLD (Dialogflow - kept for fallback/reference)
  if (!projectId) {
    return res.json(buildLocalFallbackResponse(message, 'DIALOGFLOW_CONFIG'));
  }

  if (!sessionClient) {
    return res.json(buildLocalFallbackResponse(message, 'DIALOGFLOW_CLIENT'));
  }

  if (isTemporarilyDisabled()) {
    logDisabledState(
      `Dialogflow is temporarily disabled until ${new Date(disabledUntil).toISOString()} due to ${disabledReasonCode}`
    );
    return res.json(buildLocalFallbackResponse(message, disabledReasonCode));
  }

  try {
    const sessionPath = sessionClient.projectAgentSessionPath(projectId, sessionId);

    let request;

    if (intentName) {
      request = {
        session: sessionPath,
        queryInput: {
          text: {
            text: message || `trigger ${intentName}`,
            languageCode: 'en-US',
          },
        },
        queryParams: {
          parameters: {
            intentTrigger: intentName,
          },
        },
      };
    } else {
      request = {
        session: sessionPath,
        queryInput: {
          text: {
            text: message,
            languageCode: 'en-US',
          },
        },
      };
    }

    // const responses = await sessionClient.detectIntent(request);
    // const result = responses[0].queryResult;
    // return res.json(sanitizeDialogflowResponse(result));
    const responses = await sessionClient.detectIntent(request);
    console.log('detectIntent returned', responses.length, 'items');
    const result = responses[0].queryResult;
    console.log('intent=', result.intent?.displayName, 'fulfillment=', result.fulfillmentText);
    res.json(sanitizeDialogflowResponse(result));
  } catch (err) {
    const authFailure = isDialogflowAuthError(err);

    if (authFailure) {
      disableDialogflowTemporarily('DIALOGFLOW_AUTH');
      console.warn(
        `Dialogflow authentication failed (code=${err?.code || 'unknown'}). ` +
        'Using local fallback responses for the next 5 minutes. ' +
        `Details: ${err?.details || err?.message || 'Authentication failed'}`
      );
      return res.json(buildLocalFallbackResponse(message, 'DIALOGFLOW_AUTH'));
    }

    console.error('Dialogflow request failed', err);
    return res.status(500).json({ error: 'Dialogflow request failed' });
  }
});

module.exports = router;
