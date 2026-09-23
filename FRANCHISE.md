# RTG Franchise — wat er nodig is om RTG door een ander in een ander land te laten draaien

*Richtingsdocument, zoals `PLATFORM.md`, `ECONOMIE.md`, `HDI.md` en
`TRAVELCOMMERCE.md`: per onderdeel staat er of het **staat**, **een stap weg**
is, **een besluit vraagt** of **jaren weg** is — zodat niemand die vier voor
elkaar aanziet. Opgesteld 14 september 2026, na de meting van
`LANDDEKKING.json`.*

De vraag was: *wij willen RTG franchise ready maken voor het buitenland, wat
hebben wij daarvoor en wat kunnen wij doen?* Dit document beantwoordt de eerste
helft met een meting en de tweede helft met een volgorde. Wat het niet doet is
besluiten of RTG naar een land moet — dat is van de eigenaar, en par. 8 zet de
besluiten op een rij die eerst genomen moeten worden.

---

## 0. De kern

**RTG weet van <!--getal:land.landen-->189<!--/getal--> landen hoe het daar werkt en kan er in
<!--getal:land.volledig-->0<!--/getal--> werkelijk draaien — en dat gat is niet het probleem, het
is de opdracht.**

De zin die het ontwerp stuurt staat al in dit huis geschreven, in
`kern/mall/vestigingen.js`, over de franchise van een bakker:

> *Waar elke vestiging een eigen ondernemer is, hoort zij een eigen zaak te zijn
> met een eigen code — dat is geen vestiging maar een bedrijf.*

Die regel is voor een klant opgeschreven en hij geldt hier één op één. Een
RTG-franchisenemer in Spanje is **geen vestiging van RTG** en **geen nieuw
objecttype**; hij is een eigen partij met een eigen code, een eigen vermogen en
een eigen rechtspersoon. Wie daar een `franchises`-tabel voor aanlegt die mensen,
geld, contracten én toegang bezit, maakt de `Asset`-fout opnieuw — en die is in
dit huis al vier keer gemeten (`OBJECTMODEL.json`, `CARRIEREVORM.json`,
`STAGEVORM.json`, `AANVOERVORM.json`).

En één zorg die je hier zou verwachten, is er niet. De zwaarste vraag — mag een
partner elders geld uitgeven namens RTG — is in `TOKEN.md` al gesteld en met nee
beantwoord, mét de voorwaarde waaronder het ja wordt (par. 4.2). Dit document
heeft die vraag dus niet te openen maar te respecteren.

---

## 1. De meting: kennis is niet uitvoering

`npm run landdekking` (`LANDDEKKING.json`) legt per land acht assen naast elkaar,
elk uit een bron in `server/` en geen ervan uit een lijst die iemand bijhoudt.
Drie assen staan voor **elk** land aan; die zijn de ondergrens en tellen niet
mee in het kopgetal. Dat onderscheid wordt **geteld en niet verklaard** — in de
eerste versie van de meter stond per as met de hand of hij onderscheidend was,
en `zakelijkeUitleg` stond meteen verkeerd ingevuld. De indeling van een meting
is zelf een bewering (`BEWIJSMACHINE.md` par. 6a) en hoort even hard te zijn als
de meting.

| as | landen | wat |
|---|---|---|
| btw-tarieven | 189 | ondergrens — staat voor elk land aan |
| aangiftewijze | 189 | ondergrens |
| loonkennis (minimumuurloon, lasten, vakantiegeld) | 189 | ondergrens |
| bedrijfsregister met adres | <!--getal:land.register-->33<!--/getal--> | NL, GB, US, JP + BRIS (EU/EER) |
| rechtsvormen | <!--getal:land.rechtsvorm-->7<!--/getal--> | NL, BE, DE, FR, ES, GB, US |
| zakelijke aftrekuitleg | 6 | |
| fiscale jaargang | <!--getal:land.fiscaalJaargang-->1<!--/getal--> | DE |
| loonuitvoering (regelpakket) | <!--getal:land.loonuitvoering-->1<!--/getal--> | NL |

**<!--getal:land.volledig-->0<!--/getal--> landen halen alle <!--getal:land.assen-->5<!--/getal-->
onderscheidende assen. <!--getal:land.zonderEnige-->156<!--/getal--> landen hebben alleen kennis en
geen enkele uitvoeringsas.** De koplopers zijn Duitsland (4/5, mist loon) en
Nederland (4/5, mist een fiscale jaargang).

Let op die laatste regel, want hij is niet wat iemand zou raden: **Duitsland
haalt op één as méér dan Nederland.** De meegeleverde fiscale jaargang is
`de-2026.json` en er is geen `nl-2026.json`; Nederland leunt op de tabel in
`kern/fiscaal/landen.js` en die beweegt niet vanzelf mee met een tariefwijziging.
Dat is geen argument om in Duitsland te beginnen — het is een aanwijzing dat de
thuismarkt niet automatisch de best bediende markt is, en dat een
franchise-uitrol de thuismarkt meerepareert in plaats van hem te ontzien.

De meter is een mutatie aangedaan en bewoog: met `de-2026.json` tijdelijk weg
zakt Duitsland van 4/5 naar 3/5 en gaat de as naar nul. Een meter die je niet
hebt zien uitslaan, is geen meter (`LAT.md`).

### 1a. En vijf dingen die niet per land te meten zijn

Deze gaan niet over een land maar over de vraag **wie RTG daar IS**. Ze zijn
huisbreed nul of één, en elk getal wordt in dezelfde meter uit de broncode
geteld — niet ingetikt, want een register dat naast de code leeft loopt eruit
zonder dat iemand het ziet.

| as | stand | wat het betekent |
|---|---|---|
| exploitant | 0 als begrip | de woordtelling geeft 1 treffer, en dat is `kern/beroepenbieb/data.js` waar *Franchisenemer* een **beroepsnaam** in een lijst is. Een woord in gegevens is geen partijsoort. |
| economische wereld | 1 drager | `rtg-intern` heeft precies één drager: `huis`. Er is één huis. |
| kantoorcode | 1 | één gedeelde `OFFICE_CODE`, 26 kamers erachter (`KANTOORMACHT.md`). |
| vergoeding over omzet | 0% | en dat is een **invariant**, geen instelling. |
| land→taal | 0 | 114 talen, 11 schiltalen, en niets dat een land aan een taal knoopt. |

---

## 2. Wat een franchisenemer hier IS — en waarom er geen nieuw objecttype komt

De verleiding is een `Franchise`-object dat het land, de entiteit, de valuta, de
taal, het merk, de afdracht en de toegang bezit. Dat is precies de vorm waarin
`Asset` sneuvelde, en de vorm die `TRAVELCOMMERCE.md` tegenhoudt bij een
`journeys`-tabel: *een reis die mensen, geld, documenten én reserveringen BEZIT
is de `Asset`-fout opnieuw.*

De vorm die hier wél werkt, bestaat al drie keer in dit huis:

1. **De partij is een zaak.** `kern/mall/vestigingen.js` zegt het letterlijk (zie
   par. 0). Een exploitant in Spanje is een `zaak` met een eigen code, in de
   wereld `commercieel`, met een eigen rechtspersoon in `kern/concern/entiteit.js`
   en een eigen toelating via `kern/aanmeldingen/bewijs.js`.
2. **Wat hij MAG is een projectie, geen etiket.** De vorm van
   `kern/levensgraaf/graaf.js`: onderwerp, soort, bron, wanneer, `deel` als
   poort. Geen tweede rechtenmodel — `CONCERN.md` houdt dat al tegen: *toegang
   verlenen gebeurt waar de rol woont.*
3. **Wat er tussen hem en RTG loopt is een relatie tussen twee economische
   werelden**, en die bestaat al met een grendel eromheen (par. 4).

Er komt dus **geen `franchises`-tabel** en **geen vijfde wereld per land**. Wat
er wel bij moet, is één ding: een **hoedanigheid** op de bestaande zaak die zegt
dat deze partij onder het merk RTG naar buiten treedt. Dat woord is met opzet
gekozen: `MENSNETWERK.md` par. 4b heeft hoedanigheid al als begrip, het komt in
`server/` in vier bestanden voor en alle vier in `kern/vertegenwoordiging/` — dus
de grammatica ligt er en er is nog geen botsing.

---

## 3. Wat er al STAAT (en dus niet gebouwd hoeft te worden)

Dit is de goedkoopste paragraaf van het document. Het meeste van wat een
franchise-uitrol vraagt, bestaat hier al onder een andere naam.

**Landkennis.** `kern/fiscaal/landen.js` draagt van 189 landen de btw-tarieven
per categorie, het minimumuurloon, de werkgeverslasten, het vakantiegeld, de
alcoholleeftijd en de aangiftewijze. `kern/fiscaal/wereld/` deelt ze in vijf
regio's in. Dat is echte kennis en die is duur om na te maken.

**Eén plek voor het tarief.** `kern/fiscaal/tarief.js` bestaat omdat er twee
plekken waren die het oneens waren: Sal de Mar op Ibiza rekende 10% in de
boekhouding en drukte 9% op de bon. Die reparatie is precies de reparatie die
een franchise nodig heeft, en hij is al gedaan.

**Jaargangen in plaats van constanten.** `kern/payroll/regelpakket.js` en
`kern/fiscaal/jaargangen.js`: een tarief is nooit een getal in de code maar een
versie met een geldigheidsperiode en een herkomst, en een oude berekening kan
niet meer veranderen. Een land erbij is een pakket erbij, geen verbouwing.

**Dekking als eersteklas uitslag.** `kern/payroll/dekking.js` is het model voor
dit hele document: drie standen (`draait`, `wacht_op_mens`, `geen_tabel`), de
landenlijst afgeleid uit de zaken zelf in plaats van uit een lijst die iemand
bijhoudt, en *"er komt geen loonrun" mag geen STILTE zijn*.

**Valuta die geen euro's aanneemt.** `kern/payroll/valuta.js` weet dat de yen
geen honderdsten heeft en de Koeweitse dinar duizendsten, en weigert te gokken:
een onbekende valuta geeft `null` en niet een vriendelijke 2. Hij rekent ook
bewust **niet** om — loon wordt betaald in de munt van het land, en een koers
zou een loonstrook laten bewegen met de markt.

**Bedrijfstoelating zonder wereldwijd KvK.** `kern/internationalehandel.js`:
BRIS voor de EU/EER, Companies House, de staatregisters van de VS, de Japanse
NTA — plus sancties (VN, EU, OFAC), VIES, EORI, dual-use en goederencodes.

**Rechtsvormen per land.** `kern/onderneming/rechtsvorm-{nl,europa,angelsaksisch,
landen}.js`, met de regel die ertoe doet: een onbekend land krijgt géén
Nederlandse lijst die er ongeveer op lijkt, maar een uitgeschreven *"wij kennen
de rechtsvormen van dit land niet"*. Dat is precies de toon die een franchise
nodig heeft.

**De economische firewall.** `kern/economie/` — vier werelden, de wereld is een
eigenschap van de IDENTITEIT en niet van de transactie, en tussen twee werelden
bestaat standaard géén relatie: die vraagt een grondslag én een plafond, het
register is leeg, en een weigering zegt hoe het wél kan. Dat is de grendel
waarop een afdracht hoort te staan (par. 4).

**De klant als ding.** `TENANT.md` en `kern/tenant/`: `org` IS de klant, de
levenscyclus, de uitgang, het contract, de quota en de bewijspoort staan er. En
de modus `sovereign` **weigert mét de reden** in plaats van te bestaan als knop —
dat is de bestaande, eerlijke behandeling van precies de vraag die een
franchisenemer stelt.

**Vertegenwoordiging.** `kern/vertegenwoordiging/` (acht routes, scherm
`/apps/vertegenwoordiging.html`): mens-namens-mens, met de grammatica uit
`kern/stuur/mandaat.js` — een mandaat VERSMALT bestaand vermogen en verleent er
nooit, leeg is dicht, verval is berekend, delegatie staat in de NOOIT-lijst.

**Taal.** 114 talen in `server/talen.js`, 11 schiltalen in `server/taalschil.js`,
een vertaalkast die een navigatie overleeft, en `kern/taaldekking.js` die eerlijk
meet wat "114 talen" wél en niet betekent.

---

## 4. Wat een BESLUIT vraagt (en dus niet met bouwen begint)

Dit zijn de vier waar een programmeur niet omheen kan werken. Ze staan vóór de
bouwtaken omdat ze de bouwtaken bepalen.

### 4.1 De afdracht botst met een invariant, en dat is geen detail

`kern/commercie/vergoeding.js` draagt één invariant:

> *De standaard partnervergoeding over omzet is NUL. Altijd. Dat is geen
> instelling, geen beginstand en geen knop op nul. Het is een eigenschap van het
> product.*

De partnervoorwaarden art. 1 zeggen het met zoveel woorden — *"RTG rekent geen
commissie, geen transactiekosten en geen licentiekosten over uw omzet"* — en
`MENSNETWERK.md` par. 4c meet die invariant als dragende aanname onder
grondwetsregel MN-03. Een **royalty over de omzet van een franchisenemer is
exact zo'n stroom.** Er stond hier tot 20 augustus 2026 een generieke
commissieknop en die is er bewust uit gehaald, met de reden erbij.

Er zijn dus twee wegen en precies twee:

- **A. De benoemde dienst.** Dezelfde module kent vier BENOEMDE diensten die
  wél in rekening mogen, en alle vier dragen ze `overOmzet: false`:
  **betaaldienst** (per transactie via RTG Pay, betaald door de zaak),
  **bemiddelingsdienst** (een boeking via het partnerkanaal voor gasten),
  **ticketdienst** (verkoop en scan aan de deur) en **inrichting** (eenmalig
  inrichten, migreren of koppelen). Een franchisevergoeding als *platformdienst
  met een grondslag en een plafond* past op dat patroon zonder de invariant aan
  te raken. **Aanbevolen.**

  Let wel op wat dit precies kost: alle vier zijn per transactie of eenmalig, en
  een terugkerende franchisevergoeding is er geen van. Het is dus een VIJFDE
  benoemde dienst en geen hergebruik van een bestaande — klein in code, en nog
  steeds een besluit, want de lijst is met opzet kort en elke naam erbij verruimt
  wat RTG een partner mag rekenen.
- **B. De invariant bewust openzetten.** Dan verandert de belofte aan alle
  partners en moeten de partnervoorwaarden mee. Dat is een juridisch besluit met
  een prijs, geen configuratie — en `test/`-toetsen die de invariant bewaken
  moeten dan worden VERVANGEN en niet aangepast.

Wat er níét mag gebeuren: een derde weg die de invariant omzeilt zonder hem te
noemen. Dat is dezelfde vorm als de terugstortstand in `CLAUDE.md` — een knop die
zelf de juridische positie ís, en als de schakelaar in `GIFT.md` par. 4: *de
schakelaar ÍS de positie*, niet twee dingen die toevallig samenhangen.


### 4.1a De basis onder die afdracht is nu een PRIMITIEF, en de norm is een gezaaide wereld

Welke van de twee wegen hierboven het ook wordt, allebei rekenen ze over een
**bijdragebasis** — bruto min wat rechtstreeks aan derden is doorbelast. Zo'n
basis is alleen een eerlijk getal als hij een reproduceerbare functie van
bronregels is; anders is het een commercieel bedacht getal met een formule
eromheen, en is de eerste onenigheid met een exploitant meteen principieel.
Vandaar dat de meting vóór de vergoeding komt, en niet andersom.

**Besluit 1: herkomst is drie vragen en geen veld.** De eerste ingeving was
`herkomst: 'partner'` op de geldrij, en die sneuvelt op een gewone regel: een
klant betaalt EUR 800, daarvan komt EUR 550 toe aan een hotel, en RTG INT het
hele bedrag. Wie daar alleen de betaler van bewaart, kan later niet zeggen van
wie het geld was; wie alleen de eigenaar bewaart, kan niet zeggen wie het
betaald heeft; en wie de ene uit de andere AFLEIDT, verzint de helft.
`server/kern/waarde/economischeherkomst.js` draagt daarom drie velden die nooit
mogen samenvallen:

| veld | vraag |
|---|---|
| `economischeHerkomst` | van wie kwam de waarde |
| `economischeEigenaar` | aan wie komt hij economisch toe |
| `naarWie` | waar gaat het geld feitelijk heen |

Ze vallen vaak samen en ze zijn nooit hetzelfde veld. In het voorbeeld hierboven
zijn ze alle drie verschillend, en dat is geen randgeval maar de normale vorm van
een reis. `bestemming` is bewust vermeden: dat woord is hier 167 bestanden lang
een REISbestemming, en een tweede betekenis op de centrale naam van een
reisbedrijf is de `VERMOGENS`-botsing uit `SEMANTIEK.json`.

Dit is de **primitief en niet de migratie**. Van de
<!--getal:doorbelasting.geldvormen-->212<!--/getal--> geldvormen in dit huis
dragen er <!--getal:doorbelasting.volgbaar-->30<!--/getal--> een aantoonbare
herkomst; die andere <!--getal:doorbelasting.nietVolgbaar-->182<!--/getal-->
gaan hier niet vanzelf op over. Wat de module levert is de VORM waarin een
geldrij het wél kan dragen, plus het oordeel of een gegeven rij te volgen is. De
ratel eromheen — volgbaar alleen omhoog, niet-volgbaar alleen omlaag — maakt daar
een migratiepad van in plaats van een big bang. Beide modules hebben vandaag
**nul aanroepers**, en dat staat als schuld in `NORM.json` met de weg eruit
erbij: dat is dezelfde tussenstand die dit huis al kent van
`kern/namens/versmalling.js` en `kern/stuur/mandaat.js`.

**Besluit 2: de norm is een gezaaide wereld en nooit de productiedata.**
`DOORBELASTING.json` valt daarom in twee helften die nooit worden opgeteld:

| | wat het is | poort? |
|---|---|---|
| **B1 — de norm** | `scripts/lib/economiewereld.js`: <!--getal:doorbelasting.normRijen-->22<!--/getal--> deterministische rijen, in de keuring | ja, met twee ratels |
| **B2 — de werkelijkheid** | de echte opslag, elk bedrag ingedeeld | nee, observatie |

Productiedata is uitstekend om te zien wat RTG werkelijk verdient en ongeschikt
als definitie van correctheid: haar samenstelling verandert voortdurend. Vandaag
geen terugboekingen, morgen wel; vandaag geen yen, volgende week wel. **Een
regressie die alleen zichtbaar is als er toevallig een yen in de data zit, is
geen regressietoets.**

De gezaaide wereld is met opzet gemeen: een pakketreis die uiteenvalt in hotel,
vlucht, eigen dienst en btw; geld dat RTG int maar niet toekomt; drie soorten
terugbetaling die elk iets anders betekenen (gedeeltelijk, volledig, door de bank
afgedwongen); vouchers en cadeaubonnen, die een VERPLICHTING zijn en geen omzet;
en drie munten, waaronder de yen die geen honderdsten heeft. En
<!--getal:doorbelasting.normNietVolgbaar-->4<!--/getal--> rijen zijn er met opzet
**niet** te volgen — een wereld waarin alles keurig klopt, meet de enige vraag
niet die ertoe doet: ziet de meter een gat, of rekent hij het dicht?

Die wereld verdiende zich binnen een minuut terug. De onbekende post liep
**negatief** (−52260), omdat een terugbetaling toekomt aan het LID en `lid` in de
restbak viel. Een negatief gat is precies het soort getal waar niemand op klikt
omdat het klein lijkt.

### 4.2 De vergunningsvraag is al gesteld — en met nee beantwoord

Dit is het punt waar het eerste concept van dit document ernaast zat, en de
correctie is belangrijker dan de vraag. `TOKEN.md` par. 7 heeft **precies de
franchisevraag** al voorgelegd en beslist:

> *Mag een partner e-money voor ons uitgeven? — besloten op 20 augustus 2026:
> `partnerRail: null` blijft staan.* Geen distributie-route in de lijst zolang er
> geen gesprek met een EMI loopt. De lijst hoort te zeggen wat waar is, niet wat
> zou kunnen.

Een exploitant die in Spanje ledengeld aanneemt op de rail van RTG, **ís** die
partnerrail. Het antwoord is dus vandaag nee, en het is geen gat maar een
genomen besluit met een uitgeschreven voorwaarde: als die route er ooit komt, is
één regel in `kern/bevoegdheid/lijst.js` genoeg — na het EMI-gesprek, niet ervoor.

Daaronder ligt een tweede grendel die dezelfde kant op wijst. Besluit 1 van
`TOKEN.md` is óók genomen: de walletbrug is **eenrichtingsverkeer**
(`kern/bank/walletbrug.js`) — geld mag van een eigen bankrekening naar de wallet
en niet andersom, en dat kost een lid werkelijk iets (hij kan zijn walletsaldo
niet naar zijn eigen rekening halen). De slotzin daar geldt hier woordelijk:
**wie de brug weer opent, opent daarmee de vergunningsvraag.** Een franchise die
geld terug laat lopen naar een exploitant, doet exact dat — en dan is de tabel
uit `CLAUDE.md` (`WALLET_SALDO` gesloten tegenover open) een tabel per land
geworden in plaats van per huis.

**En de vorm die wél werkt, is al een keer gevonden.** `GIFT.md` besluit 1 is op
31 augustus 2026 genomen en loste hetzelfde probleem op: de RTFoundation krijgt
een eigen wallet zoals een leverancier er een heeft en betaalt zichzelf
vandaaruit uit naar haar eigen bankrekening. De eigenschap die de andere opties
misten, staat er met zoveel woorden: **er komt geen betaalweg bij.**
`kern/pay/partner.js` boekt al naar `partner:<code>` en `/api/supplier/pay/
uitbetaal` bestaat al, met een idempotentiesleutel en een eerlijke stand *in
behandeling* in plaats van *gelukt*.

Een exploitant is dus een partnerwallet, en de afdracht is een boeking naar
`partner:rtg` in plaats van een nieuwe rail. Wat je daarbij accepteert staat er
ook al: **de transactiekosten komen van de ontvanger af** — een gift van € 25
komt binnen als € 24,65, en een franchisescherm dat een rond percentage belooft,
zou dus liegen.

Wat er dan nog per land bij komt is niet een rail maar een **rekening**: de
exploitant houdt zijn eigen betaalaanbieder voor zijn eigen klanten, en RTG
factureert hem. Dat vraagt geen vergunning, en het is de tweede reden dat optie
A in par. 4.1 de aanbeveling is.

### 4.3 De kantoordeur is één deur, en dat is de grootste blokkade

Er is één gedeelde `OFFICE_CODE` en één rol `office`, met 26 kamers erachter en
<!--getal:kantoor.routes-->614<!--/getal--> kantoorroutes, waarvan er
<!--getal:kantoor.deurEistMens-->189<!--/getal--> een bewezen mens eisen. Een medewerker van een
exploitant in Spanje die de balie moet bedienen, krijgt daarmee de deur van het
hele huis — inclusief de kluis van Nederlandse leden.

`KANTOORMACHT.md` zegt al dat de eerste functie van die laag niet is macht
toevoegen maar bestaande macht uit elkaar halen, en `KANTOOR.md` zegt dat een
spoor dat eindigt bij een gedeelde code geen spoor is maar een alibi. **Een
franchise maakt dat van een schuld een blokkade.** Dit is geen nieuwe bouwtaak:
de poort bestaat (`kern/kantoor/kluispoort.js`) en hangt volgens `KANTOOR.md` aan
8 routes — een fractie van het totaal, en dat totaal is hierboven een levend
getal omdat het beweegt.

Het besluit dat hier openstaat is niet óf, maar in welke volgorde: eerst de
kluisweg per land afgrenzen, of eerst de kamers per exploitant. Het eerste is
kleiner en dekt het gevaarlijkste af.

### 4.4 Land → taal is een besluit dat nergens staat

Er zijn 114 talen en 11 schiltalen, en **niets dat een land aan een taal knoopt.**
Een lid in Madrid krijgt vandaag geen Spaans omdat hij in Spanje is; hij krijgt
het omdat hij het kiest. Dat is verdedigbaar — `ADAPTIEF.md` en `GRAMMATICA.md`
kiezen consequent voor wat de mens doet boven wat het systeem afleidt — maar het
staat nergens als besluit, en bij een franchise gaat iemand het vanzelf
aannemen. Leg het vast, welke kant het ook op valt.

---

## 5. Wat EEN STAP WEG is

Deze vragen geen besluit en wel werk, in oplopende kosten.

1. **De dekkingsmeter zelf** — staat (`npm run landdekking`); dit document draait
   erop, en een land erbij verschijnt er vanzelf in.
2. **Een fiscale jaargang voor Nederland** (`nl-2026.json`). Dagwerk, en het
   repareert de thuismarkt (par. 1).
3. **Een loonregelpakket per land.** De motor is landneutraal en wacht op een
   pakket; de keuring staat. Dit is per land een afgebakende klus met een
   bekende vorm, en `kern/payroll/dekking.js` maakt zichtbaar wat er ontbreekt.
4. **Rechtsvormen voor de EU-landen die BRIS al dekt.** 33 landen hebben een
   register en 7 hebben rechtsvormen; dat gat is tabelwerk met een bestaande
   vorm — en de weigering voor onbekende landen is al beleefd en correct.
5. **De valuta-regel huisbreed maken.** `kern/payroll/valuta.js` weet het al;
   `'EUR'` staat op 40 plekken in 29 bestanden letterlijk in `server/` en het
   euroteken op 37 schermen. Dat is een lexicale ONDERgrens en geen foutenlijst
   — een bedrag dat aantoonbaar altijd in euro's is, mag het blijven. Wat er moet
   komen is een meter die zegt welke van de 40 een AANNAME zijn.
6. **`|| 'NL'` in kaart brengen.** 32 regels in 24 bestanden vallen stil terug op
   Nederland. Voor een Nederlands huis is dat een redelijke terugval en voor een
   franchise is het een stille fout. Ook hier geldt: eerst meten welke van de 32
   een aanname zijn, dan repareren — en niet andersom.

---

## 6. Wat een BESLUIT vraagt maar ook gebouwd moet worden

- **De hoedanigheid "exploitant" op een zaak** (par. 2). Klein in code, groot in
  gevolgen: hij bepaalt wat er in het merk naar buiten mag.
- **De relatie tussen twee economische werelden voor de afdracht.** De grendel
  staat (`kern/economie/firewall.js`): standaard geweigerd, een relatie vraagt een
  grondslag én een plafond. Wat er moet komen is één registerregel met die twee,
  niet een nieuwe laag.
- **Gegevenswoonplaats.** De identiteitskluis is één kluis. Welke gegevens van een
  Spaans lid waar staan, is een AVG-vraag met een antwoord per land; `TENANT.md`
  heeft de herkomstregel al als niet-uitzetbaar vastgelegd (*wiens software je
  personeelsdossier bewaart is een AVG-vraag, geen merkvraag*).

---

## 7. Wat JAREN WEG is

- **Een eigen RTG-rechtspersoon per land met een eigen vergunning.** Dat is de
  weg waarop RTG zelf uitgever van elektronisch geld is in meerdere
  jurisdicties. Er is geen code die dat blokkeert en er is ook geen code die het
  dichterbij brengt.
- **Een franchisenemer die zijn eigen genres toevoegt.** De 74 genres zijn een
  gesloten lijst met een reden; een exploitant die er een bij mag zetten, zet een
  domeinbegrip bij in het huis van iemand anders.
- **`sovereign` als werkende modus.** Hij weigert vandaag mét de reden, en dat is
  de juiste stand tot een eigen domein, eigen sleutels en een eigen runtime
  werkelijk bestaan.

---

## 8. De grenzen die niet mogen sneuvelen

1. **Er komt geen `franchises`-tabel.** Een exploitant is een zaak met een
   hoedanigheid; wat hij mag is een projectie. Dezelfde grens als HDI.md par. 5.1
   (geen `humans`-tabel) en TRAVELCOMMERCE.md (geen `journeys`-tabel).
2. **Een afdracht over omzet bestaat niet zolang de invariant staat.** Wie er een
   bouwt, verandert de belofte aan álle partners — dus dat gebeurt bewust of
   niet (par. 4.1).
3. **Een exploitant is een KLANT en geen afdeling van RTG.** Dezelfde regel die
   `TRAVELCOMMERCE.md` voor een reisbureau trekt. Hij krijgt dus geen kantoordeur
   en geen kluis, hoeveel er ook op zijn gevel staat.
4. **Geen exploitant komt bij de identiteitskluis van een lid dat niet van hem
   is.** En bij het zijne alleen langs `kern/kantoor/kluispoort.js`, met een
   reden, een journaalregel en bericht aan de betrokkene.
5. **Een onbekend land krijgt nooit een Nederlandse tabel die erop lijkt.** Dat
   staat al in `rechtsvorm.js` en geldt hier overal: *wie daarop afgaat, gaat
   naar de verkeerde instantie.* Geen tarief, geen rechtsvorm, geen loonregel en
   geen leeftijdsgrens wordt geraden. Ontbreekt hij, dan zegt het scherm dat.
6. **Een getal zonder land is een fout, geen terugval.** De `|| 'NL'` van vandaag
   is verdedigbaar in een Nederlands huis en niet in een franchise. Waar hij
   blijft, staat erbij waarom.
7. **Het merk reist, de macht niet.** `TENANT.md` heeft dit al uitgevochten
   onder *"de kleur blijft binnen het eigen blok"*: de accentkleur van een klant
   raakt één regel — de merkbalk — en de kopbalk, de navigatie en de rest van de
   app blijven van RTG, *want een tenant die de hele app kan omverven, kan
   iemand laten denken dat hij ergens anders is dan hij is.* Bij een franchise
   geldt dat in beide richtingen: RTG verft niet mee in het blok van de
   exploitant, en de exploitant niet in dat van RTG.

---

## 9. Namen die al bezet zijn

Vóór er een begrip bij komt, is gemeten of de naam vrij is — dezelfde ronde als
in `MENSNETWERK.md` en `STAGE.md`, en drie van de vijf vielen af.

| naam | stand |
|---|---|
| `vestiging` | **bezet**, zwaar: 79 bestanden, 46 veldnamen (`kern/concern/vestiging.js`, `kern/mall/vestigingen.js`). Betekent een filiaal van één zaak. |
| `licentie` | **bezet**: 27 bestanden, 13 veldnamen — en met een andere betekenis (ODbL-kaartlicenties in `KAARTEN.md`, muziek, clips). Dat is een recht op MATERIAAL, niet op een merk. |
| `markt`, `gebied`, `regio` | **bezet** (`kern/markt/`, `KAARTEN.md`, de vijf fiscale regio's). |
| `exploitant` | **bijna vrij**: 4 bestanden, 0 veldnamen — maar in `kern/mobiliteit/` betekent het een vervoerder met een exploitantvergunning. Bruikbaar als hoedanigheid, niet als veldnaam zonder voorvoegsel. |
| `hoedanigheid` | **vrij en passend**: 4 bestanden, alle vier in `kern/vertegenwoordiging/`, met precies de betekenis die hier nodig is. |

---

## 10. De volgorde

De eerste twee regels kosten samen een paar dagen en maken de rest meetbaar; de
twee daaronder zijn besluiten van de eigenaar en blokkeren alles eronder.

1. **`npm run landdekking` in de keuring hangen** met een ratel die alleen omhoog
   mag op `landenVolledig` en alleen omlaag op `landenZonderEnige`. Zonder ratel
   is een dekkingsgetal een momentopname.
2. **De fiscale jaargang voor Nederland.** Repareert de thuismarkt, en bewijst
   de vorm waarmee elk volgend land erbij komt.
3. **Besluit 4.1** — benoemde dienst of invariant openzetten. Hier hangt de hele
   commerciële kant aan.
4. **Besluit 4.3** — de kluisweg per land afgrenzen. Dit is de enige blokkade
   die vandaag al een echt risico is: één gedeelde kantoorcode over meerdere
   landen. De vergunningskant (4.2) hoeft hier niet bij, en dat is de
   geruststellende uitkomst van dit document: die is al beslist, staat op een
   grendel, en een franchise die binnen optie A blijft raakt hem niet.
5. Daarna pas: de hoedanigheid, de wereldrelatie voor de afdracht, en per land
   de loon- en rechtsvormpakketten.

Wat er tot die tijd níét gebeurt, is een franchisescherm bouwen. `EXECUTIE.md`
blok 9 houdt de commandbalk op precies deze grond tegen — *bewust niet gebouwd,
en dit is waarom*, met als slotsom **eerst die twee getallen bewegen, dan de
balk.** Hier zijn die twee getallen `landenVolledig` en het besluit uit par. 4.1.
Een scherm dat een macht toont die het systeem nog niet kan definiëren, is erger
dan geen scherm.
