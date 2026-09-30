# NAVIGATIE.md — de plaats-these

**Een kaart vertelt waar iets is. RTG Plaats helpt een bedoeling op een plaats
slagen, terwijl de positie van de mens zoveel mogelijk op diens toestel blijft.**

Dit is een **richtingsdocument**, zoals `PLATFORM.md`, `ECONOMIE.md` en
`INTELLIGENTIE.md`. Per onderdeel staat erbij of het **staat**, **een stap weg**
is, **een besluit vraagt** of **jaren weg** is. Die vier zijn niet uitwisselbaar,
en ze staan er omdat een visiedocument zonder die kolom binnen een maand als
functielijst wordt gelezen.

Het is ook uitdrukkelijk een **these en geen categorie**. Wat hier staat, mag
pas "infrastructuur" of "een eigen categorie" heten als de poort in par. 13
groen staat -- met drie soorten bewijs, en op twee domeinen die elkaar niets
schuldig zijn. Tot die tijd is dit een ontwerp met een proef eronder, en de
proef bestaat nog niet.

Twee documenten blijven onverkort gelden en worden hier niet overgedaan:

- **`PLAATS.md`** is de harde grens: *RTG weet wát je nodig hebt zonder te weten
  wáár je bent geweest.* Een coördinaat verlaat het toestel alleen binnen een
  venster, hekken zijn plaatsen en geen personen, er komt geen
  locatiegeschiedenis als product. Waar iets in dit document daarmee botst,
  vervalt het.
- **`KAARTEN.md`** is de kaartlaag: drie standen (aangeboden, gebouwd, gekozen),
  de licentie als grendel, een rechthoek is geen grens, en de laag mag alleen
  toevoegen.

Daarnaast raakt dit document `REIZEN.md` (het werkwoord *vóór zijn*),
`LIFE.md` (*samenstellen en klaarzetten, bevestigen doet de mens*),
`TRAVELCOMMERCE.md` (geen `journeys`-tabel die een reis BEZIT) en `HDI.md` par.
5.1 (geen `humans`-tabel).

**Hoe dit document tot stand kwam.** Alles hieronder is op 29 september 2026
gelezen in de code, met bestand en regel erbij. Er is één meting gedraaid, de
bron-helft van de grondwetmeter (`npm run positiestroom`, par. 6.5); er is geen
proef en geen server gedraaid. Waar dit document een gebrek noemt, is dat een
lezing van de bron (graad `vermoed` tot een toets het vastzet), en het is met
opzet niet gerepareerd -- dit is een ontwerpronde.

---

## 0. De omkering

Klassieke locatieplatforms verzamelen kennis over een plaats van buitenaf:
kaartbronnen, gebruikerssignalen, reviews, mobiliteitsdata. Dat werkt, en het
werkt beter naarmate er meer mensen langs komen.

Dit huis kan de andere kant op werken, omdat de operationele bron van een plaats
hier al in hetzelfde huis woont. Een restaurant zegt niet alleen *wij bestaan
hier*; zijn eigen domeinen kunnen feiten leveren:

| plaatsfeit | komt vandaag uit |
|---|---|
| `OPEN` | `server/kern/mall/stand.js` `openNu()` -- kassa, eigen schakelaar, agenda |
| `WACHTRIJ` | `server/kern/navigatie/partner-events.js`, soort `wachtrij` |
| `RESERVERING = bevestigd` | `server/kern/ervaring/tafels.js` `beslisReservering()` |
| `TAFEL = gereed` | `server/kern/ervaring/tafelplanning.js` |
| `AANGEKOMEN` | `POST /api/supplier/reservering/komst` |
| `AFREKENING = voltooid` | `server/routes/supplier/horeca/betalen.js` |
| `INGANG`, `PARKEREN` | **nergens** -- zie par. 4, schakel 10 |

Dat zijn geen afgeleide observaties van passerende telefoons. Het zijn
domeingebeurtenissen, en ze hebben een eigenaar die ervoor instaat.

Daaruit volgt de zin die het ontwerp stuurt:

> **RTG hoeft de mens niet beter te observeren om de reis slimmer te maken.
> RTG moet de plaats operationeel intelligenter maken.**

En iedere aangesloten ondernemer maakt die fysieke werkelijkheid nauwkeuriger --
niet doordat er meer mensen langskomen, maar doordat er een bron bij komt.

---

## 1. De grondwet

Zes regels. Ze staan hier met per regel **wie hem vandaag handhaaft**, en bij de
meeste is dat eerlijk gezegd niemand. Een regel zonder handhaver is een
voornemen (`LAT.md`); hij staat hier omdat de proef in par. 4 hem een handhaver
moet geven.

### P-01 — Een locatie is geen coördinaat

> Een locatie is een plaats met identiteit, tijd, toestand, mogelijkheden,
> toegang, privacy en bewijs. **Een plaats heeft een identiteit; een mens heeft
> er alleen een venster op.**

De tweede zin is geen versiering. Zonder hem wordt een rijke plaatslaag een
graaf van wie waar was, en dat is precies wat `HDI.md` par. 5.1 en `PLAATS.md`
grens 1 verbieden. Een zaak, een ingang, een halte en een parkeerterrein mogen
alle zeven eigenschappen dragen. Een mens draagt er geen enkele van.

**Vorm.** Er komt **geen `Place`-objecttype**. Dat is de `Asset`-fout, en dit
huis heeft hem vijf keer gemeten (`OBJECTMODEL.json`, `CARRIEREVORM.json`,
`STAGEVORM.json`, `CONNECTLUS.json`, `PLANVORM.json`) en vijf keer zien
sneuvelen. De zeven eigenschappen zijn de **etiketten van een projectie** in de
vorm van `server/kern/levensgraaf/graaf.js`, waarbij `privacy` een POORT is en
geen etiket. Of die projectie over horeca, verblijf, mobiliteit en retail heen
iets deelt, wordt eerst gemeten (`plaatsvorm`, par. 14) met de lezer van
`scripts/objectmodel.js` en niet aangenomen.

**Handhaver vandaag:** niemand. Er is geen plaatsprojectie; een plaats is
`s.loc` op een zaak (`server/kern/navigatie/plekken.js:20`).

### P-02 — Navigatie eindigt wanneer de bedoeling voltooid is

> Navigatie eindigt niet wanneer de coördinaat is bereikt, maar wanneer de
> menselijke bedoeling succesvol is voltooid. **Dat zegt het domein of de mens,
> nooit de GPS.**

Letterlijk gelezen dwingt de eerste zin RTG om ná aankomst door te kijken tot
het doel gelukt is -- een spoor. De tweede zin keert dat om: het bewijs dat de
bedoeling slaagde komt van de gebeurtenis zelf (de reservering staat op
`aangekomen`, het ticket is gescand, de levering is afgetekend), en vanaf dat
moment **heeft de GPS geen taak meer**.

**Handhaver vandaag:** niemand. `public/apps/navigatie.html` stopt de positie
alleen op `pagehide` (regel 971) en kent geen zaak, reservering of aankomst: de
deeplink `?naar=lat,lng&label=` draagt met opzet alleen een punt (regels
327-348), waardoor de bestemming haar identiteit kwijt is voordat de route
begint.

### P-03 — De privacypoort wint altijd van vindbaarheid

> Een plaats verschijnt alleen waar zij mag verschijnen. Geschorst, offline,
> verborgen of een woonadres betekent: niet als pin -- en die poort staat aan de
> bron, niet in elk scherm.

**Handhaver vandaag:** niemand, en het gat is al zichtbaar.
`server/kern/navigatie/plekken.js:13-28` en `server/kern/mobiliteit/plekken.js:33`
lopen over elke zaak met een `loc`, zonder `zaakOnline()`
(`server/kern/ondernemerpoort.js:63`), zonder `partnerStatus` en zonder
`s.mall.verborgen`. De zaaidata toont al wat daaruit volgt: zaken met als plek
*besloten locatie* en *aan huis, heel het eiland* zijn navigeerbare pinnen. Ook
`reserveerTafel()` (`server/kern/ervaring/tafels.js:19-22`) toetst niet of een
zaak online is.

De uitweg voor wie vanuit huis werkt bestaat al en hoeft niet bedacht te worden:
`server/kern/mall/plek.js` kent een bereiksoort per zaak (`adres`, `straal`,
`stad`, `land`, `europa`, `online`), met `zzp`, `bouw`, `care` en `chef` standaard
op `straal`. Een zaak met een straal is een werkgebied en nooit een pin.

### P-04 — Geen reistijd zonder herkomst

> Een reistijd draagt waar hij vandaan komt. Een rechte lijn is een terugval met
> de graad `vermoed`, nooit stil -- en waar geld of een toezegging van het getal
> afhangt, is er geen terugval maar een weigering met de reden.

**Handhaver vandaag:** gedeeltelijk. Move doet het goed
(`server/kern/move/index.js:29-41` weigert "een reistijd verzinnen" en maakt er
`NIET_TE_BEPALEN` van), en de navigatie weigert eerlijk in Nederland zonder NWB
(`server/kern/navigatie/dekking.js:28`). Maar elders rekent het huis met de rechte
lijn waar geld van afhangt (par. 7), en het scherm van de navigatie toont een
getal als zekerheid dat geen meting is (par. 12, gebrek 4).

### P-05 — Een plaats leert van haar bronnen, niet van het bewegingsspoor van haar bezoekers

> Een plaats wordt rijker doordat een bron iets over haar zegt, nooit doordat
> RTG vaststelt dat mensen er waren. **Een actieve handeling mag een positie
> verwerken wanneer die positie noodzakelijk is voor die handeling;
> noodzakelijke verwerking wordt niet vanzelf een blijvend bewegingsspoor.**

De tweede zin is er sinds 29 september, en hij staat er om een verkeerde lezing
tegen te houden: deze regel gaat **niet** over hoe weinig GPS RTG gebruikt. Hij
gaat over wat er ná de taak van overblijft. Er zijn drie dingen, en alleen het
derde is het probleem:

| | wat | mag |
|---|---|---|
| **1. huidige positie** | *ik ben nú hier* | ja -- zonder kan niemand navigeren, herberekenen of een afslag herkennen |
| **2. tijdelijk venster** | *voor deze rit, deze nadering, dit alarm is dit nodig* | ja -- met een doel, een einde en bevoegde ontvangers |
| **3. bewegingsgeschiedenis** | *hier kwam deze persoon de afgelopen 90 dagen langs* | nee |

De eerste twee zijn wat `PLAATS.md` een **venster** noemt; de derde is wat het
verbiedt. Dit document voegt dus geen strengere regel toe, maar maakt de
bestaande scherp op de plek waar hij stil werd overschreden.

Mag: de ondernemer bevestigt een ingang, het kassasysteem bevestigt dat de zaak
open is, het reserveringssysteem kent beschikbaarheid, een partner-event meldt
een wachtrij, een laadpaal levert zijn stand, Rijkswaterstaat publiceert een
afsluiting.

Mag niet: *184 leden stonden hier gisteren tussen 19:00 en 20:00.* Ook niet
geanonimiseerd, ook niet als drukte-indicatie, ook niet "alleen voor de
ondernemer". Dat is een sluiproute om `PLAATS.md` heen, en het is de vorm die
het meest voor de hand ligt zodra iemand een drukte-functie wil.

**Handhaver vandaag:** niemand, en de regel is bij lezing al geschonden. Er is
geen aggregaat van aanwezigheid per plaats, en de waarnemingen van `kern/plaats`
dragen een doel. Maar het actielog van diezelfde laag legt tijdens een
naderingsvenster elke passage langs een zaak vast onder een codenaam, 90 dagen
lang (par. 6.2). Het ruwe materiaal voor *184 leden stonden hier* ligt er dus
al; alleen de telling niet. Par. 6 maakt van deze regel een toets, en B8 in par.
15 is het besluit dat hem repareert.

### P-06 — Een bron draagt haar naam

> Een plaatsfeit dat een bron levert, blijft een uitspraak van die bron. RTG
> presenteert het nooit als eigen gemeten waarheid.

Een door de zaak gemelde wachttijd van twaalf minuten is *"volgens de zaak: 12
min"*, met de tijd van de melding. Klopt hij niet, dan is dat traceerbaar naar
wie hem zei, en RTG heeft niets beweerd wat het niet wist. Dit is dezelfde regel
als de fiscale klassen (`server/kern/fiscaal/zekerheid.js`) en de bewijsgraden
van `BESTUUR.md`, toegepast op een plaats.

**Handhaver vandaag:** niemand. Partner-events dragen wel hun zaakcode, maar er
is geen scherm dat een plaatsfeit met herkomst toont.

### 1.1 De productlat: minstens even goede kernnavigatie (N11)

De grondwet beperkt wat er ná een taak overblijft, niet wat het systeem tijdens de
taak mag berekenen. De ambitie is dus niet minder navigatie maar **minstens even
goede kernnavigatie, plus een veel diepere aansluiting op de bedoeling, plus
minder blijvend bewegingsspoor**. Gelezen op 29 september 2026:

| vermogen | stand |
|---|---|
| live positie tijdens de rit | **staat** (`public/shared/plek.js`, `navigatie.html`) |
| bocht-voor-bocht | **staat** (`stappenVan` in `server/kern/navigatie/wegennet.js`) |
| gesproken aanwijzingen | **staat** (`zeg()` in `navigatie.html`) |
| auto, EV (accu en bereik), fiets, lopen | **staat** (`MODI`, `accuProcent`, `bereikKm`) |
| verkeer en afsluitingen | **staat voor de helft**: Flits en partner-events wegen mee; een landelijke bron ontbreekt |
| herberekenen | **een stap weg**: elke 30 seconden op de klok (`navigatie.html:952`), niet op het moment dat iemand van de route afwijkt |
| gemiste afslag herstellen | **een stap weg**: volgt uit herberekenen bij afwijking |
| rijstrookadvies | **jaren weg**: het NWB kent geen rijstroken of afslagbeperkingen (`NEDERLAND-WEGENNET.md`) |
| offline routeren | **een stap weg**: de graaf staat op het toestel, de motor niet (par. 9.2) |
| nauwkeurige ETA | **een stap weg in vorm, jaren weg in trefzekerheid**: zie hieronder |
| juiste parkeerplaats, juiste ingang | **vraagt een besluit** (par. 4, schakel 10) |
| nadering, doelaankomst, volgende bestemming | par. 4, schakels 11, 13-15 en 20 |
| even betrouwbaar buiten Nederland | **spoor 2** (par. 9) |

**Waar P-05 echt iets kost: de ETA in druk verkeer.** Een nauwkeurige reistijd bij
file komt klassiek uit de snelheden van veel meerijdende toestellen -- precies het
bewegingsspoor dat deze these niet wil. De uitweg is geen uitzondering op P-05
maar een BRON: meldingen die leden bewust doen (Flits), wat zaken zelf publiceren
(partner-events), en open verkeersgegevens van de wegbeheerder. Nederland heeft
die laatste als open data (het Nationaal Dataportaal Wegverkeer); dat die hier
bruikbaar en bereikbaar is, is **niet nagegaan** en heeft de graad `vermoed`.

**En de trefzekerheid van de ETA wordt gemeten zonder bewegingsspoor.** Wat nodig
is, is een voorspelde en een werkelijke reistijd per rit -- en die tweede komt uit
een vertrek en een aankomst die een DOMEIN bevestigde (par. 7.4,
`gemetenReistijd`), niet uit de punten ertussen. Wat daarvan bewaard wordt is de
afwijking per soort route, zonder sleutel of codenaam; een lijst *deze persoon
deed er zo lang over* is een bewegingsgeschiedenis met een andere naam.

**Het ambitieuze pad is het toestel.** Als het routeren daar draait, weet de
telefoon *je bent hier, over 220 meter rechts, je hebt de afslag gemist, nieuwe
route, je nadert, ingang B is beter* -- en levert de server alleen het wegennet,
de actuele afsluitingen, waar ingang B ligt en de toestand van de plaats. Dat is
technisch zwaarder dan de positie naar de server sturen, en het is de reden dat
spoor 2 geen bijzaak is.

---

## 2. Namen die al bezet zijn

Dit is de goedkoopste paragraaf van het document en hij hoort vóór de eerste
regel code.

| voorgesteld | waarom niet | in plaats daarvan |
|---|---|---|
| **World** (World Graph, World Intelligence, World Builder, World Pulse) | in `WERELDEN.md` is een wereld LivingOS, WorkOS, TravelOS of FoundationOS; "World" hier geeft het centrale woord van de kaart een tweede betekenis | **Plaats** (de laag heet al zo) |
| **Pulse** | een sociale feed in 27 bestanden; `KANTOOR.md` noemde de gebeurtenismotor daarom `weerklank` | niet nodig; zie par. 11 |
| **Bereik** (als naam van de ETA-dienst) | `BEREIK.json` is de schuldlijst van onbereikbare schermen, `s.mall.bereik` is het werkgebied van een zaak, en `DOELGROEPBEREIK.json` bestaat ook | **`reistijd`** -- staat in 17 bestanden, en overal in precies deze betekenis, dus het zijn de afnemers en geen botsing |
| **Overdracht** (navigatie → horeca) | de vijf overdrachtstreden van `CONNECT.md` par. 3.0 (gemaakt, aangeboden, bereikt, gebruikt, doorgegeven) | **`doorgave`** -- vrij |
| **journey** | een mentaal model in `server/kern/experience/contract.js` (`MENTAL_MODELS`) | geen nieuw woord; de reis is de tijdlijn van `server/kern/reiswereld.js` |
| **Place** als type | geen botsing maar de `Asset`-fout (P-01) | een projectie |
| **Saloon** (contextuele) | als dit De Salon is: `Salon` staat in 268 bestanden; zie par. 11 | eerst de vraag wat het is |

Vrij en hier voorgesteld: `plaatsfeit` (een domeingebeurtenis over een
plaats), `doorgave`, `dubbelbewijs`, `plaatsvorm` (de meting).

---

## 3. Het vliegwiel

```
zaak registreert
→ krijgt een geldige geografische projectie
→ verschijnt waar toegestaan in Plaats en Navigatie
→ voegt ingang, mogelijkheden en openingstijden toe
→ operationele systemen leveren actuele plaatsfeiten
→ de navigatie wordt beter
→ de aankomst wordt beter
→ de doorgave aan horeca, verblijf, bezorging wordt beter
→ de handeling vindt plaats
→ het operationele domein bevestigt het resultaat
→ de plaatskennis wordt betrouwbaarder
→ opnieuw
```

**Cruciaal: meer gebruik betekent hier niet meer locatiegeschiedenis.** Meer
aangesloten bronnen verhogen de kwaliteit; meer bezoekers niet (P-05).

| stap | stand | waarom |
|---|---|---|
| zaak registreert | **staat** | vijf wegen maken een zaak aan |
| geldige geografische projectie | **een stap weg** | alle vijf zetten `loc: null`: `server/kern/aanmeldingen/bedrijf.js:127`, `server/routes/office/partners.js:56`, `server/kern/instelling.js:93`, `server/kern/rtfwallet.js:92`, `server/kern/vrijheid/rtghuis.js:73`. De adreszoeker (`server/kern/adresopzoek.js`) vraagt PDOK en gooit de coördinaat weg: `NAAR_BUITEN` in `server/kern/adresopzoek/vertaling.js:42` kent geen lat/lng |
| verschijnt waar toegestaan | **een stap weg** | verschijnen gaat vanzelf (`eigenPlekken()` wordt bij elke vraag opnieuw opgebouwd, er is geen index om bij te houden); *waar toegestaan* ontbreekt (P-03) |
| ingang, mogelijkheden, openingstijden | **vraagt een besluit** | geen veld voor ingang of parkeren; geen algemeen veld voor openingstijden (`s.openingstijden` wordt gelezen in `server/kern/onderneming/mallprofiel.js:61` en nergens geschreven) |
| actuele plaatsfeiten | **een stap weg** | de bronnen bestaan (par. 0), maar er is geen plek waar ze samenkomen als feiten over een plaats |
| navigatie wordt beter | **jaren weg als lus** | de navigatie leest van een zaak alleen `loc` en `type` |
| doorgave | **vraagt een besluit** | par. 4, schakel 13 |
| domein bevestigt | **staat** per domein | reservering, betaling, levering bevestigen elk hun eigen stand |
| kennis wordt betrouwbaarder | **jaren weg** | er is niets dat een bevestigde doorgave terugleest als bewijs voor de plaats |

**Het eerste wiel dat moet draaien is de tweede rij.** Zolang een echt
geregistreerde zaak geen plek krijgt, is de netwerkwaarde van dit vliegwiel
precies nul -- alleen de demozaken staan op de kaart.

---

## 4. Proef 1: de restaurantketen (*Physical Intent Proof*)

> *Een lid wil om 20:00 bij restaurant X eten en daarna om 22:00 activiteit Y
> halen.*

Waarom het restaurant: bijna elke schakel bestaat al los, en de horeca heeft al
een gouden keten (`scripts/tafelproef.js`). De proef heet een Physical Intent
Proof omdat hij niet eindigt bij een aangekomen punt maar bij een geslaagde
bedoeling -- en daarna een tweede bedoeling haalt.

De vorm is die van de bestaande ketenproeven: per **schakel** (handelt actor A,
en ziet actor B dat?), met `openBekend` voor een schakel die open staat met een
uitgeschreven reden (`scripts/ritproef.js`). Hieronder de stand van vandaag,
gelezen en niet gedraaid.

| # | schakel | stand | bewijs en wat ontbreekt |
|---|---|---|---|
| 1 | **intentie**: het lid reserveert een tafel om 20:00 | **staat** | `POST /api/reserveer` (`server/routes/member/handel/uitjes.js:42`) → `reserveerTafel()` (`server/kern/ervaring/tafels.js:18`); ook via de avond (`POST /api/avond/aanvragen`). Een intentie in gewone taal bestaat alleen voor de anonieme Arrival-weg |
| 2 | het restaurant bestaat als geldige plaats | **een stap weg** | `loc: null` op alle vijf aanmaakwegen (par. 3); de enige schrijver is de live-GPS-knop voor voertuigen, `POST /api/supplier/location` |
| 3 | de zaak is zichtbaar volgens privacy en toelating | **vraagt een besluit** | P-03: de poort ontbreekt in navigatie, plekken en `reserveerTafel()` |
| 4 | de openingsstand komt uit een geldige bron | **staat, met een kanttekening** | `openNu(s, wanneer)` (`server/kern/mall/stand.js:93`) geeft `{open, tekst, bron}` en kan "open om 20:00" beantwoorden. Voor een restaurant is de bron vaak de huisstandaard `foodcourt` (vaste lunch- en dinervensters) en niet de zaak zelf -- dat is P-06 in het klein. Navigatie en Move roepen hem niet aan |
| 5 | de reservering bestaat en is bevestigd | **staat** | `beslisReservering()` (`tafels.js:69`) zet `bevestigd` en meldt het lid; het lid ziet hem via `/api/reserveringen/mijn` |
| 6 | een echte route | **staat** met het NWB-pakket, **een stap weg** zonder | `navRoute()` (`server/kern/navigatie.js:105`); zonder `npm run navigatie:nederland` weigert hij in Nederland met 503 en de reden |
| 7 | de ETA heeft een bekende bewijsgraad | **een stap weg** | de route geeft `bron` (het net) maar geen graad; de andere modi dan de gekozen rekenen met een vaste snelheid (`server/kern/navigatie/route-engine.js:34-38`); zie par. 12, gebrek 4 |
| 8 | **Move bepaalt vertrek en marge** | **een stap weg -- de grootste naad** | Move leest de tijdlijn uit `server/kern/reiswereld.js`, met vijf bronnen: verblijven, reisbureau, vluchten, activiteiten, ingevoerd (regel 131). **`db.data.reserveringen` staat er niet in.** Move ziet het diner dus niet, en de vraag "haal ik Y?" heeft geen van-kant |
| 9 | de positie blijft binnen PLAATS-regels | **vraagt een besluit** | de hek-motor houdt zich eraan (`public/shared/plaats.js` stuurt alleen `{doel, hek, wat}`), maar de navigatie gebruikt de plaatslaag niet: `navigatie.html` stuurt ruwe lat/lng naar `/api/nav/route` en `/api/nav/kaart` onder een eigen regime ("alleen voor deze berekening, niet bewaard", `route-engine.js:69`) en opent geen venster |
| 10 | parkeren geselecteerd, juiste ingang geselecteerd | **vraagt een besluit** | geen veld op een zaak. Wel bestaande vormen: zonesoorten `parking` en `ingang` in `server/kern/festival/soorten.js:37-38`. Een hek is één punt per zaak (`server/kern/plaats/hekken.js:101`) |
| 11 | nadering | **staat -- alleen voor een Arrival-pas** | `public/shared/plaatsnadering.js` opent een venster met doel `nadering` en stuurt de puls `in-de-buurt` als het hek van de zaak omslaat; `test/plaatsnadering.e2e.js` meet dat er geen coördinaat meegaat. Geladen alleen op `arrival.html`; werkt niet voor een gewone reservering en niet voor een zaak zonder `loc` |
| 12 | Invisible Arrival | **staat -- als parallelle wereld** | `server/routes/supplier/horeca/invisible-arrival.js`: een anonieme pas met een EIGEN reservering (`customerKey: 'arrival:' + id`). Met opzet nooit aan een codenaam gekoppeld op de server (`PLAATS.md` fase 4) |
| 13 | **doorgave navigatie → horeca** | **besloten (N5), een stap weg** | er is niets: de navigatie kent geen aankomst, de deeplink draagt geen zaakcode, en de positie stopt alleen op `pagehide`. De doorgave wordt MINIMAAL -- zie onder de tabel |
| 14 | tafel of check-in bevestigt de aankomst | **een stap weg** | twee mechanismen die elkaar niet kennen: de zaak zet `aangekomen` met de hand (`/api/supplier/reservering/komst`), en de gast-QR (`server/routes/gast/tafel.js`) opent een anonieme tafelsessie zonder verwijzing naar een reservering |
| 15 | de GPS heeft geen taak meer | **vraagt een besluit** | volgt uit P-02 en schakel 13 |
| 16 | eten en afrekenen blijven van horeca | **staat** | `server/routes/supplier/horeca/betalen.js:51-105`; bewezen in `scripts/tafelproef.js` schakel 11 |
| 17 | de betaling is voltooid | **staat** | idem |
| 18 | ~~Move krijgt een vervolgsignaal na de betaling~~ | **vervalt voor V1** (par. 15.0) | afrekenen stuurt alleen `sseToSupplier`, en dat is goed zo: horeca voltooit zijn eigen proces en stuurt de navigatie niets. Move leest de toekomstige verplichtingen uit de tijdlijn, en daar hoort de volgende activiteit al in te staan |
| 19 | "haal ik activiteit Y?" | **een stap weg** | `/api/move/vooraf` kan het vandaag al, als het lid zelf de duur van het diner opgeeft; na het reserveren weet `/api/move/reis` het niet meer (schakel 8) |
| 20 | volgende navigatie | **staat** | `public/apps/move.html:282-297` bouwt de deeplink uit `/api/move/volgende`; let op gebrek 2 in par. 12 |

**Samengevat: 9 staan (waarvan 2 alleen in de parallelle Arrival-wereld), 5 zijn
een stap weg, 5 vroegen een besluit en 1 was in de voorgestelde vorm jaren weg.**
Na par. 15.0 is schakel 13 besloten en vervalt schakel 18 voor V1; dan blijven er
19 over, en de open besluiten zitten in schakel 3, 9, 10 en 15. Dat is geen tekort aan motoren maar aan naden --
precies wat `MACHINE.md` over het hele huis zegt.

**De ene naad die het meeste oplevert** is schakel 8: een reiswereldbron voor
`db.data.reserveringen` in `server/kern/reiswereld-bronnen-partner.js`, in de
vorm van de bron die er voor tickets al staat (`plek: {zaak}`, `van`, `tijd`,
`duurMin`, `kenmerk`). Die ene naad laat `move/reis`, `move/gevolg` en
`move/volgende` het diner zien. De duur van een diner is dan wel een besluit: de
avond neemt 105 minuten aan (`server/kern/avond/samenstellen.js:28`), en dat is
een huiskeuze die als zodanig gelabeld moet zijn.

**Waarom schakel 8 de eerste echte architectonische naad is.** Zonder de
reservering in de tijdlijn kent Move de bedoeling niet, en zonder bedoeling is
dit een slimme routeplanner. Met die ene naad wordt het:

```
restaurant X      20:00    reistijd 31 min (graad, bron)    marge 10 min (huiskeuze)
                           → uiterlijk vertrek 19:19
theater Y         22:15    X → Y 24 min
                           → haalbaar als het diner om 21:41 klaar is
```

Move hoeft daarvoor niet te weten hoe lang iemand werkelijk aan tafel zit, en al
helemaal niet via een positie. De domeinen leveren de betekenis. **Eén ding moet
een domein wel leveren: het einde van het diner.** Een tafelreservering heeft
vandaag geen duur, de avond neemt 105 minuten aan (`server/kern/avond/samenstellen.js:28`),
en zonder `klaarAt` heeft de naad naar het theater geen van-kant (`server/kern/move/index.js:64-78`).
Die duur hoort van horeca te komen -- de zaak kent haar tafelrotatie -- en waar
hij een huisstandaard is, draagt hij het etiket `huiskeuze`, zoals de drempel van
Move dat al doet (`server/kern/move/naad.js:55-59`). En ook de marge van tien
minuten is een huiskeuze en geen meting.

**De doorgave is minimaal (N5).** De navigatie wordt geen superlink die restaurant,
reservering, gebruiker, tafel en betaling meedraagt. Ze draagt vier dingen, en
het ontvangende domein haalt zelf op wat het mag weten:

| wat | betekent |
|---|---|
| de **plaats** | naar welke plaats, als verwijzing en niet als coördinaat |
| het **domein** met een verwijzing die alleen dat domein kan openen | *horeca, en deze verwijzing* -- de navigatie kan hem niet lezen |
| het **aankomstpunt** | de toegestane ingang waar de doorgave gebeurt |
| de **terugweg** | waar de mens heen gaat als het domein klaar is |

De navigatie hoeft dus niet te weten *tafel 14, drie personen, € 185*. Ze weet
*ik breng iemand naar de toegestane ingang van plaats X voor een doorgave aan
horeca*. De veldnamen zijn nog niet vastgelegd: `doel` is bezet (twee
betekenissen, `MACHINE.md`) en `terugNaar` ook (een versie in
`server/kern/command/beleid.js`, een focus in `public/shared/sprong.js`), dus ze
worden gemeten voordat ze worden gekozen.

**Drie identiteiten die elkaar met opzet niet kennen.** De reservering van het
lid (codenaam), de Arrival-pas (anoniem, eigen reservering) en de tafelsessie van
de QR (anoniem, eigen sleutel) zijn drie werelden. Dat is geen slordigheid: de
scheiding tussen pas en codenaam is een besluit uit `PLAATS.md` fase 4, en *"wie
dit ooit naar de server wil verplaatsen omdat het makkelijker is, koppelt een
anonieme pas aan een identiteit"*. De keten mag die drie dus niet op de server
aan elkaar knopen. Hij moet ze **op het toestel** laten raken, zoals de nadering
dat al doet -- en of een reservering van een lid zelf een pas mag uitgeven, is
het eerste besluit van par. 15.

---

## 5. De storingsmatrix

Een categorie wordt pas interessant als de keten niet alleen werkt wanneer alles
goed gaat. Elke storing hieronder is een belofte, met de actor die hem moet
waarmaken en wat er vandaag van staat.

| storing | belofte | stand |
|---|---|---|
| **de zaak sluit onverwacht** | de bron verandert, en de bestaande bedoeling krijgt een gevolg (Move meldt het, de reservering krijgt een voorstel) | **een stap weg**: `openNu()` weet het, Move vraagt het niet; `move/gevolg` verwijst voor horeca naar `/apps/reserveren.html`, **en dat scherm bestaat niet** (par. 12, gebrek 3) |
| **de ingang is dicht** | de plaats verandert, er komt een andere ingang, de ETA verschuift, de reservering blijft staan | **vraagt een besluit**: er is geen ingang (schakel 10) |
| **de parkeerplaats is vol** | een alternatief, een nieuwe doelaankomst, Move rekent opnieuw | **vraagt een besluit**: geen parkeren; partner-events kennen `wachtrij` en `ophaalzone` maar geen bezetting |
| **de weg is afgesloten** | de route wordt herberekend en de bron van de afsluiting is zichtbaar | **staat voor de helft**: partner-events en Flits wegen mee in de kosten (`route-engine.js`), maar de bron staat niet bij de aanwijzing |
| **het lid is te laat** | Move constateert het risico; **horeca** besluit wat de reservering ermee doet | **een stap weg**: `move/gevolg` rekent het uit en zet een voorstel klaar met `uitgevoerd: false` -- de goede vorm -- maar kan het diner niet zien (schakel 8) en wijst naar een scherm dat niet bestaat |
| **geen netwerk** | kaart, route en toestelcontext blijven bruikbaar | **een stap weg**: de graaf gaat naar het toestel (`server/kern/navigatie/toestelpakket.js`), maar de route wordt nog op de server gerekend en zoeken blijft online (`KAARTEN.md` par. 11) |
| **GPS geweigerd** | het systeem degradeert hardop in plaats van stil | **staat**: `public/shared/plek.js` vraagt met reden, `navigatie.html` heeft een handmatig startpunt, en `PLAATS.md` grens 6 verbiedt stil overslaan |
| **de zaak meldt een foute wachttijd** | de bron is traceerbaar; RTG presenteert het niet als eigen meting | **vraagt een besluit**: P-06 heeft geen scherm |
| **er is geen echte route** | geen hemelsbrede pseudo-ETA waar geld of een toezegging van afhangt | **staat** in de navigatie en Move (`dekking.js`); **staat niet** in taxi, OV en bezorging (par. 7) |
| **het restaurant ligt op een woonadres of besloten plek** | de privacypoort wint altijd van vindbaarheid | **staat niet**: P-03 |

Dan bewijs je niet alleen een gebruikersstroom. **Je bewijst de grondwet onder
storing.**

---

## 6. Dubbelbewijs: kunnen, en niet hoeven

Een gewone producttoets bewijst *we konden X doen*. Deze these moet tegelijk
bewijzen *we konden X doen zonder Y te doen*. Daarom drie soorten bewijs, die
**nooit worden opgeteld** -- een groene functie maakt een rode terughoudendheid
niet goed, en andersom.

1. **Functioneel bewijs -- kan het?** De restaurantketen van par. 4 sluit.
2. **Continuïteitsbewijs -- blijft de bedoeling overeind als de werkelijkheid
   verandert?** De storingsmatrix van par. 5 houdt.
3. **Negatief bewijs -- wat heeft RTG aantoonbaar níét hoeven weten?**

Samen heten de eerste en de derde het **dubbelbewijs**: *capability proof +
restraint proof*. Dat principe is groter dan navigatie -- het past op elk domein
waar dit huis een grens belooft -- maar het wordt hier voor het eerst
voorgesteld en hoort eerst hier te bewijzen dat het meetbaar is.

### 6.1 De vijf tellers van het negatieve bewijs

Na een volledige doorloop van de restaurantketen moeten deze vijf op nul staan,
**gemeten door de opslag te lezen en niet door de code te geloven**:

| teller | betekent | hoe te meten |
|---|---|---|
| `locatiegeschiedenis` | er bestaat na afloop geen reeks posities van dit lid | elke collectie in de opslag doorzoeken op coördinaatparen die aan zijn sleutel of codenaam hangen |
| `serverCoordinaatBuitenVenster` | geen positie van het lid staat opgeslagen buiten een lopend venster | idem, en per treffer het venster zoeken dat hem toestaat |
| `mensPlaatsGraaf` | er is geen koppeling *deze codenaam was bij deze zaak* anders dan de reservering zelf | de opslag vóór en na vergelijken op nieuwe paren (sleutel, zaakcode) |
| `aankomstUitGps` | geen domein zette een aankomst op grond van een positie | de stand `aangekomen` herleiden naar de handeling die hem zette |
| `voltooiingUitGps` | geen domein rondde iets af op grond van een positie | idem voor `afgerond`, `betaald`, `geleverd` |

De meetvorm bestaat al in het klein: `test/plaatsnadering.e2e.js` leest elk
verzoek van de Arrival-pagina mee en eist dat er geen coördinaat in staat, met
een mutatie die de toets laat zakken. Het dubbelbewijs trekt dat van één pagina
naar een hele keten, en van *het verzoek* naar *de opslag erna*.

### 6.2 De nulmeting: geen van de vijf staat vandaag op nul

Gelezen in de bron op 29 september 2026. Dit is de uitslag die het meest telt in
dit hele document, want de these staat of valt met de derde soort bewijs, en die
is vandaag bij lezing **gezakt** -- niet in de navigatie, maar eromheen.

**De navigatie zelf is schoon, op één route na.** `/api/nav/kaart`,
`/bestemmingen`, `/poi` en `/route` gebruiken de positie alleen in de berekening
en bewaren niets (`server/kern/navigatie.js` roept `save` niet aan;
`routeSleutel` in `intelligentie.js:129` is een hash in het antwoord en geen
cache). De verzoeklog schrijft pad en status en geen lichaam (`server/log.js`).
De uitzondering is `/api/nav/meld`: een verkeersmelding komt met positie en
codenaam in `db.data.flitsMeldingen` (`server/kern/flits.js:82`), en wie hem
bevestigt komt er met zijn sessiesleutel bij (`stemmers`). Dat is een melding
die iemand bewust doet, met een levensduur van 45 minuten tot een dag -- maar
hij staat in geen bewaarbeleid en in geen vergeetroute. De enige toets over de
privacy van de navigatie (`test/navigatie.test.js:125`) leest de ZIN
*"niet bewaard"* in het antwoord, en niet de opslag.

**Eromheen staat er van alles.** Per teller, met de zwaarste bron voorop:

| teller | stand bij lezing | zwaarste bron |
|---|---|---|
| `locatiegeschiedenis` | **niet nul** | een vervoersopdracht bewaart tot zestig gebeurtenissen `trip.location_updated` met lat/lng (`server/kern/mobiliteit/voortgang.js:86`), aan de sleutel van de reiziger, zonder bewaartermijn -- de opslag van het domein zegt dat zelf; ook `ovRitten` (de GPS bij uitchecken) en de patrouillepunten van een bewaker |
| `serverCoordinaatBuitenVenster` | **niet nul** | `/api/live/stop` zet alleen `active = false` en laat lat/lng staan (`server/routes/member/onderweg.js:67`), zeven dagen lang; `veilig.plek`, `mobFavorieten`, `ontmoetPosities` zonder termijn |
| `mensPlaatsGraaf` | **niet nul -- en in de plaatslaag zelf** | zie hieronder |
| `aankomstUitGps` | **niet nul** | `/api/live/update` zet `arrived` binnen 150 m van de bestemming uit de opgeslagen positie en meldt de zaak; `test/grand-integratie.pg.test.js:306-308` handhaaft dat gedrag |
| `voltooiingUitGps` | **niet nul** | een deur gaat pas open na die automatische aankomst (`server/routes/member/terplaatse.js`); het OV-tarief wordt gerekend uit de GPS bij uitchecken |

**De scherpste vondst zit in de plaatslaag, en dus precies in de keten van dit
document.** De nadering van Arrival opent een venster met doel `nadering` en
start de hek-motor (`public/shared/plaatsnadering.js`). Het toestel laadt dan
**alle** hekken van dat doel -- elke zaak en elke voorziening, met een straal van
900 meter (`server/kern/plaats/hekken.js:57`) -- en stuurt bij elke overgang een
waarneming (`public/shared/plaats.js:108`). De puls naar de zaak gaat terecht
alleen voor het eigen hek, en daarover zegt `PLAATS.md` fase 4 dat *een puls over
een zaak waar je toevallig langsloopt de zaak iets over je route zou vertellen*.
Maar elke waarneming schrijft ook een regel in het actielog
(`server/kern/plaats/waarnemen.js:59`): **codenaam, hek, richting en tijd, voor
elke zaak waar iemand langskomt.** Dat log wordt bij het sluiten van het venster
niet gewist (`test/plaats.test.js:176-179` handhaaft dat) en staat 90 dagen in
het bewaarbeleid (`server/bewaarbeleid-operationeel.js:129`, grond `audit`).

De zaak leert je route dus niet. **RTG legt hem wel vast**, als een reeks zaken
met tijden onder je codenaam -- en dat is een mens-plaatsgraaf in alles behalve
de naam. Het is geen kwade trouw: het actielog is ontworpen als het ene ding dat
groeit en nooit wordt herschreven (`PLAATS.md` par. 3), en dat is de juiste
eigenschap voor een log over *vensters*. Voor een log over *passages* is het de
verkeerde. Twee goede regels botsen hier, en de botsing zag niemand omdat geen
toets de opslag na een doorloop leest.

**Buiten de keten, voor de volledigheid.** `nearbyGuests` geeft elke zaak de
codenaam en de bestemming van tot twaalf leden die live onderweg zijn en niets
met die zaak te maken hebben (`server/kern/leverancier/state.js:90-93`); de
live-positie van een eenmanschauffeur is via `supplier.loc` voor elk lid een
navigeerbare pin; de positie van een bezorger staat in `db.data` onder de
aanname dat hij vluchtig is, terwijl de schijflaag elke sleutel van `db.data`
meeneemt bij de volgende `save()`. En het bewaarbeleid kent van al deze
collecties alleen de drie van de plaatslaag; de bewaarveger ruimt `db.data.live`
na zeven dagen, en de vergeetroute (`server/kern/vergeten/eigen.js`) wist `live`
en `ontmoetPosities` -- maar niet `mobFavorieten`, `mobOpdrachten`,
`flitsMeldingen`, `veilig` of `plaatsLog`.

### 6.3 Wat dat betekent voor de these

Het dubbelbewijs is dus geen formaliteit achteraf. Het is **de eerste proef die
zou zakken**, en hij zakt op een plek die niemand verdacht: niet in de
navigatie, maar in de laag die er is om de navigatie privacy-bewust te maken.

Twee dingen volgen daaruit, en ze staan in par. 14 en 15:

1. **De proef meet de keten en niet het huis.** Van de lijst hierboven raakt de
   restaurantketen er twee: de passages in `plaatsLog`, en (als het lid Onderweg
   gebruikt) `db.data.live`. Die twee moeten op nul voor de categoriepoort.
   De rest is huisbrede schuld die zichtbaar hoort te worden in plaats van
   weggepoetst -- maar hij hoort niet de these te gijzelen.
2. **De reparatie van `plaatsLog` is een besluit en geen bugfix** (B8): een
   waarneming van een hek dat niet het doel van het venster is, is geen feit
   over het bezoek. De vraag is of zo'n waarneming gelogd wordt, of alleen
   plaatselijk blijft, of dat het toestel voor een naderingsvenster maar één hek
   krijgt.

### 6.4 De permanente grondwetmeter (N10)

De vijf tellers van 6.1 zijn een eerste lezing. **De definitieve vijf komen uit
de nulmeting**, niet uit dit document, en ze worden daarna geen eenmalige
migratiecheck maar een permanente meter. Werknamen, zolang de meting ze niet
vervangt:

| teller | wat hij telt |
|---|---|
| `blijvendeNavPositie` | een positie uit een navigatieverzoek die na het antwoord nog ergens staat |
| `positieNaVenster` | een positie die er nog is nadat haar venster sloot, of die er zonder venster kwam |
| `passageLog` | een regel *deze codenaam kwam langs deze plaats* die niet het doel van het venster was |
| `aankomstUitPositie` | een domeinstand `aangekomen` (of verder) die werd gezet op grond van een positie |
| `onbegrensdeRitlijn` | een reeks posities aan een rit of opdracht zonder termijn |

**De meter telt geen gebruik als schuld.** Een positie die tijdens een taak wordt
verwerkt (categorie 1 en 2 van P-05) is `toegestaan` of `venster`, en die klassen
zijn groen. Een meter die *minder GPS* beloont, zou de navigatie slechter maken
en het verkeerde getal laten dalen (N11). Wat hij telt, is wat er na de taak
van de mens overblijft.

**Groen betekent niet dat het beleid zegt dat er geen bewegingsspoor is. Groen
betekent dat de code aantoonbaar geen verboden bewegingsspoor maakt.**

**De meter heeft twee helften, en ze worden nooit opgeteld.** Dat is de les van
`STAGE.md` (bewering B bleef groen onder een mutatie, bewering D ving hem):

1. **de bron** -- `positiestroom` leest statisch waar een positie binnenkomt, aan
   welke sleutel hij wordt gehangen, in welke collectie hij landt, met welke
   termijn en wie hem leest. Hij deelt elke stroom in één van zeven klassen in:

   | klasse | betekent |
   |---|---|
   | `toegestaan` | verlaat het verzoek niet, of is geen positie van een mens (een zaak, een halte) |
   | `venster` | bestaat alleen binnen een lopend venster en verdwijnt ermee |
   | `noodzakelijk` | is nodig voor een genoemde functie en heeft een termijn die bij die functie hoort |
   | `teLang` | heeft een termijn, maar een langere dan de functie nodig heeft |
   | `onbegrensd` | heeft geen termijn |
   | `verboden` | botst met P-05 of N3, ongeacht de termijn |
   | `onbekend` | de meter kan het niet vaststellen -- met de reden, en **nooit** stil als `toegestaan` geteld |

   De indeling is een BESLUIT per stroom en de uitslag een METING, en die twee
   staan uit elkaar, zoals in `scripts/spoorvorm.js`: welke functie een positie
   *nodig heeft* kan geen parser vinden, wat de code ermee *doet* wel.
2. **de opslag** -- een doorloop van de keten tegen een echte server, waarna de
   hele opslag wordt gelezen. Dat vangt wat de bron niet ziet: een collectie die
   *vluchtig* heet en toch met de volgende `save()` naar schijf gaat (de positie
   van een bezorger, par. 6.2).

De ratel mag alleen **omlaag** op de schulden en **nooit omlaag** op het aantal
gelezen stromen -- een schuld die daalt doordat de meter blind wordt, is de
gevaarlijkste vorm van vooruitgang (`MENSNETWERK.md`, de drie ratels van
`stilspoor`). En de meter hoort in de keuring waar hij over gaat: een register
dat door een toets wordt bewaakt, is niet gedekt door een groene keuring tenzij
die toets onderdeel is van die keuring (`npm run registerklopt`).

### 6.5 A0b staat: de eerste meting (29 september 2026)

`npm run positiestroom` (`scripts/positiestroom.js`, `POSITIESTROOM.json`,
`test/positiestroom.test.js`). Graad `vermoed`, want de detector is lexicaal.

| | |
|---|---|
| kandidaatbestanden (de noemer) | **54**, alle 54 verklaard: een stroom of een reden |
| stromen waar de positie van een mens blijft | **35** |
| zonder enige termijn | **20** |
| op een ledensleutel of codenaam die de vergeetroute niet wist | **20** |
| door de detector gemist, met de hand gevonden | **7** |
| voorstel per klasse | 9 `venster`, 3 `noodzakelijk`, 2 `teLang`, 19 `onbegrensd`, 1 `verboden`, 1 `onbekend` |
| besloten door de eigenaar | **0** |

**De ratel hangt aan wat GEMETEN is en niet aan de indeling.** Het voorstel van
6.4 was een ratel op `verboden`, `onbegrensd` en `teLang` -- maar dat zijn
voorstellen, en een voorstel kan naar beneden worden gepraat door het een ander
etiket te geven. De tanden in `NORM.json` staan daarom op de twee getallen die
uit de code komen: `positieZonderTermijn` (20) en `positieNietVergeten` (20),
allebei alleen omlaag, en `positieStromenGezien` (35) alleen omhoog. Elk heeft
een ijkproef in `test/meterijk.test.js`. De indeling kan de meting wel
tegenspreken, en dan zakt de meter: wie `onbegrensd` voorstelt terwijl het
bewaarbeleid een termijn noemt, of `venster` zonder dat iets de positie
weghaalt, krijgt een TEGENSPRAAK (vandaag 0).

**Twee mutaties op de echte code zijn gevangen**: de termijn van `plaatsLog` uit
het bewaarbeleid halen laat toets 8 en 11 zakken, en een citaatregel in
`kern/ov/reizen.js` veranderen laat de besturingsproef zakken.

**Wat de meting toevoegde aan par. 6.2**, en wat met lezen alleen niet te zien
was:

- **De zeven gemiste stromen zijn de leerzaamste.** De positie wordt daar in losse
  toewijzingen opgebouwd (`L.lat = lat`), en juist daar zitten het delen bij huur
  en charter, beide SOS-regels op een boeking, het alarm van de veiligheidskring
  en de passagelog. Een zuiver statische meter over "objecten met lat en lng" had
  precies de gevoeligste helft gemist.
- **Er zijn stromen die er GOED uitzien**, en die horen in dezelfde tabel: de
  positie van een kind tijdens een schoolexcursie verdwijnt bij het stoppen en
  meteen bij het intrekken van de toestemming, delen bij huur en charter
  verdwijnt bij uitzetten, en de bezorger verdwijnt als hij terug is. Negen van de
  35 zijn een echt venster.
- **Nieuwe onbegrensde stromen** die par. 6.2 niet noemde: de GPS van koper en
  verkoper bij een marktoverdracht (voor een bewijs dat *samen ja/nee* is), de
  positie in een datingprofiel, de SOS tijdens een date en op een boeking, en de
  bezorgadressen van drie bezorgketens naast een codenaam.
- **`zaak-live-locatie` staat op `onbekend`**, en dat is het eerlijke antwoord:
  de "live locatie" van een vervoerder overschrijft de vaste plek van de zaak, en
  of dat een voertuig of een mens is kan geen meter zien. Bij een
  eenmanschauffeur is het een persoon die als plaats aan elk lid wordt getoond.

Wat hierna komt is A0c -- de opslag lezen na een doorloop (par. 6.6) -- en
daarna A1, in de volgorde die deze tabel aanwijst.

### 6.6 A0c staat: de opslag gelezen na een doorloop (29 september 2026)

`npm run positieproef` (`scripts/positieproef.js`, `POSITIEPROEF.json`,
`test/positieproef.test.js`). Graad `gemeten`: een wegwerpserver met een eigen
datamap, twaalf stappen waarin een lid een positie stuurt, en daarna de hele
opslag (`store.db`) gelezen. Elke positie die de proef stuurt draagt een eigen
staart in de vijfde decimaal, zodat een vondst precies terug te voeren is op de
stap die haar veroorzaakte -- en een plek uit de zaaidata nooit meetelt.

| teller | stand | wat er staat |
|---|---|---|
| `blijvendeNavPositie` | **0** | route en zoeken laten niets achter -- par. 6.2 zei dat bij lezing, nu is het gemeten |
| `positieNaVenster` | **1** | na `/api/live/stop` staat de laatste positie in `live` (tot de veger hem na zeven dagen haalt) |
| `passageLog` | **2** | langs een zaak die niet het doel was: een regel bij binnen en een bij buiten, in `plaatsLog` |
| `aankomstUitPositie` | **1** | een positie binnen 150 m van de zaak zet `arrived`, zonder dat iemand iets bevestigde |
| `onbegrensdeRitlijn` | **niet gemeten** | een rit vraagt een vervoerder, een chauffeur en een betaling; die wereld zet de proef nog niet op. `null` met die reden, nooit 0 |

De verkeersmelding staat er ook (`flitsMeldingen`), en wordt apart gemeld en
niet geteld: dat is een melding die iemand bewust doet, met een levensduur in
de module. Of die levensduur in het bewaarbeleid hoort, is een besluit per
stroom (15.1).

**De ratel** staat in `NORM.json` met vier tanden die alleen omlaag mogen
(`positieNavBlijft`, `positieNaTaak`, `positiePassages`, `aankomstUitPositie`),
elk met een ijkproef in `test/meterijk.test.js`. Een stap die de proef niet kon
lopen telt in de norm als niet gemeten, en de ritlijn staat daarom met opzet niet
in die rij. A1 is de reparatie waarvoor deze vier de toets zijn die naar nul moet.

**De besturingsproef bewees zich bij de eerste ronde.** Die eerste ronde meldde
`positieNaVenster` 0, terwijl par. 6.2 zei dat Onderweg de positie na het stoppen
laat staan. De code klopte met de paragraaf en de proef niet: de stap "op de
stoep" overschreef de merktekens met de plek van de zaak, en die plek was geen
merkteken. De besturing eist daarom niet meer "een vondst ergens" maar een vondst
in `live`. Een meter die de ene positie niet terugvindt waarvan we zeker weten
dat hij er staat, is blind, en dan zijn zijn nullen niets waard.

**Wat de proef niet zegt.** Hij meet wat DEZE twaalf stappen achterlaten op een
verse server. Termijnen die pas na dagen lopen (de veger, het bewaarbeleid) zijn
nog niet verstreken, dus "staat er nog" betekent *na de taak* en niet *voor
altijd*. Die helft zegt de bronmeter (6.5). De proef loopt niet door een rit, een
bezorging of een SOS, en de 35 stromen van 6.5 zijn dus maar voor een klein deel
langs de opslag gecontroleerd.

### 6.7 A1, eerste ronde: N12, N13 en N14 uitgevoerd (29 september 2026)

Drie besluiten van 15.0 zijn gebouwd, elk met een toets die op een mutatie zakt:

| besluit | wat er veranderde | toets |
|---|---|---|
| **N12** | een naderingsvenster noemt zijn hek (`eenHek` in `kern/plaats/hekken.js`); een overgang langs een ander hek krijgt 200 met `opgeslagen: false` en komt niet in de waarnemingen en niet in het actielog | `test/plaatsdoelhek.test.js`, en `test/plaatsnadering.e2e.js` in een echte browser |
| **N13** | binnen 150 m is `nabij` een voorstel; aankomst bevestigt het lid (`/api/live/aangekomen`) of de zaak die de bestemming is (`/api/supplier/guest/aangekomen`), en de deur leest die bevestiging. Een tweede bevestiging verandert niets | `test/onderweg-positie.test.js` 5-7, en `test/grand-integratie.pg.test.js` subtoets 9 hardop omgedraaid |
| **N14** | `/api/live/stop` wist de positie; de ontmoetradar wist een positie die niet meer vers is bij elke positie, bij elke stand en via de bewaarveger | `test/onderweg-positie.test.js` 4, `test/bewaarveger.test.js` |

De positieproef ging daardoor van **0 / 1 / 2 / 1** naar **0 / 0 / 0 / 0**, en de
tanden in `NORM.json` zijn meegezakt: ze mogen alleen dalen, dus een nul die
weer een een wordt, laat de norm zakken. De besturingsproef kreeg daarbij een
ander anker, en dat is de les van deze ronde: het oude anker was de positie die
Onderweg na het stoppen liet staan, en die bestaat niet meer. **Een anker dat de
reparatie wegneemt, is geen anker**: de proef hangt nu aan de verkeersmelding,
die de plek MET OPZET bewaart (N15). Zou de lezer blind worden, dan zakt hij nog
steeds.

Wat de voorspeller hierdoor niet meer kan: nabijheid meewegen bij een zaak waar
een lid vaak komt maar die niet het doel van dit bezoek is. Dat was precies de
passagelog aan het werk, en N12 schrapt het met opzet.

### 6.8 A1, tweede ronde: N16 tot en met N21 uitgevoerd (29 september 2026)

De negentien stromen die `onbegrensd` stonden, zijn per stroom besloten (15.0) en
gebouwd. Per besluit de regel die de positie nu weghaalt; elke toets is door de
mutatiemotor gehaald (`MUTATIES.json`: alle zes zakken).

| besluit | wat er veranderde | toets |
|---|---|---|
| **N16** | bij `voltooid`, `no-show`, `afgerekend` en `geannuleerd` wist `kern/mobiliteit/ritpunten.js` de locatiegebeurtenissen, `o.positie` en de coordinaten van begin, eind en stops; het label van de factuur blijft, en een afgeronde opdracht neemt geen positie meer aan (409) | `test/ritpunten.test.js` |
| **N17** | het OV bewaart in- en uitstaphalte, afstand en prijs (`kern/ov/halte.js`); het instappunt woont tijdens de rit alleen in het geheugen. Het overzicht blijft een jaar (`server/bewaarbeleid-vervoer.js`) en de vergeetroute wist het eerder | `test/ovhalte.test.js` |
| **N18** | een SOS-positie hoort bij de melding: open, en 90 dagen na afsluiten (`kern/sospositie.js`, via de bewaarveger); een proefalarm of een alarm dat binnen een minuut is ingetrokken verliest zijn plek direct. Huur, charter, date, veiligheidskring en bewaker | `test/sospositie.test.js` |
| **N19** | de laatste plek van de kring bestaat alleen in een open venster; een patrouillering bewaart het controlepunt en geen GPS, en oude rondes verliezen hun punten | `test/kringronde.test.js`, `test/veiligheid.test.js` 3 hardop omgedraaid |
| **N20** | een bezorgpunt verdwijnt bij geleverd of geannuleerd, aan elke kant die een bestelling sluit; het adres als tekst blijft, en een modebezorging zonder punt krijgt geen verzonnen bestemming meer | `test/bezorgpunt.test.js` |
| **N21** | Vonk bewaart een vak van 5 km (`kern/vonk/vak.js`); de markt bewaart samen ja/nee en de afstand, met hooguit een wachtend punt; een gemeentemelding verliest de codenaam van de melder na afhandeling; "hier" in een reis wordt de dichtstbijzijnde plaatsnaam | `test/n21stromen.test.js` |

De grondwetmeter volgt het besluit en niet de lijst: `uitgevoerd` is waar als de
gemeten indeling gelijk is aan de besloten klasse, en dat is nu voor alle 34
besloten stromen zo. **Zonder termijn: 20 -> 1** (de live locatie van een
vervoerder, die `onbekend` blijft: of dat een voertuig of een mens is, is nog
niet besloten, par. 6.5), **niet vergeten: 20 -> 17**.

Twee blinde vlekken zaten in de METER en niet in de code, en allebei maakten ze
een uitgevoerd besluit onzichtbaar. Het bewaarbeleid werd uit een vaste lijst
delen gelezen, dus `bewaarbeleid-vervoer.js` viel erbuiten en de OV-ritten
heetten termijnloos; de meter leest nu elk deel. En de vergeetroute werd alleen
herkend als `delete db.data.X[key]`, dus een lijst die op de sleutel wordt
gefilterd (`ovRitten`) of een collectie een laag dieper (`vonk.profielen`) telde
als niet vergeten.

Wat er nog staat, met de reden:

- **Zeventien stromen op een ledensleutel die de vergeetroute niet wist.** Voor de
  meeste is dat een vensterstroom die zelf al weggaat, maar "gaat vanzelf weg" is
  niet "is weg als het lid vergeten wil worden"; dat is een eigen ronde.
- **Het alarmbericht aan de kring** (`meldAan`) draagt de plek nog in de tekst.
  Het alarm zelf verliest hem na 90 dagen, het bericht niet.
- **De markt heeft geen veger**: een verlopen wachtend punt valt weg bij de
  volgende melding in de markt, niet op een klok.
- **Een punt dat het lid zelf op de kaart koos** (`bron: 'kaart'`) blijft in een
  geplande reis staan. Dat is een bestemming en geen eigen positie, en N21 ging
  over "hier".
- **De positie van een bezorger** (`bezorgers`) is een vensterstroom en viel
  buiten N20, dat over het punt van de klant ging.

---

## 7. De reistijddienst

**Doel:** één plek die een reistijd geeft, met zijn herkomst, en die domeinen
krijgen ingespoten zoals Move hem al krijgt (`server/kern/move/index.js`: *"de
rekenaars worden ingespoten en niet geïmporteerd"*). De naam is `reistijd`
(par. 2). De rechte lijn blijft bestaan, maar alleen als terugval waar dat
verantwoord is -- en dat is een indeling en geen gevoel.

`PLANNING.md` noemde het gat al: *reistijd staat op 0 van zeven*. Vandaag roept
alleen Move `navRoute()` aan; al het andere rekent met `haversine()` en een vaste
snelheid uit `server/lib/geo.js` (26 km/u rijden, 4,8 lopen).

### 7.1 Waar een rechte lijn vandaag geld of een toezegging draagt

| plek | domein | wat eraan hangt | gelabeld als schatting? |
|---|---|---|---|
| `server/kern/mobiliteit/opdracht.js:92-98` | dispatch | **de ritprijs** (basis + per km + per minuut) -- en `keten.js:60` zegt het lid *"De prijs van uw rit staat vast"* | nee |
| `server/kern/lidacties/ritten.js:58-61` | taxi (app) | **de offerte**; zonder punt valt hij terug op 9 km (taxi), 60 (heli), 350 (jet) | nee |
| `server/kern/ov/reizen.js:67-73` | OV | **het tarief** van in- tot uitchecken, direct geboekt | alleen in commentaar |
| `server/kern/mobiliteit/kaartje.js:104` | OV-kaartje | **de kaartjesprijs** | nee |
| `server/kern/mobiliteit/matching.js:120-124` | dispatch | **een kandidaat wordt afgewezen** boven 25 minuten aanrijtijd | ja, "ongeveer" |
| `server/kern/vonk/halfweg.js:136-140` | Vonk | **"gelijke reistijd" is de belofte**, en drie plekken worden erop gerangschikt | alleen in commentaar |
| `server/kern/bezorgvolg.js:179, 190-191` | bezorging | **de ETA aan de klant** | **misleidend**: `etaBron: 'gemeten'` terwijl het rijdeel een rechte lijn op 26 km/u is |
| `server/kern/mall/plek.js:140, 158` | Mall | **of een aanbieder een plaats bedient** | nee |

### 7.2 De indeling

Drie klassen, en een afnemer kiest er één -- de dienst kiest niet voor hem:

- **weergave** (sorteren, "ongeveer 8 min"): terugval op de rechte lijn mag, met
  `graad: 'vermoed'` en `herkomst: 'hemelsbreed'` in het antwoord.
- **toezegging** (een belofte aan een mens, een afwijzing, een geschiktheid):
  terugval mag alleen **zichtbaar** -- het scherm zegt dat het een schatting is.
- **geld** (een prijs, een tarief, een vergoeding): **geen terugval**. Zonder
  echte route is er een weigering met de reden en de weg eromheen (een
  vaste-prijsafspraak, of een prijs achteraf op de gereden afstand), nooit een
  bedrag op een hemelsbreed getal.

De ritprijs is de zwaarste omzetting, want de belofte *de prijs staat vast* staat
er al. Of die prijs straks op de route of achteraf wordt bepaald, is een besluit
(par. 15) en geen bouwtaak.

### 7.3 Wat de dienst teruggeeft (N4)

Meer dan minuten. Een antwoord van `reistijd` draagt:

| veld | inhoud |
|---|---|
| `route` | de geometrie, als die er is -- en alleen voor de vrager; hij wordt niet bewaard |
| `wegafstand` | meters over het net, of `null` met de reden |
| `reistijd` | minuten |
| `graad` | `gemeten`, `vermoed` of `onbekend` (de vier graden van `BESTUUR.md`; `bewezen` hoort hier pas bij een gekalibreerde meting) |
| `bron` | welk net (NWB, een gebiedspakket, het oefenraster, de rechte lijn) en welke signalen meewogen |
| `onzekerheid` | **een bandbreedte alleen als hij gemeten is**; anders `null` met de reden |
| `weigering` | als er geen antwoord is: waarom, en de weg eromheen (`dekking.js` heeft die vorm al) |

Het veld `onzekerheid` verdient een waarschuwing, want het is precies waar N7
vandaan komt. Een bandbreedte is een belofte over trefzekerheid, en die mag er
pas staan als hij over afgesloten perioden is gemeten -- de vorm van
`server/kern/kosten/vooruitblik.js`, die zijn bandbreedte pas toont na drie
afgesloten maanden. Tot die tijd is het eerlijke antwoord `null` met *"nog niet
gemeten"*, en niet een formule met een plus-minteken ervoor.

### 7.4 Vijf grootheden die niet door elkaar mogen (G)

De gebreken van par. 12 zijn geen losse fouten. Twee functies roepen `haversine`
verkeerd aan, andere domeinen nemen een rechte lijn waar een wegafstand nodig
is, en een ETA heet *gemeten* terwijl hij geschat is. Dat is één oorzaak: **er is
geen afgedwongen geografische waarheidslaag.** Een kaal getal in meters of
minuten kan elk van deze vijf zijn:

| grootheid | wat het is | mag geld dragen? |
|---|---|---|
| `afstandRecht` | hemelsbreed, in meters | nee |
| `wegafstand` | over het net, in meters | ja, met de bron erbij |
| `reistijd` | een verwachting over het net | als toezegging, met de graad |
| `gemetenReistijd` | een reistijd die achteraf is waargenomen -- door het domein, niet door een bewegingsspoor | ja |
| `geschatteReistijd` | een rechte lijn gedeeld door een vaste snelheid | nee; alleen weergave |

De reparatie hoort op de oorzaak (`LAT.md` regel 1): een API die een waarde met
haar soort teruggeeft in plaats van een kaal getal, zodat een prijsformule een
`afstandRecht` kan WEIGEREN in plaats van hem stil te vermenigvuldigen. Pas daarna
de gebreken -- want wie ze een voor een repareert, laat de deur open voor
het elfde.

Let op één naam: `gemetenReistijd` mag nooit uit een bewegingsspoor komen (N1,
N3). Wat hier *gemeten* heet, is een vertrek en een aankomst die een domein
bevestigde, en niet de reeks punten ertussen.

---

## 8. Proef 2: een tweede domein

Eén restaurantstroom kan nog maatwerk zijn. Pas als een tweede domein **dezelfde**
keten `plaats → reistijd → navigatie → doorgave` gebruikt zonder een tweede
locatiearchitectuur te bouwen, is het een horizontale laag. Twee kandidaten:

**Bezorging** bewijst het meest nieuwe. Hij raakt de stap die in het restaurant
ontbreekt -- een adres wordt een punt, en de klantdeur is geen bekende plaats --
en hij kent een echt doorgave-artefact. Maar er zijn **drie bezorgketens** die
elkaar niet kennen:

1. de bezorgdienst (`server/routes/member/kopen/bezorg.js`): een vrij adres plus
   een optionele lat/lng van de client; `bezorgd` is een knop zonder code of foto;
2. RTG Eten in de horeca (`server/routes/gast/bezorgen.js`): een ETA uit de
   ingestelde zone, niet uit de geografie;
3. modebezorging (`server/kern/modebezorg/`): de sterkste doorgave van het huis
   (pincode, identiteitscontrole, foto, `koerier.js:40-56`) -- en een
   **verzonnen bestemming** als er geen coördinaat is (par. 12, gebrek 5).

En `scripts/ritproef.js` koos bezorging eerder met opzet NIET, omdat hij *"de
rekening, de kaart en de keuken deelt met de tafel -- dan meet je bijna hetzelfde
nog een keer"*.

**Taxi** is onafhankelijker: andere actoren, eerst betalen dan leveren, en een
bestaande proef (`scripts/ritproef.js`). Maar zijn plaatsstap is triviaal (bekende
plekken en een live positie), `aangekomen` is een knop van de chauffeur, en er is
geen doorgave-artefact.

**Voorstel:** bezorging, en dan de modebezorgketen als basis -- omdat de proef
de LAAG moet bewijzen en niet het domein, en omdat bezorging precies de twee
stappen draagt die het restaurant niet raakt (adres → punt en een onbekende
deur). Het bezwaar van `ritproef.js` geldt voor de rekening en de keuken; deze
proef meet de weg ernaartoe, en daar delen ze niets. Het is een besluit (par. 15).

---

## 9. Spoor 2: de geografische fundering

Als Nederland goed werkt en België een oefenraster krijgt, is er geen serieuze
navigatielaag. Dit is dus **geen fase 7** maar een tweede spoor dat vanaf het
begin naast het eerste loopt.

### 9.1 Wat er staat

- Nederland: het NWB van Rijkswaterstaat (CC0), zelf ingelezen zonder
  GIS-module (`scripts/navigatie-nederland.js`, `NEDERLAND-WEGENNET.md`). Het
  pakket draagt wegen, knopen, een r-tree en een FTS5-index over **straatnamen,
  woonplaatsen en gemeenten -- zonder huisnummers en zonder postcodes**.
- De catalogus van alle andere gebieden (OSM via Geofabrik, ODbL 1.0) met de
  licentie als grendel en een gebiedskeuze op verklaarde omvatting
  (`server/kern/navigatie/gebieden.js`, `gebiedkeuze.js`).
- Het pakket op het toestel: acht graafbestanden, sha256 per deel
  (`server/kern/navigatie/toestelpakket.js`, `public/shared/kaartpakket.js`).

### 9.2 Wat er niet staat

| onderdeel | stand | waarom |
|---|---|---|
| **OSM-bouwer** (`.osm.pbf` → graaf) | **een stap weg in code, niet te bewijzen hier** | protobuf en zlib-inflate zonder externe modules; `node:zlib` is ingebouwd, protobuf niet. De proxy van deze omgeving weigert Geofabrik (403) |
| **adresindex in het pakket** | **een stap weg** | voor *"Rue X, Parijs"* zonder externe geocoder moet het pakket zelf de zoekinformatie dragen: straat, huisnummer en postcode uit de `addr:*`-tags. Het NL-pakket heeft geen huisnummers; PDOK doet dat nu online, en PDOK is alleen Nederland |
| **zoeken op het toestel** | **vraagt een besluit** | de `.sqlite` gaat met opzet niet mee (`toestelpakket.js:22-28`): zoeken blijft online. Een zelfstandig geografisch pakket vraagt dat die keuze wordt herzien, met de grootte erbij |
| **routeren op het toestel** | **een stap weg** | de graaf staat er, de motor niet; de server meldt eerlijk `opToestel: null` |
| **versies en delta's** | **jaren weg** | `graaf.json.versie` is een formaatnummer, geen dataversie; een nieuw pakket vraagt een herstart (`gebiednetten.js:25-27`) |
| **ondertekening** | **een stap weg** | sha256 per deel, maar geen handtekening op het manifest. Het patroon staat al in `TOESTEL.md` par. 9.3 voor modellen (sleutel → handtekening → hash → licentie, WebCrypto in de browser) en kan hergebruikt worden |
| **standen van een gebied** | **een stap weg** | twee sets die elkaar tegenspreken: `gebieden.js:22-24` kent `aangeboden / gebouwd / actief`, `KAARTEN.md` par. 1 `aangeboden / gebouwd / gekozen`. Daarbij komt een vierde as die nergens een naam heeft: *op dit toestel en offline te routeren* |
| **pakketgrootte** | **een stap weg** | `bronBytes: null`, omdat het een HEAD-verzoek per gebied vraagt |

**De conclusie die het spoor bepaalt:** een downloadbare kaart wordt hier een
**zelfstandig geografisch pakket** -- wegen, adressen, plaatsnamen, licentie,
herkomst, versie en handtekening in één geheel. Dat past bij local-first, en het
is de voorwaarde voor P-01 buiten Nederland: zonder adresindex in het pakket kan
een Franse zaak geen geldige plaats krijgen.

---

## 10. Samen reizen: halverwege, eerlijk, privé

**Halverwege afspreken bestaat al**, en dat wist dit voorstel niet:
`server/kern/vonk/halfweg.js` kiest drie plekken op *gelijke reistijd* voor twee
mensen, met een `waarom` die telt wat er per reden afviel. Hij rekent met de
rechte lijn (par. 7.1), en hij krijgt beide posities.

De vorm die bij `PLAATS.md` past is omgekeerd: **de server stuurt kandidaat-plekken
naar elk toestel, elk toestel rekent lokaal zijn reistijd, en alleen die getallen
komen terug.** Dan ziet niemand, ook RTG niet, waar de ander is. Dat vraagt
routeren op het toestel (par. 9.2) en is daarom **een stap weg na spoor 2**.

Drie regels daarbij:

- **Eerlijkheid is een zichtbare keuze**, geen verborgen weging: *minste totale
  reistijd* of *niemand langer dan X*, en het scherm zegt welke. Dat is de regel
  van de mixer uit `CONNECT.md`: plekken verdelen, geen punten wegen.
- **Een uitnodiging aan een tweede mens bevestigt een mens** (`LIFE.md`).
- **Aanwezigheid wordt nooit afgeleid** (`ONTMOETEN.md` par. 4).

**Blind Navigation** staat open, omdat de naam twee dingen kan zijn die elkaar
uitsluiten: navigatie voor blinden en slechtzienden (toegankelijkheid,
`TOEGANKELIJK.md`), of een route waarvan de bestemming verborgen blijft
(verrassing of privacy). Par. 15.

---

## 11. Wereldkennis: wat wel en wat niet

| onderdeel | mag | stand |
|---|---|---|
| **wijzigingen op plaatsen** (een zaak sluit, een ingang verhuist, wegwerk) | ja -- het zijn plaatsfeiten uit een bron (P-05) | **een stap weg**: de bronnen bestaan, de samenkomst niet |
| **voorspelling over een plaats** | ja, met een getal pas als de trefzekerheid over drie afgesloten perioden is gemeten (INT-04, de vorm van `server/kern/kosten/vooruitblik.js`) | **jaren weg** |
| **voorspelling voor een mens** | alleen over *nu*, zoals `PLAATS.md` fase 3 al doet: nabijheid verandert een volgorde en leert nooit iets | **staat** |
| **"persoonlijke wereld"** die leert waar iemand komt | **nee** -- dat is de locatiegeschiedenis van `PLAATS.md` par. 6 | vervalt |
| **drukte uit aanwezigheid** | **nee** -- P-05 | vervalt |
| **"contextuele Saloon"** | als dat Salon-berichten per plek zijn: alleen als het een plaatsfeit is dat de zaak zelf publiceert, nooit als kaart van waar leden posten | vraagt een besluit (par. 15) |

Wat er van *World Intelligence* overblijft is kleiner en scherper: **de plaats
weet wat haar bronnen zeggen, en zegt erbij wie dat zei.** Dat is geen verlies;
het is de these.

---

## 12. Gebreken die deze ronde vond

Gelezen in de bron, **niet gerepareerd en niet gedraaid**. Ze staan hier omdat
een ontwerpronde die een gebrek ziet en het verzwijgt, het huis slechter
achterlaat. Elk hoort een eigen reparatie met een toets die eerst zakt.

1. **`POST /api/supplier/location` gooit bij een zaak zonder locatie.**
   `server/routes/supplier/vervoer.js:12` leest `req.supplier.loc.label` terwijl
   `loc` `null` is op elke echt geregistreerde zaak. Zonder label in het verzoek is
   dat een TypeError.
2. **Move leest wandkloktijd als UTC.** `server/kern/move/naad.js:70` plakt
   `':00Z'` achter dag en uur. Verschillen tussen twee tijden kloppen, maar
   `volgende()` vergelijkt met `Date.now()` (`server/kern/move/index.js:125`) en
   zit er dan de tijdzone van de zaak naast.
3. **Move verwijst naar drie schermen die niet bestaan.**
   `server/kern/move/gevolg.js:41-49`: `/apps/reserveren.html`,
   `/apps/portaal.html` en `/apps/vervoer.html`. Een lid dat te laat is en op het
   voorstel tikt, komt nergens.
4. **De navigatie toont een formule als zekerheid.**
   `server/kern/navigatie/intelligentie.js:103` rekent `vertrouwen` als
   `96 - 3 × signalen (+ live)`, begrensd op 72-99, en `navigatie.html:713` toont
   dat als *"% aankomstzekerheid"*. Dat is geen gemeten trefzekerheid, en INT-04
   verbiedt precies dit getal.
5. **Modebezorging verzint een bestemming.** `server/kern/modebezorg/winkel.js:66`
   zet zonder coördinaat de bestemming op de zaak plus (0,01; 0,008) en rekent
   daar een ETA naartoe. Daarnaast wordt `straalKm` opgeslagen en nergens
   afgedwongen.
6. **De straalzone van horecabezorging kan niet werken.**
   `server/kern/horeca/bezorglaag.js:35` toetst `zaak.lat`, maar een zaak draagt
   `s.loc.lat`; en regel 36 roept `haversine()` aan met vier getallen terwijl hij
   twee punten verwacht (`server/lib/geo.js:7`), wat `null` geeft. Zou de tak
   ooit lopen, dan is `null <= straalKm` waar en valt elk adres in de eerste zone.
7. **De bezorgroute van horeca staat in invoervolgorde.**
   `server/routes/supplier/horeca/bezorgrit.js:35` leest `req.supplier.lat`
   (bestaat niet) en regel 43 heeft dezelfde vier-getallenaanroep; de toets in
   `test/horeca-bezorg-club.test.js` blijft groen omdat 0 ≤ 0.
8. **De bezorg-ETA heet gemeten en is het niet.** `server/kern/bezorgvolg.js`
   zegt `etaBron: 'gemeten'` over een rit die als rechte lijn op 26 km/u is
   gerekend -- en `etaBron` wordt nergens in `public/` getoond.
9. **Twee sets gebiedsstanden** (par. 9.2): code en `KAARTEN.md` noemen de derde
   stand anders.
10. **`scripts/navigatie-index.js:198`** telt `!g.bron` terwijl het veld
    `downloadAdres` heet, dus "zonder downloadadres" is altijd gelijk aan het
    totaal.
11. **Onderweg verzint een positie van een mens.** Start een lid Onderweg zonder
    positie, dan zet `server/routes/member/onderweg.js:21` er zelf een neer: de
    bestemming plus (0,012; -0,014), ruim een kilometer ernaast. Die punt wordt
    daarna als live-positie van de gast aan de zaak getoond (`guestLoc` in
    `server/kern/leverancier/state.js`). Dit is gevonden bij de meting van par.
    6.5 en is ernstiger dan de verzonnen bestemming van gebrek 5: daar gaat het om
    een pakket, hier om waar een mens zou zijn. **Gerepareerd op 29 september
    2026**: de server vult geen positie meer in (ook het hotel van de eigen reis
    niet), `liveStateFor` draagt `positie` met de reden als hij leeg is, en de app
    vraagt bij het starten de echte positie. `test/onderweg-positie.test.js` zakte
    vooraf op alle drie de toetsen.
12. **Een noodoproep van personeel toont nooit het label van de plek.**
    `server/routes/supplier/tafels-team.js:88` schrijft
    `alarm.label || lat.toFixed ? ... : ''`, en door de voorrang van `||` boven
    `?:` is dat altijd waar; het kantoor krijgt dus steeds de ruwe coordinaten.

Gebrek 6 en 7 hebben dezelfde oorzaak: `haversine(a, b)` neemt twee punten, en
een aanroep met vier getallen geeft stil `null` in plaats van een fout. Een
reparatie op de oorzaak (`LAT.md` regel 1) maakt die aanroep onmogelijk of
luid, en niet alleen deze twee plekken goed.

---

## 13. De categoriepoort

Niet wanneer dit document af is. Niet wanneer het scherm mooi is. Niet wanneer
105 toetsen groen staan. **Pas wanneer alle zes op `bewezen` staan**, met de graad
en de datum erbij (`BESTUUR.md`: vervallen bewijs is geen bewijs):

| # | voorwaarde | stand vandaag |
|---|---|---|
| 1 | de Nederlandse restaurantketen sluit | **niet gemeten** -- er is geen proef; bij lezing staan 9 van 20 schakels, en 2 daarvan alleen voor de anonieme Arrival-pas |
| 2 | de storingsmatrix houdt | **niet gemeten** -- bij lezing houden er 2 van 10 en 1 voor de helft |
| 3 | het dubbelbewijs staat op nul, als **permanente** meter en niet als eenmalige check (N10) | **gezakt bij lezing** -- geen van de vijf tellers staat op nul, en de keten raakt er twee (par. 6.2) |
| 4 | zaakregistratie → kaart | **gezakt bij lezing** -- `loc: null` op vijf wegen |
| 5 | echte route → doelaankomst → doorgave aan het domein | **gezakt bij lezing** -- er is geen doorgave |
| 6 | een tweede domein hergebruikt dezelfde keten zonder eigen locatiearchitectuur | **niet gemeten** -- en bij lezing heeft bezorging er drie |

`niet gemeten` is hier een eersteklas uitslag en geen "nog niet rood". Tot alle
zes op `bewezen` staan, heet dit intern de **plaats-these**:

> *RTG kan de fysieke bedoeling van een mens beter ondersteunen door plaatsen en
> operationele bronnen rijker te maken, zonder een bewegingsprofiel van die mens
> op te bouwen.*
>
> Proef 1: het restaurant. Proef 2: een tweede, onafhankelijk domein. Bewijs:
> kunnen, niet hoeven, en onder storing.

Pas als die drie soorten bewijs rond zijn, promoveert de these naar
infrastructuur. Dat is sterker dan zeggen *wij zijn anders dan een kaart*: de
architectuur en de meetuitslagen laten het zien, of ze laten het niet zien.

---

## 14. De volgorde: twee sporen

**Spoor 1 -- Nederland en de categorieproef.**

| stap | wat | vorm |
|---|---|---|
| **A0a** | **`plaatsvorm`**: wat verstaat RTG vandaag onder een plaats? Per bron: geometrie, etiketten, privacy, zichtbaarheid, toestand, bewijs en wie hem leest. Met de lezer van `scripts/objectmodel.js`. Niet om een schema af te dwingen maar om de inconsistenties zichtbaar te maken | **staat** (par. 14.1): geen gedeelde vorm |
| **A0b** | **`positiestroom`**: elke plek waar een positie binnenkomt, wordt verwerkt, aan een sleutel of codenaam wordt gekoppeld, wordt opgeslagen (hoe lang, waarvoor) en wordt gelezen -- met per stroom een van zeven klassen (par. 6.4) | **staat** (par. 6.5) |
| **A0c** | de vijf tellers als toets die de OPSLAG leest na een doorloop, met een ratel die alleen omlaag mag (N10) | **staat** (par. 6.6): 0 / 1 / 2 / 1, de ritlijn niet gemeten |
| **A1** | N2 en N3 uitvoeren, in de volgorde die A0b aanwijst: de passages uit `plaatsLog`, aankomst niet meer uit een opgeslagen positie, en per positieopslag doel, minimum, termijn en noodzaak | reparatie, met A0c als de toets die groen wordt |
| **G** | de geografische grootheden uit elkaar (par. 7.4), zodat een API het moeilijk maakt ze te verwarren -- en pas dan de gebreken van par. 12 | op de oorzaak, niet per gebrek |
| **A** | een zaak krijgt een geldige plaats: de adreszoeker geeft de coördinaat mee als VOORSTEL, de zaak bevestigt, en de poort van P-03 staat aan de bron | aansluiten |
| **R** | de reistijddienst met de drie klassen van par. 7.2 | één plek, ingespoten |
| **D** | ingang en parkeren als plaatsfeiten die de zaak zelf levert | besluit, dan aansluiten |
| **M** | de reserveringsbron in de reiswereld (par. 4, schakel 8) en de doorgave (schakel 13) | naden |
| **P1** | de restaurantketen als proef, met storingen en dubbelbewijs | `scripts/`-proef in de vorm van `tafelproef.js` |
| **P2** | de tweede keten | idem |

**Spoor 2 -- de geografische fundering**, vanaf het begin ernaast: OSM-bouwer →
routeergraaf → adresindex → plaatsindex → licentie en herkomst → offline pakket
→ versies en delta's → hash en handtekening → de levenscyclus van een gebied.

**Bewust als laatste:** alles uit par. 10 dat routeren op het toestel nodig
heeft, en alles uit par. 11 dat een voorspelling met een getal wil.

De volgorde is niet vrij. Wie P1 bouwt vóór A0b, bouwt een keten waarvan niemand
kan zeggen welk bewegingsspoor hij achterlaat (N10). Wie P1 bouwt vóór A, bouwt
een proef die bij schakel 2 zakt. Wie D bouwt vóór A0a, legt een ingang aan een
`Place`-type dat de meting misschien niet rechtvaardigt. En wie de gebreken van
par. 12 een voor een repareert vóór G, repareert symptomen: over zes maanden
gebruikt iemand weer een hemelsbrede afstand als taxiprijs.

### 14.1 A0a staat: de plaatsvorm (29 september 2026)

`npm run plaatsvorm` (`scripts/plaatsvorm.js`, `PLAATSVORM.json`,
`test/plaatsvorm.test.js`). Graad `vermoed`, met de lezer van
`scripts/objectmodel.js` zodat de getallen naast `OBJECTMODEL.json` en
`PLANVORM.json` te leggen zijn. De domeinlijst wordt AFGELEID en niet
geschreven: een plaatsvorm is een objectvorm die een plaats draagt, onder twee
drempels -- RUIM (een coordinaat of een plaatsveld, adres inbegrepen) en SMAL
(lat en lng of lon).

| | RUIM | SMAL |
|---|---|---|
| plaatsvormen / domeinen | 57 / 30 | 18 / 8 |
| velden naast het punt | 175 | 39 |
| in alle domeinen | **0** | **0** |
| in minstens de helft | 0 | 0 |
| in precies een domein | 90,3% | 89,7% |
| schrijfwijzen van een punt | 5 | 2 |
| met een zichtbaarheids- of privacyveld | **0** | **0** |
| met geen enkel aspect naast de plek | 42,1% | 38,9% |

**Er komt dus geen `Place`-objecttype.** Wat overleeft is dezelfde vorm als bij
de andere zes metingen: een projectie met etiketten, waarin elk domein zijn
plaats houdt en de plaatslaag ernaar verwijst met een herkomst (P-06).

**De leerzaamste regel is de zevende.** Geen enkele vorm die een plaats draagt,
draagt ook een veld over wie hem mag zien. P-03 zegt dat de privacypoort aan de
bron staat, en in de vorm van de data is die poort er vandaag niet: waar hij
bestaat, zit hij in de code die de plaats toont en niet in de plaats zelf. Dat
is een ondergrens (de as is lexicaal), maar een nul over 57 vormen is geen
toeval.

**De meter betrapte zichzelf bij de eerste ronde.** SMAL meldde "lat en lng
staan in alle domeinen" -- onvermijdelijk, want SMAL selecteert op precies die
twee velden. De velden die een vorm tot plaatsvorm maken, doen daarom niet mee
aan de vergelijking. De vraag van de vorm-as is wat de domeinen NAAST hun punt
delen, en dat is ook de vraag van P-01. Toets 1 zakt zodra die uitzondering
verdwijnt.

**Wat de meting niet ziet, en dat is veel.** De lezer leest alleen literalen met
een `id` en zonder geneste accolades. De zaak zelf (`kern/leverancier`, met
`loc`) en de plaatslaag (`kern/plaats`) komen daardoor niet in de uitslag -- de
twee bronnen die voor dit document het meest tellen. Het woord `plek` vangt aan
de andere kant ook dingen die geen plaats zijn (winkellijsten, een koopbaar).
Allebei verzwakken ze een conclusie over gedeeldheid in de veilige richting:
een gemiste vorm kan een gedeelde vorm verbergen, maar twee drempels die het
allebei op nul zetten, maken dat onwaarschijnlijk. En wie een plaats LEEST staat
er met opzet niet in: dat is een eigenschap van de aanroepers en niet van de
vorm (`nietGemeten`).

---

## 15. Besluiten van de eigenaar

### 15.0 Genomen op 29 september 2026

De codelezing liet zien dat de these scherper is dan de implementatie: het huis
zegt *geen bewegingsspoor*, en er ontstaat er technisch op meerdere plekken nog
wel een. De eigenaar koos daarom eerst voor de fundering en niet voor nieuwe
navigatiefuncties. Elf besluiten; N11 kwam later die dag, om te voorkomen dat de
andere tien als *minder GPS* worden gelezen:

| # | besluit | wat het vastlegt |
|---|---|---|
| **N1** | **P-05 is hard** | een plaats wordt rijker uit bronnen en domeingebeurtenissen, nooit uit het bewegingsspoor van bezoekers; *technisch handig* is geen uitzondering |
| **N2** | **centrale bewegingsopslag wordt afgebouwd** (richting van B8) | eerst de nulmeting; daarna per opslag **doel, minimale gegevens, levensduur en noodzakelijkheid** afdwingen. Niet blind verwijderen: de eerste vraag bij elke opslag is *waarom bestaat hij* (rituitvoering, veiligheid, een geschil, fraude, de werkelijk gereden afstand, bescherming van bestuurder of passagier). `plaatsLog` met passages onder een codenaam past niet bij de these. De punten van een rit NA de rit bewaren is geen termijnvraag maar een besluit: zie B10 |
| **N3** | **aankomst wordt nooit uit een opgeslagen positie bewezen** (scherper dan B9) | nadering mag binnen een venster HELPEN; het aankomstBEWIJS komt van het domein of de mens. Een hek-overgang is dus ook geen aankomst, alleen een nadering. `test/grand-integratie.pg.test.js:306-308` handhaaft vandaag het tegendeel en moet om -- hardop, als besluit, en niet als toets die stil wordt aangepast |
| **N4** | **`reistijd` is de naam** | en de dienst geeft meer terug dan minuten: route, afstand, graad, bron, onzekerheid en de reden van een weigering (par. 7.3) |
| **N5** | **`doorgave` is de domeingrens** | de navigatie brengt tot een overdraagbaar punt en geeft minimale context door; daarna is het ontvangende domein eigenaar. **Er komt geen centrale reiseigenaar** (par. 4, schakel 13) |
| **N6** | **een rechte lijn wordt nooit stil waarheid** (richting van B3) | `haversine` draagt de graad `vermoed`; waar geld, een harde toezegging of veiligheid ervan afhangt, is geen echte route geen verzonnen zekerheid. Ritprijs, taxi-offerte, OV-tarief, kaartjes en bezorging worden expliciet ingedeeld. Welke uitweg per afnemer (prijs achteraf, vaste prijs op de route, weigeren) blijft per afnemer een besluit |
| **N7** | **"% aankomstzekerheid" gaat van het scherm** tot hij gekalibreerd is | de formule mag een interne heuristiek blijven, maar wordt niet als gemeten waarschijnlijkheid gepresenteerd (par. 12, gebrek 4) |
| **N8** | **het restaurant is de gouden proef** (proef 1) | niet Vonk, taxi of bezorging eerst: het raakt Plaats, Navigatie, Move, Horeca, Arrival en betaling tegelijk, en staat al op 9 van 20. Het TWEEDE domein (B4) blijft open |
| **N9** | **internationaal loopt parallel** | Nederland is de eerste bewijsomgeving en niet de architectuurgrens. Een buitenlandse bestemming komt nooit meer ongemerkt op het oefenraster terecht alsof het een echte route is |
| **N10** | **de terughoudendheidstellers worden een permanente grondwetmeter** | geen eenmalige migratiecheck. *Groen betekent niet dat het privacybeleid zegt dat RTG geen bewegingsspoor maakt; groen betekent dat de code aantoonbaar geen verboden bewegingsspoor maakt.* De vijf tellers komen uit de nulmeting en niet uit dit document (par. 6.4) |
| **N11** | **niet doorschieten: privacy is geen excuus voor een slechter product** | de vraag is niet *hoe weinig GPS kunnen we gebruiken* maar *hoeveel waarde halen we uit een positie op het moment dat de mens die nodig heeft, zonder er daarna meer over die mens aan over te houden dan noodzakelijk*. Tijdens een taak mag alles wat goede navigatie vraagt (par. 1.1). De server mag een positie kennen **voor een uitdrukkelijke functie, alleen wat die nodig heeft, alleen zo lang als nodig, alleen voor bevoegde ontvangers, en nooit stil hergebruikt voor een bewegingsprofiel** -- een ophaalpunt voor een taxi, een alarm, live delen met een vriend, een bezorging. Het technisch ambitieuze pad is intelligentie naar het TOESTEL verplaatsen, niet de server dom maken |

Later die dag, na de eerste twee metingen (par. 6.5 en 6.6), vier besluiten
erbij. Ze staan per stroom in `scripts/positiestroom.js` (`BESLUITEN`), en of een
besluit is UITGEVOERD wordt daar afgeleid en niet opgegeven: pas als de gemeten
indeling gelijk is aan de besloten klasse, staat hij op uitgevoerd.

| # | besluit | wat het vastlegt |
|---|---|---|
| **N12** | **alleen het doelhek wordt bewaard** | een waarneming langs een ander hek wordt tijdens het venster verwerkt en niet opgeslagen; het venster zelf blijft als auditspoor. `plaats-passages` gaat naar `toegestaan`, en `test/plaatsnadering.e2e.js` (die de opgeslagen passage als bewijs gebruikte dat de motor draaide) gaat hardop om |
| **N13** | **aankomst bevestigt de klant of de zaak, en allebei mag** | nabijheid wordt een voorstel ("Bent u er?"); aankomst bestaat pas als het lid tikt of de zaak het zet (kassa, host, reservering). Wie van de twee het eerst bevestigt, is genoeg. De deur ter plaatse leest die bevestiging en niet de positie. Uitwerking van N3 |
| **N14** | **wissen bij stoppen** | Onderweg en de ontmoetradar wissen de positie op het moment dat de taak stopt; de veger van zeven dagen blijft alleen als vangnet. Van `teLang` naar `venster` |
| **N15** | **de vensters en de noodzakelijke stromen zijn aanvaard** | de negen `venster`- en drie `noodzakelijk`-voorstellen van par. 6.5 zijn besluiten zoals ze stonden. De negentien `onbegrensd`-stromen worden per stroom apart beslist (N16-N21) |
| **N16** | **de rit: punten weg bij afronden** (dit beantwoordt B10) | de ritlijn wordt gewist bij afronden; afstand, duur en begin- en eindplek zoals op de factuur blijven. Het ophaalpunt is tijdens de rit exact en wordt bij afronden het adres of de plaatsnaam van de factuur |
| **N17** | **het OV: halte in plaats van punt, een jaar** | het tarief heeft een afstand nodig en geen punt; na het rekenen blijven in- en uitstaphalte en afstand een jaar, eerder te wissen via de vergeetroute |
| **N18** | **een SOS hoort bij de melding** | de positie blijft zolang de melding open is en 90 dagen erna (klacht, verzekeraar, politie); een proefalarm of een binnen een minuut ingetrokken SOS verdwijnt direct. Geldt voor huur, charter, date, het alarm van de kring en een incident van een bewaker |
| **N19** | **de kring alleen in een venster, de ronde zonder GPS** | de laatste plek van de veiligheidskring bestaat alleen zolang de kring een venster open heeft; bij een patrouille bewijst het controlepunt de ronde en wordt de positie van de bewaker niet bewaard |
| **N20** | **een bezorgpunt verdwijnt bij levering** | coordinaat en laatste koerierpositie verdwijnen bij geleverd of geannuleerd; het adres blijft bij de bestelling. Een verzonnen punt (par. 12, gebrek 5) bestaat niet meer: geen punt is geen punt |
| **N21** | **vier stromen zonder punt** | Vonk alleen een vak van 5 km; de marktoverdracht alleen samen ja/nee en de afstand; een gemeentemelding houdt haar plek maar verliest de codenaam van de melder na afhandeling; een reis die "hier" begint, bewaart de dichtstbijzijnde plaatsnaam |

Plus twee afbakeningen die bij de besluiten horen:

- **Schakel 18 is voor V1 geen eis.** Na de betaling stuurt het domein de
  navigatie niets. Horeca voltooit zijn eigen proces; Move kijkt naar de
  expliciete toekomstige verplichtingen in de tijdlijn wanneer de mens daarom
  vraagt of een toegestane stroom dat vereist. Een signaal *"hij is klaar met
  eten"* zou precies de koppeling maken die de doorgave moet voorkomen.
- **De keten wordt pas gebouwd als meetbaar is welke geografische informatie
  hij achterlaat.** Dan kan het eind niet alleen *20 van 20 schakels bewezen*
  zeggen, maar daarnaast *5 van 5 verboden bewegingstellers = 0*.

**Een correctie op de naam.** Het voorstel noemde de tweede meter een
*spoormeter*. In dit huis is een **spoor het auditspoor**: `scripts/stilspoor.js`,
`spoorvorm.js` en `laatspoor.js` gaan alle drie over het logboek dat een
handeling hoort na te laten, en `LAT.md` regel 13 eist zo'n spoor juist. "Geen
spoor" en "spoor verplicht" zouden dan in één huis over twee dingen gaan. Deze
documenten zeggen daarom **bewegingsspoor** waar ze posities bedoelen, en de
meter heet **`positiestroom`** (gemeten vrij).

**B10 hoort erbij, en hij is door N2 zichtbaar geworden: de punten van een rit ná
de rit.** Een vervoersopdracht bewaart tot zestig posities zonder termijn (par.
6.2). Er kunnen goede redenen voor zijn -- een geschil over een rit, fraude, de
werkelijk gereden afstand, bescherming van bestuurder en passagier. Maar
`PLAATS.md` grens 1 zegt: *buiten een lopend venster bestaat er geen reeks
punten*, en na het sluiten blijft *hoogstens de laatste bekende plek*. Punten
bewaren nadat de rit voorbij is, mag onder die tekst niet, ook niet kort. Dus
dit is geen termijn die je invult maar een besluit, en de opties staan in 15.1.

### 15.1 Nog open

Wat hieronder staat is niet door 15.0 beslist. B3, B8, B9 en B10 hebben een
richting (N6, N2, N3, N2), en de keuze tussen de uitwegen volgt uit de nulmeting. Elk met de
opties, wat ze betekenen en wat ze kosten; de aanbeveling staat vooraan.

**B1. Mag een reservering van een lid de nadering openen?**
- *Ja, op het toestel (aanbevolen).* De reservering geeft het toestel een
  eenmalige pas, zoals Arrival dat doet; de server knoopt pas en codenaam nooit
  aan elkaar. Kost: een tweede uitgifteweg voor de pas, en een toets die meet dat
  de koppeling alleen in de browser bestaat.
- *Ja, op de server.* Eenvoudiger, en het breekt het besluit van `PLAATS.md` fase
  4.
- *Nee.* Nadering blijft alleen voor Arrival; schakel 11 blijft open.

**B2. Mag een zaak zijn adres op de kaart hebben?**
- *Standaard ja, behalve de genres met een werkgebied (aanbevolen).* De
  bereiksoort van `server/kern/mall/plek.js` beslist: `straal` is een gebied en
  geen pin. Kost: niets nieuws, de indeling bestaat.
- *Alleen na uitdrukkelijke toestemming.* Het veiligst, en de kaart vult zich
  langzaam.
- *Altijd.* Het eenvoudigst, en woonadressen komen op de kaart.

**B3. De ritprijs zonder echte route.**
- *Prijs achteraf op de gereden afstand, met een vooraf getoonde bandbreedte
  (aanbevolen).* Kost: de belofte *de prijs staat vast* verandert, en dat hoort
  hardop.
- *Vaste prijs op de route, en weigeren waar geen route is.* Kost: in gebieden
  zonder pakket geen taxi.
- *Blijven zoals het is, maar gelabeld.* De rechte lijn blijft een prijs dragen;
  P-04 blijft geschonden.

**B4. Het tweede domein.**
- *Bezorging, op de modebezorgketen (aanbevolen)* -- par. 8.
- *Taxi* -- onafhankelijker, bewijst de plaatsstap nauwelijks.

**B5. Zoeken op het toestel.**
- *Een adres- en plaatsindex in het pakket, groter pakket (aanbevolen).* Dan is
  het een zelfstandig geografisch pakket.
- *Zoeken blijft online.* Kleiner pakket; buiten bereik geen zoekfunctie.

**B6. Wat is Blind Navigation?**
- *Navigatie voor blinden en slechtzienden.*
- *Een verborgen bestemming.*
- *Iets anders.*

**B7. Wat is de contextuele Saloon?**
- *Een plaatsfeit dat de zaak zelf publiceert (aanbevolen als het dat is).*
- *Salon-berichten per plek* -- botst met P-05 en `PLAATS.md` par. 6.

**B8. Passages in het actielog van de plaatslaag** (par. 6.2).
**Beslist: N12, en uitgevoerd (par. 6.7).** De opties hieronder blijven staan als verantwoording.
- *Een naderingsvenster krijgt alleen het hek van zijn bezoek (aanbevolen).* Dan
  bestaat er geen passage om te loggen; de bron van het venster noemt de zaak al.
  Kost: de hek-motor krijgt een filter per venster, en de huidige proef van de
  nadering blijft gelijk.
- *Alle hekken blijven, maar een overgang van een hek dat niet het doel is, gaat
  niet naar de server.* Kost: het toestel moet het doel kennen; de server kan het
  niet meer controleren.
- *Zo laten en de termijn verkorten.* Kost: de graaf bestaat korter, maar bestaat.

**B9. Automatische aankomst uit een opgeslagen positie** (`/api/live/update`).
**Beslist: N13, en uitgevoerd (par. 6.7).** De opties hieronder blijven staan als verantwoording.
- *De NADERING wordt een hek-overgang op het toestel en de server hoort alleen
  `binnen`; de AANKOMST komt van het domein of de mens (aanbevolen, en de vorm
  die N3 vraagt).* Dat is de vorm die de plaatslaag al heeft; `db.data.live`
  bewaart dan geen punt meer. Een deur die opengaat na aankomst, gaat open na een
  bevestiging en niet na een afstand. Kost: een toets die het tegenovergestelde
  handhaaft moet om, en dat hoort hardop.
- *Zo laten, en `/api/live/stop` wist de positie.* Kleiner; lost
  `serverCoordinaatBuitenVenster` op, niet `aankomstUitGps` -- en botst dus met N3.

**B10. De punten van een rit ná de rit** (N2, par. 15.0).
**Beslist: N16, uitgevoerd (par. 6.8)** -- wissen bij afronden, de samenvatting blijft. De opties hieronder blijven staan als verantwoording.
- *Eerst per reden meten of er één is die punten nodig heeft (aanbevolen).* Voor
  de werkelijk gereden afstand volstaat een GETAL dat aan het eind van de rit
  wordt uitgerekend; voor fraude en de meeste geschillen volstaan begin, eind en
  afstand. Blijkt er een reden over die echt de reeks nodig heeft, dan wordt het
  de volgende optie. Kost: de afstand moet tijdens de rit worden opgeteld in
  plaats van achteraf uit punten.
- *Een bewaarvenster met doel `geschil`:* de reeks blijft verzegeld en voor een
  vaste termijn bestaan, alleen te openen met een reden, een journaalregel en
  bericht aan de reiziger, en daarna weg. Kost: een uitzondering op `PLAATS.md`
  grens 1, uitgeschreven in dat document en niet alleen hier.
- *Alleen een termijn invullen.* Het kleinst, en het schendt `PLAATS.md` grens 1
  terwijl het eruitziet als een reparatie.

---

## 16. Wat dit document niet zegt

Het staat er even groot bij, want een richtingsdocument dat overal ja zegt is
niets waard.

- **Het zegt niet dat de these klopt.** Het zegt hoe je erachter komt.
- **Het vergelijkt niet met andere kaartdiensten.** De these heeft die
  vergelijking niet nodig, en een bewering over de techniek of het verdienmodel
  van een ander is hier niet te bewijzen.
- **Het heeft bijna niets gedraaid.** Elke stand is een lezing van de bron op 29
  september 2026, behalve de positiestroommeting van par. 6.5. De eerste proef maakt daar metingen van, en dan mogen deze
  tabellen verschuiven -- ook de kant op die dit document niet verwacht.
- **Het heeft bijna niets gerepareerd.** Van de twaalf gebreken van par. 12 is
  alleen gebrek 11 gerepareerd; de andere elf en de
  terughoudendheidsschuld van par. 6.2 staan open.
- **Het zegt niet dat de rest van het huis fout zit.** Een positie in een
  vervoersopdracht of een alarm heeft vaak een echte reden. Par. 6.2 zegt alleen
  dat die reden nergens een termijn heeft, en dat een privacyclaim over de keten
  pas een testuitslag is als iemand de opslag leest.
