# Lab UI integration

The UI pass ports the approved experimental interface into the maintained Hub source. Each feature has a separate commit and uses the existing application controls and access rules.

| UI area | Status |
| --- | --- |
| Compact searchable Apps launcher | Integrated |
| Page transitions and reduced motion | Integrated |
| Six primary links and three navigation flyouts | Integrated |
| Serving workflow, role disclosures and contact cards | Integrated |
| Colored volunteer status picker | Integrated |
| Organized SOP sections and owner picker | Integrated |
| Compact applicant cards | Integrated |
| Phone workspace layout | Pending |
| Taller sign-offs workspace | Pending |
| Compact Close the loop dialog | Pending |

The productivity workflows are a later phase. The requested QR inventory management system is outside this integration.

UI parts live in `build/parts274`. Regenerate their segment with `python3 build/parts274/assemble.py`, then build with `bash build/build.sh`. The existing wave134 and other native assemblers are run when their parts change. The preview uses the repository's offline data stub.
