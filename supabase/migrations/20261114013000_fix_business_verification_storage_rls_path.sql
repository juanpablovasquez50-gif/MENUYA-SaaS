-- Correct the tenant folder check for private business verification uploads.
-- The storage object path is {business_id}/{document_type}/{filename};
-- foldername(name)[1] is the business UUID. The previous policy mistakenly
-- inspected businesses.name, which denied legitimate merchant uploads.

drop policy if exists "business verification files upload own" on storage.objects;
drop policy if exists "business verification files read own or admin" on storage.objects;
drop policy if exists "business verification files delete own" on storage.objects;

create policy "business verification files upload own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'business-verification'
  and exists (
    select 1
    from public.businesses b
    where b.id::text = (storage.foldername(name))[1]
      and (
        b.owner_id = (select auth.uid())
        or exists (
          select 1
          from public.business_memberships m
          where m.business_id = b.id
            and m.user_id = (select auth.uid())
            and m.status = 'active'
            and m.role in ('owner', 'admin')
        )
      )
  )
);

create policy "business verification files read own or admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'business-verification'
  and (
    exists (
      select 1
      from public.businesses b
      where b.id::text = (storage.foldername(name))[1]
        and (
          b.owner_id = (select auth.uid())
          or exists (
            select 1
            from public.business_memberships m
            where m.business_id = b.id
              and m.user_id = (select auth.uid())
              and m.status = 'active'
              and m.role in ('owner', 'admin')
          )
        )
    )
    or exists (
      select 1
      from public.platform_admins pa
      where pa.user_id = (select auth.uid())
    )
  )
);

create policy "business verification files delete own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'business-verification'
  and exists (
    select 1
    from public.businesses b
    where b.id::text = (storage.foldername(name))[1]
      and (
        b.owner_id = (select auth.uid())
        or exists (
          select 1
          from public.business_memberships m
          where m.business_id = b.id
            and m.user_id = (select auth.uid())
            and m.status = 'active'
            and m.role in ('owner', 'admin')
        )
      )
  )
);
