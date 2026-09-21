const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeStatus, shouldRestoreGraceWindow } = require('./noShowRestoreLogic');

test('normalizeStatus handles mixed-case and separator variants', () => {
  assert.equal(normalizeStatus('pending_confirmation'), 'pending_confirmation');
  assert.equal(normalizeStatus('PENDING CONFIRMATION'), 'pending_confirmation');
  assert.equal(normalizeStatus('Flagged-No-Show'), 'flagged_no_show');
});

test('pending confirmation stays protected while the admin grace window is active', () => {
  const now = new Date('2026-09-21T10:00:00Z');
  const graceUntil = new Date('2026-09-21T12:00:00Z');

  assert.equal(shouldRestoreGraceWindow('pending_confirmation', graceUntil, now), false);
});

test('grace window expires once the deadline has passed', () => {
  const now = new Date('2026-09-21T13:00:00Z');
  const graceUntil = new Date('2026-09-21T12:00:00Z');

  assert.equal(shouldRestoreGraceWindow('pending_confirmation', graceUntil, now), true);
});
