import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import OfficialReceipt from '../../components/OfficialReceipt';
import { ArrowLeft } from 'lucide-react';

/**
 * CustomerReceipt — Standalone full-page receipt view.
 * Route: /customer/receipt/:id  (where :id is the booking ID)
 */
const CustomerReceipt = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [booking, setBooking]   = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    if (!id) return;
    fetchBooking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchBooking = async () => {
    try {
      const { data, error: err } = await supabase
        .from('bookings')
        .select(`
          *,
          payments:payments!payments_booking_id_fkey(*),
          vehicles:booking_vehicles!booking_vehicles_booking_id_fkey(
            *,
            services:booking_vehicle_services!booking_vehicle_id(*)
          )
        `)
        .eq('id', id)
        .single();

      if (err) throw err;
      if (!data) throw new Error('Booking not found');

      setBooking(data);
      setVehicles(data.vehicles || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#F3F4F6' }}>
        <div style={{ fontSize: '0.9rem', color: '#6B7280', fontWeight: '600' }}>Generating document...</div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#F3F4F6', gap: '1rem' }}>
        <div style={{ fontSize: '0.9rem', color: '#EF4444', fontWeight: '700' }}>Unable to load receipt: {error}</div>
        <button onClick={() => navigate(-1)} style={{ padding: '0.6rem 1.25rem', background: '#111827', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '800', fontSize: '0.8rem' }}>
          Go Back
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Back button — hidden on print */}
      <div className="no-print" style={{ position: 'fixed', top: '1rem', left: '1rem', zIndex: 100 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: '#111827', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '700', fontSize: '0.78rem' }}
        >
          <ArrowLeft size={14} /> Back
        </button>
      </div>

      <OfficialReceipt
        booking={booking}
        vehicles={vehicles}
        user={user}
        selectedPayment={null}
        mode="page"
      />
    </>
  );
};

export default CustomerReceipt;
