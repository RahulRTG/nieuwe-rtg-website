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
Open stonden er acht posten: **`versmallen`** bij app-, fiscaal- en
sepa-machtiging, **`spoor`** bij ai-, fiscaal- en sepa-mandaat, en `verlenen` +
`intrekken` bij het ai-mandaat. Sinds stap 2 (par. 6.0a) zijn dat er **zes**:
`versmallen` bij `app-machtiging` en `fiscaal-mandaat` staat op `voert`, allebei
met een `opmerking` die zegt hoe grof de snede is en waarom. Die twee zijn
bijgewerkt in de VERKLARING en niet in de meter — dat is de hele opzet van par.
6.1 hieronder.

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

### 6.0a Stap 2, 15 september 2026: de doorsnede beslist echte bevoegdheid

`app-machtiging` en `fiscaal-mandaat` roepen `versmalNamens()` aan met een echte
`geverEffectief`. Twee van de drie openstaande `versmallen`-posten zijn daarmee
dicht, en de invariant heeft zijn eerste productie-aanroepers.

**De naad die dat afdwingt.** De wet kent geen domeinwoorden en de domeinen
kennen elkaar niet: `kern/appstore/gevermacht.js` en
`kern/fiscaal/gateway/mandaat.js` requiren allebei `kern/namens/versmalling`, en
verder niets van elkaar. `kern/namens/` requiret op zijn beurt alleen zijn eigen
buren plus `kern/envelop.js` — en dat is een TOETS en geen afspraak
(`test/namensversmalling-bedrading.test.js` toets 8). De twee randen staan als
`GEDEELDE_PRIMITIEF` in `scripts/lib/verstrengeling-verklaringen.js`; de
domeingrens hield ze tegen tot iemand ze verklaarde, precies zoals bedoeld.

**Bij `app-machtiging` was het gat er een van EERLIJKHEID en niet van lekkage.**
`arena.meedoen` werd aan iedereen verleend, ook aan een lid dat de 18+-poort niet
haalt. Er lekte niets — alle drie de arena-methodes toetsen `progressieMag` bij
de uitvoering — maar het toestemmingsscherm vroeg zo'n lid wél om ja te zeggen
tegen *"andere spelers zien uw codenaam en uw score op het bord"*, en
`bereik.js` rekende zijn app op de ZWAARSTE klasse (`op-een-bord`). Toestemming
voor iets dat structureel niet kan gebeuren, met een risicolabel dat niet klopt.
De uitkomst is dus niet "minder mag" maar "er wordt niet meer gevraagd dan er
kan": grens 3 van `arena.js` blijft staan (het spel speelt door), en er is een
DERDE weigering op de brug bij gekomen — de bestaande zei letterlijk *"Alleen het
lid kan dit aanzetten, in de App Store"*, en dat is voor dit geval onwaar.

**Bij `fiscaal-mandaat` zat het gat ergens anders dan de verklaring vermoedde,
en dat is de leerzaamste helft van deze ronde.** De verklaring noemde *"een
bestuurder zonder fiscale bevoegdheid"*, en die bestaat niet: `req.actor` draagt
één boolean `manager`, de zaak kent precies twee rollen
(`kern/onderneming/toegang.js`), en er is geen fiscaal recht per medewerker. Er
is bovendien **geen btw-plichtregister, geen loonplichtvlag en geen
inhoudingsplichtnummer** — dus een snede op "heeft deze zaak deze aangifteplicht"
zou een FISCALE POSITIE innemen die dit huis niet mag innemen
(`kern/fiscaal/zekerheid.js`: dat is `voorbehouden`), en zij zou bovendien onwaar
zijn: een inhoudingsplichtige zonder loon doet nog steeds een nulaangifte. Die
snede komt er dus niet, en dat staat in de bron met de reden.

Wat er wél zat, was een belofte zonder grendel. De kop van `mandaat.js` zegt al
jaren: *"wie dat controleert staat buiten deze module (de route), en dat het
gecontroleerd MOET zijn staat hier."* Die module kon een mandaat verlenen aan wie
hem maar aanriep. `geverEffectief` is nu een VERPLICHTE invoer, en een aanroeper
die zwijgt krijgt geen mandaat maar een verklaarde weigering. Dat is precies het
verschil dat `versmalNamens()` toevoegt aan `doorsnede()`: een bron die niet is
vast te stellen levert **503 met de reden** en geen lege uitkomst — *"deze gever
mag niets"* en *"er heeft niemand gekeken"* mogen nooit hetzelfde antwoord zijn.

**De groei-lek is dicht door de VORM en niet door een controle.** Er wordt
gesneden bij het VERLENEN en de uitkomst wordt bewaard; bij gebruik wordt niets
opnieuw uit de bron afgeleid. Een gever die later meer mag, verbreedt daarom
niets vanzelf — alleen een nieuwe handeling verbreedt, en die gaat opnieuw door
de doorsnede. Dat is de "tenzij" uit de opdracht, en het is de plek waar
delegatiesystemen normaal lekken: de broncontext verandert later en een ooit
veilige afleiding groeit ongemerkt mee.

Negen toetsen, waarvan vier over HTTP tegen een echte server. Alle negen met een
mutatie nagetrokken op een schone gecommitte boom, en elke mutatie raakte precies
wat hij hoort te raken. Toets 2 is de besturingsproef en blijft bij alle vier de
mutaties staan — hij valt alleen om als de snede ALLES wegsnijdt, en dat is
waarvoor hij er is. Wat er NIET is: continue autorisatie. Bestaande mandaten en
verleningen van vóór deze ronde worden niet met terugwerkende kracht gesneden, en
`geldt()` herrekent niets bij gebruik. Dat is een grens en geen gat — hij werkt
vooruit.

### 6.2 Wat er nu open staat

1. **`aanvaarden` en `spoor` BEDRADEN bij de zes.** De contractlaag zegt nu wie
   wat voert; wat er nog niet is, is dat de mechanismen er doorheen lopen. Dit
   is echte gedragswijziging op onder meer SEPA-mandaten en app-rechten, en
   hoort daarom een eigen ronde te zijn.
2. **`versmallen` bij `sepa-machtiging`.** De derde en laatste openstaande post.
   Hij is bewust niet met de andere twee meegegaan: bij een privépersoon op zijn
   eigen rekening is er niets te versmallen, en bij een zakelijke rekening met een
   tekenbevoegdheidsgrens is er geen register waaruit die grens te lezen valt —
   dezelfde muur als bij het fiscale mandaat, en dus eerst een besluit.
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

**<!--getal:spoor.metSpoor-->2<!--/getal--> van <!--getal:spoor.mechanismen-->7<!--/getal--> legt iets vast,
<!--getal:spoor.kanTegenhouden-->1<!--/getal--> kan de handeling tegenhouden,
<!--getal:spoor.volledigConvergent-->1<!--/getal--> haalt alle vier.**
Dat eerste getal kruist met `NAMENSVORM.json`, dat `spoor` onafhankelijk over
diezelfde <!--getal:namens.mechanismen-->7<!--/getal--> mechanismen telde en op 2
uitkwam — twee meters, apart gebouwd, dezelfde uitslag. De noemer draagt hier een
merkteken en de tellers ook: drie van de vier staan op één, en een één in proza
veroudert net zo onzichtbaar als een nul.

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

---

## 9. Twee referenties, en geen van beide is de combinatie (15 september 2026)

Par. 8.1 leest makkelijk verkeerd. `vertegenwoordiging` haalt daar vier van
vier, en over drie maanden leest iemand dat als *dit is de gouden
implementatie, kopieer hem*. Dat is precies wat er niet moet gebeuren, en de
reden staat hieronder.

**`kern/vertegenwoordiging/handelen.js` is de referentie voor BEOORDELING +
VERPLICHT SPOOR.** Hij oordeelt, vormt de regel, legt duurzaam vast, stopt als
dat niet lukt, en weigert of geeft 200. Wat hij niet heeft: een uitvoering.
`handel()` voert niets uit, en zijn enige aanroeper
(`routes/vertegenwoordiging.js`) geeft het antwoord rechtstreeks door.

**`kern/appstore/brug.js` (`roepKaal`) is de referentie voor UITVOERING +
UITKOMSTKENNIS.** Daar staat `m.doe(...)` in een `try/catch`, en de drie
uitkomsten zijn al uit elkaar gehaald: geweigerd, gelukt, en omgevallen met een
landing die niet vaststaat (`RTG_BRUG_FOUT`, `uitvoeringBekend: false`, plus
`herhaalbaar` afgeleid uit de mutatieklasse). Wat hij niet heeft: één regel
spoor. Gemeten op `spoor`, `log.`, `noteer` en `journaal`: nul treffers in
`brug.js` en `brugweigering.js`.

> **Geen enkel mechanisme is vandaag de referentie voor de combinatie.** De twee
> helften van het contract wonen in verschillende mechanismen, en uitgerekend de
> helft met de echte uitvoering is de rij die in `SPOORVORM.json` op vier
> streepjes staat.

Daaruit volgt dat de splitsing van `gelukt` geen wijziging AAN `handelen.js` is —
daar valt niets af te splitsen — maar een contract dat pas bewijsbaar wordt waar
beide helften bestaan.

### 9.1 De vijf gevallen, en welke drie hier niet kunnen

| # | oordeel | spoor | uitvoering | tegen de referentie |
|---|---|---|---|---|
| 1 | weigert | slaagt | niet gestart | **beproefd** |
| 2 | staat toe | faalt | niet gestart | **beproefd** |
| 3 | staat toe | slaagt | slaagt | structureel niet: geen uitvoering |
| 4 | staat toe | slaagt | faalt | idem |
| 5 | uitvoering slaagt, eindspoor faalt | | | idem |

Geval 1 en 2 staan sinds deze ronde in `test/handelenspoor.test.js`, en niet als
lezing van de control flow maar onder `RTG_VERRAAD=schrijf-verloren` tegen een
echte server. Twee mutaties op `handelen.js` zijn nagetrokken: het spoor ná de
weigering zetten laat toets 2 zakken, en de uitslag van `vastleggen()` weggooien
laat toets 5 zakken.

**De wereld wordt eerlijk gebouwd en daarna liegt de opslag.** Een machtiging
vraagt een cliënt die `volwassen()` haalt (A3), dus een keuring door het
kantoor; op een server die schrijfacties weggooit lukt die opbouw niet. De proef
bouwt daarom op een eerlijke server, stopt hem, en opent dezelfde datamap
opnieuw met het verraad aan.

### 9.2 Twee bevindingen die het bouwen van die proef opleverde

**`gelogd: true` bereikt niemand.** `handelen.js` zet dat veld bij een weigering
zodat de aanroeper weet dat zijn poging is vastgelegd. `stuur()` in
`routes/vertegenwoordiging.js` is `(r && r.error) ? res.status(...).json({ error:
r.error }) : res.json(r)` en gooit bij élk foutantwoord alles behalve `error`
weg — voor alle acht de routes. Dezelfde vorm als de `res.append` uit
`AFSPRAAK.md`: een laag zet een veld, de laag erboven laat het stil vallen. Welke
velden op een weigering mee mogen is een besluit, dus het staat hier en niet in
een toets.

**Er is geen rollback van het geheugenmodel.** Onder `schrijf-verloren` gaf de
route netjes 503 — en het spoor van de cliënt groeide van 5 naar 6 regels.
`vastleggen()` draait via `bijeen()` eerst de mutatie en commit daarna; faalt de
commit, dan keert de route terug met een fout terwijl het geheugen niet wordt
teruggedraaid. Tussen de mislukte commit en de eerstvolgende herstart leest een
lezer op datzelfde proces dus een regel die niet bestaat. `ROLLBACK` bestaat in
`scripts/lib/crashtaxonomie.js` als contract, maar hier niet als handeling. De
toets legt daarom vast wat wél hard is — na een herstart staat er niets.

### 9.3 Waarom CRASHAS maar 45 routes kent, en waarom dat goed nieuws is

De vraag was of `CRASHAS.json` uitbreiden naar de brug een tweede lijst zou
maken. Nagemeten is de keten:

```
CRASHAS.json (45)
  <- GELDDEKKING.json
     <- GELDKAART.json  as1Kaart.geldroutes
        <- (a) de route schreef een collectie waarvan de KLASSE in
               server/kern/isolatie/effectcollecties.js `GELD_BEWEGEN` is
           (b) EN de idempotentieproef kwam erbij en zag de waarde veranderen
```

Het bereik is dus **geen oordeel "is dit geld"**, maar een filter op één
verklaarde gegevensklasse, doorsneden met wat `IDEMPROEF.json` toevallig heeft
bereikt. En er zijn er **negen** over 80 collecties: `GELD_BEWEGEN` (30),
`VERTROUWENSRELATIE_AANGAAN` (13), `EXTERN_BEREIKEN` (10),
`IDENTITEIT_WIJZIGEN` (8), `SCHRIJVEN_ANDERMANS` (8), `RECHT_VERLENEN` (6),
`BEVEILIGING_VERZWAKKEN` (3), `DERDENCODE_UITVOEREN` (1),
`ONVERTROUWDE_BYTES` (1).

Uitbreiden is daarmee **het filter verbreden en geen uitzondering toevoegen** —
precies wat een tweede lijst voorkomt. Twee dingen vallen er meteen uit:

- **`appInstallaties` is al geklasseerd**, als `VERTROUWENSRELATIE_AANGAAN` met
  als grond *"APPSTORE.md: een machtiging die het lid verleent"* — plus zes
  broertjes (`rtfAppInstallaties`, `beroepenInstallaties`, …). De app-machtiging
  kan de crash-as dus vandaag in, zonder één nieuwe naam.
- **`vertegenwoordigingen` is NERGENS geklasseerd**, net als `rugdekking` en het
  carrièreledger. De referentie-implementatie draagt geen effectklasse, dus zij
  komt er langs géén enkel klassefilter in. `effectcollecties.js` zegt zelf dat
  het indelen bewust onvolledig is (*"Ingedeeld is wat een HOOG BELANG draagt:
  geld, identiteit, rechten, blijvende koppelingen en de beveiliging zelf"*) — en
  een machtiging IS een recht. Dit is dus een gat dat een regel verdient, geen
  defect.

Dat bestand noemt bovendien zijn eigen plafond, en dat hoort hierbij: slechts 599
van de 4643 rol-paden hebben überhaupt een gemeten collectie. Het effectmodel komt
niet uit de schaduw door dit register vol te maken, maar doordat `IDEMPROEF.json`
verder reikt.

### 9.4 Wat het contract wordt, en wat het niet wordt

Eén semantiek met **verschillende zekerheidsprofielen**, en geen uniforme
uitvoeringsprocedure:

| transactiegrens | wat het mechanisme moet kunnen |
|---|---|
| in-process, zelfde database (app-machtiging: `m.doe()` is synchroon) | beoordeling, spoor en uitvoering in dezelfde bundel; valt de uitvoering om, dan doet de eindtoestand niet alsof zij slaagde |
| externe aanbieder mét betrouwbare status/idempotency | voornemen duurzaam vastleggen → externe aanroep → reconciliatie → definitieve uitkomst |
| externe aanbieder zónder betrouwbare status | expliciet onbekende landing: niet herhalen alsof er niets gebeurde, niet "gefaald", niet "geslaagd" — de bestaande `uitvoeringBekend: false` |

Er komt **geen derde stand naast** die twee booleans. `kern/platformfout.js`
heeft die keuze al gemaakt en de reden staat in zijn kop.

En de tweede spoorregel wordt **niet automatisch ingevoerd**. Het spoor is een
ringbuffer (`MAX_LOG`), dus twee regels per handeling halveert de
gebeurtenishorizon. De regel is niet *elke handeling schrijft twee regels* maar
*het spoor bevat genoeg append-only gebeurtenissen om de werkelijk bekende
toestand eerlijk te reconstrueren*: één waar atomiciteit bestaat, meer waar er
een tijd- of providergrens tussen zit. Retentie zelf is een apart besluit —
`integriteit ≠ retentie`, de les van het inzagejournaal — en hoort niet stilletjes
in deze ronde mee te liften.

### 9.5 Wat `SPOORVORM` later moet gaan meten

Nu: *herkent deze meter vier eigenschappen van de bestaande vorm?* Straks: *welk
deel van het contract kan dit mechanisme aantoonbaar waarmaken?* Het doel is
uitdrukkelijk **niet** zeven mechanismen op 7/7 — dat zou dezelfde verkeerde
uniformiteit terugbrengen. `n.v.t.` is daar even belangrijk als `ja`: een
mechanisme zonder uitvoering hoort niet rood te staan omdat het geen
uitvoeringscrash kan hebben.

---

## 10. De drie besluiten, genomen (15 september 2026)

Par. 9 eindigde met drie dingen die een besluit vroegen en geen bouwwerk. Ze
zijn genomen. Ze staan hier met hun consequentie, zodat de volgende ronde niet
opnieuw begint bij de vraag.

### 10.1 Geen verplichte tweede spoorregel

**Besluit: een vertegenwoordigde handeling schrijft zoveel append-only
gebeurtenissen als nodig zijn om de werkelijk bekende toestand ondubbelzinnig te
reconstrueren — niet standaard één en niet standaard twee.**

De ringbuffer wordt dus niet twee keer zo snel opgegeten omdat we toevallig een
levensloop willen modelleren. Concreet:

| geval | gebeurtenissen |
|---|---|
| weigering | **één** terminale regel (beoordeeld, geweigerd, met reden; niets uitgevoerd) |
| lokale transactionele uitvoering | **één** definitieve toestand, mits de atomiciteit werkelijk is bewezen |
| externe handeling | **meer**: toegestaan → uitvoering aangezet → uitkomst onbekend → gereconcilieerd |

Append-only blijft intact zonder het normale geval te verdubbelen.

**Retentie is een eigen probleem en wordt hier niet stilletjes meebeslist.** De
ringbuffer mag een snelle operationele projectie zijn; hij mag niet ongemerkt de
volledige historische garantie definiëren. Welke bewaartermijn juridisch en
productmatig nodig is, is een apart besluit — dezelfde scheiding die het
inzagejournaal al heeft afgedwongen: *integriteit ≠ retentie*.

### 10.2 Drie zekerheidsprofielen, en geen nieuwe ladder

**Besluit: één semantiek, per transactiegrens een expliciet profiel.**

1. **Lokaal transactioneel.** Spoor en toestand committen samen. Geen halve
   uitkomst: niet spoor-ja/uitvoering-nee en niet andersom.
2. **Extern reconcileerbaar** (de aanbieder heeft idempotency, status of
   reconciliatie): duurzame intentie → uitvoering → bevestiging of onbekend →
   reconciliatie. **Een crash ná verzending betekent dus niet automatisch
   opnieuw proberen.**
3. **Extern niet-reconcileerbaar.** `uitvoeringBekend: false` blijft de waarheid
   en er volgt menselijke of operationele afhandeling. Niet gokken, en **niet
   opnieuw uitvoeren omdat er geen succes staat.** Dat laatste is een van de
   scherpste economische veiligheidsregels die dit huis kan hebben.

Er komt géén nieuwe zekerheidsladder: het bestaande vocabulaire van
`kern/platformfout.js` (`uitvoeringBekend` plus `herhaalbaar`) drukt dit uit.

### 10.3 Een effectklasse volgt de HANDELING, niet de vertegenwoordiging

**Besluit: ja, dit mag CRASHAS niet blind houden — maar er komt geen
`REPRESENTATION = STATE`.** Vertegenwoordiging kan ook lezen, voorstellen of
beoordelen. De klasse hoort bij de handeling die eronder ligt:

```
vertegenwoordiging  ->  handeling  ->  effectprofiel
```

Daaruit volgt de invariant die verder reikt dan deze laag:

> **Vertegenwoordiging verandert de actor en de bevoegdheid, niet de
> effectsemantiek van de onderliggende handeling.** Mag Noah handeling X zelf
> uitvoeren en is die `RECOVERABLE + STATE`, dan valt X niet buiten CRASHAS
> omdat Sophie hem namens Noah uitvoert.

CRASHAS hoeft dus niets over vertegenwoordiging te weten. Zijn bestaande
klassefilter blijft staan; wat moet kloppen is dat een vertegenwoordigde
handeling dezelfde effectwaarheid draagt als dezelfde handeling door de
principal zelf.

**En daar zit vandaag een obstakel dat gemeten hoort te zijn vóór iemand één
regel toevoegt.** `effectcollecties.js` klasseert **per COLLECTIE** — één klasse
en één grond per naam. De collectie `vertegenwoordigingen` draagt per lid drie
verschillende soorten inhoud tegelijk:

| veld | wat het is |
|---|---|
| `machtigingen` | de machtigingen zelf — een RECHT dat wordt verleend |
| `log` | het spoor — een verantwoordingsregel OVER toegang |
| `grens` | de staande eigen grens van de cliënt |

Eén klasse kan die drie niet eerlijk dekken. `vertegenwoordigingen:
['RECHT_VERLENEN', …]` invullen is dus niet de uitvoering van dit besluit maar
een kortere weg eromheen.

**En er is een tweede reden om hier nog niets in te vullen, en die is scherper:
er is vandaag geen onderliggende handeling.** `handel()` voert niets uit; het
enige dat er geschreven wordt is het spoor. De invariant van 10.3 heeft dus nog
geen ONDERWERP in deze laag — precies de vorm van MN-03, waar de regel klopt en
het geval nog niet bestaat. Zij wordt scherp op het moment dat één mechanisme
werkelijk namens iemand uitvoert, en dat is dezelfde stap als 10.2.

### 10.4 Twee bevindingen blijven met opzet open

Beide uit par. 9.2, en beide zijn een BESLUIT en geen reparatie.

**`gelogd: true` dat `stuur()` weggooit** is een projectievraag, geen
serialisatiefout. De oplossing is niet vanzelf *laat alle interne velden door
naar HTTP*. Misschien is `gelogd` intern bewijs en hoort de cliënt alleen 403 met
een reden te zien; misschien is *"deze geweigerde poging is vastgelegd"* juist een
belofte aan de gebruiker. Dat verschil hoort iemand te kiezen.

**Het ontbreken van een rollback** is pas te beoordelen als vaststaat wat het
geheugenmodel REPRESENTEERT. Is het een afgeleide projectie die na persistentie
opnieuw wordt opgebouwd, dan is een klassieke rollback mogelijk het verkeerde
gereedschap. Draagt het autoritatieve toestand, dan is het een ander verhaal.

### 10.5 Wat de volgende ronde wordt

Niet *het uniforme spoor bouwen*. Wel: **voor het eerst één mechanisme de hele
keten laten bewijzen** — bevoegdheid → verplicht spoor → echte uitvoering →
eerlijke uitkomst → crashgedrag. De kandidaat is `app-machtiging`, want daar is
`m.doe()` synchroon in-process en valt profiel 1 uit 10.2 werkelijk te halen.

Staat dat, dan bestaat de referentie voor de combinatie die vandaag bewust
nergens bestaat — en pas dán verandert `SPOORVORM` van vraag. De oude meter gaat
niet weg voordat de nieuwe bewezen is, en in de nieuwe is **`n.v.t.` geen
tekort**: een mechanisme zonder uitvoering hoort niet rood te staan omdat het
geen uitvoeringscrash kan hebben.

---

## 11. De slice is gemeten vóór hij werd gebouwd, en hij heeft geen onderwerp

Par. 10.5 wees `app-machtiging` aan als het eerste mechanisme dat de hele keten
zou bewijzen. Dat is nagemeten vóór er een regel is geschreven, en de premisse
houdt niet. Dit is de derde keer in deze reeks dat een regel klopt terwijl het
geval nog niet bestaat — en dat is geen toeval maar een eigenschap van het huis.

### 11.1 Wat de proef nodig heeft

De dragende toets van besluit 3 is:

```
effect(X door de principal zelf)  ==  effect(X namens hem, door een ander)
```

Daarvoor moet er een X bestaan die van **beide kanten** bereikbaar is: de mens
kan hem zelf uitvoeren, én het mechanisme kan hem namens hem uitvoeren. Zonder
zo'n X is er niets te vergelijken.

### 11.2 De brug heeft negen methodes, en geen enkele raakt gedeelde grond

`kern/appstore/brugmethodes.js` draagt er negen, en ze schrijven alle drie de
soorten opslag in een **doos per app**:

| methode | schrijft naar | gedeeld met RTG? |
|---|---|---|
| `profiel.wieBenIk` | niets (leest) | — |
| `opslag.lees/lijst/zet/wis` | `bak('opslag', app, lid)` | nee: een kladblok per app per lid |
| `bericht.zet` | `bak('bakjes', lid, app)` | nee: het bakje van díé app |
| `arena.zet/bord/mijn` | het bord van díé app | nee, en uitgeschreven |

Die laatste staat er met zoveel woorden: *"EEN BORD PER APP, NOOIT DAT VAN DE
ARENA"*, met als reden dat een ranglijst waar een derde het getal instuurt precies
zo betrouwbaar is als de minst betrouwbare app erin.

Dat is geen omissie maar **de cel** (`APPSTORE.md`: derdencode draait nooit op de
RTG-herkomst). Een lid kan `opslag.zet` voor app Y niet zelf doen — die
sleutelruimte bestaat alleen omdát de app bestaat. Er is dus geen X met twee
kanten, en de vergelijking van 11.1 heeft hier geen onderwerp.

### 11.3 En het geldt voor alle zeven

De vraag is daarna breder gesteld: is er érgens een mechanisme dat namens iemand
een onderliggende capability UITVOERT?

| mechanisme | wat het werkelijk doet |
|---|---|
| `vertegenwoordiging` | oordeelt en legt vast — `handel()` voert niets uit |
| `app-machtiging` | voert uit, maar uitsluitend binnen de cel van de app |
| `bijstand` | `voerUit()` zet `status = 'uitgevoerd'` en schrijft een uitslag: het **registreert dat een mens het deed** |
| `servicemachtiging` | `magNu()` heeft twee aanroepers, en die openen een BEELD (`organisatie.stand`) |
| `ai-mandaat` | `magZelfstandig()` heeft één aanroeper, in `kantoor/geldketen/klaarzet.js` — klaarzetten |
| `sepa-machtiging` | keurt |
| `fiscaal-mandaat` | beoordeelt geldigheid |

> **In dit huis betekent *namens iemand handelen* vandaag: beoordelen, openen,
> klaarzetten en vastleggen — nooit uitvoeren.** De uitvoering doet een mens, of
> de principal zelf.

Dat is volledig in lijn met wat dit huis elders hardop kiest (`GELD.md`: geld
wordt klaargezet en een mens voert uit; `FABRIC.md`: wat een tweede persoon
bereikt bevestigt een mens). De keten uit 10.5 vraagt dus niet om een
implementatie maar om een **product- en architectuurbesluit dat er nog niet is**.

### 11.4 Drie wegen, en geen ervan is een slice

1. **De cel openen** — de brug een methode geven die gedeelde grond raakt. Dat
   doorbreekt de grens waar de hele App Store op staat, inclusief de zes
   machtigingen die met opzet niet bestaan. Groot besluit, geen slice.
2. **`vertegenwoordiging` laten uitvoeren** — `handel()` een echte onderliggende
   capability laten aanroepen. Dan bestaat de vergelijking van 11.1 meteen (de
   cliënt kan die capability zelf ook), en profiel 1 uit 10.2 is haalbaar omdat
   alles in-process is. Dit is de kortste weg naar een echt onderwerp, en het
   raakt geen bestaande grens — maar het verandert wel wat een machtiging IS:
   van een vastgelegde toestemming naar een uitvoerbare.
3. **Wachten tot een domein er zelf om vraagt.** Niets bouwen; de invariant staat
   opgeschreven en wordt scherp zodra er ergens een uitvoerend mechanisme
   ontstaat.

Wat er **niet** moet gebeuren is een `X_TEST_VERTEGENWOORDIGING` — een werkwoord
dat alleen bestaat om de keten groen te krijgen. Dan is er een prachtige keten
die niets bewijst over echte capabilities, en dat is precies de vorm die
`BEWIJSMACHINE.md` par. 6a een geldige uitslag van het verkeerde experiment
noemt.

### 11.5 Wat deze meting wél heeft opgeleverd

De drie besluiten van par. 10 staan, en ze zijn nu preciezer geadresseerd:
besluit 1 en 2 wachten op een uitvoerende levensloop, besluit 3 op een
onderliggende handeling — en alle drie wachten op hetzelfde, namelijk op weg 1
of weg 2 hierboven. Dat is geen vertraging maar het verschil tussen een besluit
dat af is en een besluit dat nog een onderwerp moet krijgen.
