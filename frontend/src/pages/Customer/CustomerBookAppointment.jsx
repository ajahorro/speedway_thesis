import React, { useState } from 'react';
import { ArrowLeft, Check, CheckCircle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { createBooking, rescheduleBooking } from '../../services/bookingService';
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

const hasMeaningfulBookingInput = (data) => {
  if (!data) return false;
  const hasVehicleInput = (data.vehicles || []).some(vehicle => Boolean(
    vehicle?.manual || vehicle?.garageVehicleId || vehicle?.fleetGroupId || vehicle?.type ||
    vehicle?.brand?.trim() || vehicle?.model?.trim() || vehicle?.plateNumber?.trim() || vehicle?.services?.length
  ));
  return Boolean(
    data.date || data.time || data.notes?.trim() || data.customerEmail?.trim() ||
    data.adminCustomerReady || data.fleetGroupId || hasVehicleInput ||
    data.payment?.proofOfPayment
  );
};

const CustomerBookAppointment = ({ adminMode = false, renderAdminPanel, onAdminSubmit }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [activeVehicleIndex, setActiveVehicleIndex] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubTaskActive, setIsSubTaskActive] = useState(false); // Tracks nested views (like Adding a Vehicle)
  const [hasDraftChanges, setHasDraftChanges] = useState(false);
  const [pendingLeave, setPendingLeave] = useState(null);
  const [customerDetailsLocked, setCustomerDetailsLocked] = useState(false);

  // REBOOKING LOGIC: Pull from sessionStorage for persistence
  const rebookDataRaw = sessionStorage.getItem('speedway_rebook_data');
  const prefillData = rebookDataRaw ? JSON.parse(rebookDataRaw) : null;
  const isRescheduling = Boolean(prefillData?.reschedule && prefillData?.id);
  const isRebooking = Boolean(prefillData && !isRescheduling);

  // LANDING LOGIC: If rebooking, skip directly to schedule (Step 2)
  const [currentStep, setCurrentStep] = useState(isRebooking || isRescheduling ? 2 : 1);

  // Global Wizard State
  const [bookingData, setBookingData] = useState(() => {
    const savedDraft = localStorage.getItem('speedway_booking_draft');
    if (savedDraft && !prefillData) {
      try {
        const parsedDraft = JSON.parse(savedDraft);
        if (hasMeaningfulBookingInput(parsedDraft)) return parsedDraft;
        localStorage.removeItem('speedway_booking_draft');
      } catch { localStorage.removeItem('speedway_booking_draft'); }
    }
    return {
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
    };
  });

  React.useEffect(() => {
    if (!hasDraftChanges && !hasMeaningfulBookingInput(bookingData)) return;
    if (!isSubmitted) setHasDraftChanges(true);
  }, [bookingData, hasDraftChanges, isSubmitted]);

  const updateBookingData = updater => {
    setHasDraftChanges(true);
    setBookingData(updater);
  };

  const requestLeave = action => {
    if (!hasDraftChanges || isSubmitted) {
      action();
      return;
    }
    setPendingLeave(() => action);
  };

  React.useEffect(() => {
    if (!isSubmitted && hasDraftChanges) {
      localStorage.setItem('speedway_booking_draft', JSON.stringify(bookingData));
    }
  }, [bookingData, hasDraftChanges, isSubmitted]);

  React.useEffect(() => {
    if (!hasDraftChanges || isSubmitted) return undefined;
    const handleBeforeUnload = event => { event.preventDefault(); event.returnValue = ''; };
    const handleNavigationClick = event => {
      const link = event.target.closest?.('a[href]');
      if (!link || link.target === '_blank' || link.href === window.location.href) return;
        event.preventDefault();
        event.stopPropagation();
        const destination = `${new URL(link.href).pathname}${new URL(link.href).search}${new URL(link.href).hash}`;
        requestLeave(() => navigate(destination));
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleNavigationClick, true);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleNavigationClick, true);
    };
  }, [hasDraftChanges, isSubmitted, navigate]);

  // Cleanup sessionStorage on mount to ensure fresh start next time
  React.useEffect(() => {
    if (isRebooking || isRescheduling) {
      sessionStorage.removeItem('speedway_rebook_data');
      toast.success(isRescheduling ? 'Rescheduling Active!' : 'Fast-Track Rebooking Active!', {
        style: { background: 'var(--admin-card)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)' }
      });
    }
  }, [isRebooking]);

  const nextStep = () => {
    if (adminMode && currentStep === 1 && !bookingData.adminCustomerReady) {
      toast.error('Complete the customer first name, last name, email, and phone before continuing.');
      return;
    }
    if (currentStep === 1) setCustomerDetailsLocked(true);
    setCurrentStep(prev => Math.min(prev + 1, 4));
  };
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (adminMode && !bookingData.adminCustomerReady) {
        throw new Error('Complete the customer first name, last name, email, and phone before continuing.');
      }
      if (isRescheduling && prefillData?.id) {
        await rescheduleBooking(prefillData.id, bookingData);
        sessionStorage.removeItem('speedway_rebook_data');
      } else {
        if (adminMode && onAdminSubmit) await onAdminSubmit(bookingData);
        else await createBooking(user.id, bookingData);
      }
      localStorage.removeItem('speedway_booking_draft');
      setHasDraftChanges(false);
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

  const resetBookingData = () => {
    // 1. Wipe the state back to default
    setBookingData({
      customerName: profile?.first_name ? `${profile.first_name} ${profile?.last_name || ''}`.trim() : (user?.user_metadata?.first_name ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim() : ''),
      contactNumber: profile?.phone_number || user?.user_metadata?.phone_number || '',
      date: '',
      time: '',
      notes: '',
      vehicles: [{ id: crypto.randomUUID ? crypto.randomUUID() : 'v_' + Math.random().toString(36).substring(2, 9), type: '', brand: '', model: '', plateNumber: '', services: [] }],
      payment: {
        method: 'GCash', 
        type: 'Full', 
        proofOfPayment: null,
        ocrData: null
      }
    });
    
  };

  const handleCancelBooking = () => {
    requestLeave(() => {
      resetBookingData();
      setHasDraftChanges(false);
      navigate(adminMode ? '/admin' : '/customer/dashboard');
    });
  };

  if (isSubmitted) {
    return <BookingSuccess bookingData={bookingData} />;
  }

  return (
    <div style={{ paddingBottom: '5rem' }}>
      {/* Responsive Wizard Styling */}
      <style>{`
        /* Desktop Default: Show step titles */
        .step-title { display: block; }

        /* Mobile View: Hide step titles to save horizontal space */
        @media (max-width: 768px) {
          .step-title { display: none; }
        }
      `}</style>
      
      {/* Header with Back Arrow */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
        <button 
          onClick={() => {
            if (isSubTaskActive) {
              setIsSubTaskActive(false); // Close the sub-task first
            } else if (currentStep > 1) {
              setCurrentStep(currentStep - 1);
            } else {
              requestLeave(() => navigate(adminMode ? '/admin' : '/customer'));
            }
          }}
          className="admin-card-hover"
          style={{ 
            background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', 
            padding: '0.75rem', borderRadius: '50%', color: 'var(--admin-text-primary)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 'clamp(1.8rem, 5vw, 2.5rem)', fontWeight: '950', color: 'var(--admin-text-primary)', textTransform: 'uppercase', letterSpacing: '-1.5px' }}>Book Appointment</h1>
          {isRebooking && <div className="pulse-animation" style={{ fontSize: '0.75rem', color: 'var(--admin-brand)', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '0.2rem' }}>Fast-Track Rebooking Active</div>}
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
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: step.num <= currentStep ? '#fff' : 'var(--admin-text-primary)', fontWeight: '900',
              boxShadow: step.num === currentStep ? '0 0 15px rgba(var(--admin-brand-rgb), 0.5)' : 'none'
            }}>
              {step.num < currentStep ? <CheckCircle size={20} /> : step.num}
            </div>
            <span className="step-title" style={{ fontSize: '0.7rem', fontWeight: '800', color: step.num === currentStep ? 'var(--admin-text-primary)' : 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
              {step.title}
            </span>
          </div>
        ))}
      </div>

      {/* Step Content */}
      {adminMode && renderAdminPanel?.({ bookingData, setBookingData: updateBookingData, isCustomerDetailsLocked: customerDetailsLocked })}
      <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-lg)', padding: '2rem', boxShadow: 'var(--admin-card-shadow)' }}>
        {currentStep === 1 && <Step2Services bookingData={bookingData} setBookingData={updateBookingData} adminMode={adminMode} activeVehicleIndex={activeVehicleIndex} onNext={nextStep} onCancel={handleCancelBooking} />}
        {currentStep === 2 && <Step1Schedule bookingData={bookingData} setBookingData={updateBookingData} activeVehicleIndex={activeVehicleIndex} onNext={nextStep} onBack={prevStep} onCancel={handleCancelBooking} customerDetailsLocked={customerDetailsLocked} />}
        {currentStep === 3 && (
          <Step3FleetEditing 
            bookingData={bookingData} 
            setBookingData={updateBookingData} 
            activeVehicleIndex={activeVehicleIndex} 
            setActiveVehicleIndex={setActiveVehicleIndex} 
            setCurrentStep={setCurrentStep} 
            onNext={nextStep} 
            onBack={prevStep}
            isSubTaskActive={isSubTaskActive}
            setIsSubTaskActive={setIsSubTaskActive}
            onCancel={handleCancelBooking}
          />
        )}
        {currentStep === 4 && <Step4ReviewPayment bookingData={bookingData} setBookingData={updateBookingData} adminMode={adminMode} onSubmit={handleSubmit} onBack={prevStep} isSubmitting={isSubmitting} onCancel={handleCancelBooking} />}
      </div>
      {pendingLeave && <div role="dialog" aria-modal="true" aria-labelledby="leave-booking-title" style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0, 0, 0, .72)', backdropFilter: 'blur(6px)' }}>
        <div style={{ width: 'min(100%, 420px)', background: 'var(--admin-card)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-lg)', padding: 'clamp(1.25rem, 5vw, 2rem)', boxShadow: '0 24px 70px rgba(0, 0, 0, .45)' }}>
          <h2 id="leave-booking-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: '950' }}>Leave booking page?</h2>
          <p style={{ margin: '.75rem 0 1.25rem', color: 'var(--admin-text-secondary)', lineHeight: 1.5 }}>Your unsaved booking changes will be lost.</p>
          <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setPendingLeave(null)} style={{ minWidth: '110px', padding: '.75rem 1rem', background: 'transparent', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', fontWeight: '900', cursor: 'pointer' }}>STAY</button>
            <button type="button" onClick={() => { const action = pendingLeave; setPendingLeave(null); setHasDraftChanges(false); localStorage.removeItem('speedway_booking_draft'); action?.(); }} style={{ minWidth: '110px', padding: '.75rem 1rem', background: 'var(--admin-brand)', color: '#fff', border: '1px solid var(--admin-brand)', borderRadius: 'var(--admin-radius-sm)', fontWeight: '900', cursor: 'pointer' }}>LEAVE</button>
          </div>
        </div>
      </div>}
    </div>
  );
};

export default CustomerBookAppointment;
