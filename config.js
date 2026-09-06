/* Deployment settings for the Bench Stock site.
   API_URL is the /exec URL of the Apps Script web app. It is not a secret —
   anything served to a browser is public — which is exactly why the script
   refuses every request that does not carry a valid token. */
var CJ_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbyC2-0r6vfV7pylr0yVHKLIwiFm8OFJMqAVVWbFJM-OwGdWgFXMuC9W3uBZRAO2N8fh/exec',
  // What a scanned QR label opens. Leave as-is to use whatever address the
  // site is being served from, so labels keep working if the domain changes.
  LABEL_BASE: location.origin + location.pathname.replace(/[^/]*$/, '')
};
