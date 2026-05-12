import React from 'react';
import { CheckCircle, Calendar, ShieldCheck, MapPin, ArrowRight, Printer, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BookingSuccess = ({ bookingData }) => {
  const navigate = useNavigate();
  
  // Calculate total amount from services if not explicitly in bookingData
  const calculateTotal = () => {
    return bookingData.vehicles.reduce((sum, v) => {
      return sum + v.services.reduce((sSum, s) => sSum + (s.price || 0), 0);
    }, 0);
  };

  const totalAmount = calculateTotal();

  const labelStyle = {
    fontSize: '0.65rem',
    fontWeight: '950',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '0.25rem',
    display: 'block'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem', gap: '2rem' }}>
      
      {/* Success Animation */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(var(--admin-success-rgb), 0.1)', marginBottom: '1rem' }}>
          <CheckCircle size={40} color="var(--admin-success)" />
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: '950', color: '#fff', margin: 0, textTransform: 'uppercase' }}>Booking Confirmed!</h1>
        <p style={{ color: 'var(--admin-text-secondary)', fontWeight: '600', marginTop: '0.5rem' }}>Your appointment has been successfully logged.</p>
      </div>

      {/* 🧾 DIGITAL RECEIPT */}
      <div style={{ 
        background: '#fff', color: '#000', width: '100%', maxWidth: '500px', 
        borderRadius: 'var(--admin-radius-lg)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        overflow: 'hidden'
      }}>
        
        {/* Receipt Header */}
        <div style={{ background: '#000', color: '#fff', padding: '1rem 2rem', textAlign: 'center' }}>
          <div style={{ fontWeight: '950', fontSize: '0.8rem', letterSpacing: '2px', textTransform: 'uppercase' }}>Official Digital Receipt</div>
        </div>

        <div style={{ padding: '2rem' }}>
          {/* Brand */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2 style={{ margin: 0, fontWeight: '950', fontSize: '1.5rem', color: '#A91B18' }}>SPEEDWAY</h2>
            <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#666', textTransform: 'uppercase' }}>AutoxMoto Detail Studio</div>
            <div style={{ height: '2px', background: '#000', width: '40px', margin: '0.75rem auto' }} />
          </div>

          {/* Customer & Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div>
              <div style={labelStyle}>Customer</div>
              <div style={{ fontWeight: '900', fontSize: '0.9rem' }}>{bookingData.customerName}</div>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>{bookingData.contactNumber}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={labelStyle}>Date & Time</div>
              <div style={{ fontWeight: '900', fontSize: '0.9rem' }}>{bookingData.date}</div>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>{bookingData.time}</div>
            </div>
          </div>

          {/* Items Breakdown */}
          <div style={{ borderTop: '2px solid #eee', paddingTop: '1rem', marginBottom: '1.5rem' }}>
            <div style={labelStyle}>Service Summary</div>
            {bookingData.vehicles.map((v, idx) => (
              <div key={idx} style={{ marginBottom: '1rem' }}>
                <div style={{ fontWeight: '900', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  {v.brand} {v.model} ({v.type})
                </div>
                {v.services.map((s, sIdx) => (
                  <div key={sIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#444', marginBottom: '0.15rem', paddingLeft: '0.5rem' }}>
                    <span>• {s.name}</span>
                    <span style={{ fontWeight: '800' }}>₱{s.price?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Totals */}
          <div style={{ borderTop: '2px solid #000', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '950', fontSize: '1.1rem', textTransform: 'uppercase' }}>Total Amount</span>
              <span style={{ fontWeight: '950', fontSize: '1.1rem', color: '#A91B18' }}>₱{totalAmount.toLocaleString()}</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '0.25rem', textAlign: 'right', fontWeight: '700' }}>
              Payment Method: {bookingData.payment.method} ({bookingData.payment.type})
            </div>
          </div>

          {/* AI Verification Footer */}
          {bookingData.payment.method === 'GCash' && (
            <div style={{ marginTop: '2rem', padding: '1rem', background: '#f9f9f9', borderRadius: 'var(--admin-radius-sm)', border: '1px dashed #ddd', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--admin-success)', marginBottom: '0.25rem' }}>
                <CheckCircle2 size={16} />
                <span style={{ fontWeight: '950', fontSize: '0.8rem', textTransform: 'uppercase' }}>AI-Verified Reference</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#666', fontWeight: '800', fontFamily: 'monospace' }}>
                {bookingData.payment.ocrData?.referenceNo || 'LOGGED_TO_AUDIT'}
              </div>
            </div>
          )}
        </div>

        {/* Receipt Footer Buttons */}
        <div style={{ display: 'flex', borderTop: '1px solid #eee' }}>
          <button 
            onClick={() => window.print()}
            style={{ flex: 1, padding: '1rem', background: '#f5f5f5', border: 'none', borderRight: '1px solid #eee', fontWeight: '900', color: '#000', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <Printer size={16} /> Print
          </button>
          <button 
            onClick={() => navigate('/customer/dashboard')}
            style={{ flex: 1, padding: '1rem', background: '#000', border: 'none', fontWeight: '900', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            Dashboard <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem', fontWeight: '600', maxWidth: '400px', textAlign: 'center' }}>
        You can always view and download this receipt later from your <span style={{ color: 'var(--admin-brand)' }}>Transactions & Billing</span> section.
      </div>

    </div>
  );
};

export default BookingSuccess;
