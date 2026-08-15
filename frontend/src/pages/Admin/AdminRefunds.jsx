import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  AlertTriangle, CreditCard, ArrowRight, Clock,
  CheckCircle, XCircle, Search, Filter, MessageCircle,
  Car, Calendar, User, Eye, Download, Box, ExternalLink, ShieldCheck
} from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import LoadingState from '../../components/LoadingState';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import toast from 'react-hot-toast';
import { logger } from '../../utils/logger';

const AdminRefunds = () => {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 1024px)');

  // BATCHED STATE
  const [state, setState] = useState({
    refundItems: [],
    loading: true,
    searchQuery: '',
    filter: 'PENDING',
    selectedItem: null,
    confirmRefundItem: null,
    refundReason: '',
    refundAmount: 0
  });

  const fetchRefundData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      logger.admin('Fetching live refund-eligible records...');
      
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:profiles!bookings_customer_id_fkey(full_name, email, phone_number),
          vehicles:booking_vehicles!booking_vehicles_booking_id_fkey(*),
          payments:payments!payments_booking_id_fkey(*)
        `)
        .in('status', ['cancelled', 'FLAGGED_NOSHOW'])
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const processed = (data || []).map(b => {
        const totalPaid = (b.payments || [])
          .filter(p => p.status === 'PAID' || p.status === 'REFUND_PENDING' || p.status === 'REFUNDED')
          .reduce((sum, p) => sum + Number(p.amount), 0);
        
        return {
          ...b,
          totalPaid,
          refundStatus: b.refund_status || 'PENDING' 
        };
      }).filter(b => b.totalPaid > 0);

      setState(prev => ({ ...prev, refundItems: processed, loading: false }));
      logger.admin('Refund directory synchronized.');
    } catch (err) {
      logger.error('Refund Fetch Error', err);
      toast.error('Failed to load refund requests.');
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    fetchRefundData();
  }, [fetchRefundData]);

  // MEMOIZED FILTERING
  const filteredItems = useMemo(() => {
    return state.refundItems.filter(b => {
      const matchesSearch = 
        b.customer?.full_name?.toLowerCase().includes(state.searchQuery.toLowerCase()) || 
        b.id.toLowerCase().includes(state.searchQuery.toLowerCase());
      
      if (state.filter === 'PENDING') return matchesSearch && b.refundStatus === 'PENDING';
      if (state.filter === 'PROCESSED') return matchesSearch && b.refundStatus === 'PROCESSED';
      
      return matchesSearch;
    });
  }, [state.refundItems, state.searchQuery, state.filter]);

  const handleProcessRefund = async (item) => {
    const toastId = toast.loading('Synchronizing financial reversal...');
    
    // OPTIMISTIC UI: Update local state immediately
    const previousRefundItems = [...state.refundItems];
    const updatedItems = state.refundItems.map(b => 
      b.id === item.id ? { ...b, refundStatus: 'PROCESSED' } : b
    );
    setState(prev => ({ ...prev, refundItems: updatedItems, selectedItem: { ...prev.selectedItem, refundStatus: 'PROCESSED' } }));

    try {
      const refundRef = `RFD-${Date.now().toString().slice(-6)}-${item.id.substring(0,4).toUpperCase()}`;

      // 1. Update Booking Status (REQ-NFR-20)
      const { error: bError } = await supabase
        .from('bookings')
        .update({ 
          refund_status: 'PROCESSED',
          refund_notes: state.refundReason,
          status: 'cancelled' 
        })
        .eq('id', item.id);

      if (bError) throw new Error(`Booking update failed: ${bError.message}`);

      // 2. CRITICAL: Update Original Payments to PAID to resolve 'REFUND_PENDING' ghosting
      // We must ensure this executes successfully to clear the "Refund Pending" badge in customer UI
      const { data: pUpdateData, error: pUpdateError } = await supabase
        .from('payments')
        .update({ 
          status: 'PAID',
          notes: `REFUND_PROCESSED_ON_${new Date().toLocaleDateString()}` 
        })
        .eq('booking_id', item.id)
        .eq('status', 'REFUND_PENDING');

      if (pUpdateError) throw new Error(`Payment status update failed: ${pUpdateError.message}`);

      // 3. Insert Negative Line Item for Partial/Full Refund (REQ-ADM-10)
      const { error: pInsertError } = await supabase
        .from('payments')
        .insert({
          booking_id: item.id,
          amount: -Math.abs(state.refundAmount),
          status: 'REFUNDED', 
          method: 'SYSTEM_REFUND',
          reference_number: refundRef,
          refund_reason: state.refundReason,
          notes: `REFUND_PROCESSED: ${state.refundReason}`, 
          refunded_at: new Date().toISOString()
        });

      if (pInsertError) throw new Error(`Refund ledger insertion failed: ${pInsertError.message}`);


      // 4. MASTER AUDIT LOG (REQ-NFR-15)
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert({
        booking_id: item.id,
        action_type: 'ADMIN_PROCESSED_REFUND',
        details: `Administrator processed refund of ₱${state.refundAmount.toLocaleString()}. Ref: ${refundRef}. Reason: ${state.refundReason}`,
        actor_name: 'Administrator',
        actor_role: 'ADMIN',
        actor_id: user?.id,
        metadata: { amount: state.refundAmount, reason: state.refundReason, refund_reference_id: refundRef }
      });

      // 5. System Chat Injection (REQ-NFR-20)
      await supabase.from('booking_messages').insert({
        booking_id: item.id,
        sender_id: null, 
        message: `[SYSTEM] Refund Processed. Amount: ₱${state.refundAmount.toLocaleString()}. Reason: ${state.refundReason}`,
        message_type: 'system'
      });

      // 6. Final State Synchronization
      toast.success('Financial record has been updated. Notification queued.', { id: toastId });
      await fetchRefundData();
      setState(prev => ({ ...prev, selectedItem: null, confirmRefundItem: null, refundReason: '', refundAmount: 0 }));
    } catch (err) {
      logger.error('Refund Process Error', err);
      toast.error(err.message || 'Failed to synchronize refund records', { id: toastId });
      // ROLLBACK Optimistic UI on error
      setState(prev => ({ ...prev, refundItems: previousRefundItems }));
    }
  };



  const cardStyle = { background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius)', overflow: 'hidden', boxShadow: 'var(--admin-card-shadow)', color: 'var(--admin-text-primary)' };

  if (state.loading) return <LoadingState message="Scanning cancelled assets for financial liability..." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>
      <PageHeader showBack onBack={() => navigate(-1)} badge="FINANCIAL" title="REFUND HUB" subtitle="Manage money-back requests for cancelled fleet bookings." onRefresh={fetchRefundData} />

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr', gap: isMobile ? '1rem' : '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{
            background: 'var(--admin-input-bg)',
            borderRadius: 'var(--admin-radius)',
            border: '1px solid var(--admin-border)',
            padding: '0.75rem',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: isMobile ? '100%' : '200px', position: 'relative' }}>
              <Search size={18} color="var(--admin-text-secondary)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                placeholder="Search customer or ID..." 
                value={state.searchQuery} 
                onChange={(e) => setState(prev => ({ ...prev, searchQuery: e.target.value }))} 
                style={{ flex: 1, background: 'var(--admin-bg)', border: '1px solid var(--admin-input-border)', borderRadius: 'var(--admin-radius-sm)', padding: '0.75rem 1rem 0.75rem 2.75rem', color: 'var(--admin-text-primary)', outline: 'none', fontWeight: '800' }} 
              />
            </div>
            <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--admin-card)', padding: '0.25rem', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border)' }}>
              {['PENDING', 'PROCESSED', 'ALL'].map(f => (
                <button 
                  key={f} 
                  onClick={() => setState(prev => ({ ...prev, filter: f }))} 
                  style={{ 
                    padding: '0.5rem 0.75rem', 
                    borderRadius: 'var(--admin-radius-sm)', 
                    border: 'none', 
                    background: state.filter === f ? 'var(--admin-brand)' : 'transparent', 
                    color: state.filter === f ? 'white' : 'var(--admin-text-secondary)', 
                    fontSize: '0.7rem', 
                    fontWeight: '900', 
                    cursor: 'pointer' 
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div style={{ ...cardStyle, padding: '4rem', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>
               <Box size={40} strokeWidth={1} style={{ marginBottom: '1rem', opacity: 0.3 }} />
               <p style={{ fontWeight: '800', fontSize: '0.8rem' }}>NO REFUND REQUESTS FOUND</p>
            </div>
          ) : filteredItems.map(b => (
            <div 
              key={b.id} 
              onClick={() => setState(prev => ({ ...prev, selectedItem: b, refundAmount: b.totalPaid }))} 
              style={{ 
                ...cardStyle, 
                padding: isMobile ? '1rem' : '1.25rem', 
                cursor: 'pointer', 
                border: state.selectedItem?.id === b.id ? '2px solid var(--admin-brand)' : '1px solid var(--admin-border)',
                background: state.selectedItem?.id === b.id ? 'rgba(169, 27, 24, 0.03)' : 'var(--admin-card)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--admin-text-secondary)', fontWeight: '700' }}>#{b.id.slice(0, 8).toUpperCase()}</div>
                  <h3 style={{ margin: 0, fontWeight: '900', fontSize: isMobile ? '0.9rem' : '1rem', textTransform: 'uppercase' }}>{b.customer?.full_name}</h3>
                </div>
                <span style={{ fontSize: '0.6rem', padding: '0.2rem 0.5rem', borderRadius: 'var(--admin-radius)', background: b.refundStatus === 'PROCESSED' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: b.refundStatus === 'PROCESSED' ? '#10b981' : '#ef4444', fontWeight: '900' }}>{b.refundStatus}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid var(--admin-border)', paddingTop: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--admin-text-secondary)', fontSize: '0.75rem', fontWeight: '700' }}>
                  <Car size={14} /> {b.vehicles?.length || 0} Units
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.6rem', color: 'var(--admin-text-secondary)', fontWeight: '700' }}>REFUNDABLE</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>₱{b.totalPaid.toLocaleString()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ position: 'sticky', top: '1.5rem', height: 'fit-content' }}>
          {state.selectedItem ? (
            <div style={{ ...cardStyle, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontWeight: '950', fontSize: '0.9rem', color: 'var(--admin-brand)' }}>REFUND DETAILS</h3>
                <button onClick={() => setState(prev => ({ ...prev, selectedItem: null }))} style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}><XCircle size={20} /></button>
              </div>

              <div style={{ background: 'var(--admin-bg)', padding: '0.85rem', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border)' }}>
                <div style={{ fontWeight: '900', fontSize: '0.9rem' }}>{state.selectedItem.customer?.full_name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', fontWeight: '600' }}>{state.selectedItem.customer?.email}</div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Reason for Refund</label>
                <select 
                  value={state.refundReason}
                  onChange={(e) => setState(prev => ({ ...prev, refundReason: e.target.value }))}
                  style={{ width: '100%', padding: '0.75rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', color: 'white', fontSize: '0.8rem', fontWeight: '700', marginBottom: '1rem', appearance: 'none' }}
                >
                  <option value="" disabled>Select Reason</option>
                  <option value="No-Show">No-Show</option>
                  <option value="Schedule Conflict">Schedule Conflict</option>
                  <option value="Customer Request">Customer Request</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Refund Amount (₱) - Supports Partial Fleet Refunds</label>
                <input 
                  type="number"
                  max={state.selectedItem.totalPaid}
                  min={0}
                  value={state.refundAmount}
                  onChange={(e) => setState(prev => ({ ...prev, refundAmount: Number(e.target.value) }))}
                  style={{ width: '100%', padding: '0.75rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', color: 'white', fontSize: '1rem', fontWeight: '950' }}
                />
              </div>

              {/* OCR METADATA PERSISTENCE (THESIS REQUIREMENT) */}
              {state.selectedItem.ocr_metadata && (
                <div style={{ background: 'rgba(var(--admin-info-rgb), 0.05)', border: '1px dashed var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--admin-info)', fontSize: '0.65rem', fontWeight: '950', textTransform: 'uppercase' }}>
                    <ShieldCheck size={14} /> Payment Verification Archive
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                      <span style={{ color: 'var(--admin-text-secondary)', fontWeight: '600' }}>Reference No:</span>
                      <span style={{ color: 'white', fontWeight: '900', fontFamily: 'monospace' }}>{state.selectedItem.ocr_metadata.referenceNo}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                      <span style={{ color: 'var(--admin-text-secondary)', fontWeight: '600' }}>Extracted Amount:</span>
                      <span style={{ color: 'white', fontWeight: '900' }}>₱{state.selectedItem.ocr_metadata.amount?.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                      <span style={{ color: 'var(--admin-text-secondary)', fontWeight: '600' }}>Verification Result:</span>
                      <span style={{ color: state.selectedItem.ocr_metadata.status === 'MATCHED' ? '#10b981' : '#f59e0b', fontWeight: '900' }}>{state.selectedItem.ocr_metadata.status}</span>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--admin-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--admin-text-secondary)' }}>Refundable Total</span>
                  <span style={{ fontWeight: '950', fontSize: '1.5rem' }}>₱{state.selectedItem.totalPaid.toLocaleString()}</span>
                </div>
                <button 
                  onClick={() => navigate(`/admin/bookings/${state.selectedItem.id}`)}
                  style={{ width: '100%', padding: '0.75rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'white', borderRadius: 'var(--admin-radius-sm)', fontWeight: '900', cursor: 'pointer', marginBottom: '0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <ExternalLink size={14} /> VIEW BOOKING DETAILS
                </button>

                {state.selectedItem.refundStatus === 'PENDING' && (
                  <button 
                    disabled={!state.refundReason || state.refundAmount <= 0}
                    onClick={() => setState(prev => ({ ...prev, confirmRefundItem: state.selectedItem }))} 
                    style={{ width: '100%', padding: '0.85rem', background: 'var(--admin-brand)', color: 'white', border: 'none', borderRadius: 'var(--admin-radius-sm)', fontWeight: '900', cursor: 'pointer', opacity: (!state.refundReason || state.refundAmount <= 0) ? 0.5 : 1 }}
                  >
                    MARK AS REFUNDED
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ ...cardStyle, padding: '5rem 2rem', textAlign: 'center', borderStyle: 'dashed', border: '2px dashed var(--admin-border)', background: 'transparent' }}>
              <Eye size={40} style={{ opacity: 0.2, marginBottom: '0.75rem' }} />
              <p style={{ fontWeight: '900', color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>SELECT A REQUEST</p>
            </div>
          )}
        </div>
      </div>

      {state.confirmRefundItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)' }}>
          <div style={{ background: 'var(--admin-card)', padding: '2.5rem', borderRadius: 'var(--admin-radius)', border: '1px solid var(--admin-border)', maxWidth: '400px', width: '90%', textAlign: 'center' }}>
            <AlertTriangle size={48} color="#ef4444" style={{ marginBottom: '1.5rem' }} />
            <h2 style={{ fontWeight: '950', fontSize: '1.25rem' }}>Confirm Refund?</h2>
            <p style={{ color: 'var(--admin-text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>Are you sure you want to revert ₱{state.refundAmount.toLocaleString()} back to the customer?</p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setState(prev => ({ ...prev, confirmRefundItem: null }))} style={{ flex: 1, padding: '1rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', borderRadius: 'var(--admin-radius-sm)', fontWeight: '800' }}>CANCEL</button>
              <button onClick={() => handleProcessRefund(state.confirmRefundItem)} style={{ flex: 1, padding: '1rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: 'var(--admin-radius-sm)', fontWeight: '900' }}>YES, REVERT ₱{state.refundAmount.toLocaleString()}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRefunds;
