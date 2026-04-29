-- Replace the long tag catalog with five high-salience onboarding topics.
-- Clears saved stances so matchmaking does not mix old tag IDs with the new set.

delete from public.user_tag_preferences;

update public.political_tags set is_active = false where true;

insert into public.political_tags (slug, label, description, category, sort_order, is_active)
values
  (
    'polar_abortion',
    'Abortion access',
    'Legal limits, viability, exceptions, and coverage under public programs.',
    'polarizing',
    10,
    true
  ),
  (
    'polar_guns',
    'Gun control',
    'Military style assault weapons, permits, background checks, red flag laws, and self defense rights.',
    'polarizing',
    20,
    true
  ),
  (
    'polar_immigration',
    'Immigration and the border',
    'Deportation priorities, asylum, barriers, interior enforcement, and paths to legal status.',
    'polarizing',
    30,
    true
  ),
  (
    'polar_climate',
    'Climate and energy',
    'Carbon rules, fossil fuels, renewables, subsidies, and how fast the economy should shift.',
    'polarizing',
    40,
    true
  ),
  (
    'polar_israel_gaza',
    'US role in Israel and Gaza',
    'Military aid, ceasefire pressure, refugees, and how deeply America should be involved.',
    'polarizing',
    50,
    true
  )
on conflict (slug) do update set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;
