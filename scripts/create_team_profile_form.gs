/** Installable response-spreadsheet submit trigger. */
function onTeamProfileSubmit(e) {
  if (!e || (!e.response && !e.namedValues)) throw new Error('Use the installed Form response-sheet trigger.');

  const answers = {};
  if (e.response) {
    e.response.getItemResponses().forEach((itemResponse) => {
      answers[itemResponse.getItem().getTitle()] = itemResponse.getResponse();
    });
  } else {
    Object.keys(e.namedValues).forEach((key) => { answers[key] = e.namedValues[key]; });
  }
  const answer = (label) => {
    const key = Object.keys(answers).find((candidate) => candidate.trim().toLowerCase().startsWith(label.toLowerCase()));
    return key ? answers[key] : '';
  };
  const position = String(answer('Position') || '').trim();
  const teamValue = answer('Department / Team');
  const team = Array.isArray(teamValue) ? String(teamValue[0] || '') : String(teamValue || '');
  const collectedEmail = (e.response && e.response.getRespondentEmail()) || answer('Email Address');
  const verifiedEmail = String(collectedEmail || '').trim().toLowerCase();
  const enteredEmail = String(answer('VIT Bhopal email') || '').trim().toLowerCase();
  if (!/^[^\s@]+@vitbhopal\.ac\.in$/.test(verifiedEmail)) {
    throw new Error('No automatically collected VIT Bhopal account was found. Set Google Forms email collection to verified email and submit while signed in with your VIT Bhopal account.');
  }
  // The Google-collected address is authoritative. The separate text answer is
  // redundant and must not block a valid submission if it contains a typo.
  if (enteredEmail && enteredEmail !== verifiedEmail) {
    Logger.log('The typed VIT Bhopal email differs from the Google-collected address; using the collected address for this profile.');
  }
  const upload = answer('Profile photo');
  const uploadText = Array.isArray(upload) ? String(upload[0] || '') : String(upload || '');
  const idMatch = uploadText.match(/[-\w]{25,}/);
  const fileId = idMatch ? idMatch[0] : uploadText;
  if (!fileId) throw new Error('Required profile photo is missing.');
  // Form responses publish directly, so the roster image must be link-viewable.
  DriveApp.getFileById(fileId).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const submittedAt = String(answer('Timestamp') || (e.values && e.values[0]) || new Date().toISOString());
  const responseId = e.response ? e.response.getId() : Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, submittedAt + '|' + verifiedEmail));
  const name = String(answer('Full name') || '').trim();
  const specialty = String(answer('Specialty') || '').trim();
  const quote = String(answer('Quote for your profile') || '').trim();
  const handle = String(answer('Public handle') || '').trim();
  const linkedin = String(answer('LinkedIn profile') || '').trim();
  const isExecutive = ['President','Vice President','Secretary','Treasurer','Student Coordinator'].includes(position);
  const teamNames = {'Photography Team':'Photography','PR & Outreach Team':'PR & Outreach','Social Media Team':'Social Media','Design & Content Team':'Design & Content','Event Management Team':'Event Management'};
  const department = isExecutive ? 'Executive Council' : (teamNames[team] || team);
  const validDepartments = ['Executive Council','Technical Team','Design & Content','Event Management','Photography','PR & Outreach','Social Media'];
  const validPositions = ['President','Vice President','Secretary','Treasurer','Student Coordinator','Lead','Co-Lead','Core Member'];
  if (!name || !validDepartments.includes(department) || !validPositions.includes(position)) {
    throw new Error('The response needs a full name, valid position, and valid team before it can be published.');
  }
  const displayGroup = isExecutive || position === 'Lead' || position === 'Co-Lead' ? 'Executive Council' : department;
  const submissionId = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, responseId).map(b => ('0'+((b+256)%256).toString(16)).slice(-2)).join('');
  const memberId = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, verifiedEmail).map(b => ('0'+((b+256)%256).toString(16)).slice(-2)).join('');
  const privatePhotoUrl = 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(fileId) + '&sz=w800';
  const publishedAt = new Date().toISOString();
  const profile = {
    submissionId, memberId, responseId, email: verifiedEmail, name, position,
    department, team: isExecutive ? '' : department, displayGroup,
    specialty, quote, handle,
    socialLinks: {linkedin},
    photoDriveId: fileId, photoUrl: privatePhotoUrl,
    status: 'published', submittedAt
  };
  // Every valid response immediately replaces the public profile for this email.
  publishTeamMemberToFirestore_(profile, publishedAt);
  const firestoreCreated = upsertFirestoreSubmission_(profile);
  if (firestoreCreated) appendFirestoreAudit_('profile_auto_published', memberId, name, {submissionId});
  return true;
}

/** One-time setup: register the official owner, install the trigger, and publish existing responses. */
function setupTeamProfilePublishing() {
  initializeWebsiteAdminOwner_();
  installTeamProfileTrigger_();
}

function installTeamProfileTrigger_() {
  const props = PropertiesService.getScriptProperties();
  const formId = props.getProperty('TEAM_FORM_ID');
  if (!formId) throw new Error('Set TEAM_FORM_ID in Script Properties first.');
  // The secondary review queue has been retired; keep its old spreadsheet as an archive.
  props.deleteProperty('TEAM_ADMIN_SHEET_ID');
  // Replace old submit and spreadsheet-approval triggers. Valid responses publish directly.
  ScriptApp.getProjectTriggers()
    .filter(t => ['onTeamProfileSubmit', 'onEditTeamQueue'].includes(t.getHandlerFunction()))
    .forEach(t => ScriptApp.deleteTrigger(t));
  const form = FormApp.openById(formId);
  const responseSheetId = form.getDestinationId();
  if (!responseSheetId) throw new Error('Link the Google Form to its response spreadsheet first.');
  ScriptApp.newTrigger('onTeamProfileSubmit').forSpreadsheet(responseSheetId).onFormSubmit().create();
  Logger.log('Form response spreadsheet: ' + SpreadsheetApp.openById(responseSheetId).getUrl());
  // Also publish responses submitted before this trigger was installed. This
  // is safe to repeat: response and member IDs are stable, so latest data wins.
  syncExistingResponseRows_();
}

/** Bootstrap the single primary FYI owner. Safe to rerun after setting INITIAL_ADMIN_EMAIL. */
function initializeWebsiteAdminOwner_() {
  const email = String(PropertiesService.getScriptProperties().getProperty('INITIAL_ADMIN_EMAIL') || '').trim().toLowerCase();
  if (!email) throw new Error('Set INITIAL_ADMIN_EMAIL in Script Properties first.');
  if (!/^[^\s@]+@vitbhopal\.ac\.in$/.test(email)) {
    throw new Error('INITIAL_ADMIN_EMAIL must be a VIT Bhopal address.');
  }
  const url = firestoreDocumentUrl_('adminUsers/' + encodeURIComponent(email));
  const existing = UrlFetchApp.fetch(url, {
    method: 'get', headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}, muteHttpExceptions: true
  });
  if (existing.getResponseCode() === 200) {
    const current = JSON.parse(existing.getContentText());
    if (current.fields && current.fields.role && current.fields.role.stringValue === 'owner') {
      if (current.fields.isPrimaryOwner && current.fields.isPrimaryOwner.booleanValue === true) {
        Logger.log('Initial FYI owner is already registered.');
        return;
      }
      const promoted = UrlFetchApp.fetch(url + '?updateMask.fieldPaths=isPrimaryOwner', {
        method: 'patch', contentType: 'application/json',
        headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()},
        payload: JSON.stringify({fields: {isPrimaryOwner: {booleanValue: true}}}),
        muteHttpExceptions: true
      });
      if (promoted.getResponseCode() < 200 || promoted.getResponseCode() >= 300) {
        throw new Error('Could not mark INITIAL_ADMIN_EMAIL as the primary owner: ' + promoted.getContentText());
      }
      Logger.log('Initial website owner marked as the primary FYI owner.');
      return;
    }
    throw new Error('An admin record already exists for INITIAL_ADMIN_EMAIL but it is not an owner. Ask a Firebase project owner to review it.');
  }
  if (existing.getResponseCode() !== 404) throw new Error('Admin lookup failed: ' + existing.getContentText());
  const fields = Object.fromEntries(Object.entries({
    email, role: 'owner', isPrimaryOwner: true, createdAt: new Date().toISOString(),
    createdByUid: 'initial-owner-setup', createdByEmail: Session.getEffectiveUser().getEmail() || ''
  }).map(([key, value]) => [key, firestoreValue_(value)]));
  const created = UrlFetchApp.fetch(url, {
    method: 'patch', contentType: 'application/json',
    headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()},
    payload: JSON.stringify({fields}), muteHttpExceptions: true
  });
  if (created.getResponseCode() < 200 || created.getResponseCode() >= 300) {
    throw new Error('Could not register initial owner: ' + created.getContentText());
  }
  appendFirestoreAudit_('admin_owner_initialized', email, email, {role: 'owner'});
  Logger.log('Initial website owner added.');
}

/** Backfill or republish all responses already present in the linked spreadsheet. */
function syncExistingResponseRows_() {
  const formId = PropertiesService.getScriptProperties().getProperty('TEAM_FORM_ID');
  if (!formId) throw new Error('Set TEAM_FORM_ID in Script Properties first.');
  const form = FormApp.openById(formId);
  const responseSheetId = form.getDestinationId();
  if (!responseSheetId) throw new Error('Link the Google Form to its response spreadsheet first.');
  const spreadsheet = SpreadsheetApp.openById(responseSheetId);
  const responseTab = findFormResponseSheet_(spreadsheet);
  const rows = responseTab.getDataRange().getDisplayValues();
  if (rows.length < 2) { Logger.log('No existing response rows to sync.'); return; }
  const headers = rows[0];
  let published = 0;
  let skippedOrFailed = 0;
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const values = rows[rowIndex];
    if (!values.some(value => value.trim())) continue;
    const namedValues = {};
    headers.forEach((header, index) => { namedValues[header] = [values[index] || '']; });
    try {
      if (onTeamProfileSubmit({ namedValues, values })) published++;
    } catch (err) {
      skippedOrFailed++;
      Logger.log('FAILED response row ' + (rowIndex + 1) + ' (' + (values[0] || 'no timestamp') + '): ' + (err && err.stack ? err.stack : err));
    }
  }
  Logger.log('Backfill complete. Published responses: ' + published + '; failed rows: ' + skippedOrFailed + '; response tab: ' + responseTab.getName());
}

function findFormResponseSheet_(spreadsheet) {
  const requiredHeaders = ['timestamp', 'full name', 'position', 'profile photo', 'specialty'];
  const sheets = spreadsheet.getSheets();
  for (let index = 0; index < sheets.length; index++) {
    const sheet = sheets[index];
    const lastColumn = sheet.getLastColumn();
    if (sheet.getLastRow() < 1 || lastColumn < 1) continue;
    const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0]
      .map(value => String(value || '').trim().toLowerCase());
    if (requiredHeaders.every(required => headers.some(header => header.startsWith(required)))) return sheet;
  }
  const actualHeaders = sheets.map(sheet => {
    const lastColumn = sheet.getLastColumn();
    return sheet.getName() + ': ' + (lastColumn
      ? sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].join(' | ')
      : '(empty)');
  }).join('\n');
  throw new Error('Could not find the Google Form response tab. Expected headers including Timestamp, Full name, Position, Profile photo, and Specialty. Tabs found:\n' + actualHeaders);
}

function upsertFirestoreSubmission_(profile) {
  const url = firestoreDocumentUrl_('teamSubmissions/' + profile.submissionId);
  const existing = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()},
    muteHttpExceptions: true
  });
  const isNew = existing.getResponseCode() === 404;
  if (!isNew && existing.getResponseCode() !== 200) throw new Error('Firestore lookup failed: ' + existing.getContentText());
  const fields = Object.fromEntries(Object.entries(profile).map(([key, value]) => [key, firestoreValue_(value)]));
  const response = UrlFetchApp.fetch(url, {
    method: 'patch', contentType: 'application/json',
    headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()},
    payload: JSON.stringify({fields}), muteHttpExceptions: true
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Firestore submission sync failed: ' + response.getContentText());
  }
  return isNew;
}

function publishTeamMemberToFirestore_(profile, publishedAt) {
  const publicProfile = {
    name: profile.name,
    position: profile.position,
    department: profile.department,
    team: profile.team,
    displayGroup: profile.displayGroup,
    specialty: profile.specialty,
    quote: profile.quote,
    handle: profile.handle,
    socialLinks: profile.socialLinks,
    photoUrl: profile.photoUrl,
    isPublished: true,
    updatedAt: publishedAt
  };
  const fields = Object.fromEntries(Object.entries(publicProfile).map(([key, value]) => [key, firestoreValue_(value)]));
  const response = UrlFetchApp.fetch(firestoreDocumentUrl_('teamMembers/' + profile.memberId), {
    method: 'patch', contentType: 'application/json',
    headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()},
    payload: JSON.stringify({fields}), muteHttpExceptions: true
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Direct team profile publish failed: ' + response.getContentText());
  }
}

function appendFirestoreAudit_(action, targetId, targetName, after) {
  const fields = Object.fromEntries(Object.entries({
    action, actorUid: 'apps-script', actorEmail: Session.getEffectiveUser().getEmail() || '',
    targetId, targetName, after, occurredAt: new Date().toISOString()
  }).map(([key, value]) => [key, firestoreValue_(value)]));
  const response = UrlFetchApp.fetch(firestoreDocumentUrl_('auditLogs'), {
    method: 'post', contentType: 'application/json',
    headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()},
    payload: JSON.stringify({fields}), muteHttpExceptions: true
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Firestore audit sync failed: ' + response.getContentText());
  }
}

function firestoreDocumentUrl_(path) {
  return 'https://firestore.googleapis.com/v1/projects/fyiclubvitbpl/databases/(default)/documents/' + path;
}

function firestoreValue_(v) {
  if (typeof v==='boolean') return {booleanValue:v};
  if (typeof v==='object'&&v!==null) return {mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,firestoreValue_(x)]))}};
  return {stringValue:String(v==null?'':v)};
}
