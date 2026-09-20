import React, { useState } from 'react';
import { CheckCircle2, Circle, Info, Warehouse, Plus, Car, Trash2, X, ChevronDown, ChevronUp, ShoppingBag } from 'lucide-react';
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
  const [isMobileSummaryOpen, setIsMobileSummaryOpen] = useState(false);

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
            .garage-grid {
              display: flex;
              flex-wrap: wrap;
              gap: 0.75rem;
            }
            .garage-card {
              padding: 0.85rem 1rem;
              border-radius: 10px;
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: 0.75rem;
              color: var(--admin-text-primary);
              text-align: left;
              flex: 1 1 160px;
              max-width: 260px;
              min-width: 140px;
              transition: all 0.2s ease;
            }
          `}</style>

          {/* Unified Card Grid: Garage vehicles + Add New card */}
          <div className="garage-grid">
            {garageVehicles.map(v => (
              <button
                key={v.id}
                type="button"
                onClick={() => handleSelectGarageCard(v)}
                className="garage-card"
                style={{
                  border: `2px solid ${activeTab === 'existing' && vehicle?.plateNumber === v.plate_number ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
                  background: activeTab === 'existing' && vehicle?.plateNumber === v.plate_number ? 'rgba(var(--admin-brand-rgb), 0.1)' : 'var(--admin-bg)',
                }}
              >
                <Car size={20} color={activeTab === 'existing' && vehicle?.plateNumber === v.plate_number ? 'var(--admin-brand)' : 'var(--admin-text-secondary)'} />
                <div>
                  <div style={{ fontWeight: '900', fontSize: '0.875rem' }}>{v.brand} {v.model}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--admin-text-secondary)', marginTop: '0.1rem' }}>{v.plate_number} &bull; {v.type}</div>
                </div>
              </button>
            ))}

            <button
              type="button"
              onClick={handleAddNewClick}
              className="garage-card"
              style={{
                border: `2px solid ${activeTab === 'new' ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
                background: activeTab === 'new' ? 'rgba(var(--admin-brand-rgb), 0.1)' : 'var(--admin-bg)',
                justifyContent: 'center',
                color: activeTab === 'new' ? 'var(--admin-brand)' : 'var(--admin-text-secondary)',
                fontWeight: '900',
              }}
            >
              <Plus size={18} />
              Add New Vehicle
            </button>
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
                  width: '100%', padding: '0.85rem 1rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '8px', color: 'var(--admin-text-primary)', fontWeight: '800', outline: 'none'
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
                  width: '100%', padding: '0.85rem 1rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '8px', color: 'var(--admin-text-primary)', fontWeight: '800', outline: 'none'
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
                  width: '100%', padding: '0.85rem 1rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '8px', color: 'var(--admin-text-primary)', fontWeight: '800', outline: 'none'
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
                  width: '100%', padding: '0.85rem 1rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '8px', color: 'var(--admin-text-primary)', fontWeight: '800', outline: 'none',
                  borderColor: (vehicle?.plateNumber && vehicle.plateNumber.length < 1) ? 'var(--admin-brand)' : 'var(--admin-border)'
                }}
                placeholder="e.g. ABC-1234"
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. PROGRESSIVE DISCLOSURE: THREE-COLUMN UNIT VIEW SERVICE CATALOG */}
      {isVehicleComplete && (
        <div style={{ width: '100%', animation: 'fadeInUp 0.35s ease' }}>

          <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          /* Mobile View (< 960px): Accordion & bottom summary strip */
          .mobile-accordion { display: flex; flex-direction: column; gap: 1rem; }
          .unit-view-grid { display: none; }
          
          /* Desktop View (>= 960px): True 3-Column Layout */
          @media (min-width: 960px) {
            .mobile-accordion { display: none; }
            .unit-view-grid { 
              display: grid; 
              grid-template-columns: 210px minmax(0, 1fr) 300px; 
              gap: 1.5rem; 
              align-items: start; 
            }
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

          {/* ======================================================== */}
          {/* DESKTOP VIEW: 3-Column Layout (Cat -> Srv -> Unit View) */}
          {/* ======================================================== */}
          <div className="unit-view-grid">
            {/* Column 1: Category Sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'sticky', top: '1rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.25rem' }}>
                Categories
              </div>
              {availableCategories.map(category => (
                <button
                  key={`desktop-${category}`}
                  onClick={() => setActiveCategory(category)}
                  style={{
                    padding: '0.85rem 1rem', textAlign: 'left',
                    background: activeCategory === category ? 'var(--admin-brand)' : 'var(--admin-bg)',
                    color: activeCategory === category ? '#fff' : 'var(--admin-text-primary)',
                    border: `1px solid ${activeCategory === category ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
                    borderRadius: 'var(--admin-radius-sm)', fontWeight: '900', cursor: 'pointer', transition: 'all 0.2s ease', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.78rem'
                  }}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* Column 2: Service List for Selected Category */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Available Services · {activeCategory || 'Catalog'}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-secondary)', fontWeight: '700' }}>
                  Click to select/unselect
                </span>
              </div>

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
                      padding: '1.25rem',
                      background: isSelected ? 'rgba(var(--admin-brand-rgb), 0.06)' : 'var(--admin-bg)',
                      border: `2px solid ${isSelected ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
                      borderRadius: 'var(--admin-radius-md)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '0.85rem', flex: 1 }}>
                      <div style={{ marginTop: '0.15rem' }}>
                        {isSelected ? <CheckCircle2 size={22} color="var(--admin-brand)" /> : <Circle size={22} color="var(--admin-text-secondary)" />}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, paddingRight: '0.5rem' }}>
                        <div style={{ fontSize: '1rem', fontWeight: '900', color: 'var(--admin-text-primary)' }}>{service.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)', lineHeight: 1.45 }}>{service.desc}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', fontWeight: '800', color: 'var(--admin-brand)', background: 'rgba(var(--admin-brand-rgb), 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', width: 'fit-content' }}>
                          <Info size={11} /> Est. Time: {service.estTime}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: '950', color: 'var(--admin-text-primary)', whiteSpace: 'nowrap' }}>
                      ₱{price.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Column 3: NEW — Live Selected Services & Unit Overview */}
            <div style={{
              background: 'var(--admin-card)',
              border: '1px solid var(--admin-border)',
              borderRadius: 'var(--admin-radius-md)',
              padding: '1.25rem',
              position: 'sticky',
              top: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: 'var(--admin-card-shadow)'
            }}>
              {/* Unit Header Badge */}
              <div style={{ borderBottom: '1px solid var(--admin-border)', paddingBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Unit Overview
                  </span>
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: '900',
                    color: 'var(--admin-brand)',
                    background: 'rgba(var(--admin-brand-rgb), 0.1)',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    textTransform: 'uppercase'
                  }}>
                    {vehicle?.type || 'Unit'}
                  </span>
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: '900', color: 'var(--admin-text-primary)' }}>
                  {vehicle?.brand} {vehicle?.model}
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--admin-text-secondary)', letterSpacing: '0.5px' }}>
                  Plate: {vehicle?.plateNumber || 'Pending'}
                </div>
              </div>

              {/* Selected Services List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>
                    Selected Services ({currentServices.length})
                  </span>
                </div>

                {currentServices.length === 0 ? (
                  <div style={{
                    padding: '1.5rem 0.5rem',
                    textAlign: 'center',
                    background: 'var(--admin-bg)',
                    borderRadius: 'var(--admin-radius-sm)',
                    border: '1px dashed var(--admin-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}>
                    <ShoppingBag size={24} color="var(--admin-text-secondary)" style={{ opacity: 0.5 }} />
                    <span style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--admin-text-secondary)' }}>
                      No services selected yet
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-secondary)', opacity: 0.8 }}>
                      Choose services from the catalog to build this unit.
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '280px', overflowY: 'auto' }}>
                    {currentServices.map(s => (
                      <div
                        key={s.runtime_uuid || s.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.6rem 0.75rem',
                          background: 'var(--admin-bg)',
                          borderRadius: 'var(--admin-radius-sm)',
                          border: '1px solid var(--admin-border)',
                          gap: '0.5rem'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--admin-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', fontWeight: '900', color: 'var(--admin-brand)' }}>
                            ₱{(s.price || 0).toLocaleString()}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleService(s)}
                          title="Remove service"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--admin-text-secondary)',
                            cursor: 'pointer',
                            padding: '0.2rem',
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: '4px',
                            transition: 'color 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--admin-text-secondary)'}
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Unit Subtotal Box */}
              <div style={{
                borderTop: '1px solid var(--admin-border)',
                paddingTop: '0.85rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline'
              }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>
                  Unit Subtotal:
                </span>
                <span style={{ fontSize: '1.25rem', fontWeight: '950', color: 'var(--admin-brand)' }}>
                  ₱{calculateSubtotal().toLocaleString()}
                </span>
              </div>
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
                      padding: '1.1rem 1rem', textAlign: 'left',
                      background: isOpen ? 'var(--admin-brand)' : 'var(--admin-bg)', color: isOpen ? '#fff' : 'var(--admin-text-primary)',
                      border: `1px solid ${isOpen ? 'var(--admin-brand)' : 'var(--admin-border)'}`, borderRadius: 'var(--admin-radius-sm)',
                      fontWeight: '900', cursor: 'pointer', transition: 'all 0.2s ease', textTransform: 'uppercase', letterSpacing: '0.5px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}
                  >
                    <span>{category}</span>
                    <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{isOpen ? '−' : '+'}</span>
                  </button>

                  <div className={`accordion-content ${isOpen ? 'open' : ''}`}>
                    <div className="accordion-inner" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingTop: isOpen ? '0.5rem' : '0', paddingBottom: isOpen ? '1rem' : '0' }}>
                      {SERVICES_DATA[category]?.map(service => {
                        const isSelected = currentServices.some(s => s.id === service.id);
                        const price = getPrice(service);
                        if (price === 0) return null;

                        return (
                          <div
                            key={`mobile-srv-${service.id}`}
                            onClick={() => toggleService(service)}
                            style={{
                              padding: '1.1rem', background: isSelected ? 'rgba(var(--admin-brand-rgb), 0.05)' : 'var(--admin-bg)',
                              border: `2px solid ${isSelected ? 'var(--admin-brand)' : 'var(--admin-border)'}`, borderRadius: 'var(--admin-radius-md)',
                              cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.75rem', transition: 'all 0.2s ease'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                              <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <div style={{ marginTop: '0.1rem' }}>
                                  {isSelected ? <CheckCircle2 size={20} color="var(--admin-brand)" /> : <Circle size={20} color="var(--admin-text-secondary)" />}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                  <div style={{ fontSize: '0.95rem', fontWeight: '900', color: 'var(--admin-text-primary)' }}>{service.name}</div>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)', lineHeight: 1.4 }}>{service.desc}</div>
                                </div>
                              </div>
                              <div style={{ fontSize: '1.05rem', fontWeight: '950', color: 'var(--admin-text-primary)', whiteSpace: 'nowrap' }}>
                                ₱{price.toLocaleString()}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.72rem', fontWeight: '800', color: 'var(--admin-brand)', background: 'rgba(var(--admin-brand-rgb), 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', width: 'fit-content', marginLeft: '2rem' }}>
                              <Info size={11} /> Est. Time: {service.estTime}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Mobile Bottom Collapsible Summary Strip */}
            <div style={{
              background: 'var(--admin-card)',
              border: '1px solid var(--admin-border)',
              borderRadius: 'var(--admin-radius-md)',
              overflow: 'hidden',
              marginTop: '0.5rem'
            }}>
              <button
                type="button"
                onClick={() => setIsMobileSummaryOpen(!isMobileSummaryOpen)}
                style={{
                  width: '100%',
                  padding: '1rem',
                  background: 'var(--admin-bg)',
                  border: 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  color: 'var(--admin-text-primary)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '900', fontSize: '0.85rem' }}>
                  <ShoppingBag size={18} color="var(--admin-brand)" />
                  <span>{currentServices.length} Selected ({vehicle?.type || 'Unit'})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: '950', color: 'var(--admin-brand)', fontSize: '1rem' }}>
                    ₱{calculateSubtotal().toLocaleString()}
                  </span>
                  {isMobileSummaryOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </button>

              {isMobileSummaryOpen && (
                <div style={{ padding: '1rem', borderTop: '1px solid var(--admin-border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--admin-text-secondary)', marginBottom: '0.25rem' }}>
                    {vehicle?.brand} {vehicle?.model} · Plate: {vehicle?.plateNumber || 'Pending'}
                  </div>
                  {currentServices.length === 0 ? (
                    <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', fontStyle: 'italic' }}>
                      No services selected yet.
                    </div>
                  ) : (
                    currentServices.map(s => (
                      <div key={s.runtime_uuid || s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '0.4rem 0', borderBottom: '1px dashed var(--admin-border)' }}>
                        <span style={{ color: 'var(--admin-text-primary)', fontWeight: '700' }}>{s.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: '900', color: 'var(--admin-brand)' }}>₱{(s.price || 0).toLocaleString()}</span>
                          <button
                            type="button"
                            onClick={() => toggleService(s)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.1rem' }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>)}

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