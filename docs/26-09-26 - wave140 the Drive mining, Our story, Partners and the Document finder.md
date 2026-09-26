# 26/09/26 - wave140 the Drive mining: Our story, Partners and the Document finder

Steel asked: "pour everything we have in the google drive, including shared drives to enhance our Hub. That said, don't just add anything... mine for gold (useful content), melt and refine it (take what's good out of it), and frame it (put it in current or new pages on the hub)." He added Canva and asked for OpenRouter and Jev to speed up the decisions.

## Mine

`drive-mine` (edge function, v2.5) listed every file the Hub's service account can see as steel.macdonald@welfareavenue.com: every shared drive, My Drive and files shared with him, plus Canva designs (loaded through the Canva connector, contact details and codes redacted) and our social posts (one pseudo-document per quarter).

- Text: Google Docs and Slides exported, Sheets through the Sheets API, Office files unzipped, PDFs read by a Claude model as a document.
- Screen: Jev decides keep or skip and whether a file is private (personal, HR, donor details, board-only, Steel's transition). Private files keep no text.
- Mine: the llm router (`drive_mine`, Jev picks the model; `drive_mine_pdf` for PDFs) records events, partners, lessons, resources and facts, each with the words it came from.
- Check: Jev scores each item against its excerpt.
- Result: 691 documents mined, 29 kept private, 155 skipped as not useful, for about $9 of AI (cap $15).

## Refine

The candidates (2,292 events, 1,761 partner mentions, 2,243 lessons, 3,315 facts) were merged, dated and checked by year, and the conflicts written down rather than guessed:

| What | Table | Rows |
|---|---|---|
| Moments since March 2020 (18 milestones, 14 for leaders and directors only) | `wa_history` | 148 |
| A few lines per year | `wa_history_years` | 7 |
| Organizations (73 active, 45 past, 17 prospects, 8 declined) | `wa_partners` | 143 |
| Lessons learned (20 for leaders and directors only) | `wa_lessons` | 144 |
| Useful files in the Drive and Canva (337 guides or templates to reuse; 237 from leadership drives, leaders only) | `wa_documents` | 667 |
| Key facts and the story, for the assistant | `hub_knowledge` (`wa-key-facts`, `wa-our-story`) | 2 |

Every row keeps its sources (the document, where it sits, the quote); a source from a board, management, HR or finance document shows to leaders and directors only. The loaders keep leaders' edits (they only replace rows still marked `updated_by = 'wave140'`). `wa140_links.sql` ties the names written in moments to their partner record and stretches a partner's years to every moment that names it.

## Frame

Three new pages under Resources (segment 140, `build/parts140/`):

- **Our story** (`#ourstory`): the stats, the milestones strip, filters (kind, city, search, order), year sections with their summary, and every moment with its date, place, organizations, numbers and sources. A second tab, **Lessons learned** (`#ourstory/lessons`), by area. Deep links: `#ourstory/e/<id>`, `#ourstory/<year>`.
- **Partners** (`#partners`, `#partners/<id>`): where each organization stands, filters, and a sheet with the moments and documents that name it.
- **Document finder** (`#documents`, `#documents/q/<words>`): search by meaning over title, summary, organizations, topics and the date covered, with team, year, kind and "Guides and templates to reuse".

Leaders (admin or leader role) correct, hide and add moments, year lines, partners and lessons (numbers included); everyone else reads. Who sees what follows the database (RLS) and the page keeps to the same rule:

| | Staff | Directors | Leaders |
|---|---|---|---|
| Our story, Lessons learned | published, everyone rows | all published rows | everything, hidden rows on request |
| Partners | everyone rows | all | all |
| Document finder | everyone rows | no page | all |
| Leadership sources | "A board or leadership document" | named | named |

Also framed:

- **Ask the Hub** (ask v13): an OUR STORY block from `wa_story_context` (accent and ending tolerant matching; the asker's access decides what it holds), and organization knowledge picked by relevance, key facts first.
- **Avenue Academy**: a new lesson in Welfare Avenue foundations, "Our story since 2020" (the milestones, a knowledge check); the partners lesson points to the Partners page; Hub module 8 says the assistant knows our story; page tours for the three pages. Links to a Hub page inside a lesson now open in the Hub.
- **Access profiles**: Our story and Partners for every profile, the Document finder for every profile but Board; what executives, directors and team leads can do there.

## Drive labels

Steel agreed to labels on the important files only. The labeller is built (`drive-mine` action `labels`: one label, Welfare Avenue Hub, with Kind, Team, Year and Why it matters, on 242 files: 226 guides and templates to reuse, 30 records behind milestones), but Drive labels need Business Standard or higher and the Drive shows 100 TB of pooled storage, which is the free Google Workspace for Nonprofits edition. It also needs the scope `drive.admin.labels` delegated to the service account. Nothing was written to Drive.

## What the challenge changed

- A document said to be gold by one pass was checked by another: Jev's keep decisions were re-run when the first bar skipped real history (248 files requeued), and the private rule was tightened after it hid an ordinary quarterly recap.
- Conflicts are recorded, not averaged: meal and volunteer counts, the charity status date, the fiscal year and the founding month each keep their sources in the notes, for Steel to settle.
- The pages hold no more than the database would show each person; a real-data render as leader, member and director found no errors and no overflow on a phone.

## To settle (Steel)

- Founding month: March 2020 (most documents) or April 2020 (the awareness video and first donations).
- Meal counts: 2021 has 8,000+ meals and 266 volunteers in one source, 5,000+ on the history slides; public totals of 25,000+ meals against about 11,000 in the impact tracker.
- Charity status: effective 18 October 2023 per the CRA letter, "November 2023" in a 2024 board document; the letter also names the designation as a private foundation.
- Fiscal year: the CRA letter's fiscal period end, the 2022 by-laws (December 31) and the team's October 1 to September 30 year differ.
- Partners to confirm: Moisson Montréal (recorded as a prospect: decks call it a partner, but no document confirms the accreditation); Poulet Rouge (recorded as declined: it turned down a request on 9 May 2026, and the September 2025 recap names only Sportira and Athlon as flag football sponsors, although lesson 52 still lists Poulet Rouge as the flag football sponsor); Dollarama (recorded as an active donor: the November 2025 strategy meeting says it donated to the holiday baskets, the outreach tracker says no donation).
- Leadership-only calls to confirm: the city food inspection of the Sunday serving (2022) and the September 2025 recruitment wave.

## Files

- `fn/drive-mine/index.ts` (v2.5), `fn/ask/index.ts` (v13)
- `build/data/wa140_mine.sql`, `wa140_frame.sql`, `wa140_documents.sql`, `wa140_story_load.py`, `wa140_links.sql`, `wa140_ask.sql`, `wa140_pump.sql`, `wa140_academy.py` (writes `wa140_academy.sql`), `wave140_front_edits.py`
- `build/parts140/` (a_head to g_wire, `assemble.py`) into `build/src/140_wave140.seg`
- `test/w140drive.js`: 50 checks as leader, member and director (fixture rows only)

## Verified

- `test/w140drive.js` 50/50; harness x3 (staff, board, member): only the new pages and known timing flakes differ.
- A render with the real rows as leader, member and director, desktop and phone: no page errors, no horizontal scroll.
- Live: index.html a79e28b2fd421997e3d03b95cbb8a40c (3,971,516 bytes), served byte for byte.
- ask v13 answers from the story (the charity date, Sportira over the years, the year 2024).
