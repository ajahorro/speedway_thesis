import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  ArrowLeft, Clock, CreditCard, User, Car, ClipboardList,
  History, CheckCircle, XCircle, AlertCircle, MessageCircle,
  Hash, Calendar, Phone, Shield, Activity, Play, CheckCircle2,
  Package, Truck, Trash2, Banknote, Loader2, Eye, ArrowRight, X, UserX, Box,
  Send, ShieldCheck, ShieldAlert, Image as ImageIcon, Plus, Zap, TrendingUp,
  FileText, Printer, CalendarClock
} from 'lucide-react';
import { SERVICES_DATA } from '../../data/servicesCatalog';
import { calculateOccupancy, filterActiveBookings } from '../../utils/schedulingUtils';
import { SHOP_CONFIG } from '../../config/constants';
import { getStatusColor, isStaffOccupied } from '../../utils/bookingHelpers';
import { calculateRequiredDownpayment, requiresDownpayment } from '../../utils/paymentUtils';
import toast from 'react-hot-toast';
import BookingAuditTrail from '../../components/BookingAuditTrail';
import BookingSummaryHeader from '../../components/BookingSummaryHeader';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useUI } from '../../context/UIContext';
import { useGlobalChat } from '../../context/ChatContext';
import PageHeader from '../../components/PageHeader';
import LoadingState from '../../components/LoadingState';
import FloatingBubbleChat from '../../components/FloatingBubbleChat';
import OfficialReceipt from '../../components/OfficialReceipt';
import { logger } from '../../utils/logger';

import { sendStatusEmail, sendBookingConfirmationEmail, sendPaymentReceiptEmail } from '../../services/notificationService';
import { sendStaffAssignmentNotification } from '../../services/EmailService';
import { getAvailableSlots } from '../../services/scheduleService';
import { rescheduleBooking } from '../../services/bookingService';
import { BACKEND_URL } from '../../config/api';
import OfficialReceipt from '../../components/OfficialReceipt';

const AdminBookingDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { openModal } = useUI();
  const { setActiveBookingId } = useGlobalChat();
  const [booking, setBooking] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [bookingPayments, setBookingPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [serviceModal, setServiceModal] = useState({ open: false, vehicleId: null });
  const [pendingService, setPendingService] = useState(null);
  const [servicePaymentType, setServicePaymentType] = useState('Downpayment');
  const [servicePaymentAmount, setServicePaymentAmount] = useState('');
  const [servicePaymentMethod, setServicePaymentMethod] = useState('Cash');
  const [serviceReferenceNumber, setServiceReferenceNumber] = useState('');
  const [isUpdatingDuration, setIsUpdatingDuration] = useState(false);
  const [receiptModal, setReceiptModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
<<<<<<< HEAD
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const [rescheduleSlotsLoading, setRescheduleSlotsLoading] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
=======
  const [undoNoShowModal, setUndoNoShowModal] = useState({
    open: false,
    validationMessage: '',
    isSubmitting: false,
  });
>>>>>>> e23099d5 (Logic inconsistencies still exists)

  useEffect(() => {
    setActiveBookingId(id);
    return () => setActiveBookingId(null);
  }, [id, setActiveBookingId]);
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

      if (!customer && bData.customer_email) {
        const { data: cDataByEmail } = await supabase
          .from('profiles')
          .select('full_name, email, phone_number')
          .ilike('email', bData.customer_email.trim())
          .maybeSingle();

        customer = cDataByEmail;
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

      if (bData.staff_id && ['scheduled', 'pending'].includes(String(bData.status || '').toLowerCase())) {
        await confirmBookingWhenReady();
      }
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
    try {
      const { data: allStaff } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'STAFF');

      if (!allStaff) return;

      // Find staff assigned to ANY booking or vehicle unit currently IN_PROGRESS
      const { data: activeBookings } = await supabase
        .from('bookings')
        .select('staff_id, status')
        .not('staff_id', 'is', null)
        .in('status', ['in_progress', 'ongoing', 'IN_PROGRESS']);

      const { data: activeVehicles } = await supabase
        .from('booking_vehicles')
        .select('booking_id, status, bookings!inner(staff_id)')
        .eq('status', 'IN_PROGRESS');

      const busyStaffIds = new Set();
      (activeBookings || []).forEach(b => {
        if (b.staff_id) busyStaffIds.add(b.staff_id);
      });
      (activeVehicles || []).forEach(v => {
        if (v.bookings?.staff_id) busyStaffIds.add(v.bookings.staff_id);
      });

      const processedStaff = allStaff.map(s => {
        const isClockedIn = Boolean(s.is_clocked_in);
        const hasActiveJob = busyStaffIds.has(s.id);
        const isAvailable = isClockedIn && !hasActiveJob;
        return {
          ...s,
          isClockedIn,
          hasActiveJob,
          isAvailable
        };
      });

      setStaffList(processedStaff);
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
    try {
      const bookingId = url?.match(/\/bookings\/([^/]+)/)?.[1] || id;
      const { error } = await supabase.from('notifications').insert({
        user_id: userId,
        title,
        message,
        notification_type: type,
        action_url: url,
        booking_id: bookingId,
        is_read: false
      });
      if (error) logger.error('[notifyUser] Error inserting notification:', error);
    } catch (err) {
      logger.error('[notifyUser] Exception:', err);
    }
  };

  const confirmBookingWhenReady = async () => {
    const { data: currentBooking, error: bookingError } = await supabase
      .from('bookings')
      .select('status, staff_id, customer_id, total_amount, start_datetime')
      .eq('id', id)
      .single();
    if (bookingError) throw bookingError;
    if (!['scheduled', 'pending'].includes(String(currentBooking.status).toLowerCase()) || !currentBooking.staff_id) return false;

    const { data: paidPayments, error: paymentError } = await supabase
      .from('payments')
      .select('amount')
      .eq('booking_id', id)
      .eq('status', 'PAID');
    if (paymentError) throw paymentError;

    const paidAmount = (paidPayments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const requiredAmount = calculateRequiredDownpayment(Number(currentBooking.total_amount || 0)).amount;
    if (paidAmount < requiredAmount) return false;

    const { error: updateError } = await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', id);
    if (updateError) throw updateError;
    await notifyUser(currentBooking.customer_id, 'Booking Confirmed', `Your booking #${id.substring(0, 8).toUpperCase()} has been confirmed and is scheduled for ${new Date(currentBooking.start_datetime).toLocaleString()}.`, 'BOOKING_CONFIRMED', `/customer/bookings/${id}`);
    await sendBookingConfirmationEmail(id);
    return true;
  };

  const handleAssignStaff = async (staffId) => {
    const toastId = toast.loading('Assigning technician...');
    try {
      const { data: { user: admin } } = await supabase.auth.getUser();

      if (!staffId) {
        const { error: clearError } = await supabase
          .from('bookings')
          .update({ staff_id: null, assigned_by: admin?.id, assigned_at: null })
          .eq('id', id);
        if (clearError) throw clearError;
        toast.success('Technician cleared.', { id: toastId });
        fetchBookingDetails();
        return;
      }
      
      // REQ-ADM-04: Determine if this is a post-service assignment
      const isPostService = booking.status === 'completed';
      const customerName = booking.customer?.full_name || booking.customer_name || 'Customer';
      
      const updatePayload = { 
        staff_id: staffId, 
        assigned_by: admin?.id, 
        assigned_at: new Date().toISOString(),
        customer_name: customerName,
        contact_number: booking.contact_number || booking.customer?.phone_number
      };

      const { error } = await supabase.from('bookings').update(updatePayload).eq('id', id);
      
      if (error) throw error;
      
      const staffMember = staffList.find(s => s.id === staffId);
      const staffName = staffMember?.full_name || 'Staff';

      // 1. Notify Staff in-app
      await notifyUser(
        staffId, 
        'New Fleet Assigned', 
        `You have been assigned to lead the detailing session for ${customerName}.`, 
        'TASK_ASSIGNED', 
        `/staff/tasks`
      );
      
      // 2. Dual Delivery — Dispatch direct 1-to-1 email alert to technician asynchronously
      if (staffMember?.email) {
        sendStaffAssignmentNotification(staffMember.email, {
          date: booking.start_datetime ? new Date(booking.start_datetime).toLocaleDateString() : 'Scheduled Date',
          time: booking.start_datetime ? new Date(booking.start_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Scheduled Time',
          vehicle: vehicles?.[0]?.make_model || vehicles?.[0]?.model || 'Assigned Vehicle',
          plate: vehicles?.[0]?.plate_number || 'N/A',
          services: vehicles?.[0]?.services?.map(s => s.service_name || s.name).join(', ') || 'Detailing Services'
        }).catch(err => logger.error('Staff assignment email failed:', err));
      }

      // LOG AUDIT — differentiate post-service vs normal assignment
      await supabase.from('audit_logs').insert({
        booking_id: id,
        action_type: isPostService ? 'POST_SERVICE_ASSIGNMENT' : 'STAFF_ASSIGNED',
        actor_name: admin?.email || 'Admin',
        actor_role: 'ADMIN',
        details: isPostService 
          ? `Post-service assignment: Linked technician ${staffName} to completed session for reporting.` 
          : `Assigned technician ${staffName} to lead this session.`
      });

      toast.success(isPostService ? 'Post-Service Assignment Recorded' : 'Technician Assigned Successfully', { id: toastId });
      await confirmBookingWhenReady();
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
      const verifiedAmount = Number(p.detected_amount || p.amount || 0);
      const { error } = await supabase.from('payments').update({ amount: verifiedAmount, status: 'PAID', notes: `${p.notes || 'PAYMENT_DIGITAL'} | PAYMENT_DIGITAL_VERIFIED | OCR_AMOUNT:${verifiedAmount}`, verified_by: verifier?.id, verified_at: new Date().toISOString() }).eq('id', p.id);
      if (error) throw error;
      
      await notifyUser(booking.customer_id, 'Payment Verified', `Your payment of ₱${p.amount.toLocaleString()} has been approved. Thank you!`, 'PAYMENT_APPROVED', `/my-bookings/${id}`);
      
      // 🚀 AUTOMATIC LIFECYCLE SYNC via Backend Propagator
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      await fetch(`${BACKEND_URL}/api/bookings/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: id,
          unitId: vehicles[0]?.id, // Just trigger with the first unit to force a sync
          newStatus: vehicles[0]?.status, 
          actorName: verifier?.email || 'Admin',
          actorRole: 'ADMIN'
        })
      });

      await confirmBookingWhenReady();

      toast.success('Payment Approved & Ledger Synced', { id: toastId });
      fetchPayments(); fetchAuditLogs(); fetchBookingDetails();
    } catch (err) {
      logger.error('Payment verification failed:', err);
      toast.error(err.message || 'Verification failed', { id: toastId });
    }
  };

  const handleRejectPayment = async (p) => {
    const reason = window.prompt('Reason for rejection:');
    if (!reason) return;
    try {
      const { error } = await supabase.from('payments').update({ status: 'REJECTED', rejection_reason: reason }).eq('id', p.id);
      if (error) throw error;
      
      await notifyUser(booking.customer_id, 'Payment Rejected', `Reason: ${reason}. Please re-submit your receipt.`, 'PAYMENT_REJECTED', `/my-bookings/${id}`);
      
      toast.success('Receipt rejected');
      fetchPayments(); fetchBookingDetails(); fetchAuditLogs();
    } catch (err) { toast.error('Rejection failed'); }
  };

  const performBookingStatusUpdate = async (status, reason = '') => {
    const toastId = toast.loading(`Marking session as ${status.toUpperCase()}...`);
    try {
      const timestamp = new Date().toISOString();
      const updatePayload = { status };
      if (status === 'cancelled') {
        updatePayload.cancellation_reason = reason;
        updatePayload.cancellation_type = 'ADMIN_MANUAL';
        updatePayload.refund_status = 'QUEUED';
      }
      const { error } = await supabase.from('bookings').update(updatePayload).eq('id', id);
      if (error) throw error;

      if (status === 'cancelled') {
        const { error: refundQueueError } = await supabase.from('payments')
          .update({ status: 'REFUND_PENDING' })
          .eq('booking_id', id)
          .in('status', ['PAID', 'FOR_VERIFICATION']);
        if (refundQueueError) throw refundQueueError;
      }
      
      // 🚀 CASCADE STATUS: If booking is finished, all vehicles must be finished
      if (status === 'completed' || status === 'cancelled') {
        const vUpdate = { status: status.toUpperCase() };
        if (status === 'completed') vUpdate.completed_at = timestamp;
        await supabase.from('booking_vehicles').update(vUpdate).eq('booking_id', id);
      }

      const bookingRef = id.substring(0, 8).toUpperCase();
      const statusNotifications = {
        confirmed: {
          title: 'Booking Confirmed',
          message: `Your booking #${bookingRef} has been confirmed and is scheduled for ${new Date(booking.start_datetime).toLocaleString()}.`,
          type: 'BOOKING_CONFIRMED'
        },
        in_progress: {
          title: 'Service Started',
          message: `Work has started on your booking #${bookingRef}. You can follow its progress from your dashboard.`,
          type: 'SERVICE_STARTED'
        },
        completed: {
          title: 'Service Completed',
          message: `Service for booking #${bookingRef} is complete. Your vehicle is ready for the next step.`,
          type: 'SERVICE_COMPLETED'
        },
        cancelled: {
          title: 'Booking Cancelled',
          message: `Booking #${bookingRef} was cancelled by the studio. Please contact us if you need assistance.`,
          type: 'BOOKING_CANCELLED'
        }
      };
      const notification = statusNotifications[status];
      if (notification) {
        await notifyUser(booking.customer_id, notification.title, notification.message, notification.type, `/customer/bookings/${id}`);
      }
      
      // DISPATCH PROFESSIONAL EMAIL VIA RESEND (REQ-SYS-02)
      if (status === 'confirmed') {
        await sendBookingConfirmationEmail(id);
      } else {
        await sendStatusEmail(id, status);
      }
      
      toast.success(`Booking ${status.toUpperCase()}`, { id: toastId });
      fetchBookingDetails();
    } catch (err) { toast.error('Update failed', { id: toastId }); }
  };

  const requestBookingStatusUpdate = (status) => {
    const labels = {
      confirmed: 'confirm this booking',
      in_progress: 'start this service',
      completed: 'finish this service',
      cancelled: 'cancel this booking'
    };

    openModal({
      title: `Confirm: ${labels[status] || 'update booking'}`,
      message: status === 'cancelled'
        ? 'This cannot be undone. Continue to enter the required cancellation reason?'
        : `Are you sure you want to ${labels[status] || 'update this booking'}?`,
      confirmText: 'Yes, Continue',
      cancelText: 'No, Keep It',
      type: status === 'cancelled' ? 'danger' : 'info',
      onConfirm: () => {
        if (status === 'cancelled') {
          const reason = window.prompt('Cancellation reason (required):');
          if (!reason?.trim()) {
            toast.error('A cancellation reason is required.');
            return;
          }
          performBookingStatusUpdate(status, reason.trim());
          return;
        }
        performBookingStatusUpdate(status);
      }
    });
  };

  // 🛡️ REQ-ADM-02: Manual No-Show Cancellation with Audit
  const handleNoShowCancel = async () => {
    openModal({
      title: 'Cancel No-Show Booking?',
      message: 'This will cancel the flagged booking and record the no-show in the audit trail.',
      confirmText: 'Yes, Cancel Booking',
      cancelText: 'Keep Flagged',
      type: 'danger',
      onConfirm: async () => {
        const toastId = toast.loading('Recording No-Show cancellation...');
        try {
          const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/bookings/admin-cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId: id, reason: 'No-Show' })
          });

          const result = await response.json();
          if (!result.success) throw new Error(result.error);

          await notifyUser(booking.customer_id, 'Booking Flagged No-Show', 'We missed you. Your scheduled slot has expired. Visit the Refund Hub for details.', 'FLAGGED_NOSHOW', `/customer/bookings/${id}`);
          await sendStatusEmail(id, 'FLAGGED_NOSHOW', 'No-show: service was not started within one hour of the scheduled time.');

          toast.success('Cancelled as No-Show', { id: toastId });
          fetchBookingDetails();
          fetchAuditLogs();
        } catch (err) {
          toast.error(err.message || 'Cancellation failed', { id: toastId });
        }
      }
    });
  };

  const formatOriginalSchedule = (dateValue) => {
    if (!dateValue) return 'Original schedule unavailable';

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return 'Original schedule unavailable';

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  };

  const handleUndoNoShow = () => {
    const hasPendingRefund = ['PENDING', 'QUEUED', 'PROCESSING', 'EMAIL_PENDING'].includes(String(booking?.refund_status || '').toUpperCase())
      || (bookingPayments || []).some(payment => ['REFUND_PENDING', 'PENDING', 'QUEUED', 'PROCESSING', 'EMAIL_PENDING'].includes(String(payment.status || '').toUpperCase()));

    const hasProcessedRefund = ['PROCESSED', 'REFUNDED', 'RELEASED'].includes(String(booking?.refund_status || '').toUpperCase())
      || (bookingPayments || []).some(payment => {
          const status = String(payment.status || '').toUpperCase();
          return ['REFUNDED', 'PROCESSED', 'RELEASED'].includes(status) || (String(payment.method || '').toUpperCase() === 'SYSTEM_REFUND' && Number(payment.amount || 0) < 0);
        });

    if (hasProcessedRefund) {
      toast.error('Cannot undo: Payment has already been refunded. Customer must create a new booking.');
      return;
    }

    setUndoNoShowModal({
      open: true,
      validationMessage: '',
      isSubmitting: false,
    });
  };

  const confirmUndoNoShow = async () => {
    const hasPendingRefund = ['PENDING', 'QUEUED', 'PROCESSING', 'EMAIL_PENDING'].includes(String(booking?.refund_status || '').toUpperCase())
      || (bookingPayments || []).some(payment => ['REFUND_PENDING', 'PENDING', 'QUEUED', 'PROCESSING', 'EMAIL_PENDING'].includes(String(payment.status || '').toUpperCase()));

    setUndoNoShowModal(prev => ({ ...prev, isSubmitting: true, validationMessage: '' }));

    try {
      const backendBaseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      const response = await fetch(`${backendBaseUrl}/api/bookings/undo-no-show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: id,
          actorName: 'ADMIN',
          pendingRefund: hasPendingRefund
        })
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Unable to restore booking.');
      }

      await supabase.from('audit_logs').insert({
        booking_id: id,
        action_type: 'NOSHOW_FLAG_UNDONE',
        actor_name: 'ADMIN',
        actor_role: 'ADMIN',
        details: `Admin reverted no-show for booking ${id}. ${hasPendingRefund ? 'Pending refund request intercepted and cancelled.' : 'No refund request was pending.'}`
      });

      await notifyUser(booking.customer_id, 'Booking Restored', 'Your booking has been reinstated and is currently being processed by the studio.', 'BOOKING_UPDATED', `/customer/bookings/${id}`);
      await sendStatusEmail(id, 'scheduled', 'Your booking was reinstated after the no-show flag was reversed. Please confirm the updated schedule and staff assignment.');

      setUndoNoShowModal({ open: false, validationMessage: '', isSubmitting: false });
      toast.success('Booking restored to active status.');
      fetchBookingDetails();
      fetchAuditLogs();
    } catch (err) {
      setUndoNoShowModal(prev => ({ ...prev, isSubmitting: false, validationMessage: err.message || 'Unable to restore booking.' }));
      toast.error(err.message || 'Unable to restore booking.');
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentAmount || Number(paymentAmount) <= 0) return toast.error('Enter a valid amount');
    
    // 🛡️ LEDGER HARD CAP (REQ-ADM-05)
    if (Number(paymentAmount) > balance) {
      return toast.error(`Excess payment detected. Maximum allowed: ₱${balance.toLocaleString()}`, {
        icon: '!',
        style: { border: '2px solid #ef4444', background: '#15171A', color: '#fff' }
      });
    }

    setSubmittingPayment(true);
    const toastId = toast.loading('Recording manual payment...');
    try {
      const { data: { user: actor } } = await supabase.auth.getUser();
      
      const { data: pData, error: pError } = await supabase.from('payments').insert({
        booking_id: id,
        amount: Number(paymentAmount),
        method: 'Cash',
        payment_type: 'Manual',
        status: 'PAID',
        verified_by: actor?.id,
        verified_at: new Date().toISOString(),
        notes: 'PAYMENT_CASH | Manual entry by Admin'
      }).select().single();

      if (pError) throw pError;

      // Notify Customer
      await notifyUser(booking.customer_id, 'Payment Received', `We have recorded your manual payment of ₱${Number(paymentAmount).toLocaleString()}.`, 'PAYMENT_RECEIVED', `/my-bookings/${id}`);

      // AUDIT LOG
      await supabase.from('audit_logs').insert({
        booking_id: id,
        action_type: 'PAYMENT_RECORDED',
        actor_name: actor?.email || 'Admin',
        actor_role: 'ADMIN',
        details: `Manually recorded Cash payment of ₱${Number(paymentAmount).toLocaleString()}.`
      });

      await confirmBookingWhenReady();
      toast.success('Payment Recorded & Audit Verified', { id: toastId });
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

  const handleAddService = async (vehicleId, service, paymentAmountOverride, paymentType = 'Downpayment', paymentMethod = 'Cash', referenceNumber = '', allowOvernight = false) => {
    setIsUpdatingDuration(true);
    const toastId = toast.loading('Validating schedule integrity...');
    try {
      const v = vehicles.find(item => item.id === vehicleId);
      if (!v) throw new Error('The selected vehicle is no longer available. Refresh and try again.');

      // A catalog service can be attached to a vehicle only once. This check
      // protects the action even if the UI is stale or the modal is opened in
      // another browser session.
      const { data: existingService, error: existingServiceError } = await supabase
        .from('booking_vehicle_services')
        .select('id')
        .eq('booking_vehicle_id', vehicleId)
        .ilike('service_name', service.name)
        .maybeSingle();
      if (existingServiceError) throw existingServiceError;
      if (existingService) throw new Error(`"${service.name}" is already assigned to this vehicle.`);

      const vehicleType = v.vehicle_type;
      const price = service.prices[vehicleType] || 0;
      const extraMinutes = service.durationMinutes || 60;

      // 1. BUSINESS HOURS GUARD: Validate against the live admin configuration.
      const newEndDatetime = new Date(new Date(booking.end_datetime).getTime() + extraMinutes * 60000);
      const { data: businessConfig } = await supabase
        .from('business_config')
        .select('opening_hour, closing_hour, slots_per_hour')
        .maybeSingle();
      const parseBusinessHour = (value, fallback) => {
        const parsed = Number(String(value ?? '').split(':')[0]);
        return Number.isFinite(parsed) ? parsed : fallback;
      };
      const openingHour = parseBusinessHour(businessConfig?.opening_hour, SHOP_CONFIG.OPENING_HOUR);
      const closingHour = parseBusinessHour(businessConfig?.closing_hour, SHOP_CONFIG.CLOSING_HOUR);
      const bookingStart = new Date(booking.start_datetime);
      const bookingEnd = new Date(booking.end_datetime);
      const closingBoundary = new Date(bookingEnd);
      closingBoundary.setHours(closingHour, 0, 0, 0);
      const openingBoundary = new Date(bookingStart);
      openingBoundary.setHours(openingHour, 0, 0, 0);
      const exceedsBusinessHours = bookingStart < openingBoundary || newEndDatetime > closingBoundary || newEndDatetime.getDate() !== bookingEnd.getDate();

      // tentative logic: allow a late service only after explicit admin confirmation and only when its bay is otherwise clear.
      if (exceedsBusinessHours && !allowOvernight) {
        const { data: overlappingForBay } = await supabase
          .from('bookings')
          .select('id, bay_id, start_datetime, end_datetime, status, vehicles:booking_vehicles(status)')
          .neq('id', id)
          .not('status', 'in', '("cancelled","CANCELLED")')
          .lte('start_datetime', newEndDatetime.toISOString())
          .gte('end_datetime', booking.start_datetime);
        const sameBayBookings = (overlappingForBay || []).filter(item => booking.bay_id ? item.bay_id === booking.bay_id : true);
        const hasOtherScheduledVehicle = sameBayBookings.some(item => (item.vehicles || []).some(vehicle => !['CANCELLED', 'COMPLETED'].includes(String(vehicle.status || '').toUpperCase())));
        if (hasOtherScheduledVehicle) {
          openModal({
            title: 'Cannot Add Service',
            message: 'Another vehicle is scheduled in this bay during this time. You cannot continue adding this service.',
            confirmText: 'Close',
            cancelText: 'Cancel',
            type: 'danger',
            onConfirm: () => {}
          });
          return;
        }

        const formatHour = hour => `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`;
        openModal({
          title: 'Service Extends Hours',
          message: `This service ends after business hours (${formatHour(openingHour)} - ${formatHour(closingHour)}). No other vehicle is scheduled in this bay. Continue?`,
          confirmText: 'Continue',
          cancelText: 'Cancel',
          type: 'warning',
          onConfirm: () => handleAddService(vehicleId, service, paymentAmountOverride, paymentType, paymentMethod, referenceNumber, true)
        });
        return;
      }

      // 2. OVERBOOKING GUARD: Check if extended end_datetime causes bay conflict
      // Fix: use .not() to catch both 'cancelled' and 'CANCELLED' case variants
      const maxBays = Number(businessConfig?.slots_per_hour || SHOP_CONFIG.MAX_BAYS);
      const { data: overlapping } = await supabase
        .from('bookings')
        .select('id, start_datetime, end_datetime, status, vehicles:booking_vehicles(id, status, vehicle_type)')
        .neq('id', id)
        .not('status', 'in', '("cancelled","CANCELLED")')
        .lte('start_datetime', newEndDatetime.toISOString())
        .gte('end_datetime', booking.start_datetime);

      const { data: blocks } = await supabase.from('blocked_slots').select('*').eq('block_date', booking.start_datetime.split('T')[0]);

      // Check each hour from current end until the new end time
      const startH = new Date(booking.end_datetime).getHours();
      const newEndH = newEndDatetime.getHours();
      const activeBookings = filterActiveBookings(overlapping || []);

      for (let h = startH; h <= newEndH; h++) {
        const occ = calculateOccupancy(h, booking.start_datetime.split('T')[0], activeBookings, blocks || [], { ...SHOP_CONFIG, MAX_BAYS: maxBays });
        if (occ >= maxBays) {
          throw new Error(`Cannot extend: All bays are fully occupied at ${h}:00. Another booking is using this slot. Please reschedule.`);
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

      const { data: { user: actor } } = await supabase.auth.getUser();

      if (paymentAmountOverride != null) {
        const servicePayment = Number(paymentAmountOverride);
        const minimumDownpayment = calculateRequiredDownpayment(price).amount;
        if (!Number.isFinite(servicePayment) || servicePayment < minimumDownpayment || servicePayment > price) {
          throw new Error(`Payment must be at least ${formatCurrency(minimumDownpayment)} and no more than this service's ${formatCurrency(price)} price.`);
        }

        const { error: paymentError } = await supabase.from('payments').insert({
          booking_id: id,
          amount: servicePayment,
          method: paymentMethod,
          payment_type: paymentType,
          reference_number: paymentMethod === 'Digital' ? referenceNumber.trim() : null,
          status: 'PAID',
          verified_by: actor?.id,
          verified_at: new Date().toISOString(),
          notes: `PAYMENT_${paymentMethod.toUpperCase()} | ADDED_SERVICE:${service.name} | TYPE:${paymentType}${paymentMethod === 'Digital' ? ` | REFERENCE:${referenceNumber.trim()}` : ''}`
        });
        if (paymentError) throw paymentError;

        await notifyUser(
          booking.customer_id,
          'Payment Received',
          `Admin recorded your ${paymentMethod.toLowerCase()} payment of ₱${servicePayment.toLocaleString()} for ${service.name}.${paymentMethod === 'Digital' ? ` Reference: ${referenceNumber.trim()}.` : ''}`,
          'PAYMENT_RECEIVED',
          `/my-bookings/${id}`
        );
      }

      // 4. Audit Log
      await supabase.from('audit_logs').insert({
        booking_id: id,
        action_type: 'SERVICE_ADDED',
        actor_name: actor?.email || 'Admin',
        actor_role: 'ADMIN',
        details: `Added ${service.name} to ${v.make} ${v.model}. Duration extended by ${extraMinutes}m.${paymentAmountOverride != null ? ` Recorded ${paymentMethod} payment of ₱${Number(paymentAmountOverride).toLocaleString()}${paymentMethod === 'Digital' ? ` (Reference: ${referenceNumber.trim()})` : ''}.` : ' No payment required under the downpayment threshold.'}`
      });

      toast.success(`Service Added: ${service.name}. Total updated.`, { id: toastId });
      fetchBookingDetails();
      fetchPayments(); // Refresh balance
      setServiceModal({ open: false, vehicleId: null });
      setPendingService(null);
      setServicePaymentAmount('');
      setServicePaymentMethod('Cash');
      setServiceReferenceNumber('');
    } catch (err) {
      logger.error('Added service payment failed:', err);
      toast.error(err.message || 'Validation failed', { id: toastId });
    } finally {
      setIsUpdatingDuration(false);
    }
  };

  const handleSelectService = (vehicleId, service) => {
    const vehicle = vehicles.find(item => item.id === vehicleId);
    const price = Number(service.prices[vehicle?.vehicle_type] || 0);
    if (!vehicle || price <= 0) return;

    const alreadyAssigned = vehicle.services?.some(existing =>
      (existing.service_name || existing.name || '').toLowerCase() === service.name.toLowerCase()
    );
    if (alreadyAssigned) return;

    if (!requiresDownpayment(price)) {
      handleAddService(vehicleId, service);
      return;
    }

    setPendingService({ vehicleId, service, price });
    setServicePaymentType('Downpayment');
    setServicePaymentAmount(String(calculateRequiredDownpayment(price).amount));
    setServicePaymentMethod('Cash');
    setServiceReferenceNumber('');
  };

  const submitServicePayment = () => {
    if (!pendingService) return;
    const amount = Number(servicePaymentAmount);
    const minimumDownpayment = calculateRequiredDownpayment(pendingService.price).amount;
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid payment amount.');
      return;
    }
    if (amount < minimumDownpayment) {
      toast.error(`Payment cannot be below the required downpayment of ${formatCurrency(minimumDownpayment)}.`);
      return;
    }
    if (amount > pendingService.price) {
      toast.error(`Payment cannot exceed this service's ${formatCurrency(pendingService.price)} price.`);
      return;
    }
    if (servicePaymentMethod === 'Digital' && !serviceReferenceNumber.trim()) {
      toast.error('Enter the digital transaction reference number.');
      return;
    }
    handleAddService(pendingService.vehicleId, pendingService.service, amount, servicePaymentType, servicePaymentMethod, serviceReferenceNumber);
  };

  const updateVehicleStatus = async (vehicleId, status) => {
    // 🛡️ LOCK GUARD: Prevent changes to finished bookings
    if (isLocked) {
      return toast.error('Booking is finalized. No further changes allowed.');
    }

    const v = vehicles.find(item => item.id === vehicleId);
    const toastId = toast.loading(`Updating ${v?.brand || 'unit'} status...`);
    
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
    try {
      const response = await fetch(`${BACKEND_URL}/api/bookings/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: id,
          unitId: vehicleId,
          newStatus: status,
          notes: v?.service_notes,
          actorName: 'Admin',
          actorRole: 'ADMIN'
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          toast.success(`Unit marked as ${status.toUpperCase()}`, { id: toastId });
          fetchBookingDetails();
          fetchAuditLogs();
          return;
        }
      }
    } catch (backendErr) {
      console.warn('Backend Propagator offline, using Frontend Fallback:', backendErr.message);
    }

    // 🔄 FRONTEND FALLBACK
    try {
      const { error: vError } = await supabase
        .from('booking_vehicles')
        .update({ 
          status: status.toUpperCase(),
          started_at: status.toUpperCase() === 'IN_PROGRESS' ? new Date().toISOString() : undefined,
          completed_at: status.toUpperCase() === 'COMPLETED' ? new Date().toISOString() : undefined
        })
        .eq('id', vehicleId);

      if (vError) throw vError;

      // 📧 FALLBACK NOTIFICATIONS
      if (status === 'IN_PROGRESS' || status === 'COMPLETED') {
        await sendStatusEmail(id, status.toLowerCase());
      }

      toast.success(`Unit marked as ${status.toUpperCase()} (Syncing...)`, { id: toastId });
      fetchBookingDetails();
      fetchAuditLogs();
    } catch (err) {
      console.error(err);
      toast.error('Vehicle update failed', { id: toastId });
    }
  };

  const requestVehicleStatus = (vehicle, status) => {
    openModal({
      title: status === 'COMPLETED' ? 'Finish Service?' : 'Start Service?',
      message: status === 'COMPLETED'
        ? `Confirm completion for ${vehicle.brand} ${vehicle.model}. This will notify the customer.`
        : `Start service for ${vehicle.brand} ${vehicle.model}?`,
      confirmText: status === 'COMPLETED' ? 'Finish Service' : 'Start Service',
      cancelText: 'Cancel',
      type: status === 'COMPLETED' ? 'success' : 'info',
      onConfirm: () => updateVehicleStatus(vehicle.id, status)
    });
  };

  const handleViewReceipt = async () => {
    const toastId = toast.loading('Verifying security clearance...');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      
      if (profile?.role !== 'ADMIN') {
        throw new Error('ACCESS DENIED: Administrator clearance required.');
      }
      
      toast.dismiss(toastId);
      setReceiptModal(true);
    } catch (err) {
      toast.error(err.message, { id: toastId });
    }
  };

  const handlePrintReceipt = () => {
    toast.success('System receipt printed for audit.');
    window.print();
  };

<<<<<<< HEAD
  const handleOpenReschedule = () => {
    const start = booking?.start_datetime ? new Date(booking.start_datetime) : new Date();
    setRescheduleDate(`${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`);
    setRescheduleTime('');
    setRescheduleReason('');
    setRescheduleSlots([]);
    setShowRescheduleModal(true);
  };

  useEffect(() => {
    if (!showRescheduleModal || !rescheduleDate || !booking?.id) return;
    let active = true;
    const durationMinutes = Math.max(60, Math.ceil((new Date(booking.end_datetime) - new Date(booking.start_datetime)) / 60000));
    setRescheduleSlotsLoading(true);
    getAvailableSlots(rescheduleDate, durationMinutes, vehicles, booking.id)
      .then((slots) => {
        if (!active) return;
        setRescheduleSlots(slots || []);
        if (rescheduleTime && !slots.some(slot => slot.time === rescheduleTime)) {
          setRescheduleTime('');
        }
      })
      .catch(() => {
        if (active) setRescheduleSlots([]);
      })
      .finally(() => {
        if (active) setRescheduleSlotsLoading(false);
      });
    return () => { active = false; };
  }, [showRescheduleModal, rescheduleDate, booking?.id, booking?.start_datetime, booking?.end_datetime, vehicles]);

  const confirmReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime || isRescheduling) return;
    if (!rescheduleReason.trim()) {
      toast.error('Please enter a reason for rescheduling.');
      return;
    }
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

      await rescheduleBooking(booking.id, start.toISOString(), end.toISOString(), rescheduleReason.trim());
      toast.success('Appointment rescheduled. Payment preserved and bay/staff allocation reset.', { id: toastId });
      setShowRescheduleModal(false);
      fetchBookingDetails();
      fetchAuditLogs();
      fetchPayments();
    } catch (err) {
      toast.error(err.message || 'Failed to reschedule appointment', { id: toastId });
    } finally {
      setIsRescheduling(false);
    }
=======
  const handleDownloadReceiptPdf = () => {
    const total = Number(selectedPayment?.amount || booking.total_amount || 0);
    const subtotal = total > 0 ? total / 1.12 : 0;
    const vat = total > 0 ? total - subtotal : 0;
    const items = selectedPayment
      ? [{ name: 'Service Installment / Settlement Payment', amount: Number(selectedPayment.amount || 0) }]
      : vehicles.flatMap((v) => (v.services || []).map((s) => ({ name: s.service_name || s.name || 'Service', amount: Number(s.price || s.price_snapshot || 0) })));

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
                <div>${booking.customer_name || booking.customer?.full_name || 'Customer'}</div>
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
            <div class="foot">Transaction Reference: ${selectedPayment?.reference_number || 'SYSTEM_VALIDATED'}</div>
          </div>
        </body>
      </html>
    `);
    popup.document.close();
    setTimeout(() => popup.print(), 300);
>>>>>>> e23099d5 (Logic inconsistencies still exists)
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val || 0);

  const canAccessReceipt = () => {
    // REQ-ADM-10: Admins can access receipts if payment is PAID OR if refund is PROCESSED
    return bookingPayments.some(p => p.status === 'PAID') || booking.refund_status === 'PROCESSED';
  };

  const getReceiptStatusText = () => {
    // REQ-ADM-10: Hardened check for refund state
    if (booking.refund_status === 'PROCESSED') return 'REFUNDED & CLOSED';
    
    const paidAmount = bookingPayments.filter(p => p.status === 'PAID').reduce((s, p) => s + Number(p.amount), 0);
    const remaining = Math.max(0, booking.total_amount - paidAmount);
    if (!canAccessReceipt()) return 'AWAITING VERIFICATION';
    if (remaining <= 0) return 'PAID IN FULL';
    if (paidAmount > 0) return 'PARTIAL PAYMENT';
    return 'BALANCE DUE';
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
    color: 'var(--admin-text-primary)'
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
  const balance = Math.max(0, (booking?.total_amount || 0) - totalPaid);
  
  // 🚀 DERIVED STATUS & LOCK LOGIC
  const vehicleStatuses = (vehicles || []).map(v => v.status?.toUpperCase());
  const anyUnitStarted = vehicleStatuses.includes('IN_PROGRESS');
  const allUnitsFinished = vehicleStatuses.length > 0 && vehicleStatuses.every(s => s === 'COMPLETED' || s === 'CANCELLED');
  const isFullySettled = (booking?.total_amount || 0) > 0 && balance === 0;

  let derivedStatus = (booking?.status || 'scheduled').toLowerCase();
  if (anyUnitStarted && derivedStatus === 'scheduled') derivedStatus = 'in_progress';
  if (allUnitsFinished && isFullySettled && !['cancelled', 'released'].includes(derivedStatus)) derivedStatus = 'completed';

  const isLocked = ['completed', 'released', 'cancelled', 'flagged_noshow'].includes(derivedStatus);
  const isNoShowBooking = ['FLAGGED_NOSHOW', 'NO_SHOW'].includes(String(booking?.status || '').toUpperCase());
  const scheduledDate = booking.start_datetime ? new Date(booking.start_datetime) : null;
  const todayDate = new Date();
  const isScheduledToday = scheduledDate
    && scheduledDate.getFullYear() === todayDate.getFullYear()
    && scheduledDate.getMonth() === todayDate.getMonth()
    && scheduledDate.getDate() === todayDate.getDate();
  const canStartService = derivedStatus === 'confirmed' && isScheduledToday && Boolean(booking.staff_id) && !isLocked;
  const canCompleteService = derivedStatus === 'in_progress' && isFullySettled && !isLocked;

  const requestReleaseBooking = () => {
    openModal({
      title: 'Mark Unit Collected?',
      message: 'Confirm that the customer has collected the vehicle. This will move the booking to Released and free the assigned technician.',
      confirmText: 'Yes, Unit Collected',
      cancelText: 'Keep Completed',
      type: 'success',
      onConfirm: async () => {
        const toastId = toast.loading('Releasing booking...');
        try {
          const response = await fetch(`${BACKEND_URL}/api/bookings/release`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId: id })
          });
          const result = await response.json();
          if (!response.ok || !result.success) throw new Error(result.error || 'Release failed.');
          toast.success('Booking marked as Released.', { id: toastId });
          fetchBookingDetails();
          fetchAuditLogs();
        } catch (err) {
          toast.error(err.message || 'Unable to release booking.', { id: toastId });
        }
      }
    });
  };
  const surplus = Math.max(0, totalPaid - (booking.total_amount || 0));
  return (
    <>
      <div style={{ 
      width: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '1.5rem', 
      padding: '0 0 10rem 0',
      position: 'relative'
    }}>
      
      {/* 1. HEADER & BREADCRUMBS */}
      <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
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
          
          <h1 style={{ margin: 0, fontSize: '2.8rem', fontWeight: '950', color: 'var(--admin-text-primary)', letterSpacing: '-2px', textTransform: 'uppercase', lineHeight: 1 }}>
            {booking.booking_id || `SW-BKG-${id.slice(0, 8).toUpperCase()}`}
          </h1>
          <p style={{ margin: '0.75rem 0 0 0', color: 'var(--admin-text-secondary)', fontWeight: '600', fontSize: '0.95rem', opacity: 0.8 }}>
            Detailed operational record for session initialized on {new Date(booking.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
          </p>
        </div>

        {!['completed', 'released', 'cancelled', 'flagged_noshow'].includes(derivedStatus) && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={handleOpenReschedule}
              style={{
                background: 'var(--admin-brand)',
                color: '#fff',
                border: 'none',
                padding: '0.75rem 1.25rem',
                borderRadius: 'var(--admin-radius-sm)',
                fontSize: '0.75rem',
                fontWeight: '950',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                boxShadow: '0 4px 14px rgba(230, 30, 42, 0.35)',
                transition: 'all 0.2s ease'
              }}
            >
              <Calendar size={15} /> RESCHEDULE BOOKING
            </button>
          </div>
        )}
      </div>

      <BookingSummaryHeader booking={booking} onUnitCollected={derivedStatus === 'completed' ? requestReleaseBooking : undefined} />

      {isNoShowBooking && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '1rem',
            width: '100%',
            background: 'rgba(127, 29, 29, 0.28)',
            border: '1px solid rgba(127, 29, 29, 0.5)',
            borderRadius: '0.75rem',
            padding: '1rem 1.25rem',
            marginBottom: '1rem',
            color: 'var(--admin-text-primary)',
            boxShadow: 'inset 0 0 0 1px rgba(248, 113, 113, 0.08)',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'flex-start' : 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
            <span aria-hidden="true" style={{ fontSize: '1.1rem', lineHeight: 1 }}>⚠️</span>
            <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '700', color: 'var(--admin-text-primary)', lineHeight: 1.5 }}>
              Booking Flagged as No-Show. Scheduled appointment time passed without confirmation.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: isMobile ? '100%' : 'auto' }}>
            <button
              onClick={handleUndoNoShow}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.6rem 0.9rem',
                borderRadius: '0.5rem',
                border: '1px solid rgba(248, 113, 113, 0.55)',
                background: 'rgba(239, 68, 68, 0.05)',
                color: '#fca5a5',
                fontSize: '0.68rem',
                fontWeight: '900',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                width: isMobile ? '100%' : 'auto',
                boxShadow: '0 8px 16px rgba(127, 29, 29, 0.12)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(248, 113, 113, 0.8)';
                e.currentTarget.style.color = '#fecaca';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(248, 113, 113, 0.55)';
                e.currentTarget.style.color = '#fca5a5';
              }}
            >
              <span aria-hidden="true">↺</span>
              Undo No-Show
            </button>

            <button
              onClick={() => toast.info('Use the separate reschedule workflow when the appointment time itself needs to change.')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.6rem 0.9rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--admin-border)',
                background: 'var(--admin-card)',
                color: 'var(--admin-text-primary)',
                fontSize: '0.68rem',
                fontWeight: '900',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                width: isMobile ? '100%' : 'auto',
                boxShadow: '0 8px 16px rgba(15, 23, 42, 0.08)'
              }}
            >
              <span aria-hidden="true">🗓️</span>
              Reschedule
            </button>
          </div>
        </div>
      )}

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isMobile ? '1fr' : '7.5fr 2.5fr', 
        gap: '0.75rem',
        alignItems: 'start'
      }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
          
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Banknote size={20} color="var(--admin-brand)" />
                <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '950', textTransform: 'uppercase', color: 'var(--admin-text-primary)', letterSpacing: '1px' }}>Financial Ledger</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button 
                  onClick={handleViewReceipt}
                  style={{ background: 'transparent', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', padding: '0.5rem 1rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '950', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px', transition: 'all 0.2s ease' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-bg)'; e.currentTarget.style.color = 'var(--admin-brand)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--admin-text-primary)'; }}
                >
                  <FileText size={14} /> VIEW INVOICE
                </button>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.6rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem', letterSpacing: '1px', opacity: 0.6 }}>Total Booking Value</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--admin-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                    {formatCurrency(booking.total_amount)}
                  </div>
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
                    <th style={{ padding: '1rem 0.75rem', textAlign: 'center', fontWeight: '950', color: 'var(--admin-text-primary)', textTransform: 'uppercase' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {bookingPayments.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                      <td style={{ padding: '1.25rem 0.75rem', verticalAlign: 'middle', textAlign: 'left' }}>
                        <div style={{ fontWeight: '800', color: 'var(--admin-text-primary)', fontSize: '0.85rem' }}>{new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      </td>
                      <td style={{ padding: '1.25rem 0.75rem', verticalAlign: 'middle', textAlign: 'left', fontSize: '0.75rem', color: 'var(--admin-text-secondary)', fontWeight: '800' }}>
                        {new Date(p.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '1.25rem 0.75rem', verticalAlign: 'middle', textAlign: 'left', fontWeight: '800', color: 'var(--admin-text-secondary)' }}>{p.method}</td>
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
                      <td style={{ padding: '1.25rem 0.75rem', verticalAlign: 'middle', textAlign: 'center' }}>
                        {p.status === 'PAID' && (
                          <button
                            onClick={() => { setSelectedPayment(p); setReceiptModal(true); }}
                            style={{ background: 'transparent', border: '1px solid var(--admin-brand)', color: 'var(--admin-brand)', cursor: 'pointer', padding: '0.6rem 0.75rem', borderRadius: 'var(--admin-radius-sm)', fontWeight: '900', fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
                            title="View payment receipt"
                          >
                            <FileText size={15} /> VIEW RECEIPT
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {bookingPayments.length === 0 && (
                    <tr><td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--admin-text-secondary)', fontWeight: '800' }}>NO TRANSACTIONS RECORDED</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 💰 DYNAMIC FINANCIAL LEDGER - REQ-ADM-05 */}
            <div style={{ 
              padding: '1rem', 
              background: isLocked ? 'rgba(255, 255, 255, 0.05)' : (surplus > 0 ? 'rgba(59, 130, 246, 0.05)' : (balance <= 0 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)')), 
              borderRadius: '4px', 
              textAlign: 'center', 
              border: `1px solid ${isLocked ? 'rgba(255, 255, 255, 0.2)' : (surplus > 0 ? 'rgba(59, 130, 246, 0.3)' : (balance <= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'))}`,
              color: isLocked ? '#a0a0a0' : (surplus > 0 ? '#3b82f6' : (balance <= 0 ? '#10b981' : '#ef4444')), 
              fontSize: '0.8rem', 
              fontWeight: '950',
              textTransform: 'uppercase', 
              letterSpacing: '0.8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              marginBottom: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {derivedStatus === 'cancelled' ? (
                  <><ShieldAlert size={16} /> BOOKING CANCELLED & VOIDED</>
                ) : derivedStatus === 'completed' ? (
                  <><ShieldCheck size={16} /> SERVICE FINISHED & CLOSED</>
                ) : surplus > 0 ? (
                  <><TrendingUp size={16} /> ACCOUNT OVERPAID • SURPLUS: {formatCurrency(surplus)}</>
                ) : (
                  balance <= 0 ? (
                    <><CheckCircle2 size={16} /> ACCOUNT SETTLED • FULLY PAID</>
                  ) : (
                    <><ShieldAlert size={16} /> ATTENTION: OUTSTANDING BALANCE {formatCurrency(balance)}</>
                  )
                )}
              </div>
              {balance <= 0 && !isLocked && (
                <button 
                  onClick={() => setShowManualInput(!showManualInput)}
                  style={{ background: 'transparent', border: 'none', color: 'inherit', fontSize: '0.6rem', fontWeight: '950', textDecoration: 'underline', cursor: 'pointer', opacity: 0.6, marginTop: '0.25rem' }}
                >
                  {showManualInput ? 'HIDE OVERRIDE' : 'ENABLE MANUAL ENTRY OVERRIDE'}
                </button>
              )}
            </div>

            {/* Re-activates if balance > 0 OR override is enabled */}
            {(balance > 0 || showManualInput) && !isLocked && (
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.75rem', animation: 'fadeIn 0.3s ease' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-brand)', fontWeight: '950' }}>₱</div>
                  <input 
                    type="number" 
                    className="no-spinner"
                    placeholder={balance > 0 ? "Record Top-up Payment..." : "Record Manual Override..."}
                    value={paymentAmount} 
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    style={{ width: '100%', padding: '0.85rem 0.85rem 0.85rem 2rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '0.5rem', color: 'var(--admin-text-primary)', fontWeight: '900', outline: 'none' }}
                  />
                </div>
                <button 
                  onClick={handleRecordPayment} 
                  disabled={submittingPayment}
                  style={{ padding: '0 1.5rem', background: 'var(--admin-brand)', color: 'white', borderRadius: '0.5rem', border: 'none', fontWeight: '950', fontSize: '0.7rem', cursor: 'pointer', opacity: submittingPayment ? 0.5 : 1 }}
                >
                  {submittingPayment ? 'SAVING...' : 'RECORD PAYMENT'}
                </button>
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '950', textTransform: 'uppercase', color: 'var(--admin-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Car size={16} color="var(--admin-brand)" /> Fleet Units ({vehicles.length})
              </h3>
              <div style={{ fontSize: '0.65rem', fontWeight: '900', color: 'var(--admin-text-secondary)', opacity: 0.6 }}>SUB-TOTAL: {formatCurrency(booking.total_amount)}</div>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '1rem' : 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '4px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--admin-border)' }}>
                          <Car size={20} color="var(--admin-brand)" />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: '950', fontSize: '1rem', overflowWrap: 'anywhere' }}>{v.brand} {v.model}</div>
                          <div style={{ fontSize: '0.7rem', fontWeight: '900', color: 'var(--admin-text-secondary)', overflowWrap: 'anywhere' }}>{v.plate_number} • {v.vehicle_type}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: isMobile ? 'left' : 'right', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '0.75rem', alignItems: isMobile ? 'stretch' : 'center', width: isMobile ? '100%' : 'auto', minWidth: 0 }}>
                        <div style={{ textAlign: isMobile ? 'left' : 'right', minWidth: 0 }}>
                          <div style={{ fontWeight: '950', color: 'var(--admin-brand)', fontSize: '1.1rem', marginBottom: '0.25rem' }}>{formatCurrency(v.subtotal)}</div>
                          <div style={{ display: 'flex', gap: '0.5rem', width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
                            <button 
                              onClick={() => setServiceModal({ open: true, vehicleId: v.id })}
                              disabled={isLocked}
                              style={{ 
                                background: 'transparent', border: '1px solid #444', 
                                padding: '0.4rem 0.6rem', borderRadius: '4px', color: 'var(--admin-text-secondary)', flex: isMobile ? '1 1 80px' : '0 0 auto', minWidth: 0,
                                cursor: 'pointer', fontSize: '0.6rem', fontWeight: '950', display: 'flex', alignItems: 'center', gap: '0.3rem'
                              }}
                            >
                              <Plus size={12} /> ADD
                            </button>
                            <button 
                              onClick={() => {
                                const currentStatus = v.status?.toUpperCase();
                                if (currentStatus === 'SCHEDULED' || !currentStatus) {
                                  requestVehicleStatus(v, 'IN_PROGRESS');
                                } else if (currentStatus === 'IN_PROGRESS') {
                                  requestVehicleStatus(v, 'COMPLETED');
                                }
                              }}
                              disabled={isLocked || v.status?.toUpperCase() === 'COMPLETED' || (v.status?.toUpperCase() === 'IN_PROGRESS' ? !canCompleteService : !canStartService)}
                              style={{ 
                                background: v.status?.toUpperCase() === 'COMPLETED' ? 'rgba(255, 255, 255, 0.05)' : (v.status?.toUpperCase() === 'IN_PROGRESS' ? (canCompleteService ? '#10b981' : 'var(--admin-border)') : (canStartService ? 'var(--admin-brand)' : 'var(--admin-border)')), 
                                border: v.status?.toUpperCase() === 'COMPLETED' ? '1px solid var(--admin-border)' : 'none',
                                padding: '0.45rem 1rem', borderRadius: '4px', color: (v.status?.toUpperCase() === 'COMPLETED' || (v.status?.toUpperCase() === 'IN_PROGRESS' ? !canCompleteService : !canStartService)) ? 'var(--admin-text-secondary)' : 'white', flex: isMobile ? '1 1 150px' : '0 0 auto', minWidth: 0,
                                cursor: (isLocked || v.status?.toUpperCase() === 'COMPLETED' || (v.status?.toUpperCase() === 'IN_PROGRESS' ? !canCompleteService : !canStartService)) ? 'not-allowed' : 'pointer', fontSize: '0.65rem', fontWeight: '950', display: 'flex', alignItems: 'center', gap: '0.4rem',
                                boxShadow: v.status?.toUpperCase() === 'COMPLETED' ? 'none' : '0 4px 10px rgba(0,0,0,0.3)', transition: 'all 0.2s ease',
                                opacity: isLocked ? 0.5 : 1
                              }}
                            >
                              {v.status?.toUpperCase() === 'COMPLETED' ? <><CheckCircle2 size={12} /> SERVICE FINISHED</> : <>{v.status?.toUpperCase() === 'IN_PROGRESS' ? <><CheckCircle2 size={12} /> FINISH SERVICE</> : <><Play size={12} /> START SERVICE</>}</>}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SERVICES LIST - REQ-ADM-03 */}
                    <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {(!v.services || v.services.length === 0) ? (
                        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', fontWeight: '700', fontStyle: 'italic' }}>No Services Assigned</div>
                      ) : [...(v.services || [])].sort((a, b) => (a.service_name || '').localeCompare(b.service_name || '')).map((s, idx) => (
                        <div key={`${v.id}-${s.service_name || idx}`} style={{ 
                          padding: '0.35rem 0.75rem', background: 'rgba(var(--admin-brand-rgb), 0.1)', 
                          border: '1px solid rgba(var(--admin-brand-rgb), 0.2)', borderRadius: '4px',
                          display: 'flex', alignItems: 'center', gap: '0.5rem'
                        }}>
                          <div style={{ width: '6px', height: '6px', background: 'var(--admin-brand)', borderRadius: '50%' }} />
                          <span style={{ fontSize: '0.7rem', fontWeight: '900', color: 'var(--admin-text-primary)', textTransform: 'uppercase' }}>{s.service_name}</span>
                          <span style={{ fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-brand)', marginLeft: '0.5rem', opacity: 0.8 }}>₱{s.price?.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    {/* REQ-ADM-15: TECHNICAL DOCUMENTATION (Photos & Notes) */}
                    <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ minWidth: isMobile ? '100%' : '180px', width: isMobile ? '100%' : '180px' }}>
                          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.55rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Technician</label>
                          <select
                            value={booking.staff_id || ''}
                            onChange={event => handleAssignStaff(event.target.value)}
                            disabled={isLocked || booking.status === 'in_progress'}
                            style={{ width: '100%', padding: '0.4rem', background: 'var(--admin-card)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '800' }}
                          >
                            <option value="">Unassigned</option>
                            {staffList.filter(staff => staff.isAvailable || staff.id === booking.staff_id).map(staff => <option key={staff.id} value={staff.id}>{staff.full_name || staff.name}</option>)}
                          </select>
                        </div>
                        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ fontSize: '0.6rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Started At</div>
                            <div style={{ fontSize: '0.75rem', fontWeight: '800', color: v.started_at ? 'var(--admin-text-primary)' : 'var(--admin-text-secondary)', opacity: v.started_at ? 1 : 0.5 }}>
                              {v.started_at ? new Date(v.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.6rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Finished At</div>
                            <div style={{ fontSize: '0.75rem', fontWeight: '800', color: v.completed_at ? '#10b981' : 'var(--admin-text-secondary)', opacity: v.completed_at ? 1 : 0.5 }}>
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
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>{booking.customer?.full_name || booking.customer_name || 'Customer'}</h3>
                {booking.customer && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.6rem', fontWeight: '900', color: 'var(--admin-brand)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fleet Account Holder</span>
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <div style={{ ...labelStyle, opacity: 0.6 }}>Registered Contact</div>
                <div style={(booking.customer?.phone_number || booking.contact_number || booking.customer_phone) ? valueStyle : naStyle}>
                  {booking.customer?.phone_number || booking.contact_number || booking.customer_phone || 'N/A'}
                </div>
              </div>
              <div>
                <div style={{ ...labelStyle, opacity: 0.6 }}>Primary Email ID</div>
                <div style={booking.customer?.email || booking.customer_email ? valueStyle : naStyle}>{booking.customer?.email || booking.customer_email || 'N/A'}</div>
              </div>
            </div>
          </div>

          {/* AI VISION AUDIT PANEL (REQ-SYS-01) */}
          {/* 🛡️ FINANCIAL CONFLICT RESOLUTION (REQ-SYS-01) */}
          {booking.ocr_metadata && Object.keys(booking.ocr_metadata).length > 0 && (
            <div style={{ 
              ...cardStyle, 
              border: booking.payment_status === 'Flagged for Review' ? '2px solid #ef4444' : (booking.ocr_metadata.isMatch ? '1px solid var(--admin-success)' : '1px solid var(--admin-border)'),
              boxShadow: booking.payment_status === 'Flagged for Review' ? '0 0 25px rgba(239, 68, 68, 0.2)' : 'none',
              transition: 'all 0.3s ease'
            }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <ShieldCheck size={18} color={booking.payment_status === 'Flagged for Review' ? '#ef4444' : 'var(--admin-brand)'} />
                  <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '950', textTransform: 'uppercase', color: 'var(--admin-text-primary)', letterSpacing: '1px' }}>Payment Verification Audit</h3>
                </div>
                <div style={{ fontSize: '0.55rem', fontWeight: '950', color: 'var(--admin-text-secondary)', opacity: 0.6 }}>AUTOMATED VERIFICATION</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <div style={labelStyle}>Audit Status</div>
                  <div style={{ 
                    fontSize: '0.85rem', fontWeight: '950', 
                    color: totalPaid === 0 ? '#ef4444' : (balance <= 0 ? '#10b981' : '#f59e0b'),
                    textTransform: 'uppercase', letterSpacing: '0.5px'
                  }}>
                    {totalPaid === 0 ? 'UNPAID' : (balance <= 0 ? 'FULLY SETTLED' : 'PARTIALLY PAID')}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <div style={labelStyle}>Verified Ledger</div>
                    <div style={{ ...valueStyle, color: totalPaid > 0 ? '#fff' : '#ef4444' }}>
                      {formatCurrency(totalPaid)}
                    </div>
                  </div>
                  <div>
                    <div style={labelStyle}>Required Total</div>
                    <div style={{ ...valueStyle, color: 'var(--admin-brand)' }}>
                      {formatCurrency(booking.total_amount)}
                    </div>
                  </div>
                </div>

                {/* Conflict Resolution Buttons */}
                {booking.payment_status === 'Flagged for Review' && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ShieldAlert size={14} color="#ef4444" />
                      <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#ef4444', textTransform: 'uppercase' }}>Financial Mismatch Detected</span>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        onClick={async () => {
                          const confirm = window.confirm('FORCE CONFIRM: Are you sure you want to override the AI mismatch and validate this payment?');
                          if (!confirm) return;
                          
                          const { data: { user } } = await supabase.auth.getUser();
                          const payment = bookingPayments.find(item => item.status === 'FOR_VERIFICATION');
                          if (!payment) return toast.error('No pending payment found for this booking.');
                          const overrideAmount = Number(payment.detected_amount || payment.amount || 0);
                          const { error } = await supabase.from('payments').update({
                            amount: overrideAmount,
                            status: 'PAID',
                            verified_by: user?.id,
                            verified_at: new Date().toISOString(),
                            notes: `${payment.notes || 'PAYMENT_DIGITAL'} | PAYMENT_DIGITAL_VERIFIED | AI_OVERRIDE | OCR_AMOUNT:${overrideAmount}`
                          }).eq('id', payment.id);
                          if (error) return toast.error('Override failed');
                          
                          await supabase.from('audit_logs').insert({
                            booking_id: id,
                            action_type: 'MANUAL_OVERRIDE_CONFIRM',
                            actor_name: user?.email,
                            actor_role: 'ADMIN',
                            details: `Admin manually confirmed flagged payment of ₱${overrideAmount}.`
                          });
                          
                          toast.success('Manual Override Successful: Payment Confirmed');
                          
                          // 📧 DISPATCH RECEIPT EMAIL (Since this is a manual confirmation of a payment)
                          // We'll try to find the relevant payment ID if available, 
                          // but for override it might be complex. 
                          // For now, let's trigger it if we have a payment in 'FOR_VERIFICATION' status
                          sendPaymentReceiptEmail(id, payment.id).catch(console.error);
                          await confirmBookingWhenReady();

                          fetchBookingDetails();
                        }}
                        style={{ flex: 1, padding: '0.75rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: '950', fontSize: '0.65rem', cursor: 'pointer' }}
                      >
                        FORCE CONFIRM
                      </button>
                      <button 
                        onClick={async () => {
                          const reason = window.prompt('Provide reason for rejection:');
                          if (!reason) return;
                          
                          const { data: { user } } = await supabase.auth.getUser();
                          const { error } = await supabase.from('bookings').update({ payment_status: 'Payment Rejected' }).eq('id', id);
                          if (error) return toast.error('Rejection failed');
                          
                          await supabase.from('audit_logs').insert({
                            booking_id: id,
                            action_type: 'MANUAL_OVERRIDE_REJECT',
                            actor_name: user?.email,
                            actor_role: 'ADMIN',
                            details: `Admin rejected payment. Reason: ${reason}`
                          });
                          
                          toast.error('Payment Rejected and Logged');
                          fetchBookingDetails();
                        }}
                        style={{ flex: 1, padding: '0.75rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: '950', fontSize: '0.65rem', cursor: 'pointer' }}
                      >
                        REJECT PAYMENT
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* D. DIGITAL VERIFICATION ARCHIVE - REQ-ADM-05 */}
          {bookingPayments.filter(p => p.receipt_url || p.evidence_url).length > 0 && (
            <div style={{ ...cardStyle, border: '1px solid var(--admin-border)', background: 'rgba(255, 255, 255, 0.01)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.8rem', fontWeight: '950', color: 'var(--admin-text-primary)', textTransform: 'uppercase' }}>Payment Evidence</h3>
                <ImageIcon size={18} color="var(--admin-brand)" />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {bookingPayments.filter(p => p.receipt_url || p.evidence_url).map((p, idx) => (
                  <div key={p.id} style={{ borderBottom: idx === bookingPayments.filter(p => p.receipt_url || p.evidence_url).length - 1 ? 'none' : '1px solid var(--admin-border)', paddingBottom: idx === bookingPayments.filter(p => p.receipt_url || p.evidence_url).length - 1 ? 0 : '1.5rem' }}>
                    <div 
                      onClick={() => window.open(p.receipt_url || p.evidence_url, '_blank')}
                      style={{ width: '100%', height: '180px', borderRadius: '0.75rem', background: 'black', border: '1px solid var(--admin-border)', overflow: 'hidden', cursor: 'zoom-in', marginBottom: '1rem' }}
                    >
                      <img src={p.receipt_url || p.evidence_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Receipt" />
                    </div>

                    {p.status === 'FOR_VERIFICATION' ? (
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button onClick={() => handleVerifyPayment(p)} style={{ flex: 1, padding: '0.85rem', background: '#10b981', color: 'white', borderRadius: '6px', border: 'none', fontWeight: '950', fontSize: '0.75rem', cursor: 'pointer' }}>APPROVE</button>
                        <button onClick={() => handleRejectPayment(p)} style={{ flex: 1, padding: '0.85rem', background: '#ef4444', color: 'white', borderRadius: '6px', border: 'none', fontWeight: '950', fontSize: '0.75rem', cursor: 'pointer' }}>REJECT</button>
                      </div>
                    ) : (
                      <div style={{ 
                        padding: '0.75rem', background: p.status === 'PAID' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)', 
                        border: `1px solid ${p.status === 'PAID' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                        borderRadius: '4px', textAlign: 'center', color: p.status === 'PAID' ? '#10b981' : '#ef4444', 
                        fontSize: '0.65rem', fontWeight: '950', textTransform: 'uppercase'
                      }}>
                        {p.status === 'PAID' ? '✓ Verified Receipt Archive' : '✗ Rejected Receipt Archive'}
                      </div>
                    )}
                    <div style={{ marginTop: '0.5rem', fontSize: '0.6rem', color: 'var(--admin-text-secondary)', fontWeight: '700', textAlign: 'center' }}>
                      PROCESSED ON {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* E. SUPPORT & LOGS */}
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

      {undoNoShowModal.open && ReactDOM.createPortal(
        (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '1rem' : '2rem' }}>
            <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: '1rem', width: '100%', maxWidth: '28rem', margin: '0 1rem', boxShadow: 'var(--modal-shadow)', overflow: 'hidden', borderTop: '4px solid var(--admin-brand)' }}>
              <div style={{ padding: isMobile ? '1rem 1rem 0.75rem' : '1.5rem 1.5rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldAlert size={18} color="var(--admin-brand)" />
                    <span style={{ fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--admin-text-secondary)', fontWeight: '900' }}>Undo No-Show</span>
                  </div>
                  <button onClick={() => setUndoNoShowModal({ open: false, validationMessage: '', isSubmitting: false })} style={{ background: 'transparent', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={18} />
                  </button>
                </div>

                <h3 style={{ margin: 0, fontSize: isMobile ? '1.25rem' : '1.5rem', lineHeight: 1.2, fontWeight: '950', letterSpacing: '-0.04em', color: 'var(--admin-text-primary)' }}>Reinstate this booking</h3>

                <div style={{ marginTop: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--admin-surface)', border: '1px solid var(--admin-border)', borderRadius: '999px', padding: '0.45rem 0.8rem', color: 'var(--admin-text-primary)', fontWeight: '800', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  <CalendarClock size={14} />
                  Original Schedule: {formatOriginalSchedule(booking?.start_datetime)}
                </div>

                <p style={{ margin: '1rem 0 0', color: 'var(--admin-text-secondary)', fontSize: isMobile ? '0.85rem' : '0.92rem', lineHeight: 1.6, fontWeight: '600' }}>
                  Reverting this booking will cancel any pending refund requests and restore the booking to active status under its original scheduled time. Use this action if the booking was flagged due to an administrative delay.
                </p>

                {undoNoShowModal.validationMessage && (
                  <div style={{ marginTop: '0.75rem', padding: '0.7rem 0.8rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.18)', color: '#ef4444', fontSize: '0.75rem', fontWeight: '800' }}>
                    {undoNoShowModal.validationMessage}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: isMobile ? '0.75rem 1rem 1rem' : '0.75rem 1.5rem 1.25rem', borderTop: '1px solid var(--admin-border)', background: 'var(--admin-sidebar)' }}>
                <button onClick={() => setUndoNoShowModal({ open: false, validationMessage: '', isSubmitting: false })} style={{ background: 'transparent', border: '1px solid var(--admin-border)', color: 'var(--admin-text-secondary)', borderRadius: '10px', padding: '0.8rem 1.1rem', fontSize: '0.8rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={confirmUndoNoShow} disabled={undoNoShowModal.isSubmitting} style={{ background: 'var(--admin-brand)', color: '#fff', border: 'none', borderRadius: '10px', padding: '0.8rem 1.2rem', fontSize: '0.8rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.08em', cursor: undoNoShowModal.isSubmitting ? 'wait' : 'pointer', opacity: undoNoShowModal.isSubmitting ? 0.7 : 1 }}>
                  {undoNoShowModal.isSubmitting ? 'Restoring...' : 'Confirm restore'}
                </button>
              </div>
            </div>
          </div>
        ), document.body
      )}

      {/* SERVICE MANAGEMENT MODAL */}
      {serviceModal.open && ReactDOM.createPortal(
        (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '0.75rem' : '2rem' }}>
          <div style={{ width: 'min(1100px, 100%)', maxHeight: '92vh', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'stretch', gap: '1rem', overflow: 'hidden', color: 'var(--admin-text-primary)' }}>
          <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: '8px', width: isMobile && pendingService ? '100%' : 'min(800px, 100%)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: isMobile ? '1rem' : '1.5rem', borderBottom: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '950', textTransform: 'uppercase' }}>Add Service Treatment</h3>
                <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--admin-text-secondary)', fontWeight: '700' }}>Extending duration will re-validate bay capacity.</p>
              </div>
              <button onClick={() => setServiceModal({ open: false, vehicleId: null })} style={{ background: 'transparent', border: 'none', color: 'var(--admin-text-primary)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '1rem' : '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {Object.keys(SERVICES_DATA).map(category => (
                <div key={category}>
                  <div style={{ fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-brand)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Zap size={12} /> {category}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '1rem' }}>
                    {SERVICES_DATA[category].map(s => {
                      const v = vehicles.find(item => item.id === serviceModal.vehicleId);
                      const price = s.prices[v?.vehicle_type] || 0;
                      const alreadyAssigned = v?.services?.some(existing => (existing.service_name || existing.name || '').toLowerCase() === s.name.toLowerCase());
                      if (price === 0) return null;
                      
                      return (
                        <button
                          key={s.id} 
                          type="button"
                          onClick={() => handleSelectService(serviceModal.vehicleId, s)}
                          disabled={alreadyAssigned || isUpdatingDuration}
                          title={alreadyAssigned ? 'Already assigned to this vehicle' : `Add ${s.name}`}
                          style={{ width: '100%', minHeight: '92px', textAlign: 'left', background: alreadyAssigned ? 'rgba(var(--admin-brand-rgb), 0.08)' : 'var(--admin-bg)', color: 'var(--admin-text-primary)', border: `1px solid ${alreadyAssigned ? 'var(--admin-brand)' : 'var(--admin-border)'}`, borderRadius: '4px', padding: '1rem', cursor: alreadyAssigned || isUpdatingDuration ? 'not-allowed' : 'pointer', opacity: alreadyAssigned ? 0.7 : 1, touchAction: 'manipulation' }}
                        >
                          <div style={{ fontWeight: '950', fontSize: '0.85rem', marginBottom: '0.25rem' }}>{s.name}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--admin-text-secondary)' }}>{s.estTime}</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: '950', color: 'var(--admin-brand)' }}>{alreadyAssigned ? 'ADDED' : isUpdatingDuration ? 'ADDING...' : `₱${price.toLocaleString()}`}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {pendingService && (
            <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-brand)', borderRadius: '8px', width: isMobile ? '100%' : '320px', minWidth: isMobile ? 0 : '280px', padding: isMobile ? '1rem' : '1.25rem', overflowY: 'auto' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--admin-brand)', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Payment Required</div>
              <h3 style={{ margin: '0 0 0.35rem', fontSize: '1rem', fontWeight: '950' }}>{pendingService.service.name}</h3>
              <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.75rem', marginBottom: '1.25rem' }}>Service price: {formatCurrency(pendingService.price)}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                {['Downpayment', 'Full'].map(type => (
                  <button key={type} type="button" onClick={() => { setServicePaymentType(type); setServicePaymentAmount(String(type === 'Full' ? pendingService.price : calculateRequiredDownpayment(pendingService.price).amount)); }} style={{ padding: '0.7rem 0.4rem', borderRadius: '4px', border: `1px solid ${servicePaymentType === type ? 'var(--admin-brand)' : 'var(--admin-border)'}`, background: servicePaymentType === type ? 'rgba(var(--admin-brand-rgb), 0.12)' : 'var(--admin-bg)', color: servicePaymentType === type ? 'var(--admin-brand)' : 'var(--admin-text-secondary)', fontWeight: '900', cursor: 'pointer' }}>{type}</button>
                ))}
              </div>
              <label style={{ display: 'block', color: 'var(--admin-text-secondary)', fontSize: '0.65rem', fontWeight: '900', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Amount Received</label>
              <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-brand)', fontWeight: '950' }}>₱</span>
                <input type="number" min={calculateRequiredDownpayment(pendingService.price).amount} max={pendingService.price} step="0.01" value={servicePaymentAmount} onChange={event => setServicePaymentAmount(event.target.value)} style={{ width: '100%', padding: '0.8rem 0.75rem 0.8rem 1.75rem', background: 'var(--admin-bg)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)', borderRadius: '4px', fontWeight: '900' }} />
              </div>
              <label style={{ display: 'block', color: 'var(--admin-text-secondary)', fontSize: '0.65rem', fontWeight: '900', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Customer Mode Of Payment</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {['Cash', 'Digital'].map(method => (
                  <button key={method} type="button" onClick={() => { setServicePaymentMethod(method); if (method === 'Cash') setServiceReferenceNumber(''); }} style={{ padding: '0.7rem 0.4rem', borderRadius: '4px', border: `1px solid ${servicePaymentMethod === method ? 'var(--admin-brand)' : 'var(--admin-border)'}`, background: servicePaymentMethod === method ? 'rgba(var(--admin-brand-rgb), 0.12)' : 'var(--admin-bg)', color: servicePaymentMethod === method ? 'var(--admin-brand)' : 'var(--admin-text-secondary)', fontWeight: '900', cursor: 'pointer' }}>{method}</button>
                ))}
              </div>
              {servicePaymentMethod === 'Digital' && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', color: 'var(--admin-text-secondary)', fontSize: '0.65rem', fontWeight: '900', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Digital Transaction Reference</label>
                  <input type="text" value={serviceReferenceNumber} onChange={event => setServiceReferenceNumber(event.target.value)} placeholder="Enter reference number" style={{ width: '100%', padding: '0.8rem 0.75rem', background: 'var(--admin-bg)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)', borderRadius: '4px', fontWeight: '900' }} />
                </div>
              )}
              <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.65rem', lineHeight: 1.4, marginBottom: '1rem' }}>The amount may exceed the calculated downpayment, but cannot exceed the service price.</div>
              <button type="button" onClick={submitServicePayment} disabled={isUpdatingDuration} style={{ width: '100%', padding: '0.85rem', background: 'var(--admin-brand)', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: '950', cursor: isUpdatingDuration ? 'wait' : 'pointer', opacity: isUpdatingDuration ? 0.6 : 1 }}>{isUpdatingDuration ? 'PROCESSING...' : 'CONFIRM PAYMENT & ADD SERVICE'}</button>
              <button type="button" onClick={() => { setPendingService(null); setServicePaymentAmount(''); setServicePaymentMethod('Cash'); setServiceReferenceNumber(''); }} disabled={isUpdatingDuration} style={{ width: '100%', marginTop: '0.5rem', padding: '0.7rem', background: 'transparent', color: 'var(--admin-text-secondary)', border: '1px solid var(--admin-border)', borderRadius: '4px', fontWeight: '900', cursor: 'pointer' }}>CANCEL</button>
            </div>
          )}
          </div>
        </div>
        ),
        document.body
      )}
<<<<<<< HEAD
      {/* 📅 ADMIN RESCHEDULE MODAL */}
      {showRescheduleModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, backdropFilter: 'blur(8px)', padding: '1rem'
        }}>
          <div style={{
            background: 'var(--admin-card)',
            padding: isMobile ? '1.5rem' : '2rem',
            borderRadius: 'var(--admin-radius)',
            border: '1px solid var(--admin-border)',
            maxWidth: '560px', width: '100%',
            position: 'relative', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
          }}>
            {/* Close button */}
            <button
              onClick={() => setShowRescheduleModal(false)}
              style={{
                position: 'absolute', top: '1.25rem', right: '1.25rem',
                background: 'rgba(255,255,255,0.06)', border: 'none',
                color: 'var(--admin-text-secondary)', cursor: 'pointer',
                borderRadius: '50%', width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '8px',
                background: 'rgba(var(--admin-brand-rgb), 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--admin-brand)'
              }}>
                <Calendar size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontWeight: '950', fontSize: '1.2rem', color: 'var(--admin-text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Reschedule Appointment
                </h3>
                <div style={{ fontSize: '0.72rem', color: 'var(--admin-text-secondary)', fontWeight: '700', marginTop: '0.15rem' }}>
                  Administrative schedule modification
                </div>
              </div>
            </div>

            {/* Current schedule banner */}
            <div style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid var(--admin-border)',
              borderRadius: 'var(--admin-radius-sm)', padding: '0.75rem 1rem', margin: '1rem 0 1.25rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '0.62rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Current Schedule</div>
                <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--admin-text-primary)', marginTop: '0.2rem' }}>
                  {booking?.start_datetime ? new Date(booking.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unscheduled'}
                  {booking?.start_datetime ? ` at ${new Date(booking.start_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.62rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Status</div>
                <div style={{ fontSize: '0.8rem', fontWeight: '900', color: 'var(--admin-brand)', textTransform: 'uppercase', marginTop: '0.2rem' }}>
                  {booking?.status}
                </div>
              </div>
            </div>

            {/* 1. Pick new date */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.4rem' }}>
                New Appointment Date *
              </label>
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={rescheduleDate}
                onChange={(e) => { setRescheduleDate(e.target.value); setRescheduleTime(''); }}
                style={{
                  width: '100%', padding: '0.85rem 1rem',
                  background: 'var(--admin-bg)', color: 'var(--admin-text-primary)',
                  border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)',
                  fontWeight: '800', fontSize: '0.9rem', outline: 'none'
                }}
              />
            </div>

            {/* 2. Pick new time slot */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.4rem' }}>
                Available Time Slots *
              </label>
              {rescheduleSlotsLoading ? (
                <div style={{ padding: '1.5rem', color: 'var(--admin-brand)', fontWeight: '900', textAlign: 'center', fontSize: '0.8rem' }}>
                  Checking real-time bay availability...
                </div>
              ) : !rescheduleDate ? (
                <div style={{ padding: '1rem', color: 'var(--admin-text-secondary)', textAlign: 'center', fontSize: '0.75rem', fontWeight: '700' }}>
                  Please select a date above to check available slots.
                </div>
              ) : rescheduleSlots.length === 0 ? (
                <div style={{ padding: '1rem', color: '#ef4444', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--admin-radius-sm)', fontSize: '0.78rem', fontWeight: '800', textAlign: 'center' }}>
                  No available bay capacity for this date. Please select another date.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                  {rescheduleSlots.map(slot => {
                    const isSelected = rescheduleTime === slot.time;
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        onClick={() => setRescheduleTime(slot.time)}
                        style={{
                          padding: '0.65rem 0.4rem',
                          background: isSelected ? 'var(--admin-brand)' : 'var(--admin-bg)',
                          color: isSelected ? '#fff' : 'var(--admin-text-primary)',
                          border: `1px solid ${isSelected ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
                          borderRadius: 'var(--admin-radius-sm)',
                          fontWeight: '900', cursor: 'pointer', fontSize: '0.75rem',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div>{slot.time}</div>
                        <small style={{ display: 'block', marginTop: '0.2rem', opacity: isSelected ? 0.9 : 0.6, fontSize: '0.62rem' }}>
                          {slot.availableBays} bay{slot.availableBays === 1 ? '' : 's'} open
                        </small>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Reason for reschedule (required) */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Reason for Reschedule *
                </label>
                <span style={{ fontSize: '0.62rem', color: 'var(--admin-brand)', fontWeight: '800' }}>REQUIRED FOR AUDIT</span>
              </div>
              <textarea
                rows={3}
                placeholder="e.g. Customer requested schedule shift via phone / Detailing bay scheduled maintenance..."
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                style={{
                  width: '100%', padding: '0.85rem 1rem',
                  background: 'var(--admin-bg)', color: 'var(--admin-text-primary)',
                  border: `1px solid ${!rescheduleReason.trim() && rescheduleTime ? 'rgba(var(--admin-brand-rgb), 0.5)' : 'var(--admin-border)'}`,
                  borderRadius: 'var(--admin-radius-sm)',
                  fontWeight: '600', fontSize: '0.85rem', outline: 'none', resize: 'vertical'
                }}
              />
              <div style={{ fontSize: '0.65rem', color: 'var(--admin-text-secondary)', marginTop: '0.3rem' }}>
                This reason will be recorded in the official audit trail and customer notifications.
              </div>
            </div>

            {/* Financial integrity note */}
            <div style={{
              background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: 'var(--admin-radius-sm)', padding: '0.75rem 1rem', marginBottom: '1.5rem',
              fontSize: '0.72rem', color: '#10b981', fontWeight: '700', lineHeight: 1.4
            }}>
              ✓ Existing payment records and balances are preserved. Assigned technician and bay allocations will reset to allow re-assignment for the new slot.
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setShowRescheduleModal(false)}
                disabled={isRescheduling}
                style={{
                  flex: 1, padding: '1rem', background: 'transparent',
                  border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)',
                  borderRadius: 'var(--admin-radius-sm)', fontWeight: '900', cursor: 'pointer',
                  fontSize: '0.78rem', textTransform: 'uppercase'
                }}
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={confirmReschedule}
                disabled={!rescheduleDate || !rescheduleTime || !rescheduleReason.trim() || isRescheduling}
                style={{
                  flex: 1.5, padding: '1rem',
                  background: (!rescheduleDate || !rescheduleTime || !rescheduleReason.trim() || isRescheduling) ? 'var(--admin-border)' : 'var(--admin-brand)',
                  color: (!rescheduleDate || !rescheduleTime || !rescheduleReason.trim() || isRescheduling) ? 'var(--admin-text-secondary)' : '#fff',
                  border: 'none', borderRadius: 'var(--admin-radius-sm)', fontWeight: '950',
                  cursor: (!rescheduleDate || !rescheduleTime || !rescheduleReason.trim() || isRescheduling) ? 'not-allowed' : 'pointer',
                  fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '1px',
                  boxShadow: (!rescheduleDate || !rescheduleTime || !rescheduleReason.trim() || isRescheduling) ? 'none' : '0 4px 15px rgba(230, 30, 42, 0.35)'
                }}
              >
                {isRescheduling ? 'Rescheduling...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
=======
      {receiptModal && (
        <OfficialReceipt
          title="OFFICIAL RECEIPT"
          receiptNumber={selectedPayment?.reference_number || `INV-${(booking.id || '').slice(0, 8).toUpperCase()}`}
          bookingReference={booking.id}
          issuedAt={selectedPayment?.created_at || booking.created_at}
          paymentMethod={selectedPayment?.method || 'Digital / Online Payment'}
          processedBy="System Admin"
          customerName={booking.customer_name || booking.customer?.full_name || 'Customer'}
          customerContact={booking.customer?.email || booking.customer_email || '-'}
          customerAddress={booking.customer_address || '-'}
          customerTaxId={booking.customer_tax_id || '-'}
          items={selectedPayment ? [{
            vehicle: 'Payment Record',
            service: 'Service Installment / Settlement Payment',
            qty: 1,
            unitPrice: Number(selectedPayment.amount || 0),
            lineTotal: Number(selectedPayment.amount || 0)
          }] : (vehicles.flatMap((v) => (v.services || []).map((s) => ({
            vehicle: `${v.brand || ''} ${v.model || ''}`.trim() || 'Vehicle Unit',
            service: s.service_name || s.name || 'Service',
            qty: 1,
            unitPrice: Number(s.price || s.price_snapshot || 0),
            lineTotal: Number(s.price || s.price_snapshot || 0)
          }))))}
          subtotal={Number((selectedPayment?.amount || booking.total_amount || 0) / 1.12)}
          discountAmount={0}
          vatRate={0.12}
          onClose={() => { setReceiptModal(false); setSelectedPayment(null); }}
          showCloseButton
        />
>>>>>>> e23099d5 (Logic inconsistencies still exists)
      )}

      {/* 🧾 ADMIN RECEIPT PREVIEW MODAL */}
      {receiptModal && (
        <OfficialReceipt
          booking={{ ...booking, payments: bookingPayments }}
          vehicles={vehicles}
          selectedPayment={selectedPayment}
          onClose={() => { setReceiptModal(false); setSelectedPayment(null); }}
        />
      )}

      <style>{`
        .no-spinner {
          appearance: textfield;
          -moz-appearance: textfield;
          -webkit-appearance: none;
        }

        .no-spinner::-webkit-outer-spin-button,
        .no-spinner::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        @media print {
          html, body, #root, .admin-theme, .admin-main-wrapper, main { 
            background: white !important; 
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            overflow: visible !important;
          }

          nav, aside, header, button, .no-print, [role="navigation"] {
            display: none !important;
          }

          #printable-receipt {
            display: block !important;
            visibility: visible !important;
            width: 100% !important;
            max-width: 800px !important;
            margin: 0 auto !important;
            padding: 10mm !important;
            background: white !important;
            position: relative !important;
            z-index: 9999 !important;
            box-sizing: border-box !important;
            height: auto !important;
            overflow: visible !important;
            max-height: none !important;
          }

          #printable-receipt * {
            visibility: visible !important;
            color: black !important;
          }

          .modal-overlay {
            position: absolute !important;
            inset: 0 !important;
            background: white !important;
            display: block !important;
          }
          
          .no-print-bg {
            box-shadow: none !important;
            border-radius: 0 !important;
          }

          @page { 
            size: auto;
            margin: 0mm; 
          }
          
          * { 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
          }
        }
      `}</style>
      </div>
      <FloatingBubbleChat />
    </>
  );
};

export default AdminBookingDetails;
