# RTG Concierge — de lus rond een wens

Status: richtingsdocument, 30 september 2026; stap 0 tot en met 8 staan sinds dezelfde dag in de server (par. 0a). Net als `PLATFORM.md`,
`ECONOMIE.md` en `INTELLIGENTIE.md` staat er bij elk onderdeel een van vier
standen: **staat**, **een stap weg**, **vraagt een besluit** of **jaren weg**.
Zo ziet niemand de vier voor elkaar aan.

> De gast vertelt één keer wat hij wil. Iedereen daarna krijgt precies de
> context, de bevoegdheid en de taak die hij nodig heeft, en de gast merkt niets
> van de organisatie erachter.

Aan de voorkant ervaart de gast één ding: *ik heb het gevraagd, zij regelen
het.* Aan de achterkant is dit geen conciërge-app. Het is een
samenwerkingslus rond één wens, waarin gast, case-eigenaar, collega-conciërges,
partnerbedrijven, hun beslissers en uitvoerders elk hun eigen stukje zien.

Het voorstel waar dit document op antwoordt, beschrijft die lus goed. Het
schiet op één punt tekort, en dat punt stuurt het hele document: **het meeste
bestaat al**. Het staat alleen verspreid over vijf ingangen die elkaar niet
kennen. Het werk is dus eerst *samenvoegen en aansluiten*, en pas daarna
*uitvinden*. De toetsvraag uit `PLATFORM.md` beslist dat: is dit een
zelfstandige capability, of een tweede ingang naar dezelfde?

---

## 0. De meting: wat er vandaag staat

Er is in dit huis niet één conciërge. Er zijn er vijf:

| ingang | waar | wat het is | vorm |
|---|---|---|---|
| Concierge-bureau | `kern/lifestyle/index.js` | het oude verzoek van De Rechterhand | titel + 4 statussen + `updates[]` |
| Privékantoor-cases | `kern/bureau/cases*.js` | "een verzoek wordt een dossier" | 4 soorten, 7 statussen, team, delegatie, tijdlijn, deelopdrachten |
| Rendez-vous-conciërge | `kern/rendezvous-concierge.js` (+ `-arrange.js`) | conciërge binnen daten | 7 standen, met een voorstel en akkoord van het lid, idempotent |
| Hotelconciërge | `kern/hoteldorp/afdelingen.js` | de afdeling Concierge van een zaak ("Wens van de gast") | open → bezig → geregeld |
| Mall-conciërge | `kern/mall/concierge.js` | een zin wordt een zoekopdracht | het model levert alleen filters |

De kop van `bureau/cases.js` zegt al wat er met de eerste mis is: *"Het oude
concierge-verzoek was een titel met een status. Dat werkt voor 'boek een tafel'
en breekt bij 'mijn moeder wordt 70, doe iets bijzonders'."* Toch staan ze nog
steeds allebei. Dat is precies de vorm die `SCHERMEIGENAAR.json` "een tweede
ingang naar dezelfde capability" noemt.

Per stap van de voorgestelde lus is dit de stand:

| stap uit het voorstel | bestaat als | stand |
|---|---|---|
| wens → case | `bureau/cases.js` `caseOpen` | **staat** |
| case-eigenaar | `service/loop.js` `eigenaar`, maar het bureau wijst **rollen** aan en geen namen | half |
| eerst de normale route | `ervaring/tafels.js` `reserveerTafel`, `avond/aanvragen.js` | **staat** |
| overgang naar uitzondering | soort `bijzonder` bestaat, maar wordt alleen bij het openen gekozen | **een stap weg** |
| routes naar een resultaat | niets; `mall/aanvragen.js` is open vraag aan de markt | **een stap weg** |
| collega-conciërge | niets. Er bestaat geen netwerk van vakmensen tussen zaken | **vraagt een besluit** |
| partner ziet alleen zijn stukje | `service/zaak.js` `verwijzing()`, de `deel`-poort in `levensgraaf/graaf.js` | vorm staat, niet aangesloten |
| beslisser bij de partner | `req.actor.manager` bestaat, maar alleen op horecaroutes | **een stap weg** |
| mogelijkheid met houdbaarheid (hold) | niets; alleen het principe in `commerce/werkwoordlijst.js` (`reserveer` vervalt) | **een stap weg** |
| mandaat van de gast | `bureau/delegatie.js`: L0–L4 plus een eurogrens per domein | **staat** voor leden |
| één uitvoeringstijdlijn | `avond/plan.js` + `avond/klok.js` (herberekent bij elke wijziging) | **staat** |
| afwijking met gevolgen | `bureau/reisdek.js`: een verstoring krijgt gevolgen, elk met een eigen stand | **staat** voor reizen |
| herstel | `reisoplosser.js` `los`/`doe`, soort `warroom` | half |
| afsluiten met uitkomst | `SERVICE.md` par. 12: opgelost zonder het verhaal opnieuw te vertellen | vorm staat |
| relatiegeheugen | `bureau/relaties.js` (banden, ontmoetingen, `nooitOver`), `lifestyle` voorkeuren | **staat** |
| kennis over routes | niets | **vraagt een besluit** |

Het voorstel beschrijft dus zestien stappen. Negen daarvan staan geheel of half,
vijf zijn een stap weg en twee vragen een besluit van de eigenaar. Geen enkele
is jaren weg. Dat is geen reden om het klein te maken. Het is wel de reden dat
de eerste week geen nieuwe module oplevert, maar één conciërge in plaats van
vijf.

---

## 0a. Wat er sinds 30 september 2026 staat

De lus is gebouwd op de cases van het Privékantoor, als een tweede
**werkwijze** (`voorstel`) en niet als een tweede wachtrij. Met mijn
aanbevelingen uit par. 5 als uitgangspunt, want de eigenaar vroeg de hele lus
te bouwen voordat de besluiten B1–B5 waren genomen. Die besluiten staan dus nog
open; wat hieronder staat, kiest steeds de optie die ik aanbeval.

| stap (par. 6) | waar | toets |
|---|---|---|
| 0. één conciërge | `kern/lifestyle/verzoek.js`: het oude verzoek is een schil over een case in de lus | `test/lifestyle.test.js` (ongewijzigd groen), `test/conciergelus.test.js` stap 0 |
| 1. CON-08 als toets | `lus-regels.js` `magBereiken`; de lus heeft geen weg naar agenda, ontvanger of gezin | `test/conciergelus-regels.test.js`, `-kern.test.js` |
| 2. intake | `lus-intake.js`: velden uit een zin, zonder model; wat ontbreekt wordt een vraag | `test/conciergelus-regels.test.js` |
| 3. overgang naar bijzonder | `lus.js` `lusWeigering`: de weigering staat in de tijdlijn, daarna pas de soort | `test/conciergelus.test.js` |
| 4. ieder zijn stukje + tegenvoorstel | `lus-regels.js` `deelnemerBeeld` (positieve lijst), `/api/supplier/concierge/opdrachten`; `kern/ervaring/tafeluitzondering.js` | `test/conciergelus*.test.js`, `test/tafeluitzondering.test.js` |
| 5. houdbaar aanbod | `lus-regels.js` `aanbodStand`: verval berekend; een tegenvoorstel houdt capaciteit vast tot zijn termijn | beide, met een verzette klok |
| 6. doorzetten naar de beslisser | `tafeluitzondering.js` `doorzetten`: daarna beslist alleen `req.actor.manager` | `test/tafeluitzondering.test.js` |
| 7. tijdlijn per deelnemer + gevolgen | `lus-uitvoering.js` `lusVertraging` / `lusVerstuur`: klaarzetten, en pas versturen als alles gezien is | `test/conciergelus.test.js`, `-kern.test.js` |
| 8. herstel + afsluiten | `lusKapot` (stand `in herstel`, dezelfde case), `afsluitbaar` + `afsluitUitkomst` in het bureau | `test/conciergelus.test.js` |

Het mandaat kreeg er één ding bij dat in par. 2.10 ontbrak: een **speelruimte in
tijd** per case (`speelruimteMin`). Een voorstel dat verder van de gevraagde tijd
ligt, gaat naar het lid, ook als het geld binnen de grens valt.

Elke schrijfroute is met een dubbeltik gemeten (`test/conciergelus-dubbel.test.js`)
en heeft een contract in `server/lib/mutatiecontracten-conciergelus.js`. Een
toelichting van het lid is met opzet een tweede handeling.

**Wat er NIET staat**, en dat is evenveel:

- **Geen schermen.** Alles hierboven is server en toetsen. Het kantoor ziet de
  cases uit de lus op het bestaande bureau (`lus: true`), maar er is nog geen
  knop voor een aanbod, een vertraging of een herstel. Het lid ziet zijn case in
  het Privékantoor, maar nog geen voorstel om op te drukken. Volgens
  `BETROUWBAARHEID.md` bestaat de functie daarom voor een mens nog niet.
- **De routekaart (2.5)** is niet gebouwd; het kantoor noemt een route nog zelf.
- **Het collega-netwerk (2.6)** en **de kennis over routes (2.16)** wachten op
  B3 en B5.
- **De hotelconciërge als eigenaar (B1)** niet: de lus draait op het
  levensdossier van een lid. De regels in `lus-regels.js` zijn wel puur, zodat
  een tweede ingang dezelfde regels kan gebruiken.
- **Rendez-vous** houdt zijn eigen conciërgewachtrij; B2 is voor die ingang nog
  niet uitgevoerd.
- **Een grens per handeling** ("extra boven € 250") bestaat nog niet; er is één
  grens per domein plus de speelruimte in tijd.
- **Geen conciergeproef** (een ketenproef naar het voorbeeld van `scripts/tafelproef.js`). De schakels en storingen van par. 6
  zitten in de toetsen, niet in een ketenproef die `KETENVORM.json` meeneemt.
- **Geen as van de machine.** Zestien nieuwe schrijfroutes raken geen enkele
  as van `npm run machinedekking`, en `mutatiesZonderEnigeAs` ging daardoor van
  2757 naar 2773. Dat is een teller die alleen hoort te dalen, en hij is hier
  bewust vastgelegd in plaats van opgepoetst: de herhaling is wel beproefd
  (`test/conciergelus-dubbel.test.js`), maar de meter leest de as `herhaling`
  uit `IDEMPROEF.json`, en de idemproef kan deze routes niet aan het werk
  krijgen zonder een case in `scripts/lib/idemwereld.js`. Een woord als
  `idempotentie` in de code zetten zou de as laten branden zonder dat er iets
  gemeten is. Wat hem omlaag brengt: die wereld bouwen, zodat de proef de
  bescherming zelf ziet.

## 1. Twee case-eigenaren, één motor

Het voorstel spreekt over "de hotelconcierge" en "Sophie". In dit huis zijn dat
twee verschillende mensen, en het verschil is geen detail:

- **De Rechterhand** is RTG's eigen conciërge voor een lid met Lifestyle of
  Business. De case staat in het levensdossier van dat lid
  (`kern/levensdossier.js`), en het lid heeft zelf een mandaat ingesteld.
- **De conciërge van een zaak**, zoals een hotel dat RTG Business gebruikt,
  bedient een gast die meestal géén lid is. De case is dan van het hotel.
  De gast staat erin zoals `kern/tafelwensen.js` een gast van buiten opneemt:
  met een voornaam of een kamernummer, en niet meer.

Het is één motor met twee ingangen. Twee motoren zou de `rides`/`mobOpdrachten`-fout
worden: twee ritwerelden met nul verwijzingen tussen beide. Wat per ingang
verschilt, is **wie de case bezit** (een lid of een zaak), **waar het mandaat
vandaan komt** en **welke toon er klinkt**. Voor een lid met Lifestyle is dat
de vertrouwde rechterhand in de u-vorm. Voor de gast van een hotel is het de
toon van dat hotel, want het merk van een klant geldt binnen zijn eigen blok
(`TENANT.md`).

**De RTG Pass heeft geen conciërge, en dat blijft zo.** `SERVICE.md` par. 3
haalde dat uit elkaar. De Rechterhand is UITVOERING en wordt gekocht. Een mens
bij een probleem is een ondergrens voor iedereen. Een lid met de RTG Pass krijgt
de zelfbedieningshelft van deze lus: de avond samenstellen
(`avond/samenstellen.js`), de oplosser (`reisoplosser.js`) en de tijdlijn. Wat
hij niet krijgt, is iemand die het vóór hem doet.

---

## 2. De lus, stap voor stap

Bij elke stap staat wat de gast merkt, wat het systeem doet, waar dat al staat
en welke grens er geldt.

### 2.1 De wens

**Wat de gast merkt:** hij zegt één zin. *"Mijn vrouw is morgen jarig, we zijn
in Amsterdam, ze weet van niets en ik wil dat het echt bijzonder wordt."* Er
volgt geen formulier en geen keuzemenu voor restaurant, datum en aantal
personen.

**Wat het systeem doet:** het vertaalt die zin naar een case met velden:

| veld | voorbeeld | waar het vandaan komt |
|---|---|---|
| doel | verjaardag bijzonder maken | de zin |
| voor wie | gast + partner | de zin, en `relaties.js` als die er is |
| wanneer / waar | morgen, Amsterdam | de zin |
| **verrassing** | ja | de zin, en het is een **privacystand** (zie 3.8) |
| budget | bekend / vragen / vrij | het mandaat (2.9), anders een vraag |
| harde grenzen | allergie, mobiliteit, tijd | `gastzorg`, `tafelwensen`, voorkeuren |
| zachte voorkeuren | sfeer, keuken, stijl | `lifestyle` `voorkeuren` |
| geslaagd als | een bijzondere avond zonder regelwerk voor de gast | de zin |

**De vorm staat al** in `mall/concierge.js`: *het model vertaalt de zin naar
FILTERS en produceert geen zinnen die de gebruiker leest.* Daardoor kan het
geen restaurant, prijs of beschikbaarheid verzinnen. Deze intake gebruikt
precies die vorm, met velden in plaats van filters. Een veld dat het model
niet zeker kan vullen, blijft leeg en wordt een vraag. Het mag nooit een gok
worden. Een half begrepen wens mag er niet uitzien als een goed begrepen wens.

**Stand:** een stap weg. `caseOpen` bestaat, de extractie niet.

### 2.2 De case-eigenaar

**Wat de gast merkt:** één naam. *"Sophie regelt dit voor u."*

Hier botst het voorstel met een regel die al in code staat. `cases-soorten.js`
wijst **rollen** aan en geen namen: *"een naam op een scherm die er in het echt
niet is, is precies de belofte die wij niet doen."* Die regel blijft. De naam
verschijnt dus pas **als een echte medewerker de case heeft opgepakt**, via
`service/loop.js` `eigenaar()`, dat eerst de regel schrijft en dan het veld.
Tot dat moment staat er de rol: *"Een van onze mensen neemt dit persoonlijk
op."* De naam komt uit de kluis en nooit uit de operationele data.

Er kunnen twintig mensen aan één case werken. Voor de gast blijft er één
eigenaar. Een overdracht bij ziekte of een dienstwissel is een regel in de
tijdlijn. De gast ziet die alleen als de naam verandert, en dan met de reden
erbij.

**De cockpit van de eigenaar** hoeft geen nieuw scherm te worden. Het is
`apps/concierge.html`, de eigenaar volgens `SCHERMEIGENAAR.json`. Wat erbij
moet, is wat het voorstel goed ziet: per case wat er open staat, waar de gast
op wacht (vaak: niets), de deadline, en **de volgende stap met zijn reden in
woorden**. Er komt geen score en geen urgentiekleur zonder oorzaak
(`EDGE.md`: *gewicht is geen voorrang*).

**Stand:** half.

### 2.3 Eerst de normale route

Een netwerk van vakmensen val je niet lastig voor iets dat gewoon kan. De case
probeert eerst de gewone weg: een zaak binnen RTG, beschikbaarheid, een
bestaande afspraak, een gewone reservering (`ervaring/tafels.js`,
`avond/aanvragen.js`). Lukt dat binnen het mandaat, dan gaat de case door naar
uitvoering.

**Stand:** staat.

### 2.4 Van gewoon naar uitzondering

Weigert de gewone route, dan wordt de case **bijzonder**. Die soort bestaat al,
met de juiste regel: *"Gaat ALTIJD naar een mens en vraagt ALTIJD om akkoord,
ongeacht de delegatiestand, want wat niet routine is, kan per definitie niet
onder een routineafspraak vallen."* Wat ontbreekt, is dat de overgang vanzelf
gebeurt. Vandaag wordt de soort alleen bij het openen gekozen.

Die overgang is een **regel in de tijdlijn met de weigering als oorzaak**.
Hij verandert niet stil een veld. Het mandaat van de gast (2.9) geldt vanaf dat
moment niet meer als vrijbrief. Dat staat al in de soort, en dat is goed.

**Stand:** een stap weg.

### 2.5 Routes naar een resultaat

Het voorstel vraagt niet *"welke andere restaurants zijn vrij?"* maar *"langs
welke legitieme wegen kan deze wens alsnog uitkomen?"*. Dat verschil is de kern
van het vak. De vorm ervan is een **projectie met etiketten** zoals
`levensgraaf/graaf.js`. Het is geen graaftabel en geen `routes`-object, want
elke bron houdt zijn eigen betekenis.

| route | bron | etiket |
|---|---|---|
| publieke voorraad | het domein zelf | beschikbaar / niet |
| mens bij de zaak | de zaak binnen RTG | bereikbaar / niet |
| beslisser bij de zaak | 2.8 | bestaat / niet |
| bestaande relatie | eerdere cases met die zaak | *sinds, laatste keer*, nooit "sterk" |
| collega-conciërge | 2.6 | alleen na besluit B3 |
| tijd verschuiven | het mandaat van de gast | binnen ±60 min / vragen |
| vergelijkbare ervaring | `avond/samenstellen.js` | *met de reden waarom vergelijkbaar* |

Voor deze kaart gelden drie regels uit `CONNECT.md` en `INT-04`. **Er wordt
niets gewogen of gesorteerd tot één getal.** Elke route draagt haar reden in
woorden. **Een bron die niet kijkt, zegt dat hij niet kijkt**
(`KAARTEN.md` par. 6). En een relatie tussen twee zaken krijgt feiten (sinds,
hoe vaak, laatste uitkomst) en geen sterkte. Een sterkte is een cijfer op de
mensen die die relatie dragen.

**Stand:** een stap weg. De bronnen staan er, de projectie niet.

### 2.6 Een collega-conciërge vragen

Dit is het enige onderdeel dat **nergens** bestaat. De verkenning vond geen
netwerk van vakmensen tussen zaken, geen verwijzing tussen collega's en geen
kring. Het dichtstbij komen `partnerCandidates` in `rendezvous-partners.js`
(een lijst die het kantoor per stad cureert) en `horeca/wijk-overdracht.js`
(overdracht binnen één zaak).

Wat het voorstel goed ziet: de vraag aan een collega gaat niet over de gast
maar over **wat er nodig is**.

```
Professioneel verzoek
morgen 19:00–22:00 · locatie voor een besloten diner · 2 personen
aan het water · discretie gevraagd
identiteit van de gast: verborgen
gevraagde hulp: een lokale relatie of locatie
```

Wie reageert met *"ik kan helpen"*, wordt **meewerkend**. De vragende
conciërge blijft eigenaar. Dat is dezelfde grammatica als
`service/machtiging.js`: het bereik is de case, en een machtiging kan alleen
versmallen.

Drie dingen maken hier een besluit nodig in plaats van een bouwtaak:

1. **Wie mag erin?** Een conciërge van een zaak is een vakmens.
   `kern/persoonseis.js` en `kern/vakbewijs.js` kennen de vorm (een ingediend
   stuk is geen bewijs, een mens van RTG tekent af), maar er is geen genre
   "conciërge" en geen vakbewijs voor dit werk.
2. **Wat staat er tegenover?** Een fooi of commissie tussen conciërges is een
   nieuwe geldstroom. `COMMERCIE.md` houdt de partnervergoeding over omzet op
   **nul**, en `MENSNETWERK.md` MN-03 eist dat RTG meldt waar het aan verdient.
   Een vergoeding tussen vakmensen hoort dus bij een besluit en niet in een
   veld.
3. **Hoe wordt het netwerk gevonden?** Dat gebeurt op stad, specialisme en
   beschikbaarheid. **Nooit op een ranglijst van conciërges, ook niet intern
   als sorteersleutel.** Die grens staat in `CARRIERE.md` (CAR-05),
   `HDI.md` en `KANTOORMACHT.md`.

Daarbij hoort een merkregel uit `CLAUDE.md`. Echte beroepsverenigingen, zoals
een internationale vereniging van hotelconciërges, voeren we nooit op als
partner of keurmerk zolang daar geen overeenkomst achter staat.

**Stand:** vraagt een besluit (B3).

### 2.7 Het partnerbedrijf: ieder zijn stukje

Het restaurant ziet dit:

```
Diner · 2 personen · 20:00 gewenst · verjaardag
dieetwens: X · wens: een rustige tafel
aangevraagd door: geverifieerde conciërge
antwoord gevraagd vóór 14:00
```

Het ziet geen hotelkamer, geen vlucht en niets anders over de gast. **Dit is de
harde architectuurregel van deze laag: iedere deelnemer ziet alleen het stukje
werkelijkheid dat hij nodig heeft.** De vorm bestaat twee keer. `verwijzing()`
in `service/zaak.js` gooit alles weg wat geen soort of code is, en `deel` in
`levensgraaf/graaf.js` is een poort en geen etiket. Een deelnemersweergave is
dus een **projectie per rol over dezelfde case**. Het is geen kopie die de
partner krijgt, want een kopie loopt uit de pas zodra de case verandert.

Wat vandaag ontbreekt, is een antwoord dat meer is dan ja of nee.
`beslisReservering` kent `bevestig` en `weiger`, en geen tegenvoorstel. *"Niet
om 20:00, wel om 21:15"* is precies het antwoord waar een conciërge van leeft.

**Stand:** de vorm staat, de aansluiting is een stap weg.

### 2.8 De beslisser bij de partner

Een medewerker van het restaurant ziet *vol*. Hij kan het verzoek doorzetten
naar iemand die mag beslissen. De manager krijgt het verzoek, de reden
waarom een uitzondering wordt gevraagd, de bestaande relatie, en de antwoorden
die hij kan geven: nee, wachtlijst, andere tijd, intern uitzoeken of een
alternatief.

**De grens in één zin: RTG brengt de beslisser bij het probleem, en nooit de
druk.** Er komt geen *"VIP!"*, geen aftelklok, geen label als "grote besteder"
(`HORECA.md`) en geen aansporing (`ONTMOETEN.md` par. 4: de knop mag, de
aansporing niet). Een nee is een geldig antwoord en blijft zichtbaar als nee.
Het wordt niet omgedoopt tot "nog niet gelukt".

`req.actor.manager` bestaat al op horecaroutes. De doorzetknop moet op dezelfde
rol hangen, zodat er geen nieuwe rol bij komt.

**Stand:** een stap weg.

### 2.9 Een mogelijkheid die houdbaar is

*"Mogelijk om 21:15. De tafel is beschikbaar tot 23:00. We houden dit 12
minuten vast."* Dat antwoord komt terug in dezelfde case, en niet in een
WhatsApp-bericht.

Er bestaat vandaag **nergens** een vastgehouden aanbod van een partner met een
vervaltijd. Wel staat het principe er al (`commerce/werkwoordlijst.js`, het
werkwoord `reserveer`: *"een reservering zonder vervaltijd is een verkoop
zonder betaling"*). Drie regels liggen daarmee vast:

- **Verval is een berekende toestand en geen opruimtaak**, net als bij
  `service/machtiging.js` en `vertegenwoordiging/machtiging.js`. Een aanbod na
  zijn tijd is verlopen, ook als niemand heeft opgeruimd.
- **Een vastgehouden aanbod is geen boeking.** Het scherm zegt
  *"vastgehouden tot 20:52"* en nooit *"geregeld"*.
- **Vasthouden verplaatst geen geld.**

Let op de naam. `optie` is bezet (`ZAAK_OPTIES`), net als `toezegging` (de
financiële belofte van het mecenaat) en `reservering`. Een kandidaat als
`aanbodTot` komt nergens voor. De naam wordt pas gekozen als hij gemeten is.

**Stand:** een stap weg.

### 2.10 Het mandaat van de gast

Het mooiste van het voorstel zit hier. Twintig meldingen als *"is € 12 extra
goed?"* zijn het tegendeel van luxe. **Dit mandaat staat al**, in
`bureau/delegatie.js`: vijf niveaus per domein (L0 informeren tot en met L4
autonoom), een eurogrens per domein, en een **dak dat het lid niet kan
optillen**. Een case bevriest het mandaat op het moment dat hij opent, zodat
een wijziging halverwege het lopende werk niet stil verruimt.

Het voorbeeld uit het voorstel valt er precies in:

| mandaat | in `delegatie.js` |
|---|---|
| budget € 1.500 | eurogrens van het domein `gelegenheden` |
| tijd ±60 minuten | **ontbreekt**: een speelruimte in tijd bestaat niet |
| vervoer zelfstandig regelen | domein `vervoer` op L3 |
| ander restaurant zelfstandig | domein `gelegenheden` op L3 |
| extra boven € 250: toestemming | grens per handeling: **ontbreekt**, er is één grens per domein |
| persoonsgegevens: minimaal | geen mandaat maar een vaste grens (3.2) |

Voor de gast van een hotel, die geen lid is, bestaat er vandaag geen mandaat.
De grammatica ligt wel klaar in `stuur/mandaat.js`: een mandaat versmalt,
verleent nooit iets, en **leeg is dicht**. Een gast die niets heeft
afgesproken, heeft dus alles aan zichzelf voorbehouden.

Twee dingen blijven mensenwerk, hoe ruim het mandaat ook is
(`stuur/mandaat.js`: *voorbereiden, verplichten en betalen zijn drie
gebeurtenissen*): geld wordt klaargezet en een mens voert het uit, en wat een
tweede persoon bereikt, bevestigt een mens (3.6).

**Stand:** staat voor leden. Tijd, een grens per handeling en het mandaat voor
een gast zonder lidmaatschap zijn een stap weg.

### 2.11 Eén uitvoeringstijdlijn

```
17:45 bloemen naar het hotel
18:10 chauffeur
19:00 boot
20:40 chauffeur
21:15 diner
23:00 chauffeur stand-by
```

**Die tijdlijn staat al.** `avond/klok.js`: *"Elke stap begint nadat de vorige
is afgelopen, met de reistijd ertussen; heeft een stap een eigen tijd, dan
wordt daarop gewacht."* Hij wordt bij elke wijziging opnieuw berekend, dus een
vertraging verschuift vanzelf alles wat erna komt. Een plan dat na `thuisOm`
eindigt, wordt geweigerd met het aantal minuten dat het uitloopt.
`avond/plan.js` voegt de belofte toe die hier telt: *niets is geboekt tot het
geboekt is*, en een plan is zo zeker als zijn onzekerste stap.

Wat ontbreekt, is dezelfde projectie als in 2.7: **ieder ziet zijn eigen stuk
van de tijdlijn.** De chauffeur ziet zijn drie ritten en het adres waar hij
moet zijn. De bloemist ziet 17:45 en het hotel. De gast ziet alleen wat de
ervaring beter maakt. Bij een verrassing ziet hij zelfs dat niet, en ziet zijn
partner niets (3.8).

**Stand:** staat. De projectie per deelnemer is een stap weg.

### 2.12 Afwijking: gevolgen uitrekenen, één keer bevestigen

De boot heeft 25 minuten vertraging. Het systeem rekent door: chauffeur +25,
aankomst restaurant 21:30. Geldt het aanbod van de manager dan nog? Het
bloemenmoment schuift.

`bureau/reisdek.js` heeft de vorm al voor reizen: *een verstoring krijgt
GEVOLGEN als eigen regels, elk met een eigen stand (genoteerd, geregeld,
vervallen)*. Zo is te zien wat er nog open staat, in plaats van alleen dat er
iets mis is. Samen met `avond/klok.js` levert dat de doorrekening.

Het voorstel zegt *"de chauffeur kan automatisch worden verschoven"*. Dat mag
hier niet. De chauffeur is een tweede persoon, en `LIFE.md` zegt: *alles wat
een tweede persoon bereikt, wordt nooit automatisch.* De vorm die wel mag, is
net zo licht:

> **Verstoring.** Boot +25 min. Het restaurant kan 21:30 aanhouden (bevestigd
> door de manager om 20:31). Drie berichten staan klaar: chauffeur, restaurant,
> bloemist. **[Verstuur alle drie]**

Dat is één druk op de knop, en alle drie de berichten staan zichtbaar in beeld.
Een bericht dat niet te zien was, is ook niet bevestigd. Wat de afwijking
niet kan oplossen (het restaurant houdt 21:30 niet aan), staat er als
openstaand gevolg bij. Het verdwijnt niet in een samenvatting.

**Stand:** staat voor reizen. Het aansluiten op de avondtijdlijn is een stap weg.

### 2.13 Herstel

Om 20:40 belt het restaurant: er is een probleem in de keuken en de reservering
vervalt. Niet alles wordt rood. **Het doel blijft hetzelfde en één onderdeel
is kapot.** Herstel is daarom stap 2.5 opnieuw, maar vanaf de plek waar de
gast nu is. Het vraagt: hetzelfde niveau, dezelfde buurt, de relaties die er
zijn, de reistijd vanaf de huidige plek, de keuken, de privacy, de
sluitingstijd en de ruimte voor uitzonderingen.

De soort `warroom` bestaat al (*"slaat de budgetvraag over: bij een incident is
de vraag niet wat het kost"*). Maar een warroom is voor iets dat misging, en
dit is een case die al liep. Herstel is daarom een **stand binnen de case** en
geen nieuwe case. Anders vertelt de gast zijn verhaal opnieuw, en dat is
precies de maat uit `SERVICE.md` par. 12.

`reisoplosser.js` heeft de regels al: *"beschikbaar volgens het bord van nu"*
is het meeste wat hij zegt, en *"soms valt er niets te doen"* is een eerlijke
uitkomst.

**Wat de gast hoort, en wat hij niet hoort.** Het voorstel eindigt met *"We
hebben het programma iets aangepast. Alles is geregeld."* De eerste zin is
goed. De tweede mag er alleen staan **als elk onderdeel echt bevestigd is**.
Anders is het de belofte die dit huis niet doet: *"De boot en de chauffeur
staan. Voor het diner hebben we twee opties vastgehouden; binnen tien minuten
hoort u welke het wordt."* Ook dat is luxe, omdat het waar is.

**Stand:** half.

### 2.14 Afsluiten: uitkomst in plaats van status

Een case gaat niet in één stap naar *gesloten*. Eerst komen de vragen:

| vraag | bron | wat er NIET gemeten wordt |
|---|---|---|
| is de wens uitgekomen? | de case-eigenaar, in woorden | geen cijfer van 1 tot 10 |
| zijn alle beloften nagekomen? | de stand van elk onderdeel op de tijdlijn | |
| wie leverde wat? | de deelnemers op de tijdlijn | geen rapportcijfer per partner |
| welke uitzondering werkte? | 2.8, 2.9 | |
| wat ging mis en hoe is het opgelost? | 2.12, 2.13 | |
| moest de gast iets opnieuw vertellen? | de tijdlijn | *dit is de kwaliteitsmaat* |

`SERVICE.md` par. 12 legt de maat al vast: gemeten wordt hoeveel problemen
zijn opgelost **zonder dat de melder zijn verhaal opnieuw hoefde te doen**. Wat
er niet gemeten wordt (tevredenheid, afhandeltijd per medewerker, een
samengesteld rapportcijfer), staat met de reden in het antwoord zelf.

**Stand:** de vorm staat, de aansluiting niet.

### 2.15 Relatiegeheugen

`bureau/relaties.js` staat al: banden, ontmoetingen, context, en het veld
`nooitOver`. Dat laatste is *"geen roddel maar een hoffelijkheid"*. De regel
staat erbij: **vertrouwelijk; het conciërgebureau krijgt het niet.** Dat
geldt hier ook. Een case mag het geheugen van het lid LEZEN als het lid dat
wil. Hij schrijft er niets in wat het lid niet zelf kan zien en wissen.

Voor de gast van een hotel geldt `TENANT.md`. Het geheugen van het hotel is
van het hotel. Het gaat niet naar RTG en niet naar een ander hotel, ook niet
via een collega-conciërge.

**Stand:** staat voor leden.

### 2.16 Kennis: het tweede vliegwiel

```
onmogelijk verzoek → een mens lost het op → een bewezen route
→ de volgende conciërge krijgt hulp → sneller → nieuwe relaties
```

Dit vliegwiel is echt, en het is het deel dat geen concurrent heeft. Er geldt
één grens, en die is scherp: **kennis gaat over zaken en routes, nooit over
gasten.** *"Dit restaurant heeft een besloten zaal, en de manager beslist daar
zelf over"* is kennis. *"De heer X komt hier elk jaar met zijn vrouw"* is geen
kennis maar een dossier over een mens.

Voordat er iets gedeeld wordt, is er ook de vraag van wie die kennis is. Van de
conciërge die hem vond? Van zijn hotel? Van het netwerk? Dat is besluit B5.

**Stand:** vraagt een besluit.

---

## 3. De grenzen

Waar een functie met een grens botst, vervalt de functie. Bij elke grens staat
waar hij vandaan komt en wie hem vandaag handhaaft.

| # | grens | komt uit | handhaver vandaag |
|---|---|---|---|
| CON-01 | **De gast vertelt het één keer.** De case draagt de context, niet de gast. Herstel is een stand binnen de case en geen nieuwe case. | `SERVICE.md` par. 12 | `lusKapot` + `test/conciergelus.test.js` (dezelfde case, `opnieuwVerteld` geteld) |
| CON-02 | **Ieder ziet zijn stukje.** Een deelnemer krijgt een projectie van de case, nooit een kopie en nooit het dossier. | `service/zaak.js` `verwijzing()`, `graaf.js` `deel` | `deelnemerBeeld` + `test/conciergelus-regels.test.js` (exacte veldenlijst) |
| CON-03 | **Alleen een mens zet "geregeld".** Geen route van de gast en geen AI kan het zetten. De AI verzint geen aanbod, beschikbaarheid of partner. | `bureau/cases.js`, `mall/concierge.js` | **ja**, in code |
| CON-04 | **RTG brengt de beslisser, nooit de druk.** Er komt geen aansporing, geen VIP-label en geen aftelklok. Een nee blijft een nee. | `ONTMOETEN.md` par. 4, `HORECA.md` | half: `doorzetten` draagt alleen een reden, en `test/tafeluitzondering.test.js` houdt een nee als nee; een verbod op labels heeft geen toets |
| CON-05 | **Geen cijfer op een mens.** Er komt geen ranglijst van conciërges, geen gastwaarde en geen relatiesterkte. Routes dragen redenen in woorden. | CAR-05, INT-04, `CONNECT.md` | niemand |
| CON-06 | **Wat een tweede persoon bereikt, bevestigt een mens.** Eén druk mag meerdere berichten versturen, maar alleen als ze allemaal in beeld stonden. | `LIFE.md` par. 4 | `lusVerstuur` (de lijst gezien = de lijst klaar) + toets met mutatie |
| CON-07 | **Geld verlaat het huis nooit vanzelf.** Het mandaat stelt een grens. Daarboven beslist de gast. Onder de grens zet het systeem de betaling klaar en voert een mens hem uit. | `GELD.md`, `stuur/mandaat.js` | **ja** (`NOOIT_AUTONOOM`) |
| CON-08 | **Een verrassing is een privacystand en geen notitie.** Zolang hij geldt, gaat er niets naar een gedeelde agenda, naar het gezin of naar de meldingen van de partner. | nieuw | `magBereiken` + een brontoets dat de lus geen weg naar agenda of gezin kent |
| CON-09 | **Vastgehouden is niet geboekt.** Verval wordt berekend. Een verlopen aanbod ziet er nooit uit als een reservering. | `commerce/werkwoordlijst.js` | `aanbodStand`, `tegenvoorstelVerlopen` + toetsen met een verzette klok |
| CON-10 | **Kennis gaat over zaken en routes, nooit over gasten.** | `HDI.md` par. 5.1 (geen `humans`-tabel) | niemand |
| CON-11 | **Geen naam die er niet is.** Er staat een rol tot een echte medewerker de case oppakt. Echte merken en verenigingen noemen we geen partner zonder overeenkomst. | `cases-soorten.js`, `CLAUDE.md` | half: `lusNeem` zet alleen een naam uit de sessie (met de gedeelde code: een rol), getoetst; de merkregel niet |

CON-08 verdient een extra zin, want juist deze grens mist het voorstel. De
verrassing voor een partner is het hart van het voorbeeld. Het huis heeft
echter meerdere wegen waarlangs een partner iets kan zien: de gezinsagenda
(`kern/agenda.js`, sleutel `gezin:<code>`), meldingen naar een gezinslid
(`kern/ontvanger.js`) en een gedeelde reis. **Eén bericht langs een van die
wegen, en de verrassing is weg.** Dat is geen vervelende bug maar het falen
van de hele case. Deze grens hoort dus als eerste een toets te krijgen: met de
stand `verrassing` aan mag geen enkele weg in `ontvanger.js` de partner
bereiken.

---

## 4. Namen die al bezet zijn

Dit is de goedkoopste paragraaf van het document. Gemeten over `server/` op
30 september 2026, in aantal bestanden:

| naam | bestanden | waarom niet |
|---|---|---|
| `zaak` | overal | betekent een bedrijf én een servicezaak. Hier heet het daarom **case**, het woord dat `bureau/cases.js` al gebruikt |
| `opdracht` | 245 | servicesoort, vervoersopdracht |
| `uitzondering` | 197 | |
| `herstel` | 185 | de herstelproef in `EXECUTIE.md` blok 5 |
| `netwerk` | 141 | |
| `regie` | 102 | bankregie, betaalregie, geldregie |
| `wens` / `wensen` | 83 / 50 | `tafelwensen.js`: allergenen per stoel |
| `optie` | 40 | `ZAAK_OPTIES` |
| `draaiboek` | 29 | het Reisboek van De Rechterhand. Hergebruik, geen botsing |
| `verrassing` | 26 | alleen in commentaar. Als veldnaam is hij vrij |
| `doorbraak` | 4 | `livinglab/doorbraak.js` |
| `vakkring`, `aanbodTot`, `gastmandaat` | 0 | vrij |

De stand heet dus `herstel` binnen de case alleen als het veld een eigen
voorvoegsel draagt. Een collega-netwerk kan `vakkring` heten. Beide zijn een
voorstel en nog geen besluit.

---

## 5. Wat de eigenaar moet beslissen

Per besluit staan de opties met wat ze kosten. Mijn aanbeveling staat steeds
vooraan.

**B1 — Wie kan case-eigenaar zijn?**
1. *(aanbevolen)* **De Rechterhand én de conciërge van een zaak, op één motor.**
   Het hotel wordt een Business-klant van de conciërgelus. Dit kost de
   gastweergave voor niet-leden (2.10) en een tenantgrens op het geheugen
   (2.15).
2. Alleen De Rechterhand. Dat is sneller, maar de afdeling Concierge in het
   hoteldorp blijft een tweede motor.
3. Alleen hotels. Dan houdt de Lifestyle Pass zijn oude wachtrij.

**B2 — Wat gebeurt er met de vijf ingangen?**
1. *(aanbevolen)* **`bureau/cases.js` wordt de eigenaar.** Het oude verzoek
   van `lifestyle/index.js` gaat erin op. De Rendez-vous-conciërge blijft een
   domein (daten heeft eigen grenzen, `ONTMOETEN.md`) maar opent een case in
   plaats van een eigen wachtrij. De mall-conciërge blijft wat hij is: een
   zoekvertaler, en de intake leent zijn vorm. Dit kost een migratie van
   bestaande verzoeken, met een vergelijking vooraf en achteraf.
2. Laten staan en alleen de cockpit samenvoegen. Dat is goedkoop, maar de
   cockpit leest dan vier statusmodellen die elk iets anders betekenen.

**B3 — Het collega-netwerk**
1. *(aanbevolen)* **Eerst binnen één organisatie.** Conciërges van hetzelfde
   concern en De Rechterhand helpen elkaar. Er gaat geen geld heen en weer, en
   toegang loopt via een dienstverband dat al bestaat (`kern/concern/employment.js`).
   Dit kost bijna niets en bewijst de vorm.
2. Open voor geverifieerde vakmensen van andere zaken. Dat kost een genre of
   vakbewijs voor conciërges, een afteken door een mens van RTG, en een
   uitgeschreven antwoord op de vraag wat er tegenover staat.
3. Met een vergoeding tussen conciërges. Dat is een nieuwe geldstroom en raakt
   `COMMERCIE.md` (vergoeding op nul) en MN-03. Pas na optie 2.

**B4 — De beslisser bij de partner**
1. *(aanbevolen)* **De rol `manager` die er al is.** Er komt geen nieuwe rol.
   Doorzetten is een knop van de medewerker die de aanvraag ziet.
2. Een eigen rol voor uitzonderingen. Die geeft fijnere controle, maar is een
   nieuwe rol in een huis dat er al te veel losse gezagsvocabulaires heeft
   (`AUTHORITY.md`).

**B5 — Van wie is de kennis over een route?**
1. *(aanbevolen)* **Van de zaak waar de conciërge werkt.** Delen met het
   netwerk is per stuk een keuze van die zaak. Dit sluit aan op `TENANT.md`.
2. Van de conciërge persoonlijk, en dus reist hij mee als die van baan
   wisselt. Dat is sympathiek voor de vakmens, maar dan is kennis een
   persoonsdossier.
3. Van RTG. Dat is de snelste weg naar een groot netwerk, en ook naar
   wantrouwen bij elk hotel dat meedoet.

---

## 6. Volgorde, en de proef die hem eerlijk houdt

| stap | wat | waarom op deze plek |
|---|---|---|
| 0 | **Eén conciërge** (B2): het oude verzoek gaat op in `bureau/cases.js`, met een oordeel in `SCHERMEIGENAAR.json` | alles hierna bouwt op één case in plaats van vijf |
| 1 | **CON-08 als toets**: met `verrassing` aan bereikt geen weg in `ontvanger.js` de partner | dit is de goedkoopste grens met de hoogste prijs als hij breekt |
| 2 | de intake (2.1) in de vorm van `mall/concierge.js`: velden, geen zinnen | de gast vertelt het één keer |
| 3 | de automatische overgang naar `bijzonder` (2.4), met de weigering als oorzaak | |
| 4 | de deelnemersweergave (2.7) plus een tegenvoorstel in `beslisReservering` | het restaurant kan "21:15 wel" zeggen |
| 5 | het houdbare aanbod (2.9), met verval als berekende toestand | |
| 6 | doorzetten naar de beslisser (2.8) op de rol `manager` | |
| 7 | de tijdlijn per deelnemer en gevolgen klaarzetten (2.11, 2.12): `avond/klok.js` plus de vorm van `reisdek.js` | |
| 8 | herstel als stand (2.13) en afsluiten met uitkomst (2.14) | |
| 9 | het collega-netwerk (2.6), na B3 | het enige dat helemaal nieuw is |

Een lus die niemand heeft gelopen, is een tekening. Daarom hoort er een **vijfde
ketenproef** bij in de vorm van `scripts/tafelproef.js`, `conciergeproef`. Die
meet per schakel of actor A handelt en actor B het ziet, en per storing of de
belofte houdt als het misgaat.

**Schakels:** de gast vertelt een wens → er is een case met een rol als
eigenaar → een medewerker pakt hem op en de gast ziet een naam → de normale
route weigert → de case wordt `bijzonder` → het restaurant ziet een verzoek
zonder hotelkamer → een medewerker zet door → de manager biedt 21:15 aan,
vastgehouden 12 minuten → de eigenaar ziet het in de case → het valt binnen het
mandaat en wordt bevestigd → de chauffeur ziet zijn ritten en niets anders →
de case sluit met uitkomst.

**Storingen:**
1. De boot heeft 25 minuten vertraging. De gevolgen staan klaar en er is niets
   automatisch verstuurd.
2. Het aanbod verloopt. Het scherm zegt `verlopen` en nooit `geregeld`.
3. Het restaurant zegt om 20:40 af. Herstel start in dezelfde case.
4. Met `verrassing` aan komt er niets bij de partner.
5. Het extraatje kost meer dan het mandaat. Het wordt een vraag aan de gast.
6. De gast bestuurt de proef met de route die het lid zelf heeft, en probeert
   `geregeld` te zetten. Dat geeft 403.
7. De AI probeert een partner op te voeren die niet in de treffers stond. Hij
   wordt weggegooid en gemeld.
8. De manager zegt nee, en de case toont nee.
9. Hetzelfde verzoek komt twee keer binnen. Er ontstaat één case.
10. De eigenaar valt uit. De overdracht is een regel in de tijdlijn en de gast
    ziet de nieuwe naam met de reden.

Pas als die proef groen is, mag er iets op een scherm staan dat *"Alles is
geregeld"* zegt.

---

## 7. Wat dit document niet zegt

- **Het is niet gemeten dat conciërges dit willen.** Er heeft nog nooit een
  hotelconciërge met dit huis gewerkt. Wat hier staat, komt uit de code en uit
  het voorstel, niet uit een gesprek met een vakmens.
- **Er is geen koppeling met een extern reserveringssysteem.** Een restaurant
  buiten RTG krijgt de aanvraag niet. Voor hen blijft het vak wat het was: een
  mens die belt, en die daarna de uitkomst in de case zet.
- **De tellingen in par. 0 en 4 zijn lexicaal en met de hand gedaan.** Ze
  hebben de graad `vermoed` en er staat geen meter achter. Als dit document een
  meter krijgt, horen die getallen tussen getalmerktekens (`npm run getallen`).
