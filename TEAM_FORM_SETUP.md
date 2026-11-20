# Team Form Publishing Guide

## How publishing works

1. A respondent submits the Google Form. The linked response spreadsheet receives the response.
2. An installed Apps Script form-submit trigger validates the Google-collected VIT Bhopal email, maps the answers, and publishes the profile to Firestore `teamMembers`.
3. The website reads published `teamMembers` records and shows them on the homepage and Team page. No admin approval is part of this flow.
4. The script also stores the private response in `teamSubmissions` and writes an audit entry. The linked Form response spreadsheet is the source of truth; a separate review queue is not used.

The member document ID is derived from the verified email. A new response can create or update that email's own profile; it does not select another member's document. Since publication is automatic, **restrict the Google Form to current FYI members**. A VIT Bhopal email alone is the script's identity check, not proof of club membership. Form answers, LinkedIn links, and the photo become public on the website. Each submitted photo is shared as **Anyone with the link — Viewer**; the Drive folder stays private.

## One-time setup

1. Copy the current `scripts/create_team_profile_form.gs` into the Apps Script project linked to the form, replacing its old code, and save.
2. In **Project Settings → Script Properties**, set:
   - `TEAM_FORM_ID`: the ID from the Google Form URL.
   - `INITIAL_ADMIN_EMAIL`: the official FYI owner's VIT Bhopal email.
3. In **Project Settings**, enable **Show `appsscript.json` manifest file**. Merge these scopes into its existing `oauthScopes` list:

   ```json
   [
     "https://www.googleapis.com/auth/forms",
     "https://www.googleapis.com/auth/spreadsheets",
     "https://www.googleapis.com/auth/drive",
     "https://www.googleapis.com/auth/script.external_request",
     "https://www.googleapis.com/auth/script.scriptapp",
     "https://www.googleapis.com/auth/datastore",
     "https://www.googleapis.com/auth/userinfo.email"
   ]
   ```

4. Ensure the Google account that owns the trigger has Firestore data access in the Firebase project's Google Cloud IAM.
5. Run **`setupTeamProfilePublishing`** once from the Apps Script editor and grant the requested permissions. It marks the primary owner, installs the form-submit trigger, and publishes existing response rows. Run it again only to reinstall setup or retry/backfill rows.
6. Deploy Firestore rules to enforce the admin roles:

   ```sh
   firebase deploy --only firestore:rules --config firebase.firestore.json --project fyiclubvitbpl
   ```

7. Open `/admin` and sign in as the official owner.

Saving this repository or pushing to GitHub does **not** update the separate Apps Script project. Paste and save the script there. Website hosting and Firestore rules also deploy separately; the GitHub workflow deploys hosting, while the command above deploys rules.

The old `FYI Team Profile Admin Queue` spreadsheet, if one already exists, is no longer read or updated. Its status, review, and sync columns are historical and can be archived; the setup script leaves that spreadsheet untouched. The original Google Form response spreadsheet remains active.

## Who can edit what

- **Form respondents:** A valid response creates or updates the public profile associated with the respondent's verified email. Restrict the form to the intended FYI members because this happens without review.
- **Admins:** Every account on the `adminUsers` allowlist can edit any published profile through `/admin`. Those edits write to Firestore `teamMembers` and appear on the website.
- **Primary FYI owner:** The account in `INITIAL_ADMIN_EMAIL` can add or remove admins. Newly added admins can edit profiles but cannot manage the allowlist.
- **Next form response:** A later response for a member updates that member's profile fields and can replace manual admin edits.
- **Public visitors:** Can read published profiles only. Firestore rules restrict profile writes to admins and the trusted Apps Script account.

The admin allowlist does not create Firebase Authentication accounts. If an admin uses email/password, a project owner must first create or link that account in Firebase Authentication. Google sign-in is available for verified VIT Bhopal accounts.

## Form setup requirements

- Collect the respondent's verified Google email. The script uses this value; a separate typed email field is ignored for identity.
- Restrict form access to current FYI members. Also limit to one response per account where appropriate.
- Required questions: Full name, Position, Department / Team when applicable, Profile photo, Specialty, and consent.
- The file upload question title must start with `Profile photo`.
- Keep position and team choices consistent with the allowed website teams: Technical Team, Design & Content, Event Management, Photography, PR & Outreach, and Social Media. Executive positions do not require a team choice.
- Consent must clearly say submitted profile details, LinkedIn link, and photo are published immediately. Photos are shared by link.

## Troubleshooting

- **Response is in the sheet but not on the site:** Open Apps Script **Executions** and inspect the form-submit run. After correcting a setup or permission error, run `setupTeamProfilePublishing` once to retry existing rows.
- **Drive permission error:** Confirm the `drive` OAuth scope is present, save the manifest, refresh the editor, run setup, and grant Drive access. If the school Workspace blocks external sharing, ask its administrator; the site cannot load a restricted photo for public visitors.
- **Profile appears without a photo:** Confirm the Drive file is set to Anyone with the link — Viewer, then refresh the Team page. The form trigger applies this permission to each valid response.
- **Admin cannot manage accounts:** Confirm the correct `INITIAL_ADMIN_EMAIL`, run `setupTeamProfilePublishing`, then deploy the Firestore rules using the command above.

The workflow uses Google Forms, Sheets, Apps Script, Drive, Firebase Authentication, and Firestore. It does not require Cloud Functions or a paid Firebase plan for ordinary club usage. Google service quotas and Workspace sharing policies still apply.
