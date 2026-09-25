/* Bedrijfsmaten, deel GELD: geld, omzet en fiscaliteit. Vorm en regels staan in ./index.js; dit bestand is alleen gegevens.
   Elk citaat moet letterlijk in zijn bestand staan -- scripts/bedrijfsmaat.js
   controleert dat, en een citaat dat er niet staat telt als niet bestaand. */
'use strict';
const c = (bestand, citaat) => ({ bestand, citaat });
const MET = 'server/kern/kantoor/metrics.js', OMZ = 'server/kern/ledenregister/omzet.js';
const KOS = 'server/kern/kosten/', FONDS = 'server/kern/fonds.js';

module.exports = [
  { id: 'geld.transactievolume', domein: 'geld', wereld: 'commercieel', eenheid: 'euro per dag en per week',
    betekenis: 'Wat leden via partnerzaken betaalden (orders en ritten). Geld van de zaak, niet van RTG.',
    berekening: 'som van betaalde orders (total) en ritten (quote) per dag, zeven dagen terug',
    actualiteit: 'live', privacy: 'zaken', minGroep: 5, eigenaar: 'kern/kantoor', graad: 'onbekend', afhankelijk: [],
    bron: [c(MET, 'betaaldeOrders.filter')], definitie: null, projectie: [c(MET, 'omzetWeek:')], bewijs: null, groepsgrens: null,
    waarom: { definitie: 'Het getal heet in de code `omzet`, terwijl dezelfde functie zegt dat RTG niets aan boekingen verdient: het is transactievolume van zaken en geen omzet van RTG. Die naam is nergens gedefinieerd.',
      bewijs: 'Geen graad, geen peilmoment, en de valuta en btw van de onderliggende orders worden niet genoemd.',
      groepsgrens: 'De prestatielijst per zaakcode toont de omzet van elke zaak afzonderlijk, ook als er maar een zaak is.' } },

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

  { id: 'omzet.leden-ontvangen', domein: 'omzet', wereld: 'rtg-intern', eenheid: 'euro per periode',
    betekenis: 'De lidmaatschapsbijdragen die werkelijk zijn betaald.',
    berekening: 'nog niet vastgesteld', actualiteit: 'live', privacy: 'huis', minGroep: null, eigenaar: 'kern/aanmeldingen',
    graad: 'onbekend', afhankelijk: [],
    bron: [c('server/kern/aanmeldingen.js', 'function termijnVoldaan'), c('server/kern/kosten/factuurregel.js', 'md.invoices.push')],
    definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { definitie: 'Wanneer een termijn omzet is -- bij factuur of bij betaling, met of zonder btw, en in welke periode -- staat nergens vast.',
      projectie: 'Er is geen functie die voldane termijnen per periode optelt; kantoor/metrics.js telt ze alleen om de 30% voor de RTFoundation te berekenen.',
      bewijs: 'Zonder projectie is er niets om een graad aan te hangen.' } },

  { id: 'omzet.doorbelasting', domein: 'omzet', wereld: 'commercieel', eenheid: 'euro per maand',
    betekenis: 'Kosten die RTG na vrijgave door een mens doorbelast aan zaken.',
    berekening: 'per drager het klaargezette en vrijgegeven bedrag uit de kostenlaag',
    actualiteit: 'periode', privacy: 'zaken', minGroep: 5, eigenaar: 'kern/kosten', graad: 'vermoed', afhankelijk: ['kosten.per-drager'],
    bron: [c(KOS + 'factuurregel.js', 'function boekDoorbelasting')], definitie: [c(KOS + 'beleidkaart.js', 'bestaatNog')],
    projectie: [c(KOS + 'doorbelasting.js', 'function standVoor')], bewijs: [c(KOS + 'doorbelasting.js', 'function vrijgeven')], groepsgrens: null,
    waarom: { groepsgrens: 'De stand is per zaak; een totaal over zaken met een groepsgrens bestaat niet.' } },

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
    projectie: [c('server/kern/fiscaal/btwaangifte.js', 'function maak(zaak, periode')], bewijs: [c('server/kern/fiscaal/herkomst.js', 'function verklaar')], groepsgrens: null,
    waarom: { groepsgrens: 'De aangifte is per zaak en voor die zaak zelf; een optelling over zaken bestaat niet en is voor RTG ook niet nodig.' } }
];
