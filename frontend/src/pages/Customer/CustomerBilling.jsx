import React, { useState, useEffect } from 'react';
import { CreditCard, FileText, Clock, Printer } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import OfficialReceipt from '../../components/OfficialReceipt';

const CustomerBilling = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);

  useEffect(() => {
    if (user?.id) fetchData();
  }, [user?.id]);

  const fetchData = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, payments:payments!payments_booking_id_fkey(*), vehicles:booking_vehicles!booking_vehicles_booking_id_fkey(*, services:booking_vehicle_services!booking_vehicle_id(*))')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (err) {
      console.error('Error fetching billing data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val || 0);
  const getReceiptBreakdown = (receipt) => {
    const total = Number(receipt?.total_amount || 0);
    const subtotal = total > 0 ? total / 1.12 : 0;
    const vat = total > 0 ? total - subtotal : 0;
    return { subtotal, vat, total };
  };

  const totalSpent = bookings.reduce((sum, b) => {
    const totalPaid = (b.payments || []).filter(p => p.status === 'PAID').reduce((s, p) => s + Number(p.amount), 0);
    return sum + totalPaid;
  }, 0);

  const outstandingBalance = bookings.reduce((sum, b) => {
    if (['confirmed', 'scheduled', 'in_progress'].includes(b.status?.toLowerCase())) {
      const totalPaid = (b.payments || []).filter(p => p.status === 'PAID').reduce((s, p) => s + Number(p.amount), 0);
      return sum + Math.max(0, (b.total_amount || 0) - totalPaid);
    }
    return sum;
  }, 0);

  const labelStyle = {
    fontSize: '0.65rem',
    fontWeight: '950',
    color: 'var(--admin-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '0.5rem',
    display: 'block'
  };

  const canAccessReceipt = (booking) => {
    // REQ-ADM-10: Customers can access receipts if payment is PAID OR if refund is PROCESSED
    return (booking.payments || []).some(p => p.status === 'PAID') || booking.refund_status === 'PROCESSED';
  };

  const openReceipt = async (booking) => {
    if (!canAccessReceipt(booking)) return;
    setSelectedReceipt(booking);
  };

  const handlePrint = () => {
    toast.success('Receipt generated and synchronized with ledger.');
    window.print();
  };

  const handleDownloadPdf = () => {
    const receipt = selectedReceipt || {};
    const total = Number(selectedPayment?.amount || receipt.total_amount || 0);
    const subtotal = total > 0 ? total / 1.12 : 0;
    const vat = total > 0 ? total - subtotal : 0;
    const items = selectedPayment
      ? [{ name: 'Service Installment / Settlement Payment', amount: Number(selectedPayment.amount || 0) }]
      : (receipt.vehicles || []).flatMap((v) => (v.services || []).map((s) => ({
          name: s.service_name || s.service_name_snapshot || 'Service',
          amount: Number(s.price || s.price_snapshot || 0)
        })));

    const popup = window.open('', '_blank', 'width=900,height=900');
    if (!popup) {
      toast.error('Please allow pop-ups to download the PDF receipt.');
      return;
    }

    popup.document.write(`<!doctype html>
      <html>
        <head>
          <title>Official Digital Receipt</title>
          <style>
            body { font-family: Arial, sans-serif; background: #fff; color: #111; margin: 0; padding: 32px; }
            .wrap { max-width: 720px; margin: 0 auto; border: 1px solid #111; border-radius: 16px; padding: 24px; }
            .brand { text-align: center; margin-bottom: 24px; }
            h1 { margin: 0; font-size: 2.2rem; letter-spacing: 2px; color: #a91b18; }
            .subtitle { font-size: 12px; letter-spacing: 2px; color: #666; text-transform: uppercase; }
            .line { height: 2px; background: #000; width: 48px; margin: 12px auto 0; }
            .meta { display: flex; justify-content: space-between; gap: 16px; margin: 20px 0; }
            .meta div { flex: 1; }
            .label { font-size: 11px; font-weight: 800; color: #666; text-transform: uppercase; letter-spacing: 1px; }
            .item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
            .total-row { display: flex; justify-content: space-between; padding-top: 12px; font-weight: 800; }
            .balance { border-top: 2px solid #000; margin-top: 12px; padding-top: 12px; }
            .foot { text-align: center; margin-top: 24px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="wrap">
            <div class="brand">
              <h1>SPEEDWAY</h1>
              <div class="subtitle">AutoxMoto Detail Studio</div>
              <div class="line"></div>
            </div>
            <div class="meta">
              <div>
                <div class="label">Customer</div>
                <div>${receipt.customer_name || user?.user_metadata?.full_name || 'Valued Customer'}</div>
              </div>
              <div style="text-align:right;">
                <div class="label">Date & Time</div>
                <div>${new Date(selectedPayment?.created_at || receipt.created_at).toLocaleString()}</div>
              </div>
            </div>
            <div class="label" style="margin-bottom: 8px;">Service Summary</div>
            ${items.map(item => `<div class="item"><span>• ${item.name}</span><strong>${formatCurrency(item.amount)}</strong></div>`).join('')}
            <div class="total-row"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>
            <div class="total-row"><span>VAT (12%)</span><span>${formatCurrency(vat)}</span></div>
            <div class="total-row balance"><span>Grand Total</span><span>${formatCurrency(total)}</span></div>
            <div class="foot">Transaction Reference: ${selectedPayment?.reference_number || receipt.payments?.[0]?.reference_number || 'SYSTEM_VALIDATED'}</div>
          </div>
        </body>
      </html>
    `);
    popup.document.close();
    setTimeout(() => popup.print(), 300);
  };

  const getReceiptStatusText = (receipt) => {
    if (!receipt) return '';
    
    // REQ-ADM-10: Hardened check for refund state
    if (receipt.refund_status === 'PROCESSED') return 'REFUNDED & CLOSED';
    
    const paidAmount = (receipt.payments || []).filter(p => p.status === 'PAID').reduce((s, p) => s + Number(p.amount), 0);
    const remaining = Math.max(0, receipt.total_amount - paidAmount);
    
    if (!canAccessReceipt(receipt)) return 'AWAITING VERIFICATION';
    if (remaining <= 0) return 'PAID IN FULL';
    if (paidAmount > 0) return 'PARTIAL PAYMENT';
    return 'BALANCE DUE';
  };

  if (loading) return <div style={{ padding: '2rem', color: 'var(--admin-text-secondary)', fontWeight: '600' }}>Synchronizing financial records...</div>;

  const renderServiceRows = (receipt) => {
    if (receipt.vehicles && receipt.vehicles.length > 0) {
      return receipt.vehicles.map((v) => (
        <React.Fragment key={v.id}>
          <tr>
            <td colSpan="2" style={{ padding: '15px 5px 5px', fontWeight: 'bold', fontSize: '0.9rem', color: '#000' }}>
              {v.brand} {v.model} {v.plate_number ? `(${v.plate_number})` : ''}
            </td>
          </tr>
          {(v.services || []).map((s) => (
            <tr key={s.id}>
              <td style={{ padding: '5px 5px 5px 20px', fontSize: '0.85rem', color: '#333' }}>
                {s.service_name || s.service_name_snapshot}
              </td>
              <td style={{ padding: '5px 5px', textAlign: 'right', fontSize: '0.85rem', color: '#333' }}>
                {formatCurrency(s.price || s.price_snapshot)}
              </td>
            </tr>
          ))}
        </React.Fragment>
      ));
      
      return (
        <>
          {rows}
          {receipt.refund_status === 'PROCESSED' && (
            <tr>
              <td style={{ padding: '15px 5px', fontSize: '0.85rem', color: '#ef4444', fontWeight: '900', borderTop: '1px dashed #ef4444' }}>
                SYSTEM REFUND (Ref: {receipt.payments?.find(p => p.status === 'REFUNDED')?.reference_number || 'VOID'})
              </td>
              <td style={{ padding: '15px 5px', textAlign: 'right', fontSize: '0.85rem', color: '#ef4444', fontWeight: '900', borderTop: '1px dashed #ef4444' }}>
                {formatCurrency((receipt.payments || []).filter(p => p.status === 'REFUNDED').reduce((s, p) => s + Number(p.amount), 0))}
              </td>
            </tr>
          )}
        </>
      );
    } else {
      return (
        <tr>
          <td style={{ padding: '15px 5px', fontSize: '0.85rem', color: '#333' }}>
            Premium Detailing Package
          </td>
          <td style={{ padding: '15px 5px', textAlign: 'right', fontSize: '0.85rem', color: '#333' }}>
            {formatCurrency(receipt.total_amount)}
          </td>
        </tr>
      );
    }
  };

  return (
    <>
      {(selectedReceipt || selectedPayment) && (
        <OfficialReceipt
<<<<<<< HEAD
          booking={selectedReceipt}
          vehicles={selectedReceipt?.vehicles || []}
          user={user}
          selectedPayment={selectedPayment}
          onClose={() => { setSelectedReceipt(null); setSelectedPayment(null); }}
          mode="modal"
=======
          title="OFFICIAL RECEIPT"
          receiptNumber={selectedPayment?.reference_number || selectedReceipt?.payments?.[0]?.reference_number || `INV-${(selectedReceipt?.id || '').slice(0, 8).toUpperCase()}`}
          bookingReference={selectedReceipt?.id || 'BOOKING-NOT-SET'}
          issuedAt={selectedPayment?.created_at || selectedReceipt?.created_at || new Date().toISOString()}
          paymentMethod={selectedPayment?.method || selectedReceipt?.payments?.[0]?.method || 'Digital / Online Payment'}
          processedBy="System Admin"
          customerName={selectedReceipt?.customer_name || user?.user_metadata?.full_name || 'Valued Customer'}
          customerContact={user?.email || selectedReceipt?.customer_phone || '-'}
          customerAddress={selectedReceipt?.customer_address || '-'}
          customerTaxId={selectedReceipt?.customer_tax_id || '-'}
          items={selectedPayment ? [{
            vehicle: 'Payment Record',
            service: 'Service Installment / Settlement Payment',
            qty: 1,
            unitPrice: Number(selectedPayment.amount || 0),
            lineTotal: Number(selectedPayment.amount || 0)
          }] : (selectedReceipt?.vehicles?.flatMap((v) => (v.services || []).map((s) => ({
            vehicle: `${v.brand || ''} ${v.model || ''}`.trim() || 'Vehicle Unit',
            service: s.service_name || s.service_name_snapshot || 'Service',
            qty: 1,
            unitPrice: Number(s.price || s.price_snapshot || 0),
            lineTotal: Number(s.price || s.price_snapshot || 0)
          }))) ?? [{
            vehicle: 'Booking Summary',
            service: 'Booking Service Summary',
            qty: 1,
            unitPrice: Number(selectedReceipt?.total_amount || 0),
            lineTotal: Number(selectedReceipt?.total_amount || 0)
          }])}
          subtotal={Number((selectedPayment?.amount || selectedReceipt?.total_amount || 0) / 1.12)}
          discountAmount={0}
          vatRate={0.12}
          onClose={() => { setSelectedReceipt(null); setSelectedPayment(null); }}
          showCloseButton
>>>>>>> e23099d5 (Logic inconsistencies still exists)
        />
      )}

      {/* 📱 SCREEN UI */}
      <div id="screen-billing-content" style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', paddingBottom: '5rem' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.5rem)', fontWeight: '950', margin: '0 0 0.5rem 0', textTransform: 'uppercase', color: 'var(--admin-text-primary)', letterSpacing: '-1.5px' }}>Billing & Invoices</h1>
          <p style={{ margin: 0, color: 'var(--admin-text-secondary)', fontSize: '0.95rem', fontWeight: '600', opacity: 0.8 }}>
            Operational ledger and digital archives of your DETAILING sessions.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          <div style={{ background: 'var(--admin-card)', padding: '1.5rem', borderRadius: 'var(--admin-radius)', border: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center', gap: '1.5rem', boxShadow: 'var(--admin-card-shadow)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(var(--admin-brand-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(var(--admin-brand-rgb), 0.2)' }}>
              <CreditCard size={28} color="var(--admin-brand)" />
            </div>
            <div>
              <div style={labelStyle}>Total Invested</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>{formatCurrency(totalSpent)}</div>
            </div>
          </div>

          <div style={{ background: 'var(--admin-card)', padding: '1.5rem', borderRadius: 'var(--admin-radius)', border: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center', gap: '1.5rem', boxShadow: 'var(--admin-card-shadow)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <Clock size={28} color="#f59e0b" />
            </div>
            <div>
              <div style={labelStyle}>Pending Balance</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>{formatCurrency(outstandingBalance)}</div>
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--admin-card)', borderRadius: 'var(--admin-radius)', border: '1px solid var(--admin-border)', overflow: 'hidden', boxShadow: 'var(--admin-card-shadow)' }}>
          <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--admin-border)', background: 'var(--admin-input-bg)' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '950', color: 'var(--admin-text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Transaction Ledger</h3>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--admin-bg)', borderBottom: '1px solid var(--admin-border)' }}>
                  <th style={{ padding: '1.25rem 2rem', fontSize: '0.7rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Reference</th>
                  <th style={{ padding: '1.25rem 2rem', fontSize: '0.7rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Verification Date</th>
                  <th style={{ padding: '1.25rem 2rem', fontSize: '0.7rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Net Amount</th>
                  <th style={{ padding: '1.25rem 2rem', fontSize: '0.7rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Status</th>
                  <th style={{ padding: '1.25rem 2rem', fontSize: '0.7rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: '4rem', textAlign: 'center', color: 'var(--admin-text-secondary)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>No records in the current pipeline.</td>
                  </tr>
                ) : (
                  bookings.flatMap((booking) => {
                    const accessible = canAccessReceipt(booking);
                    const bookingPayments = (booking.payments || []).filter(p => p.status === 'PAID');
                    
                    return bookingPayments.map((p, pIdx) => (
                      <tr key={p.id} className="admin-card-hover" style={{ borderBottom: '1px solid var(--admin-border)', transition: 'all 0.2s ease' }}>
                        <td style={{ padding: '1.25rem 2rem', fontSize: '0.95rem', fontWeight: '900', color: 'var(--admin-text-primary)', fontFamily: 'monospace' }}>
                          RCP-{p.id.substring(0, 8).toUpperCase()}
                          <div style={{ fontSize: '0.6rem', color: 'var(--admin-brand)', fontWeight: '950', marginTop: '0.2rem' }}>LINKED TO INV-{booking.id.substring(0, 8).toUpperCase()}</div>
                        </td>
                        <td style={{ padding: '1.25rem 2rem', fontSize: '0.85rem', fontWeight: '700', color: 'var(--admin-text-secondary)' }}>
                          {new Date(p.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td style={{ padding: '1.25rem 2rem', fontSize: '1.1rem', fontWeight: '950', color: 'var(--admin-brand)' }}>
                          {formatCurrency(p.amount)}
                        </td>
                        <td style={{ padding: '1.25rem 2rem' }}>
                          <span style={{ 
                            fontSize: '0.65rem', fontWeight: '950', 
                            background: 'rgba(16, 185, 129, 0.1)',
                            color: '#10b981',
                            padding: '0.3rem 0.75rem', borderRadius: '4px', textTransform: 'uppercase', border: '1px solid currentColor'
                          }}>
                            {pIdx === 0 ? 'DOWNPAYMENT' : 'SETTLEMENT'}
                          </span>
                        </td>
                        <td style={{ padding: '1.25rem 2rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            <button 
                              onClick={() => { setSelectedReceipt(booking); setSelectedPayment(p); }}
                              title="View Transaction Receipt"
                              style={{ 
                                background: 'var(--admin-input-bg)', border: '1px solid var(--admin-border)',
                                color: 'var(--admin-text-primary)', borderRadius: '8px', width: '40px', height: '40px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                              }}
                            >
                              <Printer size={18} />
                            </button>
                            <button 
                              onClick={() => { setSelectedReceipt(booking); setSelectedPayment(null); }}
                              title="View Consolidated Invoice"
                              style={{ 
                                background: 'rgba(var(--admin-brand-rgb), 0.1)', border: '1px solid var(--admin-brand)', 
                                color: 'var(--admin-brand)', borderRadius: '8px', width: '40px', height: '40px', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                              }}
                            >
                              <FileText size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ));
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

<<<<<<< HEAD
        {/* Second receipt view removed — handled by OfficialReceipt above */}
=======
        {selectedReceipt && (
          <OfficialReceipt
            title="OFFICIAL RECEIPT"
            receiptNumber={selectedPayment?.reference_number || selectedReceipt?.payments?.[0]?.reference_number || `INV-${(selectedReceipt?.id || '').slice(0, 8).toUpperCase()}`}
            bookingReference={selectedReceipt?.id || 'BOOKING-NOT-SET'}
            issuedAt={selectedPayment?.created_at || selectedReceipt?.created_at || new Date().toISOString()}
            paymentMethod={selectedPayment?.method || selectedReceipt?.payments?.[0]?.method || 'Digital / Online Payment'}
            processedBy="System Admin"
            customerName={selectedReceipt?.customer_name || user?.user_metadata?.full_name || 'Valued Customer'}
            customerContact={user?.email || selectedReceipt?.customer_phone || '-'}
            customerAddress={selectedReceipt?.customer_address || '-'}
            customerTaxId={selectedReceipt?.customer_tax_id || '-'}
            items={selectedPayment ? [{
              vehicle: 'Payment Record',
              service: 'Service Installment / Settlement Payment',
              qty: 1,
              unitPrice: Number(selectedPayment.amount || 0),
              lineTotal: Number(selectedPayment.amount || 0)
            }] : (selectedReceipt?.vehicles?.flatMap((v) => (v.services || []).map((s) => ({
              vehicle: `${v.brand || ''} ${v.model || ''}`.trim() || 'Vehicle Unit',
              service: s.service_name || s.service_name_snapshot || 'Service',
              qty: 1,
              unitPrice: Number(s.price || s.price_snapshot || 0),
              lineTotal: Number(s.price || s.price_snapshot || 0)
            }))) ?? [{
              vehicle: 'Booking Summary',
              service: 'Booking Service Summary',
              qty: 1,
              unitPrice: Number(selectedReceipt?.total_amount || 0),
              lineTotal: Number(selectedReceipt?.total_amount || 0)
            }])}
            subtotal={Number((selectedPayment?.amount || selectedReceipt?.total_amount || 0) / 1.12)}
            discountAmount={0}
            vatRate={0.12}
            onClose={() => { setSelectedReceipt(null); setSelectedPayment(null); }}
            showCloseButton
          />
        )}
>>>>>>> e23099d5 (Logic inconsistencies still exists)
      </div>

      {/* 🖨️ PRINT-ONLY CSS ENGINE */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-receipt, #printable-receipt * { visibility: visible; }
          #printable-receipt { position: absolute; left: 0; top: 0; width: 100%; background: #fff !important; color: #000 !important; }
          .no-print, .header-close-button, .action-buttons-container { display: none !important; }
          .price-column { font-variant-numeric: tabular-nums; text-align: right; }
          .invoice-content { page-break-inside: avoid; }
          @page { size: letter; margin: 0.5in; }
        }
      `}</style>
    </>
  );
};

export default CustomerBilling;
