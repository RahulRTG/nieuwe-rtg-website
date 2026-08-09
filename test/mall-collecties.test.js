/* Samengesteld aanbod in de RTG Mall: collecties, bundels, evenementen en
   seizoenen -- vier soorten met een vorm.

   Waar deze toetsen op mikken, in volgorde van hoe duur de fout is:

     1. EEN BUNDEL DIE EEN ONDERDEEL MIST. De verleiding is om de rest gewoon
        door te rekenen. Dan koopt iemand een korting die hij niet krijgt. Zo'n
        bundel hoort te zeggen dat hij kapot is en GEEN prijs te tonen.
     2. EEN OPGESLAGEN LOSSE PRIJS. Wie de optelsom bewaart, toont morgen een
        verschil dat nergens meer op slaat.
     3. EEN VINKJE IN PLAATS VAN EEN DATUM. Zo blijft een winteractie in juli
        op de voorpagina staan.
     4. ANDERMANS AANBOD BUNDELEN. Een zaak die een bundel maakt met het aanbod
        van de buren belooft iets wat zij niet kan leveren.

   Elke toets is met een mutatie nagetrokken (LAT-regel 2).
   Draai los: node --experimental-sqlite --test test/mall-collecties.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { SOORTEN, inTijd } = require('../server/kern/mall/collecties');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const dag = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

/* De uitwerking met een gebouwde wereld: bewaarde collectie in de ene hand,
   levend aanbod in de andere. Alleen zo is "een onderdeel verdwijnt" te
   toetsen zonder de Mall te slopen. */
function bouwCollecties(rijen, levend) {
  const db = { data: { mallCollecties: rijen } };
  const ctx = { db, save() {}, crypto: require('crypto'),
    aanbodAlles: () => ({ aanbod: levend }),
    plek: { slugVan: (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-') } };
  return require('../server/kern/mall/collecties')(ctx).mallCollecties;
}
const aanbodje = (id, bedrag) => ({
  id, titel: 'Ding ' + id, type: 'product', pagina: '/apps/mall.html',
  aanbieder: { soort: 'zaak', code: 'Z1', naam: 'Zaak' },
  prijs: bedrag == null ? null : { bedrag, eenheid: 'per stuk', valuta: 'EUR' }
});
const bundel = (extra) => Object.assign({
  id: 'C1', soort: 'bundel', titel: 'Avond uit', uitleg: null, regels: ['a', 'b'],
  plek: null, van: null, tot: null, door: 'Z1', doorNaam: 'Zaak', bundelPrijs: 80
}, extra || {});

let srv, base, lid;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mallcol-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const reg = await api(base, '/api/auth/register', { name: 'Col Lid', email: 'col@x.nl', phone: '0612345678',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  assert.ok(lid, 'lid-registratie geeft een token');
});
test.after(() => stop(srv && srv.child));

test('1. een complete bundel vergelijkt de losse prijs met de bundelprijs', () => {
  const m = bouwCollecties([bundel()], [aanbodje('a', 50), aanbodje('b', 45)]);
  const c = m.toon('C1').collectie;
  assert.equal(c.compleet, true);
  assert.equal(c.prijs.los, 95, 'de losse prijs is opgeteld uit het levende aanbod');
  assert.equal(c.prijs.bundel, 80);
  assert.equal(c.prijs.verschil, 15);
  assert.equal(c.waarschuwing, null);
});

test('2. de losse prijs wordt NIET bewaard maar elke keer opnieuw opgeteld', () => {
  const rij = bundel();
  const duur = bouwCollecties([rij], [aanbodje('a', 90), aanbodje('b', 45)]).toon('C1').collectie;
  assert.equal(duur.prijs.los, 135, 'een duurder onderdeel verandert de losse prijs meteen');
  // en er staat geen prijs in de opgeslagen rij zelf, alleen wat de bundel kost
  assert.equal(rij.los, undefined, 'de optelsom staat nergens vast');
  assert.equal(rij.bundelPrijs, 80);
});

test('3. een bundel die een onderdeel mist toont GEEN prijs en zegt dat hij kapot is', () => {
  const m = bouwCollecties([bundel()], [aanbodje('a', 50)]);  // 'b' is weg
  const c = m.toon('C1').collectie;
  assert.equal(c.compleet, false);
  assert.equal(c.ontbreekt, 1);
  assert.equal(c.prijs, null, 'er wordt niets doorgerekend zonder een onderdeel');
  assert.ok(/mist 1 onderdeel/i.test(c.waarschuwing), 'en de reden staat erbij: ' + c.waarschuwing);
  const kwijt = c.regels.find(r => r.weg);
  assert.ok(kwijt && /niet meer in de Mall/i.test(kwijt.reden), 'de regel zelf zegt ook wat er mis is');
});

test('4. een onderdeel zonder vaste prijs levert ook geen vergelijk op', () => {
  const m = bouwCollecties([bundel()], [aanbodje('a', 50), aanbodje('b', null)]);
  const c = m.toon('C1').collectie;
  assert.equal(c.compleet, true, 'het onderdeel bestaat wel');
  assert.equal(c.prijs.los, null, 'maar het is niet op te tellen');
  assert.equal(c.prijs.verschil, null, 'dus er wordt geen verschil beweerd');
  assert.ok(/geen vaste prijs/i.test(c.prijs.uitleg));
});

test('5. tijd wordt met de datum bepaald, niet met een vinkje', () => {
  const vandaag = dag(0);
  assert.equal(inTijd({ van: null, tot: null }, vandaag, null), true, 'zonder datums geldt het altijd');
  assert.equal(inTijd({ van: dag(-10), tot: dag(-1) }, vandaag, null), false, 'afgelopen is afgelopen');
  assert.equal(inTijd({ van: dag(3), tot: dag(9) }, vandaag, null), false, 'nog niet aan de beurt');
  assert.equal(inTijd({ van: dag(-1), tot: dag(1) }, vandaag, null), true, 'loopt nu');
  // en wie een periode zoekt, ziet wat in DIE periode valt
  assert.equal(inTijd({ van: dag(20), tot: dag(30) }, vandaag, { van: dag(18), tot: dag(25) }), true,
    'een seizoen dat in de gezochte periode valt, telt mee');
  assert.equal(inTijd({ van: dag(40), tot: dag(50) }, vandaag, { van: dag(18), tot: dag(25) }), false,
    'een seizoen daarbuiten niet');
});

test('6. wat buiten de tijd valt wordt geteld, zodat "niets" niet op "nooit iets" lijkt', () => {
  const m = bouwCollecties([
    bundel({ id: 'nu', van: dag(-1), tot: dag(1) }),
    bundel({ id: 'oud', van: dag(-30), tot: dag(-20) }),
    bundel({ id: 'straks', van: dag(20), tot: dag(30) })
  ], [aanbodje('a', 50), aanbodje('b', 45)]);
  const d = m.collecties({});
  assert.deepEqual(d.collecties.map(c => c.id), ['nu'], 'alleen wat nu loopt');
  assert.equal(d.buitenTijd, 2, 'en er wordt geteld dat er twee buiten de tijd vielen');
});

test('7. alle vier de soorten bestaan en zijn los op te vragen', async () => {
  const r = await api(base, '/api/mall/collecties', {}, lid);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.soorten, SOORTEN);
  assert.deepEqual(SOORTEN, ['collectie', 'bundel', 'evenement', 'seizoen']);
  const perSoort = await api(base, '/api/mall/collecties', { soort: 'evenement' }, lid);
  assert.equal(perSoort.status, 200, 'filteren op soort werkt');
});

/* ---------------------------------------------------------------------------
   8-11. Samenstellen: wie mag wat, en wat wordt geweigerd.
   --------------------------------------------------------------------------- */

test('8. een zaak stelt via haar eigen scherm een bundel samen uit haar eigen aanbod', async () => {
  // een echte leveranciersinlog: code + medewerker + pincode
  const roster = await api(base, '/api/supplier/roster', { code: 'KAITO' });
  const man = (roster.body.staff || []).find(x => x.role === 'manager');
  assert.ok(man, 'de demo-zaak heeft een manager: ' + JSON.stringify(roster.body).slice(0, 200));
  const inlog = await api(base, '/api/supplier/login', { code: 'KAITO', staffId: man.id, pin: '1234' });
  const zaak = inlog.body.token;
  assert.ok(zaak, 'de manager kan inloggen: ' + JSON.stringify(inlog.body).slice(0, 200));

  const z = await api(base, '/api/mall/zoek', { per: 60 }, lid);
  const eigen = z.body.items.filter(a => a.aanbieder.code === 'KAITO');
  assert.ok(eigen.length >= 2, 'deze zaak heeft minstens twee dingen in de Mall staan (' + eigen.length + ')');

  const r = await api(base, '/api/supplier/mall/collectie/zet', {
    soort: 'bundel', titel: 'Avond bij ons', regels: [eigen[0].id, eigen[1].id], bundelPrijs: 5
  }, zaak);
  assert.equal(r.status, 200, 'de zaak mag haar eigen aanbod bundelen: ' + JSON.stringify(r.body).slice(0, 200));
  assert.equal(r.body.collectie.aantal, 2);

  // en hij staat daarna gewoon in de publieke Mall
  const publiek = await api(base, '/api/mall/collecties', { soort: 'bundel' }, lid);
  assert.ok(publiek.body.collecties.some(c => c.id === r.body.collectie.id),
    'de bundel van de zaak staat in de Mall');

  const mijn = await api(base, '/api/supplier/mall/collecties', {}, zaak);
  assert.ok(mijn.body.collecties.some(c => c.id === r.body.collectie.id), 'en in haar eigen overzicht');

  const weg = await api(base, '/api/supplier/mall/collectie/weg', { id: r.body.collectie.id }, zaak);
  assert.equal(weg.status, 200, 'en zij kan hem ook weer weghalen');
});

test('9. andermans aanbod bundelen wordt geweigerd', async () => {
  const z = await api(base, '/api/mall/zoek', { per: 60 }, lid);
  const codes = [...new Set(z.body.items.map(a => a.aanbieder.code).filter(Boolean))];
  assert.ok(codes.length >= 2, 'er zijn minstens twee zaken met aanbod');
  const eersteVanA = z.body.items.find(a => a.aanbieder.code === codes[0]);
  const eersteVanB = z.body.items.find(a => a.aanbieder.code === codes[1]);

  const m = bouwCollecties([], [eersteVanA, eersteVanB]);
  const r = m.zet(codes[0], 'Zaak A', {
    soort: 'bundel', titel: 'Van ons allebei', regels: [eersteVanA.id, eersteVanB.id], bundelPrijs: 10
  });
  assert.equal(r.status, 403, 'een zaak mag niet met andermans aanbod bundelen');
  assert.ok(/eigen aanbod/i.test(r.error), r.error);

  // het kantoor mag het wel: dat is nou juist wat een RTG-collectie is
  const rtg = m.zet('rtg', 'Rahul Travel Group', {
    soort: 'collectie', titel: 'Een dag uit', regels: [eersteVanA.id, eersteVanB.id]
  });
  assert.equal(rtg.ok, true, 'het kantoor stelt wel over zaken heen samen: ' + (rtg.error || ''));
});

test('10. een evenement zonder datum en een seizoen zonder periode worden geweigerd', () => {
  const m = bouwCollecties([], [aanbodje('a', 10), aanbodje('b', 20)]);
  const ev = m.zet('rtg', 'RTG', { soort: 'evenement', titel: 'Markt', regels: ['a', 'b'] });
  assert.equal(ev.status, 400);
  assert.ok(/datum/i.test(ev.error), ev.error);

  const se = m.zet('rtg', 'RTG', { soort: 'seizoen', titel: 'Winter', regels: ['a', 'b'], van: dag(1) });
  assert.equal(se.status, 400, 'een seizoen met alleen een begin is geen seizoen');
  assert.ok(/begin en een eind/i.test(se.error), se.error);

  const goed = m.zet('rtg', 'RTG', { soort: 'evenement', titel: 'Markt', regels: ['a', 'b'], van: dag(5) });
  assert.equal(goed.ok, true, 'met een datum mag het wel: ' + (goed.error || ''));
});

test('11. aanbod dat niet bestaat kan niet in een collectie, en een van een is geen collectie', () => {
  const m = bouwCollecties([], [aanbodje('a', 10), aanbodje('b', 20)]);
  const spook = m.zet('rtg', 'RTG', { soort: 'collectie', titel: 'Spook', regels: ['a', 'bestaat-niet'] });
  assert.equal(spook.status, 400);
  assert.ok(/staat niet in de Mall/i.test(spook.error), spook.error);

  const een = m.zet('rtg', 'RTG', { soort: 'collectie', titel: 'Eentje', regels: ['a'] });
  assert.equal(een.status, 400, 'een set van een is gewoon een aanbod');
  assert.ok(/minstens twee/i.test(een.error), een.error);

  const dubbel = m.zet('rtg', 'RTG', { soort: 'collectie', titel: 'Dubbel', regels: ['a', 'a', 'b'] });
  assert.equal(dubbel.ok, true);
  assert.equal(dubbel.collectie.aantal, 2, 'dubbele ids tellen een keer');
});
