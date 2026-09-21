import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { 
  CheckCircle, AlertCircle, Search, RotateCw, Filter, 
  CreditCard, XCircle, ArrowRight, Car, Sparkles, Loader2,
  FileText, ShieldCheck, Printer, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { logger } from '../../utils/logger';
import PageHeader from '../../components/PageHeader';
import LoadingState from '../../components/LoadingState';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { getAuditCompliantTransactions } from '../../utils/bookingHelpers';
import { sendPaymentReceiptEmail } from '../../services/notificationService';
import { calculateRequiredDownpayment } from '../../utils/paymentUtils';
import OfficialReceipt from '../../components/OfficialReceipt';

const AdminPayments = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 1024px)');

  // BATCHED STATE
  const [state, setState] = useState({
    payments: [],
    loading: true,
    searchTerm: location.state?.filter || '',
    filter: 'PENDING',
    methodFilter: 'ALL',
    selectedItem: null,
    isScanning: false,
    overrideAI: false
  });

  const [receiptBooking, setReceiptBooking] = useState(null);
  const [receiptPayment, setReceiptPayment] = useState(null);

  // MEMOIZED FETCH: Optimized with deep relationship embedding
  const fetchPayments = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      logger.admin('Auditing Payment Transactions...');
      
      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .select(`
          *,
          booking:bookings!payments_booking_id_fkey (
            *,
            customer:profiles!bookings_customer_id_fkey (full_name, email),
            payments:payments!payments_booking_id_fkey (*),
            vehicles:booking_vehicles!booking_vehicles_booking_id_fkey (
              *,
              services:booking_vehicle_services (*)
            )
          )
        `)
        .neq('method', 'Cash')
        .order('created_at', { ascending: false });

      if (paymentError) throw paymentError;

      const processed = (paymentData || []).map(p => {
        let url = p.receipt_url;
        if (url && !url.startsWith('http')) {
          const { data: { publicUrl } } = supabase.storage.from('payment-receipts').getPublicUrl(url);
          url = publicUrl;
        }
        const customerName = p.booking?.customer?.full_name || p.booking?.customer_name || 'Fleet Transaction';
        return {
          ...p,
          receipt_url: url,
          customer_name: customerName,
          customer: p.booking?.customer
            ? { ...p.booking.customer, full_name: customerName }
            : { full_name: customerName }
        };
      });

      // Apply REQ-ADM-05 Strict Audit Filter
      const auditCompliant = getAuditCompliantTransactions(processed);

      setState(prev => ({ ...prev, payments: auditCompliant, loading: false }));
      logger.admin('Payment Audit complete.');
    } catch (err) {
      logger.error('Payment Audit Error', err);
      toast.error('Failed to load transactions');
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    fetchPayments();
    
    const channel = supabase.channel('admin-payments-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetchPayments())
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [fetchPayments]);

  // MEMOIZED FILTERING
  const filteredItems = useMemo(() => {
    return state.payments.filter(p => {
      const searchStr = `${p.customer_name} ${p.reference_number} ${p.amount}`.toLowerCase();
      const matchesSearch = searchStr.includes(state.searchTerm.toLowerCase());
      const normalizedMethod = String(p.method || '').trim().toLowerCase();
      const isCashMethod = normalizedMethod === 'cash';
      const isDigitalMethod = ['gcash', 'digital', 'bank transfer', 'paymaya', 'maya', 'card', 'online'].includes(normalizedMethod);

      if (state.filter === 'PENDING') return matchesSearch && p.status === 'FOR_VERIFICATION';
      if (state.filter === 'PROCESSED') {
        const isProcessed = ['PAID', 'REFUND_PENDING', 'REFUNDED'].includes(p.status);
        const matchesMethodFilter = state.methodFilter === 'ALL'
          ? true
          : state.methodFilter === 'Cash'
            ? isCashMethod
            : isDigitalMethod;
        return matchesSearch && isProcessed && matchesMethodFilter;
      }
      
      return matchesSearch;
    });
  }, [state.payments, state.searchTerm, state.filter, state.methodFilter]);

  const confirmBookingWhenReady = async (bookingId) => {
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('status, staff_id, total_amount')
      .eq('id', bookingId)
      .single();
    if (bookingError) throw bookingError;
    if (!['scheduled', 'pending'].includes(String(booking.status).toLowerCase()) || !booking.staff_id) return;

    const { data: paidPayments, error: paymentError } = await supabase
      .from('payments')
      .select('amount')
      .eq('booking_id', bookingId)
      .eq('status', 'PAID');
    if (paymentError) throw paymentError;
    const paidAmount = (paidPayments || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    if (paidAmount < calculateRequiredDownpayment(Number(booking.total_amount || 0)).amount) return;

    const { error: updateError } = await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', bookingId);
    if (updateError) throw updateError;
  };

  const handleVerifyPayment = async (payment) => {
    const toastId = toast.loading('Verifying transaction...');
    try {
      const { data: { user: verifier } } = await supabase.auth.getUser();
      const bookingTotal = Number(payment.booking?.total_amount || 0);
      const declaredAmount = Number(payment.amount || 0);
      const ocrAmount = Number(payment.detected_amount || 0);
      const ocrReference = payment.detected_ref || '';
      const paymentType = payment.notes?.match(/(?:TYPE|PAYMENT_TYPE):([^|]+)/i)?.[1]?.toLowerCase();
      const isDownpayment = paymentType === 'downpayment' || (!paymentType && declaredAmount < bookingTotal);
      const requiredDownpayment = calculateRequiredDownpayment(bookingTotal).amount;
      const verifiedAmount = ocrAmount > 0 ? ocrAmount : declaredAmount;
      const wasOverpaidDownpayment = isDownpayment && verifiedAmount > requiredDownpayment;
      const isCashPayment = String(payment.method || '').trim().toUpperCase() === 'CASH';
      const hasValidOCRAmount = Number.isFinite(ocrAmount) && ocrAmount > 0;
      if (!isCashPayment && !hasValidOCRAmount && !state.overrideAI) {
        toast.error('This digital payment has no valid OCR amount. Re-scan the receipt or enable Override AI for manual review.', { id: toastId });
        return;
      }
      const isUnderpaidDownpayment = ocrAmount > 0 && isDownpayment && verifiedAmount < requiredDownpayment;
      if (isUnderpaidDownpayment && !state.overrideAI) {
        toast.error(`OCR amount is below the required ₱${requiredDownpayment.toLocaleString()} downpayment. Check Override AI to continue.`, { id: toastId });
        return;
      }
      const verificationNote = [
        payment.notes || 'PAYMENT_DIGITAL',
        `OCR_AMOUNT:${verifiedAmount}`,
        `VERIFIED_TYPE:${isDownpayment ? 'Downpayment' : 'Full'}`,
        wasOverpaidDownpayment ? 'OVERPAID_DOWNPAYMENT:TRUE' : null,
        state.overrideAI
          ? `[AI_OVERRIDE] Admin ID: ${verifier?.id || 'UNKNOWN'} | Required: ₱${requiredDownpayment} | Detected: ₱${ocrAmount || 'NULL'}`
          : null
      ].filter(Boolean).join('|');

      const { error } = await supabase.from('payments').update({ 
        amount: verifiedAmount,
        status: 'PAID', 
        verified_by: verifier?.id, 
        verified_at: new Date().toISOString(),
        notes: verificationNote,
        ...(ocrReference ? { reference_number: ocrReference } : {})
      }).eq('id', payment.id);
      
      if (error) throw error;
      
      // 📧 DISPATCH RECEIPT EMAIL (REQ-FIN-01)
      if (!isCashPayment) {
        sendPaymentReceiptEmail(payment.booking_id, payment.id).catch(err => {
          console.warn('Payment receipt email failed:', err.message);
        });
      }
      await confirmBookingWhenReady(payment.booking_id);
      
      const previousPaid = (payment.booking?.payments || [])
        .filter(existing => existing.id !== payment.id && existing.status === 'PAID')
        .reduce((sum, existing) => sum + Number(existing.amount || 0), 0);
      const remainingBalance = Math.max(0, bookingTotal - previousPaid - verifiedAmount);
      toast.success(
        wasOverpaidDownpayment
          ? `Payment verified. Remaining balance: ₱${remainingBalance.toLocaleString()}`
          : 'Payment verified',
        { id: toastId }
      );
      fetchPayments();
      setState(prev => ({ ...prev, selectedItem: null, overrideAI: false }));
    } catch (err) { 
      toast.error('Verification failed', { id: toastId }); 
    }
  };

  const handleRejectPayment = async (payment) => {
    const reason = window.prompt('Reason for rejection:');
    if (!reason) return;
    
    const toastId = toast.loading('Rejecting transaction...');
    try {
      const bookingTotal = Number(payment.booking?.total_amount || 0);
      const submittedAmount = Number(payment.detected_amount || payment.amount || 0);
      const paymentType = payment.notes?.match(/(?:TYPE|PAYMENT_TYPE):([^|]+)/i)?.[1]?.toLowerCase();
      const isDownpayment = paymentType === 'downpayment' || (!paymentType && submittedAmount < bookingTotal);
      const requiredDownpayment = calculateRequiredDownpayment(bookingTotal).amount;
      const isUnderpaidDownpayment = isDownpayment && submittedAmount < requiredDownpayment;
      const rejectionStatus = submittedAmount > 0 ? 'REFUND_PENDING' : 'REJECTED';
      const rejectionNote = `${payment.notes || 'PAYMENT_DIGITAL'}|REJECTED_AMOUNT:${submittedAmount}|REJECTION_REASON:${reason}`;

      const { error } = await supabase.from('payments').update({ 
        status: rejectionStatus,
        rejection_reason: reason,
        notes: rejectionNote
      }).eq('id', payment.id);
      
      if (error) throw error;

      if (submittedAmount > 0) {
        const { error: refundQueueError } = await supabase.from('bookings').update({
          refund_status: 'QUEUED',
          refund_notes: isUnderpaidDownpayment
            ? `Rejected underpayment: ₱${submittedAmount.toLocaleString()} received; ₱${requiredDownpayment.toLocaleString()} required.`
            : `Rejected digital payment: ${reason}`
        }).eq('id', payment.booking_id);
        if (refundQueueError) throw refundQueueError;
      }
      
      toast.error(
        submittedAmount > 0 ? 'Payment rejected and refund queued' : 'Payment rejected',
        { id: toastId }
      );
      fetchPayments();
      setState(prev => ({ ...prev, selectedItem: null }));
    } catch (err) { 
      toast.error('Rejection failed', { id: toastId }); 
    }
  };

  const handleAIScan = async (receiptUrl, payment) => {
    if (!receiptUrl) return;
    setState(prev => ({ ...prev, isScanning: true }));
    const toastId = toast.loading('AI is scanning receipt...');
    
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      const receiptResponse = await fetch(receiptUrl);
      if (!receiptResponse.ok) throw new Error('Receipt image could not be downloaded');
      const receiptBlob = await receiptResponse.blob();
      const formData = new FormData();
      const paymentType = payment?.notes?.match(/(?:TYPE|PAYMENT_TYPE):([^|]+)/i)?.[1]?.toLowerCase();
      const bookingTotal = Number(payment?.booking?.total_amount || 0);
      const requiredAmount = paymentType === 'downpayment'
        ? calculateRequiredDownpayment(bookingTotal).amount
        : bookingTotal;
      formData.append('receipt', receiptBlob, `receipt-${payment?.id || 'payment'}.jpg`);
      formData.append('bookingId', payment?.booking_id || 'PENDING');
      formData.append('paymentId', payment?.id || '');
      formData.append('requiredAmount', String(requiredAmount));

      const response = await fetch(`${BACKEND_URL}/api/ocr/verify-receipt`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `OCR request failed (${response.status})`);
      if (!result.success) throw new Error(result.error);

      // Auto-update the payment with detected info (simulated for now)
      const referenceNumber = result.data.referenceNo || result.data.referenceNumber || 'N/A';
      toast.success(`AI Scan Complete: Ref ${referenceNumber}`, { id: toastId });
      
      // We highlight the reference number field or update it if needed
      // For this demo, we'll just show the "AI Verified" state in the UI
      setState(prev => ({ 
        ...prev, 
        isScanning: false,
        selectedItem: {
          ...prev.selectedItem,
          ai_verified: true,
          detected_ref: referenceNumber,
          detected_amount: result.data.amount
        }
      }));
    } catch (err) {
      toast.error(err.message || 'AI Scan failed. Please verify manually.', { id: toastId });
      setState(prev => ({ ...prev, isScanning: false }));
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val || 0);

  const getStatusBadgeColor = (status) => {
    if (status === 'PAID') return '#10b981';
    if (status === 'REFUND_PENDING' || status === 'REFUNDED') return '#f59e0b';
    if (status === 'REJECTED') return '#ef4444';
    return '#3b82f6'; // Blue for FOR_VERIFICATION / Pending
  };

  const canAccessReceipt = (booking) => {
    // REQ-ADM-10: Admins can access receipts if payment is PAID OR if refund is PROCESSED
    return (booking?.payments || []).some(p => p.status === 'PAID') || booking?.refund_status === 'PROCESSED';
  };

  const getReceiptStatusText = (receipt) => {
    if (!receipt) return '';
    
    // REQ-ADM-10: Hardened check for refund state
    if (receipt.refund_status === 'PROCESSED') return 'REFUNDED & CLOSED';
    
    const paidAmount = (receipt.payments || []).filter(p => p.status === 'PAID').reduce((s, p) => s + Number(p.amount), 0);
    const remaining = Math.max(0, receipt.total_amount - paidAmount);
    if (!canAccessReceipt(receipt)) return 'AWAITING VERIFICATION';
    if (remaining <= 0) return 'PAID IN FULL';
    if (paidAmount > 0) return 'PARTIAL PAYMENT';
    return 'BALANCE DUE';
  };

  const handleViewReceipt = async (payment) => {
    const toastId = toast.loading('Verifying security clearance...');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      
      if (profile?.role !== 'ADMIN') {
        throw new Error('ACCESS DENIED: Administrator clearance required.');
      }
      
      toast.dismiss(toastId);
      setReceiptBooking(payment.booking);
      setReceiptPayment(payment);
    } catch (err) {
      toast.error(err.message, { id: toastId });
    }
  };

  const handlePrint = () => {
    toast.success('System receipt printed for audit.');
    window.print();
  };

  const handleDownloadPdf = () => {
    const total = Number(receiptBooking?.total_amount || 0);
    const subtotal = total > 0 ? total / 1.12 : 0;
    const vat = total > 0 ? total - subtotal : 0;
    const items = (receiptBooking.vehicles && receiptBooking.vehicles.length > 0
      ? receiptBooking.vehicles.flatMap(v => (v.services || []).map(s => ({ name: s.service_name || s.service_name_snapshot || 'Service', amount: Number(s.price || s.price_snapshot || 0) })))
      : [{ name: 'Booking Service Summary', amount: Number(receiptBooking.total_amount || 0) }]);

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
                <div>${receiptBooking.customer?.full_name || receiptBooking.customer_name || 'Customer'}</div>
              </div>
              <div style="text-align:right;">
                <div class="label">Date & Time</div>
                <div>${new Date(receiptBooking.created_at).toLocaleString()}</div>
              </div>
            </div>
            <div class="label" style="margin-bottom: 8px;">Service Summary</div>
            ${items.map(item => `<div class="item"><span>• ${item.name}</span><strong>${formatCurrency(item.amount)}</strong></div>`).join('')}
            <div class="total-row"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>
            <div class="total-row"><span>VAT (12%)</span><span>${formatCurrency(vat)}</span></div>
            <div class="total-row balance"><span>Grand Total</span><span>${formatCurrency(total)}</span></div>
            <div class="foot">Transaction Reference: ${receiptBooking.payments?.[0]?.reference_number || receiptBooking.ocr_metadata?.referenceNo || 'SYSTEM_VALIDATED'}</div>
          </div>
        </body>
      </html>
    `);
    popup.document.close();
    setTimeout(() => popup.print(), 300);
  };

  const cardStyle = { 
    background: 'var(--admin-card)', 
    border: '1px solid var(--admin-border)', 
    borderRadius: 'var(--admin-radius)', 
    overflow: 'hidden', 
    boxShadow: 'var(--admin-card-shadow)', 
    color: 'var(--admin-text-primary)' 
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>
      <PageHeader 
        badge="FINANCIAL AUDIT" 
        title="PAYMENT TRANSACTIONS" 
        subtitle="Verify and manage customer payment records for fleet sessions." 
        onRefresh={fetchPayments} 
      />

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr', gap: isMobile ? '1rem' : '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{
            background: 'var(--admin-card)',
            borderRadius: 'var(--admin-radius)',
            border: '1px solid var(--admin-border)',
            padding: '1rem',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: isMobile ? '100%' : '200px', position: 'relative' }}>
              <Search size={18} color="var(--admin-text-secondary)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', zIndex: 1 }} />
              <input 
                type="text" 
                placeholder="SEARCH REFERENCE..." 
                value={state.searchTerm} 
                onChange={(e) => setState(prev => ({ ...prev, searchTerm: e.target.value }))} 
                style={{ flex: 1, background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', padding: '0.85rem 1rem 0.85rem 2.75rem', color: 'var(--admin-text-primary)', outline: 'none', fontWeight: '950', fontSize: '0.75rem', width: '100%' }} 
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: isMobile ? '100%' : 'auto' }}>
              <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--admin-bg)', padding: '0.25rem', borderRadius: 'var(--admin-radius-sm)', width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'center' : 'flex-start', border: '1px solid var(--admin-border)' }}>
                {['PENDING', 'PROCESSED', 'ALL'].map(f => (
                  <button 
                    key={f} 
                    onClick={() => setState(prev => ({ ...prev, filter: f, methodFilter: f === 'PROCESSED' ? prev.methodFilter : 'ALL' }))} 
                    style={{ 
                      flex: isMobile ? 1 : 'none', 
                      padding: '0.5rem 1rem', 
                      borderRadius: 'calc(var(--admin-radius-sm) - 2px)', 
                      border: 'none', 
                      background: state.filter === f ? 'var(--admin-brand)' : 'transparent', 
                      color: state.filter === f ? 'white' : 'var(--admin-text-secondary)', 
                      fontSize: '0.65rem', 
                      fontWeight: '950', 
                      cursor: 'pointer',
                      textTransform: 'uppercase'
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
              {state.filter === 'PROCESSED' && (
                <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--admin-bg)', padding: '0.25rem', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border)', flexWrap: 'wrap' }}>
                  {['ALL', 'Digital', 'Cash'].map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setState(prev => ({ ...prev, methodFilter: method }))}
                      style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: 'calc(var(--admin-radius-sm) - 2px)',
                        border: 'none',
                        background: state.methodFilter === method ? 'var(--admin-brand)' : 'transparent',
                        color: state.methodFilter === method ? 'white' : 'var(--admin-text-secondary)',
                        fontSize: '0.6rem',
                        fontWeight: '950',
                        cursor: 'pointer',
                        textTransform: 'uppercase'
                      }}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {state.loading ? (
            <LoadingState message="Auditing financial trail..." />
          ) : filteredItems.length === 0 ? (
            <div style={{ ...cardStyle, padding: '4rem', textAlign: 'center', opacity: 0.5, textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: '900' }}>No transactions found</div>
          ) : filteredItems.map(p => (
            <div 
              key={p.id} 
              onClick={() => setState(prev => ({ ...prev, selectedItem: p }))} 
              style={{ 
                ...cardStyle, 
                padding: isMobile ? '1rem' : '1.25rem', 
                cursor: 'pointer', 
                border: state.selectedItem?.id === p.id ? '2px solid var(--admin-brand)' : '1px solid var(--admin-border)',
                background: state.selectedItem?.id === p.id ? 'rgba(169, 27, 24, 0.03)' : 'var(--admin-card)',
                transition: '0.2s'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.6rem', color: 'var(--admin-text-secondary)', fontWeight: '950', letterSpacing: '0.5px' }}>#{p.id.slice(0, 8).toUpperCase()}</div>
                  <h3 style={{ margin: 0, fontWeight: '950', fontSize: isMobile ? '0.9rem' : '1rem', textTransform: 'uppercase' }}>{p.customer_name}</h3>
                </div>
                <span style={{ flexShrink: 0, fontSize: '0.55rem', padding: '0.25rem 0.6rem', borderRadius: 'var(--admin-radius-sm)', background: 'var(--admin-bg)', color: getStatusBadgeColor(p.status), fontWeight: '950', height: 'fit-content', border: '1px solid currentColor', textTransform: 'uppercase' }}>{p.status.replace('_', ' ')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid var(--admin-border)', paddingTop: '0.75rem' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.55rem', color: 'var(--admin-text-secondary)', fontWeight: '950', letterSpacing: '0.5px' }}>METHOD / REF</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' }}>{p.method} • {p.reference_number || 'N/A'}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.55rem', color: 'var(--admin-text-secondary)', fontWeight: '950', letterSpacing: '0.5px' }}>AMOUNT</div>
                  <div style={{ fontSize: isMobile ? '1rem' : '1.25rem', fontWeight: '950', color: 'var(--admin-text-primary)', fontFamily: 'monospace' }}>₱{p.amount?.toLocaleString()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {!isMobile && (
          <div style={{ position: 'sticky', top: '1.5rem', height: 'fit-content' }}>
            {state.selectedItem ? (
              <div style={{ ...cardStyle, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontWeight: '950', fontSize: '0.75rem', color: 'var(--admin-brand)', letterSpacing: '1.5px' }}>AUDIT DETAILS</h3>
                  <button onClick={() => setState(prev => ({ ...prev, selectedItem: null }))} style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}><XCircle size={20} /></button>
                </div>

                <div style={{ background: 'var(--admin-bg)', padding: '1rem', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border)' }}>
                  <div style={{ fontWeight: '950', fontSize: '0.9rem', textTransform: 'uppercase' }}>{state.selectedItem.customer_name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', fontWeight: '600' }}>{state.selectedItem.customer?.email}</div>
                </div>

                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.5px' }}>CONTEXT: FLEET ({state.selectedItem.booking?.vehicles?.length || 0} UNITS)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {state.selectedItem.booking?.vehicles?.map(v => (
                      <div key={v.id} style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--admin-text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase' }}><Car size={14} /> {v.brand} {v.model}</div>
                    ))}
                  </div>
                </div>

                {state.selectedItem.receipt_url && (
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.5px' }}>CUSTOMER RECEIPT</div>
                    <div style={{ width: '100%', height: '240px', background: 'var(--admin-bg)', borderRadius: 'var(--admin-radius-sm)', overflow: 'hidden', border: '1px solid var(--admin-border)', position: 'relative' }}>
                      <img src={state.selectedItem.receipt_url} alt="Receipt" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      
                      <button 
                        onClick={() => handleAIScan(state.selectedItem.receipt_url, state.selectedItem)}
                        disabled={state.isScanning}
                        style={{
                          position: 'absolute', bottom: '1rem', right: '1rem',
                          background: 'var(--admin-brand)', color: 'white', border: 'none',
                          padding: '0.6rem 1rem', borderRadius: '8px', fontWeight: '950',
                          fontSize: '0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
                          boxShadow: '0 4px 15px rgba(0,0,0,0.5)', transition: 'all 0.2s',
                          opacity: state.isScanning ? 0.7 : 1
                        }}
                      >
                        {state.isScanning ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        {state.isScanning ? 'SCANNING...' : 'AI SCAN RECEIPT'}
                      </button>
                    </div>

                    {state.selectedItem.ai_verified && (
                      <div style={{ 
                        marginTop: '1rem', padding: '0.85rem', background: 'rgba(16, 185, 129, 0.1)', 
                        border: '1px solid #10b981', borderRadius: '12px', display: 'flex', 
                        alignItems: 'center', gap: '0.75rem' 
                      }}>
                        <CheckCircle size={18} color="#10b981" />
                        <div>
                          <div style={{ fontSize: '0.6rem', fontWeight: '950', color: '#10b981', textTransform: 'uppercase' }}>AI Verification Success</div>
                          <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'white' }}>MATCHED REF: {state.selectedItem.detected_ref}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: 'auto', display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
                  {state.selectedItem.status === 'FOR_VERIFICATION' && (
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <label style={{ position: 'absolute', marginTop: '-2rem', right: 0, fontSize: '0.62rem', color: '#f59e0b', fontWeight: '800' }}><input type="checkbox" checked={state.overrideAI} onChange={(e) => setState(prev => ({ ...prev, overrideAI: e.target.checked }))} /> Override AI</label>
                      <button onClick={() => handleRejectPayment(state.selectedItem)} style={{ flex: 1, padding: '0.85rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid #ef4444', borderRadius: 'var(--admin-radius-sm)', fontWeight: '950', cursor: 'pointer', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>REJECT</button>
                      <button onClick={() => handleVerifyPayment(state.selectedItem)} style={{ flex: 2, padding: '0.85rem', background: 'var(--admin-brand)', color: 'white', border: 'none', borderRadius: 'var(--admin-radius-sm)', fontWeight: '950', cursor: 'pointer', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>VERIFY PAID</button>
                    </div>
                  )}
                  <button onClick={() => handleViewReceipt(state.selectedItem)} style={{ width: '100%', padding: '0.85rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', borderRadius: 'var(--admin-radius-sm)', fontWeight: '950', cursor: 'pointer', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <FileText size={16} /> VIEW SYSTEM RECEIPT
                  </button>
                  <button onClick={() => navigate(`/admin/bookings/${state.selectedItem.booking_id}`)} style={{ width: '100%', padding: '0.85rem', background: 'transparent', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', borderRadius: 'var(--admin-radius-sm)', fontWeight: '950', cursor: 'pointer', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>VIEW BOOKING</button>
                </div>
              </div>
            ) : (
              <div style={{ ...cardStyle, padding: '6rem 2rem', textAlign: 'center', borderStyle: 'dashed', border: '2px dashed var(--admin-border)', background: 'transparent' }}>
                <CreditCard size={40} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                <p style={{ fontWeight: '950', color: 'var(--admin-text-secondary)', fontSize: '0.7rem', letterSpacing: '1.5px' }}>SELECT TRANSACTION</p>
              </div>
            )}
          </div>
        )}
      </div>

      {isMobile && state.selectedItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ ...cardStyle, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: '950', fontSize: '1rem', color: 'var(--admin-brand)' }}>AUDIT DETAILS</h3>
              <button onClick={() => setState(prev => ({ ...prev, selectedItem: null }))} style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}><XCircle size={24} /></button>
            </div>

            <div style={{ background: 'var(--admin-bg)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--admin-border)' }}>
              <div style={{ fontWeight: '900', fontSize: '1rem' }}>{state.selectedItem.customer_name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)', fontWeight: '600' }}>{state.selectedItem.customer?.email}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Context: Fleet ({state.selectedItem.booking?.vehicles?.length || 0} Units)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {state.selectedItem.booking?.vehicles?.map(v => (
                  <div key={v.id} style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--admin-text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Car size={14} /> {v.make} {v.model}</div>
                ))}
              </div>
            </div>

            {state.selectedItem.receipt_url && (
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Customer Receipt</div>
                <div style={{ width: '100%', height: '250px', background: 'var(--admin-bg)', borderRadius: '1rem', overflow: 'hidden', border: '1px solid var(--admin-border)' }}>
                  <img src={state.selectedItem.receipt_url} alt="Receipt" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              </div>
            )}

            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
              {state.selectedItem.status === 'FOR_VERIFICATION' && (
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={() => handleRejectPayment(state.selectedItem)} style={{ flex: 1, padding: '1rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', borderRadius: '0.75rem', fontWeight: '800', cursor: 'pointer' }}>REJECT</button>
                  <label style={{ position: 'absolute', right: '1.5rem', marginTop: '-2.25rem', fontSize: '0.62rem', color: '#f59e0b', fontWeight: '800' }}><input type="checkbox" checked={state.overrideAI} onChange={(e) => setState(prev => ({ ...prev, overrideAI: e.target.checked }))} /> Override AI</label>
                  <button onClick={() => handleVerifyPayment(state.selectedItem)} style={{ flex: 2, padding: '1rem', background: 'var(--admin-brand)', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: '900', cursor: 'pointer' }}>VERIFY PAID</button>
                </div>
              )}
              <button onClick={() => handleViewReceipt(state.selectedItem)} style={{ width: '100%', padding: '1rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', borderRadius: '0.75rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <FileText size={18} /> VIEW SYSTEM RECEIPT
              </button>
              <button onClick={() => navigate(`/admin/bookings/${state.selectedItem.booking_id}`)} style={{ width: '100%', padding: '1rem', background: 'transparent', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', borderRadius: '0.75rem', fontWeight: '800', cursor: 'pointer' }}>VIEW BOOKING</button>
            </div>
          </div>
        </div>
      )}

      {receiptBooking && (
        <OfficialReceipt
<<<<<<< HEAD
          booking={receiptBooking}
          vehicles={receiptBooking.vehicles || []}
          selectedPayment={receiptPayment}
          onClose={() => { setReceiptBooking(null); setReceiptPayment(null); }}
=======
          title="OFFICIAL RECEIPT"
          receiptNumber={receiptBooking.payments?.[0]?.reference_number || receiptBooking.ocr_metadata?.referenceNo || `INV-${(receiptBooking.id || '').slice(0, 8).toUpperCase()}`}
          bookingReference={receiptBooking.id}
          issuedAt={receiptBooking.created_at}
          paymentMethod={receiptBooking.payments?.[0]?.method || 'Digital / Online Payment'}
          processedBy="System Admin"
          customerName={receiptBooking.customer?.full_name || receiptBooking.customer_name || 'Customer'}
          customerContact={receiptBooking.customer?.email || 'N/A'}
          customerAddress={receiptBooking.customer_address || '-'}
          customerTaxId={receiptBooking.customer_tax_id || '-'}
          items={(receiptBooking.vehicles && receiptBooking.vehicles.length > 0
            ? receiptBooking.vehicles.flatMap(v => (v.services || []).map(s => ({
                vehicle: `${v.brand || ''} ${v.model || ''}`.trim() || 'Vehicle Unit',
                service: s.service_name || s.service_name_snapshot || 'Service',
                qty: 1,
                unitPrice: Number(s.price || s.price_snapshot || 0),
                lineTotal: Number(s.price || s.price_snapshot || 0)
              })))
            : [{
                vehicle: 'Booking Summary',
                service: 'Booking Service Summary',
                qty: 1,
                unitPrice: Number(receiptBooking.total_amount || 0),
                lineTotal: Number(receiptBooking.total_amount || 0)
              }])}
          subtotal={Number((receiptBooking.total_amount || 0) / 1.12)}
          discountAmount={0}
          vatRate={0.12}
          onClose={() => setReceiptBooking(null)}
          showCloseButton
>>>>>>> e23099d5 (Logic inconsistencies still exists)
        />
      )}

      <style>{`
        @keyframes modalSlideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
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
  );
};

export default AdminPayments;
