import React, { useState } from 'react';
import { ArrowLeft, Check, CheckCircle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { createBooking } from '../../services/bookingService';
import toast from 'react-hot-toast';
import Step1Schedule from '../../components/BookingWizard/Step1Schedule';
import Step2Services from '../../components/BookingWizard/Step2Services';
import Step3FleetEditing from '../../components/BookingWizard/Step3FleetEditing';
import Step4ReviewPayment from '../../components/BookingWizard/Step4ReviewPayment';
import BookingSuccess from '../../components/BookingWizard/BookingSuccess';
import { SERVICES_DATA } from '../../data/servicesCatalog';

// Utility for Data Integrity: Find service in catalog by name and get current price
const getCatalogServiceByName = (name, type) => {
  for (const cat in SERVICES_DATA) {
    const svc = SERVICES_DATA[cat].find(s => s.name === name);
    if (svc) {
      const price = svc.prices[type] || 0;
      return { ...svc, price };
    }
  }
  return null;
};

const CustomerBookAppointment = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [activeVehicleIndex, setActiveVehicleIndex] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubTaskActive, setIsSubTaskActive] = useState(false); // Tracks nested views (like Adding a Vehicle)

  // REBOOKING LOGIC: Pull from sessionStorage for persistence
  const rebookDataRaw = sessionStorage.getItem('speedway_rebook_data');
  const prefillData = rebookDataRaw ? JSON.parse(rebookDataRaw) : null;
  const isRebooking = !!prefillData;

  // LANDING LOGIC: If rebooking, skip directly to schedule (Step 2)
  const [currentStep, setCurrentStep] = useState(isRebooking ? 2 : 1);

  // Global Wizard State
  const [bookingData, setBookingData] = useState({
    customerName: profile?.first_name ? `${profile.first_name} ${profile?.last_name || ''}`.trim() : (user?.user_metadata?.first_name ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim() : ''),
    contactNumber: profile?.phone_number || user?.user_metadata?.phone_number || '',
    date: '',
    time: '',
    notes: '',
    vehicles: prefillData ? prefillData.vehicles.map(v => {
      const vType = v.vehicle_type || '';
      return {
        id: crypto.randomUUID(),
        type: vType,
        brand: v.brand || '',
        model: v.model || '',
        plateNumber: (v.plate_number || '').toUpperCase(),
        services: v.services?.map(s => getCatalogServiceByName(s.service_name, vType)).filter(Boolean) || []
      };
    }) : [
      {
        id: crypto.randomUUID(),
        type: '',
        brand: '',
        model: '',
        plateNumber: '',
        services: []
      }
    ],
    payment: {
      method: 'GCash', 
      type: 'Full', 
      proofOfPayment: null,
      ocrData: null
    },
    isRebooking // Internal flag
  });

  // Cleanup sessionStorage on mount to ensure fresh start next time
  React.useEffect(() => {
    if (isRebooking) {
      sessionStorage.removeItem('speedway_rebook_data');
      toast.success('Fast-Track Rebooking Active!', {
        icon: '🔄',
        style: { background: 'var(--admin-card)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)' }
      });
    }
  }, [isRebooking]);

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, 4));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await createBooking(user.id, bookingData);
      toast.success('Booking submitted successfully!', {
        style: { background: 'var(--admin-card)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)' }
      });
      setIsSubmitted(true);
    } catch (err) {
      console.error('Booking submission error:', err);
      toast.error(err.message || 'Failed to submit booking.', {
        style: { background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }
      });
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

  if (isSubmitted) {
    return <BookingSuccess bookingData={bookingData} />;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      
      {/* Header with Back Arrow */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
        <button 
          onClick={() => {
            if (isSubTaskActive) {
              setIsSubTaskActive(false); // Close the sub-task first
            } else if (currentStep > 1) {
              setCurrentStep(currentStep - 1);
            } else {
              navigate('/customer/dashboard');
            }
          }}
          className="admin-card-hover"
          style={{ 
            background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', 
            padding: '0.75rem', borderRadius: '50%', color: 'white', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '950', color: 'white', textTransform: 'uppercase' }}>Book Appointment</h1>
          {isRebooking && <div className="pulse-animation" style={{ fontSize: '0.75rem', color: 'var(--admin-brand)', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '0.2rem' }}>🔄 Fast-Track Rebooking Active</div>}
        </div>
      </div>

      {/* Progress Steps (Interactive) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4rem', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '20px', left: '0', right: '0', height: '2px', background: 'var(--admin-border)', zIndex: 0 }} />
        <div style={{ position: 'absolute', top: '20px', left: '0', width: `${((currentStep - 1) / 3) * 100}%`, height: '2px', background: 'var(--admin-brand)', zIndex: 0, transition: 'all 0.5s ease' }} />
        
        {steps.map((step) => (
          <div 
            key={step.num} 
            onClick={() => {
              if (step.num < currentStep || isRebooking) setCurrentStep(step.num);
            }}
            style={{ 
              zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem',
              cursor: (step.num < currentStep || isRebooking) ? 'pointer' : 'default',
              opacity: (step.num <= currentStep) ? 1 : 0.4,
              transition: 'all 0.3s ease'
            }}
          >
            <div style={{ 
              width: '40px', height: '40px', borderRadius: '50%', background: step.num === currentStep ? 'var(--admin-brand)' : (step.num < currentStep ? 'var(--admin-brand)' : 'var(--admin-card)'),
              border: `2px solid ${step.num <= currentStep ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '900',
              boxShadow: step.num === currentStep ? '0 0 15px rgba(var(--admin-brand-rgb), 0.5)' : 'none'
            }}>
              {step.num < currentStep ? <CheckCircle size={20} /> : step.num}
            </div>
            <span style={{ fontSize: '0.7rem', fontWeight: '800', color: step.num === currentStep ? 'white' : 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
              {step.title}
            </span>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-lg)', padding: '2rem', boxShadow: 'var(--admin-card-shadow)' }}>
        {currentStep === 1 && <Step2Services bookingData={bookingData} setBookingData={setBookingData} activeVehicleIndex={activeVehicleIndex} onNext={nextStep} />}
        {currentStep === 2 && <Step1Schedule bookingData={bookingData} setBookingData={setBookingData} activeVehicleIndex={activeVehicleIndex} onNext={nextStep} onBack={prevStep} />}
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
          />
        )}
        {currentStep === 4 && <Step4ReviewPayment bookingData={bookingData} setBookingData={setBookingData} onSubmit={handleSubmit} onBack={prevStep} isSubmitting={isSubmitting} />}
      </div>
    </div>
  );
};

export default CustomerBookAppointment;
