# Het afbouwprogramma — wat RTG heeft toegezegd, afbouwen en bewijzen

*Eigenaarsbesluit van 11 oktober 2026. Dit document legt het besluit vast, de
grenzen die eruit volgen, de vier werkstromen die het uitvoeren, en de
inventaris die zegt wat er binnen de scope valt. Het is LEIDEND voor de verdere
ontwikkeling van RTG.*

Let op de naam. `afbouw` is in dit huis al bezet door de releaseketen
(`npm run afbouw:software`, `scripts/afbouwoordeel.js`: *is deze commit
bewezen?*). Dit document gaat over iets anders, namelijk over de SCOPE van wat
er nog gebouwd en bewezen wordt, en heet daarom het afbouwPROGRAMMA. Het woord
`toezegging` is ook bezet (een financiële belofte van het mecenaat in de
geldgraaf, `POLITIEK.md` par. 0), dus in code heet de inventaris
`toezegklassen`.

## 0. Het besluit

> **Het doel: alles wat RTG daadwerkelijk heeft toegezegd volledig ontwikkelen,
> integreren en bewijzen. Niet alles wat ooit in een document is genoemd.**

De eigenaar koos optie D: het volledige ontwikkelprogramma, met meerdere agents
en parallelle werkstromen waar dat technisch verantwoord is, en met een
gecontroleerde uitvoering van A, B en C naast elkaar. Na het vastleggen begint
de uitvoering. Dit is geen nieuwe audit- of documentatiefase; elke ronde levert
een meetbare softwareverbetering op.

## 1. De drie grenzen, definitief

Dit zijn harde architectuur- en productgrenzen. Ze gaan voor elke functie: waar
een functie botst met een grens, vervalt de functie (de regel van `LEVEN.md`
par. 2, hier huisbreed).

1. **Scope.** Alleen toegezegde functionaliteit wordt gebouwd. Wat afgewezen is
   blijft afgewezen, met de grens die het afwees (het `Asset`-, `Moment`- en
   `Career`-object, de `humans`-tabel, een score of ranglijst op een mens, de
   fanladder, `EXECUTE_LOW_RISK`, de overtuigings-API, een token op een publieke
   chain). Wat een besluit of een externe voorwaarde vraagt, blijft geblokkeerd
   tot die voorwaarde AANTOONBAAR vervuld is. `LEVEN.md` en de huisregels uit
   `CLAUDE.md` blijven leidend.
2. **Integratie.** De vier werelden (LivingOS, WorkOS, TravelOS, FoundationOS)
   houden hun eigen domeingrenzen en gegevensverantwoordelijkheid. Integratie
   gebeurt via projecties (de vorm van `kern/levensgraaf/graaf.js`) en via
   platformvermogen (identiteit, bevoegdheid, envelop, uitvoering, bewijs), nooit
   via één gedeeld datamodel. Privacy, toestemming, bevoegdheid en bewijs blijven
   verplicht.
3. **Menselijke regie.** Geen stilzwijgende overdracht van werkgegevens,
   privébudgetten of andere gevoelige informatie. Wat een tweede persoon bereikt
   (uitnodiging, bericht, boeking, betaling) wordt klaargezet en een mens
   bevestigt. Geld verlaat het huis nooit automatisch.

## 2. De bewijsregel, en wat er niet mag

**Geen enkele agent markeert een product als voltooid op basis van alleen eigen
toetsen of documentatie.** Het bewijs moet reproduceerbaar zijn via de bestaande
meetinfrastructuur: `APPWERKT.json` (`scripts/appwerkt.js`, de acht bewijzen uit
`BETROUWBAARHEID.md`) en de ketenproeven (`tafelproef`, `ritproef`,
`toelatingsproef`, `adamproef`, `lusproef`, `momentproef` en wat erbij komt).
Een bewijs dat je weglaat leest als een bewijs dat je haalt; daarom staat wat
niet gemeten is er met de reden (`GEEN_FIXTURE`, `NIET_GETEST`, `openBekend`,
`nietGebouwd`).

Er komt geen schijnfunctionaliteit: geen knop die niets doet, geen mockresultaat
op een echt scherm, geen backend die niet is aangesloten, en geen AI die beweert
iets gedaan te hebben. En er wordt niets herbouwd wat er al is: aansluiten, niet
uitvinden — en een nieuwe naam wordt eerst tegen de code gehouden.

## 3. Wat dit besluit sluit: de testwereld wordt gebouwd

`BETROUWBAARHEID.md` par. 4 en par. 7 stap 4 zeiden dat de gecontroleerde
testwereld *een besluit vraagt*. **Dat besluit is hiermee genomen: bouwen.**
De vorm ligt al vast en verandert niet: een simulatie-adapter vervangt de rail,
nooit de poort (`MAGNAATLAB.md`); elke adapter heeft een grendel die fail-closed
is; geen vlag in de productieweg; en een simulatie mag nooit een handeling laten
slagen die in het echt niet zou slagen. Daarmee gaan bewijs 3, 5 en 7
(voltooibaar, persistent, herstelbaar) open. Werkstroom B voert het uit.

In de inventaris staat dat als correctie in `TOEZEGKLASSEN.json`: de regel van
par. 7 stap 4 is daar `toegezegd`, met dit besluit als reden. Andere open punten
in `BETROUWBAARHEID.md` (bellen/video in een headless browser, de acht bewijzen
per belofte) blijven wat ze waren.

## 3a. Besluiten ronde 2 (11 oktober 2026)

Vier besluiten van de eigenaar, genomen bij het begin van de tweede ronde. Ze
staan hier zoals ze zijn genomen; niemand verzint er een bij.

**B1 — Vakantiedagen.** Er komt een juridisch gevalideerde Nederlandse
rekenregel, met onderscheid tussen wettelijke en bovenwettelijke dagen,
contracturen, wisselende arbeidsduur en ziekte. WorkOS voert de berekening uit
en controleert de brongegevens. **Tot de juridische toets is afgerond blijft de
relevante productiepoort gesloten.** In de inventaris valt dat onder het
`extern`-item *juridische validatie van het RTG-tijdbeleid* (`VRIJHEID.md`): de
rekenregel mag gebouwd worden, maar gaat niet open voordat die voorwaarde
aantoonbaar vervuld is.

**B2 — Budget van vrienden.** Alleen met uitdrukkelijke toestemming van die
vriend. Rahul ontvangt dan uitsluitend *past* of *past niet* voor een CONCREET
voorstel: geen bedragen, geen saldi, geen vergelijkingen. De uitkomst wordt niet
automatisch met de andere deelnemers gedeeld. (Grens 3: geen stilzwijgende
overdracht van privébudgetten.)

**B3 — Boeken en betalen.** Per deelnemer afzonderlijk. Rahul bereidt voor;
iedere deelnemer bevestigt zelf zijn boeking en zijn betaling. Geen automatische
geldbeweging, en geen verplichting namens een ander zonder geldige bevoegdheid
en bevestiging.

**B4 — De open besluiten in de inventaris.** Eerst vaststellen welke al eerder
besloten zijn, met de bron erbij; alleen werkelijk onbesliste punten gaan opnieuw
naar de eigenaar; agents verzinnen geen beleidsbesluiten. Uitgevoerd in par. 7a
en bijlage A.

## 3b. Besluiten tijdens de integratie (11 oktober 2026)

Genomen tijdens het groen maken van ronde 1 en golf 3. Ook deze staan hier zoals
ze zijn genomen.

**1A — Klokinformatie op de horeca-Vloer.** De Vloer mag de klokinformatie uit
het personeelsdomein lezen (`kernGedeeld` +1, vastgelegd in `NORM.json` met
reden, eigenaar en begrenzing). Alleen de noodzakelijke klokinformatie wordt
gedeeld.

**Klokprivacy (een bestaande grens, geen uitzondering).** Iedere medewerker mag
zien WIE er aanwezig is, niet WANNEER een collega in- of uitklokt. Het in- en
uitkloktijdstip en de klokregels in het logboek gaan uitsluitend naar een
manager. Dat geldt voor elke route en elk kanaal (ook realtime, foutmeldingen,
aantallen, paginering en volgorde), en wordt bij de bron gefilterd: één functie,
geen eigen regel per route.

**De huisregel daaronder.** Informatie die iemand niet mag ontvangen, verstrekt
de server die persoon niet. Verbergen op het scherm is geen bescherming.

**2B — Autorisatie is geen omkeerbaarheid.** Een tweede handtekening veroorzaakt
nooit `omkeerbaar: true`; dat zijn twee verschillende veiligheidsvoorwaarden. De
grens van € 2.500 blijft: daarboven alleen wat aantoonbaar omkeerbaar is. Of iets
omkeerbaar is, wordt per handeling en per betaalrail aangetoond in één gesloten
tabel met een grond per regel; onbekend telt als niet omkeerbaar. Er komt een
uitzonderingsprocedure voor aantoonbaar onomkeerbare transacties, met een aparte
risicogoedkeuring, die nooit beweert dat de transactie terug kan. Zij staat
standaard dicht.

**2C — De incassoronde.** De grens van € 2.500 geldt over het TOTAAL van de
ronde. De uitzonderingsprocedure wordt uitsluitend voor incassorondes
vrijgegeven: per ronde een risicogoedkeuring op naam, door een ander dan de
aanvrager, niet herbruikbaar. Het dossier blijft *onomkeerbaar* zeggen. Voor alle
andere handelingen, ook de teruggave, blijft de grendel dicht.

**3A — Teruggaven onder € 1.000.** Het besluit van 4 oktober blijft: één bevoegd
mens op naam met een passkey, zonder verplichte tweede medewerker. Alle overige
controles blijven gelden.

**4A — Het juridisch toetsingsdossier voor de vakantieregel.** Een volledig
dossier met wetsartikelen, codeverwijzingen, aannames, grensgevallen en
voorbeeldberekeningen. De productiepoort blijft gesloten tot een bevoegde
menselijke beoordelaar de toets heeft afgerond en de vrijgave volgens de
bestaande procedure is goedgekeurd.

**5A — De open besluiten.** De resterende vragen van bijlage A gaan in porties van
ongeveer tien naar de eigenaar, geordend op afhankelijkheden en op hoeveel
ontwikkelwerk ze blokkeren. Per vraag: de bestaande huisregel, de opties, de
gevolgen en een aanbeveling. Er worden geen besluiten verzonnen.

## 3c. Open besluiten, portie 1 (11 oktober 2026)

De eerste tien vragen uit bijlage A, door de eigenaar beslist. Tussen haakjes het
bijlagenummer en de huisregel waar het besluit op rust.

**1 — Herkomst afdwingen (A6; CONTROLPLANE.md, een nieuwe handhaving loopt eerst
mee).** Eerst schaduwmetingen, daarna gefaseerd afdwingen per wereld en per
capability, pas wanneer de benodigde paden aantoonbaar werken en de bestaande
veiligheidscontroles slagen. Onbewezen herkomst wordt nooit stilzwijgend als
bewezen behandeld.

**2 — Privémateriaal achter `/media/:naam` (A10; par. 3b, de server verstrekt niet
wat iemand niet mag ontvangen). Hoge prioriteit.** Direct onderzoeken wat er
toegankelijk is. Privébestanden alleen na autorisatie op de server, eventueel via
kort geldige ondertekende links. Ook publieke caches, oude links, exports en
indirecte toegang nalopen; blootgestelde toegang waar mogelijk intrekken en
beoordelen of eerdere blootstelling een privacy-incident is. Nieuwe privébestanden
worden nooit opnieuw publiek.

**3 — `ENFORCE_EXECUTE` aan de kantoordeur (A24; KANTOOR.md, een spoor dat eindigt
bij een gedeelde code is een alibi).** Eerst individuele passkey-identificatie aan
de deur, dan schaduwmetingen, dan gecontroleerd afdwingen. Een gedeelde
kantoorcode geldt nooit als bewijs van een individuele uitvoerder. Risicovolle
uitvoerende handelingen worden beperkt zolang identiteit en bevoegdheid niet
bewezen kunnen worden.

**4 — Wat een belofte is (A12; BETROUWBAARHEID.md par. 1).** Elk geregistreerd
onderdeel in `MAPPEN` telt voorlopig als één meeteenheid voor de acht bewijzen. De
onderliggende functies, eisen en integraties blijven afzonderlijk traceerbaar.
Samenvoegen of verwijderen van een meeteenheid vraagt een expliciet besluit met
onderbouwing.

**5 — Publiceren namens een maker (A41; MENSNETWERK.md MN-01, en de gesloten lijst
van `kern/vertegenwoordiging/`).** Toegestaan via een expliciete, beperkte en
intrekbare machtiging. Een tiende bevoegdheid komt er alleen als de bestaande
negen dit niet correct kunnen uitdrukken. De machtiging is gebonden aan de maker,
de vertegenwoordiger, de toegestane publicatiehandeling en eventuele inhoudelijke
beperkingen. Geen standaardtoegang, geen onbeperkte publicatierechten, geen
verdere delegatie zonder afzonderlijke bevoegdheid. Elke publicatie laat een
controleerbaar spoor na.

**6 — Adres van een zaak op de kaart (A33; NAVIGATIE.md P-03).** Standaard het
openbare vestigingsadres wanneer dat bedoeld is als bezoeklocatie. Bij
thuiswerkende zzp'ers, thuiszorg, mobiele diensten en andere aanbieders met een
werkgebied wordt nooit automatisch een privé- of woonadres gepubliceerd; daar
geldt het werkgebied of een afzonderlijk goedgekeurde publieke locatie.

**7 — Zoeken zonder netwerk (A36; NAVIGATIE.md B5).** Een adres- en plaatsindex in
het offline kaartpakket, beheersbaar met regionale downloads, versies en updates.
Offline zoeken vraagt geen netwerkverbinding.

**8 — Samen schrijven in Office (A38; `check.js` regel 14, nul externe
runtime-afhankelijkheden).** Eerst het eigen documentmodel en de vereiste
samenwerkingssemantiek. Daarna onderzoeken of een eigen CRDT-implementatie
verantwoord is. Niet meteen een volledige CRDT-engine bouwen. De nul-afhankelijkhedenregel
blijft gelden tenzij de eigenaar afzonderlijk een uitzondering goedkeurt.

**9 — Giftvormen (A21; GIFT.md besluit 2).** Eenmalig, ongeoormerkt is de eerste
vorm. Er wordt niets geactiveerd voordat de ontvangende rechtspersoon, de
geldbestemming, de juridische voorwaarden en een eventueel vereiste ANBI-status
zijn vastgesteld. Geen fiscale toezegging zonder bevestigde status.

**10 — Vergeten en gedeelde kennis (A50; VERDER.md B7, en de AVG).** Persoonsgegevens
en herleidbare informatie worden verwijderd wanneer daar een geldige grond voor is;
algemene, werkelijk geanonimiseerde kennis mag blijven. Alleen de naam verwijderen
is niet genoeg: ook indirecte herkenbaarheid, combinaties van gegevens en
herkomstinformatie worden getoetst. Is de kennis nog herleidbaar en is er geen
geldige grond voor behoud, dan gaat ook die weg.

## 3d. Open besluiten, portie 2 (11 oktober 2026)

**11 — Vijf Foundation-onderdelen (A19; FOUNDATION.md par. 2).** RTG Plan, Apply
Once, Safe Autopilot, Warm Handoff en Process Engine worden gebouwd binnen de
bestaande Foundation-architectuur. Safe Autopilot mag uitsluitend voorbereiden,
bewaken en herinneren, nooit zelfstandig uitvoeren; er wordt een gebruikersnaam
gezocht die geen automatische uitvoering suggereert. Menselijke bevestiging blijft
verplicht waar de huisregels dat voorschrijven.

**12 — Verantwoordelijkheidsgraaf (A25; HDI.md par. 5.1, een projectie en geen
tabel).** Taakeigenaarschap wordt uitsluitend berekend uit bestaande gezaghebbende
bronnen: dienstverband, rooster en de eigenaarsvelden van een domein. Geen nieuw
toewijzingsregister. Spreken bronnen elkaar tegen, dan wordt geen eigenaar
verzonnen: de onduidelijkheid wordt getoond en een handeling die een bewezen
eigenaar vraagt, wordt tegengehouden.

**13 — Betaalmandaat (A1; AFSPRAAK.md, en par. 3b 2B/2C).** Een afzonderlijk
domeinobject naast het contract, met betaalrail, toestemming, reikwijdte,
geldigheid, intrekking en bewijsverwijzingen. De naam botst niet met bestaande
mandaten of machtigingen (`mandaat` en `machtiging` zijn bezet). Een geldig
betaalmandaat is geen algemene toestemming om geld te verplaatsen; de bestaande
betaalpoorten en transactieregels blijven gelden.

**14 — Mensmodel en embeddings (A5; INT-03, HDI.md par. 5.1). Nee, voorlopig.** Geen
afzonderlijk Mensmodel en geen nieuwe opslag van persoonsgegevens als
AI-embeddings. Eerst de toegestane lezer op de bestaande levensgraaf, zonder
centrale persoonsdatabase. Herbeoordeling alleen na aantoonbare werking,
privacytoetsing en een afzonderlijk eigenaarsbesluit.

**15 — Navigatieregister (A27; TIKKEN.md, geen tweede lijst apps).** `MAPPEN` is de
enige bron; de ledenweergave, de Edge-navigatie en de zoekindex worden ervan
afgeleid. Geen tweede applicatieregister.

**16 — Zaakgegevens (A32; NAVIGATIE.md P-05).** Zaken beheren hun ingang,
parkeerinformatie en openingstijden zelf, met passende validatie. Niets wordt
afgeleid uit bewegingsgegevens van bezoekers.

**17 — Rechtenregister voor makers (A30, keuze A; MENSNETWERK.md besluit 3).**
Gebouwd, te beginnen bij AI-gebruik: rechten, toestemming, beperkingen,
geldigheid, intrekking en herkomst, met een conflictcontrole die tegenstrijdige
rechten signaleert en onbevoegd gebruik tegenhoudt. Op de bestaande identiteits-,
bevoegdheids- en bewijsvoorzieningen; geen concurrerend rechtenstelsel. Het
register signaleert technische conflicten maar stelt niet vast wie juridisch
rechthebbende is: bij betwiste rechten geldt menselijke of juridische beoordeling.

**18 — Reiswacht (A44; REIZEN.md, een wachter zonder bron zegt dat hij niet kijkt).**
Opt-in per reis, via de bestaande meldingsvoorzieningen. Zichtbaar welke bronnen
worden gecontroleerd, hoe actueel ze zijn en wat niet wordt bewaakt. De reiswacht
bereidt voorstellen voor maar boekt nooit zelfstandig om, betaalt niet en handelt
niet namens anderen.

**19 — Zelfstandig handelen door de reisassistent (A47; FABRIC.md, B3). Nee.** Rahul
en de reisassistent onderzoeken, plannen, vergelijken en bereiden voor; geen
zelfstandige uitvoering die geld of een tweede persoon raakt. Herbeoordeling pas na
bewezen uitvoeringsroutes en een afzonderlijk besluit.

**20 — Containerbeveiliging (A39; `check.js` regel 14, nul runtime-afhankelijkheden).**
Een vastgepinde, onderhouden image-scanner in CI (bijvoorbeeld Trivy of Grype),
zonder nieuwe runtime-afhankelijkheid. De scan is een verplichte releasepoort voor
relevante ernstige kwetsbaarheden, met een vastgelegde uitzonderingsprocedure,
reproduceerbare uitslagen en een controle op verouderde kwetsbaarheidsinformatie.
Faalt de scanner, dan faalt de poort: hij wordt nooit stil overgeslagen.

## 3e. Open besluiten, portie 3 (11 oktober 2026)

**21 — Bewijs-efficiëntie (A48; VERANDERING.md correcties A en D). Nee, voorlopig.**
Geen nieuwe bewijscache, bewijsmotor, bewijsbudget of efficiëntieratio. De
bestaande incrementele CI-route blijft. Herbeoordeling zodra er genoeg volledig
bewezen routes zijn om betrouwbaarheid en werkelijke kosten te meten.

**22 — Economie (A15; KOSTEN.md, PRIJZEN.md).** Bandbreedtes pas nadat de
trefzekerheid over drie afgesloten maanden is bewezen. Prijsintelligentie mag
adviseren en nooit zelfstandig prijzen wijzigen. Geen individuele
prijsdiscriminatie op betalingsbereidheid. Geen nieuwe economische identiteiten
zonder aantoonbare noodzaak. De belofte van transparante nettoprijzen blijft.

**23 — Product en contract (A26; par. 3c besluit 4, MAATSTAF.md par. 7e).** Elk
onderdeel in `MAPPEN` is één productmeeteenheid voor APPWERKT. Contracten blijven
domeinspecifiek; geen universeel productcontract. Productmeeteenheid,
onderliggende functionaliteit en juridische contractverplichting blijven
onderscheiden.

**24 — Terugval van de relay-boom (A43; STAGE.md).** Eerst gebouwd en getest,
inclusief capaciteit, uitval, herstel en de gevolgen voor bestaande kijkers. Tot
dan blijft de verkoop van uitzendingstickets geblokkeerd.

**25 — Keuring van partnerproducten (A46; APPSTORE.md, de machinepoort keurt nooit
zelf goed).** Een automatische voorkeuring en daarna verplichte menselijke
goedkeuring door RTG. Partners publiceren niets ongekeurd. Elke goedkeuring,
afwijzing en wijziging laat een controleerbaar spoor na; een materiële wijziging
vraagt een nieuwe keuring.

**26 — Interne talentmarkt (A2; ARBEID.md par. 4).** Beperkt tot de eigen
juridische entiteit. Een kandidaatstelling is alleen zichtbaar voor bevoegde
betrokkenen bij de werving; de huidige leidinggevende krijgt niet vanzelf toegang.
Eerst worden de bestaande privacyproblemen uit ARBEID.md hersteld.

**27 — Parallelle migraties (A9; het patroon van het schaduwgrootboek).** De
bestaande bron blijft leidend totdat de nieuwe bron per soort aantoonbaar dezelfde
correcte resultaten levert. Omschakelen alleen na een afzonderlijk besluit per
soort, met bewijs en een veilige terugval.

**28 — Overdracht naar een ander apparaat (A16; LINK.md).** Uitsluitend via een
eenmalige, kortlevende RTG-code, veilig gekoppeld aan de bedoelde sessie en
ontvanger, één keer bruikbaar en daarna of na verloop ongeldig. De server bewaart
geen inhoudelijke voortzetting; tijdelijke technische gegevens alleen voor zover
nodig om de code veilig te valideren en misbruik te voorkomen.

**29 — Kennisdeling tussen conciërges (A13; CONCIERGE.md CON-08).** Eerst tussen
bevoegde RTG-conciërges, zonder gastgegevens, verrassingen of herleidbare
persoonlijke informatie. Een netwerk met externe conciërges of zaken vraagt een
afzonderlijk besluit met eigen bevoegdheids- en privacygrenzen.

**30 — Verborgen dwangmodus (A22; HDI.md, heel of niet). Nee, voorlopig.** Eerst een
dreigingsmodel door deskundigen op het gebied van huiselijk geweld en digitale
veiligheid. Daarna pas het besluit of een werkelijk veilige implementatie mogelijk
is. Geen gedeeltelijke implementatie die een onterecht gevoel van veiligheid geeft.

**Volgorde (eigenaar, 11 oktober 2026).** 1. bestaande privacy- en
autorisatieproblemen oplossen; 2. rode CI diagnosticeren en herstellen; 3. lopende
PR's groen en conflictvrij; 4. menselijke merges voorbereiden; 5. daarna de
goedgekeurde functionele afbouw hervatten. Geen nieuwe grote cloudsessies tot dan.

## 3f. Open besluiten, portie 4 (11 oktober 2026)

De eigenaar nam alle tien de voorgestelde opties over, met aanvullende
voorwaarden. Wat botst met een bestaande grens of juridische goedkeuring mist,
wordt niet geactiveerd.

**31 — Reismarge en aanbetaling (A45; TRAVELCOMMERCE.md, een reisbureau is een
KLANT, geld wordt klaargezet en een mens voert uit). Optie A.** Het bestaande
model blijft, zonder aparte reismarge of aanbetaling. Eerst juridisch onderzoek of
RTG optreedt als bemiddelaar, doorverkoper of reisorganisator en welke
verplichtingen daarbij horen. Een margemodel blijft mogelijk, maar vraagt een
afzonderlijk besluit en een passende juridische inrichting.

**32 — Uitbetalen aan een mens (A28; MENSNETWERK.md CAR-01, WAARDE.md:
uitbetaalbaar hangt aan een bevoegdheid en nooit aan een boolean). Optie A.** Geen
nieuwe uitbetalingsmogelijkheid aan privépersonen tot de besluiten uit GIFT.md en
een juridische toets er zijn. Bestaande rechtmatige zakelijke betalingen via
`PARTNER_SETTLEMENT` blijven binnen hun huidige bevoegdheden. Geen nieuwe
waardeklasse zonder afzonderlijke goedkeuring.

**33 — Navigatie en GPS (A34 + A35; NAVIGATIE.md N11, P-02, P-05). Optie A.**
Navigatie loopt via de bestaande plaatsregels. Locatieverzameling en doorgifte
stoppen zodra de navigatietaak aantoonbaar is afgerond, met een duidelijke
mogelijkheid om opnieuw te starten. Een toets bewijst dat na beëindiging voor die
taak geen nieuwe positiegegevens worden verzameld of opgeslagen; tijdelijke
gegevens verlopen volgens de vastgestelde bewaartermijnen.

**34 — Contextuele Saloon (A37; P-05, PLAATS.md par. 6). Optie A.** Uitsluitend
plaatsfeiten uit bevoegde operationele bronnen, zoals openingstijden of wat de
zaak zelf publiceert. Geen locatiegebonden berichtenstructuur die indirect een
bewegingsgeschiedenis van bezoekers opbouwt.

**35 — Afgeleide feiten tussen werelden (A3; `deel` is een poort, par. 1 correctie
3, par. 3d: een betaalmandaat is geen algemene toestemming). Optie B.** Een wereld
mag een afgeleid feit klaarzetten voor gebruik in een andere wereld. De gebruiker
bevestigt per feit én per bestemming, en ziet vooraf welk gegeven wordt gedeeld,
met welk doel en waar het terechtkomt. Geen automatische overdracht op grond van
een algemene toestemming.

**36 — Leren per codenaam (A4; EDGE.md besluit 3, INT-03, par. 3d over het
Mensmodel). Opties A en B.** Lokaal leren op het toestel binnen de Edge-regels.
Op de server uitsluitend voldoende geaggregeerde analyses met de bestaande
groepsdrempels (`bedrijfsmaat/poort.js`-vorm). Geen individuele serverprofielen
per codenaam. Kleine groepen, herhaalde analyses en combinaties van uitkomsten
mogen een persoon niet alsnog herkenbaar maken (VERDER.md par. 7: celveilig is
niet queryveilig).

**37 — AI-cache (A8; AI-CONTEXT-02, MN-02). Optie B.** Alleen exacte treffers, met
hoedanigheid, codenaam en elke andere noodzakelijke contextgrens in de sleutel.
Eerst in de schaduw: er wordt nooit een gecacht antwoord teruggegeven. Gemeten
worden correctheid, isolatie en de mogelijke besparing. Geen semantische cache
totdat de besmettings- en autorisatietoetsen bewezen zijn.

**38 — Wachtwoordloze eigenaar en sleutel-root (A17 + A18; EIGENAAR.md). Optie A.**
Eerst een volledige herstelproef: herstel moet bewezen zijn bij verlies van een
apparaat, een toegangsmiddel en het e-mailadres. Tot dan blijft de bestaande
authenticatie met verplichte passkey bij zware handelingen. Volledig
wachtwoordloos beheer en een sleutel-root los van het e-mailadres zijn daarna een
afzonderlijk besluit.

**39 — Jeugdcontracten (A29; RUGDEKKING.md: een sporter onder de 18 is geen merk,
MENSNETWERK.md 11). Optie A.** Voorgestelde productgrens: maximaal één jaar, geen
automatische verlenging en geen verborgen exclusiviteit. Bij het bereiken van 18
jaar is een expliciete herbeoordeling en, waar van toepassing, nieuwe instemming
vereist. Looptijd, beëindigingsregeling en herbeoordeling worden juridisch getoetst;
tot die toets is afgerond blijft het afsluiten van nieuwe jeugdcontracten
geblokkeerd.

**40 — Abuse graph (A20; FOUNDATION.md par. 5.6, HDI.md: veiligheidsgegevens zijn
een eigen dataklasse, geen score op een mens). Optie A.** Voorlopig geen abuse
graph. Een toekomstige voorziening vraagt een eigen governanceronde over
doelbinding, gegevenscategorieën, toegang, bewaartermijnen en menselijke controle.
Geen scores op mensen en geen verborgen persoonsprofielen. Bestaande rechtmatige
beveiligingsmaatregelen (zoals de rem in `pin-deur.js`) blijven werken.

## 4. De vier werkstromen

| werkstroom | wat | werkterrein |
|---|---|---|
| A — besluit en inventaris | dit document, en de klassering van de toezeggingen in het bestaande completion-register | `AFBOUWPROGRAMMA.md`, `TOEZEGKLASSEN.json`, `scripts/lib/toezegklassen.js`, het blok `toezegklassen` in `APPWERKT.json` |
| B — testwereld | de ontbrekende testinfrastructuur uit `BETROUWBAARHEID.md` par. 4, zodat alle acht bewijzen meetbaar worden; eerst een kleine representatieve keten, dan breder; alleen geïsoleerde testdata en veilige simulaties voor externe effecten | adapters naast de echte rails, `scripts/` |
| C — integratieproef | de Rome-keten als echte ketenproef over FoundationOS, WorkOS, TravelOS en LivingOS; elke open schakel met oorzaak, eigenaar en benodigde oplossing; schakels sluiten zodra de voorziening er is | een ketenproef in de vorm van `scripts/tafelproef.js` |
| D — productafbouw | bestaande, onafhankelijke producten afmaken waarvoor geen nieuw architectuurbesluit en geen ontbrekende testvoorziening nodig is; voorrang voor werk dat bestaande gebruikersketens werkelijk sluit | per product |

## 5. Coördinatie

- Eén bestaande architectuur en één completion-register: `APPWERKT.json`. De
  inventaris staat daarin als blok, niet ernaast.
- Geen conflicterende wijzigingen tussen agents: elke werkstroom blijft binnen
  zijn werkterrein en hergenereert geen registers die niet van hem zijn.
- Geen omzeiling van veiligheidsgrenzen, en geen automatische merges zonder de
  vereiste controles. Mergen blijft mensenwerk (`ONDERHOUD.md`).
- Elke ronde rapporteert bewezen voortgang (een meting die bewoog), niet alleen
  ontwikkelactiviteit, en registreert de resterende afhankelijkheden en
  blokkades.
- Een poort bewijst alleen zijn eigen bereik (`LAT.md` regel 17): zeg welke poort
  groen staat en wat niet bevestigd is.

## 6. De inventaris: vier klassen

| klasse | wat het betekent |
|---|---|
| `toegezegd` | het huis heeft het beloofd; het wordt gebouwd, geïntegreerd en bewezen met de acht bewijzen |
| `afgewezen-met-grens` | het komt er niet, en de grens die dat zegt staat erbij |
| `vraagt-besluit` | geblokkeerd tot een besluit van de eigenaar aantoonbaar genomen is |
| `extern` | geblokkeerd tot een voorwaarde buiten de code aantoonbaar vervuld is (juridisch, vergunning, certificering, leverancier, netwerk, sleutel) |

De klassen zijn gesloten; `scripts/lib/toezegklassen.js` weigert elke andere.

**Hoe hij gelezen wordt.** Deterministisch waar het kan. De richtingsdocumenten
dragen per onderdeel al een stand (staat, een stap weg, vraagt een besluit,
jaren weg), in een tabel met een stand-kolom, als vetgedrukte cel in een
tabelrij, of achter een kop. Die worden gelezen met de letterlijke regel als
citaat, plus bestand en regelnummer. De stand bepaalt de klasse: staat, een stap
weg en jaren weg zijn `toegezegd` (de stand blijft erbij als tweede as, want
"jaren weg" is toegezegd maar afhankelijk), vraagt een besluit is
`vraagt-besluit`. Een markering in lopende tekst wordt NIET gelezen, omdat daar
niet af te lezen is over welk onderdeel hij gaat; die worden geteld en niet
geraden.

**Wat een oordeel vraagt, staat in `TOEZEGKLASSEN.json`.** Afgewezen en extern
zijn geen markering maar een oordeel. Dat bestand is met de hand en met opzet
klein, en elk item draagt een citaat dat LETTERLIJK op een regel van zijn
document moet staan. Staat het er niet meer, dan is het item rot: het telt niet
stil mee, het staat in `rot`, en `test/toezegklassen.test.js` zakt. Een
geblokkeerd item zegt welke voorwaarde aantoonbaar vervuld moet zijn. Valt een
item op dezelfde regel als een gelezen markering, dan wint het besluitbestand.

**De stand bij lezing** (levende getallen uit `APPWERKT.json`, bijgehouden door
`npm run getallen`): over <!--getal:toezeg.documenten-->157<!--/getal-->
documenten zijn er <!--getal:toezeg.toegezegd-->882<!--/getal--> onderdelen
`toegezegd`, <!--getal:toezeg.afgewezen-->22<!--/getal-->
`afgewezen-met-grens`, <!--getal:toezeg.besluit-->74<!--/getal-->
`vraagt-besluit` en <!--getal:toezeg.extern-->10<!--/getal--> `extern`.
Daarnaast liggen er <!--getal:toezeg.proza-->211<!--/getal--> markeringen in
lopende tekst die bewust niet zijn gelezen.

### 6a. Ronde 2: aangescherpt, en twee assen erbij

De eerste telling stond op 879 toegezegd, 20 afgewezen, 84 vraagt-besluit en 10
extern (993 onderdelen). Drie dingen klopten daar niet, en ze zijn alle drie
regelgebonden gerepareerd (`scripts/lib/toezegklassen.js`,
`scripts/lib/toezegsoort.js`):

- **Een legenda is geen onderdeel.** `CREATE.md` en `KAARTEN.md` verklaren de
  standen zelf in een tabel (`| **vraagt een besluit** | het kan, maar ... |`).
  Die vijf rijen telden als onderdelen. Regel: een tabel met een kolom
  *betekenis* waarvan de stand in de EERSTE kolom staat, is een legenda
  (<!--getal:toezeg.legenda-->5<!--/getal--> rijen). Een tabel met een
  betekeniskolom en de stand achteraan (`BENOEMING.md` par. 2) is een echte lijst
  en blijft geteld.
- **Een rij die zichzelf afwijst is geen toezegging.** *"Als engine of autoriteit
  komt hij er niet"* (`EDGE.md` par. 9 punt 50) en *"botst met de
  bewaartermijnen"* (`VERANDERING.md` par. 3 punt 17) stonden als toegezegd omdat
  hun stand "jaren weg" was. De formule is met opzet smal: een voornaamwoord dat
  naar het onderdeel zelf wijst (*komt hij er niet*) of een botsing met een grens
  (*botst met de ...*). Een bredere vorm (*er komt geen ...*) ving zes rijen die
  een voorwaarde stellen en niets afwijzen; die zijn nagelezen en blijven
  toegezegd. Uitslag: <!--getal:toezeg.afgewezenInRij-->2<!--/getal--> rijen.
- **Wat elders al besloten is, telt niet als open.** Zie par. 7a.

**De tweede as: SOORT.** Vier soorten, gesloten, plus een rest die nooit wordt
opgeteld:

| soort | regel | aantal |
|---|---|---|
| product | een plek die een mens opent: app, scherm, deck, cockpit, of een eigen "RTG Naam" | <!--getal:toezeg.product-->19<!--/getal--> |
| functie | een korte naamwoordgroep (hooguit acht woorden) zonder enig ander signaal en zonder werkwoord | <!--getal:toezeg.functie-->785<!--/getal--> |
| integratie | een verbinding: brug, koppeling, doorgave, aansluiten, A naar B, tussen apparaten of werelden | <!--getal:toezeg.integratie-->33<!--/getal--> |
| eis | gedrag, grens of garantie en geen bouwbaar ding: een normatieve zin (elke, geen, nooit, mag, moet, blijft) of een rij onder een kop over grenzen of regels | <!--getal:toezeg.eis-->37<!--/getal--> |
| onbepaald | geen regel past, twee regels spreken elkaar tegen, een zin zonder normatief woord, of een bevinding in de verleden tijd; de reden staat per item in `soortGrond` | <!--getal:toezeg.onbepaald-->114<!--/getal--> |

De soort is LEXICAAL: een indeling met een regel, geen oordeel over wat het
onderdeel is. Elk item draagt de regel die vuurde (`soortGrond`), zodat een
verkeerde indeling naar zijn regel te volgen is in plaats van naar een gevoel.
De kruistabel soort x klasse staat in `APPWERKT.json` onder
`toezegklassen.perSoort`; `onbepaald` staat daar als eigen rij en wordt bij geen
soort opgeteld. Een mens kan de soort van een item in `TOEZEGKLASSEN.json`
overschrijven met het veld `soort`; dat is dan zichtbaar als "met de hand".

**De derde as: VOORZIENING.** Een rij noemt vaak zelf de module of keten waar hij
aan hangt (`kern/stuur/mandaat.js`, `lib/keten.js`, de ritproef). Die
verwijzingen worden gelezen en genormaliseerd tot een voorziening, en tegen de
boom gehouden. Zo leest de inventaris niet als bijna duizend projecten maar als
<!--getal:toezeg.voorzieningen-->131<!--/getal--> voorzieningen met hun
onderdelen erachter: <!--getal:toezeg.metVoorziening-->297<!--/getal-->
onderdelen noemen er een, <!--getal:toezeg.zonderVoorziening-->691<!--/getal-->
niet, en die laatste krijgen er geen geraden. De grootste zijn `kern/command` en
`kern/stuur` (elk 32), `kern/commercie` (21), `kern/envelop` en `kern/kosten`
(elk 14); van de ketens noemen de rijen de ritproef en de tafelproef het vaakst.
Elke genoemde voorziening bestaat in de boom.

**Afdrukken tellen niet mee.** `BEWIJS.md`, `FUNCTIES.md`, `GROEPEN.md`,
`ARCHITECTUUR.md`, `WERELDLIJST.md` en de andere afdrukken worden uit een register
geschreven en dragen geen eigen toezegging. Ze stonden wel in de vingerafdruk,
zodat het blok bij elke registerronde vanzelf verouderde. De lijst is die van de
kennisindex (`AFDRUKKEN` en `AFDRUKKOP` in `scripts/kennisindex.js`) en wordt
hier niet overgetypt; het blok noemt de uitgesloten bestanden in
`bron.afdrukkenUitgesloten`.

**Wat hij niet is.** Geen tweede belofteregister: `BELOFTE.json` zegt of de
BESTANDEN achter een belofte bestaan, deze inventaris in welke KLASSE een
onderdeel valt. En geen bewijs: `toegezegd` met stand "staat" is wat het
document beweert. Bewezen is het pas via de acht bewijzen of een ketenproef.

Draaien: `npm run appwerkt:inventaris` werkt alleen het blok bij, zonder
browser, en laat elk ander veld van `APPWERKT.json` byte voor byte staan;
`npm run appwerkt:inventaris:controle` zakt als het blok achterloopt op de
documenten, een citaat rot is of een klasse buiten de vier valt. Een volle
meting (`npm run appwerkt`) schrijft het blok gewoon mee. **Sinds ronde 2 stelt
`npm run check` dezelfde vraag (regel 76)**, met dezelfde functie
(`oordeel` in `scripts/lib/toezegklassen.js`): een controle die alleen draait als
iemand eraan denkt, bewaakt niets. Hij kost ongeveer een halve seconde en laadt
de browsermeter niet.

## 7. Wat geblokkeerd is

De volledige lijst staat in `APPWERKT.json` onder
`toezegklassen.geblokkeerd`, per item met citaat, reden en voorwaarde. De
geblokkeerde items uit het besluitbestand:

| onderdeel | klasse | voorwaarde |
|---|---|---|
| doneerknop en incasso (`GIFT.md`) | vraagt-besluit | besluit 2 van GIFT.md genomen en de giftstand open met wallet en vorm |
| verborgen dwangmodus met tweede pincode (`HDI.md` par. 5.7) | vraagt-besluit | threat model, en het besluit om hem heel te bouwen |
| B7, vergeten tegenover collectieve kennis (`VERDER.md`) | vraagt-besluit | de eigenaar kiest een van de twee opties |
| uitbetalen aan een mens, CAR-01 (`MENSNETWERK.md`) | vraagt-besluit | het juridische besluit, na GIFT.md |
| de acht bewijzen per belofte (`BETROUWBAARHEID.md` par. 7 stap 6) | vraagt-besluit | welke ingangen samen een belofte vormen |
| ANBI-status van de RTFoundation (`GIFT.md`) | extern | beschikking van de Belastingdienst |
| juridische toets machtigingstekst (`GIFT.md`) | extern | een jurist |
| eigen betaaltoken buiten het gesloten circuit (`TOKEN.md`) | extern | EMI-vergunning bij DNB of een vergunninghoudende EMI |
| externe security-audit en pentest (`PRODUCTION.md`) | extern | rapport van een externe auditor |
| echte betaalcertificering (`PRODUCTION.md`) | extern | betaalprovider en PCI-scope |
| juridische validatie van het tijdbeleid (`VRIJHEID.md`) | extern | een arbeidsjurist |
| rechtspersoon en statuten DemocratieOS (`POLITIEK.md`) | extern | notaris en jurist; een echte partij pas na groene fase B en C, en niet die van de oprichter |
| OSM-bouwer buiten Nederland (`KAARTEN.md`) | extern | een bouwomgeving die de bron mag ophalen |
| vertrouwde sleutellijst op het toestel (`TOESTEL.md`) | extern | een ondertekeningssleutel bij een mens |
| ondertekende modelbytes uit de bron (`TOESTEL.md`) | extern | toegang tot de oorspronkelijke bron |

Daarnaast draagt de inventaris de onderdelen die een document zelf als "vraagt
een besluit" markeert. Een deel daarvan is inmiddels besloten in een ander
document, en dat is een eerlijke beperking van deze meting: het document dat de
markering draagt, is de bron. Een correctie hoort in dat document of als item in
`TOEZEGKLASSEN.json`, nooit stil in de telling. Een voorbeeld dat al bekend is:
`CLAUDE.md` zei dat het genre voor een extern reisbureau niet bestond, terwijl
`TRAVELCOMMERCE.md` par. 9b het op 10 september 2026 bouwde. Daarom staat het
niet bij de geblokkeerde items.

### 7a. Besluit B4 uitgevoerd: wat al besloten was

Alle 84 markeringen *vraagt een besluit* uit de eerste telling zijn nagelopen
tegen latere paragrafen, besluitregisters (*is genomen*, *GENOMEN*, *besloten*,
datums) en de kop van de code. Uitslag:

- **1 was geen onderdeel** maar een legendarij (`CREATE.md`, par. 6a).
- **<!--getal:toezeg.beslotenElders-->9<!--/getal--> waren elders al besloten**, en dragen nu in `TOEZEGKLASSEN.json` het veld
  `besloten` met document, letterlijk citaat en datum. Dat citaat wordt net zo
  streng nagelopen als het citaat van de markering zelf: staat het er niet meer,
  dan is het item rot en zakt de toets. De klasse is wat het besluit oplevert;
  "besloten" is geen vijfde klasse maar een herkomst. Waar het zuiver kon, is de
  markering in het brondocument zelf gecorrigeerd.
- **<!--getal:toezeg.besluit-->74<!--/getal--> zijn werkelijk open** en staan in bijlage A, met de vraag in een zin en
  de opties zoals het brondocument ze noemt.

| markering | besloten in | datum | wat het besluit zegt |
|---|---|---|---|
| `AUTHORITY.md` par. 4 punt 13, eigenaar geen dagelijkse superuser | `AUTHORITY.md` par. 7, A2 | 23 september 2026 | gevoelige lezingen vragen ook van de eigenaar een stap-op en een reden; telt in de schaduw |
| `AUTHORITY.md` par. 4 punt 40, eigen rollen | `AUTHORITY.md` par. 7, A4 | 23 september 2026 | alleen als bundel van bestaande werkwoorden, met een rechtensimulatie vooraf |
| `AUTHORITY.md` par. 6 B6, de auditketen extern verankeren | `MAATSTAF.md` par. 7b | 3 september 2026 | een tweede machine binnen RTG (`server/lib/ankerpost.js`) |
| `AFSPRAAK.md` par. 9, het anker | `MAATSTAF.md` par. 7b | 3 september 2026 | idem; van de drie opties werd het het gescheiden systeem |
| `AFSPRAAK.md` par. 14 punt 16, het anker naar buiten | `MAATSTAF.md` par. 7b | 3 september 2026 | idem |
| `VERANDERING.md` par. 3 punt 21, bewijsboek / SLSA | `MAATSTAF.md` par. 7b | 3 september 2026 | het anker is besloten; release-provenance is werk en geen besluit |
| `CODE.md` par. 3 niveau 3, een bronfragment via een broker | `CODE.md` par. 7, besluit 3 | 3 september 2026 | alleen naar een lokaal model (`LOCAL_AI_URL`) |
| `ARBEID.md` par. 6.1 punt 103, skills-to-training compiler | `ARBEID.md` par. 7a punt 3 | 23 september 2026 | Métier is de bron van vaardigheden; één gedeelde lijst |
| `NAVIGATIE.md` par. 3, doorgave | `NAVIGATIE.md` par. 15.0, N5 | 29 september 2026 | doorgave is de domeingrens; geen centrale reiseigenaar |

Twee eerlijkheden bij deze tabel. Het anker is besloten als **een tweede machine
binnen RTG**; een partij BUITEN het huis is een tweede besluit dat niet is
genomen, en `ankerpost.js` zegt dat in elke stand. Dat tweede besluit is geen
markering in de inventaris en staat daarom niet in bijlage A; het hoort erbij te
komen zodra een document het als onderdeel opvoert. En besloten is niet
gebouwd: van de negen zijn er meerdere nog niet gebouwd (eigen rollen, de
broker), en dat staat er per item bij.

Wat NIET als besloten is geteld, terwijl het erop leek: `MAATSTAF.md` U40 en U41
(*"een statuscontract ... over domeinen heen is niet gerechtvaardigd ... dat is
een antwoord en geen uitstel"*) is een MEETUITSLAG en geen eigenaarsbesluit, en
de vraag wat de eenheid "product" is blijft open; `RTG-V1-RELEASE-READINESS-AUDIT.md`
F6 (de image-scanner) lijkt verder gebouwd dan de markering (`LIVEGANG.md`
beschrijft een `beeldscan` met Trivy of Grype), maar een gebouwde runner is geen
vastgelegd besluit; en `MIJNRTG.md` punt 1 noemt als blokkade dat de doelbinding
nog niet bestaat, terwijl punt 8 van dezelfde tabel nu *staat, in de schaduw*
zegt -- de blokkade is achterhaald, het besluit is niet genomen.

## 8. De eindtoestand

**<!--getal:toezeg.onderdelen-->112<!--/getal--> onderdelen in `APPWERKT.json`
is de huidige registerbasis, niet het definitieve aantal.** Het register meet per
onderdeel uit `MAPPEN`, en die lijst groeit wanneer er een toegezegd onderdeel
bij komt. Het programma is af wanneer:

1. elk onderdeel in de klasse `toegezegd` gebouwd en geïntegreerd is;
2. elk onderdeel uit `MAPPEN` alle acht bewijzen haalt op BEWEZEN, gemeten door
   de bestaande infrastructuur en niet door een eigen toets;
3. elke relevante keten gesloten is in een ketenproef, of een open schakel
   draagt met oorzaak, eigenaar en voorwaarde;
4. elk `vraagt-besluit`- en `extern`-onderdeel er nog staat met zijn voorwaarde,
   tot die aantoonbaar vervuld is, en elk `afgewezen-met-grens`-onderdeel
   afgewezen blijft.

## 9. Wat deze inventaris (nog) niet kan

- Een onderdeel uit een document is nog niet gekoppeld aan een rij van
  `MAPPEN`. Welke documentonderdelen samen één functie vormen, staat nergens in
  de code; dat verzinnen zou een lijst opleveren die stelliger is dan wat het
  huis weet (dezelfde reden als `BETROUWBAARHEID.md` par. 7 stap 6).
- Markeringen in lopende tekst en standwaarden buiten de vier (gedekt, proven,
  half) worden geteld en niet gelezen.
- "toegezegd" komt uit het document. Of het onderdeel er werkelijk is, zeggen de
  acht bewijzen en `BELOFTE.json`, niet deze inventaris.

## Bijlage A. De open besluiten voor de eigenaar (B4)

Wat na par. 7a werkelijk open is: <!--getal:toezeg.besluit-->74<!--/getal-->
onderdelen, samengebracht onder de vraag die ze delen. Per vraag de opties zoals
het BRONDOCUMENT ze noemt, met de prijs als het document die noemt; waar het
document geen opties noemt, staat dat er. Er staat met opzet geen aanbeveling van
de schrijver van deze bijlage bij: een aanbeveling hier zou een beleidsbesluit
zijn dat een agent heeft genomen. Waar het brondocument zelf een optie aanbeveelt,
staat dat erbij als *(aanbevolen in de bron)*. `test/toezegklassen.test.js`
houdt vast dat elk open onderdeel uit de inventaris in deze bijlage staat.

| # | onderdelen (document: onderdeel) | de vraag | opties zoals de bron ze noemt |
|---|---|---|---|
| A1 | AFSPRAAK.md: BillingMandate; AFSPRAAK.md: Het betaalmandaat is een eigen object | Wordt het betaalmandaat (RTG mag via een rail innen) een eigen object naast het contract? | Geen opties genoemd. De bron: samenvoegen kost later een herbouw bij SEPA, kaart-recurring, wallet en terugboeking, en het hangt aan de terugstortstand. |
| A2 | ARBEID.md: 104 interne talentmarkt | Welk vacaturebereik krijgt een interne talentmarkt, en wie ziet een interne kandidaatstelling? | De bron noemt "alleen de eigen entiteit" als bereik, en eerst par. 4 punt 2 en 3 repareren. |
| A3 | ARBEID.md: 140 consentbrug tussen werelden | Mag een feit dat in de ene wereld wordt afgeleid (taalvaardigheid uit TravelOS) in een andere worden gedeeld? | Geen opties. Vandaag kan: het lid zet het feit zelf in zijn ledger en deelt het. |
| A4 | ARBEID.md: 118 voorspelde handeling, nooit de beslissing | Mogen gebruikstellingen per codenaam worden bijgehouden om uit gedrag te leren? | Geen opties. Voorspellen zonder leren kan nu; `EDGE.md` besluit 3 staat lokaal leren op het toestel al toe, de servervariant is de open vraag. |
| A5 | ARBEID.md: 126 geheugen met reikwijdtes; ARBEID.md: 127 herkomst van geheugen; ARBEID.md: 129 levenscyclus van embeddings; INTELLIGENTIE.md: 1 Mensmodel (zes geheugensoorten) | Komt er een Mensmodel (geheugen over een mens), en worden persoonsgegevens ge-embed? | Geen opties. De bron (INT-03): het hangt aan de codenaam, met bewaartermijn en deel-poort, en het besluit is niet terug te draaien nadat het een keer is genomen. |
| A6 | ARBEID.md: 123 sandboxing | Gaat `RTG_HERKOMST_AFDWINGEN` om, per wereld? | Aan: gemeten prijs, een lid gaat van 120 naar 36 AI-paden en een zaak van 53 naar 9 (`INTELLIGENTIE.md` par. 4). Uit: zoals nu. |
| A7 | ARBEID.md: 130 hybride AI met een router | Mag de uitwijk naar een extern model per werksoort door beleid worden gestuurd in plaats van door capaciteit? | Geen opties. Een router op prijs of regio staat op jaren weg (`ECONOMIE.md` par. 9). |
| A8 | ARBEID.md: 132 semantische cache | Komt er een semantische cache? | Geen opties. De bron noemt een begin: exacte treffers met de hoedanigheid in de sleutel (AI-CONTEXT-02), eerst in de schaduw. |
| A9 | ARBEID.md: 146 parallelle migratie | Welke kant is per soort de waarheid tijdens een parallelle migratie? | Geen opties; per soort te besluiten, op het patroon van het schaduwgrootboek. |
| A10 | AUTHORITY.md: B4 /media/:naam zonder toegangscontrole, een jaar public gecachet | Hoe wordt privémateriaal achter `/media/:naam` beschermd? | De bron stelt voor: eerst meten wat er staat, dan privémateriaal achter een korte, ondertekende link. |
| A11 | AUTONOMIE.md: Lenzen; AUTONOMIE.md: Independent Critic | Worden lenzen (verklaarde vragen zonder eigen opslag) en een tegenproef op andere invoer vastgesteld als vorm? | Geen opties. |
| A12 | BETROUWBAARHEID.md: De acht bewijzen per belofte in plaats van per ingang | Welke ingangen vormen samen een belofte? | Geen opties; verzinnen levert een lijst die stelliger is dan wat het huis weet. |
| A13 | CONCIERGE.md: collega-conciërge; CONCIERGE.md: kennis over routes | Komt er een netwerk van vakmensen tussen zaken, met gedeelde kennis over routes? | Geen opties in de tabel; de bron verwijst naar de besluiten B1 tot B5 van `CONCIERGE.md`. |
| A14 | CONNECT.md: Doe, Samen en Maak als eigen ingangen | Worden Doe, Samen en Maak eigen ingangen (tabbladen)? | Geen opties. De bron: vandaag zijn het werkwoorden op een ontdekking, en drie van de vijf tabbladen hebben niets achter zich. |
| A15 | ECONOMIE.md: bandbreedte en betrouwbaarheid tonen; ECONOMIE.md: meer economische identiteiten; ECONOMIE.md: pricing intelligence | Toont RTG een bandbreedte, komen er meer economische identiteiten, en wil het huis prijzen afleiden uit betalingsbereidheid? | Geen opties. Bij pricing zegt de bron dat differentiëren naar betalingsbereidheid prijsdiscriminatie is en botst met de belofte van nettoprijzen; adviseren zonder automatisch te wijzigen noemt de bron de veilige vorm. |
| A16 | EDGE.md: 14 Handoff naar ander apparaat | Mag een voortzetting via de server naar een ander apparaat, en met welke bewaartermijn? | Geen opties. De bron: een eenmalige RTG-code (`LINK.md`) is de weg zonder opslag. |
| A17 | EIGENAAR.md: Wachtwoordloze eigenaar | Verdwijnt het wachtwoord van het eigenaarsaccount? | Geen opties; de bron zet er eerst een echte herstelproef voor (een middag en drie bewaarplekken). Tot dan: wachtwoord plus verplichte passkey op zware handelingen. |
| A18 | EIGENAAR.md: Eigenaar als sleutel-root los van het e-mailadres | Wordt de eigenaar een sleutel-root los van zijn e-mailadres? | Geen opties genoemd. |
| A19 | FOUNDATION.md: 3 RTG Plan; FOUNDATION.md: 13 Apply Once; FOUNDATION.md: 19 Safe Autopilot; FOUNDATION.md: 22 Warm Handoff; FOUNDATION.md: 33 Process Engine | Mogen deze vijf onderdelen bestaan binnen de grens van `FOUNDATION.md` par. 2 (klaarzetten, bevestigen doet de mens)? | Geen opties; per onderdeel noemt de bron de grens (klaarzetten en niet uitvoeren, tekenen per aanvraag, verzenden doet de mens). |
| A20 | FOUNDATION.md: 40 Abuse Graph | Komt er een abuse graph? | Geen opties; de bron: niet zonder aparte governanceronde (par. 5.6). |
| A21 | GIFT.md: Doneerknop en incasso in de RTFoundation | Neemt RTG online giften aan, en in welke vorm (GIFT.md besluit 2)? | Eenmalig, ongeoormerkt (het eenvoudigst). Eenmalig, geoormerkt op een project (een verplichting: een oormerk dat het portaal moet kunnen waarmaken). Periodiek (alleen met een overeenkomst van ten minste vijf jaar). |
| A22 | HDI.md: Verborgen dwangmodus (duress mode) met een tweede pincode | Wordt een verborgen dwangmodus gebouwd? | Heel of niet; eerst een threat model, en wat niet verborgen kan worden staat er hardop bij. |
| A23 | INTELLIGENTIE.md: 12 Shadow Worker in het kantoor | Komt er een Shadow Worker in het kantoor? | Geen opties; de bron: er is geen medewerkersidentiteit, en hij volgt pas daarna. |
| A24 | KANTOOR.md: 1 mens achter de deur: schaduw, dan ENFORCE_EXECUTE | Wordt `ENFORCE_EXECUTE` aan de kantoordeur afgedwongen? | Geen opties; de bron: dat besluit heeft een prijs die iemand moet willen betalen, en de passkey aan de deur maakt hem betaalbaar. |
| A25 | KANTOOR.md: 4 verantwoordelijkheidsgraaf als projectie; PERSONEEL.md: overdracht voltooid; PERSONEEL.md: 8 overdracht via de verantwoordelijkheidsgraaf | Welke bronnen dragen eigenaarschap in de verantwoordelijkheidsgraaf? | Geen opties genoemd. |
| A26 | MAATSTAF.md: U40 Elk product draagt een machineleesbaar contract (PRODUCT-360) dat in de toetsing meeloopt; MAATSTAF.md: U41 Elke capability draagt een contract: objecten, commando's, events, rechten, fouten, herstel, SLO, gebruikers, toetsen | Wat is de eenheid "product", en wat draagt een contract per capability? | Geen opties. De meting zegt dat een contract over domeinen heen niet gerechtvaardigd is (`MAATSTAF.md` par. 7e); de eenheid zelf is niet vastgesteld. |
| A27 | MENS.md: 5 één navigatieregister, consumentenprojectie eruit; MENS.md: 9 humanGoal per route (punt 52) | Komt er één navigatieregister met een consumentenprojectie, en daarna een menselijk doel per route? | Geen opties; raakt `MAPPEN`, `rtg-edge-worlds.js` en de zoekindex, en het tweede is pas zinvol na het eerste. |
| A28 | MENSNETWERK.md: Uitbetalen aan een mens (CAR-01) | Mag RTG geld uitbetalen aan een mens? | Geen opties; het juridische besluit, na de besluiten uit `GIFT.md`. |
| A29 | MENSNETWERK.md: 11 Jeugd: maximumduur, geen verborgen exclusiviteit, herbeoordeling op 18 | Welke maximumduur en herbeoordeling gelden voor een jeugdcontract? | Geen opties genoemd. |
| A30 | MENSNETWERK.md: 14 rechtenregister (gebied, kanaal, looptijd, exclusiviteit, AI-gebruik) | Komt er een rechtenregister (MENSNETWERK.md besluit 3)? | A. Bouwen, beginnen bij AI-gebruik *(aanbevolen in de bron)*; prijs: middelgroot, de conflictcontrole is het werk. B. Alleen registreren, geen controle; sneller, maar een register zonder conflictsignaal is een spreadsheet. C. Niet; het aanbod voor makers blijft administratie zonder bescherming. |
| A31 | MIJNRTG.md: 1 Intent-based beheer ("deel locatie alleen tijdens een rit"); MIJNRTG.md: 13 Policy compiler | Komt er intent-gebaseerd beheer met een policy compiler? | Geen opties. De genoemde blokkade (doelbinding) staat inmiddels in de schaduw (`MIJNRTG.md` punt 8). |
| A32 | NAVIGATIE.md: juiste parkeerplaats, juiste ingang; NAVIGATIE.md: ingang, mogelijkheden, openingstijden; NAVIGATIE.md: 10 parkeren geselecteerd, juiste ingang geselecteerd | Krijgt een zaak velden voor ingang, parkeren en openingstijden? | Geen opties; de bron noemt bestaande vormen (zonesoorten `parking` en `ingang` in het festivaldomein; een hek is één punt per zaak). |
| A33 | NAVIGATIE.md: 3 de zaak is zichtbaar volgens privacy en toelating | Mag een zaak zijn adres op de kaart hebben (P-03; `NAVIGATIE.md` B2)? | Standaard ja, behalve de genres met een werkgebied *(aanbevolen in de bron)*; kost niets nieuws. Alleen na uitdrukkelijke toestemming; het veiligst, de kaart vult zich langzaam. Altijd; het eenvoudigst, en woonadressen komen op de kaart. |
| A34 | NAVIGATIE.md: 9 de positie blijft binnen PLAATS-regels | Gaat de navigatie de plaatslaag gebruiken in plaats van een eigen regime voor ruwe posities? | Geen opties genoemd. |
| A35 | NAVIGATIE.md: 15 de GPS heeft geen taak meer | Stopt de positie zodra de doorgave is gebeurd? | Geen opties; de bron: volgt uit P-02 en schakel 13 (N5 is genomen, deze schakel niet). |
| A36 | NAVIGATIE.md: zoeken op het toestel | Kan er zonder netwerk worden gezocht (`NAVIGATIE.md` B5)? | Een adres- en plaatsindex in het pakket, groter pakket *(aanbevolen in de bron)*. Zoeken blijft online: kleiner pakket, buiten bereik geen zoekfunctie. |
| A37 | NAVIGATIE.md: "contextuele Saloon" | Wat is de contextuele Saloon (`NAVIGATIE.md` B7)? | Een plaatsfeit dat de zaak zelf publiceert *(aanbevolen in de bron, als het dat is)*. Salon-berichten per plek: botst met P-05 en `PLAATS.md` par. 6. |
| A38 | OFFICE.md: 5 besluit: CRDT kopen (eerste dependency) of bouwen; OFFICE.md: P6 Samenwerking en offline; OFFICE.md: 6 besluit over samenwerking (CRDT kopen of bouwen) en over offline per classificatie | Wordt een CRDT gekocht of gebouwd, en welk offlinegedrag geldt per classificatie? | Kopen (de eerste dependency) of bouwen; de bron noemt geen prijs per optie. |
| A39 | RTG-V1-RELEASE-READINESS-AUDIT.md: F6 image-kwetsbaarheidsscan (B6) | Welke image-scanner (`RELEASEKANDIDAAT.md` B6)? | Een externe scanner in CI (Trivy of Grype): een nieuwe afhankelijkheid tegen de nul-dependencylijn. Of een scan buiten de repo door de reviewer, alleen het verslag komt binnen. (`LIVEGANG.md` beschrijft al een `beeldscan`-runner; dat is geen vastgelegd besluit.) |
| A40 | SOFTWAREMARKT.md: INSTANT-label | Komt er een INSTANT-label in de winkel? | Geen opties; de bron: alleen als het gemeten is, nooit als claim. |
| A41 | STAGE.md: Publiceren als bevoegdheid van een manager | Mag een vertegenwoordiger publiceren (een tiende bevoegdheid in een gesloten lijst van negen)? | Geen opties; zonder dit besluit is punt 30 niet te bouwen. |
| A42 | STAGE.md: Event Capsule voor de bezoeker | Welke bewaartermijn en sleutel krijgt een event capsule? | Geen opties genoemd. |
| A43 | STAGE.md: Terugval naast de relay-boom | Krijgt de relay-boom een terugval? | Geen opties; de bron: het kost geld en het is de voorwaarde om een kaartje voor een uitzending te mogen verkopen. |
| A44 | TRAVELCOMMERCE.md: Achtergrondwacht met meldingen | Gaat de reiswacht op de achtergrond door? | Geen opties; de bron: dat is de stap van momentopname naar belofte. |
| A45 | TRAVELCOMMERCE.md: Marge, inkoopprijs, betalingsplan | Verdient RTG aan een reis, en wat is een aanbetaling? | Geen opties; de bron: een bureaumodel met verkoop, inkoop en marge is een ander product, en betalingsplan, vervaldatum en annuleringsregel zijn juridische toezeggingen. |
| A46 | TRAVELCOMMERCE.md: Moderatie vóór publicatie | Komt er een keuring vóór publicatie van partnerproducten? | Geen opties; de bron: een vraag over het hele aanbodmodel. |
| A47 | TRAVELCOMMERCE.md: Assistent die handelt | Mag de reisassistent handelen? | Geen opties; de bron (TC-3): de bewijspoort houdt vandaag niets tegen. |
| A48 | VERANDERING.md: 1 Proof Efficiency als doelfunctie; VERANDERING.md: 5 Incremental Proof Engine; VERANDERING.md: 9 Proof Cache; VERANDERING.md: 25 Proof Budget | Worden bewijs-efficiëntie, een incrementele bewijsmotor, een bewijscache en een bewijsbudget gebouwd? | Geen opties. De bron: een ratio optimaliseert ook zijn noemer (correctie A), de motor is geblokkeerd op de volle ringen, er is vandaag nul bewezen (correctie D), en een budget zonder bereik is een bezuiniging op het onbekende. |
| A49 | VERANDERING.md: 20 één trace-identiteit | Krijgt de envelop een `changeId` (een versiesprong op een envelop die op acht velden gesloten is)? | Geen opties genoemd. |
| A50 | VERDER.md: B7: vergeten tegenover aangenomen collectieve kennis | Wat gebeurt er met collectieve kennis als iemand vergeten wil worden? | Alleen de naam eraf: de kennis blijft en de herkomst wordt "een deelnemer"; een les kan zonder naam nog herkenbaar zijn. De kennis ook weg: vergeten is vergeten; een fork die erop leunt krijgt een gat. |
