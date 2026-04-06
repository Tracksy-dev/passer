-- Add is_admin column to profiles
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Set the admin user
update public.profiles
  set is_admin = true
  where id = '1ea60e28-02b7-46b7-a194-46d03021ef8d';
