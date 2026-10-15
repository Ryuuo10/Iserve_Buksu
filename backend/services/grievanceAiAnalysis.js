const axios = require('axios');
const { analyzeComplaint } = require('./aiPipelineClient');

const validateModelAnalysis = (analysis) => {
  if (!analysis || /fallback/i.test(String(analysis.source || ''))) {
    throw new Error('Trained AI analysis is unavailable');
  }
  for (const key of ['category', 'urgency', 'sentiment']) {
    const result = analysis[key];
    if (!result?.label || /fallback|safety_override/i.test(String(result.rawLabel || '')) ||
        typeof result.confidence !== 'number' || !Number.isFinite(result.confidence) ||
        result.confidence < 0 || result.confidence > 1) {
      throw new Error(`Trained ${key} model did not return a valid prediction and confidence`);
    }
  }
  if (!['low', 'medium', 'high', 'critical'].includes(analysis.urgency.label) ||
      !['negative', 'neutral', 'positive'].includes(analysis.sentiment.label)) {
    throw new Error('Trained AI returned an unsupported urgency or sentiment label');
  }
  return analysis;
};

const analyzeGrievance = async (text) => {
  const url = String(process.env.AI_SERVICE_URL || '').trim();
  let externalError;
  if (url) {
    try {
      const { data } = await axios.post(url, { text }, {
        timeout: Number(process.env.AI_SERVICE_TIMEOUT_MS || 60000),
      });
      return validateModelAnalysis({ ...data, source: data.source || 'external_ai_service' });
    } catch (error) {
      externalError = error;
      console.error('External AI service failed:', error.message);
    }
  }
  if (process.env.AI_PIPELINE_ENABLED === 'false') {
    throw externalError || new Error('Trained AI pipeline is disabled');
  }
  const attempts = Math.max(1, Number(process.env.AI_PIPELINE_ATTEMPTS || 1));
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return validateModelAnalysis(await analyzeComplaint(text));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};

module.exports = { analyzeGrievance, validateModelAnalysis };
