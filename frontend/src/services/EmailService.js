import { BACKEND_URL } from '../config/api';

/**
 * Centralized email transport helper
 */
const postEmail = async (type, to, data) => {
  try {
    const response = await fetch(`${BACKEND_URL}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, to, data })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`[EmailService] Error sending ${type} email to ${to}:`, error);
    return { error: error.message || 'Email service unavailable' };
  }
};

export const sendBookingConfirmation = (customerEmail, bookingData) => {
  return postEmail('booking_confirmed', customerEmail, {
    date: bookingData.date,
    time: bookingData.time,
    totalPrice: bookingData.totalPrice,
    serviceName: bookingData.services || bookingData.vehicle
  });
};

export const sendStaffAssignmentNotification = (staffEmail, bookingData) => {
  return postEmail('staff_assigned', staffEmail, {
    date: bookingData.date,
    time: bookingData.time,
    vehicle: bookingData.vehicle,
    plate: bookingData.plate,
    services: bookingData.services
  });
};

export const sendStatusUpdateNotification = (customerEmail, status, bookingData) => {
  const statusTemplates = {
    'cancelled': 'booking_cancelled',
    'completed': 'booking_finished',
    'finished': 'booking_finished'
  };

  const type = statusTemplates[status];
  if (!type) {
    console.warn(`[EmailService] Skipping email for status: ${status} (No template mapped)`);
    return Promise.resolve({ success: true, message: 'Status ignored' });
  }

  const data = type === 'booking_cancelled' 
    ? { date: bookingData.date }
    : { date: bookingData.date, vehicle: bookingData.vehicle };

  return postEmail(type, customerEmail, data);
};

export const sendPaymentReceiptNotification = (customerEmail, amount, bookingData) => {
  return postEmail('payment_verified', customerEmail, {
    amount: amount,
    date: new Date().toLocaleDateString(),
    vehicle: bookingData.vehicle
  });
};

export const sendVerificationCode = (to, code) => {
  return postEmail('auth_verification', to, { code });
};
