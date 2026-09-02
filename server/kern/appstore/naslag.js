/* ============================================================================
   HET NASLAGWERK -- wat een ontwikkelaar moet weten, uit ÉÉN bron.

   WAAROM DIT BESTAAT. `rtg sdk` schreef de typings en de documentatie al uit de
   code; dat werkte, maar het werkte alleen voor wie deze repo had. Een uitgever
   die zijn app op zijn eigen machine bouwt, ziet dat nooit. Het uitgeversbureau
   moet het dus ook kunnen tonen -- en op dat moment ontstaat de vraag waar dit
   bestand het antwoord op is: uit welke bron?

   Zou het scherm zijn eigen lijstje krijgen, dan staan de machtigingen, de
   grenzen en de foutcodes op twee plekken, en de eerste keer dat er een methode
   bij komt zeggen ze iets anders (LAT-regel 4). Daarom staat de VERZAMELING hier
   en gebruiken zowel `scripts/rtg-sdk.js` als de route hetzelfde.

   WAT HIER GEEN KENNIS IS. Dit bestand bedenkt niets. Elk veld komt ergens
   vandaan:

     de methodes en de grenzen   kern/appstore/brug.js   (METHODES, GRENS)
     de mutatieklasse per methode kern/mutatie.js
     de machtigingen en de doelen kern/appstore/machtigingen.js
     wat er bewust NIET is        machtigingen.NIET_GEBOUWD
     de foutcodes                 kern/platformfout.js
     het bundelbudget             kern/appstore/keuring.js (BUDGET)

   De enige uitzondering staat hieronder als VORMEN, met de reden erbij.

   EN HET DRAAGT WAT ER NIET IS. Dat is het stuk waarin dit huis van de meeste
   platforms verschilt: een ontwikkelaar hoort te lezen WAAROM push er niet is,
   niet te denken dat hij het over het hoofd ziet. `nietBeschikbaar` en
   `nogGeenCode` staan daarom naast de rest en niet in een voetnoot.
   ========================================================================== */
'use strict';

const { MACHTIGINGEN, DOELEN, NIET_GEBOUWD } = require('./machtigingen');
const platformfout = require('../platformfout');
const { BUDGET } = require('./keuring');
const { maakBrug } = require('./brug');

/* De argument- en antwoordvorm per methode. Dit is het ENIGE wat niet uit de
   code te lezen valt: de brug neemt `args` als een zak aan en geeft terug wat
   zijn `doe()` oplevert. Het staat daarom hier, als de ene plek, met een toets
   die zakt zodra er een methode bij komt die hier niet in staat -- anders
   levert een zevende methode stilletjes `unknown` op. */
const VORMEN = {
  'profiel.wieBenIk': { args: null, uit: '{ codenaam: string; taal: string; pas: string; let: string }' },
  'opslag.lees': { args: '{ sleutel: string }', uit: '{ sleutel: string; waarde: string | null }' },
  'opslag.lijst': { args: null, uit: '{ sleutels: string[] }' },
  'opslag.zet': { args: '{ sleutel: string; waarde: string }', uit: '{ ok: true; sleutel: string }' },
  'opslag.wis': { args: '{ sleutel: string }', uit: '{ ok: true }' },
  'bericht.zet': { args: '{ tekst: string }', uit: '{ ok: true; klaargezet: string }' },
  /* DE ARENA. Let op de vorm van het antwoord en niet alleen op de velden: bij
     alle drie is `ranglijst: false` met een `reden` een NORMALE uitkomst en geen
     fout. Onder de 18+-poort (kern/spellen/grens.js) speelt het spel gewoon door
     en wordt er alleen niets bewaard -- een uitgever die dat als fout afhandelt,
     bouwt een spel dat voor een deel van de leden stukloopt terwijl er niets
     stuk is. Vandaar dat de reden in de typing staat. */
  'arena.zet': { args: '{ score: number }',
    uit: '{ bewaard: boolean; ranglijst: boolean; reden?: string; score?: number; ' +
      'persoonlijkRecord?: boolean; beste?: number | null; positie?: number | null; vorm: object }' },
  'arena.bord': { args: '{ periode?: "altijd" | "week" }',
    uit: '{ periode: string; vorm: object; ranglijst: boolean; reden?: string; deelnemers?: number; ' +
      'bord: { plaats: number; codenaam: string; score: number; ik: boolean }[]; ' +
      'ik?: { plaats: number; buitenBord: boolean; score: number } | null }' },
  'arena.mijn': { args: null,
    uit: '{ vorm: object; ranglijst: boolean; reden?: string; beste: number | null; ' +
      'pogingen?: number; sinds?: string | null; plaats?: number | null; plaatsDezeWeek?: number | null }' }
};

/* De brug wordt ECHT opgebouwd, op een opslag in het geheugen. Dat is geen
   omweg maar het punt: zo komen de namen, de grenzen en de mutatieklassen uit
   de draaiende code en niet uit een regex over de bron. Een naslagwerk dat zijn
   eigen bron parseert, kan iets vinden wat er niet is. */
function brugStand() {
  const staat = { opslag: {}, bakjes: {} };
  const brug = maakBrug({ S: () => staat, save() {}, boek() {},
    nu: () => new Date().toISOString(), eigen: (o, k) => o[k] });
  return { methodes: brug.mutaties, GRENS: brug.GRENS, machtigingen: brug.machtigingen };
}

/* Welke machtiging bij welke methode hoort. `overzicht()` uit kern/mutatie.js
   neemt hem niet mee, en een tweede lijst aanleggen zou precies de dubbeling
   zijn die dit bestand moet voorkomen -- dus komt hij uit de DRAAIENDE brug.

   Hier stond eerst een regex over de bron van brug.js. Die werkte, tot de
   methodetabel naar een eigen bestand verhuisde: toen leverde hij stil een lege
   lijst en stond er bij elke methode geen machtiging meer. Een naslagwerk dat
   stukgaat op een bestandsverhuizing, leest geen code maar tekst. */
let STAND = null;
const stand = () => (STAND || (STAND = brugStand()));
function machtigingVan(naam) { return stand().machtigingen[naam] || null; }

/* Het hele naslagwerk in één vorm. Zowel de CLI als het uitgeversbureau leest
   dit; wie er iets aan toevoegt, voegt het op beide plekken tegelijk toe. */
function naslag() {
  const { methodes, GRENS } = stand();
  return {
    methodes: methodes.map(m => Object.assign({
      machtiging: machtigingVan(m.naam),
      args: (VORMEN[m.naam] || {}).args || null,
      uit: (VORMEN[m.naam] || {}).uit || null
    }, m)),
    machtigingen: MACHTIGINGEN.map(m => ({
      id: m.id, label: m.label, geeft: m.geeft, nooit: m.nooit,
      doelen: m.doelen.map(d => ({ id: d, uitleg: DOELEN[d] }))
    })),
    /* Wat er met een reden NIET is. Dit hoort naast de rest te staan en niet
       eronder: het is het antwoord op de vraag die iedere ontwikkelaar toch
       stelt, en het laat zien dat een ontbrekende API geen vergeten werk is. */
    nietBeschikbaar: Object.entries(NIET_GEBOUWD).map(([wat, waarom]) => ({ wat, waarom })),
    grenzen: {
      opslagSleutels: GRENS.opslagSleutels,
      opslagSleutelLengte: GRENS.opslagSleutelLengte,
      opslagWaarde: GRENS.opslagWaarde,
      opslagTotaal: GRENS.opslagTotaal,
      berichtLengte: GRENS.berichtLengte,
      berichtenPerDag: GRENS.berichtenPerDag,
      roepenPerMinuut: GRENS.roepenPerMinuut
    },
    budget: {
      bestanden: BUDGET.bestanden, perBestand: BUDGET.perBestand,
      totaal: BUDGET.totaal, script: BUDGET.script, stijl: BUDGET.stijl
    },
    fouten: platformfout.overzicht(),
    nogGeenCode: Object.entries(platformfout.NOG_GEEN_CODE).map(([code, waarom]) => ({ code, waarom })),
    /* Eén zin die op elk scherm hoort mee te reizen: de cel heeft geen netwerk,
       en dat is geen instelling. */
    let: 'Een app draait in een cel: geen netwerk, geen cookies, een naamloze herkomst. De enige weg naar RTG is RTG.roep(), en die kijkt naar wat het lid heeft VERLEEND -- niet naar wat je manifest heeft gevraagd.'
  };
}

module.exports = { naslag, VORMEN, machtigingVan };
