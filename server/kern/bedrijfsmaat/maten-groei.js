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
    actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: 'kern/ledenregister', graad: 'gemeten', afhankelijk: [],
    bron: [c(REG, 'r.via && r.via.code')], definitie: [c(REG, 'AANWAS PER BEDRIJF')],
    projectie: [c(REG, 'perBedrijf: groepstelling(sorteerTelling(perBedrijf)')],
    bewijs: [c(REG, "graad: 'gemeten', peilmoment: new Date().toISOString(), afgekapt")],
    groepsgrens: [c(REG, 'perBedrijf: groepstelling(')],
    waarom: {} },

  { id: 'acquisitie.kanaal', domein: 'acquisitie', wereld: 'consument', eenheid: 'aanmeldingen per kanaal per maand',
    betekenis: 'Via welk kanaal of welke campagne iemand zegt binnen te komen -- geteld, niet per lid bewaard.',
    berekening: 'een telling per maand per kanaal en per campagnecode, bij het aanmelden; kanalen met secundaire onderdrukking, campagnes onder de grens in Overige',
    actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: 'kern/aanmeldkanaal', graad: 'gemeten', afhankelijk: [],
    bron: [c('server/routes/auth/account.js', 'kern.aanmeldkanaalTel({ kanaal: req.body.aanmeldkanaal')],
    definitie: [c('server/kern/bedrijfsmaat/definities.js', 'Het AANMELDKANAAL is')],
    projectie: [c('server/kern/aanmeldkanaal.js', 'function stand(')], bewijs: [c('server/kern/aanmeldkanaal.js', 'dektNiet:')],
    groepsgrens: [c('server/kern/aanmeldkanaal.js', "{ benoemd: true }")],
    gedeeltelijk: 'Alleen wie de vraag beantwoordt of via een campagnelink komt. De vraag komt na de registratie en is over te slaan.',
    waarom: {} },

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
