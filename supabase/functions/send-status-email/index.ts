import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

const templates = {
  CONFIRMED: 'Your appointment is locked in! See you at Speedway.',
  ONGOING: "Great news! We've started detailing your vehicle.",
  IN_PROGRESS: "Great news! We've started detailing your vehicle.",
  COMPLETED: 'Your ride is ready for pickup! Check your portal for the final receipt.',
  CANCELLED: 'Your booking has been cancelled. Please check your portal for details regarding your refund or rescheduling.',
  FLAGGED_NOSHOW: 'We missed you! Your slot has expired. Visit the Refund Hub for details.'
}

serve(async (req) => {
  // Security check: service_role or secret header
  const authHeader = req.headers.get('Authorization')
  if (!authHeader && !Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  try {
    const { bookingId, newStatus, remarks } = await req.json()

    // Fetch booking + customer info
    const { data: booking, error: bError } = await supabase
      .from('bookings')
      .select(`
        id,
        customer_id,
        total_amount,
        profiles (
          full_name,
          email
        )
      `)
      .eq('id', bookingId)
      .single()

    if (bError || !booking) {
      throw new Error(`Booking not found: ${bError?.message}`)
    }

    const customer = booking.profiles
    const email = customer?.email
    const name = customer?.full_name || 'Valued Customer'
    const statusKey = newStatus.toUpperCase()
    
    const subject = `Speedway Update: Booking #${bookingId.slice(0, 8).toUpperCase()} is now ${statusKey}`
    const content = templates[statusKey] || `Your booking status has been updated to ${newStatus}.`
    
    const reasonHtml = remarks ? `<p style="margin-top: 15px; padding: 10px; background: #222; border-left: 4px solid #a91b18;"><strong>Note/Reason:</strong> ${remarks}</p>` : ''

    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #111; color: #fff; border: 1px solid #333; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #a91b18; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; letter-spacing: 2px;">SPEEDWAY AUTOXMOTO</h1>
        </div>
        <div style="padding: 30px;">
          <h2 style="color: #a91b18; margin-top: 0;">Status Update</h2>
          <p>Hi ${name},</p>
          <p>${content}</p>
          ${reasonHtml}
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #333; font-size: 14px; color: #888;">
            <p>Booking ID: ${bookingId}</p>
            <p>Total Amount: ₱${booking.total_amount?.toLocaleString()}</p>
          </div>
          <div style="margin-top: 30px; text-align: center;">
            <a href="https://speedway-autoxmoto.com/portal" style="background-color: #a91b18; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">VIEW IN PORTAL</a>
          </div>
        </div>
        <div style="background-color: #0a0a0a; padding: 15px; text-align: center; font-size: 12px; color: #555;">
          &copy; 2024 Speedway AutoxMoto. All Rights Reserved.
        </div>
      </div>
    `

    const { data, error } = await resend.emails.send({
      from: 'Speedway <notifications@speedway-autoxmoto.com>',
      to: [email],
      subject: subject,
      html: html,
    })

    if (error) {
      throw error
    }

    return new Response(JSON.stringify({ ok: true, data }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
