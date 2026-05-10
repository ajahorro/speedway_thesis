import React from 'react';
import { CheckCircle, Calendar, ShieldCheck, MapPin, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BookingSuccess = ({ bookingData }) => {
  const navigate = useNavigate();
  const vehicle = bookingData.vehicles[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4rem 2rem', gap: '2rem' }}>
      
      <div style={{ position: 'relative' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(var(--admin-success-rgb), 0.1)', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', animation: 'pulse 2s infinite' }} />
        <CheckCircle size={64} color="var(--admin-success)" style={{ position: 'relative', zIndex: 1 }} />
      </div>

      <div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '950', color: 'var(--admin-text-primary)', margin: '0 0 1rem 0', textTransform: 'uppercase', letterSpacing: '-1px' }}>
          Booking Received!
        </h1>
        <p style={{ fontSize: '1rem', color: 'var(--admin-text-secondary)', fontWeight: '600', maxWidth: '500px', margin: '0 auto', lineHeight: 1.6 }}>
          Thank you! Your appointment request for your <span style={{ color: 'var(--admin-text-primary)', fontWeight: '800' }}>{vehicle.brand} {vehicle.model}</span> has been securely sent to our system.
        </p>
      </div>

      <div style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-lg)', padding: '2rem', display: 'flex', gap: '2rem', textAlign: 'left', flexWrap: 'wrap', justifyContent: 'center' }}>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(var(--admin-brand-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={20} color="var(--admin-brand)" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Schedule</div>
            <div style={{ fontSize: '0.95rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>{bookingData.date} • {bookingData.time}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(var(--admin-brand-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={20} color="var(--admin-brand)" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Status</div>
            <div style={{ fontSize: '0.95rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>
              {bookingData.payment.method === 'GCash' ? 'Pending Verification' : 'Pending Arrival'}
            </div>
          </div>
        </div>

      </div>

      <div style={{ background: 'rgba(var(--admin-info-rgb), 0.1)', border: '1px solid rgba(var(--admin-info-rgb), 0.2)', padding: '1rem 1.5rem', borderRadius: 'var(--admin-radius-md)', color: 'var(--admin-info)', display: 'flex', gap: '0.75rem', alignItems: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <MapPin size={24} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '0.85rem', fontWeight: '600', lineHeight: 1.5, textAlign: 'left' }}>
          You can track the live status of this booking, message your technician, and view your digital receipt directly from your Customer Dashboard.
        </span>
      </div>

      <button 
        onClick={() => navigate('/customer')}
        className="admin-card-hover"
        style={{
          marginTop: '1rem',
          padding: '1rem 2.5rem',
          background: 'var(--admin-brand)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--admin-radius-md)',
          fontWeight: '950',
          fontSize: '1rem',
          cursor: 'pointer',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}
      >
        Return to Dashboard <ArrowRight size={18} />
      </button>

      <style>{`
        @keyframes pulse {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
          50% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default BookingSuccess;
