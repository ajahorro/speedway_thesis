import { supabase } from '../lib/supabase';

/**
 * garageService.js
 * Handles persistent vehicle storage for customers.
 */

export const fetchUserGarage = async (userId) => {
  const { data, error } = await supabase
    .from('vehicles')
    // Do not embed the legacy fleet_groups relationship here: vehicles now
    // also connect to groups through fleet_group_vehicles, which otherwise
    // makes PostgREST report an ambiguous relationship (PGRST201).
    .select('*, memberships:fleet_group_vehicles(fleet_group_id)')
    .eq('owner_id', userId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
      console.warn('vehicles table might not exist yet. Returning empty garage.');
      return [];
    }
    throw error;
  }
  return (data || []).map(vehicle => ({
    ...vehicle,
    fleet_group_ids: (vehicle.memberships || []).map(membership => membership.fleet_group_id)
  }));
};

export const fetchFleetGroups = async (ownerId) => {
  const { data, error } = await supabase
    .from('fleet_groups')
    .select('*, memberships:fleet_group_vehicles(vehicle:vehicles(*))')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(group => ({
    ...group,
    vehicles: (group.memberships || []).map(membership => membership.vehicle).filter(Boolean)
  }));
};

export const createFleetGroup = async (ownerId, name) => {
  const { data, error } = await supabase
    .from('fleet_groups')
    .insert({ owner_id: ownerId, name: name.trim() })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateFleetGroup = async (groupId, name) => {
  const { data, error } = await supabase
    .from('fleet_groups')
    .update({ name: name.trim() })
    .eq('id', groupId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const addVehicleToGarage = async (userId, vehicle) => {
  try {
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
    const response = await fetch(`${BACKEND_URL}/api/garage/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: userId, vehicle })
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to sync vehicle to garage');
    }
    
    return await response.json();
  } catch (err) {
    console.error('Garage Service Error:', err);
    throw err;
  }
};

export const updateGarageVehicle = async (vehicleId, updates) => {
  const { data, error } = await supabase
    .from('vehicles')
    .update({
      type: updates.type,
      brand: updates.brand,
      model: updates.model,
      plate_number: updates.plateNumber.toUpperCase(),
      is_primary: updates.isPrimary
    })
    .eq('id', vehicleId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const addVehicleToFleet = async (fleetGroupId, vehicleId) => {
  const { error } = await supabase
    .from('fleet_group_vehicles')
    .upsert({ fleet_group_id: fleetGroupId, vehicle_id: vehicleId }, { onConflict: 'fleet_group_id,vehicle_id' });
  if (error) throw error;
};

export const setFleetVehicles = async (fleetGroupId, vehicleIds) => {
  const { error: deleteError } = await supabase.from('fleet_group_vehicles').delete().eq('fleet_group_id', fleetGroupId);
  if (deleteError) throw deleteError;
  if (!vehicleIds.length) return;
  const { error: insertError } = await supabase.from('fleet_group_vehicles').insert(vehicleIds.map(vehicleId => ({ fleet_group_id: fleetGroupId, vehicle_id: vehicleId })));
  if (insertError) throw insertError;
};

export const deleteGarageVehicle = async (vehicleId) => {
  const { error } = await supabase
    .from('vehicles')
    .delete()
    .eq('id', vehicleId);

  if (error) throw error;
};

/**
 * Fetch detailing history for a specific plate number across all bookings.
 */
export const fetchVehicleHistory = async (plateNumber) => {
  const { data, error } = await supabase
    .from('booking_vehicles')
    .select(`
      id,
      status,
      created_at,
      booking:bookings(
        id,
        start_datetime,
        status,
        total_amount
      ),
      services:booking_vehicle_services(
        service_name,
        price
      )
    `)
    .eq('plate_number', plateNumber.toUpperCase())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};
