import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY environment variable");
    }

    const body = await req.json();
    const { email, customerName, invoiceId, refundReference, refundAmount, vehicles } = body;

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #ef4444; padding: 20px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">OFFICIAL REFUND SLIP</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Speedway AutoXMoto</p>
        </div>
        <div style="padding: 20px;">
          <p>Hi ${customerName},</p>
          <p>We have successfully processed a refund for your recent cancellation. Please find the details of your refund below:</p>
          
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Original Invoice ID:</strong> INV-${invoiceId.substring(0, 8).toUpperCase()}</p>
            <p style="margin: 5px 0;"><strong>Refund Reference:</strong> ${refundReference}</p>
            <p style="margin: 5px 0;"><strong>Total Amount Reverted:</strong> ₱${Number(refundAmount).toLocaleString()}</p>
          </div>

          <p>This amount has been reverted to your original payment method. Depending on your bank or payment provider, it may take 3-5 business days to reflect in your account.</p>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: 'Speedway AutoXMoto <billing@speedwayautoxmoto.com>',
        to: [email],
        subject: `Refund Processed: INV-${invoiceId.substring(0, 8).toUpperCase()}`,
        html: emailHtml
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to send email via Resend');
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
