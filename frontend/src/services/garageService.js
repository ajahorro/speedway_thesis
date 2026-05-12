import { supabase } from '../lib/supabase';

/**
 * garageService.js
 * Handles persistent vehicle storage for customers.
 */

export const fetchUserGarage = async (userId) => {
  const { data, error } = await supabase
    .from('user_vehicles')
    .select('*')
    .eq('user_id', userId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
      console.warn('user_vehicles table might not exist yet. Returning empty garage.');
      return [];
    }
    throw error;
  }
  return data || [];
};

export const addVehicleToGarage = async (userId, vehicle) => {
  const { data, error } = await supabase
    .from('user_vehicles')
    .insert({
      user_id: userId,
      vehicle_type: vehicle.type,
      brand: vehicle.brand,
      model: vehicle.model,
      plate_number: vehicle.plateNumber.toUpperCase(),
      is_primary: vehicle.isPrimary || false
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateGarageVehicle = async (vehicleId, updates) => {
  const { data, error } = await supabase
    .from('user_vehicles')
    .update({
      vehicle_type: updates.type,
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
    .from('user_vehicles')
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
