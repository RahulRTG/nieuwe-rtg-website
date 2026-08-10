/* Ronde: de kasvooruitblik.

   Vier beweringen:

   1. ZONDER SALDO IS ER EEN BEWEGING, GEEN STAND. RTG ziet geen bankrekening.
      Een kaspositie zonder beginsaldo is geen positie, en die twee door elkaar
      halen is hoe iemand denkt dat het goed komt terwijl de rekening leeg is.
   2. DE ONZEKERHEID LIGT NIET SYMMETRISCH, EN DAT IS EXPRES. Te late
      debiteuren tellen NIET mee als inkomend; te late crediteuren tellen WEL
      mee als uitgaand. Beide keuzes maken het beeld somberder.
   3. DE BTW IS GEEN KOSTENPOST MAAR GAAT ER WEL AF. Het is geld dat nooit van
      de zaak was.
   4. EEN OUD SALDO IS GEEN SALDO. Wie er drie maanden geleden een intypte,
      hoort dat te horen voordat hij erop stuurt.

   Draai los: node --experimental-sqlite --test test/onderneming-kas.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

/* Koppelen vraagt sinds deze ronde BEWIJS dat de zaak van de aanvrager is: in
   de route komt dat uit de sessie (een actieve beheerplek in het
   personeelsregister), of uit de eigen aanvraag waar RTG de zaak uit maakte.
   Een toets heeft geen sessie, dus zegt hij het hier met zoveel woorden: in
   deze opzet IS de zaak van dit lid. Zonder deze regel zou een toets stil
   uitgaan van een recht dat de code niet meer geeft. */
const MIJN_ZAAK = () => true;

const maakOnderneming = require('../server/kern/onderneming');
const KAS = require('../server/kern/onderneming/kas');

const DAG = 86400000;
const NU = Date.parse('2026-07-01T12:00:00Z');
const dag = (n) => new Date(NU + n * DAG).toISOString().slice(0, 10);

function uit(over) {   // een factuur die IK verstuurde (debiteur)
  return Object.assign({
    id: 'v' + Math.random().toString(16).slice(2, 8), nummer: 'V-1',
    verkoper: { code: 'GLAS', naam: 'Glas' }, koper: { supplierCode: null, codenaam: 'Reiger' },
    subtotaal: 1000, btwBedrag: 0, totaal: 1000,
    datum: dag(-20), at: new Date(NU - 20 * DAG).toISOString(),
    betaald: false, betaaltermijn: 14, vervaldatum: dag(10)
  }, over || {});
}
function inkomend(over) {   // een factuur die IK moet betalen (crediteur)
  return Object.assign(uit(), {
    id: 'i' + Math.random().toString(16).slice(2, 8), nummer: 'L-1',
    verkoper: { code: 'LEV', naam: 'Groothandel' }, koper: { supplierCode: 'GLAS' }
  }, over || {});
}

function stubKern(facturen) {
  const zaak = { code: 'GLAS', name: 'Glas', type: 'zzp', city: 'Haarlem', staff: [{ id: 1 }], online: true,
    salon: { bio: 'Wij wassen ramen bij bedrijven in Haarlem.', foto: 'f.jpg' },
    rondleiding: { kassa: 'j', werk: 'j' }, services: [{ id: 's', name: 'R', price: 1 }],
    boekingen: [], orders: [] };
  const data = { ondernemingen: [], suppliers: [zaak], posts: [], vakOffertes: [],
    facturen: facturen || [], werkruimtes: {},
    supplierTypes: { zzp: { label: 'Zelfstandige', caps: ['services', 'agenda'] } }, thuisHuizen: {} };
  const db = require('../server/kern/werkvormen').haakAan({ data });
  return maakOnderneming({
    db, save: () => {}, crypto: require('crypto'),
    schoon: (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : ''),
    ondernemerpoort: require('../server/opzet/salonregel')({ data }).ondernemerpoort,
    findSupplier: (code) => (code === 'GLAS' ? zaak : null),
    ordersVanZaak: () => [], boekingenVanZaak: () => zaak.boekingen,
    aanmeldingen: { aanvraag: () => ({ ok: true, aanmelding: { id: 'x' } }), een: () => ({ status: 404 }) }
  });
}

function ond(K, koppel) {
  const o = K.ondernemingVind(K.ondernemingNieuw('LID1', { naam: 'Proef' }).onderneming.id);
  if (koppel !== false) K.ondernemingKoppel(o, 'GLAS', MIJN_ZAAK);
  return o;
}

/* ---------------- de optelsom ---------------- */

test('inkomend min uitgaand min btw is de beweging', () => {
  const K = stubKern([
    uit({ totaal: 3000, vervaldatum: dag(10) }),
    inkomend({ totaal: 1000, vervaldatum: dag(5) }),
    uit({ totaal: 500, btwBedrag: 200, vervaldatum: dag(20), betaald: true })  // btw telt, factuur is betaald
  ]);
  const k = K.ondernemingKas(ond(K), NU);
  assert.equal(k.venster, 30);
  assert.equal(k.inkomend.bedrag, 3000);
  assert.equal(k.uitgaand.bedrag, 1000);
  assert.equal(k.btwOpzij.bedrag, 200, 'de btw van alle facturen van dit jaar');
  assert.equal(k.beweging, 1800);
});

/* GEVONDEN DOOR EEN ADVERSARIELE KEURING VAN DEZE TAK. De vooruitblik rekende
   over `deb.posten` en `cred.posten`, en dat is de SCHERMLIJST van vijftig --
   gesorteerd op meest vervallen, dus wat er nog netjes bij liep viel er als
   eerste af. Precies wat de kas als inkomend zoekt. Een zaak met meer dan
   vijftig openstaande facturen kreeg een te lage beweging, en daar hangt een
   waarschuwing aan waar iemand een besluit op neemt. */
test('de vooruitblik telt over ALLE posten en niet over de schermlijst van vijftig', () => {
  const facturen = [];
  /* Vijftig die allang vervallen zijn: die vullen de schermlijst helemaal. */
  for (let i = 0; i < 50; i++) {
    facturen.push(uit({ vervaldatum: dag(-90 - i), totaal: 100 }));
  }
  /* En vijf die netjes binnen het venster vervallen -- het geld dat er echt
     aankomt. Zij staan achteraan en vielen dus buiten de vijftig. */
  for (let i = 0; i < 5; i++) {
    facturen.push(uit({ vervaldatum: dag(5), totaal: 1000 }));
  }
  const K = stubKern(facturen);
  const o = ond(K);
  const d = K.ondernemingDebiteuren(o, NU);
  assert.equal(d.posten.length, 50, 'de schermlijst blijft vijftig lang');
  assert.equal(d.alle.length, 55, 'maar er is een volledige lijst om mee te rekenen');

  const k = K.ondernemingKas(o, NU, 30);
  assert.equal(k.inkomend.aantal, 5, 'alle vijf de lopende facturen tellen mee');
  assert.equal(k.inkomend.bedrag, 5000);
});

test('wat buiten het venster valt telt niet mee', () => {
  const K = stubKern([
    uit({ totaal: 3000, vervaldatum: dag(10) }),
    uit({ totaal: 9000, vervaldatum: dag(90) })
  ]);
  const o = ond(K);
  assert.equal(K.ondernemingKas(o, NU).inkomend.bedrag, 3000);
  assert.equal(K.ondernemingKas(o, NU, 120).inkomend.bedrag, 12000, 'met een ruimer venster wel');
});

/* ---------------- de asymmetrie ---------------- */

test('een te late debiteur telt NIET mee als inkomend, maar staat wel apart', () => {
  const K = stubKern([
    uit({ totaal: 2000, vervaldatum: dag(5) }),      // komt eraan
    uit({ totaal: 8000, vervaldatum: dag(-40) })     // al te laat
  ]);
  const k = K.ondernemingKas(ond(K), NU);
  assert.equal(k.inkomend.bedrag, 2000, 'te laat is precies de reden om er niet op te rekenen');
  assert.equal(k.onzeker.bedrag, 8000);
  assert.equal(k.onzeker.aantal, 1);
  assert.ok(k.onzeker.uitleg.includes('valt het mee'));
  assert.equal(k.beweging, 2000, 'de onzekere post zit niet in de beweging');
});

test('een te late crediteur telt WEL mee als uitgaand', () => {
  const K = stubKern([
    inkomend({ totaal: 1000, vervaldatum: dag(5) }),
    inkomend({ totaal: 4000, vervaldatum: dag(-40) })
  ]);
  const k = K.ondernemingKas(ond(K), NU);
  assert.equal(k.uitgaand.bedrag, 5000, 'wat u te laat bent, moet u sowieso nog betalen');
  assert.equal(k.beweging, -5000);
});

test('beide keuzes samen maken het beeld somberder, en dat is de bedoeling', () => {
  const K = stubKern([
    uit({ totaal: 10000, vervaldatum: dag(-40) }),      // onzeker, telt niet mee
    inkomend({ totaal: 3000, vervaldatum: dag(-40) })   // te laat, telt wel mee
  ]);
  const k = K.ondernemingKas(ond(K), NU);
  assert.equal(k.beweging, -3000,
    'een optimistische lezing zou hier +7000 zeggen; dat is de lezing die mensen failliet laat gaan');
});

/* ---------------- de stand ---------------- */

test('zonder opgegeven saldo is er een beweging en geen stand', () => {
  const K = stubKern([uit({ totaal: 1000, vervaldatum: dag(5) })]);
  const k = K.ondernemingKas(ond(K), NU);
  assert.equal(k.stand, null);
  assert.ok(k.voorbehoud.includes('beweging en geen kaspositie'));
});

test('met een saldo komt er een eindstand bij', () => {
  const K = stubKern([inkomend({ totaal: 4000, vervaldatum: dag(5) })]);
  const o = ond(K);
  K.ondernemingKasSaldo(o, 10000, NU);
  const k = K.ondernemingKas(o, NU);
  assert.equal(k.stand.start, 10000);
  assert.equal(k.beweging, -4000);
  assert.equal(k.stand.eind, 6000);
  assert.equal(k.stand.verouderd, false);
  assert.ok(k.voorbehoud.includes('saldo dat u zelf opgaf'));
});

test('een saldo van drie maanden geleden is geen saldo', () => {
  const K = stubKern([uit({ totaal: 1000, vervaldatum: dag(5) })]);
  const o = ond(K);
  K.ondernemingKasSaldo(o, 10000, NU - 95 * DAG);
  const k = K.ondernemingKas(o, NU);
  assert.equal(k.stand.verouderd, true);
  assert.equal(k.stand.dagenOud, 95);
  assert.ok(k.stand.let.includes('werk het bij'));
});

test('een saldo dat geen getal is wordt geweigerd', () => {
  const K = stubKern([]);
  const o = ond(K);
  assert.equal(K.ondernemingKasSaldo(o, 'veel').status, 400);
  assert.equal(K.ondernemingKasSaldo(o, -500, NU).ok, true, 'rood staan mag: dat is een geldig saldo');
  assert.equal(K.ondernemingKas(o, NU).stand.start, -500);
});

/* ---------------- de opvolging ---------------- */

test('alleen een negatieve beweging is een actie', () => {
  const goed = stubKern([uit({ totaal: 5000, vervaldatum: dag(5) })]);
  assert.equal(KAS.kasOpvolging(goed.ondernemingKas(ond(goed), NU)), null,
    'een positieve maand is geen waarschuwing');

  const K = stubKern([inkomend({ totaal: 5000, vervaldatum: dag(5) })]);
  const v = KAS.kasOpvolging(K.ondernemingKas(ond(K), NU));
  assert.ok(v.kop.includes('5000 euro meer uit'));
  assert.ok(v.waarom.includes('bankrekening niet'), 'zonder saldo zeggen we dat wij het niet kunnen beoordelen');
});

test('met een vers saldo noemt de waarschuwing de eindstand', () => {
  const K = stubKern([inkomend({ totaal: 5000, vervaldatum: dag(5) })]);
  const o = ond(K);
  K.ondernemingKasSaldo(o, 3000, NU);
  const v = KAS.kasOpvolging(K.ondernemingKas(o, NU));
  assert.ok(v.waarom.includes('-2000'), 'dan is het wel te beoordelen: ' + v.waarom);
});

/* ---------------- de grenzen ---------------- */

test('zonder zaak is er geen kasbeeld', () => {
  const K = stubKern([]);
  assert.equal(K.ondernemingKas(ond(K, false), NU), null,
    'zonder zaak bestaan debiteuren en crediteuren niet eens');
});

test('het voorbehoud noemt wat er niet in zit', () => {
  const K = stubKern([uit({ totaal: 1000, vervaldatum: dag(5) })]);
  const k = K.ondernemingKas(ond(K), NU);
  assert.ok(k.voorbehoud.includes('Nieuwe omzet'));
  assert.ok(k.voorbehoud.includes('buiten RTG'));
});

test('het dagbeeld zet de kasvooruitblik bovenaan het geldblok', () => {
  const K = stubKern([
    inkomend({ totaal: 5000, vervaldatum: dag(5) }),
    inkomend({ totaal: 400, vervaldatum: dag(-40) })
  ]);
  const d = K.ondernemingDagbeeld(ond(K), NU);
  const iKas = d.acties.findIndex(a => a.id === 'kas');
  const iCred = d.acties.findIndex(a => a.id === 'crediteuren');
  assert.ok(iKas >= 0 && iCred >= 0, 'allebei staan er');
  assert.ok(iKas < iCred, 'de optelsom zegt meer dan de losse post eronder');
  assert.ok(d.kas, 'en het beeld hangt aan het dagbeeld');
});
