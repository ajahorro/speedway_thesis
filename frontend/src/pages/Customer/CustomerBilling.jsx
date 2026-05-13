import React, { useState, useEffect } from 'react';
import { CreditCard, FileText, Download, Clock, X, CheckCircle2, ShieldCheck, Printer, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const CustomerBilling = () => {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
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
        .select('*, payments(*)')
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

  const totalSpent = bookings.reduce((sum, b) => {
    const totalPaid = (b.payments || []).filter(p => p.status === 'PAID').reduce((s, p) => s + Number(p.amount), 0);
    return sum + totalPaid;
  }, 0);

  const outstandingBalance = bookings.reduce((sum, b) => {
    if (['confirmed', 'scheduled', 'ongoing', 'in_progress'].includes(b.status)) {
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
    return (booking.payments || []).some(p => p.status === 'PAID');
  };

  const openReceipt = async (booking) => {
    if (!canAccessReceipt(booking)) return;
    
    // In a real production system, we'd fetch the official secure data from the backend here
    // For the thesis demo, we already have the booking object, but we'll simulate the secure check
    setSelectedReceipt(booking);
  };

  if (loading) return <div style={{ padding: '2rem', color: 'var(--admin-text-secondary)', fontWeight: '600' }}>Synchronizing financial records...</div>;

  return (
    <>
      {/* 🖨️ DEDICATED PRINT TEMPLATE (Hidden on Screen) */}
      {selectedReceipt && (
        <div id="printable-receipt" style={{ display: 'none' }}>
          {/* Watermark Overlay (Security Fallback) */}
          {!canAccessReceipt(selectedReceipt) && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, pointerEvents: 'none', opacity: 0.1 }}>
              <div style={{ fontSize: '10rem', fontWeight: '950', border: '20px solid red', color: 'red', padding: '2rem', transform: 'rotate(-45deg)', borderRadius: '40px' }}>
                VOID
              </div>
            </div>
          )}

          <div style={{ textAlign: 'center', borderBottom: '4px solid #A91B18', paddingBottom: '20px', marginBottom: '30px' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '950', color: 'black', margin: 0, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '-2px' }}>
              SPEEDWAY<span style={{ color: '#A91B18' }}>AUTOXMOTO</span>
            </h1>
            <p style={{ margin: '5px 0', fontSize: '0.9rem', fontWeight: '900', color: '#000', textTransform: 'uppercase', letterSpacing: '3px' }}>
              {canAccessReceipt(selectedReceipt) ? 'Official Detailing Receipt' : 'PROVISIONAL / UNVERIFIED BILLING'}
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: '950', color: '#666', textTransform: 'uppercase', marginBottom: '5px' }}>Invoice To</div>
              <div style={{ fontSize: '1.2rem', fontWeight: '900', color: 'black' }}>{selectedReceipt.customer_name || user?.user_metadata?.full_name || 'Valued Customer'}</div>
              <div style={{ fontSize: '0.9rem', color: '#444' }}>{user?.email}</div>
            </div>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: '950', color: '#666', textTransform: 'uppercase', marginBottom: '5px' }}>Receipt Details</div>
              <div style={{ fontSize: '1.2rem', fontWeight: '900', color: '#A91B18', fontFamily: 'monospace' }}>INV-{selectedReceipt.id.substring(0, 8).toUpperCase()}</div>
              <div style={{ fontSize: '0.9rem', color: '#444', fontWeight: '700' }}>Date: {new Date(selectedReceipt.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
            </div>
          </div>

          <div style={{ border: '2px solid #000', borderRadius: '12px', overflow: 'hidden', marginBottom: '40px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#000', color: '#fff' }}>
                  <th style={{ padding: '15px', textAlign: 'left', fontSize: '0.8rem', textTransform: 'uppercase' }}>Description</th>
                  <th style={{ padding: '15px', textAlign: 'right', fontSize: '0.8rem', textTransform: 'uppercase' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '20px', borderBottom: '1px solid #eee' }}>
                    <div style={{ fontWeight: '900', fontSize: '1.1rem' }}>Premium Detailing Package</div>
                    <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '5px' }}>Professional fleet maintenance service and paint protection.</div>
                  </td>
                  <td style={{ padding: '20px', textAlign: 'right', fontWeight: '950', fontSize: '1.1rem', borderBottom: '1px solid #eee' }}>
                    ₱{selectedReceipt.total_amount.toLocaleString()}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ padding: '20px', textAlign: 'right', fontWeight: '900', fontSize: '1rem', color: '#666' }}>SUBTOTAL</td>
                  <td style={{ padding: '20px', textAlign: 'right', fontWeight: '900', fontSize: '1rem' }}>₱{selectedReceipt.total_amount.toLocaleString()}</td>
                </tr>
                <tr style={{ background: '#f9f9f9' }}>
                  <td style={{ padding: '20px', textAlign: 'right', fontWeight: '950', fontSize: '1.5rem' }}>TOTAL PAID</td>
                  <td style={{ padding: '20px', textAlign: 'right', fontWeight: '950', fontSize: '1.5rem', color: '#A91B18' }}>₱{selectedReceipt.total_amount.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* 💹 STANDARD PAYMENT FOOTER (REPLACED AI BRANDING) */}
          <div style={{ background: '#fff', padding: '25px', borderRadius: '12px', border: '2px solid #eee', marginBottom: '40px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: '950', color: '#999', textTransform: 'uppercase', marginBottom: '4px' }}>Payment Method</div>
                <div style={{ fontWeight: '900', fontSize: '1rem', color: 'black' }}>{selectedReceipt.payments?.[0]?.method || 'GCash'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: '950', color: '#999', textTransform: 'uppercase', marginBottom: '4px' }}>Transaction Reference</div>
                <div style={{ fontWeight: '900', fontSize: '1rem', color: 'black', fontFamily: 'monospace' }}>
                  {canAccessReceipt(selectedReceipt) 
                    ? (selectedReceipt.payments?.[0]?.reference_number || selectedReceipt.ocr_metadata?.referenceNo || 'VERIFIED')
                    : 'Awaiting Verification'}
                </div>
              </div>
              <div style={{ marginTop: '10px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: '950', color: '#999', textTransform: 'uppercase', marginBottom: '4px' }}>Transaction Status</div>
                <div style={{ fontWeight: '950', fontSize: '1rem', color: canAccessReceipt(selectedReceipt) ? '#10b981' : '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {canAccessReceipt(selectedReceipt) ? <CheckCircle size={16} /> : <Clock size={16} />}
                  {canAccessReceipt(selectedReceipt) ? 'SETTLED / PAID' : 'AWAITING VERIFICATION'}
                </div>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', color: '#999', fontSize: '0.75rem', marginTop: '100px', borderTop: '1px dashed #ccc', paddingTop: '20px' }}>
            This is an official computer-generated document from Speedway AutoXMoto. &bull; No signature required.
          </div>
        </div>
      )}

      {/* 📱 SCREEN UI */}
      <div id="screen-billing-content" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '5rem' }}>
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
              <div style={{ fontSize: '1.75rem', fontWeight: '950', color: 'white' }}>₱{totalSpent.toLocaleString()}</div>
            </div>
          </div>

          <div style={{ background: 'var(--admin-card)', padding: '1.5rem', borderRadius: 'var(--admin-radius)', border: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center', gap: '1.5rem', boxShadow: 'var(--admin-card-shadow)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <Clock size={28} color="#f59e0b" />
            </div>
            <div>
              <div style={labelStyle}>Pending Balance</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '950', color: 'white' }}>₱{outstandingBalance.toLocaleString()}</div>
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
                  bookings.map((booking) => {
                    const accessible = canAccessReceipt(booking);
                    return (
                      <tr key={booking.id} className="admin-card-hover" style={{ borderBottom: '1px solid var(--admin-border)', transition: 'all 0.2s ease' }}>
                        <td style={{ padding: '1.25rem 2rem', fontSize: '0.95rem', fontWeight: '900', color: 'white', fontFamily: 'monospace' }}>
                          INV-{booking.id.substring(0, 8).toUpperCase()}
                        </td>
                        <td style={{ padding: '1.25rem 2rem', fontSize: '0.85rem', fontWeight: '700', color: 'var(--admin-text-secondary)' }}>
                          {new Date(booking.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td style={{ padding: '1.25rem 2rem', fontSize: '1.1rem', fontWeight: '950', color: 'var(--admin-brand)' }}>
                          ₱{booking.total_amount.toLocaleString()}
                        </td>
                        <td style={{ padding: '1.25rem 2rem' }}>
                          {booking.status?.toUpperCase() === 'CANCELLED' ? (
                            <span style={{ 
                              fontSize: '0.65rem', fontWeight: '950', 
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#ef4444',
                              padding: '0.3rem 0.75rem', borderRadius: '4px', textTransform: 'uppercase', border: '1px solid currentColor'
                            }}>
                              CANCELLED
                            </span>
                          ) : (
                            <span style={{ 
                              fontSize: '0.65rem', fontWeight: '950', 
                              background: accessible ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                              color: accessible ? '#10b981' : '#f59e0b',
                              padding: '0.3rem 0.75rem', borderRadius: '4px', textTransform: 'uppercase', border: '1px solid currentColor'
                            }}>
                              {accessible ? 'PAID' : 'AWAITING VERIFICATION'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '1.25rem 2rem', textAlign: 'center' }}>
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <button 
                              onClick={() => openReceipt(booking)}
                              disabled={!accessible || booking.status?.toUpperCase() === 'CANCELLED'}
                              title={booking.status?.toUpperCase() === 'CANCELLED' ? "Receipt voided" : (!accessible ? "Receipt pending Admin confirmation" : "View Official Receipt")}
                              style={{ 
                                background: 'rgba(255,255,255,0.03)', 
                                border: '1px solid var(--admin-border)', 
                                color: (accessible && booking.status?.toUpperCase() !== 'CANCELLED') ? 'white' : 'rgba(255,255,255,0.1)', 
                                borderRadius: '8px', width: '40px', height: '40px', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                cursor: (accessible && booking.status?.toUpperCase() !== 'CANCELLED') ? 'pointer' : 'not-allowed', 
                                transition: 'all 0.2s ease' 
                              }}
                            >
                              <FileText size={18} />
                            </button>
                            {(!accessible && booking.status?.toUpperCase() !== 'CANCELLED') && (
                              <div style={{ position: 'absolute', top: '-10px', right: '-5px', width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 🧾 RECEIPT PREVIEW MODAL */}
        {selectedReceipt && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem' }}>
            <div style={{ background: '#fff', color: '#000', width: '100%', maxWidth: '600px', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.5)', position: 'relative' }}>
              
              {/* VOID WATERMARK FALLBACK */}
              {!canAccessReceipt(selectedReceipt) && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, pointerEvents: 'none', opacity: 0.1 }}>
                  <div style={{ fontSize: '8rem', fontWeight: '950', border: '10px solid red', color: 'red', padding: '1rem', transform: 'rotate(-30deg)', borderRadius: '20px' }}>
                    UNVERIFIED
                  </div>
                </div>
              )}

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
                  <h2 style={{ margin: 0, fontWeight: '950', fontSize: '1.75rem', color: '#A91B18', fontStyle: 'italic' }}>SPEEDWAY</h2>
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
                    <div style={{ fontWeight: '900', fontSize: '1.1rem', color: '#A91B18', fontFamily: 'monospace' }}>INV-{selectedReceipt.id.substring(0, 8).toUpperCase()}</div>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>{new Date(selectedReceipt.created_at).toLocaleDateString()}</div>
                  </div>
                </div>

                <div style={{ borderTop: '2px solid #eee', borderBottom: '2px solid #eee', padding: '1.5rem 0', margin: '2rem 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: '800', fontSize: '1rem' }}>Premium Fleet Service</span>
                    <span style={{ fontWeight: '950', fontSize: '1.1rem' }}>₱{selectedReceipt.total_amount.toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#666', fontStyle: 'italic' }}>
                    Complete detailing session and paint restoration.
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
                  <div style={{ display: 'flex', gap: '2.5rem', width: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ color: '#999', fontSize: '0.85rem', fontWeight: '800' }}>SUBTOTAL</span>
                    <span style={{ fontWeight: '900' }}>₱{selectedReceipt.total_amount.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '2.5rem', width: '100%', justifyContent: 'flex-end', borderTop: '2px solid #000', paddingTop: '0.75rem' }}>
                    <span style={{ fontWeight: '950', fontSize: '1.25rem' }}>TOTAL PAID</span>
                    <span style={{ fontWeight: '950', fontSize: '1.25rem', color: '#A91B18' }}>₱{selectedReceipt.total_amount.toLocaleString()}</span>
                  </div>
                </div>

                <div style={{ padding: '1.25rem', background: '#f9f9f9', borderRadius: '12px', border: '1px solid #eee' }}>
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      <div>
                        <div style={{ fontSize: '0.65rem', fontWeight: '900', color: '#999', textTransform: 'uppercase' }}>Method</div>
                        <div style={{ fontWeight: '800', fontSize: '0.85rem' }}>{selectedReceipt.payments?.[0]?.method || 'GCash'}</div>
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
                </div>
              </div>

              <div style={{ padding: '1.5rem 2rem', background: '#f5f5f5', display: 'flex', gap: '1rem' }}>
                <button 
                  disabled={!canAccessReceipt(selectedReceipt)}
                  onClick={() => window.print()}
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
            padding: 20mm !important;
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
