/* Bedrijfsmaten, deel MARKT: de campagnes van de RTFoundation, commerciele groei
   en geografische groei (de campagnes van RTG zelf staan bij het boek, C12).
   Vorm en regels staan in ./index.js; dit bestand is alleen gegevens. */
'use strict';
const c = (bestand, citaat) => ({ bestand, citaat });
const REG = 'server/kern/ledenregister.js', DOS = 'server/accounts/dossier.js';

module.exports = [
  { id: 'campagnes.rtf-werving', domein: 'campagnes', wereld: 'rtfoundation', eenheid: 'euro per campagne',
    betekenis: 'Landelijke wervingscampagnes van de RTFoundation en hoe hun opbrengst naar steden gaat.',
    berekening: 'per campagne de opgehaalde bedragen en de verdeelsleutel', actualiteit: 'live', privacy: 'huis', minGroep: null,
    eigenaar: 'kern/rtfos', graad: 'vermoed', afhankelijk: [],
    bron: [c('server/kern/rtfos/campagnes.js', 'function maak')], definitie: [c('server/kern/rtfos/campagnes.js', 'landelijk werven, lokaal besteden')],
    projectie: [c('server/kern/rtfos/campagnes.js', 'function lijst'), c('server/kern/rtfos/campagnes.js', 'function ronde')],
    bewijs: [c('server/kern/rtfos/campagnes.js', "graad: 'vermoed', peilmoment: nu()")], groepsgrens: null,
    waarom: {} },

  { id: 'groei.leden-per-pas', domein: 'commerciele-groei', wereld: 'consument', eenheid: 'leden per pas',
    betekenis: 'Hoeveel leden elke pas heeft.', berekening: 'telling per pas uit het ledenregister',
    actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: 'kern/ledenregister', graad: 'gemeten', afhankelijk: [],
    bron: [c(DOS, 'function ledenRegisterRijen')], definitie: [c('server/kern/pasladder.js', 'const LADDER = [')],
    projectie: [c(REG, 'const perPasOpen = groepstelling(PAS_VOLGORDE.map')],
    bewijs: [c(REG, "graad: 'gemeten', peilmoment: new Date().toISOString(), afgekapt"), c(REG, 'const afgekapt = rijen.length >= MAX')],
    groepsgrens: [c(REG, 'perPas: perPasOpen')], waarom: {} },

  { id: 'groei.zaken-per-genre', domein: 'commerciele-groei', wereld: 'commercieel', eenheid: 'zaken per genre',
    betekenis: 'Hoeveel actieve partnerzaken er per genre zijn, en hoe dat groeit.', berekening: 'toegelaten zaken met minstens een verzoek door hun eigen deur in de maand, per genre',
    actualiteit: 'live', privacy: 'zaken', minGroep: 5, eigenaar: 'kern/bedrijfsmaat', graad: 'gemeten', afhankelijk: [],
    bron: [c('server/kern/kantoor/metrics.js', 'o.supplierCode')], definitie: [c('server/kern/bedrijfsmaat/definities-later.js', 'zakenPerGenre: d29(17')], projectie: [c('server/kern/bedrijfsmaat/stand-groei.js', 'function zakenPerGenre()')], bewijs: [c('server/kern/bedrijfsmaat/stand-groei.js', "niet('De kostenmeter is niet beschikbaar")], groepsgrens: [c('server/kern/bedrijfsmaat/stand-groei.js', 'groepeer(rijen, { grens: KLASSEN.zaken.grens, benoemd: true })')],
    waarom: {} },

  { id: 'geo.leden-per-land', domein: 'geografische-groei', wereld: 'consument', eenheid: 'leden per land',
    betekenis: 'Waar de leden wonen, per land.', berekening: 'telling per land uit het ledenregister',
    actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: 'kern/ledenregister', graad: 'vermoed', afhankelijk: [],
    bron: [c(REG, 'telOp(perLand, r.land)')], definitie: [c('server/kern/bedrijfsmaat/definities-later.js', 'geoLand: d29(16')], projectie: [c(REG, 'perLand: groepstelling(sorteerTelling(perLand))')], bewijs: [c(REG, "graad: 'gemeten', peilmoment: new Date().toISOString(), afgekapt"), c(REG, 'Land en stad zijn door het lid opgegeven')], groepsgrens: [c(REG, 'perLand: groepstelling(')],
    waarom: {} },

  { id: 'geo.leden-per-stad', domein: 'geografische-groei', wereld: 'consument', eenheid: 'leden per stad',
    betekenis: 'Waar de leden wonen, per stad.', berekening: 'telling per stad uit het intakeprofiel',
    actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: 'kern/ledenregister', graad: 'vermoed', afhankelijk: [],
    bron: [c(REG, 'telOp(perStad, stad)')], definitie: [c('server/kern/bedrijfsmaat/definities-later.js', 'geoStad: d29(16')], projectie: [c(REG, 'perStad: groepstelling(sorteerTelling(perStad))')], bewijs: [c(REG, "graad: 'gemeten', peilmoment: new Date().toISOString(), afgekapt"), c(REG, 'Land en stad zijn door het lid opgegeven')], groepsgrens: [c(REG, 'perStad: groepstelling(')],
    waarom: {} },

  { id: 'geo.rtf-steden', domein: 'geografische-groei', wereld: 'rtfoundation', eenheid: 'steden met status',
    betekenis: 'In welke steden de RTFoundation actief is, en in welke stand.', berekening: 'stedenboom met status per stad',
    actualiteit: 'live', privacy: 'huis', minGroep: null, eigenaar: 'kern/rtfos', graad: 'gemeten', afhankelijk: [],
    bron: [c('server/kern/rtfos/steden.js', 'function stadMaak')], definitie: [c('server/kern/rtfos/steden.js', "const STATUS = ['verkend'")],
    projectie: [c('server/kern/rtfos/steden.js', 'function boom')],
    bewijs: [c('server/kern/rtfos/steden.js', "graad: 'gemeten', peilmoment: nu()")], groepsgrens: null, waarom: {} }
];
