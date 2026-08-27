/* ============================================================================
   DE TABELLEN VAN EEN KOOPBAAR -- wat elk type belooft, hoe een bedrag wordt
   gelezen, en welke redenen een ondernemer te zien krijgt.

   Pure data en twee pure functies. De vertaling die ze gebruikt staat in
   ./koopbaar.js; dezelfde tweedeling als ./werkwoordlijst.js naast
   ./werkwoorden.js, en om dezelfde reden: een tabel die je zonder de motor kunt
   lezen, is een tabel die een toets kan voeren met wat hij zelf verzint.
   ========================================================================== */
'use strict';

const { TYPEN } = require('../mall/aanbodvorm');

/* Wat het type belooft. Gelezen als: dit is wat de cta van aanbodvorm.js
   aankondigt, niet wat een bepaalde zaak heeft ingericht.

   Drie typen beloven met opzet WEINIG:
     marktplaats  "Bekijken" -- kern/markt regelt de deal tussen twee mensen
                  zelf, met een eigen chat en een eigen bewijs. Er komt hier geen
                  tweede weg naar dezelfde handel.
     offerte      "Offerte aanvragen" -- er is per definitie nog geen bedrag.
     abonnement   "Aanmelden" -- een doorlopende afschrijving is een bevoegdheid
                  en geen vermogen; zie NIET_GEBOUWD.abonnement in ./werkwoorden.js.
                  Tot die er is, blijft het bij tonen en een prijs noemen. */
const TYPE_WERKWOORDEN = {
  product: ['prijs', 'beschikbaarheid', 'bevestig', 'lever', 'annuleer', 'retour'],
  dienst: ['prijs', 'beschikbaarheid', 'reserveer', 'bevestig', 'annuleer'],
  boeking: ['beschikbaarheid', 'reserveer', 'bevestig', 'annuleer'],
  huur: ['prijs', 'beschikbaarheid', 'reserveer', 'bevestig', 'annuleer'],
  ticket: ['prijs', 'beschikbaarheid', 'bevestig', 'lever'],
  reis: ['prijs', 'bevestig'],
  verblijf: ['prijs', 'beschikbaarheid', 'reserveer', 'bevestig', 'annuleer'],
  eten: ['prijs', 'beschikbaarheid', 'bevestig', 'lever'],
  vervoer: ['prijs', 'beschikbaarheid', 'bevestig', 'annuleer'],
  marktplaats: [],
  abonnement: ['prijs'],
  offerte: []
};

/* ----------------------------------------------------------------------------
   HET BEDRAG, EN DE TWEE FOUTEN DIE HIER ZATEN.

   De vorm staat vast in kern/mall/aanbod.js, regel 118:

     const prijs = (bedrag, eenheid, vanaf) =>
       ({ bedrag: getal(bedrag), eenheid, valuta: 'EUR', vanaf: !!vanaf })

   Twee dingen daarin zijn precies andersom gelezen toen deze laag werd gebouwd,
   en allebei kwamen ze pas boven toen er echte seed-data doorheen ging:

   1. `bedrag` IS IN EURO'S, niet in centen. Een reis van 2200 euro werd 2200
      centen, en er stond 22,00 euro op het scherm. Honderd keer te weinig, en
      niets aan de uitkomst zag er kapot uit -- dat is het gevaarlijke soort.
      kern/mall/bestellingen.js deelt om dezelfde reden door 100.

   2. `vanaf` IS EEN VLAG EN GEEN BEDRAG. Hij zat in de lijst kandidaat-bedragen,
      dus `Number(true)` gaf 1 cent.

   EN DAN DE INHOUDELIJKE: EEN VANAF-PRIJS IS GEEN AFREKENBEDRAG. "Vanaf 2200
   euro per persoon" is een indicatie voor een reis waarvan de prijs van de datum
   afhangt; wie daarop afrekent, incasseert een bedrag dat niemand heeft
   afgesproken. Van de 92 koopbaren met een prijs in de seed dragen er 12 zo'n
   indicatie (reis, verblijf, eten). Die mogen wel getoond worden -- de koper wil
   weten waar het ongeveer begint -- maar ze leveren geen `prijs`-werkwoord op, en
   dus bij een type dat "Kopen" belooft ook geen koopknop. Het echte bedrag hoort
   uit het domein zelf te komen (een menugerecht, een artikel, een datum), en dat
   is precies wat COMMERCE.md par. 6 "een stap weg" noemt. */
const vastBedragCenten = (p) => {
  if (!p || p.vanaf) return null;            // een indicatie is geen bedrag
  const euro = Number(p.bedrag);
  return Number.isFinite(euro) ? Math.round(euro * 100) : null;
};
/* Nul is gratis, null is onbekend -- dat onderscheid blijft. Een bedrag van nul
   houdt dus WEL het werkwoord `prijs`. */
const heeftBedrag = (p) => vastBedragCenten(p) != null;

/* Waarom een belofte het niet haalt, in een zin die een ondernemer kan lezen en
   waarop hij kan handelen. Geen "niet beschikbaar" -- dat zegt niets over wat
   hij moet doen. */
const REDEN = {
  prijs: 'Deze rij draagt geen bedrag. Zet een prijs op het artikel; zonder bedrag valt er niets te kopen.',
  prijsVanaf: 'Dit is een vanaf-prijs en geen afrekenbedrag. Wie hierop afrekent, incasseert iets wat niemand heeft afgesproken; het echte bedrag hoort uit het domein zelf te komen.',
  bevestig: 'Dit type belooft "Kopen", en kopen zonder bedrag bestaat niet. Zet een prijs, dan komt de koopknop terug.',
  beschikbaarheid: 'Er is niets gemeten: geen voorraad, geen tijdslot en geen open/dicht. Stilte is geen beschikbaarheid.',
  lever: 'Deze aanbieder heeft geen bezorging of afhaal ingericht, en dit type wordt niet digitaal uitgegeven.'
};

/* De typen die zonder bezorgschakelaar toch geleverd worden, omdat de levering
   digitaal of ter plekke is. Een ticket komt in de app, eten komt aan tafel. */
const LEVERT_ZELF = new Set(['ticket', 'eten']);


module.exports = { TYPE_WERKWOORDEN, REDEN, LEVERT_ZELF, vastBedragCenten, heeftBedrag, TYPEN };
