import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useBookings } from '../../hooks/useBookings';
import ActiveBookingContainer from '../../components/Customer/ActiveBookingContainer';
import UpcomingAppointments from '../../components/Customer/UpcomingAppointments';
import RecentNotifications from '../../components/Customer/RecentNotifications';

const CustomerDashboard = () => {
  const { user, profile } = useAuth();
  const { activeBooking, upcomingBookings, loading } = useBookings(user?.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '950', margin: '0 0 0.5rem 0', letterSpacing: '-0.5px', textTransform: 'uppercase', color: 'var(--admin-text-primary)' }}>
          Welcome back, {profile?.first_name || 'Driver'}
        </h1>
        <p style={{ color: 'var(--admin-text-secondary)', margin: 0, fontSize: '0.9rem', fontWeight: '600' }}>
          Here is the current status of your fleet and upcoming services.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        {/* Left Column 70% */}
        <div style={{ flex: '1 1 65%', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <ActiveBookingContainer booking={activeBooking} loading={loading} />
        </div>

        {/* Right Column 30% */}
        <div style={{ flex: '1 1 30%', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <UpcomingAppointments bookings={upcomingBookings} loading={loading} />
          <RecentNotifications userId={user?.id} />
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;
