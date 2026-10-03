# 03/10/26 - wave200: the team board and Add people

Steel (03/10/26), with two screenshots of THE TEAM on a serving: "This is interface is really difficult to interact with, could you make it easier to work with? Also, all team members should be searchable as a volunteer. Also anyone for any position should be searchable for all positions."

What was wrong in the screenshots:

- The columns were about 150px wide, so names, statuses and buttons were squeezed. "Waiting For Response" showed as "Waiting For Resp".
- The search for adding someone sat inside one narrow column.
- The column counts did not match the pills above them. For example, Team leaders showed 0/2 while its pill said 1/1, because the columns counted with the old targets and the pills with the serving's own targets.
- Adding someone only searched volunteers, and team members could not be found at all.

## The board (Volunteer Manager, a serving, The team)

- **Wider columns.** Each role is a column at least 236px wide, and they wrap onto a second row instead of running off the side. A phone shows one column at a time, top to bottom.
- **Counts that agree.** Each column's count ("2/8") comes from the same place as the pills above it (wave191's `rosterCounts`: the serving's targets and what a partner covers). Under the title it says how many are confirmed and how many more are needed.
- **Each card has two menus:**
  - **Status:** Confirmed, Waiting, To ask, Can't make it, Cancelled. These are the same stored values as before, shown in plain words.
  - **Move:** "To cook", "To driver" and so on moves them to another role at once. Dragging a card to another column still works.
- **Other card details.** The ✕ (take them off the serving) is bigger. "not matched to a volunteer record" is now a short "No volunteer record" tag, with the longer explanation on hover.
- **Ways to open Add people for a role:**
  - **+ Add** on a column;
  - the empty box of a role with nobody yet;
  - any role pill above the board (Cooks 1/4 and so on) for staff.

## Add people

A window in the middle of the screen. On a phone it fills the screen.

- **Add as.** A chip for every role, each with its count. Click one to switch roles without closing the window.
- **Search everyone.** One box searches by name, phone (any 3 or more digits), email, tag, role or team, across:
  - every volunteer, whatever role they usually do, so a driver can be added as a server;
  - every team member. A team member who is already a volunteer (same email, or the same name with no email) shows once, as that volunteer, marked "Team · <their team>".
- **Tabs:**
  - Everyone;
  - the role, meaning people listed for it;
  - Team members.
- **Order.** People listed for the chosen role come first, then everyone else by name. People already on this serving go to the bottom and say "On this serving: Cook" instead of showing an Add button.
- **Add.** It puts them on the serving as Waiting, the same as before.
  - **A team member with no volunteer record** gets one first (`volunteer_people` insert, name and email). Wave176's trigger links it to their CRM contact by email, or makes one. Then they go on the serving.
- **After each add.** The window stays open for the next person. The search clears and keeps the cursor. An "Added:" line lists who was just added, each with **Undo**.
- **Keyboard:**
  - **Enter** adds the first match who is not on the serving yet (the footer says who);
  - **Escape**, **Done**, the ✕ or a click outside closes it.

## Built

- **`build/src/119_wave119.seg`:**
  - `boardHtml`, `cardHtml` and the `SHORT` status labels;
  - Add people: `pool`, `matches`, `addList`, `addHtml`, `paintAdd`, `openAdd`, `closeAdd`, `addPerson` and `undoAdd`;
  - the handlers for `data-w119bench`, `data-w200add`, `data-w200role`, `data-w200tab`, `data-w200more`, `data-w200undo` and `data-w119benchclose`, plus Enter and Escape;
  - the CSS (`#w200add`; `html.w200lock` stops the page scrolling behind it).
  - The old in-column bench (`benchHtml`) is gone.
- **`build/parts191`:**
  - `z_wire.js` exports `window.w191.counts` (`rosterCounts`);
  - in `c_event.js`, `recruitLine`'s pills are buttons with `data-w119bench` for staff.
- **Tests:**
  - `test/w200drive.js` (49 checks): counts, menus, no cut-off words, Add people from + Add, the empty box and the pills, search across roles and the team, tabs, chips, adding a volunteer and a team member, Undo, Enter, Escape, Done, a click outside, and the phone.
  - Updated for the window: `test/w119drive.js` (Add people and the Move menu) and `test/w191board.js` (the column keeps its scroll while Add people is open).

Nothing changed in the database.
