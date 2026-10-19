# Werk (os:werk)

**Volledige werkzaamheid:** een lid met een eigen RTG-account ziet in de
werkkiezer precies de werkrollen die op dat moment werkelijk aan zijn account
hangen (personeel, zaak, kantoor, werkruimte), met per rol waarom hij die heeft
en sinds wanneer; één tik opent elke rol in een sessie die net zo streng is als
de losse inlog; wordt de start geweigerd (werkvenster, locatie, persoonseis,
uitdienst), dan hoort hij wat er ontbreekt en wat hij kan doen; en een rol die
eindigt, verdwijnt zonder dat een andere rol stil wegvalt. Getoetst:
`scripts/lib/voltooi/werk.js` opent alle vier de rollen en lokt elke weigering
één keer uit, met een ander lid dat geen enkele rol van hem opent.

Werk is de werkkiezer. Hij heeft **geen** SCHERMEIGENAAR-entry: er staat geen
capability voor `os:werk` in SCHERMEIGENAAR.json (besluit 1). Ingang:
`/apps/app.html`. Werk heeft geen eigen adres. Het OS-beginscherm is bewust
onbereikbaar (WERELD.md), dus de route loopt via Rahul: "open werk" lost in de
functiegids op naar `os:werk`, en `openItem` opent de kiezer
(`scripts/lib/appcontract.js`, regel 380 e.v.).

Doelgroep: elk lid met een eigen RTG-account dat één of meer werkrollen
draagt. Een gast krijgt 403. De kiezer spreekt het lid aan met "u"; de
weigerteksten van het werkvenster (`server/kern/werkvenster.js`) zijn aan
personeel gericht en gebruiken "je". Dat verschil is bewust zo gelaten: de
tekst komt van de werkgeverkant.

Werk is een **router** en bezit geen werk. Het leest welke rollen aan het ene
account hangen en munt een sessie van die rol: "dezelfde sessie als de losse
inlog" (kop van `server/kern/eenaccount/starten.js`). Juist omdat het klein
is, zit de diepte in drie vragen die geen markt-app goed beantwoordt: **waarom
heb ik deze rol**, **waarom mag ik nu niet naar binnen**, en **wat gebeurt er
als deze rol eindigt**.

---

## a. Inventaris van het bewezen bestaande

**Wat er staat**

- Scherm: `openWerkKiezer()` in `public/apps/app-main/app-main-25.js`. De
  doelen staan in `WERKDOEL` (`public/apps/app-main/app-main-24b.js`):

  | Rol | Opent | Waar |
  |---|---|---|
  | personeel | Team Room | `/apps/personeel.html` |
  | zaak | Leverancier | `/apps/leverancier.html` |
  | kantoor | Backoffice | `/apps/backoffice.html` |
  | werkruimte | Werk OS | `/apps/werk.html` |

  Een personeelsrol met `manager` landt in de zaak-app. Onder de lijst staat
  altijd een rij voor de eigen werkruimte-inlog, ook als de lijst leeg is.
- Routes (`server/routes/account.js`, alle met `auth` en `echtAccount`):
  `/api/account/rollen`, `/koppel`, `/start` en `/ontkoppel`. Ontkoppelen van
  het kantoor sluit ook open kantoorsessies (`kern.kantoorIntrekking`).
- Kern:
  - `server/kern/eenaccount.js`: de sleutelbos (`accRollen`, `accKoppel`,
    `accOntkoppel`, `kantoorHouders`);
  - `server/kern/eenaccount/koppelen.js`: bewijzen, met een slot per account
    en een gedeeld slot per doel;
  - `server/kern/eenaccount/afgeleid.js`: de eigenaar-kantoorsleutel, de
    personeelsrol uit het aan het account gebonden personeelslid, en
    werkruimtes via `lid.rtgKey`; afgeleid en niet opgeslagen;
  - `server/kern/eenaccount/starten.js`: `accStart`, met per rol dezelfde
    poorten als de losse inlog: het werkvenster (`magWerken`, uit
    `server/kern/werkvenster.js`), de persoonseis (`persoonsPoort`, uit
    `server/kern/persoonseis.js`), "nog in dienst" en de accountbinding;
  - `server/kern/eenaccount/startspoor.js`: de logregel `klok-inlog` en de
    welzijnszin;
  - `server/kern/kantoor/uitnodiging.js`: de kantoorrol op naam.
- Velden per rol die `accRollen` al teruggeeft: `rol`, `code`, `staffId`,
  `naam`, `zaakNaam`, `staffRole`, `manager`, `sinds`, en voor afgeleide rollen
  `viaEigenaar` (kantoor van de eigenaar) of `viaKoppeling` (werkruimte). De
  kiezer toont alleen app, zaaknaam en naam.
- Opslag: `db.data.accountRollen[key]`, ingekort tot 10 rijen (`rij.slice(-10)`
  in `eenaccount.js` regel 101).
- Weigeringen die de start al teruggeeft (gelezen):
  - werkvenster dicht: "Buiten het werkvenster: vandaag mag je hier van
    <van> tot <tot>. Tot dan is de werkomgeving dicht." met het veld `venster`;
  - werkvenster uitgezet voor deze persoon, of de zaak vandaag gesloten;
  - locatie nodig (`locatieNodig`): de kiezer vraagt de positie en probeert
    één keer opnieuw;
  - persoonseis: `error` plus `persoonseis` (de lijst `missend`); de tekst
    noemt alleen het eerste ontbrekende stuk;
  - personeelslid niet meer in dienst: "Deze personeelslogin bestaat niet
    meer; de koppeling is opgeruimd." De rij wordt dan uit de sleutelbos
    gehaald;
  - werkruimte niet meer gekoppeld: "Deze werkruimte is niet (meer) aan uw
    account gekoppeld."
- Logs: `logInlog` schrijft koppelen en starten naar `securityLog`
  (`server/kern/identiteit/inlogherkomst.js`, hashketen, 5000 regels). Die
  regel draagt kanaal, `wie` (rol en code) en ip, maar geen lidsleutel. Het
  kantoor leest dit spoor; het lid zelf niet.
- Toegangsreview: `server/kern/beleidsmotor/review.js` (AUTHORITY.md fase 8)
  leest `kantoorHouders()` uit de sleutelbos, alleen voor de kantoorrol.

**Wat bewezen is**

| Bron | Stand |
|---|---|
| APPWERKT.json | `os:werk`: bereikbaar NT, bedienbaar NT, menselijk NT, voltooibaar GF, waarheidsgetrouw NT, persistent GF, bevoegd NT, herstelbaar GF |
| Verse voltooiproef op deze tak (19-10, HEAD dc501544, `scripts/lib/voltooi/werk.js`) | voltooibaar 5/5, persistent ✓, herstelbaar ✓, menselijk (afgeleid) ✓. Lokaal gesloten 4/4, centraal nog te stempelen |
| CONTRACT in `scripts/lib/appcontract.js` | `os:werk` met `ingang`, `via` en `bestanden` (alleen `app-main-25.js`) |

Wat de proef loopt:
- een vers lid heeft nul rollen;
- personeel via de wervingslink (zaak MERIDIAAN);
- kantoor via een uitnodiging van de eigenaar (RTG One opent persoonlijk);
- een ander lid krijgt geen kantoor en geen werkplek;
- zonder sessie 401;
- een dubbele tik, een afgebroken tik, en een crash direct na het ontkoppelen
  van het kantoor (na de herstart is het kantoor dicht en het personeel open).

**Staat, onbewezen:** de rollen `zaak` en `werkruimte`, de
`locatieNodig`-tak, de weigering door het werkvenster, de weigering door de
persoonseis, de opruiming bij uitdienst en de elfde koppeling.

**Wat de code of het document als ontbrekend opgeeft**

- Geen SCHERMEIGENAAR-entry voor `os:werk` (feiten-code-workos.txt).
- ARBEID.md par. 3: drie werkrelaties die elkaar niet lezen:
  - `staffId` aan een zaak;
  - `employment` aan een entiteit;
  - het werkruimtelid.

  De kiezer toont alle drie naast elkaar als knoppen, zonder te zeggen dat het
  drie soorten relaties zijn. Par. 7a: `employment` is de waarheid, de
  personeelsrol is afgeleid uit het dienstverband en het werkruimtelid "blijft
  een productinstantie".
- Er is geen kiezerrij voor een concern-dienstverband zonder zaak (alleen
  `employment`, zonder `staffId`). `/api/concern/mijnwerk` bestaat, maar de
  kiezer kent die rol niet (gelezen, niet beproefd).
- Geen enkel scherm in `public/apps` roept `/api/account/ontkoppel` aan (grep).

---

## b. Marktvergelijking

Geraadpleegd op 2026-10-19, via de zoektool. Echte merken staan hier alleen ter
vergelijking. Elke regel in deze tabel komt uit een zoeksamenvatting en draagt
daarom **(te controleren)**; geen ervan is een eis in de functies hieronder.

| Leider | Achter de betaalmuur | Wij | Bron |
|---|---|---|---|
| **(te controleren)** Microsoft 365 E7 (duurste) | E5 + Copilot + Agent 365 + Entra Suite (identiteit, toegang) | één account met rollen: ja. Conditional access: half (werkvenster en werkplek-zone per werkgever). Toegangsbeoordeling: alleen voor de kantoorrol (`beleidsmotor/review.js`) | https://www.microsoft.com/en-us/microsoft-365/enterprise/e7 (via zoektool, live te controleren) |
| **(te controleren)** Notion Enterprise | SCIM, auditlog, analytics | SCIM bestaat elders in het huis (`routes/scim.js`), niet voor deze sleutelbos. Auditlog: ja voor het kantoor (`securityLog` met hashketen); voor het lid zelf: nee | https://www.notion.com/pricing (via zoektool, live te controleren) |
| **(te controleren)** Jira Standard/Premium | rollen en rechten, auditlog | rollen: ja, per app. Overzicht "welke rollen heb ik en waarom": half (de velden bestaan, de kiezer toont ze niet) | https://www.atlassian.com/software/jira/pricing (via zoektool, live te controleren) |

Alle topniveaus delen SSO, SCIM en een auditlog (markt-enterprise.txt). Werk is
zelf de SSO: één RTG-account, één pin of passkey. SCIM-provisionering naar de
sleutelbos is niet gevonden.

Waar wij verder gaan dan de markt:
- een rol die je niet hebt, opent niets, ook niet via de kiezer;
- het werkvenster en de persoonseis van de werkgever gelden ook via de kiezer
  ("het ene account is geen achterdeur", `starten.js`);
- het kantoor loslaten sluit direct de open kantoorsessies;
- een personeelsrol verdwijnt vanzelf als het personeelslid niet meer bestaat;
- de welzijnszin.

Geen van de genoemde suites heeft een vergelijkbare werkstart-zin (via de
zoektool niet gevonden; **te controleren**).

---

## c. Analyse van het volledige domein

**Particulier.** Iemand met één bijbaan wil één knop: "naar mijn werk". Iemand
met drie werkgevers (horeca in het weekend, een kantoorbaan, een eigen
werkruimte als zzp'er) wil zien welke hij nu opent en mag niet per ongeluk in
de verkeerde werkgever landen. Als de deur dicht is, wil hij weten waarom en
wanneer hij weer kan, zonder zijn leidinggevende te bellen.

**Professioneel.** Een manager van twee zaken, een RTG-medewerker die ook lid
is en een externe accountant in een werkruimte hebben elk een rol met eigen
grenzen. De kiezer mag die grenzen niet vervagen. Kennis uit hoedanigheid A
wordt nooit stil gebruikt in hoedanigheid B (MN-02, ARBEID par. 8.4). Een
beroep met een persoonseis (beveiliging, kinderopvang, zorg) wil vooraf weten
welk stuk ontbreekt, niet pas bij de deur.

**Organisatie.** Bij uitdiensttreding moet de rol weg op de dag dat het
dienstverband eindigt, niet pas als iemand eraan denkt. Een rol met einddatum
vervalt vanzelf in Werk OS (`rollen.js`). In de sleutelbos bestaat een
einddatum niet; daar is de bron het personeelslid zelf (afgeleid), en
`accStart` ruimt een vervallen personeelsrol op bij de eerstvolgende start.
Wat de medewerker na vertrek houdt, woont elders: zijn loonstroken
(`loon.strook`, sinds commit 1575572 zeven jaar ook voor een oud-medewerker)
en zijn loopbaanregel (`loopbaan.ledger`).

**Normen** (domein-max.txt, 2026-10-19). De schrijver heeft geen van deze
primaire teksten zelf nagelezen; elke regel draagt **(te controleren)** en
staat in de functies hooguit als signaal, nooit als weigering.

| Eis | Bron | Betekenis voor Werk |
|---|---|---|
| **(te controleren)** ISO 27001:2022 Annex A, 93 maatregelen; de keuze volgt uit de risicobeoordeling | https://www.dqsglobal.com/blog/new-iso-27001-2022-key-changes | Toegang intrekken bij vertrek en periodieke toegangsbeoordeling zijn gangbare maatregelen. Werk kan tonen sinds wanneer een rol bestaat (`sinds`). |
| **(te controleren)** Cyberbeveiligingswet (NIS2) zorgplicht, sinds 15-8-2026 | https://www.ncsc.nl/cyberbeveiligingswet-nis2/meldplicht | Sterke authenticatie voor kantoortoegang (passkey) past daarbij. RTG beoordeelt niet of een klant onder de wet valt. |
| **(te controleren)** AVG art. 12: inzageverzoek binnen 1 maand | https://autoriteitpersoonsgegevens.nl/nl/zelf-doen/gebruik-uw-privacyrechten/recht-op-inzage | Een lid moet kunnen zien welke werkrollen en starts over hem bewaard zijn. Signaal, geen termijn in code. |
| **(te controleren)** Registratie arbeids- en rusttijden (ATW), 52 weken | https://www.nlarbeidsinspectie.nl/nederlandse-arbeidsinspectie/sancties-en-handhavingsmethoden/boete/boetes-atw | Een werkstart via de kiezer is **geen** arbeidstijdregistratie. De klok woont bij de zaak. |

**Wat dat betekent voor software.** Werk bezit drie dingen: de sleutelbos, de
munt en de uitleg. De sleutelbos zegt welke rollen er zijn en waarom; de munt
past de poorten van de werkgever toe zonder er één over te slaan; de uitleg
zegt bij elke weigering wat er ontbreekt. Wat een werkgever instelt (venster,
zone, persoonseis) en wat een medewerker na vertrek houdt, woont bij de
eigenaar daarvan; Werk leest en verwijst.

---

## d. Functiecatalogus L1–L6

Bak: **nu: herstel**, **nu: verdieping**, later, niet doen, vraagt besluit.

### L1 Persoonlijk

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Rollen tonen | bestaat (`/api/account/rollen`) | `accountRollen` + afgeleid | alleen eigen key | afgeleide rol volgt de bron | het lid | eigen account | gast 403 | Een lid ziet precies de werkrollen die aan zijn account hangen, ook de afgeleide. | — | bestaat |
| Werk openen | bestaat (`/api/account/start`) | rol + code + staffId | munt dezelfde sessie als de losse inlog, met werkvenster, persoonseis en accountbinding | locatie kan nodig zijn | — | pin; kantoor passkey | locatie geweigerd: start faalt met reden | Een tik opent de juiste app met een werkende sessie; een rol die er niet is opent niets. | — | bestaat |
| Bron van de rol tonen ("waarom heb ik dit") | half: velden bestaan in `accRollen`, de kiezer toont ze niet | `sinds`, `viaEigenaar`, `viaKoppeling`, `staffRole`; voor personeel het gebonden personeelslid | per rij één regel: "uit uw dienstverband bij <zaak>, sinds <datum>", "u bent eigenaar van het kantoor", "gekoppeld aan werkruimte <code> op <datum>", "uitgenodigd door het kantoor" | `sinds` kan `null` zijn (eigenaar-kantoor) | het lid, in de kiezer | eigen account | `sinds` null: "afgeleid, geen koppeldatum" | Onder elke knop staat waarom ik die rol heb en sinds wanneer; er staat nooit een datum die niet in de bron staat. | klein | nu: verdieping |
| Weigering die zegt wat ontbreekt | half: de servertekst bereikt de banner; `venster` en de lijst `missend` worden weggegooid | `venster` (`werkvenster.js`), `persoonseis` (`persoonseis.js`), `locatieNodig` | werkvenster: toon het slot van vandaag; persoonseis: toon álle ontbrekende stukken met een link naar de bewijsmap; nooit het documentnummer | de werkgever kan het venster intussen wijzigen: het antwoord geldt voor dit moment | het lid, bij de geweigerde start | eigen account; het stuk zelf blijft in de kluis | manager valt nooit onder het venster (`werkvenster.js`) | Als de deur dicht is, zie ik tot hoe laat, of welke stukken ontbreken, met één link naar waar ik ze indien. | klein | nu: verdieping |
| Eerlijke lege staat | half: tekst verouderd | `app-main-25.js` | tekst volgt `koppelen.js` | — | nieuw lid | — | — | De lege kiezer noemt alleen wegen die werken (wervingslink, uitnodiging, werkruimtekoppeling), niet de personeels-PIN. | klein | nu: herstel |
| Zelf ontkoppelen in de kiezer, met het gevolg vooraf | half: route bestaat, geen scherm roept hem aan | `/api/account/ontkoppel`; gevolg uit `loon.strook`, `loopbaan.ledger`, `kantoorIntrekking` | vooraf een lijst "blijft" (loonstroken, loopbaanregel, het werk in de werkruimte) en "vervalt" (toegang, open kantoorsessies) | of een eigenaar-app iets na vertrek bewaart, zegt die eigenaar; Werk herhaalt het alleen | het lid; bij kantoor ook het kantoor | eigen account | personeel is afgeleid: niet te ontkoppelen, wel uit te leggen; werkruimte ontkoppelt in Werk OS (`/api/bedrijf/lid/ontkoppel`) | Voordat ik een rol loslaat, zie ik wat blijft en wat vervalt; een rol uit een dienstverband zegt dat hij met het dienstverband eindigt. | klein | later |

### L2 Professioneel

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Manager landt in zaak-app | bestaat (`WERKDOEL.zaak` bij `manager`) | `staffRole` | geen nieuwe bevoegdheid, alleen landing | — | — | — | — | Een manager komt in de Leverancier-app en niet in de PDA. | — | bestaat |
| Meerdere werkgevers onderscheiden | half (naam + zaaknaam op knop) | `zaakNaam`, `naam`, `rol` | label per soort relatie: dienstverband bij een zaak / werkruimtelid / kantoor | — | — | — | twee zaken met gelijke naam: code erbij | Bij twee werkgevers zie ik bij welke ik open en welk soort relatie het is. | klein | nu: verdieping (samen met "bron van de rol") |
| Werkvenster vooraf onder de knop | ontbreekt: het venster wordt pas bij de start gelezen | `werkvenster` van de zaak, `perStaff` van deze medewerker | alleen het eigen slot van vandaag: open van–tot, dicht, alleen op locatie | het slot kan wijzigen tot de start | het lid, bij het openen van de kiezer | eigen account met gebonden personeelslid; nooit het venster van een ander | manager: geen venster; `altijd`: niets tonen | Voordat ik tik, zie ik "vandaag open van 08:00 tot 17:00" of "vandaag gesloten", alleen voor mezelf. | middel (een leesroute op de lidsessie) | later |
| Kantoor via passkey | bestaat | passkey, uitnodiging | geen passkey: naar passkey-pagina | — | — | kantoor | — | Zonder passkey opent het kantoor niet in productie. | — | bestaat |

### L3 Organisatorisch

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Rol vervalt met het dienstverband | bestaat voor personeel (afgeleid; bij de start opgeruimd) | gebonden personeelslid | lees de bron, geen kopie | dienstverband van vóór de brug: geen | het lid bij de volgende start | — | zaak/kantoor/werkruimte zijn gekoppeld, niet afgeleid | Na uitdienst verschijnt de personeelsrol niet meer in de kiezer, en een poging zegt dat de koppeling is opgeruimd. | — | bestaat (voor personeel) |
| Concern-dienstverband zonder zaak als rol | ontbreekt | `kern/concern/employment.js`, `/api/concern/mijnwerk` | afgeleid, zoals personeel | — | — | eigen account | geen app-doel: vraagt besluit | Wie alleen een dienstverband bij een entiteit heeft, ziet in de kiezer waar hij heen kan. | klein | vraagt besluit |
| Geen stil verlies bij rol 11 | ontbreekt (`slice(-10)`) | `accountRollen` | weigeren met reden in plaats van de oudste weghalen | — | het lid | — | — | Een elfde koppeling wordt geweigerd met uitleg; geen bestaande rol verdwijnt zonder bericht. | klein | nu: herstel |
| Toegangsbeoordeling door de werkgever | half: bestaat alleen voor de kantoorrol (`beleidsmotor/review.js`) | sleutelbos per zaak of werkruimte | de werkgever ziet alleen codenamen met rol en `sinds` bij zijn eigen zaak; geen ranglijst | — | eigenaar van de zaak of werkruimte | `zaak.beheer` resp. `werk.organisatie`, niet Werk | — | Een werkgever ziet wie via een RTG-account bij zijn zaak kan, sinds wanneer, en trekt in waar het recht woont. | middel | later (eigenaar: zaak.beheer en werk.organisatie) |

### L4 Domeinintelligentie

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Welzijnszin | bestaat (`startspoor.js`) | uur, aantal starts vandaag | na 23 of voor 6 uur; vanaf 5e start | geen oordeel, geen score | het lid, bij de start | — | nooit blokkeren | De zin verschijnt alleen bij de start en blokkeert nooit. | — | bestaat |
| Rahul opent werk | bestaat (functiegids -> `os:werk`) | — | exacte match | — | — | — | — | "open werk" opent de kiezer, geen andere app. | — | bestaat |
| Voorspellen welke rol je nu wilt | ontbreekt | starts | — | — | — | — | — | — | — | niet doen: een kiezer die raadt, opent bij twee werkgevers de verkeerde (MN-02) |

### L5 Volledige levenscyclus

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Van geen rol tot uitdienst | bestaat in stukken (proef: 0 -> personeel -> kantoor -> ontkoppel) | sleutelbos | — | — | — | — | — | De proef loopt van nul rollen tot ontkoppelen, met herstart ertussen. | — | bestaat (lokaal) |
| Voltooiproef over alle vier rollen en de weigeringen | half (2 van 4 rollen; geen venster, persoonseis, locatie, elfde rol) | `scripts/lib/voltooi/werk.js` | elke rol één start; elke weigering één keer uitgelokt | — | — | — | — | De proef opent personeel, zaak, kantoor en werkruimte, en lokt venster, persoonseis, locatie en de elfde koppeling uit. | klein | nu: herstel (bewijs) |
| Werkstarts van mezelf inzien | half: `klok-inlog` alleen per zaak voor manager en medewerker (`logboekzicht.js`); `securityLog` draagt geen lidsleutel | logActivity per zaak | eigen inzage vrij; geen nieuwe opslag | kantoor- en werkruimtestarts staan alleen in `securityLog` | het lid | eigen account | — | Ik zie mijn eigen werkstarts per werkgever, en waar dat niet kan, staat waarom. | klein | later |

### L6 RTG-samenhang

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Werving -> personeelsrol | bestaat | `/api/werving/verbind` | claim met lidsessie | — | — | eigen account | Foundation-profiel via uitnodiging (ARBEID 7a) | Na de wervingslink staat de zaak in de kiezer. | — | bestaat |
| Werkruimte -> rol | bestaat (afgeleid uit `lid.rtgKey`) | `db.data.werkruimtes` | geen nieuw bewijs | — | — | koppeling vanuit werkruimte | — | Wie zijn account aan een werkruimte koppelde, opent Werk OS zonder tweede inlog. | — | bestaat, onbewezen |
| Kantooruitnodiging -> rol | bestaat | `kantoor/uitnodiging.js` | op naam | — | — | eigenaar nodigt uit | — | De uitnodiging werkt alleen voor het account waarvoor hij is gemaakt. | — | bestaat |
| Persoonseis -> bewijsmap | half: de weigering noemt het eerste stuk, zonder link | `persoonseis.js` `missend` | link naar de plek waar het lid zijn stuk indient | of `identiteit.bewijzen` de juiste plek is: besluit 4 | het lid bij de geweigerde start | eigen account | — | Na een weigering om een ontbrekend stuk staat er één knop naar de plek waar ik het indien. | klein | nu: verdieping (samen met "weigering die zegt wat ontbreekt") |

### Modus LOS

De kerntaak met alle werk-apps uit: tonen welke rollen er zijn, en waarom. Een
rol waarvan de app niet bereikbaar is, opent niet; de rol blijft in de
sleutelbos. Elke groep noemt de letterlijke schermtekst als dat deel
ontbreekt. "(bestaat)" staat zo in de code; "(voorstel)" is de zin die er
moet komen. Tone: de u-vorm van de kiezer.

**1. Eigen: wat Werk zelf bezit en altijd kan.** De sleutelbos
(`accountRollen`), de afgeleide rollen, de munt (`accStart`) en de
welzijnszin.
- Geen rollen: nu "Nog geen werkplek gekoppeld. Bewijs eenmalig uw werk-inlog
  (bijvoorbeeld uw personeels-PIN in de leverancier-app); daarna opent uw werk
  hier met uw algemene pin." (bestaat, maar fout: de PIN-weg wordt geweigerd).
  Gewenst: "U heeft nog geen werkplek. Een werkgever voegt u toe met een
  wervingslink of een uitnodiging; een werkruimte koppelt u vanuit Werk OS."
  (voorstel)
- Rollen niet te laden: "Uw werkplekken kunnen nu niet worden opgehaald. Er is
  niets aan uw rollen veranderd." (voorstel)

**2. Noodzakelijke platformdiensten.**
- Account en sessie: `auth` + `echtAccount` op elke route; een gast krijgt 403.
- Pin en passkey: de algemene pin (`metAlgPin`) en de kantoordeur
  (`shared/kantoordeur`, `kantoor/productiedeur.js`).
- Identiteit en vakbewijs: `server/kern/persoonseis.js` voor genres met een
  eis aan de persoon.
- Inlogspoor: `securityLog` (`inlogherkomst.js`); een mislukte vastlegging
  wordt nooit stil als geslaagd behandeld (kop van dat bestand).

Schermtekst als een van deze ontbreekt:
- sessie verlopen: "U bent niet meer ingelogd. Log opnieuw in om uw werk te
  openen." (voorstel)
- kantoordeur niet te laden: nu "Openen lukte niet." (bestaat). Gewenst:
  "De kantoordeur kan nu niet worden geladen. Uw kantoorrol staat nog; probeer
  het zo opnieuw." (voorstel)
- persoonseis niet te lezen: "Wij kunnen nu niet nagaan of uw vakbewijs is
  afgetekend. Er is niets aan uw rol veranderd." (voorstel)

**3. Optionele koppelingen: de werk-apps zelf.**
- Team Room, Leverancier, Backoffice of Werk OS niet bereikbaar: nu "Openen
  lukte niet." zonder app-naam (bestaat). Gewenst: "Uw rol bij <zaak> staat,
  maar <app> is nu niet bereikbaar. Er is niets veranderd aan uw rol."
  (voorstel)
- Werkruimte opgeheven of ontkoppeld: "Deze werkruimte is niet (meer) aan uw
  account gekoppeld." (bestaat)
- Personeelslid verwijderd door de zaak: "Deze personeelslogin bestaat niet
  meer; de koppeling is opgeruimd." (bestaat)

### Modus SAMEN: het contractblok (voorstel)

Een VOORSTEL in de vorm van CONTRACT uit `scripts/lib/appcontract.js`; dat
bestand verandert niet. `belofte`, `ingang`, `via` en `bestanden` zijn
CONTRACT-velden (`via` omdat Werk geen eigen adres heeft); `eigenaar` is de
SCHERMEIGENAAR-capability van de kant waar de gegevens wonen.

```js
samen: {
  functie: 'os:werk', familie: 'WorkOS',
  belofte: 'een lid opent zijn werk met zijn eigen account, in de rollen die er werkelijk aan hangen en met de reden erbij; de poorten van de werkgever gelden ook hier en een weigering zegt wat er ontbreekt; een rol die eindigt verdwijnt, en geen andere rol valt stil weg',
  ingang: '/apps/app.html',
  via: 'de rand: "Praat met Rahul" -> "open werk", dat in de functiegids exact op os:werk uitkomt en de werkkiezer opent',
  bestanden: ['public/apps/app-main/app-main-25.js', 'public/apps/app-main/app-main-24b.js'],
  scenario: 'scripts/lib/voltooi/werk.js',
  ketens: [
    { naam: 'werving wordt personeelsrol', uitgeeft: 'een werksessie op de zaak', ontvangt: 'personeelslid gebonden aan dit account',
      vorm: 'projectie', eigenaar: 'zaak.beheer', toestemming: 'het lid claimt met zijn eigen lidsessie',
      storingen: ['plek al geclaimd door een ander account: 403', 'personeelslid verwijderd: rol opgeruimd bij de volgende start'],
      proef: 'scripts/lib/voltooi/werk.js (bestaat)' },
    { naam: 'werkvenster en werkplek-zone', uitgeeft: 'niets', ontvangt: 'venster en zone van de werkgever',
      vorm: 'projectie', eigenaar: 'zaak.beheer', toestemming: 'de werkgever stelt in; het lid ziet alleen zijn eigen slot',
      storingen: ['buiten venster: weigering met van-tot', 'geen locatie gedeeld: één keer vragen, dan weigering met reden'],
      proef: 'niet gevonden; voorstel: stap met een gesloten venster' },
    { naam: 'persoonseis aan de deur', uitgeeft: 'niets', ontvangt: 'afgetekende vakbewijzen (zonder nummer)',
      vorm: 'verwijzing', eigenaar: 'identiteit.bewijzen', toestemming: 'het nummer blijft in de kluis; Werk ziet alleen ontbreekt of niet',
      storingen: ['stuk ingediend maar niet afgetekend: weigering', 'stuk verlopen: weigering bij de volgende start'],
      proef: 'test/persoonseis.test.js dekt de eis; via de kiezer: niet gevonden' },
    { naam: 'werkruimte wordt rol', uitgeeft: 'Werk OS-sessie zonder tweede inlog', ontvangt: 'werkruimtelid met rtgKey',
      vorm: 'projectie', eigenaar: 'werk.organisatie', toestemming: 'het lid koppelt zelf vanuit de werkruimte',
      storingen: ['werkruimte ontkoppeld: "Deze werkruimte is niet (meer) aan uw account gekoppeld."'],
      proef: 'niet gevonden in werk.js; voorstel: stap met /api/bedrijf/lid/koppel' },
    { naam: 'kantooruitnodiging wordt kantoorrol', uitgeeft: 'kantoorsessie via passkey', ontvangt: 'uitnodiging op naam',
      vorm: 'gebeurtenis', eigenaar: 'werk.werkplek' /* te bevestigen, besluit 4 */, toestemming: 'de eigenaar nodigt uit; alleen het genoemde account',
      storingen: ['ander lid gebruikt de uitnodiging: geen kantoor', 'ontkoppelen: open kantoorsessies sluiten direct', 'crash na ontkoppelen: kantoor dicht na herstart'],
      proef: 'scripts/lib/voltooi/werk.js (bestaat)' }
  ]
}
```

### Modus SAMEN: Sara, kok bij MERIDIAAN en lid van een werkruimte

| Stap | Wat gebeurt er | Bron |
|---|---|---|
| 1 | Sara maakt een gratis RTG-account. De kiezer is leeg. | `/api/account/rollen` |
| 2 | De zaak werft haar. Ze verbindt via de wervingslink en wordt personeel. | `/api/werving/verbind` |
| 3 | Een ondernemer nodigt haar uit in zijn Werk OS-werkruimte. Ze koppelt vanuit de werkruimte (`/api/bedrijf/lid/koppel`). | `bedrijf/aansluiting.js`, `eenaccount/afgeleid.js` |
| 4 | Ze zegt tegen Rahul "open werk" en ziet twee knoppen: Team Room bij MERIDIAAN ("uit uw dienstverband, sinds 3 maart") en Werk OS ("gekoppeld aan werkruimte W…, sinds 5 maart"). | `app-main-25.js`; de bronregel is verdieping |
| 5 | Ze opent Team Room om 07:40. Het venster opent om 08:00: de weigering zegt "vandaag mag je hier van 08:00 tot 17:00". | `werkvenster.js` via `starten.js` |
| 6 | Om 08:05 opent ze opnieuw. De zaak vraagt haar locatie, die ze geeft. De sessie start. | `starten.js` |
| 7 | De zaak gaat over op een genre met een persoonseis. Bij de volgende start ziet ze welke stukken ontbreken en één knop naar haar bewijsmap. | `persoonseis.js`; de lijst en de knop zijn verdieping |
| 8 | Om 23:30 start ze een late dienst; de welzijnszin verschijnt. | `startspoor.js` |
| 9 | Ze gaat uit dienst bij MERIDIAAN. De personeelsrol verdwijnt; Werk OS blijft. Haar loonstroken blijven leesbaar in Loonstrook. | afgeleid; `loon.strook` (commit 1575572) |

Storingen in deze keten:

| Storing | Wat de gebruiker ziet | Wat bewaard blijft |
|---|---|---|
| Geen sessie | 401 met melding | niets veranderd |
| Buiten het werkvenster | "Buiten het werkvenster: vandaag mag je hier van 08:00 tot 17:00. Tot dan is de werkomgeving dicht." | rol blijft |
| Locatie geweigerd | de weigering van de werkplek-zone, met reden | rol blijft |
| Persoonseis niet gehaald | **nu**: alleen het eerste ontbrekende stuk; **gewenst**: alle stukken en één knop naar de bewijsmap | rol blijft; het ingediende stuk blijft in de kluis |
| Dubbele tik | twee werkende sessies, geen fout (proef herstelbaar 1) | — |
| Crash na ontkoppelen | kantoor dicht, personeel open (proef herstelbaar 3) | de ontkoppeling |
| Elfde koppeling | **nu**: de oudste rol verdwijnt stil (fout); **gewenst**: weigering met reden | nu: verlies van een rij |
| Werkruimte opgeheven | "Deze werkruimte is niet (meer) aan uw account gekoppeld." | — |
| Doel-app onbereikbaar | **nu**: "Openen lukte niet."; **gewenst**: de app bij naam en "er is niets veranderd aan uw rol" | rol blijft |
| Ander lid probeert haar kantoor | 404 of 403 | — |

---

## e. RTG-exclusieve mogelijkheden

| Mogelijkheid | Eigenaar | Capability | Waarom geen markt-app dit kan |
|---|---|---|---|
| Eén account voor personeel, zaak, kantoor en een klantwerkruimte, met codenaam | Werk (`os:werk`, eigenaar open) | `kern/eenaccount.js` | Bij de markt zijn werkgever-IdP's gescheiden per tenant. Hier is de mens de sleutelbos. |
| De personeelsrol volgt het personeelslid zonder kopie, en wordt bij uitdienst opgeruimd | Zaak (`zaak.beheer`) bezit, Werk leest | `afgeleid.js`, `starten.js` | Een IdP weet niet wanneer een arbeidsrelatie eindigt. |
| De poorten van de werkgever (venster, zone, persoonseis) gelden ook via het ene account, en de weigering zegt wat ontbreekt | Zaak stelt in, Werk past toe en legt uit | `werkvenster.js`, `persoonseis.js`, `starten.js` | Een SSO-laag kent de roosterafspraak en de beroepseis van een werkgever niet. |
| Kantoor loslaten sluit open sessies direct | Werk + kantoor | `kantoorIntrekking` | Vereist dat sessies en rollen in één huis staan. |
| Vóór het loslaten van een rol zien wat blijft (loonstroken, loopbaanregel) | Werk toont, Loonstrook en Loopbaan bezitten | `loon.strook`, `loopbaan.ledger` | Loon, loopbaan en toegang zijn bij de markt drie leveranciers. |

---

## f. Bouwstenen en ontbrekende koppelingen

**Bestaande bouwstenen:**
- `server/kern/eenaccount.js`, `server/kern/eenaccount/afgeleid.js`,
  `server/kern/eenaccount/starten.js`;
- `server/kern/werkvenster.js`, `server/kern/persoonseis.js`;
- `server/kern/beleidsmotor/review.js` (toegangsreview, kantoorrol);
- `public/apps/app-main/app-main-25.js`, `public/apps/app-main/app-main-24b.js`;
- `scripts/lib/voltooi/werk.js`.

**Ontbrekende koppelingen**

| Van -> naar | Vorm | Toestemming |
|---|---|---|
| `accRollen` (sinds, via…) -> knop in de kiezer | projectie op bestaande velden | eigen account |
| `starten.js` (`venster`, `persoonseis`) -> banner in de kiezer | projectie op het antwoord | eigen account |
| persoonseis -> bewijsmap (`identiteit.bewijzen`) | verwijzing | eigen account |
| concern employment (zonder zaak) -> kiezer | afgeleide rol | eigen account |
| sleutelbos -> SCHERMEIGENAAR | registratie | besluit eigenaar |
| werkvenster van de zaak -> kiezer vooraf | projectie (eigen slot) | eigen account met gebonden personeelslid |
| sleutelbos -> toegangsreview per zaak/werkruimte | projectie | eigenaar van de zaak of werkruimte |
| voltooiproef -> rollen zaak en werkruimte, weigeringen | proefstappen | — |

---

## g. Prioritering

De oude bak "aanbevolen nu" is gesplitst in **herstel** (fouten, stil verlies,
wat het scherm belooft maar niet doet, ontbrekend bewijs) en **verdieping**
(nieuwe premiumdiepte binnen de huidige scope).

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Lege-staat-tekst gelijk aan `koppelen.js` | klein | laag | geen | nu: herstel |
| Elfde koppeling weigeren in plaats van stil afkappen | klein | laag | geen | nu: herstel |
| Doel-app bij naam noemen als openen mislukt | klein | laag | geen | nu: herstel |
| Voltooiproef uitbreiden met zaak, werkruimte, locatie, venster, persoonseis en de elfde koppeling | klein | laag | `voltooiwereld.js` | nu: herstel |
| Bron en soort relatie onder elke knop | klein | laag | `accRollen` | nu: verdieping |
| Weigering die zegt wat ontbreekt (venster, alle stukken, knop naar bewijsmap) | klein | laag | `starten.js` geeft het al terug; besluit 4 voor de link | nu: verdieping |
| SCHERMEIGENAAR-entry voor `os:werk` | klein | laag | besluit 1 | na besluit |
| Ontkoppelen in de kiezer, met het gevolg vooraf | klein | laag | route bestaat | later |
| Werkvenster vooraf onder de knop | middel | middel | leesroute op lidsessie | later |
| Eigen werkstarts inzien | klein | laag | `logboekzicht.js` | later |
| Toegangsbeoordeling per zaak of werkruimte | middel | middel | eigenaar zaak.beheer / werk.organisatie | later |
| Concern-dienstverband als rol | klein | middel | besluit 2 | vraagt besluit |
| Rol voorspellen | — | — | — | niet doen |

---

## h. Toetsbaar eindcontract Beyond Premium

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| Breedte | Alle vier rollen (personeel, zaak, kantoor, werkruimte) openen hun app | `scripts/lib/voltooi/werk.js` | 2 van 4 in de proef |
| Professionele diepte | Elke weigering (venster, zone, persoonseis, uitdienst, ontkoppelde werkruimte) bereikt het lid met wat ontbreekt; de persoonseis noemt alle stukken | proefstap per weigering | 0 van 5 in de proef; de teksten bestaan, de lijst `missend` wordt niet getoond |
| Levenscyclus | Van nul rollen via koppelen tot uitdienst en ontkoppelen; de bron van elke rol is zichtbaar | proef | personeel en kantoor ja; uitdienst en bron niet |
| Samenwerking en rollen | Een ander lid opent geen rol van mij; een gast krijgt 403; een elfde koppeling haalt niets weg | proef + BEVOEGD | proef ja (eerste twee); elfde koppeling faalt (gelezen); BEVOEGD NT |
| Domeinintelligentie | De welzijnszin blokkeert nooit en scoort niets | unittoets op `startspoor.js` | niet gevonden |
| Los functioneren | Als een doel-app of platformdienst uitvalt, toont de kiezer de schermtekst uit Modus LOS en blijft de rol staan | proef met uitgeschakelde app | niet gemeten; nu "Openen lukte niet." |
| RTG-ketens | De vijf ketens uit het `samen`-blok lopen elk met hun storingen | proef | 2 van 5 (werving, kantooruitnodiging), lokaal |
| Bewezen betrouwbaarheid | APPWERKT acht bewijzen B | APPWERKT.json | 0 B; GF/NT, lokaal 4/4 gesloten, centraal te stempelen |

Dit contract vervangt de acht bewijzen van APPWERKT niet.

---

## Twee uitkomsten

### (A) Binnen de huidige architectuur en scope

**HERSTEL**

| Functie | Kosten | Bouwt op | Stand |
|---|---|---|---|
| Lege-staat-tekst gelijk aan de werkelijke koppelwegen | klein | `koppelen.js` (personeel 403 op PIN), `app-main-25.js` | open |
| Weigering bij een elfde rol in plaats van `slice(-10)` | klein | `server/kern/eenaccount.js` regel 101 | open |
| Doel-app bij naam als openen mislukt | klein | `app-main-25.js` (`bannerToon`) | open |
| Voltooiproef: zaak, werkruimte, locatieNodig, venster, persoonseis, elfde rol | klein | `scripts/lib/voltooi/werk.js` | open |
| SCHERMEIGENAAR-entry (na besluit 1) | klein | SCHERMEIGENAAR.json | open |

Uit de reparatieronde (workos.md par. 9) is voor Werk niets gerepareerd.

**VERDIEPING**

| Functie | Kosten | Bouwt op | Bak |
|---|---|---|---|
| Bron en soort relatie per knop | klein | `accRollen` (`sinds`, `viaEigenaar`, `viaKoppeling`), `afgeleid.js` | nu |
| Weigering die zegt wat ontbreekt, met knop naar de bewijsmap | klein | `starten.js` (`venster`, `persoonseis`), `persoonseis.js` | nu |
| Ontkoppelen in de kiezer, met "blijft / vervalt" vooraf | klein | `/api/account/ontkoppel`, `loon.strook`, `loopbaan.ledger` | later |
| Werkvenster vooraf onder de knop | middel | `werkvenster.js` | later |
| Eigen werkstarts inzien | klein | `logboekzicht.js` | later |
| Toegangsbeoordeling per zaak of werkruimte (eigenaar daar, niet bij Werk) | middel | `beleidsmotor/review.js` als patroon | later |

### (B) Het domeinmaximum, ook buiten de huidige scope

Dit is richting en geen toezegging. Wat buiten scope valt, staat als besluit.

**Proces 1: Werkidentiteit over werkgevers heen (joiner-mover-leaver).**

Stappen:
1. Aanname bij de entiteit.
2. Rol verschijnt (afgeleid), met de bron erbij.
3. Functiewissel: rol wijzigt met datum.
4. Tijdelijke rol bij een tweede vestiging.
5. Periodieke toegangsbeoordeling door de werkgever, alleen over zijn eigen
   rollen.
6. Uitdienst: alle rollen bij die werkgever vervallen op de einddatum.
7. Het lid behoudt zijn account, zijn loopbaanregel en zijn loonstroken, en
   zag dat vooraf.

Rollen: medewerker, manager, HR, eigenaar van de entiteit.

Apps en eigenaren:
- Concern (`werk.concern`): de bron;
- Werk: de kiezer, eigenaar open;
- Team Room (`zaak.teamroom`), Werk OS (`werk.organisatie`), Loonstrook
  (`loon.strook`) en Loopbaan (`loopbaan.ledger`).

Nodig buiten scope:
- SCIM-provisionering vanuit een externe HR-bron (externe koppeling);
- een toegangsbeoordeling als handeling over alle werkgevers (besluit);
- rollen met einddatum in de sleutelbos zelf (besluit, botst nu met
  "afgeleid").

**Proces 2: De meervoudige werker (horeca + zzp + vrijwilliger).**

Stappen:
1. Per werkgever een eigen rol.
2. Een gezamenlijk beeld van eigen uren over alle werkgevers heen, alleen voor
   het lid zelf: ATW geldt per werkgever (te controleren), maar het lid wil
   zijn totaal zien.
3. Een signaal aan het lid zelf bij te weinig rust, nooit aan een werkgever.

Apps en eigenaren:
- Werk;
- Vrijheid (`kern/vrijheid/`, eigenaar Team Room);
- Leven als overkoepelende projectie, nooit eigenaar.

Nodig buiten scope:
- een besluit dat uren van werkgever A nooit zichtbaar worden voor werkgever
  B (MN-02 hard maken);
- een lid-eigen urenbeeld (nieuw, besluit).

**Proces 3: Beroep met een persoonseis (beveiliging, kinderopvang, zorg).**

Stappen:
1. Het lid dient zijn vakbewijs in.
2. Een mens van RTG tekent af (nooit de werkgever zelf, AGENTS.md).
3. De kiezer laat de rol pas open als het stuk geldt; vóór de vervaldatum
   krijgt het lid een signaal.
4. Een verlopen stuk sluit de deur bij de volgende start, met uitleg.

Apps en eigenaren: Werk (deur en uitleg), `identiteit.bewijzen` (bewijsmap,
besluit 4), de zaak (genre).

Nodig buiten scope: een vervalsignaal vooraf (besluit; nu wordt een stuk pas
bij een vraag opnieuw gerekend).

---

## Productfouten gezien (niet gerepareerd)

1. **Verouderde lege-staat-tekst.**
   - `public/apps/app-main/app-main-25.js` regel 59: "Bewijs eenmalig uw
     werk-inlog (bijvoorbeeld uw personeels-PIN in de leverancier-app)".
   - `server/kern/eenaccount/koppelen.js` weigert die koppeling met 403:
     "een personeelspin kan niet meer worden gekoppeld".
2. **Stil verlies bij de elfde koppeling.**
   - `server/kern/eenaccount.js` regel 101 doet
     `db.data.accountRollen[key] = rij.slice(-10)`.
   - Een elfde koppeling verwijdert de oudste rol zonder bericht. Bij een
     personeelsrol is de plek dan wel al geclaimd (`claimStaffMember`).
3. **Geen SCHERMEIGENAAR-entry voor `os:werk`.**
4. **Nieuw: de lijst van ontbrekende stukken gaat verloren.**
   - `server/kern/eenaccount/starten.js` geeft bij een persoonseis
     `persoonseis: pp.missend` terug; `app-main-25.js` toont alleen
     `e.message`, en die noemt het eerste stuk (`persoonseis.js`,
     `zin(missend[0], …)`). Wie twee stukken mist, ontdekt het tweede pas bij
     de volgende poging.

---

## Vraagt besluit

1. **Wie is eigenaar van `os:werk` in SCHERMEIGENAAR?**
   - (a) **Aanbevolen**: een eigen capability `werk.kiezer`, rol eigenaar,
     doelgroep lid. Kosten: klein.
   - (b) Onder `werk.werkplek` (nu kantoor-only). Kosten: klein, maar de
     doelgroep klopt dan niet.
   - (c) Geen entry; de kiezer blijft een router. Kosten: geen. Het gat in de
     eigenaarstabel blijft bestaan.
2. **Krijgt een concern-dienstverband zonder zaak een rij in de kiezer?**
   - (a) **Aanbevolen**: ja, afgeleid, met als doel het `mijnwerk`-beeld van
     Concern. Kosten: klein.
   - (b) Nee; eerst moet er een zaak aan hangen. Kosten: geen. De
     werknemer-zonder-zaak blijft zonder ingang.
3. **Wat gebeurt er bij meer dan tien rollen?**
   - (a) **Aanbevolen**: weigeren met reden. Kosten: klein.
   - (b) De grens ophogen naar bijvoorbeeld 25. Kosten: klein. Verschuift het
     probleem alleen.
   - (c) Zo laten. Kosten: geen. Het stille verlies blijft.
4. **Waar verwijst Werk naar voor vakbewijs en kantooruitnodiging?**
   - (a) **Aanbevolen**: vakbewijs naar `identiteit.bewijzen`
     (`apps/bewijsmap.html`); de kantooruitnodiging blijft zonder eigen
     capability en verwijst naar de eigenaar van het kantoor. Kosten: geen
     bouw, twee regels in de kaart.
   - (b) Beide onder `werk.werkplek`. Kosten: klein, maar de doelgroep van die
     capability (kantoor) klopt niet voor vakbewijs.
   - (c) Geen eigenaar noemen. Kosten: geen. De ketens in het `samen`-blok
     hebben dan twee open eigenaren.
