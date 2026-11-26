-- XolveManager — Supabase initial schema (0001_init)
--
-- Mirrors the browser localStorage model (see src/types/index.ts and
-- src/services/localStorageStore.ts STORAGE_KEYS). Every table:
--   id         uuid primary key (cloud row id; local ids are arbitrary
--              strings, so identity is preserved in local_id)
--   user_id    uuid NOT NULL, references auth.users (the owner)
--   local_id   text NOT NULL, the local record id (invoiceId for invoices)
--   business_id text, the local business id when present
--   data       jsonb, the full original local record (source of truth for
--              fields without a dedicated column)
--   created_at / updated_at timestamptz
--   UNIQUE(user_id, local_id) so cloud upload is an idempotent upsert.
-- Row Level Security is enabled on every table with owner-only policies:
-- a user can only ever see or change rows where auth.uid() = user_id.
-- No sample data is inserted by this migration.
--
-- NOTE on service accounts: the local Account record contains a credential
-- field that the app already stores only in its masked representation.
-- There is deliberately NO plaintext credential column here; the masked
-- value travels inside `data` exactly as the app stores it today.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- business_profiles: one row per user, mirrors AppSettings (+ business record)
-- ---------------------------------------------------------------------------
create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_id text not null default 'business-profile',
  business_id text,
  store_name text,
  tagline text,
  currency text,
  language text,
  admin_email text,
  admin_name text,
  contact_phone text,
  whatsapp_number text,
  facebook_page_url text,
  reminder_notice_days integer,
  settings jsonb not null default '{}'::jsonb,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id),
  unique (user_id)
);

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_id text not null,
  business_id text,
  name text not null default '',
  phone text not null default '',
  email text not null default '',
  status text,
  is_archived boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

-- ---------------------------------------------------------------------------
-- services (planDetails live in the plan_details jsonb column)
-- ---------------------------------------------------------------------------
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_id text not null,
  business_id text,
  name text not null default '',
  category text,
  status text,
  default_duration_days integer,
  currency text,
  plan_details jsonb not null default '[]'::jsonb,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

-- ---------------------------------------------------------------------------
-- accounts: service accounts (credentials stay masked inside data only)
-- ---------------------------------------------------------------------------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_id text not null,
  business_id text,
  service_id text,
  email text,
  plan text,
  status text,
  profiles jsonb not null default '[]'::jsonb,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

-- ---------------------------------------------------------------------------
-- financial_accounts: money-receiving accounts (bKash / bank / cash / ...)
-- ---------------------------------------------------------------------------
create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_id text not null,
  business_id text,
  name text not null default '',
  type text,
  currency text,
  opening_balance numeric not null default 0,
  enabled boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

-- ---------------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_id text not null,
  business_id text,
  customer_id text,
  service_id text,
  plan text,
  start_date date,
  expiry_date date,
  price numeric not null default 0,
  currency text,
  payment_status text,
  status text,
  renewal_history jsonb not null default '[]'::jsonb,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

-- ---------------------------------------------------------------------------
-- sales
-- ---------------------------------------------------------------------------
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_id text not null,
  business_id text,
  customer_id text,
  service_id text,
  plan text,
  amount numeric not null default 0,
  currency text,
  payment_status text,
  date date,
  invoice_no text,
  line_items jsonb not null default '[]'::jsonb,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

-- ---------------------------------------------------------------------------
-- orders (quotations)
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_id text not null,
  business_id text,
  reference text,
  customer_id text,
  status text,
  currency text,
  total numeric not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

-- ---------------------------------------------------------------------------
-- invoices (local_id = invoiceId)
-- ---------------------------------------------------------------------------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_id text not null,
  business_id text,
  customer_id text,
  sale_id text,
  total_amount numeric not null default 0,
  paid_amount numeric not null default 0,
  due_amount numeric not null default 0,
  payment_status text,
  invoice_date date,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_id text not null,
  business_id text,
  customer_id text,
  amount numeric not null default 0,
  currency text,
  payment_method text,
  payment_date date,
  payment_status text,
  allocations jsonb not null default '[]'::jsonb,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_id text not null,
  business_id text,
  account_id text,
  category_id text,
  amount numeric not null default 0,
  currency text,
  date date,
  status text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

-- ---------------------------------------------------------------------------
-- other_income
-- ---------------------------------------------------------------------------
create table if not exists public.other_income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_id text not null,
  business_id text,
  account_id text,
  category_id text,
  amount numeric not null default 0,
  currency text,
  date date,
  status text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

-- ---------------------------------------------------------------------------
-- financial_transfers
-- ---------------------------------------------------------------------------
create table if not exists public.financial_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_id text not null,
  business_id text,
  from_account_id text,
  to_account_id text,
  amount numeric not null default 0,
  currency text,
  date date,
  status text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

-- ---------------------------------------------------------------------------
-- financial_adjustments
-- ---------------------------------------------------------------------------
create table if not exists public.financial_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_id text not null,
  business_id text,
  account_id text,
  amount numeric not null default 0,
  currency text,
  date date,
  reason text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

-- ---------------------------------------------------------------------------
-- daily_closings
-- ---------------------------------------------------------------------------
create table if not exists public.daily_closings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_id text not null,
  business_id text,
  date date,
  currency text,
  status text,
  expected_closing_balance numeric not null default 0,
  actual_closing_balance numeric not null default 0,
  accounts jsonb not null default '[]'::jsonb,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

-- ---------------------------------------------------------------------------
-- financial_reconciliations
-- ---------------------------------------------------------------------------
create table if not exists public.financial_reconciliations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_id text not null,
  business_id text,
  account_id text,
  reconciliation_date date,
  system_balance numeric not null default 0,
  actual_balance numeric not null default 0,
  difference numeric not null default 0,
  status text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

-- ---------------------------------------------------------------------------
-- financial_periods
-- ---------------------------------------------------------------------------
create table if not exists public.financial_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_id text not null,
  business_id text,
  start_date date,
  end_date date,
  status text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

-- ---------------------------------------------------------------------------
-- reminders
-- ---------------------------------------------------------------------------
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_id text not null,
  business_id text,
  type text,
  status text,
  priority text,
  due_date date,
  title text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

-- ---------------------------------------------------------------------------
-- profitability_costs
-- ---------------------------------------------------------------------------
create table if not exists public.profitability_costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_id text not null,
  business_id text,
  cost_type text,
  status text,
  category text,
  amount numeric not null default 0,
  currency text,
  date date,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

-- ---------------------------------------------------------------------------
-- activity_logs
-- ---------------------------------------------------------------------------
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_id text not null,
  business_id text,
  type text,
  title text,
  timestamp timestamptz,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_id text not null,
  business_id text,
  type text,
  category text,
  priority text,
  section text,
  read boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare
  table_name text;
begin
  for table_name in
    select t from unnest(array[
      'business_profiles', 'customers', 'services', 'accounts',
      'financial_accounts', 'subscriptions', 'sales', 'orders', 'invoices',
      'payments', 'expenses', 'other_income', 'financial_transfers',
      'financial_adjustments', 'daily_closings', 'financial_reconciliations',
      'financial_periods', 'reminders', 'profitability_costs',
      'activity_logs', 'notifications'
    ]) as t
  loop
    execute format(
      'drop trigger if exists set_updated_at on public.%I; '
      'create trigger set_updated_at before update on public.%I '
      'for each row execute function public.set_updated_at()',
      table_name, table_name
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security: owner-only on every table
-- ---------------------------------------------------------------------------
do $$
declare
  table_name text;
begin
  for table_name in
    select t from unnest(array[
      'business_profiles', 'customers', 'services', 'accounts',
      'financial_accounts', 'subscriptions', 'sales', 'orders', 'invoices',
      'payments', 'expenses', 'other_income', 'financial_transfers',
      'financial_adjustments', 'daily_closings', 'financial_reconciliations',
      'financial_periods', 'reminders', 'profitability_costs',
      'activity_logs', 'notifications'
    ]) as t
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'drop policy if exists "Owners can view own rows" on public.%I; '
      'create policy "Owners can view own rows" on public.%I '
      'for select using (auth.uid() = user_id)',
      table_name, table_name
    );
    execute format(
      'drop policy if exists "Owners can insert own rows" on public.%I; '
      'create policy "Owners can insert own rows" on public.%I '
      'for insert with check (auth.uid() = user_id)',
      table_name, table_name
    );
    execute format(
      'drop policy if exists "Owners can update own rows" on public.%I; '
      'create policy "Owners can update own rows" on public.%I '
      'for update using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      table_name, table_name
    );
    execute format(
      'drop policy if exists "Owners can delete own rows" on public.%I; '
      'create policy "Owners can delete own rows" on public.%I '
      'for delete using (auth.uid() = user_id)',
      table_name, table_name
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Indexes on user_id (every list query is scoped to the signed-in owner)
-- ---------------------------------------------------------------------------
create index if not exists business_profiles_user_id_idx on public.business_profiles (user_id);
create index if not exists customers_user_id_idx on public.customers (user_id);
create index if not exists services_user_id_idx on public.services (user_id);
create index if not exists accounts_user_id_idx on public.accounts (user_id);
create index if not exists financial_accounts_user_id_idx on public.financial_accounts (user_id);
create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);
create index if not exists subscriptions_customer_id_idx on public.subscriptions (user_id, customer_id);
create index if not exists sales_user_id_idx on public.sales (user_id);
create index if not exists sales_customer_id_idx on public.sales (user_id, customer_id);
create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists invoices_user_id_idx on public.invoices (user_id);
create index if not exists invoices_customer_id_idx on public.invoices (user_id, customer_id);
create index if not exists payments_user_id_idx on public.payments (user_id);
create index if not exists payments_customer_id_idx on public.payments (user_id, customer_id);
create index if not exists expenses_user_id_idx on public.expenses (user_id);
create index if not exists other_income_user_id_idx on public.other_income (user_id);
create index if not exists financial_transfers_user_id_idx on public.financial_transfers (user_id);
create index if not exists financial_adjustments_user_id_idx on public.financial_adjustments (user_id);
create index if not exists daily_closings_user_id_idx on public.daily_closings (user_id);
create index if not exists financial_reconciliations_user_id_idx on public.financial_reconciliations (user_id);
create index if not exists financial_periods_user_id_idx on public.financial_periods (user_id);
create index if not exists reminders_user_id_idx on public.reminders (user_id);
create index if not exists profitability_costs_user_id_idx on public.profitability_costs (user_id);
create index if not exists activity_logs_user_id_idx on public.activity_logs (user_id);
create index if not exists notifications_user_id_idx on public.notifications (user_id);
