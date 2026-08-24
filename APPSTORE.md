# De RTG App Store — het derdenkanaal

Dit bestand hoort bij `PLATFORM.md` zoals `GELD.md` en `TENANT.md` dat doen: daar
staat waar het huis heen gaat, hier staat hoe er iets van BUITEN binnenkomt.
`LAT.md` zegt hoe er geschreven wordt, `CLAUDE.md` wat het merk is.

---

## Het principe

> **Een App Store is geen etalage maar een poort met een cel erachter.**

De etalage is het makkelijke deel en het minst belangrijke. Wie een App Store
bouwt door een lijst met tegels te maken, heeft het probleem niet opgelost maar
verplaatst: de vraag is niet hoe een app van een derde ZICHTBAAR wordt, maar wat
hij mag zodra een lid hem opent.

Drie woorden uit de opdracht — veilig, snel, efficiënt — zijn hier geen
eigenschappen die je er later bij bouwt. Ze komen uit dezelfde keuze:

| | komt uit |
|---|---|
| **veilig** | derdencode draait in een naamloze cel zonder netwerk, en wat eruit komt is bij elke lezing tegen zijn hash gehouden |
| **snel** | de hash staat in het pad, dus de bundel is onveranderlijk en voorgoed te bewaren; een tweede opening is nul verzoeken |
| **efficiënt** | de poort zegt bij afkeuring per bestand en per REGEL wat er is en hoe het wel kan, en er is een proefkeuring die niets bewaart |

---

## Zes begrippen, en er komt er geen zevende bij

Dezelfde discipline als in `TENANT.md`: wie de begrippen niet uit elkaar houdt,
kan later niet meer zeggen wie waarvoor verantwoordelijk is.

| begrip | wat het is | waar het woont |
|---|---|---|
| **uitgever** | een `org` die mag inzenden. Door een MENS van RTG toegelaten, en intrekbaar. | `kern/appstore/index.js` |
| **app** | de identiteit: sleutel, naam, uitgever. Bestaat los van code. | `kern/appstore/index.js` |
| **versie** | een onveranderlijke bundel met een hash. Alleen VERSIES worden gepubliceerd. | `kern/appstore/versies.js` |
| **manifest** | wat de app zegt te zijn en wat hij VRAAGT. | `kern/appstore/manifest.js` |
| **keuring** | de poort: machine (vorm) en daarna mens (inhoud). | `kern/appstore/keuring.js` + `besluit.js` |
| **machtiging** | wat een lid werkelijk VERLEENT. Nooit wat het manifest vroeg. | `kern/appstore/machtigingen.js` + `brug.js` |

**De uitgever is een `org` en geen nieuw begrip.** `TENANT.md` legt vast dat `org`
de juridische, beveiligings- en contractgrens IS, en dat er geen vijfde
identiteitsmodel bij komt. Een aparte "ontwikkelaarsaccount" zou precies dat
zijn. Een zaak die nog niet onder een organisatie hangt, wordt daarom geen
uitgever — met de weg erbij, niet met een stille weigering.

**"De app" is nooit iets anders dan een versie.** Publiceren is een hash
aanwijzen; intrekken is hem loslaten. Er is geen toestand waarin een app leeft
zonder dat aanwijsbaar is welke bytes er draaien.

---

## De zes grenzen

Ze staan ook in de kop van `server/kern/appstore/index.js`, want daar worden ze
afgedwongen. Elke grens heeft een toets die zakt als hij sneuvelt.

### 1. Derdencode draait nooit op de RTG-herkomst

Er is geen vlag, geen vertrouwde uitgever en geen uitzondering die dit verandert.
Vier sloten, en ze houden alle vier iets ANDERS tegen:

1. **De iframe met `sandbox="allow-scripts"`** en niets erbij. Zonder de vlag die
   dezelfde herkomst teruggeeft, krijgt dat document een NAAMLOZE herkomst: geen
   cookies, geen `localStorage` van RTG, geen document van de ouder, geen sessie.
   Dat is geen afscherming van ons maar een oordeel van de browser.
2. **De CSP-kop van de celroute**, met `sandbox allow-scripts` er OOK in. Dat
   tweede slot dekt de weg die het eerste niet dekt: wie de cel-URL in een
   tabblad plakt, zit alsnog in een naamloze herkomst.
3. **`connect-src 'none'`.** De app heeft geen netwerk. Niet "alleen naar ons" —
   geen. De enige weg naar RTG is de brug, en die loopt via het lid.
4. **De integriteitscontrole** bij elke lezing van schijf.

Waarom de celroute geen inlog vraagt: een gepubliceerde bundel is publieke
inhoud, en er staat per definitie niets persoonlijks in — persoonlijke gegevens
komen alleen over de brug, en die zit wel achter een inlog. Een inlog daar zou
de browser verbieden de bundel te bewaren, en dan is de snelheidsbelofte weg.

### 2. De machinepoort keurt nooit goed

`kern/appstore/keuring.js` kan afkeuren of doorlaten NAAR EEN MENS. Meer niet.
Een machine ziet vorm; of een app doet wat hij belooft, of de uitgever is wie hij
zegt, ziet hij niet. Dezelfde regel als de bewijspoort in `CLAUDE.md`: een
ingediend stuk is geen bewijs, een mens van RTG tekent af, en **nooit de partij
die het stuk indiende** — `besluit()` weigert een handtekening van de eigen org,
en een besluit zonder naam wordt niet aangenomen.

Wat de machine wel ziet:

| | wat het tegenhoudt |
|---|---|
| **bestandssoorten** | alleen wat een browser als inhoud leest; geen archief, geen uitvoerbaar bestand, geen wasm |
| **budget** | 60 bestanden, 2 MB totaal, 300 kB scriptcode, 150 kB stijl — een poort, geen meter achteraf |
| **verboden vormen** | `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `importScripts`, `serviceWorker`, `eval`, `new Function`, `document.write`, `parent`/`top`, dynamische `import()`, `document.cookie`, een venster in een venster, `srcdoc`, `<base>`, meta refresh, `@import`, script in een SVG |
| **externe verwijzing** | alles wat een app nodig heeft zit in zijn bundel; wat van buiten komt kan na de keuring veranderen |
| **de virusscan** | dezelfde scanner als de rest van het huis (`kern/antivirus`) |

Een verboden vorm zou in de cel toch al stilvallen — `connect-src 'none'` laat
`fetch` niet door. Hij wordt hier afgekeurd MET het regelnummer, omdat een
aanroep die stil faalt een app is die het bij een lid niet doet en niemand die
weet waarom.

**Ontbreekt de virusscanner, dan gaat de poort DICHT.** Niet open. Dezelfde keuze
als de persoonspoort in `opzet/leverancierpoort.js`: een controle die er niet is,
is geen stilzwijgend "ja".

De scanner heeft één filter, en dat staat bij naam in `kern/appstore/scan.js`.
`kern/antivirus` is gebouwd voor wat een lid UPLOADT; daar is "`<script` in dit
bestand" een polyglot-aanval en ".js" een gevaarlijke extensie. In een app-bundel
IS `<script` de inhoud en `.js` het product. Ongefilterd zegt de scanner dus
"besmet" over élke correcte inzending — en een controle die altijd afgaat is even
waardeloos als een die nooit afgaat (LAT-regel 9). Twee bevindingen worden voor
de tekstsoorten bij naam overgeslagen; alle andere handtekeningen, de dubbele
extensies en de afgepelde gzip-/base64-lagen blijven staan, en voor de BINAIRE
soorten draait de scanner volledig ongewijzigd.

### 3. Een app ziet codenamen, nooit een naam

Ook mét de machtiging `profiel.basis` komt er geen echte naam, e-mailadres,
telefoonnummer, adres of geboortedatum uit de brug. Die staan in de
identiteitskluis (`accounts.js`), en `kern/appstore/brug.js` heeft daar geen
verwijzing naartoe — niet omdat het niet mag, maar zodat het niet KAN. Wie het er
alsnog bij zou zetten, moet er een `require` voor schrijven, en dat is een regel
die opvalt in een diff.

### 4. Een machtiging die niet is verleend, bestaat niet

Het manifest VRAAGT; het lid VERLEENT. Twee woorden, twee opslagplekken, en de
brug leest alleen de tweede. Een app die drie machtigingen vroeg en er één kreeg,
werkt met één. Een lid kan een machtiging intrekken zonder de app te verwijderen,
en de app merkt dat bij de volgende aanroep.

Er zijn er **drie**, en alle drie worden ze uitgevoerd:

| machtiging | geeft | nooit |
|---|---|---|
| `profiel.basis` | codenaam, taal, pas | naam, e-mail, telefoon, adres, geboortedatum |
| `opslag.eigen` | een kladblok per app per lid (32 sleutels, 64 kB) | inzage in een andere app of in de rest van je gegevens |
| `bericht.klaarzetten` | hooguit vijf berichten per dag in het eigen bakje | push, e-mail, sms, of iets dat onderbreekt |

Wat een app **niet** kan vragen staat met de reden in
`machtigingen.NIET_GEBOUWD` — betalen, agenda, bestanden, locatie, contacten,
push — en die reden krijgt de uitgever te lezen wanneer hij het toch probeert.
Dat is geen wensenlijst en geen routekaart: een regel daar verdwijnt pas als de
brug hem uitvoert. Een machtiging die wel te vragen is en nergens iets doet,
zou LAT-regel 6 in zijn duurste vorm zijn — een lid verleent dan iets wat niet
bestaat. `test/appstore.test.js` zakt daarop.

### 5. Intrekken werkt onmiddellijk en overal

RTG kan het en de uitgever kan het zelf; wie een fout in zijn eigen app ziet,
hoort niet op een kantoor te hoeven wachten. Een ingetrokken versie valt op
hetzelfde moment weg uit de winkel, bij de leden die hem al hadden, én uit de
cel — omdat alle drie dezelfde vraag stellen (staat deze hash live?) en er dus
geen tweede plek is die kan achterlopen. Een geschorste uitgever verliest zijn
etalage in dezelfde handeling.

Wat een lid in een app heeft opgeslagen blijft staan: dat is zijn inhoud en niet
die van de app. Komt er een nieuwe versie, dan is het er weer; wie het echt weg
wil, gooit het weg als eigen handeling.

Een door een mens GEWEIGERDE versie laat geen bytes achter: publiceren vraagt de
stand `wacht-op-mens` en de celroute vraagt de LIVE hash, dus die bundel heeft
geen enkele lezer meer. Wat het bewijs draagt blijft wel staan — de hash, de
bevindingen, de reden en de naam van wie tekende — want anders is een weigering
achteraf niet na te trekken en is de hele keuring een gebaar. Een INGETROKKEN
versie blijft wel liggen: die heeft gedraaid, en "wat draaide er vorige week"
hoort beantwoordbaar te blijven.

### 6. Wat er niet is, staat er met een reden

Dezelfde regel als in `TENANT.md`: een leeg veld leest als "nog niet opgehaald",
een genoemd veld met een reden leest als een besluit.

---

## Waar het staat

```
server/kern/appstore/
  index.js        de motor: staat, journaal, uitgevers, en de drie lagen aan elkaar
  versies.js      inzenden en de proefkeuring
  besluit.js      de wachtrij, het besluit van een mens, de noodrem
  winkel.js       wat een LID ziet, kiest en verleent
  brug.js         de uitvoering van de machtigingen — de enige weg naar RTG
  manifest.js     wat een uitgever invult, streng gelezen
  keuring.js      de machinepoort
  verboden.js     de lijsten van die poort, met per regel de uitleg
  scan.js         de virusscanner op een webbundel, met het filter bij naam
  bundel.js       de onveranderlijke bundel: pad, hash, schijf, integriteit
  machtigingen.js de drie machtigingen, en wat er niet is met de reden

server/routes/appstore/
  uitgever.js     supplierAuth — een derde zendt in
  kantoor.js      officeAuth   — een mens van RTG tekent af
  lid.js          auth         — een lid bladert, verleent, opent, en de brug
  cel.js          geen inlog   — de gekeurde bundel zelf, in een naamloze cel

public/apps/
  appcel.html              de RTG-kant van een app van derden
  appstore-uitgever.html   het uitgeversbureau (kies je map, proefkeuring, inzenden)
  mall.html                de afdeling "App Store" naast de App-Bibliotheek

test/appstore.test.js      de zes grenzen over de lijn
test/appstore-cel.test.js  wat je aan de bron zelf kunt zien
```

**Waarom een eigen afdeling in de Mall en geen rij in de App-Bibliotheek.** De
Bibliotheek is van RTG: elke tegel opent een pagina die wij hebben gebouwd. Dit
is van iemand anders, en dat hoort een lid te zien vóórdat hij iets verleent —
niet erna in een detailscherm. Installeren betekent er ook iets anders: bij de
Bibliotheek zet je een app op je startscherm, hier geef je iets weg.

**Waarom dit geen nieuwe wereld is.** `PLATFORM.md` zegt acht apps, niet
drieëntachtig. De App Store is geen negende wereld maar een afdeling in de Mall,
plus een cel die alleen bestaat zolang er een app in draait. `appcel.html` is
geen tegel: je komt er alleen via een app die je zelf hebt geïnstalleerd.

---

## De open beslissing: geld

Alles in de App Store is nu **voor leden inbegrepen bij de pas**, precies zoals
de bestaande App-Bibliotheek (`kern/appbieb.js`, ledenprijs 0). Er staat geen
prijsveld op nul te wachten, want dat zou lezen als een werkend mechanisme.

Wat er te beslissen valt, en wat elke keuze kost:

| | wat het betekent |
|---|---|
| **inbegrepen bij de pas** (nu) | een derde publiceert om erbij te horen, niet om te verdienen. Geen inning, geen uitbetaling, geen fiscale keten. Trekt vooral partners die al iets met RTG hebben. |
| **betaald via RTG Pay, met afdracht** | vraagt een bevestiging door het lid (LIFE.md: klaarzetten mag, bevestigen doet de mens), een uitbetaalstroom naar de uitgever, btw per land en een omzetdelingspercentage. Dat is een geldketen en geen veld. |
| **gratis, met een vergoeding van RTG** | RTG betaalt de uitgever per gebruik of per periode. Geen betaalstroom naar leden, wel een budget en een meting die niet te manipuleren is. |

Zolang die keuze niet is gemaakt, blijft `betalen` staan in
`machtigingen.NIET_GEBOUWD` met de reden erbij.

---

## Wat er bewust NIET is

- **Geen sterren, geen ranglijst, geen "populair".** `CLAUDE.md` verbiedt
  verslavende engagement-patronen, en de progressielaag stopt bij 18+. Een winkel
  waarin apps elkaar verdringen is precies zo'n mechaniek. Wat er wel staat: wat
  een app doet, van wie hij is, wat hij vraagt en wanneer hij is gekeurd.
- **Geen automatische publicatie.** Ook niet voor een uitgever die al tien keer
  door de poort kwam. Dat zou grens 2 tot een gewoonte maken in plaats van een
  regel.
- **Geen externe hosting.** Een app wijst niet naar de server van zijn maker.
  Dat zou betekenen dat de inhoud na de keuring kan veranderen, en dan keurt de
  poort niets.
- **Geen tweede rechtenmodel.** De machtigingen staan náást de bestaande poorten
  en vervangen er geen. Een app van derden krijgt nooit meer dan het lid zelf.

---

## Wat een uitgever moet weten (de korte versie)

1. Je zaak hangt onder een organisatie; die organisatie wordt de uitgever. Een
   mens van RTG laat je toe.
2. Je app is een map: HTML, JS, CSS, beeld, lettertypes. Alles zit erin — geen
   CDN, geen externe fonts, geen netwerk.
3. In de cel heb je geen verbinding. Wat je van RTG nodig hebt, vraag je met
   `RTG.roep('opslag.zet', { sleutel: 'x', waarde: 'y' })`. Dat script wordt er
   automatisch in gezet; je hoeft het niet te laden en je kunt het niet vervangen.
4. Druk op **Proefkeuring**. Je krijgt per bestand en per regel te horen wat er
   is en hoe het wel kan, zonder dat er iets is ingezonden.
5. Zend in. De machine keurt nooit goed — hij laat je door naar een mens.
6. Vraag alleen wat je gebruikt. Elke machtiging die je vraagt, is een vinkje dat
   een lid kan weglaten.
