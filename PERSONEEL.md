# PERSONEEL.md — de werkervaring van RTG, van eigenaar tot kantine

*Richtingsdocument, 27 september 2026. Niet: hoe digitaliseren we personeel?
Wel: hoe bouwen we de beste werkervaring die iemand ooit bij een werkgever heeft
gehad — en laten we de techniek daaronder bijna verdwijnen?*

Per onderdeel staat er of het **staat**, **een stap weg** is, **een besluit
vraagt** of **jaren weg** is — zoals `PLATFORM.md`, `KANTOOR.md` en `HDI.md`.

**Lees dit met `KANTOOR.md` en `KANTOORMACHT.md` ernaast, en verwar ze niet.**
KANTOORMACHT.md gaat over de MACHT aan de knop, KANTOOR.md over de MENS aan de
knop en de infrastructuur onder hem (dienstverband, identiteit, bevoegdheid,
intrekking). Dit document gaat over wat die mens ERVAART. De infrastructuur
blijft onder water bestaan en wordt hier niet opnieuw ontworpen; dit document
zegt waarvoor ze er is.

## 0. De maatstaf

> RTG behandelt iedere medewerker alsof zijn werkdag speciaal voor hem is
> voorbereid. Niet alleen de eigenaar. Ook degene die de kantine draait.

"Experience the Elite Class" betekent hier niet dat elitefuncties luxe worden
behandeld. Het bijzondere is juist:

> **De kantinemedewerker krijgt dezelfde kwaliteit ervaring als de eigenaar.
> Alleen zijn wereld is anders.**

Dat is geen leus maar een toetsbare eis: de ochtend van de kantinemedewerker en
die van de eigenaar worden met **dezelfde onderdelen** gebouwd (dezelfde kaart,
dezelfde bediening, dezelfde zorg voor aandacht), en alleen de INHOUD verschilt.
Een onderdeel dat alleen op het scherm van de eigenaar bestaat, is een gebrek —
tenzij het over macht gaat die alleen de eigenaar heeft.

Het verschil met een HR-systeem zit vóórdat iemand zelf iets hoeft te doen:
**complexiteit wordt door RTG gedragen, niet door de medewerker.**

## 1. Twee lussen, en de infrastructuur eronder

**De belevingslus** — wat de medewerker ervaart, in tien werkwoorden:

```
VERWACHTEN → VOORBEREIDEN → VERWELKOMEN → BEGELEIDEN → BESCHERMEN
  → MOGELIJK MAKEN → ERKENNEN → LATEN GROEIEN → LOSLATEN → LEREN
```

In gewone woorden: *RTG kent mijn werk → RTG heeft mijn dag voorbereid → RTG
geeft me ruimte → RTG helpt als er iets misgaat → RTG bewaakt eerlijkheid → RTG
waardeert wat ik bijdraag → RTG helpt me verder.*

**De systeemlus** — wat er continu draait:

```
SIGNALEREN → BEGRIJPEN → VOORBEREIDEN → AANBIEDEN → MENS BESLIST
  → UITVOEREN → BEWIJZEN → LEREN
```

**`MENS BESLIST` is het scharnier van het hele document.** Autonomie betekent
niet dat software stiekem baas wordt. Het is hetzelfde werkwoord als in de rest
van dit huis (LIFE.md, FOUNDATION.md, GELD.md): *samenstellen en klaarzetten —
bevestigen doet de mens.*

**De infrastructuur** — onder water, uit KANTOOR.md:

```
employment → identiteit → bevoegdheid → verantwoordelijkheid → intrekking
```

Per stap van de systeemlus, waar hij vandaag woont:

| Stap | Woont al in | Stand |
|---|---|---|
| signaleren | `kern/envelop.js` (elk bericht draagt `correlatie` + `oorzaak`) | **staat** |
| begrijpen | `weerklank` — de naam is gereserveerd in KANTOOR.md par. 6, het bestand bestaat nog niet | **een stap weg** |
| voorbereiden | `kern/commercie/voornemen.js` (een plan dat niet meer kan veranderen) | **staat**, niet op personeel |
| aanbieden | Fluister voor de vloer (par. 6) | **staat** als gesprek, niet als aanbod |
| mens beslist | `kern/kantoor/tweedehandtekening.js`, de boardroom | **staat** voor geld |
| uitvoeren | de eigen route van het domein, nooit een zijweg | **staat** |
| bewijzen | `kern/carriereledger/` voor de mens, het inzagejournaal voor het huis | **staat** |
| leren | de registers en hun ratels | **staat** voor code, niet voor werk |

## 2. Eerst de meting: de ervaring bestaat al half — voor de verkeerde mensen

De belangrijkste vondst van dit document, en hij stuurt de volgorde.

**Het personeel van een ZAAK heeft al een groot deel van deze ervaring.**
`public/apps/personeel.html` (Team Room: *vandaag · team · profiel*) op
`/api/staff/*`, met onder meer:

| Onderdeel | Waar | Wat het al goed doet |
|---|---|---|
| in- en uitklokken, pauze | `routes/staff/dienst-klok.js` | aanwezigheid bij het hek als FEIT, zonder volgen (PLAATS.md) |
| verlof, ziekmelden, inzetbaarheid | `routes/staff/dienst.js`, `kern/payroll/verzuim.js` | een ziekmelding heeft **geen reden-veld** — "een veld dat er is wordt gevuld" |
| verzuim voor de planning | `/api/supplier/verzuim/planning` | de leidinggevende ziet "afwezig" en wat iemand nog kan, nooit wat hij heeft |
| een persoonlijke assistent | `routes/staff/dienst-fluister.js` — **Fluister voor de vloer** | eigen geheugen per medewerker, **nooit gedeeld met de werkgever**, en de naam gaat niet naar het model |
| de vertrouwenspersoon | `/api/staff/trust/*` | een lijn die de werkgever niet ziet |
| een eerlijke verdeling | `kern/beveiliging/rooster/aanvragen.js` | sorteert op de minste uren: op wat iemand TOEKOMT, niet op wat hij waard is |
| rust over middernacht | `kern/beveiliging/rooster/rust.js` | te weinig rust is een waarschuwing, geen verbod (ARBEID.md par. 4) |
| dienstverband | `kern/concern/employment.js`, `kern/concern/aanname.js` | aan de entiteit, op codenaam |
| loon | `kern/payroll/` | de loonrun leest het dienstverband |
| loopbaanbewijs | `kern/carriereledger/` | er komt alleen iets bij; intrekken wist niets |

**RTG's eigen kantoor heeft hier niets van.** Een RTG-medewerker komt binnen
via de rol `office` (KANTOOR.md, `kern/kantoor/`), en die laag kent kamers,
taken en een kantinemenu (`/api/office/kamers`, `kantine/menu` in
`public/apps/kantoren.html`) — maar geen rooster, geen klok, geen verlof, geen
Fluister, geen vertrouwenspersoon en geen dienstverband: `kern/kantoor/` leest
`concern/employment.js` nergens.

Dus: **RTG staat buiten zijn eigen WorkOS.** De kantinemedewerker van een klant
heeft een betere werkervaring dan de kantinemedewerker van RTG zelf.

Daaruit volgt de eerste regel van dit document, en hij maakt het goedkoper in
plaats van duurder:

> **Er komt geen tweede personeelservaring voor RTG. RTG wordt de eerste klant
> van zijn eigen WorkOS.**

Een eigen "RTG-personeelsportaal" naast de Team Room zou de fout zijn die
`SCHERMEIGENAAR.json` tegenhoudt: twee schermen op dezelfde capability. De
kantoorkamers blijven waar de MACHT woont; het WERKLEVEN van een RTG-medewerker
woont waar dat van iedere andere werknemer woont.

Stand: **besloten** (B1, 27 september 2026: ja, helemaal) -- de eerste stap staat, zie par. 12.

## 3. Namen die al bezet zijn — lees dit vóór je begint

| Voorgesteld | Stand | Uitweg |
|---|---|---|
| **Staff Concierge** | **bezet** — `concierge` staat in 80 bestanden: de menselijke concierge van de Lifestyle Pass (SERVICE.md), `kern/mall/concierge.js`, De Rechterhand | niet nodig: **Fluister voor de vloer IS de staff concierge** en staat al (par. 5) |
| **RTG Passport** | **bezet** — `paspoort` staat in 209 bestanden en is het identiteitsdocument (de 18+-poort, `volwassen()`) | het ding bestaat al als `kern/carriereledger/`; de SCHERMnaam is **Mijn loopbaan** (B3, besloten) |
| **Mijn RTG** | **bezet** — `MIJNRTG.md` is de persoonlijke vertrouwenslaag (identiteit, data, rechten, apparaten, bewijs) | niet gebruiken als kop van het loopbaanbewijs |
| **erkenning** | 40 bestanden, meerdere betekenissen | eerst meten vóór het een veldnaam wordt; in dit document is het een soort regel in het ledger |
| **stilte** | 94 bestanden | "gezonde stilte" is een begrip uit KANTOOR.md par. 7, geen nieuwe module |

## 4. De ochtend van Amir

Een kantinemedewerker begint morgen om 08:00. Een standaard systeem toont zijn
rooster. RTG heeft vóór 08:00 al nagedacht. Om 07:53 komt hij binnen:

```
Goedemorgen, Amir.
Alles staat voor je klaar.

Kantine · 08:00–16:30
Team compleet
Eerste levering 08:20
Lunch: 73 aangemeld

[ Begin mijn dag ]
```

Niet *Dashboard → HR → Mijn rooster → Taken.* Eén kaart, één knop.

**De kaart staat** (28 september 2026): `kern/ochtendkaart.js`, route
`/api/staff/ochtend`, bovenaan het scherm Vandaag van de personeelsapp. Hij
bezit niets en schrijft niets, en hij STELT NIETS VOOR (B4). De knop is de
bestaande inklokknop; wie vrij of afwezig is krijgt er geen. De kop noemt de
OORZAAK en niet elke regel die eraan lijdt: *"Het rooster van vandaag is nog niet
vastgesteld: dit is het standaardpatroon."* is één ding en geen twee. Het bouwen
vond ook iets dat eerder niemand zag: het rooster dat de Team Room toont
(`scheduleFor`) las verzuim NIET, dus een zieke collega stond daar vandaag
gewoon op zijn dienst. Een parallelle ronde repareerde dat op dezelfde dag
(`kern/payroll/inplanbaar.js`, samengekomen in main): het rooster zet wie
afwezig is op vrij met alleen DAT hij afwezig is -- het hele team ziet dat
rooster, dus geen soort; die ziet de leidinggevende in
`/api/supplier/verzuim/planning`. De kaart leest dezelfde regel en telt zo'n
collega als AFWEZIG en niet als vrij, anders zou hij verdwijnen in plaats van
ontbreken.

Per regel: waar hij vandaan komt, wat hij mag zeggen, en wat hij NOOIT mag
zeggen.

| Regel | Bron | Stand | Grens |
|---|---|---|---|
| **Goedemorgen, Amir** | het eigen account: zelf-inzage is vrij | **staat** | de echte naam wordt op het toestel getoond en gaat nooit mee naar een model (`dienst-fluister.js` noemt de medewerker al niet bij naam) |
| **Alles staat voor je klaar** | de optelsom van de regels eronder | **staat** (28 sep 2026) | mag er alleen staan als ELKE regel eronder gemeten is; anders: *"Eén ding kon ik niet nakijken: …"* — `niet vast te stellen` is een eersteklas uitslag (BESTUUR.md) |
| **Kantine · 08:00–16:30** | het rooster van de zaak | **staat** voor zaken | — |
| **Team compleet** | rooster × verzuim | **staat** (28 sep 2026) | "compleet" alleen als de verzuimlaag antwoordde; anders zegt de kop dat het niet na te kijken was. Een afwezige collega is een AANTAL op jouw kaart, nooit een naam of een reden. Een rooster uit het standaardpatroon maakt het een vermoeden |
| **Eerste levering 08:20** | de groothandelsorders van de zaak | **staat, zonder tijd** (28 sep 2026) | alleen BEVESTIGDE leveringen (`bevestigd`, `onderweg`), en de kaart zegt hoeveel en NIET hoe laat: een order draagt geen aflevertijd, dus "08:20" zou verzonnen zijn. Een aflevertijd is een stap weg in de groothandelslaag |
| **Lunch: 73 aangemeld** | reserveringen, geteld | **staat** (28 sep 2026) voor het tellen | een GETELD getal mag. Een VOORSPELD getal pas als de trefzekerheid over drie afgesloten perioden is gemeten, en dan met bandbreedte (INT-04, `kern/kosten/vooruitblik.js`). "73 personen" zonder die meting is een verzonnen zekerheid |
| **Begin mijn dag** | inklokken (`/api/staff/clock`) | **staat** | — |

Wat er daarnaast vóór 08:00 moet zijn gebeurd, en waarom je het NIET ziet:

- **Zijn toegang staat alleen voor de juiste ruimtes klaar.** Dat vraagt
  toegang per kamer op het dienstverband — vandaag is de kantoorrol één sleutel
  voor 26 kamers (KANTOORMACHT.md). **Een stap weg.**
- **Openstaande overdrachten staan klaar.** Dat vraagt de
  verantwoordelijkheidsgraaf als projectie (KANTOOR.md par. 5). **Vraagt een
  besluit.**
- **Zijn pauze past bij de bezetting.** De pauzeregel staat
  (`werkbeleidPauzeStand`); de pauze PLANNEN op de bezetting niet. **Een stap
  weg.**
- **Als een collega ziek is, is de impact al doorgerekend.** De planners slaan
  hem sinds 27 september 2026 over en zeggen welke plek daardoor open bleef; de
  doorrekening naar de kaart is nog een stap weg. En de doorrekening gaat over de BEZETTING en nooit over de
  zieke: wie ziek is, verschijnt als "afwezig" en niets meer.

## 5. Het uur van de eigenaar: status ≠ aandacht

Voor de eigenaar gebeurt precies hetzelfde. Geen managementdashboard met 43
KPI's:

```
Goedemorgen, Rahul.

126 mensen werken vandaag.
119 werkdagen vragen geen aandacht.
5 afwijkingen zijn door het team opgelost.
2 besluiten kan alleen jij nemen.

[ Mijn twee besluiten ]
```

Het principe: **status ≠ aandacht.** Je hoeft niet alles te zien omdat je
eigenaar bent. Het systeem beschermt ook jouw aandacht — dezelfde "gezonde
stilte" als KANTOOR.md par. 7, nu voor de mens met de meeste macht.

Drie correcties op de eerste versie van deze kaart, alle drie uit een besluit dat
dit huis al heeft genomen:

1. **"RTG draait normaal" mag er niet zo staan.** SERVICE.md par. 8 en
   BESTUUR.md: een scherm zegt nooit "alles werkt", want beschikbaarheid wordt
   niet overal gemeten. Wat wel mag: *"Geen afwijkingen gemeld"* — met één tik
   eronder welke bronnen keken en welke niet. Een cockpit die niet kan zakken, is
   een dashboard.
2. **"Zelfstandig opgelost" is vandaag niet waar.** Een machine lost pas
   zelfstandig iets op binnen een mandaat (`kern/stuur/mandaat.js`, nul
   productie-aanroepers) en op bewezen routes (`VERTROUWEN.json`, nul bewezen).
   Eerlijk is: *"door het team opgelost"*, of *"klaargezet en door X
   bevestigd"*. Autonome oplossing is **jaren weg** en wordt gepromoveerd, nooit
   geslopen (FABRIC.md).
3. **Stilte is volgorde, geen weglating.** ADAPTIEF.md: *verbergen bestaat
   niet.* De 119 rustige werkdagen staan één tik verder, niet nergens. Zou de
   eigenaar ze niet kunnen openen, dan concludeert hij dat ze er niet zijn.

"Mijn twee besluiten" is de wachtrij van `voornemen.js` en de tweede
handtekening: wat alleen deze mens kan tekenen. **Staat** voor geld, **een stap
weg** als kaart.

De spiegel van dezelfde regel: de kantinemedewerker krijgt óók een kaart met
"niets vraagt je aandacht" als dat zo is. Stilte is geen privilege van de baas.

## 6. Fluister voor de vloer als concierge

Niet een chatbot die overal tussen springt, maar een onzichtbare concierge die
uitsluitend de toegestane werkcontext kent. Die bestaat al — hij heet **Fluister
voor de vloer** en heeft de belangrijkste eigenschap al: *zijn geheugen is van de
medewerker en wordt nooit met de werkgever gedeeld.* Wat ontbreekt is dat hij iets
AANBIEDT in plaats van alleen antwoordt.

**Voorbeeld 1 — de dienst loopt uit.**

```
Je dienst loopt uit.
Je hebt vandaag 8 uur en 20 minuten gewerkt.
De laatste taak kan morgenochtend worden afgerond.

[ Naar morgen verplaatsen ]  [ Toch afronden ]
```

- De uren komen van de klok: registratie van arbeidstijd is een werkOBJECT en
  geen werkGEDRAG (KANTOOR.md par. 11.3). **Staat.**
- *"zonder operationeel risico"* mag er alleen staan als het gevolg is gemeten
  (`kern/stuur/gevolg.js`). Is het `onbekend`, dan zegt de kaart dat: *"ik weet
  niet of dit morgen kan"*. **Een stap weg.**
- "Toch afronden" is een volwaardige keuze en geen tweede plaats. De software
  port niet aan (ONTMOETEN.md par. 4: de knop mag, de aansporing niet).

**Voorbeeld 2 — vrij vragen.**

```
Je hebt drie drukke diensten achter elkaar gehad.
Woensdag is de bezetting ruim genoeg.
Als je vrij wilt zijn, wordt dat meteen goedgekeurd.

[ Vrij vragen ]
```

Dit is het idee dat personeel gewoon ja moet kunnen krijgen zonder te weten dat
er een eerlijke verdelingsmachine achter zit. Drie grenzen:

- **Geen "waarschijnlijk".** Een regel keurt het goed of een mens beslist; een
  kans die niemand heeft gemeten, staat er niet. De regel is die van
  `rooster/aanvragen.js`: eerst wie het minst heeft gehad, op wat iemand
  TOEKOMT.
- **"Druk" is een eigenschap van de DIENST en nooit van de mens.** Gemeten aan
  bezetting of omzet van die dienst, niet aan hoe hard iemand werkte.
- **`gemoed` blijft van de medewerker.** `/api/staff/gemoed` bestaat; een aanbod
  leunt daar nooit op, want dan leest de werkgever via de achterdeur hoe iemand
  zich voelt.

Stand: **een stap weg** — de verdeling staat voor beveiliging en moet worden
losgemaakt van dat ene domein. Fluister biedt **alleen op vraag** aan (B4,
besloten): wie niets vraagt, krijgt niets.

## 7. Regelen vóórdat iemand erom vraagt

De grootste sprong: een medewerker hoeft niet te weten welke afdeling iets doet.

**Nieuwe apparatuur bij een nieuwe functie.**

```
Voor je nieuwe functie heb je andere apparatuur nodig.
We hebben het klaargezet voor dinsdag.

[ Ophalen ]  [ Laten bezorgen ]
```

De aanleiding staat (een wijziging in het dienstverband); het aankomstplan van
KANTOOR.md par. 4 luistert er nog niet naar. Apparaten hebben nog geen register:
`actor.device` is het enige actor-veld dat vanaf nul begint. **Jaren weg** voor de
apparatuur, **een stap weg** voor de rest van het plan.

**Een verjaardag.**

```
Donderdag ben je jarig. Je bent vrij. 🎂
```

Mooi, en het botst op drie plekken — alle drie op te lossen:

1. **Een verjaardag vrij is een arbeidsvoorwaarde, geen functie.** De werkgever
   heeft besloten (B2): bij RTG is hij een RECHT, voor iedereen van kantine tot
   eigenaar. De software legt het recht niet op; zij zet het klaar.
2. **De geboortedatum staat er voor iets anders.** De payroll kent hem voor het
   jeugdloon. Hem gebruiken voor iets anders is een nieuw doel, en dus een keuze
   van de medewerker: niet iedereen wil dat zijn verjaardag in het werk
   verschijnt. **Standaard uit, zelf aanzetten.**
3. **"Je dienst is al opgevangen" bereikt een tweede mens.** Een collega die
   diens dienst overneemt, heeft daar zelf ja op gezegd. RTG zet de ruil klaar,
   de collega bevestigt, en pas daarna krijgt Amir te horen dat het geregeld is.
   Tot die tijd: *"We zoeken iemand voor je dienst."*

**Een promotie.** Dan verandert niet alleen een functienaam: RTG bereidt de
overgang voor — verantwoordelijkheden, opleiding, ruimtes, bevoegdheden,
overdracht, materiaal. Eén grens uit KANTOOR.md onverkort: **bevoegdheden worden
nooit gekopieerd omdat iemand een titel heeft.** Het plan zet klaar; een mens
geeft vrij. **Een stap weg** zodra par. 12 blok 1 staat.

## 8. Het loopbaanbewijs — van de mens, niet van HR

Iedere medewerker krijgt een professioneel bewijs dat in de eerste plaats van de
mens is. Niet een personeelsdossier.

```
Kantine → Senior Hospitality → Teamlead
3 jaar bij RTG
18 vaardigheden bevestigd
6 opleidingen voltooid
4 projecten geholpen
2 keer bedankt door een collega

Mogelijke volgende stappen: Hospitality Lead · Inkoop · Opleider
```

Niet: `performance score: 7,4`. **Er komt geen geheime mensscore** — niet
zichtbaar, niet intern, niet als sorteersleutel (KANTOOR.md par. 15, CARRIERE.md
CAR-05). RTG onthoudt aantoonbare prestaties, vaardigheden en bijdragen; geen
algoritmisch oordeel over iemands waarde.

Dit hoeft niet gebouwd te worden: het is een LEZING van `kern/carriereledger/`,
met de vaardigheden uit Métier (`kern/metier/`, de bron volgens ARBEID.md par.
7a). Vier regels die daar al gelden, en die dit scherm erft:

- **Elke regel heeft een graad, en die volgt uit wie hem schrijft.** Wat de
  medewerker zelf zegt is `vermoed`; wat een ander bevestigt is sterker. Dus
  "vaardigheden **bevestigd**" en niet "bewezen", tenzij het ledger dat zegt.
- **Overgangen, geen volumes.** Erkenning is een regel die EENMAAL ontstaat;
  twintig keer bedankt worden voor hetzelfde levert geen twintig regels
  (CONNECT.md). Geen ranglijst, geen "medewerker van de maand".
- **Altijd meer dan één volgende stap**, en nooit *"dit is niets voor jou"*
  (FOUNDATION.md par. 5, HDI.md). Een enkele "volgende stap" is een ladder, en
  een ladder zegt waar iemand STAAT.
- **Het gaat mee.** Het ledger is per regel te delen zonder het dossier te
  openen (`carriereledger/deel.js`); een volledige uitvoer om mee te nemen is
  **een stap weg**. De uitstaptoets van CARRIERE.md: *lock-in door
  kwaliteit mag, lock-in door gijzeling zakt.*

Stand: het ledger **staat**; deze kaart is **een stap weg**; de schermnaam is
**Mijn loopbaan** (B3, besloten).

## 9. Een waardige uitgang

Wanneer iemand RTG verlaat, is dat ook premium.

```
Dank voor 4 jaar en 7 maanden.

1.028 werkdagen
7 teams geholpen
3 functies vervuld
21 vaardigheden opgebouwd

Je loopbaanbewijs staat klaar.
Je laatste salaris is gecontroleerd.
Je open declaratie is goedgekeurd en wordt dinsdag betaald.
Je werktoegang sluit vanavond.
Je overdracht is voltooid.
```

Geen account dat ineens op ACCESS DENIED springt.

| Regel | Bron | Stand |
|---|---|---|
| werkdagen, teams, functies | klok, dienstverband, ledger — geteld | **een stap weg** |
| loopbaanbewijs klaar | `kern/carriereledger/` (delen per regel via `deel.js`) | **staat**; een volledige uitvoer een stap weg |
| laatste salaris gecontroleerd | `kern/payroll/` (loonrun leest het dienstverband) | **staat** voor zaken |
| declaratie wordt betaald | de geldketen (`kern/kantoor/geldketen/`) | **staat**; "wordt betaald" alleen als een mens het heeft goedgekeurd — geld wordt klaargezet, een mens voert uit |
| toegang sluit | `kern/kantoor/intrekking.js` | **staat**; de aanleiding (einde dienstverband) niet |
| overdracht voltooid | de verantwoordelijkheidsgraaf | **vraagt een besluit** |

Twee grenzen:

- **Werktoegang sluit, het account blijft.** Rechten hangen per capability en
  nooit per account (AFSPRAAK.md): na vertrek is iemand gewoon weer een mens met
  een RTG-account, met zijn loonstroken, zijn jaaropgave en zijn loopbaanbewijs.
  Uitdiensttreding is geen straf.
- **Het bewijs blijft.** Het contract- en auditbewijs verdwijnt niet mee, en de
  bewaartermijnen blijven waar ze wonen.

## 10. De grenzen

Waar een functie botst met een grens, vervalt de functie.

1. **Gelijke kwaliteit, andere wereld.** De kaart van de kantine en die van de
   eigenaar zijn hetzelfde onderdeel. Een onderdeel dat alleen de eigenaar
   krijgt, moet over macht gaan die alleen hij heeft.
2. **Status ≠ aandacht, en stilte is volgorde.** Niemand ziet meer omdat hij
   hoger staat; iedereen ziet eerst wat alleen hij kan doen. Niets wordt
   verborgen.
3. **Voorbereiden is klaarzetten; de mens beslist.** Alles wat een tweede
   persoon bereikt (een ruil, een bericht, een goedkeuring, geld) wordt nooit
   automatisch.
4. **Werkobjecten, geen werkgedrag.** RTG leest dat een taak af is, niet hoe
   lang iemand in een scherm zat. `gemoed`, Fluister en de vertrouwenspersoon
   zijn van de medewerker.
5. **Geen score op een mens.** Niet op het loopbaanbewijs, niet in de
   verdeling, niet als sorteersleutel. Eerlijk verdelen gaat op wat iemand
   toekomt.
6. **Geen zekerheid die niet gemeten is.** Geen "waarschijnlijk", geen "alles in
   orde", geen voorspeld getal zonder gemeten trefzekerheid. `niet vast te
   stellen` mag er gewoon staan.
7. **Het bewijs is van de mens en gaat mee.**
8. **Een werknemer koopt nooit een pas om te mogen werken** (CONCERN.md).
9. **De naam blijft op het toestel.** Een echte naam in een begroeting is
   zelf-inzage; in een prompt of een rapport over anderen is het de codenaam.

## 11. Wat er bewust niet komt

- Geen tweede personeelsportaal naast de Team Room (par. 2).
- Geen "medewerker van de maand", geen ranglijst, geen prestatiecijfer.
- Geen gedragslogboek, geen schermtijd, geen productiviteitsmeter.
- Geen chatbot die ongevraagd tussen het werk springt; een aanbod is een kaart
  die weg mag.
- Geen voorspelde getallen op een kaart vóór de trefzekerheid gemeten is.
- Geen automatische ruil van diensten, ook niet "voor je verjaardag".

## 12. De volgorde, en de besluiten

| Blok | Wat | Stand |
|---|---|---|
| **0** | RTG wordt werkgever in zijn eigen Concern, en RTG's eigen werk (ook de kantine) draait op de WorkOS-personeelslaag | **half**: besloten (B1), de huisentiteit en het werkverband in de toegangsreview staan in de schaduw; de entiteit zelf richt de eigenaar in |
| **1** | dienstverband ↔ kantoorrol; einde dienstverband roept `intrekking.js` aan | een stap weg |
| **2** | toegang per kamer op het dienstverband — de kantine krijgt alleen de kantine | een stap weg |
| **3** | de ochtendkaart (par. 4) op gegevens die al bestaan; het rooster leest verzuim | **staat**: het rooster leest verzuim (27 sep 2026), waarschuwt een mens die met de hand plant, en de kaart staat (28 sep); het Team Room-rooster leest verzuim nog niet |
| **4** | de aandachtskaart van de eigenaar (par. 5): besluitenwachtrij plus stilte met bewijsgraad | een stap weg |
| **5** | het loopbaanbewijs als lezing van het ledger (par. 8) | een stap weg |
| **6** | de waardige uitgang (par. 9), behalve de overdracht | een stap weg |
| **7** | Fluister biedt aan (par. 6), met de verdeling los van beveiliging | een stap weg; alleen op vraag (B4) |
| **8** | overdracht via de verantwoordelijkheidsgraaf | vraagt een besluit (KANTOOR.md par. 5) |
| **9** | vooraf regelen: apparatuur en verjaardag (par. 7) | apparatuur jaren weg; verjaardag staat (B2, `VRIJHEID.md`) |

Blok 0 gaat voor alles, en is goedkoper dan het lijkt: het meeste van deze
ervaring hoeft niet gebouwd te worden, alleen te worden OPENGEZET voor RTG zelf.

**De besluiten van de eigenaar:**

- **B1 — Wordt RTG de eerste klant van zijn eigen WorkOS? BESLOTEN (27 september
  2026): ja, helemaal.** RTG's werkleven woont op de WorkOS-personeelslaag; de
  kantoorkamers blijven voor de macht. De eerste stap staat, en hij houdt nog
  niemand tegen (`kern/kantoor/huis.js`, `test/kantoorhuis.test.js`):
  - **de huisentiteit**: de eigenaar wijst in de boardroom aan welke entiteit in
    RTG Concern RTG IS (`/api/office/beleidsmotor/huis/zet`, alleen de eigenaar
    zelf). Tot dan is het antwoord `onbekend` en nooit "niemand in dienst".
  - **het werkverband in de toegangsreview**: per kantoorhouder `loopt`, `geen`
    of `onbekend`, UITGEREKEND uit de dienstverbanden en niet opgeslagen -- een
    dienstverband eindigt op een datum, dus een opgeslagen "in dienst" zou de
    dag erna liegen. Een mandaat telt niet als dienstverband en staat er apart
    bij. De review blijft schaduw: de deuren besluiten precies hetzelfde.

  Wat nog volgt, in deze volgorde:
  1. de eigenaar richt RTG in als entiteit (en zaak) in RTG Concern en wijst hem
     aan -- dat is een handeling van een mens, geen code;
  2. de medewerkers krijgen een dienstverband bij die entiteit; de review laat
     zien wie er nog `geen` heeft;
  3. pas als `geen` op nul staat of elk geval een reden heeft, **vraagt het een
     besluit** om de kantoordeur het werkverband te laten EISEN (KANTOORMACHT.md:
     schaduw, dan waarschuwen, dan afdwingen); de intrekking van lopende sessies
     staat al klaar (`kern/kantoor/intrekking.js`);
  4. RTG's eigen werk (ook de kantine) op de Team Room.
- **B2 — Is een verjaardag vrij een arbeidsvoorwaarde bij RTG? BESLOTEN (28
  september 2026): ja, als RECHT** -- voor iedereen, van kantine tot eigenaar,
  want status is geen aandacht. Twee dingen blijven gelden: het staat standaard
  UIT en de medewerker zet het zelf aan (de geboortedatum staat er voor het
  jeugdloon, en een nieuw doel is zijn keuze), en een ruil van zijn dienst
  bereikt een tweede mens, dus die collega bevestigt zelf. Gebouwd in een
  parallelle ronde als verjaardagvrijheid in RTG Vrijheid (`VRIJHEID.md`,
  `server/kern/vrijheid/`): de medewerker geeft zelf alleen `MM-DD` op, en de
  geboortedatum uit het lidprofiel gaat niet naar de werkgever (MN-02).
- **B3 — Hoe heet het loopbaanbewijs op het scherm? BESLOTEN (28 september
  2026): Mijn loopbaan.** Het blijft een lezing van `kern/carriereledger/`
  zonder score; "Paspoort" en "Mijn RTG" blijven voor hun eigen betekenis.
- **B4 — Mag Fluister ongevraagd iets aanbieden? BESLOTEN (28 september 2026):
  nee, alleen op vraag.** Fluister zegt niets uit zichzelf; de ochtendkaart is
  daarom geen aanbod maar een weergave van wat er al staat (rooster, verzuim,
  verlof), en een voorstel verschijnt pas als de medewerker erom vraagt.

## 13. Wat dit document niet zegt

Het zegt niet hoeveel medewerkers RTG heeft; KANTOORMACHT.md par. 29 laat dat
bewust open. Bij drie mensen is "een tweede paar ogen" soms dezelfde mens morgen,
en dan helpt geen hoeveelheid ervaring.

Het is ook nog nooit door een medewerker gelopen. Wat hier staat is gelezen in de
code, niet gemeten bij een mens. De eerste echte toets is Amir die om 07:53
binnenkomt en niets hoeft te zoeken.
