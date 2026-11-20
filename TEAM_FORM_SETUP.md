# FYI Team Form and Automatic Website Publishing

Keep real form IDs, admin emails, and credentials out of this file and out of Git.

## Free Spark workflow

Google Forms collects each profile and stores its uploaded photo in Drive. The installed Apps Script trigger checks the verified respondent email, makes the photo link-viewable, and publishes the profile to public Firestore `teamMembers` immediately. It also records the private response in `teamSubmissions`, writes a tracking row, and adds an audit entry. The `/admin` page monitors the data; it does not approve submissions. Each new response for the same verified email updates that member's existing public profile.

This workflow uses Firebase Authentication, Firestore, Apps Script, and Google Drive; it does not require Cloud Functions, Secret Manager, or a billing account.

## Apps Script setup

1. In Apps Script, paste the current `scripts/create_team_profile_form.gs` into the project attached to the form. Save it.
2. In **Project Settings → Script Properties**, set `TEAM_FORM_ID` to the existing form ID and `INITIAL_ADMIN_EMAIL` to the official FYI owner's VIT Bhopal account. `TEAM_ADMIN_SHEET_ID` is created and saved automatically by `initializeFreeAdminQueue`; do not create or enter it manually. Keep the email value in Script Properties, not in Git or source code.
3. In **Project Settings**, enable **Show `appsscript.json` manifest file**. In the manifest's `oauthScopes`, merge these scopes with any existing entries:

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

4. The Google account that owns the trigger must have Firestore data access in the Firebase project's Google Cloud IAM. Reauthorize the script when prompted. Restrict Apps Script editors to trusted administrators.
5. Run `setupTeamProfilePublishing` once. It adds or marks the account from `INITIAL_ADMIN_EMAIL` as the primary FYI owner, installs the response-sheet trigger, and publishes existing responses. If the official owner was already initialized, it marks that account as primary. Re-running setup is safe and republishes existing rows.
6. Deploy the current Firestore rules so only the primary FYI owner can manage admins while every listed admin can edit team profiles: `firebase deploy --only firestore:rules --config firebase.firestore.json --project fyiclubvitbpl`.
7. Open `https://<your-site>/admin` and sign in with the official owner Google account.

## Form requirements

- Set Google Forms to collect verified email addresses, limit to one response per account, and restrict access to the intended VIT Bhopal respondents. The automatically collected address from the VIT Bhopal domain is the trusted private identity. If the form also asks for an address as text, that duplicate answer does not control authentication or block a valid submission.
- Required questions: full name; position; department/team for Lead, Co-Lead, and Core Member; profile photo; specialty (150 characters maximum); LinkedIn; and consent.
- Optional questions: quote (250 characters maximum) and public handle (30 characters maximum).
- President, Vice President, Secretary, and Student Coordinator skip the team question. Lead, Co-Lead, and Core Member choose a team.
- The required file upload question must be titled exactly `Profile photo`.
- Consent must clearly say that valid submitted profile details, LinkedIn link, and photo are published on the public website immediately after submission. The uploaded photo is shared with anyone who has its Drive link.

## Provision the website admin

1. Enable both Google and Email/Password in Firebase Authentication and add the production domain to authorized domains.
2. Run `initializeWebsiteAdminOwner` in the trusted Apps Script project. It registers the account from `INITIAL_ADMIN_EMAIL` as the first owner.
3. Open `/admin` on the deployed site and sign in with that Google account.

Any account listed in `adminUsers` can edit public team profiles and read private submissions and audit history. Only the primary FYI owner can add or remove admin accounts; all newly added accounts are regular admins and cannot manage the allowlist. An unlisted account is denied and signed out. Form publishing runs under the trusted Apps Script owner's Google account.

The admin page offers Google sign-in, Email/Password sign-in, password-reset email, and email verification. There is no public sign-up; the primary owner allowlists first. If an account needs Email/Password, a project owner must create it in Firebase Authentication (or link the password provider to its existing account). Adding an email to the allowlist does not itself create an Authentication user. Google accounts are verified by Google; unverified password accounts receive a verification link and cannot access admin data until verified. Firestore rules enforce verified email and the admin allowlist.

Firebase's built-in Google sign-in can still create an Auth user record when an unlisted person attempts sign-in; the website immediately denies access and signs them out. Preventing even that Auth record from being created requires Firebase Identity Platform blocking functions, which are not part of this Spark-plan setup.

Base Firebase Authentication on Spark does not provide app-enforced multi-factor authentication. For a free extra sign-in factor, enable 2-Step Verification on the Google account used by the owner. Do not enable SMS authentication if you need to avoid SMS charges.

## Photo privacy and audit limits

Google Forms places uploads in Drive. On each valid response, the script sets that individual photo to **Anyone with the link — Viewer** and publishes its image URL in the public team profile. Only the submitted photo is shared; the upload folder is not made public. This is required for visitors to see the portrait without signing in.

Automatic profile publishes are appended to Firestore `auditLogs`. Apps Script uses its trusted Google account's Firestore IAM access to update the public profile and private submission record. Firebase project owners and the Apps Script owner can alter data outside the website, so keep those accounts restricted. This Spark-plan setup does not provide server-side session-duration tracking.
