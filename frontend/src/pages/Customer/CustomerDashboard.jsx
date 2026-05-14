import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useBookings } from '../../hooks/useBookings';
import { Car, CreditCard, ClipboardList, Activity } from 'lucide-react';
import ActiveBookingContainer from '../../components/Customer/ActiveBookingContainer';
import UpcomingAppointments from '../../components/Customer/UpcomingAppointments';
import RecentNotifications from '../../components/Customer/RecentNotifications';

const CustomerDashboard = () => {
  const { user, profile } = useAuth();
  const { activeBooking, upcomingBookings, allBookings, loading } = useBookings(user?.id);

  // Calculate Metrics
  const totalBookings = allBookings?.length || 0;
  const activeServices = allBookings?.filter(b => b.status === 'ongoing' || b.status === 'in_progress').length || 0;
  
  // REQ-CST-01: Count queued vehicles across all active bookings
  const queuedVehicles = (allBookings || []).reduce((count, b) => {
    if (['in_progress'].includes(b.status?.toLowerCase())) {
      return count + (b.vehicles || []).filter(v => v.status === 'QUEUED').length;
    }
    return count;
  }, 0);
  
  // REQ-CST-09: BALANCE TRACKER (Real-time calculation)
  const totalOutstanding = (allBookings || []).reduce((sum, b) => {
    const status = b.status?.toLowerCase();
    // REQ-ADM-10: Do not count balance for finalized or revoked sessions
    if (['cancelled', 'completed', 'flagged_noshow'].includes(status)) return sum;
    const totalPaid = (b.payments || []).filter(p => p.status === 'PAID').reduce((s, p) => s + Number(p.amount), 0);
    return sum + Math.max(0, (b.total_amount || 0) - totalPaid);
  }, 0);

  const stats = [
    { label: 'Total Bookings', value: totalBookings, icon: ClipboardList, color: 'var(--admin-brand)' },
    { label: 'Outstanding Balance', value: `₱${totalOutstanding.toLocaleString()}`, icon: CreditCard, color: '#f59e0b' },
    { label: 'Active Services', value: activeServices, icon: Activity, color: '#10b981' },
    { label: queuedVehicles > 0 ? 'Units in Queue' : 'Fleet Units', value: queuedVehicles > 0 ? queuedVehicles : (profile?.fleet_count || 0), icon: Car, color: queuedVehicles > 0 ? '#f59e0b' : '#3b82f6' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', paddingBottom: '5rem' }}>
      
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '950', margin: '0 0 0.5rem 0', letterSpacing: '-1.5px', textTransform: 'uppercase', color: 'white' }}>
            Welcome back, {profile?.first_name || 'Driver'}
          </h1>
          <p style={{ color: 'var(--admin-text-secondary)', margin: 0, fontSize: '0.95rem', fontWeight: '600', opacity: 0.8 }}>
            Operational oversight of your registered fleet and service lifecycle.
          </p>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
        {stats.map((stat, idx) => (
          <div 
            key={idx}
            style={{
              background: 'var(--admin-card)',
              border: '1px solid var(--admin-border)',
              borderRadius: 'var(--admin-radius)',
              padding: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              boxShadow: 'var(--admin-card-shadow)'
            }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <stat.icon size={22} color={stat.color} />
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.2rem' }}>{stat.label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '950', color: 'white' }}>{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        {/* Left Column (Primary Focus) */}
        <div style={{ flex: '1 1 60%', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <ActiveBookingContainer booking={activeBooking} loading={loading} />
        </div>

        {/* Right Column (Secondary Focus) */}
        <div style={{ flex: '1 1 30%', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <UpcomingAppointments bookings={upcomingBookings} loading={loading} />
          <RecentNotifications userId={user?.id} />
        </div>
      </div>

    </div>
  );
};

export default CustomerDashboard;
