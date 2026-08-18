import { supabase } from '../lib/supabase';
import { BACKEND_URL } from '../config/api';

/**
 * notificationService.js
 * Handles customer-facing notification management.
 */

export const fetchNotifications = async (userId) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const markNotificationAsRead = async (notificationId) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) throw error;
};

export const markAllAsRead = async (userId) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;
};

export const deleteNotification = async (notificationId) => {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) throw error;
};

export const clearAllNotifications = async (userId) => {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId);

  if (error) throw error;
};

export const subscribeToNotifications = (userId, callback) => {
  return supabase
    .channel(`notifications-${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`
    }, callback)
    .subscribe();
};

export const sendBookingConfirmationEmail = async (bookingId) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/emails/booking-confirmation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId })
    });
    return await response.json();
  } catch (error) {
    console.error('[NotificationService] Booking Email Error:', error);
    return { error: error.message };
  }
};

export const sendPaymentReceiptEmail = async (bookingId, paymentId) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/emails/payment-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, paymentId })
    });
    return await response.json();
  } catch (error) {
    console.error('[NotificationService] Payment Email Error:', error);
    return { error: error.message };
  }
};

/**
 * REQ-SYS-02: Automated Status Notification Trigger
 * Calls the Supabase Edge Function to dispatch professional emails.
 */
export const sendStatusEmail = async (bookingId, newStatus, remarks = '') => {
  try {
    const { data, error } = await supabase.functions.invoke('send-status-email', {
      body: { bookingId, newStatus, remarks }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[NotificationService] Error:', error);
    return { error: error.message };
  }
};

