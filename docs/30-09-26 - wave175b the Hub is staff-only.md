# 30/09/26 - wave175b: the Hub is staff-only; volunteer sign-in moves to welfareavenue.com

Steel (30/09/26): "I need to ensure that the Dashboard is protected by anyone trying to sign in there. When the new site is up, Volunteers and donors should only be able to sign in at welfareavenue.com while our staff could sign in to Hub.welfareavenue.com." He chose two Google sign-ins: the Hub keeps its Google app (project welfare-avenue-dashboard) **Internal**, so only Welfare Avenue Google accounts can sign in there; volunteers and donors get a separate public Google sign-in used only on welfareavenue.com, when the new site is up.

## What changed
- **The Hub's sign-in gate** (`000_head_base`): an account that is not on the team or the board (get_my_role none) is signed out at once, its session removed from the browser (so a failed sign-out cannot loop), and the sign-in screen says the account is not on the team and that volunteers and donors sign in on welfareavenue.com. The sign-in screen now shows at once instead of after the loading screen's 9 second failsafe.
- **The Google app stays Internal.** Nothing was changed in Google Cloud (Make external was opened and cancelled: production needs a privacy policy link, and Testing would have locked staff out).
- **The access token hook** (`wa175_access_token_hook`) is on in Supabase (Steel switched it on): anyone not team or board gets the role anon in their token, the second lock behind Google's.
- **The confirm page's "Save to my account"** is hidden (`ACCT_ON = false` in build/c/src.html) until volunteer sign-in lives on welfareavenue.com; with the Hub's Google app Internal, a volunteer's Gmail could not sign in at /me anyway.
- **The privacy notice** for volunteers, English and French: hub.welfareavenue.com/privacy/ (`build/privacy`, site_files `privacy/index.html`, host-sync v10). Google's public sign-in will link to it; it moves to welfareavenue.com with the new site.

## When the new site is up (the plan)
1. A new Google Cloud project for the public site (External, In production, app name "Welfare Avenue", home page welfareavenue.com, privacy policy on welfareavenue.com, scopes email and profile only) and a web OAuth client with welfareavenue.com as its JavaScript origin.
2. Supabase, Authentication, Providers, Google: add that client ID to the list of client IDs (the Hub's stays first, so the Hub's redirect sign-in keeps using the Internal app).
3. The volunteer account page moves to welfareavenue.com and signs in with Google Identity Services and Supabase signInWithIdToken; the volunteer_me functions and the hook stay as they are. Donors get the same.
4. Turn "Save to my account" back on, pointing at welfareavenue.com.

## Tests
`test/w175bdrive.js` (5): a non-team account is signed out, its session gone, the screen says why and where volunteers sign in, no loop; staff open the Hub as before. The stub now honours sign-out (`stub_signed_out`) and `fresh()` takes `gateOk`. Regression unchanged; the rebased build (on wave180) reproduced live exactly before the change.
