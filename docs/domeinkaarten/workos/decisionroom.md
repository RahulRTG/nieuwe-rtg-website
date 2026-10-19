# Decision Room (link:decisionroom)

**Volledige werkzaamheid:** een medewerker op naam legt een voorstel neer, de mensen met de juiste rol (nooit de aanvrager zelf) beslissen het met reden, met één of twee stemmen volgens de regel, en het besluit geeft het gekoppelde project vrij; Decision Room doet volledig waarvoor het er is als geen voorstel doodloopt (een teruggestuurd voorstel kan als nieuwe versie terug), als elke voorwaarde bij akkoord als controleerbaar punt in de uitvoering staat, en als elk besluit met stemmen en redenen terug te lezen is.

Eigenaar: `werk.besluit` (SCHERMEIGENAAR.json, rol eigenaar, doelgroep kantoor).
Ingang: `/apps/decision-room.html`, achter de werkrol "kantoor". Doel volgens het
register: "Besluiten voor het bedrijf agenderen, afwegen en met de reden
vastleggen." In de praktijk is het bedrijf nu RTG of de RTFoundation zelf.

Opgesteld op 19 oktober 2026 op tak `appwerkt/workos`; herzien dezelfde avond na
het oordeel "deels". Dit is een kaart en geen bouwopdracht.

## a. Inventaris van het bewezen bestaande

**Wat er staat**

| Laag | Pad | Inhoud |
|---|---|---|
| Scherm | `public/apps/decision-room.html` + `decision-room.js`, `-agenda.js`, `-afweging.js`, `-besluit.js` | vier panelen: Besluiten (agenda), Afweging, Vastleggen, Archief; intake-dialoog |
| Routes | `server/routes/rtgone.js` | `/api/rtgone/state`, `/api/rtgone/goedkeuring`, `/api/rtgone/goedkeuring/beslis`, `/api/rtgone/rol/geef`, `/rol/trek`; alle achter `officeAuth` |
| Kern | `server/kern/rtgone-bestuur.js` | rollencatalogus, 8 besluittypen, vier-ogenregel, koppeling naar het project |
| Herhaling | `server/kern/rtgone-idem.js` | een voorstel met dezelfde sleutel staat er één keer |
| Opslag | `db.data.rtgOne.goedkeuringen` | object `dec-` |
| Toetsen | `test/decision-room.test.js`, `test/rtgone.test.js` (toets 8 raakt het goedgekeurde besluit) | |
| Voltooiproef | `scripts/lib/voltooi/decisionroom.js` | drie mensen: aanvrager, beoordelaar met rol, eigenaar |

**Het besluitobject `dec-`**: `type` (finance, legal, privacy, security,
safeguarding, operations, people, ai), `titel`, `reden`, `waaromNu`,
`alternatief`, `beheersing`, `deadline`, `bedrag` (euro, 0 tot 100 miljoen),
`impact` en `risico` (1-5), `omkeerbaar`, `vereist` (1 of 2), `status`,
`projectId`, `documentId`, `documentTitel`, `bronMailId`, `aanvrager`, `stemmen[]`.

**Regels in de code**

- Twee stemmen als bedrag ≥ 10.000, impact ≥ 4, risico ≥ 4 of niet omkeerbaar; anders één.
- De aanvrager beoordeelt zijn eigen voorstel nooit (403).
- Beoordelen vraagt een persoonlijke sleutel en het recht `besluit:<type>`;
  de eigenaar (baas) heeft alle rechten.
- Eén stem per persoon. Keuzes: goedkeuren, afwijzen, terug.
- Afwijzen of terug sluit het besluit direct (`afgewezen` of `aanpassen`).
  Het scherm zegt dat ook: "Het voorstel sluit als aanpassen; de aanvrager ziet
  waarom" (`decision-room-besluit.js` r. 23).
- Bij genoeg goedkeuringen: status `goedgekeurd`; het gekoppelde project gaat naar
  `uitvoering` en krijgt de taak "Besluit uitvoeren". Sinds 1fc43c1 blijft het
  project daarna in `uitvoering` als er taken worden afgevinkt.
- Indienen kan buiten productie met de gedeelde kantoorcode; `aanvrager` wordt
  dan `legacy:kantoor` (`rtgone-bestuur.js`).

**Wat BEWEZEN is**

| Bewijs | Stand | Bron |
|---|---|---|
| bereikbaar, bedienbaar, waarheidsgetrouw | BEWEZEN | APPWERKT.json |
| menselijk | NIET_GETEST centraal; lokaal afgeleid 3/3 | APPWERKT.json; verse proef |
| voltooibaar | GEEN_FIXTURE centraal; lokaal 6/6 | VOLTOOIPROEF.json (04:47, f85c044e); verse proef 19-10, dc501544 |
| persistent | GEEN_FIXTURE; lokaal 3/3 | idem |
| herstelbaar | GEEN_FIXTURE; lokaal 4/4 | idem |
| bevoegd | NIET_GETEST | BEVOEGD.json |

Formulering: voltooiproef lokaal gesloten 4/4 (19-10, dc501544), centraal nog te
stempelen. De proef toont: een voorstel van € 25.000, de aanvrager mag niet
zelf, B zonder rol mag niet, B met Finance stemt, de eigenaar stemt als tweede,
een gesloten besluit kan niet opnieuw, en na herstart en crash staat alles één keer.

**Wat het scherm belooft maar de code niet doet**

- "Rol, keuze, reden en tijdstip worden onveranderlijk aan de beoordeling
  toegevoegd" (`decision-room-besluit.js` r. 8). De stem zelf blijft in
  `stemmen[]` staan, maar er is geen hashketen en de auditregel erover valt na
  500 regels weg (`kern/rtgone.js` r. 26).
- Het veld "Voorwaarde bij akkoord" (`decision-room-besluit.js` r. 26) wordt
  opgeslagen in `stem.voorwaarde` en verder nergens gelezen.
- De keuze heet "Terug voor aanpassing", maar er is geen weg terug: het besluit
  sluit en het gekoppelde project blijft op `besluit` staan.

**Niet gevonden in de code**

- Wijzigen of intrekken van een voorstel.
- Een budgetobject, afhankelijkheden tussen besluiten.
- Een evaluatiedatum, een bezwaar dat blijft staan, een belangverklaring.
- Aansluiting op `server/bedrijf/besluit.js` (het besluit van de ondernemer) of
  op `server/kern/rtfos/bestuur.js` (bestuur van de stichting met quorum en notulen).
- Het besluitdossier (OFFICE.md P13: "staat in stukken"; fase 4 "een stap weg").

**De contantregel** van € 3.000 is uit deze kaart gehaald (commit 5ca86af) en
staat in `docs/domeinkaarten/workos.md` par. 11. Hij komt hier niet terug, ook
niet als signaal, tot een mens de primaire bron heeft nagelezen.

## b. Marktvergelijking

Echte merken alleen ter vergelijking. Elke regel komt uit een zoeksamenvatting
en is **(te controleren)**.

| Leider | Wat achter de betaalmuur zit | Hebben wij het | Bron (19-10-2026) |
|---|---|---|---|
| Diligent Boards / Diligent One (offerte) | AI-agenda en boardbook, AI-notulen, stemmen met e-sign, Smart Builder, Risk Scanner | half: agenda, afweging en stemmen met reden; geen boardbook, geen notulen, geen e-sign | **(te controleren)** https://www.diligent.com/products/boards en https://www.diligent.com/platform/diligent-one (via zoektool, live te controleren) |
| Azeus Convene Standard / Enterprise (£195 p.p.p.j. via G-Cloud) | besluiten, review rooms, auditsporen, taken; werkruimtes; AI apart | half: besluit, auditregels, taak naar project; geen review room per document | **(te controleren)** https://www.azeusconvene.com/pricing (via zoektool, live te controleren) |
| Nasdaq Boardvantage (offerte) | entiteitenbeheer, D&O-vragenlijsten | nee; entiteiten wonen in Concern (`kern/concern/`), niet hier | **(te controleren)** https://www.nasdaq.com/solutions/governance/boardvantage/features (via zoektool, live te controleren) |
| BoardEffect Pro / Plus | AI-samenvatting, auditlog, SSO; onbeperkt besturen, notulen | half: auditlog afgekapt op 500 | **(te controleren)** https://www.boardeffect.com/pricing/ (via zoektool, live te controleren) |

Wat de markt niet heeft: een besluit dat in hetzelfde huis het project
vrijgeeft, met de bronmail en het document als verwijzing, en een regel in code
dat de aanvrager nooit zelf beslist.

## c. Analyse van het volledige domein

**Hoe besluiten echt werken**

- *Particulier.* Persoonlijke keuzes hebben geen formele besluitvorming. Waar een
  lid samen met anderen beslist (gezin, VvE), hoort dat bij een andere eigenaar:
  een VvE stemt naar breukdeel met quorum (Wonen, CIVILIS par. 5B); dat is niet
  van Decision Room.
- *Professioneel.* Een zzp'er beslist alleen. Een maatschap of praktijk beslist
  met vennoten; dat valt onder Werk OS (`bedrijf/besluit.js`).
- *Organisatie.*
  - BV: bestuur en aandeelhouders, met besluiten in of buiten vergadering.
  - Stichting: quorum, belangenverstrengeling, notulen in de volgende vergadering
    vastgesteld. Dat bestaat in `server/kern/rtfos/bestuur.js` en
    `bestuur-notulen.js` voor de RTF.
  - Concern: besluiten per entiteit; entiteiten in `kern/concern/`, bestuur en
    aandeelhouders van een onderneming in `kern/onderneming/bestuur.js`.
  - Intern management (RTG zelf): besluiten per vakgebied met vier ogen. Dat is
    wat Decision Room nu doet.

**Wettelijke en normatieve eisen.** Geen primaire tekst is voor deze kaart zelf
gelezen; elke regel is **(te controleren)** en wordt hooguit een signaal, nooit
een weigerregel.

| Eis | Bron | Betekenis |
|---|---|---|
| Besluit buiten vergadering: alle vergadergerechtigden stemmen in, elektronisch mag, bestuurders hebben raadgevende stem (art. 2:238 BW) **(te controleren)** | https://www.dirkzwager.nl/kennis/artikelen/raadgevende-stem-van-de-bestuurder-ook-buiten-vergadering | Raakt een AVA-besluit, niet het interne vier-ogenbesluit van RTG. Decision Room telt nu 1 of 2 stemmen en kent geen kring. Een notulenplicht is te controleren. |
| Fiscale bewaarplicht 7 jaar (art. 52 AWR) **(te controleren)** | https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/ondernemen/administratie/hoelang-moet-u-gegevens-bewaren | Een financieel besluit dat een boeking onderbouwt, hoort lang leesbaar te blijven. Gevolg voor software tot nalezing: niets wissen, geen wisregel. |
| Aanbestedingsdrempels 2026-2027 (€ 140.000, € 216.000, € 5.404.000) **(te controleren)** | https://www.pianoo.nl/nl/regelgeving/drempelbedragen-europees-aanbesteden | Geldt voor aanbestedende diensten. Of RTF of RTG dat zijn: niet vastgesteld. Alleen relevant als signaal bij het bedrag. |
| ISO 9001 9.3 directiebeoordeling; 10.2 corrigerende maatregelen **(te controleren)** | https://www.lrqa.com/en/latest-news/iso-9001-publication-date-confirmed/ | Normatief: een besluit met een evaluatiedatum is de directiebeoordeling in klein. Versie 2026 en de nummers zijn niet geverifieerd. |
| AVG art. 30 en art. 12 **(te controleren)** | https://autoriteitpersoonsgegevens.nl/nl/zelf-doen/gebruik-uw-privacyrechten/recht-op-inzage | Een stem met naam en reden is een persoonsgegeven; een betrokkene mag haar inzien. |

**Wat dat betekent voor software.** Een besluit heeft een **kring** (wie mag
stemmen), een **regel** (één, twee, alle, meerderheid, quorum), een **belang**
per stemmer, een **dossier** (stukken, cijfers, bezwaren, uitvoering), een
**bewaarklasse** en een **evaluatie**. De regels bestaan al in drie motoren:
`rtgone-bestuur.js` (vier ogen), `bedrijf/besluit.js` (advies, bezwaar,
evaluatie) en `rtfos/bestuur.js` (quorum, belang, notulen). Een vierde motor komt
er niet. Een wettelijke grens uit c. komt alleen als signaal "te controleren" op
het scherm.

## d. Functiecatalogus L1–L6

In de kolom Bak staat "nu · herstel" voor een fout of een belofte die de code
niet waarmaakt, en "nu · verdieping" voor nieuwe diepte binnen de huidige scope.

### L1 Persoonlijk

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Mijn besluitagenda op recht | half, `decision-room-agenda.js` toont alles in het huis | `goedkeuringen` met status `wacht`, `rechtenVoor` | eerst wat ik mag beoordelen en nog niet beoordeelde; daarna "ter informatie"; mijn eigen voorstellen apart | geen | beoordelaar bij openen | officeAuth | geen | Bovenaan staat alleen wat ík mag en nog moet beoordelen | klein | nu · verdieping |
| Mijn voorstellen en hun stand | half (archief toont alles) | `aanvrager` = mijn sleutel | per voorstel: stemmen tegen `vereist`, wie nog mag, verloopt de deadline | geen | aanvrager bij elke stem | aanvrager | geen | Ik zie per voorstel "1 van 2 stemmen, nog nodig: iemand met Finance of de eigenaar" | klein | nu · verdieping |
| Melding bij een stem of besluit | ontbreekt | stemmen | bericht naar de aanvrager via RT Mail | geen | aanvrager, direct | aanvrager | geen | Na elke stem krijgt de aanvrager één bericht met de reden | klein | later |

### L2 Professioneel

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Voorstel alleen op naam | half; buiten productie mag de gedeelde kantoorcode indienen (`legacy:kantoor`) | sessie | indienen alleen met persoonlijke sleutel (`naamAuth` in `kern/kantoor/kluispoort.js`) | geen | | persoonlijke sleutel | in productie is de code al dicht (productiedeur B10) | Zonder eigen account kan niemand een voorstel indienen, ook niet in de demo; anders kan niemand de vier-ogenregel controleren | klein | nu · herstel |
| Herindienen na "terug" | ontbreekt; het scherm noemt het "terug voor aanpassing" | gesloten besluit met `aanpassen` | nieuw voorstel met `vorigeId`; oude stemmen en redenen blijven zichtbaar; het project volgt het nieuwe id en gaat van `besluit` weer naar de besluitroute | geen | eerdere beoordelaars | aanvrager | alleen na `aanpassen`, niet na `afgewezen` | Na "terug" kan de aanvrager een aangepaste versie indienen en het project loopt weer | klein | nu · herstel |
| Voorwaarde bij akkoord bewaken | half (opgeslagen, nergens gelezen) | `stem.voorwaarde` | een voorwaarde wordt een taak in het gekoppelde project met de beoordelaar als aftekenaar; zonder project een belofte in RTG One op naam van de aanvrager | of de voorwaarde toetsbaar is | projecteigenaar en beoordelaar | beoordelaar tekent af | voorwaarde leeg: niets | Het project levert niet op zolang een voorwaarde niet is afgetekend door wie hem stelde | middel | nu · herstel |
| Belangverklaring per beoordelaar | ontbreekt | stem | wie een belang meldt, telt niet als goedkeurende stem (regel uit `rtfos/bestuur.js`); zijn reden blijft zichtbaar | of iemand zijn belang meldt | aanvrager, auditor | beoordelaar | geen | Een beoordelaar met belang kan reden geven maar zijn stem telt niet mee voor `vereist` | klein | nu · verdieping |
| Evaluatiedatum op een goedgekeurd besluit | ontbreekt | besluit | verplicht bij de beslissende stem, in de toekomst (regel uit `bedrijf/besluit.js`) | geen | aanvrager op de datum, via Vandaag van RTG One | aanvrager | afgewezen besluiten niet | Elk goedgekeurd besluit heeft een terugkijkdatum en verschijnt dan in de werkdag | klein | nu · verdieping |

### L3 Organisatorisch

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Rollen per besluittype | bestaat | `rtgOne.rollen` | baas geeft en trekt | geen einddatum; intrekken wist de rij | | baas | | | | bestaat; einddatum en historie: zie rtgone.md V4 |
| Onveranderlijk spoor zoals het scherm belooft | half; stemmen staan in een lijst zonder hash, audit afgekapt | stemmen, besluiten | elke stem en elke statusovergang als regel in `kern/auditboek/` (hashketen) | geen | auditor | `audit:lees` | | Een gewijzigde stem in de opslag valt op bij de hashcontrole, en de eerste stem staat er na 600 handelingen nog | middel | nu · herstel |
| Drempels als beleid | half; hard in code (10.000, 4, 4) | `rtgone-bestuur.js` | drempels per huis instelbaar door de baas, met spoor; een wijziging geldt alleen voor nieuwe voorstellen | geen | executive | baas | ondergrens: nooit minder dan 1 stem van een ander | De eigenaar kan de drempel per huis verlagen of verhogen en ziet in het spoor wie dat deed | klein | later |
| Besluitregister met filter en export | half (archief) | gesloten besluiten | filter op type, huis, periode; export CSV via de uitgangspoort | geen | auditor | `audit:lees` | strikt geclassificeerd niet exporteren | De auditor exporteert alle finance-besluiten van een jaar met stemmen en redenen | middel | later |
| Doorlooptijd per besluittype | ontbreekt | `at`, `beslotenAt`, `type` | mediaan in dagen per type over gesloten besluiten; vanaf 5 besluiten; nooit per beoordelaar | weinig besluiten | executive | `audit:lees` of baas | minder dan 5: "te weinig om te rekenen" | De eigenaar ziet "finance: mediaan 3 dagen (12 besluiten)" en geen ranglijst op mensen | klein | nu · verdieping |

### L4 Domeinintelligentie

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Compleetheid van het dossier | bestaat, `compleet()` in de agenda | 5 velden | aantal ingevulde velden | geen | beoordelaar | | | | | bestaat |
| Gevolg van een financieel besluit | ontbreekt | bedrag, termijn | `kern/fiscaal/scenario.js` of `kern/kosten/vooruitblik.js`, klasse `advies` met `aannames` en `onbekend` | alles wat geen boeking is | beoordelaar vóór stemmen | finance | zonder bron: "niet gerekend" | Het scherm toont het verwachte effect met aannames en de zin van klasse `advies`, nooit als vaststaand bedrag | middel | later |
| Signaal bij een wettelijke grens | ontbreekt | bedrag | aanbestedingsdrempel als signaal "te controleren", nooit blokkerend (de contantregel staat op "te controleren", workos.md par. 11) | of de aanbestedingsplicht geldt | aanvrager bij indienen | | | Een voorstel boven een aanbestedingsdrempel draagt een signaal met de bron en het label "te controleren"; het blokkeert niet | klein | later |
| Frictie als onderbouwing | ontbreekt | `frictieId` uit RTG One | naam en jaarbedrag met klasse `advies` in de afweging | de schatting | beoordelaar | aanvrager kiest | frictie van een ander huis niet | Een voorstel toont de frictie als schatting, met wie haar vastlegde | klein | nu · verdieping |
| AI vat het dossier samen | ontbreekt | velden, document, mail | lokaal-eerst; "Rahul ordent, niet beslist" staat al op het scherm | wat het document bedoelt | beoordelaar | AI kan niet stemmen | `RTG_EXTERNE_AI_UIT=1` | De samenvatting noemt haar bronnen; er is geen knop waarmee AI stemt | middel | later |

### L5 Volledige levenscyclus

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Intrekken door de aanvrager | ontbreekt | status `wacht` | `ingetrokken` met reden, alleen zolang er geen besluit is; een gekoppeld project gaat naar `in-voorbereiding` | geen | beoordelaars | aanvrager | een al gegeven stem blijft zichtbaar | Een voorstel dat niet meer nodig is, staat in het archief als ingetrokken met reden | klein | nu · verdieping |
| Deadline van het besluit | half (opgeslagen) | `deadline` | verlopen = vandaag (Europe/Amsterdam) > deadline; signaal in agenda | geen | beoordelaars | | | Een voorstel na zijn gewenste datum staat bovenaan met "2 dagen over de datum" | klein | nu · verdieping |
| Evaluatie en herzien | ontbreekt | evaluatiedatum | op de datum: "klopte het?" met vrije tekst; geen nieuwe stem | geen | aanvrager, beoordelaars | | | Op de evaluatiedatum legt de aanvrager vast of het besluit uitpakte zoals bedoeld | klein | nu · verdieping |
| Bewaarklasse finance | ontbreekt | type finance | termijn door een mens vastgesteld (signaal nu: 7 jaar, te controleren); tot dan wordt niets gewist | de termijn | privacyrol | | | Een finance-besluit toont zijn bewaarklasse, en zolang die "te controleren" is, wordt het nooit gewist | klein | later |

### L6 RTG-samenhang

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Besluit → project | bestaat; sinds 1fc43c1 blijft het besluit gelden | `projectId` | goedkeuring zet project op uitvoering | geen | projecteigenaar | | | | | bestaat |
| RTDocs → voorstel | bestaat (`?document=`) | `documentId` | verwijzing | geen | | rechten van het document | | | | bestaat |
| Besluitdossier (P13) | ontbreekt | besluit, document, mail, project, stemmen | read-only projectie; geen kopie; elk stuk met bron | een bron die uitvalt staat als "niet beschikbaar" | beoordelaar, auditor | rechten van elk stuk afzonderlijk | | Eén pagina toont alle stukken van het besluit met hun bron, zonder ze te kopiëren | middel | nu · verdieping |
| Decision Room als scherm op `bedrijf/besluit.js` | ontbreekt | `w.besluiten` van een werkruimte | dezelfde schermcomponenten, motor en opslag blijven van Werk OS | | | `werkPoort(...,'besluit')` | | Een ondernemer opent Decision Room en ziet zijn eigen besluiten met advies, bezwaren en evaluatie, opgeslagen in Werk OS | middel | vraagt besluit |

### Modus LOS

De kerntaak zonder andere apps: voorstel indienen, afwegen, stemmen met reden,
archief. Bronverwijzingen blijven als tekst staan ("bronbericht …",
"project …"). Het scherm zegt nu niet dat een bron niet bereikbaar is; het toont
alleen het id. Letterlijke schermtekst (u-vorm, zakelijk):

**Eigen (altijd).** Voorstel, afweging, stem, archief, rollen per besluittype.
Lege agenda:
> "Er ligt geen besluit dat u mag beoordelen. Uw eigen voorstellen staan onder Archief."

**Noodzakelijke platformdiensten.**

| Dienst | Waarvoor | Schermtekst als hij ontbreekt |
|---|---|---|
| Kantoorsessie op naam (officeAuth, productiedeur B10) | elke route | "U bent niet op naam aangemeld. Zonder naam kan niemand nagaan wie dit besluit nam." |
| Persoonlijke sleutel | stemmen, indienen (na herstel) | "Stemmen kan alleen op naam. Meld u aan met uw eigen account." |
| Rollen (`rtgOne.rollen`) | recht per besluittype | "Uw rol mag dit type besluit niet beoordelen. De eigenaar kan u de rol geven." |
| Opslag en herhaalsleutel | indienen en stemmen | "Uw stem is niet opgeslagen. Er is niets dubbel vastgelegd; probeer het opnieuw." |
| Auditboek (na herstel) | onveranderlijk spoor | "Het spoor kan nu niet worden bijgeschreven; daarom is uw stem niet doorgevoerd." |

**Optionele koppelingen.**

| App | Wat hij levert | Schermtekst als hij uit staat |
|---|---|---|
| RTDocs (`docs.office`) | het stuk bij het voorstel | "RTDocs is niet bereikbaar; het document is niet geopend. U beslist op de tekst van het voorstel." |
| RT Mail (`comm.mail`) | de bronmail | "Het bronbericht is niet te openen; alleen het kenmerk staat hier." |
| Project Room (`werk.project`) | uitvoering na akkoord | "Project Room is niet bereikbaar; het besluit is vastgelegd en geeft het project vrij zodra het weer bereikbaar is." |
| RTG One (`werk.rtgone`) | frictie, evaluatie in de werkdag | "De frictie uit RTG One is niet te lezen; de onderbouwing staat alleen als tekst." |

### Modus SAMEN: een document dat een investering vraagt

1. Een medewerker schrijft in RTDocs een notitie en kiest "Voorleggen". Decision
   Room opent de intake met `?document=…&titel=…`.
   - *Storing:* de medewerker heeft geen kantoorrol. Hij wordt naar
     `/apps/rtgkantoor.html` gestuurd; er is niets ingediend.
2. Hij vult € 25.000, type finance, omkeerbaar uit. Het voorstel vraagt twee stemmen.
   - *Storing:* dubbele tik of verbinding valt weg. Met dezelfde herhaalsleutel
     staat er één voorstel (voltooiproef herstelbaar 4/4).
3. Collega B heeft nog geen rol Finance en krijgt 403 "Uw rol mag dit type
   besluit niet beoordelen". De eigenaar geeft B de rol.
4. B stemt akkoord met de voorwaarde "alleen na tweede offerte". Het besluit wacht.
   - *Storing:* B tikt twee keer. De tweede krijgt "U hebt dit besluit al beoordeeld".
5. De eigenaar stemt als tweede. Het besluit is goedgekeurd; een gekoppeld project
   gaat naar uitvoering en blijft daar bij het afvinken (gerepareerd, 1fc43c1).
   - *Storing:* de voorwaarde van B wordt nergens bewaakt; het project kan
     opleveren zonder tweede offerte. Bewaard: de voorwaarde als tekst in de stem.
     Herstel H3.
6. Variant: de eigenaar kiest "terug voor aanpassing".
   - *Storing:* het besluit sluit op `aanpassen` en er is geen weg terug. Het
     gekoppelde project blijft op `besluit` hangen. Bewaard: alles, maar
     doodlopend. Herstel H2.
7. Na herstel: de aanvrager dient versie 2 in met `vorigeId`; de eerdere stemmen
   staan erbij, het project volgt het nieuwe besluit.
   - *Storing:* de aanvrager dient versie 2 twee keer in. Herhaalsleutel: één versie.

**Contract SAMEN (voorstel; `scripts/lib/appcontract.js` is niet gewijzigd).**

```js
samen: {
  functie: 'link:decisionroom', familie: 'WorkOS',
  belofte: 'een medewerker op naam legt een voorstel neer, mensen met de juiste rol beslissen het met reden, nooit de aanvrager zelf; een teruggestuurd voorstel komt als nieuwe versie terug en een voorwaarde bij akkoord houdt de oplevering tegen tot ze is afgetekend',
  ingang: '/apps/decision-room.html',
  bestanden: ['public/apps/decision-room.html', 'public/apps/decision-room.js', 'public/apps/decision-room-agenda.js',
    'public/apps/decision-room-afweging.js', 'public/apps/decision-room-besluit.js',
    'server/routes/rtgone.js', 'server/kern/rtgone-bestuur.js', 'server/kern/rtgone-idem.js'],
  scenario: 'scripts/lib/voltooi/decisionroom.js',
  ketens: [
    { naam: 'document wordt voorstel', uitgeeft: 'niets', ontvangt: 'documentId en documentTitel uit RTDocs',
      vorm: 'verwijzing', eigenaar: 'docs.office', toestemming: 'de rechten van het document zelf',
      storingen: ['RTDocs uit: "het document is niet geopend"', 'geen kantoorrol: naar /apps/rtgkantoor.html, niets ingediend'],
      proef: 'niet gevonden' },
    { naam: 'besluit geeft project vrij', uitgeeft: 'status goedgekeurd en taak "Besluit uitvoeren"', ontvangt: 'projectId',
      vorm: 'gebeurtenis', eigenaar: 'werk.project', toestemming: 'alleen bij genoeg stemmen van rolhouders, nooit de aanvrager',
      storingen: ['"terug" laat het project hangen (open, H2)', 'voorwaarde niet bewaakt (open, H3)'],
      proef: 'scripts/lib/voltooi/projectroom.js; test/rtgone.test.js toets 8' },
    { naam: 'frictie onderbouwt voorstel', uitgeeft: 'niets', ontvangt: 'frictieId met jaarbedrag (klasse advies)',
      vorm: 'verwijzing', eigenaar: 'werk.rtgone', toestemming: 'aanvrager kiest; zelfde huis',
      storingen: ['RTG One uit: onderbouwing alleen als tekst'], proef: 'niet gevonden' },
    { naam: 'evaluatie in de werkdag', uitgeeft: 'evaluatiedatum', ontvangt: 'niets',
      vorm: 'projectie', eigenaar: 'werk.rtgone', toestemming: 'alleen de aanvrager ziet zijn evaluatie',
      storingen: ['RTG One uit: evaluatie staat alleen in het archief'], proef: 'niet gevonden' }
  ]
}
```

## e. RTG-exclusieve mogelijkheden

| Mogelijkheid | Eigenaar | Capability | Waarom geen markt-app dit kan |
|---|---|---|---|
| Besluit met één klik van mail of document naar uitvoering, met de bron bewaard | Decision Room (besluit); RT Mail, RTDocs, Project Room (verwijzingen) | `werk.besluit`, `docs.office`, `comm.mail`, `werk.project` | Boardportals staan los van mail en projectwerk; hier is het één huis met één identiteit. |
| Een voorwaarde bij akkoord die de oplevering in code tegenhoudt | Decision Room (voorwaarde); Project Room (oplevering) | `werk.besluit`, `werk.project` | In een boardportal is een voorwaarde een notitie; hier weigert de server de oplevering. |
| Besluit dat een frictie in euro's als onderbouwing draagt | Decision Room; RTG One | `werk.besluit`, `werk.rtgone` | De frictie is door de medewerker zelf gemeten in hetzelfde systeem. |
| Eén schermtaal voor drie soorten besturen (RTG intern, ondernemer, stichting) zonder vierde motor | Decision Room (scherm); Werk OS, Foundation OS (motoren) | `werk.besluit`, `werk.organisatie` | Een markt-app verkoopt per doelgroep een apart product. Vraagt besluit. |

## f. Bouwstenen en ontbrekende koppelingen

**Bestaande modules**

- `server/kern/rtgone-bestuur.js`: de vier-ogenregel.
- `server/bedrijf/besluit.js`, `besluitlijst.js`, `besluit-loop.js`, `geheugen.js`,
  `regelpoort.js`: advies, bezwaar, evaluatie, "waarom deden we dit".
- `server/kern/rtfos/bestuur.js`, `bestuur-notulen.js`: quorum, belang, notulen.
- `server/kern/onderneming/bestuur.js`: bestuurders en aandeelhouders.
- `server/kern/kantoor/kluispoort.js` (`naamAuth`), `server/kern/kantoor/tweedehandtekening.js`,
  `server/kern/appstore/vierogen.js`.
- `server/kern/auditboek/` voor het onveranderlijke spoor.
- `server/kern/stuur/goedkeuring.js`, `bevestiging.js`.
- `server/kern/tijdzone.js` voor de deadline in Europe/Amsterdam.

**Ontbrekende koppelingen**

| Van | Naar | Vorm | Toestemming |
|---|---|---|---|
| goedkeuring en stem | auditboek | gebeurtenis met hash | geen extra |
| stem.voorwaarde | project-taak of RTG One-belofte | gebeurtenis → taak | beoordelaar tekent af |
| besluit `aanpassen` | nieuw voorstel met `vorigeId`; project volgt | gebeurtenis | aanvrager |
| besluit | dossierpagina | projectie over RTDocs, RT Mail, project | rechten per stuk |
| Decision Room-scherm | `bedrijf/besluit.js` | scherm op bestaande routes | `werkPoort` van Werk OS |
| Decision Room-scherm | `rtfos/bestuur.js` | scherm op bestaande routes | Foundation OS |

## g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| H1 Voorstel alleen op naam | klein | laag | `naamAuth` | nu · herstel |
| H2 Herindienen na "terug" met `vorigeId`; project volgt | klein | laag | `rtgone-projecten.js` | nu · herstel |
| H3 Voorwaarde bij akkoord wordt aftekenbare taak | middel | middel | Project Room, RTG One | nu · herstel |
| H4 Onveranderlijk spoor via auditboek | middel | middel | `kern/auditboek/` | nu · herstel |
| H5 BEVOEGD-telling voor `/goedkeuring*` en `/rol/*` | klein | laag | `scripts/bevoegdronde.js` | nu · herstel |
| V1 Agenda op recht en "mijn voorstellen" met wat nog nodig is | klein | laag | `rechtenVoor` | nu · verdieping |
| V2 Belangverklaring | klein | laag | regel uit `rtfos/bestuur.js` | nu · verdieping |
| V3 Evaluatiedatum en evaluatie | klein | laag | RTG One Vandaag | nu · verdieping |
| V4 Intrekken en deadline-signaal | klein | laag | `kern/tijdzone.js` | nu · verdieping |
| V5 Besluitdossier als projectie (P13) | middel | middel | RTDocs-rechten | nu · verdieping |
| V6 Doorlooptijd per besluittype | klein | laag | `beslotenAt` | nu · verdieping |
| V7 Frictie als onderbouwing | klein | laag | rtgone.md H5 | nu · verdieping |
| Drempels als beleid per huis | klein | laag | | later |
| Register met export | middel | middel | uitgangspoort | later |
| Gevolg van een financieel besluit (L4) | middel | middel | scenario-engine | later |
| Melding bij elke stem via RT Mail | klein | laag | RT Mail | later |
| Scherm op `bedrijf/besluit.js` en `rtfos/bestuur.js` | middel | middel | besluit 1 en 2 | vraagt besluit |
| Eigen e-sign of notulenmodule in Decision Room | groot | hoog | | niet doen: notulen bestaan in `rtfos/bestuur-notulen.js`; tekenweg is AFSPRAAK-werk |
| AI die stemt of besluit | | | | niet doen: huisregel |

## h. Toetsbaar eindcontract Beyond Premium

Dit contract vervangt de acht bewijzen van APPWERKT nooit.

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| 1. Breedte | Indienen, herindienen, intrekken, stemmen, aftekenen van een voorwaarde en evalueren hebben elk een knop en een route | `scripts/schermen.js` | half: herindienen, intrekken en aftekenen ontbreken |
| 2. Professionele diepte | Een belanghebbende stem telt niet; een voorwaarde houdt de oplevering tegen; een wettelijke grens verschijnt alleen als signaal "te controleren" | `node --test` per regel | ontbreekt |
| 3. Levenscyclus | Een besluit doorloopt indienen → stemmen → besluit → evaluatie, en "terug" leidt tot een nieuwe versie waar het project op verder gaat | voltooiproef `decisionroom`, uitgebreid | half: zakt op "terug" |
| 4. Samenwerking en rollen | Aanvrager, rolloze collega, gedeelde kantoorcode, lid zonder kantoorrol en uitgelogd worden geweigerd | voltooiproef stap 2 en 6; BEVOEGD | voltooiproef lokaal ja; code mag nog indienen; BEVOEGD NIET_GETEST |
| 5. Domeinintelligentie | Elk verwacht gevolg draagt klasse `advies` met `onbekend`; geen telling onder de vijf; AI stemt nooit | test op zekerheid; geen stemroute voor AI | geen gevolg op het scherm |
| 6. Los functioneren | Met RTDocs, RT Mail en Project Room uit kan men stemmen en toont het scherm de teksten uit Modus LOS | proef met koppelingen uit | half |
| 7. RTG-ketens | Document → voorstel → twee stemmen met voorwaarde → project in uitvoering → voorwaarde afgetekend → oplevering, ook via "terug" | ketenproef naar `scripts/ritproef.js` | half: zakt op "terug" en op de voorwaarde |
| 8. Bewezen betrouwbaarheid | Alle acht bewijzen centraal BEWEZEN | APPWERKT.json | 3 van 8; 4 lokaal gesloten |

## Twee uitkomsten

### (A) Binnen de huidige architectuur en scope

**HERSTEL**

| Functie | Kosten | Bouwt op | Stand |
|---|---|---|---|
| H1 Voorstel alleen op naam (geen `legacy:kantoor`) | klein | `kern/kantoor/kluispoort.js` | open |
| H2 Herindienen na "terug" met `vorigeId`; het project volgt | klein | `rtgone-bestuur.js`, `rtgone-projecten.js` | open (workos.md par. 9) |
| H3 Voorwaarde bij akkoord wordt een aftekenbare taak | middel | `rtgone-projecten.js`, RTG One | open (workos.md par. 9) |
| H4 Onveranderlijk spoor zoals `decision-room-besluit.js` r. 8 belooft | middel | `kern/auditboek/` | open |
| H5 BEVOEGD-telling | klein | `scripts/bevoegdronde.js` | open |
| Goedgekeurd besluit blijft gelden voor het project | klein | `kern/rtgone-projecten.js` | gerepareerd (commit 1fc43c1, `test/rtgone.test.js` toets 8) |
| Contantregel uit de kaart | | `workos.md` par. 11 | verwijderd (commit 5ca86af); komt niet terug |

**VERDIEPING**

| Functie | Kosten | Bouwt op |
|---|---|---|
| V1 Agenda op recht; "mijn voorstellen" met wat nog nodig is | klein | `rechtenVoor`, `decision-room-agenda.js` |
| V2 Belangverklaring | klein | regel uit `rtfos/bestuur.js`, overgenomen als regel, niet als motor |
| V3 Evaluatiedatum en evaluatie in de werkdag | klein | regel uit `bedrijf/besluit.js`; RTG One Vandaag |
| V4 Intrekken en deadline-signaal | klein | `rtgone-bestuur.js`, `kern/tijdzone.js` |
| V5 Besluitdossier als projectie | middel | RTDocs, RT Mail, Project Room |
| V6 Doorlooptijd per besluittype (vanaf vijf, nooit per persoon) | klein | `at`, `beslotenAt` |
| V7 Frictie als onderbouwing | klein | `rtgOne.fricties` |

**Later:** drempels als beleid, register met export, financieel gevolg met klasse
`advies`, melding per stem (klein tot middel; uitgangspoort,
`kern/fiscaal/scenario.js`, RT Mail).

### (B) Het uiteindelijke domeinmaximum, ook buiten de huidige scope

Richting en geen toezegging; wat een nieuw domein of externe koppeling vraagt,
staat als besluit. De termijnen en wetsartikelen hieronder zijn **(te
controleren)**.

**Proces 1. Governance van een BV, van agenda tot deponering.**
- Stappen: bestuursvoorstel → adviesronde → bestuursbesluit → zo nodig
  aandeelhoudersbesluit (in vergadering, of buiten vergadering met instemming van
  alle vergadergerechtigden, art. 2:238 BW, te controleren) → notulen →
  vaststelling jaarrekening → deponeren (termijnen volgens
  https://www.kvk.nl/deponeren/uiterste-termijn-deponeren-jaarrekening/, te controleren).
- Rollen en organisaties: bestuurder, aandeelhouder, raad van commissarissen,
  accountant, notaris (extern), KvK (extern).
- Apps en eigenaar: Onderneming (bestuur en aandelen, `kern/onderneming/bestuur.js`),
  Werk OS (besluitmotor, eigenaar), Decision Room (scherm), RTDocs (stukken),
  Concern (entiteiten), Geld (jaarrekeningcijfers).
- Buiten scope: deponeren en elke indiening bij de KvK blijven extern
  (voorbehouden). Een AVA-kring met stemgewicht per aandeel is een besluit.

**Proces 2. Bestuur van een stichting of vereniging.**
- Stappen: vergadering bijeen → quorum → belang melden → besluit → notulen in de
  volgende vergadering vastgesteld → jaarverslag met verwijzing naar aangenomen besluiten.
- Rollen: voorzitter, secretaris, penningmeester, leden of donateurs.
- Apps: Foundation OS (`rtfos/bestuur.js`, eigenaar), Decision Room (scherm),
  RTDocs, Geld. Een VvE (stemmen naar breukdeel, MJOP) hoort bij Wonen/CIVILIS.
- Buiten scope: verenigingen en VvE's als genre (CIVILIS par. 5B) zijn een besluit.

**Proces 3. Investerings- en inkoopbesluit in een organisatie.**
- Stappen: behoefte → offertes → voorstel met alternatief en risico → vier ogen
  boven tekengrens → contract → uitvoering als project → voorwaarde afgetekend →
  evaluatie.
- Rollen: aanvrager, budgethouder, finance, inkoop, leverancier.
- Apps: Werk OS (`bedrijf/uitgave.js`, `tekengrens.js`, `contract.js`), Decision Room
  (scherm), Project Room (uitvoering), Geld (verplichting en betaling), Onderneming
  (crediteuren).
- Buiten scope: een leveranciersobject (familiebesluit 2) en een gemeenschappelijke
  tekenweg (AFSPRAAK.md par. 4).

## Vraagt besluit

1. **Bedient Decision Room ook de ondernemer?** Geen tweede besluitmotor.
   - (A, aanbevolen) Ja, als scherm op `bedrijf/besluit.js`, met de
     werkruimtecode als scope. Motor en opslag blijven van Werk OS; het intern
     RTG-spoor blijft op `rtgone-bestuur.js`. Kosten: middel.
   - (B) Nee, blijft intern; Werk OS bouwt zijn eigen besluitscherm uit. Kosten:
     middel; twee schermfamilies voor hetzelfde werk.
   - (C) Eén motor voor alle drie. Kosten: groot; raakt drie eigenaren en de
     consolidatie.
2. **RTF-besluiten in Decision Room of in Foundation OS?** Decision Room kent
   het huis `rtf`; `rtfos/bestuur.js` kent quorum, belang en notulen.
   - (A, aanbevolen) Bestuursbesluiten van de stichting gaan via
     `rtfos/bestuur.js`; Decision Room houdt alleen operationele RTF-besluiten
     (vakgebied, vier ogen). Het scherm zegt dat verschil. Kosten: klein.
   - (B) Decision Room wordt ook het scherm op `rtfos/bestuur.js`. Kosten: middel.
   - (C) Laten zoals het is. Kosten: geen; risico dat een bestuursbesluit zonder quorum wordt genomen.
3. **Wat betekent "terug voor aanpassing"?**
   - (A, aanbevolen) Een nieuwe versie met `vorigeId`; het oude besluit blijft
     gesloten en zichtbaar. Kosten: klein.
   - (B) Hetzelfde besluit gaat terug naar `wacht` en de stemmen vervallen.
     Kosten: klein; het spoor wordt onduidelijk.
   - (C) De keuze hernoemen naar "Niet zo, sluiten" en geen herindienroute.
     Kosten: klein; het project blijft wel hangen.
4. **Wie tekent een voorwaarde af?**
   - (A, aanbevolen) De beoordelaar die hem stelde; bij afwezigheid de eigenaar.
     Kosten: klein bovenop H3.
   - (B) De projecteigenaar zelf. Kosten: klein; dan is het geen vier ogen meer.
