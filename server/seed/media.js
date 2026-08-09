/* Startdata, deel "media": vijf uitgegeven stukken in het Klankwerk, zodat de
   Media OS en De Zaal op een demo-installatie niet leeg staan.

   WAAROM DIT MAG, EN WAAROM ALLEEN DIT. Van de vier mediavormen is muziek de
   enige die dit huis ZELF opwekt: een uitgave is geen audiobestand maar een
   rij getallen die het toestel van de luisteraar uitrekent, met de motor van
   het Klankwerk (public/apps/klankwerk/motor.js). Er zit dus geen licentie van
   iemand anders in, precies zoals kern/clips-studio.js dat al vaststelde toen
   eigen muziek onder een eigen clip mocht.

   De andere drie worden NIET geseed, en dat is een besluit en geen omissie:

   - een video vraagt echte bytes, en die zouden we moeten verzinnen;
   - een clip staat per definitie op het TOESTEL van zijn maker. Een geseede
     clip zou eeuwig "maker offline" zijn: een kaart die nooit iets afspeelt;
   - live vraagt een mens die nu uitzendt.

   Een lege stand die eerlijk zegt waarom hij leeg is, is beter dan een stand
   vol kaarten die niet werken. Wat die standen dan wél tonen staat in
   kern/mediaos/index.js.

   DE STUKKEN ZELF komen uit dezelfde tabellen als het voorstel van Rahul in de
   studio (kern/muziek-stijlen.js, functie bouw()). Met een vast zaad, dus elke
   installatie krijgt exact dezelfde vijf stukken -- geen ruis in toetsen, en
   twee mensen die erover praten horen hetzelfde.

   ONDER WIENS NAAM. Onder de codenaam van de drie demo-leden, nooit onder de
   RTG-naam: die zet alleen een mens bij het kantoor eronder (CLAUDE.md, en
   kern/muziek-uitgave.js bewaakt het). `makers` blijft daarom leeg -- dan
   toont de zaal de LEVENDE codenaam van de eigenaar (codenaamVan) in plaats
   van een naam die hier nog eens apart zou staan en uiteen kan lopen. */
const { leesVraag, bouw, STIJLEN } = require('../kern/muziek-stijlen');

/* Vijf stukken, elk met de vraag waaruit ze zijn ontstaan. Die vraag staat er
   met opzet bij: hij is de toelichting die de maker in de zaal zou schrijven,
   en tegelijk het recept waarmee je ze opnieuw krijgt. */
const STUKKEN = [
  { sleutel: 'rtg', naam: 'Avondlicht', vraag: 'rustige lounge avond aan zee',
    maten: 8, zaad: 1907, at: '2026-07-02T20:10:00.000Z',
    toelichting: 'Begonnen als achtergrond voor het uur voor het diner; de bas mocht blijven staan.' },
  { sleutel: 'rtg', naam: 'Kade bij nacht', vraag: 'hiphop traag zwaar',
    maten: 8, zaad: 5501, at: '2026-07-11T22:40:00.000Z',
    toelichting: 'Twee avonden aan gezeten. De hihat staat expres net naast de tel.' },
  { sleutel: 'lifestyle', naam: 'Ochtendrust', vraag: 'ambient zacht ochtend',
    maten: 8, zaad: 331, at: '2026-06-28T07:05:00.000Z',
    toelichting: 'Voor wie vroeg wakker is en nog niemand wil spreken.' },
  { sleutel: 'lifestyle', naam: 'Zonsopgang boven de baai', vraag: 'house zonsopgang',
    maten: 8, zaad: 7742, at: '2026-07-19T06:20:00.000Z',
    toelichting: 'Gemaakt op de boot terug, met de zon net boven de rand.' },
  { sleutel: 'business', naam: 'Late vergadering', vraag: 'club stevig laat',
    maten: 8, zaad: 2288, at: '2026-07-24T23:55:00.000Z',
    toelichting: 'Niets diepzinnigs: dit is wat er uitkomt als een dag te lang duurt.' }
];

function uitgaveVan(s, i) {
  const gelezen = leesVraag(s.vraag);
  const kanalen = bouw(gelezen.stijl, s.maten, gelezen.ladder, s.zaad);
  return {
    id: 'useed' + (i + 1),
    trackId: 'tseed' + (i + 1),
    key: s.sleutel,
    naam: s.naam,
    /* Het tempo van de STIJL, niet een rond getal: een lounge-stuk hoort
       trager te staan dan een clubstuk, en dat verschil hoor je meteen. */
    bpm: gelezen.bpm || (STIJLEN[gelezen.stijl] || {}).bpm || 100,
    maten: s.maten,
    kanalen,
    secties: [],
    toelichting: s.toelichting,
    // leeg: de zaal toont dan de levende codenaam van de eigenaar (zie kop)
    makers: [],
    onder: 'codenaam',
    rtgAanvraag: null,
    rtgReden: '',
    mooi: {},
    at: s.at
  };
}

module.exports = {
  // nieuwste eerst, want zo leest de zaal hem ook
  muziekUitgaven: {
    lijst: STUKKEN.map(uitgaveVan).sort((a, b) => String(b.at).localeCompare(String(a.at))),
    reacties: {}
  }
};
