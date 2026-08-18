/* De losse leverancierspagina's in de app: het RTG-reisbureau (samengestelde
   reizen aanvragen), RTG Verblijven (hotels/appartementen/villa's boeken via
   /api/verblijf) en RTG Uitgaan (bars/clubs/beachclubs, aanmelden via
   /api/event/rsvp). Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
function overNdagen(n) { return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10); }

let srv, base, lid, office;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reisbureau-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const reg = await api(base, '/api/auth/register', { name: 'Reiziger', email: 'r' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
  lid = { token: reg.body.token };
  /* Het kantoor erbij: de reisbalie is een kamer van het RTG-kantoor, en de
     eigenaar komt daar met zijn eigen account binnen (zie test/kantoren.test.js). */
  const kantoor = await api(base, '/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' });
  office = kantoor.body.token;
  assert.ok(office, 'het kantoor logt in');
});
test.after(() => stop(srv && srv.child));

test('1. het reisbureau toont reizen; alleen na inlog', async () => {
  assert.equal((await api(base, '/api/reisbureau', {}, null)).status, 401);
  const r = await api(base, '/api/reisbureau', {}, lid.token);
  assert.equal(r.status, 200);
  assert.ok(r.body.reizen.length >= 1, 'er staat minstens een reis klaar');
  const eerste = r.body.reizen[0];
  assert.ok(eerste.id && eerste.titel && eerste.prijs > 0, 'elke reis heeft een titel en nettoprijs');
});

test('2. een reis aanvragen landt als aanvraag; dubbel wordt geweigerd', async () => {
  const ov = await api(base, '/api/reisbureau', {}, lid.token);
  const id = ov.body.reizen[0].id;
  const boek = await api(base, '/api/reisbureau/boek', { tripId: id, personen: 2, vertrek: overNdagen(30) }, lid.token);
  assert.equal(boek.status, 200);
  assert.equal(boek.body.aanvraag.status, 'aangevraagd');
  assert.equal(boek.body.aanvraag.prijs.totaal, ov.body.reizen[0].prijs * 2);
  // dezelfde reis nog eens open aanvragen kan niet
  assert.equal((await api(base, '/api/reisbureau/boek', { tripId: id, personen: 1 }, lid.token)).status, 409);
  // onbekende reis
  assert.equal((await api(base, '/api/reisbureau/boek', { tripId: 'bestaat-niet' }, lid.token)).status, 404);
  const mijn = await api(base, '/api/reisbureau/mijn', {}, lid.token);
  assert.ok(mijn.body.aanvragen.some(a => a.tripId === id), 'de aanvraag staat bij mij');
});

test('3. RTG Verblijven toont huizen met kamers en boekt via /api/verblijf', async () => {
  assert.equal((await api(base, '/api/hotels', {}, null)).status, 401);
  const h = await api(base, '/api/hotels', {}, lid.token);
  assert.equal(h.status, 200);
  assert.ok(h.body.huizen.length >= 1, 'er is minstens een verblijf');
  const huis = h.body.huizen[0];
  assert.ok(huis.kamers.length >= 1 && huis.kamers[0].prijs > 0, 'elk huis heeft kamers met prijs');
  assert.ok(['hotel', 'apartment', 'villa'].includes(huis.soort), 'het soort klopt');
  const vb = await api(base, '/api/verblijf', { supplierCode: huis.code, roomId: huis.kamers[0].id,
    aankomst: overNdagen(5), vertrek: overNdagen(8), personen: 2 }, lid.token);
  assert.equal(vb.status, 200);
  assert.equal(vb.body.verblijf.status, 'aangevraagd');
});

test('4. RTG Uitgaan toont nachtadressen met avonden en meldt aan via /api/event/rsvp', async () => {
  assert.equal((await api(base, '/api/uitgaan', {}, null)).status, 401);
  const u = await api(base, '/api/uitgaan', {}, lid.token);
  assert.equal(u.status, 200);
  assert.ok(u.body.zaken.length >= 1, 'er is minstens een nachtadres met een avond');
  const zaak = u.body.zaken[0];
  assert.ok(['bar', 'club', 'beachclub'].includes(zaak.soort), 'het soort klopt');
  const ev = zaak.events[0];
  assert.ok(ev.id && ev.capaciteit > 0, 'de avond heeft een capaciteit');
  const rsvp = await api(base, '/api/event/rsvp', { supplierCode: zaak.code, eventId: ev.id, qty: 2 }, lid.token);
  assert.equal(rsvp.status, 200);
  assert.equal(rsvp.body.ok, true);
  // mijn avonden toont de aanmelding; afmelden haalt hem weg
  const mijn = await api(base, '/api/uitgaan/mijn', {}, lid.token);
  assert.ok(mijn.body.avonden.some(a => a.eventId === ev.id && a.supplierCode === zaak.code), 'de avond staat bij mij');
  const af = await api(base, '/api/event/rsvp/annuleer', { supplierCode: zaak.code, eventId: ev.id }, lid.token);
  assert.equal(af.status, 200);
  const mijn2 = await api(base, '/api/uitgaan/mijn', {}, lid.token);
  assert.ok(!mijn2.body.avonden.some(a => a.eventId === ev.id), 'na afmelden staat de avond niet meer bij mij');
});

test('5. een reisaanvraag intrekken; daarna kan dezelfde reis weer', async () => {
  const mijn = await api(base, '/api/reisbureau/mijn', {}, lid.token);
  const open = mijn.body.aanvragen.find(a => a.status === 'aangevraagd');
  assert.ok(open, 'er staat een open aanvraag (uit test 2)');
  const ann = await api(base, '/api/reisbureau/annuleer', { ref: open.ref }, lid.token);
  assert.equal(ann.status, 200);
  assert.equal(ann.body.aanvraag.status, 'geannuleerd');
  // onbekende ref
  assert.equal((await api(base, '/api/reisbureau/annuleer', { ref: 'RTG-R-XXXXXX' }, lid.token)).status, 404);
  // dezelfde reis mag nu weer aangevraagd worden
  const opnieuw = await api(base, '/api/reisbureau/boek', { tripId: open.tripId, personen: 2 }, lid.token);
  assert.equal(opnieuw.status, 200);
});

test('6. AI-reisadvies wijst een reis uit de catalogus aan (regel-fallback zonder sleutel)', async () => {
  const r = await api(base, '/api/reisbureau/advies', { wens: 'zon, zee en strand op een eiland' }, lid.token);
  assert.equal(r.status, 200);
  assert.ok(r.body.reis && r.body.reis.id, 'er komt een concrete reis terug');
  assert.ok(typeof r.body.reden === 'string' && r.body.reden.length, 'met een korte reden');
  const cat = await api(base, '/api/reisbureau', {}, lid.token);
  assert.ok(cat.body.reizen.some(x => x.id === r.body.reis.id), 'de aangeraden reis komt uit de catalogus');
});

/* ---------------------------------------------------------------------------
   DE REISBALIE: het kantoor achter het reisbureau.

   Waarom deze drie toetsen bestaan: de kop van kern/reisbureau.js beloofde dat
   een aanvraag "aangevraagd" heet TOT EEN MENS HEM BEVESTIGT, en tot vandaag
   kon geen mens dat -- er was geen route, geen kamer en geen knop die de stand
   ooit iets anders maakte dan "geannuleerd". Wat hier bewezen wordt is dus niet
   dat een veld verandert, maar dat er nu werkelijk iemand achter de balie zit,
   dat hij zich niet kan verstoppen (zijn inlog staat onder het besluit) en dat
   het lid ziet wat hij besloot -- zonder de interne sleutel van die medewerker
   mee te krijgen.
   --------------------------------------------------------------------------- */

test('7. het kantoor bevestigt een aanvraag; het lid ziet het besluit, niet de medewerker', async () => {
  // zonder kantoor-inlog is de balie dicht -- ook met een geldig LEDEN-token
  assert.equal((await api(base, '/api/office/reisbureau/besluit', { ref: 'RTG-R-000000', besluit: 'bevestigd' }, null)).status, 401);
  assert.equal((await api(base, '/api/office/reisbureau/besluit', { ref: 'RTG-R-000000', besluit: 'bevestigd' }, lid.token)).status, 401);

  const mijn = await api(base, '/api/reisbureau/mijn', {}, lid.token);
  const open = mijn.body.aanvragen.find(a => a.status === 'aangevraagd');
  assert.ok(open, 'er staat een open aanvraag klaar (uit toets 5)');

  // het kantoor ziet dezelfde aanvraag op codenaam liggen
  const balie = await api(base, '/api/office/reisbureau', {}, office);
  assert.equal(balie.status, 200);
  const bijHetKantoor = balie.body.aanvragen.find(a => a.ref === open.ref);
  assert.ok(bijHetKantoor, 'de aanvraag ligt bij het reisbureau');
  assert.ok(bijHetKantoor.codename && !bijHetKantoor.codename.includes('@'), 'op codenaam, niet op e-mailadres');

  const bes = await api(base, '/api/office/reisbureau/besluit',
    { ref: open.ref, besluit: 'bevestigd', bericht: 'Datum staat vast, het verblijf is geregeld.' }, office);
  assert.equal(bes.status, 200);
  assert.equal(bes.body.aanvraag.status, 'bevestigd');
  assert.ok(bes.body.aanvraag.besluit.door, 'in het kantoor staat WIE het besloot onder het besluit');

  // en dit is waar het om gaat: het lid ziet de nieuwe stand en het bericht
  const na = await api(base, '/api/reisbureau/mijn', {}, lid.token);
  const bij = na.body.aanvragen.find(a => a.ref === open.ref);
  assert.equal(bij.status, 'bevestigd');
  assert.equal(bij.besluit.bericht, 'Datum staat vast, het verblijf is geregeld.');
  assert.equal(bij.besluit.door, undefined, 'de interne sleutel van de medewerker blijft in het kantoor');

  // de kamer telt hem mee en haalt hem van de stapel "wacht op een besluit"
  const kamer = await api(base, '/api/office/kamer', { id: 'reisbureau' }, office);
  assert.equal(kamer.status, 200);
  const kpi = Object.fromEntries(kamer.body.kpis.map(k => [k.label, k.waarde]));
  assert.ok(kpi['Bevestigd'] >= 1, 'de teller Bevestigd staat op minstens een');
  const wachtrij = kamer.body.lijsten.find(l => l.titel.startsWith('Aanvragen die op een besluit'));
  assert.ok(!wachtrij.items.some(x => x.includes(open.ref)), 'de bevestigde aanvraag wacht niet meer');
  assert.ok(kamer.body.lijsten.some(l => l.items.some(x => x.includes(open.ref))), 'maar staat wel bij de genomen besluiten');

  // en het besluit staat in het auditlog van het kantoor
  const board = await api(base, '/api/office/boardroom', {}, office);
  assert.ok((board.body.audit || []).some(r => String(r.wat).includes(open.ref) && String(r.wat).includes('bevestigd')),
    'een toezegging aan een lid is navraagbaar');
});

test('8. een aanvraag wordt maar een keer besloten, en afwijzen kan alleen met een reden', async () => {
  const mijn = await api(base, '/api/reisbureau/mijn', {}, lid.token);
  const af = mijn.body.aanvragen.find(a => a.status === 'bevestigd');
  assert.ok(af, 'de bevestigde aanvraag uit toets 7');
  // een tweede besluit op dezelfde aanvraag ketst af
  const weer = await api(base, '/api/office/reisbureau/besluit', { ref: af.ref, besluit: 'afgewezen', bericht: 'toch niet' }, office);
  assert.equal(weer.status, 409);
  // en het lid kan een bevestigde reis niet meer zelf intrekken
  assert.equal((await api(base, '/api/reisbureau/annuleer', { ref: af.ref }, lid.token)).status, 409);
  // onbekende aanvraag, en een uitkomst die het reisbureau niet kent
  assert.equal((await api(base, '/api/office/reisbureau/besluit', { ref: 'RTG-R-ZZZZZZ', besluit: 'bevestigd' }, office)).status, 404);
  assert.equal((await api(base, '/api/office/reisbureau/besluit', { ref: af.ref, besluit: 'misschien' }, office)).status, 400);
});

test('9. afwijzen: zonder reden niet, met reden wel -- en het lid leest die reden', async () => {
  const ov = await api(base, '/api/reisbureau', {}, lid.token);
  const nieuw = await api(base, '/api/reisbureau/boek', { tripId: ov.body.reizen[0].id, personen: 3, vertrek: overNdagen(60) }, lid.token);
  assert.equal(nieuw.status, 200);
  const ref = nieuw.body.aanvraag.ref;

  const kaal = await api(base, '/api/office/reisbureau/besluit', { ref, besluit: 'afgewezen' }, office);
  assert.equal(kaal.status, 400, 'afwijzen zonder reden mag niet');
  const nog = await api(base, '/api/office/reisbureau', {}, office);
  assert.equal(nog.body.aanvragen.find(a => a.ref === ref).status, 'aangevraagd', 'de geweigerde afwijzing heeft niets veranderd');

  const wel = await api(base, '/api/office/reisbureau/besluit',
    { ref, besluit: 'afgewezen', bericht: 'Deze datum zit vol; we stellen graag een week later voor.' }, office);
  assert.equal(wel.status, 200);
  assert.equal(wel.body.aanvraag.status, 'afgewezen');
  const mijn = await api(base, '/api/reisbureau/mijn', {}, lid.token);
  const bij = mijn.body.aanvragen.find(a => a.ref === ref);
  assert.equal(bij.status, 'afgewezen');
  assert.equal(bij.besluit.bericht, 'Deze datum zit vol; we stellen graag een week later voor.');
});
