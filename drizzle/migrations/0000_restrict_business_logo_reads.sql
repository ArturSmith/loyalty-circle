create or replace function public.business_logo_folder_visible(_folder text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.businesses b
    where b.owner_id::text = _folder
      and (
        b.accepted_by_platform = true
        or b.owner_id = auth.uid()
        or exists (
          select 1 from public.business_members m
          where m.business_id = b.id
            and m.user_id = auth.uid()
            and m.status = 'active'
        )
      )
  )
$$;

revoke all on function public.business_logo_folder_visible(text) from public;
grant execute on function public.business_logo_folder_visible(text) to anon, authenticated;

drop policy if exists "Business logos are readable by anyone" on storage.objects;

create policy "Business logos readable for visible businesses"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'business-logos'
  and public.business_logo_folder_visible((storage.foldername(name))[1])
);
