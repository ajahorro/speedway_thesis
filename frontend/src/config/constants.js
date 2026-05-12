/**
 * SPEEDWAY GLOBAL CONFIGURATION
 * Centralized constants for white-label scalability.
 */

export const SHOP_CONFIG = {
  MAX_BAYS: 7,
  STALE_SESSION_PURGE_MINUTES: 30,
  OPENING_HOUR: 7, // 7 AM
  CLOSING_HOUR: 21, // 9 PM
  FULL_DAY_THRESHOLD_MINUTES: 720, // 12 hours
  LONG_TERM_THRESHOLD_MINUTES: 480, // 8 hours (for occupancy logic)
};

export const CAPACITY_THRESHOLD = {
  CRITICAL: 7, // Red Alert
  HIGH: 4,     // Amber Warning
  LOW: 1       // Green Safe
};

export const COLORS = {
  BRAND: 'var(--admin-brand)',
  SUCCESS: '#10b981',
  WARNING: '#f59e0b',
  DANGER: '#ef4444',
  MUTED: '#6b7280',
  BG_CARD: 'var(--admin-card)',
  BORDER: 'var(--admin-border)'
};
