import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { 
  LayoutDashboard, ClipboardList, CreditCard, Users, 
  TrendingUp, Calendar, AlertCircle, Clock, CheckCircle2,
  ChevronRight, ArrowUpRight, ArrowDownRight, Filter,
  ShieldCheck, ShieldAlert, Package, RefreshCcw
} from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { logger } from '../../utils/logger';
import toast from 'react-hot-toast';

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
      refundRequests: 0,
      unassignedBookings: 0
    },
    recentBookings: []
  });

  const fetchDashboardData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      logger.admin('Synchronizing dashboard intelligence...');
      const today = new Date().toISOString().split('T')[0];

      // 1. Today's Bookings
      const { count: todayCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .gte('start_datetime', `${today}T00:00:00.000Z`)
        .lte('start_datetime', `${today}T23:59:59.999Z`);

      // 2. Total Bookings
      const { count: totalCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true });

      // 3. Total Revenue
      const { data: payments } = await supabase.from('payments').select('amount').eq('status', 'PAID');
      const revenue = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);

      // 4. Needs Attention - Pending Payments
      const { count: pendingPay } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'PENDING');

      // 5. Needs Attention - Unassigned Bookings
      const { count: unassigned } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .is('staff_id', null)
        .neq('status', 'cancelled');

      // 6. Needs Attention - Refund Requests
      const { data: cancels } = await supabase.from('bookings').select('*, payments(*)').eq('status', 'cancelled');
      const pendingRefunds = (cancels || []).filter(b => 
        (b.refund_status !== 'PROCESSED') && (b.payments || []).some(p => p.status === 'PAID')
      ).length;

      // 7. Recent Bookings (DEDUPLICATED)
      const { data: recent } = await supabase
        .from('bookings')
        .select('*, customer:profiles!bookings_customer_id_fkey(full_name)')
        .order('created_at', { ascending: false })
        .limit(20); // Fetch extra to account for deduplication

      // DEDUPLICATION ENGINE: Ensure unique IDs only
      const uniqueBookings = Array.from(
        new Map((recent || []).map(b => [b.id, b])).values()
      ).slice(0, 5);

      setState({
        loading: false,
        stats: {
          todayBookings: todayCount || 0,
          totalBookings: totalCount || 0,
          totalRevenue: revenue,
          pendingPayments: pendingPay || 0,
          refundRequests: pendingRefunds || 0,
          unassignedBookings: unassigned || 0
        },
        recentBookings: uniqueBookings
      });
      
      logger.admin('Operational intelligence synchronized.');
    } catch (err) {
      logger.error('Dashboard Sync Error', err);
      toast.error('Failed to sync live metrics');
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
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
      </div>

      {/* Needs Attention Area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ShieldAlert size={20} color="var(--admin-brand)" />
          <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '950', color: 'var(--admin-text-primary)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Needs Immediate Attention</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
          <AttentionCard 
            count={state.stats.pendingPayments}
            label="Pending Verifications"
            icon={CreditCard}
            color="#f59e0b"
            bg="rgba(245, 158, 11, 0.1)"
            onClick={() => navigate('/admin/payments')}
          />
          <AttentionCard 
            count={state.stats.refundRequests}
            label="Refund Requests"
            icon={RefreshCcw}
            color="#ef4444"
            bg="rgba(239, 68, 68, 0.1)"
            onClick={() => navigate('/admin/refunds')}
          />
          <AttentionCard 
            count={state.stats.unassignedBookings}
            label="Unassigned Bookings"
            icon={Users}
            color="#3b82f6"
            bg="rgba(59, 130, 246, 0.1)"
            onClick={() => navigate('/admin/bookings')}
          />
        </div>
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
                  <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--admin-text-primary)' }}>{b.customer?.full_name}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-secondary)', fontWeight: '700' }}>#{b.id.slice(0, 8).toUpperCase()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>₱{Number(b.total_amount).toLocaleString()}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--admin-text-secondary)', fontWeight: '800', textTransform: 'uppercase' }}>{b.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .attention-card:hover { border-color: var(--admin-brand) !important; background: var(--admin-bg) !important; transform: translateY(-2px); }
        .activity-row:hover { background: var(--admin-bg); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
