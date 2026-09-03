/* De eigenaarsregels van het RTG Controleregister: DE LEDENLAAG.

   Het vervolg van ./tabel.js, en om dezelfde reden een eigen bestand: de tabel
   liep tegen de 10 KB (keuringsregel 13) en dat is de dakpan die zegt dat er
   een tweede onderwerp in zit. Dat onderwerp is de kant van het LID zelf: wat
   een lid over zijn eigen account beheert (/api/mijn) en waar hij om hulp
   vraagt (RTG Service). De kantoorkant van beide blijft in ./tabel.js.

   VOLGORDE IS GEDRAG, ook hier: deze lijst wordt achter ./tabel.js geplakt en
   voor ./tabel-hdi.js, precies waar hij stond toen hij nog in de tabel zelf
   zat. Wie hier een regel tussenvoegt, verandert waar alles eronder
   terechtkomt. */
'use strict';

module.exports = [
  /* DE ZELFBEDIENINGSLAAG VAN HET LID -- /api/mijn en de mijn-schermen.

     Kwam mee met de samenvoeging en viel met tweeentwintig punten op de
     restpost: vier werkprocesfamilies, veertien API-deuren en vier schermen.
     Dat is precies de reden dat de terugval rood is en niet stil groen --
     onbekend werk hoort niet bij Onderzoek te belanden, en hier ging het om de
     laag waar een lid zijn wachtwoordherstel, zijn tweefactor en zijn
     toestemmingen beheert.

     HET ZIJN TWEE FAMILIES EN GEEN EEN, dus staan er twee regels. Ze bij elkaar
     vegen zou korter zijn en onwaar: wie de tweefactor van een lid beheert doet
     ander werk dan wie zijn toestemmingen beheert, en het controleregister is
     er juist om die vraag te kunnen stellen.

       beveiliging  tweefactor, sessies, herstelkanaal -- dezelfde familie als
                    /login, /logout en /api/auth/tweede, die hierboven al bij
                    Intern & IT liggen.
       zeggenschap  gegevens, post (afmelden en voorkeuren) en relaties --
                    dezelfde familie als /api/privacy, /api/toestemming en
                    /api/inzagekaart, die alle drie bij Juridisch liggen.

     De schermen (/apps/mijn-*.html) staan in hetzelfde patroon als hun routes,
     om de reden die een paar regels hierboven bij routedekking staat: losse
     regels lopen na een hernoeming uit elkaar, en dan hangt het scherm ergens
     anders dan de deur die het bedient. */
  [/(?:^|\/)mijn[-/](?:tweefactor|sessies|herstelkanaal)/, 'intern', 'Intern & IT'],
  [/(?:^|\/)mijn[-/](?:gegevens|post|relaties)/, 'juridisch', 'Juridisch'],

  /* RTG SERVICE, DE KANT VAN DE MELDER (routes/service.js): een lid dat een
     zaak opent, een mens vraagt of belt -- Klantenservice, dezelfde kamer als
     de chat en de live vormen in ./tabel-breed.js. De kantoorkant
     (/api/office/service) blijft bij Intern & IT achter de office-regel
     hierboven; vandaar `/api/` VOOR `service`. De ondertiteling
     (routes/spraaktekst.js) staat in dezelfde regel omdat de functiecatalogus
     hem naast /api/service draagt, en een functie in twee kamers is precies
     wat deze tabel moet voorkomen. */
  [/\/api\/(?:service|ondertiteling)(?:\/|$)|\/apps\/(?:leverancier-)?service(?:-bel)?\.html/, 'klantenservice', 'Klantenservice']
];
