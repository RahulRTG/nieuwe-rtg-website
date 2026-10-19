# Partner Network (link:partnernetwerk)

Eigenaar: `zaak.partnernetwerk` (SCHERMEIGENAAR.json, rol eigenaar, doelgroep
zaak). Ingang: `/apps/partner-network.html`, vanuit de werkplek van de zaak
(`supplierAuth`). Doel volgens het register: "Als hotelpartner zien welke
reisintenties passen bij de eigen capaciteit, hoe het consortium van
hotel/vervoer/diner/RTG-regie er gezamenlijk voor staat, en een 'levend contract'
met andere partners openen." Dat doel wijkt af van wat er gebouwd is (zie a.).

Opgesteld op 19 oktober 2026 op tak `appwerkt/workos`. Dit is een kaart en geen
bouwopdracht.

## a. Inventaris van het bewezen bestaande

**Wat er staat**

| Laag | Pad | Inhoud |
|---|---|---|
| Scherm | `public/apps/partner-network.html`, `public/apps/partner-network.js` | overzicht met tellingen en bron, aandachtslijst, reageren op een vraag van een lid |
| Route | `server/routes/supplier/netwerk.js` | `POST /api/supplier/netwerk/overzicht` (supplierAuth), alleen lezen |
| Kern | `server/kern/partnernetwerk.js` | projectie zonder eigen opslag over vier domeinen; `NIET_GEBOUWD` met redenen |
| Schrijven | `server/routes/supplier.js` | `/api/supplier/mall/aanvraag/reageer` (eigenaar Mall) |
| Contract | `server/lib/mutatiecontracten-partnernetwerk.js` | idempotent, `NOT_APPLICABLE`; opslag byte-voor-byte gelijk na het overzicht |
| Toetsen | `test/partnernetwerk-scherm.test.js` (6), `test/partnernetwerk-route.test.js` (1) | |
| Voltooiproef | `scripts/lib/voltooi/partnernetwerk.js` | lid stelt vraag, zaak antwoordt, andere zaak ziet niets |

**Wat de projectie leest**

| Getal | Bron | Als de bron ontbreekt |
|---|---|---|
| `intentiesOpen`, `intentiesBeantwoord`, `responstijdMin` (mediaan) | `kern/mall/aanvragen.js` `voorZaak` (`/api/supplier/mall/aanvragen`) | "niet gemeten" met reden |
| `onderdelenOpen`, `onderdelenVandaag` | conciërge-lus (`/api/supplier/concierge/opdrachten`, CON-02 deelnemerweergave) | "niet gemeten" |
| `samenwerkingIn`, `samenwerkingUit` | `kern/samenwerking.js` (`/api/supplier/samenwerking/mijn`) | "niet gemeten" |
| `kamersInVerkoop`, `kamersTotaal` | `supplier.rooms` | "niet gemeten: geen kamers" |
| `klussenOpen` | `db.data.tickets[code]` | altijd gemeten |

Aandacht: maximaal 5 wachtende vragen, 5 onderdelen van vandaag, 5 open klussen.

**NIET_GEBOUWD volgens de code** (`kern/partnernetwerk.js`):
- Experience Composer: "Er bestaat geen gezamenlijk contract tussen partners in RTG."
- Match- en netwerkscores: "een getal zonder bron tonen we niet."
- Collectieve patronen over gasten: geen meting, en de privacygrens.
- Marge, werkdruk en waarde van andere partners: "gegevens van een andere zaak."

**Wat BEWEZEN is**

| Bewijs | Stand | Bron |
|---|---|---|
| bereikbaar, bedienbaar, waarheidsgetrouw | BEWEZEN | APPWERKT.json |
| menselijk | NIET_GETEST centraal; lokaal afgeleid 3/3 | APPWERKT.json; verse proef |
| voltooibaar | GEEN_FIXTURE centraal; lokaal 5/5 | VOLTOOIPROEF.json (04:47, f85c044e); verse proef 19-10, dc501544 |
| persistent | GEEN_FIXTURE; lokaal 3/3 | idem |
| herstelbaar | GEEN_FIXTURE; lokaal 3/3 | idem |
| bevoegd | NIET_GETEST | BEVOEGD.json |

Formulering: voltooiproef lokaal gesloten 4/4 (19-10, dc501544), centraal nog te
stempelen. BETROUWBAARHEID.md par. 4d noemt een `personaAfwijking`: de proef meet
vanuit een andere wereld dan de doelgroep zaak; dat verandert geen bewijs.

**Afwijkingen tussen doel en code**

- Het register zegt "hotelpartner", "consortium" en "levend contract". De code
  bedient elke zaak en bouwt bewust geen consortium.
- `samenwerkingIn/Uit` telt samenwerkingen uit `kern/samenwerking.js`. Dat zijn
  voorstellen tussen content creators en leveranciers, niet tussen partners in
  het algemeen. Het scherm noemt het "samenwerkingen met andere partners"; of dat
  label klopt, is te controleren.
- Een route waarmee de zaak een conciërge-onderdeel bevestigt of weigert, is niet
  gevonden; Partner Network telt alleen.

## b. Marktvergelijking

Partner Network lijkt het meest op partner relationship management (PRM). Echte
merken alleen ter vergelijking.

| Leider | Wat achter de betaalmuur zit | Hebben wij het | Bron (19-10-2026) |
|---|---|---|---|
| Salesforce Partner Ecosystem Management ($50 per partnerlid) / PRM (oud: $25) | partnerportaal, deal registration, deal scoring vanaf Enterprise | half: de zaak ziet vragen en antwoordt; geen deal registration, scores bewust niet | https://www.salesforce.com/sales/partner-relationship-management/pricing/ (via zoektool, live te controleren; [zeer oud] voor de PRM-prijs) |
| PartnerStack Launch (~$1.000 p.m.) / Growth | deal registration, uitbetalingen; LMS, MDF | nee: geen uitbetaling aan partners via dit scherm; provisie en afdracht wonen in Geld en `kern/commercie/` | https://partnerstack.com/pricing (via zoektool, live te controleren; [afwijkend]) |
| Impartner Enterprise (offerte) | partnerportaal, onboarding, MDF, rapportage | half: onboarding via Partner worden en het kantoor; geen MDF | https://impartner.com/request-prm-pricing/ (via zoektool, live te controleren) |

Wat de markt niet heeft: een getal dat zonder bron niet op het scherm komt, en
vragen van eindklanten die op codenaam binnenkomen in hetzelfde huis als de partner.

## c. Analyse van het volledige domein

**Hoe partnerwerk echt werkt**

- *Particulier.* Het lid is de vrager (Mall-vraag, conciërge-wens). Hij gebruikt
  Partner Network niet; hij ziet de antwoorden in de Mall of zijn case.
- *Professioneel.* Een zzp-partner (gids, chauffeur, creator) wil weten welke
  vragen bij hem passen, wat hij heeft toegezegd en wat vandaag moet.
- *Organisatie.* Een hotel, restaurant of vervoerder met personeel wil zien wat er
  voor de zaak klaarligt, wie reageert en hoe snel, en met welke andere partners
  hij samen een dienst levert (een arrangement: hotel + diner + vervoer).
- *Samenwerking tussen zaken.* Een arrangement vraagt een afspraak: wie belooft
  wat aan het lid, wie is aansprakelijk, hoe wordt verdeeld. Dat is precies wat
  NIET_GEBOUWD noemt ("geen gezamenlijk contract").

**Wettelijke en normatieve eisen**

| Eis | Bron | Betekenis |
|---|---|---|
| Betaaltermijn B2B maximaal 60 dagen, 30 als niets is afgesproken; grootbedrijf aan mkb 30 (art. 6:119a BW) | https://ondernemersplein.kvk.nl/betalingstermijn-incassokosten-en-wettelijke-rente/ | Afdrachten tussen RTG en partners, of tussen partners in een arrangement, hebben een termijn. De betaling is van Geld. |
| Algemene voorwaarden: terhandstelling, zwarte en grijze lijst (art. 6:231 e.v. BW) | https://www.acm.nl/nl/verkoop-aan-consumenten/de-koop-sluiten/algemene-voorwaarden-aanbieden | Een antwoord van een zaak aan een lid dat een aanbod is, moet naar de voorwaarden van de zaak verwijzen. |
| Verwerkersovereenkomst (AVG art. 28) | https://autoriteitpersoonsgegevens.nl/nl/over-privacy/persoonsgegevens/bewaren-van-persoonsgegevens | Een zaak ziet een codenaam en een vraag. Of de verhouding RTG-zaak verwerker of gezamenlijke verantwoordelijkheid is, is niet in de bronnen gevonden (te controleren). |
| Spam: toestemming vooraf, afmelden in elk bericht (art. 11.7 Tw) | https://www.acm.nl/nl/verkoop-aan-consumenten/reclame-en-verleiden/spam-voorkomen-uw-reclame | Een zaak mag een lid niet ongevraagd benaderen buiten de vraag die het lid stelde. |
| ISO 27001 A.5.19-5.23 leveranciersrelaties | https://www.dqsglobal.com/blog/new-iso-27001-2022-key-changes (secundair) | Normatief, voor RTG als organisatie: partners die ledengegevens zien, horen in een leveranciersbeoordeling. |
| ISO 9001 8.4 externe leveranciers | https://www.lrqa.com/en/latest-news/iso-9001-publication-date-confirmed/ | Normatief: prestatie van partners meten. Er is geen wettelijke basis voor leveranciersbeoordeling. |
| Mededingingsrecht bij gezamenlijke prijzen in een arrangement | niet in de bronnen gevonden | Te controleren voordat een Experience Composer gezamenlijke prijzen laat afspreken. |

**Wat dat betekent voor software.** Elk getal met bron (bestaat). Een antwoord
dat een aanbod is, draagt de voorwaarden. Een arrangement vraagt een contract
tussen zaken met een verdeling, en dat is een nieuw domein. Prestatie meten mag
alleen over de eigen zaak, nooit vergelijkend over andermans gegevens.

## d. Functiecatalogus L1–L6

### L1 Persoonlijk (de medewerker van de zaak)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Wat vraagt vandaag aandacht | bestaat | Mall, conciërge, tickets | maximaal 5 per soort | "vandaag" wordt in UTC bepaald | medewerker bij openen | supplierAuth | | Een onderdeel van vandaag staat in de lijst, ook tussen 0:00 en 2:00 Nederlandse tijd | klein | aanbevolen nu (dag in Europe/Amsterdam) |
| Op een vraag reageren | bestaat | Mall `reageer` | eigenaar Mall; één reactie per zaak | | lid, direct | supplierAuth; of een niet-manager een prijs mag bieden is te controleren | verlopen vraag | Mijn antwoord staat één keer bij het lid, ook na een dubbele tik | klein | bestaat |

### L2 Professioneel

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Responstijd | bestaat | reacties | mediaan in minuten van eigen reacties | weinig reacties: geen getal | manager | | geen reactie: "niet gemeten" | | | bestaat |
| Doorklikken naar het domein | half | `aandacht[].bron` | elke regel opent het eigen scherm van het domein (Mall, conciërge, werklijst) | | | rechten van dat domein | | Een tik op een onderdeel opent het onderdeel waar ik het kan behandelen | klein | aanbevolen nu |
| Conciërge-onderdeel bevestigen of weigeren | niet gevonden als zaakroute | bureau-case deelnemerweergave | eigenaar Concierge; Partner Network linkt alleen | | lid en RTG-regie | manager | | Een zaak kan haar deel van een case bevestigen of weigeren, met reden | middel | later (eigenaar Concierge) |
| Antwoord met voorwaarden | ontbreekt | algemene voorwaarden van de zaak | link naar de voorwaarden bij een aanbod | | lid | | | Een aanbod toont de voorwaarden van de zaak | klein | later (eigenaar Mall) |

### L3 Organisatorisch

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Rolverschil medewerker en manager | half; overzicht voor iedereen met supplierAuth | sessie | tellingen voor iedereen; responstijd en antwoorden op aanbodvragen alleen manager (te besluiten) | | | `managerOnly` | | Een medewerker ziet zijn werk, de manager ziet ook de prestatie van de zaak | klein | aanbevolen nu |
| Capaciteit uit bestaande bronnen | half (alleen kamers) | horeca-reserveringen en tafels, `/api/supplier/vak/capaciteit` | alleen waar een bron bestaat; anders "niet gemeten" | | manager | | | Een restaurant ziet zijn vrije tafels met bron, of "niet gemeten" | middel | later |
| Vestigingen van één concern | ontbreekt | `kern/concern/` vestigingen | per vestiging de eigen projectie | | concernmanager | scope per vestiging | | De concernmanager ziet het netwerk per vestiging, niet samengeteld zonder bron | middel | later |
| Leveranciersbeoordeling door RTG | ontbreekt | reacties, klachten, onderdelen | alleen over de eigen zaak; nooit vergelijkend getoond aan andere zaken | | RTG-kantoor | | | | middel | vraagt besluit (familiebesluit 2) |

### L4 Domeinintelligentie

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| "Niet gemeten" in plaats van nul | bestaat | | | | | | | | | bestaat |
| Verwachte vraag volgende week | ontbreekt | Mall-vragen van de eigen zaak | telling per week; klasse `advies` met `aannames` en `onbekend` | seizoen, weinig data | manager | | minder dan 8 weken historie: niet rekenen | De verwachting staat als advies met aannames, nooit als feit | middel | later |
| Match- en netwerkscores | NIET_GEBOUWD | | | geen onderbouwde berekening | | | | | | niet doen: geen bron, en een score over leden en partners raakt de privacygrens |
| Collectieve patronen over gasten | NIET_GEBOUWD | | | | | | | | | niet doen: privacy op codenamen; zie ook "Geen verslavende patronen" |

### L5 Volledige levenscyclus

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Van aanmelding tot actieve partner | half | `partnerApplications` (kantoor), `/apps/partner-worden.html` | Partner Network leest de stand van de eigen aanvraag | | zaak | | | Een nieuwe zaak ziet in Partner Network waar haar aanmelding staat en wat ontbreekt | klein | later |
| Van vraag tot afgerond antwoord | bestaat (Mall) | Mall-levensloop: open, gegund, in behandeling, afgerond | eigenaar Mall | | | | verlopen | | | bestaat |
| Partnerschap beëindigen | ontbreekt | | uitgang van de zaak (`kern/tenant/uitgang.js`) | | | manager | lopende onderdelen eerst afronden | Een zaak die stopt, ziet welke beloften nog open staan | middel | later |

### L6 RTG-samenhang

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Projectie over Mall, conciërge, samenwerking, werklijst | bestaat | vier domeinen | leest, schrijft niets | | | | | | | bestaat |
| Experience Composer (arrangement van meerdere zaken) | NIET_GEBOUWD | zou vragen: contract tussen zaken, verdeling | | aansprakelijkheid, mededinging | | | | | groot | vraagt besluit |
| Afdracht en provisie zichtbaar | ontbreekt | `kern/commercie/allocatie.js`, `kern/commercie/fee.js` | projectie van wat de zaak RTG verschuldigd is, met bron | | manager | | | De manager ziet wat RTG van een onderdeel rekent, met bron | middel | later |

### Modus LOS

Als Mall, conciërge en samenwerkingen uit staan, blijft de werklijst van de zaak
(tickets) als enige gemeten bron. Het scherm zegt per tegel "niet gemeten" met de
reden ("De vraagkant van de Mall is op deze server niet beschikbaar"). Dat is al
gebouwd en in de voltooiproef getoetst. Reageren kan dan niet; de knop moet dan
ook weg (of zeggen waarom), want de reageerroute is van de Mall.

### Modus SAMEN: van vraag van een lid tot onderdeel van een case

1. Een lid zet in de Mall een vraag uit ("diner voor zes, vrijdag, Amsterdam").
   - *Storing:* de vraag past niet bij het genre of het werkgebied van de zaak.
     De zaak ziet haar niet; dat is de bedoeling (`past()` in `kern/mall/aanvragen.js`).
2. De zaak opent Partner Network en ziet de vraag op codenaam bij "wacht".
   - *Storing:* de Mall is niet beschikbaar. Tegels staan op "niet gemeten",
     niet op nul. Bewaard: de vraag in de Mall.
3. De manager antwoordt met prijs en tekst.
   - *Storing:* dubbele tik of afgebroken verbinding. Er staat één reactie
     (voltooiproef herstelbaar 3/3).
   - *Storing:* de vraag verliep net. De Mall weigert met de reden.
4. Het lid gunt de zaak. De conciërge maakt een case met een onderdeel voor de zaak.
5. Op de dag zelf staat het onderdeel in "vandaag".
   - *Storing:* tussen middernacht en 1:00 of 2:00 Nederlandse tijd telt
     Partner Network het onderdeel nog bij gisteren (UTC-datum). Bewaard: het
     onderdeel in de case.
   - *Storing:* de zaak wil het onderdeel weigeren. Een route daarvoor is niet
     gevonden; ze moet de conciërge mailen. Bewaard: het onderdeel, onbevestigd.
6. Een andere zaak opent haar netwerk en ziet dit antwoord niet (voltooiproef stap 4).

## e. RTG-exclusieve mogelijkheden

| Mogelijkheid | Eigenaar | Capability | Waarom geen markt-app dit kan |
|---|---|---|---|
| Vragen van leden die op codenaam binnenkomen en passen bij vak en werkgebied | Mall (vraag); Partner Network (projectie) | `zaak.partnernetwerk` | Een PRM kent geen eindklant met een eigen account en codenaam in hetzelfde huis. |
| Het deel van een zaak in een conciërge-case, zonder de case te zien (CON-02) | Concierge | `zaak.partnernetwerk` (telt) | De zaak ziet precies haar stukje; de markt deelt het dossier of niets. |
| Arrangement van meerdere zaken met één belofte aan het lid | nog geen eigenaar | (Experience Composer) | Alleen RTG kent lid, zaken en case tegelijk; vraagt een contract tussen zaken (besluit). |

## f. Bouwstenen en ontbrekende koppelingen

**Bestaande modules**

- `server/kern/partnernetwerk.js` (projectie, `nietGemeten`).
- `server/kern/mall/aanvragen.js` (vraag en reactie).
- `server/kern/bureau/` en `server/kern/service/zaak.js` (CON-02 deelnemerweergave).
- `server/kern/samenwerking.js` (creator en leverancier).
- `server/kern/connection-partner.js` (deelname per programma, afwezig is uit).
- `server/kern/commercie/allocatie.js`, `fee.js`, `contract.js` (afdracht, vergoeding, contract met RTG).
- `server/kern/concern/` (vestigingen), `server/kern/tenant/uitgang.js` (uitgang).

**Ontbrekende koppelingen**

| Van | Naar | Vorm | Toestemming |
|---|---|---|---|
| conciërge-onderdeel | bevestigen of weigeren door de zaak | route bij Concierge | manager |
| Partner Network | aanmeldstand (`partnerApplications`) | projectie | eigen zaak |
| Partner Network | afdracht en vergoeding | projectie | manager |
| horeca/vak-capaciteit | capaciteitstegel | projectie | eigen zaak |

## g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| SCHERMEIGENAAR-doel bijstellen naar wat er staat | klein | laag | besluit 1 | aanbevolen nu |
| "Vandaag" in Europe/Amsterdam | klein | laag | `lib/klok` | aanbevolen nu |
| Doorklikken naar het scherm van het domein | klein | laag | geen | aanbevolen nu |
| Rolverschil medewerker/manager | klein | laag | besluit 3 | aanbevolen nu |
| Label "samenwerking" laten kloppen met `kern/samenwerking.js` | klein | laag | geen | aanbevolen nu |
| BEVOEGD-telling voor `/api/supplier/netwerk/overzicht` | klein | laag | `scripts/bevoegdronde.js` | aanbevolen nu |
| Capaciteit uit horeca en vak | middel | middel | bronnen per genre | later |
| Onderdeel bevestigen/weigeren | middel | middel | Concierge | later |
| Afdracht en vergoeding zichtbaar | middel | middel | `kern/commercie/` | later |
| Verwachte vraag (L4) | middel | middel | historie | later |
| Experience Composer | groot | hoog | contract tussen zaken | vraagt besluit |
| Scores en collectieve patronen | | | | niet doen |

## h. Toetsbaar eindcontract Beyond Premium

Dit contract vervangt de acht bewijzen van APPWERKT nooit.

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| 1. Breedte | Elke regel in de aandachtslijst opent het scherm waar hij behandeld wordt | `scripts/schermen.js` | half: alleen vragen zijn te beantwoorden |
| 2. Professionele diepte | Een aanbod draagt de voorwaarden; "vandaag" is Nederlandse tijd | `node --test` op datumgrens | ontbreekt |
| 3. Levenscyclus | Van aanmelding tot beëindiging ziet de zaak haar stand | voltooiproef uitgebreid | half |
| 4. Samenwerking en rollen | Andere zaak, lid en uitgelogd geweigerd; medewerker ziet geen prestatiecijfers als dat zo besloten is | voltooiproef stap 4-5; BEVOEGD | voltooiproef lokaal ja; BEVOEGD NIET_GETEST |
| 5. Domeinintelligentie | Geen getal zonder bron; een verwachting draagt klasse `advies` | `test/partnernetwerk-scherm.test.js` | bestaat voor de bron; geen verwachting |
| 6. Los functioneren | Met Mall, conciërge en samenwerking uit staan tegels op "niet gemeten" en niet op nul | `test/partnernetwerk-scherm.test.js`, voltooiproef stap 1 | bestaat |
| 7. RTG-ketens | Vraag → antwoord → gunning → case-onderdeel → vandaag, met storingen | ketenproef naar `scripts/ritproef.js` | half: onderdeel bevestigen ontbreekt |
| 8. Bewezen betrouwbaarheid | Alle acht bewijzen centraal BEWEZEN | APPWERKT.json | 3 van 8; 4 lokaal gesloten |

## Twee uitkomsten

### (A) Binnen de huidige architectuur en scope

| Functie | Kosten | Bouwt op |
|---|---|---|
| Doel in SCHERMEIGENAAR bijstellen | klein | SCHERMEIGENAAR.json |
| "Vandaag" in Nederlandse tijd | klein | `server/lib/klok` |
| Doorklikken per aandachtsregel | klein | `aandacht[].bron` |
| Rolverschil medewerker en manager | klein | `managerOnly` |
| Juiste label voor samenwerkingen | klein | `kern/samenwerking.js` |
| Later: capaciteit per genre, onderdeel bevestigen (Concierge), afdracht zichtbaar, verwachte vraag | middel elk | horeca, `kern/vakwerk/`, `kern/bureau/`, `kern/commercie/`, `kern/fiscaal/zekerheid.js` |

### (B) Het uiteindelijke domeinmaximum, ook buiten de huidige scope

Richting en geen toezegging; wat een nieuw domein of externe koppeling vraagt,
staat als besluit.

**Proces 1. Het partnerschap met RTG, van aanmelding tot beëindiging.**
- Stappen: aanmelding → bewijs en vergunning gezien (acht genres,
  `kern/aanmeldingen/bewijs.js`) → contract met RTG (`kern/commercie/contract.js`)
  → inrichting → eerste vraag → afdracht en vergoeding → periodieke evaluatie →
  beëindiging met uitgang.
- Rollen: zaak (manager, medewerkers), RTG-kantoor, RTFoundation (30% afdracht).
- Apps en eigenaar: Partner worden (aanmelding), kantoor (toelating), Decision
  Room (besluit), Geld (afdracht), Partner Network (wat de zaak ziet).
- Buiten scope: een leveranciersbeoordeling door RTG (familiebesluit 2).

**Proces 2. Een arrangement van meerdere zaken voor één lid.**
- Stappen: wens van het lid → conciërge stelt samen → elke zaak bevestigt haar
  deel → één belofte aan het lid → uitvoering per zaak → afrekening en verdeling
  → klacht en herstel per deel.
- Rollen: lid, conciërge (RTG), hotel, restaurant, vervoerder.
- Apps: Concierge (eigenaar van de case), Partner Network (deel van de zaak),
  Geld (verdeling), Mall (vraag), TravelOS (logeren is van TravelOS).
- Buiten scope: een contract tussen zaken met aansprakelijkheid en verdeling
  (Experience Composer) is nieuw domein; mededingingsrecht te controleren.

**Proces 3. De horecagroep met meerdere vestigingen in het netwerk.**
- Stappen: concern met vestigingen → per vestiging vragen en onderdelen →
  routeren naar de vestiging met capaciteit → bevestigen → vergelijken per
  vestiging op eigen gegevens.
- Apps: Concern (`kern/concern/`, eigenaar van vestigingen), Horeca, Partner Network.
- Buiten scope: een operationeel vergelijkbeeld over vestigingen ontbreekt
  (feiten-dwars punt 5); routering tussen vestigingen is een besluit.

## Vraagt besluit

1. **Het doel in SCHERMEIGENAAR.**
   - (A, aanbevolen) Bijstellen naar: "De netwerkkant van een zaak: vragen van
     leden die passen, haar deel in cases, samenwerkingen en open klussen, elk
     getal met bron." Kosten: klein.
   - (B) Het doel laten staan en het consortium bouwen. Kosten: groot; nieuw domein.
2. **Experience Composer (arrangement van meerdere zaken).**
   - (A, aanbevolen) Niet vóór V1; als richting vastleggen bij Concierge als
     eigenaar, met een juridische toets op aansprakelijkheid en mededinging.
     Kosten: geen nu.
   - (B) Na V1 bouwen als contract tussen zaken. Kosten: groot.
   - (C) Nooit; elke zaak belooft alleen haar eigen deel. Kosten: geen.
3. **Wie ziet wat binnen de zaak?**
   - (A, aanbevolen) Medewerkers zien tellingen en hun werk; responstijd en
     aanbiedingen met prijs alleen de manager. Kosten: klein.
   - (B) Iedereen met supplierAuth ziet alles (nu). Kosten: geen.
