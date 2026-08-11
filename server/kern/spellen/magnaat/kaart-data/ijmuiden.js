/* Magnaat, kaartdata: IJmuiden. HANDMATIG, en dat staat er met opzet in het
   bestand zelf (`bron: 'handmatig'`).

   WAT DIT WEL IS: echte zones en echte straatnamen. Dat is publieke geografie
   -- de Halkade ligt aan de vissershaven, de Kennemerboulevard aan zee, het
   Sluisplein bij de sluizen -- en het is precies wat maakt dat iemand uit
   IJmuiden zijn eigen stad herkent.

   WAT DIT NIET IS: adressen. Er staat geen enkel huisnummer in, en dat is geen
   nalatigheid maar de regel: een huisnummer is een bewering over een specifiek
   pand, en die hoort uit een register te komen en niet uit een geheugen. Zolang
   `bron` op 'handmatig' staat heet een plek daarom "Halkade, kavel 7".

   HOE HIER ECHTE ADRESSEN KOMEN: `node scripts/kaart-import.js ijmuiden
   <extract.json>` overschrijft dit bestand met open data, gezeefd op
   woonfunctie, en zet `bron` op 'open-data'. Vanaf dat moment heet dezelfde
   plek "Halkade 12". De spelcode leest `bron` en hoeft verder niets te weten:
   zie ./kaart.js.

   DE ZONES dragen het karakter, en dat is waar de economie op rekent. Per zone
   staat wat er structureel waar is -- een haven heeft geen passanten maar wel
   zakelijke vraag, een boulevard heeft toerisme dat met het seizoen meebeweegt
   -- en de kavel-eigenschappen worden daaruit AFGELEID (zie ./kaart.js). Met de
   hand geschreven kavelwaarden zouden duizend losse beweringen zijn. */
module.exports = {
  stad: 'IJmuiden',
  bron: 'handmatig',
  bronTekst: 'zones en straatnamen met de hand; geen huisnummers (zie de kop)',
  /* De zones. `passanten` is een index (100 = gemiddeld voor deze stad), niet
     een aantal mensen: de simulatie rekent met verhoudingen, en een absoluut
     getal zou een precisie suggereren die er niet is. */
  zones: [
    { id: 'haven', naam: 'Vissershaven en Trawlerkade',
      straten: ['Halkade', 'Trawlerkade', 'Kompasstraat', 'Loggerstraat'],
      passanten: 45, toerisme: 55, zakelijk: 90, huur: 70, geluid: 70, parkeren: 90,
      ov: 40, centrum: 60, sectoren: ['logistiek', 'industrie', 'horeca', 'groothandel'] },
    { id: 'boulevard', naam: 'Kennemerboulevard en strand',
      straten: ['Kennemerboulevard', 'Zeeweg', 'Strandweg'],
      passanten: 130, toerisme: 165, zakelijk: 35, huur: 135, geluid: 40, parkeren: 55,
      ov: 60, centrum: 70, sectoren: ['horeca', 'hotel', 'retail', 'vrije-tijd'] },
    { id: 'centrum', naam: 'Winkelcentrum en Lange Nieuwstraat',
      straten: ['Lange Nieuwstraat', 'Kennemerlaan', 'Marktplein'],
      passanten: 155, toerisme: 60, zakelijk: 70, huur: 120, geluid: 45, parkeren: 60,
      ov: 85, centrum: 100, sectoren: ['retail', 'horeca', 'kantoor', 'publiek'] },
    { id: 'sluizen', naam: 'Sluisplein en veerhaven',
      straten: ['Sluisplein', 'Noordersluisweg', 'Dokweg'],
      passanten: 70, toerisme: 95, zakelijk: 85, huur: 85, geluid: 60, parkeren: 80,
      ov: 65, centrum: 55, sectoren: ['logistiek', 'horeca', 'hotel', 'industrie'] },
    { id: 'terrein', naam: 'Bedrijventerrein Zeehaven',
      straten: ['Zeehavenweg', 'Concordiastraat', 'Middenhavenstraat'],
      passanten: 20, toerisme: 10, zakelijk: 120, huur: 45, geluid: 85, parkeren: 100,
      ov: 30, centrum: 30, sectoren: ['industrie', 'logistiek', 'groothandel', 'kantoor'] },
    { id: 'station', naam: 'Stationsomgeving Driehuis',
      straten: ['Stationsweg', 'Driehuizerkerkweg'],
      passanten: 100, toerisme: 45, zakelijk: 75, huur: 95, geluid: 50, parkeren: 45,
      ov: 130, centrum: 65, sectoren: ['horeca', 'retail', 'kantoor', 'hotel'] }
  ],
  /* Hoeveel kavels een straat draagt. Ook dit is een verhouding en geen
     telling: een boulevard heeft minder maar grotere plekken dan een
     winkelstraat. Bij een open-data-import komt dit uit de data zelf te
     vervallen -- dan is een kavel gewoon een pand. */
  kavelsPerStraat: 8,
  /* De bevolking van deze stad, als aandelen. Samen 100. Ze bepalen wie er
     langskomt en wat die wil; het gedrag per segment staat in ../vraag.js en
     niet hier, want dat is voor elke stad hetzelfde. */
  bevolking: { gezinnen: 26, ouderen: 20, studenten: 8, toeristen: 22, zakelijk: 14, nachtpubliek: 10 },
  /* De omzet van de STAD zelf, per maand: alle bedrijvigheid die er al is en
     die geen speler in handen heeft. Hij staat hier omdat de Foundation eruit
     put (zie ../foundation.js): zou de bijdrage alleen uit de omzet van de
     spelers komen, dan bouwt de Foundation in een partij met twee spelers nooit
     iets en in een partij met zes spelers drie keer zoveel -- en dan hangt een
     sporthal af van hoeveel vrienden er meespeelden in plaats van van de stad.

     De orde van grootte hoort bij een plaats van deze omvang. Het is een
     spelgetal en geen meting, en het staat er als een getal dat je kunt
     verstellen in plaats van als een formule die doet alsof hij iets weet. */
  stadsomzet: 5800000,
  /* Het seizoen doet in een kustplaats meer dan elders: de zomer is hier het
     hele verhaal. Twaalf maandfactoren op de toeristische vraag. */
  seizoen: [0.55, 0.55, 0.7, 0.9, 1.1, 1.35, 1.65, 1.7, 1.2, 0.85, 0.6, 0.65]
};
