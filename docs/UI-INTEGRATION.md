# Lab UI integration

The UI pass ports the approved experimental interface into the maintained Hub source. Each feature has a separate commit and uses the existing application controls and access rules.

| UI area | Status |
| --- | --- |
| Compact searchable Apps launcher | Integrated |
| Page transitions and reduced motion | Integrated |
| Six primary links and three navigation flyouts | Integrated |
| Direct Volunteer Manager page navigation | Integrated |
| Serving workflow, role disclosures and contact cards | Integrated |
| Colored volunteer status picker | Integrated |
| Organized SOP sections and owner picker | Integrated |
| Compact applicant cards | Integrated |
| Phone workspace layout | Integrated |
| Taller sign-offs workspace | Integrated |
| Compact Close the loop dialog | Integrated |

The productivity workflows are a later phase. The requested QR inventory management system is outside this integration. The Hub's existing Inventory page stays available, and the newer Setup page remains under Settings in Volunteer Manager.

UI parts live in `build/parts274`. Regenerate their segment with `python3 build/parts274/assemble.py`, then build with `bash build/build.sh`. The existing wave134 and other native assemblers are run when their parts change. The preview uses the repository's offline data stub.

## Verification

- All 23 focused DOM regression cases pass. They cover access-aware app navigation, route motion and reduced motion, sidebar flyouts, preserved roster and SOP controls, the status picker, applicant disclosures, Phone controls, sign-off actions and the Loop dialog.
- The assembled build passes the brand/team-label guard, all three inline JavaScript syntax checks and `git diff --check`.
- Browser checks used fictional volunteer data and the repository's offline Supabase stub. Populated serving, roster, status choices, SOP, applicants, Phone, sign-offs and Loop screens were checked on desktop. The serving roster and floating contact card also fit a 390 by 500 viewport; the Apps launcher was checked at that size as well.
- The integration changes no edge functions, database migrations or production configuration. Existing mutation and access handlers remain connected to the redesigned controls.

```sh
node --test test/apps-launcher.test.mjs test/page-transitions.test.mjs test/ui-integration.test.mjs
bash build/build.sh
```

These are UI and offline interaction checks. Authenticated saves, live messaging, AI responses and role permissions still require validation in the organization's staging environment before release. The draft pull request has not been deployed.
