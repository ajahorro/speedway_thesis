import React from 'react';
import { Car, Trash2, Copy, Plus, ChevronRight, Info, Lock, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Step2Services from './Step2Services';
import { supabase } from '../../lib/supabase';
import { calculateBayUsage } from '../../utils/schedulingUtils';
import { SHOP_CONFIG, sanitizeVehiclePlate, sanitizeVehicleText } from '../../config/constants';

const Step3FleetEditing = ({ bookingData, setBookingData, activeVehicleIndex, setActiveVehicleIndex, setCurrentStep, onNext, onBack, isSubTaskActive, setIsSubTaskActive, onCancel }) => {
  const vehicles = bookingData.vehicles || [];

  const parseBookingDateTime = (date, time) => {
    const twelveHourTime = String(time || '').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (twelveHourTime) {
      let hour = Number(twelveHourTime[1]);
      if (twelveHourTime[3].toUpperCase() === 'PM' && hour < 12) hour += 12;
      if (twelveHourTime[3].toUpperCase() === 'AM' && hour === 12) hour = 0;
      return new Date(`${date}T${String(hour).padStart(2, '0')}:${twelveHourTime[2]}:00`);
    }
    return new Date(`${date}T${time}`);
  };

  const [draftVehicle, setDraftVehicle] = React.useState(null);
  const [duplicateSourceIndex, setDuplicateSourceIndex] = React.useState(null);
  const [duplicateDetails, setDuplicateDetails] = React.useState({ brand: '', model: '', plateNumber: '' });
  const [capacityContext, setCapacityContext] = React.useState({ maxBays: SHOP_CONFIG.MAX_BAYS, externalVehicles: [], loading: true });

  React.useEffect(() => {
    let active = true;
    const refreshCapacityContext = async () => {
      const { data: config } = await supabase.from('business_config').select('slots_per_hour').maybeSingle();
      const maxBays = Number(config?.slots_per_hour) || SHOP_CONFIG.MAX_BAYS;
      let externalVehicles = [];
      if (bookingData.date && bookingData.time) {
        const start = parseBookingDateTime(bookingData.date, bookingData.time);
        const currentDuration = vehicles.reduce((longest, vehicle) => Math.max(longest, (vehicle.services || []).reduce((sum, service) => sum + Number(service.durationMinutes || 60), 0)), 0) || 60;
        if (!Number.isNaN(start.getTime())) {
          const end = new Date(start.getTime() + (currentDuration + 60) * 60000);
          const { data: existingBookings } = await supabase
            .from('bookings')
            .select('start_datetime, end_datetime, status, vehicles:booking_vehicles(vehicle_type, status)')
            .lt('start_datetime', end.toISOString())
            .gt('end_datetime', start.toISOString())
            .not('status', 'in', '(cancelled,CANCELLED,released,RELEASED,completed,COMPLETED)');
          externalVehicles = (existingBookings || []).flatMap(booking => (booking.vehicles || []).filter(vehicle => !['COMPLETED', 'RELEASED'].includes(String(vehicle.status || '').toUpperCase())));
        }
      }
      if (active) setCapacityContext({ maxBays, externalVehicles, loading: false });
    };
    refreshCapacityContext();
    return () => { active = false; };
  }, [bookingData.date, bookingData.time, vehicles]);

  const canAddTypeFromSnapshot = vehicleType => vehicles.length < capacityContext.maxBays && calculateBayUsage([
    ...capacityContext.externalVehicles,
    ...vehicles.map(vehicle => ({ type: vehicle.type || vehicle.vehicleType })),
    { type: vehicleType }
  ]) <= capacityContext.maxBays;
  const canAddAnyVehicle = capacityContext.loading || canAddTypeFromSnapshot('Sedan') || vehicles.some(vehicle => canAddTypeFromSnapshot(vehicle.type || 'Sedan'));

  const canAddVehicle = async (vehicleType, candidateServices = []) => {
    const { data: config } = await supabase.from('business_config').select('slots_per_hour').maybeSingle();
    const maxBays = Number(config?.slots_per_hour) || SHOP_CONFIG.MAX_BAYS;
    if (vehicles.length >= maxBays) return false;
    let externalVehicles = [];
    const currentDuration = vehicles.reduce((longest, vehicle) => Math.max(longest, (vehicle.services || []).reduce((sum, service) => sum + Number(service.durationMinutes || 60), 0)), 0) || 60;
    const candidateDuration = (candidateServices || []).reduce((sum, service) => sum + Number(service.durationMinutes || 60), 0) || 60;
    const durationMinutes = Math.max(currentDuration, candidateDuration) + 60;
    if (bookingData.date && bookingData.time) {
      const start = parseBookingDateTime(bookingData.date, bookingData.time);
      if (Number.isNaN(start.getTime())) return false;
      const end = new Date(start.getTime() + durationMinutes * 60000);
      const { data: existingBookings } = await supabase
        .from('bookings')
        .select('id, start_datetime, end_datetime, vehicles:booking_vehicles(vehicle_type, status)')
        .lt('start_datetime', end.toISOString())
        .gt('end_datetime', start.toISOString())
        .not('status', 'in', '(cancelled,CANCELLED,released,RELEASED,completed,COMPLETED)');
      externalVehicles = (existingBookings || []).flatMap(booking => (booking.vehicles || []).filter(vehicle => !['COMPLETED', 'RELEASED'].includes(String(vehicle.status || '').toUpperCase())));
    }
    return calculateBayUsage([
      ...externalVehicles,
      ...vehicles.map(vehicle => ({ type: vehicle.type || vehicle.vehicleType })),
      { type: vehicleType }
    ]) <= maxBays && vehicles.length + 1 <= maxBays;
  };

  const handleAddVehicle = async () => {
    if (!(await canAddVehicle('Sedan'))) {
      toast.error('There is not enough bay capacity for another vehicle during the selected schedule.', { duration: 5000, style: { maxWidth: '480px' } });
      return;
    }

    const newDraft = {
      id: crypto.randomUUID(),
      type: '',
      brand: '',
      model: '',
      plateNumber: '',
      services: []
    };
    setDraftVehicle(newDraft);
    setIsSubTaskActive(true); 
  };

  const commitDraftVehicle = async () => {
    if (!draftVehicle) return;
    if (!(await canAddVehicle(draftVehicle.type || 'Sedan', draftVehicle.services || []))) {
      toast.error('This vehicle would exceed bay capacity during the selected schedule.');
      return;
    }
    setBookingData({
      ...bookingData,
      vehicles: [...vehicles, draftVehicle]
    });
    setDraftVehicle(null);
    setIsSubTaskActive(false);
    toast.success('New vehicle added to fleet!');
  };

  const updateDraftField = (updates) => {
    setDraftVehicle(prev => ({ ...prev, ...updates }));
  };

  const handleCopyVehicle = (e, index) => {
    e.stopPropagation(); // Don't trigger edit navigation
    const source = vehicles[index];
    setDuplicateSourceIndex(index);
    setDuplicateDetails({ brand: '', model: '', plateNumber: '' });
  };

  const confirmDuplicate = async () => {
    if (duplicateSourceIndex === null) return;
    const source = vehicles[duplicateSourceIndex];
    const brand = sanitizeVehicleText(duplicateDetails.brand).trim();
    const model = sanitizeVehicleText(duplicateDetails.model).trim();
    const plateNumber = sanitizeVehiclePlate(duplicateDetails.plateNumber).trim();
    if (!brand || !model || plateNumber.length < 4) {
      toast.error('Enter a brand, model, and a plate number with at least 4 letters or numbers.');
      return;
    }
    let capacityAvailable = false;
    try {
      capacityAvailable = await canAddVehicle(source.type, source.services || []);
    } catch (error) {
      console.error('Duplicate vehicle capacity check failed:', error);
      toast.error('Could not verify bay capacity. Please try again.');
      return;
    }
    if (!capacityAvailable) {
      toast.error('There is not enough bay capacity for another vehicle at this time.');
      return;
    }
    const copy = { ...source, id: crypto.randomUUID(), brand, model, plateNumber, garageVehicleId: undefined, fleetGroupId: source.fleetGroupId || null, locked: false, services: (source.services || []).map(service => ({ ...service, runtime_uuid: crypto.randomUUID() })) };
    setBookingData({ ...bookingData, vehicles: [...vehicles, copy] });
    setDuplicateSourceIndex(null);
    toast.success('Vehicle duplicated with the same services.');
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(null); // stores index to delete

  const handleDeleteVehicle = (e, index) => {
    e.stopPropagation();
    if (vehicles.length <= 1) return;
    setShowDeleteConfirm(index);
  };

  const confirmDelete = () => {
    if (showDeleteConfirm === null) return;
    const index = showDeleteConfirm;
    const updatedVehicles = vehicles.filter((_, i) => i !== index);
    setBookingData({ ...bookingData, vehicles: updatedVehicles });
    
    if (activeVehicleIndex >= updatedVehicles.length) {
      setActiveVehicleIndex(Math.max(0, updatedVehicles.length - 1));
    }
    setShowDeleteConfirm(null);
  };

  const [editingIndex, setEditingIndex] = React.useState(null);

  const handleEditVehicle = (index) => {
    setEditingIndex(index);
  };

  const handleSaveMetadata = () => {
    setEditingIndex(null);
    toast.success('Vehicle details updated!', {
      style: { background: 'var(--admin-card)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)' }
    });
  };

  const updateMetadataField = (field, value) => {
    if (editingIndex === null) return;
    const updatedVehicles = [...vehicles];
    updatedVehicles[editingIndex] = { ...updatedVehicles[editingIndex], [field]: value };
    setBookingData({ ...bookingData, vehicles: updatedVehicles });
  };

  if (isSubTaskActive && draftVehicle) {
    // Virtual state proxy to isolate draft from global fleet
    const virtualBookingData = { ...bookingData, vehicles: [draftVehicle] };
    const virtualSetBookingData = (updater) => setDraftVehicle((currentDraft) => {
      const currentBooking = { ...bookingData, vehicles: [currentDraft] };
      const nextBooking = typeof updater === 'function' ? updater(currentBooking) : updater;
      return nextBooking.vehicles[0];
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ padding: '0.5rem 1rem', background: 'rgba(var(--admin-brand-rgb), 0.1)', border: '1px solid var(--admin-brand)', borderRadius: '4px', width: 'fit-content', color: 'var(--admin-brand)', fontSize: '0.75rem', fontWeight: '900', textTransform: 'uppercase' }}>
          Configuring New Fleet Asset
        </div>
        <Step2Services 
          bookingData={virtualBookingData} 
          setBookingData={virtualSetBookingData} 
          activeVehicleIndex={0} 
          onNext={commitDraftVehicle} 
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>Manage Your Fleet</h2>
        <p style={{ margin: 0, color: 'var(--admin-text-secondary)', fontSize: '0.9rem', fontWeight: '600' }}>
          Review the vehicles in this booking. You can copy details to add more vehicles or click a card to modify its services.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {vehicles.map((v, idx) => (
          <div 
            key={v.id}
            onClick={() => handleEditVehicle(idx)}
            className="admin-card-hover"
            style={{
              background: 'var(--admin-bg)',
              border: '1px solid var(--admin-border)',
              borderRadius: 'var(--admin-radius-lg)',
              padding: '1.5rem',
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 0.3s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(var(--admin-brand-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Car size={20} color="var(--admin-brand)" />
                </div>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>
                    {v.brand || 'Unnamed'} {v.model || 'Vehicle'}
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>
                    {v.type || 'No Type'} • {v.plateNumber || 'No Plate'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {canAddTypeFromSnapshot(v.type || 'Sedan') && <button 
                  onClick={(e) => handleCopyVehicle(e, idx)}
                  style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: '4px', padding: '0.5rem', cursor: 'pointer', color: 'var(--admin-text-secondary)' }}
                  title="Copy Vehicle"
                >
                  <Copy size={16} />
                </button>}
                <button 
                  onClick={(e) => handleDeleteVehicle(e, idx)}
                  disabled={vehicles.length <= 1}
                  style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: '4px', padding: '0.5rem', cursor: idx === 0 && vehicles.length === 1 ? 'not-allowed' : 'pointer', color: '#ef4444' }}
                  title="Remove Vehicle"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div style={{ background: 'var(--admin-card)', borderRadius: 'var(--admin-radius-md)', padding: '1rem', border: '1px solid var(--admin-border)' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                Selected Services ({v.services?.length || 0})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {v.services?.length > 0 ? (
                  v.services.map(s => (
                    <span key={s.id} style={{ fontSize: '0.7rem', fontWeight: '800', background: 'var(--admin-bg)', padding: '0.2rem 0.6rem', borderRadius: '4px', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)' }}>
                      {s.name}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: '800' }}>No services selected. Click to add.</span>
                )}
              </div>
            </div>

            <div style={{ position: 'absolute', right: '1.5rem', bottom: '1.5rem', opacity: 0.2 }}>
              <ChevronRight size={20} />
            </div>
          </div>
        ))}

        {/* Add Vehicle Placeholder Card */}
        {canAddAnyVehicle && <div 
          onClick={handleAddVehicle}
          className="admin-card-hover"
          style={{
            border: '2px dashed var(--admin-border)',
            borderRadius: 'var(--admin-radius-lg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            padding: '2rem',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            minHeight: '180px'
          }}
        >
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(var(--admin-brand-rgb), 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={24} color="var(--admin-brand)" />
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: '950', color: 'var(--admin-brand)', textTransform: 'uppercase' }}>Add Another Vehicle</div>
        </div>}
      </div>

      <div style={{ background: 'rgba(var(--admin-info-rgb), 0.1)', border: '1px solid rgba(var(--admin-info-rgb), 0.2)', padding: '1rem', borderRadius: 'var(--admin-radius-md)', color: 'var(--admin-info)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <Info size={20} />
        <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>
          Multi-vehicle booking is active. Each vehicle can have different services and custom pricing.
        </span>
      </div>

      {/* Action Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--admin-border)', paddingTop: '1.5rem', marginTop: '1rem', gap: '1rem' }}>
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
        <div style={{ position: 'relative' }}>
          {vehicles.length === 0 && (
            <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.4rem 0.8rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '950', textTransform: 'uppercase', border: '1px solid rgba(239, 68, 68, 0.2)', whiteSpace: 'nowrap' }}>
              At least one vehicle required to proceed
            </div>
          )}
          <button 
            onClick={onNext}
            disabled={vehicles.length === 0}
            style={{
              padding: '1rem 2rem',
              background: vehicles.length === 0 ? 'var(--admin-card)' : 'var(--admin-brand)',
              color: vehicles.length === 0 ? 'var(--admin-text-secondary)' : '#fff',
              border: `1px solid ${vehicles.length === 0 ? 'var(--admin-border)' : 'var(--admin-brand)'}`,
              borderRadius: 'var(--admin-radius-md)',
              fontWeight: '950',
              fontSize: '1rem',
              cursor: vehicles.length === 0 ? 'not-allowed' : 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              transition: 'all 0.3s ease',
              opacity: vehicles.length === 0 ? 0.5 : 1
            }}
          >
            Next: Review & Payment
          </button>
        </div>
      </div>
      {/* Delete Confirmation Modal */}
      {duplicateSourceIndex !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem', backdropFilter: 'blur(8px)' }}>
          <div style={{ width: 'min(100%, 440px)', background: 'var(--admin-card)', padding: 'clamp(1.25rem, 5vw, 2rem)', borderRadius: 'var(--admin-radius-lg)', border: '1px solid var(--admin-border)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: 0, color: 'var(--admin-text-primary)', fontSize: '1.25rem', fontWeight: '950' }}>Duplicate vehicle</h3>
            <p style={{ margin: '.35rem 0 0', color: 'var(--admin-text-secondary)', fontSize: '.85rem', lineHeight: 1.5 }}>Enter the new vehicle details. Its services will match the vehicle you duplicated.</p>
            <div style={{ display: 'grid', gap: '.8rem', marginTop: '.4rem' }}>
              <input aria-label="New vehicle brand" placeholder="Brand" value={duplicateDetails.brand} onChange={event => setDuplicateDetails(current => ({ ...current, brand: sanitizeVehicleText(event.target.value) }))} style={{ width: '100%', boxSizing: 'border-box', padding: '.8rem', background: 'var(--admin-input-bg)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-input-border)', borderRadius: '6px', fontWeight: '700' }} />
              <input aria-label="New vehicle model" placeholder="Model" value={duplicateDetails.model} onChange={event => setDuplicateDetails(current => ({ ...current, model: sanitizeVehicleText(event.target.value) }))} style={{ width: '100%', boxSizing: 'border-box', padding: '.8rem', background: 'var(--admin-input-bg)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-input-border)', borderRadius: '6px', fontWeight: '700' }} />
              <input aria-label="New vehicle plate number" minLength={4} pattern="[A-Za-z0-9]{4,}" placeholder="Plate number" value={duplicateDetails.plateNumber} onChange={event => setDuplicateDetails(current => ({ ...current, plateNumber: sanitizeVehiclePlate(event.target.value) }))} style={{ width: '100%', boxSizing: 'border-box', padding: '.8rem', background: 'var(--admin-input-bg)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-input-border)', borderRadius: '6px', fontWeight: '700' }} />
            </div>
            <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'flex-end', marginTop: '1.5rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setDuplicateSourceIndex(null)} style={{ padding: '.8rem 1rem', background: 'transparent', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)', borderRadius: '6px', fontWeight: '900', cursor: 'pointer' }}>CANCEL</button>
              <button type="button" onClick={confirmDuplicate} style={{ padding: '.8rem 1rem', background: 'var(--admin-brand)', color: '#fff', border: '1px solid var(--admin-brand)', borderRadius: '6px', fontWeight: '900', cursor: 'pointer' }}>ADD VEHICLE</button>
            </div>
          </div>
        </div>
      )}
      {showDeleteConfirm !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(10px)' }}>
          <div style={{ background: 'var(--admin-card)', padding: '2.5rem', borderRadius: 'var(--admin-radius-lg)', border: '1px solid var(--admin-border)', width: '100%', maxWidth: '450px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
              <Trash2 size={40} color="#ef4444" />
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '950', color: 'var(--admin-text-primary)', margin: '0 0 1rem 0' }}>Remove Vehicle?</h3>
            <p style={{ color: 'var(--admin-text-secondary)', fontSize: '0.95rem', fontWeight: '600', lineHeight: 1.6, margin: '0 0 2rem 0' }}>
              Are you sure you want to remove <strong>{vehicles[showDeleteConfirm]?.brand} {vehicles[showDeleteConfirm]?.model}</strong> from this booking? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                style={{ flex: 1, padding: '1rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-md)', fontWeight: '900', color: 'var(--admin-text-primary)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                style={{ flex: 1, padding: '1rem', background: '#ef4444', border: 'none', borderRadius: 'var(--admin-radius-md)', fontWeight: '900', color: '#fff', cursor: 'pointer' }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Scoped Metadata Edit Modal */}
      {editingIndex !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(10px)' }}>
          <div style={{ background: 'var(--admin-card)', padding: '2.5rem', borderRadius: 'var(--admin-radius-lg)', border: '1px solid var(--admin-border)', width: '100%', maxWidth: '550px', textAlign: 'left', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', position: 'relative' }}>
            
            {/* Close Button */}
            <button 
              onClick={() => setEditingIndex(null)}
              style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'transparent', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', transition: 'all 0.2s' }}
              className="admin-card-hover"
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(var(--admin-brand-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Car size={24} color="var(--admin-brand)" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '950', color: 'var(--admin-text-primary)', margin: 0, textTransform: 'uppercase' }}>Edit Vehicle Details</h3>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--admin-text-secondary)', fontWeight: '600' }}>Refine your vehicle identification metadata.</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Editable Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: 'var(--admin-text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Brand</label>
                  <input 
                    type="text"
                    value={vehicles[editingIndex].brand}
                    onChange={(e) => updateMetadataField('brand', sanitizeVehicleText(e.target.value))}
                    style={{ width: '100%', padding: '0.75rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '4px', color: 'white', fontWeight: '700' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: 'var(--admin-text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Model</label>
                  <input 
                    type="text"
                    value={vehicles[editingIndex].model}
                    onChange={(e) => updateMetadataField('model', sanitizeVehicleText(e.target.value))}
                    style={{ width: '100%', padding: '0.75rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '4px', color: 'white', fontWeight: '700' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: 'var(--admin-text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Plate Number</label>
                <input 
                  type="text"
                  value={vehicles[editingIndex].plateNumber}
                  minLength={4}
                  pattern="[A-Za-z0-9]{4,}"
                  onChange={(e) => updateMetadataField('plateNumber', sanitizeVehiclePlate(e.target.value))}
                  style={{ width: '100%', padding: '0.75rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '4px', color: 'white', fontWeight: '700' }}
                />
              </div>

              {/* Locked Fields */}
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: 'var(--admin-radius-md)', border: '1px dashed var(--admin-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--admin-text-secondary)', fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase' }}>
                  <Lock size={12} /> Resource Locks (Secured in Step 1 & 2)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--admin-text-primary)', fontWeight: '700' }}>
                    Type: <span style={{ color: 'var(--admin-text-secondary)' }}>{vehicles[editingIndex].type}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--admin-text-primary)', fontWeight: '700' }}>
                    Services: <span style={{ color: 'var(--admin-text-secondary)' }}>{vehicles[editingIndex].services?.map(s => s.name).join(', ')}</span>
                  </div>
                </div>
                <div style={{ marginTop: '0.75rem', fontSize: '0.65rem', color: 'var(--admin-brand)', fontWeight: '700', fontStyle: 'italic' }}>
                  *Changing Type or Services requires re-evaluating schedule occupancy. Use the progress bar above to go back.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button 
                onClick={handleSaveMetadata}
                style={{ flex: 1, padding: '1rem', background: 'var(--admin-brand)', border: 'none', borderRadius: 'var(--admin-radius-md)', fontWeight: '900', color: '#fff', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}
              >
                Save Vehicle Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Step3FleetEditing;
