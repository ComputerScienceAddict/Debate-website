-- DebateRoom initial schema
-- Copy-paste into Supabase SQL Editor or run via supabase db push

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view all profiles"
  on public.profiles for select
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'Anonymous'));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- Debate rooms
create table if not exists public.debate_rooms (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  debate_format text default 'casual_1v1',
  affirmative_user_id uuid references auth.users(id) on delete set null,
  negative_user_id uuid references auth.users(id) on delete set null,
  status text default 'waiting' check (status in ('waiting', 'active', 'completed', 'cancelled')),
  created_at timestamptz default now(),
  started_at timestamptz,
  ended_at timestamptz
);

alter table public.debate_rooms enable row level security;

create policy "Anyone can view rooms"
  on public.debate_rooms for select
  using (true);

create policy "Authenticated users can create rooms"
  on public.debate_rooms for insert
  with check (auth.uid() is not null);

create policy "Participants can update their room"
  on public.debate_rooms for update
  using (auth.uid() = affirmative_user_id or auth.uid() = negative_user_id);


-- Messages / transcript chunks
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.debate_rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  role text not null check (role in ('affirmative', 'negative', 'system', 'referee')),
  content text not null,
  created_at timestamptz default now()
);

alter table public.messages enable row level security;

create policy "Anyone can view messages in a room"
  on public.messages for select
  using (true);

create policy "Authenticated users can insert messages"
  on public.messages for insert
  with check (auth.uid() is not null);

create index if not exists idx_messages_room_id on public.messages(room_id);
create index if not exists idx_messages_created_at on public.messages(created_at);


-- Final scores (AI referee output)
create table if not exists public.final_scores (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.debate_rooms(id) on delete cascade,
  model text not null,
  winner_recommendation text check (winner_recommendation in ('affirmative', 'negative', 'tie')),
  confidence float,
  affirmative_total int,
  negative_total int,
  result jsonb not null,
  created_at timestamptz default now()
);

alter table public.final_scores enable row level security;

create policy "Anyone can view final scores"
  on public.final_scores for select
  using (true);

create policy "Service role can insert scores"
  on public.final_scores for insert
  with check (true);

create index if not exists idx_final_scores_room_id on public.final_scores(room_id);


-- Helper: updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
