# Domeinkaart FoundationOS

*Beyond Premium, eigenaarsbesluiten van 19 oktober 2026. Geschreven door de
FoundationOS-agent op 19 oktober 2026, gemeten op de integratietak.*

Dit is een kaart en geen bouwopdracht. Een functie wordt pas werk als de
eigenaar haar per familie toezegt (besluit 4). Daarom staat er per app een
voorstel in drie bakken, en geen planning.

## Wat voor alle apps geldt

**Het werkwoord.** `FOUNDATION.md` par. 2 zegt: openen en klaarzetten,
bevestigen doet de mens. Alles wat een tweede mens of een instantie bereikt, is
één menselijke bevestiging. Daar verandert deze kaart niets aan.

**LOS en SAMEN.** LOS wil zeggen dat elke app hieronder op zijn eigen routes
draait, met een eigen kern en een eigen opslag. SAMEN loopt via verwijzingen en
projecties (een id of een link naar de andere app, de levensgraaf
`server/kern/levensgraaf/graaf.js`, de schil en Heel RTG), nooit via gedeelde
data. "Uitgeeft" is wat een app aan een andere aanbiedt. "Ontvangt" is wat hij
van een andere leest.

**Rollen.** Er zijn zeven rollen:
- *lid*: een eigen RTG-account. Sinds 19 oktober is een gratis account genoeg,
  tenzij er anders staat.
- *gezinsprofiel*: een profiel onder het account van een ouder, via
  gezinCode+gezinToken.
- *kind*: een beschermd profiel. Het opent alleen als RTG het paspoort van de
  ouder heeft gezien.
- *partner, gemeente en ondernemer*: een eigen account plus een code, die bij
  het eerste account hoort dat hem opent.
- *kantoor*: op naam, nooit met de gedeelde code.

Wat elke app per rol mag, staat in zijn eigen sectie. Mijn voltooiproeven
(`scripts/lib/voltooi/*.js`) bewijzen die rechten. De kruisproef is daar telkens
een ander account of een ander gezin.

**Huisregels die elke "Aanbevolen nu" moet doorstaan.** Geen nieuwe laag en
geen centrale database. Leren is geen wedstrijd. Progressie bestaat alleen voor
18+ (`progressieMag`). De beschermingsdeur blijft open. Geen verzonnen data, en
de merkregels gelden. Een voorstel dat daarmee botst, staat onder "Niet doen".

**Betaalmuurlijst.** Per app staan 2 à 3 marktleiders met de bron en de datum
van het zoekresultaat. Geen enkele pagina kon in deze sessie worden geopend: de
proxy liet alleen de zoekdienst door. De functies komen uit het zoekresultaat
en moeten worden nagelezen voordat een functie wordt toegezegd. De kolom "wij" zegt per kernfunctie: **ja**, **half**
of **nee**. Alleen wat de bron zelf zegt, staat erin.

**Kosten.** *Klein* is een paar dagen binnen één app en zijn bestaande kern.
*Middel* is meerdere routes of een tweede app als bron. *Groot* is een nieuw
domein of een eigenaarsbesluit vooraf.

---

## 1. Buurtruil — `link:buurtruil`, `/apps/foundation/buurtruil.html`

**Doel.** Spullen binnen de eigen RTF-stad weggeven of zoeken, zonder geld en
zonder dat er een bericht vertrekt.

**Wat er al is.** Kern `server/kern/rtfos/ruil.js`, met routes
`/api/rtfos/ruil/{lijst,mijn,plaats,sluit,interesse,meld}`.
- Geven en zoeken, met belangstelling op codenaam: wie tien keer klikt, telt één
  keer.
- Een melding verbergt pas na twee verschillende melders, en oordeelt niet.
- Een herhaalsleutel per aanbod, met 409 bij een andere titel.
- De voltooiproef sluit (7/3/4/3). Een stad bestaat pas als het landelijk
  bestuur haar opent.

**Objecten en eigenaar.** Een *aanbod* (geef of zoek, titel, staat, stad) is van
het lid dat het plaatst. *Belangstelling* en *melding* hangen aan het aanbod.
De *stad* is van het kantoor. Capability `gemeenschap.buurtruil`.

**Handelingen, van begin tot herstel.** Stad kiezen → plaatsen → een buur toont
belangstelling → de eigenaar ziet wie → sluiten als het weg is. Bij herstel:
- een dubbele tik geeft één aanbod;
- een afgebroken plaatsing en daarna opnieuw geeft er ook één;
- een melding verbergt, en het kantoor beslist.

**Rechten en rollen.**
- *Lid* (gratis account): plaatsen, belangstelling tonen, melden.
- Alleen de *eigenaar* sluit zijn eigen aanbod.
- *Kind en gezinsprofiel*: geen toegang; dit is de enige RTF-deur op een
  ledensessie.
- *Kantoor*: steden openen en meldingen behandelen.

**LOS en SAMEN.**
- LOS: de app werkt volledig.
- SAMEN, uitgeeft: aanbod-ids aan Heel RTG en de stadspagina (RTF Buurt).
- SAMEN, ontvangt: de open steden uit `rtfos`.
- Keten: belangstelling → een klaargezet bericht in Berichten, dat de mens zelf
  verstuurt.

**Betaalmuurlijst.**

| kernfunctie | bij | wij |
|---|---|---|
| geven, vragen en bedanken | Buy Nothing | half: geven/zoeken ja, bedanken nee |
| belangstelling bijhouden en ontvanger kiezen | Buy Nothing | ja |
| groepen per buurt | Buy Nothing | half: per stad, niet per wijk |
| geverifieerde deelnemers | Nextdoor | ja: account, gratis is genoeg |

Bronnen: Buy Nothing https://buynothingproject.org/mobile-app; Nextdoor For Sale & Free https://nextdoor.com/for_sale_and_free/. Bron via zoekresultaat op 2026-10-19, pagina zelf niet geopend (de proxy liet alleen de zoekdienst door). Te controleren vóór toezegging.

**Beyond.** Een ruil die aantoonbaar niets kost en niets bewaart wat niet
nodig is: geen locatie op het adres, alleen de stad. "Weg" staat in de
geschiedenis van het ding, niet van de mens.

**Voorstel.**
- *Aanbevolen nu*:
  - een foto bij het aanbod, binnen het bestaande beeldbeleid (klein);
  - een klaargezet bericht aan de eigenaar bij belangstelling, verzonden door
    de mens (klein);
  - een "gereserveerd"-stand tussen open en weg (klein).
- *Later*:
  - wijk binnen de stad, afgeleid uit de stad en nooit uit een adres (middel);
  - een ophaalafspraak via de Agenda-projectie (middel).
- *Niet doen, en waarom*:
  - een kaart met precieze locaties: dat zet een adres op een codenaam;
  - een ranglijst van gevers: wie meer geeft, is geen betere buur;
  - geld of punten: dan is het geen ruil meer, maar handel.

**Extern.** Geen.

---

## 2. Geven — `link:geven`, `/apps/foundation/geven.html`

**Doel.** Een gift aan de RTFoundation: eenmalig, geoormerkt voor een project,
of periodiek met een machtiging.

**Wat er al is.** Routes `/api/rtfos/gift/{stand,voorbereid,bevestig,projecten,plan/*,machtiging/*}`.
- Een gift loopt via RTG Pay, met een herhaalsleutel. Daarna wordt het een bron
  in de Foundation (`geld-bron.js`, één bron per sleutel).
- Een periodiek plan is eerst een voorstel, en wordt pas met een machtiging een
  plan.
- De stand (open, dicht, welke vormen) zet het kantoor.
- De voltooiproef sluit (8/3/4/3), op een gratis account met een gekeurd
  paspoort. Opladen vraagt sinds vandaag een paspoort, ook op een gratis
  account.

**Objecten en eigenaar.** *Gift* en *plan* zijn van de gever (op codenaam). De
*machtiging* is van de gever en herroepbaar. Het *project* is van de stad en het
kantoor. De *bron* is van de Foundation-boekhouding. Capability `geven.doneren`.

**Handelingen, van begin tot herstel.** Project kiezen → voorbereiden →
bevestigen (de mens) → betaald → zichtbaar in RTG Pay. Periodiek: een voorstel,
dan tekenen, en intrekken. Bij herstel:
- een dubbele bevestiging geeft één gift;
- een geweigerde bijlading laat niets af gaan;
- een machtiging intrekken stopt het plan.

**Rechten en rollen.**
- *Lid*: geven, met een wallet en een gebonden toestel.
- *Kind*: kan niet bevestigen (401 met zijn gezinssessie).
- *Kantoor*: de stand zetten en projecten openen. Het kantoor ziet geen gever
  op naam.

**LOS en SAMEN.**
- SAMEN, uitgeeft: een giftregel aan RTG Pay en een bron aan de
  projectbegroting.
- SAMEN, ontvangt: projecten uit `rtfos` en vanuit Klimaatfonds het project dat
  al gekozen is.
- Keten: Klimaatfonds → Geven → RTG Pay → projectbron.

**Betaalmuurlijst.**

| kernfunctie | bij | wij |
|---|---|---|
| eenmalig en terugkerend geven | Givebutter, JustGiving | ja |
| donor beheert of stopt zelf zijn terugkerende gift | Givebutter, JustGiving | ja: machtiging intrekken |
| rapportage en export per campagne | Givebutter, JustGiving | nee |
| fiscale verwerking (Gift Aid, ANBI) | JustGiving, Geef.nl | nee |
| actiepagina die iemand zelf start | Geef.nl | nee |

Bronnen: Givebutter https://givebutter.com/features/recurring-donations; JustGiving https://help.justgiving.com/hc/en-us/articles/9178854870033-Monthly-donations-to-a-Fundraising-page-UK-only; Geef.nl https://www.geef.nl/nl/page/faq-actievoeren. Bron via zoekresultaat op 2026-10-19, pagina zelf niet geopend (de proxy liet alleen de zoekdienst door). Te controleren vóór toezegging.

**Beyond.** Een gift die je kunt volgen tot waar hij landt: het project, de
bron en de besteding. Altijd een meting en nooit een belofte (FOUNDATION par.
5.7, Proof-of-Service).

**Voorstel.**
- *Aanbevolen nu*:
  - een giftbewijs per jaar als download, voor de belastingaangifte. Als
    uitkomst is dat *advies* of *bepaald* volgens de fiscale klassen, nooit
    stilzwijgend (middel);
  - "waar is mijn gift gebleven": het projectspoor van de bron (middel).
- *Later*:
  - geven in naam van een gezin, met bevestiging door de ouder (middel);
  - matchgifts van een onderneming via RTF Portaal (groot, eigenaarsbesluit).
- *Niet doen, en waarom*:
  - een ranglijst of badges van gevers: dat is progressie, en een gift is geen
    wedstrijd;
  - dringende aftellers: dat is kunstmatige urgentie;
  - giften van kinderen: geld verlaat het huis alleen door een volwassene.

**Extern.** De bank of de betaalprovider achter RTG Pay. Daarnaast de ANBI-status
en de fiscale regels: een besluit van de eigenaar, met een fiscalist.

---

## 3. Klimaatfonds — `link:klimaat`, `/apps/foundation/klimaatfonds.html`

**Doel.** Als bewoner zien welke duurzaamheidsprojecten er in de stad lopen en
erheen geven. Daarnaast in het Living Lab een vraag stellen, die van een ander
steunen en zien welk onderzoek eruit volgt.

**Wat er al is.**
- Projecten van soort `duurzaam` uit `/api/rtfos/gift/projecten`, dezelfde
  lijst als bij Geven.
- Living Lab-routes `/api/lab2/bewoner/{labs,themas,thema,stem,overzicht}`.
  Sinds 19 oktober vragen ze een account of gezinsprofiel, en hangt een stem aan
  het account en niet aan de alias (een andere alias geeft 409).
- Studies met stappen, die het kantoor maakt.
- De voltooiproef sluit (8/3/4/3).

**Objecten en eigenaar.**
- *Thema* (vraag): van de bewoner.
- *Stem*: van het account, één per thema.
- *Lab* en *studie*: van het kantoor en de onderzoekers.
- *Project*: van de stad.

Capability `gemeenschap.klimaatfonds`.

**Handelingen, van begin tot herstel.** Lezen → vraag stellen → steunen → het
onderzoek volgen → geven aan het project. Bij herstel: een dubbele vraag geeft
één thema, een dubbele stem geeft er één, en een crash na een stem verliest
hem niet.

**Rechten en rollen.**
- *Lid*: alles hierboven.
- *Gezinsprofiel*: lezen en stemmen onder het account van de ouder.
- *Kind*: de projectenlijst gaat niet open.
- *Kantoor*: labs en studies.

**LOS en SAMEN.**
- SAMEN, uitgeeft: een thema-id aan het Living Lab en een project-id aan Geven.
- SAMEN, ontvangt: studies uit `lab2` en projecten uit `rtfos`.
- Keten: vraag → studie → project → gift.

**Betaalmuurlijst.**

| kernfunctie | bij | wij |
|---|---|---|
| burgerbegroting: stemmen door budget te verdelen | Decidim Budgets | nee: stemmen per thema, geen budget |
| instelbare stemregels | Decidim Budgets | nee |
| verificatie voor deelname | Decidim Budgets | ja: account, stem per account |
| projecten financieren | Ecosia (bomen) | ja: via Geven |

Bronnen: Decidim https://docs.decidim.org/en/develop/admin/components/budgets.html; Ecosia https://www.ecosia.org/ (ioby.org meldt volgens het zoekresultaat dat het gesloten is, en telt niet mee). Bron via zoekresultaat op 2026-10-19, pagina zelf niet geopend (de proxy liet alleen de zoekdienst door). Te controleren vóór toezegging.

**Beyond.** Een vraag van een bewoner die zichtbaar een onderzoek wordt, met de
reden waarom wel of niet. Dezelfde terugkoppeling die DemocratieOS bij een
kwestie geeft.

**Voorstel.**
- *Aanbevolen nu*:
  - "wat werd er van mijn vraag": de stand van het thema in `mijn`, met reden
    (klein);
  - de gemeten opbrengst van een project, alleen als er gemeten is: anders
    staat er "niet gemeten" en geen nul (middel).
- *Later*:
  - een buurtbegroting waarop bewoners stemmen (groot, eigenaarsbesluit;
    stemmen per account staat er al);
  - een CO2-schatting met marge per project (middel).
- *Niet doen, en waarom*:
  - een klimaatscore per huishouden: een cijfer op een mens;
  - offsets verkopen: dan is het geen fonds meer, maar handel in claims.

**Extern.** Optioneel: de open data van de gemeente over energie. Een
onderzoekspartner levert de studies.

---

## 4. Library — `link:library`, `/apps/library.html`

**Doel.** Foundation LibraryOS. Een kennis- en publicatieplatform waar een maker
werkt aan een intellectueel werk (inhoud, bijdragen, afspraken, rechten en een
vaste editie), en waar een lezer die editie leest.

**Wat er al is.** Kernel v1 en Studio/Reader (`LIBRARYOS.md`,
`LIBRARYOS-STUDIO-READER.md`, `server/kern/library/*`).
- Objecten: Work, ContentNode met een append-only rij revisies, Contribution,
  WorkAgreement, RightsGrant, Edition (freeze met snapshots en hashes) en
  PublicationRelease.
- Feedback van zes soorten (correctie, helderheid, vertaling, toegankelijkheid,
  bron, overig), met create, decide en resolve.
- Reader: openen, bladwijzer, notitie, voortgang, zoeken.
- Een onderwijsvrijgave (`education.js`).
- De voltooiproef sluit (8/3/4/3).

**Objecten en eigenaar.** Het *Work* is van de verantwoordelijke partij (een
maker of een Concern-entiteit). De Foundation krijgt geen eigendom en geen
vetorecht. *Edition* en *Release* zijn van de publisher volgens de afspraak.
*Notities* en *voortgang* zijn van de lezer. Capability `library.werk`.

**Handelingen, van begin tot herstel.** Werk maken → revisies toevoegen →
bijdragers uitnodigen → afspraak voorstellen en aanvaarden → rechten verlenen →
editie bevriezen → publicatie bekijken → instemmen → bevestigen → lezen →
feedback → besluit. Bij herstel: een bevroren editie verandert nooit; nieuwe
inhoud is een nieuwe editie. Intrekken verandert de beschikbaarheid, niet de
inhoud. Er is geen bevestiging vóór een duurzame commit.

**Rechten en rollen.** Verantwoordelijke, editor, bijdrager en
rechtenverklaarder volgen de afspraak. Credit is geen bewerkrecht. Een *lid*
leest en geeft feedback. Een *kind* leest vrijgegeven onderwijsedities.

**LOS en SAMEN.**
- SAMEN, uitgeeft: een editie-ref aan School/Leren (onderwijsvrijgave) en het
  auteurschap aan Connect (par. 2a: "auteurschap wordt geconsumeerd").
- SAMEN, ontvangt: identiteit en organisatie uit Accounts en Concern.

**Betaalmuurlijst.**

| kernfunctie | bij | wij |
|---|---|---|
| persistente identifier (DOI) per versie | Zenodo | nee |
| licentie per record | Zenodo | half: RightsGrant, geen standaardlicenties |
| gecureerde collecties (communities) | Zenodo | nee |
| versies, citeerbaar per versie | Zenodo | ja: Edition met hash |
| open peer review met toewijzing en conflictregistratie | OpenReview | half: feedback met besluit, geen reviewronde |

Bronnen: Zenodo https://developers.zenodo.org/; OpenReview https://openreview.net/about. Bron via zoekresultaat op 2026-10-19, pagina zelf niet geopend (de proxy liet alleen de zoekdienst door). Te controleren vóór toezegging.

**Beyond.** Een werk waarvan je kunt bewijzen wie wat bijdroeg, onder welke
afspraak en met welke rechten, zonder dat de Foundation het bezit. De
snapshothash maakt een citaat controleerbaar.

**Voorstel.** De eigenaar noemde collecties, licenties, peerreview en
archivering.
- *Aanbevolen nu*:
  - *collecties*: een lijst van edities, van de maker of de lezer (klein);
  - *licenties*: standaardlicenties als keuze in RightsGrant, met een CC-familie
    als sjabloon. De verklaring blijft een verklaring en geen titel (middel).
- *Later*:
  - *peerreview*: een reviewronde als afspraaktype, met reviewers op naam en de
    keuze open of blind, gebouwd op feedback.decide (groot);
  - *archivering*: een exporteerbaar archiefpakket per editie (inhoud,
    manifest, hashes) en een persistente identifier (middel; een DOI is
    extern).
- *Niet doen, en waarom*:
  - citatietellingen of een impactscore op een auteur: dat is een rangschikking
    van mensen;
  - AI die auteurschap toekent: credit is een afspraak tussen mensen.

**Extern.** Een DOI-registrar (DataCite of Crossref) voor archivering. De
licentieteksten (Creative Commons).

---

## 5. Connect — `link:connect`, `/apps/connect.html`

**Doel.** Het ontdeknetwerk van FoundationOS (`CONNECT.md`). Iets ontdekken,
leren, maken of doorgeven, binnen je kring en je horizon.

**Wat er al is.** Twee deuren: een ledendeur (`/api/connect/*`) en een gezinsdeur
(`/api/rtf/connect/*`), elk met `ontdek, open, werk, dossier, portfolio,
horizon, schuif, signaal`. Daaronder:
- Acht werkwoorden, waarvan er drie een tweede mens raken. Die vragen
  bevestiging (`bevestigtEenMens`).
- Een mixer met drie van de acht motoren aangesloten.
- Een leerdossier met tien treden.
- Een naklank: zes gevolgen, zonder een totaal.
- Kring als poort en horizon als schuif. "Meer hiervan" draagt een herhaalsleutel.
- De lus sluit (17 schakels), en de voltooiproef sluit (8/3/5/3).

**Objecten en eigenaar.** Het *werk* is van de maker, met herkomst uit het
domein (clips, library). Het *dossier* en het *portfolio* zijn van de leerling.
De *horizon* en de *signalen* zijn van het lid of gezinsprofiel. Capability
`ontdekken.connect`.

**Handelingen, van begin tot herstel.** Ontdekken → openen → "meer hiervan" of
"minder" → werken → het dossier groeit → het portfolio kiest wat zichtbaar is.
Bij herstel: dubbele signalen tellen één keer, en de horizon is terug te
schuiven.

**Rechten en rollen.**
- *Lid* en *gezinsprofiel*: elk via hun eigen deur.
- *Kind*: het leerdossier, onder de vier voorwaarden van FOUNDATION par. 5.5.
- *Ander gezin*: 403 of 404.

**LOS en SAMEN.**
- SAMEN, uitgeeft: dossierregels aan School, en naklank aan de maker.
- SAMEN, ontvangt: werk en herkomst uit Clips, MediaOS en Library, en leerstof
  uit School.

**Betaalmuurlijst.**

| kernfunctie | bij | wij |
|---|---|---|
| buurt- of groepsgebonden netwerk | Hoplr, WhatsApp Communities | half: kring en horizon, geen buurtgroep |
| lenen en weggeven | Hoplr | ja: via Buurtruil |
| aankondigingen door beheerders | WhatsApp Communities | nee |
| overheid leest geen gesprekken | Hoplr | ja: geen gemeente in Connect |

Bronnen: Hoplr https://www.hoplr.com/; WhatsApp Communities https://faq.whatsapp.com/438859978317289/. Bron via zoekresultaat op 2026-10-19, pagina zelf niet geopend (de proxy liet alleen de zoekdienst door). Te controleren vóór toezegging.

**Beyond.** Ontdekken zonder engagementfeed: de sessie mag ophouden (`CONNECT.md`
par. 6), en wat je deed, telt als bewijs en niet als score.

**Voorstel.**
- *Aanbevolen nu*:
  - de vijf motoren die nu "kijken niet" melden, één voor één aansluiten (middel
    per motor);
  - Doe, Samen en Maak als eigen ingangen: een besluit dat openstaat in
    CONNECT par. 9 (klein na het besluit).
- *Later*: mentoren, alleen via de kring en met bevestiging (groot).
- *Niet doen, en waarom*:
  - de vijf werkwoorden in `NIET_GEBOUWD` (beoordeel, rangschik, beloon,
    voorspel, meet);
  - oneindig scrollen;
  - live en AR: jaren weg, en zonder grens.

**Extern.** Geen.

---

## 6. RTF Buurt — `link:rtfbuurt`, `/apps/foundation/os-publiek.html`

**Doel.** Zien wat de RTFoundation in de eigen stad doet: projecten, campagnes,
waar je terechtkunt voor hulp, en vrijwilligerswerk.

**Wat er al is.** Routes `/api/rtfos/publiek/{steden,stad,campagnes}`. Sinds 19
oktober vragen ze een sessie: lid, zaak, kantoor of gezinsprofiel
(`kern/elkesessie.js`). De app leest alleen. De voltooiproef sluit (7/3/3/3).
Let op: SCHERMEIGENAAR noemt nog "zonder in te loggen". Dat is achterhaald door
het besluit en moet in het register mee.

**Objecten en eigenaar.** *Stad*, *project* en *campagne* zijn van het kantoor
en de stad. Capability `wereld.foundation`.

**Handelingen.** Een stad kiezen → projecten, maaltijden en campagnes lezen →
doorklikken naar Geven, Buurtruil of hulp. Herstel: een dubbele tik, een
afgebroken verzoek of een crash geven hetzelfde beeld en schrijven niets.

**Rechten en rollen.** Elke bekende sessie leest. Zonder sessie: 401.

**LOS en SAMEN.**
- SAMEN, uitgeeft: links naar Geven, Buurtruil, Klimaatfonds en de
  beschermingsdeur.
- SAMEN, ontvangt: alles uit `rtfos`.

**Betaalmuurlijst.**

| kernfunctie | bij | wij |
|---|---|---|
| pagina per stad of servicegebied | Nextdoor Public Agency | ja |
| peilingen en snelpeilingen | Hoplr, Nextdoor | nee: wel stemmen in het Living Lab |
| noodalerts | Nextdoor | nee |
| oproep voor vrijwilligers | Hoplr | nee |

Bronnen: Nextdoor https://business.nextdoor.com/en-us/public-agency; Hoplr https://services.hoplr.com/. Bron via zoekresultaat op 2026-10-19, pagina zelf niet geopend (de proxy liet alleen de zoekdienst door). Te controleren vóór toezegging.

**Beyond.** Een stadspagina die alleen getelde feiten toont, met "niet gemeten"
waar niet gemeten is, en de hulpdeur altijd bovenaan.

**Voorstel.**
- *Aanbevolen nu*:
  - de beschermingsdeur zichtbaar op elke stadspagina (klein);
  - een agenda van activiteiten uit de projecten, als projectie (middel).
- *Later*: vrijwilligersaanbod met aanmelden via een account (middel; de rol loopt
  via `CONCERN.md`).
- *Niet doen, en waarom*:
  - een openbare pagina zonder account: botst met het besluit, behalve de
    landing en de beschermingsdeur;
  - een buurtfeed met reacties: dat is een engagementfeed.

**Extern.** Geen.

---

## 7. RTF Portaal — `link:rtfportaal`, `/apps/foundation/os-portaal.html`

**Doel.** Een partnerstichting, gemeente of lokale ondernemer opent met de code
van het RTF-kantoor zijn eigen dossier.

**Wat er al is.** Routes `/api/rtfos/portaal/{partner,gemeente,ondernemer}`.
- Een account plus een code. De code hoort bij het eerste account dat hem opent
  (`kern/codekoppel.js`); een ander account krijgt 404.
- Een *partner* ziet afspraken (geld, vrijwilligers, persoonsgegevens,
  aansprakelijkheid, rapportage) en projecten.
- Een *gemeente* ziet alleen getelde cijfers, met "niet gemeten" als niet
  gemeten.
- Een *ondernemer* ziet zijn aanbod en wat het deed.
- De voltooiproef sluit (8/3/3/3).

**Objecten en eigenaar.** *Partnerdossier*, *gemeentedossier* en
*ondernemersdossier* zijn van het kantoor. De *code* is van het kantoor en
gekoppeld aan één account. Capability `portaal.toegang`.

**Handelingen.** Code ontvangen → inloggen → openen → lezen. Een wijziging van
het kantoor is meteen zichtbaar. Herstel: alleen lezen; er wordt niets
geschreven.

**Rechten en rollen.** Elke code opent precies één dossier van één soort. Het
gemeenteportaal draagt geen naam, codenaam of dossier. Het partnerportaal
draagt geen IBAN of KvK.

**LOS en SAMEN.**
- SAMEN, ontvangt: projecten en impact uit `rtfos`, en het ondernemersaanbod.
- SAMEN, uitgeeft: niets.
- Ketens: een ondernemersaanbod → benut in een project. Een partner →
  rapportage.

**Betaalmuurlijst.**

| kernfunctie | bij | wij |
|---|---|---|
| eigen profiel van de organisatie | Benevity | nee: het kantoor beheert het dossier |
| status van aanvragen in een dashboard | Benevity, Submittable | half: dossierstand, geen aanvraagstroom |
| rapportage over uitbetalingen of impact | Benevity, Submittable | half: getelde cijfers, geen download |
| meldingen bij vereiste acties | Benevity | nee |

Bronnen: Benevity https://benevity.com/nonprofits; Submittable https://www.submittable.com/solutions/grants. Bron via zoekresultaat op 2026-10-19, pagina zelf niet geopend (de proxy liet alleen de zoekdienst door). Te controleren vóór toezegging.

**Beyond.** Een gemeente krijgt nooit een persoon te zien, en dat is te
bewijzen. Het portaal draagt alleen tellingen, en de toets laat zakken als er
een naam in komt.

**Voorstel.**
- *Aanbevolen nu*:
  - een periodieke rapportage als download (pdf), uit dezelfde tellingen (middel);
  - een partner kan een wijziging van de afspraak *voorstellen*, en het kantoor
    beslist (middel).
- *Later*:
  - meerdere mensen per partnerorganisatie via Concern-rollen, in plaats van
    één gekoppeld account (groot);
  - een ondernemer meldt zelf aanbod aan, met beoordeling (middel).
- *Niet doen, en waarom*:
  - een gemeente die individuele dossiers ziet: dat botst met LEVEN 2.6
    (alleen geaggregeerd);
  - een openbare impactranglijst van partners.

**Extern.** Optioneel de subsidiesystemen van een gemeente. Alleen als een
klaargezette export, nooit als koppeling die zelf indient.

---

## 8. RTF Bord — `link:rtfbord`, `/apps/foundation/bord.html`

**Doel.** Als begeleider tijdens een live les een digitaal schoolbord tekenen,
opgaven en agenda klaarzetten, en schriften lezen.

**Wat er al is.**
- `/api/foundation/les/maak`: een account is verplicht. De begeleider krijgt een
  docentensleutel en een lescode.
- Streken en terugnemen (bord/stroke en bord/undo) en het bord wissen.
- Opgaven, agenda en agenda verwijderen, elk met een herhaalsleutel en 409 bij
  een andere inhoud.
- Een nieuwe lescode maken; de oude opent dan niets meer.
- Schriften lezen, en een live stroom (SSE).
- De voltooiproef sluit (8/3/4/3).

**Objecten en eigenaar.** *Les*, *bord*, *opgave* en *agenda* zijn van de
begeleider. *Inzendingen* zijn van de leerling en leesbaar voor de begeleider.
Capability `rtf.bord`.

**Handelingen.** Les maken → code delen → tekenen → opgave zetten → inzendingen
lezen → schrift lezen → code vernieuwen. Herstel: een dubbele tik geeft één
opgave, en na een afgebroken verzoek gevolgd door een nieuwe poging staat de
opgave er ook één keer.

**Rechten en rollen.**
- *Begeleider*: een account plus de docentensleutel.
- *Leerling*: alleen lezen op het bord.
- Zonder sleutel: 403. Een andere les komt er niet in.

**LOS en SAMEN.**
- SAMEN, uitgeeft: de lescode aan Schrift, en opgaven aan het leerdossier
  (Connect en School).
- SAMEN, ontvangt: onderwijsedities uit Library.

**Betaalmuurlijst.**

| kernfunctie | bij | wij |
|---|---|---|
| meedoen met een klascode | Google Classroom | ja: lescode, te vernieuwen |
| tekenen op een gedeeld bord | Nearpod, Miro | ja |
| opdrachten met deadline, inleveren en teruggeven | Google Classroom | half: opgave en inleveren, geen deadline of teruggeven |
| widgets: timer, naamkiezer, poll | Classroomscreen | nee |
| bord opslaan en delen | Classroomscreen (Pro) | nee |

Bronnen: Google Classroom https://support.google.com/edu/classroom/answer/15605102; Classroomscreen https://classroomscreen.com/; Nearpod https://nearpod.com/formative-assessment; Miro https://help.miro.com/hc/en-us/articles/360017730473-Education-plan. Bron via zoekresultaat op 2026-10-19, pagina zelf niet geopend (de proxy liet alleen de zoekdienst door). Te controleren vóór toezegging.

**Beyond.** Een les waarin niemand een cijfer krijgt van het systeem: inleveren
is werk, geen score.

**Voorstel.**
- *Aanbevolen nu*:
  - een Library-editie als werkblad op het bord openen (middel);
  - het bord als pdf bewaren aan het eind van de les, voor de begeleider
    (klein);
  - vormen, tekst en wissen per streek (klein).
- *Later*: groepjes (breakouts) binnen een les (groot); geplande lessen via de
  Agenda-projectie (middel).
- *Niet doen, en waarom*:
  - een klassement, punten of een leaderboard: leren is geen wedstrijd;
  - aandachtmeting van leerlingen: dat is surveillance.

**Extern.** Geen.

---

## 9. RTF Schrift — `link:rtfschrift`, `/apps/foundation/schrift.html`

**Doel.** Als leerling meedoen met een les, het bord, de opgaven en de agenda
zien, schrijven in een eigen schrift, inleveren en de bijleshulp vragen.

**Wat er al is.**
- Meedoen met `/api/foundation/les/join`, met een account of een gezinsprofiel.
- Een schrift met tekst- en tekenbladzijden (schrift/opslaan).
- Inleveren (opgave/inleveren).
- Een bijleshulp (`/api/foundation/ai`). Zonder model geeft die een vaste
  terugval.
- De tip van de dag.
- De voltooiproef sluit (8/3/4/3).

**Objecten en eigenaar.** Het *schrift* en de *inzending* zijn van de leerling.
De begeleider leest ze. Capability `leren.livesles`.

**Handelingen.** Meedoen → lezen → schrijven → inleveren → hulp vragen. Herstel:
een dubbele tik op inleveren of opslaan geeft één keer, en na een afgebroken
opslag gevolgd door een nieuwe poging staat alles er één keer.

**Rechten en rollen.**
- *Kind*: via het gezinsprofiel van de ouder.
- Een *klasgenoot* leest alleen zijn eigen schrift.
- Een *leerling van een andere les* komt er niet in.
- Wie uit de les is gehaald, schrijft niet meer.

**LOS en SAMEN.**
- SAMEN, uitgeeft: het schrift aan het leerdossier (Connect en School), alleen
  onder de vier voorwaarden.
- SAMEN, ontvangt: de les van Bord.

**Betaalmuurlijst.**

| kernfunctie | bij | wij |
|---|---|---|
| privéschrift per leerling, docent leest mee | OneNote Class Notebook | ja |
| pagina vergrendelt bij inleveren | OneNote Class Notebook | nee |
| tekenen en tekst, stemopname | Seesaw | half: tekenen en tekst, geen stem |
| portfolio over schooljaren, downloadbaar | Seesaw | nee: het leerdossier bestaat, de export niet |

Bronnen: OneNote https://support.microsoft.com/en-us/education/onenote/class-notebook; Seesaw https://help.seesaw.me/hc/en-us/articles/115001096743-How-students-and-teachers-add-posts-to-Seesaw. Bron via zoekresultaat op 2026-10-19, pagina zelf niet geopend (de proxy liet alleen de zoekdienst door). Te controleren vóór toezegging.

**Beyond.** Het schrift is van het kind en verhuist mee. Het blijft leesbaar
als het van school wisselt (het leerdossier, FOUNDATION par. 5.5).

**Voorstel.**
- *Aanbevolen nu*:
  - het schrift exporteren naar het leerdossier van het kind (middel);
  - de bijleshulp met herkomst: welke les, welke opgave, en nooit het antwoord
    voorzeggen (klein).
- *Later*: handschrift met een pen-toestel (middel); feedback van de begeleider
  per bladzijde (middel).
- *Niet doen, en waarom*:
  - streaks of badges voor het kind: valt onder `progressieMag`;
  - de schriften van klasgenoten vergelijken.

**Extern.** Een AI-model alleen lokaal-eerst (`LOCAL_AI_URL`). Zonder model blijft
het werken.

---

## 10. Vrienden — `link:vrienden`, `/apps/foundation/vrienden.html`

**Doel.** Contacten binnen de RTFoundation vinden via codenaam, ermee chatten
en bellen, of koppelen via QR of PIN, met toezicht van een ouder op de contacten
van een kind.

**Wat er al is.** `/api/rtf/social/*`:
- find, connect, respond, connections;
- dm en dm/send, met een herhaalsleutel per bericht;
- PIN en live koppelen; bellen (ice);
- snaps en stories;
- block en report;
- ouder-toezicht (`toezicht.js`): kind/contacten, goedkeuren, oudervoeg,
  kind/verwijder, kind/boardroom.

De live stroom opent met een eenmalig stroomticket. De voltooiproef sluit
(7/3/5/3).

**Objecten en eigenaar.** Het *contact* (verbinding) is van beide kanten. Een
*bericht* is van de afzender en zichtbaar voor de ontvanger. De *goedkeuring*
van een kindcontact is van de ouder. Capability `rtf.contacten`.

**Handelingen.** Zoeken → verzoek → accepteren (en bij een kind keurt de ouder
goed) → chatten of bellen → blokkeren of melden → verwijderen. Herstel: een
dubbel verzonden bericht staat er één keer. Twee bewust gelijke berichten
blijven mogelijk.

**Rechten en rollen.**
- *Gezinsprofiel*: eigen contacten.
- *Kind*: alleen goedgekeurde contacten.
- *Ouder*: ziet en beheert de contacten van het kind.
- *Gast*: geen stroom.
- *Ander gezin*: niets.

**LOS en SAMEN.**
- SAMEN, uitgeeft: contact-ids aan Connect (de kring).
- SAMEN, ontvangt: koppelingen uit RTG Link.
- Keten: verzoek → goedkeuring door de ouder → contact.

**Betaalmuurlijst.**

| kernfunctie | bij | wij |
|---|---|---|
| ouder keurt contactverzoeken goed | Messenger Kids, JusTalk Kids | ja |
| contactlijst beheren via ouderdashboard | Messenger Kids | ja |
| end-to-end-versleuteling | JusTalk Kids | nee |
| geen telefoonnummer nodig | JusTalk Kids | ja: codenaam en QR/PIN |

Bronnen: Messenger Kids https://messengerkids.com/sr/getting-started/what-is-messenger-kids/; JusTalk Kids https://kids.justalk.com/. Bron via zoekresultaat op 2026-10-19, pagina zelf niet geopend (de proxy liet alleen de zoekdienst door). Te controleren vóór toezegging.

**Beyond.** Een kind heeft geen contact dat de ouder niet heeft gezien, en de
ouder leest zijn berichten niet. Toezicht op wie, niet op wat.

**Voorstel.**
- *Aanbevolen nu*:
  - de leeftijdsgrens van stories en snaps toetsen tegen het beleid. Ik heb dat
    niet gemeten, dus dit is een vraag en geen bevinding (klein);
  - een duidelijke "blokkeer en vertel het je ouder"-knop voor een kind
    (klein).
- *Later*:
  - groepsgesprekken binnen het gezin of de klas (middel);
  - end-to-end-versleuteling van berichten (groot, eigen besluit).
- *Niet doen, en waarom*:
  - een openbaar profiel of zoeken op naam: het zoeken loopt op codenaam en dat
    blijft zo;
  - streaks tussen vrienden: een verslavend patroon;
  - de ouder die berichten leest: toezicht op wie, niet op wat.

**Extern.** Een TURN-server voor bellen (nooit anoniem).

---

## 11. Kwesties / Discussiekamer — `link:kwesties`, `/apps/foundation/kwesties.html`

**Doel.** Een burger brengt een kwestie in en leest de uitkomst met de reden
(DemocratieOS V1). De eigenaar wil dit uitbreiden tot een discussiekamer met
echte mensen en gesimuleerde debatten, met broncontrole.

**Wat er al is.** `server/kern/democratie/*`, een minimale burgerlus (POLITIEK.md
par. 18.1): kwestie → behandeling → eindstand met reden → terugkoppeling.
- Ledenroutes: inbreng, mijn, gezien, intrek. Een gratis account is genoeg.
- Kantoorroutes: lijst, behandel, eindstand, heropen, herbezorg. Allemaal op
  naam, nooit met de gedeelde code.
- Het DoeNetwerk: acties en bijeenkomsten.
- Een partijenregister.
- Elke schrijvende handeling antwoordt pas na een duurzame commit (anders 503).
- Er is al een voltooiscenario (`kwesties.js`), van een andere agent.

**Objecten en eigenaar.** De *kwestie* is van de inbrenger. De *behandeling* en
de *eindstand* zijn van het kantoor, op naam. De *actie* is van de initiatiefnemer.
Capability `democratie.kwestie`.

**Handelingen.** Inbrengen → behandeld → eindstand met reden → terugkoppeling
(lezen in `mijn`, plus een wekker) → gezien → eventueel heropenen. Herstel:
`herbezorg` haalt een gemiste wekker in, en geen kwestie verdwijnt ongemerkt.

**Rechten en rollen.**
- *Lid*: inbrengen en eigen kwesties lezen.
- *Kantoor*: behandelen op naam.
- *Demosessie*: 403.
- *Kind*: niet. Een kwestie draagt vrije tekst en een terugkoppeling op naam.

**LOS en SAMEN.**
- SAMEN, uitgeeft: een eindstand aan Berichten (de wekker).
- SAMEN, ontvangt: partijen uit het register.
- Keten naar Klimaatfonds: een thema kan een kwestie worden. Dat is een besluit.

**Betaalmuurlijst.**

| kernfunctie | bij | wij |
|---|---|---|
| argumentboom met pro en contra | Kialo Edu | nee |
| bronnen bij beweringen | Kialo Edu, Community Notes | nee |
| stemmen op stellingen met opiniegroepen | Pol.is | nee |
| context die pas verschijnt bij brede instemming | Community Notes | nee |
| uitkomst met reden, terug bij de inbrenger | geen van drieën | ja: eindstand met reden en terugkoppeling |

Bronnen: Kialo Edu https://www.kialo-edu.com/features; Pol.is https://pro.pol.is/; Community Notes https://communitynotes.x.com/guide/en/contributing/notes-on-twitter. Bron via zoekresultaat op 2026-10-19, pagina zelf niet geopend (de proxy liet alleen de zoekdienst door). Te controleren vóór toezegging.

**Beyond.** Elke uitkomst draagt een reden en een naam, en een gesimuleerd
debat is zichtbaar gesimuleerd.

**Voorstel.** De eigenaar noemde een discussiekamer en broncontrole.
- *Aanbevolen nu*:
  - *broncontrole*: elke bewering in een kwestie of reactie mag een bron dragen
    (link of document). Het systeem toont welke beweringen een bron hebben en
    welke niet, en oordeelt niet over de waarheid (middel);
  - *argumentkaart*: voor en tegen per kwestie als structuur, zonder stemmen
    (middel).
- *Later*:
  - *discussiekamer met echte mensen*: een gemodereerde ruimte per kwestie,
    op naam of codenaam volgens beleid (groot, eigenaarsbesluit over moderatie);
  - *gesimuleerde debatten*: AI-stemmen die standpunten verwoorden, altijd
    gemarkeerd als "gesimuleerd". Ze citeren alleen gecontroleerde bronnen en
    spreken nooit namens een echte partij of persoon (groot, eigen governance).
- *Niet doen, en waarom*:
  - een AI die "wint" of de uitkomst bepaalt: bevestigen doet de mens;
  - likes of populariteit als rangorde: engagement;
  - het spreken namens een echte persoon of partij in een simulatie:
    impersonatie.

**Extern.** Openbare bronnen (overheid, CBS) als links. Een model alleen
lokaal-eerst.

---

## 12. Zorg (tab) — `tab:zorg`, `/apps/app.html` (stand `zorg`)

**Doel.** In de leden-app het zorgaanbod zien en een behandeling boeken en
betalen. Daarnaast medische context apart en alleen met één kliniek delen, een
pakket boeken en annuleren.

**Wat er al is.** `/api/care*` (app-main-13, -14 en -15).
- Boeken en daarna betalen via RTG Pay aan de zaak van de aanbieder.
- Een pakket in twee betalingen (behandeling en verblijf), naar verhouding van
  de losse prijzen. Is er maar één deel gelukt, dan staat het pakket op
  "deels-betaald".
- Een intake delen en stoppen. De intake staat per veld versleuteld met
  AES-GCM, gebonden aan de rij (`kern/care/intakesleutel.js`).
- Annuleren; een vrijgekomen slot wekt de wachtlijst.
- De voltooiproef sluit (8/3/4/3), met echt geld via de simulatiebank.

**Objecten en eigenaar.**
- *Boeking* en *pakketboeking*: van het lid.
- *Intake*: van het lid, gedeeld met één aanbieder tot de vervaldatum.
- *Aanbieder* en *behandeling*: van de zaak.

Capability `kern.app` (de tab heeft geen eigen schermeigenaar).

**Handelingen.** Aanbod → tijd kiezen → boeken → betalen → intake delen → op de
afspraak verschijnen → afronden (aan de kant van de aanbieder). Herstel:
- een slot wordt maar één keer geboekt;
- dubbel betalen betaalt één keer;
- een geweigerde bijlading laat de boeking op wacht-op-betaling staan;
- na een crash is er niets dubbel.

**Rechten en rollen.**
- *Lid met een pas*: boeken. Met een gratis account kan dat niet; dat is een
  eigen regel.
- *Kind*: niet.
- *Aanbieder*: ziet zijn agenda en de gedeelde intake.
- *Ander lid*: ziet niets.

**LOS en SAMEN.**
- SAMEN, uitgeeft: een betaling aan RTG Pay en een afspraak aan de Agenda.
- SAMEN, ontvangt: aanbieders uit de zaakkant (supplierCode).
- Keten: boeken → betalen → agenda van de aanbieder → afronden.

**Betaalmuurlijst.**

| kernfunctie | bij | wij |
|---|---|---|
| realtime boeken | Zocdoc, Treatwell | ja |
| vooruitbetalen | Treatwell | ja: RTG Pay |
| digitale intake vooraf | Zocdoc | ja: versleuteld, één kliniek |
| herinneringen per sms of mail | Treatwell | nee |
| reviews alleen van echte bezoekers | Zocdoc | nee |

Bronnen: Zocdoc https://www.zocdoc.com/; Treatwell https://www.treatwell.nl/en/partners/solutions/salon-software/. Bron via zoekresultaat op 2026-10-19, pagina zelf niet geopend (de proxy liet alleen de zoekdienst door). Te controleren vóór toezegging.

**Beyond.** Medische context die zelfs de opslag niet leesbaar ziet, die alleen
bij de gekozen kliniek komt en die vanzelf vervalt.

**Voorstel.**
- *Aanbevolen nu*:
  - verzetten in plaats van annuleren en opnieuw boeken (middel);
  - herinneringen via de Agenda-projectie (klein);
  - terugbetalen bij een annulering binnen de termijn: `terugZaak` staat er al
    (middel).
- *Later*: beoordelingen door leden, alleen met een geverifieerde afspraak en
  zonder ranglijst van behandelaars (middel); een verwijzing van een huisarts
  (groot, valt onder persoonseis "handeling").
- *Niet doen, en waarom*:
  - een zorgscore op een mens;
  - medische adviezen door AI: bij zorg beveelt de techniek een mens aan.

**Extern.** De zorgaanbieders zelf (supplierCode). Geen landelijke koppeling
(LSP of eOverdracht) zonder een eigenaarsbesluit.

---

## 13. Foundation-zorg — `link:foundationzorg`, `/apps/foundation/zorg.html`

**Doel.** Hulp & Zorg voor het gezin. Zorgafspraken, medicatie en hulpvragen
overzien, en zelf bepalen wie er meekijkt.

**Wat er al is.** Twee bronnen samen, die geen data delen:
- *Van Care*: de eigen afspraken (mijn, betaal en annuleer, nu met echt geld).
- *Van de Foundation*: de gezondheidskaart van het gezin, achter een toestemming
  voor gezondheidsgegevens (art. 9 AVG), met afspraken per persoon en de
  medicatie van vandaag.

Daarnaast is er een hulpwijzer (`/api/foundation/hulp/ai`) die de vraag niet
bewaart. De doktersafspraak staat versleuteld in de opslag. De voltooiproef
sluit (9/3/4/3).

**Objecten en eigenaar.** De *gezondheidskaart* is van het gezin, beheerd door
de ouder. De *toestemming* is van de ouder en herroepbaar. De *boeking* is van
het lid. Capability `rtf.hulp-zorg`.

**Handelingen.** Toestemming geven → afspraak op de kaart van het kind →
"volgende" zien → Care-afspraak boeken en betalen → annuleren → de hulpwijzer
vragen. Herstel als bij Zorg (tab). Zonder toestemming weigert de kaart (409).

**Rechten en rollen.**
- *Ouder*: kaart en toestemming.
- *Kind*: zet niets op de kaart van de ouder, en boekt geen zorg.
- *Ander gezin*: 403.
- *Ander lid*: annuleert niets (404).

**LOS en SAMEN.**
- SAMEN, ontvangt: afspraken uit Care, en de gezinsprofielen.
- SAMEN, uitgeeft: termijnen aan de levensgraaf (FOUNDATION fase 1, nog niet
  aangesloten).

**Betaalmuurlijst.**

| kernfunctie | bij | wij |
|---|---|---|
| afspraken, medicatie en meer op één plek | MyChart | half: afspraken en medicatie, geen uitslagen |
| proxy-toegang voor familie | MyChart | half: gezinskaart, geen mantelzorgermeekijker |
| herinneringen per inname, alarm bij gemiste dosis | Medisafe | nee |
| innames van gezinsleden volgen | Medisafe | half: medicatie vandaag op de kaart |

Bronnen: MyChart https://www.mychart.org/; Medisafe https://medisafeapp.com/features/. Bron via zoekresultaat op 2026-10-19, pagina zelf niet geopend (de proxy liet alleen de zoekdienst door). Te controleren vóór toezegging.

**Beyond.** Eén blik op de zorg van het hele gezin zonder dat Care en de
Foundation één database worden. Wie meekijkt, kiest de ouder.

**Voorstel.**
- *Aanbevolen nu*:
  - medicatieherinneringen als klaargezette agenda-items, die de ouder
    bevestigt (middel);
  - een mantelzorger laten meekijken via de bestaande machtiging in
    `rtgid-regie.js`, herroepbaar en per scope (middel).
- *Later*: de gezondheidskaart als bron voor de levensgraaf (FOUNDATION fase 1,
  middel); een vaccinatieschema als leeg sjabloon dat de ouder vult, zonder data
  te verzinnen (middel).
- *Niet doen, en waarom*:
  - diagnoses of triage door de hulpwijzer: techniek kent zijn grens;
  - een gezondheidsscore per gezinslid;
  - de kaart delen met een partner of gemeente.

**Extern.** Geen koppeling met een huisartsdossier zonder een besluit (persoonseis
en art. 9).

---

## 14. RTF-tegel — `os:rtf` (kiezer in de app, nog zonder voltooiscenario)

**Doel.** De ene ingang naar de Foundation-apps van een gezin. `os:rtf` opent
eerst een leeftijdskeuze en daarna de deur `/apps/foundation/index.html`:
profiel kiezen en dan het dagoverzicht, de ontwikkeling, de kring en alle
Foundation-apps (capability `rtf.start`).

**Wat er al is.**
- Mijn gezin (`eigen-gezin.js`): het gezin aan het account van de ouder, een
  kind alleen na paspoortcontrole, en een sessie per profiel.
- De gezinsregel in Heel RTG (LivingOS-B, 3d0e386f2). Gezinsschermen
  verschijnen alleen met een geopend profiel.
- Op een gedeeld toestel gaat de gezinssessie niet mee naar een volgend account
  (af89167b). De serverregel daarvoor bouwt Toegang in ronde 11.

**Objecten en eigenaar.** Het *gezin* is van het account van de eigenaar. Een
*profiel* is van het gezin. De *sessie* is van één inlog.

**Handelingen.** Leeftijd kiezen → inloggen → profiel kiezen → app openen →
profiel wisselen (met de pincode van dat profiel) → afmelden (op de server
ingetrokken).

**Rechten en rollen.**
- *Ouder* (beheerder): alles.
- *Kind*: zijn eigen profiel, en beschermde schermen alleen met een volwassen
  eigenaar.
- *Buitenstaander*: alleen de deur.

**LOS en SAMEN.** De tegel is SAMEN zelf: hij projecteert de gezinsapps in de
schil en bezit geen gegevens van een app.

**Betaalmuurlijst.**

| kernfunctie | bij | wij |
|---|---|---|
| gezin tot een vast aantal personen, met profielen | Apple Family Sharing | ja |
| goedkeuring door ouder (apps, aankopen) | Family Link, Apple, Microsoft | half: contacten en kind via paspoort, geen aankoopgoedkeuring |
| schermtijd en limieten | Family Link, Apple, Microsoft | nee |
| locatie delen | Family Link, Apple | nee, en zie Niet doen |

Bronnen: Google Family Link https://families.google/familylink/; Apple Family Sharing https://www.apple.com/family-sharing/; Microsoft Family Safety https://www.microsoft.com/en-us/microsoft-365/family-safety. Bron via zoekresultaat op 2026-10-19, pagina zelf niet geopend (de proxy liet alleen de zoekdienst door). Te controleren vóór toezegging.

**Beyond.** Een gezin dat werkt als een streamingdienst met profielen, maar
waarin een kind niets opent zonder dat RTG de ouder heeft gezien.

**Voorstel.**
- *Aanbevolen nu*:
  - een voltooiscenario voor `os:rtf`: kiezer → deur → profiel → app → wissel →
    afmelden, met de kruisproef op een gedeeld toestel (klein);
  - de 56 lege icoonvakken en de overloop uit FOUNDATION fase 0, als die nog
    bestaan. Eerst meten (klein).
- *Later*: een calm home per profiel uit de levensgraaf (FOUNDATION fase 1,
  groot).
- *Niet doen, en waarom*:
  - schermtijdranglijsten tussen kinderen: vergelijken;
  - een ouder die alles van een tiener leest: toezicht op wie, niet op wat.

**Extern.** Geen.
