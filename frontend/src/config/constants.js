/**
 * SPEEDWAY GLOBAL CONFIGURATION
 * Centralized constants for white-label scalability.
 * REQ-NFR-01, REQ-NFR-05: Single source of truth for all business rules.
 */

// ─── SHOP CAPACITY ───────────────────────────────────────────────
export const SHOP_CONFIG = {
  MAX_BAYS: 7,                          // Max simultaneous car units
  MAX_MOTORCYCLE_BAYS: 15,              // Max simultaneous motorcycle units
  STALE_SESSION_PURGE_MINUTES: 30,      // Auto-purge unstarted sessions
  OPENING_HOUR: 7,                      // 7 AM
  CLOSING_HOUR: 21,                     // 9 PM
  FULL_DAY_THRESHOLD_MINUTES: 720,      // 12 hours
  LONG_TERM_THRESHOLD_MINUTES: 480,     // 8 hours (for occupancy logic)
};

// ─── OPERATIONAL THRESHOLDS ──────────────────────────────────────
export const THRESHOLDS = {
  NOSHOW_GRACE_MINUTES: 30,             // REQ-SYS-02: Auto-flag after 30m
  URGENT_REMINDER_MINUTES: 15,          // REQ-SYS-02: Send reminder at 15m
};

// ─── CAPACITY ALERTING ───────────────────────────────────────────
export const CAPACITY_THRESHOLD = {
  CRITICAL: 7,   // Red Alert
  HIGH: 4,       // Amber Warning
  LOW: 1         // Green Safe
};

// ─── STATUS ENUMS ────────────────────────────────────────────────
export const BOOKING_STATUSES = {
  SCHEDULED: 'scheduled',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  FLAGGED_NOSHOW: 'FLAGGED_NOSHOW',
};

export const VEHICLE_STATUSES = {
  QUEUED: 'QUEUED',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
};

// ─── UNIFIED STATUS COLORS ──────────────────────────────────────
// Extracted from AdminBookings, SchedulingGrid, CustomerBookingDetails
export const STATUS_COLORS = {
  scheduled: '#E61E2A',                 // Brand red
  confirmed: '#3b82f6',                 // Info blue
  in_progress: '#a855f7',              // Purple
  completed: '#10b981',                // Green
  cancelled: '#ef4444',                // Red
  flagged_noshow: '#ef4444',           // Red (urgent)
  queued: '#f59e0b',                   // Amber
  pending: '#f59e0b',                  // Amber
  default: '#6b7280',                  // Muted gray
};

// ─── DESIGN TOKENS ───────────────────────────────────────────────
export const COLORS = {
  BRAND: 'var(--admin-brand)',
  SUCCESS: '#10b981',
  WARNING: '#f59e0b',
  DANGER: '#ef4444',
  MUTED: '#6b7280',
  BG_CARD: 'var(--admin-card)',
  BORDER: 'var(--admin-border)'
};
