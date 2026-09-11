/* De eigenaarsregels van het RTG Controleregister: DE LEDENLAAG.

   Het vervolg van ./tabel.js, en om dezelfde reden een eigen bestand: de tabel
   liep tegen de 10 KB (keuringsregel 13) en dat is de dakpan die zegt dat er
   een tweede onderwerp in zit. Dat onderwerp is de kant van het LID zelf: wat
   een lid over zijn eigen account beheert (/api/mijn). RTG Service staat niet
   hier maar in ./tabel.js, VOOR de office-regel, want de kantoorkant van de
   hulplijn is servicewerk en geen kantoorwerk.

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
  /* RTG Vertegenwoordiging (CARRIERE.md par. 6a en 6b) hoort in deze familie en
     niet bij de Ledenbalie: die doet inzage in het dossier van een lid met een
     reden, terwijl RTG hier juist GEEN partij is -- de client machtigt zijn
     eigen vertegenwoordiger en aanvaardt zelf. Een machtiging waarmee een mens
     commercieel namens een mens handelt is een rechtsfiguur, net als `mijn-
     relaties` hierboven, en ligt dus bij Juridisch.

     Een regel voor de routes, het scherm EN de functie, zodat ze niet bij drie
     kamers belanden. Hij sluit af op `(?:[\s/]|$)` en niet op een schuine
     streep, want de functiecatalogus draagt het KALE prefix als codepunt
     (../../functies/register/cat-life.js) -- dezelfde halve dekking waar de
     tenant-regels in ./tabel.js voor waarschuwen. */
  [/\/api\/vertegenwoordiging(?:[\s/]|$)|\/vertegenwoordiging\.html/, 'juridisch', 'Juridisch'],

  /* RTG RUGDEKKING hoort NIET bij Juridisch maar bij Financien, en dat is geen
     smaakkwestie. Een machtiging hierboven is een rechtsfiguur en verplaatst
     niets; rugdekking legt vast dat RTG een MENS geld gaat geven -- commercieel
     met een factuur, of als beurs. Het besluit dat een kamer hier neemt gaat
     over een bedrag en een tegenprestatie, en de schakelaar van de beurs is de
     uitbetaalpositie van dit huis (kern/bevoegdheid/lijst-afhankelijk.js).

     De VOOGDIJ valt er wel onder Juridisch, samen met de machtiging waar zij
     bij hoort: wie meetekent voor een minderjarige is dezelfde vraag als wie
     namens hem mag handelen, en die twee over twee kamers verdelen betekent dat
     niemand de hele keten ziet.

     Dezelfde afsluiting op `(?:[\s/]|$)` als hierboven, en om dezelfde reden:
     de functiecatalogus draagt het kale prefix als codepunt. */
  [/\/api\/office\/voogdij(?:[\s/]|$)/, 'juridisch', 'Juridisch'],
  [/\/api\/(?:office\/)?rugdekking(?:[\s/]|$)/, 'financien', 'Financien'],

  /* HET SCHERM WAAROP EEN LID ZIJN IDENTITEIT AANTOONT hoort bij dezelfde kamer
     als de kant waar een medewerker het aftekent: `office/verifications` ligt in
     ./tabel.js bij Juridisch, met de reden dat een mens van RTG een stuk ZIET en
     tekent dat hij het heeft gezien -- zonder de inhoud te beoordelen, want RTG
     is geen inspectie. Dit is de andere helft van precies die handeling, en de
     twee helften over twee kamers verdelen betekent dat niemand de keten ziet.

     Hij staat hier en niet in ./tabel-breed.js omdat die het brede patroon
     `verify` naar Intern & IT stuurt. Dat is juist voor de technische
     verify-routes (een token, een passkey) en verkeerd voor deze: hier draait
     het niet om een sleutel maar om een identiteitsbewijs. Smal gaat voor
     breed, en deze lijst wordt voor die brede geplakt. */
  [/\/apps\/verificatie\.html/, 'juridisch', 'Juridisch']
];
