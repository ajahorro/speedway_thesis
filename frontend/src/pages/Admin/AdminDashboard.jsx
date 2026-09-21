import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatBookingDate, formatBookingTime, getStatusColor } from '../../utils/bookingHelpers';
import {
  CreditCard, Users, AlertCircle,
  ChevronRight, ShieldAlert, RefreshCcw, CheckCircle
} from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { useUI } from '../../context/UIContext';
import { logger } from '../../utils/logger';
import toast from 'react-hot-toast';

// MEMOIZED SUB-COMPONENTS: Prevent entire dashboard from re-rendering on single metric change
const AttentionCard = React.memo(({ count, label, icon: Icon, color, bg, onClick }) => {
  const isZero = Number(count || 0) === 0;
  const accentBorder = isZero ? '1px solid rgba(148, 163, 184, 0.18)' : `1px solid ${color}55`;
  const cardBackground = isZero ? 'rgba(148, 163, 184, 0.04)' : 'rgba(17, 24, 39, 0.18)';
  const valueColor = isZero ? 'var(--admin-text-secondary)' : 'var(--admin-text-primary)';
  const iconOpacity = isZero ? 0.65 : 1;

  return (
    <div onClick={onClick} style={{
      background: cardBackground,
      border: accentBorder,
      borderRadius: 'var(--admin-radius)',
      padding: '1rem 1.1rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.9rem',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      boxShadow: isZero ? 'none' : `0 0 0 1px ${color}18, 0 8px 18px rgba(15, 23, 42, 0.08)`
    }} className="attention-card">
      <div style={{
        width: '46px', height: '46px', borderRadius: '50%',
        background: isZero ? 'rgba(148, 163, 184, 0.08)' : bg,
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: color,
        border: `1px solid ${isZero ? 'rgba(148, 163, 184, 0.18)' : color + '55'}`,
        opacity: iconOpacity,
        flexShrink: 0
      }}>
        <Icon size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '1.45rem', fontWeight: '950', color: valueColor, lineHeight: 1.1 }}>{count}</div>
        <div style={{ fontSize: '0.76rem', fontWeight: '700', color: isZero ? 'var(--admin-text-secondary)' : 'var(--admin-text-primary)', textTransform: 'capitalize', letterSpacing: '0.02em', marginTop: '0.18rem' }}>{label}</div>
      </div>
      <ChevronRight size={18} color="var(--admin-text-secondary)" style={{ opacity: isZero ? 0.5 : 1 }} />
    </div>
  );
});

const getQueueStatusStyle = status => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'scheduled') return { background: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.28)', color: '#93c5fd' };
  if (normalized === 'confirmed') return { background: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.28)', color: '#6ee7b7' };
  return { background: 'rgba(168, 85, 247, 0.1)', border: 'rgba(168, 85, 247, 0.28)', color: '#d8b4fe' };
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { openModal } = useUI();

  // BATCHED STATE
  const [state, setState] = useState({
    loading: true,
    stats: {
      todayBookings: 0,
      totalBookings: 0,
      totalRevenue: 0,
      pendingPayments: 0,
      flaggedBookings: 0,
      unassignedBookings: 0,
      overdueServices: 0,
      refundRequests: 0,
      releaseBay: 0,
      successRate: 0,
      shopLoad: 0
      ,lifecycle: { pending: 0, inProgress: 0, qualityCheck: 0, completed: 0, activeBays: 0 }
    },
    priorityItems: [],
    priorityLoading: true,
    activeQueue: []
  });

  const fetchPriorityQueue = useCallback(async () => {
    try {
      const pItems = [];
      const { data: unassignedRaw } = await supabase.from('bookings').select('id, customer_id, customer_name, start_datetime').is('staff_id', null).not('status', 'ilike', 'cancelled').limit(2);

      for (const item of unassignedRaw || []) {
        const { data: profile } = item.customer_id
          ? await supabase.from('profiles').select('full_name').eq('id', item.customer_id).maybeSingle()
          : { data: null };
        pItems.push({
          id: item.id,
          type: 'STAFF',
          title: profile?.full_name || item.customer_name || 'Unknown',
          sub: `Scheduled for ${formatBookingDate(item.start_datetime)}`,
          color: '#3b82f6'
        });
      }

      const { data: pendingRaw } = await supabase.from('payments').select('id, amount, booking_id').eq('status', 'FOR_VERIFICATION').limit(2);
      for (const item of pendingRaw || []) {
        const { data: booking } = await supabase.from('bookings').select('customer_id, customer_name').eq('id', item.booking_id).maybeSingle();
        if (!booking) continue;
        const { data: profile } = booking.customer_id
          ? await supabase.from('profiles').select('full_name').eq('id', booking.customer_id).maybeSingle()
          : { data: null };
        pItems.push({ id: item.id, type: 'PAYMENT', title: `Verification Needed: ₱${item.amount}`, sub: profile?.full_name || booking.customer_name || 'Unknown', color: '#f59e0b' });
      }

      const { data: rejectedRaw } = await supabase.from('payments').select('id, amount, booking_id').eq('status', 'REJECTED').limit(2);
      for (const item of rejectedRaw || []) {
        const { data: booking } = await supabase.from('bookings').select('customer_id, customer_name').eq('id', item.booking_id).maybeSingle();
        if (!booking) continue;
        const { data: profile } = booking.customer_id
          ? await supabase.from('profiles').select('full_name').eq('id', booking.customer_id).maybeSingle()
          : { data: null };
        pItems.push({ id: item.id, type: 'ALERT', title: `Rejected Payment: ₱${item.amount}`, sub: profile?.full_name || booking.customer_name || 'Unknown', color: '#ef4444' });
      }

      const { data: overdueRaw } = await supabase.from('bookings').select('id, customer_id, customer_name, start_datetime').eq('status', 'FLAGGED_NOSHOW').limit(2);
      for (const item of overdueRaw || []) {
        const { data: profile } = item.customer_id
          ? await supabase.from('profiles').select('full_name').eq('id', item.customer_id).maybeSingle()
          : { data: null };
        pItems.push({
          id: item.id,
          type: 'NO-SHOW',
          title: `No-Show: ${profile?.full_name || item.customer_name || 'Unknown'}`,
          sub: `Missed ${formatBookingDate(item.start_datetime)} at ${formatBookingTime(item.start_datetime)}`,
          color: '#E61E2A'
        });
      }

      setState(prev => ({ ...prev, priorityItems: pItems, priorityLoading: false }));
    } catch (err) {
      logger.error('Priority Queue Sync Error', err);
      setState(prev => ({ ...prev, priorityItems: [], priorityLoading: false }));
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, priorityLoading: true }));
    fetchPriorityQueue();
    try {
      logger.admin('Synchronizing dashboard intelligence...');
      const today = new Date().toLocaleDateString('en-CA');

      // 1. Today's Bookings
      const { count: todayCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .gte('start_datetime', `${today}T00:00:00`)
        .lte('start_datetime', `${today}T23:59:59`);

      // 2. Total Bookings
      const { count: totalCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true });

      // 3. Total Revenue
      const { data: payments } = await supabase.from('payments').select('amount').eq('status', 'PAID');
      const revenue = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);

      // 4. Success Rate Calculation
      const { data: allVehicles } = await supabase.from('booking_vehicles').select('status');
      const completed = allVehicles?.filter(v => v.status === 'COMPLETED').length || 0;
      const totalUnits = allVehicles?.length || 1; // Avoid div by zero
      const sRate = Math.round((completed / totalUnits) * 100);

      // 5. Shop Load (Active vs Total assigned)
      const activeUnits = allVehicles?.filter(v => v.status === 'IN_PROGRESS').length || 0;
      const sLoad = Math.round((activeUnits / totalUnits) * 100);
      const normalizedStatuses = (allVehicles || []).map(vehicle => String(vehicle.status || '').toUpperCase());
      const lifecycle = {
        pending: normalizedStatuses.filter(status => ['QUEUED', 'PENDING'].includes(status)).length,
        inProgress: normalizedStatuses.filter(status => ['IN_PROGRESS', 'ONGOING'].includes(status)).length,
        qualityCheck: normalizedStatuses.filter(status => ['QUALITY_CHECK', 'READY_FOR_PICKUP', 'FOR_RELEASE'].includes(status)).length,
        completed: normalizedStatuses.filter(status => ['COMPLETED', 'RELEASED'].includes(status)).length,
        activeBays: normalizedStatuses.filter(status => ['IN_PROGRESS', 'ONGOING', 'QUALITY_CHECK', 'READY_FOR_PICKUP'].includes(status)).length
      };

      // 4. Needs Attention - Pending Payments
      const { count: pendingPay } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'FOR_VERIFICATION');

      // 5. Needs Attention - Unassigned Bookings
      const { count: unassigned } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .is('staff_id', null)
        .not('status', 'ilike', 'cancelled');

      // 6. Needs Attention - Flagged for Review (Rejected Payments)
      const { count: flaggedCount } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'REJECTED');

      // 7. Needs Attention - No-Show Flagged (REQ-ADM-02)
      const { count: overdue } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'FLAGGED_NOSHOW');

      // Completed bookings still occupy a bay until the customer collects the vehicle.
      const { count: releaseBay } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .in('status', ['completed', 'COMPLETED']);

      // 8. Needs Attention - Refund Requests (REQ-ADM-05)
      const { data: refundData } = await supabase
        .from('bookings')
        .select(`id, refund_status, payments(amount, status)`)
        .in('status', ['cancelled', 'FLAGGED_NOSHOW']);

      const refundRequestsCount = (refundData || []).filter(b => {
        // Exclude bookings already processed in the hub
        if (b.refund_status === 'PROCESSED') return false;

        // Check if there is actual financial liability (money was paid)
        const totalPaid = (b.payments || [])
          .filter(p => p.status === 'PAID' || p.status === 'REFUND_PENDING')
          .reduce((sum, p) => sum + Number(p.amount), 0);

        return totalPaid > 0;
      }).length;

      const { data: activeQueue } = await supabase
        .from('bookings')
        .select('id, customer_name, start_datetime, status, vehicles:booking_vehicles(id, vehicle_type, plate_number)')
        .in('status', ['scheduled', 'confirmed', 'in_progress', 'SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'])
        .gte('start_datetime', `${today}T00:00:00`)
        .order('start_datetime', { ascending: true })
        .limit(12);

      setState(prev => ({
        ...prev,
        loading: false,
        stats: {
          todayBookings: todayCount || 0,
          totalBookings: totalCount || 0,
          totalRevenue: revenue,
          pendingPayments: pendingPay || 0,
          flaggedBookings: flaggedCount || 0,
          unassignedBookings: unassigned || 0,
          overdueServices: overdue || 0,
          refundRequests: refundRequestsCount || 0,
          releaseBay: releaseBay || 0,
          successRate: sRate,
          shopLoad: sLoad,
          lifecycle
        },
        activeQueue: activeQueue || []
      }));

      logger.admin('Operational intelligence synchronized.');

      // Refund gateway mapped
      window.refundGatewayMappedToastFired = true;
    } catch (err) {
      logger.error('Dashboard Sync Error', err);
      toast.error('Failed to sync live metrics');
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [fetchPriorityQueue]);

  const releaseBooking = (bookingId) => {
    openModal({
      title: 'Release Booking?',
      message: 'The customer has collected the vehicle and the bay can be made available again.',
      confirmText: 'Yes, Release',
      cancelText: 'Keep Completed',
      type: 'success',
      onConfirm: async () => {
        try {
          const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'}/api/bookings/release`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId })
          });
          const result = await response.json();
          if (!response.ok || !result.success) throw new Error(result.error || 'Release failed.');
          toast.success('Booking released from the active queue.');
          fetchDashboardData();
        } catch (error) {
          logger.error('Release Booking Error', error);
          toast.error('Unable to release this booking.');
        }
      }
    });
  };

  useEffect(() => {
    fetchDashboardData();

    // REQ-NFR-05: Realtime subscription for auto-refresh
    const debounceRef = { current: null };
    const debouncedRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(fetchDashboardData, 500);
    };

    const channel = supabase
      .channel('admin-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, debouncedRefresh)
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchDashboardData]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.5s ease' }}>
      <PageHeader
        badge="OPERATIONAL OVERVIEW"
        title="Command Center"
        subtitle="Real-time performance metrics and fleet coordination."
        onRefresh={fetchDashboardData}
      />

      {/* Two-column operational overview */}
      <div className="dashboard-columns">
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ShieldAlert size={20} color="var(--admin-brand)" />
          <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '950', color: 'var(--admin-text-primary)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Needs Immediate Attention</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.9rem' }}>
          <AttentionCard
            count={state.stats.pendingPayments}
            label="Pending Verifications"
            icon={CreditCard}
            color="#f59e0b"
            bg="rgba(245, 158, 11, 0.1)"
            onClick={() => navigate('/admin/payments')}
          />
          <AttentionCard
            count={state.stats.flaggedBookings}
            label="Flagged for Review"
            icon={ShieldAlert}
            color="#ef4444"
            bg="rgba(239, 68, 68, 0.1)"
            onClick={() => navigate('/admin/bookings?filter=FLAGGED_NOSHOW')}
          />
          <AttentionCard
            count={state.stats.unassignedBookings}
            label="Unassigned Fleets"
            icon={Users}
            color="#3b82f6"
            bg="rgba(59, 130, 246, 0.1)"
            onClick={() => navigate('/admin/bookings?filter=unassigned')}
          />
          <AttentionCard
            count={state.stats.overdueServices}
            label="No-Show Flagged"
            icon={AlertCircle}
            color="#E61E2A"
            bg="rgba(230, 30, 42, 0.1)"
            onClick={() => navigate('/admin/bookings?filter=overdue')}
          />
          <AttentionCard
            count={state.stats.refundRequests}
            label="Refund Requests"
            icon={RefreshCcw}
            color="#f97316"
            bg="rgba(249, 115, 22, 0.1)"
            onClick={() => navigate('/admin/refunds')}
          />
          <AttentionCard
            count={state.stats.releaseBay}
            label="Release Bay"
            icon={CheckCircle}
            color="#10b981"
            bg="rgba(16, 185, 129, 0.1)"
            onClick={() => navigate('/admin/bookings?filter=completed')}
          />
        </div>

        </section>

        <section className="live-queue-panel" style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius)', padding: '1rem' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-primary)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '6px', height: '6px', background: 'var(--admin-brand)', borderRadius: '50%', animation: 'pulse 1.5s infinite' }}></div>
              Live Booking Queue
            </div>
            <button onClick={() => navigate('/admin/bookings')} style={{ background: 'transparent', border: 'none', color: 'var(--admin-brand)', fontWeight: '800', fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', padding: 0 }}>
              View all queue
            </button>
          </div>
          {state.loading ? (
            <div style={{ padding: '0.75rem 1rem', color: 'var(--admin-text-secondary)', fontSize: '0.75rem', fontWeight: '700' }}>Loading live bookings...</div>
          ) : state.activeQueue.length === 0 ? (
            <div style={{ padding: '0.75rem 1rem', color: 'var(--admin-text-secondary)', fontSize: '0.75rem', fontWeight: '700' }}>No active bookings right now.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {state.activeQueue.map(booking => {
                const statusStyle = getQueueStatusStyle(booking.status);
                return <div key={booking.id} onClick={() => navigate(`/admin/bookings/${booking.id}`)} style={{ background: statusStyle.background, border: `1px solid ${statusStyle.border}`, borderRadius: 'var(--admin-radius-sm)', padding: '0.7rem 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.9rem', cursor: 'pointer' }} className="queue-row">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: '900', color: 'var(--admin-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{booking.customer_name || 'Walk-in Guest'}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--admin-text-secondary)', fontWeight: '700' }}>{formatBookingDate(booking.start_datetime)} at {formatBookingTime(booking.start_datetime)} · {booking.vehicles?.length || 0} vehicle{booking.vehicles?.length === 1 ? '' : 's'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexShrink: 0 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.25rem 0.5rem', borderRadius: '999px', background: statusStyle.background, border: `1px solid ${statusStyle.border}`, color: statusStyle.color, fontSize: '.6rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{String(booking.status).replace('_', ' ')}</span>
                    <ChevronRight size={14} color="var(--admin-text-secondary)" />
                  </div>
                </div>;
              })}
            </div>
          )}
        </section>
      </div>

      <style>{`
        .attention-card:hover { border-color: var(--admin-brand) !important; background: rgba(var(--admin-brand-rgb), 0.04) !important; transform: translateY(-2px); }
        .dashboard-columns { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.9fr); gap: 1.25rem; align-items: start; }
        .queue-row:hover { border-color: var(--admin-brand) !important; transform: translateX(2px); }
        @media (max-width: 1000px) { .dashboard-columns { grid-template-columns: 1fr; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.2); } 100% { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
