/* Bedrijfsmaten, deel WEERBAARHEID: infrastructuur, risico en weerbaarheid. Vorm en regels staan in ./index.js. */
'use strict';
const c = (bestand, citaat) => ({ bestand, citaat });
const KOS = 'server/kern/kosten/';

module.exports = [
  { id: 'infra.gezondheid', domein: 'infrastructuur', wereld: 'rtg-intern', eenheid: 'oordeel per vermogen, met graad',
    betekenis: 'Doet het het: per vermogen een oordeel met de bewijsgraad en de bronnen eronder.',
    berekening: 'strengste bevinding per vermogen; onbekend is geen in orde', actualiteit: 'live', privacy: 'huis', minGroep: null,
    eigenaar: 'kern/command', graad: 'gemeten', afhankelijk: [],
    bron: [c('server/kern/command/gezondheid.js', 'async function controleer')], definitie: [c('server/kern/command/gezondheid.js', 'DE GEZONDHEIDSKAART')],
    projectie: [c('server/kern/command/gezondheid.js', 'function stand')], bewijs: [c('server/kern/command/gezondheid.js', 'bewijs: { graad')], groepsgrens: null, waarom: {} },

  { id: 'infra.kosten-toegerekend', domein: 'infrastructuur', wereld: 'rtg-intern', eenheid: 'euro per maand',
    betekenis: 'Stroom en serverhuur, verdeeld uit de echte nota met de sleutel erbij.', berekening: 'nota x verdeelsleutel',
    actualiteit: 'periode', privacy: 'huis', minGroep: null, eigenaar: 'kern/kosten', graad: 'vermoed', afhankelijk: [],
    bron: [c(KOS + 'toerekening.js', 'function verdeling')], definitie: [c(KOS + 'soorten.js', "id: 'hosting'")],
    projectie: [c(KOS + 'overzicht.js', 'function directeKostenPerDrager')], bewijs: [c(KOS + 'soorten.js', "meetweg: 'toegerekend'")], groepsgrens: null, waarom: {} },

  { id: 'infra.opslag', domein: 'infrastructuur', wereld: 'rtg-intern', eenheid: 'GB-maand',
    betekenis: 'Opgeslagen gegevens als stand die je peilt, niet als stroom die je optelt.', berekening: 'periodieke peiling',
    actualiteit: 'periode', privacy: 'huis', minGroep: null, eigenaar: 'kern/kosten', graad: 'gemeten', afhankelijk: [],
    bron: [c(KOS + 'meterstand.js', 'function peil')], definitie: [c(KOS + 'soorten.js', "id: 'opslag'")],
    projectie: [c(KOS + 'meter.js', 'function beeldPeriode')], bewijs: [c(KOS + 'soorten.js', "meetweg: 'gemeten'")], groepsgrens: null, waarom: {} },

  { id: 'risico.rtg', domein: 'risico', wereld: 'rtg-intern', eenheid: 'risico per categorie met stand',
    betekenis: 'Het risicoregister van RTG zelf.', berekening: 'nog niet vastgesteld',
    actualiteit: 'onbekend', privacy: 'huis', minGroep: null, eigenaar: null, graad: 'onbekend', afhankelijk: [],
    bron: null, definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { bron: 'Er is geen risicoregister voor RTG (KANTOORMACHT.md: er is geen enkele risicomodule). Het register in kern/rtfos/risico.js is van de RTFoundation en blijft in haar wereld (C1).',
      definitie: 'Volgt pas als er een bron is.', projectie: 'Idem.', bewijs: 'Idem.', eigenaar: 'Niemand.' } },

  { id: 'risico.rtf', domein: 'risico', wereld: 'rtfoundation', eenheid: 'risico per stad en landelijk',
    betekenis: 'Het risicoregister van de RTFoundation: geen "beheerst" zonder maatregel, en een verlopen herbeoordeling valt op.',
    berekening: 'register met stand en herbeoordelingsdatum', actualiteit: 'live', privacy: 'huis', minGroep: null, eigenaar: 'kern/rtfos',
    graad: 'onbekend', afhankelijk: [],
    bron: [c('server/kern/rtfos/risico.js', 'function meld')], definitie: [c('server/kern/rtfos/risico.js', 'const CATEGORIEEN = [')],
    projectie: [c('server/kern/rtfos/risico.js', 'function lijst')], bewijs: [c('server/kern/rtfos/risico.js', 'function herbeoordeel')], groepsgrens: null, waarom: {} },

  { id: 'risico.betalingen-onbekend', domein: 'risico', wereld: 'rtg-intern', eenheid: 'betalingen in een onbekende stand',
    betekenis: 'Betalingen waarvan de afloop niet vaststaat na een crash, time-out of herhaling.', berekening: 'nog niet vastgesteld',
    actualiteit: 'live', privacy: 'huis', minGroep: null, eigenaar: 'kern/betaalwaarheid', graad: 'onbekend', afhankelijk: [],
    bron: [c('server/kern/betaalwaarheid/staten.js', 'const OVERGANGEN =')], definitie: [c('server/kern/betaalwaarheid/index.js', 'De RTG Payment Truth')],
    projectie: null, bewijs: null, groepsgrens: null,
    waarom: { projectie: 'De waarheid staat per betaling; een telling van onbekende standen als bedrijfsmaat bestaat niet.', bewijs: 'Volgt uit de projectie.' } },

  { id: 'weerbaarheid.backup', domein: 'weerbaarheid', wereld: 'rtg-intern', eenheid: 'laatste bruikbare back-up',
    betekenis: 'Of er een back-up is waar ook iets IN staat, en van wanneer.', berekening: 'inhoudscontrole van de laatste dagmap',
    actualiteit: 'live', privacy: 'huis', minGroep: null, eigenaar: 'server/backupstand', graad: 'gemeten', afhankelijk: [],
    bron: [c('server/backupstand.js', 'function lees')], definitie: [c('server/backupstand.js', 'IS ER EEN BACK-UP')],
    projectie: [c('server/backupstand.js', 'function inhoud')], bewijs: [c('server/backupstand.js', 'function inhoud')], groepsgrens: null, waarom: {} },

  { id: 'weerbaarheid.terugwegen', domein: 'weerbaarheid', wereld: 'rtg-intern', eenheid: 'paren per herstelsoort',
    betekenis: 'Welke handelingen een beproefde terugweg hebben (exact of compensatie).', berekening: 'heen, kijken, terug, kijken, per paar',
    actualiteit: 'bij-meting', privacy: 'huis', minGroep: null, eigenaar: 'scripts/herstelproef', graad: 'onbekend', afhankelijk: [],
    bron: [c('scripts/herstelproef.js', 'function parenUit')], definitie: [c('INTELLIGENTIE.md', 'De terugweg is het echte plafond op autonomie')],
    projectie: [c('HERSTELPROEF.json', '"wereldOntbreekt"')], bewijs: null, groepsgrens: null,
    waarom: { bewijs: 'HERSTELPROEF.json draagt geen stempel (geen commit, geen datum), en volgens INTELLIGENTIE.md par. 3.5a reproduceert hij niet op een andere machine. Het getal staat er; wanneer en waarop het gemeten is, niet.' } },

  { id: 'weerbaarheid.afhankelijkheden', domein: 'weerbaarheid', wereld: 'rtg-intern', eenheid: 'leveranciers per vermogen',
    betekenis: 'Van welke externe leveranciers een vermogen afhangt, en wat er gebeurt als er een wegvalt.', berekening: 'nog niet vastgesteld',
    actualiteit: 'onbekend', privacy: 'huis', minGroep: null, eigenaar: null, graad: 'onbekend', afhankelijk: ['leveranciers.providers'],
    bron: [c(KOS + 'providerfactuur.js', 'function factuurZet')], definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { definitie: 'Welke leverancier voor welk vermogen onmisbaar is, is niet vastgelegd.', projectie: 'Niet gebouwd.', bewijs: 'Volgt uit de projectie.', eigenaar: 'Niemand.' } }
];
