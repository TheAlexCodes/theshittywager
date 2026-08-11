-- Run this in Supabase SQL Editor and share the output.
-- It lists columns for your existing tables (handles quoted/PascalCase names).

select
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema = 'public'
  and lower(c.table_name) in ('bets', 'futures', 'profiles', 'weeks')
order by c.table_name, c.ordinal_position;

-- Optional: list existing policies and triggers
select schemaname, tablename, policyname, cmd, qual
from pg_policies
where schemaname = 'public'
  and lower(tablename) in ('bets', 'futures', 'profiles', 'weeks');
