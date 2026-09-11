# RTG Carrière

*De mens die waarde opbouwt rond zijn talent, naam, prestaties, publiek en
loopbaan — en waarom dat geen wereld, geen app en geen objecttype is.*

Lees dit vóór je iets bouwt voor een sporter, artiest, maker, model, acteur of
wie dan ook wiens talent zijn inkomen is. `RUGDEKKING.md` staat hieronder en
niet ernaast: dat beantwoordt één vraag uit deze laag (hoe heet het geld dat
naar een talent gaat), dit beantwoordt de vraag waaronder die valt.

**De kern in één zin: de carrièrelus is echt, maar zij is geen object — zij is
een verklaring van werkwoorden over domeinen die aantoonbaar niets delen.**

Dat is geen formulering maar een meetuitslag, en hij staat vooraan omdat het
hele ontwerp erop draait.

---

## 0. De meting die vóór alles gaat

Het voorstel rust op een bewering die aantrekkelijk klinkt:

> *"Een amateurvoetballer van 15, een dj van 22, een Olympisch sporter, een
> model, een creator en een acteur verschillen enorm — maar hun onderliggende
> lus is bijna dezelfde."*

Dat kán waar zijn. Of het waar ís, is een meting — en dit huis heeft precies
deze vraag al een keer verkeerd beantwoord. `Asset` klonk net zo
vanzelfsprekend over tafel, kamer, podium en leaseauto, en sneuvelde toen
`scripts/objectmodel.js` hem tegen de code hield.

Dus is het gemeten, met **dezelfde lezer** (`npm run carrierevorm`,
`CARRIEREVORM.json`) — een tweede parser zou binnen een maand een tweede getal
over hetzelfde geven, en dan is de vergelijking met de Asset-meting waardeloos.

| Wat | Uitslag |
|---|---|
| Bewaarde vormen in de talentdomeinen | 162 |
| Domeinen | 15 |
| Velden (envelop eraf) | 372 |
| Velden in **alle 15** domeinen | **0** |
| Velden in minstens **8** van de 15 | **0** |
| Velden in **precies één** domein | 328 (**88,2 %**) |

Ter ijking: platformbreed is 71 % van de velden domeineigen
(`OBJECTMODEL.json`). De talentdomeinen zijn dus **niet meer maar mínder**
verwant dan een willekeurige doorsnede van dit huis. Wat er wél gedeeld wordt,
haalt nooit boven 4 van de 15: `kanaal`, `capaciteit`, `geldigTot`, `kritiek`,
`open`.

**De meter is een mutatie aangedaan en hij bewoog**, zoals LAT.md regel 2
vereist: versmald tot `atelier`+`studio` slaat hij om naar 8 van de 10 velden
gedeeld en 20 % domeineigen — het spiegelbeeld. De nul is dus een meting en
geen kapotte lezer, en hij reproduceert onafhankelijk de enige gedeelde vorm
die `OBJECTMODEL.json` al had gevonden.

**Een `Career`-objecttype over deze vijftien domeinen is daarmee niet
gerechtvaardigd.** Wie hem toch bouwt, duwt 328 velden naar een `extra`-zak en
heeft vijftien keer werk in plaats van één keer.

---

## 1. Wat die nul wél betekent — en wat hij niet betekent

De nul zegt dat de lus geen **object** is. Hij zegt niet dat de lus niet
bestaat, want hij meet data en geen proces.

Dit huis heeft dat onderscheid al één keer eerder moeten maken, en het antwoord
lag toen op dezelfde plek. `COMMERCE.md` mat 437 koopbare vormen in 100
domeinen, vond **0** domeinen die alle acht werkwoorden uitvoeren, en trok
daaruit niet de conclusie "dan is er geen commerce" maar: *`Koopbaar` wordt een
**verklaring van werkwoorden** en geen interface van verplichte methodes.* Het
model daarvoor is `kern/appstore/machtigingen.js` — het enige bestand in dit
huis met een doel én een grens per item.

En `KETENVORM.json` wees dezelfde kant op: over drie ketens 0 van 13 gedeelde
actoren, maar 2 van 10 beloftethema's in álle drie — en **die twee gaan over de
machine en niet over het domein** (mag dit twee keer, en zegt een weigering
waarom).

Daar staat de scheidslijn van `OS.md` onder, en die is hier letterlijk de
architectuur: één grammatica mag over het **platformvermogen** en nooit over het
**domeinvermogen**. Een wedstrijd, een set, een casting en een shoot zijn
domeinvermogen — zes verschillende dingen die toevallig allemaal "optreden"
heten. Maar *namens iemand onderhandelen*, *een bewijs tonen zonder het dossier
te openen*, *een recht vastleggen met een gebied en een looptijd* en *geld
ontvangen met een besteding eraan* zijn platformvermogen, en die zijn wél één
ding.

**RTG Carrière is dus een werkwoordenlaag, geen datalaag.** Dat is precies wat
het voorstel bedoelt met *"niet een TalentOS bovenop 74 genres"* — de meting
geeft die intuïtie gelijk en zegt er bovendien bij wáárom.

---

## 2. De vijfde partij: hoedanigheid is geen identiteit

Het voorstel lost het probleem *lid óf zaak* op met contexten in plaats van
tabellen, en dat is de juiste vorm — hij is hier ook al besloten. `HDI.md` par.
5.1 verbiedt een `humans`-tabel, `KANTOOR.md` herhaalt het, en
`kern/levensgraaf/graaf.js` heeft de uitweg al gevonden: *dit is een PROJECTIE,
geen tweede database*, met vijf etiketten per stuk informatie waarvan `deel` een
**poort** is en geen etiket.

Er komt dus geen `careers`-tabel en geen `professional_person`-tabel. Een
hoedanigheid is een **lens op bestaande waarheid**, geen rij.

### De zes vragen, en waarom er maar drie bij de envelop horen

Het voorstel wil dat elke handeling zegt: *wie handelt, in welke hoedanigheid,
voor wie, met welk mandaat, met welk geld, met welk doel.* Naast `kern/envelop.js`
gelegd valt dat netjes in tweeën, en dat is een bruikbare bevinding en geen
detail:

| Vraag | Staat er? |
|---|---|
| Wie handelt? | **ja** — `actor`, en het is een codenaam |
| Waardoor? | **ja** — `correlatie` en `oorzaak` |
| Hoe gevoelig? | **ja** — `classificatie`, en `onbekend` is geen `openbaar` |
| In welke hoedanigheid? | **nee** |
| Voor wie (namens wie)? | **nee** |
| Met welk mandaat? | **nee** |
| Met welk geld? | **nee, en dat hoort zo** |
| Met welk doel? | **nee, en dat hoort zo** |

De envelop is met opzet **gesloten op acht velden** en zegt met opzet nooit
WAT — *"zodra er inhoud in een envelop mag, wordt hij binnen een jaar een tweede
berichtformaat."* Geld en doel zijn inhoud; die horen bij de handeling zelf, en
daar dragen `kern/waarde/` en `kern/commercie/voornemen.js` ze al.

Maar hoedanigheid, namens-wie en mandaat zijn géén inhoud — ze horen bij de
familie van `actor`. Dat maakt ze de enige eerlijke kandidaat voor een negende
tot elfde veld, en dat is **een besluit met een versiesprong**, niet een
toevoeging. Wie ze in de inhoud propt, heeft de grens van de envelop omzeild
zonder hem te veranderen.

---

## 3. Wat er van de zesendertig punten al staat

Niet geschat maar nagekeken. Het meeste van het voorstel bestaat, en dat
verandert de volgorde van het werk ingrijpend.

| Voorstel | Stand |
|---|---|
| Selective proof (scout krijgt ✓ zonder geboortedatum) | **staat** — `kern/rtgid-claims.js`: 18plus is een AFGELEID bewijs, de geboortedatum verlaat de kluis bij geen enkel niveau |
| Een feit draagt zijn herkomst | **staat** — `leeftijdBron`: `paspoort` of `opgegeven`, plus het betrouwbaarheidsniveau |
| Phishing-bestendige authenticatie | **staat half** — `server/webauthn/` bestaat, maar hangt (net als bij de kantoordeur) niet aan de zware handelingen |
| Mandaat dat alleen kan versmallen | **staat als grammatica** — `kern/stuur/mandaat.js`, met nul productie-aanroepers |
| Toegang als uitnodiging, met begin, eind en spoor | **staat** — `kern/command/bijstand.js` |
| Career Graph als projectie | **staat als vorm** — `kern/levensgraaf/graaf.js` |
| Carrièregeheugen / event provenance | **staat als keten** — `kern/envelop.js`: `correlatie` + `oorzaak` lopen vanzelf door |
| Contentbescherming | **staat deels** — `kern/drm.js` (Clear Key), maar dat is afspelen en geen herkomst |
| Opportunity als voorstel dat niets verplaatst | **staat als patroon** — `kern/commercie/voorstel.js`, `voornemen.js` |
| "Mijn carrière" als scherm | **staat** — genre `creator`, en dat is dus een samenvoegkandidaat en geen nieuw scherm |
| Rights Vault (naam, portret, stem, likeness) | **bestaat niet** |
| Contentherkomst (C2PA) | **bestaat niet** |
| Verifiable Credentials in een standaardformaat | **bestaat niet** — RTG iD doet selectieve deling in een eigen vorm |
| Mens-namens-mens mandaat | **bestaat niet** — zie `RUGDEKKING.md` par. 4.2 |
| Waardeklasse voor geld naar een mens | **bestaat niet** — 0 van 6 |
| Guardian / jeugdbestuur | **bestaat niet als laag** — wel de 18+-poort (`kern/spellen/grens.js`) |

**Over de vier standaarden die het voorstel noemt.** W3C Verifiable Credentials
2.0 en OpenID4VCI kan ik bevestigen; C2PA 2.4 en WebAuthn Level 3 als
Recommendation van 25 augustus 2026 vallen ná mijn kennishorizon en heb ik
**niet nageslagen**. Ze staan hier dus als `vermoed`, aangedragen door de
eigenaar — en niet als `gemeten`. Sla ze na vóór er een regel op gebouwd wordt;
dat is dezelfde regel als bij elke andere bewering in dit huis. De richting —
*liever een standaard dan een eigen RTG-certificaatformaat* — staat daar los van
en is juist.

---

## 4. De vijf plekken waar het voorstel tegen een bestaande grens loopt

Dit is de belangrijkste paragraaf van het document. Vier van de vijf zijn
repareerbaar door een vorm te kiezen die al bestaat; één is een hard nee.

### 4.1 De Career Independence Score botst met de scherpste grens die dit huis heeft

Het voorstel wil een **Career Independence Score** als platform-KPI, en een
Career State met `ONTWIKKELING +13 %` en `BEWIJSNIVEAU 87 %`.

Daar staat dit tegenover, en het staat er drie keer onafhankelijk:

- `KANTOORMACHT.md`: *een score op een mens draagt altijd zijn opbouw* en wordt
  nooit een sorteersleutel — niet op klanten en niet op medewerkers.
- `HDI.md`: *de meeteenheid is nooit de mens* — een voortgangsmaat mag over een
  cohort en nooit per persoon, **ook niet intern als sorteersleutel**.
- `ONTMOETEN.md` en `LIFE.md`: er komt geen cijfer op een mens.
- `INTELLIGENTIE.md` INT-04: een besluit draagt zijn **opbouw** en nooit een
  samengesteld cijfer — `confidence` en `novelty` zijn niet meetbaar, en
  vermenigvuldigen met een verzonnen getal is erger dan weglaten.

**En de vorm die wél overleeft, staat in het voorstel zelf: punt 32, het Career
Ledger.** Chronologisch, per regel bewijsbaar, met herkomst. Dat is geen
afgezwakte score maar een betere: "Nederlands kampioen junior 2027, geverifieerd
door bond X" zegt meer dan 87 %, en het veroudert niet stilletjes.

Dus: de zeven kapitalen uit punt 30 (capability, network, audience, financial,
IP, evidence, reputation) mogen bestaan als **zeven aparte, aanwijsbare
voorraden met hun opbouw** — nooit als één getal en nooit als sorteersleutel
over mensen. `+13 % afgelopen 90 dagen` is precies het getal dat niemand kan
navertellen; laat het weg en toon wat er in die 90 dagen gebeurd is.

*Let op: deze grens heeft vandaag **geen enkele handhaver** — hij staat in vier
documenten en in nul toetsen. Wie hem serieus neemt, bouwt hem als toets vóór de
eerste carrièremeter, niet erna.*

### 4.2 De fanladder is een trechter, en dat is precies wat LIFE.md verbiedt

Punt 24 stelt voor: *bekijkt → volgt → bezoekt → koopt → ondersteunt → lid →
ambassadeur.*

`LIFE.md` par. 4 zegt: **een relatie is geen trechter, en er komt geen score op
het leven tussen mensen.** Een ladder met zeven treden waarop een mens omhoog
kan, ís een trechter — ook als hij "relatietypes" heet.

De vorm die overleeft: **wat iemand heeft gedaan is een feit; waar hij "staat"
is een oordeel.** Een artiest mag zien dat 827 mensen een kaartje kochten en dat
41 mensen drie keer kwamen. Hij mag niet zien dat Jan "trede 4 van 7" is, en de
software mag Jan niet naar trede 5 duwen. Dat laatste is meteen ook de
`CLAUDE.md`-regel tegen verslavende engagement-patronen.

Punt 25 (demand aggregation — *827 mensen in Barcelona willen dit optreden*) is
wél schoon, op één voorwaarde die `ONTMOETEN.md` al stelt: **aanwezigheid is
zelf opgegeven en nooit afgeleid.** Wie het uit reisgegevens afleidt, heeft een
volgsysteem gebouwd.

### 4.3 Het merk zoekt geen mensen — het schrijft een programma

Punt 22 geeft als voorbeeld: *"jonge vrouwelijke amateurteamsporters in
Nederland die aantoonbaar doorgroeien maar financieel moeite hebben met
reizen."*

De bedoeling is goed en het mechanisme is fout. Dat is een zoekopdracht op
leeftijd, geslacht en een **afgeleide financiële situatie** — over minderjarigen.
Drie grenzen tegelijk: de jeugdgrens, `FOUNDATION.md` par. 5 (een
eligibility-motor mag alleen **toevoegen** en nooit zeggen "dit is niets voor
jou"), en de regel dat de meeteenheid nooit de mens is.

De vorm die overleeft is een omkering die het voorstel elders zelf al maakt:
**het merk beschrijft een programma, het talent meldt zich aan.** RTG toont het
programma aan wie eraan voldoet — toevoegen, nooit afstrepen — en de financiële
situatie wordt door de aanvrager zelf opgegeven en nooit afgeleid. Er ontstaat
dan geen doorzoekbare lijst van kwetsbare minderjarigen, en dat is het hele
punt: die lijst is het product dat niet mag bestaan.

### 4.4 Twee namen zijn bezet, en één daarvan is bezet door de grens die je aanroept

- **"RTG Human"** als laagnaam botst met `HDI.md` — RTG Human Development
  Infrastructure — en dat is nu juist het document waar de `humans`-tabelgrens
  vandaan komt. Twee lagen die allebei "Human" heten, is de fout van de twee
  `VERMOGENS` uit `OS.md`, nu op een laagnaam.
- **`HUMAN_DEVELOPMENT`** als waardeklasse botst met hetzelfde. `CAREER_GRANT`
  botst met niets en past bovendien op de bestaande conventie: de zes klassen
  heten `PERSONAL_FUNDED`, `EMPLOYER_BUDGET`, `MUNICIPAL`, `LOYALTY`, `GIFT`,
  `PARTNER_SETTLEMENT`.
- **"Mijn carrière"** is bezet door het `creator`-scherm — maar dat is een
  samenvoegkandidaat en geen botsing. `PLATFORM.md` par. 0b beslist het: is de
  Career Room een zelfstandige capability of een tweede ingang naar dezelfde?
  Bij `creator` is het aantoonbaar dezelfde, dus daar smelt het samen in plaats
  van ernaast te komen staan.

### 4.5 De agentic exchange leunt op een poort die vandaag niets tegenhoudt

Punt 11 laat agents kansen matchen vóór mensen tijd investeren, met de juiste
grens erbij (*AI ontdekt, ordent, simuleert en bereidt voor; macht blijft bij de
bevoegde mens*). Die grens is exact `FABRIC.md`.

Maar de poort waar die grens op rust, houdt vandaag niets tegen:
`VERTROUWEN.json` staat op **0 bewezen** en 4180 verzwakt, en `kern/stuur/beleid.js`
kent 0 `/api/office`-paden. `EXECUTIE.md` zegt daarom dat zo'n regel eerst in de
**schaduw** hoort te lopen. Dat maakt punt 11 niet fout, maar wel laat: hij komt
ná de bewijsschuld en niet ervoor — en dat is dezelfde reden waarom blok 7 en 9
van `EXECUTIE.md` bewust half en niet gebouwd zijn.

---

## 5. De doctrine

Vier zinnen uit het voorstel, hier verheven tot regel omdat ze alle vier een
fout beschrijven die in dit huis werkelijk gemaakt had kunnen worden. Met per
regel wie hem handhaaft — en waar dat vandaag niemand is.

| # | Regel | Handhaver |
|---|---|---|
| CAR-01 | **Een mens wordt nooit een onderneming gemaakt om een technische beperking op te lossen.** | niemand — vandaag is "word een zaak" de enige weg naar betaling (`RUGDEKKING.md` par. 1) |
| CAR-02 | **Een bevoegdheid wordt nooit verruimd om een workflow makkelijker te maken.** | `CONTROLPLANE.md` (delegatie kan alleen versmallen), `kern/stuur/mandaat.js` |
| CAR-03 | **Een gift wordt nooit commercieel gemaakt zonder van regime te veranderen.** | `kern/rtfos/herkomst.js` grendel 2, `kern/economie/firewall.js` |
| CAR-04 | **Professionele ondersteuning vergroot de zelfstandigheid van de mens, niet zijn afhankelijkheid van RTG.** | niemand — zie de uitstaptoets hieronder |
| CAR-05 | **Er komt geen cijfer op een carrière.** Zeven voorraden met hun opbouw, nooit één getal, nooit een sorteersleutel. | niemand — vier documenten, nul toetsen (par. 4.1) |
| CAR-06 | **De carrièregraaf is een projectie.** Geen `careers`-tabel, geen `humans`-tabel; `deel` is een poort. | `HDI.md` par. 5.1, vorm van `kern/levensgraaf/graaf.js` |

### De uitstaptoets, als toets en niet als voornemen

Punt 31 van het voorstel is het waardevolste idee erin, en het is machinaal te
maken. `RUGDEKKING.md` stelt de vraag al — *wat houdt deze mens over als wij
morgen stoppen met betalen?* — en punt 31 maakt er een keuringsregel van:

> Als RTG deze capability morgen uitschakelt, verliest de gebruiker dan alleen
> gemak, of verliest hij zijn eigen carrièrewaarde?

Dat is precies de vorm die `scripts/check.js` al tientallen keren draagt, en
het is toetsbaar in plaats van vroom: draagt elk carrière-onderdeel een
uitvoerweg (portfolio, credentials, contracten, mandaten, media-eigendom), en
zakt de keuring zodra er een bijkomt die dat niet doet. **Lock-in door
kwaliteit mag; lock-in door gijzeling zakt.**

---

## 6. De volgorde

| # | Onderdeel | Stand |
|---|---|---|
| 1 | De carrièrelus als werkwoordenlaag (geen objecttype) | **besloten door de meting** — par. 0 |
| 2 | De uitstaptoets als keuringsregel | **een stap weg** — de vorm staat in `check.js`, het is een regel erbij |
| 3 | CAR-05 als handhaver vóór de eerste carrièremeter | **staat voor deze laag** — `test/vertegenwoordiging.test.js` 17 en 18; huisbreed nog niet |
| 4 | Hoedanigheid + namens-wie + mandaat in de envelop | **een besluit** — de envelop is gesloten op acht; dit is een versiesprong |
| 5 | Mens-namens-mens mandaat (Representation Kernel) | **staat** — `server/kern/vertegenwoordiging/`, zie par. 6a |
| 6 | Mandaatsimulator (permissions-diff vóór accepteren) | **staat** — `simulatie.js` plus `/apps/vertegenwoordiging.html` |
| 7 | Guardian / jeugdbestuur, met eigen inzicht voor de jongere | **volgt op 5**, en `LEVEN.md` par. 2 staat erboven |
| 8 | `CAREER_GRANT` met drie soorten rugdekking (direct / beperkt / vrij) | **een besluit** — en `GIFT.md` staat ervóór |
| 9 | Rights Vault met gebied, kanaal, looptijd en exclusiviteit | **een besluit** — bestaat niet, en de conflictcontrole is de hele waarde |
| 10 | Career Ledger (chronologisch, bewijsbaar) | **volgt op 4** — de envelop draagt de keten al |
| 11 | Opportunity als één grammatica over vijftien soorten | **meet eerst** — dit is exact dezelfde claim als par. 0, en hij is nog niet gemeten |
| 12 | Contentherkomst (C2PA) en VC/OpenID4VCI | **sla eerst de standaarden na** — par. 3 |
| 13 | Agentic Opportunity Exchange | **jaren weg** — par. 4.5, ná de bewijsschuld |
| 14 | Carrièresimulatie (route A tegenover route B) | **jaren weg** — en alleen met de aannames in de uitslag |

De goedkoopste drie zijn 2, 3 en 6. Twee daarvan zijn grenzen en niet
functies — en dat is geen toeval: in deze laag is de grens het product.

---

## 6a. Wat er inmiddels staat: RTG Vertegenwoordiging

Nummer 5 en 6 zijn gebouwd (`server/kern/vertegenwoordiging/`, scherm
`/apps/vertegenwoordiging.html`, acht routes). De grammatica komt letterlijk uit
`kern/stuur/mandaat.js` — een tweede grammatica naast de eerste is precies de
fout die `SEMANTIEK.json` meet — en zeven regels staan in code in plaats van in
een afspraak:

1. **Versmallen is een doorsnede.** Een vertegenwoordiger kan structureel nooit
   meer dan de mens voor wie hij staat.
2. **Leeg is dicht.** Een machtiging zonder bevoegdheden bestaat niet.
3. **De lijst is gesloten.** Negen bevoegdheden, elk met een grond en met de
   vlag `klaarzetten` erbij; zeven dingen staan in NOOIT en zijn dus niet te
   vragen — geld, tekenen, de bankrekening, gezondheid, privéberichten,
   **delegatie**, en het pasbesluit.
4. **Verval is berekend en geen opruimactie.** Een stilstaande server verruimt
   niemands bevoegdheid.
5. **Aanvaarden doet de cliënt.** Er is geen pad waarlangs een vertegenwoordiger
   zijn eigen machtiging aanzet.
6. **De cliënt heeft een eigen plafond**, en dat raakt ook machtigingen die al
   lopen — een grens die alleen nieuwe machtigingen tegenhoudt, beschermt precies
   de mens niet die er al een heeft.
7. **Een geweigerde poging laat een spoor na.** Niet alleen wat er gelukt is: een
   vertegenwoordiger die drie keer iets probeerde wat hij niet mocht, is een
   gesprek waard.

Alle zeven zijn met een **mutatie** nagetrokken (LAT.md regel 2): elke regel is in
de bron omgedraaid, de suite zakte, en daarna weer groen. De CAR-05-grens uit par.
5 heeft daarmee zijn eerste handhaver — hij stond in vier documenten en in nul
toetsen.

**Wat deze functie vandaag GESLOTEN houdt, en dat is geen bijwerking.** De poort
is `volwassen()` uit `kern/volwassen.js`: een eigen account, 18 jaar of ouder,
**en RTG heeft het identiteitsbewijs gezien (A3)**. Een vers lid haalt die niet,
dus er kan vandaag geen machtiging worden afgegeven voordat iemand geverifieerd
is. Dat is met opzet — een machtiging waarmee iemand commercieel namens je
handelt, hoort niet te kunnen op een geboortedatum die je zelf hebt ingetypt —
maar wie deze laag uitrolt, rolt daarmee ook de verificatie uit. Het jeugdbestuur
(nummer 7) is bewust niet half gebouwd: dan tekent een vijftienjarige alsnog, met
een scherm ertussen dat zegt dat het goed zit.

**En er zit een les in die nergens anders herhaald moet worden.** De achttien
unittoetsen stonden groen terwijl `voorstel()` kapot was: `keyVanCodenaam` uit
`kern/gids.js` is **async en geeft een object**, en de code behandelde hem als een
synchrone functie die een sleutel teruggaf. Een Promise is waar, dus de 404 voor
een onbekend lid vuurde nooit en het verzoek liep door naar de 18+-poort met een
Promise als sleutel. De toets miste het omdat haar eigen fixture zich hield aan de
vorm die de code AANNAM in plaats van aan de vorm die de gids heeft — exact de
valkuil uit `CLAUDE.md` waar een cap groen bleef omdat een toets hem met verzonnen
invoer voedde. Gevonden door `test/vertegenwoordiging.e2e.test.js` tegen een
draaiende server, en dat is de reden dat die suite naast de unittoetsen bestaat en
niet in plaats daarvan.

## 7. Wat dit document NIET zegt

- Het zegt niet dat de carrièrelus niet bestaat. Het zegt dat zij gemeten geen
  **object** is, en dat de meting het proces niet heeft aangeraakt. Voor die
  tweede vraag is de vorm de ketenproef, en die is voor dit onderwerp **niet
  gedraaid** — zoals `KETENVORM.json` dat voor drie andere ketens wel deed.
- Het meet niet of de vijftien domeinen de goede vijftien zijn. De lijst staat
  in `scripts/carrierevorm.js` en is ruim gekozen: een domein dat er ten
  onrechte bij staat verlaagt de gedeeldheid, een ontbrekend domein verbérgt
  juist een gedeelde vorm. Dat is de veilige kant, maar het is een keuze.
- Het bevestigt twee van de vier genoemde standaarden niet (par. 3).
- Het zegt niets over bedragen, over welke sporter, of over wie een programma
  verdient. Selectie is mensenwerk, en er komt geen model dat het voorstelt.
- Het beweert niet dat de zestien bestaande bouwstenen uit par. 3 samen al iets
  vormen. Dat ze op dezelfde mens passen, is een ontwerpvraag en geen gemeten
  feit — precies dezelfde slag om de arm als in `RUGDEKKING.md` par. 8.
