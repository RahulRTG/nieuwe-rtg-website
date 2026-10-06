# RTG Learning Loops — architectuuronderzoek

**Onderzoeksbasis:** lokale `HEAD` `0055a1b2d` (`Build LibraryOS Studio and private Reader`), bovenop `22eda5459` en basis `155820a40`.

**Datum:** 4 oktober 2026.

**Scope:** WorkOS, TravelOS, LivingOS, FoundationOS en de relevante RTG-domeinen daaronder.

**Uitdrukkelijke grens:** dit document verandert geen applicatiecode en is geen implementatiebesluit.

## 1. Executive conclusion

De voorgestelde lus — `Intent → Action → Experience → Outcome → Evidence → Reflection → Knowledge → Change → Next Action` — is bruikbaar als productverhaal, maar architectonisch te lineair en te dubbelzinnig. Zij zet menselijke ervaring naast een gemeten uitkomst alsof beide hetzelfde soort feit zijn, plaatst evidence na outcome terwijl evidence ook een observatie of claim kan dragen, en laat bevoegd besluit, geldigheidsduur, conflict, intrekking, mislukte meting en latere recall impliciet.

RTG moet daarom geen universele learning state machine en geen centrale knowledge graph bouwen. De beste fundamentele architectuur is een **federatieve RTG Loop Fabric**: een kleine set versieerbare protocollen waarmee domeinen hun eigen werkelijkheid blijven bezitten, maar verwachting, waarneming, claim, besluit, verandering, lineage, retentie en recall op dezelfde controleerbare manier kunnen verbinden.

De Loop Fabric bestaat uit vijf protocolfamilies:

1. **Occurrence & Observation Protocol** — wat gebeurde of werd waargenomen, door welke bron, met welke dekking, onzekerheid en geldigheid;
2. **Expectation & Decision Protocol** — wat vóór de handeling werd verwacht, welke alternatieven bestonden, wie besloot en op welke bevoegdheid;
3. **Claim & Contest Protocol** — welke betekenis iemand aan observaties geeft, wie het stelt, wie het betwist en welk bewijs ervoor of ertegen bestaat;
4. **Change & Verification Protocol** — welke domeineigenaar werkelijk iets wijzigde, vanaf wanneer, met welk resultaat, en of de wijziging later werkte of werd teruggedraaid;
5. **Memory & Recall Protocol** — wat onder welk doel mag worden bewaard, wanneer het verjaart, wie het mag terugzien, waarom het nu relevant is en of het aantoonbaar werd toegepast.

Daarboven zijn hoogstens drie smalle platformvoorzieningen gerechtvaardigd:

- een **Lineage Index** van versiegebonden relatie-asserties;
- een **Change Ledger/Router** van voorstellen en receipts van werkelijk door domeinen uitgevoerde veranderingen;
- een **Recall Broker** die alleen toegestane, verse bronnen projecteert.

Geen van deze voorzieningen wordt eigenaar van reizen, werken, woningen, competenties, publicaties, rechten, betalingen, zorg, onderzoek of mensen. Ze bewaren verwijzingen en verklaringen over overdracht. De bron blijft de bron.

De code ondersteunt deze conclusie. RTG heeft lokaal al sterke delen: eventcorrelatie, append-only revisies, immutable Library Editions, decision memory met vooraf vastgelegde verwachtingen, Living Lab met hypothese/tegendeel/observatie/reflectie/conclusie/besluit, gevolgcontracten met nameting, privacydoelen, verval, intrekking, auditketens en domeinspecifieke herstelpaden. Het hoofdgat is geen gebrek aan data. Het is het ontbreken van een gedeeld contract voor de overgang **van ervaring naar beweerde les, van les naar bevoegd besluit, van besluit naar aantoonbare verandering, en van verandering naar latere doelgebonden recall**.

## 2. Huidige RTG loop map

Een mechanische oriëntatiescan van `server/kern` vond 2.574 JavaScript/Markdown/JSON-bestanden. De woorden zijn geen capabilitytelling, maar laten de asymmetrie zien: `bewijs` komt in 555 bestanden voor, `verwachting` in 33, `observatie` in 21, `recall` in nul en `lineage` in één. RTG is sterk in bewijs per lokale handeling; het platformbrede terugbrengen van eerdere ervaring is nog nauwelijks als contract aanwezig.

| Domein | Bestaande lus | Bewijs in code | Stand | Waar de lus stopt |
|---|---|---|---|---|
| LibraryOS | Work → Revision → Edition → Reader → feedback → correctie → volgende Edition | `server/kern/library/*`, `LIBRARYOS.md`, `LIBRARYOS-STUDIO-READER.md` | gesloten binnen private pilot | geen publieke distributie, preservation of cross-domain lineage |
| Living World | Place → Blueprint → Plan → deelname → bijdrage → review → blueprintversie | `server/kern/living-world/{plans,contributions,projection}.js` | sterk, lokaal | geen algemeen contestmodel; impact is beperkt tot vrijwillig gekoppelde plannen |
| Living Lab | vraag → hypothese + tegendeel → plan → observatie → reflectie → conclusie → besluit → uitgang | `server/kern/livinglab/{cyclus,plan,waarnemen,bewijs,doorbraak}.js` | meest volwassen epistemische lus | uitvoering buiten het lab wordt vaak een status, geen ontvangst- en uitkomstbewijs uit het doeldomein |
| RTG Command | voorgenomen handeling → voorspeld gevolg → contractvergelijking → effectbon → nameting | `server/kern/stuur/gevolgcontract/*` | sterk voor systeemeffecten | niet gekoppeld aan menselijke ervaring, beleidswijziging of toekomstige recall |
| RTG-bestuur | besluit + gronden + verwachting → latere maat → vergelijking | `server/kern/beslisgeheugen.js` | goede counterfactual-kern | alleen RTG-bedrijfsmaten; geen herbruikbaar protocol en geen change receipt |
| WorkOS/onderneming | intake → scenario → stresstoets → bevroren planbesluit → fase | `server/kern/onderneming/{plan,simulatie,stress-toetsen}.js` | gedeeltelijk | realisatie, retrospective en proceswijziging zijn niet structureel verbonden |
| Mobility | behoefte/boeking → opdrachtstatussen → dispatch → rit → incident/herstel → afrekening | `server/kern/mobiliteit/{opdracht,voortgang,storing,dispatch,matching}.js` | operationeel sterk | toekomstige planning leert niet aantoonbaar van overstap, incident of reizigerservaring |
| Hospitality | bestelling/service → timingmeting/correctie → teruggaafrecht | `server/kern/horeca/{dienstmeting,correctie,pols}.js` | meet en herstelt | correcties en dienstmetingen leiden niet aantoonbaar tot nieuw proces/checklist/training |
| Commerce | koopbaar → mand → afrekening → overdracht → retour | `server/kern/commerce/*` | transactioneel | werkelijk gebruik, ervaren waarde en toekomstige aanbodwijziging ontbreken meestal |
| Academy | bron/curriculum → oefenen → oordeel → rolgereedheid | `server/kern/leerhuis/*` | competentielus deels aanwezig | praktijkuitkomst, verval en terugwerking naar curriculum zijn niet platformbreed verbonden |
| Talent/Métier | profiel/claim → bewijs → toestemming → werkgever → werk | `server/kern/metier/*` | privacybewust | werkervaring wordt niet vanzelf nieuwe competentie; terecht, maar expliciete brug ontbreekt |
| LivingOS/assets | signaal → voorstel → vier-ogenbesluit → werkorder → onderhoud | `server/kern/stadsweefsel/onderhoud.js` | sterke operationele start | interventieresultaat, recidive en overdraagbaar assetgeheugen zijn onvolledig |
| FoundationOS | signaal/hulp/project → behandeling/resultaat/impact | `server/kern/rtfos/*`, `server/kern/livinglab/*` | meerdere lokale lussen | menselijke ervaring, mislukkingen en community memory zijn niet als vrijwillige, aparte stromen gesloten |
| Saloon | bronnen → zichtbaarheidspoort → chronologische context/lens → bronhandeling | `server/kern/salon/*`, `server/kern/wereld/context.js` | goede projectie | geen generiek recallcontract; relevantie is nog hoofdzakelijk type/tijd/bron |
| Edge/Experience | contextprojectie → attention → action resolver → bronapp | `server/kern/experience/*`, `EDGE.md` | goede uitvoergrens | object, activiteit, voortzetting en trust zijn in de gemeten UI nog dun; Edge bezit terecht geen geheugen |
| Personalization | gezegd/gekozen/afgeleid → doelgebonden neiging → verval/intrekken | `server/kern/neiging/*` | sterk privacyvoorbeeld | alleen tonen/helpen; geen gedeelde recall over concrete ervaringen |
| Life Graph | domeinbronnen → tijdelijke projectie → termijnen | `server/kern/levensgraaf/*` | goed projectiepatroon | geen lineage of leerrelaties; bewust geen tweede database |
| Audit/events | mutatie → envelop/correlatie → audit/hashketen/outbox waar aanwezig | `server/kern/envelop.js`, `server/bus.js`, `server/lib/keten.js` | nuttige basis | gewone bus is best-effort; externe verankering van audit is ontworpen maar niet in bedrijf |

Belangrijk is dat deze lussen verschillende dingen bewijzen. Een Mobility-status bewijst een operationele overgang; een Living Lab-conclusie is een beoordeelde claim; een Library Edition is een immutable publicatiesnapshot; een persoonlijke neiging is een doelgebonden afleiding. Ze mogen niet in één generieke `Knowledge`-tabel worden geperst.

## 3. RTG Loop Gap Map

| Gat | Producer | Consument | Semantische eigenaar | Ontbrekende overdracht / bewijs / return path | Privacyrisico | Waarde bij sluiting |
|---|---|---|---|---|---|---|
| Work retrospective → proceswijziging | project/team | WorkOS-procesbeheer | organisatie/workspace | versiegebonden les, bevoegd besluit, change receipt, volgende-project recall | werknemersprofilering | herhaalbare procesverbetering zonder individuele ranking |
| Incident → structurele preventie | Command/service | runbook-/policy-eigenaar | betreffende operatie | root-cause claim, challenge, aangenomen maatregel, effectnameting | blame trail | minder herhaling en aantoonbaar herstel |
| Reisverstoring → volgende reis | reiziger + Mobility | trip planner/Edge | reiziger voor privéles; operator voor aggregate | user-confirmed lesson, scoped retention, future trigger | locatie- en gedragsprofiel | betere overstappen zonder invasief profiel |
| Verblijfservaring → operationele verbetering | gast | Hospitality owner | hotel/zaak | vrijwillige feedback → behandelaar → wijziging → terugmelding | gevoelige reis/context | service leert en gast ziet wat ermee gebeurde |
| Horecacorrectie → training/checklist | rekeningcorrectie/dienstmeting | zaak/Academy | horecadomein + curriculum owner | patroon op cohortniveau, besluit, curriculumversie | personeelsranking | minder fouten zonder toezicht op medewerkers |
| Woningissue → asset memory | bewoner/monteur | eigenaar/volgende bewoner | LivingOS asset owner | diagnose/interventie/resultaat/recidive, overdrachtsfilter | huishoudelijke informatie | onderhoudskennis overleeft bewonerswissel |
| Commerce delivery → werkelijk gebruik | verkoper/koper | product/support owner | commercieel domein | ontvangst ≠ gebruik; gebruiksuitkomst en consent ontbreken | consumptieprofiel | aanbod en support verbeteren op waarde, niet clicks |
| Foundation-interventie → community lesson | projectteam/deelnemers | community/future project | Foundation-project owner; community steward | opt-in ervaring, failure record, representativiteit, publicatiebesluit | kwetsbare mensen volgen | betere interventies zonder hulp als datatransactie |
| Living Lab-uitgang → doeldomeinuitvoering | conclusie/uitgang | Work/Living/Academy/Foundation | ontvangend domein | accept/decline receipt, uitvoeringsref, resultaat, terugkoppeling | contextlek tussen dossiers | onderzoek verandert aantoonbaar de wereld |
| Library kennis → toepassing | Edition/Reader | Academy/project/Work | doel-domein | expliciete citation/application edge, resultaat, feedback | leesgedragprofilering | zichtbaar gebruik zonder likes |
| Academy → praktijk | leerling/curriculum | Work/Talent | Academy bezit leren; Work bezit werk; Talent bezit profielclaim | practice evidence, menselijke beoordeling, expiry, opt-in portfolio | permanente classificatie | geloofwaardige ontwikkeling en mentoring |
| Praktijk → curriculum | werk/project | Academy owner | werkbron + curriculum owner | geanonimiseerde les, review, curriculum change receipt | bedrijfsgeheim/persoonsdata | opleidingen blijven actueel |
| Creator media → Experience Blueprint | media/creator | Living World/Travel | media en blueprint blijven apart | rights, semantic mapping, current provider/conditions | impliciete locatie/crew | “Take me there” met actuele uitvoerbaarheid |
| Communityobservatie → place state | lid | place owner/andere bezoekers | place/service-bron | onzekerheid, conflict, source coverage, expiry | herleidbare beweging | levende plaats zonder central truth claim |
| Recommendation → outcome | AI/Edge | policy/product owner | bronactie + gebruiker | voorstel-ID, alternatief, human choice, result/unknown, calibration | manipulatie en profielvorming | AI kan aantoonbaar leren en abstain |
| Besluit → werkelijk veranderde state | board/manager | domeinwriter | betreffende domein | change command + authoritative receipt + effective time | governance metadata | feedback wordt van uitvoering onderscheiden |
| Correctie/intrekking → alle afgeleiden | elk brondomein | search/Saloon/AI/lineage | bron | invalidation/supersession propagation en acknowledgement | vergeten koppelingen | oude kennis stopt aantoonbaar met sturen |
| Archief → bruikbaar toekomstig begrip | Library/Foundation/org | toekomstige steward | Archive, niet Library/Evidence | preservation metadata, renderbaarheid, vocabulary version | te brede historische toegang | duurzame kennis zonder semantisch verval |
| Kennis opgeslagen → kennis teruggebracht | alle domeinen | Edge/bronapp/AI | Recall Broker projecteert; bron bezit | trigger, eligibility, explanation, recall receipt, dismissal | surveillance door triggers | relevant verleden op beslismoment |

## 4. Voorgestelde loopfamilies

Eén universele lus is onwenselijk. De code laat minstens elf families zien, met een kleine gedeelde grammatica:

1. **Decision loop** — Need → Context snapshot → Options → Expectation → Authorized decision → Action → Outcome → Reconsideration.
2. **Operational loop** — Goal → Plan → Dependencies → Execute → Measure coverage → Result/incident → Recover → Adapt procedure.
3. **Human experience loop** — Expectation → Encounter → Human account → Response → Follow-up. Een account is geen meting.
4. **Research loop** — Question → Hypothesis + falsifier → Protocol → Observation → Analysis → Claim → Review/contest → Decision → follow-up study/application.
5. **Creative/version loop** — Idea → Draft → Contribution → Review → immutable release → reception/feedback → new revision/release.
6. **Learning/competence loop** — Unknown → explanation → practice → assessment → application → reflection → maintained/expired competence → next challenge.
7. **Care/support loop** — Need → request → assessment → consent → help → human outcome → follow-up/exit. Geen bijdrageplicht.
8. **Economic loop** — Need → offer → agreement → settlement → delivery → acceptance/use → support/return → value/exit.
9. **Maintenance/resilience loop** — Signal → diagnosis → intervention options → authority → work → verification → recurrence watch → maintenance rule.
10. **Governance loop** — Signal → proposal → deliberation → decision → implementation → accountability → review/repeal.
11. **Commons loop** — Local contribution → moderation/context → publication → reuse → challenge/correction → stewardship/succession.

De gedeelde architectuur zit niet in dezelfde stapnamen, maar in dezelfde controlevragen: *wie stelt dit, over welke versie, wanneer gold het, hoe weten we het, wie mocht beslissen, wat veranderde werkelijk, hoe kan het worden betwist, wanneer vervalt het en wanneer mag het terugkomen?*

## 5. Universele primitives

| Primitive | Minimale betekenis | Niet doen |
|---|---|---|
| `ObjectRef` | `{domain, type, id, version?}` naar een bronobject | object kopiëren naar platformstore |
| `ActorRef` | pseudonieme principal of bestaande organisatie | namen in events of nieuwe identity registry |
| `ContextRef` | doelgebonden context met eigenaar en geldigheid | universeel profiel van een mens |
| `Occurrence` | domeingebeurtenis met event-ID, actor, correlation, causation | event gelijkstellen aan bewijs of waarheid |
| `Observation` | brongebonden waarneming met methode, tijd, coverage en uncertainty | “niet gezien” automatisch “afwezig” noemen |
| `Expectation` | vooraf bevroren hypothese/forecast/succescriterium | na afloop herschrijven |
| `OptionSet` | overwogen alternatieven plus bekende beperkingen | doen alsof niet-opgeslagen opties niet bestonden |
| `Decision` | bevoegde keuze, gronden, scope, effective time | kennis automatisch beleid laten worden |
| `HumanAccount` | wat een mens zelf zegt te hebben ervaren | sentiment als objectieve outcome opslaan |
| `Measurement` | systeem-/sensormeting met instrument, kalibratie en coverage | meetgetal zonder meetgrens tonen |
| `Claim` | betwistbare duiding door een claimant | algemene truth flag |
| `EvidenceRef` | verwijzing naar drager en versie | bewijs laten betekenen dat claim waar is |
| `Contest` | challenge/correction/perspective met status en behandeling | conflict wegmiddelen tot consensusscore |
| `LessonProposal` | voorgestelde, begrensde generalisatie | automatisch organisatiekennis worden |
| `ChangeProposal` | gewenste mutatie in een benoemd brondomein | bronstate direct in platformplane wijzigen |
| `ChangeReceipt` | bewijs van door bron geaccepteerde/uitgevoerde wijziging | status “uitgevoerd” zonder bronreferentie |
| `Outcome` | feitelijke uitkomst, menselijke uitkomst of onbekend, expliciet getypeerd | resultaat en ervaring mengen |
| `LineageAssertion` | door actor gestelde relatie tussen versies | transitive truth of authority verlenen |
| `RecallTrigger` | expliciet moment waarop eerdere context relevant kan zijn | permanente ambient tracking |
| `RecallReceipt` | wat, waarom en uit welke bronnen werd getoond/toegepast | elk kijkmoment als gedragsdossier bewaren |
| `Supersession/Retraction` | nieuwe status die oude assertion begrenst | geschiedenis stil overschrijven |
| `RetentionPolicyRef` | doel, duur, rechtsgrond, steward en wisstrategie | één platformtermijn voor alles |
| `AuthorityReceipt` | policyversie, principal, scope, beslissing en reason | rechten ontlenen aan lineage of populariteit |
| `Uncertainty` | type/range/distributie/unknown + method | schijnprecisie of universele confidence score |

Elke primitive draagt daarnaast minimaal `schemaVersion`, `sourceDomain`, `createdAt`, relevante temporele velden, classificatie, visibility/purpose, provenance, current status en een stabiele idempotentiesleutel voor kritieke mutaties.

## 6. Primitives die juist NIET universeel moeten worden

De volgende begrippen blijven domeineigendom: boekingsstatus, reisveiligheid, medische behoefte, woningconditie, arbeidsperformance, competentie, expertise, diploma, auteursrechtelijke titel, publicatierecht, settlement, fiscale waarheid, Foundation-impact, wetenschappelijke bewijsgraad, moderatieoordeel, evenementstatus en servicekwaliteit.

Ook `Experience`, `Knowledge`, `Success`, `Quality`, `Trust`, `Impact` en `Value` zijn te breed als universele state. Ze mogen als mensentaal of als getypeerde claim voorkomen, maar niet als één platformveld. De universele laag kent hoogstens *welk domein de betekenis bezit* en *welke assertion erover is gedaan*.

## 7. WorkOS deep dive

De gewenste WorkOS-lus is:

```text
Objective
  → plan + assumptions + dependencies
  → options + decision
  → work + deliverable
  → operational result
  → team reflection
  → lesson proposal
  → authorized process change
  → next-project recall
```

De code heeft sterke bouwstenen: een ondernemingplan bewaart het beslismoment en de toen bekende scenario’s; Command scheidt voorspeld van gemeten gevolg; werkruimten, taken, documenten, service en governance hebben eigen schrijvers; Authority ontwerpt principal/organisatie/appointment/policy als gedeelde grammatica.

De veilige grens tegen werknemerssurveillance is hard:

- leer op **zaak-, proces-, asset- en teamniveau**, niet op klik- of snelheidspatronen per medewerker;
- persoonlijke reflectie is privé totdat de persoon bewust een begrensde bijdrage deelt;
- geen individuele “learning”, “productivity” of “risk” score;
- operationele attributie wordt alleen bewaard wanneer nodig voor bevoegdheid, veiligheid of audit;
- verbeteranalyses gebruiken minimumcohorten en tonen ontbrekende dekking;
- een manager kan een procesles aannemen, maar geen psychologisch profiel afleiden;
- oude performance mag niet automatisch toekomstige kansen beperken.

Voor CRM, service, IT en contracten hoort telkens hetzelfde onderscheid te gelden: case history is domeinstate; een retrospective is een menselijke bijdrage; een procesregel is een bevoegd besluit; de nieuwe uitvoering levert een afzonderlijke verificatie. HR-informatie mag niet als gratis bron voor organisatiekennis worden behandeld.

## 8. TravelOS deep dive

TravelOS heeft meerdere verweven lussen:

```text
Desire → constraints → inspiration → research → plan → decision
→ preparation → movement → arrival → stay/activity
→ disruption/recovery → human experience → memory/sharing → future trip
```

De huidige Mobility-kern heeft volwassen statusovergangen, dispatch, menselijke override, incidentsporen, locatieverwijdering na de rit en uitlegbare matching. Living World voegt Place, Blueprint, Plan, deelname en contribution toe. Experience projecteert bronnen zonder ze te bezitten.

Wat ontbreekt is een privacyveilige `Trip Lesson` als *persoonlijk, bevestigbaar en intrekbaar* object. Een voorbeeld:

> “Bij reis X was 18 minuten overstaptijd voor mij, met deze mobiliteitsbeperking en deze terminalwissel, onvoldoende.”

Dat is geen universele eigenschap van de persoon en geen feit dat 18 minuten altijd te kort is. Het is een account met context, geldigheid en bron. Voor een volgende reis mag het alleen terugkomen wanneer de gebruiker dat doel heeft toegestaan. De operator kan pas institutioneel leren via een apart, geaggregeerd patroon met voldoende dekking; de persoonlijke routegeschiedenis hoeft daarvoor niet te blijven bestaan.

TravelOS moet verder onderscheiden:

- `planned itinerary`, `booked inventory`, `operated service` en `experienced journey`;
- geplande en actuele tijden;
- leveranciermelding, sensorpositie en reizigersaccount;
- safety advisory, wettelijke restrictie en communitywaarneming;
- “niet gereisd”, “niet gemeten” en “mislukt”;
- memory voor één trip, een user-confirmed duurzame voorkeur en een kortlevende afleiding.

## 9. LivingOS deep dive

Een woning of fysiek asset kan institutioneel geheugen hebben zonder bewonersgeschiedenis over te dragen. De kernlus is:

```text
Issue → observation → diagnosis claim → intervention decision
→ work → verification → recurrence/absence with coverage
→ maintenance rule → next owner/steward handover
```

`stadsweefsel/onderhoud.js` toont het juiste patroon: zichtbaar regime, uitlegbaar signaal, menselijk voorstel, vier ogen bij kritieke assets. Nodig is een `Asset Memory Bundle` met alleen assetrelevante feiten: materiaal, versie, inspectie, diagnose, interventie, onderdelen, garantie, resultaat, recurrence en veiligheidsbeperking. Bewonersnamen, leefpatronen, gezondheidsinformatie en conflicten gaan niet mee.

De overdrachtspoort naar een volgende bewoner/eigenaar maakt per record expliciet:

- `transfersWithAsset: true/false`;
- rechtsgrond of toestemming;
- redactie/anonymisering;
- actuele of historische status;
- verantwoordelijke steward;
- wat alleen in het oude persoonlijke dossier blijft.

Een onderhoudsrecord is geen kwaliteitsclaim over de monteur. Een terugkerende storing is geen bewijs van één oorzaak. Een niet-teruggekeerde storing telt alleen als de monitoringdekking en periode bekend zijn.

## 10. FoundationOS deep dive

De Foundation-lus moet hulp en leren principieel scheiden:

```text
Need signal → assessment → consent → resources/intervention
→ operational result → optional human account
→ reviewed lesson → community stewardship
→ future intervention
```

Hulp wordt nooit afhankelijk van een testimonial, datapunt, interview, Library-bijdrage of onderzoeksdeelname. Geen reactie is geen negatieve outcome. Mensen die uitvallen of onbereikbaar worden verdwijnen niet uit de noemer van een impactverhaal.

FoundationOS kan wel sterk worden door vier vrijwillige stromen naast elkaar te zetten:

1. projectstate en geld, door hun bestaande domeinen;
2. meetbare outputs en coverage;
3. menselijke accounts, met expliciete toestemming en veilige intrekking;
4. lessons en community works, pas na review/publicatie.

Mislukte, gestopte en niet-reproduceerbare projecten krijgen een historisch record. Dat is geen publieke beschaming: gevoelige inhoud kan besloten blijven terwijl de institutionele les, beperkingen en kosten wel worden bewaard. De community bepaalt via benoemde stewardship wie commonskennis onderhoudt; Foundation wordt niet automatisch eigenaar of waarheidsautoriteit.

## 11. Hospitality, Mobility en Commerce deep dive

### Hospitality

`Expectation → reservation → arrival → service → consumption → correction/payment → human account → operational change`.

De huidige dienstmeting maakt al onderscheid tussen gemeten, constructie en niet-gemeten. Dat moet behouden blijven. Toe te voegen is de verbinding van een patroon naar een proces-/checklistversie en vervolgens naar een latere dienstmeting. Meet op shift/proces/asset, niet op schermhandelingen per medewerker. Gastfeedback blijft een account; gereedtijd is een meting.

### Mobility

`Need → options → booking → dispatch → journey → disruption → recovery → arrival → later planning`.

Matching blijft een uitlegbaar voorstel; de dispatcher beslist. Een incident moet naast recovery een `prevention candidate` kunnen opleveren. Ruwe posities verdwijnen; route-/assetlessen worden alleen afgeleid met voldoende aggregatie en een zichtbare methodiek.

### Commerce

`Need → discovery → decision → agreement → payment → delivery → acceptance/use → support/return → exit/repeat`.

RTG heeft transactie-, retour- en overdrachtspaden. “Betaald” is echter geen bewijs van levering, gebruik of waarde. Voeg die betekenissen niet aan settlement toe. Het commerciële domein kan getypeerde receipts ontvangen van delivery/support, terwijl productervaring opt-in blijft. Een seller mag betalen voor distributie of dienstverlening, nooit voor een hogere recall- of discoveryrang.

## 12. Academy, Talent en Library als doorlopende ontwikkeling

Deze domeinen blijven apart, maar kunnen een keten vormen:

```text
Curiosity → Work/Edition → reading → learning → practice
→ assessment → real application → portfolio claim
→ opportunity/work → reflection/contribution → new Edition/curriculum
```

- Een lezer wordt maker na een bewuste contribution/Work-handeling, niet door leesgedrag.
- Een leerling wordt mentor door een geldige benoeming plus passende, actuele evidence; niet door een score.
- Ervaring wordt kennis wanneer iemand haar vastlegt, haar scope benoemt, ze reviewbaar maakt en een steward haar voor een bepaald doel aanneemt.
- Een projectresultaat wordt pas lesmateriaal via een curriculumversie en rechten-/broncontrole.
- Portfolio evidence is een versiegebonden drager. Expertise blijft een betwistbare of bevoegde claim van Talent/Academy.
- Verlopen of ingetrokken bewijs verlaagt actuele inzetbaarheid, maar wist het historische feit niet en maakt geen permanent negatief label.

LibraryOS levert de goede vorm voor duurzame kennis: stabiele Work-ID, append-only Revisions, immutable Edition, edition-bound rights/consents, persoonlijke Reader-state apart en correctie via Edition 2.

## 13. Living Lab/research deep dive

Living Lab is het beste bestaande model om op voort te bouwen. Het scheidt al:

- hypothese van wens door een verplicht tegendeel;
- observatie van conclusie;
- reflection types `tegenviel`, `misging`, `onverwacht`, `herzien`;
- evidence grade van waarheid;
- besluit van conclusie;
- intrekking van bewijs, inclusief herijking van conclusies;
- pilot/werkorder/beleid/onderwijs van het onderzoek zelf.

De belangrijkste gaten zijn:

1. `doorbraak.status = uitgevoerd` kan met een notitie, maar niet altijd met een autoritatieve receipt uit het ontvangende domein;
2. de uitkomst van de verandering stroomt niet automatisch als nieuwe observatie terug;
3. protocol-, instrument- en vocabulary-versies moeten explicieter aan elke observatie kunnen hangen;
4. inter-rater disagreement en alternatieve conclusies verdienen first-class relaties;
5. fysieke samples, sensorcalibratie en preservation chains zijn nog geen platformcontract;
6. een eenmaal gepubliceerde studie heeft een duurzame archive-/renderabilitystrategie nodig.

De vaste cyclus die niet teruggaat is geschikt voor één studie: een gewijzigde hypothese wordt een vervolgstudie. Die regel moet niet als universele platformstate machine worden gekopieerd.

## 14. Personal Memory model

Persoonlijk geheugen is user-controlled context, geen centraal gedragsprofiel.

**Eigenschappen:** eigenaar is de persoon; doelen zijn gesloten en begrijpelijk; bronsoort is zichtbaar; afleidingen hebben korte vervaltermijnen; gevoelige herinneringen zijn standaard lokaal/privé; export, correction, purpose withdrawal en deletion zijn beschikbaar; een expliciete uitspraak weegt anders dan een inference.

**Lagen:**

- `session memory`: verdwijnt na taak/sessie;
- `journey/case memory`: leeft zolang reis, project of behandeling loopt;
- `confirmed personal memory`: door gebruiker bewust bewaard voor een doel;
- `derived inclination`: zwak, zichtbaar, doelgebonden en automatisch vervallend;
- `private archive`: door gebruiker bewaard, niet automatisch voor aanbevelingen.

De overgang van privéervaring naar gedeelde of publieke kennis is altijd een afzonderlijke handeling met preview van inhoud, publiek, rechten, herleidbaarheid en intrekkingsgevolg.

## 15. Organizational Memory model

Organisatiegeheugen bestaat uit besluiten, cases, runbooks, policies, assetkennis, contractcontext en lessons. Het hangt aan rollen en organisatie-entiteiten, niet aan individuele accounts. Bij vertrek blijven bevoegde besluiten en werkproducten bestaan; persoonlijke notities, afleidingen en onnodige identiteit worden verwijderd of ontkoppeld.

Elke duurzame organisatorische les draagt:

- owner/steward role;
- source cases in minimale, gepseudonimiseerde vorm;
- scope en uitzonderingen;
- review/expiry;
- contest status;
- process/policy version waarop zij effect had;
- opvolgingsregeling en exportformaat.

Institutional succession vraagt een `StewardshipTransfer`: oude en nieuwe rolhouder, authority basis, welke collecties, open contests, reviewdata en een gecontroleerde overdracht. Een accountoverdracht is onvoldoende.

## 16. Domain/Asset Memory model

Domain memory is de historische levensloop van een domeinobject: trip, woning, asset, contract, event, Work, project, servicecase. De domeineigenaar bewaart de toestand. De Loop Fabric bewaart alleen versiegebonden verwijzingen en overdrachtsreceipts.

Een asset memory record kan vier views hebben:

1. current authoritative state;
2. immutable historical states/events;
3. contested assertions over het asset;
4. recallable lessons met expiry.

Deze views mogen niet in één `status` worden samengevoegd. De bron zegt bijvoorbeeld dat een lift operationeel is; een communitylid kan tegelijk een verse observation hebben dat hij stil staat; operations kan een incident onderzoeken. De UI toont bron, tijd en conflict zonder zelf de liftwaarheid over te nemen.

## 17. Commons Memory model

Commons Memory is bewust gepubliceerde, draagbare gemeenschapskennis. Zij vereist meer dan `public: true`:

- een benoemde community/steward;
- licentie en reuse-rechten;
- culturele/contextuele labels;
- meerdere perspectieven en contestability;
- source minimization en bescherming van kwetsbare bijdragers;
- preservation intent en succession;
- verwijder-/redactiebeleid dat historische betekenis niet stil wist;
- export zonder platformlock-in.

Moderation verwijdert illegale of schadelijke distributie, maar wist niet automatisch het bestaan van het historische record. Waar veilig en rechtmatig kan een restricted tombstone blijven: wat werd beperkt, door welke bevoegdheid, wanneer en waarom. Inhoud zelf kan ontoegankelijk of vernietigd moeten worden.

## 18. Forgetting/retention model

Vergeten is geen cleanupjob maar een capability met verschillende effecten:

| Actie | Betekenis |
|---|---|
| delete | bronobject fysiek/logisch weg wanneer niets het behoud vereist |
| expire | niet langer gebruiken of tonen na tijd/purpose |
| redact | gevoelig fragment verwijderen terwijl structuur blijft |
| anonymize | identiteit onomkeerbaar losmaken waar dat werkelijk haalbaar is |
| unlink | relatie tussen objecten verbreken zonder beide objecten te wissen |
| aggregate | individuele bron vervangen door voldoende grote groep, met afleidingsrisico beoordeeld |
| restrict archive | behouden voor historie/audit, niet voor gewone recall |
| legal hold | tijdelijk behoud op expliciete bevoegdheidsgrond |
| preserve | duurzaam bewaren met formaat-, checksum- en renderabilitybeleid |
| correct | oorspronkelijke record behouden en correctie eraan koppelen |

Cruciale regel: als een bron wordt ingetrokken, moeten afgeleide claims opnieuw worden beoordeeld. `livinglab/terugtrekken.js` bewijst dit lokaal door conclusion grades te herijken. Platformbreed is een `Dependency Invalidation`-bericht nodig, waarop elke consumer duurzaam antwoordt met `removed`, `recomputed`, `restricted`, `retained-by-law` of `not-held`.

## 19. Temporal model

RTG heeft geen universeel “timestamp”-veld nodig, maar een gesloten tijdsvocabulaire:

- `occurredAt`: wanneer de gebeurtenis werkelijk plaatsvond;
- `observedAt`: wanneer een bron haar waarnam;
- `recordedAt`: wanneer RTG haar opsloeg;
- `decidedAt`: wanneer een bevoegd besluit viel;
- `effectiveFrom/Until`: wanneer besluit/recht/policy effect heeft;
- `validFrom/Until`: voor welke werkelijkheid een assertion geldt;
- `knownFrom/Until`: vanaf wanneer RTG deze versie kende;
- `correctedAt`: wanneer een correctie werd vastgelegd;
- `supersededAt`: wanneer een opvolger de actuele rol overnam;
- `recalledAt/appliedAt`: wanneer kennis werd teruggebracht/gebruikt.

Bitemporaliteit is gerechtvaardigd voor rechten, policies, contracts, publicaties, belangrijke assetstate en betwistbare claims: “wat gold toen?” tegenover “wat weten we nu over toen?”. Gebruik het niet voor elk UI-event of elke notificatie. Per aggregate is revision order leidend; RTG moet geen fictieve globale eventvolgorde veronderstellen. Late observations blijven toegestaan en dragen hun eigen `observedAt` en `recordedAt`.

## 20. Causality model

Lineage en causaliteit krijgen afzonderlijke relatietypen:

1. `preceded_by` — alleen tijd;
2. `correlated_with` — gezamenlijk patroon;
3. `depends_on` — technische/operationele afhankelijkheid;
4. `cites` — bronverwijzing;
5. `derived_from` — transformatie/afleiding;
6. `inspired_by` — verklaarde creatieve invloed;
7. `informed_decision` — besluit noemt deze bron;
8. `intervention_on` — een doelbewuste ingreep;
9. `observed_outcome_of` — outcome na benoemde interventie;
10. `attributed_cause` — claimant schrijft oorzaak toe;
11. `experimentally_supported_cause` — onderzoeksmethode ondersteunt causaliteit binnen scope.

Alleen 10 en 11 zijn causaliteitsclaims; beide blijven betwistbaar en dragen claimant, methode, evidence, uncertainty, scope en reviewstatus. Relaties zijn niet automatisch transitief. De bestaande eventenvelop `oorzaak` beschrijft technische eventcausaliteit, niet wetenschappelijke of maatschappelijke causaliteit.

## 21. Expectation/counterfactual model

Een `ExpectationSet` wordt vóór een besluit bevroren en bevat:

- target outcome(s) en horizon;
- baseline en bronversie;
- alternatieven, inclusief “niets doen” waar zinvol;
- aannames;
- onzekerheidsvorm: range/distributie/unknown;
- succes-, stop- en schadekriteria;
- meetplan en coverage-eis;
- actor/decision reference;
- model/algorithm version bij simulatie.

State machine:

```text
DRAFT → FROZEN → DUE
  → MET | PARTLY_MET | NOT_MET | UNMEASURABLE | WITHDRAWN
  → REVIEWED
```

`UNMEASURABLE` is geen mislukking en geen succes. WorkOS, Foundation-projecten, onderhoud, operations en finance hebben hier hoge waarde. Travel gebruikt het selectief voor haalbaarheid en overstap, niet voor elk pleziermoment. De bestaande `beslisgeheugen`- en gevolgcontractmodules zijn concrete voorlopers.

## 22. Negative Knowledge model

RTG moet negatieve kennis als getypeerde record bewaren:

- `attempt_failed` — geprobeerd, doel niet gehaald;
- `hypothesis_rejected` — waarneming steunt tegendeel;
- `option_rejected` — overwogen en met reden verworpen;
- `worked_temporarily` — werkte binnen interval;
- `conditional_success` — alleen onder benoemde voorwaarden;
- `unexpected_outcome`;
- `not_reproduced`;
- `decision_reversed`;
- `contraindication` — niet toepassen in scope;
- `known_unknown`;
- `absence_with_coverage` — niet gevonden terwijl instrument het had kunnen zien;
- `not_observed` — geen conclusie door ontbrekende dekking;
- `conflicting_evidence`.

Elke record heeft scope, context, attempt/protocol version, evidence, coverage, review, expiry en privacyclassificatie. Negatieve kennis over een persoon mag niet uitgroeien tot een permanent risicolabel. Het nuttigste recallmoment is vaak vóór iemand dezelfde kostbare of gevaarlijke fout herhaalt.

## 23. Knowledge freshness en supersession

Voorgestelde levenscyclus voor een *assertion*, niet voor een immutable artefact:

```text
DRAFT → ASSERTED → REVIEWED
  → ACCEPTED_FOR_CONTEXT
  → CHALLENGED
  → UPDATED / SUPERSEDED / RETRACTED / HISTORICAL
```

`ACCEPTED_FOR_CONTEXT` betekent dat een benoemde steward de claim binnen een scope mag gebruiken; het betekent niet universeel waar. Freshness volgt uit domeinbeleid, bronsoort en veranderlijkheid. Een actuele surfconditie kan minuten leven; een auteurschapclaim decennia; wetgeving tot de effectieve opvolger; een Library Edition blijft immutable terwijl warnings, beschikbaarheid en actuele rechten apart bewegen.

Een recall is alleen geldig wanneer bron, version, valid interval, review date en relevante dependencies nog bruikbaar zijn. Stale knowledge wordt niet stil weggelaten: bij een belangrijke beslissing toont RTG dat eerdere kennis bestaat maar verlopen of betwist is.

## 24. Cross-Domain Opportunity Matrix

Een overdracht is geen kopieeractie. Het brondomein publiceert een versiegebonden referentie; het doeldomein beslist zelf of en hoe die bruikbaar is. `Toestemming` hieronder omvat ook contractuele of wettelijke grondslag waar toestemming niet het juiste juridische instrument is.

| Bron → doel | Overdraagbaar object | Semantische eigenaar | Poort: toestemming, bewijs en versie | Return path, risico en waarde |
|---|---|---|---|---|
| Travel → Library | vrijwillig reisverhaal, routekennis, observatie | Travel bezit trip; Library bezit Work/Edition | expliciete bijdrage; trip- en placeversie; menselijke bronvermelding | correctie terug naar auteur; locatie/privacyrisico; rijkere gidsen |
| Library → Academy | Edition-fragment, bronverwijzing | Library bezit Edition; Academy bezit curriculum | rechten voor onderwijs; exact edition/node/hash | curriculum meldt gebruik en vervanging; verouderingsrisico; toetsbaar onderwijs |
| Academy → Talent | practice result of credential reference | Academy bezit beoordeling; Talent bezit presentatie | opt-in portfolio; issuer-verifieerbaar; expiry | intrekken/vernieuwen; permanent-labelrisico; aantoonbare kansen |
| Talent → WorkOS | kandidaatstelling, capability-claim | Talent bezit profielclaim; WorkOS bezit rol/opdracht | doelgebonden delen; claim is geen bevoegdheid | werkuitkomst mag alleen met toestemming terug; discriminatierisico; betere matching |
| WorkOS → Academy | geanonimiseerde skill gap, lesson proposal | WorkOS bezit operatie; Academy curriculum | aggregatie/drempel; geen werknemer-ranking | curriculumwijziging als receipt; surveillancerisico; relevanter leren |
| WorkOS → Library | runbook, retrospective, vakkennis | WorkOS bezit proces; Library publicatie | bedrijfsrechten, redactie, de-identificatie, version | Edition-correctie terug; vertrouwelijkheidsrisico; overdraagbare vakkennis |
| Living/asset → WorkOS | onderhoudsvraag, diagnose, interventie | Living bezit asset history; WorkOS bezit werkorder | bewoner/owner-authority; assetversie; minimale persoonsgegevens | uitvoering/resultaat terug naar asset; bewonersprivacy; minder herhaling |
| Living Lab → Foundation | getoetste interventie en onzekerheid | Lab bezit onderzoek; Foundation bezit besluit/project | methode, coverage, challenge-status; geen automatische causaliteit | Foundation-outcome terug als nieuwe observatie; schijnzekerheid; beter projectontwerp |
| Foundation → Library | projectles, oral history, negatieve kennis | Foundation bezit project; Library bezit Work | vrijwilligheid; deelnemersrechten; mislukking blijft zichtbaar | Edition/feedback terug; kwetsbaarheidsrisico; community memory |
| Hospitality → Academy | service-incident, verbeterde werkwijze | Hospitality bezit operatie; Academy curriculum | aggregatie, safety review, geen employee-score | trainingswijziging terug; blame-risico; veiliger service |
| Mobility → Travel | disruption pattern, toegankelijkheidsbeperking | Mobility bezit journey/operatie; Travel bezit plan | actuele route/serviceversie; doelgebonden recall | planuitkomst terug; bewegingstrackingrisico; robuustere reizen |
| Commerce → maker/WorkOS | support issue, use outcome | Commerce bezit order/support; maker bezit productwijziging | orderbewijs, productversie, klantkeuze | change receipt/release terug; profilering; aantoonbare productverbetering |
| Business → Foundation | geoormerkte bijdrage/settlement reference | Pay bezit geld; Foundation bezit bestemming/project | financiële autoriteit; geen inhoudelijke invloed kopen | bestedingsbewijs terug; pay-to-influence-risico; lokale kringloop |
| Event → Mobility/Hospitality | tijd, plaats, accessibility needs | Event bezit programma; ontvanger bezit service | alleen benodigde behoefte; eventversion; tijdgebonden | disruption/fulfilment terug; gevoelige behoefte; betere deelname |
| Media/Creator → Living World | Experience Blueprint, place/media reference | creator bezit werk; Place/Blueprint bezit eigen state | rechten, veiligheid, freshness, geen kopie van booking | actuele uitvoerbaarheid terug; copy/locatierisico; `Take me there` |
| Place/community → Travel | actuele observatie, warning, local tip | Place-domain bezit assertion; Travel bezit advies | provenance, expiry, moderation, contributor-keuze | gebruik/contest terug op aggregaat; poisoning; lokale actualiteit |
| Research → Governance | claim, forecast, policy option | research bezit claim; governance bezit besluit | methode, onzekerheid, conflict, review | besluit en outcome terug; technocratie; navolgbaar beleid |
| Incident → alle relevante operations | near miss, oorzaakshypothese, mitigation | incidentdomein bezit casus; elk domein bezit eigen change | need-to-know, de-identificatie, causaliteitslabel | verified change terug; blame/leakage; voorkomen herhaling |
| Library/Commons → Saloon/Edge | publicatiereferentie, actuele warning | Library/Commons bezit bron; Saloon/Edge projecteert | visibility, rights, freshness, purpose; geen betaald bereik | open/dismiss/challenge minimaal terug; popularity bias; relevante recall |
| Commons → AI | toegestane corpusreferentie | Commons steward bezit voorwaarden; AI-service bezit run | afzonderlijk recht voor retrieval/training/translation; version | output/probleem terug als voorstel; consent laundering; controleerbare assistentie |

De matrix laat drie patronen zien: claims reizen, bevoegdheid niet; bronversies reizen, mutable bronstate niet; het doeldomein stuurt een receipt terug maar kan de bronbetekenis niet herschrijven.

## 25. RTG-wide Lineage Plane

RTG heeft een smalle Lineage Plane nodig, maar geen centrale knowledge graph die domeinwaarheid bezit. De kernrecord is een **LineageAssertion**:

```text
lineage_id
from_ref {domain, type, id, version/hash}
relation_type + relation_version
to_ref   {domain, type, id, version/hash}
asserted_by + authority_basis
provenance/evidence_refs[]
valid/effective interval
visibility + purpose + rights_reference
uncertainty + method (waar relevant)
status + challenge_refs[]
supersedes/retracts
created_at + operation_id + audit/event refs
```

Relatietypen krijgen een eigenaar en schema, bijvoorbeeld `library.documented_as`, `academy.used_in_curriculum` en `operations.informed_decision`. De Lineage Plane valideert vorm, referentie, policy en versie; hij verklaart geen relatie waar en verleent geen toegang tot de gerefereerde objecten. Geen edge impliceert transiviteit, toestemming, eigendom, expertise of causaliteit.

```text
PROPOSED → ASSERTED → REVIEWED
                    ↘ CHALLENGED
ASSERTED/REVIEWED → SUPERSEDED | RETRACTED | EXPIRED
```

De index is herbouwbaar uit duurzame domeinassertions/outboxes. Een snelle centrale projectie is toegestaan; de gezaghebbende assertion en het object blijven bij hun bron. Bij verwijdering kan een privacyveilige tombstone alleen bewaren dat een eerder verband niet meer bruikbaar is. Cross-domain resolve gebeurt telkens opnieuw, zodat een zichtbare edge nooit een autorisatielek wordt.

## 26. Change Plane

Lineage vertelt welke invloed is verklaard; Change bewijst wat een bevoegd domein werkelijk wijzigde. Daarom verdient RTG een afzonderlijk protocol met vier objecten:

- `ChangeProposal`: gewenste verandering, aanleiding, scope, risico, bronrefs en verwacht effect;
- `ChangeDecision`: bevoegde actor, opties, reden, voorwaarden en besluit;
- `ChangeReceipt`: door het brondomein afgegeven bewijs van toegepaste mutatie;
- `ChangeVerification`: later gemeten of ervaren effect, inclusief `unmeasurable` en onverwachte schade.

State machine:

```text
PROPOSED → TRIAGED → ACCEPTED | REJECTED | DEFERRED
ACCEPTED → DISPATCHED → APPLIED → VERIFIED
                       ↘ FAILED → RECOVERED | ABANDONED
APPLIED → REVERTED | SUPERSEDED
```

Een receipt bevat target-ref en verwachte revision, operation ID, actor en authority receipt, before/after-ref of hash, effective time, auditref en eventref. Alleen het doeldomein kan `APPLIED` verklaren. De Change Plane is router en ledger; hij voert geen boeking, curriculumwijziging, betaling, publicatie of onderhoud uit.

Daarmee blijven vier uitspraken apart:

```text
feedback ontvangen ≠ besluit genomen
besluit genomen     ≠ wijziging toegepast
wijziging toegepast ≠ verwacht effect bereikt
effect gezien       ≠ wijziging veroorzaakte effect
```

## 27. Recall model

Recall is een policybesluit op een concreet moment. Het model bestaat uit:

1. **Trigger** — expliciete vraag, object geopend, planfase, state transition, deadline of benoemd veiligheidsmoment;
2. **Candidate retrieval** — version-bound lineage en domeinindex leveren mogelijke context;
3. **Eligibility** — doorsnede van authority, purpose, consent/legal basis, classification, freshness, source availability en locale;
4. **Ranking** — veiligheid, contextmatch, geldigheid, bronkwaliteit en onzekerheid; nooit betaling of engagement;
5. **Presentation** — waarom nu, uit welke bron, welke versie, hoe oud, betwist of onzeker;
6. **Disposition** — geopend, nuttig verklaard, afgewezen, betwist, verlopen of expliciet toegepast;
7. **Return** — alleen noodzakelijke feedback naar eigenaar/steward.

```text
CANDIDATE → ELIGIBLE → PRESENTED
                        ├─ ACKNOWLEDGED
                        ├─ DISMISSED
                        ├─ CHALLENGED
                        ├─ APPLIED (alleen met bewijs)
                        └─ EXPIRED
```

Ambient gedragstracking is geen geldige standaardtrigger. Een Recall Broker mag indexeren en projecteren maar bewaart geen nieuw personenprofiel. Een receipt hoeft meestal slechts candidateversie, policybesluit en disposition te bevatten; volledige lees- of kliksporen zijn niet nodig. Bij conflicts toont Edge meerdere perspectieven of onthoudt zich. Een verdwenen, ingetrokken of stale bron invalideert kandidaten en reeds gecachte projecties.

## 28. AI/Edge-architectuur

Elke kennisdragende uitspraak draagt een oorsprongslabel:

- `human_stated`;
- `human_observed`;
- `system_measured`;
- `sensor_observed`;
- `ai_inferred`;
- `ai_proposed`;
- `authority_decided`.

AI mag vastleggen, transcriberen, samenvatten, structureren, vergelijken, anomalieën signaleren, terugvinden, plannen, aanbevelen, uitleggen, simuleren, reflectie ondersteunen, opstellen, vertalen en wijzigingen detecteren. De output blijft een voorstel of afleiding totdat een benoemde actor of meetbron een volgende semantische stap zet. Een samenvatting is geen observation, een voorspelling geen expectation van de beslisser, een aanbeveling geen decision en een draft geen applied change.

Een reproduceerbare AI-record bevat model/provider/version, taak, prompt-templateversion, inputrefs en hun versies, toegestane purpose, outputhash, onzekerheid/abstention, broncitaten, policyresultaat en menselijke disposition. Gevoelige ruwe input wordt niet in een promptlog gekopieerd wanneer refs volstaan. Training, retrieval, vertaling en publicatie krijgen afzonderlijke rechten.

Edge is de contextuele interface:

```text
authoritative domain state
  + policy/authority
  + eligible recall
  + explained AI proposal
        ↓
      EDGE
        ↓
human decision → existing action resolver → source domain
```

Edge bezit geen waarheid, rechten of state transition. Het gebruikt dezelfde action resolver als Saloon en bronapps, toont bron/freshness/conflict en laat de mens corrigeren of negeren. Kritieke beslissingen vereisen een deterministische policycheck bij de definitieve mutatie, ongeacht een eerdere AI-preview.

## 29. Human agency en contestability

Voor elke gevoelige inferentie, claim of cross-domain overdracht gelden waar passend:

- preview vóór delen of publiceren;
- granular opt-in en doelbinding;
- zichtbaarheid van bron, actorsoort, versie en gebruik;
- correctie zonder de historische audit te vervalsen;
- challenge, beroep en menselijke escalation;
- override met reden bij geautomatiseerde aanbevelingen;
- export in begrijpelijk en machineleesbaar formaat;
- withdrawal/revocation en dependency-invalidation;
- veilige onthouding wanneer een actor niet wil bijdragen;
- scheiding tussen hulp ontvangen en kennis teruggeven.

Een AI-inferentie over iemand mag nooit stil een personeelsfeit, Talent-classificatie, verzekeringsrisico, klantwaarde of toegangseis worden. Een challenge verlaagt de bruikbaarheid binnen het toepassingsgebied; hij wordt niet verstopt omdat een meerderheid de claim aannemelijk vindt. Bij botsende perspectieven kan RTG pluraliteit bewaren in plaats van een synthetische consensus te fabriceren.

## 30. Privacy- en consentgrenzen

RTG gebruikt geheugenlagen met expliciete overgangspoorten:

```text
PERSONAL
   └─ deliberate share → RELATIONSHIP/GROUP
          └─ authorized contribution → ORGANIZATIONAL
                 └─ de-identify + steward review → DOMAIN/ASSET
                        └─ publish/rightsholder consent → COMMONS
```

Geen pijl is automatisch of onomkeerbaar. Elke overdracht legt doel, rechtsgrond/toestemming, velden, ontvanger, duur, rechten, bronversie en withdrawalgedrag vast. Persoonsidentiteit en inhoud worden waar mogelijk gescheiden; cross-domain identifiers zijn scoped en pseudoniem. Aggregatie vereist minimumgroepen en disclosure review. Een graph-query mag niet via combinaties iemand heridentificeren.

Afgeleide records bewaren dependencies. Intrekking van de bron leidt afhankelijk van recht en noodzaak tot verwijderen, unlinken, anonimiseren, herberekenen, beperken of een non-revealing tombstone. Legal hold en publieke archivering zijn afzonderlijke, zichtbare regimes. `Consent` is geen universele ontsnappingsroute: machtsonbalans, contract, wettelijke plicht en vitaal belang vereisen hun eigen grondslag en proportionaliteit.

## 31. Security- en threat model

| Dreiging | Voorbeeld | Kernmaatregel |
|---|---|---|
| spoofing/impersonatie | bijdrage namens een ander | server-derived actor, scoped identity, step-up bij kritieke besluiten |
| authority confusion | lineage-edge gebruikt als publishrecht | domain policy op definitieve mutatie; edge verleent niets |
| replay/race | ingetrokken recht en gelijktijdige change | operation ID, payload hash, expected revision, transactionele recheck |
| knowledge poisoning | gecoördineerde valse place reports | provenance, rate/abuse controls, conflictstatus, steward review |
| Sybil/collusion | kunstmatige consensus | identiteitssignalen gescheiden van waarheid; geen stemtelling als bewijs |
| evidence substitution | bron achter URL veranderd | content hash, capture metadata, immutable versionref |
| provenance laundering | AI-tekst gepresenteerd als menselijk | oorsprongslabel, modelrecord, audit en disclosure |
| inference leakage | gevoelig feit uit graphrelaties | query policy, purpose-limited joins, privacy budget/drempel |
| prompt injection | document stuurt Edge-tools aan | content als onbetrouwbare data, allowlisted tools, action confirmation |
| stale action | oud advies veroorzaakt boeking | freshness gate en authority recheck bij uitvoering |
| insider rewrite | auditketen herschreven | append-only opslag, externe anchors, separation of duties |
| deletion oracle | tombstone verraadt persoon | opaque tombstone, restricted metadata en timingbeperking |
| abusive recall | werkgever vraagt oude fouten op | purpose/role policy, retention, employee boundary, audit |
| moderation erasure | historische kennis verdwijnt | quarantine/restricted archive, reasoned decision, appeal |
| model extraction/data exfiltration | AI-provider ontvangt corpus | data minimization, provider boundary, no-training contract/locale |
| sensor spoofing | gemanipuleerde conditiemeting | device/source attestation, calibration chain, plausibility check |

Veiligheid vereist daarnaast tenant- en domain-isolatie, encryptie, secretsbeheer, back-ups, disaster recovery, vulnerability management en periodieke authorization tests. De lokale hashketen is nuttig als integriteitscontrole, maar pas een extern geankerde head kan herschrijven of truncatie door een beheerder aantoonbaarder maken.

## 32. Failure- en recoverymodel

Iedere kritieke overdracht volgt `prepare → authorize → commit → durable event/outbox → project → acknowledge`. Projecties en AI mogen falen zonder bronstate te verliezen. Consumers zijn at-least-once en idempotent; unknown delivery wordt via operation ID gereconcilieerd.

| Fout | Gebruikerswaarheid | Recovery |
|---|---|---|
| eventbus/consumer uit | bronmutatie blijft committed | durable outbox opnieuw verwerken |
| Lineage Index uit | verbanden tijdelijk niet doorzoekbaar | assertions uit bronnen herprojecteren |
| Recall Broker uit | kernhandeling blijft handmatig mogelijk | source UI toont directe state; later herindexeren |
| AI uit | capture/decision/action blijven menselijk | deterministische formulieren en search |
| source unavailable | geen nieuwe waarheid gokken | stale/unknown tonen, safe wait of human owner |
| revocation propagation vertraagd | risicovolle action blokkeren | source-authority live recheck, cache invalidation |
| partial cross-domain change | receipt ontbreekt | status `DISPATCHED/UNKNOWN`, reconcile; nooit `APPLIED` tonen |
| corrupt projectie | geen brondata repareren vanuit view | projection wissen en rebuilden |
| verkeerde claim | historie behouden, bruikbaarheid stoppen | challenge/retract/supersede en dependents invaliden |
| privacy withdrawal | downstream dependencies bekend | erase/unlink/aggregate/restrict volgens policy, bewijs van afhandeling |

Bij automatiseringsfalen gaat werk naar `SAFE_WAIT → HUMAN_OWNER → RESOLVE → PROOF`. Externe technische fouten worden intern zichtbaar, terwijl de gebruiker een eerlijke processtatus en volgende stap ziet. Disaster recovery test zowel bytes als semantiek: objectversies, authority, lineage en deletion obligations moeten na herstel nog kloppen.

## 33. Metrics en observability

Meet de gezondheid van overdrachten, niet een universele “learning score”:

- feedback met bevestigde behandeling, uitgesplitst naar risico en type;
- change proposals met bevoegd besluit en source-issued receipt;
- correctie- en revocation-propagatietijd;
- stale of ingetrokken recall die vóór presentatie is onderschept;
- contested claims die zichtbaar bleven bij gebruik;
- recovery-, replay- en projection-rebuildsucces;
- expectations met vooraf vastgelegde baseline en meetcoverage;
- prediction calibration per domein/klasse, inclusief abstention en coverage;
- knowledge reuse met bronversie én expliciet doel;
- lessons die aantoonbaar in een change zijn gebruikt;
- recalls die de gebruiker zelf nuttig, irrelevant of schadelijk verklaarde;
- unknown/unmeasurable als eerste klas uitkomst;
- cross-domain handoff zonder owner, receipt of return path;
- privacywithdrawals volledig afgehandeld binnen termijn.

**Waarschuwing voor perverse sturing:** targets op aantallen contributions produceren spam; “knowledge reuse” als succesdoel herhaalt populaire fouten; recall-openrates belonen opdringerigheid; korte decision time onderdrukt overleg; hoge lesson-acceptance verstopt tegenspraak; één prediction-accuracycijfer beloont makkelijke voorspellingen en ontmoedigt abstention; employee learning scores worden surveillance; Foundation impact scores verdringen moeilijk meetbare waarde; weinig correcties kan juist betekenen dat niemand veilig kan corrigeren. Publiceer daarom definities, denominators, missingness en onzekerheid, combineer kwantitatieve signalen met kwalitatieve review en gebruik geen gemiddelde om een gebroken kritieke handoff groen te kleuren.

Traceer operationeel met bestaande correlation/causality IDs en open standaarden, maar log geen volledige persoonlijke inhoud. Audit bewijst wie welke mutatie mocht doen; telemetry meet systeemprestaties; productonderzoek begrijpt menselijk effect. Deze drie datasets horen niet ongemerkt samen te vloeien.

## 34. Emergente multi-domain loops

1. **Experience-to-opportunity:** Travel experience → vrijwillige Library Edition → Academy-module → practice → Talent-portfolio → Work-opdracht → nieuwe vakkennis.
2. **Place stewardship:** community observation → Living World challenge → Foundation-project → Living Lab-interventie → assetchange → geverifieerde place update → volgende bezoeker.
3. **Accessible participation:** eventbehoefte → hospitality/mobility-aanpassing → ervaring → geanonimiseerde lesson → Academy-training → volgende eventversie.
4. **Near-miss prevention:** operationeel incident → Work-retrospective → ChangeReceipt voor proces/runbook → contextuele Edge-recall → volgende uitvoering → non-recurrence met coverage.
5. **Living asset memory:** woningissue → diagnose → interventie → recurrence → onderhoudsplan → privacyveilige overdracht aan volgende bewoner/eigenaar.
6. **Creator real-world loop:** media → Experience Blueprint → plan/qualification/community/provider → deelnamebewijs → place contribution → blueprint Edition 2 → volgende persoon.
7. **Community economic loop:** lokale kennis/event → discovery → aankoop/deelname → settlement → vrijwillige Foundation-bijdrage → lokaal project → rijkere plek → nieuwe activiteit.
8. **Research-to-governance:** observation → hypothesis/falsifier → experiment → conflicterend bewijs → policy proposal → bevoegde beslissing → outcome → recalibratie.
9. **Care without extraction:** hulpvraag → assessment → interventie → menselijke ervaring privé → optionele geanonimiseerde lesson → procesverbetering; hulp blijft onafhankelijk van bijdrage.
10. **Institutional succession:** vertrek medewerker/steward → expliciete handover van besluiten, open risks en negative knowledge → opvolger-recall → nieuwe beslissing → supersession.

Deze lussen zijn latent aanwezig omdat bronstate, bewijs, versie, beslisgeheugen en domeinacties al bestaan. Wat ontbreekt is een uniforme, veilige overdracht tussen de lussen en bewijs dat teruggebrachte kennis werkelijk tot een bevoegd change leidde.

## 35. Internationale standaarden: adapters, geen fundament

Gebruik standaarden aan de grens; behoud intern de minimale RTG-semantiek:

- [W3C PROV-O](https://www.w3.org/TR/prov-o/) voor export van entities, activities en agents; te generiek voor RTG-authority of consent.
- [CloudEvents](https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md) voor event-interoperability; RTG behoudt de bestaande envelop/correlatie als intern contract.
- [W3C Trace Context](https://www.w3.org/TR/trace-context/) en [OpenTelemetry](https://opentelemetry.io/docs/specs/otel/overview/) voor technische tracing; nooit als menselijke causaliteits- of auditwaarheid.
- [Verifiable Credentials Data Model 2.0](https://www.w3.org/TR/vc-data-model/) voor draagbare uitgegeven credentials; issuerclaims blijven scope- en tijdgebonden.
- [ODRL](https://www.w3.org/TR/odrl-model/) voor rechten/policy-uitwisseling; de RTG-policy-engine beslist intern.
- [Data Privacy Vocabulary 2.0](https://www.w3.org/community/reports/dpvcg/CG-FINAL-dpv-20240801/) als woordenboek voor purpose, processing en legal basis.
- [Web Annotation Data Model](https://www.w3.org/TR/annotation-model/) voor feedback/highlights en [ActivityStreams 2.0](https://www.w3.org/TR/activitystreams-core/) alleen voor federatieve activity-export.
- [PREMIS](https://www.loc.gov/standards/premis/index.html) en [OAIS (ISO 14721:2025)](https://www.iso.org/standard/87471.html) voor preservation metadata en archiveprocessen; Library blijft een ander domein dan Archive.
- [IIIF Presentation 3](https://iiif.io/api/presentation/3.0/) voor samengestelde mediarepresentaties en [C2PA](https://spec.c2pa.org/specifications/) voor content provenance waar ecosystemen dit ondersteunen.
- [OGC SensorThings](https://www.ogc.org/standards/sensorthings/) voor sensor observations en metadata; een sensormeting blijft geen bewezen oorzaak.
- [GTFS](https://gtfs.org/documentation/overview/) voor mobility schedules/realtime-uitwisseling en [WCAG 2.2](https://www.w3.org/TR/wcag/) voor toegankelijke interfaces.

Geen standaard mag de interne aggregate-ID, authority-check of versioning vervangen. Adapters zijn versioned, loss-aware en round-trip getest; onbekende velden of betekenisverlies worden zichtbaar gemaakt.

## 36. Wat LibraryOS al heeft bewezen

Commit `0055a1b2d` bewijst lokaal een belangrijke, maar begrensde kennislevenscyclus:

1. `Work` is een stabiele intellectuele identiteit en geen bestand.
2. Draftontwikkeling gebeurt via append-only revisions en stabiele content nodes.
3. Een Edition bevriest een snapshot met hash; Reader en feedback kunnen die exacte inhoud blijven adresseren.
4. PublicationRelease is een afzonderlijk bevoegd besluit.
5. Rechten en instemmingen worden voor de concrete Edition bij de definitieve mutatie opnieuw gecontroleerd.
6. Persoonlijke Reader-state verandert het Work niet.
7. Feedback is geen correctie; een bevoegde correctie levert Edition 2, terwijl Edition 1 byte-/hashmatig en historisch intact blijft.
8. Kritieke events lopen via een durable journal/outbox en consumers kunnen idempotent herstellen.

Het bewijs geldt nog niet voor publieke distributie, tientallen jaren preservation, volledige Knowledge Lineage, marketplace, Academy-integratie of institutionele stewardship. De huidige collectieprojecties en limieten zijn passend voor een pilot, niet automatisch voor wereldschaal. De belangrijkste generaliseerbare les is: **bevries de betekenisvolle input, laat persoonlijke en operationele state apart bewegen en bewijs elke bevoegde overgang met een receipt.**

## 37. Bestaande code die we kunnen hergebruiken

| Bestaand contract/module | Hergebruik |
|---|---|
| `server/kern/envelop.js` | gemeenschappelijke eventmetadata, classificatie, correlation en technische cause |
| `server/bus.js` plus bestaande durable/outboxpatronen | realtime projecties én duurzame kritieke overdracht; bus alleen is onvoldoende bewijs |
| `server/lib/handelingsspoor.js` | pseudonieme audit van geslaagde mutaties, uitgebreid met protocolrefs |
| `server/lib/keten.js` en `keten-anker.js` | integriteitsketen en later externe anchoring |
| policy/capability/authority-contracten | server-derived actor, scope en recheck bij definitieve actie |
| operation-ID/idempotency-patronen | replay en changed-replay bescherming |
| `gevolgcontract/nameting.js` | predicted/observed/missing-coverage semantiek |
| `beslisgeheugen.js` | bevroren verwachting, keuzecontext en latere evaluatie |
| `livinglab/*` | hypothesis/falsifier, observatie versus reflectie, terugtrekken en recalibreren |
| `living-world/*` | freshness, supersession, plansnapshot, vrijwillige contribution en revoke |
| `experience/contract.js` | projecties bezitten geen bronstate; action broker en policycheck |
| `experience/network-graph.js` | graph is incompleet, verleent geen authority en bezit geen waarheid |
| `neiging/*` | purpose-bound persoonlijke inferentie met grounds, expiry en zichtbaarheid |
| `levensgraaf/*` | projection in plaats van tweede database |
| Hospitality-metingen | measured/construct/not-measured en verbod op employee touch counts |
| Mobility dispatch | uitgelegde aanbeveling met menselijke override en locatiepurge |
| LivingOS maintenance | verklaard signal, menselijk voorstel en four-eyes voor kritieke assets |
| Saloon context | expliciet type/tijd/source zonder verborgen totaalscore |
| Edge action-resolver | meerdere interfaces, één authority/state-waarheid |
| LibraryOS kernel/Studio/Reader | immutable snapshots, edition-bound rights, private reading en correction flow |

Hergebruik betekent adapteren achter nieuwe protocolcontracten. Het betekent niet dat één bestaande module RTG-breed eigenaar wordt.

## 38. Bestaande architectuur die hiervoor juist niet geschikt is

- De gewone eventbus is best-effort realtime en daarom geen algemeen duurzaam bewijsregister.
- Een lokale hashketen zonder operationeel extern anchor bewijst geen bescherming tegen beheerderstruncatie.
- `levensgraaf` en `network-graph` zijn nuttige projecties, maar mogen geen centrale semantische of autorisatiebron worden.
- Analytics-, click-, notificatie- of Saloon-engagementevents zijn geen bewijs van menselijke ervaring, toepassing of causaliteit.
- Searchindexen en aanbevelingsscores zijn geen memory authority en verliezen vaak versie/conflict.
- CRM-notities zijn niet automatisch organizational knowledge; ze bevatten doelgebonden persoonsgegevens.
- Files/storage bewijst bytes, maar geen intellectuele identiteit, betekenis, rechten of lineage.
- Audit alleen registreert een handeling; het bewijst niet dat een outcome ontstond of later nuttig was.
- De Library-journalimplementatie is een domeinpatroon, geen uitnodiging voor één platformbrede mega-journal.
- Bestaande recommendation flows kunnen geen toekomstig personenmodel voeden zonder nieuwe purpose, consent en contestability.
- Een generieke `feedback`-tabel zou broncontext, bevoegde behandeling, change en closure opnieuw door elkaar halen.
- Bitemporaliteit overal invoeren zou complexiteit en opslag verhogen zonder overeenkomstige betekenis.

## 39. Nieuwe primitives die werkelijk noodzakelijk zijn

RTG heeft slechts de volgende nieuwe platformcontracten nodig:

1. `ObjectRef` met domain/type/id/version-or-hash.
2. `OriginKind` voor human/system/sensor/AI/authority.
3. `Observation` met observed/recorded/known time, coverage en uncertainty.
4. `ExpectationSet` als vooraf bevroren, versioned beslisinput.
5. `Claim` + `Contest` zonder universele truthscore.
6. `LineageAssertion` als betwistbare, version-bound relatie.
7. `ChangeProposal`, `ChangeDecision`, `ChangeReceipt` en `ChangeVerification`.
8. `RecallTrigger`, `RecallCandidate` en minimale `RecallReceipt`.
9. `Supersession/Retraction` met dependency-invalidation.
10. `MemoryScope` en expliciete `TransferGrant` tussen scopes/domeinen.
11. `RetentionPolicyRef` plus deletion/hold/preservation disposition.
12. `Uncertainty/Coverage` als getypeerde waarden, inclusief unknown/unmeasurable.
13. `AuthorityReceipt` dat laat zien welke actuele policy een mutatie toestond.
14. `ProtocolSchemaVersion` en vocabulary-owner voor semantische evolutie.

Services: een herbouwbare Lineage Index, een Change Router/Ledger en een Recall Broker. Meer platformstate is nu niet gerechtvaardigd. Intent, booking, competence, Work, payment, asset, curriculum, trip, project en Edition blijven domeinobjecten.

## 40. Top 20 onverwachte mogelijkheden

1. Een privacyveilige bibliotheek van near misses die fouten voorkomt zonder werknemers te rangschikken.
2. Kalibratie van beslissingen op basis van vooraf bevroren verwachtingen en echte coverage.
3. Institutionele overdrachtspakketten met besluiten, open onzekerheden en verworpen opties.
4. Een woning of asset met onderhoudsgeheugen dat bewonersidentiteit niet meeverhuist.
5. `Your contribution travelled`: aantoonbare impact via receipts, zonder likes of followercount.
6. Community-maintained checklists die alleen via bevoegde bronchanges nieuwe versies krijgen.
7. Mislukkingen hergebruiken als context, zonder schuld of permanent personenlabel.
8. Automatisch signaleren dat gebruikte rechten, licenties of kennis binnenkort verlopen.
9. Living Places met onderscheid tussen toen waargenomen en nu over toen bekend.
10. Een curriculum dat traceerbaar verbetert door praktijkervaring, met menselijke onderwijsbeslissing.
11. Contextuele voorbereiding op toegankelijkheidsbehoeften vóór een event of reis.
12. Offline recall-pakketten met bevroren versie, expiry en later conflict-safe sync.
13. Opsporen van verweesde Works, policies, assets of communitykennis zonder steward.
14. Impactanalyse wanneer wet, norm, leverancier of bron verandert.
15. Leveranciersproblemen herkennen als operationeel patroon zonder publieke ranglijst.
16. Reversibele policy-experimenten met stopcriteria en aantoonbare rollback.
17. AI-aanbevelingen kalibreren op afloop in plaats van clicks.
18. Propagatie van `evidence lost` naar alle afhankelijke recalls en besluiten.
19. Veilige, versiegebonden overdracht van oral history naar Library, Academy en community archive.
20. Een gebruiker kan zien waarom RTG iets terugbrengt en welke eerdere bijdrage of beslissing ertoe leidde.

## 41. Top 20 grootste risico’s

1. Een centrale graph groeit alsnog uit tot waarheidsmachine.
2. Organizational learning wordt werknemerssurveillance.
3. Context collapse maakt een geldige lokale les universeel.
4. Tijdvolgorde wordt ten onrechte causaliteit.
5. Stale recall stuurt een actuele beslissing verkeerd.
6. Gecoördineerde knowledge poisoning vervormt place/communitykennis.
7. Sybilidentiteiten fabriceren consensus.
8. Metrics sturen naar veel bijdragen en weinig tegenspraak.
9. Consent laundering gebruikt één akkoord voor nieuwe doelen.
10. Purpose creep verbindt gevoelige domeinen tot een profiel.
11. Graphcombinaties heridentificeren geanonimiseerde mensen.
12. Revocation bereikt caches en downstream consumers te laat.
13. Derived records blijven bestaan nadat hun grondslag verdween.
14. AI hallucineert bronnen, lineage of samenvattingen.
15. Automation bias verandert voorstel in de facto besluit.
16. Culturele verschillen worden platgeslagen door één vocabulary.
17. Wet en sociale normen veranderen sneller dan policy/content.
18. Versioning, evidence en media veroorzaken onbeheersbare opslaggroei.
19. Foundation, moderation of archive wordt alsnog gatekeeper van geschiedenis.
20. Export/portability lekt rechten, identiteit of context en verliest semantiek.

## 42. Top 20 ontbrekende ideeën uit de tweede architectuurpass

1. **Observation coverage:** “niet gezien” is pas informatief als het gezien had kunnen worden.
2. **Abstention:** mens en AI moeten expliciet `weet ik niet` kunnen vastleggen.
3. **Verification budget:** controle kost tijd/geld; risico bepaalt hoeveel bewijs nodig is.
4. **Vocabulary versioning:** relation- en claimbetekenis verandert ook door de tijd.
5. **Model registry:** simulatie/AI-output vereist modelcard, geldige scope en vervaldatum.
6. **Sensor calibration lineage:** apparaat, kalibratie, firmware en meetomgeving horen bij de observatie.
7. **Delegation receipts:** bevoegdheid namens een ander vereist scope, tijd en herroepbaarheid.
8. **Challenge windows en appeal SLA:** betwisting moet een eigenaar en termijn hebben.
9. **Reciprocity zonder dwang:** bijdragen waarderen zonder hulp, bereik of basisrechten afhankelijk te maken.
10. **Missing voices:** stiltes en ondervertegenwoordiging zichtbaar maken zonder mensen tot bijdrage te dwingen.
11. **Reversible experiments:** vooraf rollback, blast radius en stopcriteria modelleren.
12. **Knowledge half-life:** reviewfrequentie baseren op veranderlijkheid en gevolg, niet één expiry.
13. **Portable evidence bundle:** objectrefs, receipts, rechten en verificatiemateriaal samen exporteren.
14. **Deliberate organizational reset:** organisaties moeten achterhaalde routines bewust kunnen beëindigen.
15. **Commons disaster preservation:** meerdere custodians, fixity checks en exitplan bij RTG-uitval.
16. **Offline conflict semantics:** late observations en lokale actions mogen geen valse globale volgorde krijgen.
17. **Selective disclosure:** aantonen dat een eis is gehaald zonder onnodige onderliggende data.
18. **Human handoff:** elke geautomatiseerde safe-wait heeft owner, SLA en resolution proof.
19. **Stewardship capacity:** een reviewdatum zonder beschikbare menselijke steward is schijncontrole.
20. **Ecologische kosten:** preservation, AI en telemetry moeten ook energie- en materiaalimpact begrenzen.

## 43. Architectuurdiagram van het volledige systeem

```text
                         ┌──────────────────────────────────────────┐
                         │ HUMAN / ORGANIZATION / COMMUNITY         │
                         │ intent · expectation · consent · contest │
                         └───────────────────┬──────────────────────┘
                                             │
                 ┌───────────────────────────▼──────────────────────────┐
                 │ DOMAIN SYSTEMS — ONE WRITER PER MEANING              │
                 │                                                      │
                 │ Work  Travel  Living  Foundation  Library  Academy  │
                 │ Talent  Events  Hospitality  Mobility  Commerce Pay │
                 │ Media  Communities  Living Lab  Trust & Evidence    │
                 └───────┬──────────────┬──────────────┬────────────────┘
                         │              │              │
               durable event/     versioned refs/    source-issued
               audit/outbox       assertions         change receipts
                         │              │              │
          ┌──────────────▼──────────────▼──────────────▼──────────────┐
          │             RTG LOOP FABRIC — SMALL PROTOCOLS             │
          │                                                           │
          │  OCCURRENCE & OBSERVATION    EXPECTATION & DECISION       │
          │  CLAIM & CONTEST             CHANGE & VERIFICATION        │
          │  MEMORY & RECALL                                          │
          │                                                           │
          │  shared grammar: ObjectRef · time · origin · uncertainty  │
          │  authority · purpose · retention · protocol version       │
          └──────────────┬──────────────┬──────────────┬──────────────┘
                         │              │              │
             ┌───────────▼──────┐ ┌─────▼──────────┐ ┌─▼──────────────┐
             │ LINEAGE INDEX    │ │ CHANGE ROUTER  │ │ RECALL BROKER  │
             │ rebuildable view │ │ + receipt log  │ │ eligible view  │
             │ owns no truth    │ │ owns no change │ │ owns no memory │
             └───────────┬──────┘ └─────┬──────────┘ └─┬──────────────┘
                         │              │              │
                         └──────────────┴──────┬───────┘
                                               │
                                ┌──────────────▼──────────────┐
                                │ SALOON · EDGE · SOURCE APPS │
                                │ explain · compare · propose │
                                │ human choice                │
                                └──────────────┬──────────────┘
                                               │ same resolver +
                                               │ live authority check
                                ┌──────────────▼──────────────┐
                                │ AUTHORITATIVE DOMAIN CHANGE │
                                └──────────────┬──────────────┘
                                               │
                                  outcome / observation / contest
                                               │
                                               └───────────↺

 MEMORY SCOPES, enforced at every boundary:
 PERSONAL → explicit gate → RELATIONSHIP → gate → ORGANIZATION
     → de-identify/steward gate → DOMAIN/ASSET → publish gate → COMMONS

 Archive preserves designated records. Evidence supports claims.
 Neither becomes Library, domain truth, authority or a universal profile.
```

## 44. Gefaseerde implementatiestrategie

**Fase 0 — Constitution en vocabulary.** Wijs protocol- en relation owners aan; leg non-goals, memory scopes, privacygrenzen en vocabulary versioning vast. Maak een catalogus van bestaande contracts en kies drie pilotdomeinen. Gate: geen universele `knowledge`-tabel en geen onbenoemde owner.

**Fase 1 — Protocolkernel.** Voeg alleen gedeelde schema’s/validators toe voor ObjectRef, origin, temporal set, uncertainty/coverage, LineageAssertion, Change records en Recall records. Gebruik bestaande envelop, authority, operation ID, audit en outbox. Gate: contract-, boundary-, replay-, revoke- en privacytests.

**Fase 2 — Eén vertical slice.** Bouw de slice uit §45 met bestaande domain actions. Eerst handmatige UI en deterministische recall; nog geen generieke AI-automatisering. Gate: volledige menselijke lus, source receipts, deletion en failure recovery bewezen.

**Fase 3 — Lineage Index.** Projecteer assertions, contest/supersession en dependency-invalidation. Voeg graph-querypolicy en rebuild toe. Gate: indexverlies verandert bronwaarheid niet; unauthorized edges/data blijven onzichtbaar.

**Fase 4 — Change Router/Ledger.** Standaardiseer proposals, dispatch en source receipts over geselecteerde domeinen. Gate: partial failure, concurrency, rejection, rollback en `unknown` zijn correct.

**Fase 5 — Recall Broker en Edge.** Voeg expliciete triggers, eligibility, freshness, explanation, dismiss/challenge en minimale receipts toe. Gate: AI/push/broker uit laat kernhandelingen leven; stale/revoked recall wordt onderschept.

**Fase 6 — Domain adapters.** Breid uit naar WorkOS incidenten, Travel disruption, Living maintenance, Foundation projects, Academy curriculum en Library corrections. Elk domein kiest eigen loopfamilie, retentie en change action. Gate per keten, niet per route.

**Fase 7 — Portability en preservation.** Bouw exports/adapters voor PROV, VC, PREMIS/OAIS, annotations en relevante sectorstandaarden. Test semantic loss, selective disclosure, key rotation en RTG-exit.

**Fase 8 — Gekalibreerde AI en simulatie.** Pas na voldoende menselijke receipts: explanation, abstention, model registry, counterfactual review en calibration. AI krijgt nooit eigen domain-authority.

Elke fase heeft een kill-switch, datamigratie/terugrol, owner, on-call/recoveryplan en expliciete metrics. Geen big-bang backfill: oude data wordt pas lineage of memory na domeinreview en een bekende grondslag.

## 45. Kleinst mogelijke eerste platformbrede vertical slice

**Slice: een toegankelijkheidsprobleem bij een community-event voorkomt aantoonbaar herhaling bij de volgende editie.** Dit raakt Event/Foundation, Living/Place, WorkOS, Trust & Evidence en Edge/Recall zonder betalingen of brede profilering nodig te hebben.

1. Een deelnemer meldt na afloop vrijwillig: “de drempel blokkeerde mijn rolstoel.” Dit is `human_stated`, gekoppeld aan event-, place- en tijdversie; privé voor de behandelende groep.
2. De melder kiest wat gedeeld mag worden. Medische achtergrond is niet nodig. Intrekken blijft mogelijk.
3. Eventowner ontvangt het signaal, vraagt zo nodig verduidelijking en registreert een observation/claim. Andere betrokkenen kunnen aanvullen of betwisten.
4. De owner bevriest vooraf een verwachting: met tijdelijke helling, route-instructie en aankomstcheck is zelfstandige toegang bij de volgende editie mogelijk; succes- en stopcriteria zijn benoemd.
5. Via WorkOS ontstaat een change proposal voor de eventchecklist en venuevoorbereiding. WorkOS controleert authority en past checklistversie 2 toe.
6. WorkOS geeft een `ChangeReceipt` met before/after-ref; Lineage legt `observation → decision → change` vast zonder te claimen dat één persoon universele waarheid leverde.
7. Bij voorbereiding van de volgende vergelijkbare editie triggert Edge Recall voor de organisator: waarom deze context verschijnt, bronstatus, freshness en concrete checklist. Een gewone bezoeker ziet de private melding niet.
8. De organisator bevestigt of verwerpt toepassing; de bestaande event/action-resolver voert de bevoegde handelingen uit.
9. Na afloop wordt coverage vastgelegd: is de route daadwerkelijk geïnspecteerd en gebruikt? Uitkomst kan `worked`, `did_not_work`, `not_observed` of `unmeasurable` zijn.
10. De oorspronkelijke bijdrager krijgt, alleen indien gewenst, terug: “je melding is behandeld en checklistversie 2 is gebruikt.” Geen naam van andere deelnemers en geen engagementscore.
11. Bij intrekking wordt identiteit losgekoppeld of inhoud verwijderd volgens de gekozen grondslag; de checklistwijziging kan als organisatorisch besluit blijven bestaan wanneer dat zelfstandig gerechtvaardigd is.
12. Bij broker/AI/indexuitval blijft de checklist in WorkOS beschikbaar; bij delivery-onzekerheid toont RTG geen valse bevestiging en reconcileert op operation ID.

Automatisch bewijs moet minimaal afdekken: server-derived actor, consent/purpose, version-bound refs, authority op de definitieve change, immutable expectation, contest, changed replay, gelijktijdige revoke/change, index rebuild, stale recall, deletion propagation, safe degradation, source receipt, next-event recall en menselijke uitkomst. Dit is klein genoeg om te bouwen en breed genoeg om te bewijzen dat RTG werkelijk van ervaring naar bevoegd change en tijdige recall kan gaan.

## Eindantwoord: de beste fundamentele architectuur

RTG moet een **federated Loop Fabric** bouwen: domeinen blijven de enige schrijver van hun betekenis; vijf kleine protocolfamilies verbinden occurrence/observation, expectation/decision, claim/contest, change/verification en memory/recall. Daarboven staan slechts drie smalle, herbouwbare voorzieningen: een Lineage Index, Change Router/Ledger en Recall Broker. Alle overdrachten zijn versiegebonden, doelgebonden, tijdgebonden, betwistbaar en herroepbaar; iedere werkelijke mutatie wordt opnieuw door het brondomein geautoriseerd en met een receipt bevestigd.

Dat ontwerp kan leren zonder centrale waarheidsmachine: claims en perspectieven mogen conflicteren; evidence ondersteunt maar verklaart niet waar; lineage beschrijft afstamming maar geen oorzaak; AI stelt voor maar beslist niet; projecties kunnen verdwijnen zonder bronstate te verliezen. Het kan leren zonder surveillancesysteem doordat persoonlijke ervaring privé begint, bijdrage vrijwillig is, geheugenlagen expliciete poorten hebben, werknemers- en reizigersprofilering geen standaardproduct zijn en institutionele lessen waar mogelijk worden gedeïdentificeerd van individuele historie. Het vermijdt een god-model doordat booking, Edition, competence, settlement, project, asset en policy hun eigen owners en state machines houden.

Een nieuw allesomvattend “Learning Plane” is dus architectonisch verkeerd. De benodigde plane is een kleine interoperabiliteitslaag van protocollen en receipts. LibraryOS bewijst het basispatroon al: immutable versie, aparte gebruikersstate, edition-bound authority en correction-as-new-version. Living Lab, beslisgeheugen, gevolgcontract, Living World, Edge en bestaande authority/outboxpatronen leveren de overige voorlopers. De volgende stap is niet platformbreed modelleren, maar de slice uit §45 bewijzen.

## Wat zien wij nu nog over het hoofd?

De grootste blinde vlek is niet opslag maar **verantwoordelijkheid voor twijfel door de tijd heen**. Een reviewdatum zonder steward, een challenge zonder beroepseigenaar, een recall zonder iemand die freshness bewaakt en een archive zonder opvolging zijn schijnzekerheid. RTG moet daarom naast data altijd capaciteit modelleren: wie kan beoordelen, wie mag besluiten, wie herstelt en wat gebeurt er wanneer niemand die rol meer vervult?

Daarna komen vier onderschatte grenzen. Stilte is geen instemming of afwezigheid van ervaring; niet gemeten is geen negatief resultaat. Collectieve kennis vereist ruimte voor culturele en talige pluraliteit in plaats van één vocabulaire. Verwijderen moet ook afhankelijke afleidingen, modellen, caches en exports bereiken. En duurzame commons vragen een exitstrategie buiten RTG: meerdere custodians, portable evidence bundles en controleerbare preservation.

De harde toets voor iedere volgende stap luidt daarom niet “heeft RTG dit onthouden?”, maar:

> Kan de juiste mens zien wat toen werd verwacht, wat werkelijk werd waargenomen, wie welke claim of beslissing maakte, wat bevoegd veranderde, hoe onzeker of betwist dat is, waarom het nu wordt teruggebracht, en kan die mens corrigeren, weigeren of vergeten worden zonder de legitieme geschiedenis te vervalsen?

Als het antwoord op één van die delen ontbreekt, is de lus nog open.
