# MIJN RTG — de persoonlijke vertrouwenslaag

*Jouw identiteit. Jouw data. Jouw rechten. Jouw apparaten. Jouw bewijs.*

Dit is een richtingsdocument zoals `PLATFORM.md`, `OS.md` en `FABRIC.md`: per
onderdeel staat er of het **staat**, **een stap weg** is, **een besluit vraagt**
of **jaren weg** is — zodat niemand die vier voor elkaar aanziet. Het beschrijft
geen accountpagina. Het beschrijft de laag die van instellingen een
*controlevlak* maakt.

De zin die het geheel draagt:

> **MIJN RTG bezit niets. Het stelt samen, simuleert, laat bevestigen en bewijst.**

Dat is geen bescheidenheid maar de enige vorm waarin deze laag kan bestaan zonder
het vierde rechtenmodel van dit huis te worden.

---

## 0. Wat dit vervangt, en wat niet

De huidige generatie accountcentra is in essentie: profiel → wachtwoord →
privacy → apparaten → betalingen → instellingen. Zes laden met formulieren, en de
gebruiker moet zelf weten in welke la zijn vraag zit. Wie wil dat zijn werkgever
zijn privételefoonnummer niet meer ziet, moet dat vertalen naar een pad door een
menu dat door een engineer is ingedeeld.

MIJN RTG draait dat om. De gebruiker beschrijft het **resultaat**; het systeem
stelt de configuratie samen, toont de gevolgen, en voert pas uit na bevestiging.

Wat dit **niet** vervangt: de boardroom blijft de waarheid over
capability-toestemming, het consentregister blijft de juridische bron, het
paspoort blijft de bewijsbron, de kluis blijft de documentbron, en de
machtigingen blijven de delegatiebron. MIJN RTG **componeert** ze. Elke
projectie in deze laag is leesbaar afgeleid van zijn bron en schrijft nooit een
tweede waarheid.

---

## 1. Twee correcties op de opzet, gemeten in de code

Dit document begint met twee dingen die anders liggen dan ze op papier leken. Ze
staan vooraan omdat ze allebei richting veranderen.

### 1.1 `kern/bevoegdheid/` is NIET de uitvoeringsrechtenlaag

De opzet noemde "bevoegdheid blijft waarheid voor uitvoeringsrechten". Dat is
niet wat daar staat. `server/kern/bevoegdheid/index.js` opent met de eigen
verklaring waarom hij bestaat:

> *Software kunnen bouwen en bevoegd zijn om geld te bewegen zijn twee dingen,
> en zolang ze in dezelfde schakelaar zitten kun je de eerste niet uitbouwen
> zonder de tweede te suggereren.*

Het is de laag die zegt **wat RTG ZELF mag** — `software`, `rail`, `vergunning`,
met de rangen betaalinstelling < elektronischgeldinstelling < bank. Het gaat over
vergunningen van het huis, niet over rechten van een mens.

Wie een lidgericht rechtenoverzicht op `bevoegdheid/` bouwt, bouwt op het
verkeerde fundament en krijgt een scherm dat vertelt of RTG een bankvergunning
heeft. **De vijf assen waarop een functie voor een gebruiker dicht kan staan in
`server/middleware/functieschakelaars.js`** (globaal, per pas, per land, per
plaats, per persoon, per genre); de capability-toestemming van het lid staat in
`kern/lidboard/`. Dat zijn de twee bronnen voor de permissieprojectie.

### 1.2 De rechtengraaf bestaat al — maar alleen voor personeel

Punt 3 van de opzet (de Trust Graph, "waarom mocht dit?") is niet nieuw voor dit
huis. `server/routes/command/toezicht.js` draagt `command.toegang.graaf()`:
*wie heeft nu welk zwaar recht, van wie gekregen, waarom en tot wanneer.* Met
rechten die vanzelf verlopen (`minuten`), een mandaat van-naar-terrein-tot, en
een breekglas-deur die een volledige reden eist en met risico 95 in het journaal
gaat.

De commentaarregel erboven is precies de redenering van de opzet, vier maanden
eerder opgeschreven voor de andere doelgroep:

> *Een agent-budget en een tijdelijk mensenrecht zijn dezelfde vraag in twee
> vormen: wie mag nu hoeveel, en tot wanneer?*

**Gevolg voor de bouw:** de trust graph van het lid is geen nieuwe uitvinding
maar de *tweede lezer* van een bestaand model. Dat is goedkoper én het is het
bewijs dat het model werkt. Het verschil dat wél gebouwd moet worden: de
personeelsgraaf kent zware rechten binnen RTG; de ledengraaf kent relaties naar
buiten (organisaties, apps, agenten, mensen).

---

## 2. Het fundament dat ontbreekt: de sessie weet te weinig

Vijf van de mooiste onderdelen uit de opzet — continu vertrouwen (4),
action-bound authentication (5), aanwezigheid per context (21), sender-constrained
sessies (22) en de meeste noodstand-acties (16) — hangen allemaal aan hetzelfde
en dat staat er niet.

Gemeten in `server/kern/sessies.js` en alle acht aanroepen van
`rememberSession()`: een sessie draagt vandaag `role`, `code`, `actor`,
`staffId`, `staffRole`, `manager`, `lidKey`, `lid` en `at`. Er staat **geen
toestel in, geen authenticator, geen locatie, geen context, geen risicostand**.
De sleutel is een sha-256 van het token; het venster schuift op bij gebruik.

Daaruit volgt de bouwvolgorde, en die is niet onderhandelbaar:

> **Zolang een sessie niet weet met welke sleutel op welk toestel hij ontstond,
> is elk scherm dat "waar ben ik aanwezig?" beantwoordt een verzonnen scherm.**

Dat is regel 11 van `LAT.md` toegepast op deze laag: er staat nooit een getal
waar er geen is. Een apparatenlijst die "iPhone 16 Pro, Amsterdam" toont terwijl
de sessie dat nooit heeft opgeslagen, is een `SCHERMLEUGEN.json`-regel in
wording.

**Eerste blok is dus de sessieverrijking**, en pas daarna de schermen. Let op de
16 KB-grens in `geldigeSessie()` en op het feit dat de sessiebak over een bus
naar andere processen reist: wat je erin zet, reist mee. Een toestelnaam die een
mens heeft ingetypt is een contactgegeven-achtig veld — zie de actor-regel van
`kern/envelop.js`, die precies daarom weigert wat op een contactgegeven lijkt.

---

## 3. De stand per onderdeel

Vierentwintig voorstellen uit de opzet, met de eerlijke stand. **Staat** betekent:
er is code die het doet. **Stap weg**: de bron is er, de lezer niet. **Besluit**:
er is een keuze te maken die geen engineer alleen hoort te maken. **Jaren**: de
standaard of de wereld is er nog niet klaar voor.

| # | Onderdeel | Stand | Waarom |
|---|---|---|---|
| 1 | Intent-based beheer ("deel locatie alleen tijdens een rit") | **besluit** | De doelbinding bestaat nog niet (zie 8). Zonder die laag kan de intentie niet gecompileerd worden. |
| 2 | Persoonlijke command bar | **stap weg** | `kern/stuur/beleid.js` heeft `toegestanePaden()` al: de bewijspoort die een geschorste capability uit de keuzelijst laat vallen. De intentparser wordt de tweede aanroeper daarvan, niet een tweede poort. |
| 3 | Trust graph | **stap weg** | `command.toegang.graaf()` bestaat, office-only. Zie 1.2. |
| 4 | Continu vertrouwen / step-up per actie | **besluit** na sessieverrijking | De risicoassen zijn een beleidskeuze, geen afleiding. |
| 5 | Action-bound authentication | **stap weg** | `kern/webauthn.js` heeft de ceremonieopslag al (`zetChallenge`/`pakChallenge` met `extra`). De actie in de challenge binden is een kleine, echte stap. |
| 6 | Permission firewall ("wie heeft nu toegang tot mij?") | **stap weg** | Projectie over lidboard + consentregister + machtigingen + tenant. Bouwbaar zonder nieuw model. |
| 7 | Tijdelijke rechten als standaard (wie+wat+waarom+hoelang) | **staat, verkeerde doelgroep** | `recht/geef` kent `minuten`, `mandaat` kent `tot`. Voor leden bestaat het niet. |
| 8 | Purpose-bound data | **besluit — het duurste gat** | De boardroom schakelt per *capability*, niet per *doel*. Zie par. 5. |
| 9 | Credential wallet (VC 2.0) | **jaren, vooruitcompatibel ontwerpen** | W3C VC 2.0 is Recommendation; de Digital Credentials API is Working Draft. Ontwerp de kluis zo dat een credential ernaast kan, maak hem geen afhankelijkheid. |
| 10 | Zero-copy identity (ask → prove → forget) | **stap weg voor nieuwe modules, jaren voor bestaande** | `kern/gegevenspoort.js` is het aanknopingspunt. De 100 bestaande domeinen bewaren al kopieën; dat is een migratie en geen schakelaar. |
| 11 | Gegevenskaart | **stap weg** | `/api/privacy/export` en `/api/privacy/inzage` hebben de gegevens al; er is geen scherm dat ze als kaart toont. |
| 12 | Data lineage voor personen | **jaren** | Vergelijk `kern/kosten/herkomst.js`: die keten eindigt eerlijk bij "zo is hij overgenomen door een mens". Een persoonsketen over 100 domeinen is groter dan dat. |
| 13 | Policy compiler | **besluit** | Volgt op 1 en 8. |
| 14 | Simulatie vóór uitvoering | **stap weg** | De vorm bestaat: de gevolgsimulatie in `TENANT.md` met `nietGerekend` voor wat níét is meegerekend. Hergebruik die taal. |
| 15 | Undo / time machine | **stap weg, met grens** | Vereist een wijzigingsjournaal met inverse operatie. De grens staat in par. 5. |
| 16 | Noodstand | **stap weg** na sessieverrijking | `server/beveiliging-noodrem.js` bestaat aan de platformkant; de ledenkant niet. |
| 17 | Security autopilot / rechtenschuld | **stap weg** | `BEWIJSSCHULD.json` is het model: een schuld met een naam, een reden en een sluitweg. Identity debt is dezelfde vorm. |
| 18 | Privacy budget (cumulatieve blootstelling) | **jaren** | Interessant en ongemeten. Niet beginnen vóór 8 en 11 staan. |
| 19 | AI-mandaat i.p.v. almacht | **staat, verkeerde doelgroep** | `command.toezicht.zetGrenzen()` doet dit voor RTG-agenten. `FABRIC.md` par. 5 heeft de grenzen al. |
| 20 | Contextwisseling zonder opnieuw inloggen | **staat** | `kern/eenaccount.js` + `/api/account/rollen|start`, `/api/sso/wissel`. Sinds 31 augustus 2026 ook ZICHTBAAR: elke context legt zich vast bij het wisselen en verschijnt als eigen regel in "waar ben ik aanwezig". |
| 21 | Aanwezigheid per context i.p.v. sessies | **na sessieverrijking** | Zie par. 2. |
| 22 | Sender-constrained sessies (DPoP) | **staat, in de schaduw** | `kern/identiteit/bezitsbewijs.js`, 31 augustus 2026. Niet DPoP zelf (geen access token met cnf-claim, geen OAuth) maar het idee ervan, op de toestelsleutel uit blok 3. Vijftien paden met per stuk een reden. Drie standen; hij begint in `schaduw` en de meter (`/api/command/bezitsbewijs`) levert het getal waar het besluit om te gaan handhaven op rust. |
| 23 | Evidence-native UI | **staat als taal, niet als UI** | `BESTUUR.md`: onbekend → vermoed → gemeten → bewezen, met datum, en *vervallen bewijs is geen bewijs*. Niet opnieuw uitvinden. |
| 24 | Trust receipts | **stap weg** | De ketenhash (`server/lib/keten*.js`) en het handelingsspoor dragen het bewijs al; er is geen bon die het aan de mens toont. |

---

## 4. Wat "Mijn Stand" mag zijn, en wat niet

De opzet stelt terecht voor om "Account Health 87%" te vervangen door *Mijn
Stand*. Dat is niet alleen een betere naam — het percentage is in dit huis
**verboden**, en om een reden die hier eerder is opgeschreven.

`LAT.md` regel 11 en regel 48 van `scripts/check.js` verbieden het samengestelde
groene cijfer: bewijsgroen is geen go-live-groen. `scripts/zekerheid.js` bestaat
juist omdat losse eerlijke getallen samen een gevaarlijk gevoel geven. En
`BEWIJSMACHINE.md` zegt het over precies deze vorm: één samengesteld cijfer
verbergt welke van de meters bewoog.

"Profiel 82% compleet" verbergt wát er mist, en 82% voelt goed terwijl het
ontbrekende de herstelroute kan zijn. De eerlijke vorm noemt het ding:

```
identiteit          bewezen        paspoort gezien 12 mrt 2026
huidig toestel      bewezen        passkey, deze sessie
adres               opgegeven      door jou, niet onafhankelijk getoetst
werkrelatie         gemeten        geldig tot 30 november
verificatie e-mail  onbekend       nooit gecontroleerd
```

`onbekend` is een eersteklas uitslag naast in orde en storing — geen nul, geen
grijs bolletje. Dat is dezelfde regel als `KOSTEN.md`: er staat nooit een getal
waar er geen is.

---

## 5. De grenzen

Zeven, en ze mogen geen van alle sneuvelen. Waar een functie uit par. 3 met een
grens botst, vervalt de functie.

**G1 — MIJN RTG is geen rechtenbron.** Elke permissie, delegatie en toestemming
in deze laag is een *projectie* met een aanwijsbare bron. Wie hier een recht
opslaat dat nergens anders bestaat, heeft het vierde rechtenmodel gebouwd. De
toets: haal de laag weg, en er mag geen recht verdwijnen.

**G2 — de AI stelt samen; de rechtenlaag beslist.** De keten is
intent → voorstel → bevoegdheid → conflictcontrole → impact → bevestiging →
uitvoering → bewijs. De parser kiest uit `toegestanePaden()` en breidt die lijst
nooit uit. Dit is `FABRIC.md` par. 5 en `LIFE.md` par. 4 letterlijk: **klaarzetten
mag, bevestigen doet de mens.**

**G3 — wat een tweede persoon of een derde partij bereikt, gaat nooit
automatisch.** Een intrekking mag onmiddellijk (dat beperkt), een verlening nooit
(die opent). Asymmetrie is hier het ontwerp: dichtdraaien is één handeling,
opendraaien vraagt bevestiging.

**G4 — een simulatie zegt wat zij niet heeft gerekend.** De gevolgpreview draagt
verplicht zijn eigen `nietGerekend`, zoals de tenantsimulatie. Een preview die
"0 conflicten" toont zonder te zeggen waar hij níét gekeken heeft, is gevaarlijker
dan geen preview: hij koopt vertrouwen dat hij niet heeft verdiend.

**G5 — sommige dingen zijn met opzet onomkeerbaar.** De time machine (15) raakt
nooit sleutelintrekking, credentialherroeping, of een uitgevoerde
gegevensverwijdering. Een "undo" op een intrekking is een heropening, en die loopt
via G3. De lijst onomkeerbare handelingen staat in de code met de reden per
regel, niet als vlag.

**G6 — deze laag toont bewijs, en meet het niet.** `BESTUUR.md`: de laag die iets
toont, meet het niet — anders zeggen twee schermen op een dag iets anders over
hetzelfde. MIJN RTG leest bewijsgraden; het kent er geen toe.

**G7 — de trust graph draagt codenamen.** Een graaf die persoon, toestel,
organisatie en handeling verbindt is precies de structuur die
`scripts/afleidbaar.js` meet als afleidingsrisico. De koppeling naar een echte
naam hoort in de identiteitskluis, met een inzageregel. Draai
`npm run afleidbaar` na elke uitbreiding van de graaf.

---

## 5a. Een open bevinding: het telefoonnummer is een herstelkanaal

Bij het uitbreiden van de zware paden (blok 4) kwam iets aan het licht dat geen
onderdeel van dat blok is en dus blijft staan tot iemand het repareert.

`/api/auth/reset` stuurt een sms naar `phoneOf(u)`. Dat nummer is dus een
herstelkanaal. Maar het KAN worden vervangen door een ingelogde sessie **zonder
dat er opnieuw om een wachtwoord wordt gevraagd** -- via `/api/gegevens/zeg`
(`routes/member/gegevens.js`) of `/api/onboarding/inricht`. Het wachtwoord
wijzigen eist wél het huidige wachtwoord (`routes/auth/herstel.js`), en dat is
de scheve kant op: het nummer omzetten is de eerste stap van een overname en het
wachtwoord de tweede.

`herstel.js` redeneert in zijn eigen commentaar dat een aanvaller "eerst het
telefoonnummer zou moeten weghalen, en daarvoor moet hij al binnen zijn".
`setPhone` kan een nummer inderdaad niet leegmaken -- maar wel VERVANGEN, en dat
komt op hetzelfde neer.

Beide routes staan sinds blok 4 op de zware lijst, maar **dat dicht het niet**:
een bezitsbewijs vraagt om het toestel, niet om de mens. De echte reparatie is
her-authenticatie op die twee routes. Dat is een besluit over UX-wrijving en
hoort daarom bij de eigenaar, niet bij wie dit toevallig vond.

## 6. De volgorde

Niet naar aantrekkelijkheid maar naar afhankelijkheid. Elk blok is los
opleverbaar en los terug te draaien.

1. **Sessieverrijking** — toestel, authenticator, context en ontstaansmoment in
   de sessie. Zonder dit is blok 2, 5 en 7 verzonnen. *(par. 2)*
2. **Sessies & toestellen voor het lid** — lijst, uitloggen per sessie,
   contextbinding intrekken. Het enige gat dat vandaag schade kan doen.
   *(Staat, 31 augustus 2026: `routes/member/sessies.js`, scherm
   `/apps/mijn-sessies.html`. De intrekking loopt op de SID en niet op het
   token -- het token van dat andere toestel heb je niet, en dat is nou juist
   het toestel dat je kwijt bent. Contextbinding intrekken wacht op blok 7.)*
3. **2FA en herstel voor leden** — `kern/totp.js` bestaat, maar alleen met
   `OFFICE_TOTP_SECRET`. Eén herstelcode is geen herstelcodeset.
   *(Toestelbinding staat sinds 31 augustus 2026:
   `kern/identiteit/toestellen.js` plus `public/shared/toestelsleutel.js`. Een
   ECDSA-sleutel die de browser maakt met `extractable: false` tekent een
   uitdaging; alleen dat verdient `bewezen`. De sleutel is nadrukkelijk GEEN
   inlogmiddel -- hij bindt een sessie die er al is, en `test/toestelbinding.test.js`
   toets 6 zakt zodra die module een account aanraakt.)*
4. **De permission firewall** — projectie over vier bestaande bronnen. Het eerste
   blok dat er als MIJN RTG uitziet.
5. **Trust receipts** — de bon onder wat blok 2 en 4 uitvoeren. Bewijs dat al
   bestaat, eindelijk zichtbaar.
6. **Mijn Stand** — pas als er iets te tonen valt dat gemeten is. *(par. 4)*
7. **Doelbinding** — het duurste gat, en het besluit dat de intentlaag ontgrendelt.
8. **De command bar** — laatst, niet eerst. Een intentparser boven een halve
   permissielaag compileert halve intenties.

De verleiding is bij 8 te beginnen, want dat is het onderdeel dat het meest naar
2030 ruikt. Maar een command bar die "trek alles van bedrijf X in" aanneemt
terwijl de doelbinding er niet is, belooft een intrekking die hij niet kan
waarmaken — en dat is erger dan een menu.

---

## 7. De gouden regel

Voor elke functie in deze laag geldt één vraag: **waarom moet de gebruiker dit
zelf beheren?**

- Kan het systeem het veilig afleiden → automatisch doen.
- Kan het veilig voorstellen → voorstellen, niet aandringen (`GRAMMATICA.md`).
- Vereist het toestemming → één duidelijke keuze, met de gevolgen erbij.
- Is het risico groot → eerst simuleren, met `nietGerekend`.
- Is de handeling gevoelig → cryptografisch aan díé handeling binden.
- Is het uitgevoerd → bewijzen, met een bon.
- Kan het tijdelijk → dan is het tijdelijk, en verloopt het vanzelf.
- Is de data niet nodig → niet opslaan.
- Is een bewijs genoeg → de brondata niet delen.

En de lat voor de vorm: **80% van de gewone accounttaken binnen twee
handelingen.** Een nieuw telefoonnummer is één verificatie en één bevestiging van
de migratie — niet zes schermen waarin de gebruiker zelf de afhankelijkheden moet
onthouden die het systeem allang kent.
