import React, { useState } from 'react';
import { CheckCircle2, Circle, Info, Warehouse, Plus, Car } from 'lucide-react';
import { SERVICES_DATA } from '../../data/servicesCatalog';
import { fetchUserGarage } from '../../services/garageService';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

const Step2Services = ({ bookingData, setBookingData, activeVehicleIndex = 0, onNext, onBack, onCancel }) => {
  const vehicle = bookingData.vehicles[activeVehicleIndex];
  const vehicleType = vehicle?.type;
  const currentServices = vehicle?.services || [];

  // Initialize with a valid category depending on vehicle type
  const isMotorcycle = vehicleType === 'Regular' || vehicleType === 'Bigbike';
  const initialCategory = isMotorcycle ? 'Motorcycle Specialist' : 'Exclusive Packages';
  const [activeCategory, setActiveCategory] = useState(initialCategory);

  const [activeTab, setActiveTab] = useState('new'); // 'existing' or 'new'

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

  const handleSelectGarageCard = (selected) => {
    setActiveTab('existing');
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

  const handleAddNewClick = () => {
    setActiveTab('new');
    const updatedVehicles = [...bookingData.vehicles];
    updatedVehicles[activeVehicleIndex] = {
      ...updatedVehicles[activeVehicleIndex],
      type: '',
      brand: '',
      model: '',
      plateNumber: '',
      services: []
    };
    setBookingData({ ...bookingData, vehicles: updatedVehicles });
  };

  const isVehicleComplete = Boolean(
    vehicle?.type &&
    vehicle?.brand?.trim()?.length >= 1 &&
    vehicle?.model?.trim()?.length >= 1 &&
    vehicle?.plateNumber?.trim()?.length >= 1
  );

  const canProceed = isVehicleComplete && currentServices.length > 0;

  const getDisabledMessage = () => {
    if (!vehicle?.type) return "Please select a vehicle type";
    if (!vehicle?.brand?.trim()) return "Please enter the vehicle brand";
    if (!vehicle?.model?.trim()) return "Please enter the vehicle model";
    if (!vehicle?.plateNumber?.trim() || vehicle.plateNumber.length < 1) return "Please enter the plate number";
    if (currentServices.length === 0) return "Please select at least one service";
    return "";
  };

  const availableCategories = Object.keys(SERVICES_DATA).filter(category => {
    const isCategoryForMotorcycle = category === 'Motorcycle Specialist';
    if (isMotorcycle !== isCategoryForMotorcycle) return false;
    return SERVICES_DATA[category].some(service => {
      const price = service.prices[vehicleType];
      return price && price > 0;
    });
  });

  // Ensure active category is valid (but allow '' for closed mobile accordions)
  if (activeCategory !== '' && !availableCategories.includes(activeCategory) && availableCategories.length > 0) {
    setActiveCategory(availableCategories[0]);
  }

  const getPrice = (service) => {
    if (!vehicleType || !service.prices[vehicleType]) return 0;
    return service.prices[vehicleType];
  };

  const toggleService = (service) => {
    const price = getPrice(service);
    const exists = currentServices.find(s => s.id === service.id);

    const updatedVehicles = bookingData.vehicles.map((v, i) => {
      if (i === activeVehicleIndex) {
        let newServices;
        if (exists) {
          // Remove the service if it is already selected
          newServices = currentServices.filter(s => s.id !== service.id);
        } else {
          // Add the service with a unique runtime ID and snapshotted price
          const serviceWithIntegrity = {
            ...service,
            runtime_uuid: crypto.randomUUID ? crypto.randomUUID() : 'rt_' + Math.random().toString(36).substring(2, 9),
            price_at_booking: price, // The exact price at the moment of booking
            price: price // We keep this here so your calculateSubtotal() function doesn't break
          };
          newServices = [...currentServices, serviceWithIntegrity];
        }
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

      {/* 1. GARAGE SELECTION UI & VEHICLE FORM */}
      <div style={{ background: 'rgba(var(--admin-brand-rgb), 0.02)', padding: '1.5rem', borderRadius: 'var(--admin-radius-lg)', border: '1px solid var(--admin-border)', marginBottom: '1.5rem' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '950', color: 'var(--admin-text-primary)', textTransform: 'uppercase' }}>Vehicle Identification</h3>
            <p style={{ margin: '0.25rem 0 0 0', color: 'var(--admin-text-secondary)', fontSize: '0.75rem', fontWeight: '600' }}>Select or enter your vehicle to unlock service pricing.</p>
          </div>
        </div>

        {/* Top-Level Garage Selection Cards (Responsive) */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-brand)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            <Warehouse size={12} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} /> Quick-Load from Your Garage
          </label>

          <style>{`
            .garage-desktop { display: none; }
            .garage-mobile { display: block; }
            
            /* Switch to cards only on larger screens */
            @media (min-width: 800px) {
              .garage-desktop { display: flex; flex-wrap: wrap; gap: 1rem; }
              .garage-mobile { display: none; }
            }
          `}</style>

          {/* DESKTOP VIEW: Clickable Cards */}
          <div className="garage-desktop">
            {garageVehicles.map(v => (
              <button
                key={v.id}
                type="button"
                onClick={() => handleSelectGarageCard(v)}
                style={{
                  padding: '1rem', borderRadius: '10px',
                  border: `2px solid ${activeTab === 'existing' && vehicle?.plateNumber === v.plate_number ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
                  background: activeTab === 'existing' && vehicle?.plateNumber === v.plate_number ? 'rgba(var(--admin-brand-rgb), 0.1)' : 'var(--admin-bg)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--admin-text-primary)', textAlign: 'left',
                  flex: '1 1 200px', maxWidth: '300px'
                }}
              >
                <Car size={20} color={activeTab === 'existing' && vehicle?.plateNumber === v.plate_number ? 'var(--admin-brand)' : 'var(--admin-text-secondary)'} />
                <div>
                  <div style={{ fontWeight: '900', fontSize: '0.9rem' }}>{v.brand} {v.model}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)' }}>{v.plate_number}</div>
                </div>
              </button>
            ))}

            <button
              type="button"
              onClick={handleAddNewClick}
              style={{
                padding: '1rem', borderRadius: '10px',
                border: `2px solid ${activeTab === 'new' ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
                background: activeTab === 'new' ? 'rgba(var(--admin-brand-rgb), 0.1)' : 'var(--admin-bg)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                color: activeTab === 'new' ? 'var(--admin-brand)' : 'var(--admin-text-primary)', fontWeight: '900',
                flex: '1 1 200px', maxWidth: '300px'
              }}
            >
              <Plus size={18} />
              Add New Vehicle
            </button>
          </div>

          {/* MOBILE VIEW: Unified Native Dropdown */}
          <div className="garage-mobile">
            <select
              value={activeTab === 'new' ? 'new' : vehicle?.plateNumber || 'new'}
              onChange={(e) => {
                if (e.target.value === 'new') {
                  handleAddNewClick();
                } else {
                  const selected = garageVehicles.find(v => v.plate_number === e.target.value);
                  if (selected) handleSelectGarageCard(selected);
                }
              }}
              style={{
                width: '100%', padding: '1.15rem 1rem', background: 'var(--admin-bg)',
                border: `2px solid var(--admin-brand)`, borderRadius: '10px',
                color: 'white', fontWeight: '900', outline: 'none', fontSize: '1rem',
                appearance: 'none', backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem top 50%', backgroundSize: '0.65rem auto'
              }}
            >
              <option value="new">Add New Vehicle</option>
              {garageVehicles.length > 0 && (
                <optgroup label="Your Garage">
                  {garageVehicles.map(v => (
                    <option key={v.id} value={v.plate_number}>
                      {v.brand} {v.model} ({v.plate_number})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>

        {/* Required Vehicle Information Inputs */}
        {activeTab === 'new' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginTop: '1rem', paddingTop: '1.5rem', borderTop: '1px dashed var(--admin-border)' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Type</label>
              <select
                value={vehicleType || ''}
                onChange={(e) => {
                  const updatedVehicles = [...bookingData.vehicles];
                  updatedVehicles[activeVehicleIndex] = { ...updatedVehicles[activeVehicleIndex], type: e.target.value, services: [] };
                  setBookingData({ ...bookingData, vehicles: updatedVehicles });
                }}
                style={{
                  width: '100%', padding: '0.85rem 1rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '8px', color: 'white', fontWeight: '800', outline: 'none'
                }}
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
                onChange={(e) => {
                  const updatedVehicles = [...bookingData.vehicles];
                  updatedVehicles[activeVehicleIndex] = { ...updatedVehicles[activeVehicleIndex], brand: e.target.value };
                  setBookingData({ ...bookingData, vehicles: updatedVehicles });
                }}
                style={{
                  width: '100%', padding: '0.85rem 1rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '8px', color: 'white', fontWeight: '800', outline: 'none'
                }}
                placeholder="e.g. Toyota"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Model</label>
              <input
                type="text"
                value={vehicle?.model || ''}
                onChange={(e) => {
                  const updatedVehicles = [...bookingData.vehicles];
                  updatedVehicles[activeVehicleIndex] = { ...updatedVehicles[activeVehicleIndex], model: e.target.value };
                  setBookingData({ ...bookingData, vehicles: updatedVehicles });
                }}
                style={{
                  width: '100%', padding: '0.85rem 1rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '8px', color: 'white', fontWeight: '800', outline: 'none'
                }}
                placeholder="e.g. Camry"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Plate #</label>
              <input
                type="text"
                value={vehicle?.plateNumber || ''}
                onChange={(e) => {
                  const updatedVehicles = [...bookingData.vehicles];
                  updatedVehicles[activeVehicleIndex] = { ...updatedVehicles[activeVehicleIndex], plateNumber: e.target.value.toUpperCase() };
                  setBookingData({ ...bookingData, vehicles: updatedVehicles });
                }}
                style={{
                  width: '100%', padding: '0.85rem 1rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '8px', color: 'white', fontWeight: '800', outline: 'none',
                  borderColor: (vehicle?.plateNumber && vehicle.plateNumber.length < 1) ? 'var(--admin-brand)' : 'var(--admin-border)'
                }}
                placeholder="e.g. ABC-1234"
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. PROGRESSIVE DISCLOSURE: RESPONSIVE SERVICE CATALOG */}
      <div style={{
        opacity: isVehicleComplete ? 1 : 0.4,
        pointerEvents: isVehicleComplete ? 'auto' : 'none',
        transition: 'all 0.3s ease',
        width: '100%'
      }}>

        <style>{`
          /* Mobile First: Accordion is visible, Sidebar is hidden */
          .mobile-accordion { display: flex; flex-direction: column; gap: 1rem; }
          .desktop-sidebar { display: none; }
          
          /* Desktop Breakpoint: Sidebar is visible, Accordion is hidden */
          @media (min-width: 800px) {
            .mobile-accordion { display: none; }
            .desktop-sidebar { display: grid; grid-template-columns: minmax(200px, 1fr) 3fr; gap: 2rem; align-items: start; }
          }
          
          /* Smooth Accordion Animation Engine */
          .accordion-content {
            display: grid;
            grid-template-rows: 0fr;
            transition: grid-template-rows 0.3s ease-out, opacity 0.3s ease-out;
            opacity: 0;
          }
          .accordion-content.open {
            grid-template-rows: 1fr;
            opacity: 1;
          }
          .accordion-inner {
            overflow: hidden;
          }
        `}</style>

        {!isVehicleComplete && (
          <div style={{ background: 'var(--admin-bg)', border: '1px dashed var(--admin-border)', padding: '1rem', borderRadius: '8px', color: 'var(--admin-text-secondary)', fontSize: '0.85rem', fontWeight: '700', marginBottom: '1.5rem', textAlign: 'center' }}>
            Complete vehicle information above to unblock service selections.
          </div>
        )}

        {/* ========================================= */}
        {/* DESKTOP VIEW: Sidebar & Active List       */}
        {/* ========================================= */}
        <div className="desktop-sidebar">
          {/* Category Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {availableCategories.map(category => (
              <button
                key={`desktop-${category}`}
                onClick={() => setActiveCategory(category)}
                style={{
                  padding: '1rem', textAlign: 'left',
                  background: activeCategory === category ? 'var(--admin-brand)' : 'var(--admin-bg)',
                  color: activeCategory === category ? '#fff' : 'var(--admin-text-primary)',
                  border: `1px solid ${activeCategory === category ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
                  borderRadius: 'var(--admin-radius-sm)', fontWeight: '900', cursor: 'pointer', transition: 'all 0.2s ease', textTransform: 'uppercase', letterSpacing: '0.5px'
                }}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Service List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {availableCategories.length > 0 && SERVICES_DATA[activeCategory || availableCategories[0]]?.map(service => {
              const isSelected = currentServices.some(s => s.id === service.id);
              const price = getPrice(service);
              if (price === 0) return null;

              return (
                <div
                  key={`desktop-srv-${service.id}`}
                  onClick={() => toggleService(service)}
                  className="admin-card-hover"
                  style={{
                    padding: '1.5rem', background: isSelected ? 'rgba(var(--admin-brand-rgb), 0.05)' : 'var(--admin-bg)',
                    border: `2px solid ${isSelected ? 'var(--admin-brand)' : 'var(--admin-border)'}`, borderRadius: 'var(--admin-radius-md)',
                    cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', transition: 'all 0.2s ease'
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

        {/* ========================================= */}
        {/* MOBILE VIEW: Animated Accordion           */}
        {/* ========================================= */}
        <div className="mobile-accordion">
          {availableCategories.map(category => {
            const isOpen = activeCategory === category;

            return (
              <div key={`mobile-${category}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                  onClick={() => setActiveCategory(isOpen ? '' : category)}
                  style={{
                    padding: '1.25rem 1rem', textAlign: 'left',
                    background: isOpen ? 'var(--admin-brand)' : 'var(--admin-bg)', color: isOpen ? '#fff' : 'var(--admin-text-primary)',
                    border: `1px solid ${isOpen ? 'var(--admin-brand)' : 'var(--admin-border)'}`, borderRadius: 'var(--admin-radius-sm)',
                    fontWeight: '900', cursor: 'pointer', transition: 'all 0.2s ease', textTransform: 'uppercase', letterSpacing: '0.5px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}
                >
                  {category}
                  <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{isOpen ? '−' : '+'}</span>
                </button>

                <div className={`accordion-content ${isOpen ? 'open' : ''}`}>
                  <div className="accordion-inner" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: isOpen ? '0.5rem' : '0', paddingBottom: isOpen ? '1rem' : '0' }}>
                    {SERVICES_DATA[category]?.map(service => {
                      const isSelected = currentServices.some(s => s.id === service.id);
                      const price = getPrice(service);
                      if (price === 0) return null;

                      return (
                        <div
                          key={`mobile-srv-${service.id}`}
                          onClick={() => toggleService(service)}
                          style={{
                            padding: '1.25rem', background: isSelected ? 'rgba(var(--admin-brand-rgb), 0.05)' : 'var(--admin-bg)',
                            border: `2px solid ${isSelected ? 'var(--admin-brand)' : 'var(--admin-border)'}`, borderRadius: 'var(--admin-radius-md)',
                            cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '1rem', transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                              <div style={{ marginTop: '0.1rem' }}>
                                {isSelected ? <CheckCircle2 size={20} color="var(--admin-brand)" /> : <Circle size={20} color="var(--admin-text-secondary)" />}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <div style={{ fontSize: '1rem', fontWeight: '900', color: 'var(--admin-text-primary)' }}>{service.name}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)', lineHeight: 1.4 }}>{service.desc}</div>
                              </div>
                            </div>
                            <div style={{ fontSize: '1.1rem', fontWeight: '950', color: 'var(--admin-text-primary)', whiteSpace: 'nowrap' }}>
                              ₱{price.toLocaleString()}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--admin-brand)', background: 'rgba(var(--admin-brand-rgb), 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', width: 'fit-content', marginLeft: '2.25rem' }}>
                            <Info size={12} /> Est. Time: {service.estTime}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Subtotal & Actions */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'space-between', alignItems: 'center',
        borderTop: '1px solid var(--admin-border)', paddingTop: '1.5rem', marginTop: '1.5rem'
      }}>
        <div style={{ flex: '1 1 auto' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Current Subtotal</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '950', color: 'var(--admin-brand)' }}>₱{calculateSubtotal().toLocaleString()}</div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {onCancel && (
            <button 
              type="button" 
              onClick={onCancel} 
              style={{ 
                background: 'transparent', 
                border: '1px solid #ef4444', 
                color: '#ef4444', 
                padding: '1rem 2rem', 
                borderRadius: 'var(--admin-radius-md)', 
                fontWeight: '950', 
                cursor: 'pointer', 
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}
            >
              Cancel Booking
            </button>
          )}

          <button
            onClick={onNext}
            disabled={!canProceed}
            title={!canProceed ? getDisabledMessage() : ''}
            style={{
              flex: '1 1 auto', minWidth: '200px', padding: '1rem 2rem',
              background: canProceed ? 'var(--admin-brand)' : 'var(--admin-bg)', color: canProceed ? '#fff' : 'var(--admin-text-secondary)',
              border: `1px solid ${canProceed ? 'var(--admin-brand)' : 'var(--admin-border)'}`, borderRadius: 'var(--admin-radius-md)',
              fontWeight: '950', fontSize: '1rem', cursor: canProceed ? 'pointer' : 'not-allowed', opacity: canProceed ? 1 : 0.5,
              textTransform: 'uppercase', letterSpacing: '1px', transition: 'all 0.3s ease', textAlign: 'center'
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