-- Prevent customer reschedules from bypassing concurrent booking capacity.
create or replace function public.reschedule_booking(
  p_booking_id uuid,
  p_start_datetime timestamptz,
  p_end_datetime timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_role text;
  v_capacity integer;
  v_overlap_count integer;
begin
  if p_start_datetime is null or p_end_datetime is null or p_end_datetime <= p_start_datetime then
    raise exception 'A valid start and end time are required';
  end if;

  select * into v_booking
    from public.bookings
   where id = p_booking_id
   for update;
  if not found then raise exception 'Booking not found'; end if;

  select upper(role) into v_role from public.profiles where id = auth.uid();
  if v_role <> 'ADMIN' and v_booking.customer_id <> auth.uid() then
    raise exception 'You are not authorized to reschedule this booking';
  end if;

  if lower(v_booking.status) not in ('scheduled', 'confirmed') then
    raise exception 'Only scheduled or confirmed bookings can be rescheduled';
  end if;

  select greatest(1, coalesce(slots_per_hour, 1))::integer
    into v_capacity
    from public.business_config
   limit 1;
  v_capacity := coalesce(v_capacity, 1);

  select count(*)::integer
    into v_overlap_count
    from public.bookings b
   where b.id <> p_booking_id
     and lower(coalesce(b.status, '')) not in ('cancelled', 'completed', 'released', 'flagged_noshow')
     and b.start_datetime < p_end_datetime
     and b.end_datetime > p_start_datetime;

  if v_overlap_count >= v_capacity then
    raise exception 'The selected time is full. Please choose another appointment time.';
  end if;

  update public.bookings
     set start_datetime = p_start_datetime,
         end_datetime = p_end_datetime,
         status = 'scheduled',
         staff_id = null,
         bay_id = null,
         reminder_sent = false,
         needs_attention = false,
         updated_at = now()
   where id = p_booking_id;

  update public.booking_vehicles
     set status = 'SCHEDULED',
         started_at = null,
         completed_at = null
   where booking_id = p_booking_id;

  return jsonb_build_object('booking_id', p_booking_id, 'status', 'scheduled', 'bay_id', null);
end;
$$;

revoke all on function public.reschedule_booking(uuid, timestamptz, timestamptz) from public;
grant execute on function public.reschedule_booking(uuid, timestamptz, timestamptz) to authenticated;