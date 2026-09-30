# RTG Academy: het leerhuis

*Richtingsdocument én bouwverslag, zoals `PLATFORM.md` en `ECONOMIE.md`: per
onderdeel staat er of het **staat**, **een stap weg** is, **een besluit vraagt**
of **jaren weg** is. "De opdracht, par. N" in de code verwijst naar de
masteropdracht van 27 september 2026 (People, Knowledge, Academy & Human
Capability Infrastructure), paragraaf N. Bijlage A zet die veertig paragrafen
naast wat er staat.*

De kern in één zin: **RTG Academy is geen plek met cursussen maar een gesloten
lus van behoefte naar bewezen vakmanschap en weer terug, en elke stap in die lus
laat een spoor na dat een ander kan nalezen.**

De stand op 27 september 2026:

```
LOOP_COMPLETENESS=CLOSED   (25/25 schakels, 5/5 storingen; npm run leerhuisproef)
ACADEMY_STATUS=BLOCKED
```

Allebei zijn eerlijk, en ze worden nooit opgeteld. De lus sluit in de REGELS
(`server/kern/leerhuis/`): van een behoefte aan een operationsmens tot de
leerling van gisteren die de volgende leerling traint, via een kennisverandering
die uit de praktijk kwam. De Academy is toch niet klaar voor productie, want er
staan drie P0-blokkades open. Die staan hieronder bij naam, en de proef leest ze
uit dezelfde lijst (`BLOKKADES` in `scripts/leerhuisproef.js`).

| blokkade | klasse | wat er ontbreekt | sluit met |
|---|---|---|---|
| `UI` | UX | Mijn leerhuis staat (`/apps/leerhuis.html`, alleen lezen, bereikbaar vanuit Mijn loopbaan), met het trainer- en teambeeld op codenaam (`kern/leerhuis/namen.js`). Het werkscherm staat ook (`/apps/leerhuis-werk.html`, leeskant in `kern/leerhuis/werk.js`): een trainer bevestigt toezicht en gereedheid, legt bewijs vast dat hij zag en vraagt een beoordeling aan (`leerhuis-werk-bewijs.js`; de vaardigheden en bewijssoorten komen uit de trainercockpit, en van een beoordeling ziet hij alleen OF hij loopt), een assessor begint en rondt een beoordeling af, een kenniseigenaar zet een concept ter review of activeert het, een manager wijst zijn team een rol toe en maakt het startplan, een curriculumeigenaar brengt een curriculum van concept naar actief (`leerhuis-werk-inrichten.js`, leeskant `curriculumWerk`; de overgangen komen uit de tabel in `standen.js`), de eigenaar legt relaties en bestuursrollen vast op codenaam met een reden (besluit B8, leeskant `eigenaarWerk`), en de curriculumeigenaar schrijft kennis (als concept, dat hij zelf ter review zet), vaardigheden, rollen, curricula en scenario's (`leerhuis-werk-schrijven.js`; een scenario zonder vereiste stap weigert de server, want het meet niets; de keuzes komen uit `curriculumWerk`, de kwaliteitsautoriteit krijgt ze niet). de certificaatautoriteit geeft certificaten uit en schorst of trekt ze in, en de trainerautoriteit kwalificeert, bevestigt en wijst trainers toe (`leerhuis-werk-autoriteit.js`, leeskant `kern/leerhuis/werk-autoriteit.js`). De leerling zet op Mijn leerhuis zijn EIGEN stappen (`leerhuis-mijn.js`): beginnen, oefenen, een scenario spelen -- de stappen door elkaar en op alfabet, want welke vereist en welke verboden zijn zegt de motor pas na het spelen, en een mislukte poging laat geen bewijs achter -- en een beoordeling aanvragen. Beide schermen gaan door een deur (`leerhuis-deur.js`: sleutel, navragen bij onbekend, eerst laden en dan melden). De eigenaar trekt een rol in (met reden; `rolIntrekken` weigerde die eerst niet, en ook geen rol die iemand niet droeg) en meldt iemand uit dienst, pas na een vinkje dat zegt wat er vervalt. De kwaliteitsautoriteit behandelt een bezwaar, verklaart een beoordeling van een ander ongeldig (met reden) en stelt geschiktheidsbeleid voor dat een ander goedkeurt (`leerhuis-werk-kwaliteit.js`, leeskant `kwaliteitWerk`); het oordeel achter een bezwaar -- uitslag, criteria, herstelpad -- staat pas op de kaart als hij de review op zich nam, en pas dan ook het bewijs eronder, dat hij met een reden kan intrekken (ingetrokken bewijs blijft staan, met die reden); de eigenaar ziet alleen het beleid. De leerling ziet op Mijn leerhuis zijn eigen uitslagen met het herstelpad, maakt bezwaar (met reden, en niet twee tegelijk -- `bezwaarIndienen` weigerde dat eerst niet, en ook geen bezwaar tegen een beoordeling die nog liep) en dient een EVC in; de assessor erkent het stuk, deels of niet, en ook erkend blijft het vastgelegd bewijs en geen bewezen vaardigheid. Onder Mijn werk ziet de leerling per goedgekeurd beleid of hij geschikt is -- zo niet, in woorden wat er ontbreekt en geen knop -- en legt hij werk vast (`werkVastleggen`, dat de geschiktheid opnieuw rekent); geschikt is nog steeds geen bevoegdheid. Een voorstel uit de praktijk dient iedereen met een lopende relatie in op Mijn leerhuis (zonder rol, en het kennisitem is een keuze), en volgt daar de stand en de toelichting; de kenniseigenaar behandelt het langs de overgangstabel zonder te zien wie het indiende (alleen of hij het zelf was, en dan beslist een ander), schrijft na goedkeuren een nieuwe versie die naar het voorstel verwijst, en pas als een ander die versie activeerde staat het voorstel op uitgevoerd (`leerhuis-werk-voorstellen.js`, leeskant `kennisWerk`). De eigenaar legt de eenheden van zijn organisatie vast (naam, soort, en onder welke eenheid) en plaatst een relatie in een eenheid (leeskant `eigenaarWerk`); `relatieZet` nam eerst een eenheid aan die niet bestond, en `eenheidZet` hing een eenheid zonder bezwaar onder een van haar eigen onderdelen -- beide weigeren nu, met de reden. Daarmee hebben 36 van de 37 handelingen een scherm (geteld als: de naam van de handeling staat in een van de schermbestanden van het leerhuis; een eerdere telling van 21 was er een te veel); de zevenendertigste, `orgOpen`, is met opzet van het kantoor. Wat nog geen scherm heeft zijn LEESVRAGEN: de bestuursvragen (`gereedheid`, `eenheid`, `wieGeraakt`, `reconstrueer`, `certStand`, `schaduw`) en de waarom-vragen (`waaromLeren`, `waaromVerversen`, `waaromNietGereed`, `geschiktheid`, `loopbaan`, `waaromTrainer`, `grond`, `vakstaat`), geteld op dezelfde manier | fase B-UI: het bestuurswerk (par. 6) |
| `DOMEINPOORT` | AUTHORITY | `POST /api/office/pay/factuurcorrectie` leest de geschiktheid mee, maar alleen in de schaduw (besluit B1): geschiktheid verandert nog nergens een recht | afdwingen als de schaduw rijp is en nul keer oneens staat; dat is een volgend besluit |
| `IDENTITEIT` | TENANT_ISOLATION | een leerhuis met een bron (entiteit, zaak of RTF-stad) volgt die bron; maar RTG zelf heeft nog geen entiteit, dus juist het leerhuis van RTG Operations draait nog op een verklaring | RTG als entiteit in RTG Concern (de eigenaar) |

---

## 1. De gap-matrix

Eerst gemeten, dan gebouwd (de opdracht, par. 3 en 39). Drie verkenningen over
`server/`, `public/` en de diepte-documenten. De kolom *besluit* zegt wat er met
het bestaande gebeurt: HERGEBRUIKEN (aanroepen zoals het is), UITBREIDEN
(daarin bijbouwen), NIEUW (er is niets bruikbaars) of BOTST (bestaat met een
andere betekenis, dus niet aanraken en een eigen naam kiezen).

| onderdeel uit de opdracht | stand in de code | besluit | waar |
|---|---|---|---|
| identiteit, codenamen | BESTAAT | HERGEBRUIKEN | `accounts.js`, sleutel `lid:<id>` zoals `kern/vakbewijs.js` |
| organisatie / tenant | BESTAAT, drie keer | HERGEBRUIKEN als sleutel, niet als model | `kern/tenant/`, `kern/concern/`, `kern/rtfos/steden.js`, `bedrijf/` |
| dienstverband / relatie | DEELS, drie modellen die elkaar niet lezen (ARBEID.md par. 3) | NIEUW (dun) + besluit B2 | `kern/concern/employment.js` is de gekozen waarheid (ARBEID.md par. 7a) |
| rollen en rechten | BESTAAT, vijf vocabulaires (AUTHORITY.md par. 1) | BOTST: geen zesde | leerhuis kent alleen BESTUURsrollen van de Academy zelf |
| bevoegdheid (authority) | BESTAAT in de schaduw | HERGEBRUIKEN, via besluit B1 | `kern/beleidsmotor/`, `kern/persoonseis.js` |
| organisatiegraaf | DEELS | NIEUW (dun), in het spoor | `eenheid`-gebeurtenis; `orggraaf` blijft vrij voor AUTHORITY.md |
| competentie | ONTBREEKT (vrije tekst op negen plekken, ARBEID.md #103) | NIEUW als `vaardigheid` | `server/kern/leerhuis/` |
| Knowledge Core | DEELS: kennisbank met eigenaar, versie en houdbaarheid, zonder goedkeuring en zonder afhankelijkheden | NIEUW naast de kennisbank + besluit B3 | `server/bedrijf/kennis.js` |
| curriculum / leerpad | DEELS: `leerstof`, `onderwijs` en School, allemaal voor leerlingen en niet voor werk | NIEUW | niet in `leerstof-*`: dat is een andere doelgroep met eigen grenzen (SCHOOL.md) |
| Personal Start Plan | DEELS: `bedrijf/indienst.js` (zes stappen, plant uitdrukkelijk geen training) | NIEUW, afgeleid | `leerhuis/startplan.js` |
| oefenen / zandbak | BESTAAT: `command/zandbak.js`, Magnaat | HERGEBRUIKEN later; V1 heeft een eigen scenario-oordeel | `leerhuis/acties-simulatie.js` |
| simulatie | BESTAAT vier keer, geen voor mensen beoordelen | NIEUW (klein, deterministisch) | idem |
| bewijs | DEELS: `onderwijs-bewijs.js`, `carriereledger`, `connect/leerdossier` | NIEUW, met de graadvorm van het leerdossier | wie schrijft bepaalt de sterkte |
| beoordeling | DEELS: `toetsbouw`, `toetsspiegel`, `schooladvies` (leerlingen) | NIEUW | |
| certificering | ONTBREEKT (`onderwijs-ladder.js`: "wij claimen geen diploma's") | NIEUW | niet `vakbewijs`: dat is een EXTERN stuk dat RTG zag |
| trainer / mentor / assessor | ONTBREEKT voor werk; `trainer` en `mentor` zijn bezet (sport, school) | NIEUW | eigen ladder in `standen.js` |
| manager-, trainercockpit | ONTBREEKT | NIEUW (leeskant); als leesdeel van Mijn leerhuis, op codenaam | `leerhuis/zicht.js`, `leerhuis/namen.js` |
| workforce readiness | DEELS: `concern/readiness.js` meet een ENTITEIT | NIEUW voor mensen, dezelfde vorm | `leerhuis/gereedheid.js` |
| impactanalyse | ONTBREEKT | NIEUW, als projectie | `leerhuis/graaf.js` |
| audit / historie | BESTAAT | HERGEBRUIKEN | `lib/keten.js` |
| idempotentie | BESTAAT per route | HERGEBRUIKEN de vorm; in de kern op sleutel | `leerhuis/index.js` |
| gebeurtenissen / jobs | BESTAAT (`bus.js`, `envelop.js`) | nog niet aangesloten | par. 6, P1 |
| AI-coach | BESTAAT als patroon (`ai/prompt.js`, positieve veldlijst) | alleen de GROND gebouwd | `leerhuis/uitleg.js` `grond()` |
| 18+-grens op progressie | BESTAAT | BOTST mogelijk | besluit B5 |

## 2. Namen

Gemeten over `server/` en `scripts/`, 27 september 2026.

| voorgesteld | bezet door | gekozen |
|---|---|---|
| Academy (als code) | `scope 'academy'` in `scripts/lib/magnaatgrondwet.js` (het Oefenkantoor) | **`leerhuis`** (0 treffers). *RTG Academy* blijft de naam voor mensen |
| Competency, Capability | *capability* is platformvermogen (OS.md); HDI.md par. 2 wijst `vaardigheid` aan | **`vaardigheid`** |
| Skills Passport | `paspoort` (207 bestanden) | **vakstaat** (een projectie, geen dossier) |
| Knowledge Graph | een tweede graaf naast de rest is de `Asset`-fout | een PROJECTIE (`graaf.js`), zoals `kern/levensgraaf/graaf.js` |
| trainer, mentor | `trainingsschema.js` (fitness), School (mentor) | als TREDEN op de ladder, niet als modulenaam |
| simulatie | vier modules | `acties-simulatie.js` binnen het leerhuis, geen nieuwe laag |
| policy, capability, machtiging, mandaat, benoeming | allemaal bezet (AUTHORITY.md par. 2.5) | **beleid** binnen het leerhuis, en het heet een *geschiktheidsbeleid* |
| readiness | `concern/readiness.js` (een entiteit) | **gereedheid** (een mens, een team, een eenheid) |
| NIVEAUS, BEWIJSSOORTEN, RELATIES, VOLGENDE | `NIVEAUS` draagt al negen betekenissen (HDI.md par. 2), `BEWIJSSOORTEN` staat in `onderwijs-bewijs.js` met andere leden | **VAARDIGHEIDSNIVEAUS**, **LEERBEWIJS**, **RELATIESOORTEN**, **VOLGENDE_STAP**. De eerste versie gebruikte de bezette namen; `npm run semantiek:vast` zag het, niet het lezen |
| verifieer, impact, projecteer, gereedheid (functies) | elk al in twee andere kernmodules (de keuring, groep dubbeling) | `spoorKlopt`, `geraakt`, `standUitSpoor`, `teamGereed`; de sleutels naar buiten bleven gelijk |

## 3. Botsingen met grondregels, en hoe het is opgelost

1. **Geen zesde rechtenmodel** (AUTHORITY.md INT-01, CONCERN.md). Het leerhuis
   deelt geen rechten uit. `geschiktheid()` in `brug.js` geeft hoogstens
   AUTHORITY_ELIGIBLE en draagt altijd `verleent: false`. De bestuursrollen
   (ACADEMY_OWNER, KNOWLEDGE_OWNER, ASSESSOR ...) gaan alleen over handelingen
   BINNEN het leerhuis. Hoe een domeinpoort de uitslag als feit leest, is besluit B1.
2. **Geen score op een mens** (CARRIERE.md par. 4.1, KANTOORMACHT.md, INT-04).
   Gereedheid is een lijst van wat ontbreekt en wat verloopt. Loopbaan is READY,
   NEARLY_READY, DEVELOPING of NOT_ELIGIBLE met de ontbrekende stukken, en de
   promotie blijft een menselijk besluit. Een trainer wordt gekozen op de minste
   leerlingen (rust), nooit op wie "beter" is. De managercockpit noemt uitdrukkelijk
   wat hij niet toont.
3. **Twee kennislagen.** `server/bedrijf/kennis.js` is de kennisbank van een
   werkruimte: eigenaar, versie, houdbaarheid, maar geen goedkeuring en geen
   afhankelijkheden. De Knowledge Core van de opdracht vraagt die twee wel. Er
   staat nu dus een tweede kennislaag, en dat is een schuld met een naam: besluit B3
   (genomen: samenvoegen).
4. **De 18+-grens op progressie** (`progressieMag`, CLAUDE.md). Een certificaat en
   een vakstaat zijn opgeslagen progressie. Voor werk is dat de bedoeling, maar een
   RTF-vrijwilliger kan jonger zijn. De uitzondering van 14 september voor een
   leerdossier (niet vergelijkend, geen blijvend niveaulabel) dekt een certificaat
   niet vanzelf. Dat is besluit B5, en het is uitgevoerd: een certificaat alleen
   voor wie de 18+-poort haalt, leren en bewijs op elke leeftijd.
5. **De actor komt uit de sessie** (AUTHORITY.md grens 1). De kern neemt `door` als
   argument en vertrouwt nooit een veld uit een verzoek; `server/routes/leerhuis.js`
   haalt hem uit `req.session.key` (of `req.kantoorKey` op naam), en toets 4 van
   `test/leerhuis-routes.test.js` zakt zodra een veld uit het lijf meetelt.

## 4. Het model

**Eén spoor per organisatie, gekettend.** `db.data.leerhuis[org]` is een lijst
gebeurtenissen, nieuwste vooraan, elk met de hash van zijn voorganger
(`lib/keten.js`). Er is geen tabel met standen: `projectie.js` rekent ze bij elke
vraag uit het spoor. Er is geen gedeelde lijst mensen, bewijzen of certificaten
over organisaties heen, dus een certificaat in A kan structureel niet naar bewijs
uit B wijzen. Isolatie is hier geen filter maar het ontbreken van een opzoeking.

**Standen.** De gebeurde standen zijn machines met een overgangstabel
(`standen.js`): kennis, curriculum, leren, beoordeling, voorstel, bezwaar en EVC.
De berekende standen (certificaat, versheid van bewijs, geschiktheid, gereedheid,
eenheid) worden nooit opgeslagen.

**Handelingen.** 37 stuks, elk met de projectie, de invoer, de actor en een klok.
Een handeling geeft gebeurtenissen terug of gooit een weigering met reden, status
en waar het kan de weg eromheen. `index.js` schrijft ze alles-of-niets en
idempotent op een sleutel (`uitkomst()` voor wie geen antwoord kreeg).

**Wie mag welk bewijs zetten.** De sterkte volgt uit wie schrijft: SELF_REPORTED
de mens zelf, DOCUMENTED en OBSERVED een geldige trainer of assessor, ASSESSED
alleen een assessor, SYSTEM_VERIFIED alleen de simulatiemotor. EVC maakt van een
extern stuk hoogstens DOCUMENTED bewijs. PROVEN komt altijd uit een eigen beoordeling.

**Scheiding van taken** (de opdracht, par. 22), elk als code en elk door een toets
bewaakt: wie kennis schrijft keurt haar niet goed; de trainer is bij een kritieke
vaardigheid niet de assessor; de manager beoordeelt zijn eigen medewerker niet;
niemand certificeert, benoemt of kwalificeert zichzelf; wie een beleid voorstelt
keurt het niet goed; een assessor verklaart zijn eigen oordeel niet ongeldig.

**De kennislus.** Een voorstel uit de praktijk verandert nooit ACTIVE kennis. Het
wordt pas IMPLEMENTED als er een ACTIVE versie bestaat die ernaar wijst. Een
opvolgende versie gaat niet ACTIVE zonder impactklasse, en `graaf.js` rekent uit
wie en wat er geraakt wordt. Trainers moeten eerst zelf bij zijn voordat ze weer
les mogen geven. Vanaf ASSESSMENT_REQUIRED krijgen geraakte mensen hun leerpad
opnieuw, met de reden erbij; bij LEARNING_UPDATE volstaat één nieuw stuk
kennisbewijs. Een certificaat dat vóór een RECERTIFICATION_REQUIRED-wijziging is
uitgegeven, blijft REFRESH_REQUIRED: de mens krijgt een nieuw certificaat en het
oude blijft als historie staan.

## 5. Besluiten van de eigenaar (27 september 2026)

De zes vragen zijn op 27 september 2026 als meerkeuze aan de eigenaar voorgelegd.
Vijf keer koos hij het voorstel; bij B3 koos hij de zwaardere variant, en de
vulling van het leerhuis werd een zevende besluit.

| # | vraag | besluit | wat het kost | stand |
|---|---|---|---|---|
| B1 | Welke domeinpoort leest AUTHORITY_ELIGIBLE als feit? | **één handeling, in de schaduw van de beleidsmotor** (de keuze werd aan de bouwer gelaten; dit was het voorstel): de poort leest de geschiktheid mee en telt eens/oneens, en houdt niemand tegen | de handeling is `POST /api/office/pay/factuurcorrectie` (geld terug naar een lid, `betaling.terugboeken` in het RTG-leerhuis). De meelezer (`kern/leerhuis/schaduw.js`, gehangen in `opzet/kantoordeur.js`) telt alleen afgeronde 2xx: eens, oneens (afdwingen had hem tegengehouden) of onbekend, zonder namen. Hij staat NAAST de beleidsmotor en niet erin: dat bestand zit net onder de band van keuringsregel 13, en een deur-motor die per handeling denkt is een ontwerpstap van AUTHORITY.md. Het bestuur leest de tellers met de vraag `schaduw` | **staat** in de schaduw; DOMEINPOORT blijft tot afdwingen |
| B2 | Welke relatie is de waarheid? | **per soort bron**, met een brug die één kant op loopt. De meting vond twee gaten in het voorstel, en daarover besliste de eigenaar opnieuw: **RTG is geen entiteit** in kern/concern (en `employment` is leeg), dus RTG wordt **eerst als entiteit ingericht** in RTG Concern; en **RTF-vrijwilligers hangen niet aan een account** (alleen aan een naam en een RTFV-code), dus voor RTF tellen **nu de zetels**, en komt er een koppeling vrijwilliger naar eigen account die de vrijwilliger ZELF bevestigt | een leerhuis krijgt bij het openen een `bron` (`entiteit`, `zaak` of `rtf-stad`); `kern/leerhuis/bron.js` vraagt hem per keer na en kopieert niets. Entiteit: eigenaar of LOPEND dienstverband, geen mandaat. Zaak: actieve plek in het personeel. RTF-stad: een zetel, of een ACTIEVE vrijwilliger die zijn dossier zelf aan zijn account koppelde (ingelogd EN met zijn RTFV-code; nooit op naam gezocht; een coordinator kan alleen losmaken, met een reden; `kern/rtfos/vrijwilligeraccount.js`). Een relatie die de bron niet draagt kan niemand verklaren, en een beeindigd dienstverband beeindigt de relatie vanzelf (grenzen 19 en 20, routes 8, `test/leerhuis-rtfbron.test.js`) | **staat** voor entiteit, zaak en RTF-stad; **RTG wacht** op zijn entiteit (inrichting door de eigenaar: rechtsvorm, KvK, bestuurders worden niet verzonnen) |
| B3 | Kennisbank en Knowledge Core? | **samenvoegen**: de kennisbank van een werkruimte (`server/bedrijf/kennis.js`) krijgt review, goedkeuring en afhankelijkheden en wordt de Knowledge Core | raakt elke bestaande werkruimte en haar artikelen; vraagt een migratie die per artikel byte voor byte vergelijkt, en een besluit over wie in een werkruimte KNOWLEDGE_OWNER is | jaren weg is het niet, maar het is het grootste stuk werk van de zeven |
| B4 | Duurzaam? | **ja, drie handelingen**: `certificaatUitgeven`, `certificaatStand`, `beoordelingAfronden` | een regel op de lijst van regel 47 (`kern/leerhuis/index.js`); de route gaat via `doeVast()`, de synchrone `doe()` weigert die drie zodra er een bundel is. Een mislukte commit heet ONBEKEND en niet mislukt, want `db/bijeen.js` draait het geheugen niet terug: eerst `uitkomst` navragen, dan opnieuw met dezelfde sleutel (toets 17) | **staat** |
| B5 | 18+? | **18+ voor een certificaat**: onder de 18 wel leren, oefenen, bewijs en beoordeling in de vorm van het leerdossier (niet vergelijkend, geen niveaulabel); geen certificaat en geen vakstaat als niveau | de ledendeur vraagt alleen een eigen account; `certificaatUitgeven` vraagt dat de ONTVANGER `volwassen()` haalt, en een sleutel buiten `lid:` telt als niet vast te stellen (fail closed). Wie jonger is, ziet zijn vaardigheden zonder niveaulabel (routetoets 5) | **staat** |
| B6 | Wie opent een leerhuis? | **het kantoor op naam** (`kluisAuth`), voor elke soort organisatie | een Business-zaak vraagt RTG | **staat** |
| B7 | Waarmee wordt het leerhuis gevuld? | **alles**: het RTG-eigen Operations-leerhuis (V1), een startpakket per soort organisatie (RTG, RTF-stad, Business, Supplier), en een demo-organisatie in de zaaiset | inhoud is officiele kennis en moet door een mens worden goedgekeurd: de bouwer zet CONCEPTEN klaar, een KNOWLEDGE_OWNER activeert. De mensen in de rollen (trainer, assessor, kenniseigenaar) wijst de eigenaar aan; die worden niet verzonnen. De demo in de zaaiset draagt zichtbaar dat hij demo is | **de startpakketten staan** (`kern/leerhuis/startpakket.js`, voor RTG, RTF, BUSINESS en SUPPLIER): acht concepten per pakket (drie kennisitems, twee vaardigheden, een rol, een curriculum, een oefening), geladen langs de gewone handelingen met een sleutel per stuk, alleen door een CURRICULUM_OWNER, en wat er al staat wordt overgeslagen. Een concept uit een pakket wordt pas officiele kennis als een KNOWLEDGE_OWNER die het niet zelf laadde, bij het activeren de EIGEN bron van de organisatie noemt (grenzen 21, routes 9). **Nog niet**: de mensen in het RTG-eigen leerhuis (wijst de eigenaar aan) en de demo in de zaaiset |

**B8 (29 september 2026): een mens aanwijzen op codenaam.** Gevraagd als
meerkeuze (codenaam, alleen wie al bekend is, uitnodiging, nog niet bouwen); de
eigenaar koos het voorstel. De eigenaar van een leerhuis legt een relatie of een
bestuursrol vast met `codenaam` (en voor de manager `managerCodenaam`) in plaats
van een sleutel, plus een verplichte `reden`. `kern/leerhuis/aanwijzen.js` volgt
de volgorde van `balieDossier` in `kern/ledenbalie-inzage.js`: alleen de
EIGENAAR van dit leerhuis mag zoeken (anders is het een orakel voor wie een
relatie heeft), zonder reden geen opzoeking, dan de gids (`keyVanCodenaam`),
dan een regel via `noteerVast` MET het id van het lid -- zo staat hij op de
inzagekaart van die persoon -- en pas als die regel vaststaat gaat de sleutel
naar de handeling. Een codenaam die niet bestaat raakt geen lid en schrijft geen
regel. Alleen `relatieZet` en `bestuurZet` lopen zo; de handeling beslist daarna
alles, zoals bij een sleutel. Bewijs: grenzen 25 (drie mutaties gezakt), routes
12, en het werkscherm in `test/leerhuis-werk.e2e.js` stap 4.

## 6. Bouwvolgorde

De opdracht, par. 32 en 33: eerst één verticale lus, dan pas breedte.

| fase | stand | wat |
|---|---|---|
| A Foundation | **staat** | gap-matrix, domeinmodel, grenzen, rol, vaardigheid, kennis, bewijs, standmachines |
| B First Loop (kern) | **staat** | startplan, My Academy, trainer, oefenen, beoordeling, certificaat, brug |
| B-API | **staat** | drie routes (`/api/leerhuis/doe`, `/api/leerhuis/lees`, `/api/office/leerhuis/open`), de actor uit de sessie, een sleutel verplicht, alleen volwassen gekeurde leden, functie `leerhuis` standaard UIT; `test/leerhuis-routes.test.js` tegen een echte server, vijf mutaties nagetrokken |
| B-UI | **een stap weg** | vier schermen (TODAY, PATH, PRACTICE, SKILLS, GROWTH, COACH voor het lid); vraagt B-API |
| C Trainer Loop | **staat** in de kern | trainerladder, Train-the-Trainer als eigen vaardigheid, cockpit, gescheiden assessor |
| D Knowledge Loop | **staat** in de kern | voorstel, versies, impact, verversen, hercertificering |
| E Management | **staat half** | gereedheid, eenheid, busfactor, loopbaan; nog geen capaciteitsplanning over tijd |
| F Ecosystem | **staat** als isolatie | RTF, Business en Supplier gebruiken dezelfde motor met een eigen spoor; nog geen stadssjablonen |
| G AI | **een stap weg** | alleen de grond (`grond()`); de coach zelf komt pas na B-API en met een lokaal model |
| gebeurtenissen en jobs | **een stap weg** | verloop van certificaten wordt nu bij elke vraag gerekend; een melding bij EXPIRING vraagt de bus |

**P0** (voor ACADEMY_STATUS=READY): de vijf blokkades hierboven.
**P1**: gebeurtenissen op de bus (PERSON_JOINED, COMPETENCY_PROVEN,
CERTIFICATION_EXPIRING, KNOWLEDGE_IMPACT_DETECTED), herstelproef van het spoor,
bezwaar met een tweede assessor, overdracht bij vertrek van een kenniseigenaar.
**P2**: stadssjablonen, teamdrills, human readiness als releasepoort, een
interne talentmarkt (die wacht op ARBEID.md #104).

## 7. Bewijs

- `npm run leerhuisproef`: de gouden lus, 25 schakels van NEED tot NEXT
  TRAINEE plus AUDIT, elk gemeten bij de ontvanger, en vijf storingen
  (zelfcertificering, dubbel certificaat, verlopen certificaat, vertrek,
  gemanipuleerd spoor).
- `test/leerhuis-lus.test.js`: de lus als toets, plus de eis dat de status
  BLOCKED blijft zolang er blokkades zijn en dat elke blokkade hier staat.
- `test/leerhuis-grenzen.test.js`: de zestien negatieve en adversariële gevallen
  uit de opdracht, par. 35. Daartoe horen de zeven invarianten als
  eigenschapstoets over 4000 handelingen, de isolatieproef (RTG, RTF, twee
  zaken) en de reproductieproef (stad A leidt het kernteam van stad B op; B gaat
  van BLOCKED via DEPENDENT naar SELF_SUSTAINING en leidt het volgende cohort zelf op).

Elke grens in de toetsen is met een mutatie nagetrokken (zie de kop van het
toetsbestand). Vier fouten zijn door de proeven gevonden en niet door lezen:

1. `impact()` vergeleek een trainerkwalificatie (een object) met een id, en meldde
   daardoor nooit een trainer als geraakt.
2. De certificaatstand keek naar het huidige bewijs van de MENS en niet naar het
   certificaat. Een oud certificaat werd daardoor weer ACTIVE zodra iemand
   opnieuw bewees.
3. Een id van de aanroeper dat al bestond, verving in de projectie stil het oude
   object. Een afgeronde beoordeling kon zo verdwijnen: historie herschrijven.
4. De eigenschapstoets zelf bewees eerst bijna niets. Van 600 handelingen
   slaagden er 4, omdat de lage bits van de pseudo-random generator een korte
   periode hebben. Hij eist nu dat er echt beoordeeld en gecertificeerd wordt.

## 8. Grenzen

1. **Bekwaam is niet bevoegd, en gecertificeerd ook niet.** Het leerhuis verleent niets.
2. **Geen score op een mens**, ook niet intern als sorteersleutel.
3. **Niemand keurt zijn eigen werk goed**: kennis, beleid, beoordeling, certificaat, trainerschap.
4. **Historie wordt niet herschreven.** Intrekken is een nieuwe regel, en een bestaand id krijgt geen nieuwe geschiedenis.
5. **Onbekend is niet ja.** Een ontbrekende vaardigheid, een beleid zonder tweede handtekening of een verlopen stuk geven NOT_ELIGIBLE, met de reden erbij.
6. **Narratief is geen oordeel.** Een model mag een simulatie aankleden en een antwoord navertellen, maar de uitslag komt uit regels.
7. **De coach kent alleen ACTIVE kennis**, en zonder bron zegt hij ONBEKEND. Inhoud is nooit een instructie aan de coach.
8. **Oefenen is zonder gevolgen**: een mislukte simulatie laat geen bewijs na.

## 9. Wat hier niet bewezen is

- De lusproef zelf draait zonder server. De HTTP-deur is apart bewezen
  (`test/leerhuis-routes.test.js`): de actor komt uit de sessie, een veld `door`
  in het lijf verandert niets, dicht is dicht zolang de functie uit staat. Er
  komt nog geen browser aan te pas (blokkade `UI`).
- Er is geen schaalbewering. De projectie loopt per vraag over het hele spoor van
  één organisatie (O(n)). Voor een organisatie met honderdduizend mensen en
  miljoenen bewijsstukken is een momentopname per persoon nodig, en die is er
  niet. Er staat hier dus geen getal.
- Het spoor is lokaal gekettend en niet extern verankerd (`lib/keten.js`, de kop).
  Wie de nieuwste regels weggooit, valt niet op.
- De simulatie is een regelcontrole over gekozen stappen, geen zandbak. Ze meet
  of iemand de juiste stappen in de juiste volgorde kent, niet of hij ze onder druk zet.
- De koppeling van een vrijwilliger legt zijn accountsleutel naast zijn naam in het
  RTF-register, zoals een zetel dat al deed. Dat is een pad van account naar naam
  buiten de kluis, en er staat nog geen bewaartermijn op (`scripts/afleidbaar.js`
  heeft hem niet opnieuw gemeten). Wie een code meeleest, kan een dossier dat nog
  niet gekoppeld is aan zijn eigen account hangen; de rem is dat het portaal dat
  toont, dat de coordinator het kan losmaken, en dat een koppeling in het leerhuis
  niets verleent zolang de stad hem niet zelf opneemt.

## Bijlage A. De opdracht per paragraaf

| par. | onderwerp | stand |
|---|---|---|
| 1, 2 | missie, grondwet | de twintig regels: 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 16, 17, 18, 19 en 20 in code; 9 (assessor is geen kenniseigenaar) als losse bestuursrollen; 13 (geen checkbox-overload) in de verversregel; 14 (AI) als grens zonder AI; 15 (kwaliteit meten) nog niet |
| 3 | eerst onderzoeken | par. 1 hierboven |
| 4 | conceptuele architectuur | één module met projecties, geen services |
| 5 | multi-organisatie | een spoor per organisatie; RTG, RTF, BUSINESS, SUPPLIER, PARTNER, PROJECT |
| 6 | organisatie-, rol-, competentiegraaf | rol en vaardigheid staan; de organisatiegraaf is dun (`eenheid`) |
| 7 | Knowledge Core | staat, met besluit B3 |
| 8 | curriculum, startplan | staat |
| 9 | My Academy, vakstaat | leeskant staat, ook over HTTP (`lees`); scherm niet |
| 10 | leerstandmachine | staat |
| 11 | oefenen, simulatie, bewijs | staat, simulatie klein |
| 12 | beoordeling, certificaat, brug | staat, brug met besluit B1 |
| 13 | trainer en mentor | staat |
| 14 | manager, loopbaan | leeskant staat |
| 15 | gereedheid, reproductie | staat |
| 16 | RTF, Business, Supplier | als isolatie; eigen rolladders van Business en Supplier niet voorgebakken |
| 17 | kennisverandering | staat |
| 18 | hercertificering, EVC | staat; PERIODIC via `geldigDagen`, PRACTICE_DEPENDENT nog niet |
| 19 | levenscyclus | aanname, vertrek en terugkeer (berekend); overplaatsing niet apart |
| 20 | AI | alleen de grond |
| 21 | privacy, fairness | minste kennis per lezer; bewaartermijn en export ontbreken |
| 22 | governance | staat |
| 23 | standen, integriteit | staat; gelijktijdigheid is in één proces vanzelf serieel, over processen niet bewezen |
| 24 | gebeurtenissen, jobs | een stap weg |
| 25 | dreigingsmodel | toetsen 1 tot en met 14 |
| 26, 27 | UX, leren in het werk | een stap weg |
| 28 | human readiness, drills | jaren weg |
| 29 | organisatiegeheugen | vertrek staat; overdracht van eigenaarschap niet |
| 30 | prestatie | niet gemeten (par. 9) |
| 31 | contracten, opslag | domeinacties staan, drie routes met een mutatiecontract; opslag in een spoor, geen JSON-blob als stand |
| 32, 33 | volgorde, V1 | par. 6 |
| 34 | gouden bewijzen A tot en met E | A, B, C in de lusproef; D en E in de grenzentoets |
| 35 | negatieve toetsen | staat |
| 36 | uitleg | `uitleg.js` |
| 37 | Definition of Done | ACADEMY_STATUS=BLOCKED |
| 38 | eindacceptatie | LOOP_COMPLETENESS=CLOSED |
