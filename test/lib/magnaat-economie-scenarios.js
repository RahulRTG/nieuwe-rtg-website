/* DE GOUDEN REFERENTIE VAN DE MAGNAAT-ECONOMIE -- scenario's en vingerafdruk.

   Ronde A1 (MAGNAAT.md par. 7) haalt de economische motor uit het Oefenkantoor.
   Dat mag het economische gedrag met geen cent veranderen, en dat moet je
   kunnen BEWIJZEN nadat het oude bestand weg is. Daarom zijn deze scenario's
   een keer gedraaid tegen de oude motor (server/kern/magnaat-economie.js) en
   staat per stap een vingerafdruk in test/fixtures/magnaat-economie-gouden.json.
   test/magnaat-economische-motor.test.js draait dezelfde scenario's tegen de
   nieuwe motor en eist dezelfde vingerafdrukken.

   WAT EEN VINGERAFDRUK DEKT, per stap:
     saldi      elke rekening met haar saldo
     posten     elke boeking die in deze stap ontstond, in volgorde, met sleutel,
                dag, omschrijving, bedragen, regels en labels -- de economische
                inhoud, zonder de nieuwe velden (wereld, volgnummer, soort,
                versies) die de nieuwe motor er met opzet bij zet
     overzicht  het hele antwoord van overzicht(), zonder `rekenlaag` (dat is de
                status van de Rust-client en geen economie). In het lange
                scenario zonder `grootboek`: de oude motor gooide boven 2500
                boekingen de oudste weg, dus zijn telling en controle waren daar
                een telling van een ingekort journaal. Dat verschil is precies
                de reparatie van M-018, en het staat hier met opzet niet als
                gelijk te bewijzen.

   Een mismatch noemt het scenario, de stap en het onderdeel, zodat je weet
   waar je moet kijken zonder een megabyte aan boekingen in de repo. */
'use strict';
const crypto = require('crypto');

function canoniek(v) {
  if (Array.isArray(v)) return '[' + v.map(canoniek).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canoniek(v[k])).join(',') + '}';
  }
  return JSON.stringify(v === undefined ? null : v);
}
const hash = (v) => crypto.createHash('sha256').update(canoniek(v)).digest('hex').slice(0, 24);

const volgnummerVan = (post) => Number(post.volgnummer || String(post.id).split('-')[2]);
const inhoud = (p) => ({
  id: p.id, sleutel: p.sleutel, dag: p.dag, datum: p.datum, omschrijving: p.omschrijving,
  bedrag: p.bedrag, debet: p.debet, credit: p.credit, regels: p.regels, labels: p.labels
});

/* De oude motor had zijn journaal in de staat (nieuwste eerst); de nieuwe
   levert zijn gebeurtenissen via `_gebeurtenissen(vanaf)`. Een van de twee. */
function postenNa(economie, vanaf) {
  if (typeof economie._gebeurtenissen === 'function') return economie._gebeurtenissen(vanaf + 1).map(inhoud);
  return economie._state().journaal.filter(p => volgnummerVan(p) > vanaf)
    .sort((a, b) => volgnummerVan(a) - volgnummerVan(b)).map(inhoud);
}
function laatsteVolgnummer(economie) {
  const e = economie._state();
  return Number.isInteger(e.laatstToegepast) ? e.laatstToegepast : e.boekVolgorde;
}

function afdruk(economie, actor, { metGrootboek }) {
  const e = economie._state();
  const saldi = Object.fromEntries(Object.keys(e.rekeningen).sort().map(k => [k, e.rekeningen[k].saldo]));
  const o = Object.assign({}, economie.overzicht(actor));
  delete o.rekenlaag;
  if (!metGrootboek) delete o.grootboek;
  return { saldi, overzicht: o };
}

function werk(id, spelvorm, punten, stappen) {
  return { id, functieId: 'functie-' + id, spelvorm, punten, stappen: stappen.map(soort => ({ soort })) };
}
function analyse(o) {
  return {
    hypothese: 'productiviteit', maatregel: 'training-investeren', indicatoren: ['capaciteit', 'benutting', 'marge'],
    causaleKeten: 'Training verhoogt menselijk kapitaal, daarna capaciteit en kwaliteit; via verkoop en kostprijs verandert het nettoresultaat.',
    alternatief: 'De prijs ongemoeid laten en eerst een dag extra meten is het serieuze alternatief.',
    opportunityCost: 'Het trainingsbudget kan dezelfde dag niet als liquiditeitsbuffer worden aangehouden.',
    risico: 'De productiviteitswinst kan later of kleiner zijn dan de investering veronderstelt.',
    omzetRichting: 'stijgt', winstRichting: 'stijgt', kasRichting: 'daalt',
    verwachteOmzet: o.strategie.omzetVandaag / 100, verwachteWinst: o.strategie.winstVandaag / 100,
    verwachteInflatie: o.macro.inflatie, zekerheid: 70
  };
}

/* Elke stap is een handeling met de uitkomst die de aanroeper terugkreeg
   (zonder de overzichtsvelden, want die staan al in de afdruk). */
const SCENARIOS = {
  rustig: { metGrootboek: true, stappen: Array.from({ length: 30 }, (_, i) => ['dag', 'rustig-' + (i + 1)]) },
  besluiten: {
    metGrootboek: true,
    stappen: [
      ['dag', 'b-1'],
      ['beslis', { prijs: 117, personeelDoel: 30, loonMaand: 3650, trainingDag: 1800, bestelling: 340, impactPct: 1.4 }],
      ['werk', werk('w1', 'operatie', 375, ['software', 'keuze', 'keuze'])],
      ['werk', werk('w2', 'puzzel', 180, ['keuze', 'keuze'])],
      ['dag', 'b-2'],
      ['dag', 'b-2'],                                   // herhaald commando: geen tweede dag
      ['schok', 'arbeidstekort'],
      ['werk', werk('w3', 'impact', 90, ['keuze'])],
      ['werk', werk('w4', 'gesprek', 260, ['software', 'keuze', 'keuze'])],
      ['dag', 'b-3'],
      ['beslis', { lening: 200000 }],
      ['beslis', { prijs: 9999 }],                      // geweigerd: de kopie mag niets achterlaten
      ['beslis', { lening: 5000000 }],                  // geweigerd boven de kredietlimiet
      ['analyse', 'econoom-a'],
      ['dag', 'b-4'],
      ['schok', 'leveranciersuitval'],
      ['beslis', { prijs: 60, personeelDoel: 4, bestelling: 0 }],
      ...Array.from({ length: 12 }, (_, i) => ['dag', 'b-' + (i + 5)]),
      ['werk', werk('w5', 'controle', 300, ['software', 'software', 'keuze'])],
      ['werk', werk('w6', 'planning', 50, ['keuze'])],
      ['dag', 'b-17']
    ]
  },
  lang: {
    metGrootboek: false,
    stappen: [
      ['beslis', { prijs: 70, loonMaand: 9000, trainingDag: 40000, bestelling: 900 }],
      ...Array.from({ length: 160 }, (_, i) => ['dag', 'l-' + (i + 1)]),
      ['beslis', { prijs: 180, personeelDoel: 60, lening: 900000 }],
      ...Array.from({ length: 40 }, (_, i) => ['dag', 'l-' + (i + 161)])
    ]
  }
};

function voerUit(economie, [soort, arg]) {
  let r;
  if (soort === 'dag') r = economie.volgendeDag('speler', arg);
  else if (soort === 'beslis') r = economie.beslis('directie', arg);
  else if (soort === 'werk') return { werk: economie.registreerWerk('medewerker', arg) };
  else if (soort === 'schok') r = economie.kiesSchok('scenarioleider', arg);
  else if (soort === 'analyse') r = economie.analyse(arg, analyse(economie.overzicht(arg)));
  else throw new Error('onbekende stap ' + soort);
  return { status: r.status || 200, error: r.error || null, herhaald: r.herhaald === undefined ? null : r.herhaald };
}

/* Draai een scenario op een verse motor en geef per stap een vingerafdruk. */
function draai(maakEconomie, naam) {
  const sc = SCENARIOS[naam];
  const economie = maakEconomie();
  const uit = [];
  let vorige = laatsteVolgnummer(economie);
  const start = afdruk(economie, 'speler', sc);
  uit.push({ stap: 'start', hash: hash({ afdruk: start, posten: postenNa(economie, 0) }) });
  vorige = laatsteVolgnummer(economie);
  sc.stappen.forEach((stap, i) => {
    const antwoord = voerUit(economie, stap);
    const posten = postenNa(economie, vorige);
    vorige = laatsteVolgnummer(economie);
    const a = afdruk(economie, 'speler', sc);
    uit.push({
      stap: i + 1, soort: stap[0], dag: economie._state().dag, posten: posten.length,
      hash: hash({ antwoord, afdruk: a, posten }),
      delen: { antwoord: hash(antwoord), saldi: hash(a.saldi), overzicht: hash(a.overzicht), posten: hash(posten) }
    });
  });
  return uit;
}

module.exports = { SCENARIOS, draai, canoniek, hash };
