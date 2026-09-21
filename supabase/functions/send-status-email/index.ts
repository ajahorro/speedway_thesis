import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
const resendFrom = Deno.env.get('RESEND_FROM') || 'Speedway <notifications@speedway-autoxmoto.com>'
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

const templates = {
  SCHEDULED: 'Your booking has been received. Your scheduled time is confirmed. Your payment is to be verified manually by the admin before we confirm your booking.',
  CONFIRMED: 'Your appointment is locked in! See you at Speedway.',
  ONGOING: "Great news! We've started detailing your vehicle.",
  IN_PROGRESS: "Great news! We've started detailing your vehicle.",
  COMPLETED: 'Your ride is ready for pickup! Check your portal for the final receipt.',
  RELEASED: 'Your vehicle has been released. Thank you for choosing Speedway. Please come again for your future Auto x Moto needs! Create an account on our website to see more and hear about future promos if you have not yet!',
  CANCELLED: 'Your booking has been cancelled. Please check your portal for details regarding your refund or rescheduling.',
  FLAGGED_NOSHOW: 'We missed you! Your slot has expired. Visit the Refund Hub for details.'
}

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

const lifecycleSteps = ['SCHEDULED', 'CONFIRMED', 'IN PROGRESS', 'QUALITY CHECK', 'COMPLETED', 'RELEASED']

const renderLifecycle = (statusKey: string) => {
  const normalized = statusKey === 'ONGOING' ? 'IN PROGRESS' : statusKey.replaceAll('_', ' ')
  const activeIndex = lifecycleSteps.indexOf(normalized)
  const isException = ['CANCELLED', 'FLAGGED NOSHOW'].includes(normalized)
  return `<div style="margin: 28px 0; padding: 18px 10px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px;">
    <div style="font-size: 11px; color: #6b7280; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 16px;">Booking lifecycle</div>
    <table role="presentation" style="width: 100%; border-collapse: collapse;"><tr>
      ${lifecycleSteps.map((step, index) => {
        const isActive = index === activeIndex
        const isPast = activeIndex >= 0 && index < activeIndex
        const color = isException && index === 0 ? '#dc2626' : (isActive || isPast ? '#e61e2a' : '#cbd5e1')
        return `<td style="width: ${100 / lifecycleSteps.length}%; text-align: center; vertical-align: top;">
          <div style="margin: 0 auto 8px; width: 18px; height: 18px; line-height: 18px; border-radius: 50%; background: ${color}; color: #fff; font-size: 11px; font-weight: 700;">${isPast || isActive ? '&#10003;' : ''}</div>
          <div style="font-size: 10px; line-height: 13px; color: ${isActive ? '#111827' : '#6b7280'}; font-weight: ${isActive ? '700' : '400'};">${step}</div>
        </td>`
      }).join('')}
    </tr></table>
    ${isException ? `<div style="margin-top: 12px; text-align: center; color: #dc2626; font-size: 12px; font-weight: 700;">${escapeHtml(normalized)}</div>` : ''}
  </div>`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Security check: service_role or secret header
  const authHeader = req.headers.get('Authorization')
  if (!authHeader && !Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  try {
    const { bookingId, newStatus, remarks, reminder = false } = await req.json()

    // Fetch booking + customer info
    const { data: booking, error: bError } = await supabase
      .from('bookings')
      .select(`
        id,
        customer_id,
        customer_name,
        customer_email,
        total_amount,
        start_datetime,
        profiles:profiles!bookings_customer_id_fkey (
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
    const email = customer?.email || booking.customer_email
    const name = escapeHtml(customer?.full_name || booking.customer_name || 'Valued Customer')
    const statusKey = newStatus.toUpperCase()
    const appointmentDate = booking.start_datetime
      ? new Date(booking.start_datetime).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })
      : 'your scheduled time'

    if (!email) {
      throw new Error('No customer email found for this booking.')
    }
    
    const subject = reminder
      ? `Reminder: Your confirmed Speedway appointment is in 1 hour`
      : `Speedway Update: Booking #${bookingId.slice(0, 8).toUpperCase()} is now ${statusKey}`
    const content = reminder
      ? `This is a reminder that your confirmed appointment is scheduled for ${appointmentDate}. Please arrive on time. If service has not started within one hour after your scheduled time, the booking will be flagged as a No-Show.`
      : templates[statusKey] || `Your booking status has been updated to ${newStatus}.`
    
    const reasonHtml = remarks ? `<p style="margin-top: 15px; padding: 10px; background: #222; border-left: 4px solid #a91b18;"><strong>Note/Reason:</strong> ${remarks}</p>` : ''

    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 640px; margin: 0 auto; background: #ffffff; color: #111827; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background: #a91b18; padding: 22px; text-align: center; color: #ffffff;"><h1 style="margin: 0; font-size: 23px; letter-spacing: 2px;">SPEEDWAY AUTOXMOTO</h1></div>
        <div style="padding: 30px;">
          <h2 style="color: #a91b18; margin: 0 0 18px;">${reminder ? 'Appointment Reminder' : 'Booking Status Update'}</h2>
          <p style="font-size: 16px;">Hi ${name},</p>
          <p style="font-size: 15px; line-height: 1.6;">${escapeHtml(content)}</p>
          ${renderLifecycle(statusKey)}
          <table role="presentation" style="width: 100%; border-collapse: collapse; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px;">
            <tr><td style="padding: 12px 14px; color: #6b7280; font-size: 13px;">Booking ID</td><td style="padding: 12px 14px; text-align: right; font-weight: 700; font-size: 13px;">${escapeHtml(bookingId)}</td></tr>
            <tr><td style="padding: 12px 14px; color: #6b7280; font-size: 13px;">Total Amount</td><td style="padding: 12px 14px; text-align: right; font-weight: 700; font-size: 13px;">₱${Number(booking.total_amount || 0).toLocaleString()}</td></tr>
            <tr><td style="padding: 12px 14px; color: #6b7280; font-size: 13px;">Scheduled Time</td><td style="padding: 12px 14px; text-align: right; font-weight: 700; font-size: 13px;">${escapeHtml(appointmentDate)}</td></tr>
          </table>
          ${reasonHtml}
          <div style="margin-top: 28px; text-align: center;"><a href="https://speedway-autoxmoto.com/portal" style="background: #a91b18; color: #ffffff; padding: 13px 26px; text-decoration: none; border-radius: 5px; font-weight: 700; display: inline-block;">VIEW IN PORTAL</a></div>
        </div>
        <div style="background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #6b7280;">&copy; 2024 Speedway AutoxMoto. All Rights Reserved.</div>
      </div>`

    const { data, error } = await resend.emails.send({
      from: resendFrom,
      to: [email],
      subject: subject,
      html: html,
    })

    if (error) {
      throw error
    }

    return new Response(JSON.stringify({ ok: true, data }), {
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
