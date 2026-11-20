/** Installable response-spreadsheet submit trigger. */
function onTeamProfileSubmit(e) {
  if (!e || (!e.response && !e.namedValues)) throw new Error('Use the installed Form response-sheet trigger.');
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty('TEAM_ADMIN_SHEET_ID');
  if (!sheetId) throw new Error('Run initializeFreeAdminQueue first.');

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
  const position = String(answer('Position') || '');
  const teamValue = answer('Department / Team');
  const team = Array.isArray(teamValue) ? String(teamValue[0] || '') : String(teamValue || '');
  const verifiedEmail = String((e.response && e.response.getRespondentEmail()) || answer('Email Address') || answer('VIT Bhopal email') || '').trim().toLowerCase();
  const enteredEmail = String(answer('VIT Bhopal email') || verifiedEmail).trim().toLowerCase();
  if (!verifiedEmail || enteredEmail !== verifiedEmail) {
    throw new Error('The VIT Bhopal email answer must match the signed-in Google account.');
  }
  const upload = answer('Profile photo');
  const uploadText = Array.isArray(upload) ? String(upload[0] || '') : String(upload || '');
  const idMatch = uploadText.match(/[-\w]{25,}/);
  const fileId = idMatch ? idMatch[0] : uploadText;
  if (!fileId) throw new Error('Required profile photo is missing.');
  const submittedAt = String(answer('Timestamp') || (e.values && e.values[0]) || new Date().toISOString());
  const responseId = e.response ? e.response.getId() : Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, submittedAt + '|' + verifiedEmail));
  const ss = SpreadsheetApp.openById(sheetId);
  const queue = ss.getSheetByName('Submissions');
  const name = String(answer('Full name') || '').trim();
  const specialty = String(answer('Specialty') || '').trim();
  const quote = String(answer('Quote for your profile') || '').trim();
  const handle = String(answer('Public handle') || '').trim();
  const instagram = String(answer('Instagram profile') || '').trim();
  const github = String(answer('GitHub profile') || '').trim();
  const linkedin = String(answer('LinkedIn profile') || '').trim();
  const isExecutive = ['President','Vice President','Secretary','Student Coordinator'].includes(position);
  const teamNames = {'Photography Team':'Photography','PR & Outreach Team':'PR & Outreach','Social Media Team':'Social Media','Design & Content Team':'Design & Content','Event Management Team':'Event Management'};
  const department = isExecutive ? 'Executive Council' : (teamNames[team] || team);
  const displayGroup = isExecutive || position === 'Lead' || position === 'Co-Lead' ? 'Executive Council' : department;
  const submissionId = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, responseId).map(b => ('0'+((b+256)%256).toString(16)).slice(-2)).join('');
  const memberId = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, verifiedEmail).map(b => ('0'+((b+256)%256).toString(16)).slice(-2)).join('');
  const privatePhotoUrl = 'https://drive.google.com/file/d/' + encodeURIComponent(fileId) + '/view';
  const profile = {
    submissionId, memberId, responseId, email: verifiedEmail, name, position,
    department, team: isExecutive ? '' : department, displayGroup,
    specialty, quote, handle,
    socialLinks: {instagram, github, linkedin},
    photoDriveId: fileId, photoUrl: privatePhotoUrl,
    status: 'pending', submittedAt
  };
  // Idempotent create: backfilling the response sheet never resets a reviewed
  // request or overwrites an existing member profile.
  const firestoreCreated = createPendingFirestoreSubmission_(profile);
  if (firestoreCreated) appendFirestoreAudit_('submission_received', submissionId, name, {status: 'pending'});

  let alreadyQueued = false;
  if (queue.getLastRow() > 1) {
    const responseIds = queue.getRange(2, 2, queue.getLastRow() - 1, 1).getDisplayValues().flat();
    alreadyQueued = responseIds.includes(responseId);
  }
  if (alreadyQueued) return firestoreCreated;
  queue.appendRow([new Date(submittedAt), responseId, verifiedEmail, name, position, team,
    specialty, quote, handle, instagram, github, linkedin,
    fileId, 'Pending', '', '', '']);
  appendAudit_(ss, 'submission_received', responseId, verifiedEmail);
  return firestoreCreated;
}

function initializeFreeAdminQueue() {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty('TEAM_ADMIN_SHEET_ID');
  const ss = existingId ? SpreadsheetApp.openById(existingId) : SpreadsheetApp.create('FYI Team Profile Admin Queue');
  let queue = ss.getSheetByName('Submissions');
  if (!queue) queue = ss.getSheets()[0].setName('Submissions');
  if (queue.getLastRow() === 0) queue.appendRow(['Submitted At','Response ID','Private Email','Full Name','Position','Department / Team','Specialty','Quote','Handle','Instagram','GitHub','LinkedIn','Photo Drive ID','Website Review Status','Reviewed At','Reviewed By','Sync Error']);
  let audit = ss.getSheetByName('Audit Log');
  if (!audit) audit = ss.insertSheet('Audit Log');
  if (audit.getLastRow() === 0) audit.appendRow(['Time','Action','Response ID','Member','Actor']);
  props.setProperty('TEAM_ADMIN_SHEET_ID', ss.getId());
  // Replace old submit and spreadsheet-approval triggers. All review now happens at /admin.
  ScriptApp.getProjectTriggers()
    .filter(t => ['onTeamProfileSubmit', 'onEditTeamQueue'].includes(t.getHandlerFunction()))
    .forEach(t => ScriptApp.deleteTrigger(t));
  const form = FormApp.openById(PropertiesService.getScriptProperties().getProperty('TEAM_FORM_ID'));
  const responseSheetId = form.getDestinationId();
  if (!responseSheetId) throw new Error('Link the Google Form to its response spreadsheet first.');
  ScriptApp.newTrigger('onTeamProfileSubmit').forSpreadsheet(responseSheetId).onFormSubmit().create();
  Logger.log('Private admin queue: ' + ss.getUrl());
  Logger.log('Form response spreadsheet: ' + SpreadsheetApp.openById(responseSheetId).getUrl());
  // Also import responses submitted before this trigger was installed. This is
  // safe to repeat: existing Firestore submissions are never reset or duplicated.
  syncExistingResponseRows();
}

/** One-time bootstrap for the initial website owner. Run from the trusted Apps Script project. */
function initializeWebsiteAdminOwner() {
  const email = 'sumit.24bce11520@vitbhopal.ac.in';
  const url = firestoreDocumentUrl_('adminUsers/' + encodeURIComponent(email));
  const existing = UrlFetchApp.fetch(url, {
    method: 'get', headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}, muteHttpExceptions: true
  });
  if (existing.getResponseCode() === 200) {
    const current = JSON.parse(existing.getContentText());
    if (current.fields && current.fields.role && current.fields.role.stringValue === 'owner') {
      Logger.log('Initial website owner is already registered: ' + email);
      return;
    }
    throw new Error('An admin record already exists for ' + email + ' but it is not an owner. Ask a Firebase project owner to review it.');
  }
  if (existing.getResponseCode() !== 404) throw new Error('Admin lookup failed: ' + existing.getContentText());
  const fields = Object.fromEntries(Object.entries({
    email, role: 'owner', createdAt: new Date().toISOString(),
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
  Logger.log('Initial website owner added: ' + email);
}

/** One-time backfill for submissions already present in the linked Form response spreadsheet. */
function syncExistingResponseRows() {
  const formId = PropertiesService.getScriptProperties().getProperty('TEAM_FORM_ID');
  if (!formId) throw new Error('Set TEAM_FORM_ID in Script Properties first.');
  const form = FormApp.openById(formId);
  const responseSheetId = form.getDestinationId();
  if (!responseSheetId) throw new Error('Link the Google Form to its response spreadsheet first.');
  const spreadsheet = SpreadsheetApp.openById(responseSheetId);
  const responseTab = findFormResponseSheet_(spreadsheet);
  const queueId = PropertiesService.getScriptProperties().getProperty('TEAM_ADMIN_SHEET_ID');
  if (!queueId) throw new Error('Run initializeFreeAdminQueue first.');
  const queueSpreadsheet = SpreadsheetApp.openById(queueId);
  const queue = queueSpreadsheet.getSheetByName('Submissions');
  if (!queue) throw new Error('The private queue has no Submissions sheet. Run initializeFreeAdminQueue again.');
  const rows = responseTab.getDataRange().getDisplayValues();
  if (rows.length < 2) { Logger.log('No existing response rows to sync.'); return; }
  const headers = rows[0];
  let imported = 0;
  let skippedOrFailed = 0;
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const values = rows[rowIndex];
    if (!values.some(value => value.trim())) continue;
    const namedValues = {};
    headers.forEach((header, index) => { namedValues[header] = [values[index] || '']; });
    try {
      const firestoreCreated = onTeamProfileSubmit({ namedValues, values });
      if (firestoreCreated) imported++;
    } catch (err) {
      skippedOrFailed++;
      Logger.log('FAILED response row ' + (rowIndex + 1) + ' (' + (values[0] || 'no timestamp') + '): ' + (err && err.stack ? err.stack : err));
    }
  }
  Logger.log('Backfill complete. New Firestore submissions: ' + imported + '; failed rows: ' + skippedOrFailed + '; response tab: ' + responseTab.getName() + '; queue rows: ' + Math.max(0, queue.getLastRow() - 1));
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

function createPendingFirestoreSubmission_(profile) {
  const url = firestoreDocumentUrl_('teamSubmissions/' + profile.submissionId);
  const existing = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()},
    muteHttpExceptions: true
  });
  if (existing.getResponseCode() === 200) return false;
  if (existing.getResponseCode() !== 404) throw new Error('Firestore lookup failed: ' + existing.getContentText());
  const fields = Object.fromEntries(Object.entries(profile).map(([key, value]) => [key, firestoreValue_(value)]));
  const response = UrlFetchApp.fetch(url, {
    method: 'patch', contentType: 'application/json',
    headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()},
    payload: JSON.stringify({fields}), muteHttpExceptions: true
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Firestore submission sync failed: ' + response.getContentText());
  }
  return true;
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

function appendAudit_(ss, action, id, member, actor) {
  ss.getSheetByName('Audit Log').appendRow([new Date(),action,id,member,actor||Session.getEffectiveUser().getEmail()||'system']);
}
