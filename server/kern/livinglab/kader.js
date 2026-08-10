/* RTF Living Lab, deel "kader": DE tabellen. De onderzoekscyclus, de
   projectsoorten, de methodiekbibliotheek, de rollen, de bewijsgraden en de
   risicoklassen staan hier EEN keer.

   Waarom dit een eigen bestand is, en waarom er verder nergens zo'n lijst mag
   staan: regel 4 van de lat. Zodra de cyclus ook in het scherm staat, of de
   risicoklassen ook in de AI-prompt, lopen ze uiteen -- en dan blokkeert de
   server een stap die het scherm aanbiedt, of belooft de AI een waarborg die de
   code niet kent. Het scherm HAALT dit kader op (/api/lab2/kader), de AI krijgt
   het in zijn opdracht mee, en de poorten rekenen ermee. Een lijst, drie lezers.

   Dit bestand bevat daarom geen logica en geen opslag: alleen de vaste vormen
   waar de rest van de map naar wijst. "Hier" is sindsdien twee bestanden -- zie
   hieronder -- maar nog steeds een ingang. */
'use strict';

/* De vier tabellen die over MENSEN gaan -- rollen, bewijsgraden, risicoklassen
   en de gevoelige onderwerpen -- staan in ./kader-mensen.js. Ze horen bij
   hetzelfde kader en gaan hieronder gewoon mee naar buiten; ze staan alleen in
   een eigen bestand omdat "wat is een onderzoek" en "wat mag een onderzoek"
   twee vragen zijn met twee lezers. */
const { ROLLEN, BEWIJS, RISICO, GEVOELIG } = require('./kader-mensen');

/* ---------- de onderzoekscyclus ----------
   Elk onderzoek doorloopt deze keten, in deze volgorde, zonder overslaan. De
   `poort` bij een stap is wat er af moet zijn VOORDAT je hem in mag; die
   voorwaarden worden afgedwongen in ./cyclus.js, niet hier. Hier staat alleen
   welke stap wat heet, zodat scherm, server en coach hetzelfde bedoelen. */
const CYCLUS = [
  { stap: 'vraagstuk', naam: 'Vraagstuk', uitleg: 'Wat speelt er werkelijk? Een vraag die je fout kunt hebben.' },
  { stap: 'hypothese', naam: 'Hypothese', uitleg: 'Wat verwachten we, en wat zou het tegendeel bewijzen?' },
  { stap: 'plan', naam: 'Onderzoeksplan', uitleg: 'Welke methoden, welke steekproef, welke meetmomenten.' },
  { stap: 'deelnemers', naam: 'Deelnemers', uitleg: 'Wie doet mee, met welke rol, en met welke toestemming.' },
  { stap: 'experiment', naam: 'Experiment', uitleg: 'Uitvoeren volgens plan, met de stopcriteria erbij.' },
  { stap: 'observaties', naam: 'Observaties & data', uitleg: 'Verzamelen wat er werkelijk gebeurt, ruw en compleet.' },
  { stap: 'reflectie', naam: 'Reflectie', uitleg: 'Wat viel tegen, wat ging mis, wat hadden we niet verwacht?' },
  { stap: 'resultaten', naam: 'Resultaten', uitleg: 'Conclusies, elk met de bewijsgraad die het bewijs toelaat.' },
  { stap: 'besluit', naam: 'Besluit', uitleg: 'Doorzetten, opschalen of bewust stoppen. Stoppen is ook een uitkomst.' },
  { stap: 'vervolg', naam: 'Vervolg', uitleg: 'Naar een pilot, werkorder, beleidsvoorstel of nieuw onderzoek.' }
];
const STAPPEN = CYCLUS.map(c => c.stap);

/* ---------- de projectsoorten ----------
   Bewust veel breder dan techniek. `menselijk: true` betekent dat het onderwerp
   over mensen zelf gaat (welzijn, gedrag, samenleven, leren) en dat een
   professionele MENSELIJKE beoordeling daar zwaarder weegt dan bij een sensor:
   ./ethiek.js tilt de risicoklasse van zo'n studie omhoog en ./bewijs.js laat
   de AI er geen conclusie boven "indicatie" tekenen. Een buurttuin tegen
   eenzaamheid krijgt daarmee dezelfde professionele ondersteuning als een
   regenmeter, maar niet dezelfde vrijheid. */
const SOORTEN = [
  { soort: 'software', naam: 'Software', icon: 'paneel', menselijk: false },
  { soort: 'hardware', naam: 'Hardware', icon: 'gear', menselijk: false },
  { soort: 'leefomgeving', naam: 'Leefomgeving', icon: 'wonen', menselijk: false },
  { soort: 'onderwijs', naam: 'Onderwijs', icon: 'diploma', menselijk: true },
  { soort: 'werk', naam: 'Werk', icon: 'werk', menselijk: true },
  { soort: 'welzijn', naam: 'Welzijn', icon: 'zorg', menselijk: true },
  { soort: 'cohesie', naam: 'Sociale cohesie', icon: 'vrienden', menselijk: true },
  { soort: 'gedrag', naam: 'Gedrag', icon: 'pulse', menselijk: true },
  { soort: 'kunst', naam: 'Kunst & cultuur', icon: 'theater', menselijk: false },
  { soort: 'mobiliteit', naam: 'Mobiliteit', icon: 'auto', menselijk: false },
  { soort: 'duurzaam', naam: 'Duurzaamheid', icon: 'oogst', menselijk: false },
  { soort: 'economie', naam: 'Lokale economie', icon: 'rekening', menselijk: false }
];

/* ---------- de methodiekbibliotheek ----------
   Per methode wat het systeem daarna moet weten om te kunnen helpen:
     aard          kwalitatief / kwantitatief / gemengd
     minN          de kleinste steekproef waarbij deze methode iets zegt
     meetmomenten  hoe vaak er gemeten moet worden (1 = eenmalig meten mag)
     maxBewijs     de HOOGSTE bewijsgraad die deze methode alleen kan dragen
     mensen        raakt de methode mensen rechtstreeks (toestemming nodig)
   `maxBewijs` is het scherpste stuk: acht interviews zijn waardevol, maar ze
   kunnen nooit "bewezen" dragen -- daar is een vergelijkende opzet voor nodig.
   ./bewijs.js rekent daarmee, zodat een mooi verhaal geen feit wordt. */
const METHODEN = [
  { methode: 'enquete', naam: 'Enquête', aard: 'kwantitatief', minN: 30, meetmomenten: 1, maxBewijs: 'indicatie', mensen: true },
  { methode: 'interview', naam: 'Interview', aard: 'kwalitatief', minN: 5, meetmomenten: 1, maxBewijs: 'waarneming', mensen: true },
  { methode: 'focusgroep', naam: 'Focusgroep', aard: 'kwalitatief', minN: 5, meetmomenten: 1, maxBewijs: 'waarneming', mensen: true },
  { methode: 'observatie', naam: 'Observatie', aard: 'kwalitatief', minN: 3, meetmomenten: 3, maxBewijs: 'waarneming', mensen: true },
  { methode: 'cocreatie', naam: 'Co-creatie', aard: 'kwalitatief', minN: 4, meetmomenten: 2, maxBewijs: 'aanname', mensen: true },
  { methode: 'abtest', naam: 'A/B-test', aard: 'kwantitatief', minN: 40, meetmomenten: 2, maxBewijs: 'bewezen', mensen: true },
  { methode: 'veldexperiment', naam: 'Veldexperiment', aard: 'gemengd', minN: 20, meetmomenten: 3, maxBewijs: 'bewezen', mensen: true },
  { methode: 'prototype', naam: 'Prototype', aard: 'gemengd', minN: 1, meetmomenten: 2, maxBewijs: 'indicatie', mensen: false },
  { methode: 'dagboek', naam: 'Dagboekstudie', aard: 'kwalitatief', minN: 8, meetmomenten: 7, maxBewijs: 'indicatie', mensen: true },
  { methode: 'workshop', naam: 'Workshop', aard: 'kwalitatief', minN: 6, meetmomenten: 1, maxBewijs: 'aanname', mensen: true },
  { methode: 'gebruikerstest', naam: 'Gebruikerstest', aard: 'gemengd', minN: 5, meetmomenten: 1, maxBewijs: 'indicatie', mensen: true },
  { methode: 'literatuur', naam: 'Literatuuronderzoek', aard: 'kwalitatief', minN: 1, meetmomenten: 1, maxBewijs: 'indicatie', mensen: false }
];

/* ---------- wat een studie kan worden ----------
   Punt 10: een resultaat eindigt niet als PDF. Dit zijn de uitgangen. */
const UITGANGEN = [
  { uitgang: 'pilot', naam: 'Pilotvoorstel', icon: 'ontdek' },
  { uitgang: 'werkorder', naam: 'Werkorder', icon: 'bouw' },
  { uitgang: 'subsidie', naam: 'Subsidieaanvraag', icon: 'rekening' },
  { uitgang: 'beleid', naam: 'Beleidsvoorstel', icon: 'juridisch' },
  { uitgang: 'startup', naam: 'Startupconcept', icon: 'vonk' },
  { uitgang: 'onderwijs', naam: 'Onderwijsproject', icon: 'diploma' },
  { uitgang: 'onderzoek', naam: 'Nieuw onderzoek', icon: 'agenda' }
];

const bij = (lijst, sleutel, waarde) => lijst.find(x => x[sleutel] === waarde) || null;
const soort = s => bij(SOORTEN, 'soort', s);
const methode = m => bij(METHODEN, 'methode', m);
const rol = r => bij(ROLLEN, 'rol', r);
const graad = g => bij(BEWIJS, 'graad', g);
const klasse = k => bij(RISICO, 'klasse', k);
const uitgang = u => bij(UITGANGEN, 'uitgang', u);
const rechtHeeft = (r, recht) => { const x = rol(r); return !!x && x.rechten.includes(recht); };

module.exports = { CYCLUS, STAPPEN, SOORTEN, METHODEN, ROLLEN, BEWIJS, RISICO, UITGANGEN, GEVOELIG,
  soort, methode, rol, graad, klasse, uitgang, rechtHeeft };
