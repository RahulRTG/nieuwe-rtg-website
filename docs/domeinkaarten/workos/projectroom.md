# Project Room (link:projectroom)

**Volledige werkzaamheid:** een medewerker op naam voert een project dat uit een RTMAIL-vraag ontstond uit, met taken die hij kan toevoegen en toewijzen, in de volgorde die hun afhankelijkheden toestaan, onder een gekoppeld besluit dat blijft gelden, tot een menselijke oplevering met bewijs; Project Room doet volledig waarvoor het er is als elk project eindigt in "opgeleverd" of "afgebroken met reden" en nooit blijft hangen, als een opgeleverd project niet meer verandert, en als een collega of lid er niets aan wijzigt.

Eigenaar: `werk.project` (SCHERMEIGENAAR.json, rol eigenaar, doelgroep kantoor).
Ingang: `/apps/project-room.html`, achter de werkrol "kantoor". Doel volgens het
register: "Projectvoortgang zien en uitvoeren (alleen wat nu kan), het
projectdossier raadplegen, en bij oplevering bewijs vastleggen dat het beloofde
resultaat is bereikt."

Opgesteld op 19 oktober 2026 op tak `appwerkt/workos`; herzien dezelfde avond na
het oordeel "deels" en de reparatie 1fc43c1. Dit is een kaart en geen
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
| Toetsen | `test/project-room.test.js`, `test/rtgone.test.js` (toets 8: oplevering definitief, besluit blijft gelden) | |
| Voltooiproef | `scripts/lib/voltooi/projectroom.js` | mail → project → drie taken → bewijs → oplevering; collega en lid komen er niet bij |

**Het projectobject `prj-`**: `huis`, `titel`, `eigenaar`, `eigenaarKey`,
`deadline`, `status`, `voortgang`, `intentieId`, `bron` (rtmail: mailId, van,
onderwerp), `taken[]` (id, tekst, af, besluitId), `bewijs[]` (met optioneel
`taakId` en `documentId`), `documenten` (link naar de RTDocs-werkplek),
`goedkeuringId`, `route`, `tijdlijn[]`, `oplevering`.

Statussen: `intake`, `in-voorbereiding`, `besluit`, `oplevering`, `uitvoering`, `afgerond`.

**Regels in de code (na 1fc43c1)**

- Een project ontstaat alleen uit een eigen RTMAIL-bericht (codenaam), één per mail (409).
- Drie vaste starttaken; een goedgekeurd besluit voegt "Besluit uitvoeren" toe.
- Voortgang = 12 + afgeronde taken / alle taken × 60, maximaal 90; 100 bij oplevering.
- Alleen de projecteigenaar of de baas wijzigt taken, bewijs en oplevering.
- Status bij een taakwijziging: alle taken af → `oplevering` (of `besluit` als
  het besluit nog niet goedgekeurd is); niet alle af → `uitvoering` als het
  besluit goedgekeurd is, anders `in-voorbereiding`.
- Een afgerond project weigert taakwijzigingen (400) en nieuw bewijs (400).
- Opleveren vraagt: een goedgekeurd besluit (als er een is), alle taken af en
  minstens één bewijs; anders 409. Een tweede oplevering geeft 400.
- Bewijs: een identieke herhaling geeft het bestaande stuk terug (`herhaald`).

**Wat BEWEZEN is**

| Bewijs | Stand | Bron |
|---|---|---|
| bereikbaar, bedienbaar, waarheidsgetrouw | BEWEZEN | APPWERKT.json |
| menselijk | NIET_GETEST centraal; lokaal afgeleid 3/3 | APPWERKT.json; verse proef |
| voltooibaar | GEEN_FIXTURE centraal; lokaal 6/6 | VOLTOOIPROEF.json (04:47, f85c044e); verse proef 19-10, dc501544; volgens de commit sluit de proef ook na 1fc43c1 |
| persistent | GEEN_FIXTURE; lokaal 3/3 | idem |
| herstelbaar | GEEN_FIXTURE; lokaal 4/4 | idem |
| bevoegd | NIET_GETEST | BEVOEGD.json |

Formulering: voltooiproef lokaal gesloten 4/4 (19-10, dc501544), centraal nog te stempelen.

**Wat het scherm belooft maar de code niet doet**

- "Op volgorde van afhankelijkheid" en "Werk dat nog niet kan beginnen blijft
  buiten beeld totdat de afhankelijkheid is opgelost"
  (`project-room-uitvoering.js` r. 27, `project-room.html` r. 37). Er is
  geen afhankelijkheidsveld; de volgorde is de volgorde van de lijst.

**Doodlopende standen (gelezen in de code, niet beproefd)**

- Besluit `aanpassen` ("terug"): het project blijft op `besluit`; opleveren geeft
  voor altijd 409 (bevinding van Decision Room).
- Besluit `afgewezen`: hetzelfde. Er is geen route om het project af te breken,
  dus het blijft als lopend project in de lijst staan. Nieuw gevonden.

**Niet gebouwd**

- Taken toevoegen, wijzigen of verwijderen; een eigen deadline per taak; een
  toegewezen persoon per taak.
- Budget, uren, kosten.
- Archief, project afbreken.
- Meerdere deelnemers: alleen de eigenaar of de baas schrijft.

**De verhouding tot Werk OS.** `server/bedrijf/project.js` en `taak.js` (Werk OS,
eigenaar `werk.organisatie`) hebben wél: afhankelijkheden met cyclusweigering
(409, `wachtOp`), "klaar" geweigerd bij open `wachtOp` of open kinderen,
kolommen, uren, budget in centen met een niet-blokkerende "over budget"-melding
en een verplichte reden bij een budgetwijziging, werkvormen als label. Project
Room is het RTG-interne spoor op `rtgone-projecten.js`; de twee lezen elkaar niet.

## b. Marktvergelijking

Echte merken alleen ter vergelijking. Elke regel komt uit een zoeksamenvatting
en is **(te controleren)**.

| Leider | Wat achter de betaalmuur zit | Hebben wij het | Bron (19-10-2026) |
|---|---|---|---|
| Smartsheet Business / Enterprise / Advanced Work Management | werklast, baselines; scenarioplanning, portfolio's; Control Center; Resource Management als add-on | nee voor werklast en portfolio; half voor scenario (`kern/fiscaal/scenario.js` bestaat, niet aangesloten) | **(te controleren)** https://www.smartsheet.com/pricing en https://www.smartsheet.com/advanced-work-management (via zoektool, live te controleren) |
| ClickUp Unlimited / Business / Enterprise | Gantt, doelen; dashboards, sprints; SSO, auditlogs | nee in Project Room; Werk OS kent sprints en afhankelijkheden | **(te controleren)** https://clickup.com/pricing (via zoektool, live te controleren) |
| Basecamp Pro / Unlimited | tijdregistratie; 1 TB, admin, AI-agents | nee | **(te controleren)** https://basecamp.com/pricing (via zoektool, live te controleren) |
| ServiceNow SPM Pro (offerte) | hybride roadmaps, doelen, scenarioplanning, portfoliofinanciën | nee | **(te controleren)** https://www.servicenow.com/products/strategic-portfolio-management.html (via zoektool, live te controleren) |

Wat de markt niet heeft: opleveren dat in code geweigerd wordt zonder bewijs en
zonder goedgekeurd besluit, en een project dat zijn bronmail en zijn besluit als
verwijzing draagt. Voor de bouwsector vergelijkt Exact Online Bouw (Professional
€ 359: kwaliteitsbeheer, capaciteits- en projectplanning,
https://www.exact.com/nl/producten/bouw/features-en-prijzen) en Bouwportaal (€ 45,
inclusief Wkb-dossier en opleverrapporten, https://bouwportaal.nl/prijzen), beide
**(te controleren)** (via zoektool, live te controleren).

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

**Wettelijke en normatieve eisen.** Geen primaire tekst is voor deze kaart zelf
gelezen; elke regel is **(te controleren)** en wordt hooguit een signaal.

| Eis | Bron | Betekenis |
|---|---|---|
| Consumentendossier bij oplevering van een bouwwerk (art. 7:757a BW) **(te controleren)** | https://iplo.nl/regelgeving/regels-voor-activiteiten/technische-bouwactiviteit/kwaliteitsborging/privaatrecht-wet-kwaliteitsborging/consumentendossier-opleverdossier-wkb/ | Een verbouwingsproject eindigt met een dossier dat de bewoner bewaart. In RTG hoort dat in het woningdossier van het lid (Wonen), niet in Project Room. |
| Wkb gevolgklasse 1: kwaliteitsborger, bouwmelding vooraf, gereedmelding **(te controleren)** | https://iplo.nl/regelgeving/regels-voor-activiteiten/technische-bouwactiviteit/kwaliteitsborging/wet-kwaliteitsborging-bouwen-wkb/ | Hooguit een termijnsignaal in het project; de melding zelf is extern (voorbehouden). Of de Wkb voor verbouw geldt, is onzeker. |
| Betaaltermijn B2B (art. 6:119a BW) **(te controleren)** | https://ondernemersplein.kvk.nl/betalingstermijn-incassokosten-en-wettelijke-rente/ | Termijnfacturen bij mijlpalen; de betaling is van Geld. |
| Fiscale bewaarplicht (art. 52 AWR) **(te controleren)** | https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/ondernemen/administratie/hoelang-moet-u-gegevens-bewaren | Projectstukken die een factuur onderbouwen, blijven bewaard; tot nalezing wordt niets gewist. |
| ISO 9001 8.4 externe leveranciers, 10.2 afwijkingen **(te controleren)** | https://www.lrqa.com/en/latest-news/iso-9001-publication-date-confirmed/ | Normatief: bewijs bij oplevering en een afwijking die tot een maatregel leidt. Versie 2026 en de nummers niet geverifieerd. |
| AVG: bewaren niet langer dan nodig **(te controleren)** | https://autoriteitpersoonsgegevens.nl/nl/over-privacy/persoonsgegevens/bewaren-van-persoonsgegevens | De bronmail noemt een lid; het project draagt alleen codenaam en verwijzing. |

**Wat dat betekent voor software.** Een project moet afhankelijkheden afdwingen
(niet alleen tonen), bewijs per taak kennen, budget naast werkelijke kosten tonen
zonder te blokkeren, meerdere partijen met elk een eigen deel laten werken, een
uitweg hebben als het besluit niet komt, en het opleverdossier bij de eigenaar
van het object laten landen.

## d. Functiecatalogus L1–L6

In de kolom Bak staat "nu · herstel" voor een fout of een belofte die de code
niet waarmaakt, en "nu · verdieping" voor nieuwe diepte binnen de huidige scope.

### L1 Persoonlijk

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Volgende stap van mijn project | bestaat, `project-room-uitvoering.js` | eerste open taak | eerste niet-afgeronde taak in de lijst; na V1: eerste taak zonder open `wachtOp` | geen | eigenaar bij openen | eigenaar | geen | Ik zie de ene stap die nu kan | klein | bestaat |
| Mijn projecten over beide huizen | half (per huis) | `projecten` met mijn `eigenaarKey` | filter over `rtg`, `rtf`, `gedeeld` | geen | eigenaar | officeAuth | | Ik zie al mijn projecten zonder van huis te wisselen | klein | later |
| Mijn taken in andere projecten | ontbreekt | taken met `toegewezen` = mijn sleutel (na V2) | lijst per deadline | geen | toegewezene | officeAuth | | Een collega die ik een taak gaf, ziet die in zijn eigen lijst | klein | nu · verdieping |

### L2 Professioneel

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Schermzin over afhankelijkheden waarmaken | ontbreekt, scherm belooft het | `project-room-uitvoering.js` r. 27, `project-room.html` r. 37 | schrappen tot V1 er is (besluit 3) | geen | | | | Het scherm belooft geen volgorde die de server niet afdwingt | klein | nu · herstel |
| Afhankelijkheid tussen taken | ontbreekt | taak `wachtOp[]` | cyclus geweigerd (409); af geweigerd bij open `wachtOp` (regel uit `bedrijf/taak.js`, overgenomen als regel); de besluittaak wacht op `goedkeuringId` | geen | eigenaar bij afronden | eigenaar | starttaken hebben geen `wachtOp` | Een taak die wacht kan niet af en staat als "wacht op …"; een kring wordt geweigerd | middel | nu · verdieping |
| Taken toevoegen, wijzigen, toewijzen | ontbreekt | tekst, deadline, `toegewezen` (persoonssleutel) | maximaal 50 taken; tekst 240; herhaalsleutel | geen | eigenaar; toegewezene bij toewijzing | eigenaar of baas; een toegewezene zet alleen zijn eigen taak af | besluittaak is niet te verwijderen; na `afgerond` niets | Ik kan een taak toevoegen, hernoemen en aan een collega geven, en hij kan alleen die taak afvinken | klein | nu · verdieping |
| Bewijs per taak bij oplevering | half; `bewijs[].taakId` bestaat, maar oplevering vraagt alleen "minstens één" | taken met `bewijsplicht: true`, `bewijs[].taakId` | opleveren weigert (409) zolang een taak met bewijsplicht geen bewijs met haar `taakId` heeft; de reden noemt de taak | of het bewijs klopt: een mens beoordeelt | eigenaar bij opleveren | eigenaar zet de plicht; niet na start van de oplevering | taken zonder plicht: zoals nu | Een project levert niet op zolang "Contract getekend" geen eigen bewijs heeft, en het scherm zegt welke taak het mist | klein | nu · verdieping |
| Bewijs als verwijzing naar RTDocs-versie | half (`documentId` vrije tekst) | Office-document en versie | `rtg://`-verwijzing (patroon `bedrijf/herkomst.js`), nooit een kopie | het document kan later wijzigen | auditor | rechten van het document | strikt geclassificeerd blijft verwijzing zonder voorvertoning | Het bewijs opent precies de versie die er stond bij vastleggen | middel | later |
| Meerdere deelnemers | ontbreekt | `deelnemers[]` met persoonssleutel | deelnemer zet zijn eigen taken af; alleen de eigenaar levert op | geen | deelnemer bij toewijzing | eigenaar nodigt uit | | Een collega werkt aan zijn taak zonder het project te kunnen opleveren | middel | later (V2 dekt het eerste deel) |

### L3 Organisatorisch

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Afbreken met reden | ontbreekt; een afgewezen of teruggestuurd besluit laat het project hangen | status | `afgebroken` met reden; taken en bewijs blijven leesbaar; niet terug te zetten | geen | eigenaar, besluitnemers | eigenaar of baas | na `afgerond` niet | Een project waarvan het besluit is afgewezen, kan als afgebroken met reden worden gesloten en staat niet meer bij de lopende projecten | klein | nu · herstel |
| Archief | ontbreekt | `afgerond` en `afgebroken` | uit de lopende lijst; zoeken op titel, huis, periode | geen | eigenaar, executive | officeAuth | | Een opgeleverd project van vorig jaar is te vinden, ook als er 80 nieuwere zijn (de `state`-knip op 80) | klein | nu · verdieping |
| Portfolio per huis | half (lijst "andere projecten", 6) | `projecten` | aantallen per status; te laat = deadline < vandaag (Europe/Amsterdam) en niet afgerond | geen | executive | `audit:lees` of baas | geen ranglijst per medewerker | De eigenaar ziet per status hoeveel projecten er zijn en welke over hun deadline zijn | klein | nu · verdieping |
| Budget met werkelijke kosten | ontbreekt | budget in centen; bedrag uit het besluit | over budget = melding, niet blokkeren; wijziging met verplichte reden (regel uit `bedrijf/project.js`) | werkelijke kosten komen uit Geld; zonder koppeling "niet gemeten" | eigenaar, finance | finance wijzigt budget | | Het project toont budget en uitgegeven bedrag met bron, of "niet gemeten" | middel | later |

### L4 Domeinintelligentie

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Voortgang uit taken, niet uit een invulveld | bestaat | taken | formule in a. | het gewicht van taken is gelijk | | | | | | bestaat |
| Doorlooptijd van afgeronde projecten | ontbreekt | `at` en `oplevering.at` per project | mediaan in dagen per huis, vanaf 5 opgeleverde projecten | weinig historie | executive | `audit:lees` of baas | minder dan 5: "te weinig om te rekenen" | De eigenaar ziet "mediaan 18 dagen (7 projecten)" en geen getal onder de vijf | klein | nu · verdieping |
| Haalbaarheid van de deadline | ontbreekt | open taken, deadline, eerdere doorlooptijden | klasse `advies` met `aannames` en `onbekend` | weinig historie | eigenaar | | minder dan 5 afgeronde projecten: "niet te rekenen" | Het scherm zegt "deadline waarschijnlijk niet haalbaar" alleen met de onderbouwing en de klasse | middel | later |
| Gevolg van uitval van een persoon | ontbreekt | taken per toegewezene | patroon `bedrijf/gevolg.js` (`nietGerekend` met naam) | | baas | | | Bij een overdracht in RTG One ziet de baas welke projecttaken openblijven | middel | later |

### L5 Volledige levenscyclus

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Oplevering is definitief | gerepareerd (1fc43c1) | status | na `afgerond` weigert `project/taak` (400) | geen | | | heropenen alleen als nieuw nazorgproject | Na oplevering verandert geen taak of status meer | klein | gerepareerd |
| Status valt niet terug na besluit | gerepareerd (1fc43c1) | status, besluit | met goedgekeurd besluit blijft de status `uitvoering` tot alles af is | geen | | | | Afvinken na het besluit zet het project niet terug in voorbereiding | klein | gerepareerd |
| Doorgaan na "terug voor aanpassing" | ontbreekt | `goedkeuringId` | project volgt het nieuwe besluit met `vorigeId` (decisionroom.md H2) | | eigenaar | | | Een project waarvan het besluit terugging, kan een nieuw besluit krijgen en weer opleveren | klein | nu · herstel |
| Nazorg en evaluatie | half (`oplevering.leren`) | leerregel | evaluatiedatum optioneel; verschijnt in RTG One Vandaag | | eigenaar | | | Een opgeleverd project kan op een datum worden geëvalueerd | klein | later |

### L6 RTG-samenhang

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| RTMAIL → project | bestaat (in RTG One) | bronmail | verwijzing | | | | beperkte post nooit | | | bestaat |
| Besluit → uitvoering | bestaat | Decision Room | goedkeuring zet uitvoering | | | | | | | bestaat |
| Voorwaarde bij akkoord als taak | ontbreekt | `stem.voorwaarde` | wordt taak met bewijsplicht en de beoordelaar als aftekenaar (decisionroom.md H3) | | eigenaar, beoordelaar | beoordelaar tekent af | | Opleveren weigert zolang de voorwaarde niet is afgetekend | middel | nu · herstel (gedeeld met Decision Room) |
| RTDocs-werkplek per project | half (`project-room-dossier.js` r. 21 plakt `&project=` aan de link) | Office | of Office op project filtert: niet vastgesteld | | | rechten van Office | | De link opent alleen documenten van dit project | klein | later |
| Project Room als scherm op `bedrijf/project.js` | ontbreekt | `w.projecten`, `w.taken` | motor en opslag blijven van Werk OS | | | `werkPoort` | | Een ondernemer ziet zijn Werk OS-project in Project Room met afhankelijkheden en budget | middel | vraagt besluit |
| Verbouwingsketen voor een lid | ontbreekt | zie e. | alleen verwijzingen en projecties | | | lid per stuk | | zie e. | groot | later; vraagt besluit |

### Modus LOS

De kerntaak zonder andere apps: een bestaand project uitvoeren, bewijs vastleggen
en opleveren. Een nieuw project kan dan niet ontstaan, want het enige begin is
een RTMAIL. Letterlijke schermtekst (u-vorm, zakelijk):

**Eigen (altijd).** Taken, bewijs, tijdlijn, oplevering, (na herstel) afbreken.
Leeg scherm, nu al:
> "Een project ontstaat uit een echte vraag in RTMail."

**Noodzakelijke platformdiensten.**

| Dienst | Waarvoor | Schermtekst als hij ontbreekt |
|---|---|---|
| Kantoorsessie op naam (officeAuth, productiedeur B10) | elke route | "U bent niet op naam aangemeld. Projectuitvoering vraagt een persoonlijk personeelsaccount." |
| Persoonlijke sleutel | taak, bewijs, oplevering | "Alleen de projecteigenaar kan deze uitvoering wijzigen." (bestaat, 403) |
| Opslag en herhaalsleutel | elk schrijfverzoek | "Uw wijziging is niet opgeslagen. Er is niets dubbel vastgelegd; probeer het opnieuw." |
| Besluit in dezelfde opslag (`goedkeuringen`) | oplevering | "De vereiste besluitroute is nog niet goedgekeurd." (bestaat, 409) |

**Optionele koppelingen.**

| App | Wat hij levert | Schermtekst als hij uit staat |
|---|---|---|
| RT Mail (`comm.mail`) | het begin van een project, de bronmail | "RTMail is niet bereikbaar; er kan nu geen project worden gestart. Lopende projecten werken gewoon." |
| Decision Room (`werk.besluit`) | het besluit | "Decision Room is niet bereikbaar; het besluit is niet te openen. Opleveren wacht tot het besluit is goedgekeurd." |
| RTDocs (`docs.office`) | documenten en bewijsstukken | "RTDocs is niet bereikbaar; het bewijs staat hier met zijn bron als tekst." |
| RTG One (`werk.rtgone`) | intentie, evaluatie in de werkdag | "De bedoeling uit RTG One is niet te lezen; de titel van het project staat er wel." |

### Modus SAMEN: een intern project van mail tot oplevering

1. Een lid mailt de medewerker; in RTG One maakt hij er een project van met drie taken
   en een besluitroute.
   - *Storing:* een tweede klik op dezelfde mail geeft 409 "bestaat al".
2. Decision Room keurt goed; het project staat op `uitvoering` met de taak
   "Besluit uitvoeren".
   - *Storing:* het besluit gaat "terug" of wordt afgewezen. Het project blijft op
     `besluit` hangen; er is geen afbreken (herstel H2, H3).
3. In Project Room rondt hij de taken af. Het project blijft `uitvoering` tot
   alles af is en gaat dan naar `oplevering` (gerepareerd, 1fc43c1).
   - *Storing:* een afgebroken "taak af" en opnieuw: de taak is af en staat er
     één keer (voltooiproef herstelbaar).
4. Hij probeert op te leveren zonder bewijs: 409 met de reden.
5. Hij legt bewijs vast met bron "RTDocs versie 2" en levert op met uitkomst en leerregel.
   - *Storing:* crash direct na het bewijs. Na de herstart staat het één keer en
     de herhaling hoort `herhaald`.
6. Een week later tikt hij in Uitvoering op "Heropen" bij een taak.
   - *Uitkomst sinds 1fc43c1:* de server weigert met 400 "Dit project is al
     opgeleverd; een taak heropenen kan niet meer". Bewaard: de oplevering.

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

**Contract SAMEN (voorstel; `scripts/lib/appcontract.js` is niet gewijzigd).**

```js
samen: {
  functie: 'link:projectroom', familie: 'WorkOS',
  belofte: 'een medewerker op naam voert een project uit een RTMAIL-vraag uit tot een menselijke oplevering met bewijs per taak, onder een besluit dat blijft gelden; het project eindigt opgeleverd of afgebroken met reden, en een collega of lid wijzigt er niets aan',
  ingang: '/apps/project-room.html',
  bestanden: ['public/apps/project-room.html', 'public/apps/project-room.js', 'public/apps/project-room-uitvoering.js',
    'public/apps/project-room-dossier.js', 'public/apps/project-room-oplevering.js',
    'server/routes/rtgone.js', 'server/kern/rtgone-projecten.js', 'server/lib/mutatiecontracten-project-room.js'],
  scenario: 'scripts/lib/voltooi/projectroom.js',
  ketens: [
    { naam: 'mail wordt project', uitgeeft: 'workflow-regel op de mail', ontvangt: 'RTMAIL-bericht op de eigen codenaam',
      vorm: 'verwijzing', eigenaar: 'comm.mail', toestemming: 'alleen eigen post, nooit beperkte post',
      storingen: ['RT Mail uit: geen nieuw project', 'tweede klik: 409'], proef: 'scripts/lib/voltooi/projectroom.js' },
    { naam: 'besluit geeft uitvoering vrij', uitgeeft: 'projectId in het voorstel', ontvangt: 'status goedgekeurd, aanpassen of afgewezen',
      vorm: 'gebeurtenis', eigenaar: 'werk.besluit', toestemming: 'beoordelaar met rol, nooit de aanvrager',
      storingen: ['"terug" of afgewezen: project hangt (open)', 'taak afvinken na besluit: blijft uitvoering (gerepareerd 1fc43c1)'],
      proef: 'test/rtgone.test.js toets 8; ketenproef met "terug" nog te schrijven' },
    { naam: 'bewijs uit RTDocs', uitgeeft: 'niets', ontvangt: 'documentId (straks versie)',
      vorm: 'verwijzing', eigenaar: 'docs.office', toestemming: 'de rechten van het document',
      storingen: ['RTDocs uit: bewijs met bron als tekst'], proef: 'niet gevonden' },
    { naam: 'taak voor een collega', uitgeeft: 'taak met toegewezen sleutel', ontvangt: 'afvinken door de toegewezene',
      vorm: 'projectie', eigenaar: 'werk.project', toestemming: 'toegewezene zet alleen zijn eigen taak af; nooit opleveren',
      storingen: ['collega vinkt een andere taak af: 403', 'project opgeleverd: 400'], proef: 'nog te schrijven (V2)' }
  ]
}
```

## e. RTG-exclusieve mogelijkheden

| Mogelijkheid | Eigenaar | Capability | Waarom geen markt-app dit kan |
|---|---|---|---|
| De verbouwing als één keten: woningdossier, aannemer, samenwerking, geld, documenten, toestemming | Wonen (dossier), genre bouw (uitvoering), Project Room (samenwerkingsruimte, bezit niets van de anderen), Geld (gevolgen), RTDocs (documenten), stuurlaag (toestemming en uitvoering) | `werk.project`, `docs.office` en de capabilities van Wonen en Geld | Een aannemerspakket kent de woning niet, een woonapp kent de aannemer niet, en geen van beide heeft één identiteit met toestemming per stuk. |
| Oplevering die in code bewijs per taak, een besluit en afgetekende voorwaarden vraagt | Project Room; Decision Room | `werk.project`, `werk.besluit` | De markt toont een vinkje; hier weigert de server. |
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
- `server/kern/tijdzone.js` voor "te laat" in Europe/Amsterdam.

**Ontbrekende koppelingen**

| Van | Naar | Vorm | Toestemming |
|---|---|---|---|
| besluit `aanpassen` | project | project volgt `vorigeId` | aanvrager |
| besluit `afgewezen` | project | project kan afgebroken worden met reden | eigenaar |
| stem.voorwaarde | taak met bewijsplicht | gebeurtenis | beoordelaar tekent af |
| bewijs | RTDocs-versie | verwijzing | rechten van het document |
| offerte-akkoord (bouw) | projectruimte | gebeurtenis | lid en zaak |
| werkbon (bouw) | woningdossier | document naar het dossier van het lid | lid |
| mijlpaal | Geld | verwijzing naar verplichting | lid |
| project (Werk OS) | Project Room-scherm | scherm op bestaande routes | `werkPoort` |

## g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Oplevering definitief, geen statusterugval | klein | laag | | gerepareerd (1fc43c1) |
| H1 Schermzin over afhankelijkheden schrappen tot V1 er is | klein | laag | besluit 3 | nu · herstel |
| H2 Doorgaan na "terug voor aanpassing" | klein | laag | decisionroom.md H2 | nu · herstel |
| H3 Afbreken met reden (uitweg na een afgewezen besluit) | klein | laag | geen | nu · herstel |
| H4 Voorwaarde bij akkoord als aftekenbare taak | middel | middel | decisionroom.md H3 | nu · herstel |
| H5 BEVOEGD-telling voor de projectroutes | klein | laag | `scripts/bevoegdronde.js` | nu · herstel |
| V1 Afhankelijkheid tussen taken (`wachtOp`) | middel | middel | regel uit `bedrijf/taak.js` | nu · verdieping |
| V2 Taken toevoegen, wijzigen, toewijzen; mijn taken in andere projecten | klein | laag | geen | nu · verdieping |
| V3 Bewijs per taak bij oplevering (bewijsplicht) | klein | laag | `bewijs[].taakId` bestaat | nu · verdieping |
| V4 Archief | klein | laag | H3 | nu · verdieping |
| V5 Portfolio per huis met "te laat" | klein | laag | `kern/tijdzone.js` | nu · verdieping |
| V6 Doorlooptijd van opgeleverde projecten | klein | laag | `oplevering.at` | nu · verdieping |
| Meerdere deelnemers (volledig) | middel | middel | V2 | later |
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
| 2. Professionele diepte | Een taak die wacht kan niet af; een kring wordt geweigerd; een taak met bewijsplicht zonder eigen bewijs houdt de oplevering tegen | `node --test` per regel | ontbreekt in Project Room |
| 3. Levenscyclus | Na oplevering verandert niets meer; een project na een afgewezen besluit kan worden afgebroken en hangt niet | voltooiproef `projectroom`, met heropen-na-oplevering en afwijzing als stappen; `test/rtgone.test.js` toets 8 | half: oplevering definitief (1fc43c1); afbreken ontbreekt |
| 4. Samenwerking en rollen | Een collega en een lid wijzigen niets; een toegewezene zet alleen zijn eigen taak af | voltooiproef stap 5; BEVOEGD | voltooiproef lokaal ja; BEVOEGD NIET_GETEST |
| 5. Domeinintelligentie | Een haalbaarheidsuitspraak draagt klasse `advies` en `onbekend`; geen telling onder de vijf | test op zekerheid | ontbreekt |
| 6. Los functioneren | Met RT Mail, Decision Room en Office uit kan een bestaand project worden uitgevoerd en toont het scherm de teksten uit Modus LOS | proef met koppelingen uit | half |
| 7. RTG-ketens | Mail → project → besluit → uitvoering → oplevering, ook na "terug"; en de verbouwingsketen met storingen | ketenproef naar `scripts/ritproef.js` | de eerste half (zakt op "terug"), de tweede ontbreekt |
| 8. Bewezen betrouwbaarheid | Alle acht bewijzen centraal BEWEZEN | APPWERKT.json | 3 van 8; 4 lokaal gesloten |

## Twee uitkomsten

### (A) Binnen de huidige architectuur en scope

**HERSTEL**

| Functie | Kosten | Bouwt op | Stand |
|---|---|---|---|
| Opgeleverd project valt niet terug; goedgekeurd besluit blijft gelden | klein | `kern/rtgone-projecten.js` | gerepareerd (commit 1fc43c1, `test/rtgone.test.js` toets 8) |
| H1 Schermzin "op volgorde van afhankelijkheid" waarmaken of schrappen | klein | `project-room-uitvoering.js`, `project-room.html` | open (workos.md par. 9) |
| H2 Doorgaan na "terug voor aanpassing" | klein | `kern/rtgone-bestuur.js`, `kern/rtgone-projecten.js` | open (Decision Room) |
| H3 Afbreken met reden, ook na een afgewezen besluit | klein | `db.data.rtgOne.projecten` | open, nieuw gevonden |
| H4 Voorwaarde bij akkoord als aftekenbare taak | middel | `stem.voorwaarde`, `kern/rtgone-projecten.js` | open (Decision Room) |
| H5 BEVOEGD-telling | klein | `scripts/bevoegdronde.js` | open |

**VERDIEPING**

| Functie | Kosten | Bouwt op |
|---|---|---|
| V1 Afhankelijkheid tussen taken met cyclusweigering | middel | regel uit `bedrijf/taak.js` (`wachtOp`), niet de motor |
| V2 Taken toevoegen, wijzigen en toewijzen; mijn taken over projecten | klein | `kern/rtgone-projecten.js` |
| V3 Bewijsplicht per taak bij oplevering | klein | `bewijs[].taakId`, `projectOplever` |
| V4 Archief | klein | `db.data.rtgOne.projecten` |
| V5 Portfolio per huis met "te laat" | klein | `kern/tijdzone.js` |
| V6 Doorlooptijd van opgeleverde projecten (vanaf vijf) | klein | `at`, `oplevering.at` |

**Later:** deelnemers, budget uit Geld, bewijs als RTDocs-versie,
haalbaarheid met klasse `advies` (middel elk; `bedrijf/herkomst.js`,
`kern/fiscaal/zekerheid.js`).

### (B) Het uiteindelijke domeinmaximum, ook buiten de huidige scope

Richting en geen toezegging; wat een nieuw domein of externe koppeling vraagt,
staat als besluit. Wetsverwijzingen hieronder zijn **(te controleren)**.

**Proces 1. De verbouwing van een woning, van wens tot opleverdossier.**
- Stappen: wens en budget → (architect: ontwerp) → offertes → opdracht →
  zo nodig vergunning (extern) en een bouwmelding (extern, te controleren) →
  planning en uitvoering → meerwerk met akkoord → termijnbetalingen →
  oplevering met werkbon → consumentendossier (art. 7:757a BW, te controleren)
  in het woningdossier → onderhoud.
- Rollen en organisaties: lid (opdrachtgever), aannemer, onderaannemers,
  architect, kwaliteitsborger (extern), gemeente (extern), eventueel VvE.
- Apps en eigenaar: Wonen (woningdossier, eigenaar van alle objecten van de
  bewoner), genre bouw (uitvoering), Project Room (samenwerking, bezit niets),
  Geld (verplichtingen en betalingen), RTDocs (stukken), stuurlaag (toestemming).
- Buiten scope: een ontwerp- en projectflow voor de aannemer en de architect
  (feiten-wonen: "geen ontwerp- of projectflow"), een materiaalstaat, en het
  architectgenre zijn nieuw domein of een besluit. Vergunningen en meldingen
  blijven extern (voorbehouden).

**Proces 2. Het project van een dienstverlenende onderneming, van offerte tot factuur.**
- Stappen: aanvraag → offerte → opdracht met algemene voorwaarden → planning met
  capaciteit → uitvoering met uren → meerwerk → oplevering met acceptatie →
  factuur → nazorg.
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
4. **Wat gebeurt er met een project na een afgewezen besluit?**
   - (A, aanbevolen) De eigenaar breekt het af met reden; het blijft leesbaar in
     het archief. Kosten: klein.
   - (B) Het project breekt automatisch af bij afwijzing. Kosten: klein; de
     eigenaar verliest de kans om een nieuw voorstel te doen.
