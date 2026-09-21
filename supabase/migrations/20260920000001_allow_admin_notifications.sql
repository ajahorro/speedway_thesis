drop policy if exists "Admins can create user notifications" on public.notifications;

create policy "Admins can create user notifications"
  on public.notifications
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and upper(profiles.role) = 'ADMIN'
    )
  );

drop policy if exists "Admins can update payment verification" on public.payments;

create policy "Admins can update payment verification"
  on public.payments
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and upper(profiles.role) = 'ADMIN'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and upper(profiles.role) = 'ADMIN'
    )
  );

drop policy if exists "Admins can record payments" on public.payments;

create policy "Admins can record payments"
  on public.payments
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and upper(profiles.role) = 'ADMIN'
    )
  );