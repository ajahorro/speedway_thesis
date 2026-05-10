import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { CheckCircle, AlertCircle, Search, RotateCw, Filter, CreditCard, XCircle, ArrowRight, Car } from 'lucide-react';
import toast from 'react-hot-toast';
import { logger } from '../../utils/logger';
import PageHeader from '../../components/PageHeader';
import LoadingState from '../../components/LoadingState';
import { useMediaQuery } from '../../hooks/useMediaQuery';

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
    selectedItem: null
  });

  // MEMOIZED FETCH: Optimized with deep relationship embedding
  const fetchPayments = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      logger.admin('Auditing Payment Transactions...');
      
      // One-shot join: payments -> bookings -> profiles (via explicit FK)
      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .select(`*`)
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
          customer_name: 'Fleet Transaction'
        };
      });

      setState(prev => ({ ...prev, payments: processed, loading: false }));
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
                <span style={{ flexShrink: 0, fontSize: '0.55rem', padding: '0.25rem 0.6rem', borderRadius: 'var(--admin-radius-sm)', background: 'var(--admin-bg)', color: p.status === 'PAID' ? '#10b981' : '#f59e0b', fontWeight: '950', height: 'fit-content', border: '1px solid currentColor', textTransform: 'uppercase' }}>{p.status.replace('_', ' ')}</span>
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
                    <div style={{ width: '100%', height: '240px', background: 'var(--admin-bg)', borderRadius: 'var(--admin-radius-sm)', overflow: 'hidden', border: '1px solid var(--admin-border)' }}>
                      <img src={state.selectedItem.receipt_url} alt="Receipt" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 'auto', display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
                  {state.selectedItem.status === 'FOR_VERIFICATION' && (
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button onClick={() => handleRejectPayment(state.selectedItem)} style={{ flex: 1, padding: '0.85rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid #ef4444', borderRadius: 'var(--admin-radius-sm)', fontWeight: '950', cursor: 'pointer', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>REJECT</button>
                      <button onClick={() => handleVerifyPayment(state.selectedItem)} style={{ flex: 2, padding: '0.85rem', background: 'var(--admin-brand)', color: 'white', border: 'none', borderRadius: 'var(--admin-radius-sm)', fontWeight: '950', cursor: 'pointer', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>VERIFY PAID</button>
                    </div>
                  )}
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
              <button onClick={() => navigate(`/admin/bookings/${state.selectedItem.booking_id}`)} style={{ width: '100%', padding: '1rem', background: 'transparent', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', borderRadius: '0.75rem', fontWeight: '800', cursor: 'pointer' }}>VIEW BOOKING</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modalSlideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default AdminPayments;
