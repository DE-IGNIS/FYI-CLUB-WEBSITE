# FYI Team Form Setup

Keep this file local. Do not put actual secrets in it.

## Apps Script trigger

The form-submit trigger is installed for the existing form. Its form ID is already stored as the `TEAM_FORM_ID` Script Property.

## Free Spark-plan flow

This setup does not use Cloud Functions, Secret Manager, or a billing account. Form submissions are held in a private Google Sheet. The Tech Lead approves/rejects by editing the Status cell; an Apps Script trigger writes approved public fields to Firestore and records the decision in the Sheet's Audit Log tab.

1. In Apps Script, run `initializeFreeAdminQueue`. It reuses or creates the private queue and installs a submit trigger on the Form's linked response spreadsheet.
2. Run `installQueueEditTrigger` once. Keep the queue restricted to trusted admins.
3. Run `syncExistingResponseRows` once to backfill responses already present in the linked Form response spreadsheet. It skips email addresses already in the queue, so it is safe to rerun.
4. In Apps Script **Project Settings**, enable **Show `appsscript.json` manifest file**. Add these scopes to the manifest's `oauthScopes` array (merge with any existing scopes):

   ```json
   [
     "https://www.googleapis.com/auth/forms",
     "https://www.googleapis.com/auth/spreadsheets",
     "https://www.googleapis.com/auth/drive",
     "https://www.googleapis.com/auth/script.external_request",
     "https://www.googleapis.com/auth/datastore"
   ]
   ```

   The Google account that owns the trigger must have Firestore data access in the Firebase project's Google Cloud IAM. If it is already project owner, no additional role is needed. Reauthorize Apps Script when prompted.
5. Submit a test response. The row appears as Pending. Change its status cell to exactly `Approved` or `Rejected`. Approval publishes a Firestore profile and makes the photo's Drive link viewable to anyone, as covered by the form consent.

The Form submit trigger's script uses the verified respondent email and checks it against the private email answer. Do not share the queue Sheet or upload folder publicly. Keep Apps Script editors limited to trusted admins.

## Form checks before testing

- Keep **Collect email addresses** enabled and verified.
- Keep **Limit to 1 response** enabled.
- The file upload question must be required and titled exactly `Profile photo`.
- Position branching: President, Vice President, Secretary, and Student Coordinator skip the Department / Team section; Lead, Co-Lead, and Core Member go through it.
- Consent should require all three checkbox choices.
- Restrict access to the intended respondents. Keep the response Sheet and Drive upload folder private.

## Photo handling

Google Forms file upload stores the original in Drive. This no-billing workflow does not automatically compress it; ask members to upload an already compressed image. The photo remains private until the admin approves the profile, at which point the script enables link viewing for the photo.

## Admin access

The admin approval UI is the private Google Sheet. The website reads published Firestore profiles; the `/admin` Cloud Functions console is not used in the Spark workflow.
