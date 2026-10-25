-- Progreso personal de cada estudiante. El banco y los apuntes permanecen
-- como archivos estáticos del cliente según RNF-03.

create table if not exists public.user_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  total_xp integer not null default 0 check (total_xp >= 0),
  unlocked_unit_ids smallint[] not null default array[1]::smallint[],
  unit_progress jsonb not null default '{
    "1": {"completionCount": 0, "mastery": "none"},
    "2": {"completionCount": 0, "mastery": "none"},
    "3": {"completionCount": 0, "mastery": "none"},
    "4": {"completionCount": 0, "mastery": "none"},
    "5": {"completionCount": 0, "mastery": "none"},
    "6": {"completionCount": 0, "mastery": "none"},
    "7": {"completionCount": 0, "mastery": "none"},
    "8": {"completionCount": 0, "mastery": "none"}
  }'::jsonb,
  error_chest_question_ids text[] not null default array[]::text[],
  unlocked_medals text[] not null default array[]::text[],
  statistics jsonb not null default '{
    "gamesStarted": 0,
    "gamesWon": 0,
    "gamesLost": 0,
    "questionsAnswered": 0,
    "correctAnswers": 0,
    "incorrectAnswers": 0,
    "bestCombo": 0
  }'::jsonb,
  active_game_session jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_progress_unit_ids_valid
    check (
      unlocked_unit_ids <@ array[1, 2, 3, 4, 5, 6, 7, 8]::smallint[]
      and 1 = any(unlocked_unit_ids)
    )
);

alter table public.user_progress enable row level security;

drop policy if exists "Students can read their own progress" on public.user_progress;
create policy "Students can read their own progress"
  on public.user_progress
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Students can create their own progress" on public.user_progress;
create policy "Students can create their own progress"
  on public.user_progress
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Students can update their own progress" on public.user_progress;
create policy "Students can update their own progress"
  on public.user_progress
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.user_progress to authenticated;

create or replace function public.set_user_progress_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_progress_updated_at on public.user_progress;
create trigger set_user_progress_updated_at
  before update on public.user_progress
  for each row
  execute function public.set_user_progress_updated_at();

create or replace function public.create_user_progress_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_progress (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_user_progress_after_signup on auth.users;
create trigger create_user_progress_after_signup
  after insert on auth.users
  for each row
  execute function public.create_user_progress_for_new_user();
