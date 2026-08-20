# ONTMOETEN.md — Vonk en Rendez-vous

*Het diepte-document van de twee datingapps. `LIFE.md` beschrijft het leven
tússen mensen; dit document beschrijft het moment waarop twee mensen elkaar nog
niet kennen. Dat is een ander probleem met andere grenzen, en het verdient een
eigen document — maar par. 4 van `LIFE.md` blijft er onverkort boven staan.*

---

## 0. De kern in één zin

**Vonk zoekt de juiste mensen. Rendez-vous maakt de juiste ontmoeting.**

Dat is geen positionering maar een bouwvoorschrift: het zegt per functie in
welke app hij hoort, en — belangrijker — in welke niet.

| | **Vonk** | **Rendez-vous** |
|---|---|---|
| voor wie | elk lid met een pas | Lifestyle en Business |
| de poort | 18+ met geverifieerd paspoort | dezelfde, gedeeld |
| belofte | niet méér mensen, sneller de juiste | niet meer keuze, de weinige introducties die de moeite waard zijn |
| hoeveelheid | maximaal zes per dag | zeer weinig, soms nul |
| ontdekken | dagselectie op wensen | curatie op context, leven en timing |
| plaats | woonplaats en het midden ertussen | wereldwijde aanwezigheid |
| eerste ontmoeting | een tafel | een voorbereide ontmoeting |
| de AI | minimaal, uitlegbaar | Rahul als koppelaar |
| uitvoering | automatische tafelroute | De Rechterhand |
| succes | dates | hoogwaardige relaties en een kring |

De verleiding is om Rendez-vous "Vonk maar chiquer" te maken, of Vonk
"Rendez-vous voor iedereen". Allebei is fout. Ze verschillen niet in prijs of
in toon, maar in **wat het product is**: bij Vonk is dat de match, bij
Rendez-vous de ontmoeting.

**De toetsvraag bij elke nieuwe functie.** Maakt dit het vínden beter, of het
ontmóéten? Het eerste hoort in Vonk, het tweede in Rendez-vous. Een functie die
allebei doet, is twee functies die nog niet uit elkaar zijn gehaald.

En de regel die daaruit volgt: **er komt geen derde datingapp met hetzelfde
match-chat-date-model.** Dat is `PLATFORM.md` toegepast — de vraag is niet "kan
dit in een datingapp?" maar "is dit een zelfstandige capability, of een tweede
ingang naar dezelfde?". Een derde app moet een ánder sociaal probleem oplossen,
niet hetzelfde probleem voor een ander segment.

---

## 1. Wat er al ligt

Dit document schrijft niet op een leeg vel. Wat hieronder staat, draait.

**Vonk** (`server/kern/vonk/`: `index.js` het profiel, `selectie.js` wie wie
ziet, `assen.js` + `wensen.js` de voorkeurstaal, `match.js` de match; routes op
`/api/vonk/*`, scherm `public/apps/vonk.html`): profiel en wensen op codenaam,
een eindige dagselectie van maximaal zes wederzijds passende profielen,
wederzijdse like = match, en dan automatisch een tafel bij de partner het dichtst
bij het geografische midden van beide woonplaatsen (`tafelInHetMidden`). EUR 10 p.p.
vooraf via RTG Pay — EUR 5 voor RTG, EUR 5 als aanbetaling bij de zaak; de
reservering komt pas rond als beiden betaald hebben. Alleen de stad is
zichtbaar, chat pas na een match, blokkeren en melden met backoffice-opvolging.

**Rendez-vous** (`server/kern/rendezvous.js` met `-aanwezig.js` voor de
Presence Graph en `-date.js` voor Rahul de koppelaar; routes op
`/api/member/rendezvous/*`, scherm `public/apps/rendezvous.html`): een discreet
profiel met wensen en de locaties waar een lid openstaat voor een ontmoeting,
en waar het wanneer is; kandidaten gesorteerd op wie u binnenkort tegenkomt en
pas daarna op gedeelde locaties, wederzijdse like = match, en dan
stelt Rahul een date voor. Rahul belooft daar nooit een reservering — hij
schetst, en De Rechterhand legt vast zodra beiden akkoord zijn.

**De poort, sinds dit document** (`server/kern/ontmoetpoort.js`): 18+ met een
door RTG geverifieerd paspoort, één keer geschreven en door beide apps gebruikt.
Rendez-vous had die eis niet — daar stond alleen een pas-eis op de route,
waardoor de besloten app iedere minderjarige met een Lifestyle Pass toeliet
terwijl het brede Vonk 18+ en KYC eiste. Die fout kon alleen ontstaan doordat de
regel in een app woonde in plaats van naast de apps. Dit is dezelfde constructie
als `progressieMag` in `kern/spellen/grens.js`: **de grens staat op één plek, en
een nieuwe datingvorm hangt eraan in plaats van hem over te schrijven.**

**En wat er elders al ligt en hier hergebruikt wordt, niet nagebouwd:**

- de identiteitskluis (`server/accounts/kluis.js`) — AES-256-GCM op de
  VAULT-sleutel, met zoek-hashes en de codenaam-generator;
- het inzagejournaal (`server/inzagelog.js`) — wie keek, naar welk account,
  waarom, wanneer; een lege reden is daar een fout en geen detail, en zelf-inzage
  staat er bewust niet in;
- de contactpin (`server/kern/sociaal/pin.js`) — al gebouwd op precies de juiste
  redenering: *deze pin is een adres, geen geheim; hij bewijst niets, hij wijst
  alleen aan*;
- de relatieruimte (`server/kern/objectlaag/samen.js`) — een projectie over
  domeinen waar beide mensen deelnemer zijn, met opzet zonder eigen opslag;
- de caps `vonk` en `rendezvous` in `server/kern/objectlaag/caps.js`, zodat vanaf
  een persoon of een moment naar de juiste app gesprongen wordt;
- De Rechterhand (`server/kern/rechterhand/`, met `table.js`);
- `reserveerTafel` in `server/kern/ervaring/tafels.js`;
- de 114 talen (`/api/talen`, `public/shared/i18n.js`).

---

## 2. Rendez-vous — de ontmoeting is het product

> *Rendez-vous does not give you more people to choose from.
> It creates the few introductions worth making.*

De huidige app is een exclusieve matchmakingfunctie: een profiel, een
wederzijdse like, een voorstel. Dat is te weinig voor iemand die aan keuze geen
gebrek heeft. Wat zo iemand mist is niet aanbod maar **orkestratie**.

Rendez-vous moet daarom vijf dingen weten, en de match is er maar één van: wie
zou je moeten ontmoeten, wanneer is het juiste moment, in welke stad, in welke
context, en hoe maken we dat mogelijk zonder ruis.

### 2.1 De Presence Graph — plaats wordt tijd

Vandaag is locatie in Rendez-vous een filter: een lijst steden waar iemand
openstaat voor een ontmoeting, en de overlap ertussen. Dat is een verzameling.
Het moet een **agenda** worden:

```
home_city            waar iemand woont
regular_cities       waar iemand geregeld is
planned_presence     stad + venster, zelf opgegeven
open_to_introduction per stad of venster aan/uit
availability_window  wanneer, grofmazig
```

Daarmee ontstaat het enige signaal dat in dit segment werkelijk schaars is:
**twee mensen zijn tegelijk op dezelfde plek.**

```
PARIJS

Eén introductie is dit weekend bijzonder relevant.

U bent allebei in Parijs, 22–24 augustus.
U staat allebei open voor iets langdurigs.
Uw levensritme loopt opvallend gelijk.

                                      Introductie openen
```

Timing wordt zo onderdeel van compatibiliteit in plaats van een praktisch
probleem achteraf. Drie voorwaarden houden dat eerlijk, en ze staan in par. 4:
aanwezigheid is **zelf opgegeven** en wordt nooit stilzwijgend uit RTG Travel
gevuld; een venster is **grofmazig** (stad en dagen, nooit een adres of een
tijdstip); en een lid ziet altijd wat er van hem bekend is en kan het wissen.

### 2.2 Rahul denkt, de leden kiezen, De Rechterhand regelt

De bestaande regel in `kern/rendezvous.js` — Rahul schetst, De Rechterhand legt
vast zodra beiden akkoord zijn — is het sterkste wat de app al heeft. Hij wordt
niet opgerekt maar uitgebouwd tot een driedeling die overal geldt:

**Rahul mag:** voorselecteren, compatibiliteit uitleggen, timing herkennen, een
introductie voorstellen, een ontmoeting samenstellen, feedback verwerken, een
gesprek helpen beginnen.

**Rahul mag nooit:** namens iemand interesse tonen, een romantisch bericht
sturen, een reservering beloven, of een grens van een lid bijstellen.

Dat is het werkwoord van `LIFE.md` — **samenstellen en klaarzetten; bevestigen
doet de mens** — toegepast op de gevoeligste plek die er is. Alles wat een
tweede persoon bereikt, wordt nooit automatisch.

### 2.3 Het profiel verdwijnt bijna

Wie gewend is beoordeeld te worden, hoeft niet nóg een etalage. Het profiel
wordt daarom kleiner, niet groter:

```
Sofia · 32
Architect · Amsterdam / Kopenhagen

[één beeld]

In haar eigen woorden          18 seconden

Leven      internationaal · langdurig · wil kinderen
Nu         ontwerpt haar eerste hotel
Interesses architectuur · skiën · koken

Door RTG gecontroleerd   identiteit · leeftijd · beeld

Waarom Rahul u voorstelt
U wilt allebei een ambitieus leven zonder dat het werk
de rest ervan opeet.
```

Geen veertig badges, geen sterren, geen percentage. Dat laatste is hier geen
smaakkwestie: `LIFE.md` par. 4.4 verbiedt elke score op het leven tussen mensen,
en een compatibiliteitscijfer is precies dat.

### 2.4 De drie fasen

**1 · Overweging.** Rendez-vous zegt dat twee mensen elkaar zouden moeten
ontmoeten en toont beiden genoeg context om te kiezen. *Interesse* of *Voorbij*.
Niemand ziet wat de ander koos totdat het wederzijds is.

**2 · Introductie.** Pas bij wederzijdse interesse gaan beeld, stem, de rest van
het profiel en een privélijn open.

**3 · Ontmoeting.** In plaats van weken schrijven: *Zullen we elkaar
ontmoeten?* — beschikbaarheid vergelijken, en Rahul stelt drie settings voor die
niet alle drie een restaurant zijn (diner, een borrel, een tentoonstelling met
een glas erna). Beiden kiezen; dan pas gaat het naar De Rechterhand.

### 2.5 Private Availability en Arrange It

Beschikbaarheid wordt gedeeld zonder een agenda te delen. Een lid zegt
*donderdagavond* en *zaterdagmiddag*; de ander ziet daar **niets** van.
Rendez-vous mag maar één ding vaststellen: er bestaat overlap. Pas bij
wederzijdse interesse verschijnt bij allebei dezelfde zin: *donderdagavond komt
u beiden uit.*

En dan de knop waar de hele app op uitkomt:

```
ARRANGE IT
```

Meer hoeft een lid niet te doen. Rendez-vous kent beide steden, de
beschikbaarheid, de settingvoorkeur, de reistijd, wat er over eten is gedeeld en
hoeveel beslotenheid iemand wil. Rahul stelt samen; **beiden keuren goed**; De
Rechterhand regelt de reservering, de bevestiging, de agenda, de route en
eventueel vervoer. Niet: *hier is een match, succes ermee.*

Hier ontstaat het voordeel dat met losse API's niet na te bouwen is: RTG Horeca
levert de tafel, RTG Mobility het vervoer, RTG Travel de stad, RTG Geld de
betaling, RTG iD de identiteit, De Rechterhand de uitvoering. **Daten wordt een
native onderdeel van het ecosysteem in plaats van een app met koppelingen.**

### 2.6 The Table, en de ontmoeting zonder app

Niet elke ontmoeting hoeft een date te zijn. Twee vormen horen bij Rendez-vous
en uitdrukkelijk niet bij Vonk.

**The Table** — zes of acht geselecteerde leden aan één tafel. Geen
singles-event, geen gegarandeerde koppels, geen publieke koppeling: achter de
schermen mag Rendez-vous zorgen dat twee mogelijke introducties dezelfde
uitnodiging krijgen, maar niemand hoort dat ooit.

```
DINER 04 · Amsterdam · donderdag 20:00
architectuur · hospitality · creatieve industrie
8 leden                                    Uitnodiging
```

**Moment** — als twee leden allebei op hetzelfde evenement zijn: *u bent deze
week allebei op Basel; een ongedwongen kennismaking kan morgen op de
RTG-ontvangst.* Pas bij twee keer ja: *uw gastheer stelt u aan elkaar voor.*
Geen bericht, geen datingmechaniek — de fysieke wereld doet het werk.

**Encounter** — u heeft daar iemand ontmoet en wisselt geen nummers uit. Beiden
bevestigen ter plekke, en de volgende ochtend krijgt ieder afzonderlijk de
vraag: *wilt u aan Sofia worden voorgesteld?* Alleen bij twee keer ja gaat de
introductie open.

Encounter draait op de **contactpin** die er al is, en die daar precies goed
voor is: een adres dat niets bewijst, dat pas werkt als je het zelf afgeeft, en
waarmee niet te bladeren valt. Wat er ontstaat is een *tijdelijke* verbinding
die alleen Rendez-vous kent. Romantische interesse geeft dus **geen** toegang
tot iemands bredere sociale identiteit; dat is een aparte, latere stap die de
mens zelf zet.

### 2.7 Privaat lid, en waar dat woont

Voor leden die publiek zijn, geldt een zwaardere stand: geen vindbaarheid, geen
zoekresultaat, geen profielpagina die een screenshot waard is. Zichtbaar
uitsluitend na curatie en bij een concrete introductie.

En intern — dit is het deel dat er werkelijk toe doet — geen opvallend label in
de backoffice dat het personeel vertelt wie hier zit. **Dat bestaat al en wordt
niet opnieuw gebouwd:** de identiteit ligt versleuteld in
`server/accounts/kluis.js`, en elke blik erin gaat door `server/inzagelog.js`
met een verplichte reden, een spoor en bericht aan de betrokkene. Wat "Black
Vault" heet, is dus geen nieuw mechanisme maar het bestaande, consequent
toegepast.

Datzelfde geldt voor gevoelige matchcriteria. De engine hoort niet de waarde te
kennen maar het antwoord: *is harde eis X verenigbaar? ja / nee.* De
onderliggende voorkeur blijft waar hij hoort. **Er komt geen tweede kluis** —
`CONCERN.md` zegt het al voor rechten, en het geldt hier net zo goed: een derde
mechanisme voor hetzelfde doel is geen extra veiligheid maar een extra plek waar
het misgaat.

### 2.8 Niets tonen is een antwoord

```
Vandaag niets dat de moeite waard is.
```

Bij een gewone app is een lege pagina een ramp. Hier is het het bewijs dat de
kwaliteitseis boven de betrokkenheid gaat — en het is het enige wat schaarste
geloofwaardig maakt. Rendez-vous mag dus dagen stil zijn, en dat is geen storing.

Daarbij hoort een **introductiebudget**: twee tot drie open introducties
tegelijk. Wie er achtendertig heeft, behandelt niemand serieus. Is het vol, dan
wacht een nieuwe introductie zichtbaar maar zonder beeld en zonder naam — geen
verzameldrang, geen gemiste kans.

### 2.9 Elegant afsluiten en elegant pauzeren

Een introductie die stilvalt, krijgt een deur: *Timing klopt niet* — *Ik voel de
klik niet* — *Liever niet verder*. De reden gaat alleen mee als de gebruiker dat
wil; de ander leest enkel **deze introductie is gesloten.** Geen eindeloos
onzeker venster, geen *drie dagen geleden gezien*.

En wie even geen zin heeft, verbergt geen profiel maar zegt *niet beschikbaar
voor introducties* — tot volgende maand, na een reis, of onbepaald. Zonder enig
gevolg voor wat er daarna komt.

### 2.10 Together

Krijgen twee leden een relatie, dan bevestigen ze dat allebei. Introducties
stoppen; de kring blijft — The Table, de evenementen, de reizen, de concierge.

Dat is strategisch én ethisch de goede kant op: **een dienst die aan mislukte
relaties verdient, is een dienst met het verkeerde belang.** Together moet
bovendien op `objectlaag/samen.js` staan en niet op een eigen collectie: die
laag is met opzet een projectie zonder eigen opslag, zodat "van twee mensen en
niet van één" een eigenschap van de constructie is in plaats van een regel die
iemand moet handhaven.

---

## 3. Vonk — niet méér mensen, sneller de juiste

Vonk moet níét chic worden. Het moet de tegenovergestelde kracht krijgen:
voor iedereen, extreem makkelijk, eerlijk, veilig, en verrassend goed. De fout
zou zijn om te eindigen als een gewone swipe-app met zes profielen per dag.

### 3.1 De voorkeurstaal: verplicht, sterk, meegenomen

Het hart van Vonk is niet betere AI maar een **taal waarin iemand kan zeggen wat
er werkelijk toe doet.** Elke voorkeur krijgt een gewicht:

```
Wil kinderen          VERPLICHT
Geloof deelt          VERPLICHT
Binnen 40 km          STERKE VOORKEUR
Houdt van reizen      LEUK MEEGENOMEN
```

Dat is meer dan een filterpagina: het maakt het verschil tussen *ik wil dit* en
*ik wil dit écht* expliciet, en dat verschil is waar de meeste mismatches
vandaan komen. **Verplicht betekent: vóór de selectie eruit.** Wie stellig
kinderen wil en wie stellig niet, ziet elkaar niet — dat scheelt beiden weken.

### 3.2 Compatibiliteit langs assen, nooit als cijfer

Zes assen in plaats van één score: aantrekking, relatievorm, leven, waarden,
communicatie, praktisch. En de uitkomst is een zin, geen getal:

```
Waarom u Noor ziet
  ✓ allebei een serieuze relatie
  ✓ allebei kinderen gewenst
  ✓ geloof en hoe zwaar het weegt komen overeen
  ✓ 7 km
  △ Noor gaat graag uit, u minder

Niet gebruikt: politieke voorkeur · inkomen · populariteit
```

Die laatste regel is het vertrouwen waard. En het cijfer blijft weg omdat
`LIFE.md` par. 4.4 dat verbiedt — **een mens is geen kredietscore**, en dat geldt
ook intern: er komt in dit huis geen aantrekkelijkheidsscore, niet zichtbaar en
niet verborgen.

### 3.3 Gelijkgestemden, geaardheid en relatievorm horen in de kern

Vonk is voor iedereen, en dat moet in de datamodellen staan en niet in een
aparte hoek van de app.

**Geloof** krijgt twee velden en het tweede is het belangrijkste: *welk*, en
*hoe zwaar het weegt* (niet belangrijk / fijn / belangrijk / moet overeenkomen).
Twee mensen van hetzelfde geloof kunnen enorm verschillen in wat het in hun dag
betekent; zonder dat tweede veld matcht een app op een etiket.

**Ik ben** en **ik sta open voor** zijn verschillende velden. Vonk werkt vanaf
de kern voor hetero, homo, lesbisch, bi, pan, queer en het aseksuele spectrum,
en genderidentiteit staat los van wie iemand zoekt.

**Relatievorm** hoort bij de harde eisen: serieus, huwelijksgericht, casual,
ontdekkend, monogaam, open, poly.

Maar: **geen verplichte hoeken.** Niemand hoeft zichzelf in een deel-app te
plaatsen om gezien te worden — de engine houdt de irrelevante mensen weg. Een
optionele gemeenschapsingang (geloof en waarden, LGBTQ+, internationaal, ouders)
mag bestaan; verplicht worden mag hij nooit. En hoe zulke keuzes precies worden
verwoord, bepaalt Vonk niet alleen: dat hoort met de betrokken gemeenschappen,
niet met ontwikkelaars die denken te weten hoe iedereen datet.

Toon dit met **progressive disclosure**: eerst *wie wilt u ontmoeten*, daarna
alleen wat daar nog toe doet. Niet vijfenveertig keuzes op één scherm.

### 3.4 Privéwensen

Wie zegt *mijn partner moet mijn geloof delen*, hoeft dat niet op zijn profiel
te zetten. Twee gescheiden dingen dus:

- **profielgegevens** — wat anderen zien;
- **matchvoorwaarden** — wat alleen de engine gebruikt.

Zonder die scheiding veranderen profielen in sollicitatieformulieren. Datzelfde
geldt per veld voor zichtbaarheid: iedereen / alleen kandidaten / pas na een
match / alleen de engine.

### 3.5 Mijn Zes

De dagselectie wordt het herkenbare product, en de zes worden uitlegbaar:
twee sterke, twee nieuwe mogelijkheden, één op gedeelde waarden, één wildcard —
niet als vaste formule, wel zodat begrijpelijk is waarom de selectie varieert.

En als er niets is:

```
Vandaag geen nieuwe Vonk.
Niemand voldeed aan wat u het belangrijkst noemde.
```

Dat is beter dan rommel tonen. Ook een gratis app mag kwaliteit boven vulling
zetten.

### 3.6 Van match naar ontmoeting: het handtekeningstuk

Vonk heeft de tafel-in-het-midden al. Die wordt uitgebouwd tot waar de app om
bekend hoort te staan:

**Blind Availability.** Beiden vinken hun avonden; niemand ziet die van de
ander. Vonk zegt alleen: *u kunt allebei donderdagavond.* Dat vervangt het hele
"wanneer kan jij?"-heen-en-weer.

**Meet Halfway.** Drie plekken met gelijke reistijd, passend bij de voorkeuren
van beiden en open op het gekozen moment — koffie, een borrel, een wandeling.
Beiden kiezen blind; bij dezelfde keuze is het rond en wordt er geboekt.

**En de plek kent de context.** Twee mensen die geen alcohol drinken, krijgen
geen cocktailbar voorgesteld. De datefinder kent halal, geen alcohol, vegan,
kosher, rolstoeltoegankelijk, prikkelarm en het budget — en het budget staat
níét op een profiel maar alleen in de engine. *Gratis / € / €€ / maakt niet uit*,
zonder dat iemand zich hoeft te verantwoorden. Niet elke geslaagde eerste
ontmoeting kost honderdvijftig euro.

**Snel of langzaam.** Wie liever meteen afspreekt, zet dat aan; komen twee
zulke mensen bij elkaar, dan slaat Vonk de kennismakingsronde over. Wie eerst
wil praten, houdt zijn tempo. Niet iedereen door dezelfde trechter.

### 3.7 Eerlijkheid als bouwvoorschrift

Voor een app "voor iedereen" zijn dit geen productkeuzes maar constructie-eisen:

- **geen pay-to-rank.** Geld koopt nooit voorrang in iemands romantische
  selectie — geen boost, geen spotlight, geen superlike. Betaald mag zijn: reizen,
  extra privacy, geavanceerd voorkeursgereedschap, hulp bij het plannen. De
  matching zelf, de chat, de veiligheid en het basaal plannen blijven gratis.
- **populariteit is geen kwaliteitssignaal.** Geen verborgen ranglijst op
  aantrekkelijkheid, en nieuwe leden krijgen een redelijke kans.
- **een eindige capaciteit.** Maximaal vijf lopende gesprekken, voor iedereen,
  ook gratis. Wie er tachtig heeft, behandelt niemand goed. Zit het vol, dan
  wacht een kandidaat zonder beeld tot er plek is.
- **verse voorkeuren.** Elke paar maanden één tik: *klopt dit nog?* En: *bent u
  op dit moment open voor dates?* Zombieprofielen zijn het grootste
  kwaliteitsprobleem van elke datingapp.

### 3.8 Veiligheid en toegankelijkheid

De poort (18+, geverifieerd paspoort) is er al en is Vonks grootste voordeel
tegen katvangers — maar hij wordt menselijk gepresenteerd: *echte persoon ✓ ·
leeftijd gecontroleerd ✓*, niet *KYC niveau 3*. De echte naam blijft in de kluis.

Verder: **geen exacte afstand** (zelfde stad / dichtbij / 30–60 minuten reizen —
nooit "243 meter verderop"); een **Respect-stand** die niet censureert maar
vraagt (*dit is erg persoonlijk voor een eerste bericht — toch versturen?*); een
**veilige aankomst** die optioneel een vertrouwenspersoon laat weten dat het
begonnen en geëindigd is, zonder plaatsbepaling; en na afloop *alles goed?* met
melden en blokkeren — **maar nooit een beoordeling van de ander. Mensen zijn
geen taxichauffeurs.**

En toegankelijkheid hoort hier bij het product en niet bij de nazorg
(`TOEGANKELIJK.md`): een rolstoeltoegankelijke of prikkelarme plek kunnen kiezen
zonder je medische situatie op een profiel te zetten. De 114 talen betekenen:
een profiel in de eigen taal met het origineel erbij, en een zichtbaar gemarkeerde
vertaling van een bericht — maar de AI schrijft nooit iemands berichten.

### 3.9 Waar Vonk op stuurt

De maatstaf is niet swipes per minuut maar de keten: getoond → wederzijdse
interesse → gesprek → afspraak → **werkelijk ontmoet** → beiden zouden opnieuw
gaan. De software optimaliseert expliciet op echte ontmoetingen, en dat is de
enige meting waarbij het belang van het lid en dat van RTG dezelfde kant op
wijzen.

---

## 4. DE GRENZEN. Dit deel weegt zwaarder dan par. 2 en 3

Zoals in `LEVEN.md` en `LIFE.md`: **waar een functie botst met een grens,
vervalt de functie.** Par. 4 van `LIFE.md` geldt hier onverkort; wat hieronder
staat is wat er bovenop komt, plus drie botsingen die bij het schrijven van dit
document zijn opgelost.

### 4.1 De software port nooit aan tot een volgende stap

`LIFE.md` par. 4.1 zegt het al: een relatie is geen trechter, en een systeem dat
de volgende stap voorstelt is een regisseur van iemands leven geworden.

**Dit is de eerste botsing, en de grens wint.** Een chat die na wederzijdse
activiteit uit zichzelf vraagt *zullen jullie iets afspreken?* is precies zo'n
aansporing. De knop *Zullen we elkaar ontmoeten?* mag er altijd staan — dat is
openen — maar hij wordt niet aangeboden op grond van hoe het gesprek loopt.
Rendez-vous' fase 3 heet daarom een fase van de mens en niet van de app: hij
begint als iemand erop drukt.

Dezelfde grens: geen *u bent drie maanden samen*, geen aanmoediging om een
introductie nieuw leven in te blazen, geen herinnering dat iemand nog niet heeft
geantwoord.

### 4.2 Een introductie leunt nooit op een derde

**De tweede botsing.** "Eén gedeelde relatie kan de introductie onderschrijven"
is sterk, maar het gebruikt een derde persoon als bewijsstuk zonder dat die
erbij is — en `LIFE.md` par. 4.7 verbiedt schaduwprofielen en afgeleide sociale
kennis.

**De grens wint, de functie verschuift:** een gedeelde connectie mag alleen
genoemd worden als beide leden die connectie zélf zichtbaar hebben gemaakt en de
derde persoon zijn kring zichtbaar heeft staan. Anders bestaat het signaal niet.
Rendez-vous mag nooit zeggen wat het over iemands netwerk heeft afgeleid.

En breder, uit `LIFE.md` par. 4.3: wat Rahul over een lid weet, weet hij omdat
het gebeurd is en het lid het kan terugzien en wissen. Een voorkeur die uit
gedrag is afgeleid zonder bron is een gok die eruitziet als een feit.

### 4.3 Aanwezigheid is opgegeven, nooit afgeleid

**De derde botsing.** De Presence Graph is de gevoeligste gegevensverzameling in
dit hele document: waar iemand wanneer is. De verleiding is groot om hem te
vullen uit RTG Travel — de boekingen staan er immers al.

**Dat mag niet.** `LIFE.md` par. 4.6: toestemming reist niet mee. Wie in uw
Reis-object zit, ziet daarmee niet uw budget; en dat Rendez-vous bestaat, geeft
het geen toegang tot uw vluchten. Aanwezigheid komt uit wat het lid zelf
opgeeft. Wil een lid het koppelen, dan is dat een eigen `cap` met een eigen
vervaldatum, intrekbaar door elke kant, op `kern/levensband/` — en niet op een
nieuwe opslag ernaast.

Daarbij: een venster is grofmazig (stad en dagen), nooit een adres, nooit een
tijdstip, en nooit live. **Vonks bestaande regel — alleen de stad, nooit het
adres — geldt in Rendez-vous net zo goed**, en het feit dat de doelgroep rijker
is, maakt hem niet minder nodig maar meer.

### 4.4 Geen cijfer op een mens

Geen percentage, geen match-score, geen aantrekkelijkheidsoordeel — niet
zichtbaar, en ook niet intern als sorteersleutel. Compatibiliteit wordt
uitgedrukt in wat overeenkomt en wat botst, met de bron erbij. Dit is
`LIFE.md` par. 4.4, en het is hier absoluut.

### 4.5 De AI belooft niets en schrijft niets

Rahul stelt voor; de mens bevestigt; De Rechterhand voert uit. Geen automatische
uitnodiging, geen automatisch bericht, geen automatische boeking, geen
automatische betaling. En de merkregel uit `CLAUDE.md` geldt onverkort: nooit
echte hotel- of restaurantmerken als bevestigde partner opvoeren, en nooit
claimen dat een reservering rond is voordat hij dat is.

### 4.6 Wie afhaakt, hoeft zich niet te verantwoorden

Een introductie of een Vonk sluiten kan altijd, zonder reden, zonder gevolg. De
ander leest dat het gesloten is en niets meer. Er komt geen responsscore, geen
betrouwbaarheidscijfer, geen zichtbaar "reageert meestal binnen een dag".

### 4.7 De poort is één poort

18+ met een geverifieerd paspoort staat in `kern/ontmoetpoort.js` en nergens
anders. Een nieuwe datingvorm hangt daaraan. De pas-eis is iets anders — dat is
een productkeuze en die hoort op de route. Wie die twee door elkaar haalt, krijgt
opnieuw wat Rendez-vous overkwam: een app die exclusief lijkt en losser is.

### 4.8 Codenamen, ook hier

De apps draaien op codenamen; echte namen blijven in de kluis. Dating is precies
de plek waar iemand dat "even makkelijker" wil maken, en precies de plek waar dat
niet mag (`LIFE.md` par. 4.8).

---

## 5. Wat er bewust NIET komt

- **Geen derde datingapp** met hetzelfde match-chat-date-model. Een nieuwe app
  moet een ander sociaal probleem oplossen.
- **Geen tweede kluis en geen tweede inzageregeling.** De Black Vault ís
  `accounts/kluis.js` plus `inzagelog.js`.
- **Geen eigen opslag voor Together.** Dat staat op `objectlaag/samen.js`, dat
  met opzet een projectie is.
- **Geen oneindige stroom**, in geen van beide apps. Vonk is eindig per dag,
  Rendez-vous is eindig per introductie, en allebei mogen ze nul zeggen.
- **Geen engagement-mechaniek**: geen reeksen, geen dagelijkse beloning, geen
  kunstmatige urgentie, geen "nog 3 uur om te reageren" (`CLAUDE.md`).
- **Geen gemeten sociale toegang.** Rendez-vous verkoopt geen introducties per
  stuk; het budget bestaat om de kwaliteit te bewaken, niet om te worden
  bijgekocht.
- **Geen publieke profielpagina**, in geen van beide apps. Er is hier geen
  marketingsite en er komt hier ook geen deelbaar profiel.

---

## 6. Waar te beginnen

De volgorde is gekozen op wat het minst afhankelijk is van de rest, en wat het
eerst iets waard is voor een lid.

**Fase 0 — gedaan.** De ontmoetpoort gedeeld, en Rendez-vous erachter gezet
(`kern/ontmoetpoort.js`, `test/rendezvous.test.js`).

**Fase 1 — gedaan: de voorkeurstaal in Vonk** (`kern/vonk/assen.js` +
`kern/vonk/wensen.js`, met de selectie in `kern/vonk/selectie.js`). Zeven assen,
drie gewichten, en `kenmerken` (wie u bent, per as zelf zichtbaar te maken)
gescheiden van `wensen` (wat u van een ander vraagt, voor niemand zichtbaar).

Twee beslissingen die daar zijn genomen en die het gedrag bepalen:

- **Verplicht filtert op een uitgesproken tegenstelling, niet op een leeg veld.**
  Wie stellig kinderen wil en wie stellig niet, ziet elkaar niet; wie er niets
  over zei, blijft staan met een open punt bij de reden. Anders was de harde eis
  een verborgen strafregel voor nieuwe leden geworden — en dat botst met par. 3.7.
- **De uitleg lekt geen waarden.** Staat een as op "pas na een match", dan zegt
  de reden wel *dát* het overeenkomt maar niet *wat* het antwoord is. Zonder die
  regel was de zichtbaarheidskeuze een knop die niets doet.

En bij het bouwen kwam er een oude fout boven die niets met de voorkeurstaal te
maken had: `lib/geo.haversine` neemt twee punten en Vonk riep hem aan met vier
losse getallen. Hij gaf dus altijd `null` — waardoor de afstandsgrens nooit
filterde, de volgorde afstand negeerde, en **de tafel "rond het geografische
midden" gewoon de eerste zaak uit de lijst pakte**, omdat `null < Infinity` waar
is. Het midden werd berekend en meteen weggegooid. Hersteld, met de afstand tot
het midden in het antwoord zodat de belofte narekenbaar is.

**Fase 2 — gedaan: de Presence Graph in Rendez-vous**
(`kern/rendezvous-aanwezig.js`). Een thuisstad plus zelf opgegeven vensters
(stad, van, tot), en de overlap ertussen als eigen signaal — dat sorteert nu
vóór de gedeelde steden, en Rahul krijgt de dagen mee zodat zijn schets over een
echt weekend gaat in plaats van over "een keer".

Drie dingen zitten in de constructie en niet in een controle erop:

- **Het bestand krijgt geen reisbron binnen.** Het zijn zuivere functies over wat
  een lid intikte; een koppeling met RTG Travel zou er expliciet in geduwd moeten
  worden, en dat is precies de drempel die hij hoort te hebben (par. 4.3).
- **Er is geen veld waar een tijdstip in past.** `datum()` accepteert alleen
  JJJJ-MM-DD, het scherm gebruikt `type="date"`, en vensters die voorbij zijn
  vallen er bij het opslaan meteen af.
- **Het overlapbericht zegt nooit wie er woont.** Een thuisstad telt mee bij het
  rekenen, maar het antwoord luidt altijd "u bent er allebei". Zonder die regel
  kon iemand twaalf vensters in twaalf steden neerleggen en aflezen waar de
  anderen wonen; voor de ontmoeting maakt het niets uit wie er woont, voor de
  privacy alles.

Wat géén signaal is: twee mensen die in dezelfde stad *wonen*. Dat is geen timing
maar dezelfde stad, en dat kon de app al. Er hoort minstens één gedateerd venster
bij, anders zou elke stadgenoot elke dag bovenaan staan en betekent het woord
niets meer.

Daarna pas de introductie in drie fasen.

**Fase 3 — gedaan: beschikbaarheid zonder agenda** (`kern/beschikbaar.js`).
Eén bestand, twee namen: Blind Availability in Vonk, Private Availability in
Rendez-vous — net als de ontmoetpoort.

**Een ritme, geen kalender.** Eenentwintig hokjes: zeven dagen maal ochtend,
middag, avond. Geen datum, geen tijdstip, geen "volgende week". Wat u aankruist
zegt hoe uw week er meestal uitziet, niet waar u op 24 augustus bent — dat
laatste is aanwezigheid en woont in `rendezvous-aanwezig.js`.

**Er komt precies één ding uit, en pas na een wederzijdse match:** het eerste
dagdeel in de week dat u allebei aankruiste. *Donderdagavond komt u beiden uit.*
Niet de lijst, niet het aantal, niet "u heeft er drie gemeen".

Dat "één en niet allemaal" is de hele beveiliging. Zou de doorsnede compleet
teruggegeven worden, dan hoefde iemand alleen alle eenentwintig hokjes aan te
vinken om de volledige beschikbaarheid van de ander uit te lezen, en was de
belofte onwaar voor iedereen die de moeite nam.

**En wat het niet oplost, want dat hoort erbij.** Wie het echt op iemand gemunt
heeft, kan zijn eigen hokjes eenentwintig keer omzetten en zo alsnog het hele
ritme aflezen. Deze constructie is daar geen bewijs tegen; ze maakt het een
volgehouden handeling in plaats van een vinkje. Twee dingen dempen de schade: het
gaat om een ritme en niet om een agenda (u leert dat iemand meestal op
donderdagavond kan, niet waar hij dan is), en het kan alleen na een wederzijdse
match. Wie zich zo gedraagt hoort in de meldstroom thuis en niet in een slimmer
algoritme.

En er staat niets omheen: geen teller, geen "nog twee dagen", geen "plan nu".
De zin noemt het dagdeel en houdt op (par. 4.1).

**Fase 4 — de ontmoeting.** Meet Halfway met contextbewuste plekken in Vonk;
Arrange It met De Rechterhand in Rendez-vous.

**Fase 5 — de kring.** The Table, Moment en Encounter op de contactpin; en
Together op de objectlaag.

Elke fase eindigt met wat `LAT.md` vraagt: een toets die je hebt zien zakken.
