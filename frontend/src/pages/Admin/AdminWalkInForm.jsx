import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calendar, UserPlus, Wrench } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SERVICES_DATA } from '../../data/servicesCatalog';
import { useConfig } from '../../context/ConfigContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import PageHeader from '../../components/PageHeader';
import toast from 'react-hot-toast';
import { sanitizeVehiclePlate, sanitizeVehicleText, VEHICLE_TYPE_OPTIONS } from '../../config/constants';
import { calculateBayUsage } from '../../utils/schedulingUtils';

const ACTIVE_BOOKING_STATUSES = ['scheduled', 'confirmed', 'in_progress', 'pending'];

const flattenServices = () => Object.values(SERVICES_DATA).flatMap(category =>
  category.map(service => ({ ...service, category }))
);

const getServicePrice = (service, vehicleType) => Number(service?.prices?.[vehicleType] ?? Object.values(service?.prices || {})[0] ?? 0);
const sanitizePersonText = value => value.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, ' ').trimStart();
const sanitizePhone = value => value.replace(/\D/g, '').slice(0, 15);
const sanitizeEmail = value => value.replace(/[^a-zA-Z0-9@._+-]/g, '').replace(/\.{2,}/g, '.');

const AdminWalkInForm = () => {
  const { settings } = useConfig();
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const services = useMemo(flattenServices, []);
  const [isNewGuest, setIsNewGuest] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [customerVehicles, setCustomerVehicles] = useState([]);
  const [customerGroups, setCustomerGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [guestDetails, setGuestDetails] = useState({ name: '', email: '', phone: '', plate: '', model: '', type: 'Sedan' });
  const [selectedService, setSelectedService] = useState('');
  const [selectedBay, setSelectedBay] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [selectedStaff, setSelectedStaff] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [currentStep, setCurrentStep] = useState(1);

  const selectedServiceData = services.find(service => service.id === selectedService);
  const selectedPrice = getServicePrice(selectedServiceData, guestDetails.type);
  const compatibleServices = services.filter(service => Number(service?.prices?.[guestDetails.type] || 0) > 0);
  const selectedDuration = Number(selectedServiceData?.durationMinutes || 60);
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
      setCustomerGroups([]);
      setSelectedGroup('');
      return;
    }
    Promise.all([
      supabase.from('vehicles').select('*').eq('owner_id', selectedCustomer).order('is_primary', { ascending: false }),
      supabase.from('fleet_groups').select('id, name').eq('owner_id', selectedCustomer).order('created_at')
    ]).then(([vehiclesResult, groupsResult]) => {
      setCustomerVehicles(vehiclesResult.data || []);
      setCustomerGroups(groupsResult.data || []);
      setSelectedGroup(groupsResult.data?.[0]?.id || '');
    });
  }, [isNewGuest, selectedCustomer]);

  const visibleCustomerVehicles = selectedGroup
    ? customerVehicles.filter(vehicle => vehicle.fleet_group_id === selectedGroup)
    : customerVehicles;

  const checkAvailability = async () => {
    setAvailabilityError('');
    if (!scheduledTime || !selectedServiceData) return true;
    const start = new Date(scheduledTime);
    const end = new Date(start.getTime() + selectedDuration * 60000);
    const { data: overlapping, error } = await supabase
      .from('bookings')
      .select('id, customer_name, vehicles:booking_vehicles(id, vehicle_type, status)')
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
    const occupiedUnits = calculateBayUsage((overlapping || []).flatMap(booking => (booking.vehicles || []).filter(vehicle => vehicle.status !== 'COMPLETED' && vehicle.status !== 'completed')));
    const requestedUnits = calculateBayUsage([{ type: guestDetails.type }]);
    if (occupiedUnits + requestedUnits > Number(settings.MAX_BAYS || 1)) {
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
      if (isNewGuest && (!sanitizePersonText(guestDetails.name).trim() || !sanitizeEmail(guestDetails.email).trim() || !sanitizePhone(guestDetails.phone))) {
        throw new Error('Complete the guest name, email, and phone fields.');
      }
      if (!guestDetails.plate || !guestDetails.model) throw new Error('Complete the vehicle details.');
      const staff = availableStaff.find(member => member.id === selectedStaff);
      if (!staff) throw new Error('That technician is no longer available. Refresh the page and try again.');
      if (!(await checkAvailability())) return;

      const start = new Date(scheduledTime);
      const end = new Date(start.getTime() + selectedDuration * 60000);
      const customer = customers.find(item => item.id === selectedCustomer);
      const customerName = isNewGuest ? sanitizePersonText(guestDetails.name).trim() : customer?.full_name || 'Customer';
      const customerEmail = isNewGuest ? sanitizeEmail(guestDetails.email).trim() : customer?.email || '';
      const customerPhone = isNewGuest ? sanitizePhone(guestDetails.phone) : customer?.phone_number || '';
      const { data: booking, error: bookingError } = await supabase.from('bookings').insert({
        customer_id: isNewGuest ? null : selectedCustomer,
        customer_name: customerName,
        customer_email: customerEmail || null,
        contact_number: customerPhone,
        start_datetime: start.toISOString(),
        end_datetime: end.toISOString(),
        status: 'scheduled',
        total_amount: selectedPrice,
        staff_id: selectedStaff,
        notes: `WALK-IN | ${selectedBay} | ${isNewGuest ? 'Guest' : 'Existing customer'}${selectedGroup ? ` | FLEET_GROUP:${selectedGroup}` : ''}`
      }).select().single();
      if (bookingError) throw bookingError;

      const { data: vehicle, error: vehicleError } = await supabase.from('booking_vehicles').insert({
        booking_id: booking.id,
        vehicle_type: guestDetails.type,
        brand: sanitizeVehicleText(guestDetails.model).trim().split(' ')[0],
        model: sanitizeVehicleText(guestDetails.model).trim(),
        plate_number: sanitizeVehiclePlate(guestDetails.plate).trim().toUpperCase(),
        status: 'SCHEDULED',
        fleet_group_id: selectedGroup || guestDetails.fleetGroupId || null
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
      setGuestDetails({ name: '', email: '', phone: '', plate: '', model: '', type: 'Sedan' });
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

  const validateStep = step => {
    if (step === 1) {
      if (!isNewGuest && !selectedCustomer) return 'Select an existing customer account.';
      if (isNewGuest && (!sanitizePersonText(guestDetails.name).trim() || !sanitizeEmail(guestDetails.email).trim() || !sanitizePhone(guestDetails.phone))) return 'Complete the guest name, email, and phone fields.';
      if (!guestDetails.plate || !guestDetails.model) return 'Complete the vehicle details.';
    }
    if (step === 2 && (!selectedServiceData || !selectedBay)) return 'Choose a service and bay.';
    if (step === 3 && (!scheduledTime || !selectedStaff)) return 'Choose a start time and technician.';
    return '';
  };

  const goNext = () => {
    const error = validateStep(currentStep);
    if (error) {
      toast.error(error);
      return;
    }
    setCurrentStep(step => Math.min(4, step + 1));
  };

  const stepError = validateStep(currentStep);

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '0.75rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', color: 'var(--admin-text-primary)', fontWeight: '700' };
  const labelStyle = { display: 'block', marginBottom: '0.4rem', fontSize: '0.68rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' };

  const steps = ['Customer & Vehicle', 'Service & Bay', 'Schedule & Staff', 'Review'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
      <PageHeader badge="FRONT DESK" title="WALK-IN BOOKING" subtitle="Create an immediate booking with a live bay and technician check." />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: 0 }}>
        {steps.map((step, index) => <button key={step} type="button" onClick={() => index + 1 < currentStep && setCurrentStep(index + 1)} style={{ flex: 1, padding: isMobile ? '0.65rem 0.25rem' : '0.8rem', background: index + 1 <= currentStep ? 'var(--admin-brand)' : 'var(--admin-card)', color: index + 1 <= currentStep ? '#fff' : 'var(--admin-text-secondary)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', fontWeight: '900', fontSize: isMobile ? '0.58rem' : '0.7rem', cursor: index + 1 < currentStep ? 'pointer' : 'default' }}>{index + 1}. {isMobile ? index + 1 : step}</button>)}
      </div>
      <form noValidate onSubmit={event => { event.preventDefault(); if (currentStep < 4) { goNext(); return; } handleSubmit(event); }} style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius)', padding: isMobile ? '1rem' : '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {currentStep === 1 && <>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}><div><h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--admin-text-primary)' }}><UserPlus size={18} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} /> Customer and vehicle</h2><p style={{ margin: '0.3rem 0 0', color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>Choose an existing account or record a walk-in guest.</p></div><div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}><button type="button" onClick={() => setIsNewGuest(false)} style={{ ...inputStyle, width: 'auto', cursor: 'pointer', background: !isNewGuest ? 'var(--admin-brand)' : 'var(--admin-bg)', color: !isNewGuest ? '#fff' : 'var(--admin-text-primary)' }}>Existing Customer</button><button type="button" onClick={() => setIsNewGuest(true)} style={{ ...inputStyle, width: 'auto', cursor: 'pointer', background: isNewGuest ? 'var(--admin-brand)' : 'var(--admin-bg)', color: isNewGuest ? '#fff' : 'var(--admin-text-primary)' }}>Walk-in Guest</button></div></div>
          {!isNewGuest && <div><label style={labelStyle}>Select Customer</label><select value={selectedCustomer} onChange={event => setSelectedCustomer(event.target.value)} style={inputStyle}><option value="">Choose customer</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.full_name || customer.email} {customer.phone_number ? `(${customer.phone_number})` : ''}</option>)}</select>{selectedCustomer && <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>{visibleCustomerVehicles.map(vehicle => <button type="button" key={vehicle.id} onClick={() => setGuestDetails(prev => ({ ...prev, fleetGroupId: vehicle.fleet_group_id || selectedGroup || null, plate: vehicle.plate_number || '', model: `${vehicle.brand || ''} ${vehicle.model || ''}`.trim(), type: vehicle.type || 'Sedan' }))} style={{ padding: '0.55rem 0.7rem', background: 'var(--admin-bg)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)', borderRadius: '4px', cursor: 'pointer', textAlign: 'left' }}><strong>{vehicle.brand} {vehicle.model}</strong><br /><small>{vehicle.plate_number} · {vehicle.type}</small></button>)}</div>}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1rem' }}><div><label style={labelStyle}>{isNewGuest ? 'Guest name' : 'Vehicle model'}</label><input value={isNewGuest ? guestDetails.name : guestDetails.model} onChange={event => setGuestDetails({ ...guestDetails, [isNewGuest ? 'name' : 'model']: isNewGuest ? sanitizePersonText(event.target.value) : sanitizeVehicleText(event.target.value) })} style={inputStyle} /></div>{isNewGuest && <div><label style={labelStyle}>Guest email</label><input type="email" value={guestDetails.email} onChange={event => setGuestDetails({ ...guestDetails, email: sanitizeEmail(event.target.value) })} style={inputStyle} /> </div>}{isNewGuest && <div><label style={labelStyle}>Phone number</label><input inputMode="numeric" value={guestDetails.phone} onChange={event => setGuestDetails({ ...guestDetails, phone: sanitizePhone(event.target.value) })} style={inputStyle} /></div>}<div><label style={labelStyle}>Plate number</label><input value={guestDetails.plate} onChange={event => setGuestDetails({ ...guestDetails, plate: sanitizeVehiclePlate(event.target.value) })} style={inputStyle} /></div></div><div><label style={labelStyle}>Vehicle type</label><select value={guestDetails.type} onChange={event => { setGuestDetails({ ...guestDetails, type: event.target.value }); setSelectedService(''); }} style={inputStyle}>{VEHICLE_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
        </>}
        {currentStep === 2 && <div><h2 style={{ margin: 0, color: 'var(--admin-text-primary)', fontSize: '1.2rem' }}><Wrench size={18} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} /> Service and bay</h2><div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1rem', marginTop: '1.5rem' }}><div><label style={labelStyle}>Service package</label><select value={selectedService} onChange={event => setSelectedService(event.target.value)} style={inputStyle}><option value="">Choose service</option>{compatibleServices.map(service => <option key={service.id} value={service.id}>{service.name} - ₱{getServicePrice(service, guestDetails.type).toLocaleString()}</option>)}</select></div><div><label style={labelStyle}>Bay allocation</label><select value={selectedBay} onChange={event => setSelectedBay(event.target.value)} style={inputStyle}><option value="">Choose bay</option>{bays.map(bay => <option key={bay.id} value={bay.id}>{bay.name}</option>)}</select></div></div>{selectedServiceData && <p style={{ color: 'var(--admin-brand)', fontWeight: '800' }}>Estimated time: {selectedServiceData.estTime} · ₱{selectedPrice.toLocaleString()}</p>}</div>}
        {currentStep === 3 && <div><h2 style={{ margin: 0, color: 'var(--admin-text-primary)', fontSize: '1.2rem' }}><Calendar size={18} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} /> Schedule and staff</h2><div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1rem', marginTop: '1.5rem' }}><div><label style={labelStyle}>Start time</label><input type="datetime-local" value={scheduledTime} onChange={event => setScheduledTime(event.target.value)} style={inputStyle} /></div><div><label style={labelStyle}>Clocked-in technician</label><select value={selectedStaff} onChange={event => setSelectedStaff(event.target.value)} style={inputStyle}><option value="">Choose technician</option>{availableStaff.map(staff => <option key={staff.id} value={staff.id}>{staff.full_name} ({staff.activeJobsCount}/3 units)</option>)}</select>{availableStaff.length === 0 && <p style={{ color: '#f59e0b', fontSize: '0.75rem' }}><AlertCircle size={14} /> No eligible technician is currently available.</p>}</div></div>{availabilityError && <p style={{ color: '#ef4444', fontWeight: '800' }}>{availabilityError}</p>}</div>}
        {currentStep === 4 && <div><h2 style={{ margin: 0, color: 'var(--admin-text-primary)', fontSize: '1.2rem' }}>Review walk-in booking</h2><div style={{ marginTop: '1.25rem', display: 'grid', gap: '0.75rem', color: 'var(--admin-text-secondary)' }}><div><strong>Customer:</strong> {isNewGuest ? guestDetails.name : customers.find(item => item.id === selectedCustomer)?.full_name}</div><div><strong>Vehicle:</strong> {guestDetails.model} · {guestDetails.plate}</div><div><strong>Service:</strong> {selectedServiceData?.name} · ₱{selectedPrice.toLocaleString()}</div><div><strong>Schedule:</strong> {scheduledTime ? new Date(scheduledTime).toLocaleString() : 'Not selected'}</div><div><strong>Bay:</strong> {selectedBay} · <strong>Technician:</strong> {availableStaff.find(staff => staff.id === selectedStaff)?.full_name || 'Not selected'}</div></div></div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap', borderTop: '1px solid var(--admin-border)', paddingTop: '1.25rem' }}><button type="button" onClick={() => currentStep === 1 ? null : setCurrentStep(step => step - 1)} disabled={currentStep === 1 || submitting} style={{ padding: '0.8rem 1.2rem', background: 'var(--admin-bg)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', fontWeight: '900', cursor: currentStep === 1 ? 'not-allowed' : 'pointer', opacity: currentStep === 1 ? 0.5 : 1 }}>Back</button><div style={{ color: 'var(--admin-text-secondary)', fontWeight: '800', fontSize: '0.75rem', alignSelf: 'center', textAlign: 'center', flex: '1 1 240px' }}>{selectedServiceData ? `Estimated total: ₱${selectedPrice.toLocaleString()}` : 'Walk-in booking'}</div><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '0.35rem', flex: '0 1 240px' }}>{stepError && <div style={{ color: '#f59e0b', fontWeight: '700', fontSize: '0.65rem', textAlign: 'center' }}>* {stepError}</div>}<button type="submit" disabled={loading || submitting || (currentStep < 4 && Boolean(stepError))} style={{ padding: '0.8rem 1.2rem', background: loading || submitting || (currentStep < 4 && stepError) ? 'var(--admin-border)' : 'var(--admin-brand)', color: loading || submitting || (currentStep < 4 && stepError) ? 'var(--admin-text-secondary)' : '#fff', border: `1px solid ${loading || submitting || (currentStep < 4 && stepError) ? 'var(--admin-border)' : 'var(--admin-brand)'}`, borderRadius: 'var(--admin-radius-sm)', fontWeight: '900', cursor: loading || submitting || (currentStep < 4 && stepError) ? 'not-allowed' : 'pointer', opacity: loading || submitting ? 0.5 : 1 }}>{currentStep < 4 ? 'Continue' : submitting ? 'Creating...' : 'Confirm Walk-In'}</button></div></div>
      </form>
    </div>
  );
};

export default AdminWalkInForm;
