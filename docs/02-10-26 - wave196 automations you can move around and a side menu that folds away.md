# 02/10/26 - wave196: automations you can move around, and a side menu that folds away

Steel (02/10/26): "For the next build I really need you to reshape how the automation page is to make it easier to move round automations in the CRM and make the user interface really easy to use. Also to give more space to the apps, I want the ability to colapse the menu of pages on the side. When it's closed, you should be able to put your mouse over to all the way to the left side of the page to have it open to choose another page/app, when you hover away it should close again. You should also have the functionality to keep it open."

His answers:

- **Moving automations around:** all four of these:
  - a visual flow;
  - drag steps to reorder them;
  - organise the list (folders and your own order);
  - copy steps between automations.
- **The side menu:** on every app and the Hub, remembered for each person, on computers only. Phones keep their bottom bar.

## The Automations page (CRM, Automations)

**The list:**

- **Folders.** New folder makes one (for example Volunteers, Donors, Newsletter). Each folder can be closed, renamed or removed; removing it keeps its automations, now not in a folder.
- **Your own order.** Drag an automation by its handle (the six dots): drop it before or after another one, or into a folder.
- **The More menu (the three dots) on each automation**, for the keyboard and phones:
  - Move up and Move down;
  - Move to a folder (or a new one, named there and then);
  - Duplicate, which makes a draft copy right under it.
- **Saving.** Each move is saved at once, in one call (`crm_automations_arrange`).

**The editor is now a flow:**

- **The cards.** The trigger card ("When it starts") comes first, then a card for each step, with its number, its kind and what it does. Wait until opened shows its two paths on its card (Opened, Not opened). A card warns when something is missing (no subject yet, no email chosen, no email before a wait until opened, no task written, nobody to notify, no tag).
- **The panel.** Click a card, or press Enter on it, to edit it in the panel on the right (a sheet from the bottom on a phone). With nothing chosen, the panel shows the whole automation in plain words.
- **Adding a step.** The + between two cards adds a step right there. Its list has every kind of step, and Paste when a step has been copied.
- **Moving a step.** Drag a card by its handle, or use the arrows in the panel. If a move leaves a path pointing back, or a wait until opened before the email it watches, the page puts it right and says so.
- **The panel's buttons:**
  - Preview (emails);
  - Duplicate (a copy right after it);
  - Copy (then Paste from any +, in this automation or another one);
  - Copy to (adds it at once to the end of another automation, and says when that one is on);
  - Move, Remove.
- **The top bar.** It stays in view and holds:
  - Back to the automations and the name;
  - the status, and Unsaved changes or All changes saved;
  - Save, Turn on, Pause, Try it on me, People;
  - More (Duplicate the automation, Delete the draft).
- **Leaving with unsaved changes** asks first: Save and go back, Leave without saving, or Stay.

Nothing changed in how automations run. The engine, the database check before turning on, Try it on me, Preview and People work as before.

## The side menu

On a computer:

- **Hide the menu.** The button at the top right of the menu, or Ctrl + \ (Cmd + \ on a Mac), folds it away and the page takes the whole width.
- **Opening it again.** Move the mouse to the far left edge of the window, or onto the small Menu tab at the top left, and it slides out over the page. Pick a page or an app.
- **Closing it.** Moving away closes it again. It stays out while the mouse is on it, while the apps launcher is open, or while you move through it with the keyboard. Escape closes it.
- **The pin (Keep the menu open)** puts it back for good.
- **Remembered.** The choice is kept on that computer (localStorage `wa196nav`). It is the same menu in the Hub and in every app, since each app's own menu lives in it.

Phones and narrow windows keep the drawer and the bottom bar, as before.

## Built

- **Database:** migration 20261002120000 `wa196_automation_folders` adds `crm_automations.folder` and `sort_order` (the five existing automations were numbered in their old order) and `crm_automations_arrange(p_items jsonb)` (staff, with the caller's own row security).
- **The Hub:**
  - `build/parts152/j_autos.js`: the list, the flow, the panel, copy and paste, drag and drop.
  - `build/src/196_wave196.seg`: the side menu.
- **Tests:**
  - `test/w196drive.js` (52): the menu, the list, the editor and the phone.
  - `test/w157drive.js` (26), updated for the flow.

## Note

wave195 (sign-offs, another session) was live but not yet on GitHub when this shipped. Its segment was taken from the live page, unchanged, so this release keeps it, and its session's push will replace it with its own source. That segment uses a few colours that `check_remaps.py` flags (white and an old team colour). They are live as they were and are left for that session to bake.
