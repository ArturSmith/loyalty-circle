-- Profile edits are updates to the row created by handle_new_user(). Keep the
-- writable surface narrow so adding sensitive columns (including the customer
-- QR token) never makes them client-editable by accident.

revoke insert on public.profiles from authenticated;
revoke update on public.profiles from authenticated;

grant insert (id, display_name, avatar_url, updated_at)
  on public.profiles to authenticated;
grant update (display_name, avatar_url, updated_at)
  on public.profiles to authenticated;

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);
