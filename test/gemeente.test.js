/* RTG Gemeente (kern/gemeente.js): het civiele systeem als partner-genre. Vier
   pijlers voor inwoners, gemeente-medewerkers en RTG-partners. Draai: npm test */
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

let srv, base, lid, gem, partner;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gemeente-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const reg = await api(base, '/api/auth/register', { name: 'Inwoner', email: 'i' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  // gemeente-medewerker: log in als de gemeente-partner (manager, PIN 1234)
  const roster = await api(base, '/api/supplier/roster', { code: 'GEMEENTE' });
  const man = roster.body.staff.find(m => m.role === 'manager');
  const glog = await api(base, '/api/supplier/login', { code: 'GEMEENTE', staffId: man.id, pin: '1234' });
  gem = glog.body.token;
  // een RTG-partner (het demo-restaurant)
  const kik = await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' });
  partner = kik.body.token;
});
test.after(() => stop(srv && srv.child));

test('1. inwoner meldt openbare ruimte; de gemeente wijst toe en handelt af; melder ziet de status', async () => {
  assert.equal((await api(base, '/api/gemeente/meld', { categorie: 'verlichting', tekst: 'Kapotte lantaarn' }, null)).status, 401);
  const m = await api(base, '/api/gemeente/meld', { categorie: 'verlichting', tekst: 'De lantaarn bij de haven doet het niet', locatie: 'Marina' }, lid);
  assert.equal(m.status, 200);
  assert.equal(m.body.melding.ploeg, 'openbare werken', 'verlichting gaat naar openbare werken');
  const ref = m.body.melding.ref;
  // de gemeente ziet en behandelt de melding
  const lijst = await api(base, '/api/gemeente/meldingen', {}, gem);
  assert.ok(lijst.body.meldingen.some(x => x.ref === ref), 'de melding staat op de behandelijst');
  const zet = await api(base, '/api/gemeente/melding/zet', { ref, patch: { status: 'in behandeling', update: 'Ploeg is onderweg' } }, gem);
  assert.equal(zet.status, 200);
  assert.equal(zet.body.melding.status, 'in behandeling');
  // de melder ziet de nieuwe status en de update
  const mijn = await api(base, '/api/gemeente/meldingen/mijn', {}, lid);
  const mine = mijn.body.meldingen.find(x => x.ref === ref);
  assert.equal(mine.status, 'in behandeling');
  assert.ok(mine.updates.some(u => /onderweg/.test(u.tekst)), 'de update reist mee naar de melder');
  // een medewerker-route is dicht zonder gemeente-inlog (een gewoon lid mag niet behandelen)
  assert.equal((await api(base, '/api/gemeente/regie', {}, lid)).status, 401);
});

test('2. burgerzaken: vrije tijdsloten en een afspraak; dubbel wordt geweigerd; annuleren kan', async () => {
  const bz = await api(base, '/api/gemeente/burgerzaken', {}, lid);
  assert.ok(bz.body.soorten.some(s => s.id === 'paspoort' && s.opAfspraak), 'paspoort is een balieproduct');
  const datum = overNdagen(3);
  const slots = await api(base, '/api/gemeente/burgerzaken/slots', { soort: 'paspoort', datum }, lid);
  assert.equal(slots.status, 200);
  const vrij = slots.body.slots.find(s => !s.vol);
  assert.ok(vrij, 'er is een vrij tijdslot');
  const a = await api(base, '/api/gemeente/afspraak', { soort: 'paspoort', datum, tijd: vrij.tijd }, lid);
  assert.equal(a.status, 200);
  assert.equal(a.body.afspraak.status, 'gepland');
  // tweede afspraak voor hetzelfde product wordt geweigerd
  assert.equal((await api(base, '/api/gemeente/afspraak', { soort: 'paspoort', datum, tijd: vrij.tijd }, lid)).status, 409);
  // annuleren
  const ann = await api(base, '/api/gemeente/afspraak/annuleer', { ref: a.body.afspraak.ref }, lid);
  assert.equal(ann.status, 200);
});

test('3. verhuizing doorgeven landt als ontvangen aanvraag bij de gemeente', async () => {
  const v = await api(base, '/api/gemeente/verhuizing', { nieuwAdres: 'Carrer Nou 12, Eivissa', datum: overNdagen(14) }, lid);
  assert.equal(v.status, 200);
  assert.equal(v.body.aanvraag.status, 'ontvangen');
  const afs = await api(base, '/api/gemeente/afspraken', {}, gem);
  assert.ok(afs.body.afspraken.some(a => a.soort === 'verhuizing' && a.nieuwAdres), 'de verhuizing staat bij de gemeente');
});

test('4. vergunning: inwoner vraagt aan, gemeente verleent met voorwaarde en publiceert een bekendmaking', async () => {
  const g = await api(base, '/api/gemeente/vergunning', { soort: 'evenement', omschrijving: 'Buurtfeest op het plein in juni', locatie: 'Plaza' }, lid);
  assert.equal(g.status, 200);
  const ref = g.body.vergunning.ref;
  const voor = (await api(base, '/api/gemeente/bekendmakingen', {}, lid)).body.bekendmakingen.length;
  const bes = await api(base, '/api/gemeente/vergunning/beslis', { ref, besluit: 'verleend', voorwaarden: ['Eindtijd 23:00'] }, gem);
  assert.equal(bes.status, 200);
  assert.equal(bes.body.vergunning.status, 'verleend');
  const mijn = await api(base, '/api/gemeente/vergunningen/mijn', {}, lid);
  const mine = mijn.body.vergunningen.find(v => v.ref === ref);
  assert.ok(mine.voorwaarden.includes('Eindtijd 23:00'), 'de voorwaarde staat bij de aanvrager');
  const na = (await api(base, '/api/gemeente/bekendmakingen', {}, lid)).body.bekendmakingen.length;
  assert.ok(na > voor, 'een verleende vergunning wordt een bekendmaking');
});

test('5. een RTG-partner vraagt zelf een terrasvergunning aan en volgt hem', async () => {
  const g = await api(base, '/api/supplier/gemeente/vergunning', { soort: 'terras', omschrijving: 'Terras met 8 tafels voor de zaak' }, partner);
  assert.equal(g.status, 200);
  const mijn = await api(base, '/api/supplier/gemeente/vergunningen', {}, partner);
  assert.ok(mijn.body.vergunningen.some(v => v.ref === g.body.vergunning.ref), 'de aanvraag staat bij de onderneming');
});

test('6. afvalkalender per postcode en grofvuil op afspraak', async () => {
  const af = await api(base, '/api/gemeente/afval', { postcode: '07800' }, lid);
  assert.equal(af.status, 200);
  for (const fr of ['rest', 'gft', 'papier', 'pmd']) assert.ok(af.body.fracties[fr], 'fractie ' + fr + ' heeft ophaaldagen');
  assert.ok(af.body.fracties.rest.data.length >= 1 && /^\d{4}-\d{2}-\d{2}$/.test(af.body.fracties.rest.data[0]), 'restafval heeft een datum');
  const gv = await api(base, '/api/gemeente/grofvuil', { wat: 'Oude bank en een kast', adres: '07800' }, lid);
  assert.equal(gv.status, 200);
  assert.equal(gv.body.aanvraag.status, 'gepland');
});

test('7. AI-triage kiest een categorie en ploeg (regel-fallback zonder sleutel)', async () => {
  const t = await api(base, '/api/gemeente/triage', { tekst: 'Er ligt een grote tak over het fietspad' }, gem);
  assert.equal(t.status, 200);
  assert.equal(t.body.categorie, 'groen');
  assert.equal(t.body.ploeg, 'groenbeheer');
  // zonder gemeente-inlog kan het niet
  assert.equal((await api(base, '/api/gemeente/triage', { tekst: 'x' }, lid)).status, 401);
});

test('8. aanslagen verschijnen vanzelf voor de inwoner en zijn te betalen; dubbel en onbekend worden geweigerd', async () => {
  // een gast (geen lid) mag de belastingroute niet gebruiken
  assert.equal((await api(base, '/api/gemeente/belasting/betaal', { id: 'x' }, null)).status, 401);
  const mijn = await api(base, '/api/gemeente/belasting/mijn', {}, lid);
  assert.equal(mijn.status, 200);
  assert.ok(mijn.body.aanslagen.length >= 3, 'er staan automatisch aanslagen klaar (OZB, afval, riool)');
  assert.ok(mijn.body.aanslagen.some(a => a.soort === 'OZB'), 'OZB hoort erbij');
  const open = mijn.body.aanslagen.find(a => !a.betaald);
  assert.ok(open, 'er is een openstaande aanslag');
  // betalen markeert hem als betaald
  const bet = await api(base, '/api/gemeente/belasting/betaal', { id: open.id }, lid);
  assert.equal(bet.status, 200);
  assert.equal(bet.body.aanslag.betaald, true);
  // een tweede betaling van dezelfde aanslag botst
  assert.equal((await api(base, '/api/gemeente/belasting/betaal', { id: open.id }, lid)).status, 409);
  // een onbekende aanslag bestaat niet
  assert.equal((await api(base, '/api/gemeente/belasting/betaal', { id: 'bestaat-niet' }, lid)).status, 404);
  // de betaalde status reist mee naar het overzicht
  const na = await api(base, '/api/gemeente/belasting/mijn', {}, lid);
  assert.equal(na.body.aanslagen.find(a => a.id === open.id).betaald, true);
});

test('9. een melding met GPS-coördinaten bewaart de locatie', async () => {
  const m = await api(base, '/api/gemeente/meld', { categorie: 'wegdek', tekst: 'Gat in het wegdek bij de rotonde', lat: 38.909, lng: 1.432 }, lid);
  assert.equal(m.status, 200);
  const mijn = await api(base, '/api/gemeente/meldingen/mijn', {}, lid);
  const mine = mijn.body.meldingen.find(x => x.ref === m.body.melding.ref);
  assert.ok(mine, 'de melding staat in mijn overzicht');
});
