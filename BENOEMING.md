# RTFoundation Roles & Governance 2.0

**Van een zetel die iemand krijgt omdat een ander op "toekennen" drukt, naar een
keten die bij de mens begint en bij een bewijs eindigt:**

> Persoon → relatie met de Foundation → benoeming → aanvaarding → vereisten →
> rol → rechten → reikwijdte (land/stad/project/casus) → stap-op waar nodig →
> handeling → audit → intrekking of verloop.

Dit is een **richtingsdocument**, zoals `AFSPRAAK.md`, `HDI.md` en `ECONOMIE.md`.
Per onderdeel staat erbij of het **staat**, **een stap weg** is, **een besluit
vraagt** of **jaren weg** is. Die vier zijn niet uitwisselbaar.

Wat hier NIET opnieuw wordt uitgelegd: `FOUNDATION.md` (wat de Foundation is en
waarom ze opent in plaats van stuurt), `KANTOORMACHT.md` (wat een medewerker van
RTG mag), `MENSNETWERK.md` (wie namens een mens handelt). Dit document gaat over
één vraag: **wie mag binnen de RTFoundation iets doen, sinds wanneer, waarom, en
hoe houdt dat op.**

De opdracht kwam van de eigenaar (23 september 2026), in acht punten. Ze staan
hieronder allemaal, maar niet in de volgorde waarin ze werden gevraagd: de meting
legde twee dingen bloot die eerst moeten.

---

## 1. Wat er staat — gemeten, niet aangenomen

De RTFoundation heeft **al een rollenmodel**, en 2.0 is dus een verbouwing en geen
nieuwbouw. Dat is het belangrijkste feit van dit document: een tweede rollenlaag
naast de eerste zou precies de `VERMOGENS`-fout zijn (twee lijsten met dezelfde
naam en nul gedeelde leden).

| onderdeel | plek | stand |
|---|---|---|
| drie rollen: `stadsbestuur`, `projectleider`, `medewerker` | `server/kern/rtfos/basis.js:28` | staat |
| rechten per rol (13 / 9 / 3) | `basis.js:30` (`RECHTEN`) | staat |
| uitgavegrens per rol (€ 250 / € 2.500, stad mag verlagen) | `basis.js:42` (`LIMIET`), `steden.js:123` | staat |
| wie ben ik: `landelijk` óf zetels per stad | `basis.js:108` (`wieIn`) | staat |
| de poort per stad: bestaat, recht, modulevlag, stadsstand | `basis.js:141` (`poortIn`) | staat |
| zetel zetten / weghalen, audit, laatste stadsbestuur gemeld | `zetels.js:38`, `:67` | staat |
| vergaderingen, quorum, belangenverstrengeling, notulen | `bestuur.js`, `bestuur-notulen.js` | staat |
| audit, append-only, afkap geteld | `basis.js:93` | staat |

Gemeten over de routes (`ROUTEBRON.json`, stempel 19 september): **196 routes**
onder `/api/rtfos/`. Vrijwel elke handeling loopt via `poortIn(w, stad, recht,
vlag)` — de reikwijdte is dus overal al de STAD van het object, en dat is een
goede basis om naar project en casus te verfijnen.

### 1.1 Wat de meting vond dat niet in de opdracht stond

**A. De deur is het eerste probleem, niet het model.** Elke RTFOS-route hangt
achter `officeAuth` (`routes/rtfos/index.js:52` en verder), en de app leest
`rtg_office_token` (`public/apps/foundation/os.html:131`). Een zetel werkt dus
alleen voor wie een kantoorsessie mét naam heeft — en die krijgt een gewoon lid
door de **gedeelde backoffice-code** aan zijn account te koppelen. De toets doet
het letterlijk zo (`test/rtfos.test.js:74`: *"een gewoon lid dat de kantoordeur
opent met de backoffice-code"*).

Gevolg: een projectleider in Haarlem moet de sleutel van het hele RTG-kantoor
krijgen — `KANTOOR.md` telt 605 kantoorroutes, waarvan 427 achter die gedeelde
code — om zijn eigen stad te kunnen openen. Punt 1 van de opdracht (*"de server
valideert de juiste Foundation-context"*) kan niet zolang de Foundation-context en
de RTG-kantoorcontext dezelfde deur zijn. **Een benoeming bij de Foundation mag
nooit een RTG-kantoorsleutel vereisen.** Dat is fase 1, vóór alles.

**B. Intrekken beëindigt vandaag niets dat al loopt.** `zetelWeg` (`zetels.js:67`)
en ook de boardroom (`routes/kantoren/regie.js:89`) halen een rij uit een lijst en
schrijven een auditregel. Er is geen enkele sessie die daardoor dichtgaat. Omdat
`wieIn` bij elk verzoek opnieuw leest, verliest iemand zijn zetelrechten wel bij
het volgende verzoek — maar de kantoorsessie waarmee hij binnenkwam blijft staan,
en daarmee de rest van het kantoor. Het enige bestaande patroon dat sessies
werkelijk intrekt staat in `routes/member/toestellen.js:107` (`vanLid` →
`trekInSessie` → `sluit`), en dat wordt het sjabloon.

### 1.2 De vijf eerder gevonden gaten, nagemeten

| # | gat | bron | bevestigd |
|---|---|---|---|
| 1 | zetel op een kale sleutel, niet gecontroleerd | `zetels.js:49` (`schoon(b.key)`), `os.html:1022` (*"Accountsleutel (user-123)"*) | ja |
| 2 | geen uitnodiging, geen aanvaarding, geen bericht | `zetels.js:38-65` | ja |
| 3 | geen vereisten bij een zetel met `casus.*` | `RECHTEN` vs. `zetelZet` | ja |
| 4 | quorum telt elke zetel in de stad | `bestuur.js:46` | ja — en erger: aanwezigheid en stemmen zijn **vrije tekst** (`bestuur.js:103`, `:133`), niet gebonden aan een zetel |
| 5 | geen werkgeverslaag | `FOUNDATION.md` verwijst naar `CONCERN.md`, daar bestaat geen RTF-entiteit | ja |

Daarbij nog drie kleinere:

- vier kantoorroutes van de stichting (`gift/plan/*`, `winkel/*`,
  `routes/rtfos/index.js:122-137`) toetsen **geen enkel RTFOS-recht** — alleen de
  kantoordeur;
- het landelijke orgaan heeft geen leden in het systeem: het quorum van een
  landelijke vergadering komt uit een getal dat de secretaris intypt
  (`bestuur.js:81`, `omvang`). Dat is eerlijk gedocumenteerd, maar het betekent
  dat "stemgerechtigd" landelijk nu nergens bestaat;
- de RTFOS-`RECHTEN` staan **niet** in `CAPABILITEIT.json` (21 geregistreerde
  woordenlijsten, deze niet). Het is een ongemeten 22e rechtenlijst.

En één ding dat de migratie makkelijker maakt dan gevreesd: **geen enkele seed
zet een zetel neer** (0 rijen in `server/seed*` en de zaaisets). Wat er in
productie staat, is alleen daar te tellen — vandaar de inventarisatie in fase 0.

---

## 2. Correcties op de opdracht

De opdracht is juist in zijn richting. Vier dingen erin zouden, letterlijk
gebouwd, tegen een regel van dit huis lopen.

### 2.1 Eén grammatica, geen gedeelde rechtentabel

*"Dezelfde onderliggende autorisatie-engine kan later voor WorkOS,
franchise-landen en andere RTG-organisaties worden gebruikt."* Dat klopt voor de
**grammatica** en niet voor de **inhoud**, en het verschil is hier al drie keer
gemeten:

- `OS.md`: één grammatica mag over **platformvermogen** (mag deze aanroep, en doet
  hij het?), nooit over **domeinvermogen** — `casus.beheren` en `bookings` delen
  niets, en een tabel die ze allebei draagt is de `Asset`-fout;
- `CONCERN.md` / `kern/concern/scope.js`: *er komt geen derde rechtenmodel bij* —
  WorkOS heeft `bedrijf/rollen-register.js` (rechten als werkwoorden, rollen als
  bundels);
- `CAPABILITEIT.json`: 21 woordenlijsten, 91% van de leden woont in precies één.

Wat wél gedeeld wordt, en wat al bestaat:

| gedeelde grammatica | bestaat als | hergebruik |
|---|---|---|
| een stand die BEREKEND wordt en nooit wordt opgeslagen | `kern/vertegenwoordiging/machtiging.js:57` (`stand()`) | het patroon |
| leeg is dicht, versmallen en nooit verlenen | `kern/stuur/mandaat.js:53`, `machtiging-gebruik.js` | het patroon |
| een geweigerde poging laat een spoor na | `kern/vertegenwoordiging/handelen.js:53` | het patroon |
| vereisten per HANDELING, niet per rol | `kern/persoonseis.js:101` (`magHandeling`) + `kern/vakbewijs.js:164` | direct |
| stap-op met een passkey, gebonden aan actie en sessie | `kern/zwaarbewijs.js:69` + `ZWARE_ACTIES` | direct |
| vier ogen, lijf bevroren, verzoeker ≠ bevestiger | `kern/kantoor/tweedehandtekening.js:91`, `:115` | direct |
| eerst meelopen, dan afdwingen, met een rijpheidseis | `kern/commercie/schaduw.js:47` (`RIJP`) | direct |
| iemand kiezen op codenaam | `kern/gids.js:98` (`keyVanCodenaam`, async, geeft een object) | direct |
| een persoonlijk bericht op de sleutel van het lid | `opzet/meldaan.js:79` (`meldLid`) | direct |
| sessies echt intrekken | `routes/member/toestellen.js:107` | wordt `trekRolIn` |

Wat WorkOS later dus van deze ronde erft, is die rij bouwstenen plus de
benoemingslevenscyclus. De RTFOS-`RECHTEN` blijven van de Foundation, en ze gaan
`CAPABILITEIT.json` in zodat ze gemeten worden.

### 2.2 Vijf dimensies — en welke daarvan al een huis hebben

De opdracht trekt één titel uit elkaar in vijf dingen. Dat is de kern van het
ontwerp, en drie van de vijf bestaan al:

| dimensie | betekenis | huis | stand |
|---|---|---|---|
| **relatie** | wat IS iemand voor de Foundation (vrijwilliger, werknemer, bestuurder, opdrachtnemer, extern) | vrijwilliger: `kern/rtfos/vrijwilligers.js`; werknemer: `kern/concern/employment.js` | half — zie 2.4 |
| **stemzetel** | bestuurlijke stem in een orgaan | nieuw: een benoeming met `stemgerechtigd` | een stap weg |
| **werkrol** | wat iemand uitvoert | de bestaande `ROLLEN` + `RECHTEN` | staat |
| **casusinzage** | toegang tot gevoelige dossiers | de rechten `casus.lezen` / `casus.beheren`, plus `noteerVast` bij elke lezing | half — de rechten staan, het vaste spoor niet |
| **uitgavegrens** | hoeveel iemand mag uitgeven of goedkeuren | `LIMIET` per rol, per stad te verlagen | staat, hangt nu aan de rol en wordt een eigen veld van de benoeming |

**De relatie geeft geen enkel recht.** Iemand kan vrijwilliger zijn zonder iets
te mogen, en bestuurder met een stem maar zonder casusinzage. Een benoeming
VERWIJST naar een relatie, en een relatie die eindigt laat de benoemingen die
erop steunen eindigen — nooit andersom.

### 2.3 Namen die al bezet zijn

Gemeten over `server/` en `SEMANTIEK.json`, 23 september:

| gevraagd | uitslag | besluit |
|---|---|---|
| `benoeming` | vrij (2× in commentaar, 0 als naam) | **de kernnaam van deze laag** |
| `stemgerechtigd` | vrij (0) | gebruiken |
| `zetel` | bezet, drie betekenissen (RTFOS, ledenbalie, statutaire zetel van een bedrijf) | de RTFOS-betekenis blijft; niet uitbreiden |
| `ROLLEN` | 19 losse `const ROLLEN`, 10 betekenissen in `SEMANTIEK.json` | geen 20e — de RTFOS-lijst wordt uitgebreid |
| `mandaat` | bezet (AI-speelruimte, 68 bestanden) | **niet** voor de financiële grens → `uitgavegrens` |
| `machtiging` | bezet (SEPA, mens-namens-mens, app) | niet gebruiken |
| `bevoegdheid` | bezet (`kern/bevoegdheid/`: mag RTG dit?) | niet gebruiken |
| `capability` / `VERMOGENS` | bezet, `HDI.md` par. 2 waarschuwt al | in de code heet het `recht` (zoals nu) |
| `relatie` | zes `relaties.js`-modules | in de code `band`; op het scherm mag "relatie" |
| `geschorst` | bezet: de bewijsstand van `middleware/schorspoort.js` | de stand heet **`opgeschort`** |
| `termijn` | bezet (bewaartermijnen, betaaltermijnen) | **`zittingsduur`** |
| `waarnemer` / `vervanging` | bezet (`school/`) | **`plaatsvervanger`** |
| `autorisatie` | bezet (vier ogen in `bankregie/`) | niet gebruiken |

### 2.4 De werkgeverslaag vraagt eerst een rechtspersoon

Punt 6 (*"RTFoundation moet personen kunnen kennen als vrijwilliger, werknemer,
bestuurder, opdrachtnemer of externe partner"*) leunt op `kern/concern/employment.js`
— die kent `persoon` (codenaam), `entiteit`, `rol`, `van`, `tot`, en eindigt
zonder te wissen. Wat ontbreekt is niet de motor maar de **entiteit**: de
RTFoundation bestaat in dit huis niet als concern-entiteit. `GIFT.md` stuit op
precies hetzelfde (*"er is geen codenaam of positie van de RTFoundation om aan te
betalen"*). Dat is één besluit met twee gevolgen, en het hoort een keer genomen te
worden en niet twee keer apart. Zie besluit B3.

---

## 3. Het model

### 3.1 De benoeming

Eén object, `benoeming`, in `db.data.rtfos.benoemingen`. De bestaande zetel wordt
er een SOORT van, geen tweede ding ernaast.

```
benoeming {
  id, persoon: 'user-<id>'      // immutable accountsleutel; op het scherm de codenaam
  band: 'vrijwilliger' | 'werknemer' | 'bestuurder' | 'opdrachtnemer' | 'extern'
  orgaan: 'landelijk' | 'stad'   // waar de stem of het werk zit
  stad, project?, casus?         // de reikwijdte, van breed naar smal
  rol: 'stadsbestuur' | 'projectleider' | 'medewerker' | <landelijke rollen, 3.4>
  stemgerechtigd: boolean        // alleen een stemzetel telt mee in het quorum
  uitgavegrens: centen | null    // nooit boven LIMIET van de rol (versmallen)
  van, tot                       // tot is VERPLICHT: zittingsduur, geen eeuwigheid
  plaatsvervangerVan?            // tijdelijke vervanging: een eigen benoeming met eigen tot
  voorgesteldDoor, aanvaard?, afgewezen?, opgeschort?, ingetrokken?
  herkomst: 'v2' | 'v1-migratie'
}
```

De **stand wordt berekend**, nooit opgeslagen — de vorm van
`vertegenwoordiging/machtiging.js:57`. Opslaan gebeurt alleen met GEBEURTENISSEN
(voorgesteld, gecontroleerd, uitgenodigd, aanvaard, afgewezen, opgeschort,
hervat, ingetrokken), elk met wie, wanneer en waarom.

```
voorgesteld ──controle──▶ uitgenodigd ──aanvaard──▶ aanvaard ──van bereikt──▶ actief
     │                        │                                                 │
     └──▶ afgewezen ◀─────────┘ (door de voorgedragene of door de controle)     ├──▶ opgeschort ──▶ actief
                                                                                ├──▶ verlopen   (tot bereikt, berekend)
                                     elke stand behalve afgewezen/verlopen ────▶└──▶ ingetrokken
```

Volgorde van berekening (de strengste wint): ingetrokken → afgewezen → verlopen →
opgeschort → nog niet aanvaard → nog niet uitgenodigd → `van` in de toekomst →
actief.

**`controle`** is geen stand maar een poort tussen voorgesteld en uitgenodigd: bestaat
het account, is het actief (`accounts.isActief`), is de voorsteller bevoegd voor
dit orgaan en deze reikwijdte, is er een lopende band (2.2). De VEREISTEN (3.2)
worden daar gemeld maar niet geblokkeerd — zie hieronder.

### 3.2 Vereisten volgen uit het recht, niet uit de titel

Dit is punt 3 van de opdracht, en het mechanisme bestaat al in `kern/persoonseis.js`:
een vereiste hoort bij een HANDELING, en is een **filter en geen rol**. Verloopt een
VOG, dan houdt het werk met jongeren op — de benoeming blijft staan. Dat is precies
het verschil tussen "de rol is weg" en "je mag dit vandaag niet", en het eerste zou
een verlopen document tot een ontslag maken.

Voorstel voor de tabel (besluit B2 legt hem vast):

| recht | vereiste | waarom |
|---|---|---|
| `stad.lezen`, `rapport.lezen`, `incident.melden` | een eigen RTG-account | geen gevoelige inhoud |
| `project.beheren`, `vrijwilliger.beheren`, `partner.beoordelen` | account + 18+ | handelt namens de Foundation richting derden |
| `uitgave.aanvragen`, `uitgave.besluit`, `geld.beheren`, `project.besluit` | `volwassen()` (A3: identiteitsbewijs gezien, 18+) | geld verlaat de stichting |
| `casus.lezen`, `casus.beheren` | `volwassen()` + geldige VOG (`vakbewijs`, afgetekend door een mens van RTG) | kwetsbare mensen |
| alles in een project met een VOG-plichtig type (`vrijwilligers.js:28`) | geldige VOG | bestaat al voor vrijwilligers; nu ook voor wie beheert |

Wordt het register later uitgebreid met een recht, dan krijgt dat recht een regel in
deze tabel of de toets zakt (`test/persoonseis.test.js` doet dat al voor genres) —
**een recht zonder verklaarde vereiste bestaat niet**. Zo kan er een functie bij
zonder het rollenmodel te verbouwen.

Een vereiste wordt bij ELK verzoek opnieuw gerekend (`vakbewijsHeeft` doet dat al),
en de weigering zegt welk stuk ontbreekt en waar je het aanlevert.

### 3.3 Governance en werk uit elkaar

Punt 4 van de opdracht, en de quorumfout lost zich hierin op in plaats van ernaast:

- een **orgaan** heeft leden = de ACTIEVE benoemingen met `stemgerechtigd: true`
  in dat orgaan (landelijk, of een stad);
- het **quorum** wordt uitsluitend daaruit gerekend. `bestuur.js:46` telt dan
  niet langer "alle zetels in de stad";
- **aanwezigheid en stemmen** worden accountsleutels van die leden, niet vrije
  tekst — een stem van iemand die geen stemzetel heeft wordt geweigerd mét de
  reden, en belangenverstrengeling (`bestuur.js:141`) blijft werken;
- het **landelijke orgaan** krijgt voor het eerst leden. `omvang` (ingetypt door
  de secretaris) blijft bestaan voor vergaderingen van vóór de omschakeling —
  een oud besluit wordt niet met terugwerkende kracht ongeldig — en verdwijnt
  voor nieuwe;
- een `medewerker` is **nooit** stemgerechtigd; `stadsbestuur` standaard wel;
  een `projectleider` alleen als de benoeming dat zegt.

### 3.4 Landelijk is niet onbeperkt

Punt 5. Vandaag is `landelijk` een schakelaar: `magRecht` laat hem overal door
(`basis.js:121`). In 2.0 worden de landelijke handelingen **rechten** zoals die van
een stad, en toegang tot de boardroom maakt je daarmee geen landelijk bestuurder
meer — een boardroom-sleutel is RTG-kantoor, een landelijke zetel is Foundation.

De landelijke handelingen die vandaag op `w.landelijk` hangen (gemeten, 1.1 van de
inventaris): stad maken en status zetten, modulevlaggen, uitgavegrenzen, de
auditlijst, jaarverslag, campagnes, externe berichten, beleid, landelijke risico's,
herkomst, benchmark, landelijke vergaderingen, herbestemmen van geld, partner
op actief. Voorstel voor landelijke rollen (besluit B4):

| rol | voorbeeld van rechten | stem |
|---|---|---|
| `voorzitter` | vergadering leiden, benoemingen voordragen | ja |
| `secretaris` | notulen, besluitenlijst, jaarverslag | ja |
| `penningmeester` | geld herbestemmen, uitgavegrenzen, grote uitgaven | ja |
| `bestuurslid` | besluiten, inzage | ja |
| `toezicht` | alles LEZEN, de auditlijst, niets uitvoeren | nee |

**Zware handelingen** — met stap-op (`zwaarbewijs.eis`, toegevoegd aan
`ZWARE_ACTIES`) én waar het om macht of veel geld gaat een tweede handtekening
(`tweedehandtekening.js`):

| handeling | stap-op | vier ogen |
|---|---|---|
| een stemzetel benoemen of intrekken (landelijk of stadsbestuur) | ja | ja |
| een landelijke rol benoemen of intrekken | ja | ja |
| een uitgave boven de landelijke grens goedkeuren | ja | ja |
| een uitgavegrens verhogen richting het plafond | ja | nee |
| casusinzage verlenen | ja | nee |
| een stad op `geblokkeerd` of `beeindigd` zetten | ja | ja |

**De eigenaar is hier geen uitzondering.** De boardroom geeft hem vandaag alles in
de Foundation; in 2.0 heeft ook hij een landelijke benoeming nodig (besluit B1). Een
eigenaar-achterdeur in een stichting die `ECONOMIE.md` een eigen rechtspersoon met
een eigen vermogen noemt, is precies wat de firewall daar tegenhoudt.

### 3.5 Levenscyclus

| gebeurtenis | wat er gebeurt | wat er NIET gebeurt |
|---|---|---|
| einde zittingsduur | stand wordt `verlopen` (berekend); vooraf een bericht, zoals `vakbewijzenVerlopend` | niemand hoeft op een knop te drukken |
| functiewijziging | de oude benoeming eindigt, er komt een nieuwe | een benoeming wordt nooit ter plekke van rol veranderd — anders verliest de audit wat iemand WAS |
| tijdelijke vervanging | een eigen benoeming met `plaatsvervangerVan` en een korte `tot` | de vervangen benoeming verandert niet |
| opschorting | stand `opgeschort`, met reden; hervatten is een eigen gebeurtenis | geen `geschorst` (bezet, 2.3) |
| vertrek | de band eindigt, alle benoemingen erop worden ingetrokken | niets wordt gewist |
| intrekking | stand `ingetrokken` **en** `trekRolIn`: elke sessie van die persoon die deze rechten droeg, gaat dicht | de rest van zijn RTG-account blijft werken |

Bij elke overgang krijgt de betrokkene een persoonlijk bericht (`meldLid`), en een
geweigerde poging met een ingetrokken of opgeschorte benoeming laat een spoor na
(het patroon van `vertegenwoordiging/handelen.js:53`).

### 3.6 Audit

`basis.js:93` blijft de audit. Twee dingen erbij: de regels worden aan een hashketen
gehangen (`lib/keten.js`) zodat wat er staat onvervalsbaar is, en een casuslezing
schrijft via `noteerVast` — **geen vastgelegd spoor, geen inzage**, de regel die
`MENSNETWERK.md` besluit 5 al voor de ledenbalie nam. Let op wat een keten NIET
bewijst: dat er niets is afgekapt. De afkapteller blijft daarom staan.

---

## 4. De acht punten naast de meting

| # | punt uit de opdracht | wat er staat | stand |
|---|---|---|---|
| 1 | geen user-123, codenaam kiezen, server valideert | `keyVanCodenaam` bestaat; `zetelZet` valideert niets; de deur is de kantoordeur (1.1 A) | een stap weg — na fase 1 |
| 2 | benoeming als workflow | het patroon staat in `vertegenwoordiging/`; hier niets | een stap weg |
| 3 | vereisten per recht | `persoonseis` + `vakbewijs` + `volwassen` staan, per genre; tabel 3.2 | een stap weg, vraagt besluit B2 |
| 4 | governance los van werk, quorum uit stemzetels | quorum telt alles, stemmen zijn vrije tekst | een stap weg |
| 5 | landelijk niet onbeperkt, stap-op en audit | stap-op en vier ogen staan; landelijk = alles | een stap weg, vraagt besluit B1 en B4 |
| 6 | werkgeverslaag | `employment.js` staat; de RTFoundation als entiteit niet | vraagt besluit B3 |
| 7 | volledige levenscyclus, intrekking sluit sessies | sessies intrekken kan (`toestellen.js`); niets roept het aan bij een rol | een stap weg |
| 8 | migreren zonder stil privileges te veranderen | 0 zetels in de seed; productie onbekend | fase 0 meet het |

---

## 5. De migratie: niemand wordt stil buitengesloten, niemand krijgt er stil iets bij

De huisregel is die van `CONTROLPLANE.md`: je kunt niet afdwingen wat nooit in de
schaduw heeft gelopen. Zes stappen, elk met een uitgang die zakt als hij niet klopt.

1. **Inventaris** — een script (te bouwen in fase 0, `scripts/benoemingen.js`) leest wat er staat: elke
   zetel, elke boardroom-sleutel, per persoon de EFFECTIEVE rechten per stad
   zoals `magRecht` en `limietVan` ze vandaag geven. Dat wordt het nulpunt,
   vastgelegd met stempel.
2. **Ernaast opbouwen** — elke v1-zetel wordt een benoeming met `herkomst:
   'v1-migratie'`, stand `actief`, `aanvaard` gelijk aan de oude `at` (wie hem al
   had, heeft hem al aanvaard door te werken), en een `tot` die expliciet als
   "overgangstermijn" gemarkeerd is.
3. **Afbeelden en vergelijken** — de toets die dit hele document draagt: voor
   ELKE gemigreerde persoon zijn de effectieve rechten per stad in v2 **byte voor
   byte gelijk** aan het nulpunt. Afwijkingen in beide richtingen worden gemeld,
   niet gecorrigeerd — wie er in v2 iets bij zou krijgen is net zo fout als wie
   iets verliest.
4. **Vereisten in de schaduw** — `kern/commercie/schaduw.js`, per recht. Een
   bestuurder zonder VOG die casussen leest wordt GETELD, niet geweigerd, en krijgt
   een bericht met wat er ontbreekt en tot wanneer het nog zonder kan.
5. **Omschakelen per stad** — niet per percentage (`KANTOORMACHT.md`: bij een
   handvol mensen is een percentage zinloos, dus per kamer, hier per stad), en pas
   als de schaduw rijp is (`RIJP`: 200 waarnemingen, 7 dagen).
6. **v1 weg** — `zetelZet` en `zetelWeg` worden dunne voorportalen van de
   benoeming, en de landelijke schakelaar valt pas weg als iedere boardroom-sleutel
   die vandaag landelijk werkt een landelijke benoeming heeft (of bewust niet).

**Het landelijke orgaan is de lastigste stap.** Vandaag is iedereen met
boardroom-toegang automatisch landelijk bestuurder. Als dat in stap 6 wegvalt
zonder dat die mensen een landelijke benoeming hebben, verliest de eigenaar zelf
zijn Foundation-toegang. De migratie maakt daarom voor elke boardroom-sleutel een
VOORSTEL tot landelijke benoeming (niet een benoeming), en de eigenaar aanvaardt of
wijst af. Er gebeurt dus niets met de landelijke laag zonder een mens.

---

## 6. Bouwvolgorde

Eén samenhangende ronde, maar niet één PR: elke fase is afzonderlijk te mergen en
laat v1 werken tot fase 5.

| fase | inhoud | hangt af van |
|---|---|---|
| 0 | inventarisscript + RTFOS-`RECHTEN` in `CAPABILITEIT.json` | — |
| 1 | **de eigen deur**: RTFOS op een ledensessie met een actieve benoeming, zonder kantoorcode (de kantoordeur blijft werken tot fase 5) | besluit B1 |
| 2 | benoeming + levenscyclus + codenaamkeuze + uitnodiging + `meldLid`; v1-zetels gelezen als benoemingen; de gelijkheidstoets van 5.3 | fase 0 |
| 3 | governance: stemzetels, quorum uit stemzetels, stemmen op sleutel, landelijk orgaan met leden | fase 2, besluit B4 |
| 4 | vereisten per recht, eerst in de schaduw | fase 2, besluit B2 |
| 5 | landelijke rechten, stap-op, vier ogen, `trekRolIn`; omschakelen per stad | fase 3 en 4 |
| 6 | de band: RTFoundation als entiteit, werknemer en opdrachtnemer via `employment.js` | besluit B3 |

---

## 7. Besluiten van de eigenaar

**B1 — Wie opent de Foundation-deur, en wat doet de boardroom daar nog?**
- **(aanbevolen)** Alleen een actieve benoeming. De boardroom geeft geen
  Foundation-rechten meer; de eigenaar krijgt, zoals iedereen, een landelijke
  benoeming (tijdens de migratie als voorstel dat hij zelf aanvaardt). *Kost:* de
  eigenaar doet één handeling meer, en er bestaat geen achterdeur meer die hem
  alles geeft.
- De boardroom blijft landelijk = alles. *Kost:* punt 5 van de opdracht vervalt
  voor precies de mensen met de meeste macht.

**B2 — De vereistentabel (3.2).**
- **(aanbevolen)** Zoals voorgesteld: A3 voor geld, A3 + VOG voor casussen, VOG
  voor VOG-plichtige projecttypen. *Kost:* wie vandaag casussen leest zonder VOG,
  moet er een aanleveren (in de schaduw eerst geteld, niet geweigerd).
- Strenger: A3 voor elke benoeming. *Kost:* een medewerker die alleen meeleest,
  moet eerst zijn paspoort laten zien.
- Lichter: alleen VOG bij casussen. *Kost:* geld kan worden goedgekeurd door
  iemand van wie RTG de identiteit niet heeft gezien.

**B3 — Wordt de RTFoundation een entiteit in dit huis?**
- **(aanbevolen)** Ja, één keer, als concern-entiteit met een codenaam — en dan
  meteen ook als positie waar `GIFT.md` op wacht. *Kost:* dat is een juridisch
  besluit (een eigen rechtspersoon met eigen vermogen, `ECONOMIE.md`), geen
  bouwtaak, en het hoort genomen te worden door wie de statuten kent.
- Nog niet; fase 6 wacht. *Kost:* vrijwilliger blijft de enige band die bestaat;
  werknemer en opdrachtnemer staan er als `nietGebouwd` met de reden.

**B4 — De landelijke rollen (3.4).**
- **(aanbevolen)** voorzitter, secretaris, penningmeester, bestuurslid, toezicht —
  met toezicht zonder stem en zonder uitvoerende rechten.
- Alleen `bestuurslid`, allemaal gelijk. *Kost:* geen scheiding tussen wie geld
  beheert en wie toezicht houdt — en dat is juist wat een stichting hoort te hebben.

**B5 — Hoe lang mag een v1-zetel zonder vereisten doorlopen?**
- **(aanbevolen)** 60 dagen na fase 4, met berichten op 30, 14 en 3 dagen.
- 30 dagen. *Kost:* wie een VOG moet aanvragen haalt dat in Nederland vaak niet.
- Geen termijn; tellen tot een mens besluit. *Kost:* de schaduw kan eeuwig duren.

---

## 8. Grenzen

1. **Een benoeming verleent nooit meer dan de rol toestaat.** `uitgavegrens` en
   reikwijdte kunnen versmallen, nooit verbreden.
2. **Niemand benoemt zichzelf, en niemand keurt zijn eigen voordracht.** Ook de
   eigenaar niet.
3. **Een Foundation-benoeming vereist nooit een RTG-kantoorsleutel**, en een
   RTG-kantoorsleutel geeft nooit een Foundation-benoeming.
4. **Een verlopen vereiste is een filter, geen ontslag.** De benoeming blijft; de
   handeling niet.
5. **De relatie geeft geen recht.** Vrijwilliger, werknemer of bestuurder zijn is
   geen bevoegdheid; alleen een actieve benoeming is dat.
6. **Er komt geen score op een bestuurder of vrijwilliger** — geen activiteitscijfer,
   geen "betrouwbaarheid". `KANTOORMACHT.md`, `HDI.md` en `CARRIERE.md` zeggen het
   alle drie.
7. **Een migratie verandert geen rechten zonder een mens.** Elke afwijking tussen
   v1 en v2 wordt gemeld, niet gerepareerd.
8. **Een gezinsrol is geen Foundation-benoeming.** De beheerder van een gezin
   (`server/foundation/gezinshulp.js`) blijft de enige die daar uitnodigt; deze
   laag raakt het niet aan, ook niet voor de eigenaar.
