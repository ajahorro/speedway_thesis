import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  ArrowLeft, Clock, CreditCard, User, Car, ClipboardList,
  History, CheckCircle, XCircle, AlertCircle, MessageCircle,
  Hash, Calendar, Phone, Shield, Activity, Play, CheckCircle2,
  Package, Truck, Trash2, Banknote, Loader2, Eye, ArrowRight, X, UserX, Box,
  Send, ShieldCheck, ShieldAlert, Image as ImageIcon, Plus, Zap
} from 'lucide-react';
import { SERVICES_DATA } from '../../data/servicesCatalog';
import { calculateOccupancy, filterActiveBookings } from '../../utils/schedulingUtils';
import { SHOP_CONFIG } from '../../config/constants';
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
  const [serviceModal, setServiceModal] = useState({ open: false, vehicleId: null });
  const [historyModal, setHistoryModal] = useState(false);
  const [userBookings, setUserBookings] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isUpdatingDuration, setIsUpdatingDuration] = useState(false);
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
    try {
      const { data: allStaff } = await supabase.from('profiles').select('*').eq('role', 'STAFF');
      if (!allStaff || !booking) {
        if (allStaff) setStaffList(allStaff);
        return;
      }

      // TECHNICIAN COLLISION GUARD: Find staff busy during this booking's window
      const { data: busyAssignments } = await supabase
        .from('bookings')
        .select('staff_id')
        .neq('id', id)
        .neq('status', 'cancelled')
        .not('staff_id', 'is', null)
        .lte('start_datetime', booking.end_datetime)
        .gte('end_datetime', booking.start_datetime);

      const busyIds = new Set(busyAssignments?.map(a => a.staff_id) || []);
      
      const filteredStaff = allStaff.map(s => ({
        ...s,
        isBusy: busyIds.has(s.id)
      }));

      setStaffList(filteredStaff);
    } catch (err) {
      logger.error('Staff Fetch Error', err);
    }
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

  const handleAddService = async (vehicleId, service) => {
    setIsUpdatingDuration(true);
    const toastId = toast.loading('Validating schedule integrity...');
    try {
      const v = vehicles.find(item => item.id === vehicleId);
      const vehicleType = v.vehicle_type;
      const price = service.prices[vehicleType] || 0;
      const extraMinutes = service.durationMinutes || 60;

      // 1. DURATION UPDATE GUARD: Check if extending the end_datetime causes overbooking
      const newEndDatetime = new Date(new Date(booking.end_datetime).getTime() + extraMinutes * 60000).toISOString();
      
      const { data: overlapping } = await supabase
        .from('bookings')
        .select('id, start_datetime, end_datetime, status, vehicles:booking_vehicles(id, status)')
        .neq('id', id)
        .neq('status', 'cancelled')
        .lte('start_datetime', newEndDatetime)
        .gte('end_datetime', booking.start_datetime);

      const { data: blocks } = await supabase.from('blocked_slots').select('*').eq('date', booking.start_datetime.split('T')[0]);

      // Check each hour from now until the new end time
      const startH = new Date(booking.start_datetime).getHours();
      const newEndH = new Date(newEndDatetime).getHours();
      const activeBookings = filterActiveBookings(overlapping || []);

      for (let h = startH; h <= newEndH; h++) {
        const occ = calculateOccupancy(h, booking.start_datetime.split('T')[0], activeBookings, blocks || []);
        if (occ >= SHOP_CONFIG.MAX_BAYS) {
          throw new Error(`CRITICAL OVERBOOKING: Bay capacity exceeded at ${h}:00. Cannot extend duration.`);
        }
      }

      // 2. Commit Service
      const { error: sError } = await supabase.from('booking_vehicle_services').insert({
        booking_vehicle_id: vehicleId,
        service_name: service.name,
        price: price
      });

      if (sError) throw sError;

      // 3. Update Booking End Time and Total
      const { error: bError } = await supabase.from('bookings').update({
        end_datetime: newEndDatetime,
        total_amount: Number(booking.total_amount) + price
      }).eq('id', id);

      if (bError) throw bError;

      // 4. Audit Log
      const { data: { user: actor } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert({
        booking_id: id,
        action_type: 'SERVICE_ADDED',
        actor_name: actor?.email || 'Admin',
        actor_role: 'ADMIN',
        details: `Added ${service.name} to ${v.make} ${v.model}. Duration extended by ${extraMinutes}m.`
      });

      toast.success('Service added and schedule synchronized.', { id: toastId });
      fetchBookingDetails();
      setServiceModal({ open: false, vehicleId: null });
    } catch (err) {
      toast.error(err.message || 'Validation failed', { id: toastId });
    } finally {
      setIsUpdatingDuration(false);
    }
  };

  const updateVehicleStatus = async (vehicleId, status) => {
    try {
      const timestamp = new Date().toISOString();
      const updateData = { status };
      
      if (status === 'in_progress') updateData.started_at = timestamp;
      if (status === 'completed') updateData.completed_at = timestamp;

      const { error } = await supabase.from('booking_vehicles').update(updateData).eq('id', vehicleId);
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

  const fetchCustomerHistory = async () => {
    setHistoryModal(true);
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`*, vehicles:booking_vehicles(*, services:booking_vehicle_services(*))`)
        .eq('customer_id', booking.customer_id)
        .order('start_datetime', { ascending: false });

      if (error) throw error;
      setUserBookings(data || []);
    } catch (err) {
      toast.error('Failed to load history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const cardStyle = {
    background: 'var(--admin-card)',
    borderRadius: 'var(--admin-radius)',
    padding: '1.5rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
    border: '1px solid rgba(255,255,255,0.05)'
  };

  const labelStyle = {
    fontSize: '0.7rem',
    fontWeight: '900',
    color: '#6c757d',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '0.4rem',
    opacity: 0.6
  };

  const valueStyle = {
    fontSize: '0.95rem',
    fontWeight: '800',
    color: '#fff'
  };

  const naStyle = {
    fontSize: '0.95rem',
    fontWeight: '700',
    color: '#6c757d',
    opacity: 0.5
  };

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
      padding: '0 0 10rem 0',
      position: 'relative'
    }}>
      
      {/* 1. HEADER & BREADCRUMBS (THE "STRONG LINE" ALIGNMENT) */}
      <div style={{ marginBottom: '2.5rem' }}>
        <button 
          onClick={() => navigate(-1)}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '0.4rem', 
            background: 'none', color: 'var(--admin-text-secondary)', 
            border: 'none', padding: 0, 
            fontWeight: '900', cursor: 'pointer', 
            fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1.5px',
            marginBottom: '1rem', opacity: 0.6
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
        >
          <ArrowLeft size={14} /> ADMINISTRATIVE CONSOLE
        </button>
        
        <h1 style={{ margin: 0, fontSize: '2.8rem', fontWeight: '950', color: 'white', letterSpacing: '-2px', textTransform: 'uppercase', lineHeight: 1 }}>
          {booking.booking_id || `SW-BKG-${id.slice(0, 8).toUpperCase()}`}
        </h1>
        <p style={{ margin: '0.75rem 0 0 0', color: 'var(--admin-text-secondary)', fontWeight: '600', fontSize: '0.95rem', opacity: 0.8 }}>
          Detailed operational record for session initialized on {new Date(booking.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
        </p>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isMobile ? '1fr' : '7.5fr 2.5fr', 
        gap: '1.5rem',
        alignItems: 'start'
      }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
          
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Banknote size={20} color="var(--admin-brand)" />
                <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '950', textTransform: 'uppercase', color: 'white', letterSpacing: '1px' }}>Financial Ledger</h3>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.6rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem', letterSpacing: '1px', opacity: 0.6 }}>Total Booking Value</div>
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                  <span style={{ fontSize: '1.1rem', color: 'white', opacity: 0.4 }}>₱</span>{booking.total_amount?.toLocaleString()}
                </div>
              </div>
            </div>

            <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '2px solid var(--admin-border)' }}>
                    <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '950', color: 'var(--admin-text-primary)', textTransform: 'uppercase' }}>DATE</th>
                    <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '950', color: 'var(--admin-text-primary)', textTransform: 'uppercase' }}>TIME</th>
                    <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '950', color: 'var(--admin-text-primary)', textTransform: 'uppercase' }}>METHOD</th>
                    <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '950', color: 'var(--admin-text-primary)', textTransform: 'uppercase' }}>STATUS</th>
                    <th style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: '950', color: 'var(--admin-text-primary)', textTransform: 'uppercase' }}>AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {bookingPayments.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                      <td style={{ padding: '1.25rem 0.75rem', verticalAlign: 'middle', textAlign: 'left' }}>
                        <div style={{ fontWeight: '800', color: '#fff', fontSize: '0.85rem' }}>{new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      </td>
                      <td style={{ padding: '1.25rem 0.75rem', verticalAlign: 'middle', textAlign: 'left', fontSize: '0.75rem', color: '#A0A0A0', fontWeight: '800' }}>
                        {new Date(p.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '1.25rem 0.75rem', verticalAlign: 'middle', textAlign: 'left', fontWeight: '800', color: '#A0A0A0' }}>{p.method}</td>
                      <td style={{ padding: '1.25rem 0.75rem', verticalAlign: 'middle', textAlign: 'left' }}>
                        <span style={{ 
                          fontSize: '0.55rem', fontWeight: '950', padding: '0.3rem 0.6rem', borderRadius: '2px',
                          background: p.status === 'PAID' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: p.status === 'PAID' ? '#10b981' : '#f59e0b',
                          border: `1px solid ${p.status === 'PAID' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`
                        }}>
                          {p.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '1.25rem 0.75rem', verticalAlign: 'middle', textAlign: 'right', fontWeight: '950' }}>₱{p.amount?.toLocaleString()}</td>
                    </tr>
                  ))}
                  {bookingPayments.length === 0 && (
                    <tr><td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: 'var(--admin-text-secondary)', fontWeight: '800' }}>NO TRANSACTIONS RECORDED</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ 
              padding: '1rem', 
              background: balance === 0 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(245, 158, 11, 0.05)', 
              borderRadius: '4px', 
              textAlign: 'center', 
              border: `1px solid ${balance === 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
              color: balance === 0 ? '#10b981' : '#f59e0b', 
              fontSize: '0.8rem', 
              fontWeight: '950',
              textTransform: 'uppercase', 
              letterSpacing: '0.8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem'
            }}>
              {balance === 0 ? (
                <><CheckCircle2 size={16} /> ACCOUNT SETTLED • NO BALANCE DUE</>
              ) : (
                <><AlertCircle size={16} /> ATTENTION: OUTSTANDING BALANCE ₱{balance.toLocaleString()}</>
              )}
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

          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '950', textTransform: 'uppercase', color: 'var(--admin-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Car size={16} color="var(--admin-brand)" /> Fleet Units ({vehicles.length})
              </h3>
              <div style={{ fontSize: '0.65rem', fontWeight: '900', color: 'var(--admin-text-secondary)', opacity: 0.6 }}>SUB-TOTAL: ₱{booking.total_amount?.toLocaleString()}</div>
            </div>

            {vehicles.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', opacity: 0.3, background: 'var(--admin-bg)', borderRadius: '0.75rem', border: '1px dashed var(--admin-border)', minHeight: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <Box size={20} style={{ marginBottom: '0.5rem' }} />
                <div style={{ fontSize: '0.65rem', fontWeight: '900' }}>NO ASSETS REGISTERED</div>
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
                      <div style={{ textAlign: 'right', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: '950', color: 'var(--admin-brand)', fontSize: '1.1rem', marginBottom: '0.25rem' }}>₱{v.subtotal?.toLocaleString()}</div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              onClick={() => setServiceModal({ open: true, vehicleId: v.id })}
                              disabled={isLocked}
                              style={{ 
                                background: 'transparent', border: '1px solid #444', 
                                padding: '0.4rem 0.6rem', borderRadius: '4px', color: 'var(--admin-text-secondary)', 
                                cursor: 'pointer', fontSize: '0.6rem', fontWeight: '950', display: 'flex', alignItems: 'center', gap: '0.3rem'
                              }}
                            >
                              <Plus size={12} /> ADD
                            </button>
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
                    </div>

                    {/* SERVICES LIST */}
                    <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {v.services?.map((s, idx) => (
                        <div key={idx} style={{ 
                          padding: '0.3rem 0.7rem', background: 'rgba(255,255,255,0.02)', 
                          border: '1px solid var(--admin-border)', borderRadius: '4px',
                          display: 'flex', alignItems: 'center', gap: '0.5rem'
                        }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: '900', color: 'white', textTransform: 'uppercase' }}>{s.service_name}</span>
                          <span style={{ fontSize: '0.6rem', fontWeight: '950', color: 'var(--admin-brand)' }}>₱{s.price?.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    {/* REQ-ADM-15: TECHNICAL DOCUMENTATION (Photos & Notes) */}
                    <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '1.5rem' }}>
                          <div>
                            <div style={{ fontSize: '0.6rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Started At</div>
                            <div style={{ fontSize: '0.75rem', fontWeight: '800', color: v.started_at ? '#fff' : 'rgba(255,255,255,0.1)' }}>
                              {v.started_at ? new Date(v.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.6rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Finished At</div>
                            <div style={{ fontSize: '0.75rem', fontWeight: '800', color: v.completed_at ? '#10b981' : 'rgba(255,255,255,0.1)' }}>
                              {v.completed_at ? new Date(v.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {(v.service_notes || v.photo_proof_url) && (
                        <div style={{ display: 'flex', gap: '1.5rem' }}>
                          {v.photo_proof_url && (
                            <div 
                              onClick={() => window.open(v.photo_proof_url, '_blank')}
                              style={{ width: '80px', height: '80px', borderRadius: '4px', background: 'black', border: '1px solid var(--admin-border)', overflow: 'hidden', cursor: 'zoom-in', flexShrink: 0 }}
                            >
                              <img src={v.photo_proof_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Service Evidence" />
                            </div>
                          )}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.6rem', fontWeight: '950', color: 'var(--admin-brand)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.4rem' }}>Technical Documentation</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)', fontWeight: '600', fontStyle: 'italic', lineHeight: 1.4 }}>
                              "{v.service_notes || 'No detailing notes provided by technician.'}"
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* === SIDEBAR COLUMN === */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
          
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--admin-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--admin-border)' }}>
                <User size={18} color="var(--admin-text-secondary)" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '950', color: 'white' }}>{booking.customer?.full_name}</h3>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <span style={{ fontSize: '0.6rem', fontWeight: '900', color: 'var(--admin-brand)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fleet Account Holder</span>
                  <button onClick={fetchCustomerHistory} style={{ background: 'transparent', border: 'none', color: 'var(--admin-info)', fontSize: '0.6rem', fontWeight: '950', cursor: 'pointer', padding: 0, textTransform: 'uppercase', textDecoration: 'underline' }}>VIEW HISTORY</button>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <div style={{ ...labelStyle, opacity: 0.6 }}>Registered Contact</div>
                <div style={booking.customer?.phone_number ? valueStyle : naStyle}>{booking.customer?.phone_number || 'N/A'}</div>
              </div>
              <div>
                <div style={{ ...labelStyle, opacity: 0.6 }}>Primary Email ID</div>
                <div style={booking.customer?.email ? valueStyle : naStyle}>{booking.customer?.email}</div>
              </div>
            </div>
          </div>

          {/* AI VISION AUDIT PANEL (REQ-SYS-01) */}
          {booking.ocr_metadata && Object.keys(booking.ocr_metadata).length > 0 && (
            <div style={{ 
              ...cardStyle, 
              border: booking.ocr_metadata.status === 'MISMATCHED' ? '2px solid #f59e0b' : '1px solid var(--admin-border)',
              boxShadow: booking.ocr_metadata.status === 'MISMATCHED' ? '0 0 20px rgba(245, 158, 11, 0.15)' : 'none',
              animation: booking.ocr_metadata.status === 'MISMATCHED' ? 'pulse-border 2s infinite' : 'none'
            }}>
              <style>{`
                @keyframes pulse-border {
                  0% { border-color: #f59e0b; }
                  50% { border-color: rgba(245, 158, 11, 0.2); }
                  100% { border-color: #f59e0b; }
                }
              `}</style>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Zap size={18} color={booking.ocr_metadata.status === 'MISMATCHED' ? '#f59e0b' : 'var(--admin-brand)'} />
                  <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '950', textTransform: 'uppercase', color: 'white', letterSpacing: '1px' }}>AI Vision Audit</h3>
                </div>
                <div style={{ fontSize: '0.55rem', fontWeight: '950', color: 'var(--admin-text-secondary)', opacity: 0.6 }}>GEMINI 1.5 FLASH</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <div style={labelStyle}>Extracted Reference</div>
                  <div style={{ ...valueStyle, color: 'var(--admin-brand)', fontFamily: 'monospace', letterSpacing: '1px' }}>
                    {booking.ocr_metadata.referenceNo || 'N/A'}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <div style={labelStyle}>AI Detected</div>
                    <div style={{ ...valueStyle, color: booking.ocr_metadata.status === 'MISMATCHED' ? '#f59e0b' : '#fff' }}>
                      ₱{booking.ocr_metadata.amount?.toLocaleString() || '0'}
                    </div>
                  </div>
                  <div>
                    <div style={labelStyle}>Integrity</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ flex: 1, height: '4px', background: 'var(--admin-bg)', borderRadius: '2px' }}>
                        <div style={{ width: `${booking.ocr_metadata.integrity || 0}%`, height: '100%', background: 'var(--admin-brand)', borderRadius: '2px' }} />
                      </div>
                      <span style={{ fontSize: '0.7rem', fontWeight: '950', color: 'var(--admin-brand)' }}>{booking.ocr_metadata.integrity}%</span>
                    </div>
                  </div>
                </div>

                {booking.ocr_metadata.status === 'MISMATCHED' && (
                  <div style={{ padding: '0.75rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldAlert size={14} color="#f59e0b" />
                    <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#f59e0b', textTransform: 'uppercase' }}>AI Flagged Discrepancy</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TECHNICIAN ASSIGNMENT */}
          <div style={{ ...cardStyle, opacity: (booking.status === 'in_progress' || isLocked) ? 0.6 : 1, pointerEvents: (booking.status === 'in_progress' || isLocked) ? 'none' : 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '950', textTransform: 'uppercase', color: 'var(--admin-text-secondary)', opacity: 0.6 }}>Personnel</h3>
            </div>
            
            {booking.staff_id ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.85rem', borderRadius: '4px', border: '1px solid var(--admin-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <ShieldCheck size={16} color="var(--admin-brand)" />
                  <span style={{ fontSize: '0.85rem', fontWeight: '900', color: '#fff' }}>{booking.assigned_staff?.full_name}</span>
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
                                toast.success('Technician cleared.');
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
                      ), { 
                        duration: 5000, 
                        position: 'top-center', 
                        style: { 
                          background: '#15171A', 
                          border: '1px solid var(--admin-border)', 
                          borderRadius: '4px', 
                          padding: '1.5rem',
                          marginTop: '35vh',
                          minWidth: '320px',
                          boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                        } 
                      });
                    }} 
                    style={{ fontSize: '0.6rem', fontWeight: '950', color: 'var(--admin-text-secondary)', background: 'transparent', border: '1px solid #444', padding: '0.25rem 0.5rem', borderRadius: '2px', cursor: 'pointer', transition: '0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--admin-brand)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = '#444'}
                  >
                    REASSIGN
                  </button>
                )}
              </div>
            ) : (
              <select 
                onChange={(e) => handleAssignStaff(e.target.value)} 
                style={{ width: '100%', padding: '0.85rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '4px', color: 'white', fontWeight: '900', outline: 'none', fontSize: '0.8rem' }}
              >
                <option value="">SELECT STAFF...</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id} disabled={s.isBusy}>
                    {s.full_name} {s.isBusy ? '(OCCUPIED)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div style={{ padding: '1rem', textAlign: 'center', opacity: 0.3, background: 'rgba(255,255,255,0.02)', borderRadius: '0.75rem', border: '1px dashed var(--admin-border)', minHeight: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: '900' }}>LIVE SUPPORT LOGS (0)</div>
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
      {/* SERVICE MANAGEMENT MODAL */}
      {serviceModal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ background: '#15171A', border: '1px solid var(--admin-border)', borderRadius: '8px', width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '950', textTransform: 'uppercase' }}>Add Service Treatment</h3>
                <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--admin-text-secondary)', fontWeight: '700' }}>Extending duration will re-validate bay capacity.</p>
              </div>
              <button onClick={() => setServiceModal({ open: false, vehicleId: null })} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {Object.keys(SERVICES_DATA).map(category => (
                <div key={category}>
                  <div style={{ fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-brand)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Zap size={12} /> {category}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                    {SERVICES_DATA[category].map(s => {
                      const v = vehicles.find(item => item.id === serviceModal.vehicleId);
                      const price = s.prices[v?.vehicle_type] || 0;
                      if (price === 0) return null;
                      
                      return (
                        <div 
                          key={s.id} 
                          onClick={() => handleAddService(serviceModal.vehicleId, s)}
                          style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '4px', padding: '1rem', cursor: 'pointer' }}
                        >
                          <div style={{ fontWeight: '950', fontSize: '0.85rem', marginBottom: '0.25rem' }}>{s.name}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--admin-text-secondary)' }}>{s.estTime}</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: '950', color: 'var(--admin-brand)' }}>₱{price.toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* CUSTOMER HISTORY MODAL */}
      {historyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ background: '#15171A', border: '1px solid var(--admin-border)', borderRadius: '8px', width: '100%', maxWidth: '800px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '950', textTransform: 'uppercase' }}>{booking.customer?.full_name} • SYSTEM HISTORY</h3>
                <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--admin-text-secondary)', fontWeight: '700' }}>Historical service records and revenue trail.</p>
              </div>
              <button onClick={() => setHistoryModal(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
              {loadingHistory ? <LoadingState message="Syncing history..." /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {userBookings.map(b => (
                    <div key={b.id} style={{ background: 'var(--admin-bg)', padding: '1rem', borderRadius: '4px', border: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: '950', color: '#fff' }}>{new Date(b.start_datetime).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                        <div style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--admin-text-secondary)' }}>ID: #{b.id.slice(0, 8).toUpperCase()} • {b.status.toUpperCase()}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: '950', color: 'var(--admin-brand)' }}>₱{b.total_amount?.toLocaleString()}</div>
                        <button onClick={() => { setHistoryModal(false); navigate(`/admin/bookings/${b.id}`); }} style={{ background: 'transparent', border: 'none', color: 'var(--admin-info)', fontSize: '0.6rem', fontWeight: '950', cursor: 'pointer', padding: 0 }}>VIEW DETAILS</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBookingDetails;
