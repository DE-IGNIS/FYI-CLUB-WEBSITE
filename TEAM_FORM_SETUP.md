# FYI Team Form and Website Approval Setup

Keep real form IDs, admin emails, and credentials out of this file and out of Git.

## Free Spark workflow

Google Forms collects the profile update and stores the uploaded photo privately in Drive. Apps Script checks the verified respondent email, then writes a private pending record to Firestore `teamSubmissions`. The website's `/admin` page signs in with Google and lets a registered admin approve or reject the request. Approval writes public profile fields to `teamMembers`; the verified email and Drive photo ID stay in the private submission. Rejections and approvals appear in the website audit log. The response spreadsheet remains an intake backup and cannot publish profiles.

This workflow uses Firebase Authentication, Firestore, Apps Script, and Google Drive; it does not require Cloud Functions, Secret Manager, or a billing account.

## Apps Script setup

1. In Apps Script, paste the current `scripts/create_team_profile_form.gs` into the project attached to the form. Save it.
2. In **Project Settings → Script Properties**, keep `TEAM_FORM_ID` set to the existing form ID. Keep `TEAM_ADMIN_SHEET_ID` set to the private queue sheet ID already created for the form.
3. In **Project Settings**, enable **Show `appsscript.json` manifest file**. In the manifest's `oauthScopes`, merge these scopes with any existing entries:

   ```json
   [
     "https://www.googleapis.com/auth/forms",
     "https://www.googleapis.com/auth/spreadsheets",
     "https://www.googleapis.com/auth/drive",
     "https://www.googleapis.com/auth/script.external_request",
     "https://www.googleapis.com/auth/script.scriptapp",
     "https://www.googleapis.com/auth/datastore",
     "https://www.googleapis.com/auth/cloud-platform",
     "https://www.googleapis.com/auth/userinfo.email"
   ]
   ```

4. The Google account that owns the trigger must have Firestore data access and Firebase Authentication project configuration access in the Firebase project's Google Cloud IAM. Reauthorize the script when prompted. Restrict Apps Script editors to trusted administrators.
5. In Firebase Authentication settings, upgrade Authentication to Identity Platform. Spark remains no-billing, with a 3,000 daily-active-user limit for most providers after the upgrade. Then run `enableTotpMfaForWebsiteAdmins` once to enable authenticator-app TOTP (no SMS is used).
6. Run `initializeWebsiteAdminOwner` once. It adds `sumit.24bce11520@vitbhopal.ac.in` as the initial owner in Firestore `adminUsers`.
7. Run `initializeFreeAdminQueue`, then `syncExistingResponseRows` once to send current response rows into Firestore. New submissions sync automatically through the response-sheet trigger installed by initialization.
8. Open `https://<your-site>/admin`, sign in with the owner Google account, enroll an authenticator app using the displayed setup key, then sign in again and complete the TOTP challenge.

## Form requirements

- Collect verified email addresses, limit to one response per account, and restrict access to the intended VIT Bhopal respondents.
- Required questions: full name; position; department/team for Lead, Co-Lead, and Core Member; profile photo; specialty (150 characters maximum); LinkedIn; and consent.
- Optional questions: quote (250 characters maximum), public handle (30 characters maximum), Instagram, and GitHub.
- President, Vice President, Secretary, and Student Coordinator skip the team question. Lead, Co-Lead, and Core Member choose a team.
- The required file upload question must be titled exactly `Profile photo`.
- Consent must say the submitted profile details and social links can be displayed after approval. Photo consent should describe private review and website use only if the site will actually display it.

## Provision the website admin

1. Enable both Google and Email/Password in Firebase Authentication and add the production domain to authorized domains.
2. Run `initializeWebsiteAdminOwner` in the trusted Apps Script project. It registers `sumit.24bce11520@vitbhopal.ac.in` as the first owner.
3. Open `/admin` on the deployed site and sign in with that Google account.

Only accounts with `owner` or `reviewer` in `adminUsers` can read submissions, approve/reject them, or inspect audit history. Owners can add/remove VIT Bhopal emails from the allowlist in the Admin page. An unlisted account is denied and signed out.

The admin page offers Google sign-in, Email/Password sign-in, a password-reset email, email verification, and authenticator-app TOTP MFA. There is no public sign-up; an owner allowlists first. If an account needs Email/Password, a project owner must create it in Firebase Authentication (or link the password provider to its existing account). An owner adding an email to the allowlist does not itself create an Authentication user. Google accounts are verified by Google; unverified password accounts receive a verification link and cannot access admin data until verified. Every admin must enroll TOTP; Firestore rules reject admin requests without a TOTP-authenticated session.

Firebase's built-in Google sign-in can still create an Auth user record when an unlisted person attempts sign-in; the website immediately denies access and signs them out. Preventing even that Auth record from being created requires Firebase Identity Platform blocking functions, which are not part of this Spark-plan setup.

Authenticator-app TOTP does not send SMS. Keep phone/SMS MFA disabled to avoid SMS charges. You can also enable 2-Step Verification on the Google account used for Google sign-in.

## Photo privacy and audit limits

Google Forms places uploads in Drive. This website approval flow keeps that file private and provides an admin-only Drive review link; the existing Team page currently displays initials, not the uploaded image. The photo is not copied into public `teamMembers`. If you later want approved portraits visible, add an explicit publication step and public image hosting policy first; do not make the whole upload folder public.

Approvals/rejections are appended to Firestore `auditLogs` with Firebase server timestamps and cannot be edited by the website client. Apps Script uses its trusted Google account's Firestore IAM access to create pending records and intake logs. Firebase project owners and the Apps Script owner can still alter data outside the website, so keep those accounts restricted. This Spark-plan setup does not provide server-side session-duration tracking.
