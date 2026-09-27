# 27/09/26 - wave150: the Brand Guides in Our brand, and the brand knowledge check

Steel (27/09/26): "https://drive.google.com/drive/folders/1HqAE-FHO2HRPvzpjhz8aGJpZLAbjIH8y This holds a folder to the branding presentation which should be a part of the Our Brand training in Avenue Academy. I'd also like to make a hard quiz on our brand." Asked who and how hard: "Everyone, required", and "5 tricky questions to test if they read it or not plus 10 basics to ensure they remember important foundations of the brand".

Source: `Welfare_Avenue_Brand_Guides_v1_2026.pdf` (Rebranding 2026 > 01. Assets on the shared drive; readable by anyone with a Welfare Avenue account). The PDF has no text layer, so it was read page by page from images. Content: `build/data/wa150_brand.py` writes `wa150_brand.sql` (the data) and `wa150_brand.json` (the same lesson, for the test).

## The Our brand avenue

- Required for everyone with a staff account (it was optional and for Marketing), and it now sits right after Welfare Avenue foundations. Board viewer accounts do not have the Avenue Academy, so nothing changes for them.
- Three items, in order: **The Brand Guides (2026)** (a document: open it or preview the PDF in place, with a reading guide by section and page, and the link to the assets folder), **Our brand: the essentials and the knowledge check** (a lesson), then the existing **Brand Refresh Video** (60 minutes).
- The lesson has eight chapters: why the brand matters, who we are (mission, vision, positioning, the four pillars, the brand evolution), who we speak to (the four personas and the message for each), our personality (the four archetypes; the sliders are left to the guide), how we speak (the six rows of We say and We don't say, and why), how we look (the logos, the five colours as swatches, the two typefaces drawn in their own fonts), doodles and the E that moves, and putting it to work. The pictures are the brand assets already in Hub storage.

## The knowledge check

15 questions: 10 on the essentials in the lesson and 5 on details that are only in the guide (the Young to Mature slider, what sponsors fear, the logo's breathing space, an incorrect use of the logo, the E that moves' don'ts). 12 right to pass.

It is the Academy's first hard check (`quiz.hard`): an intro sets the rules; the questions and their answers come in a new order every attempt; a wrong pick is marked but the right answer is not shown, only the part of the guide to check (`hint`); failing lists those parts, with Try again (straight into a new order), Open The Brand Guides and Review the lesson; passing shows what was missed with the answers and why. The classic training view can no longer mark a lesson with a hard check done. Every other quiz works as before.

An independent check of all 15 against the guide found every answer key right; it tightened four explanations, two wrong options and three lesson lines (all applied).

## Found in the guide itself (for the next version)

Action's hex is printed as "P2" (its RGB, 220 165 39, is #DCA527); the Innocent's tagline on page 18 is the Sage's (truth and wisdom, knowledge and critical thinking); Sarah is labelled both Canadian and International Student, and the Partners card repeats that label; "Strenght" on page 17 and "It all ads up" on page 42.

## Engine changes (122, 036)

- Lesson blocks: `swatches` (name, hex, meaning, use), `figures` (pictures from the Hub's own public storage only, on a brand colour) and `fonts` (Barlow Condensed and Space Grotesk specimens).
- Quiz: `hard`, `source` (the training key offered as the thing to reread), `title`, `intro`; per question `hint`.
- On a phone a long "Next: chapter" button wraps instead of pushing the sheet sideways (it did on the live build too).
- `wa36SetMine` refuses to mark a hard-check lesson done.
- Hub module 7 says which three avenues are required and how the brand check works.

## Checks

- `test/w150drive.js`: 35 checks (the avenue for a member, the document and its preview, the swatches, pictures and fonts, the intro, a wrong pick hiding the answer, a right pick explaining, shuffling, failing at 11 with the pages to reread, retrying into a new order, passing at 12 with the missed answers, the score and tries recorded, the classic view guard, an ordinary quiz unchanged, the phone layout, the board).
- `w141drive`, `w125drive` and `w122drive` pass on the candidate as on live; live against candidate for staff, the board and a member: no differences beyond the known timing flakes.
