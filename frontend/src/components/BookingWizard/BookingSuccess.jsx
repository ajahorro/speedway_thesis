import React from 'react';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OfficialReceipt from '../OfficialReceipt';

const BookingSuccess = ({ bookingData }) => {
  const navigate = useNavigate();

  const grandTotal = (bookingData.vehicles || []).reduce((sum, v) =>
    sum + (v.services || []).reduce((sSum, s) => sSum + (s.price || 0), 0), 0
  ) || bookingData.totalAmount || 0;

  const totalPaid = bookingData.payment?.method === 'Cash'
    ? grandTotal
    : (bookingData.payment?.type === 'Downpayment' ? Math.ceil(grandTotal * 0.3) : grandTotal);

  const subtotal = grandTotal > 0 ? grandTotal / 1.12 : 0;
  const vat = grandTotal > 0 ? grandTotal - subtotal : 0;
  const remainingBalance = Math.max(0, grandTotal - totalPaid);

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
      <div className="no-print" style={{ textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(var(--admin-success-rgb), 0.1)', marginBottom: '1rem' }}>
          <CheckCircle size={40} color="var(--admin-success)" />
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: '950', color: '#fff', margin: 0, textTransform: 'uppercase' }}>Booking Logged!</h1>
        <p style={{ color: 'var(--admin-text-secondary)', fontWeight: '600', marginTop: '0.5rem' }}>Your appointment has been saved and a digital receipt is ready.</p>
      </div>

      <OfficialReceipt
        title="OFFICIAL RECEIPT"
        receiptNumber={bookingData.payment?.ocrData?.referenceNo || `AUTO-${Date.now().toString().slice(-6)}`}
        bookingReference={bookingData.bookingId || bookingData.reference || 'BOOKING-NOT-SET'}
        issuedAt={new Date().toISOString()}
        paymentMethod={bookingData.payment?.method || 'Digital / Online Payment'}
        processedBy="System Admin"
        customerName={bookingData.customerName || 'Customer'}
        customerContact={bookingData.contactNumber || bookingData.email || '-'}
        customerAddress={bookingData.address || '-'}
        customerTaxId="-"
        items={(bookingData.vehicles || []).flatMap((v) => (v.services || []).map((s) => ({
          vehicle: `${v.brand || ''} ${v.model || ''}`.trim() || 'Vehicle Unit',
          service: s.name || s.service_name || 'Service',
          qty: 1,
          unitPrice: Number(s.price || 0),
          lineTotal: Number(s.price || 0)
        })))}
        subtotal={subtotal}
        discountAmount={0}
        vatRate={0.12}
        onClose={() => navigate('/customer')}
        showCloseButton={false}
      />
    </div>
  );
};

export default BookingSuccess;
