const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const SENDER_EMAIL = process.env.RESEND_SENDER_EMAIL || process.env.RESEND_FROM || 'Speedway AutoxMoto <bookings@yourdomain.com>';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const send = async ({ to, subject, html, attachments }) => {
  if (!resend) return { success: false, error: 'RESEND_API_KEY is not configured' };
  try {
    const { data, error } = await resend.emails.send({
      from: SENDER_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(attachments?.length ? { attachments } : {})
    });
    if (error) return { success: false, error };
    return { success: true, data };
  } catch (error) {
    console.error('[EmailService] Delivery failed:', error.message);
    return { success: false, error: error.message };
  }
};

const buildInviteFooter = ({ email, firstName = '', lastName = '', phone = '', frontendUrl }) => {
  const base = frontendUrl || process.env.FRONTEND_URL || 'http://localhost:5173';
  const query = new URLSearchParams({
    invite: 'true',
    email: email || '',
    firstName: firstName || '',
    lastName: lastName || '',
    phone: phone || ''
  }).toString();
  const inviteUrl = `${base}/login?${query}`;

  return `
    <div style="margin-top: 30px; padding: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; text-align: center;">
      <h3 style="margin: 0 0 8px; color: #1e293b; font-size: 16px;">Haven't created an account yet?</h3>
      <p style="margin: 0 0 16px; color: #64748b; font-size: 13px; line-height: 1.5;">
        Save your booking history, unlock vehicle garage features, and enjoy faster check-ins!
      </p>
      <a href="${escapeHtml(inviteUrl)}" style="display: inline-block; background-color: #e11d48; color: #ffffff; padding: 10px 22px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px; letter-spacing: 0.5px;">
        Create My Account &rarr;
      </a>
    </div>
  `;
};

const sendBookingConfirmationEmail = async ({ customerEmail, customerName, bookingId, serviceName, scheduledAt, totalAmount, inviteFooterHtml = '' }) => send({
  to: customerEmail,
  subject: `Booking Confirmed #${bookingId} - Speedway AutoxMoto`,
  html: `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
      <h2 style="color: #e11d48;">Booking Confirmed!</h2>
      <p>Hi <strong>${escapeHtml(customerName)}</strong>,</p>
      <p>Your appointment has been successfully scheduled. Here are your booking details:</p>
      <ul style="list-style: none; padding: 0;">
        <li><strong>Booking ID:</strong> #${escapeHtml(bookingId)}</li>
        <li><strong>Service:</strong> ${escapeHtml(serviceName)}</li>
        <li><strong>Date &amp; Time:</strong> ${escapeHtml(new Date(scheduledAt).toLocaleString())}</li>
        <li><strong>Total Amount:</strong> PHP ${escapeHtml(totalAmount)}</li>
      </ul>
      <p>You can check your status anytime through your customer dashboard.</p>
      ${inviteFooterHtml}
      <p style="margin-top: 30px; font-size: 12px; color: #777;">Speedway AutoxMoto Detail Studio</p>
    </div>`
});

const sendPasswordResetEmail = async ({ customerEmail, resetLink }) => send({
  to: customerEmail,
  subject: 'Password Reset Request - Speedway AutoxMoto',
  html: `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Password Reset</h2>
      <p>You requested a password reset for your account. Click the button below to proceed:</p>
      <a href="${escapeHtml(resetLink)}" style="display: inline-block; background-color: #e11d48; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px;">Reset Password</a>
      <p style="margin-top: 20px; font-size: 12px; color: #777;">If you didn't request this, you can safely ignore this email.</p>
    </div>`
});

const sendStatusUpdateEmail = async ({ customerEmail, customerName, bookingId, status, scheduledAt, inviteFooterHtml = '' }) => send({
  to: customerEmail,
  subject: `Booking Update #${bookingId} - Speedway AutoxMoto`,
  html: `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
      <h2 style="color: #e11d48;">Booking Status Update</h2>
      <p>Hi <strong>${escapeHtml(customerName)}</strong>,</p>
      <p>Your booking <strong>#${escapeHtml(bookingId)}</strong> is now <strong>${escapeHtml(status)}</strong>.</p>
      <p>Scheduled time: ${escapeHtml(new Date(scheduledAt).toLocaleString())}</p>
      ${inviteFooterHtml}
      <p style="margin-top: 30px; font-size: 12px; color: #777;">Speedway AutoxMoto Detail Studio</p>
    </div>`
});

module.exports = {
  buildInviteFooter,
  sendBookingConfirmationEmail,
  sendPasswordResetEmail,
  sendStatusUpdateEmail,
  send
};
