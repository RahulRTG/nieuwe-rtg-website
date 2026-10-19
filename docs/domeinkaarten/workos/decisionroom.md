# Decision Room (link:decisionroom)

Eigenaar: `werk.besluit` (SCHERMEIGENAAR.json, rol eigenaar, doelgroep kantoor).
Ingang: `/apps/decision-room.html`, achter de werkrol "kantoor". Doel volgens het
register: "Besluiten voor het bedrijf agenderen, afwegen en met de reden
vastleggen." In de praktijk is het bedrijf nu RTG of de RTFoundation zelf.

Opgesteld op 19 oktober 2026 op tak `appwerkt/workos`. Dit is een kaart en geen
bouwopdracht.

## a. Inventaris van het bewezen bestaande

**Wat er staat**

| Laag | Pad | Inhoud |
|---|---|---|
| Scherm | `public/apps/decision-room.html` + `decision-room.js`, `-agenda.js`, `-afweging.js`, `-besluit.js` | vier panelen: Besluiten (agenda), Afweging, Vastleggen, Archief; intake-dialoog |
| Routes | `server/routes/rtgone.js` | `/api/rtgone/state`, `/api/rtgone/goedkeuring`, `/api/rtgone/goedkeuring/beslis`, `/api/rtgone/rol/geef`, `/rol/trek`; alle achter `officeAuth` |
| Kern | `server/kern/rtgone-bestuur.js` | rollencatalogus, 8 besluittypen, vier-ogenregel, koppeling naar het project |
| Herhaling | `server/kern/rtgone-idem.js` | een voorstel met dezelfde sleutel staat er één keer |
| Opslag | `db.data.rtgOne.goedkeuringen` | object `dec-` |
| Toetsen | `test/decision-room.test.js` (3), `test/rtgone.test.js` | |
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
- Bij genoeg goedkeuringen: status `goedgekeurd`; het gekoppelde project gaat naar
  `uitvoering` en krijgt de taak "Besluit uitvoeren".

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

**Niet gevonden in de code**

- Opnieuw indienen na "terug voor aanpassing", wijzigen of intrekken van een voorstel.
- Een budgetobject, afhankelijkheden tussen besluiten.
- Een evaluatiedatum, een bezwaar dat blijft staan, een belangverklaring.
- Handhaving van de "voorwaarde bij akkoord" (wordt opgeslagen, niet bewaakt).
- Aansluiting op `server/bedrijf/besluit.js` (het besluit van de ondernemer) of
  op `server/kern/rtfos/bestuur.js` (bestuur van de stichting met quorum en notulen).
- Het besluitdossier (OFFICE.md P13: "staat in stukken"; fase 4 "een stap weg").

## b. Marktvergelijking

Echte merken alleen ter vergelijking.

| Leider | Wat achter de betaalmuur zit | Hebben wij het | Bron (19-10-2026) |
|---|---|---|---|
| Diligent Boards / Diligent One (offerte) | AI-agenda en boardbook, AI-notulen, stemmen met e-sign, Smart Builder, Risk Scanner | half: agenda, afweging en stemmen met reden; geen boardbook, geen notulen, geen e-sign | https://www.diligent.com/products/boards en https://www.diligent.com/platform/diligent-one (via zoektool, live te controleren) |
| Azeus Convene Standard / Enterprise (£195 p.p.p.j. via G-Cloud) | besluiten, review rooms, auditsporen, taken; werkruimtes; AI apart | half: besluit, auditregels, taak naar project; geen review room per document | https://www.azeusconvene.com/pricing (via zoektool, live te controleren) |
| Nasdaq Boardvantage (offerte) | entiteitenbeheer, D&O-vragenlijsten | nee; entiteiten wonen in Concern (`kern/concern/`), niet hier | https://www.nasdaq.com/solutions/governance/boardvantage/features (via zoektool, live te controleren) |
| BoardEffect Pro / Plus | AI-samenvatting, auditlog, SSO; onbeperkt besturen, notulen | half: auditlog afgekapt op 500 | https://www.boardeffect.com/pricing/ (via zoektool, live te controleren) |

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
  - BV: bestuur en aandeelhouders. Een besluit buiten vergadering vraagt
    instemming van alle vergadergerechtigden, schriftelijk of elektronisch, en
    bestuurders houden een raadgevende stem (art. 2:238 BW).
  - Stichting: quorum, belangenverstrengeling, notulen in de volgende vergadering
    vastgesteld. Dat bestaat in `server/kern/rtfos/bestuur.js` en
    `bestuur-notulen.js` voor de RTF.
  - Concern: besluiten per entiteit; entiteiten in `kern/concern/`, bestuur en
    aandeelhouders van een onderneming in `kern/onderneming/bestuur.js`.
  - Intern management (RTG zelf): besluiten per vakgebied met vier ogen. Dat is
    wat Decision Room nu doet.

**Wettelijke en normatieve eisen**

| Eis | Bron | Betekenis |
|---|---|---|
| Besluit buiten vergadering: alle vergadergerechtigden stemmen in, elektronisch mag, bestuurders hebben raadgevende stem (art. 2:238 BW) | https://www.dirkzwager.nl/kennis/artikelen/raadgevende-stem-van-de-bestuurder-ook-buiten-vergadering | Een AVA-besluit kan pas "aangenomen" zijn als iedere stemgerechtigde heeft ingestemd, en de raadgevende stem moet aantoonbaar zijn gevraagd. Decision Room telt nu 1 of 2 stemmen en kent geen kring. Een notulenplicht is te controleren. |
| Fiscale bewaarplicht 7 jaar (art. 52 AWR) | https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/ondernemen/administratie/hoelang-moet-u-gegevens-bewaren | Een financieel besluit dat een boeking onderbouwt, moet 7 jaar leesbaar blijven. De auditregels kappen nu af op 500. |
| Aanbestedingsdrempels 2026-2027 (€ 140.000, € 216.000, € 5.404.000) | https://www.pianoo.nl/nl/regelgeving/drempelbedragen-europees-aanbesteden | Geldt voor aanbestedende diensten. Of RTF of RTG dat zijn: niet vastgesteld (te controleren). Alleen relevant als signaal bij het bedrag. |
| Contant verbod vanaf € 3.000 (sinds 1-1-2026) | https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/aangifte_betalen_en_toezicht/wwft-voorkomen-van-witwassen-en-terrorismefinanciering/verplichtingen/verbod-cash-3000 | Een besluit dat contante betaling vanaf € 3.000 voorstelt, mag niet worden goedgekeurd. |
| ISO 9001 9.3 directiebeoordeling; 10.2 corrigerende maatregelen | https://www.lrqa.com/en/latest-news/iso-9001-publication-date-confirmed/ | Normatief: een besluit met een evaluatiedatum is de directiebeoordeling in klein. Versie 2026 te controleren. |
| AVG art. 30 en art. 12 | https://autoriteitpersoonsgegevens.nl/nl/zelf-doen/gebruik-uw-privacyrechten/recht-op-inzage | Een stem met naam en reden is een persoonsgegeven; een betrokkene mag haar inzien. |

**Wat dat betekent voor software.** Een besluit heeft een **kring** (wie mag
stemmen), een **regel** (één, twee, alle, meerderheid, quorum), een **belang**
per stemmer, een **dossier** (stukken, cijfers, bezwaren, uitvoering), een
**bewaartermijn** en een **evaluatie**. De regels bestaan al in drie motoren:
`rtgone-bestuur.js` (vier ogen), `bedrijf/besluit.js` (advies, bezwaar,
evaluatie) en `rtfos/bestuur.js` (quorum, belang, notulen). Een vierde motor komt
er niet.

## d. Functiecatalogus L1–L6

### L1 Persoonlijk

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Mijn besluitagenda | bestaat, `decision-room-agenda.js` | `goedkeuringen` met status `wacht` | toont alles in het huis, ook wat ik niet mag beoordelen | geen | beoordelaar bij openen | officeAuth | geen | Bovenaan staat wat ík mag beoordelen; de rest staat apart als "ter informatie" | klein | aanbevolen nu |
| Mijn voorstellen en hun stand | half (archief toont alles) | `aanvrager` = mijn sleutel | filter | geen | aanvrager bij elke stem | aanvrager | geen | Ik zie per voorstel hoeveel stemmen er zijn en wat er nog nodig is | klein | aanbevolen nu |
| Melding bij een stem of besluit | ontbreekt | stemmen | bericht naar de aanvrager via RT Mail | geen | aanvrager, direct | aanvrager | geen | Na elke stem krijgt de aanvrager één bericht met de reden | klein | later |

### L2 Professioneel

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Voorstel op naam | half; buiten productie mag de gedeelde kantoorcode een voorstel indienen (`aanvrager` wordt `legacy:kantoor`) | sessie | indienen alleen met persoonlijke sleutel (`naamAuth` in `kern/kantoor/kluispoort.js`) | geen | | persoonlijke sleutel | in productie is de code al dicht (productiedeur B10) | Zonder eigen account kan niemand een voorstel indienen, ook niet in de demo | klein | aanbevolen nu |
| Herindienen na "terug" | ontbreekt | gesloten besluit met `aanpassen` | nieuw voorstel met `vorigeId`; oude stemmen en redenen blijven zichtbaar; project volgt het nieuwe id | geen | eerdere beoordelaars | aanvrager | alleen na `aanpassen`, niet na `afgewezen` | Na "terug" kan de aanvrager een aangepaste versie indienen en het project loopt weer | klein | aanbevolen nu |
| Belangverklaring per beoordelaar | ontbreekt | stem | wie een belang meldt, telt niet als goedkeurende stem (regel uit `rtfos/bestuur.js`) | of iemand zijn belang meldt | aanvrager, auditor | beoordelaar | geen | Een beoordelaar met belang kan reden geven maar zijn stem telt niet mee | klein | aanbevolen nu |
| Evaluatiedatum op een goedgekeurd besluit | ontbreekt | besluit | verplicht bij goedkeuring, in de toekomst (regel uit `bedrijf/besluit.js`) | geen | aanvrager op de datum, via Vandaag van RTG One | aanvrager | afgewezen besluiten niet | Elk goedgekeurd besluit heeft een terugkijkdatum en verschijnt dan in de werkdag | klein | aanbevolen nu |
| Voorwaarde bij akkoord bewaken | half (opgeslagen) | `stem.voorwaarde` | een voorwaarde wordt een taak in het project met de beoordelaar als controleur | of de voorwaarde toetsbaar is | projecteigenaar | beoordelaar tekent af | zonder project: belofte in RTG One | Een voorwaarde staat als open taak en het project levert niet op voordat de beoordelaar hem aftekent | middel | later |

### L3 Organisatorisch

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Rollen per besluittype | bestaat | `rtgOne.rollen` | baas geeft en trekt | geen einddatum | | baas | | | | bestaat; einddatum: zie rtgone.md |
| Drempels als beleid | half; hard in code (10.000, 4, 4) | `rtgone-bestuur.js` | drempels per huis instelbaar door de baas, met spoor | geen | executive | baas | ondergrens: nooit minder dan 1 stem van een ander | De eigenaar kan de drempel per huis verlagen of verhogen en ziet in het spoor wie dat deed | klein | later |
| Besluitregister met filter en export | half (archief) | gesloten besluiten | filter op type, huis, periode; export CSV via de uitgangspoort | geen | auditor | `audit:lees` | strikt geclassificeerd niet exporteren | De auditor exporteert alle finance-besluiten van een jaar met stemmen en redenen | middel | later |
| Onveranderlijk spoor | half; stemmen staan in een gewijzigde lijst, audit afgekapt | stemmen, besluiten | append met hash in `kern/auditboek/` | geen | auditor | | | Een gewijzigde stem in de opslag valt op bij de hashcontrole | middel | aanbevolen nu |

### L4 Domeinintelligentie

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Compleetheid van het dossier | bestaat, `compleet()` in de agenda | 5 velden | aantal ingevulde velden | geen | beoordelaar | | | | | bestaat |
| Gevolg van een financieel besluit | ontbreekt | bedrag, termijn | `kern/fiscaal/scenario.js` of `kern/kosten/vooruitblik.js`, klasse `advies` met `aannames` en `onbekend` | alles wat geen boeking is | beoordelaar vóór stemmen | finance | zonder bron: "niet gerekend" | Het scherm toont het verwachte effect met aannames en de zin van klasse `advies`, nooit als vaststaand bedrag | middel | later |
| Signaal bij een wettelijke grens | ontbreekt | bedrag, betaalwijze | bedrag ≥ € 3.000 contant: weigeren; aanbestedingsdrempel: signaal | of de aanbestedingsplicht geldt | aanvrager bij indienen | | | Een voorstel met contant vanaf € 3.000 wordt niet ter stemming gebracht, met de bron | klein | later |
| AI vat het dossier samen | ontbreekt | velden, document, mail | lokaal-eerst; "Rahul ordent, niet beslist" staat al op het scherm | wat het document bedoelt | beoordelaar | AI kan niet stemmen | `RTG_EXTERNE_AI_UIT=1` | De samenvatting noemt haar bronnen; er is geen knop waarmee AI stemt | middel | later |

### L5 Volledige levenscyclus

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Intrekken door de aanvrager | ontbreekt | status `wacht` | `ingetrokken` met reden, alleen zolang er nog geen besluit is | geen | beoordelaars | aanvrager | na een stem blijft de stem zichtbaar | Een voorstel dat niet meer nodig is, kan worden ingetrokken en staat in het archief met reden | klein | aanbevolen nu |
| Deadline van het besluit | half (opgeslagen) | `deadline` | verlopen = vandaag > deadline; signaal in agenda | geen | beoordelaars | | | Een voorstel na zijn gewenste datum staat rood bovenaan | klein | aanbevolen nu |
| Evaluatie en herzien | ontbreekt | evaluatiedatum | op de datum: "klopte het?" met vrije tekst; geen nieuwe stem | geen | aanvrager, beoordelaars | | | Op de evaluatiedatum legt de aanvrager vast of het besluit uitpakte zoals bedoeld | klein | later |
| Bewaren 7 jaar voor finance | ontbreekt | type finance | bewaarklasse | geen | | | | Een finance-besluit is na 7 jaar nog leesbaar | klein | later |

### L6 RTG-samenhang

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Besluit → project | bestaat | `projectId` | goedkeuring zet project op uitvoering | geen | projecteigenaar | | | | | bestaat |
| RTDocs → voorstel | bestaat (`?document=`) | `documentId` | verwijzing | geen | | rechten van het document | | | | bestaat |
| Besluitdossier (P13) | ontbreekt | besluit, document, mail, project, stemmen | read-only projectie; geen kopie; elk stuk met bron | een bron die uitvalt staat als "niet beschikbaar" | beoordelaar, auditor | rechten van elk stuk afzonderlijk | | Eén pagina toont alle stukken van het besluit met hun bron, zonder ze te kopiëren | middel | aanbevolen nu |
| Frictie → voorstel | ontbreekt | `frictieId` | verwijzing | | | aanvrager | | Een voorstel kan een frictie uit RTG One als onderbouwing noemen | klein | later |
| Decision Room als scherm op `bedrijf/besluit.js` | ontbreekt | `w.besluiten` van een werkruimte | dezelfde schermcomponenten, motor en opslag blijven van Werk OS | | | `werkPoort(...,'besluit')` | | Een ondernemer opent Decision Room en ziet zijn eigen besluiten met advies, bezwaren en evaluatie, opgeslagen in Werk OS | middel | vraagt besluit |

### Modus LOS

Als RT Mail, RTDocs en Project Room uit staan, blijft de kerntaak: voorstel
indienen, afwegen, stemmen met reden, archief. De bronverwijzingen blijven als
tekst staan ("bronbericht …", "project …"). Het scherm zegt nu niet dat een bron
niet bereikbaar is; het toont alleen het id. Eerlijk is: "RTDocs niet bereikbaar,
het document is niet geopend".

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
   gaat naar uitvoering.
   - *Storing:* de voorwaarde van B wordt nergens bewaakt; het project kan
     opleveren zonder tweede offerte. Bewaard: de voorwaarde als tekst in de stem.
6. Variant: de eigenaar kiest "terug voor aanpassing".
   - *Storing:* het besluit sluit op `aanpassen` en er is geen weg terug. Het
     gekoppelde project blijft op `besluit` hangen. Bewaard: alles, maar
     doodlopend.

## e. RTG-exclusieve mogelijkheden

| Mogelijkheid | Eigenaar | Capability | Waarom geen markt-app dit kan |
|---|---|---|---|
| Besluit met één klik van mail of document naar uitvoering, met de bron bewaard | Decision Room (besluit); RT Mail, RTDocs, Project Room (verwijzingen) | `werk.besluit`, `docs.office`, `comm.mail`, `werk.project` | Boardportals staan los van mail en projectwerk; hier is het één huis met één identiteit. |
| Besluit dat een frictie in euro's als onderbouwing draagt | Decision Room; RTG One | `werk.besluit`, `werk.rtgone` | De frictie is door de medewerker zelf gemeten in hetzelfde systeem. |
| Eén schermtaal voor drie soorten besturen (RTG intern, ondernemer, stichting) zonder vierde motor | Decision Room (scherm); Werk OS, Foundation OS (motoren) | `werk.besluit`, `werk.organisatie` | Een markt-app verkoopt per doelgroep een apart product. Vraagt besluit. |

## f. Bouwstenen en ontbrekende koppelingen

**Bestaande modules**

- `server/kern/rtgone-bestuur.js`: de vier-ogenregel.
- `server/bedrijf/besluit.js`, `besluitlijst.js`, `besluit-loop.js`, `geheugen.js`,
  `regelpoort.js`: advies, bezwaar, evaluatie, "waarom deden we dit".
- `server/kern/rtfos/bestuur.js`, `bestuur-notulen.js`: quorum, belang, notulen.
- `server/kern/onderneming/bestuur.js`: bestuurders en aandeelhouders (de kring voor art. 2:238 BW).
- `server/kern/kantoor/kluispoort.js` (`naamAuth`), `server/kern/kantoor/tweedehandtekening.js`,
  `server/kern/appstore/vierogen.js`.
- `server/kern/auditboek/` voor het onveranderlijke spoor.
- `server/kern/stuur/goedkeuring.js`, `bevestiging.js`.

**Ontbrekende koppelingen**

| Van | Naar | Vorm | Toestemming |
|---|---|---|---|
| goedkeuring | auditboek | gebeurtenis met hash | geen extra |
| stem.voorwaarde | project-taak | gebeurtenis → taak | beoordelaar tekent af |
| besluit | dossierpagina | projectie over RTDocs, RT Mail, project | rechten per stuk |
| Decision Room-scherm | `bedrijf/besluit.js` | scherm op bestaande routes | `werkPoort` van Werk OS |
| Decision Room-scherm | `rtfos/bestuur.js` | scherm op bestaande routes | Foundation OS |

## g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Herindienen na "terug" met `vorigeId` | klein | laag | project volgt nieuw id | aanbevolen nu |
| Voorstel alleen op naam | klein | laag | `naamAuth` | aanbevolen nu |
| Belangverklaring | klein | laag | geen | aanbevolen nu |
| Evaluatiedatum | klein | laag | RTG One Vandaag | aanbevolen nu |
| Intrekken en deadline-signaal | klein | laag | geen | aanbevolen nu |
| Agenda: eerst wat ik mag beoordelen | klein | laag | `rechtenVoor` | aanbevolen nu |
| Onveranderlijk spoor via auditboek | middel | middel | `kern/auditboek/` | aanbevolen nu |
| Besluitdossier als projectie (P13) | middel | middel | RTDocs-rechten | aanbevolen nu |
| Voorwaarde wordt projecttaak | middel | middel | Project Room | later |
| Drempels als beleid per huis | klein | laag | | later |
| Register met export | middel | middel | uitgangspoort | later |
| Gevolg van een financieel besluit (L4) | middel | middel | scenario-engine | later |
| Scherm op `bedrijf/besluit.js` en `rtfos/bestuur.js` | middel | middel | besluit 1 | vraagt besluit |
| Eigen e-sign of notulenmodule in Decision Room | groot | hoog | | niet doen: notulen bestaan in `rtfos/bestuur-notulen.js`; tekenweg is AFSPRAAK-werk |
| AI die stemt of besluit | | | | niet doen: huisregel |

## h. Toetsbaar eindcontract Beyond Premium

Dit contract vervangt de acht bewijzen van APPWERKT nooit.

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| 1. Breedte | Indienen, herindienen, intrekken, stemmen en evalueren hebben elk een knop en een route | `scripts/schermen.js` | half: herindienen en intrekken ontbreken |
| 2. Professionele diepte | Contant vanaf € 3.000 wordt geweigerd; een belanghebbende stem telt niet; een finance-besluit blijft 7 jaar | `node --test` per regel | ontbreekt |
| 3. Levenscyclus | Een besluit doorloopt indienen → stemmen → besluit → evaluatie, en "terug" leidt tot een nieuwe versie | voltooiproef `decisionroom`, uitgebreid | half |
| 4. Samenwerking en rollen | Aanvrager, rolloze collega, lid zonder kantoorrol en uitgelogd worden geweigerd | voltooiproef stap 2 en 6; BEVOEGD | voltooiproef lokaal ja; BEVOEGD NIET_GETEST |
| 5. Domeinintelligentie | Elk verwacht gevolg draagt klasse `advies` met `onbekend`; AI stemt nooit | test op zekerheid; geen stemroute voor AI | geen gevolg op het scherm |
| 6. Los functioneren | Met RTDocs, RT Mail en Project Room uit kan men stemmen en zegt het scherm wat niet bereikbaar is | proef met koppelingen uit | half |
| 7. RTG-ketens | Document → voorstel → twee stemmen → project in uitvoering → oplevering, ook via "terug" | ketenproef naar `scripts/ritproef.js` | half: zakt op "terug" |
| 8. Bewezen betrouwbaarheid | Alle acht bewijzen centraal BEWEZEN | APPWERKT.json | 3 van 8; 4 lokaal gesloten |

## Twee uitkomsten

### (A) Binnen de huidige architectuur en scope

| Functie | Kosten | Bouwt op |
|---|---|---|
| Herindienen na "terug" met `vorigeId` | klein | `rtgone-bestuur.js` |
| Voorstel alleen op naam | klein | `kern/kantoor/kluispoort.js` |
| Belangverklaring en evaluatiedatum | klein | regels uit `rtfos/bestuur.js` en `bedrijf/besluit.js`, overgenomen als regel, niet als motor |
| Intrekken, deadline-signaal, agenda op recht | klein | `rtgone-bestuur.js`, `decision-room-agenda.js` |
| Onveranderlijk spoor | middel | `kern/auditboek/` |
| Besluitdossier als projectie | middel | RTDocs, RT Mail, Project Room |
| Later: voorwaarde als taak, drempels als beleid, export, financieel gevolg | klein tot middel | Project Room, uitgangspoort, `kern/fiscaal/scenario.js` |

### (B) Het uiteindelijke domeinmaximum, ook buiten de huidige scope

Richting en geen toezegging; wat een nieuw domein of externe koppeling vraagt,
staat als besluit.

**Proces 1. Governance van een BV, van agenda tot deponering.**
- Stappen: bestuursvoorstel → adviesronde → bestuursbesluit → zo nodig
  aandeelhoudersbesluit (in vergadering, of buiten vergadering met instemming van
  alle vergadergerechtigden, art. 2:238 BW) → notulen → vaststelling jaarrekening
  binnen 5 maanden (+5) → deponeren binnen 8 dagen na vaststelling en uiterlijk
  12 maanden na het boekjaar (https://www.kvk.nl/deponeren/uiterste-termijn-deponeren-jaarrekening/).
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
  boven tekengrens → contract → uitvoering als project → evaluatie.
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
