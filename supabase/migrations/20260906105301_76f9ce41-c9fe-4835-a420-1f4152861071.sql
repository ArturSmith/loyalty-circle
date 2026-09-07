begin;

create or replace function public.guard_card_in_use()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  -- Platform moderation (approve/reject) must always be able to apply the
  -- reviewed version, even for cards customers already hold.
  if coalesce(current_setting('app.moderation_apply', true), '') = '1'
     or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if row(new.business_id, new.title, new.subtitle, new.description, new.corner_title,
         new.total_steps, new.shape, new.bg_color, new.accent_color, new.text_color,
         new.stamp_icon, new.stamp_shape, new.step_size, new.logo_url, new.rewards,
         new.grid_cols, new.terms_and_conditions, new.usage_instructions)
     is distinct from
     row(old.business_id, old.title, old.subtitle, old.description, old.corner_title,
         old.total_steps, old.shape, old.bg_color, old.accent_color, old.text_color,
         old.stamp_icon, old.stamp_shape, old.step_size, old.logo_url, old.rewards,
         old.grid_cols, old.terms_and_conditions, old.usage_instructions)
     and exists (select 1 from public.card_instances where template_id = old.id) then
    raise exception 'This card is already used by customers and cannot be edited. Create a new card instead.';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_card_in_use() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;