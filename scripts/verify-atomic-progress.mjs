import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const databaseUrl = process.env.ATOMIC_PROGRESS_TEST_DATABASE_URL;
assert.ok(databaseUrl, "Set ATOMIC_PROGRESS_TEST_DATABASE_URL to an empty local PostgreSQL database.");
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname),
  "Use a disposable local PostgreSQL database.",
);

const { Client } = createRequire(import.meta.url)("pg");
const firstUser = "00000000-0000-4000-8000-000000000001";
const secondUser = "00000000-0000-4000-8000-000000000002";
const admin = new Client({ connectionString: databaseUrl });
const first = new Client({ connectionString: databaseUrl });
const second = new Client({ connectionString: databaseUrl });
const other = new Client({ connectionString: databaseUrl });

const initial = {
  unitId: 1,
  phase: "active",
  lives: 5,
  startingLives: 5,
  totalAttempts: 0,
  questionQueue: [],
  completedQuestionIds: [],
  failedQuestionIds: [],
};

async function apply(file) {
  await admin.query(await readFile(new URL(file, import.meta.url), "utf8"));
}

async function signIn(client, userId) {
  await client.query("set role authenticated");
  await client.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
}

async function progress() {
  return (await first.query("select * from public.user_progress")).rows[0];
}

async function start(client, userId, session = initial) {
  return (await client.query("select public.start_game_session($1, $2) as session", [userId, session])).rows[0].session;
}

async function close(client, userId, result) {
  return (await client.query(
    "select public.finish_game_session($1, $2, $3) as result",
    [userId, result.sessionId, result],
  )).rows[0].result;
}

function changeVault(client, questionId, add) {
  return client.query("select public.change_error_vault($1, $2, $3)", [firstUser, questionId, add]);
}

async function snapshot(session) {
  return (await first.query(
    "select public.save_game_snapshot($1, $2) as saved",
    [firstUser, session],
  )).rows[0].saved;
}

try {
  await Promise.all([admin, first, second, other].map((client) => client.connect()));
  await admin.query(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    grant usage on schema auth to authenticated;
  `);
  await apply("../supabase/schema.sql");
  await admin.query("insert into auth.users values ($1), ($2)", [firstUser, secondUser]);
  await admin.query(
    "update public.user_progress set active_game_session = $1, statistics = statistics || '{\"gamesStarted\": 1}' where user_id = $2",
    [{ ...initial, lives: 4, totalAttempts: 1 }, firstUser],
  );
  await apply("../supabase/migrations/202611250001_atomic_game_progress.sql");
  await apply("../supabase/cutover-atomic-game-progress.sql");
  await Promise.all([signIn(first, firstUser), signIn(second, firstUser), signIn(other, secondUser)]);

  const legacy = await start(first, firstUser);
  assert.ok(legacy.sessionId);
  assert.equal(legacy.lives, 4);
  assert.equal((await progress()).statistics.gamesStarted, 1);
  assert.equal(await snapshot({ ...legacy, revision: 2 }), true);
  assert.equal(await snapshot({ ...legacy, revision: 1 }), false);
  const win = {
    ...legacy, revision: 3, phase: "won", totalAttempts: 6, correctAnswers: 5,
    bestCombo: 5, earnedXp: 65, failedQuestionIds: ["u1-q01"],
  };

  await admin.query(`
    create function public.reject_test_progress_update() returns trigger language plpgsql as $$
    begin raise exception 'forced rollback'; end;
    $$;
    create trigger fail_test_progress_update before update on public.user_progress
      for each row execute function public.reject_test_progress_update();
  `);
  await assert.rejects(close(first, firstUser, win), /forced rollback/);
  assert.equal((await admin.query("select count(*) from public.finished_game_sessions")).rows[0].count, "0");
  assert.equal((await progress()).total_xp, 0);
  await admin.query("drop trigger fail_test_progress_update on public.user_progress");

  await Promise.all([changeVault(first, "u1-q02", true), changeVault(second, "u1-q03", true)]);
  const [saved, repeated] = await Promise.all([
    close(first, firstUser, win),
    close(second, firstUser, { ...win, failedQuestionIds: [] }),
  ]);
  assert.deepEqual(saved, repeated);
  await Promise.all([
    close(first, firstUser, win),
    changeVault(second, "u1-q04", true),
  ]);
  let row = await progress();
  assert.equal(row.total_xp, 65);
  assert.equal(row.statistics.gamesWon, 1);
  assert.equal(row.statistics.questionsAnswered, 6);
  assert.deepEqual(row.unit_progress["1"], { completionCount: 1, mastery: "bronze" });
  assert.deepEqual(row.unlocked_unit_ids, [1, 2]);
  assert.deepEqual(row.unlocked_medals, ["combo-imparable"]);
  assert.deepEqual(new Set(row.error_chest_question_ids), new Set(["u1-q02", "u1-q03", "u1-q04", ...saved.failedQuestionIds]));
  assert.equal(await snapshot({ ...legacy, revision: 4 }), false);

  assert.equal((await other.query("select user_id from public.user_progress")).rows[0].user_id, secondUser);
  await assert.rejects(close(other, firstUser, win));
  await assert.rejects(close(other, secondUser, win), /ya no está activa/);
  await assert.rejects(first.query("update public.user_progress set total_xp = 1"), /permission denied/);
  await other.query("set role anon");
  await assert.rejects(start(other, secondUser), /permission denied/);

  const [next, same] = await Promise.all([start(first, firstUser), start(second, firstUser)]);
  assert.equal(next.sessionId, same.sessionId);
  assert.notEqual(next.sessionId, legacy.sessionId);
  assert.deepEqual(await close(first, firstUser, win), saved);
  assert.equal((await progress()).active_game_session.sessionId, next.sessionId);

  await Promise.all([
    close(first, firstUser, {
      ...next, phase: "out_of_lives", lives: 0, totalAttempts: 6, correctAnswers: 1,
      earnedXp: 10, bestCombo: 1, failedQuestionIds: ["u1-q05", "u1-q05"],
    }),
    changeVault(second, "u1-q06", true),
  ]);
  await changeVault(first, "u1-q05", false);
  assert.ok(!(await progress()).error_chest_question_ids.includes("u1-q05"));
  await changeVault(second, "u1-q05", true);
  row = await progress();
  assert.ok(row.error_chest_question_ids.includes("u1-q06"));
  assert.equal(row.error_chest_question_ids.filter((id) => id === "u1-q05").length, 1);
  assert.equal(row.total_xp, 75);
  assert.equal(row.statistics.gamesStarted, 2);
  assert.equal(row.statistics.gamesLost, 1);
  assert.equal(row.statistics.incorrectAnswers, 6);
  assert.equal(row.unit_progress["1"].completionCount, 1);
  console.log("PASS atomic progress: migration, rollback, replay, concurrency, loss, and account isolation");
} finally {
  await Promise.allSettled([admin, first, second, other].map((client) => client.end()));
}
