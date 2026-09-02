# KANTOORMACHT.md — RTG Office Control Plane

*Richtingsdocument, 2 september 2026. Niet: een adminpagina bouwen. Wel: de
laag waarin een medewerker van RTG precies zoveel kan als hij mag, en waarin
elke handeling achteraf naar een mens is terug te voeren.*

**Lees dit document met `CONTROLPLANE.md` ernaast, en verwar ze niet.** Dat gaat
over de economische keten (mag deze HANDELING, met welke waarde, onder welke
overeenkomst). Dit gaat over de MENS aan de knop: wie in dit kantoor wat mag,
waar zijn macht ophoudt, en hoe het huis dat kan bewijzen. Ze delen de
bevoegdheidsmotor; ze delen hun naam niet — een tweede "control plane" zonder
eigen woord is exact de `VERMOGENS`-fout uit `BEWIJSMACHINE.md`.

## 0. De zin die het draagt

> Alles zichtbaar waar noodzakelijk; alles bestuurbaar waar bevoegd; niets
> onbewijsbaar.

Die zin is goed en hij blijft staan. Er hoort een tweede naast, want de meting
hieronder laat zien welke helft vandaag ontbreekt:

> **En niets zonder een mens erachter.** Een spoor dat eindigt bij een gedeelde
> code is geen spoor, het is een alibi.

## 1. De omkering: de super-admin is er al

Het voorstel zegt: *bouw vooral geen almachtige SUPER_ADMIN.* Dat is het juiste
uitgangspunt en het is een verkeerde tijd. RTG heeft er al een, en hij heet
`officeAuth`.

Wat er staat, gemeten op 2 september 2026:

| | |
|---|---|
| Eén gedeelde toegangscode | `OFFICE_CODE`, één rol: `role: 'office'` |
| Bestanden die die deur gebruiken | **106** |
| Muterende routes achter `/api/office` en `/api/boardroom` | **548** |
| Kamers (afdelingen) achter diezelfde ene deur | **26** |
| Sterkere poorten erachter | **2** — `kluispoort` (identiteitskluis) en `boardroomAuth` (100 routes) |

Zesentwintig afdelingen, één sleutel. Sales, HR, Financiën, Juridisch,
Klantenservice, Integraties, het Controleregister, de Regeringskamer en de
Opvangkamer komen alle negen door dezelfde deur binnen, met dezelfde macht.

**De blokken uit het voorstel — People, Companies, Money, Risk, Support, Trust,
Security — zijn dus niet de eerste opdracht.** Wie ze vandaag bouwt, bouwt
zevenentwintig nieuwe kamers achter dezelfde ene sleutel. Het verschil tussen een
adminomgeving en een control plane zit inderdaad in wat er gebeurt als iemand op
een knop drukt; vandaag gebeurt er dit: er gebeurt iets, en niemand weet wie.

## 2. Wat er onder de knop gebeurt — gemeten

Het voorstel eist voor gevoelige wijzigingen deze keten:

```
medewerker → reden → bevoegdheid → impact → bevestiging → tweede paar ogen
           → uitvoering → onveranderbaar auditbewijs
```

Over de **548** muterende kantoorroutes, lexicaal gemeten
(`scripts/kantoormacht.js` bestaat nog niet — zie blok 0):

| Schakel | Routes | Bewijsgraad |
|---|---|---|
| medewerker (een IDENTITEIT, geen gedeelde code) | onbekend — de sessie draagt `lidKey` optioneel | ongemeten |
| reden verplicht | **37** van 548 | vermoed |
| bevoegdheid fijner dan "kantoor" | **2** poorten (kluis, boardroom) | gemeten |
| impactberekening vooraf | 0 op kantoorroutes | vermoed |
| bevestiging met gewicht | 0 | vermoed |
| tweede paar ogen | **0** | vermoed |
| auditspoor | **99** van 548 | vermoed |
| reden **én** spoor samen | **10** van 548 | vermoed |

Tien van de 548. Dat is het echte cijfer, en het is met opzet niet
gepresenteerd als een percentage met een groen randje: het is **lexicaal**
gemeten (grep op de handlertekst) en draagt daarom de graad `vermoed`, niet
`gemeten`. Wie hem als hard getal doorvertelt, doet precies wat `BESTUUR.md`
verbiedt.

**Wat er wél al staat, en niet opnieuw gebouwd moet worden.** Dit is geen kaal
veld; het is een gereedschapskist waarvan de laden niet aan de deur hangen:

| Wat het voorstel vraagt | Waar het al woont | Stand |
|---|---|---|
| onveranderbaar auditbewijs | `lib/keten.js` + `lib/keten-anker.js` (hashketen mét extern anker tegen kopafknipping) | **staat** |
| wie keek in de kluis, en waarom | `server/inzagelog.js` — een lege "waarom" is daar al een fout | **staat** |
| tweede goedkeurder op de mens | `kern/appstore/vierogen.js` — sleutel én naam, met de GRAAD van de scheiding | **staat**, maar alleen voor appkeuring |
| bevoegdheid in vier dimensies, delegatie versmalt | `kern/commercie/bevoegdheid.js` | **staat**, geen enkele route delegeert |
| acht besluituitkomsten, `ONBEKEND` ≠ `WEIGEREN` | `kern/commercie/besluit.js` | **staat** |
| een nieuwe regel eerst in de schaduw | `kern/commercie/schaduw.js` | **staat** |
| isolatiemodus / noodstand | `kern/incidentcontrole.js` + `kern/beschermstand.js` (vijf standen, en het is geen ladder) | **staat** |
| incidentcockpit, canary, terugrol | `kern/command/` — 107 routes | **staat**, achter `officeAuth` |
| één zoekbalk over alle domeinen | `kern/command/zoek.js` + `register.js` | **staat**, ops-gericht |
| gevolgen van een handeling vooraf | `kern/stuur/gevolg.js` — 3 graden, 96 van 176 `onbekend` | **half** |
| gezagstreden | `scripts/gezagsnoemer.js` — vier treden, 18 evident | **staat** |
| risico, fraude, clusters, velocity | — | **niets** |

Er is dus geen risicolaag. Nul modules. Dat is de enige regel in het voorstel die
werkelijk vanaf nul begint.

## 3. View / Act / Break glass — bijna goed

Drie niveaus is de juiste gedachte en het verkeerde aantal. Dit huis heeft al
een gezagsschaal, hij is er met opzet gekomen nadat er **vijf** langs elkaar
bleken te leven, en hij heeft **vier** treden (`GEZAGSNOEMER.json`):

```
geen  →  tonen  →  klaarzetten  →  uitvoeren
```

`View` is `tonen`. `Act` is `klaarzetten` én `uitvoeren` — en dat verschil is
niet cosmetisch: het hele huis staat vol handelingen die een mens KLAARZET en een
tweede mens BEVESTIGT (`LIFE.md`, `FOUNDATION.md`, `GELD.md`). Een kantoorschaal
die die twee samenvouwt tot "Act", vouwt de belangrijkste grens van dit platform
dicht.

En `Break glass` is **geen trede**. Hij is een eigenschap van een uitvoering,
zoals `autonoom` en `begrensd` dat in `EXECUTIE.md` werden — precies dezelfde
afweging, en om dezelfde reden: wie er een trede van maakt, krijgt op een dag
iemand die "break glass" kiest omdat het hoger klinkt. Het is `uitvoeren` met
vier extra eisen:

```
uitvoeren + herauthenticatie + verplichte reden met zaaknummer
          + directe melding aan een tweede mens + review binnen 24 uur
```

**Er komt dus geen vijfde gezagsvocabulaire bij.**
`test/gezagsnoemer.test.js` bestaat om dat tegen te houden en hoort dit ook
tegen te houden.

## 4. De blokken, met hun echte stand

Per blok uit het voorstel: waar het staat, en wat het werkelijk kost. Vier
standen, zoals `PLATFORM.md` en `DEVELOPERCLOUD.md` ze gebruiken.

| Blok | Stand | Wat er ontbreekt |
|---|---|---|
| **Overview** (command center) | *een stap weg* | de cijfers staan in `afdelingen/boardroom` en `command/puls`; er is geen bord dat ze naast elkaar zet |
| **People** (universeel klantbeeld) | *een stap weg* | `command/zoek.js` zoekt over domeinen maar levert RIJEN, geen PERSOON; het entiteitsbeeld ontbreekt |
| **Companies** | *een stap weg* | idem; `kern/concern/` heeft de zes begrippen al (`CONCERN.md`) |
| **Live activiteit** | *staat deels* | `officeState()` toont live leden; sessies, devices en loginlocaties per persoon niet |
| **Functiecontrole** | **staat** | `afdelingen/boardroom` schakelt per functie, doelgroep, genre en fase — dit is af |
| **Money Console** | *staat deels* | grootboek, betalingen, terugstorting staan; een KANTOORcorrectie als nieuwe mutatie is niet gebouwd |
| **Support Console** | *een stap weg* | `conciergeInbox` bestaat; het dossiernaast-beeld niet |
| **Security Console** | *vraagt een besluit* | sessies intrekken bestaat per lid, niet als kantoorhandeling; devices blokkeren bestaat niet |
| **Compliance & Trust** | **staat grotendeels** | `consent-register`, `inzagekaart`, `bewaarverzoek`, AVG-export — dit is de best gevulde kolom |
| **Operations** | **staat** | `kern/command/` is de ops-cockpit, inclusief runbooks, canary, SLO |
| **Incident Command** | **staat** | `incidentcontrole` + `command/incident-impact.js` |
| **Audit** | *staat, onvindbaar* | de sporen bestaan met hashketen en anker; er is geen scherm dat ze samen leest |
| **Risk** | *jaren weg* | nul modules; zie §6 |
| **Intelligence** (AI-operator) | *jaren weg* | `kern/stuur/beleid.js` kent **0** `/api/office`-paden, en `VERTROUWEN.json` staat op **0 bewezen** |

Die laatste twee getallen zijn de belangrijkste van dit document, en ze staan
met opzet naast elkaar. Het voorstel eindigt met "de resolver geeft de AI alleen
de benodigde interne capabilities" — dat is een prachtige gedachte en de
bewijspoort waar hij op leunt houdt vandaag **niets** tegen. Een AI-operator op
het kantoor is daarom niet blok 1 maar blok 9, en niet uit voorzichtigheid maar
uit rekenkunde.

## 5. De volgorde

Elk blok levert iets dat op zichzelf werkt. Geen blok begint voordat het vorige
meetbaar is — dat is de regel uit `KEURING.md`: *je kunt niet versmallen wat je
niet hebt gemeten.*

### Blok 0 — de meter (eerst, altijd)

`scripts/kantoormacht.js` → `KANTOORMACHT.json`. Per muterende kantoorroute:
draagt hij een identiteit, een reden, een bevoegdheid fijner dan `office`, een
gevolgmeting, een tweede paar ogen, een spoor? Niet lexicaal zoals §2, maar
zoals `IDEMPROEF.json` het doet: door de route te DRAAIEN.

Wat hij níét mag worden: een samengesteld cijfer. Zes assen, zes getallen, en
`ongemeten` is een eigen uitslag naast ja en nee — nooit een nul.

Handhaving: `npm run getallen` neemt hem op, zodat de getallen in dit document
verouderen met een gezakte toets in plaats van in stilte.

### Blok 1 — de mens achter de deur

De ene gedeelde code blijft bestaan (hij is de terugval als een medewerker
buitengesloten raakt), maar hij verliest zijn macht. Concreet:

- `officeAuth` levert al `req.officeKey` — vandaag `null` bij een gedeelde
  sessie. Die `null` wordt een **weigering** op elke muterende route, niet op
  het lezen. Wie leest mag anoniem zijn; wie schrijft is een mens.
- De koppeling bestaat al: `kern/eenaccount/starten.js` geeft een kantoorrol via
  het eigen RTG-account. Dit blok maakt daarvan de normale weg in plaats van de
  uitzondering.
- **In de schaduw eerst** (`kern/commercie/schaduw.js`): eerst meeloggen hoeveel
  handelingen vandaag anoniem gebeuren, dan pas weigeren. Zesenveertighonderd
  routes tegelijk dichtzetten is geen migratie maar een storing.

Dit blok alleen al haalt het voorbeeld uit het voorstel binnen: *"Medewerker X
wijzigde om 14:37..."* is zonder blok 1 onmogelijk en met blok 1 bijna gratis,
want het spoor bestaat al — het draagt alleen geen naam.

### Blok 2 — reden en spoor als poort

Eén gedeelde poort, geen 548 losse aanpassingen. Model:
`kern/appstore/machtigingen.js` — het enige bestand in dit huis met een doel én
een grens.

- Een route verklaart zijn **gewicht** (`GRAMMATICA.md`: `licht` … `plechtig`).
  Alles vanaf `zwaar` eist een reden; een lege reden is een fout, geen detail
  (de regel staat al zo in `inzagelog.js`).
- Het spoor schrijft de poort, niet de route. Er komt géén achtste
  auditcollectie bij: `auditsporen.js` kent er zeven en die lijst is gemeten.
- Voor en na worden vastgelegd. Niet de hele rij — de **gewijzigde velden**, en
  nooit een veld uit de identiteitskluis (anders is het auditlog zelf een
  datalek; die les staat al in `inzagelog.js`).

### Blok 3 — bevoegdheid per kamer

De 26 kamers zijn de natuurlijke naad, en ze bestaan al als register. Elke kamer
krijgt een bevoegdheidsprofiel in de VIER dimensies die
`kern/commercie/bevoegdheid.js` al kent:

```
WAT      office.payout.hold
WAAR     kamer:financien
HOEVEEL  maxCenten 250000
WANNEER  binnenDiensturen, apparaatVertrouwd, tweedeGoedkeurderVerplicht
```

Er komt **geen tweede rechtenmodel**. Dat is dezelfde regel als in `CONCERN.md`
("toegang verlenen gebeurt waar de rol woont") en `LINK.md` ("geen tweede rem").
Delegatie versmalt structureel — een kamerhoofd kan zijn medewerker niets geven
dat hij zelf niet heeft.

Hier landen de scheidingen uit het voorstel, en ze zijn goed gekozen:
Klantenservice krijgt geen grootboekmutatie, Financiën leest geen privéchat,
Risk analyseert netwerken zonder de kluis te openen.

### Blok 4 — impact vóór bevestiging

`kern/stuur/gevolg.js` meet al welke collecties een handeling aanraakt, met drie
graden. Die graden gaan mee naar het scherm, en de middelste is de belangrijkste:

- `gemeten` — dit raakt deze 4 collecties en 1.281 leden
- `geen-effect-gemeten` — er is gekeken, er gebeurt niets
- `onbekend` — **er is niet gekeken**

Die derde mag nooit als "raakt niets aan" op een bevestigingsscherm verschijnen.
Vandaag staat hij op 96 van 176 paden; het scherm zegt dat dan hardop.

### Blok 5 — het tweede paar ogen

`kern/appstore/vierogen.js` wordt van een appstore-module een kantoorvoorziening.
Hij is er al klaar voor: hij vergelijkt een sleutel (hard) én een naam (zwak) en
draagt de **graad** van de scheiding mee. Verplicht op: geldbewegingen boven een
grens, elke wijziging aan een pasbesluit, elke kluisinzage buiten een lopende
zaak, en elke break-glass.

Let op de bestaande afweging in dat bestand: hij gooit de deur níét dicht als
beide kanten naamloos zijn. Op het kantoor moet dat wél — daar is een naamloze
sessie na blok 1 geen normaal geval meer maar een gebrek.

### Blok 6 — break glass

Als eigenschap, niet als trede (§3). Vier eisen, en de vierde is degene die
mensen vergeten: **de review binnen 24 uur is een taak met een eigenaar**, niet
een regel in een log. `afdelingen`-taken bestaan al.

### Blok 7 — People en Companies

Pas hier, en dat is niet toevallig het zevende blok: een universeel klantbeeld is
het gevaarlijkste scherm van het hele platform. Het zet identiteit, rollen,
bedrijven, transacties, apparaten, klachten en historie op één pagina — precies
wat `scripts/afleidbaar.js` meet als risico.

Daarom drie eisen die vóór het scherm gaan:
1. Het beeld bouwt op de **codenaam**. Een naam verschijnt alleen na een
   kluisinzage, en die inzage is een aparte handeling met een reden en een regel
   in het journaal. Het beeld openen is niet hetzelfde als de kluis openen.
2. Het beeld toont wat DEZE medewerker mag zien, en zegt erbij dat er meer is —
   een blok dat stil verdwijnt, laat de lezer denken dat het niet bestaat.
   (Zelfde regel als de intentielijst in `LINK.md` par. 3.)
3. `scripts/afleidbaar.js` draait erop vóór livegang. Zes velden staan vandaag
   rechtstreeks naast een codenaam; dit scherm mag er geen zevende bij zetten.

### Blok 8 — Risk

Vanaf nul, en daarom in twee stukken die niet door elkaar mogen lopen:

**8a, een stap weg — velocity en tellers.** `kern/kosten/meterstand.js` en de
grootboektellers meten al. Ongebruikelijke snelheid, een payoutvolume dat 300%
stijgt, een terugboekingspiek: dat is rekenwerk op bestaande tellers.

**8b, jaren weg — clusters en netwerken.** Gedeelde apparaten, IP's,
betaalmiddelen, synthetische accounts. Dat vraagt een graaf die vandaag niet
bestaat, en hij botst frontaal met het codenaam-ontwerp: een clustergraaf IS een
apparaat om codenamen aan elkaar te knopen.

**De grens die daaruit volgt, en die niet mag sneuvelen:** een risicosignaal
staat op **gedrag** en op een **zaak**. Een score op een mens draagt altijd zijn
opbouw (een cijfer zonder opbouw is een orakel), verschijnt nooit als los getal,
en wordt nooit een sorteersleutel — ook niet intern. Die regel staat al drie keer
in dit huis (`ONTMOETEN.md`, `LIFE.md`, `HORECA.md`) en hij geldt hier ook.

### Blok 9 — de AI-operator

Laatste, om de reden in §4. Wat er eerst moet gebeuren is meetbaar en eindig:
`kern/stuur/beleid.js` moet kantoorpaden krijgen, en `VERTROUWEN.json` moet van
0 bewezen af. De resolver (`kern/stuur/resolver.js`) en de plancompiler
(`kern/stuur/plan.js`) staan er al en zijn hier zonder wijziging bruikbaar.

De vragen uit het voorstel zijn precies de goede vragen — *"waarom is bedrijf 842
geblokkeerd?"*, *"welke medewerker corrigeerde gisteren handmatig saldo?"* — en
het zijn alle vijf **leesvragen**. Dat is de opening: een AI die het kantoor
alleen kan bevrágen is blok 9a en kan veel eerder, want `tonen` is de laagste
gezagstrede. Uitvoeren is 9b en wacht op het bewijs.

## 6. De grenzen

Negen, en ze zijn er alle negen omdat het zonder hen fout gaat.

1. **Geen tweede rechtenmodel.** Bevoegdheid komt uit
   `kern/commercie/bevoegdheid.js`, delegatie versmalt structureel.
2. **Geen vijfde gezagsschaal.** Break glass is een eigenschap van `uitvoeren`,
   geen trede.
3. **Een gedeelde code is geen mens.** Lezen mag anoniem; schrijven niet.
4. **Een lege reden is een fout, geen detail.**
5. **Het auditlog draagt nooit een naam uit de kluis.** Wie de naam wil, neemt
   inzage — en dat komt opnieuw in het journaal.
6. **Een correctie is een nieuwe mutatie.** Nooit een overschrijving. Dit staat
   al zo in de waardelaag en wordt hier niet zachter.
7. **Risk ziet geen namen.** Netwerken op codenaam; de kluis blijft dicht.
8. **De AI kan nooit meer dan de medewerker die hem iets vraagt**, en break
   glass is nooit voor de AI. (`FABRIC.md` par. 5.)
9. **Geen scherm toont een macht die het systeem niet kan afdwingen.**
   `commercie/claims.js` is daar de poort voor en geldt hier onverkort.

## 7. Wat er bewust NIET komt

- **Geen `/admin`.** De kamers bestaan; er komt geen achtentwintigste ingang
  naast.
- **Geen tweede zoekbalk.** `command/zoek.js` wordt uitgebreid met entiteiten,
  niet gedupliceerd.
- **Geen achtste auditcollectie.** `auditsporen.js` kent er zeven, gemeten.
- **Geen `SUPER_ADMIN`-rol.** De eigenaar heeft de boardroom; dat is een kamer
  met een deur, geen vlag die alles overslaat.
- **Geen samengesteld "control health"-cijfer.** Zes assen, zes getallen —
  `scripts/zekerheid.js` bestaat juist omdat losse eerlijke getallen samen een
  gevaarlijk gevoel geven.
- **Geen noodknop die alles platlegt.** `beschermstand` is de derde knop en die
  is er al (`BESTUUR.md` grens 6.10).

## 8. De besluiten die openstaan

Vier, en ze zijn alle vier van de eigenaar.

**8.1 — Hoe hard gaat blok 1 dicht?**

| | Wat het betekent | Wat het kost |
|---|---|---|
| **A (aanbevolen)** | Schaduw eerst meten, dan schrijven weigeren zonder identiteit | 2 stappen, geen storing, ~2 weken vertraging |
| B | Meteen weigeren op schrijfroutes | Werk kan stilvallen op een route die niemand had gemeten |
| C | Alleen loggen, nooit weigeren | Het spoor krijgt een naam, de macht blijft ongedeeld |

**8.2 — Wat is de eenheid van bevoegdheid?** De 26 kamers (aanbevolen: ze
bestaan al als register), of een nieuwe rollenlijst (dan is er een 22e
capabilitylijst, en `CAPABILITEIT.json` telt er al 21).

**8.3 — Mag Risk een clustergraaf?** Dit is geen technische maar een
ontwerpvraag: 8b knoopt codenamen aan elkaar. Zonder besluit hier bouwen we 8a
en stopt het daar.

**8.4 — Wanneer mag de AI het kantoor lezen?** 9a (alleen bevragen) kan
vooruit op blok 1 en 2; 9b wacht op bewijs. Of we die twee loskoppelen is een
besluit, geen gevolg.

## 9. Wat dit document niet zegt

Het zegt niets over hoeveel medewerkers RTG heeft, en dat is precies de
onzekerheid die de hele volgorde bepaalt. Blok 1 tot en met 3 zijn bij drie
mensen overdreven en bij dertig te laat. Er staat vandaag één gedeelde code in
de omgeving en dat is het enige harde gegeven; alles daarboven is aanname.

De getallen in §1 en §2 zijn van 2 september 2026 en dragen hun graad
(`vermoed` waar lexicaal, `gemeten` waar geteld). Blok 0 vervangt ze door
gemeten getallen. Tot dat blok er is, hoort niemand ze door te vertellen zonder
de graad erbij.
