import React, { useState } from 'react';
import { CheckCircle2, Circle, Info } from 'lucide-react';
import { SERVICES_DATA } from '../../data/servicesCatalog';

const Step2Services = ({ bookingData, setBookingData, activeVehicleIndex = 0, onNext, onBack }) => {
  const vehicle = bookingData.vehicles[activeVehicleIndex];
  const vehicleType = vehicle?.type;
  const currentServices = vehicle?.services || [];
  
  // Initialize with a valid category depending on vehicle type
  const isMotorcycle = vehicleType === 'Regular' || vehicleType === 'Bigbike';
  const initialCategory = isMotorcycle ? 'Motorcycle Specialist' : 'Exclusive Packages';
  const [activeCategory, setActiveCategory] = useState(initialCategory);

  // Filter categories based on vehicle type and price availability
  const availableCategories = Object.keys(SERVICES_DATA).filter(category => {
    // 1. Basic Type Logic (Motorcycle vs Others)
    const isCategoryForMotorcycle = category === 'Motorcycle Specialist';
    if (isMotorcycle !== isCategoryForMotorcycle) return false;

    // 2. Availability Logic: Does this category have at least one service with a price for this specific vehicle?
    return SERVICES_DATA[category].some(service => {
      const price = service.prices[vehicleType];
      return price && price > 0;
    });
  });

  // Ensure active category is valid when vehicle type changes
  if (!availableCategories.includes(activeCategory) && availableCategories.length > 0) {
    setActiveCategory(availableCategories[0]);
  }

  // Helper to safely get price
  const getPrice = (service) => {
    if (!vehicleType || !service.prices[vehicleType]) return 0;
    return service.prices[vehicleType];
  };

  const toggleService = (service) => {
    const updatedVehicles = [...bookingData.vehicles];
    const services = [...(updatedVehicles[activeVehicleIndex].services || [])];
    const exists = services.find(s => s.id === service.id);

    if (exists) {
      updatedVehicles[activeVehicleIndex].services = services.filter(s => s.id !== service.id);
    } else {
      const price = getPrice(service);
      updatedVehicles[activeVehicleIndex].services = [...services, { ...service, price }];
    }

    setBookingData({ ...bookingData, vehicles: updatedVehicles });
  };

  const calculateSubtotal = () => {
    return currentServices.reduce((sum, service) => sum + service.price, 0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>Select Services</h2>
        <p style={{ margin: 0, color: 'var(--admin-text-secondary)', fontSize: '0.9rem', fontWeight: '600' }}>
          {vehicleType ? `Displaying services and pricing for your ${vehicleType}.` : 'Please go back and select a vehicle type first.'}
        </p>
      </div>

      {!vehicleType ? (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--admin-radius-md)', padding: '2rem', textAlign: 'center', color: '#ef4444', fontWeight: '800' }}>
          You must select a vehicle type in the previous step to view available services.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 3fr', gap: '2rem', alignItems: 'start' }}>
          
          {/* Category Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {availableCategories.map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                style={{
                  padding: '1rem',
                  textAlign: 'left',
                  background: activeCategory === category ? 'var(--admin-brand)' : 'var(--admin-bg)',
                  color: activeCategory === category ? '#fff' : 'var(--admin-text-primary)',
                  border: `1px solid ${activeCategory === category ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
                  borderRadius: 'var(--admin-radius-sm)',
                  fontWeight: '900',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Service List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {SERVICES_DATA[activeCategory].map(service => {
              const isSelected = currentServices.some(s => s.id === service.id);
              const price = getPrice(service);
              
              if (price === 0) return null; // Hide if no price mapping for this vehicle type

              return (
                <div 
                  key={service.id}
                  onClick={() => toggleService(service)}
                  className="admin-card-hover"
                  style={{
                    padding: '1.5rem',
                    background: isSelected ? 'rgba(var(--admin-brand-rgb), 0.05)' : 'var(--admin-bg)',
                    border: `2px solid ${isSelected ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
                    borderRadius: 'var(--admin-radius-md)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ marginTop: '0.2rem' }}>
                      {isSelected ? <CheckCircle2 size={24} color="var(--admin-brand)" /> : <Circle size={24} color="var(--admin-text-secondary)" />}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--admin-text-primary)' }}>{service.name}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)', lineHeight: 1.5, maxWidth: '400px' }}>{service.desc}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--admin-brand)', background: 'rgba(var(--admin-brand-rgb), 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', width: 'fit-content' }}>
                        <Info size={12} /> Est. Time: {service.estTime}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>
                    ₱{price.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer Subtotal & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--admin-border)', paddingTop: '1.5rem', marginTop: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Current Subtotal</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '950', color: 'var(--admin-brand)' }}>₱{calculateSubtotal().toLocaleString()}</div>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
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
            Back
          </button>
          <button 
            onClick={onNext}
            disabled={currentServices.length === 0 || !vehicleType}
            style={{
              padding: '1rem 2rem',
              background: (currentServices.length > 0 && vehicleType) ? 'var(--admin-brand)' : 'var(--admin-bg)',
              color: (currentServices.length > 0 && vehicleType) ? '#fff' : 'var(--admin-text-secondary)',
              border: `1px solid ${(currentServices.length > 0 && vehicleType) ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
              borderRadius: 'var(--admin-radius-md)',
              fontWeight: '950',
              fontSize: '1rem',
              cursor: (currentServices.length > 0 && vehicleType) ? 'pointer' : 'not-allowed',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              transition: 'all 0.3s ease'
            }}
          >
            Next: Fleet Editing
          </button>
        </div>
      </div>

    </div>
  );
};

export default Step2Services;
