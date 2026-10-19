# RTG One (link:rtgone)

**Volledige werkzaamheid:** een medewerker van RTG of de RTFoundation, op naam ingelogd, legt zijn beloften vast, rondt ze zelf af of trekt ze met reden in, en draagt ze bij verlof of vertrek over aan een collega op persoonssleutel; RTG One doet volledig waarvoor het er is als elke open belofte op elk moment precies één eigenaar heeft, tot ze is nagekomen of met reden ingetrokken, en als dat terug te lezen is in een spoor dat niets afkapt.

Eigenaar: `werk.rtgone` (SCHERMEIGENAAR.json, rol eigenaar). Ingang:
`/apps/rtgone.html`, achter de werkrol "kantoor" (`/api/account/start` met rol
`kantoor`). Doelgroep: kantoor, dus RTG- en RTF-personeel. Doel volgens het
register: "Zijn werkdag overzichtelijk beheren: beslissen met zicht op gevolg en
werk laten doorlopen zonder alles over te dragen."

Opgesteld op 19 oktober 2026 op tak `appwerkt/workos`; herzien dezelfde avond na
het oordeel "deels". Dit is een kaart en geen bouwopdracht.

## a. Inventaris van het bewezen bestaande

**Wat er staat**

| Laag | Pad | Inhoud |
|---|---|---|
| Scherm | `public/apps/rtgone.html`, `public/apps/rtgone-voorzijde.js`, `public/apps/rtgone-voorzijde-weergave.js` | Mijn werkdag, Besluit (toont en stuurt door), Werkstromen, Overdracht, Governance (rollen), commandopalet |
| Routes | `server/routes/rtgone.js` | 17 POST-routes onder `/api/rtgone/*`, alle achter `officeAuth`: state, intentie, belofte, frictie, overdracht, goedkeuring(/beslis), rol/geef, rol/trek, project/{van-mail, taak, bewijs, oplever}, automatisering/{voorbereid, voer, herstel} |
| Kern | `server/kern/rtgone.js` | werkgeheugen: intenties, beloften, fricties, overdrachten, automatiseringen, auditregels |
| Kern | `server/kern/rtgone-bestuur.js` | rollencatalogus (10 rollen), 8 besluittypen, vier-ogenregel; gedeeld met Decision Room |
| Kern | `server/kern/rtgone-projecten.js` | project uit RTMAIL; gedeeld met Project Room |
| Kern | `server/kern/rtgone-vandaag.js` | leesprojectie over `werkplekTaken`, `rtfKantoorTaken`, `agendas`, `rtmail.berichten` (zonder beperkte post), `partnerApplications`, `labProjecten` |
| Kern | `server/kern/rtgone-idem.js` | duurzame herhaalsleutel in dezelfde opslag, 409 bij een andere inhoud onder dezelfde sleutel, maximaal 2000 sleutels |
| Opslag | `db.data.rtgOne` | `intenties, beloften, fricties, overdrachten, automatiseringen, goedkeuringen, projecten, rollen, audit (max 500), idem` |
| Contracten | `server/lib/mutatiecontracten-kaleronde-b.js`, `server/lib/mutatiecontracten-project-room.js` | mutatiecontracten voor frictie, bewijs en oplever |
| Toetsen | `test/rtgone.test.js`, `test/rtgone-voorzijde.test.js`, `test/werkrol.test.js` | kern, voorzijde, werkrol-ingang |
| Voltooiproef | `scripts/lib/voltooi/rtgone.js` | 7 stappen voltooibaar, 3 persistent, 4 herstelbaar |

Drie huizen: `rtg`, `rtf` en `gedeeld`. Een object in `gedeeld` is in beide
huizen zichtbaar.

**Gedrag dat in de code staat**

- Belofte: `open` of `afgerond`. Afronden gaat alleen via een automatisering:
  voorbereid → uitgevoerd, binnen 72 uur terug te draaien (`herstelTot`).
- Frictie: jaarminuten = minuten × frequentie × 52; jaarkosten = jaarminuten / 60 × uurloon.
  Grenzen: 1-480 minuten, 1-1000 keer per week, uurloon 0-1000.
- Overdracht: neemt tot 20 open beloften mee als kopie (id, tekst, deadline).
  De selectie is `eigenaar.toLowerCase().includes(...)` (`kern/rtgone.js` r. 71).
- Rollen: alleen de eigenaar (`boardroomBaas`) geeft en trekt rollen in.
  Intrekken haalt de rij weg (`splice` in `rtgone-bestuur.js`); alleen de
  auditregel blijft.
- `state` toont per huis maximaal 60 intenties, 80 beloften, 30 overdrachten en
  40 auditregels (`kern/rtgone.js` r. 40-43). Oudere objecten blijven bewaard,
  maar zijn op het scherm niet meer te vinden.
- In productie opent alleen een kantoorsessie op naam met passkey het kantoor
  (`server/kern/kantoor/productiedeur.js`, besluit B10). Buiten productie werkt de
  gedeelde kantoorcode nog; dan is `context.key` leeg.

**Wat BEWEZEN is**

| Bewijs | Stand | Bron |
|---|---|---|
| bereikbaar | BEWEZEN | APPWERKT.json |
| bedienbaar | BEWEZEN | APPWERKT.json |
| menselijk | NIET_GETEST centraal | APPWERKT.json |
| voltooibaar | GEEN_FIXTURE centraal; lokaal gesloten 7/7 | VOLTOOIPROEF.json (04:47, f85c044e); verse proef 19-10, dc501544 |
| waarheidsgetrouw | BEWEZEN | APPWERKT.json |
| persistent | GEEN_FIXTURE centraal; lokaal gesloten | idem |
| bevoegd | NIET_GETEST | BEVOEGD.json (geen telling voor rtgone) |
| herstelbaar | GEEN_FIXTURE centraal; lokaal gesloten 4/4 | idem |

Formulering: voltooiproef lokaal gesloten 4/4 (19-10, dc501544), centraal nog te
stempelen. IDOR.json meldt over 1999 routes 0 doorbraken en 0 lekken; dat is
huisbreed en geen rtgone-specifieke toets.

**Staat, onbewezen**

- Rollen geven en intrekken (de voltooiproef van rtgone raakt ze niet; die van
  decisionroom wel).
- `project/van-mail` vanuit dit scherm (wel in de proef van projectroom).
- Het commandopalet en de view Werkstromen.

**Niet gebouwd volgens de code zelf**

- Geen archief-, wijzig- of intrekroute voor intentie, belofte, frictie of overdracht.
- Een belofte heeft geen handmatige afrondroute; alleen de automatisering zet haar af.
- Eén soort automatisering: `belofte-afronden`.

**Reparatieronde 19 oktober.** In de tabel van `docs/domeinkaarten/workos.md`
par. 9 staat voor deze kaart niets gerepareerd. De twee bevindingen van rtgone
(overdracht op een stuk naam, audit afgekapt op 500) staan daar nog open. Een
correctie op die tabel: de belofte "onveranderlijk" staat op het scherm van
Decision Room (`public/apps/decision-room-besluit.js` r. 8) en gaat over de stem.
De stem zelf blijft in `goedkeuringen[].stemmen` bewaard. Alleen de auditregel
over die stem valt na 500 regels weg.

## b. Marktvergelijking

RTG One is een intern werkgeheugen met governance. De markt verkoopt dat als
kantoorsuite met AI, als werkbeheer met doelen, of als kennisbank. Merken staan
hier alleen ter vergelijking. Elke regel in deze tabel komt uit een
zoeksamenvatting en is **(te controleren)**.

| Leider | Wat achter de betaalmuur zit | Hebben wij het | Bron (19-10-2026) |
|---|---|---|---|
| Microsoft 365 E7 ($99 p.p.p.m.) | E5 met Copilot, Agent 365 en de Entra Suite | half: werkdag-projectie en voorbereiden/bevestigen bestaan; geen agents met uitvoerend gezag (bewust, OFFICE fase 8) | **(te controleren)** https://www.microsoft.com/en-us/microsoft-365/enterprise/e7 (via zoektool, live te controleren) |
| Microsoft 365 E5 ($60) | Purview, DLP, Insider Risk, eDiscovery Premium | half: classificatie en uitgangspoort in Office; geen eDiscovery over RTG One | **(te controleren)** https://www.microsoft.com/en-us/security/pricing/enterprise-plans (via zoektool, live te controleren) |
| Notion Enterprise (offerte) | SCIM, auditlog, analytics, onbeperkte paginageschiedenis | half: auditregels, maar afgekapt op 500; SCIM bestaat huisbreed (`server/scim/`), niet als functie van RTG One | **(te controleren)** https://www.notion.com/pricing (via zoektool, live te controleren) |
| Asana Advanced / Enterprise+ | doelen, portfolio's, goedkeuringsworkflows, werklast; SIEM-export, dataresidentie | half: intenties lijken op doelen, goedkeuring bestaat; geen werklast, geen export | **(te controleren)** https://asana.com/pricing (via zoektool, live te controleren; [oud] voor Enterprise+) |

Wat vrijwel alle topniveaus delen (SSO/SCIM, SIEM-auditlog, dataresidentie, DLP,
sandbox) heeft RTG One niet als eigen functie. De passkey-kantoordeur dekt de
inlogkant; de rest is huisbreed of ontbreekt.

Wat geen van deze leiders heeft: een **frictie in euro's per jaar** die een
medewerker zelf vastlegt, een **belofte als object** dat bij een overdracht
meegaat, en een **herstelvenster van 72 uur** op een automatisering.

## c. Analyse van het volledige domein

**Hoe het werkgebied echt werkt.**

- *Particulier.* Een lid heeft ook een werkdag. Die woont al in
  `/apps/kantoor.html` (kern/kantoorwereld.js). SCHERMEIGENAAR noemt de twee
  uitdrukkelijk "geen-dubbel". RTG One bedient de particulier dus niet en hoort
  dat ook niet te doen.
- *Professioneel.* Een medewerker van RTG of RTF doet beloften aan leden en
  partners, werkt in meerdere huizen, gaat met verlof of uit dienst, en moet
  zijn lopende werk overdragen. Wat hij nodig heeft: wat ligt er vandaag, wat
  heb ik beloofd, wat schuurt, en wie neemt het over.
- *Organisatie.* RTG en de RTFoundation hebben elk eigen bevoegdheden, eigen
  rollen en een gedeeld deel. De organisatie wil weten welke beloften openstaan,
  waar werk structureel tijd kost en wie welk besluit mocht nemen.

Een ondernemer die hetzelfde voor zijn eigen bedrijf wil, gebruikt Werk OS
(`server/bedrijf/`, eigenaar `werk.organisatie`). RTG One is daarvan niet de
schil; zie "Vraagt besluit".

**Wettelijke en normatieve eisen.** Geen van deze primaire teksten is voor deze
kaart zelf gelezen. Elke regel is daarom **(te controleren)** en wordt nergens
een harde weigerregel; hooguit een signaal.

| Eis | Bron | Betekenis voor RTG One |
|---|---|---|
| Verwerkingsregister (AVG art. 30) **(te controleren)** | https://autoriteitpersoonsgegevens.nl/nl/over-privacy/persoonsgegevens/bewaren-van-persoonsgegevens | Beloften en overdrachten noemen personen ("aan wie"). Dat hoort als verwerking in het register; niet gevonden in de code. |
| Rechten van betrokkenen binnen 1 maand, +2 met reden (AVG art. 12) **(te controleren)** | https://autoriteitpersoonsgegevens.nl/nl/zelf-doen/gebruik-uw-privacyrechten/recht-op-inzage | Een medewerker of lid kan vragen wat RTG One over hem bewaart. Er is geen exportroute per persoon. |
| Bewaren "niet langer dan nodig" **(te controleren)** | idem | Er is geen bewaartermijn; de audit kapt af op 500, de rest blijft onbeperkt. |
| Overige personeelsgegevens 2 jaar (AP-richtlijn) **(te controleren)** | https://autoriteitpersoonsgegevens.nl/nl/onderwerpen/werk-en-uitkering/personeelsdossiers | Fricties met uurloon en overdrachten bij uitdienst vallen hier mogelijk onder. |
| Datalek binnen 72 uur melden (AVG art. 33) **(te controleren)** | https://autoriteitpersoonsgegevens.nl/nl/onderwerpen/beveiliging/meldplicht-datalekken | Hoort bij RTG als organisatie, niet bij deze app. Een melding mag hier wel als belofte met deadline staan. |
| Cbw/NIS2: 24 uur waarschuwing, 72 uur melding, 1 maand eindverslag **(te controleren)** | https://www.ncsc.nl/cyberbeveiligingswet-nis2/meldplicht | Of RTG onder de Cbw valt, is niet vastgesteld. Als dat zo is, zijn dit beloften met een harde klok. |
| ISO 9001 7.5 gedocumenteerde informatie; 9.3 directiebeoordeling **(te controleren)** | https://www.tuvsud.com/en/knowledge-hub/articles/iso-9001-2026-everything-you-need-to-know-about-the-new-revision | Normatief, niet wettelijk. Intenties met `herzieOp` en de frictielijst zijn bruikbare input voor een directiebeoordeling. De versie 2026 en de clausulenummers zijn niet geverifieerd (workos.md par. 11). |
| ISO 22301 clausule 8 (BIA, plannen, oefenen) **(te controleren)** | https://www.iso.org/standard/75106.html | De overdracht is een continuïteitsmiddel voor één persoon. Een BIA over de hele organisatie is niet van deze app. |

**Wat dat betekent voor software.** RTG One moet een bewaarklasse per object
kunnen dragen, een persoon kunnen exporteren en wissen zonder het auditspoor te
breken, en de audit niet stil afkappen. De termijnen zelf (72 uur, 1 maand,
2 jaar) zijn te controleren. Ze staan als beloften met een deadline of als
signaal, en niet als eigen meldmotor of wisregel. Tot een mens de termijn heeft
vastgesteld, wist RTG One niets op grond van zo'n regel.

## d. Functiecatalogus L1–L6

In de kolom Bak staat "nu · herstel" voor een fout of een belofte die de code
niet waarmaakt, en "nu · verdieping" voor nieuwe diepte binnen de huidige scope.

### L1 Persoonlijk

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Mijn werkdag (Vandaag) | bestaat, `kern/rtgone-vandaag.js` | eigen RTMAIL op codenaam, eigen agenda, huistaken, partneraanvragen of lab-veiligheidstoetsen | maximaal 24 items; beperkte post (`isBeperkt`) nooit | een bron die ontbreekt geeft nu een lege lijst en geen "niet gemeten" | de medewerker, bij openen | officeAuth; persoonlijk alleen met eigen sleutel | gedeelde kantoorcode: geen mail, geen agenda | Ik zie alleen mijn eigen post en agenda, en als een bron ontbreekt zegt het scherm dat in plaats van "niets" | klein | nu · herstel ("niet gemeten" per bron, patroon `kern/partnernetwerk.js`) |
| Belofte vastleggen | bestaat, `kern/rtgone.js` belofteMaak | tekst, aan wie, eigenaar (vrije tekst), deadline, intentie | herhaalsleutel; status `open` | eigenaar is een naam en geen sleutel | eigenaar | officeAuth | zonder deadline geen klok | Een belofte staat er één keer, ook na een dubbele tik of crash | klein | bestaat |
| Belofte afronden, heropenen of intrekken met reden | half; alleen via automatisering | belofte-id, reden | afronden en intrekken vragen een reden; heropenen binnen 72 uur; elke overgang een auditregel | geen | eigenaar; wie de belofte ontving (als die medewerker is) | eigenaar of baas | automatisering blijft bestaan voor bulk | Ik kan mijn eigen belofte afvinken of met reden intrekken, en zie dat terug in het spoor | klein | nu · verdieping |
| Deadlineklok op beloften | ontbreekt | `deadline` | verlopen = deadline < vandaag in Europe/Amsterdam (`kern/tijdzone.js`); sortering: verlopen, binnen 2 werkdagen, rest | een deadline als vrije tekst die geen datum is: "geen datum" | eigenaar in Vandaag, dag van verlopen | eigenaar | zonder deadline geen melding | Een verlopen belofte staat bovenaan in mijn werkdag, met de datum en het aantal dagen te laat | klein | nu · verdieping |
| Frictie als schatting labelen | half: het bedrag staat er als feit | minuten, frequentie, uurloon | jaarminuten en jaarkosten (zie a.); klasse `advies` uit `kern/fiscaal/zekerheid.js` met de drie invoerwaarden als `aannames` | het uurloon is een schatting van de invuller | eigenaar; huis ziet het totaal | officeAuth | geen | Het jaarbedrag klopt met de formule en draagt de zin van klasse `advies`, nooit als vaststaand bedrag | klein | nu · herstel |

### L2 Professioneel

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Overdracht op persoonssleutel | half, `overdrachtMaak` zoekt op een stuk naam | open beloften van de overdrager | match op `eigenaarKey`, niet op `includes` van een naam; een belofte zonder sleutel (oud) vraagt een handmatige keuze | oude beloften dragen alleen een naam | vervanger direct; overdrager bij terugkeer | overdrager of baas | beperkte post en privacybeloften gaan niet mee | Een overdracht van "Jan" neemt nooit een belofte van "Janneke" mee | klein | nu · herstel |
| Overdracht die eigendom verplaatst en teruggeeft | half; nu alleen een kopie | overdracht, beloften | belofte krijgt `waarnemerKey` van de vervanger; na `geldigTot` vervalt die en is de overdrager weer de enige eigenaar; aanvaarden door de vervanger is verplicht | wat de vervanger wel of niet aanvaardt | vervanger direct; overdrager op `geldigTot` | overdrager of baas; vervanger aanvaardt of weigert met reden | een belofte die tijdens de waarneming is afgerond, blijft afgerond | Na de overdracht staan precies de beloften van de overdrager in de werkdag van de vervanger, en na de einddatum weer alleen bij de overdrager | middel | nu · verdieping |
| Intentie met herziedatum | bestaat (`herzieOp`) | titel, bedoeling, voor wie, bewijs | op `herzieOp` verschijnt de intentie in Vandaag met "klopt dit nog?" | geen | eigenaar op de herziedatum | officeAuth | geen | Op de herziedatum vraagt Vandaag of de bedoeling nog klopt | klein | later |
| Project uit RTMAIL | bestaat, `rtgone-projecten.js` | eigen bericht op codenaam | één project per mail (409); drie starttaken; optioneel een besluitroute | geen | eigenaar; Decision Room als er een besluitroute is | persoonlijke sleutel en codenaam | beperkte post nooit | Van een mail ontstaat één project met de bron erbij | klein | bestaat |
| Persoonlijke export | ontbreekt | alle objecten met `door`, `eigenaar`, `eigenaarKey` of `key` van één persoon | AVG art. 12 (te controleren); termijn als signaal | de vrije-tekstvelden noemen soms anderen | betrokkene | betrokkene zelf; kantoor met reden | gegevens van anderen worden weggelaten | Een medewerker downloadt alles wat RTG One over hem bewaart, binnen een dag | middel | later |

### L3 Organisatorisch

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Rol hangt aan een bestaande medewerker | half; `key` wordt niet gecontroleerd | catalogus van 10 rollen | `rolGeef` weigert een sleutel die geen kantoormedewerker is (400) | geen | betrokkene; spoor | baas | geen | Een rol op een niet-bestaande sleutel wordt geweigerd met de reden | klein | nu · herstel |
| Rol met einddatum en historie | ontbreekt; intrekken haalt de rij weg | rol, `geldigTot`, reden | intrekken zet `ingetrokkenAt` en reden; de rij blijft; een verlopen rol geeft geen recht meer (patroon `server/bedrijf/rollen.js`) | geen | betrokkene en baas, op de einddatum | baas | de eigenaar zelf heeft geen rol nodig | Na de einddatum mag de medewerker dat besluittype niet meer beoordelen, en het archief toont wie de rol wanneer had | klein | nu · verdieping |
| Auditspoor zonder afkappen | half; `audit` tot 500 | elke schrijfhandeling | append-only via `kern/auditboek/` (hashketen); `state` toont de laatste 40 en een lees-route bladert verder | geen | auditor, executive | `audit:lees` | geen | Na 600 handelingen staat de eerste er nog en klopt de hashketen | middel | nu · herstel |
| Alles terugvinden, niet alleen de nieuwste 80 | half; `state` knipt op 60/80/30 | intenties, beloften, overdrachten | zoeken en bladeren op huis, status, eigenaar en periode; geen afkapping in de lijst | geen | medewerker | officeAuth | geen | Een belofte van een jaar geleden is te vinden, ook als er 200 nieuwere zijn | klein | nu · herstel |
| Frictieregister per huis | half (`stats.frictieUren`, `frictieEuro`) | fricties | som per huis en de tien grootste posten; nooit per persoon gerangschikt | de schattingen | executive, operations | `audit:lees` of baas | geen ranglijst op medewerkers | Het huis ziet het totaal en de grootste posten, nooit wie het meest klaagt | klein | nu · verdieping |
| Bewaarklasse per object | ontbreekt | type object | een termijn die een mens met bron vaststelt; tot dan het signaal "2 jaar na afsluiten (te controleren)" en niets wordt gewist | de juiste termijn | privacyrol | `besluit:privacy` | lopende beloften blijven | Elk afgesloten object toont zijn bewaarklasse; zolang de termijn niet is vastgesteld, staat er "te controleren" en wordt er niets gewist | middel | later |

### L4 Domeinintelligentie

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Nakoming op tijd, per huis | ontbreekt | afgeronde beloften met `deadline` en `afgerondAt` | aandeel op of vóór de deadline, per maand; alleen bij 10 of meer beloften met deadline; nooit per medewerker | beloften zonder deadline tellen niet mee en staan apart | executive | `audit:lees` of baas | minder dan 10: "te weinig om te rekenen" | Het huis ziet "31 van 40 op tijd" met de periode, en geen getal onder de tien | klein | nu · verdieping |
| Gevolg van een overdracht vooraf | ontbreekt | open beloften, deadlines, agenda vervanger | telt wat er binnen `geldigTot` verloopt; via `kern/stuur/gevolg.js` als voorstel | de agenda van de vervanger kan onvolledig zijn | overdrager vóór bevestigen | overdrager | geen | Vóór ik bevestig zie ik hoeveel beloften binnen de periode verlopen, met de klasse `advies` | middel | later |
| Frictie als scenario | ontbreekt | fricties | `kern/fiscaal/scenario.js` levert klasse `advies` met `aannames` en `onbekend` | uurloon en frequentie zijn schattingen | executive | baas | niets wordt doorgevoerd | Een besparing staat er als scenario met aannames, nooit als bedrag dat vaststaat | klein | later |
| AI-voorstel voor een belofte uit mail | ontbreekt | eigen RTMAIL | lokaal-eerst; voorstel via de stuurlaag, mens bevestigt | wat de mail bedoelt | eigenaar | eigenaar; AI niet meer dan de vrager | `RTG_EXTERNE_AI_UIT=1` | De AI zet een belofte klaar; zonder mijn bevestiging staat er niets | middel | later |

### L5 Volledige levenscyclus

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Archiveren van intenties en overdrachten | ontbreekt | status | `actief` → `gearchiveerd` met reden; terug kan | geen | eigenaar | eigenaar of baas | geen | Een gearchiveerde intentie verdwijnt uit Vandaag en staat in het archief | klein | nu · verdieping |
| Herstel alleen als het doel ongewijzigd is | half; `automatiseringHerstel` kijkt niet of de belofte intussen veranderde | `voor`, `na`, huidige stand | herstel alleen als huidige stand = `na` | geen | uitvoerder | uitvoerder | buiten 72 uur nooit | Een herstel na een handmatige wijziging wordt geweigerd met de reden | klein | nu · herstel (wordt een fout zodra handmatig afronden bestaat) |
| Uitdienst: alle open beloften in één overdracht | ontbreekt | `kern/concern/employment.js` einddatum | bij einde dienstverband vraagt Vandaag van de leidinggevende om een overdracht | wie de leidinggevende is | leidinggevende, op einddatum − 5 werkdagen | baas, people | geen | Niemand vertrekt met een open belofte zonder overdracht | middel | later (hangt aan besluit 3 van de familiekaart) |

### L6 RTG-samenhang

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| RTMAIL → project | bestaat | `rtmail.berichten` | verwijzing `bron.mailId`; mail krijgt `workflow`-regel | geen | eigenaar | dezelfde persoon | beperkte post | Het project wijst naar de mail; de mail wijst naar het project | klein | bestaat |
| Besluit en project | bestaat, eigenaar Decision Room en Project Room | `goedkeuringen`, `projecten` | RTG One toont en stuurt door (SCHERMEIGENAAR "gedeeltelijk, uitgevoerd") | geen | | | | | | bestaat |
| Agenda in Vandaag | bestaat, leest `agendas[key]` | eigenaar `apps/agenda.html` | alleen lezen | geen | | | | | | bestaat |
| Frictie als onderbouwing van een besluit | ontbreekt | `frictieId` | verwijzing in het voorstel; Decision Room toont naam en jaarbedrag met klasse `advies` | de schatting | beoordelaar | aanvrager kiest de frictie | frictie van een ander huis niet | Een voorstel kan een frictie noemen, en de beoordelaar ziet het bedrag als schatting | klein | nu · verdieping |
| Belofte aan een lid zichtbaar voor dat lid | ontbreekt | belofte met `aan` | projectie naar het lid alleen als `aan` een codenaam is en de medewerker dat koos; eigenaar van de weergave is RT Mail of Concierge, niet RTG One | of een interne belofte gedeeld mag | lid | lid | interne beloften blijven intern | Een lid ziet "RTG beloofde u X vóór Y" alleen als de medewerker dat koos | middel | later; vraagt besluit |

### Modus LOS

De kerntaak zonder andere apps: beloften, intenties, fricties en overdrachten
vastleggen, en een belofte omkeerbaar afronden. Dat leeft volledig in
`db.data.rtgOne`. Vandaag zegt nu niets over een ontbrekende bron; `liveVandaag`
geeft dan een lege lijst. Hieronder de letterlijke schermtekst die er dan hoort
te staan (u-vorm, zakelijk: het kantoor spreekt zijn eigen medewerkers aan).

**Eigen (altijd).** Werkgeheugen, beloften, intenties, fricties, overdrachten,
automatisering met herstel. Als er nog niets is:
> "Er staat nog geen belofte op uw naam. Leg vast wat u hebt toegezegd, dan houdt RTG One het bij."

**Noodzakelijke platformdiensten.**

| Dienst | Waarvoor | Schermtekst als hij ontbreekt |
|---|---|---|
| Kantoorsessie op naam (officeAuth, productiedeur B10) | elke route | "U bent niet op naam aangemeld. Meld u aan met uw passkey om uw werkdag te openen." |
| Persoonlijke sleutel (`context.key`) | projecten, besluiten, eigen post en agenda | "U werkt met de gedeelde kantoorcode. Uw eigen post, agenda en beloften op naam ziet u pas als u op naam bent aangemeld." |
| Opslag (`db.data.rtgOne`, herhaalsleutel) | elk schrijfverzoek | "Uw wijziging is niet opgeslagen. Er is niets dubbel vastgelegd; probeer het opnieuw." |
| Auditboek (`kern/auditboek/`, na herstel) | spoor | "Het spoor kan nu niet worden bijgeschreven; daarom is uw wijziging niet doorgevoerd." |

**Optionele koppelingen.**

| App | Wat hij levert | Schermtekst als hij uit staat |
|---|---|---|
| RT Mail (`comm.mail`) | post in Vandaag, project uit mail | "RT Mail is niet bereikbaar; uw post is niet geteld en er kan nu geen project uit een bericht ontstaan." |
| Agenda (`agenda.afspraken`) | afspraken in Vandaag | "Uw agenda is niet bereikbaar; afspraken van vandaag staan hier niet." |
| Decision Room (`werk.besluit`) | besluitroute | "Decision Room is niet bereikbaar; een project start zonder besluitroute." |
| Project Room (`werk.project`) | uitvoering | "Project Room is niet bereikbaar; uw projecten staan hier alleen als titel." |
| Partner worden / RTF-lab | goedkeuringen in Vandaag | "Partneraanvragen zijn niet geteld." of "Veiligheidstoetsen zijn niet geteld." |

### Modus SAMEN: van een mail van een lid tot een opgeleverd project en een overdracht

1. Een lid stuurt de medewerker een RTMAIL op zijn codenaam. Die verschijnt in Vandaag.
   - *Storing:* RT Mail is traag of leeg. Hij ziet een lege lijst (nu) of "niet
     gemeten" (na herstel). Bewaard: de mail in RT Mail.
2. Hij maakt er een project van met besluitroute `finance` en € 25.000.
   - *Storing:* de mail is beperkte post (werving). Hij ziet 404 "staat niet in
     uw persoonlijke RTMAIL". Bewaard: niets; dat is de bedoeling.
   - *Storing:* dubbele tik. Er ontstaat één project; de tweede krijgt 409.
3. Decision Room vraagt twee stemmen (bedrag ≥ 10.000). Een collega met de rol
   Finance stemt "terug voor aanpassing".
   - *Storing:* het besluit staat op `aanpassen` en kan niet opnieuw worden
     ingediend. Het project blijft op status `besluit` en opleveren geeft voor
     altijd 409. Bewaard: het project, de taken, de stem en de reden. Open
     bevinding van Decision Room.
4. Na een goedgekeurd besluit krijgt het project een uitvoeringstaak; de medewerker
   werkt in Project Room en legt bewijs vast met een verwijzing naar RTDocs.
   Taken afvinken zet het project niet meer terug op `in-voorbereiding`
   (gerepareerd, 1fc43c1).
   - *Storing:* Office is uit. De documentlink in het dossier opent niet; het
     bewijs blijft staan, met de bron als tekst.
5. Hij levert op. Daarna gaat hij met verlof en maakt een overdracht.
   - *Storing:* een collega heet "Jan", een ander "Janneke". De overdracht van
     "Jan" neemt ook de beloften van Janneke mee (substring-match). Bewaard: alles,
     maar in de verkeerde overdracht. Herstel H1.
   - *Storing:* crash direct na de overdracht. Met dezelfde herhaalsleutel staat
     hij er één keer.
6. De vervanger ziet de beloften (na verdieping V2) in zijn werkdag en aanvaardt.
   - *Storing:* de vervanger weigert met reden. De beloften blijven bij de
     overdrager en de leidinggevende ziet de weigering in zijn werkdag.

**Contract SAMEN (voorstel; `scripts/lib/appcontract.js` is niet gewijzigd).**

```js
samen: {
  functie: 'link:rtgone', familie: 'WorkOS',
  belofte: 'een medewerker op naam legt beloften vast, rondt ze af of draagt ze op persoonssleutel over aan een collega die aanvaardt, en elke stap staat in een spoor dat niets afkapt',
  ingang: '/apps/rtgone.html',
  bestanden: ['public/apps/rtgone.html', 'public/apps/rtgone-voorzijde.js', 'public/apps/rtgone-voorzijde-weergave.js',
    'server/routes/rtgone.js', 'server/kern/rtgone.js', 'server/kern/rtgone-vandaag.js', 'server/kern/rtgone-idem.js'],
  scenario: 'scripts/lib/voltooi/rtgone.js',
  ketens: [
    { naam: 'mail wordt project', uitgeeft: 'project met bron.mailId', ontvangt: 'RTMAIL-bericht op de eigen codenaam',
      vorm: 'verwijzing', eigenaar: 'comm.mail', toestemming: 'alleen eigen post, nooit beperkte post (isBeperkt)',
      storingen: ['RT Mail uit: "niet gemeten" in Vandaag', 'beperkte post: 404', 'dubbele tik: 409'],
      proef: 'scripts/lib/voltooi/projectroom.js (stap mail → project)' },
    { naam: 'project vraagt besluit', uitgeeft: 'goedkeuring dec- met projectId', ontvangt: 'besluitstatus',
      vorm: 'gebeurtenis', eigenaar: 'werk.besluit', toestemming: 'beoordelaar met recht besluit:<type>, nooit de aanvrager',
      storingen: ['"terug" sluit zonder herindienroute (open)', 'rol ontbreekt: 403'],
      proef: 'scripts/lib/voltooi/decisionroom.js' },
    { naam: 'overdracht naar collega', uitgeeft: 'waarnemerKey op open beloften', ontvangt: 'aanvaarding of weigering van de vervanger',
      vorm: 'projectie', eigenaar: 'werk.rtgone', toestemming: 'overdrager of baas; vervanger aanvaardt',
      storingen: ['naam-match vindt verkeerde persoon (open, H1)', 'crash na overdracht: één keer door herhaalsleutel'],
      proef: 'nog te schrijven: uitbreiding van scripts/lib/voltooi/rtgone.js met twee medewerkers "Jan" en "Janneke"' },
    { naam: 'agenda in de werkdag', uitgeeft: 'niets', ontvangt: 'agendas[key]', vorm: 'projectie',
      eigenaar: 'agenda.afspraken', toestemming: 'alleen de eigen agenda, alleen met persoonlijke sleutel',
      storingen: ['agenda uit: "niet gemeten"', 'gedeelde kantoorcode: geen agenda'],
      proef: 'niet gevonden' }
  ]
}
```

## e. RTG-exclusieve mogelijkheden

| Mogelijkheid | Eigenaar | Capability | Waarom geen markt-app dit kan |
|---|---|---|---|
| Een belofte aan een lid die bij een overdracht automatisch meereist en die het lid kan zien | RTG One (belofte); RT Mail of Concierge (weergave aan het lid) | `werk.rtgone`, `comm.mail` | De markt-app kent de klant niet als lid met een codenaam en een eigen postvak in hetzelfde huis. |
| Frictie die direct een besluit voedt | RTG One (frictie); Decision Room (besluit) | `werk.rtgone`, `werk.besluit` | Een frictie in euro's per jaar kan als onderbouwing in een besluitvoorstel staan, met dezelfde personen en rollen. |
| Werkdag over RTG en RTFoundation met gescheiden huizen | RTG One | `werk.rtgone` | Twee rechtspersonen met één medewerker en gescheiden rechten, zonder twee tenants. |
| Nakoming op tijd per huis, zonder ranglijst op mensen | RTG One | `werk.rtgone` | De markt meet productiviteit per persoon; hier telt de organisatie, en een telling onder de tien wordt niet getoond. |

## f. Bouwstenen en ontbrekende koppelingen

**Bestaande modules om op te bouwen**

- `server/kern/rtgone-idem.js` (herhaalsleutel), `server/kern/rtgone-bestuur.js` (rollen).
- `server/bedrijf/rollen.js` als patroon voor rollen met einddatum (niet als motor).
- `server/kern/auditboek/` (hashketen) voor het auditspoor.
- `server/kern/kantoor/kluispoort.js` (`naamAuth`): handeling alleen op naam.
- `server/kern/stuur/` (plan, goedkeuring, bevestiging, gevolg) voor voorstellen.
- `server/kern/fiscaal/scenario.js` en `server/kern/fiscaal/zekerheid.js` voor L1 en L4.
- `server/kern/tijdzone.js` voor "vandaag" in Europe/Amsterdam.
- `server/kern/concern/employment.js` voor de uitdienst-trigger.
- `server/kern/partnernetwerk.js` als patroon voor "niet gemeten".

**Ontbrekende koppelingen**

| Van | Naar | Vorm | Toestemming |
|---|---|---|---|
| employment (einde dienst) | RTG One Vandaag | gebeurtenis → taak voor de leidinggevende | people-rol of baas |
| RTG One audit | auditboek | append met hash | geen extra; lezen `audit:lees` |
| belofte (`aan` = codenaam) | postvak van het lid | projectie | medewerker kiest per belofte |
| frictie | Decision Room-voorstel | verwijzing (`frictieId`) | aanvrager |

## g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| H1 Overdracht op persoonssleutel in plaats van een stuk naam | klein | laag | `eigenaarKey` op nieuwe beloften | nu · herstel |
| H2 Auditspoor zonder afkappen (auditboek) | middel | middel | `kern/auditboek/` | nu · herstel |
| H3 Rol alleen op een bestaande medewerker | klein | laag | kantoormedewerkers uit de kluis (`server/accounts/`) | nu · herstel |
| H4 "Niet gemeten" per bron in Vandaag | klein | laag | geen | nu · herstel |
| H5 Frictie labelen als schatting (`advies`) | klein | laag | `kern/fiscaal/zekerheid.js` | nu · herstel |
| H6 Alles terugvinden voorbij 60/80/30 | klein | laag | geen | nu · herstel |
| H7 BEVOEGD-telling voor `/api/rtgone/*` | klein | laag | `scripts/bevoegdronde.js` | nu · herstel |
| V1 Belofte afronden, heropenen, intrekken met reden (met herstel-alleen-bij-ongewijzigd) | klein | laag | geen | nu · verdieping |
| V2 Overdracht die eigendom verplaatst, aanvaard wordt en teruggaat | middel | middel | H1 | nu · verdieping |
| V3 Deadlineklok in Vandaag | klein | laag | `kern/tijdzone.js` | nu · verdieping |
| V4 Rol met einddatum en historie | klein | laag | H3 | nu · verdieping |
| V5 Nakoming op tijd per huis | klein | laag | V1, V3 | nu · verdieping |
| V6 Frictieregister per huis en frictie als onderbouwing in Decision Room | klein | laag | H5 | nu · verdieping |
| V7 Archief voor intenties en overdrachten | klein | laag | geen | nu · verdieping |
| Persoonlijke export | middel | middel | privacyrol | later |
| Uitdienst-overdracht via employment | middel | middel | familiebesluit 3 | later |
| Gevolg van een overdracht vooraf | middel | middel | `kern/stuur/gevolg.js` | later |
| Belofte zichtbaar voor het lid | middel | middel | besluit 1 | later |
| Bewaarklasse per object | middel | middel | besluit 2 en een gelezen bron | later |
| AI-agent die beloften afrondt zonder mens | groot | hoog | | niet doen: botst met de stuurlaag ("doorvoeren is een mensbesluit") |

## h. Toetsbaar eindcontract Beyond Premium

Dit contract vervangt de acht bewijzen van APPWERKT nooit.

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| 1. Breedte | Afronden, intrekken, heropenen, archiveren, overdragen en aanvaarden hebben elk een knop en een route | `scripts/schermen.js` | half: alleen afronden via automatisering |
| 2. Professionele diepte | Een overdracht vindt alleen de juiste persoon; een rol op een onbekende sleutel wordt geweigerd; een verlopen rol geeft geen recht | `node --test` per regel (twee medewerkers "Jan" en "Janneke") | zakt nu op de overdracht |
| 3. Levenscyclus | Elk object kan worden gemaakt, afgesloten, gearchiveerd en hersteld, of zegt waarom niet; na 600 handelingen staat de eerste auditregel er nog | voltooiproef `rtgone`, uitgebreid met archief en 600 handelingen | half |
| 4. Samenwerking en rollen | Een lid zonder kantoorrol, een collega zonder rol en uitgelogd krijgen 403/404/401; een vervanger ziet alleen wat hem is overgedragen | BEVOEGD, IDOR, voltooiproef stap 6-7 | voltooiproef lokaal ja; BEVOEGD NIET_GETEST |
| 5. Domeinintelligentie | Elk bedrag of gevolg draagt klasse `advies` met `aannames`; geen telling onder de tien; geen ranglijst op mensen | test op `zekerheid` | frictie draagt nog geen klasse |
| 6. Los functioneren | Met RT Mail en Agenda uit werkt het werkgeheugen en toont Vandaag de schermteksten uit Modus LOS | proef met bronnen uit | half: werkt, maar zegt het niet |
| 7. RTG-ketens | Mail → project → besluit → uitvoering → oplevering → overdracht loopt, ook na "terug voor aanpassing" | ketenproef naar `scripts/ritproef.js` | half: zakt op "terug" |
| 8. Bewezen betrouwbaarheid | Alle acht bewijzen staan centraal op BEWEZEN | APPWERKT.json | 3 van 8 BEWEZEN; 4 lokaal gesloten |

## Twee uitkomsten

### (A) Binnen de huidige architectuur en scope

**HERSTEL**

| Functie | Kosten | Bouwt op | Stand |
|---|---|---|---|
| H1 Overdracht op persoonssleutel, niet op een stuk naam | klein | `kern/rtgone.js` overdrachtMaak | open (workos.md par. 9) |
| H2 Auditspoor zonder afkappen op 500 | middel | `kern/auditboek/` | open (workos.md par. 9) |
| H3 Rol alleen op een bestaande kantoormedewerker | klein | `kern/rtgone-bestuur.js` rolGeef | open, nieuw gevonden |
| H4 "Niet gemeten" per bron in Vandaag | klein | `kern/rtgone-vandaag.js`, patroon `kern/partnernetwerk.js` | open |
| H5 Frictie als schatting met klasse `advies` | klein | `kern/fiscaal/zekerheid.js` | open |
| H6 Oudere beloften en intenties terugvinden (geen 60/80/30-knip op het scherm) | klein | `kern/rtgone.js` state | open, nieuw gevonden |
| H7 BEVOEGD-telling voor `/api/rtgone/*` | klein | `scripts/bevoegdronde.js` | open |
| Opgeleverd project valt niet terug; goedgekeurd besluit blijft gelden (gedeelde kern `rtgone-projecten.js`) | klein | `kern/rtgone-projecten.js` | gerepareerd (commit 1fc43c1, `test/rtgone.test.js` toets 8) |

**VERDIEPING**

| Functie | Kosten | Bouwt op |
|---|---|---|
| V1 Belofte afronden, heropenen en intrekken met reden; herstel alleen als het doel ongewijzigd is | klein | `kern/rtgone.js`, bestaande status `open`/`afgerond` |
| V2 Overdracht die het eigendom verplaatst (`waarnemerKey`), door de vervanger wordt aanvaard en op `geldigTot` teruggaat | middel | `kern/rtgone.js`, `rtgone-idem.js` |
| V3 Deadlineklok in Vandaag (Europe/Amsterdam) | klein | `kern/rtgone-vandaag.js`, `kern/tijdzone.js` |
| V4 Rol met einddatum, reden en historie | klein | `kern/rtgone-bestuur.js`, patroon `bedrijf/rollen.js` |
| V5 Nakoming op tijd per huis, vanaf tien beloften, nooit per persoon | klein | `afgerondAt` en `deadline` op beloften |
| V6 Frictieregister per huis en frictie als onderbouwing in een besluitvoorstel | klein | `stats.frictieEuro`, `goedkeuringMaak` |
| V7 Archief voor intenties en overdrachten | klein | `db.data.rtgOne` |

**Later:** persoonlijke export, uitdienst-overdracht via employment, gevolg van
een overdracht vooraf, belofte zichtbaar voor het lid, bewaarklasse per object
(middel elk; `kern/concern/employment.js`, `kern/stuur/gevolg.js`, RT Mail).

### (B) Het uiteindelijke domeinmaximum, ook buiten de huidige scope

Richting en geen toezegging. Wat hieronder een nieuw domein of een externe
koppeling vraagt, staat als besluit.

**Proces 1. De dienstverlening van een ledenorganisatie, van belofte tot nakoming.**
- Stappen: een lid vraagt iets (mail, conciërge, Mall) → een medewerker belooft
  een uitkomst met een termijn → het werk loopt over meerdere afdelingen →
  overdracht bij verlof → nakoming met bewijs → het lid ziet de nakoming →
  de organisatie meet hoeveel beloften op tijd zijn nagekomen.
- Rollen en organisaties: lid, medewerker, leidinggevende, partnerzaak, RTG en RTF.
- Apps en eigenaar: RT Mail (bron), Concierge (de wens), RTG One (de belofte,
  eigenaar), Project Room (uitvoering), Decision Room (besluit), Partner Network
  (het deel van de zaak).
- Buiten scope: een gedeelde servicenorm per pas (bijvoorbeeld een antwoordtermijn
  die het lid ziet) is een eigenaarsbesluit, omdat het de passen raakt (PRIJZEN.md).

**Proces 2. In dienst, wisselen en uit dienst bij RTG en RTF zelf.**
- Stappen: uitnodiging op naam → kantoorrol en passkey → rollen per huis →
  beloften en projecten → rolwissel of verlof met overdracht → uitdienst:
  rollen eindigen, beloften gaan over, kantoorsessies sluiten, gegevens volgen de
  bewaarklasse.
- Rollen en organisaties: eigenaar, people-rol, leidinggevende, medewerker.
- Apps en eigenaar: Werk (`os:werk`, de deur), RTG One (werkgeheugen), dienstverband
  (`kern/concern/employment.js`), Loonstrook (loon). Eigenaar van de werkrelatie is
  employment (ARBEID.md par. 7a).
- Buiten scope: de naad aanname → employment → contract → loon (familiebesluit 3).

**Proces 3. Continuïteit en incidenten van de organisatie.**
- Stappen: risico benoemen → BIA per proces → uitwijkplan → incident → meldklok
  (AVG 72 uur; Cbw 24 uur/72 uur/1 maand als RTG eronder valt; beide te
  controleren) → herstel → evaluatie.
- Rollen: security, privacy, executive, auditor.
- Apps: RTG One (beloften met harde klok), Decision Room (het besluit), Werk OS
  (`bedrijf/uitval.js`, `gevolg.js` voor ondernemers).
- Buiten scope: een risicoregister en BCP-object bestaan niet; dat is een nieuw
  domein en dus een besluit.

## Vraagt besluit

1. **Mag een lid een belofte van RTG aan hem zelf zien?**
   - (A, aanbevolen) Ja, per belofte gekozen door de medewerker, als projectie in
     het postvak van het lid. RTG One blijft eigenaar. Kosten: middel.
   - (B) Nee, beloften blijven intern. Kosten: geen; het lid ziet alleen de mail.
   - (C) Altijd zichtbaar. Kosten: middel; risico dat interne afwegingen naar buiten gaan.
2. **Bewaartermijn van het werkgeheugen.**
   - (A, aanbevolen) Eerst de termijn juridisch laten vaststellen (signaal nu:
     2 jaar na afsluiten, te controleren); tot dan wordt niets gewist en blijft
     de audit volledig. Kosten: middel.
   - (B) Onbeperkt bewaren. Kosten: geen; strijdig met "niet langer dan nodig".
   - (C) De audit blijft op 500 regels afkappen. Kosten: geen; het spoor is niet volledig.
3. **Rollen in RTG One en in Werk OS.** RTG One heeft een eigen rollencatalogus
   naast `server/bedrijf/rollen.js`.
   - (A, aanbevolen) Laten zoals het is: RTG intern is een andere organisatie dan
     een werkruimte. Alleen het patroon (einddatum, reden) overnemen. Kosten: klein.
   - (B) RTG wordt een werkruimte in Werk OS. Kosten: groot; raakt officeAuth en de boardroom.
4. **Overdracht: kopie of eigendom?**
   - (A, aanbevolen) Waarneming: de vervanger krijgt `waarnemerKey` naast de
     eigenaar en aanvaardt; op `geldigTot` vervalt dat vanzelf. Kosten: middel.
   - (B) Volledige eigendomsoverdracht zonder terugkeer. Kosten: klein; bij
     verlof moet alles met de hand terug.
   - (C) Kopie blijven (nu). Kosten: geen; niemand is echt verantwoordelijk.
