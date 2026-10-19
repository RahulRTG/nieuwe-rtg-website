/* TRAVELOS -- wat is hier "hetzelfde verzoek"? Verklaringen van schermen uit
   de TravelOS-familie die de voltooiproef (scripts/lib/voltooi/) met een
   dubbeltik als dubbel werk betrapte.

   DE ROUTETEKENAAR VAN EEN OV-ZAAK (routes/ov.js, kern/ov/dienst.js). De lijst
   lezen verandert niets. Bewaren zonder `id` MAAKT een lijn, en een dubbeltik
   op "Bewaren" maakte er twee met dezelfde naam en haltes; leden zagen die lijn
   dan dubbel op de OV-kaart (./voltooi/ovroutes.js). Een echte tweede lijn
   verschilt in naam of haltes, en een wijziging of weghalen draagt het id.

   DE SUITE IN DE RESIDENCE (routes/member/residentie.js, kern/residentie/
   suite.js). Neerzetten voegt een meubel toe; een dubbeltik zette twee
   dezelfde meubels op dezelfde plek. Weghalen gaat op VOLGNUMMER (`i`), dus
   een dubbeltik haalde ook het meubel weg dat daarna op dat nummer schoof --
   erger dan dubbel, want dat tweede meubel had niemand aangewezen
   (./voltooi/residentie.js). Een woordelijk gelijk verzoek binnen het venster
   is daarom een herhaling; wie bewust twee keer hetzelfde wil, doet dat na
   het venster of op een andere plek.

   DE CHARTERAANVRAAG (routes/luchthaven.js, kern/luchthaven/royaal.js). Elke
   aanvraag wordt een regel die operations beoordeelt en waarvoor een stand of
   helipad wordt gezocht; een dubbeltik maakte er twee van dezelfde vlucht
   (./voltooi/vluchten.js). Een tweede echte aanvraag verschilt in soort,
   bestemming, datum of tijd. */
'use strict';
const SLEUTELS = {
  'POST /api/staff/ov/lijnen': { leest: true },
  'POST /api/staff/ov/lijn/zet': { zelfdeVerzoek: true },
  'POST /api/residentie/meubel/zet': { zelfdeVerzoek: true },
  'POST /api/residentie/meubel/weg': { zelfdeVerzoek: true },
  /* De eigen suite lezen verandert niets. Naam en open/dicht zetten VERVANGT
     een stand en voegt niets toe (kern/residentie/suite.js suiteZet): de
     handler is daar zelf idempotent op. Een poort die een woordelijk gelijke
     herhaling het oude antwoord geeft, zou open -> dicht -> open binnen het
     venster de derde stap laten opslokken; daarom doet de poort hier niets. */
  'POST /api/residentie/suite': { leest: true },
  'POST /api/residentie/suite/zet': { nietIdempotent: true,
    waarom: 'zet een stand (naam, open) en de handler is daar zelf idempotent op; een herhaald oud antwoord zou een wissel open/dicht binnen het venster opslokken' },
  'POST /api/member/vluchten/charter': { zelfdeVerzoek: true }
};
module.exports = { SLEUTELS };
