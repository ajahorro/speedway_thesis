const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// Setup transporter (will still try to send, but won't crash if it fails)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

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
  
  // 🌟 ALWAYS LOG TO TERMINAL (CRITICAL FOR DEFENSE)
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
    
    // Attempt real email delivery
    if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
        await transporter.sendMail({
          from: `"Speedway AutoxMoto" <${process.env.GMAIL_USER}>`,
          to,
          subject,
          html
        });
        console.log('✅ Email successfully delivered to inbox.');
    } else {
        console.warn('⚠️ No SMTP credentials found. Logging to terminal only.');
    }
    
    return res.json({ success: true, message: 'Code logged to terminal and email attempted.' });
  } catch (err) {
    console.warn(`⚠️ SMTP delivery failed, but your code is logged above! (${err.message})`);
    // Still return success so the frontend doesn't show an error
    return res.json({ 
      success: true, 
      message: 'Email delivery failed, but check your terminal for the code!',
      dev_mode: true 
    });
  }
});

app.listen(PORT, () => {
  console.log('\n' + '*'.repeat(50));
  console.log(`🚀 SPEEDWAY SHADOW BACKEND: http://localhost:${PORT}`);
  console.log(`💡 ALL SYSTEM NOTIFICATIONS (BOOKINGS/STAFF) WILL APPEAR HERE!`);
  console.log('*'.repeat(50) + '\n');
});
