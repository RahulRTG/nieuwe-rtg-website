/* ============================================================================
   MUTATIECONTRACT -- ADAPTIEF RTG.

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm en de
   regels. De routes staan in server/routes/neiging.js, de laag in
   server/kern/neiging/, en de richting in NEIGING.md.

   HOE HET IS GEMETEN, EN WAAROM NIET IN DE OPSLAG. Een ronde tegen een
   draaiende server, waarbij elke route TWEE keer met hetzelfde lijf is
   aangeroepen en het verschil is waargenomen door de ogen van het lid zelf --
   /api/neiging/geheugen plus /api/neiging/intake, samen alles wat deze laag
   over iemand kan tonen.

   Dat is niet de eerste opzet geweest, en de eerste was fout op een manier die
   eruitzag als een uitslag. Die las `db.json` uit de testmap en meldde voor alle
   zeven routes "er verandert niets" -- ook voor de route die aantoonbaar
   schrijft. De oorzaak: de opslag is SQLite en dat bestand bestond niet, dus de
   lezer gaf zeven keer dezelfde foutstring terug en de vergelijking was altijd
   waar. Vandaar twee dingen in de uiteindelijke meting: waarnemen via de
   ANTWOORDEN in plaats van via de opslag, en een BESTURINGSPROEF ernaast -- de
   EERSTE aanroep van een schrijfroute moet het beeld wel degelijk veranderen.
   Zonder die tweede helft is "de tweede veranderde niets" geen bevinding maar
   een blinde vlek (BEWIJSMACHINE.md par. 6a).

   De meting vond daarmee ook een echt gebrek: /api/neiging/antwoord was NIET
   idempotent. Een tweede identieke POST hoogde de teller van een `gezegd`
   neiging op, dus een dubbelklik op "Verder" werd geboekt als een tweede
   gebeurtenis over een mens. Dat is gerepareerd in kern/neiging/neiging.js
   (twee keer hetzelfde ZEGGEN is een uitspraak, twee keer hetzelfde DOEN telt
   wel) en daarna opnieuw gemeten. De contracten hieronder beschrijven de stand
   NA die reparatie.
   ========================================================================== */
'use strict';

/* Alle zeven routes staan achter `auth` plus een gastfilter: een ingelogd lid,
   verder niets. Geen van hen kent een bevoegdheid of een object uit het lijf
   dat de toegang bepaalt -- de sessiesleutel IS het bereik. */
const LID = { klasse: 'AUTHENTICATED' };

const GEMETEN = {
  gemeten: 'ronde tegen een draaiende server (15 sep 2026, scripts in de sessie-scratchpad): elke ' +
    'route twee keer met hetzelfde lijf, verschil waargenomen via /api/neiging/geheugen en ' +
    '/api/neiging/intake, met een besturingsproef die aantoont dat de EERSTE aanroep het beeld ' +
    'wel verandert. Uitslag na de reparatie van antwoord: alle vijf de schrijfroutes 1e=verandert, ' +
    '2e=verandert niet; de twee leesroutes veranderen niets.',
  op: 'HEAD van claude/adaptive-rtg-onboarding-to5o9d'
};

const CONTRACTEN = {
  /* --------------------------------------------------------------- lezen */

  'POST /api/neiging/intake': {
    mutatieId: 'neiging.intake', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: LID,
    stand: 'PROTECTED',
    waarom: 'Hij LIJKT een leesroute en is het net niet, en dat verschil hoort hier te staan in ' +
      'plaats van weggepoetst. Hij roept kern/neiging/neiging.js `veeg()` aan, en die kan rijen ' +
      'verwijderen waarvan de bewaartermijn is verstreken. Dat is met opzet zo: de termijn loopt ' +
      'bij het LEZEN en niet in een achtergrondtaak, zodat er nooit een dag is waarop de termijn ' +
      'wel is verstreken en het gegeven er nog staat omdat een timer niet draaide. Een tweede ' +
      'aanroep heeft geen tweede effect -- wat weg is, is weg -- en de vraagmotor zelf schrijft ' +
      'niets (hij krijgt een lijst woorden en verder niets).',
    bewijs: GEMETEN
  },

  'POST /api/neiging/geheugen': {
    mutatieId: 'neiging.geheugen', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: LID,
    stand: 'PROTECTED',
    waarom: 'Zelfde als de intake: hij toont wat RTG van het lid denkt te weten en veegt en passant ' +
      'wat over zijn termijn is. Geen tweede effect bij een tweede aanroep. Hij staat met opzet NIET ' +
      'als NOT_APPLICABLE te boek: die stand zegt "deze route verandert niets", en dat zou hier een ' +
      'nette onwaarheid zijn.',
    bewijs: GEMETEN
  },

  /* -------------------------------------------------------------- schrijven */

  'POST /api/neiging/antwoord': {
    mutatieId: 'neiging.antwoord', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: LID,
    stand: 'PROTECTED',
    waarom: 'Het lid legt een antwoord vast. Hetzelfde antwoord nog een keer insturen is DEZELFDE ' +
      'uitspraak en geen tweede: kern/neiging/neiging.js laat een bestaande `gezegd` neiging ' +
      'ongemoeid (geen teller, geen klok). Dat was hier eerst anders en is door de meting hierboven ' +
      'gevonden. De vraag wordt daarnaast als GESTELD genoteerd, en ook dat is idempotent -- hij ' +
      'staat er al in. Let op wat hier NIET gebeurt: een onderwerp dat niet bij de meegestuurde ' +
      'vraag hoort wordt geteld als `genegeerd` en niet bewaard, zodat deze route geen vrije ' +
      'schrijfweg naar het geheugen van een lid is.',
    bewijs: GEMETEN
  },

  'POST /api/neiging/overslaan': {
    mutatieId: 'neiging.overslaan', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: LID,
    stand: 'PROTECTED',
    waarom: 'Zet elke vraag op gesteld. Een tweede keer overslaan vindt ze er al in en verandert ' +
      'niets. Hij raakt geen enkele neiging aan: overslaan is niet hetzelfde als wissen.',
    bewijs: GEMETEN
  },

  'POST /api/neiging/opnieuw': {
    mutatieId: 'neiging.opnieuw', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: LID,
    stand: 'PROTECTED',
    waarom: 'Maakt de lijst gestelde vragen leeg. Twee keer leegmaken is een keer leegmaken. Ook ' +
      'deze raakt geen neiging aan: wat het lid heeft verteld blijft van hem, ook als hij de vragen ' +
      'opnieuw wil zien.',
    bewijs: GEMETEN
  },

  'POST /api/neiging/vergeet': {
    mutatieId: 'neiging.vergeet', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: LID,
    stand: 'PROTECTED',
    waarom: 'Haalt een neiging echt weg. Een tweede aanroep met dezelfde id geeft 404 en verandert ' +
      'niets -- dat is een TOESTANDSCONTROLE en geen idempotentie, en die twee horen niet op een ' +
      'hoop (MUTATIECONTRACT.md). Wat de klasse hier draagt is de uitkomst: na een en na twee ' +
      'aanroepen is de neiging weg en is er niets anders veranderd. De id komt uit de eigen ' +
      'geheugenkaart van het lid, dus een id van iemand anders staat niet in zijn lijst en levert ' +
      'diezelfde 404.',
    bewijs: GEMETEN
  },

  'POST /api/neiging/niet-voor': {
    mutatieId: 'neiging.nietVoor', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: LID,
    stand: 'PROTECTED',
    waarom: 'Haalt een doel van een neiging af. Hetzelfde doel er nog een keer afhalen verandert ' +
      'niets; het doel staat al in `afgewezenDoel` en komt ook niet terug doordat het gedrag zich ' +
      'herhaalt. Een onbekend doel wordt geweigerd met 400 en niet stil genegeerd -- de lijst is ' +
      'gesloten op tonen en helpen, en `adverteren` bestaat niet.',
    bewijs: GEMETEN
  }
};

module.exports = { CONTRACTEN };
