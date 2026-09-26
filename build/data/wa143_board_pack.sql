-- wave143 (26/09/26): the board pack. The board-pack edge function builds, for a board meeting, the agenda and the meeting
-- notes (Google Docs) and a deck (Google Slides) in the Board of Directors shared drive, from the Hub's own tables.
alter table public.board_meetings add column if not exists deck_url text, add column if not exists pack jsonb;
comment on column public.board_meetings.deck_url is 'The board pack deck (Google Slides) the Hub built for this meeting (board-pack, wave143).';
comment on column public.board_meetings.pack is 'The board pack the Hub built: folder_id, folder_url, agenda_id, notes_id, deck_id, built_at, built_by, as_of, and refreshed_at, refreshed_by after a refresh of the deck numbers. Written by the board-pack edge function.';
