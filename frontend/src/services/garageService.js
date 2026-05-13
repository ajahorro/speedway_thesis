import { supabase } from '../lib/supabase';

/**
 * garageService.js
 * Handles persistent vehicle storage for customers.
 */

export const fetchUserGarage = async (userId) => {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
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
  return data || [];
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
