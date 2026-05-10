import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  ArrowLeft, Clock, CreditCard, User, Car, ClipboardList,
  History, CheckCircle, XCircle, AlertCircle, MessageCircle,
  Hash, Calendar, Phone, Shield, Activity, Play, CheckCircle2,
  Package, Truck, Trash2, Banknote, Loader2, Eye, ArrowRight, X, UserX, Box,
  Send, ShieldCheck, Image as ImageIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import BookingAuditTrail from '../../components/BookingAuditTrail';
import BookingChat from '../../components/BookingChat';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import PageHeader from '../../components/PageHeader';
import LoadingState from '../../components/LoadingState';
import { logger } from '../../utils/logger';

const AdminBookingDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [bookingPayments, setBookingPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const isMobile = useMediaQuery('(max-width: 1024px)');

  useEffect(() => {
    fetchBookingDetails();
    fetchStaffList();
    fetchAuditLogs();
    fetchPayments();

    const channel = supabase.channel(`admin-booking-detail-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `id=eq.${id}` }, () => fetchBookingDetails())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_vehicles', filter: `booking_id=eq.${id}` }, () => fetchBookingDetails())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const fetchBookingDetails = async () => {
    setLoading(true);
    try {
      logger.admin(`Syncing Booking: ${id}`);
      
      // 1. Fetch main booking record
      const { data: bData, error: bError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (bError) throw bError;
      if (!bData) return navigate('/admin/bookings');

      // 2. Fetch Customer and Staff Profiles individually to avoid 400 join errors
      let customer = null;
      let assigned_staff = null;

      if (bData.customer_id) {
        const { data: cData } = await supabase.from('profiles').select('full_name, email, phone_number').eq('id', bData.customer_id).maybeSingle();
        customer = cData;
      }

      if (bData.staff_id) {
        const { data: sData } = await supabase.from('profiles').select('full_name, email').eq('id', bData.staff_id).maybeSingle();
        assigned_staff = sData;
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

      // 🧮 CALCULATION FIX: Enforce snapshot-based calculation
      const processedVehicles = vehiclesWithServices.map(v => {
        const snapshotSubtotal = (v.services || []).reduce((sum, s) => {
          const price = Number(s.price || s.price_snapshot || 0);
          return sum + price;
        }, 0);
        return {
          ...v,
          subtotal: Number(v.subtotal) > 0 ? Number(v.subtotal) : snapshotSubtotal
        };
      });
      
      const calculatedTotal = processedVehicles.reduce((sum, v) => sum + v.subtotal, 0);
      
      setBooking({
        ...bData,
        customer,
        assigned_staff,
        total_amount: Number(bData.total_amount) > 0 ? Number(bData.total_amount) : calculatedTotal
      });
      setVehicles(processedVehicles);

      // SYNC AUDIT LOGS WITH DATA
      const { data: auditData } = await supabase.from('audit_logs').select('*').eq('booking_id', id).order('created_at', { ascending: true });
      const hasCreation = auditData?.some(l => l.action_type === 'BOOKING_CREATED');
      const logs = auditData ? auditData.map(log => ({ 
        ...log, 
        event_type: log.action_type, 
        metadata: { details: log.details }, 
        actor: { full_name: log.actor_name, role: log.actor_role } 
      })) : [];

      if (!hasCreation) {
        logs.unshift({
          id: 'virtual-creation',
          event_type: 'BOOKING_INITIATED',
          details: 'Booking record successfully initiated in the Speedway Fleet Engine.',
          created_at: bData.created_at,
          actor: { full_name: 'System', role: 'SYSTEM' }
        });
      }
      setAuditLogs(logs);
    } catch (error) { 
      logger.error('Admin Sync Error', error);
      toast.error('Data pipeline error. Check console.'); 
    } finally { 
      setLoading(false); 
    }
  };

  const fetchPayments = async () => {
    const { data } = await supabase.from('payments').select('*').eq('booking_id', id).order('created_at', { ascending: true });
    if (data) {
      // Process URLs for previews
      const processed = data.map(p => {
        let url = p.receipt_url;
        if (url && !url.startsWith('http')) {
          const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(url);
          url = publicUrl;
        }
        return { ...p, receipt_url: url };
      });
      setBookingPayments(processed);
    }
  };

  const fetchStaffList = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'STAFF');
    if (data) setStaffList(data);
  };

  const fetchAuditLogs = async () => {
    const { data } = await supabase.from('audit_logs').select('*').eq('booking_id', id).order('created_at', { ascending: true });
    
    // Virtual Creation Log if missing
    const hasCreation = data?.some(l => l.action_type === 'BOOKING_CREATED');
    const logs = data ? data.map(log => ({ 
      ...log, 
      event_type: log.action_type, 
      metadata: { details: log.details }, 
      actor: { full_name: log.actor_name, role: log.actor_role } 
    })) : [];

    if (!hasCreation && booking) {
      logs.unshift({
        id: 'virtual-creation',
        event_type: 'BOOKING_INITIATED',
        details: 'Booking record successfully initiated in the Speedway Fleet Engine.',
        created_at: booking.created_at,
        actor: { full_name: 'System', role: 'SYSTEM' }
      });
    }

    setAuditLogs(logs);
  };

  const notifyUser = async (userId, title, message, type, url) => {
    await supabase.from('notifications').insert({
      user_id: userId, title, message, notification_type: type, action_url: url
    });
  };

  const handleAssignStaff = async (staffId) => {
    if (!staffId) return;
    try {
      const { data: { user: admin } } = await supabase.auth.getUser();
      
      const updatePayload = { 
        staff_id: staffId, 
        assigned_by: admin?.id, 
        assigned_at: new Date().toISOString(),
        customer_name: booking.customer_name || booking.customer?.full_name,
        contact_number: booking.contact_number || booking.customer?.phone_number
      };

      const { error } = await supabase.from('bookings').update(updatePayload).eq('id', id);
      
      if (error) {
        console.error('Assignment Database Error:', error);
        throw error;
      }
      
      // Notify Staff
      await notifyUser(staffId, 'New Fleet Assigned! 🔧', `You have been assigned to lead the detailing session for ${booking.customer?.full_name}.`, 'TASK_ASSIGNED', `/staff/tasks`);
      
      // LOG AUDIT
      const staffName = staffList.find(s => s.id === staffId)?.full_name || 'Staff';
      await supabase.from('audit_logs').insert({
        booking_id: id,
        action_type: 'STAFF_ASSIGNED',
        actor_name: admin?.email || 'Admin',
        actor_role: 'ADMIN',
        details: `Assigned technician ${staffName} to lead this session.`
      });

      toast.success('Technician Assigned');
      fetchBookingDetails(); fetchAuditLogs();
    } catch (error) { 
      console.error('CRITICAL ASSIGNMENT FAILURE:', error);
      if (error.code === 'PGRST204') {
        toast.error('Schema Mismatch: Missing assignment columns in DB.');
      } else {
        toast.error(`Assignment error: ${error.message || 'Unknown server error'}`); 
      }
    }
  };

  const handleVerifyPayment = async (p) => {
    try {
      const { data: { user: verifier } } = await supabase.auth.getUser();
      const { error } = await supabase.from('payments').update({ status: 'PAID', verified_by: verifier?.id, verified_at: new Date().toISOString() }).eq('id', p.id);
      if (error) throw error;
      
      await notifyUser(booking.customer_id, 'Payment Verified! 💰', `Your payment of ₱${p.amount.toLocaleString()} has been approved. Thank you!`, 'PAYMENT_APPROVED', `/my-bookings/${id}`);
      
      // LOG AUDIT
      await supabase.from('audit_logs').insert({
        booking_id: id,
        action_type: 'PAYMENT_VERIFIED',
        actor_name: verifier?.email || 'Admin',
        actor_role: 'ADMIN',
        details: `Verified payment of ₱${p.amount.toLocaleString()} via ${p.method}.`
      });

      toast.success('Payment Approved');
      fetchPayments(); fetchAuditLogs(); fetchBookingDetails();
    } catch (err) { toast.error('Verification failed'); }
  };

  const handleRejectPayment = async (p) => {
    const reason = window.prompt('Reason for rejection:');
    if (!reason) return;
    try {
      const { error } = await supabase.from('payments').update({ status: 'REJECTED', rejection_reason: reason }).eq('id', p.id);
      if (error) throw error;
      
      await notifyUser(booking.customer_id, 'Payment Rejected ❌', `Reason: ${reason}. Please re-submit your receipt.`, 'PAYMENT_REJECTED', `/my-bookings/${id}`);
      
      toast.success('Receipt rejected');
      fetchPayments(); fetchBookingDetails(); fetchAuditLogs();
    } catch (err) { toast.error('Rejection failed'); }
  };

  const updateBookingStatus = async (status) => {
    try {
      const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
      if (error) throw error;
      
      await notifyUser(booking.customer_id, 'Booking Status Update ℹ️', `Your session has been marked as ${status.toUpperCase()}.`, 'STATUS_UPDATE', `/my-bookings/${id}`);
      
      toast.success(`Booking ${status}`);
      fetchBookingDetails();
    } catch (err) { toast.error('Update failed'); }
  };

  const updateVehicleStatus = async (vehicleId, status) => {
    try {
      const { error } = await supabase.from('booking_vehicles').update({ status }).eq('id', vehicleId);
      if (error) throw error;
      
      if (status === 'completed') {
        const v = vehicles.find(item => item.id === vehicleId);
        await notifyUser(booking.customer_id, 'Unit Completed! ✨', `Your ${v.make} ${v.model} is now ready for pickup.`, 'VEHICLE_COMPLETED', `/my-bookings/${id}?vehicle=${vehicleId}`);
      }

      // LOG AUDIT
      const vehicle = vehicles.find(item => item.id === vehicleId);
      const { data: { user: actor } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert({
        booking_id: id,
        action_type: 'VEHICLE_STATUS_UPDATE',
        actor_name: actor?.email || 'Admin',
        actor_role: 'ADMIN',
        details: `Updated ${vehicle?.make} ${vehicle?.model} to: ${status.toUpperCase()}`
      });

      toast.success(`Vehicle ${status}`);
      fetchBookingDetails(); fetchAuditLogs();
    } catch (err) { toast.error('Vehicle update failed'); }
  };

  const cardStyle = { background: 'var(--admin-card)', borderRadius: '1.25rem', border: '1px solid var(--admin-border)', padding: '1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', color: 'var(--admin-text-primary)' };
  const labelStyle = { fontSize: '0.7rem', fontWeight: '850', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem', letterSpacing: '0.5px' };
  const valueStyle = { fontSize: '0.95rem', fontWeight: '900', color: 'var(--admin-text-primary)' };

  if (loading || !booking) return <LoadingState message="Synchronizing fleet records..." />;

  const totalPaid = bookingPayments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = Math.max(0, (booking.total_amount || 0) - totalPaid);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '5rem' }}>
      <PageHeader showBack onBack={() => navigate(-1)} badge={`ID: ${id.slice(0, 8).toUpperCase()}`} title="ADMINISTRATIVE CONSOLE" subtitle="Manage high-level fleet logistics and financial verification." />

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.8fr 1.2fr', gap: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* 🔍 HIGH-PRIORITY VERIFICATION HUB */}
          <div style={{ ...cardStyle, border: '2px solid var(--admin-info)', background: 'rgba(59, 130, 246, 0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '950', textTransform: 'uppercase', color: 'var(--admin-info)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <ShieldCheck size={20} /> Payment Verification Hub
              </h3>
              <span style={{ fontSize: '0.65rem', fontWeight: '900', padding: '0.3rem 0.6rem', borderRadius: '20px', background: 'var(--admin-info)', color: 'white' }}>
                FOR REVIEW
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '1.5rem', alignItems: 'start' }}>
              {/* Receipt Preview */}
              <div style={{ width: '120px', height: '160px', borderRadius: '0.75rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', overflow: 'hidden', cursor: 'zoom-in', position: 'relative' }} onClick={() => bookingPayments[0]?.receipt_url && window.open(bookingPayments[0].receipt_url, '_blank')}>
                {bookingPayments[0]?.receipt_url ? (
                  <img src={bookingPayments[0].receipt_url} alt="Payment Receipt" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: 0.5 }}>
                    <ImageIcon size={24} />
                    <span style={{ fontSize: '0.6rem', fontWeight: '800' }}>No Receipt</span>
                  </div>
                )}
              </div>

              {/* OCR Results */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ padding: '1rem', background: 'var(--admin-bg)', borderRadius: '0.75rem', border: '1px solid var(--admin-border)', height: '100%' }}>
                  <div style={{ ...labelStyle, color: 'var(--admin-info)' }}>Extracted Verification Metadata</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '850', color: 'var(--admin-text-primary)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', marginTop: '0.5rem', lineHeight: '1.4' }}>
                    {booking.notes || 'No OCR scan data attached to this booking record.'}
                  </div>
                </div>
                {bookingPayments[0] && (
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={() => handleVerifyPayment(bookingPayments[0])} style={{ flex: 1, padding: '0.75rem', background: '#10b981', color: 'white', borderRadius: '0.6rem', border: 'none', fontWeight: '950', cursor: 'pointer', fontSize: '0.75rem' }}>APPROVE PAYMENT</button>
                    <button onClick={() => handleRejectPayment(bookingPayments[0])} style={{ flex: 1, padding: '0.75rem', background: '#ef4444', color: 'white', borderRadius: '0.6rem', border: 'none', fontWeight: '950', cursor: 'pointer', fontSize: '0.75rem' }}>REJECT</button>
                  </div>
                )}
                
                {/* BILLING / MANUAL PAYMENT BUTTON */}
                <button 
                  onClick={() => setPaymentModal(true)}
                  style={{ width: '100%', padding: '0.75rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', borderRadius: '0.6rem', fontWeight: '950', fontSize: '0.7rem', cursor: 'pointer', marginTop: bookingPayments[0] ? '0' : '0.75rem' }}
                >
                  <Banknote size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> 
                  RECORD MANUAL PAYMENT / BILLING ADJUSTMENT
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontWeight: '950', fontSize: '1.1rem', textTransform: 'uppercase', color: 'var(--admin-text-secondary)', letterSpacing: '1px' }}>
              Fleet Assets ({vehicles.length})
            </h3>
            <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--admin-brand)' }}>
              Total: ₱{booking.total_amount?.toLocaleString()}
            </span>
          </div>

          {vehicles.map(v => (
            <div key={v.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--admin-border)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--admin-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--admin-border)' }}>
                    <Car size={22} color="var(--admin-brand)" />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontWeight: '900', fontSize: '1.1rem' }}>{v.make} {v.model}</h4>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>{v.plate_number} · {v.vehicle_type}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                   <div style={{ 
                     fontSize: '0.65rem', fontWeight: '950', padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid currentColor', marginBottom: '0.25rem',
                     background: v.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' : (v.status === 'in_progress' ? 'rgba(168, 85, 247, 0.1)' : 'rgba(255,255,255,0.05)'),
                     color: v.status === 'completed' ? '#10b981' : (v.status === 'in_progress' ? '#a855f7' : 'var(--admin-text-secondary)')
                   }}>
                     {v.status.toUpperCase()}
                   </div>
                   <div style={{ fontWeight: '950', fontSize: '1.1rem' }}>₱{v.subtotal?.toLocaleString()}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
                {(v.services || []).map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--admin-border)', borderRadius: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--admin-text-primary)' }}>
                      {s.service_name || s.service_name_snapshot}
                    </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: '950', color: 'var(--admin-brand)' }}>
                      ₱{(s.price || s.price_snapshot || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                 {v.status !== 'completed' && (
                   <button 
                    onClick={() => updateVehicleStatus(v.id, v.status === 'in_progress' ? 'completed' : 'in_progress')} 
                    style={{ 
                      flex: 1, padding: '0.85rem', background: v.status === 'in_progress' ? '#10b981' : 'var(--admin-brand)', 
                      color: 'white', borderRadius: '0.75rem', border: 'none', fontWeight: '950', 
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      gap: '0.6rem', transition: 'all 0.3s ease' 
                    }}
                   >
                     {v.status === 'in_progress' ? <><CheckCircle2 size={18} /> MARK COMPLETED</> : <><Play size={18} /> START SERVICE</>}
                   </button>
                 )}
              </div>
            </div>
          ))}

          {/* FINANCIAL AUDIT LEDGER */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '900', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Banknote size={18} /> Financial Ledger
              </h3>
              <div style={{ fontSize: '1.5rem', fontWeight: '950', color: 'var(--admin-brand)' }}>₱{booking.total_amount?.toLocaleString()}</div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {bookingPayments.map((p, idx) => (
                <div key={p.id} style={{ 
                  background: 'var(--admin-bg)', borderRadius: '1rem', 
                  border: '1px solid var(--admin-border)', overflow: 'hidden'
                }}>
                  <div style={{ display: 'flex', gap: '1rem', padding: '1rem' }}>
                    {p.receipt_url && (
                      <div style={{ width: '80px', height: '80px', borderRadius: '0.75rem', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--admin-border)' }}>
                        <img 
                          src={p.receipt_url} 
                          alt="Receipt" 
                          style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }} 
                          onClick={() => window.open(p.receipt_url, '_blank')}
                        />
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: '900', fontSize: '0.85rem' }}>PAYMENT #{idx + 1} • {p.method}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-secondary)', fontWeight: '800' }}>{new Date(p.created_at).toLocaleString()}</div>
                        </div>
                        <div style={{ 
                          fontSize: '0.6rem', fontWeight: '950', padding: '0.2rem 0.5rem', borderRadius: '4px',
                          background: p.status === 'PAID' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: p.status === 'PAID' ? '#10b981' : '#f59e0b',
                          border: '1px solid currentColor'
                        }}>
                          {p.status.toUpperCase()}
                        </div>
                      </div>
                      <div style={{ fontWeight: '950', fontSize: '1.1rem', marginTop: '0.25rem' }}>₱{p.amount?.toLocaleString()}</div>
                      
                      {p.status === 'FOR_VERIFICATION' && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                          <button onClick={() => handleVerifyPayment(p)} style={{ flex: 1, padding: '0.4rem', background: '#10b981', color: 'white', borderRadius: '0.5rem', border: 'none', fontSize: '0.7rem', fontWeight: '950', cursor: 'pointer' }}>APPROVE</button>
                          <button onClick={() => handleRejectPayment(p)} style={{ flex: 1, padding: '0.4rem', background: '#ef4444', color: 'white', borderRadius: '0.5rem', border: 'none', fontSize: '0.7rem', fontWeight: '950', cursor: 'pointer' }}>REJECT</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div style={{ 
              marginTop: '1.5rem', padding: '1.25rem', 
              background: balance === 0 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(245, 158, 11, 0.05)', 
              color: balance === 0 ? '#10b981' : '#f59e0b', 
              borderRadius: '1rem', textAlign: 'center', 
              fontWeight: '950', fontSize: '0.9rem',
              border: `1px solid ${balance === 0 ? '#10b981' : '#f59e0b'}`
            }}>
              {balance === 0 ? 'SESSION FULLY SETTLED' : `OUTSTANDING BALANCE: ₱${balance.toLocaleString()}`}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '0.8rem', fontWeight: '900', textTransform: 'uppercase', color: 'var(--admin-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={16} /> Technician Assigned
            </h3>
            {booking.staff_id ? (
              <div style={{ background: 'var(--admin-bg)', padding: '1.25rem', borderRadius: '1rem', border: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <div>
                   <div style={valueStyle}>{booking.assigned_staff?.full_name}</div>
                   <div style={{ fontSize: '0.65rem', color: 'var(--admin-text-secondary)', fontWeight: '800' }}>Active Lead Technician</div>
                 </div>
                 <button onClick={() => setBooking({...booking, staff_id: null})} style={{ color: 'var(--admin-brand)', background: 'none', border: 'none', fontWeight: '950', cursor: 'pointer', fontSize: '0.75rem' }}>REASSIGN</button>
              </div>
            ) : (
              <select 
                onChange={(e) => handleAssignStaff(e.target.value)} 
                style={{ 
                  width: '100%', padding: '1rem', borderRadius: '1rem', 
                  background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', 
                  color: '#fff', fontWeight: '900', outline: 'none' 
                }}
              >
                <option value="">Select Technician...</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            )}
          </div>

          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '0.8rem', fontWeight: '900', textTransform: 'uppercase', color: 'var(--admin-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ClipboardList size={16} /> Customer Profile
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                 <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--admin-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--admin-border)' }}>
                   <User size={18} color="var(--admin-text-secondary)" />
                 </div>
                 <div>
                   <div style={valueStyle}>{booking.customer_name || booking.customer?.full_name || 'Anonymous Customer'}</div>
                   <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-secondary)', fontWeight: '800' }}>FLEET OWNER</div>
                 </div>
              </div>
              <div style={{ padding: '1rem', background: 'var(--admin-bg)', borderRadius: '1rem', border: '1px solid var(--admin-border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={labelStyle}>Contact</span><span style={{ fontSize: '0.8rem', fontWeight: '800' }}>{booking.contact_number || booking.customer?.phone_number || 'N/A'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={labelStyle}>Email</span><span style={{ fontSize: '0.8rem', fontWeight: '800' }}>{booking.customer?.email}</span></div>
              </div>
            </div>
          </div>

          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '0.8rem', fontWeight: '900', textTransform: 'uppercase', color: 'var(--admin-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageCircle size={16} /> Live Support
            </h3>
            <div style={{ height: '350px', overflow: 'hidden', borderRadius: '1rem' }}>
              <BookingChat bookingId={id} />
            </div>
          </div>

          <div style={cardStyle}>
             <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '0.8rem', fontWeight: '900', textTransform: 'uppercase', color: 'var(--admin-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <History size={16} /> Audit Timeline
             </h3>
             <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
               <BookingAuditTrail logs={auditLogs} />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};


export default AdminBookingDetails;
