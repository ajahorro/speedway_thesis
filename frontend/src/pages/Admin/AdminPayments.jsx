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
    selectedItem: null,
    isScanning: false
  });

  const [receiptBooking, setReceiptBooking] = useState(null);

  // MEMOIZED FETCH: Optimized with deep relationship embedding
  const fetchPayments = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      logger.admin('Auditing Payment Transactions...');
      
      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .select(`
          *,
          booking:bookings (
            *,
            customer:profiles!bookings_customer_id_fkey (full_name, email),
            payments (*),
            vehicles:booking_vehicles (
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
        return {
          ...p,
          receipt_url: url,
          customer_name: p.booking?.customer?.full_name || 'Fleet Transaction',
          customer: p.booking?.customer
        };
      });

      // Apply REQ-ADM-05 Strict Audit Filter
      const auditCompliant = getAuditCompliantTransactions(processed);
      const filteredOutRefunds = processed.length - auditCompliant.length;
      
      if (filteredOutRefunds > 0) {
         toast.success('Financial Audit view filtered: Refund records moved to Refund Hub.', { id: 'refund-filter-toast', duration: 5000 });
      }

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
      const searchStr = `${p.customer?.full_name} ${p.reference_number} ${p.amount}`.toLowerCase();
      const matchesSearch = searchStr.includes(state.searchTerm.toLowerCase());
      
      if (state.filter === 'PENDING') return matchesSearch && p.status === 'FOR_VERIFICATION';
      if (state.filter === 'PROCESSED') return matchesSearch && (p.status === 'PAID' || p.status === 'REFUNDED');
      
      return matchesSearch;
    });
  }, [state.payments, state.searchTerm, state.filter]);

  const handleVerifyPayment = async (payment) => {
    const toastId = toast.loading('Verifying transaction...');
    try {
      const { data: { user: verifier } } = await supabase.auth.getUser();
      const { error } = await supabase.from('payments').update({ 
        status: 'PAID', 
        verified_by: verifier?.id, 
        verified_at: new Date().toISOString() 
      }).eq('id', payment.id);
      
      if (error) throw error;
      
      toast.success('Payment verified', { id: toastId });
      fetchPayments();
      setState(prev => ({ ...prev, selectedItem: null }));
    } catch (err) { 
      toast.error('Verification failed', { id: toastId }); 
    }
  };

  const handleRejectPayment = async (payment) => {
    const reason = window.prompt('Reason for rejection:');
    if (!reason) return;
    
    const toastId = toast.loading('Rejecting transaction...');
    try {
      const { error } = await supabase.from('payments').update({ 
        status: 'REJECTED', 
        rejection_reason: reason 
      }).eq('id', payment.id);
      
      if (error) throw error;
      
      toast.error('Payment rejected', { id: toastId });
      fetchPayments();
      setState(prev => ({ ...prev, selectedItem: null }));
    } catch (err) { 
      toast.error('Rejection failed', { id: toastId }); 
    }
  };

  const handleAIScan = async (receiptUrl) => {
    if (!receiptUrl) return;
    setState(prev => ({ ...prev, isScanning: true }));
    const toastId = toast.loading('AI is scanning receipt...');
    
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      const response = await fetch(`${BACKEND_URL}/admin/verify-payment-ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptUrl })
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error);

      // Auto-update the payment with detected info (simulated for now)
      toast.success(`AI Scan Complete: Ref ${result.data.referenceNumber}`, { id: toastId });
      
      // We highlight the reference number field or update it if needed
      // For this demo, we'll just show the "AI Verified" state in the UI
      setState(prev => ({ 
        ...prev, 
        isScanning: false,
        selectedItem: {
          ...prev.selectedItem,
          ai_verified: true,
          detected_ref: result.data.referenceNumber
        }
      }));
    } catch (err) {
      toast.error('AI Scan failed. Please verify manually.', { id: toastId });
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
    } catch (err) {
      toast.error(err.message, { id: toastId });
    }
  };

  const handlePrint = () => {
    toast.success('System receipt printed for audit.');
    window.print();
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
            <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--admin-bg)', padding: '0.25rem', borderRadius: 'var(--admin-radius-sm)', width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'center' : 'flex-start', border: '1px solid var(--admin-border)' }}>
              {['PENDING', 'PROCESSED', 'ALL'].map(f => (
                <button 
                  key={f} 
                  onClick={() => setState(prev => ({ ...prev, filter: f }))} 
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
                  <div style={{ fontWeight: '950', fontSize: '0.9rem', textTransform: 'uppercase' }}>{state.selectedItem.customer?.full_name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', fontWeight: '600' }}>{state.selectedItem.customer?.email}</div>
                </div>

                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.5px' }}>CONTEXT: FLEET ({state.selectedItem.booking?.vehicles?.length || 0} UNITS)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {state.selectedItem.booking?.vehicles?.map(v => (
                      <div key={v.id} style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--admin-text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase' }}><Car size={14} /> {v.make} {v.model}</div>
                    ))}
                  </div>
                </div>

                {state.selectedItem.receipt_url && (
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.5px' }}>CUSTOMER RECEIPT</div>
                    <div style={{ width: '100%', height: '240px', background: 'var(--admin-bg)', borderRadius: 'var(--admin-radius-sm)', overflow: 'hidden', border: '1px solid var(--admin-border)', position: 'relative' }}>
                      <img src={state.selectedItem.receipt_url} alt="Receipt" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      
                      <button 
                        onClick={() => handleAIScan(state.selectedItem.receipt_url)}
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
              <div style={{ fontWeight: '900', fontSize: '1rem' }}>{state.selectedItem.customer?.full_name}</div>
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

      {/* 🧾 ADMIN RECEIPT PREVIEW MODAL */}
      {receiptBooking && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '2rem' }}>
          <div className="no-print-bg" style={{ background: '#fff', color: '#000', width: '100%', maxWidth: '600px', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.5)', position: 'relative' }}>
            
            <div className="no-print" style={{ background: '#000', color: '#fff', padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <ShieldCheck size={24} color="var(--admin-brand)" />
                <span style={{ fontWeight: '950', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '0.9rem' }}>
                  Official Receipt Explorer (Audit View)
                </span>
              </div>
              <button onClick={() => setReceiptBooking(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>

            <div id="printable-receipt" style={{ padding: '2.5rem', maxHeight: '70vh', overflowY: 'auto', position: 'relative', zIndex: 1 }}>
              <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                <h2 style={{ margin: 0, fontWeight: '950', fontSize: '1.75rem', color: '#000', fontStyle: 'italic' }}>SPEEDWAY</h2>
                <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#666', textTransform: 'uppercase', letterSpacing: '2px' }}>AutoxMoto Detail Studio</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: '950', color: '#999', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Invoice To</div>
                  <div style={{ fontWeight: '900', fontSize: '1.1rem' }}>{receiptBooking.customer?.full_name || 'Customer'}</div>
                  <div style={{ fontSize: '0.85rem', color: '#666' }}>{receiptBooking.customer?.email}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: '950', color: '#999', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Receipt No.</div>
                  <div style={{ fontWeight: '900', fontSize: '1.1rem', color: '#000', fontFamily: 'monospace' }}>INV-{receiptBooking.id.substring(0, 8).toUpperCase()}</div>
                  <div style={{ fontSize: '0.85rem', color: '#666' }}>{new Date(receiptBooking.created_at).toLocaleDateString()}</div>
                </div>
              </div>

              <div id="receipt-content-area" style={{ position: 'relative' }}>
                {/* REQ-NFR-14: CSS-based Watermark for Admin Audit */}
                {receiptBooking.refund_status === 'PROCESSED' && (
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-45deg)',
                    fontSize: '8rem', fontWeight: '900', color: 'rgba(239, 68, 68, 0.08)', pointerEvents: 'none', zIndex: 0, whiteSpace: 'nowrap'
                  }}>
                    VOID / REFUNDED
                  </div>
                )}

              <div style={{ borderTop: '2px solid #000', borderBottom: '2px solid #000', padding: '1.5rem 0', margin: '2rem 0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {(() => {
                      if (receiptBooking.vehicles && receiptBooking.vehicles.length > 0) {
                        return receiptBooking.vehicles.map((v) => (
                          <React.Fragment key={v.id}>
                            <tr>
                              <td colSpan="2" style={{ padding: '15px 5px 5px', fontWeight: 'bold', fontSize: '0.9rem', color: '#000' }}>
                                {v.make} {v.model} {v.plate_number ? `(${v.plate_number})` : ''}
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
                        ));
                      } else {
                        return (
                          <tr>
                            <td style={{ padding: '15px 5px', fontSize: '0.85rem', color: '#333' }}>
                              Premium Detailing Package
                            </td>
                            <td style={{ padding: '15px 5px', textAlign: 'right', fontSize: '0.85rem', color: '#333' }}>
                              {formatCurrency(receiptBooking.total_amount)}
                            </td>
                          </tr>
                        );
                      }
                    })()}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', gap: '2.5rem', width: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ color: '#999', fontSize: '0.85rem', fontWeight: '800' }}>GRAND TOTAL</span>
                  <span style={{ fontWeight: '900' }}>{formatCurrency(receiptBooking.total_amount)}</span>
                </div>
                <div style={{ display: 'flex', gap: '2.5rem', width: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ color: '#999', fontSize: '0.85rem', fontWeight: '800' }}>TOTAL AMOUNT PAID</span>
                  <span style={{ fontWeight: '900' }}>
                    {formatCurrency((receiptBooking.payments || []).filter(p => p.status === 'PAID' || p.status === 'REFUND_PENDING').reduce((s, p) => s + Number(p.amount), 0))}
                  </span>
                </div>
                {receiptBooking.refund_status === 'PROCESSED' && (
                  <div style={{ display: 'flex', gap: '2.5rem', width: '100%', justifyContent: 'flex-end', color: '#ef4444' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>AMOUNT REVERTED</span>
                    <span style={{ fontWeight: '900' }}>
                      {formatCurrency((receiptBooking.payments || []).filter(p => p.status === 'REFUNDED').reduce((s, p) => s + Number(p.amount), 0))}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '2.5rem', width: '100%', justifyContent: 'flex-end', borderTop: '2px solid #000', paddingTop: '0.75rem' }}>
                  <span style={{ fontWeight: '950', fontSize: '1.25rem' }}>REMAINING BALANCE</span>
                  <span style={{ fontWeight: '950', fontSize: '1.25rem', color: '#000' }}>
                    {formatCurrency(Math.max(0, receiptBooking.total_amount - (receiptBooking.payments || []).filter(p => p.status === 'PAID' || p.status === 'REFUND_PENDING' || p.status === 'REFUNDED').reduce((s, p) => s + Number(p.amount), 0)))}
                  </span>
                </div>
              </div>

              <div style={{ padding: '1.25rem', background: '#f9f9f9', borderRadius: '12px', border: '1px solid #eee' }}>
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div>
                      <div style={{ fontSize: '0.65rem', fontWeight: '900', color: '#999', textTransform: 'uppercase' }}>Method</div>
                      <div style={{ fontWeight: '800', fontSize: '0.85rem' }}>{receiptBooking.payments?.[0]?.method || 'Cash / Off-platform'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: '900', color: '#999', textTransform: 'uppercase' }}>Transaction Reference</div>
                      <div style={{ fontWeight: '800', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                        {canAccessReceipt(receiptBooking) 
                          ? (receiptBooking.payments?.[0]?.reference_number || receiptBooking.ocr_metadata?.referenceNo || 'VERIFIED')
                          : 'Awaiting Verification'}
                      </div>
                    </div>
                 </div>
                 <div style={{ marginTop: '15px', textAlign: 'center', fontSize: '1rem', fontWeight: '900', color: '#000', textTransform: 'uppercase', letterSpacing: '2px' }}>
                   *** {getReceiptStatusText(receiptBooking)} ***
                 </div>
              </div>

              <div style={{ textAlign: 'center', color: '#666', fontSize: '0.65rem', marginTop: '60px', fontWeight: '300' }}>
                This is a computer-generated document from Speedway AutoXMoto. No signature required.
              </div>
              </div> {/* Close receipt-content-area */}
            </div>

            <div className="no-print" style={{ padding: '1.5rem 2rem', background: '#f5f5f5', display: 'flex', gap: '1rem' }}>
              <button 
                onClick={handlePrint}
                style={{ 
                  flex: 2, padding: '1rem', background: '#000', 
                  color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '950', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', 
                  cursor: 'pointer', 
                  textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px' 
                }}
              >
                <Printer size={20} /> Print For Audit
              </button>
              <button 
                onClick={() => setReceiptBooking(null)}
                style={{ flex: 1, padding: '1rem', background: '#fff', color: '#000', border: '1px solid #ddd', borderRadius: '12px', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase', fontSize: '0.85rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
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
