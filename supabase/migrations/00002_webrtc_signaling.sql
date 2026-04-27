-- WebRTC signaling + room presence for video-to-video debates

create table if not exists public.room_presence (
  room_id uuid not null references public.debate_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text check (role in ('affirmative', 'negative', 'spectator')),
  joined_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  is_online boolean default true,
  primary key (room_id, user_id)
);

alter table public.room_presence enable row level security;

create policy "Participants can view room presence"
  on public.room_presence for select
  using (auth.uid() is not null);

create policy "Users can upsert own presence"
  on public.room_presence for insert
  with check (auth.uid() = user_id);

create policy "Users can update own presence"
  on public.room_presence for update
  using (auth.uid() = user_id);

create index if not exists idx_room_presence_room on public.room_presence(room_id);
create index if not exists idx_room_presence_online on public.room_presence(is_online, last_seen_at desc);


create table if not exists public.webrtc_signals (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.debate_rooms(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid references auth.users(id) on delete cascade,
  signal_type text not null check (signal_type in ('offer', 'answer', 'ice_candidate', 'bye')),
  payload jsonb not null,
  created_at timestamptz default now()
);

alter table public.webrtc_signals enable row level security;

create policy "Participants can read signaling events"
  on public.webrtc_signals for select
  using (auth.uid() is not null and (target_user_id is null or target_user_id = auth.uid() or sender_user_id = auth.uid()));

create policy "Authenticated users can send signaling events"
  on public.webrtc_signals for insert
  with check (auth.uid() = sender_user_id);

create index if not exists idx_webrtc_signals_room_time on public.webrtc_signals(room_id, created_at desc);
create index if not exists idx_webrtc_signals_target on public.webrtc_signals(target_user_id, created_at desc);

