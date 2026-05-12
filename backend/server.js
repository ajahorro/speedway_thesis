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

// Initialize Gemini AI
const geminiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(geminiKey);
const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash" });

// 🤖 Model Discovery (Diagnostics)
(async () => {
  try {
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

    await resendClient.emails.send({
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

    console.log(`✅ Customer welcome email delivered to ${email}`);
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
        "integrity": number (0-100 confidence score),
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

    // Update the booking in Supabase using Service Role
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
        details: `AI extracted ₱${extractedAmount}. Required ₱${requiredAmount}. Match: ${isMatch}. Status: ${finalStatus}`
      });
    } catch (logErr) {
      console.warn('⚠️ Audit logging failed, but booking was updated.');
    }

    res.json({
      success: true,
      status: finalStatus,
      isMatch: isMatch,
      data: extractedData
    });

  } catch (error) {
    console.error('❌ [AI OCR] FAILED:', error);
    res.status(500).json({ 
      success: false, 
      error: 'AI analysis failed. Please ensure the photo is clear and try again.' 
    });
  }
});

/**
 * 🛡️ REQ-ADM-12: Simulated AI Audit for Admin Dashboard
 * Provides an immediate, reliable 'Audit Simulation' for thesis defense.
 */
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


