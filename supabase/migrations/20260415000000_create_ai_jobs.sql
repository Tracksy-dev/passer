create table if not exists public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  video_url text not null,
  status text not null check (
    status in (
      'queued',
      'downloading',
      'loading_model',
      'processing',
      'finalizing',
      'completed',
      'failed'
    )
  ),
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  message text,
  processed_frames integer,
  total_frames integer,
  result_json jsonb,
  error_text text,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_ai_jobs_user_id on public.ai_jobs(user_id);
create index if not exists idx_ai_jobs_match_id on public.ai_jobs(match_id);
create index if not exists idx_ai_jobs_status on public.ai_jobs(status);
create index if not exists idx_ai_jobs_updated_at on public.ai_jobs(updated_at desc);

create or replace function public.touch_ai_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_ai_jobs_updated_at on public.ai_jobs;
create trigger trg_touch_ai_jobs_updated_at
before update on public.ai_jobs
for each row execute procedure public.touch_ai_jobs_updated_at();

alter table public.ai_jobs enable row level security;

drop policy if exists "Users can view own ai jobs" on public.ai_jobs;
create policy "Users can view own ai jobs"
on public.ai_jobs
for select
using (auth.uid() = user_id);

drop policy if exists "Users can create own ai jobs" on public.ai_jobs;
create policy "Users can create own ai jobs"
on public.ai_jobs
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own ai jobs" on public.ai_jobs;
create policy "Users can update own ai jobs"
on public.ai_jobs
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
