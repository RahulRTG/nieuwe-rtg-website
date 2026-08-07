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
   waar de rest van de map naar wijst. */
'use strict';

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

/* ---------- de rollen ----------
   Bewoners zijn medeonderzoeker, geen respondent. Wat een rol MAG staat hier
   als rechtenlijst; ./mensen.js is de enige die hem leest.
     lezen        het dossier van de studie inzien
     bijdragen    observaties, notities en taken toevoegen
     leiden       de cyclus verzetten, plan en team wijzigen
     tekenen      de ethische toets of het besluit ondertekenen
     toezicht     stopcriteria hanteren en een studie stilleggen */
const ROLLEN = [
  { rol: 'buurtonderzoeker', naam: 'Buurtonderzoeker', rechten: ['lezen', 'bijdragen'] },
  { rol: 'ervaringsdeskundige', naam: 'Ervaringsdeskundige', rechten: ['lezen', 'bijdragen'] },
  { rol: 'onderzoeker', naam: 'Onderzoeker', rechten: ['lezen', 'bijdragen'] },
  { rol: 'professional', naam: 'Professional', rechten: ['lezen', 'bijdragen', 'tekenen'] },
  { rol: 'projectleider', naam: 'Projectleider', rechten: ['lezen', 'bijdragen', 'leiden'] },
  { rol: 'reviewer', naam: 'Onafhankelijk reviewer', rechten: ['lezen', 'tekenen'] },
  { rol: 'toezichthouder', naam: 'Ethisch toezichthouder', rechten: ['lezen', 'tekenen', 'toezicht'] }
];

/* ---------- de bewijsgraden ----------
   Oplopend. `rang` is waar de rekenkunde op draait; `mens` betekent dat deze
   graad alleen door een MENS aan een conclusie gehangen mag worden. Dat is de
   kern van punt 7: het systeem mag een indicatie zelf afleiden, maar "sterk
   bewijs" en "bewezen" zijn een oordeel en geen berekening. */
const BEWIJS = [
  { graad: 'aanname', rang: 0, naam: 'Aanname', mens: false, uitleg: 'Wat we denken, nog zonder waarneming.' },
  { graad: 'waarneming', rang: 1, naam: 'Waarneming', mens: false, uitleg: 'Eén of enkele keren gezien; nog geen patroon.' },
  { graad: 'indicatie', rang: 2, naam: 'Indicatie', mens: false, uitleg: 'Een patroon dat een richting aangeeft.' },
  { graad: 'sterk', rang: 3, naam: 'Sterk bewijs', mens: true, uitleg: 'Meerdere bronnen wijzen dezelfde kant op.' },
  { graad: 'bewezen', rang: 4, naam: 'Bewezen binnen deze studie', mens: true, uitleg: 'Aangetoond hier, in deze opzet, met deze mensen. Niet daarbuiten.' }
];

/* ---------- de risicoklassen ----------
   Een prullenbaktest heeft weinig nodig; onderzoek rond kinderen, mentale
   gezondheid, schulden of kwetsbare groepen veel. Per klasse staat hier wat er
   AF moet zijn voor de studie deelnemers mag werven:
     review      een ethische review met een menselijke handtekening
     privacy     een uitgevoerde privacytoets
     ouderlijk   ouderlijke toestemming bij minderjarigen
     gescheiden  onderzoeksdata strikt los van gewone Foundation-profielen
     tekenaars   hoeveel VERSCHILLENDE mensen de review moeten tekenen */
const RISICO = [
  { klasse: 'laag', rang: 0, naam: 'Laag', review: false, privacy: false, ouderlijk: false, gescheiden: false, tekenaars: 0,
    uitleg: 'Geen persoonsgegevens, geen kwetsbare groepen. Denk aan een prullenbak of een sensor.' },
  { klasse: 'midden', rang: 1, naam: 'Midden', review: true, privacy: true, ouderlijk: false, gescheiden: false, tekenaars: 1,
    uitleg: 'Volwassen deelnemers, gewone persoonsgegevens.' },
  { klasse: 'hoog', rang: 2, naam: 'Hoog', review: true, privacy: true, ouderlijk: true, gescheiden: true, tekenaars: 2,
    uitleg: 'Kinderen, mentale gezondheid, schulden, of andere kwetsbaarheid.' },
  { klasse: 'zeerhoog', rang: 3, naam: 'Zeer hoog', review: true, privacy: true, ouderlijk: true, gescheiden: true, tekenaars: 2,
    uitleg: 'Meerdere kwetsbaarheden tegelijk, of een ingreep die schade kan doen.' }
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

/* Onderwerpen die de risicoklasse omhoog duwen. Bewust GEEN filter dat een
   studie weigert: dit onderzoek moet juist kunnen, maar dan met de waarborgen
   die erbij horen. ./ethiek.js gebruikt deze lijst als bodem, nooit als plafond
   -- wie zelf hoger inschat, houdt hoger. */
const GEVOELIG = ['kind', 'kinderen', 'jeugd', 'minderjarig', 'leerling', 'depress', 'suicide', 'zelfmoord',
  'mentale gezondheid', 'psych', 'verslaving', 'schuld', 'armoede', 'dakloos', 'vluchteling', 'asiel',
  'mishandel', 'huiselijk geweld', 'dementie', 'gehandicapt', 'beperking', 'medisch', 'ziekte'];

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
