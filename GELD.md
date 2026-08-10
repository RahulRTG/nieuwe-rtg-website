# GELD.md -- RTG Geld als financieel besturingssysteem

Opdracht van Rahul (10 augustus 2026), direct na de samenvoeging van de tien
geldpagina's: stop met denken in elf standen, ga denken in **een financieel
besturingssysteem met elf gezichtspunten**. Dit document legt vast wat dat
betekent, wat er al staat, en in welke volgorde de rest komt. PLATFORM.md
blijft gelden (de schil is een, de domeinkernen blijven); dit document gaat
over wat er BOVEN de domeinen bij komt.

## 0. De kern, in een zin

> RTG Geld weet wat er financieel gebeurt, begrijpt wat belangrijk is,
> voorspelt wat eraan komt, voert veilige handelingen uit binnen de regels
> van het lid, en legt uit wanneer een mens moet beslissen.

Vijf werkwoorden: **weten, begrijpen, voorspellen, uitvoeren, uitleggen.**
Elke nieuwe geldfunctie hoort bij precies een van die vijf te horen; een
functie die bij geen enkele hoort, hoort hier niet.

## 1. De geldgraaf (Financial Graph)

Onder alle standen komt een graaf: een projectielaag die de feiten uit alle
gelddomeinen in EEN vorm naast elkaar zet en er als enige overheen mag
redeneren. Het patroon bestaat al in dit huis en heet `kern/levensgraaf`:
bronnen die niets van elkaar weten, elk hun feiten in dezelfde vorm leveren,
en een motor die er vensters en vooruitblikken van maakt. De geldgraaf
(`kern/geldgraaf/`) is de financiele evenknie.

**Wat de graaf NIET is: een tweede boekhouding.** De regel uit
`kern/geldwereld.js` blijft onverkort staan: pay telt zijn eigen saldi, wbw
zijn eigen verrekeningen, mecenaat zijn eigen sommen. De graaf zet die
uitkomsten naast elkaar en kijkt VOORUIT -- de vooruitblik is een afgeleide
met een eigen naam ("verwachting"), nooit een tweede saldo. Zou de graaf
zelf gaan boekhouden, dan bestaan er twee totalen die uit elkaar lopen, en
een geldscherm dat een ander getal toont dan de wallet is erger dan geen
geldscherm (LAT.md regel 4).

Een feit in de graaf heeft altijd dezelfde vorm: soort, titel, centen
(rauw; het scherm maakt er een keer euro's van), richting (in of uit),
wanneer, herhaling (indien herkend), bron en link naar de stand waar het
echte werk gebeurt.

## 2. Het Command Center (de stand Overzicht)

Het overzicht toont niet wat er IS maar wat het BETEKENT. Elke ochtend
antwoord op drie vragen:

1. **Hoe sta ik ervoor?** -- vrij besteedbaar, buffer in maanden.
2. **Wat komt eraan?** -- vaste lasten komende 14 dagen, verwachting einde
   maand.
3. **Moet ik iets doen?** -- alleen de uitzonderingen, niets anders.

Uitzonderingsgestuurd (ONTWERP.md): een gezond huishouden toont EEN regel
("alles in orde") en verder rust. Rust is een uitkomst, geen leegte: "u
hoeft vandaag niets te doen" is de beste zin die dit scherm kan zeggen.
Geen verslavende patronen -- de dagstart is een moment, geen feed.

## 3. De vier niveaus van automatisering

| Niveau | Gedrag | Fase 1 |
|---|---|---|
| **Kijken** | Rahul analyseert en signaleert | ja |
| **Voorstellen** | Rahul stelt een handeling voor | ja |
| **Klaarzetten** | Rahul vult alles in, het lid bevestigt | ja |
| **Automatisch** | Vooraf per regel toegestane handelingen lopen zelf | alleen interne reserveringen |

De grens is hard: **geld verlaat het huis nooit autonoom.** "Automatisch"
geldt in fase 1 uitsluitend voor interne reserveringen (potten binnen het
eigen tegoed), en alleen als het lid de regel daar expliciet op heeft gezet.
Elke handeling van elk niveau komt in het actielog. Betalen, opzeggen en
alles wat een derde raakt blijft maximaal "klaarzetten".

## 4. Beleid: regels zoals een bedrijf ze stelt

Het lid stelt beleid in; Rahul handelt binnen beleid, nooit naar eigen
inzicht. Voorbeelden van regels: minimale liquide buffer; waarschuwen boven
een maandelijkse bestedingsdrempel; jaarlijkse lasten vooraf reserveren;
giften boven een bedrag altijd extra bevestigen. Elke regel heeft een
niveau (zie par. 3) en staat aan of uit. Geen regel, geen handeling.

## 5. Uitlegbaarheid (de Waarom-knop)

Elke bewering, elk signaal en elke handeling van Rahul is uitlegbaar met
drie dingen: de uitleg in gewone taal, de gebruikte gegevens (welke bronnen,
welke feiten), en het actielog (wie deed wat, wanneer). Het actielog is
append-only: er wordt bijgeschreven, nooit herschreven. AI zonder
verantwoording is hier geen AI maar een orakel, en orakels horen niet in
een geldscherm.

## 6. Een tijdlijn

Alle financiele gebeurtenissen -- betalingen, ontvangsten, reserveringen,
toezeggingen, wijzigingen -- in een tijdlijn: het financiele geheugen van
RTG. Niet alleen banktransacties; alles wat de graaf ziet.

## 7. Wat er bewust NIET komt

- **Gereguleerde beslissingen.** Geen beleggingsadvies, geen krediet, geen
  verzekeringsadvies. Dat vraagt vergunningen, menselijke controle en eigen
  compliance-lagen; als het ooit komt, komt het als apart, expliciet
  ontworpen geheel -- niet als sluipende functie van de cockpit.
- **Autonome betalingen.** Zie par. 3.
- **Echte merken als partners of in demobeelden.** Huisregel; demo-data
  gebruikt fictieve namen.
- **Verslavende patronen.** Geen kunstmatige urgentie, geen oneindige
  lijsten; de cockpit is klaar als hij rust geeft.
- **Een tweede boekhouding.** Zie par. 1.

## 8. De elf gezichtspunten

| Stand | Rol in het systeem |
|---|---|
| Overzicht | het command center; orkestreert, bezit niets |
| Bank | geldinfrastructuur |
| Wallet | passen, toegang, credentials |
| Wie betaalt wat | sociaal geld |
| Metier | inkomen en loopbaan |
| Balans | financiele context en welzijn |
| RTG-code | vertrouwde identificatie |
| Lab-fonds | collectief geld |
| Mecenaat | filantropie |
| Logboek | vermogen en bezit |
| Nalatenschap | lange-termijn continuiteit |

Het lid hoeft niet tussen elf werelden te springen: het overzicht en Rahul
orkestreren, de standen zijn de gespecialiseerde motoren eronder.

## 9. Faseplan

| Fase | Wat | Status |
|---|---|---|
| 1 | geldgraaf (projectie + vooruitblik 7/30/90 + patroonherkenning terugkerende posten), beleid met vier niveaus, reserveringen (potten), actielog, cockpit-herbouw van Overzicht, gegronde Rahul, tijdlijn | in aanbouw |
| 2 | abonnementen-intelligence (prijsstijging, ongebruikt, opzegmoment), scenario-vooruitblik (voorzichtig / met reis / met aankoop) | -- |
| 3 | inkomen via Metier volledig in de graaf (salarisontwikkeling, vrije-ruimte-vergelijking), Balans als financial wellbeing | -- |
| 4 | asset ledger in Logboek (waarde, jaarkosten, verwachting per bezit), Wie betaalt wat automatisch (context herkent de groep) | -- |
| 5 | Wallet als credential/entitlement-laag met verloop-signalen, Nalatenschap-kluisverzwaring (vrijgavevoorwaarden, versiegeschiedenis, inzage-audit) | -- |

Elke fase levert werkende, geteste software op; geen fase begint voordat de
vorige zijn toetsen heeft (LAT.md: een toets die je niet hebt zien zakken
is geen toets).
