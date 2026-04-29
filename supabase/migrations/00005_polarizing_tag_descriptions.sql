-- Align seeded tag copy with app wording (runs after 00004 on existing databases).

update public.political_tags
set description = 'Legal limits, viability, exceptions, and coverage under public programs.'
where slug = 'polar_abortion';

update public.political_tags
set description = 'Military style assault weapons, permits, background checks, red flag laws, and self defense rights.'
where slug = 'polar_guns';
