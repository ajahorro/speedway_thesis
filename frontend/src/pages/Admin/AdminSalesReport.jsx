import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { 
  TrendingUp, TrendingDown, DollarSign, Calendar, 
  ChevronRight, Printer, Download, Filter, 
  ArrowLeft, BarChart3, PieChart, ShoppingBag, Car,
  RotateCw
} from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import toast from 'react-hot-toast';
import { logger } from '../../utils/logger';

const AdminSalesReport = () => {
  const navigate = useNavigate();
  
  // BATCHED STATE
  const [state, setState] = useState({
    period: 'monthly',
    loading: true,
    transactions: [],
    aggregates: {
      grossRevenue: 0,
      refundedAmount: 0,
      netRevenue: 0,
      transactionCount: 0,
      averageTicket: 0,
      growth: 12.5,
      topServices: []
    }
  });

  const fetchSalesData = useCallback(async (currentPeriod) => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      logger.admin(`Generating sales report for ${currentPeriod}...`);
      
      const now = new Date();
      let startDate = new Date();
      if (currentPeriod === 'daily') startDate.setHours(0, 0, 0, 0);
      else if (currentPeriod === 'weekly') startDate.setDate(now.getDate() - 7);
      else if (currentPeriod === 'monthly') startDate.setDate(now.getDate() - 30);

      // 1. Fetch Verified Payments
      const { data: payments, error } = await supabase
        .from('payments')
        .select(`
          *,
          booking:bookings(
            id, 
            customer:profiles!bookings_customer_id_fkey(full_name),
            vehicles:booking_vehicles(
              *,
              services:booking_vehicle_services(*)
            )
          )
        `)
        .eq('status', 'PAID')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 2. Fetch Refunded Volume
      const { data: refundData } = await supabase
        .from('bookings')
        .select('total_amount, refund_status')
        .eq('status', 'cancelled')
        .eq('refund_status', 'PROCESSED')
        .gte('updated_at', startDate.toISOString());

      const enrichedTransactions = (payments || []).map(p => ({
        ...p,
        customer_name: p.booking?.customer?.full_name || 'Walk-in',
        verified_at: p.created_at
      }));

      // Aggregates Logic
      const gross = enrichedTransactions.reduce((sum, p) => sum + Number(p.amount), 0);
      const refunded = (refundData || []).reduce((sum, b) => sum + Number(b.total_amount), 0);
      
      const serviceMap = {};
      enrichedTransactions.forEach(p => {
        p.booking?.vehicles?.forEach(v => {
          v.services?.forEach(s => {
            const name = s.service_name_snapshot || 'Unknown';
            serviceMap[name] = (serviceMap[name] || 0) + 1;
          });
        });
      });

      setState(prev => ({
        ...prev,
        loading: false,
        transactions: enrichedTransactions,
        aggregates: {
          ...prev.aggregates,
          grossRevenue: gross,
          refundedAmount: refunded,
          netRevenue: gross - refunded,
          transactionCount: enrichedTransactions.length,
          averageTicket: enrichedTransactions.length > 0 ? gross / enrichedTransactions.length : 0,
          topServices: Object.entries(serviceMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a,b) => b.count - a.count)
            .slice(0, 5)
        }
      }));

      logger.admin('Sales report synchronized.');
    } catch (err) {
      logger.error('Sales Data Error', err);
      toast.error('Failed to generate report');
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    fetchSalesData(state.period);
  }, [state.period, fetchSalesData]);

  const handlePeriodChange = (newPeriod) => {
    setState(prev => ({ ...prev, period: newPeriod }));
  };

  const cardStyle = { 
    background: 'var(--admin-card)', 
    borderRadius: 'var(--admin-radius)', 
    padding: '1.5rem', 
    border: '1px solid var(--admin-border)' 
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>
      <PageHeader 
        showBack
        onBack={() => navigate(-1)}
        badge="COMMERCIAL PERFORMANCE"
        title="Sales Performance"
        subtitle="Comprehensive breakdown of shop revenue and sales performance."
        onRefresh={() => fetchSalesData(state.period)}
      >
        <button onClick={() => window.print()} style={{ padding: '0.75rem 1.25rem', background: 'var(--admin-brand)', color: 'white', border: 'none', borderRadius: 'var(--admin-radius-sm)', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}><Printer size={16} /> PRINT REPORT</button>
      </PageHeader>

      <div style={{ display: 'flex', background: 'var(--admin-card)', padding: '0.4rem', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border)', width: 'fit-content' }}>
        {['daily', 'weekly', 'monthly'].map(t => (
          <button 
            key={t} 
            onClick={() => handlePeriodChange(t)} 
            style={{ 
              padding: '0.6rem 1.5rem', 
              borderRadius: 'var(--admin-radius-sm)', 
              border: 'none', 
              background: state.period === t ? 'var(--admin-brand)' : 'transparent', 
              color: state.period === t ? '#FFFFFF' : 'var(--admin-text-secondary)', 
              fontWeight: '900', 
              textTransform: 'uppercase', 
              fontSize: '0.7rem', 
              cursor: 'pointer' 
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        <div style={{ ...cardStyle, background: 'linear-gradient(135deg, var(--admin-brand), #7c1210)', color: 'white' }}>
          <div style={{ opacity: 0.8, fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Gross Revenue ({state.period})</div>
          <div style={{ fontSize: '2.5rem', fontWeight: '950' }}>₱{state.aggregates.grossRevenue.toLocaleString()}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', fontSize: '0.85rem', fontWeight: '800' }}>
            <TrendingUp size={16} /> {state.aggregates.growth}% Target Growth
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Net Revenue (Verified)</div>
          <div style={{ fontSize: '2rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>₱{state.aggregates.netRevenue.toLocaleString()}</div>
          <div style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: '800', marginTop: '1rem' }}>- ₱{state.aggregates.refundedAmount.toLocaleString()} in refunds</div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Efficiency</div>
          <div style={{ fontSize: '2rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>{state.aggregates.transactionCount} Sales</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)', fontWeight: '800', marginTop: '1rem' }}>Avg. ₱{state.aggregates.averageTicket.toFixed(0)} per detail</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: '950', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--admin-text-primary)' }}><ShoppingBag size={20} color="var(--admin-brand)" /> TOP SERVICES</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {state.aggregates.topServices.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>No service data for this period.</p>
            ) : state.aggregates.topServices.map((svc, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'var(--admin-bg)', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border)' }}>
                <span style={{ fontWeight: '800', color: 'var(--admin-text-primary)' }}>{svc.name}</span>
                <span style={{ fontWeight: '900', color: 'var(--admin-brand)' }}>{svc.count} sales</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '950', color: 'var(--admin-text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TrendingUp size={20} color="var(--admin-brand)" /> RECENT TRANSACTIONS
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--admin-bg)', borderBottom: '1px solid var(--admin-border)' }}>
                <th style={{ padding: '1rem', color: 'var(--admin-text-secondary)', fontSize: '0.7rem', fontWeight: '900' }}>DATE</th>
                <th style={{ padding: '1rem', color: 'var(--admin-text-secondary)', fontSize: '0.7rem', fontWeight: '900' }}>CUSTOMER</th>
                <th style={{ padding: '1rem', color: 'var(--admin-text-secondary)', fontSize: '0.7rem', fontWeight: '900' }}>FLEET</th>
                <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--admin-text-secondary)', fontSize: '0.7rem', fontWeight: '900' }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {state.loading ? (
                <tr><td colSpan="4" style={{ padding: '3rem', textAlign: 'center' }}><RotateCw size={24} className="animate-spin" style={{ opacity: 0.2 }} /></td></tr>
              ) : state.transactions.length === 0 ? (
                <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>No transactions recorded for this period.</td></tr>
              ) : state.transactions.map((t, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                  <td style={{ padding: '1rem', fontWeight: '700' }}>{new Date(t.verified_at).toLocaleDateString()}</td>
                  <td style={{ padding: '1rem', fontWeight: '700' }}>{t.customer_name}</td>
                  <td style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: '700' }}>
                    {t.booking?.vehicles?.length || 0} Units
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '900', color: 'var(--admin-brand)' }}>₱{Number(t.amount).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default AdminSalesReport;
