const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const express = require('express');
const {
  canReceiveCriticalAlerts, isCriticalGrievance, isActiveCriticalGrievance,
} = require('../utils/criticalAlerts');

const loadWithMocks = (path, mocks) => {
  const original = Module._load;
  Module._load = function (request, parent, ...rest) {
    if (Object.hasOwn(mocks, request)) return mocks[request];
    return original.call(this, request, parent, ...rest);
  };
  try {
    delete require.cache[require.resolve(path)];
    return require(path);
  } finally {
    Module._load = original;
  }
};

test('critical recipients require both permissions, with legacy defaults supported', () => {
  assert.equal(canReceiveCriticalAlerts({ role: 'superadmin' }), true);
  assert.equal(canReceiveCriticalAlerts({ role: 'admin' }), true);
  assert.equal(canReceiveCriticalAlerts({ role: 'admin', permissions: ['notifications.view'] }), false);
  assert.equal(canReceiveCriticalAlerts({ role: 'admin', permissions: ['grievances.view'] }), false);
  assert.equal(canReceiveCriticalAlerts({ role: 'complainant' }), false);
});

test('effective overrides and inactive cases control alert eligibility', () => {
  assert.equal(isCriticalGrievance({ priority: 'critical' }), true);
  assert.equal(isCriticalGrievance({ priority: 'urgent' }), true);
  assert.equal(isCriticalGrievance({ priority: 'medium', aiAnalysisOverride: { urgency: { label: 'Critical' } } }), true);
  assert.equal(isCriticalGrievance({ priority: 'critical', aiAnalysisOverride: { urgency: { label: 'low' } } }), false);
  for (const status of ['resolved', 'rejected']) {
    assert.equal(isActiveCriticalGrievance({ priority: 'critical', status }), false);
  }
  assert.equal(isActiveCriticalGrievance({ priority: 'critical', archived: true }), false);
  assert.equal(isActiveCriticalGrievance(null), false);
});

test('critical delivery includes authorized admins, deduplicates retries, and reopens escalations', async () => {
  const saved = new Map();
  const emitted = [];
  const service = loadWithMocks('../services/notificationService', {
    '../models/User': { find: () => ({ select: () => ({ lean: async () => [
      { _id: 'super', role: 'superadmin' },
      { _id: 'admin', role: 'admin', permissions: ['grievances.view', 'notifications.view'] },
      { _id: 'restricted', role: 'admin', permissions: [] },
    ] }) }) },
    '../models/Notification': {
      findOneAndUpdate: async (filter, update) => {
        const existing = saved.get(filter.recipient);
        const value = existing || { _id: `alert-${filter.recipient}`, ...filter, ...update.$setOnInsert };
        Object.assign(value, update.$set);
        saved.set(filter.recipient, value);
        return { value, lastErrorObject: { updatedExisting: !!existing } };
      },
    },
    '../utils/emailUtils': { hasEmailConfig: () => false },
    '../utils/systemSettings': {},
    '../utils/notificationRealtime': { emitNotificationsCreated: async (items) => emitted.push(...items) },
  });
  const grievance = { _id: 'case', referenceNumber: 'GR-123', priority: 'critical', status: 'pending', complainantName: 'Private name' };
  await service.notifyAdminsCriticalGrievanceDetected({ grievance });
  assert.deepEqual([...saved.keys()], ['super', 'admin']);
  assert.equal(emitted.length, 2);
  assert.equal(saved.get('admin').message.includes('Private name'), false);
  saved.get('admin').acknowledgedAt = new Date();
  await service.notifyAdminsCriticalGrievanceDetected({ grievance });
  assert.equal(emitted.length, 2);
  assert.ok(saved.get('admin').acknowledgedAt);
  await service.notifyAdminsCriticalGrievanceDetected({ grievance, reAlert: true });
  assert.equal(saved.get('admin').acknowledgedAt, null);
  assert.equal(emitted.length, 4);
});

test('critical emails reach authorized staff, protect details, and respect settings', async (t) => {
  const emails = [];
  let enabled = true;
  const previousUrl = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = 'https://example.test';
  t.after(() => {
    if (previousUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = previousUrl;
  });
  const staff = [
    { _id: 'super', role: 'superadmin', email: 'super@example.test' },
    { _id: 'admin', role: 'admin', email: 'admin@example.test' },
    { _id: 'restricted', role: 'admin', permissions: [], email: 'restricted@example.test' },
  ];
  let handlerFilter;
  const service = loadWithMocks('../services/notificationService', {
    '../models/User': { find: (filter) => ({ select: () => ({ lean: async () => {
      if (filter.role === 'office_handler') {
        handlerFilter = filter;
        return [{ _id: 'handler', email: 'handler@example.test' }];
      }
      return staff;
    } }) }) },
    '../models/Notification': {
      findOneAndUpdate: async (filter) => ({ value: filter, lastErrorObject: { updatedExisting: false } }),
      create: async (value) => value,
      insertMany: async (values) => values,
    },
    '../utils/emailUtils': { hasEmailConfig: () => true, sendEmail: async (email) => { emails.push(email); return { success: true }; } },
    '../utils/systemSettings': { getSystemSettingsSnapshot: async () => ({ emailNotifications: enabled }) },
    '../utils/notificationRealtime': { emitNotificationsCreated: async () => {}, emitNotificationCreated: async () => {} },
  });
  const grievance = { _id: 'case', referenceNumber: 'GR-EMAIL', priority: 'critical', status: 'pending', office: 'COT',
    complainantName: 'Secret name', description: 'Secret complaint', subject: 'Secret subject' };
  await service.notifyAdminsCriticalGrievanceDetected({ grievance });
  assert.deepEqual(emails.map((email) => email.to), ['super@example.test', 'admin@example.test']);
  await service.notifyOfficeHandlerAssignment({ grievance, assignee: { _id: 'assigned', email: 'assigned@example.test' } });
  assert.equal(emails.at(-1).to, 'assigned@example.test');
  await service.notifyOfficeHandlersGrievanceRouted({ grievance });
  assert.equal(emails.at(-1).to, 'handler@example.test');
  assert.equal(handlerFilter.status, 'active');
  assert.equal(handlerFilter.isVerified, true);
  assert.equal(handlerFilter.$or[0].office.$regex, '^COT$');
  for (const email of emails) {
    assert.ok(email.text.includes('GR-EMAIL'));
    assert.ok(email.text.includes('Critical'));
    assert.ok(email.html.includes('href="https://example.test"'));
    assert.equal(/Secret name|Secret complaint|Secret subject/.test(email.html + email.text), false);
  }
  const count = emails.length;
  await service.notifyOfficeHandlerAssignment({ grievance: { ...grievance, priority: 'low' }, assignee: { _id: 'assigned', email: 'assigned@example.test' } });
  await service.notifyOfficeHandlerAssignment({ grievance: { ...grievance, status: 'resolved' }, assignee: { _id: 'assigned', email: 'assigned@example.test' } });
  enabled = false;
  await service.notifyAdminsCriticalGrievanceDetected({ grievance });
  assert.equal(emails.length, count);
});

test('critical API retains read alerts, isolates recipients, and keeps acknowledgment separate', async (t) => {
  const notificationId = '507f1f77bcf86cd799439011';
  const fixture = [
    { _id: notificationId, read: true, seen: true, relatedGrievance: { _id: 'case', referenceNumber: 'GR-1', priority: 'critical', status: 'pending', subject: 'Private details' } },
    { _id: 'acknowledged', acknowledgedAt: new Date(), relatedGrievance: { _id: 'case-2', priority: 'critical', status: 'in_progress' } },
    { _id: 'resolved', relatedGrievance: { _id: 'case-3', priority: 'critical', status: 'resolved' } },
    { _id: 'deleted', relatedGrievance: null },
  ];
  let findFilter;
  let updateFilter;
  let update;
  const router = loadWithMocks('../routes/notifications', {
    '../models/Notification': {
      find: (filter) => {
        findFilter = filter;
        return { select: () => ({ populate: () => ({ sort: () => ({ lean: async () => fixture }) }) }) };
      },
      updateMany: async (filter, nextUpdate) => { updateFilter = filter; update = nextUpdate; },
    },
    '../middleware/auth': { authenticateToken: (req, res, next) => {
      req.user = { _id: 'current-admin', role: req.headers['x-test-role'] || 'superadmin', permissions: [] };
      next();
    } },
    '../utils/socketEvents': {},
  });
  const app = express();
  app.use(express.json());
  app.use('/notifications', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/notifications`;
  const result = await (await fetch(`${url}/critical-alerts`)).json();
  assert.equal(findFilter.recipient, 'current-admin');
  assert.equal(result.criticalCount, 2);
  assert.equal(result.notifications.length, 1);
  assert.equal(result.notifications[0]._id, notificationId);
  assert.equal(JSON.stringify(result).includes('Private details'), false);
  assert.equal((await fetch(`${url}/critical-alerts`, { headers: { 'x-test-role': 'admin' } })).status, 403);
  const ack = await fetch(`${url}/critical-alerts/acknowledge`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notificationIds: [notificationId] }),
  });
  assert.equal(ack.status, 200);
  assert.equal(updateFilter.recipient, 'current-admin');
  assert.equal(updateFilter.title, 'Critical Grievance Alert');
  assert.ok(update.$set.acknowledgedAt instanceof Date);
  assert.equal(Object.hasOwn(update.$set, 'read'), false);
  assert.equal((await fetch(`${url}/critical-alerts/acknowledge`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notificationIds: ['invalid'] }),
  })).status, 400);
});
