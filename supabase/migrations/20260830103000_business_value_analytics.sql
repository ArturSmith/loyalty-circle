-- Value-focused business analytics.
--
-- The application only receives loyalty activity, not transaction totals, so
-- this report deliberately measures recorded visits, returning customers and
-- reward usage without presenting them as revenue or purchases. All raw rows
-- stay in Postgres; clients receive aggregate counts only.

create index if not exists card_events_business_type_created_idx
  on public.card_events (business_id, event_type, created_at);

create index if not exists vouchers_business_status_created_idx
  on public.vouchers (business_id, status, created_at);

create or replace function public.get_business_value_analytics(
  _business_id uuid,
  _range_days integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_current_from timestamptz;
  v_previous_from timestamptz;
  v_bucket text;
  v_bucket_step interval;
  v_timeline_from timestamptz;
  v_current jsonb;
  v_previous jsonb;
  v_funnel jsonb;
  v_timeline jsonb;
  v_cards jsonb;
  v_insights jsonb;
begin
  if auth.uid() is null
     or not public.has_business_permission(_business_id, auth.uid(), 'analytics.view') then
    raise exception 'You do not have permission to view analytics for this business';
  end if;

  if _range_days not in (0, 7, 30, 90) then
    raise exception 'Analytics range must be 7, 30, 90, or 0 for all time';
  end if;

  if _range_days = 0 then
    v_current_from := null;
    v_previous_from := null;
    v_bucket := 'month';
    v_bucket_step := interval '1 month';
  else
    v_current_from := v_now - make_interval(days => _range_days);
    v_previous_from := v_current_from - make_interval(days => _range_days);
    v_bucket := case when _range_days = 7 then 'day' else 'week' end;
    v_bucket_step := case when _range_days = 7 then interval '1 day' else interval '1 week' end;
  end if;

  with ranked_stamps as (
    select
      e.customer_id,
      e.created_at,
      row_number() over (
        partition by e.customer_id
        order by e.created_at, e.id
      ) as visit_number
    from public.card_events e
    where e.business_id = _business_id
      and e.event_type = 'stamp'
      and e.customer_id is not null
      and e.created_at < v_now
  ),
  first_customers as (
    select e.customer_id, min(e.created_at) as joined_at
    from public.card_events e
    where e.business_id = _business_id
      and e.customer_id is not null
      and e.event_type in ('card_added', 'stamp')
      and e.created_at < v_now
    group by e.customer_id
  )
  select jsonb_build_object(
    'activeCustomers', count(distinct r.customer_id)
      filter (where v_current_from is null or r.created_at >= v_current_from),
    'returnVisits', count(*)
      filter (where r.visit_number > 1 and (v_current_from is null or r.created_at >= v_current_from)),
    'returningCustomers', count(distinct r.customer_id)
      filter (where r.visit_number > 1 and (v_current_from is null or r.created_at >= v_current_from)),
    'newCustomers', (
      select count(*) from first_customers f
      where v_current_from is null or f.joined_at >= v_current_from
    ),
    'stamps', count(*)
      filter (where v_current_from is null or r.created_at >= v_current_from),
    'rewardsIssued', (
      select count(*) from public.vouchers v
      where v.business_id = _business_id
        and (v_current_from is null or v.created_at >= v_current_from)
        and v.created_at < v_now
    ),
    'rewardsRedeemed', (
      select count(*) from public.vouchers v
      where v.business_id = _business_id
        and v.status = 'used'
        and v.redeemed_at is not null
        and (v_current_from is null or v.redeemed_at >= v_current_from)
        and v.redeemed_at < v_now
    )
  ) into v_current
  from ranked_stamps r;

  if _range_days = 0 then
    v_previous := jsonb_build_object(
      'activeCustomers', 0,
      'returnVisits', 0,
      'returningCustomers', 0,
      'newCustomers', 0,
      'stamps', 0,
      'rewardsIssued', 0,
      'rewardsRedeemed', 0
    );
  else
    with ranked_stamps as (
      select
        e.customer_id,
        e.created_at,
        row_number() over (
          partition by e.customer_id
          order by e.created_at, e.id
        ) as visit_number
      from public.card_events e
      where e.business_id = _business_id
        and e.event_type = 'stamp'
        and e.customer_id is not null
        and e.created_at < v_current_from
    ),
    first_customers as (
      select e.customer_id, min(e.created_at) as joined_at
      from public.card_events e
      where e.business_id = _business_id
        and e.customer_id is not null
        and e.event_type in ('card_added', 'stamp')
        and e.created_at < v_current_from
      group by e.customer_id
    )
    select jsonb_build_object(
      'activeCustomers', count(distinct r.customer_id)
        filter (where r.created_at >= v_previous_from),
      'returnVisits', count(*)
        filter (where r.visit_number > 1 and r.created_at >= v_previous_from),
      'returningCustomers', count(distinct r.customer_id)
        filter (where r.visit_number > 1 and r.created_at >= v_previous_from),
      'newCustomers', (
        select count(*) from first_customers f where f.joined_at >= v_previous_from
      ),
      'stamps', count(*) filter (where r.created_at >= v_previous_from),
      'rewardsIssued', (
        select count(*) from public.vouchers v
        where v.business_id = _business_id
          and v.created_at >= v_previous_from
          and v.created_at < v_current_from
      ),
      'rewardsRedeemed', (
        select count(*) from public.vouchers v
        where v.business_id = _business_id
          and v.status = 'used'
          and v.redeemed_at >= v_previous_from
          and v.redeemed_at < v_current_from
      )
    ) into v_previous
    from ranked_stamps r;
  end if;

  -- A cohort funnel: customers whose first recorded loyalty activity occurred
  -- in the selected period, followed through their current journey state.
  with first_customers as (
    select e.customer_id, min(e.created_at) as joined_at
    from public.card_events e
    where e.business_id = _business_id
      and e.customer_id is not null
      and e.event_type in ('card_added', 'stamp')
    group by e.customer_id
  ),
  cohort as (
    select f.customer_id
    from first_customers f
    where (v_current_from is null or f.joined_at >= v_current_from)
      and f.joined_at < v_now
  ),
  activity as (
    select e.customer_id, count(*) filter (where e.event_type = 'stamp') as stamp_count
    from public.card_events e
    join cohort c on c.customer_id = e.customer_id
    where e.business_id = _business_id
    group by e.customer_id
  ),
  rewards as (
    select
      v.customer_id,
      count(*) as issued,
      count(*) filter (where v.status = 'used') as redeemed
    from public.vouchers v
    join cohort c on c.customer_id = v.customer_id
    where v.business_id = _business_id
    group by v.customer_id
  )
  select jsonb_build_object(
    'joined', (select count(*) from cohort),
    'activated', (select count(*) from activity where stamp_count >= 1),
    'returned', (select count(*) from activity where stamp_count >= 2),
    'rewarded', (select count(*) from rewards where issued >= 1),
    'redeemed', (select count(*) from rewards where redeemed >= 1)
  ) into v_funnel;

  if v_current_from is null then
    select date_trunc(v_bucket, coalesce(min(e.created_at), v_now))
      into v_timeline_from
    from public.card_events e
    where e.business_id = _business_id and e.event_type = 'stamp';
  else
    v_timeline_from := date_trunc(v_bucket, v_current_from);
  end if;

  with buckets as (
    select generate_series(
      v_timeline_from,
      date_trunc(v_bucket, v_now),
      v_bucket_step
    ) as bucket_start
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'start', b.bucket_start,
      'stamps', coalesce(a.stamps, 0),
      'activeCustomers', coalesce(a.active_customers, 0)
    ) order by b.bucket_start
  ), '[]'::jsonb)
  into v_timeline
  from buckets b
  left join lateral (
    select
      count(*) as stamps,
      count(distinct e.customer_id) as active_customers
    from public.card_events e
    where e.business_id = _business_id
      and e.event_type = 'stamp'
      and e.created_at >= b.bucket_start
      and e.created_at < b.bucket_start + v_bucket_step
  ) a on true;

  with ranked as (
    select
      e.template_id,
      e.customer_id,
      e.created_at,
      row_number() over (
        partition by e.template_id, e.customer_id
        order by e.created_at, e.id
      ) as visit_number
    from public.card_events e
    where e.business_id = _business_id
      and e.event_type = 'stamp'
      and e.template_id is not null
      and e.customer_id is not null
      and e.created_at < v_now
  ),
  stamp_totals as (
    select
      r.template_id,
      count(*) filter (where v_current_from is null or r.created_at >= v_current_from) as stamps,
      count(distinct r.customer_id)
        filter (where v_current_from is null or r.created_at >= v_current_from) as active_customers,
      count(*) filter (
        where r.visit_number > 1 and (v_current_from is null or r.created_at >= v_current_from)
      ) as return_visits,
      count(distinct r.customer_id) filter (
        where r.visit_number > 1 and (v_current_from is null or r.created_at >= v_current_from)
      ) as returning_customers,
      count(*) filter (
        where _range_days > 0
          and r.created_at >= v_previous_from
          and r.created_at < v_current_from
      ) as previous_stamps
    from ranked r
    group by r.template_id
  ),
  reward_totals as (
    select
      v.template_id,
      count(*) filter (
        where v.status = 'used'
          and v.redeemed_at is not null
          and (v_current_from is null or v.redeemed_at >= v_current_from)
          and v.redeemed_at < v_now
      ) as redeemed
    from public.vouchers v
    where v.business_id = _business_id and v.template_id is not null
    group by v.template_id
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'title', t.title,
      'active', t.active,
      'activeCustomers', coalesce(s.active_customers, 0),
      'stamps', coalesce(s.stamps, 0),
      'returnVisits', coalesce(s.return_visits, 0),
      'returnRate', case
        when coalesce(s.active_customers, 0) = 0 then 0
        else round(100.0 * s.returning_customers / s.active_customers)
      end,
      'rewardsRedeemed', coalesce(r.redeemed, 0),
      'previousStamps', coalesce(s.previous_stamps, 0)
    ) order by coalesce(s.active_customers, 0) desc, coalesce(s.stamps, 0) desc, t.title
  ), '[]'::jsonb)
  into v_cards
  from public.card_templates t
  left join stamp_totals s on s.template_id = t.id
  left join reward_totals r on r.template_id = t.id
  where t.business_id = _business_id;

  select jsonb_build_object(
    'nearRewardCustomers', (
      select count(distinct ci.customer_id)
      from public.card_instances ci
      join public.card_templates t on t.id = ci.template_id
      where t.business_id = _business_id
        and t.active = true
        and ci.customer_id is not null
        and t.total_steps - ci.stamps_count between 1 and 2
    ),
    'staleRewards', (
      select count(*)
      from public.vouchers v
      where v.business_id = _business_id
        and v.status = 'unused'
        and v.created_at < v_now - interval '30 days'
    ),
    'inactiveCustomers', (
      select count(*)
      from (
        select e.customer_id
        from public.card_events e
        where e.business_id = _business_id
          and e.event_type = 'stamp'
          and e.customer_id is not null
        group by e.customer_id
        having max(e.created_at) < v_now - interval '30 days'
      ) inactive
    )
  ) into v_insights;

  return jsonb_build_object(
    'rangeDays', _range_days,
    'generatedAt', v_now,
    'current', v_current,
    'previous', v_previous,
    'funnel', v_funnel,
    'timeline', v_timeline,
    'cards', v_cards,
    'insights', v_insights
  );
end;
$$;

revoke all on function public.get_business_value_analytics(uuid, integer) from public, anon;
grant execute on function public.get_business_value_analytics(uuid, integer) to authenticated, service_role;
