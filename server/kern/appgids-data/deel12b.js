/* App-gids data, deel 12b: het vervolg van deel12, opgeknipt op de 10 kB-grens
   uit het modulebeleid -- zelfde patroon als deel10b en deel6b.

   De knip zit op een entry-grens die ook inhoudelijk een grens is: dit zijn de
   twee schermen van de persoonlijke controlelaag (MIJNRTG.md). Ze stellen
   dezelfde vraag vanaf twee kanten -- wie mag iets van mij, en wie mag mij
   bereiken -- en horen daarom bij elkaar in plaats van bij de festival- en
   Living OS-schermen waar ze naast stonden. */
const G = (wat, doe, tip) => ({ wat, doe, tip });

module.exports = {
  '/apps/mijn-relaties.html': G('Wie heeft toegang tot mij: alle partijen die op dit moment iets van je mogen, per partij bij elkaar.',
    ['Zie per zaak of dienst wat zij precies mag en tot wanneer',
     'Vraag de gevolgen op voordat je een relatie sluit',
     'Sluit alles van een partij in een keer, of trek er een los in'],
    'Onderaan staat wat dit scherm NIET dekt, met de reden erbij; een overzicht dat er drie vergeet is erger dan geen overzicht.'),
  '/apps/mijn-post.html': G('Post van RTG: waarvoor je toestemming geeft om benaderd te worden, per soort en per kanaal.',
    ['Zet per soort post los aan of uit voor e-mail, sms en de app',
     'Zie wanneer je ja zei en via welk scherm dat gebeurde',
     'Zet alles in een handeling uit'],
    'Alles staat standaard UIT; afwezigheid is hier geen toestemming. Wat je hoe dan ook blijft krijgen -- beveiliging, facturen, wettelijke berichten -- staat er even groot bij en is geen schakelaar.'),
};
