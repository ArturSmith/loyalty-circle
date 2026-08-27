-- Per-card terms and an immutable snapshot of what each customer accepted.

alter table public.card_templates
  add column if not exists terms_and_conditions text,
  add column if not exists terms_version integer not null default 1;

update public.card_templates
set terms_and_conditions =
  'Stamps and rewards have no cash value and are not transferable. Rewards are subject to availability. The issuing business may change or end this loyalty program where permitted by law.'
where terms_and_conditions is null or btrim(terms_and_conditions) = '';

alter table public.card_templates
  alter column terms_and_conditions set not null;

alter table public.card_templates
  drop constraint if exists card_templates_terms_length_check;
alter table public.card_templates
  add constraint card_templates_terms_length_check
  check (char_length(btrim(terms_and_conditions)) between 10 and 20000);

create or replace function public.bump_card_terms_version()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.terms_and_conditions is distinct from old.terms_and_conditions then
    new.terms_version := old.terms_version + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists bump_card_terms_version_trg on public.card_templates;
create trigger bump_card_terms_version_trg
  before update of terms_and_conditions on public.card_templates
  for each row execute function public.bump_card_terms_version();

alter table public.card_instances
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_accepted_version integer,
  add column if not exists terms_accepted_text text,
  add column if not exists terms_accepted_by uuid references auth.users(id) on delete set null;

-- New cards are created through permission-aware server functions, which
-- validate the current terms version and save its text. Removing direct INSERT
-- closes the route that could otherwise create an instance without consent.
revoke insert on public.card_instances from authenticated, anon;
drop policy if exists "Customer creates own instance" on public.card_instances;

create index if not exists card_instances_terms_acceptance_idx
  on public.card_instances (template_id, terms_accepted_version);
