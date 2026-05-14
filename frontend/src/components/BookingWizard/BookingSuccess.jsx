import React from 'react';
import { CheckCircle, Calendar, ShieldCheck, MapPin, ArrowRight, Printer, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BookingSuccess = ({ bookingData }) => {
  const navigate = useNavigate();
  
  const grandTotal = (bookingData.vehicles || []).reduce((sum, v) => 
    sum + (v.services || []).reduce((sSum, s) => sSum + (s.price || 0), 0)
  , 0) || bookingData.totalAmount || 0;

  const totalPaid = bookingData.payment?.method === 'Cash' ? 0 : 
    (bookingData.payment?.type === 'Downpayment' ? Math.ceil(grandTotal * 0.3) : grandTotal);
    
  const remainingBalance = Math.max(0, grandTotal - totalPaid);

  const isConfirmed = false; // Always provisional on the immediate success screen

  const labelStyle = { 
    fontSize: '0.65rem', 
    fontWeight: '950', 
    color: '#666', 
    textTransform: 'uppercase', 
    letterSpacing: '1px', 
    marginBottom: '0.2rem' 
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem', gap: '2rem' }}>
      
      {/* REQ-NFR-30: PRINT ISOLATION LOGIC */}
      <style>{`
        @media print {
          /* Only allow printing if confirmed */
          ${!isConfirmed ? 'body { display: none !important; }' : ''}
          
          body * { visibility: hidden; }
          #printable-receipt, #printable-receipt * { visibility: visible; }
          #printable-receipt { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
            max-width: none !important;
            box-shadow: none !important;
            border: 1px solid #000 !important;
          }
          .no-print { display: none !important; }
          @page { size: portrait; margin: 20mm; }
          h2 { font-size: 2.5rem !important; }
          .receipt-total { font-size: 1.5rem !important; }
          .receipt-ref { font-size: 1.2rem !important; }
        }
      `}</style>

      {/* Success Animation */}
      <div className="no-print" style={{ textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(var(--admin-success-rgb), 0.1)', marginBottom: '1rem' }}>
          <CheckCircle size={40} color="var(--admin-success)" />
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: '950', color: '#fff', margin: 0, textTransform: 'uppercase' }}>Booking Logged!</h1>
        <p style={{ color: 'var(--admin-text-secondary)', fontWeight: '600', marginTop: '0.5rem' }}>Your appointment is awaiting payment verification.</p>
      </div>

      {/* 🧾 DIGITAL RECEIPT */}
      <div id="printable-receipt" style={{ 
        background: '#fff', color: '#000', width: '100%', maxWidth: '500px', 
        borderRadius: 'var(--admin-radius-lg)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        overflow: 'hidden', position: 'relative'
      }}>
        
        {/* Provisional Watermark */}
        {!isConfirmed && (
          <div style={{ 
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-30deg)',
            fontSize: '4rem', fontWeight: '950', color: 'rgba(0,0,0,0.05)', pointerEvents: 'none',
            whiteSpace: 'nowrap', zIndex: 0, textTransform: 'uppercase'
          }}>
            Provisional
          </div>
        )}

        {/* Receipt Header */}
        <div style={{ background: '#000', color: '#fff', padding: '1rem 2rem', textAlign: 'center' }}>
          <div style={{ fontWeight: '950', fontSize: '0.8rem', letterSpacing: '2px', textTransform: 'uppercase' }}>
            {isConfirmed ? 'Official Digital Receipt' : 'Provisional Booking Receipt'}
          </div>
        </div>

        <div style={{ padding: '2rem', position: 'relative', zIndex: 1 }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <span style={{ fontWeight: '800', fontSize: '0.9rem', textTransform: 'uppercase', color: '#666' }}>Grand Total</span>
              <span style={{ fontWeight: '900', fontSize: '0.9rem' }}>₱{grandTotal.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontWeight: '800', fontSize: '0.9rem', textTransform: 'uppercase', color: '#666' }}>Total Amount Paid</span>
              <span style={{ fontWeight: '900', fontSize: '0.9rem' }}>₱{totalPaid.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #eee', paddingTop: '0.5rem' }}>
              <span style={{ fontWeight: '950', fontSize: '1.1rem', textTransform: 'uppercase' }}>Remaining Balance</span>
              <span className="receipt-total" style={{ fontWeight: '950', fontSize: '1.1rem', color: '#A91B18' }}>₱{remainingBalance.toLocaleString()}</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '0.5rem', textAlign: 'right', fontWeight: '700' }}>
              Payment Method: {bookingData.payment.method} {bookingData.payment.type ? `(${bookingData.payment.type})` : ''}
            </div>
          </div>

          {/* Reference Footer (PROFESSIONALIZED) */}
          {bookingData.payment.method === 'GCash' && (
            <div style={{ marginTop: '2rem', padding: '1rem', background: '#f9f9f9', borderRadius: 'var(--admin-radius-sm)', border: '1px solid #eee', textAlign: 'center' }}>
              <div style={{ color: 'var(--admin-text-secondary)', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '950', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Transaction Reference</span>
              </div>
              <div className="receipt-ref" style={{ fontSize: '0.85rem', color: '#000', fontWeight: '900', fontFamily: 'monospace' }}>
                {bookingData.payment.ocrData?.referenceNo || 'Awaiting Verification'}
              </div>
            </div>
          )}
        </div>

        {/* Receipt Footer Buttons (LOCKED UNTIL VERIFIED) */}
        <div className="no-print" style={{ display: 'flex', borderTop: '1px solid #eee' }}>
          <button 
            disabled={!isConfirmed}
            onClick={() => window.print()}
            style={{ 
              flex: 1, padding: '1rem', background: '#f5f5f5', border: 'none', borderRight: '1px solid #eee', 
              fontWeight: '900', color: isConfirmed ? '#000' : '#ccc', 
              cursor: isConfirmed ? 'pointer' : 'not-allowed', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' 
            }}
          >
            <Printer size={16} /> {isConfirmed ? 'Print Receipt' : 'Verification Pending'}
          </button>
          <button 
            onClick={() => navigate('/customer/dashboard')}
            style={{ flex: 1, padding: '1rem', background: '#000', border: 'none', fontWeight: '900', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            Dashboard <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {!isConfirmed && (
        <div className="no-print" style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem', fontWeight: '600', maxWidth: '400px', textAlign: 'center' }}>
          <AlertCircle size={14} style={{ verticalAlign: 'middle', marginRight: '4px', color: 'var(--admin-brand)' }} />
          Official receipt will be available for download once our staff verifies your payment reference.
        </div>
      )}

    </div>
  );
};

export default BookingSuccess;
