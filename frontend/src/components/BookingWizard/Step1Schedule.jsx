import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Phone, AlertCircle } from 'lucide-react';
import { getAvailableSlots } from '../../services/scheduleService';
import CustomCalendar from './CustomCalendar';

const Step1Schedule = ({ bookingData, setBookingData, activeVehicleIndex = 0, onNext, onBack }) => {
  const [availableSlots, setAvailableSlots] = useState([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  
  // Calculate total duration for all vehicles
  const totalDuration = (bookingData.vehicles || []).reduce((total, v) => {
    return total + (v.services || []).reduce((sub, s) => sub + (s.durationMinutes || 60), 0);
  }, 0) || 60;

  // Basic validation
  const vehicle = bookingData.vehicles && bookingData.vehicles[activeVehicleIndex] ? bookingData.vehicles[activeVehicleIndex] : {};
  const isValid = bookingData.date && bookingData.time && (bookingData.contactNumber || '').length >= 10 &&
                  (bookingData.customerName || '').trim().length > 0 &&
                  vehicle.type && vehicle.brand && vehicle.model && vehicle.plateNumber;

  // Fetch available slots when date changes (real bay capacity check)
  useEffect(() => {
    if (!bookingData.date) return;

    const fetchSlots = async () => {
      setIsLoadingSlots(true);
      try {
        const slots = await getAvailableSlots(bookingData.date, totalDuration);
        setAvailableSlots(slots);
        
        // Auto-clear time if the selected time is no longer available
        if (bookingData.time && !slots.includes(bookingData.time)) {
          setBookingData(prev => ({ ...prev, time: '' }));
        }
      } catch (error) {
        console.error('Failed to fetch slots', error);
      } finally {
        setIsLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [bookingData.date, totalDuration]); // eslint-disable-line

  const handleDateChange = (e) => {
    setBookingData({ ...bookingData, date: e.target.value });
  };

  const handleTimeSelect = (time) => {
    setBookingData({ ...bookingData, time });
  };

  const handleVehicleChange = (field, value) => {
    const updatedVehicles = [...(bookingData.vehicles || [])];
    if (!updatedVehicles[activeVehicleIndex]) {
      updatedVehicles[activeVehicleIndex] = { id: crypto.randomUUID(), type: '', brand: '', model: '', plateNumber: '', services: [] };
    }
    // Clear services if the type is changing
    if (field === 'type' && updatedVehicles[activeVehicleIndex].type !== value) {
      updatedVehicles[activeVehicleIndex] = { ...updatedVehicles[activeVehicleIndex], [field]: value, services: [] };
    } else {
      updatedVehicles[activeVehicleIndex] = { ...updatedVehicles[activeVehicleIndex], [field]: value };
    }
    
    setBookingData({ ...bookingData, vehicles: updatedVehicles });
  };

  const inputStyle = {
    width: '100%',
    background: 'var(--admin-bg)',
    border: '1px solid var(--admin-border)',
    padding: '1rem 1rem 1rem 1rem',
    borderRadius: 'var(--admin-radius-md)',
    color: 'var(--admin-text-primary)',
    fontSize: '0.95rem',
    outline: 'none',
    boxSizing: 'border-box'
  };

  const iconInputStyle = {
    ...inputStyle,
    paddingLeft: '3rem'
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>Select Schedule</h2>
        <p style={{ margin: 0, color: 'var(--admin-text-secondary)', fontSize: '0.9rem', fontWeight: '600' }}>
          Choose your preferred date and time. Our system automatically filters out full slots based on our 7-bay capacity limit.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        
        {/* Left Col: Contact & Date */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '800', color: 'var(--admin-text-primary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Full Name
            </label>
            <input 
              type="text"
              value={bookingData.customerName || ''}
              onChange={(e) => setBookingData({ ...bookingData, customerName: e.target.value })}
              style={inputStyle}
              placeholder="e.g. John Doe"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '800', color: 'var(--admin-text-primary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Active Contact Number
            </label>
            <div style={{ position: 'relative' }}>
              <Phone size={18} color="var(--admin-brand)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="tel"
                value={bookingData.contactNumber}
                onChange={(e) => setBookingData({ ...bookingData, contactNumber: e.target.value })}
                style={iconInputStyle}
                placeholder="e.g. 09123456789"
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '800', color: 'var(--admin-text-primary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Select Date
            </label>
            <CustomCalendar 
              selectedDate={bookingData.date}
              onDateSelect={(date) => setBookingData({ ...bookingData, date })}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '800', color: 'var(--admin-text-primary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Special Instructions / Notes (Optional)
            </label>
            <textarea 
              value={bookingData.notes || ''}
              onChange={(e) => setBookingData({ ...bookingData, notes: e.target.value })}
              placeholder="e.g. Please take extra care of the leather seats..."
              style={{ ...inputStyle, minHeight: '100px', resize: 'none' }}
            />
          </div>

        </div>

        {/* Right Col: Time Slots & Vehicle Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Time Slots Section */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '800', color: 'var(--admin-text-primary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Available Time Slots
            </label>
            
            {!bookingData.date ? (
              <div style={{ background: 'var(--admin-bg)', border: '1px dashed var(--admin-border)', borderRadius: 'var(--admin-radius-md)', padding: '2rem', textAlign: 'center', color: 'var(--admin-text-secondary)', fontSize: '0.9rem', fontWeight: '600' }}>
                Please select a date first to view available slots.
              </div>
            ) : isLoadingSlots ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--admin-brand)', fontWeight: '900' }}>
                Checking bay capacity...
              </div>
            ) : availableSlots.length === 0 ? (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--admin-radius-md)', padding: '1.5rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: '600', fontSize: '0.9rem' }}>
                <AlertCircle size={20} /> All bays are fully booked for this date. Please choose another day.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.75rem' }}>
                {availableSlots.map(time => (
                  <button
                    key={time}
                    onClick={() => handleTimeSelect(time)}
                    className="admin-card-hover"
                    style={{
                      padding: '1rem 0.5rem',
                      background: bookingData.time === time ? 'var(--admin-brand)' : 'var(--admin-bg)',
                      color: bookingData.time === time ? '#fff' : 'var(--admin-text-primary)',
                      border: `1px solid ${bookingData.time === time ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
                      borderRadius: 'var(--admin-radius-md)',
                      cursor: 'pointer',
                      fontWeight: '900',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Clock size={16} /> {time}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Vehicle Details Section (Relocated) */}
          <div style={{ background: 'rgba(var(--admin-brand-rgb), 0.02)', padding: '1.5rem', borderRadius: 'var(--admin-radius-lg)', border: '1px solid var(--admin-border)' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: '950', color: 'var(--admin-text-primary)', textTransform: 'uppercase' }}>Vehicle Details</h3>
            <p style={{ margin: '0 0 1.5rem 0', color: 'var(--admin-text-secondary)', fontSize: '0.75rem', fontWeight: '600' }}>
              Details of the vehicle you are bringing in.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: 'var(--admin-text-primary)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Type</label>
                <select
                  value={vehicle.type || ''}
                  onChange={(e) => handleVehicleChange('type', e.target.value)}
                  style={{ ...inputStyle, padding: '0.75rem' }}
                >
                  <option value="" disabled>Select Type</option>
                  <option value="Sedan">Sedan</option>
                  <option value="SUV">SUV</option>
                  <option value="Van/L300">Van/L300</option>
                  <option value="Regular">Motorcycle (Regular)</option>
                  <option value="Bigbike">Motorcycle (Bigbike)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: 'var(--admin-text-primary)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Brand</label>
                <input 
                  type="text"
                  value={vehicle.brand || ''}
                  onChange={(e) => handleVehicleChange('brand', e.target.value)}
                  style={{ ...inputStyle, padding: '0.75rem' }}
                  placeholder="e.g. Toyota"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: 'var(--admin-text-primary)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Model</label>
                <input 
                  type="text"
                  value={vehicle.model || ''}
                  onChange={(e) => handleVehicleChange('model', e.target.value)}
                  style={{ ...inputStyle, padding: '0.75rem' }}
                  placeholder="e.g. Camry"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: 'var(--admin-text-primary)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Plate #</label>
                <input 
                  type="text"
                  value={vehicle.plateNumber || ''}
                  onChange={(e) => handleVehicleChange('plateNumber', e.target.value.toUpperCase())}
                  style={{ ...inputStyle, padding: '0.75rem' }}
                  placeholder="e.g. ABC-1234"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--admin-border)', paddingTop: '1.5rem', marginTop: '1rem' }}>
        <button 
          onClick={onBack}
          style={{
            padding: '1rem 2rem',
            background: 'var(--admin-bg)',
            color: 'var(--admin-text-primary)',
            border: '1px solid var(--admin-border)',
            borderRadius: 'var(--admin-radius-md)',
            fontWeight: '950',
            fontSize: '1rem',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}
        >
          Back: Adjust Services
        </button>

        <button 
          onClick={onNext}
          disabled={!isValid}
          style={{
            padding: '1rem 2rem',
            background: isValid ? 'var(--admin-brand)' : 'var(--admin-bg)',
            color: isValid ? '#fff' : 'var(--admin-text-secondary)',
            border: `1px solid ${isValid ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
            borderRadius: 'var(--admin-radius-md)',
            fontWeight: '950',
            fontSize: '1rem',
            cursor: isValid ? 'pointer' : 'not-allowed',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            transition: 'all 0.3s ease'
          }}
        >
          Next: Fleet Editing
        </button>
      </div>

    </div>
  );
};

export default Step1Schedule;
