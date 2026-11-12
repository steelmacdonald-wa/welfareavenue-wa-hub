# 12/11/26 - wave322: One box

Steel, 12/11/26: "ways to simplify navigation ... have them ask questions, submit requests". The box at the top of the
Hub found tasks, people, goals, meetings, documents and contacts. It did not find pages (wave262's tour already says
"type a page"), it could not be reached from the keyboard, Enter did nothing, and a search that found nothing was a
dead end.

One block in the page (`build/parts322/322_v322.js`, put before WA v110 by `build/parts322/patch322.py`). It wraps
`renderSearch` the way waves 107, 118c and 153 do. No database change, nothing read or written, nothing sent.

## What a person sees
- **Pages first.** Type "cal" and Calendar is the first row. Only the pages on the person's own access list
  (`wa40Allowed`, the list the menu uses). A page the menu retired is left out. Inside the CRM its contacts stay
  first, as wave153 set, and the pages follow.
- **Ask the Hub, last.** With three letters or more the last row asks the question as typed, so "No matches" always
  has a next step. Rows that arrive late (documents, photos, contacts) land above it.
- **"task ..." and "request ...".** "task call the caterer about Sunday" adds a row, Add a task, that hands the
  sentence to Ask the Hub. It answers with its usual confirm card: nothing is saved before the person confirms.
- **Ctrl K** (Cmd K on a Mac) goes to the box from anywhere. Not while a window is open, and not inside an editor
  (the task description uses Ctrl K for a link). A small "Ctrl K" hint sits in the empty box on a computer.
- **The keyboard in the list.** Down and Up move, Enter opens the lit row (the first when none is lit), Escape closes.
- **I want to.** A click in the empty box (or Ctrl K, or Down) lists what the box can do: File a request, Add a task,
  Ask a question, then Home, Team Requests, the Calendar and the Document finder when the person has them. Not on a
  phone (the phone bar has Ask) and not during a page tour.
- People without Ask the Hub (the board view) get the pages and the keyboard, not the Ask rows.

## Accessibility
The box is a combobox with a name, the list a listbox, every row an option, the lit row announced. axe finds no error
in the box closed, with the launcher open and with no matches. (With results open it still flags wave107's blue
"Drive" tag at 4.37 to 1, which this wave does not touch.)

## No motion, on purpose
A list people use all day, opened from the keyboard, appears at once.

## Tests
`test/w322drive.js` (39 checks): an admin on a computer (Ctrl K, the launcher, the keyboard, a page first, no match,
"task ...", late rows, editors and windows left alone, retired pages), a team member (only their own pages), a director,
a phone. It runs on the page that also carries wave320.

## Release and undo
With wave320, in one swap: `build/parts320/release320.sh` (WITH322=0 leaves this wave out). The undo is the same file
as wave320's.
