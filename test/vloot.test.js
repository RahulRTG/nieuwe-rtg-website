/* Integratietests voor de foutisolatie: elke app draait als eigen proces in de
   vloot (server/vloot.js) achter de poortwachter. Een bug in een route raakt
   alleen die ene aanvraag; een crash van een groep raakt alleen dat domein en
   wordt automatisch hersteld, terwijl de andere apps gewoon doordraaien.
   Draai los: node --test test/vloot.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const POORT = 4200 + Math.floor(Math.random() * 60);  // de gateway
const BASIS = POORT + 100;                            // groepspoorten: leden, kantoor, rtf
const BASE = 'http://127.0.0.1:' + POORT;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vloot-'));
let vloot;

function post(pad, body, poort) {
  return fetch('http://127.0.0.1:' + (poort || POORT) + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
}
async function wachtTot(fn, ms = 20000) {
  const tot = Date.now() + ms;
  while (Date.now() < tot) {
    try { if (await fn()) return true; } catch (e) {}
    await new Promise(r => setTimeout(r, 250));
  }
  return false;
}

/* HOE LANG EEN SERVERPROCES MAG DOEN OVER OPKOMEN.

   Deze toets start er VIER tegelijk: de poortwachter en drie groepen, elk een
   volledige RTG-server. Daar stond dertig seconden voor, en op een CI-runner met
   dekkingsmeting erbij is dat te krap: op 18 augustus 2026 zakte de before-hook
   op 29,99 s, zonder een enkele foutregel van de vloot. Geen crash dus, alleen
   een klok die eerder klaar was dan vier opstarten.

   Het staat hier als naam en niet als getal per regel, want elders in dit
   bestand wordt op hetzelfde gewacht (een groep die na een crash vanzelf
   terugkomt). Twee getallen voor dezelfde vraag lopen uiteen (LAT-regel 4).
   Een poll kost niets; een vloot die er echt niet komt zakt straks net zo
   hard, alleen later. */
const OPKOMST = 120000;

test.before(async () => {
  vloot = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'vloot.js')], {
    env: {
      ...process.env, NODE_ENV: 'test', RTG_DEMO: '1', RTG_DATA_DIR: TMP, SMTP_URL: '',
      RTG_POORT: String(POORT), RTG_VLOOT_BASIS: String(BASIS),
      RTG_VLOOT_GROEPEN: 'leden:auth,member,social,zakelijk|kantoor:office,techniek|rtf:-'
    },
    stdio: ['ignore', 'ignore', 'inherit']
  });
  /* Alle drie de groepen en de gateway moeten opkomen -- en als er een NIET
     komt, hoort de melding te zeggen welke. "de vloot komt op" was met vier
     processen precies zoveel waard als geen melding: je weet dat er iets stil
     bleef en niet wat. */
  const stand = { leden: 'nooit geantwoord', kantoor: 'nooit geantwoord', rtf: 'nooit geantwoord' };
  const probeer = async (naam, doe) => {
    try { const r = await doe(); stand[naam] = r.status; return r.ok; }
    catch (e) { stand[naam] = String(e.code || e.message || e).slice(0, 60); return false; }
  };
  const klaar = await wachtTot(async () => {
    const a = await probeer('leden', () => fetch(BASE + '/api/health'));
    const b = await probeer('kantoor', () => post('/api/office/login', { code: 'RTG-OFFICE' }));
    const c = await probeer('rtf', () => fetch(BASE + '/api/foundation/health'));
    return a && b && c;
  }, OPKOMST);
  assert.ok(klaar, 'de vloot (3 groepen + poortwachter) komt op binnen ' +
    Math.round(OPKOMST / 1000) + 's; laatste stand per groep: ' + JSON.stringify(stand));
});
test.after(() => {
  if (vloot) try { vloot.kill('SIGTERM'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een bug in een route geeft die ene aanvraag 500; het proces leeft door', async () => {
  // de opzettelijke async-bug (alleen in NODE_ENV=test aanwezig)
  const r = await post('/api/test/bug', {}, BASIS); // rechtstreeks op de leden-groep
  assert.equal(r.status, 500, 'de kapotte route geeft netjes 500');
  assert.ok((await r.json()).error, 'met een nette foutmelding');
  // en hetzelfde proces beantwoordt de volgende aanvraag gewoon
  assert.equal((await post('/api/login', { tier: 'rtg', pasApp: 'rtg' })).status, 200, 'de leden-app doet het nog');
});

test('crasht de kantoor-groep, dan valt ALLEEN kantoor uit; de rest draait door', async () => {
  // laat het kantoor-proces echt sterven (rechtstreeks op zijn eigen poort)
  await post('/api/test/crash', {}, BASIS + 1).catch(() => {});
  /* GEEN 400 ms MEER. Wat hier moest gebeuren -- het kantoorproces valt om en de
     gateway merkt dat -- wordt hieronder al afgewacht met wachtTot(), die tot
     twintig seconden lang opnieuw vraagt. De 400 ms ervoor maakten de toets
     alleen trager; op een drukke machine waren ze bovendien te kort en dan zou
     de eerste meting een nog levend proces zien. */

  // kantoor is nu (even) onbereikbaar via de gateway: 502, geen hangende aanvraag
  const kantoorPlat = await wachtTot(async () =>
    (await post('/api/office/login', { code: 'RTG-OFFICE' })).status === 502, 5000);
  assert.ok(kantoorPlat, 'de gateway geeft 502 voor alleen het kantoor-domein');

  // de andere apps merken er NIETS van
  assert.equal((await post('/api/login', { tier: 'business', pasApp: 'business' })).status, 200, 'leden draait door');
  assert.equal((await fetch(BASE + '/api/foundation/health')).status, 200, 'de foundation draait door');

  // de vloot herstart de groep vanzelf; daarna doet kantoor het weer
  /* Ook dit is een server die opkomt, dus dezelfde grens als hierboven. */
  const terug = await wachtTot(async () =>
    (await post('/api/office/login', { code: 'RTG-OFFICE' })).status === 200, OPKOMST);
  assert.ok(terug, 'de kantoor-groep is automatisch herstart en werkt weer');
});
