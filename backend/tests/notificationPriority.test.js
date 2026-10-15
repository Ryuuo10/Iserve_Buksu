const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const helpers = import('data:text/javascript;base64,' + Buffer.from(fs.readFileSync(
  path.join(__dirname, '../../frontend/src/utils/notificationPriority.js'), 'utf8'
)).toString('base64'));

test('active critical notifications stay first even when read and older', async () => {
  const { compareNotificationPriority } = await helpers;
  const critical = { _id: 'critical', read: true, createdAt: '2026-10-01', relatedGrievance: { priority: 'critical', status: 'pending' } };
  const recent = { _id: 'recent', createdAt: '2026-10-14' };
  const newerCritical = { ...critical, _id: 'newer-critical', createdAt: '2026-10-12' };
  assert.deepEqual([recent, critical, newerCritical].sort(compareNotificationPriority).map((item) => item._id),
    ['newer-critical', 'critical', 'recent']);
});

test('closed, archived, downgraded and missing cases are not pinned', async () => {
  const { isActiveCriticalNotification, compareNotificationPriority } = await helpers;
  const base = { priority: 'critical', status: 'pending' };
  for (const grievance of [null, { ...base, status: 'resolved' }, { ...base, status: 'rejected' },
    { ...base, archived: true }, { ...base, aiAnalysisOverride: { urgency: { label: 'low' } } }]) {
    assert.equal(isActiveCriticalNotification({ relatedGrievance: grievance }), false);
  }
  assert.equal(isActiveCriticalNotification({ relatedGrievance: { ...base, priority: 'low', aiAnalysisOverride: { urgency: { label: 'Critical' } } } }), true);
  assert.equal(isActiveCriticalNotification({ relatedGrievance: { ...base, priority: 'urgent' } }), true);
  const old = { createdAt: '2026-10-01', relatedGrievance: { ...base, status: 'resolved' } };
  const recent = { createdAt: '2026-10-14' };
  assert.deepEqual([old, recent].sort(compareNotificationPriority), [recent, old]);
});
