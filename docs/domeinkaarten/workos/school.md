# School (link:school)

Eigenaar: `leren.school` → `apps/rtgschool.html` (SCHERMEIGENAAR.json, doelgroep
rtf-kind; de app wordt ook door volwassen leden gebruikt). Ingang: de app School
in de ledenapp, en als schil het Leerpaspoort in de Foundation
(`apps/foundation/leerpaspoort.html`, `rol: schil`; het oordeel in
SCHERMEIGENAAR noemt het "een implementatie met twee schillen"). Doelgroep:
leerling (kind en volwassene), met daarnaast de docent- en schoolkant die een
**andere eigenaar** heeft: `werk.schoolbeheer` → `apps/schoolpartner.html`
(doelgroep zaak). Diepte-documenten: `SCHOOL.md`, `FOUNDATION.md` par. 5.5.

De ambitie van de eigenaar: adaptief leren met kennismodellen. Die vorm bestaat
al als Learning Fabric; deze kaart beschrijft wat er staat, wat het domein
vraagt, en wat er nog onder moet.

---

## a. Inventaris van het bewezen bestaande

### Wat er staat

| Laag | Wat | Pad |
|---|---|---|
| Scherm (leerling) | paspoort, leerlijn, oefenen, herhalen, dagplan, examentraining, bijles | `public/apps/rtgschool.html`, `public/apps/rtgschool/leer.js` (+ `leer/`), `examen.js`, `bijles.js` |
| Schil (Foundation) | dezelfde component via `/api/rtf/leerling/*`, achter de leeftijdspas | `public/apps/foundation/leerpaspoort.html`, `server/routes/rtfleerling.js` |
| Routes (lid) | `/api/onderwijs/{advies, ladder, mijn, inschrijf, jaar-over, doel, bewijs}`; `/api/leerstof/{vakken, les, pad, oefen, antwoord, herhalen, dag, herhaal, examen, examen-antwoord}`; `/api/bijles*` | `server/routes/onderwijs.js`, `server/routes/leerstof.js` |
| Kern | paspoort, ladder (25 fasen po t/m wo), bewijs, geheugen, Fabric, denkfout, dagplan, taalvorm, schooladviesgrens | `server/kern/onderwijs.js`, `onderwijs-ladder.js`, `onderwijs-bewijs.js`, `onderwijs-geheugen.js`, `leerstof.js`, `leerstof-fabric.js`, `leerstof-bibliotheek.js`, `leerstof-denkfout.js`, `leerstof-dag.js`, `leerstof-herhalen.js`, `leerstof-taalvorm.js`, `leerstof-vervolg.js`, `schooladvies.js`, `leerstof-data/` |
| Opslag | `onderwijs` (per lid: fase, jaar, historie max 300, doelen met bewijs max 20 per doel); `leerstofSessies` | `kern/onderwijs.js`, `kern/leerstof.js` (via `eigencollectie`) |
| Schoolkant (andere eigenaar) | 42 modules, 217 endpoints, 15 rollen, inzagejournaal, toets, les, aandacht, opvolging, overdracht, koppelvlak | `server/school/`, `public/apps/schoolpartner/` |

**Het kennismodel (Learning Fabric), zoals het draait** (SCHOOL.md par. 1 tot 6):
- 166 leerdoelen (po 111 over zeven vakken; vo 55 over twintig vakken; mbo 10,
  hbo 4, wo 5), 56 opgavengeneratoren, referentieniveaus 1F-4F, 333
  uitlegvarianten. Geen leerdoel put uit een vaste vragenlijst.
- Per doel: `vereist` (voorkennisgraaf), `uitleg[]`, `meting`, `bewijs[]`;
  gekeurd bij het opstarten (`kern/leerstof-fabric.js`).
- Beheersing in woorden (`gemeld`, `enkel`, `stevig`, `sterk`), afgeleid uit het
  bewijs en nooit opgeslagen (`beheersingVan`). Sterk vraagt onafhankelijk
  bewijs van school; een leerling kent zichzelf geen toets toe.
- Memory Engine: reeks 2/7/21/60/180 dagen; een mindere ophaling zet één trede
  terug; de open lijst draagt geen datum en geen achterstand.
- Misconception Graph: 18 denkpatronen, geduid uit het feit van de opgave (dat
  de server niet verlaat); de klas telt patronen zonder wie.
- Dagplan: maximaal 5 stukken, met reden, niets bewaard (`leerstof-dag.js`
  krijgt geen db).
- Schooladviesgrens: `kern/schooladvies.js`; de AI stelt geen advies vast, elke
  uitspraak noemt wie beslist.

### Wat bewezen is

- **APPWERKT.json** (19 oktober 2026): bereikbaar, bedienbaar, menselijk,
  voltooibaar, waarheidsgetrouw, persistent en herstelbaar **BEWEZEN centraal**;
  bevoegd NIET_GETEST. School was al vóór deze tak centraal bewezen.
- Het voltooiscenario (`scripts/lib/voltooi/school.js`, contract in
  `scripts/lib/appcontract.js`) loopt een examentraining van tien vragen via
  `/api/leerstof/examen`, `/examen-antwoord` en `/api/onderwijs/advies`, met het
  lid op een ander toestel. Belofte: "een oefenindicatie die geen echt cijfer
  is".
- **BEVOEGD.json** (stempel 05:08, 55ed79f9): 5 routes geteld, 4 open.
- **IDOR.json** (huisbreed): 1999 routes, 0 doorbraken.
- Beloften met meting: SCHOOL.md par. 7 (onder meer `test/leerfabric.test.js`,
  `test/schooladvies.test.js`, `test/denkfout.test.js`, `test/dagplan.test.js`,
  `test/geheugen.test.js`), veel met mutatie beproefd.

### Wat de code of het document zelf "niet gebouwd" noemt

- **Student Twin, Algorithmic Appeal en Learning Recovery** staan alleen in
  SCHOOL.md (par. 3 en 6); in `server/kern/leerstof*.js` en
  `server/kern/onderwijs*.js` is geen code gevonden.
- **Leerdossierregel, voorwaarde 3** (alleen leesbaar voor leerling en wie een
  rechtmatige verhouding heeft) heeft geen handhaver; `GELDING.json` zet de
  cellen `tonen | school | {systeem, medewerker, partner, externeLezer}` op
  `GEDRAGEN_NIET_GEZIEN` (FOUNDATION.md par. 5.5). Er is geen toets die alle
  vier voorwaarden samen bewaakt.
- **Geen verbinding met Edu-V of Entree** (SCHOOL.md par. 13): de vertaling
  ligt klaar en is tegen de specificaties nagekeken, maar sleutels, contract en
  tegenpartij ontbreken.
- Diepte: vo dekt de kern, niet een volledig examenprogramma; mbo, hbo en wo zijn
  een begin.
- De schooladvies-tijdlijn (voorlopig advies, doorstroomtoets, definitief
  advies) komt in `server/school/` en `kern/` **niet voor** (niet gevonden).
- Fase en leerjaar in het paspoort zet het lid zelf (`inschrijf`, `jaarOver` in
  `kern/onderwijs.js`); een overgang door school bevestigd is er niet in het
  ledenpaspoort.

---

## b. Marktvergelijking

Geraadpleegd 19 oktober 2026 via WebSearch op het officiële domein (via
zoektool, live te controleren). Merken alleen ter vergelijking.

| Leider | Achter de betaalmuur | Wij | Bron |
|---|---|---|---|
| Snappet Compleet | €74 per leerling per jaar; adaptief oefenen in de klas | adaptief oefenen: **ja** (Fabric, voorkennis, denkfout); klasbeeld voor de docent: **ja** bij `werk.schoolbeheer`; volledig methode-aanbod po: **ja** (111 doelen), vo **half** | https://snappet.nl/tarieven/ |
| ALEKS | $48,22; kennisruimte-adaptief | voorkennisgraaf: **ja**; beheersingscheck op verzoek (appeal): **nee** | https://www.mheducation.com/prek-12/program/microsites/MKTSP-GAB02M0/order-online.html |
| Khanmigo | gratis voor leraren; leerling en ouder $4 per maand, alleen VS | AI-tutor: **half** (`/api/bijles*`, Explain Differently uit vaste uitlegvarianten); gratis voor docent: n.v.t. | https://www.khanmigo.ai/pricing |
| Duolingo Max | roleplay, videogesprek, Explain My Answer | Explain My Answer: **ja** (denkfout-duiding uit het feit, geen model) | https://www.duolingo.com/help/what-is-duolingo-max |
| Google Education Plus (enterprise) | $6 per gebruiker per jaar | schoolbrede suite: **nee** hier; documenten bij `docs.office` | https://knowledge.workspace.google.com/admin/getting-started/editions/google-workspace-for-education-pricing-and-licensing |
| Cornerstone Galaxy / Docebo (duurste, zakelijk leren, offerte) | Skills Architect, People Graph | vaardighedengraaf voor werk: **nee** (zie Loopbaan en ARBEID besluit over een gedeelde vaardighedenlijst) | https://www.cornerstoneondemand.com/platform/portfolio-packages/ , https://www.docebo.com/pricing/ |

Wat de markt niet heeft en wij wel: beheersing als woord met het bewijs eronder
(geen percentage, geen ranglijst), een dagplan dat niets telt, herhalen zonder
achterstand, en één leerlingidentiteit op codenaam die van groep 1 tot volwassen
leren meegaat.

---

## c. Analyse van het volledige domein

**Particulier.** Een kind oefent thuis; een ouder wil weten waar het staat; een
volwassene leert een vak, een taal of een examen bij. Behoefte: weten wat de
volgende stap is, zonder rangorde en zonder verslavende tellers.

**Professioneel.** Een docent geeft les, kijkt na, observeert, stelt een
rapport op, bereidt het schooladvies voor. Een bijlesgever werkt met een paar
leerlingen. Die kant is van `werk.schoolbeheer`; School levert de leerlingkant
en ontvangt bewijs (toets, observatie).

**Organisatie.** Een school of bestuur: leerlingvolgsysteem, zorg, verzuim,
inspectie, overstap. Dat is School Core in `server/school/` en niet deze app.

**Wet en norm** (domein-max.txt, par. 8):
- Leerlingvolgsysteem: art. 8 WPO. Onderwijskundig rapport bij vertrek:
  art. 42 WPO. Voor software: een leerdossier per doel is bruikbaar, maar het
  officiële rapport stelt de school vast, niet RTG.
- Tijdlijn schooladvies 2027: voorlopig advies 10-31 januari; doorstroomtoets
  25 januari tot 12 februari; definitief advies uiterlijk 24 maart; bijstellen
  alleen naar boven
  (https://www.rijksoverheid.nl/themas/onderwijs/schooladvies-en-doorstroomtoets-basisschool/tijdlijn-schooladvies-2027).
  Voor software: een termijnklok bij de school, en in School alleen een
  zichtbare tijdlijn; het advies blijft van de school (`kern/schooladvies.js`).
- Onderzoekskaders 2026 van de inspectie (vanaf 1 augustus 2026): OP0
  basisvaardigheden, OP1 aanbod, veiligheid en schoolklimaat,
  onderwijsresultaten, sturen en kwaliteitszorg
  (https://www.onderwijsinspectie.nl/actueel/nieuws/2026/07/03/onderzoekskaders-2026-vastgesteld).
  Voor software: aanbod en basisvaardigheden zijn per leerdoel aantoonbaar te
  maken, zonder kindranglijst.
- AVG op school: leerlingdossier 2 jaar na vertrek; in- en uitschrijving en
  verzuim 5 jaar; onderwijskundig rapport 5 jaar
  (https://autoriteitpersoonsgegevens.nl/nl/onderwerpen/onderwijs/leerlingdossiers ,
  https://normenkaderibp.kennisnet.nl/app/uploads/Handleiding-Bewaartermijnenoverzicht.pdf).
  Voor software: het schooldossier krijgt bewaarklassen; het eigen leerpaspoort
  van een lid is van het lid zelf en valt niet onder de termijn van de school.
  Hoe die twee zich verhouden bij een kind dat via een school oefent: te
  controleren.
- Formatief evalueren (SLO), vijf fasen: leerdoelen en succescriteria, reacties
  ontlokken, analyseren, feedback, vervolgstappen
  (https://www.slo.nl/thema/meer/10-14-onderwijs/werken-leerdoelen/slag-formatief-evalueren/).
  Voor software: de Fabric dekt fase 1 (`meting`), 2 (oefenen), 3 (denkfout),
  4 (uitleg anders) en 5 (dagplan). Ontbrekend: succescriteria in woorden van
  de leerling.
- AVG art. 12 (inzage binnen 1 maand) en art. 35 (DPIA bij hoog risico;
  kinderen en profilering zijn daarvoor een aanwijzing, te controleren tegen de
  AP-lijst).

**Huisregels die het domein vormen.** De progressielaag stopt bij 18+
(`progressieMag`), een leerdossier mag op elke leeftijd onder vier voorwaarden:
vergelijkt nooit, geen plakkend label, alleen leesbaar voor leerling en
rechtmatige verhouding, op codenaam. Een leerdossier valt **niet** onder
`progressieMag`; valt een voorwaarde weg, dan wel.

---

## d. Functiecatalogus L1–L6

### L1 Persoonlijk

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Oefenen met voorkennis | bestaat, `leerstof-fabric.js` | Fabric, sessie | doel pas aangeboden als `vereist` af is | geen | leerling | eigen sessie | leeftijdspas in Foundation | een doel met open voorkennis staat nooit in het dagplan | – | bestaat |
| Beheersing met bewijs ("Waarom?") | bestaat, `onderwijs-bewijs.js` | bewijsregels | woord uit onafhankelijkheid, nooit opgeslagen | geen | leerling | eigen | zelfgemeld telt minder | de leerling ziet waarom RTG denkt dat hij het kan | – | bestaat |
| Algorithmic Appeal ("Ik kan dit al") | ontbreekt (SCHOOL.md par. 6) | doel + 5 verse vragen uit de generator | 5 vragen; 5 van 5 of 4 van 5 zonder hint → bewijssoort `herhaling` en de leerlijn schuift; minder → niets gewist | geen: regel | leerling direct | eigen | niet bij examentraining | een leerling kan een aanbeveling betwisten en schuift op bij goed resultaat, zonder dat een mislukte check ergens blijft staan | klein | aanbevolen nu |
| Learning Recovery na een onvoldoende | ontbreekt (SCHOOL.md par. 6) | toetsuitslag per leerdoel (school) + `vereist` | lijst ontbrekende bouwstenen, maximaal 3, in het dagplan; geen "hoofdstuk opnieuw" | geen | leerling na de toets | school levert de uitslag | uitslag zonder leerdoel: niets | na een onvoldoende staan de drie ontbrekende bouwstenen in het dagplan van morgen | klein | aanbevolen nu |
| Succescriteria in leerlingtaal | ontbreekt | `meting` per doel | een zin per doel "je kunt dit als ..."; vast in `leerstof-data/` | geen | leerling | – | – | elk doel zegt in gewone taal wanneer het beheerst is (SLO fase 1) | middel (166 zinnen) | later |
| Dubbele tik op "een leerjaar erbij" | half: `jaarOver` zonder herhaalsleutel | paspoort | herhaalsleutel zoals `server/kern/office/herhaling.js` | geen | – | eigen | – | twee tikken geven één leerjaar | klein | aanbevolen nu |

### L2 Professioneel (de docent, eigenaar `werk.schoolbeheer`)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Observatie en toets als bewijs | bestaat, `school/bewijs.js` → paspoort | docent op naam | alleen school mag `toets` en `observatie` | geen | leerling ziet het bewijs | rol in `school/rollen.js` | – | een observatie landt met de naam van wie het zag | – | bestaat |
| Denkfouten in de klas zonder wie | bestaat, `school/denkfout.js` | telling + datum | geen leerlingsleutel in de opslag | geen | docent | rol | – | de docent ziet "11 keer" en nooit welk kind | – | bestaat |
| Huiswerk met leerdoel in het dagplan | bestaat (SCHOOL.md par. 5b) | huiswerk van school | weegt zwaarder dan wat de motor voorstelt | geen | leerling | docent | – | wat de school vroeg staat vooraan | – | bestaat |
| Schooladvies-tijdlijn als klok | ontbreekt | datums 2027 (bron boven) | termijnen per schooljaar als data met bron; waarschuwing aan de school, nooit een advies | laag: datums wijzigen per jaar, te controleren | directie en groep-8-leerkracht | `werk.schoolbeheer` | bijstellen alleen naar boven | de school ziet op 1 januari welke adviezen vóór 31 januari klaar moeten | klein | later (eigenaar `werk.schoolbeheer`) |
| Bijlesgever met eigen leerlingen | ontbreekt | koppeling leerling ↔ bijlesgever | een machtiging van leerling of voogd (Vertegenwoordiging kent hoedanigheid `coach`), alleen-lezen beheersing | geen | leerling ziet wie meekijkt | leerling of voogd | geen zorgdossier | een bijlesgever ziet alleen wat de leerling deelt, en het stopt bij intrekken | middel | later (besluit 3) |

### L3 Organisatorisch

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Handhaver voorwaarde 3 (wie leest het dossier) | ontbreekt; `GELDING.json` `GEDRAGEN_NIET_GEZIEN` | lezersoort per route | een toets per route die het paspoort toont: leerling, ouder met rechtmatige verhouding, docent van de klas; partner en externe lezer 403 | geen | – | – | zelf-inzage vrij | een partner- of externe sessie krijgt het paspoort van een kind nooit, en een toets zakt als dat verandert | klein | aanbevolen nu |
| Eén toets voor alle vier voorwaarden | ontbreekt | `kern/onderwijs.js` + routes | 1 geen vergelijkend veld; 2 geen opgeslagen niveau-woord; 3 lezers; 4 sleutel `lid:<codenaam-key>` | geen | – | – | – | één toetsbestand zakt zodra een van de vier voorwaarden breekt, met mutaties gezien | klein | aanbevolen nu |
| Bewaarklassen voor het schooldossier | half: `server/school/dossier.js` noemt bewaartermijnen "elders" | AP-termijnen (2 en 5 jaar) | klasse per gegeven; wissen na termijn door een mens, niet met een knop (SCHOOL.md grens 10) | laag; verhouding tot leerpaspoort te controleren | directie | `werk.schoolbeheer` | wettelijke bewaarplicht gaat voor | elk schoolgegeven draagt een bewaarklasse uit de bron | middel | later (eigenaar `werk.schoolbeheer`) |
| Inspectie-aanbodbeeld | ontbreekt | leerdoelen per fase, `ref` 1F-4F | per vak en fase welke doelen zijn aangeboden en geoefend, zonder kind | middel: kader is nieuw | directie | `werk.schoolbeheer` | – | de school toont per vak het aanbod (OP1) zonder een leerlingnaam | middel | later |

### L4 Domeinintelligentie

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Kennismodel (vereist, uitleg, meting, bewijs) | bestaat | Fabric | gekeurd bij opstarten | geen | – | – | – | – | – | bestaat |
| Denkfout uit het feit | bestaat | feit van de opgave | regel of niets; specifiek gaat voor algemeen | geen | leerling | – | past niets: geen duiding | – | – | bestaat |
| Student Twin (acht dimensies) | ontbreekt | kennis, retentie, strategie, tempo, taal, zelfstandigheid, context, belasting | factoren met rekensom, geen score, niets bewaard (projectie zoals het dagplan) | middel: tempo en zelfstandigheid zijn signalen, geen feiten; klasse `advies` | leerling | eigen | geen risicoscore, geen uitvalkans | de leerling ziet "je struikelt waarschijnlijk over de formulering" met de telling erbij, en er staat nergens een opgeslagen profiel | middel | later |
| Taalsteun bij talige fout | half: `leerstof-taalvorm.js` (Language Independence Test) | dezelfde opgave kaal en talig | als kaal goed en talig fout: zelfde taak met taalsteun | laag | leerling | – | taalvak: geen vergelijking | – | klein | later |
| Voorspelling van examenuitslag | ontbreekt | – | – | hoog | – | – | – | – | – | niet doen: een voorspelling is nooit een feit, en een geschat cijfer op een kind is een plakkend label |

### L5 Volledige levenscyclus

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Ladder po t/m wo + doorstroomkaart | bestaat, `onderwijs-ladder.js` | 25 fasen | stap terug mag altijd; daarbuiten de kaart | geen | – | – | – | – | – | bestaat |
| Overstap tussen RTG-scholen | bestaat (`school/overdracht.js`) | pakket per doel | geadresseerd, 14 dagen, weg na ophalen; zorg nooit | geen | ontvangende school | school | – | – | – | bestaat |
| Overgang door school bevestigd in het paspoort | ontbreekt | besluit rapportvergadering (`server/school/`) | school-overgang schrijft een historieregel met bron `school`; zelf gezette fase blijft `zelf` | geen | leerling | school, op naam | volwassen lid zonder school: alleen `zelf` | het paspoort laat zien welke overgang de school besloot en welke het lid zelf zette | klein | later |
| Van leerling naar volwassen leren en werk | half | paspoort blijft; Loopbaan bestaat | bij 18: niets wordt omgezet in een ranglijst; delen naar Loopbaan alleen door het lid | geen | lid | lid | – | wie 18 wordt houdt zijn dossier en ziet geen nieuwe stand verschijnen | klein | later |
| Future Passport (portfolio met verifieerbare bewijzen) | ontbreekt (SCHOOL.md par. 13) | paspoort + Bewijsmap | lid kiest wat gedeeld wordt; formaat volgt MENSNETWERK besluit 4 | middel | lezer met deelcode | lid | zorg nooit | – | groot | later |

### L6 RTG-samenhang

School **geeft uit**: beheersing per doel (woord + bewijs), herhaalmomenten, het
dagplan (niet bewaard), oefenindicaties. School **ontvangt**: toets- en
observatiebewijs en huiswerk van `werk.schoolbeheer`; leeftijd en pas van de
Foundation (`rtf.leerlingPassen`); bijles van de bijlesmodule.

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| School Core → paspoort (toets, observatie) | bestaat | `school/bewijs.js` | alleen school | geen | leerling | school | – | – | – | bestaat |
| Paspoort → Loopbaan | ontbreekt | behaald doel met sterk bewijs | het lid kiest een feit; Loopbaan schrijft het met herkomst `school`; nooit automatisch | geen | lid | lid | onder 18 geen progressie; een leerfeit is geen ranglijst | – | klein | later |
| Ouder kijkt mee | half: ouderportaal bij `werk.schoolbeheer` en gezin in de Foundation | rechtmatige verhouding | alleen voor ouder met bevestigde relatie (gezin of voogd) | geen | leerling ziet dat de ouder keek | ouder | jongere van 16+: te controleren of meekijken stopt zonder toestemming | – | middel | later |
| Volwassenenonderwijs | andere eigenaar: `leren.volwassenenonderwijs` (`apps/foundation/studie.html`) | – | zelfde motor, geen tweede | – | – | – | – | – | – | niet doen hier: eigenaar bestaat |
| Lesmaker | andere eigenaar: `leren.lesmaker` (`apps/lesmaker.html`) | – | – | – | – | – | – | – | – | niet doen hier |

### Modus LOS

Met School Core, Foundation en Loopbaan uit blijft de kern: een lid oefent,
herhaalt, krijgt zijn dagplan en een examentraining. Het scherm zegt dan
eerlijk: **"Je bewijs is van jezelf. Bevestiging door een school is er niet,
dus 'sterk' kun je hier niet halen."** Dat is wat `beheersingVan` al doet: zonder
bewijs van buiten blijft het `stevig`.

### Modus SAMEN: een volledige keten

Groep 7, rekenen, breuken.

1. De docent geeft huiswerk "breuken optellen" in `schoolpartner`.
   - Storing: de docent is afwezig; een waarnemer met einddatum geeft het
     huiswerk. Na de einddatum weigert de klaspoort (`school/waarneming.js`).
2. De leerling opent School; het huiswerk staat vooraan in het dagplan.
   - Storing: voorkennis "gelijknamig maken" is open. Het doel komt niet in het
     plan; de voorkennis wel, met de reden.
3. Hij maakt 1/3 + 1/3 = 2/6. Duiding `breuken.noemer-opgeteld` en een andere
   uitleg; de klas krijgt +1 zonder wie.
   - Storing: netwerk weg midden in de sessie. De sessie staat op de server en
     loopt door op een ander toestel (voltooiproef: persistent).
4. Een SO de week erna: 5 van 10. (Aanbevolen nu) Learning Recovery zet drie
   bouwstenen in het dagplan.
   - Storing: de uitslag heeft geen leerdoel. Er komt niets; geen gok.
5. De leerling zegt "ik kan dit al" (aanbevolen nu): vijf vragen, 5 goed. De
   leerlijn schuift; het bewijs krijgt een regel.
   - Storing: dubbele tik op de check. Eén check (herhaalsleutel vereist).
6. Twee weken later: herhaling uit de Memory Engine, zonder datum of
   achterstand.
7. De ouder kijkt mee via het ouderportaal (rechtmatige verhouding).
   - Storing: een partner-sessie vraagt het paspoort op. Vandaag ongehandhaafd;
     met de handhaver van voorwaarde 3 (aanbevolen nu) 403.

---

## e. RTG-exclusieve mogelijkheden

| Mogelijkheid | Eigenaar | Capability | Waarom geen markt-app dit kan |
|---|---|---|---|
| Eén leerpaspoort op codenaam van groep 1 tot volwassen leren, met school- en zelfbewijs gescheiden | `leren.school` | `kern/onderwijs.js` + `onderwijs-bewijs.js` | een methode-app stopt bij het schooljaar en kent geen identiteitskluis |
| Bewijs van school landt bij de leerling, telling bij de docent zonder wie | `leren.school` + `werk.schoolbeheer` | `school/bewijs.js`, `school/denkfout.js` | leerlingvolgsysteem en oefenapp zijn in de markt twee leveranciers |
| Bijles of coach via een machtiging die het kind zelf intrekt | `mandaat.beheer` levert, `leren.school` leest | hoedanigheid `coach` | een markt-app heeft geen gesloten bevoegdheidslijst met jeugdbestuur |
| Taalsteun voor ouders in 114 talen met terugvertaling en bon | `werk.schoolbeheer` | `school/taalpoort.js`, `kern/betekenis.js` | – |
| Oefenen zonder tellers, ook commercieel | `leren.school` | `leerstof-dag.js` zonder db | het verdienmodel van de markt hangt vaak aan streaks |

---

## f. Bouwstenen en ontbrekende koppelingen

**Bouwstenen**: `server/kern/leerstof-fabric.js`, `leerstof-bibliotheek.js`,
`onderwijs-bewijs.js`, `onderwijs-geheugen.js`, `leerstof-dag.js`,
`leerstof-denkfout.js`, `leerstof-taalvorm.js`, `schooladvies.js`,
`server/school/bewijs.js`, `server/school/overdracht.js`, `kern/koppelvlak.js`,
`kern/spellen/grens.js` (alleen als referentie: niet gebruiken voor het dossier),
`server/kern/vertegenwoordiging/` (coach-machtiging), `server/kern/office/herhaling.js` (vorm
herhaalsleutel).

| Van → naar | Vorm | Toestemming |
|---|---|---|
| School Core (overgang) → paspoort | gebeurtenis met bron `school` | rol rapportvergadering |
| Paspoort → Loopbaan | verwijzing, door het lid gekozen | lid |
| Vertegenwoordiging (`coach`) → School | leesvraag op beheersing | machtiging, per vraag gelezen |
| Edu-V / Entree → School Core | externe koppeling | contract, sleutels (ontbreekt) |
| Routes paspoort → toets voorwaarde 3 | registertoets | – |

---

## g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Toets op de vier leerdossiervoorwaarden, met handhaver voor 3 | klein | laag | `GELDING.json` | aanbevolen nu |
| Herhaalsleutel op `jaar-over` en `inschrijf` | klein | laag | – | aanbevolen nu |
| Algorithmic Appeal | klein | laag | generatoren | aanbevolen nu |
| Learning Recovery | klein | laag | toetsuitslag per leerdoel | aanbevolen nu |
| Bron (`zelf`/`school`) op elke historieregel | klein | laag | – | aanbevolen nu |
| Succescriteria in leerlingtaal | middel | laag | 166 doelen | later |
| Student Twin als projectie | middel | middel | taalvorm, geheugen | later |
| Schooladvies-tijdlijn, bewaarklassen, aanbodbeeld | klein tot middel | middel | eigenaar `werk.schoolbeheer` | later |
| Bijlesgever via machtiging | middel | middel | Vertegenwoordiging | later |
| Edu-V/Entree aansluiten | groot | hoog | contract, partij | later |
| Examenvoorspelling | – | – | – | niet doen |

---

## h. Toetsbaar eindcontract Beyond Premium

Dit contract vervangt nooit de acht bewijzen van APPWERKT.

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| Breedte | elk actief vak heeft per fase minstens één oefenbaar doel | dekkingsmeter (SCHOOL.md par. 7) | ja po en vo; mbo t/m wo dun |
| Professionele diepte | een docent ziet patronen en geeft bewijs zonder een kind te rangschikken | `test/denkfout.test.js`, `test/teacherflow.test.js` | ja |
| Levenscyclus | inschrijven, overgaan, herhalen, overstappen, volwassen worden zonder datagat | voltooiproef + `test/overdracht.test.js` + toets op historiebron | bron-veld ontbreekt |
| Samenwerking en rollen | alleen leerling en rechtmatige verhouding lezen het dossier | nieuwe toets voorwaarde 3 | geen handhaver |
| Domeinintelligentie | elke aanbeveling is te betwisten en draagt haar reden | appeal-toets, `test/dagplan.test.js` | reden ja, betwisten nee |
| Los functioneren | zonder school werkt oefenen en zegt het scherm wat er ontbreekt | voltooiproef met School Core uit | niet beproefd |
| RTG-ketens | een schooltoets landt in het paspoort, een gekozen feit in Loopbaan | ketentoets school → paspoort → Loopbaan | eerste helft ja |
| Bewezen betrouwbaarheid | APPWERKT acht bewijzen; BEVOEGD geteld | APPWERKT, BEVOEGD.json | 7 van 8 centraal bewezen; bevoegd NT; BEVOEGD 5/4 |

---

## Twee uitkomsten

### (A) Binnen de huidige architectuur en scope

| Functie | Kosten | Bouwt op |
|---|---|---|
| Toets vier voorwaarden + handhaver voorwaarde 3 | klein | `kern/onderwijs.js`, routes, `GELDING.json` |
| Herhaalsleutel `jaar-over`/`inschrijf` | klein | `server/kern/office/herhaling.js`-vorm |
| Algorithmic Appeal | klein | generatoren, `onderwijs-bewijs.js` |
| Learning Recovery | klein | `school/bewijs.js`, `leerstof-dag.js` |
| Bron op historieregel | klein | `kern/onderwijs.js` |
| Succescriteria, Student Twin (projectie), bijles via machtiging | middel | Fabric, taalvorm, Vertegenwoordiging |

### (B) Het domeinmaximum, ook buiten de huidige scope

Richting, geen toezegging. Een nieuw domein vóór V1 blijft uitgesloten.

**Proces 1: een schoolloopbaan po → vo.**
- Stappen: aanmelden en inschrijven → groep 1-8 met leerlijn en formatief
  evalueren → leerlingvolgsysteem (art. 8 WPO) → voorlopig advies (januari) →
  doorstroomtoets → definitief advies (24 maart) → overstap met
  onderwijskundig rapport (art. 42 WPO) → vo.
- Rollen: leerling, ouders, leerkracht, intern begeleider, directie, bestuur,
  ontvangende vo-school, toetsaanbieder, inspectie.
- Apps en eigenaar: School (`leren.school`, leerling), Schoolpartner
  (`werk.schoolbeheer`, school; eigenaar van advies en dossier), Foundation
  (`rtf.school`, gezin), RT Mail/taalpoort, Bewijsmap.
- Buiten scope: koppeling met de doorstroomtoets en OSO (extern), Edu-V en
  Entree (contract), een besluit of RTG een officieel leerlingvolgsysteem wil
  zijn (aansprakelijkheid).

**Proces 2: volwassen bijscholing tot erkend bewijs.**
- Stappen: doel kiezen → voorkennis meten → oefenen en herhalen → examen
  oefenen → extern examen → bewijs in Loopbaan → werkgever ziet het met een
  deelcode.
- Rollen: lid, docent of coach, examen-instelling (extern), werkgever.
- Apps: School, `leren.volwassenenonderwijs`, Loopbaan (`loopbaan.ledger`,
  `loopbaan.bewijs`), Vertegenwoordiging (coach).
- Buiten scope: erkenning door een examen-instelling (extern), verifieerbare
  credentials (MENSNETWERK besluit 4), mbo/hbo-diepte in de Fabric.

**Proces 3: het bijlesbureau als onderneming.**
- Stappen: bureau opzetten (Onderneming) → bijlesgevers aannemen (Werk OS,
  personeel) → leerling of ouder machtigt bijlesgever → lessen inplannen →
  voortgang alleen via machtiging → facturen aan ouders.
- Apps: Onderneming, Werk OS, Vertegenwoordiging, School, Agenda.
- Buiten scope: een genre "bijles" met persoonseis (VOG; `kern/persoonseis.js`
  kent werkreikwijdte voor kinderopvang, te controleren of bijles eronder
  valt); besluit.

---

## Vraagt besluit

**1. Wie bezit het leerdossier van een kind dat via een school oefent?**
- **A. Het paspoort blijft van de leerling (`leren.school`); de school bezit
  alleen haar eigen dossier en schrijft bewijs in, met bron** (aanbevolen).
  Kost een bron-veld en de toets op voorwaarde 3.
- B. De school bezit het paspoort zolang de leerling ingeschreven is. Sluit aan
  op de AVG-termijnen van de school; dan zijn er twee eigenaren per jaar.
- C. Gedeeld eigendom. Geen werk nu; strijdig met "geen tweede eigenaar".

**2. Hoort de docent- en schoolkant in deze kaart?**
- **A. Nee: eigen kaart voor `werk.schoolbeheer`; deze kaart beschrijft alleen
  de naad** (aanbevolen). Kost een extra kaart.
- B. Ja, één kaart School. Minder documenten; mengt twee eigenaren.

**3. Bijles en coach via Vertegenwoordiging?**
- **A. Ja, hoedanigheid `coach` met een nieuwe leesbevoegdheid
  `leren.lezen`** (aanbevolen). Kost een besluit over de gesloten lijst (klein).
- B. Een eigen deelfunctie in School. Sneller; tweede rechtenmodel.

**4. Student Twin**
- **A. Later, als projectie zonder opslag en met klasse `advies`**
  (aanbevolen). Middel.
- B. Nu, opgeslagen profiel. Sneller rekenen; een opgeslagen profiel is een
  plakkend label (voorwaarde 2).
- C. Niet.

**5. Officieel leerlingvolgsysteem worden (uit B, proces 1)**
- **A. Niet vóór V1; besluit na Edu-V/Entree-contract** (aanbevolen). Kost
  niets nu.
- B. Nu aanvragen. Groot: juridische en inspectieverplichtingen.
