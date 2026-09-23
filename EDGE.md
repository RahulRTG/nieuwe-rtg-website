# RTG Edge 3.0 — één canonieke context-, trust- en actielaag voor heel RTG, opgebouwd uit bestaande primitives

Dit is een **richtingsdocument**, zoals `PLATFORM.md`, `EXECUTIE.md` en
`MACHINE.md`: per onderdeel staat er of het **staat**, **een stap weg** is, **een
besluit vraagt** of **jaren weg** is. Zo kan niemand die vier voor elkaar aanzien.

De Edge is de balk onderaan elk scherm: de bank links, de werelden of de
handelingen in het midden, Rahul rechts (`ADAPTIEF.md`, `GRAMMATICA.md`,
`WERELD.md`). Het voorstel van 23 september 2026 wil daar de runtime van het hele
huis van maken: één plek die weet waar je bent, waar je mee bezig bent, wat je
mag, wat er loopt, waar je vandaan kwam en hoe je terugkomt. Dat voorstel is
goed, en het heeft één val die dit huis al vijf keer heeft gezien (`Asset`,
`Koopbaar`, `Career`, `Moment`, `Manier`): **een laag die alles wil weten, gaat
alles bezitten.** Daarom staat de kern van dit document in twee zinnen die het
bouwen sturen:

> **De Edge bezit de werkelijkheid niet; hij krijgt er een blikveld op.**
>
> **De Edge presenteert bevoegdheid; hij verleent haar nooit.**

Er komt dus geen derde contextmodel, geen `edge.canPay()` en geen Edge-state die
naar een domein terugschrijft. Wat er wél komt, en in ronde 0 is gebouwd, is een
meetbare fundering: een kaart van wie wat doet (`EDGEKAART.json`), één leespad
met herkomst per waarde (het **Edge Blikveld**), een actiecontract met vier
standen, en een dekkingsmeter per scherm (`EDGEDEKKING.json`) met ratels. Nieuwe
productintelligentie — cross-device geheugen, AI-personalisatie, nieuwe decks,
voorspellend laden, een visueel herontwerp — hoort er in ronde 0 met opzet
niet bij.

---

## 0. De metingen die dit document eerlijk houden

Twee registers, twee vragen, en ze worden nooit opgeteld.

**`npm run edgekaart` → `EDGEKAART.json`: wie doet wat in de Edge.** Een
verklaring per bestand (laag, rollen, verantwoordelijkheden) plus een
mechanische extractie uit de bron (globals, gebeurtenissen, attributen, opslag,
netwerk). Elke rol draagt een citaat dat **letterlijk** in het bestand moet
staan; ontbreekt er een, dan zakt het script, want een verklaring die niet meer
op de code past is een verouderde kaart en geen kaart. `--controle` hercompileert
en vergelijkt met het ingecheckte register.

Uitslag: <!--getal:edgekaart.bestanden-->71<!--/getal--> bestanden met
<!--getal:edgekaart.rollen-->216<!--/getal--> verklaarde rollen, allemaal met een
citaat dat letterlijk staat;
<!--getal:edgekaart.dubbeleEigenaars-->12<!--/getal--> verantwoordelijkheden met
meer dan één schrijver of beslisser (par. 1), en
<!--getal:edgekaart.dodeKanalen-->0<!--/getal--> dode kanalen: `rtg`-gebeurtenissen
in `public/` waar wel naar geluisterd wordt maar die niemand verstuurt, of
andersom. Die laatste telling loopt over heel `public/` en niet alleen over de
Edge, want een dood kanaal naast de Edge is net zo dood. Bij de eerste meting
waren het er 17, en vijf daarvan waren precies de signalen die de Edge zou
moeten krijgen (`rtg-adaptive-project`, `-presence`, `-identity`,
`-continuation`, `-action`: de adaptieve Edge luisterde, en geen enkel scherm
verstuurde ze). Ronde 1 heeft ze alle 17 gesloten (par. 11). Daarnaast staan er
<!--getal:edgekaart.levendeKanalen-->13<!--/getal--> levende kanalen, met zender
én luisteraar: dat getal houdt de nul eerlijk, want een wandeling die niets ziet
geeft ook nul dood. Namen die in code worden samengesteld, staan apart onder
`dynamisch` en worden niet geraden.

**`npm run edgedekking` → `EDGEDEKKING.json`: wat een scherm aan de Edge
vertelt.** Per scherm onder `public/apps/`, in een echte browser met een echte
ledensessie, gelezen uit `RTGEdgeBlikveld.lees()` — nooit geraden uit de bron.
Per veld een telling, en met opzet **geen samengesteld percentage**: een
gemiddelde over tien velden verbergt welk veld bewoog (`BEWIJSMACHINE.md`).

Uitslag over <!--getal:edgedekking.schermen-->310<!--/getal--> schermen, waarvan er
<!--getal:edgedekking.metBlikveld-->282<!--/getal--> een blikveld laden (de rest is
een doorverwijzing, een scherm zonder Edge, of een scherm dat een lid niet
opent — elk met de reden in het register):

| Veld | Schermen met een waarde | waarvan het scherm hem zelf levert |
|---|---|---|
| identiteit | <!--getal:edgedekking.identiteit-->0<!--/getal--> | <!--getal:edgedekking.identiteitZelf-->0<!--/getal--> |
| wereld | <!--getal:edgedekking.wereld-->281<!--/getal--> | <!--getal:edgedekking.wereldZelf-->0<!--/getal--> |
| context | <!--getal:edgedekking.context-->282<!--/getal--> | <!--getal:edgedekking.contextZelf-->1<!--/getal--> |
| object | <!--getal:edgedekking.object-->0<!--/getal--> | <!--getal:edgedekking.objectZelf-->0<!--/getal--> |
| activiteit | <!--getal:edgedekking.activiteit-->0<!--/getal--> | <!--getal:edgedekking.activiteitZelf-->0<!--/getal--> |
| presence | <!--getal:edgedekking.presence-->0<!--/getal--> | <!--getal:edgedekking.presenceZelf-->0<!--/getal--> |
| voortzetting | <!--getal:edgedekking.voortzetting-->0<!--/getal--> | <!--getal:edgedekking.voortzettingZelf-->0<!--/getal--> |
| hoofdactie | <!--getal:edgedekking.hoofdactie-->58<!--/getal--> | <!--getal:edgedekking.hoofdactieZelf-->51<!--/getal--> |
| trust | <!--getal:edgedekking.trust-->0<!--/getal--> | <!--getal:edgedekking.trustZelf-->0<!--/getal--> |

Lees ook de ja's goed, want een `ja` zegt dat er een waarde is en niet wie hem
leverde — daarom staat de herkomst per veld in het register. De wereld komt op
bijna elk scherm uit de ROUTE (de wereldkaart), niet uit het scherm. De context
is op bijna elk los scherm de titel die het scherm aan het Edge-casco gaf, en
niet wat het via `RTGAdaptief` over zichzelf zegt: dat doet een los scherm bij
binnenkomst vrijwel nergens (in de schil wel, via de brug). En van de
hoofdacties wijst het scherm het merendeel zelf aan met `data-hoofdactie`; de
rest komt uit de padtabel van Edge 2. Bij de meting van 23 september 2026 droegen
twee schermen een gebrek: de agenda toont in
de Edge een andere hoofdactie dan hij aanwijst (`hoofdactie-dubbel`), en de
passkeyspagina wijst er twee aan (`hoofdactie-meervoudig`).

Lees die nullen goed. Identiteit en voortzetting staan op nul omdat er in de
app **geen producent** is: een scherm zou ze via de directe API melden
(`setIdentity`, `continueWith`), en dat doet alleen de openbare landing. De
luisteraars op `rtg-adaptive-identity` en `-continuation` zijn in ronde 1
weggehaald, omdat niemand ze verstuurde (par. 11); er is geen zender bij verzonnen
(besluit 2 en 7). Presence heeft er
precies één: de Ga verder-toets meldt zich terwijl hij een handeling uitvoert —
en de meter voert niets uit. Object en activiteit staan op nul omdat ze in ronde 0 zijn
**toegevoegd** en nog geen scherm ze zet. Trust staat op nul omdat de twee
schermen die een Trust Rail publiceren (Office en Bestanden) dat pas doen als er
een document of bestand open is, en de meter niets aanklikt. Voortzetting
wordt bovendien per scherm LOS gemeten, zonder de schil eromheen — in de schil
komt hij uit het geheugen van de werktafel. Dat zijn vier verschillende
oorzaken voor dezelfde nul, en dat is precies waarom er geen samengesteld
percentage bestaat.

De handelingen tellen apart, per herkomst: die uit `RTGAdaptief` en die uit het
tweede register (`edge-compat`). Een handeling die geblokkeerd is zonder reden,
telt als schuld en hoort op nul te staan; dat staat hij. Een ongemeten gevolg
telt als `onbekend`, en daar staan ze vandaag vrijwel allemaal — geen enkel
scherm draagt nog een serveroordeel of een gemeten gevolg (par. 3 en 5).

Wat de dekking **niet** zegt: of wat een scherm publiceert ook klopt. Een
wereld die `ja` zegt, zegt dat er een waarde is met een herkomst; dat de waarde
de juiste is, bewijst de toets van dat scherm. En de meting loopt als **lid**:
een scherm dat een lid niet mag openen, staat er met zijn status en zonder
velden, en dat is een eigenschap van de meting en geen oordeel over het scherm.

---

## 1. Wat er gemeten is, en wie wat bezit

De Edge is geen bestand maar een stapel van lagen die elk iets anders deden, op
verschillende momenten gebouwd:

| Laag | Bestanden | Wat het doet |
|---|---|---|
| grammatica-kern | `shared/adaptief.js`, `adaptief/grammatica.js`, `adaptief/register.js` | de leer (maten, vormen, keuring), het gewicht en de verhindering, het register van capabilities en de vluchtige context |
| grammatica-render | `adaptief/balk.js`, `balkknop.js`, `orb.js`, `lagen.js`, `vasthoud.js`, `diepte.js` | tekent de handelingen van het register |
| trust | `adaptief/gewicht.js`, `waarom.js`, `rail.js` | de bevestiging per gewicht, "waarom kan ik dit niet", de Trust Rail |
| brug | `adaptief/brug.js` | brengt context en capabilities van een blad (iframe) naar de schil |
| adaptieve balk | `rtg-adaptive-edge*.js` | de zichtbaarheidsstand, de onderbalk, gebaren, het blad met handelingen |
| Edge-casco | `rtg-edge-system.js`, `-library`, `-worlds`, `-smart-menu`, `-appbar` | kruimelpad, werelden, gereedschap, het slimme menu |
| Edge 2 | `rtg-edge-2*.js` | zichtbaarheidsstanden en het contextpaneel |
| schil | `command.js`, `command/*.js` | de werktafel van `app.html`: bladen, geheugen, wereldlabel |
| continuïteit | `rtg-continue-key*.js`, `rtg-route-memory*.js`, `rtg-world-identity.js` | Ga verder, routegeheugen, welke route bij welke wereld hoort |
| blikveld | `edge/blikveld.js`, `edge/blikveld-hoofdactie.js`, `edge/actiestaat.js` | **nieuw in ronde 0**: het ene leespad (de hoofdactielezer sinds ronde 1) |

**Het eigendomsoordeel, en waarom het pas na de meting komt.** Het voorstel zei
vooraf: `shared/adaptief/` is de semantische kern en `rtg-adaptive-edge*` de
presentatie- en compatlaag. Dat klopt, maar een oordeel dat vóór de meting wordt
uitgesproken is een aanname met een mooie naam. De kaart stelt het nu vast op de
verantwoordelijkheden, met een gesloten woordenlijst van veertien:

Van de veertien hadden er bij de eerste meting twee één eigenaar (identiteit en
presence — en die hebben in de app nauwelijks een producent). Na ronde 1 leek
`gebaar-drempel` de derde, maar dat was een blinde vlek van de kaart: de
gebaarlaag van de lijsten (`shared/gebaar/`, op elk scherm met `basis.js`)
beslist met eigen maten en stond er niet op. Ronde 2 zette hem erop, samen met de
andere producenten die de kaart miste; de code is daarvoor niet veranderd. Dus
hebben er weer twee één eigenaar en twaalf meer, en
dat is geen detail maar de kern van het voorstel: **de Edge weet vandaag niet
wat er speelt omdat hij het op te veel plekken tegelijk weet.**

| Verantwoordelijkheid | Wat de kaart vond |
|---|---|
| capability-register | twee registers met elk een eigen poort: `RTGAdaptief` (declareren, keuring) en de Edge-kern (`registerAction`); sinds ronde 1 kent de tweede alleen licht en voert hij uit langs `RTGGewicht.voer`, maar hij houdt die handelingen nog apart bij (leeg in ronde 2), en de controls oogsten paginaknoppen als derde bron. Dat tweede register heeft **vijf producenten** en niet de drie schermen die eerst werden genoemd: zijn eigen standaardingangen (zeven ids zonder uitvoering, op elk scherm met de adaptieve Edge), Signals (`primary`, ook op elk scherm), de sociale runtime (`social-context`, negen schermen), het wereldbureau (`home`, vanaf 1000 px) en de landing (zeven ids met `allowed: false` plus de scènerijen). Sinds ronde 2 staan alle vijf op de kaart; wie `registerAction` aanroept staat er als schrijver op, want alleen zo is te zien wie het register nog vult |
| vluchtige-context | twee contextmodellen: `RTGAdaptief.context()` en `RTGEdge.active.ctx` van het casco. `RTGWorkspaceContext` had een eigen `current` en een eigen ontdubbeling en was daarmee een derde; sinds ronde 2 (stap 23) leest hij het blikveld op het moment van vragen, zonder eigen staat, en staat hij als lezer op de kaart. De teller beweegt daar niet van: er blijven twee schrijvers en twee beslissers |
| wereld | vier plekken BEPALEN de wereld: het casco, `randen.js` met een eigen padlijst, `bladstand.js` en de wereldcatalogus naast `MAPPEN`. GESCHREVEN wordt hij op meer plekken, en die stonden tot ronde 2 niet op de kaart: `rtg-world-identity.js` bakt hem uit het MANIFEST op body, het wereldbureau zet zijn label in het merk van de Edge, en de landing zet hem per scène vanuit drie scripts |
| hoofdactie | de library maakt de knop, casco en padtabel zetten tekst en actie, de Ga verder-toets herbouwt hem, de controls verhuizen hem — terwijl het scherm zijn eigen `data-hoofdactie` aanwijst |
| voortzetting | vier geheugens voor "waar was ik" (`continueWith`, de werktafel, de routecontext, Recent bezocht) die elkaar niet lezen |
| zichtbaarheidsstand | vier standmachines (Edge 2, zijn loader met een tweede autoregel en de vensterboolean, de adaptieve balk, de Edge 1-vouwstand) die geen stand delen, plus twee schermen (Work en FoundationOS) die de Edge 2-stand zelf op body zetten, buiten `setState` om. De Second Screen stond hier als vijfde en is er in ronde 2 afgehaald: zijn stand (peek, panel, workspace, focus) gaat over de bank van de schil (`.cmd-bank`) en niet over de Edge. Dat is een **indelingscorrectie en geen samenvoeging**: er is geen code veranderd en er is niets opgelost |
| onderbalk | negen schrijvers van wat er onderin staat (de negende, het Edge-commando dat de menuknop claimt, stond er als beslisser en is in ronde 2 ook als schrijver erop gezet) |
| trust-rail | drie plekken leiden verbinding en beveiliging zelf af, elk op een eigen strook |
| gewicht | de tabel en de regel staan in `grammatica.js`, en sinds ronde 1 lezen de uitleg en de orb het werkelijke gewicht uit `effectief()`; twee plekken hebben nog een eigen standaard `licht` voor een ONTBREKEND gewicht (`adaptief.js`, `brug.js`), de regel voor "zonder gewichtlaag" staat drie keer apart (balk, orb, actiestaat; de werkmodus gaat sinds ronde 1 via de balk), de Edge-kern laat in zijn tweede register alleen licht toe, en de gebaarlaag houdt een eigen borgtijd van 800 ms naast `VASTHOUD` (die blijft tot ronde 3, besluit K-borg) |
| gebaar-drempel | `DREMPELS` in `grammatica.js` is de tabel en zes herkenners lezen hem, maar twee plekken beslissen met eigen maten: de gebaarversheid van Edge 2 (1500 ms, 14 px) en de gebaarlaag van de lijsten (richting 8 px en stil 6 px in `gebaar-02.js`, lang drukken 520 ms en 8 px per as in `gebaar-03b.js`). Die tweede stond na ronde 1 niet op de kaart; daarom telde deze verantwoordelijkheid toen als opgelost |
| waarom | de vijf bronnen staan twee keer (`grammatica.js` en `waarom.js`), en "verhinderd gaat niet door" wordt op vier plekken beslist |
| bevoegdheid | drie plekken in de client beslissen wat mag (de sessiegrendel van de werktafel, `allowed` van de Edge-kern, de gastblokkade van RTGDaily), terwijl er geen serverroute is die per principal een oordeel geeft |

De teller `edgeDubbeleEigenaars` mag alleen dalen. Hij daalt doordat een
verantwoordelijkheid één eigenaar krijgt — nooit doordat een bestand van de
kaart verdwijnt: het citaat moet letterlijk staan, dus een schrijver weghalen
betekent de code weghalen. En sinds ronde 2 ook nooit doordat alleen een
ETIKET verdwijnt: tot dan stonden etiketten en citaten los naast elkaar, en
verlaagde het weghalen van een etiket de teller zonder een enkele keurfout. Nu
hangt elk citaat aan het etiket waar het over gaat (`naam:letter`, of `-` als
het over geen van de veertien gaat), heeft elk etiket s of b minstens één citaat
dat het draagt, en zegt een uitgeschreven tabel (`DRAAGT`) welke rol welke letter
kan dragen: een lezing maakt niemand eigenaar, en `rendert`, `projecteert` en
`bewaart` dragen een schrijver alleen als het bestand de toestand zelf houdt.
Twee etiketten bleken toen geen citaat te hebben (`waarom` in `grammatica.js`,
`trust-rail` in de library) en tien citaten gingen over iets wat het bestand
las zonder dat de `l` erbij stond; die zijn eerst rechtgezet, zodat de
formaatwijziging zelf aantoonbaar niets aan de telling veranderde.

Stijgen doet de teller alleen met een uitgeschreven besluit in `NORM.json`, en
dat is in ronde 2 één keer gebeurd (11 naar 12, hierboven): **een meter die
stijgt omdat hij beter ziet, is geen achteruitgang; een meter die laag blijft
omdat hij iets niet ziet, is erger.**

Omdat de kaart VERKLAARD is, staat er alleen op wat iemand opschrijft — zo
stond de gebaarlaag er na ronde 1 niet op. Sinds ronde 2 leggen drie
**afgeleide controles** de code ernaast, lexicaal uit dezelfde wandeling over
`public/` als de dode kanalen: wie `registerAction` aanroept op de Edge-kern is
gelijk aan de schrijvers van capability-register met die aanroep als citaat, wie
`data-rtg-world` op body zet staat erop als `wereld:s`, en wie
`data-rtg-edge-2-state` op body zet als `zichtbaarheidsstand:s`. De eerste is
de meter voor "het tweede register is leeg": die lijst op nul. Het is een
ondergrens (een samengestelde naam of een `CONTRACT`-veld ontsnapt; Edge 2 zelf
staat er daarom met de hand op), elke uitzondering noemt bestand en reden (het
actieregister van de werkruimte deelt alleen de naam `registerAction`; twee
platformscripts van de site hebben geen lader, en dat wordt bij elke meting
opnieuw nagekeken), en een uitzondering die niets meer uitzondert laat de
controle zakken.

Het oordeel dat daaruit volgt:

- **`shared/adaptief/` bezit de betekenis**: welke capabilities er zijn
  (`register.js`), wat er nu speelt (de vluchtige context), wat een handeling
  weegt (`grammatica.js`) en waarom iets niet kan (`waarom.js`). Een tweede
  schrijver van een van die vier is een gebrek, en de kaart noemt hem.
- **`rtg-adaptive-edge*` hoort de vorm te bezitten**: de zichtbaarheidsstand en
  de onderbalk; de gebaardrempels LEEST het sinds ronde 1 uit `DREMPELS` in
  `grammatica.js`, want wat een gebaar betekent en wanneer het er een is, hoort
  bij de taal en niet bij een van de balken. Tot ronde 1 besliste het op twee plekken nog
  over betekenis: `registerAction` in de kern was een tweede register met een
  eigen uitvoerweg, en de adaptieve Edge vroeg met `window.confirm` in plaats van
  langs het gewicht. `window.confirm` is weg, en het tweede register kent alleen
  nog licht en voert uit langs `RTGGewicht.voer`; LEEG is het pas in ronde 2,
  want vijf producenten vullen het nog (de tabel hierboven). Welke handelingen
  er zijn, leest het sinds ronde 0 niet meer zelf: `rtg-adaptive-edge-controls.js`
  vraagt ze aan het blikveld in plaats van `RTGAdaptief.voorNu()`.
- **Het Edge-casco en Edge 2 zijn compat**: `registerAction` en de padtabel van
  het casco zijn een tweede register naast `RTGAdaptief`. Dat register wordt in
  ronde 0 niet verwijderd (dan verdwijnen er handelingen van schermen die er
  vandaag op leunen) maar **zichtbaar gemaakt**: het blikveld toont zijn
  handelingen met de herkomst `edge-compat`, en een handeling die daar
  `allowed: false` staat zonder reden, draagt het gebrek `redenloos` in plaats
  van stil uit de lijst te vallen.
- **Er zijn vandaag al twee contextmodellen, en een lezer.** "Geen derde
  contextmodel" betekent daarom niet dat er één is: `RTGAdaptief.context()` is
  de bron van wat een scherm over zichzelf zegt, en `RTGEdge.active.ctx` is het
  casco (kruimelpad, gereedschap, de padtabel). Het blikveld leest die twee en
  zegt bij elke waarde welke; het maakt er geen derde van.
  `shared/interface/workspace-context.js` (`RTGWorkspaceContext`) hield een
  eigen `current`, gevoed uit het eerste met een eigen ontdubbeling; sinds
  ronde 2 (stap 23) geeft hij op het moment van vragen vier velden van het
  blikveld door (wereld, context, object, activiteit), met herkomst, gezag en
  sinds ongewijzigd, en zonder blikveld `velden: null` met de reden. De eerste
  lezer is 'Nu relevant' in de Second Screen: die toont de titel alleen als
  een scherm of blad hem zei. De twee modellen samenvoegen komt na ronde 2
  (besluit K-casco), en de richting is dat het casco een LEZER wordt van de
  context van het scherm.

---

## 2. Het Edge Blikveld

`public/shared/edge/blikveld.js`, geladen door de loader van de adaptieve Edge
direct na de kern, levert `window.RTGEdgeBlikveld` met twee functies:
`lees()` (alles wat de Edge nu ziet, als platte data) en `acties()` (de
handelingen in de vorm die de balk tekent, met hun Edge-stand erbij). Er is geen
`op()` en geen setter — een capability zonder aanroeper bestaat niet
(`CONTROLPLANE.md`), dus een luisteraar komt er pas bij met de aanroeper die hem
nodig heeft.

**Elk veld heeft dezelfde vorm**: `{ waarde, herkomst, gezag, sinds }`, en een
leeg veld draagt `reden`. Een leeg vak zonder reden wordt gevuld met iemands
eigen indruk (`SERVICE.md` par. 12).

| Veld | Waar het vandaan komt (in deze volgorde) | Herkomst |
|---|---|---|
| identiteit | de Edge-kern, als een scherm `setIdentity` aanroept | `edge-signaal` — en er is vandaag **geen** producent |
| wereld | het open blad in de schil; anders de route in `rtg-world-identity.js`; anders `data-rtg-world` op de pagina | `blad`, `route`, `pagina` |
| context | de context die het scherm in `RTGAdaptief` zette (in de schil: die de brug uit het actieve blad doorgaf); anders het Edge-casco; anders de documenttitel | `scherm` (in de schil `blad`), `edge-casco`, `document` |
| object | `object` in de context van het scherm, alleen als die context een bron heeft (anders leeg: het scherm zegt niet wie het is) | `scherm` (in de schil `blad`) |
| activiteit | `activiteit` in de context van het scherm, alleen met een bron, net als het object | `scherm` (in de schil `blad`) |
| presence | de Edge-kern | `edge-signaal` |
| voortzetting | het geheugen van de werktafel (in de schil); anders het signaal van de kern | `toestel:werktafel`, `edge-signaal` |
| hoofdactie | in de schil het ACTIEVE blad (`[data-hoofdactie]` daarin, anders leeg met reden); los het scherm zelf, anders de knop van de padtabel | `blad:data-hoofdactie`, `blad`, `scherm:data-hoofdactie`, `edge-padtabel` |
| trust | de `rail` in de context; offline als toestand van het toestel | `scherm:rail` (in de schil `blad:rail`), `toestel` |
| bevoegdheid | **niets**, met de reden erbij | — |

**Gezag heeft vier waarden en de hoogste is vandaag leeg.** `autoritatief` is
voorbehouden aan een oordeel van de server; `afgeleid` is berekend uit iets dat
de pagina weet (de route, het open blad); `ui` is wat een scherm over zichzelf
zegt; `geen` is dat er niets is. `test/edgeblikveld.test.js` houdt vast dat
`autoritatief` alleen met de herkomst `server` kan voorkomen — en die herkomst
bestaat nog niet, omdat er geen route is die per principal een oordeel geeft.
Het veld `bevoegdheid` staat daarom op `null` met die reden, en niet op een
waarde die de Edge zelf heeft bedacht.

**Het blikveld schrijft niets.** Geen attribuut, geen opslag, geen bericht,
geen context. Dat staat niet alleen in de kop maar in twee toetsen: de
unittoets zoekt in de bron naar elke schrijfweg en draait `lees()` in een
nagemaakt venster waarin elke schrijfweg een verklikker is, en
`test/edgeblikveld.e2e.js` doet hetzelfde in een echte pagina met alle lagen
geladen. Wie het blikveld nieuwer vindt dan het scherm, heeft ongelijk
(besluit 5).

**Wat de schil ziet, en wat niet.** Een scherm in een blad (iframe) laadt zijn
eigen Edge niet; de schil claimt hem. De context van dat blad komt via de brug in
het blikveld van de schil. De `[data-hoofdactie]` van dat blad leest sinds ronde 1
een eigen lezer, `edge/blikveld-hoofdactie.js`: bij elke `lees()` het ACTIEVE
blad, alleen bij dezelfde herkomst en alleen dat ene verklaarde attribuut, en hij
onthoudt en schrijft niets. Wijst het blad geen hoofdactie aan, dan staat het veld
leeg met die reden (`blad`) en leent het niet de knop van de schil -- de padtabel
van Edge 2 draait niet in een blad. Wat de schil nog steeds niet ziet: de
padtabel van een blad, en alles van een blad van een andere herkomst. De
dekkingsmeter meet de schermen los; een meting van de schil zelf is ronde 2.

**In de schil heet alles wat uit een blad komt `blad`** (ronde 2). Daar zet
alleen de brug een context in `RTGAdaptief` -- `test/edgedekking-zelf.test.js`
houdt dat lexicaal vast over de scripts van `app.html` -- en die geeft door wat
het blad zei. Context, object en activiteit heten daar dus `blad` en de rail
`blad:rail`, nooit `scherm`. Wat de meter als "het scherm zegt het zelf" telt,
is een gesloten lijst per veld (`ZELF` in `scripts/edgedekking.js`): alleen
`scherm` voor context, object en activiteit, `scherm:data-hoofdactie` en
`scherm:rail`, en voor de wereld niets -- ook niet het pagina-attribuut, want
`data-rtg-world` is een kopie van het MANIFEST en geen publicatie.

### De uitbreiding van de context, en een oud gebrek in de sleutel

Het blikveld leest één contextmodel, en dat is `RTGAdaptief.context()`. Ronde 0
voegt daar twee velden aan toe die een scherm over zichzelf kan zeggen — het
`object` waar je in staat en de `activiteit` die loopt — en de brug neemt ze mee
naar de schil. In de declaratie van een capability komen `herstel` (`exact`,
`compensatie`, `geen`) en `effect` (`lokaal`, `server`) erbij. **Een `gevolg`
komt er met opzet niet bij**: wat een handeling verandert, verklaart een scherm
niet over zichzelf; dat meet `server/kern/stuur/gevolg.js`, en een zelfverklaard
gevolg zou precies de geruststelling zonder grond zijn waar `EXECUTIE.md` blok 4
voor waarschuwt.

Het bedraden vond een gebrek dat al stond: de sleutel waarmee het register
beslist of de context veranderd is, keek in de stand van een handeling alleen
naar `aan`. Een andere ontvanger in de bevestiging ("Gaat naar: onbekend" →
een codenaam) of een andere reden bij een verhindering werd weggegooid als
"niets nieuws", en de balk bleef de oude tekst tonen (gevonden in Bestanden).
De sleutel neemt nu de hele stand mee, met een functie als "er is er een" —
anders is elke nieuwe closure een nieuwe context en tekent de balk bij elke
tik opnieuw. `test/edgecontext.test.js` houdt beide helften vast.

---

## 3. De stand van een handeling

`public/shared/edge/actiestaat.js` zet een handeling in precies één van vier
standen. Dit huis schrijft zijn standen in het Nederlands; de namen uit het
voorstel staan erachter.

| Stand | Voorstel | Betekenis |
|---|---|---|
| `AFWEZIG` | ABSENT | bestaat voor deze principal in deze context niet; niet tonen |
| `GEBLOKKEERD` | BLOCKED | bestaat, kan nu niet; tonen **met** een reden |
| `BESCHIKBAAR` | AVAILABLE | uitvoerbaar |
| `LOPEND` | PENDING | loopt al, of wacht op een andere partij |

Zeven regels, alle zeven over **alle combinaties** getoetst
(`test/edgeactiestaat.test.js`, zeven gewichten × acht oordelen × vier
verhinderingen × vier herstelvormen × twee × twee) en niet over drie voorbeelden:

1. **Alleen de server verleent.** Een oordeel telt alleen als
   `oordeel.bron === 'server'`. Een oordeel van elders wordt genegeerd, als gebrek
   `oordeel-niet-van-server` gemeld, en verandert de stand niet — dezelfde invoer
   zonder dat oordeel geeft exact dezelfde stand.
2. **Geweigerd of afwezig maakt `BESCHIKBAAR` onmogelijk**, en ook `LOPEND`.
3. **`GEBLOKKEERD` draagt altijd een reden** met een bron uit de gesloten lijst
   van `grammatica.js` (beleid, classificatie, bevoegdheid, bewijs, toestand).
   Komt er een verhindering zonder reden binnen, dan krijgt hij de zin van zijn
   bron én het gebrek `redenloos` — het vangnet mag het gebrek niet verbergen.
4. **De bevestiging volgt de vlaggen van de GEWICHT-tabel** en niet een eigen
   lijst: `plechtig` → klaarzetten, nakijken en vasthouden; `zwaar` → reden en
   vasthouden; `bewust` → een lade die zegt wat er gebeurt; `terug` → doen, met
   "Ongedaan maken" erna. De toets verandert de TABEL en eist dat de uitkomst
   meebeweegt; zo is bewezen dat er geen tweede tabel ontstaat.
5. **`terug` zonder weg terug wordt `bewust`**, zichtbaar als gebrek.
6. **Compensatie is nooit "Ongedaan maken"**: een creditnota wist geen factuur
   (`HERSTELPROEF.json`, `EXECUTIE.md`). Dat geldt bij het tonen én in de
   uitvoerder (`gewicht.js`), zodat de Edge nooit iets anders belooft dan er
   gebeurt.
7. **Zonder gewichtstabel faalt alles wat niet licht is dicht**, met de reden
   erbij. Dat was eerst andersom: zonder tabel viel het gewicht terug op `licht`,
   en dan faalde een plechtige handeling juist open. De toets vond het.

**Er is vandaag geen serveroordeel om te tonen.** De vier standen zijn het
contract; wat ze voedt is vandaag de verhindering van het scherm zelf. Het
eerste serveroordeel per principal en capability is ronde 3 (par. 10).

---

## 4. Gewicht is geen voorrang

Twee vragen die op elkaar lijken en het niet zijn:

- **Gewicht** is de zwaarte van een handeling: hoeveel bevestiging hij van een
  mens vraagt. Er is precies één gewichtsschaal (`licht`, `terug`, `bewust`,
  `zwaar`, `plechtig`, in `grammatica.js`), en die blijft de enige. Een tweede
  zou nog een ladder zijn naast de vijf gezagsvocabulaires die dit huis al heeft
  (INT-01, `EXECUTIE.md`).
- **Voorrang** is wat er NU zichtbaar moet zijn als er meer speelt dan de balk
  kan tonen: een betaling die op een handtekening wacht, een rit die aankomt,
  een upload die loopt.

Ze horen niet in één getal. Een plechtige handeling is niet urgenter dan een
lichte; een lichte melding ("je rit staat voor de deur") kan de meest urgente
van de dag zijn. **De voorrang wordt deterministisch** en niet gewogen, in deze
volgorde:

1. veiligheid
2. menselijke actie vereist (een handtekening, een goedkeuring)
3. kritieke toestand (een storing, een weigering)
4. lopende activiteit
5. deadline
6. voortzetting
7. suggestie

Bij gelijke trede wint de oudste, en daarna de regel van het domein. Er komt
geen score en geen gewichtenvector — zodra elke bron een getal levert en de
hoogste wint, is er weer één algoritme dat niemand kan lezen (`CONNECT.md`: de
mixer verdeelt plekken en geen punten). Elke plek draagt zijn trede in woorden.

**Stand: een stap weg (ronde 3).** De volgorde staat hier als contract; de
resolver is niet gebouwd, want vandaag is er maar één bron die iets "lopends"
meldt (de presence van de kern) en een resolver over één bron is een lege
functie. Let op de naam: `VOORRANG` is als code-identifier bezet
(`server/pg/sync.js`, de schrijfstrook van de geldcollecties), dus de module
krijgt een andere naam dan het begrip — `edge/voorgrond.js` is vrij.

---

## 5. Waarom en gevolg

**`shared/adaptief/waarom.js` is de eerste burger van de Edge**, niet een
tooltip. Lang drukken legt uit, overal: wat de handeling is, wat hij weegt, en
als hij niet kan, waarom niet. Wat daar ontbreekt is een gedeelde vorm aan de
serverkant: de inventaris telde **vijf** vormen voor "waarom kan ik dit niet"
(het stuur, de gastbestelling, de concernscope, de service-onderzoeker en de
bronnenlijst van de grammatica), zonder gedeelde woorden. Dat is de naad van
ronde 3, en de richting is de bronnenlijst van de grammatica — die is gesloten,
getoetst en al in gebruik.

**Een gevolg dat niet gemeten is, heet `onbekend`, en nooit "geen gevolgen".**
Drie klassen:

| Klasse | Graad uit `gevolg.js` | Wat de Edge mag zeggen |
|---|---|---|
| bekend | `gemeten`, `geen-effect-gemeten` | wat de meting zag, als voorbeeld vooraf |
| onvolledig | een deel gemeten | wat gemeten is, en dat de rest dat niet is |
| onbekend | `onbekend` | "Wat dit verandert is niet gemeten." |

**Een onbekend gevolg blokkeert vandaag niets.** Van de handelingen die het
AI-stuur mag bedienen is van <!--getal:gevolg.onbekend-->95<!--/getal--> niet
gemeten wat ze veroorzaken; blokkeren op onbekend zou het huis stilzetten. Het
wordt getoond, hardop, en de teller moet dalen.

---

## 6. De grenzen die niet mogen sneuvelen

1. **De Edge verleent nooit bevoegdheid.** Geen `edge.canPay()`, geen stand die
   iets opent. Een oordeel komt van de server; tot die er is, staat er
   `bevoegdheid: null` met de reden. Gehandhaafd: `test/edgeactiestaat.test.js`
   en `test/edgeblikveld.test.js`.
2. **Geen derde contextmodel.** Het blikveld is een projectie over
   `RTGAdaptief.context()`, het casco en de kern. Een nieuwe contextbron wordt
   een veld met een herkomst, geen nieuw object.
3. **De autoritatieve stand wint; de Edge schrijft nooit terug.** Gehandhaafd in
   de bron (unittoets) en in de browser (e2e).
4. **Gewicht blijft de enige gewichtsschaal**, en voorrang is een andere vraag.
5. **Een scherm verklaart zijn eigen gevolg niet.** Wat een handeling
   verandert, komt uit een meting. Gehandhaafd: `test/edgecontext.test.js`.
6. **Decks zijn projecties en geen mini-apps.** Een geld-, reis- of
   goedkeuringsdeck toont wat het domein weet en roept de capability van het
   domein aan; het krijgt geen eigen staat, geen eigen opslag en geen eigen
   route. Een deck dat zijn eigen waarheid gaat bijhouden is de `journeys`-tabel
   van `TRAVELCOMMERCE.md` in het klein.
7. **Rahul komt pas na de deterministische laag**, en antwoordt op "waarom kan
   ik dit niet" uit `waarom.js` en de reden van de server — nooit uit een eigen
   gok. Rahul stelt voor, een mens beslist (`FABRIC.md`), en Rahul stelt alleen
   handelingen voor die het register kent: geen gegenereerde uitvoerbare UI.
8. **Geen samengesteld dekkingscijfer.** Per veld tellen, per scherm vergelijken.
9. **De Edge maakt geen extra identiteit zichtbaar** (besluit 2).

---

## 7. De ratels

- **Bestaande schermen gaan niet achteruit.** `npm run edgedekking` vergelijkt
  per scherm met het ingecheckte register: een veld dat `ja` was en `nee` wordt,
  laat het script zakken, en ook een veld dat `ja` blijft maar niet meer van het
  scherm ZELF komt (het scherm publiceerde zijn context, nu is het de titel van
  het casco). Tenzij het expliciet wordt aanvaard — en dan staat het in het
  register onder `aanvaardAchteruit`, met naam.
- **Nieuwe schermen krijgen het harde contract.** Een scherm dat niet in de
  basislijn van `EDGEDEKKING.json` staat, moet gemeten zijn, een wereld en een
  context hebben, een hoofdactie ZELF aanwijzen (`data-hoofdactie`, niet via de
  padtabel) of met reden verklaren dat die er niet is
  (`data-rtg-edge-nvt-hoofdactie="reden"`), en nul geblokkeerde handelingen
  zonder reden hebben. Een nieuw scherm dat een lid doorstuurt (een kantoor- of zaakscherm
  naar zijn inlog) zakt, tenzij het met reden in `DOORVERWIJZING_MET_REDEN`
  staat: anders haalt het het contract zonder ooit onder zijn eigen rol gemeten
  te zijn. `test/edgenieuwscherm.test.js` houdt dat vast.

  De context-eis is sinds besluit 11 tweeledig. Een nieuw scherm dat een eigen
  hoofdactie aanwijst, heeft handelingen en publiceert zijn context ZELF, via
  `RTGAdaptief.context()` (daarvoor laadt het `shared/adaptief.js`,
  `adaptief/grammatica.js` en `adaptief/register.js`). Een scherm dat met reden
  verklaart dat het geen hoofdactie heeft, mag bij de titel van het casco
  blijven — daar bewijst de context-eis alleen dat er een titel is, en dat staat
  er dan ook zo.
- **Een verklaring hoort bij een veld** (ronde 2). Een scherm verklaart per veld
  op zijn body, en de waarde van het attribuut IS de reden:
  `data-rtg-edge-nvt-<veld>` (dit veld bestaat hier niet) of
  `data-rtg-edge-na-openen-<veld>` (dit veld ontstaat pas als je iets opent,
  zoals een document). De oude vorm, een lijst velden met EEN reden voor
  allemaal, telt niet meer: een reden voor het ene veld dekt het andere niet.
  Zonder reden, of met beide verklaringen voor hetzelfde veld, blijft het `nee`.
  `na-openen` telt nooit als `ja`, en van `ja` naar `na-openen` is achteruit:
  wat er bij binnenkomst stond, staat er niet meer. De meter klikt niets aan,
  dus dat het veld na openen WERKELIJK verschijnt, bewijst een e2e en niet het
  register.
- **Gewijzigde schermen worden niet slechter** — dat is dezelfde vergelijking
  per scherm als de eerste regel.
- **De kaart loopt niet achter.** `npm run edgekaart:controle` zakt als de code
  iets anders zegt dan het register, en elk citaat moet letterlijk staan;
  `test/edgekaart.test.js` doet hetzelfde in de gewone suite.
- **Normtanden** (`NORM.json`): twaalf tanden. `edgeGeblokkeerdZonderWaarom` hoort op nul
  te staan en mag alleen dalen; `edgeDubbeleEigenaars` en `rtgDodeKanalen` zijn
  schulden en mogen alleen dalen; en per veld een tand die alleen mag stijgen
  (`edgeVeldIdentiteit` tot en met `edgeVeldTrust`). Negen veldtanden en geen
  som, om dezelfde reden als in par. 0.

Wat er met opzet **nog niet** is: een strengere eis voor nieuwe kritieke
mutaties dan voor schermen die alleen lezen (besluit 4). Dat vraagt een indeling
van handelingen in kritiek en niet-kritiek die er nog niet is — de
handelingsklassen van `MACHINE.md` (`geld-eenmalig`, `geld-reeks`) zijn de
eerste twee, en ronde 3 sluit daarop aan.

---

## 8. De besluiten van de eigenaar (23 september 2026)

1. **Voortzetting over apparaten heen gaat nog niet via de server.** Het
   contract van een voortzetting heeft wel nu al dezelfde vorm lokaal als later
   gesynchroniseerd, zodat de overstap geen tweede model maakt. Een servervariant
   vraagt een eigen besluit over privacy en bewaartermijn — een lijst van waar
   iemand gisteren was is een gedragslogboek, en dat bestaat hier niet zonder
   grond (`KOSTEN.md`: de meter houdt tellers en geen journaal).
2. **Namen in samenwerking alleen waar de werkcontext die identiteit al
   rechtmatig toont**, anders de codenaam. De Edge maakt nooit extra identiteit
   zichtbaar: een presencerail die toont wie er meekijkt, is een nieuwe leesweg
   naar wie iemand is, en die gaat langs de kluis en niet om de kluis heen.
3. **Lokaal leren mag, als opt-in**, alleen voor ergonomische suggesties (welke
   handeling je vaak neemt, waar je de Ga verder-toets wilt), nooit voor rechten,
   prijzen, de voorrang van mensen of belangrijke besluiten. De gegevens blijven
   op het toestel, met een beperkte bewaartermijn en een zichtbare knop
   **"Vergeet mijn Edge-voorkeuren"**.
4. **De dekkingspoort**: bestaande schermen ratelen, nieuwe schermen krijgen het
   harde contract, en nieuwe kritieke mutaties krijgen een strengere eis dan
   schermen die alleen lezen.
5. **De autoritatieve domein- en serverstand wint altijd.** De Edge duwt nooit
   staat terug naar een domein.

**De tweede ronde besluiten, dezelfde dag**, over de zes punten die in par. 9
een besluit vroegen. De eigenaar koos telkens de aanbevolen optie; ze staan hier
met wat ze betekenen en wat ze uitsluiten.

6. **Urgentie krijgt geen eigen schaal** (punt 9). Urgentie IS de voorgrondtrede
   uit par. 4: "menselijke actie vereist" is wat het voorstel Required noemde,
   veiligheid en kritieke toestand zijn Critical, de rest blijft rustig. De
   standen van de Trust Rail (rustig, aandacht, bezig) blijven over TOESTAND gaan
   en niet over voorrang. Er komen dus geen drie schalen voor één vraag.
7. **Voortzetting wordt eerst lokaal afgemaakt** (punt 10 en 14). Ronde 4 zet
   object, activiteit en selectie als VERWIJZING in de lokale momentopname, in
   de vorm die later kan synchroniseren. Overdracht naar een ander apparaat en de
   servervariant blijven dicht tot een apart besluit over privacy en
   bewaartermijn; punt 14 is daarmee het enige punt dat nog een besluit vraagt.
8. **Een verzoek loopt via het domein** (punt 17). De Edge roept de
   verzoekfunctie van het domein aan (een tweede handtekening, een stuurvoorstel,
   een zaak); er komt geen domeinoverstijgend verzoekobject. Een overzicht van
   "wat wacht op mij" is een deck dat die domeinbronnen LEEST.
9. **Eerst de hoedanigheid, dan pas een rolwisselaar** (punt 34). Hoedanigheid
   wordt een veld van de sessie en van `kern/envelop.js` (een versiesprong van
   een envelop die op acht velden gesloten is) voordat de Edge een wisselaar
   krijgt. Een rolnaam tonen zonder dat de bevoegdheid meewisselt, komt er niet:
   dat is de stille contextwissel die MN-02 verbiedt.
10. **Het werkdeck gaat over het open werkstuk** (punt 21): het document, de
    sheet of de presentatie waar je nu in staat. Office publiceert die context en
    handelingen al, dus er komt geen werkobject naast.
11. **Een nieuw scherm met handelingen publiceert zijn context zelf.** Wie een
    eigen hoofdactie aanwijst, zegt via `RTGAdaptief.context()` ook waar je bent;
    een scherm dat met reden verklaart dat het geen hoofdactie heeft (een lees- of
    infoscherm), mag bij de titel van het casco blijven. Gehandhaafd:
    `contractNieuw` in `scripts/edgedekking.js` en `test/edgenieuwscherm.test.js`.

En de volgorde: **ronde 1 begint nu** (par. 10).

---

## 9. De vijftig punten van het voorstel, per stand

Elk punt is ingedeeld met het bewijs in de code erbij, en met de ronde waarin hij
thuishoort. Uitslag: **8 staan**, **32 zijn een stap weg**, **6 vragen een
besluit** en **4 zijn jaren weg** — en na de besluiten 6 tot en met 11 van
par. 8 zijn er nog **37 een stap weg en vraagt er 1 een besluit** (punt 14). Dat het merendeel een stap weg is, is de
uitkomst die het voorstel verdiende: de onderdelen bestaan bijna allemaal, onder
een andere naam of in één domein, en het werk is aansluiten en niet uitvinden.

| # | Punt | Stand | Ronde | Wat er staat, en wat ontbreekt |
|---|---|---|---|---|
| 1 | Alle signalen aansluiten, 100% dekking | stap weg | 1 | De meter en de ratels staan; aansluiten niet. "100%" wordt een ratel per veld per scherm, geen gemiddelde. |
| 2 | Eén Context Envelope | staat | 1 | Het Edge Blikveld: tien velden met herkomst. Heet niet envelop, want `kern/envelop.js` draagt die naam al. |
| 3 | Object awareness | stap weg | 2 | Veld en brug staan; geen scherm publiceert nog een object. Altijd een verwijzing (soort, id, label), nooit een dossier. |
| 4 | Activity awareness | stap weg | 2 | Veld staat, niemand vult het. Alleen het huidige moment: een bewaarde reeks is een gedragslogboek (besluit 1). |
| 5 | Permission awareness | stap weg | 3 | Het contract om een serveroordeel te tonen staat; geen route geeft het per principal. "Passkey vereist" komt binnen als verhindering met bron `bewijs`. |
| 6 | Reason engine | stap weg | 3 | In de browser draagt elke verhindering een reden (en sinds deze ronde ook buiten de schil); aan de serverkant vijf vormen zonder gedeelde woorden. |
| 7 | Live presence rail | stap weg | 4 | Presence is een label met één producent (de Ga verder-toets). De bronnen bestaan (livestaat van de rit, meet); de ordening wacht op de voorgrondresolver. |
| 8 | Priority arbitration | stap weg | 3 | De volgorde staat als contract (par. 4); de resolver wacht op een tweede bron van lopende zaken. |
| 9 | Urgency zonder manipulatie | stap weg | 3 | Besloten (par. 8, besluit 6): geen eigen schaal; urgentie is de voorgrondtrede. De resolver is ronde 3. |
| 10 | Continuity engine over apparaten | stap weg | 4 | Besloten (besluit 7): eerst lokaal afmaken, in de vorm die later kan synchroniseren. |
| 11 | Continuity snapshot | stap weg | 4 | Positie en veilige UI-staat worden per route bewaard (24 uur, met geheimenfilter); object, activiteit en selectie nog niet. |
| 12 | Cross-app continuity | stap weg | 4 | Het objectprotocol tussen apps bestaat maar heeft nul producenten en draait alleen in de werkruimte. |
| 13 | Task stack | stap weg | 4 | Nu is de context, Hierna de voortzetting; `LOPEND` kan vandaag niet voorkomen omdat het blikveld `loopt` nog niet doorgeeft. Later hoort in een domein, niet in de Edge. |
| 14 | Handoff naar ander apparaat | besluit | 4 | Blijft dicht tot een apart besluit over privacy en bewaartermijn (besluit 7). Een eenmalige RTG-code (LINK.md) is de weg zonder opslag. |
| 15 | Collaboration presence | stap weg | 4 | Office heeft echte aanwezigheid op codenamen; de Edge leest het nog niet als veld. Nooit namen buiten die context (besluit 2). |
| 16 | People context | stap weg | 2 | "Gedeeld met N" staat in Bestanden en Office. Een telling in deze context, geen ranglijst van contacten. |
| 17 | Request attention | stap weg | 3 | Besloten (besluit 8): via de verzoekfunctie van het domein; "wat wacht op mij" is een deck dat domeinbronnen leest. |
| 18 | Approval deck | stap weg | 3 | Bekijken, bewijs en goedkeuren bestaan per domein, met vier ogen. Het deck leest die bronnen; stuurvoorstellen leven in het procesgeheugen. |
| 19 | Money deck | stap weg | 3 | Alle assen staan in het dossier van de geldketen, maar alleen voor de kantoorincasso. Geld verlaat het huis nooit vanzelf. |
| 20 | Travel deck | stap weg | 2 | De reiswacht is al een eerlijke projectie; het deck leest die en krijgt geen eigen reisstaat. |
| 21 | Work deck | stap weg | 2 | Besloten (besluit 10): het open werkstuk; Office is de eerste producent. |
| 22 | Meeting deck | stap weg | 4 | Meet bestaat als domein met een meeleesbaan; de Edge krijgt er alleen een compat-handeling van. |
| 23 | Creation deck | stap weg | 2 | Document, Sheet en Present publiceren al context en handelingen; sinds deze ronde werken hun bewuste handelingen ook in het Edge-blad buiten de schil. |
| 24 | Edge-handelingen als capabilities | stap weg | 1 en 2 | `RTGAdaptief` is al een capabilityregister. Het tweede register (`registerAction`) kent sinds ronde 1 alleen licht en voert uit langs `RTGGewicht.voer`; leeg is het pas in ronde 2, als de drie schermen die erop leunen via `RTGAdaptief.declareer` publiceren. |
| 25 | Action contracts | stap weg | 3 | Het contract met vier standen staat, over alle combinaties getoetst. Risico, authenticatie en resultaat ontbreken; gezag, gevolg en herstel staan overal op onbekend. |
| 26 | Risk-aware actions | stap weg | 3 | Gewicht wordt per scherm verklaard, niet uit risico berekend; de frictiemotor die dat per bedrag wel doet, hangt niet aan de Edge. |
| 27 | Preview before commit | staat | 3 | Bewust, zwaar en plechtig laten eerst zien wat er gebeurt; zonder gewichtlaag gaan ze dicht. Het GEMETEN gevolg zit er nog niet in. |
| 28 | Undo, geen nep-undo bij compensatie | stap weg | 3 | Ongedaan maken werkt (Bestanden). Compensatie is sinds deze ronde ook in de UITVOERDER nooit "Ongedaan maken"; geen scherm verklaart nog `herstel`. |
| 29 | Recovery deck | stap weg | 4 | Bewaren en opnieuw proberen met dezelfde sleutel bestaat (`RTGWachtrij`); een betaling wacht nooit in een rij. |
| 30 | Offline awareness | staat | 4 | Offline wordt aan de browser gemeten en getoond in de rail en het blikveld. |
| 31 | Sync state | stap weg | 4 | Office kent opgeslagen, bezig en conflict -- afgeleid uit een ZIN met een reguliere expressie. De bron hoort de stand als woord te leveren. |
| 32 | Trust Rail | stap weg | 3 | Werkt in de schil voor Office en Bestanden; identiteit, goedkeuring, transactie en herstel ontbreken als categorie. |
| 33 | Identity awareness | stap weg | 2 | De vorm bestaat (`setIdentity`), niets vult hem. Alleen waar de context de identiteit al rechtmatig toont (besluit 2). |
| 34 | Role switching | stap weg | 3 | Besloten (besluit 9): eerst hoedanigheid in sessie en envelop, dan pas een wisselaar; nooit alleen een label (MN-02). |
| 35 | Confidentiality indicator | staat | 3 | Strikt zet delen uit met reden en bron, en `mag()` weigert; niet alleen een grijze knop. |
| 36 | Rahul context button | stap weg | 5 | "Wat kan hier" en "waarom niet" bestaan deterministisch; Rahul leest het blikveld nog niet, en alleen via een positieve veldenlijst (AI-CONTEXT-01). |
| 37 | Rahul lens | jaren weg | 5 | Vraagt per domein een afwijkingscontract, een positieve veldenlijst naar een model en een gemeten trefzekerheid; geen van drie bestaat buiten de loonstrook. |
| 38 | Explain this | stap weg | 1 | Lang drukken legt uit voor elke handeling uit het register; niet voor het tweede register en de geoogste paginaknoppen. |
| 39 | Why this? | stap weg | 5 | De vorm bestaat in de mixer van Connect (grond en dektNiet, geen score); de Edge heeft nog geen aanbevelingen. |
| 40 | Rahul suggest, human decide | staat | 5 | Orb en stuur stellen voor en een mens beslist; de orb voert sinds deze ronde zonder gewichtlaag niets zwaars uit. |
| 41 | Generative action surface | stap weg | 5 | Aan de serverkant kiest Rahul al uit een versmalde lijst (dekking 100%); wat ontbreekt is voorstellen uit het register van DIT scherm. |
| 42 | Geen AI-gegenereerde uitvoerbare UI | staat | 5 | Uitvoeren kan alleen op het id van een gedeclareerde capability; er is geen tweede weg. Structureel, en nog niet apart getoetst. |
| 43 | Predictive preloading | jaren weg | 6 | Er is geen meting van interactielatentie in de browser en geen voorspeller; zonder die twee is vooruit laden gevoel. |
| 44 | Intent prewarming | jaren weg | 6 | Dezelfde voorspeller plus een harde grens: vooraf mag alleen lezen of klaarzetten zonder effect. |
| 45 | Local-first personalization | stap weg | 6 | Besluit 3 is genomen; het leren, de opt-in en de knop "Vergeet mijn Edge-voorkeuren" ontbreken. |
| 46 | Stable muscle memory | staat | 6 | De geometrie van de balk ligt vast in toetsen; lokaal leren mag kiezen wat er op een plek staat, nooit de plek verplaatsen. |
| 47 | Edge modes 2.0 | stap weg | 1 | Overzicht, Compact, Automatisch en Focus bestaan onder die namen, maar Automatisch kijkt naar scrollen en er draaien vijf standmachines. |
| 48 | Focus contract | stap weg | 3 | Focus bestaat als stand; wat hem mag doorbreken staat nergens. Hoort bij de voorgrondresolver. |
| 49 | Spatial expansion | staat | 1 | Van balk naar blad naar werkmodus bestaat, met dezelfde handelingen op elke trap -- in twee uitvoeringen. |
| 50 | Edge als runtime surface | jaren weg | 6 | Als presentatieoppervlak is de Edge de som van ronde 1 tot 5. Als engine of autoriteit komt hij er niet: dat botst met grens 1 en besluit 5. |

De zes punten die een besluit vroegen (9, 10, 14, 17, 21, 34) zijn op 23
september 2026 beslist (par. 8, besluiten 6 tot en met 10). Alleen punt 14 blijft
een besluit: overdracht tussen apparaten wacht op een eigen besluit over privacy
en bewaartermijn. Punt 34 is groter dan de Edge: hoedanigheid bestaat vandaag
alleen in `kern/vertegenwoordiging/`.

---

## 10. De zes bewijsrondes

Elke ronde eindigt pas als hij iets heeft BEWEZEN dat de vorige niet kon, en
nooit op "de functie staat erin".

| Ronde | Wat hij bewijst | Stand |
|---|---|---|
| 0 — fundament | de kaart, het ene leespad, herkomst per waarde, het actiecontract, de dekkingsmeter en de ratels | **staat** (dit document) |
| 1 — fundament verbreden | de dode kanalen gesloten of verwijderd, het tweede register alleen licht (uitvoering langs `RTGGewicht.voer`), elke hoofdactie in een blad zichtbaar voor de schil; en onderweg een antwoord op "wat weegt dit" en de gebaardrempels op een plek | **staat** (par. 11): 17 dode kanalen naar 0, dubbele eigenaars 12 naar 11; het tweede register is LICHT en nog niet LEEG (ronde 2) |
| 2 — context | elk scherm publiceert wereld, context en (waar het er een heeft) object en activiteit; `RTGWorkspaceContext` leest het blikveld; het tweede register leeg (de drie schermen die erop leunen, publiceren via `RTGAdaptief.declareer`) | een stap weg |
| 3 — actie en trust | het eerste serveroordeel per principal en capability, één vorm voor "waarom niet", de voorgrondresolver, gewicht afgedwongen in `RTGAdaptief.doe` | een stap weg, deels besluit |
| 4 — voortzetting en realtime | voortzetting als contract (besluit 1), presence met echte producenten, een task stack | een stap weg; de servervariant vraagt een besluit |
| 5 — Rahul | Rahul leest het blikveld en `waarom.js`, stelt handelingen voor uit het register, en beslist niets | een stap weg na ronde 3 |
| 6 — adaptieve prestaties | vooruit laden en lokaal leren (besluit 3), gemeten in plaats van gevoeld | jaren weg tot de meting er is |

---

## 11. Wat de inventaris vond, en wat ermee gebeurd is

Elf lezers liepen de Edge-lagen door en meldden 92 overlappingen en 115
gebreken. Dat zijn **meldingen van lezers**, graad `vermoed`, tot ze
nagetrokken zijn; hieronder staat wat er is nagetrokken en wat er mee gebeurde.

**Gerepareerd, met een toets die op een mutatie zakt:**

- de schil zette het wereldlabel op het `src`-attribuut van een blad, dus na een
  navigatie binnen het blad bleef het op de eerste pagina staan
  (`command/bladstand.js`);
- Home in de balk werd herkend aan zijn TEKST, dus in een andere taal ging Home
  de schil uit (`command.js`);
- een tabtitel ging als markup de schil in (`command/werktafel.js`);
- een opgeslagen blad met een backslash in het pad kwam langs de
  herkomstcontrole van het geheugen (`command/geheugen.js`);
- de contextsleutel zag alleen `aan` (par. 2);
- `allowed: false` zonder reden viel stil uit de balk en is nu een zichtbaar
  gebrek (par. 1);
- zonder gewichtstabel faalde een zware handeling open (par. 3);
- **ronde 1: de 17 dode kanalen zijn gesloten.** Zestien zijn weggehaald: de
  vijf luisteraars in `rtg-adaptive-edge-signals.js` (er komt geen verzonnen
  zender bij; de directe API blijft), de luisteraar op `rtg-edge-ready` (de
  observer op `data-rtg-adaptive-ready` was al de echte trigger), en de zenders
  van `rtg-adaptive-connect`, `rtg-world-start-ready`, `rtg-route-memory-ready`,
  `rtg-volscherm`, `rtg-beweging`, `rtg-wachtrij-leeg`, `rtgdeel`,
  `rtg-workspace-error`, `rtg-storyline-render` en `rtg-platform-role` -- wat die
  meldden, staat al als attribuut, klasse of melding. Een is aangesloten:
  `rtg-palet-open`, zodat de Zoeken-knop van de schil doet wat ⌘K doet
  (`werkruimte.html`). Die knop staat daar in een onderbalk die niet te zien is,
  dus de e2e bewijst de bedrading en niet dat een mens hem bereikt.
  `test/edgekaart.test.js` zakt op elk nieuw dood kanaal, en op een wandeling die
  niets ziet;
- **ronde 1: het tweede register ontloopt de gewichtsgrammatica niet meer.** Een
  handeling via `registerAction` had een eigen uitvoerweg: een eigen `confirm`
  via `window.confirm` ("weet u het zeker?", wat GRAMMATICA.md juist niet wil),
  langs het gewicht heen. `register()` in de Edge-kern weigert nu een eigen
  `confirm` en elk gewicht boven licht (met een waarschuwing, nooit stil licht
  uitgevoerd), en een tik gaat via `K.voer` langs `RTGGewicht.voer`
  (`test/rtg-adaptive-edge.test.js`, en `test/edgeblikveld.e2e.js` stap 8 op een
  echt scherm). Het register is LICHT en nog niet LEEG: dat is ronde 2;
- **ronde 1: een antwoord op "wat weegt dit".** `directMag()` gaf een onbekende
  trap licht terwijl `effectief()` hem zwaar maakt, en had geen aanroeper: weg.
  Drie plekken liepen daarnaast uiteen met de uitvoerder, en alle drie faalden ze
  de verkeerde kant op. Zonder grammatica zette `register.js` elk gewicht op
  licht, dus een zware handeling draaide met een tik (de eerdere zin hier dat de
  balk, de orb en de actiestaat "alle drie dichtgaan" klopte daardoor niet: zij
  kregen `licht` al binnen). De tweede trap van de werkmodus (`diepte.js`) voerde
  zonder gewichtlaag alles uit, en gaat nu langs dezelfde `voer` als het dock. En
  de uitleg (`waarom.js`) en de orb lazen het RUWE gewicht, dus een tikfout als
  `zwaarr` beloofde "Gebeurt meteen." en `terug` zonder weg terug beloofde een
  Ongedaan maken dat niet kwam; beide lezen nu `effectief()`. Vier
  gedragstoetsen in `test/grammatica.test.js` draaien de echte modules in een vm
  met een kleine nep-DOM, en zeven mutaties zijn nagetrokken;
- **ronde 1: de gebaardrempels staan op een plek.** Lang drukken was 480 ms in de
  balk en de orb en 620 ms in de adaptieve balk -- de balk die een lid op
  `app.html` echt gebruikt -- en omhoog trekken begon daar op 36 px terwijl
  GRAMMATICA.md 44 zegt. Nu staat er een tabel, `DREMPELS` in `grammatica.js`, en
  zes herkenners lezen hem als het gebaar begint (balkknop, orb, diepte, lagen,
  vasthoud en de invoerlaag). Er staat nergens meer een kopie: zonder tabel is
  het gebaar uit, de tik en de ⋯ blijven, en vasthouden bevestigt dan nooit. De
  lader van de adaptieve Edge brengt de grammatica zacht mee, en de landing plus
  de negen sitepagina's die de invoerlaag zelf laden, laden hem eerst. De kopie
  van de gebaarversheid in de Edge 2-lader is weg; die heeft een eigenaar
  (`rtg-edge-2-context.js`). `test/drempels.test.js`, vijf mutaties nagetrokken;
- **ronde 1: de hoofdactie van een blad is zichtbaar voor de schil.** Met een
  geopende agenda meldde de schil "het scherm wijst geen hoofdactie aan", een lege
  waarde met een reden die niet klopte: de knop stond in een ander document. Een
  eigen lezer (`edge/blikveld-hoofdactie.js`, zacht geladen vóór het blikveld)
  kijkt nu in het actieve blad, onder de drie eisen van de brug. De brug zelf was
  gemeten en afgevallen: van de 68 schermen met een `data-hoofdactie` laadt er een
  de brug. `test/edgeblikveld.test.js` (herkomst, niet lenen, beide gebreken, vijf
  onleesbare bladen, geen lezer, geen schrijfweg) en stap 4b en 5 van
  `test/edgeblikveld.e2e.js`: de agenda als blad geeft `+ Afspraak` met herkomst
  `blad:data-hoofdactie`, terug naar reizen weer `blad`, en de verklikker staat
  nu ook in het blad.

**Nagetrokken en open, met de ronde waarin ze horen:**

| Gebrek | Waar | Ronde |
|---|---|---|
| modulefouten van de werkruimte bereiken geen diagnose: `o.error` is de enige haak en geen aanroeper geeft hem mee (het dode kanaal `rtg-workspace-error` verborg dat) | `interface/workspace-runtime.js` | besluit (foutmelder heeft een budget van 3 en een deur zonder inlog) |
| de home-actie op de wereldbureaus hangt aan een observer die na de eerste keer losgaat; wordt de adaptieve Edge ooit opnieuw gestart, dan verdwijnt hij (vandaag start niets hem opnieuw) | `interface/world-desktop-home.js` | 2 |
| `RTGAdaptief.doe()` kijkt alleen of iets verhinderd is, niet wat het weegt; wie hem rechtstreeks aanroept, slaat de bevestiging over | `adaptief/register.js` | 3 |
| `gebaar.js` (op elk scherm met `basis.js`) heeft een eigen lang drukken van 520 ms en een borgtijd van 800 ms (sinds ronde 2 op de kaart, als beslisser naast de gebaarversheid van Edge 2; par. 1); naar de tabel halen vraagt eerst een meting van de wedloop in `test/helper.js` | `shared/gebaar/` | 2 |
| vier standmachines voor wat er van de Edge te zien is (de vijfde, de Second Screen, bleek een indelingsfout: par. 1) | par. 1 | 2 |
| vier geheugens voor "waar was ik" die elkaar niet lezen | par. 1 | 4 |
| "waarom niet" heeft aan de serverkant vijf vormen zonder gedeelde woorden, en `routes/stuur.js` maakt van elke weigering een kale `error` | `server/routes/stuur.js` | 3 |

Vijf gebreken uit dezelfde inventaris en uit de indeling van de vijftig punten
zijn in deze ronde wél gerepareerd, omdat ze bereikbaar waren of in de verkeerde
richting faalden:

- **een `bewust`-handeling in het Edge-blad deed op een los scherm niets.** De
  lader van de adaptieve Edge bracht de balkknoppen mee maar niet de gewichtlaag,
  dus op Office buiten de schil gaf een tik op Delen alleen een regel in de
  console -- precies de dode knop waar deze hele reeks mee begon. De lader neemt
  nu `lagen.js`, `vasthoud.js`, `waarom.js` en `gewicht.js` mee (na
  DOMContentLoaded, en alleen waar het scherm een register heeft), en daarmee
  zegt een verhinderde knop daar ook weer waarom (`test/edgeblikveld.e2e.js`,
  stap 7);
- **de Second Screen voerde uit langs het gewicht heen.** "Nu relevant" riep bij
  een tik `RTGAdaptief.doe()` rechtstreeks aan, dus een `bewust`-handeling ging
  zonder lade door en een `plechtig`-handeling zonder vasthouden. Hij gaat nu
  langs `RTGGewicht.voerId`, dezelfde weg als een tik in de balk
  (`test/grammatica.test.js`);
- **de orb voerde een zware handeling uit als de gewichtlaag ontbrak**, waar de
  balk weigerde. Latent (alleen `app.html` laadt de orb, en die laadt de
  gewichtlaag ook), maar de verkeerde faalrichting; nu gaan ze allebei dicht;
- **`bewust` zonder lade voerde direct uit**, waar `zwaar` dichtging. Nu gaan ze
  allebei dicht;
- **compensatie was alleen bij het TONEN nooit "Ongedaan maken"**: de uitvoerder
  keek niet naar `herstel` en zou een tegenboeking met een ongedaan-functie
  alsnog met een Ongedaan-knop in de rail uitvoeren. `gewicht.js` leest nu de
  capability en haalt de weg terug weg (`test/grammatica.test.js`).

En een derde was geen gebrek maar een dubbele regel: "`terug` zonder weg terug
wordt `bewust`" stond in `gewicht.js` (dat uitvoert) en in `actiestaat.js` (dat
toont). Hij woont nu op één plek, `grammatica.effectief()`, en daar is een
onbekende trap `zwaar` in plaats van `licht`.

**Niet nagetrokken**: de rest van de 115. De ruwe inventaris was een eenmalige
leesronde en staat met opzet **niet** in de repository: een lijst beweringen die
niemand heeft nagetrokken hoort geen register te worden — een model mag
betekenis voorstellen, alleen een deterministische meting stelt waarheid vast
(`CODE.md`). Wat eruit bleef staan, staat gemeten in `EDGEKAART.json` of
nagetrokken in de tabel hierboven. Elke volgende ronde leest zijn eigen laag
opnieuw na in plaats van op deze lijst te vertrouwen.

---

## 12. Wat dit document niet zegt

- Het zegt niet dat de Edge af is. Ronde 0 bouwt geen nieuwe
  productintelligentie; hij maakt meetbaar wat er is.
- Het zegt niet dat een veld dat `ja` zegt, klopt. Dat bewijst de toets van het
  scherm.
- Het zegt niet hoe de Edge eruit moet zien. Dat staat in `ONTWERP.md`,
  `MATERIAAL.md` en `GRAMMATICA.md`, en een visueel herontwerp hoort niet in deze
  ronde.
- Het zegt niet wie iets mag. Dat is `CONTROLPLANE.md` en de server; de Edge
  toont het.
