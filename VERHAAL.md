# VERHAAL.md — Magnaat als een leven, en de echte software als speelveld

> Dit is het diepte-document van de verhaallaag, naast `GELD.md` (het financieel
> besturingssysteem), `LEVEN.md` (het Life OS) en `CONCERN.md` (het Company
> Launch & Workforce OS). Lees `De grenzen` vóór je iets bouwt. Waar een functie
> met een grens botst, vervalt de functie.

## 0. Waar dit over gaat

De meeste tycoonspellen vertellen geen verhaal. Ze geven cijfers. Wie er
vijfhonderd uur in stopt, onthoudt een getal: *ik had €480 miljoen.* Dat is geen
herinnering, dat is een score.

Wat wél blijft hangen:

> *"Weet je nog dat ik als afwasser bij jou begon? En dat we jaren later samen
> een hotelketen hadden?"*

Het verschil tussen die twee zinnen is de hele opdracht van dit document. De
eerste gaat over een getal dat niemand deelt. De tweede gaat over **twee mensen
en een gedeeld verleden**, en dat verleden moet ergens staan.

En er zit een tweede opdracht in, die technisch zwaarder weegt: **in het spel
gebruik je de échte RTG-software.** Niet een nagebouwd personeelsscherm, maar
het personeelsscherm. Wie in Magnaat bedrijfsleider wordt, leert het echte
rooster, de echte loonstrook, het echte dossier kennen. Het spel is dan geen
etalage van het platform maar de oefenruimte ervan.

---

## De grenzen

Vier, en ze zijn geen van alle onderhandelbaar.

### 1. De carrièrelaag is 18+, en dat is geen detail

Alles wat een prestatie buiten het potje bewaart valt onder `progressieMag`
(`server/kern/spellen/grens.js`): highscores, ranglijsten, niveaus, prestaties.
**Een werkverleden is precies dat.** "Mike werkte drie jaar en twee maanden voor
jou" is een bewaarde prestatie tussen twee mensen, en dus geldt dezelfde poort:
geverifieerde paspoort-geboortedatum én 18 of ouder.

Dat is niet alleen de bestaande regel, het is ook de veilige. De hoofdstukken in
de visie beschrijven volwassenen die elkaar aannemen, opleiden, mentor zijn,
uitnodigen voor een bruiloft. Een laag waarin meerderjarigen minderjarigen
werven en aan zich binden, met een profiel dat de relatie vastlegt, is een
kinderveiligheidsoppervlak en geen spelmechaniek. Dat bouwen we niet.

**Onder de achttien blijft Magnaat volledig speelbaar.** Elke campagne, elk
scherm, elke sector. Er wordt alleen niets van bewaard, en dat is iets anders
dan een verbod. Dezelfde zin die De Arena tieners al belooft.

### 2. Een spelfeit is nooit een juridisch feit

`CONCERN.md` kent vier bronnen en elk juridisch gegeven draagt de zijne: `mens`,
`document`, `register`, `afgeleid`. Een spelbedrijf is geen van de vier.

De scheiding is daarom **structureel en geen vlag.** Een Magnaat-wereld krijgt
zijn eigen datavak, en de motoren draaien op dát vak — precies zoals
`server/kern/command/zandbak.js` het al doet: *"er schrijft niets terug, ook door
de bouw: de laag krijgt een DB-VENSTER op het vak van deze zandbak. Er is geen
aanroep die van binnen de zandbak bij een productiecollectie kan; niet omdat er
gefilterd wordt maar omdat het object dat hij ziet die collecties niet heeft."*

Een spelrestaurant komt dus nooit in iemands echte dossier, levert nooit een
echte loonrun op, en telt nooit mee in een echte UBO-keten. Niet omdat we dat
tegenhouden, maar omdat de collectie er niet is.

### 3. Een spelbaan is geen arbeidsovereenkomst, en geen pas

Twee kanten, en ze spiegelen een regel die `CONCERN.md` al draagt.

De ene kant: **een dienstverband in het spel schept geen verplichting buiten het
spel.** Geen loon, geen ontslagbescherming, geen uren die ergens meetellen. Wat
het wel schept is een *record dat jij bezit*: je hebt daar gewerkt.

De andere kant is de bestaande regel, letterlijk: **een werknemer koopt nooit een
pas om te mogen werken.** In het spel evenmin. Wie voor een andere speler wil
werken heeft geen RTG Pass nodig, geen abonnement, geen aankoop. Zou dat wel zo
zijn, dan is de mooiste zin uit de visie — *je begint als afwasser met €412* —
onmiddellijk een verkoopgesprek.

### 4. Weg zijn mag niets kosten

`CLAUDE.md` verbiedt verslavende engagement-patronen, en een leven van
vierenvijftig werkjaren is precies waar die sluipen: dagelijkse taken,
vervallende voortgang, een zaak die instort omdat je een week niet keek.

De motor heeft het antwoord al en het is een eigenschap en geen belofte: **de
klok rekent bij, hij tikt niet** (`GAMEHALL.md` §12.4). Tien maanden in één keer
geeft hetzelfde als tien maanden los. Voor de carrièrelaag betekent dat:

- een werkverleden krimpt nooit;
- afwezigheid verlaagt geen enkele stand;
- er bestaat geen reeks, geen dagbeloning en geen verlopende status.

Wie een half jaar wegblijft, komt terug bij precies wat hij achterliet. Dat is
niet vriendelijkheid, het is de enige stand die met de grens verenigbaar is.

---

## 1. De grondwet van blijvende waarde

Zodra iets tussen campagnes blijft bestaan, verandert de economische grondwet.
Vijf vragen moeten dan te beantwoorden zijn, en hier zijn de antwoorden.

### Waar komt blijvende waarde vandaan?

**Uit tijd en uit wat je deed, nooit uit geld.** Kas, bedrijven,
ondernemingswaarde, leningen en aandelen blijven in het potje en gaan er niet
uit. Wat het potje overleeft is het *feit*: je hebt daar gewerkt, je hebt dat
gebouwd, je hebt hem opgeleid.

Dat is de enige vorm van permanentie die geen scheve economie kan maken. Een
speler die vermogen meeneemt naar een volgende campagne begint rijker, en dan is
de eerste campagne een verplichte grinderonde. Een speler die een *verleden*
meeneemt begint precies even arm, en heeft alleen een geschiedenis.

### Wie bezit die?

**De persoon, op zijn codenaam.** Niet de werkgever.

Jouw carrière is van jou. Je oude werkgever houdt zijn eigen kant van hetzelfde
feit — *deze persoon werkte hier* — en niet jouw kant ervan. Dat is dezelfde
scheiding die `kern/concern/employment.js` al maakt, en het is de reden dat het
model overneembaar is in plaats van na te bouwen.

### Hoe verlaat die de wereld?

Een verleden wordt niet uitgegeven, dus het lekt niet weg zoals geld. Het gaat
er op twee manieren uit:

1. **Het eindigt.** Een dienstverband krijgt een einddatum en een reden. Het
   blijft leesbaar als geschiedenis; het telt niet meer als heden.
2. **Het verjaart.** Beëindigde records vallen onder de bestaande
   bewaartermijnen van het platform (`kern/bewaartermijnen.js`) en niet onder een
   eigen regel. Een spellaag met een eigen bewaarbeleid is een tweede
   bewaarbeleid, en die twee lopen uit elkaar.

### Wat gebeurt er bij maanden afwezigheid?

Niets. Zie grens 4. Dit is het enige antwoord dat met `CLAUDE.md` verenigbaar is.

### Wat gebeurt er als een speler stopt?

Drie dingen, en ze zijn alle drie asymmetrisch — met opzet.

- **Zijn eigen kant verdwijnt met hem.** Wie zijn account opheft, neemt zijn
  identiteit mee; de kluis (`accounts.js`) is de enige plek waar die staat.
- **De kant van de ander blijft, op codenaam.** Dat jij drie jaar voor iemand
  hebt gewerkt is ook *zijn* geschiedenis, en die mag niet verdwijnen omdat de
  ander vertrekt. Wat overblijft is een codenaam zonder mens erachter.
- **Lopende dienstverbanden eindigen met een reden**: *werkgever gestopt*. De
  jaren die je er werkte blijven van jou staan, want die zijn van jou.

---

## 2. Het scharnier: één speler werkt voor een andere

Alle dertien hoofdstukken hangen aan één relatie. De afwasser, de bedrijfsleider,
de lening, de melding *"Mike wil ondernemer worden, hij werkte 3 jaar 2 maanden
voor jou"*, de regel *eerste werkgever: Rahul* op een profiel, de leerling die
zijn eigen zaak opent — het is telkens dezelfde relatie, in een andere fase.

**Dat model bestaat al, en het staat niet in de spellenlaag.**
`server/kern/concern/employment.js` kent Employment als eigen begrip: een persoon,
een werkgevende entiteit, een vestiging, een rol, een venster, een reden. Op
codenaam. Met mandaat als aparte soort, zodat een adviseur geen werknemer wordt.

Dat is precies wat de visie nodig heeft, en het is geen toeval: het is dezelfde
werkelijkheid. Dus bouwen we het niet na. `PLATFORM.md` zegt het al — **een super
app vervangt geen domeinsoftware, ze orkestreert die.** Magnaat wordt een
*ingang* op het workforce-model, geen tweede exemplaar ervan.

---

## 3. De echte schermen, en de ene zin waar het op hangt

De opdracht is dat spelers de echte software leren gebruiken. Niet iets dat er
op lijkt.

De zandbak beschrijft zijn eigen tekortkoming precies:

> *"Alleen de motoren van Command draaien erop. De gewone app-routes praten met
> de echte database, dus je proeft hier processen en geen schermen."*

Dáár zit het gat, en het is één gat. De motoren zijn al bouwbaar op een ander
datavak — `kern/concern` wordt letterlijk samengesteld met `{ db, save, crypto,
... }` (`server/opzet/kernlaag4b.js`). Wat er niet is, is een routelaag die een
**wereldvak** kan meegeven in plaats van de productiedatabase.

Dat is de hele technische kern van deze visie:

> **Een Magnaat-wereld is een datavak. De echte motoren en de echte schermen
> draaien erop. Ze kunnen productie niet raken omdat ze de collecties niet
> hebben.**

Wat spelers dan zien is niet een spelversie van het personeelsscherm. Het ís het
personeelsscherm, met spelgegevens erin. Wie in Magnaat leert een rooster te
maken, een dienstverband te openen, een rol te scopen of een dossier te lezen,
kan dat daarna in het echt.

**Wat er níét bij hoort.** Geen tweede rechtenmodel (`CONCERN.md`, letterlijk:
toegang verlenen gebeurt waar de rol woont). Geen aparte spel-app naast de
bestaande schermen, want dat is `PLATFORM.md` §0. Geen spelknop in een
productiescherm; het onderscheid zit in het vak, niet in de knoppen.

---

## 4. Vreemden

De visie zegt het expliciet: bestaande RTG-connecties **of vreemden die bij je
komen**. Dat tweede is waar de laag sociaal wordt, en het is het stuk dat het
zorgvuldigst moet.

- **Solliciteren gaat op codenaam.** Je ziet een werkverleden en een rol, geen
  persoon. Wie elkaar wil kennen, doet dat via de bestaande contactregels van het
  platform en niet via een spelscherm dat er omheen loopt.
- **Werken is nooit een contactkanaal.** Een dienstverband geeft geen chat, geen
  adres, geen zichtbaarheid buiten de rol. `CONCERN.md`: toegang woont bij de rol.
- **Iedereen is meerderjarig**, want de hele laag is 18+ (grens 1). Dat is niet
  een filter op vreemden, het is de laag zelf.
- **Weigeren kost niets en verdwijnt.** Geen zichtbare afwijzingsgeschiedenis,
  geen reputatiestraf voor wie niet reageert. Een sollicitatiestapel die je
  achtervolgt is een verplichting, en verplichtingen vallen onder grens 4.

---

## 5. De momenten die het onthouden waard zijn

Een herinnering is geen logregel. Wat het terugkijkfilmpje uit hoofdstuk 13
werkend maakt, is dat er wéinig in staat en dat elk item **twee mensen** raakt.

| Moment | Waarom het blijft hangen |
|---|---|
| je eerste baan | er was iemand die je aannam |
| je eerste promotie | iemand vond je goed genoeg |
| je eerste eigen zaak | en wie je toen liet gaan, of financierde |
| een crisis die je samen overleefde | de storm uit hoofdstuk 5 |
| iemand die jij opleidde en die zelf begon | hoofdstuk 9, en het is de mooiste |
| iets dat de Foundation bouwde en er nog staat | hoofdstuk 11 |

Wat er met opzet **niet** in staat: omzet, vermogen, aantallen vestigingen,
records. Die staan al op de eindstand van een potje en horen daar. Een
herinnering die een getal is, is een score met een lijstje eromheen.

En één ontwerpregel die de hele laag draagt: **een moment ontstaat alleen als er
een tweede persoon bij was.** Dat maakt het onvervalsbaar (je kunt jezelf geen
verleden geven), het houdt de lijst kort, en het is precies waarom die zinnen
blijven hangen.

---

## 6. De volgorde

Elke stap is los waardevol en laat het systeem werkend achter. De volgorde is
niet vrij.

| # | Stap | Wat het oplevert | Grens die erbij hoort |
|---|---|---|---|
| 0 | **De grens als code** | 18+, codenaam, spelvak — op één plek, zoals `grens.js` dat voor progressie doet | alle vier |
| 1 | **Loondienst binnen één potje** | je kunt bij een andere speler werken, met een rol en een salaris uit zíjn kas. Niets blijft bewaard | geen permanentie, dus nog geen 18+-vraag |
| 2 | **Het werkverleden dat het potje overleeft** | de melding *"hij werkte 3 jaar 2 maanden voor jou"*, en de vier keuzes van hoofdstuk 3 | hier begint 18+ |
| 3 | **Het wereldvak onder de echte schermen** | spelers gebruiken het échte personeels-, rooster- en dossierscherm op spelgegevens | grens 2, structureel |
| 4 | **De momenten** | wat onthouden wordt, en alleen als er een tweede persoon bij was | grens 4 |
| 5 | **De terugblik** | hoofdstuk 13: geen cijfers, wel een geschiedenis | — |

Stap 1 is met opzet eerst en met opzet zonder permanentie. Hij is meteen
speelbaar, hij raakt geen enkele grens, en hij beantwoordt de vraag die je niet
op papier kunt beantwoorden: *is het leuk om voor een ander te werken?* Zo niet,
dan is stap 2 tot en met 5 een dure vergissing en zijn we er goedkoop achter.

---

## 7. Wat dit niet is

- **Geen tweede economie.** Een speler in loondienst verdient uit de kas van zijn
  werkgever. Salaris dat uit het niets komt is een geldpomp, en
  `scripts/magnaat-pomp.js` hoort die te vinden — dus krijgt loondienst daar een
  route.
- **Geen tweede identiteit.** Alles op codenaam, kluis apart. Wie in het spel
  jouw werkgever is, weet niet wie je bent tenzij je dat zelf deelt.
- **Geen vervanging van de campagne.** Magnaat blijft een spel dat je in een
  weekend kunt spelen. De verhaallaag hangt eróver, en wie hem niet wil, speelt
  gewoon een potje.
- **Geen levenssimulatie.** Bruiloften, kinderen en vakanties uit de
  hoofdstukken 6 tot 8 zijn `LEVEN.md`-gebied, niet dat van een tycoonspel. Waar
  ze elkaar raken, orkestreert Magnaat het Life OS en bouwt het niets na.
