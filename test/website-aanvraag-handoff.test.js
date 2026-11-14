/* De publieke website geeft een aanvraag browser-tot-browser door aan de app.
   Deze toets bewaakt de privacygrens en de enige ontvangende route: het fragment
   mag niet in serverlogs belanden en pas na inloggen mag Service hem aannemen. */
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

test('de ingelogde app verwerkt de aanvraag als interne Servicezaak en wist hem pas daarna', () => {
  const login = lees('app-main-03.js') + lees('app-main-04.js');
  const chat = lees('app-main-51.js');
  assert.equal((login.match(/await verwerkWebsiteAanvraag\(\)/g) || []).length, 2,
    'zowel vers inloggen als een herstelde sessie verwerkt de overdracht');
  const sturen = chat.indexOf("API.call('/service/open'");
  const mens = chat.indexOf("API.call('/service/mens'");
  const wissen = chat.indexOf("history.replaceState(null, '', location.pathname + location.search)");
  assert.ok(sturen >= 0, 'de interne Service-route ontvangt de aanvraag');
  assert.ok(mens > sturen, 'de aanvraag vraagt daarna expliciet om een medewerker');
  assert.ok(wissen > mens, 'het fragment verdwijnt pas nadat de mensroute is aangeroepen');
  assert.doesNotMatch(chat, /'Naam: '|\+'E-mail: '|\+'Telefoon: '/,
    'identiteitsvelden worden niet in de zaaktekst gedupliceerd');
  assert.doesNotMatch(chat, /WhatsApp|wa\.me/i);
});

test('RTG Direct bevat alleen een onderwerp en opent na aanmelden de Service-lijn', () => {
  const adres = lees('app-main-02.js');
  const chat = lees('app-main-51.js');
  assert.match(adres, /get\('rtg-direct'\)/);
  assert.match(adres, /\['algemeen', 'passen', 'organisatie', 'techniek'\]/);
  assert.match(chat, /rechtstreeks naar een RTG-medewerker/);
  assert.match(chat, /\/service\/open/);
  assert.match(chat, /\/service\/mens/);
});
