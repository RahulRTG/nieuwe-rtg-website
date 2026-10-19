# Partner Network (link:partnernetwerk)

**Volledige werkzaamheid:** een partnerzaak (medewerker en manager) ziet op één plek welke vragen van leden bij haar vak en werkgebied passen en wanneer die verlopen, welke case-onderdelen ze de komende week moet leveren in haar eigen tijdzone, welke samenwerkingsvoorstellen en klussen op haar antwoord wachten, en hoe haar eigen vragen verlopen van reactie tot afgerond; Partner Network doet volledig waarvoor het er is als elk getal zijn bron draagt of "niet gemeten" zegt, als elke regel opent waar hij behandeld wordt, en als de zaak nooit gegevens van een andere zaak ziet.

Eigenaar: `zaak.partnernetwerk` (SCHERMEIGENAAR.json, rol eigenaar, doelgroep
zaak). Ingang: `/apps/partner-network.html`, vanuit de werkplek van de zaak
(`supplierAuth`). Doel volgens het register: "Als hotelpartner zien welke
reisintenties passen bij de eigen capaciteit, hoe het consortium van
hotel/vervoer/diner/RTG-regie er gezamenlijk voor staat, en een 'levend contract'
met andere partners openen." Dat doel wijkt af van wat er gebouwd is (zie a.).

Opgesteld op 19 oktober 2026 op tak `appwerkt/workos`; herzien dezelfde avond na
het oordeel "alleen inventaris (2 nu-regels)". Deze herziening voegt zes
verdiepingsfuncties toe (V1-V6, elk met gegevens, rekenwijze, rollen en
acceptatiecriterium) en wijst zes kandidaten met reden af. Dit is een kaart en
geen bouwopdracht.

## a. Inventaris van het bewezen bestaande

**Wat er staat**

| Laag | Pad | Inhoud |
|---|---|---|
| Scherm | `public/apps/partner-network.html`, `public/apps/partner-network.js` | overzicht met tellingen en bron, aandachtslijst, reageren op een vraag van een lid |
| Route | `server/routes/supplier/netwerk.js` | `POST /api/supplier/netwerk/overzicht` (supplierAuth), alleen lezen |
| Kern | `server/kern/partnernetwerk.js` | projectie zonder eigen opslag over vier domeinen; `NIET_GEBOUWD` met redenen |
| Schrijven | `server/routes/supplier.js` r. 85 | `/api/supplier/mall/aanvraag/reageer` (eigenaar Mall); r. 80 `/behandel` voor aanvaarden, afronden, teruggeven |
| Contract | `server/lib/mutatiecontracten-partnernetwerk.js` | idempotent, `NOT_APPLICABLE`; opslag byte-voor-byte gelijk na het overzicht |
| Toetsen | `test/partnernetwerk-scherm.test.js`, `test/partnernetwerk-route.test.js` | |
| Voltooiproef | `scripts/lib/voltooi/partnernetwerk.js` | lid stelt vraag, zaak antwoordt, andere zaak ziet niets |

**Wat de projectie leest** (`kern/partnernetwerk.js`)

| Getal | Bron | Rekenwijze nu | Als de bron ontbreekt |
|---|---|---|---|
| `intentiesOpen` | `kern/mall/aanvragen.js` `voorZaak` | open vragen zonder eigen reactie | "niet gemeten" met reden |
| `intentiesBeantwoord` | idem | vragen met een eigen, niet-ingetrokken reactie | idem |
| `responstijdMin` | idem | mediaan van `reactie.at − aanvraag.at` in minuten | idem |
| `onderdelenOpen` | `/api/supplier/concierge/opdrachten` (`lusVoorZaak`, CON-02 `deelnemerBeeld`) | **alle** actieve onderdelen, ongeacht `stand` | "niet gemeten" |
| `onderdelenVandaag` | idem | `datum` (= `c.van`, de begindatum van de case) gelijk aan de UTC-datum | "niet gemeten" |
| `samenwerkingIn`, `samenwerkingUit` | `kern/samenwerking.js` `mijn` | aantal, ongeacht status | "niet gemeten" |
| `kamersInVerkoop`, `kamersTotaal` | `supplier.rooms` | `available` en totaal | "niet gemeten: geen kamers" |
| `klussenOpen` | `db.data.tickets[code]` | status ≠ `klaar` | altijd gemeten |

Aandacht: de eerste 5 wachtende vragen, 5 onderdelen van vandaag, 5 open
klussen, elk in de volgorde van de bronlijst.

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

**Afwijkingen tussen doel, scherm en code** (gelezen, niet beproefd)

- Het register zegt "hotelpartner", "consortium" en "levend contract". De code
  bedient elke zaak en bouwt bewust geen consortium (open, workos.md par. 9).
- "Vandaag" is de UTC-datum (`nu().toISOString().slice(0, 10)`). De Mall loopt
  van Haarlem tot Ibiza; `kern/tijdzone.js` kent de zone van de zaak al
  (`nuBijZaak`), maar de projectie gebruikt hem niet (open, workos.md par. 9).
- `onderdelenOpen` telt elk actief onderdeel, ook `bevestigd` en `geleverd`.
  `kern/bureau/lus-regels.js` r. 94-95 noemt alleen wat niet bevestigd of
  geleverd is "open". Nieuw gevonden.
- `onderdelenVandaag` vergelijkt met `c.van`, de begindatum van de hele case.
  Een onderdeel op dag twee van een meerdaagse case staat op dag één bij
  "vandaag". Het onderdeel zelf draagt alleen een tijd (`o.van`, "HH:MM"). Nieuw gevonden.
- `responstijdMin` rekent met `reactie.at`, dat bij een tweede reactie van
  dezelfde zaak wordt overschreven (`Object.assign(eigen, r)` in
  `kern/mall/aanvragen.js`), en met `aanvraag.at`, dat bij `wijzig` en
  `heropen` opnieuw wordt gezet. De mediaan meet dus de laatste bewerking op de
  laatste versie, niet de eerste reactie. Nieuw gevonden.
- De aandachtslijst neemt de eerste 5 wachtende vragen in bronvolgorde. Nieuwe
  vragen staan vooraan (`unshift`), dus juist de vragen die het eerst verlopen
  vallen buiten beeld. Nieuw gevonden.
- `samenwerkingIn/Uit` telt voorstellen tussen een creator en een leverancier
  (`kern/samenwerking.js`: "Een samenwerking loopt tussen een creator en een
  leverancier"). Het scherm noemt het "samenwerkingen met andere partners".
- Een route waarmee de zaak een conciërge-onderdeel bevestigt of weigert, is niet
  gevonden; `/api/supplier/concierge/opdrachten` is de enige zaakroute.

## b. Marktvergelijking

Partner Network lijkt het meest op partner relationship management (PRM). Echte
merken alleen ter vergelijking. Elke regel komt uit een zoeksamenvatting en is
**(te controleren)**.

| Leider | Wat achter de betaalmuur zit | Hebben wij het | Bron (19-10-2026) |
|---|---|---|---|
| Salesforce Partner Ecosystem Management ($50 per partnerlid) / PRM (oud: $25) | partnerportaal, deal registration, deal scoring vanaf Enterprise | half: de zaak ziet vragen en antwoordt; geen deal registration, scores bewust niet; V1 geeft een trechter zonder score | **(te controleren)** https://www.salesforce.com/sales/partner-relationship-management/pricing/ (via zoektool, live te controleren; [zeer oud] voor de PRM-prijs) |
| PartnerStack Launch (~$1.000 p.m.) / Growth | deal registration, uitbetalingen; LMS, MDF | nee: geen uitbetaling aan partners via dit scherm; provisie en afdracht wonen in Geld en `kern/commercie/` | **(te controleren)** https://partnerstack.com/pricing (via zoektool, live te controleren; [afwijkend]) |
| Impartner Enterprise (offerte) | partnerportaal, onboarding, MDF, rapportage | half: onboarding via Partner worden en het kantoor; geen MDF | **(te controleren)** https://impartner.com/request-prm-pricing/ (via zoektool, live te controleren) |

Wat de markt niet heeft: een getal dat zonder bron niet op het scherm komt, en
vragen van eindklanten die op codenaam binnenkomen in hetzelfde huis als de partner.

## c. Analyse van het volledige domein

**Hoe partnerwerk echt werkt**

- *Particulier.* Het lid is de vrager (Mall-vraag, conciërge-wens). Hij gebruikt
  Partner Network niet; hij ziet de antwoorden in de Mall of zijn case.
- *Professioneel.* Een zzp-partner (gids, chauffeur, creator) wil weten welke
  vragen bij hem passen, wat hij heeft toegezegd, wat vandaag en deze week moet,
  en welke vraag bijna verloopt.
- *Organisatie.* Een hotel, restaurant of vervoerder met personeel wil zien wat er
  voor de zaak klaarligt, wie reageert en hoe snel, hoeveel reacties tot een
  opdracht leiden, en met welke andere partners hij samen een dienst levert (een
  arrangement: hotel + diner + vervoer).
- *Samenwerking tussen zaken.* Een arrangement vraagt een afspraak: wie belooft
  wat aan het lid, wie is aansprakelijk, hoe wordt verdeeld. Dat is precies wat
  NIET_GEBOUWD noemt ("geen gezamenlijk contract").

**Wettelijke en normatieve eisen.** Geen primaire tekst is voor deze kaart zelf
gelezen; elke regel is **(te controleren)** en wordt hooguit een signaal, nooit
een weigerregel.

| Eis | Bron | Betekenis |
|---|---|---|
| Betaaltermijn B2B (art. 6:119a BW) **(te controleren)** | https://ondernemersplein.kvk.nl/betalingstermijn-incassokosten-en-wettelijke-rente/ | Afdrachten tussen RTG en partners hebben een termijn. De betaling is van Geld. |
| Algemene voorwaarden: terhandstelling (art. 6:231 e.v. BW) **(te controleren)** | https://www.acm.nl/nl/verkoop-aan-consumenten/de-koop-sluiten/algemene-voorwaarden-aanbieden | Een antwoord van een zaak dat een aanbod is, hoort naar de voorwaarden van de zaak te verwijzen (Mall). |
| Verwerkersovereenkomst (AVG art. 28) **(te controleren)** | https://autoriteitpersoonsgegevens.nl/nl/over-privacy/persoonsgegevens/bewaren-van-persoonsgegevens | Een zaak ziet een codenaam en een vraag. Of de verhouding RTG-zaak verwerker of gezamenlijke verantwoordelijkheid is, is niet in de bronnen gevonden. |
| Spam: toestemming vooraf (art. 11.7 Tw) **(te controleren)** | https://www.acm.nl/nl/verkoop-aan-consumenten/reclame-en-verleiden/spam-voorkomen-uw-reclame | Partner Network geeft de zaak geen weg om een lid buiten zijn vraag te benaderen, en geen van de verdiepingen maakt die weg. |
| ISO 27001 A.5.19-5.23 leveranciersrelaties **(te controleren)** | https://www.dqsglobal.com/blog/new-iso-27001-2022-key-changes (secundair) | Normatief, voor RTG als organisatie: partners die ledengegevens zien, horen in een leveranciersbeoordeling. |
| ISO 9001 8.4 externe leveranciers **(te controleren)** | https://www.lrqa.com/en/latest-news/iso-9001-publication-date-confirmed/ | Normatief: prestatie van partners meten, alleen over de eigen zaak. |
| Mededingingsrecht bij gezamenlijke prijzen in een arrangement | niet in de bronnen gevonden | Te controleren voordat een Experience Composer gezamenlijke prijzen laat afspreken. |

**Wat dat betekent voor software.** Elk getal met bron (bestaat). Tijd in de
zone van de zaak. Prestatie meten mag alleen over de eigen zaak en nooit
vergelijkend over andermans gegevens; een aandeel pas vanaf een minimum aantal.
Een arrangement vraagt een contract tussen zaken met een verdeling, en dat is
een nieuw domein.

## d. Functiecatalogus L1–L6

In de kolom Bak staat "nu · herstel" voor een fout of een belofte die de code
niet waarmaakt, en "nu · verdieping" voor nieuwe diepte binnen de huidige scope.

### L1 Persoonlijk (de medewerker van de zaak)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| "Vandaag" in de zone van de zaak | half; UTC | `s.tijdzone` of het land van de zaak via `kern/tijdzone.js` `nuBijZaak` | datum = lokale datum bij de zaak; zone `aangenomen` staat erbij | een zaak zonder land valt terug op de huiszone (`zaakZoneOfHuis`) | medewerker bij openen | supplierAuth | | Een onderdeel van vandaag staat in de lijst, ook om 00:30 in Amsterdam of Ibiza | klein | nu · herstel |
| V2 Verloopklok op wachtende vragen | ontbreekt; de oudste vragen vallen nu juist buiten de top 5 | `voorZaak().aanvragen[].at`, `wanneer`; `DAGEN_GELDIG` = 30 uit `kern/mall/aanvraag-acties.js` | verloopt op `at` + 30 dagen; sleutel = het vroegste van verloopmoment en gewenste datum `wanneer`; sorteer daarop; signaal "verloopt over N dagen" als N ≤ 3, "gewenste datum over N dagen" als N ≤ 2 | `at` wordt bij `wijzig` opnieuw gezet; dan telt de nieuwe termijn, en dat is ook wat de Mall afdwingt | iedereen met supplierAuth, bij openen | supplierAuth | vraag zonder `wanneer`: alleen het verloopmoment | Een vraag van 28 dagen oud staat bovenaan met "verloopt over 2 dagen", ook als er 12 nieuwere vragen zijn | klein | nu · verdieping |
| V3 Week vooruit voor case-onderdelen | ontbreekt; alleen "vandaag" | `deelnemerBeeld`: `datum`, `van`, `duurMin`, `personen`, `stand`, `discreet` (`kern/bureau/lus-regels.js` r. 57-71) | per dag de komende 7 dagen in de zone van de zaak: aantal, met per regel tijd, aantal personen en stand; "open" = stand niet `bevestigd` of `geleverd` | `datum` is de begindatum van de case; bij een meerdaagse case staat erbij "case begint op …" | medewerker en manager | supplierAuth; alleen de velden van CON-02, niets erbij | `discreet`: het scherm toont "verrassing, niet benoemen tegen gasten" en geen extra velden | Een restaurant ziet vrijdag "2 onderdelen, 1 nog niet bevestigd, 19:30, 6 personen", en niets van de case daarbuiten | klein | nu · verdieping |
| Op een vraag reageren | bestaat | Mall `reageer` | eigenaar Mall; één reactie per zaak | | lid, direct | supplierAuth plus het routebeleid van de zaak (`req.routeBeleid`) | verlopen vraag | Mijn antwoord staat één keer bij het lid, ook na een dubbele tik | klein | bestaat |

### L2 Professioneel

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Responstijd uit de eerste reactie | half; meet de laatste bewerking | `voorZaak().aanvragen[].verloop` (eigen regels `door` = zaakcode en regels `door` = `'lid'`), `at` | per vraagversie: eerste eigen `reageer`-regel min het begin van die versie (`at` van de laatste `wijzig`/`heropen` van het lid ervóór, of `aanvraag.at` als die er niet is); mediaan in minuten | het begin van versie 1 gaat verloren als het lid later wijzigt (`at` wordt overschreven); zulke reacties tellen als "niet gemeten" en het aantal staat erbij | manager | `managerOnly` (besluit 3) | minder dan 3 reacties: "te weinig om te rekenen" | Een zaak die na 10 minuten reageerde en haar tekst een dag later aanpaste, houdt een responstijd van 10 minuten | klein | nu · herstel |
| `onderdelenOpen` telt alleen wat open is | half; telt alles | `stand` per onderdeel | open = stand niet `bevestigd` en niet `geleverd`, gelijk aan `lus-regels.js` r. 94-95 | geen | medewerker | supplierAuth | `kapot` telt als open | Een bevestigd onderdeel telt niet meer bij "open" | klein | nu · herstel |
| V1 Trechter van de eigen vragen | ontbreekt | `voorZaak().aanvragen` (bevat altijd elke vraag waarop de zaak reageerde), per vraag de eigen reactie (`gekozen`, `ingetrokken`), `status`, eigen `verloop`-regels (`aanvaard`, `afronden`, `teruggeven`, `intrekken`) | over de laatste 90 dagen (zone van de zaak): gereageerd → gekozen → in behandeling → afgerond; daarnaast: teruggegeven, reactie ingetrokken door de zaak, vervallen doordat het lid wijzigde (`ingetrokken` zonder eigen `intrekken`-regel), nog open; alleen aantallen, een aandeel pas vanaf 10 reacties; nooit een vergelijking met andere zaken | `voorZaak` filtert niet op datum; de periode komt uit de eigen `reageer`-regel in `verloop` | manager, bij openen | `managerOnly` (besluit 3) | vraag gesloten door het lid: aparte regel "door het lid ingetrokken" | Met 3 reacties, waarvan 1 gekozen en afgerond, toont het scherm "3 → 1 → 1 → 1" zonder percentage; vanaf 10 reacties staat er ook "30% gekozen" met de periode | klein | nu · verdieping |
| V6 Doorklikken per aandachtsregel | half; alleen vragen zijn hier te beantwoorden | `aandacht[].bron`, `id` | elke regel opent het scherm van zijn eigenaar: vraag in de Mall-werklijst, onderdeel in de conciërge-weergave, klus in de werklijst, samenwerking in de samenwerkingsweergave | of het doelscherm een directe ingang per id heeft: per domein na te gaan | medewerker | rechten van het doeldomein | | Een tik op een klus opent die klus waar ik hem kan afronden | klein | nu · verdieping |
| Conciërge-onderdeel bevestigen of weigeren | niet gevonden als zaakroute | `lusBevestig` bestaat in `kern/bureau/lus-uitvoering.js`, alleen voor het kantoor | eigenaar Concierge; Partner Network linkt alleen | | lid en RTG-regie | manager | | Een zaak kan haar deel van een case bevestigen of weigeren, met reden | middel | later (eigenaar `kantoor.concierge`) |
| Antwoord met voorwaarden | ontbreekt | algemene voorwaarden van de zaak | link naar de voorwaarden bij een aanbod | | lid | | | Een aanbod toont de voorwaarden van de zaak | klein | later (eigenaar `winkel.mall`) |

### L3 Organisatorisch

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Rolverschil medewerker en manager | half; overzicht voor iedereen met supplierAuth | `req.actor.manager` (`kern/leverancier/zaak.js` `managerOnly`) | tellingen, aandacht en week voor iedereen; responstijd, trechter en prijzen in reacties alleen manager | | | `managerOnly` | | Een medewerker ziet zijn werk, de manager ziet ook de prestatie van de zaak | klein | nu · herstel (rolgrens; besluit 3) |
| V4 Samenwerkingsvoorstellen die op antwoord wachten | half; alleen aantallen in en uit | `samenwerking.mijn(s)`: `richting`, `status`, `at`, `ander` (`kern/samenwerking.js` r. 97-101) | in de aandacht: inkomend met status `voorgesteld`, oudste eerst, met leeftijd in dagen; daarnaast "uitgaand zonder antwoord ouder dan 14 dagen"; tellingen per status in plaats van alleen in/uit | de 14 dagen zijn een keuze, geen norm | manager | `managerOnly` voor accepteren (eigenaar samenwerking); zien: supplierAuth | label "met creators", niet "met andere partners" | Een voorstel van een creator van 9 dagen oud staat in de aandacht met "wacht 9 dagen op uw antwoord" | klein | nu · verdieping |
| V5 Klussen naar leeftijd | half; eerste 5 in lijstvolgorde | `db.data.tickets[code]`: `status`, `at`, `text` | open klussen oudste eerst; signaal bij ouder dan 7 dagen; aantal per leeftijdsband (0-2, 3-7, > 7 dagen) | de 7 dagen zijn een keuze | medewerker en manager | supplierAuth | klus zonder `at`: "datum onbekend" | Een klus van 10 dagen staat bovenaan met "10 dagen open", ook als er 20 nieuwere zijn | klein | nu · verdieping |
| Capaciteit uit bestaande bronnen | half (alleen kamers) | horeca-reserveringen en tafels, `/api/supplier/vak/capaciteit` | alleen waar een bron bestaat; anders "niet gemeten" | | manager | | | Een restaurant ziet zijn vrije tafels met bron, of "niet gemeten" | middel | later |
| Vestigingen van één concern | ontbreekt | `kern/concern/` vestigingen | per vestiging de eigen projectie | | concernmanager | scope per vestiging | | De concernmanager ziet het netwerk per vestiging, niet samengeteld zonder bron | middel | later |
| Leveranciersbeoordeling door RTG | ontbreekt | reacties, klachten, onderdelen | alleen over de eigen zaak; nooit vergelijkend getoond aan andere zaken | | RTG-kantoor | | | | middel | vraagt besluit (familiebesluit 2) |

### L4 Domeinintelligentie

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| "Niet gemeten" in plaats van nul | bestaat | | | | | | | | | bestaat |
| Verwachte vraag volgende week | ontbreekt | Mall-vragen van de eigen zaak | telling per week; klasse `advies` met `aannames` en `onbekend` | seizoen, weinig data; `voorZaak` geeft verlopen vragen zonder eigen reactie niet terug, dus de reeks is onvolledig | manager | | minder dan 8 weken historie: niet rekenen | De verwachting staat als advies met aannames, nooit als feit | middel | later |
| Match- en netwerkscores | NIET_GEBOUWD | | | geen onderbouwde berekening | | | | | | niet doen: geen bron, en een score over leden en partners raakt de privacygrens |
| Collectieve patronen over gasten | NIET_GEBOUWD | | | | | | | | | niet doen: privacy op codenamen; zie ook "Geen verslavende patronen" |

### L5 Volledige levenscyclus

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Van aanmelding tot actieve partner | half | `partnerApplications` (kantoor), `/apps/partner-worden.html` | Partner Network leest de stand van de eigen aanvraag | | zaak | | | Een nieuwe zaak ziet in Partner Network waar haar aanmelding staat en wat ontbreekt | klein | later |
| Van vraag tot afgerond antwoord | bestaat (Mall) | Mall-levensloop: open, gegund, in behandeling, afgerond | eigenaar Mall; V1 maakt de stand per zaak zichtbaar | | | | verlopen | | | bestaat |
| Partnerschap beëindigen | ontbreekt | | uitgang van de zaak (`kern/tenant/uitgang.js`) | | | manager | lopende onderdelen eerst afronden | Een zaak die stopt, ziet welke beloften nog open staan | middel | later |

### L6 RTG-samenhang

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Projectie over Mall, conciërge, samenwerking, werklijst | bestaat | vier domeinen | leest, schrijft niets | | | | | | | bestaat |
| Experience Composer (arrangement van meerdere zaken) | NIET_GEBOUWD | zou vragen: contract tussen zaken, verdeling | | aansprakelijkheid, mededinging | | | | | groot | vraagt besluit |
| Afdracht en provisie zichtbaar | ontbreekt | `kern/commercie/allocatie.js`, `kern/commercie/fee.js` | projectie van wat de zaak RTG verschuldigd is, met bron | | manager | | | De manager ziet wat RTG van een onderdeel rekent, met bron | middel | later |

### Afgewezen verdiepingskandidaten, met reden

| Kandidaat | Waarom niet in Partner Network |
|---|---|
| Gemiste vragen (pasten, verliepen zonder reactie) | `voorZaak` geeft een verlopen vraag zonder eigen reactie niet terug (`open(a)` sluit verlopen uit). Het tellen vraagt een nieuwe leesfunctie in de Mall (`winkel.mall`). Bouwbaar, maar bij die eigenaar; Partner Network leest het daarna alleen. |
| Winkans of reactietijd vergeleken met andere zaken | Gegevens van een andere zaak (NIET_GEBOUWD); een vergelijking is ook zonder namen een ranglijst. |
| Kamerbezetting en omzet per kamer | De projectie kent alleen `rooms.available`. Boekingen en logeren zijn van TravelOS; Partner Network wordt geen tweede eigenaar van de kamer. |
| Netwerk-, match- of fitscore | NIET_GEBOUWD: geen onderbouwde berekening. V1 geeft aantallen, geen score. |
| Verwachte vraag volgende week | Te weinig historie per zaak en een onvolledige reeks (zie L4); blijft "later" met klasse `advies`. |
| Afdracht en vergoeding | Eigenaar is `kern/commercie/` en Geld; Partner Network kan het pas tonen als die een leesfunctie per zaak hebben. Blijft "later". |

### Modus LOS

De kerntaak zonder andere apps: zien wat er voor de zaak klaarligt, met bij
elk getal de bron. Als Mall, conciërge en samenwerkingen uit staan, blijft de
werklijst (tickets) als enige gemeten bron. Het scherm zegt per tegel "niet
gemeten" met de reden; dat is al gebouwd en in de voltooiproef getoetst.
Letterlijke schermtekst (u-vorm, zakelijk, aan een zaak):

**Eigen (altijd).** De projectie en de werklijst van de zaak. Als er niets is:
> "Er wacht niets op uw zaak. Elk getal hierboven komt uit de genoemde bron."

**Noodzakelijke platformdiensten.**

| Dienst | Waarvoor | Schermtekst als hij ontbreekt |
|---|---|---|
| Zaaksessie (`supplierAuth`) | elke route | "Uw sessie is verlopen. Meld u opnieuw aan in de werkplek van uw zaak." |
| Rol in de zaak (`req.actor.manager`, na herstel) | trechter, responstijd | "Deze cijfers ziet alleen een manager van uw zaak." |
| Tijdzone van de zaak (`kern/tijdzone.js`) | vandaag, week, verloopklok | "Wij nemen de tijdzone van uw land aan. Stel uw eigen tijdzone in als die anders is." |
| Opslag (lezen) | alles | "Het netwerkoverzicht kon niet worden opgebouwd. Probeer het opnieuw." (bestaat) |

**Optionele koppelingen.**

| App | Wat hij levert | Schermtekst als hij uit staat |
|---|---|---|
| Mall (`winkel.mall`) | vragen, reacties, trechter, verloopklok | "De vraagkant van de Mall is op deze server niet beschikbaar." (bestaat); de knop Reageren verdwijnt en er staat: "Reageren gaat via de Mall en kan nu niet." |
| Conciërge (`kantoor.concierge`) | onderdelen, week vooruit | "De conciërge-lus is op deze server niet beschikbaar." (bestaat) |
| Samenwerkingen (`kern/samenwerking.js`) | voorstellen met creators | "Samenwerkingen zijn op deze server niet beschikbaar." (bestaat) |
| Kamers (`supplier.rooms`) | capaciteit | "Uw zaak heeft geen kamers in RTG; capaciteit van tafels of diensten heeft hier nog geen bron." (bestaat) |

### Modus SAMEN: van vraag van een lid tot onderdeel van een case

1. Een lid zet in de Mall een vraag uit ("diner voor zes, vrijdag, Amsterdam").
   - *Storing:* de vraag past niet bij het genre of het werkgebied van de zaak.
     De zaak ziet haar niet; dat is de bedoeling (`past()` in `kern/mall/aanvragen.js`).
2. De zaak opent Partner Network en ziet de vraag op codenaam bij "wacht", met
   (na V2) "gewenste datum over 2 dagen".
   - *Storing:* de Mall is niet beschikbaar. Tegels staan op "niet gemeten",
     niet op nul. Bewaard: de vraag in de Mall.
   - *Storing (nu):* er wachten 12 nieuwere vragen; deze oudere valt buiten de
     top 5. Herstel via V2.
3. De manager antwoordt met prijs en tekst.
   - *Storing:* dubbele tik of afgebroken verbinding. Er staat één reactie
     (voltooiproef herstelbaar 3/3).
   - *Storing:* de vraag verliep net. De Mall weigert met de reden.
   - *Storing:* hij past zijn tekst een dag later aan. Nu telt de responstijd
     vanaf die aanpassing (H6); na herstel blijft het de eerste reactie.
4. Het lid gunt de zaak. De conciërge maakt een case met een onderdeel voor de zaak.
   De trechter (V1) toont "gereageerd → gekozen".
5. In de week vooruit (V3) staat het onderdeel op vrijdag 19:30, 6 personen,
   stand "genoteerd".
   - *Storing (nu):* tussen middernacht en 1:00 of 2:00 Nederlandse tijd telt
     Partner Network het onderdeel nog bij gisteren (UTC-datum). Bewaard: het
     onderdeel in de case. Herstel H1.
   - *Storing:* de zaak wil het onderdeel weigeren. Een route daarvoor is niet
     gevonden; ze moet de conciërge berichten. Bewaard: het onderdeel, onbevestigd.
6. Een andere zaak opent haar netwerk en ziet dit antwoord niet (voltooiproef stap 4).

**Contract SAMEN (voorstel; `scripts/lib/appcontract.js` is niet gewijzigd).**

```js
samen: {
  functie: 'link:partnernetwerk', familie: 'WorkOS',
  belofte: 'een partnerzaak ziet de vragen van leden die bij haar passen met wanneer ze verlopen, haar case-onderdelen voor de komende week in haar eigen tijdzone en wat op haar antwoord wacht, met bij elk getal zijn bron, en antwoordt op een vraag; een andere zaak ziet er niets van',
  ingang: '/apps/partner-network.html',
  bestanden: ['public/apps/partner-network.html', 'public/apps/partner-network.js',
    'server/routes/supplier/netwerk.js', 'server/kern/partnernetwerk.js', 'server/lib/mutatiecontracten-partnernetwerk.js'],
  scenario: 'scripts/lib/voltooi/partnernetwerk.js',
  ketens: [
    { naam: 'vraag van een lid', uitgeeft: 'reactie via /api/supplier/mall/aanvraag/reageer', ontvangt: 'voorZaak: vragen die passen, met eigen reacties en verloop',
      vorm: 'projectie', eigenaar: 'winkel.mall', toestemming: 'alleen vragen binnen vak en werkgebied (past), op codenaam; routebeleid van de zaak',
      storingen: ['Mall uit: "niet gemeten"', 'vraag verlopen: Mall weigert', 'dubbele tik: één reactie'],
      proef: 'scripts/lib/voltooi/partnernetwerk.js' },
    { naam: 'onderdeel in een conciërge-case', uitgeeft: 'niets (bevestigen bestaat niet voor de zaak)', ontvangt: 'deelnemerBeeld: alleen de velden van CON-02',
      vorm: 'projectie', eigenaar: 'kantoor.concierge', toestemming: 'alleen de eigen onderdelen; discreet bij een verrassing',
      storingen: ['conciërge-lus uit: "niet gemeten"', 'datum in UTC (open, H1)', 'meerdaagse case: begindatum (H3)'],
      proef: 'niet gevonden voor de zaakkant' },
    { naam: 'samenwerkingsvoorstel', uitgeeft: 'niets', ontvangt: 'samenwerking.mijn: in en uit met status',
      vorm: 'projectie', eigenaar: 'zaak.beheer (eigenaar van kern/samenwerking.js niet als eigen capability gevonden; te bevestigen)',
      toestemming: 'alleen voorstellen waarin de zaak partij is', storingen: ['samenwerking uit: "niet gemeten"'], proef: 'niet gevonden' },
    { naam: 'klus in de werklijst', uitgeeft: 'niets', ontvangt: 'tickets van de eigen zaakcode',
      vorm: 'projectie', eigenaar: 'zaak.beheer', toestemming: 'zaakcode uit de sessie, nooit uit het verzoek',
      storingen: ['geen'], proef: 'test/partnernetwerk-route.test.js' }
  ]
}
```

## e. RTG-exclusieve mogelijkheden

| Mogelijkheid | Eigenaar | Capability | Waarom geen markt-app dit kan |
|---|---|---|---|
| Vragen van leden die op codenaam binnenkomen en passen bij vak en werkgebied, met een verloopklok die gelijkloopt met de Mall | Mall (vraag); Partner Network (projectie) | `winkel.mall`, `zaak.partnernetwerk` | Een PRM kent geen eindklant met een eigen account en codenaam in hetzelfde huis, en dus ook niet zijn termijn. |
| Het deel van een zaak in een conciërge-case, een week vooruit, zonder de case te zien (CON-02) | Concierge | `kantoor.concierge`, `zaak.partnernetwerk` (leest) | De zaak ziet precies haar stukje; de markt deelt het dossier of niets. |
| Een trechter van de eigen vragen zonder score en zonder vergelijking | Partner Network | `zaak.partnernetwerk` | Een PRM verkoopt deal scoring en benchmarks; hier is de grens dat een zaak alleen zichzelf ziet. |
| Arrangement van meerdere zaken met één belofte aan het lid | nog geen eigenaar | (Experience Composer) | Alleen RTG kent lid, zaken en case tegelijk; vraagt een contract tussen zaken (besluit). |

## f. Bouwstenen en ontbrekende koppelingen

**Bestaande modules**

- `server/kern/partnernetwerk.js` (projectie, `nietGemeten`).
- `server/kern/mall/aanvragen.js` (`voorZaak`, reacties, verloop) en
  `server/kern/mall/aanvraag-acties.js` (`DAGEN_GELDIG`, `verlopen`).
- `server/kern/bureau/lus-regels.js` (`deelnemerBeeld`, wat "open" is) en
  `server/kern/bureau/lus-uitvoering.js` (`lusVoorZaak`).
- `server/kern/tijdzone.js` (`nuBijZaak`, `zaakZone`).
- `server/kern/samenwerking.js` (creator en leverancier).
- `server/kern/leverancier/zaak.js` (`managerOnly`).
- `server/kern/commercie/allocatie.js`, `fee.js`, `contract.js` (afdracht, vergoeding, contract met RTG).
- `server/kern/concern/` (vestigingen), `server/kern/tenant/uitgang.js` (uitgang).

**Ontbrekende koppelingen**

| Van | Naar | Vorm | Toestemming |
|---|---|---|---|
| conciërge-onderdeel | bevestigen of weigeren door de zaak | route bij Concierge | manager |
| Mall | gemiste vragen per zaak | leesfunctie bij de Mall | eigen zaak |
| Partner Network | aanmeldstand (`partnerApplications`) | projectie | eigen zaak |
| Partner Network | afdracht en vergoeding | projectie | manager |
| horeca/vak-capaciteit | capaciteitstegel | projectie | eigen zaak |

## g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| H1 "Vandaag" in de zone van de zaak | klein | laag | `kern/tijdzone.js` | nu · herstel |
| H2 `onderdelenOpen` telt alleen wat niet bevestigd of geleverd is | klein | laag | geen | nu · herstel |
| H3 Meerdaagse case: label "case begint op …" in plaats van "vandaag" | klein | laag | geen | nu · herstel |
| H4 SCHERMEIGENAAR-doel bijstellen naar wat er staat | klein | laag | besluit 1 | nu · herstel |
| H5 Label "samenwerking met creators" | klein | laag | geen | nu · herstel |
| H6 Responstijd uit de eerste reactie per versie | klein | laag | `verloop` | nu · herstel |
| H7 Rolverschil medewerker en manager | klein | laag | besluit 3 | nu · herstel |
| H8 Reageerknop weg als de Mall uit staat | klein | laag | geen | nu · herstel |
| H9 BEVOEGD-telling voor `/api/supplier/netwerk/overzicht` | klein | laag | `scripts/bevoegdronde.js` | nu · herstel |
| V1 Trechter van de eigen vragen | klein | laag | H7 | nu · verdieping |
| V2 Verloopklok op wachtende vragen | klein | laag | H1 | nu · verdieping |
| V3 Week vooruit voor case-onderdelen | klein | laag | H1, H2 | nu · verdieping |
| V4 Samenwerkingsvoorstellen die op antwoord wachten | klein | laag | H5 | nu · verdieping |
| V5 Klussen naar leeftijd | klein | laag | geen | nu · verdieping |
| V6 Doorklikken per aandachtsregel | klein | laag | ingangen per domein | nu · verdieping |
| Capaciteit uit horeca en vak | middel | middel | bronnen per genre | later |
| Onderdeel bevestigen/weigeren | middel | middel | Concierge | later |
| Gemiste vragen | klein | laag | leesfunctie in de Mall | later (eigenaar Mall) |
| Afdracht en vergoeding zichtbaar | middel | middel | `kern/commercie/` | later |
| Verwachte vraag (L4) | middel | middel | historie | later |
| Experience Composer | groot | hoog | contract tussen zaken | vraagt besluit |
| Scores, benchmarks en collectieve patronen | | | | niet doen |

## h. Toetsbaar eindcontract Beyond Premium

Dit contract vervangt de acht bewijzen van APPWERKT nooit.

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| 1. Breedte | Elke regel in de aandachtslijst opent het scherm waar hij behandeld wordt; trechter, week en verloopklok hebben elk een plek op het scherm | `scripts/schermen.js` | half: alleen vragen zijn te beantwoorden |
| 2. Professionele diepte | "Vandaag" is de datum bij de zaak; een bevestigd onderdeel telt niet als open; de responstijd blijft gelijk na een tekstaanpassing; de oudste wachtende vraag staat bovenaan | `node --test` met een klok op 00:30 Amsterdam (`RTG_KLOK`), een bevestigd onderdeel, een aangepaste reactie en 12 nieuwere vragen | ontbreekt |
| 3. Levenscyclus | Van aanmelding tot beëindiging ziet de zaak haar stand; de trechter volgt een vraag van reactie tot afgerond | voltooiproef uitgebreid met gunnen, aanvaarden en afronden | half |
| 4. Samenwerking en rollen | Andere zaak, lid en uitgelogd geweigerd; een medewerker ziet geen trechter of responstijd als dat zo besloten is | voltooiproef stap 4-5; BEVOEGD | voltooiproef lokaal ja; BEVOEGD NIET_GETEST |
| 5. Domeinintelligentie | Geen getal zonder bron; geen aandeel onder de tien reacties; geen vergelijking met andere zaken; een verwachting draagt klasse `advies` | `test/partnernetwerk-scherm.test.js`, uitgebreid | bestaat voor de bron |
| 6. Los functioneren | Met Mall, conciërge en samenwerking uit staan tegels op "niet gemeten" en niet op nul, en verdwijnt de reageerknop met de tekst uit Modus LOS | `test/partnernetwerk-scherm.test.js`, voltooiproef stap 1 | half: tegels ja, knop nee |
| 7. RTG-ketens | Vraag → antwoord → gunning → case-onderdeel → week vooruit → vandaag, met storingen | ketenproef naar `scripts/ritproef.js` | half: onderdeel bevestigen ontbreekt |
| 8. Bewezen betrouwbaarheid | Alle acht bewijzen centraal BEWEZEN | APPWERKT.json | 3 van 8; 4 lokaal gesloten |

## Twee uitkomsten

### (A) Binnen de huidige architectuur en scope

**HERSTEL**

| Functie | Kosten | Bouwt op | Stand |
|---|---|---|---|
| H1 "Vandaag" in de zone van de zaak in plaats van UTC | klein | `kern/tijdzone.js` `nuBijZaak` | open (workos.md par. 9) |
| H2 `onderdelenOpen` telt alleen niet-bevestigde en niet-geleverde onderdelen | klein | `kern/bureau/lus-regels.js` r. 94-95 | open, nieuw gevonden |
| H3 Meerdaagse case niet als "vandaag" tonen op dag één | klein | `deelnemerBeeld.datum` | open, nieuw gevonden |
| H4 Doel in SCHERMEIGENAAR bijstellen | klein | SCHERMEIGENAAR.json | open (workos.md par. 9) |
| H5 Juist label voor samenwerkingen | klein | `kern/samenwerking.js` | open |
| H6 Responstijd uit de eerste reactie, niet uit de laatste bewerking | klein | `verloop` in `kern/mall/aanvragen.js` | open, nieuw gevonden |
| H7 Rolverschil medewerker en manager | klein | `managerOnly` | open |
| H8 Reageerknop weg als de Mall uit staat | klein | `partner-network.js` | open |
| H9 BEVOEGD-telling | klein | `scripts/bevoegdronde.js` | open |

Gerepareerd in de reparatieronde: niets voor deze kaart.

**VERDIEPING** (zes echte verdiepingsfuncties; details in d.)

| Functie | Gegevens en bron | Rekenwijze | Rollen | Acceptatiecriterium | Kosten |
|---|---|---|---|---|---|
| V1 Trechter van de eigen vragen | `voorZaak().aanvragen`: eigen reactie, `status`, eigen `verloop` | 90 dagen: gereageerd → gekozen → in behandeling → afgerond, plus teruggegeven, ingetrokken, vervallen; aandeel vanaf 10 reacties; nooit vergelijkend | manager | 3 reacties, 1 gekozen en afgerond: "3 → 1 → 1 → 1" zonder percentage | klein |
| V2 Verloopklok op wachtende vragen | `aanvraag.at`, `wanneer`, `DAGEN_GELDIG` (30) | sorteren op het vroegste van verloopmoment en gewenste datum; signaal bij ≤ 3 of ≤ 2 dagen | iedereen met supplierAuth | een vraag van 28 dagen staat bovenaan met "verloopt over 2 dagen", ook met 12 nieuwere | klein |
| V3 Week vooruit voor case-onderdelen | `deelnemerBeeld` (CON-02-velden) | per dag, 7 dagen, in de zone van de zaak; open = niet bevestigd of geleverd | medewerker en manager | vrijdag: "2 onderdelen, 1 nog niet bevestigd, 19:30, 6 personen", niets van de case daarbuiten | klein |
| V4 Samenwerkingsvoorstellen die wachten | `samenwerking.mijn`: richting, status, at | inkomend `voorgesteld` oudste eerst; uitgaand zonder antwoord > 14 dagen; tellingen per status | zien: supplierAuth; beslissen: manager | "wacht 9 dagen op uw antwoord" | klein |
| V5 Klussen naar leeftijd | `tickets[code]`: status, at | oudste eerst; banden 0-2, 3-7, > 7 dagen | medewerker en manager | een klus van 10 dagen staat bovenaan, ook met 20 nieuwere | klein |
| V6 Doorklikken per aandachtsregel | `aandacht[].bron`, `id` | ingang van de eigenaar per soort | rechten van het doeldomein | een tik op een klus opent die klus | klein |

Zes kandidaten zijn afgewezen; de reden per kandidaat staat in d. onder
"Afgewezen verdiepingskandidaten".

**Later:** capaciteit per genre, onderdeel bevestigen (Concierge), gemiste vragen
(Mall), afdracht zichtbaar, verwachte vraag (middel elk; horeca,
`kern/vakwerk/`, `kern/bureau/`, `kern/commercie/`, `kern/fiscaal/zekerheid.js`).

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
     leden die passen en wanneer ze verlopen, haar deel in cases voor de komende
     week, wat op haar antwoord wacht en hoe haar eigen vragen verlopen, elk getal
     met bron." Kosten: klein.
   - (B) Het doel laten staan en het consortium bouwen. Kosten: groot; nieuw domein.
2. **Experience Composer (arrangement van meerdere zaken).**
   - (A, aanbevolen) Niet vóór V1; als richting vastleggen bij Concierge als
     eigenaar, met een juridische toets op aansprakelijkheid en mededinging.
     Kosten: geen nu.
   - (B) Na V1 bouwen als contract tussen zaken. Kosten: groot.
   - (C) Nooit; elke zaak belooft alleen haar eigen deel. Kosten: geen.
3. **Wie ziet wat binnen de zaak?**
   - (A, aanbevolen) Medewerkers zien tellingen, aandacht en de week; responstijd,
     trechter en reacties met prijs alleen de manager. Kosten: klein.
   - (B) Iedereen met supplierAuth ziet alles (nu). Kosten: geen.
4. **Wie is de eigenaar van samenwerkingen tussen creator en leverancier?**
   `kern/samenwerking.js` heeft geen eigen capability in SCHERMEIGENAAR.
   - (A, aanbevolen) `zaak.beheer` (de werkplek van de zaak), met Partner Network
     als lezer. Kosten: klein (registerregel).
   - (B) Een eigen capability voor samenwerkingen. Kosten: klein; een extra
     eigenaar in het register.
