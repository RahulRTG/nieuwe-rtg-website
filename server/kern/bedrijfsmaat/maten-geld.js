/* Bedrijfsmaten, deel GELD: geld, omzet en fiscaliteit. Vorm en regels staan in ./index.js; dit bestand is alleen gegevens.
   Elk citaat moet letterlijk in zijn bestand staan -- scripts/bedrijfsmaat.js
   controleert dat, en een citaat dat er niet staat telt als niet bestaand. */
'use strict';
const c = (bestand, citaat) => ({ bestand, citaat });
const MET = 'server/kern/kantoor/metrics.js', OMZ = 'server/kern/ledenregister/omzet.js';
const KOS = 'server/kern/kosten/', FONDS = 'server/kern/fonds.js';
const DEF = 'server/kern/bedrijfsmaat/definities.js', PRJ = 'server/kern/bedrijfsmaat/projecties.js';
const STAND = 'server/kern/bedrijfsmaat/stand.js';

module.exports = [
  { id: 'geld.transactievolume', domein: 'geld', wereld: 'commercieel', eenheid: 'euro per dag en per week',
    betekenis: 'Wat leden via partnerzaken betaalden (orders en ritten). Geld van de zaak, niet van RTG.',
    berekening: 'som van betaalde orders (total) en ritten (quote) per dag, zeven dagen terug',
    actualiteit: 'live', privacy: 'zaken', minGroep: 5, eigenaar: 'kern/kantoor', graad: 'onbekend', afhankelijk: [],
    bron: [c(MET, 'betaaldeOrders.filter')], definitie: null, projectie: [c(MET, 'omzetWeek:')], bewijs: null,
    groepsgrens: [c(MET, 'zaken.size < ZAKEN_GRENS ? dicht(dag) : dag')],
    waarom: { definitie: 'Het getal heet in de code `omzet`, terwijl dezelfde functie zegt dat RTG niets aan boekingen verdient: het is transactievolume van zaken en geen omzet van RTG. Die naam is nergens gedefinieerd.',
      bewijs: 'Geen graad, geen peilmoment, en de valuta en btw van de onderliggende orders worden niet genoemd.' } },

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
    actualiteit: 'live', privacy: 'huis', minGroep: null, eigenaar: 'kern/ledenregister', graad: 'onbekend', afhankelijk: ['groei.leden-per-pas'],
    bron: [c(OMZ, 'afgesprokenCenten'), c('server/accounts/dossier.js', 'function ledenRegisterRijen')],
    definitie: [c(OMZ, 'WAT BRENGEN DE LEDEN OP')], projectie: [c(OMZ, 'function omzetstaat')], bewijs: null, groepsgrens: null,
    waarom: { bewijs: 'De staat zegt eerlijk wat er NIET in zit (zonderContract), maar draagt geen graad en geen peilmoment. Het is een terugkerend bedrag uit afspraken, geen ontvangen geld; dat verschil staat nergens in het antwoord.' } },

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

  { id: 'fiscaal.btw-rtg', domein: 'fiscaliteit', wereld: 'rtg-intern', eenheid: 'euro per aangifteperiode',
    betekenis: 'De btw die RTG zelf verschuldigd is over zijn eigen facturen.',
    berekening: 'nog niet vastgesteld', actualiteit: 'periode', privacy: 'huis', minGroep: null, eigenaar: null, graad: 'onbekend',
    afhankelijk: ['omzet.leden-ontvangen'],
    bron: [c('server/kern/kosten/factuurregel.js', 'md.invoices.push')], definitie: [c('server/kern/fiscaal/tarief.js', 'WELK BTW-TARIEF HOORT BIJ DEZE VERKOOP')],
    projectie: null, bewijs: null, groepsgrens: null,
    waarom: { projectie: 'De aangiftemotor (kern/fiscaal/btwaangifte.js) rekent voor een ZAAK; RTG is geen zaak in zijn eigen systeem, dus zijn eigen aangifte wordt nergens samengesteld.',
      bewijs: 'Volgt uit de projectie; de zekerheidsklassen en de herkomstketen staan klaar.', eigenaar: 'Niemand.' } },

  { id: 'fiscaal.btw-zaken', domein: 'fiscaliteit', wereld: 'commercieel', eenheid: 'euro per aangifteperiode, per zaak',
    betekenis: 'De btw-aangifte die RTG voor een zaak samenstelt uit haar eigen factuurregister.',
    berekening: 'telling uit het factuurregister van de zaak, per tarief', actualiteit: 'periode', privacy: 'zaken', minGroep: 5,
    eigenaar: 'kern/fiscaal', graad: 'gemeten', afhankelijk: [],
    bron: [c('server/kern/fiscaal/btwaangifte.js', "bezit: { btwAangiftes: 'lijst' }")], definitie: [c('server/kern/fiscaal/zekerheid.js', 'DE VIER ZEKERHEIDSKLASSEN')],
    projectie: [c('server/kern/fiscaal/btwaangifte.js', 'function maak(zaak, periode')], bewijs: [c('server/kern/fiscaal/herkomst.js', 'function verklaar')],
    groepsgrens: [c('test/stuur-kantoor.test.js', "const TONEN = ['/api/command/puls'")],
    waarom: {} }
];
