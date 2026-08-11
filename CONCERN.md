# RTG Concern — Company Launch & Workforce OS

Dit bestand legt vast wat er van de bedrijvenkant van RTG gebouwd wordt.
`PLATFORM.md` zegt waar het platform als geheel heen gaat, `LAT.md` hoe er
geschreven wordt, `CLAUDE.md` wat het merk is. Dit zegt wat een **bedrijf** hier
is, en wat er moet gebeuren voordat een mens erin kan werken.

Het vervangt geen bestaand document. Het vult het gat dat `PLATFORM.md` in de
tabel bij laag 1 zelf benoemt: *"een expliciete organisatie-entiteit; een zaak
is nu een rij in `suppliers`"*. Dat gat is het onderwerp van dit hele bestand.

---

## De belofte

> Van bedrijfsnaam of ondernemingsidee naar een volledig ingericht concern —
> juridische structuur, vestigingen, rollen, personeel, rechten, workflows,
> software en livegang — terwijl RTG alleen vraagt wat het niet veilig zelf kan
> weten.

Twee kanten, en ze horen bij elkaar:

- **Company Launch** — een bedrijf juridisch, operationeel en technisch
  opbouwen.
- **Workforce** — mensen er daarna moeiteloos in laten werken.

Wat hieronder staat is daarvan afgeleid. Wat er niet uit volgt, hoort hier niet.

---

## De vijf ontwerpwetten

Deze vijf gaan vóór elke functie in dit document. Waar een functie ermee botst,
vervalt de functie.

1. **Vraag nooit wat RTG veilig kan afleiden.**
2. **Vraag nooit twee keer wat RTG al weet.**
3. **Toon zakelijke keuzes, geen technische implementatie.**
4. **Juridische waarheid heeft altijd een bron en een geschiedenis.**
5. **Complexiteit hoort onder water; de bevestiging hoort bij de mens.**

Wet 1 en 2 zijn comfort. Wet 3 is de vormtaal. **Wet 4 en 5 zijn de grens**, en
die twee zijn niet onderhandelbaar — zie *De grenzen* hieronder.

---

## De grenzen

Dit staat vooraan en niet achteraan, omdat het de rest begrenst.

### AI is hier geen juridische autoriteit

De AI mag juridische gegevens **extraheren, vergelijken, structureren,
signaleren en uitleggen**. Zij mag nooit juridische geldigheid **verzinnen**.

Officiële gegevens komen uit precies vier bronnen, en elk gegeven draagt de zijne
mee:

| Bron | Wat het is |
|---|---|
| `mens` | de ondernemer heeft het ingevuld |
| `document` | uit een geüpload stuk gehaald, en door een mens bevestigd |
| `register` | uit een geverifieerde registratie |
| `afgeleid` | uit andere gegevens gerekend, met de regel erbij (zoals de UBO) |

Een gegeven zonder bron bestaat niet. Dit is dezelfde doctrine die
`kern/aanmeldingen.js` al draagt voor de passen ("er is geen automatische
toekenning") en `kern/onderneming/aanvraag.js` voor de zaak. Zij wordt hier
uitgebreid naar de juridische laag, niet opnieuw uitgevonden.

RTG zegt daarom **"dossier technisch compleet: 94%"** en nooit *"juridisch
waterdicht"*. Het eerste is een telling en die kunnen we waarmaken; het tweede is
een oordeel dat geen enkel systeem universeel kan geven.

### Geen score zonder afwijking

Een percentage dat nergens naar wijst is decoratie. Elke deelscore staat naast
de concrete punten die hem drukken: *"BTW-nummer ontbreekt"*, *"twee managers
hebben de uitnodiging niet geaccepteerd"*, *"één vergunning verloopt over 18
dagen"*. Dit is dezelfde regel die `kern/onderneming/meter.js` al draagt: waar
niets te meten valt staat er geen cijfer.

### Een werknemer koopt nooit een pas om te mogen werken

De werkgever betaalt voor de bedrijfsomgeving. De werknemer krijgt toegang omdat
hij daar een geldige rol heeft — met de gratis RTG Pass of een gratis
werkidentiteit. Een medewerker heeft nooit een Business Pass nodig om voor een
Business-klant te werken.

Dit is geen nieuwe regel maar het doortrekken van een bestaande: het ene
RTG-account (`kern/eenaccount.js`) is nu al een sleutelbos waaraan werkrollen
hangen, en `accStart()` munt daar dezelfde sessie mee als de losse werk-inlog.
Wat ontbreekt is de *gratis werkidentiteit* voor iemand die nog geen lid is.

### Toegang verlenen gebeurt waar de rol woont

Er komt geen derde rechtenmodel bij. `kern/onderneming/toegang.js` legt dat al
vast en het geldt onverkort: de zaak-kant kent `manager`/`staff`, de
werkruimte-kant kent het fijnmazige model in `server/bedrijf/rollen.js`. Deze
laag **leest** ze en zet ze naast elkaar. Een tweede deur naar hetzelfde slot is
een deur die niemand bewaakt.

---

## 1. De vier ingangen

Iedere partner begint met één van vier keuzes:

1. **Ik heb al een bedrijf**
2. **Ik wil een nieuw bedrijf starten**
3. **Ik beheer meerdere bedrijven of een holding**
4. **Ik ben uitgenodigd om bij een bedrijf te werken**

Dat scheidt vier volstrekt verschillende situaties **zonder vier systemen te
bouwen**. Vanaf het moment dat er een geldige bedrijfsentiteit is, komen alle
routes samen in dezelfde kern:

```
Juridische structuur → Bedrijfsmodel → Capabilities → Organisatie →
Mensen → Rechten → Processen → Software → Controle → Live
```

Ingang 4 is de enige die de kern niet doorloopt: een uitgenodigde werknemer
bouwt geen bedrijf op, hij stapt in een bedrijf dat al staat. Dat is precies
waarom hij een eigen ingang heeft en geen afgeslankte versie van ingang 1.

**Wat er vandaag van staat.** Ingang 2 bestaat volledig
(`kern/onderneming/`, van "ik denk erover na" tot aanvraag). Ingang 1 bestaat
half: `ondernemingKoppel()` neemt een bestaande zaak over, met bewijs. Ingang 3
en 4 bestaan niet.

---

## 2. Eén bedrijf is niet één KvK

Dit moet diep in het datamodel zitten, en het is de reden dat dit document
bestaat. Vandaag is een bedrijf één rij in `suppliers` met een `code`, een
`name` en een `type`. Dat draagt geen holding, geen tweede vestiging en geen
tweede registratie.

Zes begrippen, en ze zijn niet inwisselbaar:

| Begrip | Wat het is |
|---|---|
| **Concern** | de economische groep |
| **Legal Entity** | de juridische rechtspersoon of onderneming |
| **Registration** | de KvK-inschrijving of het lokale equivalent |
| **Establishment** | de vestiging |
| **Brand** | de commerciële merknaam |
| **Operating Unit** | het restaurant, hotel, vervoersbedrijf — wat er draait |

Waarom die scheiding niet optioneel is:

- één merk kan meerdere juridische entiteiten gebruiken;
- één BV kan meerdere vestigingen hebben;
- een holding kan tientallen dochters hebben;
- één vestiging kan meerdere werkvormen hebben;
- één entiteit kan in meer dan één land geregistreerd staan.

```
North Sea Hospitality Holding BV
│
├── North Sea Hotels BV
│   ├── Amsterdam
│   ├── IJmuiden
│   └── Ibiza
│
├── North Sea Restaurants BV
│   ├── Haarlem
│   └── Amsterdam
│
├── North Sea Events BV
└── North Sea Property BV
```

Eén persoon met vijf ondernemingen, twaalf registraties en twintig vestigingen
moet hier probleemloos in passen. **En de ondernemer hoeft die architectuur nooit
te kennen** — dat is wet 3.

De huidige `supplier` verdwijnt niet: hij wordt de **Operating Unit**. Dat is
dezelfde beweging die `ondernemingKoppel()` al maakt — de onderneming *wijst de
zaak aan* in plaats van hem over te schrijven — alleen dan een niveau hoger.

---

## 3. De juridische laag

### Wat er per entiteit hoort te staan

Identiteit (officiële naam, handelsnamen, rechtsvorm, land, registratienummer,
vestigingsnummers, oprichtingsdatum, statutaire zetel, correspondentieadres,
boekjaar) · eigendom (aandeelhouders, belangpercentage, aandelenklasse,
stemrecht, certificering/STAK, indirect eigendom, UBO's) · bestuur
(bestuurders, alleen/gezamenlijk bevoegd, procuratie, volmachten, tekenlimieten,
geldigheidsperiode) · fiscaal (BTW-nummers, fiscale nummers, aangifteregime,
fiscale eenheid, lokale heffingen) · documenten (oprichtingsakte, statuten,
aandeelhoudersovereenkomst, registeruittreksel, UBO-bewijs, vergunningen,
verzekeringen, huurovereenkomsten, bankbevestiging) · en de relaties naar banken,
verzekeringen, contracten, werknemers, externe mandaten en digitale systemen.

**Wat hiervan al bestaat, en dat is meer dan je zou denken.**
`kern/onderneming/bestuur.js` draagt bestuur, aandeelhouders en eigendom, met
twee regels die precies in deze doctrine passen:

- de UBO wordt **afgeleid en niet aangevinkt** (meer dan 25% van de aandelen, of
  anders de statutair bestuurders) — een aangevinkte UBO blijft staan als de
  aandelen verschuiven, en dan klopt het register op het moment dat het ertoe
  doet niet meer;
- het **verbod wint**: een stichting kent geen aandelen, en dat komt uit de
  `verboden` van de rechtsvorm en niet uit een tweede lijstje.

`kern/onderneming/rechtsvorm*.js` draagt 28 rechtsvormen over zeven landen, elk
met hun oprichtingsstappen en hun fiscale assen. Wat ontbreekt is niet de
juridische kennis — die staat er — maar dat het allemaal aan **één** onderneming
hangt in plaats van aan een entiteit binnen een concern.

### De juridische graaf

Alles wordt aan elkaar geknoopt, zodat er vragen op te stellen zijn die vandaag
niemand kan beantwoorden:

```
Holding ─bezit 100%→ Hotel BV ─huurt→ Pand Amsterdam ─vergunning→ Hotel Amsterdam
                         └─bestuurder→ Lisa ─bevoegd tot→ €100.000
```

- *Wie mag dit contract tekenen?*
- *Welke locaties worden geraakt als deze vergunning verloopt?*
- *Welke dochters hangen juridisch aan deze bestuurder?*

De graafmotor hoeft niet nieuw: `kern/wereld/netwerk.js` doet dit al voor de
sociale graaf, en `kern/onderneming/relaties.js` voor het klantenboek.

### De tijdmachine

Iedere juridische wijziging krijgt een geschiedenis, geen overschrijving.

```
Bestuurder  Marco   1 jan 2026 → 31 aug 2027
Bestuurder  Lisa    vanaf 1 sep 2027
```

Zodat *"wie was bevoegd op 14 juni 2027?"* een antwoord heeft. Dit is dezelfde
vorm die `server/bedrijf/rollen.js` al kent — rollen met een `van` en een `tot`,
en een verlopen rol telt niet mee — nu toegepast op de juridische feiten.

**Dit is wet 4 in code.** Een juridisch gegeven zonder geschiedenis is een
gegeven waarvan niemand kan nagaan wanneer het waar werd.

### Document Intelligence

Upload een uittreksel, statuten, een contract, een polis of een vergunning; RTG
haalt eruit wat erin staat (naam, nummer, datum, partijen, looptijd,
opzegtermijn, bestuurder, dekking, bedragen) en toont het als:

> **Gevonden uit document — bevestig**

Nooit als vastgesteld feit. Dat is wet 5, en tegelijk de enige manier waarop wet
1 ("vraag niet wat RTG kan afleiden") mag worden ingevuld zonder wet 4 te
breken: afleiden mag, vaststellen niet.

### Business Discovery

Voor een bestaand bedrijf vraagt Rahul één ding — *"hoe heet uw onderneming?"* —
en bouwt daarna een **voorstel** uit toegestane bronnen:

> Ik denk dat uw structuur dit is: North Sea Hotels BV, twee vestigingen,
> hotel + restaurant + roomservice, één bestuurder, 43 medewerkers. Klopt dit?

De ondernemer corrigeert alleen de afwijkingen. Dat is het "dit stond al
klaar"-effect, en het is wet 1 en 2 tegelijk. De grens: het voorstel is een
voorstel tot de mens het bevestigt, en elk overgenomen veld houdt zijn bron.

---

## 4. Van bedrijf naar software

### De configuratiemotor bestaat al

`sector → genre → caps → werkvorm` is niet nieuw en hoeft niet gebouwd te
worden. Het staat er (`server/seed/genres.js`, `kern/werkvormen.js`) en het
werkt: 73 genres in 26 sectoren, 40 capaciteiten, en negen werkvormen die
**worden afgeleid uit wat de zaak doet**. Zet een eenmanszaak een auto in de
vloot, dan staan morgen de rittools er; zet zij de laatste auto weg, dan
verdwijnen ze weer — zonder migratie en zonder schakelaar die iemand vergeet.

Dat is precies wat dit document nodig heeft, en het is de reden dat de rest
haalbaar is. Wat eraan toegevoegd moet worden is dat een **vestiging** meerdere
werkvormen kan dragen, en dat het sluiten van een activiteit de operationele
hulpmiddelen weghaalt **zonder de juridische entiteit te raken**.

### Geen stille terugval — dit is gedaan

> Als een genre niet beschikbaar is, dan is het niet beschikbaar. Niet: → zzp.

Dit was de eerste breuk die gedicht moest worden, en hij is gedicht.

**Wat er stond.** Het register kende 73 genres; `kern/aanmeldingen/bedrijf.js`
kende er 31, met de hand overgetypt, en deed voor al het andere:

```js
type: GENRES.includes(data.type) ? data.type : 'zzp'
```

Twee lijsten over dezelfde vraag (LAT-regel 4) plus een stille omzetting. Wie
een juwelier, een wellness-zaak of een kinderopvang aanvroeg, kreeg zonder
melding een **zzp-zaak**: de zzp-caps, het vangnet-dorp en de verkeerde tools.
Geen fout, geen spoor, en de ondernemer merkte het pas als zijn scherm niet
klopte.

**Wat er nu staat.** Elk genre draagt een toegangsstand in het register, en dat
is de enige waarheid over wie het mag aanvragen:

| Stand | Betekenis | Nu |
|---|---|---|
| `open` | iedereen kan dit aanvragen | 31 |
| `bewijs` | vergunning, inschrijving of diploma nodig — **staat dicht tot die stap bestaat** | 8 |
| `uitnodiging` | alleen op uitnodiging van RTG | 2 |
| `intern` | hoort bij de wereld zelf, nooit door een partner aan te vragen | 8 |
| `binnenkort` | staat in het register, aanvraagweg nog niet open | 24 |

`aanvraagbareGenres()` leest die stand; de overgetypte lijst is weg.
`genreToegang()` geeft een weigering met reden en uitleg terug, en **nooit een
ander genre**. Een uitnodiging tilt precies één stand op (`uitnodiging`) en niet
meer dan die ene: `intern` blijft intern, ook met een uitnodiging in de hand.

Er is met opzet **niets opengezet**: 31 aanvraagbaar voor, 31 erna. De acht
`bewijs`-genres staan dicht tot de bewijsstap er werkelijk is — `mag: true` met
een vlag die niemand handhaaft, is een open deur met een bordje ernaast. De 42
gesloten genres zijn nu per stuk vrij te geven door één woord in het register te
veranderen, in plaats van door een tweede lijst bij te werken.

Bewaakt door `test/genretoegang.test.js` (5 toetsen, 5 mutaties gedaan en zien
zakken) en `test/genreregister.test.js`.

### Capability Composer

Na herkenning stelt Rahul de inrichting voor, in drie lagen — **essentieel**,
**aanbevolen**, **optioneel** — met één knop: *gebruik voorstel*. Voor een
hotelgroep bijvoorbeeld reserveringen, kamers, housekeeping, personeel, finance
en service als essentieel; restaurant, roomservice, CRM, Work, website en Mall
als aanbevolen; spa, events en bezorging als optioneel.

Niet: *"wilt u voorraad? wilt u reserveringen? wilt u keuken?"* — dat is wet 1
overtreden en wet 3 tegelijk.

### Organisatie, workflows en vestigingen

- **De afdelingen worden voorgesteld, niet getekend.** `kern/hoteldorp/` doet dit
  al per genre (14 eigen indelingen, een vangnet voor de rest). Voor een klein
  hotel draagt één persoon meerdere rollen; voor een groep worden het echte
  afdelingen. Zelfde systeem.
- **Workflow packs per bedrijfstype.** Nieuwe medewerker → uitnodiging →
  documenten → training → rooster → toegang. Voertuig defect → ritten blokkeren
  → maintenance → vervangend voertuig → ticket. De klant start met echte
  processen in plaats van een leeg systeem.
- **Multi-location cloning.** *"Kopieer de structuur van Amsterdam?"* — rollen,
  beleid, workflows, capabilities, templates, apparaatconfiguratie en
  rapportages mee; alleen de lokale afwijkingen bijstellen.
- **Holding policy inheritance.** Een holding legt beleid centraal op ("alle
  betalingen boven €100k twee goedkeuringen"); dochters erven dat en kunnen
  alleen afwijken waar het beleid dat toestaat.

---

## 5. Mensen

### Uitnodigen moet belachelijk makkelijk zijn

Wat de ondernemer ziet:

```
Naam of contact   [....................]
Wat gaat deze persoon doen?   [ General Manager ]
Waar?                         [ Hotel Amsterdam ]
Vanaf?                        [ 1 september     ]
                              [   Uitnodigen    ]
```

Wat RTG onder water doet: employment-record, bedrijf, juridische entiteit,
vestiging, afdeling, rol, capabilities, geldigheid, toegangsrechten, de juiste
app en de audit-regel. **Dat is precies de complexiteit die de gebruiker niet
hoort te zien** — wet 3 en wet 5 in één scherm.

Uitnodigen kan via RTG Chat, e-mail, telefoon, QR, een tijdelijke
onboardingcode, bulkimport, een directory-koppeling en later SCIM. De uitnodiging
draagt **geen technische token-logica** in de tekst:

> U bent uitgenodigd bij Hotel Noordzee — Receptie, Amsterdam. **Accepteren**

Heeft de persoon al een account: één tik, verifiëren, werkrelatie gekoppeld.
Heeft hij er geen: gratis werkidentiteit, daarna dezelfde stroom. **Geen tweede
bedrijfsaccount, geen tweede profiel.**

### Eén mens, meerdere werkgevers

```
Person
├── Employment  North Sea Hotels BV · Amsterdam · Manager · actief
├── Employment  Olive Restaurant BV · Haarlem · Adviseur · actief
└── Mandate     Holding BV · Accountant · read-only finance
```

Eén RTG-identiteit, meerdere werkrelaties. De sleutelbos in
`kern/eenaccount.js` draagt dit al voor werkrollen; wat ontbreekt is de
**employment** als eigen begrip — met een werkgever, een vestiging, een periode
en een reden — in plaats van een losse rol aan een zaakcode.

### Rollen, scope en tijd

Rechten komen uit **twee** dingen, en dat is krachtiger dan RBAC alleen:

| Wat bent u? | Waar geldt het? |
|---|---|
| CFO | de hele holding |
| General Manager | Hotel Amsterdam |
| Chef | alleen de keuken Amsterdam |
| Accountant | finance van drie BV's, alleen lezen |

Roltemplates worden per genre gegenereerd (hotel, taxi, restaurant … elk hun
eigen set), zodat niemand permissies hoeft aan te vinken. Elke rol kan starten,
eindigen, tijdelijk zijn en vanzelf verlopen — een interim-manager van 1
september tot en met 31 december is daarna gewoon weg.

`server/bedrijf/rollen.js` draagt hier al 18 rechten, 14 rollen, rollen met een
einddatum, vier soorten inzage die een **reden** vragen, en een journaal. Wat
ontbreekt is de **scope**: die rollen gelden nu per werkruimte en niet per
entiteit, vestiging of afdeling.

### Kwalificaties bepalen de werkelijke toegang

> De rol geeft **mogelijke** toegang. De kwalificatie bepaalt de **werkelijke**.

Een chauffeur zonder geldig rijbewijs voor een voertuigcategorie krijgt dat werk
niet. Een medewerker zonder de vereiste training krijgt de bijbehorende
veiligheidscapability niet. Dit is geen extra rechtenmodel maar een filter over
het bestaande — dezelfde vorm als het werkvenster in `magWerken()`, dat een
geldige inlog al kan tegenhouden zonder dat er een rol verandert.

### Functiescheiding

RTG herkent conflicten en **beslist ze niet**:

> Lisa kan zowel leveranciers aanmaken als betalingen boven €50.000 goedkeuren.
> **Risico: functiescheiding ontbreekt.**
> Opties: toestaan · tweede goedkeurder · rechten aanpassen.

Signaleren en de keuze bij de mens laten — wet 5.

### Bulk onboarding

Een bedrijf met 1.500 medewerkers uploadt één bestand:

> 1.500 personen gevonden · 1.380 automatisch aan rollen gekoppeld · 84 mogelijke
> matches · 36 vereisen beoordeling → **1.464 uitnodigingen versturen**

De 36 die beoordeling vragen zijn het punt. Een import die 1.500 van de 1.500
zegt te hebben begrepen, liegt over de 36.

### Het organigram wordt gegenereerd

Niemand tekent een organigram. Het volgt uit employment, manager en scope, en het
verandert vanzelf mee als iemand een andere leidinggevende krijgt.

---

## 6. Controle, livegang en verandering

### Company Readiness

Eén overzicht — juridisch, team, finance, operations, security — waarbij elke
score naast zijn concrete afwijkingen staat. Zie *Geen score zonder afwijking*.

### Launch blocking met ernstniveaus

Niet alles hoeft live te blokkeren:

| Niveau | Betekenis |
|---|---|
| **Info** | kan live |
| **Aandacht** | kan live, met het risico zichtbaar |
| **Blokkerend** | deze capability gaat niet aan |

Een restaurant zonder menu kan zijn account gebruiken, maar niet online
bestellen aanzetten. De blokkade zit dus op de **capability** en niet op het
bedrijf — dat is waarom de caps-laag hier het aangrijpingspunt is.

### Sandbox

Eerst testen: een nepmedewerker uitnodigen, een testreservering, een testbetaling,
een testorder, een testfactuur. Daarna pas **ga live**. Een sandbox die met
echte data praat is geen sandbox; de scheiding hoort in de opslag te zitten.

### Change Impact Preview en rollback

Dezelfde intelligentie blijft na de onboarding bestaan. *"Maak alle Finance
centraal"* levert eerst:

> Dit raakt 6 BV's, 19 medewerkers, 4 workflows en 12 dashboards.

En pas daarna de uitvoering. Grote configuratiewijzigingen zijn versioned, zodat
*"herstel de toestand vóór de reorganisatie"* geen databasehandwerk is.

### Offboarding, overname, fusie

- **Uit dienst** inventariseert rollen, open taken, klantrelaties, apparaten,
  documenten, mailboxrechten, fysieke toegang en lopende approvals; Rahul stelt
  de overdracht voor, de mens bevestigt één keer.
- **Overname**: eigendomsgraaf, bestuur, bevoegdheden, UBO, rollen en eventueel
  bank en contracten wijzigen. De operationele geschiedenis blijft staan — een
  bedrijf dat van eigenaar wisselt wordt niet opnieuw aangemaakt.
- **Fusie**: eerst de impact tonen, dan organisatie, personeel, contracten en
  workflows migreren **zonder historie te vernietigen**.

Dat "zonder historie te vernietigen" is wet 4: als een reorganisatie het verleden
uitwist, kan niemand meer nagaan wie waarvoor tekende toen het gebeurde.

---

## 7. Rahul als Company Architect

Geen chatbot. Zes taken, en elk ervan is traceerbaar:

| | |
|---|---|
| **ontdekken** | "Ik herken drie vestigingen." |
| **structureren** | "Deze twee lijken onder dezelfde BV te vallen." |
| **voorstellen** | "Uw hotel heeft waarschijnlijk deze twaalf capabilities nodig." |
| **controleren** | "Eén bestuurder staat zonder einddatum actief, maar de volmacht verloopt over 18 dagen." |
| **automatiseren** | "Ik heb 42 rollen klaargezet." |
| **uitleggen** | "Waarom heeft deze medewerker geen toegang tot Finance?" |

Die laatste is de belangrijkste en de makkelijkste om te vergeten. Een systeem
dat rechten uitdeelt zonder te kunnen uitleggen waarom iemand ergens *niet* bij
kan, is een systeem waarin mensen rechten gaan stapelen tot het werkt.

### Enterprise Memory

Iedere bedrijfsbeslissing is herleidbaar:

> *Waarom heeft dochter X een eigen HR-beleid?*
> Besluit 2027-184, directie, 14 juni 2027, vanwege de Spaanse
> arbeidsorganisatie.

Dit is wet 4 toegepast op besluiten in plaats van op feiten, en het is wat het
platform op termijn onderscheidt: niet dat het de toestand kent, maar dat het de
**reden** kent.

---

## 8. De twee eindervaringen

Alles hierboven is alleen geslaagd als dit eruit komt.

**De werknemer** merkt vrijwel niets van de zwaarte:

> U bent uitgenodigd. → tik → verifiëren →
> **Welkom bij Hotel Noordzee.** Vandaag 14:00–22:00. Uw werkplek is klaar.

**De ondernemer** voert drie BV's, twee vestigingen en 180 medewerkers in of
importeert ze, en leest:

> **Uw concern is opgebouwd.**
> 3 juridische entiteiten · 2 locaties · 14 afdelingen · 27 rollen ·
> 180 medewerkers · 11 workflows · 18 bedrijfscapabilities
> Er zijn nog 4 punten die uw aandacht vragen.

En nooit: *"stap 43 van 78"*.

---

## 9. Wat dit niet wordt

- **Geen boekhoudpakket, geen notaris en geen advocaat.** RTG structureert,
  signaleert en bereidt voor. De opgave doet u bij het register, met echte namen
  en identiteitsbewijzen. `kern/onderneming/bestuur.js` zegt dat al met zoveel
  woorden over de UBO en dat blijft staan.
- **Geen tweede rechtenmodel.** Zie *De grenzen*.
- **Geen verplichte zwaarte.** Een eenmanszaak moet hier in minuten kunnen
  starten. Alles in dit document dat een eenmanszaak een concernstructuur laat
  invullen, is fout gebouwd — de vorm hoort zich naar de onderneming te voegen,
  zoals `kern/onderneming/fase.js` dat al doet (een idee krijgt geen
  debiteurenbeheer).
- **Geen 40 losse apps.** Dit is één capability-laag onder de bestaande
  leverancier-app en PDA, geen nieuwe reeks schermen. `PLATFORM.md` §0 geldt
  onverkort.

---

## 10. De volgorde

Elke stap is los waardevol en laat het systeem werkend achter. De volgorde is
niet vrij: elke stap leunt op de vorige.

| # | Stap | Stand | Waar |
|---|---|---|---|
| 0 | **Genre-toegangsstand** | ✅ | `seed/genres.js` — `genreToegang()`, vijf standen |
| 1 | **Legal Entity als eigen object** | ✅ | `kern/concern/entiteit.js` + `entiteit-beeld.js` |
| 2 | **Establishment + de zaak als Operating Unit** | ✅ | `kern/concern/vestiging.js` |
| 3 | **Employment als eigen begrip** | ✅ | `kern/concern/employment.js` + `-organigram.js` |
| 4 | **Scope op de bestaande rollen** | ✅ | `kern/concern/scope.js` + `scope-filters.js` |
| 5 | **Uitnodigen in één scherm** | ✅ | `kern/concern/uitnodiging.js` + `-bulk.js` |
| 6 | **Concern + eigendomsgraaf** | ✅ | `kern/concern/graaf.js` + `graaf-bevoegdheid.js` |
| 7 | **Tijdmachine op de juridische feiten** | ✅ | `kern/concern/tijd.js` + `bron.js` |
| 8 | **Readiness + launch blocking** | ✅ | `kern/concern/readiness.js` |
| 9 | **Document Intelligence + Discovery** | ✅ | `kern/concern/voorstel.js` + `discovery.js` |
| 10 | **Impact preview, rollback, fusie/overname** | ✅ | `kern/concern/verandering.js` + `-eigendom.js` |

Bewaakt door `test/concern.test.js` (14 toetsen, 8 mutaties),
`test/concern-voorstel.test.js` (5 toetsen, 5 mutaties) en
`test/concern-routes.e2e.js` (3, waarvan één die andermans entiteit langs
veertien deuren probeert). De routes staan in `routes/concern.js` met
`concern/mensen.js`, `concern/verandering.js` en `concern/voorstel.js`. Het
scherm is `/apps/concern.html`, bereikbaar vanuit **Onderneming** — geen eigen
tegel, want dat is PLATFORM.md §0.

**Over stap 9.** De extractie is patroonwerk en geen slimmigheid: een
KvK-nummer is acht cijfers, een rechtsvorm een woord uit een gesloten lijst. Dat
is eerlijker dan doen alsof — en het maakt voor de grens niets uit. Elke vondst
is een **kandidaat met zijn vindplaats**, en pas als een mens hem aanvinkt
ontstaat er een feit, met bron `document`. Wat niet is aangevinkt bestaat niet.
Er is met opzet geen "bevestig alles"-ingang: dat zou het aanvinken tot een
formaliteit maken, en dan is de bevestiging geen bevestiging meer.

## De bewijsstap

De acht genres met stand `bewijs` — ziekenhuis, huisarts, medisch specialist,
apotheek, beauty medical, kinderopvang, verzekeringen en beveiliging — stonden
dicht met een reden die erbij stond: *een `bewijsNodig`-vlag die niemand
handhaaft, is een open deur met een bordje ernaast.*

Die handhaving is er nu (`kern/aanmeldingen/bewijs.js`), en de acht zijn open.
Wat er gebeurt:

- **de aanvraag komt gewoon binnen** — een plan indienen is geen
  beroepsuitoefening, en wie niet eens mag vragen wat er nodig is, komt nergens;
- **de zaak wordt niet klaargezet** tot een medewerker het stuk heeft
  afgetekend, op naam;
- **RTG beoordeelt het stuk niet inhoudelijk.** Wij zijn geen inspectie. Wat
  wordt vastgelegd is dát iemand het heeft gezien. Doen alsof RTG een vergunning
  valideert, verschuift een aansprakelijkheid naar de partij die haar niet kan
  dragen.

## De 42 gesloten genres, en wat de meting uitwees

Toen de toegangsstand er kwam, kregen 42 genres hun stand van een **mens** — en
dat is dezelfde fout als de handgetypte lijst van 31 die zij verving, alleen met
een ander gezicht. Daarom is er daarna **gemeten** wat er werkelijk aan
gereedschap bestond.

De uitkomst was niet wat de indeling suggereerde. Van de 24 genres op
`binnenkort` bleken er **24** volledig bediend: de zaak-app heeft tabs voor
`marina` en `petcare`, de PDA kent de modules, `redactie` en `sportclub` hebben
een eigen app, en in de seed stonden al demozaken van type `golfclub`,
`wintersport` en `weddingplanner`. Ze stonden niet dicht omdat er iets ontbrak —
ze stonden dicht omdat ze ooit niet in die 31 waren getypt.

Ze zijn alle 24 open. **63 van de 73 genres zijn nu aanvraagbaar**: 55 `open`,
8 `bewijs`. Dicht blijven alleen de 10 die daar niet om technische redenen
staan — 8 `intern` (die draait de wereld zelf) en 2 `uitnodiging`.

`test/genredekking.test.js` is de maat die dat voortaan afdwingt, en hij vraagt
niet of iemand goed heeft ingedeeld maar of de **caps bediend worden**. Vier
bewijzen tellen: een tab in de zaak-app, een PDA-module, een werkvorm-cap, of
een eigen scherm. Er stond een vijfde — *"een genre dat al open staat draagt
hem"* — en die is eruit: een mutatie liet zien dat een verzonnen cap
(`gehaktbal`) op het open genre `hotel` er glansrijk doorheen kwam. Dat is geen
meting maar een spiegel.

---

## 11. Wat de lat hier betekent

`LAT.md` geldt onverkort. Drie regels doen in dit document het meeste werk:

- **Regel 1 — repareer de oorzaak.** De stille `: 'zzp'` was het symptoom; de
  twee lijsten waren de oorzaak. Er is één lijst overgebleven, niet één
  reparatie erbij.
- **Regel 4 — één waarheid.** Concern, entiteit, registratie, vestiging, merk en
  operating unit zijn zes begrippen omdat ze zes verschillende dingen zijn. Ze
  in één tabel proppen levert de volgende `besloten`-vlag naast de `status` op.
- **Regel 2 — trek elke bewering na met een mutatie.** Voor stap 0 zijn vijf
  mutaties gedaan en zien zakken; dat staat onderaan
  `test/genretoegang.test.js`. Elke volgende stap hoort datzelfde slot te
  hebben.
