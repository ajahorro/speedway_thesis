const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer');
require('dotenv').config();

const { Resend } = require('resend');
const resendClient = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Initialize Gemini AI (Defaulting to production v1 for stability)
const geminiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(geminiKey);
// Configuration: Using gemini-1.5-flash with safety overrides for financial auditing
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  safetySettings: [
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
  ]
});

// 🤖 Model Discovery (Diagnostics)
(async () => {
  try {
    const resendKey = process.env.RESEND_API_KEY || '';
    console.log(`📧 [Email] API KEY MASK: ${resendKey.substring(0, 10)}...`);
    console.log(`🤖 [AI] API KEY MASK: ${geminiKey.substring(0, 8)}...`);
    // Note: listModels might not be available in all SDK versions, 
    // but we'll try to help debug the 404 issue.
    console.log(`🤖 [AI] ATTEMPTING TO USE: models/gemini-1.5-flash`);
  } catch (e) {
    console.warn('Could not list models, continuing with default.');
  }
})();

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
      html = `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #A91B18;">SPEEDWAY AUTOXMOTO</h2>
          <p>Your verification code is:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; padding: 10px; background: #f4f4f4; border-radius: 5px; display: inline-block;">
            ${data.otp}
          </div>
          <p>This code will expire in 10 minutes.</p>
        </div>`;
      break;
    default:
      subject = 'Speedway AutoxMoto Update';
      html = `<p>New update for ${type}</p><pre>${JSON.stringify(data, null, 2)}</pre>`;
  }
  return { subject, html };
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

    // Fetch customer separately for reliability
    const { data: customer, error: cError } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', booking.customer_id)
      .single();

    if (cError || !customer) throw new Error('Customer profile not found');
    const vehicles = booking.booking_vehicles || [];
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

    if (resendClient) {
      await resendClient.emails.send({
        from: 'Speedway Detail Studio <verify@speedway-autoxmoto.xyz>',
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
    // 1. Fetch booking and specific payment
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

    // Fetch customer separately
    const { data: customer, error: cError } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', booking.customer_id)
      .single();

    if (cError || !customer) throw new Error('Customer profile not found');
    const dateStr = new Date(payment.created_at).toLocaleString();

    let attachments = [];
    if (payment.evidence_url) {
      try {
        // Fetch the file from Supabase storage
        const pathParts = payment.evidence_url.split('/');
        const bucket = 'receipts'; // Unified bucket name
        const filePath = pathParts[pathParts.length - 1];

        const { data: fileData, error: fileError } = await supabaseAdmin.storage
          .from(bucket)
          .download(filePath);

        if (fileData) {
          const buffer = Buffer.from(await fileData.arrayBuffer());
          attachments.push({
            content: buffer,
            filename: `receipt_${paymentId.substring(0, 8)}.png`
          });
        }
      } catch (fErr) {
        console.warn('Could not attach receipt image:', fErr.message);
      }
    }

    if (resendClient) {
      await resendClient.emails.send({
        from: 'Speedway Detail Studio <verify@speedway-autoxmoto.xyz>',
        to: customer.email,
        subject: `PAYMENT RECEIPT: ${paymentId.substring(0, 8).toUpperCase()}`,
        attachments,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #eee; padding: 20px;">
            <div style="text-align: right; color: #888; font-size: 12px;">Official Receipt</div>
            <h2 style="color: #A91B18; margin-top: 0;">SPEEDWAY DETAIL STUDIO</h2>
            
            <p>Hi <strong>${customer.full_name}</strong>,</p>
            <p>Your payment has been <strong>VERIFIED</strong>. Thank you for your transaction.</p>
            
            <div style="background: #f9f9f9; padding: 20px; border-radius: 4px; margin: 20px 0; border: 1px solid #eee;">
              <table style="width: 100%; font-size: 14px;">
                <tr><td style="color: #666;">Transaction ID:</td><td style="text-align: right; font-weight: bold;">${paymentId}</td></tr>
                <tr><td style="color: #666;">Date:</td><td style="text-align: right;">${dateStr}</td></tr>
                <tr><td style="color: #666;">Payment Method:</td><td style="text-align: right;">${payment.method}</td></tr>
                <tr style="font-size: 18px; border-top: 2px solid #eee;">
                  <td style="padding-top: 10px; font-weight: bold;">Amount Paid:</td>
                  <td style="padding-top: 10px; text-align: right; font-weight: bold; color: #A91B18;">₱${payment.amount}</td>
                </tr>
              </table>
            </div>

            <p style="font-size: 13px; color: #666;">
              This payment has been applied to Booking <strong>#${bookingId.substring(0, 8).toUpperCase()}</strong>.
            </p>

            ${attachments.length > 0 ? '<p style="font-size: 11px; color: #10b981;">✔ Your payment evidence has been attached to this email.</p>' : ''}

            <div style="margin-top: 40px; text-align: center; font-size: 11px; color: #aaa;">
              Speedway Detail Studio | 39 Hunters ROTC, Barangay San Juan, Cainta, 1900 Rizal
            </div>
          </div>
        `
      });
      console.log(`✅ Payment receipt email sent to ${customer.email}`);
    }

    return res.json({ success: true });
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
        from: 'Speedway Detail Studio <verify@speedway-autoxmoto.xyz>',
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

  if (!email || !['ADMIN', 'STAFF'].includes(role)) {
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
        await resendClient.emails.send({
          from: 'Speedway Detail Studio <verify@speedway-autoxmoto.xyz>',
          to: email,
          subject: 'Speedway Administrative Invitation',
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #eee;">
              <h2 style="color: #A91B18;">SPEEDWAY DETAIL STUDIO</h2>
              <p>You have been invited to join the team as an <strong>${role}</strong>.</p>
              <p>Click the button below to activate your account and set your password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${inviteLink}" style="background-color: #A91B18; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">CONFIRM EMAIL ADDRESS</a>
              </div>
              <p style="font-size: 11px; color: #888;">Link expires in 48 hours.</p>
            </div>
          `
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
      email_confirm: false,
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
    return res.json({ success: true, message: 'Account activated successfully' });

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
      from: 'Speedway Detail Studio <verify@speedway-autoxmoto.xyz>',
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
 * Uses Gemini 1.5 Flash for high-fidelity receipt auditing
 */
app.post('/api/ocr/verify-receipt', upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No receipt image uploaded' });
    }

    console.log(`🤖 [AI OCR] SCANNING RECEIPT: ${req.file.originalname} (${req.file.size} bytes)`);

    // Convert buffer to generative AI part
    const imagePart = {
      inlineData: {
        data: req.file.buffer.toString('base64'),
        mimeType: req.file.mimetype
      }
    };

    const prompt = `
      You are a financial audit specialist for a high-end car detailing studio. 
      Extract the following information from this GCash or Bank transaction receipt:
      1. Transaction Reference Number (Ref No, ID, or Transaction ID)
      2. Total Amount Paid (PHP value)
      3. Date and Time of transaction

      Rules:
      - Return the data in STRICT JSON format.
      - If you cannot find a specific field, use "N/A".
      - Be extremely precise with the amount.
      - Return ONLY the JSON object, no other text.

      JSON Structure:
      {
        "referenceNo": "string",
        "amount": number,
        "date": "string",
        "integrity": number,
        "isReceipt": boolean
      }
    `;

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    // 🧹 Clean JSON (sometimes AI adds markdown blocks)
    const cleanedJson = text.replace(/```json|```/g, '').trim();
    const extractedData = JSON.parse(cleanedJson);

    console.log(`✅ [AI OCR] EXTRACTION SUCCESSFUL:`, extractedData);

    // 🛡️ FINANCIAL INTEGRITY GUARD: Comparison Logic
    const extractedAmount = parseFloat(extractedData.amount);
    const requiredAmount = parseFloat(req.body.requiredAmount);
    const bookingId = req.body.bookingId;

    // Check for mismatch (handling minor precision differences)
    const isMatch = Math.abs(extractedAmount - requiredAmount) < 1.0;

    // THESIS FLOW: Mismatches are 'Flagged for Review', Matches are 'Confirmed'
    const finalStatus = isMatch ? 'Confirmed' : 'Flagged for Review';

    console.log(`🔍 [AUDIT] Comparison: Extracted ₱${extractedAmount} vs Required ₱${requiredAmount}`);
    console.log(`📊 [AUDIT] Result: ${isMatch ? '✅ MATCH' : '⚠️ MISMATCH'} -> Status: ${finalStatus}`);

    // Update the booking in Supabase ONLY IF it already exists (Post-creation flow)
    if (bookingId && bookingId !== 'PENDING') {
      const { error: updateError } = await supabaseAdmin
        .from('bookings')
        .update({
          payment_status: finalStatus,
          ocr_metadata: {
            ...extractedData,
            requiredAmount,
            isMatch,
            auditedAt: new Date().toISOString()
          }
        })
        .eq('id', bookingId);

      if (updateError) throw updateError;

      // Record in Master Audit Log
      try {
        await supabaseAdmin.from('audit_logs').insert({
          booking_id: bookingId,
          action_type: 'AI_VERIFICATION_COMPLETE',
          actor_name: 'AI_AUDITOR',
          actor_role: 'SYSTEM',
          details: `AI extraction complete. Reference: ${extractedData.referenceNo}. Amount: ₱${extractedAmount}. Match: ${isMatch}.`
        });
      } catch (logErr) {
        console.warn('⚠️ Audit logging failed, but booking was updated.');
      }
    } else {
      console.log('ℹ️ [AI OCR] Booking is in PENDING state. Returning extraction results to frontend for submission.');
    }

    res.json({
      success: true,
      status: finalStatus,
      isMatch: isMatch,
      data: extractedData
    });

  } catch (error) {
    // Masking raw error for professional UI as per Technical Directive
    console.warn('⚠️ [AI OCR] Service unavailable, masked error returned to client.');
    res.status(500).json({
      success: false,
      error: "AI analysis service is temporarily offline for maintenance. Our system will transition to manual verification to ensure your booking proceeds. Please continue."
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

    if (resendClient) {
      await resendClient.emails.send({
        from: 'Speedway Detail Studio <verify@speedway-autoxmoto.xyz>',
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
        from: 'Speedway Detail Studio <verify@speedway-autoxmoto.xyz>',
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

    // Step 1: Fetch all profiles (bypasses RLS)
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id');

    if (profileError) throw profileError;

    if (!profiles || profiles.length === 0) {
      return res.status(404).json({ success: false, error: 'No profiles found to broadcast to.' });
    }

    // Step 2: Prepare and insert notification for each profile
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

    return res.json({ success: true, receiversCount: profiles.length });
  } catch (err) {
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
        cancellation_reason: reason,
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
  console.log(`🤖 [ADMIN AI] SIMULATING SCAN FOR: ${receiptUrl?.substring(0, 50)}...`);

  // Simulate AI Processing Latency
  await new Promise(resolve => setTimeout(resolve, 2000));

  const mockRef = Math.random().toString().slice(2, 11);

  res.json({
    success: true,
    data: {
      referenceNumber: `GC-${mockRef}`,
      confidence: 0.98,
      isMatch: true,
      isSimulation: true
    }
  });
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
    const { error: insertError } = await supabaseAdmin
      .from('vehicles')
      .insert({
        owner_id: customerId,
        type: vehicle.type,
        brand: vehicle.brand,
        model: vehicle.model,
        plate_number: plate,
        is_primary: false,
        updated_at: new Date().toISOString()
      });

    if (insertError) throw insertError;

    console.log(`✅ [GARAGE] SUCCESSFULLY REGISTERED: ${plate}`);
    return res.json({ success: true, message: 'Vehicle registered in garage' });
  } catch (err) {
    console.error('❌ [GARAGE] Sync Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});


/**
 * 🛡️ REQ-ADM-02, REQ-SYS-02: No-Show Detection Engine
 * NOSHOW_GRACE_MINUTES = 30 (mirrors SHOP_CONFIG.STALE_SESSION_PURGE_MINUTES)
 * URGENT_REMINDER_MINUTES = 15
 * Identifies bookings past start time and transitions to FLAGGED_NOSHOW.
 */
const NOSHOW_GRACE_MINUTES = 30;
const URGENT_REMINDER_MINUTES = 15;

const checkOverdueBookings = async () => {
  if (!supabaseAdmin) return;

  const now = new Date();
  const overdueThreshold = new Date(now.getTime() - NOSHOW_GRACE_MINUTES * 60000);
  const reminderThreshold = new Date(now.getTime() - URGENT_REMINDER_MINUTES * 60000);

  console.log(`🕒 [SYSTEM] RUNNING NO-SHOW AUDIT: ${now.toISOString()}`);

  try {
    // Case-tolerant: catches 'scheduled', 'confirmed', 'PENDING', 'CONFIRMED'
    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select('*, customer:profiles!bookings_customer_id_fkey(email, full_name), payments(id, amount, status)')
      .in('status', ['scheduled', 'confirmed', 'pending', 'PENDING', 'CONFIRMED']);

    if (error) throw error;

    for (const booking of (bookings || [])) {
      const startTime = new Date(booking.start_datetime);

      // A. NO-SHOW FLAG (30 MINS) → FLAGGED_NOSHOW
      if (startTime < overdueThreshold) {
        console.log(`⚠️ [FLAGGED_NOSHOW] Booking ${booking.id} flagged (30m+ No-Show)`);

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
          .update(updatePayload)
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

        // Send No-Show notification email
        if (resendClient && booking.customer?.email) {
          try {
            await resendClient.emails.send({
              from: 'Speedway Detail Studio <verify@speedway-autoxmoto.xyz>',
              to: booking.customer.email,
              subject: 'Booking Expired — No-Show Notification',
              html: `
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                  <h2 style="color: #E61E2A;">Booking Expired</h2>
                  <p>Hi ${booking.customer.full_name || 'Valued Customer'},</p>
                  <p>Your scheduled slot at Speedway Detail Studio has expired due to non-arrival within the ${NOSHOW_GRACE_MINUTES}-minute window.</p>
                  ${hasPaidPayments ? '<p><strong>Since a payment was detected, a refund request has been automatically filed.</strong> Our team will process it shortly.</p>' : ''}
                  <p>Please contact us if you have any questions.</p>
                </div>`
            });
          } catch (emailErr) {
            console.warn('📧 No-Show email failed:', emailErr.message);
          }
        }
      }

      // B. URGENT REMINDER (15 MINS) - REQ-SYS-02
      else if (startTime < reminderThreshold && !booking.reminder_sent) {
        console.log(`📧 [REMINDER] Triggering urgent reminder for ${booking.customer?.email}`);

        if (resendClient && booking.customer?.email) {
          try {
            await resendClient.emails.send({
              from: 'Speedway Detail Studio <verify@speedway-autoxmoto.xyz>',
              to: booking.customer.email,
              subject: 'URGENT: Your Speedway Slot is Held',
              html: `
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                  <h2 style="color: #E61E2A;">URGENT NOTIFICATION</h2>
                  <p>Hi ${booking.customer.full_name || 'Valued Customer'},</p>
                  <p>Your scheduled slot at Speedway Detail Studio was set to begin ${URGENT_REMINDER_MINUTES} minutes ago.</p>
                  <p><strong>We are holding your slot for ${NOSHOW_GRACE_MINUTES - URGENT_REMINDER_MINUTES} more minutes.</strong> If you do not arrive within this window, your booking will be flagged as a No-Show and may be cancelled.</p>
                  <p>Please contact us immediately if you are on your way.</p>
                </div>`
            });
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

// 🛡️ EMERGENCY DISABLE: Temporarily stopping the audit loop to prevent email spam
// setInterval(checkOverdueBookings, 5 * 60000);
// checkOverdueBookings(); 

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
      .select('status, customer_id, total_amount')
      .eq('id', bookingId)
      .single();

    if (masterFetchError) throw masterFetchError;
    const currentMaster = masterBooking.status?.toLowerCase();

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


