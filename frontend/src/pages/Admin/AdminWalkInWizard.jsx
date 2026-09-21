import React, { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { createBooking } from '../../services/bookingService';
import { getRequiredDownpayment, requiresDownpayment } from '../../utils/paymentUtils';
import { sanitizeVehicleText, sanitizeVehiclePlate } from '../../config/constants';
import CustomerBookAppointment from '../Customer/CustomerBookAppointment';
import toast from 'react-hot-toast';

const AdminWalkInWizard = () => {
  const { user } = useAuth();
  const [isNewGuest, setIsNewGuest] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [guest, setGuest] = useState({ firstName: '', lastName: '', email: '', phone: '' });

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('id, full_name, email, phone_number').eq('role', 'CUSTOMER').eq('is_active', true).order('full_name'),
    ]).then(([customerResult]) => {
      setCustomers(customerResult.data || []);
    });
  }, []);

  const renderAdminPanel = ({ bookingData, setBookingData, isCustomerDetailsLocked }) => {
    const updateCustomerMode = mode => {
      if (isCustomerDetailsLocked) return;
      setIsNewGuest(mode);
      setSelectedCustomer('');
      setGuest({ firstName: '', lastName: '', email: '', phone: '' });
      setBookingData(current => ({ ...current, customerId: null, customerName: '', customerEmail: '', contactNumber: '', adminCustomerReady: false }));
    };
    const fieldStyle = { width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '.85rem 1rem', background: 'var(--admin-input-bg)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-input-border)', borderRadius: '8px', fontWeight: '700' };
    return (
      <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', padding: '1.25rem', background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}><UserPlus size={18} color="var(--admin-brand)" /><strong style={{ color: 'var(--admin-text-primary)', textTransform: 'uppercase' }}>Admin Customer Selection</strong></div>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <button type="button" disabled={isCustomerDetailsLocked} onClick={() => updateCustomerMode(false)} style={{ padding: '.75rem 1rem', border: '1px solid var(--admin-border)', background: !isNewGuest ? 'var(--admin-brand)' : 'var(--admin-bg)', color: !isNewGuest ? '#fff' : 'var(--admin-text-primary)', borderRadius: '6px', fontWeight: '900', cursor: isCustomerDetailsLocked ? 'not-allowed' : 'pointer', opacity: isCustomerDetailsLocked ? .65 : 1 }}>Existing Customer</button>
          <button type="button" disabled={isCustomerDetailsLocked} onClick={() => updateCustomerMode(true)} style={{ padding: '.75rem 1rem', border: '1px solid var(--admin-border)', background: isNewGuest ? 'var(--admin-brand)' : 'var(--admin-bg)', color: isNewGuest ? '#fff' : 'var(--admin-text-primary)', borderRadius: '6px', fontWeight: '900', cursor: isCustomerDetailsLocked ? 'not-allowed' : 'pointer', opacity: isCustomerDetailsLocked ? .65 : 1 }}>Walk-in Guest</button>
        </div>
        {isNewGuest ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '.75rem' }}>
            <input disabled={isCustomerDetailsLocked} style={fieldStyle} placeholder="First name" value={guest.firstName} onChange={event => { const firstName = event.target.value.replace(/[^a-zA-Z ]/g, '').replace(/\s+/g, ' '); setGuest(current => ({ ...current, firstName })); setBookingData(current => ({ ...current, customerId: null, customerName: `${firstName} ${guest.lastName}`.trim(), adminCustomerReady: Boolean(firstName.trim() && guest.lastName.trim() && guest.email.trim() && guest.phone.trim()) })); }} />
            <input disabled={isCustomerDetailsLocked} style={fieldStyle} placeholder="Last name" value={guest.lastName} onChange={event => { const lastName = event.target.value.replace(/[^a-zA-Z ]/g, '').replace(/\s+/g, ' '); setGuest(current => ({ ...current, lastName })); setBookingData(current => ({ ...current, customerId: null, customerName: `${guest.firstName} ${lastName}`.trim(), adminCustomerReady: Boolean(guest.firstName.trim() && lastName.trim() && guest.email.trim() && guest.phone.trim()) })); }} />
            <input disabled={isCustomerDetailsLocked} style={fieldStyle} placeholder="Email" type="email" value={guest.email} onChange={event => { const email = event.target.value.replace(/[^a-zA-Z0-9@._+-]/g, ''); setGuest(current => ({ ...current, email })); setBookingData(current => ({ ...current, customerEmail: email, adminCustomerReady: Boolean(guest.firstName.trim() && guest.lastName.trim() && email.trim() && guest.phone.trim()) })); }} />
            <input disabled={isCustomerDetailsLocked} style={fieldStyle} placeholder="Phone" inputMode="numeric" value={guest.phone} onChange={event => { const phone = event.target.value.replace(/\D/g, ''); setGuest(current => ({ ...current, phone })); setBookingData(current => ({ ...current, contactNumber: phone, adminCustomerReady: Boolean(guest.firstName.trim() && guest.lastName.trim() && guest.email.trim() && phone.trim()) })); }} />
          </div>
        ) : (
          <select disabled={isCustomerDetailsLocked} style={fieldStyle} value={selectedCustomer} onChange={event => { const id = event.target.value; const profile = customers.find(customer => customer.id === id); setSelectedCustomer(id); setBookingData(current => ({ ...current, customerId: id, customerName: profile?.full_name || '', customerEmail: profile?.email || '', contactNumber: profile?.phone_number || '', adminCustomerReady: Boolean(id) })); }}>
            <option value="">Choose customer account</option>
            {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.full_name || customer.email}</option>)}
          </select>
        )}
      </section>
    );
  };

  const submitAdminBooking = async bookingData => {
    if (!bookingData.customerName || !bookingData.contactNumber) throw new Error('Complete the customer details before confirming.');
    const paymentType = bookingData.payment?.type || 'Full';
    const totalAmount = Number(bookingData.total_amount || (bookingData.vehicles || []).reduce((total, vehicle) => total + (vehicle.services || []).reduce((sum, service) => sum + Number(service.price || 0), 0), 0));
    const paymentAmount = paymentType === 'Downpayment'
      ? getRequiredDownpayment(totalAmount)
      : paymentType === 'Manual' ? Number(bookingData.payment?.manualAmount || 0) : totalAmount;
    if (!paymentAmount || paymentAmount <= 0 || paymentAmount > totalAmount || (paymentType === 'Downpayment' && !requiresDownpayment(totalAmount))) {
      throw new Error('Choose a valid payment amount before confirming the walk-in booking.');
    }
    const booking = await createBooking(bookingData.customerId ?? null, {
      ...bookingData,
      adminWalkIn: true,
      notes: `${bookingData.notes || ''} WALK-IN`,
      customerId: bookingData.customerId ?? null
    });
    const { error: paymentError } = await supabase.from('payments').insert({
      booking_id: booking.id,
      amount: paymentAmount,
      method: bookingData.payment?.method === 'GCash' ? 'GCash' : 'Cash',
      payment_type: paymentType,
      status: 'PAID',
      verified_by: user?.id,
      verified_at: new Date().toISOString(),
      notes: `ADMIN_WALK_IN|TYPE:${paymentType}|DECLARED_AMOUNT:${paymentAmount}`
    });
    if (paymentError) throw paymentError;
    toast.success('Walk-in booking created.');
  };

  return <CustomerBookAppointment adminMode renderAdminPanel={renderAdminPanel} onAdminSubmit={submitAdminBooking} />;
};

export default AdminWalkInWizard;
