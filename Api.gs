/**
 * C&J Aviation - Bench Stock JSON API
 * =====================================================================
 * ADD THIS AS A NEW FILE in the Benchstock Apps Script project.
 * Do NOT paste it over Code.gs. Nothing in Code.gs changes; this file
 * only adds doPost() and a few api_-prefixed helpers alongside it, so
 * the existing phone web app keeps working exactly as it does today.
 *
 * FIRST-TIME SETUP (once, from the Apps Script editor):
 *   1. Run apiSetup() and follow the prompt in the execution log.
 *      It writes APP_PIN and a random APP_TOKEN into Script Properties.
 *      Neither ever appears in this file or in the GitHub repo.
 *   2. Deploy > New deployment > Web app
 *        Execute as:      Me
 *        Who has access:  Anyone
 *      "Anyone" is required for the static site to call it at all -
 *      a login-required deployment redirects to Google sign-in and the
 *      browser blocks it. The token below is what actually guards it.
 *   3. Copy the /exec URL into config.js in the benchstock repo.
 *
 * TO CHANGE THE PIN:      run apiSetPin('newpin')
 * TO LOG EVERY PHONE OUT: run apiRotateToken()
 */

var API_PROPS       = PropertiesService.getScriptProperties();
var API_LOG_SHEET   = 'Web Log';
var API_LOG_MAX     = 5000;   // trimmed from the top once it passes this

/**
 * Every action the web site is allowed to ask for, mapped to the function
 * in Code.gs that does the work. A caller cannot name a function directly -
 * anything not on this list is refused. That is what keeps an open endpoint
 * from becoming a way into the rest of the account.
 */
function apiActions_(){
  return {
    getParts:       { fn: getParts,       write: false },
    getVersion:     { fn: getVersion,     write: false },
    getYearEnd:     { fn: getYearEnd,     write: false },
    getImages:      { fn: getImages,      write: false },
    getFullImage:   { fn: getFullImage,   write: false },
    logTransaction: { fn: logTransaction, write: true  },
    addPart:        { fn: addPart,        write: true  },
    updatePart:     { fn: updatePart,     write: true  },
    deletePart:     { fn: deletePart,     write: true  },
    saveImage:      { fn: saveImage,      write: true  },
    deleteImage:    { fn: deleteImage,    write: true  }
  };
}

/** The only entry point. GET is deliberately not handled here - Code.gs
 *  owns doGet for the existing phone app, and a GET must never change
 *  data anyway (link previews and crawlers fire them unprompted). */
function doPost(e){
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err){ return apiOut_({ ok:false, error:'Bad request' }); }

  var action = String(body.action || '');
  var args   = body.args || [];

  // Unlocking a device is the one thing that does not need a token.
  if (action === 'auth'){
    var pin = String((args && args[0]) || '');
    var good = API_PROPS.getProperty('APP_PIN');
    if (good && pin && pin === good){
      apiLog_('auth', 'device unlocked', true);
      return apiOut_({ ok:true, data:{ token: apiToken_() } });
    }
    apiLog_('auth', 'bad PIN', false);
    return apiOut_({ ok:false, error:'PIN not accepted' });
  }

  if (String(body.token || '') !== apiToken_()){
    return apiOut_({ ok:false, error:'Not authorised', code:'AUTH' });
  }

  var entry = apiActions_()[action];
  if (!entry) return apiOut_({ ok:false, error:'Unknown action' });

  try {
    var data = entry.fn.apply(null, args);
    if (entry.write) apiLog_(action, apiSummarise_(args), true);
    return apiOut_({ ok:true, data: data === undefined ? null : data });
  } catch (err){
    if (entry.write) apiLog_(action, apiSummarise_(args) + ' | FAILED: ' + err, false);
    return apiOut_({ ok:false, error: String(err && err.message || err) });
  }
}

function apiOut_(obj){
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function apiToken_(){
  var t = API_PROPS.getProperty('APP_TOKEN');
  if (!t){ t = apiRandom_(); API_PROPS.setProperty('APP_TOKEN', t); }
  return t;
}

function apiRandom_(){
  var chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var out = '';
  for (var i = 0; i < 40; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

/** Keeps photo payloads and other bulk out of the log. */
function apiSummarise_(args){
  try {
    return JSON.stringify(args, function(k, v){
      if (typeof v === 'string' && v.length > 60) return v.slice(0, 40) + '...(' + v.length + ' chars)';
      return v;
    }).slice(0, 400);
  } catch (e){ return '(unloggable)'; }
}

/** Append-only record of every write that came in from the web site. */
function apiLog_(action, detail, ok){
  try {
    var ss = SpreadsheetApp.getActive();
    var sh = ss.getSheetByName(API_LOG_SHEET);
    if (!sh){
      sh = ss.insertSheet(API_LOG_SHEET);
      sh.appendRow(['When', 'Action', 'Result', 'Detail']);
      sh.setFrozenRows(1);
      sh.hideSheet();
    }
    sh.appendRow([new Date(), action, ok ? 'ok' : 'refused', detail]);
    var n = sh.getLastRow();
    if (n > API_LOG_MAX) sh.deleteRows(2, n - API_LOG_MAX);
  } catch (e){ /* logging must never break a write */ }
}

/* ---- One-time setup helpers, run from the editor ---------------------- */

function apiSetup(){
  var pin = API_PROPS.getProperty('APP_PIN');
  if (!pin){
    pin = String(Math.floor(1000 + Math.random() * 9000));
    API_PROPS.setProperty('APP_PIN', pin);
  }
  var tok = apiToken_();
  Logger.log('Shop PIN ..........: ' + pin);
  Logger.log('Token (do not share): ' + tok.slice(0, 6) + '...' + tok.slice(-4));
  Logger.log('');
  Logger.log('Give the PIN to the mechanics. Change it with apiSetPin("1234").');
  Logger.log('Next: Deploy > New deployment > Web app, execute as Me, access Anyone.');
  return 'PIN is ' + pin;
}

function apiSetPin(newPin){
  newPin = String(newPin || '').trim();
  if (newPin.length < 4) throw new Error('Use at least 4 characters');
  API_PROPS.setProperty('APP_PIN', newPin);
  apiLog_('setPin', 'PIN changed', true);
  return 'PIN updated';
}

/** Invalidates the token on every phone. Everyone re-enters the PIN once. */
function apiRotateToken(){
  API_PROPS.setProperty('APP_TOKEN', apiRandom_());
  apiLog_('rotateToken', 'all devices signed out', true);
  return 'Token rotated - every device must re-enter the PIN';
}

/* ---- Nightly backup ---------------------------------------------------
   Keeps 14 dated copies of the whole spreadsheet in a Backups folder next
   to it. Cheap insurance: a bad write is then a restore, not a rebuild.
   Run installApiBackupTrigger() once to schedule it. */

function apiNightlyBackup(){
  var ss   = SpreadsheetApp.getActive();
  var file = DriveApp.getFileById(ss.getId());
  var parent = file.getParents().hasNext() ? file.getParents().next() : DriveApp.getRootFolder();

  var folders = parent.getFoldersByName('Benchstock Backups');
  var folder  = folders.hasNext() ? folders.next() : parent.createFolder('Benchstock Backups');

  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var name  = 'Benchstock backup ' + stamp;

  var existing = folder.getFilesByName(name);
  if (existing.hasNext()) return 'Already backed up today';

  file.makeCopy(name, folder);

  // Keep the folder from growing forever: drop anything past 14 copies.
  var all = [], it = folder.getFiles();
  while (it.hasNext()) all.push(it.next());
  all.sort(function(a, b){ return b.getDateCreated() - a.getDateCreated(); });
  for (var i = 14; i < all.length; i++) all[i].setTrashed(true);

  return 'Backed up ' + name;
}

function installApiBackupTrigger(){
  removeApiBackupTrigger();
  ScriptApp.newTrigger('apiNightlyBackup').timeBased().atHour(2).everyDays(1).create();
  return 'Nightly backup scheduled for ~2am ' + Session.getScriptTimeZone();
}

function removeApiBackupTrigger(){
  ScriptApp.getProjectTriggers().forEach(function(t){
    if (t.getHandlerFunction() === 'apiNightlyBackup') ScriptApp.deleteTrigger(t);
  });
  return 'Removed';
}
