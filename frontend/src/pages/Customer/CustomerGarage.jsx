import React from 'react';
import { Car, Plus, Settings, CheckCircle2, ChevronRight } from 'lucide-react';

const CustomerGarage = () => {
  // Mock Garage
  const garage = [
    {
      id: 1,
      type: 'Sedan',
      brand: 'Honda',
      model: 'Civic RS',
      plateNumber: 'ABC-1234',
      isPrimary: true,
      lastService: 'Oct 10, 2026'
    },
    {
      id: 2,
      type: 'SUV',
      brand: 'Toyota',
      model: 'Fortuner',
      plateNumber: 'XYZ-9876',
      isPrimary: false,
      lastService: null
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '950', margin: '0 0 0.5rem 0', textTransform: 'uppercase', color: 'var(--admin-text-primary)' }}>My Garage</h1>
          <p style={{ margin: 0, color: 'var(--admin-text-secondary)', fontSize: '0.9rem', fontWeight: '600' }}>
            Manage your registered vehicles for faster booking.
          </p>
        </div>
        <button 
          className="admin-card-hover"
          style={{ padding: '0.85rem 1.5rem', background: 'var(--admin-bg)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', fontWeight: '900', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Plus size={16} /> Add Vehicle
        </button>
      </div>

      {/* Garage Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {garage.map(vehicle => (
          <div 
            key={vehicle.id}
            style={{
              background: 'var(--admin-card)',
              border: `1px solid ${vehicle.isPrimary ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
              borderRadius: 'var(--admin-radius-lg)',
              padding: '1.5rem',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {vehicle.isPrimary && (
              <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--admin-brand)' }} />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Car size={24} color={vehicle.isPrimary ? 'var(--admin-brand)' : 'var(--admin-text-secondary)'} />
                </div>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>{vehicle.brand} {vehicle.model}</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>{vehicle.type}</div>
                </div>
              </div>
              
              {vehicle.isPrimary && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--admin-brand)', fontSize: '0.75rem', fontWeight: '900', background: 'rgba(var(--admin-brand-rgb), 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                  <CheckCircle2 size={12} /> Primary
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'var(--admin-bg)', padding: '1rem', borderRadius: 'var(--admin-radius-md)', border: '1px solid var(--admin-border)' }}>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Plate Number</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '900', color: 'var(--admin-text-primary)', letterSpacing: '1px' }}>{vehicle.plateNumber}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Last Service</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '800', color: vehicle.lastService ? 'var(--admin-text-primary)' : 'var(--admin-text-secondary)' }}>
                  {vehicle.lastService || 'Never'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button style={{ flex: 1, padding: '0.75rem', background: 'transparent', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', color: 'var(--admin-text-primary)', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Settings size={14} /> Edit Specs
              </button>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default CustomerGarage;
