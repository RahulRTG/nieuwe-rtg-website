# Vertegenwoordiging (link:vertegenwoordiging)

**Volledige werkzaamheid:** Vertegenwoordiging doet volledig waarvoor ze er is
als een vertegenwoordiger vanuit de app een machtiging voorstelt, de cliënt
vooraf in de simulatie ziet wat opengaat en wat nooit opengaat, zelf aanvaardt
(bij een minderjarige met de handtekening van de voogd na een besluit op naam
van het kantoor), de vertegenwoordiger daarna binnen grens en plafond iets
klaarzet dat bij de cliënt aankomt in de app die het uitvoert, en de cliënt per
direct kan intrekken met het spoor intact; zonder dat een derde lid iets ziet of
de machtiging ooit iets doet wat op de NOOIT-lijst staat. Toets:
`scripts/lib/voltooi/vertegenwoordiging.js`, `test/jeugdbestuur.e2e.test.js` en
`test/handelenspoor.test.js`; het stuk "vanuit de app" en "komt aan" is vandaag
niet waar (zie HERSTEL en VERDIEPING).

Eigenaar: `mandaat.beheer` → `apps/vertegenwoordiging.html` (SCHERMEIGENAAR.json,
doelgroep lid). Ingang: de app Vertegenwoordiging ("Het team om mij heen"). Doelgroep:
het lid als cliënt, het lid als vertegenwoordiger (manager, boekhouder, coach,
ouder) en het kantoor voor één handeling: het voogdijbesluit. Diepte-document:
`MENSNETWERK.md`, met `CARRIERE.md` erboven en `RUGDEKKING.md` ernaast.

De kernzin uit MENSNETWERK.md, en daar hangt deze kaart aan: **geen
organisatorische relatie met RTG kan menselijke toestemming vervangen, verruimen,
doorgeven of reconstrueren.**

---

## a. Inventaris van het bewezen bestaande

### Wat er staat

| Laag | Wat | Pad |
|---|---|---|
| Scherm | het eigen team, de lijst "voor wie ik optreed", de grens, de simulatie, aanvaarden en intrekken | `public/apps/vertegenwoordiging.html` (233 regels) |
| Routes | `bevoegdheden`, `mijn`, `simulatie`, `voorstel`, `aanvaard`, `intrek`, `grens`, `handel`, `voogd/vraag`, `voogd/rol`, `voogd/tekent` | `server/routes/vertegenwoordiging.js` |
| Kantoorroute | het voogdijbesluit, achter `kluisAuth`, op naam | `server/routes/office/voogdij.js` (`/api/office/voogdij/besluit`) |
| Kern | regels (db-vrij), keten, jeugdbestuur, simulatie | `server/kern/vertegenwoordiging/` (10 bestanden): `bevoegdheden.js`, `machtiging.js`, `machtiging-gebruik.js`, `acties.js`, `handelen.js`, `simulatie.js`, `jeugd.js`, `jeugd-acties.js`, `jeugd-tekent.js`, `index.js` |
| Mutatiecontracten | vastgelegd vóór de routes | `server/lib/mutatiecontracten-vertegenwoordiging.js` |
| Opslag | collectie `vertegenwoordigingen` (per cliënt een dossier met `machtigingen`, `grens`, `log`), duurzaam vastgelegd via `server/lib/duurzaam` | `kern/vertegenwoordiging/index.js` |
| Toetsen | `test/vertegenwoordiging.test.js`, `test/vertegenwoordiging.e2e.test.js`, `test/jeugdbestuur.e2e.test.js`, `test/mn01-bevoegdheidsvoordeel.test.js`, `test/mn02-hoedanigheidsscheiding.test.js`, `test/mn02ai-contextbesmetting.test.js`, `test/mn03-commercieelvoordeel.test.js` | `test/` |

De regels in code, kort:
- **Gesloten lijst** van 9 bevoegdheden (`aanbod.ontvangen`, `aanbod.bespreken`,
  `beschikbaarheid.delen`, `agenda.voorbereiden`, `reis.voorbereiden`,
  `contract.lezen`, `contract.opstellen`, `factuur.voorbereiden`,
  `loopbaan.lezen`), elk met naam, grond, `raakt` en `klaarzetten`.
- **NOOIT-lijst** van 7 (geld verplaatsen, definitief tekenen, bankgegevens
  wijzigen, gezondheid inzien, privéberichten lezen, iemand anders machtigen,
  pas of toegang wijzigen), elk met de plek waar die grens woont.
- 7 hoedanigheden: zaakwaarnemer, manager, boekhouder, advocaat, coach,
  assistent, ouder.
- Een machtiging heeft altijd een einddatum, maximaal 60 maanden
  (`MAX_MAANDEN`). De stand (`voorgesteld`, `actief`, `verlopen`, `ingetrokken`)
  wordt bij elke vraag gerekend en nooit opgeslagen.
- Aanvaarden doet alleen de cliënt; bij het aanvaarden versmalt de machtiging tot
  de doorsnede met wat de cliënt zelf mag (`versmalNamens`). Onbepaalbaar geeft
  503 en niets gaat open.
- De eigen grens van de cliënt versmalt ook machtigingen die al lopen.
- Een bedrag zonder plafond wordt geweigerd; boven het plafond beslist de cliënt.
- Intrekken kan door cliënt, vertegenwoordiger en voogd, per direct. Het spoor
  blijft staan.
- Jeugdbestuur: de jongere wijst aan, de volwassene aanvaardt de rol, een mens
  van RTG bevestigt na bewijs (op naam, niet op de gedeelde kantoorcode), en de
  voogd tekent mee. De voogd kan niet ook de vertegenwoordiger zijn. RTG
  raadpleegt geen gezagsregister.
- `/handel` legt een spoorregel vast en zet hooguit klaar ("Klaargezet. De
  cliënt bevestigt; er is niets verstuurd of vastgelegd."). Er is geen
  koppeling naar een uitvoerend domein. Sinds commit 54a828f zegt het antwoord
  bij een bevoegdheid zonder klaarzetten ook eerlijk "Toegestaan binnen de
  machtiging en genoteerd in het spoor van de cliënt. RTG heeft hier zelf niets
  uitgevoerd; de handeling doet u in de app waar ze hoort." en draagt het
  `uitgevoerd: false` (`test/handelenspoor.test.js` toets 4). Daarvoor zei het
  "Uitgevoerd binnen de machtiging".

### Wat bewezen is

- **APPWERKT.json** (gemeten 19 oktober 2026, niet gecommit): bereikbaar B,
  bedienbaar B, menselijk NT, voltooibaar GEEN_FIXTURE, waarheidsgetrouw B,
  persistent GEEN_FIXTURE, bevoegd NT, herstelbaar GEEN_FIXTURE.
- **Voltooiproef op deze tak**: lokaal gesloten 4/4 (19-10, dc501544), centraal
  nog te stempelen. Voltooibaar 7/7, persistent 3/3, herstelbaar 3/3, menselijk
  (afgeleid) 3/3. Het scenario (`scripts/lib/voltooi/vertegenwoordiging.js`)
  loopt `/bevoegdheden`, `/mijn`, `/grens`, `/simulatie`, `/aanvaard` en
  `/intrek`, met de vertegenwoordiger via `/voorstel` en `/handel` en een derde
  lid dat er niet bij komt. Herstelbaar zag onder meer: "afgebroken (client gaf
  op), grens agenda.voorbereiden,contract.opstellen, lopende machtiging versmald
  tot aanbod.ontvangen".
- **BEVOEGD.json** (stempel 05:08, 55ed79f9): NIET_GETEST, zonder telling.
- **IDOR.json** (huisbreed): 1999 routes, 0 doorbraken, 0 lekken.
- **MN-01, MN-02, MN-02-AI en MN-03** staan als toets met mutaties gezien zakken
  (MENSNETWERK.md par. 7, regels 2a tot 2d, 13 september 2026). MN-03 is een
  vooruitgeschoven post: de regel heeft vandaag geen onderwerp.

### Wat de code of het document zelf "niet gebouwd" noemt

- Het scherm roept `voorstel`, `handel` en `voogd/*` niet aan. Een
  vertegenwoordiger kan in de app geen voorstel doen; de jongere ziet zijn
  jeugdbestuur niet (het veld `jeugd` uit `/mijn` wordt niet getoond). Staat,
  onbewezen in de app; alleen via de API beproefd.
- MENSNETWERK.md par. 7: de **mens-relatie-keten** (Mila, twaalf schakels, tien
  storingen) is **niet gedraaid**; machtigingsbundel (8), rosterwerkblad (9),
  aanmeldweg voor een programma (6) en Rugdekking zichtbaar maken (1) staan op
  "een stap weg".
- Rugdekking heeft geen scherm en geen aanmeldweg (`server/kern/rugdekking/`
  bestaat; CAR-01, uitbetalen aan een mens, blijft dicht).
- De juridische zekerheidsindeling (par. 2.6) bestaat niet; er zijn losse zinnen
  "geen juridisch advies".
- Het woord `hoedanigheid` bestaat alleen in `kern/vertegenwoordiging/`; de
  envelop (`kern/envelop.js`) draagt het niet (par. 1.1).

---

## b. Marktvergelijking

Alle regels: geraadpleegd 19 oktober 2026, via WebSearch op het officiële domein
(via zoektool, live te controleren). Elke marktregel hieronder is daarom **(te
controleren)**. Merken staan hier alleen ter vergelijking.

| Leider | Achter de betaalmuur | Wij | Bron |
|---|---|---|---|
| Stagent (artiesten- en agentmanagement) | Solo: contracten met e-sign, facturen. Agency vanaf €119: 10 artiesten, advancing, afrekeningen. Enterprise €799: API (te controleren) | contracten met e-sign: **nee** (tekenen staat in NOOIT; Signature staat op 1 van 31 volgens AFSPRAAK.md). Facturen: **half** (`factuur.voorbereiden` zet klaar, maar landt nergens). Rooster van meerdere artiesten: **half** (`ikSta` toont de lijst; een rosterwerkblad ontbreekt). Advancing en afrekening: **nee**. API: **nee** | https://stagent.com/pricing |
| Gigwell | Contracten, Tour IQ, rapportage [bronnen spreken elkaar tegen] (te controleren) | contracten: **half** (lezen en concept klaarzetten); tourplanning: **nee**; rapportage per programma: **nee** | https://www.gigwell.com/pricing |
| Sportagenten | geen bron gevonden | niet vergeleken | niet gevonden |
| Duurste enterprisepakket voor vertegenwoordiging | niet gevonden in de werkbestanden; het duurste gevonden niveau is Stagent Enterprise (€799) (te controleren) | zie boven | https://stagent.com/pricing |

Wat de markt niet heeft en wij wel: een gesloten bevoegdhedenlijst met een
NOOIT-lijst die de cliënt vóór aanvaarding ziet, een simulatie vooraf, een eigen
plafond dat ook lopende machtigingen versmalt, een verplichte einddatum, en een
jeugdbestuur met drie verschillende handtekeningen. In de markt beheert het
agentschap de artiest; hier beheert de mens zijn team. Dat is het verschil, en
het is ook de reden dat "Enterprise met API" bij ons geen vanzelfsprekende stap
is (zie Vraagt besluit 4).

---

## c. Analyse van het volledige domein

**Particulier.** Een mens laat iemand iets namens hem doen: een ouder voor een
kind, een volwassen kind voor een ouder, een boekhouder voor een zzp'er, een
vriend die een reis klaarzet. Het risico zit in drie plekken: de reikwijdte
("mag alles"), de looptijd ("tot wederopzegging") en de geldstroom (de
vertegenwoordiger verlegt de betaling naar zichzelf). De code dekt alle drie met
de gesloten lijst, de verplichte einddatum en de NOOIT-lijst.

**Professioneel.** Een manager, agent of boekingskantoor werkt voor meerdere
cliënten tegelijk, onderhandelt, leest contracten, zet facturen en reizen klaar,
en verdient vaak een percentage. Hier ontstaat het belang (MENSNETWERK par. 1):
wie verdient aan welke keuze. Daarvoor staan MN-03 (geen commercieel voordeel)
en besluit 2 (managementvergoeding).

**Organisatie.** Een bureau met meerdere managers en specialisten (travel,
rights, finance). De markt doet dat met delegatie binnen het bureau. Het huis
verbiedt delegatie: een team is een constellatie van losse machtigingen; een
lead stelt voor en verleent nooit (par. 3). RTG zelf als vertegenwoordiger is
besluit 1.

**Wet en norm.** De werkbestanden (`domein-max.txt`) bevatten geen bron over
volmacht, wettelijke vertegenwoordiging van minderjarigen, curatele, bewind of
mentorschap. Die regels bestaan in het Burgerlijk Wetboek, maar een bron is in
deze ronde **niet gevonden**; alles daarover is **te controleren** voordat het in
een scherm komt. Wat wel in de werkbestanden staat en hier raakt, komt uit een
zoeksamenvatting en is dus ook **(te controleren)**; geen van deze regels wordt
in deze kaart een harde weigerregel:
- AVG art. 12 (te controleren): rechten van betrokkenen binnen 1 maand, te
  verlengen met 2 maanden (https://autoriteitpersoonsgegevens.nl/nl/zelf-doen/gebruik-uw-privacyrechten/recht-op-inzage).
  Voor software: het spoor van de cliënt hoort als export beschikbaar te zijn;
  de termijn is een signaal, geen afgedwongen regel.
- AVG art. 33 (te controleren): een datalek binnen 72 uur melden en altijd intern registreren
  (https://autoriteitpersoonsgegevens.nl/nl/onderwerpen/beveiliging/meldplicht-datalekken).
  Voor software: een machtiging die meer zag dan bedoeld is een registreerbaar
  incident.
- Fiscale bewaarplicht art. 52 AWR, 7 jaar (te controleren)
  (https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/ondernemen/administratie/hoelang-moet-u-gegevens-bewaren):
  een factuur die een boekhouder klaarzette en de cliënt verstuurde, valt onder
  die plicht bij de eigenaar van de factuur, niet bij Vertegenwoordiging.
- Standaarden (MENSNETWERK par. 9, gemeten 13 september 2026; versies te
  controleren): W3C VC 2.0,
  OpenID4VCI 1.0, WebAuthn Level 3, C2PA 2.4. Besluit 4 houdt het eigen formaat.

**Wat dat betekent voor software.** Vertegenwoordiging is geen
uitvoeringsdomein. Het is de poort waar een handeling namens iemand langs moet.
Het werk zit dus niet in meer bevoegdheden, maar in drie dingen: (1) dat een
klaargezette handeling werkelijk bij de cliënt aankomt in het domein dat hem
uitvoert, (2) dat elk domein dat "namens" accepteert de machtiging opnieuw leest
op het moment van uitvoeren, en (3) dat de keten onder storing aantoonbaar
gescheiden blijft (de Mila-proef).

---

## d. Functiecatalogus L1–L6

### L1 Persoonlijk

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Machtiging aanvaarden met simulatie | bestaat, `kern/vertegenwoordiging/acties.js`, `simulatie.js` | voorstel + wat de cliënt zelf mag | doorsnede; leeg is dicht; 503 bij onbepaalbaar | geen: regels zijn bepaald | cliënt bij voorstel, vertegenwoordiger bij aanvaarding | alleen de cliënt | minderjarig: voogd tekent mee | een lid ziet vóór aanvaarden wat opengaat en wat nooit opengaat, en aanvaardt zelf | – | bestaat |
| Eigen grens | bestaat, `handelen.js` `grensZet` | gesloten lijst | versmalt ook lopende machtigingen, spoorregel `versmald` | geen | vertegenwoordiger ziet de versmalde machtiging | alleen de cliënt | – | een bevoegdheid op de grens is direct weg uit elke lopende machtiging | – | bestaat |
| Vervalbericht vooraf | ontbreekt | `tot` per machtiging | 30 en 7 dagen vóór `tot` een bericht aan beide kanten; geen automatische verlenging | geen | cliënt en vertegenwoordiger, via comm.mail of de app | cliënt beslist over verlengen | ingetrokken: geen bericht | niemand wordt verrast door een machtiging die vandaag stopt | klein | VERDIEPING, aanbevolen nu |
| Verlengen als nieuw besluit | half: de foutmelding zegt "verlengen kan altijd", er is geen route | bestaande machtiging | een verlenging is een nieuw voorstel met dezelfde bevoegdheden, opnieuw aanvaard; het oude spoor blijft | geen | cliënt | voorstel door vertegenwoordiger, aanvaarding door cliënt | jeugd: voogd tekent opnieuw | verlengen kost de cliënt één bevestiging en laat de oude machtiging in het spoor staan | klein | VERDIEPING, aanbevolen nu |
| Spoor als export | half: `log` (max 500) in `/mijn` | spoorregels | export op codenaam, alleen eigen dossier | geen | alleen cliënt | cliënt | – | een lid kan alles downloaden wat er namens hem is gedaan, op codenaam; de termijn uit AVG art. 12 is een signaal (te controleren) | klein | later |
| "Klaargezet voor u"-bak | ontbreekt: `/handel` zegt "klaargezet", maar het item landt nergens | spoorregel `handeling` met `klaarzetten: true` | projectie over het spoor, geen nieuwe tabel; per item een link naar het domein dat uitvoert | geen | cliënt direct (melding), vertegenwoordiger bij bevestigen of weigeren | cliënt bevestigt of weigert | verlopen machtiging: item vervalt zichtbaar | wat een vertegenwoordiger klaarzet, staat bij de cliënt met één knop "bevestigen in <app>" | middel | VERDIEPING, aanbevolen nu |

### L2 Professioneel

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Voorstel doen vanuit de app | half: route `/voorstel` bestaat, scherm niet (tekst r.101 zegt "Voorstellen doet u") | codenaam cliënt, hoedanigheid, bevoegdheden, `tot`, plafond | `M.vorm`; één open voorstel per paar; max 40 per lid | geen | cliënt bij indienen | iedere ingelogde vertegenwoordiger; cliënt beslist | minderjarig: melding dat de voogd meetekent | een manager kan in de app een voorstel doen zonder de API te kennen | klein | HERSTEL, aanbevolen nu (het scherm belooft het) |
| Rosterwerkblad (meerdere cliënten) | half: `ikSta` in `/mijn`; MN par. 7 nr. 9 "een stap weg" | machtigingen waar ik vertegenwoordiger ben | per cliënt: stand, `tot`, bevoegdheden, open klaargezette items; geen rangorde op cliënten | geen | alleen de vertegenwoordiger zelf | eigen sleutel | MN-02: geen kennis uit andere hoedanigheid | een manager ziet al zijn cliënten op één blad, zonder cijfer per mens | klein | VERDIEPING, aanbevolen nu |
| Machtigingsbundel (team) | ontbreekt; MN par. 3 en par. 7 nr. 8 | meerdere voorstellen van verschillende personen | één scherm, losse aanvaarding per stuk; lead stelt voor, verleent nooit | geen | cliënt; elke voorgestelde persoon | cliënt per machtiging | – | vijf teamleden in één beweging voorgesteld, vijf losse aanvaardingen in het spoor | middel | later (na Vraagt besluit 1) |
| Contract lezen met juridische klasse | ontbreekt; MN par. 2.6, par. 7 nr. 12 | een stuk gericht aan de cliënt (`contract.lezen`) | vier klassen naar het model van `kern/fiscaal/zekerheid.js`: bepaald, advies, voorbehouden; niet ingedeeld valt terug op de voorzichtige klasse | groot: tekstuitleg | cliënt bij elke uitspraak | vertegenwoordiger met `contract.lezen` | opzeggen namens iemand is voorbehouden | elke uitspraak over een contract draagt een klasse, en "zeg op" komt nooit uit de app | middel | later (besluit nodig, nr. 12) |
| Second opinion op een managementcontract | ontbreekt; MN par. 7 nr. 13 | het contract van cliënt en manager | na nr. 12; een mens met vakkennis beoordeelt (klasse advies) | groot | cliënt | cliënt vraagt aan | – | een talent kan zijn managementcontract laten nalezen zonder dat zijn manager het ziet | groot | later |
| Rechtenregister (`rechtenregister`, "Mijn rechten") | ontbreekt; MN besluit 3 | gebied, kanaal, looptijd, exclusiviteit, AI-gebruik | conflictcontrole tussen registraties; AI-gebruik en synthetische stem als aparte vragen | middel | cliënt bij conflict | cliënt; vertegenwoordiger leest met `contract.lezen` | geen stilzwijgende ja (grens 8) | twee overlappende exclusieve rechten geven een melding vóór het tekenen | middel tot groot | later (besluit 3) |
| Advancing en afrekening van optredens | ontbreekt | – | hoort bij de event- en geldkant, niet hier | – | – | – | – | – | groot | niet doen hier: eigenaar is STAGE (`STAGE.md`) en Geld; Vertegenwoordiging levert alleen de machtiging |

### L3 Organisatorisch

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Voogdijbesluit door kantoor | bestaat, `routes/office/voogdij.js`, `jeugd-acties.js` | stuk gezien door medewerker | op naam (`wieKijkt`), niet op gedeelde code; A3 + `leeftijdBron === 'paspoort'` | geen gezagsregister: RTG valideert niets inhoudelijk | jongere en voogd bij besluit | kantoor met kluisAuth | voogd ≠ vertegenwoordiger | een voogd tekent pas mee na een besluit van een herkenbare medewerker | – | bestaat |
| Jeugdbestuur in de app | half: routes bestaan, scherm toont niets ervan | `jeugd` uit `/mijn` | jongere wijst aan, voogd aanvaardt rol, voogd tekent | geen | jongere ziet wie meetekent (LEVEN.md par. 2) | jongere, voogd, kantoor | 18 geworden: oude machtiging blijft er een met twee handtekeningen | een jongere van 16 ziet in de app wie voor hem meetekent en kan het stoppen | klein | HERSTEL, aanbevolen nu (de route levert `jeugd`, het scherm toont het niet) |
| Herbeoordeling op 18 | ontbreekt; MN par. 7 nr. 11 "een besluit" | geboortedatum van het document | bij 18: elke lopende machtiging met `voogdNodig` krijgt een bericht "opnieuw bevestigen of laten aflopen"; nooit stil verlengen | geen | de nu volwassen cliënt | alleen de cliënt | – | op de dag dat iemand 18 wordt, ziet hij welke afspraken voor hem werden getekend | klein | later (besluit 11) |
| RTG Management als vertegenwoordiger | ontbreekt; MN besluit 1 | – | exact dezelfde rail, geen kantoorweg; MN-03 vóór de dienst | – | – | – | – | – | groot | later (besluit 1) |
| Programmameting | ontbreekt | uitkomsten per programma, nooit per mens | vorm van `kern/rtfos/gemeente.js` (outcomes ledger) | middel | programma-eigenaar | kantoor | grens 1: geen bedrag op een mens | het kantoor ziet "92% van de machtigingen correct beëindigd" en nergens een cijfer per persoon | middel | later |

### L4 Domeinintelligentie

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Simulatie vooraf | bestaat, `simulatie.js` (geen db) | voorstel, huidige machtiging, `magClient` | toont wat opengaat, wat niet, wat afvalt, dagen tot einde | geen: bepaald | cliënt | cliënt | – | de simulatie verandert niets in de opslag | – | bestaat |
| Gevolg bij intrekken | ontbreekt | open klaargezette items, lopende afspraken in andere domeinen | telt wat er openstaat bij intrekken; geen bedrag als de bron er geen heeft ("niet gerekend") zoals `bedrijf/gevolg.js` | middel: andere domeinen tellen niet allemaal | cliënt vóór bevestigen | cliënt | intrekken blijft altijd mogelijk, ook als er iets openstaat | wie intrekt ziet "2 klaargezette reizen vervallen" en kan toch direct intrekken | klein | VERDIEPING, aanbevolen nu |
| Hoedanigheid-context voor de AI | bestaat als toets, MN-02-AI (`test/mn02ai-contextbesmetting.test.js`) | contextbouwer van Rahul | geen kennis tussen hoedanigheden | – | – | – | – | de AI van een manager ziet geen ledenbaliewerk van dezelfde persoon | – | bestaat |
| Ongewoon-brede-machtiging-melding | ontbreekt | voorstel | regel: meer dan 6 van de 9 bevoegdheden of looptijd > 24 maanden → melding "advies", geen blokkade | laag: het is een regel, geen model | cliënt in de simulatie | cliënt | hoedanigheid ouder: geen melding | de simulatie zegt in gewone taal dat een voorstel ongewoon breed is, met de regel erbij | klein | later |

### L5 Volledige levenscyclus

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Mens-relatie-keten (Mila) | ontbreekt als proef; MN par. 7 regel 5 | synthetische mens, twaalf schakels, tien storingen | vorm van `scripts/tafelproef.js`, `ritproef.js`, `toelatingsproef.js` | – | – | – | begint bij de stand van het inzagejournaal | de keten loopt en meldt per schakel en per storing of identiteit, bevoegdheid, kennis en bewijs gescheiden bleven | middel | VERDIEPING, aanbevolen nu |
| Managerwissel zonder gat | half: intrekken en nieuw voorstel bestaan los | twee machtigingen | de nieuwe is actief vóór de oude stopt, of het gat staat zichtbaar in het spoor | geen | cliënt, oude en nieuwe manager | cliënt | – | bij een wissel ziet de cliënt of er een dag zonder vertegenwoordiging is | klein | later |
| Vertrek van de cliënt | half: spoor blijft; export ontbreekt | dossier | bij opzeggen account: alle machtigingen ingetrokken, spoor als export mee | geen | alle vertegenwoordigers | cliënt | bewaartermijnen gaan voor | na vertrek kan niemand meer namens hem iets klaarzetten, en hij heeft zijn spoor | klein | later |
| Wettelijke vertegenwoordiging (curatele, bewind, mentorschap) | ontbreekt | – | bron niet gevonden in de werkbestanden; te controleren | groot: juridisch | – | – | – | – | groot | niet doen nu: een rechterlijk besluit is geen machtiging en hoort niet in deze gesloten lijst; eerst een besluit over de grens |

### L6 RTG-samenhang

Vertegenwoordiging **geeft uit**: een machtiging (wie, wat, tot wanneer, plafond)
en een spoorregel. Zij **ontvangt**: wat de cliënt zelf mag (bevoegdheidslijst),
de leeftijd en het betrouwbaarheidsniveau (`kern/volwassen.js`,
`kern/betrouwbaarheid.js`) en het voogdijbesluit van het kantoor. Zij voert zelf
niets uit.

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| `agenda.voorbereiden` → Agenda | ontbreekt | machtiging + voornemen | Agenda (`agenda.afspraken`) maakt een voorlopige afspraak met herkomst `rtg://machtiging/<id>`; Agenda leest de machtiging opnieuw bij bevestigen | geen | cliënt bij klaarzetten | cliënt bevestigt in Agenda | machtiging ingetrokken: voornemen vervalt | een klaargezette afspraak staat in de agenda van de cliënt als voorlopig en wordt pas echt na zijn tik | middel | VERDIEPING, later (zie g.: na "Klaargezet voor u") |
| `reis.voorbereiden` → Reizen | ontbreekt | machtiging + reisvoornemen | TravelOS kent een voornemen naast een boeking (REIZEN.md); de vertegenwoordiger vult het voornemen | geen | cliënt | cliënt boekt en betaalt | NOOIT: geld verplaatsen | een manager zet een reis klaar en de cliënt boekt zelf | middel | later |
| `contract.opstellen` → Documenten | ontbreekt | concept | concept in de documenten van de cliënt (`docs.bestanden`), met herkomst | geen | cliënt | cliënt; tekenen staat in NOOIT | – | het concept staat in de documenten van de cliënt en niet bij de manager | middel | later |
| `factuur.voorbereiden` → Onderneming | ontbreekt | concept-factuur | debiteurenkant van `werk.onderneming`; versturen blijft van de cliënt | geen | cliënt | cliënt verstuurt | fiscale bewaarplicht ligt bij de eigenaar van de factuur | een boekhouder zet een factuur klaar, de ondernemer verstuurt hem | middel | later |
| `loopbaan.lezen` → Loopbaan | ontbreekt als leespad | `loopbaan.ledger` | alleen-lezen, geen gezondheid, geen privé | geen | cliënt ziet in zijn spoor dat er is gelezen | machtiging | intrekken stopt het lezen direct | de manager leest het loopbaanboek en de cliënt ziet wanneer | klein | later |
| `aanbod.ontvangen` → berichten | ontbreekt | aanbod gericht aan de cliënt | een kopie naar de vertegenwoordiger, geen toegang tot het postvak (NOOIT: privéberichten) | geen | beide | machtiging | – | een aanbod komt bij beiden binnen; andere post van de cliënt nooit | middel | later |
| Rugdekking zichtbaar | ontbreekt; MN par. 7 nr. 1 "een halve dag" | `server/kern/rugdekking/` | alleen tonen dat de relatie bestaat; CAR-01 blijft dicht | geen | de mens zelf | de mens | – | een mens ziet dat de relatie bestaat, zonder bedrag | klein | VERDIEPING, aanbevolen nu, mits de eigenaar van Rugdekking het scherm toewijst (Vraagt besluit 6) |

### Modus LOS

Als Agenda, Reizen, Documenten en Onderneming uit staan, blijft de kerntaak
volledig: een lid beheert wie namens hem mag handelen, met grens, simulatie,
spoor en intrekken. `/handel` blijft een spoorregel. Per groep, met de
letterlijke tekst die het lid ziet als iets ontbreekt (u-vorm). "Bestaat"
betekent: de zin staat zo in de code; "voorstel" betekent: deze kaart stelt hem
voor.

**Eigen (Vertegenwoordiging bezit het en kan het altijd).** De gesloten lijst,
de NOOIT-lijst, voorstel, simulatie, aanvaarden, eigen grens, intrekken, het
spoor, het oordeel van `/handel`.
- Een bevoegdheid zonder klaarzetten: "Toegestaan binnen de machtiging en
  genoteerd in het spoor van de cliënt. RTG heeft hier zelf niets uitgevoerd; de
  handeling doet u in de app waar ze hoort." (bestaat, sinds 54a828f)
- Na de eigen grens blijft niets over: "Na uw eigen grens blijft er niets van
  deze machtiging over." (bestaat, `acties.js`, begin van de zin)

**Noodzakelijke platformdiensten.** Account en sessie, de identiteitskluis en
het betrouwbaarheidsniveau (`kern/volwassen.js`, `kern/betrouwbaarheid.js`),
duurzame opslag (`server/lib/duurzaam`), de bevoegdheidslijst van de cliënt
(`versmalNamens`), het kantoor op naam voor het voogdijbesluit.
- Wat de cliënt zelf mag, is niet te bepalen: 503 met de reden van
  `versmalNamens`; er gaat niets open. (bestaat)
- Leeftijd niet vast te stellen: "RTG kan van dit lid niet vaststellen dat het
  18 of ouder is." (bestaat, `acties.js`)
- Opslag faalt bij vastleggen: 503 "Dit is niet vastgelegd; probeer het zo nog
  een keer." (bestaat, `server/lib/duurzaam.js`)
- Kantoor niet op naam: "Wacht op bevestiging door een medewerker van RTG."
  (voorstel)

**Optionele koppelingen (andere apps).** Agenda (`agenda.afspraken`), Reizen
(`reizen.reisboek`), Documenten (`docs.bestanden`), Onderneming
(`werk.onderneming`), Loopbaan (`loopbaan.ledger`), RT Mail (`comm.mail`).
- Klaargezet zonder aangesloten app: "Klaargezet staat in uw spoor. Er is geen
  app aangesloten waarin u het kunt bevestigen; er is niets verstuurd."
  (voorstel)
- Loopbaan uit bij `loopbaan.lezen`: "Het loopbaanboek is nu niet te lezen; er
  is niets gelezen en niets genoteerd." (voorstel)
- RT Mail uit: het vervalbericht verschijnt alleen in de app; "Dit bericht kon
  niet per mail; u ziet het hier." (voorstel)

### Modus SAMEN als contractblok (voorstel)

Dit is een VOORSTEL; `scripts/lib/appcontract.js` blijft zoals het is. De
huidige regel daar draagt alleen `belofte` en de voltooiproef.

```js
samen: {
  functie: 'link:vertegenwoordiging', familie: 'WorkOS',
  belofte: 'een lid bepaalt zelf wie namens hem mag handelen, met een eigen grens, simulatie vooraf, spoor en intrekken per direct; wat een vertegenwoordiger klaarzet komt aan in de app die het uitvoert en wordt daar pas echt na de tik van de cliënt',
  ingang: '/apps/vertegenwoordiging.html',
  bestanden: ['server/routes/vertegenwoordiging.js', 'server/routes/office/voogdij.js',
    'server/kern/vertegenwoordiging/acties.js', 'server/kern/vertegenwoordiging/handelen.js',
    'server/kern/vertegenwoordiging/simulatie.js', 'server/kern/vertegenwoordiging/jeugd-acties.js',
    'server/kern/namens/versmalling.js', 'server/lib/mutatiecontracten-vertegenwoordiging.js'],
  scenario: 'scripts/lib/voltooi/vertegenwoordiging.js',
  ketens: [
    { naam: 'jeugdbestuur', uitgeeft: 'aanwijzing van de voogd door de jongere', ontvangt: 'besluit op naam van een medewerker, rol aanvaard door de voogd',
      vorm: 'gebeurtenis', eigenaar: 'mandaat.beheer', toestemming: 'kluisAuth op naam (niet de gedeelde kantoorcode); A3 en leeftijd van het document',
      storingen: ['gedeelde kantoorcode: geweigerd, niets bewaard', 'geboortedatum zelf ingetypt: geen jeugdbestuur, melding aan de jongere', 'voogd is ook vertegenwoordiger: geweigerd'],
      proef: 'test/jeugdbestuur.e2e.test.js' },
    { naam: 'klaargezette afspraak in de agenda', uitgeeft: 'gebeurtenis "klaargezet" met verwijzing rtg://machtiging/<id>', ontvangt: 'een voorlopige afspraak, opnieuw getoetst bij bevestigen',
      vorm: 'gebeurtenis', eigenaar: 'agenda.afspraken', toestemming: 'bevoegdheid agenda.voorbereiden; de cliënt bevestigt in Agenda',
      storingen: ['machtiging ingetrokken voor de tik: voornemen vervalt zichtbaar', 'Agenda uit: item blijft in het spoor met de tekst "geen app aangesloten"', 'dubbele tik op bevestigen: één afspraak'],
      proef: 'ontbreekt (Mila-keten, VERDIEPING)' },
    { naam: 'concept in de documenten van de cliënt', uitgeeft: 'concept met herkomst', ontvangt: 'niets terug; tekenen staat op de NOOIT-lijst',
      vorm: 'verwijzing', eigenaar: 'docs.bestanden', toestemming: 'bevoegdheid contract.opstellen',
      storingen: ['Documenten uit: concept blijft een spoorregel', 'machtiging verlopen: concept wordt niet geplaatst'],
      proef: 'ontbreekt' },
    { naam: 'loopbaan lezen', uitgeeft: 'een leesregel in het spoor van de cliënt', ontvangt: 'alleen-lezen projectie van het loopbaanboek, zonder gezondheid of privé',
      vorm: 'projectie', eigenaar: 'loopbaan.ledger', toestemming: 'bevoegdheid loopbaan.lezen, per vraag opnieuw gelezen',
      storingen: ['intrekken midden in een sessie: de volgende vraag krijgt 403'],
      proef: 'ontbreekt' },
    { naam: 'bericht bij voorstel, verval en intrekken', uitgeeft: 'bericht aan de cliënt of vertegenwoordiger', ontvangt: 'niets',
      vorm: 'gebeurtenis', eigenaar: 'comm.mail', toestemming: 'geen extra; de ontvanger is partij',
      storingen: ['RT Mail uit: bericht alleen in de app'],
      proef: 'ontbreekt' }
  ]
}
```

### Modus SAMEN: een volledige keten

Een muzikant van 17 (Mila) met een manager en een boekhouder.

1. Mila opent Vertegenwoordiging. Haar identiteit is gezien (A3) en de
   geboortedatum komt van het document. Zij wijst haar moeder aan als voogd
   (`/voogd/vraag`).
   - Storing: geboortedatum zelf ingetypt. Zij ziet: "RTG kan niet vaststellen
     dat u minderjarig bent; laat uw identiteit verifiëren." Bewaard: niets.
2. De moeder aanvaardt de rol (`/voogd/rol`). Een medewerker bevestigt op naam
   (`/api/office/voogdij/besluit`).
   - Storing: medewerker logt in met de gedeelde kantoorcode. De kern weigert;
     bewaard: niets; de jongere ziet "wacht op bevestiging".
3. De manager stelt een machtiging voor: `aanbod.ontvangen`, `aanbod.bespreken`,
   `agenda.voorbereiden`, plafond €2.500, 12 maanden (`/voorstel`).
   - Storing: dubbele tik. Tweede antwoord 409 "Er staat al een voorstel van u
     open"; bewaard: één voorstel.
4. Mila opent de simulatie en ziet wat opengaat en de NOOIT-lijst. Zij zet
   `agenda.voorbereiden` op haar grens. Zij aanvaardt; haar moeder tekent mee.
   - Storing: Mila aanvaardt, de moeder tekent niet. Stand blijft
     `voorgesteld`; de manager krijgt 403 bij handelen met de reden.
5. De manager zet een aanbod van €3.000 klaar (`/handel`).
   - Storing: boven plafond. 403, spoorregel met `gelukt: false`; Mila ziet de
     poging in haar spoor.
6. (Aanbevolen nu) Het klaargezette item verschijnt in "Klaargezet voor u" met
   een knop naar de app die uitvoert.
   - Storing: die app staat uit (modus LOS). Mila ziet het item met de tekst
     "geen app aangesloten"; het spoor blijft staan.
7. Mila wordt 18. (Later, besluit 11) Zij krijgt een bericht dat haar machtiging
   met twee handtekeningen werd getekend en kan opnieuw bevestigen of laten
   aflopen.
8. Mila trekt in. Per direct dicht; het spoor blijft; (aanbevolen nu) zij ziet
   vooraf wat er vervalt.
   - Storing: crash direct na intrekken. Na herstart: ingetrokken blijft
     ingetrokken (duurzame vastlegging; de voltooiproef herstelbaar 3/3 dekt
     een verwante storing).

---

## e. RTG-exclusieve mogelijkheden

| Mogelijkheid | Eigenaar | Capability | Waarom geen markt-app dit kan |
|---|---|---|---|
| Een machtiging die in elk RTG-domein opnieuw gelezen wordt op het moment van uitvoeren | `mandaat.beheer` (machtiging); het uitvoerende domein leest | verwijzing `rtg://machtiging/<id>` + `M.stand()` | een agency-app beheert alleen zijn eigen contracten; zij ziet de agenda, reis en documenten van de cliënt niet en kan ze dus ook niet begrenzen |
| Eén NOOIT-lijst die ook de AI bindt | `mandaat.beheer` + `kern/stuur/mandaat.js` | dezelfde grammatica (versmallen, nooit verlenen) | in de markt is de AI-assistent een los product met eigen rechten |
| Jeugdbestuur met een herkenbare medewerker en een gezien document | `mandaat.beheer` + kantoor | `jeugd.js`, `/api/office/voogdij/besluit` | een markt-app heeft geen identiteitskluis met A3 en geen kantoor dat op naam tekent |
| Loopbaan lezen zonder gezondheid of privé | `loopbaan.ledger` levert, `mandaat.beheer` begrenst | `loopbaan.lezen` | het loopbaanboek bestaat alleen hier |
| Hoedanigheidsscheiding, bewezen met mutaties | huisbreed, getoetst hier | MN-02, MN-02-AI | een systeem waarin dezelfde persoon manager en baliemedewerker is, bestaat buiten RTG niet in één product |

---

## f. Bouwstenen en ontbrekende koppelingen

**Bestaande modules om op te bouwen**
- `server/kern/vertegenwoordiging/` (regels, keten, jeugd, simulatie)
- `server/kern/namens/versmalling.js` (`versmalNamens`, de huiswet van
  versmallen)
- `server/kern/stuur/mandaat.js` (dezelfde grammatica voor de AI)
- `server/kern/volwassen.js`, `server/kern/betrouwbaarheid.js` (leeftijd en
  niveau)
- `server/kern/ledenbalie-inzage.js`, `server/inzagelog.js`,
  `server/inzagelog-vast.js` (besluit 5: geen inzage zonder geslaagd journaal)
- `server/kern/fiscaal/zekerheid.js` (model voor een juridische klasse)
- `server/kern/rugdekking/` (relatie bestaat, scherm ontbreekt)
- `scripts/tafelproef.js`, `scripts/ritproef.js`, `scripts/toelatingsproef.js`
  (vorm voor de Mila-keten)

**Ontbrekende koppelingen**

| Van → naar | Vorm | Toestemming |
|---|---|---|
| Vertegenwoordiging → Agenda (`agenda.afspraken`) | gebeurtenis "klaargezet" met verwijzing; Agenda maakt een voorlopige afspraak | machtiging `agenda.voorbereiden`, cliënt bevestigt in Agenda |
| Vertegenwoordiging → Reizen (`reizen.reisboek`) | verwijzing naar een voornemen | `reis.voorbereiden`; boeken door cliënt |
| Vertegenwoordiging → Documenten (`docs.bestanden`) | concept met herkomst | `contract.opstellen`; tekenen NOOIT |
| Vertegenwoordiging → Onderneming (`werk.onderneming`) | concept-factuur | `factuur.voorbereiden`; versturen door cliënt |
| Loopbaan (`loopbaan.ledger`) → Vertegenwoordiging | alleen-lezen projectie | `loopbaan.lezen`, opnieuw gelezen per vraag |
| Elk uitvoerend domein → Vertegenwoordiging | leesvraag `stand(m)` + `magHandelen` bij uitvoeren | geen; leest alleen |
| Vertegenwoordiging → comm.mail | bericht bij voorstel, verval, intrekken | geen extra; de cliënt is de ontvanger |
| Rugdekking → een scherm | projectie | de mens zelf |

---

## g. Prioritering

### HERSTEL

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Eerlijke tekst bij `/handel` zonder uitvoerend domein | – | – | – | gerepareerd (commit 54a828f, `test/handelenspoor.test.js` toets 4) |
| Voorstel doen vanuit de app: het scherm belooft "Voorstellen doet u" (r. 101) en roept `/voorstel` niet aan | klein | laag: route bestaat | geen | aanbevolen nu |
| Jeugdbestuur tonen: `/mijn` levert `jeugd`, het scherm toont het niet; `/voogd/*` heeft geen knop | klein | laag: routes bestaan | geen | aanbevolen nu |
| Voltooiproef centraal stempelen; BEVOEGD tellen (NIET_GETEST) | klein | laag | – | aanbevolen nu |

### VERDIEPING

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| "Klaargezet voor u"-bak als projectie over het spoor | middel | middel | Vraagt besluit 5 | aanbevolen nu |
| Vervalbericht en verlengen als nieuw voorstel | klein | laag | comm.mail | aanbevolen nu |
| Mens-relatie-keten (Mila) als vierde ketenproef | middel | middel | voltooiwereld, kantoor op naam | aanbevolen nu |
| Gevolg bij intrekken (telling, "niet gerekend") | klein | laag | projectie over spoor | aanbevolen nu |
| Rosterwerkblad voor de vertegenwoordiger | klein | laag | `ikSta` | aanbevolen nu |
| Agenda-koppeling (eerste uitvoerend domein) | middel | middel | Agenda accepteert voorlopige afspraak | later |
| Machtigingsbundel | middel | middel | besluit 1 | later |
| Juridische zekerheidsklassen + second opinion | middel tot groot | hoog | besluit 12, dan 13 | later |
| Rechtenregister | middel tot groot | hoog | besluit 3 | later |
| Wettelijke vertegenwoordiging | groot | hoog | juridische bron, besluit | niet doen nu |
| Agency-API naar buiten | groot | hoog | besluit 4, LINK.md | niet doen nu: elke derde partij met schrijfrecht is een tweede vertegenwoordiger zonder machtiging |

---

## h. Toetsbaar eindcontract Beyond Premium

Dit contract vervangt nooit de acht bewijzen van APPWERKT.

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| Breedte | elke bevoegdheid met `klaarzetten: true` landt in een domein waar de cliënt hem kan bevestigen | registertoets: per sleutel uit `bevoegdheden.js` een doeldomein of een expliciete "geen domein, tekst X" | 0 van 6 klaarzet-bevoegdheden landen |
| Professionele diepte | een vertegenwoordiger met meerdere cliënten werkt volledig vanuit de app | voltooiproef uitgebreid met `/voorstel` vanuit het scherm en een blad met twee cliënten | voorstel alleen via API |
| Levenscyclus | voorstel, aanvaarden, verval, verlengen, 18 worden, intrekken, vertrek lopen allemaal door | Mila-keten: twaalf schakels gesloten | keten niet gedraaid |
| Samenwerking en rollen | geen delegatie, voogd ≠ vertegenwoordiger, kantoor op naam | `test/jeugdbestuur.e2e.test.js`, MN-01 | bestaat |
| Domeinintelligentie | simulatie vooraf en gevolg bij intrekken, beide zonder opslag | toets dat `simulatie.js` en de gevolgprojectie geen db krijgen | simulatie ja, gevolg nee |
| Los functioneren | met alle andere apps uit blijft de kern werken en zegt het scherm eerlijk dat er niets is verstuurd | voltooiproef met uitgeschakelde domeinen, tekstcontrole op het antwoord van `/handel` | antwoord van `/handel` eerlijk sinds 54a828f (`test/handelenspoor.test.js` toets 4); voltooiproef met domeinen uit niet gedraaid |
| RTG-ketens | elk uitvoerend domein leest de machtiging opnieuw op het moment van uitvoeren | storing "machtiging verloopt midden in een sessie" in de Mila-keten | niet beproefd |
| Bewezen betrouwbaarheid | voltooiproef centraal gestempeld, BEVOEGD geteld | `scripts/voltooiproef.js --alleen=vertegenwoordiging`, BEVOEGD-run | lokaal 4/4 (dc501544), centraal te stempelen; BEVOEGD NIET_GETEST |

---

## Twee uitkomsten

### (A) Binnen de huidige architectuur en scope

#### HERSTEL

| Functie | Kosten | Bouwt op | Bak |
|---|---|---|---|
| Eerlijke tekst bij `/handel` | – | `kern/vertegenwoordiging/handelen.js` | gerepareerd (commit 54a828f) |
| Voorstel doen vanuit de app; jeugdbestuur tonen | klein | `/voorstel`, `/voogd/*`, `jeugd` uit `/mijn` | aanbevolen nu |

#### VERDIEPING

| Functie | Kosten | Bouwt op | Bak |
|---|---|---|---|
| "Klaargezet voor u" als projectie over het spoor | middel | spoorregels `handeling`, `kern/namens/projectie.js` als vorm | aanbevolen nu |
| Vervalbericht, verlengen als nieuw voorstel | klein | `M.stand`, `/voorstel`, comm.mail | aanbevolen nu |
| Gevolg bij intrekken | klein | spoor + vorm van `bedrijf/gevolg.js` | aanbevolen nu |
| Rosterwerkblad | klein | `ikSta` | aanbevolen nu |
| Mila-keten als ketenproef | middel | `scripts/tafelproef.js`-vorm, voltooiwereld | aanbevolen nu |
| Agenda als eerste uitvoerend domein | middel | `agenda.afspraken`, herkomst `rtg://` | later |
| Spoor-export, managerwissel, vertrek | klein | dossier `vertegenwoordigingen` | later |
| Machtigingsbundel, herbeoordeling op 18 | middel / klein | `acties.js`, `jeugd.js` | later (besluit 1 en 11) |

### (B) Het domeinmaximum, ook buiten de huidige scope

Richting, geen toezegging. Een nieuw domein vóór V1 blijft uitgesloten; elk
punt hieronder dat er een vraagt, staat onder Vraagt besluit.

**Proces 1: de loopbaan van een talent, van eerste aanbod tot afscheid.**
- Stappen: aanmelden bij een programma → zelf beheerd beginnen → manager
  machtigen → aanbod ontvangen en bespreken → contract lezen, laten nalezen,
  zelf tekenen → optreden of wedstrijd plannen en reizen → factureren en
  afrekenen → rechten en gelijkenis bewaken → wisselen van manager → 18 worden
  (jeugd) → afscheid, met loopbaanboek en spoor mee.
- Rollen en organisaties: talent, voogd, manager, specialisten (rights,
  travel, finance), boekhouder, opdrachtgever of club, RTG-kantoor (voogdij,
  programma), eventueel RTG Management.
- Apps en eigenaar: Vertegenwoordiging (`mandaat.beheer`, de machtiging),
  Loopbaan (`loopbaan.ledger`, de feiten), Agenda (`agenda.afspraken`),
  Reizen (`reizen.reisboek`), Documenten (`docs.bestanden`), Onderneming
  (`werk.onderneming`, facturen), RT Mail (`comm.mail`), Bewijsmap
  (`identiteit.bewijzen`), STAGE voor podium en event.
- Buiten scope nodig: besluit 1 (RTG als vertegenwoordiger), besluit 2
  (vergoeding), besluit 3 (rechtenregister), besluit 12 (juridische klassen),
  CAR-01 (uitbetalen aan een mens, `GIFT.md` ervoor), een externe tekenweg
  (Signature staat op 1 van 31 in `AFSPRAAK.md`), en een advancing- en
  afrekeningsdomein bij STAGE en Geld.

**Proces 2: zorg voor een ouder, van eerste hulp tot nalatenschap.**
- Stappen: een volwassen kind wordt gemachtigd voor post en afspraken →
  reizen naar het ziekenhuis klaarzetten → administratie en facturen
  klaarzetten → toenemende afhankelijkheid → mogelijk een wettelijk
  vertegenwoordiger → overlijden en afwikkeling.
- Rollen: ouder, kinderen, huisarts en zorginstelling (extern), notaris en
  kantonrechter (extern), RTG-kantoor.
- Apps en eigenaar: Vertegenwoordiging (machtiging), Agenda, Reizen,
  Documenten, Geld (`geld.overzicht`, alleen tonen), de Foundation-zorgkant;
  nalatenschap heeft een eigen voltooiproef (`scripts/lib/voltooi/nalatenschap.js`)
  en dus een eigen eigenaar.
- Buiten scope nodig: een juridische bron en besluit over wettelijke
  vertegenwoordiging (curatele, bewind, mentorschap; te controleren), een
  externe koppeling met een register of rechterlijke uitspraak (niet
  aanwezig), en de grens met gezondheid (NOOIT-lijst; `kern/zorgniveau.js`).

**Proces 3: de boekhouder met een praktijk vol zzp'ers.**
- Stappen: klant machtigt boekhouder voor `factuur.voorbereiden` en
  `contract.lezen` → maandelijks facturen en btw klaarzetten → ondernemer
  bevestigt → jaarwerk → klant vertrekt, alles terug.
- Rollen: ondernemer, boekhouder, kantoor van de boekhouder, Belastingdienst
  (extern, voorbehouden).
- Apps en eigenaar: Vertegenwoordiging, Onderneming, de fiscale kern
  (`kern/fiscaal/`), Werk OS voor de praktijk van de boekhouder.
- Buiten scope nodig: een bevoegdheid "aangifte klaarzetten" vraagt een besluit
  over de gesloten lijst; indienen namens iemand blijft `voorbehouden` en dus
  een grens, geen te bouwen functie.

---

## Vraagt besluit

Uit MENSNETWERK.md par. 8 staan **besluit 1 tot en met 4 open**. Besluit 5, 6 en 7
zijn op 13 september 2026 genomen (optie A; besluit 7 staat als regel 18 in
`LAT.md`). De feitenlijst van deze ronde noemde besluit 7 nog open; het document
zegt genomen.

**1. Wordt RTG zelf vertegenwoordiger?** (MENSNETWERK besluit 1)
- **A. Ja, maar pas na poort 1 tot en met 3** (aanbevolen). De dienst komt er,
  en de grenzen staan er eerder dan het belang. Kost enkele dagen voor de
  poorten, daarna een dienst met mensen.
- B. Ja, nu. Sneller een eerste cliënt; het belang bestaat dan eerder dan de
  grens.
- C. Nee, alleen infrastructuur. Geen belangenconflict; RTG blijft gereedschap.

**2. De managementvergoeding** (besluit 2)
- **A. Per inkomstensoort, vooraf zichtbaar** (aanbevolen). Nul waar RTG niets
  deed. Kost een vijfde benoemde vergoeding.
- B. Vast maandbedrag. Simpel; een beginner betaalt voor werk zonder opbrengst.
- C. Percentage over alles. Dit is de commissieknop terug (MN-04).

**3. Het rechtenregister** (besluit 3)
- **A. Bouwen, beginnen bij AI-gebruik** (aanbevolen). Middelgroot; de
  conflictcontrole is het werk.
- B. Alleen registreren. Sneller; een register zonder conflictmelding is een
  spreadsheet.
- C. Niet.

**4. Het formaat onder de Bewijsmap** (besluit 4)
- **A. Eigen vorm houden, standaard later** (aanbevolen). Kost nu niets.
- B. Nu op VC 2.0 / OpenID4VCI. Middelgroot; raakt een laag die goed werkt.

**5. Waar landt "klaargezet"?** (nieuw, eigenaarschap)
- **A. Elk uitvoerend domein is eigenaar van zijn eigen voorlopige item;
  Vertegenwoordiging houdt alleen de verwijzing en het spoor** (aanbevolen).
  Geen tweede eigenaar. Kost per domein een kleine voorlopige stand.
- B. Een eigen "klaargezet"-bak in Vertegenwoordiging met kopieën van het item.
  Sneller; dan zijn er twee waarheden over dezelfde afspraak.
- C. Niets laten landen; de cliënt leest het spoor. Geen werk; "klaarzetten"
  blijft een woord zonder plek.

**6. Wie is eigenaar van het Rugdekking-scherm?**
- **A. Een eigen capability onder Loopbaan (`loopbaan.*`), omdat Rugdekking de
  relatie rond een loopbaan is** (aanbevolen). Kost een SCHERMEIGENAAR-regel en
  een halve dag.
- B. Een tab in Vertegenwoordiging. Eén app minder; Rugdekking gaat over geld
  aan een mens, en dat is geen machtiging.
- C. Wachten tot CAR-01 besloten is. Geen werk; de relatie blijft onzichtbaar.

**7. Wettelijke vertegenwoordiging (curatele, bewind, mentorschap)**
- **A. Niet in deze app; eerst een juridische bron en een eigen besluit**
  (aanbevolen). Kost nu niets.
- B. Een achtste hoedanigheid "wettelijk vertegenwoordiger". Klein in code; een
  rechterlijk besluit in een gesloten lijst van vrijwillige machtigingen is een
  categoriefout.

**8. Een bevoegdheid "aangifte klaarzetten" voor de boekhouder (uit B, proces 3)**
- **A. Niet nu; eerst de eerste uitvoerende koppeling (Agenda) bewijzen**
  (aanbevolen). Kost niets. De gesloten lijst wijzigt alleen met een besluit.
- B. Toevoegen als tiende bevoegdheid met `klaarzetten: true`. Klein in de lijst,
  middel in de fiscale kern; indienen blijft `voorbehouden`.
