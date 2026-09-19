import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calendar, UserPlus, Wrench } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SERVICES_DATA } from '../../data/servicesCatalog';
import { useConfig } from '../../context/ConfigContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import PageHeader from '../../components/PageHeader';
import toast from 'react-hot-toast';

const ACTIVE_BOOKING_STATUSES = ['scheduled', 'confirmed', 'in_progress', 'pending'];
const VEHICLE_TYPES = ['Sedan', 'SUV', 'Van/L300', 'Regular', 'Bigbike'];

const flattenServices = () => Object.values(SERVICES_DATA).flatMap(category =>
  category.map(service => ({ ...service, category }))
);

const getServicePrice = (service, vehicleType) => Number(service?.prices?.[vehicleType] ?? Object.values(service?.prices || {})[0] ?? 0);

const AdminWalkInForm = () => {
  const { settings } = useConfig();
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const services = useMemo(flattenServices, []);
  const [isNewGuest, setIsNewGuest] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [customerVehicles, setCustomerVehicles] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [guestDetails, setGuestDetails] = useState({ name: '', phone: '', plate: '', model: '', type: 'Sedan' });
  const [selectedService, setSelectedService] = useState('');
  const [selectedBay, setSelectedBay] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [selectedStaff, setSelectedStaff] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');

  const selectedServiceData = services.find(service => service.id === selectedService);
  const selectedPrice = getServicePrice(selectedServiceData, guestDetails.type);
  const bays = Array.from({ length: Math.max(1, Number(settings.MAX_BAYS || 1)) }, (_, index) => ({ id: String(index + 1), name: `Bay ${index + 1}` }));
  const availableStaff = staffMembers.filter(staff => Boolean(staff.is_clocked_in) && Number(staff.activeJobsCount || 0) < 3);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [{ data: customerData }, { data: staffData }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, phone_number').eq('role', 'CUSTOMER').eq('is_active', true).order('full_name'),
        supabase.from('profiles').select('id, full_name, email, is_clocked_in').eq('role', 'STAFF').eq('is_active', true).order('full_name')
      ]);
      const staffWithLoads = await Promise.all((staffData || []).map(async staff => {
        const { data: assignedBookings } = await supabase
          .from('bookings')
          .select('vehicles:booking_vehicles(id)')
          .eq('staff_id', staff.id)
          .in('status', ACTIVE_BOOKING_STATUSES);
        return { ...staff, activeJobsCount: (assignedBookings || []).reduce((count, booking) => count + (booking.vehicles?.length || 0), 0) };
      }));
      setCustomers(customerData || []);
      setStaffMembers(staffWithLoads);
      setLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (isNewGuest || !selectedCustomer) {
      setCustomerVehicles([]);
      return;
    }
    supabase.from('vehicles').select('*').eq('owner_id', selectedCustomer).order('is_primary', { ascending: false }).then(({ data }) => setCustomerVehicles(data || []));
  }, [isNewGuest, selectedCustomer]);

  const checkAvailability = async () => {
    setAvailabilityError('');
    if (!scheduledTime || !selectedServiceData) return true;
    const start = new Date(scheduledTime);
    const end = new Date(start.getTime() + Number(selectedServiceData.durationMinutes || 60) * 60000);
    const { data: overlapping, error } = await supabase
      .from('bookings')
      .select('id, customer_name, vehicles:booking_vehicles(id)')
      .in('status', ACTIVE_BOOKING_STATUSES)
      .lt('start_datetime', end.toISOString())
      .gt('end_datetime', start.toISOString());
    if (error) throw error;
    const { data: samePlateBookings, error: plateError } = await supabase
      .from('booking_vehicles')
      .select('id, booking:bookings!inner(start_datetime, end_datetime, status)')
      .eq('plate_number', guestDetails.plate.trim().toUpperCase());
    if (plateError) throw plateError;
    const duplicatePlate = (samePlateBookings || []).some(vehicle => {
      const booking = vehicle.booking;
      return ACTIVE_BOOKING_STATUSES.includes(String(booking.status || '').toLowerCase()) && new Date(booking.start_datetime) < end && new Date(booking.end_datetime) > start;
    });
    if (duplicatePlate) {
      setAvailabilityError('This vehicle already has an active booking during the selected time.');
      return false;
    }
    const occupiedUnits = (overlapping || []).reduce((count, booking) => count + (booking.vehicles?.length || 0), 0);
    if (occupiedUnits >= Number(settings.MAX_BAYS || 1)) {
      setAvailabilityError(`No bay is available for this time. ${occupiedUnits} of ${settings.MAX_BAYS} bays are occupied.`);
      return false;
    }
    return true;
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (!isNewGuest && !selectedCustomer) throw new Error('Select an existing customer.');
      if (!selectedServiceData || !selectedBay || !scheduledTime || !selectedStaff) throw new Error('Complete the service, bay, time, and staff fields.');
      if (!guestDetails.plate || !guestDetails.model) throw new Error('Complete the vehicle details.');
      const staff = availableStaff.find(member => member.id === selectedStaff);
      if (!staff) throw new Error('That technician is no longer available. Refresh the page and try again.');
      if (!(await checkAvailability())) return;

      const start = new Date(scheduledTime);
      const end = new Date(start.getTime() + Number(selectedServiceData.durationMinutes || 60) * 60000);
      const customer = customers.find(item => item.id === selectedCustomer);
      const customerName = isNewGuest ? guestDetails.name.trim() : customer?.full_name || 'Customer';
      const { data: booking, error: bookingError } = await supabase.from('bookings').insert({
        customer_id: isNewGuest ? null : selectedCustomer,
        customer_name: customerName,
        contact_number: isNewGuest ? guestDetails.phone.trim() : customer?.phone_number || '',
        start_datetime: start.toISOString(),
        end_datetime: end.toISOString(),
        status: 'confirmed',
        total_amount: selectedPrice,
        staff_id: selectedStaff,
        notes: `WALK-IN | ${selectedBay} | ${isNewGuest ? 'Guest' : 'Existing customer'}`
      }).select().single();
      if (bookingError) throw bookingError;

      const { data: vehicle, error: vehicleError } = await supabase.from('booking_vehicles').insert({
        booking_id: booking.id,
        vehicle_type: guestDetails.type,
        brand: guestDetails.model.trim().split(' ')[0],
        model: guestDetails.model.trim(),
        plate_number: guestDetails.plate.trim().toUpperCase(),
        status: 'QUEUED'
      }).select().single();
      if (vehicleError) throw vehicleError;

      const { error: serviceError } = await supabase.from('booking_vehicle_services').insert({
        booking_vehicle_id: vehicle.id,
        service_name: selectedServiceData.name,
        price: selectedPrice
      });
      if (serviceError) throw serviceError;

      await supabase.from('audit_logs').insert({
        booking_id: booking.id,
        action_type: 'WALK_IN_CREATED',
        actor_role: 'ADMIN',
        details: `Walk-in booking created for ${customerName}. ${selectedBay} assigned to ${staff.full_name}.`
      });
      toast.success('Walk-in booking created and dispatched.');
      setSelectedCustomer('');
      setGuestDetails({ name: '', phone: '', plate: '', model: '', type: 'Sedan' });
      setSelectedService('');
      setSelectedBay('');
      setScheduledTime('');
      setSelectedStaff('');
    } catch (error) {
      toast.error(error.message || 'Could not create walk-in booking.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '0.75rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', color: 'var(--admin-text-primary)', fontWeight: '700' };
  const labelStyle = { display: 'block', marginBottom: '0.4rem', fontSize: '0.68rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '4rem' }}>
      <PageHeader badge="FRONT DESK" title="WALK-IN BOOKING" subtitle="Create an immediate booking with a live bay and technician check." />
      <form onSubmit={handleSubmit} style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius)', padding: isMobile ? '1rem' : '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', borderBottom: '1px solid var(--admin-border)', paddingBottom: '1rem' }}>
          <div><h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--admin-text-primary)' }}><UserPlus size={18} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} /> Customer and vehicle</h2><p style={{ margin: '0.3rem 0 0', color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>Choose a registered customer or record a guest walk-in.</p></div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button type="button" onClick={() => setIsNewGuest(false)} style={{ ...inputStyle, width: 'auto', cursor: 'pointer', background: !isNewGuest ? 'var(--admin-brand)' : 'var(--admin-bg)', color: !isNewGuest ? '#fff' : 'var(--admin-text-primary)' }}>Existing Customer</button>
            <button type="button" onClick={() => setIsNewGuest(true)} style={{ ...inputStyle, width: 'auto', cursor: 'pointer', background: isNewGuest ? 'var(--admin-brand)' : 'var(--admin-bg)', color: isNewGuest ? '#fff' : 'var(--admin-text-primary)' }}>Walk-in Guest</button>
          </div>
        </div>

        {!isNewGuest && <>
          <div><label style={labelStyle}>Select Customer</label><select required value={selectedCustomer} onChange={event => setSelectedCustomer(event.target.value)} style={inputStyle}><option value="">Choose customer</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.full_name || customer.email} {customer.phone_number ? `(${customer.phone_number})` : ''}</option>)}</select></div>
          {selectedCustomer && <div style={{ padding: '0.85rem', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', background: 'var(--admin-bg)' }}><div style={{ ...labelStyle, marginBottom: '0.6rem' }}>Saved fleet (read-only)</div>{customerVehicles.length === 0 ? <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>No saved vehicles found.</span> : <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>{customerVehicles.map(vehicle => <button type="button" key={vehicle.id} onClick={() => setGuestDetails(prev => ({ ...prev, plate: vehicle.plate_number || '', model: `${vehicle.brand || ''} ${vehicle.model || ''}`.trim(), type: vehicle.type || 'Sedan' }))} style={{ padding: '0.55rem 0.7rem', background: 'var(--admin-card)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)', borderRadius: '4px', cursor: 'pointer', textAlign: 'left' }}><strong>{vehicle.brand} {vehicle.model}</strong><br /><small>{vehicle.plate_number} · {vehicle.type}</small></button>)}</div>}</div>}
        </>}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1rem' }}>
          <div><label style={labelStyle}>{isNewGuest ? 'Guest name' : 'Vehicle model'}</label><input required value={isNewGuest ? guestDetails.name : guestDetails.model} onChange={event => setGuestDetails({ ...guestDetails, [isNewGuest ? 'name' : 'model']: event.target.value })} style={inputStyle} placeholder={isNewGuest ? 'Full name' : 'Honda Civic 2024'} /></div>
          <div><label style={labelStyle}>{isNewGuest ? 'Phone number' : 'Vehicle model'}</label><input required value={isNewGuest ? guestDetails.phone : guestDetails.model} onChange={event => setGuestDetails({ ...guestDetails, [isNewGuest ? 'phone' : 'model']: event.target.value })} style={inputStyle} placeholder={isNewGuest ? '09XXXXXXXXX' : 'Honda Civic 2024'} /></div>
          <div><label style={labelStyle}>Plate number</label><input required value={guestDetails.plate} onChange={event => setGuestDetails({ ...guestDetails, plate: event.target.value.toUpperCase() })} style={inputStyle} placeholder="ABC-1234" /></div>
        </div>
        <div><label style={labelStyle}>Vehicle type</label><select value={guestDetails.type} onChange={event => setGuestDetails({ ...guestDetails, type: event.target.value })} style={inputStyle}>{VEHICLE_TYPES.map(type => <option key={type}>{type}</option>)}</select></div>

        <div style={{ borderTop: '1px solid var(--admin-border)', paddingTop: '1.5rem' }}><h3 style={{ margin: '0 0 1rem', color: 'var(--admin-text-primary)', fontSize: '1rem' }}><Wrench size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} /> Service and allocation</h3><div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1rem' }}><div><label style={labelStyle}>Service package</label><select required value={selectedService} onChange={event => setSelectedService(event.target.value)} style={inputStyle}><option value="">Choose service</option>{services.map(service => <option key={service.id} value={service.id}>{service.name} - ₱{getServicePrice(service, guestDetails.type).toLocaleString()}</option>)}</select></div><div><label style={labelStyle}>Bay allocation</label><select required value={selectedBay} onChange={event => setSelectedBay(event.target.value)} style={inputStyle}><option value="">Choose bay</option>{bays.map(bay => <option key={bay.id} value={bay.id}>{bay.name}</option>)}</select></div></div></div>

        <div style={{ borderTop: '1px solid var(--admin-border)', paddingTop: '1.5rem' }}><h3 style={{ margin: '0 0 1rem', color: 'var(--admin-text-primary)', fontSize: '1rem' }}><Calendar size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} /> Schedule and staff</h3><div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1rem' }}><div><label style={labelStyle}>Start time</label><input required type="datetime-local" value={scheduledTime} onChange={event => setScheduledTime(event.target.value)} style={inputStyle} /></div><div><label style={labelStyle}>Clocked-in technician, under 3 active units</label><select required value={selectedStaff} onChange={event => setSelectedStaff(event.target.value)} style={inputStyle}><option value="">Choose technician</option>{availableStaff.map(staff => <option key={staff.id} value={staff.id}>{staff.full_name} ({staff.activeJobsCount}/3 units)</option>)}</select>{availableStaff.length === 0 && <p style={{ color: '#f59e0b', fontSize: '0.75rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}><AlertCircle size={14} /> No eligible technician is currently available.</p>}</div></div>{availabilityError && <p style={{ color: '#ef4444', fontWeight: '800', fontSize: '0.8rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}><AlertCircle size={14} /> {availabilityError}</p>}</div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', borderTop: '1px solid var(--admin-border)', paddingTop: '1.5rem' }}><div style={{ color: 'var(--admin-text-secondary)', fontWeight: '800', fontSize: '0.85rem' }}>{selectedServiceData ? `Estimated total: ₱${selectedPrice.toLocaleString()}` : 'Select a service to calculate total.'}</div><button type="submit" disabled={loading || submitting || availableStaff.length === 0} style={{ padding: '0.85rem 1.25rem', background: 'var(--admin-brand)', border: 0, borderRadius: 'var(--admin-radius-sm)', color: '#fff', fontWeight: '900', cursor: 'pointer', opacity: loading || submitting || availableStaff.length === 0 ? 0.5 : 1 }}>{submitting ? 'Creating...' : 'Confirm Walk-In'}</button></div>
      </form>
    </div>
  );
};

export default AdminWalkInForm;
