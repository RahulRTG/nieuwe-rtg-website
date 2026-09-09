# KANTOOR.md — RTG Kantoor als levensloop van een medewerker

*Richtingsdocument, 6 september 2026. Niet: nog honderd kantoorfuncties. Wel: de
bestaande onderdelen verplicht met elkaar verbinden, en daarna de volledige
personeelsreis erboven bouwen.*

**Lees dit met `KANTOORMACHT.md` ernaast, en verwar ze niet.** Dat gaat over de
MACHT aan de knop: wie mag wat, en hoe ver reikt het. Dit gaat over de MENS die
aan de knop staat: hoe hij binnenkomt, wat er van hem verwacht wordt, wat er om
hem heen verandert, en wanneer het systeem juist niets moet zeggen. Ze delen de
bevoegdheidsmotor; ze delen hun naam niet.

Per onderdeel staat er of het **staat**, **een stap weg** is, **een besluit
vraagt** of **jaren weg** is — zoals `PLATFORM.md`, `ECONOMIE.md` en `HDI.md`.
Wie die vier voor elkaar aanziet, plant een jaar verkeerd.

## 0. De maatstaf

> RTG Kantoor moet begrijpen wie je bent, waarom je hier bent, wat er van je
> verwacht wordt, wat er rondom jou verandert, waar je hulp nodig hebt en
> wanneer het systeem juist níét moet storen.

Technisch, en dit zijn vijf toetsbare zinnen en geen leus:

```
Every person is known.              elke menselijke handeling heeft een bewezen actor
Every responsibility has an owner.  elk stuk werk heeft precies één eigenaar
Every action has context.           een opdracht draagt doel, reden, termijn, afhankelijkheid
Every critical effect has authority. zwaar werk vraagt bevoegdheid, niet een sessie
Every outcome has evidence.         de uitkomst laat bewijs achter, niet een verhaal
```

En de merkbelofte erboven:

> RTG Kantoor laat medewerkers geen software beheren. Het laat de organisatie
> haar eigen werk begrijpen.

## 1. Eerst de meting — want het meeste bestaat al

Dit huis heeft een regel die hier zwaarder weegt dan waar ook: **een dragende
bewering wordt gemeten, niet verklaard.** Dat is de les van `Asset`
(`OBJECTMODEL.json`: 71% van de velden hoort bij één domein, en `Asset` bestond
niet) en van de twee `VERMOGENS`-lijsten met nul gedeelde leden. Dus eerst de
uitslag van `npm run kantoormacht` (`KANTOORMACHT.json`, blok 0 van
`KANTOORMACHT.md` par. 26, gebouwd op 6 september 2026):

| As | Getal | Graad |
|---|---|---|
| kantoorroutes (`/api/office` + `/api/boardroom`) | **<!--getal:kantoor.routes-->586<!--/getal-->** over <!--getal:kantoor.bestanden-->89<!--/getal--> bestanden | gemeten |
| deur eist een bewezen mens | **<!--getal:kantoor.deurEistMens-->168<!--/getal-->** | gemeten |
| deur is de gedeelde code | **<!--getal:kantoor.deurGedeeld-->418<!--/getal-->** | gemeten |
| handler kent de handelende mens | <!--getal:kantoor.handlerKentMens-->117<!--/getal--> | vermoed (bovengrens) |
| **anoniem uitvoerbaar** | **<!--getal:kantoor.anoniem-->365<!--/getal-->** | vermoed (ondergrens) |
| schrijft een auditspoor | 130 | vermoed |
| vraagt een reden | 259 | vermoed |

En de machinerie uit `KANTOORMACHT.md` par. 3 — bestaat, hangt níét aan de
kantoordeur:

```
voornemen.js    execution plan                 0 kantoorroutes   2 aanroepers elders
vierogen.js     tweede handtekening            0                 3
simulatie.js    impact vooraf                  0                 2
canary.js       beleid uitrollen               0                 3
rechten.js      machtskaart                    0                 1
schaduw.js      eerst meelopen                 1                 5
commercie/bevoegdheid.js   vier dimensies      0                 0   ← nul, in het hele huis
```

Die laatste regel is de duurste van het document. **De vier-dimensiemotor met
structureel versmallende delegatie is geschreven en nooit aangesloten.** Let op
dat er een tweede module is die óók `bevoegdheid` heet (`kern/bevoegdheid/`, de
`VERMOGENS`-lijst uit `TOKEN.md`) en die wél draait, met 24 aanroepers. Twee
modules, één woord — exact de botsing die `SEMANTIEK.json` meet.

### 1.1 Wat er al staat en dus niet gebouwd hoeft te worden

Zes van de acht fundamenten van de voorgestelde architectuur bestaan:

| Voorstel | Woont al in | Stand |
|---|---|---|
| `actor.person` / `actor.employment` | `kern/concern/employment.js` — Person → Employment met werkgever, vestiging, afdeling, periode, reden, **op codenaam** | **staat** |
| passkey / phishing-resistant inlog | `server/webauthn/` — eigen WebAuthn-verificatie, 70 bestanden | **staat**, niet aan de kantoordeur |
| "mens bewijzen na de voordeur" | `kern/kantoor/kluispoort.js` | **staat**, op 8 routes |
| causale keten (Storyline) | `kern/envelop.js` — `correlatie` + `oorzaak` op elk bericht | **staat** |
| impactmeting per handeling | `kern/stuur/gevolg.js` — 3 graden, 96 van 176 `onbekend` | **half** |
| graaf als projectie | `kern/levensgraaf/graaf.js` — leest de bron, bouwt elke keer opnieuw | **staat**, als patroon |
| verantwoordelijkheidsgraaf | — | **niets** |
| risico per route | — | **niets** |

`kluispoort.js` verdient een eigen alinea, want het is letterlijk het voorstel
uit de opdracht, al gebouwd. Uit zijn eigen kop:

> De backoffice-code is GEDEELD, en `officeAuth` kent maar één rang. Daardoor
> droeg diezelfde anonieme sessie de zwaarste handelingen die dit huis kent (…)
> **Een spoor dat niet naar een mens leidt, is geen spoor.**

Dat is `OFFICE_CODE → kantoor herkennen` gevolgd door `mens bewijzen`, met de
weg erheen in plaats van een muur. **Het werk is niet die poort ontwerpen. Het
werk is hem van 8 naar 585 routes brengen.**

## 2. Namen die al bezet zijn — lees dit vóór je begint

`SEMANTIEK.json` meet dat 100 namen in dit huis meer dan één betekenis dragen,
samen 284 betekenissen. Een nieuw kernbegrip dat een bezette naam pakt, is de
`VERMOGENS`-fout met een nieuw woord. Gemeten op de voorgestelde namen:

| Voorgesteld | Stand | Uitweg |
|---|---|---|
| **RTG Pulse** (impact engine) | **bezet** — `pulseFeed`, `pulsePost`, `pulseReactie`, `pulseProfiel` in 21 bestanden: een sociale feed | hernoemen. **`kern/kantoor/weerklank.js`** — wat een gebeurtenis losmaakt |
| **Companion** | vrij | mag |
| **Storyline** | vrij, maar de zaak bestaat al als `envelop.correlatie` | geen nieuw begrip; een LEZING van de envelop |
| **Work Graph / Context Graph / Outcome Graph** | vrij, maar drie grafen naast `levensgraaf` en `concern/graaf` | één graaf met drie projecties, nooit drie opslagen |
| **capability** | **bezet** — platformvermogen (`OS.md`) | niet gebruiken voor werkvermogen |

## 3. De eerste grendel: geen anonieme menselijke effecten

Dit is blok 1 en er gaat niets vóór.

**De positie is juist en de code is het er al mee eens.** De gedeelde
`OFFICE_CODE` + TOTP mag een voordeur zijn die het KANTOOR herkent; hij mag
nooit de actor achter een handeling zijn. TOTP bewijst het bezit van een gedeeld
geheim, niet een persoon — en een tweede factor op een gedeelde code maakt de
code niet persoonlijk.

De envelop draagt het al bijna. `officeAuth` zet vandaag:

```js
envelop.zet(req, { soort: 'kantoor', id: sess.lidKey || null,
                   identiteit: sess.lidKey ? 'bewezen' : 'anoniem' });
req.officeKey = sess.lidKey || null;
```

**De deur weet dus al of er een mens achter zit. Niets weigert erop.** Dat is de
hele afstand tussen vandaag en de maatstaf.

De doelvorm van de actor, met per veld waar hij vandaan komt:

```
actor.person       codenaam uit de identiteitskluis      accounts.js          staat
actor.employment   dienstverband                          concern/employment  staat
actor.role         functie binnen het dienstverband       concern/employment  staat
actor.team         organisatie-eenheid                    concern/entiteit    staat
actor.device       apparaat                               —                   ontbreekt
actor.session      sessiecode                             sessionFor          staat
actor.assurance    hoe hard de identiteit bewezen is      webauthn/           staat, los
actor.delegation   namens wie, versmald                   commercie/bevoegdheid  staat, 0 aanroepers
actor.office       vestiging                              concern/employment  staat
```

Zeven van de negen velden hebben een bron. **`actor.device` is het enige dat
werkelijk vanaf nul begint**; `assurance` en `delegation` bestaan en moeten
worden aangesloten.

**De uitrolvolgorde gaat om, en dat is geen detail.** `KANTOORMACHT.md` par. 4
heeft dit al besloten en de reden geldt hier onverkort:

```
SHADOW → WARN → ENFORCE_EXECUTE → ENFORCE_PREPARE → ENFORCE_READ
```

Eerst dichtzetten wat pijn doet. Lezen raakt élk kantoorscherm voor de kleinste
risicoreductie, en de gevaarlijkste lezing (de identiteitskluis) is al
afgedwongen. Wie met `ENFORCE_READ` begint, legt het kantoor stil voor de
verkeerde winst.

**De gate staat al klaar.** `npm run kantoormacht:controle` zakt zodra
`anoniemUitvoerbaar` stijgt — de vorm van de normtanden in `PROOF.md`: bewijs mag
alleen groeien, schuld alleen krimpen. Hij hangt met opzet aan de HARDE as
(`deurEistMens`, uit de router) en niet aan de lexicale: een deploy-gate op een
`vermoed` getal is een gate die zakt omdat een grep iets anders vond.

Stand: **een stap weg** voor de schaduwmeting, **een besluit vraagt** voor
`ENFORCE_EXECUTE` — want dat besluit heeft een prijs die iemand moet willen
betalen (zie par. 12).

## 4. De personeelsreis

### T-7 — RTG bereidt de komst voor

Zodra HR het dienstverband definitief maakt, ontstaat er een aankomstplan.
`concern/employment.js` draagt de feiten al; wat ontbreekt is dat er iets op
LUISTERT. De keten is `envelop`-werk en geen nieuwe infrastructuur:

```
employment.created → aankomstplan: identiteit · e-mail · apparatuur · bevoegdheden
                     · projecten · kanalen · agenda · documenten · mentor · doelen
```

**Eén harde grens, en die is niet onderhandelbaar:** bevoegdheden worden nooit
gekopieerd omdat iemand "designer" heet. Dat is de rolexplosie waar
`CONTROLPLANE.md` tegen bestaat — een bevoegdheid is vier dimensies (wat, waar,
hoeveel, wanneer) en geen vinkje. Het aankomstplan **zet klaar**; een mens geeft
vrij. Zelfde werkwoord als de hele rest van dit huis.

Stand: **een stap weg** (het model staat, de luisteraar niet).

### Dag 1 — het wow-moment

Geen "welcome, here are 43 apps". Een rustige opening, en daarna precies drie
dingen. Dat is psychologisch beter én het is de bestaande ontwerpregel: `WERELD.md`
verbiedt een voorgekookt werkblad en een verzonnen statusstrook, en
`GRAMMATICA.md` zet "ik wil iets doen → mijn duim vindt het onderaan" bovenaan.

Stand: **een stap weg** — dit is een scherm op bestaande gegevens.

### De werkplek verandert mee

Dag 1 toont *Vandaag · Mijn mensen · Mijn introductie · Mijn eerste project*.
Na zes maanden toont dezelfde plek *Verantwoordelijkheden · Besluiten · Risico's
· Team · Uitkomsten · Goedkeuringen*. Een CFO krijgt een andere dichtheid dan een
junior ontwerper, met dezelfde bediening.

Dat is exact `ADAPTIEF.md` met een nieuwe as. Die regel geldt hier onverkort, en
hij is streng: **verbergen bestaat niet.** Een handeling die op de ene rol
bestaat en op de andere geen vorm heeft, is een gebrek en laat de toets zakken.
Een adaptieve werkplek mag dus de VOLGORDE en de DICHTHEID veranderen, nooit
stilletjes iets weglaten — anders concludeert een medewerker dat een macht niet
bestaat, en dat is de gevaarlijkste faalvorm van deze laag (`EXECUTIE.md` blok 0,
`npm run resolverbereik`).

> Eén bedieningsgrammatica, meerdere wereldidentiteiten — en daarnaast:
> **één interactiegrammatica, adaptieve operationele context.**

Stand: **een besluit vraagt** — welke assen mogen de dichtheid sturen (anciënniteit,
rol, verantwoordelijkheid) en welke nooit (prestatie).

### Afwezigheid en offboarding

Beide zijn dezelfde beweging: de verantwoordelijkheidsgraaf bevragen, overdracht
voorstellen, een mens laat bevestigen. `employment.ended` sluit sessies, trekt
tijdelijke machten in, hergeeft eigenaarschap, herroutert goedkeuringen — en
raakt het bewijs niet aan. Bewaartermijnen blijven van `bestanden-vergeten.js`
en het contract- en auditbewijs verdwijnt niet mee.

Stand: **jaren weg** zolang par. 5 er niet is; de graaf is de voorwaarde.

## 5. De verantwoordelijkheidsgraaf — als PROJECTIE

Dit is het ontbrekende hart. En hier ligt de val die dit huis al eerder heeft
gevonden.

`HDI.md` par. 5.1 is de grens waar dat hele project op staat of valt: er komt
**geen `humans`-tabel**. Een verantwoordelijkheidsgraaf die knopen en kanten in
een eigen tabel opslaat, is precies dat — een tweede database over mensen, met
`deel` als etiket in plaats van als poort. En `LAT.md` regel 4 zegt wat er dan
gebeurt: twee waarheden lopen uiteen, meestal zonder dat iets klaagt.

De vorm die het wél mag hebben staat al in dit huis, in `kern/levensgraaf/graaf.js`:

> DIT IS EEN PROJECTIE, GEEN TWEEDE DATABASE. (…) de graaf LEEST en bouwt de
> knopen elke keer opnieuw. De waarheid blijft waar hij hoort — in de app die
> hem beheert.

Dus: `kern/kantoor/verantwoordelijkheid.js` LEEST `concern/employment`,
`concern/entiteit`, de projecten en de zaken, en bouwt de graaf per vraag
opnieuw. Kanten: `bezit`, `draagt bij`, `keurt goed`, `vervangt`, `rapporteert
aan`, `hangt af van`.

Twee grenzen, allebei geleend van bestaande regels:

1. **De meeteenheid is nooit de mens** (`HDI.md`). De graaf beantwoordt "wie
   bezit dit werk", nooit "hoe presteert deze persoon" — ook niet intern als
   sorteersleutel.
2. **Geen eigenaarloos werk** is een bestaande regel met een bestaande meter:
   `MAATSTAF.md` par. 3 en `scripts/doodspoor.js`, dat vandaag 85 open bronroutes
   telt. Die meter hoort hierop uitgebreid te worden, niet nagebouwd.

Stand: **een besluit vraagt** (welke bronnen dragen eigenaarschap), daarna **een
stap weg**.

## 6. De gebeurtenismotor — `weerklank`, niet `Pulse`

Elke betekenisvolle gebeurtenis loopt langs één vraag:

```
gebeurtenis → wat veranderde → welke objecten → welke verantwoordelijkheden
            → wie moet handelen · wie moet het weten · wie hoeft niets
```

Die laatste is de belangrijkste. Goede bedrijfscommunicatie is niet iedereen
alles sturen.

De ruggengraat ligt er: `kern/envelop.js` draagt `correlatie` en `oorzaak`, en
`kern/stuur/gevolg.js` meet welke collecties een handeling aanraakt. Maar
`gevolg.js` heeft een eigenschap die hier hard meegaat: **`onbekend` en
`geen-effect-gemeten` mogen nooit door elkaar lopen** (96 van 176 paden zijn
vandaag `onbekend`). Een melding die zegt "dit raakt niemand" terwijl niemand
keek, is een geruststelling zonder grond — en dat is erger dan geen melding.

Stand: **een stap weg** voor de bedrading, **half** zolang 96 paden `onbekend` zijn.

## 7. Gezonde stilte, en helpen vóór escaleren

Twee regels die samen de managementdruk wegnemen:

```
gaat alles goed        → het systeem zegt niets
wijkt iets af          → detect → assist → resolve → escalate
```

Niet `detect → manager`. Eerst proberen de medewerker vooruit te helpen: de
ontbrekende bevoegdheid klaarzetten, de collega noemen die dit eerder oploste.
Pas als dat niet lukt, escaleren.

Dit sluit aan op `INTELLIGENTIE.md` INT-04, en dat document trekt hier meteen de
grens die dit voorstel nodig heeft: **de aandachtmotor geeft een besluit met zijn
opbouw en nooit een samengesteld cijfer.** Zie par. 11.

Stand: **een stap weg** voor stilte (dat is meldingen wegláten), **jaren weg**
voor de hulpmotor (die heeft par. 5 en par. 6 nodig).

## 8. Bevoegdheid volgt verantwoordelijkheid, tijdelijk waar het kan

Geen permanente adminrechten. Wie een productie-uitrol moet controleren, krijgt
vier uur leesrecht op één systeem, alleen op een beheerd apparaat, automatisch
ingetrokken, volledig gelogd.

**Dit hoeft niet ontworpen te worden.** `kern/commercie/bevoegdheid.js` kent de
vier dimensies al en versmalt structureel bij delegatie — de tijdelijke macht is
een delegatie met een klok erop. Hij heeft alleen nul aanroepers.

Eén grens uit `EXECUTIE.md` blok 6 geldt onverkort: **een mandaat verleent nooit
vermogen, het versmalt bestaand vermogen.** De speelruimte is een doorsnede, en
**leeg is dicht** — geen mandaat betekent niets zelfstandig, niet alles.

Stand: **een stap weg**. Dit is de goedkoopste grote winst in het document.

## 9. `voornemen.js` als universele uitvoeringslaag

Elke betekenisvolle mutatie: `intent → plan → policy → simulatie → goedkeuring →
uitvoering → bewijs`. "Verwijder deze leverancier" wordt geen `DELETE` maar een
voornemen met gevolgen, risico, vereiste handtekeningen en een simulatie.

`kern/commercie/voornemen.js` is dit al, met vijf regels die er hard staan —
waaronder dat een goedgekeurd plan niet meer kan veranderen (de vingerafdruk
wordt bij elke uitvoering opnieuw gerekend) en dat **een nee geen ja wordt door
het nog eens te vragen**.

Wat ontbreekt is klein en scherp: handtekeningen van meerdere kamers.
`vierogen.js` levert die vergelijking al, mét de graad van de scheiding. Die twee
koppelen is het werk.

Eén bestaande grens blijft: **het voornemen bedenkt zelf geen stappen.** Wie dat
verandert, maakt van de controlelaag een tweede opdrachtgever.

Stand: **een stap weg**.

## 10. Eén schil, kamers eronder

Gemeten vandaag — de kantoorschermen delen niet dezelfde schil:

```
backoffice.html      appshell werkos accounts-os i18n uitvoer   (5)
boardroom.html                             i18n uitvoer         (2)
office.html · rtgkantoor.html                   uitvoer         (1)
kantoor.html · kosten.html · appstore-kantoor.html              (0)
```

Er komt één `RTG Office Shell` met kamers eronder, en elke kamer erft identiteit,
navigatie, commandobalk, zoeken, meldingen, toegankelijkheid, i18n, AI-context,
machtigingen, audit en ontwerptokens. Dan kan een kamer onmogelijk opnieuw een
eigen veiligheidsmodel verzinnen.

Twee dingen die deze verbouwing NIET mag doen: er komt geen `/admin` erbij
(`KANTOORMACHT.md` par. 28), en geen tweede zoekbalk naast `kern/command/zoek.js`.

Stand: **een stap weg**, en het is zichtbaar werk — maar het raakt de machtsvraag
niet. De <!--getal:kantoor.anoniem-->365<!--/getal--> anonieme routes blijven anoniem van een nieuwe schil.

## 11. Waar dit voorstel botst met wat er al besloten is

Vier botsingen. Alle vier zijn ze op te lossen, en alle vier zouden ze stil
verkeerd gaan als niemand ze benoemt.

**11.1 `Confidence 87%` mag niet zo op een scherm.** `INTELLIGENTIE.md` INT-04
zegt het scherpst: `confidence` en `novelty` zijn vandaag niet meetbaar, en
vermenigvuldigen met een verzonnen getal is erger dan het weglaten.
`BEWIJSMACHINE.md` verbiedt het enkele `READY` boven een scorecard, en
`KANTOORMACHT.md` par. 20 verbiedt een samengesteld control-health-cijfer. Een
vooruitblik mag dus, maar in de vorm die `kern/kosten/vooruitblik.js` al gevonden
heeft: **de bandbreedte verschijnt pas als de trefzekerheid over drie afgesloten
perioden GEMETEN is.** Tot die tijd: de onderbouwing zonder het cijfer.

**11.2 `AUTONOOM-BEWEZEN` mag geen vijfde bewijsgraad worden.** Dit huis heeft er
vier (`onbekend`, `vermoed`, `gemeten`, `bewezen`) en die zijn er gekomen nadat er
vijf gezagsvocabulaires langs elkaar bleken te leven; `test/gezagsnoemer.test.js`
bestaat om een vijfde tegen te houden. De elf eisen zijn juist en waardevol —
maar ze zijn een **checklist met een naam**, geen graad. Vorm: een workflow
draagt `autonoomBewezen: true|false` mét de elf uitslagen eronder, en de
bewijsgraden blijven vier.

**11.3 "Never ask humans for information RTG can observe itself" heeft een
grens.** De regel is goed en bespaart echt werk. Maar observeren wat een
medewerker doet is een gedragslogboek, en `KOSTEN.md` heeft daar al een besluit
over: *de meter houdt tellers en geen journaal — een gedragslogboek per lid is
voor een factuur niet nodig.* Voor personeel is die grens strenger, niet losser.
Dus: RTG leest **werkobjecten** (taak af, besluit genomen, test geslaagd,
afhankelijkheid geblokkeerd) en nooit **werkgedrag** (wanneer iemand typt, hoe
lang hij in een scherm zit, hoeveel hij op een dag doet). En `HDI.md` erboven:
een voortgangsmaat mag over een cohort en nooit per persoon, ook niet intern als
sorteersleutel.

**11.4 "Every person is known" betekent hier iets anders dan elders.** Bekend =
**codenaam plus dienstverband**, niet naam. De naam blijft in de kluis en komt
eruit met een doel, een bevoegdheid en een journaalregel. Dat is precies de
`purpose + authority → identity reveal` uit het voorstel, en het bestaat al:
`kluispoort.js` + `inzagelog.js`, waar een lege "waarom" al een fout is. De
uitbreiding is de VELDKLASSE (`KANTOORMACHT.md` par. 21): zonder gegevensklasse
per veld wordt het samengestelde beeld een met de hand onderhouden lijst blokken
die binnen een jaar uit de code loopt. Die klasse bestaat nog niet.

## 12. De prijs die iemand moet willen betalen

Twee dingen die dit document niet wegpoetst.

**Er staat nergens hoeveel medewerkers RTG heeft.** `KANTOORMACHT.md` par. 29
laat dat bewust open, en voor de architectuur is dat juist. Maar voor twee
mechanismen is het een blokkade: een canary op een percentage is bij drie mensen
niet streng maar zinloos (daarom rolt kantoorbeleid per KAMER uit), en **bij drie
mensen is "een tweede paar ogen" soms "dezelfde mens morgen"**. Daar helpt geen
hoeveelheid code tegen. `vierogen.js` is er eerlijk over: hij levert de graad van
de scheiding mee in plaats van een groen vinkje.

**`ENFORCE_EXECUTE` heeft een prijs.** <!--getal:kantoor.deurGedeeld-->418<!--/getal--> routes hangen aan de gedeelde deur, en
het kantoor doet daar het dagelijkse werk mee. Wie de deur dichtzet zonder eerst
de schaduwronde, legt werk stil dat gisteren gewoon mocht. Dat is precies waarom
`kluispoort.js` destijds de gedeelde code níét heeft afgesloten: *deze poort
verkleint wat die sessie MAG; hij verandert niets aan wie er binnenkomt.*

## 13. De tien wetten, met hun handhaver

Een wet zonder handhaver is een voornemen. Per wet wie hem vandaag tegenhoudt:

| | Wet | Handhaver |
|---|---|---|
| 1 | Geen anonieme menselijke effecten | `npm run kantoormacht:controle` — **staat** |
| 2 | Geen eigenaarloos werk | `scripts/doodspoor.js` — staat, nog niet op personeel |
| 3 | Geen opdracht zonder context | — **niemand** |
| 4 | Geen handmatige rapportage van waarneembare feiten | — niemand; par. 11.3 begrenst hem |
| 5 | Niet standaard rondsturen | — niemand; vraagt par. 6 |
| 6 | Geen ingreep zolang het gezond is | — niemand |
| 7 | Helpen vóór escaleren | — niemand |
| 8 | Bevoegdheid volgt verantwoordelijkheid, tijdelijk | `commercie/bevoegdheid.js` bestaat, 0 aanroepers |
| 9 | Elke ingrijpende handeling kan zichzelf verklaren | `economie/firewall.js` + `besluit.js` — het patroon staat |
| 10 | Niets kritieks wordt geloofd omdat documentatie het zegt | `scripts/check.js` + de registers — **staat** |

**Zes van de tien hebben vandaag geen handhaver.** Dat is de eerlijke stand, en
het is de bouwlijst.

## 14. De volgorde

| Blok | Wat | Stand |
|---|---|---|
| **0** | de meter — `scripts/kantoormacht.js` → `KANTOORMACHT.json` | **staat** (6 sep 2026) |
| **1** | mens achter de deur: schaduw, dan `ENFORCE_EXECUTE` | een besluit vraagt |
| **2** | passkey aan de kantoordeur — `webauthn/` koppelen | een stap weg |
| **3** | `actor.*` compleet in de envelop | een stap weg |
| **4** | verantwoordelijkheidsgraaf als projectie | een besluit vraagt |
| **5** | tijdelijke bevoegdheid — `commercie/bevoegdheid.js` aansluiten | een stap weg |
| **6** | `voornemen.js` × `vierogen.js` aan de kantoordeur | een stap weg |
| **7** | `weerklank` — de gebeurtenismotor | een stap weg |
| **8** | één schil, kamers eronder | een stap weg |
| **9** | gezonde stilte | een stap weg |
| **10** | aankomstplan en dag 1 | een stap weg |
| **11** | helpen vóór escaleren | jaren weg |
| **12** | vooruitblik — pas na drie gemeten perioden (par. 11.1) | jaren weg |

Blok 2 vóór blok 1 is geen vergissing: een passkey aan de deur maakt
`ENFORCE_EXECUTE` betaalbaar, want dan is "inloggen op naam" geen extra last maar
juist minder wrijving dan een code overtypen.

## 15. Wat er bewust niet komt

- **Geen `humans`-tabel.** De graaf is een projectie (par. 5).
- **Geen vijfde bewijsgraad** (par. 11.2), en geen zesde gezagsvocabulaire.
- **Geen samengesteld cijfer** — niet over control health, niet over een mens,
  niet over een voorspelling.
- **Geen score op een medewerker.** Niet zichtbaar, niet intern, niet als
  sorteersleutel.
- **Geen gedragslogboek** (par. 11.3). Werkobjecten wel, werkgedrag niet.
- **Geen achterdeur voor de AI.** Elke AI-handeling loopt langs dezelfde poort,
  en de AI kan nooit meer dan de mens die hem iets vraagt.
- **Geen tweede zoekbalk, geen `/admin`, geen achtste auditcollectie.**

## 16. Wat dit document niet zegt

De getallen in par. 1 zijn van 6 september 2026 en dragen hun graad. Ze komen uit
`KANTOORMACHT.json` en verouderen met een gezakte toets in plaats van in stilte —
dat is de hele reden dat blok 0 vóór de rest ging.

En één ding is met opzet niet opgelost: of de personeelsreis van dit document bij
drie medewerkers hetzelfde hoort te zijn als bij driehonderd. Het model staat
vanaf het begin; wat meegroeit is hoeveel ervan wordt afgedwongen
(`KANTOORMACHT.md` par. 24). Maar een aankomstplan, een mentor en een
introductieprogramma zijn bij drie mensen een gesprek en geen systeem, en dat
verschil hoort een mens te maken en niet dit document.
