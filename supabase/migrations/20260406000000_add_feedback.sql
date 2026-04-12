create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Users can insert their own feedback
create policy "Users can insert feedback"
  on public.feedback for insert
  with check (auth.uid() = user_id);

-- Only the user can read their own feedback (admins can query directly)
create policy "Users can read own feedback"
  on public.feedback for select
  using (auth.uid() = user_id);
