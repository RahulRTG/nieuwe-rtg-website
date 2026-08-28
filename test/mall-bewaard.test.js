/* Bewaren in de RTG Mall, en wat er sinds het bewaren veranderde.

   De twee valkuilen waar deze toetsen op mikken:
     1. favorieten als tweede opslag naast de lijsten -- dan staat het hartje
        aan terwijl de lijst leeg is (LAT-regel 4);
     2. "wij weten het niet" dat stilletjes meetelt als "er is niets veranderd"
        (LAT-regel 3). Een regel die is bewaard voordat de beschikbaarheid werd
        vastgelegd, mag geen uitspraak opleveren.

   En een die niet technisch is maar wel de belangrijkste: het alarm mag geen
   melding worden. CLAUDE.md verbiedt verslavende patronen, en dit is precies
   het soort ding dat daarin ontspoort.

   Elke toets is met een mutatie nagetrokken (LAT-regel 2).
   Draai los: node --test test/mall-bewaard.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { BEWAARD } = require('../server/kern/mall/lijsten');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, lid, eenAanbod, tweedeAanbod;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mallbewaard-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const reg = await api(base, '/api/auth/register', { name: 'Bewaar Lid', email: 'bewaar@x.nl', phone: '0612345678',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  assert.ok(lid, 'lid-registratie geeft een token');
  const z = await api(base, '/api/mall/zoek', { per: 60 }, lid);
  // twee aanbod-objecten met een prijs, zodat er iets te vergelijken valt
  const metPrijs = z.body.items.filter(a => a.prijs && a.prijs.bedrag > 0);
  assert.ok(metPrijs.length >= 2, 'er staat aanbod met een prijs in de Mall');
  eenAanbod = metPrijs[0];
  tweedeAanbod = metPrijs[1];
});
test.after(() => stop(srv && srv.child));

test('1. het hartje maakt de lijst "Bewaard" aan, en zet hem niet twee keer neer', async () => {
  const voor = await api(base, '/api/mall/lijsten', {}, lid);
  assert.equal(voor.body.lijsten.filter(l => l.soort === BEWAARD).length, 0,
    'een nieuw lid begint zonder bewaarlijst; hij wordt pas gemaakt als hij nodig is');

  const a = await api(base, '/api/mall/bewaar', { aanbodId: eenAanbod.id }, lid);
  assert.equal(a.status, 200);
  assert.equal(a.body.bewaard, true, 'het hartje staat aan');

  const b = await api(base, '/api/mall/bewaar', { aanbodId: tweedeAanbod.id }, lid);
  assert.equal(b.body.bewaard, true);

  const na = await api(base, '/api/mall/lijsten', {}, lid);
  const bewaardLijsten = na.body.lijsten.filter(l => l.soort === BEWAARD);
  assert.equal(bewaardLijsten.length, 1, 'er is precies EEN bewaarlijst, ook na twee hartjes');
  assert.equal(bewaardLijsten[0].aantal, 2, 'en er staan twee dingen in');
});

test('2. het hartje is een wissel: nog een keer klikken haalt het er weer uit', async () => {
  const uit = await api(base, '/api/mall/bewaar', { aanbodId: tweedeAanbod.id }, lid);
  assert.equal(uit.body.bewaard, false, 'de tweede klik zet het hartje uit');
  const lijst = await api(base, '/api/mall/bewaard', {}, lid);
  const ids = lijst.body.lijst.regels.map(r => r.aanbodId);
  assert.ok(!ids.includes(tweedeAanbod.id), 'en het staat er werkelijk niet meer in');
  assert.ok(ids.includes(eenAanbod.id), 'het andere staat er nog wel in');
});

test('3. de bewaarlijst is een LIJST, niet een tweede opslag ernaast', async () => {
  const lijsten = await api(base, '/api/mall/lijsten', {}, lid);
  const b = lijsten.body.lijsten.find(l => l.soort === BEWAARD);
  assert.ok(b, 'de bewaarlijst staat gewoon tussen de lijsten van het lid');
  // en hij is via de gewone lijstroute te openen -- een echte lijst dus
  const via = await api(base, '/api/mall/lijst', { id: b.id }, lid);
  assert.equal(via.status, 200);
  assert.equal(via.body.lijst.soort, BEWAARD);
  assert.equal(via.body.lijst.regels.length, 1, 'met dezelfde inhoud als via /api/mall/bewaard');
});

test('4. de vaste bewaarlijst kan niet worden weggegooid', async () => {
  const lijsten = await api(base, '/api/mall/lijsten', {}, lid);
  const b = lijsten.body.lijsten.find(l => l.soort === BEWAARD);
  const weg = await api(base, '/api/mall/lijst/weg', { id: b.id }, lid);
  assert.equal(weg.status, 409, 'weggooien wordt geweigerd');
  assert.ok(/vaste lijst/i.test(weg.body.error), 'met uitleg: ' + weg.body.error);

  const na = await api(base, '/api/mall/lijsten', {}, lid);
  assert.ok(na.body.lijsten.some(l => l.soort === BEWAARD), 'en hij staat er nog');
});

test('5. een eigen lijst mag wel weg -- de weigering geldt alleen de systeemlijst', async () => {
  const nieuw = await api(base, '/api/mall/lijst/nieuw', { naam: 'Zomer' }, lid);
  assert.equal(nieuw.status, 200);
  const weg = await api(base, '/api/mall/lijst/weg', { id: nieuw.body.lijst.id }, lid);
  assert.equal(weg.status, 200, 'een zelfgemaakte lijst gaat gewoon weg');
});

test('6. zoeken op "alleen wat ik bewaarde" gebruikt MIJN lijst, niet wat de client stuurt', async () => {
  const mijn = await api(base, '/api/mall/zoek', { per: 60, bewaard: true }, lid);
  assert.equal(mijn.status, 200);
  assert.equal(mijn.body.totaal, 1, 'ik heb er een bewaard, dus een treffer');
  assert.equal(mijn.body.items[0].id, eenAanbod.id);

  // een tweede lid heeft niets bewaard en hoort dus niets te zien
  const reg = await api(base, '/api/auth/register', { name: 'Ander Lid', email: 'ander@x.nl', phone: '0612345679',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  const ander = await api(base, '/api/mall/zoek', { per: 60, bewaard: true }, reg.body.token);
  assert.equal(ander.body.totaal, 0, 'het bewaarde van het ene lid lekt niet naar het andere');
  const regel = (ander.body.filters || []).find(f => f.filter === 'bewaard');
  assert.ok(regel, 'en het filter legt uit waarom de lijst leeg is');

  /* En de client mag de lijst niet zelf meesturen. Zonder deze regel kan
     iedereen het aanbod van een ander in zijn eigen "bewaard" toveren door een
     id in het verzoek te zetten. */
  const gesmokkeld = await api(base, '/api/mall/zoek',
    { per: 60, bewaard: true, bewaardeIds: [eenAanbod.id] }, reg.body.token);
  assert.equal(gesmokkeld.body.totaal, 0, 'meegestuurde ids worden genegeerd; de server kijkt in de eigen lijst');
});

/* De vergelijking zelf, met een gebouwde wereld. Via de routes is een prijs
   niet te verzetten (de marktplaats is leveranciers-kant), en een toets die
   alleen kan vaststellen dat er een prijs is vastgelegd, meet de vergelijking
   niet -- die kan namelijk niet zakken (LAT-regel 9). Daarom hier de module
   zelf, met de bewaarde regels en het levende aanbod allebei in de hand. */
function bouwBewaard(regels, levend) {
  const lijst = { id: 'L1', naam: 'Bewaard', soort: BEWAARD, regels };
  const ctx = { save() {}, crypto: require('crypto'), aanbodAlles: () => ({ aanbod: levend }) };
  const hulp = { bak: () => [lijst], voegToe: () => ({ ok: true }), haalWeg: () => ({ ok: true }),
    toon: () => ({ ok: true }), nu: () => '2026-08-09T00:00:00.000Z', BEWAARD };
  return require('../server/kern/mall/bewaard')(ctx, hulp);
}
const levendAanbod = (id, bedrag, uit) => ({
  id, titel: 'Ding ' + id, pagina: '/apps/mall.html',
  prijs: bedrag == null ? null : { bedrag, eenheid: 'per stuk', valuta: 'EUR' },
  beschikbaar: uit === undefined ? null : { tekst: uit ? 'Uitverkocht' : 'Op voorraad', uit: !!uit }
});

test('7. een prijswijziging sinds het bewaren komt terug, met was en nu', () => {
  const regel = { aanbodId: 'a', titel: 'Ding a', prijsBijBewaren: 100, beschikbaarBijBewaren: 'in' };
  const gezakt = bouwBewaard([regel], [levendAanbod('a', 80, false)]).mallWijzigingen('k');
  const p = gezakt.wijzigingen.find(w => w.soort === 'prijs');
  assert.ok(p, 'een gezakte prijs levert een regel op');
  assert.equal(p.was, 100);
  assert.equal(p.nu, 80);
  assert.equal(p.verschil, -20);
  assert.ok(/gezakt/i.test(p.tekst), 'en de richting klopt: ' + p.tekst);

  const gestegen = bouwBewaard([regel], [levendAanbod('a', 130, false)]).mallWijzigingen('k');
  assert.ok(/gestegen/i.test(gestegen.wijzigingen.find(w => w.soort === 'prijs').tekst));

  const gelijk = bouwBewaard([regel], [levendAanbod('a', 100, false)]).mallWijzigingen('k');
  assert.equal(gelijk.wijzigingen.filter(w => w.soort === 'prijs').length, 0,
    'een onveranderde prijs levert GEEN regel op');
});

test('7b. een beschikbaarheidswissel komt terug, en verdwenen aanbod ook', () => {
  const regel = { aanbodId: 'a', titel: 'Ding a', prijsBijBewaren: 100, beschikbaarBijBewaren: 'uit' };
  const terug = bouwBewaard([regel], [levendAanbod('a', 100, false)]).mallWijzigingen('k');
  const b = terug.wijzigingen.find(w => w.soort === 'beschikbaar');
  assert.ok(b, 'van uitverkocht naar op voorraad is een wijziging');
  assert.equal(b.was, 'uit');
  assert.equal(b.nu, 'in');

  const weg = bouwBewaard([regel], []).mallWijzigingen('k');
  assert.equal(weg.wijzigingen[0].soort, 'weg', 'aanbod dat niet meer bestaat wordt gemeld');
  assert.ok(/niet meer in de Mall/i.test(weg.wijzigingen[0].tekst));
});

test('7c. zonder vastgelegde stand doet het alarm GEEN uitspraak', () => {
  // een regel van voor deze versie: beschikbaarBijBewaren ontbreekt
  const oud = { aanbodId: 'a', titel: 'Ding a', prijsBijBewaren: 100 };
  const r = bouwBewaard([oud], [levendAanbod('a', 100, true)]).mallWijzigingen('k');
  assert.equal(r.wijzigingen.filter(w => w.soort === 'beschikbaar').length, 0,
    'wij weten de oude stand niet, dus melden we geen wissel');
  assert.equal(r.zonderVergelijking, 1, 'maar we tellen wel dat we het niet konden vergelijken');
  assert.equal(r.bekeken, 1);
});

test('8. over beschikbaarheid die we niet vastlegden, doen we geen uitspraak', async () => {
  const r = await api(base, '/api/mall/wijzigingen', {}, lid);
  assert.equal(typeof r.body.bekeken, 'number', 'er wordt geteld hoeveel regels zijn nagelopen');
  assert.equal(typeof r.body.zonderVergelijking, 'number',
    'en hoeveel er NIET op beschikbaarheid te vergelijken waren');
  assert.ok(r.body.bekeken >= 1, 'er is werkelijk iets nagelopen, anders meet deze toets niets');
  assert.ok(r.body.zonderVergelijking <= r.body.bekeken, 'het onbekende deel past binnen het geheel');
  // geen enkele wijziging mag over een regel gaan waarvan we de stand niet kenden
  for (const w of r.body.wijzigingen) {
    if (w.soort !== 'beschikbaar') continue;
    assert.ok(w.was === 'in' || w.was === 'uit', 'een beschikbaarheidsregel weet wat de oude stand was');
  }
});

test('9. het alarm belooft geen meldingen -- dat staat in het antwoord zelf', async () => {
  const r = await api(base, '/api/mall/wijzigingen', {}, lid);
  assert.ok(/geen meldingen/i.test(r.body.opmerking), 'de tekst zegt het met zoveel woorden: ' + r.body.opmerking);
  assert.ok(!/nog \d+|laatste kans|nu kopen|bijna weg/i.test(JSON.stringify(r.body)),
    'er staat nergens schaarste of aandrang in het antwoord');
});
