-- wa201_voice_drafts (03/10/26): speak instead of typing in every AI prompt box; Your inbox's drafts checked in Gmail and
-- written with the owner's writing guide (Steel's: wa-writing with steel-voice underneath).
-- Steel (03/10/26): "I'd like to use voice to text in prompts here" (every AI prompt box), then "also can we make sure
-- /steel-writing:wa-writing skill is used as a framework to writing emails. Could you also make sure that drafts are actually
-- saved. It didn't work last time".
-- No new table or column. The comments say what wave201 changed; the Academy's Hub modules 1 and 8 say it to people.
-- The owner's writing guide itself is never written here (it lives in their mybox_owners row only, edited in Your inbox,
-- Settings, Your writing guide).

comment on column public.mybox_owners.voice is 'wave170, wave201: the owner''s writing guide, given to the model before every reply it drafts for them; a first line "FRAMEWORK: <name>" names the framework the Hub shows (Steel''s: wa-writing, with steel-voice underneath). Only the owner reads or edits it, in Your inbox, Settings, Your writing guide (the mybox function''s voice and settings actions); never kept in the repo or a migration.';
comment on column public.mybox_mail.draft_id is 'wave170, wave201: the Gmail draft the Hub saved for this email. mybox reads it back from Gmail (a draft, in this email''s thread) before the Hub says it is saved; saving again updates this draft instead of adding another.';
comment on column public.mybox_mail.drafted_at is 'wave170, wave201: when the reply was last saved as a Gmail draft and checked there.';

-- Hub module 1: Your inbox, the writing guide and the checked draft
update public.trainings
   set description = replace(description,
         'and sends an email on to a team''s inbox with your one-line ask.',
         'and sends an email on to a team''s inbox with your one-line ask.' || chr(10) || chr(10)
         || 'Your writing guide, in Your inbox, Settings, is what every reply follows: your rules, how you open and close, who you write to and how. Save as a Gmail draft checks the draft is in your Gmail before it says Saved, and Open the draft opens it in your own account. Tap the mic in any box to say your answer instead of typing it.'),
       updated_at = now()
 where id = 39 and title = 'Hub module 1: My page and finding your work'
   and position('and sends an email on to a team''s inbox with your one-line ask.' in description) > 0
   and position('Your writing guide' in description) = 0;

-- Hub module 8: speak instead of typing
update public.trainings
   set description = replace(description,
         'Restricted meetings stay sealed.' || chr(10) || chr(10) || '**Agendas**',
         'Restricted meetings stay sealed.' || chr(10) || chr(10)
         || '**Speak instead of typing**' || chr(10) || chr(10)
         || 'Tap the mic in Ask, or in any box where you tell the Hub''s AI what to do (Your inbox, the content drafter, an agenda''s purpose, the grant writer''s notes, Suggest a change, Finance''s import guidance), and talk: your words appear as you speak. Tap again, or press Esc, to stop. It listens in your Hub language, English or French.' || chr(10) || chr(10)
         || 'Good to know: it works in Chrome, Edge and Safari (not Firefox), and the browser asks once to use your microphone. The browser turns your speech into text; the Hub keeps only the words in the box.' || chr(10) || chr(10)
         || '**Agendas**'),
       updated_at = now()
 where id = 46 and title = 'Hub module 8: the chat assistant, agendas and help'
   and position('Restricted meetings stay sealed.' || chr(10) || chr(10) || '**Agendas**' in description) > 0
   and position('Speak instead of typing' in description) = 0;
