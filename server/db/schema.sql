-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES (Extends Auth.Users)
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  role text default 'member' check (role in ('admin', 'member', 'viewer')),
  organization_id uuid references public.organizations(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. ORGANIZATIONS (Multi-tenancy Root)
create table public.organizations (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  subscription_plan text default 'free' check (subscription_plan in ('free', 'pro', 'enterprise')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. SCANS (Job History)
create table public.scans (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id),
  organization_id uuid references public.organizations(id),
  target_url text not null,
  status text default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  scan_type text default 'full',
  result_summary jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completed_at timestamp with time zone
);

-- 4. FINDINGS (Vulnerabilities)
create table public.findings (
  id uuid default uuid_generate_v4() primary key,
  scan_id uuid references public.scans(id) on delete cascade,
  title text not null,
  severity text check (severity in ('critical', 'high', 'medium', 'low', 'info')),
  description text,
  remediation text,
  evidence text,
  reproduction_url text,
  curl_command text,
  cvss_score numeric(3,1),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Row Level Security (RLS) Policies

-- Organization Isolation: Users can only see data from their organization
alter table public.scans enable row level security;

create policy "Users can view scans of their own organization"
on public.scans for select
using (
  organization_id in (
    select organization_id from public.profiles
    where id = auth.uid()
  )
);

create policy "Users can create scans for their organization"
on public.scans for insert
with check (
  organization_id in (
    select organization_id from public.profiles
    where id = auth.uid()
  )
);
