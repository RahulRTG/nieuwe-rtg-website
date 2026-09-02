/* RTG Horeca: DE WERKLIJST -- wat is mijn eerstvolgende handeling?

   De rekensom achter PDA SERVICE. De bewering die deze toets vastlegt is niet
   "er komt een lijst uit", maar HOE die lijst geordend is -- want daar zit het
   verschil tussen een systeem dat regisseert en een systeem dat een mening
   heeft die eruitziet als een meting.

   Vijf dingen liggen hier vast:

   1. DE VOLGORDE IS MINUTEN OVER EEN BESTAANDE GRENS, en niet minuten. Een
      "er is iets niet goed" dat 5 minuten open staat (grens 3, dus 2 over) hoort
      BOVEN een "mag dit weg?" dat 8 minuten open staat (grens 12, dus nog niet
      over). Wie op minuten sorteert, draait die twee om -- en stuurt de
      bediening naar het verkeerde tafeltje.
   2. WAT GEEN GRENS HEEFT, KRIJGT ER GEEN. Een tafel die openstaat zonder
      bestelling wacht ergens op, maar nergens staat hoe lang dat mag. Die staat
      in een TWEEDE lijst, met minuten, zonder rangorde -- en nooit tussen de
      taken die wel een grens hebben.
   3. DE GRENZEN ZIJN GELEEND EN NIET VERZONNEN. De verzoekgrenzen komen uit
      kern/gast/verzoek.js (SOORTEN.oudNa), de pasmarge uit kern/horeca/cadans.js.
      Verandert een van die twee, dan verandert deze lijst mee.
   4. ER KOMT GEEN SCORE OP EEN MENS EN GEEN SCORE OP EEN TAAK. Geen veld dat
      een prioriteit, een cijfer of een telling per medewerker draagt
      (HORECA.md, grenzen 5 en 7).
   5. EEN COMPLETE GANG IS EEN PASTAAK EN GEEN BELOFTETAAK. Twee taken voor
      hetzelfde bord laat een mens kiezen welke van de twee hij wegwerkt.

   Puur, zonder server: de werklijst krijgt een gebouwde zaak mee. De deur
   ernaartoe wordt getoetst in test/horeca-pda.test.js.

   Draai: node --experimental-sqlite --test test/horeca-werklijst.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const MIN = 60000;
const geleden = (m) => new Date(Date.now() - m * MIN).toISOString();

/* De horeca-context die pas.js en gezelschap.js nodig hebben. Meer dan dit
   raakt de werklijst niet aan. */
const horeca = { nu: () => new Date().toISOString(), regelSom: (r) => (r.prijs || 0) * (r.aantal || 1) };
const schoon = (t, n) => String(t == null ? '' : t).slice(0, n || 80);

/* Een verzoekenlaag die precies teruggeeft wat we willen meten. De GRENZEN
   komen uit de echte laag: dat is het punt van punt 3. */
const echteVerzoeken = require('../server/kern/gast/verzoek');
const SOORTEN = echteVerzoeken({ save: () => {}, schoon, horeca: { H: () => ({}), nu: horeca.nu, id: () => 'x' } }).SOORTEN;

function verzoeklaagMet(rijen) {
  return {
    SOORTEN,
    wachtrij: () => ({ aantal: rijen.length, verzoeken: rijen.map((r) => Object.assign({
      id: r.id, soort: r.soort, naam: SOORTEN[r.soort].naam, tekst: null,
      tafel: r.tafel, rekeningId: null, stand: 'open', opgepaktDoor: r.door || null
    }, { minuten: r.minuten })) })
  };
}

const maak = (verzoeken, rekeningen) => require('../server/kern/horeca/werklijst')(
  { horeca, schoon, verzoeklaag: verzoeklaagMet(verzoeken || []) })
  .werklijst({ rekeningen: rekeningen || {}, instel: {} }, 'KIKUNOI', { modus: 'alles' });

/* Een rekening met een vrijgegeven gang. `klaarVoor` zet zoveel borden op
   klaar; `vrijMin` is hoe lang geleden de gang is vrijgegeven. */
function rek(id, tafel, borden, klaarVoor, vrijMin) {
  return {
    id, tafel, kanaal: 'tafel', status: 'open', gasten: 2, geopendAt: geleden(vrijMin + 10),
    deelnemers: [], pas: {},
    regels: borden.map((naam, i) => ({
      id: id + '-' + i, naam, aantal: 1, prijs: 20, gang: 1, station: 'warm',
      vrijAt: geleden(vrijMin),
      stand: i < klaarVoor ? 'klaar' : 'gestart',
      klaarAt: i < klaarVoor ? geleden(vrijMin - 1) : null,
      startAt: geleden(vrijMin)
    }))
  };
}

test('1. de volgorde is minuten OVER een grens, en niet minuten', () => {
  const uit = maak([
    { id: 'v1', soort: 'hulp', tafel: 'T1', minuten: 5 },       // grens 3 -> 2 over
    { id: 'v2', soort: 'afruimen', tafel: 'T2', minuten: 8 }    // grens 12 -> niet over
  ]);
  assert.equal(uit.nu.length, 1, 'alleen wat over zijn grens is, staat in "nu"');
  assert.equal(uit.nu[0].bronId, 'v1');
  assert.equal(uit.nu[0].over, 2);
  assert.equal(uit.open.length, 1, 'de ander staat eronder');
  assert.equal(uit.open[0].bronId, 'v2');
  assert.equal(uit.open[0].over, -4, 'met hoe ver hij nog van zijn grens af is');
});

test('2. de langst wachtende is NIET vanzelf de eerste', () => {
  /* Dit is het geval waar de hele module om draait, en het moet een geval zijn
     waarin de twee ordeningen UIT ELKAAR lopen -- anders bewijst de toets niets.
     "Er is iets niet goed" staat 10 minuten open op een grens van 3 (7 over);
     "mag dit weg?" staat 18 minuten open op een grens van 12 (6 over). Op
     minuten wint de tweede, op overschrijding de eerste. */
  const uit = maak([
    { id: 'v1', soort: 'hulp', tafel: 'T1', minuten: 10 },       // grens 3  -> 7 over
    { id: 'v2', soort: 'afruimen', tafel: 'T2', minuten: 18 }    // grens 12 -> 6 over
  ]);
  assert.deepEqual(uit.nu.map((t) => t.bronId), ['v1', 'v2'],
    'de kortst wachtende staat vooraan, want hij is verder over zijn grens');
  assert.deepEqual(uit.nu.map((t) => t.over), [7, 6]);
  assert.ok(uit.nu[0].wacht < uit.nu[1].wacht, 'en dat is zichtbaar aan de minuten zelf');
});

test('3. een tafel zonder bestelling heeft geen grens en staat nooit in "nu"', () => {
  const leeg = { L1: { id: 'L1', tafel: 'T9', kanaal: 'tafel', status: 'open', gasten: 4,
    geopendAt: geleden(45), regels: [], deelnemers: [], pas: {} } };
  const uit = maak([], leeg);
  assert.equal(uit.nu.length, 0, '45 minuten open is geen overschrijding, want er is niets om te overschrijden');
  const t = uit.open.find((x) => x.soort === 'opnemen');
  assert.ok(t, 'hij staat wel in de tweede lijst');
  assert.equal(t.wacht, 45);
  assert.equal(t.grens, null);
  assert.equal(t.over, null, 'en draagt geen verzonnen getal');
  assert.match(t.rekensom, /nergens vastgelegd/, 'en zegt zelf dat er niets gemeten is');
});

test('4. een complete gang is een pastaak, met de pasmarge als grens', () => {
  const cadans = require('../server/kern/horeca/cadans');
  const uit = maak([], { R1: rek('R1', 'T4', ['Soep', 'Brood'], 2, 9) });
  const p = uit.nu.find((x) => x.soort === 'pas');
  assert.ok(p, 'hij staat in "nu": hij staat al langer dan de pasmarge');
  assert.equal(p.grens, cadans.PASMARGE, 'en die grens komt uit de cadans zelf');
  assert.equal(p.over, p.wacht - cadans.PASMARGE);
  assert.equal(p.borden.length, 2, 'de borden reizen mee, want de runner draagt borden');

  /* En het geval waar het echt om gaat: een gang die compleet is EN al lang
     over zijn serveermoment. Zonder de scheiding staat diezelfde gang twee keer
     op de lijst -- een keer als "dragen" en een keer als "te laat" -- en dan mag
     een mens raden welke van de twee hij wegwerkt. */
  const laat = maak([], { R9: rek('R9', 'T8', ['Soep', 'Brood'], 2, 40) });
  const takenVanR9 = laat.nu.concat(laat.open).filter((x) => x.rekeningId === 'R9');
  assert.equal(takenVanR9.length, 1, 'een gang levert EEN taak: ' +
    JSON.stringify(takenVanR9.map((x) => x.soort)));
  assert.equal(takenVanR9[0].soort, 'pas', 'en dat is de draagtaak, want hij is te dragen');
});

test('5. een halve gang die zijn serveermoment voorbij is, is een beloftetaak', () => {
  const uit = maak([], { R2: rek('R2', 'T5', ['Tartaar', 'Zeebaars'], 1, 40) });
  const b = uit.nu.find((x) => x.soort === 'belofte');
  assert.ok(b, 'de gang is over zijn eigen doel');
  assert.equal(b.grens, 0, 'de grens is het serveermoment zelf');
  assert.ok(b.over > 0);
  assert.match(b.wat, /1 van 2 klaar/, 'en zegt wat er nog mist');
  assert.equal(uit.nu.filter((x) => x.soort === 'pas' && x.rekeningId === 'R2').length, 0,
    'een halve gang is geen draagtaak');
});

test('6. de modus is een lens: dezelfde waarheid, minder soorten', () => {
  const bouw = (modus) => require('../server/kern/horeca/werklijst')(
    { horeca, schoon, verzoeklaag: verzoeklaagMet([{ id: 'v1', soort: 'hulp', tafel: 'T1', minuten: 9 }]) })
    .werklijst({ rekeningen: { R1: rek('R1', 'T4', ['Soep'], 1, 9) }, instel: {} }, 'KIKUNOI', { modus });

  const runner = bouw('runner');
  assert.deepEqual([...new Set(runner.nu.concat(runner.open).map((t) => t.soort))], ['pas']);
  const bediening = bouw('bediening');
  assert.ok(!bediening.nu.concat(bediening.open).some((t) => t.soort === 'pas'));
  assert.ok(bediening.nu.some((t) => t.soort === 'verzoek'));
  const alles = bouw('alles');
  assert.equal(alles.nu.length, 2, 'alles ziet allebei');
  // een onbekende modus valt terug op alles, en verbergt dus nooit stilletjes werk
  assert.equal(bouw('directeur').modus, 'alles');

  /* EEN ONBEKENDE MODUS WERD OPGEVANGEN, EEN ONTBREKENDE NIET -- en dat is
     precies waarom deze fout maanden onzichtbaar bleef.

     De regel luidde: `MODI[String(opties.modus || 'alles')] ? String(opties.modus) : 'alles'`.
     Links stond de TERUGVAL en rechts de RAUWE waarde. Zonder `modus` slaagde
     de test op 'alles' en werd daarna de tekenreeks "undefined" gebruikt --
     MODI daarvan bestaat niet, en de regel eronder las er `.soorten` van. Een
     harde 500 op elke oproep zonder modus, en dat is de gewone oproep van de
     PDA. De toets hierboven dekte 'directeur' (onbekend, wel een tekenreeks) en
     miste daardoor precies het geval dat stuk was.

     Gevonden door de invoerproef, die hem meldde als 500 op een diep genest
     veld `centen` -- dat veld had er niets mee te maken. Een fuzzer wijst de
     plek aan, niet de oorzaak. */
  for (const leeg of [undefined, null, '', 0, false]) {
    const uit = bouw(leeg);
    assert.equal(uit.modus, 'alles', 'modus ' + JSON.stringify(leeg) + ' hoort terug te vallen op alles');
    assert.ok(Array.isArray(uit.nu), 'en een werkende lijst te geven in plaats van te struikelen');
  }
  // ook zonder opties-object helemaal: dat is hoe een kale oproep binnenkomt
  const kaal = require('../server/kern/horeca/werklijst')(
    { horeca, schoon, verzoeklaag: verzoeklaagMet([]) })
    .werklijst({ rekeningen: {}, instel: {} }, 'KIKUNOI', {});
  assert.equal(kaal.modus, 'alles');
});

test('7. er staat nergens een score, een cijfer of een telling per mens', () => {
  const uit = maak(
    [{ id: 'v1', soort: 'hulp', tafel: 'T1', minuten: 9, door: 'Sanne' }],
    { R1: rek('R1', 'T4', ['Soep'], 1, 9) });
  const tekst = JSON.stringify(uit);
  for (const woord of ['score', 'prioriteit', 'urgentie', 'ranglijst', 'punten', 'rating', 'performance']) {
    assert.ok(!new RegExp(woord, 'i').test(tekst), 'geen veld of woord "' + woord + '"');
  }
  /* Elk getal in een taak moet een van de drie gemeten getallen zijn: wacht,
     grens of over. Een vierde getal is per definitie iets wat niemand gemeten
     heeft (HORECA.md, grens 7). */
  for (const t of uit.nu.concat(uit.open)) {
    for (const [sleutel, waarde] of Object.entries(t)) {
      if (typeof waarde !== 'number') continue;
      assert.ok(['wacht', 'grens', 'over', 'gang'].includes(sleutel),
        'onverwacht getal "' + sleutel + '" op een taak: ' + waarde);
    }
  }
});
