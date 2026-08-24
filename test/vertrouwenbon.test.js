/* DE TRUST RECEIPT -- laag 5 van de Trust Fabric.

   Een bon zegt waarom een handeling MOCHT. Dat is een gevaarlijker soort tekst
   dan een auditregel: "actor sterk geverifieerd, bevoegdheid geldig, impact
   binnen limiet, resultaat gereconcilieerd" leest prachtig en is grotendeels
   onwaar zodra niemand die dingen meet. Deze toetsen gaan daarom bijna allemaal
   over wat er NIET in de bon staat.

   1. Elke bewering draagt een bron; wat niet gemeten is staat in
      nietVastgesteld MET reden -- en ontbreekt dus niet stilletjes.
   2. Een zwakke opstelling levert een MAGERE bon, geen mooie. Wie de bon
      leest, ziet dat de meting ontbrak.
   2b. En een deur die opengaat op een SLEUTEL levert geen bewering over een
      verificatie -- dat geval ontbrak eerst, en een mutatie erop overleefde.
   3. Er staat geen naam in, alleen een sleutel.
   4. De keten breekt aanwijsbaar zodra iemand een bon bijstelt of wegneemt.
   5. En over HTTP: een echte vernietiging levert een bon die de hele keten
      draagt, met de bevestiging erin.

   Draai los: node --experimental-sqlite --test test/vertrouwenbon.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const BON = require('../server/kern/vertrouwen/bon');
const B = require('../server/kern/vertrouwen/blootstelling');
const V = require('../server/kern/vertrouwen/verificatie');
const S = require('../server/kern/vertrouwen/stapop');

const bloot = () => B.meet({ soort: 'tenant.vernietig', aantal: 1 }, null);
const sterk = { hoe: 'passkey', naam: 'een passkey op dit apparaat', sterkte: 'sterk',
  ouderdomMs: 120000, vers: true, apparaatNieuw: false };

test('1. elke bewering draagt een bron, en het ongemetene staat er met reden', () => {
  const b = bloot();
  const bon = BON.maak([], { soort: 'tenant.vernietig', doel: 'O-X', aantal: 1, actor: 'user-7',
    blootstelling: b, verificatie: sterk, stapop: S.beoordeel(b, sterk), bevestigd: true,
    poort: 'techAuth + eigenaarAlleen', uitgevoerd: true });

  assert.ok(bon.beweringen.length >= 4);
  for (const w of bon.beweringen)
    assert.ok(w.bron && w.bron.length > 3, 'zonder bron hoort deze regel er niet te staan: ' + w.wat);

  /* En de dingen die dit huis NIET meet, staan er als zodanig. */
  const niet = bon.nietVastgesteld.map(n => n.wat).join(' | ');
  assert.match(niet, /gereconcilieerd/, 'er is geen verzoening, dus dat wordt niet beweerd');
  assert.match(niet, /bevoegdheidsketen/, 'en laag 4 bestaat nog niet');
  for (const n of bon.nietVastgesteld) assert.ok(n.reden && n.reden.length > 20, n.wat + ' zonder reden');
});

test('2. een zwakke opstelling levert een MAGERE bon, geen mooie', () => {
  const b = bloot();
  const kaal = BON.maak([], { soort: 'tenant.vernietig', doel: 'O-X', aantal: 1, actor: 'user-7',
    blootstelling: b, verificatie: null, stapop: S.beoordeel(b, null), bevestigd: false, uitgevoerd: true });

  const gezegd = kaal.beweringen.map(w => w.wat).join(' | ');
  assert.equal(/geverifieerd met/.test(gezegd), false, 'zonder vastgelegde verificatie geen bewering erover');
  const niet = kaal.nietVastgesteld.map(n => n.wat).join(' | ');
  assert.match(niet, /sterkte van de verificatie/);
  assert.match(niet, /welke poort/, 'de aanroeper gaf geen poort mee, dus dat staat er ook');
  assert.match(niet, /tweede moment/, 'de poort achtte er een nodig en er is er geen verzilverd');

  /* De rijke bon uit toets 1 zegt MEER dan deze. Dat is de hele eigenschap: de
     bon groeit mee met wat er werkelijk is gemeten. */
  const rijk = BON.maak([], { soort: 'tenant.vernietig', doel: 'O-X', aantal: 1, actor: 'user-7',
    blootstelling: b, verificatie: sterk, stapop: S.beoordeel(b, sterk), bevestigd: true,
    poort: 'techAuth + eigenaarAlleen', uitgevoerd: true });
  assert.ok(rijk.beweringen.length > kaal.beweringen.length);
  assert.ok(rijk.nietVastgesteld.length < kaal.nietVastgesteld.length);
});

/* HET GEVAARLIJKSTE GEVAL VAN ALLEMAAL, en het ontbrak in de eerste versie van
   deze toetsen: een deur die opengaat op een sleutel. `zonderPersoon()` levert
   sterkte 'geen' -- een GEMETEN eigenschap, geen ontbrekende meting -- en een
   bon die daarvan "de actor is geverifieerd met een sleutel zonder persoon"
   maakt, kleedt precies het tegenovergestelde aan als een verificatie. Een
   mutatie die die uitzondering weghaalde, overleefde alle andere toetsen. */
test('2b. een sleutel zonder mens levert GEEN bewering over verificatie', () => {
  const b = bloot();
  const sleutel = V.zonderPersoon('een beheer-token');
  const bon = BON.maak([], { soort: 'tenant.vernietig', doel: 'O-X', aantal: 1, actor: 'W-ABC',
    blootstelling: b, verificatie: sleutel, stapop: S.beoordeel(b, sleutel), bevestigd: false,
    poort: 'beheer-token', uitgevoerd: true });

  const gezegd = bon.beweringen.map(w => w.wat).join(' | ');
  assert.equal(/geverifieerd met/.test(gezegd), false,
    'achter deze deur staat niemand, dus er valt niets over een verificatie te beweren');
  const niet = bon.nietVastgesteld.find(n => /sterkte van de verificatie/.test(n.wat));
  assert.ok(niet, 'en het staat er als niet vastgesteld');
  assert.match(niet.reden, /geen geverifieerde persoon/,
    'met de reden die bij DEZE deur hoort, niet met de reden voor een onbekende sessie');
});

test('3. er staat een sleutel in en geen naam', () => {
  const b = bloot();
  const bon = BON.maak([], { soort: 'tenant.vernietig', doel: 'O-X', aantal: 1,
    actor: 'user-7', blootstelling: b, verificatie: sterk, stapop: S.beoordeel(b, sterk),
    bevestigd: true, poort: 'techAuth', uitgevoerd: true });
  assert.equal(bon.actor, 'user-7');
  assert.equal(JSON.stringify(bon).includes('Rahul'), false);
  assert.equal(JSON.stringify(bon).includes('@'), false, 'en geen e-mailadres');
});

test('4. de keten breekt aanwijsbaar zodra iemand een bon bijstelt of wegneemt', () => {
  const bak = {};
  const b = bloot();
  const gegevens = (doel) => ({ soort: 'tenant.vernietig', doel, aantal: 1, actor: 'user-7',
    blootstelling: b, verificatie: sterk, stapop: S.beoordeel(b, sterk), bevestigd: true,
    poort: 'techAuth', uitgevoerd: true });
  for (const doel of ['O-1', 'O-2', 'O-3']) BON.schrijf(bak, gegevens(doel));

  assert.equal(BON.controleer(bak).ok, true, 'ongeschonden hoort te kloppen');
  assert.equal(bak.bonnen.length, 3);

  /* Iemand stelt de middelste bij. */
  bak.bonnen[1].uitgevoerd = false;
  const stuk = BON.controleer(bak);
  assert.equal(stuk.ok, false, 'een bijgestelde bon breekt de keten');
  assert.ok(stuk.gebroken.length, 'en er staat bij WAAR: ' + JSON.stringify(stuk.gebroken).slice(0, 120));

  /* En wegnemen valt op dezelfde manier op. */
  const weer = {}; for (const doel of ['O-1', 'O-2', 'O-3']) BON.schrijf(weer, gegevens(doel));
  weer.bonnen.splice(1, 1);
  assert.equal(BON.controleer(weer).ok, false, 'een weggenomen bon laat een gat achter');
});

/* ---------- en de echte weg ---------- */

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bon-'));
let srv, base;
const api = (pad, body, token) => fetch(base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const inloggen = () => api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })
  .then(r => r.body.token);

test('5. een echte vernietiging levert een bon die zijn eigen bevestiging noemt', async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  let tech = await inloggen();
  const w = await api('/api/bedrijf/werkruimte/maak', { naam: 'Bonklant BV' });
  await api('/api/techniek/tenant', { org: 'O-BON', naam: 'Bonklant' }, tech);
  await api('/api/techniek/tenant/bind', { org: 'O-BON', soort: 'werkruimte', code: w.body.werkruimte }, tech);
  await api('/api/techniek/tenant/levensloop', { org: 'O-BON', naar: 'opzegging', reden: 'Stopt.' }, tech);
  await api('/api/techniek/tenant/levensloop', { org: 'O-BON', naar: 'bewaring', reden: 'Uitloop.', bewaardagen: 30 }, tech);
  await stop(srv);

  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_KLOK: '+40d' } });
  base = srv.base;
  tech = await inloggen();

  /* Nog geen bon: er is nog niets kritieks gebeurd. */
  const leeg = await api('/api/techniek/vertrouwen/bonnen', {}, tech);
  assert.equal(leeg.status, 200);
  assert.equal(leeg.body.bonnen.length, 0, 'een poort die niets doorliet, schrijft niets');

  const vraag = await api('/api/techniek/tenant/vernietig', { org: 'O-BON' }, tech);
  assert.equal(vraag.status, 428);
  assert.equal((await api('/api/techniek/vertrouwen/bonnen', {}, tech)).body.bonnen.length, 0,
    'en een GEWEIGERDE handeling ook niet -- een bon is geen logregel');

  await api('/api/techniek/tenant/bevestig', { id: vraag.body.bevestiging.id, wachtwoord: 'Imran' }, tech);
  const raak = await api('/api/techniek/tenant/vernietig',
    { org: 'O-BON', bevestiging: vraag.body.bevestiging.id }, tech);
  assert.equal(raak.status, 200);

  const uit = await api('/api/techniek/vertrouwen/bonnen', {}, tech);
  assert.equal(uit.body.bonnen.length, 1);
  const bon = uit.body.bonnen[0];
  assert.equal(bon.soort, 'tenant.vernietig');
  assert.equal(bon.doel, 'O-BON');
  assert.equal(bon.uitgevoerd, true);

  const gezegd = bon.beweringen.map(w => w.wat).join(' | ');
  assert.match(gezegd, /tweede moment is gevraagd en gegeven/, 'de bevestiging staat in de bon');
  assert.match(gezegd, /geverifieerd met een wachtwoord/, 'en waarmee de mens zich bewees');
  assert.match(gezegd, /zwaarte uitzonderlijk/, 'en hoe zwaar de handeling was');
  assert.match(gezegd, /techAuth \+ eigenaarAlleen/, 'en door welke poort hij binnenkwam');

  assert.equal(uit.body.keten.ok, true, 'en de keten klopt');
});

test.after(async () => { await stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });
