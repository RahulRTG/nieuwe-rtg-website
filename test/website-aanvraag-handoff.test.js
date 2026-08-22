/* De publieke website geeft een aanvraag browser-tot-browser door aan de app.
   Deze toets bewaakt de privacygrens en de enige ontvangende route: het fragment
   mag niet in serverlogs belanden en pas na inloggen mag /chat/send hem aannemen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const lees = naam => fs.readFileSync(path.join(__dirname, '..', 'public', 'apps', 'app-main', naam), 'utf8');

test('website-aanvraag blijft in het fragment en reist mee naar de eigen pas-app', () => {
  const bron = lees('app-main-02.js');
  assert.match(bron, /new URLSearchParams\(location\.hash/);
  assert.match(bron, /get\('aanvraag'\)/);
  assert.match(bron, /data\.source !== 'rtravelgroup\.store'/);
  assert.match(bron, /p\.toString\(\) \+ location\.hash/);
  assert.doesNotMatch(bron, /zoekParams\.get\('(?:name|email|phone|message|aanvraag)'\)/);
});

test('de ingelogde app verwerkt de aanvraag via haar eigen chatlijn en wist hem pas daarna', () => {
  const login = lees('app-main-03.js') + lees('app-main-04.js');
  const chat = lees('app-main-51.js');
  assert.equal((login.match(/await verwerkWebsiteAanvraag\(\)/g) || []).length, 2,
    'zowel vers inloggen als een herstelde sessie verwerkt de overdracht');
  const sturen = chat.indexOf("API.call('/chat/send'");
  const wissen = chat.indexOf("history.replaceState(null, '', location.pathname + location.search)");
  assert.ok(sturen >= 0, 'de eigen ingelogde chatroute ontvangt de aanvraag');
  assert.ok(wissen > sturen, 'het fragment verdwijnt pas nadat de route is aangeroepen');
  assert.doesNotMatch(chat, /WhatsApp|wa\.me/i);
});
