import React, { useState } from 'react';
import { CheckCircle2, Circle, Info, Warehouse, AlertTriangle } from 'lucide-react';
import { SERVICES_DATA } from '../../data/servicesCatalog';
import { fetchUserGarage } from '../../services/garageService';
import { calculateEstimatedEnd } from '../../services/bookingService';
import { SHOP_CONFIG } from '../../config/constants';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

const Step2Services = ({ bookingData, setBookingData, activeVehicleIndex = 0, onNext, onBack }) => {
  const vehicle = bookingData.vehicles[activeVehicleIndex];
  const vehicleType = vehicle?.type;
  const currentServices = vehicle?.services || [];
  
  // Initialize with a valid category depending on vehicle type
  const isMotorcycle = vehicleType === 'Regular' || vehicleType === 'Bigbike';
  const initialCategory = isMotorcycle ? 'Motorcycle Specialist' : 'Exclusive Packages';
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  
  // REQ-CST-10: LOAD FROM GARAGE
  const { user } = useAuth();
  const [garageVehicles, setGarageVehicles] = useState([]);
  const [isLoadingGarage, setIsLoadingGarage] = useState(false);

  React.useEffect(() => {
    if (user) {
      setIsLoadingGarage(true);
      fetchUserGarage(user.id)
        .then(data => setGarageVehicles(data))
        .catch(err => console.error('Failed to load garage:', err))
        .finally(() => setIsLoadingGarage(false));
    }
  }, [user]);

  const handleSelectFromGarage = (e) => {
    const vId = e.target.value;
    const selected = garageVehicles.find(v => v.id === vId);
    if (!selected) return;

    const updatedVehicles = [...bookingData.vehicles];
    updatedVehicles[activeVehicleIndex] = {
      ...updatedVehicles[activeVehicleIndex],
      type: selected.type,
      brand: selected.brand,
      model: selected.model,
      plateNumber: selected.plate_number,
      services: [] // Clear services as type might have changed
    };
    setBookingData({ ...bookingData, vehicles: updatedVehicles });
    toast.success(`${selected.brand} loaded from garage!`);
  };

  const canProceed = vehicle?.type && 
                    vehicle?.brand?.trim()?.length >= 1 && 
                    vehicle?.model?.trim()?.length >= 1 && 
                    vehicle?.plateNumber?.trim()?.length >= 1 && 
                    currentServices.length > 0;

  // Generate helpful tooltip for disabled button
  const getDisabledMessage = () => {
    if (!vehicle?.type) return "Please select a vehicle type";
    if (!vehicle?.brand?.trim()) return "Please enter the vehicle brand";
    if (!vehicle?.model?.trim()) return "Please enter the vehicle model";
    if (!vehicle?.plateNumber?.trim() || vehicle.plateNumber.length < 1) return "Please enter the plate number";
    if (currentServices.length === 0) return "Please select at least one service";
    return "";
  };

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
    const price = getPrice(service);
    const exists = currentServices.find(s => s.id === service.id);

    // Pre-check closing-hour cap before adding
    if (!exists) {
      const projected = calculateEstimatedEnd(
        bookingData.date,
        bookingData.time || bookingData.startTime,
        bookingData.vehicles.map((v, i) =>
          i === activeVehicleIndex
            ? { ...v, services: [...(v.services || []), { ...service, price }] }
            : v
        )
      );
      const projEnd = new Date(projected);
      if (projEnd.getHours() >= SHOP_CONFIG.CLOSING_HOUR) {
        toast.error(
          `Adding "${service.name}" would push your booking past our ${SHOP_CONFIG.CLOSING_HOUR > 12 ? SHOP_CONFIG.CLOSING_HOUR - 12 : SHOP_CONFIG.CLOSING_HOUR}:00 PM closing time. Please choose fewer services or book another day.`,
          { duration: 4000 }
        );
        return;
      }
    }

    const updatedVehicles = bookingData.vehicles.map((v, i) => {
      if (i === activeVehicleIndex) {
        const newServices = exists
          ? currentServices.filter(s => s.id !== service.id)
          : [...currentServices, { ...service, price }];
        return { ...v, services: newServices };
      }
      return v;
    });

    setBookingData({ ...bookingData, vehicles: updatedVehicles });
  };

  const calculateSubtotal = () => {
    return currentServices.reduce((sum, service) => sum + service.price, 0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ background: 'rgba(var(--admin-brand-rgb), 0.02)', padding: '1.5rem', borderRadius: 'var(--admin-radius-lg)', border: '1px solid var(--admin-border)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '950', color: 'var(--admin-text-primary)', textTransform: 'uppercase' }}>Vehicle Identification</h3>
            <p style={{ margin: '0.25rem 0 0 0', color: 'var(--admin-text-secondary)', fontSize: '0.75rem', fontWeight: '600' }}>Select your vehicle type to unlock service pricing.</p>
          </div>
          
          {/* Use Same Vehicle Toggle */}
          {vehicle?.useSameVehicle !== undefined && (
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: '1rem', 
              background: 'rgba(var(--admin-brand-rgb), 0.05)', 
              padding: '0.6rem 1.25rem', borderRadius: '8px', 
              border: `1px solid ${vehicle.useSameVehicle ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
              transition: 'all 0.3s ease'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: '950', color: vehicle.useSameVehicle ? 'var(--admin-brand)' : 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Asset Lock</span>
                <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'white' }}>Use Same Vehicle</span>
              </div>
              <button
                onClick={() => {
                  const updatedVehicles = [...bookingData.vehicles];
                  updatedVehicles[activeVehicleIndex].useSameVehicle = !updatedVehicles[activeVehicleIndex].useSameVehicle;
                  setBookingData({ ...bookingData, vehicles: updatedVehicles });
                }}
                style={{
                  width: '40px', height: '20px', borderRadius: '10px', background: vehicle.useSameVehicle ? 'var(--admin-brand)' : '#333',
                  position: 'relative', border: 'none', cursor: 'pointer', transition: 'all 0.3s ease',
                  boxShadow: vehicle.useSameVehicle ? '0 0 10px rgba(var(--admin-brand-rgb), 0.4)' : 'none'
                }}
              >
                <div style={{
                  width: '14px', height: '14px', borderRadius: '50%', background: 'white',
                  position: 'absolute', top: '3px', left: vehicle.useSameVehicle ? '23px' : '3px',
                  transition: 'all 0.3s ease'
                }} />
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-brand)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
              <Warehouse size={12} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} /> Quick-Load from Your Garage
            </label>
            <select 
              onChange={handleSelectFromGarage}
              style={{ width: '100%', padding: '0.85rem 1rem', background: '#1a1c20', border: '1px solid var(--admin-brand)', borderRadius: '8px', color: 'white', fontWeight: '800', outline: 'none' }}
              defaultValue=""
            >
              <option value="" disabled style={{ background: '#1a1c20', color: '#999' }}>{isLoadingGarage ? 'Syncing garage assets...' : 'Select a saved vehicle...'}</option>
              {garageVehicles.map(v => (
                <option key={v.id} value={v.id} style={{ background: '#1a1c20', color: '#fff' }}>{v.brand} {v.model} ({v.plate_number})</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Type</label>
            <select
              value={vehicleType || ''}
              disabled={vehicle.useSameVehicle}
              onChange={(e) => {
                const updatedVehicles = [...bookingData.vehicles];
                updatedVehicles[activeVehicleIndex] = { ...updatedVehicles[activeVehicleIndex], type: e.target.value, services: [] };
                setBookingData({ ...bookingData, vehicles: updatedVehicles });
              }}
              style={{ width: '100%', padding: '0.85rem 1rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '8px', color: 'white', fontWeight: '800', outline: 'none', opacity: vehicle.useSameVehicle ? 0.6 : 1 }}
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
            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Brand</label>
            <input 
              type="text"
              value={vehicle?.brand || ''}
              disabled={vehicle.useSameVehicle}
              onChange={(e) => {
                const updatedVehicles = [...bookingData.vehicles];
                updatedVehicles[activeVehicleIndex] = { ...updatedVehicles[activeVehicleIndex], brand: e.target.value };
                setBookingData({ ...bookingData, vehicles: updatedVehicles });
              }}
              style={{ width: '100%', padding: '0.85rem 1rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '8px', color: 'white', fontWeight: '800', outline: 'none', opacity: vehicle.useSameVehicle ? 0.6 : 1 }}
              placeholder="e.g. Toyota"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Model</label>
            <input 
              type="text"
              value={vehicle?.model || ''}
              disabled={vehicle.useSameVehicle}
              onChange={(e) => {
                const updatedVehicles = [...bookingData.vehicles];
                updatedVehicles[activeVehicleIndex] = { ...updatedVehicles[activeVehicleIndex], model: e.target.value };
                setBookingData({ ...bookingData, vehicles: updatedVehicles });
              }}
              style={{ width: '100%', padding: '0.85rem 1rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '8px', color: 'white', fontWeight: '800', outline: 'none', opacity: vehicle.useSameVehicle ? 0.6 : 1 }}
              placeholder="e.g. Camry"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Plate #</label>
            <input 
              type="text"
              value={vehicle?.plateNumber || ''}
              disabled={vehicle.useSameVehicle}
              onChange={(e) => {
                const updatedVehicles = [...bookingData.vehicles];
                updatedVehicles[activeVehicleIndex] = { ...updatedVehicles[activeVehicleIndex], plateNumber: e.target.value.toUpperCase() };
                setBookingData({ ...bookingData, vehicles: updatedVehicles });
              }}
              style={{ 
                width: '100%', padding: '0.85rem 1rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', 
                borderRadius: '8px', color: 'white', fontWeight: '800', outline: 'none', opacity: vehicle.useSameVehicle ? 0.6 : 1,
                borderColor: (vehicle?.plateNumber && vehicle.plateNumber.length < 1) ? 'var(--admin-brand)' : 'var(--admin-border)'
              }}
              placeholder="e.g. ABC-1234"
            />
          </div>
        </div>
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
              if (price === 0) return null;

              // Project end time if this service were added
              const projectedEnd = calculateEstimatedEnd(
                bookingData.date,
                bookingData.time || bookingData.startTime,
                bookingData.vehicles.map((v, i) =>
                  i === activeVehicleIndex
                    ? { ...v, services: [...(v.services || []), { ...service, price, durationMinutes: service.durationMinutes }] }
                    : v
                )
              );
              const wouldExceedClose = !isSelected && new Date(projectedEnd).getHours() >= SHOP_CONFIG.CLOSING_HOUR;

              return (
                <div
                  key={service.id}
                  onClick={() => !wouldExceedClose && toggleService(service)}
                  className={wouldExceedClose ? '' : 'admin-card-hover'}
                  style={{
                    padding: '1.5rem',
                    background: wouldExceedClose
                      ? 'rgba(245, 158, 11, 0.04)'
                      : isSelected ? 'rgba(var(--admin-brand-rgb), 0.05)' : 'var(--admin-bg)',
                    border: `2px solid ${
                      wouldExceedClose ? 'rgba(245,158,11,0.35)'
                      : isSelected ? 'var(--admin-brand)' : 'var(--admin-border)'
                    }`,
                    borderRadius: 'var(--admin-radius-md)',
                    cursor: wouldExceedClose ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    transition: 'all 0.2s ease',
                    opacity: wouldExceedClose ? 0.75 : 1,
                  }}
                >
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ marginTop: '0.2rem' }}>
                      {wouldExceedClose
                        ? <AlertTriangle size={24} color="#f59e0b" />
                        : isSelected ? <CheckCircle2 size={24} color="var(--admin-brand)" /> : <Circle size={24} color="var(--admin-text-secondary)" />
                      }
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: '900', color: wouldExceedClose ? '#f59e0b' : 'var(--admin-text-primary)' }}>{service.name}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)', lineHeight: 1.5, maxWidth: '400px' }}>{service.desc}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: '800', color: wouldExceedClose ? '#f59e0b' : 'var(--admin-brand)', background: wouldExceedClose ? 'rgba(245,158,11,0.1)' : 'rgba(var(--admin-brand-rgb), 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', width: 'fit-content' }}>
                        {wouldExceedClose
                          ? <><AlertTriangle size={12} /> Exceeds 9 PM closing time</>                          
                          : <><Info size={12} /> Est. Time: {service.estTime}</>}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '950', color: wouldExceedClose ? '#f59e0b' : 'var(--admin-text-primary)' }}>
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
            onClick={onNext}
            disabled={!canProceed}
            title={!canProceed ? getDisabledMessage() : ''}
            style={{
              padding: '1rem 2rem',
              background: canProceed ? 'var(--admin-brand)' : 'var(--admin-bg)',
              color: canProceed ? '#fff' : 'var(--admin-text-secondary)',
              border: `1px solid ${canProceed ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
              borderRadius: 'var(--admin-radius-md)',
              fontWeight: '950',
              fontSize: '1rem',
              cursor: canProceed ? 'pointer' : 'not-allowed',
              opacity: canProceed ? 1 : 0.5,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              transition: 'all 0.3s ease'
            }}
          >
            Next: Select Schedule
          </button>
        </div>
      </div>

    </div>
  );
};

export default Step2Services;
