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
      window.scrollTo(0, 0);
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

  const cardStyle = { background: 'var(--admin-card)', borderRadius: '4px', border: '1px solid var(--admin-border)', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', color: 'var(--admin-text-primary)' };
  const labelStyle = { fontSize: '0.7rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem', letterSpacing: '1px' };
  const valueStyle = { fontSize: '0.95rem', fontWeight: '950', color: 'var(--admin-text-primary)' };

  if (loading || !booking) return <LoadingState message="Synchronizing fleet records..." />;

  const pendingVerification = bookingPayments.find(p => p.status === 'FOR_VERIFICATION');
  const totalPaid = bookingPayments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = Math.max(0, (booking.total_amount || 0) - totalPaid);
  const isLocked = booking.status === 'cancelled';

  return (
    <div style={{ 
      width: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '1.5rem', 
      padding: '0.5rem 1.5rem 10rem 1.5rem',
      position: 'relative'
    }}>
      
      {/* 1. COMPACT CONSOLE HEADER (ALIGNED TO 1200px GUTTER) */}
      <PageHeader 
        showBack onBack={() => navigate(-1)} 
        badge="ADMINISTRATIVE CONSOLE" 
        title={`SW-BKG-${id.slice(0, 8).toUpperCase()}`} 
        subtitle={`Detailed operational record for session initialized on ${new Date(booking.created_at).toLocaleDateString()}.`} 
        titleStyle={{ fontSize: '1.85rem', fontWeight: '950', letterSpacing: '-1.5px' }}
      />

      {/* 2. TWO-COLUMN STABILIZED GRID (70/30 SPLIT) */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isMobile ? '1fr' : '7fr 3fr', 
        gap: '1.5rem',
        alignItems: 'start'
      }}>
        
        {/* === MAIN COLUMN: FINANCIALS & FLEET ASSETS === */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
          
          {/* A. FINANCIAL LEDGER (TABLE FORMAT) */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '950', textTransform: 'uppercase', color: 'var(--admin-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Banknote size={16} color="var(--admin-brand)" /> Financial Ledger
              </h3>
              <div style={{ fontSize: '1.5rem', fontWeight: '950', color: 'var(--admin-brand)' }}>₱{booking.total_amount?.toLocaleString()}</div>
            </div>

            <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ background: 'var(--admin-bg)', borderBottom: '1px solid var(--admin-border)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '900', color: 'var(--admin-text-secondary)' }}>DATE</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '900', color: 'var(--admin-text-secondary)' }}>METHOD</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '900', color: 'var(--admin-text-secondary)' }}>STATUS</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '900', color: 'var(--admin-text-secondary)' }}>AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {bookingPayments.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                      <td style={{ padding: '1.25rem 0.75rem' }}>
                        <div style={{ fontWeight: '800', color: '#fff', fontSize: '0.85rem' }}>{new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        <div style={{ fontSize: '0.75rem', color: '#A0A0A0', fontWeight: '600', marginTop: '0.25rem' }}>{new Date(p.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td style={{ padding: '0.75rem', fontWeight: '800' }}>{p.method}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <span style={{ 
                          fontSize: '0.55rem', fontWeight: '950', padding: '0.2rem 0.5rem', borderRadius: '2px',
                          background: p.status === 'PAID' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: p.status === 'PAID' ? '#10b981' : '#f59e0b'
                        }}>
                          {p.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '950' }}>₱{p.amount?.toLocaleString()}</td>
                    </tr>
                  ))}
                  {bookingPayments.length === 0 && (
                    <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>NO TRANSACTIONS LOGGED</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ 
              padding: '1.25rem', background: balance === 0 ? 'rgba(16, 185, 129, 0.03)' : 'rgba(245, 158, 11, 0.03)', 
              borderRadius: '0.75rem', textAlign: 'center', border: `1px solid ${balance === 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
              color: balance === 0 ? '#10b981' : '#f59e0b', fontSize: '0.85rem', fontWeight: '950',
              textTransform: 'uppercase', letterSpacing: '1px'
            }}>
              {balance === 0 ? '✓ ACCOUNT SETTLED' : `⚠ BALANCE DUE: ₱${balance.toLocaleString()}`}
            </div>

            {balance > 0 && !isLocked && (
              <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
                <input 
                  type="number" placeholder="Enter Amount..." value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)}
                  style={{ flex: 1, padding: '0.85rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '0.5rem', color: 'white', fontWeight: '900', outline: 'none' }} 
                />
                <button onClick={handleRecordPayment} style={{ padding: '0 1.5rem', background: 'var(--admin-brand)', color: 'white', borderRadius: '0.5rem', border: 'none', fontWeight: '950', fontSize: '0.7rem', cursor: 'pointer' }}>RECORD PAYMENT</button>
              </div>
            )}
          </div>

          {/* B. FLEET ASSETS */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '950', textTransform: 'uppercase', color: 'var(--admin-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Car size={16} color="var(--admin-brand)" /> Fleet Units ({vehicles.length})
              </h3>
              <div style={{ fontSize: '0.7rem', fontWeight: '950', color: 'var(--admin-text-secondary)' }}>BOOKING SUB-TOTAL: ₱{booking.total_amount?.toLocaleString()}</div>
            </div>

            {vehicles.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.3, background: 'var(--admin-bg)', borderRadius: '0.75rem', border: '1px dashed var(--admin-border)' }}>
                <Box size={32} style={{ marginBottom: '1rem' }} />
                <div style={{ fontSize: '0.8rem', fontWeight: '900' }}>NO ASSETS REGISTERED FOR THIS SESSION</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {vehicles.map(v => (
                  <div key={v.id} style={{ background: 'var(--admin-bg)', padding: '1.25rem', borderRadius: '1rem', border: '1px solid var(--admin-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '4px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--admin-border)' }}>
                          <Car size={20} color="var(--admin-brand)" />
                        </div>
                        <div>
                          <div style={{ fontWeight: '950', fontSize: '1rem' }}>{v.make} {v.model}</div>
                          <div style={{ fontSize: '0.7rem', fontWeight: '900', color: 'var(--admin-text-secondary)' }}>{v.plate_number} • {v.vehicle_type}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: '950', color: 'var(--admin-brand)', fontSize: '1.1rem', marginBottom: '0.25rem' }}>₱{v.subtotal?.toLocaleString()}</div>
                        <button 
                          onClick={() => updateVehicleStatus(v.id, v.status === 'in_progress' ? 'completed' : 'in_progress')}
                          style={{ 
                            background: v.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' : 'var(--admin-bg)', 
                            border: `1px solid ${v.status === 'completed' ? '#10b981' : 'var(--admin-border)'}`, 
                            padding: '0.4rem 0.8rem', borderRadius: '4px', color: v.status === 'completed' ? '#10b981' : 'var(--admin-text-secondary)', 
                            cursor: 'pointer', fontSize: '0.6rem', fontWeight: '950', display: 'flex', alignItems: 'center', gap: '0.4rem'
                          }}
                        >
                          {v.status === 'completed' ? <><CheckCircle2 size={12} /> COMPLETED</> : <><Play size={12} /> {v.status === 'in_progress' ? 'FINISH' : 'START'}</>}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* === SIDEBAR COLUMN: PERSONNEL, IDENTITY & SUPPORT === */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
          
          {/* A. CUSTOMER IDENTITY */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--admin-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--admin-border)' }}>
                <User size={22} color="var(--admin-text-secondary)" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '950', color: 'white' }}>{booking.customer?.full_name}</h3>
                <span style={{ fontSize: '0.65rem', fontWeight: '900', color: 'var(--admin-brand)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fleet Account Holder</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <div style={labelStyle}>Registered Contact</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '800' }}>{booking.customer?.phone_number || 'N/A'}</div>
              </div>
              <div>
                <div style={labelStyle}>Primary Email ID</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '800' }}>{booking.customer?.email}</div>
              </div>
            </div>
          </div>

          {/* B. HANDLING NOTES */}
          {booking.notes && (
            <div style={{ ...cardStyle, borderLeft: '4px solid var(--admin-brand)', background: 'rgba(var(--admin-brand-rgb), 0.02)' }}>
              <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.75rem', fontWeight: '950', color: 'var(--admin-brand)', textTransform: 'uppercase' }}>Fleet Handling Notes</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700', lineHeight: 1.5, color: 'var(--admin-text-primary)' }}>{booking.notes}</p>
            </div>
          )}

          {/* C. TECHNICIAN ASSIGNMENT */}
          <div style={{ ...cardStyle, opacity: (booking.status === 'in_progress' || isLocked) ? 0.5 : 1, pointerEvents: (booking.status === 'in_progress' || isLocked) ? 'none' : 'auto', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '950', textTransform: 'uppercase', color: 'var(--admin-text-secondary)' }}>Technician Assignment</h3>
              {booking.status === 'in_progress' && <span style={{ fontSize: '0.6rem', fontWeight: '950', color: 'var(--admin-brand)', background: 'rgba(230, 30, 42, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '2px' }}>SESSION ONGOING - LOCKED</span>}
            </div>
            
            {booking.staff_id ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--admin-bg)', padding: '1rem', borderRadius: '4px', border: '1px solid var(--admin-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <ShieldCheck size={18} color="var(--admin-brand)" />
                  <span style={{ fontSize: '0.9rem', fontWeight: '950' }}>{booking.assigned_staff?.full_name}</span>
                </div>
                {!isLocked && booking.status !== 'in_progress' && (
                  <button 
                    onClick={() => {
                      toast((t) => (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem' }}>
                          <span style={{ fontWeight: '950', fontSize: '0.9rem', color: '#fff' }}>CONFIRM REASSIGNMENT?</span>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              onClick={async () => {
                                setBooking({...booking, staff_id: null});
                                toast.dismiss(t.id);
                                toast.success('Technician cleared. Ready for reassignment.');
                              }}
                              style={{ background: 'var(--admin-brand)', color: 'white', border: 'none', padding: '0.4rem 1rem', borderRadius: '2px', fontWeight: '950', fontSize: '0.7rem', cursor: 'pointer' }}
                            >
                              YES, REASSIGN
                            </button>
                            <button 
                              onClick={() => toast.dismiss(t.id)}
                              style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '0.4rem 1rem', borderRadius: '2px', fontWeight: '950', fontSize: '0.7rem', cursor: 'pointer' }}
                            >
                              CANCEL
                            </button>
                          </div>
                        </div>
                      ), { duration: 5000, position: 'top-center', style: { background: '#15171A', border: '1px solid var(--admin-border)', borderRadius: '4px', padding: '1rem' } });
                    }} 
                    style={{ fontSize: '0.7rem', fontWeight: '950', color: 'var(--admin-brand)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.5px' }}
                  >
                    REASSIGN
                  </button>
                )}
              </div>
            ) : (
              <select 
                onChange={(e) => handleAssignStaff(e.target.value)} 
                style={{ width: '100%', padding: '1rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '4px', color: 'white', fontWeight: '950', outline: 'none' }}
              >
                <option value="">SELECT TECHNICIAN...</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            )}
          </div>

          {/* D. DIGITAL VERIFICATION */}
          {pendingVerification && !isLocked && (
            <div style={{ ...cardStyle, border: '2px solid var(--admin-info)', background: 'rgba(59, 130, 246, 0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.8rem', fontWeight: '950', color: 'var(--admin-info)', textTransform: 'uppercase' }}>Payment Verification</h3>
                <span style={{ fontSize: '0.55rem', fontWeight: '950', background: 'var(--admin-info)', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '2px' }}>FOR REVIEW</span>
              </div>
              <div 
                onClick={() => window.open(pendingVerification.receipt_url, '_blank')}
                style={{ width: '100%', height: '180px', borderRadius: '0.75rem', background: 'black', border: '1px solid var(--admin-border)', overflow: 'hidden', cursor: 'zoom-in', marginBottom: '1rem' }}
              >
                <img src={pendingVerification.receipt_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Receipt" />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => handleVerifyPayment(pendingVerification)} style={{ flex: 1, padding: '0.85rem', background: '#10b981', color: 'white', borderRadius: '6px', border: 'none', fontWeight: '950', fontSize: '0.75rem', cursor: 'pointer' }}>APPROVE</button>
                <button onClick={() => handleRejectPayment(pendingVerification)} style={{ flex: 1, padding: '0.85rem', background: '#ef4444', color: 'white', borderRadius: '6px', border: 'none', fontWeight: '950', fontSize: '0.75rem', cursor: 'pointer' }}>REJECT</button>
              </div>
            </div>
          )}

          {/* E. SUPPORT & LOGS */}
          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageCircle size={18} color="var(--admin-brand)" />
              <h3 style={{ margin: 0, fontSize: '0.8rem', fontWeight: '950', textTransform: 'uppercase' }}>Live Support</h3>
            </div>
            <div style={{ height: '350px' }}>
              <BookingChat bookingId={id} />
            </div>
          </div>

          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '0.8rem', fontWeight: '950', textTransform: 'uppercase', color: 'var(--admin-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={18} /> Audit Trail
            </h3>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <BookingAuditTrail logs={auditLogs} />
            </div>
          </div>
        </div>
      </div>

      {/* 3. STICKY COMMAND BAR */}
      {(!isLocked && (booking.status === 'pending' || booking.status === 'confirmed' || booking.status === 'in_progress')) && (
        <div style={{ 
          position: 'fixed', bottom: 0, left: isMobile ? 0 : '260px', right: 0, 
          background: '#15171A', borderTop: '2px solid var(--admin-brand)', 
          padding: '1.25rem 2.5rem', zIndex: 1000, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.4)', backdropFilter: 'blur(15px)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2.5rem' }}>
            <div>
              <div style={{ fontSize: '0.6rem', fontWeight: '950', color: 'var(--admin-text-secondary)', letterSpacing: '1px' }}>SESSION STATUS</div>
              <div style={{ fontSize: '1rem', fontWeight: '950', color: 'var(--admin-brand)', textTransform: 'uppercase' }}>{booking.status}</div>
            </div>
            <div style={{ width: '1px', height: '35px', background: 'var(--admin-border)' }}></div>
            <div>
              <div style={{ fontSize: '0.6rem', fontWeight: '950', color: 'var(--admin-text-secondary)', letterSpacing: '1px' }}>TOTAL REVENUE</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '950', color: 'white' }}>₱{booking.total_amount?.toLocaleString()}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1.25rem' }}>
            {booking.status === 'pending' && <button onClick={() => updateBookingStatus('confirmed')} style={{ padding: '0.85rem 2rem', background: '#10b981', color: 'white', borderRadius: '6px', border: 'none', fontWeight: '950', fontSize: '0.8rem', cursor: 'pointer', letterSpacing: '0.5px' }}>CONFIRM BOOKING</button>}
            {booking.status === 'confirmed' && <button onClick={() => updateBookingStatus('in_progress')} style={{ padding: '0.85rem 2rem', background: 'var(--admin-brand)', color: 'white', borderRadius: '6px', border: 'none', fontWeight: '950', fontSize: '0.8rem', cursor: 'pointer', letterSpacing: '0.5px' }}>START SESSION</button>}
            {booking.status === 'in_progress' && <button onClick={() => updateBookingStatus('completed')} style={{ padding: '0.85rem 2rem', background: '#a855f7', color: 'white', borderRadius: '6px', border: 'none', fontWeight: '950', fontSize: '0.8rem', cursor: 'pointer', letterSpacing: '0.5px' }}>MARK COMPLETED</button>}
            <button onClick={() => updateBookingStatus('cancelled')} style={{ padding: '0.85rem 1.5rem', background: 'transparent', color: '#ef4444', borderRadius: '6px', border: '1px solid #ef4444', fontWeight: '950', fontSize: '0.8rem', cursor: 'pointer' }}>CANCEL SESSION</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBookingDetails;
