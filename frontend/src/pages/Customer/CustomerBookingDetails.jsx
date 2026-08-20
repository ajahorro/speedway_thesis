import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import {
  ArrowLeft, Clock, Car, ShieldCheck, User, CheckCircle, Circle,
  CreditCard, FileText, MessageCircle, ChevronRight, AlertCircle, Package, Printer, CheckCircle2, X
} from 'lucide-react';
import BookingChat from '../../components/BookingChat';
import toast from 'react-hot-toast';
import { cancelBooking } from '../../services/bookingService';
import { getStatusColor, getStatusLabel } from '../../utils/bookingHelpers';
import { useUnifiedData } from '../../context/UnifiedContext';

const STATUS_STEPS = ['scheduled', 'confirmed', 'in_progress', 'completed'];
const STATUS_STEPS_WITH_NOSHOW = ['scheduled', 'confirmed', 'flagged_noshow'];

const CustomerBookingDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refreshData } = useUnifiedData(); // Now safely inside the component!

  const [booking, setBooking] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [receiptModal, setReceiptModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);

  const formatCurrency = (val) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val);

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
  const staffName = booking.assigned_staff ? `${booking.assigned_staff.first_name} ${booking.assigned_staff.last_name}` : 'Pending Assignment';

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

  const isNoShow = derivedStatus === 'flagged_noshow';
  const activeSteps = isNoShow ? STATUS_STEPS_WITH_NOSHOW : STATUS_STEPS;
  const currentStepIndex = activeSteps.indexOf(derivedStatus);

  return (
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

      {/* ===== A. LIVE STATUS TRACKER ===== */}
      <div style={cardStyle}>
        {booking.refund_status === 'PROCESSED' && (
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
        )}
        <div style={labelStyle}>Appointment Lifecycle</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', marginTop: '1.5rem', marginBottom: '0.5rem' }}>
          {/* Track */}
          <div style={{ position: 'absolute', top: '50%', left: '5%', right: '5%', height: '4px', background: 'var(--admin-border)', transform: 'translateY(-50%)', zIndex: 0 }} />
          <div style={{ position: 'absolute', top: '50%', left: '5%', width: `${Math.max(0, currentStepIndex / (activeSteps.length - 1)) * 90}%`, height: '4px', background: getStatusColor(derivedStatus), transform: 'translateY(-50%)', zIndex: 1, transition: 'width 0.5s ease' }} />

          {activeSteps.map((step, i) => {
            const isStepDone = derivedStatus === 'completed' ? true : i < currentStepIndex;
            const isActive = i === currentStepIndex;
            return (
              <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', zIndex: 2, position: 'relative' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: isStepDone ? getStatusColor(derivedStatus) : isActive ? 'var(--admin-card)' : 'var(--admin-bg)',
                  border: `2px solid ${isStepDone || isActive ? getStatusColor(derivedStatus) : 'var(--admin-border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isStepDone ? '#fff' : isActive ? getStatusColor(derivedStatus) : 'var(--admin-text-secondary)',
                  boxShadow: isActive ? `0 0 15px ${getStatusColor(derivedStatus)}40` : 'none',
                  transition: 'all 0.3s ease'
                }}>
                  {isStepDone ? <CheckCircle size={18} /> : <Circle size={18} />}
                </div>
                <div style={{ position: 'absolute', top: '44px', whiteSpace: 'nowrap', fontSize: '0.65rem', fontWeight: isActive ? '950' : '700', color: isActive ? 'var(--admin-text-primary)' : 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>
                  {getStatusLabel(step)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1.5rem', alignItems: 'start' }}>

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
                  background: v.status === 'completed' ? 'rgba(16,185,129,0.1)' : v.status === 'in_progress' ? 'rgba(168,85,247,0.1)' : v.status === 'QUEUED' ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)',
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
          <div style={cardStyle}>
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
              {balance === 0 ? '✅ FULLY SETTLED' : `OUTSTANDING BALANCE: ₱${balance.toLocaleString()}`}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* ===== D. RECEIPT SECTION — Appointment Info ===== */}
          <div style={cardStyle}>
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
          </div>

          {/* ===== C. TECHNICIAN PANEL ===== */}
          <div style={cardStyle}>
            <div style={labelStyle}>Assigned Technician</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.75rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(var(--admin-brand-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(var(--admin-brand-rgb), 0.3)' }}>
                <User size={24} color="var(--admin-brand)" />
              </div>
              <div>
                <div style={{ fontSize: '1.05rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>{staffName}</div>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: booking.staff_id ? 'var(--admin-brand)' : 'var(--admin-text-secondary)' }}>
                  {booking.staff_id ? 'Active Lead Technician' : (['cancelled', 'completed', 'flagged_noshow'].includes(booking.status?.toLowerCase()) ? 'No Personnel Linked' : 'Awaiting Admin Assignment')}
                </div>
              </div>
            </div>
          </div>

          {/* ===== B. BILLING & TRANSACTIONS ===== */}
          <div style={cardStyle}>
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
                    <span style={{ fontSize: '0.7rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>{p.method || 'Online Payment'}</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: '950', color: p.status === 'PAID' ? 'var(--admin-success)' : 'var(--admin-warning)' }}>{formatCurrency(p.amount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--admin-text-secondary)' }}>{new Date(p.created_at).toLocaleDateString()}</span>
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
              ))}
            </div>

            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px dashed var(--admin-border)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>BALANCE REMAINING</span>
              <span style={{ fontSize: '1rem', fontWeight: '950', color: 'var(--admin-warning)' }}>{formatCurrency(Math.max(0, (booking.total_amount || 0) - (booking.totalPaid || 0)))}</span>
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
                  background: derivedStatus === 'scheduled' ? 'transparent' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${derivedStatus === 'scheduled' ? '#ef4444' : 'var(--admin-border)'}`,
                  color: derivedStatus === 'scheduled' ? '#ef4444' : 'var(--admin-text-secondary)',
                  borderRadius: 'var(--admin-radius-sm)', fontWeight: '950', fontSize: '0.75rem',
                  cursor: derivedStatus === 'scheduled' ? 'pointer' : 'not-allowed',
                  textTransform: 'uppercase'
                }}
              >
                {derivedStatus === 'scheduled' ? 'Cancel Appointment' : 'Service Ongoing / Locked'}
              </button>
            </div>
          )}

          {/* CANCELLATION MODAL */}
          {showCancelModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)' }}>
              <div style={{ background: 'var(--admin-card)', padding: '2.5rem', borderRadius: 'var(--admin-radius-lg)', border: '1px solid var(--admin-border)', maxWidth: '450px', width: '90%', position: 'relative' }}>
                <button onClick={() => setShowCancelModal(false)} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <AlertCircle size={40} color="#ef4444" style={{ marginBottom: '1rem' }} />
                  <h3 style={{ margin: 0, fontWeight: '950', fontSize: '1.25rem', color: 'white' }}>Confirm Cancellation?</h3>
                  <p style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem', fontWeight: '600' }}>
                    Please provide a reason for cancelling this appointment.
                    {booking.totalPaid > 0 && " A refund request will be initiated automatically."}
                  </p>
                </div>

                <textarea
                  placeholder="e.g. Change of plans / Conflict in schedule..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  style={{ width: '100%', padding: '1rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', color: 'white', minHeight: '100px', resize: 'none', outline: 'none', fontSize: '0.9rem', fontWeight: '600', marginBottom: '1.5rem' }}
                />

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button onClick={() => setShowCancelModal(false)} style={{ flex: 1, padding: '1rem', background: 'transparent', border: '1px solid var(--admin-border)', color: 'white', borderRadius: 'var(--admin-radius-sm)', fontWeight: '900', cursor: 'pointer' }}>GO BACK</button>
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

          {/* ===== LIVE CHAT ===== */}
          <div style={cardStyle}>
            <div style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <MessageCircle size={14} /> Booking Chat
            </div>
            <div style={{ height: '350px', overflow: 'hidden', borderRadius: 'var(--admin-radius-md)' }}>
              <BookingChat bookingId={id} />
            </div>
          </div>
        </div>
      </div>
      {/* 🧾 OFFICIAL RECEIPT EXPLORER */}
      {receiptModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '2rem' }}>
          <div className="no-print-bg" style={{ background: '#fff', color: '#000', width: '100%', maxWidth: '600px', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.5)', position: 'relative' }}>

            <div className="no-print" style={{ background: '#000', color: '#fff', padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <ShieldCheck size={24} color="var(--admin-brand)" />
                <span style={{ fontWeight: '950', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '0.9rem' }}>
                  {selectedPayment ? 'Official Receipt (Verified)' : 'Official Invoice (Consolidated)'}
                </span>
              </div>
              <button onClick={() => { setReceiptModal(false); setSelectedPayment(null); }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>

            <div id="printable-receipt" style={{ padding: '2.5rem', maxHeight: '70vh', overflowY: 'auto', position: 'relative', zIndex: 1 }}>
              {selectedPayment?.status === 'REFUNDED' && (
                <div style={{
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-45deg)',
                  fontSize: '8rem', fontWeight: '900', color: 'rgba(239, 68, 68, 0.08)', pointerEvents: 'none', zIndex: 0, whiteSpace: 'nowrap'
                }}>
                  VOID / REFUNDED
                </div>
              )}
              <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                <h2 style={{ margin: 0, fontWeight: '950', fontSize: '1.75rem', color: '#000', fontStyle: 'italic' }}>SPEEDWAY</h2>
                <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#666', textTransform: 'uppercase', letterSpacing: '2px' }}>AutoxMoto Detail Studio</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: '950', color: '#999', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Billed To</div>
                  <div style={{ fontWeight: '900', fontSize: '1.1rem' }}>{booking.customer_name || user?.user_metadata?.full_name || 'Valued Customer'}</div>
                  <div style={{ fontSize: '0.85rem', color: '#666' }}>{user?.email}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: '950', color: '#999', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>{selectedPayment ? 'Receipt No.' : 'Invoice No.'}</div>
                  <div style={{ fontWeight: '900', fontSize: '1.1rem', color: '#000', fontFamily: 'monospace' }}>
                    {selectedPayment ? `RCP-${selectedPayment.id.substring(0, 8).toUpperCase()}` : `INV-${booking.id.substring(0, 8).toUpperCase()}`}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#666' }}>{new Date(selectedPayment?.created_at || booking.created_at).toLocaleDateString()}</div>
                </div>
              </div>

              <div style={{ borderTop: '2px solid #000', borderBottom: '2px solid #000', padding: '1.5rem 0', margin: '2rem 0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {selectedPayment ? (
                      <tr>
                        <td style={{ padding: '15px 5px', fontSize: '0.9rem', fontWeight: '900' }}>
                          Service Installment / Settlement
                          <div style={{ fontSize: '0.7rem', color: '#666', fontWeight: 'normal' }}>Payment for booking #{booking.id.substring(0, 8).toUpperCase()}</div>
                        </td>
                        <td style={{ padding: '15px 5px', textAlign: 'right', fontSize: '1.1rem', fontWeight: '950' }}>
                          {formatCurrency(selectedPayment.amount)}
                        </td>
                      </tr>
                    ) : (
                      vehicles.map((v) => (
                        <React.Fragment key={v.id}>
                          <tr>
                            <td colSpan="2" style={{ padding: '15px 5px 5px', fontWeight: 'bold', fontSize: '0.9rem', color: '#000' }}>
                              {v.brand} {v.model}
                            </td>
                          </tr>
                          {(v.services || []).map((s) => (
                            <tr key={s.id}>
                              <td style={{ padding: '5px 5px 5px 20px', fontSize: '0.85rem', color: '#333' }}>
                                {s.service_name || s.service_name_snapshot}
                              </td>
                              <td style={{ padding: '5px 5px', textAlign: 'right', fontSize: '0.85rem', color: '#333' }}>
                                {formatCurrency(s.price || s.price_snapshot)}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', gap: '2.5rem', width: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ color: '#999', fontSize: '0.85rem', fontWeight: '800' }}>{selectedPayment ? 'PAYMENT RECEIVED' : 'GRAND TOTAL'}</span>
                  <span style={{ fontWeight: '900', fontSize: '1.25rem' }}>{formatCurrency(selectedPayment?.amount || booking.total_amount)}</span>
                </div>
                {!selectedPayment && (
                  <>
                    <div style={{ display: 'flex', gap: '2.5rem', width: '100%', justifyContent: 'flex-end' }}>
                      <span style={{ color: '#999', fontSize: '0.85rem', fontWeight: '800' }}>TOTAL SETTLED</span>
                      <span style={{ fontWeight: '900' }}>{formatCurrency(booking.totalPaid)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '2.5rem', width: '100%', justifyContent: 'flex-end', borderTop: '2px solid #000', paddingTop: '0.75rem' }}>
                      <span style={{ fontWeight: '950', fontSize: '1.25rem' }}>OUTSTANDING</span>
                      <span style={{ fontWeight: '950', fontSize: '1.25rem' }}>{formatCurrency(Math.max(0, (booking.total_amount || 0) - (booking.totalPaid || 0)))}</span>
                    </div>
                  </>
                )}
              </div>

              <div style={{ padding: '1.25rem', background: '#f9f9f9', borderRadius: '12px', border: '1px solid #eee' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: '900', color: '#999', textTransform: 'uppercase' }}>Method</div>
                    <div style={{ fontWeight: '800', fontSize: '0.85rem' }}>{selectedPayment?.method || 'Verified Channel'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: '900', color: '#999', textTransform: 'uppercase' }}>Reference</div>
                    <div style={{ fontWeight: '800', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                      {selectedPayment?.reference_number || 'VALIDATED'}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'center', color: '#666', fontSize: '0.65rem', marginTop: '60px', fontWeight: '300' }}>
                This is a computer-generated document from Speedway AutoXMoto.
              </div>
            </div>

            <div className="no-print" style={{ padding: '1.5rem 2rem', background: '#f5f5f5', display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => window.print()}
                style={{
                  flex: 2, padding: '1rem', background: '#000',
                  color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '950',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                  cursor: 'pointer',
                  textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px'
                }}
              >
                <Printer size={20} /> Print Receipt
              </button>
              <button
                onClick={() => { setReceiptModal(false); setSelectedPayment(null); }}
                style={{ flex: 1, padding: '1rem', background: '#fff', color: '#000', border: '1px solid #ddd', borderRadius: '12px', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase', fontSize: '0.85rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-receipt, #printable-receipt * { visibility: visible; }
          #printable-receipt { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print, .modal-overlay { background: white !important; }
        }
      `}</style>
    </div>
  );
};

export default CustomerBookingDetails;
