# 26/09/26 - wave135: Avenue Academy and Learning Avenues

Live md5 `df09bb9bbced2bf3bd61eec9faf8fc11` (3,834,109 bytes), deployed through the gated pipeline (`wa_stage_rf`, guarded on the live md5 `c0762ca2` and dropped after). Schema: `wa135_academy_names` (the academy's own rows, the access profile notes, one Important info note and the schema comments).

## What Steel asked

"Change Training Academy to Avenue Academy and Learning Paths to Learning Avenues"

## What changed

The Training academy is the **Avenue Academy** and its learning paths are **Learning Avenues**, everywhere people read them:

- The menu (People > Avenue Academy), the page's title, crumb and purpose line, its help popup and the help titles, and the name Request more access and the access profile editor use.
- Inside the Avenue Academy: the welcome line, the Learning Avenues and More Learning Avenues sections, a Learning Avenue's own view ("Learning Avenue", "Learning Avenue complete"), the field that files a training under one, the certificate ("Welfare Avenue · Avenue Academy"), the shout-out a certificate shares, and the loading and error lines.
- A person's page: the Avenue Academy card (level, certificates, badges).
- The HR and Marketing team pages: their tool links read Avenue Academy and Learning Avenues; the HR centre says personal training lives in the Avenue Academy.
- The SOP editor, the retire confirmation and the classic view's way back.

Unchanged on purpose: the address (`#training`), the tables (`academy_paths`, `academy_awards`), the tour key (`tour:academy`) and everyone's progress, levels, certificates and badges. Old links and bookmarks still work.

## Release checklist

- **Access:** no page changed hands. The access profile editor and Request more access show the new name; the leaders' profile notes and the Executive profile's "can" list now say "the Avenue Academy".
- **Training:** the Hub tour, the Home tour, the team page tour (its SOPs step), the Important info tour (its Training videos step), the person page tour, the Avenue Academy's own tour (its Learning Avenues step) and the "Tour paused" note use the new names. In the academy's content: the page tour's title and description ("Page tour: Avenue Academy"), Hub module 7 (training and onboarding), the Marketing Strategy Package overview ("Learning Avenue on the MG&Co marketing strategy") and the partners lesson. The Important info note for the Thriving Non-Profits course login says Avenue Academy.
- **For agents and developers:** the comments on `trainings`, `trainings.path_group`, `academy_paths` (and its `name`, `dept`, `required`) and `academy_awards` give both names (Learning Avenue, called a learning path before wave135), so a search for either finds them. `docs/DATA_MODEL.md` is regenerated; `build/gen_data_model.py` now reads every comment migration after `wa134_comments.sql`, so later comments (such as the passwords tables from wave134) are included.
- **Security review:** display text only; no function, policy or grant changed.

## Verification

- The migration ran first as a rolled-back dry run: the tour row renamed, no academy row or profile note left with the old names, the course note and the comments updated.
- `test/w122drive.js` 36 of 36 (it now checks the menu says Avenue Academy), with every page tour walking to the end; `test/w134drive.js` 37 of 37.
- The harness for three identities differs from the live build only on the Avenue Academy, the HR, HR centre and Marketing pages, a team page's tool link and the menu, and each difference is the rename (a first run also missed the HR centre's check-in hours card on both builds alike: a timing difference in the harness, gone on a rerun).
- The live page matches the build (`df09bb9b`). The built page still says "Training academy" and "learning paths" only inside two developer comments that record wave122's history.
