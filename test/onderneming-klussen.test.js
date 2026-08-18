/* Ronde: de klusketen -- van akkoord tot geld, en waar hij blijft steken.

   Vijf beweringen:

   1. ER KOMT GEEN PROJECTENREGISTER BIJ. De keten bestaat al: offerte draagt
      `boekingRef`, boeking draagt `ref`, factuur draagt `ref`. Deze laag volgt
      die referenties.
   2. INGEPLAND WERK IS GEEN OPENSTAAND GELD. Werk dat nog moet gebeuren bij het
      openstaande bedrag optellen, maakt een drukke maand tot een
      incassoprobleem.
   3. GEEN FACTUUR BETEKENT NIET DAT ER NIET IS GEFACTUREERD. Het betekent dat
      wij binnen RTG er geen zien met deze referentie.
   4. DE FACTUUR WORDT OP REFERENTIE GEVONDEN EN NIET OP BEDRAG. Twee klussen
      van dezelfde klant voor hetzelfde bedrag zouden anders elkaars factuur
      opeisen.
   5. BETAALD IS BETAALD, LANGS WELKE WEG DAN OOK. De boeking kent `paid` en de
      factuur `betaald`; eisen dat ze allebei staan, toont een betaalde klus als
      onbetaald.

   Draai los: node --test test/onderneming-klussen.test.js */
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
const KLU = require('../server/kern/onderneming/klussen');

const DAG = 86400000;
const NU = Date.parse('2026-06-15T10:00:00Z');
const dag = (n) => new Date(NU + n * DAG).toISOString().slice(0, 10);
const isoTerug = (n) => new Date(NU - n * DAG).toISOString();

let t = 0;
/* Een klus als keten: een akkoord gegeven offerte, de boeking eronder, en
   eventueel de factuur. `wanneer` null betekent: nog geen datum. */
function klus(over) {
  t += 1;
  const o = Object.assign({
    id: 'OF-' + t, supplierCode: 'ZAAK', supplierName: 'Zaak', customerCodename: 'Reiger',
    customerKey: 'k' + t, customerTier: 'rtg', omschrijving: 'De ramen wassen',
    status: 'akkoord', prijs: 1000, at: isoTerug(30), antwoordAt: isoTerug(28),
    boekingRef: 'RTG-B-' + t
  }, over.offerte || {});
  const b = over.boeking === null ? null : Object.assign({
    ref: o.boekingRef, supplierCode: 'ZAAK', customerCodename: o.customerCodename,
    price: o.prijs, wanneer: null, status: 'bevestigd', paid: false, at: isoTerug(28)
  }, over.boeking || {});
  const f = over.factuur ? Object.assign({
    id: 'F-' + t, ref: o.boekingRef, datum: dag(-5), betaald: false,
    verkoper: { code: 'ZAAK' }, koper: {}, subtotaal: 826.45, btwBedrag: 173.55, totaal: 1000
  }, over.factuur) : null;
  return { o, b, f };
}

function stubKern(klussen) {
  const boekingen = klussen.map(k => k.b).filter(Boolean);
  const zaak = { code: 'ZAAK', name: 'Zaak', type: 'zzp', city: 'Haarlem', staff: [{ id: 1 }],
    online: true, salon: { bio: 'Wij wassen ramen.', foto: 'f.jpg' },
    rondleiding: { kassa: 'j', werk: 'j' }, services: [{ id: 's', name: 'K', price: 100 }],
    boekingen, orders: [] };
  const data = { ondernemingen: [], suppliers: [zaak], posts: [], thuisHuizen: {},
    vakOffertes: klussen.map(k => k.o),
    facturen: klussen.map(k => k.f).filter(Boolean),
    werkruimtes: {}, vacatures: {}, applications: {},
    supplierTypes: { zzp: { label: 'Zelfstandige', caps: ['services', 'agenda'] } } };
  const db = require('../server/kern/werkvormen').haakAan({ data });
  const K = maakOnderneming({
    db, save: () => {}, crypto: require('crypto'),
    schoon: (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : ''),
    ondernemerpoort: require('../server/opzet/salonregel')({ data }).ondernemerpoort,
    findSupplier: (c) => (c === 'ZAAK' ? zaak : null),
    ordersVanZaak: () => [], boekingenVanZaak: () => boekingen,
    aanmeldingen: { aanvraag: () => ({ ok: true }), een: () => ({ status: 404 }) }
  });
  K._data = data;
  return K;
}

function ond(K, koppel) {
  const o = K.ondernemingVind(K.ondernemingNieuw('LID1', { naam: 'Proef' }).onderneming.id);
  if (koppel !== false) K.ondernemingKoppel(o, 'ZAAK', MIJN_ZAAK);
  return o;
}
const stadium = (k, id) => k.stadia.find(s => s.id === id);

/* ---------------- de keten wordt gevolgd, niet nagebouwd ---------------- */

test('de keten wordt gevolgd op de referenties en er wordt niets geschreven', () => {
  const K = stubKern([klus({ boeking: { wanneer: dag(-3) }, factuur: {} })]);
  /* De momentopname NA het aanmaken van de onderneming: dat aanmaken schrijft
     zelf in db.data.ondernemingen, en dat is niet wat deze toets meet. */
  const o = ond(K);
  const voor = JSON.stringify(K._data);
  const k = K.ondernemingKlussen(o, NU);
  assert.equal(JSON.stringify(K._data), voor, 'alles is onaangeroerd');
  assert.equal(k.totaal, 1);
  assert.equal(k.rijen[0].offerte, 'OF-1');
  assert.equal(k.rijen[0].boeking, 'RTG-B-1');
  assert.equal(k.rijen[0].factuur, 'F-1');

  const bron = require('fs').readFileSync('server/kern/onderneming/klussen.js', 'utf8');
  assert.ok(!/\bsave\s*\(/.test(bron) && !/db\.data\.\w+\s*=/.test(bron),
    'geen enkele schrijfactie: een vierde object loopt achter op de drie die vanzelf meebewegen');
});

test('zonder akkoord gegeven offerte is er geen klusketen', () => {
  const K = stubKern([klus({ offerte: { status: 'aangeboden', boekingRef: null } })]);
  assert.equal(K.ondernemingKlussen(ond(K), NU), null,
    'nul klussen zou lezen als "u heeft niets lopen"');
});

/* ---------------- de vier stadia ---------------- */

test('elk stadium wordt herkend aan wat er echt staat', () => {
  const K = stubKern([
    klus({ boeking: { wanneer: null } }),                                  // akkoord
    klus({ boeking: { wanneer: dag(3) } }),                                // ingepland
    klus({ boeking: { wanneer: dag(-3) } }),                               // uitgevoerd
    klus({ boeking: { wanneer: dag(-9) }, factuur: {} }),                  // gefactureerd
    klus({ boeking: { wanneer: dag(-20) }, factuur: { betaald: true } })   // klaar
  ]);
  const k = K.ondernemingKlussen(ond(K), NU);
  for (const id of ['akkoord', 'ingepland', 'uitgevoerd', 'gefactureerd', 'klaar']) {
    assert.equal(stadium(k, id).aantal, 1, id);
  }
  assert.equal(k.rijen.length, 4, 'wat klaar is staat niet meer in de lijst');
});

test('de dag van vandaag telt als uitgevoerd en niet als ingepland', () => {
  const K = stubKern([klus({ boeking: { wanneer: dag(0) + 'T09:00' } })]);
  const k = K.ondernemingKlussen(ond(K), NU);
  assert.equal(stadium(k, 'uitgevoerd').aantal, 1,
    'een klus van vanochtend is vandaag gedaan');
});

test('ingepland werk telt niet mee als openstaand geld', () => {
  const K = stubKern([
    klus({ boeking: { wanneer: dag(5) } }),                  // ingepland, 1000
    klus({ boeking: { wanneer: dag(-2) } }),                 // uitgevoerd, 1000
    klus({ boeking: { wanneer: dag(-9) }, factuur: {} })     // gefactureerd, 1000
  ]);
  const k = K.ondernemingKlussen(ond(K), NU);
  assert.equal(k.buiten.aantal, 2);
  assert.equal(k.buiten.bedrag, 2000,
    'werk dat nog moet gebeuren als openstaand geld tonen, maakt een drukke maand tot een incassoprobleem');
  assert.equal(stadium(k, 'ingepland').bedrag, 1000, 'het staat er wel gewoon apart bij');
});

/* ---------------- wat wij niet weten ---------------- */

test('geen factuur betekent niet dat er niet is gefactureerd', () => {
  const K = stubKern([klus({ boeking: { wanneer: dag(-3) } })]);
  const k = K.ondernemingKlussen(ond(K), NU);
  const r = k.rijen[0];
  assert.equal(r.stadium, 'uitgevoerd');
  assert.ok(r.let.includes('buiten RTG'),
    'een scherm dat "niet gefactureerd" roept, roept iets wat het niet weet');
  assert.ok(k.nietGemeten.includes('geen doorlooptijd'));
});

test('de factuur wordt op referentie gevonden en niet op bedrag of klant', () => {
  const a = klus({ boeking: { wanneer: dag(-8) }, factuur: {} });
  const b = klus({ boeking: { wanneer: dag(-8) } });
  /* Twee klussen van dezelfde klant voor hetzelfde bedrag; alleen de eerste
     heeft een factuur. Op bedrag matchen zou de tweede die van de eerste geven. */
  const K = stubKern([a, b]);
  const k = K.ondernemingKlussen(ond(K), NU);
  const rA = k.rijen.find(r => r.offerte === a.o.id);
  const rB = k.rijen.find(r => r.offerte === b.o.id);
  assert.equal(rA.factuur, a.f.id);
  assert.equal(rB.factuur, null);
  assert.equal(rB.stadium, 'uitgevoerd');
});

test('betaald is betaald, langs welke van de twee wegen dan ook', () => {
  const viaFactuur = klus({ boeking: { wanneer: dag(-9) }, factuur: { betaald: true } });
  const viaKassa = klus({ boeking: { wanneer: dag(-9), paid: true }, factuur: { betaald: false } });
  const K = stubKern([viaFactuur, viaKassa]);
  const k = K.ondernemingKlussen(ond(K), NU);
  assert.equal(stadium(k, 'klaar').aantal, 2,
    'eisen dat allebei de vlaggen staan, toont een betaalde klus als onbetaald');
  assert.equal(stadium(k, 'gefactureerd').aantal, 0);
});

/* ---------------- wat te lang duurt ---------------- */

test('per stap een eigen drempel, want ze betekenen iets anders', () => {
  const K = stubKern([
    klus({ boeking: { wanneer: dag(-3) } }),                                  // uitgevoerd, 3 dagen
    klus({ boeking: { wanneer: dag(-10) } }),                                 // uitgevoerd, 10 dagen
    klus({ boeking: { wanneer: dag(-60) }, factuur: { datum: dag(-40) } }),    // gefactureerd, 39 dagen
    /* Het geval dat de twee drempels ECHT scheidt: tien dagen is traag voor een
       onbetaalde uitvoering en juist niet voor een factuur. Zonder dit geval
       kwam een mutatie die overal dezelfde drempel zette er ongestraft
       doorheen -- de andere gevallen lagen aan beide kanten hetzelfde. */
    klus({ boeking: { wanneer: dag(-30) }, factuur: { datum: dag(-10) } })     // gefactureerd, 9 dagen
  ]);
  const k = K.ondernemingKlussen(ond(K), NU);
  assert.equal(KLU.TRAAG.uitgevoerd, 7);
  assert.equal(KLU.TRAAG.gefactureerd, 30);
  assert.ok(KLU.TRAAG.uitgevoerd < KLU.TRAAG.gefactureerd,
    'een klant dertig dagen geven is normaal; uw eigen factuur dertig dagen laten liggen niet');
  assert.equal(k.traag.aantal, 2, 'de klus van drie dagen en de factuur van negen dagen zijn niet traag');
  /* 39 en niet 40: een datum zonder tijd wordt op het midden van de dag gelezen,
     en dat is later op de dag dan het gezette meetmoment. Dat is de bedoeling --
     naar boven afronden zou een factuur ouder maken dan hij is. */
  assert.equal(k.traag.rijen[0].dagen, 39, 'de langst openstaande bovenaan');
});

test('ingepland werk kan nooit traag zijn', () => {
  const K = stubKern([klus({ boeking: { wanneer: dag(200) } })]);
  const k = K.ondernemingKlussen(ond(K), NU);
  assert.equal(k.traag.aantal, 0,
    'een klus die ver in de toekomst staat is niet traag maar gepland');
  assert.equal(KLU.TRAAG.ingepland, 0);
});

/* ---------------- de opvolging ---------------- */

test('niet gefactureerd werk gaat voor wat op betaling wacht', () => {
  const K = stubKern([
    klus({ boeking: { wanneer: dag(-3) } }),
    klus({ boeking: { wanneer: dag(-60) }, factuur: { datum: dag(-40) } })
  ]);
  const v = KLU.klussenOpvolging(K.ondernemingKlussen(ond(K), NU));
  assert.deepEqual(v.map(x => x.id), ['niet-gefactureerd', 'lang-open']);
  assert.ok(v[0].waarom.includes('zelf de enige rem'));
  assert.ok(v[0].kop.includes('1000 euro'));
});

test('zonder iets te melden komt er geen regel', () => {
  const K = stubKern([klus({ boeking: { wanneer: dag(5) } })]);
  assert.deepEqual(KLU.klussenOpvolging(K.ondernemingKlussen(ond(K), NU)), []);
  assert.deepEqual(KLU.klussenOpvolging(null), []);
});

/* ---------------- het dagbeeld ---------------- */

test('het dagbeeld draagt de klusketen en zet hem voor de pijplijn', () => {
  const K = stubKern([klus({ boeking: { wanneer: dag(-3) } })]);
  const d = K.ondernemingDagbeeld(ond(K), NU);
  assert.ok(d.klussen, 'de keten hangt in het dagbeeld');
  const ids = d.acties.map(a => a.id);
  const ki = ids.indexOf('klus:niet-gefactureerd');
  const pi = ids.findIndex(x => x.startsWith('pijplijn:'));
  assert.ok(ki >= 0);
  if (pi >= 0) assert.ok(ki < pi,
    'uitgevoerd werk zonder factuur houdt u zelf tegen; een offerte moet nog een klant overtuigen');
});
