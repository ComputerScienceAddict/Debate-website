-- Curated political tags, user stances, matchmaking queue, match history, room metadata

-- Stance on a tag (curated catalog only)
do $$ begin
  create type public.tag_stance as enum ('support', 'oppose', 'neutral');
exception
  when duplicate_object then null;
end $$;

-- Curated tags (admin-seeded)
create table if not exists public.political_tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  description text,
  category text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create index if not exists idx_political_tags_category on public.political_tags(category) where is_active = true;

-- Per-user stance per tag
create table if not exists public.user_tag_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  tag_id uuid not null references public.political_tags(id) on delete cascade,
  stance public.tag_stance not null,
  updated_at timestamptz default now(),
  primary key (user_id, tag_id)
);

create index if not exists idx_user_tag_preferences_user on public.user_tag_preferences(user_id);
create index if not exists idx_user_tag_preferences_tag on public.user_tag_preferences(tag_id);

-- Match history (written by server/service role)
create table if not exists public.match_records (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references auth.users(id) on delete cascade,
  user_b_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid references public.debate_rooms(id) on delete set null,
  compatibility_score real,
  disagreement_score real not null default 0,
  created_at timestamptz default now(),
  constraint match_records_users_ordered check (user_a_id < user_b_id)
);

create index if not exists idx_match_records_user_a on public.match_records(user_a_id);
create index if not exists idx_match_records_user_b on public.match_records(user_b_id);
create index if not exists idx_match_records_room on public.match_records(room_id);

-- Matchmaking queue
do $$ begin
  create type public.match_queue_status as enum ('waiting', 'processing');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.matchmaking_queue (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status public.match_queue_status not null default 'waiting',
  queued_at timestamptz not null default now(),
  last_attempt_at timestamptz
);

create index if not exists idx_matchmaking_queue_waiting on public.matchmaking_queue(queued_at)
  where status = 'waiting';

-- Extend debate rooms
alter table public.debate_rooms
  add column if not exists generated_topic_meta jsonb,
  add column if not exists match_record_id uuid references public.match_records(id) on delete set null;

create index if not exists idx_debate_rooms_match_record on public.debate_rooms(match_record_id);

-- RLS: political_tags — public read of active tags
alter table public.political_tags enable row level security;

drop policy if exists "Anyone can view active political tags" on public.political_tags;
create policy "Anyone can view active political tags"
  on public.political_tags for select
  using (is_active = true);

-- RLS: user_tag_preferences
alter table public.user_tag_preferences enable row level security;

drop policy if exists "Users can view own tag preferences" on public.user_tag_preferences;
create policy "Users can view own tag preferences"
  on public.user_tag_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own tag preferences" on public.user_tag_preferences;
create policy "Users can insert own tag preferences"
  on public.user_tag_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own tag preferences" on public.user_tag_preferences;
create policy "Users can update own tag preferences"
  on public.user_tag_preferences for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own tag preferences" on public.user_tag_preferences;
create policy "Users can delete own tag preferences"
  on public.user_tag_preferences for delete
  using (auth.uid() = user_id);

-- RLS: matchmaking_queue
alter table public.matchmaking_queue enable row level security;

drop policy if exists "Users can view own queue row" on public.matchmaking_queue;
create policy "Users can view own queue row"
  on public.matchmaking_queue for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own queue row" on public.matchmaking_queue;
create policy "Users can insert own queue row"
  on public.matchmaking_queue for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own queue row" on public.matchmaking_queue;
create policy "Users can update own queue row"
  on public.matchmaking_queue for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own queue row" on public.matchmaking_queue;
create policy "Users can delete own queue row"
  on public.matchmaking_queue for delete
  using (auth.uid() = user_id);

-- RLS: match_records — participants can read; inserts via service role only
alter table public.match_records enable row level security;

drop policy if exists "Participants can view own match records" on public.match_records;
create policy "Participants can view own match records"
  on public.match_records for select
  using (auth.uid() = user_a_id or auth.uid() = user_b_id);

-- Seed curated tags (idempotent by slug)
insert into public.political_tags (slug, label, description, category, sort_order) values
  ('ice_enforcement', 'ICE enforcement', 'Federal immigration enforcement agency operations and presence.', 'immigration', 10),
  ('border_wall', 'Southern border wall / barriers', 'Physical barriers and border security funding.', 'immigration', 20),
  ('path_to_citizenship', 'Path to citizenship for undocumented residents', 'Legal pathways and amnesty proposals.', 'immigration', 30),
  ('police_funding', 'Police department funding levels', 'Defund vs increase police budgets.', 'policing', 10),
  ('qualified_immunity', 'Qualified immunity for officers', 'Civil liability protections for law enforcement.', 'policing', 20),
  ('cash_bail', 'Cash bail system', 'Pretrial detention and bail reform.', 'policing', 30),
  ('medicare_for_all', 'Medicare for All / single-payer healthcare', 'Government-run universal health insurance.', 'healthcare', 10),
  ('abortion_access', 'Abortion access and regulation', 'Legal availability and restrictions.', 'healthcare', 20),
  ('drug_pricing', 'Prescription drug pricing regulation', 'Government negotiation and price controls.', 'healthcare', 30),
  ('wealth_tax', 'Wealth or asset taxes on high net worth', 'Taxation of accumulated wealth vs income only.', 'economy', 10),
  ('minimum_wage', 'Federal minimum wage increases', 'Wage floors and small business impacts.', 'economy', 20),
  ('free_trade', 'Free trade agreements', 'Tariffs, NAFTA/USMCA-style deals, globalization.', 'economy', 30),
  ('carbon_tax', 'Carbon pricing / carbon tax', 'Tax or fee on emissions to address climate.', 'climate', 10),
  ('fossil_fuels', 'Fossil fuel extraction and subsidies', 'Oil, gas, coal leasing and federal support.', 'climate', 20),
  ('green_jobs', 'Green jobs and transition programs', 'Public investment in renewable transition.', 'climate', 30),
  ('military_aid_ukraine', 'Military aid to Ukraine', 'Weapons and funding for Ukraine conflict.', 'foreign_policy', 10),
  ('israel_palestine_us_role', 'US role in Israel–Palestine', 'Aid, diplomacy, and ceasefire positions.', 'foreign_policy', 20),
  ('china_trade', 'Economic decoupling from China', 'Tariffs, export controls, and supply chains.', 'foreign_policy', 30),
  ('hate_speech_laws', 'Hate speech regulation online', 'Platform rules vs government speech limits.', 'governance', 10),
  ('voting_id', 'Voter ID and election access laws', 'ID requirements vs ballot access expansion.', 'governance', 20),
  ('court_reform', 'Supreme Court reform / expansion', 'Term limits, court packing, or structural changes.', 'governance', 30)
on conflict (slug) do nothing;
