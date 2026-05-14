import React, { useState, useEffect } from 'react';
import { CreditCard, FileText, Download, Clock, X, ShieldCheck, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

const CustomerBilling = () => {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUser(session.user);

      const { data, error } = await supabase
        .from('bookings')
        .select('*, payments(*), vehicles:booking_vehicles(*, services:booking_vehicle_services(*))')
        .eq('customer_id', session.user.id)
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
      {/* 🧾 OFFICIAL RECEIPT EXPLORER */}
      {(selectedReceipt || selectedPayment) && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '2rem' }}>
          <div className="no-print-bg" style={{ background: '#fff', color: '#000', width: '100%', maxWidth: '600px', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.5)', position: 'relative' }}>
            
            <div className="no-print" style={{ background: '#000', color: '#fff', padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <ShieldCheck size={24} color="var(--admin-brand)" />
                <span style={{ fontWeight: '950', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '0.9rem' }}>
                  {selectedPayment ? 'Official Receipt (Verified)' : 'Official Invoice (Consolidated)'}
                </span>
              </div>
              <button onClick={() => { setSelectedReceipt(null); setSelectedPayment(null); }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>

            <div id="printable-receipt" style={{ padding: '2.5rem', maxHeight: '70vh', overflowY: 'auto', position: 'relative', zIndex: 1 }}>
              {(selectedReceipt.refund_status === 'PROCESSED' || selectedPayment?.status === 'REFUNDED') && (
                <div style={{
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-45deg)',
                  fontSize: '8rem', fontWeight: '900', color: 'rgba(239, 68, 68, 0.08)', pointerEvents: 'none', zIndex: 0, whiteSpace: 'nowrap'
                }}>
                  VOID / REFUNDED
                </div>
              )}
              <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                <h2 style={{ margin: 0, fontWeight: '950', fontSize: '1.75rem', color: '#000', fontStyle: 'italic' }}>SPEEDWAY</h2>
                <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#666', textTransform: 'uppercase', letterSpacing: '2px' }}>AutoxMoto Detail Studio</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: '950', color: '#999', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Billed To</div>
                  <div style={{ fontWeight: '900', fontSize: '1.1rem' }}>{selectedReceipt.customer_name || user?.user_metadata?.full_name || 'Valued Customer'}</div>
                  <div style={{ fontSize: '0.85rem', color: '#666' }}>{user?.email}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: '950', color: '#999', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>{selectedPayment ? 'Receipt No.' : 'Invoice No.'}</div>
                  <div style={{ fontWeight: '900', fontSize: '1.1rem', color: '#000', fontFamily: 'monospace' }}>
                    {selectedPayment ? `RCP-${selectedPayment.id.substring(0, 8).toUpperCase()}` : `INV-${selectedReceipt.id.substring(0, 8).toUpperCase()}`}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#666' }}>{new Date(selectedPayment?.created_at || selectedReceipt.created_at).toLocaleDateString()}</div>
                </div>
              </div>

              <div style={{ borderTop: '2px solid #000', borderBottom: '2px solid #000', padding: '1.5rem 0', margin: '2rem 0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {selectedPayment ? (
                      <tr>
                        <td style={{ padding: '15px 5px', fontSize: '0.9rem', fontWeight: '900' }}>
                          Service Installment / Settlement
                          <div style={{ fontSize: '0.7rem', color: '#666', fontWeight: 'normal' }}>Payment for booking #{selectedReceipt.id.substring(0, 8).toUpperCase()}</div>
                        </td>
                        <td style={{ padding: '15px 5px', textAlign: 'right', fontSize: '1.1rem', fontWeight: '950' }}>
                          {formatCurrency(selectedPayment.amount)}
                        </td>
                      </tr>
                    ) : (
                      renderServiceRows(selectedReceipt)
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', gap: '2.5rem', width: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ color: '#999', fontSize: '0.85rem', fontWeight: '800' }}>{selectedPayment ? 'PAYMENT RECEIVED' : 'GRAND TOTAL'}</span>
                  <span style={{ fontWeight: '900', fontSize: '1.25rem' }}>{formatCurrency(selectedPayment?.amount || selectedReceipt.total_amount)}</span>
                </div>
                {!selectedPayment && (
                  <>
                    <div style={{ display: 'flex', gap: '2.5rem', width: '100%', justifyContent: 'flex-end' }}>
                      <span style={{ color: '#999', fontSize: '0.85rem', fontWeight: '800' }}>TOTAL SETTLED</span>
                      <span style={{ fontWeight: '900' }}>
                        {formatCurrency((selectedReceipt.payments || []).filter(p => p.status === 'PAID').reduce((s, p) => s + Number(p.amount), 0))}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '2.5rem', width: '100%', justifyContent: 'flex-end', borderTop: '2px solid #000', paddingTop: '0.75rem' }}>
                      <span style={{ fontWeight: '950', fontSize: '1.25rem' }}>OUTSTANDING</span>
                      <span style={{ fontWeight: '950', fontSize: '1.25rem' }}>
                        {formatCurrency(Math.max(0, (selectedReceipt.total_amount || 0) - (selectedReceipt.payments || []).filter(p => p.status === 'PAID').reduce((s, p) => s + Number(p.amount), 0)))}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div style={{ padding: '1.25rem', background: '#f9f9f9', borderRadius: '12px', border: '1px solid #eee' }}>
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div>
                      <div style={{ fontSize: '0.65rem', fontWeight: '900', color: '#999', textTransform: 'uppercase' }}>Method</div>
                      <div style={{ fontWeight: '800', fontSize: '0.85rem' }}>{selectedPayment?.method || selectedReceipt.payments?.[0]?.method || 'Verified Channel'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: '900', color: '#999', textTransform: 'uppercase' }}>Reference</div>
                      <div style={{ fontWeight: '800', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                        {selectedPayment?.reference_number || 'VALIDATED'}
                      </div>
                    </div>
                 </div>
              </div>

              <div style={{ textAlign: 'center', color: '#666', fontSize: '0.65rem', marginTop: '60px', fontWeight: '300' }}>
                This is a computer-generated document from Speedway AutoXMoto.
              </div>
            </div>

            <div className="no-print" style={{ padding: '1.5rem 2rem', background: '#f5f5f5', display: 'flex', gap: '1rem' }}>
              <button 
                onClick={() => window.print()}
                style={{ 
                  flex: 2, padding: '1rem', background: '#000', 
                  color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '950', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', 
                  cursor: 'pointer', 
                  textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px' 
                }}
              >
                <Printer size={20} /> Print Receipt
              </button>
              <button 
                onClick={() => { setSelectedReceipt(null); setSelectedPayment(null); }}
                style={{ flex: 1, padding: '1rem', background: '#fff', color: '#000', border: '1px solid #ddd', borderRadius: '12px', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase', fontSize: '0.85rem' }}
              >
                Close
              </button>
            </div>
          </div>
          <style>{`
            @media print {
              body * { visibility: hidden; }
              #printable-receipt, #printable-receipt * { visibility: visible; }
              #printable-receipt { position: absolute; left: 0; top: 0; width: 100%; }
              .no-print, .modal-overlay { background: white !important; }
            }
          `}</style>
        </div>
      )}

      {/* 📱 SCREEN UI */}
      <div id="screen-billing-content" style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', paddingBottom: '5rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '950', margin: '0 0 0.5rem 0', textTransform: 'uppercase', color: 'white', letterSpacing: '-1.5px' }}>Billing & Invoices</h1>
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
              <div style={{ fontSize: '1.75rem', fontWeight: '950', color: 'white' }}>{formatCurrency(totalSpent)}</div>
            </div>
          </div>

          <div style={{ background: 'var(--admin-card)', padding: '1.5rem', borderRadius: 'var(--admin-radius)', border: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center', gap: '1.5rem', boxShadow: 'var(--admin-card-shadow)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <Clock size={28} color="#f59e0b" />
            </div>
            <div>
              <div style={labelStyle}>Pending Balance</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '950', color: 'white' }}>{formatCurrency(outstandingBalance)}</div>
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--admin-card)', borderRadius: 'var(--admin-radius)', border: '1px solid var(--admin-border)', overflow: 'hidden', boxShadow: 'var(--admin-card-shadow)' }}>
          <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--admin-border)', background: 'rgba(255,255,255,0.02)' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '950', color: 'white', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Transaction Ledger</h3>
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
                        <td style={{ padding: '1.25rem 2rem', fontSize: '0.95rem', fontWeight: '900', color: 'white', fontFamily: 'monospace' }}>
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
                                background: 'rgba(255,255,255,0.03)', border: '1px solid var(--admin-border)', 
                                color: 'white', borderRadius: '8px', width: '40px', height: '40px', 
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

        {/* 🧾 RECEIPT PREVIEW MODAL */}
        {selectedReceipt && (
          <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem' }}>
            <div style={{ background: '#fff', color: '#000', width: '100%', maxWidth: '600px', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.5)', position: 'relative' }}>
              
              <div style={{ background: '#000', color: '#fff', padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <ShieldCheck size={24} color="var(--admin-brand)" />
                  <span style={{ fontWeight: '950', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '0.9rem' }}>
                    {canAccessReceipt(selectedReceipt) ? 'Official Receipt Explorer' : 'Provisional Preview'}
                  </span>
                </div>
                <button onClick={() => setSelectedReceipt(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: '2.5rem', maxHeight: '70vh', overflowY: 'auto', position: 'relative', zIndex: 1 }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                  <h2 style={{ margin: 0, fontWeight: '950', fontSize: '1.75rem', color: '#000', fontStyle: 'italic' }}>SPEEDWAY</h2>
                  <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#666', textTransform: 'uppercase', letterSpacing: '2px' }}>AutoxMoto Detail Studio</div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                  <div>
                    <div style={{ ...labelStyle, color: '#999' }}>Invoice To</div>
                    <div style={{ fontWeight: '900', fontSize: '1.1rem' }}>{selectedReceipt.customer_name || user?.user_metadata?.full_name || 'Customer'}</div>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>{user?.email}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ ...labelStyle, color: '#999' }}>Receipt No.</div>
                    <div style={{ fontWeight: '900', fontSize: '1.1rem', color: '#000', fontFamily: 'monospace' }}>INV-{selectedReceipt.id.substring(0, 8).toUpperCase()}</div>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>{new Date(selectedReceipt.created_at).toLocaleDateString()}</div>
                  </div>
                </div>

                <div style={{ borderTop: '2px solid #000', borderBottom: '2px solid #000', padding: '1.5rem 0', margin: '2rem 0' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {renderServiceRows(selectedReceipt)}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
                  <div style={{ display: 'flex', gap: '2.5rem', width: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ color: '#999', fontSize: '0.85rem', fontWeight: '800' }}>GRAND TOTAL</span>
                    <span style={{ fontWeight: '900' }}>{formatCurrency(selectedReceipt.total_amount)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '2.5rem', width: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ color: '#999', fontSize: '0.85rem', fontWeight: '800' }}>TOTAL AMOUNT PAID</span>
                    <span style={{ fontWeight: '900' }}>
                      {formatCurrency((selectedReceipt.payments || []).filter(p => p.status === 'PAID').reduce((s, p) => s + Number(p.amount), 0))}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '2.5rem', width: '100%', justifyContent: 'flex-end', borderTop: '2px solid #000', paddingTop: '0.75rem' }}>
                    <span style={{ fontWeight: '950', fontSize: '1.25rem' }}>REMAINING BALANCE</span>
                    <span style={{ fontWeight: '950', fontSize: '1.25rem', color: '#000' }}>
                      {formatCurrency(Math.max(0, selectedReceipt.total_amount - (selectedReceipt.payments || []).filter(p => p.status === 'PAID').reduce((s, p) => s + Number(p.amount), 0)))}
                    </span>
                  </div>
                </div>

                <div style={{ padding: '1.25rem', background: '#f9f9f9', borderRadius: '12px', border: '1px solid #eee' }}>
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      <div>
                        <div style={{ fontSize: '0.65rem', fontWeight: '900', color: '#999', textTransform: 'uppercase' }}>Method</div>
                        <div style={{ fontWeight: '800', fontSize: '0.85rem' }}>{selectedReceipt.payments?.[0]?.method || 'Cash / Off-platform'}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: '900', color: '#999', textTransform: 'uppercase' }}>Transaction Reference</div>
                        <div style={{ fontWeight: '800', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                          {canAccessReceipt(selectedReceipt) 
                            ? (selectedReceipt.payments?.[0]?.reference_number || selectedReceipt.ocr_metadata?.referenceNo || 'VERIFIED')
                            : 'Awaiting Verification'}
                        </div>
                      </div>
                   </div>
                   <div style={{ marginTop: '15px', textAlign: 'center', fontSize: '1rem', fontWeight: '900', color: '#000', textTransform: 'uppercase', letterSpacing: '2px' }}>
                     *** {getReceiptStatusText(selectedReceipt)} ***
                   </div>
                </div>
              </div>

              <div className="no-print" style={{ padding: '1.5rem 2rem', background: '#f5f5f5', display: 'flex', gap: '1rem' }}>
                <button 
                  disabled={!canAccessReceipt(selectedReceipt)}
                  onClick={handlePrint}
                  style={{ 
                    flex: 2, padding: '1rem', background: canAccessReceipt(selectedReceipt) ? '#000' : '#ccc', 
                    color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '950', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', 
                    cursor: canAccessReceipt(selectedReceipt) ? 'pointer' : 'not-allowed', 
                    textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px' 
                  }}
                >
                  <Printer size={20} /> {canAccessReceipt(selectedReceipt) ? 'Print Official Receipt' : 'Locked'}
                </button>
                <button 
                  onClick={() => setSelectedReceipt(null)}
                  style={{ flex: 1, padding: '1rem', background: '#fff', color: '#000', border: '1px solid #ddd', borderRadius: '12px', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase', fontSize: '0.85rem' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 🖨️ PRINT-ONLY CSS ENGINE */}
      <style>{`
        @media print {
          html, body, #root, .admin-theme, .admin-main-wrapper, main { 
            background: white !important; 
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            overflow: visible !important;
          }

          nav, aside, header, button, .no-print, [role="navigation"], #screen-billing-content, .modal-overlay {
            display: none !important;
          }

          #printable-receipt {
            display: block !important;
            visibility: visible !important;
            width: 100% !important;
            max-width: 800px !important;
            margin: 0 auto !important;
            padding: 10mm !important;
            background: white !important;
            position: relative !important;
            z-index: 9999 !important;
            box-sizing: border-box !important;
          }

          #printable-receipt * {
            visibility: visible !important;
            color: black !important;
          }

          @page { 
            size: auto;
            margin: 0mm; 
          }
          
          * { 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
          }
        }
      `}</style>
    </>
  );
};

export default CustomerBilling;
