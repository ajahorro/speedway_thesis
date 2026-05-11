import { ChevronRight, ChevronLeft, CheckCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { createBooking } from '../../services/bookingService';
import toast from 'react-hot-toast';
import Step1Schedule from '../../components/BookingWizard/Step1Schedule';
import Step2Services from '../../components/BookingWizard/Step2Services';
import Step3FleetEditing from '../../components/BookingWizard/Step3FleetEditing';
import Step4ReviewPayment from '../../components/BookingWizard/Step4ReviewPayment';
import BookingSuccess from '../../components/BookingWizard/BookingSuccess';

const CustomerBookAppointment = () => {
  const location = useLocation();
  const { user, profile } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [activeVehicleIndex, setActiveVehicleIndex] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize with location state if available (for "Book Again" feature)
  const prefillData = location.state?.prefill;

  // Global Wizard State
  const [bookingData, setBookingData] = useState({
    customerName: profile?.first_name ? `${profile.first_name} ${profile?.last_name || ''}`.trim() : (user?.user_metadata?.first_name ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim() : ''),
    contactNumber: profile?.phone_number || user?.user_metadata?.phone_number || '',
    date: '',
    time: '',
    notes: '',
    vehicles: prefillData ? prefillData.vehicles.map(v => ({
      id: crypto.randomUUID(),
      type: v.vehicle_type || '',
      brand: v.make || '',
      model: v.model || '',
      plateNumber: v.plate_number || '',
      services: v.services?.map(s => ({
        service_id: s.service_id,
        service_name: s.service_name,
        price: s.price
      })) || []
    })) : [
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
    }
  });

  React.useEffect(() => {
    if (prefillData) {
      toast.success('Previous configuration loaded!', {
        icon: '🔄',
        style: { background: 'var(--admin-card)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)' }
      });
    }
  }, [prefillData]);

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
    { num: 1, title: 'Schedule & Vehicle' },
    { num: 2, title: 'Services' },
    { num: 3, title: 'Fleet Editing' },
    { num: 4, title: 'Review & Pay' }
  ];

  if (isSubmitted) {
    return <BookingSuccess bookingData={bookingData} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '95%', margin: '0 auto', width: '100%' }}>
      {/* Header & Progress Bar */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '950', margin: '0 0 1rem 0', textTransform: 'uppercase', color: 'var(--admin-text-primary)' }}>
          Book Appointment
        </h1>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', marginBottom: '2rem' }}>
          {/* Background Track */}
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '4px', background: 'var(--admin-border)', transform: 'translateY(-50%)', zIndex: 0 }} />
          {/* Active Track */}
          <div style={{ position: 'absolute', top: '50%', left: 0, width: `${((currentStep - 1) / 3) * 100}%`, height: '4px', background: 'var(--admin-brand)', transform: 'translateY(-50%)', zIndex: 1, transition: 'width 0.4s ease' }} />

          {steps.map((s) => {
            const isActive = s.num === currentStep;
            const isCompleted = s.num < currentStep;
            return (
              <div key={s.num} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', zIndex: 2, position: 'relative' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: isCompleted ? 'var(--admin-brand)' : isActive ? 'var(--admin-card)' : 'var(--admin-bg)',
                  border: `2px solid ${isActive || isCompleted ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isCompleted ? '#fff' : isActive ? 'var(--admin-brand)' : 'var(--admin-text-secondary)',
                  fontWeight: '900', fontSize: '0.9rem',
                  boxShadow: isActive ? '0 0 15px rgba(var(--admin-brand-rgb), 0.3)' : 'none',
                  transition: 'all 0.3s ease'
                }}>
                  {isCompleted ? <CheckCircle size={16} /> : s.num}
                </div>
                <div style={{
                  position: 'absolute', top: '40px', whiteSpace: 'nowrap',
                  fontSize: '0.7rem', fontWeight: isActive ? '900' : '700',
                  color: isActive ? 'var(--admin-text-primary)' : 'var(--admin-text-secondary)',
                  textTransform: 'uppercase', letterSpacing: '0.5px'
                }}>
                  {s.title}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-lg)', padding: '2rem', boxShadow: 'var(--admin-card-shadow)' }}>
        {currentStep === 1 && <Step1Schedule bookingData={bookingData} setBookingData={setBookingData} activeVehicleIndex={activeVehicleIndex} onNext={nextStep} />}
        {currentStep === 2 && <Step2Services bookingData={bookingData} setBookingData={setBookingData} activeVehicleIndex={activeVehicleIndex} onNext={nextStep} onBack={prevStep} />}
        {currentStep === 3 && <Step3FleetEditing bookingData={bookingData} setBookingData={setBookingData} activeVehicleIndex={activeVehicleIndex} setActiveVehicleIndex={setActiveVehicleIndex} setCurrentStep={setCurrentStep} onNext={nextStep} onBack={prevStep} />}
        {currentStep === 4 && <Step4ReviewPayment bookingData={bookingData} setBookingData={setBookingData} onSubmit={handleSubmit} onBack={prevStep} isSubmitting={isSubmitting} />}
      </div>
    </div>
  );
};

export default CustomerBookAppointment;
