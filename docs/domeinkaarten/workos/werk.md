# Werk (os:werk)

Werk is de werkkiezer. Hij heeft **geen** SCHERMEIGENAAR-entry: er staat geen
capability voor `os:werk` in SCHERMEIGENAAR.json. Ingang: `/apps/app.html`.
Werk heeft geen eigen adres. Het OS-beginscherm is bewust onbereikbaar
(WERELD.md), dus de route loopt via Rahul: "open werk" lost in de functiegids
op naar `os:werk`, en `openItem` opent de kiezer (`scripts/lib/appcontract.js`).

Doelgroep: elk lid met een eigen RTG-account dat één of meer werkrollen
draagt: personeel, zaak, kantoor of werkruimte. Een gast krijgt 403.

Werk is klein en moet volledig zijn. Het is een **router** en bezit geen werk.
Het leest welke rollen aan het ene account hangen en munt een sessie van die
rol: "dezelfde sessie als de losse inlog".

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

  Een personeelsrol met `manager` landt in de zaak-app.
- Routes (`server/routes/account.js`, alle met `auth` en `echtAccount`):
  `/api/account/rollen`, `/koppel`, `/start` en `/ontkoppel`. Ontkoppelen van
  het kantoor sluit ook open kantoorsessies (`kern.kantoorIntrekking`).
- Kern:
  - `server/kern/eenaccount.js`: de sleutelbos;
  - `server/kern/eenaccount/koppelen.js`: bewijzen, met een slot per account
    en een gedeeld slot per doel;
  - `server/kern/eenaccount/afgeleid.js`: de eigenaar-kantoorsleutel en
    werkruimtes via `lid.rtgKey`, afgeleid en niet opgeslagen;
  - `server/kern/eenaccount/starten.js` en `startspoor.js`: de logregel
    `klok-inlog` en een welzijnszin;
  - `server/kern/kantoor/uitnodiging.js`: de kantoorrol op naam.
- Opslag: `db.data.accountRollen[key]`, ingekort tot 10 rijen (`rij.slice(-10)`
  in `eenaccount.js`).
- Bijzonderheden:
  - het kantoor gaat in productie via een passkey (`shared/kantoordeur`, aan
    de serverkant `kantoor/productiedeur.js`);
  - personeel kan `locatieNodig` teruggeven; de kiezer vraagt dan de positie
    en probeert opnieuw;
  - de welzijnszin verschijnt bij een start na 23:00 of vóór 06:00, of vanaf
    de vijfde start op een dag. Nooit blokkerend.

**Wat bewezen is**

| Bron | Stand |
|---|---|
| APPWERKT.json | `os:werk`: bereikbaar NT, bedienbaar NT, menselijk NT, voltooibaar GF, waarheidsgetrouw NT, persistent GF, bevoegd NT, herstelbaar GF |
| Verse voltooiproef op deze tak (19-10, HEAD dc501544, `scripts/lib/voltooi/werk.js`) | voltooibaar 5/5, persistent ✓, herstelbaar ✓, menselijk (afgeleid) ✓. Lokaal gesloten 4/4, centraal nog te stempelen |

Wat de proef loopt:
- een vers lid heeft nul rollen;
- personeel via de wervingslink (zaak MERIDIAAN);
- kantoor via een uitnodiging van de eigenaar (RTG One opent persoonlijk);
- een ander lid krijgt geen kantoor en geen werkplek;
- zonder sessie 401;
- een dubbele tik, een afgebroken tik, en een crash direct na het ontkoppelen
  van het kantoor (na de herstart is het kantoor dicht en het personeel open).

**Staat, onbewezen:** de rollen `zaak` (bewijs van de bedrijfsinlog) en
`werkruimte` (afgeleid uit `lid.rtgKey`) zitten niet in de proef. Ook de
`locatieNodig`-tak niet.

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

---

## b. Marktvergelijking

Geraadpleegd op 2026-10-19, via de zoektool. Echte merken staan hier alleen ter
vergelijking.

| Leider | Achter de betaalmuur | Wij | Bron |
|---|---|---|---|
| Microsoft 365 E7 (duurste) | E5 + Copilot + Agent 365 + **Entra Suite** (identiteit, toegang) | één account met rollen: ja. Conditional access: nee. Toegangsbeoordeling per rol: nee | https://www.microsoft.com/en-us/microsoft-365/enterprise/e7 (via zoektool, live te controleren) |
| Notion Enterprise | SCIM, auditlog, analytics | SCIM bestaat elders in het huis (`routes/scim.js`), niet voor deze sleutelbos. Auditlog: half (`klok-inlog` per zaak, koppel-logInlog) | https://www.notion.com/pricing (via zoektool, live te controleren) |
| Jira Standard/Premium | rollen en rechten, auditlog | rollen: ja, per app. Overzicht "welke rollen heb ik en waarom": half | https://www.atlassian.com/software/jira/pricing (via zoektool, live te controleren) |

Alle topniveaus delen SSO, SCIM en een auditlog (markt-enterprise.txt). Werk is
zelf de SSO: één RTG-account, één pin of passkey. SCIM-provisionering naar de
sleutelbos is niet gevonden.

Waar wij verder gaan dan de markt:
- een rol die je niet hebt, opent niets, ook niet via de kiezer;
- het kantoor loslaten sluit direct de open kantoorsessies;
- de welzijnszin.

Geen van de genoemde suites heeft een vergelijkbare werkstart-zin (via de
zoektool niet gevonden).

---

## c. Analyse van het volledige domein

**Particulier.** Iemand met één bijbaan wil één knop: "naar mijn werk". Iemand
met drie werkgevers (horeca in het weekend, een kantoorbaan, een eigen
werkruimte als zzp'er) wil zien welke hij nu opent en mag niet per ongeluk in
de verkeerde werkgever landen.

**Professioneel.** Een manager van twee zaken, een RTG-medewerker die ook lid
is en een externe accountant in een werkruimte hebben elk een rol met eigen
grenzen. De kiezer mag die grenzen niet vervagen. Kennis uit hoedanigheid A
wordt nooit stil gebruikt in hoedanigheid B (MN-02, ARBEID par. 8.4).

**Organisatie.** Bij uitdiensttreding moet de rol weg op de dag dat het
dienstverband eindigt, niet pas als iemand eraan denkt. Een rol met einddatum
vervalt vanzelf in Werk OS (`rollen.js`). In de sleutelbos bestaat een
einddatum niet; daar is de bron het dienstverband zelf (afgeleid).

**Normen** (domein-max.txt, 2026-10-19):

| Eis | Bron | Betekenis voor Werk |
|---|---|---|
| ISO 27001:2022 Annex A, 93 maatregelen; de keuze volgt uit de risicobeoordeling | https://www.dqsglobal.com/blog/new-iso-27001-2022-key-changes | Toegang intrekken bij vertrek en periodieke toegangsbeoordeling zijn gangbare maatregelen. Werk kan tonen sinds wanneer een rol bestaat (`sinds`). |
| Cyberbeveiligingswet (NIS2) zorgplicht, sinds 15-8-2026 | https://www.ncsc.nl/cyberbeveiligingswet-nis2/meldplicht | Sterke authenticatie voor kantoortoegang (passkey) past daarbij. RTG beoordeelt niet of een klant onder de wet valt. |
| AVG art. 12: inzageverzoek binnen 1 maand | https://autoriteitpersoonsgegevens.nl/nl/zelf-doen/gebruik-uw-privacyrechten/recht-op-inzage | Een lid moet kunnen zien welke werkrollen en starts over hem bewaard zijn. |
| Registratie arbeids- en rusttijden (ATW), 52 weken | https://www.nlarbeidsinspectie.nl/nederlandse-arbeidsinspectie/sancties-en-handhavingsmethoden/boete/boetes-atw | Een werkstart via de kiezer is **geen** arbeidstijdregistratie. De klok woont bij de zaak. |

---

## d. Functiecatalogus L1–L6

### L1 Persoonlijk

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Rollen tonen | bestaat (`/api/account/rollen`) | `accountRollen` + afgeleid | alleen eigen key | afgeleide rol volgt de bron | het lid | eigen account | gast 403 | Een lid ziet precies de werkrollen die aan zijn account hangen, ook de afgeleide. | — | bestaat |
| Werk openen | bestaat (`/api/account/start`) | rol + code + staffId | munt dezelfde sessie als de losse inlog | locatie kan nodig zijn | — | pin; kantoor passkey | locatie geweigerd: start faalt met reden | Een tik opent de juiste app met een werkende sessie; een rol die er niet is opent niets. | — | bestaat |
| Bron van de rol tonen ("waarom heb ik dit") | ontbreekt | `sinds`, soort koppeling (dienstverband, uitnodiging, bewijs, afgeleid) | per rij de bron, geen nieuwe opslag | — | het lid | eigen account | afgeleide rol zonder datum: "afgeleid, geen koppeldatum" | Onder elke knop staat waarom ik die rol heb en sinds wanneer. | klein | aanbevolen nu |
| Eerlijke lege staat | half: tekst verouderd | `app-main-25.js` | tekst volgt `koppelen.js` | — | nieuw lid | — | — | De lege kiezer noemt alleen wegen die werken (wervingslink, uitnodiging, werkruimtekoppeling), niet de personeels-PIN. | klein | aanbevolen nu |
| Zelf ontkoppelen in de kiezer | half: route bestaat, geen scherm in `public/apps` roept hem aan (grep) | `/api/account/ontkoppel` | kantoor: sluit open sessies | personeel is afgeleid: niet te ontkoppelen | het lid; bij kantoor ook het kantoor | eigen account | afgeleide rol: uitleg in plaats van knop | Ik kan een gekoppelde rol loslaten; een rol uit een dienstverband zegt dat hij met het dienstverband eindigt. | klein | later |

### L2 Professioneel

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Manager landt in zaak-app | bestaat (`WERKDOEL.zaak` bij `manager`) | `staffRole` | geen nieuwe bevoegdheid, alleen landing | — | — | — | — | Een manager komt in de Leverancier-app en niet in de PDA. | — | bestaat |
| Meerdere werkgevers onderscheiden | half (naam + zaaknaam op knop) | `zaakNaam`, `naam` | soort relatie als label: dienstverband / werkruimte / kantoor | — | — | — | twee zaken met gelijke naam: code erbij | Bij twee werkgevers zie ik bij welke ik open en welk soort relatie het is. | klein | aanbevolen nu |
| Kantoor via passkey | bestaat | passkey, uitnodiging | geen passkey: naar passkey-pagina | — | — | kantoor | — | Zonder passkey opent het kantoor niet in productie. | — | bestaat |

### L3 Organisatorisch

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Rol vervalt met het dienstverband | bestaat voor personeel (afgeleid) | dienstverband | lees de bron, geen kopie | dienstverband van vóór de brug: geen | — | — | zaak/kantoor/werkruimte zijn gekoppeld, niet afgeleid | Na uitdienst verschijnt de personeelsrol niet meer in de kiezer. | — | bestaat (voor personeel) |
| Concern-dienstverband zonder zaak als rol | ontbreekt | `kern/concern/employment.js`, `/api/concern/mijnwerk` | afgeleid, zoals personeel | — | — | eigen account | geen app-doel: vraagt besluit | Wie alleen een dienstverband bij een entiteit heeft, ziet in de kiezer waar hij heen kan. | klein | vraagt besluit |
| Geen stil verlies bij rol 11 | ontbreekt (`slice(-10)`) | `accountRollen` | weigeren met reden in plaats van de oudste weghalen | — | het lid | — | — | Een elfde koppeling wordt geweigerd met uitleg; geen bestaande rol verdwijnt zonder bericht. | klein | aanbevolen nu |

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
| Werkstarts van mezelf inzien | half: `klok-inlog` alleen voor manager en medewerker (`logboekzicht.js`) | logActivity per zaak | eigen inzage vrij | — | het lid | eigen account | kantoor- en werkruimtestarts staan elders | Ik zie mijn eigen werkstarts per werkgever. | klein | later |

### L6 RTG-samenhang

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Werving -> personeelsrol | bestaat | `/api/werving/verbind` | claim met lidsessie | — | — | eigen account | Foundation-profiel via uitnodiging (ARBEID 7a) | Na de wervingslink staat de zaak in de kiezer. | — | bestaat |
| Werkruimte -> rol | bestaat (afgeleid uit `lid.rtgKey`) | `db.data.werkruimtes` | geen nieuw bewijs | — | — | koppeling vanuit werkruimte | — | Wie zijn account aan een werkruimte koppelde, opent Werk OS zonder tweede inlog. | — | bestaat, onbewezen |
| Kantooruitnodiging -> rol | bestaat | `kantoor/uitnodiging.js` | op naam | — | — | eigenaar nodigt uit | — | De uitnodiging werkt alleen voor het account waarvoor hij is gemaakt. | — | bestaat |

### Modus LOS

Kerntaak met alle werk-apps uit: tonen dat er rollen zijn. Een rol waarvan de
app niet beschikbaar is, opent niet. De kiezer vangt de fout op en toont
"Openen lukte niet" in een banner (`bannerToon`), maar zegt niet welke app
uitviel. **Wat het scherm eerlijk hoort te zeggen**: "Uw rol bij <zaak> staat,
maar <app> is nu niet bereikbaar. Er is niets veranderd aan uw rol." De rol
blijft in de sleutelbos.

### Modus SAMEN: Sara, kok bij MERIDIAAN en lid van een werkruimte

| Stap | Wat gebeurt er | Bron |
|---|---|---|
| 1 | Sara maakt een gratis RTG-account. De kiezer is leeg. | `/api/account/rollen` |
| 2 | De zaak werft haar. Ze verbindt via de wervingslink en wordt personeel. | `/api/werving/verbind` |
| 3 | Een ondernemer nodigt haar uit in zijn Werk OS-werkruimte. Ze koppelt vanuit de werkruimte (`/api/bedrijf/lid/koppel`). | `bedrijf/aansluiting.js`, `eenaccount/afgeleid.js` |
| 4 | Ze zegt tegen Rahul "open werk" en ziet twee knoppen: Team Room bij MERIDIAAN en Werk OS. | `app-main-25.js` |
| 5 | Ze opent Team Room. De zaak vraagt haar locatie, die ze geeft. De sessie start; om 23:30 verschijnt de welzijnszin. | `starten.js`, `startspoor.js` |
| 6 | Ze gaat uit dienst bij MERIDIAAN. De personeelsrol verdwijnt; Werk OS blijft. | afgeleid |

Storingen in deze keten:

| Storing | Wat de gebruiker ziet | Wat bewaard blijft |
|---|---|---|
| Geen sessie | 401 met melding | niets veranderd |
| Locatie geweigerd | "Openen lukte niet" en de fout van de server | rol blijft |
| Dubbele tik | twee werkende sessies, geen fout (proef herstelbaar 1) | — |
| Crash na ontkoppelen | kantoor dicht, personeel open (proef herstelbaar 3) | de ontkoppeling |
| Elfde koppeling | **nu**: de oudste rol verdwijnt stil (fout); **gewenst**: weigering met reden | nu: verlies van een rij |
| Werkruimte opgeheven | rol verdwijnt (afgeleid) | — |
| Ander lid probeert haar kantoor | 404 of 403 | — |

---

## e. RTG-exclusieve mogelijkheden

| Mogelijkheid | Eigenaar | Capability | Waarom geen markt-app dit kan |
|---|---|---|---|
| Eén account voor personeel, zaak, kantoor en een klantwerkruimte, met codenaam | Werk (`os:werk`, eigenaar open) | `kern/eenaccount.js` | Bij de markt zijn werkgever-IdP's gescheiden per tenant. Hier is de mens de sleutelbos. |
| De personeelsrol volgt het dienstverband zonder kopie | Concern (`werk.concern`) bezit, Werk leest | `afgeleid.js`, `concern/aanname.js` | Een IdP weet niet wanneer een arbeidsrelatie juridisch eindigt. |
| Kantoor loslaten sluit open sessies direct | Werk + kantoor | `kantoorIntrekking` | Vereist dat sessies en rollen in één huis staan. |

---

## f. Bouwstenen en ontbrekende koppelingen

**Bestaande bouwstenen:**
- `server/kern/eenaccount.js` en `server/kern/eenaccount/afgeleid.js`;
- `public/apps/app-main/app-main-25.js`;
- `scripts/lib/voltooi/werk.js`.

**Ontbrekende koppelingen**

| Van -> naar | Vorm | Toestemming |
|---|---|---|
| concern employment (zonder zaak) -> kiezer | afgeleide rol | eigen account |
| sleutelbos -> SCHERMEIGENAAR | registratie | besluit eigenaar |
| kiezer -> "bron van de rol" | projectie op bestaande velden | eigen account |
| voltooiproef -> rollen zaak en werkruimte | proefstappen | — |

---

## g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Lege-staat-tekst gelijk aan `koppelen.js` | klein | laag | geen | aanbevolen nu |
| Elfde koppeling weigeren in plaats van stil afkappen | klein | laag | geen | aanbevolen nu |
| Bron en soort relatie onder elke knop | klein | laag | `accRollen` | aanbevolen nu |
| Voltooiproef uitbreiden met zaak, werkruimte en locatie | klein | laag | `voltooiwereld.js` | aanbevolen nu |
| SCHERMEIGENAAR-entry voor `os:werk` | klein | laag | besluit 1 | aanbevolen nu, na besluit |
| Ontkoppelen in de kiezer | klein | laag | route bestaat | later |
| Eigen werkstarts inzien | klein | laag | `logboekzicht.js` | later |
| Concern-dienstverband als rol | klein | middel | besluit 2 | vraagt besluit |
| Rol voorspellen | — | — | — | niet doen |

---

## h. Toetsbaar eindcontract Beyond Premium

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| Breedte | Alle vier rollen (personeel, zaak, kantoor, werkruimte) openen hun app | `scripts/lib/voltooi/werk.js` | 2 van 4 in de proef |
| Professionele diepte | Een manager landt in de zaak-app; twee werkgevers zijn te onderscheiden | proefstap | manager-tak niet in de proef |
| Levenscyclus | Van nul rollen via koppelen tot uitdienst en ontkoppelen | proef | personeel en kantoor ja; uitdienst niet |
| Samenwerking en rollen | Een ander lid opent geen rol van mij; een gast krijgt 403 | proef + BEVOEGD | proef ja; BEVOEGD NT |
| Domeinintelligentie | De welzijnszin blokkeert nooit en scoort niets | unittoets op `startspoor.js` | niet gevonden |
| Los functioneren | Als een doel-app uitvalt, zegt de kiezer dat en blijft de rol staan | proef met uitgeschakelde app | niet gemeten |
| RTG-ketens | Werving -> kiezer -> Team Room, en uitnodiging -> kantoor | proef | ja (lokaal) |
| Bewezen betrouwbaarheid | APPWERKT acht bewijzen B | APPWERKT.json | 0 B; GF/NT, lokaal 4/4 gesloten, centraal te stempelen |

Dit contract vervangt de acht bewijzen van APPWERKT niet.

---

## Twee uitkomsten

### (A) Binnen de huidige architectuur en scope

| Functie | Kosten | Bouwt op |
|---|---|---|
| Lege-staat-tekst gelijk aan de werkelijke koppelwegen | klein | `koppelen.js` (personeel 403 op PIN) |
| Weigering bij een elfde rol in plaats van `slice(-10)` | klein | `server/kern/eenaccount.js` |
| Bron en soort relatie per knop | klein | `accRollen`, `afgeleid.js` |
| Voltooiproef: zaak, werkruimte, locatieNodig | klein | `scripts/lib/voltooi/werk.js` |
| SCHERMEIGENAAR-entry (na besluit) | klein | SCHERMEIGENAAR.json |
| Ontkoppelen en eigen starts in de kiezer | klein | `/api/account/ontkoppel`, `logboekzicht.js` |

### (B) Het domeinmaximum, ook buiten de huidige scope

Dit is richting en geen toezegging. Wat buiten scope valt, staat als besluit.

**Proces 1: Werkidentiteit over werkgevers heen (joiner-mover-leaver).**

Stappen:
1. Aanname bij de entiteit.
2. Rol verschijnt (afgeleid).
3. Functiewissel: rol wijzigt met datum.
4. Tijdelijke rol bij een tweede vestiging.
5. Periodieke toegangsbeoordeling door de werkgever, alleen over zijn eigen
   rollen.
6. Uitdienst: alle rollen bij die werkgever vervallen op de einddatum.
7. Het lid behoudt zijn account, zijn loopbaanregel en zijn loonstroken.

Rollen: medewerker, manager, HR, eigenaar van de entiteit.

Apps en eigenaren:
- Concern (`werk.concern`): de bron;
- Werk: de kiezer, eigenaar open;
- Team Room, Werk OS, Loonstrook en Loopbaan.

Nodig buiten scope:
- SCIM-provisionering vanuit een externe HR-bron (externe koppeling);
- een toegangsbeoordeling als handeling (besluit);
- rollen met einddatum in de sleutelbos zelf (besluit, botst nu met
  "afgeleid").

**Proces 2: De meervoudige werker (horeca + zzp + vrijwilliger).**

Stappen:
1. Per werkgever een eigen rol.
2. Een gezamenlijk beeld van eigen uren over alle werkgevers heen, alleen voor
   het lid zelf: ATW geldt per werkgever, maar het lid wil zijn totaal zien.
3. Een signaal aan het lid zelf bij te weinig rust, nooit aan een werkgever.

Apps en eigenaren:
- Werk;
- Vrijheid (`kern/vrijheid/`, eigenaar Team Room);
- Leven als overkoepelende projectie, nooit eigenaar.

Nodig buiten scope:
- een besluit dat uren van werkgever A nooit zichtbaar worden voor werkgever
  B (MN-02 hard maken);
- een lid-eigen urenbeeld (nieuw, besluit).

---

## Productfouten gezien (niet gerepareerd)

1. **Verouderde lege-staat-tekst.**
   - In `public/apps/app-main/app-main-25.js` zegt de lege kiezer: "Bewijs
     eenmalig uw werk-inlog (bijvoorbeeld uw personeels-PIN in de
     leverancier-app)".
   - `server/kern/eenaccount/koppelen.js` weigert die koppeling met 403:
     "een personeelspin kan niet meer worden gekoppeld".
2. **Stil verlies bij de elfde koppeling.**
   - `server/kern/eenaccount.js` doet `db.data.accountRollen[key] = rij.slice(-10)`.
   - Een elfde koppeling verwijdert de oudste rol zonder bericht. Bij een
     personeelsrol is de plek dan wel al geclaimd (`claimStaffMember`).
3. **Geen SCHERMEIGENAAR-entry voor `os:werk`.**

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
