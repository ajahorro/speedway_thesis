import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { mockBookings, mockPayments, mockRefunds } from './AdminMockData';
import { Users, Clipboard, Clock, CheckCircle, AlertTriangle, Calendar, Activity } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import LoadingState from '../../components/LoadingState';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { logger } from '../../utils/logger';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const [data, setData] = useState([]);
  const [payments, setPayments] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setTimeout(() => {
      try {
        setData(mockBookings);
        setPayments(mockPayments);
        setRefunds(mockRefunds);
      } catch (err) {
        logger.error('Error fetching dashboard data', err);
      } finally {
        setLoading(false);
      }
    }, 400);
  };

  // Metrics calculation
  const totalBookingsCount = data.length;
  const totalRevenueAmount = payments
    .filter(p => p.status === 'PAID')
    .reduce((sum, p) => sum + Number(p.amount), 0);
  
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  const todayBookingsCount = data.filter(b => b.start_datetime?.startsWith(todayStr)).length;

  // Needs Attention Logic
  const pendingVerifications = payments.filter(p => p.status === 'FOR_VERIFICATION');
  const pendingRefunds = refunds.filter(r => r.status === 'PENDING');
  const unassignedBookings = data.filter(b => b.status === 'scheduled' && !b.staff_id);

  // Workflow Logic
  const workflowStats = { queued: 0, in_progress: 0, completed: 0, cancelled: 0 };
  data.forEach(b => {
    const sStatus = b.service_status || 'queued';
    if (workflowStats.hasOwnProperty(sStatus)) {
      workflowStats[sStatus]++;
    }
  });

  const panelStyle = {
    background: 'var(--admin-card)',
    border: '1px solid var(--admin-border)',
    borderRadius: 'var(--admin-radius)',
    padding: '1.5rem',
    boxShadow: 'var(--admin-card-shadow)',
    color: 'var(--admin-text-primary)',
    transition: 'all 0.3s ease'
  };

  const actionCardStyle = {
    ...panelStyle,
    background: 'var(--admin-bg)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    cursor: 'pointer',
    borderLeft: '4px solid var(--admin-brand)',
    transition: '0.2s'
  };

  if (loading) {
    return <LoadingState message="SYNCHRONIZING OPERATIONAL DATA..." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Page Header */}
      <PageHeader 
        badge="OPERATIONAL COMMAND"
        title={`WELCOME, ADMIN ${profile?.first_name?.toUpperCase() || 'USER'}!`}
        subtitle="Real-time oversight of fleet logistics and financial verification."
        onRefresh={() => fetchData()}
      />

      {/* Hero Metrics: Operational Overview */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <Activity size={18} color="var(--admin-brand)" />
          <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '950', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--admin-text-secondary)' }}>Operational Overview</h3>
        </div>
        <div className="metrics-grid">
          
          <div 
            className="admin-card-hover" 
            onClick={() => navigate('/admin/bookings', { state: { filter: todayStr } })}
            style={{ ...panelStyle, cursor: 'pointer' }}
          >
            <p style={{ margin: 0, color: 'var(--admin-text-secondary)', fontSize: '0.6rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '0.75rem' }}>Today's Bookings</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '3rem', fontWeight: '950', color: 'var(--admin-brand)', lineHeight: 1 }}>{todayBookingsCount}</h2>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', opacity: 0.5 }}>UNITS</span>
            </div>
          </div>

          <div 
            className="admin-card-hover" 
            onClick={() => navigate('/admin/bookings')}
            style={{ ...panelStyle, cursor: 'pointer' }}
          >
            <p style={{ margin: 0, color: 'var(--admin-text-secondary)', fontSize: '0.6rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '0.75rem' }}>Total Bookings</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '3rem', fontWeight: '950', color: 'var(--admin-text-primary)', lineHeight: 1 }}>{totalBookingsCount}</h2>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', opacity: 0.5 }}>LIFETIME</span>
            </div>
          </div>

          <div 
            className="admin-card-hover" 
            onClick={() => navigate('/admin/analytics')}
            style={{ ...panelStyle, background: 'var(--admin-sidebar)', border: '1px solid var(--admin-brand)', cursor: 'pointer' }}
          >
            <p style={{ margin: 0, color: 'var(--admin-brand)', fontSize: '0.6rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '0.75rem' }}>Total Revenue</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '2.5rem', fontWeight: '950', color: 'var(--admin-text-primary)', lineHeight: 1, fontFamily: 'monospace' }}>₱{totalRevenueAmount.toLocaleString()}</h2>
            </div>
          </div>

        </div>
      </section>

      {/* Workflow Metrics */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <Clipboard size={18} color="#3b82f6" />
          <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '950', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--admin-text-secondary)' }}>Service Workflow</h3>
        </div>
        <div className="metrics-grid">
          
          <div 
            className="admin-card-hover" 
            onClick={() => navigate('/admin/bookings', { state: { filter: 'queued' } })}
            style={{ ...panelStyle, cursor: 'pointer' }}
          >
            <p style={{ margin: 0, color: 'var(--admin-text-secondary)', fontSize: '0.6rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '0.75rem' }}>Not Started</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '2.5rem', fontWeight: '950', color: 'var(--admin-text-primary)', lineHeight: 1 }}>{workflowStats.queued}</h2>
              <span style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.5 }}>QUEUED</span>
            </div>
          </div>

          <div 
            className="admin-card-hover" 
            onClick={() => navigate('/admin/bookings', { state: { filter: 'in progress' } })}
            style={{ ...panelStyle, cursor: 'pointer' }}
          >
            <p style={{ margin: 0, color: '#a855f7', fontSize: '0.6rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '0.75rem' }}>Ongoing</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '2.5rem', fontWeight: '950', color: 'var(--admin-text-primary)', lineHeight: 1 }}>{workflowStats.in_progress}</h2>
              <span style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.5 }}>IN PROGRESS</span>
            </div>
          </div>

          <div 
            className="admin-card-hover" 
            onClick={() => navigate('/admin/bookings', { state: { filter: 'completed' } })}
            style={{ ...panelStyle, cursor: 'pointer' }}
          >
            <p style={{ margin: 0, color: '#10b981', fontSize: '0.6rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '0.75rem' }}>Completed</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '2.5rem', fontWeight: '950', color: 'var(--admin-text-primary)', lineHeight: 1 }}>{workflowStats.completed}</h2>
              <span style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.5 }}>FINISHED</span>
            </div>
          </div>

          <div 
            className="admin-card-hover" 
            onClick={() => navigate('/admin/bookings', { state: { filter: 'cancelled' } })}
            style={{ ...panelStyle, cursor: 'pointer' }}
          >
            <p style={{ margin: 0, color: '#ef4444', fontSize: '0.6rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '0.75rem' }}>Cancelled</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '2.5rem', fontWeight: '950', color: 'var(--admin-text-primary)', lineHeight: 1 }}>{workflowStats.cancelled}</h2>
              <span style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.5 }}>TERMINATED</span>
            </div>
          </div>

        </div>
      </section>

      {/* Actionable Sections: Needs Attention */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <AlertTriangle size={18} color="#ef4444" />
          <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '950', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--admin-text-secondary)' }}>Needs Attention</h3>
        </div>
        
        <div className="responsive-grid">
          
          {/* Pending Verification */}
          <div style={panelStyle}>
            <div 
              onClick={() => navigate('/admin/payments')} 
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', cursor: 'pointer' }}
            >
              <h4 style={{ margin: 0, fontSize: '0.7rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1px' }}>Pending Verification</h4>
              <span style={{ padding: '0.2rem 0.5rem', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', fontSize: '0.65rem', fontWeight: '950', borderRadius: 'var(--admin-radius-sm)', border: '1px solid #f59e0b' }}>{pendingVerifications.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {pendingVerifications.slice(0, 3).map(p => (
                <div key={p.id} onClick={() => navigate('/admin/payments')} style={actionCardStyle}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '950' }}>{p.reference_number || 'N/A'}</div>
                  <div style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--admin-text-secondary)' }}>₱{p.amount.toLocaleString()} • VERIFY RECEIPT</div>
                </div>
              ))}
              {pendingVerifications.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', border: '1px dashed var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', opacity: 0.5 }}>
                  <CheckCircle size={24} style={{ marginBottom: '0.5rem' }} />
                  <div style={{ fontSize: '0.6rem', fontWeight: '950' }}>ALL CLEAR</div>
                </div>
              )}
              {pendingVerifications.length > 3 && (
                <button onClick={() => navigate('/admin/payments')} style={{ background: 'none', border: 'none', color: 'var(--admin-brand)', fontSize: '0.65rem', fontWeight: '950', cursor: 'pointer', textAlign: 'left', padding: '0.5rem 0' }}>+ {pendingVerifications.length - 3} MORE TRANSACTIONS</button>
              )}
            </div>
          </div>

          {/* Refund Requests */}
          <div style={panelStyle}>
            <div 
              onClick={() => navigate('/admin/refunds')} 
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', cursor: 'pointer' }}
            >
              <h4 style={{ margin: 0, fontSize: '0.7rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1px' }}>Refund Requests</h4>
              <span style={{ padding: '0.2rem 0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '0.65rem', fontWeight: '950', borderRadius: 'var(--admin-radius-sm)', border: '1px solid #ef4444' }}>{pendingRefunds.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {pendingRefunds.slice(0, 3).map(r => (
                <div key={r.id} onClick={() => navigate('/admin/refunds')} style={actionCardStyle}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '950' }}>#{r.id.slice(0, 8).toUpperCase()}</div>
                  <div style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--admin-text-secondary)' }}>₱{r.amount.toLocaleString()} • ACTION REQUIRED</div>
                </div>
              ))}
              {pendingRefunds.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', border: '1px dashed var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', opacity: 0.5 }}>
                  <CheckCircle size={24} style={{ marginBottom: '0.5rem' }} />
                  <div style={{ fontSize: '0.6rem', fontWeight: '950' }}>NO PENDING REFUNDS</div>
                </div>
              )}
              {pendingRefunds.length > 3 && (
                <button onClick={() => navigate('/admin/refunds')} style={{ background: 'none', border: 'none', color: 'var(--admin-brand)', fontSize: '0.65rem', fontWeight: '950', cursor: 'pointer', textAlign: 'left', padding: '0.5rem 0' }}>+ {pendingRefunds.length - 3} MORE REQUESTS</button>
              )}
            </div>
          </div>

          {/* Needs Assignment */}
          <div style={panelStyle}>
            <div 
              onClick={() => navigate('/admin/bookings')} 
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', cursor: 'pointer' }}
            >
              <h4 style={{ margin: 0, fontSize: '0.7rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1px' }}>Needs Assignment</h4>
              <span style={{ padding: '0.2rem 0.5rem', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', fontSize: '0.65rem', fontWeight: '950', borderRadius: 'var(--admin-radius-sm)', border: '1px solid #3b82f6' }}>{unassignedBookings.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {unassignedBookings.slice(0, 3).map(b => (
                <div key={b.id} onClick={() => navigate('/admin/bookings')} style={actionCardStyle}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '950' }}>{b.customer?.full_name?.toUpperCase() || 'UNKNOWN'}</div>
                  <div style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--admin-text-secondary)' }}>{new Date(b.start_datetime).toLocaleDateString()} • ASSIGN STAFF</div>
                </div>
              ))}
              {unassignedBookings.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', border: '1px dashed var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', opacity: 0.5 }}>
                  <Users size={24} style={{ marginBottom: '0.5rem' }} />
                  <div style={{ fontSize: '0.6rem', fontWeight: '950' }}>FULL ASSIGNMENT</div>
                </div>
              )}
              {unassignedBookings.length > 3 && (
                <button onClick={() => navigate('/admin/bookings')} style={{ background: 'none', border: 'none', color: 'var(--admin-brand)', fontSize: '0.65rem', fontWeight: '950', cursor: 'pointer', textAlign: 'left', padding: '0.5rem 0' }}>+ {unassignedBookings.length - 3} MORE BOOKINGS</button>
              )}
            </div>
          </div>

        </div>
      </section>

      {/* Global Theme Styles */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        section { animation: fadeIn 0.4s ease-out; }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
