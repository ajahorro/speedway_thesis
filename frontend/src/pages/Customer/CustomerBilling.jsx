import React from 'react';
import { CreditCard, FileText, Download, Clock } from 'lucide-react';

const CustomerBilling = () => {
  // Mock Billing History
  const bills = [
    {
      id: 'INV-8A92',
      date: 'Nov 15, 2026',
      description: 'Downpayment for BKG-8A92',
      amount: 2000,
      status: 'PAID',
      method: 'GCash'
    },
    {
      id: 'INV-9B21',
      date: 'Oct 10, 2026',
      description: 'Full Payment for BKG-1A55',
      amount: 5000,
      status: 'PAID',
      method: 'Cash'
    },
    {
      id: 'INV-4C82',
      date: 'Dec 05, 2026',
      description: 'Pending Balance for BKG-4C82',
      amount: 1500,
      status: 'UNPAID',
      method: '-'
    }
  ];

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
            <div style={{ fontSize: '1.5rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>₱7,000</div>
          </div>
        </div>

        {/* Outstanding Balance Stat */}
        <div style={{ background: 'var(--admin-card)', padding: '1.5rem', borderRadius: 'var(--admin-radius-lg)', border: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(var(--admin-warning-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={24} color="var(--admin-warning)" />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Outstanding Balance</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>₱1,500</div>
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
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Description</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Amount</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', textAlign: 'center' }}>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill, i) => (
                <tr key={i} className="admin-card-hover" style={{ borderBottom: '1px solid var(--admin-border)', transition: 'background 0.2s ease' }}>
                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', fontWeight: '800', color: 'var(--admin-text-primary)', fontFamily: 'monospace' }}>{bill.id}</td>
                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--admin-text-secondary)' }}>{bill.date}</td>
                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', fontWeight: '800', color: 'var(--admin-text-primary)' }}>{bill.description}</td>
                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', fontWeight: '950', color: 'var(--admin-brand)' }}>₱{bill.amount.toLocaleString()}</td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <span style={{ 
                      fontSize: '0.75rem', fontWeight: '900', 
                      background: bill.status === 'PAID' ? 'rgba(var(--admin-success-rgb), 0.1)' : 'rgba(var(--admin-warning-rgb), 0.1)',
                      color: bill.status === 'PAID' ? 'var(--admin-success)' : 'var(--admin-warning)',
                      padding: '0.2rem 0.5rem', borderRadius: '4px'
                    }}>
                      {bill.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                    <button 
                      disabled={bill.status !== 'PAID'}
                      style={{ background: 'none', border: 'none', color: bill.status === 'PAID' ? 'var(--admin-text-primary)' : 'var(--admin-border)', cursor: bill.status === 'PAID' ? 'pointer' : 'not-allowed' }}
                    >
                      <Download size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CustomerBilling;
