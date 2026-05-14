import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import {
  ArrowLeft, Clock, Car, ShieldCheck, User, CheckCircle, Circle,
  CreditCard, FileText, MessageCircle, ChevronRight, AlertCircle, Package
} from 'lucide-react';
import BookingChat from '../../components/BookingChat';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { cancelBooking } from '../../services/bookingService';
import { getStatusColor, getStatusLabel } from '../../utils/bookingHelpers';

const STATUS_STEPS = ['scheduled', 'confirmed', 'ongoing', 'completed'];
const STATUS_STEPS_WITH_NOSHOW = ['scheduled', 'confirmed', 'FLAGGED_NOSHOW'];

const CustomerBookingDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [booking, setBooking] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // --- DATA FETCHING ---
  const fetchAll = async () => {
    setLoading(true);
    try {
      // 1. Booking
      const { data: bData, error: bErr } = await supabase
        .from('bookings').select('*').eq('id', id).maybeSingle();
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
        .eq('booking_id', id)
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
        .from('payments').select('*').eq('booking_id', id).order('created_at', { ascending: true });

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
  
  // Use appropriate lifecycle steps based on booking status
  const isNoShow = booking.status === 'FLAGGED_NOSHOW';
  const activeSteps = isNoShow ? STATUS_STEPS_WITH_NOSHOW : STATUS_STEPS;
  const currentStepIndex = activeSteps.indexOf(isNoShow ? 'FLAGGED_NOSHOW' : booking.status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>

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
          <div style={{ position: 'absolute', top: '50%', left: '5%', width: `${Math.max(0, currentStepIndex / (activeSteps.length - 1)) * 90}%`, height: '4px', background: getStatusColor(booking.status), transform: 'translateY(-50%)', zIndex: 1, transition: 'width 0.5s ease' }} />

          {activeSteps.map((step, i) => {
            const isCompleted = i < currentStepIndex;
            const isActive = i === currentStepIndex;
            return (
              <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', zIndex: 2, position: 'relative' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: isCompleted ? getStatusColor(booking.status) : isActive ? 'var(--admin-card)' : 'var(--admin-bg)',
                  border: `2px solid ${isCompleted || isActive ? getStatusColor(booking.status) : 'var(--admin-border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isCompleted ? '#fff' : isActive ? getStatusColor(booking.status) : 'var(--admin-text-secondary)',
                  boxShadow: isActive ? `0 0 15px ${getStatusColor(booking.status)}40` : 'none',
                  transition: 'all 0.3s ease'
                }}>
                  {isCompleted ? <CheckCircle size={18} /> : <Circle size={18} />}
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
                    <h4 style={{ margin: 0, fontWeight: '950', fontSize: '1.1rem', color: 'var(--admin-text-primary)' }}>{v.brand || v.make} {v.model}</h4>
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
                <span style={{ ...valStyle, color: getStatusColor(booking.status), textTransform: 'uppercase' }}>{booking.status}</span>
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
                  {booking.staff_id ? 'Active Lead Technician' : (['cancelled', 'completed', 'FLAGGED_NOSHOW'].includes(booking.status) ? 'No Personnel Linked' : 'Awaiting Admin Assignment')}
                </div>
              </div>
            </div>
          </div>

          {/* ===== ACTIONS ===== */}
          {(['scheduled', 'confirmed'].includes(booking.status)) && (
            <div style={{ ...cardStyle, border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.02)' }}>
              <div style={{ ...labelStyle, color: '#ef4444' }}>Danger Zone</div>
              <p style={{ margin: '0.5rem 0 1rem 0', fontSize: '0.8rem', color: 'var(--admin-text-secondary)', fontWeight: '600' }}>
                Need to cancel? You can cancel your appointment now. 
                {booking.totalPaid > 0 && " Since a payment was detected, a refund request will be automatically filed."}
              </p>
              <button 
                onClick={() => setShowCancelModal(true)}
                style={{ width: '100%', padding: '0.85rem', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 'var(--admin-radius-sm)', fontWeight: '950', fontSize: '0.75rem', cursor: 'pointer', textTransform: 'uppercase' }}
              >
                Cancel Appointment
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
                    disabled={!cancelReason.trim()}
                    onClick={async () => {
                      const toastId = toast.loading('Processing cancellation...');
                      try {
                        const result = await cancelBooking(id, cancelReason);
                        
                        if (result.success) {
                          toast.success('Booking Cancelled & Refund Queued', { id: toastId });
                          setShowCancelModal(false);
                          fetchAll();
                        } else {
                          throw new Error(result.error);
                        }
                      } catch (err) {
                        toast.error(err.message || 'Failed to cancel booking', { id: toastId });
                      }
                    }} 
                    style={{ flex: 1, padding: '1rem', background: '#ef4444', border: 'none', color: 'white', borderRadius: 'var(--admin-radius-sm)', fontWeight: '900', cursor: 'pointer', opacity: !cancelReason.trim() ? 0.5 : 1 }}
                  >
                    CONFIRM
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
    </div>
  );
};

export default CustomerBookingDetails;
