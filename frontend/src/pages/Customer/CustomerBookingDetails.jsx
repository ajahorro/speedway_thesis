import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import {
  ArrowLeft, Clock, Car, ShieldCheck,
  CreditCard, FileText, MessageCircle, ChevronRight, AlertCircle, Package, Printer, CheckCircle2, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cancelBooking, rescheduleBooking } from '../../services/bookingService';
import { getStatusColor } from '../../utils/bookingHelpers';
import { useUnifiedData } from '../../context/UnifiedContext';
import { useGlobalChat } from '../../context/ChatContext';
import FloatingBubbleChat from '../../components/FloatingBubbleChat';
import BookingSummaryHeader from '../../components/BookingSummaryHeader';
import OfficialReceipt from '../../components/OfficialReceipt';
import QRMagnifier from '../../components/QRMagnifier';
import { useConfig } from '../../context/ConfigContext';
import CustomCalendar from '../../components/BookingWizard/CustomCalendar';
import { getAvailableSlots, getBusinessHours } from '../../services/scheduleService';

const CustomerBookingDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refreshData } = useUnifiedData(); // Now safely inside the component!
  const { setActiveBookingId } = useGlobalChat();
  const { settings } = useConfig();

  useEffect(() => {
    setActiveBookingId(id);
    return () => setActiveBookingId(null);
  }, [id, setActiveBookingId]);

  const [booking, setBooking] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [receiptModal, setReceiptModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const [rescheduleSlotsLoading, setRescheduleSlotsLoading] = useState(false);
  const [businessHours, setBusinessHours] = useState(null);

  const formatCurrency = (val) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val);

  const receiptItems = selectedPayment
    ? [{ id: 'payment', name: 'Service Installment / Settlement Payment', price: Number(selectedPayment.amount || 0) }]
    : vehicles.flatMap((v) => (v.services || []).map((s) => ({
        id: s.id || `${v.id}-${s.service_name || s.service_name_snapshot || 'service'}`,
        name: s.service_name || s.service_name_snapshot || 'Service',
        price: Number(s.price || s.price_snapshot || 0),
      })));

  // confirmCancellation now lives INSIDE the component where it has access to all state and hooks!
  const confirmCancellation = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    const toastId = toast.loading('Processing cancellation...');
    try {
      const result = await cancelBooking(id, cancelReason);

      if (result.success) {
        toast.success('Booking Cancelled & Refund Queued', { id: toastId });
        setShowCancelModal(false);

        await refreshData(); // Triggers the global context refresh instantly!

        fetchAll();
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to cancel booking', { id: toastId });
    } finally {
      setIsCancelling(false);
    }
  };

  const openRescheduleModal = () => {
    const start = booking?.start_datetime ? new Date(booking.start_datetime) : new Date();
    setRescheduleDate(`${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`);
    setRescheduleTime(`${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`);
    setRescheduleSlots([]);
    setShowRescheduleModal(true);
  };

  useEffect(() => {
    if (!showRescheduleModal || !rescheduleDate || !booking?.id) return;
    let active = true;
    const durationMinutes = Math.max(60, Math.ceil((new Date(booking.end_datetime) - new Date(booking.start_datetime)) / 60000));
    setRescheduleSlotsLoading(true);
    Promise.all([
      getAvailableSlots(rescheduleDate, durationMinutes, vehicles, booking.id),
      getBusinessHours()
    ]).then(([slots, hours]) => {
      if (!active) return;
      setRescheduleSlots(slots);
      setBusinessHours(hours);
      if (rescheduleTime && !slots.some(slot => slot.time === rescheduleTime)) setRescheduleTime('');
    }).catch(() => {
      if (active) setRescheduleSlots([]);
    }).finally(() => {
      if (active) setRescheduleSlotsLoading(false);
    });
    return () => { active = false; };
  }, [showRescheduleModal, rescheduleDate, booking?.id, booking?.start_datetime, booking?.end_datetime, vehicles]);

  const confirmReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime || isRescheduling) return;
    setIsRescheduling(true);
    const toastId = toast.loading('Rescheduling appointment...');
    try {
      const [clock, meridian] = rescheduleTime.split(' ');
      let [hours, minutes] = clock.split(':').map(Number);
      if (meridian === 'PM' && hours !== 12) hours += 12;
      if (meridian === 'AM' && hours === 12) hours = 0;
      const [year, month, day] = rescheduleDate.split('-').map(Number);
      const start = new Date(year, month - 1, day, hours, minutes, 0);
      if (Number.isNaN(start.getTime()) || start <= new Date()) {
        throw new Error('Choose a future date and time for the appointment.');
      }
      const originalStart = new Date(booking.start_datetime);
      const originalEnd = new Date(booking.end_datetime);
      const durationMs = Math.max(originalEnd - originalStart, 60 * 60 * 1000);
      const end = new Date(start.getTime() + durationMs);
      await rescheduleBooking(booking.id, start.toISOString(), end.toISOString());
      toast.success('Appointment rescheduled. Payment was preserved and bay/staff allocation was released.', { id: toastId });
      setShowRescheduleModal(false);
      await refreshData();
      fetchAll();
    } catch (err) {
      toast.error(err.message || 'Failed to reschedule appointment', { id: toastId });
    } finally {
      setIsRescheduling(false);
    }
  };

  // --- DATA FETCHING ---
  const fetchAll = async () => {
    setLoading(true);
    try {
      let actualBookingId = id;

      // 0. Handle short reference code lookups gracefully
      if (id && id.length <= 12 && !id.includes('-')) {
        const { data: refData, error: refErr } = await supabase
          .from('bookings')
          .select('id')
          .ilike('id', `${id}%`)
          .maybeSingle();

        if (refErr || !refData) {
          navigate('/customer/bookings');
          return;
        }
        actualBookingId = refData.id;
      }

      // 1. Booking
      const { data: bData, error: bErr } = await supabase
        .from('bookings').select('*').eq('id', actualBookingId).maybeSingle();
      if (bErr) throw bErr;
      if (!bData) return navigate('/customer/bookings');

      // 2. Staff profile
      let staff = null;
      if (bData.staff_id) {
        const { data: s } = await supabase.from('profiles')
          .select('first_name, last_name, email').eq('id', bData.staff_id).maybeSingle();
        staff = s;
      }

      // 3. Fetch Vehicles (Manual Join)
      const { data: vData, error: vError } = await supabase
        .from('booking_vehicles')
        .select('*')
        .eq('booking_id', actualBookingId)
        .order('created_at');

      if (vError) throw vError;

      let vehiclesWithServices = [];
      if (vData && vData.length > 0) {
        const vehicleIds = vData.map(v => v.id);
        const { data: sData } = await supabase
          .from('booking_vehicle_services')
          .select('*')
          .in('booking_vehicle_id', vehicleIds);

        vehiclesWithServices = vData.map(v => ({
          ...v,
          services: (sData || []).filter(s => s.booking_vehicle_id === v.id)
        }));
      }

      // 4. Payments
      const { data: pData } = await supabase
        .from('payments').select('*').eq('booking_id', actualBookingId).order('created_at', { ascending: true });

      const processedPayments = (pData || []).map(p => {
        let url = p.receipt_url;
        if (url && !url.startsWith('http')) {
          const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(url);
          url = publicUrl;
        }
        return { ...p, receipt_url: url };
      });

      const totalPaid = processedPayments.filter(p => p.status === 'PAID' || p.status === 'REFUNDED').reduce((sum, p) => sum + Number(p.amount), 0);

      setBooking({ ...bData, assigned_staff: staff, totalPaid });
      setVehicles(vehiclesWithServices);
      setPayments(processedPayments);
    } catch (err) {
      console.error('Fetch error:', err);
      toast.error('Failed to load booking.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const channel = supabase.channel(`customer-booking-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `id=eq.${id}` }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `booking_id=eq.${id}` }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_vehicles', filter: `booking_id=eq.${id}` }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]); // eslint-disable-line

  // --- STYLES ---
  const cardStyle = { background: 'var(--admin-card)', borderRadius: 'var(--admin-radius-lg)', border: '1px solid var(--admin-border)', padding: '1.5rem', boxShadow: 'var(--admin-card-shadow)' };
  const labelStyle = { fontSize: '0.7rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' };
  const valStyle = { fontSize: '0.95rem', fontWeight: '900', color: 'var(--admin-text-primary)' };

  const handleDownloadPdf = () => {
    const total = Number(selectedPayment?.amount || booking.total_amount || 0);
    const subtotal = total > 0 ? total / 1.12 : 0;
    const vat = total > 0 ? total - subtotal : 0;
    const items = selectedPayment
      ? [{ name: 'Service Installment / Settlement Payment', amount: Number(selectedPayment.amount || 0) }]
      : receiptItems;

    const popup = window.open('', '_blank', 'width=900,height=900');
    if (!popup) {
      toast.error('Please allow pop-ups to download the PDF receipt.');
      return;
    }

    popup.document.write(`<!doctype html>
      <html>
        <head>
          <title>Official Digital Receipt</title>
          <style>
            body { font-family: Arial, sans-serif; background: #fff; color: #111; margin: 0; padding: 32px; }
            .wrap { max-width: 720px; margin: 0 auto; border: 1px solid #111; border-radius: 16px; padding: 24px; }
            .brand { text-align: center; margin-bottom: 24px; }
            h1 { margin: 0; font-size: 2.2rem; letter-spacing: 2px; color: #a91b18; }
            .subtitle { font-size: 12px; letter-spacing: 2px; color: #666; text-transform: uppercase; }
            .line { height: 2px; background: #000; width: 48px; margin: 12px auto 0; }
            .meta { display: flex; justify-content: space-between; gap: 16px; margin: 20px 0; }
            .meta div { flex: 1; }
            .label { font-size: 11px; font-weight: 800; color: #666; text-transform: uppercase; letter-spacing: 1px; }
            .item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
            .total-row { display: flex; justify-content: space-between; padding-top: 12px; font-weight: 800; }
            .balance { border-top: 2px solid #000; margin-top: 12px; padding-top: 12px; }
            .foot { text-align: center; margin-top: 24px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="wrap">
            <div class="brand">
              <h1>SPEEDWAY</h1>
              <div class="subtitle">AutoxMoto Detail Studio</div>
              <div class="line"></div>
            </div>
            <div class="meta">
              <div>
                <div class="label">Customer</div>
                <div>${booking.customer_name || user?.user_metadata?.full_name || 'Valued Customer'}</div>
              </div>
              <div style="text-align:right;">
                <div class="label">Date & Time</div>
                <div>${new Date(selectedPayment?.created_at || booking.created_at).toLocaleString()}</div>
              </div>
            </div>
            <div class="label" style="margin-bottom: 8px;">Service Summary</div>
            ${items.map(item => `<div class="item"><span>• ${item.name}</span><strong>${formatCurrency(item.amount)}</strong></div>`).join('')}
            <div class="total-row"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>
            <div class="total-row"><span>VAT (12%)</span><span>${formatCurrency(vat)}</span></div>
            <div class="total-row balance"><span>Grand Total</span><span>${formatCurrency(total)}</span></div>
            <div class="foot">Transaction Reference: ${selectedPayment?.reference_number || payments?.[0]?.reference_number || 'SYSTEM_VALIDATED'}</div>
          </div>
        </body>
      </html>
    `);
    popup.document.close();
    setTimeout(() => popup.print(), 300);
  };

  const handlePrintReceipt = () => {
    const receiptNode = document.getElementById('printable-receipt');
    if (!receiptNode) {
      return;
    }

    const originalTitle = document.title;
    document.title = 'Official Digital Receipt';
    window.print();
    document.title = originalTitle;
  };

  // Status color now from shared helper (bookingHelpers.js)

  if (loading || !booking) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--admin-brand)', fontWeight: '900' }}>
        Loading booking details...
      </div>
    );
  }

  const dt = booking.start_datetime ? new Date(booking.start_datetime) : null;
  const dateStr = dt ? dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD';
  const timeStr = dt ? dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
  const balance = Math.max(0, (booking.total_amount || 0) - (booking.totalPaid || 0));
  const selectedRescheduleSlot = rescheduleSlots.some(slot => slot.time === rescheduleTime);

  // 🚀 DERIVED STATE: Ensure UI reflects reality even if master status lags
  const vehicleStatuses = (vehicles || []).map(v => v.status?.toUpperCase());
  const anyUnitStarted = vehicleStatuses.includes('IN_PROGRESS');
  const allUnitsFinished = vehicleStatuses.length > 0 && vehicleStatuses.every(s => s === 'COMPLETED' || s === 'CANCELLED');
  const isFullySettled = (booking.total_amount || 0) > 0 && balance === 0;

  // Real-time derived status for UI responsiveness
  let derivedStatus = (booking.status || 'scheduled').toLowerCase();

  // Auto-advance logic for UI
  if (anyUnitStarted && derivedStatus === 'scheduled') derivedStatus = 'in_progress';

  // Hard completion: All units done AND payment settled
  if (allUnitsFinished && isFullySettled && derivedStatus !== 'cancelled') derivedStatus = 'completed';

  const summaryBooking = {
    ...booking,
    status: derivedStatus,
    assigned_staff: booking.assigned_staff
      ? { ...booking.assigned_staff, full_name: `${booking.assigned_staff.first_name || ''} ${booking.assigned_staff.last_name || ''}`.trim() }
      : null
  };

  return (
    <>
      <style>{`
        .customer-booking-columns {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
          gap: 1.5rem;
          align-items: start;
        }
        .billing-balance-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(240px, .8fr);
          gap: 1.5rem;
          align-items: start;
        }
        @media (max-width: 900px) {
          .customer-booking-columns,
          .billing-balance-grid {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', paddingBottom: '5rem' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--admin-text-primary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Booking Reference</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '950', color: 'var(--admin-text-primary)', fontFamily: 'monospace' }}>#{id.substring(0, 8).toUpperCase()}</h1>
            {['confirmed', 'completed'].includes(booking.status) && (
              <button
                onClick={() => navigate(`/customer/receipt/${id}`)}
                style={{
                  padding: '0.4rem 0.8rem', background: 'rgba(var(--admin-success-rgb), 0.1)',
                  border: '1px solid var(--admin-success)', color: 'var(--admin-success)',
                  borderRadius: 'var(--admin-radius-sm)', fontSize: '0.65rem', fontWeight: '950',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', textTransform: 'uppercase'
                }}
              >
                <Printer size={12} /> Print Official Receipt
              </button>
            )}
          </div>
        </div>
      </div>

      <BookingSummaryHeader
        booking={summaryBooking}
        showCustomer={false}
        showTechnician
        paymentStatus={{ balance, totalPaid: booking.totalPaid }}
      />

      {/* ===== A. BOOKING STATUS ===== */}
      {booking.refund_status === 'PROCESSED' && (
        <div style={cardStyle}>
          <div style={{
            marginBottom: '1.5rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid #ef4444', borderRadius: 'var(--admin-radius-sm)',
            display: 'flex', alignItems: 'center', gap: '1rem'
          }}>
            <ShieldCheck color="#ef4444" size={24} />
            <div>
              <div style={{ fontWeight: '950', color: '#ef4444', fontSize: '0.9rem', textTransform: 'uppercase' }}>Financial Reversal Finalized</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)', fontWeight: '600' }}>
                A refund has been processed for this cancelled booking. Please check your financial provider for the reflected amount.
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="customer-booking-columns">

        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* ===== E. SERVICE BREAKDOWN ===== */}
          {vehicles.map((v, vIdx) => (
            <div key={v.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--admin-border)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--admin-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--admin-border)' }}>
                    <Car size={22} color="var(--admin-brand)" />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontWeight: '950', fontSize: '1.1rem', color: 'var(--admin-text-primary)' }}>{v.brand} {v.model}</h4>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>{v.plate_number} · {v.vehicle_type}</span>
                  </div>
                </div>
                <div style={{
                  fontSize: '0.65rem', fontWeight: '950', padding: '0.3rem 0.6rem', borderRadius: '4px', textTransform: 'uppercase',
                  background: v.status === 'completed' ? 'rgba(16,185,129,0.1)' : v.status === 'in_progress' ? 'rgba(168,85,247,0.1)' : v.status === 'QUEUED' ? 'rgba(245,158,11,0.1)' : 'var(--admin-input-bg)',
                  color: v.status === 'completed' ? '#10b981' : v.status === 'in_progress' ? '#a855f7' : v.status === 'QUEUED' ? '#f59e0b' : 'var(--admin-text-secondary)',
                  border: '1px solid currentColor'
                }}>
                  {v.status === 'QUEUED' ? 'QUEUED' : (v.status || 'pending').toUpperCase()}
                </div>
              </div>

              {/* Service Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(v.services || []).map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--admin-bg)', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Package size={14} color="var(--admin-brand)" />
                      <span style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--admin-text-primary)' }}>{s.service_name || s.service_name_snapshot}</span>
                    </div>
                    <span style={{ fontSize: '0.95rem', fontWeight: '950', color: 'var(--admin-brand)' }}>₱{(s.price || s.price_snapshot || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              {/* Vehicle Subtotal */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--admin-border)' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>
                  Vehicle Total: ₱{(v.subtotal || (v.services || []).reduce((sum, s) => sum + Number(s.price || s.price_snapshot || 0), 0)).toLocaleString()}
                </span>
              </div>

              {/* REQ-ADM-15: TECHNICAL DOCUMENTATION (Photos & Notes) */}
              <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--admin-border)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '1.5rem' }}>
                  <div>
                    <div style={labelStyle}>Service Started</div>
                    <div style={v.started_at ? valStyle : { ...valStyle, opacity: 0.2 }}>
                      {v.started_at ? new Date(v.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}
                    </div>
                  </div>
                  <div>
                    <div style={labelStyle}>Service Finished</div>
                    <div style={v.completed_at ? { ...valStyle, color: 'var(--admin-success)' } : { ...valStyle, opacity: 0.2 }}>
                      {v.completed_at ? new Date(v.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}
                    </div>
                  </div>
                </div>

                {(v.service_notes || v.photo_proof_url) && (
                  <div style={{ display: 'flex', gap: '1.5rem' }}>
                    {v.photo_proof_url && (
                      <div
                        onClick={() => window.open(v.photo_proof_url, '_blank')}
                        style={{ width: '80px', height: '80px', borderRadius: '8px', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', overflow: 'hidden', cursor: 'zoom-in', flexShrink: 0 }}
                      >
                        <img src={v.photo_proof_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Service Evidence" />
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ ...labelStyle, color: 'var(--admin-brand)', marginBottom: '0.4rem' }}>Technician Detailing Notes</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)', fontWeight: '600', fontStyle: 'italic', lineHeight: 1.5 }}>
                        "{v.service_notes || 'No detailing notes provided by technician.'}"
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* ===== B. PAYMENT PANEL ===== */}
          {false && <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '950', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--admin-text-primary)' }}>
                <CreditCard size={18} /> Payment History
              </h3>
              <div style={{ fontSize: '1.5rem', fontWeight: '950', color: 'var(--admin-brand)' }}>₱{(booking.total_amount || 0).toLocaleString()}</div>
            </div>

            {payments.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--admin-text-secondary)', fontSize: '0.85rem', fontWeight: '600', background: 'var(--admin-bg)', borderRadius: 'var(--admin-radius-md)', border: '1px dashed var(--admin-border)' }}>
                No payments recorded yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {payments.map((p, idx) => (
                  <div key={p.id} style={{ background: 'var(--admin-bg)', borderRadius: 'var(--admin-radius-md)', border: '1px solid var(--admin-border)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', gap: '1rem', padding: '1rem' }}>
                      {p.receipt_url && (
                        <div style={{ width: '70px', height: '70px', borderRadius: 'var(--admin-radius-sm)', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--admin-border)' }}>
                          <img src={p.receipt_url} alt="Receipt" style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }} onClick={() => window.open(p.receipt_url, '_blank')} />
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: '900', fontSize: '0.85rem', color: p.status === 'REFUNDED' ? '#ef4444' : 'var(--admin-text-primary)' }}>
                              {p.status === 'REFUNDED' ? 'REFUND RECORD' : 'PAYMENT'} #{idx + 1} • {p.method}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-secondary)', fontWeight: '800' }}>{new Date(p.created_at).toLocaleString()}</div>
                          </div>
                          <div style={{
                            fontSize: '0.6rem', fontWeight: '950', padding: '0.2rem 0.5rem', borderRadius: '4px',
                            background: p.status === 'PAID' ? 'rgba(16,185,129,0.1)' : p.status === 'REJECTED' || p.status === 'REFUNDED' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                            color: p.status === 'PAID' ? '#10b981' : p.status === 'REJECTED' || p.status === 'REFUNDED' ? '#ef4444' : '#f59e0b',
                            border: '1px solid currentColor'
                          }}>
                            {p.status}
                          </div>
                        </div>
                        <div style={{ fontWeight: '950', fontSize: '1.1rem', marginTop: '0.25rem', color: p.status === 'REFUNDED' ? '#ef4444' : 'var(--admin-text-primary)' }}>
                          {p.amount < 0 ? '-' : ''}₱{Math.abs(p.amount || 0).toLocaleString()}
                        </div>
                        {p.status === 'REJECTED' && p.rejection_reason && (
                          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#ef4444', background: 'rgba(239,68,68,0.05)', padding: '0.5rem', borderRadius: '4px' }}>
                            <AlertCircle size={12} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} /> {p.rejection_reason}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Balance Bar */}
            <div style={{
              marginTop: '1.5rem', padding: '1rem', borderRadius: 'var(--admin-radius-md)', textAlign: 'center', fontWeight: '950', fontSize: '0.9rem',
              background: balance === 0 ? 'rgba(16,185,129,0.05)' : 'rgba(245,158,11,0.05)',
              color: balance === 0 ? '#10b981' : '#f59e0b',
              border: `1px solid ${balance === 0 ? '#10b981' : '#f59e0b'}`
            }}>
              {balance === 0 ? 'FULLY SETTLED' : `OUTSTANDING BALANCE: ₱${balance.toLocaleString()}`}
            </div>
          </div>}
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* ===== D. RECEIPT SECTION — Appointment Info ===== */}
          {false && <div style={cardStyle}>
            <div style={labelStyle}>Appointment Details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ ...labelStyle, marginBottom: 0 }}>Date</span>
                <span style={valStyle}>{dateStr}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ ...labelStyle, marginBottom: 0 }}>Time</span>
                <span style={valStyle}>{timeStr}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ ...labelStyle, marginBottom: 0 }}>Status</span>
                <span style={{ ...valStyle, color: getStatusColor(derivedStatus), textTransform: 'uppercase' }}>{derivedStatus}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ ...labelStyle, marginBottom: 0 }}>Vehicles</span>
                <span style={valStyle}>{vehicles.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ ...labelStyle, marginBottom: 0 }}>Total</span>
                <span style={{ ...valStyle, color: 'var(--admin-brand)' }}>₱{(booking.total_amount || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>}

          {/* ===== B. BILLING & TRANSACTIONS ===== */}
          <div style={cardStyle}>
            <div className={balance > 0 ? 'billing-balance-grid' : undefined}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.8rem', fontWeight: '950', color: 'var(--admin-text-primary)', textTransform: 'uppercase' }}>Billing & Transactions</h3>
              <CreditCard size={18} color="var(--admin-brand)" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {payments.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)', fontStyle: 'italic' }}>No transactions recorded yet.</div>
              ) : payments.map(p => (
                <div key={p.id} style={{ background: 'var(--admin-bg)', padding: '1rem', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>{['GCASH', 'DIGITAL'].includes(String(p.method || '').toUpperCase()) ? 'DIGITAL PAYMENT' : (p.method || 'Online Payment')}</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: '950', color: p.status === 'PAID' ? 'var(--admin-success)' : 'var(--admin-warning)' }}>{formatCurrency(p.amount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--admin-text-secondary)' }}>{new Date(p.created_at).toLocaleDateString()}</span>
                    <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {p.receipt_url && ['GCASH', 'DIGITAL'].includes(String(p.method || '').toUpperCase()) && (
                      <button
                        type="button"
                        onClick={() => window.open(p.receipt_url, '_blank')}
                        style={{ background: 'transparent', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', padding: '0.35rem 0.6rem', borderRadius: '4px', fontSize: '0.6rem', fontWeight: '950', cursor: 'pointer' }}
                      >
                        VIEW PROOF OF PAYMENT
                      </button>
                    )}
                    {p.status === 'PAID' && (
                      <button
                        onClick={() => { setSelectedPayment(p); setReceiptModal(true); }}
                        style={{ background: 'transparent', border: '1px solid var(--admin-brand)', color: 'var(--admin-brand)', padding: '0.35rem 0.6rem', borderRadius: '4px', fontSize: '0.6rem', fontWeight: '950', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <Printer size={12} /> RECEIPT
                      </button>
                    )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px dashed var(--admin-border)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>BALANCE REMAINING</span>
              <span style={{ fontSize: '1rem', fontWeight: '950', color: 'var(--admin-warning)' }}>{formatCurrency(Math.max(0, (booking.total_amount || 0) - (booking.totalPaid || 0)))}</span>
            </div>
          </div>
          {balance > 0 && (
            <div>
              <div style={labelStyle}>Outstanding Balance</div>
              <div style={{ fontSize: '1.8rem', fontWeight: '950', color: 'var(--admin-warning)', margin: '.35rem 0 1rem' }}>{formatCurrency(balance)}</div>
              <div style={{ fontSize: '.75rem', color: 'var(--admin-text-secondary)', lineHeight: 1.5, marginBottom: '.5rem' }}>Complete the remaining payment using the studio's digital payment details.</div>
              <QRMagnifier qrUrl={settings.PAYMENT_QR_URL} accountName={settings.PAYMENT_ACCOUNT_NAME} accountNumber={settings.PAYMENT_ACCOUNT_NUMBER} standalone />
            </div>
          )}
          </div>
          </div>

          {/* ===== ACTIONS ===== */}
          {(['scheduled', 'confirmed'].includes(derivedStatus)) && (
            <div style={{ ...cardStyle, border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.02)' }}>
              <div style={{ ...labelStyle, color: '#ef4444' }}>Danger Zone</div>
              <p style={{ margin: '0.5rem 0 1rem 0', fontSize: '0.8rem', color: 'var(--admin-text-secondary)', fontWeight: '600' }}>
                {derivedStatus === 'scheduled'
                  ? "Need to cancel? You can cancel your appointment now."
                  : "This appointment is currently locked for service. Cancellations are no longer permitted."}
                {booking.totalPaid > 0 && derivedStatus === 'scheduled' && " Since a payment was detected, a refund request will be automatically filed."}
              </p>
              <button
                disabled={derivedStatus !== 'scheduled'}
                onClick={() => setShowCancelModal(true)}
                style={{
                  width: '100%', padding: '0.85rem',
                  background: derivedStatus === 'scheduled' ? 'transparent' : 'var(--admin-input-bg)',
                  border: `1px solid ${derivedStatus === 'scheduled' ? '#ef4444' : 'var(--admin-border)'}`,
                  color: derivedStatus === 'scheduled' ? '#ef4444' : 'var(--admin-text-secondary)',
                  borderRadius: 'var(--admin-radius-sm)', fontWeight: '950', fontSize: '0.75rem',
                  cursor: derivedStatus === 'scheduled' ? 'pointer' : 'not-allowed',
                  textTransform: 'uppercase'
                }}
              >
                {derivedStatus === 'scheduled' ? 'Cancel Appointment' : 'Service Ongoing / Locked'}
              </button>
              <button
                onClick={openRescheduleModal}
                style={{ width: '100%', padding: '0.85rem', marginTop: '0.75rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-brand)', color: 'var(--admin-brand)', borderRadius: 'var(--admin-radius-sm)', fontWeight: '950', fontSize: '0.75rem', cursor: 'pointer', textTransform: 'uppercase' }}
              >
                Reschedule Appointment
              </button>
            </div>
          )}

          {showRescheduleModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)', padding: '1rem' }}>
              <div style={{ background: 'var(--admin-card)', padding: 'clamp(1.25rem, 4vw, 2rem)', borderRadius: 'var(--admin-radius-lg)', border: '1px solid var(--admin-border)', maxWidth: '520px', width: '100%', maxHeight: '92vh', overflowY: 'auto', boxSizing: 'border-box', position: 'relative' }}>
                <button onClick={() => setShowRescheduleModal(false)} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
                <h3 style={{ margin: '0 0 0.75rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>Reschedule Appointment</h3>
                <p style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem', lineHeight: 1.5 }}>Your payment is preserved. The current staff and bay allocation will be released and the booking will return to Scheduled.</p>
                <label style={{ ...labelStyle, display: 'block', marginTop: '1rem' }}>New Date</label>
                <CustomCalendar selectedDate={rescheduleDate} onDateSelect={setRescheduleDate} />
                <div style={{ marginTop: '1rem', padding: '.75rem 1rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', color: 'var(--admin-text-secondary)', fontSize: '.75rem', fontWeight: '800' }}>
                  Working hours: {businessHours ? `${businessHours.opening} - ${businessHours.closing}` : 'Loading...'}
                </div>
                <label style={{ ...labelStyle, display: 'block', marginTop: '1rem' }}>Available Time Slots</label>
                {rescheduleSlotsLoading ? (
                  <div style={{ padding: '1rem', color: 'var(--admin-brand)', fontWeight: '900', textAlign: 'center' }}>Checking available bays...</div>
                ) : rescheduleSlots.length === 0 ? (
                  <div style={{ padding: '1rem', color: '#ef4444', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 'var(--admin-radius-sm)', fontSize: '.75rem', fontWeight: '800' }}>No available slots for this date. Choose another date.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '.5rem', maxHeight: 'clamp(150px, 28vh, 240px)', overflowY: 'auto', paddingRight: '.25rem' }}>
                    {rescheduleSlots.map(slot => (
                      <button key={slot.time} type="button" onClick={() => setRescheduleTime(slot.time)} style={{ padding: '.65rem .4rem', background: rescheduleTime === slot.time ? 'var(--admin-brand)' : 'var(--admin-bg)', color: rescheduleTime === slot.time ? '#fff' : 'var(--admin-text-primary)', border: `1px solid ${rescheduleTime === slot.time ? 'var(--admin-brand)' : 'var(--admin-border)'}`, borderRadius: 'var(--admin-radius-sm)', fontWeight: '900', cursor: 'pointer', fontSize: '.75rem' }}>
                        {slot.time}<small style={{ display: 'block', marginTop: '.25rem', opacity: .75 }}>{slot.availableBays} bay{slot.availableBays === 1 ? '' : 's'} open</small>
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button onClick={() => setShowRescheduleModal(false)} style={{ flex: 1, padding: '1rem', background: 'transparent', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', borderRadius: 'var(--admin-radius-sm)', fontWeight: '900' }}>GO BACK</button>
                  <button type="button" onClick={confirmReschedule} disabled={!rescheduleDate || !selectedRescheduleSlot || isRescheduling} title={!selectedRescheduleSlot ? 'Select an available time slot first' : 'Confirm reschedule'} style={{ flex: 1, padding: '1rem', background: selectedRescheduleSlot && !isRescheduling ? 'var(--admin-brand)' : 'var(--admin-border)', border: 'none', color: selectedRescheduleSlot && !isRescheduling ? 'white' : 'var(--admin-text-secondary)', borderRadius: 'var(--admin-radius-sm)', fontWeight: '900', opacity: 1, cursor: selectedRescheduleSlot && !isRescheduling ? 'pointer' : 'not-allowed' }}>{isRescheduling ? 'Processing...' : selectedRescheduleSlot ? 'CONFIRM' : 'SELECT A TIME'}</button>
                </div>
              </div>
            </div>
          )}

          {/* CANCELLATION MODAL */}
          {showCancelModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)' }}>
              <div style={{ background: 'var(--admin-card)', padding: '2.5rem', borderRadius: 'var(--admin-radius-lg)', border: '1px solid var(--admin-border)', maxWidth: '450px', width: '90%', position: 'relative' }}>
                <button onClick={() => setShowCancelModal(false)} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <AlertCircle size={40} color="#ef4444" style={{ marginBottom: '1rem' }} />
                  <h3 style={{ margin: 0, fontWeight: '950', fontSize: '1.25rem', color: 'var(--admin-text-primary)' }}>Confirm Cancellation?</h3>
                  <p style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem', fontWeight: '600' }}>
                    Please provide a reason for cancelling this appointment.
                    {booking.totalPaid > 0 && " A refund request will be initiated automatically."}
                  </p>
                </div>

                <textarea
                  placeholder="e.g. Change of plans / Conflict in schedule..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  style={{ width: '100%', padding: '1rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', color: 'var(--admin-text-primary)', minHeight: '100px', resize: 'none', outline: 'none', fontSize: '0.9rem', fontWeight: '600', marginBottom: '1.5rem' }}
                />

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button onClick={() => setShowCancelModal(false)} style={{ flex: 1, padding: '1rem', background: 'transparent', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', borderRadius: 'var(--admin-radius-sm)', fontWeight: '900', cursor: 'pointer' }}>GO BACK</button>
                  <button
                    disabled={!cancelReason.trim() || isCancelling}
                    onClick={confirmCancellation}
                    style={{
                      flex: 1,
                      padding: '1rem',
                      background: '#ef4444',
                      border: 'none',
                      color: 'white',
                      borderRadius: 'var(--admin-radius-sm)',
                      fontWeight: '900',
                      cursor: (!cancelReason.trim() || isCancelling) ? 'not-allowed' : 'pointer',
                      opacity: (!cancelReason.trim() || isCancelling) ? 0.5 : 1
                    }}
                  >
                    {isCancelling ? 'Processing...' : 'CONFIRM'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
      {receiptModal && (
        <OfficialReceipt
<<<<<<< HEAD
          booking={booking}
          vehicles={vehicles}
          user={user}
          selectedPayment={selectedPayment}
          onClose={() => { setReceiptModal(false); setSelectedPayment(null); }}
          mode="modal"
=======
          title="OFFICIAL RECEIPT"
          receiptNumber={selectedPayment?.reference_number || payments?.[0]?.reference_number || `INV-${(booking.id || '').slice(0, 8).toUpperCase()}`}
          bookingReference={booking.id}
          issuedAt={selectedPayment?.created_at || booking.created_at}
          paymentMethod={selectedPayment?.method || 'Digital / Online Payment'}
          processedBy="System Admin"
          customerName={booking.customer_name || user?.user_metadata?.full_name || 'Valued Customer'}
          customerContact={user?.email || booking.customer_phone || '-'}
          customerAddress={booking.customer_address || '-'}
          customerTaxId={booking.customer_tax_id || '-'}
          items={selectedPayment ? [{
            vehicle: 'Payment Record',
            service: 'Service Installment / Settlement Payment',
            qty: 1,
            unitPrice: Number(selectedPayment.amount || 0),
            lineTotal: Number(selectedPayment.amount || 0)
          }] : (receiptItems.length ? receiptItems : [{
            vehicle: 'Booking Summary',
            service: 'Booking Service Summary',
            qty: 1,
            unitPrice: Number(booking.total_amount || 0),
            lineTotal: Number(booking.total_amount || 0)
          }])}
          subtotal={Number((selectedPayment?.amount || booking.total_amount || 0) / 1.12)}
          discountAmount={0}
          vatRate={0.12}
          onClose={() => { setReceiptModal(false); setSelectedPayment(null); }}
          showCloseButton
>>>>>>> e23099d5 (Logic inconsistencies still exists)
        />
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-receipt, #printable-receipt * { visibility: visible; }
          #printable-receipt { position: absolute; left: 0; top: 0; width: 100%; background: #fff !important; color: #000 !important; }
          .no-print, .header-close-button, .action-buttons-container, .modal-overlay > *:not(.no-print-bg) { display: none !important; }
          .no-print-bg { border-radius: 0 !important; box-shadow: none !important; max-height: unset !important; }
          .price-column { font-variant-numeric: tabular-nums; text-align: right; }
          .invoice-content { page-break-inside: avoid; }
        }
      `}</style>
      </div>
      <FloatingBubbleChat />
    </>
  );
};

export default CustomerBookingDetails;
