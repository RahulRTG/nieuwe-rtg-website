/* RTF Living Lab, het deel van het kader dat over MENSEN gaat: wie welke rol
   heeft, hoe hard een uitspraak mag zijn, en wat er af moet zijn voordat een
   studie deelnemers mag werven.

   Waarom deze vier tabellen los staan van ./kader.js: daar staat wat een
   onderzoek IS -- de cyclus, de soorten, de methoden, de uitgangen. Hier staat
   wat een onderzoek MAG, en dat is een andere vraag met andere lezers. De
   ethische toets, de bewijsrekenkunde en de rollenpoort lezen alleen dit
   bestand; wie wil nakijken of een studie met kinderen echt twee
   handtekeningen nodig heeft, hoeft de methodiekbibliotheek niet door.

   ./kader.js geeft alles hieronder ook door, zodat de rest van de map een
   ingang houdt. Deze splitsing is een leesbaarheidsgrens, geen nieuwe muur. */
'use strict';

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

/* Onderwerpen die de risicoklasse omhoog duwen. Bewust GEEN filter dat een
   studie weigert: dit onderzoek moet juist kunnen, maar dan met de waarborgen
   die erbij horen. ./ethiek.js gebruikt deze lijst als bodem, nooit als plafond
   -- wie zelf hoger inschat, houdt hoger. */
const GEVOELIG = ['kind', 'kinderen', 'jeugd', 'minderjarig', 'leerling', 'depress', 'suicide', 'zelfmoord',
  'mentale gezondheid', 'psych', 'verslaving', 'schuld', 'armoede', 'dakloos', 'vluchteling', 'asiel',
  'mishandel', 'huiselijk geweld', 'dementie', 'gehandicapt', 'beperking', 'medisch', 'ziekte'];

module.exports = { ROLLEN, BEWIJS, RISICO, GEVOELIG };
