-- =============================================================================
-- 0008 - Realtime: add Notification + key tables to the realtime publication
-- =============================================================================
-- Enables Supabase Realtime (postgres_changes) on the tables the in-app
-- notification bell subscribes to. Apply this in the Supabase SQL Editor.
--
-- The default Supabase `supabase_realtime` publication may not include
-- these tables. Without this, the bell will fall back to "poll on
-- dropdown open" only.
-- =============================================================================

-- Add tables to the realtime publication
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'Notification'
  ) then
    alter publication supabase_realtime add table public."Notification";
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'Contribution'
  ) then
    alter publication supabase_realtime add table public."Contribution";
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'WelfareClaim'
  ) then
    alter publication supabase_realtime add table public."WelfareClaim";
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'Meeting'
  ) then
    alter publication supabase_realtime add table public."Meeting";
  end if;
end $$;

-- Enable REPLICA IDENTITY FULL for tables where we need the full row payload
-- (Supabase Realtime defaults to old/old-only for UPDATE events otherwise).
alter table public."Notification" replica identity full;
alter table public."WelfareClaim" replica identity full;

-- Sanity check: list tables in the publication
select schemaname, tablename
  from pg_publication_tables
 where pubname = 'supabase_realtime'
   and schemaname = 'public'
order by tablename;
