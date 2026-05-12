import React, { useState, useEffect } from 'react';
import { CreditCard, FileText, Download, Clock, X, CheckCircle2, ShieldCheck, Printer } from 'lucide-react';
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
        .select('*')
        .eq('customer_email', session.user.email)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (err) {
      console.error('Error fetching billing data:', err);
    } finally {
      setLoading(false);
    }
  };

  // 💹 REAL-TIME CALCULATIONS
  const totalSpent = bookings.reduce((sum, b) => {
    // Only count actual payments (Full or Downpayment that are verified)
    const paid = b.payment_status === 'Paid' || b.payment_status === 'Confirmed' ? b.total_amount : 0;
    return sum + paid;
  }, 0);

  const outstandingBalance = bookings.reduce((sum, b) => {
    // Calculate what's left for confirmed bookings
    if (b.payment_status === 'Confirmed' || b.payment_status === 'In Progress') {
      const isDownpayment = b.ocr_metadata?.requiredAmount < b.total_amount;
      return sum + (isDownpayment ? (b.total_amount - b.ocr_metadata.amount) : 0);
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

  if (loading) return <div style={{ padding: '2rem', color: 'var(--admin-text-secondary)', fontWeight: '600' }}>Synchronizing financial records...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '950', margin: '0 0 0.5rem 0', textTransform: 'uppercase', color: 'var(--admin-text-primary)' }}>Billing & Invoices</h1>
        <p style={{ margin: 0, color: 'var(--admin-text-secondary)', fontSize: '0.9rem', fontWeight: '600' }}>
          View your payment history and download digital receipts for your records.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
        
        {/* Total Spent Stat */}
        <div style={{ background: 'var(--admin-card)', padding: '1.5rem', borderRadius: 'var(--admin-radius-lg)', border: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(var(--admin-brand-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CreditCard size={24} color="var(--admin-brand)" />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Spent</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>₱{totalSpent.toLocaleString()}</div>
          </div>
        </div>

        {/* Outstanding Balance Stat */}
        <div style={{ background: 'var(--admin-card)', padding: '1.5rem', borderRadius: 'var(--admin-radius-lg)', border: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(var(--admin-warning-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={24} color="var(--admin-warning)" />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Outstanding Balance</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>₱{outstandingBalance.toLocaleString()}</div>
          </div>
        </div>

      </div>

      {/* Invoice List */}
      <div style={{ background: 'var(--admin-card)', borderRadius: 'var(--admin-radius-lg)', border: '1px solid var(--admin-border)', overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '950', color: 'var(--admin-text-primary)', textTransform: 'uppercase' }}>Recent Invoices</h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--admin-bg)', borderBottom: '1px solid var(--admin-border)' }}>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Invoice ID</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Date</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Service Details</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Amount</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', textAlign: 'center' }}>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--admin-text-secondary)', fontWeight: '600' }}>No billing records found.</td>
                </tr>
              ) : (
                bookings.map((booking, i) => (
                  <tr key={booking.id} className="admin-card-hover" style={{ borderBottom: '1px solid var(--admin-border)', transition: 'background 0.2s ease' }}>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', fontWeight: '800', color: 'var(--admin-text-primary)', fontFamily: 'monospace' }}>
                      INV-{booking.id.substring(0, 8).toUpperCase()}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--admin-text-secondary)' }}>
                      {new Date(booking.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', fontWeight: '800', color: 'var(--admin-text-primary)' }}>
                      Booking for {booking.customer_name || 'Fleet Service'}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', fontWeight: '950', color: 'var(--admin-brand)' }}>
                      ₱{booking.total_amount.toLocaleString()}
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <span style={{ 
                        fontSize: '0.75rem', fontWeight: '900', 
                        background: booking.payment_status === 'Paid' || booking.payment_status === 'Confirmed' ? 'rgba(var(--admin-success-rgb), 0.1)' : 'rgba(var(--admin-warning-rgb), 0.1)',
                        color: booking.payment_status === 'Paid' || booking.payment_status === 'Confirmed' ? 'var(--admin-success)' : 'var(--admin-warning)',
                        padding: '0.2rem 0.5rem', borderRadius: '4px', textTransform: 'uppercase'
                      }}>
                        {booking.payment_status}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                      <button 
                        onClick={() => setSelectedReceipt(booking)}
                        style={{ background: 'none', border: 'none', color: 'var(--admin-text-primary)', cursor: 'pointer' }}
                      >
                        <FileText size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🧾 DIGITAL RECEIPT MODAL */}
      {selectedReceipt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem' }}>
          <div style={{ background: '#fff', color: '#000', width: '100%', maxWidth: '500px', borderRadius: 'var(--admin-radius-lg)', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.5)', position: 'relative' }}>
            
            {/* Modal Header */}
            <div style={{ background: '#000', color: '#fff', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <ShieldCheck size={24} color="var(--admin-brand)" />
                <span style={{ fontWeight: '950', letterSpacing: '1px', textTransform: 'uppercase' }}>Official Digital Receipt</span>
              </div>
              <button onClick={() => setSelectedReceipt(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '2rem' }}>
              {/* Receipt Content */}
              <div id="receipt-content">
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <h2 style={{ margin: 0, fontWeight: '950', fontSize: '1.5rem', color: '#A91B18' }}>SPEEDWAY</h2>
                  <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#666', textTransform: 'uppercase' }}>AutoxMoto Detail Studio</div>
                  <div style={{ height: '2px', background: '#000', width: '40px', margin: '0.75rem auto' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                  <div>
                    <div style={labelStyle}>Invoice To</div>
                    <div style={{ fontWeight: '900', fontSize: '1rem' }}>{selectedReceipt.customer_name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>{selectedReceipt.customer_email}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={labelStyle}>Receipt No.</div>
                    <div style={{ fontWeight: '900', fontSize: '1rem', fontFamily: 'monospace' }}>INV-{selectedReceipt.id.substring(0, 8).toUpperCase()}</div>
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>{new Date(selectedReceipt.created_at).toLocaleDateString()}</div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #eee', borderBottom: '1px solid #eee', padding: '1rem 0', margin: '1.5rem 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: '800' }}>Fleet Detail Service</span>
                    <span style={{ fontWeight: '950' }}>₱{selectedReceipt.total_amount.toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#666', fontStyle: 'italic' }}>
                    Vehicle: {selectedReceipt.vehicles_details?.[0]?.brand || 'Standard Fleet'} Detailing
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', gap: '2rem', width: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ color: '#666', fontSize: '0.85rem', fontWeight: '700' }}>Subtotal</span>
                    <span style={{ fontWeight: '800' }}>₱{selectedReceipt.total_amount.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '2rem', width: '100%', justifyContent: 'flex-end', borderTop: '2px solid #000', paddingTop: '0.5rem' }}>
                    <span style={{ fontWeight: '950', fontSize: '1.1rem' }}>Total Amount</span>
                    <span style={{ fontWeight: '950', fontSize: '1.1rem', color: '#A91B18' }}>₱{selectedReceipt.total_amount.toLocaleString()}</span>
                  </div>
                </div>

                <div style={{ marginTop: '2rem', padding: '1rem', background: '#f9f9f9', borderRadius: 'var(--admin-radius-sm)', border: '1px dashed #ddd', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--admin-success)', marginBottom: '0.25rem' }}>
                    <CheckCircle2 size={16} />
                    <span style={{ fontWeight: '950', fontSize: '0.85rem', textTransform: 'uppercase' }}>{selectedReceipt.payment_status} Verified</span>
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#888', fontWeight: '700' }}>
                    AI-Verified Reference: {selectedReceipt.ocr_metadata?.referenceNo || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                <button 
                  onClick={() => window.print()}
                  style={{ flex: 1, padding: '0.85rem', background: '#000', color: '#fff', border: 'none', borderRadius: 'var(--admin-radius-md)', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}
                >
                  <Printer size={18} /> Print Receipt
                </button>
                <button 
                  onClick={() => setSelectedReceipt(null)}
                  style={{ flex: 1, padding: '0.85rem', background: '#eee', color: '#000', border: 'none', borderRadius: 'var(--admin-radius-md)', fontWeight: '900', cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerBilling;
