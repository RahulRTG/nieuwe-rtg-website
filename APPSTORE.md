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
| **keuring** | de poort: machine (vorm), toegankelijkheid (gerenderd), en daarna mens (inhoud). | `kern/appstore/keuring.js` + `toegankelijk.js` + `besluit.js` |
| **machtiging** | wat een lid werkelijk VERLEENT. Nooit wat het manifest vroeg. | `kern/appstore/machtigingen.js` + `brug.js` |

**De uitgever is een `org` en geen nieuw begrip.** `TENANT.md` legt vast dat `org`
de juridische, beveiligings- en contractgrens IS, en dat er geen vijfde
identiteitsmodel bij komt. Een aparte "ontwikkelaarsaccount" zou precies dat
zijn. Een zaak die nog niet onder een organisatie hangt, wordt daarom geen
uitgever — met de weg erbij, niet met een stille weigering.

**Een uitgever heeft sinds 27 augustus 2026 een SOORT, en dat is een bevoegdheid
en geen etiket.** Een `rechtspersoon` mag geld vragen voor een app; een
geverifieerd `persoon` publiceert gratis. Betaalde distributie blijft aan een
rechtspersoon omdat de btw, de afdracht en de aanspreekbaarheid daaraan hangen,
en die drie zijn niet aan een natuurlijk persoon op te hangen zonder iets te
beloven wat RTG niet kan waarmaken. De regel staat op één plek
(`kern/appstore/uitgevers.js`, `magPrijsVragen`) en geeft een **reden** terug in
plaats van een ja of nee — dezelfde redenering als `WAARDE.md` hanteert voor
uitbetaalbaar. De soort wordt bij het aanmaken gezet en verandert nooit meer:
een bevoegdheid die je met een volgend verzoek kunt omzetten, is geen
bevoegdheid.

Dit voegt geen begrip toe. Ook een mens IS hier een `org`; wat verschilt is
alleen de deur waarlangs hij aantoont dat hij die org is — een zaak toont een
zaakinlog (`/api/appstore/uitgever/…`), een mens zijn ledeninlog
(`/api/appstore/persoon/…`). Zijn organisatiecode is **willekeurig** en nooit
uit zijn account afgeleid: die code staat publiek in de catalogus bij elke app.

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

En één ding dat de cel juist NIET krijgt, hardop: het kader draagt een **leeg
`allow`**. Overal elders in dit huis geeft een iframe camera en microfoon door
(anders vallen die er stil weg), en `scripts/check.js` regel 38b bewaakt dat.
Hier is het omgekeerde de bedoeling: camera en microfoon zijn rechten die een
lid nooit aan een derde verleent — de machtigingencatalogus kent ze niet eens.
Die regel is daarom uitgebreid met het omgekeerde besluit, want zonder die
uitbreiding zou de enige manier om er langs te komen `RTGMedia.kader()` zijn, en
dan zou derdencode die rechten juist wél krijgen. Een keuring die je naar de
verkeerde kant duwt, is een keuring die iets kapotmaakt.

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

**En sinds 27 augustus 2026 staat er een tweede controle die de poort DICHT kan
houden: de toegankelijkheidskeuring.** Zij hoort niet in `keur()` thuis — die is
synchroon en heeft geen browser, terwijl deze keuring de app juist *rendert*, in
de cel, met dezelfde CSP, op telefoonformaat. Zij staat daarom bij het
**besluit**: inzenden mag altijd, publiceren pas nadat zij is gedraaid en
geslaagd. Weigeren mag ook zonder haar — een mens die een app afkeurt hoeft niet
eerst te meten.

Drie standen, en *niet vast te stellen* is geen ja: draait de keuring niet, dan
gaat de poort dicht en niet open — precies dezelfde regel als bij de virusscanner
hierboven. De uitslag hangt aan de **bundelhash** en niet aan de app; zou hij aan
de app hangen, dan keurt de eerste versie de volgende goed, en dat is het gat
waar zo'n poort doorheen lekt. En ook zij keurt niets goed: `in-orde` haalt
alleen de blokkade weg, een mens tekent nog steeds af. RTG draait haar zelf
(`scripts/appstore-a11y.js`) en neemt geen uitslag aan van de uitgever — een
ingediend stuk is geen bewijs.

De prijs van dit besluit is bekend en aanvaard: een app die vandaag live staat,
kan zonder aanpassing geen nieuwe versie meer publiceren.

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

**En elke machtiging draagt een DOEL.** Een machtiging zegt wat een app krijgt;
het doel zegt waarvoor. Dat tweede is waar een lid werkelijk op beslist —
"onthouden wat je doet" is geen vraag, "onthouden waar je gebleven was" wel. De
doelen zijn een **gesloten lijst** (`machtigingen.DOELEN`), en dat is het hele
punt: vrije tekst levert "om u beter van dienst te zijn" op, en dat is niet te
vergelijken tussen apps, niet te doorzoeken voor het kantoor, en niet te diffen
bij een update.

**Een update die méér vraagt, krijgt het niet vanzelf.** Dit was een echt gat:
tot deze laag er was, kon een nieuwe versie een machtiging in zijn manifest
zetten zonder dat iemand het zag. Nu wordt bij elke opening uitgerekend wat de
live versie méér vraagt dan dit lid heeft verleend — een machtiging die hij niet
gaf, óf dezelfde machtiging voor een ánder doel — en dat staat op de kaart
voordat hij ergens op drukt. Zolang hij niets doet, krijgt de app het niet; de
app blijft wel gewoon werken met wat hij al had. Een update mag niet stilletjes
meer krijgen, en ook niet stilletjes stukgaan.

De mens die aftekent ziet dezelfde vergelijking (`tovLive` in de wachtrij): wat
erbij komt, wat er een ander doel krijgt, wat eraf gaat, en of de prijs verandert.
Zonder dat zou hij twee manifesten naast elkaar moeten leggen, en dat doet
niemand bij de twintigste.

**Een weigering legt uit welke van de twee ontbrak.** "403 Forbidden" laat een
uitgever raden tussen vier oorzaken die elk een andere oplossing hebben. De brug
zegt daarom of de app het niet vróég (los het op in je volgende versie) of het
lid het niet gáf (daar kun je niets aan doen, en dat hoort er dan ook te staan).

Er zijn er **drie**, en alle drie worden ze uitgevoerd:

| machtiging | geeft | nooit |
|---|---|---|
| `profiel.basis` | codenaam, taal, pas | naam, e-mail, telefoon, adres, geboortedatum |
| `opslag.eigen` | een kladblok per app per lid (32 sleutels, 64 kB) | inzage in een andere app of in de rest van je gegevens |
| `bericht.klaarzetten` | hooguit vijf berichten per dag in het eigen bakje | push, e-mail, sms, of iets dat onderbreekt |
| `arena.meedoen` | je score op het bord van DEZE app, met je codenaam | een plek in de ranglijsten van RTG zelf, en iets over leden die deze app niet spelen |

**De vierde machtiging is er sinds 31 augustus 2026, en hij is de eerste waarbij
een ander lid iets van je ziet.** Daarom drie dingen die niet mogen sneuvelen: het
bord hoort bij EEN app en nooit bij de ranglijsten van het huis (een derde stuurt
het getal in, en dan is een gedeelde ranglijst zo betrouwbaar als de minst
betrouwbare app erin); de leeftijdsgrens is dezelfde als die van de spellen
(`kern/spellen/grens.js`, doorgegeven en niet nagebouwd), en onder die grens is
het antwoord GEEN fout maar `bewaard: false` met de reden -- het spel speelt door;
en op het bord staat alleen wie er zelf, in deze app, een score heeft ingestuurd.
De richting (wint hoog of laag?) staat in het MANIFEST en niet in de aanroep,
anders draait een app het bord om zodra hij verliest.

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
  bereik.js       hoe ver een app komt: vier klassen, GEREKEND uit de machtigingen
  paspoort.js     het softwarepaspoort: vaste rijen, en een reden waar geen waarde is
  arena.js        het bord van EEN app, met de 18+-poort van kern/spellen/grens.js
  universa.js     de drie afdelingen van de winkel, afgeleid uit uitgever en arena
  tijdelijk.js    een cel met een einddatum die het LID koos
  context.js      waarden voor EEN handeling: klaargezet door RTG, doorgegeven door het lid
  opruim.js       verwijderen, wissen en de cel vernietigen -- wat een lid terugneemt
  manifestvorm.js welke velden een manifest kent en hoe ze eruitzien
  geld.js         de afdracht en de rekensom (de bon)
  aanschaf.js     de koop zelf, en de omzet die een uitgever terugziet
  teruggave.js    het recht dat een ingetrokken, gekochte app achterlaat
  naad.js         de enige plek waar de store en het geld elkaar raken

server/kern/pay/verkoop.js      een verkoop met inhoudingen, en de teruggave terug
server/kern/fiscaal/digitaal.js de btw op een digitale dienst: land van de AFNEMER

server/routes/appstore/
  uitgever.js     supplierAuth — een derde zendt in
  kantoor.js      officeAuth   — een mens van RTG tekent af
  lid.js          auth         — een lid bladert, verleent, opent, en de brug
  cel.js          geen inlog   — de gekeurde bundel zelf, in een naamloze cel

public/apps/
  appcel.html              de RTG-kant van een app van derden
  appstore-uitgever.html   het uitgeversbureau (kies je map, proefkeuring, inzenden, omzet)
  appstore-kantoor.html    de keuringskant: waar een mens van RTG aftekent
  mall.html                de afdeling "App Store" naast de App-Bibliotheek

test/appstore.test.js      de zes grenzen over de lijn
test/appstore-bereik.test.js   de bereikklasse, en dat hij nergens te ZETTEN is
test/appstore-arena.test.js    het bord per app, en de leeftijdsgrens erachter
test/appstore-tijdelijk.test.js  de einddatum, en het verschil tussen weg en vernietigd
test/appstore-context.test.js  de contextbrug: gesloten lijst, eenmalig, en geen machtiging
test/appstore-eersteapps.test.js  de eigen bundels in storeapps/ door dezelfde poort

storeapps/                 de eerste apps van RTG zelf, als gewone inzending
test/appstore-cel.test.js  wat je aan de bron zelf kunt zien
test/appstore-geld.test.js de bon, de aanschaf, de afdracht, de btw, het recht
test/appstore-doel.test.js het doel bij een machtiging, en de vergunningsdiff
test/appstore.e2e.js       de cel, de winkel en de bon in een echte browser
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

## Geld: betaald via RTG Pay, met afdracht

De eigenaar heeft gekozen: een app mag geld kosten, RTG int bij het lid, en er
gaat een afdracht af. Wat dat betekent staat hieronder; de keuze zelf en wat de
alternatieven waren, staan onderaan bij *de gemaakte beslissing*.

### Vijf begrippen erbij, en er komt er geen zesde

| begrip | wat het is | waar het woont |
|---|---|---|
| **prijs** | staat in het MANIFEST, dus per versie, dus door de keuring | `kern/appstore/manifest.js` |
| **aanschaf** | een lid koopt EEN keer, voor die app; updates zijn gratis | `kern/appstore/aanschaf.js` |
| **bon** | wat er precies is betaald — bruto, btw, afdracht, netto — en die is onveranderlijk | `kern/appstore/aanschaf.js` |
| **afdracht** | het deel dat RTG inhoudt; door de eigenaar gezet, bevroren op de bon | `kern/appstore/geld.js` |
| **teruggaverecht** | wat ontstaat als een gekochte app wordt ingetrokken | `kern/appstore/teruggave.js` |

### De prijs staat in het manifest

Een prijs die naast de versie zou leven, kan veranderen zonder dat er iemand
naar heeft gekeken — en dan verkoopt een uitgever morgen voor het tienvoudige
wat RTG gisteren heeft goedgekeurd. Hier hoort hij bij de bundel, gaat hij door
dezelfde keuring, en **is een prijswijziging een nieuwe versie met een nieuwe
handtekening van een mens**.

### Er komt geen tweede geldstroom

De aanschaf loopt over RTG Pay (`kern/pay/verkoop.js`, nieuw: een verkoop met
inhoudingen, hetzelfde patroon als `kasInt`). De opbrengst landt op de bestaande
partnerrekening van de zaak van de uitgever, en uitbetalen is de weg die er al
was — manager-only, naar de bank. `kern/appstore/` boekt zelf niets en telt geen
saldi; dat zou de dubbele boekhouding zijn die LAT-regel 4 verbiedt.

Het bruto bedrag gaat naar de partner, en wat eraf moet volgt als eigen regel in
hetzelfde grootboek. Zo ziet de ondernemer in zijn eigen boekingen wat er is
binnengekomen en wat eraf ging, in plaats van een netto bedrag zonder uitleg.

### De btw hoort in het land van het lid

De plaats van een digitale dienst is waar de **afnemer** woont, en dat is een
ander antwoord dan `kern/fiscaal/tarief.js` geeft voor een maaltijd of een kamer.
Daarom `kern/fiscaal/digitaal.js`: dezelfde levende landentabel, maar een andere
vraag. Wat verschilt is welk land telt, niet het cijfer.

Hij **raadt nooit**. Een land dat niet in de tabel staat levert geen
standaardtarief maar een weigering met de reden, en een lid van wie het land niet
bekend is, krijgt geen bon maar een keuzelijst. Een aanschaf met een verzonnen
btw-tarief is erger dan geen aanschaf: hij ziet er precies zo uit als een goede.

Wat er **niet** is, en dat staat ook in dat bestand: geen OSS-aangifte, geen
drempelbewaking, geen btw-verlegging bij een zakelijke afnemer, geen controle op
twee bewijsstukken van de woonplaats. Wat er wel is: elke aanschaf legt land,
tarief en bedrag vast, zodat een boekhouder het kan aangeven.

### Kopen gebeurt in de winkel, nooit in de app

De brug van de cel kent geen methode die geld beweegt, en die komt er ook niet.
`GELD.md` par. 3 zegt dat geld het huis nooit vanzelf verlaat en dat alles wat
een derde raakt maximaal "klaarzetten" is; een aankoopknop ín een app van een
derde is precies de autonome betaling die daar verboden wordt. Het lid koopt op
een scherm van RTG, met de bon ervoor: eerst wat het kost en waar het heen gaat,
dan pas de knop. En dezelfde poort als bij elk ander geld-moment: een echt
account laat voor RTG Pay eenmalig zijn paspoort zien, ook hier.

### De afdracht werkt alleen vooruit

Hij staat op **0%** tot de eigenaar hem zet — geen slappe standaard maar de
bestaande belofte van dit huis ("RTG rekent 0% commissie: de partner houdt 100%
van elke boeking"). Zetten vraagt een naam en een reden, gaat het journaal in, en
raakt alleen nieuwe bonnen: **een geschreven bon wordt nooit herrekend**. Hij
wordt gerekend over het netto bedrag en niet over het bruto, want btw is geen
omzet — een percentage over bruto zou betekenen dat een uitgever in een land met
een hoger tarief meer afdraagt over hetzelfde werk.

### Intrekken laat een recht achter, geen terugboeking

Hier zat een echte spanning. Grens 5 zegt dat intrekken onmiddellijk werkt en
overal, ook bij wie de app al had — dat is er voor de veiligheid en mag niet
zachter. Maar een lid dat ervoor betaalde, is dan zijn aankoop kwijt door een
besluit van ons.

De uitweg is niet de grens verzachten maar het geld apart regelen. Intrekken
blijft absoluut; wat het achterlaat is een **recht**, dat wordt klaargezet. Een
mens van RTG betaalt terug of wijst af met een reden.

En de teruggave loopt exact de weg van de verkoop terug. Dat was de plek waar de
eerste opzet omviel, en de fout was leerzaam: een lid betaalt bruto, maar de
uitgever houdt daar maar een deel van over — de btw en de afdracht zijn er
meteen afgegaan. Het hele brutobedrag van de partnerrekening terugvragen breekt
met "Onvoldoende saldo", precies zoals het hoort. Elk deel komt nu van de
rekening waar het destijds heen ging, en kan één van die potjes het niet missen,
dan gaat er **niets**: half terugbetalen is een tweede probleem bovenop het
eerste.

### Een uitgever ziet aantallen en bedragen, nooit wie

Ook geen codenaam — een codenaam plus een tijdstip is een spoor, en het
codenaam-ontwerp van dit huis is er juist om dat onmogelijk te maken.

### De gemaakte beslissing

Er lagen drie wegen; dit is er één van, en waarom de andere twee er niet zijn:

| | |
|---|---|
| **inbegrepen bij de pas** | wat het was. Geen inning, geen fiscale keten — maar ook geen reden voor een derde om er tijd in te steken. |
| **betaald via RTG Pay, met afdracht** | **gekozen.** Vraagt precies wat hierboven staat: een bevestiging door het lid, btw per land, een afdracht en een uitbetaalweg. |
| **gratis, met een vergoeding van RTG** | niet gekozen. Vraagt een gebruiksmeting die een uitgever niet kan opdrijven, en dat is een moeilijker probleem dan het lijkt. |

Wat er **niet** bij zit en met een reden in `machtigingen.NIET_GEBOUWD` blijft
staan: een app die zelf een betaling start. Ook abonnementen en aankopen ín een
app bestaan niet — dat zijn eigen mechanismen met een eigen opzegweg, en een
half gebouwd abonnement is erger dan geen abonnement.

---

## De verantwoordingskant

Een bedrijf dat software van een derde toelaat, stuurt een vragenlijst: waar
staan de gegevens, wie kan erbij, wat gebeurt er bij opzeggen, wie heeft de code
gezien. Dat kost aan beide kanten weken, en het antwoord is proza dat niemand kan
nakijken. Hier staat dat antwoord klaar, met per bewering een bron in de code.

Drie dingen, en ze hangen samen: het **dossier** zegt wat er geldt, de
**tijdlijn** zegt wat er is gebeurd, en de **controleronde** kijkt na of het
eerste nog waar is.

### Het inkoopdossier — en het staat bij het LID

`/api/appstore/dossier` (`kern/appstore/dossier.js`) geeft per app zeven blokken:
wie de leverancier is, wat er draait, wat de app mag, wat hij **nooit** krijgt,
waar de gegevens blijven, wat de poort vond, en hoe de uitgang werkt. Daarnaast
geeft `/api/appstore/kanaal` wat voor élke app geldt, zodat een inkoper dat niet
per app hoeft te lezen.

Het staat achter de LEDEN-poort en niet achter een kantoorpoort. Een document dat
alleen een inkoper mag lezen is een verkooppraatje; dit hoort iedereen te kunnen
openen die de app overweegt. Op het scherm staat het dichtgeklapt op de kaart in
de Mall — naslag, geen reclame — en het wordt pas opgehaald als iemand het opent.

**Elke bewering draagt vier dingen**: wat er wordt beweerd, hóé het is
vastgesteld, wáár dat staat, en de gemeten waarde. Een bewering zonder die vier
hoort er niet in — dat is het hele verschil met een ingevulde vragenlijst. De
bron staat zichtbaar op het scherm en niet in een tooltip: wie het niet gelooft,
zoekt het bestand op.

### De sterkste claim is een negatieve

> Binnen RTG. De leverancier heeft geen kopie, en kan die ook niet krijgen.

Dat volgt uit grens 1: een app in de cel heeft `connect-src 'none'`. Er is geen
weg waarlangs een kopie zijn kant op had kunnen gaan. Geen
verwerkersovereenkomst die het belooft, geen audit die het steekproefsgewijs
vaststelt — de uitvoering maakt het onmogelijk, en de CSP-kop van élke celrespons
is het bewijs. `test/appstore-dossier.test.js` toets 3 houdt de claim tegen de
échte kop; zakt de kop weg, dan zakt de toets.

Hetzelfde maakt de uitgang eenvoudig: er is niets bij de leverancier om te laten
verwijderen. Wat een app bewaarde stond hier, en wordt hier gewist.

### Wat dit dossier NIET zegt

Vijf dingen, elk met de reden erbij: beschikbaarheid van de leverancier (er is
geen server van een derde om te meten), penetratietest, SBOM en herleidbare
build, certificeringen van de leverancier, en aansprakelijkheid en contract.

Dat blok staat met dezelfde opmaak als de rest en niet als kleine letters
onderaan. Het is geen restpost maar het deel dat de rest geloofwaardig maakt: een
leverancierspak dat overal ja zegt is niets waard; een dat zegt waar het ophoudt,
is te vertrouwen op de rest. Een inkoper die dit leest weet precies waar zijn
eigen onderzoek moet beginnen.

### De tijdlijn van het lid

`kern/appstore/tijdlijn.js` schrijft mee bij elk toestemmingsmoment: installeren,
verlenen, terugnemen, verwijderen, wissen, kopen, geld terugkrijgen, en een app
die uit de store wordt gehaald. Acht soorten, een gesloten lijst.

Dit is de tegenhanger van het journaal, en het zijn twee lijsten omdat het twee
verantwoordingen zijn met twee lezers. Het journaal is van RTG: wie liet een
uitgever toe, wie tekende een versie af. De tijdlijn is van het LID: wat gaf ik,
en wanneer nam ik het terug.

Drie regels:

- **Hij groeit aan en wordt nooit herschreven** — ook niet als het lid de app
  verwijdert. Juist dan niet: "ik heb die app in mei drie dagen gehad en toen
  verwijderd" is precies het soort zin die een tijdlijn moet kunnen staven.
- **Dat er is gewist komt erin; wat er stond niet.** De regel dát iets verwijderd
  is, is zelf geen persoonsgegeven — en zonder die regel is "ik heb dat laten
  wissen" achteraf niet te staven.
- **De sleutel komt uit de sessie en nooit uit de body.** Een lid ziet alleen
  zijn eigen tijdlijn, ook als hij de sleutel van een ander kent.

### De controleronde

`/api/appstore/kantoor/hercontrole` loopt alles na wat live staat en houdt élk
bestand tegen zijn eigen hash. Klopt een bundel niet meer met wat een mens heeft
afgetekend, dan gaat de app eruit — en dat is geen afweging maar de enige juiste
uitkomst. De ronde komt in het journaal, met de naam van wie hem draaide.

Dit is grens 5 in de tijd doorgetrokken. De integriteitscontrole draait al bij
élke lezing van schijf, dus een aangetast bestand wordt sowieso niet uitgeleverd;
wat de ronde erbij doet is de app ook uit de winkel halen in plaats van hem daar
kapot te laten staan.

### Drie lezers, drie ingangen

Het dossier is één bron met drie plekken waar hij wordt gelezen, en dat is geen
dubbeling maar drie verschillende momenten:

| wie | waar | waarom daar |
|---|---|---|
| **het lid dat kiest** | uitklapblok op de winkelkaart in de Mall | hij staat op het moment van de keuze, dichtgeklapt: naslag, geen reclame |
| **de inkoper, de FG, de security officer** | `/apps/appstore-dossier.html?app=…` | die komt er niet toevallig langs maar wordt ernaartoe gestuurd, en heeft een adres nodig dat hij bewaart en doorstuurt |
| **de uitgever zelf** | "Wat de klant leest" op het uitgeversbureau | wie pas bij het inkoopgesprek ontdekt wat er over hem staat, kan er niet meer op reageren |

De uitgever kan er niets aan veranderen — alles erin komt uit een meting op zijn
eigen bundel of uit een besluit van RTG — en juist daarom hoort hij het te
kunnen zien. De poort staat op de UITGEVERSingang en niet in de kern: welke app
van wie is, is een vraag van de poort en geen eigenschap van het dossier. Een
app van een ander geeft daar 404 en geen 403, want het bestaan van andermans app
is zelf al informatie. Als LID mag diezelfde persoon er wel gewoon bij; het
dossier is openbaar binnen dit huis.

### Het kanaaldossier: de vraag die je maar één keer stelt

`/apps/appstore-dossier.html` zonder app toont wat voor **elke** app hier geldt.
Dat is de vorm waarin een inkoper zijn vraag eigenlijk stelt: "kan zo'n app ooit
bij onze betaalgegevens?" is geen vraag per app maar per platform.

De volgorde is een standpunt: eerst wat géén enkele app kan vragen (betalen,
agenda, bestanden, locatie, contacten, push — zes, elk met de reden), dan pas de
drie machtigingen die er wél zijn. Een catalogus die begint met wat er mogelijk
is, leest als een menukaart, en dit is geen menukaart.

Wat er níét in staat is één app of één leverancier. Dat is precies wat het tot
een kanaaldossier maakt, en `test/appstore-dossier.test.js` toets 8 houdt dat
vast.

De pagina is niet openbaar: dit huis heeft geen publieke pagina's, dus wie hem
doorstuurt stuurt hem door naar iemand met een RTG-inlog. Dat staat op de pagina
zelf — een adres dat de ontvanger niet kan openen is erger dan geen adres.

### Wat er (nog) niet is, en waarom

**Een private catalogus per organisatie** — een klant die zijn eigen apps ziet en
de rest niet. Niet gebouwd, en niet uit tijdgebrek: dat vraagt te weten welk lid
bij welke organisatie hoort, en dat antwoord bestaat hier al twee keer (het
dienstverband in `CONCERN.md`, de SSO-inrichting in `TENANT.md`). Een derde
lezing erbij is dezelfde waarheid op drie plekken, en dan is "mag deze mens deze
app zien" op drie manieren te beantwoorden. Zie `DEVELOPERCLOUD.md` par. 4.

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
