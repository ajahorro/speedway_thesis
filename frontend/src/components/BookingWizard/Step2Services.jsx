import React, { useEffect, useMemo, useState } from 'react';
import { Car, CheckCircle2, Circle, Layers, Lock, Plus, Trash2, X } from 'lucide-react';
import { getServiceCatalog } from '../../data/servicesCatalog';
import { fetchUserGarage, fetchFleetGroups } from '../../services/garageService';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import { sanitizeVehiclePlate, sanitizeVehicleText, VEHICLE_TYPE_OPTIONS, SHOP_CONFIG } from '../../config/constants';
import { calculateBayUsage } from '../../utils/schedulingUtils';

const newId = () => crypto.randomUUID ? crypto.randomUUID() : `v_${Math.random().toString(36).slice(2)}`;
const emptyVehicle = (manual = false) => ({ id: newId(), type: '', brand: '', model: '', plateNumber: '', services: [], locked: false, manual });
const unitSubtotal = (vehicle) => (vehicle.services || []).reduce((total, service) => total + Number(service.price || service.price_at_booking || 0), 0);
const isMotorcycle = (type) => type === 'Regular' || type === 'Bigbike';
const inputStyle = { width: '100%', padding: '.75rem', background: 'var(--admin-input-bg)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-input-border)', borderRadius: '6px', fontWeight: '700' };

const Step2Services = ({ bookingData, setBookingData, adminMode = false, onNext, onCancel }) => {
  const { user } = useAuth();
  const vehicles = bookingData.vehicles || [];
  const [garageVehicles, setGarageVehicles] = useState([]);
  const [fleetGroups, setFleetGroups] = useState([]);
  const [fleetToAddId, setFleetToAddId] = useState('');
  const [activeCategories, setActiveCategories] = useState({});
  const [maxBays, setMaxBays] = useState(SHOP_CONFIG.MAX_BAYS);
  const SERVICE_CATALOG = getServiceCatalog();

  useEffect(() => {
    const ownerId = bookingData.customerId || user?.id;
    if (!ownerId) return;
    Promise.all([
      fetchUserGarage(ownerId),
      fetchFleetGroups(ownerId),
      supabase.from('business_config').select('slots_per_hour').maybeSingle()
    ])
      .then(([savedVehicles, groups, capacityResult]) => { setGarageVehicles(savedVehicles); setFleetGroups(groups); setMaxBays(Number(capacityResult.data?.slots_per_hour) || SHOP_CONFIG.MAX_BAYS); })
      .catch((error) => console.error('Failed to load garage:', error));
  }, [user, bookingData.customerId]);

  const updateVehicles = (updater) => setBookingData((current) => ({
    ...current,
    vehicles: typeof updater === 'function' ? updater(current.vehicles || []) : updater
  }));
  const isUntouchedUnit = (vehicle) => !vehicle.type && !vehicle.brand && !vehicle.model && !vehicle.plateNumber && !(vehicle.services || []).length;
  const garageVehicleToBookingVehicle = (vehicle, fleetUnitKey = null) => ({
    id: newId(),
    garageVehicleId: vehicle.id,
    fleetGroupId: vehicle.fleet_group_id || null,
    fleetUnitKey,
    locked: true,
    type: vehicle.type,
    brand: vehicle.brand,
    model: vehicle.model,
    plateNumber: vehicle.plate_number,
    services: []
  });

  // A fleet type is one editor unit, but each original vehicle remains in the
  // booking so bay usage, service rows, and payment totals remain accurate.
  const units = useMemo(() => {
    const map = new Map();
    vehicles.forEach((vehicle) => {
      const key = vehicle.fleetUnitKey || vehicle.id;
      const current = map.get(key) || { id: key, vehicles: [], locked: Boolean(vehicle.locked), type: vehicle.type };
      current.vehicles.push(vehicle);
      current.locked = current.locked && Boolean(vehicle.locked);
      map.set(key, current);
    });
    return [...map.values()];
  }, [vehicles]);

  const addGarageVehicle = (savedVehicle) => {
    if (vehicles.some((vehicle) => vehicle.garageVehicleId === savedVehicle.id)) {
      toast.error('This saved vehicle is already included in the booking.');
      return;
    }
    const committedVehicles = vehicles.filter((vehicle) => !isUntouchedUnit(vehicle));
    if (calculateBayUsage([...committedVehicles, savedVehicle]) > maxBays) {
      toast.error(`This booking cannot exceed the ${maxBays}-bay business limit.`);
      return;
    }
    updateVehicles((current) => current.length === 1 && isUntouchedUnit(current[0])
      ? [garageVehicleToBookingVehicle(savedVehicle)]
      : [...current, garageVehicleToBookingVehicle(savedVehicle)]);
  };
  const toggleGarageVehicle = (savedVehicle) => {
    if (isGarageVehicleSelected(savedVehicle)) {
      updateVehicles((current) => current.length === 1
        ? [emptyVehicle()]
        : current.filter((vehicle) => vehicle.garageVehicleId !== savedVehicle.id));
      return;
    }
    addGarageVehicle(savedVehicle);
  };

  const addManualVehicle = () => {
    const committedVehicles = vehicles.filter((vehicle) => !isUntouchedUnit(vehicle));
    if (committedVehicles.length && calculateBayUsage([...committedVehicles, { type: 'Sedan' }]) > maxBays) {
      toast.error(`This booking cannot exceed the ${maxBays}-bay business limit.`);
      return;
    }
    updateVehicles((current) => current.length === 1 && isUntouchedUnit(current[0]) ? [emptyVehicle(true)] : [...current, emptyVehicle(true)]);
  };
  const isGarageVehicleSelected = (savedVehicle) => vehicles.some((vehicle) => vehicle.garageVehicleId === savedVehicle.id);

  const addFleet = async (fleetId = fleetToAddId) => {
    const selectedFleet = fleetGroups.find((group) => group.id === fleetId);
    const fleetVehicles = selectedFleet?.vehicles || [];
    if (!fleetId || !fleetVehicles.length) return;
    const { data: capacityConfig, error } = await supabase.from('business_config').select('slots_per_hour').maybeSingle();
    const maxBays = Number(capacityConfig?.slots_per_hour);
    if (error || !Number.isFinite(maxBays) || maxBays <= 0) {
      toast.error('Fleet capacity is unavailable. Ask an administrator to configure the number of bays.');
      return;
    }
    const committedVehicles = vehicles.filter((vehicle) => !isUntouchedUnit(vehicle));
    const requiredBays = calculateBayUsage([...committedVehicles, ...fleetVehicles]);
    if (requiredBays > maxBays) {
      toast.error(`This fleet needs ${requiredBays} bays, but the business is currently configured for ${maxBays}.`);
      return;
    }
    const existingGarageIds = new Set(vehicles.map((vehicle) => vehicle.garageVehicleId).filter(Boolean));
    const newFleetVehicles = fleetVehicles.filter((vehicle) => !existingGarageIds.has(vehicle.id));
    if (!newFleetVehicles.length) return toast.error('Every vehicle in this fleet is already included.');
    const groupedVehicles = newFleetVehicles.map((vehicle) => garageVehicleToBookingVehicle(vehicle, `fleet:${fleetId}:type:${vehicle.type}`));
    updateVehicles((current) => current.length === 1 && isUntouchedUnit(current[0]) ? groupedVehicles : [...current, ...groupedVehicles]);
    setBookingData((current) => ({ ...current, fleetGroupId: fleetId }));
    toast.success(`${newFleetVehicles.length} fleet vehicle${newFleetVehicles.length === 1 ? '' : 's'} added in ${new Set(newFleetVehicles.map((vehicle) => vehicle.type)).size} service unit${new Set(newFleetVehicles.map((vehicle) => vehicle.type)).size === 1 ? '' : 's'}.`);
  };

  const updateUnit = (unit, patch) => updateVehicles((current) => current.map((vehicle) => unit.vehicles.some((member) => member.id === vehicle.id) ? { ...vehicle, ...patch } : vehicle));
  const removeUnit = (unit) => updateVehicles((current) => current.length === unit.vehicles.length ? [emptyVehicle()] : current.filter((vehicle) => !unit.vehicles.some((member) => member.id === vehicle.id)));
  const categoriesFor = (vehicle) => Object.entries(SERVICE_CATALOG)
    .filter(([category, services]) => (category === 'Motorcycle Specialist') === isMotorcycle(vehicle.type) && services.some((service) => Number(service.prices[vehicle.type]) > 0))
    .map(([category]) => category);
  const categoryFor = (unit) => { const categories = categoriesFor(unit.vehicles[0]); return categories.includes(activeCategories[unit.id]) ? activeCategories[unit.id] : categories[0] || ''; };
  const toggleService = (unit, service) => {
    const selected = unit.vehicles.every((vehicle) => vehicle.services?.some((item) => item.id === service.id));
    const price = Number(service.prices[unit.type] || 0);
    updateVehicles((current) => current.map((vehicle) => unit.vehicles.some((member) => member.id === vehicle.id)
      ? { ...vehicle, services: selected ? vehicle.services.filter((item) => item.id !== service.id) : [...(vehicle.services || []), { ...service, runtime_uuid: newId(), price, price_at_booking: price }] }
      : vehicle));
  };

  const hasVehicleSelection = vehicles.some((vehicle) => vehicle.manual || vehicle.garageVehicleId || vehicle.fleetGroupId || Boolean(vehicle.type && vehicle.brand?.trim() && vehicle.model?.trim() && vehicle.plateNumber?.trim()));
  const hasAdminCustomerDetails = !adminMode || Boolean(bookingData.adminCustomerReady || (bookingData.customerId && bookingData.customerName && bookingData.customerEmail && bookingData.contactNumber));
  const showServiceConfiguration = hasVehicleSelection && hasAdminCustomerDetails;
  const validUnits = showServiceConfiguration && vehicles.length > 0 && calculateBayUsage(vehicles) <= maxBays && vehicles.every((vehicle) => vehicle.type && vehicle.brand?.trim() && vehicle.model?.trim() && vehicle.plateNumber?.trim().length >= 4 && vehicle.services?.length);
  const grandTotal = vehicles.reduce((total, vehicle) => total + unitSubtotal(vehicle), 0);

  return <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
    <style>{`.booking-unit-columns{display:grid;grid-template-columns:1fr}.booking-unit-column{padding:1.25rem;border-top:1px solid var(--admin-border)}.booking-addable-card:hover:not(:disabled){transform:translateY(-4px);border-color:var(--admin-brand)!important;box-shadow:0 10px 20px rgba(var(--admin-brand-rgb),.18)}.booking-addable-card:focus-visible{outline:2px solid var(--admin-brand);outline-offset:2px}@media(min-width:900px){.booking-unit-columns{grid-template-columns:minmax(180px,.75fr) minmax(300px,1.6fr) minmax(220px,.9fr)}.booking-unit-column{border-top:0;border-left:1px solid var(--admin-border)}.booking-unit-column:first-child{border-left:0}}`}</style>
    <section style={{ padding: '1.25rem', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius)', background: 'rgba(var(--admin-brand-rgb), .025)' }}>
      <h2 style={{ margin: 0, color: 'var(--admin-text-primary)', fontSize: '1rem', fontWeight: '950', textTransform: 'uppercase' }}>1. Add vehicle units</h2>
      <p style={{ margin: '.4rem 0 1rem', color: 'var(--admin-text-secondary)', fontSize: '.8rem' }}>Add a saved vehicle, add a fleet, or create a new vehicle. A fleet shares one service unit for every matching vehicle type.</p>
      {fleetGroups.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem', marginBottom: '1rem' }}><div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}><Layers size={16} color="var(--admin-brand)" /><label style={{ color: 'var(--admin-text-secondary)', fontSize: '.72rem', fontWeight: '900', textTransform: 'uppercase' }}>Fleets</label></div><div style={{ display: 'flex', flexWrap: 'wrap', gap: '.75rem' }}>{fleetGroups.map((group) => <button key={group.id} type="button" onClick={() => { setFleetToAddId(group.id); addFleet(group.id); }} className="booking-addable-card" style={{ padding: '.75rem 1rem', display: 'flex', alignItems: 'center', gap: '.5rem', background: 'var(--admin-bg)', color: 'var(--admin-text-primary)', border: `2px solid ${bookingData.fleetGroupId === group.id ? 'var(--admin-brand)' : 'var(--admin-border)'}`, borderRadius: '6px', cursor: 'pointer', textAlign: 'left' }}><Layers size={16} color="var(--admin-brand)" /><span><strong style={{ display: 'block' }}>{group.name}</strong><small style={{ color: 'var(--admin-text-secondary)' }}>{group.vehicles?.length || 0} vehicle units</small></span></button>)}</div></div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.75rem' }}>{garageVehicles.map((vehicle) => {
        const selected = isGarageVehicleSelected(vehicle);
        return <button key={vehicle.id} type="button" onClick={() => toggleGarageVehicle(vehicle)} title={selected ? `Remove ${vehicle.brand} ${vehicle.model} from this booking` : `Add ${vehicle.brand} ${vehicle.model}`} className="booking-addable-card" style={{ padding: '.75rem 1rem', display: 'flex', alignItems: 'center', gap: '.5rem', background: 'var(--admin-bg)', color: 'var(--admin-text-primary)', border: `2px solid ${selected ? 'var(--admin-brand)' : 'var(--admin-border)'}`, borderRadius: '6px', cursor: 'pointer', textAlign: 'left', opacity: selected ? .9 : 1, transition: 'transform .2s ease, border-color .2s ease, box-shadow .2s ease' }}><Car size={16} color="var(--admin-brand)" /><span><strong style={{ display: 'block' }}>{vehicle.brand} {vehicle.model}</strong><small style={{ color: 'var(--admin-text-secondary)' }}>{selected ? 'Added to booking · click to remove' : `${vehicle.plate_number} · ${vehicle.type}`}</small></span></button>;
      })}<button type="button" onClick={addManualVehicle} className="booking-addable-card" style={{ padding: '.75rem 1rem', display: 'flex', alignItems: 'center', gap: '.5rem', background: 'transparent', color: 'var(--admin-brand)', border: '1px dashed var(--admin-brand)', borderRadius: '6px', fontWeight: '900', cursor: 'pointer', transition: 'transform .2s ease, border-color .2s ease, box-shadow .2s ease' }}><Plus size={16} /> ADD NEW VEHICLE</button></div>
    </section>
    {showServiceConfiguration && <section style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div><h2 style={{ margin: 0, color: 'var(--admin-text-primary)', fontSize: '1rem', fontWeight: '950', textTransform: 'uppercase' }}>2. Configure services by unit</h2><p style={{ margin: '.4rem 0 0', color: 'var(--admin-text-secondary)', fontSize: '.8rem' }}>A fleet unit applies its selected services to all of its same-type vehicles.</p></div>
      {units.map((unit, index) => {
        const vehicle = unit.vehicles[0]; const complete = Boolean(vehicle.type && vehicle.brand?.trim() && vehicle.model?.trim() && vehicle.plateNumber?.trim().length >= 4);
        const category = categoryFor(unit); const categories = categoriesFor(vehicle); const services = SERVICE_CATALOG[category] || [];
        const selectedServices = vehicle.services || []; const total = unit.vehicles.reduce((sum, member) => sum + unitSubtotal(member), 0);
        return <article key={unit.id} style={{ overflow: 'hidden', background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius)', boxShadow: 'var(--admin-card-shadow)' }}>
          <header style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', background: 'var(--admin-sidebar)', borderBottom: '1px solid var(--admin-border)' }}><div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', minWidth: 0 }}><span style={{ background: 'var(--admin-brand)', color: '#fff', padding: '.2rem .45rem', borderRadius: '4px', fontSize: '.68rem', fontWeight: '900' }}>UNIT {index + 1}</span><Car size={17} color="var(--admin-brand)" /><strong style={{ color: 'var(--admin-text-primary)' }}>{unit.locked ? `${unit.vehicles.length} saved ${vehicle.type || 'vehicle'}${unit.vehicles.length === 1 ? '' : 's'}` : (vehicle.brand && vehicle.model ? `${vehicle.brand} ${vehicle.model}` : 'New vehicle details required')}</strong></div><button type="button" onClick={() => removeUnit(unit)} aria-label={`Remove unit ${index + 1}`} style={{ background: 'transparent', color: '#ef4444', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '.35rem', fontWeight: '800', fontSize: '.72rem' }}><Trash2 size={15} /> REMOVE</button></header>
          {unit.locked ? <div style={{ padding: '1rem 1.25rem', background: 'var(--admin-bg)', borderBottom: '1px solid var(--admin-border)' }}><div style={{ display: 'flex', alignItems: 'center', gap: '.45rem', color: 'var(--admin-text-secondary)', fontSize: '.7rem', fontWeight: '900', textTransform: 'uppercase', marginBottom: '.6rem' }}><Lock size={14} /> Saved vehicle details are locked</div>{unit.vehicles.map((member) => <div key={member.id} style={{ color: 'var(--admin-text-primary)', fontSize: '.8rem', lineHeight: 1.7 }}>{member.brand} {member.model} · {member.plateNumber} · {member.type}</div>)}</div> : <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '.75rem', borderBottom: '1px solid var(--admin-border)' }}><select aria-label="Vehicle type" value={vehicle.type} onChange={(event) => updateUnit(unit, { type: event.target.value, services: [] })} style={inputStyle}><option value="">Vehicle type</option>{VEHICLE_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><input aria-label="Vehicle brand" value={vehicle.brand} onChange={(event) => updateUnit(unit, { brand: sanitizeVehicleText(event.target.value) })} placeholder="Brand" style={inputStyle} /><input aria-label="Vehicle model" value={vehicle.model} onChange={(event) => updateUnit(unit, { model: sanitizeVehicleText(event.target.value) })} placeholder="Model" style={inputStyle} /><input aria-label="Vehicle plate number" value={vehicle.plateNumber} onChange={(event) => updateUnit(unit, { plateNumber: sanitizeVehiclePlate(event.target.value) })} placeholder="Plate number" style={inputStyle} /></div>}
          <div className="booking-unit-columns" style={{ opacity: complete ? 1 : .45, pointerEvents: complete ? 'auto' : 'none' }}>
            <div className="booking-unit-column"><p style={{ margin: '0 0 .75rem', fontSize: '.68rem', color: 'var(--admin-text-secondary)', fontWeight: '900', textTransform: 'uppercase' }}>A. Service type</p>{categories.map((item) => <button key={item} type="button" onClick={() => setActiveCategories((current) => ({ ...current, [unit.id]: item }))} style={{ width: '100%', marginBottom: '.5rem', padding: '.75rem', textAlign: 'left', borderRadius: '6px', border: `1px solid ${category === item ? 'var(--admin-brand)' : 'var(--admin-border)'}`, background: category === item ? 'var(--admin-brand)' : 'var(--admin-bg)', color: category === item ? '#fff' : 'var(--admin-text-primary)', cursor: 'pointer', fontWeight: '800', fontSize: '.78rem' }}>{item}</button>)}</div>
            <div className="booking-unit-column"><p style={{ margin: '0 0 .75rem', fontSize: '.68rem', color: 'var(--admin-text-secondary)', fontWeight: '900', textTransform: 'uppercase' }}>B. Select services</p>{services.map((service) => { const price = Number(service.prices[vehicle.type] || 0); const selected = unit.vehicles.every((member) => member.services?.some((item) => item.id === service.id)); return price ? <button key={service.id} type="button" onClick={() => toggleService(unit, service)} style={{ width: '100%', marginBottom: '.6rem', padding: '.85rem', display: 'flex', gap: '.75rem', textAlign: 'left', background: selected ? 'rgba(var(--admin-brand-rgb), .08)' : 'var(--admin-bg)', color: 'var(--admin-text-primary)', border: `1px solid ${selected ? 'var(--admin-brand)' : 'var(--admin-border)'}`, borderRadius: '6px', cursor: 'pointer' }}><span>{selected ? <CheckCircle2 size={19} color="var(--admin-brand)" /> : <Circle size={19} color="var(--admin-text-secondary)" />}</span><span style={{ flex: 1 }}><strong style={{ display: 'block', fontSize: '.85rem' }}>{service.name}</strong><small style={{ display: 'block', marginTop: '.2rem', color: 'var(--admin-text-secondary)', lineHeight: 1.4 }}>{service.desc}</small></span><strong style={{ color: 'var(--admin-brand)', whiteSpace: 'nowrap' }}>₱{price.toLocaleString()}</strong></button> : null; })}</div>
            <aside className="booking-unit-column" style={{ background: 'rgba(var(--admin-brand-rgb), .025)', display: 'flex', flexDirection: 'column' }}><p style={{ margin: '0 0 .75rem', fontSize: '.68rem', color: 'var(--admin-text-secondary)', fontWeight: '900', textTransform: 'uppercase' }}>C. Unit summary</p><strong style={{ color: 'var(--admin-text-primary)', fontSize: '.85rem' }}>{unit.locked ? `${unit.vehicles.length} ${vehicle.type} vehicle${unit.vehicles.length === 1 ? '' : 's'}` : `${vehicle.brand} ${vehicle.model}`}</strong><small style={{ color: 'var(--admin-text-secondary)', marginBottom: '1rem' }}>{unit.locked ? 'The selected services apply to every listed vehicle.' : `${vehicle.plateNumber} · ${vehicle.type}`}</small><div style={{ display: 'flex', flexDirection: 'column', gap: '.55rem', flex: 1 }}>{selectedServices.length ? selectedServices.map((service) => <div key={service.id} style={{ display: 'flex', gap: '.5rem', justifyContent: 'space-between', color: 'var(--admin-text-primary)', fontSize: '.78rem' }}><span>{service.name}{unit.vehicles.length > 1 ? ` × ${unit.vehicles.length}` : ''}</span><button type="button" onClick={() => toggleService(unit, service)} aria-label={`Remove ${service.name}`} style={{ color: '#ef4444', background: 'none', border: 0, cursor: 'pointer' }}><X size={15} /></button></div>) : <small style={{ color: 'var(--admin-text-secondary)' }}>No services selected yet.</small>}</div><div style={{ marginTop: '1rem', paddingTop: '.85rem', borderTop: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span style={{ fontSize: '.7rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Unit subtotal</span><strong style={{ color: 'var(--admin-brand)', fontSize: '1.2rem' }}>₱{total.toLocaleString()}</strong></div></aside>
          </div>{!complete && <p style={{ margin: 0, padding: '.75rem 1.25rem', color: 'var(--admin-text-secondary)', fontSize: '.75rem', background: 'var(--admin-bg)' }}>Complete this vehicle's details to unlock its services.</p>}
        </article>;
      })}
    </section>}
    <footer style={{ padding: '1.25rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', background: 'var(--admin-sidebar)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius)' }}><div><span style={{ color: 'var(--admin-text-secondary)', fontWeight: '800', fontSize: '.72rem', textTransform: 'uppercase' }}>Booking estimate · {vehicles.length} vehicle{vehicles.length === 1 ? '' : 's'} in {units.length} unit{units.length === 1 ? '' : 's'}</span><strong style={{ display: 'block', color: 'var(--admin-brand)', fontSize: '1.6rem' }}>₱{grandTotal.toLocaleString()}</strong></div><div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>{onCancel && <button type="button" onClick={onCancel} style={{ padding: '.9rem 1.25rem', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '6px', fontWeight: '900', cursor: 'pointer' }}>CANCEL BOOKING</button>}<button type="button" disabled={!validUnits} title={!validUnits ? 'Complete every vehicle unit and select at least one service for each.' : ''} onClick={onNext} style={{ padding: '.9rem 1.25rem', background: validUnits ? 'var(--admin-brand)' : 'var(--admin-bg)', color: validUnits ? '#fff' : 'var(--admin-text-secondary)', border: `1px solid ${validUnits ? 'var(--admin-brand)' : 'var(--admin-border)'}`, borderRadius: '6px', fontWeight: '900', cursor: validUnits ? 'pointer' : 'not-allowed', opacity: validUnits ? 1 : .5 }}>PROCEED TO SCHEDULE</button></div></footer>
  </div>;
};

export default Step2Services;
