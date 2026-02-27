-- Enable UUID extension
create extension if not exists "uuid-ossp";

----------------------------------------------------------------
-- 1. ORGANIZATIONS
----------------------------------------------------------------
create table if not exists public.organizations (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  slug text unique not null,
  billing_email text,
  subscription_tier text default 'free', -- 'free', 'pro', 'enterprise'
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS: Organizations are viewable by members
alter table public.organizations enable row level security;

create policy "Organizations are viewable by members"
  on public.organizations for select
  using (
    id in (
      select org_id from public.organization_members
      where user_id = auth.uid()
    )
  );

----------------------------------------------------------------
-- 2. ORGANIZATION MEMBERS
----------------------------------------------------------------
create table if not exists public.organization_members (
  id uuid default uuid_generate_v4() primary key,
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'member', -- 'owner', 'admin', 'member'
  created_at timestamp with time zone default timezone('utc'::text, now()),
  unique(org_id, user_id)
);

-- RLS: Members can view their own membership
alter table public.organization_members enable row level security;

create policy "Users can view own membership"
  on public.organization_members for select
  using ( auth.uid() = user_id );

----------------------------------------------------------------
-- 3. MODULES (The SaaS Features)
----------------------------------------------------------------
create table if not exists public.modules (
  id text primary key,
  name text not null,
  description text,
  is_public boolean default true
);

-- Seed Data (Upsert)
insert into public.modules (id, name, description) values 
('dast_core', 'Standard Vulnerability Scanner', 'Basic web application scanning'),
('dast_advanced', 'Advanced DAST (ZAP)', 'Deep automated security testing'),
('sast_pro', 'Advanced Source Code Analysis', 'Static analysis for proprietary code'),
('recon_aether', 'Aether Reconnaissance Engine', 'Passive intelligence gathering'),
('vmt_enterprise', 'Vulnerability Management', 'track and triage findings')
on conflict (id) do nothing;

-- RLS: Public reading of modules
alter table public.modules enable row level security;
create policy "Modules are viewable by everyone" on public.modules for select using (true);

----------------------------------------------------------------
-- 4. ENTITLEMENTS (Subscriptions)
----------------------------------------------------------------
create table if not exists public.organization_entitlements (
  id uuid default uuid_generate_v4() primary key,
  org_id uuid references public.organizations(id) on delete cascade,
  module_id text references public.modules(id) on delete cascade,
  expires_at timestamp with time zone, -- null = lifetime
  is_active boolean default true,
  granted_by uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS: Viewable by org members
alter table public.organization_entitlements enable row level security;

create policy "Members see their entitlements"
  on public.organization_entitlements for select
  using (
    org_id in (
      select org_id from public.organization_members
      where user_id = auth.uid()
    )
  );
