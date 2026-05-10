import React from 'react';
import { Car, Trash2, Copy, Plus, ChevronRight, Info } from 'lucide-react';

const Step3FleetEditing = ({ bookingData, setBookingData, activeVehicleIndex, setActiveVehicleIndex, setCurrentStep, onNext, onBack }) => {
  const vehicles = bookingData.vehicles || [];

  const handleAddVehicle = () => {
    const newVehicle = {
      id: crypto.randomUUID(),
      type: '',
      brand: '',
      model: '',
      plateNumber: '',
      services: []
    };
    const updatedVehicles = [...vehicles, newVehicle];
    setBookingData({ ...bookingData, vehicles: updatedVehicles });
    setActiveVehicleIndex(updatedVehicles.length - 1);
    setCurrentStep(1); // Go back to Step 1 for new vehicle
  };

  const handleCopyVehicle = (e, index) => {
    e.stopPropagation(); // Don't trigger edit navigation
    const source = vehicles[index];
    const copy = {
      ...source,
      id: crypto.randomUUID(),
      // Keep services and specs the same as per user request
    };
    setBookingData({ ...bookingData, vehicles: [...vehicles, copy] });
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

  const handleEditVehicle = (index) => {
    setActiveVehicleIndex(index);
    setCurrentStep(2); // User said: clicking container goes back to edit services (Step 2)
  };

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
                <button 
                  onClick={(e) => handleCopyVehicle(e, idx)}
                  style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: '4px', padding: '0.5rem', cursor: 'pointer', color: 'var(--admin-text-secondary)' }}
                  title="Copy Vehicle"
                >
                  <Copy size={16} />
                </button>
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
        <div 
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
        </div>
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
        <button 
          onClick={onNext}
          style={{
            padding: '1rem 2rem',
            background: 'var(--admin-brand)',
            color: '#fff',
            border: '1px solid var(--admin-brand)',
            borderRadius: 'var(--admin-radius-md)',
            fontWeight: '950',
            fontSize: '1rem',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            transition: 'all 0.3s ease'
          }}
        >
          Next: Review & Payment
        </button>
      </div>
      {/* Delete Confirmation Modal */}
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
    </div>
  );
};

export default Step3FleetEditing;
