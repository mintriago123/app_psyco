-- Ejecutar durante el cambio al cliente que escribe mediante RPC.
begin;

lock table public.user_progress in access exclusive mode;

revoke insert, update, delete, truncate on public.user_progress from public, anon, authenticated;
drop policy if exists "Students can create their own progress" on public.user_progress;
drop policy if exists "Students can update their own progress" on public.user_progress;

-- Una pestaña antigua pudo haber guardado una partida después de la primera migración.
update public.user_progress
set active_game_session = active_game_session || jsonb_build_object('sessionId', gen_random_uuid(), 'revision', 0)
where active_game_session->>'phase' = 'active'
  and active_game_session->>'sessionId' is null;

commit;
