/* Bedrijfsmaten, deel GROEI: acquisitie, CAC, activatie en cohort.
   Vorm en regels staan in ./index.js; dit bestand is alleen gegevens. Retentie
   en churn staan in ./maten-behoud.js. */
'use strict';
const c = (bestand, citaat) => ({ bestand, citaat });
const REG = 'server/kern/ledenregister.js';
const DEF = 'server/kern/bedrijfsmaat/definities.js', PRJ = 'server/kern/bedrijfsmaat/projecties.js';
const STAND = 'server/kern/bedrijfsmaat/stand.js';
const PAS = c('server/kern/pasgeschiedenis.js', 'function noteerPasOvergang');
const BEWIJS = [c(STAND, 'peilmoment, maand: m'), c(STAND, 'dektNiet')];
const POORT = [c(STAND, 'toon(LEDEN, {')];

module.exports = [
  { id: 'acquisitie.nieuwe-leden', domein: 'acquisitie', wereld: 'consument', eenheid: 'leden per maand',
    betekenis: 'Hoeveel mensen er in een maand lid werden: hun eerste pas boven gast.',
    berekening: 'eerste overgang naar een betaalde pas in de pasgeschiedenis, geteld per maand',
    actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: 'kern/bedrijfsmaat', graad: 'gemeten', afhankelijk: [],
    bron: [PAS], definitie: [c(DEF, 'nieuwLid: d(1')], projectie: [c(PRJ, 'function nieuweLeden')],
    bewijs: BEWIJS, groepsgrens: POORT, waarom: {} },

  { id: 'acquisitie.via-werkgever', domein: 'acquisitie', wereld: 'consument', eenheid: 'leden per werkgever',
    betekenis: 'Aanwas via de wervingslink van een werkgever: welk bedrijf hoeveel leden bracht, nooit wie.',
    berekening: 'telling per zaakcode van de uitnodiging waarmee een lid binnenkwam',
    actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: 'kern/ledenregister', graad: 'onbekend', afhankelijk: [],
    bron: [c(REG, 'r.via && r.via.code')], definitie: [c(REG, 'AANWAS PER BEDRIJF')],
    projectie: [c(REG, 'perBedrijf: groepstelling(sorteerTelling(perBedrijf)')], bewijs: null,
    groepsgrens: [c(REG, 'perBedrijf: groepstelling(')],
    waarom: { bewijs: 'Geen graad en geen peilmoment in het antwoord.' } },

  { id: 'acquisitie.kanaal', domein: 'acquisitie', wereld: 'consument', eenheid: 'leden per kanaal',
    betekenis: 'Via welke campagne, verwijzing of link iemand binnenkwam.', berekening: 'nog niet vastgesteld',
    actualiteit: 'onbekend', privacy: 'leden', minGroep: 10, eigenaar: null, graad: 'onbekend', afhankelijk: ['campagnes.rtg-marketing'],
    bron: null, definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { bron: 'Geen enkele route legt een herkomstkanaal vast (nul treffers in server/ op utm, verwijzer, referral of acquisitiekanaal). Alleen de werkgeverslink wordt onthouden.',
      definitie: 'Volgt pas als er een bron is.', projectie: 'Idem.', bewijs: 'Idem.', groepsgrens: 'Idem.', eigenaar: 'Niemand.' } },

  { id: 'cac.per-kanaal', domein: 'cac', wereld: 'rtg-intern', eenheid: 'euro per nieuw lid',
    betekenis: 'Wat het kost om via een kanaal een lid te werven.', berekening: 'marketinguitgaven per kanaal / nieuwe leden per kanaal',
    actualiteit: 'onbekend', privacy: 'huis', minGroep: null, eigenaar: null, graad: 'onbekend',
    afhankelijk: ['acquisitie.kanaal', 'acquisitie.nieuwe-leden', 'campagnes.rtg-marketing'],
    bron: 'afgeleid', definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { definitie: 'Niet besloten welke uitgaven meetellen.', projectie: 'Niet gebouwd.', bewijs: 'Volgt uit de projectie.', eigenaar: 'Niemand.' } },

  { id: 'cohort.aanmeldweek', domein: 'cohort', wereld: 'consument', eenheid: 'leden per ISO-week',
    betekenis: 'Leden gegroepeerd naar de ISO-week waarin ze nieuw lid werden, zodat gedrag per groep te volgen is.',
    berekening: 'ISO-week van het moment van nieuw lid, de laatste twaalf weken',
    actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: 'kern/bedrijfsmaat', graad: 'gemeten',
    afhankelijk: ['acquisitie.nieuwe-leden'],
    bron: [PAS], definitie: [c(DEF, 'cohort: d(1')], projectie: [c(PRJ, 'function isoWeek')],
    bewijs: BEWIJS, groepsgrens: [c(STAND, 'grootte: toon(LEDEN')], waarom: {} },

  { id: 'activatie.eerste-waarde', domein: 'activatie', wereld: 'consument', eenheid: 'aandeel van een cohort',
    betekenis: 'Het aandeel nieuwe leden met een eerste geslaagde uitkomst binnen 30 dagen, in welke wereld ook.',
    berekening: 'teller: leden van een afgelopen cohortvenster met een afgeronde rit of bezorgde/opgehaalde bestelling binnen 30 dagen; noemer: die leden',
    actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: 'kern/bedrijfsmaat', graad: 'gemeten',
    afhankelijk: ['cohort.aanmeldweek', 'uitkomst.rit-afgerond'],
    bron: [PAS, c(STAND, 'function uitkomsten')], definitie: [c(DEF, 'activatie: d(1')], projectie: [c(PRJ, 'function activatie')],
    bewijs: BEWIJS, groepsgrens: [c(STAND, 'activatie: verhouding(LEDEN')], waarom: {} }
];
