import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, UserPlus, Users, Sparkles, Mail, Phone, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { createBooking } from '../../services/bookingService';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import Step1Schedule from '../../components/BookingWizard/Step1Schedule';
import Step2Services from '../../components/BookingWizard/Step2Services';
import Step3FleetEditing from '../../components/BookingWizard/Step3FleetEditing';
import Step4ReviewPayment from '../../components/BookingWizard/Step4ReviewPayment';
import BookingSuccess from '../../components/BookingWizard/BookingSuccess';
import PageHeader from '../../components/PageHeader';

const AdminWalkInForm = () => {
  const navigate = useNavigate();
  const { user } = useAuth(); // Admin user

  // Customer Selection state
  const [isWalkInGuest, setIsWalkInGuest] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedCustomerData, setSelectedCustomerData] = useState(null);

  // Walk-in Guest state
  const [guestFirstName, setGuestFirstName] = useState('');
  const [guestLastName, setGuestLastName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

  // Wizard Navigation state
  const [currentStep, setCurrentStep] = useState(1);
  const [activeVehicleIndex, setActiveVehicleIndex] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubTaskActive, setIsSubTaskActive] = useState(false);

  // Master Booking Data
  const [bookingData, setBookingData] = useState({
    customerName: '',
    contactNumber: '',
    guestFirstName: '',
    guestLastName: '',
    guestEmail: '',
    guestPhone: '',
    isWalkInGuest: true,
    date: '',
    time: '',
    notes: '',
    vehicles: [
      {
        id: crypto.randomUUID ? crypto.randomUUID() : 'v_' + Math.random().toString(36).substring(2, 9),
        type: '',
        brand: '',
        model: '',
        plateNumber: '',
        services: []
      }
    ],
    payment: {
      method: 'Cash',
      type: 'Full',
      proofOfPayment: null,
      ocrData: null
    }
  });

  // Fetch registered customers for "Existing Customer" option
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, first_name, last_name, email, phone_number')
          .eq('role', 'CUSTOMER')
          .order('full_name', { ascending: true });

        if (error) throw error;
        setCustomers(data || []);
      } catch (err) {
        console.error('Error fetching customers:', err);
      }
    };
    fetchCustomers();
  }, []);

  // Update selected customer data when dropdown changes
  useEffect(() => {
    if (!isWalkInGuest && selectedCustomerId) {
      const cust = customers.find(c => c.id === selectedCustomerId);
      setSelectedCustomerData(cust || null);
      if (cust) {
        setBookingData(prev => ({
          ...prev,
          customerName: cust.full_name || `${cust.first_name || ''} ${cust.last_name || ''}`.trim() || cust.email,
          contactNumber: cust.phone_number || '',
          guestFirstName: cust.first_name || '',
          guestLastName: cust.last_name || '',
          guestEmail: cust.email || '',
          guestPhone: cust.phone_number || '',
          isWalkInGuest: false
        }));
      }
    }
  }, [isWalkInGuest, selectedCustomerId, customers]);

  // Sync Walk-in Guest input fields to bookingData
  useEffect(() => {
    if (isWalkInGuest) {
      const fullName = `${guestFirstName} ${guestLastName}`.trim();
      setBookingData(prev => ({
        ...prev,
        customerName: fullName,
        contactNumber: guestPhone,
        guestFirstName: guestFirstName.trim(),
        guestLastName: guestLastName.trim(),
        guestEmail: guestEmail.trim(),
        guestPhone: guestPhone.trim(),
        isWalkInGuest: true
      }));
    }
  }, [isWalkInGuest, guestFirstName, guestLastName, guestEmail, guestPhone]);

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 4));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const handleCancel = () => {
    setBookingData({
      customerName: '',
      contactNumber: '',
      guestFirstName: '',
      guestLastName: '',
      guestEmail: '',
      guestPhone: '',
      isWalkInGuest: true,
      date: '',
      time: '',
      notes: '',
      vehicles: [
        {
          id: crypto.randomUUID ? crypto.randomUUID() : 'v_' + Math.random().toString(36).substring(2, 9),
          type: '',
          brand: '',
          model: '',
          plateNumber: '',
          services: []
        }
      ],
      payment: {
        method: 'Cash',
        type: 'Full',
        proofOfPayment: null,
        ocrData: null
      }
    });
    setGuestFirstName('');
    setGuestLastName('');
    setGuestEmail('');
    setGuestPhone('');
    setSelectedCustomerId('');
    setSelectedCustomerData(null);
    setCurrentStep(1);
    navigate('/admin/bookings');
  };

  const handleSubmit = async () => {
    // Validate guest information
    if (isWalkInGuest) {
      if (!guestFirstName.trim() || !guestLastName.trim()) {
        toast.error('Please enter the walk-in guest first and last name.');
        return;
      }
      if (!guestEmail.trim()) {
        toast.error('Please enter an email address for notifications and account invite.');
        return;
      }
    } else if (!selectedCustomerId) {
      toast.error('Please select a registered customer.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Customer ID is null for walk-in guests, or selectedCustomerId for registered users
      const targetCustomerId = isWalkInGuest ? null : selectedCustomerId;
      await createBooking(targetCustomerId, bookingData);
      
      toast.success('Walk-in booking created successfully!', {
        style: { background: 'var(--admin-card)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)' }
      });
      setIsSubmitted(true);
    } catch (err) {
      console.error('Walk-in booking creation error:', err);
      toast.error(err.message || 'Failed to create walk-in booking.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { num: 1, title: 'Services & Vehicle' },
    { num: 2, title: 'Schedule' },
    { num: 3, title: 'Fleet Editing' },
    { num: 4, title: 'Review & Pay' }
  ];

  const inputStyle = {
    width: '100%',
    padding: '0.85rem 1rem',
    background: 'var(--admin-bg)',
    border: '1px solid var(--admin-border)',
    borderRadius: 'var(--admin-radius-sm)',
    color: 'var(--admin-text-primary)',
    fontWeight: '700',
    fontSize: '0.85rem',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s ease'
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '0.4rem',
    fontSize: '0.68rem',
    fontWeight: '900',
    color: 'var(--admin-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  };

  if (isSubmitted) {
    return <BookingSuccess bookingData={bookingData} />;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '5rem' }}>
      {/* Page Header */}
      <PageHeader 
        badge="FRONT DESK DISPATCH" 
        title="WALK-IN BOOKING" 
        subtitle="Create an immediate service booking for a walk-in guest or existing customer." 
      />

      {/* ── Top Customer Selection Card ── */}
      <div style={{
        background: 'var(--admin-card)',
        border: '1px solid var(--admin-border)',
        borderRadius: 'var(--admin-radius-lg)',
        padding: '1.5rem',
        marginBottom: '2rem',
        boxShadow: 'var(--admin-card-shadow)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '950', color: 'var(--admin-text-primary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserPlus size={18} color="var(--admin-brand)" /> Customer Identification
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', color: 'var(--admin-text-secondary)', fontSize: '0.75rem', fontWeight: '600' }}>
              Select an existing registered account or record a walk-in guest with an email invite.
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--admin-bg)', padding: '0.25rem', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border)' }}>
            <button
              type="button"
              onClick={() => {
                setIsWalkInGuest(true);
                setSelectedCustomerId('');
                setSelectedCustomerData(null);
              }}
              style={{
                padding: '0.55rem 1.1rem',
                borderRadius: 'calc(var(--admin-radius-sm) - 2px)',
                border: 'none',
                background: isWalkInGuest ? 'var(--admin-brand)' : 'transparent',
                color: isWalkInGuest ? '#fff' : 'var(--admin-text-secondary)',
                fontWeight: '900',
                fontSize: '0.75rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                textTransform: 'uppercase'
              }}
            >
              Walk-In Guest
            </button>
            <button
              type="button"
              onClick={() => {
                setIsWalkInGuest(false);
                setGuestFirstName('');
                setGuestLastName('');
                setGuestEmail('');
                setGuestPhone('');
              }}
              style={{
                padding: '0.55rem 1.1rem',
                borderRadius: 'calc(var(--admin-radius-sm) - 2px)',
                border: 'none',
                background: !isWalkInGuest ? 'var(--admin-brand)' : 'transparent',
                color: !isWalkInGuest ? '#fff' : 'var(--admin-text-secondary)',
                fontWeight: '900',
                fontSize: '0.75rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                textTransform: 'uppercase'
              }}
            >
              Existing Customer
            </button>
          </div>
        </div>

        {/* Dynamic Input Body */}
        {isWalkInGuest ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>
                <User size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> First Name
              </label>
              <input 
                type="text" 
                style={inputStyle} 
                placeholder="e.g. Juan" 
                value={guestFirstName} 
                onChange={e => setGuestFirstName(e.target.value)} 
              />
            </div>
            <div>
              <label style={labelStyle}>
                <User size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> Last Name
              </label>
              <input 
                type="text" 
                style={inputStyle} 
                placeholder="e.g. Dela Cruz" 
                value={guestLastName} 
                onChange={e => setGuestLastName(e.target.value)} 
              />
            </div>
            <div>
              <label style={labelStyle}>
                <Mail size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> Email Address <span style={{ color: 'var(--admin-brand)', fontWeight: 'bold' }}>★</span>
              </label>
              <input 
                type="email" 
                style={inputStyle} 
                placeholder="customer@gmail.com" 
                value={guestEmail} 
                onChange={e => setGuestEmail(e.target.value)} 
              />
            </div>
            <div>
              <label style={labelStyle}>
                <Phone size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> Active Phone Number
              </label>
              <input 
                type="tel" 
                style={inputStyle} 
                placeholder="09XXXXXXXXX" 
                value={guestPhone} 
                onChange={e => setGuestPhone(e.target.value)} 
              />
            </div>
          </div>
        ) : (
          <div>
            <label style={labelStyle}>
              <Users size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> Select Registered Customer
            </label>
            <select
              style={inputStyle}
              value={selectedCustomerId}
              onChange={e => setSelectedCustomerId(e.target.value)}
            >
              <option value="">Choose a registered customer...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email} {c.phone_number ? `(${c.phone_number})` : ''} · {c.email}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Progress Step Bar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3rem', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '20px', left: '0', right: '0', height: '2px', background: 'var(--admin-border)', zIndex: 0 }} />
        <div style={{ position: 'absolute', top: '20px', left: '0', width: `${((currentStep - 1) / 3) * 100}%`, height: '2px', background: 'var(--admin-brand)', zIndex: 0, transition: 'all 0.5s ease' }} />

        {steps.map(step => (
          <div
            key={step.num}
            onClick={() => {
              if (step.num < currentStep) setCurrentStep(step.num);
            }}
            style={{
              zIndex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
              cursor: step.num < currentStep ? 'pointer' : 'default',
              opacity: step.num <= currentStep ? 1 : 0.4,
              transition: 'all 0.3s ease'
            }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: step.num === currentStep ? 'var(--admin-brand)' : (step.num < currentStep ? 'var(--admin-brand)' : 'var(--admin-card)'),
              border: `2px solid ${step.num <= currentStep ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: '900',
              boxShadow: step.num === currentStep ? '0 0 15px rgba(var(--admin-brand-rgb), 0.5)' : 'none'
            }}>
              {step.num < currentStep ? <CheckCircle size={20} /> : step.num}
            </div>
            <span style={{ fontSize: '0.7rem', fontWeight: '800', color: step.num === currentStep ? 'var(--admin-text-primary)' : 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
              {step.title}
            </span>
          </div>
        ))}
      </div>

      {/* ── Wizard Step Content (Inherited Step Components) ── */}
      <div style={{
        background: 'var(--admin-card)',
        border: '1px solid var(--admin-border)',
        borderRadius: 'var(--admin-radius-lg)',
        padding: '2rem',
        boxShadow: 'var(--admin-card-shadow)'
      }}>
        {currentStep === 1 && (
          <Step2Services
            bookingData={bookingData}
            setBookingData={setBookingData}
            activeVehicleIndex={activeVehicleIndex}
            onNext={nextStep}
            onCancel={handleCancel}
          />
        )}
        {currentStep === 2 && (
          <Step1Schedule
            bookingData={bookingData}
            setBookingData={setBookingData}
            activeVehicleIndex={activeVehicleIndex}
            onNext={nextStep}
            onBack={prevStep}
            onCancel={handleCancel}
          />
        )}
        {currentStep === 3 && (
          <Step3FleetEditing
            bookingData={bookingData}
            setBookingData={setBookingData}
            activeVehicleIndex={activeVehicleIndex}
            setActiveVehicleIndex={setActiveVehicleIndex}
            setCurrentStep={setCurrentStep}
            onNext={nextStep}
            onBack={prevStep}
            isSubTaskActive={isSubTaskActive}
            setIsSubTaskActive={setIsSubTaskActive}
            onCancel={handleCancel}
          />
        )}
        {currentStep === 4 && (
          <Step4ReviewPayment
            bookingData={bookingData}
            setBookingData={setBookingData}
            onSubmit={handleSubmit}
            onBack={prevStep}
            isSubmitting={isSubmitting}
            onCancel={handleCancel}
          />
        )}
      </div>
    </div>
  );
};

export default AdminWalkInForm;
