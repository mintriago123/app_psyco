begin;

create table public.finished_game_sessions (
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null,
  result jsonb not null,
  finished_at timestamptz not null default now(),
  primary key (user_id, session_id)
);

alter table public.finished_game_sessions enable row level security;
revoke all on public.finished_game_sessions from public, anon, authenticated;

update public.user_progress
set active_game_session = active_game_session || jsonb_build_object('sessionId', gen_random_uuid(), 'revision', 0)
where active_game_session->>'phase' = 'active'
  and active_game_session->>'sessionId' is null;

create function public.start_game_session(p_user_id uuid, p_session jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  progress public.user_progress%rowtype;
  unit_id smallint := (p_session->>'unitId')::smallint;
  next_session jsonb;
begin
  select * into strict progress from public.user_progress
  where user_id = auth.uid() and user_id = p_user_id for update;

  if unit_id is null or not (unit_id = any(progress.unlocked_unit_ids)) then
    raise exception 'Esta unidad todavía está bloqueada.';
  end if;

  if progress.active_game_session->>'phase' = 'active' then
    next_session := progress.active_game_session;
    if next_session->>'sessionId' is null then
      next_session := next_session || jsonb_build_object('sessionId', gen_random_uuid(), 'revision', 0);
      update public.user_progress set active_game_session = next_session where user_id = p_user_id;
    end if;
    return next_session;
  end if;

  if p_session->>'phase' is distinct from 'active'
    or p_session->>'totalAttempts' is distinct from '0'
    or p_session->>'lives' is distinct from '5'
    or p_session->>'startingLives' is distinct from '5'
    or jsonb_typeof(p_session->'questionQueue') is distinct from 'array' then
    raise exception 'El estado inicial de la partida no es válido.';
  end if;

  next_session := p_session || jsonb_build_object('sessionId', gen_random_uuid(), 'revision', 0);

  update public.user_progress
  set active_game_session = next_session,
      statistics = statistics || jsonb_build_object(
        'gamesStarted', coalesce((statistics->>'gamesStarted')::int, 0) + 1
      )
  where user_id = p_user_id;

  return next_session;
end;
$$;

create function public.save_game_snapshot(p_user_id uuid, p_session jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  revision int := (p_session->>'revision')::int;
begin
  if p_session->>'phase' is distinct from 'active' or revision is null or revision < 0 then
    raise exception 'El estado de la partida no es válido.';
  end if;

  update public.user_progress
  set active_game_session = p_session
  where user_id = auth.uid()
    and user_id = p_user_id
    and active_game_session->>'phase' = 'active'
    and active_game_session->>'sessionId' = p_session->>'sessionId'
    and active_game_session->>'unitId' = p_session->>'unitId'
    and coalesce((active_game_session->>'revision')::int, 0) < revision;

  return found;
end;
$$;

create function public.change_error_vault(p_user_id uuid, p_question_id text, p_add boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_question_id is null or btrim(p_question_id) = '' or p_add is null then
    raise exception 'La pregunta no es válida.';
  end if;

  update public.user_progress
  set error_chest_question_ids = case
    when not p_add then array_remove(error_chest_question_ids, p_question_id)
    when p_question_id = any(error_chest_question_ids) then error_chest_question_ids
    else array_append(error_chest_question_ids, p_question_id)
  end
  where user_id = auth.uid() and user_id = p_user_id;

  if not found then
    raise exception 'No se encontró el progreso del usuario.';
  end if;
end;
$$;

create function public.finish_game_session(p_user_id uuid, p_session_id uuid, p_result jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  progress public.user_progress%rowtype;
  saved_result jsonb;
  unit_key text := p_result->>'unitId';
  won boolean := p_result->>'phase' = 'won';
  attempts int;
  correct int;
  combo int;
  xp int;
  lives int;
  completions int;
  unit_id smallint;
begin
  select * into strict progress from public.user_progress
  where user_id = auth.uid() and user_id = p_user_id for update;

  select result into saved_result from public.finished_game_sessions
  where user_id = p_user_id and session_id = p_session_id;
  if found then
    return saved_result;
  end if;

  if p_session_id is null
    or progress.active_game_session->>'phase' is distinct from 'active'
    or progress.active_game_session->>'sessionId' is distinct from p_session_id::text
    or p_result->>'sessionId' is distinct from p_session_id::text
    or unit_key is distinct from progress.active_game_session->>'unitId' then
    raise exception 'Esta partida ya no está activa.';
  end if;

  attempts := (p_result->>'totalAttempts')::int;
  correct := (p_result->>'correctAnswers')::int;
  combo := (p_result->>'bestCombo')::int;
  xp := (p_result->>'earnedXp')::int;
  lives := (p_result->>'lives')::int;
  unit_id := unit_key::smallint;

  if p_result->>'phase' is null or p_result->>'phase' not in ('won', 'out_of_lives')
    or unit_id is null or unit_id not between 1 and 8
    or attempts is null or attempts <= 0
    or correct is null or correct not between 0 and attempts
    or combo is null or combo not between 0 and correct
    or xp is null or xp < 0 or xp > correct::bigint * 15
    or p_result->>'startingLives' is distinct from '5'
    or lives is null or lives not between 0 and 5
    or won <> (lives > 0) or attempts - correct <> 5 - lives
    or jsonb_typeof(p_result->'failedQuestionIds') is distinct from 'array'
    or jsonb_typeof(p_result->'questionQueue') is distinct from 'array'
    or jsonb_typeof(p_result->'completedQuestionIds') is distinct from 'array' then
    raise exception 'El resultado de la partida contiene valores inválidos.';
  end if;

  if exists (select 1 from jsonb_array_elements(p_result->'failedQuestionIds') as failed(item)
    where jsonb_typeof(item) <> 'string' or btrim(item #>> '{}') = '') then
    raise exception 'Las preguntas falladas contienen valores inválidos.';
  end if;

  insert into public.finished_game_sessions (user_id, session_id, result)
  values (p_user_id, p_session_id, p_result);

  progress.statistics := progress.statistics || jsonb_build_object(
    'gamesWon', coalesce((progress.statistics->>'gamesWon')::int, 0) + won::int,
    'gamesLost', coalesce((progress.statistics->>'gamesLost')::int, 0) + (not won)::int,
    'questionsAnswered', coalesce((progress.statistics->>'questionsAnswered')::int, 0) + attempts,
    'correctAnswers', coalesce((progress.statistics->>'correctAnswers')::int, 0) + correct,
    'incorrectAnswers', coalesce((progress.statistics->>'incorrectAnswers')::int, 0) + attempts - correct,
    'bestCombo', greatest(coalesce((progress.statistics->>'bestCombo')::int, 0), combo)
  );

  if won then
    completions := coalesce((progress.unit_progress->unit_key->>'completionCount')::int, 0) + 1;
    progress.unit_progress := jsonb_set(progress.unit_progress, array[unit_key], jsonb_build_object(
      'completionCount', completions,
      'mastery', case when completions >= 3 then 'gold' when completions = 2 then 'silver' else 'bronze' end
    ));
    if unit_id < 8 and not ((unit_id + 1) = any(progress.unlocked_unit_ids)) then
      progress.unlocked_unit_ids := array_append(progress.unlocked_unit_ids, (unit_id + 1)::smallint);
    end if;

    -- Criterios de medallas de la especificación 07.
    if lives = 5 and correct = attempts and not ('ojo-clinico' = any(progress.unlocked_medals)) then
      progress.unlocked_medals := array_append(progress.unlocked_medals, 'ojo-clinico');
    end if;
    if not exists (
      select 1 from generate_series(1, 5) as unit(number)
      where progress.unit_progress->(number::text)->>'mastery' is distinct from 'gold'
    ) and not ('semiologo-experto' = any(progress.unlocked_medals)) then
      progress.unlocked_medals := array_append(progress.unlocked_medals, 'semiologo-experto');
    end if;
    if (progress.statistics->>'bestCombo')::int >= 5 and not ('combo-imparable' = any(progress.unlocked_medals)) then
      progress.unlocked_medals := array_append(progress.unlocked_medals, 'combo-imparable');
    end if;
  end if;

  update public.user_progress
  set total_xp = progress.total_xp + xp,
      unlocked_unit_ids = progress.unlocked_unit_ids,
      unit_progress = progress.unit_progress,
      unlocked_medals = progress.unlocked_medals,
      statistics = progress.statistics,
      active_game_session = p_result,
      error_chest_question_ids = array(
        select item
        from unnest(
          progress.error_chest_question_ids ||
          array(select jsonb_array_elements_text(p_result->'failedQuestionIds'))
        ) with ordinality as chest(item, position)
        group by item order by min(position)
      )
  where user_id = p_user_id;

  return p_result;
end;
$$;

revoke all on function public.start_game_session(uuid, jsonb),
  public.save_game_snapshot(uuid, jsonb), public.change_error_vault(uuid, text, boolean),
  public.finish_game_session(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.start_game_session(uuid, jsonb),
  public.save_game_snapshot(uuid, jsonb), public.change_error_vault(uuid, text, boolean),
  public.finish_game_session(uuid, uuid, jsonb) to authenticated;

commit;
