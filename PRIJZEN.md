# PRIJZEN.md — de commerciële architectuur van RTG

*Besluit van de eigenaar, 20 augustus 2026. Dit document vervangt geen enkele
prijs die ergens los stond; het maakt er één ladder van en zegt per bedrag
waaróm het dat bedrag is. `GELD.md` gaat over geld als besturingssysteem voor
het lid, dit document over wat RTG vraagt en waarvoor.*

**`COMMERCIE.md` is de architectuur onder dit document** — de Commercial Core:
zeven lagen, drie prijsmechanismen, en het onderscheid dat alles bij elkaar
houdt (catalogusprijs ≠ contractprijs ≠ factuurbedrag). Lees die als je aan de
structuur werkt; dit document als je een bedrag zoekt.

**Leesstatus, 12 november 2026:** §0–6 beschrijven het bestaande besluit en de
historische doorlichting; sommige uitvoeringsnotities zijn inmiddels verouderd.
§7 bevat het **nieuwe eigenaarsbesluit over prijzen en jaarbetaling voor Travel
& Lifestyle**, met nog uit te werken serviceprofielen en conceptvoorwaarden.
De oude bedragen in §0–6 zijn niet de nieuwe commerciële prijsbasis. De huidige
runtime-ladder in `server/kern/pasladder.js`, getekende contracten en publieke
voorwaarden zijn hiermee nog niet gewijzigd; migratie en verkoopvrijgave staan open.
Ook de historische universele nulcommissie in §0–6 is niet het nieuwe beleid:
voor ondernemers geldt de expliciete commissiematrix van §9.3.
§8 werkt de bijbehorende dienstverlening en automatische klantlus uit als
voorstel, met menselijke beslispoorten en concrete aansluitingsvragen.
§9 bevat het aanvullende eigenaarsbesluit over gratis zakelijke deelname
(Salon, verkopen en eigen klantenbestand): 15% commissie voor gratis ondernemers,
ook bij een betaalde koper; betaalde ondernemers betalen 5% bij gratis leden en
0% bij betaalde leden binnen de afgesproken dekking. Dit beperkt expliciet de
eerdere nulcommissiebelofte. §9.3 is op uitdrukkelijke opdracht van de eigenaar
definitief vastgesteld als intern commercieel beleid, inclusief grondslag-, btw-,
providerkosten- en correctieprincipes, met concrete reisrollen en Stripe als
bestaande providerkeuze. De reisuitwerking betreft RTG's eigen aangeboden en
samengestelde reizen: daarvoor draagt RTG verantwoordelijkheid. Zelfstandig bij
andere reisbureaus geboekte reizen vallen buiten deze verkoop-/afrekenketen.
Deze vaststelling bewijst geen partneracceptatie, fiscale dossierbeoordeling of
providercontract; productgrens naar Lite en runtime-aansluiting blijven open.

## 0. De kern, in een zin

> Prijs = toegang + verbruik + verantwoordelijkheid.

Drie soorten geld, en meer zijn het er niet:

1. **Toegang** — het abonnement. Een vast bedrag per maand.
2. **Verbruik** — AI, betaaldienst en echte doorbelaste kosten (sms, post,
   hardware). Een meting, nooit een tarief dat je verzint.
3. **Verantwoordelijkheid** — wat een mens op zich neemt. Dat is de reden dat
   de twee bovenste treden contractueel zijn en geen prijskaartje dragen.

Elke nieuwe prijs hoort bij precies één van die drie. Hoort hij bij geen enkele,
dan hoort hij hier niet.

**Nooit alles "commissie" noemen.** Vier posten, vier namen, en op de factuur
staan ze los: `abonnement`, `ai-verbruik`, `betaaldienst`, `doorbelast`. Een
ondernemer die zijn rekening leest, hoort precies te kunnen zeggen welke post
waardoor is opgelopen.

## 1. De ladder

| Trede | Prijs | Voor wie | Daarbovenop |
|---|---|---|---|
| RTG Community | € 0 | de maatschappelijke laag; de minimale ingang tot het RTG OS | niets |
| RTG Pass | € 65 p/m | de consument | AI boven de bundel |
| RTG Business Lite | € 150 p/m | zzp en klein MKB | AI + betaaldienst |
| RTG Business Pass | vanaf € 5.000 p/m | grotere organisaties | contractueel |
| RTG Lifestyle Pass | vanaf € 20.000 p/m | high-touch, concierge, volledige regie | contractueel |

Alle bedragen ex 21% btw. Van elke bijdrage gaat 30% (ex btw) naar de
RTFoundation: 20% blijft lokaal, 10% gaat naar de stichting zelf.

**Waarom er een trede bij moest.** Tussen € 65 en € 20.000 zat niets. Een zzp'er
of een restaurant met acht man viel daarmee tussen consument en enterprise in, en
dat is precies de klant die MARKT.md als ingang aanwijst. Business Lite maakt de
sprong bovendien vérdedigbaar: € 150 is software-as-a-service, € 5.000 is een
relatie met een mens erachter. Zonder die tussentrede is de sprong van € 65 naar
€ 5.000 niet uit te leggen, en een prijs die je niet kunt uitleggen is een prijs
waarover onderhandeld wordt.

**Business Lite: veel software, geen twintig modules.** Voor € 150 krijgt een
onderneming de standaard-capabilities die bij haar bedrijfstype horen, support,
updates, beveiliging, basisautomatisering en een inbegrepen AI-budget. Drie
dingen zijn variabel en verder niets: AI-verbruik, betalingen en echte externe
kosten. Dus: **€ 150 platform + werkelijk AI-meerverbruik + betaaldienstkosten.**

**En vooral: geen omzetcommissie.** Een zaak die € 100.000 omzet via RTG betaalt
€ 150 platform, plus wat zij werkelijk verbruikt. Dat is de propositie tegenover
platformen die met de omzet meegroeien — Thuisbezorgd rekent 12 tot 15% als de
zaak zelf bezorgt en 25 tot 35% met bezorging (MARKT.md, met bronnen). Bij
€ 15.000 bezorgomzet per maand is dat ruim € 2.100 tegenover € 150.

## 2. De zes regels die hard staan

| # | Regel | Waar hij wordt afgedwongen |
|---|---|---|
| 1 | Er is precies **één** gratis abonnement | `kern/pasladder.js` → `gratisTreden()`; `test/pasladder.test.js` 1 |
| 2 | Business Lite kost minimaal **€ 150** p/m | `bodemCenten`; toets 3 |
| 3 | Business kost minimaal **€ 5.000** p/m | `bodemCenten`; toets 3 |
| 4 | Lifestyle kost minimaal **€ 20.000** p/m | `bodemCenten`; toets 3 |
| 5 | AI boven de inbegrepen capaciteit vraagt een bundel, expliciete toestemming of een vooraf ingestelde aanvulling | `kern/commercie/tegoed.js`; `test/tegoed.test.js` 4–7 |
| 6 | Geen abonnement veroorzaakt ooit **ongemerkt** variabele kosten | idem; automatisch aanvullen zónder maandmaximum wordt geweigerd (toets 6) |

Regel 5 en 6 stonden hier tot 20 augustus 2026 als **niet afgedwongen**, en dat
was eerlijk: de laag bestond niet. Nu bestaat hij. "Ongemerkt" is het sleutelwoord
van regel 6 — het gaat er niet om *dat* er kosten zijn, maar dat een klant ze
nooit ontdekt nadat ze zijn gemaakt. Vandaar dat `mag()` vooraf antwoordt en niet
achteraf meldt, en dat het antwoord bij een plafond niet "nee" is maar "nee, en
dit kun je doen".

### Een bodem is geen prijs

De scherpste regel van dit document, en hij komt uit een fout die hier écht is
gemaakt: `lid.js` had `{ business: 7500 }` hard staan en zette 7500 × 1,21 =
**€ 9.075 op de factuur van een lid** — een bedrag dat nergens was afgesproken.

Een bodem heeft daarom precies twee taken: **invoer weigeren** die eronder ligt,
en op een prijslijst als "vanaf" verschijnen. Hij mag nooit op een factuur
belanden. Vandaar dat `maandCentenVoor` voor een contractuele trede `null` geeft
en niet de bodem: `null` betekent "hier is nog niets afgesproken", en dat is een
antwoord. Nul zou "gratis" betekenen, de bodem zou "we hebben € 5.000
afgesproken" betekenen — allebei een leugen op een rekening.
`test/pasladder.test.js` toets 5 bewaakt dat.

### De contractprijs woont bij het besluit

Business en Lifestyle hebben geen lijstprijs, dus **accepteren kan niet zonder
afgesproken maandbedrag** (`kern/aanmeldingen/besluit.js`). Dat is hetzelfde
principe als bij de ondernemersbijdrage — aanzetten vraagt een naam én een
percentage — en om dezelfde reden: een lidmaatschap dat loopt zonder afgesproken
prijs is geen coulance maar een administratie die niemand kan sluiten. Het
betaalschema neemt dat bedrag over; het contractbedrag wint altijd van de
lijstprijs én van de bodem.

## 3. Wat een klant nog meer betaalt

| Post | Tarief | Van wie | Waar |
|---|---|---|---|
| Betaaldienst (RTG Pay, kassa) | € 0,10 + 1% per transactie | de zaak, direct verrekend | `kern/geldregie.js`, `kern/pay/kassa.js` |
| Partnervergoeding over omzet | **0% — en dat is geen instelling** | niemand | `kern/commercie/vergoeding.js` |
| RTG-ledenvoordeel per genre | 0–50%, RTG legt bij | het lid krijgt, RTG betaalt | `kern/commercie/subsidie.js` |
| Bijdrage partnerkanaal (gast) | max 5% over de **service**, nooit over de netto reissom | de partner | `kern/onderneming/regie.js` |
| Partner-entree | **geen** — een partnerplek hoort bij een zakelijk abonnement | — | `kern/commercie/capaciteiten.js` |
| AI boven het inbegrepen tegoed | een bundel, na een keuze vooraf | het lid of de zaak | `kern/commercie/tegoed.js` |

De partnervergoeding staat er als nul omdat dat een eigenschap van het product
is: er is geen knop meer die hem kan verzetten (COMMERCIE.md §3). De
betaaldienst is de enige post in deze tabel die geld van een partner naar RTG
beweegt, en die heet nadrukkelijk geen commissie — zie §4.3, dat nog open staat.

## 4. De open gaten

Gevonden bij de doorlichting van 20 augustus 2026. Op volgorde van hoe hard ze
bijten, niet van hoe makkelijk ze zijn.

### 4.1 ~~"0% commissie" staat in de voorwaarden, en er is een commissieknop~~ — GESLOTEN

*Opgelost op 20 augustus 2026: de generieke commissie is verdwenen, de
partnervergoeding over omzet is nul als eigenschap van het product
(`kern/commercie/vergoeding.js`), en wat RTG wél in rekening kan brengen valt
onder vier benoemde soorten waarvan er geen enkele over omzet gaat. Zie
COMMERCIE.md §3. Wat er was:*

`partnervoorwaarden.html` art. 1: *"RTG rekent geen commissie, geen
transactiekosten en geen licentiekosten over uw omzet via de app of de kassa."*
Tegelijk:

- `kern/geldregie.js` kent een partnervergoeding per genre en per zaak, standaard
  12%, tot 30%, instelbaar vanuit de boardroom;
- de seed geeft zaken een `rate` tussen 0,03 en 0,16;
- `kern/supplierdefaults.js` zet 0,12 op elke zaak zonder tarief.

Twee schermen zeggen intussen hard **0%**: `routes/supplier/financien.js:38`
(`'RTG-commissie', euroTekst(0)`) en `routes/supplier/backoffice.js:91` ("RTG
rekent 0% commissie: deze omzet is volledig van u").

**Het besluit:** de knop is verdwenen en 0% is echt. Met de ladder is dat ook
het enige coherente: Business Lite verkoopt zich juist op *geen* omzetcommissie.
`test/commercie.test.js` 1–3 dwingt het af, en de twee schermen die hard "€ 0,00"
printten hebben nu gelijk.

### 4.2 ~~En op één plek wordt die commissie wél afgetrokken~~ — GESLOTEN

*Opgelost: `commissiePct()` in Thuis leest nu `vergoeding.PARTNER_COMMISSIE` en
geeft nul; de eigen terugval van 10% en de "eerste huis"-berekening zijn weg.
`test/commercie.test.js` 4 en `test/thuiszakelijk.test.js` bewaken het. Wat er
was:*

`kern/thuis/zakelijk.js:125`: `commissie = excl × pct`, en `nettoUitbetaling =
excl − commissie`, met de tekst *"de zaak betaalt de gewone partnercommissie van
X%"*. Dat is de enige plek waar het tarief geld verplaatst.

Erger: de terugval daar is **10%** (`const pct = mijn.length ? commissiePct(mijn[0]) : 10`),
terwijl overal elders 12% de standaard is — precies het kopieprobleem waarvoor
`kern/pasprijs.js` is gemaakt. En het neemt het tarief van het **eerste huis** en
past dat toe op alle omzet.

### 4.3 ~~De betaaldienstkosten gaan naar RTG, en de voorwaarden noemen ze niet~~ — GESLOTEN

*Opgelost op 20 augustus 2026. Het tarief blijft (€ 0,10 + 1%), maar de
partnervoorwaarden noemen RTG nu expliciet als betaaldienstverlener, met de
grondslag erbij en met de vaststelling dat afrekenen via RTG Pay niet verplicht
is; artikel 1 beloofde "geen transactiekosten" en is herschreven. Het bedrag
staat niet hard in het document maar komt uit `/api/betaaldiensttarief`. En het
stille foutpad is weg: `kern/commercie/fee.js` legt de vergoeding vast vóór de
boekpoging, zodat een mislukte boeking een openstaande post achterlaat in plaats
van een nul. `test/betaaldienstfee.test.js`, vijf mutaties vijf raak — waarvan
M1 letterlijk de oude bug is. Wat er was:*

`kern/pay/kassa.js:59-63` boekt per kassabetaling € 0,10 + 1% van de
partnerrekening naar **`rtg:betaaldienst`**. Dat is inkomsten van RTG uit een
partner. Art. 3 van de partnervoorwaarden laat "de reguliere kosten van de
betaaldienstverlener" toe — maar nergens staat dat RTG die betaaldienstverlener
ís, en nergens staat het tarief. De enige plek waar een partner het ziet is de
kassabon (`leverancier.js:6821`).

Daarnaast een echt defect: `if (kb.error) kosten = 0;` — mislukt de kostenboeking,
dan worden de kosten stilzwijgend nul in plaats van dat de transactie het meldt.

**Wat er nog niet is:** een automatische herkansingsronde. Een mislukte boeking
staat nu zichtbaar op HERKANSING in `kostenOpen`, maar er is niemand die hem
oppakt — dat blijft mensenwerk tot die ronde er is.

### 4.4 ~~Het ledenvoordeel wordt getoond maar door niemand betaald~~ — GESLOTEN

*Opgelost op de rekenkant: alle vier de bedragen worden vastgelegd met de
invariant `lid + RTG === bruto === zaak` (`kern/commercie/subsidie.js`), en
`betaalRekeningVoor` rapporteert niet langer `subtotaal + fooi` als betaald
bedrag terwijl er twee kortingen af waren. `test/commercie.test.js` 5–9, vijf
mutaties, vijf raak. En sinds de commerciële ronde (`kern/commercie/ronde.js`)
wordt die verplichting ook opgepakt: RTG boekt het bedrag naar de zaak, en een
opbouw die onderweg is aangepast wordt afgekeurd in plaats van uitbetaald. Wat er
was:*

De belofte is *"RTG legt bij, dus de zaak houdt het volle bedrag"*
(`kern/geldregie.js`). In de code wordt `regieKorting` alleen **geschreven en
getoond** (`lidacties/betalen.js:41`, `lidacties/rekening.js:55`,
`app-main-20.js:96`). Er is geen boeking die geld van RTG naar de zaak beweegt.
In `betaalRekeningVoor` is het bedrag dat als betaald wordt gerapporteerd
bovendien `subtotaal + fooi` — de korting gaat er aan geen van beide kanten af.

`test/geldregie.test.js` toets 3 dekt dit niet af: die controleert dat
`order.total` 22 blijft en dat `regieKorting` 2,20 is — precies de twee velden
die ook kloppen als er niets gebeurt.

### 4.5 ~~Er is geen maand 13~~ — GESLOTEN

*Opgelost: `kern/commercie/contract.js`. De billing engine vraagt per datum of er
een geldige betalingsverplichting is, in plaats van twaalf termijnen klaar te
zetten. Maand 13 bestaat als het contract verlengd is en niet als het is
opgezegd. `price_lock_until` maakt het besluit hard: een prijswijziging raakt een
lopend contract niet. Wat er was:*

`kern/aanmeldingen/betaalschema.js` zet twaalf termijnen en stopt. De voorwaarden
zeggen "minimaal 12 maanden (jaarcontract)". Er is geen verlenging, geen
opzegging, geen opzegtermijn en geen prijswijzigings- of indexatieclausule.

Dat laatste bijt nu al: `test/pasprijs.test.js` toets 6 bewaakt dat een
prijswijziging in de boardroom **overal** doorkomt — ook op de factuur van een
lid dat een jaarcontract heeft. Voor de RTG Pass is dat een consumentenkwestie.

### 4.6 ~~De entree van € 10.000 bestaat alleen op papier~~ — INGETROKKEN

*De entree, de jaarlijkse contributie en de doorbelasting "zonder maximum" zijn
uit de partnervoorwaarden gehaald. Wat overblijft is het abonnement: een
partnerplek hoort bij RTG Business Lite of de Business Pass, en dat bedrag komt
live uit de ladder in plaats van als los getal in het document te staan.
Founding-partners betalen dat abonnement niet zolang hun afspraak loopt.
`test/commercie.test.js` 13 bewaakt dat het document geen entree meer noemt. Wat
er was:*

Founding-partners betalen niets; wie later toetreedt betaalt € 10.000 eenmalig,
€ 500 per jaar en een doorbelasting van de werkelijke onderhoudskosten "zonder
maximum". Er is geen founding-vlag, geen sluitingsdatum, geen factuur en geen
code — nul treffers buiten het voorwaardendocument. LAUNCH.md noemt dit zelf als
openstaand punt, inclusief de waarschuwing dat een open kostenclausule b2b wel
mag maar gespecificeerd moet zijn om afdwingbaar te blijven.

### 4.7 ~~De omzetstaat telt de contractprijzen niet mee~~ — GESLOTEN

*De omzetstaat leest nu de contracten: voor een contractuele trede is de omzet de
**som van wat er werkelijk is afgesproken**, geen lijstprijs maal een aantal en
geen schatting. Een geëindigd of nog niet getekend contract telt niet mee. Leden
op zo'n trede zónder lopend contract staan apart als `zonderContract` — stil uit
het totaal vallen is precies hoe een omzetstaat compleet lijkt terwijl hij het
niet is. `test/ledenregister.test.js` toetst beide kanten. Wat er was:*

Sinds deze ladder zijn Business én Lifestyle contractueel, dus `ledenregister.js`
laat ze uit `totaalOmzet` en toont ze als `opMaat` met hun aantal. Dat is het
eerlijke antwoord (de staat leest de accountlaag, niet de aanmeldingen), maar het
betekent dat RTG's belangrijkste omzetgetal per definitie onvolledig is.

**Wat er eerst nodig is:** het contractbedrag van een lid bereikbaar maken vanuit
de accountlaag, niet alleen vanuit de aanmelding waar het besluit viel.

### 4.8 ~~De 20/10-splitsing is nergens onderbouwd~~ — GESLOTEN

*Opgelost: `kern/commercie/allocatie.js`. Elk deel draagt een `waarom`,
`regelKlopt()` weigert een deel zonder uitleg of een verdeling die niet optelt,
en elk bedrag draagt de regelversie waarmee het is gerekend. Publiek te lezen op
`/api/sociaalbeleid`. Wat er was:*

De 30% splitst in 20% lokaal en 10% de stichting zelf. De enige plek waar
*waarom* staat is `GAMEHALL.md` §12.5 — over de spelwereld. De publieke
voorwaarden noemen alleen de 30%. Wie "lokaal" is en waar dat geld landt, staat
nergens; `RTF_IBAN` is één rekening.

### 4.9 De 30% wordt geboekt maar niet betaald — **alles gebouwd, wacht op een rekening**

*Elke afdracht draagt nu bron, verdeling, regelversie, bestemmingen en vier
tijdstempels, en een teruggedraaide bijdrage laat geen afdracht achter. Daarmee
is de 30% aantoonbaar — wat MARKT.md eist zodra hij in marketing staat. De
ronde maakt een afdracht bovendien **betaalbaar** zodra `RTF_IBAN` er is, en het
overmaken loopt daarna via `kern/fonds.js` en de betaalopdracht. Wat ontbreekt is
dus geen code meer maar een bankrekening: zonder die variabele blijft de rij
eerlijk op GERESERVEERD staan. De claim staat daarom als GEBOUWD en niet als
AFGEDWONGEN — een bewering die op een lege omgevingsvariabele wacht, is niet
afgedwongen (`/api/claims`).*

Zonder `RTF_IBAN` blijft de afdracht op `te_storten` (TAKEN.md 2.6). MARKT.md
waarschuwt dat de 30% een handelspraktijk wordt zodra hij in marketing staat —
aantoonbaar te maken, ANBI te overwegen, jaarlijks te verantwoorden. Hij staat nu
in de publieke voorwaarden.

### 4.10 ~~Btw is overal 21%, hard~~ — GESLOTEN

*Opgelost: `kern/commercie/btw.js` met profielen (NL 21/9, EU verlegd, buiten de
EU, ES 21/10). `fonds.js` en `lid/facturen.js` rekenen er nu mee; zonder profiel
geldt NL 21% — hetzelfde antwoord als vroeger, maar als expliciete standaard in
plaats van als enige mogelijkheid. Een contract draagt een `btwProfiel` dat
iemand heeft gekozen; deze laag leidt het niet af uit een landcode, want waar een
dienst belastbaar is, is een juridische vraag. Wat er was:*

`* 1.21` staat vast in `kern/fonds.js` en `kern/lid/facturen.js`, terwijl het
platform landen kent (`LANDEN`, `logiesBtw` per land) en leden internationaal
zijn. Een Lifestyle-lid buiten Nederland krijgt nu 21% Nederlandse btw.

### 4.11 ~~De ledenprijsgarantie kapt af, maar zet niets recht~~ — GESLOTEN

*Opgelost: `kern/commercie/prijsmelding.js` plus de routes. Het lid meldt, de
zaak erkent of betwist, het kantoor komt erbij als het vastloopt. Het bedrag ligt
vast op het moment van melden — wie het bij het rechtzetten mag meegeven, kan een
verschil van 3 euro voor 999 euro rechtzetten. Er wordt niets automatisch
beoordeeld en niets automatisch overgemaakt; dat is een besluit, geen omissie.
Wat er was:*

Het plafond is echt gebouwd: de ledenprijs wordt server-side afgekapt op de
publieke prijs, zowel bij het opslaan van de menukaart als bij het bestellen
(`kern/util.js`, `routes/supplier/menukaart.js`, `lidacties/bestellen.js`,
`test/partner.test.js:154`). Maar de belofte in de voorwaarden gaat verder:
*"meld het via de app: de partner past de prijs aan en het verschil wordt voor u
rechtgezet."* Er is geen meldknop en geen terugbetaalstroom.

### 4.12 De hoogte van de bedragen, teruggerekend — GEDEELTELIJK

*Hieronder staat wat er nu wél is terug te rekenen. Wat blijft ontbreken is de
loonkant van Lifestyle: een menselijke concierge is een salaris, en dat staat
nergens tegenover de € 20.000. Dat is geen som die code kan maken.*

**Wat een lid moet dekken.** De vaste lasten uit `docs/rapport-testen-en-kosten.md`:
~€ 10–15 per maand voor een pilot, € 120–200 voor een serieuze start, € 1.500–5.000
op mega-schaal. Bij € 65 per maand ex btw houdt RTG na de 30% sociale afdracht
€ 45,50 over. Dat betekent: **drie tot vijf RTG Passen dekken de pilot-infra, en
drie tot vijf dekken ook de serieuze start** — die stap kost € 120–200 en drie
leden brengen € 136,50 op. De variabele kant is de AI, en die is nu begrensd per
trede (`kern/commercie/tegoed.js`) in plaats van open.

**Waarom € 150 voor Business Lite.** Een kassasysteem kost in de praktijk € 35–150
per maand en de gangbare stapel is drie of vier abonnementen (MARKT.md, met
bronnen). € 150 zit aan de bovenkant van één zo'n abonnement en onder de stapel
die het vervangt. De vergelijking die telt is niet het kassasysteem maar de
commissie: bij € 15.000 bezorgomzet betaalt een zaak ruim € 2.100 per maand aan
een bezorgplatform.

**Waarom de sprong naar € 5.000 verdedigbaar is.** Business Lite is
software-as-a-service; Business is een enterprise-relatie met governance, SLA en
een vaste contactpersoon (`kern/commercie/capaciteiten.js` maakt dat verschil
hard). Zonder de tussentrede was de sprong van € 65 naar € 5.000 niet uit te
leggen, en een prijs die je niet kunt uitleggen is een prijs waarover
onderhandeld wordt.

**Wat er niet is teruggerekend:**

De kostenkant staat er wel (`docs/rapport-testen-en-kosten.md`: ~€ 10–15 p/m
pilot, € 120–200 serieuze start, AI variabel). Wat er niet staat: hoeveel leden
bij € 65 die vaste lasten dekken, en wat een Lifestyle Pass van € 240.000 per
jaar per lid moet leveren — de menselijke concierge is loonkosten, en die staan
nergens tegenover de prijs. De enige onderbouwing die in code leeft is de *vorm*
(ex btw, 30% eraf), niet de hoogte.

MARKT.md sluit zelf af met: *"Wat dit document niet weet: de prijs die RTG gaat
vragen."* Business Lite à € 150 is het eerste antwoord daarop.

## 5. Wat hierna gebouwd moet worden

### 5.1 De AI-tegoedlaag (regels 5 en 6)

Het model dat vastligt maar nog niet bestaat:

    abonnement → inbegrepen plafond → bundel → eventueel automatisch aanvullen

Intern rekenen in echte modelkosten, tokens en compute. **Extern nooit tokens
tonen** — niet *"nog 1.293.582 tokens"* maar *"AI-tegoed deze maand: 72%
gebruikt."*

Bij het plafond drie standen, en de keuze is van de eigenaar van de zaak:

1. **Stoppen bij de limiet** — er worden geen extra kosten gemaakt.
2. **Vraag mij eerst** — melding bij 80% en 100%, met een bundel binnen handbereik.
3. **Automatisch aanvullen** — één gekozen bundel zodra het tegoed op is, met een
   maandmaximum.

Die derde is er voor bedrijven: een restaurant hoort niet op vrijdagavond te
ontdekken dat de menukaartvertaling stilstaat.

**Een klant koopt capaciteit, geen model.** Bundels heten AI Extra S/M/L en AI
Enterprise, en nergens staat welk model erachter draait. Zo kan een beter of
goedkoper model erin zonder dat er een contract opengebroken hoeft te worden.

De verkoopprijs van een bundel wordt niet gekozen maar gerekend:
`inkoopkosten → veiligheidsmarge → platformmarge → verkoopprijs`, met per bundel
vastgelegd: credits, verkoopprijs, geldigheidsduur, modelcategorieën, kostprijs,
minimummarge, gekocht op, verbruikt, verloopt op.

### 5.2 AI-budget als onderdeel van de rechtenlaag

Niet een losse meter maar een verdeling binnen het bestaande regiesysteem:
medewerkers samen maximaal X, finance Y, marketing Z; dure acties alleen na
toestemming; Rahul altijd voorrang; automatisch bijkopen tot maximaal € X per
maand. Voor Business dieper: organisatie → afdeling → team → gebruiker →
capability, zodat een CFO kan zien waaróm de AI € 1.847 kostte.

### 5.3 De Business Lite-pas zelf

De prijs is besloten, de pas bestaat nog niet: `beschikbaar: false` in de ladder.
Uitrollen raakt de toegangsregels (`kern/aanmeldingen.js`), de stem per pas
(je/u en de toon), de functieschakelaars per pas, en de 77 bestanden die een
pas-id noemen. `test/pasladder.test.js` toets 9 valt om zodra iemand hem
beschikbaar zet zonder de rest te bouwen — dat is de bedoeling.

### 5.4 Twee naamsbesluiten die nog open staan

- De gratis trede heet in code `gratis` ("Gratis app"). "RTG Foundation" als
  productnaam zou botsen met de RTFoundation, de stichting die de 30% ontvangt.
  Twee dingen die "Foundation" heten en niets met elkaar te maken hebben, is een
  verwarring die je nooit meer terugdraait.
- De publieke voorwaarden noemen Business Lite bewust nog niet: daar hoort te
  staan wat je kunt kopen.

## 6. Wat dit document niet is

Geen juridisch of fiscaal advies. Drie dingen moeten voor livegang door iemand
met een bevoegdheid worden bekeken, en ze staan ook in LAUNCH.md: het
betaaldiensttarief en de betaalstructuur (§4.3), de open kostenclausule van de
partner-entree (§4.6), en de hardheid van de 30%-belofte zodra die in marketing
staat (§4.9).

## 7. Travel & Lifestyle — prijsbesluit en conceptvoorwaarden

*12 november 2026. Status: PRIJSBESLUIT VASTGELEGD, NIET VERKOOPKLAAR.
De eigenaar heeft de basisprijzen in §7.3 vastgesteld. Serviceprofielen,
upgradeprijzen, overige conceptvoorwaarden en implementatie zijn nog niet
goedgekeurd. De gekozen bedragen zijn geen gemeten marktgemiddelden of bewezen
rendabele tarieven; de marktankers hieronder blijven een beperkte vergelijking.*

**Aanvullend eigenaarsbesluit in deze bespreking: betaalde passen worden
jaarabonnementen.** Dat vervangt het eerste concept van maandlidmaatschappen.
Ook besloten: keuze tussen twaalf maandtermijnen en één jaarlijkse vooruitbetaling;
bij vooruitbetaling **een halve maand korting**. Dus twaalf maanden dienstverlening
voor 11,5 maandprijzen: 4,1667% korting op het gespreide jaartotaal. De prijskeuze
is geen toestemming om liveprijzen of bestaande overeenkomsten automatisch om
te zetten, en stelt nog geen inbegrepen uren, gebruikersaantallen of SLA vast.

### 7.1 De commerciële keuze

RTG Travel & Lifestyle is de commerciële voordeur: reizen, lifestyle en zakelijk.
De 114 capabilities ondersteunen die dienstverlening. Er komt geen zesde pas,
tweede prijscatalogus of nieuw platform naast de Commercial Core.

De eigenaar heeft de richting gekozen: gratis consumenten kunnen via een vooraf
afgesproken leverancierscommissie worden bediend; bij betaalde consumenten houdt
RTG geen verkoopcommissie op gedekte opdrachten, **behalve bij een gratis
ondernemer als verkoper**. Volgens het aanvullende expliciete besluit in §9.3
betaalt die ondernemer 15% commissie, ook bij een betaald RTG-lid als koper.
Betaalde ondernemers betalen 5% bij gratis leden en 0% bij betaalde leden binnen
de afgesproken dekking. De matrix in §9.3 is leidend voor deze verkopen via RTG.
Waar commissie daadwerkelijk vervalt, wordt de vrijvallende vergoeding
**per partner afgesproken: betere marge en/of ledenvoordeel**. Deze richting is
nog niet als nieuwe commissie- of abonnementsregel geïmplementeerd.

**Aanvullend eigenaarsbesluit: gratis leden moeten voor RTG zelfstandig
winstgevend zijn.** Het gratis segment is geen verliesproduct dat door betaalde
abonnementen moet worden gefinancierd. Toets dit op cohorten, inclusief leden die
niets boeken, en met alle toerekenbare kosten; niet als onhoudbare garantie dat
ieder afzonderlijk gratis account geld oplevert. Gratis moet al veel kunnen.
Vooraf begrensde kostbare AI en vrijwillig gekozen extra's mogen de economie
ondersteunen, maar geen onverwachte rekening of blokkade van verplichte nazorg.

De richting: gratis waardevol meedoen, betalen voor blijvende digitale waarde
en het vastgestelde commissievoordeel binnen zijn reikwijdte, méér betalen voor
aantoonbare menselijke dienstverlening. Alle treden houden behoorlijke veiligheid, toegankelijkheid en
ondersteuning bij fouten. Een goedkoper abonnement is geen minder veilige
uitvoering van dezelfde boeking.

### 7.2 Marktankers, gecontroleerd op 12 november 2026

| Officiële bron | Gepubliceerde prijs | Wat de vergelijking wel en niet zegt |
|---|---|---|
| [D-reizen](https://service.d-reizen.nl/hc/nl/articles/9125825439004-Wat-zijn-boekingskosten) | €34,50 per boeking via adviseur; zelf online €0; btw niet afzonderlijk genoemd | Standaard menselijke boekingsservice, niet doorlopende concierge. Leverancierskosten kunnen bijkomen; deze bron bewijst geen commissievrij model. |
| [Travel Store](https://www.travelstore.nl/voorwaarden/) | €67,50 service incl. btw + €27,50 ANVR-post; beide vervallen bij zelf online boeken | Samen €95 aan deze basisposten, met overige toepasselijke posten daarnaast. Niet verwarren met uitsluitend €67,50 of een abonnement. |
| [Con Questa](https://con-questa.com/) | Pioneer €400 excl. btw per maand; Extraordinary €695 excl. btw per maand | Doorlopende persoonlijke lifestyle-service; kantooruren respectievelijk 24/7. Niet dezelfde inbegrepen capaciteit als RTG; geen claim van prijs- of kwaliteitsgelijkheid. |
| [Perk, onderdeel Reizen](https://www.perk.com/nl/abonnementen/) | €0 / €99 / €299 per maand plus 5% / 3% / 3% per boeking; boekingsfee min. €2, max. €30 | Zakelijk reisbeheer; niet de aparte tarieven per actieve declaratiegebruiker op dezelfde pagina. Belastingen en looptijd volgen de [servicevoorwaarden](https://www.perk.com/legal-uploads/service-terms/en/current.pdf) en offerte. |
| [Booking.com for Business](https://business.booking.com/pricing/) | Geen abonnement-, boekings- of beheerkosten; leverancierscommissie als verdienmodel | Een betaald abonnement alleen om als bedrijf te mogen boeken is moeilijk te verdedigen. Gratis toegang is geen onbeperkte persoonlijke concierge. |

Afleiding: onderscheid toegang, standaardboekingsservice en persoonlijk maatwerk.
Deze steekproef onderbouwt die structuur, niet de marktconformiteit of rendabiliteit
van de gekozen RTG-prijzen. Vooral €14.000 inclusief btw per maand voor Lifestyle
vraagt een afzonderlijk, aantoonbaar waardevol serviceprofiel; de genoemde gewone
concierge-abonnementen bewijzen die positionering niet. Geen ongefundeerde
besparingspercentages, "goedkoper dan iedereen" of vaste terugverdientijd op de
website zetten.

### 7.3 Vastgestelde prijsbasis; serviceprofielen nog uit te werken

Consumentenbedragen zijn **inclusief btw**; zakelijke bedragen **exclusief btw**.
Voor het rekenvoorbeeld geldt 21% Nederlandse btw op het lidmaatschap, niet
automatisch op reizen, commissies of buitenlandse diensten.

| Bestaande pas | Maandtermijn bij jaarcontract | Jaartotaal gespreid | Jaar vooruit met korting | Positionering en besluitgrens |
|---|---:|---:|---:|---|
| RTG Community (`gratis`) | €0 | €0 | €0 | Reizen/lifestyle, dossier en ondersteuning bij eigen boekingen. Ook gratis zakelijke basis voor Salon, productverkoop en eigen klantenbeheer; de gratis ondernemer betaalt 15% commissie, ook bij een betaalde koper (§9.3). Over de daar vastgelegde grondslag; werkelijke providerkosten afzonderlijk zichtbaar. |
| RTG Pass (`rtg`) | €65 incl. btw | €780 incl. btw | €747,50 incl. btw | Consumentenpas met premium digitale mogelijkheden en €0 RTG-verkoopcommissie op gedekte opdrachten, behalve de verkoperscommissie van gratis ondernemers (§9.3); uitbreidbaar met afzonderlijk gekozen upgrades. Bundels en eventuele menselijke service nog vast te stellen. |
| RTG Business Lite (`business-lite`) | €150 excl. btw | €1.800 excl. btw | €1.725 excl. btw | Voor zzp/mkb; premium ondernemerstools en reis-/lifestyledienstverlening, uitbreidbaar met afzonderlijk gekozen upgrades. Als verkoper 5% commissie bij gratis leden en 0% bij betaalde leden binnen de dekking (§9.3). Gebruikersdekking en bundels nog uit te werken. |
| RTG Business Pass (`business`) | vanaf €3.500 excl. btw | vanaf €42.000 excl. btw | vanaf €40.250 excl. btw | Zakelijke dienstverlening op overeengekomen scope, met mogelijke upgrades. De bodem is geen offerte of factuur; servicecapaciteit en verantwoordelijkheid moeten bij de werkelijk overeengekomen prijs passen. |
| RTG Lifestyle Pass (`lifestyle`) | €14.000 incl. btw | €168.000 incl. btw | €161.000 incl. btw | Hoogwaardige persoonlijke reis- en lifestyledienstverlening met €0 RTG-verkoopcommissie op gedekte opdrachten, behalve de verkoperscommissie van gratis ondernemers (§9.3). Vast basisbedrag, niet "vanaf"; concreet serviceprofiel en personeelsdekking nog vast te stellen. |

Bij ieder aanbod staan **jaarprijs, twaalf maanden eerste looptijd, betaalwijze
en opzeg-/verlengingsregel** naast elkaar. "€65 per maand" mag niet zelfstandig
de indruk van een maandelijks opzegbaar abonnement wekken. Jaarlijks betalen
verlaagt alleen de prijs, niet de twaalf maanden afgesproken dienstverlening.
De korting is €32,50 voor RTG Pass, €75 voor Business Lite, vanaf €1.750 voor
Business en €7.000 voor Lifestyle, telkens op dezelfde btw-basis als de tabel.
Voor Business wordt 11,5 maal de **overeengekomen** maandbasis gebruikt, niet
automatisch 11,5 maal de bodem. Eventuele upgrades zijn nog niet geprijsd en
vallen niet stilzwijgend onder deze basistarieven of kortingsafspraak.

De consumentenpas is persoonsgebonden. Huishoudelijke reisdekking staat in §7.5;
een gezin krijgt niet automatisch meerdere concierge-abonnementen. Voor zakelijke
passen worden entiteiten, gebruikers, integraties en verantwoordelijkheden vooraf
in het aanbod benoemd. Het eerdere voorstel van maximaal 50 gebruikers is niet
vastgesteld en wordt niet stilzwijgend onderdeel van dit prijsbesluit.

Lifestyle en Business blijven onder menselijke toelating vallen. Een aanbod
wordt pas een contractprijs na acceptatie; een contractuele bodem wordt nooit
automatisch een factuur. De eerdere voorstellen van €29 / €399 / €499 en de
daaraan verbonden twee of drie concierge-uren worden vervangen, niet bij deze
nieuwe prijzen hergebruikt. Dit besluit belooft evenmin onbeperkte uitvoering,
een exclusief volledig team, 24/7-service of kosteloze externe aankopen.
De volledige 114-capability-premiumscope blijft bestaan; alleen aantoonbaar
beschikbare functies mogen onderdeel van een verkoopbaar aanbod worden genoemd.

**Eigenaarsbesluit gratis zakelijke instap: €0 abonnement plus 15% commissie.** Ondernemers moeten
Salon, producten verkopen en een eigen klantenbestand kunnen gebruiken zonder
Business Lite te kopen. Dit vervangt het eerdere voorstel van uitsluitend een
beperkte partnerrelatie; zie §9 voor basis en voorgestelde upgradegrens.
Opdrachtgever, leverancier en verwijzer blijven afzonderlijke rollen, zonder
verplichte exclusiviteit. Geen tweede gratis pas of alle Business Lite-rechten.
Toelating tot gereguleerde werkzaamheden blijft afzonderlijk gecontroleerd.
De huidige betaalde partnerpoort en productrechten zijn nog niet aangepast.
De gratis ondernemer betaalt 15% commissie over afgesproken verkopen via
RTG, ook aan betaalde leden (§9.3). Betaalde ondernemers betalen 5% bij gratis
leden en 0% bij betaalde leden binnen de dekking. Percentages en de commerciële
berekeningsregels in §9.3 zijn besloten; contractacceptatie en uitvoering niet.
Providerkosten blijven afzonderlijk zichtbaar.

**Upgrades:** de eigenaar kiest uitbreidbaarheid voor RTG Pass, Business Lite
en Business. Mogelijke categorieën om uit te werken zijn extra AI-capaciteit,
opslag, zakelijke gebruikers/integraties en aanvullende persoonlijke uitvoering;
dit zijn nog geen vastgestelde pakketten of rechten. Per upgrade moeten inhoud,
vaste of gemeten prijs, maximum, looptijd, btw, eventuele korting en beëindiging
vooraf vaststaan. Geen automatisch oplopende rekening of verplichte upgrade om
een reeds verkochte basisbelofte waar te maken. Voor Lifestyle is geen afzonderlijk
upgradebesluit genomen. Geen nieuwe pas of tweede prijscatalogus invoeren.

**Los maatwerk en meerwerk:** tarieven nog vast te stellen. De eerdere uurprijzen
zijn geen onderdeel van het eigenaarsbesluit. Bij voorkeur een vooraf gekozen
dossierprijs met omschreven resultaat en maximum. Zonder lidmaatschap een
reisaanvraag doen blijft mogelijk; een losse serviceopdracht is geen betaald
lidmaatschap en verandert de commissieregel niet ongemerkt.

### 7.4 Service moet begrijpelijk en begrensd zijn

- **Standaardboekingen:** normale verwerking, noodzakelijke handmatige controle,
  bevestiging en verplichte nazorg zijn geen optioneel meerwerk. Bij betaalde
  leden komt er geen verplichte RTG-boekingsfee boven op de afgesproken basis.
  De verkoperscommissie van §9.3 is geen extra boekingsfee voor het lid. Wat RTG
  intern handmatig moet doen, is geen reden om de klant achteraf extra te belasten.
- **Maatwerk:** bijvoorbeeld uitgebreid reisontwerp, meerdere leveranciers
  onderhandelen, een evenement organiseren of extra varianten uitwerken. Eerst
  scope, capaciteit, oplevering en maximale prijs laten accepteren. Gratis leden
  krijgen evenmin onbeperkt onbetaald maatwerk beloofd.
- **Capaciteit:** onderzoek, afstemming en klantgevraagde maatwerkwijzigingen
  tellen als actieve uitvoering; wachten op een provider, intern opleiden en
  RTG-fouten herstellen niet. Werkelijke tijd per dossier, geen afronding van
  ieder bericht naar een minimumblok. Eerst een raming; bij 80% waarschuwen;
  aanvullend werk pas na akkoord. Geen onbekende "fair use"-grens achteraf.
- **Inbegrepen uitvoering en meenemen:** uren, dossiercapaciteit, beschikbaarheid
  en eventuele overdracht van ongebruikte capaciteit moeten per pas opnieuw
  worden ontworpen en begroot. De eerdere maxima van 4/6 meegenomen uren vervallen
  als voorstel; er ontstaat geen onbeperkt opgespaard recht. Gereserveerde
  uitvoering en toekomstige nazorg blijven kostenverplichtingen in de planning.
- **Bereikbaarheid:** kantooruren, reactietijden, urgentieklassen, vervanging en
  eventuele beschikbaarheid buiten kantooruren nog per serviceprofiel vaststellen.
  Een reactietijd is geen providerbevestiging. Alleen publiceren zodra de
  bijbehorende personeelsbezetting en continuïteit aantoonbaar geregeld zijn.
- **Noodhulp en herstel:** noodzakelijke bijstand bij verkochte reizen, wettelijke
  verplichtingen en herstel van eigen fouten vallen niet weg bij een lege bundel.
  Per boeking een werkende escalatieroute; waar de reisrol dat vereist ook buiten
  kantooruren. Geen "24/7 persoonlijk team" verkopen zonder organisatie en bewijs.

Het lid koopt continuïteit, aanspreekbaarheid en uitvoering, niet slechts uren.
Die meerwaarde moet in de Premium Experience Gate worden getest: begrijpt iemand
vooraf wat inbegrepen is, wanneer toestemming nodig is en wie een probleem oplost?

### 7.5 Commissieregels en rechthebbenden

**Gratis consument:** commissie bij een aantoonbaar via RTG bemiddelde order
waarvoor een partner vooraf schriftelijk een vergoeding heeft afgesproken.
**Gratis ondernemer:** 15% commissie over afgesproken verkopen via RTG,
ongeacht of de koper gratis of betaald lid is (§9.3). Dit is een expliciete
uitzondering op de eerdere nulcommissiebelofte aan betaalde kopers, geen tweede
commissie boven op dezelfde vergoeding. Geen algemene heffing op omzet buiten
RTG of toekomstige klantrelaties.
**Betaalde ondernemer:** 5% commissie bij gratis leden, 0% bij betaalde leden
binnen de afgesproken dekking. Alleen de afgesproken RTG-verkooproutes vallen
eronder; CRM-import of offline omzet veroorzaakt geen commissie. De behandeling
van eigen klanten binnen een specifieke route staat in de partnerbijlage. De percentages
zijn een eigenaarsbesluit, geen bewijs van marktconformiteit of gezonde marge
in iedere productgroep. De grondslagregels staan in §9.3.1. Toepasbare verkooproutes
vóór activering op nettomarge en contract toetsen; afwijkingen vragen een expliciet besluit.

De partnerbijlage benoemt minimaal: leverancier en rol, productgroep, bron van de
aanvraag, toepasselijk percentage uit §9.3, precieze grondslag en uitsluitingen, btw,
moment van verschuldigdheid, uitbetaling, annulering, deelrefund en betwisting.
Grondslag: verkoopwaarde exclusief vastgestelde btw na verkoperskorting, met de
uitsluitingen en reisrolregels uit §9.3.1; niet de winst na alle inkoopkosten.
Verschuldigdheidsmoment: over het aantoonbaar geleverde én betaald ontvangen
gedeelte, volgens §9.3. Een offerte, reservering of aanbetaling alleen is geen
verdiende commissie. De aparte annuleringsregel uit §9.3.4 blijft gelden;
refunds verlagen de grondslag. Geen geldige afspraak betekent geen commissieclaim.

**Betaalde koper, binnen de afgesproken dekking en buiten de gratis-verkoperuitzondering:**
RTG behoudt €0 ordergebonden verkoopcommissie, verborgen verkoopmarge
of aan die order toerekenbare bonus. Dit geldt ook als de vergoeding later of via
een verbonden partij binnenkomt. Niet te herleiden volumebeloningen moeten vóór
verkoop contractueel worden uitgesloten of met een controleerbare methode worden
toegerekend; "we weten het niet" rechtvaardigt geen bewezen nulclaim.

Alleen waar commissie vervalt, kan de partner het voordeel als marge behouden,
aan de klant geven of verdelen. De standaardcommissie van een gratis ondernemer
is daarentegen RTG-opbrengst en wordt niet wegens betaald koperschap teruggegeven.
Ontvangt RTG bij een daadwerkelijk commissievrije order toch commissie, dan wordt
die conform de vooraf vastgelegde verdeling
terugbetaald/verrekend met partner of klant, niet als eigen opbrengst behouden.
Een geboekte verrekening is nog geen uitgevoerde terugbetaling. Toon daarvoor
status en bewijs. Onafhankelijke distributiekosten van aanbieders kunnen blijven
bestaan; daarom geen claim "altijd inkoopprijs" of "altijd de goedkoopste".

**Wanneer geldt het recht?** Bij expliciete acceptatie van een geldige offerte
worden koper- en verkopersstatus, prijsversie, commissieregime, rechthebbenden en
partnerverdeling vastgelegd.
Providerbevestiging bepaalt daarna of de reservering echt bestaat. Vertraging bij
de provider maakt een al aanvaarde afspraak niet plots commissieplichtig. Een
gewijzigde offerte vraagt opnieuw akkoord; geen prijswijziging door alleen een
nieuwe cataloguswaarde in te lezen. Een latere gewone opzegging trekt het voordeel
op bestaande geaccepteerde opdrachten niet met terugwerkende kracht in.

Voorstel consumenten: de contracthouder plus maximaal één benoemde volwassen
huisgenoot en thuiswonende kinderen onder 18 kunnen samen in dezelfde privéorder
worden gedekt, mits de contracthouder zelf deelnemer/afnemer is. Geen afzonderlijke
concierge voor ieder gezinslid. Andere reisgenoten krijgen per toerekenbaar deel
hun eigen status. Bij ondeelbare groepsprijzen moet de verdeling vóór akkoord
uitlegbaar vaststaan, anders geen automatische commissieclaim. Relaties geven
geen automatische inzage of toestemming namens andere volwassenen.

Voorstel zakelijk: betaalde bedrijfsrechten gelden alleen voor opdrachten van de
contracterende entiteit, door bevoegde aanvragers en voor een zakelijk doel.
Werknemersprivéboekingen volgen hun eigen consumentenstatus. Een leverancier die
Business Lite betaalt, betaalt op de gedekte verkopen aan gratis leden 5% en
aan betaalde leden 0%. De dekking van eigen zakelijke aankopen, medewerkers en
entiteiten is een afzonderlijke vraag en blijft nog uit te werken.
Elke orderregel krijgt één verklaarbaar commissieregime op basis van beide rollen;
de gratis-verkoperregel gaat vóór het commissievoordeel van de betaalde koper.
Bij meerdere aanbieders worden de afzonderlijke regels niet tot één nulclaim
samengevoegd. Nooit twee keer dezelfde commissie rekenen.

Aanbevelingen worden niet op RTG-commissie geoptimaliseerd. Echte externe kosten
en afzonderlijke betaaldiensten blijven zichtbaar, maar zijn geen sluiproute om
verkoopcommissie anders te noemen. Het bestaande kassa-/Pay-tarief van €0,10 + 1%
wordt niet automatisch op reisboekingen geplakt; toepasselijkheid, kostprijs en
gereguleerde betaalrol vereisen een aparte controle binnen de bestaande Core.

### 7.6 Conceptvoorwaarden voor de klant

1. **Jaarlidmaatschap.** Eerste vaste looptijd twaalf maanden, zonder entree.
   Keuze: twaalf gelijke maandtermijnen, of vooruitbetalen met een halve
   maandprijs korting (11,5 maal de maandprijs). Beide leveren twaalf maanden
   dienstverlening. Gespreid betalen is niet maandelijks opzegbaar tijdens
   die eerste looptijd. Gewone opzegging kan direct worden doorgegeven, met einde
   op de eerste jaarvervaldatum; de einddatum wordt bevestigd. Wettelijke
   herroeping, ontbinding wegens tekortkoming en andere dwingende beëindigingsrechten
   blijven bestaan. Geen onvoorwaardelijke claim dat resterende termijnen altijd
   verschuldigd zijn. De vooruitbetaalkorting wordt vooraf vastgelegd en verlaagt
   niet de inbegrepen service. Bij een rechtmatige restitutie is de werkelijk
   betaalde prijs de grondslag; niet achteraf de korting terugpakken als boete.
   Voorgestelde verlenging na het eerste jaar: onbepaalde tijd, daarna uiterlijk
   één maand na ontvangst van de opzegging beëindigen; niet opnieuw stilzwijgend
   twaalf maanden vast. Een nieuwe vaste jaarperiode vraagt expliciet nieuw akkoord.
   Vooruitbetaalde bedragen voor de periode na een geldige einddatum naar rato
   terugbetalen; termijnincasso stopt op die datum, slotperiode zo nodig naar rato.
   Dit klantvriendelijke verlengingsmodel wordt ook zakelijk voorgesteld;
   afwijkende zakelijke maatwerkafspraken staan uitdrukkelijk in het contract.
2. **Bedenktijd.** Het online consumentenlidmaatschap krijgt de toepasselijke
   wettelijke bedenktijd, in beginsel 14 dagen. Direct starten alleen op
   uitdrukkelijk verzoek, met vooraf uitgelegde evenredige vergoeding waar
   wettelijk toegestaan. Activering is geen automatische volledige uitvoering.
   Opzeggen en herroepen krijgen afzonderlijke routes; de verplichte online
   herroepingsfunctie moet ook werken. Zie [ACM bedenktijd](https://www.acm.nl/nl/verkoop-aan-consumenten/klantenservice/bedenktijd).
3. **Boeking apart.** Een lidmaatschap opzeggen of herroepen annuleert niet
   vanzelf een reis. De toepasselijke reis-/leveranciersvoorwaarden en wettelijke
   rechten worden vóór akkoord getoond. Geen verborgen terugvordering van
   commissie als straf voor herroeping; de uitwerking daarvan eerst juridisch
   toetsen. Datumgebonden diensten vormen geen algemene vrijbrief om de
   bedenktijd van het abonnement uit te sluiten.
4. **Totaal vooraf.** Reissom, alle onvermijdbare kosten, toepasselijke belasting,
   werkelijk gekozen extra's, betaalmomenten en annuleringsregels staan vóór
   bevestiging bij elkaar. Geen vooraf aangevinkte opties. Consumenten zien
   bedragen inclusief btw en onvermijdbare kosten; zie [ACM prijzen](https://www.acm.nl/nl/verkoop-aan-consumenten/consumenten-informeren/prijzen-vermelden).
5. **Geen onverwacht meerwerk.** Een opdracht boven de inbegrepen capaciteit
   start alleen na akkoord op resultaat en maximumprijs. Annulering van een losse
   maatwerkopdracht wordt naar redelijke, vooraf kenbare en rechtmatige kosten
   afgehandeld; niet automatisch "nooit restitutie". Beroep op wettelijke rechten
   wordt niet als betaalde conciergehandeling geboekt.
6. **Lopende dossiers.** Opzegging stopt nieuwe lidmaatschapsdiensten na de
   einddatum, niet reeds aanvaarde boekings-, herstel- of terugbetalingsplichten.
   Vooraf gereserveerde uitvoering wordt afgerond volgens de dossierafspraak.
   Niet-gereserveerde ongebruikte uren vervallen bij het einde; gegevens blijven
   toegankelijk/exporteerbaar volgens bewaartermijnen en wettelijke rechten.
7. **Prijswijziging.** Geen wijziging van een getekende reisprijs door een nieuw
   abonnementstarief. De afgesproken jaarprijs blijft de eerste twaalf maanden
   vast. Voorstel vervolg: minimaal 30 dagen vooraf aankondigen, nooit binnen
   een lopende prijslock, en kosteloos kunnen opzeggen vóór ingang. Geen open
   eenzijdige wijzigingsclausule. Zie [ACM opzeggen](https://www.acm.nl/nl/verkoop-aan-consumenten/klantenservice/annuleren-en-opzeggen).
8. **Privacy en verantwoordelijkheid.** Alleen noodzakelijke gegevens naar de
   uitvoerende partij; werk en privé blijven gescheiden. Geen automatische
   marketingtoestemming, verplichte sociale publicatie of klantendatabaseovername.
   Een aanvraag is geen bevestigde reservering en betaling bewijst niet dat een
   leverancier de dienst heeft bevestigd.

Dit is een term sheet, geen volledig juridisch getoetste set algemene voorwaarden.
Contracterende RTG-entiteit, contact- en klachtenroute, geldstromen, aansprakelijkheid,
toepasselijk recht, toegankelijkheid en privacydocumenten moeten vóór verkoop
worden gekoppeld aan de werkelijk aangeboden dienst en checkout.

**Reisrechtelijke stopvoorwaarde:** RTG is niet door een tekstregel altijd alleen
bemiddelaar. De feitelijke combinatie en verkoop bepalen of sprake is van een
pakketreis of gekoppeld reisarrangement, ook bij afzonderlijke contracten.
Daarbij horen toepasselijke informatie, insolventiebescherming en bijstand.
Geen ANVR-/SGR-aansluiting of verzekering claimen zonder bewijs. Laat de daadwerkelijke
boekingsroutes beoordelen, niet alleen de tekst. Zie [Europese Commissie](https://europa.eu/youreurope/business/selling-in-eu/selling-goods-services/package-travel/index_nl.htm).

### 7.7 Financiële ondergrens — geen rendementsclaim

De bestaande 30%-verdeling over kwalificerende lidbijdragen exclusief btw blijft
behouden: 20% lokale impact en 10% stichting. Niet 30% over doorbetaalde reissommen.
Reserveren is niet hetzelfde als aantoonbaar afdragen. Btw-profiel en eligible
revenue worden per geldsoort gecontroleerd; extra servicefees niet stilzwijgend
anders classificeren om de maatschappelijke afspraak te ontwijken.

Indicatieve maandberekening bij betaling in maandtermijnen, afgerond op centen
bij iedere geldstap. De afzonderlijke vooruitbetaaltabel daaronder verwerkt de
halve maand korting; niet twaalf volledige maandbijdragen afdragen over een
lagere werkelijke omzet. Voor consumenten wordt hier 21% btw aangenomen.
Factuurafrondingen kunnen daarnaast centen verschillen. Business wordt voor
deze berekening op de bodem getoond, niet als vastgestelde contractprijs.

| Pas | Omzet ex btw per maand | 30% reservering | Rest vóór alle kosten |
|---|---:|---:|---:|
| RTG Pass | €53,72 | €16,12 | €37,60 |
| Business Lite | €150 | €45 | €105 |
| Business — vanaf | €3.500 | €1.050 | €2.450 |
| Lifestyle | €11.570,25 | €3.471,08 | €8.099,17 |

Bij **één jaar vooruitbetalen**, na korting en met dezelfde twaalf maanden service:

| Pas | Jaaromzet ex btw na korting | 30% reservering | Rest vóór alle jaarkosten |
|---|---:|---:|---:|
| RTG Pass | €617,77 | €185,33 | €432,44 |
| Business Lite | €1.725 | €517,50 | €1.207,50 |
| Business — vanaf | €40.250 | €12.075 | €28.175 |
| Lifestyle | €133.057,85 | €39.917,36 | €93.140,49 |

Deze restanten zijn **geen winst en geen vrij besteedbaar personeelsbudget**:
menselijke uitvoering, platform, AI, opslag, betaalverwerking, normale
boekingsondersteuning, incidenten, beschikbaarheidsbezetting en vervanging,
acquisitie, verzekering, restituties en overhead moeten er nog af. Het nieuwe
Lifestyle-tarief bewijst dus niet dat een exclusief team of 24/7-bezetting kan
worden geleverd. Daarvoor is eerst een eigen capaciteits- en kostentoets nodig.
Meerwerk vraagt dezelfde toets, inclusief de toepasselijke Foundation-behandeling.

De 20/10-deelbedragen en het bestaande expliciete afrondingsveld uit
`server/kern/commercie/allocatie/regels.js` blijven samen onderdeel van het bewijs.
Bij een RTG-maandtermijn is 30% €16,12, terwijl afzonderlijk afgeronde 20% (€10,74)
en 10% (€5,37) samen €16,11 zijn. De resterende cent mag bij afwikkeling niet
verdwijnen; gebruik de bestaande afrondingsroute, geen tweede verdeelmechanisme.
Lagere incasso-/financieringskosten door vooruitbetaling zijn mogelijke voordelen,
geen al bewezen dekking van de korting. Vooruitbetaling is geen onmiddellijk
vrije winst: de dienstverlening en mogelijke restituties moeten nog worden gedragen.

**Gratis moet op eigen benen staan.** Meet per gratis cohort en vaste meetperiode:
werkelijk verdiende partnervergoedingen na annuleringen en terugbetalingen, plus
opbrengst van vrijwillig gekozen extra's, minus de kosten van álle leden in dat
cohort. Daaronder vallen ook niet-boekers, AI, infrastructuur, opslag, support,
boekingsafhandeling, acquisitie, uitval en een transparant aandeel in gedeelde
kosten. Geen omzet uit betaalde passen toerekenen om gratis groen te verklaren.
Niet-gemeten kosten zijn onbekend, niet nul; verwachte toekomstige commissie is
nog geen gerealiseerde opbrengst. Naast positief resultaat moet de kasplanning
de tijd tussen servicekosten en werkelijke commissieontvangst kunnen dragen.

Dit is een te bewijzen bedrijfsnorm, geen constatering dat gratis al winstgevend
is. Gebruik de bestaande kostenvoorzieningen voor verbruiksmeting en begrenzing,
maar bewijs eerst dat alle relevante uitvoeringsroutes en kosten daarin echt
meelopen. Hun aanwezigheid bewijst nog geen sluitende kostenbeheersing. Stel
bundels vast op gemeten kosten, met vooraf zichtbare grenzen en zonder de
basisbelofte uit te hollen. Geen verkoop van persoonsgegevens, verborgen
commissiegestuurde aanbevelingen of onverwachte kosten als sluitpost.

Daarom nog geen openbare lancering van deze jaarprijzen zonder afzonderlijke
cohortproeven voor gratis en betaald: niet-boekers, eenmalige én frequente boekers,
standaard én herstelintensieve dossiers. Meet tijd, provideropbrengst, ledenvoordeel,
incasso-uitval, herroeping, acquisitie en toekomstige serviceverplichtingen.
Toets ook de situatie waarin frequente gratis boekers upgraden en commissie
binnen hun dekking vervalt; bij gratis verkopers blijft de standaardcommissie
bestaan. Gemiste commissie is geen boekhoudkundige kostenpost,
maar wel een relevante commerciële vergelijking. Als de kosten niet passen:
processen, aanbod of toekomstige prijs expliciet herzien, niet achteraf een
verborgen fee toevoegen of verliezen naar de andere groep verschuiven.

### 7.8 Conflicten met de huidige implementatie en afspraken

| Huidige bron | Wat vóór invoering expliciet moet veranderen |
|---|---|
| `server/kern/pasladder.js`, `pasprijs.js`, `test/pasladder.test.js` | De runtime bevat nog RTG €65 ex, Business vanaf €5.000 ex en Lifestyle vanaf €20.000 ex. Het nieuwe eigenaarsbesluit is RTG €65 incl, Business vanaf €3.500 ex en Lifestyle vast €14.000 incl; Business Lite blijft €150 ex. Consumentenbruto, zakelijke bodem en Lifestyle-basis correct modelleren en afronden; €65 incl is niet €65 ex. Serviceprofielen en implementatie zijn nog open. |
| `server/kern/commercie/contract.js`, aanmeldingen en publieke voorwaarden | De twaalfmaandsbasis blijft; nieuwe prijzen, betaalwijze, toelating, prijslock, wettelijke herroeping en opzegging na het eerste jaar moeten samen worden bewezen. Bestaande overeenkomsten niet automatisch omzetten. |
| `server/kern/commercie/capaciteiten.js`, partneraanmelding | Gratis zakelijke basis uit §9 is nog geen bestaand recht; scheiden van betaalde ondernemerssoftware zonder een tweede rechtenmodel. |
| `server/kern/commercie/vergoeding.js`, partnerkanaal, subsidies | Universele nulcommissie en de oude servicegrondslag passen niet bij de 15%/15%/5%/0%-matrix in §9.3. Tarief en afrekening expliciet modelleren; geen heffing op alle omzet buiten RTG. Bestaande `lid + RTG === bruto === zaak`-afspraken niet kapot salderen. |
| `test/mn03-commercieelvoordeel.test.js`, aanbevelingen | De oude aanname van geen commercieel belang moet vóór invoering worden vervangen door bewijs op het werkelijke keuzepad: commissiebelang zichtbaar, geen betaalde rangschikking verhullen of aanbeveling op commissie optimaliseren. Niet alleen de nultoets schrappen. |
| `public/apps/juridisch/voorwaarden.html` | Ex-btw consumentenprijzen, alleen abonnementsinkomsten, algemene nettoprijsclaims en automatische uitsluiting van pakketreizen passen niet bij dit voorstel. Jaarcontract blijft, maar opzegging, verlenging en herroeping moeten volledig worden uitgewerkt. Niet alleen nieuwe bedragen in oude zinnen zetten. |
| `public/apps/juridisch/partnervoorwaarden.html` | Algemene 0%-belofte, betaalde partnerpoort en verplichte Salonactiviteit moeten op rol en nieuwe afspraak worden beoordeeld. Geen wijziging van bestaande partnerrechten zonder akkoord. |

Bestaande ledenprijsgarantie, toegekende voordelen en getekende servicebeloften
blijven onder hun eigen contract geldig. Migratie alleen via controleerbaar nieuw
aanbod met expliciet akkoord waar nodig; behouden rechten en financiële gevolgen
staan erbij. Geen automatische downgrade van een bestaand intensief conciergecontract.

### 7.9 Besluiten en bewijs vóór verkoop

Besloten: de prijsbasis in §7.3; betaalde passen hebben een vaste eerste
jaarlooptijd met keuze tussen twaalf maandtermijnen en één vooruitbetaling met
een halve maand korting. RTG Pass, Business Lite en Business kunnen met gekozen
extra's worden uitgebreid. Gratis moet als cohort zelfstandig winstgevend zijn;
betaalde consumenten krijgen €0 RTG-verkoopcommissie op gedekte opdrachten,
behalve bij gratis ondernemers als verkoper. Die betalen 15% commissie,
ook bij een betaald RTG-lid als koper: de eerdere nulbelofte is expliciet beperkt.
Betaalde ondernemers betalen 5% bij gratis leden en 0% bij betaalde leden binnen
de afgesproken dekking (§9.3). Ook besloten: nettoverkoopgrondslag met benoemde
uitsluitingen, afzonderlijke btw op de RTG-dienst, werkelijke betaalkosten zonder
opslag, herstelkosten van RTG-fouten voor RTG, en correcties op de oorspronkelijke
order. Eigen RTG-reizen zijn RTG's verantwoordelijkheid; zelfstandig elders
geboekte reizen zijn niet automatisch RTG-verkoop, commissie of afhandeling.
Waar commissie vervalt, geldt partnergewijze verdeling van de vrijvallende
vergoeding. Ondernemers kunnen ook
zonder betaald abonnement starten met Salon, productverkoop en eigen klantenbeheer
volgens het aanvullende besluit in §9.

Nog goed te keuren: de concrete basisdienstverlening, AI-/opslagbundels,
servicegrenzen en bemensing per pas; upgradepakketten, tarieven en voorwaarden;
de precieze gratis zakelijke capaciteit en concrete gedekte verkooproutes;
huishoud-/gebruikersdekking; verlenging en migratie.
Nog in te vullen: ondertekende partnerbijlagen met de vastgestelde percentages,
toegepaste rol/grondslag en verdeling, onderbouwde belasting-/betaalrollen, personeelsdekking,
verzekeringen en vereiste reisbescherming. Deze laatste zaken zijn releaseblokkades,
geen voorwaarden die na de eerste boeking mogen worden uitgezocht.

Na besluit gebruiken we de bestaande Commercial Core, Authority, dossiers en
Proof-contracten. Minimaal bewijzen: gratis/paid en huishouden/gemengde groep;
bedrijf als leverancier versus opdrachtgever; acceptatie vóór providervertraging;
opzegging vóór vertrek en vóór/na de jaargrens; herroeping; jaarvooruitbetaling
en termijnincasso met correcte eindafrekening en behoud van de korting bij
rechtmatige restitutie; upgrade vóór/na boeking; gedeeltelijke refund;
later ontvangen bonus; afronding/btw/30%; geen dubbele fee; meerwerk weigeren;
opzeggen/herroepen met toetsenbord en schermlezer. De Premium Experience Gate
vraagt bovendien of nieuwe en ervaren gebruikers de totale prijs, dekking en
gevolgen vóór akkoord juist kunnen uitleggen.

**Uitvoeringsstatus van deze paragraaf:** het commerciële prijsbesluit is lokaal
vastgelegd; de overige voorstellen zijn als zodanig herkenbaar. Geen runtimeprijzen,
autorisaties, facturen, livevoorwaarden, providers of groene kwalificatiestatussen
aangepast. Geen verkoopmachtiging door dit document.

## 8. De volledige leden- en dienstverleningslus

*12 november 2026. Uitwerking op verzoek van de eigenaar: wat hoort bij welke
pas, meer klantwaarde, automatisch vanaf onboarding, met menselijke controle,
snel, veilig, efficiënt en bestand tegen verandering en misbruik. Status:
SERVICE- EN UITVOERINGSVOORSTEL. Prijzen en jaarbetaling in §7 zijn besloten;
nieuwe servicebeloften en capaciteit moeten nog worden begroot, vastgesteld,
gebouwd en gekwalificeerd.*

Geen nieuwe laag of catalogus: de vijf passen, 114 capabilities, Commercial
Core, Authority, Experience, Concierge, Service en Proof blijven eigenaar.
Dit is hun gezamenlijke klantlus, geen tweede contractmotor of completion-register.
`AFBOUWPROGRAMMA.md` blijft de scopebron; `APPWERKT.json` en
`EXPERIENCEWERKT.json` blijven de bronnen van kwalificatiebewijs.

### 8.1 Automatisch werk, menselijke besluitmacht

**De machine organiseert het werk; een bevoegde mens neemt de besluiten die
menselijk moeten blijven. Daarna voert het systeem exact het bevestigde werk uit.**
Niet ieder scherm vraagt een medewerker. De klant is ook een mens: niet iedere
klantbevestiging vraagt daarnaast een RTG-medewerker.

`AFBOUWPROGRAMMA.md` §1, `CONCIERGE.md` §3 en `AUTONOMIE.md` §2.9 blijven gelden:
geld verlaat het huis nooit vanzelf; boekingen, uitnodigingen en berichten aan
anderen worden klaargezet en door een mens bevestigd. Een abonnement of algemene
AI-toestemming is geen blanco betaal- of publicatiemachtiging. Ook refunds en
partneruitbetalingen blijven achter de toepasselijke poort.

Het ontwerp is **automatisch geregeld na passend akkoord**, niet een AI-besluit
waar eventueel achteraf iemand naar kijkt. Voor autonome afschrijvingen of
externe handelingen is eerst een afzonderlijk expliciet beleidsbesluit nodig;
deze uitwerking omzeilt de huidige grenzen niet.

### 8.2 Wat hoort bij welke pas — voorgestelde inbegrepen resultaten

| Bestaande pas | Wat de klant ermee gedaan krijgt | Menselijke uitvoering en grens |
|---|---|---|
| Gratis | Complete standaardreis-/lifestyle-opdracht met dossier en nazorg; bruikbare basisapps. Voor ondernemers ook Salon, producten verkopen en eigen klantenbestand beheren volgens §9. | Vereiste controles, uitzonderingen en probleemhulp. Geen doorlopend persoonlijk bureau of onbeperkte zware AI. Partnercommissie volgens §7.5; zelfstandig rendabel gratis cohort. |
| RTG Pass | Persoonlijke digitale regie: herbruikbare voorkeuren, toegestane agenda-/documentcontext, plandossiers, vertrekvoorbereiding en hervatten zonder opnieuw beginnen. Commissievrije gedekte opdrachten, behalve de verkoperscommissie van gratis ondernemers (§9.3). | Normale afhandeling en controles; persoonlijke maatwerkuitvoering als gekozen upgrade. Geen impliciete vaste uitvoerder, gratis externe aankopen of onbeperkte AI. |
| Business Lite | Standaardwerkomgeving voor zzp/mkb, passend bij het bedrijfstype: taken, planning, personeel en kassa waar toepasselijk; zakelijke aanvragen, goedkeuringen, reisdocumenten en kosten op de juiste opdracht. | De ondernemer houdt dagelijkse regie; RTG ondersteunt standaardinrichting en problemen met de verkochte dienst. Geen uitbestede bedrijfsvoering, enterprise-SLA of impliciete maatwerkintegraties. |
| Business | Beheerd zakelijk reis- en lifestyleprogramma: inrichting van afgesproken beleid, RTG-serviceverantwoordelijke met vervanging, leveranciersafstemming, dossierbewaking, verstoringen en controleerbare rapportage. Zakelijke tools en governance binnen overeengekomen scope. | RTG neemt afgesproken operationeel werk over; de onderneming behoudt besluitmacht en werkgeversverantwoordelijkheid. Geen exclusief volledig team of onbeperkte implementatie voor de bodemprijs. |
| Lifestyle | Persoonlijk reis- en lifestylekantoor: jaarplanning van wensen, complexe reizen, diners en gelegenheden, leveranciers, logistiek, documenten, voortgang en herstel. Eén aanspreekpunt met vervanging en passende specialistische ondersteuning. | Persoonlijke afstemming en uitvoering volgens een begroot serviceprofiel. Geen gegarandeerde toegang, exclusief voltijds team, 24/7-concierge, inbegrepen aankoopsommen of onbeperkt werk zonder dekking. |

Dit is niet de claim dat alle genoemde routes al beschikbaar zijn. Toewijzing
aan passen loopt na vaststelling via `server/kern/commercie/capaciteiten.js` en
bestaande domeinrechten. Een abonnement verleent geen beroepsbevoegdheid,
toegang tot andermans gegevens of tekenrecht voor een onderneming.
Geen automatische overerving: Business is niet onbeperkt Lifestyle voor iedere
medewerker; Lifestyle is geen zakelijke beheerdersrol. Bestaande rechten worden
niet stilzwijgend afgenomen.

Zakelijke aankoop- en huishouddekking, gebruikersaantallen,
bereikbaarheid, AI-/opslagbundels en menselijke capaciteit blijven expliciete
vaststellingspunten. De prijzen bepalen die niet vanzelf.

### 8.3 Meer waarde door samenhang

Voorstellen binnen bestaande capabilities, niet nog meer apps:

1. **Eenmalig vertellen, gericht hergebruiken.** Het lid ziet welke voorkeuren
   bekend zijn en waarvoor ze worden gebruikt. Werk, privé, gezinsleden en
   gevoelige informatie blijven gescheiden. Een oud gegeven wordt niet zomaar
   een actueel feit; bevestigen waar de handeling dat vereist.
2. **Eén overzicht van wat nog nodig is.** PersonalOS en het bestaande dossier
   tonen afspraken, ontbrekende stukken, open beslissingen en wie aan zet is.
   Geen twintig losse appmeldingen voor één reis.
3. **Voorbereid op de volgende stap.** Vertrekchecklist, toegestane agenda- en
   documentherinneringen, komende verlengingen en verlopen documenten. Een
   waarschuwing is geen visumadvies, toelatingsgarantie of nieuwe boeking.
   Externe verzending blijft onder de bestaande bevestigingsregel.
4. **Gevolgen vóór akkoord.** Totale kosten, verplichtingen, gegevensdeling,
   onzekerheden en herstelopties samen. Alleen gewijzigde onderdelen opnieuw
   beoordelen wanneer dat aantoonbaar voldoende is; geen oud akkoord op nieuwe
   gevolgen plakken.
5. **Een zakenstarter op de bestaande werkplek.** Business Lite kiest branche
   en eerste taak. RTG stelt inrichting/import voor, toont het proefresultaat
   en vraagt akkoord vóór activering. Geen heel klantenbestand verplicht
   importeren om een eerste zakelijke reis te organiseren.
6. **Een aantoonbaar waardeoverzicht.** Afgeronde dossiers, gebruikte service
   en werkelijk ontvangen voordelen. Tijdwinst alleen met passende nulmeting;
   geen fictieve advieswaarde of gegarandeerde terugverdientijd.
7. **Continuïteit zonder gegevensgevangenis.** Een lid kan volgens contractregels
   veranderen van pas of dienst; bestaande dossiers en herstelplichten blijven
   terugvindbaar. Export, intrekking en opzegging zijn volwaardige routes.

Voor Business en Lifestyle komt proactieve menselijke dienstverlening erbij:
periodiek doelen bespreken, voorstellen voorbereiden en afgesproken uitvoering
bewaken. Frequentie en capaciteit horen in het servicecontract, niet in een
onbegrensde marketingbelofte.

### 8.4 Van eerste bezoek tot einde contract

Iedere stap gebruikt de bestaande eigenaar en toestandstaal. Dit is geen nieuwe
gezamenlijke statusmachine voor alle domeinen.

| Stap | Automatisch werk | Menselijke controle/keuze en vereiste uitkomst |
|---|---|---|
| 1. Oriënteren | Bewezen beschikbaar aanbod, doelgroep en volledige prijs tonen; wensen helpen verhelderen. | Bezoeker kiest doel en pas; geen verborgen dure standaard. Bestaande publieke voordeur en Commercial Core. |
| 2. Account en intake | Alleen noodzakelijke gegevens vragen, valideren, veilig bewaren en onderbreking ondersteunen. Later benodigde informatie later vragen. | Gebruiker bevestigt gegevens, overeenkomst en afzonderlijke deelkeuzes. Account en versiegebonden intakebewijs via `accounts.js` en `onboarding/`. |
| 3. Identiteit en organisatie | Stukken, geldigheid, duplicaten en tegenstrijdigheden signaleren; bedrijfsrol, tekenrecht, vergunning en persoonsbewijs onderscheiden. | Voorgeschreven menselijke verificatie; Lifestyle/Business altijd menselijke toelating. Ingediend is niet geverifieerd. Bestaande aanmeldingen, verificaties en vakbewijs. |
| 4. Aanbod en overeenkomst | Prijs, jaartermijn, betaalkeuze, service, grenzen en gevolgen samenstellen; geaccepteerde versie bevriezen. | Klant tekent concreet aanbod; RTG keurt contractueel aanbod bevoegd goed. Contractbewijs in Commercial Core; geen bodem als factuur. |
| 5. Betaling en activering | Toegestane betaalstap voorbereiden, bronuitkomst controleren, actuele rechten afleiden en werkplek klaarzetten. | Betaler bevestigt vereiste handeling; toelatingsbesluit blijft nodig. Activering vereist geldige contract-/toelatings-/betaalvoorwaarden, geen screenshot als bewijs. |
| 6. Eerste resultaat | Branche-/taaksjabloon, conceptreis of inrichting voorbereiden; ontbrekende koppelingen uitleggen. | Klant kiest eerste taak, import en koppelingen. Geen automatische toegang tot externe accounts. PersonalOS, Experience en de broneigenaar. |
| 7. Nieuwe wens | Toegestane context ophalen, vragen beperken, opties vergelijken en kosten/gevolgen voorbereiden. | Klant bepaalt doel, budget en keuzes; medewerker beoordeelt uitzonderingen of maatwerk. Herleidbaar voorstel in bestaande case, nog geen boeking. |
| 8. Uitvoering | Rechten, versie, prijs en providerbeschikbaarheid opnieuw controleren; exact bevestigde stappen uitvoeren en resultaten verwerken. | Bevoegde persoon bevestigt verplichtingen, berichten en geld; extra goedkeurder waar vereist. Bronbewijs per onderdeel via broker, domeinadapter en betaalwaarheid. |
| 9. Voortgang | Bronstatus lezen, bevoegde projecties bijwerken, vertraging/gevolgen herkennen en herstel voorbereiden. | Nieuwe verplichting of wezenlijke wijziging vraagt nieuw akkoord. Bevestigd, wachtend en onbekend blijven onderscheiden. |
| 10. Herstel | Oorzaak en getroffen onderdelen verzamelen, taak bij bevoegde eigenaar leggen, alternatief of refund voorbereiden. | Mens beslist over betwisting, geld en uitzonderingen. Ook gratis kan een mens bereiken. Herstel in hetzelfde dossier via Concierge/Service. |
| 11. Afsluiten | Levering, facturen, commissieregime, ledenvoordeel en allocatie afstemmen; verschillen openhouden. | Eigenaar sluit op echte uitkomst; uitbetaling blijft gecontroleerd. Geen "geregeld" bij open verplichtingen. Domeinbron en Commercial Core. |
| 12. Voortzetten of vertrekken | Datums en dossiers bewaken, verleng-/upgradevoorstel of eindafrekening voorbereiden en actuele rechten afleiden. | Nieuw akkoord waar vereist; opzegging/herroeping niet door verkoop tegenhouden. Correcte einddatum en blijvende nazorg via contract, ronde en Service. |

Iedere aangesloten onderneming krijgt een begrijpelijke route naar Travel &
Lifestyle. **Een relatie is geen datakoppeling.** Opdrachtgever, leverancier en
verwijzer krijgen afzonderlijke afspraken. Geen automatische leveranciersrol,
gedeeld klantenbestand of verplicht softwarepakket om een reisvraag te stellen.
Gratis zakelijke deelname is inmiddels het eigenaarsbesluit in §9. De technische
poort is nog niet gewijzigd; verkoperscontrole en organisatiebevoegdheid blijven nodig.

### 8.5 Controle die werkelijk controleert

Onderstaande werkverdeling gebruikt Authority, mensgronden en bestaande
tekengrenzen; zij introduceert geen tweede rechtenmodel.

- **Automatisch zonder nieuw extern gevolg:** invoer verwerken, rekenen, zoeken
  binnen bevoegd bereik, concepten maken en bevoegde projecties bijwerken.
  Alleen wanneer geen toepasselijke mensgrond resteert en de vereiste
  `CAN_VERIFY`- en `CAN_RECOVER`-poorten zijn gehaald; ook een interne handeling
  kan onomkeerbaar zijn. Bewaarbeleid, actuele autorisatie en bronversie blijven gelden.
- **Klantbesluit:** prijs/voorwaarden, gegevensdeling, boeking, betaling,
  publicatie of materiële wijziging bevestigen. Eén akkoord kan een zichtbare
  samenhangende set dekken, geen verborgen opdrachten.
- **RTG-controle:** voorgeschreven identiteit/toelating, gereguleerd bewijs,
  uitzonderingen, fraudeonderzoek, klachten en operationele verantwoordelijkheid.
- **Onafhankelijke tweede goedkeurder:** gevoelige uitbetaling, betaalbestemming,
  bevoegdheidsverruiming of ander werk waarvoor het beleid vier ogen eist.
  Niemand keurt zichzelf goed.

De controlewerkplek toont bronstukken, geldigheid, discrepanties, exacte
wijziging, prijs, ontvanger, bevoegdheid en herstelbaarheid. De mens kan
afwijzen, aanpassen, informatie vragen en escaleren. Geen goedkeuring na timeout,
vooraf aangevinkte akkoordknop of samenvatting zonder bronnen. Een gewijzigde
opdracht maakt waar nodig het oude akkoord ongeldig. Reviewers krijgen tijd,
opleiding en beslisruimte; tekort aan capaciteit is een zichtbare wachtrij,
geen bypass. Steekproeven op routinematig werk en onterechte blokkades vervangen
nooit verplichte voorafgaande goedkeuring en worden geen individuele werkersscore.

Dit sluit aan op [OWASP Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/):
bevoegdheid afdwingen buiten het model en menselijke goedkeuring bij zware
gevolgen. AI levert een voorstel, niet zijn eigen uitvoeringsvergunning.

### 8.6 Fraudebestendigheid door de hele lus

Geen garantie dat fraude onmogelijk wordt. Ontwerp voor voorkomen, beperken,
detecteren, veilig ingrijpen en herstellen. Signalen beschrijven gebeurtenissen,
bronnen, verval en tegenbewijs; geen persoons- of medewerkersscore of ranglijst.

| Risico | Vereiste maatregel | Te bewijzen grens |
|---|---|---|
| Accountovername | Passkeys waar passend, extra authenticatie bij gevoelige stappen, sessie-intrekking en veilig accountherstel. | Geen omzeiling via zwak herstel; authenticatie bewijst niet vanzelf identiteit of tekenrecht. |
| Valse identiteit/bedrijf | Menselijke verificatie waar vereist, bron en verval, bevoegd vertegenwoordiger, vergunning én persoonsbewijs waar nodig. | Upload, OCR, registermatch of betaald abonnement is afzonderlijk geen volledige verificatie. Geen niet-aangesloten registercontrole claimen. |
| Valse betaalstatus | Geauthenticeerde provideruitkomst; controle van bedrag, valuta, order, betaler en hergebruik; reconciliatie bij onzekerheid. | Geen activering, levering of refund op browserterugkeer, PDF of klantbericht alleen. |
| Dubbele/omgeleide betaling | Economische idempotentie, limieten en rekeningwijziging via onafhankelijke bekende contactroute; tweede goedkeurder waar vereist. | Timeout maakt geen tweede verplichting; risicovolle nieuwe bestemming en uitbetaling niet door dezelfde persoon alleen. |
| Kwaadaardige inhoud | Scannen/quarantaine, documenten en e-mail als onbetrouwbare gegevens behandelen, beperkte AI-tools, uitvoercontrole en secrets buiten modelcontext. | Documenttekst kan geen systeemrecht, ontvanger, rekening of betaalmandaat veranderen. |
| Rol-/partnermisbruik | Minimale object-/organisatiebevoegdheid, tijdelijke toegang, actuele intrekking en zichtbare actor/agent. | Geen andere tenant of volledige case via deelopdracht. Betaalde partner maakt gratis klanten niet commissievrij. |
| AI-/tegoedmisbruik | Kosten vooraf reserveren waar mogelijk; maxima, gelijktijdigheid en retries bewaken; werkelijk verbruik afrekenen. | Onbekende kostprijs is niet gratis; geen ongeautoriseerde aanvulling of open dure route bij ontbrekende kostencontrole. |
| Onterechte fraudemelding | Alleen noodzakelijke risicohandeling beperken, veilige uitleg, termijn/eigenaar en menselijke herbeoordeling. | Geen permanente uitsluiting of financiële sanctie alleen op AI-signaal; noodzakelijke hulp en bezwaar blijven bereikbaar. |

Passkeys zijn geen los keurmerk: protocol en herstelpad moeten bij het risico
passen. [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b/authenticators/)
onderscheidt cryptografische phishingbestendigheid van handmatig ingevoerde
eenmalige codes. Beoordeel juridische gevolgen van automatische besluiten per
toepassing: artikel 22 AVG kent voorwaarden en uitzonderingen, geen algemene
vrijbrief voor fraudebestrijding. Menselijke controle moet betekenisvol zijn;
zie de [EDPB-uitleg](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en).
Grondslag, bewaartermijnen en zo nodig gegevensbeschermingseffectbeoordeling
vooraf vaststellen. Geen onnodige identiteitskopieën voor iedereen.

### 8.7 Snelheid, continuïteit en veranderbaarheid

- **Eenvoud:** één volgende actie, toegestane invoer bewaren, ontbrekende stukken
  gericht aanvullen, wachten uitleggen. Gebruikerswerk, RTG-wachttijd en
  providerwachttijd afzonderlijk meten.
- **Bestaande taakbudgetten:** gebruik `qualificationPlanning` in
  `experience-architecture/coverage-contract.json`, per taak, risico, apparaat,
  toegankelijkheid en nieuwe/ervaren gebruiker. Geen tweede SLA-tabel of belofte
  dat externe verificatie of reservering altijd binnen seconden klaar is.
- **Duurzaam verwerken:** bestaande scheduler/ronde en domeinopslag moeten na
  crash hervatten; versiecontrole, unieke uitvoersleutel, begrensde retries en
  opvolging van vastgelopen werk. Bij onbekende uitkomst eerst bronstatus
  achterhalen, niet blind opnieuw boeken.
- **Uitval:** lezen en veilige voorbereiding waar verantwoord behouden;
  gevoelige mutaties wachten op autorisatie en providercontrole. Zonder AI
  blijven deterministische standaardroutes en menselijke bediening beschikbaar.
- **Vervangbare afhankelijkheden:** bestaande provider-, intent-, prijs- en
  bewijscontracten versieerbaar houden. Adapterwissel verbergt geen nieuwe
  toestemming, prijs of gegevensbestemming. Sleutelrotatie, patches, export,
  migratie, rollback en herstel periodiek beproeven.
- **Geen zelfwijzigende regels:** klantgedrag of AI-advies verandert niet zelf
  prijzen, toelating, fraudebeleid of productiecode. Verbeteringen via menselijke
  vaststelling, Change Impact en gecontroleerde vrijgave. Proceskennis is geen
  gedeeld privéprofiel van een klant.

### 8.8 De economie moet de complete dienstverlening dragen

Gratis apart beoordelen op werkelijke commissie en vrijwillige extra's,
inclusief niet-boekers, controles, fraudeonderzoek, mislukte betalingen, refunds
en toegerekende infrastructuur. Betaald op abonnement en gekozen extra's;
commissie van gratis verkopers blijft volgens §9.3 bestaan, ook bij betaalde
kopers, en wordt één keer aan de juiste groep toegerekend. Geen verborgen
verkoopcommissie of onbeperkte nulclaim. De bestaande
30%-verdeling blijft behouden zoals §7.7 beschrijft.

Een upgrade koopt méér capaciteit, bereik of uitvoering, geen reparatie van de
basisbelofte. Voor RTG/Lite/Business uitwerken: AI/opslag, aanvullende uitvoering
en waar passend gebruikers, integraties of bereikbaarheid. Vooraf één
begrijpelijke prijs of meetregel, maximum en expliciet akkoord. Geen stil
verbruikstarief, standaard aangezette auto-aanvulling of strafprijs bij vertrek.
Lifestyle krijgt eerst een sluitend vast serviceprofiel.

Per verkoopbaar aanbod: standaard- en piekgebruik, veelboekers, vervanging,
storingen, vooruitbetaalkorting en overstap van gratis naar betaald doorrekenen.
Geen uren of AI-quota verzinnen om een tabel te vullen. Ontbrekende kostmetingen,
providercontracten of personeelsdekking blijven verkoopblokkades.

### 8.9 Uitvoering binnen bestaande werkpakketten

Geen P8 of aparte groene status. Na scopevaststelling aansluiten via bestaande
werkpakketten en contracten:

| Pakket | Werk voor deze lus | Vereist bewijs, niet door deze tekst geleverd |
|---|---|---|
| P0 | Pas/serviceprofiel, upgradegrenzen, eigenaar en scopedelta vastleggen. | Geen ingetrokken belofte of ongemerkte bevoegdheid. |
| P1 | Onboarding, actuele rechten, vertegenwoordiging, menselijke verificatie en fraudegrenzen. | Ontbrekend/verlopen bewijs, andere tenant, intrekking en zelfgoedkeuring correct tegenhouden. |
| P2 | Eén dossier met context, prijsversie, keuzes en gevolgen; AI stelt voor. | Gewijzigde inhoud vraagt nieuw akkoord; voorbereiding heeft geen extern effect. |
| P3 | Provideruitvoering, betalen, commissieregime, levering en reconciliatie. | Bronbewijs, geen dubbele effecten, correcte gedeeltelijke uitvoering en refund. |
| P4 | Eerste waarde, pasdekking, controlewerkplek en partnerschermen. | Begrijpelijk en toegankelijk voor klant, ondernemer, medewerker en partner. |
| P5 | Intake, concept, uitvoering en nazorg hervatten. | Geen verloren bevestigd werk, gegevenslek bij accountwissel of herhaling van onzekere betaling. |
| P6 | Keten-, veiligheids-, kosten-, migratie- en herstelproeven op dezelfde bron. | Negatieve proeven en ontbrekend bewijs zichtbaar; verkeerde experiment telt niet. |
| P7 | Onafhankelijke acceptatie, personeel/providerparaatheid, staging en rollback. | Alle toepasselijke Deep Green- en Premium Experience-voorwaarden op de echte kandidaat. |

De twaalf referentie-ervaringen blijven het eerste integratiebewijs. Neem deze
klantlus daarin als samenhangende taakvariant op; vervang geen andere referenties
of de 114-capabilityscope. G1–G4 blijven de poorten; planning is geen productbewijs.

Ketenproeven omvatten minimaal: gratis zonder aankoop én met commissie; RTG
met jaarvooruitbetaling en nulcommissie bij een betaalde ondernemer én 15%
commissie voor een gratis verkoper bij diezelfde betaalde koper; Lite met bevoegd
zakelijk akkoord en 5% commissie op verkopen aan gratis leden;
Business met menselijke toelating en contractprijs; Lifestyle met meerdere
aanbieders en verstoring. Kruis met verlopen stukken, gewijzigde prijs,
dubbel klikken, crash na provideracceptatie, rekeningwijziging, fraude én
onterechte signalering, intrekking, AI-uitval/kostenplafond, gedeeltelijke
refund, opzegging en blijvende nazorg.
Vergelijk ook offerteacceptatie vóór en na een beleidswijziging: bestaande
rechten blijven volgens hun vastgelegde versie gelden, zonder retroactieve heffing.

De vijf Premium Experience-vragen blijven verplicht: nieuwe gebruiker kan de
hoofdtaak zonder uitleg; ervaren gebruiker werkt efficiënt; gevolgen zijn vóór
akkoord duidelijk; herstel is veilig; onafhankelijke menselijke beoordeling
bevestigt samenhang en verzorging.

### 8.10 Gerichte broninspectie: wat nog niet sluit

Gelezen op 12 november 2026 in de lokale werkboom. Dit is een gerichte statische
inspectie, geen volledige securityaudit, productiecontrole of exploitproef.
De onderstaande verschillen vragen ketenbewijs en waar nodig herstel; aanwezigheid
van een module of groene losse toets bewijst niet dat de hele klantlus werkt.

| Aansluiting | Wat de onderzochte bron laat zien | Vereiste vervolgstap |
|---|---|---|
| Identiteit naar betaaltoegang | `server/kern/onboarding/paypoort.js` accepteert onder meer `pending`; Lifestyle/Business passeren op tier. Deze poort alleen bewijst geen menselijke identiteitsgoedkeuring. | Onderscheid ingediend/gecontroleerd/afgewezen en bewijs de vereiste actuele identiteit over de complete betaalroute. Andere poorten niet negeren bij de proef. |
| Akkoord naar contractactivering | `server/kern/aanmeldingen/betaalschema.js` biedt, accepteert en activeert na het kantoorbesluit. `server/kern/aanmeldingen/bedrijf.js` noemt termijn-aftekening expliciet administratief, geen betaalclaim. | Bind vereiste klantacceptatie, toelating en providerbetaling aan activering; geen tweede contractregister. |
| Verificatie als één geheel | `server/routes/office/verificaties.js` zet verificatiestatus vóór validatie van een meegegeven documentgeboortedatum. PostgreSQL heeft een request-terugdraaigrens; dat is niet vanzelf dezelfde grens als lokaal SQLite. | Gericht testen dat afwijzing of auditstoring op beide backends geen gedeeltelijke goedkeuring achterlaat. Geen bewezen productie-exploit geclaimd. |
| Menselijk besluit naar providerwaarheid | `server/kern/reisbureau-besluit.js` meldt bevestigd op kantoorbesluit; `server/kern/bureau/lus.js` zet een gekozen onderdeel bevestigd zonder verplichte externe ontvangstverwijzing in die stap. | Adviseursvastlegging onderscheiden van externe bevestiging; bronbewijs doorvoeren naar dossier, klantbeeld en nazorg. |
| Verloren eerste refundantwoord | `server/kern/betaalwaarheid/terug.js` kan na providerfout een opdracht `VASTGELEGD` zonder refund-id laten; `server/kern/betaalwaarheid/terugveeg.js` verwerkt `BIJ_PROVIDER` met id. | Crash/timeout vóór ontvangst van de id beproeven; terugvinden of naar menselijke reconciliatie zonder tweede refund. Dit is nog niet gereproduceerd. |
| Jaarovergang | `server/kern/aanmeldingen/lidabonnement.js` beschrijft automatische consumentenverlenging, maar `server/kern/commercie/ronde.js` markeert alleen verlengbaar. | Verlengingsbeleid, akkoord, rechten, termijnen en betaalmandaat gezamenlijk bewijzen; geen nieuw jaarcontract door stilzwijgen invoeren. |
| Kostengrens | `server/kern/kosten/haak.js` laat bij ontbrekende of foutende wacht door; `server/kern/commercie/tegoed.js` houdt automatisch aanvullen zonder betaalbewijsadapter inactief. | Bewezen limieten op alle kostbare routes, ook parallelle verzoeken en retries; veilige beperkte werkmodus bij ontbrekende kostenzekerheid. |
| Partnerbediening en monitoring | `CONCIERGE.md` §0a noemt ontbrekende leveranciersbediening; `server/kern/reiswacht.js` beschrijft een momentopname zonder algemene externe vlucht-/spoorbewaking. | Werkelijke partnerschermen, bronnen, bewakingscadans en verantwoordelijke opvolging toetsen vóór een doorlopende bewakingsbelofte. |

Ook niet opnieuw bouwen wat inmiddels wel is aangesloten: de commerciële ronde
heeft een timer in `server/opzet/kernlaag3c.js`; actuele contractstanden worden
via `server/kern/commercie/lidpoort.js` en `server/opzet/diensten2.js` per request
verwerkt. Een onleesbare of daadwerkelijk beëindigde betaalde contractstand
kan terugvallen naar de basislaag. `GEEN_CONTRACT` blijft een afzonderlijke
legacy-uitzondering, geen bewijs van een nieuwe geldige overeenkomst. Oudere
documentzinnen over uitsluitend schaduw of geen wekker zijn niet voldoende om
de actuele werking te beoordelen.

### 8.11 Nog vast te stellen en te bewijzen

Voor verkoop: servicecapaciteit, personeelsrooster/vervanging, bereikbaarheid,
inclusies/exclusies, upgradeprijzen, zakelijke/huishouddekking, provider- en
partnerafspraken en echte kostendata. Autonome betalingen en externe communicatie
zijn **niet** besloten. Nieuwe beloften gaan via bestaande scopebesluiten;
bestaande verplichtingen mogen ondertussen niet worden uitgekleed.

Dit sluit het **ontwerp van de lus**, niet de uitvoering. Alleen documentatie
is aangepast; geen toelating, rechten, betaling, provider, prijs of groene
kwalificatiestatus geactiveerd. Aansluiting en kwalificatie blijven aantoonbaar
af te bouwen in de bestaande bronnen.

### 8.12 Controle van deze conceptuitwerking

Op 12 november 2026: **81/81 bestaande gerichte tests geslaagd**, nul mislukt
of overgeslagen, op Node v24.18.0:

```sh
node --test test/pasladder.test.js test/contract.test.js test/allocatie.test.js test/onboarding-ontvangst.test.js test/conciergelus-regels.test.js test/conciergelus-kern.test.js test/persoonseis.test.js test/tegoed.test.js
git diff --check
```

Daarnaast gecontroleerd: consistente kolommen in de 51 tabelregels van §8,
bestaan van de 18 expliciete server-/Experience-bronpaden en aansluiting op de
acht bestaande werkpakketten. Onafhankelijke documentreview op service-economie
en menselijke/securitygrenzen verwerkt. Dit zijn document- en gerichte
regressiecontroles, geen uitvoeringstoetsen van het nieuwe aanbod. De acht
aansluitingsvragen zijn hiermee niet gesloten. Geen Node 26-eindkwalificatie,
browser-/gebruikersproef, werkelijke providerproef of productiecontrole geclaimd.

## 9. Gratis ondernemen als volwaardige ingang naar Business Lite

*12 november 2026. Eigenaarsbesluit: ondernemers moeten gratis bepaalde
mogelijkheden kunnen gebruiken, expliciet Salon, producten verkopen en een eigen
klantenbestand, zodat zij vanuit ervaren waarde naar Business Lite kunnen groeien.
Deze drie basisfuncties, €0 abonnement en 15% commissie voor de gratis
ondernemer zijn besloten. De eigenaar heeft expliciet gekozen dat die commissie
ook geldt bij betaalde kopers, waarmee de eerdere nulcommissiebelofte wordt
beperkt. Betaalde ondernemers betalen 5% bij gratis leden en 0% bij betaalde
leden binnen de afgesproken dekking. De grondslag- en afrekenregels hieronder
zijn definitief vastgesteld als intern commercieel beleid; fiscale toepassing, externe acceptatie
en softwarebewijs blijven afzonderlijk vereist. Capaciteiten en upgradegrenzen
zijn nog uit te werken; niets is hiermee live geactiveerd.*

### 9.1 De productgrens

**Gratis: zichtbaar worden, verkopen en klanten beheren. Business Lite:
het dagelijkse bedrijf met minder dubbel werk organiseren.**

Eén bestaande gratis toegang met zakelijke context, geen zesde pas of nieuwe app.
Geen verplichte betaalkaart of proefperiode die vanzelf een jaarcontract wordt.
Gratis blijft bruikbaar; Lite moet zijn prijs verdienen met extra waarde.

| Onderdeel | Gratis zakelijke basis | Voorgestelde meerwaarde Business Lite |
|---|---|---|
| Salon | Herkenbaar bedrijfsprofiel, publiceren, reageren en klantvragen beantwoorden binnen bestaande rechten, privacy en moderatie. | Samenwerking, contentvoorbereiding en werkplanning verbonden met bedrijfsprocessen. Geen betaald recht op spam of gegarandeerd bereik. |
| Verkopen | Aanbod beheren en via bestaande Mall/Commerce-verkoopwegen daadwerkelijk verkopen, met prijs, voorraad waar nodig en basisorderoverzicht. | Geïntegreerde kassa, voorraad, varianten, inkoop en administratie waar bedrijfstype en bewezen functionaliteit dat ondersteunen. |
| Klantenbestand | Eigen contacten, notities, rechtmatige relatie-/orderverwijzingen, zoeken en basisopvolging; gecontroleerde import/export. | Uitgebreidere verkoopkansen, taken, offertes, interne opvolgworkflows en samenwerking op hetzelfde klantenbestand. |
| Order en nazorg | Levering, klachten, annulering/retour waar toepasselijk en refundroute. Geen betaalde upgrade nodig voor correcte afhandeling van eigen orders. | Meerdere bedrijfsprocessen verbinden en herhaald administratief werk verminderen. |
| Overzicht | Eigen aanbod, aanvragen, orders en werkelijke opbrengsten bij elkaar. | Samenhangend bedrijfsbeeld met planning, kosten en passende rapportages. |
| Rahul | Regelgestuurde begeleiding en voorbereiding; eventueel een begrote beperkte AI-bundel, nog vast te stellen. | Meer voorbereidingscapaciteit en zakelijke workflows binnen expliciete budgetten. Externe acties blijven menselijk bevestigd. |
| Team | Voldoende bevoegdheden om de gratis basis veilig te bedienen; werknemers hoeven geen persoonlijke betaalde pas te kopen. | Teamprocessen, taakverdeling, roosters, uren en andere standaardondernemerstools binnen vastgestelde capaciteit. |
| Travel & Lifestyle | Zakelijke reisvraag stellen en verbinding met relevante partners. | Aanvraag, bedrijfsgoedkeuring, documenten en kostenplaatsen in de dagelijkse werkstroom. |

Veiligheid, toegangscontrole, herstel, menselijke probleemhulp en gegevensrechten
blijven voor beide gelijkwaardig. Geen basis-CRM achteraf blokkeren om betaling
af te dwingen. Aantallen gebruikers, producten, contacten, opslag en AI-capaciteit
na kostentoets vaststellen; geen onbeperkte hosting- of servicebelofte.

### 9.2 Instroom en overstap zonder opnieuw beginnen

Gebruik bestaande onboarding: account, bedrijf/vertegenwoordiging, vereiste
controles, profiel, eerste product, eerste bruikbare klantrelatie en eerste
order. Concepten mogen worden voorbereid voordat verkoopvereisten rond zijn;
publiceren, innen en leveren houden hun eigen poorten. Een import wordt niet
automatisch gepubliceerd of als marketinglijst gebruikt.

Laat Lite zien bij een echte vervolgvraag, bijvoorbeeld order, voorraad en
administratie verbinden. Toon het verschil op het eigen toegestane werk,
zonder generieke dagelijkse upsell of blokkade midden in een bestelling.

Business Lite blijft €150 exclusief btw per maand bij een jaarcontract:
€1.800 in twaalf termijnen of €1.725 bij jaarlijkse vooruitbetaling. Betaalde
rechten pas na expliciet akkoord op prijs en dienstverlening. Hetzelfde bedrijf,
profiel, assortiment, klantenbestand en orderhistorie blijven bestaan; geen
migratie naar een tweede CRM.

Na contractueel einde kan de ondernemer terug naar gratis. Alleen overeengekomen
extra mogelijkheden vervallen; lopende orders, klachten en noodzakelijke
gegevens-/exportrechten blijven afhandelbaar. Vooraf uitleggen wat met workflows
en capaciteit gebeurt. Geen stil wissen, verborgen doorlopende kosten of
automatische jaarlijkse upgrade omdat een gebruiksgrens is bereikt.

### 9.3 Commissiematrix: 15%, 5% en 0%

**DEFINITIEF INTERN COMMERCIEEL BESLUIT — versie 2026-11-12.1.**
Vastgesteld op 12 november 2026 op de expliciete eigenaarsopdracht
"Maak het definitief". Deze paragraaf is de canonieke beleidsbron voor de
commissiegrondslag, reisrol, btw-inrichting, providerkeuze/kostenverdeling en
correcties. De al gekozen basisprijzen en jaarbetaling in §7.3 blijven ongewijzigd.
§8-servicecapaciteiten, nog niet bepaalde upgrades en overige conceptvoorwaarden
worden hiermee niet stilzwijgend goedgekeurd.

Intern geldt dit besluit vanaf vaststelling als implementatie- en contractnorm.
Extern geldt het uitsluitend voor een daadwerkelijk geaccepteerde overeenkomst
met deze beleidsversie en de bijbehorende gekwalificeerde verkooproute. Geen
terugwerkende wijziging van lopende rechten of orders. Een afwijkend tarief,
verborgen heffingsgrondslag of uitbreiding van de reisrol vraagt een expliciet
nieuw eigenaarsbesluit en zo nodig nieuw contractakkoord. Het invullen en toetsen
van provider-/dossierfeiten is uitvoering van dit beleid, geen nieuwe prijskeuze.
**Definitief beleid is geen ondertekend extern contract en geen verkoopvrijgave.**

**Eigenaarsbesluit: €0 abonnement, 15% commissie over afgesproken verkopen
via RTG. Ook als de koper een betaald RTG-lid is.** De eigenaar heeft deze
samenloop expliciet gekozen; betaald koperschap heft de verkoperscommissie niet
op. Dit vervangt de eerdere algemene nulcommissiebelofte voor precies deze
combinatie. Geen nieuwe heffing bij de koper en geen dubbele commissie.

**Aanvullend tariefbesluit:** betaalde ondernemers betalen 5% bij gratis leden.
Voor hun gedekte verkopen aan betaalde leden blijft de eerdere 0%-afspraak gelden.

| Ondernemersabonnement van de verkoper | Gratis lid als koper | Betaald lid als koper |
|---|---:|---:|
| Gratis ondernemer | 15% | 15% |
| Betaalde ondernemer | 5% | 0% |

Deze matrix geldt voor de afgesproken verkopen via RTG. De ondernemer betaalt
de commissie aan RTG. Betaald ondernemen betreft het zakelijke abonnement van
de verkopende entiteit, zoals Business Lite of Business; een persoonlijke betaalde
pas van een medewerker verandert het verkopersregime niet. Geen afzonderlijk
verkopersabonnement of nieuwe tariefcatalogus invoeren. Andere aanbiederafspraken
buiten deze scope worden niet automatisch herschreven.

**Betaald is een contractrecht, geen aangeklikte upgrade.** De bestaande
contract-/rechtenbron moet op het acceptatiemoment actieve betaalde rechten
voor de koper respectievelijk de verkopende entiteit bevestigen, inclusief
vereiste toelating. Voor nieuwe standaardcontracten moet de eerste verschuldigde
termijn of jaarvooruitbetaling bevestigd zijn; twaalf termijnen vereist niet
dat het hele jaar vooraf is betaald. Een nog niet verschuldigde volgende termijn
maakt een actief contract niet gratis. Een bestaande expliciete betaalafspraak
blijft behouden; een open, onzekere of betwiste status wordt beoordeeld, niet
automatisch als gratis of betaald geclassificeerd. Een betaling alleen is
evenmin toelating tot Business of Lifestyle.

De percentages en onderstaande commerciële berekeningsregels zijn vastgesteld.
Een concreet factureerbaar bedrag vraagt daarnaast een geaccepteerde partnerbijlage,
gekwalificeerde transactie, juiste btw-behandeling en providerbewijs. Geen heffing
op alleen contacten in het klantenbestand, de volledige bedrijfsomzet of verkopen
buiten RTG. De verkooproute, niet alleen het bestaan van een klantrelatie, bepaalt
of de afspraak van toepassing is; eigen-klantdekking vóór aansluiting benoemen.

Bij expliciete klantacceptatie van een geldige geversioneerde offerte koper- én
verkopersstatus, overeengekomen tariefversie en grondslag vastleggen.
Providerbevestiging blijft een afzonderlijk feit; vertraging daarbij verandert
het aanvaarde commissieregime niet. Onbekende status is geen stilzwijgende gratis
of betaalde status: eerst oplossen, geen percentage gokken. Een latere upgrade/downgrade verandert een aanvaarde order
niet stilzwijgend. De rekening en afrekening tonen wie welke vergoeding betaalt,
welke partij die ontvangt en wat na een retour wordt gecorrigeerd.
Latere aanvullende prestaties krijgen eigen orderregels en nieuw akkoord met
de dan geldende rechten. Ongewijzigde aanvaarde regels blijven intact; de hele
order niet opnieuw classificeren vanwege één extra regel.

**Commissie wordt verschuldigd over het aantoonbaar geleverde én betaald
ontvangen gedeelte.** Bij deelprestaties gebeurt dat per oorspronkelijke regel
met een herleidbare verdeling van de betaling. Ontbreekt die verdeling, dan geen
automatische commissie-inning. Een reservering, betaalautorisatie of aanbetaling
zonder geleverde prestatie is nog geen verdiende commissie. Een eventuele
vooraf overeengekomen reserve blijft afzonderlijk van omzet en verschuldigde
commissie; geen stilzwijgende inhouding. De uitzonderlijke behouden
annuleringsvergoeding volgt §9.3.4. Facturatie, omzetverantwoording en het fiscale
btw-tijdstip worden afzonderlijk beoordeeld; deze commerciële regel verschuift
geen wettelijke factuur- of belastingplicht.

**Communicatie:** niet meer algemeen beloven dat RTG aan aankopen van betaalde
leden geen commissie verdient. Benoem de uitzondering vooraf in aanbod en
voorwaarden; in de betrokken aankoop is het commerciële belang zichtbaar.
Waar geen commissie vervalt is ook geen uitgespaarde commissie om aan partner
of lid te verdelen. Bestaande ondertekende rechten niet automatisch wijzigen;
nieuwe afspraken en migratie volgen §7.8. Geen live inning vóór contract,
tarief, providerbewijs en afrekening zijn ingericht en gekwalificeerd.

#### 9.3.1 Grondslag en reisrol — concrete commerciële regels

**Gewone producten en eigen diensten:** commissie over de verkoopwaarde exclusief
de werkelijk toepasselijke btw, na door de verkoper gefinancierde korting.
Geen aftrek van normale inkoop-, personeels- of bedrijfskosten: verkoopwaarde is
niet hetzelfde als winst. Niet meetellen: afzonderlijke belastingen/heffingen,
echte fooien, terugbetaalbare borg en aantoonbare afzonderlijk doorbelaste
verzendkosten. Geen productprijs naar een fictieve verzendpost verplaatsen.
Een ingehouden borg is niet automatisch een nieuwe commissiehoudende verkoop.

Een RTG-gefinancierd ledenvoordeel is geen verkoperskorting. Klantbetaling,
RTG-bijdrage, oorspronkelijke verkoopwaarde en partneraanspraak blijven apart
herleidbaar; de bestaande subsidie-invariant wordt niet stilzwijgend vervangen
door een netto-uitbetaling na commissie. Correcties volgen de originele verdeling.

**Nader eigenaarsbesluit: eigen RTG-reizen zijn onze verantwoordelijkheid.**
Deze reisuitwerking gaat over reizen die RTG zelf aanbiedt en samenstelt. RTG
neemt daarbij zijn eigen verkoop-, organisator- en nazorgverantwoordelijkheid;
de reiziger wordt niet naar losse leveranciers verwezen om die verantwoordelijkheid
te ontwijken. Voor akkoord benoemen: contractspartij, organisator/uitvoerder,
RTG-rol, geldontvanger, terugbetalingsplicht en toepasselijke bescherming.

Reizen die een klant zelfstandig bij een ander reisbureau koopt, vallen buiten
deze RTG-verkoop en afrekening. Geen automatische commissie, incasso of garantie
op zo'n reis omdat het bureau een RTG-account heeft of het lid zijn reisdocument
in TravelOS bewaart. Een later afzonderlijk aanvaarde RTG-serviceopdracht heeft
haar eigen beperkte scope en maakt RTG niet stilzwijgend verkoper van die reis.

Het eerdere onderscheid tussen bemiddeling en eigen verkoop is geen vrijbrief
voor een huisbrede bemiddelaarsclaim. De feitelijke handelingen bepalen mede
de juridische kwalificatie; een label, vinkje of gesplitste betaling bewijst die
niet. Als RTG toch een externe reis gaat verkopen of bemiddelen, moet die nieuwe
route apart worden beoordeeld en overeengekomen. Bij een eigen pakket staat RTG
als verantwoordelijke organisator voor het geheel, niet verstopt achter losse
componentrollen. Een geldrol bij Stripe bewijst de reisrechtelijke rol niet.

| Verkooprol | Commissiegrondslag binnen de matrix |
|---|---|
| Hotel, vervoerder of activiteitenaanbieder levert zelf | Eigen verkochte prestatie na verkoperskorting, exclusief vastgestelde btw en bovengenoemde uitsluitingen. |
| Ander reisbureau verkoopt zelfstandig zijn eigen reis | Buiten deze RTG-reisverkoop en afrekening; geen RTG-commissie afleiden uit alleen accountstatus, CRM of reisdocumentimport. |
| Partner verwijst alleen | Geen verkoperscommissie over een reis die hij niet verkoopt; eventuele verwijzersvergoeding is een afzonderlijke afspraak. |
| RTG verkoopt zelf een samengestelde reis | RTG draagt de verantwoordelijkheid. Geen commissie aan zichzelf of fictief betaald partnerprofiel. Leveranciersverplichtingen, fiscale reismarge en eigen RTG-dienst apart onderbouwen; niet automatisch 15%/5% over de eigen reissom rekenen. |

**Eigen reisprijs:** de offerte sluit aan op aantoonbare leveranciersinkoop,
verplichte heffingen, toepasselijke btw en expliciet overeengekomen RTG-diensten.
Ordergebonden leverancierskortingen en later ontvangen bonussen blijven daarin
herleidbaar volgens de overeengekomen partner-/ledenverdeling; een bruto
leveranciersbedrag niet als netto-inkoop voorstellen om een voordeel te verbergen.
Een leverancierskorting/-commissie en een eigen RTG-vergoeding niet dubbel tellen.
De partnercommissie geldt uitsluitend als de betrokken leveranciersafspraak
haar uitdrukkelijk op die levering toepast; een eigen inkoopboeking is niet
automatisch een consumententransactie uit de matrix.

Voor een betaalde koper blijft binnen de commissievrije dekking gelden: geen
verborgen ordergebonden RTG-verkoopmarge of verplichte extra boekingsfee. Normale
RTG-uitvoering wordt door het abonnement gedragen; optioneel meerwerk alleen na
apart scope-/prijsakkoord. Normale uitvoering en RTG's eigen betaalkosten mogen
niet alsnog als verplichte servicefee of fictieve leveranciersinkoop terugkomen.
De reeds gekozen gratis-verkoperuitzondering wordt
niet door deze reisregel uitgebreid of verborgen. Bij gratis kopers mogen naast
afzonderlijk geaccepteerde RTG-serviceopdrachten alleen werkelijk overeengekomen,
herleidbare leveranciersvergoedingen meetellen als RTG-opbrengst. Dit besluit
verzint geen nieuwe opslag of extra percentage op RTG's eigen reissom.

Bij eigen pakketreizen blijven informatie, organisatorverantwoordelijkheid,
insolventiebescherming en passende aansprakelijkheidsdekking voorwaarden vóór
verkoop. Geen aansluiting bij een garantiefonds of verzekeraar claimen zonder
bewijs. Dit behoudt de productscope, maar verklaart geen route verkoopklaar.
[RVO: reizen verkopen](https://ondernemersplein.overheid.nl/wetten-en-regels/reizen-vakanties-of-timesharing-aanbieden/).

#### 9.3.2 Btw — toepassen op de juiste prestatie

De 15% en 5% zijn **exclusief eventuele btw op de RTG-dienst**. Btw op het
product en btw op RTG's vergoeding zijn twee beoordelingen. Verlegd, nultarief,
vrijgesteld en buiten Nederlandse heffing zijn geen uitwisselbare nulstanden.

| Vastgestelde prestatie en context | Behandeling in de contract-/factuurregels |
|---|---|
| Gewone RTG-platformdienst aan Nederlandse zakelijke afnemer, zonder bijzondere regeling | 21% over de RTG-vergoeding. Het btw-tarief van het verkochte product wordt niet gekopieerd. |
| Eigen prestatie van RTG, naast ingekochte reisdiensten | Werkelijke afzonderlijke prestatie en plaats van dienst bepalen; niet automatisch onder de fiscale reismarge schuiven. Inbegrepen abonnementsservice niet nogmaals als betaalde reisfee factureren. |
| Gewone B2B-dienst onder de hoofdregel aan ondernemer in andere EU-lidstaat | Na verificatie van afnemer, btw-id, plaats van dienst en toepasselijkheid: geen Nederlandse btw, vermelding 'btw verlegd', juiste factuur-/ICP-gegevens. Niet automatisch toepassen op bijzondere reisdiensten. |
| Gewone B2B-dienst onder de hoofdregel aan afnemer buiten EU | Geen Nederlandse btw wanneer aantoonbaar buiten Nederland belast; lokale verplichtingen afzonderlijk toetsen. Niet als EU-verlegging of vrijstelling etiketteren. |
| Verkoop op eigen naam waarop de reisbureauregeling van toepassing is | Btw over de fiscale reismarge, niet 21% over de volledige reissom. Eigen prestaties en EU-/niet-EU-delen apart behandelen. Op de reisfactuur de vereiste bijzondere-regelingvermelding, geen afzonderlijke marge-btw. |
| Rol, bewijs of bijzondere behandeling ontbreekt | Geen automatische factuur/inning met een gegokt profiel. Naar menselijke fiscale beoordeling; geen terugval op 0% of 21%. |

Bronnen voor deze routes: [algemene tarieven](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/tarieven_en_vrijstellingen/tarieven_en_vrijstellingen),
[onderscheid bemiddeling/eigen prestatie](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/bijzondere_regelingen/reisbureauregeling/wanneer_geldt_de_reisbureauregeling/wanneer_geldt_de_reisbureauregeling_niet2/),
[buitenlandse diensten](https://ondernemersplein.overheid.nl/internationaal-ondernemen/douane-en-belastingen/btw-bij-diensten-in-het-buitenland/).

Voor een nieuwe inrichting onder de reisbureauregeling is **per reis** de gekozen
administratieve standaard, na bevestiging dat die keuze fiscaal toepasbaar is en
geen bestaande bindende methode doorbreekt. Dossier en kostentoerekening sluiten
dan op elkaar aan. Dit is geen verklaring over RTG's huidige fiscale administratie.
Een bestaande fiscale methode wordt niet overschreven: de keuze geldt ten minste
vijf jaar en moet eerst uit de administratie worden vastgesteld. De reismarge is
het relevante verkoopbedrag minus kwalificerende ingekochte reisonderdelen, beide
inclusief btw; die inkoop-btw wordt onder de regeling niet als voorbelasting
afgetrokken. [Belastingdienst: marge](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/bijzondere_regelingen/reisbureauregeling/btw_over_de_winstmarge_berekenen_bij_reisdiensten/btw_over_de_winstmarge_berekenen_bij_reisdiensten),
[administratie](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/bijzondere_regelingen/reisbureauregeling/administratieve_verplichtingen).

Rekenvoorbeeld, uitsluitend volledig EU, positieve marge en methode per reis:
€3.000 verkoop minus €2.700 kwalificerende inkoop = €300 marge inclusief btw;
21/121 daarvan is €52,07. Dit is geen commissiegrondslag van €300 en de reissom
mag niet simpelweg door 1,21 worden gedeeld.
[Belastingdienst: berekening](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/bijzondere_regelingen/reisbureauregeling/aangifte_doen_bij_reisdiensten/).

**Fiscale status: advies bij contractinrichting**, volgens de bestaande
`server/kern/fiscaal/zekerheid.js`. Wij rekenen voor; de beoordeling hoort bij
iemand met vakkennis. Een beoordeelde profielkeuze en correcte gegevens maken
de daaropvolgende optelsom controleerbaar; zij maken geen onbeoordeelde rol juist.
Geen aangifte-indiening namens ondernemers of nieuwe fiscale zekerheidsladder.

#### 9.3.3 Betaalprovider — Stripe/Connect, kosten en verantwoordelijkheid

**Providerkeuze:** behoud Stripe Payments en Stripe Connect uit de bestaande
V1-baseline (`server/kern/vrijgave/baseline.js`). Geen nieuwe Mollie-/Adyen-route
activeren. Eigen RTG-abonnementen en diensten via de eigen merchant-ontvangst;
partnerafrekening via de bestaande afzonderlijke transfer- en payoutvoorziening.
Voor marketplace-inning is de gekozen implementatieflow *separate charges and transfers*,
aansluitend op die voorziening; geen stilzwijgende omschakeling naar direct charges
of de oude sandbox-destinationroute. Eén keten met gescheiden orderverplichtingen,
niet automatisch één juridische reisovereenkomst.

Bij deze Stripe-flow komen providerkosten, refunds en chargebacks eerst ten laste
van het platformsaldo. Interne afspraken met partners verplaatsen die externe
aansprakelijkheid niet. Een transfer naar een verbonden account is nog geen
bankuitbetaling; een refund draait eerdere transfers niet vanzelf terug.
Dit is geen escrow- of insolventiebescherming.
[Stripe: separate charges/transfers](https://docs.stripe.com/connect/separate-charges-and-transfers.md?platform=web&integration=checkout&ui=stripe-hosted).

**Interne kostenafspraak voor de nieuwe contracten:**

- De ondernemer draagt één keer de aantoonbare ordergebonden betaalverwerkingskosten,
  ook bij 0% commissie; RTG rekent geen opslag. Reeds aan dezelfde ondernemer
  doorbelaste of op diens afrekening ingehouden kosten niet opnieuw factureren.
  Een Stripe-inhouding op RTG's platformsaldo mag één keer transparant aan de
  betrokken verkoper worden toegerekend; niet daarnaast nogmaals in diens payout.
- Bij RTG's eigen reisverkoop is RTG zelf de kostendrager. Geen extra PSP-factuur
  aan het lid buiten de vooraf geaccepteerde volledige reisprijs, en geen
  toerekening aan een ander reisbureau dat niet bij die verkoop betrokken is.
- RTG draagt vaste Connect-accountkosten en de standaard Connect-platform- en
  uitbetaalkosten uit abonnement/commissie. Die kosten horen wel in de cohortkostentoets;
  gratis is niet rendabel verklaard doordat ze buiten beeld blijven.
- Geen extra consumententoeslag. Geen nieuw gebruik van het oude RTG-tarief
  €0,10 + 1% als zogenaamd externe kostprijs. Bestaande getekende afspraken eerst migreren.
- Valutawissel, duurdere betaalmethoden en versnelde uitbetaling uitsluitend na
  vooraf getoonde kosten en keuze. Geen onbekende extra's als verzamelpost.
- Gewone niet-terugontvangen betaal-/refundkosten blijven voor de ondernemer
  wanneer de geaccepteerde bijlage die kostensoort benoemt. Herstelkosten van een
  aantoonbare RTG-fout draagt RTG. Geen consumentenrefund verminderen met die kosten.
- Bij betwisting beslist een mens over verweer en toerekening. Alleen bewezen,
  vooraf overeengekomen partnerkosten doorbelasten; gewonnen/vervallen kosten
  corrigeren. Bij onbekende oorzaak geen automatische afschrijving of boete.

Publiek prijsanker, gecontroleerd 12 november 2026; **geen onderhandeld RTG-contract**:

| Stripe Payments | Gepubliceerd standaardtarief |
|---|---:|
| iDEAL | €0,29 per betaling |
| Standaard EER-kaart | 1,5% + €0,25 |
| Premium EER-kaart | 2,8% + €0,25 |

Stripe noemt voor platformgestuurde Connect-prijzen €2 per actief account per
maand en 0,25% + €0,10 per payout. De vergelijking noemt ook 0,25% van het
uitbetalingsvolume voor platformbeheer en betalingsopdrachten. Laat de offerte
vastleggen welke componenten voor de gekozen inrichting samen gelden; neem
alle toepasselijke offerte-/factuurregels in RTG's kostenmodel
op, niet alleen deze voorbeelden. Een publiek tarief bewijst geen toegelaten
reisactiviteit, reserveafspraak of activering. De geaccepteerde providerbijlage
en werkelijke kostenregel bepalen de afrekening, met eventuele provider-btw
afzonderlijk beoordeeld. [Payments](https://stripe.com/nl/pricing),
[Connect](https://stripe.com/nl/connect/pricing).

Stripe retourneert bij zijn standaardtarieven de oorspronkelijke verwerking-,
Connect- en wisselkosten niet automatisch bij refund. Een afwijkend RTG-tarief
mag pas worden gebruikt na bewijs van die afspraak.
[Stripe: refundkosten](https://stripe.com/nl/pricing).

**Vóór provideractivering concreet laten accepteren:** RTG-contractpartij en KYB;
Payments- en Connect-overeenkomst; verbonden-accounttype en gehoste onboarding;
toegelaten reisactiviteiten/landen en levertermijnen; geldrol en accountbinding;
tariefbijlage; reserve/negatief-saldorisico; refund/chargeback/transferreversal;
payoutbevoegdheid en tijdschema. Voor nieuwe geldvertrekhandelingen blijven de
bestaande menselijke controle en vrijgavepoorten gelden. Geen vaste uitbetaaldatum
aan een klant beloven vóór providerbeschikbaarheid en reserveregels vaststaan.
Bewijs hoort bij `inkomend.handelaar`, `provider.stripe` en
`provider.stripe_connect`, niet in een nieuw akkoordregister. Geen externe
overeenkomst namens Stripe of een partner als gesloten rapporteren.

#### 9.3.4 Retour, annulering en afrekening

| Gebeurtenis | Regel |
|---|---|
| Volledige verkoop teruggedraaid | Volledige bijbehorende RTG-commissie en toepasselijke commissie-btw crediteren; echte betaalproviderkosten apart volgens §9.3.3. |
| Deelretour | Alleen de teruggedraaide oorspronkelijke commissiegrondslag corrigeren, met oorspronkelijke tarief- en kortingsverdeling. Geen 15% over een refund waarin ook borg of belasting zit. |
| Annulering zonder behouden vergoeding | Geen verkoopcommissie behouden. |
| Rechtmatig behouden annuleringsvergoeding | Standaard geen commissie. Alleen wanneer die vergoeding vooraf expliciet onder de geaccepteerde grondslag valt, geldt het oorspronkelijke percentage over het werkelijk rechtmatig behouden deel met de juiste fiscale behandeling; nooit vanzelf over de oorspronkelijke volledige order. |
| Gewijzigd abonnement na acceptatie | Oorspronkelijk commissieregime blijft voor die order; geen retroactieve heffing of herberekening. |
| Dubbele webhook, herstart of onzekere provideruitkomst | Dezelfde correctie niet twee keer boeken of uitvoeren; eerst reconciliëren. |

Correcties in gehele valuta-eenheden op de kleinste geldmaat, met opgeslagen
afronding per regel; cumulatieve credits nooit groter dan de oorspronkelijke
commissie. De laatste volledige correctie sluit exact tot de cent. Creditfactuur,
verrekening, transferreversal en daadwerkelijke klantrefund zijn afzonderlijke
feiten en statussen. Een administratieve credit is geen uitgevoerde terugbetaling.

De consument behoudt zijn wettelijke terugbetalingsrechten, onafhankelijk van
de interne commissieafrekening. Bij volledige herroeping van een gewone online
productkoop horen ook standaardbezorgkosten terug; bij deelretour kan dat anders
zijn. Geen algemene product-bedenktijd op reizen plakken.
[ACM: bedenktijd](https://www.acm.nl/nl/verkoop-aan-consumenten/klantenservice/bedenktijd).

**Eén begrijpelijke afrekening:** vóór akkoord verkoopbedrag, grondslag, percentage,
commissie, btw op commissie, providerkosten of onderbouwde raming, RTG-bijdrage en
verwachte partneruitbetaling tonen. Na uitvoering echte providerkosten/bewijzen
aansluiten en verschillen zichtbaar afhandelen. Prijs-/rol-/btw-/tariefversie
bevriezen; geen actuele catalogusprijs bij een oude order inlezen.

Rekenvoorbeeld zonder andere posten: product €121 inclusief 21% btw, grondslag
€100; aangenomen RTG-commissie-btw 21% en werkelijke kaartkosten €2,07.

| Commissieregime | Commissie ex btw | Btw op commissie | Partneruitbetaling na deze inhoudingen |
|---|---:|---:|---:|
| 15% | €15,00 | €3,15 | €100,78 |
| 5% | €5,00 | €1,05 | €112,88 |
| 0% | €0,00 | €0,00 | €118,93 |

Dit zijn kasbedragen vóór de eigen btw-afdracht en bedrijfskosten van de partner,
geen winstberekening. RTG's afzonderlijke Connect-kosten zijn niet afgetrokken.

#### 9.3.5 Aansluiting en objectieve acceptatie

Gebruik de bestaande Commercial Core, orderbronnen, betaalwaarheid, fiscale
profielen, herkomstrijen en bewijs-/vrijgaveregisters. Geen parallelle
commissiecalculator, reisledger of btw-autoriteit.

| Bestaande bron | Vereiste aansluiting vóór vrijgave |
|---|---|
| `server/kern/commercie/vergoeding.js` | Oude universele nulcommissie veilig migreren naar de vastgestelde matrix en contractscope; geen oude partnerrechten ongemerkt wijzigen. |
| `server/kern/commercie/btw.js` | Onbekend profiel valt nu terug op NL 21%; dat is geen geldige kwalificatie voor deze nieuwe factuurroute. Expliciet beoordeeld profiel vereisen en reis-/splitsingsregels aansluiten. |
| `server/kern/reisbureau-samenstelling.js`, `server/kern/reisbureau-geldrijen.js` | Economische eigenaar, daadwerkelijke ontvanger en fiscaal geclassificeerde grondslag gescheiden houden. Het veld `netto` bewijst geen prijs exclusief btw. |
| `server/kern/reisbureau-betaling.js`, `public/apps/juridisch/voorwaarden.html` | Eigen RTG-aanbod en gecombineerde betaling verbinden aan RTG's verantwoordelijkheid en bescherming; algemene 'alleen bemiddelaar/geen pakketreis'-claim niet als geldige dekking gebruiken. Zelfstandig elders gekochte reizen niet als RTG-verkoop behandelen. |
| `server/betaal/connect/afrekening.js`, `server/betaal/connect/indienen.js` | Ordergebonden nettoaanspraken, gecontroleerde accountbinding, menselijke goedkeuring, transfer en payout met hun eigen bewijs; geen onbewezen bankuitbetaling. |
| `server/betaal/naslag.js`, `server/kern/commercie/geldomkeer.js` | Klantrefund, commissiecredit en eventuele terughaalactie op eerdere partnertransfer afzonderlijk verbinden. De bestaande refundaanroep bewijst nog geen complete marketplace-correctie. |

Binnen P0/P3/P4/P6/P7 moeten minimaal de volgende proeven worden toegevoegd aan
de bestaande capability-/ketenbewijzen; de lijst is een acceptatiecontract,
geen nieuwe scenarioadministratie en geen verklaring dat de proeven al slagen:

1. Alle vier matrixvakken: grondslag €100 geeft €15/€15/€5/€0 commissie.
2. €100 minus €20 verkoperskorting geeft €12/€12/€4/€0. RTG-bijdrage verlaagt die
   €80 niet nogmaals; btw, fooi, terugbetaalbare borg en echte verzending blijven buiten.
3. Deelrefund van €40 grondslag uit die order crediteert €6/€6/€2/€0; volledige
   refund sluit exact, ook bij herhaling, kleine bedragen en meerdere deelretouren.
4. Eigen RTG-reis van €3.000 krijgt geen fictieve 15%/5%-commissie aan RTG zelf;
   zelfstandig elders geboekte reis of documentimport veroorzaakt geen inning.
   Binnen de commissievrije dekking van een betaald lid: geen verborgen ordermarge,
   ingehouden leveranciersbonus of verplichte servicefee vermomd als reiscomponent.
   De expliciete gratis-verkoperuitzondering blijft herkenbaar en wordt niet uitgebreid.
5. NL-platform 21%, EU-hoofdregel met verlegging, afzonderlijke eigen prestatie,
   reismarge en ontbrekend profiel leveren elk hun juiste, onderscheiden route.
6. Geen 1,21-deling van een volledige marge-reissom; historische vijfjaarskeuze
   wordt niet overschreven. Fiscale toerekening kan niet uit bestemming worden geraden.
7. 0%-order met echte PSP-kosten, reeds ingehouden kosten, RTG-fout en gewonnen
   dispute: geen dubbele last, verborgen opslag of onterechte partnerheffing.
8. Wisselende passen/prijsversies, onbekende status en gemengde aanbieders:
   oorspronkelijke afspraken blijven intact; ontbrekend bewijs blokkeert alleen
   de betrokken nieuwe financiële handeling en blijft zichtbaar.
   Geactiveerd termijncontract is betaald zonder twaalf vooruitbetaalde maanden;
   alleen een upgrade-aanvraag niet. Meerwerk herclassificeert geen oude regels.
   Aanbetaling zonder levering verdient geen commissie; gedeeltelijke levering
   en ontvangst vereisen dezelfde herleidbare regeltoerekening.
9. Refund na partnertransfer/payout, onvoldoende saldo en crash na provideracceptatie:
   geen dubbele refund, verdwenen schuld, kunstmatige groene status of weggepoetste reserve.
10. Nieuwe en ervaren ondernemer begrijpen vooraf grondslag, btw, kosten,
    uitbetaling en retourgevolgen; menselijke Premium Experience Gate blijft verplicht.

**Status:** intern definitief commercieel besluit; uitvoering en externe
acceptatie niet vrijgegeven. Door deze vaststelling is geen providerovereenkomst
geaccepteerd, fiscale dossierverklaring afgegeven, publieke voorwaarde
gepubliceerd, runtime aangepast of productbewijs groen verklaard.
Externe feiten moeten met bron en bevoegd akkoord worden aangeleverd; de concrete
vereisten hierboven vervangen de eerdere generieke 'nog uit te werken'-posten.

**Nog te verifiëren vóór toepassing, geen open prijsbesluiten:**

| Verantwoordelijke rol | Vereist bewijs binnen bestaande dossiers/poorten | Stand bij deze vaststelling |
|---|---|---|
| Bevoegd RTG-bestuur en contractbeheer | Juiste contracterende entiteit, geaccepteerde partner-/klantvoorwaarden, gedekte verkooproute, ingangsdatum en rechtenmigratie. | Niet geverifieerd; bestaande overeenkomsten niet gewijzigd. |
| Financieel verantwoordelijke met provider | Feitelijke Payments-/Connect-acceptatie, KYB, accountbinding, geaccepteerde geldrol/activiteiten en volledige tarief-/risicobijlage volgens §9.3.3. | Niet geverifieerd; API-sleutel of beleidskeuze is geen contractbewijs. |
| Fiscalist met financiële administratie | Toepasselijkheid en bestaande berekeningsmethode, onderbouwde btw-profielen, kosten-/bonusverdeling en factuurinrichting. | Niet geverifieerd; fiscale status blijft advies bij contractinrichting. |
| Reisverantwoordelijke met juridische beoordeling | Eigen reisovereenkomst, toepasselijke bescherming/dekking, informatie- en nazorgproces; geen ongefundeerde bemiddelaarsuitsluiting. | Niet geverifieerd; geen dekking of externe aansluiting geclaimd. |
| Domeineigenaren en onafhankelijke kwalificatie | Migratie en ketenproeven uit deze paragraaf, menselijke acceptatie en releasegebonden vrijgave via bestaande P0/P3/P4/P6/P7. | Niet uitgevoerd voor het nieuwe beleid; oude toetsen niet als nieuw bewijs gebruiken. |

Een niet-geverifieerde voorwaarde blokkeert de betrokken nieuwe verkoop- of
geldhandeling. Zij wist geen bestaande klant-, leverings- of herstelplicht.
Bewijzen blijven in de bestaande contract-, fiscale en vrijgavedossiers;
deze tabel is geen tweede akkoordregister. Publicatie, contractuitgifte en
activering vragen afzonderlijke controle; deze lokale vaststelling wordt niet
automatisch gedeployed, gepusht of naar partners verstuurd.

**Lokale verificatie, 12 november 2026:** `git diff --check` geslaagd;
documentstructuur, genoemde bronpaden en rekenvoorbeelden gecontroleerd.
`node --test test/commercie.test.js test/claims-btw.test.js test/betaaldienstfee.test.js test/connect-afrekening.test.js test/connect-takken.test.js test/connect-grootboek.test.js test/vrijgave-baseline.test.js`:
87 geslaagd, 0 mislukt. Deze bestaande toetsen bewaken de huidige kern en
nagemaakte providerinteractie; ze bewijzen niet de nieuwe commissiematrix,
reis-/btw-kwalificatie, een echte provideracceptatie of volledige klantketen.
Ook de oude nulcommissie en gratis-zakelijkblokkade zijn nog runtimebasis.
Geen testverwachting veranderd om nieuw beleid ten onrechte groen te laten lijken.

### 9.4 Rendabiliteit en vrijwillige groei

Meet de gratis zakelijke groep afzonderlijk: werkelijk verdiende rechtmatige
standaardcommissies en afzonderlijke dienstopbrengsten minus hosting, opslag, AI, support, verificatie,
fraude, orders, acquisitie en gedeelde kosten. Dezelfde commissie niet dubbel
aan koper én verkoper toerekenen. Bij verdeling tussen beide groepen de methode
vastleggen en het totaal laten aansluiten.

Latere Lite-conversie is extra commerciële waarde, geen opbrengst om gratis
vandaag kunstmatig winstgevend te verklaren. Zonder gezonde kostentoets aanbod
en capaciteit vóór verkoop aanpassen; geen verborgen heffingen, minder veiligheid
of verkoop van klantgegevens. Meet eerste bruikbare inrichting, eerste echte
verkoop, terugkerend gebruik, vrijwillige overstap, behoud en volledige kosten.
Geen conversiepercentage of gegarandeerde terugverdientijd zonder meting.

Marktankers, gelezen op 12 november 2026: [HubSpot](https://legal.hubspot.com/hubspot-product-and-services-catalog/free-tools)
combineert gratis CRM/basistools met betaalde uitbreiding; [SumUp](https://www.sumup.com/nl-nl/webwinkel/)
biedt een webshop zonder abonnementskosten met afzonderlijke transactiekosten.
Dat ondersteunt gratis als bruikbare instap, niet de claim dat RTG al beter of
winstgevend is. Tarieven van anderen zijn geen RTG-prijsbesluit.

### 9.5 Aansluiten zonder brede rechten of tweede backend

Gerichte statische broninspectie, geen productieaudit:

| Bestaande bron | Aansluiting die nodig is |
|---|---|
| `server/kern/commercie/capaciteiten.js`, `server/routes/member/partneraanmelding.js` | Gratis heeft nog geen partnercapaciteit. Expliciete gratis zakelijke basis toevoegen met organisatie-/rolcontrole, niet heel WorkOS openzetten. |
| `server/kern/commercie/zaakabonnement.js`, `server/routes/office/partners.js` | Ontbrekend abonnement kent Business-legacyterugval; een mislukte toekenning mag bij nieuwe gratis onboarding niet passeren. Organisatie en gratis profiel samen betrouwbaar vastleggen vóór toegang. Oude rechten afzonderlijk behouden. |
| `server/kern/commercie/routepoort.js`, `server/kern/onderneming/aanvraag.js` | Schaduwregels en standaardkeuze Business beoordelen over alle ingangen. Nieuwe gratis bedrijven mogen nergens onbedoeld brede betaalde rechten krijgen. |
| `server/routes/supplier/salon/publiceren.js` | Bestaande bedrijfspublicatie hergebruiken met beheerbevoegdheid, moderatie en bevestiging. Geen tweede sociaal domein. |
| `server/kern/commerce/koopbaar.js`, `server/kern/commerce/afrekening.js` | Bestaande aanbod- en verkooproutes gebruiken; geen tweede productcatalogus, orderboek of betaalweg. Salon-aanbieding is geen bevestigde order. |
| `server/kern/klantenboek.js`, `server/routes/member/onderneming-geld.js` | Bestaand klantenboek uitbreiden, niet vervangen. Het huidige boek projecteert eigen boekingen/bonnen met notities; algemene import van externe klanten is nog geen aangetroffen functie. Herkomst, deduplicatie, importpreview en privacy moeten worden afgebouwd. |

Klantgegevens blijven binnen bevoegde bedrijfscontext en het bestaande
kluis-/codenaambeleid. Een Salon-volger wordt niet vanzelf een CRM-contact;
een geïmporteerd contact is geen RTG-lid. Ordercontact geeft geen onbeperkte
marketingtoestemming of automatische gegevensdeling met RTG Travel.

Binnen P0–P7 kwalificeren: gratis eigenaar/onbevoegde medewerker/ander bedrijf;
concept versus gepubliceerd aanbod; order met retour; alle vier combinaties
van koper- en verkoperspas met 15%/15%/5%/0%; import zonder publicatie; upgrade/downgrade met
dossierbehoud; capaciteit bereikt zonder onverwachte rekening; en geen brede
Business-rechten via legacyterugval of schaduwpoort.

**Uitvoeringsstatus:** productbesluit en voorstel lokaal vastgelegd; geen
runtime-rechten, publieke prijsclaims, contracten of groene bewijsstatussen
gewijzigd. Berekenings- en afrekenregels staan in §9.3; concrete partneracceptatie,
fiscale dossierbeoordeling en providerbewijs blijven vereist. Exacte capaciteit
en Lite-inclusies blijven open tot vaststelling en aantoonbare uitvoering.
