/** Run createTeamProfileForm once from script.google.com. */
function createTeamProfileForm() {
  const form = FormApp.create('FYI Club Team Profile Update');
  form.setDescription('Submit your details to update your profile on the FYI Club website. Updates will be reviewed before appearing. Your email will remain private.');
  form.setConfirmationMessage('Thank you. Your profile update has been submitted for review. It will appear on the website after approval.');
  form.setCollectEmail(true);
  form.setLimitOneResponsePerUser(true);
  const responseSheet = SpreadsheetApp.create('FYI Club Team Profile Responses');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, responseSheet.getId());

  const textValidation = (max) => FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(max).build();
  const name = form.addTextItem().setTitle('Full name').setRequired(true).setValidation(textValidation(100));
  const emailValidation = FormApp.createTextValidation().requireTextIsEmail().build();
  form.addTextItem().setTitle('VIT Bhopal email (will be private)').setRequired(true).setValidation(emailValidation);
  const position = form.addMultipleChoiceItem().setTitle('Position').setRequired(true);

  const teamPage = form.addPageBreakItem().setTitle('Team position');
  form.addListItem().setTitle('Department / Team').setChoiceValues([
    'Technical Team', 'Design & Content Team', 'Event Management Team',
    'Photography Team', 'PR & Outreach Team', 'Social Media Team'
  ]).setRequired(true);

  const profile = form.addPageBreakItem().setTitle('Public profile details and consent');
  form.addTextItem().setTitle('Specialty').setHelpText('A short description of what you work on. Maximum 150 characters.').setRequired(true).setValidation(textValidation(150));
  form.addTextItem().setTitle('Quote for your profile').setRequired(false).setValidation(textValidation(250));
  form.addTextItem().setTitle('Public handle').setHelpText('Optional. Example: @aarav_lead').setRequired(false).setValidation(textValidation(30));
  form.addTextItem().setTitle('Instagram profile').setHelpText('Optional public username or profile URL.').setRequired(false);
  form.addTextItem().setTitle('GitHub profile').setRequired(false);
  form.addTextItem().setTitle('LinkedIn profile').setRequired(true);
  form.addCheckboxItem().setTitle('Consent to use submitted information').setChoiceValues([
    'I authorize FYI Club to store the details I submitted for profile review.',
    'I consent to my approved profile details and public social links being displayed on the FYI Club website.',
    'If I upload a photo, I confirm I have permission to submit it and agree it may be stored, compressed or cropped, and displayed with my approved profile.'
  ]).setRequired(true).setValidation(FormApp.createCheckboxValidation().requireSelectExactly(3).build());

  // The first four office positions bypass Department / Team. Leads, Co-Leads,
  // and Core Members answer it, then both paths continue to profile details.
  teamPage.setGoToPage(profile);
  position.setChoices([
    position.createChoice('President', profile),
    position.createChoice('Vice President', profile),
    position.createChoice('Secretary', profile),
    position.createChoice('Student Coordinator', profile),
    position.createChoice('Lead', teamPage),
    position.createChoice('Co-Lead', teamPage),
    position.createChoice('Core Member', teamPage)
  ]);
  PropertiesService.getScriptProperties().setProperty('TEAM_FORM_ID', form.getId());
  installFormSubmitTrigger_(form);
  // The script cannot create a Google Forms file-upload question. Add it in
  // the editor to the profile section after running this setup.
  Logger.log('Edit URL: ' + form.getEditUrl());
  Logger.log('Responder URL: ' + form.getPublishedUrl());
  Logger.log('Response Sheet: ' + responseSheet.getUrl());
  Logger.log('Add the required File upload question manually in the final section. Name it exactly: Profile photo.');
}

/** For a form you already created manually: set TEAM_FORM_ID in Script Properties, then run this. */
function installTriggerOnExistingTeamForm() {
  const formId = PropertiesService.getScriptProperties().getProperty('TEAM_FORM_ID');
  if (!formId) throw new Error('Set TEAM_FORM_ID in Script Properties first.');
  installFormSubmitTrigger_(FormApp.openById(formId));
}

function installFormSubmitTrigger_(form) {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === 'onTeamProfileSubmit')
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('onTeamProfileSubmit').forForm(form).onFormSubmit().create();
}

/** Installable Google Form submit trigger. */
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
  if (queue.getLastRow() > 1) {
    const existingEmails = queue.getRange(2, 3, queue.getLastRow() - 1, 1).getDisplayValues().flat().map(value => value.trim().toLowerCase());
    if (existingEmails.includes(verifiedEmail)) return;
  }
  queue.appendRow([new Date(submittedAt), responseId, verifiedEmail, String(answer('Full name') || ''), position, team,
    String(answer('Specialty') || ''), String(answer('Quote for your profile') || ''), String(answer('Public handle') || ''),
    String(answer('Instagram profile') || ''), String(answer('GitHub profile') || ''), String(answer('LinkedIn profile') || ''),
    fileId, 'Pending', '', '', '']);
  appendAudit_(ss, 'submission_received', responseId, verifiedEmail);
}

function initializeFreeAdminQueue() {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty('TEAM_ADMIN_SHEET_ID');
  const ss = existingId ? SpreadsheetApp.openById(existingId) : SpreadsheetApp.create('FYI Team Profile Admin Queue');
  let queue = ss.getSheetByName('Submissions');
  if (!queue) queue = ss.getSheets()[0].setName('Submissions');
  if (queue.getLastRow() === 0) queue.appendRow(['Submitted At','Response ID','Private Email','Full Name','Position','Department / Team','Specialty','Quote','Handle','Instagram','GitHub','LinkedIn','Photo Drive ID','Status (set Approved/Rejected)','Reviewed At','Reviewed By','Sync Error']);
  let audit = ss.getSheetByName('Audit Log');
  if (!audit) audit = ss.insertSheet('Audit Log');
  if (audit.getLastRow() === 0) audit.appendRow(['Time','Action','Response ID','Member','Actor']);
  props.setProperty('TEAM_ADMIN_SHEET_ID', ss.getId());
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'onTeamProfileSubmit').forEach(t => ScriptApp.deleteTrigger(t));
  const form = FormApp.openById(PropertiesService.getScriptProperties().getProperty('TEAM_FORM_ID'));
  const responseSheetId = form.getDestinationId();
  if (!responseSheetId) throw new Error('Link the Google Form to its response spreadsheet first.');
  ScriptApp.newTrigger('onTeamProfileSubmit').forSpreadsheet(responseSheetId).onFormSubmit().create();
  Logger.log('Private admin queue: ' + ss.getUrl());
  Logger.log('Form response spreadsheet: ' + SpreadsheetApp.openById(responseSheetId).getUrl());
}

/** One-time backfill for submissions already present in the linked Form response spreadsheet. */
function syncExistingResponseRows() {
  const formId = PropertiesService.getScriptProperties().getProperty('TEAM_FORM_ID');
  if (!formId) throw new Error('Set TEAM_FORM_ID in Script Properties first.');
  const form = FormApp.openById(formId);
  const responseSheetId = form.getDestinationId();
  if (!responseSheetId) throw new Error('Link the Google Form to its response spreadsheet first.');
  const responseTab = SpreadsheetApp.openById(responseSheetId).getSheets()[0];
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
    const before = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('TEAM_ADMIN_SHEET_ID')).getSheetByName('Submissions').getLastRow();
    try {
      onTeamProfileSubmit({ namedValues, values });
      const after = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('TEAM_ADMIN_SHEET_ID')).getSheetByName('Submissions').getLastRow();
      if (after > before) imported++;
      else skippedOrFailed++;
    } catch (err) {
      skippedOrFailed++;
      Logger.log('Skipped response row ' + (rowIndex + 1) + ': ' + err);
    }
  }
  Logger.log('Backfill complete. Imported: ' + imported + '; skipped/failed: ' + skippedOrFailed);
}

function onEditTeamQueue(e) {
  if (!e || e.range.getSheet().getName() !== 'Submissions' || e.range.getColumn() !== 14 || e.range.getRow() < 2) return;
  const sheet = e.range.getSheet();
  const row = e.range.getRow();
  const status = String(e.value || '').trim();
  if (!['Approved','Rejected'].includes(status)) return;
  const ss = sheet.getParent();
  const values = sheet.getRange(row, 1, 1, 17).getValues()[0];
  const actor = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || 'admin';
  try {
    if (status === 'Approved') publishProfile_(values);
    sheet.getRange(row, 15, 1, 3).setValues([[new Date(), actor, '']]);
    appendAudit_(ss, status.toLowerCase(), values[1], values[3], actor);
  } catch (err) {
    sheet.getRange(row, 15, 1, 3).setValues([[new Date(), actor, String(err).slice(0, 500)]]);
    appendAudit_(ss, 'sync_failed', values[1], String(err).slice(0, 250), actor);
  }
}

function publishProfile_(r) {
  const [submittedAt,responseId,email,name,position,team,specialty,quote,handle,instagram,github,linkedin,photoId] = r;
  const exec = ['President','Vice President','Secretary','Student Coordinator'].includes(position);
  const teams = {'Photography Team':'Photography','PR & Outreach Team':'PR & Outreach','Social Media Team':'Social Media','Design & Content Team':'Design & Content','Event Management Team':'Event Management'};
  const department = exec ? 'Executive Council' : (teams[team] || team);
  const photo = DriveApp.getFileById(photoId);
  photo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const photoUrl = 'https://drive.google.com/uc?export=view&id=' + photoId;
  const id = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(email).toLowerCase()).map(b => ('0'+((b+256)%256).toString(16)).slice(-2)).join('');
  const publicProfile = {name,position,department,team:exec?'':department,displayGroup:(exec||position==='Lead'||position==='Co-Lead')?'Executive Council':department,
    specialty,quote,handle,socialLinks:{instagram,github,linkedin},photoUrl,isPublished:true};
  const fields = Object.fromEntries(Object.entries(publicProfile).map(([k,v]) => [k, firestoreValue_(v)]));
  const url = 'https://firestore.googleapis.com/v1/projects/fyiclubvitbpl/databases/(default)/documents/teamMembers/'+id;
  const res = UrlFetchApp.fetch(url,{method:'patch',contentType:'application/json',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},payload:JSON.stringify({fields}),muteHttpExceptions:true});
  if (res.getResponseCode()<200||res.getResponseCode()>=300) throw new Error('Firestore sync failed: '+res.getContentText());
}

function firestoreValue_(v) {
  if (typeof v==='boolean') return {booleanValue:v};
  if (typeof v==='object'&&v!==null) return {mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,firestoreValue_(x)]))}};
  return {stringValue:String(v==null?'':v)};
}

function appendAudit_(ss, action, id, member, actor) {
  ss.getSheetByName('Audit Log').appendRow([new Date(),action,id,member,actor||Session.getEffectiveUser().getEmail()||'system']);
}

function installQueueEditTrigger() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'onEditTeamQueue').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('onEditTeamQueue').forSpreadsheet(PropertiesService.getScriptProperties().getProperty('TEAM_ADMIN_SHEET_ID')).onEdit().create();
}
