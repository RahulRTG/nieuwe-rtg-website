# PRIJZEN.md — de commerciële architectuur van RTG

*Besluit van de eigenaar, 20 augustus 2026. Dit document vervangt geen enkele
prijs die ergens los stond; het maakt er één ladder van en zegt per bedrag
waaróm het dat bedrag is. `GELD.md` gaat over geld als besturingssysteem voor
het lid, dit document over wat RTG vraagt en waarvoor.*

**`COMMERCIE.md` is de architectuur onder dit document** — de Commercial Core:
zeven lagen, drie prijsmechanismen, en het onderscheid dat alles bij elkaar
houdt (catalogusprijs ≠ contractprijs ≠ factuurbedrag). Lees die als je aan de
structuur werkt; dit document als je een bedrag zoekt.

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
