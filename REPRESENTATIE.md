# RTG Representation & Execution Layer

*Richtingsdocument. Per onderdeel staat er of het **staat**, **een stap weg** is,
**een besluit vraagt** of **jaren weg** is — zoals `PLATFORM.md`, `ECONOMIE.md`,
`HDI.md`, `EXECUTIE.md` en `TRAVELCOMMERCE.md`. Wie die vier voor elkaar aanziet,
bouwt een jaar aan het verkeerde.*

De laag beantwoordt één vraag door het hele platform heen:

> Wie mag namens wie iets doen, waarom, tot hoever, met welk gevolg, en hoe wordt
> daarna bewezen dat de hele gebeurtenis correct is afgerond?

Dit document gaat **niet** over wat een talent IS (`CARRIERE.md`), niet over hoe
het geld heet dat naar hem gaat (`RUGDEKKING.md`), en niet over de grondwet van
menselijke vertegenwoordiging (`MENSNETWERK.md` — die staat hier onverkort
boven). Het gaat over de MACHINE eronder, en over de vraag of die machine er één
mag zijn.

---

## 0. De meting die vooraf gaat

De dragende bewering van het voorstel is punt 57:

> *"Bouw geen TalentManagerEngine. Bouw een Representation Engine. Dan kan
> dezelfde kern later werken voor ouder → kind, accountant → ondernemer, advocaat
> → cliënt, reisadviseur → reiziger, medewerker → werkgever, manager → artiest,
> zaakwaarnemer → voetballer, mantelzorger → familielid, assistent → directeur.
> Andere policies. Dezelfde machine."*

Dat **kan** waar zijn. Of het waar **is**, is een meting — en dit huis heeft die
vraag al vier keer gesteld en vier keer hetzelfde strenge antwoord gekregen:
`Asset` (`OBJECTMODEL.json`), de carrièrelus (`CARRIEREVORM.json`), `Moment`
(`STAGEVORM.json`) en `Manier` (`AANVOERVORM.json`). Elke keer klonk de bewering
vanzelfsprekend tot iemand telde.

Dus is er geteld: `npm run namensvorm` → `NAMENSVORM.json`, op de lezer van
`scripts/objectmodel.js` — want een tweede parser maakt de vergelijking met die
vier waardeloos, en juist die vergelijking draagt de conclusie.

### 0.1 Wat er gemeten is

<!--getal:namens.mechanismen-->7<!--/getal--> mechanismen waarmee in dit huis vandaag
iemand namens een ander handelt:

| mechanisme | wie handelt namens wie | waar |
|---|---|---|
| `vertegenwoordiging` | een mens namens een mens | `kern/vertegenwoordiging/` |
| `bijstand` | RTG namens een zakelijke klant, op uitnodiging | `kern/command/bijstand*.js` |
| `servicemachtiging` | een medewerker in het dossier van een melder | `kern/service/machtiging*.js` |
| `ai-mandaat` | een agent namens de mens die hem aanstuurt | `kern/stuur/mandaat.js` |
| `fiscaal-mandaat` | RTG namens een ondernemer, richting de Belastingdienst | `kern/fiscaal/gateway/mandaat.js` |
| `sepa-machtiging` | een incassant namens een rekeninghouder | `kern/machtiging.js`, `school/machtiging.js` |
| `app-machtiging` | een app van derden namens een lid | `kern/appstore/{machtigingen,winkel,besluit,naad,context}.js` |

Twee lijsten, zodat de uitslag niet op de lijst drijft (de les van
`carrierevorm.js`, die op een versmalling omsloeg van 0 naar 8): **smal** is
bovenstaande zeven, **ruim** telt er vier kennen-mechanismen bij — `levensband`,
`consent-center`, `rtgid-claims` en `ledenbalie-inzage`. Het voorstel behandelt
doen en weten als één laag (punt 12 en 44), dus worden ze ook samen gemeten.

### 0.2 De uitslag

**As 1 — de vorm.** Over de mechanismen die iets opslaan:
<!--getal:namens.inAlle-->0<!--/getal--> van
<!--getal:namens.velden-->50<!--/getal--> velden staan in álle mechanismen, 0 in
zelfs maar de helft, en <!--getal:namens.eigenPct-->90<!--/getal-->% in precies één.
Ruim gemeten: 0 van 73, en 93,2% in precies één.

**En die as is met opzet niet de dragende.** Er zijn maar tien bewaarde vormen
gevonden: deze mechanismen slaan wéinig op en beslissen véel. Een nul op tien
vormen is bijna gratis, en er een architectuurbesluit op bouwen is precies de
fout uit `BEWIJSMACHINE.md` par. 6a — een geldige uitslag van het verkeerde
experiment.

**As 2 — de werkwoorden.** Dit is de as die telt, en de vorm ervan komt uit
`COMMERCE.md`: daar werd `Koopbaar` geen interface van verplichte methodes maar
een *verklaring van werkwoorden*, omdat 0 van de 437 koopbare vormen alle acht
werkwoorden uitvoerde. Dezelfde vraag hier, langs zeven stappen die een
machtiging doorloopt — verlenen, aanvaarden, versmallen, intrekken, verlopen,
handelen, spoor:

| mechanisme | op naam | op synoniem | mist (ook op synoniem) |
|---|---|---|---|
| `vertegenwoordiging` | **7/7** | 7/7 | — |
| `bijstand` | 2/7 | 7/7 | — |
| `app-machtiging` | 3/7 | 5/7 | versmallen, spoor |
| `servicemachtiging` | 3/7 | 4/7 | aanvaarden, versmallen, spoor |
| `ai-mandaat` | 3/7 | 3/7 | verlenen, aanvaarden, intrekken, spoor |
| `fiscaal-mandaat` | 3/7 | 3/7 | aanvaarden, versmallen, handelen, spoor |
| `sepa-machtiging` | 0/7 | 3/7 | verlenen, versmallen, handelen, spoor |

Gemiddeld <!--getal:namens.gemiddeldOpNaam-->3<!--/getal--> op naam en
<!--getal:namens.gemiddeldOpSynoniem-->4.6<!--/getal--> op synoniem, van de zeven.
**<!--getal:namens.werkwoordenInAlle-->0<!--/getal--> werkwoorden staan onder dezelfde
naam in alle zeven mechanismen.** Precies één mechanisme voert de hele
grammatica: `kern/vertegenwoordiging/`.

### 0.3 Twee getallen die nooit worden opgeteld

`opNaam` en `opSynoniem` meten verschillende dingen en worden nergens tot één
cijfer geknepen (LAT-regel 11). De eerste vraagt of een mechanisme het werkwoord
draagt onder de naam die `kern/vertegenwoordiging/` eraan geeft — dat is de
**vocabulairevraag**. De tweede of het de stap onder *enige* naam voert die dit
huis ervoor gebruikt — de **dekkingsvraag**. Het verschil ertussen ÍS de
uitslag: de stappen bestaan grotendeels, de namen zijn uit elkaar gelopen.

Dat onderscheid is niet academisch. Met alleen de eerste lijst meldde de meter
dat `bijstand` 2 van de 7 stappen heeft, terwijl `stelVoor`, `besluit`, `betreed`
en `duurVan` gewoon in `bijstand-klant.js` staan. Een gemiste NAAM las als een
ontbrekende STAP, en dat zijn twee verschillende beweringen.

### 0.4 Wat deze meting niet aantoont

Ze leest bewaarde vormen en gedeclareerde namen — lexicaal, dus een
**ondergrens**. Ze zegt niets over of twee gelijknamige werkwoorden hetzelfde
DOEN: `verleen` in het fiscale mandaat en `voorstel` in de vertegenwoordiging
heten allebei verlenen en hebben een andere partij ervóór. Ze zegt ook niets over
of een mechanisme de stap elders heeft: `spoor` staat op 2/7, en de
servicemachtiging schrijft zijn tijdlijn aantoonbaar in `kern/service/loop.js` —
buiten het bereik van deze meter. Een 0 hier betekent *dit mechanisme draagt het
werkwoord niet zelf*, niet *er is geen spoor*.

En de zelfijking, want op een nul een besluit bouwen mag alleen als je kunt laten
zien dat de meter ook een niet-nul zou hebben gevonden: versmald tot `bijstand` +
`servicemachtiging` vindt hij wél gedeelde velden — en dat is precies wat de kop
van `kern/service/machtiging.js` zelf voorspelt (*"De vorm is gedeeld, de poort
niet"*). `test/namensvorm.test.js` houdt dat vast, samen met de besturingsproef
dat ook de ruime synoniemenlijst kan missen.

---

## 1. Het oordeel: geen engine, een verklaarde grammatica

De uitslag laat twee uitwegen open, en ze zijn niet gelijkwaardig.

**Wat niet mag: een `RepresentationMandate`-objecttype waar alle zeven onder
komen te hangen.** Nul gedeelde velden betekent dat elk mechanisme zijn eigen
kern naar een `extra`-veld wordt geduwd. Dat is letterlijk de `Asset`-fout, en
de prijs ervan staat in `PLATFORM.md`: wie erop bouwt heeft zeven keer werk in
plaats van één keer.

**Wat wel mag, en wat dit document voorstelt:** `kern/vertegenwoordiging/` is de
enige plek in dit huis waar de grammatica compleet is, en die grammatica wordt
**verklaard** in plaats van geërfd. Elk mechanisme zegt welke van de zeven
werkwoorden het voert, onder welke naam, en waar de stap woont als die buiten
het mechanisme ligt. Dat is de vorm van `kern/appstore/machtigingen.js` — het
enige bestand in dit huis met een doel én een grens — en van `Koopbaar` in
`COMMERCE.md`.

Wat er dus NIET komt: een gedeelde basisklasse, een `mandate.update()`, en een
kern die de zeven mechanismen aanroept. Wat er wel komt: een verklaring die
machinaal te toetsen is, zodat een achtste mechanisme niet stil kan ontstaan
zonder te zeggen wat het met `aanvaarden` doet.

### 1.1 De drie bevindingen die het ontwerp sturen

**`aanvaarden` is de zwakste schakel van het hele huis.** Eén mechanisme voert
het op naam, vier op synoniem. Zes van de zeven manieren waarop hier iemand
namens een ander handelt, hebben geen stap waarin de vertégenwoordigde ja zegt.
Dat is exact wat het voorstel in punt 2, 4 en 21 wil borgen, en de code zegt dat
het er grotendeels niet is. Het is ook de stap met de hoogste inzet: een
machtiging die de cliënt nooit heeft aanvaard, is geen machtiging maar een
sleutel.

**`spoor` is de op één na zwakste (2/7), en die twee horen niet door elkaar te
lopen.** Een ontbrekend `aanvaarden` is een BEVOEGDHEIDSgat; een ontbrekend
`spoor` is een BEWIJSgat. `MENSNETWERK.md` par. 0.6 heeft die tweede al een keer
duur betaald: `server/inzagelog.js` faalde open, en `noteer()` gaf een uitslag
terug die geen van de 42 aanroepers las. Regel 13 van `LAT.md` staat hierboven:
*een belofte over een spoor is pas een regel als het spoor kan weigeren.*

**`versmallen` staat op 2/7 en dat is het gevaarlijkst van de drie**, want het is
de regel waar het hele voorstel op leunt (punt 3, 6, 39, 56). `kern/stuur/
mandaat.js` en `kern/vertegenwoordiging/` voeren hem structureel — een mandaat
VERSMALT bestaand vermogen en verleent er nooit, de speelruimte is een doorsnede
en geen optelsom. De andere vijf doen dat niet, en bij `app-machtiging` en
`fiscaal-mandaat` is dat een echt gat: daar kan een machtiging in beginsel iets
toestaan wat de gever zelf niet mag.

---

## 2. Namen die al bezet zijn

Dit huis is vier keer gestruikeld over een naam die al een andere betekenis
droeg: `envelop` (`AFSPRAAK.md`), `moment` (`STAGE.md`), `manier`
(`MAATSTAF.md`), `doel` en `Pulse` (`KANTOOR.md`). Het voorstel introduceert er
ruim twintig, dus is er geteld vóór er iets heet. `bezet` is een waarschuwing
met een adres en geen verbod — of twee betekenissen botsen, leest een mens.

**Er wordt op TWEE assen geteld, en de tweede is er omdat de eerste alleen een
materieel fout antwoord gaf.** De eerste versie van deze paragraaf telde alleen
KALE identifiers, met de verklaring dat een samenstelling "een andere naam" is.
Dat klopt voor een naambotsing en is onwaar voor de vraag die een bouwer stelt.
Uitkomst: hier stond dat `principal` en `obligation` vrij waren, terwijl
`kern/economie/runtime/intent.js` velden `principalRef`, `actingRef` en
`obligationIds` draagt — en op grond daarvan is in dit document een naam
aanbevolen die al bezet was. Sinds 14 september staan de assen los:

- **kaal** — de identifier ÍS het woord. Dit is de naambotsing.
- **samengesteld** — het woord zit IN een langere identifier. Dit is het BEGRIP.

Ze worden nooit opgeteld, en er is een derde stand: **`bezet-samengesteld`** —
de naam is vrij, het begrip niet. Dat is precies de stand waarin je een tweede
motor bouwt naast een bestaande zonder het te merken.

| naam uit het voorstel | stand | waar hij al woont |
|---|---|---|
| `doel` | **bezet, zwaar** — 247 bestanden, 133 domeinen | levensdoel, AVG-doelbinding (`kern/identiteit/doelen.js`), en 26 andere |
| `contract` | **bezet** — 44 bestanden | `kern/commercie/contract.js` is een volwaardige overeenkomstmotor |
| `capability` | **bezet** — 34 bestanden | `OS.md`: platformvermogen, náást genre-cap (domeinvermogen) |
| `machtiging` | **bezet, vierdubbel** | SEPA-incasso, app-rechten, supporttoegang, mens-namens-mens |
| `mandaat` | **bezet, dubbel** | AI-autonomie (`kern/stuur/mandaat.js`), fiscale volmacht |
| `risico` | **bezet** — 50 bestanden | o.a. `kern/appstore`, `kern/command` |
| `zekerheid` | **bezet** — 23 bestanden | fiscale zekerheidsklassen, `kern/identiteit/vertrouwen.js` |
| `intent` | **bezet** — 17 bestanden | `kern/economie`, `kern/experience`, `kern/fluister` |
| `gevolg` | **bezet** | `kern/stuur/gevolg.js` — de effectmeting van een plan |
| `envelop` | **bezet, gesloten op acht velden** | `kern/envelop.js`, en die zegt met opzet nooit WAT |
| `projectie` | **bezet** | `kern/levensgraaf/graaf.js` en `kern/carriereledger/projectie.js` |
| `settlement` | **bezet** — 9 kaal, 16 samengesteld | `kern/economie`, `kern/fonds` |
| `claim` | **bezet** — 23 kaal, 37 samengesteld | o.a. `kern/appstore`, de economic runtime |
| `principal` | **bezet** — 2 kaal, en samengesteld | `kern/economie/runtime` (`principalRef`), `kern/experience` (een hash-pseudoniem) |
| `assurance` | **bezet** — 3 bestanden | `kern/identiteit`, `kern/kantoor` |
| `outbox` | **bezet** — 1 bestand | `kern/intreksignaal` |
| `obligation` | **bezet-samengesteld** | `obligationId`, `obligationIds`, `obligationPayId` in de economic runtime |
| `opportunity` | **bezet-samengesteld**, zwak | alleen `opportunityCost` — een economische term, andere betekenis |
| `hoedanigheid` | **vrij buiten deze laag** | drie bestanden, alle drie `kern/vertegenwoordiging/` |
| `mechanism` | **genomen door deze laag** op 14 september | `kern/namens/projectie.js`; hij was vrij, en dit is de laag die hem nam |
| `saga` | **vrij** | — |

Vier gevolgen die niet mogen verwateren:

1. **`principal` is NIET vrij, en de botsing is van de gevaarlijke soort.**
   `kern/economie/runtime/intent.js` draagt `principalRef` en `actingRef` voor
   exact dit begrip — wie handelt, namens wie — terwijl
   `kern/experience/contexts.js` `principal(key)` gebruikt voor iets heel
   anders: een gehasht pseudoniem van een sessiesleutel. Eén woord, twee
   betekenissen, en de ene is precies wat deze laag nodig heeft. Zie par. 3.1:
   de conclusie is niet *kies een andere naam* maar *sluit aan op de bestaande*.
2. **Van de zes velden van het voorgestelde canonieke object was `mechanism`
   het enige dat vrij was** — en niet toevallig ook het enige dat de economic
   runtime mist. `principalRef`, `actingRef`, `authorityRef` en `purpose` staan
   er al onder die exacte namen, en `kern/namens/projectie.js` neemt ze over in
   plaats van er een tweede stel naast te zetten. Sinds die laag er staat is
   `mechanism` zelf bezet, door haar. Van de 33 gemeten woorden is er nu nog
   één vrij: `saga`.
3. **`hoedanigheid` is vandaag alleen bezet door deze laag zelf**, en
   `kern/envelop.js` draagt wél `actor` en géén hoedanigheid. Dit is dus de
   eerste plek waar MN-02 hard te bewijzen is — maar een hoedanigheid in de
   envelop is een **versiesprong** op een envelop die gesloten is op acht
   velden, geen toevoeging (`CARRIERE.md` par. 6).
4. **`doel` is onbruikbaar als nieuwe kernnaam.** Punt 44 (purpose-bound access)
   bestaat al en heet `kern/identiteit/doelen.js`, met vier gronden waarvan er
   één een keuze is. Een tweede `doel` in deze laag is de duurste botsing die
   `SEMANTIEK.json` kent.

---

## 3. Wat er al staat, onder een andere naam

### 3.1 De economic runtime — het canonieke object bestaat al, half

De naamcorrectie hierboven legde iets bloot dat groter is dan een naam.
`server/kern/economie/runtime/` (acht bestanden, aangeroepen door
`kern/fonds.js`) draagt een `intent` met deze velden:

```
principalRef · actingRef · purpose · sourceRef
authorizationContext { authorityRef, limitsSnapshot }
policySnapshot { decisionId, policyId, version }
economicContext { experienceWorld, economicWorld, domain, capability }
state { intent, authorization, commitment, fulfillment, financial,
        allocation, settlement, reconciliation, evidence, recovery, lifecycle }
commitmentIds · obligationIds · claimIds · ledgerTransactionIds
idempotency { key → fingerprint }   (botsing op dezelfde sleutel = 409)
```

Leg dat naast het voorgestelde canonieke object en naast de 57 punten:

| voorgesteld | staat in de economic runtime als |
|---|---|
| `principalRef` | `principalRef` |
| `actorPrincipalRef` | `actingRef` |
| `representedPrincipalRef` | `principalRef` (het paar draagt beide rollen) |
| `authorityRef` | `authorizationContext.authorityRef` |
| `purpose` | `purpose` |
| `mechanism` | **ontbreekt** — en het is het enige veld waarvan de naam vrij is |
| punt 40 policy snapshots | `policySnapshot` met `version` |
| punt 16/17 obligations | `obligationIds`, `commitmentIds`, `claimIds` |
| punt 19 idempotency | `idempotency` met fingerprint-conflict |
| punt 46 reconciliation | `state.reconciliation`, plus `runtime/reconciliatie.js` |
| punt 45 herstel | `state.recovery` |
| punt 26 double-entry | `ledgerTransactionIds` |

**Dat verandert de opdracht van bouwen naar aansluiten, en het verscherpt de
grens.** Deze runtime is de ECONOMISCHE weg: hij bestaat om een bevestigde
betaling te verdelen, en `settlement.js` is als enige toegestaan extern geld te
verplaatsen. Hem uitbreiden tot de algemene representatielaag zou van een
geldmotor een bevoegdheidsmotor maken — precies de vermenging die
`WAARDE.md` en `GELD.md` tegenhouden.

De uitweg is dezelfde die dit document in par. 1 al koos, nu met een tweede
reden: de representatielaag krijgt **geen eigen canoniek object** maar
**projecteert naar dezelfde veldnamen**. Eén taal voor audit, beleid en
conflictcontrole; twee motoren die niets van elkaar overnemen. Wie in plaats
daarvan een tweede `principalRef` met een eigen betekenis invoert, heeft de
`VERMOGENS`-botsing gemaakt op het centrale veld van twee lagen tegelijk.

Wat daarbij niet mag verdwijnen: dit is **geen bewijs dat de economic runtime
de zeven namens-mechanismen dekt.** Hij kent ze niet. `NAMENSVORM.json` meet ze
apart en vindt daar 0 gedeelde velden; deze paragraaf zegt alleen dat de VORM
waarin je erover praat al bestaat en al bezet is.

Dit is de goedkoopste paragraaf van het document, en de vorm ervan komt uit
`HDI.md` par. 1 en `EXECUTIE.md`: **het werk is aansluiten en niet uitvinden.**

| punt uit het voorstel | bestaat als | stand |
|---|---|---|
| 6 Policy Decision Point | `kern/stuur/beleid.js` + `kern/commercie/rechten.js` (nominaal náást effectief) | staat, maar kent 0 `/api/office`-paden |
| 7 intent vóór capability | `kern/stuur/resolver.js` → `plan.js`; dekking 100% (`npm run resolverbereik`) | staat |
| 8 step-up authentication | `kern/webauthn-stapop.js` — de ceremonie draagt een DOEL, en die binding is de hele module | staat, hangt niet aan de kantoordeur |
| 9 passkeys als primaire identiteit | `server/webauthn/` + `kern/webauthn.js` | staat, is niet primair |
| 10 Identity Assurance Engine | `kern/identiteit/vertrouwen.js` — vijf standen, *een conclusie is nooit harder dan haar zachtste premisse* | staat |
| 12 selective disclosure | `kern/rtgid-claims.js` + `kern/rtgid-bewijs.js` (`/apps/bewijsmap.html`) | staat |
| 16 contract compilation | `kern/commercie/contract.js` — acht standen, expliciete overgangstabel, bevroren prijs | staat, **0 lezers buiten de module** |
| 18 event-driven kern | `kern/envelop.js` — id, tijd, versie, kanaal, actor, correlatie, oorzaak, classificatie | staat |
| 19 idempotency | `lib/idemsleutels.js`, `IDEMPROEF.json` | staat |
| 22 risk engine | `kern/frictie/motor.js` — hand/assist/auto, mét de score-opbouw | staat |
| 24 economic rights | `kern/waarde/klassen.js` — zes waardeklassen, elk met een grond | staat |
| 26 double-entry ledger | RTG Pay boekt dubbel (`kern/pay/bakken.js`, `kern/geldwereld.js`) | staat |
| 27 geen delete voor geld | `kern/commerce/retour.js`, `kern/horeca/correctie.js` — compensatie, nooit wissen | staat |
| 35 Carrière Ledger 2.0 | `kern/carriereledger/` — feit, bevestiging, intrekking; één schrijver | staat |
| 40 policy snapshots | `kern/commercie/voornemen.js` — een goedgekeurd plan kan niet meer veranderen | staat |
| 41 cryptografisch auditspoor | `lib/keten.js` + `lib/keten-anker.js` | staat; **het anker is een besluit** |
| 43 data classification | `kern/beschermzaak/klasse.js` — en die WEIGERT, hij filtert niet | staat, alleen voor die dataklasse |
| 44 purpose-bound access | `kern/identiteit/doelen.js` — vier gronden, één keuze | staat, loopt in de schaduw |
| 45 herstelbaarheid per capability | `HERSTEL.json` + `HERSTELPROEF.json` — 90 paren echt uitgevoerd | staat |
| 47 machine-dekkingscontract | `kern/mutatiecontract/klassen.js`, `claims.poort()` | staat |
| 49 één correlationId per gebeurtenis | `kern/envelop.js`: `correlatie` + `oorzaak`, keten loopt vanzelf door | staat |
| 52 "what happens if I press this?" | `kern/vertegenwoordiging/simulatie.js` — de permission-diff, mét wat er NIET opengaat | staat |
| 54 digital twin | `kern/command/simulatie.js`, `kern/spellen/magnaat/` | staat |

Wat werkelijk **nergens** bestaat, en dat zijn er vier:

- **punt 37, de conflict-of-interest engine.** Nul treffers. Dit is het enige
  onderdeel van het voorstel dat geen enkele concurrent in dit huis heeft, en het
  is precies wat een managementbureau echt vraagt.
- **punt 19/18, de outbox.** Er is geen enkele plek waar een databasemutatie en
  een gebeurtenis in één transactie landen. `kern/envelop.js` levert, maar de
  levering gaat met opzet vóór — een geweigerde actor houdt een melding nooit
  tegen.
- **punt 20, de saga.** Er is geen duurzame workflow die een herstart overleeft.
  `kern/service/loop.js` is het dichtstbijzijnde en is een tijdlijn, geen
  orkestrator.
- **punt 46, de reconciliation engine.** `UNKNOWN_EXTERNAL_OUTCOME` bestaat niet
  als stand; `CONTROLPLANE.md` kent wel `ONBEKEND` en zegt met zoveel woorden dat
  dat géén synoniem van `WEIGEREN` is. Dat is de haak.

---

## 4. De zevenenvijftig punten, met hun stand

*Staat* = gebouwd en in gebruik. *Een stap weg* = het onderdeel bestaat, alleen
niet bedraad. *Vraagt een besluit* = de eigenaar moet iets kiezen voordat er code
in kan. *Jaren weg* = er ontbreekt een getal of een laag waar dit op leunt.

| # | onderwerp | stand |
|---|---|---|
| 1 | de universele hoofdloop | **jaren weg** — hij kruist vier ketens die 0 van 33 actoren delen (`KETENVORM.json`) |
| 2 | Principal boven account | **een stap weg** — `principalRef`/`actingRef`/`purpose`/`authorityRef` staan al in de economic runtime (par. 3.1); alleen `mechanism` ontbreekt, en alleen die naam is vrij |
| 3 | capability grants met context | **een stap weg** — `kern/vertegenwoordiging/bevoegdheden.js` heeft 9 sleutels, `kern/stuur/mandaat.js` heeft de context |
| 4 | mandaten als objecten met versies | **een stap weg** — de levenscyclus staat, de VERSIE niet |
| 5 | NOOIT-lijst technisch sterker | **een stap weg** — de lijst staat (7 items, elk met een adres), hard-deny als voorrangsregel niet |
| 6 | PDP + PEP | **een stap weg** — `beleid.js` is de PDP, de PEP's zijn 3282 routes |
| 7 | intent vóór capability | **staat** |
| 8 | step-up authentication | **een stap weg** — `webauthn-stapop.js` bestaat, de AAL-ladder niet |
| 9 | passkeys primair | **vraagt een besluit** — degraderen van wachtwoorden raakt elk account |
| 10 | Identity Assurance Engine | **een stap weg** — vijf standen bestaan, capabilities noemen er geen |
| 11 | verifiable credentials | **vraagt een besluit** — alleen waar overdraagbaar bewijs waarde heeft |
| 12 | selective disclosure | **staat** |
| 13 | Opportunity Engine | **vraagt een besluit** — de naam is vrij; of het één object mag zijn is een méting en geen ontwerp |
| 14 | Deal Room met projectie per deelnemer | **een stap weg** — de projectievorm staat in `kern/levensgraaf/graaf.js` |
| 15 | delta contracts | **een stap weg** — `contract.js` heeft de standen, niet de diff |
| 16 | contract compilation | **een stap weg** — acht standen, nul lezers buiten de module |
| 17 | obligation graph | **een stap weg voor de geldweg, jaren weg daarbuiten** — `obligationIds`/`commitmentIds`/`claimIds` bestaan in de economic runtime (par. 3.1), maar alleen voor een bevestigde betaling |
| 18 | event-driven kern | **staat** |
| 19 | outbox + idempotency | **half**: idempotency staat (huisbreed én met fingerprint-conflict in de economic runtime), outbox bestaat niet |
| 20 | saga / workflow orchestration | **jaren weg** |
| 21 | human-in-the-loop als primitief | **een stap weg** — `WAITING_FOR_CLIENT_APPROVAL` is in deze laag `voorgesteld` |
| 22 | risk engine | **staat** |
| 23 | continuous authorization | **een stap weg** — `kern/commercie/lidpoort.js` doet dit al in de schaduw |
| 24 | settlement graph | **staat** als waardeklassen; de graaf niet |
| 25 | economische waarheid ≠ geldbeweging | **staat** — `kern/waarde/reserve.js` naast `oormerk.js` |
| 26 | double-entry | **staat** in RTG Pay |
| 27 | geen delete voor geld | **staat** |
| 28–31 | managerscockpit, command center, universal inbox, command palette | **vraagt een besluit** — zie par. 6 |
| 32 | AI krijgt geen eigen macht | **staat** — `kern/stuur/mandaat.js`, en `FABRIC.md` par. 5 |
| 33 | AI-output is typed | **staat** — `kern/stuur/plan.js` |
| 34 | confidence ≠ authority | **staat als regel** (INT-04), **nul handhavers** |
| 35 | Carrière Ledger 2.0 | **staat** |
| 36 | portable reputation | **een stap weg** — `rtgid-claims.js` + het ledger |
| 37 | conflict-of-interest engine | **bestaat niet, en is het enige onderdeel zonder concurrent** |
| 38 | minderjarigen als eigen graph | **staat** — `kern/vertegenwoordiging/jeugd.js` |
| 39 | temporal authorization | **een stap weg** — `effectiveAt` bestaat nergens |
| 40 | policy snapshots | **een stap weg** — `policySnapshot` met `version` staat in de economic runtime, en `voornemen.js` bevriest een goedgekeurd plan |
| 41 | cryptografisch auditspoor | **staat**; het externe anker **vraagt een besluit** |
| 42 | zero-trust intern | **jaren weg** — er zijn geen workload-identities |
| 43 | data classification | **een stap weg** — bestaat voor één dataklasse |
| 44 | purpose-bound access | **staat**, in de schaduw |
| 45 | herstelbaarheid per capability | **staat** als meting, niet als contract |
| 46 | reconciliation engine | **bestaat voor de geldweg** — `runtime/reconciliatie.js` en `state.reconciliation`; daarbuiten niet |
| 47 | machine-dekkingscontract | **een stap weg** |
| 48 | observability op businessniveau | **een stap weg** — `kern/service/` par. 12 heeft de maat |
| 49 | één correlationId | **staat** |
| 50–53 | UX: één ding tegelijk, waarom zie ik dit, wat gebeurt er, preview-first | **staat als vorm** (`simulatie.js`, `GRAMMATICA.md`), niet als scherm |
| 54 | digital twin van workflows | **staat** voor de ops-cockpit |
| 55 | de managerorganisatie | **vraagt een besluit** — het genre bestaat niet (zie par. 6) |
| 56 | delegatie zonder doormachtiging | **een stap weg** — `NOOIT` verbiedt delegatie al; de driehoek talent → bureau → medewerker niet |
| 57 | generiek genoeg voor heel RTG | **beantwoord in par. 0 en 1: als verklaring wel, als engine niet** |

---

## 5. De grenzen

Acht regels, met per regel **wie hem handhaaft** — en waar dat vandaag niemand
is, staat dat er. Dat laatste is de helft die ertoe doet: `KANTOOR.md` par. 13
telt zes wetten zonder handhaver, en `MENSNETWERK.md` drie.

**REP-01 — Er komt geen achtste mechanisme zonder verklaring.** Wie een nieuwe
manier bouwt waarop iemand namens een ander handelt, verklaart welke van de zeven
werkwoorden hij voert, onder welke naam, en waar de stap woont als die elders
ligt. *Handhaver: `test/namensvorm.test.js` toets 3 — vandaag alleen op de
bestaande zeven. Een verklaringsregister bestaat nog niet.*

**REP-02 — `aanvaarden` is geen stap die je kunt overslaan.** Een machtiging die
de vertegenwoordigde niet zelf heeft aanvaard, bestaat niet. Er is geen pad
waarlangs de gemachtigde, het kantoor of de AI dat voor hem doet. *Handhaver:
`kern/vertegenwoordiging/acties.js` (`aanvaard()` leest de sessiesleutel van de
cliënt) — en voor de andere zes mechanismen **niemand**.*

**REP-03 — Een mandaat verleent nooit vermogen, het versmalt.** De speelruimte is
een doorsnede en geen optelsom; leeg is dicht en niet open. *Handhaver:
`kern/stuur/mandaat.js` en `kern/vertegenwoordiging/handelen.js`. Voor
`app-machtiging` en `fiscaal-mandaat`: **niemand**.*

**REP-04 — De NOOIT-lijst wint van elke grant.** Ook van `"*": allow`. Wat erin
staat is niet gevaarlijk-klinkend maar ELDERS besloten, en elk item noemt waar
die grens woont. *Handhaver: `kern/vertegenwoordiging/bevoegdheden.js` +
`NOOIT_AUTONOOM` in `kern/stuur/mandaat.js`. Als voorrangsregel over alle zeven:
**niemand**.*

**REP-05 — Geen aantoonbaar spoor, geen handeling.** Niet "er wordt gelogd" maar:
de handeling gaat niet door als het spoor niet vaststaat. Dit is `LAT.md` regel
13, en `MENSNETWERK.md` par. 0.6a heeft hem al een keer duur betaald.
*Handhaver: `kern/ledenbalie-inzage.js` via `inzagelog.noteerVast()`. Voor deze
laag: `kern/vertegenwoordiging/` legt duurzaam vast, de andere zes **niet
aantoonbaar**.*

**REP-06 — De meeteenheid is nooit de mens.** Geen score op een cliënt, geen
ranglijst van talenten, geen bijdragegrafiek per persoon — ook niet intern als
sorteersleutel. RTG meet wat een PROGRAMMA oplevert. *Deze regel staat inmiddels
in `KANTOORMACHT.md`, `HDI.md`, `ONTMOETEN.md`, `CARRIERE.md`, `STAGE.md` en
hier — zes documenten, en `scripts/lib/cijferopmens.js` is de enige aanzet tot
een handhaver.*

**REP-07 — De AI kan nooit meer dan de principal die hem aanstuurt.** Hij stelt
voor, een deterministisch systeem beslist. `confidence` is epistemisch,
`authority` is juridisch, en die twee worden nergens vermengd. *Handhaver:
`kern/stuur/beleid.js` + `test/aicontext-allowlist.test.js`. Voor het
vermengingsverbod zelf: **niemand** (INT-04).*

**REP-08 — Een organisatorische relatie vervangt geen menselijke toestemming.**
Werken bij het bureau dat een talent vertegenwoordigt, geeft geen toegang tot dat
talent: je hebt organisatiebevoegdheid ÉN cliëntmandaat nodig. *Dit is MN-01 uit
`MENSNETWERK.md`, en die is sinds 13 september een toets met tien bewijsgevallen —
de enige regel in deze lijst met een bewezen handhaver.*

---

## 6. De volgorde

De maatstaf is niet "wanneer heeft RTG een Representation Layer" maar: **wanneer
kan RTG van een handeling namens een ander vooraf zeggen wat er verandert,
achteraf bewijzen dat het gebeurd is, en hem terugdraaien als het misging.**

### 6.0 Wat er sinds 14 september staat: de contractlaag

`server/kern/namens/` — vijf bestanden, **geen opslag, geen routes, geen
sessie**. Alle drie de onderdelen zijn puur, en dat is met opzet: zo verandert
er vandaag niets aan gedrag, en is elk besluit te beproeven zonder een server
op te starten (de vorm van `kern/economie/firewall.js` en
`kern/rugdekking/soorten.js`).

**`versmalling.js` — REP-03 als machinewet.** `effectief = gevraagd ∩
geverEffectief ∩ beleid ∩ context`, met `overtreding()` als controleerbare
bewering die in de BRON woont en niet in de toets. Een gegenereerde proef laat
500 willekeurige invoeren langs die wet lopen; privilege-amplification kan
structureel niet ontstaan, want een doorsnede voegt niets toe. Drie dingen liggen
daar vast: **leeg is dicht**, **`null` is iets anders dan `[]`** (onbekend is
geen weigering — `CONTROLPLANE.md`), en een bron van het verkeerde type is
**stuk** en niet leeg, zodat een typefout in een aanroeper niet leest als "deze
gever mag niets".

**`verklaring.js` + twee lijsthelften — REP-01 en REP-02.** Per mechanisme per
werkwoord één van drie standen, en de middelste is de hele reden dat het
bestaat: `voert` (met `waar`), **`nietVanToepassing` (met een GROND)**, of
`ontbreekt` (met `wat`). Zonder die middelste stand is elk ontbrekend werkwoord
een gebrek, en dan wordt een register dat vol schuld staat binnen een maand
genegeerd. Een `aanvaarden` op `voert` beantwoordt bovendien zeven vragen — wie
geeft, wie ontvangt, wie aanvaardt, welke versie, wanneer, welk bewijs, en wat
er bij intrekking met het verleden gebeurt.

**`projectie.js` — de gedeelde taal.** Zes velden, waarvan er vijf letterlijk
uit `kern/economie/runtime/intent.js` komen. De codenaamzeef is `keurActor` uit
`kern/envelop.js`, hergebruikt en niet nagebouwd, en `purpose` wordt geëist en
nooit geraden.

Wat de standen vandaag zeggen: `aanvaarden` staat **nergens meer op
`ontbreekt`** — waar het niet gevoerd wordt, is dat nu een uitgeschreven grond.
Open staan er acht posten: **`versmallen`** bij app-, fiscaal- en
sepa-machtiging, **`spoor`** bij ai-, fiscaal- en sepa-mandaat, en `verlenen` +
`intrekken` bij het ai-mandaat.

**Eén correctie op een eerdere versie van deze paragraaf.** Daar stond dat het
verklaringsregister *afgeleid* moest worden uit de code, "zoals `WETTEN.json`".
Dat is onjuist en het is belangrijk genoeg om niet stil te herschrijven: een
GROND waarom aanvaarding ergens niet hoort — "de gever en de aanvaarder zijn
dezelfde mens", "dit huis heeft geen incassorail" — is een menselijk oordeel dat
geen parser kan afleiden. Het register is daarom een VERKLARING, en
`scripts/namensvorm.js` de METING ernaast. `test/namensverklaring.test.js` legt
ze naast elkaar en eist **niet** dat ze het eens zijn: hij eist dat elke
afwijking is opgeschreven. Zou hij gelijkheid eisen, dan is er maar één uitweg —
de verklaring uit de meting genereren — en dan vergelijkt hij zichzelf. Dat is
de vorm van `EIGENAAR` naast `detecteer()` in
`scripts/lib/registereigenaar.js`, niet die van `WETTEN.json`.

### 6.2 Wat er nu open staat

1. **`aanvaarden` en `spoor` BEDRADEN bij de zes.** De contractlaag zegt nu wie
   wat voert; wat er nog niet is, is dat de mechanismen er doorheen lopen. Dit
   is echte gedragswijziging op onder meer SEPA-mandaten en app-rechten, en
   hoort daarom een eigen ronde te zijn.
2. **`versmallen` bij `app-machtiging` en `fiscaal-mandaat`.** Twee van de drie
   openstaande `versmallen`-posten, en REP-03 is de regel waar het hele voorstel
   op leunt. De invariant staat er nu; wat ontbreekt is dat die twee hem
   aanroepen met een echte `geverEffectief`.
3. **De conflict-of-interest engine (punt 37).** Het enige onderdeel zonder
   concurrent, en het enige dat een managementbureau écht onderscheidt van een
   adresboek. Let op de vorm: hij mag DETECTEREN en melden, en `BLOCK` is een
   besluit van de cliënt en niet van RTG.
4. **Pas daarna de cockpit (punt 28–31).** Een bord boven een laag waarvan drie
   mechanismen geen aantoonbaar spoor hebben, toont een macht die het systeem
   niet kan bewijzen. Dat is dezelfde reden waarom `EXECUTIE.md` blok 7 en 9
   bewust half zijn gebleven.

### 6.1 Twee besluiten die vóór de bouw liggen

**Het genre bestaat niet.** Van de 74 genres zitten er drie in `sports` — alle
drie een CLUB — en drie in `media`. Er is geen genre voor een managementbureau,
impresariaat of boekingskantoor, dus een bureau kan zich vandaag niet als zaak in
zijn eigen vak aanmelden. Dat is een besluit van de eigenaar en geen bouwtaak;
`TRAVELCOMMERCE.md` staat op exact hetzelfde punt met het reisbureau.

**Er is geen commissiemodel, en dat is geen instelling.**
`kern/commercie/vergoeding.js` regel 46: `PARTNER_COMMISSIE = 0`. Een manager kan
via RTG geen percentage over de verdiensten van zijn cliënt ontvangen. Zolang dat
zo blijft heeft MN-03 (geen commercieel voordeel) geen onderwerp — en zodra het
verandert, moet het keuzepad van `MENSNETWERK.md` par. 4e er zijn vóórdat de
eerste euro loopt, niet erna.

---

## 7. Wat dit document niet zegt

Het beweert niet dat de zeven mechanismen samengevoegd moeten worden. De meting
zegt het tegenovergestelde: ze delen geen vorm en geen woordenschat, en
`PLATFORM.md` par. 0b beslist dan tegen samenvoegen.

Het beweert niet dat `kern/vertegenwoordiging/` af is. Het voert de grammatica
compleet, en het draagt negen bevoegdheden waar het voorstel er dertig wil —
punt 3 is terecht.

Het beweert niet dat de nullen in par. 0 bewijzen dat er geen gedeeld PROCES is.
Ze meten bewaarde vormen en gedeclareerde namen. Voor de procesvraag is de vorm
een ketenproef (`scripts/tafelproef.js` en zijn zusters), en die is voor deze
laag nog niet gelopen — dat is het eerlijkste gat in dit document.

En het beweert niet dat punt 8 tot en met 12 vanzelf gaan omdat de bouwstenen er
zijn. `webauthn-stapop.js` hangt vandaag aan geen enkele kantoorroute, en
`VERTROUWEN.json` staat op 0 bewezen. Een AAL-ladder boven nul bewezen routes
verhoogt geen zekerheid; hij verplaatst hem naar een getal dat niemand heeft
gemeten.

---

## 8. De drie metingen vóór het spoor (15 september 2026)

De volgende stap leek "een uniform vertegenwoordigingsspoor ontwerpen". Dat is
het niet, en drie metingen zeggen waarom. Ze staan hier vóór de bouw, want dit
is precies de plek waar dit huis al vier keer een objecttype heeft weggemeten.

### 8.1 De convergentiematrix — de vorm bestaat al, in één mechanisme

`npm run spoorvorm` → `SPOORVORM.json`. **Vier eigenschappen, afgelezen aan
`kern/vertegenwoordiging/handelen.js` en niet bedacht:**

| | |
|---|---|
| **V-1** | een TOEGESTANE handeling wordt vastgelegd |
| **V-2** | een GEWEIGERDE handeling wordt ÓÓK vastgelegd |
| **V-3** | het spoor gaat vóór de uitkomst de deur uit |
| **V-4** | een spoor dat niet vaststaat HOUDT DE HANDELING TEGEN |

| mechanisme | V-1 | V-2 | V-3 | V-4 |
|---|:--:|:--:|:--:|:--:|
| `vertegenwoordiging` *(referentie)* | ja | ja | ja | ja |
| `bijstand` | ja | — | ? | — |
| `servicemachtiging` | — | — | — | — |
| `ai-mandaat` | — | — | — | — |
| `fiscaal-mandaat` | — | — | — | — |
| `sepa-machtiging` | — | — | — | — |
| `app-machtiging` | — | — | — | — |

**2 van 7 legt iets vast, 1 kan de handeling tegenhouden, 1 haalt alle vier.**
Dat eerste getal kruist met `NAMENSVORM.json`, dat `spoor` onafhankelijk op 2/7
zette — twee meters, apart gebouwd, dezelfde uitslag.

**V-4 is niet wat `scripts/stilspoor.js` meet**, en die twee worden nergens
opgeteld. Stilspoor vraagt of het FALEN van een spoorschrijver wordt opgegeten
door een lege `catch` (smoren); deze vraagt of de aanroeper er iets mee DOET
(tegenhouden). Netjes loggen en doorlopen haalt de eerste wel en de tweede niet.

**De besturingsproef zit in de meter en hij sloeg meteen aan.** De referentie
MOET vier van vier halen, anders eindigt het script met een foutcode — zonder
die regel is een matrix vol nullen niet te onderscheiden van een meter die niets
herkent. En hij zakte: V-3 vergeleek het spoor met de EERSTE status-return in
het lijf, en dat is in de referentie de 404 *"U heeft deze machtiging niet"* —
een VOORWAARDE-uitgang die vóór het oordeel ligt en zegt *dit gaat niet over u*,
niet *dit mag niet*. De referentie zakte dus op de eigenschap die zij zelf
definieert: een geldige uitslag van het verkeerde experiment (`BEWIJSMACHINE.md`
par. 6a), gevonden door de meter en niet door een mens. V-3 kijkt nu of het
spoor tussen het OORDEEL en de eerstvolgende uitkomst staat.

### 8.2 `gelukt` betekent TOEGESTAAN, en er staat "Uitgevoerd" onder

De tweede meting was of `gelukt: !!oordeel.mag` in de referentie het verschil
tussen *mocht het* en *is het gelukt* verdoezelt. Het antwoord is scherper dan
de vraag.

`handel()` **voert niets uit.** Hij zoekt de machtiging, oordeelt, legt vast,
weigert of geeft 200 — en daar houdt het op. De enige aanroeper is
`routes/vertegenwoordiging.js`, die het antwoord rechtstreeks doorgeeft. Er is
geen uitvoeringsstap, dus het gat *"spoor zegt gelukt, uitvoering faalt"* kan
vandaag niet ontstaan.

Wat er wél staat is een belofte zonder dekking: op de tak waar
`oordeel.klaarzetten` onwaar is, luidt het antwoord **"Uitgevoerd binnen de
machtiging, en het staat in het spoor van de cliënt."** Er is niets uitgevoerd.
Dat is vandaag onschuldig — er gebeurt immers niets — en het wordt schadelijk op
het moment dat deze vorm naar de vijf andere gaat, want `sepa-machtiging`,
`fiscaal-mandaat` en `app-machtiging` voeren wél echt iets uit. Dan schrijft
`gelukt: true` een uitvoering op die alleen een toestemming was.

**De naam moet dus vóór de uitrol uit elkaar, en het huis heeft de vorm al.**
`kern/platformfout.js` kreeg op 14 september `uitvoeringBekend` — een BOOLEAN,
met in de kop de reden: *"er is maar een vraag ('staat vast of deze aanroep nog
is uitgevoerd?'), en dit huis heeft al meer gezagsladders dan het nodig heeft"*.
Dat pleit tegen een drietrapsuitkomst (`GESLAAGD / GEFAALD / NIET_UITGEVOERD`)
en vóór twee booleans naast elkaar: `toegestaan` en `uitvoeringBekend`.

### 8.3 `belang` bestaat nergens als structuur — en drie keer wel als vorm

De derde meting: bestaat *een partij heeft belang van soort Y bij context Z* al
ergens? **Nee.** Drie kandidaten komen dichtbij en missen elk precies één been:

| kandidaat | heeft | mist |
|---|---|---|
| `kern/rugdekking/index.js` | houder + soort + tegenprestaties | **de context** — het programma hangt aan niets |
| `kern/rtfos/bestuur.js` (`belanghebbend[]`) | houder + context | **soort en grond** — een kale lijst codenamen |
| `kern/onderneming/bestuur.js` (aandelen) | houder + soort + grond | de `grond` is BEWIJSgrond, niet de reden van het belang |

Wat er wél is, is de **vorm** houder + soort + grond, drie keer:
`kern/economie/identiteit.js` (`{drager, wereld, grond, door, op}` — grond is
verplichte tekst van minstens vijf tekens), `kern/economie/relaties.js`
(`{van, naar, grondslag, plafondCenten, tot}`) en de aandelenrij hierboven.
`kern/factuurcorrectie.js` is de enige plek waar `grond` een **gecodeerde** id
met label is in plaats van vrije tekst — dat is het precedent voor een
`SOORTEN`-tabel.

Verder bestaat belang als losse getallen per domein: `PARTNER_COMMISSIE = 0`,
`afdracht.procent` (App Store), `bijdrage.promille` (ondernemersregie),
`commissiePct`, en `begunstigde` als tekenreeks op een betaalregel.
`'belangenverstrengeling'` bestaat vandaag alleen als **meldingssoort** in
`kern/rtfos/integriteit.js` — iets wat een mens rapporteert, niet iets wat
wordt afgeleid. De enige plek waar belang wél wordt GEREKEND is
`kern/concern/graaf.js` (`belangen()`, `ubo()`), en dat gaat over eigendom.

**Wat dit voor de conflictmotor betekent:** de eigendomshelft is er en rekent;
de commerciële helft is losse getallen zonder houder. Een `BELANG`-structuur is
daarmee gerechtvaardigd als PROJECTIE over bestaande bronnen — niet als vierde
plek waar een percentage wordt opgeslagen.

### 8.4 Wat deze drie metingen veranderen aan de volgorde

1. **Er wordt geen uniform spoor ontworpen.** Het werk is: de vier eigenschappen
   naar de andere vijf brengen. Niet noodzakelijk dezelfde code — SEPA, fiscaal
   en app hebben elk een andere transactiegrens — maar wel dezelfde vier
   uitslagen in `SPOORVORM.json`.
2. **Vóór die uitrol wordt `gelukt` gesplitst** in `toegestaan` en
   `uitvoeringBekend`, en verdwijnt de zin die uitvoering claimt waar niets is
   uitgevoerd. Anders kopieer je een onwaarheid vijf keer.
3. **De conflictladder wordt niet gebouwd.** Vier standen (signaleren, openbaar
   maken, toestemming vereisen, blokkeren) is een LADDER, en `AFSPRAAK.md`
   verbiedt een zesde uitkomst- of zekerheidsladder terwijl `GEZAGSNOEMER.json`
   op vijf schalen met 21 treden staat. De eerste vraag is of belangenconflict
   een nieuwe schaal IS of een toepassing van een bestaande.
4. **MN-03 blijft zonder onderwerp tot de eigenaar een positie inneemt.** Zolang
   `PARTNER_COMMISSIE = 0` en RTG geen hoedanigheid is, bestaat *"RTG heeft
   financieel belang bij deze keuze"* alleen in ons hoofd — en daar mag een
   conflictmotor niet op leunen.
