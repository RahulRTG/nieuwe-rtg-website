/* Ronde: de ondernemersregie -- twee knoppen van de boardroom.

   Vier beweringen:

   1. EEN ZAAK KLAARZETTEN EN EEN PAS TOEKENNEN ZIJN TWEE DINGEN. De
      provisioning-knop raakt alleen het eerste. `magAutomatischToekennen`
      blijft in elke stand false; wie die twee door elkaar haalt, zet een
      merkregel uit met een schuifje dat over iets anders leek te gaan.
   2. SOEPELER ZETTEN VRAAGT EEN NAAM, STRENGER ZETTEN NOOIT. Een terugval
      blokkeer je niet; een besluit waarmee het systeem partners gaat toelaten
      zonder mens, hoort nooit anoniem te zijn.
   3. DE BIJDRAGE IS BEGRENSD IN CODE EN NIET IN EEN INSTELLING. Ten hoogste
      5%, en de grondslag wordt nooit geraden.
   4. ONDER DE DREMPEL WORDT ER NIETS INGEHOUDEN. Dat is het punt van de hele
      constructie: bij lage omzet hoort de bijdrage beschermend te werken.

   Draai los: node --test test/onderneming-regie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const maakOnderneming = require('../server/kern/onderneming');
const REGIE = require('../server/kern/onderneming/regie');

function stubKern() {
  const zaak = { code: 'GLAS', name: 'Glas', type: 'zzp', city: 'Haarlem', staff: [{ id: 1 }], online: true,
    salon: { bio: 'Wij wassen ramen bij bedrijven in Haarlem.', foto: 'f.jpg' },
    rondleiding: { kassa: 'j', werk: 'j' }, services: [{ id: 's', name: 'K', price: 100 }],
    boekingen: [], orders: [] };
  const data = { ondernemingen: [], suppliers: [zaak], posts: [], vakOffertes: [], facturen: [],
    werkruimtes: {}, vacatures: {}, applications: {},
    supplierTypes: { zzp: { label: 'Zelfstandige', caps: ['services', 'agenda'] } }, thuisHuizen: {} };
  const db = require('../server/kern/werkvormen').haakAan({ data });
  const K = maakOnderneming({
    db, save: () => {}, crypto: require('crypto'),
    schoon: (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : ''),
    ondernemerpoort: require('../server/opzet/salonregel')({ data }).ondernemerpoort,
    findSupplier: (code) => (code === 'GLAS' ? zaak : null),
    ordersVanZaak: () => [], boekingenVanZaak: () => zaak.boekingen,
    aanmeldingen: { aanvraag: () => ({ ok: true, aanmelding: { id: 'x' } }), een: () => ({ status: 404 }) }
  });
  K._db = db;
  return K;
}

/* ---------------- zaak versus pas ---------------- */

test('de provisioning-knop raakt de zaak, nooit de pas', () => {
  const { maakAanmeldingen } = (() => ({ maakAanmeldingen: require('../server/kern/aanmeldingen') }))();
  const A = maakAanmeldingen({
    db: { data: { aanmeldingen: [], betaalschemas: [] } }, save: () => {}, crypto: require('crypto'),
    schoon: (v, n) => String(v == null ? '' : v).slice(0, n), accounts: null, anthropic: null,
    notify: () => {}, sseToOffice: () => {}, fonds: null, centen: (n) => Math.round(n)
  }).aanmeldingen;
  for (const pas of ['rtg', 'lifestyle', 'business']) {
    assert.equal(A.magAutomatischToekennen(pas), false,
      'een pas komt nooit automatisch, in welke stand de provisioning ook staat');
  }
  const bron = require('fs').readFileSync('server/kern/onderneming/regie.js', 'utf8');
  assert.ok(bron.includes('magAutomatischToekennen'),
    'de regie legt het verschil met de pas expliciet uit');
});

/* ---------------- de standen ---------------- */

test('de stand begint op mens', () => {
  const K = stubKern();
  assert.equal(K.ondernemingProvisioningStand(), 'mens');
  assert.deepEqual(K.ondernemingRegie().provisioning.standen, REGIE.STANDEN);
});

test('soepeler zetten vraagt een naam, strenger zetten niet', () => {
  const K = stubKern();
  const zonder = K.ondernemingProvisioningZet('automatisch', '');
  assert.equal(zonder.status, 400);
  assert.ok(zonder.uitleg.includes('nooit anoniem'));
  assert.equal(K.ondernemingProvisioningStand(), 'mens', 'en er is niets gewijzigd');

  assert.equal(K.ondernemingProvisioningZet('automatisch', 'Imran').ok, true);
  assert.equal(K.ondernemingProvisioningStand(), 'automatisch');

  /* Terug naar streng mag zonder naam: een terugval blokkeer je nooit. */
  assert.equal(K.ondernemingProvisioningZet('mens', '').ok, true);
  assert.equal(K.ondernemingProvisioningStand(), 'mens');
});

test('een onbekende stand wordt geweigerd, en dezelfde stand is een no-op', () => {
  const K = stubKern();
  assert.equal(K.ondernemingProvisioningZet('losbandig', 'Imran').status, 400);
  assert.equal(K.ondernemingProvisioningZet('mens', '').ongewijzigd, true);
});

test('elke wijziging komt met een naam in het journaal', () => {
  const K = stubKern();
  K.ondernemingProvisioningZet('na-termijn', 'Imran');
  K.ondernemingProvisioningZet('mens', 'Roellie');
  const j = K.ondernemingRegie().journaal;
  assert.equal(j.length, 2);
  assert.equal(j[0].naar, 'mens');
  assert.equal(j[0].door, 'Roellie');
  assert.equal(j[1].door, 'Imran');
});

/* ---------------- de bijdrage ---------------- */

test('de bijdrage staat uit en houdt dan niets in', () => {
  const K = stubKern();
  const b = K.ondernemingBijdrageOver({ centen: 100000, viaRtg: true, betaald: true });
  assert.equal(b.centen, 0);
  assert.ok(b.reden.includes('staat uit'));
  assert.equal(b.grondslag, 'via-rtg', 'de vorm is altijd dezelfde, ook als er niets uit komt');
});

test('aanzetten vraagt een naam en een percentage', () => {
  const K = stubKern();
  assert.equal(K.ondernemingBijdrageZet({ aan: true }, '').status, 400, 'zonder naam niet');
  assert.equal(K.ondernemingBijdrageZet({ aan: true }, 'Imran').status, 409,
    'en niet op nul procent: dat is een schakelaar die niets doet en wel zo lijkt');

  K.ondernemingBijdrageZet({ promille: 25 }, 'Imran');
  assert.equal(K.ondernemingBijdrageZet({ aan: true }, 'Imran').ok, true);
  assert.equal(K.ondernemingRegie().bijdrage.percentage, 2.5);
});

test('de bovengrens van vijf procent staat in code en is niet te overschrijden', () => {
  const K = stubKern();
  const r = K.ondernemingBijdrageZet({ promille: 80 }, 'Imran');
  assert.equal(r.status, 400);
  assert.ok(r.error.includes('5%'));
  assert.ok(r.uitleg.includes('niet in een instelling'));
  assert.equal(K.ondernemingRegie().bijdrage.promille, 0);
  assert.equal(REGIE.MAX_PROMILLE, 50);
});

test('de grondslag wordt nooit geraden en draagt zijn eigen waarschuwing', () => {
  const K = stubKern();
  assert.equal(K.ondernemingBijdrageZet({ grondslag: 'gevoel' }, 'Imran').status, 400);
  const beeld = K.ondernemingRegie().bijdrage;
  assert.equal(beeld.grondslag, 'via-rtg', 'de voorzichtigste stand is de beginstand');
  const totaal = beeld.grondslagen.find(g => g.id === 'totaal');
  assert.ok(totaal.let.includes('NIET meten'),
    'de grondslag die RTG niet kan meten, zegt dat zelf');
});

test('het percentage wordt exact toegepast', () => {
  const K = stubKern();
  K.ondernemingBijdrageZet({ promille: 25 }, 'Imran');
  K.ondernemingBijdrageZet({ aan: true }, 'Imran');
  const b = K.ondernemingBijdrageOver({ centen: 100000, viaRtg: true, betaald: true });
  assert.equal(b.centen, 2500, '2,5% van 1000 euro is 25 euro');
  assert.equal(b.reden, null);
});

test('onder de drempel wordt er niets ingehouden', () => {
  const K = stubKern();
  K.ondernemingBijdrageZet({ promille: 50, drempelCenten: 50000 }, 'Imran');
  K.ondernemingBijdrageZet({ aan: true }, 'Imran');

  const klein = K.ondernemingBijdrageOver({ centen: 20000, viaRtg: true, betaald: true });
  assert.equal(klein.centen, 0);
  assert.ok(klein.reden.includes('beschermend'));

  const groot = K.ondernemingBijdrageOver({ centen: 100000, viaRtg: true, betaald: true });
  assert.equal(groot.centen, 5000);
});

test('buiten RTG telt niet mee, behalve bij de grondslag die dat wel claimt', () => {
  const K = stubKern();
  K.ondernemingBijdrageZet({ promille: 50 }, 'Imran');
  K.ondernemingBijdrageZet({ aan: true }, 'Imran');
  assert.equal(K.ondernemingBijdrageOver({ centen: 100000, viaRtg: false }).centen, 0);

  K.ondernemingBijdrageZet({ grondslag: 'totaal' }, 'Imran');
  assert.equal(K.ondernemingBijdrageOver({ centen: 100000, viaRtg: false }).centen, 5000,
    'bij "totale omzet" telt het wel, en juist die grondslag waarschuwt dat RTG hem niet kan meten');
});

test('bij de grondslag "betaald" telt een onbetaalde transactie niet', () => {
  const K = stubKern();
  K.ondernemingBijdrageZet({ promille: 50, grondslag: 'betaald' }, 'Imran');
  K.ondernemingBijdrageZet({ aan: true }, 'Imran');
  assert.equal(K.ondernemingBijdrageOver({ centen: 100000, viaRtg: true, betaald: false }).centen, 0);
  assert.equal(K.ondernemingBijdrageOver({ centen: 100000, viaRtg: true, betaald: true }).centen, 5000);
});

/* ---------------- het partnerkanaal ---------------- */

test('het partnerkanaal houdt niets in zolang de bijdrage uitstaat', () => {
  const bron = require('fs').readFileSync('server/routes/member/partnerkanaal.js', 'utf8');
  assert.ok(!/rtgCut: 0\b/.test(bron), 'rtgCut is geen constante meer');
  assert.ok(bron.includes('ondernemingBijdrageOver'), 'maar leest de knop van de boardroom');
  assert.ok(bron.includes('const partnerCut = service - rtgCut;'),
    'en wat RTG inhoudt gaat van de service af, niet van de netto reissom van de aanbieder');
});
