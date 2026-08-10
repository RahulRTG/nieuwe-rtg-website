/* RTG Geld, de samenhanglaag. Zelfde beloftes als de andere werelden -- bezit
   niets, verzint niets, meldt stille bronnen -- plus de regel die alleen hier
   geldt: DEZE LAAG TELT NIETS ZELF OP. Elk bedrag komt uit de module die hem
   bijhoudt; een geldscherm dat een ander getal toont dan de wallet is erger
   dan geen geldscherm (LAT.md regel 4). */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakGeldwereld } = require('../server/kern/geldwereld');

const VANDAAG = new Date().toISOString().slice(0, 10);
const dagen = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

function kernMet(over) {
  const k = {
    codenaamVan: (key) => 'CODE-' + key,
    pay: { rekLid: (c) => 'lid:' + c, saldoVan: () => 0 },
    wbwMijn: () => ({ groepen: [] }),
    /* mecenaatKijk en niet mecenaat: de samenhanglaag leest sinds de
       keuring via de kijk-variant, die het lifestyle-dossier NIET
       aanmaakt voor wie alleen keek (zie kern/rechterhand/mecenaat.js).
       De stub volgt de echte vorm: een kale lijst giften. */
    mecenaatKijk: () => []
  };
  Object.assign(k, over || {});
  return k;
}
const wereld = (over) => maakGeldwereld({ kern: kernMet(over) }).geldwereld;

test('bezit niets: er is geen enkele manier om iets te schrijven', () => {
  /* DE MUTATIE: voeg `boek` toe aan het teruggegeven object. Dat is het begin
     van een tweede boekhouding naast pay, dat al dubbel boekhoudt. */
  assert.deepEqual(Object.keys(wereld()), ['stand'],
    'de geldwereld hoort ALLEEN te kunnen lezen');
});

test('het walletsaldo komt uit pay, via de rekeningregel van pay zelf', () => {
  /* De vorm 'lid:' + codenaam is een regel van het pay-domein. Deze toets legt
     vast dat de geldwereld die regel LEENT (pay.rekLid) en niet natikt: de
     nep-pay hieronder geeft alleen saldo op de rekening die zijn eigen
     rekLid teruggeeft. Een natikte vorm zou hier nul lezen. */
  const w = wereld({
    codenaamVan: () => 'RTG-X9',
    pay: { rekLid: (c) => 'REK[' + c + ']', saldoVan: (r) => r === 'REK[RTG-X9]' ? 12345 : 0 }
  });
  const r = w.stand('k');
  const saldo = r.regels.find(x => x.soort === 'saldo');
  assert.equal(saldo.centen, 12345, 'het saldo hoort via pay.rekLid gelezen te worden');
  assert.equal(saldo.sig, 'gezond');
});

test('bedragen blijven centen: hier wordt niet afgerond of gedeeld', () => {
  /* DE MUTATIE: deel centen door 100 in regel(). Het scherm deelt OOK, en dan
     staat er ineens een honderdste van het saldo. */
  const w = wereld({ pay: { rekLid: (c) => c, saldoVan: () => 199 } });
  assert.equal(w.stand('k').regels[0].centen, 199,
    'centen horen rauw door te komen; euro maken doet het scherm, een keer');
});

test('alleen lijstjes met een saldo dat niet nul is', () => {
  /* Een lijstje dat glad staat is geen openstaande zaak; het tonen zou dit
     beeld een tweede wbw-app maken. */
  const w = wereld({ wbwMijn: () => ({ groepen: [
    { id: 'g1', naam: 'Skireis', mijnSaldo: -2500 },
    { id: 'g2', naam: 'Glad', mijnSaldo: 0 },
    { id: 'g3', naam: 'Diner', mijnSaldo: 800 }
  ] }) });
  const r = w.stand('k');
  /* De walletregel staat er ALTIJD bij (dat is het punt van een stand), dus de
     lijstjes staan ervoor: gedeeld (actief) rangschikt boven gezond. */
  assert.deepEqual(r.regels.map(x => x.kenmerk), ['g1', 'g3', 'wallet']);
  assert.equal(r.regels[0].wacht, 'de ander', 'een verrekening wacht per definitie op iemand');
  assert.equal(r.telling.wachtend, 2);
});

test('een verlopen toezegging is een incident, een lopende niet', () => {
  const w = wereld({ mecenaatKijk: () => [
    { id: 'm1', doel: 'Onderwijs', bedrag: 50000, betaald: false, datum: dagen(-3) },
    { id: 'm2', doel: 'Natuur', bedrag: 25000, betaald: false, datum: dagen(30) },
    { id: 'm3', doel: 'Betaald al', bedrag: 10000, betaald: true, datum: dagen(-9) }
  ] });
  const r = w.stand('k');
  assert.deepEqual(r.regels.map(x => x.kenmerk), ['m1', 'm2', 'wallet'], 'betaalde giften horen hier niet');
  assert.equal(r.regels[0].sig, 'incident');
  assert.equal(r.regels[1].sig, 'actief');
});

/* DE BELANGRIJKSTE TOETS, en bij geld weegt hij het zwaarst: een geldbeeld
   zonder de openstaande verrekeningen LIJKT gezond, en dan doet iemand een
   uitgave die hij niet had gedaan.
   DE MUTATIE: haal stil.push(naam) uit bron(). */
test('een bron die stukgaat wordt gemeld en neemt de andere niet mee', () => {
  const w = wereld({
    wbwMijn: () => { throw new Error('wbw stuk'); },
    pay: { rekLid: (c) => c, saldoVan: () => 500 }
  });
  const r = w.stand('k');
  assert.deepEqual(r.stil, ['verrekeningen']);
  assert.equal(r.regels.length, 1, 'de wallet hoort gewoon door te lopen');
});

test('elke toestand die deze laag kan maken, kent hij ook', () => {
  const w = wereld({
    pay: { rekLid: (c) => c, saldoVan: () => 100 },
    wbwMijn: () => ({ groepen: [{ id: 'g1', naam: 'X', mijnSaldo: 5 }] }),
    mecenaatKijk: () => [
      { id: 'm1', doel: 'A', bedrag: 1, betaald: false, datum: dagen(-1) },
      { id: 'm2', doel: 'B', bedrag: 1, betaald: false, datum: dagen(5) }]
  });
  const r = w.stand('k');
  assert.equal(r.regels.length, 4); // wallet + lijstje + twee toezeggingen
  assert.deepEqual(r.regels.filter(x => !x.sig).map(x => x.status), []);
  assert.equal(r.telling.onbekend, 0);
});

test('de vier werelden spreken dezelfde taal', () => {
  const r = wereld().stand('k');
  assert.deepEqual(Object.keys(r).sort(), ['bronnen', 'ok', 'regels', 'stil', 'telling']);
  assert.deepEqual(Object.keys(r.telling).sort(),
    ['aandacht', 'onbekend', 'regels', 'vandaag', 'wachtend']);
});
