# Loonstrook (link:loonstrook)

**Volledige werkzaamheid:** de app doet volledig waarvoor ze er is als een
medewerker met een eigen RTG-account elke definitieve strook van elke werkgever
waar hij werkt of werkte leest, met uitleg, de wettelijke kopregels of een
zichtbare "niet vastgelegd", een zekerheidsklasse, het dossier (wie keurde, welke
regelversie) en wie in zijn gegevens keek, terwijl een ander lid niets ziet.
Toets: de voltooiproef `scripts/lib/voltooi/loonstrook.js` sluit,
`test/loonstrook-oudmedewerker.test.js` is groen, en een strook op demo-tabellen
draagt nooit de klasse `bepaald`.

Eigenaar: `loon.strook` -> `apps/loonstrook.html` (SCHERMEIGENAAR: "Een werknemer
bekijkt zijn loonstroken en ziet wie er in zijn loongegevens heeft gekeken").
Ingang: `/apps/loonstrook.html`. Doelgroep: lid (de medewerker met een eigen
RTG-account). Het scherm schrijft niets.

De loonrun is niet van deze app. Hij is van Payroll OS: het loonkantoor
(`kantoor.payroll`, `apps/payroll.html`, doelgroep kantoor) opent, keurt en maakt
definitief; de zaak keurt als tweede oog via Team Room (`zaak.teamroom`,
`apps/personeel.html`, module `public/apps/personeel-hrmijn.js`, routes in
`server/routes/payroll-os-zaak.js`). Het dienstverband is van Concern
(`server/kern/concern/employment.js`, ARBEID.md par. 7a: employment is waarheid).
Verlof en verzuim zijn van `server/kern/vrijheid/` en `server/kern/payroll/verzuim.js`.

## a. Inventaris van het bewezen bestaande

**Wat er staat**

- Scherm: `public/apps/loonstrook.html` (256 regels); roept alleen
  `/api/member/loonstroken`, `/api/member/dossier` en
  `/api/member/identiteit/verzoeken` aan. Geen download, geen print.
- Routes: `server/routes/payroll-os-mens.js`.
  - `loonstroken`: per personeelsplek van het lid, ook een oude (sinds 1575572
    via `server/accounts/staff-historie.js`; inloggen blijft via
    `accounts.staffPositions`, alleen actief), de definitieve stroken; van een
    oude plek alleen stroken waarvan het periodejaar plus zeven niet vóór het
    huidige jaar ligt,
    uit `payrollOS.run.strokenVan`, met zaaknaam en een uitlegzin (`legUit`).
  - `dossier`: de vier vragen van `server/kern/payroll/dossier.js` (waarom, welke
    regel en versie, wie keurde, waar geboekt, aangegeven en betaald), alleen als
    de run op een eigen personeelsnummer staat; anders 404 "Deze loonstrook staat
    niet op uw naam".
  - `identiteit/verzoeken`: wie zijn identiteitspapieren opvroeg, met reden
    (`server/kern/payroll/identiteit.js`, journaal in `server/inzagelog.js`).
- Kern: `server/kern/payroll/` (run, motor, motor-controle, controles, dossier,
  correctie, aangifte, journaal, journaal-betalen, regelpakket, loonheffing,
  componenten, contracten, verzuim, inplanbaar, identiteit, opslag, valuta,
  dekking). Jaargang: `server/kern/payroll/jaargangen/nl-2026.json`.
- Opslag: `payrollRunsV2` (via `server/kern/payroll/opslag.js`).
- Wat een strook draagt (`motor.js`): periode, valuta, regelpakketversie,
  contract (uurloon, soort, uren per week), regels, rekenstappen, bruto,
  loonheffing, inhoudingen, netto, werkgeverslasten. Run: `correctieVan`,
  `opDemoTabellen`.
- Controles (`motor-controle.js`, `controles.js`): onder het minimumloon is een
  bevinding `hoog` die blokkeert; de motor repareert niets. De loonrun meldt
  `loon_zonder_dienstverband` (ernst midden) via `dienstverbandToets` in
  `server/kern/concern/aanname.js`.
- Toetsen: `test/loonstrook-portaal.test.js`, `test/loonstrook-oudmedewerker.test.js`, `test/payroll-*.test.js`,
  `test/payrollkeur.e2e.js`.

**Wat bewezen is**

| Bewijs | Stand | Bron |
|---|---|---|
| bereikbaar, bedienbaar, waarheidsgetrouw | BEWEZEN centraal | APPWERKT.json |
| voltooibaar, persistent, herstelbaar | GEEN_FIXTURE centraal; lokaal gesloten 6/6, 3/3, 4/4 | APPWERKT; voltooiproef 19-10 |
| menselijk | NIET_GETEST centraal; lokaal 3/3 (afgeleid) | idem |
| bevoegd | NIET_GETEST, geen telling in BEVOEGD.json | BEVOEGD.json |
| IDOR | huisbreed 0 doorbraken | IDOR.json |

Voltooiproef lokaal gesloten 4/4 (19-10, dc501544), centraal nog te stempelen.
De proef (`scripts/lib/voltooi/loonstrook.js`): werving met de link, contract
(vast, 32 uur), loonrun met vier ogen (zaak MERIDIAAN en een administrateur op
naam), definitief; het lid ziet netto en uitleg; dossier met minstens twee
goedkeuringen; inzagespoor leeg; een ander lid krijgt 0 stroken en 404; zonder
sessie 401; na herstart en SIGKILL precies één strook met hetzelfde netto. De
proef zegt zelf: op demo-tabellen, "zegt niets over juiste bedragen", geen
klokuren, geen betaalbestand en geen aangifte.

**Wat de code zelf als niet gebouwd opgeeft**

- `server/kern/payroll/opslag.js`: "De bewaarlaag (server/bewaarbeleid.js,
  bewaartermijnen.js) kent payroll nog niet."
- `server/kern/payroll/aangifte.js`: verzenden naar de Belastingdienst gebeurt
  niet; `dienIn` legt alleen vast dat er is ingediend.
- ARBEID.md par. 3: de naad aanname -> employment -> contract -> loon is half;
  `loon_zonder_dienstverband` blijft `midden` tot de inhaalslag gedaan is.

## b. Marktvergelijking

Alle regels: geraadpleegd 2026-10-19, (via zoektool, live te controleren).
Alleen ter vergelijking. Elke regel in deze tabel is **(te controleren)**: hij
komt uit een zoeksamenvatting, geen pagina is zelf geopend.

| Leider | Achter de betaalmuur | Wij | Bron |
|---|---|---|---|
| Nmbrs | Advanced: HR-workflows, e-sign, contractsjablonen, SSO, arbodienstkoppeling; Advanced Pro: ATS, declaraties, performance, MTO | contract en vier ogen ja; e-sign nee; arbodienst nee (bewust geen medische velden); declaraties nee in de strook; performance niet doen (geen score) | https://www.nmbrs.com/nl/payroll/ondernemingen/tarieven (te controleren) |
| AFAS Payroll (offerte) | 175 tot 200+ cao's standaard meegeleverd | nee: één NL-jaargang, op demo-tabellen; cao-regels niet | https://www.afas.nl/software/payroll (te controleren) |
| Personio | Core Pro: positiebeheer, API, personeelsplanning; payroll alleen in DE | positie half (Concern); planning half (Team Room) | https://www.personio.com/pricing/ (te controleren) |
| SAP SuccessFactors (duurste, offerte) | Employee Central Payroll in 52 landen | dekking voor 189 landen als minimum en vakantiegeldpercentage (`dekking.js`), geen volledige loonmotor per land | https://news.sap.com/2024/10/new-ai-sap-successfactors-hcm-suite-workforce-management-upskilling-organizational-evolution/ (te controleren) |

Wat bij geen van deze in de betaalmuurbeschrijving staat en bij ons wel: het
dossier per bedrag (vier vragen) en het inzagespoor voor de medewerker zelf.

## c. Analyse van het volledige domein

Geen van de wets- en normregels hieronder is in de primaire tekst nagelezen;
ze komen uit `domein-max.txt` (zoeksamenvattingen met bron-URL). Elke regel
draagt daarom het label **(te controleren)** en wordt nergens een harde
weigerregel; in d. en h. staat hij hooguit als signaal.

**Particulier (de werknemer).** Bij elke betaling een loonstrook met brutoloon en
opbouw, inhoudingen, het geldende minimumloon, namen van werkgever en werknemer,
periode, arbeidsduur en vakantiegeld (art. 7:626 BW) **(te controleren)**.
Bron: https://www.rijksoverheid.nl/onderwerpen/arbeidsovereenkomst-en-cao/vraag-en-antwoord/wat-staat-er-op-mijn-loonstrook.
Minimumloon 21+ per 1-7-2026: 14,99 euro bruto per uur (per 1-1-2026: 14,71);
20 jaar 11,99; 19 jaar 8,99; 18 jaar 7,50; 17 jaar 5,92; 16 jaar 5,17; 15 jaar 4,50
**(te controleren)**; de motor leest zijn eigen waarde uit het regelpakket, niet uit deze kaart.
Bron: https://www.rijksoverheid.nl/onderwerpen/minimumloon/bedragen-minimumloon/bedragen-minimumloon-2026.
Vakantie: wettelijk 4 keer de wekelijkse arbeidsduur, vakantiegeld minimaal 8%;
wettelijke dagen vervallen 6 maanden na het opbouwjaar, bovenwettelijke verjaren na 5 jaar
**(te controleren)**.
Bron: https://www.rijksoverheid.nl/onderwerpen/vakantiedagen-en-vakantiegeld.
De werknemer gebruikt stroken ook ná vertrek: UWV, hypotheek, huurtoeslag.

**Professioneel (de administrateur).** Aangifte loonheffingen per maand of 4 weken
**(te controleren)**.
Bron: https://www.belastingdienst.nl/wps/wcm/connect/nl/personeel-en-loon/content/loonaangifte-aangifte-loonheffingen.
Salarisadministratie 7 jaar bewaren (art. 52 AWR); kopie ID 5 jaar na uitdiensttreding;
overige personeelsgegevens 2 jaar (AP-richtlijn) **(te controleren)**. Let op: dit
is een bewaarplicht van de WERKGEVER, en geen grens aan wat de werknemer van
zichzelf mag lezen.
Bronnen: https://autoriteitpersoonsgegevens.nl/nl/onderwerpen/werk-en-uitkering/personeelsdossiers,
https://www.nlarbeidsinspectie.nl/onderwerpen/wet-arbeid-vreemdelingen/identiteitscontrole.
Inzagerecht van de betrokkene binnen 1 maand, te verlengen met 2 (AVG art. 12) **(te controleren)**.
Bron: https://autoriteitpersoonsgegevens.nl/nl/zelf-doen/gebruik-uw-privacyrechten/recht-op-inzage.

**Organisatie (de werkgever).** Loontransparantie (EU 2023/970): de omzettingstermijn
is gemist; wetsvoorstel ingediend 21-5-2026, beoogd 1-1-2027 **(te controleren)**.
Informatierecht voor werknemers, salarisindicatie in de vacature, rapportage
vanaf 150 medewerkers in 2028. Het is nog geen recht.
Bron: https://www.rijksoverheid.nl/actueel/nieuws/2026/05/21/meer-openheid-over-loonkloof-tussen-mannen-en-vrouwen.
Wet meer zekerheid flexwerkers per 1-1-2028 (bandbreedtecontract, max 30% verschil):
voorbereiden, nog geen recht **(te controleren)**.
Bron (secundair): https://www.sra.nl/nieuws/004501/2026/07/wet-meer-zekerheid-flexwerkers-aangenomen.

**Wat dat betekent voor software.**

- Een strook moet de 7:626-elementen dragen (te controleren). Wat ontbreekt,
  ontbreekt zichtbaar; een ontbrekend element blokkeert niets.
- Toegang tot eigen stroken hangt aan de persoon, niet aan een actieve
  personeelsplek (gerepareerd in 1575572). De zevenjaarsgrens die die reparatie
  in code zette, rust op een te-controleren regel die over de werkgever gaat;
  zie Vraagt besluit 1.
- Bewaren 7 jaar (te controleren) met een veger die zonder eigenaar niets wist.
  Als ondergrens wist hij niets en weigert hij niets.
- De strook draagt een zekerheidsklasse. Een definitieve strook op
  gecontroleerde tabellen is `bepaald` over de rekensom (als de gegevens kloppen);
  op demo- of ongecontroleerde tabellen nooit.
- Loontransparantie en Flexwet: alleen voorbereiden in de gegevens, niets
  beloven op het scherm.

## d. Functiecatalogus L1-L6

### L1 Persoonlijk

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Eigen stroken met uitleg | bestaat, `payroll-os-mens.js` | `payrollRunsV2`, `staff-historie.js` | alleen definitieve runs; `legUit` noemt de basis en extra's | demo-tabellen gemarkeerd (`opDemoTabellen`) | lid bij openen | alleen eigen personeelsnummer uit de koppeling | geen account: 403 | - | - | bestaat |
| Stroken na uitdiensttreding | gerepareerd (1575572): `server/accounts/staff-historie.js` geeft ook oude plekken; van een oude plek alleen stroken met periodejaar + 7 >= huidig jaar (UTC); inloggen bij de oude zaak blijft dicht | `supplier_staff` (ook inactief), runs | het lid ziet stroken van elke plek die ooit aan zijn account hing; de zevenjaarsgrens rust op art. 52 AWR (te controleren) en is een werkgeversplicht | of de grens er moet zijn: besluit 1 | lid | alleen het lid zelf; zaak niet | plek nooit aan een account gekoppeld: niet te zien, met uitleg | wie gisteren uit dienst ging, ziet vandaag zijn laatste drie stroken en hun dossier (`test/loonstrook-oudmedewerker.test.js`) | klein | herstel: gerepareerd (commit 1575572) |
| 7:626-kop op de strook (te controleren) | half: periode, contract, bruto, inhoudingen, netto staan; minimumloon, arbeidsduur in de periode, vakantiegeldopbouw en werkgeversnaam als juridische entiteit niet (workos.md par. 9, open) | strook, regelpakket (`minimumUurloon`), contract, Concern (entiteit) | minimumloon uit het regelpakket voor zijn leeftijdsgroep en periode; opbouw vakantiegeld uit de vakantiegeldgevende componenten (`componenten.js`) en het percentage van het regelpakket | leeftijdsgroep uit `leeftijdBron`: opgegeven of document; de elementenlijst zelf te controleren | lid | alleen het lid | land zonder pakket: "niet vastgelegd" | de strook toont het minimumloon dat voor hem gold in die maand en wat hij aan vakantiegeld opbouwde, of zegt per element "niet vastgelegd"; een ontbrekend element blokkeert de run niet | klein | herstel nu |
| Zekerheidsklasse per strook | ontbreekt; `kern/fiscaal/zekerheid.js` bestaat | run (`opDemoTabellen`, regelpakketstand) | gecontroleerde tabellen + definitief = `bepaald` over de rekensom; anders `advies`; onbekend valt terug op de voorzichtige klasse | dat bepaald niet "gegarandeerd juist" is, staat erbij | lid | - | correctierun: klasse van de correctie | op demo-tabellen staat nooit "bepaald" | klein | herstel nu (huisregel: uitkomsten dragen een klasse) |
| Strook downloaden of printen (pdf) | ontbreekt | strook | dezelfde inhoud als op het scherm | geen | lid | alleen het lid | - | het lid bewaart zijn strook als bestand voor de hypotheekverstrekker | klein | later |
| Jaaropgaaf | ontbreekt (niet gevonden in de code) | runs per kalenderjaar | som van definitieve runs plus correcties | correctie na 31 december | lid in januari | alleen het lid | meerdere werkgevers: één per werkgever | het lid ziet per werkgever één jaaroverzicht dat optelt tot zijn stroken | middel | later |

### L2 Professioneel (de administrateur namens de medewerker)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Dossier per strook (vier vragen) | bestaat, `kern/payroll/dossier.js` | run, journaal, aangifte | beantwoord / open / onbekend per vraag | "onbekend" vraagt actie | lid op verzoek | eigen strook | - | - | - | bestaat |
| Vraag over mijn strook | ontbreekt | strook, dossier | het lid stelt een vraag bij een regel; die komt bij de administrateur op naam | - | administrateur binnen een termijn; lid bij antwoord | lid stelt, kantoor antwoordt | correctie nodig: correctierun (`correctie.js`), nooit de strook herschrijven | het lid tikt op "toeslag" en vraagt waarom; het antwoord en een eventuele correctie staan bij die strook | middel | later (eigenaar kantoor.payroll voor de werkbak) |
| Correctie zichtbaar als correctie | half: `correctieVan` op de run | runs | correctie verwijst naar de oorspronkelijke run; oude strook blijft | - | lid bij definitief | - | - | het lid ziet "deze strook corrigeert augustus" met beide netto's | klein | verdieping nu |

### L3 Organisatorisch

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Inzagespoor voor de medewerker | bestaat voor identiteitspapieren, `identiteit.js`, `inzagelog.js` | inzagejournaal | elke opvraag met reden, zaaknaam | - | lid | - | - | - | - | bestaat |
| Inzagespoor over loongegevens zelf | ontbreekt: wie de run of strook van deze medewerker opende staat niet in het spoor van het lid | inzagelog | elke lezing door kantoor of zaak buiten de keuring wordt een regel met wie en waarom | wat "lezing" is, moet worden afgebakend | lid in zijn spoor | kantoor en zaakmanager | keuring zelf: één regel per run | het lid ziet "loonkantoor (naam), 12-10, reden: correctievraag" | middel | later |
| Bewaartermijn loonadministratie | ontbreekt (`opslag.js` zegt het zelf; workos.md par. 9, open) | `payrollRunsV2`, bevindingen | ondergrens 7 jaar (art. 52 AWR, te controleren), grond `wettelijk`; daarna veegrapport, standaard niets wissen | termijn te controleren | eigenaar bij het rapport | eigenaar zet veger aan | juridische bewaring gaat voor | een run van 2026 staat er in 2033 nog; de veger raakt hem niet eerder | klein | herstel nu |
| Loontransparantie: informatieverzoek | ontbreekt | functie, loon per functie en geslacht | voorbereiden; niet tonen tot het recht geldt | wet nog niet aangenomen (te controleren) | - | - | - | niets op het scherm tot de wet geldt | middel | later (na wet) |

### L4 Domeinintelligentie

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Waarom wijkt deze strook af | half: `controles.js` vergelijkt netto met vorige periode (25%) voor de administrateur | runs | dezelfde uitleg ook voor het lid, in gewone taal, met getallen | - | lid bij opening | eigen strook | eerste strook: niets te vergelijken | "netto 31% hoger dan juli: vakantiegeld 1.012,00" | klein | verdieping nu |
| Vooruitblik volgende strook | ontbreekt | contract, rooster, regelpakket | scenario met aannames, klasse `advies` | uren nog niet gewerkt | lid op verzoek | lid | - | de vooruitblik staat er met "verwacht" en de aannames, nooit als bedrag dat vaststaat | middel | later |
| Vakantiesaldo naast de strook | half: `kern/vrijheid/saldobron.js` | verlofgrootboek | wettelijk 4x weekuren; verval 6 maanden na opbouwjaar | saldo uit een tweede bron | lid | eigenaar `kern/vrijheid` | - | het lid ziet welke dagen op 1 juli vervallen | klein | later (eigenaar Vrijheid) |

### L5 Volledige levenscyclus

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Eerste strook na aanname | bestaat (ADAMPROEF schakel 17) | werving, contract, run | - | `loon_zonder_dienstverband` midden | - | - | - | - | - | bestaat |
| Eindafrekening | ontbreekt in de strookweergave | run, vakantiesaldo | uitbetaling resterende dagen en vakantiegeld | saldo moet kloppen | lid | kantoor | - | de laatste strook toont uitbetaalde dagen apart | middel | later (eigenaar Payroll OS) |
| Toegang na vertrek | gerepareerd (1575572), zie L1 | - | - | - | - | - | - | - | klein | herstel: gerepareerd (commit 1575572) |

### L6 RTG-samenhang

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Netto naar Geld | ontbreekt als verwijzing | strook | Geld (`geld.overzicht`) toont de verwachte en ontvangen loonbetaling met verwijzing naar de strook | betaling kan later komen | lid | lid | - | in Geld staat "loon september, zie strook" | klein | later (eigenaar Geld) |
| Werkgeverservaring naar Loopbaan | ontbreekt | dienstverband (Concern) | feit "werkte bij X als Y van-tot", nooit het bedrag (CAR-05) | - | lid kiest | lid zet, zaak bevestigt | - | - | klein | zie kaart loopbaan |
| Stroken in RTDocs | ontbreekt | pdf | eigen kopie in `docs.bestanden` op verzoek van het lid | - | lid | lid | - | - | klein | later |

**Modus LOS.** De kerntaak zonder andere apps: eigen definitieve stroken lezen,
met uitleg, dossier en inzagespoor. Het scherm schrijft niets. Wat ontbreekt,
zegt het in één zin, in de "u"-vorm die het scherm al gebruikt.

*Eigen (de app bezit het en kan het altijd).* De lezing van eigen stroken, de
uitlegzin (`legUit`), de demo-markering, het dossier per strook, het spoor van
wie identiteitspapieren opvroeg.
- Geen definitieve strook (staat er al, `public/apps/loonstrook.html`): "U heeft nog geen definitieve loonstrook. Zodra uw werkgever een loonrun afrondt, staat hij hier, met de uitleg erbij."
- Strook op demo-tabellen (staat er al): "Deze berekening staat op belastingtabellen die nog niet tegen de officiële bron zijn gelegd. De bedragen kunnen daardoor afwijken. Gebruik deze strook niet als bewijs van inkomen; vraag uw werkgever om een gecontroleerde versie."
- Een kopregel ontbreekt (na herstel): "Het minimumloon voor deze periode is niet vastgelegd in de loonrun; vraag uw loonadministratie."

*Noodzakelijke platformdiensten.* Account en sessie (`auth`), de koppeling
personeelsplek -> account (`server/accounts/staff-historie.js`), opslag
(`payrollRunsV2`), het inzagejournaal (`server/inzagelog.js`), de kluis voor
identiteitspapieren.
- Geen sessie: "Meld u aan met uw eigen RTG-account." (staat er al, 403)
- Geen koppeling: "Uw werkgever heeft uw personeelsplek nog niet aan uw RTG-account gekoppeld."
- Opslag niet beschikbaar: "Uw loonstroken zijn nu niet te laden. Er is niets veranderd; probeer het later opnieuw."
- Inzagejournaal niet beschikbaar: "Wie in uw gegevens keek, is nu niet te tonen. Het spoor zelf blijft bewaard."

*Optionele koppelingen.* Payroll OS (`kantoor.payroll`, de bron van elke strook),
Team Room (`zaak.teamroom`, de keuring door de zaak), Concern (dienstverband en
entiteitsnaam), Geld, Loopbaan, RTDocs.
- Payroll OS uit: "Uw stroken komen uit de loonrun van uw werkgever en het loonkantoor; staat daar niets definitief, dan staat hier niets."
- Concern uit: "De juridische naam van uw werkgever is nu niet te tonen; de strook zelf is volledig."
- Geld uit: "De loonbetaling is nu niet in Geld te zien; uw strook staat los daarvan."

**Modus SAMEN.** Keten "september, vakantiegeld, vertrek".

1. De zaak legt het contract vast in Team Room; Concern heeft het dienstverband.
   *Storing: geen dienstverband.* Zichtbaar voor de administrateur: bevinding
   `loon_zonder_dienstverband` (midden). Bewaard: de run gaat door; het lid ziet
   later een gewone strook.
2. Het kantoor opent de run; de zaak keurt; het kantoor keurt; definitief.
   *Storing: dubbele tik op definitief.* Bewaard: één strook (voltooiproef herstelbaar).
3. Het lid opent `loonstrook.html`: netto 31% hoger, uitleg "plus vakantiegeld".
   Dossier: twee goedkeuringen op naam, regelversie. *Storing: run op
   ongecontroleerde tabellen.* Zichtbaar: de demo-markering; na herstel ook de klasse `advies`.
4. Het lid ziet in het inzagespoor dat zijn zaak een kopie van zijn ID opvroeg,
   met reden. *Storing: opvraag zonder reden.* Die bestaat niet: de route vraagt
   een reden (`identiteit.js`).
5. Op 15 oktober haalt de manager hem uit het team (`/api/supplier/staff/remove`).
   Sinds 1575572 ziet hij zijn stroken en het dossier nog; inloggen bij de zaak
   kan niet meer. *Storing: de plek was nooit aan zijn account gekoppeld.*
   Zichtbaar: de koppelzin uit Modus LOS. Bewaard: de runs in `payrollRunsV2`.
   *Storing: strook ouder dan zeven kalenderjaren.* Vandaag: hij verdwijnt
   zonder melding uit de lijst (besluit 1).
6. Hij zet in Loopbaan "werkte bij Meridiaan Toren als receptie, 2026"; de
   manager bevestigt de regel. Geen bedrag in het ledger.

**SAMEN als contractblok (voorstel; `scripts/lib/appcontract.js` blijft ongewijzigd).**

```js
samen: {
  functie: 'link:loonstrook', familie: 'WorkOS',
  belofte: 'een medewerker ziet zijn eigen loonstrook met uitleg en dossier, ook na vertrek, en een ander lid ziet hem niet',
  ingang: '/apps/loonstrook.html',
  bestanden: ['public/apps/loonstrook.html'],
  scenario: 'scripts/lib/voltooi/loonstrook.js',
  ketens: [
    { naam: 'loonrun naar strook', uitgeeft: 'niets; de app leest alleen', ontvangt: 'definitieve run met dossier',
      vorm: 'projectie', eigenaar: 'kantoor.payroll', toestemming: 'zaak en kantoor keuren op naam; het lid leest alleen zijn eigen personeelsnummer',
      storingen: ['run niet definitief', 'demo-tabellen', 'dubbele tik op definitief', 'crash na definitief'], proef: 'scripts/lib/voltooi/loonstrook.js' },
    { naam: 'vertrek en toegang', uitgeeft: 'niets', ontvangt: 'oude personeelsplek uit de historie',
      vorm: 'verwijzing', eigenaar: 'zaak.teamroom', toestemming: 'alleen het lid zelf; inloggen bij de oude zaak blijft dicht',
      storingen: ['plek nooit gekoppeld', 'strook buiten de zevenjaarsgrens'], proef: 'test/loonstrook-oudmedewerker.test.js (toets, nog geen stap in de voltooiproef)' },
    { naam: 'contract tot strook', uitgeeft: 'niets', ontvangt: 'dienstverband en contract',
      vorm: 'projectie', eigenaar: 'werk.concern', toestemming: 'zaak legt vast',
      storingen: ['loon zonder dienstverband'], proef: 'scripts/adamproef.js (schakel 17)' },
    { naam: 'werkfeit naar loopbaan', uitgeeft: 'voorstel "werkte bij X als Y", nooit een bedrag', ontvangt: 'niets',
      vorm: 'verwijzing', eigenaar: 'loopbaan.ledger', toestemming: 'het lid zet, de zaak bevestigt',
      storingen: ['Loopbaan uit', 'zaak bevestigt niet'], proef: 'niet gebouwd' }
  ]
}
```

## e. RTG-exclusieve mogelijkheden

| Mogelijkheid | Eigenaar | Capability | Waarom geen markt-app dit kan |
|---|---|---|---|
| De medewerker ziet per euro wie keurde, met welke regelversie | Payroll OS / `loon.strook` | `kern/payroll/dossier.js` | bij markt-apps is de werknemersportal een pdf-map; het dossier is administratiekant |
| De medewerker ziet wie zijn papieren opvroeg, met reden | `loon.strook` | `identiteit.js`, `inzagelog.js` | werkgever en werknemer zitten in één huis, met de kluis ertussen |
| Eén account over meerdere werkgevers, ook na vertrek | `loon.strook` | `server/accounts/staff-historie.js` (1575572) | de strook hangt aan de persoon, niet aan het werkgeversabonnement |
| Werkervaring als bevestigd feit naast de strook, zonder bedrag | Loopbaan | `loopbaan.ledger` | loon en loopbaan delen het dienstverband, niet het geld |

## f. Bouwstenen en ontbrekende koppelingen

**Bouwstenen.** `server/routes/payroll-os-mens.js`, `server/kern/payroll/run.js`
(`strokenVan`), `dossier.js`, `motor.js`, `motor-controle.js`, `componenten.js`,
`correctie.js`, `identiteit.js`, `server/inzagelog.js`, `server/accounts/staff.js`, `server/accounts/staff-historie.js`,
`server/kern/fiscaal/zekerheid.js`, `server/bewaarbeleid.js`, `server/bewaarveger.js`,
`server/kern/vrijheid/saldobron.js`, `server/kern/concern/aanname.js`.

**Ontbrekende koppelingen.**

| Van | Naar | Vorm | Toestemming |
|---|---|---|---|
| strook | `zekerheid.js` | projectie: klasse per strook | - |
| regelpakket `minimumUurloon` | strook | projectie bij lezen, uit dezelfde versie als de run | - |
| `payrollRunsV2` | `bewaarbeleid.js` | regel in de tabel, grond wettelijk | eigenaar |
| kantoorlezing van een run | `inzagelog.js` | gebeurtenis | lid leest |
| strook | Geld | verwijzing | lid |

## g. Prioritering

De bak "aanbevolen nu" is gesplitst in **herstel** en **verdieping**.

**Herstel**

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Stroken na uitdiensttreding zichtbaar | klein | laag | `server/accounts/staff-historie.js` | gerepareerd (commit 1575572) |
| 7:626-kop (minimumloon, arbeidsduur, vakantiegeldopbouw, werkgever) of "niet vastgelegd" per element | klein | laag | regelpakket, `componenten.js`, Concern | herstel nu (workos.md par. 9) |
| Bewaartermijn loonadministratie als ondergrens in de bewaartabel | klein | laag | `bewaarbeleid.js` | herstel nu (workos.md par. 9) |
| Zekerheidsklasse per strook | klein | laag | `zekerheid.js` | herstel nu |
| Strook buiten de zevenjaarsgrens verdwijnt zonder melding | klein | laag | `payroll-os-mens.js`, besluit 1 | herstel nu, na besluit 1 |

**Verdieping**

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Afwijking uitgelegd voor het lid | klein | laag | `controles.js` | verdieping nu |
| Correctie zichtbaar als correctie | klein | laag | `correctie.js` | verdieping nu |
| Vertrek als stap in de voltooiproef | klein | laag | `scripts/lib/voltooi/loonstrook.js` | verdieping nu |
| Pdf, jaaropgaaf, vraag over mijn strook | klein tot middel | middel | kantoor.payroll | later |
| Inzagespoor op loongegevens | middel | middel | `inzagelog.js` | later |
| Vakantiesaldo, netto naar Geld, stroken in RTDocs | klein | laag | `kern/vrijheid/saldobron.js`, Geld, RTDocs | later (andere eigenaren) |
| Loontransparantie | middel | middel | wet | later, na wet |
| Prestatiebeloning of score op de strook | - | - | - | niet doen: geen cijfer op een mens |
| Een te-controleren wetsregel als blokkade van de run | - | - | - | niet doen: workos.md par. 11 |

## h. Toetsbaar eindcontract Beyond Premium

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| Breedte | vast en uurloon, correctie, meerdere werkgevers, oud-werkgever | uitbreiding `scripts/lib/voltooi/loonstrook.js` met klokuren, een correctierun en een vertrek | vast contract gemeten; vertrek getoetst in `test/loonstrook-oudmedewerker.test.js`; uren en correctie niet |
| Professionele diepte | elke strook draagt de 7:626-elementen (te controleren) of zegt per element "niet vastgelegd"; een ontbrekend element blokkeert niets | nieuwe toets op `/api/member/loonstroken` | half |
| Levenscyclus | stroken blijven zichtbaar voor de medewerker, ook na vertrek; een strook die buiten een grens valt verdwijnt nooit zonder melding | `test/loonstrook-oudmedewerker.test.js`, plus een toets op een strook van acht jaar oud | vertrek gerepareerd (1575572); de melding bij de grens ontbreekt |
| Samenwerking en rollen | zaak en kantoor keuren; een ander lid ziet niets | voltooiproef stap 5, `test/loonstrook-portaal.test.js` | lokaal gesloten |
| Domeinintelligentie | elke strook draagt een zekerheidsklasse; demo is nooit bepaald | toets op klasse | ontbreekt |
| Los functioneren | zonder Team Room en Concern blijven bestaande stroken leesbaar | voltooiproef met die apps uit | niet gemeten |
| RTG-ketens | contract tot strook tot loopbaanfeit | ADAMPROEF schakel 17 plus loopbaanstap | schakel 17 gesloten; loopbaanstap niet |
| Bewezen betrouwbaarheid | acht bewijzen centraal | APPWERKT.json | 3 BEWEZEN, 4 lokaal gesloten, bevoegd NIET_GETEST |

Dit contract vervangt nooit de acht bewijzen van APPWERKT.

## Twee uitkomsten

### (A) Binnen de huidige architectuur en scope

**Herstel**

| Functie | Kosten | Bouwt op |
|---|---|---|
| Stroken na uitdiensttreding | gerepareerd (commit 1575572) | `server/accounts/staff-historie.js`, `server/routes/payroll-os-mens.js` |
| 7:626-kop op de strook, met "niet vastgelegd" per element | klein | `server/kern/payroll/motor.js`, regelpakket, `componenten.js` |
| Zekerheidsklasse per strook | klein | `server/kern/fiscaal/zekerheid.js` |
| Bewaarondergrens loonadministratie | klein | `server/bewaarbeleid.js` |
| Melding bij een strook buiten de zevenjaarsgrens (na besluit 1) | klein | `server/routes/payroll-os-mens.js` |

**Verdieping**

| Functie | Kosten | Bouwt op |
|---|---|---|
| Afwijking en correctie uitgelegd voor het lid | klein | `controles.js`, `correctie.js` |
| Vertrek als stap in de voltooiproef | klein | `scripts/lib/voltooi/loonstrook.js` |
| Later: pdf, jaaropgaaf, vraag over mijn strook, inzagespoor op loongegevens, vakantiesaldo | klein tot middel | `dossier.js`, `inzagelog.js`, `kern/vrijheid/saldobron.js` |

### (B) Het domeinmaximum, ook buiten de scope (richting, geen toezegging)

**Proces 1. Het loonjaar van een werknemer.**
- Stappen: aanname en contract, uren of vast loon per periode, ziekte en verlof,
  loonrun, betaling, strook, vakantiegeld in mei, correcties, jaaropgaaf,
  aangifte inkomstenbelasting met de jaaropgaaf.
- Rollen: werknemer, manager, loonadministrateur, Belastingdienst, UWV.
- RTG-apps: Payroll OS (`kantoor.payroll`, eigenaar van de run), `loon.strook`
  (eigenaar van de medewerkerkant), Team Room, Vrijheid, Geld, RTDocs.
- Buiten de scope: indienen van de loonaangifte via een koppeling met de
  Belastingdienst (extern; namens een ander indienen blijft voorbehouden, dus
  een besluit), cao-regels per sector (bron, geen code: AFAS levert er 175+).

**Proces 2. Ziekte en re-integratie (Wet verbetering poortwachter).**
- Stappen: ziekmelding, week 6 probleemanalyse, week 8 plan van aanpak, elke
  6 weken bijstellen, week 42 melding UWV, eerstejaarsevaluatie (week 46 tot 52,
  te controleren), week 87-91 re-integratieverslag en WIA-aanvraag.
  Alle termijnen in deze stap **(te controleren)**. Bron: https://www.uwv.nl/nl/ervaringsverhalen/stappenplan-wet-verbetering-poortwachter.
- Rollen: werknemer, werkgever, arbodienst of bedrijfsarts, UWV.
- RTG-apps: `kern/payroll/verzuim.js` (geen medische velden), Team Room, `loon.strook`
  (loondoorbetalingspercentage).
- Buiten de scope: een termijnklok voor de poortwachter en een arbodienstkoppeling
  (nieuw domein en externe koppeling; besluit, en medische gegevens blijven buiten RTG).

**Proces 3. Uit dienst en daarna.**
- Stappen: opzegging, eindafrekening, getuigschrift (zie kaart loopbaan),
  toegang tot eigen stroken (besluit 1), kopie ID 5 jaar bewaren en dan wissen (te controleren).
- Rollen: werknemer, werkgever, loonkantoor.
- RTG-apps: Team Room, Payroll OS, `loon.strook`, Loopbaan, bewaarlaag.
- Buiten de scope: niets nieuws behalve besluit 1 over de duur van de toegang na vertrek.

**Proces 4. Loontransparantie bij de werkgever.**
- Stappen: functie-indeling, salarisschalen, salarisindicatie in vacatures,
  informatieverzoek van een werknemer, rapportage, herstel bij een kloof van 5%.
- RTG-apps: Werving (`server/routes/werving.js`, vacatures dragen al
  `salarisMin` en `salarisMax`, optioneel), Payroll OS, Concern.
- Buiten de scope: functiewaardering en een geslachtsgegeven in de
  loonadministratie (gevoelig; besluit), en de wet zelf.

## Vraagt besluit

1. **Hoe lang ziet een oud-medewerker zijn eigen stroken?** Sinds 1575572 zeven
   kalenderjaren (periodejaar + 7 >= huidig jaar), op grond van art. 52 AWR. Die
   regel is te controleren én gaat over de bewaarplicht van de werkgever, niet
   over wat de werknemer van zichzelf mag lezen.
   - **A (aanbevolen): zolang de run bestaat; de bewaarlaag (ondergrens zeven jaar) bepaalt wanneer hij weg mag, niet de leesroute.** Kost: klein; de grens in `payroll-os-mens.js` vervalt.
   - B: zeven jaar houden, maar een strook die erbuiten valt meldt dat in plaats van te verdwijnen. Kost: klein.
   - C: zo laten. Kost: nul; een strook verdwijnt op 1 januari zonder melding, op een te-controleren grond.
2. **Zekerheidsklasse op de strook.**
   - **A (aanbevolen): `bepaald` alleen bij gecontroleerde tabellen en definitieve run, anders `advies`.** Kost: klein.
   - B: geen klasse, alleen de demo-markering. Kost: nul; botst met de huisregel dat uitkomsten een klasse dragen.
3. **Wie bezit de "vraag over mijn strook"?**
   - **A (aanbevolen): de werkbak van `kantoor.payroll`, het lid stelt hem vanuit `loon.strook`.** Kost: middel.
   - B: Service (`service.hulp`). Kost: middel; Service kent het dossier niet.
