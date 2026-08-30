/* ============================================================================
   ROUTES DIE HIER NOOIT EEN DUPLICAATREGEL KRIJGEN.

   Deel van ./idemsleutels.js, en het tegenovergestelde van de rest: geen lijst
   van wat er geldt, maar een lijst van wat er NIET mag gelden. Staat een van deze
   routes toch in een sleutelbestand, dan GOOIT dit bestand bij het laden.

   Waarom een grendel en geen opmerking. Alle vier hieronder hebben er een keer
   wel een gehad -- door mij, in de kale ronde van 30 augustus 2026 -- en alle
   vier kostten ze iets. Een opmerking in het bestand waar de fout gemaakt wordt
   is geen verdediging: de volgende die de lijst aanvult leest hem niet, want hij
   voegt iets toe en verwijdert niets.

   DE REGEL DIE ERUIT VOLGT: een route die zelf al weet dat ze het al gedaan
   heeft, krijgt hier niets. Deze laag is er voor routes die dat niet weten.

   1. /api/office/bank/nood en /api/office/bank/herstel -- DE ERNSTIGSTE.
      Allebei dragen ze een lijf dat leeg mag zijn (bij `nood` is de reden
      optioneel, bij `herstel` staat er niets in). Twee keer drukken geeft dus
      dezelfde vingerafdruk, en de tweede druk werd opgeslikt MET het antwoord
      van de eerste -- dus met "ok". Een tweede noodstop zet de bank niet stil;
      een tweede herstel haalt hem er niet uit. In test/bank.test.js bleef de
      bank daardoor in nood staan, en dat werd pas drie toetsen verderop
      zichtbaar doordat de foundation-afdracht via de kaart liep in plaats van
      het eigen grootboek. Op een echte bank is dat een stand die niemand
      terugdraait. Dezelfde redenering staat in ./idemsleutels-kaleronde-b.js bij
      /api/supplier/security ("een laag die de tweede opslikt, kan iemand in nood
      stil laten staan") -- daar was hij toegepast en hier niet.

   2. /api/office/bank/mislukking. Drie mislukte clearings melden gaat met een
      leeg lijf, dus de teller kwam op 1 in plaats van 3 en de bank sloeg NIET
      automatisch in nood. De route ontdubbelt bovendien al zelf, en beter:
      kern.bankClearingMislukt() krijgt de sleutel van de mislukte CLEARING mee,
      en dat is het ding dat werkelijk een keer telt.

   3. /api/bedrijf/lid/aanmeld. Ik gaf hem een regel op naam + functie +
      afdeling, en daarmee was de aanname dat twee mensen met dezelfde naam in
      dezelfde werkruimte dezelfde mens zijn. Dat zijn ze niet -- de tweede Pia
      werd niet aangemeld en kreeg het lidmaatschap van de eerste terug. In
      test/werkgrens.test.js viel daardoor precies de toets om die er is om te
      bewijzen dat het huis bij twee naamgenoten GEEN id gokt: er was maar een
      Pia, dus er viel niets te gokken. Wie zich aanmeldt, meldt zich aan; de
      werkruimte laat hem daarna wel of niet toe.

   4. /api/member/spel/sudoku-nieuw. Mijn aantekening erbij luidde "overschrijft
      het lopende potje", en dat is precies de reden dat hij hier NIET hoort: wie
      twee keer op "nieuwe puzzel" drukt, wil een nieuwe puzzel. Met de regel
      erop kreeg hij de vorige terug -- de toets die bewijst dat je geen voorraad
      puzzels kunt aanleggen, kon zo niet eens meer zakken.

   5. /api/supplier/horeca/folio/nacht. De nachtrun houdt per folio bij welke
      nachten geboekt zijn en meldt eerlijk `geboekt: 0, overgeslagen: 1`. Met
      een regel erboven kreeg de tweede oproep `geboekt: 1` terug: er werd niets
      dubbel geboekt, maar het ANTWOORD loog over wat er gebeurd was -- en dat
      vindt een hotel pas terug op de rekening van de gast.
   ========================================================================== */
'use strict';

const NOOIT = {
  'POST /api/office/bank/nood':
    'een noodknop met een optionele reden: twee keer drukken is twee keer menen',
  'POST /api/office/bank/herstel':
    'een herstelknop met een leeg lijf: een opgeslikte tweede druk laat de bank in nood staan en zegt "ok"',
  'POST /api/office/bank/mislukking':
    'een leeg lijf per melding, en de route telt zelf op de sleutel van de mislukte clearing',
  'POST /api/bedrijf/lid/aanmeld':
    'twee mensen met dezelfde naam in dezelfde werkruimte zijn twee mensen; de tweede kreeg het ' +
    'lidmaatschap van de eerste terug',
  'POST /api/member/spel/sudoku-nieuw':
    'wie twee keer op "nieuwe puzzel" drukt, wil een nieuwe puzzel',
  'POST /api/supplier/horeca/folio/nacht':
    'de nachtrun weet zelf welke nachten al geboekt zijn en zegt dat ook -- een cache maakt van dat antwoord een leugen'
};

/* DE KEURING VAN DE VERKLARINGEN, alle drie bij elkaar.

   Draait vanuit ./idemsleutels.js NA het samenvoegen, want een regel in een
   zijbestand telt net zo hard als een in het hoofdbestand. Ze stonden eerst op
   drie plekken; drie keuringen die om beurten iets over dezelfde lijst zeggen,
   horen op een plek te staan, anders draait de volgende maar over de helft --
   en dat is hier al een keer gebeurd (zie de kop van ./idemsleutels.js over de
   lus die voor het samenvoegen stond). */
module.exports = function keurVerklaringen(SLEUTELS) {
  // 1. Geen route in twee zijbestanden -- die tweede wint stil.
  require('./idemsleutels-eenmaal')();

  // 2. Een verklaring die niets verklaart, is een ontsnapping.
  for (const [sleutel, v] of Object.entries(SLEUTELS)) {
    if (v.nietIdempotent && !v.waarom)
      throw new Error('idemsleutels: "' + sleutel + '" is nietIdempotent zonder waarom');
    if (v.velden && (!Array.isArray(v.velden) || !v.velden.length))
      throw new Error('idemsleutels: "' + sleutel + '" heeft een lege veldenlijst');
    if (!v.nietIdempotent && !v.zelfdeVerzoek && !v.velden && !v.leest)
      throw new Error('idemsleutels: "' + sleutel + '" verklaart niets');
  }

  // 3. En de vier hierboven, die hier nooit iets mogen hebben.
  for (const route of Object.keys(NOOIT)) {
    if (Object.prototype.hasOwnProperty.call(SLEUTELS, route)) {
      throw new Error('idemsleutels: "' + route + '" mag hier geen duplicaatregel hebben -- ' +
        NOOIT[route] + '. Zie de kop van lib/idemsleutels-nooit.js voor wat het de vorige keer kostte.');
    }
  }
};
module.exports.NOOIT = NOOIT;
