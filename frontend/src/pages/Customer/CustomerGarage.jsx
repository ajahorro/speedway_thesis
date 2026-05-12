import React, { useState, useEffect, useCallback } from 'react';
import { Car, Plus, Settings, CheckCircle2, ChevronRight, Loader2, Trash2, Calendar, History, AlertCircle, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { 
  fetchUserGarage, 
  addVehicleToGarage, 
  updateGarageVehicle, 
  deleteGarageVehicle,
  fetchVehicleHistory 
} from '../../services/garageService';
import toast from 'react-hot-toast';

const CustomerGarage = () => {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const [formData, setFormData] = useState({
    type: 'Sedan',
    brand: '',
    model: '',
    plateNumber: '',
    isPrimary: false
  });

  const loadGarage = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchUserGarage(user.id);
      
      // Fetch "Last Service" for each vehicle
      const vehiclesWithHistory = await Promise.all(data.map(async (v) => {
        const history = await fetchVehicleHistory(v.plate_number);
        const lastService = history.length > 0 ? new Date(history[0].created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
        return { ...v, lastService };
      }));
      
      setVehicles(vehiclesWithHistory);
    } catch (error) {
      console.error('Garage Load Error:', error);
      toast.error('Failed to synchronize garage records.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadGarage();
  }, [loadGarage]);

  const handleOpenAdd = () => {
    setSelectedVehicle(null);
    setFormData({ type: 'Sedan', brand: '', model: '', plateNumber: '', isPrimary: false });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (vehicle) => {
    setSelectedVehicle(vehicle);
    setFormData({
      type: vehicle.vehicle_type,
      brand: vehicle.brand,
      model: vehicle.model,
      plateNumber: vehicle.plate_number,
      isPrimary: vehicle.is_primary
    });
    setIsModalOpen(true);
  };

  const handleViewHistory = async (vehicle) => {
    setSelectedVehicle(vehicle);
    setIsHistoryOpen(true);
    setLoadingHistory(true);
    try {
      const history = await fetchVehicleHistory(vehicle.plate_number);
      setHistoryData(history);
    } catch (error) {
      toast.error('Failed to load service history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const toastId = toast.loading(selectedVehicle ? 'Updating vehicle...' : 'Adding vehicle to fleet...');
    try {
      if (selectedVehicle) {
        await updateGarageVehicle(selectedVehicle.id, formData);
        toast.success('Vehicle Updated', { id: toastId });
      } else {
        await addVehicleToGarage(user.id, formData);
        toast.success('Vehicle Added to Garage', { id: toastId });
      }
      setIsModalOpen(false);
      loadGarage();
    } catch (error) {
      toast.error(error.message || 'Operation failed', { id: toastId });
    }
  };

  const handleDelete = async (vehicleId) => {
    if (!window.confirm('Are you sure you want to remove this vehicle from your garage?')) return;
    const toastId = toast.loading('Removing vehicle...');
    try {
      await deleteGarageVehicle(vehicleId);
      toast.success('Vehicle Removed', { id: toastId });
      loadGarage();
    } catch (error) {
      toast.error('Failed to remove vehicle', { id: toastId });
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '1rem' }}>
        <Loader2 size={40} className="animate-spin" color="var(--admin-brand)" />
        <p style={{ fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.8rem' }}>Syncing Fleet Records...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '5rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '950', margin: '0 0 0.5rem 0', textTransform: 'uppercase', color: 'white', letterSpacing: '-1.5px' }}>My Garage</h1>
          <p style={{ margin: 0, color: 'var(--admin-text-secondary)', fontSize: '0.95rem', fontWeight: '600', opacity: 0.8 }}>
            Manage your registered vehicles for high-fidelity booking tracking.
          </p>
        </div>
        <button 
          onClick={handleOpenAdd}
          className="admin-card-hover"
          style={{ padding: '1rem 2rem', background: 'var(--admin-brand)', color: 'white', border: 'none', borderRadius: 'var(--admin-radius-sm)', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '0.75rem', boxShadow: '0 4px 15px rgba(var(--admin-brand-rgb), 0.3)' }}
        >
          <Plus size={20} /> Add Vehicle
        </button>
      </div>

      {/* Garage Grid */}
      {vehicles.length === 0 ? (
        <div style={{ background: 'var(--admin-card)', border: '2px dashed var(--admin-border)', borderRadius: 'var(--admin-radius-lg)', padding: '5rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <Car size={60} strokeWidth={1} style={{ opacity: 0.1, color: 'white' }} />
          <div>
            <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: '900', color: 'white' }}>Your Garage is Empty</h3>
            <p style={{ margin: 0, color: 'var(--admin-text-secondary)', fontSize: '0.85rem', fontWeight: '600' }}>Add your first vehicle to speed up your booking process.</p>
          </div>
          <button onClick={handleOpenAdd} style={{ marginTop: '1rem', background: 'transparent', border: '1px solid var(--admin-brand)', color: 'var(--admin-brand)', padding: '0.75rem 1.5rem', borderRadius: '4px', fontWeight: '950', fontSize: '0.75rem', cursor: 'pointer' }}>GET STARTED</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '2rem' }}>
          {vehicles.map(vehicle => (
            <div 
              key={vehicle.id}
              style={{
                background: 'var(--admin-card)',
                border: `1px solid ${vehicle.is_primary ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
                borderRadius: 'var(--admin-radius-lg)',
                padding: '2rem',
                position: 'relative',
                overflow: 'hidden',
                transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: 'var(--admin-card-shadow)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {vehicle.is_primary && (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '6px', height: '100%', background: 'var(--admin-brand)' }} />
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Car size={28} color={vehicle.is_primary ? 'var(--admin-brand)' : 'var(--admin-text-secondary)'} />
                  </div>
                  <div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '950', color: 'white', letterSpacing: '-0.5px' }}>{vehicle.brand} {vehicle.model}</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>{vehicle.vehicle_type}</div>
                  </div>
                </div>
                
                {vehicle.is_primary && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--admin-brand)', fontSize: '0.65rem', fontWeight: '950', background: 'rgba(var(--admin-brand-rgb), 0.1)', padding: '0.35rem 0.75rem', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    <CheckCircle2 size={12} /> Primary Unit
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', background: 'rgba(255,255,255,0.02)', padding: '1.25rem', borderRadius: 'var(--admin-radius-md)', border: '1px solid var(--admin-border)', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '1px', opacity: 0.6 }}>Plate Number</div>
                  <div style={{ fontSize: '1rem', fontWeight: '950', color: 'white', letterSpacing: '2px' }}>{vehicle.plate_number}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '1px', opacity: 0.6 }}>Last Session</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: '900', color: vehicle.lastService ? 'var(--admin-brand)' : 'var(--admin-text-secondary)' }}>
                    {vehicle.lastService || 'NEW ENTRY'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button 
                  onClick={() => handleViewHistory(vehicle)}
                  style={{ flex: 1.5, padding: '0.85rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', color: 'white', fontWeight: '950', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', textTransform: 'uppercase', letterSpacing: '1px' }}
                >
                  <History size={16} /> Service Log
                </button>
                <button 
                  onClick={() => handleOpenEdit(vehicle)}
                  style={{ padding: '0.85rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', color: 'var(--admin-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Settings size={16} />
                </button>
                <button 
                  onClick={() => handleDelete(vehicle.id)}
                  style={{ padding: '0.85rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--admin-radius-sm)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Add/Edit Vehicle */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-lg)', width: '100%', maxWidth: '500px', padding: '2.5rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ margin: 0, fontWeight: '950', fontSize: '1.5rem', color: 'white', textTransform: 'uppercase' }}>{selectedVehicle ? 'Edit Vehicle Specs' : 'Register New Vehicle'}</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '1px' }}>Vehicle Type</label>
                  <select 
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    style={{ width: '100%', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '8px', padding: '0.85rem', color: 'white', fontWeight: '800', outline: 'none' }}
                  >
                    <option value="Sedan">Sedan</option>
                    <option value="SUV">SUV / Van</option>
                    <option value="Bigbike">Bigbike</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '1px' }}>Plate Number</label>
                  <input 
                    type="text"
                    placeholder="ABC-1234"
                    required
                    value={formData.plateNumber}
                    onChange={(e) => setFormData({...formData, plateNumber: e.target.value.toUpperCase()})}
                    style={{ width: '100%', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '8px', padding: '0.85rem', color: 'white', fontWeight: '950', outline: 'none', letterSpacing: '2px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '1px' }}>Brand / Make</label>
                <input 
                  type="text"
                  placeholder="e.g. Honda"
                  required
                  value={formData.brand}
                  onChange={(e) => setFormData({...formData, brand: e.target.value})}
                  style={{ width: '100%', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '8px', padding: '0.85rem', color: 'white', fontWeight: '800', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '1px' }}>Model Name</label>
                <input 
                  type="text"
                  placeholder="e.g. Civic Type R"
                  required
                  value={formData.model}
                  onChange={(e) => setFormData({...formData, model: e.target.value})}
                  style={{ width: '100%', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '8px', padding: '0.85rem', color: 'white', fontWeight: '800', outline: 'none' }}
                />
              </div>

              <div 
                onClick={() => setFormData({...formData, isPrimary: !formData.isPrimary})}
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: `1px solid ${formData.isPrimary ? 'var(--admin-brand)' : 'var(--admin-border)'}` }}
              >
                <div style={{ width: '20px', height: '20px', borderRadius: '4px', border: `2px solid ${formData.isPrimary ? 'var(--admin-brand)' : 'var(--admin-text-secondary)'}`, background: formData.isPrimary ? 'var(--admin-brand)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {formData.isPrimary && <CheckCircle2 size={14} color="white" />}
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: '800', color: formData.isPrimary ? 'white' : 'var(--admin-text-secondary)' }}>Set as Primary Vehicle</span>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '1rem', background: 'transparent', border: '1px solid var(--admin-border)', borderRadius: '8px', color: 'white', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase' }}>Cancel</button>
                <button type="submit" style={{ flex: 2, padding: '1rem', background: 'var(--admin-brand)', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}>{selectedVehicle ? 'Save Changes' : 'Register Vehicle'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Service History Log */}
      {isHistoryOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-lg)', width: '100%', maxWidth: '700px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ padding: '2rem', borderBottom: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontWeight: '950', fontSize: '1.5rem', color: 'white', textTransform: 'uppercase' }}>Service Log</h2>
                <div style={{ fontSize: '0.8rem', color: 'var(--admin-brand)', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1px' }}>{selectedVehicle?.brand} {selectedVehicle?.model} • {selectedVehicle?.plate_number}</div>
              </div>
              <button onClick={() => setIsHistoryOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}><X size={24} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
              {loadingHistory ? (
                <div style={{ padding: '3rem', textAlign: 'center' }}><Loader2 size={32} className="animate-spin" color="var(--admin-brand)" style={{ margin: '0 auto' }} /></div>
              ) : historyData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 2rem', opacity: 0.5 }}>
                  <History size={48} style={{ marginBottom: '1rem' }} />
                  <div style={{ fontWeight: '900', textTransform: 'uppercase' }}>No Detailing History Found</div>
                  <div style={{ fontSize: '0.8rem' }}>When this vehicle completes a service, it will appear here.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {historyData.map((entry, idx) => (
                    <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--admin-border)', borderRadius: '12px', padding: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                        <div>
                          <div style={{ fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Session Date</div>
                          <div style={{ fontSize: '0.95rem', fontWeight: '900', color: 'white' }}>{new Date(entry.booking?.start_datetime).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.6rem', fontWeight: '950', padding: '0.25rem 0.6rem', borderRadius: '4px', background: entry.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(168, 85, 247, 0.1)', color: entry.status === 'completed' ? '#10b981' : '#a855f7', border: `1px solid ${entry.status === 'completed' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(168, 85, 247, 0.2)'}`, textTransform: 'uppercase' }}>{entry.status}</span>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
                        {(entry.services || []).map((s, sIdx) => (
                          <div key={sIdx} style={{ background: 'rgba(var(--admin-brand-rgb), 0.1)', border: '1px solid rgba(var(--admin-brand-rgb), 0.2)', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '950', color: 'white', textTransform: 'uppercase' }}>{s.service_name}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div style={{ padding: '1.5rem 2rem', background: 'var(--admin-bg)', borderTop: '1px solid var(--admin-border)', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '700', color: 'var(--admin-text-secondary)' }}>Showing automated fleet history log from Speedway Engine.</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CustomerGarage;
