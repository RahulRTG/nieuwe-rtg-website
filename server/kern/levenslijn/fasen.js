/* Levenslijn, deelbestand "fasen": EEN lijn door een leven (LEVEN.md par. 1.1).

   DE BELANGRIJKSTE BOUWREGEL VAN DIT HELE BESTAND, en hij staat hier omdat de
   volgende die dit leest anders vanzelf een voortgangsbalk bouwt:

     DEZE LIJST IS GEEN VOLGORDE DIE AF MOET. Er bestaat geen "achterlopen".
     Wie geen studie, geen kinderen, geen eigen zaak of geen pensioen heeft,
     MIST NIETS. Een fase waarvoor geen aanwijzing bestaat krijgt staat 'nvt'
     en het scherm laat hem WEG -- hij staat er niet grijs bij als een gemiste
     stap, want grijs is precies hoe een norm eruitziet.

   De array-volgorde hieronder is leesvolgorde voor het scherm en verder
   niets: er wordt nergens op geteld, er wordt geen percentage van gemaakt en
   een fase verderop is geen fase "hoger". Zou hier ooit een teller op komen,
   dan is dat het moment waarop deze laag een rangschikking wordt, en dat is
   precies wat LEVEN.md par. 2.4 verbiedt.

   TWEE FASEN ZONDER BRON, MET OPZET. 'opvang' en 'pensioen' hebben in dit
   huis vandaag geen enkele aanwijzing: er is geen opvang-inschrijving en geen
   pensioendossier dat aan een lid hangt. Ze staan hier wel, en ze komen er
   dus altijd als 'nvt' uit. Dat is geen gat maar het antwoord: een verzonnen
   levensfase is erger dan een ontbrekende, want hij suggereert een norm.
   Komt er ooit een echte bron (een inschrijving die de mens zelf deed), dan
   hangt hij aan deze fase en niet aan een leeftijd.

   Gemount via ./index.js. */
'use strict';

/* De vijf RTF-groepen per fase (mini/kind/tiener/jong/volw, uit
   foundation/gezinshulp.js). LET OP WAT DIT WEL EN NIET IS.

   WEL: een LENS. "Laat me de lijn zien zoals een tiener hem ziet." De vijf
   groepen zijn sinds LEVEN.md par. 1.1 een weergavefilter op deze lijn en
   niet langer de indeling zelf.

   NIET: een uitspraak dat een fase bij een leeftijd HOORT, en al helemaal
   geen poort. `lijn()` filtert hier zelf niets mee weg -- hij geeft altijd
   alle fasen terug, met hun staat, en de lens is een keuze van de mens aan de
   andere kant. Een filter dat aan de serverkant al zou snijden, zou de
   verzameling mogelijkheden VERKLEINEN, en dat is de ene beweging die par.
   2.2 verbiedt. Wie hier ooit `.filter(f => f.groepen.includes(...))` in
   index.js zet, bouwt een poort. */
const FASEN = [
  { id: 'geboorte', naam: 'Geboorte', groepen: ['mini'],
    toelichting: 'Waar de lijn begint. Het jaar komt uit het paspoort dat u zelf heeft laten verifieren.' },
  { id: 'opvang', naam: 'Opvang', groepen: ['mini'],
    toelichting: 'De eerste jaren buitenshuis. RTG heeft hier vandaag geen gegevens over; er staat dus niets.' },
  { id: 'basisschool', naam: 'Basisschool', groepen: ['kind'],
    toelichting: 'Groep 1 tot en met 8, zoals ze in uw leerpaspoort staan.' },
  { id: 'middelbaar', naam: 'Middelbare school', groepen: ['tiener'],
    toelichting: 'Vmbo, havo of vwo. Een overstap tussen richtingen is een gewone stap, geen breuk.' },
  { id: 'studie', naam: 'Studie', groepen: ['tiener', 'jong', 'volw'],
    toelichting: 'Mbo, hbo of universiteit. Een leven zonder studie is een compleet leven; deze fase blijft dan leeg.' },
  { id: 'werk', naam: 'Eerste werk', groepen: ['jong', 'volw'],
    toelichting: 'Werk dat RTG heeft gezien: een personeelsrol of een werkruimte die u zelf aan uw account koppelde.' },
  { id: 'relatie', naam: 'Relatie', groepen: ['jong', 'volw'],
    toelichting: 'Alleen wat u zelf in uw Entourage heeft gezet. RTG leidt hier niets uit af.' },
  { id: 'kinderen', naam: 'Kinderen', groepen: ['volw'],
    toelichting: 'Geteld, nooit uitgeschreven: wie in uw Entourage staat blijft van u, en hun namen staan hier niet.' },
  { id: 'zaak', naam: 'Eigen zaak', groepen: ['jong', 'volw'],
    toelichting: 'Een zaak waarvan u de bedrijfsinlog een keer heeft bewezen.' },
  { id: 'pensioen', naam: 'Pensioen', groepen: ['volw'],
    toelichting: 'RTG heeft hier vandaag geen gegevens over. Er wordt niets aan uw leeftijd afgelezen.' }
];

const PER_ID = new Map(FASEN.map(f => [f.id, f]));

/* De rang bij het samenvoegen van aanwijzingen uit verschillende bronnen.
   Lager wint. 'nu' verslaat alles: wie nog in een fase zit, zit erin, ook al
   is er ook een aanwijzing dat er eerder iets in die fase is afgerond (een
   hbo-bachelor VOOR een hbo-master; allebei 'studie').

   'nvt' staat hier als hoogste en niet buiten de trap, zodat een fase zonder
   enkele aanwijzing langs dezelfde weg zijn staat krijgt als de rest. Een
   apart pad voor "niets gevonden" is precies waar per ongeluk een 'komt' uit
   komt rollen. */
const RANG = { nu: 0, komt: 1, geweest: 2, nvt: 3 };

module.exports = { FASEN, PER_ID, RANG };
