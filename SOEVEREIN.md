# RTG Soeverein — het netwerk van cellen, en wat ervoor moet wijken

*Richtingsdocument boven `FRANCHISE.md`. Dat document beantwoordde de vraag
"kunnen wij dit franchisen"; dit beantwoordt de vraag die de eigenaar daarna
stelde: **niet franchisen maar een soeverein netwerk** — Amsterdam houdt merk,
IP, software, standaarden en de machine, en een ondernemer in Spanje, Turkije of
de VAE krijgt een eigen economisch en operationeel domein waarin hij zoveel
mogelijk zelfstandig handelt. Opgesteld 15 september 2026, na de meting van
`SOEVEREIN.json`.*

---

## 0. De kern

De dragende belofte van het voorstel is niet een toegangsregel maar een
isolatie-eigenschap:

> Een medewerker in Ibiza **kan technisch niet eens vragen** om Nederlandse
> ledengegevens. Niet *"hij mag het niet bekijken"* maar *"voor zijn identiteit
> bestaat die datawereld niet."*

Die belofte hoeft niet gebouwd te worden. **Hij staat al**, in
`server/kern/isolatie/` — met de semantiek die hem afdwingbaar maakt:

> De samenvoeging is een **JOIN** en geen keuze: de strengste eis van alle
> dragers geldt, en een lagere drager kan een hogere nooit neutraliseren.
> (`kern/isolatie/dragers.js`, SEC-LOCK-003)

Maar hij reikt vandaag niet tot de partij die hem nodig heeft, en dat is
gemeten. Twee getallen dragen dit hele document:

**De ladder telt <!--getal:soeverein.dragers-->6<!--/getal--> dragers waarvan er
<!--getal:soeverein.metSleutel-->4<!--/getal--> bij een lopend verzoek werkelijk een sleutel dragen — en
van de drie toegangswegen weegt er precies één mee.** De ledenpoort zet
`req.session`; de leverancierpoort en de kantoorpoort niet. Een buitenlandse
exploitant **is** een zaak. De isolatielaag raakt hem dus vandaag niet, en
`huis` evenmin: waar `req.session` ontbreekt, weegt géén enkele drager mee.

---

## 1. De meting

`npm run soeverein` (`SOEVEREIN.json`) meet vier dingen die nooit worden
opgeteld — een ladder met een gat, een weg zonder isolatie en een bezette naam
zijn drie soorten probleem, en een gemiddelde ervan stuurt niemand ergens heen.

### 1.1 De ladder

| drager | sleutel bij een verzoek |
|---|---|
| `huis` | ja |
| `organisatie` | **nee** |
| `identiteit` | ja |
| `sessie` | ja |
| `apparaat` | ja |
| `workload` | **nee** |

`land` en `locatie` — de twee sporten die het voorstel nodig heeft — **bestaan
niet**.

En let op waaróm `organisatie` geen sleutel heeft, want dat staat al
uitgeschreven in `kern/isolatie/dragers.js` en het is geen ontbrekend stukje
werk maar een **besluit**: een ledensessie draagt geen organisatiecode, de
zaaksessie die er wél een draagt bereikt deze laag niet, en iemand die bij twee
organisaties werkt zou de strengste van de twee over zijn hele sessie krijgen —
*de join kent geen wereld*. Dat laatste is precies het probleem dat een
land-drager moet oplossen, en het is al een keer opgeschreven door iemand die
het niet over landen had.

### 1.2 Het bereik

`kern/isolatie/sessiedragers.js` leest `req.session`. Gemeten op de toekenning:

- **ledenpoort** (`opzet/diensten2.js`) — zet hem; weegt mee
- **leverancierpoort** (`opzet/leverancierpoort.js`) — zet `req.supplier` en
  `req.actor`, nooit `req.session`; **weegt niet mee**
- **kantoorpoort** (`kern/kantoor/kluispoort.js`) — **weegt niet mee**

De ledenpoort weigert bovendien met zoveel woorden een leverancier- of
kantoorsessie. Dit is dus geen omissie die je even aansluit: het is een
architectuurgrens die bewust zo ligt, en die voor een soeverein netwerk moet
verschuiven.

De graad hiervan is **vermoed** en niet gemeten: de toekenning wordt lexicaal
herkend. Een poort die `req.session` via een helper zet, wordt gemist. Het is
dus een ondergrens op *"weegt niet mee"*, en de harde weg is een verzoek met een
zaaksessie door `sessiedragers.js` halen en tellen wat eruit komt.

### 1.3 De naamruimte

Van de vijftien begrippen die het voorstel meebrengt is er **één vrij**:
`soeverein`. De rest draagt al betekenis — `capability` in 141 bestanden,
`schaduw` in 89, `mandaat` in 62, `cel` in 45.

### 1.4 De bouwstenen

<!--getal:soeverein.stenen-->19<!--/getal--> van <!--getal:soeverein.stenenGenoemd-->19<!--/getal--> genoemde
bouwstenen **bestaan al** als bestand. Dat is geen dekkingsoordeel en de meter
zegt dat er hardop bij: elke steen draagt `dektVoorstel: 'onbepaald'`. De
digitale tweeling bestaat en gaat over het **huis**, niet over een onderneming;
schaduwdraaien bestaat en draait op **beleidsregels**, niet op een
settlement-engine. Wat de meting wél hard maakt, is dat het werk **aansluiten**
is en niet uitvinden.

---

## 2. Drie naamcorrecties die niet mogen verwateren

**`sovereign` is bezet, en het is een WEIGERING.** `kern/tenant/register.js`
kent twee modi (`powered`, `private`) en geeft op `sovereign` een 400 met een
reden die woordelijk beschrijft wat dit voorstel wil:

> *De modus "sovereign" belooft een eigen domein, eigen sleutels en een eigen
> runtime. Dit huis heeft geen externe hosting, geen certificaat-machinerie voor
> domeinen van derden en geen routering op hostnaam. Eerst het besluit OF wij
> extern gaan hosten, dan certificaten, dan routering op hostnaam, en pas dan
> deze modus.*

Die volgorde is geen detail: wie de laag `sovereign` noemt terwijl de modus
`sovereign` weigert, heeft twee dingen met dezelfde naam waarvan er één niet
bestaat. Het Nederlandse **`soeverein`** is vrij (nul treffers) en is in dit
huis ook de natuurlijke keuze — de kernbegrippen heten hier `kluis`, `poort`,
`envelop`, `drager`.

**`cel` is bezet door de App Store.** `kern/appstore/uitgifte.js` draagt
`cel: { naam: … }` — de naamloze sandbox zonder netwerk waarin derdencode
draait. Een *country cell* zou een tweede betekenis zijn op de centrale naam van
een veiligheidslaag; dat is exact de `VERMOGENS`-botsing.

**En er is geen nieuw woord nodig.** Dit huis heeft er al een voor precies dit
begrip: **drager**. Het komt 414 keer voor en altijd in dezelfde vorm — *wie
draagt X* (`dragersVanVerzoek`, `dragersVanSessie`, `dragersoort`). Een
land-realm is dus geen nieuw type maar een **zevende drager**, en een locatie
een achtste.

---

## 3. De vorm: twee sporten erbij, geen nieuwe laag

De realm-ladder uit het voorstel (`GLOBAL → COUNTRY → ORG → LOCATION → USER →
SESSION → CAPABILITY`) is de bestaande dragerladder met twee sporten erbij:

| voorstel | bestaat als |
|---|---|
| GLOBAL | `huis` |
| COUNTRY | **ontbreekt** |
| ORGANISATION | `organisatie` (zonder sleutel) |
| LOCATION | **ontbreekt** |
| USER | `identiteit` |
| SESSION | `sessie` |
| CAPABILITY | `kern/stuur/mandaat.js` — een mandaat **versmalt** bestaand vermogen en verleent er nooit; leeg is dicht; verval is berekend |

Er komt dus **geen tweede rechtenmodel** en **geen `realms`-tabel**. Dat is
dezelfde grens die `FRANCHISE.md` voor de `franchises`-tabel trekt en die dit
huis al vier keer gemeten heeft.

Eén correctie op een bestaand document terwijl we hier toch zijn: `CLAUDE.md`
zegt dat `kern/stuur/mandaat.js` **nul productie-aanroepers** heeft. Dat klopt
niet meer — er zijn er **zeven** (`stuur/plafond.js`, `kantoor/geldketen.js` en
`-/klaarzet.js`, `service/machtiging.js`, en drie in `vertegenwoordiging/`). De
capability-grammatica is dus geen ongebruikte vorm meer.

---

## 4. De drie besluiten van de eigenaar (15 september 2026)

### 4.1 `npm run landdekking` gaat aan de keuring

**Genomen.** Niet omdat 189 landen moeten werken, maar omdat internationale
gereedheid niet ongemerkt achteruit mag gaan. De gate eist niet dat landen
compleet zijn; hij eist dat **de waarheid niet slechter wordt**:
`landenVolledig` alleen omhoog, `landenZonderEnige` alleen omlaag.

### 4.2 De vergoeding wordt een vijfde benoemde dienst

**Genomen: de 0%-invariant gaat NIET open.** Die invariant is meer dan een
prijsinstelling geworden; hij is onderdeel van het economische karakter van RTG,
en wie hem voor één geval openbreekt, laat die uitzondering later overal
doorlekken.

Er komt dus een expliciete klasse **`RTG_OPERATING_SERVICE`** naast de vier
bestaande benoemde diensten in `kern/commercie/vergoeding.js` — merkgebruik,
software, security, wereldwijde infrastructuur, AI, support, training,
compliance tooling en country services. De scheiding blijft daarmee scherp:

    transactiecommissie      = 0%   (invariant, geen instelling)
    operationele infrastructuur = expliciet geprijsde dienst

**Wat hier bewust nog NIET staat is de grondslag en het percentage.** De vier
bestaande diensten dragen alle vier `overOmzet: false` en zijn per transactie of
eenmalig; een terugkerende vergoeding is er geen van. Of de basis de bruto
klantomzet is of de bijdragebasis ná doorbelaste derden — en welk percentage
daarop hoort — is een economisch besluit dat apart wordt doorgerekend en niet in
een code-klasse thuishoort. `commissieVoor()` blijft voor elke zaak 0
teruggeven; deze dienst loopt niet langs die functie maar als **relatie tussen
twee economische werelden** (`kern/economie/firewall.js`: standaard geweigerd,
en een relatie bestaat alleen met een grondslag **én** een plafond).

### 4.3 De gedeelde `OFFICE_CODE` verdwijnt vóór internationale uitvoering

**Genomen, en als blokkerende architectuurregel:**

> **Geen cross-country operationele uitrol zolang een lokale medewerker via
> gedeelde geheimen bij een andere landendrager kan komen.**

Niet per land kopiëren naar `OFFICE_CODE_ES`, `OFFICE_CODE_TR` — dat
vermenigvuldigt dezelfde fout. De richting is `identiteit → drager → mandaat →
capability`: een medewerker krijgt geen *"toegang tot kantoor"* maar
bijvoorbeeld `bookings.read`, `customers.read`, `refunds.execute ≤ € 2.500` en
`staff.schedule`, met Nederlandse gegevens simpelweg buiten scope.

---

## 5. De grenzen die niet mogen sneuvelen

1. **Er komt geen `realms`-tabel en geen `franchises`-tabel.** Een exploitant is
   een zaak met een hoedanigheid; een land is een drager; wat iemand mag is een
   mandaat dat versmalt.
2. **Een lagere drager kan een hogere nooit neutraliseren.** SEC-LOCK-003. Wie
   "de fijnste drager wint" bouwt, geeft een aanvaller met één sessie de sleutel
   om een huisbreed incident weg te zetten.
3. **De 0%-commissie blijft een invariant**, geen instelling en geen beginstand.
4. **Geen samengesteld soevereiniteitscijfer.** Een `FRANCHISE READINESS: 81%`
   botst met INT-04 en met wat `ISOLATIEPROEF.json` over zichzelf vastlegt.
   Readiness is een **lijst blokkades** en een **stand** (`GO_LIVE: BLOCKED`),
   nooit een gemiddelde. `test/soeverein.test.js` handhaaft dat.
5. **`KNOWN → MODELED → EXECUTABLE → CERTIFIED` wordt geen vijfde ladder** maar
   de as-indeling van `LANDDEKKING.json`. Dit huis heeft er al vier of vijf
   (bewijsgraden, `GEZAGSNOEMER.json` met 5 schalen en 21 treden,
   vervalstaten, schaduwmodi, de acht uitkomsten van `CONTROLPLANE.md`), en
   `AFSPRAAK.md` zegt met zoveel woorden: geen zesde zekerheidsladder. De
   landdekking onderscheidt vandaag al **kennis** (≈ KNOWN) van **uitvoering**
   (≈ EXECUTABLE); wat eraan toegevoegd moet worden zijn MODELED en CERTIFIED,
   als assen en niet als graden.
6. **Een meeteenheid is nooit de mens.** Een `FOUNDER DEPENDENCY`-maat mag over
   PROCESSEN gaan en nooit per medewerker — ook niet intern als sorteersleutel.

---

## 6. De volgorde

1. **`npm run landdekking` in `npm run check`** (besluit 4.1).
2. **`RTG_OPERATING_SERVICE`** als vijfde benoemde dienst (besluit 4.2), met de
   grondslag en het percentage als apart economisch besluit.
3. **`OFFICE_CODE` uitfaseren** naar drager/capability-toegang (besluit 4.3).
4. **Nederland naar een echte fiscale jaargang** (`nl-2026.json`).
5. **De landdekking uitbreiden** van acht assen naar kennis / model / uitvoering
   / certificering / **isolatie** / **herstel**.
6. **Pas daarna** een echte buitenlandse operator toelaten.

En daarnaast één meter die **nog niet bestaat** en die hier met opzet zonder
commando staat — een document dat een `npm run` noemt die niet bestaat, laat
iemand denken dat hij zelf iets fout doet (keuringsregel 67 ving dat hier
prompt). Werknaam **landenisolatie**: hij probeert bewust fout te handelen, met
échte sessies en échte routes —

    ES-medewerker → NL-klant lezen        DENY
    ES-medewerker → ES-klant lezen        ALLOW
    ES-manager    → globaal beleid zetten DENY
    ES-eigenaar   → eigen personeel       ALLOW
    ES-eigenaar   → NL-settlement zien    DENY

Is die niet groen, dan is RTG niet internationaal klaar — hoeveel fiscale kennis
er ook in `landen.js` staat. Let bij het bouwen op wat par. 1.2 meet: met de
zaakweg buiten de isolatielaag zou zo'n proef vandaag op de verkeerde grond
groen kunnen staan, en dat is erger dan rood.
