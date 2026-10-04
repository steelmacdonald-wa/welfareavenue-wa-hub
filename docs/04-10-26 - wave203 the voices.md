# 04/10/26 - wave203: the voices (the Welfare Avenue voice code, or My voice)

Live md5 `8903e6c7dc0698e1359e05c6fe417fc0` (6,271,884 bytes), deployed through the gated pipeline on top of wave202's `7704da352da4f87827371f6c59d462c0` (site_files at 14:38 UTC, 10:38 in Toronto, host-sync `ok`, Netlify deploy `6ac264ee30717c0106867de5`; change_log release line 4779 `wave203`). Built on wave202's email studio, in the same segment (`202_wave202`, new part `build/parts202/g2_voices.js`). No schema change: the house voice is an app_config row, inserted at 14:35 UTC with its change_log line 4777 (`build/data/wa203_voices.sql`, the text in `build/data/wa203_voice_code.md`; app_config.value is text, so the row holds the JSON as text, md5 of the code `22bb095ac1785812db975aa1f64d87b0`). No edge function changed.

## What Steel asked

- With the steel-writing plugin (steel-voice, wa-writing, ghd-writing) attached: "Can the open router models follow this style of writing? And if I was to give it a more standardized way of writing like our Welfare Avenue voice code that also be a choice?"
- Then: "draft a WA voice code from the brand guide and keep mine too as options."

## The voice code

`build/data/wa203_voice_code.md` (about 960 words, about 1,500 tokens), drafted from the Welfare Avenue Brand Guides v1 2026 (read page by page: How we speak and its we say / we don't say / why table, Messaging examples for the community, volunteers, partners and sponsors, the personality sliders, the four archetypes, the mission and positioning, the doodles' "keep it human", the headline examples). Sections: who is speaking, the voice in one line (warmth with purpose), personality, our words (with the guide's reasons), by audience, how we write (ten rules), headlines, never, and a tone example marked as tone only. It is the organization's voice ("we", signed by a person), so none of Steel's personal moves are in it. Two choices made in the draft, for Steel to keep or change: the guide's "we don't say donate" becomes "ask people to give, support or fund something specific", and only the website's published figures are allowed (the guide's sponsor line about five cities by 2028 is an example of tone, not a fact the Hub may use).

## What people get

- **Voices** on the studio's front page, and a Voice choice on Tell the Hub, Start from a template and the editor's settings: **Welfare Avenue** (the house voice, the default for everyone) or **My voice** (only for people with a writing guide in Your inbox; today, Steel). The last choice is remembered in the browser (`wa203voice`).
- The Voices panel shows the house voice to everyone; admins edit it there (Save makes a new version and a change_log line `writing_voice`; very short codes and dashes are refused). The My voice tab shows the person's own guide and links to Your inbox to edit it.
- Each email keeps its voice (`design.voice`), so the Hub's answers round and Ask the Hub to change it keep writing in it. Someone else's email is changed in the house voice.

## How it works

- `aiSystem(lang, voice)`: the context, then the chosen voice between two lines (`VOICE: Welfare Avenue's house voice...` or `VOICE: write as <name>, who signs this email...`, which also tells the model to ignore anything in a personal guide about replies, threads or plain text), then a line that holds whatever the voice (our words, no dashes, no hashtags, one exclamation mark at most), then the facts rule, the links, the shape, the questions and the language, as before. Without a stored house voice it keeps its short built-in voice.
- Reading: app_config `mail_voice_wa` (staff read app_config; `wa_app_config_guard` lets only admins change `mail_*` keys). My voice: `mybox_owners` (own row only, enabled, same email) and then mybox's `voice` action, never stored with an email, in the repo or in a migration.

## What an email costs to build (measured 04/10/26)

Real calls on the `email_studio` route with the voice code in the prompt (Claude Sonnet 5 at 2 dollars per million tokens in and 10 out on OpenRouter):

| Call | Tokens in | Tokens out | Cost |
|---|---|---|---|
| Tell the Hub (put it together) | 5,568 | 684 | $0.0180 |
| The Hub puts your answers in | 5,876 | 455 | $0.0163 |
| Ask the Hub to change it | 5,775 | 462 | $0.0162 |
| Start from a template, filled by the Hub | 6,094 | 712 | $0.0193 |

So: Tell the Hub with one round of answers and one change is about 5 cents; a template filled by the Hub 2 to 4 cents; a template filled by hand, Use it and Build it yourself nothing (each Ask the Hub to change it about 2 cents). An uploaded photo adds about a tenth of a cent. My voice costs about the same as the house voice. The fallbacks, used only when Sonnet 5 fails: GPT-5 (1.25 dollars in, 10 out) is a little cheaper, Sonnet 4.5 (3 in, 15 out) about half as much again. Sending is separate (Resend; the Hub's caps of 100 a day sit within Resend's free tier of 3,000 a month).

## Releases

- `build/parts202`: `g2_voices.js` (new: state, loading, the Voices panel, saving), `a_head.js` (the voice icon, the start state), `c_blocks.js` (`clean` keeps `design.voice`), `e_ai.js` (`voiceBlock`, `aiSystem(lang, voice)`, `aiCall` loads the voices first), `g_home.js` (the Voices button), `h_start.js` (the Voice choice and the voice in every start), `i_editor.js` (the editor's Voice, changes keep it), `k_css.js`, `z_wire.js` (clicks, fields, Escape, the tour's Voices step), `assemble.py`. MANIFEST note updated.
- Data: `wa203_voices.sql` (the app_config row, version 1, and its change_log line).

## Tests

- `test/w202drive.js` 87 of 87 (wave202's 69 plus 18): the Voices button with My voice for Steel, the panel on the house voice with Edit, Steel's guide through mybox's voice action, Escape; the Voice choice on Tell the Hub; the house voice in the prompt and the words that hold whatever the voice; the email keeps `wa`, never the text; My voice writes as Steel from his guide, kept by the email and by a change, switched back in the editor; Edit and Save (app_config upsert of version 2, the change_log line, the panel showing it), a too-short code refused; the next email using the edited voice; a member with Welfare Avenue only (mybox not asked) reading the code without Edit; the tour's eight steps.
- w201drive 39, w152drive 68, w153drive 46. Page tours as on wave202 apart from the studio tour (eight steps, five highlighted, the new Voices step among them). The HR centre tour reads 3 of 6 highlighted when run on its own, on wave202 and wave203 alike (its count depends on the run's timing, not the build).
