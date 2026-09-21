import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json();
    const { bookingId, refundReference } = body;

    if (!bookingId || !refundReference) {
      throw new Error('Missing bookingId or refundReference in request payload.');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const authHeader = req.headers.get('Authorization');
    const accessToken = authHeader?.replace(/^Bearer\s+/i, '');
    if (!accessToken) throw new Error('Authentication is required.');

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
    if (userError || !user) throw new Error('Authenticated user not found.');

    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (adminProfile?.role?.toUpperCase() !== 'ADMIN') {
      throw new Error('Administrator access is required.');
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        customer:profiles!bookings_customer_id_fkey(full_name, email),
        vehicles:booking_vehicles!booking_vehicles_booking_id_fkey(*, services:booking_vehicle_services(*))
      `)
      .eq('id', bookingId)
      .single();
    if (bookingError || !booking) throw new Error(`Booking not found: ${bookingError?.message || 'Unknown error'}`);

    const { data: refundPayment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('amount, reference_number, refund_reason')
      .eq('booking_id', bookingId)
      .eq('method', 'SYSTEM_REFUND')
      .eq('reference_number', refundReference)
      .eq('status', 'REFUNDED')
      .lt('amount', 0)
      .single();
    if (paymentError || !refundPayment) throw new Error(`Valid refund ledger entry not found: ${paymentError?.message || 'Unauthorized or missing'}`);

    const escapeHtml = (value: unknown) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    const customerEmail = booking.customer?.email || booking.customer_email;
    const customerName = booking.customer?.full_name || booking.customer_name || 'Customer';
    const refundAmount = Math.abs(Number(refundPayment.amount || 0));
    const refundReason = refundPayment.refund_reason || 'Administrative refund processed';
    const bookingDate = booking.start_datetime ? new Date(booking.start_datetime).toLocaleDateString() : '';
    const scheduledTime = booking.start_datetime ? new Date(booking.start_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const serviceNames = (booking.vehicles || [])
      .flatMap((vehicle: any) => (vehicle.services || []).map((service: any) => service.service_name))
      .filter(Boolean);
    const vehicleNames = (booking.vehicles || [])
      .map((vehicle: any) => [vehicle.brand, vehicle.model, vehicle.plate_number].filter(Boolean).join(' '))
      .filter(Boolean);

    if (!customerEmail) throw new Error('No customer email found for this booking.');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) throw new Error('Missing RESEND_API_KEY environment variable.');
    const resendFrom = Deno.env.get('RESEND_FROM') || 'Speedway AutoXMoto <billing@speedwayautoxmoto.com>';

    const serviceHtml = serviceNames.length
      ? `<p><strong>Services:</strong> ${serviceNames.map(escapeHtml).join(', ')}</p>`
      : '';
    const vehicleHtml = vehicleNames.length
      ? `<p><strong>Vehicles:</strong> ${vehicleNames.map(escapeHtml).join(', ')}</p>`
      : '';

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #ef4444; padding: 20px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">OFFICIAL REFUND SLIP</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Speedway AutoXMoto</p>
        </div>
        <div style="padding: 20px;">
          <p>Hi ${escapeHtml(customerName)},</p>
          <p>We have successfully processed a refund for your recent cancellation. Please find the details of your refund below:</p>
          
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Original Invoice ID:</strong> INV-${bookingId.substring(0, 8).toUpperCase()}</p>
            <p style="margin: 5px 0;"><strong>Refund Reference:</strong> ${escapeHtml(refundReference)}</p>
            <p style="margin: 5px 0;"><strong>Total Amount Reverted:</strong> ₱${refundAmount.toLocaleString()}</p>
            <p style="margin: 5px 0;"><strong>Reason for Refund:</strong> ${escapeHtml(refundReason)}</p>
            ${bookingDate ? `<p style="margin: 5px 0;"><strong>Booking Date:</strong> ${escapeHtml(bookingDate)}</p>` : ''}
            ${scheduledTime ? `<p style="margin: 5px 0;"><strong>Scheduled Time:</strong> ${escapeHtml(scheduledTime)}</p>` : ''}
            ${serviceHtml}
            ${vehicleHtml}
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
        to: [customerEmail],
        subject: `Refund Processed: INV-${bookingId.substring(0, 8).toUpperCase()}`,
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
