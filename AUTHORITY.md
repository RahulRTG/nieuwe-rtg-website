# RTG Authority Engine

**Van toegang modelleren naar bevoegdheid modelleren.**

> Toegang: *"Rahul mag Finance in."*
>
> Bevoegdheid: *"Rahul mag namens RTG Nederland facturen bekijken en betalingen
> tot € 25.000 klaarzetten; hij mag ze niet zelfstandig uitvoeren; dit geldt tot
> 31 december; boven € 10.000 is een recente passkeybevestiging nodig; elke
> handeling wordt vastgelegd."*

Dit is een **richtingsdocument**, zoals `AFSPRAAK.md`, `EXECUTIE.md` en
`BENOEMING.md`. Per onderdeel staat erbij of het **staat**, **een stap weg** is,
**een besluit vraagt** of **jaren weg** is. De opdracht kwam van de eigenaar op
23 september 2026, in 66 punten; ze staan in par. 4 allemaal, naast de meting.

`BENOEMING.md` blijft gelden en wordt hier het **Foundation-profiel** van een
RTG-breed begrip. `CONTROLPLANE.md` (wie mag een economische handeling),
`KANTOORMACHT.md` (wat een medewerker van RTG mag), `EXECUTIE.md` (hoe een
handeling wordt uitgevoerd) en `MENSNETWERK.md` (wie namens een mens handelt)
worden hier niet overgedaan: deze laag knoopt ze aan elkaar.

---

## 0. Wat al gebeurd is (P0 en P0b, 23 september 2026)

Twee reparaties gingen vóór het ontwerp, omdat ze vandaag schade kunnen doen:

| | wat | stand |
|---|---|---|
| P0 | een ledenbalie-zetel kon door ELK boardroomlid worden uitgedeeld (alleen het scherm verborg de knop); nu alleen de eigenaar, met een verse passkey en een auditregel. Boardroomtoegang intrekken vraagt dezelfde passkey als geven. Twee schermen lazen de vraag om een passkey als "uitgelogd" en zijn gerepareerd. | staat |
| P0b | zeven auditregels schreven een naam die de aanroeper zelf in het verzoek typte als degene die de handeling deed (pasprijs, partnervergoeding, ledenvoordeel, AI-dataset-export, zaakabonnement, RTG Stad, rolwijzigingen in een werkruimte). De actor komt nu uit de sessie. Twee bestaande toetsen eisten het oude gedrag en zijn omgedraaid. | staat |

Die tweede is de leerzaamste: **een spoor waarin de dader zijn eigen naam typt, is
geen spoor** -- en het stond op zeven plekken, waarvan twee door een toets werden
beschermd. Het ontwerp hieronder begint daarom bij de vraag WIE, niet bij de vraag
WAT.

---

## 1. De meting

Drie metingen op 23 september 2026, over de hele `server/`-boom. Samengevat:

### 1.1 Er is geen beslispunt, er zijn er zeven

Er bestaat geen enkele `can(subject, action, resource, context)`. Wel zeven
gedeeltelijke:

| beslispunt | waar | wat het beslist | stand |
|---|---|---|---|
| AI-allowlist | `server/kern/stuur/beleid.js` (`beleidVoor`) | welke paden de AI mag, niet-genoemd is dicht | staat, alleen voor de AI |
| acht uitkomsten | `server/kern/commercie/besluit.js` (`beslis`) | een economische handeling, met `ONBEKEND` ≠ `WEIGEREN` | een stap weg: de motor is echt, maar hij hangt aan EEN route (`/api/office/bank/incasso`) |
| machtskaart | `server/kern/commercie/rechten.js` | nominaal naast effectief | een stap weg: leest, verleent niets |
| voornemen | `server/kern/commercie/voornemen.js` | plan → keuring → uitvoering | een stap weg: 2 kantoorroutes |
| eigen vergunning | `server/kern/bevoegdheid/` | mag RTG ZELF dit (bankrail, e-geld) | staat, ander onderwerp |
| frictie | `server/kern/frictie/motor.js` | hand / assist / auto | een stap weg: alleen in RTG Command |
| toegangsklassen | `server/kern/mutatiecontract/klassen.js` | zes klassen per route | een stap weg: gemeten, niet afgedwongen |

Daarnaast **vijf gezagsvocabulaires** (`GEZAG.json`) en een noemer van vier treden
eroverheen (`GEZAGSNOEMER.json`: geen / tonen / klaarzetten / uitvoeren), en de
huisregel INT-01: **er komt geen zesde**.

### 1.2 Er is geen afdwingpunt, er zijn er tientallen

- **16 poortfuncties** op de router (`auth`, `officeAuth`, `supplierAuth`,
  `boardroomAuth`, `balieAuth`, `techAuth`, `scimAuth`, `gezinsPoort` -- die laatste
  zeven keer gedefinieerd -- en meer), plus `kluisAuth` en `naamAuth`.
- **26 gezagsfuncties BINNEN handlers** (`HANDLERWACHT.json`): `werkPoort` (92
  routes), `poort` (86), `familieVan` (60). Dat is al relatiegebaseerde toegang
  (ReBAC), alleen verspreid.
- **Default-deny bestaat, maar alleen tijdens het toetsen**: `bewakersketen`,
  `routedekking`, `handlerwacht` (0 onbewaakt van 624 schrijfroutes),
  `ROLPROEF.json` (3884 routes, 0 open), `IDOR.json` (1623 routes, 0 doorbraak). Op
  de draaiende server weigert niets een route omdat hij geen poort heeft.
- **Buiten HTTP**:
  - de AI speelt een handeling af als intern HTTP-verzoek met het token van de
    gebruiker, dus elke poort draait opnieuw (staat);
  - de ledenstream toetst elke schrijfactie opnieuw (staat);
  - de kantoor- en leveranciersstream alleen bij het openen (een stap weg);
  - `/media/:naam` heeft **geen enkele toegangscontrole**: het rust op een naam van
    128 bits willekeur en wordt een jaar lang `public` gecachet (vraagt een besluit,
    par. 6);
  - 61 achtergrondtaken draaien als "het systeem", zonder het onderwerp opnieuw te
    toetsen (jaren weg voor taken die namens iemand handelen).

### 1.3 Er is geen lidmaatschap, er zijn er elf

Elf losse opslagplaatsen die elk "hoort bij" betekenen -- werkruimteleden,
rolvensters, dienstverbanden, de sleutelbos van het ene account, leverancierspersoneel,
boardroomtoegang, baliezetels, RTFOS-zetels, schoolrollen, SCIM-groepen, het
tenantregister -- met **vier** levenscycli ertussen. De rest is een lijst of een vlag.

### 1.4 Wat er onverwacht goed staat

Dit huis heeft meer dan het zelf weet:

- **identiteit**: een kluis gebonden aan tabel, kolom en rij; vijf
  zekerheidsstanden die bij elke lezing worden uitgerekend en nooit hoger dan het
  zwakste bewijs (`server/kern/identiteit/vertrouwen.js`); daarnaast A3 en 18+
  (`server/kern/volwassen.js`); passkeys met elf zware handelingen; TOTP;
  toestelbinding;
- **organisatie**: concern, entiteit, vestiging, afdeling met een dekkingsladder
  (`server/kern/concern/scope.js`), SCIM en SAML per organisatie, en een brug van
  een IdP-groep naar een rol (`server/kern/tenant/brug.js`);
- **tijdelijk en in nood**: vier zware rechten met een maximum in minuten, en
  noodtoegang met een reden, een uur en een journaalregel
  (`server/kern/command/toegang.js`); bijstand die op de klok verloopt;
- **delegatie**: de machtiging mens-namens-mens met een berekende stand, een
  NOOIT-lijst en een simulatie van het verschil (`server/kern/vertegenwoordiging/`);
- **vier ogen**: het lijf bevroren, verzoeker ≠ bevestiger, tien minuten
  (`server/kern/kantoor/tweedehandtekening.js`) -- maar voor twee handelingen;
- **audit**: een hashketen onder het inzagejournaal, 730 dagen, en een journaal
  dat weigert als het spoor niet vaststaat.

### 1.5 Wat er aantoonbaar ontbreekt

- **geen gegevensklasse per veld** (bevestigd; `KANTOORMACHT.md` zegt het al);
- **geen onderscheid tussen lezen en exporteren**; `/api/office/export.csv` liet
  geen enkel spoor na (gerepareerd: B1, en fase 6 in par. 5f);
- **geen machtigingsversie in het token** (`userId.exp.issued.sid`): intrekken
  bestaat per sessie en per account, niet per recht;
- **geen offboarding**: `server/kern/concern/employment.js` verwijst naar een
  `offboarding.js` die niet bestaat; alleen de SCIM-weg ruimt echt op;
- **geen toegangsreview, geen slapende rechten, geen historie van rechten**
  (alleen bestuurders en volmachten hebben een tijdlijn);
- **geen externe verankering** van de auditketen (`server/lib/keten-anker.js` staat
  er, maar is niet in bedrijf);
- **vier ogen faalt open** in `server/kern/appstore/vierogen.js`: zonder identiteit
  aan beide kanten laat hij door met graad `onbekend`.

---

## 2. Correcties op de opdracht

De opdracht is juist in zijn richting. Vijf dingen erin zouden, letterlijk gebouwd,
tegen een regel van dit huis lopen, of zijn al anders opgelost.

### 2.1 Geen zesde gezagsvocabulaire -- de motor VERVANGT, hij komt er niet bij

Punt 7 vraagt interne handelingen (`READ`, `CREATE`, `EDIT`, `PREPARE`, `APPROVE`,
`EXECUTE`, `EXPORT`, `SHARE`, `DELETE`, `ADMIN`) naast de vier treden van de UI. Dat
is juist, en het is precies de vorm die al bestaat: de noemer
(`GEZAGSNOEMER.json`) is de UI-kant, en een HANDELING is geen trede maar een
werkwoord. Het gevaar zit in de vijf vocabulaires die er al zijn: een zesde
ernaast is wat INT-01 verbiedt. De motor wordt daarom gebouwd als de plek waar de
vijf **naartoe verhuizen**, en elke vocabulaire die verhuist verdwijnt uit
`GEZAG.json`. Het getal daar mag alleen dalen. Zie besluit A1.

### 2.2 Eén grammatica, geen tabel met alle rechten

Punt 66 (*"één RTG Authority Engine"*) klopt voor de **grammatica** en niet voor
de **inhoud**. Een recht is een werkwoord van een DOMEIN -- `casus.beheren`,
`invoice.read`, `stad.beheren` -- en die delen niets (`CAPABILITEIT.json`: 21
woordenlijsten, 91% van de leden in precies één). De motor bezit:

- wie iemand is (principal),
- waar iemand hoort (orggraaf en benoeming),
- onder welke voorwaarden (beleid, context, tekengrens),
- het besluit en het spoor.

Het domein bezit zijn eigen werkwoorden en verklaart ze bij de motor, zoals
`server/kern/appstore/machtigingen.js` dat al doet: met een doel en een grens.
`CONCERN.md` zegt *er komt geen derde rechtenmodel*; de motor is geen derde maar de
laag waar de twee die er zijn (`server/bedrijf/rollen-register.js` en de
RTFOS-`RECHTEN`) in opgaan.

### 2.3 RBAC, ABAC en ReBAC bestaan al -- alleen niet op een plek

Rollen als bundels van werkwoorden (RBAC): `rollen-register.js`, 18 werkwoorden,
14 rollen. Voorwaarden (ABAC): de uitgavegrens per stad, het werkvenster van een
werkgever, de stadsstand. Relaties (ReBAC): `familieVan`, `werkPoort`, de voogd.
Wat ontbreekt is niet het model maar de **ene vraag** waar ze samen antwoorden.

### 2.4 Rahul is al een doorsnede -- maar nog geen identiteit

Punt 22 (*user capability ∩ agent capability ∩ purpose ∩ data policy*) staat voor
een groot deel: de AI speelt elke handeling af met het token van de gebruiker, dus
hij kan nooit meer dan die gebruiker, en `beleid.js` versmalt daarbinnen. Wat
ontbreekt is punt 23: in het spoor staat de gebruiker en niet de agent. Alleen
`ai:onderzoeker` in `server/kern/service/onderzoeker.js` heeft een eigen naam.
Punt 24 (geen impersonatie) botst daarmee met hoe het vandaag werkt -- de AI
doet het verzoek ALS de gebruiker. Zie besluit A5.

### 2.5 Namen

Gemeten over `server/`, 23 september 2026:

| begrip | naam | waarom |
|---|---|---|
| lidmaatschap / aanstelling | **`benoeming`** | vrij in de code; `BENOEMING.md` gebruikt het al, en de Foundation wordt een profiel ervan |
| organisatiegraaf | **`orggraaf`** | vrij (0 treffers) |
| beleidsbeslisser (PDP) | **`beleidsmotor`** | vrij (1 treffer, in tekst) |
| financieel mandaat | **`tekengrens`** | `mandaat` is de AI-speelruimte, `bevoegdheid` is de vergunning van RTG zelf |
| recht (werkwoord) | blijft **`recht`** per domein | de motor krijgt geen eigen woordenlijst |
| NIET gebruiken | `policy` (waardebeleid), `capability` (128 bestanden), `machtiging` (vier betekenissen), `lidmaatschap` (de pas van een lid), `organisatie` (school), `delegatie` (privékantoor) | |

---

## 3. Het model

```
                 PRINCIPAL  (mens · agent · dienst · apparaat)
                     │
                 ORGGRAAF   (projectie over concern, tenant, werkruimte, RTFOS)
                     │
                 BENOEMING  (voorgesteld → aanvaard → actief → opgeschort → ingetrokken / verlopen)
                     │
       ┌─────────────┼──────────────┐
      ROL         RECHT          TEKENGRENS
   (bundel)   (werkwoord van   (bedrag · tweede hand ·
               een domein)       stap-op)
       └─────────────┼──────────────┘
                     │
               BELEIDSMOTOR   kan(principal, handeling, object, context)
                     │         → een van de acht uitkomsten, MET de opbouw
       ┌─────────────┼──────────────┐
     HTTP        STREAM/JOB      AGENT/EXPORT     (afdwingpunten)
       └─────────────┼──────────────┘
                     │
                   SPOOR   (hashketen; actor uit de sessie, nooit uit het verzoek)
```

Vijf keuzes die het model dragen, elk met een bestaand voorbeeld:

1. **De orggraaf is een PROJECTIE, geen tabel.** Hij leest concern, tenant,
   werkruimte en RTFOS en bezit er niets van -- de vorm van
   `server/kern/levensgraaf/graaf.js`. Een `organisaties`-tabel ernaast is de
   `Asset`-fout.
2. **Een benoeming heeft een BEREKENDE stand** (de vorm van
   `server/kern/vertegenwoordiging/machtiging.js`): alleen gebeurtenissen worden
   bewaard, de stand wordt bij elke vraag uitgerekend. Een verlopen rol is dus nooit
   "vergeten te beëindigen".
3. **Het besluit is een van de acht uitkomsten van `besluit.js`**, niet ja of nee,
   en draagt zijn opbouw: via welke benoeming, welke rol, welke voorwaarde. Zo is
   *"waarom mag deze persoon dit?"* (punt 59) geen tweede systeem maar het besluit
   zelf.
4. **Een vereiste is een filter en geen rol** (de vorm van
   `server/kern/persoonseis.js`): een verlopen VOG of een ontbrekende stap-op houdt
   de handeling tegen, niet de benoeming.
5. **Intrekken verhoogt een versie.** Het token krijgt een machtigingsversie per
   principal; een intrekking verhoogt die, en elk afdwingpunt -- ook een open stream
   -- vergelijkt hem. Dat is punt 30, en het is de enige manier waarop punt 17 en 29
   (onmiddellijk, overal) waar kunnen zijn zonder bij elk verzoek alles opnieuw te
   rekenen.

---

## 4. De 66 punten naast de meting

| # | punt | wat er staat | stand |
|---|---|---|---|
| 1 | P0: baliezetels, stap-op, audit, intrekken | par. 0 | **staat** |
| 2 | gedeelde kantoorcode weg als autorisatie | de code maakt nog steeds blijvend personeel | een stap weg (fase 2) |
| 3 | Office Membership als object | `benoeming`, in `BENOEMING.md` al uitgewerkt | een stap weg |
| 4 | functie ≠ bevoegdheid | `rollen-register.js` doet dit al (rol = bundel werkwoorden) | staat in WorkOS, een stap weg elders |
| 5 | RBAC + ABAC + ReBAC | alle drie aanwezig, verspreid (par. 2.3) | een stap weg |
| 6 | kamers apart autoriseerbaar | 26 kamers, één deur | een stap weg |
| 7 | expliciete handelingen intern | werkwoorden per domein + noemer voor de UI (par. 2.1) | een stap weg |
| 8 | bescherming per veld | geen gegevensklasse per veld; wel een veldlijst voor de balie en de AI | jaren weg als algemeen, een stap weg per dossier |
| 9 | financiële tekengrenzen | per stad in RTFOS; commerce-grenzen hard in code | een stap weg, per organisatie vraagt een besluit |
| 10 | scheiding van taken | drie conflicten GEMELD in `scope.js`, niet afgedwongen | een stap weg |
| 11 | vier ogen op beleid | twee handelingen; `vierogen.js` faalt open | een stap weg (en een reparatie, par. 6) |
| 12 | boardroom geen superrol | boardroom = ~100 routes in één keer | een stap weg |
| 13 | eigenaar geen dagelijkse superuser | de eigenaar komt via de envelop overal door | vraagt een besluit (A2) |
| 14 | just-in-time rechten | `command/toegang.js`: vier rechten met een maximum in minuten | staat in Command, een stap weg elders |
| 15 | delegatie | `vertegenwoordiging/` (mens-namens-mens), bijstand | staat; vakantiedelegatie is een stap weg |
| 16 | noodtoegang | reden, een uur, journaal in `command/toegang.js` | staat in Command |
| 17 | universele intrekking | per sessie en per account, niet per recht | een stap weg (versie, par. 3.5) |
| 18 | offboarding als één workflow | `offboarding.js` bestaat niet; SCIM ruimt wel op | een stap weg |
| 19 | rechten met tijdsgrens | rolvensters in `bedrijf/rollen.js` verlopen vanzelf | staat in WorkOS |
| 20 | contextafhankelijke rechten | werkvenster, stadsstand, toestelbinding | een stap weg |
| 21 | DLP: lezen ≠ exporteren | geen onderscheid; export zonder spoor | een stap weg |
| 22 | Rahul = doorsnede | het token van de gebruiker + `beleid.js` (par. 2.4) | staat grotendeels |
| 23 | agent heeft eigen identiteit | alleen `ai:onderzoeker` | een stap weg, vraagt besluit A5 |
| 24 | geen impersonatie | de AI handelt vandaag ALS de gebruiker | vraagt besluit A5 |
| 25 | beleidsmotor (PDP) | zeven gedeeltelijke (par. 1.1) | een stap weg |
| 26 | afdwingpunten overal | HTTP ja, ledenstream ja, kantoorstream en taken nee | een stap weg |
| 27 | default deny | alleen in de toetsen | vraagt besluit A3 |
| 28 | fail closed | `besluit.js` en `noteerVast` ja; `vierogen.js` nee | een stap weg |
| 29 | realtime intrekken | ledenstream ja, kantoorstream nee | een stap weg |
| 30 | machtigingsversies | niet in het token | een stap weg |
| 31 | audit op rechtenwijzigingen | na P0b wie, niet altijd oud/nieuw | een stap weg |
| 32 | audit op gevoelige lezingen | balie en kluis ja, met hashketen | staat voor leden |
| 33 | reden bij inzage | balie, werkruimte (`REDEN_NODIG`) | staat |
| 34 | toegangsreviews | niets | een stap weg |
| 35 | slapende rechten | passkey `laatstGebruikt`; niets voor rollen | een stap weg |
| 36 | rechtensimulator | voor machtigingen (`vertegenwoordiging/simulatie.js`) | staat voor één soort |
| 37 | beleidssimulator | Command-simulatie in de schaduw | een stap weg |
| 38 | schaduwbeleid | `commercie/schaduw.js` met rijpheidseis | **staat** |
| 39 | rolpakketten | 14 vaste rollen in WorkOS | staat |
| 40 | eigen rollen | niet mogelijk | vraagt een besluit (A4) |
| 41 | organisatie-eenheden met overerving | dekkingsladder in `scope.js`, geen overerving van rechten | een stap weg |
| 42 | grenzen tussen bedrijven | tenant en concern | staat |
| 43 | franchise-isolatie | alleen documenten (`SOEVEREIN.md`) | jaren weg |
| 44 | externe identiteiten | codes per soort (partner, vrijwilliger, donateur) | een stap weg |
| 45 | data rooms | niets | jaren weg |
| 46 | machine-identiteiten | zes losse soorten, geen gedeeld type | een stap weg |
| 47 | minimale rechten voor processen | taken draaien als "het systeem" | jaren weg |
| 48 | SCIM | `server/scim/` | **staat** |
| 49 | SSO en federatie | SAML en OIDC | **staat** |
| 50 | passkeys voor bevoorrechte rollen | passkeys staan; niet verplicht per rol | een stap weg |
| 51 | stap-op naar risico | per handeling (`ZWARE_ACTIES`), niet per bedrag | een stap weg |
| 52 | beheerde apparaten | toestelbinding voor leden | een stap weg |
| 53 | locatie als signaal | werkplekzone voor personeel | staat in één domein |
| 54 | dubbele controle op beleidswijziging | alleen de bankschakelaar | een stap weg |
| 55 | beschermde rollen | eigenaar, overdracht vraagt wachtwoord én passkey | staat voor één rol |
| 56 | geen stille escalatie | P0 en P0b sloten er twee | een stap weg |
| 57 | waarom heeft iemand toegang | het besluit met zijn opbouw (par. 3.3) | een stap weg |
| 58 | toegangsgraaf | offline: `KANTOORMACHT.json`, bewakerskaart | een stap weg |
| 59 | "waarom mag X dit?" | par. 3.3 | een stap weg |
| 60 | "wie mag hierbij?" | niets op objectniveau | jaren weg |
| 61 | impactanalyse van beleid | Command-simulatie | een stap weg |
| 62 | giftige combinaties | drie conflicten gemeld; leverancier + IBAN + betalen niet | een stap weg |
| 63 | minimale rechten voorstellen | niets | een stap weg na 35 |
| 64 | historie van rechten | alleen bestuurders en volmachten | jaren weg |
| 65 | bewijsexport voor auditors | niets (het CI-bewijsboek is iets anders) | een stap weg |
| 66 | één Authority Engine | dit document | een stap weg, in fasen |

---

## 5. Bouwvolgorde

Elke fase is afzonderlijk te mergen, loopt eerst **in de schaduw** (`schaduw.js`,
rijpheidseis 200 waarnemingen en 7 dagen) en schakelt pas daarna om. Niemand
verliest stil een recht en niemand krijgt er stil een bij: elke fase vergelijkt
per persoon de effectieve rechten vóór en ná, en meldt elke afwijking.

| fase | inhoud | hangt af van |
|---|---|---|
| 0 | P0 + P0b | **klaar** |
| 1 | **de beleidsmotor in de schaduw**: `kan(...)` leest de bestaande poorten en geeft een besluit met opbouw; draait naast elke kantoorroute en telt waar hij het oneens is (de vorm van `tegenfeit.js`) | **staat, in de schaduw** (23 september 2026; zie par. 5a) |
| 2 | **de benoeming, RTG-breed**: kantoor, balie, boardroom en RTFOS als profielen; de gedeelde kantoorcode wordt een eenmalige uitnodiging en nooit meer blijvend personeel | fase 1, besluit A2 |
| 3 | **machtigingsversie en universele intrekking**: in het token, in elke stream, en offboarding als één stap die faalt als een onderdeel faalt | **deels staat** (23 september 2026; zie par. 5b) |
| 4 | **kamers en werkwoorden**: de 26 kamers apart, met per kamer de noemertrede; de boardroom wordt een werkruimte en geen superrol | **de gegevens en de telling staan, in de schaduw** (23 september 2026; zie par. 5d); afdwingen wacht op fase 2 en op het besluit wie welk werkwoord krijgt |
| 5 | **tekengrenzen, scheiding van taken, vier ogen op beleid**: `besluit.js` per organisatie, de drie conflicten van `scope.js` afdwingen, `vierogen.js` dicht | **vier ogen staat** (23 september 2026; zie par. 5e); tekengrens per organisatie en de conflicten van `scope.js` hebben eerst een onderwerp nodig |
| 6 | **lezen ≠ exporteren**, en export met een spoor | **staat** (23 september 2026; zie par. 5f) |
| 7 | **identiteiten voor agents, diensten en apparaten** | **agent staat** (23 september 2026; par. 5c); diensten en apparaten niet |
| 8 | **reviews, slapende rechten, simulator, "waarom"** -- allemaal lezers op het besluit | **"waarom" over jezelf staat** (`/api/office/beleidsmotor/waarom`, op naam: de gedeelde code heeft geen zelf); reviews, slapende rechten en de simulator niet |
| later | gegevensklasse per veld, historie van rechten, data rooms, franchise | jaren weg |

### 5a. Fase 1, zoals hij er staat

`server/kern/beleidsmotor/` (drie bestanden) en `/api/office/beleidsmotor` (achter
`boardroomAuth`). De vier kantoordeuren staan als GEGEVENS in `regels.js`: een deur
is een lijst eisen die allemaal moeten kloppen, een eis een lijst feiten waarvan er
een genoeg is. `feiten.js` leest ze zelf uit het token en nooit uit wat een poort op
het verzoek zette, anders vergelijkt de schaduw de poort met zichzelf. Drie
uitkomsten, en `ONBEKEND` (een bron kon niet antwoorden) is geen `WEIGEREN`.

- **A1 in de schaduw.** `bewaak(deur, poort)` wikkelt `officeAuth`, `kluisAuth`,
  `naamAuth`, `boardroomAuth` en `balieAuth` met behoud van hun naam, velt een eigen
  besluit en telt na afloop `eens`, `oneens` of `onbekend`. Er is geen tak die iets
  tegenhoudt. Een deur mag pas verhuizen als hij rijp is (200 waarnemingen, 7 dagen:
  `RIJP` uit `commercie/schaduw.js`) en nooit oneens was. Dat verhuizen is een eigen
  stap met een eigen besluit.
- **A3 in de schaduw.** Een meelezer voor alle `/api/office`-routes telt elke route
  die afliep zonder een poort die de motor kent. Drie routes zijn verklaard open, elk
  met een reden (`VERKLAARD_OPEN`): de inlog, de live-stroom en de documentdownload.
- **Een teller en geen journaal**, de grens van `kantoor/mensdeur.js`: per deur en
  routepatroon een paar getallen, en de enige voorbeelden zijn die van `oneens`, in
  het geheugen en zonder sleutel of naam. De schrijfweg is die van `mensdeur`
  (`mensdeur-spoel.js`, nu met eigen tellers), zodat de PostgreSQL-les niet een
  tweede keer geleerd hoeft te worden.
- **Wat de schaduw bewijst, en wat niet.** Hij bewijst dat de SAMENSTELLING van de
  regels gelijk is aan die van de poorten. De feiten lezen dezelfde bronnen als de
  poorten (sessie, account, boardroomlijst, baliezetels), dus een fout in een bron
  zit aan beide kanten.
- **Wat de A3-meting meteen vond (B7).** `/api/office/doc` leverde een ontsleuteld
  paspoort of selfie uit aan ELK kantoortoken in de query, ook de gedeelde code,
  terwijl de lijst waar die link uit komt (`/api/office/verifications`) al achter
  `kluisAuth` hing. Nu is het document op naam, zoals de lijst
  (`officeQueryOpNaam`, `test/beleidsmotor.test.js` toets 6).
- **Getoetst** in `test/beleidsmotor.test.js`: tegen een echte server met de gedeelde
  code, een medewerker op naam en de eigenaar, door alle vier deuren nul keer oneens.
  Drie mutaties zakken: een verkeerd feit, een blinde A3-teller, de documentdeur open.

### 5a-bis. Besluit A2 in de schaduw

De eigenaar is geen dagelijkse superuser: gevoelige lezingen vragen ook van hem een
stap-op en een reden. De beleidsmotor telt nu waar dat zou gelden. `STAPOP_DEUREN`
in `regels.js` noemt de kluisdeur (`op-naam`: identiteit en HR) en de ledenbalie;
elke keer dat de eigenaar, via zijn account of een kantoorsessie op zijn sleutel
(het feit `eigenaarMens`), daar doorheen gaat, telt dat als `eigenaarZonderStapop`
per route. Er wordt niemand tegengehouden. Afdwingen is de volgende stap, en die
vraagt dat elk van die routes een reden kan ontvangen en dat het scherm de passkey
vraagt (`public/shared/zwaarstap.js` bestaat al). `test/beleidsmotor.test.js` toets
7 houdt vast dat een medewerker op naam er niet in telt; twee mutaties zakken.

### 5b. Fase 3, het deel dat nu staat

`server/kern/kantoor/intrekking.js`. Er komt geen tweede intrekmechanisme bij: elke
sessie draagt een `sid`, `accounts.trekInSessie` zet die duurzaam op de intreklijst
(over de bus naar elke instantie), en `sessionFor` weigert haar bij het volgende
verzoek. Nieuw is alleen de vraag welke kantoorsessies van deze mens zijn.

- **Drie intrekwegen sluiten nu wat openstaat.** De kantoorrol ontkoppelen
  (`/api/account/ontkoppel`), boardroomtoegang intrekken en een baliezetel
  weghalen sluiten elke open kantoorsessie van die mens, ook op een ander toestel.
  Het antwoord zegt hoeveel (`sessiesGesloten`). De sessie van wie intrekt blijft
  staan.
- **Elke stroom, elk bericht (B3).** `kern/sse.js` vraagt vlak voor ELK bericht of
  de stroom nog mag (`geldig()`). Een vraag die gooit, geldt als nee. De
  kantoorstroom kent daarvoor zijn sessie; de leveranciersstroom
  (`routes/supplier/stroom.js`) controleert de personeelssessie en of de zaak
  niet is geschorst.
- **B5.** `concern/employment.js` wijst nu naar `verandering-eigendom.js`, waar de
  offboarding echt staat.
- **Getoetst** in `test/kantoorintrekking.test.js`, tegen een echte server. Drie
  mutaties zakken: ontkoppelen zonder sluiten, een stroom zonder keuring per
  bericht, en intrekken van de boardroom zonder sluiten. De toets vond zelf een
  fout: een gesloten stroom werd uit de lijst gehaald terwijl de lus eroverheen
  liep, en de volgende verbinding miste dan een bericht.

**Wat nog niet staat.** Een machtigingsversie IN het token, zodat elke
bevoegdheidswijziging (niet alleen deze drie) een sessie ongeldig maakt; offboarding
als EEN stap die als geheel slaagt of faalt; en de sessies van de GEDEELDE
kantoorcode, die geen mens dragen en dus niet per mens in te trekken zijn. Dat
laatste lost fase 2 op (de code wordt een uitnodiging), en fase 2 wacht op de
schaduw van fase 1.

### 5c. Besluit A5: de AI handelt zichtbaar namens een mens

Rahul (`kern/stuur.js`) voert een handeling uit door de route intern opnieuw aan te
roepen met het token van de gebruiker. Voor de BEVOEGDHEID is dat goed (de AI kan
nooit meer dan de mens die hem iets vraagt) en dat blijft zo. Voor het SPOOR was het
slecht: er stond een klik van het lid, en niemand zag dat een machine het deed.

- **Het kenmerk.** `kern/agentteken.js` geeft de interne aanroep een kop met een
  geheim dat alleen in dit PROCES bestaat (de aanroep gaat naar 127.0.0.1, dus naar
  hetzelfde proces). Een ontbrekend of vals kenmerk is gewoon geen agent en nooit
  een fout.
- **De envelop.** `actor.id` blijft de mens: die sleutel is op meer plekken een
  datasleutel dan een naam. De agent komt ernaast als `actor.agent`
  (`'ai:rahul'`), dus het spoor noemt beide.
- **Terug naar de aanroeper.** Het antwoord meldt de handelaar (`X-RTG-Handelaar`,
  gezet bij de effectbon), en `/api/member/doe` geeft hem door als `agent`.
- **Getoetst** in `test/stuur.test.js` toets 10, tegen een echte server: via Rahul
  staat er `ai:rahul`, bij een gewone klik niets, en een vals of kaal kenmerk maakt
  er geen agent van. Twee mutaties zakken: het kenmerk niet meesturen, en het
  geheim niet controleren.

**Wat nog niet staat.** Een effectieve bevoegdheid als DOORSNEDE van mens, agent,
doel en gegevensbeleid. Vandaag is het de bevoegdheid van de mens, versmald door
`kern/stuur/beleid.js`; het mandaat (`kern/stuur/mandaat.js`) heeft nog geen
aanroeper. Diensten en apparaten krijgen nog geen eigen identiteit.

### 5d. Fase 4 in de schaduw: de boardroom in werkwoorden, de kamers met hun soort

De meting vooraf: `boardroomAuth` staat op 115 routes, en die ene vlag zet
instellingen, geld, kosten, toegang, partners, export, techniek, De Salon en
Magnaat in een keer open. De 26 kamers hebben geen eigen deur. Ze hangen allemaal
achter `officeAuth`, en er bestaat nergens een toewijzing van mensen aan kamers.
De kamer staat in het lichaam van het verzoek (`id` of `kamer`) en niet in het pad.

- **De gegevens.** `kern/beleidsmotor/werkwoorden.js` deelt de boardroom op in tien
  werkwoorden (toegang, kosten, geld, export, partners, magnaat, techniek,
  toezicht, salon en instellingen). Elk werkwoord heeft een verklaarde trede van
  de gezagsnoemer; alleen `toezicht` staat op `tonen`. Het bestand legt ook per
  kamer de soort vast, uit KANTOORMACHT.md par. 3: 18 bestuurlijk, 1 sociaal en
  7 product. Alleen een bestuurlijke kamer kan een bevoegdheid dragen. Er komt
  geen zesde vocabulaire bij (besluit A1): dit zijn de onderwerpen waaronder de
  motor telt, geen nieuwe rollen.
- **De telling.** Achter de boardroom telt de motor per werkwoord hoe vaak het
  gebruikt werd, en achter de kantoordeur per kamer. Er wordt niet vastgelegd wie
  het deed. Een kamer-id die niet in het register staat telt niet mee, zodat
  invoer van buiten de opslag niet kan laten groeien. De stand
  (`/api/office/beleidsmotor`) toont `werkwoorden`, `kamers` en `zonderWerkwoord`.
- **Getoetst** in `test/beleidsmotor-werkwoorden.test.js`:
  - elke boardroomroute valt onder precies één werkwoord, en elk werkwoord raakt
    minstens één route;
  - de kamersoorten zijn gelijk aan het levende register;
  - elke kamerroute bestaat;
  - tegen een echte server wordt het gebruik geteld, en een geweigerde of
    verzonnen aanroep telt niet.

  Vier mutaties laten de toets zakken: tellen zonder door de poort te zijn
  gegaan, een verzonnen kamer toelaten, een werkwoord zonder route, en de
  kantine bestuurlijk maken.

**Wat nog niet staat, en waarom.** Er is nog geen zetel per werkwoord en geen
toewijzing aan een kamer, en er wordt niets tegengehouden. Wie welk werkwoord
krijgt is een besluit van de eigenaar, en dat hoort op een getal te staan: deze
telling levert dat getal. Afdwingen wacht op fase 2, omdat een werkwoord niet toe
te wijzen is aan de gedeelde code, die geen mens draagt. De uitrol gaat daarna per
kamer en per werkwoord, niet op een percentage (KANTOORMACHT.md). De vier kamers
die het machtsmodel mist (veiligheid, operaties, bestuur en risico) staan er ook
nog niet.

### 5e. Fase 5, de vier ogen: wat dicht is en wat eerst een onderwerp nodig heeft

De meting vooraf: `geld.goedkeuren` wordt door geen enkele route op naam
gecontroleerd. Het Werk OS (`server/bedrijf/`) kent geen factuur, betaling of
inkooporder, en contract, klant en dienstverband leggen niet vast wie ze
aanmaakte (`door` is hooguit een naam, en bij een dienstverband ontbreekt hij
helemaal). De echte goedkeuringen met vier ogen staan elders: de loonrun
(`kern/payroll/run.js`), de uitgaven van RTFOS (`kern/rtfos/geld-uitgaven.js`) en
de beslislaag van de geldketen (`kern/commercie/besluit.js`). Daar zaten twee gaten.

- **Een loonrun werd ondertekend met de gedeelde code.** De administrateur tekende
  achter `officeAuth`, en onder de handtekening stond `onbekend`. Een handtekening
  van niemand geeft geen vier ogen. `/api/office/payroll/run/keur` en `/definitief`
  hangen nu achter `naamAuth`. De naam komt uit de sessie (de codenaam van de mens),
  nooit uit het lichaam. De gedeelde code krijgt 403 met de weg erheen
  (`test/office-payroll-dekking.test.js`).
- **De beslislaag liet de aanvrager zichzelf goedkeuren.** Stap 4 van `beslis()`
  keek alleen of er een `goedgekeurdDoor` was, en niet of dat een ander was. Nu
  telt een goedkeuring door de aanvrager zelf niet als tweede persoon
  (`test/besluit.test.js` toets 7).

Beide zijn met een mutatie nagetrokken: haal de reparatie weg en de toets zakt.

**Wat nog niet staat, en waarom.** De drie conflicten van `scope.js` afdwingen
kan pas als er een ONDERWERP is om ze op af te dwingen. "Je keurt geen betaling
goed aan een relatie die je zelf aanmaakte" vraagt een betaling die in het Werk
OS bestaat en een relatie die haar maker vastlegt, en geen van beide is er. Een
afdwinging over rechten die niemand controleert, zou een schijnbewaker zijn.
Hetzelfde geldt voor een tekengrens per organisatie: `besluit.js` heeft een
globaal beleid, en `kern/concern/graaf-bevoegdheid.js` kent al een tekenlimiet
per bestuurder of volmacht. Die twee aan elkaar hangen is de volgende stap. Dat is
aansluiten en niet uitvinden, en er komt geen derde rechtenmodel bij.

### 5f. Fase 6: lezen is niet exporteren

De meting vooraf ging uit van wat een export DOET, niet van hoe hij heet. Een
kantoorroute die een bijlage meegeeft (`Content-Disposition: attachment`) stuurt
een bestand het huis uit, en dat is daarna niet meer terug te halen. Er zijn er
twee: `/api/office/export.csv` (alle bestellingen, ritten en boekingen met de
codenaam van de klant) en `/api/office/aidata/export` (de complete AI-dataset).
Beide eisen een mens (`kluisAuth` en `boardroomAuth`) en leggen hun spoor vast
VOORDAT de bytes gaan (`inzagelog.noteerVast` en de duurzame `afdelingen.audit`);
lukt dat niet, dan wordt er geweigerd. De andere exports in het huis zijn
zelfexports: een lid of een zaak die de eigen gegevens ophaalt. Dat is geen
kantoormacht.

- **Het register.** `EXPORTEN` in `kern/beleidsmotor/werkwoorden.js` noemt per
  export de poort, het spoor en wat erin zit. Het is geen zesde vocabulaire, maar
  de verklaring waar de beleidsmotor mee telt.
- **De telling.** Een GELEVERDE export telt apart van lezen. Een geweigerde telt
  niet (`/api/office/beleidsmotor`, veld `exporten`).
- **De handhaving.** `test/beleidsmotor-exporten.test.js` zoekt de bijlagen zelf
  op in de BRON, met het commentaar eruit. De toets zakt:
  - bij een kantoorexport die niet in het register staat;
  - bij een verklaarde export die geen bijlage meer geeft;
  - bij een export achter een poort die geen mens eist;
  - bij een register dat een andere poort noemt dan de router.

  Tegen een echte server exporteert de gedeelde code niets. Vier mutaties laten
  de toets zakken, waaronder de boekhoudexport terugzetten achter `officeAuth`.

**Wat dit NIET dekt.** Een JSON-antwoord met een hele collectie is ook bulk, maar
in de bron is dat niet te onderscheiden van een scherm. Een grens daarop vraagt
een gegevensklasse per veld, en die bestaat niet (par. 1.5). Het afschrift van een
lid (`/api/office/bank/afschrift`) blijft achter de gedeelde code: het is lezen,
en ENFORCE_EXECUTE vóór ENFORCE_READ is een besluit (`test/bankdeuren.test.js`).

---

## 6. Bevindingen die niet op het ontwerp hoeven te wachten

| # | bevinding | voorstel | stand |
|---|---|---|---|
| B1 | `/api/office/export.csv` liet geen enkel spoor na | een journaalregel die weigert als hij niet vaststaat (`noteerVast`) | **staat** (23 september 2026; `test/ledenbaliespoor.test.js` toets 8, onder `schrijf-verloren` geen CSV) |
| B2 | `server/kern/appstore/vierogen.js` liet door zonder identiteit (`onbekend`) | weigeren met `geen-identiteit` en de weg eromheen | **staat** (23 september 2026; `test/appstore-vierogen.test.js` toets 0, `test/appstore-persoon.test.js` toets 7: de gedeelde code tekent een persoonlijke inzending niet meer af) |
| B3 | de kantoor- en leveranciersstream toetsten alleen bij het openen | bij elk bericht de sessie en de rechten opnieuw | **staat** (23 september 2026; par. 5b) |
| B4 | `/media/:naam` zonder toegangscontrole, een jaar `public` gecachet | eerst meten wat er staat; privémateriaal achter een korte, ondertekende link | vraagt een besluit |
| B5 | `employment.js` verwees naar een `offboarding.js` die niet bestaat | de verwijzing eerlijk maken | **staat** (verwijst nu naar `verandering-eigendom.js`) |
| B6 | de auditketen is niet extern verankerd | `server/lib/keten-anker.js` in bedrijf nemen | vraagt een besluit (waar) |
| B7 | `/api/office/doc` leverde paspoortscans aan de gedeelde code | op naam, zoals de lijst | **staat** (23 september 2026; gevonden door de A3-meting, par. 5a) |

---

## 7. Besluiten van de eigenaar

**Alle vijf genomen op 23 september 2026, telkens de aanbevolen keuze:** A1
vervangen (geleidelijk, `GEZAG.json` mag alleen dalen), A2 de eigenaar is geen
dagelijkse superuser (stap-op en reden bij gevoelige lezingen, ook voor hem),
A3 default-deny op de draaiende server, eerst in de schaduw, A4 eigen rollen
alleen als bundel van bestaande werkwoorden met een rechtensimulatie vooraf,
en A5 een agent handelt onder een eigen identiteit (`ai:<naam>`) namens een
mens. Wat hieronder staat is de afweging zoals die is voorgelegd; genomen is
niet gebouwd -- de stand per onderdeel blijft in par. 4 en 5.

**A1 -- Vervangt de beleidsmotor de vijf gezagsvocabulaires?**
- **(aanbevolen)** Ja, geleidelijk: elke vocabulaire die verhuist verdwijnt uit
  `GEZAG.json`, en dat getal mag alleen dalen. *Kost:* de motor moet de vijf eerst
  in de schaduw nadoen voordat er een weg kan.
- Nee, de motor komt ernaast. *Kost:* een zesde vocabulaire, precies wat INT-01
  verbiedt.

**A2 -- Blijft de eigenaar een dagelijkse superuser?**
- **(aanbevolen)** Nee. De eigenaar houdt de hoogste bestuursbevoegdheid, maar
  gevoelige lezingen (leden-, HR- en financiële dossiers) vragen ook voor hem een
  stap-op en een reden, en hij krijgt, net als iedereen, benoemingen. *Kost:* meer
  passkeymomenten voor u.
- Ja, de eigenaar blijft overal door. *Kost:* een gestolen eigenaarsessie opent
  alles.

**A3 -- Default-deny op de draaiende server?**
- **(aanbevolen)** Ja, eerst in de schaduw: een route zonder verklaarde poort
  wordt geteld, na rijpheid geweigerd. *Kost:* elke nieuwe route moet een poort
  verklaren.
- Alleen in de toetsen, zoals nu. *Kost:* een route die door de toetsen glipt, staat
  open in productie.

**A4 -- Mogen organisaties eigen rollen maken?**
- **(aanbevolen)** Ja, als bundel van BESTAANDE werkwoorden, nooit met nieuwe
  werkwoorden, en met een rechtensimulatie vóór activering.
- Nee, alleen de vaste pakketten.

**A5 -- Hoe handelt een agent?**
- **(aanbevolen)** Met een eigen identiteit (`ai:<naam>`), namens een mens, en het
  spoor noemt beide. De effectieve bevoegdheid blijft de doorsnede van mens, agent,
  doel en gegevensbeleid. *Kost:* de afspeelweg van `server/kern/stuur.js`, die
  vandaag het token van de gebruiker hergebruikt, moet om.
- Zoals nu: de agent handelt met het token van de gebruiker. *Kost:* in het spoor is
  niet te zien of een mens of Rahul iets deed.

---

## 8. Grenzen

1. **De actor komt uit de sessie, nooit uit het verzoek.** Par. 0 vond zeven
   plekken waar dat niet zo was; `check` hoort er een regel voor te krijgen.
2. **Een benoeming verleent nooit meer dan haar rol**, en een tekengrens versmalt
   alleen.
3. **Niemand benoemt zichzelf** en niemand keurt zijn eigen voorstel, ook de
   eigenaar niet.
4. **Een besluit draagt altijd zijn opbouw.** Een ja zonder "waarom" is een
   orakel.
5. **`ONBEKEND` is geen `WEIGEREN`, en ook geen `TOESTAAN`.** Bij een storing weigert
   een handeling die iets verplaatst; een lezing mag door, met het spoor erbij
   (`besluit.js`, `veiligeUitkomst`).
6. **Een agent kan nooit meer dan de mens namens wie hij handelt**, en geld verlaat
   het huis nooit vanzelf.
7. **Er komt geen score op een mens**, ook geen "risicoscore" op een medewerker
   voor toegangsreviews: een review toont wat iemand MAG en wat hij GEBRUIKT, nooit
   een cijfer.
8. **Geen tabel met alle rechten van alle domeinen.** De motor bezit de grammatica,
   het domein de werkwoorden.
