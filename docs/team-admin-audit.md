# Team intake and review architecture

## Data flow

1. A respondent submits the Google Form using a verified account email. The Apps Script response-sheet trigger checks that email against the private email answer and validates the required photo upload.
2. Apps Script writes the submission to `teamSubmissions/{submissionId}` through the Firestore REST API. The record includes private email and Drive file ID, plus the chosen position/team and public profile fields. An intake event is appended to `auditLogs`.
3. `/admin` requires Google sign-in and a corresponding `adminUsers/{uid}` record with role `owner` or `reviewer`.
4. An approval batch changes only the submission review fields, writes the public profile to `teamMembers/{memberId}`, and appends an audit entry. The private email and photo file ID never enter the public profile.
5. A rejection changes the review state and appends the corresponding audit entry. Neither decision can be repeated through the website after the submission leaves `pending`.

## Rules and trust boundaries

- Public reads of `teamMembers` require `isPublished == true`.
- Website reviewers can read submissions and make a one-time pending-to-approved/rejected transition. They cannot change submitted fields or delete submissions.
- Website-created audit entries require the authenticated actor UID and a server timestamp; clients cannot edit/delete entries.
- Admin roles are stored in `adminUsers/{normalizedEmail}`. The initial owner is seeded by the trusted Apps Script setup; owners can add/remove later VIT Bhopal emails from `/admin`.
- Admin access requires a verified email and a matching `adminUsers/{normalizedEmail}` allowlist record. Firestore rules enforce both checks.
- Google sign-in may create an Auth account before the app checks the allowlist. An unlisted account is immediately denied and signed out, and Firestore rules give it no team/admin data access. Blocking the Auth record itself needs Identity Platform blocking functions, outside this Spark workflow.
- Base Firebase Authentication on Spark does not enforce app-level MFA. Owners can enable Google Account 2-Step Verification for their Google sign-in account as a free extra factor.
- Apps Script writes through the owner's Google OAuth/IAM identity, which bypasses Firestore Security Rules. Keep the script owner and project IAM access restricted. Google project owners can still alter data or rules outside the website.

## Photo handling

Form uploads remain private in Drive and the pending submission stores the Drive file ID for admin review. The Team page currently renders initials and does not display photos. Approval does not make the Drive file public.

## Limits on Spark

The browser approval flow records server-timestamped decisions but cannot securely record authoritative admin session duration without a trusted backend. Avoid claiming complete activity or session tracking on this plan. To get a server-controlled audit writer and session metrics later, move the review operations to a trusted backend such as Cloud Functions, which requires the applicable paid Firebase billing plan.
