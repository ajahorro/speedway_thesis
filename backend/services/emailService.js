const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const SENDER_EMAIL = process.env.RESEND_SENDER_EMAIL || process.env.RESEND_FROM || 'Speedway AutoxMoto <bookings@yourdomain.com>';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const buildEmailShell = ({ title, eyebrow = 'SPEEDWAY DETAIL STUDIO', bodyHtml, ctaLink, ctaLabel, footerNote = 'Speedway Detail Studio | 39 Hunters ROTC, Barangay San Juan, Cainta, 1900 Rizal' }) => `
  <div style="margin: 0; padding: 0; background: #f5f5f3; font-family: Arial, Helvetica, sans-serif; color: #171717;">
    <div style="max-width: 640px; margin: 0 auto; padding: 24px 16px;">
      <div style="background: linear-gradient(135deg, #111827 0%, #1f2937 100%); border: 1px solid #d4d4d4; border-radius: 18px; overflow: hidden;">
        <div style="padding: 22px 24px 14px; background: linear-gradient(135deg, rgba(169,27,24,0.12), rgba(17,24,39,0.05)); border-bottom: 1px solid rgba(255,255,255,0.12);">
          <div style="font-size: 11px; letter-spacing: 2px; font-weight: 800; color: #fca5a5; text-transform: uppercase; margin-bottom: 8px;">${escapeHtml(eyebrow)}</div>
          <div style="font-size: 28px; line-height: 1.2; font-weight: 900; color: #f5f5f4; margin: 0;">${escapeHtml(title)}</div>
        </div>
        <div style="padding: 24px; background: #ffffff; color: #171717;">
          ${bodyHtml}
          ${ctaLink ? `<div style="text-align: center; margin: 28px 0 8px;"><a href="${escapeHtml(ctaLink)}" style="display: inline-block; background: #a91b18; color: #ffffff; text-decoration: none; padding: 14px 22px; border-radius: 999px; font-weight: 900; font-size: 12px; letter-spacing: 1px; text-transform: uppercase;">${escapeHtml(ctaLabel)}</a></div>` : ''}
        </div>
        <div style="padding: 18px 24px 26px; background: #f9fafb; color: #52525b; border-top: 1px solid #e5e7eb; font-size: 11px; line-height: 1.6; text-align: center;">
          ${escapeHtml(footerNote)}
        </div>
      </div>
    </div>
    <style>
      @media (max-width: 600px) {
        .email-shell { padding: 12px !important; }
      }
      @media (prefers-color-scheme: dark) {
        body { background: #111827 !important; }
      }
    </style>
  </div>
`;

const send = async ({ to, subject, html, attachments }) => {
  if (!resend) return { success: false, error: 'RESEND_API_KEY is not configured' };
  try {
    console.log(`[Email] Sending "${subject}" to ${to}`);
    const { data, error } = await resend.emails.send({
      from: SENDER_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(attachments?.length ? { attachments } : {})
    });
    if (error) {
      console.error('[Email] Resend rejected message:', error.message || error);
      return { success: false, error };
    }
    console.log(`[Email] Sent successfully: ${data?.id || subject}`);
    return { success: true, data };
  } catch (error) {
    console.error('[EmailService] Delivery failed:', error.message);
    return { success: false, error: error.message };
  }
};

const sendBookingConfirmationEmail = async ({ customerEmail, customerName, bookingId, serviceName, scheduledAt, totalAmount }) => send({
  to: customerEmail,
  subject: `Booking Confirmed #${bookingId} - Speedway AutoxMoto`,
  html: buildEmailShell({
    title: 'Booking Confirmed',
    eyebrow: 'SPEEDWAY DETAIL STUDIO',
    bodyHtml: `
      <p style="margin: 0 0 16px; font-size: 15px; color: #1f2937;">Hi <strong>${escapeHtml(customerName)}</strong>,</p>
      <p style="margin: 0 0 16px; font-size: 15px; color: #374151; line-height: 1.7;">Your appointment has been successfully scheduled. Here are your booking details:</p>
      <div style="background: #f5f5f4; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin: 12px 0 18px;">
        <div style="display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 10px;">
          <span style="color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;">Booking ID</span>
          <strong style="color: #111827;">#${escapeHtml(bookingId)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 10px;">
          <span style="color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;">Service</span>
          <strong style="color: #111827; text-align: right;">${escapeHtml(serviceName)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 10px;">
          <span style="color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;">Date &amp; Time</span>
          <strong style="color: #111827; text-align: right;">${escapeHtml(new Date(scheduledAt).toLocaleString())}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
          <span style="color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;">Total Amount</span>
          <strong style="color: #a91b18; text-align: right; font-size: 20px;">PHP ${escapeHtml(totalAmount)}</strong>
        </div>
      </div>
      <p style="margin: 0; font-size: 15px; color: #374151; line-height: 1.7;">You can check your booking status anytime through your customer dashboard.</p>
    `,
    ctaLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/customer/bookings`,
    ctaLabel: 'View Booking',
    footerNote: 'Speedway Detail Studio | 39 Hunters ROTC, Barangay San Juan, Cainta, 1900 Rizal'
  })
});

const sendPasswordResetEmail = async ({ customerEmail, resetLink }) => send({
  to: customerEmail,
  subject: 'Password Reset Request - Speedway AutoxMoto',
  html: buildEmailShell({
    title: 'Reset Your Password',
    eyebrow: 'ACCOUNT SECURITY',
    bodyHtml: `
      <p style="margin: 0 0 16px; font-size: 15px; color: #1f2937;">Hi there,</p>
      <p style="margin: 0 0 16px; font-size: 15px; color: #374151; line-height: 1.7;">We received a request to reset your Speedway password. Click the button below to continue and create a new one securely.</p>
      <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280; line-height: 1.6;">If you did not request this change, you can safely ignore this email and your password will remain unchanged.</p>
    `,
    ctaLink: resetLink,
    ctaLabel: 'Reset Password',
    footerNote: 'Secure access link expires in 1 hour. If you need help, contact the studio support team.'
  })
});

const sendAccountInviteEmail = async ({ customerEmail, customerName, inviteLink }) => send({
  to: customerEmail,
  subject: 'Create your Speedway customer account',
  html: buildEmailShell({
    title: 'Activate Your Account',
    eyebrow: 'WELCOME TO SPEEDWAY',
    bodyHtml: `
      <p style="margin: 0 0 16px; font-size: 15px; color: #1f2937;">Hi <strong>${escapeHtml(customerName || 'Guest')}</strong>,</p>
      <p style="margin: 0 0 16px; font-size: 15px; color: #374151; line-height: 1.7;">Your account is almost ready. Use the secure link below to confirm your email and complete your profile.</p>
      <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.6;">This invitation expires in 48 hours. Once confirmed, you can view bookings, payments, and service updates in one place.</p>
    `,
    ctaLink: inviteLink,
    ctaLabel: 'Create Account',
    footerNote: 'This invitation is valid for 48 hours. If you believe this was sent in error, please contact support.'
  })
});

const sendStatusUpdateEmail = async ({ customerEmail, customerName, bookingId, status, scheduledAt }) => send({
  to: customerEmail,
  subject: `Booking Update #${bookingId} - Speedway AutoxMoto`,
  html: buildEmailShell({
    title: 'Booking Update',
    eyebrow: 'SERVICE STATUS',
    bodyHtml: `
      <p style="margin: 0 0 16px; font-size: 15px; color: #1f2937;">Hi <strong>${escapeHtml(customerName)}</strong>,</p>
      <p style="margin: 0 0 16px; font-size: 15px; color: #374151; line-height: 1.7;">Your booking <strong>#${escapeHtml(bookingId)}</strong> is now <strong>${escapeHtml(status)}</strong>.</p>
      <div style="background: #f5f5f4; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin: 12px 0 18px;">
        <div style="display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
          <span style="color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;">Scheduled Time</span>
          <strong style="color: #111827; text-align: right;">${escapeHtml(new Date(scheduledAt).toLocaleString())}</strong>
        </div>
      </div>
      <p style="margin: 0; font-size: 15px; color: #374151; line-height: 1.7;">You can continue monitoring updates in your customer portal.</p>
    `,
    ctaLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/customer/bookings`,
    ctaLabel: 'Open Portal',
    footerNote: 'Speedway Detail Studio | 39 Hunters ROTC, Barangay San Juan, Cainta, 1900 Rizal'
  })
});

module.exports = {
  buildEmailShell,
  sendBookingConfirmationEmail,
  sendPasswordResetEmail,
  sendAccountInviteEmail,
  sendStatusUpdateEmail,
  send
};
