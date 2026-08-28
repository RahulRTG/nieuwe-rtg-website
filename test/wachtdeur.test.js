/* ============================================================================
   DE WACHT AAN DE VOORDEUR -- DE DRAAD, NIET DE MOTOR.

   WAAROM DEZE TOETS ER IS. Bij het opknippen van server.js verhuisde de
   voordeurketen naar server/opzet/. Om te controleren of dat werkelijk niets
   brak, heb ik de draad tussen De Wacht en de voordeur DOORGEKNIPT
   (zetWacht een lege functie gemaakt) en de hele toetsenkast gedraaid. Er ging
   niets rood.

   Dat is een gat, en geen klein gat. test/wacht.test.js toetst De Wacht als
   losse motor tot in de hoeken: quarantaine, de raadkamer, de lastafworp bij
   een L7-piek, het doven na de afkoeltijd. Allemaal groen -- terwijl de motor
   los van het stuur stond. In die stand:

     1. snijdt "isoleer deze indringer" niemand af. Het schild vraagt De Wacht
        naar de quarantaine; is de draad los, dan is het antwoord altijd nee.
     2. gebeurt er bij de automatische lastafworp niets. De 503 "kom zo terug"
        wordt nooit gegeven en de piek loopt gewoon door tot het omvalt.

   Beide beloften staan zwart op wit in de code, en geen van beide werd
   nagerekend. Dit bestand rekent ze na, over een echte HTTP-verbinding, met
   twee mensen (de eigenaar bedient, een bezoeker ondervindt) en met een echt
   afzenderadres via X-Forwarded-For -- want vanaf 127.0.0.1 slaat de voordeur
   deze twee reflexen bewust over.

   Draai los: node --test test/wachtdeur.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wachtdeur-'));
/* Een adres uit het documentatiebereik (RFC 5737): nooit van iemand, en
   overduidelijk niet lokaal -- precies wat deze toets nodig heeft. */
const INDRINGER = '203.0.113.77';
const ANDER = '198.51.100.4';

let srv, base, eigenaar;

const json = async (r) => {
  const t = await r.text();
  try { return { status: r.status, body: JSON.parse(t), tekst: t }; }
  catch (e) { return { status: r.status, body: {}, tekst: t }; }
};
const post = (pad, body, token, ip) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
    ...(ip ? { 'X-Forwarded-For': ip } : {}) },
  body: JSON.stringify(body || {})
}).then(json);
const haal = (pad, ip) => fetch(base + pad, { headers: ip ? { 'X-Forwarded-For': ip } : {} }).then(json);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_OWNER_EMAIL: '' } });
  base = srv.base;
  const o = await post('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' });
  assert.ok(o.body.token, 'de eigenaar kan inloggen: ' + o.tekst.slice(0, 200));
  eigenaar = o.body.token;
});

test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('1. wie De Wacht afsnijdt, komt de voordeur niet meer door -- en zijn buurman wel', async () => {
  // eerst de nulmeting: allebei mogen erin. Zonder dit bewijst stap 3 niets --
  // een adres dat er sowieso al niet in kwam, zegt niets over het afsnijden.
  assert.equal((await haal('/api/health', INDRINGER)).status, 200, 'vooraf komt de indringer er gewoon in');
  assert.equal((await haal('/api/health', ANDER)).status, 200, 'en de buurman ook');

  const r = await post('/api/techniek/wacht/quarantaine',
    { bron: INDRINGER, actie: 'isoleer', reden: 'toets: de draad naar de voordeur' }, eigenaar);
  assert.equal(r.status, 200, 'de eigenaar kan afsnijden: ' + r.tekst.slice(0, 200));
  assert.ok((r.body.bord && r.body.bord.quarantaine || []).some(q => q.bron === INDRINGER),
    'en De Wacht heeft hem ook echt genoteerd: ' + r.tekst.slice(0, 300));

  /* Nu de draad zelf. Het schild vraagt bij ELK verzoek aan De Wacht of deze
     bron in quarantaine zit; zo ja, dan komt hij er niet meer door. Wat de
     precieze code is (403 of 429) laat deze toets vrij -- dat is een keuze van
     het schild. Wat vaststaat is dat het GEEN 200 meer is. */
  const na = await haal('/api/health', INDRINGER);
  assert.notEqual(na.status, 200,
    'de afgesneden bron komt er niet meer in, maar kreeg ' + na.status);

  // en de buurman merkt er niets van: afsnijden is gericht, geen deur op slot
  assert.equal((await haal('/api/health', ANDER)).status, 200, 'de buurman komt er nog gewoon in');

  // vrijgeven laat hem weer toe -- anders is "tijdgebonden" een loze belofte
  const vrij = await post('/api/techniek/wacht/quarantaine', { bron: INDRINGER, actie: 'vrij' }, eigenaar);
  assert.equal(vrij.status, 200, 'vrijgeven lukt: ' + vrij.tekst.slice(0, 200));
  assert.equal((await haal('/api/health', INDRINGER)).status, 200, 'en dan komt hij er weer in');
});

test('2. de lastafworp geeft 503 met een Retry-After, en laat de loopback met rust', async () => {
  const aan = await post('/api/techniek/wacht/lastafworp', { aan: true }, eigenaar);
  assert.equal(aan.status, 200, 'de eigenaar kan de zekering dichtgooien: ' + aan.tekst.slice(0, 200));

  const r = await fetch(base + '/api/health', { headers: { 'X-Forwarded-For': ANDER } });
  assert.equal(r.status, 503, 'een bezoeker van buiten krijgt 503 zolang de zekering dicht staat');
  assert.equal(r.headers.get('retry-after'), '30', 'met een Retry-After, zodat een client weet wanneer hij terug mag');
  assert.match(await r.text(), /kier|drukte/i, 'en een zin die uitlegt wat er aan de hand is');

  /* De loopback moet er WEL doorheen. Daar zitten de gezondheidsprikken van de
     poortwachter (server/trio.js) op; zou de lastafworp die ook treffen, dan
     concludeert de poortwachter dat alle servers dood zijn en gooit hij het
     hele huis dicht op precies het moment dat het druk is. */
  assert.equal((await fetch(base + '/api/health')).status, 200,
    'de gezondheidsprik van de poortwachter gaat er wel doorheen');

  const uit = await post('/api/techniek/wacht/lastafworp', { aan: false }, eigenaar);
  assert.equal(uit.status, 200, 'de zekering kan weer open: ' + uit.tekst.slice(0, 200));
  assert.equal((await haal('/api/health', ANDER)).status, 200, 'en dan mag iedereen weer binnen');
});
