const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
require('dotenv').config();

const { normalizeStatus, shouldRestoreGraceWindow } = require('./noShowRestoreLogic');
const { Resend } = require('resend');
const { buildEmailShell, sendBookingConfirmationEmail, sendPasswordResetEmail, sendAccountInviteEmail } = require('./services/emailService');
const { processReceiptOCR } = require('./services/ocrService');
const resendClient = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const RESEND_FROM = process.env.RESEND_FROM || 'Speedway AutoxMoto <bookings@yourdomain.com>';

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Configure Multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

const PORT = process.env.PORT || 3000;

// 🔍 DEBUG: Check Environment Variables
console.log('\n' + '🔍'.repeat(20));
console.log('DEBUG: SERVICE ROLE KEY CHECK');
console.log(`KEY DEFINED: ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`);
console.log(`KEY LENGTH:  ${process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0}`);
console.log(`URL DEFINED: ${!!process.env.SUPABASE_URL}`);
console.log('🔍'.repeat(20) + '\n');

// Initialize Supabase Admin Client (Safe-guard against missing keys)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseAdmin = null;

if (supabaseUrl && supabaseKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  console.log('📦 Supabase Admin initialized.');
} else {
  console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY missing. Database-dependent features (Emails/Invites) will be disabled, but AI services will remain active.');
}

// 🛡️ DEFAULT ADMIN — Single source of truth.
/**
 * Backend Data Normalization Helper
 * Guarantees customer_name and customer.full_name are non-null strings across all client payloads.
 */
function normalizeBookingData(booking) {
  if (!booking) return booking;
  const customerName = booking.customer_name || booking.customer?.full_name || 'Customer';
  const customerObj = booking.customer || {};

  return {
    ...booking,
    customer_name: customerName,
    customer: {
      ...customerObj,
      full_name: customerObj.full_name || customerName
    }
  };
}
// Only this specific account is protected from deactivation and always shows the DEFAULT ADMIN badge.
// To change the default admin, update this ID to the new account's user ID.
const DEFAULT_ADMIN_ID = '3057c70b-7eec-4445-9a1b-68118f9c6bd0'; // testadmin961@gmail.com
console.log(`🛡️  Default Admin ID locked: ${DEFAULT_ADMIN_ID}`);

// 🔍 DEBUG: Test Simple Admin Call on Startup
(async () => {
  if (!supabaseAdmin) return;
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1 });
    if (error) throw error;
    console.log('✅ BACKEND: Service Role verification SUCCESSFUL (Supabase connection OK)');
  } catch (err) {
    console.error('❌ BACKEND: Service Role verification FAILED!');
    console.error('ERROR:', err.message);
  }
})();

const generateTemplate = (type, data) => {
  let subject = '';
  let html = '';

  switch (type) {
    case 'VERIFICATION_CODE':
      subject = 'Verify Your Speedway Account';
      html = buildEmailShell({
        title: 'Verify Your Account',
        eyebrow: 'SECURITY CHECK',
        bodyHtml: `
          <p style="margin: 0 0 16px; font-size: 15px; color: #1f2937;">Your verification code is:</p>
          <div style="font-size: 32px; font-weight: 900; letter-spacing: 5px; padding: 16px 18px; background: #f5f5f4; border-radius: 12px; color: #111827; display: inline-block; margin-bottom: 16px;">${data.otp}</div>
          <p style="margin: 0; font-size: 15px; color: #374151; line-height: 1.7;">This code expires in 10 minutes. Use it to complete your sign-in or account creation flow.</p>
        `,
        ctaLink: null,
        footerNote: 'Speedway Detail Studio | 39 Hunters ROTC, Barangay San Juan, Cainta, 1900 Rizal'
      });
      break;
    default:
      subject = 'Speedway AutoxMoto Update';
      html = `<p>New update for ${type}</p><pre>${JSON.stringify(data, null, 2)}</pre>`;
  }
  return { subject, html };
};

const formatCurrency = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value || 0));

const escapePdfText = (value = '') => String(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const buildReceiptPdfBuffer = ({ receiptNumber, customerName, bookingReference, issuedAt, paymentMethod, processedBy, customerContact, customerAddress, customerTaxId, items = [], subtotal = 0, discountAmount = 0, vatRate = 0.12 }) => {
  const safeSubtotal = Number(subtotal || 0);
  const safeDiscount = Number(discountAmount || 0);
  const vatableSales = Math.max(0, safeSubtotal - safeDiscount);
  const vatAmount = Math.max(0, vatableSales * vatRate);
  const totalDue = safeSubtotal - safeDiscount + vatAmount;
  const dateString = issuedAt ? new Date(issuedAt).toLocaleString() : new Date().toLocaleString();

  const lines = [
    'SPEEDWAY',
    'AutoxMoto Detail Studio',
    '',
    `Receipt No.: ${receiptNumber || 'AUTO'}`,
    `Issued: ${dateString}`,
    `Booking Reference: ${bookingReference || 'N/A'}`,
    `Payment Method: ${paymentMethod || 'Digital / Online Payment'}`,
    `Customer: ${customerName || 'Customer'}`,
    `Contact: ${customerContact || 'N/A'}`,
    `Address: ${customerAddress || '-'}`,
    `Processed By: ${processedBy || 'System Admin'}`,
    `Customer Tax ID: ${customerTaxId || '-'}`,
    '',
    'Vehicle / Service                          Qty   Unit Price   Line Total',
    ...items.map((item) => {
      const label = (item.vehicle || 'Vehicle Unit').substring(0, 26);
      const service = (item.service || 'Service').substring(0, 20);
      const qty = item.qty ?? 1;
      const unitPrice = Number(item.unitPrice ?? item.lineTotal ?? 0);
      const lineTotal = Number(item.lineTotal ?? item.unitPrice ?? 0);
      return `${label} ${service} ${qty} ${formatCurrency(unitPrice)} ${formatCurrency(lineTotal)}`;
    }),
    '',
    `Subtotal: ${formatCurrency(safeSubtotal)}`,
    `Discount / Promo: -${formatCurrency(safeDiscount)}`,
    `Vatable Sales: ${formatCurrency(vatableSales)}`,
    `VAT (12%): ${formatCurrency(vatAmount)}`,
    `Total Amount Due: ${formatCurrency(totalDue)}`,
    '',
    'This receipt is valid for tax and audit purposes.'
  ];

  const content = lines.map((line, index) => `BT\n/F1 11 Tf\n72 ${760 - index * 18} Td\n(${escapePdfText(line)}) Tj\nET`).join('\n');

  let pdf = '%PDF-1.4\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`
  ];

  const offsets = [0];
  objects.forEach((obj, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, 'binary');
};

const buildReceiptEmailHtml = ({ customerName, bookingReference, receiptNumber, paidAmount, paymentMethod, issuedAt, items, subtotal, discountAmount, vatAmount, totalDue }) => {
  const itemRows = (items || []).map((item) => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
        <div style="font-size: 13px; font-weight: 700; color: #111827;">${item.vehicle || 'Vehicle / Service'}</div>
        <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">${item.service || 'Service'}</div>
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #111827; font-feature-settings: 'tnum' 1; font-variant-numeric: tabular-nums;">${item.qty ?? 1}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 12px; color: #111827; font-feature-settings: 'tnum' 1; font-variant-numeric: tabular-nums;">${formatCurrency(item.unitPrice ?? item.lineTotal ?? 0)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 12px; color: #111827; font-weight: 700; font-feature-settings: 'tnum' 1; font-variant-numeric: tabular-nums;">${formatCurrency(item.lineTotal ?? item.unitPrice ?? 0)}</td>
    </tr>
  `).join('');

  return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; color: #111827;">
      <div style="background: #111827; color: #f9fafb; padding: 16px 20px; border-bottom: 1px solid #262626;">
        <div style="font-size: 18px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; text-align: center;">SPEEDWAY</div>
        <div style="font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; text-align: center; color: #d1d5db; margin-top: 6px;">AutoxMoto Detail Studio</div>
      </div>
      <div style="padding: 24px 24px 12px;">
        <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 16px;">
          <div>
            <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.12em;">Receipt No.</div>
            <div style="font-size: 14px; font-weight: 700; color: #111827; margin-top: 4px;">${receiptNumber || 'AUTO'}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.12em;">Issued</div>
            <div style="font-size: 14px; font-weight: 700; color: #111827; margin-top: 4px;">${issuedAt ? new Date(issuedAt).toLocaleString() : new Date().toLocaleString()}</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 18px; margin-bottom: 18px;">
          <div>
            <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px;">Business Details</div>
            <div style="font-size: 14px; font-weight: 700; color: #111827;">AutoxMoto Detail Studio</div>
            <div style="font-size: 12px; color: #4b5563; margin-top: 4px;">123 Auto Avenue, Mandaluyong City</div>
            <div style="font-size: 12px; color: #4b5563;">+63 917 123 4567 | hello@speedwaystudio.ph</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px;">Booking Reference</div>
            <div style="font-size: 14px; font-weight: 700; color: #111827;">${bookingReference || 'N/A'}</div>
            <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.12em; margin-top: 10px; margin-bottom: 6px;">Payment Method</div>
            <div style="font-size: 14px; font-weight: 700; color: #111827;">${paymentMethod}</div>
          </div>
        </div>

        <div style="margin-bottom: 18px;">
          <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px;">Customer</div>
          <div style="font-size: 14px; font-weight: 700; color: #111827;">${customerName}</div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
          <thead>
            <tr>
              <th style="padding: 10px 12px; background: #f9fafb; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; text-align: left; font-size: 11px; font-weight: 600; color: #4b5563; text-transform: uppercase; letter-spacing: 0.12em;">Vehicle / Service</th>
              <th style="padding: 10px 12px; background: #f9fafb; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 11px; font-weight: 600; color: #4b5563; text-transform: uppercase; letter-spacing: 0.12em;">Qty</th>
              <th style="padding: 10px 12px; background: #f9fafb; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 11px; font-weight: 600; color: #4b5563; text-transform: uppercase; letter-spacing: 0.12em;">Unit Price</th>
              <th style="padding: 10px 12px; background: #f9fafb; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 11px; font-weight: 600; color: #4b5563; text-transform: uppercase; letter-spacing: 0.12em;">Line Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>

        <div style="max-width: 260px; margin-left: auto; border-top: 2px solid #111827; padding-top: 12px;">
          <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; color: #4b5563;"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>
          <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; color: #4b5563;"><span>Discount / Promo</span><span>- ${formatCurrency(discountAmount)}</span></div>
          <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; color: #4b5563;"><span>Vatable Sales</span><span>${formatCurrency(subtotal - discountAmount)}</span></div>
          <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; color: #4b5563;"><span>VAT (12%)</span><span>${formatCurrency(vatAmount)}</span></div>
          <div style="display: flex; justify-content: space-between; padding-top: 8px; font-size: 18px; font-weight: 800; color: #111827;"><span>Total Amount Due</span><span>${formatCurrency(totalDue)}</span></div>
        </div>
      </div>
      <div style="padding: 0 24px 24px; font-size: 12px; color: #4b5563; line-height: 1.6;">
        <p style="margin: 0;">Hi ${customerName},</p>
        <p style="margin: 10px 0 0;">Thank you for your payment. Your transaction has been processed successfully and the receipt is attached below for your records.</p>
      </div>
    </div>
  `;
};

app.post('/api/emails/booking-confirmation', async (req, res) => {
  const { bookingId } = req.body;
  console.log(`📧 [EMAIL SYSTEM] DISPATCHING BOOKING CONFIRMATION: ${bookingId}`);

  try {
    // 1. Fetch full booking context
    const { data: booking, error: bError } = await supabaseAdmin
      .from('bookings')
      .select('*, booking_vehicles(*, booking_vehicle_services(*))')
      .eq('id', bookingId)
      .single();

    if (bError || !booking) throw new Error('Booking not found');

    // Fetch customer separately for reliability. Walk-in bookings may not have a profile row.
    let customer = null;
    if (booking.customer_id) {
      const { data, error: cError } = await supabaseAdmin
        .from('profiles')
        .select('full_name, email')
        .eq('id', booking.customer_id)
        .maybeSingle();

      customer = data;
      if (cError) throw new Error(cError.message || 'Customer profile lookup failed');
    }

    const customerEmail = customer?.email || booking.customer_email;
    const customerName = customer?.full_name || booking.customer_name || 'Customer';
    if (!customerEmail) throw new Error('Customer email not found for confirmation email');

    const vehicles = booking.booking_vehicles || [];
    const confirmationResult = await sendBookingConfirmationEmail({
      customerEmail,
      customerName,
      bookingId: bookingId.substring(0, 8).toUpperCase(),
      serviceName: vehicles.flatMap(vehicle => vehicle.booking_vehicle_services || []).map(service => service.service_name).join(', ') || 'Detailing service',
      scheduledAt: booking.start_datetime,
      totalAmount: booking.total_amount
    });
    if (!confirmationResult.success) throw new Error(confirmationResult.error?.message || confirmationResult.error || 'Booking confirmation email failed');
    // The legacy template below remains as a compatibility fallback only.

    const dateStr = new Date(booking.start_datetime).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const vehicleHtml = vehicles.map(v => `
      <div style="margin-bottom: 15px; padding: 10px; border-left: 4px solid #A91B18; background: #f9f9f9;">
        <strong style="text-transform: uppercase;">${v.year} ${v.brand} ${v.model}</strong> [${v.plate_number}]
        <ul style="margin: 5px 0; padding-left: 20px; font-size: 13px;">
          ${(v.booking_vehicle_services || []).map(s => `<li>${s.service_name} - ₱${s.price}</li>`).join('')}
        </ul>
      </div>
    `).join('');

    if (resendClient && !confirmationResult.success) {
      await resendClient.emails.send({
        from: RESEND_FROM,
        to: customer.email,
        subject: `BOOKING CONFIRMED: ${bookingId.substring(0, 8).toUpperCase()}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #eee; padding: 20px;">
            <h2 style="color: #A91B18; margin-top: 0;">SPEEDWAY DETAIL STUDIO</h2>
            <h3 style="text-transform: uppercase; border-bottom: 2px solid #eee; padding-bottom: 10px;">Booking Confirmation</h3>
            
            <p>Hi <strong>${customer.full_name}</strong>,</p>
            <p>Your booking has been successfully <strong>APPROVED</strong> and scheduled. We are excited to see you!</p>
            
            <div style="background: #111; color: #fff; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <div style="font-size: 12px; opacity: 0.7; text-transform: uppercase;">Scheduled For</div>
              <div style="font-size: 18px; font-weight: bold;">${dateStr}</div>
            </div>

            <h4 style="text-transform: uppercase; color: #666; font-size: 12px; margin-bottom: 10px;">Vehicle & Service Details</h4>
            ${vehicleHtml}

            <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #eee;">
              <div style="display: flex; justify-content: space-between;">
                <span>Total Amount:</span>
                <strong style="font-size: 18px; color: #A91B18;">₱${booking.total_amount}</strong>
              </div>
              <div style="font-size: 12px; color: #666; margin-top: 5px;">Payment Status: ${booking.payment_status}</div>
            </div>

            <p style="margin-top: 30px; font-size: 12px; color: #888;">
              Please arrive 15 minutes before your scheduled slot. If you need to reschedule, contact us at +1 (555) SPEEDWAY.
            </p>
          </div>
        `
      });
      console.log(`✅ Confirmation email sent to ${customer.email}`);
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('❌ Confirmation Email Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/emails/payment-receipt', async (req, res) => {
  const { bookingId, paymentId } = req.body;
  console.log(`📧 [EMAIL SYSTEM] DISPATCHING PAYMENT RECEIPT: ${paymentId} for Booking ${bookingId}`);

  try {
    const { data: booking, error: bError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    const { data: payment, error: pError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (bError || pError || !booking || !payment) throw new Error('Booking or Payment records missing');

    let customer = null;
    if (booking.customer_id) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('full_name, email, phone')
        .eq('id', booking.customer_id)
        .maybeSingle();
      customer = data;
    }

    const customerEmail = customer?.email || booking.customer_email;
    if (!customerEmail) throw new Error('Customer email not found');

    const customerName = customer?.full_name || booking.customer_name || 'Customer';
    const customerContact = customer?.phone || booking.customer_phone || booking.customer_contact || 'N/A';
    const customerAddress = booking.customer_address || 'N/A';
    const customerTaxId = booking.customer_tax_id || 'N/A';
    const receiptNumber = payment.reference_number || `INV-${String(paymentId || bookingId).slice(0, 8).toUpperCase()}`;
    const issuedAt = payment.created_at || booking.created_at;
    const subtotal = Number(payment.amount || booking.total_amount || 0);
    const discountAmount = Number(payment.discount_amount || 0);
    const vatRate = 0.12;
    const vatAmount = Math.max(0, (subtotal - discountAmount) * vatRate);
    const totalDue = subtotal - discountAmount + vatAmount;

    const items = booking.booking_vehicles?.flatMap((vehicle) => (vehicle.booking_vehicle_services || []).map((service) => ({
      vehicle: `${vehicle.brand || ''} ${vehicle.model || ''}`.trim() || 'Vehicle Unit',
      service: service.service_name || service.name || 'Service',
      qty: 1,
      unitPrice: Number(service.price || service.price_snapshot || 0),
      lineTotal: Number(service.price || service.price_snapshot || 0),
    }))) || [{
      vehicle: 'Booking Summary',
      service: 'Booking Service Summary',
      qty: 1,
      unitPrice: subtotal,
      lineTotal: subtotal,
    }];

    const receiptHtml = buildReceiptEmailHtml({
      customerName,
      bookingReference: booking.booking_id || bookingId,
      receiptNumber,
      paidAmount: subtotal,
      paymentMethod: payment.method || booking.payment_method || 'Digital / Online Payment',
      issuedAt,
      items,
      subtotal,
      discountAmount,
      vatAmount,
      totalDue,
    });

    const pdfBuffer = buildReceiptPdfBuffer({
      receiptNumber,
      customerName,
      bookingReference: booking.booking_id || bookingId,
      issuedAt,
      paymentMethod: payment.method || booking.payment_method || 'Digital / Online Payment',
      processedBy: 'System Admin',
      customerContact,
      customerAddress,
      customerTaxId,
      items,
      subtotal,
      discountAmount,
      vatRate,
    });

    const attachments = [{
      content: pdfBuffer,
      filename: `Receipt-${String(receiptNumber).replace(/\s+/g, '-').toUpperCase()}.pdf`
    }];

    if (payment.receipt_url) {
      try {
        const bucket = 'payment-receipts';
        const marker = '/payment-receipts/';
        const filePath = payment.receipt_url.includes(marker)
          ? decodeURIComponent(payment.receipt_url.split(marker)[1])
          : payment.receipt_url;

        const { data: fileData } = await supabaseAdmin.storage
          .from(bucket)
          .download(filePath);

        if (fileData) {
          const imageBuffer = Buffer.from(await fileData.arrayBuffer());
          attachments.push({
            content: imageBuffer,
            filename: `receipt_${String(paymentId || bookingId).slice(0, 8)}.png`
          });
        }
      } catch (fErr) {
        console.warn('Could not attach legacy receipt image:', fErr.message);
      }
    }

    if (resendClient) {
      await resendClient.emails.send({
        from: RESEND_FROM,
        to: customerEmail,
        subject: `OFFICIAL RECEIPT: ${String(receiptNumber).slice(0, 12).toUpperCase()}`,
        attachments,
        html: receiptHtml,
      });
      console.log(`✅ Payment receipt email sent to ${customerEmail}`);
    }

    return res.json({ success: true, attachmentName: attachments[0]?.filename || null });
  } catch (err) {
    console.error('❌ Payment Receipt Email Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/send-email', async (req, res) => {
  const { to, type, data } = req.body;

  console.log('\n' + '='.repeat(40));
  console.log(`📧 [SHADOW BACKEND] EMAIL TRIGGERED`);
  console.log(`TYPE: ${type}`);
  console.log(`TO:   ${to}`);
  if (data?.otp) {
    console.log(`🔑 VERIFICATION CODE: ${data.otp}`);
  }
  console.log('='.repeat(40) + '\n');

  try {
    const { subject, html } = generateTemplate(type, data);

    if (resendClient) {
      await resendClient.emails.send({
        from: RESEND_FROM,
        to,
        subject,
        html
      });
      console.log('✅ Email successfully delivered to inbox via Resend.');
    } else {
      console.warn('⚠️ No RESEND_API_KEY found. Logging to terminal only.');
    }

    return res.json({ success: true, message: 'Code logged to terminal and email attempted.' });
  } catch (err) {
    console.warn(`⚠️ Email delivery failed, but your code is logged above! (${err.message})`);
    return res.json({ success: true, message: 'Email delivery failed, but check your terminal for the code!', dev_mode: true });
  }
});

// 🚀 ISOLATED INVITATION SYSTEM
const crypto = require('crypto');

// 1. GENERATE INVITE
app.post('/admin/generate-invite', async (req, res) => {
  const { email, role } = req.body;

  if (!email || !['ADMIN', 'STAFF', 'CUSTOMER'].includes(role)) {
    console.error(`❌ [INVITE SYSTEM] REJECTED: Invalid email (${email}) or role (${role})`);
    return res.status(400).json({ success: false, error: 'Invalid invitation parameters' });
  }

  console.log(`🎟️ [INVITE SYSTEM] GENERATING FOR: ${email} (${role})`);

  try {
    const token = crypto.randomUUID();
    const expires_at = new Date();
    expires_at.setHours(expires_at.getHours() + 48); // 48 hour expiry

    // Store in DB
    const { error: dbError } = await supabaseAdmin
      .from('invites')
      .insert({
        email,
        token,
        role,
        expires_at: expires_at.toISOString()
      });

    if (dbError) throw dbError;

    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/accept-invite?token=${token}`;
    console.log(`🔗 Token Generated: ${token}`);

    // Send Email
    if (resendClient) {
      try {
        if (role === 'CUSTOMER') {
          await sendAccountInviteEmail({ customerEmail: email, customerName: 'Guest', inviteLink });
        } else await resendClient.emails.send({
          from: RESEND_FROM,
          to: email,
          subject: 'Speedway Administrative Invitation',
          html: buildEmailShell({
            title: 'Team Invitation',
            eyebrow: 'SPEEDWAY TEAM ACCESS',
            bodyHtml: `
              <p style="margin: 0 0 16px; font-size: 15px; color: #1f2937;">You have been invited to join the team as an <strong>${role}</strong>.</p>
              <p style="margin: 0 0 16px; font-size: 15px; color: #374151; line-height: 1.7;">Use the secure link below to activate your account and set your password. The invitation is valid for 48 hours.</p>
            `,
            ctaLink: inviteLink,
            ctaLabel: 'Confirm Email Address',
            footerNote: 'Link expires in 48 hours. If you were not expecting this invitation, please ignore it.'
          })
        });
        console.log(`✅ Invitation delivered to ${email}`);
      } catch (mailErr) {
        console.error(`⚠️ Email delivery failed: ${mailErr.message}`);
        console.log(`🔗 USE THIS LINK MANUALLY: ${inviteLink}`);
      }
    }


    return res.json({ success: true, message: 'Invite generated', inviteLink });
  } catch (err) {
    console.error(`❌ Generate Invite Failed: ${err.message}`);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. VALIDATE INVITE
app.get('/invite/validate', async (req, res) => {
  const { token } = req.query;

  try {
    const { data, error } = await supabaseAdmin
      .from('invites')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      return res.status(400).json({ success: false, error: 'Invalid or expired invitation' });
    }

    return res.json({ success: true, email: data.email, role: data.role });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Validation failed' });
  }
});

// 3. ACCEPT INVITE (Create Account)
app.post('/invite/accept', async (req, res) => {
  const { token, password, first_name, last_name } = req.body;

  console.log(`\n🎟️ [INVITE SYSTEM] ACTIVATING ACCOUNT FOR TOKEN: ${token.substring(0, 8)}...`);

  try {
    // 1. Verify token
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('invites')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .single();

    if (inviteError || !invite) {
      console.error('❌ Token Validation Failed:', inviteError?.message || 'Token not found or already used');
      throw new Error('Invalid or used invitation token');
    }

    console.log(`✅ Token valid for: ${invite.email} (${invite.role})`);

    // 2. Create User in Auth
    console.log(`⏳ Creating user in Supabase Auth...`);
    let userId;
    const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: invite.email,
      password: password,
      email_confirm: true,
      user_metadata: { first_name, last_name, role: invite.role }
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        console.log(`ℹ️ User already exists in Auth, searching for existing ID...`);
        const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = listData.users.find(u => u.email === invite.email);
        if (existingUser) {
          userId = existingUser.id;
          console.log(`✅ Found existing user ID: ${userId}`);
        } else {
          throw new Error('User reported as registered but not found in directory');
        }
      } else {
        console.error('❌ Supabase Auth Creation Failed:', authError.message);
        throw authError;
      }
    } else {
      userId = userData.user.id;
      console.log(`✅ Auth user created: ${userId}`);
    }

    // 3. Create Profile Row
    console.log(`⏳ Inserting into profiles table for ID: ${userId} with role: ${invite.role}...`);
    const fName = first_name?.trim() || 'Staff';
    const lName = last_name?.trim() || 'Member';
    const fullName = `${fName} ${lName}`.trim();

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        email: invite.email,
        first_name: fName,
        last_name: lName,
        full_name: fullName,
        role: invite.role,
        is_active: true,
        updated_at: new Date().toISOString()
      });

    if (profileError) {
      console.error('❌ Profile Insertion Failed:', profileError.message);
      // We don't delete the auth user here to avoid data loss, 
      // but we throw so the user knows it failed.
      throw profileError;
    }

    // 4. Mark invite as used
    const { error: updateError } = await supabaseAdmin
      .from('invites')
      .update({ used: true })
      .eq('id', invite.id);

    if (updateError) console.warn('⚠️ Could not mark invite as used:', updateError.message);

    console.log(`🎉 SUCCESS: Account activated for ${invite.email}`);
    return res.json({ success: true, message: 'Account activated successfully', role: invite.role });

  } catch (err) {
    console.error(`❌ Activation Final Error: ${err.message}`);
    return res.status(500).json({ success: false, error: err.message });
  }
});




// 🚀 CUSTOMER REGISTRATION SYSTEM (RESEND INTEGRATED)
app.post('/customer/register', async (req, res) => {
  const { email, password, firstName, lastName, phone } = req.body;
  console.log(`\n🏎️ [CUSTOMER REGISTRATION] STARTING FLOW FOR: ${email}`);

  try {
    // 1. Use generateLink so Supabase DOES NOT send its default SMTP email
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      data: {
        first_name: firstName,
        last_name: lastName,
        phone_number: phone,
        role: 'CUSTOMER'
      }
    });
    // For development, we can automatically confirm if needed, 
    // but the directive asks to toggle it OFF. 
    // generating a link is one way, but createUser is better if we want NO email.

    if (error) {
      console.error('❌ Supabase Generate Link Error:', error.message);
      return res.status(400).json({ success: false, error: error.message });
    }

    const confirmLink = data.properties?.action_link;
    if (!confirmLink) {
      throw new Error('Failed to generate action link from Supabase');
    }

    // 2. Dispatch via Resend
    if (!resendClient) {
      throw new Error('RESEND_API_KEY is not configured or Resend is not initialized');
    }

    const emailResponse = await resendClient.emails.send({
      from: RESEND_FROM,
      to: email,
      subject: 'WELCOME TO THE FLEET',
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #eee;">
          <h2 style="color: #A91B18;">SPEEDWAY DETAIL STUDIO</h2>
          <h3 style="margin-top: 0; text-transform: uppercase;">WELCOME TO THE FLEET</h3>
          <p>Hi ${firstName},</p>
          <p>Thank you for creating an account with Speedway Detail Studio. Please confirm your email address to activate your customer portal.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${confirmLink}" style="background-color: #A91B18; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">CONFIRM EMAIL ADDRESS</a>
          </div>
          <p style="font-size: 11px; color: #888;">If you did not request this, please ignore this email.</p>
        </div>
      `
    });

    console.log('📧 [Resend] Response:', JSON.stringify(emailResponse, null, 2));

    if (emailResponse.error) {
      console.error(`❌ Resend Error: ${emailResponse.error.message}`);
    } else {
      console.log(`✅ Customer welcome email delivered to ${email}`);
    }
    return res.json({ success: true, message: 'Registration email sent' });

  } catch (err) {
    console.error(`❌ Registration Error: ${err.message}`);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 🤖 REQ-SYS-01: AI-Assisted OCR Verification
 * Uses Gemini for high-fidelity receipt auditing
 */
app.post('/api/ocr/verify-receipt', upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No receipt image uploaded' });
    }

    console.log(`🤖 [AI OCR] SCANNING RECEIPT: ${req.file.originalname} (${req.file.size} bytes)`);

    const ocrResult = await processReceiptOCR(req.file.buffer, req.file.mimetype || 'image/jpeg');
    const extractedData = {
      ...ocrResult,
      referenceNo: ocrResult.referenceNumber,
      date: ocrResult.timestamp,
      isReceipt: ocrResult.isValidReceipt
    };

    console.log(`✅ [AI OCR] EXTRACTION SUCCESSFUL:`, extractedData);

    // 🛡️ FINANCIAL INTEGRITY GUARD: Comparison Logic
    // Clean amount string if AI included '₱' or commas
    const rawAmountString = String(extractedData.amount || 0).replace(/[^0-9.]/g, '');
    const extractedAmount = parseFloat(rawAmountString) || 0;
    const requiredAmount = parseFloat(req.body.requiredAmount) || 0;
    const bookingId = req.body.bookingId;
    const paymentId = req.body.paymentId;
    const referenceNo = String(extractedData.referenceNo || '').trim();

    // Check for mismatch (handling minor precision differences)
    const isAmountMatch = Math.abs(extractedAmount - requiredAmount) < 1.0;

    // A payment reference is single-use. Check this before accepting the
    // receipt so the same transfer cannot be attached to another booking.
    let isDuplicate = false;
    if (referenceNo && supabaseAdmin) {
      let duplicateQuery = supabaseAdmin
        .from('payments')
        .select('id')
        .eq('reference_number', referenceNo)
        .limit(1);

      // A rescanned existing payment must not be considered a duplicate of
      // itself. Initial booking scans have no payment ID yet.
      if (paymentId) duplicateQuery = duplicateQuery.neq('id', paymentId);

      const { data: existingPayment, error: duplicateCheckError } = await duplicateQuery.maybeSingle();
      if (duplicateCheckError) {
        throw new Error(`REFERENCE_CHECK_FAILED: ${duplicateCheckError.message}`);
      }
      isDuplicate = Boolean(existingPayment);
    }

    // Duplicates are rejected immediately; amount or receipt-validity issues
    // remain available for staff review rather than being silently accepted.
    const finalStatus = isDuplicate
      ? 'REJECTED_DUPLICATE'
      : (!isAmountMatch || !extractedData.isReceipt ? 'Flagged for Review' : 'Confirmed');

    console.log(`🔍 [AUDIT] Comparison: Extracted ₱${extractedAmount} vs Required ₱${requiredAmount}`);
    console.log(`📊 [AUDIT] Result: amountMatch=${isAmountMatch}; duplicate=${isDuplicate} -> Status: ${finalStatus}`);

    // Persist booking and payment OCR data atomically after the booking exists.
    if (bookingId && bookingId !== 'PENDING' && typeof supabaseAdmin !== 'undefined') {
      if (!paymentId) {
        return res.status(500).json({
          success: false,
          error: 'OCR_PERSISTENCE_FAILED: Payment ID is required for persistence.'
        });
      }

      const { error: persistenceError } = await supabaseAdmin.rpc('persist_ocr_result', {
        p_booking_id: bookingId,
        p_payment_id: paymentId,
        p_detected_amount: extractedAmount,
        p_detected_ref: referenceNo || null,
        p_payment_status: finalStatus,
        p_ocr_metadata: {
          ...extractedData,
          requiredAmount,
          isAmountMatch,
          isDuplicate,
          auditedAt: new Date().toISOString()
        }
      });

      if (persistenceError) {
        console.error('⚠️ Atomic OCR persistence failed:', persistenceError.message);
        return res.status(500).json({
          success: false,
          error: 'OCR_PERSISTENCE_FAILED: Could not save detected data.'
        });
      }

      // Record in Master Audit Log
      try {
        await supabaseAdmin.from('audit_logs').insert({
          booking_id: bookingId,
          action_type: 'AI_VERIFICATION_COMPLETE',
          actor_name: 'AI_AUDITOR',
          actor_role: 'SYSTEM',
          details: `AI extraction complete. Reference: ${referenceNo || 'N/A'}. Amount: ₱${extractedAmount}. Amount match: ${isAmountMatch}. Duplicate: ${isDuplicate}.`
        });
      } catch (logErr) {
        console.warn('⚠️ Audit logging failed, but booking was updated.');
      }
    } else {
      console.log('ℹ️ [AI OCR] Booking is in PENDING state. Returning extraction results to frontend for submission.');
    }

    return res.json({
      success: true,
      status: finalStatus,
      isAmountMatch,
      // Retain the old property until all existing frontend consumers have
      // migrated to isAmountMatch.
      isMatch: isAmountMatch,
      isDuplicate,
      data: {
        ...extractedData,
        amount: extractedAmount
      }
    });

  } catch (error) {
    console.error('❌ [AI OCR Error]:', error);
    return res.status(500).json({
      success: false,
      error: `AI OCR failed: ${error.message}`
    });
  }
});

/**
 * 🛡️ REQ-ADM-12: Simulated AI Audit for Admin Dashboard
 * Provides an immediate, reliable 'Audit Simulation' for thesis defense.
 */
/**
 * 🛡️ REQ-NFR-31: Password Verification Challenge
 * Allows frontend to verify current password before sensitive updates
 */
app.post('/api/auth/verify-password', async (req, res) => {
  const { email, password } = req.body;
  if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Admin service unavailable' });
  console.log(`🔐 [AUTH] PASSWORD CHALLENGE FOR: ${email}`);

  try {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
    if (error) {
      return res.status(401).json({ success: false, error: 'Invalid current password' });
    }
    return res.json({ success: true, message: 'Identity verified' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Verification system error' });
  }
});

/**
 * 📧 REQ-CST-13: Backend-Relayed Password Recovery
 * Generates a secure Supabase recovery link and delivers it via Resend
 * with a branded email template — bypasses unreliable Supabase SMTP.
 */
app.post('/api/auth/recover-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, error: 'Email is required' });
  if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Admin service unavailable' });
  console.log(`🔑 [AUTH] PASSWORD RECOVERY INITIATED: ${email}`);

  try {
    // Generate secure OTP recovery link via Supabase Admin
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
    });

    if (linkError) throw linkError;

    const recoveryUrl = linkData?.properties?.action_link;
    if (!recoveryUrl) throw new Error('Failed to generate recovery link');

    const resetResult = await sendPasswordResetEmail({ customerEmail: email, resetLink: recoveryUrl });
    if (!resetResult.success) throw new Error(resetResult.error?.message || resetResult.error || 'Password reset email failed');
    // The legacy template below remains as a compatibility fallback only.

    if (resendClient && !resetResult.success) {
      await resendClient.emails.send({
        from: RESEND_FROM,
        to: email,
        subject: 'Reset Your Speedway Password',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #eee; padding: 30px; color: #333;">
            <h2 style="color: #A91B18; margin-top: 0; font-size: 1.5rem; letter-spacing: 1px;">SPEEDWAY DETAIL STUDIO</h2>
            <h3 style="text-transform: uppercase; border-bottom: 2px solid #eee; padding-bottom: 10px; font-size: 1rem;">Password Reset Request</h3>
            <p>We received a request to reset the password for your account.</p>
            <p>Click the button below to set a new password. This link is valid for <strong>1 hour</strong>.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${recoveryUrl}" style="background-color: #A91B18; color: white; padding: 14px 28px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block; letter-spacing: 1px; text-transform: uppercase;">
                RESET PASSWORD
              </a>
            </div>
            <p style="font-size: 12px; color: #888;">If you did not request this, you can safely ignore this email. Your password will remain unchanged.</p>
            <div style="margin-top: 40px; text-align: center; font-size: 11px; color: #aaa;">
              Speedway Detail Studio | 39 Hunters ROTC, Barangay San Juan, Cainta, 1900 Rizal
            </div>
          </div>`
      });
      console.log(`✅ [AUTH] Recovery email sent to ${email} via Resend`);
    } else {
      console.log(`🔗 [DEV] Recovery link for ${email}: ${recoveryUrl}`);
    }

    return res.json({ success: true, message: 'Recovery email sent' });
  } catch (err) {
    console.error('❌ Password Recovery Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});


/**
 * 🛡️ REQ-CST-12: Double-Step Email Change
 * Sends verification token to OLD email address before authorizing change
 */
app.post('/api/auth/request-email-change', async (req, res) => {
  const { userId, oldEmail, newEmail } = req.body;
  console.log(`📧 [AUTH] EMAIL CHANGE REQUEST: ${oldEmail} -> ${newEmail}`);

  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in profiles metadata temporarily (In a real system, use a dedicated table)
    const { error: dbError } = await supabaseAdmin
      .from('profiles')
      .update({
        email_change_temp: { newEmail, otp, expires: new Date(Date.now() + 15 * 60000).toISOString() }
      })
      .eq('id', userId);

    if (dbError) throw dbError;

    // Dispatch OTP to OLD email
    if (resendClient) {
      await resendClient.emails.send({
        from: RESEND_FROM,
        to: oldEmail,
        subject: 'Speedway: Authorize Email Change',
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #A91B18;">SPEEDWAY SECURITY</h2>
            <p>You requested to change your account email to <strong>${newEmail}</strong>.</p>
            <p>Enter the following authorization code to confirm this change:</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; padding: 10px; background: #f4f4f4; border-radius: 5px; display: inline-block;">
              ${otp}
            </div>
            <p>If you did not request this, please change your password immediately.</p>
          </div>`
      });
    }

    console.log(`🔑 Verification code for ${oldEmail}: ${otp}`);
    return res.json({ success: true, message: 'Verification code sent to current email' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/confirm-email-change', async (req, res) => {
  const { userId, otp } = req.body;

  try {
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('email_change_temp')
      .eq('id', userId)
      .single();

    if (fetchError || !profile.email_change_temp) {
      return res.status(400).json({ success: false, error: 'No active email change request' });
    }

    const { newEmail, otp: storedOtp, expires } = profile.email_change_temp;

    if (new Date() > new Date(expires)) {
      return res.status(400).json({ success: false, error: 'Code expired' });
    }

    if (otp !== storedOtp) {
      return res.status(400).json({ success: false, error: 'Invalid authorization code' });
    }

    // Update Email in Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, { email: newEmail });
    if (authError) throw authError;

    // Update Email in Profiles Table
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ email: newEmail, email_change_temp: null })
      .eq('id', userId);

    if (profileError) throw profileError;

    return res.json({ success: true, message: 'Email updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 📋 REQ-ADM-01: Fetch All Profiles (Service Role — bypasses RLS)
 * Also returns the DEFAULT_ADMIN_ID so the frontend can badge the correct account.
 */
app.get('/api/admin/profiles', async (req, res) => {
  console.log('📋 [ADMIN] Fetching all profiles...');
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('role', { ascending: true })
      .order('full_name');

    if (error) throw error;
    // Include defaultAdminId so frontend knows which account is protected
    return res.json({ success: true, data, defaultAdminId: DEFAULT_ADMIN_ID });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 🚫 REQ-ADM-02: Revoke Staff/Admin Access (Service Role — bypasses RLS)
 * Downgrades a STAFF or ADMIN account to CUSTOMER role.
 * The Default Admin guard is enforced here too.
 */
app.post('/api/admin/revoke-access', async (req, res) => {
  const { memberId } = req.body;
  console.log(`🚫 [ADMIN] REVOKE ACCESS REQUEST for: ${memberId}`);

  try {
    // Check role first — cannot revoke an ADMIN account
    const { data: profile, error: checkErr } = await supabaseAdmin
      .from('profiles')
      .select('role, email, full_name')
      .eq('id', memberId)
      .single();

    if (checkErr) throw checkErr;

    // 🛡️ DEFAULT ADMIN GUARD: Only the specific DEFAULT_ADMIN_ID is protected.
    // Regular admins (non-default) can be deactivated normally.
    if (memberId === DEFAULT_ADMIN_ID) {
      console.warn(`🚫 [ADMIN] BLOCKED: Attempted revoke of Default Admin (${profile.email})`);
      return res.status(403).json({
        success: false,
        error: 'The Default Admin account cannot be deactivated.'
      });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ role: 'CUSTOMER' })
      .eq('id', memberId);

    if (error) throw error;

    await supabaseAdmin.from('audit_logs').insert({
      actor_name: 'ADMIN',
      actor_role: 'ADMIN',
      action_type: 'REVOKE_ACCESS',
      details: `Account access revoked for ${profile.full_name} (${profile.email}). Role downgraded to CUSTOMER.`
    });

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 📣 REQ-ADM-13: Global Broadcast (Service Role — bypasses RLS)
 * Inserts a notification for every profile and logs the action in audit logs.
 */
app.post('/api/admin/broadcast', async (req, res) => {
  const { message, actorEmail } = req.body;
  console.log(`📣 [ADMIN] Global broadcast request: "${message}" from ${actorEmail}`);

  try {
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message cannot be empty.' });
    }

    // Step 1: Fetch active profiles (bypasses RLS)
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name')
      .eq('is_active', true);

    if (profileError) throw profileError;

    if (!profiles || profiles.length === 0) {
      return res.status(404).json({ success: false, error: 'No active profiles found to broadcast to.' });
    }

    // Step 2: Prepare and insert in-app notification for each active profile
    const notifications = profiles.map(p => ({
      user_id: p.id,
      title: 'System Announcement 📣',
      notification_type: 'ANNOUNCEMENT',
      message: message.trim(),
      is_read: false
    }));

    const { error: insertError } = await supabaseAdmin
      .from('notifications')
      .insert(notifications);

    if (insertError) throw insertError;

    // Step 3: Log to audit trail
    const { error: auditError } = await supabaseAdmin
      .from('audit_logs')
      .insert({
        action_type: 'BROADCAST_SENT',
        actor_name: actorEmail || 'SYSTEM',
        actor_role: 'ADMIN',
        details: `Global broadcast transmitted to ${profiles.length} users. Message: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`,
        created_at: new Date().toISOString()
      });

    if (auditError) console.error('Audit Log Error (broadcast):', auditError);

    // Step 4: NON-BLOCKING ASYNC EMAIL BATCH DISPATCH (Resend API)
    // Runs in setImmediate queue so HTTP response returns under 500ms without blocking UI execution
    if (resendClient) {
      setImmediate(async () => {
        for (const p of profiles) {
          if (p.email) {
            try {
              await resendClient.emails.send({
                from: RESEND_FROM,
                to: [p.email],
                subject: 'System Announcement 📣',
                html: `<div style="font-family: sans-serif; padding: 20px; background: #0A0B0D; color: #ffffff;">
                  <h2 style="color: #E61E2A;">Speedway System Announcement</h2>
                  <p style="font-size: 16px; color: #e5e7eb;">${message.trim()}</p>
                  <hr style="border: none; border-top: 1px solid #374151; margin: 20px 0;" />
                  <p style="font-size: 12px; color: #9ca3af;">This is an automated operational signal from Speedway Admin Command Center.</p>
                </div>`
              });
              await new Promise(r => setTimeout(r, 100)); // rate limiting buffer
            } catch (emailErr) {
              console.error(`[BROADCAST ASYNC EMAIL ERROR] ${p.email}:`, emailErr.message);
            }
          }
        }
      });
    }

    return res.json({ success: true, receiversCount: profiles.length });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ⏱️ Staff Shift Toggle Endpoint
 * Updates staff attendance availability and clock-in timestamp in database (bypasses RLS).
 * Does NOT send emails or notifications; simply updates staff status.
 */
app.post('/api/staff/toggle-shift', async (req, res) => {
  const { userId, newStatus } = req.body;
  console.log(`⏱️ [STAFF] Shift toggle request: userId=${userId}, newStatus=${newStatus}`);

  try {
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required.' });
    }

    const timestamp = newStatus ? new Date().toISOString() : null;

    // First attempt: update both is_clocked_in and clock_in_timestamp
    let { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        is_clocked_in: Boolean(newStatus),
        clock_in_timestamp: timestamp
      })
      .eq('id', userId)
      .select()
      .single();

    // Fallback if clock_in_timestamp column is not yet in schema cache
    if (updateError && (updateError.code === 'PGRST204' || updateError.message?.includes('clock_in_timestamp'))) {
      console.warn('⚠️ clock_in_timestamp column missing, falling back to is_clocked_in update');
      const fallbackResult = await supabaseAdmin
        .from('profiles')
        .update({
          is_clocked_in: Boolean(newStatus)
        })
        .eq('id', userId)
        .select()
        .single();

      if (fallbackResult.error) throw fallbackResult.error;
      updatedProfile = fallbackResult.data;
    } else if (updateError) {
      throw updateError;
    }

    // Record shift event in Audit Log
    await supabaseAdmin.from('audit_logs').insert({
      actor_name: updatedProfile?.email || updatedProfile?.full_name || 'Staff',
      actor_role: 'STAFF',
      details: `Technician ${updatedProfile?.full_name || userId} ${newStatus ? 'CLOCKED IN (ON DUTY)' : 'CLOCKED OUT (OFF DUTY)'}.`,
      created_at: new Date().toISOString()
    });

    return res.json({ success: true, profile: updatedProfile });
  } catch (err) {
    console.error('Shift Toggle Backend Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ⚙️ Staff Preferences Relay Endpoint
 * Safely updates user notification preferences on profiles table.
 * Gracefully handles missing database columns without throwing 400 Bad Request errors.
 */
app.post('/api/staff/update-preferences', async (req, res) => {
  const { userId, push_notifications_enabled } = req.body;
  console.log(`⚙️ [STAFF] Preference update request: userId=${userId}, pushEnabled=${push_notifications_enabled}`);

  try {
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required.' });
    }

    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        push_notifications_enabled: Boolean(push_notifications_enabled)
      })
      .eq('id', userId)
      .select()
      .maybeSingle();

    if (updateError && (updateError.code === 'PGRST204' || updateError.code === '42703' || updateError.message?.includes('does not exist'))) {
      console.warn('⚠️ push_notifications_enabled column missing from DB schema. Preference toggle completed in soft mode.');
      return res.json({ success: true, warning: 'Column missing from schema cache' });
    } else if (updateError) {
      throw updateError;
    }

    return res.json({ success: true, profile: updatedProfile });
  } catch (err) {
    console.error('Preference Update Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 🛡️ REQ-ADM-14: Account Deactivation (15-Day Grace Period)
 * Marks account as INACTIVE instead of deleting immediately.
 */
app.post('/api/auth/deactivate-account', async (req, res) => {
  const { userId } = req.body;
  console.log(`⚠️ [AUTH] DEACTIVATION REQUEST: ${userId}`);

  try {
    // 🛡️ DEFAULT ADMIN GUARD: Fetch profile first to check role.
    // ADMIN accounts can NEVER be deactivated — this is enforced server-side
    // regardless of what the frontend sends.
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, email')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    // 🛡️ DEFAULT ADMIN GUARD: Only the specific DEFAULT_ADMIN_ID is protected.
    // Regular admins can self-deactivate via the customer profile page.
    if (userId === DEFAULT_ADMIN_ID) {
      console.warn(`🚫 [AUTH] BLOCKED: Attempted deactivation of Default Admin (${profile.email})`);
      return res.status(403).json({
        success: false,
        error: 'The Default Admin account cannot be deactivated.'
      });
    }

    const deactivatedAt = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        is_active: false,
        deactivated_at: deactivatedAt
      })
      .eq('id', userId);

    if (error) throw error;

    // Record in Audit Log
    await supabaseAdmin.from('audit_logs').insert({
      actor_name: 'SYSTEM',
      actor_role: 'SECURITY',
      action_type: 'ACCOUNT_DEACTIVATION',
      details: `User ${userId} initiated deactivation. Scheduled for deletion in 15 days.`
    });

    return res.json({ success: true, message: 'Account deactivated. You have 15 days to recover it.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 🔄 REQ-CST-08: Transaction Reversal & Cancellation Loop
 * Updates booking and payment status for refund processing
 */
app.post('/api/bookings/cancel', async (req, res) => {
  const { bookingId, reason } = req.body;
  console.log(`🌀 [REVERSAL] CANCELLATION REQUESTED: ${bookingId}`);

  try {
    // 1. Update Booking Status
    const { error: bookingError } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'CANCELLED',
        staff_id: null,
        bay_id: null,
        cancellation_reason: reason,
        refund_status: 'QUEUED',
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    if (bookingError) throw bookingError;

    // 2. Update Payment Status to REFUND_PENDING
    const { error: paymentError } = await supabaseAdmin
      .from('payments')
      .update({ status: 'REFUND_PENDING' })
      .eq('booking_id', bookingId);

    if (paymentError) {
      console.warn('⚠️ Payment record not found or update failed, continuing cancellation flow.');
    }

    // 3. Record in Audit Log
    await supabaseAdmin.from('audit_logs').insert({
      booking_id: bookingId,
      action_type: 'BOOKING_CANCELLED',
      actor_name: 'CUSTOMER',
      actor_role: 'USER',
      details: `Booking cancelled. Reason: ${reason}`
    });

    return res.json({ success: true, message: 'Booking cancelled and refund request queued.' });
  } catch (err) {
    console.error('❌ Cancellation Failed:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/admin/verify-payment-ocr', async (req, res) => {
  const { receiptUrl } = req.body;
  try {
    if (!receiptUrl) throw new Error('Receipt URL is required');
    const receiptResponse = await fetch(receiptUrl);
    if (!receiptResponse.ok) throw new Error(`Receipt download failed with ${receiptResponse.status}`);

    const receiptBuffer = Buffer.from(await receiptResponse.arrayBuffer());
    const ocrResult = await processReceiptOCR(receiptBuffer, receiptResponse.headers.get('content-type') || 'image/jpeg');
    const extractedAmount = Number(ocrResult.amount || 0);
    const requiredAmount = Number(req.body.requiredAmount || 0);

    return res.json({
      success: true,
      status: requiredAmount > 0 && Math.abs(extractedAmount - requiredAmount) >= 1 ? 'Flagged for Review' : 'Confirmed',
      isMatch: requiredAmount <= 0 || Math.abs(extractedAmount - requiredAmount) < 1,
      data: {
        ...ocrResult,
        referenceNumber: ocrResult.referenceNumber,
        amount: extractedAmount
      }
    });
  } catch (err) {
    console.error('❌ Admin OCR Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 🛡️ REQ-NFR-14: Secure Receipt Access (Backend Verification Lock)
 * Only returns receipt data if the transaction status is exactly 'PAID'.
 */
app.get('/api/bookings/:id/receipt', async (req, res) => {
  const { id } = req.params;
  console.log(`🛡️ [SECURITY] RECEIPT REQUESTED: ${id}`);

  try {
    // Fetch booking and associated payments
    const { data: booking, error: bError } = await supabaseAdmin
      .from('bookings')
      .select('*, payments(*)')
      .eq('id', id)
      .single();

    if (bError || !booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    // SECURITY CHECK: Ensure at least one payment is officially 'PAID'
    const isVerified = (booking.payments || []).some(p => p.status === 'PAID');

    if (!isVerified) {
      console.warn(`🛑 [SECURITY] BLOCKED: Provisional receipt request for unpaid booking ${id}`);
      return res.status(403).json({
        success: false,
        error: 'ACCESS DENIED: Official receipt is locked until payment is verified by Admin.',
        provisional: true
      });
    }

    console.log(`✅ [SECURITY] GRANTED: Official receipt data released for ${id}`);
    return res.json({ success: true, data: booking });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal security engine error' });
  }
});

/**
 * 🚗 REQ-CST-10: Silent Garage Sync (Backend)
 * Bypasses RLS to ensure customer vehicles are always synchronized to their virtual garage.
 */
app.post('/api/garage/sync', async (req, res) => {
  const { customerId, vehicle } = req.body;
  console.log(`🚗 [GARAGE] SYNCING VEHICLE: ${vehicle.plateNumber} for user ${customerId}`);

  if (!supabaseAdmin) return res.status(503).json({ error: 'Database admin service unavailable' });

  try {
    const plate = (vehicle.plateNumber || '').toUpperCase();

    // 1. Check if vehicle exists in garage
    const { data: existing } = await supabaseAdmin
      .from('vehicles')
      .select('id')
      .eq('owner_id', customerId)
      .eq('plate_number', plate)
      .maybeSingle();

    if (existing) {
      return res.json({ success: true, message: 'Vehicle already in garage', existing: true });
    }

    // 2. Insert new vehicle
    const { data: insertedVehicle, error: insertError } = await supabaseAdmin
      .from('vehicles')
      .insert({
        owner_id: customerId,
        type: vehicle.type,
        brand: vehicle.brand,
        model: vehicle.model,
        plate_number: plate,
        fleet_group_id: vehicle.fleetGroupId || null,
        is_primary: false,
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    if (vehicle.fleetGroupId) {
      const { error: membershipError } = await supabaseAdmin
        .from('fleet_group_vehicles')
        .upsert({ fleet_group_id: vehicle.fleetGroupId, vehicle_id: insertedVehicle.id }, { onConflict: 'fleet_group_id,vehicle_id' });
      if (membershipError) throw membershipError;
    }

    console.log(`✅ [GARAGE] SUCCESSFULLY REGISTERED: ${plate}`);
    return res.json({ success: true, message: 'Vehicle registered in garage' });
  } catch (err) {
    console.error('❌ [GARAGE] Sync Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});


/**
 * 🛡️ REQ-ADM-02, REQ-SYS-02: No-Show Detection Engine
 * NOSHOW_GRACE_MINUTES = 60
 * REMINDER_LEAD_MINUTES = 60
 * Identifies bookings past start time and transitions to FLAGGED_NOSHOW.
 */
const NOSHOW_GRACE_MINUTES = 60;
const REMINDER_LEAD_MINUTES = 60;

const checkOverdueBookings = async () => {
  if (!supabaseAdmin) return;

  const now = new Date();
  const overdueThreshold = new Date(now.getTime() - NOSHOW_GRACE_MINUTES * 60000);
  const reminderThreshold = new Date(now.getTime() + REMINDER_LEAD_MINUTES * 60000);

  console.log(`🕒 [SYSTEM] RUNNING NO-SHOW AUDIT: ${now.toISOString()}`);

  try {
    // Case-tolerant: catches scheduled, confirmed, and reinstated pending_confirmation bookings that have passed their grace window.
    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select('*, customer:profiles!bookings_customer_id_fkey(email, full_name), payments(id, amount, status)')
      .in('status', ['scheduled', 'confirmed', 'pending', 'PENDING', 'CONFIRMED', 'pending_confirmation']);

    if (error) throw error;

    for (const booking of (bookings || [])) {
      const status = normalizeStatus(booking.status);
      const startTime = new Date(booking.start_datetime);
      const graceWindowExpired = shouldRestoreGraceWindow(booking.status, booking.grace_period_until, now);

      if (status === 'pending_confirmation' && !graceWindowExpired) {
        continue;
      }

      // A. NO-SHOW FLAG (30 MINS) → FLAGGED_NOSHOW
      if (startTime < overdueThreshold || graceWindowExpired) {
        console.log(`⚠️ [FLAGGED_NOSHOW] Booking ${booking.id} flagged (30m+ No-Show or expired grace window)`);

        // Check if booking has verified payments for refund auto-flag
        const hasPaidPayments = (booking.payments || []).some(p => p.status === 'PAID');

        const updatePayload = {
          status: 'FLAGGED_NOSHOW',
          needs_attention: true
        };

        // REQ-CST-11: Auto-flag for refund if payment exists
        if (hasPaidPayments) {
          updatePayload.refund_status = 'PENDING';
          console.log(`💰 [REFUND] Booking ${booking.id} auto-flagged for refund (paid booking)`);
        }

        const { error: updateError } = await supabaseAdmin
          .from('bookings')
          .update({ ...updatePayload, staff_id: null, grace_period_until: null })
          .eq('id', booking.id);

        if (updateError) {
          console.error(`❌ [FLAGGED_NOSHOW] Update failed for ${booking.id}:`, updateError.message);
          continue; // Skip email if we couldn't update the status
        }

        await supabaseAdmin.from('audit_logs').insert({
          booking_id: booking.id,
          action_type: 'SYSTEM_FLAG_NOSHOW',
          actor_name: 'SYSTEM_AUDITOR',
          actor_role: 'SYSTEM',
          details: `Booking automatically flagged as No-Show (${NOSHOW_GRACE_MINUTES}m threshold).${hasPaidPayments ? ' Refund auto-queued.' : ''}`
        });

        if (booking.customer_id) {
          await supabaseAdmin.from('notifications').insert({
            user_id: booking.customer_id,
            booking_id: booking.id,
            action_url: `/customer/bookings/${booking.id}`,
            title: 'Booking Flagged as No-Show',
            message: `Booking #${booking.id.substring(0, 8).toUpperCase()} was flagged after the one-hour arrival window.`,
            notification_type: 'BOOKING_FLAGGED_NOSHOW',
            is_read: false
          });
        }

        // Send No-Show notification through the shared lifecycle email template.
        if (booking.customer?.email) {
          try {
            const projectUrl = process.env.SUPABASE_URL;
            const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
            const noShowResponse = await fetch(`${projectUrl}/functions/v1/send-status-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
              body: JSON.stringify({
                bookingId: booking.id,
                newStatus: 'FLAGGED_NOSHOW',
                remarks: hasPaidPayments ? 'A refund request has been automatically filed because a payment was detected.' : ''
              })
            });
            if (!noShowResponse.ok) throw new Error(await noShowResponse.text());
          } catch (emailErr) {
            console.warn('📧 No-Show email failed:', emailErr.message);
          }
        }
      }

      // B. URGENT REMINDER (15 MINS) - REQ-SYS-02
      else if (booking.status?.toLowerCase() === 'confirmed' && startTime <= reminderThreshold && startTime > now && !booking.reminder_sent) {
        console.log(`📧 [REMINDER] Triggering one-hour reminder for ${booking.customer?.email}`);

        if (booking.customer?.email) {
          try {
            const projectUrl = process.env.SUPABASE_URL;
            const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
            const reminderResponse = await fetch(`${projectUrl}/functions/v1/send-status-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
              body: JSON.stringify({ bookingId: booking.id, newStatus: 'CONFIRMED', reminder: true })
            });
            if (!reminderResponse.ok) throw new Error(await reminderResponse.text());
          } catch (emailErr) {
            console.warn('📧 Reminder email failed:', emailErr.message);
          }

          await supabaseAdmin
            .from('bookings')
            .update({ reminder_sent: true })
            .eq('id', booking.id);
        }
      }
    }
  } catch (err) {
    console.error('❌ No-Show Audit Error:', err.message);
  }
};

// Run the audit worker on a single backend instance in production. The query is
// status-scoped, so already processed bookings are not handled again.
setInterval(checkOverdueBookings, 5 * 60000);
checkOverdueBookings();

/**
 * 🧹 CLEAN SLATE: Purge all booking-related data
 * Deletes in FK-safe order (children first → parent last).
 * Preserves: profiles, vehicles (garage), shop config.
 */
app.post('/api/admin/purge-bookings', async (req, res) => {
  const { secret } = req.body;
  const DEBUG_SECRET = process.env.DEBUG_SECRET || 'speedway-dev-only';
  if (secret !== DEBUG_SECRET) {
    console.warn('🛑 [SECURITY] Unauthorized purge attempt blocked.');
    return res.status(403).json({ success: false, error: 'Forbidden: invalid secret' });
  }
  console.log('🧹 [ADMIN] PURGING ALL BOOKING DATA...');

  try {
    // 1. booking_vehicle_services (grandchild)
    const { error: e1 } = await supabaseAdmin.from('booking_vehicle_services').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (e1) console.warn('  ⚠️ booking_vehicle_services:', e1.message);
    else console.log('  ✅ booking_vehicle_services purged');

    // 2. booking_vehicles (child of bookings)
    const { error: e2 } = await supabaseAdmin.from('booking_vehicles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (e2) console.warn('  ⚠️ booking_vehicles:', e2.message);
    else console.log('  ✅ booking_vehicles purged');

    // 3. payments (child of bookings)
    const { error: e3 } = await supabaseAdmin.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (e3) console.warn('  ⚠️ payments:', e3.message);
    else console.log('  ✅ payments purged');

    // 4. audit_logs (references bookings)
    const { error: e4 } = await supabaseAdmin.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (e4) console.warn('  ⚠️ audit_logs:', e4.message);
    else console.log('  ✅ audit_logs purged');

    // 5. notifications (may reference bookings)
    const { error: e5 } = await supabaseAdmin.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (e5) console.warn('  ⚠️ notifications:', e5.message);
    else console.log('  ✅ notifications purged');

    // 6. chat_messages (references bookings)
    const { error: e6 } = await supabaseAdmin.from('chat_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (e6) console.warn('  ⚠️ chat_messages:', e6.message);
    else console.log('  ✅ chat_messages purged');

    // 7. bookings (parent — last)
    const { error: e7 } = await supabaseAdmin.from('bookings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (e7) console.warn('  ⚠️ bookings:', e7.message);
    else console.log('  ✅ bookings purged');

    console.log('🧹 [ADMIN] PURGE COMPLETE — Clean slate achieved.');
    return res.json({ success: true, message: 'All booking data purged. Clean slate.' });
  } catch (err) {
    console.error('❌ Purge Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/bookings/admin-cancel', async (req, res) => {
  const { bookingId, reason } = req.body;
  console.log(`🛑 [ADMIN] MANUAL CANCELLATION: ${bookingId} (Reason: ${reason})`);

  try {
    const { error: bookingError } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'CANCELLED',
        staff_id: null,
        bay_id: null,
        cancellation_reason: reason,
        cancellation_type: reason === 'No-Show' ? 'NO_SHOW' : 'ADMIN_MANUAL',
        needs_attention: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    if (bookingError) throw bookingError;

    // 🛡️ Audit Trail
    await supabaseAdmin.from('audit_logs').insert({
      booking_id: bookingId,
      action_type: 'ADMIN_CANCEL_NOSHOW',
      actor_name: 'ADMIN',
      actor_role: 'ADMIN',
      details: `Manual cancellation performed by Admin. Reason: ${reason}`
    });

    return res.json({ success: true, message: 'Booking cancelled and audit log recorded.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/bookings/undo-no-show', async (req, res) => {
  const { bookingId, actorName, adminId, pendingRefund } = req.body || {};

  if (!bookingId) {
    return res.status(400).json({ success: false, error: 'Booking ID is required.' });
  }

  try {
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, status, bay_id, customer_id, start_datetime, end_datetime, refund_status, staff_id, needs_attention, payment_status, grace_period_until')
      .eq('id', bookingId)
      .single();

    if (bookingError) throw bookingError;

    const normalizedBookingStatus = normalizeStatus(booking.status);
    if (!['flagged_noshow', 'no_show'].includes(normalizedBookingStatus)) {
      return res.status(409).json({ success: false, error: 'Booking is not currently flagged as no-show.' });
    }

    const { data: payments, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('id, status, payment_status, method, amount')
      .eq('booking_id', bookingId);

    if (paymentError) throw paymentError;

    const normalizedPaymentStatuses = (payments || []).map(payment => String(payment.payment_status || payment.status || '').trim().toLowerCase().replace(/[_\s-]+/g, '_'));
    const hasCompletedRefund = ['refunded', 'refund_processed', 'refundprocessed'].some(value => normalizedPaymentStatuses.includes(value))
      || ['refunded', 'refund_processed', 'refundprocessed'].includes(String(booking.payment_status || booking.refund_status || '').trim().toLowerCase().replace(/[_\s-]+/g, '_'))
      || (payments || []).some(payment => {
          const status = String(payment.status || '').trim().toLowerCase().replace(/[_\s-]+/g, '_');
          const method = String(payment.method || '').trim().toLowerCase();
          return ['refunded', 'refund_processed', 'refundprocessed'].includes(status)
            || (method === 'system_refund' && Number(payment.amount || 0) < 0);
        });

    if (hasCompletedRefund) {
      return res.status(400).json({
        success: false,
        error: 'Cannot undo no-show status: Payment refund has already been completed.'
      });
    }

    const refundPendingStates = ['refund_pending', 'flagged_for_refund', 'flaggedforrefund', 'refundpending'];
    const hasPendingRefund = Boolean(pendingRefund)
      || ['pending', 'queued', 'processing', 'email_pending'].some(state => String(booking.refund_status || '').toLowerCase().includes(state))
      || normalizedPaymentStatuses.some(status => refundPendingStates.includes(status))
      || (payments || []).some(payment => {
          const status = String(payment.status || '').trim().toLowerCase().replace(/[_\s-]+/g, '_');
          return ['refund_pending', 'flagged_for_refund', 'flaggedforrefund', 'refundpending'].includes(status)
            || ['refund_pending', 'flagged_for_refund', 'flaggedforrefund', 'refundpending'].includes(String(payment.payment_status || '').trim().toLowerCase().replace(/[_\s-]+/g, '_'));
        });

    const restorePayload = {
      status: 'pending_confirmation',
      staff_id: null,
      bay_id: booking.bay_id || null,
      needs_attention: false,
      refund_status: hasPendingRefund ? null : booking.refund_status,
      payment_status: hasPendingRefund ? 'approved' : booking.payment_status || 'pending',
      updated_at: new Date().toISOString(),
      reminder_sent: false,
      grace_period_until: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    };

    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update(restorePayload)
      .eq('id', bookingId);

    if (updateError) throw updateError;

    if (hasPendingRefund) {
      const pendingPaymentIds = (payments || [])
        .filter(payment => {
          const status = String(payment.status || '').trim().toLowerCase().replace(/[_\s-]+/g, '_');
          const paymentStatus = String(payment.payment_status || '').trim().toLowerCase().replace(/[_\s-]+/g, '_');
          return ['refund_pending', 'flagged_for_refund', 'flaggedforrefund', 'refundpending', 'pending', 'queued', 'processing', 'email_pending'].includes(status)
            || ['refund_pending', 'flagged_for_refund', 'flaggedforrefund', 'refundpending'].includes(paymentStatus);
        })
        .map(payment => payment.id);

      if (pendingPaymentIds.length > 0) {
        const { error: paymentUpdateError } = await supabaseAdmin
          .from('payments')
          .update({
            status: 'PAID',
            payment_status: 'approved'
          })
          .in('id', pendingPaymentIds);

        if (paymentUpdateError) throw paymentUpdateError;
      }
    }

    const { error: vehicleError } = await supabaseAdmin
      .from('booking_vehicles')
      .update({ status: 'SCHEDULED', started_at: null, completed_at: null })
      .eq('booking_id', bookingId);

    if (vehicleError) {
      console.warn('Non-fatal vehicle-state restore warning:', vehicleError.message);
    }

    await supabaseAdmin.from('audit_logs').insert({
      booking_id: bookingId,
      action_type: 'UNDO_NO_SHOW',
      actor_name: actorName || 'ADMIN',
      actor_role: 'ADMIN',
      actor_id: adminId || null,
      details: `Admin reverted no-show for booking ${bookingId}. ${hasPendingRefund ? 'Pending refund request intercepted and cancelled.' : 'No refund request was pending.'}`
    });

    return res.json({
      success: true,
      message: 'No-show was reverted successfully and pending refund requests were intercepted.',
      bookingStatus: 'pending_confirmation',
      gracePeriodUntil: restorePayload.grace_period_until
    });
  } catch (err) {
    console.error('❌ Undo No-Show Error:', err.message);
    return res.status(500).json({ success: false, error: err.message || 'Unable to restore the booking.' });
  }
});

app.post('/api/bookings/release', async (req, res) => {
  const { bookingId } = req.body;
  if (!bookingId) return res.status(400).json({ success: false, error: 'Booking ID is required.' });

  try {
    const { data: booking, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select('id, status, customer_id, total_amount')
      .eq('id', bookingId)
      .single();
    if (fetchError) throw fetchError;

    const [{ data: vehicles, error: vehiclesError }, { data: payments, error: paymentsError }] = await Promise.all([
      supabaseAdmin.from('booking_vehicles').select('status').eq('booking_id', bookingId),
      supabaseAdmin.from('payments').select('amount, status').eq('booking_id', bookingId)
    ]);
    if (vehiclesError) throw vehiclesError;
    if (paymentsError) throw paymentsError;

    const bookingStatus = booking.status?.toLowerCase();
    const allVehiclesFinished = (vehicles || []).length > 0
      && vehicles.every(vehicle => ['COMPLETED', 'CANCELLED'].includes(String(vehicle.status || '').toUpperCase()));
    const totalPaid = (payments || [])
      .filter(payment => String(payment.status || '').toUpperCase() === 'PAID')
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const isSettled = Number(booking.total_amount || 0) <= 0 || totalPaid >= Number(booking.total_amount || 0);
    if (bookingStatus !== 'completed' && !(allVehiclesFinished && isSettled)) {
      return res.status(409).json({ success: false, error: 'Only completed bookings can be released.' });
    }

    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'RELEASED', staff_id: null, bay_id: null, updated_at: new Date().toISOString() })
      .eq('id', bookingId);
    if (updateError) throw updateError;

    await supabaseAdmin.from('audit_logs').insert({
      booking_id: bookingId,
      action_type: 'BOOKING_RELEASED',
      actor_name: 'ADMIN',
      actor_role: 'ADMIN',
      details: 'Booking released after customer vehicle pickup; staff allocation cleared.'
    });

    if (booking.customer_id) {
      await supabaseAdmin.from('notifications').insert({
        user_id: booking.customer_id,
        booking_id: bookingId,
        action_url: `/customer/bookings/${bookingId}`,
        title: 'Booking Released',
        message: `Booking #${bookingId.substring(0, 8).toUpperCase()} has been released. Thank you for choosing Speedway!`,
        notification_type: 'BOOKING_RELEASED',
        is_read: false
      });
    }

    try {
      const projectUrl = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      await fetch(`${projectUrl}/functions/v1/send-status-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ bookingId, newStatus: 'RELEASED' })
      });
    } catch (emailError) {
      console.warn('Released email failed:', emailError.message);
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Release booking error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── MASTER STATUS PROPAGATOR & NOTIFICATION CONTROLLER ──────────────────
// REQ-SYS-02: Transactional Integrity for Booking Lifecycle
app.post('/api/bookings/update-status', async (req, res) => {
  const { bookingId, unitId, newStatus, notes, actorName, actorRole } = req.body;

  if (!supabaseAdmin) return res.status(500).json({ success: false, error: 'Supabase Admin not initialized' });

  try {
    const timestamp = new Date().toISOString();

    // 0. Fetch Master Booking first for context
    const { data: masterBooking, error: masterFetchError } = await supabaseAdmin
      .from('bookings')
      .select('status, customer_id, total_amount, staff_id, start_datetime')
      .eq('id', bookingId)
      .single();

    if (masterFetchError) throw masterFetchError;
    const currentMaster = masterBooking.status?.toLowerCase();

    if (newStatus.toUpperCase() === 'IN_PROGRESS') {
      const scheduledDate = new Date(masterBooking.start_datetime);
      const nowDate = new Date();
      const isScheduledDate = scheduledDate.toDateString() === nowDate.toDateString();
      if (currentMaster !== 'confirmed' || !masterBooking.staff_id || !isScheduledDate) {
        return res.status(409).json({ success: false, error: 'Service can only start on the scheduled date after confirmation and staff assignment.' });
      }
    }

    if (newStatus.toUpperCase() === 'COMPLETED') {
      const { data: completionPayments, error: completionPaymentError } = await supabaseAdmin
        .from('payments')
        .select('amount, status')
        .eq('booking_id', bookingId);
      if (completionPaymentError) throw completionPaymentError;
      const totalPaidBeforeCompletion = (completionPayments || [])
        .filter(payment => payment.status === 'PAID')
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      if (Number(masterBooking.total_amount || 0) > 0 && totalPaidBeforeCompletion < Number(masterBooking.total_amount)) {
        return res.status(409).json({ success: false, error: 'Final payment is required before completing the service.' });
      }
    }

    // 1. Update the specific vehicle unit
    const { error: unitError } = await supabaseAdmin
      .from('booking_vehicles')
      .update({
        status: newStatus.toUpperCase(),
        service_notes: notes || undefined,
        started_at: newStatus.toUpperCase() === 'IN_PROGRESS' ? timestamp : undefined,
        completed_at: newStatus.toUpperCase() === 'COMPLETED' ? timestamp : undefined
      })
      .eq('id', unitId);

    if (unitError) throw unitError;

    // 2. Fetch all units for this booking to determine the master state
    const { data: allUnits, error: fetchError } = await supabaseAdmin
      .from('booking_vehicles')
      .select('status, brand, model, service_notes')
      .eq('booking_id', bookingId);

    if (fetchError) throw fetchError;

    // 🔍 Calculate Financial Balance
    const { data: payments, error: pError } = await supabaseAdmin
      .from('payments')
      .select('amount, status')
      .eq('booking_id', bookingId);

    const totalPaid = (payments || [])
      .filter(p => p.status === 'PAID')
      .reduce((sum, p) => sum + p.amount, 0);
    const balance = Math.max(0, (masterBooking.total_amount || 0) - totalPaid);
    const isFullySettled = (masterBooking.total_amount || 0) > 0 && balance === 0;

    // 🆕 Status Calculation Logic
    const anyInProgress = (allUnits || []).some(u => u.status?.toUpperCase() === 'IN_PROGRESS');
    const allCompleted = (allUnits || []).length > 0 && (allUnits || []).every(u => u.status?.toUpperCase() === 'COMPLETED');
    const allPending = (allUnits || []).length > 0 && (allUnits || []).every(u => u.status?.toUpperCase() === 'SCHEDULED');

    // Determine target master status
    let targetMasterStatus = currentMaster;

    // 🛡️ REQ-NFR-02: Do not move out of terminal states (completed/cancelled)
    if (currentMaster.toLowerCase() !== 'completed' && currentMaster.toLowerCase() !== 'cancelled') {
      if (anyInProgress) targetMasterStatus = 'in_progress';
      else if (allCompleted && isFullySettled) targetMasterStatus = 'completed';
      else if (allCompleted && !isFullySettled) targetMasterStatus = 'in_progress'; // Stay in_progress if unpaid
      else if (allPending) targetMasterStatus = 'scheduled';
    }

    console.log(`[PROPAGATOR] Booking ${bookingId}: Current='${currentMaster}', Target='${targetMasterStatus}', Balance=₱${balance}`);

    // 4. Update Master Booking if needed (Case-insensitive check)
    if (masterBooking.status?.toLowerCase() !== targetMasterStatus.toLowerCase()) {
      console.log(`[PROPAGATOR] Updating Master Booking ${bookingId} to '${targetMasterStatus}'`);
      const { error: updateError } = await supabaseAdmin
        .from('bookings')
        .update({ status: targetMasterStatus })
        .eq('id', bookingId);

      if (updateError) throw updateError;

      // 🔔 REQ-SYS-05: Insert System Notification for Customer
      try {
        await supabaseAdmin.from('notifications').insert({
          user_id: masterBooking.customer_id,
          booking_id: bookingId,
          action_url: `/customer/bookings/${bookingId}`,
          title: `Booking ${targetMasterStatus.toUpperCase()}`,
          message: targetMasterStatus === 'completed'
            ? `Your service for Booking #${bookingId.substring(0, 8).toUpperCase()} is now complete. Thank you for choosing Speedway!`
            : `Your booking status has been updated to ${targetMasterStatus.toUpperCase()}.`,
          notification_type: targetMasterStatus === 'completed' ? 'VEHICLE_COMPLETED' : 'SYSTEM_ALERT',
          is_read: false
        });
      } catch (notifErr) {
        console.warn('⚠️ Notification insertion failed:', notifErr.message);
      }

      // 📧 DISPATCH CENTRALIZED EMAIL
      let remarks = '';
      if (targetMasterStatus === 'completed') {
        remarks = (allUnits || [])
          .filter(u => u.service_notes)
          .map(u => `${u.brand} ${u.model}: ${u.service_notes}`)
          .join('\n');
      }

      try {
        const project_url = process.env.SUPABASE_URL;
        const service_key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        await fetch(`${project_url}/functions/v1/send-status-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${service_key}` },
          body: JSON.stringify({ bookingId, newStatus: targetMasterStatus, remarks })
        });
      } catch (emailErr) {
        console.warn('Backend Email Trigger Warning:', emailErr.message);
      }
    }

    // 5. Audit Log
    await supabaseAdmin.from('audit_logs').insert({
      booking_id: bookingId,
      action_type: 'STATUS_PROPAGATION',
      actor_name: actorName || 'System',
      actor_role: actorRole || 'STAFF',
      details: `Unit ${unitId} updated to ${newStatus}. Master status: ${targetMasterStatus || 'unchanged'}`
    });

    return res.json({
      success: true,
      masterStatus: targetMasterStatus || currentMaster,
      unitStatus: newStatus.toUpperCase()
    });

  } catch (err) {
    console.error('Propagation Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/debug/user/:email', async (req, res) => {
  const { email } = req.params;
  try {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) throw error;

    const user = users.find(u => u.email === email);
    if (!user) {
      return res.json({ success: false, message: 'User not found in Auth' });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        confirmed_at: user.confirmed_at,
        last_sign_in_at: user.last_sign_in_at,
        metadata: user.user_metadata
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/debug/list-users', async (req, res) => {
  const DEBUG_SECRET = process.env.DEBUG_SECRET || 'speedway-dev-only';
  if (req.query.secret !== DEBUG_SECRET) return res.status(403).json({ success: false, error: 'Forbidden' });
  try {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) throw error;

    // Return last 10 users
    const lastUsers = users
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10)
      .map(u => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        confirmed_at: u.confirmed_at,
        role: u.user_metadata?.role
      }));

    return res.json({ success: true, users: lastUsers });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});


app.post('/api/debug/fix-account', async (req, res) => {
  const { email, secret } = req.body;
  const DEBUG_SECRET = process.env.DEBUG_SECRET || 'speedway-dev-only';
  if (secret !== DEBUG_SECRET) {
    console.warn(`🛑 [SECURITY] Unauthorized fix-account attempt for: ${email}`);
    return res.status(403).json({ success: false, error: 'Forbidden: invalid secret' });
  }
  try {
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: 'Password123!',
      email_confirm: true
    });

    if (updateError) throw updateError;

    return res.json({ success: true, message: `Password for ${email} reset to 'Password123!' and email confirmed.` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/staff/toggle-shift', async (req, res) => {
  const { userId, newStatus } = req.body;
  console.log(`⏱️ [SHIFT SYSTEM] TOGGLING SHIFT: User ${userId} -> ${newStatus ? 'IN' : 'OUT'}`);

  try {
    if (!supabaseAdmin) throw new Error('Supabase Admin not initialized');

    // 1. Update Profile (Bypass RLS)
    const { data: profile, error: pError } = await supabaseAdmin
      .from('profiles')
      .update({ is_clocked_in: newStatus })
      .eq('id', userId)
      .select()
      .single();

    if (pError) throw pError;

    // 2. Manage Shift Record
    if (newStatus) {
      // Clock In: Create new active shift
      const { error: sError } = await supabaseAdmin
        .from('staff_shifts')
        .insert({ staff_id: userId, status: 'active' });
      if (sError) console.warn('⚠️ Shift record creation warning:', sError.message);
    } else {
      // Clock Out: Close active shifts
      const { error: sError } = await supabaseAdmin
        .from('staff_shifts')
        .update({
          status: 'completed',
          clock_out: new Date().toISOString()
        })
        .eq('staff_id', userId)
        .eq('status', 'active');
      if (sError) console.warn('⚠️ Shift record update warning:', sError.message);
    }

    // 3. Log to Audit
    await supabaseAdmin.from('audit_logs').insert({
      action_type: newStatus ? 'STAFF_CLOCK_IN' : 'STAFF_CLOCK_OUT',
      actor_name: profile.full_name || 'Staff',
      actor_role: 'STAFF',
      details: `Shift status changed to ${newStatus ? 'ON DUTY' : 'OFF DUTY'}`
    });

    return res.json({ success: true, profile });
  } catch (err) {
    console.error('❌ Shift Toggle Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 🔒 Schedule Block Management Endpoints (Bypassing RLS 403 Forbidden)
app.post('/api/admin/blocked-slots', async (req, res) => {
  const { block_date, dates, start_date, end_date, start_time, end_time, reason } = req.body;

  try {
    if (!supabaseAdmin) throw new Error('Supabase Admin not initialized');

    let rowsToInsert = [];

    if (Array.isArray(dates) && dates.length > 0) {
      // Multi-day date array provided
      rowsToInsert = dates.map(d => ({
        block_date: d,
        start_time,
        end_time,
        reason: reason || 'ADMIN BLOCK'
      }));
    } else if (start_date && end_date) {
      // Multi-day date range provided
      const curr = new Date(start_date);
      const last = new Date(end_date);
      while (curr <= last) {
        const dStr = curr.toISOString().split('T')[0];
        rowsToInsert.push({
          block_date: dStr,
          start_time,
          end_time,
          reason: reason || 'ADMIN BLOCK'
        });
        curr.setDate(curr.getDate() + 1);
      }
    } else if (block_date) {
      // Single day
      rowsToInsert = [{
        block_date,
        start_time,
        end_time,
        reason: reason || 'ADMIN BLOCK'
      }];
    } else {
      return res.status(400).json({ success: false, error: 'Target date or date range is required' });
    }

    const activeStatuses = ['scheduled', 'confirmed', 'in_progress', 'pending', 'SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'PENDING'];
    const conflicts = new Map();
    for (const row of rowsToInsert) {
      const blockStart = new Date(`${row.block_date}T${row.start_time || '00:00:00'}`);
      const blockEnd = new Date(`${row.block_date}T${row.end_time || '23:59:59'}`);
      const { data: bookings, error: bookingError } = await supabaseAdmin
        .from('bookings')
        .select('id, customer_name, start_datetime, end_datetime, status')
        .in('status', activeStatuses)
        .lt('start_datetime', blockEnd.toISOString())
        .gt('end_datetime', blockStart.toISOString());
      if (bookingError) throw bookingError;
      for (const booking of bookings || []) conflicts.set(booking.id, booking);
    }

    if (conflicts.size > 0) {
      return res.status(409).json({
        success: false,
        code: 'BOOKING_CONFLICT',
        error: 'This restriction overlaps active bookings. Cancel or reschedule them first.',
        bookings: Array.from(conflicts.values())
      });
    }

    console.log(`🔒 [ADMIN SCHEDULE] BLOCKING SLOTS: ${rowsToInsert.length} day(s) (${start_time || 'WHOLE DAY'} - ${end_time || 'WHOLE DAY'})`);

    const { data, error } = await supabaseAdmin
      .from('blocked_slots')
      .insert(rowsToInsert)
      .select();

    if (error) throw error;

    await supabaseAdmin.from('audit_logs').insert({
      action_type: 'SCHEDULE_SLOT_BLOCKED',
      actor_name: 'ADMIN',
      actor_role: 'ADMIN',
      details: `Blocked schedule slots across ${rowsToInsert.length} day(s): ${reason || 'ADMIN BLOCK'}`
    });

    return res.json({ success: true, data });
  } catch (err) {
    console.error('❌ Block Slot Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/admin/blocked-slots/:id', async (req, res) => {
  const { id } = req.params;
  const { start_time, end_time, reason } = req.body;
  console.log(`✂️ [ADMIN SCHEDULE] TRIMMING/UPDATING BLOCK ID ${id}: ${start_time} - ${end_time}`);

  try {
    if (!supabaseAdmin) throw new Error('Supabase Admin not initialized');

    const updateFields = {};
    if (start_time !== undefined) updateFields.start_time = start_time;
    if (end_time !== undefined) updateFields.end_time = end_time;
    if (reason !== undefined) updateFields.reason = reason;

    const { data, error } = await supabaseAdmin
      .from('blocked_slots')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await supabaseAdmin.from('audit_logs').insert({
      action_type: 'SCHEDULE_SLOT_TRIMMED',
      actor_name: 'ADMIN',
      actor_role: 'ADMIN',
      details: `Adjusted restriction timeframe on slot ID ${id} to ${start_time || 'WHOLE DAY'} - ${end_time || 'WHOLE DAY'}`
    });

    return res.json({ success: true, data });
  } catch (err) {
    console.error('❌ Trim Block Slot Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/admin/blocked-slots/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`🔓 [ADMIN SCHEDULE] UNBLOCKING SLOT ID: ${id}`);

  try {
    if (!supabaseAdmin) throw new Error('Supabase Admin not initialized');

    const { error } = await supabaseAdmin
      .from('blocked_slots')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await supabaseAdmin.from('audit_logs').insert({
      action_type: 'SCHEDULE_SLOT_UNBLOCKED',
      actor_name: 'ADMIN',
      actor_role: 'ADMIN',
      details: `Lifted restriction on slot ID ${id}`
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('❌ Unblock Slot Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log('\n' + '*'.repeat(50));
  console.log(`🚀 SPEEDWAY SHADOW BACKEND: http://localhost:${PORT}`);
  console.log('*'.repeat(50) + '\n');
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ ERROR: Port ${PORT} is already in use!`);
    console.error(`   Please stop any other running backend processes and try again.\n`);
  } else {
    console.error(`\n❌ ERROR: Server failed to start:`, err.message);
  }
  process.exit(1);
});


