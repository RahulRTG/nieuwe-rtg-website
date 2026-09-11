/* HET CARRIERE LEDGER OVER HTTP -- drie partijen aan dezelfde regel.

   test/carriereledger.test.js beproeft het BESLUIT zonder server. Deze suite gaat
   over wat je daar niet kunt zien: dat de drie partijen elkaars werk niet kunnen
   doen, en dat de deelcode werkt voor iemand ZONDER account.

   WAT HIER VASTLIGT, en waarom elk stuk nodig is:

   1. HET LID BEVESTIGT ZICHZELF NIET. Er is geen ledenroute die `gezien` of
      `bevestigd` kan zetten -- die herkomsten komen alleen van een andere deur.
      Zonder die scheiding betekent `gezien` niets.
   2. HET KANTOOR LEEST GEEN LEDGERS. Er is met opzet geen route die het ledger
      van een mens opent; bevestigen gaat over EEN regel waarvan het lid het
      nummer aanlevert. "Alles over deze mens" stelt HDI.md par. 5.1 buiten de orde.
   3. EEN ZAAK KAN NIET ZOEKEN. Zelfde reden, andere kant: anders bouwt een club
      een dossier op over iedereen die ooit bij haar speelde.
   4. DE DEELCODE WERKT ZONDER ACCOUNT. Dat is de hele functie -- en hij toont EEN
      feit, met het voorbehoud eromheen.
   5. EEN ZAAK NEEMT HAAR EIGEN WOORD TERUG, en niet dat van een ander.

   Draai los: node --test test/carriereledger.e2e.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, kantoorAlsPersoon, keurLidGoed } = require('./helper');

let BASE, child, lid, lidCode, ander, anderCode, office, zaak;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ledger-'));
const GISTEREN = '2025-06-14';

const post = (pad, body, tok) => fetch(BASE + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const codeVan = async (tok) => (await post('/api/state', {}, tok)).body.state.user.codename;
const zetFeit = (tok, extra) => post('/api/carriere/ledger/zet',
  Object.assign({ kapitaal: 'vermogen', wat: 'Nederlands kampioen junior', op: GISTEREN }, extra || {}), tok);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  lid = (await post('/api/auth/register', { name: 'Talent Een', email: 'led1@x.nl',
    phone: '0612347001', password: 'geheim12345', geboortedatum: '1998-04-04', tier: 'rtg' })).body.token;
  ander = (await post('/api/auth/register', { name: 'Talent Twee', email: 'led2@x.nl',
    phone: '0612347002', password: 'geheim12345', geboortedatum: '1997-03-03', tier: 'rtg' })).body.token;
  lidCode = await codeVan(lid);
  anderCode = await codeVan(ander);
  await keurLidGoed(BASE, lid, lidCode, '1998-04-04');
  office = await kantoorAlsPersoon(BASE, 'RTG-OFFICE');
  zaak = (await post('/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. zonder account komt er niets in een ledger', async () => {
  assert.equal((await zetFeit(null)).status, 401);
  assert.equal((await post('/api/carriere/ledger/mijn', {}, null)).status, 401);
});

test('2. het lid schrijft in zijn eigen ledger, en de herkomst is `zelf`', async () => {
  const r = await zetFeit(lid);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  const m = await post('/api/carriere/ledger/mijn', {}, lid);
  assert.equal(m.body.feiten.length, 1);
  const f = m.body.feiten[0];
  /* Positief nagekeken en niet alleen op een lege lijst: een bewering dat er
     iets NIET is, slaagt ook wanneer er nooit iets is (scripts/tandeloos.js).
     Dus eerst vaststellen dat de projectie werkelijk iets levert. */
  assert.equal(f.wat, 'Nederlands kampioen junior');
  assert.equal(f.op, GISTEREN);
  assert.equal(f.kapitaal, 'vermogen');
  assert.equal(f.ingetrokken, false);
  assert.ok(f.id && f.at, 'een regel zonder nummer of tijdstip is niet aan te wijzen');
  assert.deepEqual(f.bevestigingen, [],
    'een verse regel heeft nul bevestigingen; dat is geen gebrek maar de waarheid');
  assert.equal(m.body.mens, lidCode, 'het ledger draait op de codenaam en niet op een naam uit de kluis');
});

test('3. het lid kan zichzelf niet bevestigen, en een ander kan dat wel', async () => {
  const f = (await post('/api/carriere/ledger/mijn', {}, lid)).body.feiten[0].id;
  /* Er bestaat geen ledenroute die een herkomst boven `zelf` zet. Dat is de hele
     grond waarop `gezien` iets betekent, dus het hoort een TOETS te zijn en geen
     afwezigheid die niemand nakijkt. */
  assert.equal((await post('/api/carriere/ledger/bevestig', { id: f, herkomst: 'gezien' }, lid)).status, 404);
  assert.deepEqual((await post('/api/carriere/ledger/mijn', {}, lid)).body.feiten[0].bevestigingen, []);

  /* EN DE POSITIEVE TEGENPROEF IN DEZELFDE TOETS. "Er kwam geen bevestiging bij"
     slaagt ook als er langs GEEN ENKELE weg ooit een bevestiging bij komt, en
     dan bewijst deze toets niets over het lid (scripts/tandeloos.js). Het
     kantoor doet het hier dus wel, op precies hetzelfde feit. */
  const r = await post('/api/office/carriere/ledger/bevestig',
    { mens: lidCode, id: f, wat: 'uitslagenlijst van de bond ingezien' }, office);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.equal((await post('/api/carriere/ledger/mijn', {}, lid)).body.feiten[0].bevestigingen.length, 1,
    'langs de kantoordeur komt er WEL een bevestiging bij; dat maakt de nul hierboven een uitspraak over het lid');
});

test('4. wat een bevestiging vaststelt reist mee, en het kantoor leest geen ledger', async () => {
  const b = (await post('/api/carriere/ledger/mijn', {}, lid)).body.feiten[0].bevestigingen[0];
  assert.equal(b.herkomst, 'gezien');
  assert.ok(b.door && b.door.length > 1, 'een bevestiging zonder naam is geen bevestiging');
  assert.match(b.nietZegt, /valideert niets inhoudelijk|belt geen bond/i,
    'wat RTG NIET vaststelt reist mee tot in het antwoord');

  /* Er is geen kantoorroute die een heel ledger opent. */
  for (const pad of ['/api/office/carriere/ledger/mijn', '/api/office/carriere/ledger/alle',
    '/api/office/carriere/ledger/lees']) {
    assert.equal((await post(pad, { mens: lidCode }, office)).status, 404,
      pad + ' bestaat; "alles over deze mens" stelt HDI.md par. 5.1 buiten de orde');
  }
});

test('5. een onbekende codenaam levert geen ledger op', async () => {
  const r = await post('/api/office/carriere/ledger/bevestig', { mens: 'Bestaat Niet', id: 'cl1' }, office);
  assert.equal(r.status, 404);
  assert.match(r.body.error, /codenaam/i);
});

test('6. een zaak bevestigt onder haar eigen naam, en kan niet zoeken', async () => {
  const f = (await post('/api/carriere/ledger/mijn', {}, lid)).body.feiten[0].id;
  const r = await post('/api/supplier/carriere/bevestig',
    { mens: lidCode, id: f, wat: 'speelde vier seizoenen bij ons' }, zaak);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  const bs = (await post('/api/carriere/ledger/mijn', {}, lid)).body.feiten[0].bevestigingen;
  assert.equal(bs.length, 2, 'twee bronnen zijn twee bevestigingen en geen hoogste');
  const zb = bs.find(x => x.herkomst === 'bevestigd');
  assert.match(zb.door, /\(/, 'de naam is die van de ZAAK met de medewerker erachter');

  /* Zonder regelnummer gebeurt er niets: een zaak kan niet door een ledger lopen. */
  assert.equal((await post('/api/supplier/carriere/bevestig', { mens: lidCode }, zaak)).status, 404);
  assert.equal((await post('/api/supplier/carriere/lijst', { mens: lidCode }, zaak)).status, 404);
});

test('7. een zaak neemt haar eigen woord terug, en niet dat van een ander', async () => {
  const bs = (await post('/api/carriere/ledger/mijn', {}, lid)).body.feiten[0].bevestigingen;
  const vanRtg = bs.find(x => x.herkomst === 'gezien');
  const vanZaak = bs.find(x => x.herkomst === 'bevestigd');

  const r = await post('/api/supplier/carriere/intrek',
    { mens: lidCode, id: vanZaak.id, reden: 'bij nader inzien een ander seizoen' }, zaak);
  assert.equal(r.status, 200);
  const na = (await post('/api/carriere/ledger/mijn', {}, lid)).body.feiten[0].bevestigingen;
  assert.equal(na.length, 2, 'intrekken wist niets; de bevestiging blijft leesbaar');
  assert.equal(na.find(x => x.id === vanZaak.id).ingetrokken, true);
  assert.equal(na.find(x => x.id === vanRtg.id).ingetrokken, false,
    'de bevestiging van RTG staat er nog; een zaak neemt alleen haar eigen woord terug');
});

test('8. een deelcode werkt zonder account en toont EEN feit', async () => {
  await zetFeit(lid, { kapitaal: 'netwerk', wat: 'iets dat niemand hoeft te zien', op: '2020-01-01' });
  const f = (await post('/api/carriere/ledger/mijn', {}, lid)).body.feiten
    .find(x => x.wat.startsWith('Nederlands')).id;
  const d = await post('/api/carriere/ledger/deel', { id: f, dagen: 30, voor: 'Sponsor X' }, lid);
  assert.equal(d.status, 200);
  assert.ok(d.body.code, 'de code gaat precies eenmaal de deur uit');

  /* ZONDER token -- dat is de hele functie. */
  const t = await post('/api/carriere/regel/toon', { code: d.body.code }, null);
  assert.equal(t.status, 200, JSON.stringify(t.body).slice(0, 200));
  assert.equal(t.body.feit.wat, 'Nederlands kampioen junior');
  assert.equal(JSON.stringify(t.body).includes('iets dat niemand'), false,
    'de ontvanger ziet een regel en niet het ledger');
  assert.ok(t.body.voorbehoud.length >= 3);
  assert.equal(t.body.feit.bevestigingen.length, 1,
    'de ingetrokken bevestiging van de zaak hoort hier niet meer bij te staan');
});

test('9. een deelcode van een ander ledger opent niets, en onzin ook niet', async () => {
  const f = (await post('/api/carriere/ledger/mijn', {}, lid)).body.feiten[0].id;
  /* Een ander lid kan geen code maken op een feit dat niet van hem is. */
  assert.equal((await post('/api/carriere/ledger/deel', { id: f }, ander)).status, 404);
  const t = await post('/api/carriere/regel/toon', { code: 'RTGCL.' + 'a'.repeat(32) }, null);
  assert.equal(t.status, 404);
  assert.ok(t.body.waarom, 'een weigering zonder reden stuurt iemand op zoek');
});

test('10. het lid stopt zijn eigen code, en niet die van een ander', async () => {
  const mijn = (await post('/api/carriere/ledger/delen', {}, lid)).body.delen;
  assert.equal(mijn.length, 1);
  assert.equal(mijn[0].gebruik >= 1, true, 'het lid ziet hoe vaak zijn bewijs is geopend');
  assert.equal((await post('/api/carriere/ledger/stopdelen', { id: mijn[0].id }, ander)).status, 404,
    'een ander lid kan een deelcode niet stoppen');
  const r = await post('/api/carriere/ledger/stopdelen', { id: mijn[0].id }, lid);
  assert.equal(r.status, 200);
  assert.match(r.body.let, /gelezen/, 'wat de ontvanger al las, halen wij niet terug -- dat hoort erbij te staan');
});

test('11. het lid trekt zijn eigen regel in, en die van een ander niet', async () => {
  /* De KERN-kant staat in test/carriereledger.test.js. Deze toets gaat over de
     route eromheen: dat hij `id` en `reden` uit het lijf haalt, dat hij de
     sleutel uit de SESSIE neemt en niet uit het verzoek, en dat een leeg veld
     hier net zo hard weigert als in de kern. */
  const mijn = (await post('/api/carriere/ledger/mijn', {}, lid)).body.feiten;
  const doel = mijn.find(x => x.wat.startsWith('iets dat niemand'));

  assert.equal((await post('/api/carriere/ledger/intrek', { id: doel.id }, lid)).status, 400,
    'zonder reden gaat een intrekking niet door');
  /* Het andere lid noemt hetzelfde nummer: de route zoekt in ZIJN ledger en
     vindt daar niets. De sleutel komt uit de sessie en nooit uit het lijf. */
  assert.equal((await post('/api/carriere/ledger/intrek',
    { id: doel.id, reden: 'ik wil dit weg hebben' }, ander)).status, 404);
  assert.equal((await post('/api/carriere/ledger/mijn', {}, lid)).body.feiten
    .find(x => x.id === doel.id).ingetrokken, false, 'en er is bij het eerste lid niets gebeurd');

  const r = await post('/api/carriere/ledger/intrek',
    { id: doel.id, reden: 'hoort niet in mijn loopbaan thuis' }, lid);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  const na = (await post('/api/carriere/ledger/mijn', {}, lid)).body.feiten;
  assert.equal(na.length, mijn.length, 'intrekken wist niets: de regel blijft in de reeks staan');
  assert.equal(na.find(x => x.id === doel.id).ingetrokken, true);
  assert.equal((await post('/api/carriere/ledger/intrek',
    { id: doel.id, reden: 'nogmaals' }, lid)).status, 409, 'een tweede keer is een toestandsfout');
});

test('12. een ander lid ziet zijn eigen, lege ledger en nooit dat van iemand anders', async () => {
  /* Eerst de tegenproef: dezelfde route levert voor het EERSTE lid wel degelijk
     regels. Zonder dat slaagt "de ander ziet niets" ook wanneer deze route
     iedereen niets laat zien (scripts/tandeloos.js). */
  const vol = await post('/api/carriere/ledger/mijn', {}, lid);
  assert.ok(vol.body.feiten.length >= 2, 'de route geeft voor dit lid wel regels terug');
  assert.ok(vol.body.voorraden.some(v => v.regels.length > 0), 'en de voorraden van dit lid zijn gevuld');

  const m = await post('/api/carriere/ledger/mijn', {}, ander);
  assert.equal(m.status, 200);
  assert.deepEqual(m.body.feiten, [], 'het ledger van een ander lid komt hier niet uit');
  assert.equal(m.body.mens, anderCode);
  assert.equal(m.body.voorraden.length, 7, 'ook een leeg ledger toont de zeven voorraden');
  assert.deepEqual(m.body.voorraden.flatMap(v => v.regels), [],
    'en de voorraden van een leeg ledger zijn ook werkelijk leeg');
});
