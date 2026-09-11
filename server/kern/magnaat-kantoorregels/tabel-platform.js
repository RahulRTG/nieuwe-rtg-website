/* De eigenaarsregels van het RTG Controleregister: DE PLATFORMLAAG.

   Afgesplitst van ./tabel.js toen die over de 9400 bytes van de waarschuwband
   van keuringsregel 13 kwam. Dat is dezelfde knip als bij ./tabel-lid.js en
   ./tabel-breed.js, en om dezelfde reden: dit is een TABEL en geen logica.

   VOLGORDE IS GEDRAG, en die loopt door alsof dit bestand er niet was: ./tabel.js
   plakt deze lijst er op exact dezelfde plaats weer achter. Een regel hierheen
   verplaatsen mag dus alleen als hij aaneengesloten blijft en in dezelfde
   volgorde staat; nagemeten met de volledige kantoortoewijzing van de
   Capability Graph -- nul punten verschoven.

   Wat hier woont zijn de deuren die NIET bij een werkkamer horen maar bij het
   platform zelf: vakbewijzen, tenants, het eigenaarsherstel, SCIM, isolatie en
   RTG Link. Per blok staat de reden erbij.
   ========================================================================== */
'use strict';

module.exports = [
  /* Het vakbewijs en de persoonseis liggen bij Juridisch, en met opzet in
     dezelfde regel als `verifications`: het is dezelfde handeling, een stap
     verder. Een mens van RTG ziet een stuk (VOG, BIG-registratie,
     legitimatiebewijs) en tekent af dat hij het heeft gezien -- zonder de
     inhoud te beoordelen, want RTG is geen inspectie. Bij HR zou het niet
     kloppen: dit is geen personeelsbeheer maar een controle die juist NIET bij
     de werkgever hoort te liggen. */
  [/office\/(?:bewaarverzoek|uitgifte|verifications|vakbewijs)|\/vakbewijs|\/persoonseis|\/onboarding|\/zegel|\/codewoord/, 'juridisch', 'Juridisch'],
  /* DE TENANT CONTROL PLANE, van main overgenomen op 25 augustus 2026. Deze twee
     regels stonden alleen in main's kopie van deze tabel; bij de samenvoeging is
     onze kopie gehouden (identieke inhoud, betere vorm) en vielen ze weg. Zeven
     werkprocessen kwamen daardoor op 'terugval' te staan -- 22 dekkingsgaten,
     en test/kantoren.test.js zag het.
     Het exit-recht, de bewaring en de bewijsstand zijn een AVG- en contractzaak
     en liggen bij Juridisch. De bootstrap en de groepsafbeelding zijn
     toegangsbeheer en liggen bij Intern & IT. De tweede regel sluit ZONDER
     afsluitende slash af, want de functiecatalogus draagt het prefix
     `/api/tenant` als codepunt: een regel die de routes wel pakt en de functie
     niet, dekt de helft en meldt zich niet. */
  [/\/api\/tenant\/(?:export|herstelproef|status)/, 'juridisch', 'Juridisch'],
  /* Het herstel van het eigenaarsaccount (EIGENAAR.md par. 5). Bij Intern & IT
     en niet bij Techniek: dit gaat over de SLEUTELS van een account, net als
     /api/webauthn, en niet over de gezondheid van het systeem. Expliciet
     opgeschreven omdat de terugval hier rood is -- onbekend werk hoort niet
     stilletjes bij Onderzoek te belanden. */
  [/\/api\/herstel\/eigenaar(?:\/|$)|\/api\/techniek\/herstel(?:\/|$)/, 'intern', 'Intern & IT'],
  [/\/api\/tenant(?:\/|$)/, 'intern', 'Intern & IT'],
  /* SCIM (routes/scim.js) is de deur waar de IdP van een klant zelf accounts
     aanmaakt en uitzet: toegangsbeheer, dezelfde familie als de bootstrap. */
  [/\/api\/scim(?:\/|$)/, 'intern', 'Intern & IT'],
  [/office\/(?:aidata)|\/belastingkantoor|\/loonstrook/, 'financien', 'Financiën'],
  [/office\/wereld|\/wereld\b/, 'controleregister', 'RTG Controleregister'],
  /* VOOGDIJ EN RUGDEKKING STAAN HIER EN NIET IN ./tabel-lid.js, en dat is de
     regel "smal gaat voor breed" -- alleen op deze plek werkt hij ook.

     Ze zijn met hun reden in de ledentabel geschreven (RTG Carriere: de voogdij
     bij Juridisch, want wie meetekent voor een minderjarige is dezelfde vraag
     als wie namens hem mag handelen; de rugdekking bij Financien, want daar
     wordt vastgelegd dat dit huis een MENS geld gaat geven). Maar die tabel
     wordt ACHTER deze geplakt, en de regel hieronder pakt elk pad dat met
     /api/office begint. Gemeten bij het samenvoegen van de takken:
     /api/office/voogdij/besluit en de vier /api/office/rugdekking-routes kwamen
     alle vijf uit op Intern & IT, en de twee regels die hun kamer benoemen
     vuurden nooit. Een beursbesluit -- geld dat het huis verlaat -- stond
     daarmee in de kamer voor toegangsbeheer.

     Dat viel niet op omdat een verkeerde kamer er hetzelfde uitziet als een
     goede: de terugval "Onderzoek & data" is rood en wordt bewaakt, maar een
     regel die door een BREDERE regel wordt overschaduwd geeft gewoon een kamer
     terug. test/kantoorkamer.test.js sluit dat gat voor deze vijf routes.

     De ledentabel houdt wat daar wel werkt: /api/vertegenwoordiging,
     /apps/verificatie.html en /api/mijn/abonnement raken /api/office niet.

     DE MOTIVERING ZOALS RTG CARRIERE HEM SCHREEF, hier overgenomen omdat een
     regel zonder zijn reden binnen een jaar door iemand wordt verplaatst:

       RTG RUGDEKKING hoort NIET bij Juridisch maar bij Financien, en dat is
       geen smaakkwestie. Een machtiging hierboven is een rechtsfiguur en
       verplaatst niets; rugdekking legt vast dat RTG een MENS geld gaat geven
       -- commercieel met een factuur, of als beurs. Het besluit dat een kamer
       hier neemt gaat over een bedrag en een tegenprestatie, en de schakelaar
       van de beurs is de uitbetaalpositie van dit huis
       (kern/bevoegdheid/lijst-afhankelijk.js).

       De VOOGDIJ valt er wel onder Juridisch, samen met de machtiging waar zij
       bij hoort: wie meetekent voor een minderjarige is dezelfde vraag als wie
       namens hem mag handelen, en die twee over twee kamers verdelen betekent
       dat niemand de hele keten ziet.

       Dezelfde afsluiting op `(?:[\s/]|$)` als bij /api/vertegenwoordiging in
       ./tabel-lid.js, en om dezelfde reden: de functiecatalogus draagt het kale
       prefix als codepunt. */
  [/\/api\/office\/voogdij(?:[\s/]|$)/, 'juridisch', 'Juridisch'],
  [/\/api\/(?:office\/)?rugdekking(?:[\s/]|$)/, 'financien', 'Financien'],
  [/\/api\/office\b|\/kantoor\/gesprek|\/living-os|\/scherm\.html|\/app\.html/, 'intern', 'Intern & IT'],
  /* ISOLATIE HOORT BIJ DEZELFDE HAND ALS DE INCIDENTCONTROLE, en dat is geen
     naamsgelijkenis maar de opzet: kern/isolatie/ leest zijn huisstand uit de
     incidentcontrole en de cockpit staat achter dezelfde deur (techAuth,
     eigenaarAlleen). De ledenkant valt er ook onder -- wie een gestolen sessie
     dichtzet doet incidentwerk, ook als hij het over zijn eigen account doet.
     Zonder deze regel viel de hele laag in de terugval "Onderzoek & data", en
     die terugval is met opzet rood: onbekend werk hoort niet stilletjes een
     eigenaar te krijgen. */
  [/\/techniek|\/wacht|\/incident|\/storing|[/-]isolatie/, 'techniek', 'Techniek & De Wacht'],
  /* RTG Link (LINK.md): de adres- en capabilitylaag. Hij hoort bij Intern & IT,
     bij de familie waar hij thuishoort -- codes, scanners, sleutels, identiteit
     (zie de platformregel verderop met /code, /scanner en /rtgid).

     Hij staat HIER en niet in dat blok, want zijn deuren wonen in drie werelden:
     /api/link (leden), /api/rtf/link (gezin) en /api/supplier/link (de kassa).
     Verderop zouden `rtf` en `supplier` hem eerder afvangen en lag dezelfde laag
     bij drie kantoren. Een laag heeft een eigenaar; waar zijn deuren staan doet
     daar niet aan af.

     Zonder deze regel viel elk Link-punt terug op de restpost, en dat is met
     opzet rood: onbekend werk hoort niet stilletjes bij Onderzoek te belanden.
     De volle toetssuite wees dat aan (test/kantoren.test.js, acht gaten).
     Het patroon liet eerst een schuine streep NA `link` vallen, waardoor
     /api/link zelf erbuiten viel; /api/linkkaart matcht nog steeds niet. */
  [/(?:^|\/)link(?:\/|$)/, 'intern', 'Intern & IT']
];
