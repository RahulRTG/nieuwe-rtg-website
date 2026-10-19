# Project Room (link:projectroom)

Eigenaar: `werk.project` (SCHERMEIGENAAR.json, rol eigenaar, doelgroep kantoor).
Ingang: `/apps/project-room.html`, achter de werkrol "kantoor". Doel volgens het
register: "Projectvoortgang zien en uitvoeren (alleen wat nu kan), het
projectdossier raadplegen, en bij oplevering bewijs vastleggen dat het beloofde
resultaat is bereikt."

Opgesteld op 19 oktober 2026 op tak `appwerkt/workos`. Dit is een kaart en geen
bouwopdracht.

## a. Inventaris van het bewezen bestaande

**Wat er staat**

| Laag | Pad | Inhoud |
|---|---|---|
| Scherm | `public/apps/project-room.html` + `project-room.js`, `-uitvoering.js`, `-dossier.js`, `-oplevering.js` | drie panelen: Uitvoering, Dossier (tijdlijn en bronnen), Oplevering (bewijs en menselijke oplevering) |
| Routes | `server/routes/rtgone.js` | `/api/rtgone/state`, `/api/rtgone/project/taak`, `/project/bewijs`, `/project/oplever`; het project ontstaat via `/api/rtgone/project/van-mail` in RTG One |
| Kern | `server/kern/rtgone-projecten.js` | projectVanMail, projectTaakZet, projectBewijs, projectOplever |
| Opslag | `db.data.rtgOne.projecten` | object `prj-` |
| Contracten | `server/lib/mutatiecontracten-project-room.js` | bewijs en oplever: idempotent, persoonlijke projecteigenaar |
| Toetsen | `test/project-room.test.js` (3), `test/rtgone.test.js` | |
| Voltooiproef | `scripts/lib/voltooi/projectroom.js` | mail → project → drie taken → bewijs → oplevering; collega en lid komen er niet bij |

**Het projectobject `prj-`**: `huis`, `titel`, `eigenaar`, `eigenaarKey`,
`deadline`, `status`, `voortgang`, `intentieId`, `bron` (rtmail: mailId, van,
onderwerp), `taken[]` (id, tekst, af, besluitId), `bewijs[]`, `documenten`
(link naar de RTDocs-werkplek), `goedkeuringId`, `route`, `tijdlijn[]`,
`oplevering`.

Statussen: `intake`, `in-voorbereiding`, `besluit`, `oplevering`, `uitvoering`, `afgerond`.

**Regels in de code**

- Een project ontstaat alleen uit een eigen RTMAIL-bericht (codenaam), één per mail (409).
- Drie vaste starttaken; een goedgekeurd besluit voegt "Besluit uitvoeren" toe.
- Voortgang = 12 + afgeronde taken / alle taken × 60, maximaal 90; 100 bij oplevering.
- Alleen de projecteigenaar of de baas wijzigt taken, bewijs en oplevering.
- Opleveren vraagt: een goedgekeurd besluit (als er een is), alle taken af en
  minstens één bewijs; anders 409. Een tweede oplevering geeft 400.
- Bewijs: een identieke herhaling geeft het bestaande stuk terug (`herhaald`).

**Wat BEWEZEN is**

| Bewijs | Stand | Bron |
|---|---|---|
| bereikbaar, bedienbaar, waarheidsgetrouw | BEWEZEN | APPWERKT.json |
| menselijk | NIET_GETEST centraal; lokaal afgeleid 3/3 | APPWERKT.json; verse proef |
| voltooibaar | GEEN_FIXTURE centraal; lokaal 6/6 | VOLTOOIPROEF.json (04:47, f85c044e); verse proef 19-10, dc501544 |
| persistent | GEEN_FIXTURE; lokaal 3/3 | idem |
| herstelbaar | GEEN_FIXTURE; lokaal 4/4 | idem |
| bevoegd | NIET_GETEST | BEVOEGD.json |

Formulering: voltooiproef lokaal gesloten 4/4 (19-10, dc501544), centraal nog te stempelen.

**Wat het scherm belooft maar de code niet doet**

- "Op volgorde van afhankelijkheid" en "Werk dat nog niet kan beginnen blijft
  buiten beeld totdat de afhankelijkheid is opgelost"
  (`project-room-uitvoering.js` regel 27, `project-room.html` regel 37). Er is
  geen afhankelijkheidsveld; de volgorde is de volgorde van de lijst.

**Niet gebouwd**

- Taken toevoegen, wijzigen of verwijderen; een eigen deadline per taak; een
  toegewezen persoon per taak.
- Budget, uren, kosten.
- Archief, heropenen met reden, project afbreken.
- Meerdere deelnemers: alleen de eigenaar of de baas schrijft.

**De verhouding tot Werk OS.** `server/bedrijf/project.js` en `taak.js` (Werk OS,
eigenaar `werk.organisatie`) hebben wél: afhankelijkheden met cyclusweigering
(409), "klaar" geweigerd bij open `wachtOp` of open kinderen, kolommen, uren,
budget in centen met een niet-blokkerende "over budget"-melding en een verplichte
reden bij een budgetwijziging, werkvormen als label. Project Room is het
RTG-interne spoor op `rtgone-projecten.js`; de twee lezen elkaar niet.

## b. Marktvergelijking

Echte merken alleen ter vergelijking.

| Leider | Wat achter de betaalmuur zit | Hebben wij het | Bron (19-10-2026) |
|---|---|---|---|
| Smartsheet Business / Enterprise / Advanced Work Management | werklast, baselines; scenarioplanning, portfolio's; Control Center; Resource Management als add-on | nee voor werklast en portfolio; half voor scenario (`kern/fiscaal/scenario.js` bestaat, niet aangesloten) | https://www.smartsheet.com/pricing en https://www.smartsheet.com/advanced-work-management (via zoektool, live te controleren) |
| ClickUp Unlimited / Business / Enterprise | Gantt, doelen; dashboards, sprints; SSO, auditlogs | nee in Project Room; Werk OS kent sprints en afhankelijkheden | https://clickup.com/pricing (via zoektool, live te controleren) |
| Basecamp Pro / Unlimited | tijdregistratie; 1 TB, admin, AI-agents | nee | https://basecamp.com/pricing (via zoektool, live te controleren) |
| ServiceNow SPM Pro (offerte) | hybride roadmaps, doelen, scenarioplanning, portfoliofinanciën | nee | https://www.servicenow.com/products/strategic-portfolio-management.html (via zoektool, live te controleren) |

Wat de markt niet heeft: opleveren dat in code geweigerd wordt zonder bewijs en
zonder goedgekeurd besluit, en een project dat zijn bronmail en zijn besluit als
verwijzing draagt. Voor de bouwsector vergelijkt Exact Online Bouw (Professional
€ 359: kwaliteitsbeheer, capaciteits- en projectplanning,
https://www.exact.com/nl/producten/bouw/features-en-prijzen) en Bouwportaal (€ 45,
inclusief Wkb-dossier en opleverrapporten, https://bouwportaal.nl/prijzen), beide
(via zoektool, live te controleren).

## c. Analyse van het volledige domein

**Hoe projectwerk echt werkt**

- *Particulier.* Een lid heeft projecten zonder dat woord: een verbouwing, een
  verhuizing, een bruiloft, een reis met veel onderdelen. Hij wil weten wat er
  gebeurt, wat het kost, wie wat doet en wat hij moet goedkeuren. De gegevens
  zijn van hem (Wonen, Geld, Concierge); de uitvoerders zijn zaken.
- *Professioneel.* Een aannemer, architect of adviseur draait projecten voor
  klanten: offerte, opdracht, planning, meerwerk, oplevering met dossier.
  De aannemer heeft in RTG het genre bouw met offerte, capaciteit en werkbon
  (`server/routes/supplier/vakpro.js`, `server/routes/member/vakpro.js`,
  `server/kern/vakwerk/pro2.js`); een projectflow ontbreekt daar.
- *Organisatie.* Projecten met afhankelijkheden, budget, besluiten, portfolio.
  Voor de ondernemer is dat Werk OS; voor RTG zelf is het Project Room.

**Wettelijke en normatieve eisen**

| Eis | Bron | Betekenis |
|---|---|---|
| Consumentendossier bij oplevering van een bouwwerk (art. 7:757a BW): tekeningen, berekeningen, materialen, installaties, onderhoud | https://iplo.nl/regelgeving/regels-voor-activiteiten/technische-bouwactiviteit/kwaliteitsborging/privaatrecht-wet-kwaliteitsborging/consumentendossier-opleverdossier-wkb/ | Een verbouwingsproject eindigt met een dossier dat de bewoner bewaart. In RTG hoort dat in het woningdossier van het lid (Wonen), niet in Project Room. |
| Wkb gevolgklasse 1: kwaliteitsborger, bouwmelding minstens 4 weken vooraf, gereedmelding | https://iplo.nl/regelgeving/regels-voor-activiteiten/technische-bouwactiviteit/kwaliteitsborging/wet-kwaliteitsborging-bouwen-wkb/ | Een termijnklok in het project; de melding zelf is extern (voorbehouden). De Wkb voor verbouw is voorlopig niet doorgegaan (te controleren). |
| Betaaltermijn B2B maximaal 60 dagen, 30 als niets is afgesproken (art. 6:119a BW) | https://ondernemersplein.kvk.nl/betalingstermijn-incassokosten-en-wettelijke-rente/ | Termijnfacturen bij mijlpalen; de betaling is van Geld. |
| Fiscale bewaarplicht 7 jaar, onroerende zaken 10 jaar (art. 52 AWR) | https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/ondernemen/administratie/hoelang-moet-u-gegevens-bewaren | Projectstukken die een factuur onderbouwen, blijven 7 of 10 jaar. |
| ISO 9001 8.4 externe leveranciers, 10.2 afwijkingen en corrigerende maatregelen | https://www.lrqa.com/en/latest-news/iso-9001-publication-date-confirmed/ | Normatief: bewijs bij oplevering en een afwijking die tot een maatregel leidt. Versie 2026 te controleren. |
| AVG: bewaren niet langer dan nodig | https://autoriteitpersoonsgegevens.nl/nl/over-privacy/persoonsgegevens/bewaren-van-persoonsgegevens | De bronmail noemt een lid; het project draagt alleen codenaam en verwijzing. |

**Wat dat betekent voor software.** Een project moet afhankelijkheden afdwingen
(niet tonen), mijlpalen met bewijs kennen, budget naast werkelijke kosten tonen
zonder te blokkeren, meerdere partijen met elk een eigen deel laten werken en het
opleverdossier bij de eigenaar van het object laten landen.

## d. Functiecatalogus L1–L6

### L1 Persoonlijk

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Volgende stap van mijn project | bestaat, `project-room-uitvoering.js` | eerste open taak | eerste niet-afgeronde taak in de lijst | geen | eigenaar bij openen | eigenaar | geen | Ik zie de ene stap die nu kan | klein | bestaat |
| Mijn projecten over beide huizen | half (per huis) | `projecten` met mijn `eigenaarKey` | filter | geen | eigenaar | officeAuth | | Ik zie al mijn projecten zonder van huis te wisselen | klein | later |

### L2 Professioneel

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Afhankelijkheid tussen taken | ontbreekt, scherm belooft het | taak `wachtOp[]` | cyclus geweigerd (409); af geweigerd bij open `wachtOp` (regel uit `bedrijf/taak.js`) | geen | eigenaar bij afronden | eigenaar | de besluittaak wacht impliciet op het besluit | Een taak die wacht kan niet af en staat als "wacht op …"; een kring wordt geweigerd | middel | aanbevolen nu (of de schermzin schrappen, klein) |
| Taken toevoegen en wijzigen | ontbreekt | tekst, deadline, toegewezen | maximaal 50 taken; tekst 240 | geen | eigenaar; toegewezene | eigenaar of baas | besluittaak is niet te verwijderen | Ik kan een taak toevoegen, hernoemen en aan een collega toewijzen | klein | aanbevolen nu |
| Bewijs met herkomst | bestaat | titel, uitleg, bron, documentId, taakId | identieke herhaling = hetzelfde stuk | of het bewijs klopt: mens beoordeelt | eigenaar | eigenaar | na oplevering geweigerd | | | bestaat |
| Bewijs als verwijzing naar RTDocs-versie | half (`documentId` vrije tekst) | Office-document en versie | `rtg://`-verwijzing (patroon `bedrijf/herkomst.js`), nooit een kopie | het document kan later wijzigen | auditor | rechten van het document | strikt geclassificeerd blijft verwijzing zonder voorvertoning | Het bewijs opent precies de versie die er stond bij vastleggen | middel | later |
| Meerdere deelnemers | ontbreekt | `deelnemers[]` met persoonssleutel | deelnemer zet zijn eigen taken af; alleen de eigenaar levert op | geen | deelnemer bij toewijzing | eigenaar nodigt uit | | Een collega werkt aan zijn taak zonder het project te kunnen opleveren | middel | later |

### L3 Organisatorisch

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Budget met werkelijke kosten | ontbreekt | budget in centen; bedrag uit het besluit | over budget = melding, niet blokkeren; wijziging met verplichte reden (regel uit `bedrijf/project.js`) | werkelijke kosten komen uit Geld; zonder koppeling "niet gemeten" | eigenaar, finance | finance wijzigt budget | | Het project toont budget en uitgegeven bedrag met bron, of "niet gemeten" | middel | later |
| Portfolio per huis | half (lijst "andere projecten", 6) | `projecten` | aantallen per status; te laat = deadline < vandaag | geen | executive | `audit:lees` of baas | geen ranglijst per medewerker | De eigenaar ziet per status hoeveel projecten er zijn en welke over hun deadline zijn | klein | later |
| Archief en afbreken | ontbreekt | status | `afgebroken` met reden; archief na afgerond | geen | eigenaar, besluitnemers | eigenaar of baas | | Een project dat stopt, staat als afgebroken met reden en is niet weg | klein | aanbevolen nu |

### L4 Domeinintelligentie

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Voortgang uit taken, niet uit een invulveld | bestaat | taken | formule in a. | het gewicht van taken is gelijk | | | | | | bestaat |
| Haalbaarheid van de deadline | ontbreekt | open taken, deadline, eerdere doorlooptijden | doorlooptijd van afgeronde taken; klasse `advies`, met `onbekend` | weinig historie | eigenaar | | minder dan 5 afgeronde taken: "niet te rekenen" | Het scherm zegt "deadline waarschijnlijk niet haalbaar" alleen met de onderbouwing en de klasse | middel | later |
| Gevolg van uitval van een persoon | ontbreekt | taken per toegewezene | patroon `bedrijf/gevolg.js` (`nietGerekend` met naam) | | baas | | | Bij een overdracht ziet de baas welke projecttaken openblijven | middel | later |

### L5 Volledige levenscyclus

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Oplevering is definitief | half; taken kunnen na `afgerond` nog worden heropend en de status valt terug | status | na `afgerond` weigert `project/taak` (409) | geen | | | heropenen alleen als nieuw nazorgproject | Na oplevering verandert geen taak of status meer | klein | aanbevolen nu |
| Status valt niet terug na besluit | half; afronden van een taak zet `uitvoering` terug naar `in-voorbereiding` | status, besluit | na goedgekeurd besluit blijft de status minstens `uitvoering` | geen | | | | Afvinken na het besluit zet het project niet terug in voorbereiding | klein | aanbevolen nu |
| Doorgaan na "terug voor aanpassing" | ontbreekt | `goedkeuringId` | project volgt het nieuwe besluit (zie decisionroom.md) | | eigenaar | | | Een project waarvan het besluit terugging, kan een nieuw besluit krijgen en weer opleveren | klein | aanbevolen nu |
| Nazorg en evaluatie | half (`oplevering.leren`) | leerregel | evaluatiedatum optioneel | | eigenaar | | | Een opgeleverd project kan op een datum worden geëvalueerd | klein | later |

### L6 RTG-samenhang

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| RTMAIL → project | bestaat (in RTG One) | bronmail | verwijzing | | | | beperkte post nooit | | | bestaat |
| Besluit → uitvoering | bestaat | Decision Room | goedkeuring zet uitvoering | | | | | | | bestaat |
| RTDocs-werkplek per project | half (link met `&project=`) | Office | of Office de projectparameter filtert: niet vastgesteld | | | rechten van Office | | De link opent alleen documenten van dit project | klein | later |
| Project Room als scherm op `bedrijf/project.js` | ontbreekt | `w.projecten`, `w.taken` | motor en opslag blijven van Werk OS | | | `werkPoort` | | Een ondernemer ziet zijn Werk OS-project in Project Room met afhankelijkheden en budget | middel | vraagt besluit |
| Verbouwingsketen voor een lid | ontbreekt | zie e. | alleen verwijzingen en projecties | | | lid per stuk | | zie e. | groot | later; vraagt besluit |

### Modus LOS

Als RT Mail, Decision Room en Office uit staan, blijft de kerntaak: een
bestaand project uitvoeren, bewijs vastleggen en opleveren. Een nieuw project kan
dan niet ontstaan, want het enige begin is een RTMAIL. Het lege scherm zegt nu:
"Een project ontstaat uit een echte vraag in RTMail" met een knop naar RTMail;
eerlijk erbij hoort: "RTMail is niet bereikbaar; er kan nu geen project worden
gestart". Een project met een besluit dat niet te lezen is, toont "besluit niet
bereikbaar" in plaats van opleveren toe te staan; de server weigert dan al (de
goedkeuring staat in dezelfde opslag).

### Modus SAMEN: een intern project van mail tot oplevering

1. Een lid mailt de medewerker; in RTG One maakt hij er een project van met drie taken.
   - *Storing:* een tweede klik op dezelfde mail geeft 409 "bestaat al".
2. In Project Room rondt hij de drie taken af. Het project staat op `oplevering`.
   - *Storing:* een afgebroken "taak af" en opnieuw: de taak is af en staat er
     één keer (voltooiproef herstelbaar).
3. Hij probeert op te leveren zonder bewijs: 409 met de reden.
4. Hij legt bewijs vast met bron "RTDocs versie 2" en levert op met uitkomst en leerregel.
   - *Storing:* crash direct na het bewijs. Na de herstart staat het één keer en
     de herhaling hoort `herhaald`.
5. Een week later tikt hij in Uitvoering op "Heropen" bij een taak.
   - *Storing:* de server accepteert het; het afgeronde project staat weer op
     `in-voorbereiding` terwijl `oplevering` bewaard blijft. Zie productfouten.

### Modus SAMEN: de verbouwing (keten van de eigenaar)

Hoe het zou lopen, met per stap de eigenaar. Niets hiervan bestaat als keten.

1. Het lid opent zijn woning (Wonen, woningdossier) en kiest "verbouwing".
2. Hij vraagt offertes via het genre bouw (`/api/vak/offerte/vraag`); de aannemer
   antwoordt (`/api/supplier/vak/offerte/antwoord`).
   - *Storing:* geen aannemer in de buurt. De vraag blijft open; er staat geen
     projectruimte zonder opdracht.
3. Het lid gaat akkoord (`/api/vak/offerte/akkoord`). Pas nu ontstaat de
   projectruimte, met lid en aannemer als partijen.
4. De stuurlaag (`kern/stuur/`) zet elke handeling met gevolg (akkoord, meerwerk,
   termijnbetaling) eerst als voorstel klaar; het lid bevestigt.
   - *Storing:* het lid bevestigt niet binnen de termijn. Niets wordt uitgevoerd;
     het voorstel vervalt zichtbaar.
5. Geld toont per mijlpaal de verplichting en de betaling; de projectruimte toont
   alleen een verwijzing.
   - *Storing:* Geld is uit. De ruimte toont "financieel gevolg niet gemeten".
6. RTDocs bewaart tekeningen en meerwerkafspraken; de aannemer ziet alleen wat het
   lid deelt.
7. Oplevering: de werkbon (`/api/supplier/vak/werkbon`) sluit de klus; het
   opleverdossier landt in het woningdossier van het lid.
   - *Storing:* de aannemer stopt. Het lid houdt zijn dossier; de projectruimte
     zegt "aannemer niet meer actief" en de werkbon blijft open.

## e. RTG-exclusieve mogelijkheden

| Mogelijkheid | Eigenaar | Capability | Waarom geen markt-app dit kan |
|---|---|---|---|
| De verbouwing als één keten: woningdossier, aannemer, samenwerking, geld, documenten, toestemming | Wonen (dossier), genre bouw (uitvoering), Project Room (samenwerkingsruimte, bezit niets van de anderen), Geld (gevolgen), RTDocs (documenten), stuurlaag (toestemming en uitvoering) | `woning.dossier`, `werk.project`, `docs.office`, `kern/stuur/` | Een aannemerspakket kent de woning niet, een woonapp kent de aannemer niet, en geen van beide heeft één identiteit met toestemming per stuk. |
| Oplevering die in code bewijs en besluit vraagt | Project Room | `werk.project` | De markt toont een vinkje; hier weigert de server. |
| Project dat zijn bron (mail van een lid) en zijn besluit als verwijzing draagt | Project Room; RT Mail; Decision Room | `werk.project`, `comm.mail`, `werk.besluit` | Mail, besluit en project zijn in de markt drie producten. |

## f. Bouwstenen en ontbrekende koppelingen

**Bestaande modules**

- `server/kern/rtgone-projecten.js` (de kern zelf).
- `server/bedrijf/taak.js` en `project.js`: regels voor afhankelijkheid, cyclus,
  budget (overnemen als regel, niet als tweede motor).
- `server/bedrijf/herkomst.js`: `rtg://`-verwijzingen.
- `server/bedrijf/gevolg.js`: wat blijft open als iemand wegvalt.
- `server/routes/supplier/vakpro.js`, `server/routes/member/vakpro.js`,
  `server/kern/vakwerk/pro2.js`: offerte en werkbon van het genre bouw.
- `server/routes/home.js`, `server/kern/woningonderhoud.js`, `server/routes/bestanden.js`: wonen en dossier.
- `server/kern/stuur/` (plan, goedkeuring, bevestiging).

**Ontbrekende koppelingen**

| Van | Naar | Vorm | Toestemming |
|---|---|---|---|
| goedgekeurd besluit `terug` | project | project volgt `vorigeId` | aanvrager |
| bewijs | RTDocs-versie | verwijzing | rechten van het document |
| offerte-akkoord (bouw) | projectruimte | gebeurtenis | lid en zaak |
| werkbon (bouw) | woningdossier | document naar het dossier van het lid | lid |
| mijlpaal | Geld | verwijzing naar verplichting | lid |
| project (Werk OS) | Project Room-scherm | scherm op bestaande routes | `werkPoort` |

## g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Oplevering definitief (taak-zet na `afgerond` weigeren) | klein | laag | geen | aanbevolen nu |
| Status valt niet terug na goedgekeurd besluit | klein | laag | geen | aanbevolen nu |
| Afhankelijkheid tussen taken, of de schermzin schrappen | middel (bouwen) / klein (schrappen) | middel | regel uit `bedrijf/taak.js` | aanbevolen nu |
| Taken toevoegen, wijzigen, toewijzen | klein | laag | geen | aanbevolen nu |
| Doorgaan na "terug voor aanpassing" | klein | laag | Decision Room `vorigeId` | aanbevolen nu |
| Archief en afbreken met reden | klein | laag | geen | aanbevolen nu |
| BEVOEGD-telling voor de projectroutes | klein | laag | `scripts/bevoegdronde.js` | aanbevolen nu |
| Meerdere deelnemers | middel | middel | | later |
| Budget met werkelijke kosten uit Geld | middel | middel | Geld | later |
| Bewijs als RTDocs-versie | middel | middel | Office | later |
| Haalbaarheid deadline (L4) | middel | middel | historie | later |
| Scherm op `bedrijf/project.js` | middel | middel | besluit 1 | vraagt besluit |
| Verbouwingsketen | groot | hoog | Wonen, genre bouw, Geld | later; vraagt besluit |
| Eigen Gantt- of portfoliomotor | groot | hoog | | niet doen: tweede motor naast Werk OS |

## h. Toetsbaar eindcontract Beyond Premium

Dit contract vervangt de acht bewijzen van APPWERKT nooit.

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| 1. Breedte | Taak toevoegen, toewijzen, wachten op, afbreken en archiveren hebben elk een knop en een route | `scripts/schermen.js` | ontbreekt |
| 2. Professionele diepte | Een taak die wacht kan niet af; een kring wordt geweigerd; budgetwijziging zonder reden wordt geweigerd | `node --test` per regel | ontbreekt in Project Room |
| 3. Levenscyclus | Na oplevering verandert niets meer; afbreken laat een spoor | voltooiproef `projectroom`, met heropen-na-oplevering als weigerstap | zakt: heropenen na oplevering lukt nu |
| 4. Samenwerking en rollen | Een collega en een lid wijzigen niets; een deelnemer zet alleen zijn eigen taak af | voltooiproef stap 5; BEVOEGD | voltooiproef lokaal ja; BEVOEGD NIET_GETEST |
| 5. Domeinintelligentie | Een haalbaarheidsuitspraak draagt klasse `advies` en `onbekend` | test op zekerheid | ontbreekt |
| 6. Los functioneren | Met RT Mail, Decision Room en Office uit kan een bestaand project worden uitgevoerd en zegt het scherm wat niet kan | proef met koppelingen uit | half |
| 7. RTG-ketens | Mail → project → besluit → uitvoering → oplevering, en de verbouwingsketen met storingen | ketenproef naar `scripts/ritproef.js` | de eerste half (zakt op "terug"), de tweede ontbreekt |
| 8. Bewezen betrouwbaarheid | Alle acht bewijzen centraal BEWEZEN | APPWERKT.json | 3 van 8; 4 lokaal gesloten |

## Twee uitkomsten

### (A) Binnen de huidige architectuur en scope

| Functie | Kosten | Bouwt op |
|---|---|---|
| Oplevering definitief en geen statusterugval | klein | `kern/rtgone-projecten.js` |
| Afhankelijkheid tussen taken (of schermzin schrappen) | middel / klein | regel uit `bedrijf/taak.js` |
| Taken toevoegen, wijzigen, toewijzen | klein | `kern/rtgone-projecten.js` |
| Doorgaan na "terug voor aanpassing" | klein | `kern/rtgone-bestuur.js` |
| Archief en afbreken | klein | `db.data.rtgOne.projecten` |
| Later: deelnemers, budget uit Geld, bewijs als RTDocs-versie, haalbaarheid | middel elk | `bedrijf/herkomst.js`, `kern/fiscaal/zekerheid.js` |

### (B) Het uiteindelijke domeinmaximum, ook buiten de huidige scope

Richting en geen toezegging; wat een nieuw domein of externe koppeling vraagt,
staat als besluit.

**Proces 1. De verbouwing van een woning, van wens tot opleverdossier.**
- Stappen: wens en budget → (architect: ontwerp) → offertes → opdracht →
  zo nodig vergunning (extern) en bij nieuwbouw Wkb-bouwmelding 4 weken vooraf
  (extern) → planning en uitvoering → meerwerk met akkoord → termijnbetalingen →
  oplevering met werkbon → consumentendossier (art. 7:757a BW) in het
  woningdossier → onderhoud.
- Rollen en organisaties: lid (opdrachtgever), aannemer, onderaannemers,
  architect, kwaliteitsborger (extern), gemeente (extern), eventueel VvE.
- Apps en eigenaar: Wonen (woningdossier, eigenaar van alle objecten van de
  bewoner), genre bouw (uitvoering), Project Room (samenwerking, bezit niets),
  Geld (verplichtingen en betalingen), RTDocs (stukken), stuurlaag (toestemming).
- Buiten scope: een ontwerp- en projectflow voor de aannemer en de architect
  (feiten-wonen: "geen ontwerp- of projectflow"), een materiaalstaat, en het
  architectgenre (titel beschermd, Architectenregister) zijn nieuw domein of
  een besluit. Vergunningen en meldingen blijven extern (voorbehouden).

**Proces 2. Het project van een dienstverlenende onderneming, van offerte tot factuur.**
- Stappen: aanvraag → offerte → opdracht met algemene voorwaarden → planning met
  capaciteit → uitvoering met uren → meerwerk → oplevering met acceptatie →
  factuur (betaaltermijn art. 6:119a BW) → nazorg.
- Rollen: klant, projectleider, uitvoerenden, finance.
- Apps: Werk OS (project, taak, uren, contract; eigenaar), Onderneming
  (debiteuren), Geld (factuur), Project Room (scherm, als besluit 1 A wordt).
- Buiten scope: acceptatie door de klant als handeling met bewijs bestaat niet in
  Werk OS (feiten-dwars punt 3); de koppeling contract-project-persoon (punt 4).

**Proces 3. De implementatie van RTG bij een nieuwe zaak.**
- Stappen: partneraanvraag → beoordeling op het kantoor → contract → inrichting
  per genre → training → eerste klant → evaluatie.
- Apps: Partner worden (aanvraag), RTG One (project uit de mail), Decision Room
  (toelating), Project Room (inrichting), Partner Network (wat de zaak daarna ziet).
- Buiten scope: een implementatiesjabloon per genre (werkvormen in
  `bedrijf/project.js` zijn labels) is een besluit.

## Vraagt besluit

1. **Bedient Project Room ook de ondernemer?** Geen tweede projectmotor.
   - (A, aanbevolen) Ja, als scherm op `bedrijf/project.js` en `taak.js`, met
     afhankelijkheden en budget uit Werk OS; het RTG-interne spoor blijft op
     `rtgone-projecten.js`. Kosten: middel.
   - (B) Nee, blijft intern; de schermzin over afhankelijkheden gaat eruit.
     Kosten: klein.
   - (C) Eén projectmotor voor beide. Kosten: groot; raakt twee eigenaren.
2. **De verbouwingsketen.**
   - (A, aanbevolen) Als richting vastleggen met Wonen als eigenaar van het
     dossier en Project Room als samenwerkingsruimte zonder eigen gegevens; bouwen
     pas na V1. Kosten: groot, later.
   - (B) Het genre bouw krijgt zelf een projectflow; Project Room blijft intern.
     Kosten: middel; een derde projectspoor.
   - (C) Niet doen. Kosten: geen.
3. **Afhankelijkheden in het interne spoor.**
   - (A, aanbevolen) Bouwen met de regel van `bedrijf/taak.js` (cyclus 409, wacht
     blokkeert af). Kosten: middel.
   - (B) De schermzin schrappen. Kosten: klein; geen nieuwe belofte.
