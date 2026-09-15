/* ============================================================================
   DE VRAGENLIJST -- wat er gevraagd kan worden, en waar elk antwoord heen wijst.

   Apart van ./vraag.js langs dezelfde naad als ./neiging-besluiten.js:
   hierin staan BESLUITEN (welke vragen bestaan, en welk onderdeel een antwoord
   opendoet), daarin staat de REKENSOM die bepaalt welke vraag aan de beurt is.
   Een register verandert zelden en leest als beleid; een motor verandert vaak
   en leest als code.

   WAT HIER EEN BESLUIT IS EN GEEN AFLEIDING, en dat hoort er hardop bij

   De VRAGEN zelf zijn geschreven, niet afgeleid. Welke onderdelen samen "eten"
   of "mensen" heten, staat nergens in de code -- precies zoals WERELDLIJST.md
   al vaststelt over de laag tussen wereld en onderdeel: dat is een
   ontwerpbesluit. Wat WEL is afgeleid en afgedwongen is dat elke bestemming
   bestaat. De grens loopt dus tussen de indeling (mensenwerk) en de
   bestemmingen (nagetrokken), en niet ertussenin.
   ========================================================================== */
'use strict';

/* De vragen. `alsOnderwerp` maakt er een vervolgvraag van: hij komt pas in
   beeld als het lid dat onderwerp draagt. Zonder dat veld is het een
   openingsvraag. */
const VRAGEN = Object.freeze([
  { id: 'tijd', tekst: 'Waar besteed je graag tijd aan?', meerdere: true,
    opties: [
      { onderwerp: 'reizen', label: 'Reizen', wijst: ['reizen'] },
      { onderwerp: 'eten', label: 'Eten', wijst: ['table'] },
      { onderwerp: 'sport', label: 'Sport', wijst: ['sport'] },
      { onderwerp: 'mensen', label: 'Mensen zien', wijst: ['sociaal'] },
      { onderwerp: 'spelen', label: 'Spelen en kijken', wijst: ['spelen'] },
      { onderwerp: 'werk', label: 'Werk', wijst: ['werk'] },
      { onderwerp: 'geven', label: 'Iets betekenen voor anderen', wijst: ['geven'] }
    ] },

  { id: 'reisstijl', alsOnderwerp: 'reizen', tekst: 'Wat voor reizen passen bij jou?', meerdere: true,
    opties: [
      { onderwerp: 'reizen:stad', label: 'Citytrips', wijst: ['stad'] },
      { onderwerp: 'reizen:verblijf', label: 'Ergens langer blijven', wijst: ['residentie'] },
      { onderwerp: 'reizen:vliegen', label: 'Verder weg', wijst: ['vluchten'] }
    ] },

  { id: 'etenstijl', alsOnderwerp: 'eten', tekst: 'En hoe eet je het liefst?', meerdere: true,
    opties: [
      { onderwerp: 'eten:uit', label: 'Uit eten', wijst: ['uitgaan', 'foodcourt'] },
      { onderwerp: 'eten:thuis', label: 'Thuis laten komen', wijst: ['bestellen'] },
      { onderwerp: 'eten:wijn', label: 'Met een goede fles erbij', wijst: ['cellier'] }
    ] },

  { id: 'mensenstijl', alsOnderwerp: 'mensen', tekst: 'Hoe zie je mensen het liefst?', meerdere: true,
    opties: [
      { onderwerp: 'mensen:salon', label: 'In De Salon', wijst: ['salon'] },
      { onderwerp: 'mensen:scherm', label: 'Op afstand', wijst: ['videobellen'] },
      { onderwerp: 'mensen:nieuw', label: 'Nieuwe mensen ontmoeten', wijst: ['vonk'] }
    ] },

  { id: 'kijkstijl', alsOnderwerp: 'spelen', tekst: 'Waar gaat dat dan over?', meerdere: true,
    opties: [
      { onderwerp: 'spelen:muziek', label: 'Muziek', wijst: ['muziek'] },
      { onderwerp: 'spelen:film', label: 'Films en series', wijst: ['theater'] },
      { onderwerp: 'spelen:samen', label: 'Samen spelen', wijst: ['spelavond'] }
    ] },

  { id: 'werkstijl', alsOnderwerp: 'werk', tekst: 'Wat is werk voor jou?', meerdere: true,
    opties: [
      { onderwerp: 'werk:eigen', label: 'Mijn eigen zaak', wijst: ['onderneming'] },
      { onderwerp: 'werk:leren', label: 'Leren en bijblijven', wijst: ['school'] }
    ] },

  { id: 'geefstijl', alsOnderwerp: 'geven', tekst: 'Waar zou je iets willen betekenen?', meerdere: true,
    opties: [
      { onderwerp: 'geven:buurt', label: 'In mijn buurt', wijst: ['buurtruil'] },
      { onderwerp: 'geven:zorg', label: 'In de zorg', wijst: ['zorg'] },
      { onderwerp: 'geven:mensen', label: 'Voor mensen die het nodig hebben', wijst: ['vrienden'] }
    ] }
]);

module.exports = { VRAGEN };
