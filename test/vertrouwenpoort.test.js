/* HET TWEEDE MOMENT -- de step-up die echt gevraagd en echt gegeven wordt.

   Laag 3 velde het oordeel; dit is het moment zelf. De toetsen hieronder gaan
   over de vier eigenschappen die een bevestiging moet hebben, en elke
   eigenschap is een AANVAL die anders werkt:

   1. aan de sessie      anders lost de een hem op en gebruikt de ander hem
   2. aan de handeling    soort, aantal EN doel -- anders bevestigt iemand het
                          vernietigen van klant A en vernietigt hij klant B
   3. een keer            anders is een bevestiging een abonnement
   4. kort                een bon die blijft liggen, is een sleutel die
                          rondslingert

   EN DAARNA DE ECHTE WEG, over HTTP, op de enige handeling in dit huis die per
   definitie onherstelbaar is: een tenant vernietigen. Die e2e is de reden dat
   dit bestand bestaat -- zonder hem is "wij vragen een tweede bevestiging" een
   bewering zonder bron.

   DE KLOK GAAT VOORUIT, want een bewaartermijn is minstens dertig dagen. De
   tweede server draait op dezelfde datamap met RTG_KLOK=+40d. Zie server/lib/klok.js.

   Draai los: node --experimental-sqlite --test test/vertrouwenpoort.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const M = require('../server/kern/vertrouwen/tweedemoment');

/* ---------- de mechaniek, zonder server ---------- */

const handeling = { sessie: 's1', soort: 'tenant.vernietig', aantal: 1, doel: 'O-A' };

test('1. een bon is pas iets waard nadat een mens hem heeft opgelost', () => {
  const bak = {};
  const bon = M.vraag(bak, handeling);
  assert.ok(bon.id);
  const zonder = M.verzilver(bak, { ...handeling, id: bon.id });
  assert.equal(zonder.ok, false, 'aangevraagd is niet gegeven');
  assert.match(zonder.reden, /nooit gegeven/);

  assert.equal(M.los(bak, bon.id, 's1').ok, true);
  assert.equal(M.verzilver(bak, { ...handeling, id: bon.id }).ok, true);
});

test('2. een bon van een andere sessie werkt niet, in geen van beide richtingen', () => {
  const bak = {};
  const bon = M.vraag(bak, handeling);
  assert.equal(M.los(bak, bon.id, 's2').ok, false, 'een ander mag hem niet oplossen');
  assert.equal(M.los(bak, bon.id, 's1').ok, true);
  const gestolen = M.verzilver(bak, { ...handeling, sessie: 's2', id: bon.id });
  assert.equal(gestolen.ok, false, 'en een ander mag hem niet gebruiken');
  assert.match(gestolen.reden, /andere sessie/);
});

test('3. een bon zit vast aan DEZE handeling -- soort, aantal en doel', () => {
  const bak = {};
  const bon = M.vraag(bak, handeling);
  M.los(bak, bon.id, 's1');

  /* Het gevaarlijkste geval, en de reden dat `doel` bestaat: dezelfde soort en
     hetzelfde aantal, maar een ANDERE klant. */
  const andereKlant = M.verzilver(bak, { ...handeling, doel: 'O-B', id: bon.id });
  assert.equal(andereKlant.ok, false, 'bevestigen voor A mag B niet vernietigen');
  assert.match(andereKlant.reden, /andere handeling/);

  assert.equal(M.verzilver(bak, { ...handeling, aantal: 9, id: bon.id }).ok, false, 'ander aantal');
  assert.equal(M.verzilver(bak, { ...handeling, soort: 'tenant.uitvoer', id: bon.id }).ok, false, 'andere soort');
  assert.equal(M.verzilver(bak, { ...handeling, id: bon.id }).ok, true, 'en de echte werkt nog');
});

test('4. een bon is voor EEN keer', () => {
  const bak = {};
  const bon = M.vraag(bak, handeling);
  M.los(bak, bon.id, 's1');
  assert.equal(M.verzilver(bak, { ...handeling, id: bon.id }).ok, true);
  const weer = M.verzilver(bak, { ...handeling, id: bon.id });
  assert.equal(weer.ok, false, 'een bevestiging is geen abonnement');
  assert.match(weer.reden, /niet \(meer\)/);
});

test('5. een verlopen bon is geen bon', () => {
  const bak = {};
  const bon = M.vraag(bak, handeling);
  M.los(bak, bon.id, 's1');
  /* De klok verzetten kan hier niet zonder de server te herstarten, dus wordt
     de vervaldatum met de hand naar het verleden gezet -- dat is exact wat de
     tijd zelf zou doen. */
  bak.momenten[bon.id].verloopt = 1;
  assert.equal(M.verzilver(bak, { ...handeling, id: bon.id }).ok, false);
  assert.equal(Object.keys(bak.momenten).length, 0, 'en hij is opgeruimd, niet blijven liggen');
});

/* ---------- en de echte weg, over HTTP ---------- */

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-poort-'));
let srv, base;
const api = (pad, body, token) => fetch(base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const inloggen = () => api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })
  .then(r => r.body.token);

test('6. de hele weg: geweigerd met een reden, bevestigd, uitgevoerd, bon op', async () => {
  /* Stap een, op de gewone klok: twee klanten die opzeggen en de bewaring in
     gaan. Twee, want de aanval in toets 3 hoort ook over HTTP te falen. */
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  let tech = await inloggen();
  for (const org of ['O-STOP1', 'O-STOP2']) {
    const w = await api('/api/bedrijf/werkruimte/maak', { naam: 'Klant ' + org });
    await api('/api/techniek/tenant', { org, naam: 'Klant ' + org }, tech);
    await api('/api/techniek/tenant/bind', { org, soort: 'werkruimte', code: w.body.werkruimte }, tech);
    await api('/api/techniek/tenant/levensloop', { org, naar: 'opzegging', reden: 'Stopt.' }, tech);
    const b = await api('/api/techniek/tenant/levensloop',
      { org, naar: 'bewaring', reden: 'Uitloop.', bewaardagen: 30 }, tech);
    assert.equal(b.status, 200, org + ' hoort in de bewaring te staan');
  }
  await stop(srv);

  /* Stap twee, veertig dagen later: de termijn is om, dus de vernietiging zou
     nu ECHT doorgaan -- en juist dan hoort de poort te vragen. */
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_KLOK: '+40d' } });
  base = srv.base;
  tech = await inloggen();

  const eerste = await api('/api/techniek/tenant/vernietig', { org: 'O-STOP1' }, tech);
  assert.equal(eerste.status, 428, 'geen weigering maar een voorwaarde: ' + JSON.stringify(eerste.body).slice(0, 160));
  assert.ok(eerste.body.bevestiging && eerste.body.bevestiging.id, 'met een bon om af te maken');
  assert.match(eerste.body.error, /onherstelbaar/,
    'en met de reden die bij DEZE handeling hoort, niet met "policy violation"');
  const bon = eerste.body.bevestiging.id;

  const fout = await api('/api/techniek/tenant/bevestig', { id: bon, wachtwoord: 'nietHetJuiste' }, tech);
  assert.equal(fout.status, 401, 'een bevestiging zonder het echte wachtwoord is geen bevestiging');

  const goed = await api('/api/techniek/tenant/bevestig', { id: bon, wachtwoord: 'Imran' }, tech);
  assert.equal(goed.status, 200, JSON.stringify(goed.body).slice(0, 160));

  /* De aanval uit toets 3, nu over HTTP: bevestigd voor klant 1, geprobeerd op
     klant 2. Zelfde soort, zelfde aantal, andere klant. */
  const verkeerdeKlant = await api('/api/techniek/tenant/vernietig',
    { org: 'O-STOP2', bevestiging: bon }, tech);
  assert.equal(verkeerdeKlant.status, 428, 'een bon voor klant 1 vernietigt klant 2 niet');
  assert.match(verkeerdeKlant.body.error, /andere handeling/);

  const raak = await api('/api/techniek/tenant/vernietig', { org: 'O-STOP1', bevestiging: bon }, tech);
  assert.equal(raak.status, 200, 'met de juiste bon gaat hij door: ' + JSON.stringify(raak.body).slice(0, 160));
  assert.ok(raak.body.bewijs, 'en er komt een vernietigingsbewijs uit');

  /* En de bon is op. Klant 2 staat nog en is dus echt te vernietigen -- als er
     opnieuw wordt bevestigd. */
  const nogEens = await api('/api/techniek/tenant/vernietig', { org: 'O-STOP2', bevestiging: bon }, tech);
  assert.equal(nogEens.status, 428, 'een gebruikte bon is op');
  assert.notEqual(nogEens.body.bevestiging.id, bon, 'en er ligt een nieuwe vraag klaar');
});

test('7. de inhoudelijke weigering komt VOOR het tweede moment', async () => {
  /* Wie zijn wachtwoord typt voor een vernietiging die daarna toch op een
     bewaringsplicht stukloopt, heeft een bevestiging weggegeven aan een moment
     dat er niet toe deed -- en leest hem de volgende keer niet meer. */
  const tech = await inloggen();
  await api('/api/techniek/tenant/bewaringsplicht',
    { org: 'O-STOP2', aan: true, reden: 'Lopende zaak bij de kantonrechter.' }, tech);
  const u = await api('/api/techniek/tenant/vernietig', { org: 'O-STOP2' }, tech);
  assert.equal(u.status, 409, 'geen 428: er valt hier niets te bevestigen');
  assert.match(u.body.error, /bewaringsplicht|kantonrechter/);
  assert.equal(u.body.bevestiging, undefined, 'en er wordt geen bon uitgegeven voor iets dat niet doorgaat');
});

test.after(async () => { await stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });
