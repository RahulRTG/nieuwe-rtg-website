# RTG NEXT werkboek per capability

Gegenereerde planningbijlage bij [het premium-afbouwplan](../rtg-premium-afbouwplan.md). Bewerk de gekoppelde werkpakketten en genereer opnieuw met `node scripts/rtg-next-programma.js --write`.

**Planning, geen kwalificatiebewijs.** Dit werkboek inventariseert 114 bestaande MAPPEN-ingangen. Meerdere ingangen kunnen één domeineigenaar of scherm delen. De canonieke appbelofte en de hieronder voorgestelde premium-eindtoestand blijven afzonderlijk herkenbaar.

Bronbaseline: `abd1eafdccd6865631d634d5899676c1c1e7fa68`. Inhoudshash van deze projectie: `836dfb88ac2ad4da6d1c2adf3659f9c6f3abf2b12199ce643e962338d66b6f00`.

Opgeslagen APPWERKT-meting: `d3a2cd8a66` op 2026-11-09T14:51:20.049Z; telling `{"BEWEZEN":114}`. Dit is geen verse uitvoering op de bronbaseline.

Opgeslagen Experience-status: `NOT_TESTED`; kandidaat `null`. Actuele declaratieve signatures: 114 app en 316 schermen. Een declaratie is geen uitgevoerd bewijs.

Alle werkpakketten doorlopen daarnaast de gemeenschappelijke levensloop-, privacy-, rol-, herstel-, toegankelijkheids- en menselijke acceptatie uit het premium-afbouwplan. De scenario’s hieronder zijn specifieke aanvullingen, geen uitputtende testset. Nieuwe scope wordt eerst bij de bestaande scopebron besloten.

## Twaalf referentie-ervaringen

| Ingang | Taak | Storingen | Vereiste uitkomst |
|---|---|---|---|
| `tab:reizen` | Reisoriëntatie en geautoriseerde agenda als projectie; behoud de bestaande autoshowroomtaak tot expliciet herplaatsingsbesluit. | vlucht wijzigt na dossierakkoord; andere reiziger krijgt geen ongeautoriseerde agenda | Dossier toont bronstatus en gevolgen voor agenda/reisboek; onbevestigde stappen blijven herkenbaar. |
| `link:vluchten` | Providerafhankelijke aanvraag, bevestiging, betaling en verstoring. | provider accepteert maar antwoord raakt kwijt; prijs verandert vóór bevestiging | Geen tweede reservering of afschrijving; gewijzigde voorwaarden vragen nieuw akkoord. |
| `link:geldcommand` | Geld als canonieke eigenaar van financiële standen en projecties. | dubbele bevestiging op twee workers; onzekere externe betaaluitkomst | Grootboek en ontvangstbewijs verzoenen; saldo/aanvraag/definitieve betaling blijven onderscheiden. |
| `link:passkeys` | Sterke toegang, herstel en toestelintrekking. | laatste bruikbare toegang dreigt te verdwijnen; intrekking tijdens actief plan | Geen stil accountverlies; ingetrokken toestel kan geen effect uitvoeren. |
| `link:berichten` | Communicatie met juiste ontvanger, bezorgstatus en privacy. | antwoord ontbreekt na verzenden; ontvangerstoegang ingetrokken | Concept/bevestigd verzonden/bezorgd/gelezen volgen werkelijke bronnen; geen ongeoorloofde levering. |
| `link:mall` | Ontdekken tot bestelling en commercieel herstel. | voorraad of prijs verandert; slechts een deel van bestelling bevestigd | Voorwaarden en verkoper zichtbaar; deelresultaten en restitutie volgen de domeinbron. |
| `link:vandaag` | Relevantie en rustige dagelijkse regie zonder verborgen acties. | verouderde bron levert verkeerde aanbeveling; gebruiker zet adaptieve voorkeur uit | Uitlegbare prioriteit met bronmoment; vaste navigatie en handmatige bediening blijven beschikbaar. |
| `link:veilig` | Veiligheid, sessie-/gegevensgrenzen en begrijpelijk herstel. | verdachte sessie heeft open concept; offline toestel ontvangt intrekking later | Geen nieuwe bevoegdheid uit cache; onzekerheid, herauthenticatie en herstelpad zijn zichtbaar. |
| `link:office` | Langdurige documentbewerking, delen en versieconflicten. | twee apparaten wijzigen dezelfde versie; toegang ingetrokken tijdens editorwerk | Geen stil invoerverlies; versieconflict en rechtmatige export/deling aantoonbaar. |
| `link:decisionroom` | Menselijke besluitvorming, rollen en twee-persoonsgoedkeuring. | aanvrager probeert eigen besluit goed te keuren; stemmer verliest rol vóór uitvoering | Besluit, uitvoering en onderbouwing blijven gescheiden; live rolcontrole voorkomt ongeoorloofde uitvoering. |
| `link:horeca` | Operationele bestelling/reservering met medewerkers, gast en betaalgrens. | laatste capaciteit gelijktijdig aangevraagd; verbinding valt uit na betaling | Geen overselling binnen bewezen scope; personeel en gast zien dezelfde bevestigde status. |
| `link:foundationzorg` | Gezinszorg met gescheiden Care- en gezondheidsbronnen. | oudertoestemming wordt ingetrokken; ander gezin vraagt hetzelfde object op | Geen gegevenslek; afspraken/betaling en gezondheidskaart behouden eigen eigenaar; Rahul stelt geen medische diagnose. |

## LivingOS

### 1. Het Vooruitzicht - `link:vooruitzicht`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Horizon. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:rechterhand`, `link:reisboek`, `link:geldcommand`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/living-os.html.

**Canonieke productbelofte:** een lid legt een intentie vast, verkent routes en geeft de voorbereiding vrij, en het vooruitzicht toont uitsluitend wat een bron gaf -- geen providerstatus die niemand bevestigde.

**Huidige implementatie, statisch onderzocht:** living-os.html gebruikt instant-reality en meerdere bestaande bronnen. De proef kent intentie, routekeuze, voorbereiding en versieconflict; haar expliciete grens meldt geen providerroute en weigert providerbevestiging door een lid.

**Bronnen:** [public/apps/living-os.html](../../public/apps/living-os.html), [scripts/lib/voltooi/vooruitzicht.js](../../scripts/lib/voltooi/vooruitzicht.js), [public/apps/living-os.js](../../public/apps/living-os.js), [server/kern/experience/broker.js](../../server/kern/experience/broker.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/living-os.html` → `leven.vooruitzicht` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een gecontroleerde vooruitblik op een gekozen bedoeling, met feitelijke huidige toestand, hypothetische mogelijkheden, onzekerheden en een hervatbaar Plan Dossier.

**Benodigde wijzigingen:**

- Hergebruik de huidige versiegebonden intentie- en gebeurtenisketen voor Plan Dossier-referenties; houd brondomeinen eigenaar van boekingen, geld en documenten.
- Laat Consequence Graph alleen geautoriseerde, herleidbare afhankelijkheden tonen en onbekende gevolgen even expliciet als bekende.
- Sluit uitvoerbare stappen gefaseerd aan op bestaande broker en providerbewijzen; een voorbereid plan blijft onderscheiden van externe bevestiging.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid verkent een reisverstoring en kiest een alternatief in de hypothetische vooruitblik. → Alleen het scenario en de planversie veranderen; geen boeking, betaling of providerstatus wordt door de simulatie bevestigd. Bewijs: scripts/lib/voltooi/vooruitzicht.js — Bestaande vooruitzichtproef plus negatieve-effect- en bronherkomsttest van Consequence Graph. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:vooruitzicht:f2b67942f9c4480528008f7b0a815948ce4f84c77a467d99151a45bf1a3a3685`.
2. Twee toestellen wijzigen hetzelfde dossier en één bronrecht wordt intussen ingetrokken. → Geen stille overschrijving; de actuele versie en ingetrokken context worden uitgelegd en uitvoering vraagt een nieuw geldig voorstel. Bewijs: scripts/lib/voltooi/vooruitzicht.js — Versieconflict-, intrekkings-, herstart- en broker-fingerprintketen. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:vooruitzicht:dd8fdc274a5817507f4bf44859279d418d50baa74d81b83428660c2206ae2135`.

**Externe voorwaarden / besluiten:** Providerintegratie is een afzonderlijk werkpakket met echte bevoegde bron; totdat die bestaat blijven externe statusovergangen geblokkeerd.

### 2. Vandaag - `link:vandaag`

**Bouwcohort:** eerste twaalf, poort G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Horizon. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:veilig`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/life.html.

**Canonieke productbelofte:** een lid houdt zijn dag bij: een gewoonte afvinken en weer uitzetten, een meting met herkomst, een dagcheck-in, en een noodkaart die alleen hij zelf toont.

**Huidige implementatie, statisch onderzocht:** Vandaag is life.html met gewoonten, metingen, dagcheck-in en noodkaart. De proef sluit medicatie, toestellen, veiligheidskring en dagcoach uit en vermeldt dat de hulpvraaggrens niet is uitgelokt.

**Bronnen:** [public/apps/life.html](../../public/apps/life.html), [scripts/lib/voltooi/vandaag.js](../../scripts/lib/voltooi/vandaag.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/life.html` → `dag.overzicht` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een rustige persoonlijke dagomgeving voor eigen ritmes en welzijn, met bronherkomst en veilige grenzen; geen prestatiedruk, diagnose of ongeoorloofd gedeeld gezondheidsprofiel.

**Benodigde wijzigingen:**

- Gebruik de bestaande Life-eigenaar voor een duidelijke daglijn met handmatige correctie, lokale dag en begrijpelijke meetherkomst.
- Verbind medicatie-, veiligheids- en toestelgegevens uitsluitend als bevoegde bronprojecties en geef onbekende of verouderde waarden een duidelijke status.
- Kwalificeer hulpvraaggrenzen, handmatige modus zonder AI, noodkaartdeling en gezondheidsteksten met onafhankelijke deskundigen.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid voert een meting met herkomst in, corrigeert deze en wisselt van lokale datum. → Correctie en dagindeling zijn herleidbaar; geen onverklaarde gezondheidsconclusie of competitieve score ontstaat. Bewijs: scripts/lib/voltooi/vandaag.js — Bestaande vandaagproef plus lokale-dag-, correctie-, bron- en offlinehersteltest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:vandaag:5ceda6161cb56224410916c658a8305d943a0fd17cd616ffee51b409c48265eb`.
2. Een dagcheck-in bevat een hulpvraag en de AI is niet beschikbaar. → De veiligheidsgrens werkt zonder model; de interface toont een passende echte hulproute en deelt de noodkaart niet zonder de geldige keuze van het lid. Bewijs: scripts/lib/voltooi/vandaag.js — Veiligheidsevaluatie met deskundige, negatieve deeltest en model-uit-browserketen. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:vandaag:a7bf0225907d89c22b2573ff676ee42e4e155e2dbc3e0c4191fbaf5485e4b662`.

**Externe voorwaarden / besluiten:** Medische of behandelclaims, medicatieadvies en gekoppelde medische apparaten vereisen apart klinisch/juridisch besluit; actuele hulproutes hebben een onderhoudseigenaar nodig.

### 3. Mijn leven - `link:leven`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Horizon. **Budgetverwijzing:** browse → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:entourage`, `link:vandaag`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/leven.html.

**Canonieke productbelofte:** een lid ziet op zijn lijn alleen wat hij zelf ergens vastlegde en wat deze week speelt, zonder knop die iets voor hem doet, en niemand anders ziet het.

**Huidige implementatie, statisch onderzocht:** Mijn leven leest /api/leven/cockpit uit bestaande bronnen en agenda; de proef beschrijft een projectie zonder uitvoerknoppen of kopie. Schoolfasen, werkrollen, Entourage en gegevensgesprek vallen buiten haar huidige bereik.

**Bronnen:** [public/apps/leven.html](../../public/apps/leven.html), [scripts/lib/voltooi/leven.js](../../scripts/lib/voltooi/leven.js), [server/kern/levensgraaf/graaf.js](../../server/kern/levensgraaf/graaf.js), [LIFE.md](../../LIFE.md).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/leven.html` → `leven.werkblad` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een persoonlijke, rustige levenslijn met betekenisvolle eigen gebeurtenissen en transparante herkomst, zonder levensscore of sturende sociale rangorde.

**Benodigde wijzigingen:**

- Hergebruik de levensgraaf als geautoriseerde lezing en voeg expliciete brondekking, actualiteit en verberg-/voorkeursbediening toe.
- Maak doorklikken naar de eigenaar en een bewust gekozen Plan Dossier mogelijk; de levenslijn gaat geen domeinprocessen bezitten.
- Kwalificeer werk/privé- en Foundationgrenzen met intrekking, gevoelige velden en nieuwe levensfasen zonder stil gegevens te combineren.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid legt een afspraak en een privédoel in de bestaande bronnen vast. → De lijn toont alleen toegestane relevante feiten met bronverwijzing; er ontstaat geen gekopieerd dossier of score op het leven. Bewijs: scripts/lib/voltooi/leven.js — Bestaande levenproef plus bronprojectie- en gegevensminimalisatietest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:leven:5dd392c3d79ae7e36c8e03d09c99f02633f0aac286358a01fdad0e0a839ebfaa`.
2. Een werkrol of gedeeld Foundationrecht vervalt terwijl de levenslijn openstaat. → De betreffende informatie verdwijnt na hercontrole; geen privé-/werkbron blijft via cache of samenvatting bereikbaar. Bewijs: scripts/lib/voltooi/leven.js — Rechtintrekking-, federatie-, cache- en privacyacceptatieproef. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:leven:c6ba195fe057b09017fb2f5a075f3a5fed5c2c933e9712a532bf583e00b71da1`.

**Externe voorwaarden / besluiten:** Geen aanvullend extern besluit benoemd; de bestaande toezegklasse en gemeenschappelijke scopepoort blijven gelden.

### 4. Sociaal - `link:sociaal`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Command. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:berichten`, `tab:salon`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/sociaal.html.

**Canonieke productbelofte:** Rahul zet klaar wat er in de kring van het lid openstaat, de mens bevestigt, de ander ziet het antwoord en het actielog verantwoordt het.

**Huidige implementatie, statisch onderzocht:** Sociaal leest wereld, command, lijn en object en bevestigt bestaande voorstellen. De proef bouwt een Genootschap-uitnodiging op; inbox en live-stroom worden niet doorlopen.

**Bronnen:** [public/apps/sociaal.html](../../public/apps/sociaal.html), [scripts/lib/voltooi/sociaal.js](../../scripts/lib/voltooi/sociaal.js), [server/kern/socialecommand/voorstellen.js](../../server/kern/socialecommand/voorstellen.js), [LIFE.md](../../LIFE.md).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/sociaal.html` → `sociaal.leven` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een sociale regieomgeving die openstaande keuzes samenbrengt en menselijke bevestiging centraal houdt, zonder relaties te sturen of eigen agenda-/berichtsystemen te creëren.

**Benodigde wijzigingen:**

- Projecteer bestaande openstaande sociale taken met reden, geldige kring en een concrete volgende stap.
- Verbind een gekozen activiteit aan Plan Dossier en Consequence Graph, uitsluitend met toegestane bronverwijzingen.
- Hercontroleer ontvangers, voorwaarden en rechten bij bevestigen; het voorstel is versiegebonden en verliest geldigheid bij gewijzigde context.

**Specifieke acceptatie en te leveren bewijs:**

1. Rahul bereidt een antwoord op een bestaande groepsuitnodiging voor. → Er wordt niets verstuurd vóór bevestiging; daarna zien de bevoegde ontvangers exact het gekozen antwoord en staat het in het actielog. Bewijs: scripts/lib/voltooi/sociaal.js — Bestaande sociaalproef plus voorstel-tot-inbox/live-stroom-keten. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:sociaal:173d75f43f34de0f33f9236bd1f16a76ad9a238d439d6b33364c0929a93b2c20`.
2. De groep wijzigt of de uitnodiging vervalt tussen voorbereiding en bevestiging. → Het oude voorstel kan niet uitvoeren; het scherm verklaart de gewijzigde situatie en laat opnieuw kiezen zonder onbedoeld contact. Bewijs: scripts/lib/voltooi/sociaal.js — Stale-context-, intrekking-, dubbelklik- en herstartproef. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:sociaal:06a79e8dd1863f246d5f6132b5d2d36a020343c6a117a0ac7995d0d04d8447e3`.

**Externe voorwaarden / besluiten:** Geen aanvullend extern besluit benoemd; de bestaande toezegklasse en gemeenschappelijke scopepoort blijven gelden.

### 5. Geld - `link:geldcommand`

**Bouwcohort:** eerste twaalf, poort G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Ledger. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:pay`, `link:wallet`, `link:wbw`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/geld.html.

**Canonieke productbelofte:** een lid ziet hoe het er financieel voor staat, zet potten en regels binnen de harde grens van GELD.md en leest elke handeling terug in het actielog -- een ander lid ziet of raakt er niets van, en een dubbele tik, een afgebroken verzoek of een crash zet een bedrag nooit twee keer opzij.

**Huidige implementatie, statisch onderzocht:** Geld is geld.html met meerdere hashstanden; de proef gebruikt cockpit, beleid, potten en actielog. Potten zijn oormerken; cockpitinhoud, gegronde Rahul en geldgrenzen vallen volgens de proeftekst buiten haar bereik.

**Bronnen:** [public/apps/geld.html](../../public/apps/geld.html), [scripts/lib/voltooi/geldcommand.js](../../scripts/lib/voltooi/geldcommand.js), [server/kern/geldgraaf/index.js](../../server/kern/geldgraaf/index.js), [GELD.md](../../GELD.md).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/geld.html` → `geld.overzicht` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een financieel commandocentrum dat rust geeft door één betrouwbaar beeld van feiten, verwachtingen en beslissingen, met explainability tot op de bron en zonder tweede boekhouding.

**Benodigde wijzigingen:**

- Verbind bestaande geldgraaf, cockpit en actielog in drie vaste vragen: beschikbare ruimte, komende verplichtingen en beslissingen; markeer verwachtingen apart.
- Maak Consequence Graph-scenario's read-only: voorstel, aannames, onbekenden en effect op eigen potten; daadwerkelijke mutaties lopen via bestaande domeinen en bevestiging.
- Kwalificeer alle hashstanden en Rahul-overdracht als één Geld-eigenaar; iedere financiële bewering krijgt bron, peildatum en geldige bevoegdheid.

**Specifieke acceptatie en te leveren bewijs:**

1. Het lid vergelijkt een reisvoorstel met eigen potten en kiest een reservering binnen het eigen tegoed. → Scenario verandert geen saldo; de bevestigde interne reservering komt één keer bij de pot en het actielog terecht, met onderscheid tussen oormerk en geld. Bewijs: scripts/lib/voltooi/geldcommand.js — Bestaande geldcommand-proef plus scenario-tot-beleid-keten en vergelijking met autoritatieve grootboeken. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:geldcommand:2e3855f52b94e8c6f62e1ec551bc234ae738dfa430f300c48f37b3318c8dffab`.
2. Eén financiële bron valt uit of een plan gebruikt een verlopen bevoegdheid. → Het totaal maakt de onvolledigheid zichtbaar en uitvoeren blijft gesloten; andere bekende bronnen blijven afzonderlijk leesbaar. Bewijs: scripts/lib/voltooi/geldcommand.js — Bronuitval-, ingetrokken-recht-, dubbelverzoek- en crashproef; onafhankelijke financiële review. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:geldcommand:2c4973a54ad36e44a2cf27b812605e373bb862b401fc200b24eecf8c724c1061`.

**Externe voorwaarden / besluiten:** Geen uitbreiding naar krediet, beleggen of verzekeringsadvies zonder apart product-, vergunning- en compliancebesluit; live betaalrails blijven extern gekwalificeerd.

### 6. RTG Media - `link:mediaos`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Library. **Budgetverwijzing:** browse → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:theater`, `link:muziek`, `link:clips`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/media.html.

**Canonieke productbelofte:** een lid ziet de mediawereld met bij elk stuk waarom het er staat, bewaart wat het wil houden, maakt een eigen afspeellijst en deelt die om te lezen met wie het kent; de lezer verandert niets en een vreemde ziet niets.

**Huidige implementatie, statisch onderzocht:** RTG Media leest een wereldprojectie, bewaart items en beheert gedeelde leesbare lijsten. De proef speelt niets af en sluit smaakregelaars, aanwezigheid, meldingen en luisterkamer uit.

**Bronnen:** [public/apps/media.html](../../public/apps/media.html), [scripts/lib/voltooi/mediaos.js](../../scripts/lib/voltooi/mediaos.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/media.html` → `media.centrum` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Eén persoonlijk mediageschap met begrijpelijke selectie, eigen bibliotheek en naadloze overgang naar de passende speler, waarbij aanbevelingen controleerbaar en eindig blijven.

**Benodigde wijzigingen:**

- Hergebruik de bestaande mediawereld als projectie met bron, maker, rechten en uitleg waarom een stuk wordt getoond.
- Verbind lijsten aan bestaande spelers met hervatcontext, zonder bestanden of contentrechten te kopiëren.
- Kwalificeer delen, intrekken, smaakinstellingen en aanwezigheid afzonderlijk; delen blijft een bewuste keuze en ontvangersrechten blijven minimaal.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid maakt een gemengde lijst en deelt die leesbaar met één bekend contact. → De ontvanger kan de lijst niet wijzigen en krijgt per item alleen zijn eigen geldige afspeelrecht; derden zien niets. Bewijs: scripts/lib/voltooi/mediaos.js — Bestaande mediaos-proef plus lijst-tot-speler- en itemrechtenketen. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:mediaos:d802e0251a3f5ff96f6cd515a81eea58521d0923802a048aa369cf000411c508`.
2. De maker trekt het delen in of een mediabron verdwijnt tijdens hervatten. → De gedeelde lijst of het item verliest de toegang; de speler toont onbeschikbaarheid en gebruikt geen oude gecachte rechten. Bewijs: scripts/lib/voltooi/mediaos.js — Intrekking-, spelerhandoff-, cache- en herstelproef. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:mediaos:063f4bff4ef7e4e5f3262f55b071c36a15b36434101c0be7c0a00596d8efe18e`.

**Externe voorwaarden / besluiten:** Licenties voor afspelen, downloaden en delen blijven brongebonden; een lijst geeft geen nieuwe mediarechten.

### 7. RTG Veilig - `link:veilig`

**Bouwcohort:** eerste twaalf, poort G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Ceremony. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:relaties`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/veilig.html.

**Canonieke productbelofte:** als het misgaat krijgen de mensen die het lid zelf koos bericht, met alleen wat hij per persoon toestond, en een lege kring wordt eerlijk geweigerd.

**Huidige implementatie, statisch onderzocht:** RTG Veilig heeft veiligheidskring, locatie, alarm en afsluiten. De proef controleert zichtbaarheid voor gekozen contacten en mail in een postvanger; echte push/mailbezorging, thuiswacht, codewoord en rustoptie zijn daar niet bewezen.

**Bronnen:** [public/apps/veilig.html](../../public/apps/veilig.html), [scripts/lib/voltooi/veilig.js](../../scripts/lib/voltooi/veilig.js), [public/apps/veilig/voorzijde.js](../../public/apps/veilig/voorzijde.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/veilig.html` → `veilig.noodcontacten` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een begrijpelijke persoonlijke veiligheidsvoorziening die exact vertelt wie wordt benaderd, welke informatie gedeeld wordt en wat daadwerkelijk is bezorgd, zonder alarmcentralegarantie.

**Benodigde wijzigingen:**

- Maak per contact gegevensdoel, kanaal, geldigheid en toegestane locatie zichtbaar en intrekbaar via bestaande kringrechten.
- Scheid alarm geactiveerd, bericht aangeboden, bezorgd voor zover aantoonbaar en door contact gezien; gebruik expliciete onbekend-statussen.
- Ontwerp een snelle maar toegankelijke start-/stoplus, oefenstand met herkenbare testcontext en een eerlijk alternatief bij lege kring of netwerkuitval.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid activeert een alarm met verschillende deelrechten voor twee contacten. → Ieder contact krijgt uitsluitend toegestane gegevens; RTG meldt alleen aantoonbare kanaalstatus en geen ongefundeerde hulpverlening. Bewijs: scripts/lib/voltooi/veilig.js — Bestaande Veilig-proef plus echte push-/mailtest, ontvangersmatrix en menselijke crisistoegankelijkheidstest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:veilig:d2a5662bbcaca3a0d61044547aa557d0e5b67c7250c9d39ba7b7c08090d1c7df`.
2. De kring is leeg, een kanaal valt uit of een contactrecht wordt ingetrokken tijdens het alarm. → Het lid ziet onmiddellijk de feitelijke beperking; oude rechten leiden niet tot extra locatielek en afsluiten stopt verdere toegestane verspreiding. Bewijs: scripts/lib/voltooi/veilig.js — Lege-kring-, netwerk-, intrekkings-, timer- en herstelproef. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:veilig:d604d1268c1d6a24df9004506054222321379471cc72f9fa5d59c82e6880c06b`.

**Externe voorwaarden / besluiten:** Bezorginfrastructuur, operationele support en veiligheidsclaims moeten zijn getoetst; RTG blijft geen vervanging voor officiële noodhulp.

### 8. RTFoundation - `os:rtf`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Ceremony. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:rtfportaal`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** kiezer in de app.

**Canonieke productbelofte:** een lid opent de RTFoundation en kiest de passende leeftijdswereld voordat de Foundation-jas wordt geopend.

**Huidige implementatie, statisch onderzocht:** De RTFoundation-ingang in app.html opent een leeftijdskeuze. De browserproef toetst keuze, toegangsstap en lokale terugkeer bij uitval; gezinsaanmaak en volledige menselijke Experience-kwaliteit zijn niet daarin gekwalificeerd.

**Bronnen:** [public/apps/app.html](../../public/apps/app.html), [scripts/lib/voltooi/rtfoundation-keuze.js](../../scripts/lib/voltooi/rtfoundation-keuze.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/app.html` → `kern.app` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een eenvoudige veilige overgang naar Foundation die leeftijd, rol en gezinscontext correct uitlegt zonder de keuze van een leeftijdswereld als bewijs van leeftijd of bevoegdheid te behandelen.

**Benodigde wijzigingen:**

- Gebruik de bestaande toegangsstap en Foundation-sessie; scheid presentatiewereld van geverifieerde bevoegdheid.
- Behoud de gekozen context bij terugkeer en leg uit waarom een ouder-, gezins- of leerlingstap nodig is.
- Maak taal, focus en herstelsituaties passend voor de doelgroep; deel geen LivingOS-profiel automatisch met Foundation.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid kiest een kinderwereld zonder passend gezinsrecht. → De bedoelde toegangsstap verschijnt; de keuze verleent geen kinderaccount, ouderrecht of geverifieerde leeftijd. Bewijs: scripts/lib/voltooi/rtfoundation-keuze.js — Bestaande RTFoundation-keuzebrowserproef plus toegangsmatrix voor lid, ouder, leerling en gast. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:os:rtf:6b79f2ea016b8da6668ad45d7b34f34d096cb5bde26f4c24b4931128c110d36f`.
2. De server valt uit na keuze en de gebruiker keert terug terwijl een eerder recht is ingetrokken. → Lokale navigatiekeuze kan behouden blijven, maar actuele gevoelige gegevens en handelingen blijven dicht tot hercontrole. Bewijs: scripts/lib/voltooi/rtfoundation-keuze.js — Offlinekeuze-, intrekkings- en sessiegrensproef; leeftijdspassende menselijke acceptatie. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:os:rtf:fed2c486fe9f07a664e3e2a4f3449c3ac280a63fdd2db652cd3b0a9506bae17f`.

**Externe voorwaarden / besluiten:** Geen aanvullend extern besluit benoemd; de bestaande toezegklasse en gemeenschappelijke scopepoort blijven gelden.

### 9. Betalen - `tab:betalen`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Ledger. **Budgetverwijzing:** transaction → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:pay`, `link:rtgcode`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/app.html (stand betalen).

**Canonieke productbelofte:** een lid rekent het betaalverzoek van een zaak een keer af, betaalt een zaak rechtstreeks en hoort het als de bank weigert.

**Huidige implementatie, statisch onderzocht:** De betalen-tab leest verzoeken en gebruikt betaal/verzoek/pay, direct en mijn. De proef vergelijkt ledenbetaling met zaakontvangsten en test weigering, duplicaten en crashes.

**Bronnen:** [public/apps/app.html](../../public/apps/app.html), [scripts/lib/voltooi/betalen.js](../../scripts/lib/voltooi/betalen.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/app.html` → `kern.app` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een korte, foutbestendige betaalervaring waarin ontvanger, bedrag, reden, kosten en uitkomst begrijpelijk zijn en onzekere betalingen nooit tot blind opnieuw betalen leiden.

**Benodigde wijzigingen:**

- Presenteer ieder betaalverzoek met verifieerbare ontvanger en onveranderlijke bedrag-/versiereferentie; laat gewijzigde verzoeken opnieuw bevestigen.
- Gebruik bestaande betaalwaarheid voor in behandeling, geweigerd, bevestigd en controle nodig, met een traceerbaar ontvangstbewijs.
- Voeg een herstelkaart toe die eerst de bestaande betaling opzoekt voordat een nieuwe opdracht mogelijk is.

**Specifieke acceptatie en te leveren bewijs:**

1. Het lid bevestigt een betaalverzoek terwijl de zaak het bedrag wijzigt. → De oude toestemming betaalt niet het nieuwe bedrag; de gebruiker ziet een nieuw voorstel of een duidelijke versieconflictstatus. Bewijs: scripts/lib/voltooi/betalen.js — Bestaande betaalproef plus voorstel-fingerprint- en bedragwijzigingstest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:tab:betalen:a6824a3fdd05cf2c6b80ac68dfae17b8ec6f209f504a5477ffd924a451e8c291`.
2. Na betalen verliest het toestel de verbinding en het lid opent dezelfde opdracht opnieuw. → RTG toont de bestaande betaalstatus en precies één ontvangst bij de zaak; onbekend blijft onbekend tot reconciliatie. Bewijs: scripts/lib/voltooi/betalen.js — Dubbeltik-, disconnect-, providerreconciliatie- en browserherstelbewijs. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:tab:betalen:e90663c3e1a1b31eae3882fdbf5d9442c2030b42f330914c0a94f0d5472fa8ce`.

**Externe voorwaarden / besluiten:** Live betaalprovider, betaalcertificering en overeengekomen operationele terugbetalingsroute blijven externe releasevoorwaarden.

### 10. Wallet - `link:wallet`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Ledger. **Budgetverwijzing:** transaction → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:geldcommand`, `link:pay`, `link:rtgcode`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/geld.html#wallet.

**Canonieke productbelofte:** een lid legt zijn kaarten in de wallet, koopt feestmunten die echt betaald worden en wisselt ze in, nooit onder nul -- een ander lid ziet of raakt er niets van, en een dubbele tik, een afgebroken verzoek of een crash laat hem nooit twee keer betalen.

**Huidige implementatie, statisch onderzocht:** Wallet is een hashstand in Geld met kaarten, toevoegen/verwijderen en feestmunten kopen/inwisselen. De proef gebruikt de simulatiebank en sluit de ledenpas en het grote codescherm uit.

**Bronnen:** [public/apps/geld.html](../../public/apps/geld.html), [scripts/lib/voltooi/wallet.js](../../scripts/lib/voltooi/wallet.js), [GELD.md](../../GELD.md).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/geld.html` → `geld.overzicht` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een overzichtelijke digitale portefeuille met herkenbare kaarttypen, geldige rechten en exacte financiële status, waarin een opgeslagen kaart nooit vanzelf een uitgeversgarantie krijgt.

**Benodigde wijzigingen:**

- Behoud kaart- en muntbronnen en onderscheid zelf toegevoegde kaart, uitgeversbewijs, betaaltegoed en toegangsbewijs.
- Maak verlopen, ingetrokken, offline bruikbaar en online te verifiëren per kaart expliciet, met zo weinig mogelijk gevoelige velden.
- Kwalificeer samenhang met RTG Pay, Betaalcode en ledenpas op dezelfde Geld-eigenaar; geen tweede saldo of uitgiftemotor.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid koopt feestmunten, toont een kaart en wisselt een deel in. → Betaling en muntstand zijn exact herleidbaar en gaan niet onder nul; kaartweergave claimt uitsluitend het werkelijke uitgeversrecht. Bewijs: scripts/lib/voltooi/wallet.js — Bestaande walletproef plus Pay-/code-/pas-keten en bronclassificatietest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:wallet:db284a38ba0d8d32cd504144e22a210f7e9b78749a34515a59ea40c46ded5cda`.
2. Een kaart wordt ingetrokken of inwisselen krijgt een time-out tijdens offlinegebruik. → Gevoelige uitvoering wacht op geldige verificatie; hetzelfde verzoek kan niet dubbel afschrijven en een oude kaart verschijnt als ongeldig. Bewijs: scripts/lib/voltooi/wallet.js — Intrekking-, offlinegrens-, idempotentie-, reconciliatie- en herstelbewijs. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:wallet:bfb0c95e14ca1d0bd217fe4024b8ac67b0c2d9c16ac7ebe00de4497dc0ea39a3`.

**Externe voorwaarden / besluiten:** Externe kaarten, digitale identiteitsbewijzen en eventuele geldvormen vragen geldige uitgever-/providercontracten; gesloten feestmunten worden geen publieke token.

### 11. Bank - `link:bank`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Ledger. **Budgetverwijzing:** transaction → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:geldcommand`, `link:pay`, `link:verificatie`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/geld.html#bank.

**Canonieke productbelofte:** zodra het kantoor de leden-bank live zet, geeft een lid akkoord, krijgt een rekening, stort geld van buiten, boekt over tussen eigen rekeningen en leest het afschrift; weigert of hangt de bank, dan hoort het lid wat er werkelijk gebeurde -- een ander lid kan er niet bij, en een dubbele tik, een afgebroken verzoek of een crash boekt nooit dubbel.

**Huidige implementatie, statisch onderzocht:** Bank is de #bank-stand van geld.html. De proef omvat kantoor-livepoort, akkoord, rekening openen, storten, eigen overboekingen en afschrift; deze bron vormt geen bewijs van een operationele vergunninghoudende bankdienst.

**Bronnen:** [public/apps/geld.html](../../public/apps/geld.html), [scripts/lib/voltooi/bank.js](../../scripts/lib/voltooi/bank.js), [GELD.md](../../GELD.md), [server/kern/betaalwaarheid/bewijs.js](../../server/kern/betaalwaarheid/bewijs.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/geld.html` → `geld.overzicht` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een financieel scherm met ondubbelzinnige rechtspositie, saldoherkomst, rekeningstatus en herstelpad; werkelijke bankdiensten uitsluitend binnen aantoonbare provider- en juridische bevoegdheid.

**Benodigde wijzigingen:**

- Behoud de bestaande bankdomein- en Geld-eigenaar; voeg heldere uitleg over beschikbaar, gereserveerd, onderweg en onbekend toe vanuit de autoritatieve bron.
- Gebruik het Plan Dossier voor voorbereiding en gevolgen van een toegestane opdracht, met actuele herauthenticatie en providerbewijs vóór een succesclaim.
- Kwalificeer rekeningopening, betaling, storing en afschriftreconciliatie samen, inclusief verouderde of dubbele providerberichten.

**Specifieke acceptatie en te leveren bewijs:**

1. Kantoor-livepoort of benodigde providerbevoegdheid ontbreekt; het lid probeert de Bank-stand te gebruiken. → De operationele handeling blijft gesloten met de echte reden; het scherm presenteert geen fictieve rekening of gegarandeerd saldo. Bewijs: scripts/lib/voltooi/bank.js — Bestaande bankproef plus configuratie-, vergunningstatus- en providerpoort-contracttest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:bank:e069b0426713f9fe9315af71d9a31b3822d20618bccfdfb400e504c423e8707d`.
2. Een storting krijgt een time-out, daarna een bevestiging en vervolgens een herhaalde callback. → Het afschrift en saldo krijgen exact één bevestigde mutatie; tot bevestiging staat het resultaat onbekend of in behandeling. Bewijs: scripts/lib/voltooi/bank.js — Provider-sandbox-, idempotentie-, herstart- en grootboekreconciliatiebewijs; onafhankelijke financiële controle. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:bank:6276ac2cf3e172165467adcea67bdf13225d93648613bb72b1c8fb866a1ddef4`.

**Externe voorwaarden / besluiten:** Vergunninghoudende bank-/betaalpartner, juridische productnaam, KYC/AML-verantwoordelijkheid en live-providercontract moeten worden vastgesteld; krediet en beleggingsadvies blijven buiten deze scope.

### 12. Samen betalen - `link:wbw`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Ledger. **Budgetverwijzing:** transaction → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:geldcommand`, `link:pay`, `tab:salon`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/geld.html#wbw.

**Canonieke productbelofte:** twee Salon-vrienden houden een gedeeld lijstje bij: wie betaalde wat en wie staat er hoe voor, tot op de cent; wie rood staat verrekent in een tik via RTG Pay -- wie buiten het lijstje staat leest of raakt niets, en een dubbele tik, een afgebroken verzoek of een crash betaalt nooit twee keer.

**Huidige implementatie, statisch onderzocht:** Samen betalen is #wbw in Geld en gebruikt groep, uitgave en verreken. De proef rekent centnauwkeurig via RTG Pay; betaalverzoeken en de vriendenkiezer zijn nog geen onderdeel van haar bereik.

**Bronnen:** [public/apps/geld.html](../../public/apps/geld.html), [scripts/lib/voltooi/wbw.js](../../scripts/lib/voltooi/wbw.js), [GELD.md](../../GELD.md).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/geld.html` → `geld.overzicht` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een helder gezamenlijk kostenboek met uitlegbare verdeling, correcties en afzonderlijk bevestigde verrekening, zonder privéfinanciën van deelnemers zichtbaar te maken.

**Benodigde wijzigingen:**

- Behoud wbw als eigenaar van groepsverdeling en Pay als eigenaar van geld; toon schuld, voorstel en betaalbewijs apart.
- Verdiep verdelingen en correcties met transparante centafronding en herleidbare groepshistorie, binnen expliciete scopekeuze.
- Laat een reis- of dinerplan alleen de noodzakelijke groepsreferentie lezen; persoonlijke saldi blijven afgeschermd.

**Specifieke acceptatie en te leveren bewijs:**

1. Drie deelnemers verdelen een bedrag dat niet exact door drie deelbaar is en corrigeren één uitgave. → De som van de aandelen blijft exact gelijk aan de centenbron; correctie en nieuwe schuld zijn uitlegbaar zonder verborgen saldolek. Bewijs: scripts/lib/voltooi/wbw.js — Bestaande wbw-proef plus afrondings-, correctie- en groepsrechtenmatrix. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:wbw:32a5aea0bf36f40dbe22294701bca0bfa618c86c6a810c1f7602f9e44e518f5c`.
2. Een deelnemer bevestigt verrekening, verliest verbinding en probeert opnieuw. → Eén Pay-betaling en één bijgewerkte groepsstand; een onzekere betaling wordt eerst gereconcilieerd en niet blind opnieuw uitgevoerd. Bewijs: scripts/lib/voltooi/wbw.js — Idempotentie-, crash-, Pay-keten- en groepsreconciliatiebewijs. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:wbw:40cc4d87bd50943deabd6505237fc3a3c7191eef94a083b290d0c899d9c0bfbc`.

**Externe voorwaarden / besluiten:** Nieuwe valuta-/wisselkoersfuncties vragen expliciete scope en bron; geen impliciete krediet- of incassodienst.

### 13. Betaalcode - `link:rtgcode`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Ceremony. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:geldcommand`, `tab:betalen`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/geld.html#rtgcode.

**Canonieke productbelofte:** een lid toont een levende, ondertekende code die alleen de RTG-app maakt en leest en die na een halve minuut vervalt; een valse, gewone of verlopen code wordt geweigerd, een ander lid leest er niets van het lid uit, en de code overleeft een herstart en een crash -- en hij is persoonlijk, zoals het scherm belooft.

**Huidige implementatie, statisch onderzocht:** Betaalcode is #rtgcode in geld.html; /api/code/dyn en scan leveren een ondertekende persoonlijke code met korte geldigheid. De proef sluit camera, QR-decoder en de latere kassahandeling uit.

**Bronnen:** [public/apps/geld.html](../../public/apps/geld.html), [scripts/lib/voltooi/rtgcode.js](../../scripts/lib/voltooi/rtgcode.js), [GELD.md](../../GELD.md).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/geld.html` → `geld.overzicht` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een veilige betaal- of herkenningscode waarvan de gebruiker direct begrijpt wie hem mag lezen, waarvoor hij geldt en wanneer hij verlopen of verbruikt is.

**Benodigde wijzigingen:**

- Behoud de bestaande code- en Geld-eigenaar en toon doel, resterende geldigheid en veilige vervanging zonder codes of geheimen in logs te bewaren.
- Koppel scannen aan de concrete zaak en de vervolghandeling; een scan is geen betalingsbevestiging.
- Breid de proef uit met echte camera/decoder, klokafwijking, replay en gelijktijdige scanners.

**Specifieke acceptatie en te leveren bewijs:**

1. Een bevoegde kassa scant een geldige code, waarna dezelfde code op een tweede kassa wordt aangeboden. → De tweede poging kan geen tweede effect veroorzaken; het lid ziet welke handeling nog bevestiging nodig heeft. Bewijs: scripts/lib/voltooi/rtgcode.js — Bestaande dynamische-codeproef plus scanner-tot-kassa-ketentest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:rtgcode:1f8437eb28c2d608fe0e16a5103609528d4d096d878a4efe2f7e8ef08e1b5ecd`.
2. De camera is geweigerd of de code verloopt tijdens het scannen. → Geen identificatie- of betaalresultaat wordt verzonnen; er is een toegankelijke herstelstap en de verlopen code blijft ongeldig. Bewijs: scripts/lib/voltooi/rtgcode.js — Echte camera-/decoderproef met klokmatrix en permission-denied-browsertest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:rtgcode:ca1c320e79bb675a673159ed991108a50b5c0829fe540d98e984e56f68821bb6`.

**Externe voorwaarden / besluiten:** Geen aanvullend extern besluit benoemd; de bestaande toezegklasse en gemeenschappelijke scopepoort blijven gelden.

### 14. Balans - `link:balans`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Horizon. **Budgetverwijzing:** browse → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:geldcommand`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/geld.html#balans.

**Canonieke productbelofte:** een lid ziet zijn komende week uit zijn eigen agenda, met eerlijke adviezen over rust en avonden, zonder dat RTG er iets nieuws over hem vastlegt -- een ander lid ziet er niets van, en een dubbele tik, een afgebroken verzoek of een crash verandert het beeld niet.

**Huidige implementatie, statisch onderzocht:** Balans is een hashstand in geld.html, geen eigen geldmotor. De proef leest /api/balans uit de eigen agenda; eten, zorg, chatknoppen en toestelrecepten vallen buiten het gemelde proefbereik.

**Bronnen:** [public/apps/geld.html](../../public/apps/geld.html), [scripts/lib/voltooi/balans.js](../../scripts/lib/voltooi/balans.js), [GELD.md](../../GELD.md).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/geld.html` → `geld.overzicht` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een kalm weekbeeld dat beschikbare tijd, afspraken en eigen voorkeuren uitlegt zonder een levensscore, medische conclusie of tweede agenda te maken.

**Benodigde wijzigingen:**

- Behoud het gedeelde Geld-scherm en toon bij ieder weekadvies welke bestaande agenda-items en tijdzone zijn gebruikt.
- Maak het venster en uitzonderingen instelbaar, met een voorbeeld van het gevolg voordat de gebruiker een agenda-eigenaar opent.
- Breid bewijs uit naar lokale dagen, zomertijd en ontbrekende bronnen; onbekende tijd wordt niet als vrije tijd gepresenteerd.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid heeft afspraken rond lokale middernacht en een zomertijdwissel en opent Balans. → Ieder item staat op de lokale juiste dag; adviezen verwijzen naar dezelfde agenda en maken geen nieuwe afspraken. Bewijs: scripts/lib/voltooi/balans.js — Bestaande balansproef uitbreiden met tijdzonematrix en browservergelijking met agenda. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:balans:5568e2acc269543ee1f7e47e3aabef67430522b8e3ebbbaa212cf8a9507d3ed8`.
2. Een agendabron valt uit terwijl de vorige weekweergave nog beschikbaar is. → Het scherm vermeldt veroudering en onzekerheid; geen nieuw rustadvies wordt als actuele zekerheid getoond. Bewijs: scripts/lib/voltooi/balans.js — Bronuitval- en cacheproef; menselijke toets dat onzekerheid begrijpelijk blijft. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:balans:b9aaf9fe7fa55dbf1dda06991e742f0edf2376730e9cf404f022f2d00b5ec042`.

**Externe voorwaarden / besluiten:** Geen aanvullend extern besluit benoemd; de bestaande toezegklasse en gemeenschappelijke scopepoort blijven gelden.

### 15. Assets - `tab:assets`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Ledger. **Budgetverwijzing:** transaction → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:pay`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/app.html (stand assets).

**Canonieke productbelofte:** een betalend lid vraagt tickets aan, een mens van RTG op naam keurt, en pas een bevestigde betaling geeft precies de tickets; herroepen zegt alleen wat waar is.

**Huidige implementatie, statisch onderzocht:** De assets-tab gebruikt de bestaande asset-aanvraagketen; de proef bevat aanvragen, kantoorbesluit, betalen, mijn tickets en herroepen. Tickets mogen volgens de proef pas na bevestigde betaling ontstaan.

**Bronnen:** [public/apps/app.html](../../public/apps/app.html), [scripts/lib/voltooi/assets.js](../../scripts/lib/voltooi/assets.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/app.html` → `kern.app` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een transparant dossier voor de bestaande objecttickets, waarin aanvraag, beoordeling, financiële verplichting, verkregen recht en herroepingsmogelijkheid strikt onderscheiden blijven.

**Benodigde wijzigingen:**

- Maak de bestaande aanvraagstatussen begrijpelijk in één tijdlijn met gekoppelde documentversie en menselijke beslissing.
- Toon vóór betaling de prijs, het toe te kennen recht en de gevolgen van herroepen; voer betaling uit via bestaande betaalwaarheid.
- Breid de bewijsroute uit met vertraagde providerbevestiging en tegenstrijdige callback zonder een tweede ticketadministratie te introduceren.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid vraagt tickets aan, kantoor keurt goed en de betaling blijft tijdelijk onbekend. → Er ontstaan nog geen toegekende tickets; de tijdlijn toont aanvraag en betaalonzekerheid afzonderlijk. Bewijs: scripts/lib/voltooi/assets.js — Bestaande asset-voltooiproef plus asynchrone betaaladapter en browserstatuscontrole. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:tab:assets:79410da5c3beb01134935133265d9b2edc6259a282d810b48e8bae0581aa5c0a`.
2. Na bevestigde betaling valt de verbinding weg en wordt hetzelfde betaalverzoek opnieuw verstuurd. → Exact één betaling en één overeengekomen tickettoekenning; herroepen rapporteert alleen de werkelijk verwerkte toestand. Bewijs: scripts/lib/voltooi/assets.js — Idempotentie-, crash-, grootboek- en ticketreconciliatieproef met dezelfde sleutel. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:tab:assets:53a5b37f06f9f62859432f9eaa6ad6896536de988eb464c4723c79c91bf2da29`.

**Externe voorwaarden / besluiten:** Juridische aard van objecttickets, aanbiedingsvoorwaarden en mogelijke vergunningplicht expliciet valideren; geen nieuw beleggingsproduct of rendementbelofte uit dit plan.

### 16. Fonds - `link:labfonds`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Command. **Budgetverwijzing:** transaction → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:geldcommand`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/geld.html#labfonds.

**Canonieke productbelofte:** leden zeggen samen geld toe aan de pot van een plek, dienen een voorstel in en beslissen gezamenlijk met de scheidsrechter; alleen de indiener sluit de stemming, en een dubbele tik, een afgebroken verzoek of een crash legt een toezegging nooit twee keer in de pot.

**Huidige implementatie, statisch onderzocht:** Fonds is #labfonds binnen geld.html. De proef gebruikt overzicht, doneer, voorstel, stem en beslis en zegt expliciet dat bijdragen toezeggingen zijn en geen geld bewegen.

**Bronnen:** [public/apps/geld.html](../../public/apps/geld.html), [scripts/lib/voltooi/labfonds.js](../../scripts/lib/voltooi/labfonds.js), [GELD.md](../../GELD.md).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/geld.html` → `geld.overzicht` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een begrijpelijke gezamenlijke fondsadministratie met herleidbare toezeggingen, stemregels, besluiten en gevolgen, zonder administratie als uitgevoerde donatie te presenteren.

**Benodigde wijzigingen:**

- Maak toezegging, beschikbaar bedrag, besluit en eventuele latere betaling afzonderlijke feiten uit de bestaande bronnen.
- Toon bij ieder voorstel welke personen bevoegd zijn, welke stemregel geldt en welke uitkomst alleen advies van de scheidsrechter is.
- Laat een gekozen uitvoering naar de bevoegde bestaande betaal-/giftprocedure gaan, geblokkeerd zolang besluit of externe voorwaarde ontbreekt.

**Specifieke acceptatie en te leveren bewijs:**

1. Leden doen toezeggingen en stemmen over een voorstel; de indiener sluit de stemming. → Tellingen en besluit zijn reproduceerbaar; er ontstaat geen betaalboeking alleen door stemmen of sluiten. Bewijs: scripts/lib/voltooi/labfonds.js — Bestaande fondsproef plus besluitreconstructie en negatieve geldmutatietest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:labfonds:a08086cfa0453a5e824973f74d5b5d20cc5e1f203cefd8882150e4a050109106`.
2. Twee sluitverzoeken en een late stem vallen samen, waarna de server herstart. → Eén geldige besluitversie blijft bestaan met verklaarde behandeling van de late stem; bedragen en stemmen verdubbelen niet. Bewijs: scripts/lib/voltooi/labfonds.js — Concurrentie-, tijdgrens-, idempotentie- en herstartproef. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:labfonds:f226ba33d7d1ff4452b5d40a89d612a90acd0134274257745fb56d140588dcf2`.

**Externe voorwaarden / besluiten:** Werkelijke geldinzameling, uitbetaling en fiscale status vereisen afzonderlijk geld-/giftbesluit en eventuele vergunning/ANBI-onderbouwing.

### 17. Mecenaat - `link:mecenaat`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Ledger. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:geldcommand`, `link:geven`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/geld.html#mecenaat.

**Canonieke productbelofte:** een Lifestyle-lid houdt zijn filantropie bij: doel, bedrag, toegezegd of betaald, en het deel via de RTFoundation.

**Huidige implementatie, statisch onderzocht:** Mecenaat is #mecenaat in geld.html. Bestaande routes registreren doel, bedrag, gift en betaaldmarkering; de proef zegt dat betaald een eigen aantekening is en geen overboeking.

**Bronnen:** [public/apps/geld.html](../../public/apps/geld.html), [scripts/lib/voltooi/mecenaat.js](../../scripts/lib/voltooi/mecenaat.js), [GELD.md](../../GELD.md), [server/kern/rechterhand/mecenaat.js](../../server/kern/rechterhand/mecenaat.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/geld.html` → `geld.overzicht` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een betrouwbaar persoonlijk filantropiedossier dat toezegging, eigen betalingsnotitie en geverifieerd betaal-/ontvangstbewijs uit elkaar houdt en maatschappelijke resultaten niet verzint.

**Benodigde wijzigingen:**

- Maak de aard van elke giftregel zichtbaar: toegezegd, zelf gemarkeerd, of door een bevoegde bron onderbouwd.
- Laat Foundation-relaties en betaalbewijzen als doelgebonden referenties zien, zonder een nieuwe donatieadministratie te bouwen.
- Maak rapportage over gekozen doelen en eigen bijdragen exporteerbaar met bronstatus; fiscale conclusies volgen het bestaande zekerheidsbeleid.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid markeert een toezegging zelf als betaald. → Het overzicht zegt dat dit eigen registratie is en maakt geen betaaltransactie, ontvangersbevestiging of fiscale aftrekclaim. Bewijs: scripts/lib/voltooi/mecenaat.js — Bestaande Mecenaat-proef plus statuslabel- en negatieve grootboektest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:mecenaat:63d179aa40c9f954a9070bf8781c6ccc008f32afa5f6bad087bd9db8c5ba7d30`.
2. Een gekoppeld betaalbewijs wordt ongeldig of de giftregel wordt gecorrigeerd. → Afgeleide rapportage toont de gewijzigde bewijskracht; historie en verwijzingen blijven verklaarbaar na herladen. Bewijs: scripts/lib/voltooi/mecenaat.js — Bewijsintrekking-, correctie-, export- en herstartproef. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:mecenaat:5ffc7e35f46b785c000ebd8b89879cc60592fcf07e66e5ac7e6e715173235a7c`.

**Externe voorwaarden / besluiten:** Donatie-executie, ANBI-status, incassomachtiging en fiscale behandeling vragen de bestaande GIFT- en fiscale beslispoorten.

### 18. Nalatenschap - `link:nalatenschap`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Ceremony. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:geldcommand`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/geld.html#nalatenschap.

**Canonieke productbelofte:** een Lifestyle-lid legt zijn nalatenschap vast -- documenten, vertrouwenspersonen, wensen -- met de gevoelige velden versleuteld op schijf.

**Huidige implementatie, statisch onderzocht:** Nalatenschap is een Geld-hashstand voor documentenlocaties, contacten en wensen. De proef vindt gevoelige velden niet leesbaar in opslag, maar kwalificeert sleutelbeheer/cryptografie en toegang na overlijden uitdrukkelijk niet.

**Bronnen:** [public/apps/geld.html](../../public/apps/geld.html), [scripts/lib/voltooi/nalatenschap.js](../../scripts/lib/voltooi/nalatenschap.js), [GELD.md](../../GELD.md), [server/kern/rechterhand/nalatenschap.js](../../server/kern/rechterhand/nalatenschap.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/geld.html` → `geld.overzicht` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een zorgvuldig privé-dossier voor wensen en vindplaatsen, met sterke herstelbaarheid en begrijpelijke vertrouwensgrenzen; het is geen automatisch testament of onbevoegde overdracht aan erfgenamen.

**Benodigde wijzigingen:**

- Behoud bestaande versleutelde velden en kluisreferenties; maak bewaartermijn, export en herstelverantwoordelijkheid begrijpelijk.
- Voeg volledigheidscontrole voor eigen administratie en een contact-/documentoverzicht toe, zonder juridische geldigheid te suggereren.
- Ontwerp eventuele toegang na overlijden alleen als afzonderlijk besloten, menselijk geverifieerd proces met onafhankelijk threat model en intrekbaarheid.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid bewaart wensen en documentvindplaatsen, exporteert een eigen dossier en herstelt het na uitval. → Alleen het lid krijgt de ontsleutelde inhoud; export is expliciet bevestigd en herstel behoudt de juiste gegevens zonder plaintextlogs. Bewijs: scripts/lib/voltooi/nalatenschap.js — Bestaande nalatenschapproef plus sleutel-/backupherstel, exportautorisatie en onafhankelijke securityreview. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:nalatenschap:2b9ae2f0a1493d588e924af5df142bf0629e068c6e8c64c15da23a8b8eec108a`.
2. Een opgegeven vertrouwenspersoon probeert het dossier zonder een geldig vrijgavebesluit te openen. → Een contactregistratie verleent geen toegang; alle gevoelige velden blijven gesloten en de weigering lekt geen dossierinhoud. Bewijs: scripts/lib/voltooi/nalatenschap.js — Negatieve delegatie- en objectautorisatieproef; juridische toets van toegangsteksten. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:nalatenschap:a2747a7e6f37a535d5a08e3746b7ad3cbd196a5b3888d646b6e4a1e7b70dc3d4`.

**Externe voorwaarden / besluiten:** Vrijgave na overlijden, executeursbevoegdheid en testamentaire betekenis vereisen expliciet juridisch en architectuurbesluit; blijven gesloten tot dat bewijs bestaat.

### 19. Logboek - `link:logboek`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Library. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:geldcommand`, `link:rechterhand`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/geld.html#logboek.

**Canonieke productbelofte:** een Lifestyle-lid houdt het onderhoud van kostbaar bezit bij, en het overzicht seint wat binnenkort weer moet.

**Huidige implementatie, statisch onderzocht:** Logboek is een stand in geld.html en beheert objecten, onderhoudsregels, kosten en attenties. De proef zegt expliciet dat een regel een aantekening is, geen afspraak bij een werf of garage.

**Bronnen:** [public/apps/geld.html](../../public/apps/geld.html), [scripts/lib/voltooi/logboek.js](../../scripts/lib/voltooi/logboek.js), [GELD.md](../../GELD.md), [server/kern/rechterhand/logboek.js](../../server/kern/rechterhand/logboek.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/geld.html` → `geld.overzicht` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een onderhoudsdossier voor persoonlijk bezit met betrouwbare historie, documenten en toekomstige aandachtspunten, waarin een notitie nooit als uitgevoerde service geldt.

**Benodigde wijzigingen:**

- Hergebruik object- en regelreferenties voor een tijdlijn met documentbron, kostenherkomst, keurdatum en eigen correcties.
- Laat onderhoudsvoorbereiding naar bestaande agenda of concierge verwijzen met een duidelijk aanvraagstadium.
- Maak verwijderen en archiveren zorgvuldig: laat de gebruiker zien welke onderhoudsregels en gekoppelde verwijzingen geraakt worden.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid noteert een keuring met vervaldatum en koppelt een bestaand document. → Het dossier toont de herkomst en attentie; het document blijft in zijn kluis en er wordt geen werkplaatsafspraak geclaimd. Bewijs: scripts/lib/voltooi/logboek.js — Bestaande logboekproef plus documentrecht- en datumketen. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:logboek:3485897e428a7d194dc9482a30f042a30868398abba81960c9e12b81253e1d63`.
2. Een object met regels wordt verwijderd terwijl een onderhoudsconcept openstaat. → Het scherm beschrijft de gevolgen, voorkomt verweesde regels en laat een stale concept niet alsnog als geldige opdracht uitvoeren. Bewijs: scripts/lib/voltooi/logboek.js — Verwijder-, referentie-, herstart- en conceptvalidatietest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:logboek:0acb317faf248037c4fdc517e7efc8e5daf7471fc01dd1835ba90fadbd3ac94f`.

**Externe voorwaarden / besluiten:** Certificering en daadwerkelijk uitgevoerd onderhoud vereisen bewijs van de bevoegde uitvoerder; eigen invoer blijft als zodanig gelabeld.

### 20. Salon - `tab:salon`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Salon. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:wereldlaag`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/app.html (stand salon).

**Canonieke productbelofte:** een lid ziet de posts van De Salon, waardeert ze en reageert onder zijn codenaam, en een post voor vrienden ziet alleen een vriend.

**Huidige implementatie, statisch onderzocht:** De Salon-tab in app.html gebruikt state, like en comment met Salon-publicatie. De proef toetst besloten posts, codenamen en pasrechten; volgen, polls en partneraanbiedingen vallen buiten bereik.

**Bronnen:** [public/apps/app.html](../../public/apps/app.html), [scripts/lib/voltooi/salon.js](../../scripts/lib/voltooi/salon.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/app.html` → `kern.app` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een besloten sociale huiskamer met begrijpelijke kringen, eindige inhoud en consequente moderatie, waar delen en verwijderen op alle ingangen dezelfde betekenis hebben.

**Benodigde wijzigingen:**

- Verbind tab en wereldweergave aan dezelfde Salon-eigenaar en rechten; voorkom opnieuw opgebouwde feeds of berichtenopslag.
- Verdiep publicatie, reageren en eventuele bestaande polls/partnerscenario's met zichtbaarheid vooraf en inhoudelijke meldafhandeling.
- Kwalificeer de volledige gebruikerslus en toegankelijkheid van tab naar detail, inclusief onbekende/lege kring en ingetrokken inhoud.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid reageert op een vriendenpost vanuit de Salon-tab en opent later dezelfde post via de wereldweergave. → Reactie, teller en rechten zijn consistent; een niet-vriend kan de inhoud op geen ingang lezen. Bewijs: scripts/lib/voltooi/salon.js — Bestaande salonproef plus ingangsoverstijgende publicatie-/rechtenketen. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:tab:salon:d327b879a1b3a1c8439e6d55b313de90826f4713c170a01b33fbe592f85099ea`.
2. De maker wijzigt de kring of verwijdert een post tijdens een offline leesbeurt. → Na hercontrole is ingetrokken inhoud niet opnieuw opvraagbaar; reageren op een verdwenen post wordt begrijpelijk geweigerd zonder dubbele reactie. Bewijs: scripts/lib/voltooi/salon.js — Kringwijziging-, cache-, idempotentie- en browserherstelproef. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:tab:salon:a89dd4c6e5559e88063375271e6ac748de07c92711b3db223573dcd622f847cf`.

**Externe voorwaarden / besluiten:** Moderatiecapaciteit en partnerpublicatieregels moeten de sociale productbelofte dragen; P0 sluit de overlap met Pulse.

### 21. Alles bij elkaar - `link:wereldlaag`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Salon. **Budgetverwijzing:** browse → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `tab:salon`, `link:sociaal`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/wereld.html.

**Canonieke productbelofte:** een lid plaatst een post in De Salon, een verbonden lid reageert, de maker ziet het en haalt de post weg -- en dan is hij voor iedereen weg.

**Huidige implementatie, statisch onderzocht:** wereld.html laadt de Salon-schil; de voltooiproef gebruikt /api/salon/plaats, feed, reacties en weg. De gedocumenteerde proefbelofte is publiceren, reageren en verwijderen; dit is geen actuele browserkwalificatie van alle wereldprojecties.

**Bronnen:** [public/apps/wereld.html](../../public/apps/wereld.html), [scripts/lib/voltooi/wereldlaag.js](../../scripts/lib/voltooi/wereldlaag.js), [public/apps/saloon/saloon.js](../../public/apps/saloon/saloon.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/wereld.html` → `sociaal.alles` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een rustige ingang naar het leven tussen mensen, met herkenbare bron, kring en volgende stap; iedere Salonhandeling blijft bij de canonieke Salon-eigenaar.

**Benodigde wijzigingen:**

- Maak contextkaarten voor bestaande Salon-objecten met herkomst, doelgroep en uitleg waarom ze zichtbaar zijn; laat openen teruggaan naar de canonieke eigenaar.
- Verbind een expliciet gekozen gezamenlijke activiteit als referenties aan een Plan Dossier; deelname of uitnodiging vraagt bevestiging en verandert geen relatie automatisch.
- Toets de scheiding met Pulse en Sociaal via SCHERMEIGENAAR voordat gedeelde bediening wordt aangepast.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid publiceert voor een besloten kring; een verbonden lid opent de post via de wereldkaart en reageert. → Beide ingangen tonen dezelfde post en reactie met dezelfde zichtrechten; een buitenstaander ontvangt geen inhoud of teller. Bewijs: scripts/lib/voltooi/wereldlaag.js — Voltooiproef uitbreiden met wereldkaart-tot-Salon-browserketen en negatieve kringtest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:wereldlaag:c6c4598fefe875517eed1a99e073126f6c51b11b5ba5bc5f2862fd3edd91b5d5`.
2. De maker verwijdert de post terwijl een ander de wereldkaart open heeft, waarna die ander herlaadt. → Post en bewaarde projectie verdwijnen of tonen een ingetrokken bron; oude links leveren geen postinhoud. Bewijs: scripts/lib/voltooi/wereldlaag.js — Verwijder-, herlaad- en cache-intrekkingstest; menselijke controle van lege en ingetrokken toestand. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:wereldlaag:8b9ae539a799a96f3c2cbeab717be1c5c81cac3c10d565705518134f8c0feeb2`.

**Externe voorwaarden / besluiten:** P0 sluit het bestaande eigenaarschapsvraagstuk rond Salon, Pulse en wereldprojecties; geen automatische samenvoeging van domeinen.

### 22. Pulse - `link:pulse`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Salon. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `tab:salon`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/pulse.html.

**Canonieke productbelofte:** een lid schrijft een kort bericht, een ander lid vindt het, waardeert het, reageert en bewaart het; wie het schreef haalt het weg en dan is het voor iedereen weg.

**Huidige implementatie, statisch onderzocht:** Pulse heeft feed, post, like, reactie, bewaren en dagstemming. De proef sluit volgen, melden, versiehistorie en tekstkeuring uit; de opgeslagen browserronde bevat een onvolledige bediening, geen actuele kandidaatmeting.

**Bronnen:** [public/apps/pulse.html](../../public/apps/pulse.html), [scripts/lib/voltooi/pulse.js](../../scripts/lib/voltooi/pulse.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/pulse.html` → `sociaal.pulse` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een eindige, veilige stroom korte berichten met een eigen herkenbaar ritme en gedeelde sociale rechten, zonder een dubbele sociale kern of verslavende engagementmechaniek.

**Benodigde wijzigingen:**

- Sluit eerst het eigenaarschapsbesluit Pulse/Salon en maak hergebruik van rechten, rapportage en publicatie expliciet.
- Verdiep schrijven, bewerken, reageren, bewaren en melden met toegankelijke focus, begrip van zichtbaarheid en volledige verwijderlus.
- Onderzoek de bekende overlay-interceptie op de actuele kandidaat en herstel zo nodig de gedeelde oorzaak in de werkruimteschil.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid schrijft, bewerkt en meldt een korte post via toetsenbord en mobiel. → Iedere bedoelde bediening is bereikbaar; zichtbaarheid, versies en moderatiestatus volgen de vastgestelde eigenaar zonder dubbele publicatie. Bewijs: scripts/lib/voltooi/pulse.js — Bestaande Pulse-proef plus browserbediening, versie- en moderatieketen; reproduceer overlaybevinding afzonderlijk. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:pulse:4400e0f23e779db98db7cab500c75262fcac98dd296b6aa66e3fadaa9a603947`.
2. De maker verwijdert een post terwijl deze in een bewaarde lijst en offline projectie staat. → De inhoud kan na rechten-/versiehercontrole niet terugkeren; een lege lijst krijgt een begrijpelijke volgende stap. Bewijs: scripts/lib/voltooi/pulse.js — Verwijder-, cache-, bewaar- en herstelproef; menselijke eindigheidstoets van de feed. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:pulse:371f950f5b43712205cb424fe85bc6d1ea3834b92fce95d52a6ec76c4391ca58`.

**Externe voorwaarden / besluiten:** P0 moet de bestaande overlap met Salon oplossen; moderatie en meldafhandeling vragen een operationele eigenaar.

### 23. Snaps - `os:snaps`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Salon. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `tab:salon`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** kiezer in de app.

**Canonieke productbelofte:** een lid stuurt een vriend een snap, de vriend ziet hem een keer en daarna is de foto weg, ook uit de opslag.

**Huidige implementatie, statisch onderzocht:** Snaps gebruikt send, lijst en view; de proef controleert eenmalig openen en verwijdering uit opslag, plus vriendschap/blokkades. Browserverkleining, verhalen en dagopdracht worden niet gelopen.

**Bronnen:** [public/apps/app.html](../../public/apps/app.html), [scripts/lib/voltooi/snaps.js](../../scripts/lib/voltooi/snaps.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/app.html` → `kern.app` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een bewust vluchtige manier om een foto met een bekende te delen, met eerlijke privacytaal, duidelijke ontvanger en aantoonbare serververwijdering na openen of verval.

**Benodigde wijzigingen:**

- Maak vóór versturen ontvanger, eenmaligheid, bewaartermijn en de beperking tegen screenshots helder.
- Kwalificeer lokale beeldverwerking en expliciete verzendbevestiging, zonder beelden in telemetry of foutlogs te bewaren.
- Verbind blokkeren, TTL en opslagopschoning aan bestaande snaprechten; laat een vernietigde snap nooit terugkomen uit herstelkopieën als actief item.

**Specifieke acceptatie en te leveren bewijs:**

1. Een vriend opent een snap gelijktijdig op twee toestellen. → De toegestane eenmalige weergave wordt volgens één eenduidig contract afgehandeld; de bron wordt niet opnieuw beschikbaar als gewone bijlage. Bewijs: scripts/lib/voltooi/snaps.js — Bestaande snapproef plus gelijktijdige open-, byteverwijder- en browsercachetest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:os:snaps:b72ac1bd641cadc2db65428c0f52c964ae2750315a39ad1b68c8ea5181dbfeaa`.
2. De verbinding breekt tijdens openen en het account wordt daarna geblokkeerd. → Hervatten maakt geen vernietigde inhoud opnieuw leesbaar; de gebruiker krijgt een eerlijke verlopen/gelezen-status en geen hernieuwde verzending. Bewijs: scripts/lib/voltooi/snaps.js — Afgebroken-open-, blokkade-, retentie- en herstelkopiebeleidtest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:os:snaps:4845c7a6f6d47c2f9a28e7f18f7fe8cee4da81a3794353d0b36dadc96a1c0f1f`.

**Externe voorwaarden / besluiten:** De privacybelofte moet uitsluiten dat RTG screenshots of kopieën op een ontvangend toestel kan garanderen te voorkomen.

### 24. Camera - `link:camera`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Atelier. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** geen aanvullende taakafhankelijkheid benoemd. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/camera.html.

**Canonieke productbelofte:** een lid maakt op zijn eigen toestel een foto zonder dat beeld naar RTG te sturen en gebruikt Rahul uitsluitend binnen zijn eigen ledensessie.

**Huidige implementatie, statisch onderzocht:** camera.html heeft een browserproef met lokale JPEG-export, volledige resolutie, geen muterende netwerkverzending en begrijpelijke cameratoestemmingsweigering. De opgeslagen APPWERKT-belofte is niet automatisch gelijk aan de huidige proeftekst.

**Bronnen:** [public/apps/camera.html](../../public/apps/camera.html), [scripts/lib/voltooi/camera.js](../../scripts/lib/voltooi/camera.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/camera.html` → `media.camera` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een snelle lokale camera en capturewerkplek die originele kwaliteit bewaart, privacy zichtbaar maakt en delen pas laat plaatsvinden via een afzonderlijk bevestigde bestemming.

**Benodigde wijzigingen:**

- Behoud lokale verwerking en geef een voorspelbare capture-, bekijken-, opnieuw maken- en exportlus met bestandsnaam en resolutie.
- Voeg toegankelijke bediening en toestandherstel toe bij rotatie, camerawissel of onderbreking zonder beelden naar de server te sturen.
- Laat een eventuele overdracht naar documenten of berichten via bestaande upload-/deelcontracten verlopen met expliciete keuze en gegevensuitleg.

**Specifieke acceptatie en te leveren bewijs:**

1. Een gebruiker maakt lokaal een foto, exporteert hem en opent het bestand na serveruitval. → Het bestand bevat de oorspronkelijke bedoelde pixelmaat en geldige beeldbytes; er is geen onverwacht uploadverzoek. Bewijs: scripts/lib/voltooi/camera.js — Bestaande camera-browserproef met bytecontrole en netwerkobservatie op de kandidaat. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:camera:89351486959c730f0f985d3c8aa66f712ef5e292c93c0973ebfb9acb372f743d`.
2. Cameratoegang is geweigerd of wordt tijdens gebruik ingetrokken. → Sluiter en status blijven eerlijk; de gebruiker kan toestemming herstellen of veilig stoppen en alle cameratracks worden vrijgegeven. Bewijs: scripts/lib/voltooi/camera.js — Permission-, track-cleanup-, mobiel-rotatie- en toetsenbordtest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:camera:6742ce8c37ed03db6d0f0065986870c7f5302f807a4fc41f1727a5a026352bf9`.

**Externe voorwaarden / besluiten:** Geen aanvullend extern besluit benoemd; de bestaande toezegklasse en gemeenschappelijke scopepoort blijven gelden.

### 25. Berichten - `link:berichten`

**Bouwcohort:** eerste twaalf, poort G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Salon. **Budgetverwijzing:** realtime → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:relaties`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/comm.html.

**Canonieke productbelofte:** een lid begint een gesprek met iemand die het kent, stuurt, antwoordt, wijzigt en trekt in, en de ander ziet precies dat; wie niet in het gesprek zit leest en schrijft niets.

**Huidige implementatie, statisch onderzocht:** comm.html heeft een eigen berichtketen met begin, stuur, inbox, gesprek, lees, reactie, wijzig en wis. De proef onderzoekt bekende contacten, deelnemersrechten en herstart/dubbeltik/crash.

**Bronnen:** [public/apps/comm.html](../../public/apps/comm.html), [scripts/lib/voltooi/berichten.js](../../scripts/lib/voltooi/berichten.js), [server/kern/comm/bericht.js](../../server/kern/comm/bericht.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/comm.html` → `comm.berichten` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Eén rustige communicatieomgeving met duidelijke concept-, verzend-, ontvangst- en leesstatus, betrouwbare bijlagen en overdracht naar een taak zonder een tweede berichtenbron.

**Benodigde wijzigingen:**

- Maak lange gesprekken, zoeken en relevante taakverwijzingen toegankelijk vanuit de bestaande comm-eigenaar, met een leesbare scheiding tussen eigen notities en gedeelde berichten.
- Voeg versiegebonden conceptcontinuïteit toe; een Rahul-voorstel wordt pas na zichtbare gebruikersbevestiging verzonden.
- Breid de bestaande berichtlus uit met bijlage-, intrekkings-, blokkade- en multi-device-races; definieer wat intrekken na lezen werkelijk betekent.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid bewerkt op twee toestellen een concept, kiest een ontvanger en verzendt eenmaal. → De gebruiker ziet een conflict in plaats van stille overschrijving; exact één bericht bereikt alleen de gekozen deelnemers. Bewijs: scripts/lib/voltooi/berichten.js — Bestaande berichtenproef plus tweetoestel-concept- en verzendketen met browsertrace. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:berichten:397b400b28f86a855292ce6622fdfa9f57709cd8a27f9ad3af518997dfea780c`.
2. Een bericht wordt gewijzigd of ingetrokken terwijl de ontvanger offline is en later terugkomt. → De ontvanger ziet de actuele toegestane versie en een eerlijke wijzigings-/intrekkingsstatus; cache en zoekresultaat lekken de ingetrokken inhoud niet. Bewijs: scripts/lib/voltooi/berichten.js — Versie-, offline-, cache- en objectautorisatieproef; menselijke begripstest van statuswoorden. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:berichten:162958db17a984607b2d3febfb20b478b95c29ad1477b07bfd653f50122241af`.

**Externe voorwaarden / besluiten:** Een sterkere encryptie- of gegarandeerde verwijderbelofte vereist apart threat model en aantoonbare infrastructuur; dit plan claimt die eigenschappen niet.

### 26. Bellen - `os:bellen`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Salon. **Budgetverwijzing:** realtime → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:relaties`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** kiezer in de app.

**Canonieke productbelofte:** een lid belt een verbonden lid met spraak: het gaat over, opnemen, ophangen en weigeren komen aan, niemand anders hoort iets, en van het gesprek wordt niets bewaard.

**Huidige implementatie, statisch onderzocht:** Bellen gebruikt /api/member/call met de live-stroom. De proef controleert signalering, verbonden contacten en blokkades, maar benoemt geluid, echte toestellen en TURN als buiten bereik.

**Bronnen:** [public/apps/app.html](../../public/apps/app.html), [scripts/lib/voltooi/bellen.js](../../scripts/lib/voltooi/bellen.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/app.html` → `kern.app` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een eenvoudige betrouwbare spraakoproep met expliciete toestemming, begrijpelijke bereikbaarheidsstatus en aantoonbare beëindiging zonder opname of verborgen gespreksarchief.

**Benodigde wijzigingen:**

- Hergebruik bestaande oproepsignalering en contactrechten voor een uniforme belkaart met bellen, opnemen, weigeren en beëindigen.
- Maak netwerk- en microfoonproblemen afzonderlijk herstelbaar, zonder een gestopte oproep automatisch opnieuw te starten.
- Breid bewijs uit naar werkelijke audiopaden, toestelwissel en ongunstige netwerken; log alleen noodzakelijke technische metadata met retentiegrens.

**Specifieke acceptatie en te leveren bewijs:**

1. Twee verbonden leden bellen, nemen op en beëindigen de oproep op verschillende browsers. → Audio gaat beide kanten op; microfoongebruik stopt na ophangen en een derde ontvangt geen signalen. Bewijs: scripts/lib/voltooi/bellen.js — Bestaande signaleringsproef plus tweebrowser-mediaproef en echte toestel-/audioacceptatie. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:os:bellen:5e750bdbc9857702c408fb46aa46142221681ce9027e0e2d327de9e499a4f020`.
2. Een contact wordt geblokkeerd terwijl een oproep wordt voorbereid en de verbinding valt weg. → De oproep kan niet alsnog tot stand komen; herladen herstelt geen oude oproep en de interface biedt een veilige nieuwe start. Bewijs: scripts/lib/voltooi/bellen.js — Blokkade-race-, netwerkuitval- en resource-opruimingstest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:os:bellen:1a1ce158935270ba77e91800a8594cb93ebeaae73b4ac1e56df82f9ae4c712ad`.

**Externe voorwaarden / besluiten:** Productie-TURN, netwerkbereik, dataverwerking en operationele beschikbaarheid moeten zijn geregeld; geen noodtelefoniebelofte.

### 27. Videobellen - `os:videobellen`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Salon. **Budgetverwijzing:** realtime → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:relaties`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** kiezer in de app.

**Canonieke productbelofte:** een lid opent videobellen, kiest een verbonden contact en start uitsluitend met expliciete camera- en microfoontoestemming.

**Huidige implementatie, statisch onderzocht:** De huidige videobelproef gebruikt twee Chromium-toestellen met synthetische camera/microfoon, loopback-ICE en echte gedecodeerde media. Echte apparaten, streng netwerk/TURN en peercrashes vallen buiten het expliciete bereik.

**Bronnen:** [public/apps/app.html](../../public/apps/app.html), [scripts/lib/voltooi/videobellen.js](../../scripts/lib/voltooi/videobellen.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/app.html` → `kern.app` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een voorspelbaar videogesprek met expliciete camera-/microfoonkeuze, veilige deelnemersrechten en aantoonbaar opruimen na stoppen, met eerlijke netwerkondersteuning.

**Benodigde wijzigingen:**

- Hergebruik de bestaande oproep, peer en contactrechten; laat camera, microfoon en verbinding apart bedienbaar en begrijpelijk zijn.
- Maak onderbreken, toestemming intrekken, apparaat wisselen en gesprek beëindigen voorspelbaar zonder een afgesloten sessie te herstellen.
- Breid kwalificatie uit naar echte toestel-/browsercombinaties, TURN, verliesnetwerk en toegankelijkheid van de belkaart.

**Specifieke acceptatie en te leveren bewijs:**

1. Twee verbonden leden videobellen op verschillende echte toestellen en wisselen één camera. → Voortlopende beelden en audio komen aantoonbaar aan; wisselen vraagt geen nieuwe ongeautoriseerde deelnemer of ongewenste opname. Bewijs: scripts/lib/voltooi/videobellen.js — Bestaande videobelbrowserproef plus echte apparaat-/browsermatrix en hoorbare audioacceptatie. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:os:videobellen:881763ef3daa07db82ff254b9629817de64b57e3cbe02f71f22ac0862a8ce1ad`.
2. Een deelnemer trekt microfoontoestemming in, sluit de tab en heropent de app. → Alle tracks en peerresources stoppen; de oude oproep herleeft niet en een nieuwe oproep vraagt een bewuste start. Bewijs: scripts/lib/voltooi/videobellen.js — Permission-, peercrash-, resourcecleanup-, TURN- en herlaadproef. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:os:videobellen:cfb6251244061b2c1ca8ea171f90b59bfeab9d1dbc8b67550fd263b376201acd`.

**Externe voorwaarden / besluiten:** Productie-TURN en netwerkservice met privacy-/retentieafspraken zijn extern te regelen; geen medische consult- of noodhulpclaim uit deze functie.

### 28. Daten - `link:vonk`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Salon. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:verificatie`, `link:foodcourt`, `link:pay`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/vonk.html.

**Canonieke productbelofte:** een gekeurd volwassen lid krijgt een eindige selectie van wederzijds passende mensen, en pas bij wederzijdse interesse een chat en een tafel die beiden vooraf betalen en de zaak bevestigt.

**Huidige implementatie, statisch onderzocht:** De Vonk-proef bevat volwassenheidskeuring, eindige selectie, wederzijdse interesse, chat, beide betalingen, zaakbevestiging, blokkeren en melden; de poort gebruikt de bestaande verificatieketen.

**Bronnen:** [public/apps/vonk.html](../../public/apps/vonk.html), [scripts/lib/voltooi/vonk.js](../../scripts/lib/voltooi/vonk.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/vonk.html` → `daten.vonk` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een veilige, volwassen ontmoetingsdienst met vrijwillige keuzes, eindige selecties, wederzijdse toestemming en duidelijke tafel- en betaalstatus zonder engagementdruk.

**Benodigde wijzigingen:**

- Verbind match, gesprek en tafel als geautoriseerde verwijzingen met controle over wat iedere partij deelt; behoud leeftijds- en paspoortpoorten.
- Ontwerp een heldere gezamenlijke besliskaart voor datum, bijdrage, annulering en wat er gebeurt als één partij niet doorgaat.
- Maak blokkeren en melden onmiddellijk leidend over aanbevelingen, chat en reserveringsvoorstellen; voorkom zichtbaarheid van gevoelige profielkenmerken buiten het doel.

**Specifieke acceptatie en te leveren bewijs:**

1. Eén persoon toont interesse, de ander nog niet; daarna stemmen beiden in met een tafel. → Er ontstaat pas een gedeelde ruimte na wederzijdse toestemming; tafelbevestiging verschijnt pas na de vereiste betalingen en zaakbeslissing. Bewijs: scripts/lib/voltooi/vonk.js — Bestaande Vonk-proef plus tweepersoons-browserketen en providerstatusasserties. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:vonk:e038d1368c26d03bec44fda2eed8c26c627e4e4351017190446c630d3443ab98`.
2. Eén deelnemer blokkeert de ander tijdens een open tafelvoorstel. → Nieuwe communicatie stopt direct; financiële/verblijvende verplichtingen krijgen een afgeschermd herstelpad zonder profielinformatie te lekken. Bewijs: scripts/lib/voltooi/vonk.js — Blokkade-race-, privacy-, annulerings- en moderatoracceptatieproef. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:vonk:d31be4259ea081c22272c73b9e305e8ca818dd40b77b96e765137a830a61352b`.

**Externe voorwaarden / besluiten:** Menselijk moderatieproces, incidentrespons en voorwaarden voor annulering/terugbetaling moeten operationeel zijn; matching mag geen beschermde kenmerken ongeoorloofd profileren.

### 29. Cercle - `link:cercle`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Ceremony. **Budgetverwijzing:** transaction → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:reisboek`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/cercle.html.

**Canonieke productbelofte:** een Lifestyle-lid houdt zijn clubs bij, vraagt waar hij in een stad terecht kan, en zijn gastpassen lopen met een boekhouding terug.

**Huidige implementatie, statisch onderzocht:** Cercle heeft routes voor clubs, gastpassen en waarheen; de proef behandelt eigen lidmaatschappen en een boekhouding van uitgegeven/teruggenomen gastpassen.

**Bronnen:** [public/apps/cercle.html](../../public/apps/cercle.html), [scripts/lib/voltooi/cercle.js](../../scripts/lib/voltooi/cercle.js), [server/kern/rechterhand/cercle.js](../../server/kern/rechterhand/cercle.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/cercle.html` → `leven.cercle` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een discreet lidmaatschaps- en toegangsboek waarin bestaande rechten, resterende gastmogelijkheden en aanvraagstatus duidelijk zijn zonder toegang tot externe clubs te beloven.

**Benodigde wijzigingen:**

- Maak per club de herkomst, geldigheid en voorwaarden van eigen geregistreerde rechten zichtbaar.
- Verbind een bezoekwens aan een voorbereide aanvraag met reis-/agendareferentie; alleen een bevoegde club bevestigt externe toegang.
- Hergebruik de gastpassenboekhouding voor intrekken, verval en concurrent gebruik met een begrijpelijk auditspoor.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid plant een bezoek met één resterende gastpas en doet tweemaal dezelfde aanvraag. → De administratieve gastpas wordt hoogstens eenmaal gebruikt; externe toegang blijft aangevraagd totdat de bevoegde bron bevestigt. Bewijs: scripts/lib/voltooi/cercle.js — Bestaande Cercle-proef plus aanvraag-/providerstatus- en idempotentietest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:cercle:49b54ed49f4c6dfe711e2c4035e364d9963783c17c317aa8deea7584571a1477`.
2. Een clubrecht verloopt nadat een bezoekconcept is opgeslagen. → Hervatten toont het vervallen recht en blokkeert gebruik tot nieuwe verificatie; de afspraak wordt niet stilzwijgend bevestigd. Bewijs: scripts/lib/voltooi/cercle.js — Klok-, hervat- en autorisatie-op-uitvoertijdtest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:cercle:85cb106fe21e80cf7e4509c61d37b3616b039ae05452f0286964cfc581be456d`.

**Externe voorwaarden / besluiten:** Clubovereenkomsten en toegangsbewijs van de club zijn vereist voor daadwerkelijke toelating; geregistreerd lidmaatschap is geen partnerclaim.

### 30. Entourage - `link:entourage`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Journey. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:reisboek`, `link:relaties`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/entourage.html.

**Canonieke productbelofte:** een Lifestyle-lid houdt zijn reisgezelschap bij: documenten met vervaldatum, en bij het samenstellen ziet hij wat ontbreekt.

**Huidige implementatie, statisch onderzocht:** Entourage beheert eigen personen, documentmetadata en gezelschappen; de proef ordent verlopen documenten en toont wat bij een samengesteld gezelschap ontbreekt.

**Bronnen:** [public/apps/entourage.html](../../public/apps/entourage.html), [scripts/lib/voltooi/entourage.js](../../scripts/lib/voltooi/entourage.js), [server/kern/rechterhand/entourage.js](../../server/kern/rechterhand/entourage.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/entourage.html` → `leven.entourage` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een zorgvuldig reisgezelschapsdossier dat de organisator alleen toegestane, noodzakelijke documentstatus toont en iedere reiziger controle over delen en intrekken houdt.

**Benodigde wijzigingen:**

- Koppel documenten via bestaande kluisreferenties en deelrechten in plaats van kopieën of echte identiteitsnummers naast operationele codenamen.
- Maak reisafhankelijke volledigheid zichtbaar met herkomst en actualiteit; onbekende vereisten blijven onbekend.
- Laat wijzigen of intrekken gevolgen voor voorbereide reisstappen tonen zonder reisboekingen zelfstandig te wijzigen.

**Specifieke acceptatie en te leveren bewijs:**

1. Een organisator voegt reizigers toe en één document vervalt vóór de geplande reisdatum. → Het dossier verklaart het ontbrekende of verlopen stuk per toegestane reiziger; het toont geen reisgeschiktheid als feit zonder geldige bron. Bewijs: scripts/lib/voltooi/entourage.js — Bestaande Entourage-proef plus reisdatum-, kluisrecht- en volledigheidstest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:entourage:45ac3f0553c36139d125183484306d022998bd569ae4e88205ac98db770aea71`.
2. Een reiziger trekt het delen van een document in terwijl een plan openstaat. → Documentinhoud en afgeleide gevoeligheden verdwijnen uit de organisatorprojectie; afhankelijke stappen vragen nieuwe toestemming. Bewijs: scripts/lib/voltooi/entourage.js — Intrekkings-, cache- en Plan-Dossier-contexttest; privacyreview voor minderjarige reizigers. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:entourage:4eadf73bffdd82719d0dc656006d014f724819c0f467941e5a55fe2f7e519e33`.

**Externe voorwaarden / besluiten:** Actuele reisdocument-/visumregels en ouderlijke bevoegdheid vragen aangewezen bron en verantwoordelijke controle; dit plan verleent geen grens- of visumgarantie.

### 31. Rendez-vous - `link:rendezvous`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Salon. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:relaties`, `link:verificatie`, `link:rechterhand`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/rendezvous.html.

**Canonieke productbelofte:** Signature-leden met een geverifieerd paspoort zien elkaar op codenaam, een match ontstaat alleen wederzijds en alleen de twee zien hem, en een blokkade werkt in beide richtingen.

**Huidige implementatie, statisch onderzocht:** Rendez-vous heeft profiel, kandidaten, like, overslaan, matches en blokkeren. De proef vereist Signature-pas en geverifieerd paspoort; tafels, introducties, concierge, foto's en berichten worden in deze proef niet doorlopen.

**Bronnen:** [public/apps/rendezvous.html](../../public/apps/rendezvous.html), [scripts/lib/voltooi/rendezvous.js](../../scripts/lib/voltooi/rendezvous.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/rendezvous.html` → `sociaal.ontmoeten` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een discrete introductieomgeving voor de bedoelde doelgroep met wederzijdse keuze, minimale profielzichtbaarheid en gecontroleerde begeleiding zonder relatie- of statusladder.

**Benodigde wijzigingen:**

- Maak profielzichtbaarheid en vrijwillige introductie begrijpelijk vanuit de bestaande wederzijdse relatie- en toestemmingsregels.
- Kwalificeer de nog apart te meten foto-, bericht- en conciergeoverdracht op dezelfde matchrechten; geen automatische sociale escalatie.
- Laat blokkeren, verlaten en meldingen consequent gelden voor alle matchprojecties, ook in Plan Dossiers.

**Specifieke acceptatie en te leveren bewijs:**

1. Twee gerechtigde leden kiezen elkaar, terwijl een derde de match-id kent. → Alleen de twee deelnemers zien de gedeelde match; eenzijdige interesse, privévoorkeuren en documenten blijven afgeschermd. Bewijs: scripts/lib/voltooi/rendezvous.js — Bestaande Rendez-vous-proef plus profiel-/foto-/berichtautorisatiematrix. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:rendezvous:df131bf6ecb4500e05c22efe4053aec7c2a1d8bbe5b56ba98b46e1b5b72503d5`.
2. Eén deelnemer blokkeert de ander voordat een concierge-introductie wordt bevestigd. → De introductie wordt niet verstuurd op oude toestemming; beide kanten verliezen de afgesproken toegang zonder onnodige persoonsgegevens te behouden. Bewijs: scripts/lib/voltooi/rendezvous.js — Blokkade-, stale-plan-, verwijder- en privacyacceptatieproef. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:rendezvous:dfe28ba0f3bf1bf24e5a6fcc1f1b3f1f7b4979f5ef33157b7133e41e21d2c0c3`.

**Externe voorwaarden / besluiten:** P0 moet Signature als bestaande toegangsterm koppelen aan de actuele pas-/toelatingsregels; geen nieuwe vierde commerciële pas zonder besluit. Moderatie en menselijke introductiedienst moeten operationeel zijn.

### 32. Attenties - `link:attenties`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Salon. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:commerce`, `link:rechterhand`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/attenties.html.

**Canonieke productbelofte:** een Lifestyle-lid onderhoudt zijn relaties: wie binnen dertig dagen een attentie verdient, met de giftgeschiedenis.

**Huidige implementatie, statisch onderzocht:** De bestaande Lifestyle-routes beheren relaties en giftgeschiedenis; de proefbelofte noemt een venster van dertig dagen en het voorkomen van een herhaald cadeau.

**Bronnen:** [public/apps/attenties.html](../../public/apps/attenties.html), [scripts/lib/voltooi/attenties.js](../../scripts/lib/voltooi/attenties.js), [server/kern/rechterhand/attenties.js](../../server/kern/rechterhand/attenties.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/attenties.html` → `relaties.attenties` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een discrete persoonlijke attentie-assistent die bestaande eigen aantekeningen helpt terugvinden en voorstellen voorbereidt zonder contacten te profileren of vanzelf iets te verzenden.

**Benodigde wijzigingen:**

- Maak tijd, aanleiding en eerdere gift zichtbaar met bron en bewerkbaarheid; laat de gebruiker herinneringen dempen of verwijderen.
- Laat een gekozen attentie als concept naar de bestaande commerce- of concierge-ingang gaan, met expliciete ontvanger-, prijs- en verzendbevestiging.
- Leg bewaartermijnen en minimale gegevens voor persoonlijke relatieaantekeningen vast; deel ze niet automatisch met een sociaal profiel.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid noteert een verjaardag en een eerder cadeau en bereidt een nieuwe attentie voor. → Het eerdere cadeau is zichtbaar; er ontstaat alleen een eigen concept totdat het lid ontvanger en eventuele externe opdracht bevestigt. Bewijs: scripts/lib/voltooi/attenties.js — Bestaande attentieproef plus concept-overdracht en negatieve verzendtest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:attenties:0ca1062c7eab3b49e14adc70b5f4b284c8f6dc0c4d676753ad2a0cf541aa8a0a`.
2. Een relatieaantekening wordt verwijderd terwijl een attentieconcept nog openstaat. → Het concept verliest de ingetrokken gegevens en kan geen oude persoonsgegevens alsnog delen; de gebruiker krijgt een begrijpelijke herstelstap. Bewijs: scripts/lib/voltooi/attenties.js — Verwijderings- en contextintrekkingstest; privacyreview van persoonlijke aantekeningen. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:attenties:3cd5f8d42a1c5630dd4d664502e604688235dc9eacc7462934d2e13dfe790a8f`.

**Externe voorwaarden / besluiten:** Een cadeauleverancier of bezorgdienst pas als uitvoerbare optie tonen na contract en providerbewijs.

### 33. Overzicht - `link:ontdek`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Horizon. **Budgetverwijzing:** browse → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:leven`, `link:reisboek`, `link:sociaal`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/rtg.html.

**Canonieke productbelofte:** een lid ziet in zijn Overzicht zijn dossier, wat er wacht en de afspraken van zijn eigen dag, en maakt het huis het zijne met een eigen foto die alleen hij ziet.

**Huidige implementatie, statisch onderzocht:** Overzicht gebruikt dossier, sociale lijn, wereld, eigen agenda en persoonlijke beelden. De proef test eigen foto en lokale dag, maar noemt leeg reisdossier, lege wachtbronnen en chunked upload buiten bereik.

**Bronnen:** [public/apps/rtg.html](../../public/apps/rtg.html), [scripts/lib/voltooi/ontdek.js](../../scripts/lib/voltooi/ontdek.js), [public/apps/rtg-dossier.js](../../public/apps/rtg-dossier.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/rtg.html` → `wereld.living` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een persoonlijke Horizon die met weinig keuzes laat zien wat nu relevant is, waarom het er staat en waar verder te gaan, met vaste navigatie en volledig controleerbare personalisatie.

**Benodigde wijzigingen:**

- Gebruik PersonalOS en bestaande dossierprojecties voor prioriteit op basis van expliciete voorkeuren; toon geen verborgen gevoelige broncontext.
- Maak de drie standen rustig, aandacht nodig en eigen keuze bewust ontwerpbaar via bestaande DS-/Experience-profielen.
- Kwalificeer echte gevulde bronnen, afbeeldingsupload/-uitsnede en conflicterende voorkeuren op meerdere toestellen.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid heeft een reiswijziging, een afspraak vandaag en een open eigen concept. → Overzicht prioriteert begrijpelijk met bron en vaste doorklik; er is geen onverwachte actie of verschuivende hoofdnav. Bewijs: scripts/lib/voltooi/ontdek.js — Bestaande overzichtproef plus gevulde-bronnenketen en taakacceptatie met nieuwe gebruikers. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:ontdek:6486e53a915846ed3b584d265e41e4267ee30968895a2a9cdcd0303c9b5337eb`.
2. Een persoonlijke foto-upload breekt af en de gebruiker herstelt daarna het RTG-beeld. → Geen halve of andermans afbeelding verschijnt; keuze en uitsnede zijn na herstart consistent en herstellen is omkeerbaar waar mogelijk. Bewijs: scripts/lib/voltooi/ontdek.js — Chunked-upload-, beeldautorisatie-, conflict- en visuele regressieproef. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:ontdek:cc0334ca2b6bc54f9876e8590d73bec292c2ca05595f941515b6620bfcf416a7`.

**Externe voorwaarden / besluiten:** Geen aanvullend extern besluit benoemd; de bestaande toezegklasse en gemeenschappelijke scopepoort blijven gelden.

### 34. Commerce - `link:commerce`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Ledger. **Budgetverwijzing:** transaction → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:mall`, `link:mijnmall`, `link:pay`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/commerce.html.

**Canonieke productbelofte:** een lid legt koopbare dingen in een mand, ziet per verkoper een afrekening met btw en wat bevestigen blokkeert, en geeft zijn keuze als briefje door aan de deur die wel bevestigt.

**Huidige implementatie, statisch onderzocht:** Commerce heeft aanbod, mand en overdracht; de proefbelofte is prijs/btw per verkoper en een overdrachtsbriefje naar de bevestigende eigenaar. In deze keten wordt niet besteld of betaald.

**Bronnen:** [public/apps/commerce.html](../../public/apps/commerce.html), [scripts/lib/voltooi/commerce.js](../../scripts/lib/voltooi/commerce.js), [server/kern/commerce/overdracht.js](../../server/kern/commerce/overdracht.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/commerce.html` → `winkel.commerce` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een transparante aankoopvoorbereiding over meerdere verkopers waarin de gebruiker één overzicht krijgt en per domein de echte voorwaarden en bevestiging behoudt.

**Benodigde wijzigingen:**

- Behoud mand en overdracht als compositie; voeg prijsversies, levervoorwaarden, ontbrekende gegevens en afhankelijkheden per verkoper toe.
- Maak gevolgen van een prijswijziging of uitgevallen verkoper zichtbaar voordat nieuwe toestemming wordt gevraagd.
- Laat ieder overgedragen onderdeel naar de bestaande order-/boekings-/betaaleigenaar terugverwijzen; geen centrale tweede checkoutboekhouding.

**Specifieke acceptatie en te leveren bewijs:**

1. Een mand bevat artikelen van twee verkopers en één prijs verandert vóór overdracht. → De oude prijs wordt niet stil bevestigd; alleen de actuele, opnieuw aanvaarde voorwaarden gaan mee naar de juiste eigenaar. Bewijs: scripts/lib/voltooi/commerce.js — Bestaande commerceproef plus prijsversie- en tweeverkoper-overdrachtstest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:commerce:6e7cdb9bbb8bb3e2622ea9105809ba6c0e5d51d68a6eefdaaa9a0ccd623d7ec5`.
2. Eén downstream-order is bevestigd en een andere mislukt. → Het overzicht toont gedeeltelijke voltooiing met afzonderlijke bewijzen en herstelopties; geen totale terugdraai- of betaalclaim zonder domeinbewijs. Bewijs: scripts/lib/voltooi/commerce.js — Ketenproef met gedeeltelijke uitkomst en expliciete compensatiegrenzen. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:commerce:e10c4e12da01ad5036f915036e7c0d24ad52ff2f3249ddccd7db56292fb21261`.

**Externe voorwaarden / besluiten:** Aansprakelijkheid, verkopersvoorwaarden en eventuele gecombineerde checkout zijn expliciete commerciële/juridische beslissingen.

### 35. Bestellen - `tab:bestellen`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Journey. **Budgetverwijzing:** transaction → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** geen aanvullende taakafhankelijkheid benoemd. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/app.html (stand bestellen).

**Canonieke productbelofte:** een lid bestelt boodschappen bij een groothandel, ziet de bestelling verder gaan en annuleert er een die nog niet bevestigd is.

**Huidige implementatie, statisch onderzocht:** De bestellen-tab gebruikt de groothandelmarkt, bestel-, mijn- en annuleerroutes; de proef laat een bevoegde leverancier de orderstatus voortzetten en toetst voorraad en annuleren vóór bevestiging.

**Bronnen:** [public/apps/app.html](../../public/apps/app.html), [scripts/lib/voltooi/bestellen.js](../../scripts/lib/voltooi/bestellen.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/app.html` → `kern.app` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een volledige boodschappenbestelling met actuele leverbaarheid, aantoonbare orderstatus en een helder wijzigings- of annuleringspad bij voorraad- en leverproblemen.

**Benodigde wijzigingen:**

- Verbind bestaande orderregels, voorraadversie, levermoment en voorwaarden in een controleerbare samenvatting vóór bevestigen.
- Laat wijzigingen of vervangingen als voorstel aan het lid zien; hergebruik de supplier-orderstatus als enige voortgangsbron.
- Maak foutafhandeling voor gedeeltelijke levering, dubbele opdrachten en stale voorraad expliciet in het bestaande ordercontract.

**Specifieke acceptatie en te leveren bewijs:**

1. Twee leden bestellen tegelijk het laatste voorraadartikel; één bevestiging komt later terug. → Voorraad wordt niet dubbel beloofd; iedere order toont de echte bevestiging of een concrete niet-leverbare regel. Bewijs: scripts/lib/voltooi/bestellen.js — Bestaande bestelproef plus voorraadconcurrentie en vertraagde supplier-status. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:tab:bestellen:19a4e6f1d3ceeea031b2b17569ac7c96514fd94fde65b7090bb3cc59d6492a9a`.
2. Een lid annuleert tijdens een gelijktijdige leveranciersbevestiging en herhaalt daarna het verzoek. → Eén geldige toestand wint volgens het contract; de klant ziet of annuleren is gelukt, zonder dubbele order of automatische terugbetalingsclaim. Bewijs: scripts/lib/voltooi/bestellen.js — Annulering/bevestiging-race en hersteltest; leveranciersacceptatie van statussemantiek. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:tab:bestellen:c741f4d28bdcb5b24bee1c23704c685db471036d6ef631492e9b2979bd017e12`.

**Externe voorwaarden / besluiten:** Leveranciersafspraken over voorraad, bezorging, vervanging en restitutie bepalen welke operationele beloften mogen worden getoond.

### 36. Gezin - `tab:gezin`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Ceremony. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:rtfportaal`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/app.html (stand gezin).

**Canonieke productbelofte:** een oppas of familielid koppelt zich met de eenmalige uitnodiging van een RTFoundation-gezin, ziet wat het gezin hem toevertrouwt, stuurt het gezin een bericht en ontkoppelt zelf.

**Huidige implementatie, statisch onderzocht:** De gezin-tab gebruikt persoonlijke uitnodiging, overzicht, kanaal, bericht en ontkoppelen. De proef geeft een oppas beperkte inzage zonder ouderrechten; GezinRT/WebRTC en echte push worden niet meegenomen.

**Bronnen:** [public/apps/app.html](../../public/apps/app.html), [scripts/lib/voltooi/gezin.js](../../scripts/lib/voltooi/gezin.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/app.html` → `kern.app` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een veilige gezinsingang waarin ouder, kind, familielid en oppas precies zien wat voor hun geldige relatie nodig is en tijdelijke toegang begrijpelijk kan eindigen.

**Benodigde wijzigingen:**

- Verbind uitnodigingsacceptatie en bevoegdheden aan bestaande Foundation-relaties; toon doel, looptijd en verleende inzage vóór accepteren.
- Maak de grens tussen lezen, berichten en ouderbeheer expliciet in de gezinsweergave en deel zo weinig mogelijk nood-/kindgegevens.
- Bouw een direct intrek- en ontkoppelpad met herstel van onvoltooide uitnodigingen zonder nieuwe gezins- of agendasessie.

**Specifieke acceptatie en te leveren bewijs:**

1. Een ouder nodigt een oppas uit voor beperkte inzage en de oppas accepteert tweemaal dezelfde uitnodiging. → Er is één beperkte relatie; ouderbeheer en niet-gedeelde kindgegevens blijven onbereikbaar. Bewijs: scripts/lib/voltooi/gezin.js — Bestaande gezinsproef plus UI-rechtenmatrix voor ouder, oppas, kind en buitenstaander. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:tab:gezin:943822701d46b2349551381176d32289bad206fe26f33e91f58f4b8220da5dcf`.
2. De ouder trekt toegang in terwijl de oppas een berichtconcept heeft en offline is. → Het concept wordt niet alsnog verzonden; na herstel verdwijnen gedeelde gegevens en blijft ontkoppelen duidelijk. Bewijs: scripts/lib/voltooi/gezin.js — Intrekking-/offline-race, cachecontrole en kindprivacyacceptatie. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:tab:gezin:c88e4dd1513f171b97e40b4addb7a2168499bf91c16616f8edaa5e29589c48a0`.

**Externe voorwaarden / besluiten:** Wettelijke vertegenwoordiging, bewaartermijnen en operationeel protocol bij conflicterende ouderlijke bevoegdheid moeten zijn vastgesteld.

### 37. Privekantoor - `link:rechterhand`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Command. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:reisboek`, `link:commerce`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/lifestyle.html.

**Canonieke productbelofte:** een lid vertelt een wens in een zin, De Rechterhand regelt hem, en het lid beslist alleen over een concreet voorstel buiten zijn mandaat.

**Huidige implementatie, statisch onderzocht:** Privékantoor gebruikt de bestaande bureau/lus-intake, case en beslisroutes. De proef laat een mens op kantoor een case oppakken en zegt dat vastzetten een case-afspraak is, geen reservering bij een zaak.

**Bronnen:** [public/apps/lifestyle.html](../../public/apps/lifestyle.html), [scripts/lib/voltooi/rechterhand.js](../../scripts/lib/voltooi/rechterhand.js), [public/apps/lifestyle-lus.js](../../public/apps/lifestyle-lus.js), [scripts/conciergeproef.js](../../scripts/conciergeproef.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/lifestyle.html` → `concierge.privekantoor` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een persoonlijke regie-ervaring waarin één wens leidt tot een duidelijk dossier met menselijke verantwoordelijkheid, beslispunten, echte uitvoeringsstatus en herstel van misgelopen onderdelen.

**Benodigde wijzigingen:**

- Maak de bestaande concierge-case de bron voor Plan Dossier-weergave; hergebruik mandaat en bureau-eigenaar in plaats van een tweede casebackend.
- Voeg per onderdeel bron, verantwoordelijke, voorwaarden en afhankelijkheden toe; toon het verschil tussen kantoorafspraak en providerbevestiging.
- Breid intake, toelichting en herstel uit met versiegebonden besluiten en zichtbare consequenties van veranderde wensen.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid geeft een wens met grenzen en kantoor doet een voorstel buiten die grenzen. → Uitvoering wacht op expliciet akkoord voor de concrete versie; een case-afspraak verschijnt niet als bevestigde externe boeking. Bewijs: scripts/lib/voltooi/rechterhand.js — Bestaande rechterhandproef plus scripts/conciergeproef.js en voorstel-fingerprintketen. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:rechterhand:e09b94fcbcdc72aa246f583784b69cb95e486da51b105884912ce02084afedf8`.
2. Een provideronderdeel valt na een akkoord uit en kantoor bereidt een alternatief voor. → Het dossier toont de gedeeltelijke uitkomst, gevolgen en nieuwe keuze; het oude akkoord autoriseert geen ander bedrag of andere leverancier. Bewijs: scripts/lib/voltooi/rechterhand.js — Concierge-herstelketen, providerstatusproef en menselijke dienstverleningsacceptatie. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:rechterhand:420d269c0a3326e4652d302d62e27383c6c12bfef672c4a18a3bb5a2de6d63ca`.

**Externe voorwaarden / besluiten:** Lifestyle-toelating blijft menselijk; operationele bezetting, responstijden en leveranciersafspraken moeten de gecommuniceerde dienstbelofte dragen.

### 38. Wonen - `link:wonen`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Command. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:logboek`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/wonen.html.

**Canonieke productbelofte:** een lid meldt wat er thuis stuk is zonder dat RTG een vakman veinst, en houdt zijn woningdocumenten bij in een eigen dossier in de kluis.

**Huidige implementatie, statisch onderzocht:** Wonen heeft onderhoudsmelding en annuleren plus woningbestanden in de bestaande kluis. De proef noemt geen gekoppelde vakman en geen opgelost-route; slimme apparaten en virusscan vallen buiten bereik.

**Bronnen:** [public/apps/wonen.html](../../public/apps/wonen.html), [scripts/lib/voltooi/wonen.js](../../scripts/lib/voltooi/wonen.js), [public/apps/wonen.js](../../public/apps/wonen.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/wonen.html` → `woning.overzicht` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een betrouwbaar woningdossier met documenten, onderhoud en expliciete serviceaanvragen, waarin melding, uitvoerderacceptatie en opgelost bewijs afzonderlijk blijven.

**Benodigde wijzigingen:**

- Hergebruik bestanden/kluis voor woningdocumenten met versie, categorie, verval en doelgebonden delen; bouw geen tweede documentopslag.
- Maak onderhoud van melding tot eigen afsluiting of later aantoonbaar uitvoerdersbewijs begrijpelijk; voeg uitvoerderswerk alleen na apart besluit toe.
- Verbind woningplanning en gevolgen aan bestaande agenda/Plan Dossier; onderzoek de bekende overlaybediening op de actuele kandidaat vóór herontwerp.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid meldt een defect en uploadt een woningdocument. → De melding is opgeslagen zonder fictieve vakman of opgelost-status; het document is alleen via de bestaande kluisrechten bereikbaar. Bewijs: scripts/lib/voltooi/wonen.js — Bestaande wonenproef plus uploadscan-, bestandsrechten- en browserbedieningsproef. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:wonen:5bdbd71b26f53b8939c76b025d3693e89254713953ac9207c4dc3d1a32783f94`.
2. Een documentupload breekt af en de onderhoudsmelding wordt intussen geannuleerd. → Er ontstaat geen half toegankelijk bestand of herleefde melding; hervatten toont de actuele stand en een veilige retry. Bewijs: scripts/lib/voltooi/wonen.js — Chunked-upload-, annulering-, herstart-, cache- en overlayregressieproef. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:wonen:44fbcd43a1b6b2d6c44393624214d2f7cb9ad421515cc41adea7d25b00299fa2`.

**Externe voorwaarden / besluiten:** Echte vakmanopdrachten, service-SLA, woningbeveiliging en slimme-apparaatbediening zijn aparte provider-/veiligheidsbesluiten.

### 39. Maison - `link:maison`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Command. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:logboek`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/maison.html.

**Canonieke productbelofte:** een Lifestyle-lid bestuurt zijn huishouden: staf, taken voor wie en wanneer, af te vinken, en een logboek.

**Huidige implementatie, statisch onderzocht:** Maison beheert stafcontacten, taken, klaarzetten/afvinken en huislog. Volgens de proef zijn stafleden geen accounts: een taak is een persoonlijke notitie, geen ontvangen opdracht.

**Bronnen:** [public/apps/maison.html](../../public/apps/maison.html), [scripts/lib/voltooi/maison.js](../../scripts/lib/voltooi/maison.js), [server/kern/rechterhand/maison.js](../../server/kern/rechterhand/maison.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/maison.html` → `woning.huishouden` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een discreet huishoudboek waarin eigen planning, uitgevoerde taken en gedeelde opdrachten begrijpelijk gescheiden zijn en de bewoner minimale gegevens kan delegeren.

**Benodigde wijzigingen:**

- Verdiep de bestaande taakweergave met terugkerende planning, afhankelijkheden en historie voor eigen huishoudadministratie.
- Toon bij iedere taak of het een eigen notitie is of, na apart besluit, een bevestigde overdracht via bestaande personeels-/accountrechten.
- Koppel relevante documenten of onderhoud aan bestaande dossiers; bouw geen tweede HR- of personeelsdatabase.

**Specifieke acceptatie en te leveren bewijs:**

1. Een bewoner plant terugkerend tuinonderhoud en vinkt één uitvoering af. → Alleen de bedoelde taak wordt afgerond; toekomstige taken blijven intact en de genoemde tuinman krijgt geen impliciete accounttoegang of bericht. Bewijs: scripts/lib/voltooi/maison.js — Bestaande Maison-proef plus herhaling- en negatieve overdrachtstest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:maison:53e03f06ad1fe7f0438924057cfe630cbf9272cea83def4091c543574ed2b714`.
2. Een stafcontact wordt verwijderd met open taken en het toestel herlaadt. → Taken worden niet aan een verkeerde persoon toegewezen; de bewoner ziet de verweesde toewijzing en kan die veilig herstellen. Bewijs: scripts/lib/voltooi/maison.js — Contactverwijdering-, verwijzings- en herstartproef; privacyreview. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:maison:00ad07ad223d7185bb243de83dfda504e32c239bdcf4a0c8a78e9b7c1c5ea0ef`.

**Externe voorwaarden / besluiten:** Echte personeelsaccounts, werkgeversverantwoordelijkheid en opdrachtontvangst zijn aparte scope-/arbeidsrechtelijke besluiten.

### 40. Table - `link:table`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Atelier. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:cellier`, `link:foodcourt`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/table.html.

**Canonieke productbelofte:** een Lifestyle-lid organiseert een prive-diner: gelegenheid, gastenlijst met dieet en tafelindeling, en het menu per gang.

**Huidige implementatie, statisch onderzocht:** Table beheert gelegenheid, gasten, dieet, tafelschikking en menu. De proef zegt dat gasten geen accounts zijn en er geen uitnodiging wordt verzonden.

**Bronnen:** [public/apps/table.html](../../public/apps/table.html), [scripts/lib/voltooi/table.js](../../scripts/lib/voltooi/table.js), [server/kern/rechterhand/table.js](../../server/kern/rechterhand/table.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/table.html` → `leven.tafel-gelegenheid` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een zorgvuldige privé-dinerplanner waarin voorbereiding, menu, zitplaatsen en dieetnotities samenkomen zonder persoonsgegevens ongevraagd te verspreiden.

**Benodigde wijzigingen:**

- Verdiep de bestaande dinercompositie met herbruikbare plannen, leesbare tafelschikking en wijzigingsgevolgen voor menu en voorraad.
- Houd gastenlijst en dieet als private aantekeningen; een eventuele uitnodiging verloopt via bestaande sociale rechten en expliciete bevestiging.
- Verbind Cellier en Food Court alleen via referenties; een menuvoorstel is geen gegarandeerd allergenenvrij advies of restaurantboeking.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid wijzigt een gast met een dieetnotitie en herschikt het diner. → Menu- en stoelprojecties blijven consistent; de dieetnotitie verschijnt uitsluitend waar het lid bevoegd en bewust deelt. Bewijs: scripts/lib/voltooi/table.js — Bestaande Table-proef plus verwijzings-, tafelschikking- en privacytest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:table:3f94bdd25038705dae65156a47c1c199761b727286d9d7114e65d74be9a68444`.
2. Een dinerconcept wordt gekopieerd en een contact wordt daarna verwijderd. → De kopie maakt geen uitnodiging of dubbel contact; verouderde persoonsgegevens zijn zichtbaar te corrigeren en worden niet stil verzonden. Bewijs: scripts/lib/voltooi/table.js — Conceptkopie-, verwijder-, herstart- en negatieve verzendproef. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:table:ca94c63f9851e4490188f0dc5f343f2d6cf6a928494b48223e19f10efe9a186e`.

**Externe voorwaarden / besluiten:** Professionele catering, uitnodigingsbezorging en allergenenclaims vereisen expliciet provider-/veiligheidsbesluit.

### 41. Cellier - `link:cellier`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Library. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:table`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/cellier.html.

**Canonieke productbelofte:** een Lifestyle-lid houdt zijn wijnkelder bij: aantal, waarde en drinkvenster per fles, wat op dronk is, en inschenken telt af.

**Huidige implementatie, statisch onderzocht:** De bestaande cellier-routes beheren kelder, flesregels en schenken; de proef controleert aantallen, waarde, drinkvenster en aftellen tot nul.

**Bronnen:** [public/apps/cellier.html](../../public/apps/cellier.html), [scripts/lib/voltooi/cellier.js](../../scripts/lib/voltooi/cellier.js), [server/kern/rechterhand/cellier.js](../../server/kern/rechterhand/cellier.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/cellier.html` → `leven.cellier` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een verzorgde persoonlijke kelder met herkomst van schattingen, voorraadgeschiedenis, drinkvensters en voorbereiding van een diner zonder stille aankopen of onbewezen waardegarantie.

**Benodigde wijzigingen:**

- Maak per fles voorraadmutaties, locatie en bron van drinkvenster/waardering zichtbaar; onderscheid eigen invoer van deskundig advies.
- Laat een dinerselectie naar Table verwijzen en reserveer hoogstens intern voorraad na een expliciete keuze.
- Gebruik bestaande voorraadmutaties voor correctie en herstel, met conflictwaarschuwing bij twee toestellen.

**Specifieke acceptatie en te leveren bewijs:**

1. Het lid schenkt de laatste fles terwijl hetzelfde item op een tweede toestel is geopend. → Voorraad wordt niet negatief; de tweede gebruikerstaak krijgt de actuele toestand en een begrijpelijke correctieoptie. Bewijs: scripts/lib/voltooi/cellier.js — Bestaande cellierproef plus concurrentie- en browserconflicttest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:cellier:0832ffc50cfb0ae20ea852071bfdf07b073067cc1a2c300069c59e7285794109`.
2. Een ingevoerde waarde of drinkdatum blijkt fout en het lid corrigeert die na herladen. → De correctie blijft behouden; afgeleide totalen veranderen herleidbaar en verschijnen nooit als gegarandeerde marktwaarde. Bewijs: scripts/lib/voltooi/cellier.js — Mutatie-, herstart- en schattingslabeltest; menselijke beoordeling van wijn-/waardetaal. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:cellier:214cd261a0d6d2513690e4b915ccb7632e4b852833c7d123b05707bdd4eb9d34`.

**Externe voorwaarden / besluiten:** Externe prijs- of wijninformatie alleen met geldige bronlicentie; geen beleggings- of gegarandeerde drinkbaarheidsbelofte.

### 42. Garde-robe - `link:garderobe`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Library. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:reisboek`, `link:rechterhand`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/garderobe.html.

**Canonieke productbelofte:** een Lifestyle-lid houdt zijn garderobe bij: per stuk wat het is en waar het hangt, per categorie geteld, met zijn vaklui.

**Huidige implementatie, statisch onderzocht:** Garde-robe beheert stukken, categorieën, locaties en vaklui. De proef noemt vaklui expliciet eigen contacten, niet accounts; een registratie stuurt geen opdracht naar een kleermaker.

**Bronnen:** [public/apps/garderobe.html](../../public/apps/garderobe.html), [scripts/lib/voltooi/garderobe.js](../../scripts/lib/voltooi/garderobe.js), [server/kern/rechterhand/garderobe.js](../../server/kern/rechterhand/garderobe.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/garderobe.html` → `leven.garderobe` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een persoonlijke garderobebibliotheek met vindbare stukken, onderhoud, combinaties en reisselecties, waarbij suggesties eigen ordening blijven.

**Benodigde wijzigingen:**

- Maak stuklocatie, materiaal, foto en onderhoudsinformatie bewerkbaar en herleidbaar via de bestaande garderobebron.
- Laat een outfit- of paklijst als eigen selectie naar een reisplan verwijzen zonder een tweede inventaris te bewaren.
- Bied een voorbereide onderhoudsvraag aan de bestaande concierge/commerce-eigenaar; noem contactregistratie nooit een verzonden opdracht.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid selecteert kleding voor een reis en verplaatst één stuk naar een andere kast. → De reisselectie verwijst naar hetzelfde stuk en toont de actuele locatie; er ontstaat geen tweede kledingvoorraad. Bewijs: scripts/lib/voltooi/garderobe.js — Bestaande garderobeproef plus verwijzings- en locatieconsistentietest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:garderobe:7118d011be14f1d7bc5863717ee8569d09312cb61242ad7efe18fac489a517cc`.
2. Een concept voor een stomerij wordt voorbereid en daarna geannuleerd. → De contactpersoon ontvangt niets; eigen notities en gekozen stukken blijven beheersbaar en na herladen consistent. Bewijs: scripts/lib/voltooi/garderobe.js — Negatieve verzendtest en concept-/herstartproef; privacycontrole op kledingfoto's. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:garderobe:71a25b59ef50a0109becad8b6da29cc43dc5ccbcf6bb604d3eed179230c3b1c4`.

**Externe voorwaarden / besluiten:** Nieuwe onderhouds- of bestelverbindingen naar vaklui vragen provider- en voorwaardenbesluit.

### 43. Muziek - `link:muziek`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Library. **Budgetverwijzing:** realtime → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:mediaos`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/muziek.html.

**Canonieke productbelofte:** een lid deelt zijn eigen muziek, een ander lid vindt, hoort en waardeert haar, alleen de maker haalt haar weg, en samen luisteren brengt de luisteraar in de kamer van de gastheer.

**Huidige implementatie, statisch onderzocht:** Muziek heeft eigen-bestandpublicatie, luistertickets, waardering en samenluisterkamers. De proef gebruikt een korte WAV en toetst bytes; grote bestanden, ranges en synchronisatie van luisterklokken vallen buiten bereik.

**Bronnen:** [public/apps/muziek.html](../../public/apps/muziek.html), [scripts/lib/voltooi/muziek.js](../../scripts/lib/voltooi/muziek.js), [public/apps/muziek-feed.js](../../public/apps/muziek-feed.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/muziek.html` → `media.luisteren` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een zorgvuldig gemaakte muziekervaring voor rechtmatig gedeeld werk, met goede spelerbediening, bibliotheek, hervatten en samen luisteren binnen expliciete rechten.

**Benodigde wijzigingen:**

- Behoud maker, bestand en lijst bij de bestaande media-eigenaren; bied een rustige queue en toegankelijke afspeelbediening.
- Maak samen luisteren opt-in met duidelijke gastheer-/gastrollen en beperkt gedeelde afspeelstatus.
- Kwalificeer grotere bestanden, seek/ranges, onderbreking en synchronisatie; vermeld eerlijk wanneer een bron niet beschikbaar is.

**Specifieke acceptatie en te leveren bewijs:**

1. Een maker deelt eigen werk en twee leden luisteren samen terwijl één pauzeert en hervat. → Dezelfde toegestane bron klinkt; synchronisatie volgt de vastgelegde rolregels en persoonlijke luistergeschiedenis wordt niet ongevraagd gedeeld. Bewijs: scripts/lib/voltooi/muziek.js — Bestaande muziekproef plus echte audioplayer-, range- en tweebrowser-kloktest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:muziek:518c1756cf950758e348fff9cb95dd854db5f0a6a348cb6dae5cc73e2c9b0429`.
2. De maker verwijdert een nummer tijdens een onderbroken sessie. → Nieuwe luistertickets of cacheherstel ontsluiten het ingetrokken werk niet; de queue toont de onbeschikbare bron begrijpelijk. Bewijs: scripts/lib/voltooi/muziek.js — Verwijder-, ticket-, offline- en queueherstelproef; rechtenreview. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:muziek:5e116caa0dd40720132837e4f787c345d72347cc5e2dcb2700a8430ceb5db8f9`.

**Externe voorwaarden / besluiten:** Muzieklicenties en rechten op gedeeld werk zijn vereist; commerciële streamingcatalogi zijn geen impliciete uitbreiding.

### 44. Live - `link:podium`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Salon. **Budgetverwijzing:** realtime → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:pay`, `link:mediaos`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/podium.html.

**Canonieke productbelofte:** een lid met een door het kantoor goedgekeurd kanaal gaat live; een kijker vindt het, kijkt mee, chat, stuurt een cadeau via RTG Pay en meldt, en de maker blokkeert wie over de schreef gaat.

**Huidige implementatie, statisch onderzocht:** Podium heeft goedgekeurde kanalen, live/kijk, chat, cadeau, blokkeren en melden. De proef loopt API-status en Pay-cadeaus; de daadwerkelijke WebRTC-videostroom en besloten zones vallen buiten haar bereik.

**Bronnen:** [public/apps/podium.html](../../public/apps/podium.html), [scripts/lib/voltooi/podium.js](../../scripts/lib/voltooi/podium.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/podium.html` → `media.podium` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een betrouwbare live-omgeving voor makers en publiek met duidelijke livekwaliteit, toegankelijke deelname, gemodereerde chat en bewust bevestigde betalingen.

**Benodigde wijzigingen:**

- Maak de bestaande live-status en echte mediaverbinding afzonderlijk zichtbaar; een kanaal dat live gemarkeerd is bewijst nog geen ontvangen beeld.
- Verbind chat, moderatie en cadeaus met bestaande kanaalrechten en betaalwaarheid; verwijder kunstmatige schaarste of impulsdruk.
- Breid de speler/studio uit met ondertitel-/toegankelijkheidspaden, reconnect en duidelijke beëindiging zonder een oude uitzending te herleven.

**Specifieke acceptatie en te leveren bewijs:**

1. Een toegelaten maker gaat live; een kijker ontvangt beeld, chat en bevestigt één cadeau. → Beeld wordt daadwerkelijk ontvangen; chat en cadeau horen bij hetzelfde toegestane kanaal en betaling verschijnt exact eenmaal. Bewijs: scripts/lib/voltooi/podium.js — Bestaande Podium-proef plus tweebrowser-mediatest, betaalbewijs en toegankelijkheidscontrole. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:podium:f8420d3655061a5c86840af2ae9ba112c65268e51f1f2cd5671f97f3fe3f00e3`.
2. De maker blokkeert een kijker en de stream valt tijdens een betaalbevestiging weg. → Geblokkeerde toegang stopt; de betaling wordt via haar eigen bron hersteld en de uitgevallen stream veroorzaakt geen tweede afschrijving. Bewijs: scripts/lib/voltooi/podium.js — Blokkade-, media-uitval-, reconnect- en betaalreconciliatieketen. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:podium:d51e910b63aa894735ac73fdd12a6768cdb890be05f05b8198075394f434e0ad`.

**Externe voorwaarden / besluiten:** Streamingcapaciteit, moderatiebezetting, contentrechten en regels voor giften/betalingen aan makers vragen aantoonbare operationele afspraken.

### 45. Films en series - `link:theater`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Library. **Budgetverwijzing:** realtime → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:mediaos`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/theater.html.

**Canonieke productbelofte:** een lid met een door het kantoor goedgekeurd kanaal zet een film in de zaal, byte voor byte; een ander lid kijkt met een kijkticket, spoelt, reageert, abonneert en meldt.

**Huidige implementatie, statisch onderzocht:** Theater heeft kanaaltoelating door kantoor, bestand-upload, kijktickets, reacties, abonnement en melden; de proef vergelijkt aangeboden videobytes en beproeft ongeautoriseerd verwijderen/ondertitelen.

**Bronnen:** [public/apps/theater.html](../../public/apps/theater.html), [scripts/lib/voltooi/theater.js](../../scripts/lib/voltooi/theater.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/theater.html` → `media.theater` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een hoogwaardige film- en seriezaal voor rechtmatig aangeboden materiaal, met toegankelijke speler, betrouwbare voortgang, ondertitels, rechten en contentmoderatie.

**Benodigde wijzigingen:**

- Breid de bestaande spelerervaring uit met hoofdstukken, ondertitelkwaliteit, expliciete afspeelhervatting en een eindige bibliotheekstructuur.
- Maak rechten, kanaaltoelating en beschikbaarheidsvensters zichtbaar vanuit de bestaande publicatiebron; intrekking stopt nieuwe toegang.
- Kwalificeer adaptive netwerkgedrag, range-verzoeken, verlopen tickets en grote uploads zonder een tweede mediacatalogus te bouwen.

**Specifieke acceptatie en te leveren bewijs:**

1. Een toegelaten maker publiceert een film met ondertitels en een lid hervat op een ander toestel. → Alleen toegestane bytes worden geleverd; voortgang en gekozen ondertitels zijn herkenbaar en toetsenbordbediening werkt. Bewijs: scripts/lib/voltooi/theater.js — Bestaande theaterproef plus echte browser-speler-, range- en toegankelijkheidsproeven. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:theater:1f64c35af788ee414b4be4adece94e9aa7309fddd2a8fa99164c49e47caad1c8`.
2. Een kijkticket verloopt of de film wordt tijdens een netwerkonderbreking ingetrokken. → Nieuwe toegang wordt geweigerd zonder titel- of inhoudslek buiten rechten; de speler toont de reden en start niet stil opnieuw. Bewijs: scripts/lib/voltooi/theater.js — Ticket-, intrekkings-, buffering- en cacheproef; licentie-/moderatiereview. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:theater:0bdb3cdc15c45888520c6b8f730f63ecd4ee254c1554715fe817fd6019eaa026`.

**Externe voorwaarden / besluiten:** Distributie- en muzieklicenties, leeftijdsclassificatie en eventuele streaminginfrastructuur moeten per aanbod zijn geregeld.

### 46. Video - `link:clips`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Atelier. **Budgetverwijzing:** realtime → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:mediaos`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/clips.html.

**Canonieke productbelofte:** een lid deelt een korte clip waarvan het beeld op zijn eigen toestel blijft; andere leden zien hem in een eindige dagselectie met gevolgde makers eerst, reageren en melden, en alleen de maker knipt, ondertitelt en haalt weg.

**Huidige implementatie, statisch onderzocht:** Video/Clips gebruikt metadata, eindige feed, volgen, reacties, melden, knippen en ondertitels. De proef zegt dat beeld op het toestel blijft en sluit de echte P2P-mediastroom expliciet uit.

**Bronnen:** [public/apps/clips.html](../../public/apps/clips.html), [scripts/lib/voltooi/clips.js](../../scripts/lib/voltooi/clips.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/clips.html` → `media.clips` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een toegankelijke, eindige kortevideo-ervaring met lokale makerscontrole, betrouwbare P2P-beschikbaarheid en duidelijke grenzen aan publicatie, bewerken en verwijderen.

**Benodigde wijzigingen:**

- Maak beschikbaarheid van de echte beeldbron zichtbaar; een metadataregel mag geen afspeelbaarheid beloven.
- Kwalificeer knippen, ondertitels en afspelen over bestaande clipdeler/WebRTC met duidelijke eigenaar- en meldrechten.
- Behoud eindige selecties en bied bewuste vervolgstappen; geen oneindige-autoplaydruk of verborgen deelverkeer.

**Specifieke acceptatie en te leveren bewijs:**

1. Een maker publiceert een lokale clip; een tweede browser bekijkt de clip met ondertitels. → Werkelijke beelden worden ontvangen van de bedoelde bron en alleen de maker kan de montagespecificatie wijzigen. Bewijs: scripts/lib/voltooi/clips.js — Bestaande clipsproef plus tweebrowser-P2P-, decoder- en ondertitel/a11y-proef. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:clips:f41fdb01f81e36ea41e6b2f22376cdbe0ba4635900b2ba5c4b6dd231c183d880`.
2. De maker gaat offline of trekt de clip in terwijl de kijker reageert. → De kijker ziet onbeschikbaar of ingetrokken; een metadatarest veroorzaakt geen verzonnen afspelen en nieuwe reacties volgen de actuele publicatiestatus. Bewijs: scripts/lib/voltooi/clips.js — Bronuitval-, intrekkings-, cache-, moderatie- en herstelketen. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:clips:4804d426e196f13a7b5effd739829aa4bc50d09c4cebc1ed9435b6cbb5df6be0`.

**Externe voorwaarden / besluiten:** Productie-TURN/bandbreedte en moderatie moeten zijn geregeld; contentrechten blijven bij de maker aantoonbaar gecontroleerd.

### 47. Spelen - `link:spelen`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Spatial. **Budgetverwijzing:** realtime → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:spelavond`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/spelen.html?pas=.

**Canonieke productbelofte:** een lid nodigt een vriend uit, ze spelen om de beurt tot het potje klaar is, en de uitslag telt alleen voor geverifieerde volwassenen; onder die grens speelt het spel gewoon en wordt er niets bewaard.

**Huidige implementatie, statisch onderzocht:** Spelen gebruikt de bestaande spellenmotor met lidroutes. De proef speelt schaak en bewaart competitieve uitslagen alleen voor geverifieerde volwassenen; overige spellen, gezinsingang, toernooien en gedeeld scherm vallen buiten dat scenario.

**Bronnen:** [public/apps/spelen.html](../../public/apps/spelen.html), [scripts/lib/voltooi/spelen.js](../../scripts/lib/voltooi/spelen.js), [server/kern/spellen/grens.js](../../server/kern/spellen/grens.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/spelen.html` → `spelen.bordspel` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een complete toegankelijke spelomgeving waarin samen spelen prettig is, spelregels helder zijn en de centrale 18+-grens voor blijvende competitie overal geldt.

**Benodigde wijzigingen:**

- Maak per bestaand spel starten, uitleg, beurt, pauze, verlaten en einde aantoonbaar consistent; voeg geen generieke ranglijst voor kinderen toe.
- Hergebruik dezelfde spelmotor voor lid-, gezins- en schermprojecties en definieer welke informatie elke rol mag zien.
- Kwalificeer iedere spelvariant met spelinvarianten, reconnect en centrale progressieMag in plaats van gekopieerde leeftijdslogica.

**Specifieke acceptatie en te leveren bewijs:**

1. Een minderjarige of niet-gekeurde speler speelt een volledig spel via de gezinsingang. → Het spel is volledig speelbaar; geen competitieve uitslag, rang, seizoensscore of blijvend niveau wordt opgeslagen. Bewijs: scripts/lib/voltooi/spelen.js — Bestaande spelenproef plus spelvariant-/ingangsmatrix en centrale progressiegrenscontrole. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:spelen:4d7f8ea0a2eeda64bda0afc56b62c0f791699ac3d86cbc3c4f0321c7098ebdd7`.
2. Een speler verzendt dezelfde zet tweemaal tijdens een onderbreking en hervat later. → Het bord en de beurt blijven geldig; geheime informatie blijft geheim en een beëindigd potje wordt niet heropend. Bewijs: scripts/lib/voltooi/spelen.js — Spel-invariant-, dubbeltik-, disconnect-, projectie- en herstelproef. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:spelen:245caeff99f8861fa017941f9c20733109cd19fb7b766783a99d1ce9db632be5`.

**Externe voorwaarden / besluiten:** Nieuwe competitiemodellen of prijzentoernooien vragen apart scope-/juridisch besluit; leeftijdsgrens blijft centraal en onverkort.

### 48. Nieuws - `link:nieuws`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Library. **Budgetverwijzing:** browse → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** geen aanvullende taakafhankelijkheid benoemd. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/nieuws.html.

**Canonieke productbelofte:** een lid leest het gepubliceerde werk van RTG Redactie per rubriek, opent een artikel en laat Rahul het samenvatten of een vraag beantwoorden uit alleen de artikeltekst; een concept of teruggetrokken stuk ziet het niet.

**Huidige implementatie, statisch onderzocht:** Nieuws leest gepubliceerde RTG-redactieartikelen en een brongebonden AI-route. De proef gebruikt lokale samenvatting en bronzinnen, geen extern model, en sluit de redactionele schrijftafel uit.

**Bronnen:** [public/apps/nieuws.html](../../public/apps/nieuws.html), [scripts/lib/voltooi/nieuws.js](../../scripts/lib/voltooi/nieuws.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/nieuws.html` → `nieuws.lezen` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een rustige nieuwslezer waarin bron, actualiteit en correcties direct zichtbaar zijn en Rahul uitsluitend onderbouwd over het geopende artikel kan antwoorden.

**Benodigde wijzigingen:**

- Maak artikelstructuur, rubriek, leestijd, bronversie en correctie zichtbaar met toegankelijke leesvoorkeuren.
- Laat iedere Rahul-uitspraak naar passage en artikelversie verwijzen; niet-onderbouwde vragen krijgen een duidelijke grens.
- Behoud publiceren en terugtrekken bij de redactie-eigenaar en invalideer samenvattingen zodra de bron verandert.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid vraagt naar een gegeven dat niet in het artikel staat. → Rahul zegt dat de bron het niet bevat; het antwoord verzint geen aanvullend nieuws en wijzigt het artikel niet. Bewijs: scripts/lib/voltooi/nieuws.js — Bestaande nieuwsproef plus brongebonden antwoordevaluatie voor gekozen model en handmatige fallback. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:nieuws:86655d47c5e4737f6ffa7f3a1138f22a27a6b552afb3c2fede72ff5660f84d1a`.
2. De redactie trekt een artikel terug nadat een samenvatting is bewaard. → De samenvatting wordt niet opnieuw als geldig artikelantwoord aangeboden en een geraden concept-id blijft gesloten. Bewijs: scripts/lib/voltooi/nieuws.js — Intrekking-, cache-, conceptautorisatie- en offlinehersteltest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:nieuws:5a3770808850246319289c826d4da414fbcc89fd8aa251a406d9aa523c105c9c`.

**Externe voorwaarden / besluiten:** Redactionele verantwoordelijkheid en bron-/herpublicatierechten blijven bij een aangewezen menselijke eigenaar.

### 49. Krant - `link:krant`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Library. **Budgetverwijzing:** browse → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:mediaos`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/krant.html.

**Canonieke productbelofte:** een lid leest de kranten die nieuwsbedrijven binnen RTG publiceren, met de correcties die de redactie openbaar maakte; een concept of teruggehaald artikel bestaat voor de lezer niet.

**Huidige implementatie, statisch onderzocht:** Krant leest gids, krant en artikel uit de redactie van nieuwsbedrijven. De proef behandelt concept, publicatie, openbare correctie en terughalen; de bron benoemt een historische open accountpoort die opnieuw moet worden gemeten.

**Bronnen:** [public/apps/krant.html](../../public/apps/krant.html), [scripts/lib/voltooi/krant.js](../../scripts/lib/voltooi/krant.js), [public/apps/redactie/publicatie.js](../../public/apps/redactie/publicatie.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/krant.html` → `media.krant` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een hoogwaardige, rustige krantenleeservaring met uitgeversidentiteit, publicatiedatum, zichtbare correcties, toegankelijke tekst en eerlijke toegang tot actuele versies.

**Benodigde wijzigingen:**

- Behoud de uitgever als redactie-eigenaar; toon versie en correctiegeschiedenis naast een leesstand met instelbare tekstgrootte.
- Verbind bewaren en hervatten via bestaande media-/bibliotheekvoorzieningen zonder concepten of ingetrokken tekst in privézoekkopieën te laten leven.
- Kwalificeer account-/publicatierechten en cache-invalidering expliciet; neem de oude proefnotitie niet over als actueel defect of als opgelost bewijs.

**Specifieke acceptatie en te leveren bewijs:**

1. De uitgever corrigeert een gepubliceerd artikel; een lezer opent een eerder bewaarde verwijzing. → De lezer krijgt de actuele tekst met zichtbare correctietoelichting en uitgever; het oude concept wordt niet openbaar. Bewijs: scripts/lib/voltooi/krant.js — Bestaande krantproef plus versie-/cache- en leesstand-browserproef. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:krant:a02db38e51822d556c9fa48f444989850e982d672d6be48983f751203b15d02a`.
2. Een artikel wordt teruggetrokken terwijl het op een tweede toestel openstaat. → Na rechtmatige actualisatie is de inhoud niet opnieuw opvraagbaar; de gebruiker ziet een ingetrokken status en geen kapot leeg scherm. Bewijs: scripts/lib/voltooi/krant.js — Terugtrekking-, accountpoort- en offlinehersteltest; redactionele acceptatie. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:krant:92e6e9faf533a37a0360b3715d9c982d0bc856ceb3351a86c07b01d2b7295f45`.

**Externe voorwaarden / besluiten:** Uitgeversrechten, correctiebeleid en eventueel offline leesrecht moeten per publicatieovereenkomst vaststaan.

### 50. Sport - `link:sport`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Journey. **Budgetverwijzing:** transaction → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:reisboek`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/sport.html.

**Canonieke productbelofte:** een lid reserveert tickets op een vak van de plattegrond die de club zelf tekent, ziet zijn toegangscode, en die code gaat bij de entree een keer naar binnen; een vol vak zegt hoeveel plaatsen er nog zijn, en een herhaalde tik reserveert nooit dubbel.

**Huidige implementatie, statisch onderzocht:** Sport gebruikt clubplattegrond, ticketkoop, tickets en entree-scan. De proef reserveert zonder betaling en vermeldt afrekenen aan de poort; een toegangscode wordt één keer gebruikt.

**Bronnen:** [public/apps/sport.html](../../public/apps/sport.html), [scripts/lib/voltooi/sport.js](../../scripts/lib/voltooi/sport.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/sport.html` → `sport.wedstrijd` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een heldere sport- en wedstrijddagervaring met toegankelijke vakkeuze, echte capaciteit, controleerbare toegangsrechten en zichtbare grens tussen reservering en betaling.

**Benodigde wijzigingen:**

- Maak plattegrondkeuze toegankelijk met een gelijkwaardige tekstlijst en relevante toegankelijkheids-/begeleidersinformatie.
- Behoud ticket en scan bij de sporteigenaar; laat betaald, gereserveerd en toegang gebruikt nooit door elkaar lopen.
- Verbind desgewenst vervoer en agenda via referenties in een dagplan zonder wedstrijd- of toegangsbewijs te kopiëren.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid reserveert de laatste plaats in een vak via toetsenbord en toont het ticket bij de entree. → Capaciteit klopt, de code geeft één keer toegang en het scherm zegt eerlijk dat betaling buiten deze keten gebeurt. Bewijs: scripts/lib/voltooi/sport.js — Bestaande sportproef plus plattegrond-a11y-, concurrentie- en fysieke scanacceptatie. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:sport:32456585aa9d04f15cb8b336559a926c27273b036e210a405a8661fb6758adf7`.
2. Een scanner heeft een verouderde stand of de wedstrijd wordt afgelast. → Het systeem belooft geen geldige entree of terugbetaling zonder bevoegde bron; de gebruiker ziet status en concrete herstelroute. Bewijs: scripts/lib/voltooi/sport.js — Scan-replay-, offlinegrens-, afgelastings- en supportketenproef. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:sport:772c04c5a7f786f4cc29ccfa7d8e4ef2e45a34e16c836b6a60021644db24296b`.

**Externe voorwaarden / besluiten:** Clubcontract, ticketvoorwaarden, actuele capaciteit en eventuele toekomstige online betaling/refund zijn externe of aparte scopevoorwaarden.

### 51. Mall - `link:mall`

**Bouwcohort:** eerste twaalf, poort G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Library. **Budgetverwijzing:** browse → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:commerce`, `link:mijnmall`, `link:appdossier`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/mall.html.

**Canonieke productbelofte:** een lid vindt aanbod in de Mall, zet het in een eigen lijst, bewaart het met een hartje in een vaste lijst, en zet een app uit de bibliotheek in zijn kast.

**Huidige implementatie, statisch onderzocht:** Mall heeft zoeken, lijsten, bewaren en appinstallaties in bestaande routes; de proef gebruikt synthetisch aanbod en sluit bestellen, betalen en prijswijziging uit. mall-experience.js en de bestaande winkelvoorzijde zijn aanwezig.

**Bronnen:** [public/apps/mall.html](../../public/apps/mall.html), [scripts/lib/voltooi/mall.js](../../scripts/lib/voltooi/mall.js), [public/apps/mall-experience.js](../../public/apps/mall-experience.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/mall.html` → `winkel.mall` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een overzichtelijke markt die relevant aanbod vindbaar maakt, herkomst en leverbaarheid verklaart en de gebruiker met behoud van context naar de echte verkoper en afhandeling brengt.

**Benodigde wijzigingen:**

- Kwalificeer volledige zoek-/filterdekking over de bestaande catalogus, met toegankelijke resultaten en geen verborgen afkap van beschikbare items.
- Maak de stap van bewaren naar vergelijken en voorbereiden versiegebonden: prijs, beschikbaarheid, verkoper en voorwaarden worden opnieuw gecontroleerd.
- Hergebruik lijsten en appinstallatiecontracten; externe apps krijgen hun bestaande dossier en bevestigde rechten vóór gebruik.

**Specifieke acceptatie en te leveren bewijs:**

1. Een gebruiker zoekt een item buiten de eerste resultaatpagina, bewaart het en opent later de verkoper. → Het item is vindbaar indien toegestaan; de overgang behoudt de keuze maar verifieert actuele prijs en voorwaarden opnieuw. Bewijs: scripts/lib/voltooi/mall.js — Bestaande Mall-proef plus zoekdekking-, paginering- en prijswijzigingsketen. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:mall:5fc1dd69ca11437aaf54df95596aff99394955b15ad9d969705c08cd275b18f2`.
2. Een bewaard item of geïnstalleerde app wordt ingetrokken. → De lijst bewaart hoogstens een veilige ingetrokken verwijzing; de gebruiker kan geen oude beschikbaarheid of apprecht alsnog gebruiken. Bewijs: scripts/lib/voltooi/mall.js — Catalogusintrekking-, installatiepoort-, cache- en browserhersteltest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:mall:c7a5f8eaf7eca29c6ef06c3c0c4b8541f163c0957bfd62845d8d33cf2d1aa2c7`.

**Externe voorwaarden / besluiten:** Verkopersovereenkomsten, catalogusrechten en externe apppublicatie blijven noodzakelijke voorwaarden voor echt aanbod.

### 52. Mijn bestellingen - `link:mijnmall`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Journey. **Budgetverwijzing:** transaction → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:mall`, `link:commerce`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/mijnmall.html.

**Canonieke productbelofte:** een lid vraagt wat niemand aanbiedt, alleen zaken met het juiste vak zien het, het lid kiest een reactie en vindt het antwoord terug -- zonder boeking of betaling.

**Huidige implementatie, statisch onderzocht:** Mijn bestellingen heeft vraag, keuze en wijzigingsroutes voor Mall-aanvragen. De proef kwalificeert offertes van passende zaken en gunning zonder boeking/betaling; overige bestellingen, lijsten en dertigdagverval vallen buiten haar bereik.

**Bronnen:** [public/apps/mijnmall.html](../../public/apps/mijnmall.html), [scripts/lib/voltooi/mijnmall.js](../../scripts/lib/voltooi/mijnmall.js), [public/apps/mijnmall-aanvragen.js](../../public/apps/mijnmall-aanvragen.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/mijnmall.html` → `winkel.bestellingen` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een helder persoonlijk order- en aanvraagdossier dat een wens, antwoord, keuze, echte order en betaling nooit verwart en iedere leverancierstaak terugleidt naar haar bron.

**Benodigde wijzigingen:**

- Maak de huidige aanvraagketen visueel en semantisch apart van echte orders; pas de taaknamen aan zonder een nieuwe catalogusfunctie te maken.
- Verbind gekozen reacties aan een Plan Dossier met versies, voorwaarden en expliciete overdracht naar de bevoegde order-/boekingsroute.
- Breid tijdgestuurde scenario's uit met verlopen aanvragen, gewijzigde offertes en gedeeltelijke afhandeling.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid kiest een reactie van een passende zaak op een eigen aanvraag. → Het dossier toont gekozen reactie, geen geboekt of betaald resultaat; alleen die zaak en de klant zien toegestane vervolgdetails. Bewijs: scripts/lib/voltooi/mijnmall.js — Bestaande mijnmall-proef plus statusbegrip- en aanvraag-tot-orderoverdrachtstest. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:mijnmall:32833622132f689ef2a08ed3ae061f59cfcb565cb0495b91abab3001eec10963`.
2. De offerte verloopt terwijl het lid offline is en na terugkomst de oude keuze bevestigt. → De keuze wordt niet uitgevoerd op verlopen voorwaarden; de actuele status en benodigde herbevestiging zijn zichtbaar. Bewijs: scripts/lib/voltooi/mijnmall.js — Tijdmachine-, stale-offerte-, idempotentie- en browserherstelproef. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:mijnmall:1b23c1b617e8dc40019729782e3464288fd98dda401f78a21e8f2f0653ad6c20`.

**Externe voorwaarden / besluiten:** P0 beslist de heldere presentatie van aanvragen versus orders; gunning mag geen nieuwe commerciële verplichting krijgen zonder expliciete voorwaarden.

### 53. RTG Pay - `link:pay`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Ledger. **Budgetverwijzing:** transaction → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:verificatie`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/pay.html.

**Canonieke productbelofte:** een geverifieerd lid laadt zijn wallet op en ziet het nieuwe saldo; weigert of hangt de bank, dan hoort het lid wat er werkelijk gebeurde en wordt er niets bijgeschreven -- ook na een herstart, een dubbele tik, een afgebroken verzoek en een crash.

**Huidige implementatie, statisch onderzocht:** RTG Pay heeft oplaad- en overzichtsroutes. De proef gebruikt een direct antwoordende simulatiebank en sluit echte providers, webhooks, PostgreSQL/Redis en de geldmotor expliciet uit.

**Bronnen:** [public/apps/pay.html](../../public/apps/pay.html), [scripts/lib/voltooi/pay.js](../../scripts/lib/voltooi/pay.js), [server/kern/betaalwaarheid/bewijs.js](../../server/kern/betaalwaarheid/bewijs.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/pay.html` → `betalen.rtgpay` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een controleerbare wallet- en betaalbasis waarin ieder saldo en iedere status aan bewijs is gekoppeld en fouten een veilige, begrijpelijke herstelroute hebben.

**Benodigde wijzigingen:**

- Behoud Pay en betaalwaarheid als geldbronnen; maak pending, bevestigd, geweigerd, controle nodig en terugbetaling begrijpelijk.
- Sluit echte provideradapters aan via bestaande bewijscontracten met replaybescherming, verificatie, idempotentie en reconciliatie.
- Breid verificatie en apparaatbinding uit over de daadwerkelijke kandidaatopslag en geldmotor; simulatie blijft herkenbaar geïsoleerd.

**Specifieke acceptatie en te leveren bewijs:**

1. Een provider accepteert een opwaardering maar de webhook komt pas na een browser-time-out. → Geen vroegtijdige bijschrijving; na geldig providerbewijs ontstaat exact één boeking met dezelfde referentie en herleidbaar saldo. Bewijs: scripts/lib/voltooi/pay.js — Bestaande Pay-proef plus echte provider-sandbox, webhookverificatie en grootboekreconciliatie. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:pay:45320754b04652e620a9b3d5612ee728ca0531dd446fa41b1aea810c7fd7e2c2`.
2. Een callback wordt herhaald, de database herstart en een terugbetaling krijgt controle nodig. → Geen dubbel geld; de onzekere toestand is zichtbaar en alleen de bevoegde menselijke controle kan haar vrijgeven. Bewijs: scripts/lib/voltooi/pay.js — Herstel op de productie-equivalente opslag/motor, replaytest en onafhankelijke financiële/securityacceptatie. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:pay:cafb987b5c70eb9c2143e12f32d6b9880dfae804f1f81c8f03912af1f8229ca5`.

**Externe voorwaarden / besluiten:** Betaalprovider, certificering/PCI-scope, vergunningverantwoordelijkheid en geteste productieherstelprocedure zijn blokkerende externe voorwaarden.

### 54. App-dossier - `link:appdossier`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Ceremony. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** geen aanvullende taakafhankelijkheid benoemd. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/appstore-dossier.html.

**Canonieke productbelofte:** een lid leest over een app van een derde wie de leverancier is en wie hem toeliet, wat er draait, wat hij nooit krijgt en wat het dossier niet kan zeggen -- pas nadat een mens van RTG publiceerde.

**Huidige implementatie, statisch onderzocht:** appstore-dossier.html leest kanaal en dossier via /api/appstore; de voltooiproef doorloopt inzending, menselijke publicatie en dossierinzage en vermeldt dat het scherm zelf niets schrijft.

**Bronnen:** [public/apps/appstore-dossier.html](../../public/apps/appstore-dossier.html), [scripts/lib/voltooi/appdossier.js](../../scripts/lib/voltooi/appdossier.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/appstore-dossier.html` → `appstore.dossier` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een begrijpelijke vertrouwenskaart voor iedere toegelaten externe app: uitgever, concrete versie, rechten, toelatingsbesluit, intrekkingen en de grenzen van dat bewijs.

**Benodigde wijzigingen:**

- Projecteer het bestaande appstore-dossier in lagen: begrijpelijke samenvatting met daarachter versie, herkomst, rechten en ontbrekende controles.
- Laat de kaart wijzigingen tussen twee versies verklaren vanuit het bestaande publicatiejournaal, met extra aandacht voor nieuwe gegevensrechten.
- Koppel intrekking en blokkade aan de bestaande installatie/openen-grens, zodat een gelezen dossier geen nieuwe toelating verleent.

**Specifieke acceptatie en te leveren bewijs:**

1. Een uitgever dient een nieuwe versie in die nog geen mens heeft toegelaten; een lid opent het dossier. → Alleen de toegelaten versie krijgt een gebruiksstatus; de nieuwe versie wordt geen stilzwijgende toestemming of kwaliteitsgarantie. Bewijs: scripts/lib/voltooi/appdossier.js — Bestaande publicatieproef plus dossier- en versieverschil-browserproef. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:appdossier:d72f686dffbe08290f78341063a38dd245c7c992db1e3931f1fec93f923c77fc`.
2. Een appversie wordt ingetrokken terwijl het dossier offline zichtbaar was; het lid probeert opnieuw te openen. → De oude weergave is als verouderd herkenbaar; uitvoering wacht op actuele toelating en blijft bij intrekking geblokkeerd. Bewijs: scripts/lib/voltooi/appdossier.js — Intrekkings-, cache- en fail-closed-integratietest; onafhankelijke beoordeling van tekst over garanties. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:appdossier:44ba9870d34d227a4ca3cc33941ce3c1b6aa1dbd58485ff39213a7db3665189b`.

**Externe voorwaarden / besluiten:** Externe uitgeverstoelating, licentievoorwaarden en eventuele onafhankelijke securitycontrole moeten aantoonbaar geldig zijn.

### 55. Logeren bij leden - `link:huis`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Journey. **Budgetverwijzing:** transaction → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:reisboek`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/thuis.html.

**Canonieke productbelofte:** een lid zet zijn huis open, een ander lid vindt en vraagt het aan zonder dat er iets wordt afgeschreven, de host beslist, en het verblijf loopt van inchecken tot review; een bezette periode blijft bezet.

**Huidige implementatie, statisch onderzocht:** Logeren bij leden loopt via thuis.html met huis, aanvraag, hostbesluit, verblijf, berichten en review. De proef verplaatst geen geld en noemt annulering met terugbetaling, co-hosts en echte sleutels buiten bereik.

**Bronnen:** [public/apps/thuis.html](../../public/apps/thuis.html), [scripts/lib/voltooi/huis.js](../../scripts/lib/voltooi/huis.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/thuis.html` → `verblijf.logeren-bij-leden` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een complete ledenverblijfervaring met duidelijke beschikbaarheid, hostbesluit, huisregels, privacy en ondersteuning van aanvraag tot vertrek, binnen aantoonbare juridische en operationele grenzen.

**Benodigde wijzigingen:**

- Verbind aanvraag en verblijf als één leesbaar dossier met afzonderlijke host-, document- en eventuele betaalbewijzen.
- Werk wijziging en annulering uit via bestaande reserveringseigenaar; maak prijs of vergoeding alleen uitvoerbaar na expliciet scope-/providerbesluit.
- Beperk adres-/contactdeling tot het juiste stadium en kwalificeer overlap, blokkeren, klachten en vertrek zonder sleuteldienst te veinzen.

**Specifieke acceptatie en te leveren bewijs:**

1. Twee gasten vragen dezelfde periode aan en de host accepteert één aanvraag. → De tweede aanvraag kan geen overlappend bevestigd verblijf worden; adres- en contactdeling volgen de vastgestelde rechten. Bewijs: scripts/lib/voltooi/huis.js — Bestaande huisproef plus concurrentie-, adresprivacy- en host/gast-browserketen. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:huis:0d7034daefe7b08ad7022b8f09a98d9ece6d9e0f5fc55b2980ec14f893ad3674`.
2. Een bevestigd verblijf wordt gewijzigd of afgezegd tijdens netwerkuitval. → Beide partijen zien dezelfde uiteindelijke verblijfstatus; het dossier zegt expliciet of geld buiten deze keten staat en welke hulp werkelijk beschikbaar is. Bewijs: scripts/lib/voltooi/huis.js — Wijzigings-, annulerings-, herstart- en menselijke supportacceptatieproef. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:huis:6be139caceb2b9b668ddcfae82e6da5d2f9da9c3865d304e133652bfdbd44afb`.

**Externe voorwaarden / besluiten:** Verhuurrecht, verzekering, consumentenvoorwaarden, fiscale afhandeling en eventuele betaal-/terugbetalingsdienst vereisen afzonderlijke besluiten; geen automatische toevoeging van betaalde verhuur.

### 56. Uitgaan - `link:uitgaan`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Journey. **Budgetverwijzing:** transaction → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:foodcourt`, `link:move`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/uitgaan.html.

**Canonieke productbelofte:** een lid zet zich met zijn gezelschap op de gastenlijst van een avond, de zaak ziet hem op codenaam, en afmelden geeft de plek vrij.

**Huidige implementatie, statisch onderzocht:** Uitgaan leest avonden en eigen deelname en gebruikt RSVP/annuleren. De proef behandelt aanmelden en vrijkomende capaciteit; een vol event en daadwerkelijke check-in worden niet gemeten.

**Bronnen:** [public/apps/uitgaan.html](../../public/apps/uitgaan.html), [scripts/lib/voltooi/uitgaan.js](../../scripts/lib/voltooi/uitgaan.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/uitgaan.html` → `leven.uitgaan` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een complete avondkeuze met gezelschap, voorwaarden, echte capaciteit en een aantoonbaar deelname- en entreeverloop, zonder automatische sociale druk.

**Benodigde wijzigingen:**

- Verbind evenement, gezelschap en RSVP in een compacte keuze met toegankelijkheid, tijd en voorwaarden vóór bevestiging.
- Laat een avondplan agenda, vervoer en eventuele tafel als verwijzingen samenbrengen; iedere externe stap behoudt eigen toestemming.
- Breid capaciteit, wijziging, annulering en check-in uit in de bestaande event-/supplierketen met duidelijke statuswoorden.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid meldt een gezelschap aan terwijl de laatste plaatsen bijna vol zijn. → De capaciteit wordt niet overschreden; de zaak ziet alleen benodigde codenamen en de klant krijgt een eerlijke deelname-status. Bewijs: scripts/lib/voltooi/uitgaan.js — Bestaande uitgaanproef plus capaciteit-race en gezelschapsprivacy. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:uitgaan:9669f472af668cbbe3cbdb2198bd493882ade44d83d0038332836aadb028dcc8`.
2. De avond wijzigt of wordt geannuleerd nadat een plan met vervoer is gemaakt. → De gevolgen worden zichtbaar als voorstellen; een RSVP-annulering verplaatst geen geld of vervoersboeking zonder eigen domeinbewijs. Bewijs: scripts/lib/voltooi/uitgaan.js — Evenement-tot-plan-keten, check-in- en annulerings-/herstelproef. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:uitgaan:512080cb429b723ea32c55a451bbb4f2920327ec0ea0b84bff43434a5e37cf8a`.

**Externe voorwaarden / besluiten:** Organisatorvoorwaarden, entreebewijs en eventuele betalingen moeten van bevoegde bronnen komen.

### 57. Food Court - `link:foodcourt`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Journey. **Budgetverwijzing:** transaction → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:entourage`, `link:wbw`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/foodcourt.html.

**Canonieke productbelofte:** een lid ziet de restaurants en hun vrije tijden, vraagt een tafel aan, en de zaak beslist -- het lid ziet de bevestiging.

**Huidige implementatie, statisch onderzocht:** Food Court leest aanbod en tijden, vraagt via /api/reserveer een tafel en leest de zaakbeslissing terug; de proef laat de zaak de klant uitsluitend op codenaam zien.

**Bronnen:** [public/apps/foodcourt.html](../../public/apps/foodcourt.html), [scripts/lib/voltooi/foodcourt.js](../../scripts/lib/voltooi/foodcourt.js), [public/apps/foodcourt-intent.js](../../public/apps/foodcourt-intent.js), [server/kern/reservering/providerbewijs.js](../../server/kern/reservering/providerbewijs.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/foodcourt.html` → `horeca.reserveren` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een complete restaurantkeuze en tafelreservering met actuele tijd, gezelschap, toegankelijke voorkeuren en een eerlijk bevestigings- en wijzigingspad.

**Benodigde wijzigingen:**

- Verbind zoeken, vrije tijden, gezelschap en dieetvelden in één beknopt reserveertraject met doelgebonden delen.
- Toon aangevraagd, bevestigd, gewijzigd en geannuleerd uitsluitend uit de bestaande reserveringseigenaar.
- Laat een wijziging gevolgen voor agenda, vervoer of gedeelde kosten voorbereiden, met aparte bevestiging voor nieuwe externe effecten.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid vraagt met gezelschap de laatste beschikbare tafel aan en de zaak beslist later. → De klant ziet aanvraag tot de zaak bevestigt; privacyvelden gaan alleen mee voor het afgesproken doel. Bewijs: scripts/lib/voltooi/foodcourt.js — Bestaande foodcourtproef plus concurrentie, late zaakbeslissing en gegevensminimalisatie. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:foodcourt:7b466c86bd67e66796fd0af35f83e26887a856565ab088e97bf8726411ade2af`.
2. Een bevestigde tijd wijzigt en een klant probeert tegelijk te annuleren. → De eindstatus en eventuele voorwaarden zijn consistent bij lid en zaak; afgeleide agenda-acties blijven voorstellen totdat bevestigd. Bewijs: scripts/lib/voltooi/foodcourt.js — Wijzigings-/annuleringsrace en restaurant-tot-agenda-ketenproef. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:foodcourt:c76a72c967dec1141de4e4c477ee6ed5a3bd9ac49bb970d1ace40eb8d750acfb`.

**Externe voorwaarden / besluiten:** Restaurantvoorwaarden, actuele capaciteit en verantwoordelijkheid voor allergeneninformatie moeten aantoonbaar worden beheerd.

### 58. Game Night - `link:spelavond`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Spatial. **Budgetverwijzing:** realtime → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:spelen`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/spelscherm.html.

**Canonieke productbelofte:** een speler koppelt met een eenmalige code een televisie aan het potje, en die toont vanaf dan elke zet -- alleen wat publiek is, met een eigen schermsessie die geen ledensessie is.

**Huidige implementatie, statisch onderzocht:** Game Night gebruikt spelscherm.html en de projectiekoppeling. De proef toetst schaakzetten, eenmalige schermcodes en een afzonderlijke gehashte schermsessie; geheime kaarten vallen onder een andere test.

**Bronnen:** [public/apps/spelscherm.html](../../public/apps/spelscherm.html), [scripts/lib/voltooi/spelavond.js](../../scripts/lib/voltooi/spelavond.js), [public/apps/spelscherm.js](../../public/apps/spelscherm.js), [server/kern/spellen/grens.js](../../server/kern/spellen/grens.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/spelscherm.html` → `spelen.projectiescherm` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een ontspannen gezamenlijke spelavond waarin een televisie uitsluitend de publieke spelstand toont en koppelen, ontkoppelen en hervatten vanzelfsprekend blijven.

**Benodigde wijzigingen:**

- Behoud de bestaande projectie als read-only schermrol; maak codegeldigheid, verbonden scherm en direct intrekken zichtbaar.
- Bouw per bestaand spel een expliciete publieke projectie met een toegankelijke tekstvariant voor bord- of kleurinformatie.
- Kwalificeer verloren koppelingen en herkoppelen zonder private spelerskaarten of accountrechten naar de televisie te brengen.

**Specifieke acceptatie en te leveren bewijs:**

1. Twee spelers koppelen een televisie en spelen een spel met geheime kaarten. → Alleen publieke informatie verschijnt op het scherm; spelershanden en accounttokens zijn nergens in de projectie aanwezig. Bewijs: scripts/lib/voltooi/spelavond.js — Bestaande spelavondproef en test/spelprojectie.test.js, aangevuld met browser- en netwerkinspectie. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:spelavond:57d342b74feffa3adc639b6eea63cb2488c0b1b59bd9c52a049ddc434306faeb`.
2. De koppeling wordt ingetrokken tijdens een netwerkstoring en een oude code wordt hergebruikt. → Het oude scherm ontvangt na herstel geen speldata; de code blijft ongeldig en nieuwe koppeling verloopt expliciet. Bewijs: scripts/lib/voltooi/spelavond.js — Intrekkings-, replay-, herstart- en televisiebrowserproef. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:spelavond:63083676b4583b059464fe49de98ae87e5c83a505b1ee1c1e27d42d19db98e93`.

**Externe voorwaarden / besluiten:** Geen aanvullend extern besluit benoemd; de bestaande toezegklasse en gemeenschappelijke scopepoort blijven gelden.

### 59. Tweede scherm - `link:tweedescherm`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Command. **Budgetverwijzing:** realtime → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:horeca`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/scherm.html.

**Canonieke productbelofte:** een zaak zet haar kassa, keuken, bar of reserveringen op een tweede scherm en ziet daar wat er in de zaak gebeurt; een andere zaak, een lid of een anonieme bezoeker ziet het niet.

**Huidige implementatie, statisch onderzocht:** Tweede scherm leest /api/supplier/state en schrijft zelf niets. De proef toont kassa-omzet uit een eigen zaak; keuken, bar, kamers en realtime spiegel vallen buiten het gemelde bereik.

**Bronnen:** [public/apps/scherm.html](../../public/apps/scherm.html), [scripts/lib/voltooi/tweedescherm.js](../../scripts/lib/voltooi/tweedescherm.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/scherm.html` → `horeca.tweedescherm` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een betrouwbare read-only projectie voor kassa, keuken, bar of reserveringen, met een afgebakende schermrol, frisse gegevens en onmiddellijk intrekbare toegang.

**Benodigde wijzigingen:**

- Maak per bestaand schermprofiel expliciet welke operationele velden nodig zijn; toon geen volledige personeelssessie of overbodige persoonsgegevens.
- Gebruik de bestaande supplier-eigenaar en stream-/verversingsmechaniek met zichtbaar laatst bijgewerkt en een veilig stale-scherm.
- Kwalificeer koppelen, intrekken, reconnect en resource-opruiming voor ieder bedoelde profiel, zonder lokale tweede orderstatus te schrijven.

**Specifieke acceptatie en te leveren bewijs:**

1. Een zaak koppelt een keukenprofiel en voert een orderwijziging uit in de hoofdapp. → Het scherm toont de geautoriseerde actuele keukeninformatie en kan geen verkoop, rol of order muteren. Bewijs: scripts/lib/voltooi/tweedescherm.js — Bestaande tweedeschermproef plus keuken/bar/reservering-profielmatrix en realtime-browserketen. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:tweedescherm:dbb92348510435d3ceb4282a0b3f4fb3fc80db9b87f909eb13e98b1c3be94ef3`.
2. De schermtoegang wordt ingetrokken tijdens netwerkuitval en later herstelt de verbinding. → Geen nieuwe zaakdata verschijnt; de oude weergave wordt veilig afgeschermd en een andere tenant blijft altijd onbereikbaar. Bewijs: scripts/lib/voltooi/tweedescherm.js — Intrekkings-, stale-data-, tenant- en reconnectproef. Vereist op de releasekandidaat; in dit plan niet uitgevoerd. Vereiste-ID: `acceptance:link:tweedescherm:2bbe7ca58bf5f951bfc8f72cc95344c9e1741f645fa339d21d4ebc34d04ebbf8`.

**Externe voorwaarden / besluiten:** P0 verklaart de LivingOS-catalogusplaats van deze zakelijke projectie zonder het tenant- of WorkOS-eigenaarschap te verplaatsen.


## Instellingen

### 60. Wie ben ik - `link:ik`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Ceremony. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** geen aanvullende taakafhankelijkheid benoemd. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/ik.html.

**Canonieke productbelofte:** een lid zegt hoe hij genoemd wil worden, welke toon Rahul aanslaat en hoe elk scherm zich gedraagt, binnen de grens van zijn leeftijd.

**Huidige implementatie, statisch onderzocht:** De bron biedt profiel, toegankelijkheid, geloof en Rahul-stemming. De proef meet opslag, geen feitelijke toonuitvoering of alle schermen/minderjarigen.

**Bronnen:** [public/apps/ik.html](../../public/apps/ik.html), [scripts/lib/voltooi/ik.js](../../scripts/lib/voltooi/ik.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/ik.html` → `instellingen.profiel` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een eenvoudige persoonlijke voorkeurenervaring voor aanspreekvorm, leesbaarheid en beweging.

**Benodigde wijzigingen:**

- Bestaand versleuteld profiel als enige bron houden; keuzes direct in representatieve signatures voorvertonen.
- Centrale toegankelijkheidskeuzes, leeftijdsgrenzen en optionele gevoelige voorkeuren kwalificeren zonder verborgen persoonsafleiding.

**Specifieke acceptatie en te leveren bewijs:**

1. Gebruiker zet grote tekst en verminderde beweging aan en opent reis, ledger en editor. → Alle drie gebruiken centrale keuze zonder afgesneden primaire actie of onvermijdbare animatie. Bewijs: scripts/lib/voltooi/ik.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:ik:631c6c2af5e32d7fdc3cdf012bbff27d8ee772791500ac68746b3da380985848`.
2. Een minderjarige wijzigt fase; een tweede toestel bewaart oudere voorkeuren. → Rechten wijzigen niet door profielkeuze; conflicterende stand overschrijft nieuwere keuze niet stil. Bewijs: scripts/lib/voltooi/ik.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:ik:3152c55e84f24868d8b72c62f706b4706d20a60da7a2ff4fb15e1ac9d47c0014`.

**Externe voorwaarden / besluiten:** Geen aanvullend extern besluit benoemd; de bestaande toezegklasse en gemeenschappelijke scopepoort blijven gelden.

### 61. Identiteit aantonen - `link:verificatie`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Ceremony. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** geen aanvullende taakafhankelijkheid benoemd. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/verificatie.html.

**Canonieke productbelofte:** een lid stuurt zijn identiteitsbewijs en een selfie in, een medewerker op naam beslist, het lid ziet de uitkomst en krijgt bericht, en een afwijzing wist het bewijs.

**Huidige implementatie, statisch onderzocht:** Het scherm uploadt document en selfie en leest status. De proef gebruikt pixelbeelden en bewijst geen echte documentherkenning of versleutelde productieopslag.

**Bronnen:** [public/apps/verificatie.html](../../public/apps/verificatie.html), [scripts/lib/voltooi/verificatie.js](../../scripts/lib/voltooi/verificatie.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/verificatie.html` → `identiteit.verificatie` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een toegankelijke identiteitsceremonie met minimale inzameling en herleidbaar menselijk besluit.

**Benodigde wijzigingen:**

- Upload, ingediend, menselijke beoordeling, herstel en verwijdering als consistente lus tonen.
- Bestaande kluis en keuring behouden; leeftijd alleen gecontroleerd noemen na overname uit document; veilige opslag en afwijzingsverwijdering bewijzen.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid dient in; benoemde medewerker keurt goed met gecontroleerde geboortedatum. → Ingediend verleent geen goedkeuring; audit noemt medewerker en leeftijdBron weerspiegelt werkelijk gecontroleerde datum. Bewijs: scripts/lib/voltooi/verificatie.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:verificatie:1f051ede7cfdef28cdc906cf5673a2c6259b84121372d30c8b2c4c798d160387`.
2. Upload breekt af, afwijzing volgt en onbevoegde medewerker vraagt beeld op. → Geen publieke restbestanden of dubbele dossiers; afgewezen bewijs verwijderd volgens contract; onbevoegde ontvangt nul beeldbytes. Bewijs: scripts/lib/voltooi/verificatie.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:verificatie:9f8d0ef2d1a7862a1319e57cc860798e8db682d88fdcdeaab8b5ddc31fa8d429`.

**Externe voorwaarden / besluiten:** Operationele keuring, documentherkenning, versleuteling en bewaarbeleid vragen onafhankelijke veiligheids- en privacyacceptatie.

### 62. Passkeys - `link:passkeys`

**Bouwcohort:** eerste twaalf, poort G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Ceremony. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:bescherming`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/passkeys.html.

**Canonieke productbelofte:** een lid zet na zijn wachtwoord een passkey op zijn account, logt daarna in zonder wachtwoord, ziet zijn sleutels en haalt er een weg met zijn vinger.

**Huidige implementatie, statisch onderzocht:** De bron gebruikt WebAuthn registratie, login en bevestiging voor verwijderen. De voltooi-proef gebruikt een software-authenticator; echte apparaten zijn daarmee niet bewezen.

**Bronnen:** [public/apps/passkeys.html](../../public/apps/passkeys.html), [scripts/lib/voltooi/passkeys.js](../../scripts/lib/voltooi/passkeys.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/passkeys.html` → `account.passkeys` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Eenvoudige veilige toegang met meerdere sleutels en voorspelbaar herstel bij toestelverlies.

**Benodigde wijzigingen:**

- Bestaande ceremonies behouden met duidelijke annulering, apparaatkeuze en niet-ondersteund-pad.
- Intrekking, eenmalige challenges en accountbescherming kwalificeren; herstelmatrix voor kwijt, defect en laatste sleutel vastleggen.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid registreert twee sleutels en verwijdert één na verse bevestiging. → Twee onderscheiden credentials; ingetrokken sleutel werkt niet; opslag bevat geen private sleutel en challenge-replay faalt. Bewijs: scripts/lib/voltooi/passkeys.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:passkeys:27da26d4d5cf44995917dda5bff139a8db25c54c8cf0fe9ad1fb957c8180b81e`.
2. Gebruiker annuleert systeemprompt en verliest verbinding na registratie. → Geen dubbele sleutel of onduidelijke halfstatus; oude challenge is eenmalig en nieuwe ceremonie werkt zonder accountblokkade. Bewijs: scripts/lib/voltooi/passkeys.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:passkeys:b89b3c2595d70020dc8b94ab4e247c643f5385e254a1726dbdbd967572885e16`.

**Externe voorwaarden / besluiten:** Echte iOS-, Android-, macOS- en Windows-authenticators en herstelbeleid vragen onafhankelijke acceptatie.

### 63. Accountbescherming - `link:bescherming`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Ceremony. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:passkeys`, `link:sessies`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/mijn-isolatie.html.

**Canonieke productbelofte:** een lid zet zijn eigen beveiliging zonder drempel strenger en krijgt hem alleen via een ceremonie met reden en stappen weer omlaag.

**Huidige implementatie, statisch onderzocht:** De ingang gebruikt isolatie- en terugkeermodules. De proef meet verstrengen en sessieceremonie; identiteitsafkoeling en passkeyontsluiting liggen erbuiten.

**Bronnen:** [public/apps/mijn-isolatie.html](../../public/apps/mijn-isolatie.html), [scripts/lib/voltooi/bescherming.js](../../scripts/lib/voltooi/bescherming.js), [public/apps/mijn-isolatie-terug.js](../../public/apps/mijn-isolatie-terug.js), [public/apps/mijn-isolatie.js](../../public/apps/mijn-isolatie.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/mijn-isolatie.html` → `account.bescherming` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een begrijpelijk veiligheidsdashboard met aantoonbare afdwinging en zorgvuldig herstel.

**Benodigde wijzigingen:**

- Bestaande isolatielagen met daadwerkelijke HTTP-afdwinging en expliciete niet-gedekte delen tonen.
- Passkey-, nood- en afkoelceremonies met impactvoorvertoning kwalificeren; geen nieuwe sessiemotor.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid verstrengt identiteit en probeert dezelfde beschermde handeling via scherm en API. → Beide volgen hetzelfde serverbeleid; een clientbadge omzeilt geen weigering en verstrengen krijgt geen kunstmatige drempel. Bewijs: scripts/lib/voltooi/bescherming.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:bescherming:91debd6f4a289e81f6dbc40ca7233347f248c61d84b4c55fc999b1b970ebfa7d`.
2. Ontsluiting wordt vóór afkoeltijd afgerond, onderbroken en op nieuw toestel hervat. → Te vroeg afronden wordt geweigerd; recht en bewijs worden opnieuw getoetst; noodontsluiting blijft herkenbaar en auditbaar. Bewijs: scripts/lib/voltooi/bescherming.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:bescherming:59e0121fb567751f4834c3ab6135f3116b1db58c4a98f0d8bda7540af82524f3`.

**Externe voorwaarden / besluiten:** Geen aanvullend extern besluit benoemd; de bestaande toezegklasse en gemeenschappelijke scopepoort blijven gelden.

### 64. Waar ben ik aanwezig - `link:sessies`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Ceremony. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:passkeys`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/mijn-sessies.html.

**Canonieke productbelofte:** een lid ziet waar het is ingelogd en sluit een ander toestel op afstand -- en dat toestel blijft buiten, ook na een herstart of een crash.

**Huidige implementatie, statisch onderzocht:** De bron biedt sessies, sluiten en sluit-overige met toestelbewijs. De proef meet één intrekking op SQLite, geen multi-instance of sluit-overige.

**Bronnen:** [public/apps/mijn-sessies.html](../../public/apps/mijn-sessies.html), [scripts/lib/voltooi/sessies.js](../../scripts/lib/voltooi/sessies.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/mijn-sessies.html` → `account.sessies` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een duidelijk toestel-/sessieoverzicht met betrouwbare directe intrekking op elk kanaal.

**Benodigde wijzigingen:**

- Bestaande sessies en toestelbinding met verklaarbare laatste-gebruikstatus tonen.
- Intrekking bij streams, achtergrondwerk en meerdere instanties kwalificeren; offline werking eerlijk begrenzen.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid sluit alle andere sessies; tweede toestel vraagt API, stream en refresh. → Alle bedoelde sessies verliezen toegang; huidige sessie blijft werken; geen andere gebruiker geraakt. Bewijs: scripts/lib/voltooi/sessies.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:sessies:6819d31db6dd5fcb9166707ecd206811fb19f41279bbb7f51ec6524a62aea694`.
2. Intrekking wordt bevestigd vlak vóór crash; oud toestel probeert via andere instantie. → Revocatie blijft duurzaam en overal afgedwongen; stale cache of herhaling heropent geen toegang. Bewijs: scripts/lib/voltooi/sessies.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:sessies:bb1204a3d73befa5503cf96664cf9c56a5bf430284ca92fb424aabe43e2bc0a8`.

**Externe voorwaarden / besluiten:** Geen aanvullend extern besluit benoemd; de bestaande toezegklasse en gemeenschappelijke scopepoort blijven gelden.

### 65. Wie heeft toegang tot mij - `link:relaties`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Ceremony. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:post`, `link:sessies`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/mijn-relaties.html.

**Canonieke productbelofte:** een lid ziet per partij wie wat van hem mag, bekijkt vooraf wat sluiten doet, en zet het bij de bron stop -- en de andere partij merkt het.

**Huidige implementatie, statisch onderzocht:** De bron heeft inzagekaart en relatiegevolgen/sluiten. De voltooi-proef loopt twee van negen consentlagen, niet de volledige zorg-/locatie-/toestelketen.

**Bronnen:** [public/apps/mijn-relaties.html](../../public/apps/mijn-relaties.html), [scripts/lib/voltooi/relaties.js](../../scripts/lib/voltooi/relaties.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/mijn-relaties.html` → `privacy.toegang` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een begrijpelijk toegangsoverzicht met doel, bereik, termijn en gevolgen per partij.

**Benodigde wijzigingen:**

- Alle bestaande consentbronnen projecteren met eigenaar en dekking; geen algemene supermachtiging.
- Bekende/onbekende gevolgen voorvertonen; deels mislukte bronintrekking zichtbaar en herstelbaar houden met verse autorisatie.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid sluit een relatie met locatie, zorgcontext en machtiging. → Bereik vooraf per bron; elke intrekking afzonderlijk bewezen; ontvanger krijgt geen nieuwe gegevens meer uit het ingetrokken bereik. Bewijs: scripts/lib/voltooi/relaties.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:relaties:32b903478c98e181201f103749c5b0bdfffaa15933f436c005536f7770ada9e5`.
2. Eén bron is onbereikbaar tijdens sluiten en een open tab vraagt data. → Geen vals totaalsucces; geslaagde intrekkingen blijven staan, open bron vraagt herstel en vereiste toegang faalt gesloten. Bewijs: scripts/lib/voltooi/relaties.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:relaties:bc832e143319b277d34ea9fe1a103044959ba2c58ee28373e93c19722d6baf85`.

**Externe voorwaarden / besluiten:** Geen aanvullend extern besluit benoemd; de bestaande toezegklasse en gemeenschappelijke scopepoort blijven gelden.

### 66. Wat weet RTG van mij - `link:gegevens`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Library. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:relaties`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/mijn-gegevens.html.

**Canonieke productbelofte:** een lid ziet wat RTG van hem heeft, neemt het mee onder zijn codenaam, ziet wie in zijn dossier was, en wijzigt zijn wachtwoord zo dat het oude nergens meer opent.

**Huidige implementatie, statisch onderzocht:** De ingang toont gegevenskaart en privacy-opnieuw. De proef beschrijft export, inzage en wachtwoordwijziging, maar geen definitieve verwijdering.

**Bronnen:** [public/apps/mijn-gegevens.html](../../public/apps/mijn-gegevens.html), [scripts/lib/voltooi/gegevens.js](../../scripts/lib/voltooi/gegevens.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/mijn-gegevens.html` → `privacy.gegevens` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een datadossier met controleerbare bron, doel, inzage, export en toepasselijke verwijdergrenzen.

**Benodigde wijzigingen:**

- Privacyprojectie per domein op volledigheid mappen zonder centrale kopie van alle data.
- Export/verwijderverzoek met manifest, voortgang en bewaarplichten afwerken; toegangsstappen bij bestaande eigenaren houden.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid exporteert na toestelbewijs. → Export heeft manifest, bronmoment en codenaam; geen andere gebruiker of onbedoelde identiteitskluisinhoud lekt mee. Bewijs: scripts/lib/voltooi/gegevens.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:gegevens:3a60832204261c0efa4b437987e6ef909d8314270012876d92374da0cb66c8f5`.
2. Een verwijderverzoek wordt onderbroken terwijl één bron moet bewaren. → Herhaalbaar dossier zonder dubbele destructieve actie; gewist, bewaard en nog lopend afzonderlijk aantoonbaar met reden/termijn. Bewijs: scripts/lib/voltooi/gegevens.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:gegevens:93daa8ef79e4493b77e66dcd195a448dff75f3fe2d2911a4eb38f48b86d5ca6d`.

**Externe voorwaarden / besluiten:** Bewaarplichten en verwijdergrenzen moeten door gegevensverantwoordelijken en juridische/privacybeoordelaar zijn vastgesteld.

### 67. Mijn neigingen - `link:neigingen`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Ceremony. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** geen aanvullende taakafhankelijkheid benoemd. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/mijn-neigingen.html.

**Canonieke productbelofte:** een lid vertelt RTG wat hij graag doet, ziet op een geheugenkaart wat RTG van hem denkt te weten, en haalt het weg of verbiedt het gebruik.

**Huidige implementatie, statisch onderzocht:** De bron biedt intake, geheugen, vergeten en doelweigering. De proef sluit gedragsafleiding en termijnverval uit.

**Bronnen:** [public/apps/mijn-neigingen.html](../../public/apps/mijn-neigingen.html), [scripts/lib/voltooi/neigingen.js](../../scripts/lib/voltooi/neigingen.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/mijn-neigingen.html` → `privacy.voorkeuren` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een controleerbaar persoonlijk geheugen waarin ieder gegeven uitlegbaar, begrensd en verwijderbaar is.

**Benodigde wijzigingen:**

- Zelf opgegeven en afgeleide voorkeur met bron, doel en termijn in bestaande geheugenkaart tonen.
- Vergeten en doelweigering bij alle toegestane afnemers/caches doorzetten; tijdsverval met klokfixtures kwalificeren.

**Specifieke acceptatie en te leveren bewijs:**

1. Een lid verbiedt één doel voor een voorkeur en vraagt een suggestie. → Voorkeur blijft als geweigerd herkenbaar maar wordt voor dat doel niet gebruikt; andere doelen krijgen geen extra recht. Bewijs: scripts/lib/voltooi/neigingen.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:neigingen:baf5ee2162b5edfe0fc29538b3020c6e096d1b2f22ca3323f80fa7719b279214`.
2. Een signaal verloopt of wordt vergeten terwijl een suggestie gecachet is. → Nieuwe suggesties gebruiken het niet; herstart brengt het niet terug en geen verborgen profielkopie blijft bron. Bewijs: scripts/lib/voltooi/neigingen.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:neigingen:0feaf90da03ab0c6236c67105e574e9f64b11e6c8593e590e9d3bf7e60228122`.

**Externe voorwaarden / besluiten:** Geen aanvullend extern besluit benoemd; de bestaande toezegklasse en gemeenschappelijke scopepoort blijven gelden.

### 68. Post van RTG - `link:post`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Ceremony. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** geen aanvullende taakafhankelijkheid benoemd. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/mijn-post.html.

**Canonieke productbelofte:** een lid geeft en trekt zelf toestemming in voor commerciele post, alles staat uit tot hij het aanzet, en de geschiedenis bewijst wanneer en waar.

**Huidige implementatie, statisch onderzocht:** Het scherm biedt kanalen, alles-uit en geschiedenis. De proef noemt geen verzender die commercieel.mag leest; dat moet bij bouw opnieuw worden geverifieerd.

**Bronnen:** [public/apps/mijn-post.html](../../public/apps/mijn-post.html), [scripts/lib/voltooi/post.js](../../scripts/lib/voltooi/post.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/mijn-post.html` → `instellingen.postvoorkeuren` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een voorkeurencentrum waarvan commerciële toestemming aantoonbaar tot de verzendpoort doorwerkt.

**Benodigde wijzigingen:**

- Alle commerciële verzendroutes uit bestaande toestemming laten lezen, per doel en kanaal.
- Alles-uit direct bereikbaar; wachtrij herautoriseert bij verzending en servicemeldingen blijven afzonderlijk geclassificeerd.

**Specifieke acceptatie en te leveren bewijs:**

1. Een nieuw lid opent voorkeuren en een campagne probeert te verzenden. → Alle commerciële kanalen standaard uit; nul verzending zonder specifieke geldige toestemming. Bewijs: scripts/lib/voltooi/post.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:post:3227d7680ccf2b0b3666c089b4f695364b336956f18bd772368031efb295da8e`.
2. Het lid trekt in na klaarzetten maar vóór verzenden. → Verzendpoort blokkeert op actuele bron; herstart of herhaling activeert toestemming niet opnieuw. Bewijs: scripts/lib/voltooi/post.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:post:930b6eb1872d70f4b5066ddccfaec390f111817a0c16dcf273f46398e8450269`.

**Externe voorwaarden / besluiten:** Werkelijke e-mail/smslevering en kanaalvoorwaarden vragen providerbewijs; toestemming opslaan is geen bezorgbewijs.

### 69. Juridisch - `link:juridisch`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Library. **Budgetverwijzing:** browse → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** geen aanvullende taakafhankelijkheid benoemd. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/juridisch.html.

**Canonieke productbelofte:** iedere bezoeker kan de juridische uitleg lezen zonder dat het scherm persoonlijke gegevens of een bevoegde handeling ontsluit.

**Huidige implementatie, statisch onderzocht:** De ingang linkt voorwaarden, privacy en partnervoorwaarden. De browserproef meet publicatiecontinuïteit, geen juridische juistheid.

**Bronnen:** [public/apps/juridisch.html](../../public/apps/juridisch.html), [scripts/lib/voltooi/juridisch.js](../../scripts/lib/voltooi/juridisch.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/juridisch.html` → `site.juridisch` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een leesbaar juridisch centrum met herkenbare versies, toepasselijkheid en altijd bereikbare originele tekst.

**Benodigde wijzigingen:**

- Bestaande drie publicaties met versieherkomst, geldigheid en doelgroep verbinden.
- Toegankelijke inhoudsopgave, zoeken, afdruk en terugkeer kwalificeren; samenvatting blijft onderscheiden van origineel.

**Specifieke acceptatie en te leveren bewijs:**

1. Een bezoeker zonder sessie opent alle drie documenten en herlaadt. → Alle publicaties bereikbaar met titel en versie; geen persoonsdata of bevoegde handeling ontsloten. Bewijs: scripts/lib/voltooi/juridisch.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:juridisch:ce04c515da384a5cbaf15769ea7b80d5fe7b5c5a1dc9714043ea513c9546f9d9`.
2. Een nieuwe publicatie staat als concept klaar. → Bezoeker blijft geldige versie zien; publicatie en instemming refereren exact die versie en nooit stil het concept. Bewijs: scripts/lib/voltooi/juridisch.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:juridisch:80558fe41ab6df93838c177ed8ec7524cbbc2420a6dd5dd875e4bcae7309fd2a`.

**Externe voorwaarden / besluiten:** Bevoegde juridische beoordeling van inhoud en toepasselijkheid per markt vereist; een browserproef is geen juridische acceptatie.


## WorkOS

### 70. RTG Werk OS - `link:werkos`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Command. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `os:werk`, `link:office`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/werk.html.

**Canonieke productbelofte:** een toegelaten medewerker opent zijn eigen WorkOS-werkruimte, maakt werk aan en vindt dat na een herstart, netwerkherhaling en crash precies een keer terug.

**Huidige implementatie, statisch onderzocht:** Werk OS heeft start, modules, acties, uitgaven en praktijkmodules. De proef meet één projecttaak, geen volledige bedrijfsmodules of multi-instance-uitval.

**Bronnen:** [public/apps/werk.html](../../public/apps/werk.html), [scripts/lib/voltooi/werkos.js](../../scripts/lib/voltooi/werkos.js), [public/apps/werk/kern.js](../../public/apps/werk/kern.js), [public/apps/werk/merk.js](../../public/apps/werk/merk.js), [public/apps/werk/start.js](../../public/apps/werk/start.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/werk.html` → `werk.organisatie` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een eenvoudige bedrijfswerkruimte met relevante taken per rol en harde tenantgrenzen.

**Benodigde wijzigingen:**

- Bestaande modulearchitectuur behouden; per toegezegde module taak-/rechtencontract vastleggen.
- Toelating, rol-/organisatiewissel, offboarding en productieherstel kwalificeren; PlanDossier gebruikt referenties zonder gezamenlijke bedrijfsdatatabel.

**Specifieke acceptatie en te leveren bewijs:**

1. Medewerker met twee organisaties wisselt tijdens taakbewerking. → Taak/concept blijven bij juiste tenant en rol; geen kopie naar andere organisatie en terugkeer behoudt context. Bewijs: scripts/lib/voltooi/werkos.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:werkos:b1bc90a2eddf8597b1992378045bc473ad7533336239750a6d6cca03467a65b7`.
2. Beheer trekt toegang in terwijl offline werk wacht en instantie uitvalt. → Wachtrij opnieuw geautoriseerd; geen late onbevoegde mutatie; herstel levert maximaal één toegestane taak. Bewijs: scripts/lib/voltooi/werkos.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:werkos:6718a39f2646701f1d71fc1406a17ef8dbb8aa35ad15696b4eea20dee5663ae4`.

**Externe voorwaarden / besluiten:** Gereguleerde bedrijfstypen houden beroeps-/vergunningsvoorwaarden; algemene WorkOS-toegang is geen beroepsvergunning.

### 71. RTG One - `link:rtgone`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Command. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:projectroom`, `link:decisionroom`, `link:rtmail`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/rtgone.html.

**Canonieke productbelofte:** een medewerker op naam legt beloften, bedoelingen en frictie vast in het werkgeheugen en rondt een belofte omkeerbaar af, en dat staat er na een herstart en een crash precies een keer.

**Huidige implementatie, statisch onderzocht:** RTG One gebruikt werkgeheugen, beloften, intenties, frictie en omkeerbare automatisering. De proef meet huis rtg, niet rtf/gedeeld.

**Bronnen:** [public/apps/rtgone.html](../../public/apps/rtgone.html), [scripts/lib/voltooi/rtgone.js](../../scripts/lib/voltooi/rtgone.js), [public/apps/rtgone-voorzijde-weergave.js](../../public/apps/rtgone-voorzijde-weergave.js), [public/apps/rtgone-voorzijde.js](../../public/apps/rtgone-voorzijde.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/rtgone.html` → `werk.rtgone` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een persoonlijke werkdag met concrete beloften, rustige prioriteit en gecontroleerde overdracht.

**Benodigde wijzigingen:**

- Bestaand werkgeheugen op taken/besluiten/projecten laten projecteren; geen tweede Decision Room.
- PlanDossier in bestaande voorbereiding/herstel verbinden; huizen en vervanging op actuele rollen en gegevensisolatie kwalificeren zonder mensenscore.

**Specifieke acceptatie en te leveren bewijs:**

1. Medewerker rondt af, herstelt binnen venster en draagt over. → Zelfde belofte-ID met spoor; vervanger ziet alleen expliciet overgedragen werkcontext. Bewijs: scripts/lib/voltooi/rtgone.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:rtgone:3d4a307db9429f984fbcfde22f9d0eb856b0821b41f77f2c213dbc8f2a57bcd3`.
2. Automatisering is voorbereid vóór rol-/huiswissel. → Oude context verleent geen recht; uitvoering opnieuw getoetst; verlopen venster belooft geen herstel. Bewijs: scripts/lib/voltooi/rtgone.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:rtgone:2169307dc51ff344c701de7feaf581822d82c33e3ab184b978f8e016a3c7c10c`.

**Externe voorwaarden / besluiten:** Geen aanvullend extern besluit benoemd; de bestaande toezegklasse en gemeenschappelijke scopepoort blijven gelden.

### 72. Decision Room - `link:decisionroom`

**Bouwcohort:** eerste twaalf, poort G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Command. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:rtgone`, `link:projectroom`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/decision-room.html.

**Canonieke productbelofte:** een medewerker legt een voorstel neer en mensen met de juiste rol beslissen het, nooit de aanvrager zelf en boven de drempel met twee stemmen.

**Huidige implementatie, statisch onderzocht:** De bron heeft agenda, afweging en besluitmodules. De proef meet finance in huis rtg, functiescheiding en twee stemmen; andere besluitgebieden vallen erbuiten.

**Bronnen:** [public/apps/decision-room.html](../../public/apps/decision-room.html), [scripts/lib/voltooi/decisionroom.js](../../scripts/lib/voltooi/decisionroom.js), [public/apps/decision-room-agenda.js](../../public/apps/decision-room-agenda.js), [public/apps/decision-room-afweging.js](../../public/apps/decision-room-afweging.js), [public/apps/decision-room-besluit.js](../../public/apps/decision-room-besluit.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/decision-room.html` → `werk.besluit` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een besluitruimte met onderbouwde opties, gevolgen en herleidbare uitvoering na geldige goedkeuring.

**Benodigde wijzigingen:**

- Bestaande besluitbron/rolregels houden; bewijsversies en domeinreferenties aan voorstel koppelen.
- Bekende/onzekere gevolgen tonen en alle toegezegde gebieden, huizen, drempels en herstelpaden kwalificeren.

**Specifieke acceptatie en te leveren bewijs:**

1. Aanvrager doet voorstel boven drempel; eerste beoordelaar verliest rol vóór tweede stem. → Aanvrager stemt niet mee; actuele rollen en drempelbeleid bepalen uitvoerbaarheid; oude stem verleent geen onrechtmatig akkoord. Bewijs: scripts/lib/voltooi/decisionroom.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:decisionroom:a81f3366d33d937f468554fb0a4c7a533b0f28cf2d33968352e50d47eb24dbf9`.
2. Na goedkeuring verandert bedrag of begunstigde en wordt uitvoering herhaald. → Oud akkoord dekt nieuwe inhoud niet; herbeoordeling vereist; geen dubbele uitvoering. Bewijs: scripts/lib/voltooi/decisionroom.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:decisionroom:020f4d4b830fad5e85d64fe923a80c8a573ace7a20ffc5c0d740612d0e83c484`.

**Externe voorwaarden / besluiten:** Geen aanvullend extern besluit benoemd; de bestaande toezegklasse en gemeenschappelijke scopepoort blijven gelden.

### 73. Project Room - `link:projectroom`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Command. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:rtmail`, `link:decisionroom`, `link:office`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/project-room.html.

**Canonieke productbelofte:** een medewerker voert een project dat uit een RTMAIL ontstond aantoonbaar uit, met taken, bewijs en een menselijke oplevering, en een collega wijzigt er niets aan.

**Huidige implementatie, statisch onderzocht:** De bron heeft uitvoering, dossier en oplevering. De proef start uit RTMAIL en verlangt bewijs/menselijke oplevering; besluitafhankelijke projecten horen bij Decision Room.

**Bronnen:** [public/apps/project-room.html](../../public/apps/project-room.html), [scripts/lib/voltooi/projectroom.js](../../scripts/lib/voltooi/projectroom.js), [public/apps/project-room-uitvoering.js](../../public/apps/project-room-uitvoering.js), [public/apps/project-room-dossier.js](../../public/apps/project-room-dossier.js), [public/apps/project-room-oplevering.js](../../public/apps/project-room-oplevering.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/project-room.html` → `werk.project` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een uitvoeringsdossier met taken, besluiten, afhankelijkheden en versiegebonden opleverbewijs.

**Benodigde wijzigingen:**

- Bestaande rtgone-projectbron behouden en documenten/mail/besluiten refereren.
- Scopewijziging, overdracht, gedeeltelijke oplevering en heropenen kwalificeren met rol- en bewijsversiecontrole.

**Specifieke acceptatie en te leveren bewijs:**

1. Project uit mail vereist akkoord en wordt met bewijs opgeleverd. → Geen stap buiten geldig akkoord; oplevering noemt menselijke actor, bewijsversies en uitkomst, niet alleen taakpercentage. Bewijs: scripts/lib/voltooi/projectroom.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:projectroom:cfa2265875650e70bfd3b98bb011157dfa64bf1750558a24eda6f87d43de8d3f`.
2. Bewijs verandert en onbevoegde collega probeert op te leveren tijdens overdracht. → Oude claim opnieuw beoordeeld; collega kan niet opleveren; overdracht behoudt spoor en voorkomt dubbel eigenaarschap. Bewijs: scripts/lib/voltooi/projectroom.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:projectroom:753850e181de7ee5d5c7e484b4c913d57aeb102725ec2677105daf94fd9ba19c`.

**Externe voorwaarden / besluiten:** Geen aanvullend extern besluit benoemd; de bestaande toezegklasse en gemeenschappelijke scopepoort blijven gelden.

### 74. RTMail - `link:rtmail`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Salon. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:projectroom`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/rtmail.html.

**Canonieke productbelofte:** een lid verstuurt binnen RTG een bericht naar een ander lid, dat het ongelezen in zijn postvak op codenaam ziet en leest; andermans post is niet te lezen.

**Huidige implementatie, statisch onderzocht:** RTMail heeft gesprek, compose, instellingen en werkmodules. De proef meet interne post op codenaam; teams, planning en externe aflevering vallen erbuiten.

**Bronnen:** [public/apps/rtmail.html](../../public/apps/rtmail.html), [scripts/lib/voltooi/rtmail.js](../../scripts/lib/voltooi/rtmail.js), [public/apps/rtmail-instellingen.js](../../public/apps/rtmail-instellingen.js), [public/apps/rtmail-voorzijde-werk.js](../../public/apps/rtmail-voorzijde-werk.js), [public/apps/rtmail-voorzijde-gesprek.js](../../public/apps/rtmail-voorzijde-gesprek.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/rtmail.html` → `comm.mail` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een premium werkpostvak met heldere ontvangers, veilige concepten en controleerbare taakoverdracht.

**Benodigde wijzigingen:**

- Bestaande mail-/contactbron behouden; inbox, gesprek, concept en taakreferentie consistent tonen.
- Teams, aliassen, planning en workflows met menselijke bevestiging kwalificeren; aflevering, bijlageveiligheid en herstel onderscheiden.

**Specifieke acceptatie en te leveren bewijs:**

1. Lid kiest ontvanger en bevestigt tweemaal bij trage verbinding. → Precies één bericht; afzender/ontvanger consistente status; zonder ontvanger of bevestiging geen verzending. Bewijs: scripts/lib/voltooi/rtmail.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:rtmail:8380a54c223ba9db317e92538d7ccd792a71c1402539db8056ee6351005a0998`.
2. Gepland bericht wacht terwijl teamrecht en bijlagetoegang vervallen. → Uitvoering hercontroleert en blokkeert of vraagt herstel; geen verzending met verouderde bevoegdheid. Bewijs: scripts/lib/voltooi/rtmail.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:rtmail:b6db559437d8d9eac9aca0bd89fd4f9ed6a23f2e2c8976ea982e81d1a677533d`.

**Externe voorwaarden / besluiten:** Publieke e-mail vraagt expliciet productbesluit, provider-/domeininrichting, misbruikbeleid en aflever-/bouncebewijs.

### 75. Magnaat - `link:magnaat`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Spatial. **Budgetverwijzing:** realtime → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** geen aanvullende taakafhankelijkheid benoemd. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/magnaat.html.

**Canonieke productbelofte:** een lid pakt een dossier uit zijn dagdienst op, opent het juiste RTG-scherm en beantwoordt de keuzes; wat hij verdient blijft van hem en telt een keer.

**Huidige implementatie, statisch onderzocht:** De bron biedt trainingswereld en dagdienst. De proef meet keuzedossiers/leeftijdsgrens, niet teamkamer, economie, controlekamer, partnertraining of Oudwijk.

**Bronnen:** [public/apps/magnaat.html](../../public/apps/magnaat.html), [scripts/lib/voltooi/magnaat.js](../../scripts/lib/voltooi/magnaat.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/magnaat.html` → `spel.magnaat` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een realistische geïsoleerde oefenwereld met reproduceerbare scenario's en eerlijk bewijsbereik.

**Benodigde wijzigingen:**

- Bestaande sandbox/adapters behouden: simulatie vervangt rail, nooit productpoort.
- Toegezegde modi met seed, foutinjectie en versieherkomst kwalificeren; oefenfeedback scheiden van competitie en releasebewijs.

**Specifieke acceptatie en te leveren bewijs:**

1. Simulatie probeert actie waarvoor gebruiker normaal onbevoegd is. → Dezelfde autorisatie weigert; geen testvlag omzeilt poort; nul echte externe effecten. Bewijs: scripts/lib/voltooi/magnaat.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:magnaat:49e60f7d258da083f206c16a605907d7a85edeaabdac0244185db78586be5030`.
2. Niet-A3/18+-speler voltooit dossier; crash en herhaling volgen. → Spel blijft speelbaar, geen blijvende competitieve score; toegestane oefenstatus of volwassenbeloning niet dubbel. Bewijs: scripts/lib/voltooi/magnaat.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:magnaat:28be088cc2a6d5e84e9d1bb7a0628b35138bf86afdf56d0d05457969497fd824`.

**Externe voorwaarden / besluiten:** Magnaat bewijst uitsluitend gedeclareerd experiment; release vraagt onafhankelijke keten-, veiligheids- en menselijke acceptatie.

### 76. RTDocs - `link:office`

**Bouwcohort:** eerste twaalf, poort G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Atelier. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** geen aanvullende taakafhankelijkheid benoemd. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/office.html.

**Canonieke productbelofte:** een medewerker maakt een document in de kantoordrive, bewaart met versies en zet een versie terug; een oud venster schrijft er niet overheen en een zaak of lid komt er niet bij.

**Huidige implementatie, statisch onderzocht:** RTDocs bevat tekst, blad, presentatie, formulier, schets en bord. De proef meet tekst in kantoordrive, niet overige vier drives of export/delen.

**Bronnen:** [public/apps/office.html](../../public/apps/office.html), [scripts/lib/voltooi/office.js](../../scripts/lib/voltooi/office.js), [public/apps/office/bladpro.js](../../public/apps/office/bladpro.js), [public/apps/office/bladreeks.js](../../public/apps/office/bladreeks.js), [public/apps/office/bladgrafiek.js](../../public/apps/office/bladgrafiek.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/office.html` → `docs.office` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een volwaardige rustige productiviteitservaring met betrouwbare bewerking, samenwerking, versieherstel en uitwisseling.

**Benodigde wijzigingen:**

- Bestaande editors/vijf drives behouden met één documentidentiteit, rechtenbron en versiecontract.
- Alle documentvormen kwalificeren op inhoudsbehoud/export/toegankelijkheid; offline, review en conflicten afwerken; AI levert herzienbare voorstellen.

**Specifieke acceptatie en te leveren bewijs:**

1. Twee gebruikers bewerken document; oudere client bewaart na nieuwere revisie. → Geen stille overschrijving; bijdragen herstelbaar, versies herleidbaar en export gelijk aan gekozen revisie. Bewijs: scripts/lib/voltooi/office.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:office:41501cd9a3180e31701db562fbe91a7a2b83fadb73654f16a927e7fece8ada12`.
2. Gevoelig kantoordocument wordt via deel-link in leden-/zaakcontext gevraagd. → Drive-/tenantrechten gelden; geen inhoud, thumbnail of zoekfragment lekt; intrekking stopt nieuwe export en AI-context. Bewijs: scripts/lib/voltooi/office.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:office:fccdc8590bfe349763761c0f1c25d67e7010566d6a299aacee0845516a300ce8`.

**Externe voorwaarden / besluiten:** Formaatcompatibiliteit/externe samenwerking vraagt expliciete ondersteunde matrix; geen universele Office-compatibiliteit zonder fixtures.

### 77. Werk - `os:werk`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Command. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:werkos`, `link:rtgone`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** kiezer in de app.

**Canonieke productbelofte:** een lid opent zijn werk met zijn eigen account, in de rollen die er werkelijk aan hangen, en een rol die hij niet heeft opent niets.

**Huidige implementatie, statisch onderzocht:** Werkkiezer gebruikt account/rollen en account/start. De proef loopt routes, niet tegelbediening, zaakrol of productie-passkeyuitnodiging.

**Bronnen:** [public/apps/app.html](../../public/apps/app.html), [scripts/lib/voltooi/werk.js](../../scripts/lib/voltooi/werk.js), [public/apps/foundation/gezin-rt.js](../../public/apps/foundation/gezin-rt.js), [public/apps/access/meaning.js](../../public/apps/access/meaning.js), [public/apps/app-main.js](../../public/apps/app-main.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/app.html` → `kern.app` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Voorspelbare werktoegang vanuit één account naar juiste organisatie en rol zonder contextverwarring.

**Benodigde wijzigingen:**

- Bestaande rol-/startbron als enige ingang houden; organisatie vóór openen duidelijk tonen.
- Personeel/kantoor/zaak, uitnodiging, intrekking en productie-passkeypad kwalificeren; privé-werkovergang zonder datadoorgifte.

**Specifieke acceptatie en te leveren bewijs:**

1. Lid kiest elk van personeel-, kantoor- en zaakrol. → Elke keuze opent bedoelde bestaande context; geen algemene PIN of rolnaam geeft extra rechten. Bewijs: scripts/lib/voltooi/werk.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:os:werk:c6c76a3fcd840bbd277b43fab4a322bc114c21b8916a72e21708007cd6efec02`.
2. Rol wordt ingetrokken terwijl oude tegel open staat. → Start controleert actuele rol en weigert; andere geldige contexten blijven beschikbaar zonder privé-/werklek. Bewijs: scripts/lib/voltooi/werk.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:os:werk:12043a30f4bf4f37b7957db352f2349fe401c1df5e6fe09a68a87e73f9b12990`.

**Externe voorwaarden / besluiten:** Geen aanvullend extern besluit benoemd; de bestaande toezegklasse en gemeenschappelijke scopepoort blijven gelden.

### 78. Onderneming - `link:onderneming`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Command. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:werkos`, `link:office`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/onderneming.html.

**Canonieke productbelofte:** een ondernemer begint met een werktitel, kiest een rechtsvorm, werkt de oprichting af en schrijft zich in, en dat staat precies een keer op zijn naam.

**Huidige implementatie, statisch onderzocht:** Bron heeft idee, rechtsvorm, oprichting, verkenning, aanvraag en werkruimte. De proef meet vóór-zaakfase; KvK-invoer wordt niet extern gecontroleerd.

**Bronnen:** [public/apps/onderneming.html](../../public/apps/onderneming.html), [scripts/lib/voltooi/onderneming.js](../../scripts/lib/voltooi/onderneming.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/onderneming.html` → `werk.onderneming` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een ondernemingsdossier met begrijpelijke fasen en zichtbare juridische/financiële onzekerheid.

**Benodigde wijzigingen:**

- Bestaande bron via scoped referenties aan oprichtingsdocumenten/werkruimte koppelen.
- Eigen inschrijving en gecontroleerd bewijs onderscheiden; aanvraag, bestaande-zaakkoppeling en rolruimte kwalificeren; cijfers hebben aannames/zekerheidsklasse.

**Specifieke acceptatie en te leveren bewijs:**

1. Ondernemer legt eigen KvK-invoer vast en vraagt zaakkoppeling. → Eén eigen dossier; invoer niet extern geverifieerd genoemd; koppeling vereist bevoegde goedkeuring. Bewijs: scripts/lib/voltooi/onderneming.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:onderneming:32afa60f8062dac5443c2944cab82c0819a0aa3beeea712b66a39a42066a81c8`.
2. Andere ondernemer probeert zaak te koppelen tijdens hervatten. → Tenant-/eigenaarsgrens blokkeert; hervatten maakt geen dubbele onderneming of rol. Bewijs: scripts/lib/voltooi/onderneming.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:onderneming:75ecf87e208fc40201b0676e98428013894cbf12158477e6f48cf5b6c619a37f`.

**Externe voorwaarden / besluiten:** Externe inschrijving, rechtsvormadvies en registerverificatie vragen scopebesluit, bevoegde partijen en dataovereenkomst.

### 79. Loon - `link:loonstrook`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Ledger. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:werkos`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/loonstrook.html.

**Canonieke productbelofte:** een medewerker ziet zijn eigen loonstrook met uitleg en dossier, en een ander lid ziet hem niet.

**Huidige implementatie, statisch onderzocht:** Scherm leest eigen stroken, dossier en inzage. De proef gebruikt ongecontroleerde Nederlandse tabellen; juiste bedragen, aangifte en betaling worden niet bewezen.

**Bronnen:** [public/apps/loonstrook.html](../../public/apps/loonstrook.html), [scripts/lib/voltooi/loonstrook.js](../../scripts/lib/voltooi/loonstrook.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/loonstrook.html` → `loon.strook` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een begrijpelijk loondossier met herleidbare berekening, periode en correcties.

**Benodigde wijzigingen:**

- Bestaande loonrun toont gebruikte tabellen/invoer en fiscale zekerheidsklasse.
- Correctiestrook, vragen, export en inzage aan oorspronkelijke periode koppelen; werknemer-/werkgever-/tenantisolatie kwalificeren.

**Specifieke acceptatie en te leveren bewijs:**

1. Medewerker opent strook uit gecontroleerde of ongecontroleerde jaargang. → Juiste status/herkomst zichtbaar; ongecontroleerd heet niet fiscaal gevalideerd; netto traceerbaar tot regels/invoer. Bewijs: scripts/lib/voltooi/loonstrook.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:loonstrook:e6d5012dde8cab0ac5e574ad316a220279e9dc0dba27e1236557eea5eb0fbd8a`.
2. Correctie verschijnt terwijl oude strook open is; collega vraagt dossier. → Oude versie blijft met correctieverwijzing herleidbaar; collega krijgt geen looninhoud; export vermeldt juiste periode/versie. Bewijs: scripts/lib/voltooi/loonstrook.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:loonstrook:38283a6cfc9258513b7b500b9fc1e633642a01b227fc2806cbcc01a488112859`.

**Externe voorwaarden / besluiten:** Tabellen, arbeids-/fiscale interpretatie, aangifte en uitbetaling vragen onafhankelijke vakvalidatie en bevoegde rails.

### 80. School - `link:school`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Library. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** geen aanvullende taakafhankelijkheid benoemd. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/rtgschool.html.

**Canonieke productbelofte:** een lid oefent een examen zoals bij een echt examen en krijgt aan het eind een terugblik en een oefenindicatie die geen echt cijfer is.

**Huidige implementatie, statisch onderzocht:** School heeft leer-, examen- en bijlesmodules. De proef meet tienvragenoefening/continuïteit, geen leerstofjuistheid of modelbijles.

**Bronnen:** [public/apps/rtgschool.html](../../public/apps/rtgschool.html), [scripts/lib/voltooi/school.js](../../scripts/lib/voltooi/school.js), [public/apps/rtgschool/leer.js](../../public/apps/rtgschool/leer.js), [public/apps/rtgschool/examen.js](../../public/apps/rtgschool/examen.js), [public/apps/rtgschool/bijles.js](../../public/apps/rtgschool/bijles.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/rtgschool.html` → `leren.school` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een pedagogisch verantwoorde leerervaring met individuele feedback en veilige voortgang.

**Benodigde wijzigingen:**

- Oefeningen/examens voorzien van inhoudsversie en bron; examenmodus onderscheiden van begeleid oefenen.
- Bijles, modelvrije terugval en persoonlijk leerdossier kwalificeren zonder competitieve rangschikking of blijvend vergelijkend niveau.

**Specifieke acceptatie en te leveren bewijs:**

1. Leerling onderbreekt examen en gaat op ander toestel verder. → Zelfde vraag/antwoorden; geen tussentijdse beoordeling in examenmodus; elk antwoord telt maximaal eenmaal. Bewijs: scripts/lib/voltooi/school.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:school:854c08ebb1ec9402b2020aef45d0b99ff284804005320fb13eb69af9bce4dd5c`.
2. Minderjarige vraagt bijles terwijl model ontbreekt of leerstof fout blijkt. → Handmatige terugval en meldroute; geen officieel cijfer/persoonsranglijst; correctie is versieerbaar en inhoudelijk beoordeeld. Bewijs: scripts/lib/voltooi/school.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:school:c368a5feb5ba5ae9fbe47100c052a0f7df1dc7fc0dd6f04c6489358abafff139`.

**Externe voorwaarden / besluiten:** Leerstof, voorbeelden en pedagogische veiligheid vragen bevoegde review/gebruiksrechten; softwaretest bewijst geen onderwijskwaliteit.

### 81. Web - `link:browser`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Library. **Budgetverwijzing:** browse → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:sitemaker`, `link:berichten`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/browser.html.

**Canonieke productbelofte:** een lid vindt en opent de site van een ander lid en stuurt via het formulier een bericht dat precies een keer als gesprek aankomt, alleen tussen verbonden leden.

**Huidige implementatie, statisch onderzocht:** Web gebruikt RTG-sitegids, zoeken, openen en bericht. De proef meet interne sites/formulieren, geen algemene externe webbrowser.

**Bronnen:** [public/apps/browser.html](../../public/apps/browser.html), [scripts/lib/voltooi/browser.js](../../scripts/lib/voltooi/browser.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/browser.html` → `web.browser` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een veilige ontdek- en bezoekervaring voor gepubliceerde RTG-sites met duidelijke contactstatus.

**Benodigde wijzigingen:**

- Bestaande sitepublicatie en browser op dezelfde gepubliceerde versie laten wijzen.
- Formulier als menselijke aanvraag kwalificeren met ontvangergrens/herhaalsleutel; zoeken, terugkeer en vertaling op toegankelijkheid/injectie toetsen.

**Specifieke acceptatie en te leveren bewijs:**

1. Bezoeker vindt site en verstuurt formulier aan verbonden maker. → Alleen gepubliceerde inhoud; precies één gesprek na bevestiging; geen reserveringsbevestiging zonder domeinbewijs. Bewijs: scripts/lib/voltooi/browser.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:browser:b3081c963e8f4a8310f91b1015814578de8d6bed43755d71c339cef1ee96612b`.
2. Niet-verbonden bezoeker verstuurt; maker haalt site offline tijdens openen. → Geen ongeoorloofde bezorging; nieuwe openactie toont offline; geen conceptinhoud in foutstatus. Bewijs: scripts/lib/voltooi/browser.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:browser:008d5abb6b727f30ffdb5699f42a5e96c144991dc64f6ddfb338a4c7a96b1463`.

**Externe voorwaarden / besluiten:** Willekeurige externe websites ondersteunen is nieuwe scope met sandbox-/privacybesluit; bestaande ingang mag dit niet suggereren.

### 82. Website - `link:sitemaker`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Atelier. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:browser`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/sitemaker.html.

**Canonieke productbelofte:** een lid bouwt een eigen website, zet hem online en bepaalt zelf wanneer een wijziging naar buiten gaat, en een ander lid komt er niet aan.

**Huidige implementatie, statisch onderzocht:** De bron heeft sjablonen, concept, versieherstel en publicatie. De proef meet één bloksite, niet zaaksites, media, AI, planning of eigen domein.

**Bronnen:** [public/apps/sitemaker.html](../../public/apps/sitemaker.html), [scripts/lib/voltooi/sitemaker.js](../../scripts/lib/voltooi/sitemaker.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/sitemaker.html` → `werk.website-maker` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een hoogwaardige site-editor voor toegankelijke sites met bewuste preview, publicatie en herstel.

**Benodigde wijzigingen:**

- Persoonlijke/zakelijke bron behouden met versiegebonden preview en afzonderlijke livepublicatie.
- Blokken/mediarechten/formulieren/responsiveweergave kwalificeren; planning, rollback en intrekken herautoriseren; AI blijft inspecteerbaar concept.

**Specifieke acceptatie en te leveren bewijs:**

1. Maker bewaart livewijziging als concept en publiceert later. → Tot publicatie oude versie; daarna atomair gekozen revisie; rollback laat geen mix van assets achter. Bewijs: scripts/lib/voltooi/sitemaker.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:sitemaker:393cb6efde611d8d996afab9086f5469432910d90aa25f29bd29ee980f9021a7`.
2. Publicatie wacht terwijl recht vervalt of foto wordt ingetrokken. → Poort hercontroleert rechten/media; geen ongeoorloofde livegang; concept herstelbaar met concrete reden. Bewijs: scripts/lib/voltooi/sitemaker.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:sitemaker:9493af3abea1635b9ef7c6001f8a3a6da03db26b86b4fe5f3f7d989b178f0e5e`.

**Externe voorwaarden / besluiten:** Eigen domeinen/externe hosting en distributierechten vragen ondersteunde scope en providerinrichting.

### 83. Horeca - `link:horeca`

**Bouwcohort:** eerste twaalf, poort G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Command. **Budgetverwijzing:** realtime → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:aankomst`, `link:pay`, `link:table`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/horeca.html.

**Canonieke productbelofte:** een zaak bedient een tafel van rekening openen tot afrekenen, en een offline opgenomen bestelling komt precies een keer binnen.

**Huidige implementatie, statisch onderzocht:** Horeca heeft zaal, keuken, rekening, gast- en arrival/spatialmodules. De proef meet tafel-tot-afrekenen/offline order; pin is registratie, geen echte rail.

**Bronnen:** [public/apps/horeca.html](../../public/apps/horeca.html), [scripts/lib/voltooi/horeca.js](../../scripts/lib/voltooi/horeca.js), [public/apps/horeca/kern.js](../../public/apps/horeca/kern.js), [public/apps/horeca/edge.js](../../public/apps/horeca/edge.js), [public/apps/horeca/gezelschap.js](../../public/apps/horeca/gezelschap.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/horeca.html` → `horeca.dashboard` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een rustige rolgerichte gast- en bedrijfsservice van aankomst tot rekening en herstel.

**Benodigde wijzigingen:**

- Bestaande zaal-, keuken-, rekening- en arrivalbronnen met één taakcontext verbinden en per rol projecteren.
- Offline order, verplaatsing, splitsen en correctie kwalificeren; betaalregistratie onderscheiden van railbewijs en dieetcontext minimaal delen.

**Specifieke acceptatie en te leveren bewijs:**

1. Medewerker neemt offline twee orders op terwijl zaal het tafelplan wijzigt. → Iedere order precies eenmaal; conflict heeft herstelkeuze; geen verkeerde tafel of tenant krijgt bon. Bewijs: scripts/lib/voltooi/horeca.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:horeca:ef905c36a56d3e9e3144745a3299d926021e4f7eadfa8682bc48a7e979ac91a5`.
2. Rekening wordt gesplitst; pin krijgt geen providerbevestiging. → Delen tellen exact tot verschuldigd bedrag; onbekende betaling sluit rekening niet als betaald en herhalen schrijft niet dubbel af. Bewijs: scripts/lib/voltooi/horeca.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:horeca:c27a72edc44acf8ea69d326c218189a821fa63b75517de2a4d9504878c9aff05`.

**Externe voorwaarden / besluiten:** Echte betaalrail/-terminal en allergeneninformatie vragen leverancierskoppeling en operationele inhoudseigenaar.

### 84. Partner Network - `link:partnernetwerk`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Command. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:mall`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/partner-network.html.

**Canonieke productbelofte:** een partnerzaak ziet de vragen van leden die bij haar passen, haar beloften en wat aandacht vraagt, met bij elk getal zijn bron, en antwoordt op een vraag.

**Huidige implementatie, statisch onderzocht:** Partner Network projecteert overzicht en vraagantwoorden. De proef telt conciërge/samenwerkingen zonder hun volledige ketens te maken.

**Bronnen:** [public/apps/partner-network.html](../../public/apps/partner-network.html), [scripts/lib/voltooi/partnernetwerk.js](../../scripts/lib/voltooi/partnernetwerk.js), [public/apps/partner-network.js](../../public/apps/partner-network.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/partner-network.html` → `zaak.partnernetwerk` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een partnercockpit met bronvaste vragen, beloften, capaciteit en opvolging per eigen organisatie.

**Benodigde wijzigingen:**

- Bestaande Mall-/conciërge-/samenwerkingsreferenties gebruiken zonder tweede CRM-bron.
- Vraag, antwoord, afspraak en afhandeling onderscheiden; onbekende capaciteit tonen en elk toegezegd partnertype met meeractorfixtures kwalificeren.

**Specifieke acceptatie en te leveren bewijs:**

1. Lid stelt vraag, juiste partner antwoordt en andere zaak opent ID. → Precies één antwoord bij lid; andere zaak geen inhoud; tellingen volgen dezelfde bronreferentie. Bewijs: scripts/lib/voltooi/partnernetwerk.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:partnernetwerk:9b111d24afb77cf859f91e9810b0e888747f607c4a5685a1fdd29d6e80763980`.
2. Partner verliest rol met voorbereid antwoord en herstart. → Geen automatische verzending; verse autorisatie blokkeert waar nodig; concept blijft onderscheiden van verzonden. Bewijs: scripts/lib/voltooi/partnernetwerk.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:partnernetwerk:8f922144d4365e569e19a94b76247f021e965571369990797541dc760721c0c6`.

**Externe voorwaarden / besluiten:** Nieuwe netwerken/commerciële prestatieclaims vragen contracten en brondata; nul blijft verschillend van niet gemeten.

### 85. Mijn team - `link:vertegenwoordiging`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Ceremony. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** geen aanvullende taakafhankelijkheid benoemd. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/vertegenwoordiging.html.

**Canonieke productbelofte:** een lid bepaalt zelf wie namens hem mag handelen, met een eigen grens, simulatie vooraf, spoor en intrekken per direct.

**Huidige implementatie, statisch onderzocht:** De bron heeft eigen grens, simulatie, aanvaarden en intrekken. De proef sluit voogdij en bedragplafonds uit en gebruikt A3-cliënt.

**Bronnen:** [public/apps/vertegenwoordiging.html](../../public/apps/vertegenwoordiging.html), [scripts/lib/voltooi/vertegenwoordiging.js](../../scripts/lib/voltooi/vertegenwoordiging.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/vertegenwoordiging.html` → `mandaat.beheer` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een begrensd team waarin de gebruiker vooraf begrijpt wat een ander mag en elke uitvoering opnieuw wordt getoetst.

**Benodigde wijzigingen:**

- Bestaande vertegenwoordiging/Authority als machtsbron; PlanDossier verwijst naar scope/persoon.
- Duur, bedrag, handeling, organisatie en eigen verbod gezamenlijk toetsen; voogd-/jeugdsituatie afzonderlijk kwalificeren.

**Specifieke acceptatie en te leveren bewijs:**

1. Vertegenwoordiger vraagt meer dan eigen grens en probeert boven plafond. → Voorvertoning toont uitgesloten bereik; aanvaarding verruimt verbod niet; uitvoering server-side geweigerd met spoor. Bewijs: scripts/lib/voltooi/vertegenwoordiging.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:vertegenwoordiging:6bd12f4651dcb9c16622a0738ee806beb2f08b82b7da376b43aaac3a0591942a`.
2. Gebruiker trekt in na voorbereiding maar vóór uitvoering. → Uitvoering hercontroleert en blokkeert; herhaling of open sessie herstelt bevoegdheid niet. Bewijs: scripts/lib/voltooi/vertegenwoordiging.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:vertegenwoordiging:df6a78bb086be28c43c0c41f4279f6c6afe9162dce706fafafcd12a303fd55cb`.

**Externe voorwaarden / besluiten:** Juridische vertegenwoordiging, voogdij en uitbetaling aan vertegenwoordigers vragen geldende besluiten en vaktoets.

### 86. Mijn loopbaan - `link:loopbaan`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Library. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** geen aanvullende taakafhankelijkheid benoemd. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/loopbaan.html.

**Canonieke productbelofte:** een lid schrijft feiten in een ledger dat niets wist, trekt er een terug met reden, en deelt een feit met een code die hij weer stopzet.

**Huidige implementatie, statisch onderzocht:** De ingang gebruikt carrièreledger en concern/mijnwerk. De proef meet eigen feiten, intrekking en deelcode, geen bevestiging door een andere partij.

**Bronnen:** [public/apps/loopbaan.html](../../public/apps/loopbaan.html), [scripts/lib/voltooi/loopbaan.js](../../scripts/lib/voltooi/loopbaan.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/loopbaan.html` → `loopbaan.ledger` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een persoonlijk loopbaandossier met herkomst en tijdelijk deelbare feiten zonder persoonsrangorde.

**Benodigde wijzigingen:**

- Append-only ledger behouden; zelf gezegd, gezien en bevestigd onderscheiden.
- Selectie, deelcode, verloop en intrekking kwalificeren; tweede-partijbevestiging binnen bestaand contract afbouwen zonder Career-object of mensenscore.

**Specifieke acceptatie en te leveren bewijs:**

1. Gebruiker deelt één feit en bevoegde tweede partij bevestigt herkomst. → Ontvanger ziet uitsluitend selectie met juiste herkomstklasse; bevestiging wist oorspronkelijke verklaring niet. Bewijs: scripts/lib/voltooi/loopbaan.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:loopbaan:35612c600888540d72a5b83927bd50254fce88fe7023c65368971c40c80edc81`.
2. Feit en deelcode worden ingetrokken; ontvanger herlaadt. → Intrekking blijft in eigen ledger met reden; code ontsluit geen nieuwe inhoud en herstart maakt hem niet geldig. Bewijs: scripts/lib/voltooi/loopbaan.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:loopbaan:268af8f5ca569a0d62c996dbf6268a50847d868d760530d9e9c7d0692a9805ed`.

**Externe voorwaarden / besluiten:** Externe kwalificatie/erkenning alleen geverifieerd noemen met bevoegd herleidbaar bewijs.


## TravelOS

### 87. Reizen - `tab:reizen`

**Bouwcohort:** eerste twaalf, poort G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Journey. **Budgetverwijzing:** transaction → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:reisboek`, `link:vluchten`, `link:move`, `link:pay`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/app.html (stand reizen).

**Canonieke productbelofte:** de reistab toont het dagprogramma van de reis en de autoshowroom: het lid vraagt een proefrit aan die de zaak inplant, doet een bod, en tekent het koopcontract zodra de zaak aanvaardt.

**Huidige implementatie, statisch onderzocht:** De reistab-proef omvat dagprogramma, autoshowroom, proefrit, bod en contract. Zij bewijst geen volledige reiswens-naar-boeking; app-hoofdstatus en aflevering vallen erbuiten.

**Bronnen:** [public/apps/app.html](../../public/apps/app.html), [scripts/lib/voltooi/reistab.js](../../scripts/lib/voltooi/reistab.js), [public/apps/app-main/app-main-18.js](../../public/apps/app-main/app-main-18.js), [public/apps/app-main.js](../../public/apps/app-main.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/app.html` → `kern.app` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een eenvoudige TravelOS-ingang met actueel reisplan en volgende beslisbare stap boven bestaande eigenaren.

**Benodigde wijzigingen:**

- Tab uit bestaande reis-/dagprogrammaprojecties componeren; geen nieuwe journeys-tabel.
- Wens via bestaande stuur/broker voorbereiden in PlanDossier met ontbrekende informatie en bevestigingen; showroombelofte traceerbaar bij haar eigenaar houden.

**Specifieke acceptatie en te leveren bewijs:**

1. Een reiziger vraagt een meerstappenreis; één aanbieder geeft geen actuele prijs. → Elk onderdeel toont bron en onzekerheid; geen totale bevestigde prijs of boeking zonder bewijs. Bewijs: scripts/lib/voltooi/reistab.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:tab:reizen:9cd766d9928c39a694c0e1b4b83f1ec71c9aa476e97981446b51c668ae296059`.
2. Bevestigde wijziging raakt programma/documenten terwijl gebruiker herlaadt. → Projecties gebruiken dezelfde domeinreferenties; afwijkingen en herstel zichtbaar; geen dubbele reservering of betaling. Bewijs: scripts/lib/voltooi/reistab.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:tab:reizen:ccfef49dd035f679b66f5360217db332a176bec619b46bccef4013153ccdd6bb`.

**Externe voorwaarden / besluiten:** Commerciële reisdiensten vragen werkelijk bevoegde aanbieders en contracten; demo-autoverkoop is geen echte levering.

### 88. Reizen & Veilig - `link:reizen`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Journey. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:relaties`, `link:reisboek`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/reizen-veilig.html.

**Canonieke productbelofte:** een lid deelt een Moment rond een reis met wie hij kiest, op het niveau dat hij kiest, de ontvanger ziet de voortgang, en na een pauze of stop niets meer.

**Huidige implementatie, statisch onderzocht:** Het scherm combineert reisaanbodprojectie en vrijwillige Moment-deling. De proef meet contactdeling/pauze/stop, geen locatie, bedrijvenontvanger of tijdsverval.

**Bronnen:** [public/apps/reizen-veilig.html](../../public/apps/reizen-veilig.html), [scripts/lib/voltooi/reizen.js](../../scripts/lib/voltooi/reizen.js), [public/apps/reizen-veilig-reis.js](../../public/apps/reizen-veilig-reis.js), [public/apps/reizen-veilig.js](../../public/apps/reizen-veilig.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/reizen-veilig.html` → `reizen.veilig` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een reisveiligheidslaag waarin exact zichtbaar is wat met wie wordt gedeeld en wanneer het stopt.

**Benodigde wijzigingen:**

- Bestaande deelstatus en reisaanbod gescheiden bronprojecties laten blijven; geen nieuw generiek Moment-model.
- Locatieniveaus, pauze, verval en bedrijvenontvanger kwalificeren; laatste bekende status onderscheiden van actuele aanwezigheid.

**Specifieke acceptatie en te leveren bewijs:**

1. Reiziger deelt alleen voortgang met contact en pauzeert. → Ontvanger ziet geen locatie op dit niveau; na pauze geen nieuwe inhoud, ook niet via open stream. Bewijs: scripts/lib/voltooi/reizen.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:reizen:80c24ac7ed534e90c974fa36c24c210ff2304387ea0219b0e9864e90ac1a7f5d`.
2. Deelperiode verloopt offline; gebruiker komt later online. → Toestemming herleeft niet; laatste bevestigde status/tijd herkenbaar; hervatten vraagt juiste expliciete keuze. Bewijs: scripts/lib/voltooi/reizen.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:reizen:5de989e2caae3d5e6a1c1039dfcf2ef19b7a79c0595d43a0765045d9d2b270a4`.

**Externe voorwaarden / besluiten:** Professionele veiligheid/noodhulp vereist beschikbare uitvoerder en verantwoordelijkheid; vrijwillige statusdeling is geen gegarandeerde hulpverlening.

### 89. Ter plaatse - `tab:terplaatse`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Journey. **Budgetverwijzing:** transaction → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:pay`, `link:aankomst`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/app.html (stand terplaatse).

**Canonieke productbelofte:** ter plaatse huurt het lid een auto tegen een vaste dagprijs, betaalt vooraf, deelt vrijwillig zijn locatie, en tekent of weigert het huurcontract dat de zaak opstelt.

**Huidige implementatie, statisch onderzocht:** De proef meet autohuur, betaling, locatie en contract. Tickets, transfer, charter, vastgoed, bezorgen, uitgifte en SOS op dezelfde tab worden niet bewezen.

**Bronnen:** [public/apps/app.html](../../public/apps/app.html), [scripts/lib/voltooi/terplaatse.js](../../scripts/lib/voltooi/terplaatse.js), [public/apps/app-main/app-main-15.js](../../public/apps/app-main/app-main-15.js), [public/apps/app-main/app-main-16.js](../../public/apps/app-main/app-main-16.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/app.html` → `kern.app` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een contextuele ter-plaatsescène met relevante beschikbare diensten en compleet dossier per taak.

**Benodigde wijzigingen:**

- Bestaande huurder-, ticket-, transfer- en overige domeinprojecties met eigen beschikbaarheidsgrens componeren.
- Huur tot uitgifte/inname en eventuele schadeafhandeling kwalificeren; overige tabbelofte apart meten, locatie optioneel houden.

**Specifieke acceptatie en te leveren bewijs:**

1. Lid huurt, tekent en zaak registreert uitgifte/inname. → Zelfde huur-ID verbindt beschikbaarheid, contract en betaalbewijs; schade is gecontroleerd verzoek, geen automatische afschrijving. Bewijs: scripts/lib/voltooi/terplaatse.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:tab:terplaatse:4d164e9b2491a0aafcc8e7d727434ad97693d103f3857b083e72abb1ec575adf`.
2. Tweede lid kiest overlappende periode; eerste herlaadt na betaling. → Overlap server-side geweigerd; eerste hervat zonder dubbele betaling; niet-bewezen uitgifte blijft open. Bewijs: scripts/lib/voltooi/terplaatse.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:tab:terplaatse:f0d18ff39cb5a618def3fb85c776986522cf1fb487e853081c36aa537e59deae`.

**Externe voorwaarden / besluiten:** Werkelijke huur, verzekering, ticket en transfer vragen contracten/providerbewijs; SOS mag geen onbewezen hulp beloven.

### 90. Vluchten - `link:vluchten`

**Bouwcohort:** eerste twaalf, poort G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Journey. **Budgetverwijzing:** transaction → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `tab:reizen`, `link:reisboek`, `link:pay`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/vluchten.html.

**Canonieke productbelofte:** een lid boekt een vlucht na het opgeven van zijn paspoortgegevens, checkt in met koffers en krijgt een boarding pass met een eenmalige code die hij kan roteren of intrekken, en vraagt een charter aan.

**Huidige implementatie, statisch onderzocht:** De bron heeft vertrekbord, boeken, check-in, boardingcode en charteraanvraag. De proef gebruikt demonstratieluchthaven RTG Airport en bevestigt geen echte airlineboeking.

**Bronnen:** [public/apps/vluchten.html](../../public/apps/vluchten.html), [scripts/lib/voltooi/vluchten.js](../../scripts/lib/voltooi/vluchten.js), [public/apps/vluchten-momenten.js](../../public/apps/vluchten-momenten.js), [public/apps/vluchten-voorzijde.js](../../public/apps/vluchten-voorzijde.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/vluchten.html` → `reizen.vluchten` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een premium vluchtdossier met echte herkomst van opties, reservering, ticket, check-in en herstel.

**Benodigde wijzigingen:**

- Bestaande luchthaven-/reserveringsbronnen via expliciete provideradapter aansluiten.
- Aanvraag, reservering, ticket en boardingbewijs onderscheiden; wijziging, bagage en charterbesluit met menselijke regie kwalificeren.

**Specifieke acceptatie en te leveren bewijs:**

1. Gebruiker bevestigt voorstel; provider antwoordt traag en later tweemaal. → Geen geboekt/ticketuitgegeven vóór passend bewijs; maximaal één reservering/betaling met dezelfde providerreferentie. Bewijs: scripts/lib/voltooi/vluchten.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:vluchten:14659252781959c8bb62dca2c592ffd4393a3af50c472962dc0459719850d3bd`.
2. Uitgeversboardingpas wordt geïmporteerd en vlucht wijzigt. → Barcode blijft van uitgever; nieuwe status heeft bron/tijd; gevolgen zichtbaar en geen reserveringswijziging zonder geldige toestemming. Bewijs: scripts/lib/voltooi/vluchten.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:vluchten:b7888253dd19b7da35a2234532f49c162e20eca82b880e3372ed59dc23f9f24e`.

**Externe voorwaarden / besluiten:** Echte distributie, prijs/beschikbaarheid, ticketing en check-in vragen bevoegde aanbieders, overeenkomsten en eventuele certificering.

### 91. Openbaar vervoer - `link:ov`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Journey. **Budgetverwijzing:** transaction → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:pay`, `link:ovroutes`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/ov.html.

**Canonieke productbelofte:** een lid koopt bij een vervoerder waarmee RTG een overeenkomst heeft een kaartje uit zijn wallet, toont het, en de controleur ziet het een keer als geldig; weigert de bank, dan is er geen kaartje.

**Huidige implementatie, statisch onderzocht:** De bron heeft vervoerbewijs-, multimodale reis- en regie-ingangen. De proef meet eenmalige ticketcontrole met demo-vervoerder/simulatiebank, geen abonnement, pendel of check-in.

**Bronnen:** [public/apps/ov.html](../../public/apps/ov.html), [scripts/lib/voltooi/ov.js](../../scripts/lib/voltooi/ov.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/ov.html` → `vervoer.rit` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een volledige vervoerervaring met geldige bewijzen, providerstatus en verstoringsherstel.

**Benodigde wijzigingen:**

- Bestaande planning, tickets en Pay via referenties tot één ritdossier verbinden.
- Overeenkomst, tarief, geldigheid, check-in/uit, annulering en abonnementsgrenzen afzonderlijk kwalificeren; geen automatische herboeking.

**Specifieke acceptatie en te leveren bewijs:**

1. Een ticketkoop krijgt bankweigering; later wordt dezelfde aanvraag gecontroleerd. → Bij weigering nul geldig ticket en afschrijving; herhaling veroorzaakt maximaal één bewezen aankoop. Bewijs: scripts/lib/voltooi/ov.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:ov:3e0e0f0bcffc1e0a40314397270ccda5b6446b53a7d3e06d51cc175d06c6feca`.
2. Controleur scant hetzelfde eenmalige bewijs tweemaal na netwerkonderbreking. → Slechts één toegestane validatie; geen offline schijnzekerheid zonder overeengekomen controleprotocol; herstel is expliciet. Bewijs: scripts/lib/voltooi/ov.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:ov:c795090c3a998f82713db496082cb02234916d5a97ef89b8d555adf37b2e9796`.

**Externe voorwaarden / besluiten:** Verkoop/controle vragen daadwerkelijke vervoerderovereenkomst, tarief-/controleprotocol en bewezen betaalrail.

### 92. Navigatie - `link:navigatie`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Spatial. **Budgetverwijzing:** realtime → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:flits`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/navigatie.html.

**Canonieke productbelofte:** een lid zoekt een bestemming uit de eigen bronnen, krijgt een route van het eigen wegennet of een eerlijke weigering waar dat net er niet is, en meldt onderweg wat hij ziet op codenaam.

**Huidige implementatie, statisch onderzocht:** Eigen kaart-, zoek- en routemodules bestaan. De proef importeert een kleine NWB-fixture en weigert ongebouwde pakketten; echte brondekking wordt niet bewezen.

**Bronnen:** [public/apps/navigatie.html](../../public/apps/navigatie.html), [scripts/lib/voltooi/navigatie.js](../../scripts/lib/voltooi/navigatie.js), [public/apps/navigatie-kern.js](../../public/apps/navigatie-kern.js), [public/apps/navigatie-drie.js](../../public/apps/navigatie-drie.js), [public/apps/navigatie-zoek.js](../../public/apps/navigatie-zoek.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/navigatie.html` → `navigatie.route` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een toegankelijke route-ervaring met aantoonbare gebiedsdekking en voorspelbare offlinegrenzen.

**Benodigde wijzigingen:**

- Bestaande kaartcatalogus/routemotor tonen gebied, vervoerwijze, actualiteit en licentie.
- Download, verificatie, update en verwijderen van kaartpakketten herstelbaar maken; route-instructie ook als toegankelijke tekst aanbieden.

**Specifieke acceptatie en te leveren bewijs:**

1. Gebruiker vraagt route buiten dekking en daarna binnen geverifieerd pakket. → Buiten dekking concrete weigering; binnen dekking route met pakketversie/bron; geen verzonnen geometrie of aankomsttijd. Bewijs: scripts/lib/voltooi/navigatie.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:navigatie:1f536a9d63356f31ed543ada838f39ffa6a839db29f98dc8bd84137f4d7fbc84`.
2. Download breekt af tijdens update van gebruikt pakket. → Geen half pakket actief; checksum/versie gecontroleerd; hervatten behoudt oude geldige dekking en expliciete offlinegrens. Bewijs: scripts/lib/voltooi/navigatie.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:navigatie:8907938eab8e26b7cc4ec54d19fe665478a8d2550f47214398b9671e578fca52`.

**Externe voorwaarden / besluiten:** Echte kaartbouw, bronlicenties en toegestane ophaalomgeving zijn externe voorwaarden; fixtures bewijzen geen wereldwijde dekking.

### 93. Haal ik het? - `link:move`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Journey. **Budgetverwijzing:** browse → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:navigatie`, `link:reisboek`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/move.html.

**Canonieke productbelofte:** een lid ziet per overgang in zijn reis of hij het haalt, met de dekking erbij, wat er breekt als iets uitloopt en waar hij nu heen moet -- en een vraag verzet niets.

**Huidige implementatie, statisch onderzocht:** Move heeft lezende reis-, volgende-stap- en gevolgroutes. De proef noemt NIET_TE_BEPALEN bij ontbrekende duur/plek en verzet niets.

**Bronnen:** [public/apps/move.html](../../public/apps/move.html), [scripts/lib/voltooi/move.js](../../scripts/lib/voltooi/move.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/move.html` → `reizen.haalbaarheid` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een verklaarbare haalbaarheidsassistent met reistijdbuffers, gevolgen en zichtbare onzekerheid.

**Benodigde wijzigingen:**

- Bestaande Move-projectie verrijken met bron, versheid en dekking per overgang.
- Wat-alsvertraging via bestaande gevolg-/graafbronnen berekenen; alternatieven alleen voorbereiden, inclusief tijdzones en overstappen.

**Specifieke acceptatie en te leveren bewijs:**

1. Gebruiker simuleert negentig minuten vertraging bij een reis met onbekende verblijfsplek. → Bekende gevolgen worden berekend; onbekende overgang blijft niet te bepalen; nul reserveringen gewijzigd. Bewijs: scripts/lib/voltooi/move.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:move:951d5f296cd54f04d1e6eeac313e7c789c419173a07238793982f4c1cef42f70`.
2. Een tijdbron wordt oud of onbereikbaar vlak voor vertrek. → Versheid en dekking wijzigen zichtbaar; oude reistijd heet geen actuele garantie; handmatige broningang blijft beschikbaar. Bewijs: scripts/lib/voltooi/move.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:move:2b058e2692ed370f1c871d3a34168215fb4d224021de06832c5e534633ffe51c`.

**Externe voorwaarden / besluiten:** Live verkeers-, vlucht- en dienstregelingdata vragen bevoegde bronnen en gebruiksrechten.

### 94. Verkeer - `link:flits`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Spatial. **Budgetverwijzing:** realtime → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** geen aanvullende taakafhankelijkheid benoemd. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/flits.html.

**Canonieke productbelofte:** een lid meldt met een tik wat hij onderweg ziet en wie in de buurt is ziet het op codenaam; vlakbij dezelfde soort is een bevestiging, drie verschillende leden halen hem weg, en waar het verboden is wordt een flitser geweigerd.

**Huidige implementatie, statisch onderzocht:** De bron toont eigen-netwerkmeldingen met landgrenzen. De proef meet bevestigen en verdwijnen na drie verschillende melders, geen tijdsverval of chauffeurskant.

**Bronnen:** [public/apps/flits.html](../../public/apps/flits.html), [scripts/lib/voltooi/flits.js](../../scripts/lib/voltooi/flits.js), [public/apps/flits-voorzijde.js](../../public/apps/flits-voorzijde.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/flits.html` → `navigatie.verkeersmeldingen` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een verkeerscontext met herkomst en houdbaarheid zonder schijn van officiële realtime dekking.

**Benodigde wijzigingen:**

- Bestaande melding en landbeleid centraal houden; betrouwbaarheid uitleggen zonder mensenscore.
- Tijdsverval, chauffeurprojectie en offline wachtrij kwalificeren; onderwegbediening beperken tot veilige toegankelijke interacties.

**Specifieke acceptatie en te leveren bewijs:**

1. Twee leden melden hetzelfde object; één bevestigt tweemaal. → Eén object, maximaal één stem per account, geen zelfbevestiging; herkomst blijft eigen netwerk. Bewijs: scripts/lib/voltooi/flits.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:flits:e98def60e0f4440bdce31fae116260959caff09e149ab95fb082bf671f435d8a`.
2. Melding verloopt en toestel komt in gebied waar type verboden is. → Verlopen melding weg volgens beleid; verboden type ook via API geweigerd ongeacht stale clientcache. Bewijs: scripts/lib/voltooi/flits.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:flits:13384e649a4a28d2e72a736d12f3819eb332c2691c88d6a6db107cd625fbf41c`.

**Externe voorwaarden / besluiten:** Landspecifieke regels en officiële feeds vragen inhoudseigenaar en toegestane actuele bron vóór uitrol.

### 95. Stad - `link:stad`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Spatial. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** geen aanvullende taakafhankelijkheid benoemd. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/stad.html.

**Canonieke productbelofte:** een bewoner ziet hoe de stad erbij staat en meldt iets dat kapot of vol is; de melding staat meteen op de werklijst van de veldploeg en hij ziet op codenaam wanneer die klaar is.

**Huidige implementatie, statisch onderzocht:** Het scherm leest stadsstand, verstuurt melding en opent stream. De proef volgt melding naar veldwerkorder; live en samenvoegen liggen buiten bereik.

**Bronnen:** [public/apps/stad.html](../../public/apps/stad.html), [scripts/lib/voltooi/stad.js](../../scripts/lib/voltooi/stad.js), [public/apps/stad.js](../../public/apps/stad.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/stad.html` → `reizen.stad` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een begrijpelijke bewonersservice met bronvaste meldstatus en veilige locatiekeuze.

**Benodigde wijzigingen:**

- Bestaande melding en werkorder als verwijzingsketen tonen met minimale meldergegevens.
- Samenvoegen, netwerkherstel en kaart-/tekstalternatieven kwalificeren; demo-stad onderscheiden van echte operationele aansluiting.

**Specifieke acceptatie en te leveren bewijs:**

1. Bewoner meldt defect; veldploeg rondt werkorder af. → Eén melding en werkorder; bronvaste status terug; uitvoerder ziet geen onnodige melderidentiteit. Bewijs: scripts/lib/voltooi/stad.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:stad:54abf6ec72617364f869e06405d92ab8a459dbda1d18da650aa99f6fe90051b4`.
2. Twee bewoners melden hetzelfde object; één werkt offline. → Geen verloren melding of dubbele uitvoering volgens samenvoegbeleid; ieder ziet alleen eigen toegestane voortgang. Bewijs: scripts/lib/voltooi/stad.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:stad:7e9eec9dd4a4179e0d0f39a9c94607be8b3a245a63b22a2801dcc8c35e14c8b3`.

**Externe voorwaarden / besluiten:** Echte gemeentelijke service/responstijd vraagt bevoegde operationele partner; simulatiestad is geen gemeentelijke aansluiting.

### 96. Reisboek - `link:reisboek`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Journey. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:vluchten`, `link:wallet`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/reisboek.html.

**Canonieke productbelofte:** een Lifestyle-lid -- na het menselijke besluit van het kantoor -- legt een reis vast met vluchten, verblijven, documenten en programma en ziet op tijd welk document verloopt.

**Huidige implementatie, statisch onderzocht:** Reisboek registreert reizen, vluchten, verblijven, documenten en programma voor Lifestyle. De proef meet menselijke pasbeslissing en opslag, geen providerboeking of reiswachter.

**Bronnen:** [public/apps/reisboek.html](../../public/apps/reisboek.html), [scripts/lib/voltooi/reisboek.js](../../scripts/lib/voltooi/reisboek.js), [public/apps/reisboek-momenten.js](../../public/apps/reisboek-momenten.js), [public/apps/reisboek-beheer.js](../../public/apps/reisboek-beheer.js), [public/apps/reisboek.js](../../public/apps/reisboek.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/reisboek.html` → `reizen.reisboek` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een persoonlijk reisboek met herkomst per onderdeel, deelrechten en wijzigingshistorie.

**Benodigde wijzigingen:**

- Reisprojectie behouden; boeking, betaling en document blijven bij hun domeineigenaar.
- Eigen invoer, import en providerbewijs onderscheiden; documentverval, gezelschap, tijdzones en wachter/herstel kwalificeren.

**Specifieke acceptatie en te leveren bewijs:**

1. Reiziger voegt eigen vluchtregel en providerbevestigde reservering toe. → Verschillende herkomst zichtbaar; eigen invoer krijgt nooit providergeboekt-label zonder bewijs. Bewijs: scripts/lib/voltooi/reisboek.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:reisboek:82b8f86d0b0193d665bd743a50a4a370e1359d2701b9b9996f7d8ad122837bd8`.
2. Document verloopt, vluchtwijziging raakt verblijf en reisgenoot verliest toegang. → Attentie heeft bron/peildatum; gevolgen zichtbaar zonder automatische mutatie; ingetrokken deelrecht stopt nieuwe inzage. Bewijs: scripts/lib/voltooi/reisboek.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:reisboek:c329a1d356424d86c0942fb73288b44247dfe9c21bb68cb8f18a1f2c864ff5ff`.

**Externe voorwaarden / besluiten:** Live bewaking/import vragen uitgevers-/providerbronnen; Lifestyle-toegang blijft herleidbaar menselijk besluit.

### 97. Hangar - `link:hangar`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Command. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:reisboek`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/hangar.html.

**Canonieke productbelofte:** een Lifestyle-lid houdt zijn toestellen en vluchten bij: laatst bekende positie, eerstvolgende vlucht en vlieguren.

**Huidige implementatie, statisch onderzocht:** Hangar registreert toestellen en vluchten; positie/uren worden afgeleid uit vastgelegde vluchten. De proef doet geen live tracking of vluchtaanmelding.

**Bronnen:** [public/apps/hangar.html](../../public/apps/hangar.html), [scripts/lib/voltooi/hangar.js](../../scripts/lib/voltooi/hangar.js), [public/apps/hangar-toestel.js](../../public/apps/hangar-toestel.js), [public/apps/hangar-voorzijde.js](../../public/apps/hangar-voorzijde.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/hangar.html` → `reizen.vliegtuig` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een toesteldossier dat eigen registratie, planning en externe operationele waarheid onderscheidt.

**Benodigde wijzigingen:**

- Bestaande toestel-/vluchtbron met revisies en herkomst voor correcties uitwerken.
- Reisboekverbinding en documenten via bestaande rechten/opslag kwalificeren zonder boekings- of luchtvaartbevoegdheid over te nemen.

**Specifieke acceptatie en te leveren bewijs:**

1. Eigenaar voegt gevlogen en geplande vlucht toe en corrigeert de gevlogen vlucht. → Alleen gerealiseerde registratie bepaalt positie/uren; correctie is herleidbaar; geplande vlucht beweegt het toestel niet. Bewijs: scripts/lib/voltooi/hangar.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:hangar:b20505a595e03b4276a649c74857c7c961d5a29448a507619d7f742d1c648db4`.
2. Ander account probeert toestel te lezen; offline wijziging botst met nieuwe registratie. → Geen lek; conflict bewaart invoer en toont versies; eigen invoer krijgt geen live-positielabel. Bewijs: scripts/lib/voltooi/hangar.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:hangar:2dfaa60985244d20aa7bed1e3a1600f73a6a0abee483832ff01e8851670e0759`.

**Externe voorwaarden / besluiten:** Onderhoudsvalidatie, operationele luchtvaartplanning en live tracking vragen nieuw scopebesluit, bevoegde partijen en bronnen.

### 98. Verblijven - `link:residentie`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Spatial. **Budgetverwijzing:** realtime → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:maison`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/residentie.html.

**Canonieke productbelofte:** een lid richt zijn eigen suite in met de Maison-catalogus, geeft hem een naam en zet hem open of dicht; de gids toont een open suite en een ander lid kan hem binnenlopen, een gesloten niet.

**Huidige implementatie, statisch onderzocht:** Verblijven opent een virtuele Maison-suite met bezoekrechten. De proef boekt geen accommodatie en meet geen canvas, spraak of live aanwezigheid.

**Bronnen:** [public/apps/residentie.html](../../public/apps/residentie.html), [scripts/lib/voltooi/residentie.js](../../scripts/lib/voltooi/residentie.js), [public/apps/residentie.js](../../public/apps/residentie.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/residentie.html` → `sociaal.residentie` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een hoogwaardige toegankelijke virtuele ontvangstruimte met eigen inrichting en beheerste sociale aanwezigheid.

**Benodigde wijzigingen:**

- Virtuele suite onderscheiden van hotelverblijf in taaknaam en context; geen verblijfboekingsbron erbij.
- Inrichting/bezoekrechten in canvas en lijst-/toetsenbordpad kwalificeren; bezoek stoppen en live herverbinden veilig afwerken.

**Specifieke acceptatie en te leveren bewijs:**

1. Eigenaar richt in, opent voor bezoek en een ander treedt binnen. → Zelfde toegestane inrichting bij beide; standaard gesloten; openstelling vraagt expliciete keuze. Bewijs: scripts/lib/voltooi/residentie.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:residentie:16a11097119dba8a9117a7360f82f36c2e9070921fcc5534b0c76db0bf48c5de`.
2. Eigenaar sluit tijdens bezoek en herlaadt na verbindingsverlies. → Nieuwe bezoeken geweigerd; actieve toegang eindigt volgens beleid; inrichting bewaard en geen spookbezoek als huidige aanwezigheid. Bewijs: scripts/lib/voltooi/residentie.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:residentie:8f2b34de8337c13b1d9c1eed77ea0ade5d8dd9aa630ce375001d52932ad1f2f6`.

**Externe voorwaarden / besluiten:** Nieuwe VR-, spraak- of commerciële vastgoedfuncties vragen eigen scope-/veiligheidsbesluit; huidige capability is een virtuele suite.

### 99. Aankomst - `link:aankomst`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Journey. **Budgetverwijzing:** transaction → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:horeca`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/arrival.html.

**Canonieke productbelofte:** een gast zet zijn wens om in een aanvraag bij de zaak, krijgt een tijdelijke pass met beloften die de zaak persoonlijk bevestigt, en deelt vrijwillig zijn aankomststatus.

**Huidige implementatie, statisch onderzocht:** Arrival heeft wensinterpretatie, aanvraag, tijdelijke pass en door de zaak bevestigde beloften. De proef controleert geen hostmissie of passrotatie/intrekking.

**Bronnen:** [public/apps/arrival.html](../../public/apps/arrival.html), [scripts/lib/voltooi/aankomst.js](../../scripts/lib/voltooi/aankomst.js), [public/apps/arrival-voorzijde.js](../../public/apps/arrival-voorzijde.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/arrival.html` → `reizen.aankomst` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een discrete aankomstervaring met verifieerbare afspraken en vrijwillige statusdeling.

**Benodigde wijzigingen:**

- Bestaande arrivalpas en horecaketens via referenties aan PlanDossier koppelen.
- Open beloften, voorwaarden, late aankomst, passintrekking en hostoverdracht als herstelbare keten kwalificeren.

**Specifieke acceptatie en te leveren bewijs:**

1. Een gast vraagt twee bijzondere behoeften; de zaak bevestigt er één. → Pass toont gedeeltelijk bevestigd met open belofte; geen volledige gereedheidsclaim vóór bevoegde bevestiging. Bewijs: scripts/lib/voltooi/aankomst.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:aankomst:a6402833f873cb37da08982cb57cb66d13973bbcd3ad76e1ee5c94905f8f0304`.
2. Gast trekt pass in tijdens hostscan en stopt locatie. → Oude pass verleent geen nieuwe toegang; host ziet actuele intrekking; hervatten deelt locatie niet opnieuw. Bewijs: scripts/lib/voltooi/aankomst.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:aankomst:1486c6eb70839ad6dc7545ea30bddafaa1a992ad0424949182997ef0cd788e58`.

**Externe voorwaarden / besluiten:** Aanbieders moeten operationele bevestiging en uitvoerbare servicevoorwaarden leveren; gegenereerd plan is geen leveringsgarantie.

### 100. Routedossier - `link:routedossier`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Command. **Budgetverwijzing:** browse → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** geen aanvullende taakafhankelijkheid benoemd. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/routedossier.html.

**Canonieke productbelofte:** een medewerker van het kantoor ziet per schakel hoeveel routes bewezen, gezakt of ongemeten zijn, filtert en bladert, en opent een route met al zijn cellen en hun bron.

**Huidige implementatie, statisch onderzocht:** Routedossier is een kantoorvenster op routebewijsregisters, geen reizigersdossier. De proef controleert niet versheid of juistheid van gelezen registers.

**Bronnen:** [public/apps/routedossier.html](../../public/apps/routedossier.html), [scripts/lib/voltooi/routedossier.js](../../scripts/lib/voltooi/routedossier.js), [public/apps/routedossier-voorzijde.js](../../public/apps/routedossier-voorzijde.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/routedossier.html` → `kantoor.routedossier` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een inspectievenster met herleidbaar bewijsbereik, versheid en wijzigingsimpact per technische route.

**Benodigde wijzigingen:**

- Bestaande registers lezen met kandidaatcommit, omgeving en verval naast conclusies.
- Change Impact als verwijzing naar getroffen routes/bewijs tonen; onbekend, ongemeten en gezakt strikt onderscheiden.

**Specifieke acceptatie en te leveren bewijs:**

1. Reviewer filtert ongemeten routes en opent detail. → Telling, paginering en detail gebruiken dezelfde bronversie; iedere ontbrekende cel noemt reden en wordt niet groen. Bewijs: scripts/lib/voltooi/routedossier.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:routedossier:30494be8f1acf27e2818642ae18af52b2972a6578e6343cbc247cfe383d91730`.
2. Bewijs hoort bij oudere commit of ontbreekt. → Verlopen/ongeldig/onbekend zichtbaar met bron; geen kandidaatdekking afgeleid uit oude cellen. Bewijs: scripts/lib/voltooi/routedossier.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:routedossier:ddc9f730aba50434054933bcc6b44f27866b761aaa7d81079b190ece20700145`.

**Externe voorwaarden / besluiten:** Geen aanvullend extern besluit benoemd; de bestaande toezegklasse en gemeenschappelijke scopepoort blijven gelden.

### 101. OV-routes - `link:ovroutes`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Spatial. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:ov`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/ovroutes.html.

**Canonieke productbelofte:** de manager van een OV-zaak tekent een lijn met haltes, frequentie en tarief, en leden zien hem meteen op de OV-kaart; weghalen haalt hem ook bij hen weg.

**Huidige implementatie, statisch onderzocht:** De bron bevat een routetekenaar. De proef meet haltes, frequentie en tarief, geen kaartslepen of gevolgen voor verkochte tickets.

**Bronnen:** [public/apps/ovroutes.html](../../public/apps/ovroutes.html), [scripts/lib/voltooi/ovroutes.js](../../scripts/lib/voltooi/ovroutes.js), [public/apps/werkvloer.js](../../public/apps/werkvloer.js), [public/apps/ovroutes.js](../../public/apps/ovroutes.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/ovroutes.html` → `zaak.ovroutes` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een operationele lijneditor met toegankelijke invoer, versiebeheer en impact vóór publicatie.

**Benodigde wijzigingen:**

- Bestaande lijnbron met concept/publicatie en geplande wijziging kwalificeren.
- Ticket-/ritgevolgen vooraf tonen; lijst- en toetsenbordbediening gelijkwaardig aan kaart maken.

**Specifieke acceptatie en te leveren bewijs:**

1. Manager wijzigt halte en frequentie in concept en publiceert. → Reizigers zien tot publicatie geldige oude versie, daarna één consistente nieuwe lijn met bronversie. Bewijs: scripts/lib/voltooi/ovroutes.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:ovroutes:29bef95e3f9762a4138483e4fad9c1ef36c791deb9aca71af922ec5006b37c42`.
2. Manager verwijdert een lijn met geldige verkochte tickets. → Geen stil verweesde tickets; impact vooraf zichtbaar en domeinbeleid blokkeert of biedt gecontroleerde afhandeling. Bewijs: scripts/lib/voltooi/ovroutes.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:ovroutes:b9aac305c83cc977f0b0586ae14e0f3a568ff7e2e041ca1667b04c939dea2418`.

**Externe voorwaarden / besluiten:** Wijzigings-/terugbetalingsregels van vervoerder moeten zijn vastgesteld vóór openstelling.


## FoundationOS

### 102. RTFoundation in jouw buurt - `link:rtfbuurt`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Horizon. **Budgetverwijzing:** browse → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:klimaat`, `link:buurtruil`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/foundation/os-publiek.html.

**Canonieke productbelofte:** wie in een stad woont ziet welke RTF-afdeling open is, wat er loopt, waar hij binnen kan lopen en welke campagne er is -- en niets wat niet op een poster in het buurthuis zou hangen.

**Huidige implementatie, statisch onderzocht:** De buurtpagina leest steden, campagnes en stadsinformatie. De proef verwacht uitsluitend publiek geschikte informatie en onderscheidt open en in-verkenning.

**Bronnen:** [public/apps/foundation/os-publiek.html](../../public/apps/foundation/os-publiek.html), [scripts/lib/voltooi/rtfbuurt.js](../../scripts/lib/voltooi/rtfbuurt.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/foundation/os-publiek.html` → `wereld.foundation` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een heldere lokale voordeur met actuele activiteiten en eerlijke beschikbaarheid.

**Benodigde wijzigingen:**

- Bestaande stads- en campagneprojecties voorzien van ververstijd en inhoudseigenaar.
- Opening, plaats, vrije plekken en toegankelijke deelname tonen waar brondata bestaat; gesloten stad krijgt bruikbare vervolgstap.

**Specifieke acceptatie en te leveren bewijs:**

1. Een stad opent een activiteit met twaalf plaatsen en sluit haar daarna. → De buurtprojectie volgt dezelfde bronstatus; gesloten activiteit biedt geen misleidende deelnameactie. Bewijs: scripts/lib/voltooi/rtfbuurt.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:rtfbuurt:53c3491085d97969b46919c51fadeade3257877371f0cbd11f33d1f56f37d4b2`.
2. Een andere gezinscontext probeert via buurtlinks interne dossiers te openen. → Alleen toegestane publieke velden; geen persoonsdossier, interne financiële regels of onbevoegde handeling. Bewijs: scripts/lib/voltooi/rtfbuurt.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:rtfbuurt:044028c91a6d2e83d37656a191724aed969d5fff3f679114350a09efda2120e7`.

**Externe voorwaarden / besluiten:** P0 moet RTFoundation Winkel aan een bestaande eigenaar/ingang koppelen of expliciet blokkeren; deze pagina wordt niet stil winkeleigenaar en er ontstaat geen 115e app.

### 103. Zorg - `link:foundationzorg`

**Bouwcohort:** eerste twaalf, poort G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Ceremony. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `tab:zorg`, `tab:gezin`, `link:relaties`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/foundation/zorg.html.

**Canonieke productbelofte:** het gezin ziet zijn zorgafspraken (betalen, annuleren) en de gezondheidskaart van het gezin bij elkaar, en een hulpwijzer denkt mee zonder de tekst te bewaren.

**Huidige implementatie, statisch onderzocht:** De bron projecteert Care-afspraken, gezinsgezondheidskaart en hulpwijzer. De proef beschrijft versleutelde gezondheidsdata en geen opslag van hulpvragen, maar loopt intake delen niet.

**Bronnen:** [public/apps/foundation/zorg.html](../../public/apps/foundation/zorg.html), [scripts/lib/voltooi/foundationzorg.js](../../scripts/lib/voltooi/foundationzorg.js), [public/apps/foundation/zorg-hulp-weergave.js](../../public/apps/foundation/zorg-hulp-weergave.js), [public/apps/foundation/zorg-hulp.js](../../public/apps/foundation/zorg-hulp.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/foundation/zorg.html` → `rtf.hulp-zorg` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een gezinszorgdossier met rustige afsprakenweergave, strikt gescheiden rechten en een veilige hulpuitweg.

**Benodigde wijzigingen:**

- Care en gezinskaart via verwijzingen tonen; geen medische inhoud kopiëren naar PlanDossier of Living Graph.
- Per persoon toestemming, bewaartermijn en intrekking tonen; hulpwijzer modelvrij en met model op geen-opslag en begrenzing toetsen.

**Specifieke acceptatie en te leveren bewijs:**

1. Een ouder boekt en geeft afzonderlijk toestemming voor de kaart van een kind. → Bronnen blijven gescheiden; zonder rechtmatige toestemming geen gezondheidsmutatie of medische tekst in algemene logs. Bewijs: scripts/lib/voltooi/foundationzorg.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:foundationzorg:380bcd076119d38ed2ffd23a13e971e5c9f16bde15c38ac06a26217cb4abddb8`.
2. Betaling faalt, gezinssessie verloopt en hulpwijzer wordt offline geopend. → Afspraak blijft wacht-op-betaling zonder afschrijving; verlopen sessie toont geen kaart; hulp toont beschikbaarheidsgrens en bewaart geen vraag. Bewijs: scripts/lib/voltooi/foundationzorg.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:foundationzorg:ad9c1289dc169ac80ef4891d1c88bd35a3c9d30ef3a3ae73a3b283576fcf151c`.

**Externe voorwaarden / besluiten:** Zorginhoud, bijzondere-persoonsgegevensbeleid en actuele hulproutes vereisen onafhankelijke inhoudelijke en privacyacceptatie.

### 104. Zorgaanbod - `tab:zorg`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Ceremony. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:pay`, `link:relaties`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/app.html (stand zorg).

**Canonieke productbelofte:** het lid ziet het zorgaanbod, boekt en betaalt een behandeling of pakket, deelt medische context apart met een kliniek en stopt dat zelf, en annuleert wat hij niet meer wil.

**Huidige implementatie, statisch onderzocht:** De zorgtab gebruikt Care-aanbod, afspraken, pakketten, betalen en aparte intake. De proef gebruikt een simulatiebank en loopt niet door de browser.

**Bronnen:** [public/apps/app.html](../../public/apps/app.html), [scripts/lib/voltooi/tabzorg.js](../../scripts/lib/voltooi/tabzorg.js), [public/apps/app-main/app-main-13.js](../../public/apps/app-main/app-main-13.js), [public/apps/app-main/app-main-14.js](../../public/apps/app-main/app-main-14.js), [public/apps/app-main/app-main-15.js](../../public/apps/app-main/app-main-15.js), [server/kern/care/leden.js](../../server/kern/care/leden.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/app.html` → `kern.app` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een rustige zorgafspraakervaring met actuele broninformatie en afzonderlijke medische toestemming.

**Benodigde wijzigingen:**

- Care blijft eigenaar; aanvraag en bevestigde afspraak worden met bron onderscheiden.
- Pakketuitval via bestaande domeinen/Pay reconciliëren; intake heeft apart doel, ontvanger, termijn en intrekking.

**Specifieke acceptatie en te leveren bewijs:**

1. Bij een pakket faalt betaling van één onderdeel en de pagina herlaadt. → Geen volledig bevestigd pakket; elk onderdeel en bedrag blijft zichtbaar met gecontroleerde herstelroute. Bewijs: scripts/lib/voltooi/tabzorg.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:tab:zorg:bc767cb85c96dddc3fb3d660b31dc9d223a66731a6230f984cb8a0c2214c8495`.
2. Het lid deelt intake met kliniek A, trekt in en kliniek B vraagt op. → A verliest nieuwe toegang; B ontvangt niets; algemene logs en reisdossiers bevatten geen medische tekst. Bewijs: scripts/lib/voltooi/tabzorg.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:tab:zorg:a144c6036656018f4f97719328112b394fc351222b2cd32c8d1552df754bf537`.

**Externe voorwaarden / besluiten:** Zorgverlening en medische beslisondersteuning vragen bevoegde professionals en passende externe toets; RTG belooft geen diagnose.

### 105. RTFoundation portaal - `link:rtfportaal`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Command. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** geen aanvullende taakafhankelijkheid benoemd. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/foundation/os-portaal.html.

**Canonieke productbelofte:** een partnerstichting, gemeente of ondernemer opent met de code van het kantoor zijn eigen dossier -- de gemeente alleen getelde cijfers -- en elke code opent precies een dossier.

**Huidige implementatie, statisch onderzocht:** Het portaal heeft partner-, gemeente- en ondernemersprojecties. De proef beschrijft codebinding aan één account en alleen gemeentelijke tellingen.

**Bronnen:** [public/apps/foundation/os-portaal.html](../../public/apps/foundation/os-portaal.html), [scripts/lib/voltooi/rtfportaal.js](../../scripts/lib/voltooi/rtfportaal.js), [public/apps/foundation/schil-os.js](../../public/apps/foundation/schil-os.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/foundation/os-portaal.html` → `portaal.toegang` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een professioneel samenwerkingsportaal met eigen afspraken en navolgbare voortgang binnen harde gegevensgrenzen.

**Benodigde wijzigingen:**

- Bestaande dossierprojecties behouden met organisatiecontext, rol en herkomst per cijfer.
- Code-uitgifte, binding, verval en intrekking kwalificeren; niet gemeten, geschat en vastgesteld onderscheiden.

**Specifieke acceptatie en te leveren bewijs:**

1. Een partner opent haar code; een tweede account probeert dezelfde code. → Eén geldige binding, geen dossierlek; intrekking stopt nieuwe inzage uit de bestaande tab. Bewijs: scripts/lib/voltooi/rtfportaal.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:rtfportaal:c8d4279bc5713621bb86ae65a65de79b471b38f36da3ed93974f4e81602ed82d`.
2. Een gemeente opent een dashboard met ontbrekende metingen en kleine groepen. → Ontbrekend blijft niet gemeten; uitsluitend toegestane aggregaten met vereiste afscherming, nooit gezinsregels. Bewijs: scripts/lib/voltooi/rtfportaal.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:rtfportaal:74a439800734838b292a8ad07e9574491ec0397eb185124bb348bf3cee760d84`.

**Externe voorwaarden / besluiten:** Uitwisseling vraagt gegevensafspraken, bewaartermijnen en toets op herleidbaarheid.

### 106. Ontdekken - `link:connect`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Horizon. **Budgetverwijzing:** browse → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:library`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/connect.html.

**Canonieke productbelofte:** je ontdekt iets, begrijpt het, doet er iets mee, en een ander bevestigt dat het hem hielp -- zonder score, rangorde of niveau.

**Huidige implementatie, statisch onderzocht:** Connect kiest leden- of gezinsroutes voor horizon, dossier en portfolio. De voltooi-proef loopt de gezinsdeur; menselijke naklank hoort bij de lusproef.

**Bronnen:** [public/apps/connect.html](../../public/apps/connect.html), [scripts/lib/voltooi/connect.js](../../scripts/lib/voltooi/connect.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/connect.html` → `ontdekken.connect` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een eindige, uitlegbare ontdekervaring met eigen richting en betekenisvolle vervolgacties.

**Benodigde wijzigingen:**

- Bestaande Connect-projecties per account-/gezinscontext met PersonalOS verbinden.
- Waarom aanbevolen, minder hiervan, vergeten en bronactualiteit tonen; begrip en menselijke naklank onderscheiden zonder score.

**Specifieke acceptatie en te leveren bewijs:**

1. Een gebruiker opent een ontdekking, kiest minder ervan en registreert eigen begrip. → Alleen openen schrijft gezien; voorkeur werkt door; portfolio labelt eigen verklaring en verzint geen bevestiging. Bewijs: scripts/lib/voltooi/connect.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:connect:853a95dec0c6f3824821edacf4ea028b148b69bd9c903d829185862aa18768aa`.
2. Een profiel wisselt naar een ander gezinslid en trekt een signaal in. → Geen dossier- of voorkeurlek; ingetrokken signaal wordt niet meer gebruikt; lege horizon biedt een handmatige ingang. Bewijs: scripts/lib/voltooi/connect.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:connect:3ba454367f947410ed9929804d0a17016ed62d751efe8de826b359c123215cd0`.

**Externe voorwaarden / besluiten:** Geen aanvullend extern besluit benoemd; de bestaande toezegklasse en gemeenschappelijke scopepoort blijven gelden.

### 107. LibraryOS - `link:library`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Library. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** geen aanvullende taakafhankelijkheid benoemd. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/library.html.

**Canonieke productbelofte:** een maker begint een werk, legt het vast in onderdelen met revisies, geeft met afspraak en rechten een editie vrij die niet meer verandert, leest hem en verwerkt feedback.

**Huidige implementatie, statisch onderzocht:** LibraryOS heeft werk, revisie, afspraak, rechten, editie, publicatie en reader. De voltooi-proef meet solowerk en sluit samenwerking en terugtrekken uit.

**Bronnen:** [public/apps/library.html](../../public/apps/library.html), [scripts/lib/voltooi/library.js](../../scripts/lib/voltooi/library.js), [public/apps/library/api.js](../../public/apps/library/api.js), [public/apps/library/app.js](../../public/apps/library/app.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/library.html` → `library.werk` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een hoogwaardige publicatie- en leesomgeving met editie-integriteit, samenwerking en duidelijke rechten.

**Benodigde wijzigingen:**

- Bestaande studio en reader als eigen taakscènes uitwerken met consistente voortgang.
- Uitnodigen, rechtenintrekking, publicatie en feedback als meeractorlus kwalificeren; een bevroren editie verandert niet achteraf.

**Specifieke acceptatie en te leveren bewijs:**

1. Twee makers leggen rechten vast, publiceren een editie en een lezer bewaart een bladwijzer. → Publicatie verwijst naar overeengekomen revisies; later concept verandert geen editiebytes; bladwijzer blijft aan die editie gebonden. Bewijs: scripts/lib/voltooi/library.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:library:879be852ee2a6f662046e5272cf32955fa35125d58f62c38e77f6fd94a09163a`.
2. Een maker trekt vóór publicatie in; een lezer verliest tijdelijk verbinding. → Publicatie wordt geweigerd met reden; offline toegang volgt geldige rechten en herstel bewaart alleen toegestane leespositie. Bewijs: scripts/lib/voltooi/library.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:library:b0d1f59dc6bad2ed7ab0a762a780ddd2825299cd69e6b788dab4061b8ed16cc0`.

**Externe voorwaarden / besluiten:** Nieuwe externe distributie en betaalde uitgeefcontracten vragen auteursrechten, licenties en commercieel besluit.

### 108. Het bord - `link:rtfbord`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Atelier. **Budgetverwijzing:** realtime → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:rtfschrift`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/foundation/bord.html.

**Canonieke productbelofte:** een begeleider start een les, tekent op het bord, zet opgaven en de agenda klaar, ziet de inzendingen en leest een schrift -- de klas en een andere les beschrijven zijn bord niet.

**Huidige implementatie, statisch onderzocht:** Het bord heeft les-, stroke-, undo-, opgave-, agenda- en schriftbronnen. SSE en presentielijst vallen buiten de voltooi-proef.

**Bronnen:** [public/apps/foundation/bord.html](../../public/apps/foundation/bord.html), [scripts/lib/voltooi/rtfbord.js](../../scripts/lib/voltooi/rtfbord.js), [public/apps/foundation/tekenen.js](../../public/apps/foundation/tekenen.js), [public/apps/foundation/lesdeel.js](../../public/apps/foundation/lesdeel.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/foundation/bord.html` → `rtf.bord` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een toegankelijke live lesruimte met veilige leerlingrechten en betrouwbare gezamenlijke voortgang.

**Benodigde wijzigingen:**

- Bestaande teken- en lesmodules met één zichtbare verbindings- en revisiestatus verbinden.
- SSE-herstel, lescodevernieuwing en deelnemerintrekking kwalificeren; kritieke tekeninstructies krijgen tekst-/toetsenbordalternatief.

**Specifieke acceptatie en te leveren bewijs:**

1. Begeleider tekent en zet een opgave; één leerling verliest tijdelijk verbinding. → Na herstel dezelfde bevestigde bordrevisie en opgave bij beide leerlingen, zonder dubbele strokes of inzending. Bewijs: scripts/lib/voltooi/rtfbord.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:rtfbord:b6d0c9259beec693ce5dc4dd39c38898cf178335da173bba3c98ea49a4122329`.
2. Een lescode wordt geroteerd en een leerling verwijderd terwijl diens tab open is. → Oude toegang levert geen nieuwe lesgegevens of schrijfbevoegdheid; herstel legt rechtmatige heraansluiting uit. Bewijs: scripts/lib/voltooi/rtfbord.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:rtfbord:34b22b31a42f5b37d3c3ae3574aee649d8c84e92300756398f95113f14994a63`.

**Externe voorwaarden / besluiten:** Geen aanvullend extern besluit benoemd; de bestaande toezegklasse en gemeenschappelijke scopepoort blijven gelden.

### 109. Het schrift - `link:rtfschrift`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Atelier. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:rtfbord`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/foundation/schrift.html.

**Canonieke productbelofte:** een leerling doet mee met een les, schrijft in zijn eigen schrift, levert in en vraagt de bijleshulp -- een klasgenoot of een andere les leest zijn schrift niet.

**Huidige implementatie, statisch onderzocht:** De bron bewaart schrift en inzending en biedt bijleshulp. De proef meet schriftisolatie en crashherstel, geen live SSE of modelkwaliteit.

**Bronnen:** [public/apps/foundation/schrift.html](../../public/apps/foundation/schrift.html), [scripts/lib/voltooi/rtfschrift.js](../../scripts/lib/voltooi/rtfschrift.js), [public/apps/foundation/tekenen.js](../../public/apps/foundation/tekenen.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/foundation/schrift.html` → `leren.livesles` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een persoonlijk leerschrift met veilige concepten, revisies en begrijpelijke individuele feedback.

**Benodigde wijzigingen:**

- Concept en ingeleverd antwoord onderscheiden; bestaande schriftopslag blijft eigenaar.
- Twee-toestelconflicten met behoud van beide teksten oplossen; hulp met bron, modelvrije terugval en leeftijdspassende toon kwalificeren.

**Specifieke acceptatie en te leveren bewijs:**

1. Een leerling schrijft offline, levert online in en opent op een tweede toestel. → Concept en bevestigde inzending zijn herkenbaar; dezelfde versie keert terug zonder duplicatie. Bewijs: scripts/lib/voltooi/rtfschrift.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:rtfschrift:77b890f3f28f0f9e9897008eef0380fc820f46c76eda9f3fc8bb81a4a3494655`.
2. Twee toestellen wijzigen dezelfde bladzijde en een klasgenoot vraagt die op. → Een zichtbaar conflict bewaart beide teksten tot keuze; klasgenoot ontvangt geen inhoud of privémetadata. Bewijs: scripts/lib/voltooi/rtfschrift.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:rtfschrift:d8e71e74049ad3a0701e48e343d74e3a8b316ead9b2ed6b94d36c581eeb3e7cf`.

**Externe voorwaarden / besluiten:** Geen aanvullend extern besluit benoemd; de bestaande toezegklasse en gemeenschappelijke scopepoort blijven gelden.

### 110. Klimaatfonds - `link:klimaat`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Horizon. **Budgetverwijzing:** browse → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:geven`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/foundation/klimaatfonds.html.

**Canonieke productbelofte:** wie in de buurt woont ziet de lopende duurzaamheidsprojecten en geeft erheen, stelt in het Living Lab een vraag over duurzaamheid, steunt die van een ander en ziet welk onderzoek er loopt.

**Huidige implementatie, statisch onderzocht:** Het scherm combineert giftprojecten en Living Lab-vragen, steun en onderzoek. Geven zelf wordt door geven.js gemeten.

**Bronnen:** [public/apps/foundation/klimaatfonds.html](../../public/apps/foundation/klimaatfonds.html), [scripts/lib/voltooi/klimaat.js](../../scripts/lib/voltooi/klimaat.js), [public/apps/foundation/schil-os.js](../../public/apps/foundation/schil-os.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/foundation/klimaatfonds.html` → `gemeenschap.klimaatfonds` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een onderbouwd lokaal duurzaamheidsvenster dat metingen en verwachtingen helder onderscheidt.

**Benodigde wijzigingen:**

- Bestaande projecten aan onderzoek en vragen verbinden met bron, meetdatum en verantwoordelijke.
- Steun en doorsturen naar Geven kwalificeren; ontbrekende effectmetingen nooit omzetten in nul of onbewezen CO2-winst.

**Specifieke acceptatie en te leveren bewijs:**

1. Een bewoner opent een project en gaat vanuit Klimaatfonds naar Geven. → Hetzelfde project-ID en actuele status blijven behouden; navigeren voert geen gift uit. Bewijs: scripts/lib/voltooi/klimaat.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:klimaat:79b6150d05e14279a7e1bf772396b64383346c698e6d26732d83caddebe0d941`.
2. Steun komt tweemaal binnen; effectmeting ontbreekt en het project sluit. → Eén steun per account; effect blijft niet gemeten; gesloten project accepteert geen nieuw geoormerkt voornemen. Bewijs: scripts/lib/voltooi/klimaat.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:klimaat:52efee0d82e65641148e1a7fa01ffc8f5009129192b465a68f631190e390606d`.

**Externe voorwaarden / besluiten:** Nieuwe impactberekeningen en publieke duurzaamheidsclaims vragen methodiek, datarechten en inhoudelijke verificatie.

### 111. Buurtruil - `link:buurtruil`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Salon. **Budgetverwijzing:** compose → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** geen aanvullende taakafhankelijkheid benoemd. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/foundation/buurtruil.html.

**Canonieke productbelofte:** een buurtbewoner zet iets weg te geven of gezocht in zijn RTF-stad, een buur toont belangstelling en de eigenaar sluit het als het weg is.

**Huidige implementatie, statisch onderzocht:** Het scherm roept plaatsen, belangstelling, sluiten en melden aan; de proef sluit moderatie na meldingen uit.

**Bronnen:** [public/apps/foundation/buurtruil.html](../../public/apps/foundation/buurtruil.html), [scripts/lib/voltooi/buurtruil.js](../../scripts/lib/voltooi/buurtruil.js), [public/apps/foundation/schil-os.js](../../public/apps/foundation/schil-os.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/foundation/buurtruil.html` → `gemeenschap.buurtruil` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een veilige lokale weggeef- en zoekervaring met duidelijke overdracht en eigenaarscontrole.

**Benodigde wijzigingen:**

- Bestaande ruilstatussen met concept, plaatsing, belangstelling en sluiten als volledige taaklus tonen.
- Melden en moderatie met bronstatus en herstel verbinden; geen betaal- of chatmotor toevoegen.

**Specifieke acceptatie en te leveren bewijs:**

1. Een ouder plaatst aanbod, een buur toont tweemaal belangstelling en de ouder sluit. → Eén aanbod en één belangstelling; alleen de eigenaar ziet belangstellenden; gesloten aanbod verdwijnt bij de buur. Bewijs: scripts/lib/voltooi/buurtruil.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:buurtruil:0f87bd61bb9866e02157d5db2e23a869ae73929803c6fb4a68b84c61a7a3c883`.
2. Een kind of andere eigenaar probeert te sluiten; eigenaar hervat na netwerkverlies. → Geen onbevoegde mutatie; hervatten dupliceert niets; een melding krijgt een navolgbare moderatiestatus. Bewijs: scripts/lib/voltooi/buurtruil.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:buurtruil:d1eed75fcdf22219b7f1a817a733f0ad98c29e46259c33feb5399f36844f1eb8`.

**Externe voorwaarden / besluiten:** Geen aanvullend extern besluit benoemd; de bestaande toezegklasse en gemeenschappelijke scopepoort blijven gelden.

### 112. Wat speelt er - `link:kwesties`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P4, P5, P6, P7. **Ontwerpfamilie:** Command. **Budgetverwijzing:** sensitive → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** geen aanvullende taakafhankelijkheid benoemd. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/foundation/kwesties.html.

**Canonieke productbelofte:** een mens brengt in wat er speelt, ziet de kwestie op zijn naam, opent de uitkomst en trekt hem in -- een ander kan er niets mee.

**Huidige implementatie, statisch onderzocht:** De ingang gebruikt kwestie- en voorstel/samendoenmodules. De proef meet eigen inbreng en intrekken; kantoorsamenvoegen en DoeNetwerk vallen erbuiten.

**Bronnen:** [public/apps/foundation/kwesties.html](../../public/apps/foundation/kwesties.html), [scripts/lib/voltooi/kwesties.js](../../scripts/lib/voltooi/kwesties.js), [public/apps/foundation/voorstelbeeld.js](../../public/apps/foundation/voorstelbeeld.js), [public/apps/foundation/schil-os.js](../../public/apps/foundation/schil-os.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/foundation/kwesties.html` → `democratie.kwestie` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een transparant maatschappelijk dossier met herleidbare behandeling en zeggenschap over eigen bijdrage.

**Benodigde wijzigingen:**

- Bestaande kwestie, behandeling en uitkomst als bronvaste tijdlijn tonen.
- Samenvoegen, volgen en intrekken verbinden met gevolgenvoorvertoning; modelvoorstel blijft concept en wist nooit andermans bijdrage.

**Specifieke acceptatie en te leveren bewijs:**

1. Een gebruiker dient in; medewerker sluit met reden; gebruiker leest de uitkomst. → Elke overgang heeft actor, tijd en bron; gelezen ontstaat door eigen handeling; een ander ziet geen privé-inbreng. Bewijs: scripts/lib/voltooi/kwesties.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:kwesties:92161eeb19463945e4265cd97f2dfdc677894aed486c2ab2690dfae6fde77a73`.
2. Twee kwesties worden samengevoegd en één indiener wil intrekken. → Regels voor volgers/bijdragen worden toegepast; gevolgen staan vooraf vast en oorspronkelijke bijdragen blijven herleidbaar. Bewijs: scripts/lib/voltooi/kwesties.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:kwesties:54ba667e605b8e7e3a3bc74586d9fb4cf105892a2f8de9bb3d7db476f3f6c0db`.

**Externe voorwaarden / besluiten:** Nieuwe politieke bevoegdheden blijven achter POLITIEK-besluiten en externe voorwaarden; geen overtuigings-API of persoonlijke politieke score.

### 113. Geven - `link:geven`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P2, P3, P4, P5, P6, P7. **Ontwerpfamilie:** Ledger. **Budgetverwijzing:** transaction → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `link:pay`, `link:klimaat`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/foundation/geven.html.

**Canonieke productbelofte:** wie geeft ziet eerst wat er zou gebeuren en bevestigt een keer; een oormerk landt op een echt project, en een meerjarig plan en zijn machtiging beheert de gever zelf.

**Huidige implementatie, statisch onderzocht:** Bronnen bieden voornemen, bevestiging, projectgift, plan en machtiging. De proef opent de giftstand alleen in de testwereld en gebruikt een simulatiebank.

**Bronnen:** [public/apps/foundation/geven.html](../../public/apps/foundation/geven.html), [scripts/lib/voltooi/geven.js](../../scripts/lib/voltooi/geven.js), [public/apps/foundation/schil-os.js](../../public/apps/foundation/schil-os.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/foundation/geven.html` → `geven.doneren` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een transparant giftdossier met bestemming, voorwaarden, bevestiging en controleerbare verwerking.

**Benodigde wijzigingen:**

- Bestaande gift- en Pay-bronnen projecteren zonder nieuw ledger; voornemen, verwerking en ontvangstbewijs onderscheiden.
- Planwijziging en machtigingsintrekking verbinden met gevolgen voor toekomstige verplichtingen en herstel bij onbekende railuitkomst.

**Specifieke acceptatie en te leveren bewijs:**

1. Een gever bekijkt een geldig projectvoornemen en bevestigt tweemaal. → Vóór bevestiging nul boekingen; daarna maximaal één gift met hetzelfde project-ID, bedrag en ontvangstbewijs. Bewijs: scripts/lib/voltooi/geven.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:geven:7700c81ea25828628b07f3d2c9ffc19a857c739ea53e225dcaa97c5dd56f4793`.
2. Machtiging wordt ingetrokken terwijl een verzoek wacht en de rail geen antwoord geeft. → Geen nieuwe incasso met ingetrokken toestemming; uitkomst blijft onbekend tot bewijs en herstel veroorzaakt geen tweede afschrijving. Bewijs: scripts/lib/voltooi/geven.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:geven:3fb5ec6a8f3f205ea896e862005ea6e85f65fdb635b10fc33273d2462a340acb`.

**Externe voorwaarden / besluiten:** Productie-openstelling vraagt het GIFT-besluit, ontvangende wallet, juridische machtigingstekst en bevoegde betaal-/incassorail; ANBI alleen na aantoonbare beschikking.

### 114. Vrienden - `link:vrienden`

**Bouwcohort:** brede afbouw na G1. **Pakketafhankelijkheden bij volledige acceptatie:** P0, P1, P4, P5, P6, P7. **Ontwerpfamilie:** Salon. **Budgetverwijzing:** realtime → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.

**Samenwerkende capabilities:** `tab:gezin`. Deze verwijzingen geven geen toegang tot het andere domein.

**Bestaande ingang:** /apps/foundation/vrienden.html.

**Canonieke productbelofte:** een kind zoekt niet zelf: zijn ouder voegt een vriendje toe, de ouder van dat vriendje keurt goed, en pas dan sturen de kinderen elkaar berichten.

**Huidige implementatie, statisch onderzocht:** Het scherm heeft oudergoedkeuring, contact-, meld- en blokkeerfuncties. De proef meet ouder-ouderakkoord en berichten, geen bellen of live stroom.

**Bronnen:** [public/apps/foundation/vrienden.html](../../public/apps/foundation/vrienden.html), [scripts/lib/voltooi/vrienden.js](../../scripts/lib/voltooi/vrienden.js).

**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** `apps/foundation/vrienden.html` → `rtf.contacten` (eigenaar). Dit is geen extra domeineigenaar.

**Opgeslagen bewijs:** APPWERKT `BEWEZEN`; 1 schermkoppelingen in de Experience-snapshot. App-signature declaratief aanwezig. Geen verse kwalificatie uitgevoerd.

**Gewenste premium-eindtoestand:** Een beschermde contactwereld voor kinderen met begrijpelijke ouderregie en directe hulp bij ongewenst contact.

**Benodigde wijzigingen:**

- Contactkring, oudergoedkeuring, blokkeren en melden als één statuslus verbinden.
- Bestaande berichten-/belfuncties op leeftijd, intrekking tijdens sessies en herverbinden kwalificeren; geen openbare kindervindbaarheid.

**Specifieke acceptatie en te leveren bewijs:**

1. Ouder A nodigt kind B uit; vóór en na ouder B-akkoord wordt een bericht gestuurd. → Vóór akkoord nul bezorging; daarna precies één bericht aan de bedoelde ontvanger; kinderen omzeilen de ouderstap niet. Bewijs: scripts/lib/voltooi/vrienden.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:vrienden:2803386bb67c48e846376b4a34d80ca46b3ae1422aa88c2b009465d2c858b0af`.
2. Een ouder verbreekt de relatie tijdens gesprek of toegestane oproep. → Nieuwe inhoud wordt geweigerd; actieve toegang eindigt volgens contract; herverbinden heropent de relatie niet. Bewijs: scripts/lib/voltooi/vrienden.js uitbreiden en op de kandidaat uitvoeren; aanvullende browser-/ketenproef met bronstatus, autorisatiecontrole en hersteltrace vereist. De bronverwijzing is geen actueel uitvoeringsbewijs. Vereiste-ID: `acceptance:link:vrienden:f47443995a232a7c947ad7aa3ad546f549975f5827255e7e601971b30ee47e03`.

**Externe voorwaarden / besluiten:** Uitbreiding van kindermedia/bellen vraagt veiligheids-, moderatie- en bewaarbeleid vóór openstelling.

## Volledige schermscope en P0-toewijzing

Alle 316 ontdekte schermen hebben een bouw- en bewijsroute in SCHERMEIGENAAR.afbouw. 132 ondersteunende schermen hebben een eigen canoniek domein en toepasselijke gedeelde werkpakketten, zonder geforceerde MAPPEN-ingang. Zij blijven volledig in G2. Deze toewijzing is CONTRACT_DEFINED, niet PROVEN. Alle schermen vereisen de toepasselijke premiumcriteria; de concrete scenario- en budgetbinding staat in de tweede tabel en in EXPERIENCEWERKT.

| Scherm | Canonieke eigenaar / domein | Pakketten / capabilitydossiers | Scène / risico / taakfamilies |
|---|---|---|---|
| `/apps/agenda.html` | `apps/agenda.html` / `agenda.afspraken` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Horizon / sensitive / orientation, operations |
| `/apps/app.html` | `apps/app.html` / `kern.app` | P0, P1, P2, P3, P4, P5, P6, P7; `tab:reizen`, `tab:terplaatse`, `tab:zorg`, `os:bellen`, `os:rtf`, `os:snaps`, `os:videobellen`, `tab:assets`, `tab:bestellen`, `tab:betalen`, `tab:gezin`, `tab:salon`, `os:werk` | Horizon / critical / orientation, identity, transaction, travel, care, communication, operations |
| `/apps/appcel.html` | `apps/appcel.html` / `appstore.cel` | P0, P1, P4, P5, P6, P7; `link:appdossier` | Ceremony / critical / identity, content |
| `/apps/appstore-dossier.html` | `apps/appstore-dossier.html` / `appstore.dossier` | P0, P1, P2, P4, P5, P6, P7; `link:appdossier` | Ceremony / critical / identity, governance |
| `/apps/appstore-kantoor.html` | `apps/appstore-kantoor.html` / `appstore.keuring` | P0, P1, P2, P3, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / governance, transaction |
| `/apps/appstore-uitgever.html` | `apps/appstore-uitgever.html` / `appstore.uitgeven` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Atelier / critical / content, governance |
| `/apps/architect-pda.html` | `apps/architect-pda.html` / `ontwerp.opdracht` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Atelier / sensitive / content, operations |
| `/apps/arrival.html` | `apps/arrival.html` / `reizen.aankomst` | P0, P1, P2, P3, P4, P5, P6, P7; `link:aankomst` | Journey / critical / travel, transaction, identity |
| `/apps/attenties.html` | `apps/attenties.html` / `relaties.attenties` | P0, P1, P2, P3, P4, P5, P6, P7; `link:attenties` | Salon / critical / communication, transaction |
| `/apps/avond.html` | `apps/avond.html` / `leven.avond` | P0, P1, P2, P3, P4, P5, P6, P7; `link:leven`, `link:uitgaan` | Journey / critical / travel, transaction |
| `/apps/backoffice.html` | `apps/backoffice.html` / `kantoor.appstore-keuring` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / governance, identity, operations, care |
| `/apps/balans.html` | `apps/geld.html` / `geld.overzicht` | P0, P1, P2, P3, P4, P5, P6, P7; `link:balans` | Ledger / critical / redirect |
| `/apps/bank.html` | `apps/geld.html` / `geld.overzicht` | P0, P1, P2, P3, P4, P5, P6, P7; `link:bank` | Ledger / critical / redirect |
| `/apps/belastingkantoor.html` | `apps/belastingkantoor.html` / `overheid.belastingdienst` | P0, P1, P2, P3, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / governance, transaction |
| `/apps/berichten.html` | `apps/comm.html` / `comm.berichten` | P0, P1, P2, P4, P5, P6, P7; `link:berichten` | Salon / sensitive / redirect |
| `/apps/bestanden.html` | `apps/bestanden.html` / `docs.bestanden` | P0, P1, P2, P4, P5, P6, P7; `link:office` | Library / sensitive / content |
| `/apps/bestellen.html` | `apps/bestellen.html` / `horeca.bestellen` | P0, P1, P2, P3, P4, P5, P6, P7; `tab:bestellen`, `link:horeca` | Journey / critical / transaction, operations |
| `/apps/bewijsmap.html` | `apps/bewijsmap.html` / `identiteit.bewijzen` | P0, P1, P4, P5, P6, P7; `link:verificatie` | Ceremony / critical / identity |
| `/apps/boardroom.html` | `apps/boardroom.html` / `werk.boardroom` | P0, P1, P2, P4, P5, P6, P7; `link:werkos` | Command / critical / governance, identity |
| `/apps/boeken.html` | `apps/boeken.html` / `media.boeken` | P0, P4, P5, P6, P7; ondersteunende domeintaak | Library / standard / content |
| `/apps/browser.html` | `apps/browser.html` / `web.browser` | P0, P1, P4, P5, P6, P7; `link:browser` | Library / sensitive / content, identity |
| `/apps/camera.html` | `apps/camera.html` / `media.camera` | P0, P1, P4, P5, P6, P7; `link:camera` | Atelier / sensitive / content, identity |
| `/apps/cellier.html` | `apps/cellier.html` / `leven.cellier` | P0, P1, P2, P4, P5, P6, P7; `link:cellier` | Library / sensitive / content, operations |
| `/apps/cercle.html` | `apps/cercle.html` / `leven.cercle` | P0, P1, P2, P3, P4, P5, P6, P7; `link:cercle` | Ceremony / critical / identity, transaction |
| `/apps/chauffeur.html` | `apps/chauffeur.html` / `vervoer.chauffeur` | P0, P1, P2, P3, P4, P5, P6, P7; `link:ov` | Journey / critical / operations, travel |
| `/apps/clips.html` | `apps/clips.html` / `media.clips` | P0, P1, P4, P5, P6, P7; `link:clips` | Atelier / sensitive / content, communication |
| `/apps/codewoord.html` | `apps/veilig.html` / `veilig.noodcontacten` | P0, P1, P2, P3, P4, P5, P6, P7; `link:veilig` | Ceremony / critical / redirect |
| `/apps/comm.html` | `apps/comm.html` / `comm.berichten` | P0, P1, P2, P4, P5, P6, P7; `link:berichten` | Salon / sensitive / communication, identity |
| `/apps/command.html` | `apps/command.html` / `kantoor.command` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / operations, identity |
| `/apps/commerce.html` | `apps/commerce.html` / `winkel.commerce` | P0, P1, P2, P3, P4, P5, P6, P7; `link:commerce` | Ledger / critical / transaction, operations |
| `/apps/concern.html` | `apps/concern.html` / `werk.concern` | P0, P1, P2, P4, P5, P6, P7; `link:onderneming` | Command / critical / governance, identity |
| `/apps/concierge.html` | `apps/concierge.html` / `kantoor.concierge` | P0, P1, P2, P3, P4, P5, P6, P7; `link:rechterhand` | Command / critical / operations, transaction |
| `/apps/connect.html` | `apps/connect.html` / `ontdekken.connect` | P0, P1, P2, P4, P5, P6, P7; `link:connect` | Horizon / sensitive / learning, communication |
| `/apps/decision-room.html` | `apps/decision-room.html` / `werk.besluit` | P0, P1, P2, P4, P5, P6, P7; `link:decisionroom` | Command / critical / governance, identity |
| `/apps/defensie.html` | `apps/defensie.html` / `defensie.gereedheid` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / operations, care, governance |
| `/apps/dispatch.html` | `apps/dispatch.html` / `vervoer.dispatch` | P0, P1, P2, P3, P4, P5, P6, P7; `link:ov` | Command / critical / operations, travel |
| `/apps/doelen.html` | `apps/doelen.html` / `leven.doelen` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Horizon / sensitive / orientation, content |
| `/apps/doos.html` | `apps/doos.html` / `werk.zaakoverzicht` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / sensitive / operations |
| `/apps/entourage.html` | `apps/entourage.html` / `leven.entourage` | P0, P1, P2, P4, P5, P6, P7; `link:entourage` | Journey / sensitive / identity, operations |
| `/apps/festival-gast.html` | `apps/festival-gast.html` / `festival.gast` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Journey / sensitive / travel, communication |
| `/apps/festival.html` | `apps/festival.html` / `festival.crewdashboard` | P0, P1, P2, P3, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / operations, transaction |
| `/apps/flits.html` | `apps/flits.html` / `navigatie.verkeersmeldingen` | P0, P1, P2, P4, P5, P6, P7; `link:flits` | Spatial / sensitive / travel, content |
| `/apps/foodcourt.html` | `apps/foodcourt.html` / `horeca.reserveren` | P0, P1, P2, P3, P4, P5, P6, P7; `link:foodcourt` | Journey / critical / transaction, travel |
| `/apps/foundation/agenda.html` | `apps/agenda.html` / `agenda.afspraken` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Horizon / sensitive / orientation, identity |
| `/apps/foundation/arena.html` | `apps/foundation/arena.html` / `rtf.arena` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Spatial / sensitive / learning, communication |
| `/apps/foundation/babyboek.html` | `apps/foundation/babyboek.html` / `rtf.fotoboekje` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Library / sensitive / content, identity |
| `/apps/foundation/beheer.html` | `apps/foundation/beheer.html` / `gezin.beheer` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Ceremony / critical / identity, governance |
| `/apps/foundation/beroepen.html` | `apps/foundation/beroepen.html` / `rtf.beroepenbieb` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Library / sensitive / learning, content |
| `/apps/foundation/bieb.html` | `apps/foundation/bieb.html` / `rtf.appbieb` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Library / sensitive / learning, content |
| `/apps/foundation/bord.html` | `apps/foundation/bord.html` / `rtf.bord` | P0, P1, P4, P5, P6, P7; `link:rtfbord` | Atelier / sensitive / learning, content, identity |
| `/apps/foundation/budget.html` | `apps/foundation/budget.html` / `rtf.maandbegroting` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Ledger / sensitive / learning, content |
| `/apps/foundation/buurtruil.html` | `apps/foundation/buurtruil.html` / `gemeenschap.buurtruil` | P0, P1, P2, P4, P5, P6, P7; `link:buurtruil` | Salon / sensitive / communication, operations |
| `/apps/foundation/campus.html` | `apps/foundation/campus.html` / `leren.overzicht` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Horizon / sensitive / orientation, learning |
| `/apps/foundation/club.html` | `apps/foundation/club.html` / `rtf.club` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / sensitive / operations, communication |
| `/apps/foundation/clubswerk.html` | `apps/foundation/clubswerk.html` / `kantoor.clubbeheer` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / operations, governance |
| `/apps/foundation/contact.html` | `apps/foundation/contact.html` / `rtf.contact` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Salon / sensitive / communication, identity |
| `/apps/foundation/cv.html` | `apps/foundation/cv.html` / `werk.cvmaker` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Atelier / sensitive / learning, content |
| `/apps/foundation/dromen.html` | `apps/foundation/dromen.html` / `rtf.dromen` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Horizon / sensitive / content, communication |
| `/apps/foundation/geld-later.html` | `apps/foundation/geld-later.html` / `rtf.geld-later` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Horizon / sensitive / orientation, learning |
| `/apps/foundation/geld.html` | `apps/foundation/geld.html` / `geld.sparen` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Ledger / sensitive / learning, content |
| `/apps/foundation/geloofbieb.html` | `apps/foundation/geloofbieb.html` / `rtf.geloofbieb` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Library / sensitive / content, identity |
| `/apps/foundation/geven.html` | `apps/foundation/geven.html` / `geven.doneren` | P0, P1, P2, P3, P4, P5, P6, P7; `link:geven` | Ledger / critical / transaction, identity |
| `/apps/foundation/gevoel.html` | `apps/foundation/gevoel.html` / `rtf.gevoel` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Ceremony / critical / care, identity |
| `/apps/foundation/gezondheid-welzijn.html` | `apps/foundation/gezondheid-welzijn.html` / `rtf.gezondheid-welzijn` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Horizon / critical / care, orientation |
| `/apps/foundation/gezondheid.html` | `apps/foundation/gezondheid.html` / `rtf.gezondheidsmaatje` | P0, P1, P2, P3, P4, P5, P6, P7; `link:foundationzorg` | Ceremony / critical / care, identity |
| `/apps/foundation/hulpwijzer.html` | `apps/foundation/hulpwijzer.html` / `rtf.hulpwijzer` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Library / critical / care, public |
| `/apps/foundation/index.html` | `apps/foundation/index.html` / `rtf.start` | P0, P1, P4, P5, P6, P7; `os:rtf` | Ceremony / critical / identity, orientation |
| `/apps/foundation/kantoor.html` | `apps/foundation/kantoor.html` / `kantoor.rtfbeheer` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / governance, operations |
| `/apps/foundation/keuken.html` | `apps/foundation/keuken.html` / `rtf.gezinskeuken` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Atelier / sensitive / content, operations |
| `/apps/foundation/klas.html` | `apps/foundation/klas.html` / `rtf.klas` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Spatial / sensitive / learning, identity |
| `/apps/foundation/kleuren.html` | `apps/foundation/kleuren.html` / `rtf.kleuren` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Spatial / sensitive / learning |
| `/apps/foundation/klimaatfonds.html` | `apps/foundation/klimaatfonds.html` / `gemeenschap.klimaatfonds` | P0, P1, P2, P4, P5, P6, P7; `link:klimaat` | Horizon / critical / governance, operations |
| `/apps/foundation/klusjes.html` | `apps/foundation/klusjes.html` / `rtf.klusjes` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / sensitive / learning, operations |
| `/apps/foundation/kompas.html` | `apps/foundation/kompas.html` / `rtf.kompas` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Salon / critical / care, identity |
| `/apps/foundation/kwestiekantoor.html` | `apps/foundation/kwestiekantoor.html` / `kantoor.democratie` | P0, P1, P2, P4, P5, P6, P7; `link:kwesties` | Command / critical / governance, identity |
| `/apps/foundation/kwesties.html` | `apps/foundation/kwesties.html` / `democratie.kwestie` | P0, P1, P2, P4, P5, P6, P7; `link:kwesties` | Command / critical / governance, identity |
| `/apps/foundation/leerpaspoort.html` | `apps/rtgschool.html` / `leren.school` | P0, P1, P4, P5, P6, P7; `link:school` | Library / sensitive / learning, identity |
| `/apps/foundation/leren.html` | `apps/foundation/leren.html` / `rtf.leren-groei` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Horizon / sensitive / learning, orientation |
| `/apps/foundation/liedjes.html` | `apps/foundation/liedjes.html` / `rtf.liedjes` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Library / sensitive / content, learning |
| `/apps/foundation/magazine.html` | `apps/foundation/magazine.html` / `media.magazine` | P0, P4, P5, P6, P7; ondersteunende domeintaak | Library / standard / content, public |
| `/apps/foundation/mail.html` | `apps/foundation/mail.html` / `rtf.bericht` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Salon / sensitive / communication, identity |
| `/apps/foundation/markt.html` | `apps/foundation/markt.html` / `winkel.tweedehands` | P0, P1, P2, P3, P4, P5, P6, P7; ondersteunende domeintaak | Journey / critical / transaction, identity |
| `/apps/foundation/mediawijs.html` | `apps/foundation/mediawijs.html` / `rtf.mediawijs` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Atelier / critical / learning, care |
| `/apps/foundation/meedoen-ontdekken.html` | `apps/foundation/meedoen-ontdekken.html` / `rtf.meedoen` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Horizon / sensitive / orientation, operations |
| `/apps/foundation/memorie.html` | `apps/foundation/memorie.html` / `rtf.memorie` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Spatial / sensitive / learning |
| `/apps/foundation/mijnbanden.html` | `apps/foundation/mijnbanden.html` / `rtf.wie-mag-zien` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Ceremony / critical / identity |
| `/apps/foundation/ochtend.html` | `apps/foundation/ochtend.html` / `leven.ochtendritme` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Horizon / sensitive / orientation, content |
| `/apps/foundation/onveilig.html` | `apps/foundation/onveilig.html` / `rtf.onveilig` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Ceremony / critical / care, public |
| `/apps/foundation/oppasinfo.html` | `apps/foundation/oppasinfo.html` / `gezin.oppasinfo` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Ceremony / critical / care, identity |
| `/apps/foundation/opvoeden.html` | `apps/foundation/opvoeden.html` / `gezin.opvoedhulp` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Library / critical / care, content |
| `/apps/foundation/os-bestuur.html` | `apps/foundation/os-bestuur.html` / `kantoor.governance` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / governance |
| `/apps/foundation/os-deelnemer.html` | `apps/foundation/os-deelnemer.html` / `hulp.aanvraagstatus` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Ceremony / critical / identity, care |
| `/apps/foundation/os-donateur.html` | `apps/foundation/os-donateur.html` / `gift.overzicht` | P0, P1, P2, P3, P4, P5, P6, P7; `link:geven` | Ledger / critical / transaction, identity |
| `/apps/foundation/os-portaal.html` | `apps/foundation/os-portaal.html` / `portaal.toegang` | P0, P1, P2, P4, P5, P6, P7; `link:rtfportaal` | Command / critical / identity, governance |
| `/apps/foundation/os-publiek.html` | `apps/foundation/os-publiek.html` / `wereld.foundation` | P0, P1, P4, P5, P6, P7; `link:rtfbuurt` | Horizon / standard / public, orientation |
| `/apps/foundation/os-veld.html` | `apps/foundation/os-veld.html` / `werk.veldwerk` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / care, operations |
| `/apps/foundation/os-vrijwilliger.html` | `apps/foundation/os-vrijwilliger.html` / `werk.vrijwilligerswerk` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / identity, operations |
| `/apps/foundation/os.html` | `apps/foundation/os.html` / `kantoor.hub` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / governance, operations |
| `/apps/foundation/overhoren.html` | `apps/foundation/overhoren.html` / `rtf.overhoren` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Atelier / sensitive / learning |
| `/apps/foundation/partner.html` | `apps/foundation/partner.html` / `bestuur.stadsraad` | P0, P1, P2, P4, P5, P6, P7; `link:rtfportaal` | Command / critical / governance |
| `/apps/foundation/pesten.html` | `apps/foundation/pesten.html` / `hulp.pesten` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Ceremony / critical / care, communication |
| `/apps/foundation/presenteren.html` | `apps/foundation/presenteren.html` / `leren.presenteren` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Atelier / sensitive / learning, content |
| `/apps/foundation/privacy.html` | `apps/foundation/privacy.html` / `rtf.privacy-uitleg` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Library / sensitive / public, identity |
| `/apps/foundation/projecten.html` | `apps/foundation/projecten.html` / `leren.project` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Atelier / sensitive / learning, content |
| `/apps/foundation/rechten.html` | `apps/foundation/rechten.html` / `info.rechten` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Library / critical / public, learning |
| `/apps/foundation/registreren.html` | `apps/foundation/registreren.html` / `account.registratie` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Ceremony / critical / identity, governance |
| `/apps/foundation/reis.html` | `apps/foundation/reis.html` / `reizen.aanvraag` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Journey / critical / travel, care |
| `/apps/foundation/rust.html` | `apps/foundation/rust.html` / `gezondheid.rust` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Ceremony / critical / care, content |
| `/apps/foundation/samen-thuis.html` | `apps/foundation/samen-thuis.html` / `rtf.samen-thuis` | P0, P1, P4, P6, P7; ondersteunende domeintaak | Horizon / sensitive / orientation |
| `/apps/foundation/school.html` | `apps/foundation/school.html` / `rtf.school` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Horizon / sensitive / learning, orientation |
| `/apps/foundation/schoolbieb.html` | `apps/foundation/schoolbieb.html` / `rtf.schoolbieb` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Library / sensitive / learning, content |
| `/apps/foundation/schrift.html` | `apps/foundation/schrift.html` / `leren.livesles` | P0, P1, P4, P5, P6, P7; `link:rtfschrift` | Atelier / sensitive / learning, content, identity |
| `/apps/foundation/schrijven.html` | `apps/foundation/schrijven.html` / `leren.schrijven` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Atelier / sensitive / learning, content |
| `/apps/foundation/societeit.html` | `apps/foundation/societeit.html` / `rtf.societeit` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Spatial / sensitive / learning, communication |
| `/apps/foundation/speelhal.html` | `apps/foundation/speelhal.html` / `spel.speelhal` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Spatial / sensitive / learning |
| `/apps/foundation/speeltuin.html` | `apps/foundation/speeltuin.html` / `spel.speeltuin` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Spatial / sensitive / learning |
| `/apps/foundation/steun.html` | `apps/foundation/steun.html` / `gezondheid.steun` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Salon / critical / care, identity |
| `/apps/foundation/studie.html` | `apps/foundation/studie.html` / `leren.volwassenenonderwijs` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Library / sensitive / learning, public |
| `/apps/foundation/tellen.html` | `apps/foundation/tellen.html` / `spel.tellen` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Spatial / sensitive / learning |
| `/apps/foundation/toetsen.html` | `apps/foundation/toetsen.html` / `leren.toetsplanner` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Horizon / sensitive / learning, operations |
| `/apps/foundation/veilig-vertrouwd.html` | `apps/foundation/veilig-vertrouwd.html` / `rtf.veilig-vertrouwd` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Ceremony / critical / care, identity |
| `/apps/foundation/veilig.html` | `apps/foundation/veilig.html` / `rtf.veilig-thuis` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Ceremony / critical / care, communication |
| `/apps/foundation/verhaaltje.html` | `apps/foundation/verhaaltje.html` / `media.verhalen` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Library / sensitive / content, learning |
| `/apps/foundation/verjaardagen.html` | `apps/foundation/verjaardagen.html` / `gezin.verjaardagen` | P0, P1, P2, P3, P4, P5, P6, P7; ondersteunende domeintaak | Journey / critical / transaction, communication |
| `/apps/foundation/vrienden.html` | `apps/foundation/vrienden.html` / `rtf.contacten` | P0, P1, P4, P5, P6, P7; `link:vrienden` | Salon / sensitive / communication, identity |
| `/apps/foundation/wegwijzer.html` | `apps/foundation/wegwijzer.html` / `hulp.wegwijzer` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Ceremony / critical / care, public |
| `/apps/foundation/werk.html` | `apps/foundation/werk.html` / `werk.vacatures` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Library / sensitive / learning, public |
| `/apps/foundation/winkel.html` | `apps/foundation/winkel.html` / `rtf.winkel` | P0, P1, P2, P3, P4, P5, P6, P7; ondersteunende domeintaak | Journey / critical / transaction |
| `/apps/foundation/zakgeld.html` | `apps/foundation/zakgeld.html` / `geld.zakgeld` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Ledger / sensitive / learning, content |
| `/apps/foundation/zorg.html` | `apps/foundation/zorg.html` / `rtf.hulp-zorg` | P0, P1, P2, P3, P4, P5, P6, P7; `link:foundationzorg` | Ceremony / critical / care, identity, transaction |
| `/apps/galerij.html` | `apps/galerij.html` / `media.galerij` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Library / sensitive / content |
| `/apps/garderobe.html` | `apps/garderobe.html` / `leven.garderobe` | P0, P1, P2, P4, P5, P6, P7; `link:garderobe` | Library / sensitive / content, identity |
| `/apps/gast.html` | `apps/gast.html` / `horeca.tafelgast` | P0, P1, P2, P3, P4, P5, P6, P7; `link:horeca` | Journey / critical / transaction, operations |
| `/apps/gedachten.html` | `apps/gedachten.html` / `leven.gedachtenboek` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Atelier / critical / content, identity |
| `/apps/geld-command.html` | `apps/geld.html` / `geld.overzicht` | P0, P1, P2, P3, P4, P5, P6, P7; `link:geldcommand` | Ledger / critical / redirect |
| `/apps/geld.html` | `apps/geld.html` / `geld.overzicht` | P0, P1, P2, P3, P4, P5, P6, P7; `link:balans`, `link:bank`, `link:geldcommand`, `link:labfonds`, `link:logboek`, `link:mecenaat`, `link:nalatenschap`, `link:rtgcode`, `link:wallet`, `link:wbw` | Ledger / critical / transaction, identity, governance |
| `/apps/gemeente.html` | `apps/gemeente.html` / `overheid.gemeente-burger` | P0, P1, P2, P3, P4, P5, P6, P7; ondersteunende domeintaak | Journey / critical / governance, transaction |
| `/apps/gemeenteloket.html` | `apps/gemeenteloket.html` / `overheid.loketbeheer` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / governance, operations |
| `/apps/gemeentepda.html` | `apps/gemeentepda.html` / `overheid.buitendienst` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / governance, operations |
| `/apps/genootschap.html` | `apps/genootschap.html` / `sociaal.genootschap` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Salon / critical / communication, governance |
| `/apps/gereedschap.html` | `apps/gereedschap.html` / `kern.gereedschap` | P0, P4, P5, P6, P7; ondersteunende domeintaak | Atelier / standard / content |
| `/apps/ghost.html` | `apps/ghost.html` / `vervoer.chauffeuradvies` | P0, P1, P2, P3, P4, P5, P6, P7; `link:ov` | Command / sensitive / operations, travel |
| `/apps/handel.html` | `apps/handel.html` / `handel.inkoop` | P0, P1, P2, P3, P4, P5, P6, P7; `link:onderneming` | Command / critical / transaction, operations |
| `/apps/hangar.html` | `apps/hangar.html` / `reizen.vliegtuig` | P0, P1, P2, P4, P5, P6, P7; `link:hangar` | Command / critical / travel, operations |
| `/apps/hardware-pda.html` | `apps/hardware-pda.html` / `werk.werkopdrachten` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / sensitive / operations |
| `/apps/home.html` | `apps/home.html` / `woning.apparaten` | P0, P1, P2, P3, P4, P5, P6, P7; `link:wonen` | Command / critical / operations, identity |
| `/apps/horeca-bar.html` | `apps/horeca-bar.html` / `horeca.bar` | P0, P1, P2, P3, P4, P5, P6, P7; `link:horeca` | Command / critical / operations, transaction |
| `/apps/horeca-beheer.html` | `apps/horeca-beheer.html` / `horeca.beheer` | P0, P1, P2, P3, P4, P5, P6, P7; `link:horeca` | Command / critical / operations, identity |
| `/apps/horeca-bezorg.html` | `apps/horeca-bezorg.html` / `horeca.bezorging` | P0, P1, P2, P3, P4, P5, P6, P7; `link:horeca` | Journey / critical / operations, travel |
| `/apps/horeca-club.html` | `apps/horeca-club.html` / `horeca.club` | P0, P1, P2, P3, P4, P5, P6, P7; `link:horeca` | Command / critical / transaction, identity |
| `/apps/horeca-events.html` | `apps/horeca-events.html` / `horeca.events` | P0, P1, P2, P3, P4, P5, P6, P7; `link:horeca` | Command / critical / transaction, operations |
| `/apps/horeca-expeditie.html` | `apps/horeca-expeditie.html` / `horeca.keuken` | P0, P1, P2, P3, P4, P5, P6, P7; `link:horeca` | Command / critical / operations, transaction |
| `/apps/horeca-haccp.html` | `apps/horeca-haccp.html` / `horeca.haccp` | P0, P1, P2, P3, P4, P5, P6, P7; `link:horeca` | Command / critical / care, operations |
| `/apps/horeca-hotel.html` | `apps/horeca-hotel.html` / `horeca.hotel` | P0, P1, P2, P3, P4, P5, P6, P7; `link:horeca` | Command / critical / transaction, operations |
| `/apps/horeca-pda.html` | `apps/horeca-pda.html` / `horeca.pda` | P0, P1, P2, P3, P4, P5, P6, P7; `link:horeca` | Command / critical / operations, transaction |
| `/apps/horeca-vloer.html` | `apps/horeca-vloer.html` / `horeca.vloer` | P0, P1, P2, P3, P4, P5, P6, P7; `link:horeca` | Spatial / critical / operations |
| `/apps/horeca.html` | `apps/horeca.html` / `horeca.dashboard` | P0, P1, P2, P3, P4, P5, P6, P7; `link:horeca` | Command / critical / operations, transaction, identity |
| `/apps/hotels.html` | `apps/hotels.html` / `verblijf.hotel` | P0, P1, P2, P3, P4, P5, P6, P7; `tab:reizen`, `link:reisboek` | Journey / critical / travel, transaction |
| `/apps/ik.html` | `apps/ik.html` / `instellingen.profiel` | P0, P1, P4, P5, P6, P7; `link:ik` | Ceremony / sensitive / identity, content |
| `/apps/isolatie.html` | `apps/isolatie.html` / `techniek.isolatie` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / operations, identity |
| `/apps/juridisch.html` | `apps/juridisch.html` / `site.juridisch` | P0, P1, P4, P5, P6, P7; `link:juridisch` | Library / standard / public, orientation |
| `/apps/juridisch/partnervoorwaarden.html` | `apps/juridisch/partnervoorwaarden.html` / `site.juridisch.partnervoorwaarden` | P0, P1, P4, P5, P6, P7; `link:juridisch` | Library / standard / public |
| `/apps/juridisch/privacy.html` | `apps/juridisch/privacy.html` / `site.juridisch.privacy` | P0, P1, P4, P5, P6, P7; `link:juridisch` | Library / standard / public |
| `/apps/juridisch/voorwaarden.html` | `apps/juridisch/voorwaarden.html` / `site.juridisch.voorwaarden` | P0, P1, P4, P5, P6, P7; `link:juridisch` | Library / standard / public |
| `/apps/kantoor.html` | `apps/kantoor.html` / `wereld.work` | P0, P1, P2, P4, P5, P6, P7; `link:werkos` | Horizon / sensitive / orientation, operations |
| `/apps/kantoorpda.html` | `apps/personeel.html` / `zaak.teamroom` | P0, P1, P2, P4, P5, P6, P7; `os:werk` | Command / critical / redirect |
| `/apps/kantoren.html` | `apps/kantoren.html` / `kantoor.kantoren` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / orientation, identity |
| `/apps/kassa.html` | `apps/kassa.html` / `handel.kassa` | P0, P1, P2, P3, P4, P5, P6, P7; `link:horeca` | Ledger / critical / transaction, operations |
| `/apps/klankwerk-kantoor.html` | `apps/klankwerk-kantoor.html` / `kantoor.uitgavenaam` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / governance, content |
| `/apps/klankwerk.html` | `apps/klankwerk.html` / `media.muziek-maken` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Atelier / sensitive / content |
| `/apps/kosten.html` | `apps/kosten.html` / `kosten.beheer` | P0, P1, P2, P3, P4, P5, P6, P7; ondersteunende domeintaak | Ledger / critical / transaction, governance |
| `/apps/krant.html` | `apps/krant.html` / `media.krant` | P0, P1, P4, P5, P6, P7; `link:krant` | Library / standard / content, public |
| `/apps/lab.html` | `apps/lab.html` / `kantoor.onderzoek` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / governance, operations |
| `/apps/labfonds.html` | `apps/geld.html` / `geld.overzicht` | P0, P1, P2, P3, P4, P5, P6, P7; `link:labfonds` | Ledger / critical / redirect |
| `/apps/labpas.html` | `apps/labpas.html` / `onderzoek.deelname` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Horizon / sensitive / identity, learning |
| `/apps/leerhuis-werk.html` | `apps/leerhuis-werk.html` / `leerhuis.werk` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / learning, governance |
| `/apps/leerhuis.html` | `apps/leerhuis.html` / `leerhuis.mijn` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Library / sensitive / learning, identity |
| `/apps/lesmaker.html` | `apps/lesmaker.html` / `leren.lesmaker` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Atelier / critical / learning, content |
| `/apps/leven.html` | `apps/leven.html` / `leven.werkblad` | P0, P1, P2, P3, P4, P5, P6, P7; `link:leven` | Horizon / critical / travel, transaction |
| `/apps/leverancier-aanvragen.html` | `apps/leverancier-aanvragen.html` / `handel.aanvragen` | P0, P1, P2, P3, P4, P5, P6, P7; `link:mall`, `link:mijnmall` | Command / critical / transaction, operations |
| `/apps/leverancier-commerce.html` | `apps/leverancier-commerce.html` / `handel.verkoopwegen` | P0, P1, P2, P3, P4, P5, P6, P7; `link:commerce`, `link:mall` | Command / critical / transaction, operations |
| `/apps/leverancier-rtmail.html` | `apps/leverancier-rtmail.html` / `zaak.rtmail` | P0, P1, P2, P4, P5, P6, P7; `link:rtmail` | Salon / sensitive / communication, identity |
| `/apps/leverancier-service.html` | `apps/leverancier-service.html` / `service.hulp` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / sensitive / communication, operations |
| `/apps/leverancier.html` | `apps/leverancier.html` / `zaak.beheer` | P0, P1, P2, P3, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / operations, transaction |
| `/apps/library.html` | `apps/library.html` / `library.werk` | P0, P1, P2, P4, P5, P6, P7; `link:library` | Library / critical / content, governance |
| `/apps/life.html` | `apps/life.html` / `dag.overzicht` | P0, P1, P2, P4, P5, P6, P7; `link:vandaag` | Horizon / critical / orientation, care, identity |
| `/apps/lifestyle.html` | `apps/lifestyle.html` / `concierge.privekantoor` | P0, P1, P2, P3, P4, P5, P6, P7; `link:rechterhand` | Command / critical / operations, transaction, identity |
| `/apps/living-os.html` | `apps/living-os.html` / `leven.vooruitzicht` | P0, P1, P2, P3, P4, P5, P6, P7; `link:vooruitzicht` | Horizon / critical / orientation, travel, transaction |
| `/apps/living-world.html` | `apps/living-world.html` / `wereld.ervaringslus` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Journey / sensitive / travel, content |
| `/apps/livinglab.html` | `apps/livinglab.html` / `onderzoek.lab` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Atelier / critical / learning, identity |
| `/apps/logboek.html` | `apps/geld.html` / `geld.overzicht` | P0, P1, P2, P3, P4, P5, P6, P7; `link:logboek` | Ledger / critical / redirect |
| `/apps/loonstrook.html` | `apps/loonstrook.html` / `loon.strook` | P0, P1, P2, P3, P4, P5, P6, P7; `link:loonstrook` | Ledger / critical / transaction, identity |
| `/apps/loopbaan.html` | `apps/loopbaan.html` / `loopbaan.ledger` | P0, P1, P2, P4, P5, P6, P7; `link:loopbaan` | Library / sensitive / content, identity |
| `/apps/loopbaanbewijs.html` | `apps/loopbaanbewijs.html` / `loopbaan.bewijs` | P0, P1, P2, P4, P5, P6, P7; `link:loopbaan` | Ceremony / sensitive / public, identity |
| `/apps/luchthaven.html` | `apps/luchthaven.html` / `luchthaven.operatie` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / operations, travel |
| `/apps/magnaat-kantoor.html` | `apps/magnaat-kantoor.html` / `kantoor.controleregister` | P0, P1, P2, P4, P5, P6, P7; `link:magnaat` | Command / critical / governance, operations |
| `/apps/magnaat-partnerstudio.html` | `apps/magnaat-partnerstudio.html` / `handel.digitaletweeling` | P0, P1, P2, P4, P5, P6, P7; `link:magnaat` | Atelier / sensitive / content, operations |
| `/apps/magnaat.html` | `apps/magnaat.html` / `spel.magnaat` | P0, P1, P2, P4, P5, P6, P7; `link:magnaat` | Spatial / sensitive / learning, operations |
| `/apps/maison.html` | `apps/maison.html` / `woning.huishouden` | P0, P1, P2, P4, P5, P6, P7; `link:maison` | Command / sensitive / operations, identity |
| `/apps/mall.html` | `apps/mall.html` / `winkel.mall` | P0, P1, P2, P3, P4, P5, P6, P7; `link:mall` | Library / critical / transaction, travel |
| `/apps/marechaussee.html` | `apps/marechaussee.html` / `luchthaven.grensbewaking` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / operations, governance |
| `/apps/mecenaat.html` | `apps/geld.html` / `geld.overzicht` | P0, P1, P2, P3, P4, P5, P6, P7; `link:mecenaat` | Ledger / critical / redirect |
| `/apps/media.html` | `apps/media.html` / `media.centrum` | P0, P1, P2, P4, P5, P6, P7; `link:mediaos` | Library / sensitive / content, identity |
| `/apps/medicijnen.html` | `apps/medicijnen.html` / `gezondheid.medicatie` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Ceremony / critical / care, identity |
| `/apps/meet.html` | `apps/meet.html` / `comm.videobellen` | P0, P1, P4, P5, P6, P7; `os:videobellen` | Salon / sensitive / communication |
| `/apps/meldkamer.html` | `apps/meldkamer.html` / `zorg.meldkamer` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / care, operations |
| `/apps/memo.html` | `apps/memo.html` / `docs.spraakmemo` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Atelier / sensitive / content |
| `/apps/merken.html` | `apps/merken.html` / `kantoor.merken` | P0, P1, P2, P4, P5, P6, P7; `link:onderneming` | Command / critical / governance, identity |
| `/apps/metier.html` | `apps/geld.html` / `geld.overzicht` | P0, P1, P2, P3, P4, P5, P6, P7; `link:geldcommand` | Ledger / critical / redirect |
| `/apps/mijn-gegevens.html` | `apps/mijn-gegevens.html` / `privacy.gegevens` | P0, P1, P2, P4, P5, P6, P7; `link:gegevens` | Library / critical / identity |
| `/apps/mijn-isolatie.html` | `apps/mijn-isolatie.html` / `account.bescherming` | P0, P1, P2, P4, P5, P6, P7; `link:bescherming` | Ceremony / critical / identity, operations |
| `/apps/mijn-neigingen.html` | `apps/mijn-neigingen.html` / `privacy.voorkeuren` | P0, P1, P2, P4, P5, P6, P7; `link:neigingen` | Ceremony / critical / identity |
| `/apps/mijn-post.html` | `apps/mijn-post.html` / `instellingen.postvoorkeuren` | P0, P1, P4, P5, P6, P7; `link:post` | Ceremony / sensitive / identity, communication |
| `/apps/mijn-relaties.html` | `apps/mijn-relaties.html` / `privacy.toegang` | P0, P1, P2, P4, P5, P6, P7; `link:relaties` | Ceremony / critical / identity |
| `/apps/mijn-sessies.html` | `apps/mijn-sessies.html` / `account.sessies` | P0, P1, P4, P5, P6, P7; `link:sessies` | Ceremony / critical / identity |
| `/apps/mijnmall.html` | `apps/mijnmall.html` / `winkel.bestellingen` | P0, P1, P2, P3, P4, P5, P6, P7; `link:mijnmall` | Journey / critical / transaction, operations |
| `/apps/move.html` | `apps/move.html` / `reizen.haalbaarheid` | P0, P1, P2, P4, P5, P6, P7; `link:move` | Journey / sensitive / travel, orientation |
| `/apps/muziek.html` | `apps/muziek.html` / `media.luisteren` | P0, P1, P4, P5, P6, P7; `link:muziek` | Library / sensitive / content, communication |
| `/apps/nalatenschap.html` | `apps/geld.html` / `geld.overzicht` | P0, P1, P2, P3, P4, P5, P6, P7; `link:nalatenschap` | Ledger / critical / redirect |
| `/apps/navigatie.html` | `apps/navigatie.html` / `navigatie.route` | P0, P1, P2, P4, P5, P6, P7; `link:navigatie` | Spatial / sensitive / travel, identity |
| `/apps/nieuws.html` | `apps/nieuws.html` / `nieuws.lezen` | P0, P1, P4, P5, P6, P7; `link:nieuws` | Library / standard / content, public |
| `/apps/notities.html` | `apps/notities.html` / `docs.notities` | P0, P1, P2, P4, P5, P6, P7; `link:office` | Atelier / sensitive / content |
| `/apps/office.html` | `apps/office.html` / `docs.office` | P0, P1, P2, P4, P5, P6, P7; `link:office` | Atelier / sensitive / content, identity |
| `/apps/onderhoud.html` | `apps/onderhoud.html` / `woning.onderhoud` | P0, P1, P2, P3, P4, P5, P6, P7; `link:wonen` | Command / sensitive / operations |
| `/apps/onderneming.html` | `apps/onderneming.html` / `werk.onderneming` | P0, P1, P2, P3, P4, P5, P6, P7; `link:onderneming` | Command / critical / operations, governance, transaction |
| `/apps/oog.html` | `apps/oog.html` / `zaak.visie-inspectie` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Atelier / critical / operations, identity |
| `/apps/ov.html` | `apps/ov.html` / `vervoer.rit` | P0, P1, P2, P3, P4, P5, P6, P7; `link:ov` | Journey / critical / travel, transaction |
| `/apps/ovcontrol.html` | `apps/ovcontrol.html` / `zaak.ovregie` | P0, P1, P2, P3, P4, P5, P6, P7; `link:ov`, `link:ovroutes` | Command / critical / operations, travel |
| `/apps/ovdienst.html` | `apps/ovdienst.html` / `zaak.ovdienst` | P0, P1, P2, P3, P4, P5, P6, P7; `link:ov` | Command / critical / operations, travel |
| `/apps/overheid.html` | `apps/overheid.html` / `overheid.rijk-burger` | P0, P1, P2, P3, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / governance, transaction |
| `/apps/overheidspda.html` | `apps/overheidspda.html` / `overheid.pda` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / operations, identity |
| `/apps/ovroutes.html` | `apps/ovroutes.html` / `zaak.ovroutes` | P0, P1, P2, P4, P5, P6, P7; `link:ovroutes` | Spatial / sensitive / travel, operations |
| `/apps/pakketten.html` | `apps/pakketten.html` / `werk.bedrijfspakket` | P0, P1, P2, P4, P5, P6, P7; `link:onderneming` | Atelier / sensitive / operations, content |
| `/apps/partner-network.html` | `apps/partner-network.html` / `zaak.partnernetwerk` | P0, P1, P2, P4, P5, P6, P7; `link:partnernetwerk` | Command / critical / operations, governance |
| `/apps/partner-worden.html` | `apps/partner-worden.html` / `zaak.partnerworden` | P0, P1, P2, P4, P5, P6, P7; `link:partnernetwerk` | Ceremony / critical / identity, governance |
| `/apps/passkeys.html` | `apps/passkeys.html` / `account.passkeys` | P0, P1, P4, P5, P6, P7; `link:passkeys` | Ceremony / critical / identity |
| `/apps/pay.html` | `apps/pay.html` / `betalen.rtgpay` | P0, P1, P2, P3, P4, P5, P6, P7; `link:pay` | Ledger / critical / transaction, identity |
| `/apps/payroll.html` | `apps/payroll.html` / `kantoor.payroll` | P0, P1, P2, P3, P4, P5, P6, P7; `link:loonstrook` | Ledger / critical / transaction, identity |
| `/apps/personeel.html` | `apps/personeel.html` / `zaak.teamroom` | P0, P1, P2, P4, P5, P6, P7; `os:werk` | Command / critical / operations, identity |
| `/apps/platformregister.html` | `apps/platformregister.html` / `kantoor.platformregister` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / sensitive / operations |
| `/apps/podium.html` | `apps/podium.html` / `media.podium` | P0, P1, P2, P3, P4, P5, P6, P7; `link:podium` | Salon / critical / content, communication, transaction |
| `/apps/project-room.html` | `apps/project-room.html` / `werk.project` | P0, P1, P2, P4, P5, P6, P7; `link:projectroom` | Command / critical / operations, governance |
| `/apps/pulse.html` | `apps/pulse.html` / `sociaal.pulse` | P0, P1, P4, P5, P6, P7; `link:pulse` | Salon / sensitive / communication, content |
| `/apps/rechtbank.html` | `apps/rechtbank.html` / `overheid.rechtbank` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / governance, identity |
| `/apps/redactie-pda.html` | `apps/redactie.html` / `zaak.redactie` | P0, P1, P4, P5, P6, P7; `link:nieuws` | Atelier / sensitive / content |
| `/apps/redactie.html` | `apps/redactie.html` / `zaak.redactie` | P0, P1, P4, P5, P6, P7; `link:nieuws` | Atelier / sensitive / content |
| `/apps/redactiekantoor.html` | `apps/redactiekantoor.html` / `kantoor.redactie` | P0, P1, P2, P4, P5, P6, P7; `link:nieuws` | Command / critical / governance, content |
| `/apps/reisboek.html` | `apps/reisboek.html` / `reizen.reisboek` | P0, P1, P2, P3, P4, P5, P6, P7; `link:reisboek` | Journey / critical / travel, transaction |
| `/apps/reisbureau.html` | `apps/reisbureau.html` / `reizen.reisbureau` | P0, P1, P2, P3, P4, P5, P6, P7; `tab:reizen`, `link:reisboek` | Journey / critical / travel, transaction |
| `/apps/reisuitnodiging.html` | `apps/reisuitnodiging.html` / `reizen.uitnodiging` | P0, P1, P2, P3, P4, P5, P6, P7; `tab:reizen` | Ceremony / critical / travel, identity |
| `/apps/reizen-veilig.html` | `apps/reizen-veilig.html` / `reizen.veilig` | P0, P1, P2, P4, P5, P6, P7; `link:reizen` | Journey / critical / travel, identity, care |
| `/apps/reizen.html` | `apps/reizen.html` / `wereld.travel` | P0, P1, P2, P3, P4, P5, P6, P7; `tab:reizen`, `link:reisboek` | Horizon / sensitive / orientation, travel |
| `/apps/rendezvous.html` | `apps/rendezvous.html` / `sociaal.ontmoeten` | P0, P1, P2, P4, P5, P6, P7; `link:rendezvous` | Salon / critical / communication, care, identity |
| `/apps/residentie.html` | `apps/residentie.html` / `sociaal.residentie` | P0, P1, P4, P5, P6, P7; `link:residentie` | Spatial / sensitive / communication, identity |
| `/apps/rijksloket.html` | `apps/rijksloket.html` / `overheid.rijksloket` | P0, P1, P2, P3, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / governance, transaction |
| `/apps/rit.html` | `apps/ov.html` / `vervoer.rit` | P0, P1, P2, P3, P4, P5, P6, P7; `link:ov`, `link:aankomst` | Journey / critical / travel, transaction |
| `/apps/routedekking.html` | `apps/routedekking.html` / `kantoor.routedekking` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / sensitive / operations |
| `/apps/routedossier.html` | `apps/routedossier.html` / `kantoor.routedossier` | P0, P1, P2, P4, P5, P6, P7; `link:routedossier` | Command / sensitive / operations |
| `/apps/rtg.html` | `apps/rtg.html` / `wereld.living` | P0, P1, P2, P4, P5, P6, P7; `link:ontdek` | Horizon / sensitive / orientation, content |
| `/apps/rtgcode.html` | `apps/geld.html` / `geld.overzicht` | P0, P1, P2, P3, P4, P5, P6, P7; `link:rtgcode` | Ledger / critical / redirect |
| `/apps/rtgid.html` | `apps/rtgid.html` / `identiteit.rtgid-diensten` | P0, P1, P2, P4, P5, P6, P7; `link:passkeys`, `link:vertegenwoordiging` | Ceremony / critical / identity |
| `/apps/rtgkantoor.html` | `apps/rtgkantoor.html` / `kantoor.ai-besturing` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / governance, operations |
| `/apps/rtgone.html` | `apps/rtgone.html` / `werk.rtgone` | P0, P1, P2, P4, P5, P6, P7; `link:rtgone` | Command / critical / operations, governance |
| `/apps/rtgschool.html` | `apps/rtgschool.html` / `leren.school` | P0, P1, P4, P5, P6, P7; `link:school` | Library / sensitive / learning, identity |
| `/apps/rtmail.html` | `apps/rtmail.html` / `comm.mail` | P0, P1, P2, P4, P5, P6, P7; `link:rtmail` | Salon / sensitive / communication, content |
| `/apps/salon.html` | `apps/salon.html` / `sociaal.salon` | P0, P1, P4, P5, P6, P7; `tab:salon` | Salon / sensitive / communication, content |
| `/apps/scanner.html` | `apps/scanner.html` / `docs.scanner` | P0, P1, P2, P4, P5, P6, P7; `link:office` | Atelier / sensitive / content |
| `/apps/scherm.html` | `apps/scherm.html` / `horeca.tweedescherm` | P0, P1, P2, P4, P5, P6, P7; `link:tweedescherm` | Command / critical / operations, identity |
| `/apps/schoolpartner.html` | `apps/schoolpartner.html` / `werk.schoolbeheer` | P0, P1, P2, P4, P5, P6, P7; `link:school` | Command / critical / learning, governance |
| `/apps/service-bel.html` | `apps/service-bel.html` / `service.bellen` | P0, P1, P4, P5, P6, P7; `os:bellen` | Salon / sensitive / communication |
| `/apps/service.html` | `apps/service.html` / `kantoor.servicewachtrij` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / communication, operations |
| `/apps/sitemaker.html` | `apps/sitemaker.html` / `werk.website-maker` | P0, P1, P2, P4, P5, P6, P7; `link:sitemaker` | Atelier / sensitive / content, identity |
| `/apps/sociaal-prive.html` | `apps/sociaal-prive.html` / `sociaal.prive-ruimtes` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Salon / sensitive / orientation, identity |
| `/apps/sociaal.html` | `apps/sociaal.html` / `sociaal.leven` | P0, P1, P2, P4, P5, P6, P7; `link:sociaal` | Command / sensitive / orientation, communication |
| `/apps/spelen.html` | `apps/spelen.html` / `spelen.bordspel` | P0, P1, P4, P5, P6, P7; `link:spelen` | Spatial / sensitive / learning, communication |
| `/apps/spelscherm.html` | `apps/spelscherm.html` / `spelen.projectiescherm` | P0, P1, P4, P5, P6, P7; `link:spelavond` | Spatial / sensitive / learning, identity |
| `/apps/sport.html` | `apps/sport.html` / `sport.wedstrijd` | P0, P1, P2, P3, P4, P5, P6, P7; `link:sport` | Journey / critical / travel, transaction |
| `/apps/sportclub.html` | `apps/sportclub.html` / `werk.sportclubbeheer` | P0, P1, P2, P3, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / operations, transaction |
| `/apps/stad.html` | `apps/stad.html` / `reizen.stad` | P0, P1, P2, P4, P5, P6, P7; `link:stad` | Spatial / sensitive / travel, orientation |
| `/apps/stadsdoos.html` | `apps/stadsdoos.html` / `kantoor.stadsdoos` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / identity, operations |
| `/apps/studio-pda.html` | `apps/studio-pda.html` / `media.studio-pda` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Atelier / sensitive / content |
| `/apps/table.html` | `apps/table.html` / `leven.tafel-gelegenheid` | P0, P1, P2, P3, P4, P5, P6, P7; `link:table` | Atelier / critical / operations, transaction |
| `/apps/techniek.html` | `apps/techniek.html` / `kantoor.techniekstatus` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / operations, identity |
| `/apps/theater.html` | `apps/theater.html` / `media.theater` | P0, P1, P2, P3, P4, P5, P6, P7; `link:theater` | Library / critical / content, transaction |
| `/apps/thuis.html` | `apps/thuis.html` / `verblijf.logeren-bij-leden` | P0, P1, P2, P3, P4, P5, P6, P7; `link:huis` | Journey / critical / transaction, operations |
| `/apps/thuisrust.html` | `apps/veilig.html` / `veilig.noodcontacten` | P0, P1, P2, P3, P4, P5, P6, P7; `link:veilig` | Ceremony / critical / redirect |
| `/apps/thuiswacht.html` | `apps/veilig.html` / `veilig.noodcontacten` | P0, P1, P2, P3, P4, P5, P6, P7; `link:veilig` | Ceremony / critical / redirect |
| `/apps/tijdlijn.html` | `apps/tijdlijn.html` / `sociaal.tijdlijn` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Library / sensitive / content, identity |
| `/apps/toestemming.html` | `apps/mijn-relaties.html` / `privacy.toegang` | P0, P1, P2, P4, P5, P6, P7; `link:relaties` | Ceremony / critical / redirect |
| `/apps/training.html` | `apps/training.html` / `gezondheid.training` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Horizon / critical / care, content |
| `/apps/uitgaan.html` | `apps/uitgaan.html` / `leven.uitgaan` | P0, P1, P2, P3, P4, P5, P6, P7; `link:uitgaan` | Journey / critical / travel, transaction |
| `/apps/vandaag.html` | `apps/life.html` / `dag.overzicht` | P0, P1, P2, P4, P5, P6, P7; `link:vandaag` | Horizon / critical / redirect |
| `/apps/veilig.html` | `apps/veilig.html` / `veilig.noodcontacten` | P0, P1, P2, P3, P4, P5, P6, P7; `link:veilig` | Ceremony / critical / care, identity |
| `/apps/verificatie.html` | `apps/verificatie.html` / `identiteit.verificatie` | P0, P1, P2, P4, P5, P6, P7; `link:verificatie` | Ceremony / critical / identity, governance |
| `/apps/vertaler.html` | `apps/vertaler.html` / `taal.vertalen` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Atelier / sensitive / content, travel |
| `/apps/vertegenwoordiging.html` | `apps/vertegenwoordiging.html` / `mandaat.beheer` | P0, P1, P2, P4, P5, P6, P7; `link:vertegenwoordiging` | Ceremony / critical / identity, governance |
| `/apps/vitaal.html` | `apps/veilig.html` / `veilig.noodcontacten` | P0, P1, P2, P3, P4, P5, P6, P7; `link:veilig` | Ceremony / critical / redirect |
| `/apps/vluchten.html` | `apps/vluchten.html` / `reizen.vluchten` | P0, P1, P2, P3, P4, P5, P6, P7; `link:vluchten` | Journey / critical / travel, transaction |
| `/apps/voeding.html` | `apps/voeding.html` / `gezondheid.voeding` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Horizon / critical / care, content |
| `/apps/voertuig.html` | `apps/voertuig.html` / `vervoer.voertuig` | P0, P1, P2, P3, P4, P5, P6, P7; `link:ov` | Command / critical / operations, travel |
| `/apps/vonk.html` | `apps/vonk.html` / `daten.vonk` | P0, P1, P2, P3, P4, P5, P6, P7; `link:vonk` | Salon / critical / communication, identity, care |
| `/apps/wallet.html` | `apps/geld.html` / `geld.overzicht` | P0, P1, P2, P3, P4, P5, P6, P7; `link:wallet` | Ledger / critical / redirect |
| `/apps/wbw.html` | `apps/geld.html` / `geld.overzicht` | P0, P1, P2, P3, P4, P5, P6, P7; `link:wbw` | Ledger / critical / redirect |
| `/apps/websitestudio.html` | `apps/websitestudio.html` / `site.bouwen` | P0, P1, P2, P4, P5, P6, P7; `link:sitemaker` | Atelier / sensitive / content |
| `/apps/wereld.html` | `apps/wereld.html` / `sociaal.alles` | P0, P1, P2, P4, P5, P6, P7; `link:wereldlaag` | Salon / sensitive / communication, orientation |
| `/apps/werk.html` | `apps/werk.html` / `werk.organisatie` | P0, P1, P2, P4, P5, P6, P7; `link:werkos` | Command / critical / operations, identity, governance |
| `/apps/werkplek.html` | `apps/werkplek.html` / `werk.werkplek` | P0, P1, P4, P5, P6, P7; ondersteunende domeintaak | Command / critical / orientation, identity |
| `/apps/werkruimte.html` | `apps/werkruimte.html` / `werk.werkruimte` | P0, P1, P2, P4, P5, P6, P7; ondersteunende domeintaak | Spatial / sensitive / content, operations |
| `/apps/wonen.html` | `apps/wonen.html` / `woning.overzicht` | P0, P1, P2, P3, P4, P5, P6, P7; `link:wonen` | Command / critical / operations, identity |
| `/apps/woningdossier.html` | `apps/woningdossier.html` / `woning.dossier` | P0, P1, P2, P3, P4, P5, P6, P7; `link:wonen` | Library / sensitive / content |
| `/apps/zaakkosten.html` | `apps/zaakkosten.html` / `kosten.zaak` | P0, P1, P2, P3, P4, P5, P6, P7; ondersteunende domeintaak | Ledger / critical / transaction, operations |
| `/apps/zaakpay.html` | `apps/zaakpay.html` / `zaak.pay` | P0, P1, P2, P3, P4, P5, P6, P7; `link:pay` | Ledger / critical / transaction, identity |
| `/apps/zaakweb.html` | `apps/zaakweb.html` / `site.mijnwebsite` | P0, P1, P2, P4, P5, P6, P7; `link:sitemaker` | Atelier / sensitive / content |
| `/apps/zaal.html` | `apps/zaal.html` / `media.zaal` | P0, P1, P2, P4, P5, P6, P7; `link:mediaos` | Library / sensitive / content |
| `/apps/zakelijk.html` | `apps/zakelijk.html` / `vervoer.zakelijkbeleid` | P0, P1, P2, P3, P4, P5, P6, P7; `link:ov` | Command / critical / travel, transaction |
| `/apps/zorgbalie.html` | `apps/personeel.html` / `zaak.teamroom` | P0, P1, P2, P4, P5, P6, P7; `os:werk` | Command / critical / redirect |

## Criteria en bewijsroute per scherm

De IDs hieronder verwijzen naar qualificationPlanning in het bestaande Experience-contract. De gedeelde scenario’s worden uitgevoerd op de concrete taak, doelgroepen, rollen en gegevensgrenzen van ieder scherm, niet op één generieke demonstratie. Specifieke capabilityscenario’s blijven aanvullend verplicht. Apparaten zijn mobile-small, mobile-large, tablet en desktop; alle geldige toestanden/netwerkconfiguraties blijven gelden. De bestaande typed uitvoering en artefactcontrole leveren bewijs; --gate leest dat bewijs en voert de gebruikersproeven niet zelf uit.

| Scherm | Premiumcriteria | Scenario-IDs en specifieke acceptatie | Budgetcellen | Bewijscontracten |
|---|---|---|---|---|
| `/apps/agenda.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | orientation-execute, orientation-negative, orientation-recover, orientation-understand, operations-execute, operations-negative, operations-recover, operations-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/app.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | orientation-execute, orientation-negative, orientation-recover, orientation-understand, identity-execute, identity-negative, identity-recover, identity-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand, travel-execute, travel-negative, travel-recover, travel-understand, care-execute, care-negative, care-recover, care-understand, communication-execute, communication-negative, communication-recover, communication-understand, operations-execute, operations-negative, operations-recover, operations-understand, acceptance:tab:reizen:9cd766d9928c39a694c0e1b4b83f1ec71c9aa476e97981446b51c668ae296059, acceptance:tab:reizen:ccfef49dd035f679b66f5360217db332a176bec619b46bccef4013153ccdd6bb, acceptance:tab:terplaatse:4d164e9b2491a0aafcc8e7d727434ad97693d103f3857b083e72abb1ec575adf, acceptance:tab:terplaatse:f0d18ff39cb5a618def3fb85c776986522cf1fb487e853081c36aa537e59deae, acceptance:tab:zorg:bc767cb85c96dddc3fb3d660b31dc9d223a66731a6230f984cb8a0c2214c8495, acceptance:tab:zorg:a144c6036656018f4f97719328112b394fc351222b2cd32c8d1552df754bf537, acceptance:os:bellen:5e750bdbc9857702c408fb46aa46142221681ce9027e0e2d327de9e499a4f020, acceptance:os:bellen:1a1ce158935270ba77e91800a8594cb93ebeaae73b4ac1e56df82f9ae4c712ad, acceptance:os:rtf:6b79f2ea016b8da6668ad45d7b34f34d096cb5bde26f4c24b4931128c110d36f, acceptance:os:rtf:fed2c486fe9f07a664e3e2a4f3449c3ac280a63fdd2db652cd3b0a9506bae17f, acceptance:os:snaps:b72ac1bd641cadc2db65428c0f52c964ae2750315a39ad1b68c8ea5181dbfeaa, acceptance:os:snaps:4845c7a6f6d47c2f9a28e7f18f7fe8cee4da81a3794353d0b36dadc96a1c0f1f, acceptance:os:videobellen:881763ef3daa07db82ff254b9629817de64b57e3cbe02f71f22ac0862a8ce1ad, acceptance:os:videobellen:cfb6251244061b2c1ca8ea171f90b59bfeab9d1dbc8b67550fd263b376201acd, acceptance:tab:assets:79410da5c3beb01134935133265d9b2edc6259a282d810b48e8bae0581aa5c0a, acceptance:tab:assets:53a5b37f06f9f62859432f9eaa6ad6896536de988eb464c4723c79c91bf2da29, acceptance:tab:bestellen:19a4e6f1d3ceeea031b2b17569ac7c96514fd94fde65b7090bb3cc59d6492a9a, acceptance:tab:bestellen:c741f4d28bdcb5b24bee1c23704c685db471036d6ef631492e9b2979bd017e12, acceptance:tab:betalen:a6824a3fdd05cf2c6b80ac68dfae17b8ec6f209f504a5477ffd924a451e8c291, acceptance:tab:betalen:e90663c3e1a1b31eae3882fdbf5d9442c2030b42f330914c0a94f0d5472fa8ce, acceptance:tab:gezin:943822701d46b2349551381176d32289bad206fe26f33e91f58f4b8220da5dcf, acceptance:tab:gezin:c88e4dd1513f171b97e40b4addb7a2168499bf91c16616f8edaa5e29589c48a0, acceptance:tab:salon:d327b879a1b3a1c8439e6d55b313de90826f4713c170a01b33fbe592f85099ea, acceptance:tab:salon:a89dd4c6e5559e88063375271e6ac748de07c92711b3db223573dcd622f847cf, acceptance:os:werk:c6c76a3fcd840bbd277b43fab4a322bc114c21b8916a72e21708007cd6efec02, acceptance:os:werk:12043a30f4bf4f37b7957db352f2349fe401c1df5e6fe09a68a87e73f9b12990 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/appcel.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | identity-execute, identity-negative, identity-recover, identity-understand, content-execute, content-negative, content-recover, content-understand, acceptance:link:appdossier:d72f686dffbe08290f78341063a38dd245c7c992db1e3931f1fec93f923c77fc, acceptance:link:appdossier:44ba9870d34d227a4ca3cc33941ce3c1b6aa1dbd58485ff39213a7db3665189b | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/appstore-dossier.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | identity-execute, identity-negative, identity-recover, identity-understand, governance-execute, governance-negative, governance-recover, governance-understand, acceptance:link:appdossier:d72f686dffbe08290f78341063a38dd245c7c992db1e3931f1fec93f923c77fc, acceptance:link:appdossier:44ba9870d34d227a4ca3cc33941ce3c1b6aa1dbd58485ff39213a7db3665189b | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/appstore-kantoor.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | governance-execute, governance-negative, governance-recover, governance-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/appstore-uitgever.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, governance-execute, governance-negative, governance-recover, governance-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/architect-pda.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, operations-execute, operations-negative, operations-recover, operations-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/arrival.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | travel-execute, travel-negative, travel-recover, travel-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:aankomst:a6402833f873cb37da08982cb57cb66d13973bbcd3ad76e1ee5c94905f8f0304, acceptance:link:aankomst:1486c6eb70839ad6dc7545ea30bddafaa1a992ad0424949182997ef0cd788e58 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/attenties.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | communication-execute, communication-negative, communication-recover, communication-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand, acceptance:link:attenties:0ca1062c7eab3b49e14adc70b5f4b284c8f6dc0c4d676753ad2a0cf541aa8a0a, acceptance:link:attenties:3cd5f8d42a1c5630dd4d664502e604688235dc9eacc7462934d2e13dfe790a8f | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/avond.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | travel-execute, travel-negative, travel-recover, travel-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand, acceptance:link:leven:5dd392c3d79ae7e36c8e03d09c99f02633f0aac286358a01fdad0e0a839ebfaa, acceptance:link:leven:c6ba195fe057b09017fb2f5a075f3a5fed5c2c933e9712a532bf583e00b71da1, acceptance:link:uitgaan:9669f472af668cbbe3cbdb2198bd493882ade44d83d0038332836aadb028dcc8, acceptance:link:uitgaan:512080cb429b723ea32c55a451bbb4f2920327ec0ea0b84bff43434a5e37cf8a | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/backoffice.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | governance-execute, governance-negative, governance-recover, governance-understand, identity-execute, identity-negative, identity-recover, identity-understand, operations-execute, operations-negative, operations-recover, operations-understand, care-execute, care-negative, care-recover, care-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/balans.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, evidence-integrity | redirect-execute, redirect-negative, redirect-recover, redirect-understand, acceptance:link:balans:5568e2acc269543ee1f7e47e3aabef67430522b8e3ebbbaa212cf8a9507d3ed8, acceptance:link:balans:b9aaf9fe7fa55dbf1dda06991e742f0edf2376730e9cf404f022f2d00b5ec042 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/bank.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, evidence-integrity | redirect-execute, redirect-negative, redirect-recover, redirect-understand, acceptance:link:bank:e069b0426713f9fe9315af71d9a31b3822d20618bccfdfb400e504c423e8707d, acceptance:link:bank:6276ac2cf3e172165467adcea67bdf13225d93648613bb72b1c8fb866a1ddef4 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/belastingkantoor.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | governance-execute, governance-negative, governance-recover, governance-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/berichten.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, evidence-integrity | redirect-execute, redirect-negative, redirect-recover, redirect-understand, acceptance:link:berichten:397b400b28f86a855292ce6622fdfa9f57709cd8a27f9ad3af518997dfea780c, acceptance:link:berichten:162958db17a984607b2d3febfb20b478b95c29ad1477b07bfd653f50122241af | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/bestanden.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, acceptance:link:office:41501cd9a3180e31701db562fbe91a7a2b83fadb73654f16a927e7fece8ada12, acceptance:link:office:fccdc8590bfe349763761c0f1c25d67e7010566d6a299aacee0845516a300ce8 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/bestellen.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | transaction-execute, transaction-negative, transaction-recover, transaction-understand, operations-execute, operations-negative, operations-recover, operations-understand, acceptance:tab:bestellen:19a4e6f1d3ceeea031b2b17569ac7c96514fd94fde65b7090bb3cc59d6492a9a, acceptance:tab:bestellen:c741f4d28bdcb5b24bee1c23704c685db471036d6ef631492e9b2979bd017e12, acceptance:link:horeca:ef905c36a56d3e9e3144745a3299d926021e4f7eadfa8682bc48a7e979ac91a5, acceptance:link:horeca:c27a72edc44acf8ea69d326c218189a821fa63b75517de2a4d9504878c9aff05 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/bewijsmap.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:verificatie:1f051ede7cfdef28cdc906cf5673a2c6259b84121372d30c8b2c4c798d160387, acceptance:link:verificatie:9f8d0ef2d1a7862a1319e57cc860798e8db682d88fdcdeaab8b5ddc31fa8d429 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/boardroom.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | governance-execute, governance-negative, governance-recover, governance-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:werkos:b1bc90a2eddf8597b1992378045bc473ad7533336239750a6d6cca03467a65b7, acceptance:link:werkos:6718a39f2646701f1d71fc1406a17ef8dbb8aa35ad15696b4eea20dee5663ae4 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/boeken.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand | standard:mobile-small, standard:mobile-large, standard:tablet, standard:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/browser.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:browser:b3081c963e8f4a8310f91b1015814578de8d6bed43755d71c339cef1ee96612b, acceptance:link:browser:008d5abb6b727f30ffdb5699f42a5e96c144991dc64f6ddfb338a4c7a96b1463 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/camera.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:camera:89351486959c730f0f985d3c8aa66f712ef5e292c93c0973ebfb9acb372f743d, acceptance:link:camera:6742ce8c37ed03db6d0f0065986870c7f5302f807a4fc41f1727a5a026352bf9 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/cellier.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, operations-execute, operations-negative, operations-recover, operations-understand, acceptance:link:cellier:0832ffc50cfb0ae20ea852071bfdf07b073067cc1a2c300069c59e7285794109, acceptance:link:cellier:214cd261a0d6d2513690e4b915ccb7632e4b852833c7d123b05707bdd4eb9d34 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/cercle.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | identity-execute, identity-negative, identity-recover, identity-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand, acceptance:link:cercle:49b54ed49f4c6dfe711e2c4035e364d9963783c17c317aa8deea7584571a1477, acceptance:link:cercle:85cb106fe21e80cf7e4509c61d37b3616b039ae05452f0286964cfc581be456d | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/chauffeur.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, travel-execute, travel-negative, travel-recover, travel-understand, acceptance:link:ov:3e0e0f0bcffc1e0a40314397270ccda5b6446b53a7d3e06d51cc175d06c6feca, acceptance:link:ov:c795090c3a998f82713db496082cb02234916d5a97ef89b8d555adf37b2e9796 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/clips.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, communication-execute, communication-negative, communication-recover, communication-understand, acceptance:link:clips:f41fdb01f81e36ea41e6b2f22376cdbe0ba4635900b2ba5c4b6dd231c183d880, acceptance:link:clips:4804d426e196f13a7b5effd739829aa4bc50d09c4cebc1ed9435b6cbb5df6be0 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/codewoord.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, evidence-integrity | redirect-execute, redirect-negative, redirect-recover, redirect-understand, acceptance:link:veilig:d2a5662bbcaca3a0d61044547aa557d0e5b67c7250c9d39ba7b7c08090d1c7df, acceptance:link:veilig:d604d1268c1d6a24df9004506054222321379471cc72f9fa5d59c82e6880c06b | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/comm.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | communication-execute, communication-negative, communication-recover, communication-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:berichten:397b400b28f86a855292ce6622fdfa9f57709cd8a27f9ad3af518997dfea780c, acceptance:link:berichten:162958db17a984607b2d3febfb20b478b95c29ad1477b07bfd653f50122241af | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/command.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, identity-execute, identity-negative, identity-recover, identity-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/commerce.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | transaction-execute, transaction-negative, transaction-recover, transaction-understand, operations-execute, operations-negative, operations-recover, operations-understand, acceptance:link:commerce:6e7cdb9bbb8bb3e2622ea9105809ba6c0e5d51d68a6eefdaaa9a0ccd623d7ec5, acceptance:link:commerce:e10c4e12da01ad5036f915036e7c0d24ad52ff2f3249ddccd7db56292fb21261 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/concern.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | governance-execute, governance-negative, governance-recover, governance-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:onderneming:32afa60f8062dac5443c2944cab82c0819a0aa3beeea712b66a39a42066a81c8, acceptance:link:onderneming:75ecf87e208fc40201b0676e98428013894cbf12158477e6f48cf5b6c619a37f | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/concierge.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand, acceptance:link:rechterhand:e09b94fcbcdc72aa246f583784b69cb95e486da51b105884912ce02084afedf8, acceptance:link:rechterhand:420d269c0a3326e4652d302d62e27383c6c12bfef672c4a18a3bb5a2de6d63ca | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/connect.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, communication-execute, communication-negative, communication-recover, communication-understand, acceptance:link:connect:853a95dec0c6f3824821edacf4ea028b148b69bd9c903d829185862aa18768aa, acceptance:link:connect:3ba454367f947410ed9929804d0a17016ed62d751efe8de826b359c123215cd0 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/decision-room.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | governance-execute, governance-negative, governance-recover, governance-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:decisionroom:a81f3366d33d937f468554fb0a4c7a533b0f28cf2d33968352e50d47eb24dbf9, acceptance:link:decisionroom:020f4d4b830fad5e85d64fe923a80c8a573ace7a20ffc5c0d740612d0e83c484 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/defensie.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, care-execute, care-negative, care-recover, care-understand, governance-execute, governance-negative, governance-recover, governance-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/dispatch.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, travel-execute, travel-negative, travel-recover, travel-understand, acceptance:link:ov:3e0e0f0bcffc1e0a40314397270ccda5b6446b53a7d3e06d51cc175d06c6feca, acceptance:link:ov:c795090c3a998f82713db496082cb02234916d5a97ef89b8d555adf37b2e9796 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/doelen.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | orientation-execute, orientation-negative, orientation-recover, orientation-understand, content-execute, content-negative, content-recover, content-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/doos.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/entourage.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | identity-execute, identity-negative, identity-recover, identity-understand, operations-execute, operations-negative, operations-recover, operations-understand, acceptance:link:entourage:45ac3f0553c36139d125183484306d022998bd569ae4e88205ac98db770aea71, acceptance:link:entourage:4eadf73bffdd82719d0dc656006d014f724819c0f467941e5a55fe2f7e519e33 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/festival-gast.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | travel-execute, travel-negative, travel-recover, travel-understand, communication-execute, communication-negative, communication-recover, communication-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/festival.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/flits.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | travel-execute, travel-negative, travel-recover, travel-understand, content-execute, content-negative, content-recover, content-understand, acceptance:link:flits:e98def60e0f4440bdce31fae116260959caff09e149ab95fb082bf671f435d8a, acceptance:link:flits:13384e649a4a28d2e72a736d12f3819eb332c2691c88d6a6db107cd625fbf41c | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foodcourt.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | transaction-execute, transaction-negative, transaction-recover, transaction-understand, travel-execute, travel-negative, travel-recover, travel-understand, acceptance:link:foodcourt:7b466c86bd67e66796fd0af35f83e26887a856565ab088e97bf8726411ade2af, acceptance:link:foodcourt:c76a72c967dec1141de4e4c477ee6ed5a3bd9ac49bb970d1ace40eb8d750acfb | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/agenda.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | orientation-execute, orientation-negative, orientation-recover, orientation-understand, identity-execute, identity-negative, identity-recover, identity-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/arena.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, communication-execute, communication-negative, communication-recover, communication-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/babyboek.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, identity-execute, identity-negative, identity-recover, identity-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/beheer.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | identity-execute, identity-negative, identity-recover, identity-understand, governance-execute, governance-negative, governance-recover, governance-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/beroepen.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, content-execute, content-negative, content-recover, content-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/bieb.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, content-execute, content-negative, content-recover, content-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/bord.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, content-execute, content-negative, content-recover, content-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:rtfbord:b6d0c9259beec693ce5dc4dd39c38898cf178335da173bba3c98ea49a4122329, acceptance:link:rtfbord:34b22b31a42f5b37d3c3ae3574aee649d8c84e92300756398f95113f14994a63 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/budget.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, content-execute, content-negative, content-recover, content-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/buurtruil.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | communication-execute, communication-negative, communication-recover, communication-understand, operations-execute, operations-negative, operations-recover, operations-understand, acceptance:link:buurtruil:0f87bd61bb9866e02157d5db2e23a869ae73929803c6fb4a68b84c61a7a3c883, acceptance:link:buurtruil:d1eed75fcdf22219b7f1a817a733f0ad98c29e46259c33feb5399f36844f1eb8 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/campus.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | orientation-execute, orientation-negative, orientation-recover, orientation-understand, learning-execute, learning-negative, learning-recover, learning-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/club.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, communication-execute, communication-negative, communication-recover, communication-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/clubswerk.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, governance-execute, governance-negative, governance-recover, governance-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/contact.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | communication-execute, communication-negative, communication-recover, communication-understand, identity-execute, identity-negative, identity-recover, identity-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/cv.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, content-execute, content-negative, content-recover, content-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/dromen.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, communication-execute, communication-negative, communication-recover, communication-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/geld-later.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | orientation-execute, orientation-negative, orientation-recover, orientation-understand, learning-execute, learning-negative, learning-recover, learning-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/geld.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, content-execute, content-negative, content-recover, content-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/geloofbieb.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, identity-execute, identity-negative, identity-recover, identity-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/geven.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | transaction-execute, transaction-negative, transaction-recover, transaction-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:geven:7700c81ea25828628b07f3d2c9ffc19a857c739ea53e225dcaa97c5dd56f4793, acceptance:link:geven:3fb5ec6a8f3f205ea896e862005ea6e85f65fdb635b10fc33273d2462a340acb | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/gevoel.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | care-execute, care-negative, care-recover, care-understand, identity-execute, identity-negative, identity-recover, identity-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/gezondheid-welzijn.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | care-execute, care-negative, care-recover, care-understand, orientation-execute, orientation-negative, orientation-recover, orientation-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/gezondheid.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | care-execute, care-negative, care-recover, care-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:foundationzorg:380bcd076119d38ed2ffd23a13e971e5c9f16bde15c38ac06a26217cb4abddb8, acceptance:link:foundationzorg:ad9c1289dc169ac80ef4891d1c88bd35a3c9d30ef3a3ae73a3b283576fcf151c | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/hulpwijzer.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | care-execute, care-negative, care-recover, care-understand, public-execute, public-negative, public-recover, public-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/index.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | identity-execute, identity-negative, identity-recover, identity-understand, orientation-execute, orientation-negative, orientation-recover, orientation-understand, acceptance:os:rtf:6b79f2ea016b8da6668ad45d7b34f34d096cb5bde26f4c24b4931128c110d36f, acceptance:os:rtf:fed2c486fe9f07a664e3e2a4f3449c3ac280a63fdd2db652cd3b0a9506bae17f | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/kantoor.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | governance-execute, governance-negative, governance-recover, governance-understand, operations-execute, operations-negative, operations-recover, operations-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/keuken.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, operations-execute, operations-negative, operations-recover, operations-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/klas.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, identity-execute, identity-negative, identity-recover, identity-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/kleuren.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/klimaatfonds.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | governance-execute, governance-negative, governance-recover, governance-understand, operations-execute, operations-negative, operations-recover, operations-understand, acceptance:link:klimaat:79b6150d05e14279a7e1bf772396b64383346c698e6d26732d83caddebe0d941, acceptance:link:klimaat:52efee0d82e65641148e1a7fa01ffc8f5009129192b465a68f631190e390606d | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/klusjes.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, operations-execute, operations-negative, operations-recover, operations-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/kompas.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | care-execute, care-negative, care-recover, care-understand, identity-execute, identity-negative, identity-recover, identity-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/kwestiekantoor.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | governance-execute, governance-negative, governance-recover, governance-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:kwesties:92161eeb19463945e4265cd97f2dfdc677894aed486c2ab2690dfae6fde77a73, acceptance:link:kwesties:54ba667e605b8e7e3a3bc74586d9fb4cf105892a2f8de9bb3d7db476f3f6c0db | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/kwesties.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | governance-execute, governance-negative, governance-recover, governance-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:kwesties:92161eeb19463945e4265cd97f2dfdc677894aed486c2ab2690dfae6fde77a73, acceptance:link:kwesties:54ba667e605b8e7e3a3bc74586d9fb4cf105892a2f8de9bb3d7db476f3f6c0db | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/leerpaspoort.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:school:854c08ebb1ec9402b2020aef45d0b99ff284804005320fb13eb69af9bce4dd5c, acceptance:link:school:c368a5feb5ba5ae9fbe47100c052a0f7df1dc7fc0dd6f04c6489358abafff139 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/leren.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, orientation-execute, orientation-negative, orientation-recover, orientation-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/liedjes.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, learning-execute, learning-negative, learning-recover, learning-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/magazine.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, public-execute, public-negative, public-recover, public-understand | standard:mobile-small, standard:mobile-large, standard:tablet, standard:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/mail.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | communication-execute, communication-negative, communication-recover, communication-understand, identity-execute, identity-negative, identity-recover, identity-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/markt.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | transaction-execute, transaction-negative, transaction-recover, transaction-understand, identity-execute, identity-negative, identity-recover, identity-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/mediawijs.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, care-execute, care-negative, care-recover, care-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/meedoen-ontdekken.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | orientation-execute, orientation-negative, orientation-recover, orientation-understand, operations-execute, operations-negative, operations-recover, operations-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/memorie.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/mijnbanden.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | identity-execute, identity-negative, identity-recover, identity-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/ochtend.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | orientation-execute, orientation-negative, orientation-recover, orientation-understand, content-execute, content-negative, content-recover, content-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/onveilig.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | care-execute, care-negative, care-recover, care-understand, public-execute, public-negative, public-recover, public-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/oppasinfo.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | care-execute, care-negative, care-recover, care-understand, identity-execute, identity-negative, identity-recover, identity-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/opvoeden.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | care-execute, care-negative, care-recover, care-understand, content-execute, content-negative, content-recover, content-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/os-bestuur.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | governance-execute, governance-negative, governance-recover, governance-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/os-deelnemer.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | identity-execute, identity-negative, identity-recover, identity-understand, care-execute, care-negative, care-recover, care-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/os-donateur.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | transaction-execute, transaction-negative, transaction-recover, transaction-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:geven:7700c81ea25828628b07f3d2c9ffc19a857c739ea53e225dcaa97c5dd56f4793, acceptance:link:geven:3fb5ec6a8f3f205ea896e862005ea6e85f65fdb635b10fc33273d2462a340acb | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/os-portaal.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | identity-execute, identity-negative, identity-recover, identity-understand, governance-execute, governance-negative, governance-recover, governance-understand, acceptance:link:rtfportaal:c8d4279bc5713621bb86ae65a65de79b471b38f36da3ed93974f4e81602ed82d, acceptance:link:rtfportaal:74a439800734838b292a8ad07e9574491ec0397eb185124bb348bf3cee760d84 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/os-publiek.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | public-execute, public-negative, public-recover, public-understand, orientation-execute, orientation-negative, orientation-recover, orientation-understand, acceptance:link:rtfbuurt:53c3491085d97969b46919c51fadeade3257877371f0cbd11f33d1f56f37d4b2, acceptance:link:rtfbuurt:044028c91a6d2e83d37656a191724aed969d5fff3f679114350a09efda2120e7 | standard:mobile-small, standard:mobile-large, standard:tablet, standard:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/os-veld.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | care-execute, care-negative, care-recover, care-understand, operations-execute, operations-negative, operations-recover, operations-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/os-vrijwilliger.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | identity-execute, identity-negative, identity-recover, identity-understand, operations-execute, operations-negative, operations-recover, operations-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/os.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | governance-execute, governance-negative, governance-recover, governance-understand, operations-execute, operations-negative, operations-recover, operations-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/overhoren.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/partner.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | governance-execute, governance-negative, governance-recover, governance-understand, acceptance:link:rtfportaal:c8d4279bc5713621bb86ae65a65de79b471b38f36da3ed93974f4e81602ed82d, acceptance:link:rtfportaal:74a439800734838b292a8ad07e9574491ec0397eb185124bb348bf3cee760d84 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/pesten.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | care-execute, care-negative, care-recover, care-understand, communication-execute, communication-negative, communication-recover, communication-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/presenteren.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, content-execute, content-negative, content-recover, content-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/privacy.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | public-execute, public-negative, public-recover, public-understand, identity-execute, identity-negative, identity-recover, identity-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/projecten.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, content-execute, content-negative, content-recover, content-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/rechten.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | public-execute, public-negative, public-recover, public-understand, learning-execute, learning-negative, learning-recover, learning-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/registreren.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | identity-execute, identity-negative, identity-recover, identity-understand, governance-execute, governance-negative, governance-recover, governance-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/reis.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | travel-execute, travel-negative, travel-recover, travel-understand, care-execute, care-negative, care-recover, care-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/rust.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | care-execute, care-negative, care-recover, care-understand, content-execute, content-negative, content-recover, content-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/samen-thuis.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | orientation-execute, orientation-negative, orientation-recover, orientation-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/school.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, orientation-execute, orientation-negative, orientation-recover, orientation-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/schoolbieb.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, content-execute, content-negative, content-recover, content-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/schrift.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, content-execute, content-negative, content-recover, content-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:rtfschrift:77b890f3f28f0f9e9897008eef0380fc820f46c76eda9f3fc8bb81a4a3494655, acceptance:link:rtfschrift:d8e71e74049ad3a0701e48e343d74e3a8b316ead9b2ed6b94d36c581eeb3e7cf | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/schrijven.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, content-execute, content-negative, content-recover, content-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/societeit.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, communication-execute, communication-negative, communication-recover, communication-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/speelhal.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/speeltuin.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/steun.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | care-execute, care-negative, care-recover, care-understand, identity-execute, identity-negative, identity-recover, identity-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/studie.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, public-execute, public-negative, public-recover, public-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/tellen.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/toetsen.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, operations-execute, operations-negative, operations-recover, operations-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/veilig-vertrouwd.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | care-execute, care-negative, care-recover, care-understand, identity-execute, identity-negative, identity-recover, identity-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/veilig.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | care-execute, care-negative, care-recover, care-understand, communication-execute, communication-negative, communication-recover, communication-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/verhaaltje.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, learning-execute, learning-negative, learning-recover, learning-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/verjaardagen.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | transaction-execute, transaction-negative, transaction-recover, transaction-understand, communication-execute, communication-negative, communication-recover, communication-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/vrienden.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | communication-execute, communication-negative, communication-recover, communication-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:vrienden:2803386bb67c48e846376b4a34d80ca46b3ae1422aa88c2b009465d2c858b0af, acceptance:link:vrienden:f47443995a232a7c947ad7aa3ad546f549975f5827255e7e601971b30ee47e03 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/wegwijzer.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | care-execute, care-negative, care-recover, care-understand, public-execute, public-negative, public-recover, public-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/werk.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, public-execute, public-negative, public-recover, public-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/winkel.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | transaction-execute, transaction-negative, transaction-recover, transaction-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/zakgeld.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, content-execute, content-negative, content-recover, content-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/foundation/zorg.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | care-execute, care-negative, care-recover, care-understand, identity-execute, identity-negative, identity-recover, identity-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand, acceptance:link:foundationzorg:380bcd076119d38ed2ffd23a13e971e5c9f16bde15c38ac06a26217cb4abddb8, acceptance:link:foundationzorg:ad9c1289dc169ac80ef4891d1c88bd35a3c9d30ef3a3ae73a3b283576fcf151c | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/galerij.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/garderobe.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:garderobe:7118d011be14f1d7bc5863717ee8569d09312cb61242ad7efe18fac489a517cc, acceptance:link:garderobe:71a25b59ef50a0109becad8b6da29cc43dc5ccbcf6bb604d3eed179230c3b1c4 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/gast.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | transaction-execute, transaction-negative, transaction-recover, transaction-understand, operations-execute, operations-negative, operations-recover, operations-understand, acceptance:link:horeca:ef905c36a56d3e9e3144745a3299d926021e4f7eadfa8682bc48a7e979ac91a5, acceptance:link:horeca:c27a72edc44acf8ea69d326c218189a821fa63b75517de2a4d9504878c9aff05 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/gedachten.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, identity-execute, identity-negative, identity-recover, identity-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/geld-command.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, evidence-integrity | redirect-execute, redirect-negative, redirect-recover, redirect-understand, acceptance:link:geldcommand:2e3855f52b94e8c6f62e1ec551bc234ae738dfa430f300c48f37b3318c8dffab, acceptance:link:geldcommand:2c4973a54ad36e44a2cf27b812605e373bb862b401fc200b24eecf8c724c1061 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/geld.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | transaction-execute, transaction-negative, transaction-recover, transaction-understand, identity-execute, identity-negative, identity-recover, identity-understand, governance-execute, governance-negative, governance-recover, governance-understand, acceptance:link:balans:5568e2acc269543ee1f7e47e3aabef67430522b8e3ebbbaa212cf8a9507d3ed8, acceptance:link:balans:b9aaf9fe7fa55dbf1dda06991e742f0edf2376730e9cf404f022f2d00b5ec042, acceptance:link:bank:e069b0426713f9fe9315af71d9a31b3822d20618bccfdfb400e504c423e8707d, acceptance:link:bank:6276ac2cf3e172165467adcea67bdf13225d93648613bb72b1c8fb866a1ddef4, acceptance:link:geldcommand:2e3855f52b94e8c6f62e1ec551bc234ae738dfa430f300c48f37b3318c8dffab, acceptance:link:geldcommand:2c4973a54ad36e44a2cf27b812605e373bb862b401fc200b24eecf8c724c1061, acceptance:link:labfonds:a08086cfa0453a5e824973f74d5b5d20cc5e1f203cefd8882150e4a050109106, acceptance:link:labfonds:f226ba33d7d1ff4452b5d40a89d612a90acd0134274257745fb56d140588dcf2, acceptance:link:logboek:3485897e428a7d194dc9482a30f042a30868398abba81960c9e12b81253e1d63, acceptance:link:logboek:0acb317faf248037c4fdc517e7efc8e5daf7471fc01dd1835ba90fadbd3ac94f, acceptance:link:mecenaat:63d179aa40c9f954a9070bf8781c6ccc008f32afa5f6bad087bd9db8c5ba7d30, acceptance:link:mecenaat:5ffc7e35f46b785c000ebd8b89879cc60592fcf07e66e5ac7e6e715173235a7c, acceptance:link:nalatenschap:2b9ae2f0a1493d588e924af5df142bf0629e068c6e8c64c15da23a8b8eec108a, acceptance:link:nalatenschap:a2747a7e6f37a535d5a08e3746b7ad3cbd196a5b3888d646b6e4a1e7b70dc3d4, acceptance:link:rtgcode:1f8437eb28c2d608fe0e16a5103609528d4d096d878a4efe2f7e8ef08e1b5ecd, acceptance:link:rtgcode:ca1c320e79bb675a673159ed991108a50b5c0829fe540d98e984e56f68821bb6, acceptance:link:wallet:db284a38ba0d8d32cd504144e22a210f7e9b78749a34515a59ea40c46ded5cda, acceptance:link:wallet:bfb0c95e14ca1d0bd217fe4024b8ac67b0c2d9c16ac7ebe00de4497dc0ea39a3, acceptance:link:wbw:32a5aea0bf36f40dbe22294701bca0bfa618c86c6a810c1f7602f9e44e518f5c, acceptance:link:wbw:40cc4d87bd50943deabd6505237fc3a3c7191eef94a083b290d0c899d9c0bfbc | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/gemeente.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | governance-execute, governance-negative, governance-recover, governance-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/gemeenteloket.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | governance-execute, governance-negative, governance-recover, governance-understand, operations-execute, operations-negative, operations-recover, operations-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/gemeentepda.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | governance-execute, governance-negative, governance-recover, governance-understand, operations-execute, operations-negative, operations-recover, operations-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/genootschap.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | communication-execute, communication-negative, communication-recover, communication-understand, governance-execute, governance-negative, governance-recover, governance-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/gereedschap.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand | standard:mobile-small, standard:mobile-large, standard:tablet, standard:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/ghost.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, travel-execute, travel-negative, travel-recover, travel-understand, acceptance:link:ov:3e0e0f0bcffc1e0a40314397270ccda5b6446b53a7d3e06d51cc175d06c6feca, acceptance:link:ov:c795090c3a998f82713db496082cb02234916d5a97ef89b8d555adf37b2e9796 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/handel.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | transaction-execute, transaction-negative, transaction-recover, transaction-understand, operations-execute, operations-negative, operations-recover, operations-understand, acceptance:link:onderneming:32afa60f8062dac5443c2944cab82c0819a0aa3beeea712b66a39a42066a81c8, acceptance:link:onderneming:75ecf87e208fc40201b0676e98428013894cbf12158477e6f48cf5b6c619a37f | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/hangar.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | travel-execute, travel-negative, travel-recover, travel-understand, operations-execute, operations-negative, operations-recover, operations-understand, acceptance:link:hangar:b20505a595e03b4276a649c74857c7c961d5a29448a507619d7f742d1c648db4, acceptance:link:hangar:2dfaa60985244d20aa7bed1e3a1600f73a6a0abee483832ff01e8851670e0759 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/hardware-pda.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/home.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:wonen:5bdbd71b26f53b8939c76b025d3693e89254713953ac9207c4dc3d1a32783f94, acceptance:link:wonen:44fbcd43a1b6b2d6c44393624214d2f7cb9ad421515cc41adea7d25b00299fa2 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/horeca-bar.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand, acceptance:link:horeca:ef905c36a56d3e9e3144745a3299d926021e4f7eadfa8682bc48a7e979ac91a5, acceptance:link:horeca:c27a72edc44acf8ea69d326c218189a821fa63b75517de2a4d9504878c9aff05 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/horeca-beheer.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:horeca:ef905c36a56d3e9e3144745a3299d926021e4f7eadfa8682bc48a7e979ac91a5, acceptance:link:horeca:c27a72edc44acf8ea69d326c218189a821fa63b75517de2a4d9504878c9aff05 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/horeca-bezorg.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, travel-execute, travel-negative, travel-recover, travel-understand, acceptance:link:horeca:ef905c36a56d3e9e3144745a3299d926021e4f7eadfa8682bc48a7e979ac91a5, acceptance:link:horeca:c27a72edc44acf8ea69d326c218189a821fa63b75517de2a4d9504878c9aff05 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/horeca-club.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | transaction-execute, transaction-negative, transaction-recover, transaction-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:horeca:ef905c36a56d3e9e3144745a3299d926021e4f7eadfa8682bc48a7e979ac91a5, acceptance:link:horeca:c27a72edc44acf8ea69d326c218189a821fa63b75517de2a4d9504878c9aff05 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/horeca-events.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | transaction-execute, transaction-negative, transaction-recover, transaction-understand, operations-execute, operations-negative, operations-recover, operations-understand, acceptance:link:horeca:ef905c36a56d3e9e3144745a3299d926021e4f7eadfa8682bc48a7e979ac91a5, acceptance:link:horeca:c27a72edc44acf8ea69d326c218189a821fa63b75517de2a4d9504878c9aff05 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/horeca-expeditie.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand, acceptance:link:horeca:ef905c36a56d3e9e3144745a3299d926021e4f7eadfa8682bc48a7e979ac91a5, acceptance:link:horeca:c27a72edc44acf8ea69d326c218189a821fa63b75517de2a4d9504878c9aff05 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/horeca-haccp.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | care-execute, care-negative, care-recover, care-understand, operations-execute, operations-negative, operations-recover, operations-understand, acceptance:link:horeca:ef905c36a56d3e9e3144745a3299d926021e4f7eadfa8682bc48a7e979ac91a5, acceptance:link:horeca:c27a72edc44acf8ea69d326c218189a821fa63b75517de2a4d9504878c9aff05 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/horeca-hotel.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | transaction-execute, transaction-negative, transaction-recover, transaction-understand, operations-execute, operations-negative, operations-recover, operations-understand, acceptance:link:horeca:ef905c36a56d3e9e3144745a3299d926021e4f7eadfa8682bc48a7e979ac91a5, acceptance:link:horeca:c27a72edc44acf8ea69d326c218189a821fa63b75517de2a4d9504878c9aff05 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/horeca-pda.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand, acceptance:link:horeca:ef905c36a56d3e9e3144745a3299d926021e4f7eadfa8682bc48a7e979ac91a5, acceptance:link:horeca:c27a72edc44acf8ea69d326c218189a821fa63b75517de2a4d9504878c9aff05 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/horeca-vloer.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, acceptance:link:horeca:ef905c36a56d3e9e3144745a3299d926021e4f7eadfa8682bc48a7e979ac91a5, acceptance:link:horeca:c27a72edc44acf8ea69d326c218189a821fa63b75517de2a4d9504878c9aff05 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/horeca.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:horeca:ef905c36a56d3e9e3144745a3299d926021e4f7eadfa8682bc48a7e979ac91a5, acceptance:link:horeca:c27a72edc44acf8ea69d326c218189a821fa63b75517de2a4d9504878c9aff05 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/hotels.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | travel-execute, travel-negative, travel-recover, travel-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand, acceptance:tab:reizen:9cd766d9928c39a694c0e1b4b83f1ec71c9aa476e97981446b51c668ae296059, acceptance:tab:reizen:ccfef49dd035f679b66f5360217db332a176bec619b46bccef4013153ccdd6bb, acceptance:link:reisboek:82b8f86d0b0193d665bd743a50a4a370e1359d2701b9b9996f7d8ad122837bd8, acceptance:link:reisboek:c329a1d356424d86c0942fb73288b44247dfe9c21bb68cb8f18a1f2c864ff5ff | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/ik.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | identity-execute, identity-negative, identity-recover, identity-understand, content-execute, content-negative, content-recover, content-understand, acceptance:link:ik:631c6c2af5e32d7fdc3cdf012bbff27d8ee772791500ac68746b3da380985848, acceptance:link:ik:3152c55e84f24868d8b72c62f706b4706d20a60da7a2ff4fb15e1ac9d47c0014 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/isolatie.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, identity-execute, identity-negative, identity-recover, identity-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/juridisch.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | public-execute, public-negative, public-recover, public-understand, orientation-execute, orientation-negative, orientation-recover, orientation-understand, acceptance:link:juridisch:ce04c515da384a5cbaf15769ea7b80d5fe7b5c5a1dc9714043ea513c9546f9d9, acceptance:link:juridisch:80558fe41ab6df93838c177ed8ec7524cbbc2420a6dd5dd875e4bcae7309fd2a | standard:mobile-small, standard:mobile-large, standard:tablet, standard:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/juridisch/partnervoorwaarden.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | public-execute, public-negative, public-recover, public-understand, acceptance:link:juridisch:ce04c515da384a5cbaf15769ea7b80d5fe7b5c5a1dc9714043ea513c9546f9d9, acceptance:link:juridisch:80558fe41ab6df93838c177ed8ec7524cbbc2420a6dd5dd875e4bcae7309fd2a | standard:mobile-small, standard:mobile-large, standard:tablet, standard:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/juridisch/privacy.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | public-execute, public-negative, public-recover, public-understand, acceptance:link:juridisch:ce04c515da384a5cbaf15769ea7b80d5fe7b5c5a1dc9714043ea513c9546f9d9, acceptance:link:juridisch:80558fe41ab6df93838c177ed8ec7524cbbc2420a6dd5dd875e4bcae7309fd2a | standard:mobile-small, standard:mobile-large, standard:tablet, standard:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/juridisch/voorwaarden.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | public-execute, public-negative, public-recover, public-understand, acceptance:link:juridisch:ce04c515da384a5cbaf15769ea7b80d5fe7b5c5a1dc9714043ea513c9546f9d9, acceptance:link:juridisch:80558fe41ab6df93838c177ed8ec7524cbbc2420a6dd5dd875e4bcae7309fd2a | standard:mobile-small, standard:mobile-large, standard:tablet, standard:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/kantoor.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | orientation-execute, orientation-negative, orientation-recover, orientation-understand, operations-execute, operations-negative, operations-recover, operations-understand, acceptance:link:werkos:b1bc90a2eddf8597b1992378045bc473ad7533336239750a6d6cca03467a65b7, acceptance:link:werkos:6718a39f2646701f1d71fc1406a17ef8dbb8aa35ad15696b4eea20dee5663ae4 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/kantoorpda.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, evidence-integrity | redirect-execute, redirect-negative, redirect-recover, redirect-understand, acceptance:os:werk:c6c76a3fcd840bbd277b43fab4a322bc114c21b8916a72e21708007cd6efec02, acceptance:os:werk:12043a30f4bf4f37b7957db352f2349fe401c1df5e6fe09a68a87e73f9b12990 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/kantoren.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | orientation-execute, orientation-negative, orientation-recover, orientation-understand, identity-execute, identity-negative, identity-recover, identity-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/kassa.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | transaction-execute, transaction-negative, transaction-recover, transaction-understand, operations-execute, operations-negative, operations-recover, operations-understand, acceptance:link:horeca:ef905c36a56d3e9e3144745a3299d926021e4f7eadfa8682bc48a7e979ac91a5, acceptance:link:horeca:c27a72edc44acf8ea69d326c218189a821fa63b75517de2a4d9504878c9aff05 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/klankwerk-kantoor.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | governance-execute, governance-negative, governance-recover, governance-understand, content-execute, content-negative, content-recover, content-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/klankwerk.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/kosten.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | transaction-execute, transaction-negative, transaction-recover, transaction-understand, governance-execute, governance-negative, governance-recover, governance-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/krant.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, public-execute, public-negative, public-recover, public-understand, acceptance:link:krant:a02db38e51822d556c9fa48f444989850e982d672d6be48983f751203b15d02a, acceptance:link:krant:92e6e9faf533a37a0360b3715d9c982d0bc856ceb3351a86c07b01d2b7295f45 | standard:mobile-small, standard:mobile-large, standard:tablet, standard:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/lab.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | governance-execute, governance-negative, governance-recover, governance-understand, operations-execute, operations-negative, operations-recover, operations-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/labfonds.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, evidence-integrity | redirect-execute, redirect-negative, redirect-recover, redirect-understand, acceptance:link:labfonds:a08086cfa0453a5e824973f74d5b5d20cc5e1f203cefd8882150e4a050109106, acceptance:link:labfonds:f226ba33d7d1ff4452b5d40a89d612a90acd0134274257745fb56d140588dcf2 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/labpas.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | identity-execute, identity-negative, identity-recover, identity-understand, learning-execute, learning-negative, learning-recover, learning-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/leerhuis-werk.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, governance-execute, governance-negative, governance-recover, governance-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/leerhuis.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, identity-execute, identity-negative, identity-recover, identity-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/lesmaker.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, content-execute, content-negative, content-recover, content-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/leven.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | travel-execute, travel-negative, travel-recover, travel-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand, acceptance:link:leven:5dd392c3d79ae7e36c8e03d09c99f02633f0aac286358a01fdad0e0a839ebfaa, acceptance:link:leven:c6ba195fe057b09017fb2f5a075f3a5fed5c2c933e9712a532bf583e00b71da1 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/leverancier-aanvragen.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | transaction-execute, transaction-negative, transaction-recover, transaction-understand, operations-execute, operations-negative, operations-recover, operations-understand, acceptance:link:mall:5fc1dd69ca11437aaf54df95596aff99394955b15ad9d969705c08cd275b18f2, acceptance:link:mall:c7a5f8eaf7eca29c6ef06c3c0c4b8541f163c0957bfd62845d8d33cf2d1aa2c7, acceptance:link:mijnmall:32833622132f689ef2a08ed3ae061f59cfcb565cb0495b91abab3001eec10963, acceptance:link:mijnmall:1b23c1b617e8dc40019729782e3464288fd98dda401f78a21e8f2f0653ad6c20 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/leverancier-commerce.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | transaction-execute, transaction-negative, transaction-recover, transaction-understand, operations-execute, operations-negative, operations-recover, operations-understand, acceptance:link:commerce:6e7cdb9bbb8bb3e2622ea9105809ba6c0e5d51d68a6eefdaaa9a0ccd623d7ec5, acceptance:link:commerce:e10c4e12da01ad5036f915036e7c0d24ad52ff2f3249ddccd7db56292fb21261, acceptance:link:mall:5fc1dd69ca11437aaf54df95596aff99394955b15ad9d969705c08cd275b18f2, acceptance:link:mall:c7a5f8eaf7eca29c6ef06c3c0c4b8541f163c0957bfd62845d8d33cf2d1aa2c7 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/leverancier-rtmail.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | communication-execute, communication-negative, communication-recover, communication-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:rtmail:8380a54c223ba9db317e92538d7ccd792a71c1402539db8056ee6351005a0998, acceptance:link:rtmail:b6db559437d8d9eac9aca0bd89fd4f9ed6a23f2e2c8976ea982e81d1a677533d | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/leverancier-service.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | communication-execute, communication-negative, communication-recover, communication-understand, operations-execute, operations-negative, operations-recover, operations-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/leverancier.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/library.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, governance-execute, governance-negative, governance-recover, governance-understand, acceptance:link:library:879be852ee2a6f662046e5272cf32955fa35125d58f62c38e77f6fd94a09163a, acceptance:link:library:b0d1f59dc6bad2ed7ab0a762a780ddd2825299cd69e6b788dab4061b8ed16cc0 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/life.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | orientation-execute, orientation-negative, orientation-recover, orientation-understand, care-execute, care-negative, care-recover, care-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:vandaag:5ceda6161cb56224410916c658a8305d943a0fd17cd616ffee51b409c48265eb, acceptance:link:vandaag:a7bf0225907d89c22b2573ff676ee42e4e155e2dbc3e0c4191fbaf5485e4b662 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/lifestyle.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:rechterhand:e09b94fcbcdc72aa246f583784b69cb95e486da51b105884912ce02084afedf8, acceptance:link:rechterhand:420d269c0a3326e4652d302d62e27383c6c12bfef672c4a18a3bb5a2de6d63ca | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/living-os.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | orientation-execute, orientation-negative, orientation-recover, orientation-understand, travel-execute, travel-negative, travel-recover, travel-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand, acceptance:link:vooruitzicht:f2b67942f9c4480528008f7b0a815948ce4f84c77a467d99151a45bf1a3a3685, acceptance:link:vooruitzicht:dd8fdc274a5817507f4bf44859279d418d50baa74d81b83428660c2206ae2135 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/living-world.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | travel-execute, travel-negative, travel-recover, travel-understand, content-execute, content-negative, content-recover, content-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/livinglab.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, identity-execute, identity-negative, identity-recover, identity-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/logboek.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, evidence-integrity | redirect-execute, redirect-negative, redirect-recover, redirect-understand, acceptance:link:logboek:3485897e428a7d194dc9482a30f042a30868398abba81960c9e12b81253e1d63, acceptance:link:logboek:0acb317faf248037c4fdc517e7efc8e5daf7471fc01dd1835ba90fadbd3ac94f | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/loonstrook.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | transaction-execute, transaction-negative, transaction-recover, transaction-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:loonstrook:e6d5012dde8cab0ac5e574ad316a220279e9dc0dba27e1236557eea5eb0fbd8a, acceptance:link:loonstrook:38283a6cfc9258513b7b500b9fc1e633642a01b227fc2806cbcc01a488112859 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/loopbaan.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:loopbaan:35612c600888540d72a5b83927bd50254fce88fe7023c65368971c40c80edc81, acceptance:link:loopbaan:268af8f5ca569a0d62c996dbf6268a50847d868d760530d9e9c7d0692a9805ed | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/loopbaanbewijs.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | public-execute, public-negative, public-recover, public-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:loopbaan:35612c600888540d72a5b83927bd50254fce88fe7023c65368971c40c80edc81, acceptance:link:loopbaan:268af8f5ca569a0d62c996dbf6268a50847d868d760530d9e9c7d0692a9805ed | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/luchthaven.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, travel-execute, travel-negative, travel-recover, travel-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/magnaat-kantoor.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | governance-execute, governance-negative, governance-recover, governance-understand, operations-execute, operations-negative, operations-recover, operations-understand, acceptance:link:magnaat:49e60f7d258da083f206c16a605907d7a85edeaabdac0244185db78586be5030, acceptance:link:magnaat:28be088cc2a6d5e84e9d1bb7a0628b35138bf86afdf56d0d05457969497fd824 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/magnaat-partnerstudio.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, operations-execute, operations-negative, operations-recover, operations-understand, acceptance:link:magnaat:49e60f7d258da083f206c16a605907d7a85edeaabdac0244185db78586be5030, acceptance:link:magnaat:28be088cc2a6d5e84e9d1bb7a0628b35138bf86afdf56d0d05457969497fd824 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/magnaat.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, operations-execute, operations-negative, operations-recover, operations-understand, acceptance:link:magnaat:49e60f7d258da083f206c16a605907d7a85edeaabdac0244185db78586be5030, acceptance:link:magnaat:28be088cc2a6d5e84e9d1bb7a0628b35138bf86afdf56d0d05457969497fd824 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/maison.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:maison:53e03f06ad1fe7f0438924057cfe630cbf9272cea83def4091c543574ed2b714, acceptance:link:maison:00ad07ad223d7185bb243de83dfda504e32c239bdcf4a0c8a78e9b7c1c5ea0ef | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/mall.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | transaction-execute, transaction-negative, transaction-recover, transaction-understand, travel-execute, travel-negative, travel-recover, travel-understand, acceptance:link:mall:5fc1dd69ca11437aaf54df95596aff99394955b15ad9d969705c08cd275b18f2, acceptance:link:mall:c7a5f8eaf7eca29c6ef06c3c0c4b8541f163c0957bfd62845d8d33cf2d1aa2c7 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/marechaussee.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, governance-execute, governance-negative, governance-recover, governance-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/mecenaat.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, evidence-integrity | redirect-execute, redirect-negative, redirect-recover, redirect-understand, acceptance:link:mecenaat:63d179aa40c9f954a9070bf8781c6ccc008f32afa5f6bad087bd9db8c5ba7d30, acceptance:link:mecenaat:5ffc7e35f46b785c000ebd8b89879cc60592fcf07e66e5ac7e6e715173235a7c | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/media.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:mediaos:d802e0251a3f5ff96f6cd515a81eea58521d0923802a048aa369cf000411c508, acceptance:link:mediaos:063f4bff4ef7e4e5f3262f55b071c36a15b36434101c0be7c0a00596d8efe18e | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/medicijnen.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | care-execute, care-negative, care-recover, care-understand, identity-execute, identity-negative, identity-recover, identity-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/meet.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | communication-execute, communication-negative, communication-recover, communication-understand, acceptance:os:videobellen:881763ef3daa07db82ff254b9629817de64b57e3cbe02f71f22ac0862a8ce1ad, acceptance:os:videobellen:cfb6251244061b2c1ca8ea171f90b59bfeab9d1dbc8b67550fd263b376201acd | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/meldkamer.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | care-execute, care-negative, care-recover, care-understand, operations-execute, operations-negative, operations-recover, operations-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/memo.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/merken.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | governance-execute, governance-negative, governance-recover, governance-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:onderneming:32afa60f8062dac5443c2944cab82c0819a0aa3beeea712b66a39a42066a81c8, acceptance:link:onderneming:75ecf87e208fc40201b0676e98428013894cbf12158477e6f48cf5b6c619a37f | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/metier.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, evidence-integrity | redirect-execute, redirect-negative, redirect-recover, redirect-understand, acceptance:link:geldcommand:2e3855f52b94e8c6f62e1ec551bc234ae738dfa430f300c48f37b3318c8dffab, acceptance:link:geldcommand:2c4973a54ad36e44a2cf27b812605e373bb862b401fc200b24eecf8c724c1061 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/mijn-gegevens.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:gegevens:3a60832204261c0efa4b437987e6ef909d8314270012876d92374da0cb66c8f5, acceptance:link:gegevens:93daa8ef79e4493b77e66dcd195a448dff75f3fe2d2911a4eb38f48b86d5ca6d | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/mijn-isolatie.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | identity-execute, identity-negative, identity-recover, identity-understand, operations-execute, operations-negative, operations-recover, operations-understand, acceptance:link:bescherming:91debd6f4a289e81f6dbc40ca7233347f248c61d84b4c55fc999b1b970ebfa7d, acceptance:link:bescherming:59e0121fb567751f4834c3ab6135f3116b1db58c4a98f0d8bda7540af82524f3 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/mijn-neigingen.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:neigingen:baf5ee2162b5edfe0fc29538b3020c6e096d1b2f22ca3323f80fa7719b279214, acceptance:link:neigingen:0feaf90da03ab0c6236c67105e574e9f64b11e6c8593e590e9d3bf7e60228122 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/mijn-post.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | identity-execute, identity-negative, identity-recover, identity-understand, communication-execute, communication-negative, communication-recover, communication-understand, acceptance:link:post:3227d7680ccf2b0b3666c089b4f695364b336956f18bd772368031efb295da8e, acceptance:link:post:930b6eb1872d70f4b5066ddccfaec390f111817a0c16dcf273f46398e8450269 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/mijn-relaties.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:relaties:32b903478c98e181201f103749c5b0bdfffaa15933f436c005536f7770ada9e5, acceptance:link:relaties:bc832e143319b277d34ea9fe1a103044959ba2c58ee28373e93c19722d6baf85 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/mijn-sessies.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:sessies:6819d31db6dd5fcb9166707ecd206811fb19f41279bbb7f51ec6524a62aea694, acceptance:link:sessies:bb1204a3d73befa5503cf96664cf9c56a5bf430284ca92fb424aabe43e2bc0a8 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/mijnmall.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | transaction-execute, transaction-negative, transaction-recover, transaction-understand, operations-execute, operations-negative, operations-recover, operations-understand, acceptance:link:mijnmall:32833622132f689ef2a08ed3ae061f59cfcb565cb0495b91abab3001eec10963, acceptance:link:mijnmall:1b23c1b617e8dc40019729782e3464288fd98dda401f78a21e8f2f0653ad6c20 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/move.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | travel-execute, travel-negative, travel-recover, travel-understand, orientation-execute, orientation-negative, orientation-recover, orientation-understand, acceptance:link:move:951d5f296cd54f04d1e6eeac313e7c789c419173a07238793982f4c1cef42f70, acceptance:link:move:2b058e2692ed370f1c871d3a34168215fb4d224021de06832c5e534633ffe51c | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/muziek.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, communication-execute, communication-negative, communication-recover, communication-understand, acceptance:link:muziek:518c1756cf950758e348fff9cb95dd854db5f0a6a348cb6dae5cc73e2c9b0429, acceptance:link:muziek:5e116caa0dd40720132837e4f787c345d72347cc5e2dcb2700a8430ceb5db8f9 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/nalatenschap.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, evidence-integrity | redirect-execute, redirect-negative, redirect-recover, redirect-understand, acceptance:link:nalatenschap:2b9ae2f0a1493d588e924af5df142bf0629e068c6e8c64c15da23a8b8eec108a, acceptance:link:nalatenschap:a2747a7e6f37a535d5a08e3746b7ad3cbd196a5b3888d646b6e4a1e7b70dc3d4 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/navigatie.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | travel-execute, travel-negative, travel-recover, travel-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:navigatie:1f536a9d63356f31ed543ada838f39ffa6a839db29f98dc8bd84137f4d7fbc84, acceptance:link:navigatie:8907938eab8e26b7cc4ec54d19fe665478a8d2550f47214398b9671e578fca52 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/nieuws.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, public-execute, public-negative, public-recover, public-understand, acceptance:link:nieuws:86655d47c5e4737f6ffa7f3a1138f22a27a6b552afb3c2fede72ff5660f84d1a, acceptance:link:nieuws:5a3770808850246319289c826d4da414fbcc89fd8aa251a406d9aa523c105c9c | standard:mobile-small, standard:mobile-large, standard:tablet, standard:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/notities.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, acceptance:link:office:41501cd9a3180e31701db562fbe91a7a2b83fadb73654f16a927e7fece8ada12, acceptance:link:office:fccdc8590bfe349763761c0f1c25d67e7010566d6a299aacee0845516a300ce8 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/office.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:office:41501cd9a3180e31701db562fbe91a7a2b83fadb73654f16a927e7fece8ada12, acceptance:link:office:fccdc8590bfe349763761c0f1c25d67e7010566d6a299aacee0845516a300ce8 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/onderhoud.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, acceptance:link:wonen:5bdbd71b26f53b8939c76b025d3693e89254713953ac9207c4dc3d1a32783f94, acceptance:link:wonen:44fbcd43a1b6b2d6c44393624214d2f7cb9ad421515cc41adea7d25b00299fa2 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/onderneming.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, governance-execute, governance-negative, governance-recover, governance-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand, acceptance:link:onderneming:32afa60f8062dac5443c2944cab82c0819a0aa3beeea712b66a39a42066a81c8, acceptance:link:onderneming:75ecf87e208fc40201b0676e98428013894cbf12158477e6f48cf5b6c619a37f | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/oog.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, identity-execute, identity-negative, identity-recover, identity-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/ov.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | travel-execute, travel-negative, travel-recover, travel-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand, acceptance:link:ov:3e0e0f0bcffc1e0a40314397270ccda5b6446b53a7d3e06d51cc175d06c6feca, acceptance:link:ov:c795090c3a998f82713db496082cb02234916d5a97ef89b8d555adf37b2e9796 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/ovcontrol.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, travel-execute, travel-negative, travel-recover, travel-understand, acceptance:link:ov:3e0e0f0bcffc1e0a40314397270ccda5b6446b53a7d3e06d51cc175d06c6feca, acceptance:link:ov:c795090c3a998f82713db496082cb02234916d5a97ef89b8d555adf37b2e9796, acceptance:link:ovroutes:29bef95e3f9762a4138483e4fad9c1ef36c791deb9aca71af922ec5006b37c42, acceptance:link:ovroutes:b9aac305c83cc977f0b0586ae14e0f3a568ff7e2e041ca1667b04c939dea2418 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/ovdienst.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, travel-execute, travel-negative, travel-recover, travel-understand, acceptance:link:ov:3e0e0f0bcffc1e0a40314397270ccda5b6446b53a7d3e06d51cc175d06c6feca, acceptance:link:ov:c795090c3a998f82713db496082cb02234916d5a97ef89b8d555adf37b2e9796 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/overheid.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | governance-execute, governance-negative, governance-recover, governance-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/overheidspda.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, identity-execute, identity-negative, identity-recover, identity-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/ovroutes.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | travel-execute, travel-negative, travel-recover, travel-understand, operations-execute, operations-negative, operations-recover, operations-understand, acceptance:link:ovroutes:29bef95e3f9762a4138483e4fad9c1ef36c791deb9aca71af922ec5006b37c42, acceptance:link:ovroutes:b9aac305c83cc977f0b0586ae14e0f3a568ff7e2e041ca1667b04c939dea2418 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/pakketten.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, content-execute, content-negative, content-recover, content-understand, acceptance:link:onderneming:32afa60f8062dac5443c2944cab82c0819a0aa3beeea712b66a39a42066a81c8, acceptance:link:onderneming:75ecf87e208fc40201b0676e98428013894cbf12158477e6f48cf5b6c619a37f | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/partner-network.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, governance-execute, governance-negative, governance-recover, governance-understand, acceptance:link:partnernetwerk:9b111d24afb77cf859f91e9810b0e888747f607c4a5685a1fdd29d6e80763980, acceptance:link:partnernetwerk:8f922144d4365e569e19a94b76247f021e965571369990797541dc760721c0c6 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/partner-worden.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | identity-execute, identity-negative, identity-recover, identity-understand, governance-execute, governance-negative, governance-recover, governance-understand, acceptance:link:partnernetwerk:9b111d24afb77cf859f91e9810b0e888747f607c4a5685a1fdd29d6e80763980, acceptance:link:partnernetwerk:8f922144d4365e569e19a94b76247f021e965571369990797541dc760721c0c6 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/passkeys.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:passkeys:27da26d4d5cf44995917dda5bff139a8db25c54c8cf0fe9ad1fb957c8180b81e, acceptance:link:passkeys:b89b3c2595d70020dc8b94ab4e247c643f5385e254a1726dbdbd967572885e16 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/pay.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | transaction-execute, transaction-negative, transaction-recover, transaction-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:pay:45320754b04652e620a9b3d5612ee728ca0531dd446fa41b1aea810c7fd7e2c2, acceptance:link:pay:cafb987b5c70eb9c2143e12f32d6b9880dfae804f1f81c8f03912af1f8229ca5 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/payroll.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | transaction-execute, transaction-negative, transaction-recover, transaction-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:loonstrook:e6d5012dde8cab0ac5e574ad316a220279e9dc0dba27e1236557eea5eb0fbd8a, acceptance:link:loonstrook:38283a6cfc9258513b7b500b9fc1e633642a01b227fc2806cbcc01a488112859 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/personeel.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:os:werk:c6c76a3fcd840bbd277b43fab4a322bc114c21b8916a72e21708007cd6efec02, acceptance:os:werk:12043a30f4bf4f37b7957db352f2349fe401c1df5e6fe09a68a87e73f9b12990 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/platformregister.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/podium.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, communication-execute, communication-negative, communication-recover, communication-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand, acceptance:link:podium:f8420d3655061a5c86840af2ae9ba112c65268e51f1f2cd5671f97f3fe3f00e3, acceptance:link:podium:d51e910b63aa894735ac73fdd12a6768cdb890be05f05b8198075394f434e0ad | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/project-room.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, governance-execute, governance-negative, governance-recover, governance-understand, acceptance:link:projectroom:cfa2265875650e70bfd3b98bb011157dfa64bf1750558a24eda6f87d43de8d3f, acceptance:link:projectroom:753850e181de7ee5d5c7e484b4c913d57aeb102725ec2677105daf94fd9ba19c | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/pulse.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | communication-execute, communication-negative, communication-recover, communication-understand, content-execute, content-negative, content-recover, content-understand, acceptance:link:pulse:4400e0f23e779db98db7cab500c75262fcac98dd296b6aa66e3fadaa9a603947, acceptance:link:pulse:371f950f5b43712205cb424fe85bc6d1ea3834b92fce95d52a6ec76c4391ca58 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/rechtbank.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | governance-execute, governance-negative, governance-recover, governance-understand, identity-execute, identity-negative, identity-recover, identity-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/redactie-pda.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, acceptance:link:nieuws:86655d47c5e4737f6ffa7f3a1138f22a27a6b552afb3c2fede72ff5660f84d1a, acceptance:link:nieuws:5a3770808850246319289c826d4da414fbcc89fd8aa251a406d9aa523c105c9c | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/redactie.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, acceptance:link:nieuws:86655d47c5e4737f6ffa7f3a1138f22a27a6b552afb3c2fede72ff5660f84d1a, acceptance:link:nieuws:5a3770808850246319289c826d4da414fbcc89fd8aa251a406d9aa523c105c9c | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/redactiekantoor.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | governance-execute, governance-negative, governance-recover, governance-understand, content-execute, content-negative, content-recover, content-understand, acceptance:link:nieuws:86655d47c5e4737f6ffa7f3a1138f22a27a6b552afb3c2fede72ff5660f84d1a, acceptance:link:nieuws:5a3770808850246319289c826d4da414fbcc89fd8aa251a406d9aa523c105c9c | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/reisboek.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | travel-execute, travel-negative, travel-recover, travel-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand, acceptance:link:reisboek:82b8f86d0b0193d665bd743a50a4a370e1359d2701b9b9996f7d8ad122837bd8, acceptance:link:reisboek:c329a1d356424d86c0942fb73288b44247dfe9c21bb68cb8f18a1f2c864ff5ff | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/reisbureau.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | travel-execute, travel-negative, travel-recover, travel-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand, acceptance:tab:reizen:9cd766d9928c39a694c0e1b4b83f1ec71c9aa476e97981446b51c668ae296059, acceptance:tab:reizen:ccfef49dd035f679b66f5360217db332a176bec619b46bccef4013153ccdd6bb, acceptance:link:reisboek:82b8f86d0b0193d665bd743a50a4a370e1359d2701b9b9996f7d8ad122837bd8, acceptance:link:reisboek:c329a1d356424d86c0942fb73288b44247dfe9c21bb68cb8f18a1f2c864ff5ff | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/reisuitnodiging.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | travel-execute, travel-negative, travel-recover, travel-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:tab:reizen:9cd766d9928c39a694c0e1b4b83f1ec71c9aa476e97981446b51c668ae296059, acceptance:tab:reizen:ccfef49dd035f679b66f5360217db332a176bec619b46bccef4013153ccdd6bb | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/reizen-veilig.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | travel-execute, travel-negative, travel-recover, travel-understand, identity-execute, identity-negative, identity-recover, identity-understand, care-execute, care-negative, care-recover, care-understand, acceptance:link:reizen:80c24ac7ed534e90c974fa36c24c210ff2304387ea0219b0e9864e90ac1a7f5d, acceptance:link:reizen:5de989e2caae3d5e6a1c1039dfcf2ef19b7a79c0595d43a0765045d9d2b270a4 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/reizen.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | orientation-execute, orientation-negative, orientation-recover, orientation-understand, travel-execute, travel-negative, travel-recover, travel-understand, acceptance:tab:reizen:9cd766d9928c39a694c0e1b4b83f1ec71c9aa476e97981446b51c668ae296059, acceptance:tab:reizen:ccfef49dd035f679b66f5360217db332a176bec619b46bccef4013153ccdd6bb, acceptance:link:reisboek:82b8f86d0b0193d665bd743a50a4a370e1359d2701b9b9996f7d8ad122837bd8, acceptance:link:reisboek:c329a1d356424d86c0942fb73288b44247dfe9c21bb68cb8f18a1f2c864ff5ff | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/rendezvous.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | communication-execute, communication-negative, communication-recover, communication-understand, care-execute, care-negative, care-recover, care-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:rendezvous:df131bf6ecb4500e05c22efe4053aec7c2a1d8bbe5b56ba98b46e1b5b72503d5, acceptance:link:rendezvous:dfe28ba0f3bf1bf24e5a6fcc1f1b3f1f7b4979f5ef33157b7133e41e21d2c0c3 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/residentie.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | communication-execute, communication-negative, communication-recover, communication-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:residentie:16a11097119dba8a9117a7360f82f36c2e9070921fcc5534b0c76db0bf48c5de, acceptance:link:residentie:8f2b34de8337c13b1d9c1eed77ea0ade5d8dd9aa630ce375001d52932ad1f2f6 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/rijksloket.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | governance-execute, governance-negative, governance-recover, governance-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/rit.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | travel-execute, travel-negative, travel-recover, travel-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand, acceptance:link:ov:3e0e0f0bcffc1e0a40314397270ccda5b6446b53a7d3e06d51cc175d06c6feca, acceptance:link:ov:c795090c3a998f82713db496082cb02234916d5a97ef89b8d555adf37b2e9796, acceptance:link:aankomst:a6402833f873cb37da08982cb57cb66d13973bbcd3ad76e1ee5c94905f8f0304, acceptance:link:aankomst:1486c6eb70839ad6dc7545ea30bddafaa1a992ad0424949182997ef0cd788e58 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/routedekking.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/routedossier.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, acceptance:link:routedossier:30494be8f1acf27e2818642ae18af52b2972a6578e6343cbc247cfe383d91730, acceptance:link:routedossier:ddc9f730aba50434054933bcc6b44f27866b761aaa7d81079b190ece20700145 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/rtg.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | orientation-execute, orientation-negative, orientation-recover, orientation-understand, content-execute, content-negative, content-recover, content-understand, acceptance:link:ontdek:6486e53a915846ed3b584d265e41e4267ee30968895a2a9cdcd0303c9b5337eb, acceptance:link:ontdek:cc0334ca2b6bc54f9876e8590d73bec292c2ca05595f941515b6620bfcf416a7 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/rtgcode.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, evidence-integrity | redirect-execute, redirect-negative, redirect-recover, redirect-understand, acceptance:link:rtgcode:1f8437eb28c2d608fe0e16a5103609528d4d096d878a4efe2f7e8ef08e1b5ecd, acceptance:link:rtgcode:ca1c320e79bb675a673159ed991108a50b5c0829fe540d98e984e56f68821bb6 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/rtgid.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:passkeys:27da26d4d5cf44995917dda5bff139a8db25c54c8cf0fe9ad1fb957c8180b81e, acceptance:link:passkeys:b89b3c2595d70020dc8b94ab4e247c643f5385e254a1726dbdbd967572885e16, acceptance:link:vertegenwoordiging:6bd12f4651dcb9c16622a0738ee806beb2f08b82b7da376b43aaac3a0591942a, acceptance:link:vertegenwoordiging:df6a78bb086be28c43c0c41f4279f6c6afe9162dce706fafafcd12a303fd55cb | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/rtgkantoor.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | governance-execute, governance-negative, governance-recover, governance-understand, operations-execute, operations-negative, operations-recover, operations-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/rtgone.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, governance-execute, governance-negative, governance-recover, governance-understand, acceptance:link:rtgone:3d4a307db9429f984fbcfde22f9d0eb856b0821b41f77f2c213dbc8f2a57bcd3, acceptance:link:rtgone:2169307dc51ff344c701de7feaf581822d82c33e3ab184b978f8e016a3c7c10c | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/rtgschool.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:school:854c08ebb1ec9402b2020aef45d0b99ff284804005320fb13eb69af9bce4dd5c, acceptance:link:school:c368a5feb5ba5ae9fbe47100c052a0f7df1dc7fc0dd6f04c6489358abafff139 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/rtmail.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | communication-execute, communication-negative, communication-recover, communication-understand, content-execute, content-negative, content-recover, content-understand, acceptance:link:rtmail:8380a54c223ba9db317e92538d7ccd792a71c1402539db8056ee6351005a0998, acceptance:link:rtmail:b6db559437d8d9eac9aca0bd89fd4f9ed6a23f2e2c8976ea982e81d1a677533d | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/salon.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | communication-execute, communication-negative, communication-recover, communication-understand, content-execute, content-negative, content-recover, content-understand, acceptance:tab:salon:d327b879a1b3a1c8439e6d55b313de90826f4713c170a01b33fbe592f85099ea, acceptance:tab:salon:a89dd4c6e5559e88063375271e6ac748de07c92711b3db223573dcd622f847cf | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/scanner.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, acceptance:link:office:41501cd9a3180e31701db562fbe91a7a2b83fadb73654f16a927e7fece8ada12, acceptance:link:office:fccdc8590bfe349763761c0f1c25d67e7010566d6a299aacee0845516a300ce8 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/scherm.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:tweedescherm:dbb92348510435d3ceb4282a0b3f4fb3fc80db9b87f909eb13e98b1c3be94ef3, acceptance:link:tweedescherm:2bbe7ca58bf5f951bfc8f72cc95344c9e1741f645fa339d21d4ebc34d04ebbf8 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/schoolpartner.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, governance-execute, governance-negative, governance-recover, governance-understand, acceptance:link:school:854c08ebb1ec9402b2020aef45d0b99ff284804005320fb13eb69af9bce4dd5c, acceptance:link:school:c368a5feb5ba5ae9fbe47100c052a0f7df1dc7fc0dd6f04c6489358abafff139 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/service-bel.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | communication-execute, communication-negative, communication-recover, communication-understand, acceptance:os:bellen:5e750bdbc9857702c408fb46aa46142221681ce9027e0e2d327de9e499a4f020, acceptance:os:bellen:1a1ce158935270ba77e91800a8594cb93ebeaae73b4ac1e56df82f9ae4c712ad | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/service.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | communication-execute, communication-negative, communication-recover, communication-understand, operations-execute, operations-negative, operations-recover, operations-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/sitemaker.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:sitemaker:393cb6efde611d8d996afab9086f5469432910d90aa25f29bd29ee980f9021a7, acceptance:link:sitemaker:9493af3abea1635b9ef7c6001f8a3a6da03db26b86b4fe5f3f7d989b178f0e5e | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/sociaal-prive.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | orientation-execute, orientation-negative, orientation-recover, orientation-understand, identity-execute, identity-negative, identity-recover, identity-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/sociaal.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | orientation-execute, orientation-negative, orientation-recover, orientation-understand, communication-execute, communication-negative, communication-recover, communication-understand, acceptance:link:sociaal:173d75f43f34de0f33f9236bd1f16a76ad9a238d439d6b33364c0929a93b2c20, acceptance:link:sociaal:06a79e8dd1863f246d5f6132b5d2d36a020343c6a117a0ac7995d0d04d8447e3 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/spelen.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, communication-execute, communication-negative, communication-recover, communication-understand, acceptance:link:spelen:4d7f8ea0a2eeda64bda0afc56b62c0f791699ac3d86cbc3c4f0321c7098ebdd7, acceptance:link:spelen:245caeff99f8861fa017941f9c20733109cd19fb7b766783a99d1ce9db632be5 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/spelscherm.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | learning-execute, learning-negative, learning-recover, learning-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:spelavond:57d342b74feffa3adc639b6eea63cb2488c0b1b59bd9c52a049ddc434306faeb, acceptance:link:spelavond:63083676b4583b059464fe49de98ae87e5c83a505b1ee1c1e27d42d19db98e93 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/sport.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | travel-execute, travel-negative, travel-recover, travel-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand, acceptance:link:sport:32456585aa9d04f15cb8b336559a926c27273b036e210a405a8661fb6758adf7, acceptance:link:sport:772c04c5a7f786f4cc29ccfa7d8e4ef2e45a34e16c836b6a60021644db24296b | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/sportclub.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/stad.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | travel-execute, travel-negative, travel-recover, travel-understand, orientation-execute, orientation-negative, orientation-recover, orientation-understand, acceptance:link:stad:54abf6ec72617364f869e06405d92ab8a459dbda1d18da650aa99f6fe90051b4, acceptance:link:stad:7e9eec9dd4a4179e0d0f39a9c94607be8b3a245a63b22a2801dcc8c35e14c8b3 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/stadsdoos.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | identity-execute, identity-negative, identity-recover, identity-understand, operations-execute, operations-negative, operations-recover, operations-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/studio-pda.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/table.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand, acceptance:link:table:3f94bdd25038705dae65156a47c1c199761b727286d9d7114e65d74be9a68444, acceptance:link:table:ca94c63f9851e4490188f0dc5f343f2d6cf6a928494b48223e19f10efe9a186e | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/techniek.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, identity-execute, identity-negative, identity-recover, identity-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/theater.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand, acceptance:link:theater:1f64c35af788ee414b4be4adece94e9aa7309fddd2a8fa99164c49e47caad1c8, acceptance:link:theater:0bdb3cdc15c45888520c6b8f730f63ecd4ee254c1554715fe817fd6019eaa026 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/thuis.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | transaction-execute, transaction-negative, transaction-recover, transaction-understand, operations-execute, operations-negative, operations-recover, operations-understand, acceptance:link:huis:0d7034daefe7b08ad7022b8f09a98d9ece6d9e0f5fc55b2980ec14f893ad3674, acceptance:link:huis:6be139caceb2b9b668ddcfae82e6da5d2f9da9c3865d304e133652bfdbd44afb | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/thuisrust.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, evidence-integrity | redirect-execute, redirect-negative, redirect-recover, redirect-understand, acceptance:link:veilig:d2a5662bbcaca3a0d61044547aa557d0e5b67c7250c9d39ba7b7c08090d1c7df, acceptance:link:veilig:d604d1268c1d6a24df9004506054222321379471cc72f9fa5d59c82e6880c06b | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/thuiswacht.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, evidence-integrity | redirect-execute, redirect-negative, redirect-recover, redirect-understand, acceptance:link:veilig:d2a5662bbcaca3a0d61044547aa557d0e5b67c7250c9d39ba7b7c08090d1c7df, acceptance:link:veilig:d604d1268c1d6a24df9004506054222321379471cc72f9fa5d59c82e6880c06b | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/tijdlijn.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, identity-execute, identity-negative, identity-recover, identity-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/toestemming.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, evidence-integrity | redirect-execute, redirect-negative, redirect-recover, redirect-understand, acceptance:link:relaties:32b903478c98e181201f103749c5b0bdfffaa15933f436c005536f7770ada9e5, acceptance:link:relaties:bc832e143319b277d34ea9fe1a103044959ba2c58ee28373e93c19722d6baf85 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/training.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | care-execute, care-negative, care-recover, care-understand, content-execute, content-negative, content-recover, content-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/uitgaan.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | travel-execute, travel-negative, travel-recover, travel-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand, acceptance:link:uitgaan:9669f472af668cbbe3cbdb2198bd493882ade44d83d0038332836aadb028dcc8, acceptance:link:uitgaan:512080cb429b723ea32c55a451bbb4f2920327ec0ea0b84bff43434a5e37cf8a | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/vandaag.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, evidence-integrity | redirect-execute, redirect-negative, redirect-recover, redirect-understand, acceptance:link:vandaag:5ceda6161cb56224410916c658a8305d943a0fd17cd616ffee51b409c48265eb, acceptance:link:vandaag:a7bf0225907d89c22b2573ff676ee42e4e155e2dbc3e0c4191fbaf5485e4b662 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/veilig.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | care-execute, care-negative, care-recover, care-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:veilig:d2a5662bbcaca3a0d61044547aa557d0e5b67c7250c9d39ba7b7c08090d1c7df, acceptance:link:veilig:d604d1268c1d6a24df9004506054222321379471cc72f9fa5d59c82e6880c06b | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/verificatie.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | identity-execute, identity-negative, identity-recover, identity-understand, governance-execute, governance-negative, governance-recover, governance-understand, acceptance:link:verificatie:1f051ede7cfdef28cdc906cf5673a2c6259b84121372d30c8b2c4c798d160387, acceptance:link:verificatie:9f8d0ef2d1a7862a1319e57cc860798e8db682d88fdcdeaab8b5ddc31fa8d429 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/vertaler.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, travel-execute, travel-negative, travel-recover, travel-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/vertegenwoordiging.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | identity-execute, identity-negative, identity-recover, identity-understand, governance-execute, governance-negative, governance-recover, governance-understand, acceptance:link:vertegenwoordiging:6bd12f4651dcb9c16622a0738ee806beb2f08b82b7da376b43aaac3a0591942a, acceptance:link:vertegenwoordiging:df6a78bb086be28c43c0c41f4279f6c6afe9162dce706fafafcd12a303fd55cb | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/vitaal.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, evidence-integrity | redirect-execute, redirect-negative, redirect-recover, redirect-understand, acceptance:link:veilig:d2a5662bbcaca3a0d61044547aa557d0e5b67c7250c9d39ba7b7c08090d1c7df, acceptance:link:veilig:d604d1268c1d6a24df9004506054222321379471cc72f9fa5d59c82e6880c06b | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/vluchten.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | travel-execute, travel-negative, travel-recover, travel-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand, acceptance:link:vluchten:14659252781959c8bb62dca2c592ffd4393a3af50c472962dc0459719850d3bd, acceptance:link:vluchten:b7888253dd19b7da35a2234532f49c162e20eca82b880e3372ed59dc23f9f24e | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/voeding.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | care-execute, care-negative, care-recover, care-understand, content-execute, content-negative, content-recover, content-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/voertuig.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, travel-execute, travel-negative, travel-recover, travel-understand, acceptance:link:ov:3e0e0f0bcffc1e0a40314397270ccda5b6446b53a7d3e06d51cc175d06c6feca, acceptance:link:ov:c795090c3a998f82713db496082cb02234916d5a97ef89b8d555adf37b2e9796 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/vonk.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | communication-execute, communication-negative, communication-recover, communication-understand, identity-execute, identity-negative, identity-recover, identity-understand, care-execute, care-negative, care-recover, care-understand, acceptance:link:vonk:e038d1368c26d03bec44fda2eed8c26c627e4e4351017190446c630d3443ab98, acceptance:link:vonk:d31be4259ea081c22272c73b9e305e8ca818dd40b77b96e765137a830a61352b | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/wallet.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, evidence-integrity | redirect-execute, redirect-negative, redirect-recover, redirect-understand, acceptance:link:wallet:db284a38ba0d8d32cd504144e22a210f7e9b78749a34515a59ea40c46ded5cda, acceptance:link:wallet:bfb0c95e14ca1d0bd217fe4024b8ac67b0c2d9c16ac7ebe00de4497dc0ea39a3 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/wbw.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, evidence-integrity | redirect-execute, redirect-negative, redirect-recover, redirect-understand, acceptance:link:wbw:32a5aea0bf36f40dbe22294701bca0bfa618c86c6a810c1f7602f9e44e518f5c, acceptance:link:wbw:40cc4d87bd50943deabd6505237fc3a3c7191eef94a083b290d0c899d9c0bfbc | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/websitestudio.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, acceptance:link:sitemaker:393cb6efde611d8d996afab9086f5469432910d90aa25f29bd29ee980f9021a7, acceptance:link:sitemaker:9493af3abea1635b9ef7c6001f8a3a6da03db26b86b4fe5f3f7d989b178f0e5e | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/wereld.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | communication-execute, communication-negative, communication-recover, communication-understand, orientation-execute, orientation-negative, orientation-recover, orientation-understand, acceptance:link:wereldlaag:c6c4598fefe875517eed1a99e073126f6c51b11b5ba5bc5f2862fd3edd91b5d5, acceptance:link:wereldlaag:8b9ae539a799a96f3c2cbeab717be1c5c81cac3c10d565705518134f8c0feeb2 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/werk.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, identity-execute, identity-negative, identity-recover, identity-understand, governance-execute, governance-negative, governance-recover, governance-understand, acceptance:link:werkos:b1bc90a2eddf8597b1992378045bc473ad7533336239750a6d6cca03467a65b7, acceptance:link:werkos:6718a39f2646701f1d71fc1406a17ef8dbb8aa35ad15696b4eea20dee5663ae4 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/werkplek.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | orientation-execute, orientation-negative, orientation-recover, orientation-understand, identity-execute, identity-negative, identity-recover, identity-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/werkruimte.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, operations-execute, operations-negative, operations-recover, operations-understand | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/wonen.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | operations-execute, operations-negative, operations-recover, operations-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:wonen:5bdbd71b26f53b8939c76b025d3693e89254713953ac9207c4dc3d1a32783f94, acceptance:link:wonen:44fbcd43a1b6b2d6c44393624214d2f7cb9ad421515cc41adea7d25b00299fa2 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/woningdossier.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, acceptance:link:wonen:5bdbd71b26f53b8939c76b025d3693e89254713953ac9207c4dc3d1a32783f94, acceptance:link:wonen:44fbcd43a1b6b2d6c44393624214d2f7cb9ad421515cc41adea7d25b00299fa2 | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/zaakkosten.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | transaction-execute, transaction-negative, transaction-recover, transaction-understand, operations-execute, operations-negative, operations-recover, operations-understand | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/zaakpay.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | transaction-execute, transaction-negative, transaction-recover, transaction-understand, identity-execute, identity-negative, identity-recover, identity-understand, acceptance:link:pay:45320754b04652e620a9b3d5612ee728ca0531dd446fa41b1aea810c7fd7e2c2, acceptance:link:pay:cafb987b5c70eb9c2143e12f32d6b9880dfae804f1f81c8f03912af1f8229ca5 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/zaakweb.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, acceptance:link:sitemaker:393cb6efde611d8d996afab9086f5469432910d90aa25f29bd29ee980f9021a7, acceptance:link:sitemaker:9493af3abea1635b9ef7c6001f8a3a6da03db26b86b4fe5f3f7d989b178f0e5e | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/zaal.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | content-execute, content-negative, content-recover, content-understand, acceptance:link:mediaos:d802e0251a3f5ff96f6cd515a81eea58521d0923802a048aa369cf000411c508, acceptance:link:mediaos:063f4bff4ef7e4e5f3262f55b071c36a15b36434101c0be7c0a00596d8efe18e | sensitive:mobile-small, sensitive:mobile-large, sensitive:tablet, sensitive:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/zakelijk.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, human-comprehension, evidence-integrity | travel-execute, travel-negative, travel-recover, travel-understand, transaction-execute, transaction-negative, transaction-recover, transaction-understand, acceptance:link:ov:3e0e0f0bcffc1e0a40314397270ccda5b6446b53a7d3e06d51cc175d06c6feca, acceptance:link:ov:c795090c3a998f82713db496082cb02234916d5a97ef89b8d555adf37b2e9796 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |
| `/apps/zorgbalie.html` | purpose, task-lifecycle, truth, authorization, data-minimization, persistence-recovery, interaction, visual-identity, accessibility, performance, evidence-integrity | redirect-execute, redirect-negative, redirect-recover, redirect-understand, acceptance:os:werk:c6c76a3fcd840bbd277b43fab4a322bc114c21b8916a72e21708007cd6efec02, acceptance:os:werk:12043a30f4bf4f37b7957db352f2349fe401c1df5e6fe09a68a87e73f9b12990 | critical:mobile-small, critical:mobile-large, critical:tablet, critical:desktop | browser-state-trace, scope-and-impact, human-observation, domain-state-readback, recovery-trace, provider-confirmation, authorization-negative, privacy-storage-audit, visual-review, accessibility-observation, performance-samples, execution-integrity |

## Premium Experience Gate

Vijf afzonderlijke voorwaarden binnen G1-G4; alle moeten slagen. Nieuwe en ervaren gebruikers worden apart getoetst. Samenhang, verzorging en vertrouwen vragen gestructureerde onafhankelijke menselijke beoordeling. De bestaande human-quality-blokkade blijft actief totdat bevoegd bewijs beschikbaar is.

| Vraag / ID | Vereiste dimensies | Meetbare acceptatie | Bewijscontracten |
|---|---|---|---|
| Kan een nieuwe gebruiker zonder uitleg de belangrijkste taak zelfstandig vinden en voltooien? (novice-task) | identity, composition, restraint, accessibility, human-quality | {"cohorts":["novice"],"unassistedTaskSuccessRatioMinRef":"qualificationPlanning.budgetMatrix[budgetCell].humanComprehension.unassistedTaskSuccessRatioMin","meaningfulActionsMaxRef":"qualificationPlanning.taskFamilies[taskFamily].interactionBudget.meaningfulActionsMax","navigationHopsMaxRef":"qualificationPlanning.measurementProtocol.navigationHopsFromPersonaHomeMax","navigationExceptionsSource":"qualificationPlanning.measurementProtocol.navigationExceptionsSource","criticalFindingsMax":0,"successDefinition":"De bedoelde taak is vanuit de vooraf vastgelegde persona-ingang in de juiste canonieke scène afgerond, de werkelijke bronuitkomst klopt en de gebruiker kan die uitkomst aanwijzen; niet alleen de juiste knop vinden. Geholpen, afgebroken en fout afgeronde pogingen zijn geen onbegeleid succes.","interactionBudgetAppliesToEverySuccessfulAttempt":true} | human-observation, browser-state-trace, accessibility-observation, execution-integrity |
| Kan een ervaren gebruiker de belangrijkste taak efficiënt uitvoeren zonder onnodige stappen of verlies van controle? (expert-efficiency) | composition, restraint, adaptability, accessibility, fluidity, human-quality | {"cohorts":["experienced"],"unassistedTaskSuccessRatioMinRef":"qualificationPlanning.budgetMatrix[budgetCell].humanComprehension.unassistedTaskSuccessRatioMin","meaningfulActionsMaxRef":"qualificationPlanning.taskFamilies[taskFamily].interactionBudget.meaningfulActionsMax","unnecessaryContextSwitchesMaxRef":"qualificationPlanning.taskFamilies[taskFamily].interactionBudget.unnecessaryContextSwitchesMax","simultaneousPrimaryActionsMaxRef":"qualificationPlanning.taskFamilies[taskFamily].interactionBudget.simultaneousPrimaryActionsMax","performanceLimitsRef":"qualificationPlanning.budgetMatrix[budgetCell].performance","criticalFindingsMax":0,"interactionBudgetAppliesToEverySuccessfulAttempt":true,"baselinePolicyRef":"qualificationPlanning.premiumExperienceGate.cohortProtocol.experienced.baselinePolicy","safetyStepsMayBeRemovedForEfficiency":false,"taskDurationRule":"Leg werkelijke taakduur en wachtoorzaken vast; de grens komt uit een vooraf vastgesteld passend taakbudget indien van toepassing, niet uit één nieuw platformbreed aantal seconden. De bestaande feedback-, wachtstatus- en herstelbudgetten blijven harde grenzen."} | human-observation, browser-state-trace, performance-samples, execution-integrity |
| Begrijpt de gebruiker vóór een beslissing wat er gebeurt, voor wie, met welke gevolgen en wat nog onzeker is? (informed-decision) | identity, continuity, restraint, accessibility, human-quality | {"cohorts":["novice","experienced"],"teachBackCorrectRatioMinRef":"qualificationPlanning.budgetMatrix[budgetCell].humanComprehension.teachBackCorrectRatioMin","questionsRef":"qualificationPlanning.budgetMatrix[budgetCell].humanComprehension.questions","criticalMisunderstandingsMax":0,"criticalFindingsMax":0,"assessmentMoment":"Vóór de eerste beslissende bevestiging met mogelijk extern of gevoelig gevolg; bij alleen-lezen taken vóór de gebruiker de getoonde status als grond voor verder handelen gebruikt.","correctTeachBack":"De deelnemer benoemt in eigen woorden alle toepasselijke onderdelen: handeling en ontvanger, gegevens/kosten, bevestigde versus onzekere bronstatus en mogelijkheid of grens van annuleren/herstel. Een cruciaal onjuist onderdeel is een kritieke misvatting, ook wanneer een totaalscore hoog is.","leadingPromptsAllowed":false,"unconfirmedOutcomePresentedAsConfirmedAllowed":false} | human-observation, browser-state-trace, authorization-negative, domain-state-readback, execution-integrity |
| Kan de gebruiker na een fout of onderbreking veilig verder, met begrijpelijke status en zonder verlies, duplicatie of ongeoorloofde handeling? (safe-resumption) | continuity, adaptability, accessibility, fluidity, human-quality | {"cohorts":["novice","experienced"],"unassistedTaskSuccessRatioMinRef":"qualificationPlanning.budgetMatrix[budgetCell].humanComprehension.unassistedTaskSuccessRatioMin","teachBackCorrectRatioMinRef":"qualificationPlanning.budgetMatrix[budgetCell].humanComprehension.teachBackCorrectRatioMin","extraActionsForRecoveryMaxRef":"qualificationPlanning.taskFamilies[taskFamily].interactionBudget.extraActionsForRecoveryMax","interruptionLimitsRef":"qualificationPlanning.budgetMatrix[budgetCell].interruption","recoveryLimitsRef":"qualificationPlanning.budgetMatrix[budgetCell].recovery","criticalFindingsMax":0,"successDefinition":"De gebruiker bereikt zelfstandig een aantoonbaar veilige vervolgtoestand, begrijpt wat wel/niet bewaard of bevestigd is en kan hervatten of passende hulp kiezen. Wachten op bronreconciliatie mag de juiste veilige uitkomst zijn, maar is geen afgeronde boeking of betaling.","unconfirmedExternalReplayAllowed":false} | human-observation, recovery-trace, domain-state-readback, authorization-negative, privacy-storage-audit, performance-samples, execution-integrity |
| Ervaart de gebruiker de interface als samenhangend, zorgvuldig afgewerkt en betrouwbaar, passend bij de eigen identiteit van deze RTG-ervaring? (coherent-trust) | identity, composition, restraint, adaptability, accessibility, human-quality | {"cohorts":["novice","experienced"],"criticalFindingsMax":0,"rubric":{"scaleMin":1,"scaleMax":5,"scoreMinPerCriterion":4,"independentHumanAssessmentRequired":true,"everyObservedRatingMustMeetMinimum":true,"averagingAllowed":false,"criticalFindingsMax":0,"scaleAnchors":{"1":"Onbruikbaar of misleidend: de taak of het vertrouwen breekt.","2":"Ernstige onduidelijkheid of inconsistentie: hulp of omwegen zijn nodig.","3":"Bruikbaar, maar merkbare twijfel, onverklaarde afwijking of onafgewerkte toestand blijft bestaan.","4":"Zelfstandig duidelijk, consistent en verzorgd in de hele getoetste taak, inclusief fouten en herstel; concrete waarnemingen onderbouwen de score.","5":"Voldoet aan 4 en ondersteunt ook de getoetste veeleisende variant uitzonderlijk helder en zorgvuldig, zonder extra complexiteit of misleidende zekerheid."},"criteria":[{"id":"orientation","label":"Oriëntatie","observable":"De gebruiker kan doel, huidige plaats, hoofdhandeling, bronstatus en veilige terugweg aanwijzen zonder verborgen navigatiekennis."},{"id":"consistency","label":"Samenhang en consistentie","observable":"Benamingen, bediening en statusbetekenis blijven herkenbaar binnen en tussen de bezochte scènes; een Experience Signature mag verschillen in sfeer, niet willekeurig in betekenis of veiligheidsgrens."},{"id":"craft","label":"Zorgvuldige afwerking","observable":"Inhoud, hiërarchie, typografie, uitlijning, focus, laden, lege toestanden en foutmeldingen zijn leesbaar en af; geen afsnijding, springende betekenis, onafgemaakte tekst of onverklaarde visuele regressie."},{"id":"trust","label":"Betrouwbaarheid en eerlijkheid","observable":"De interface maakt bron, toestemming, kosten, bewaren, onzekerheid en herstel begrijpelijk zonder onbewezen zekerheid, kunstmatige urgentie of tegenstrijdige belofte."}],"ratingRule":"Nieuwe gebruikers, ervaren gebruikers en de onafhankelijke beoordelaar geven per criterium een gemotiveerde score met waargenomen voorbeeld. Iedere toepasselijke score is minstens 4; geen gemiddelde over criteria, personen of apparaten. Een kritieke veiligheids-, toegankelijkheids- of waarheidsbevinding blokkeert ongeacht de scores.","disagreementRule":"Bewaar afwijkende beoordelingen en onderzoek de concrete oorzaak. Alleen aantoonbare meetfout met onafhankelijke motivering mag worden gecorrigeerd; onwelgevallige deelnemers of lage scores mogen niet worden verwijderd. Een productwijziging vereist herbeoordeling op de nieuwe kandidaat."}} | human-observation, visual-review, accessibility-observation, browser-state-trace, execution-integrity |

## Gedeelde acceptatiescenario’s

Deze 48 scenario’s vullen de 228 specifieke capabilityscenario’s aan. Geen ervan is door deze planningtoets uitgevoerd.

| ID | Gegeven | Wanneer | Vereiste uitkomst | Bewijscontract | Instrument / ontbrekende producer |
|---|---|---|---|---|---|
| orientation-execute | Een echte lid-, medewerker-, partner- of Foundation-persona opent zijn eigen ingang met geldige rechten. | De persona zoekt een toegewezen taak, opent het scherm en keert terug. | De route bereikt de juiste canonieke eigenaar binnen het bestaande navigatiebudget; zichtbare bron, rol en taakcontext blijven gelijk. | browser-state-trace, scope-and-impact | scripts/tikken.js, scripts/vindbaar.js |
| orientation-negative | Een persona heeft geen recht op de taak of de bron is onbeschikbaar. | De persona gebruikt zoekresultaat, directe URL en eerder geopende projectie. | Geen verborgen inhoud of mutatie; de echte deur en concrete reden verschijnen zonder een andere app als voltooiing te tonen. | authorization-negative, browser-state-trace | scripts/bevoegdronde.js |
| orientation-recover | Een legale zoek-/leescontext bestaat en het netwerk valt weg. | De gebruiker gaat terug, herlaadt en wisselt daarna van account. | Alleen toegestane context wordt hersteld; oude en offline bron zijn herkenbaar, andere account ontvangt geen context. | recovery-trace, privacy-storage-audit | test/personalos-experience.e2e.js |
| orientation-understand | Een deelnemer krijgt een concrete vindtaak zonder de schermnaam als hint. | De deelnemer kiest een ingang en legt doel, bron en volgende stap uit. | De taak haalt het familiebudget en het risicogebonden begripcriterium; hulp, verkeerde ingang en onduidelijke bron worden als bevinding vastgelegd. | human-observation, accessibility-observation | scripts/vindbaar.js |
| identity-execute | Een bevoegde actor heeft een bestaande credential of toegangsinstelling en de vereiste verificatie. | De actor controleert en bevestigt één wijziging via de echte domeinpoort. | Alleen de bedoelde credential of bevoegdheid wijzigt; de nieuwe sessie leest dezelfde bronstatus en auditverwijzing. | browser-state-trace, domain-state-readback | scripts/lib/voltooi/passkeys.js |
| identity-negative | Een andere actor, verlopen sessie of onbevestigd stuk probeert dezelfde handeling. | De handeling wordt rechtstreeks en via hervatte UI uitgevoerd. | Lezen of wijzigen is geweigerd zonder identiteitslek; AI verleent geen Lifestyle/Business-toegang en een ingediend bewijs is niet goedgekeurd. | authorization-negative, privacy-storage-audit | test/kantoor-koppel-passkey.test.js, test/persoonseis.test.js |
| identity-recover | Tijdens credentialwijziging of herauthenticatie gaat het antwoord verloren. | De gebruiker vernieuwt, leest bij de bron en probeert veilig verder te gaan. | Geen dubbele credential, onbevoegde hervatting of onzichtbare lock-out; herstel volgt de bestaande accountprocedure en toont onzekere status. | recovery-trace, domain-state-readback | test/passkeys-weg.e2e.js |
| identity-understand | Een gebruiker krijgt een toegangs- of intrekkingsbesluit voorgelegd. | De gebruiker benoemt betrokken apparaat/persoon, gevolgen voor sessies en herstel. | Alle kritieke gevolgen zijn begrepen vóór bevestiging; toetsenbord en schermlezer tonen dezelfde beslissing en veilige uitweg. | human-observation, accessibility-observation | Menselijke producer ontbreekt; bestaande artifact-controle weigert onbevoegde review |
| transaction-execute | Een bevoegde actor ziet een bestaande order/betaling met definitieve ontvanger, bedrag, valuta en voorwaarden. | De actor bevestigt expliciet en controleert daarna de domein- en railstatus. | Maximaal één bedoeld effect; order, ledger en UI verwijzen naar dezelfde transactie. Ontvangen of aangevraagd wordt niet als betaald of geleverd getoond. | browser-state-trace, domain-state-readback, provider-confirmation | scripts/lib/voltooi/pay.js, test/pay-grootboek.test.js |
| transaction-negative | Ontvanger, prijs, versie, saldo, mandaat of tenant is gewijzigd na het tonen van de samenvatting. | De oude bevestiging en een herhaling worden ingestuurd. | De actuele domeinpoort weigert of vraagt herbevestiging; geen geldbeweging en geen stille wijziging van voorwaarden. | authorization-negative, domain-state-readback | test/bevoegdheid-keten.test.js, test/paybudget.test.js |
| transaction-recover | De provider heeft mogelijk verwerkt terwijl het antwoord uitvalt. | De gebruiker herlaadt en herhaalt met dezelfde domeinsleutel of vraagt annulering. | Bronreconciliatie bepaalt de uitkomst; maximaal één effect, geen automatische retry met nieuwe sleutel en geen terugbetaling zonder railbewijs. | recovery-trace, provider-confirmation, domain-state-readback | test/payout-terugboeking.test.js |
| transaction-understand | Een deelnemer ziet een transactie met onzeker resultaat en eventuele annuleringsbeperking. | De deelnemer legt ontvanger, bedrag, huidige status en veilige vervolgstap uit. | Geen deelnemer begrijpt 'aangevraagd' als definitief betaald; iedere kritieke misvatting blokkeert acceptatie. | human-observation, accessibility-observation | Menselijke producer ontbreekt; bestaande artifact-controle weigert onbevoegde review |
| travel-execute | Een lid, adviseur of bevoegde gast gebruikt de toegewezen reisroute met bestaande brongegevens. | Een reiswens wordt gecontroleerd, aangevraagd en volgens bevoegdheid verwerkt. | Reisoverzicht, documenten en gedeelde programma's lezen dezelfde bevestigde status; adviseursverklaring en providerbevestiging blijven herkenbaar verschillend. | browser-state-trace, domain-state-readback, provider-confirmation | test/workspace-travel-request.e2e.js, test/reisprogramma.e2e.js |
| travel-negative | Een oude prijs, ingetrokken gastlink of andere reisgenoot probeert details of een reservering te gebruiken. | De directe route en een eerder geladen plan worden opnieuw geopend of bevestigd. | Actuele rechten, voorwaarden en beschikbaarheid gelden; geen privé-inhoud of boeking via oude toestemming. | authorization-negative, privacy-storage-audit | test/reisprogramma.test.js, test/reservering-beleid.test.js |
| travel-recover | Een aanvraagantwoord gaat verloren of een bevestigd reisonderdeel verandert. | De reiziger heropent het plan en de adviseur controleert herstelopties. | Onzekere verwerking wordt bij de bron opgelost; gevolgen noemen geraakte onderdelen en onbekenden. Geen automatische nieuwe boeking of betaalhandeling. | recovery-trace, provider-confirmation, domain-state-readback | test/workspace-travel-recovery.e2e.js, test/reisbureau-nazorg.test.js |
| travel-understand | Een reiziger ontvangt een voorstel, aanvraag en later een gewijzigd reisprogramma. | De reiziger benoemt wat vaststaat, wat nog ontbreekt, wie handelt en welke hulp beschikbaar is. | De volledige reistaak blijft begrijpelijk met schermlezer en op het gekozen apparaat; een voorbeeld of PDF wordt niet voor live ticket aangezien. | human-observation, accessibility-observation | Menselijke producer ontbreekt; bestaande artifact-controle weigert onbevoegde review |
| content-execute | Een bevoegde maker opent een bestaand document of inhoudsobject met bekende versie. | De maker wijzigt, bewaart, heropent en leest een eerdere versie. | De bedoelde inhoud en versie blijven duurzaam bij de canonieke opslag; de UI claimt alleen de werkelijk bevestigde bewaring. | browser-state-trace, domain-state-readback | scripts/lib/voltooi/office.js, test/document-persistence.e2e.js |
| content-negative | Een andere actor of tenant, ingetrokken deelrecht of oudere versie probeert het object te lezen of schrijven. | Directe API en geopend venster voeren de handeling uit. | Geen gegevenslek of stille overschrijving; bronversie en geweigerd recht zijn zichtbaar zonder gevoelige inhoud te onthullen. | authorization-negative, privacy-storage-audit | test/document-revocation.test.js, test/office-save-atomic.test.js |
| content-recover | Een bewerking is deels lokaal en een opslagantwoord ontbreekt. | De browser wordt onderbroken, heropend en met de bron vergeleken. | Bevestigd bewaarde inhoud blijft intact; niet-bewaarde inhoud wordt alleen volgens expliciet bewaarcontract hervat, met conflictkeuze zonder dataverliesclaim. | recovery-trace, domain-state-readback, privacy-storage-audit | test/document-persistence.e2e.js |
| content-understand | Een maker ziet lokale wijzigingen, een bevestigde versie en een deelkeuze. | De maker legt uit wat bewaard is en wie de inhoud mag zien, en hervat een onderbroken bewerking. | Deelnemer kan bewaarstatus en rechten correct onderscheiden en de taak zonder hulp met toegestane bediening voltooien. | human-observation, accessibility-observation | Menselijke producer ontbreekt; bestaande artifact-controle weigert onbevoegde review |
| communication-execute | Een lid, collega of toegelaten gast opent een bestaande toegestane conversatie. | Na ontvangercontrole wordt één bericht bewust verzonden. | Afzender, ontvanger en inhoud zijn correct; maximaal één bericht, met werkelijk ontvangen/afgeleverd/gelezen status voor zover de bron die bewijst. | browser-state-trace, domain-state-readback | test/berichten.e2e.js, scripts/lib/voltooi/berichten.js |
| communication-negative | Een gesprek is privé, de deelnemer is ingetrokken of de tenant is anders. | De actor leest oude links, reconnectgegevens en verzendroutes. | Geen inhoud, bijlage, aanwezigheid of verzending buiten de actuele deelnemersgrens; ingetrokken toegang sluit ook nieuwe leveringen. | authorization-negative, privacy-storage-audit | test/comm-deelnemer.test.js, test/comm-werk.test.js |
| communication-recover | Een berichtantwoord of live verbinding valt weg. | De gebruiker reconnecteert, herlaadt en vraagt naar de bronstatus. | Geen dubbele verzending of onterechte ontvangstclaim; verbindingsverlies en veilige tekst-/handmatige terugval zijn zichtbaar zonder ongemerkt nieuw extern bericht. | recovery-trace, domain-state-readback | test/gezin-bericht-herhaal.test.js, test/comm-gast.test.js |
| communication-understand | Een deelnemer moet een bericht delen en een gesprek volgen zonder geluid. | De deelnemer controleert ontvangers, begrijpt de verzendstatus en gebruikt de beschikbare tekstbaan. | De taak is uitvoerbaar zonder kleur/geluid als enige signaal; ontbrekende live tekstbaan is expliciet een blokkade voor die beloofde taak. | human-observation, accessibility-observation | test/meelezen.test.js |
| care-execute | Een bevoegde gebruiker opent een bestaande hulpvraag, zorgafspraak of relevante projectie. | De gebruiker voert de toegezegde taak uit of opent de rechtmatige canonieke vervolgroute. | Hulpinformatie, intake en afspraak blijven onderscheidbaar; geen verzonnen dossier, zorgverlener, medische beoordeling of toezegging. | browser-state-trace, domain-state-readback | scripts/lib/voltooi/foundationzorg.js, test/foundation-hulp-zorg.test.js |
| care-negative | Een andere actor, kind zonder passende relatie of niet-gekwalificeerde beroepspersoon probeert gevoelige inzage of een voorbehouden handeling. | Directe route en hervatte projectie worden gebruikt. | Dossier blijft gesloten of de voorbehouden handeling geweigerd; kwalificatie wordt actueel gecontroleerd en bewijsnummer blijft in de kluis. | authorization-negative, privacy-storage-audit | test/persoonseis.test.js, test/care-intake-versleuteld.test.js |
| care-recover | Een zorgstatus is onzeker, de toestemming is ingetrokken of het netwerk valt weg. | De gebruiker hervat of probeert eerdere gegevens opnieuw te delen. | Geen automatische zorgactie of gevoelige cacheherstel; toegestane bronstatus en passende menselijke vervolgroute blijven zichtbaar. | recovery-trace, privacy-storage-audit | test/zorgketen.test.js |
| care-understand | Een deelnemer ziet een hulpinterface met grenzen en een onbeschikbare dienst. | De deelnemer beschrijft wat RTG wel doet, wat geen diagnose of ontvangstbevestiging is en waar veilige hulp bereikbaar is. | Geen kritieke misvatting over zorgverlening of noodhulp; rol- en toegankelijkheidsbelemmeringen blokkeren acceptatie. | human-observation, accessibility-observation | Menselijke producer ontbreekt; bestaande artifact-controle weigert onbevoegde review |
| learning-execute | Een leerling heeft een geldige les- of gezinsrelatie en een passende eigen oefening. | De leerling opent, oefent, ontvangt feedback en hervat het toegestane eigen leerdossier. | Eigen voortgang blijft persoonlijk, zonder vergelijking of blijvend niveau-label; handmatige lesmodus werkt zonder model. | browser-state-trace, domain-state-readback, privacy-storage-audit | scripts/lib/voltooi/school.js, test/rtfschool.test.js |
| learning-negative | Een andere leerling, onbevoegde ouder of onder-18-gebruiker probeert een dossier of competitieve prestatie te bewaren. | Lezen, ranglijst, niveau of toernooihandeling wordt rechtstreeks geprobeerd. | Dossiergrenzen worden afgedwongen; competitieve opslag vraagt de bestaande 18+/A3-poort, terwijl veilig persoonlijk leren niet onnodig wordt geblokkeerd. | authorization-negative, privacy-storage-audit | test/rtfschool.test.js |
| learning-recover | Een tijdelijke schoolpas verloopt of een oefenantwoord gaat verloren. | De leerling hervat de les met juiste relatie en controleert zijn eigen resultaat. | Geen stille resultaatverdubbeling, openbaar niveau of andere leerlingdata; ontbrekende rechten geven begrijpelijke herstart en de toegestane eigen voortgang blijft correct. | recovery-trace, domain-state-readback | scripts/lib/schoolproefsessies.js, test/proefsessies-school.test.js |
| learning-understand | Een leerling of begeleider voert een vooraf vastgelegde veilige leertaak uit. | De deelnemer vindt uitleg, maakt één oefening en legt uit wie het resultaat kan zien. | Taak is leeftijds- en toegankelijk passend; geen druk tot competitie, geen coaching om een mislukte taak als succes te tellen. | human-observation, accessibility-observation | Menselijke producer ontbreekt; bestaande artifact-controle weigert onbevoegde review |
| operations-execute | Een bevoegde medewerker, partner of beheerder heeft een toegewezen werkitem in de juiste organisatie. | Een bestaande toegestane statuswijziging wordt gecontroleerd en uitgevoerd. | Eén actuele bronuitkomst, begrijpelijke overdracht en auditspoor; partner-, personeel- en kantoorprojecties tonen dezelfde status binnen hun rechten. | browser-state-trace, domain-state-readback | test/partner-ds.e2e.js, test/kantoordeur.e2e.js |
| operations-negative | Een andere tenant, vervallen werkvergunning of onvoldoende persoonsbevoegdheid opent dezelfde taak. | De gebruiker probeert directe URL, API en oude werkruimtetab. | Geen cross-tenant inzage of mutatie; werk- en handelingsgrenzen blijven verschillend en worden op het juiste moment toegepast. | authorization-negative, privacy-storage-audit | test/persoonseis.test.js, test/kantoor-productiedeur.test.js |
| operations-recover | Twee collega's bewerken hetzelfde item terwijl een netwerkantwoord uitvalt. | De tweede bevestiging, refresh en overdracht worden uitgevoerd. | Geen stille overschrijving of dubbele opdracht; versieconflict, actor en verantwoordelijke vervolgstap blijven zichtbaar. | recovery-trace, domain-state-readback | test/office-save-atomic.test.js, test/reisprogramma.test.js |
| operations-understand | Een medewerker krijgt een echte taak met één noodzakelijke overdracht en een fouttoestand. | De medewerker voltooit, benoemt verantwoordelijkheid en hervat de taak zonder hulp. | Taken halen hun familiebudget; kritieke status of bevoegdheid wordt niet alleen met kleur uitgelegd, ook niet in een drukke beheercockpit. | human-observation, accessibility-observation | Menselijke producer ontbreekt; bestaande artifact-controle weigert onbevoegde review |
| governance-execute | Een bestaand besluitvoorstel heeft rechtmatige deelnemers, mandaten en vastgelegde quorumregels. | Bevoegde deelnemers besluiten en lezen de uitkomst bij de canonieke bron. | Besluitversie, stem-/goedkeuringsgrond, quorumnoemer en audit zijn consistent; het scherm verleent geen nieuwe bevoegdheid. | browser-state-trace, domain-state-readback | test/rtfosgovernance.e2e.js, scripts/lib/voltooi/decisionroom.js |
| governance-negative | Quorum ontbreekt, een belanghebbende stemt mee of een mandaat is verlopen. | Het besluit wordt bevestigd via UI en directe route. | De bestaande governance- of Authority-poort weigert; geen geld-, toegangs- of organisatie-effect ontstaat door alleen een UI-goedkeuring. | authorization-negative, domain-state-readback | test/rtfosgovernance.e2e.js, test/stuur-mandaat.test.js |
| governance-recover | Een besluitantwoord ontbreekt of de voorstelversie wijzigt tijdens beoordeling. | Een deelnemer heropent en probeert de eerdere bevestiging opnieuw te gebruiken. | De exacte contract/voorstelversie blijft gebonden; oude toestemming mag niet voor gewijzigde inhoud gelden en een dubbel verzoek geeft geen tweede besluit. | recovery-trace, domain-state-readback | scripts/lib/voltooi/decisionroom.js |
| governance-understand | Een onafhankelijke beoordelaar ziet een besluit met onthouding, ontbrekend quorum of belangenconflict. | De beoordelaar verklaart noemer, bevoegdheid, gevolgen en reden voor weigering. | Geen onduidelijkheid over besluitgeldigheid of gezag; tekst, toetsenbord en ondersteunende technologie dragen dezelfde betekenis. | human-observation, accessibility-observation | Menselijke producer ontbreekt; bestaande artifact-controle weigert onbevoegde review |
| public-execute | Een anonieme bezoeker opent de bestaande openbare of juridische app-ingang met fictieve demonstratiegegevens. | De bezoeker volgt uitleg naar de bestaande capability en de juiste toegangsdeur. | Beschikbaarheid en productbelofte volgen dezelfde gecontroleerde bron; er ontstaat geen account, boeking of betaling door demonstratie. | browser-state-trace, scope-and-impact | test/startpagina.test.js, test/juridisch-ds.e2e.js |
| public-negative | Een bron is niet gekwalificeerd, bevat privégegevens of heeft geen bevestigde providerrelatie. | De publieke projectie wordt opgebouwd en bezocht. | Geen onbewezen liveclaim, echt dossier of verzonnen partner; ontbrekende status blijft expliciet en de server weigert privé-inzage. | privacy-storage-audit, authorization-negative, scope-and-impact | test/juridisch-ds.e2e.js |
| public-recover | Een eerste bezoek, offline netwerk of oude publieke uitleg wordt gevolgd door herladen. | De bezoeker probeert de handmatige terugweg en opent actuele voorwaarden. | Geen verdwenen cookiebalkbediening, dode terugweg of schijnbaar actuele bron; versie en onbeschikbaarheid blijven begrijpelijk. | recovery-trace, browser-state-trace | test/startpagina.test.js, test/raakvlak.test.js |
| public-understand | Een nieuwe bezoeker ziet een demonstratie en een beperkt beschikbare capability. | De bezoeker beschrijft wat direct beschikbaar is, wat een voorbeeld is en welke stap toestemming vraagt. | Geen verwarring tussen demonstratie, aanvraag en werkelijke dienst; uitleg is bereikbaar zonder account en bruikbaar met ondersteunende technologie. | human-observation, accessibility-observation | Menselijke producer ontbreekt; bestaande artifact-controle weigert onbevoegde review |
| redirect-execute | Een bestaande alias heeft één canonieke bestemming en vastgelegde query-/fragmentregels. | De gebruiker opent de alias en gaat daarna terug. | Exact de bestaande bestemming, toegestane stand en vervangende geschiedenis; nul extra mutaties en geen redirectlus. | browser-state-trace, scope-and-impact | test/redirect-ds.e2e.js |
| redirect-negative | Een alias krijgt externe retour-URL, onverwachte parameters of een bestemming waarvoor de actor geen rechten heeft. | JavaScript- en meta/handmatige routes worden gebruikt. | Geen open redirect, bevoegdheidsverruiming of gevoelige overdracht; de canonieke bestemmingspoort beslist zelf. | authorization-negative, privacy-storage-audit, browser-state-trace | test/redirect-ds.e2e.js, test/voordeur-nonce-weerbaar.test.js |
| redirect-recover | Scriptuitvoering is geblokkeerd of de vaste bestemming is tijdelijk onbereikbaar. | De gebruiker opent de bestaande terugvalactie en herhaalt de navigatie. | Een benoemde, toegankelijke link gebruikt dezelfde vaste bestemming zonder oneindige lus of verloren toepasselijke context. | recovery-trace, accessibility-observation | test/redirect-ds.e2e.js |
| redirect-understand | De technische redirect toont kort een terugvaltekst of bereikt de bestemmingsscène. | De gebruiker of onafhankelijke review volgt de benoemde overdracht. | De alias claimt geen eigen productvoltooiing. Menselijke taakkwalificatie valt onder de afzonderlijke bestemming volgens EXP-REDIRECT-001; de zichtbare terugval heeft een begrijpelijke naam. | browser-state-trace, accessibility-observation, scope-and-impact | test/redirect-ds.e2e.js |

## Taak- en risicobudgetten

Normbron: experience-architecture/coverage-contract.json#qualificationPlanning. De complete meetprotocollen en uitsluitingen staan daar. Deze samenvatting creëert geen tweede normbron.

| Taakfamilie | Interactiebudget |
|---|---|
| orientation | {"meaningfulActionsMax":4,"unnecessaryContextSwitchesMax":0,"simultaneousPrimaryActionsMax":1,"extraActionsForRecoveryMax":3} |
| identity | {"meaningfulActionsMax":6,"unnecessaryContextSwitchesMax":0,"simultaneousPrimaryActionsMax":1,"extraActionsForRecoveryMax":3} |
| transaction | {"meaningfulActionsMax":7,"unnecessaryContextSwitchesMax":0,"simultaneousPrimaryActionsMax":1,"extraActionsForRecoveryMax":3} |
| travel | {"meaningfulActionsMax":8,"unnecessaryContextSwitchesMax":0,"simultaneousPrimaryActionsMax":1,"extraActionsForRecoveryMax":3} |
| content | {"meaningfulActionsMax":6,"unnecessaryContextSwitchesMax":0,"simultaneousPrimaryActionsMax":1,"extraActionsForRecoveryMax":3} |
| communication | {"meaningfulActionsMax":5,"unnecessaryContextSwitchesMax":0,"simultaneousPrimaryActionsMax":1,"extraActionsForRecoveryMax":3} |
| care | {"meaningfulActionsMax":7,"unnecessaryContextSwitchesMax":0,"simultaneousPrimaryActionsMax":1,"extraActionsForRecoveryMax":3} |
| learning | {"meaningfulActionsMax":6,"unnecessaryContextSwitchesMax":0,"simultaneousPrimaryActionsMax":1,"extraActionsForRecoveryMax":3} |
| operations | {"meaningfulActionsMax":8,"unnecessaryContextSwitchesMax":0,"simultaneousPrimaryActionsMax":1,"extraActionsForRecoveryMax":3} |
| governance | {"meaningfulActionsMax":8,"unnecessaryContextSwitchesMax":0,"simultaneousPrimaryActionsMax":1,"extraActionsForRecoveryMax":3} |
| public | {"meaningfulActionsMax":3,"unnecessaryContextSwitchesMax":0,"simultaneousPrimaryActionsMax":1,"extraActionsForRecoveryMax":3} |
| redirect | {"meaningfulActionsMax":1,"unnecessaryContextSwitchesMax":0,"simultaneousPrimaryActionsMax":1,"extraActionsForRecoveryMax":1} |

| Risico / apparaat | Performance | Onderbreking | Herstel | Toegankelijkheid | Begrijpelijkheid |
|---|---|---|---|---|---|
| standard:mobile-small | {"lcpP75MsMax":2500,"inpP75MsMax":200,"clsP75Max":0.1,"localFeedbackP95MsMax":200,"pendingStatusVisibleMsMax":1000,"stalledExplanationVisibleMsMax":5000,"providerCompletionDeadline":"Per bevoegde provider expliciet vastleggen; ontbrekend betekent BLOCKED, nooit automatisch geslaagd."} | {"duplicateExternalEffectsMax":0,"unconfirmedAutoReplayMax":0,"acknowledgedDataLossMax":0,"accountSwitchSensitiveResidueMax":0,"offlineSensitiveWritesAllowed":false,"unsavedDataPolicy":"Zichtbaar onderscheid tussen bevestigd bewaard, tijdelijk toegelaten concept en niet bewaard. Geen garantie buiten vooraf goedgekeurde gegevens- en bewaartermijn."} | {"resumeToSafeStateP95MsMax":2000,"mutationsBeforeReauthorizationMax":0,"sourceConflictSilentOverwritesMax":0,"unknownOutcomeRule":"Toon onzeker en lees bij de bron; geen nieuwe betaling, boeking of extern bericht op uitsluitend timeout. Kritieke bron blijft dicht tot reconciliatie.","localDraftExpirySource":"Bestaande domein-/consent-/veldpolicy; geen nieuwe generieke TTL."} | {"interactiveTargetPxMin":44,"criticalFindingsMax":0,"unexplainedExemptionsMax":0,"keyboardAllApplicableTasks":true,"focusVisibleAndRestored":true,"zoomPercentMin":200,"reflowWidthCssPx":320,"reducedMotionHonored":true,"screenReaderTaskRequired":true,"physicalChecks":["portrait-landscape","safe-area","one-hand-left","one-hand-right","touch","screen-reader"]} | {"unassistedTaskSuccessRatioMin":0.9,"teachBackCorrectRatioMin":0.9,"criticalFindingsMax":0,"criticalMisunderstandingsMax":0,"questions":["Wat gaat er gebeuren?","Voor wie en met welke gegevens of kosten?","Wat is bevestigd en wat blijft onzeker?","Hoe kunt u annuleren, hervatten of veilig hulp vragen?"],"assessment":"Per taak en cohort, geen platformgemiddelde; zie measurementProtocol.humanProtocol."} |
| standard:mobile-large | {"lcpP75MsMax":2500,"inpP75MsMax":200,"clsP75Max":0.1,"localFeedbackP95MsMax":200,"pendingStatusVisibleMsMax":1000,"stalledExplanationVisibleMsMax":5000,"providerCompletionDeadline":"Per bevoegde provider expliciet vastleggen; ontbrekend betekent BLOCKED, nooit automatisch geslaagd."} | {"duplicateExternalEffectsMax":0,"unconfirmedAutoReplayMax":0,"acknowledgedDataLossMax":0,"accountSwitchSensitiveResidueMax":0,"offlineSensitiveWritesAllowed":false,"unsavedDataPolicy":"Zichtbaar onderscheid tussen bevestigd bewaard, tijdelijk toegelaten concept en niet bewaard. Geen garantie buiten vooraf goedgekeurde gegevens- en bewaartermijn."} | {"resumeToSafeStateP95MsMax":2000,"mutationsBeforeReauthorizationMax":0,"sourceConflictSilentOverwritesMax":0,"unknownOutcomeRule":"Toon onzeker en lees bij de bron; geen nieuwe betaling, boeking of extern bericht op uitsluitend timeout. Kritieke bron blijft dicht tot reconciliatie.","localDraftExpirySource":"Bestaande domein-/consent-/veldpolicy; geen nieuwe generieke TTL."} | {"interactiveTargetPxMin":44,"criticalFindingsMax":0,"unexplainedExemptionsMax":0,"keyboardAllApplicableTasks":true,"focusVisibleAndRestored":true,"zoomPercentMin":200,"reflowWidthCssPx":320,"reducedMotionHonored":true,"screenReaderTaskRequired":true,"physicalChecks":["portrait-landscape","safe-area","one-hand-left","one-hand-right","touch","screen-reader"]} | {"unassistedTaskSuccessRatioMin":0.9,"teachBackCorrectRatioMin":0.9,"criticalFindingsMax":0,"criticalMisunderstandingsMax":0,"questions":["Wat gaat er gebeuren?","Voor wie en met welke gegevens of kosten?","Wat is bevestigd en wat blijft onzeker?","Hoe kunt u annuleren, hervatten of veilig hulp vragen?"],"assessment":"Per taak en cohort, geen platformgemiddelde; zie measurementProtocol.humanProtocol."} |
| standard:tablet | {"lcpP75MsMax":2500,"inpP75MsMax":200,"clsP75Max":0.1,"localFeedbackP95MsMax":150,"pendingStatusVisibleMsMax":1000,"stalledExplanationVisibleMsMax":5000,"providerCompletionDeadline":"Per bevoegde provider expliciet vastleggen; ontbrekend betekent BLOCKED, nooit automatisch geslaagd."} | {"duplicateExternalEffectsMax":0,"unconfirmedAutoReplayMax":0,"acknowledgedDataLossMax":0,"accountSwitchSensitiveResidueMax":0,"offlineSensitiveWritesAllowed":false,"unsavedDataPolicy":"Zichtbaar onderscheid tussen bevestigd bewaard, tijdelijk toegelaten concept en niet bewaard. Geen garantie buiten vooraf goedgekeurde gegevens- en bewaartermijn."} | {"resumeToSafeStateP95MsMax":1500,"mutationsBeforeReauthorizationMax":0,"sourceConflictSilentOverwritesMax":0,"unknownOutcomeRule":"Toon onzeker en lees bij de bron; geen nieuwe betaling, boeking of extern bericht op uitsluitend timeout. Kritieke bron blijft dicht tot reconciliatie.","localDraftExpirySource":"Bestaande domein-/consent-/veldpolicy; geen nieuwe generieke TTL."} | {"interactiveTargetPxMin":44,"criticalFindingsMax":0,"unexplainedExemptionsMax":0,"keyboardAllApplicableTasks":true,"focusVisibleAndRestored":true,"zoomPercentMin":200,"reflowWidthCssPx":320,"reducedMotionHonored":true,"screenReaderTaskRequired":true,"physicalChecks":["portrait-landscape","split-view","touch","keyboard","screen-reader"]} | {"unassistedTaskSuccessRatioMin":0.9,"teachBackCorrectRatioMin":0.9,"criticalFindingsMax":0,"criticalMisunderstandingsMax":0,"questions":["Wat gaat er gebeuren?","Voor wie en met welke gegevens of kosten?","Wat is bevestigd en wat blijft onzeker?","Hoe kunt u annuleren, hervatten of veilig hulp vragen?"],"assessment":"Per taak en cohort, geen platformgemiddelde; zie measurementProtocol.humanProtocol."} |
| standard:desktop | {"lcpP75MsMax":2500,"inpP75MsMax":200,"clsP75Max":0.1,"localFeedbackP95MsMax":100,"pendingStatusVisibleMsMax":1000,"stalledExplanationVisibleMsMax":5000,"providerCompletionDeadline":"Per bevoegde provider expliciet vastleggen; ontbrekend betekent BLOCKED, nooit automatisch geslaagd."} | {"duplicateExternalEffectsMax":0,"unconfirmedAutoReplayMax":0,"acknowledgedDataLossMax":0,"accountSwitchSensitiveResidueMax":0,"offlineSensitiveWritesAllowed":false,"unsavedDataPolicy":"Zichtbaar onderscheid tussen bevestigd bewaard, tijdelijk toegelaten concept en niet bewaard. Geen garantie buiten vooraf goedgekeurde gegevens- en bewaartermijn."} | {"resumeToSafeStateP95MsMax":1000,"mutationsBeforeReauthorizationMax":0,"sourceConflictSilentOverwritesMax":0,"unknownOutcomeRule":"Toon onzeker en lees bij de bron; geen nieuwe betaling, boeking of extern bericht op uitsluitend timeout. Kritieke bron blijft dicht tot reconciliatie.","localDraftExpirySource":"Bestaande domein-/consent-/veldpolicy; geen nieuwe generieke TTL."} | {"interactiveTargetPxMin":44,"criticalFindingsMax":0,"unexplainedExemptionsMax":0,"keyboardAllApplicableTasks":true,"focusVisibleAndRestored":true,"zoomPercentMin":200,"reflowWidthCssPx":320,"reducedMotionHonored":true,"screenReaderTaskRequired":true,"physicalChecks":["keyboard","screen-reader","zoom-200","window-resize"]} | {"unassistedTaskSuccessRatioMin":0.9,"teachBackCorrectRatioMin":0.9,"criticalFindingsMax":0,"criticalMisunderstandingsMax":0,"questions":["Wat gaat er gebeuren?","Voor wie en met welke gegevens of kosten?","Wat is bevestigd en wat blijft onzeker?","Hoe kunt u annuleren, hervatten of veilig hulp vragen?"],"assessment":"Per taak en cohort, geen platformgemiddelde; zie measurementProtocol.humanProtocol."} |
| sensitive:mobile-small | {"lcpP75MsMax":2500,"inpP75MsMax":200,"clsP75Max":0.1,"localFeedbackP95MsMax":150,"pendingStatusVisibleMsMax":1000,"stalledExplanationVisibleMsMax":5000,"providerCompletionDeadline":"Per bevoegde provider expliciet vastleggen; ontbrekend betekent BLOCKED, nooit automatisch geslaagd."} | {"duplicateExternalEffectsMax":0,"unconfirmedAutoReplayMax":0,"acknowledgedDataLossMax":0,"accountSwitchSensitiveResidueMax":0,"offlineSensitiveWritesAllowed":false,"unsavedDataPolicy":"Zichtbaar onderscheid tussen bevestigd bewaard, tijdelijk toegelaten concept en niet bewaard. Geen garantie buiten vooraf goedgekeurde gegevens- en bewaartermijn."} | {"resumeToSafeStateP95MsMax":2000,"mutationsBeforeReauthorizationMax":0,"sourceConflictSilentOverwritesMax":0,"unknownOutcomeRule":"Toon onzeker en lees bij de bron; geen nieuwe betaling, boeking of extern bericht op uitsluitend timeout. Kritieke bron blijft dicht tot reconciliatie.","localDraftExpirySource":"Bestaande domein-/consent-/veldpolicy; geen nieuwe generieke TTL."} | {"interactiveTargetPxMin":44,"criticalFindingsMax":0,"unexplainedExemptionsMax":0,"keyboardAllApplicableTasks":true,"focusVisibleAndRestored":true,"zoomPercentMin":200,"reflowWidthCssPx":320,"reducedMotionHonored":true,"screenReaderTaskRequired":true,"physicalChecks":["portrait-landscape","safe-area","one-hand-left","one-hand-right","touch","screen-reader"]} | {"unassistedTaskSuccessRatioMin":0.95,"teachBackCorrectRatioMin":0.95,"criticalFindingsMax":0,"criticalMisunderstandingsMax":0,"questions":["Wat gaat er gebeuren?","Voor wie en met welke gegevens of kosten?","Wat is bevestigd en wat blijft onzeker?","Hoe kunt u annuleren, hervatten of veilig hulp vragen?"],"assessment":"Per taak en cohort, geen platformgemiddelde; zie measurementProtocol.humanProtocol."} |
| sensitive:mobile-large | {"lcpP75MsMax":2500,"inpP75MsMax":200,"clsP75Max":0.1,"localFeedbackP95MsMax":150,"pendingStatusVisibleMsMax":1000,"stalledExplanationVisibleMsMax":5000,"providerCompletionDeadline":"Per bevoegde provider expliciet vastleggen; ontbrekend betekent BLOCKED, nooit automatisch geslaagd."} | {"duplicateExternalEffectsMax":0,"unconfirmedAutoReplayMax":0,"acknowledgedDataLossMax":0,"accountSwitchSensitiveResidueMax":0,"offlineSensitiveWritesAllowed":false,"unsavedDataPolicy":"Zichtbaar onderscheid tussen bevestigd bewaard, tijdelijk toegelaten concept en niet bewaard. Geen garantie buiten vooraf goedgekeurde gegevens- en bewaartermijn."} | {"resumeToSafeStateP95MsMax":2000,"mutationsBeforeReauthorizationMax":0,"sourceConflictSilentOverwritesMax":0,"unknownOutcomeRule":"Toon onzeker en lees bij de bron; geen nieuwe betaling, boeking of extern bericht op uitsluitend timeout. Kritieke bron blijft dicht tot reconciliatie.","localDraftExpirySource":"Bestaande domein-/consent-/veldpolicy; geen nieuwe generieke TTL."} | {"interactiveTargetPxMin":44,"criticalFindingsMax":0,"unexplainedExemptionsMax":0,"keyboardAllApplicableTasks":true,"focusVisibleAndRestored":true,"zoomPercentMin":200,"reflowWidthCssPx":320,"reducedMotionHonored":true,"screenReaderTaskRequired":true,"physicalChecks":["portrait-landscape","safe-area","one-hand-left","one-hand-right","touch","screen-reader"]} | {"unassistedTaskSuccessRatioMin":0.95,"teachBackCorrectRatioMin":0.95,"criticalFindingsMax":0,"criticalMisunderstandingsMax":0,"questions":["Wat gaat er gebeuren?","Voor wie en met welke gegevens of kosten?","Wat is bevestigd en wat blijft onzeker?","Hoe kunt u annuleren, hervatten of veilig hulp vragen?"],"assessment":"Per taak en cohort, geen platformgemiddelde; zie measurementProtocol.humanProtocol."} |
| sensitive:tablet | {"lcpP75MsMax":2500,"inpP75MsMax":200,"clsP75Max":0.1,"localFeedbackP95MsMax":150,"pendingStatusVisibleMsMax":1000,"stalledExplanationVisibleMsMax":5000,"providerCompletionDeadline":"Per bevoegde provider expliciet vastleggen; ontbrekend betekent BLOCKED, nooit automatisch geslaagd."} | {"duplicateExternalEffectsMax":0,"unconfirmedAutoReplayMax":0,"acknowledgedDataLossMax":0,"accountSwitchSensitiveResidueMax":0,"offlineSensitiveWritesAllowed":false,"unsavedDataPolicy":"Zichtbaar onderscheid tussen bevestigd bewaard, tijdelijk toegelaten concept en niet bewaard. Geen garantie buiten vooraf goedgekeurde gegevens- en bewaartermijn."} | {"resumeToSafeStateP95MsMax":1500,"mutationsBeforeReauthorizationMax":0,"sourceConflictSilentOverwritesMax":0,"unknownOutcomeRule":"Toon onzeker en lees bij de bron; geen nieuwe betaling, boeking of extern bericht op uitsluitend timeout. Kritieke bron blijft dicht tot reconciliatie.","localDraftExpirySource":"Bestaande domein-/consent-/veldpolicy; geen nieuwe generieke TTL."} | {"interactiveTargetPxMin":44,"criticalFindingsMax":0,"unexplainedExemptionsMax":0,"keyboardAllApplicableTasks":true,"focusVisibleAndRestored":true,"zoomPercentMin":200,"reflowWidthCssPx":320,"reducedMotionHonored":true,"screenReaderTaskRequired":true,"physicalChecks":["portrait-landscape","split-view","touch","keyboard","screen-reader"]} | {"unassistedTaskSuccessRatioMin":0.95,"teachBackCorrectRatioMin":0.95,"criticalFindingsMax":0,"criticalMisunderstandingsMax":0,"questions":["Wat gaat er gebeuren?","Voor wie en met welke gegevens of kosten?","Wat is bevestigd en wat blijft onzeker?","Hoe kunt u annuleren, hervatten of veilig hulp vragen?"],"assessment":"Per taak en cohort, geen platformgemiddelde; zie measurementProtocol.humanProtocol."} |
| sensitive:desktop | {"lcpP75MsMax":2500,"inpP75MsMax":200,"clsP75Max":0.1,"localFeedbackP95MsMax":100,"pendingStatusVisibleMsMax":1000,"stalledExplanationVisibleMsMax":5000,"providerCompletionDeadline":"Per bevoegde provider expliciet vastleggen; ontbrekend betekent BLOCKED, nooit automatisch geslaagd."} | {"duplicateExternalEffectsMax":0,"unconfirmedAutoReplayMax":0,"acknowledgedDataLossMax":0,"accountSwitchSensitiveResidueMax":0,"offlineSensitiveWritesAllowed":false,"unsavedDataPolicy":"Zichtbaar onderscheid tussen bevestigd bewaard, tijdelijk toegelaten concept en niet bewaard. Geen garantie buiten vooraf goedgekeurde gegevens- en bewaartermijn."} | {"resumeToSafeStateP95MsMax":1000,"mutationsBeforeReauthorizationMax":0,"sourceConflictSilentOverwritesMax":0,"unknownOutcomeRule":"Toon onzeker en lees bij de bron; geen nieuwe betaling, boeking of extern bericht op uitsluitend timeout. Kritieke bron blijft dicht tot reconciliatie.","localDraftExpirySource":"Bestaande domein-/consent-/veldpolicy; geen nieuwe generieke TTL."} | {"interactiveTargetPxMin":44,"criticalFindingsMax":0,"unexplainedExemptionsMax":0,"keyboardAllApplicableTasks":true,"focusVisibleAndRestored":true,"zoomPercentMin":200,"reflowWidthCssPx":320,"reducedMotionHonored":true,"screenReaderTaskRequired":true,"physicalChecks":["keyboard","screen-reader","zoom-200","window-resize"]} | {"unassistedTaskSuccessRatioMin":0.95,"teachBackCorrectRatioMin":0.95,"criticalFindingsMax":0,"criticalMisunderstandingsMax":0,"questions":["Wat gaat er gebeuren?","Voor wie en met welke gegevens of kosten?","Wat is bevestigd en wat blijft onzeker?","Hoe kunt u annuleren, hervatten of veilig hulp vragen?"],"assessment":"Per taak en cohort, geen platformgemiddelde; zie measurementProtocol.humanProtocol."} |
| critical:mobile-small | {"lcpP75MsMax":2500,"inpP75MsMax":200,"clsP75Max":0.1,"localFeedbackP95MsMax":100,"pendingStatusVisibleMsMax":1000,"stalledExplanationVisibleMsMax":5000,"providerCompletionDeadline":"Per bevoegde provider expliciet vastleggen; ontbrekend betekent BLOCKED, nooit automatisch geslaagd."} | {"duplicateExternalEffectsMax":0,"unconfirmedAutoReplayMax":0,"acknowledgedDataLossMax":0,"accountSwitchSensitiveResidueMax":0,"offlineSensitiveWritesAllowed":false,"unsavedDataPolicy":"Zichtbaar onderscheid tussen bevestigd bewaard, tijdelijk toegelaten concept en niet bewaard. Geen garantie buiten vooraf goedgekeurde gegevens- en bewaartermijn."} | {"resumeToSafeStateP95MsMax":2000,"mutationsBeforeReauthorizationMax":0,"sourceConflictSilentOverwritesMax":0,"unknownOutcomeRule":"Toon onzeker en lees bij de bron; geen nieuwe betaling, boeking of extern bericht op uitsluitend timeout. Kritieke bron blijft dicht tot reconciliatie.","localDraftExpirySource":"Bestaande domein-/consent-/veldpolicy; geen nieuwe generieke TTL."} | {"interactiveTargetPxMin":44,"criticalFindingsMax":0,"unexplainedExemptionsMax":0,"keyboardAllApplicableTasks":true,"focusVisibleAndRestored":true,"zoomPercentMin":200,"reflowWidthCssPx":320,"reducedMotionHonored":true,"screenReaderTaskRequired":true,"physicalChecks":["portrait-landscape","safe-area","one-hand-left","one-hand-right","touch","screen-reader"]} | {"unassistedTaskSuccessRatioMin":1,"teachBackCorrectRatioMin":1,"criticalFindingsMax":0,"criticalMisunderstandingsMax":0,"questions":["Wat gaat er gebeuren?","Voor wie en met welke gegevens of kosten?","Wat is bevestigd en wat blijft onzeker?","Hoe kunt u annuleren, hervatten of veilig hulp vragen?"],"assessment":"Per taak en cohort, geen platformgemiddelde; zie measurementProtocol.humanProtocol."} |
| critical:mobile-large | {"lcpP75MsMax":2500,"inpP75MsMax":200,"clsP75Max":0.1,"localFeedbackP95MsMax":100,"pendingStatusVisibleMsMax":1000,"stalledExplanationVisibleMsMax":5000,"providerCompletionDeadline":"Per bevoegde provider expliciet vastleggen; ontbrekend betekent BLOCKED, nooit automatisch geslaagd."} | {"duplicateExternalEffectsMax":0,"unconfirmedAutoReplayMax":0,"acknowledgedDataLossMax":0,"accountSwitchSensitiveResidueMax":0,"offlineSensitiveWritesAllowed":false,"unsavedDataPolicy":"Zichtbaar onderscheid tussen bevestigd bewaard, tijdelijk toegelaten concept en niet bewaard. Geen garantie buiten vooraf goedgekeurde gegevens- en bewaartermijn."} | {"resumeToSafeStateP95MsMax":2000,"mutationsBeforeReauthorizationMax":0,"sourceConflictSilentOverwritesMax":0,"unknownOutcomeRule":"Toon onzeker en lees bij de bron; geen nieuwe betaling, boeking of extern bericht op uitsluitend timeout. Kritieke bron blijft dicht tot reconciliatie.","localDraftExpirySource":"Bestaande domein-/consent-/veldpolicy; geen nieuwe generieke TTL."} | {"interactiveTargetPxMin":44,"criticalFindingsMax":0,"unexplainedExemptionsMax":0,"keyboardAllApplicableTasks":true,"focusVisibleAndRestored":true,"zoomPercentMin":200,"reflowWidthCssPx":320,"reducedMotionHonored":true,"screenReaderTaskRequired":true,"physicalChecks":["portrait-landscape","safe-area","one-hand-left","one-hand-right","touch","screen-reader"]} | {"unassistedTaskSuccessRatioMin":1,"teachBackCorrectRatioMin":1,"criticalFindingsMax":0,"criticalMisunderstandingsMax":0,"questions":["Wat gaat er gebeuren?","Voor wie en met welke gegevens of kosten?","Wat is bevestigd en wat blijft onzeker?","Hoe kunt u annuleren, hervatten of veilig hulp vragen?"],"assessment":"Per taak en cohort, geen platformgemiddelde; zie measurementProtocol.humanProtocol."} |
| critical:tablet | {"lcpP75MsMax":2500,"inpP75MsMax":200,"clsP75Max":0.1,"localFeedbackP95MsMax":100,"pendingStatusVisibleMsMax":1000,"stalledExplanationVisibleMsMax":5000,"providerCompletionDeadline":"Per bevoegde provider expliciet vastleggen; ontbrekend betekent BLOCKED, nooit automatisch geslaagd."} | {"duplicateExternalEffectsMax":0,"unconfirmedAutoReplayMax":0,"acknowledgedDataLossMax":0,"accountSwitchSensitiveResidueMax":0,"offlineSensitiveWritesAllowed":false,"unsavedDataPolicy":"Zichtbaar onderscheid tussen bevestigd bewaard, tijdelijk toegelaten concept en niet bewaard. Geen garantie buiten vooraf goedgekeurde gegevens- en bewaartermijn."} | {"resumeToSafeStateP95MsMax":1500,"mutationsBeforeReauthorizationMax":0,"sourceConflictSilentOverwritesMax":0,"unknownOutcomeRule":"Toon onzeker en lees bij de bron; geen nieuwe betaling, boeking of extern bericht op uitsluitend timeout. Kritieke bron blijft dicht tot reconciliatie.","localDraftExpirySource":"Bestaande domein-/consent-/veldpolicy; geen nieuwe generieke TTL."} | {"interactiveTargetPxMin":44,"criticalFindingsMax":0,"unexplainedExemptionsMax":0,"keyboardAllApplicableTasks":true,"focusVisibleAndRestored":true,"zoomPercentMin":200,"reflowWidthCssPx":320,"reducedMotionHonored":true,"screenReaderTaskRequired":true,"physicalChecks":["portrait-landscape","split-view","touch","keyboard","screen-reader"]} | {"unassistedTaskSuccessRatioMin":1,"teachBackCorrectRatioMin":1,"criticalFindingsMax":0,"criticalMisunderstandingsMax":0,"questions":["Wat gaat er gebeuren?","Voor wie en met welke gegevens of kosten?","Wat is bevestigd en wat blijft onzeker?","Hoe kunt u annuleren, hervatten of veilig hulp vragen?"],"assessment":"Per taak en cohort, geen platformgemiddelde; zie measurementProtocol.humanProtocol."} |
| critical:desktop | {"lcpP75MsMax":2500,"inpP75MsMax":200,"clsP75Max":0.1,"localFeedbackP95MsMax":100,"pendingStatusVisibleMsMax":1000,"stalledExplanationVisibleMsMax":5000,"providerCompletionDeadline":"Per bevoegde provider expliciet vastleggen; ontbrekend betekent BLOCKED, nooit automatisch geslaagd."} | {"duplicateExternalEffectsMax":0,"unconfirmedAutoReplayMax":0,"acknowledgedDataLossMax":0,"accountSwitchSensitiveResidueMax":0,"offlineSensitiveWritesAllowed":false,"unsavedDataPolicy":"Zichtbaar onderscheid tussen bevestigd bewaard, tijdelijk toegelaten concept en niet bewaard. Geen garantie buiten vooraf goedgekeurde gegevens- en bewaartermijn."} | {"resumeToSafeStateP95MsMax":1000,"mutationsBeforeReauthorizationMax":0,"sourceConflictSilentOverwritesMax":0,"unknownOutcomeRule":"Toon onzeker en lees bij de bron; geen nieuwe betaling, boeking of extern bericht op uitsluitend timeout. Kritieke bron blijft dicht tot reconciliatie.","localDraftExpirySource":"Bestaande domein-/consent-/veldpolicy; geen nieuwe generieke TTL."} | {"interactiveTargetPxMin":44,"criticalFindingsMax":0,"unexplainedExemptionsMax":0,"keyboardAllApplicableTasks":true,"focusVisibleAndRestored":true,"zoomPercentMin":200,"reflowWidthCssPx":320,"reducedMotionHonored":true,"screenReaderTaskRequired":true,"physicalChecks":["keyboard","screen-reader","zoom-200","window-resize"]} | {"unassistedTaskSuccessRatioMin":1,"teachBackCorrectRatioMin":1,"criticalFindingsMax":0,"criticalMisunderstandingsMax":0,"questions":["Wat gaat er gebeuren?","Voor wie en met welke gegevens of kosten?","Wat is bevestigd en wat blijft onzeker?","Hoe kunt u annuleren, hervatten of veilig hulp vragen?"],"assessment":"Per taak en cohort, geen platformgemiddelde; zie measurementProtocol.humanProtocol."} |

## Open besluiten en uitvoeringsblokkades

Structurele P0-dekking: READY_TO_BUILD. Dit is geen algemene sluiting van alle productbesluiten en geen toestemming voor integratie of productie.

| Bron | Getroffen scope | Open opdracht / besluit |
|---|---|---|
| SCHERMEIGENAAR.oordelen | `apps/gemeenteloket.html`, `apps/gemeentepda.html` | De meldinglogica staat twee keer inline. Trek hem uit tot een gedeelde component. |
| SCHERMEIGENAAR.oordelen | `apps/rit.html`, `apps/ov.html` | rit.html wordt een aankomststand van ov.html (vlucht als vertrekpunt), of opent ov.html met die context; de eigen aanvraag- en volgcode vervalt. |
| SCHERMEIGENAAR.oordelen | `apps/pulse.html`, `apps/salon.html` | Besluit nodig: is een open 9+-microblog een ander product dan De Salon (dan blijven ze, met een gedeelde feedcomponent), of is Pulse een stand van De Salon? |
| SCHERMEIGENAAR.oordelen | `apps/wereld.html`, `apps/sociaal.html` | Besluit nodig: een van beide wordt het ene sociale overzicht; de andere een stand ervan. |
| SCHERMEIGENAAR.oordelen | `apps/commerce.html`, `apps/mall.html` | Besluit nodig: Commerce is volgens COMMERCE.md een laag en geen etalage. Voor een lid hoort er een winkel te zijn; commerce.html wordt dan de verkoperskant of een stand van de Mall. |
| SCHERMEIGENAAR.oordelen | `apps/foundation/bieb.html`, `apps/foundation/geloofbieb.html`, `apps/foundation/schoolbieb.html`, `apps/foundation/beroepen.html` | Het patroon staat vier keer inline. Trek het uit tot een gedeelde bibliotheekcomponent. |
| SCHERMEIGENAAR.oordelen | `apps/foundation/gevoel.html`, `apps/foundation/kompas.html` | Nagaan of dit een component met een leeftijdsregister kan zijn; de inline-code staat nu twee keer. |
| SCHERMEIGENAAR.oordelen | `apps/rtmail.html`, `apps/leverancier-rtmail.html` | De zaakkant heeft een eigen inline-implementatie; laat die de rtmail-modules gebruiken. |
| coverage-contract / human-evidence-authority | P0-uitvoeringsgereedheid legt de bewijsroute vast; G1 referentie-ervaringen, G2 portfolio, G3 onafhankelijke kwalificatie en G4 productie blijven zonder gezaghebbend menselijk bewijs geblokkeerd | Sluit menselijke beoordelingen aan op een gezaghebbende bestaande reviewvoorziening; benoem echte onafhankelijke beoordelaars. De huidige artifact-ontvanger blokkeert human-quality. |
| coverage-contract / provider-deadline-and-cancellation | Uitvoering en vrijgave van iedere betrokken externe handeling | Leg per echte provider de harde deadline, statusreconciliatie, annuleringstermijn en compensatie vast. Een generiek UX-wachtbudget vervangt dit contract niet. |
| coverage-contract / sensitive-draft-retention | Offline of herstelbelofte die gevoelige velden lokaal bewaart | Gebruik bestaande toestemming, veldbeleid en TTL; voor nieuwe bewaarbelofte is een expliciet scope- en privacybesluit nodig. Tot die tijd geen nieuwe gevoelige lokale opslag. |
| coverage-contract / representative-human-cohorts | Menselijke kwalificatie op de releasekandidaat | Plan echte deelnemers, ondersteunde technologie, fysieke apparaten en veilige kind-/zorgscenario's; planningcijfers zijn geen deelnemersbewijs. |

## Vier technisch beoordeelde beslispoorten

| Poort | Scope | Voorgaande poort | Exit |
|---|---|---|---|
| G1 | reference-cohort | P0-bouwvoorwaarde | Alle twaalf taken op één kandidaat met toepasselijke acht appbewijzen, experiencebewijs, failure/recovery-ketens en onafhankelijk menselijk oordeel; externe effecten alleen binnen gekwalificeerde scope. |
| G2 | catalog | G1 | Alle actuele MAPPEN-werkpakketten én alle ontdekte schermen uit de bestaande Experience-inventaris voldoen, inclusief beheer-, partner- en specialistische schermen zonder directe appkoppeling; gedeelde patronen en elke specifieke uitzondering opnieuw gemeten. P0-toewijzingen mogen niet onbeslist blijven. |
| G3 | independent-qualification | G2 | Twee onafhankelijke groene runs op dezelfde kandidaat, afzonderlijke kwaliteitsdisciplines, operationele repetitie, herstel/rollback en externe rapporten via bestaande bewijsvoorzieningen. |
| G4 | production | G3 | G3 opnieuw beoordeeld plus bestaande productie-status, getekend eigenaar-go/no-go en geteste terugval voor dezelfde kandidaat. Geen automatische goedkeuring door dit programma. |

Lees een poort met `node scripts/rtg-next-programma.js --gate=G1` (of G2/G3/G4). Een ontbrekend, oud of onbevoegd bewijs geeft BLOCKED en exitcode 1. Alle voorgangers worden opnieuw beoordeeld. Geen opgeslagen groen veld of planningstatus kan dit vervangen.
