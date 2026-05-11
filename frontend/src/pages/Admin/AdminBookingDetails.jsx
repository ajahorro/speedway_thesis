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
      const { data: auditData } = await supabase.from('audit_logs').select('*').eq('booking_id', id).order('created_at', { ascending: false });
      const logs = auditData ? auditData.map(log => ({ 
        ...log, 
        event_type: log.action_type, 
        metadata: { details: log.details }, 
        actor: { full_name: log.actor_name, role: log.actor_role } 
      })) : [];

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
    const toastId = toast.loading('Assigning technician...');
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
      
      if (error) throw error;
      
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

      toast.success('Technician Assigned Successfully', { id: toastId });
      fetchBookingDetails(); fetchAuditLogs();
    } catch (error) { 
      logger.error('CRITICAL ASSIGNMENT FAILURE:', error);
      toast.error('Assignment failed', { id: toastId });
    }
  };

  const handleVerifyPayment = async (p) => {
    const toastId = toast.loading('Verifying payment...');
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

      toast.success('Payment Approved', { id: toastId });
      fetchPayments(); fetchAuditLogs(); fetchBookingDetails();
    } catch (err) { toast.error('Verification failed', { id: toastId }); }
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
    const toastId = toast.loading(`Marking session as ${status}...`);
    try {
      const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
      if (error) throw error;
      
      await notifyUser(booking.customer_id, 'Booking Status Update ℹ️', `Your session has been marked as ${status.toUpperCase()}.`, 'STATUS_UPDATE', `/my-bookings/${id}`);
      
      toast.success(`Booking ${status.toUpperCase()}`, { id: toastId });
      fetchBookingDetails();
    } catch (err) { toast.error('Update failed', { id: toastId }); }
  };

  const handleRecordPayment = async () => {
    if (!paymentAmount || Number(paymentAmount) <= 0) return toast.error('Enter a valid amount');
    setSubmittingPayment(true);
    const toastId = toast.loading('Recording manual payment...');
    try {
      const { data: { user: actor } } = await supabase.auth.getUser();
      
      const { data: pData, error: pError } = await supabase.from('payments').insert({
        booking_id: id,
        amount: Number(paymentAmount),
        method: 'Cash',
        status: 'PAID',
        verified_by: actor?.id,
        verified_at: new Date().toISOString(),
        notes: 'Manual entry by Admin'
      }).select().single();

      if (pError) throw pError;

      // Notify Customer
      await notifyUser(booking.customer_id, 'Payment Received! 💵', `We have recorded your manual payment of ₱${Number(paymentAmount).toLocaleString()}.`, 'PAYMENT_RECEIVED', `/my-bookings/${id}`);

      // AUDIT LOG
      await supabase.from('audit_logs').insert({
        booking_id: id,
        action_type: 'PAYMENT_RECORDED',
        actor_name: actor?.email || 'Admin',
        actor_role: 'ADMIN',
        details: `Manually recorded Cash payment of ₱${Number(paymentAmount).toLocaleString()}.`
      });

      toast.success('Payment Recorded Successfully', { id: toastId });
      setPaymentModal(false);
      setPaymentAmount('');
      fetchPayments(); fetchBookingDetails(); fetchAuditLogs();
    } catch (err) {
      logger.error('Manual Payment Error', err);
      toast.error('Failed to record payment', { id: toastId });
    } finally {
      setSubmittingPayment(false);
    }
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

  const pendingVerification = bookingPayments.find(p => p.status === 'FOR_VERIFICATION');
  const totalPaid = bookingPayments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = Math.max(0, (booking.total_amount || 0) - totalPaid);
  const isLocked = booking.status === 'cancelled';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '5rem' }}>
      <PageHeader showBack onBack={() => navigate(-1)} badge={`ID: ${id.slice(0, 8).toUpperCase()}`} title="ADMINISTRATIVE CONSOLE" subtitle="Manage high-level fleet logistics and financial verification." />

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.8fr 1.2fr', gap: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* 🔍 HIGH-PRIORITY VERIFICATION HUB - Only show if there is something to verify */}
          {pendingVerification && !isLocked && (
             <div style={{ ...cardStyle, border: '2px solid var(--admin-info)', background: 'rgba(59, 130, 246, 0.03)', marginBottom: '1.5rem' }}>
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
                <div style={{ width: '120px', height: '160px', borderRadius: '0.75rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', overflow: 'hidden', cursor: 'zoom-in', position: 'relative' }} onClick={() => pendingVerification.receipt_url && window.open(pendingVerification.receipt_url, '_blank')}>
                  {pendingVerification.receipt_url ? (
                    <img src={pendingVerification.receipt_url} alt="Payment Receipt" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: 0.5 }}>
                      <ImageIcon size={24} />
                      <span style={{ fontSize: '0.6rem', fontWeight: '800' }}>No Receipt</span>
                    </div>
                  )}
                </div>

                {/* OCR Results & Customer Notes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ padding: '1rem', background: 'var(--admin-bg)', borderRadius: '0.75rem', border: '1px solid var(--admin-border)', height: '100%' }}>
                    <div style={{ ...labelStyle, color: 'var(--admin-info)' }}>Digital Receipt Intelligence</div>
                    {booking.ocr_metadata && Object.keys(booking.ocr_metadata).length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.25rem' }}>
                          <span style={{ color: 'var(--admin-text-secondary)', fontWeight: '700' }}>REF NO:</span>
                          <span style={{ color: 'var(--admin-text-primary)', fontWeight: '950', fontFamily: 'monospace' }}>{booking.ocr_metadata.referenceNo}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.25rem' }}>
                          <span style={{ color: 'var(--admin-text-secondary)', fontWeight: '700' }}>EXTRACTED AMOUNT:</span>
                          <span style={{ color: 'var(--admin-brand)', fontWeight: '950' }}>₱{Number(booking.ocr_metadata.amount).toLocaleString()}</span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-secondary)', fontStyle: 'italic', marginTop: '0.25rem' }}>
                          "{booking.ocr_metadata.description}"
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)', fontStyle: 'italic', marginTop: '0.5rem' }}>
                        No digital OCR intelligence available for this record.
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={() => handleVerifyPayment(pendingVerification)} style={{ flex: 1, padding: '0.75rem', background: '#10b981', color: 'white', borderRadius: '0.6rem', border: 'none', fontWeight: '950', cursor: 'pointer', fontSize: '0.75rem' }}>APPROVE PAYMENT</button>
                    <button onClick={() => handleRejectPayment(pendingVerification)} style={{ flex: 1, padding: '0.75rem', background: '#ef4444', color: 'white', borderRadius: '0.6rem', border: 'none', fontWeight: '950', cursor: 'pointer', fontSize: '0.75rem' }}>REJECT</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Customer Special Instructions (Moved outside the hub) */}
          {booking.notes && (
            <div style={{ ...cardStyle, padding: '1.25rem', border: '1px dashed var(--admin-brand)', background: 'rgba(var(--admin-brand-rgb), 0.02)', marginBottom: '1.5rem' }}>
              <div style={{ ...labelStyle, color: 'var(--admin-brand)' }}>Customer Special Instructions</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--admin-text-primary)', marginTop: '0.5rem' }}>
                {booking.notes}
              </div>
            </div>
          )}


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
                 {v.status !== 'completed' && !isLocked && (
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
                          background: p.status === 'PAID' ? 'rgba(16, 185, 129, 0.1)' : (p.status === 'FOR_VERIFICATION' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)'),
                          color: p.status === 'PAID' ? '#10b981' : (p.status === 'FOR_VERIFICATION' ? '#f59e0b' : '#ef4444'),
                          border: '1px solid currentColor'
                        }}>
                          {p.status.toUpperCase()}
                        </div>
                      </div>
                      <div style={{ fontWeight: '950', fontSize: '1.1rem', marginTop: '0.25rem' }}>₱{p.amount?.toLocaleString()}</div>
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
              border: `1px solid ${balance === 0 ? '#10b981' : '#f59e0b'}`,
              marginBottom: balance > 0 ? '1rem' : 0
            }}>
              {balance === 0 ? 'SESSION FULLY SETTLED' : `OUTSTANDING BALANCE: ₱${balance.toLocaleString()}`}
            </div>

            {/* INLINE MANUAL PAYMENT RECORDING - Only if not cancelled */}
            {balance > 0 && !isLocked && (
              <div style={{ paddingTop: '1rem', borderTop: '1px dashed var(--admin-border)' }}>
                 <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: '900', color: 'var(--admin-text-secondary)', fontSize: '0.75rem' }}>₱</span>
                      <input 
                        type="number" 
                        placeholder="Manual Payment Amount..."
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', color: 'white', fontWeight: '900', fontSize: '0.85rem', outline: 'none' }} 
                      />
                    </div>
                    <button 
                      disabled={submittingPayment || !paymentAmount}
                      onClick={handleRecordPayment}
                      style={{ padding: '0 1.25rem', background: 'var(--admin-brand)', color: 'white', border: 'none', borderRadius: 'var(--admin-radius-sm)', fontWeight: '950', fontSize: '0.7rem', cursor: 'pointer', opacity: submittingPayment ? 0.5 : 1, textTransform: 'uppercase' }}
                    >
                      {submittingPayment ? '...' : 'RECORD'}
                    </button>
                 </div>
              </div>
            )}
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
                 {!isLocked && <button onClick={() => setBooking({...booking, staff_id: null})} style={{ color: 'var(--admin-brand)', background: 'none', border: 'none', fontWeight: '950', cursor: 'pointer', fontSize: '0.75rem' }}>REASSIGN</button>}
              </div>
            ) : (
              <select 
                disabled={isLocked}
                onChange={(e) => handleAssignStaff(e.target.value)} 
                style={{ 
                  width: '100%', padding: '1rem', borderRadius: '1rem', 
                  background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', 
                  color: '#fff', fontWeight: '900', outline: 'none',
                  opacity: isLocked ? 0.5 : 1
                }}
              >
                <option value="">{isLocked ? 'Booking Cancelled' : 'Select Technician...'}</option>
                {!isLocked && staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
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
