-- Hermes OS — Supabase State Machine Schema
-- Deploy via: Supabase Dashboard → SQL Editor → Run
-- Maintained by: ACE OF CLUBS (Systems & Automation)

-- ─────────────────────────────────────────────
-- agent_runs — central state table for all personas
-- ─────────────────────────────────────────────
create table if not exists agent_runs (
  id              uuid primary key default gen_random_uuid(),
  persona         text not null,          -- e.g. 'king-of-hearts', 'queen-of-spades'
  task            text not null,          -- brief description of the task
  status          text not null           -- 'running' | 'done' | 'error' | 'awaiting_review'
                  check (status in ('running', 'done', 'error', 'awaiting_review')),
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,            -- null until status = 'done' or 'error'
  output_summary  text,                   -- one-line result, e.g. "Phase 2 complete — 2 variants"
  tokens_used     integer,                -- optional, null if unknown
  error_detail    text,                   -- null unless status = 'error'
  created_at      timestamptz not null default now()
);

-- Index for pipeline health monitor queries
create index if not exists idx_agent_runs_status       on agent_runs (status);
create index if not exists idx_agent_runs_persona      on agent_runs (persona);
create index if not exists idx_agent_runs_started_at   on agent_runs (started_at desc);

-- ─────────────────────────────────────────────
-- Hung agent detection view
-- Used by Ace of Clubs pipeline health cron (07:00 weekdays)
-- Returns agents running for > 30 minutes without completion
-- ─────────────────────────────────────────────
create or replace view hung_agents as
  select
    id,
    persona,
    task,
    started_at,
    now() - started_at as running_for
  from agent_runs
  where status = 'running'
    and started_at < now() - interval '30 minutes';

-- ─────────────────────────────────────────────
-- Daily run summary view
-- Used for Hermes Hub dashboard and morning briefings
-- ─────────────────────────────────────────────
create or replace view daily_run_summary as
  select
    persona,
    count(*) filter (where status = 'done')            as done_count,
    count(*) filter (where status = 'error')           as error_count,
    count(*) filter (where status = 'running')         as running_count,
    count(*) filter (where status = 'awaiting_review') as review_count,
    sum(tokens_used)                                   as total_tokens,
    max(completed_at)                                  as last_completed
  from agent_runs
  where started_at >= current_date
  group by persona
  order by persona;

-- ─────────────────────────────────────────────
-- Row-level security (enable after testing)
-- Uncomment when adding Supabase Auth to Hermes Hub
-- ─────────────────────────────────────────────
-- alter table agent_runs enable row level security;
-- create policy "service role only" on agent_runs
--   using (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- Sample insert for testing
-- ─────────────────────────────────────────────
-- insert into agent_runs (persona, task, status, output_summary)
-- values ('king-of-hearts', 'Write Google RSA variants for Apex Fitness', 'done', 'Google Ads — 5 headline variants delivered');
