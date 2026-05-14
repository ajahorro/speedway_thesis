import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { getStatusColor } from '../../utils/bookingHelpers';
import { 
  LayoutDashboard, ClipboardList, CreditCard, Users, 
  TrendingUp, Calendar, AlertCircle, Clock, CheckCircle2,
  ChevronRight, ArrowUpRight, ArrowDownRight, Filter,
  ShieldCheck, ShieldAlert, Package, RefreshCcw
} from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { logger } from '../../utils/logger';
import toast from 'react-hot-toast';
import { calculatePaymentStatus, getPaymentStatusUI } from '../../utils/paymentUtils';

// MEMOIZED SUB-COMPONENTS: Prevent entire dashboard from re-rendering on single metric change
const MetricCard = React.memo(({ title, value, icon: Icon, color, subtext, trendIcon: TrendIcon, onClick, gradient }) => (
  <div 
    onClick={onClick}
    style={{
      background: gradient || 'var(--admin-card)',
      border: gradient ? 'none' : '1px solid var(--admin-border)',
      borderRadius: 'var(--admin-radius)',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      position: 'relative',
      overflow: 'hidden',
      color: gradient ? 'white' : 'var(--admin-text-primary)',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'transform 0.2s ease'
    }}
  >
    <div style={{ opacity: gradient ? 0.8 : 1, fontSize: '0.75rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1px', color: gradient ? 'white' : 'var(--admin-text-secondary)' }}>{title}</div>
    <div style={{ fontSize: gradient ? '3rem' : '2.5rem', fontWeight: '950', lineHeight: 1 }}>{value}</div>
    <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: '800', color: color || 'inherit' }}>
      {Icon && <Icon size={14} />} {subtext}
    </div>
  </div>
));

const AttentionCard = React.memo(({ count, label, icon: Icon, color, bg, onClick }) => (
  <div onClick={onClick} style={{
    background: 'var(--admin-card)',
    border: '1px solid var(--admin-border)',
    borderRadius: 'var(--admin-radius)',
    padding: '1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1.25rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  }} className="attention-card">
    <div style={{ 
      width: '48px', height: '48px', borderRadius: 'var(--admin-radius-sm)', 
      background: bg, display: 'flex', alignItems: 'center', 
      justifyContent: 'center', color: color, border: `1px solid ${color}33` 
    }}>
      <Icon size={24} />
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '1.25rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>{count}</div>
      <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>{label}</div>
    </div>
    <ChevronRight size={18} color="var(--admin-text-secondary)" />
  </div>
));

const AdminDashboard = () => {
  const navigate = useNavigate();
  
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
      successRate: 0,
      shopLoad: 0
    },
    recentBookings: [],
    priorityItems: []
  });

  const fetchDashboardData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
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

      // 7. Recent Bookings (DEDUPLICATED)
      const { data: recent } = await supabase
        .from('bookings')
        .select(`
          *, 
          customer:profiles!bookings_customer_id_fkey(full_name),
          vehicles:booking_vehicles(id, status),
          payments:payments(*)
        `)
        .order('created_at', { ascending: false })
        .limit(20); 

      // DEDUPLICATION ENGINE: Ensure unique IDs only
      const uniqueBookings = Array.from(
        new Map((recent || []).map(b => [b.id, b])).values()
      ).slice(0, 5);

      // 8. Priority Item Aggregation (for the Queue)
      const pItems = [];
      // Add unassigned
      const { data: unassignedRaw } = await supabase.from('bookings').select('id, customer_id, start_datetime').is('staff_id', null).not('status', 'ilike', 'cancelled').limit(2);
      
      const unassignedItems = [];
      if (unassignedRaw && unassignedRaw.length > 0) {
        for (const item of unassignedRaw) {
          const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', item.customer_id).single();
          unassignedItems.push({ ...item, customer: { full_name: profile?.full_name || 'Unknown' } });
        }
      }

      unassignedItems.forEach(item => pItems.push({ id: item.id, type: 'STAFF', title: `Unassigned Fleet: ${item.customer?.full_name}`, sub: `Scheduled for ${new Date(item.start_datetime).toLocaleDateString()}`, color: '#3b82f6' }));
      
      // Add pending payments
      const { data: pendingRaw } = await supabase.from('payments').select('id, amount, booking_id').eq('status', 'FOR_VERIFICATION').limit(2);
      
      const pendingItems = [];
      if (pendingRaw && pendingRaw.length > 0) {
        for (const item of pendingRaw) {
          const { data: b } = await supabase.from('bookings').select('customer_id').eq('id', item.booking_id).single();
          if (b) {
            const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', b.customer_id).single();
            pendingItems.push({ ...item, bookings: { customer: { full_name: profile?.full_name || 'Unknown' } } });
          }
        }
      }

      pendingItems?.forEach(item => pItems.push({ id: item.id, type: 'PAYMENT', title: `Verification Needed: ₱${item.amount}`, sub: item.bookings?.customer?.full_name, color: '#f59e0b' }));

      // Add rejected payments
      const { data: rejectedRaw } = await supabase.from('payments').select('id, amount, booking_id').eq('status', 'REJECTED').limit(2);
      
      const rejectedItems = [];
      if (rejectedRaw && rejectedRaw.length > 0) {
        for (const item of rejectedRaw) {
          const { data: b } = await supabase.from('bookings').select('customer_id').eq('id', item.booking_id).single();
          if (b) {
            const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', b.customer_id).single();
            rejectedItems.push({ ...item, bookings: { customer: { full_name: profile?.full_name || 'Unknown' } } });
          }
        }
      }

      rejectedItems.forEach(item => pItems.push({ id: item.id, type: 'ALERT', title: `Rejected Payment: ₱${item.amount}`, sub: item.bookings?.customer?.full_name, color: '#ef4444' }));
      
      // Add FLAGGED_NOSHOW items (REQ-ADM-02)
      const { data: overdueRaw } = await supabase.from('bookings').select('id, customer_id, start_datetime').eq('status', 'FLAGGED_NOSHOW').limit(2);
      if (overdueRaw) {
        for (const item of overdueRaw) {
          const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', item.customer_id).single();
          pItems.push({ 
            id: item.id, 
            type: 'NO-SHOW', 
            title: `No-Show: ${profile?.full_name || 'Unknown'}`, 
            sub: `Missed ${new Date(item.start_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} slot`, 
            color: '#E61E2A' 
          });
        }
      }

      setState({
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
          successRate: sRate,
          shopLoad: sLoad
        },
        recentBookings: uniqueBookings,
        priorityItems: pItems
      });
      
      logger.admin('Operational intelligence synchronized.');
      
      // Refund gateway mapped
      window.refundGatewayMappedToastFired = true;
    } catch (err) {
      logger.error('Dashboard Sync Error', err);
      toast.error('Failed to sync live metrics');
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

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

      {/* Hero Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        <MetricCard 
          title="Today's Appointments"
          value={state.stats.todayBookings}
          icon={Calendar}
          subtext="Live Synchronization"
          gradient="linear-gradient(135deg, var(--admin-brand), #ef4444)"
        />
        <MetricCard 
          title="Total Fleet Volume"
          value={state.stats.totalBookings}
          color="#10b981"
          subtext="Cumulative Records"
          icon={ArrowUpRight}
        />
        <MetricCard 
          title="Total Gross Revenue"
          value={`₱${state.stats.totalRevenue.toLocaleString()}`}
          color="var(--admin-brand)"
          subtext="Verified Transactions"
          icon={CreditCard}
        />
        <MetricCard 
          title="Service Success Rate"
          value={`${state.stats.successRate}%`}
          color="#10b981"
          subtext="Completed vs Total"
          icon={CheckCircle2}
        />
        <MetricCard 
          title="Active Shop Load"
          value={`${state.stats.shopLoad}%`}
          color="#3b82f6"
          subtext="Technician Utilization"
          icon={RefreshCcw}
        />
      </div>

      {/* Needs Attention Area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ShieldAlert size={20} color="var(--admin-brand)" />
          <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '950', color: 'var(--admin-text-primary)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Needs Immediate Attention</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
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
            onClick={() => navigate('/admin/bookings?filter=flagged')}
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
            label="Overdue Services"
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
        </div>

        {/* Priority Queue List */}
        {state.priorityItems.length > 0 && (
          <div style={{ background: 'rgba(230, 30, 42, 0.03)', border: '1px solid rgba(230, 30, 42, 0.1)', borderRadius: '4px', padding: '1rem', marginTop: '0.5rem' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: '950', color: '#E61E2A', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '6px', height: '6px', background: '#E61E2A', borderRadius: '50%', animation: 'pulse 1.5s infinite' }}></div>
              Live Priority Queue
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {state.priorityItems.map((item, idx) => (
                <div 
                  key={idx} 
                  onClick={() => navigate(item.type === 'STAFF' ? `/admin/bookings/${item.id}` : '/admin/payments')}
                  style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: '2px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                  className="priority-row"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ fontSize: '0.6rem', fontWeight: '950', padding: '0.2rem 0.5rem', background: `${item.color}15`, color: item.color, borderRadius: '2px', textTransform: 'uppercase' }}>{item.type}</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: '900', color: 'var(--admin-text-primary)' }}>{item.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', fontWeight: '700' }}>• {item.sub}</div>
                  </div>
                  <ChevronRight size={14} color="var(--admin-text-secondary)" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius)', overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Clock size={18} color="var(--admin-brand)" />
              <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '950', color: 'var(--admin-text-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Recent Intake</h3>
            </div>
            <button onClick={() => navigate('/admin/bookings')} style={{ background: 'transparent', border: 'none', color: 'var(--admin-brand)', fontSize: '0.7rem', fontWeight: '900', cursor: 'pointer', textTransform: 'uppercase' }}>View All Bookings</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {state.recentBookings.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--admin-text-secondary)', fontSize: '0.85rem', fontWeight: '700' }}>No recent activity detected.</div>
            ) : state.recentBookings.map((b, idx) => (
              <div key={b.id} onClick={() => navigate(`/admin/bookings/${b.id}`)} style={{ padding: '1.25rem 1.5rem', borderBottom: idx === state.recentBookings.length - 1 ? 'none' : '1px solid var(--admin-border)', display: 'flex', alignItems: 'center', gap: '1.25rem', cursor: 'pointer' }} className="activity-row">
                <div style={{ width: '40px', height: '40px', borderRadius: 'var(--admin-radius-sm)', background: 'var(--admin-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-brand)', fontWeight: '900', border: '1px solid var(--admin-border)' }}>{b.customer?.full_name?.charAt(0) || '#'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--admin-text-primary)' }}>{b.customer?.full_name || b.customer_name || 'Guest Checkout'}</div>
                    {b.status?.toUpperCase() === 'CANCELLED' && (
                      <span style={{ fontSize: '0.65rem', fontWeight: '950', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.2rem 0.5rem', borderRadius: '4px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <ShieldAlert size={10} /> Cancelled
                      </span>
                    )}
                    {b.vehicles?.length > 1 && (
                      <span style={{ fontSize: '0.65rem', fontWeight: '950', background: 'rgba(var(--admin-brand-rgb), 0.1)', color: 'var(--admin-brand)', padding: '0.2rem 0.5rem', borderRadius: '4px', textTransform: 'uppercase' }}>
                        Fleet: {b.vehicles.length} Units
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-secondary)', fontWeight: '700' }}>#{b.id.slice(0, 8).toUpperCase()}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-secondary)', fontWeight: '800' }}>•</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-secondary)', fontWeight: '800', textTransform: 'uppercase' }}>
                      {b.vehicles?.filter(v => v.status === 'COMPLETED').length || 0} / {b.vehicles?.length || 0} UNITS READY
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>₱{Number(b.total_amount).toLocaleString()}</div>
                  <div style={{ 
                    fontSize: '0.65rem', 
                    fontWeight: '950', 
                    textTransform: 'uppercase',
                    color: getPaymentStatusUI(calculatePaymentStatus(b)).color
                  }}>
                    {getPaymentStatusUI(calculatePaymentStatus(b)).label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .attention-card:hover { border-color: var(--admin-brand) !important; background: var(--admin-bg) !important; transform: translateY(-2px); }
        .activity-row:hover { background: var(--admin-bg); }
        .priority-row:hover { border-color: #E61E2A !important; transform: translateX(4px); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.2); } 100% { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
