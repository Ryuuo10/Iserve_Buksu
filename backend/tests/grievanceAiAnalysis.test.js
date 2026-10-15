const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateModelAnalysis } = require('../services/grievanceAiAnalysis');

const prediction = () => ({
  source: 'trained_model',
  category: { label: 'Academic Issues', rawLabel: 'Academic Issues', confidence: 0.7342 },
  urgency: { label: 'medium', rawLabel: 'medium', confidence: 0.8213 },
  sentiment: { label: 'negative', rawLabel: 'negative', confidence: 0.6421 },
});

test('model probabilities are returned without fixed replacements or rounding', () => {
  const data = prediction();
  assert.equal(validateModelAnalysis(data), data);
  assert.equal(data.category.confidence, 0.7342);
  data.category.confidence = 0.55;
  assert.equal(validateModelAnalysis(data).category.confidence, 0.55);
  data.category.confidence = 0;
  assert.equal(validateModelAnalysis(data).category.confidence, 0);
});

test('rule-based and fabricated model results are rejected', () => {
  const fallback = { ...prediction(), source: 'fallback' };
  assert.throws(() => validateModelAnalysis(fallback));
  for (const rawLabel of ['fallback_rule', 'fallback_default', 'safety_override']) {
    const data = prediction();
    data.category.rawLabel = rawLabel;
    assert.throws(() => validateModelAnalysis(data));
  }
});

test('missing, non-finite, and out-of-range confidence cannot become successful analysis', () => {
  for (const confidence of [null, undefined, NaN, Infinity, -0.1, 55, '0.55']) {
    const data = prediction();
    data.urgency.confidence = confidence;
    assert.throws(() => validateModelAnalysis(data));
  }
  assert.throws(() => validateModelAnalysis(null));
  assert.throws(() => validateModelAnalysis({ ...prediction(), urgency: { label: 'unexpected', confidence: 0.8 } }));
});

test('the admin UI hides old predefined scores but preserves genuine model output', async () => {
  const { getModelAnalysisForDisplay } = await import('../../frontend/src/utils/aiAnalysis.js');
  assert.equal(getModelAnalysisForDisplay({ ...prediction(), source: 'fallback' }), null);
  const safety = prediction();
  safety.sentiment.rawLabel = 'safety_override';
  assert.equal(getModelAnalysisForDisplay(safety), null);
  const data = prediction();
  assert.equal(getModelAnalysisForDisplay(data), data);
});

test('reanalysis stores real predictions without changing routing or overrides and checks the case version', async (t) => {
  const Module = require('node:module');
  const express = require('express');
  const existing = {
    _id: '507f1f77bcf86cd799439011', __v: 3, priority: 'medium', status: 'pending',
    subject: 'Test grievance', description: 'Original complaint text', office: 'COT',
    department: 'Food Technology Department', aiAnalysisOverrideAt: new Date(),
  };
  let savedUpdate;
  let analysisError = false;
  let concurrentChange = false;
  const next = (req, res, callback) => callback();
  const mocks = {
    '../models/Grievance': {
      findById: async () => existing,
      findOneAndUpdate: async (filter, update) => {
        assert.equal(filter.__v, 3);
        if (concurrentChange) return null;
        savedUpdate = update;
        return { ...existing, ...update.$set, __v: 4 };
      },
    },
    '../middleware/auth': {
      authenticateToken: (req, res, callback) => {
        req.user = { _id: 'staff', role: req.headers['x-test-role'] || 'superadmin' };
        callback();
      },
      checkRole: () => next, requirePermission: () => next,
    },
    '../services/grievanceAiAnalysis': { analyzeGrievance: async (text) => {
      assert.ok(text.includes('Original complaint text'));
      if (analysisError) throw new Error('Model unavailable');
      return prediction();
    } },
    '../services/notificationService': {},
  };
  const original = Module._load;
  let router;
  Module._load = function (request, parent, ...rest) {
    return Object.hasOwn(mocks, request) ? mocks[request] : original.call(this, request, parent, ...rest);
  };
  try {
    router = require('../routes/adminGrievances');
  } finally {
    Module._load = original;
  }
  const app = express();
  app.use(express.json());
  app.use(router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/grievances/${existing._id}/ai-analysis`;
  const request = (version = 3, role = 'superadmin') => fetch(url, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-test-role': role },
    body: JSON.stringify({ version }),
  });
  const response = await request();
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.equal(data.aiAnalysis.category.confidence, 0.7342);
  assert.equal(data.department, existing.department);
  assert.equal(data.office, existing.office);
  assert.equal(Object.hasOwn(savedUpdate.$set, 'aiAnalysisOverride'), false);
  assert.equal(Object.hasOwn(savedUpdate.$set, 'aiAnalysisOverrideAt'), false);
  assert.equal(savedUpdate.$inc.__v, 1);
  assert.equal((await request(2)).status, 409);
  assert.equal((await request(3, 'admin')).status, 403);
  concurrentChange = true;
  assert.equal((await request()).status, 409);
  concurrentChange = false;
  analysisError = true;
  savedUpdate = null;
  assert.equal((await request()).status, 503);
  assert.equal(savedUpdate, null);
});
