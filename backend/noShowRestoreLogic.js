const normalizeStatus = (value = '') => String(value || '').trim().toLowerCase().replace(/[_\s-]+/g, '_');

const shouldRestoreGraceWindow = (bookingStatus, graceUntil, now = new Date()) => {
  const normalizedStatus = normalizeStatus(bookingStatus);
  if (normalizedStatus !== 'pending_confirmation') return false;

  if (!graceUntil) return true;

  const graceDeadline = new Date(graceUntil);
  return Number.isNaN(graceDeadline.getTime()) || graceDeadline <= now;
};

module.exports = {
  normalizeStatus,
  shouldRestoreGraceWindow
};
