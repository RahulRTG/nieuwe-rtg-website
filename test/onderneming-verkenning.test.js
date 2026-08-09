/* Ronde: de pre-oprichtingsfase -- intake, kansverkenning, simulatie, stress
   test en het ondernemingsplan.

   De zwaartepunten liggen op de twee plekken waar dit soort software liegt:

   1. DE KANSSCORE IS EEN METER (lat-regel 10). Een getal ziet eruit als een
      feit. Deze toetsen houden vast dat 'niet gemeten' geen nul wordt, dat er
      onder twee bronnen geen cijfer komt, en dat de grondslag meereist.
   2. DE STRESS TEST MOET 'NIET STARTEN' KUNNEN ZEGGEN. Een adviseur die alleen
      enthousiasme produceert is een verkoper. Hier staat dat verkopen onder de
      kostprijs blokkerend is, en dat het plan pas met een uitdrukkelijke keuze
      alsnog vastgelegd kan worden.

   Draai los: node --experimental-sqlite --test test/onderneming-verkenning.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const maakOnderneming = require('../server/kern/onderneming');
const KANS = require('../server/kern/onderneming/kans');

/* ---------- een kern met instelbare data ---------- */
function stubKern(opties) {
  const o = opties || {};
  const zaken = o.suppliers || [];
  const data = {
    ondernemingen: [], suppliers: zaken,
    supplierTypes: { zzp: { label: 'Zelfstandige', caps: ['services', 'agenda'] } },
    thuisHuizen: {},
    vacatures: o.vacatures,
    weefselPanden: o.panden
  };
  const db = require('../server/kern/werkvormen').haakAan({ data });
  return maakOnderneming({
    db, save: () => {}, crypto: require('crypto'),
    schoon: (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : ''),
    /* De ECHTE ondernemerpoort, met de echte salonregel erachter. Een
       nagemaakte poort zou hier precies datgene wegnemen wat we willen meten:
       dat de eerste-klant-lijst de bestaande poort LEEST. */
    ondernemerpoort: require('../server/opzet/salonregel')({ data: { posts: [] } }).ondernemerpoort,
    findSupplier: (code) => zaken.find(z => z.code === code) || null,
    ordersVanZaak: (code) => (zaken.find(z => z.code === code) || {}).orders || [],
    boekingenVanZaak: (code) => (zaken.find(z => z.code === code) || {}).boekingen || []
  });
}

/* Een gezond plan: prijs boven kostprijs, lasten gedekt, buffer aanwezig. */
const GEZOND = {
  persoon: { urenPerWeek: 32, ervaringJaren: 8, startkapitaal: 15000, verkoopervaring: true, samen: 'alleen' },
  idee: { branche: 'zzp', wat: 'Ramen wassen bij bedrijven', doelgroep: 'Kantoren in het centrum',
    plaats: 'Haarlem', onderscheid: 'Vaste ploeg, avondwerk, geen onderaannemers',
    verkoopmodel: 'abonnement', prijs: 120, kostprijs: 30, verwachtPerMaand: 60, vasteLasten: 1800 }
};

function maakOnd(K, intake) {
  const o = K.ondernemingVind(K.ondernemingNieuw('LID1', { naam: 'Proef' }).onderneming.id);
  K.ondernemingIntakeZet(o, intake);
  return o;
}

/* ---------------- 1. de intake ---------------- */

test('de intake zegt wat er nog ontbreekt, per onderdeel', () => {
  const K = stubKern();
  const o = maakOnd(K, { idee: { branche: 'zzp', plaats: 'Haarlem' } });
  const b = K.ondernemingIntakeBeeld(o);
  assert.deepEqual(b.ontbreekt.kans, [], 'branche en plaats zijn er, dus de kans mag rekenen');
  assert.ok(b.ontbreekt.simulatie.includes('idee.prijs'), 'de simulatie mist nog de prijs');
  assert.ok(b.ontbreekt.plan.includes('idee.wat'), 'het plan mist nog de omschrijving');
});

test('een nul is een antwoord en geen leeg veld', () => {
  const K = stubKern();
  const o = maakOnd(K, { idee: { branche: 'zzp', plaats: 'H', prijs: 100, kostprijs: 0,
    verwachtPerMaand: 10, vasteLasten: 0 } });
  assert.deepEqual(K.ondernemingIntakeBeeld(o).ontbreekt.simulatie, [],
    '"ik heb geen vaste lasten" en "mijn kostprijs is nul" zijn ingevulde antwoorden');
});

test('een onbekende branche wordt geweigerd en niet stil gecorrigeerd', () => {
  const K = stubKern();
  const o = maakOnd(K, { idee: { branche: 'ruimtevaart' } });
  assert.equal(K.ondernemingIntakeBeeld(o).idee.branche, null);
});

/* ---------------- 2. de kansscore: de meter ---------------- */

test('zonder meetbare bronnen komt er GEEN cijfer, met de reden erbij', () => {
  const K = stubKern({ suppliers: [] });          // leeg platform: niets te meten
  const r = K.ondernemingKans('zzp', 'Haarlem');
  assert.equal(r.score, null, 'lat-regel 10: liever geen getal dan een getal dat niets weegt');
  assert.equal(r.grondslag.gemeten, 0);
  assert.equal(r.grondslag.ontbreekt.length, 4, 'en er staat per bron waarom hij ontbreekt');
  assert.ok(r.uitleg.includes(String(KANS.MIN_BRONNEN)), 'de drempel staat in de uitleg');
});

test('een ontbrekende bron telt niet als nul mee in de noemer', () => {
  /* Twee zaken in de branche, allebei met veel transacties: concurrentie en
     vraag zijn meetbaar, personeel en ruimte niet. Zouden die twee als nul
     meetellen, dan kan de score nooit hoog uitvallen. */
  const suppliers = [
    { code: 'A', type: 'zzp', city: 'Haarlem', boekingen: Array.from({ length: 60 }, () => ({ status: 'bevestigd' })) },
    { code: 'B', type: 'zzp', city: 'Haarlem', boekingen: Array.from({ length: 60 }, () => ({ status: 'bevestigd' })) }
  ];
  const r = stubKern({ suppliers }).ondernemingKans('zzp', 'Haarlem');
  assert.equal(r.grondslag.gemeten, 2, 'twee van de vier bronnen zijn meetbaar');
  assert.equal(r.score, 100, 'en de score rust alleen op die twee, niet op vier met twee nullen');
  assert.ok(r.voorbehoud.includes('2 van de 4'), 'het voorbehoud noemt waar het cijfer op rust');
});

test('de score beweegt met de concurrentie, en leeg is niet het beste', () => {
  const drukke = Array.from({ length: 20 }, (_, i) => ({ code: 'D' + i, type: 'zzp', city: 'Haarlem',
    boekingen: Array.from({ length: 60 }, () => ({ status: 'bevestigd' })) }));
  const druk = stubKern({ suppliers: drukke }).ondernemingKans('zzp', 'Haarlem');
  const rustig = stubKern({ suppliers: [
    { code: 'A', type: 'zzp', city: 'Haarlem', boekingen: Array.from({ length: 60 }, () => ({ status: 'bevestigd' })) },
    { code: 'B', type: 'zzp', city: 'Haarlem', boekingen: Array.from({ length: 60 }, () => ({ status: 'bevestigd' })) }
  ] }).ondernemingKans('zzp', 'Haarlem');
  assert.ok(druk.score < rustig.score, 'twintig concurrenten scoort lager dan twee');

  // en de curve-eis: nul concurrenten is NIET de topscore
  assert.ok(KANS.concurrentiePunten(0).punten < KANS.concurrentiePunten(2).punten,
    'een markt waar niemand zit is vaker geen markt dan een gat');
});

test('elke bron draagt zijn eigen waarde en uitleg mee', () => {
  const suppliers = [{ code: 'A', type: 'zzp', city: 'Haarlem',
    boekingen: Array.from({ length: 60 }, () => ({ status: 'bevestigd' })) }];
  const r = stubKern({ suppliers, vacatures: { A: [{ open: true }, { open: true }, { open: true }] } })
    .ondernemingKans('zzp', 'Haarlem');
  const p = r.bronnen.find(b => b.id === 'personeel');
  assert.equal(p.gemeten, true);
  assert.equal(p.waarde, 3, 'drie open vacatures bij één zaak in de branche');
  assert.ok(p.punten < 10, 'een personeelstekort is voor een starter een risico, geen kans');
  const som = r.bronnen.filter(b => b.gemeten).reduce((s, b) => s + b.punten, 0);
  const max = r.bronnen.filter(b => b.gemeten).reduce((s, b) => s + b.max, 0);
  assert.equal(r.score, Math.round((som / max) * 100), 'de score is precies de som van de grondslag');
});

/* ---------------- 3. de simulatie ---------------- */

test('de simulatie weigert te rekenen op halve invoer', () => {
  const K = stubKern();
  const o = maakOnd(K, { idee: { branche: 'zzp', plaats: 'H', prijs: 100 } });
  const s = K.ondernemingSimuleer(o);
  assert.equal(s.status, 400, 'lat-regel 3: geen half doorgerekende maand');
  assert.ok(s.ontbreekt.includes('idee.kostprijs'));
  assert.equal(s.ok, undefined, 'en zeker geen scenario-uitkomst');
});

test('elke aanname staat met naam, getal en herkomst in het antwoord', () => {
  const K = stubKern();
  const s = K.ondernemingSimuleer(maakOnd(K, GEZOND));
  assert.ok(s.ok);
  const prijs = s.aannames.find(a => a.naam === 'prijs per eenheid');
  assert.equal(prijs.herkomst, 'opgegeven', 'wat de ondernemer gaf heet opgegeven');
  const aanloop = s.aannames.find(a => a.naam === 'aanloop in maanden');
  assert.equal(aanloop.herkomst, 'aanname', 'wat wij invulden heet aanname');

  // de mutatieproef op de herkomst: geef hem zelf op, dan verschuift hij
  const eigen = K.ondernemingSimuleer(maakOnd(K, GEZOND), { aanloopMaanden: 3 });
  assert.equal(eigen.aannames.find(a => a.naam === 'aanloop in maanden').herkomst, 'opgegeven');
  assert.equal(eigen.aannames.find(a => a.naam === 'aanloop in maanden').waarde, 3);
});

test('de drie scenario\'s lopen echt uiteen en maand 12 draait op vol volume', () => {
  const K = stubKern();
  const s = K.ondernemingSimuleer(maakOnd(K, GEZOND));
  const { slecht, basis, groei } = s.scenarios;
  assert.ok(slecht.jaar.omzet < basis.jaar.omzet, 'het slechte scenario ligt lager');
  assert.ok(groei.jaar.omzet > basis.jaar.omzet, 'het groeiscenario hoger');
  assert.equal(basis.maand12.aantal, GEZOND.idee.verwachtPerMaand,
    'na de aanloop draait maand 12 op het volume dat de ondernemer verwacht');
  assert.ok(basis.maanden[0].aantal < basis.maand12.aantal, 'en maand 1 nog niet');
  assert.equal(basis.jaar.margePercentage, 75, '(120-30)/120 is 75%');
});

test('de kas loopt door de maanden heen en meldt wanneer hij op is', () => {
  const K = stubKern();
  // vaste lasten die de marge ver overstijgen, met een kleine buffer
  const arm = JSON.parse(JSON.stringify(GEZOND));
  arm.persoon.startkapitaal = 2000;
  arm.idee.vasteLasten = 9000;
  const s = K.ondernemingSimuleer(maakOnd(K, arm));
  assert.ok(s.scenarios.basis.runwayMaanden !== null, 'de kas duikt onder nul');
  assert.ok(s.scenarios.basis.runwayMaanden < 12);
  // tegenproef: het gezonde plan haalt het jaar wel
  const g = K.ondernemingSimuleer(maakOnd(K, GEZOND));
  assert.equal(g.scenarios.basis.runwayMaanden, null, 'en een gezond plan meldt geen runway');
});

/* ---------------- 4. de stress test ---------------- */

test('verkopen onder de kostprijs is blokkerend, en het oordeel is "niet starten"', () => {
  const K = stubKern();
  const slecht = JSON.parse(JSON.stringify(GEZOND));
  slecht.idee.prijs = 25;      // onder de kostprijs van 30
  const v = K.ondernemingVerkenning(maakOnd(K, slecht));
  assert.equal(v.stress.oordeel, 'niet starten', 'de AI mag ook nee zeggen');
  const b = v.stress.bevindingen.find(x => x.id === 'onder-kostprijs');
  assert.equal(b.zwaarte, 'blokkerend');
  assert.ok(b.doen.includes('Volume lost dit niet op'), 'met wat er dan wél moet gebeuren');
});

test('een gezond plan krijgt "ga door", met wat er niet is getoetst erbij', () => {
  const K = stubKern();
  const v = K.ondernemingVerkenning(maakOnd(K, GEZOND));
  assert.equal(v.stress.oordeel, 'ga door');
  assert.deepEqual(v.stress.bevindingen, [], 'geen enkel breekpunt in deze cijfers');
  assert.ok(v.stress.sterk.length > 0, 'en wel wat er juist houdt');
  assert.ok(v.stress.nietGetoetst.includes('markt'), '"ga door" is geen goedkeuring van het idee');
});

test('een plan dat alleen bij meewind overleeft is "pas aan", niet "ga door"', () => {
  const K = stubKern();
  const krap = JSON.parse(JSON.stringify(GEZOND));
  krap.persoon.startkapitaal = 8000;
  krap.idee.vasteLasten = 4300;   // basis houdt het jaar vol, het slechte scenario niet
  const v = K.ondernemingVerkenning(maakOnd(K, krap));
  assert.equal(v.simulatie.scenarios.basis.runwayMaanden, null, 'de basis houdt het jaar vol');
  assert.ok(v.simulatie.scenarios.slecht.runwayMaanden !== null, 'het slechte scenario niet');
  assert.equal(v.stress.oordeel, 'pas aan');
  assert.ok(v.stress.bevindingen.some(b => b.id === 'kas-op-slecht'));
  assert.ok(!v.stress.bevindingen.some(b => b.id === 'kas-op'), 'en de blokkerende variant slaat niet óók aan');
});

test('de stress test beweert niets over de markt als die niet is gemeten', () => {
  const K = stubKern({ suppliers: [] });    // geen enkele bron meetbaar
  const zonder = JSON.parse(JSON.stringify(GEZOND));
  delete zonder.idee.onderscheid;
  const v = K.ondernemingVerkenning(maakOnd(K, zonder));
  assert.equal(v.kans.score, null);
  assert.ok(!v.stress.bevindingen.some(b => b.id === 'geen-onderscheid'),
    'zonder gemeten concurrentie mag hij niet zeggen dat de markt druk is');

  // tegenproef: mét een drukke gemeten markt slaat hij wél aan
  const druk = Array.from({ length: 20 }, (_, i) => ({ code: 'D' + i, type: 'zzp', city: 'Haarlem',
    boekingen: Array.from({ length: 60 }, () => ({ status: 'bevestigd' })) }));
  const K2 = stubKern({ suppliers: druk });
  const v2 = K2.ondernemingVerkenning(maakOnd(K2, zonder));
  assert.ok(v2.stress.bevindingen.some(b => b.id === 'geen-onderscheid'),
    'en mét een gemeten drukke markt zegt hij het wel');
});

/* ---------------- 5. het plan en de fase-overgang ---------------- */

test('het plan vastleggen brengt de onderneming van idee naar validatie', () => {
  const K = stubKern();
  const o = maakOnd(K, GEZOND);
  assert.equal(K.ondernemingBeeld(o).fase, 'idee');
  const v = K.ondernemingVerkenning(o);
  const r = K.ondernemingPlanVastleggen(o, v.plan, v.stress, {});
  assert.ok(r.ok);
  assert.equal(r.versie.nummer, 1);
  assert.equal(K.ondernemingBeeld(o).fase, 'validatie',
    'de fase volgt uit het feit, er is geen knop die hem zet');
});

test('een onvolledig plan kan niet worden vastgelegd', () => {
  const K = stubKern();
  const o = maakOnd(K, { idee: { branche: 'zzp', plaats: 'Haarlem' } });
  const v = K.ondernemingVerkenning(o);
  const r = K.ondernemingPlanVastleggen(o, v.plan, v.stress, {});
  assert.equal(r.status, 400);
  assert.ok(r.ontbreekt.length > 0);
  assert.equal(K.ondernemingBeeld(o).fase, 'idee', 'en de fase blijft dus staan');
});

test('"niet starten" weigert eerst, en legt de eigen keuze daarna mét het advies vast', () => {
  const K = stubKern();
  const slecht = JSON.parse(JSON.stringify(GEZOND));
  slecht.idee.prijs = 25;
  const o = maakOnd(K, slecht);
  const v = K.ondernemingVerkenning(o);

  const weiger = K.ondernemingPlanVastleggen(o, v.plan, v.stress, {});
  assert.equal(weiger.status, 409, 'zonder uitdrukkelijke keuze gaat dit niet door');
  assert.deepEqual(weiger.blokkerend.map(b => b.id).sort(), ['kas-op', 'onder-kostprijs'],
    'onder de kostprijs verkopen loopt de kas ook leeg -- allebei blokkerend, allebei benoemd');
  assert.equal(K.ondernemingBeeld(o).fase, 'idee');

  const toch = K.ondernemingPlanVastleggen(o, v.plan, v.stress, { tochDoorzetten: true });
  assert.ok(toch.ok, 'maar de mens beslist, niet de rekensom');
  assert.equal(toch.versie.oordeel, 'niet starten');
  assert.equal(toch.versie.tochDoorzetten, true, 'en die keuze staat in het archief');
  assert.equal(K.ondernemingBeeld(o).fase, 'validatie');
});

test('het levende plan beweegt mee, de vastgelegde versie niet', () => {
  const K = stubKern();
  const o = maakOnd(K, GEZOND);
  const v = K.ondernemingVerkenning(o);
  K.ondernemingPlanVastleggen(o, v.plan, v.stress, {});
  const toenOmzet = o.plan.versies[0].financieel.scenarios.basis.jaaromzet;

  // de prijs verdubbelt: het levende plan verandert, het archief niet
  K.ondernemingIntakeZet(o, { idee: { prijs: 240 } });
  const nu = K.ondernemingVerkenning(o);
  assert.ok(nu.plan.hoofdstukken.financieel.scenarios.basis.jaaromzet > toenOmzet,
    'het plan van nu rekent met de nieuwe prijs');
  assert.equal(o.plan.versies[0].financieel.scenarios.basis.jaaromzet, toenOmzet,
    'en de vastgelegde versie blijft wat er toen is besloten');
});

test('een ontbrekende stap laat een gat in het plan, geen verzonnen alinea', () => {
  const K = stubKern({ suppliers: [] });
  const o = maakOnd(K, { idee: { branche: 'zzp', wat: 'Iets', doelgroep: 'Iemand', plaats: 'Haarlem' },
    persoon: { urenPerWeek: 20 } });
  const v = K.ondernemingVerkenning(o);
  assert.ok(v.plan.hoofdstukken.financieel.ontbreekt, 'het financiële hoofdstuk meldt dat het niet kon rekenen');
  assert.ok(Array.isArray(v.plan.hoofdstukken.financieel.mist), 'met welke velden ontbreken');
  assert.equal(v.plan.hoofdstukken.samenvatting.tekst, null, 'en de samenvatting verzint niets');
  assert.equal(v.plan.volledig, true, 'terwijl de plan-velden zelf wél compleet zijn');
});
