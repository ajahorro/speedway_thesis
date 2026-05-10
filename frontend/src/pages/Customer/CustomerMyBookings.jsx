import React, { useState } from 'react';
import { Calendar, Search, ChevronRight, Car } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useBookings } from '../../hooks/useBookings';

const CustomerMyBookings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { bookings, loading } = useBookings(user?.id);
  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredBookings = bookings.filter(b => {
    const matchesFilter =
      filter === 'ALL' ||
      (filter === 'UPCOMING' && ['scheduled', 'confirmed', 'ongoing'].includes(b.status)) ||
      (filter === 'PAST' && ['completed', 'cancelled'].includes(b.status));

    const searchStr = `${b.id} ${b.vehicles?.map(v => `${v.brand} ${v.model} ${v.plate_number}`).join(' ') || ''}`.toLowerCase();
    const matchesSearch = searchStr.includes(searchTerm.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'var(--admin-brand)';
      case 'confirmed': return 'var(--admin-info)';
      case 'ongoing': return '#a855f7';
      case 'completed': return 'var(--admin-success)';
      case 'cancelled': return '#ef4444';
      default: return 'var(--admin-text-secondary)';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '950', margin: '0 0 0.5rem 0', textTransform: 'uppercase', color: 'var(--admin-text-primary)' }}>My Bookings</h1>
          <p style={{ margin: 0, color: 'var(--admin-text-secondary)', fontSize: '0.9rem', fontWeight: '600' }}>
            Track and manage all your past and upcoming service appointments.
          </p>
        </div>
        <button
          onClick={() => navigate('/customer/book')}
          className="admin-card-hover"
          style={{ padding: '0.85rem 1.5rem', background: 'var(--admin-brand)', color: '#fff', border: 'none', borderRadius: 'var(--admin-radius-sm)', fontWeight: '900', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}
        >
          + Book Appointment
        </button>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px', position: 'relative' }}>
          <Search size={18} color="var(--admin-text-secondary)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search by Booking ID or Vehicle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.75rem', background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', color: 'var(--admin-text-primary)', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--admin-card)', padding: '0.5rem', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border)' }}>
          {['ALL', 'UPCOMING', 'PAST'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '0.5rem 1rem',
                background: filter === f ? 'var(--admin-brand)' : 'transparent',
                color: filter === f ? '#fff' : 'var(--admin-text-secondary)',
                border: 'none',
                borderRadius: '4px',
                fontWeight: '900',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textTransform: 'uppercase'
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {loading ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-md)' }}>
            <div style={{ color: 'var(--admin-brand)', fontWeight: '900', fontSize: '0.9rem' }}>Loading bookings...</div>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', background: 'var(--admin-card)', border: '1px dashed var(--admin-border)', borderRadius: 'var(--admin-radius-md)' }}>
            <Calendar size={48} color="var(--admin-text-secondary)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <div style={{ color: 'var(--admin-text-primary)', fontWeight: '900', fontSize: '1.1rem', marginBottom: '0.5rem' }}>No bookings found</div>
            <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.9rem', fontWeight: '600' }}>You don't have any {filter.toLowerCase()} appointments matching this criteria.</div>
          </div>
        ) : (
          filteredBookings.map(b => {
            const dt = b.start_datetime ? new Date(b.start_datetime) : null;
            const dateStr = dt ? dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD';
            const timeStr = dt ? dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
            const vehicleLabel = b.vehicles?.length > 1
              ? `Fleet (${b.vehicles.length} units)`
              : b.vehicles?.[0] ? `${b.vehicles[0].brand} ${b.vehicles[0].model}` : 'N/A';

            return (
              <div
                key={b.id}
                onClick={() => navigate(`/customer/bookings/${b.id}`)}
                className="admin-card-hover"
                style={{
                  background: 'var(--admin-card)',
                  border: '1px solid var(--admin-border)',
                  borderRadius: 'var(--admin-radius-md)',
                  padding: '1.5rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '1.5rem',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* ID & Status */}
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Booking ID</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '950', color: 'var(--admin-text-primary)', fontFamily: 'monospace' }}>#{b.id.substring(0, 8).toUpperCase()}</div>
                  <div style={{ display: 'inline-block', marginTop: '0.5rem', fontSize: '0.7rem', fontWeight: '950', color: getStatusColor(b.status), background: `rgba(var(--admin-brand-rgb), 0.05)`, padding: '0.2rem 0.5rem', borderRadius: '4px', textTransform: 'uppercase' }}>
                    {b.status}
                  </div>
                </div>

                {/* Schedule */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--admin-text-secondary)', fontSize: '0.75rem', fontWeight: '900', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    <Calendar size={14} /> Schedule
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--admin-text-primary)' }}>{dateStr}</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--admin-text-secondary)' }}>{timeStr}</div>
                </div>

                {/* Vehicle */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--admin-text-secondary)', fontSize: '0.75rem', fontWeight: '900', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    <Car size={14} /> Vehicle
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--admin-text-primary)' }}>{vehicleLabel}</div>
                </div>

                {/* Total & Action */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '950', color: 'var(--admin-brand)' }}>₱{(b.total_amount || 0).toLocaleString()}</div>
                  </div>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronRight size={18} color="var(--admin-text-primary)" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CustomerMyBookings;
