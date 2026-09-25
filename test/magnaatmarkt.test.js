/* Magnaat V3 LEVENDE MARKT: Oudwijk met concurrenten, kopers, wijken, weer en
   seizoen. Wat je verkoopt is een aandeel; concurrenten reageren op je prijs en
   maken fouten; een klant uit de markt heeft een offerte van een ander naast
   zich; en waar je zit, kost huur en brengt zichtbaarheid. Alles
   deterministisch: hetzelfde leven geeft hetzelfde weer. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakLeven } = require('../server/kern/magnaat-leven');
const R = require('../server/kern/magnaat-leven/regels');
const M = require('../server/kern/magnaat-leven/regels-markt');
const markt = require('../server/kern/magnaat-leven/markt');
const { kalender, weerVan } = require('../server/kern/magnaat-leven/kalender');
const { zorgBedrijf } = require('../server/kern/magnaat-leven/staat');
const { boekVan } = require('../server/kern/magnaat-leven/boek');

function leven(key = 'lid') {
  let t = 1e12;
  const db = { data: {} };
  const L = maakLeven({ db, nu: () => t });
  const v = {
    db, L, s: L.staat(key),
    st: () => db.data.magnaatLeven[key],
    doe(b) { const r = L.actie(key, b); if (!r.error) v.s = r; return r; },
    ok(b) { const r = v.doe(b); assert.ok(!r.error, b.actie + ': ' + r.error); return r; },
    slaap(n = 1) { for (let i = 0; i < n; i++) v.doe({ actie: 'slaap' }); return v.s; },
    tot(w) { for (let i = 0; i < 7 && R.weekdag(v.s.dag) !== w; i++) v.slaap(); assert.equal(R.weekdag(v.s.dag), w); return v.s; },
    saldo: (rek) => ((v.st().boek.rekeningen[v.st().wereld + ':' + rek] || {}).saldo || 0),
    meldt: (re) => v.st().meldingen.some(m => re.test(m.tekst))
  };
  return v;
}
function ondernemer(aanbod = 'websites', key) {
  const v = leven(key);
  v.ok({ actie: 'kies', aanbod });
  v.tot(R.BAAN.loondag + 1);
  v.st().ondernemingVraag = v.s.dag;
  v.ok({ actie: 'onderneming', naam: 'Proef Oudwijk' });
  boekVan(v.st()).boekOver(v.st(), { soort: 'OPENING', van: ['begin'], naar: ['kas'], bedrag: 500000, omschrijving: 'Opgebouwd in V1', sleutel: 'proefkapitaal' });
  v.s = v.L.staat(key || 'lid');
  return v;
}
/* Een losse staat om het aandeel te rekenen, zonder een heel leven. */
const kaal = (aanbod, prijsPct, wijk = 'thuis', deals = []) => {
  const st = zorgBedrijf({ wereld: 'proef', dag: 1, deals, aanbod, onderneming: { naam: 'Jij' },
    handel: { prijs: Math.round(require('../server/kern/magnaat-leven/regels-bedrijf').HANDELSWAAR[aanbod].advies * prijsPct / 100) } });
  st.vestiging.wijk = wijk;
  return st;
};

test('de kalender: dag 1 is maart en lente, een maand duurt vier weken, en het weer volgt het seizoen', () => {
  const v = leven();
  assert.equal(v.s.kalender.maand, 'maart');
  assert.equal(v.s.kalender.seizoen, 'lente');
  assert.equal(kalender(v.st(), 29).maand, 'april');
  assert.equal(kalender(v.st(), 1 + 3 * 28).seizoen, 'zomer');
  const telling = (van) => { let zon = 0; for (let d = van; d < van + 84; d++) if (weerVan(v.st(), d) === 'zon') zon++; return zon; };
  const zomer = telling(1 + 3 * 28), winter = telling(1 + 9 * 28);
  assert.ok(zomer > 84 * 0.4, 'in de zomer is het meer dan 40% van de dagen zonnig: ' + zomer);
  assert.ok(winter < 84 * 0.25, 'in de winter minder dan een kwart: ' + winter);
});

test('het weer is vast voor een leven en anders voor een ander leven', () => {
  const a = leven('a'), b = leven('b'), a2 = leven('a');
  const reeks = (v) => Array.from({ length: 60 }, (_, i) => weerVan(v.st(), i + 1)).join();
  assert.equal(reeks(a), reeks(a2));
  assert.notEqual(reeks(a), reeks(b));
});

test('verkopen is een marktaandeel: goedkoper, zichtbaarder en een betere naam verkopen meer', () => {
  const aandeel = (...x) => markt.aandelen(kaal(...x)).jij;
  assert.ok(aandeel('foto', 100, 'centrum') > aandeel('foto', 100, 'oost'));
  assert.ok(aandeel('foto', 100, 'oost') > aandeel('foto', 100, 'thuis'));
  assert.ok(aandeel('foto', 80) > aandeel('foto', 100));
  assert.ok(aandeel('foto', 200) < aandeel('foto', 100) / 2);
  const goed = Array.from({ length: 6 }, (_, i) => ({ id: 'd' + i, klantId: 'k' + i, fase: 'betaald' }));
  assert.ok(aandeel('foto', 100, 'thuis', goed) > aandeel('foto', 100), 'zes tevreden klanten geven je een naam');
  const a = markt.aandelen(kaal('foto', 100));
  assert.ok(Math.abs(Object.values(a).reduce((s, x) => s + x, 0) - 1000) <= 2, 'samen is het de hele markt');
});

test('het seizoen verschuift de vraag: prints voor de feestdagen, tablets bij het terras', () => {
  const st = kaal('foto', 100), winter = (d) => markt.mijnVraag(Object.assign(st, { dag: d }));
  const zomer = winter(1 + 4 * 28), kerst = winter(1 + 9 * 28);
  assert.ok(kerst > 1.5 * zomer, 'in de winter meer prints dan in de zomer');
  const t = kaal('websites', 100);
  assert.ok(markt.mijnVraag(Object.assign(t, { dag: 1 + 4 * 28 })) > markt.mijnVraag(Object.assign(t, { dag: 1 + 9 * 28 })));
});

test('concurrenten reageren op je prijs, maar nooit onder hun bodem', () => {
  const v = ondernemer('foto');
  v.ok({ actie: 'bestel', aantal: 50 });
  v.ok({ actie: 'prijs', bedrag: 25 });
  for (let i = 0; i < 10; i++) { v.slaap(7); }
  const prijzen = v.st().markt.prijzen;
  assert.ok(Object.keys(prijzen).filter(id => ['licht', 'kader', 'klik'].includes(id)).some(id => prijzen[id] < M.CONCURRENTEN.foto.find(c => c.id === id).prijs),
    'minstens een concurrent is in prijs gezakt');
  for (const c of M.CONCURRENTEN.foto) assert.ok(prijzen[c.id] >= M.REACTIE.bodem);
  assert.ok(v.meldt(/verlaagt zijn prijs/));
});

test('een concurrent maakt een fout, en zijn klant komt bij jou met een offerte van een ander', () => {
  const v = ondernemer('websites');
  let i = 0;
  while (!v.st().markt.klanten.length && i++ < 12) v.slaap(7);
  const k = v.st().markt.klanten[0];
  assert.ok(k, 'binnen twaalf weken komt er een klant uit de markt');
  assert.ok(k.offerte && k.offerte.bedrag > 0);
  const d = v.s.netwerk.contacten.find(x => x.klant === k.naam);
  v.ok({ actie: 'gesprek', deal: d.id });
  assert.ok(v.meldt(new RegExp('offerte van ' + k.offerte.van)));
  v.ok({ actie: 'voorstel', deal: d.id, bedrag: Math.ceil(k.offerte.bedrag * 1.3 / 100), voorschot: 0 });
  assert.equal(v.s.netwerk.contacten.find(x => x.id === d.id).fase, 'onderhandeling', 'ver boven de concurrent zegt hij nee');
  v.ok({ actie: 'voorstel', deal: d.id, bedrag: Math.floor(k.offerte.bedrag / 100), voorschot: 0 });
  assert.equal(v.s.netwerk.contacten.find(x => x.id === d.id).fase, 'overeenkomst', 'voor de prijs van de concurrent wel');
});

test('verhuizen kost geld en huur, maakt je zichtbaarder, en je team heeft dan geen losse werkplek meer nodig', () => {
  const v = ondernemer('foto');
  assert.match(v.doe({ actie: 'vestig', wijk: 'thuis' }).error, /al in Thuis/);
  const kas = v.s.geld.bank, w = M.WIJKEN.centrum;
  v.ok({ actie: 'vestig', wijk: 'centrum' });
  assert.equal(v.s.geld.bank, kas - w.verhuis - w.huur);
  assert.equal(v.saldo('kosten:huisvesting'), w.verhuis + w.huur);
  assert.equal(v.s.wereld.markt.wijk, 'centrum');
  v.ok({ actie: 'werf', kandidaat: 'kim' });
  assert.equal(v.saldo('kosten:werkplek'), 0, 'geen losse werkplek in je eigen ruimte');
  assert.ok(v.s.geld.prognose.weken.some(x => x.uit >= w.huur), 'de volgende huur staat in de prognose');
  v.slaap(28);
  assert.equal(v.saldo('kosten:huisvesting'), w.verhuis + 2 * w.huur, 'na vier weken de tweede huur');
  assert.equal(v.L.verifieer('lid').ok, true);
});

test('zonder onderneming geen bedrijfsruimte', () => {
  const v = leven();
  v.ok({ actie: 'kies', aanbod: 'foto' });
  assert.match(v.doe({ actie: 'vestig', wijk: 'oost' }).error, /als onderneming/);
});

test('dezelfde keuzes geven dezelfde markt', () => {
  const speel = (key) => {
    const v = ondernemer('foto', key);
    v.ok({ actie: 'bestel', aantal: 20 });
    v.slaap(40);
    return JSON.stringify([v.st().markt, v.st().handel, v.st().meldingen.map(m => m.tekst)]);
  };
  assert.equal(speel('zelfde'), speel('zelfde'));
});
