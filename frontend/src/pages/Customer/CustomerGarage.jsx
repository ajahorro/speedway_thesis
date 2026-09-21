import React, { useState, useEffect, useCallback } from 'react';
import { Car, Plus, Settings, CheckCircle2, ChevronRight, Loader2, Trash2, Calendar, History, AlertCircle, X, Layers } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useUI } from '../../context/UIContext';
import { supabase } from '../../lib/supabase';
import {
  fetchUserGarage,
  fetchFleetGroups,
  createFleetGroup,
  updateFleetGroup,
  addVehicleToGarage,
  updateGarageVehicle,
  addVehicleToFleet,
  setFleetVehicles,
  deleteGarageVehicle,
  fetchVehicleHistory
} from '../../services/garageService';
import toast from 'react-hot-toast';
import ConfirmationToast from '../../components/ConfirmationToast';
import { sanitizeVehiclePlate, sanitizeVehicleText, VEHICLE_TYPE_OPTIONS } from '../../config/constants';
import { calculateBayUsage } from '../../utils/schedulingUtils';

const CustomerGarage = () => {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [fleetGroups, setFleetGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [selectedFleetVehicleIds, setSelectedFleetVehicleIds] = useState([]);
  const [isCreatingFleet, setIsCreatingFleet] = useState(false);
  const [selectedFleetGroup, setSelectedFleetGroup] = useState(null);
  const [isEditingFleet, setIsEditingFleet] = useState(false);
  const [fleetEditName, setFleetEditName] = useState('');
  const [fleetEditVehicleIds, setFleetEditVehicleIds] = useState([]);
  const [isSavingFleet, setIsSavingFleet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const { openModal, showToast } = useUI();

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
      const groups = await fetchFleetGroups(user.id);

      // Fetch "Last Service" for each vehicle
      const vehiclesWithHistory = await Promise.all(data.map(async (v) => {
        const history = await fetchVehicleHistory(v.plate_number);
        const lastService = history.length > 0 ? new Date(history[0].created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
        return { ...v, lastService };
      }));

      setVehicles(vehiclesWithHistory);
      setFleetGroups(groups);
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
    setFormData({ type: 'Sedan', brand: '', model: '', plateNumber: '', isPrimary: false, fleetGroupId: fleetGroups[0]?.id || '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (vehicle) => {
    setSelectedVehicle(vehicle);
    setFormData({
      type: vehicle.type,
      brand: vehicle.brand,
      model: vehicle.model,
      plateNumber: vehicle.plate_number,
      isPrimary: vehicle.is_primary,
      fleetGroupId: vehicle.fleet_group_id || ''
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

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || selectedFleetVehicleIds.length === 0) {
      toast.error('Enter a fleet name and select at least one vehicle.');
      return;
    }
    setIsCreatingFleet(true);
    try {
      const { data: capacityConfig, error: capacityError } = await supabase.from('business_config').select('slots_per_hour').maybeSingle();
      const maxBays = Number(capacityConfig?.slots_per_hour);
      if (capacityError || !Number.isFinite(maxBays) || maxBays <= 0) {
        throw new Error('Fleet capacity is unavailable. Ask an administrator to configure the number of bays.');
      }
      const selectedVehicles = vehicles.filter(vehicle => selectedFleetVehicleIds.includes(vehicle.id));
      if (calculateBayUsage(selectedVehicles) > maxBays) {
        throw new Error(`This fleet needs ${calculateBayUsage(selectedVehicles)} bays, but the shop currently has ${maxBays}.`);
      }
      const group = await createFleetGroup(user.id, newGroupName);
      await setFleetVehicles(group.id, selectedFleetVehicleIds);
      setNewGroupName('');
      setSelectedFleetVehicleIds([]);
      setIsGroupModalOpen(false);
      await loadGarage();
      toast.success('Fleet created with selected vehicles');
    } catch (error) {
      toast.error(error.message || 'Failed to create fleet group');
    } finally {
      setIsCreatingFleet(false);
    }
  };

  const handleOpenGroup = () => {
    setNewGroupName('');
    setSelectedFleetVehicleIds([]);
    setIsGroupModalOpen(true);
  };

  const handleStartFleetEdit = () => {
    setFleetEditName(selectedFleetGroup.name);
    setFleetEditVehicleIds((selectedFleetGroup.vehicles || []).map(vehicle => vehicle.id));
    setIsEditingFleet(true);
  };

  const handleSaveFleetEdit = async () => {
    if (!fleetEditName.trim()) return toast.error('Enter a fleet name.');
    setIsSavingFleet(true);
    try {
      const { data: capacityConfig, error: capacityError } = await supabase.from('business_config').select('slots_per_hour').maybeSingle();
      const maxBays = Number(capacityConfig?.slots_per_hour);
      if (capacityError || !Number.isFinite(maxBays) || maxBays <= 0) {
        throw new Error('Fleet capacity is unavailable. Ask an administrator to configure the number of bays.');
      }
      const selectedVehicles = vehicles.filter(vehicle => fleetEditVehicleIds.includes(vehicle.id));
      if (calculateBayUsage(selectedVehicles) > maxBays) {
        throw new Error(`This fleet needs ${calculateBayUsage(selectedVehicles)} bays, but the shop currently has ${maxBays}.`);
      }
      await updateFleetGroup(selectedFleetGroup.id, fleetEditName);
      await setFleetVehicles(selectedFleetGroup.id, fleetEditVehicleIds);
      setIsEditingFleet(false);
      setSelectedFleetGroup(null);
      await loadGarage();
      toast.success('Fleet updated');
    } catch (error) {
      toast.error(error.message || 'Failed to update fleet');
    } finally {
      setIsSavingFleet(false);
    }
  };

  const handleDeleteFleet = () => {
    openModal({
      title: 'Delete Fleet?',
      message: `Delete "${selectedFleetGroup.name}"? The vehicles will remain in your garage but will no longer belong to this fleet.`,
      confirmText: 'Delete Fleet',
      cancelText: 'Keep Fleet',
      type: 'danger',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('fleet_groups')
            .delete()
            .eq('id', selectedFleetGroup.id)
            .eq('owner_id', user.id);
          if (error) throw error;
          setSelectedFleetGroup(null);
          setIsEditingFleet(false);
          await loadGarage();
          showToast('Fleet deleted', 'success');
        } catch (error) {
          showToast(error.message || 'Failed to delete fleet', 'error');
        }
      }
    });
  };

  const handleDelete = (vehicleId) => {
    openModal({
      title: 'Remove Vehicle',
      message: 'Are you sure you want to remove this vehicle from your garage? This action cannot be undone.',
      confirmText: 'Remove Unit',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteGarageVehicle(vehicleId);
          showToast('Vehicle Removed', 'success');
          loadGarage();
        } catch (error) {
          showToast('Failed to remove vehicle', 'error');
        }
      }
    });
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', paddingBottom: '5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.5rem)', fontWeight: '950', margin: '0 0 0.5rem 0', textTransform: 'uppercase', color: 'var(--admin-text-primary)', letterSpacing: '-1.5px' }}>My Garage</h1>
          <p style={{ margin: 0, color: 'var(--admin-text-secondary)', fontSize: '0.95rem', fontWeight: '600', opacity: 0.8 }}>
            Manage your registered vehicles for high-fidelity booking tracking.
          </p>
        </div>
      </div>

      {/* Fleet Groups Row */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--admin-text-primary)', fontSize: '1rem', fontWeight: '950', textTransform: 'uppercase' }}>Fleet Groups</h2>
            <p style={{ margin: '0.3rem 0 0', color: 'var(--admin-text-secondary)', fontSize: '0.78rem' }}>Select a fleet to view its assigned vehicles.</p>
          </div>
          <button onClick={handleOpenGroup} className="admin-card-hover" style={{ padding: '0.7rem 1rem', background: 'transparent', color: 'var(--admin-brand)', border: '1px solid var(--admin-brand)', borderRadius: 'var(--admin-radius-sm)', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.8px', display: 'flex', alignItems: 'center', gap: '.45rem', fontSize: '.72rem' }}>
            <Plus size={16} /> Create Fleet
          </button>
        </div>
        <div style={{ minHeight: '140px', padding: '1.25rem', background: 'var(--admin-card)', border: '1px dashed var(--admin-border)', borderRadius: 'var(--admin-radius)', display: 'flex', alignItems: 'flex-start' }}>
        {fleetGroups.length === 0 ? (
          <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>No fleet groups created yet.</div>
        ) : (
          <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 230px))', gap: '0.7rem', alignContent: 'start', justifyContent: 'start' }}>
            {fleetGroups.map(group => {
              const groupVehicleCount = group.vehicles?.length || 0;
              return (
                <button key={group.id} type="button" onClick={() => setSelectedFleetGroup(group)} style={{ minHeight: '74px', padding: '.75rem', textAlign: 'left', background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius)', color: 'var(--admin-text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.5rem', boxShadow: 'var(--admin-card-shadow)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '.6rem', minWidth: 0 }}><Layers size={17} color="var(--admin-brand)" /><span style={{ minWidth: 0 }}><strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '.8rem' }}>{group.name}</strong><small style={{ display: 'block', marginTop: '.15rem', color: 'var(--admin-text-secondary)', fontSize: '.7rem', fontWeight: '700' }}>{groupVehicleCount} vehicle{groupVehicleCount === 1 ? '' : 's'}</small></span></span>
                  <ChevronRight size={15} color="var(--admin-text-secondary)" style={{ flexShrink: 0 }} />
                </button>
              );
            })}
          </div>
        )}
        </div>
      </section>

      {/* Vehicles Row */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, color: 'var(--admin-text-primary)', fontSize: '1rem', fontWeight: '950', textTransform: 'uppercase' }}>Vehicles</h2>
          <button onClick={handleOpenAdd} className="admin-card-hover" style={{ padding: '0.7rem 1rem', background: 'var(--admin-brand)', color: '#fff', border: 'none', borderRadius: 'var(--admin-radius-sm)', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.8px', display: 'flex', alignItems: 'center', gap: '.45rem', fontSize: '.72rem', boxShadow: '0 4px 15px rgba(var(--admin-brand-rgb), 0.3)' }}>
            <Plus size={16} /> Add New Vehicle
          </button>
        </div>
      <div style={{ minHeight: '450px', padding: '1.25rem', background: 'var(--admin-card)', border: '2px dashed var(--admin-border)', borderRadius: 'var(--admin-radius-lg)', display: 'flex', alignItems: 'flex-start' }}>
      {vehicles.length === 0 ? (
        <div style={{ width: '100%', minHeight: '400px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
          <Car size={60} strokeWidth={1} style={{ opacity: 0.2, color: 'var(--admin-text-secondary)' }} />
          <div>
            <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: '900', color: 'var(--admin-text-primary)' }}>Your Garage is Empty</h3>
            <p style={{ margin: 0, color: 'var(--admin-text-secondary)', fontSize: '0.85rem', fontWeight: '600' }}>Add your first vehicle to speed up your booking process.</p>
          </div>
          <button onClick={handleOpenAdd} style={{ marginTop: '1rem', background: 'transparent', border: '1px solid var(--admin-brand)', color: 'var(--admin-brand)', padding: '0.75rem 1.5rem', borderRadius: '4px', fontWeight: '950', fontSize: '0.75rem', cursor: 'pointer' }}>GET STARTED</button>
        </div>
      ) : (
        <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 280px))', gap: '.75rem', alignContent: 'start', justifyContent: 'start' }}>
          {vehicles.map(vehicle => (
            <div
              key={vehicle.id}
              style={{
                background: 'var(--admin-card)',
                border: `1px solid ${vehicle.is_primary ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
                borderRadius: 'var(--admin-radius)',
                padding: '1rem',
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

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                  <div style={{ width: '42px', height: '42px', flexShrink: 0, borderRadius: '8px', background: 'var(--admin-input-bg)', border: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Car size={21} color={vehicle.is_primary ? 'var(--admin-brand)' : 'var(--admin-text-secondary)'} />
                  </div>
                  <div>
                    <div style={{ minWidth: 0, fontSize: '.9rem', fontWeight: '900', color: 'var(--admin-text-primary)', overflowWrap: 'anywhere' }}>{vehicle.brand} {vehicle.model}</div>
                    <div style={{ fontSize: '.7rem', fontWeight: '800', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '.6px' }}>{vehicle.type}</div>
                  </div>
                </div>

                {vehicle.is_primary && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--admin-brand)', fontSize: '0.65rem', fontWeight: '950', background: 'rgba(var(--admin-brand-rgb), 0.1)', padding: '0.35rem 0.75rem', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    <CheckCircle2 size={12} /> Primary Unit
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem', background: 'var(--admin-input-bg)', padding: '.8rem', borderRadius: 'var(--admin-radius-md)', border: '1px solid var(--admin-border)', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '1px', opacity: 0.6 }}>Plate Number</div>
                  <div style={{ fontSize: '.8rem', fontWeight: '900', color: 'var(--admin-text-primary)', letterSpacing: '1px', overflowWrap: 'anywhere' }}>{vehicle.plate_number}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '1px', opacity: 0.6 }}>Last Session</div>
                  <div style={{ fontSize: '.75rem', fontWeight: '800', color: vehicle.lastService ? 'var(--admin-brand)' : 'var(--admin-text-secondary)' }}>
                    {vehicle.lastService || 'NEW ENTRY'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '.5rem' }}>
                <button
                  onClick={() => handleViewHistory(vehicle)}
                  style={{ flex: 1.5, padding: '.65rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', color: 'var(--admin-text-primary)', fontWeight: '900', fontSize: '.68rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.4rem', textTransform: 'uppercase', letterSpacing: '.6px' }}
                >
                  <History size={16} /> Service Log
                </button>
                <button
                  onClick={() => handleOpenEdit(vehicle)}
                  style={{ padding: '0.85rem', background: 'var(--admin-input-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', color: 'var(--admin-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
      </div>
      </section>

      {/* Modal: Fleet Vehicles */}
      {selectedFleetGroup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-lg)', width: 'min(100%, 680px)', maxHeight: 'min(80vh, 760px)', padding: 'clamp(1rem, 4vw, 2rem)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ color: 'var(--admin-brand)', fontSize: '0.68rem', fontWeight: '900', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Fleet Group</div>
                <h2 style={{ margin: '0.25rem 0 0', fontWeight: '950', fontSize: '1.5rem', color: 'var(--admin-text-primary)' }}>{isEditingFleet ? 'Edit Fleet' : selectedFleetGroup.name}</h2>
                <p style={{ margin: '0.4rem 0 0', color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>{isEditingFleet ? 'Rename the fleet and manage its assigned vehicles.' : 'Vehicles assigned to this fleet.'}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {!isEditingFleet && <button type="button" onClick={handleStartFleetEdit} style={{ padding: '0.55rem 0.75rem', background: 'transparent', border: '1px solid var(--admin-brand)', borderRadius: 'var(--admin-radius-sm)', color: 'var(--admin-brand)', fontSize: '0.68rem', fontWeight: '900', cursor: 'pointer', textTransform: 'uppercase' }}>Edit Fleet</button>}
                <button type="button" onClick={handleDeleteFleet} aria-label="Delete fleet" style={{ padding: '0.55rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: 'var(--admin-radius-sm)', color: '#ef4444', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Trash2 size={16} /></button>
                <button type="button" onClick={() => { setSelectedFleetGroup(null); setIsEditingFleet(false); }} style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}><X size={24} /></button>
              </div>
            </div>
            {isEditingFleet ? (
              <>
                <label style={{ display: 'block', color: 'var(--admin-text-secondary)', fontSize: '0.68rem', fontWeight: '900', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Fleet name<input autoFocus value={fleetEditName} onChange={event => setFleetEditName(event.target.value)} style={{ width: '100%', boxSizing: 'border-box', marginTop: '0.5rem', padding: '0.8rem', background: 'var(--admin-bg)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)', borderRadius: '8px' }} /></label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '0.75rem', maxHeight: 'min(300px, 42vh)', overflowY: 'auto', marginTop: '1rem' }}>
                  {vehicles.map(vehicle => {
                    const isSelected = fleetEditVehicleIds.includes(vehicle.id);
                    return <label key={vehicle.id} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.85rem', background: isSelected ? 'rgba(var(--admin-brand-rgb), 0.1)' : 'var(--admin-bg)', border: `1px solid ${isSelected ? 'var(--admin-brand)' : 'var(--admin-border)'}`, borderRadius: '8px', cursor: 'pointer' }}><input type="checkbox" checked={isSelected} onChange={() => setFleetEditVehicleIds(current => isSelected ? current.filter(id => id !== vehicle.id) : [...current, vehicle.id])} /><span style={{ minWidth: 0, color: 'var(--admin-text-primary)', fontSize: '0.8rem', fontWeight: '800' }}><strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vehicle.brand} {vehicle.model}</strong><small style={{ color: 'var(--admin-text-secondary)' }}>{vehicle.plate_number} · {vehicle.type}</small></span></label>;
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}><button type="button" onClick={() => setIsEditingFleet(false)} style={{ padding: '0.75rem 1rem', background: 'transparent', border: '1px solid var(--admin-border)', borderRadius: '8px', color: 'var(--admin-text-primary)', fontWeight: '900', cursor: 'pointer' }}>Cancel</button><button type="button" disabled={isSavingFleet} onClick={handleSaveFleetEdit} style={{ padding: '0.75rem 1rem', background: 'var(--admin-brand)', border: 0, borderRadius: '8px', color: '#fff', fontWeight: '900', cursor: 'pointer', opacity: isSavingFleet ? 0.5 : 1 }}>{isSavingFleet ? 'Saving...' : 'Save Fleet'}</button></div>
              </>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '0.75rem' }}>
                  {(selectedFleetGroup.vehicles || []).map(vehicle => (
                    <div key={vehicle.id} style={{ padding: '1rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}><Car size={20} color="var(--admin-brand)" /><div style={{ minWidth: 0 }}><strong style={{ display: 'block', color: 'var(--admin-text-primary)', fontSize: '0.95rem', overflowWrap: 'anywhere' }}>{vehicle.brand} {vehicle.model}</strong><span style={{ display: 'block', marginTop: '0.3rem', color: 'var(--admin-text-secondary)', fontSize: '0.75rem', fontWeight: '800' }}>{vehicle.type}</span></div></div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--admin-border)' }}><div><small style={{ display: 'block', color: 'var(--admin-text-secondary)', fontSize: '0.62rem', fontWeight: '900', textTransform: 'uppercase' }}>Plate</small><span style={{ color: 'var(--admin-text-primary)', fontSize: '0.82rem', fontWeight: '800', letterSpacing: '0.08em' }}>{vehicle.plate_number}</span></div><div><small style={{ display: 'block', color: 'var(--admin-text-secondary)', fontSize: '0.62rem', fontWeight: '900', textTransform: 'uppercase' }}>Last session</small><span style={{ color: vehicle.lastService ? 'var(--admin-brand)' : 'var(--admin-text-secondary)', fontSize: '0.82rem', fontWeight: '800' }}>{vehicle.lastService || 'New entry'}</span></div></div>
                    </div>
                  ))}
                </div>
                {(selectedFleetGroup.vehicles || []).length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--admin-text-secondary)', fontSize: '0.85rem' }}>No vehicles are currently assigned to this fleet.</div>}
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal: Create Fleet */}
      {isGroupModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-lg)', width: 'min(100%, 500px)', maxHeight: '90vh', overflowY: 'auto', padding: 'clamp(1rem, 4vw, 2rem)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ margin: 0, fontWeight: '950', fontSize: '1.4rem', color: 'var(--admin-text-primary)', textTransform: 'uppercase' }}>Create Fleet</h2>
                <p style={{ margin: '0.4rem 0 0', color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>Group vehicles for faster multi-vehicle bookings.</p>
              </div>
              <button type="button" onClick={() => setIsGroupModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            <form onSubmit={event => { event.preventDefault(); handleCreateGroup(); }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label style={{ color: 'var(--admin-text-secondary)', fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase' }}>
                Fleet name
                <input autoFocus required value={newGroupName} onChange={event => setNewGroupName(event.target.value)} placeholder="e.g. Family vehicles" style={{ width: '100%', boxSizing: 'border-box', marginTop: '0.5rem', padding: '0.85rem', background: 'var(--admin-bg)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)', borderRadius: '8px', fontWeight: '700' }} />
              </label>
              <div>
                <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Choose vehicles</div>
                {vehicles.length === 0 ? (
                  <div style={{ padding: '1rem', border: '1px dashed var(--admin-border)', borderRadius: '8px', color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>Add vehicles to your garage before creating a fleet.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: '0.6rem', maxHeight: 'min(220px, 35vh)', overflowY: 'auto' }}>
                    {vehicles.map(vehicle => {
                      const isSelected = selectedFleetVehicleIds.includes(vehicle.id);
                      return (
                        <label key={vehicle.id} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.75rem', border: `1px solid ${isSelected ? 'var(--admin-brand)' : 'var(--admin-border)'}`, borderRadius: '8px', background: isSelected ? 'rgba(var(--admin-brand-rgb), 0.1)' : 'var(--admin-bg)', cursor: 'pointer' }}>
                          <input type="checkbox" checked={isSelected} onChange={() => setSelectedFleetVehicleIds(current => isSelected ? current.filter(id => id !== vehicle.id) : [...current, vehicle.id])} />
                          <span style={{ minWidth: 0, color: 'var(--admin-text-primary)', fontSize: '0.78rem', fontWeight: '800' }}><strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vehicle.brand} {vehicle.model}</strong><small style={{ color: 'var(--admin-text-secondary)' }}>{vehicle.plate_number} · {vehicle.type}</small></span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setIsGroupModalOpen(false)} style={{ padding: '0.8rem 1rem', background: 'transparent', border: '1px solid var(--admin-border)', borderRadius: '8px', color: 'var(--admin-text-primary)', fontWeight: '900', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isCreatingFleet || selectedFleetVehicleIds.length === 0} style={{ padding: '0.8rem 1rem', background: 'var(--admin-brand)', border: 0, borderRadius: '8px', color: '#fff', fontWeight: '900', cursor: 'pointer', opacity: isCreatingFleet || selectedFleetVehicleIds.length === 0 ? 0.5 : 1 }}>{isCreatingFleet ? 'Creating...' : 'Create Fleet'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Vehicle */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-lg)', width: 'min(100%, 500px)', maxHeight: '90vh', overflowY: 'auto', padding: 'clamp(1rem, 4vw, 2.5rem)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ margin: 0, fontWeight: '950', fontSize: 'clamp(1.15rem, 4vw, 1.5rem)', color: 'var(--admin-text-primary)', textTransform: 'uppercase' }}>{selectedVehicle ? 'Edit Vehicle Specs' : 'Register New Vehicle'}</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '1px' }}>Vehicle Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    style={{ width: '100%', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '8px', padding: '0.85rem', color: 'var(--admin-text-primary)', fontWeight: '800', outline: 'none' }}
                  >
                    {VEHICLE_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '1px' }}>Fleet Group</label>
                  <select value={formData.fleetGroupId || ''} onChange={e => setFormData({ ...formData, fleetGroupId: e.target.value })} style={{ width: '100%', padding: '0.75rem', background: 'var(--admin-bg)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)', borderRadius: '4px' }}>
                    <option value="">Ungrouped</option>
                    {fleetGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '1px' }}>Plate Number</label>
                  <input
                    type="text"
                    placeholder="ABC1234"
                    required
                    value={formData.plateNumber}
                    onChange={(e) => setFormData({ ...formData, plateNumber: sanitizeVehiclePlate(e.target.value) })}
                    style={{ width: '100%', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '8px', padding: '0.85rem', color: 'var(--admin-text-primary)', fontWeight: '950', outline: 'none', letterSpacing: '2px' }}
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
                  onChange={(e) => setFormData({ ...formData, brand: sanitizeVehicleText(e.target.value) })}
                    style={{ width: '100%', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '8px', padding: '0.85rem', color: 'var(--admin-text-primary)', fontWeight: '800', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '1px' }}>Model Name</label>
                  <input
                  type="text"
                  placeholder="e.g. Civic Type R"
                  required
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: sanitizeVehicleText(e.target.value) })}
                    style={{ width: '100%', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '8px', padding: '0.85rem', color: 'var(--admin-text-primary)', fontWeight: '800', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '1rem', background: 'transparent', border: '1px solid var(--admin-border)', borderRadius: '8px', color: 'var(--admin-text-primary)', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase' }}>Cancel</button>
                <button type="submit" style={{ flex: 2, padding: '1rem', background: 'var(--admin-brand)', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}>{selectedVehicle ? 'Save Changes' : 'Register Vehicle'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Service History Log */}
      {isHistoryOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-lg)', width: 'min(100%, 700px)', maxHeight: 'min(80vh, 760px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ padding: '2rem', borderBottom: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontWeight: '950', fontSize: 'clamp(1.15rem, 4vw, 1.5rem)', color: 'var(--admin-text-primary)', textTransform: 'uppercase' }}>Service Log</h2>
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
                    <div key={idx} style={{ background: 'var(--admin-input-bg)', border: '1px solid var(--admin-border)', borderRadius: '12px', padding: 'clamp(1rem, 3vw, 1.5rem)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                        <div>
                          <div style={{ fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Session Date</div>
                          <div style={{ fontSize: '0.95rem', fontWeight: '900', color: 'var(--admin-text-primary)' }}>{new Date(entry.booking?.start_datetime).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.6rem', fontWeight: '950', padding: '0.25rem 0.6rem', borderRadius: '4px', background: entry.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(168, 85, 247, 0.1)', color: entry.status === 'completed' ? '#10b981' : '#a855f7', border: `1px solid ${entry.status === 'completed' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(168, 85, 247, 0.2)'}`, textTransform: 'uppercase' }}>{entry.status}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
                        {(entry.services || []).map((s, sIdx) => (
                          <div key={sIdx} style={{ background: 'rgba(var(--admin-brand-rgb), 0.1)', border: '1px solid rgba(var(--admin-brand-rgb), 0.2)', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-primary)', textTransform: 'uppercase' }}>{s.service_name}</div>
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
