/* Bedrijfsmaten, deel GELD: geld, omzet en fiscaliteit. Vorm en regels staan in ./index.js; dit bestand is alleen gegevens.
   Elk citaat moet letterlijk in zijn bestand staan -- scripts/bedrijfsmaat.js
   controleert dat, en een citaat dat er niet staat telt als niet bestaand. */
'use strict';
const c = (bestand, citaat) => ({ bestand, citaat });
const MET = 'server/kern/kantoor/metrics-week.js', OMZ = 'server/kern/ledenregister/omzet.js';
const KOS = 'server/kern/kosten/', FONDS = 'server/kern/fonds.js';
const DEF = 'server/kern/bedrijfsmaat/definities.js', PRJ = 'server/kern/bedrijfsmaat/projecties.js';
const STAND = 'server/kern/bedrijfsmaat/stand.js';

module.exports = [
  { id: 'geld.transactievolume', domein: 'geld', wereld: 'commercieel', eenheid: 'eurocent per maand, zonder btw',
    betekenis: 'Wat leden via partnerzaken betaalden (orders en ritten). Geld van de zaak, niet van RTG.',
    berekening: 'som van de subtotalen van facturen met betaalwijze rtg van zaken in de maand',
    actualiteit: 'live', privacy: 'zaken', minGroep: 5, eigenaar: 'kern/kantoor', graad: 'gemeten', afhankelijk: [],
    bron: [c('server/kern/facturatie/motor.js', 'regels: v.regels, subtotaal: v.subtotaal, btwBedrag: v.btwBedrag')], definitie: [c('server/kern/bedrijfsmaat/definities-later.js', 'transactievolume: d29(19')], projectie: [c('server/kern/bedrijfsmaat/stand-groei.js', 'function transactievolume()')], bewijs: [c('server/kern/bedrijfsmaat/stand-groei.js', "eenheid: 'eurocent, zonder btw', btwCenten")],
    groepsgrens: [c('server/kern/bedrijfsmaat/stand-groei.js', 'toon(ZAKEN, { waarde: centen, n: zaken.size })')],
    waarom: {} },

  { id: 'geld.foundation-afdracht', domein: 'geld', wereld: 'rtg-intern', eenheid: 'euro',
    betekenis: 'Het deel van de lidmaatschapsbijdragen dat RTG aan de RTFoundation verschuldigd is, en wat daarvan gestort is.',
    berekening: 'grootboek fondsAfdrachten per betaling; totaal, te storten, ingepland en gestort',
    actualiteit: 'live', privacy: 'huis', minGroep: null, eigenaar: 'kern/fonds', graad: 'gemeten', afhankelijk: ['omzet.leden-ontvangen'],
    bron: [c(FONDS, 'async function boekAfdracht')], definitie: [c(FONDS, 'function aandeelCenten')],
    projectie: [c(MET, 'const fondsAfdracht = {')], bewijs: [c(FONDS, 'async function reconcileSettlement'), c(FONDS, 'function proof')], groepsgrens: null,
    waarom: {} },

  { id: 'omzet.leden-maand', domein: 'omzet', wereld: 'rtg-intern', eenheid: 'euro per maand',
    betekenis: 'De terugkerende maandbijdrage van alle leden: lijstprijs maal aantal voor RTG Pass, de afgesproken contractbedragen voor de contractuele treden.',
    berekening: 'per pas aantal x maandprijs, of de som van afgesprokenCenten van lopende contracten; leden zonder contract apart',
    actualiteit: 'live', privacy: 'huis', minGroep: null, eigenaar: 'kern/ledenregister', graad: 'gemeten', afhankelijk: ['groei.leden-per-pas'],
    bron: [c(OMZ, 'afgesprokenCenten'), c('server/accounts/dossier.js', 'function ledenRegisterRijen')],
    definitie: [c(OMZ, 'WAT BRENGEN DE LEDEN OP')], projectie: [c(OMZ, 'function omzetstaat')], bewijs: [c(OMZ, "split.aard = 'afgesproken'"), c(OMZ, 'split.peilmoment'), c(OMZ, 'split.dektNiet')],
    groepsgrens: null, waarom: {} },

  { id: 'omzet.leden-ontvangen', domein: 'omzet', wereld: 'rtg-intern', eenheid: 'eurocent per maand, zonder btw',
    betekenis: 'De lidmaatschapstermijnen die een mens in de maand als voldaan aftekende (kasbasis).',
    berekening: 'som van centen van termijnen met status voldaan en voldaan.at in de maand',
    actualiteit: 'live', privacy: 'huis', minGroep: null, eigenaar: 'kern/bedrijfsmaat', graad: 'gemeten', afhankelijk: [],
    bron: [c('server/kern/aanmeldingen.js', 'function termijnVoldaan')], definitie: [c(DEF, 'omzetOntvangen: d(1')],
    projectie: [c(PRJ, 'function omzet')], bewijs: [c(STAND, 'peilmoment, maand: m'), c(STAND, 'dektNiet')], groepsgrens: null,
    gedeeltelijk: 'Alleen de betaalschema\'s uit aanmeldingen. De ledenfacturen van RTG Pass-leden staan per lid versleuteld in de kluis (member_state) en worden niet gelezen; ze optellen is een leesweg naar de kluis en vraagt een besluit.',
    waarom: {} },

  { id: 'omzet.leden-gefactureerd', domein: 'omzet', wereld: 'rtg-intern', eenheid: 'eurocent per maand, zonder btw',
    betekenis: 'De lidmaatschapstermijnen die in de maand vervallen (factuurbasis), naast de ontvangen omzet.',
    berekening: 'som van centen van termijnen waarvan vervalt in de maand ligt',
    actualiteit: 'live', privacy: 'huis', minGroep: null, eigenaar: 'kern/bedrijfsmaat', graad: 'gemeten', afhankelijk: [],
    bron: [c('server/kern/aanmeldingen/betaalschema.js', 'function vertaal')], definitie: [c(DEF, 'omzetGefactureerd: d(1')],
    projectie: [c(PRJ, 'function omzet')], bewijs: [c(STAND, 'peilmoment, maand: m'), c(STAND, 'dektNiet')], groepsgrens: null,
    gedeeltelijk: 'Zelfde grens als de ontvangen omzet: de ledenfacturen in de kluis tellen niet mee.',
    waarom: {} },

  { id: 'omzet.doorbelasting', domein: 'omzet', wereld: 'commercieel', eenheid: 'euro per maand',
    betekenis: 'Kosten die RTG na vrijgave door een mens doorbelast aan zaken.',
    berekening: 'per drager het klaargezette en vrijgegeven bedrag uit de kostenlaag',
    actualiteit: 'periode', privacy: 'zaken', minGroep: 5, eigenaar: 'kern/kosten', graad: 'vermoed', afhankelijk: ['kosten.per-drager'],
    bron: [c(KOS + 'factuurregel.js', 'function boekDoorbelasting')], definitie: [c(KOS + 'beleidkaart.js', 'bestaatNog')],
    projectie: [c(KOS + 'doorbelasting.js', 'function standVoor')], bewijs: [c(KOS + 'doorbelasting.js', 'function vrijgeven')],
    groepsgrens: [c('test/stuur-kantoor.test.js', "const TONEN = ['/api/command/puls'")],
    gedeeltelijk: 'Een werklijst per zaak voor een mens op naam die een doorbelasting vrijgeeft (besluit 25 september 2026: mens ja, machine nee). Een totaal over zaken met de groepsgrens bestaat nog niet.',
    waarom: {} },

  { id: 'fiscaal.btw-rtg', domein: 'fiscaliteit', wereld: 'rtg-intern', eenheid: 'eurocent btw per kwartaal',
    betekenis: 'De btw die RTG zelf verschuldigd is over zijn lidmaatschapstermijnen, als voorbereiding voor een mens.',
    berekening: 'termijnen die in het kwartaal vervielen, zonder btw, maal het standaardtarief; klasse advies', actualiteit: 'periode',
    privacy: 'huis', minGroep: null, eigenaar: 'kern/bedrijfsmaat', graad: 'vermoed', afhankelijk: ['omzet.leden-ontvangen'],
    bron: [c('server/kern/aanmeldingen.js', 'function termijnVoldaan')], definitie: [c('server/kern/bedrijfsmaat/definities-later.js', 'btwRtg: d30(22')],
    projectie: [c('server/kern/bedrijfsmaat/stand-toelating.js', 'function btwRtg()')], bewijs: [c('server/kern/bedrijfsmaat/stand-toelating.js', "zekerheid: zekerheid('btw.rtg')"), c('server/kern/fiscaal/zekerheid.js', "'btw.rtg': { klasse: 'advies'")],
    groepsgrens: null,
    gedeeltelijk: 'De verbruiksfacturen per lid staan versleuteld in de kluis en worden niet gelezen; dit is een ondergrens.',
    waarom: {} },

  { id: 'fiscaal.btw-zaken', domein: 'fiscaliteit', wereld: 'commercieel', eenheid: 'euro per aangifteperiode, per zaak',
    betekenis: 'De btw-aangifte die RTG voor een zaak samenstelt uit haar eigen factuurregister.',
    berekening: 'telling uit het factuurregister van de zaak, per tarief', actualiteit: 'periode', privacy: 'zaken', minGroep: 5,
    eigenaar: 'kern/fiscaal', graad: 'gemeten', afhankelijk: [],
    bron: [c('server/kern/fiscaal/btwaangifte.js', "bezit: { btwAangiftes: 'lijst' }")], definitie: [c('server/kern/fiscaal/zekerheid.js', 'DE VIER ZEKERHEIDSKLASSEN')],
    projectie: [c('server/kern/fiscaal/btwaangifte.js', 'function maak(zaak, periode')], bewijs: [c('server/kern/fiscaal/herkomst.js', 'function verklaar')],
    groepsgrens: [c('test/stuur-kantoor.test.js', "const TONEN = ['/api/command/puls'")],
    waarom: {} }
];
