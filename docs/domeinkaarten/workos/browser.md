# Browser (link:browser)

Eigenaar: `web.browser` (SCHERMEIGENAAR.json, doelgroep `lid`), ingang
`/apps/browser.html`. Doel volgens het register: "Binnen de RTG-schil naar het web
surfen, met eigen startpagina, geschiedenis en bladwijzers." De code opent alleen
het interne RTG-web (`naam.rtg`): `server/kern/webmaker.js` zegt "Geen echte
domeinen, geen extern hosten". Die afwijking is een **vraagt besluit** (1).

## a. Inventaris van het bewezen bestaande

**Wat er staat**

- Scherm: `public/apps/browser.html` (462 regels): tabs, geschiedenis, bladwijzers
  in `localStorage` (`rtg_web_bladwijzers`, maximaal 40, alleen op dit toestel).
- Routes: `server/routes/webbrowser.js` (119 regels), alle achter `auth`:
  - `/api/browser/gids`: online sites, gesorteerd op bezoeken, maximaal 200;
  - `/api/browser/zoek`: sites (titel of adres) en zaken in één antwoord;
  - `/api/browser/open`: site openen, live zaakblokken oplossen
    (`server/kern/webplatform.js`), machinevertaling naar de taal van het lid
    met de melding dat het vertaald is (`server/kern/webplatform-taal.js`);
  - `/api/browser/bericht`: formulierbericht in zes soorten (vraag, offerte,
    sollicitatie, reservering, klacht, feedback), 3 tot 500 tekens, langs
    `server/kern/veilig.js`.
- Kern: `server/kern/webmaker-blader.js` (gids, zoek, open, eigenaar en zaak per adres).
- Gedrag van het bericht:
  - bij een ZAAK: een klus in de werklijst (`addTicket`) plus `notifySupplier`;
    herhaalsleutel als hash van sessie en `idem`, vingerafdruk van soort en tekst;
    zelfde sleutel met andere tekst geeft 409;
  - bij een LID: een DM via `commDm.stuur` met `idem`, alleen tussen verbonden
    leden; niet verbonden 403, onbekend adres 404, eigen site 400.
  - de afzender ziet "Zij zien uw codenaam, niet uw naam."
- Een persoonssite toont de codenaam van de maker, nooit de echte naam.

**Wat BEWEZEN is**

- APPWERKT.json (`link:browser`): bereikbaar B, bedienbaar B, menselijk NT,
  voltooibaar GF, waarheidsgetrouw B, persistent GF, bevoegd NT, herstelbaar GF.
- Voltooiproef op deze tak: lokaal gesloten 4/4 (19-10, dc501544), centraal nog te
  stempelen. Voltooibaar 7/7, persistent 3/3, herstelbaar 4/4, menselijk 3/3.
  Stap 2: "het lid opent de site: hij ziet de inhoud en de codenaam van de maker,
  nooit een echte naam". Scenario: `scripts/lib/voltooi/browser.js` (maker leest het
  gesprek, zaak ziet de klus, vreemde komt er niet door).
- BEVOEGD.json: NIET_GETEST zonder telling. IDOR.json: 0 doorbraken.
- Tests: `test/browser-zaakbericht.test.js`, `test/browser-id-contract.test.js`,
  `test/browserpoort.e2e.js`, `test/browser.js`.

**Staat, onbewezen**: machinevertaling, zoeken over zaken, bladwijzers en
geschiedenis (alleen lokaal, dus niet persistent over toestellen).

**Niet gebouwd**: elk extern adres. Geen synchronisatie van bladwijzers. Geen
leesweergave of afdruk. Hoe het ANTWOORD van een zaak op een websiteklus bij het
lid terugkomt, is in deze kaart niet nagetrokken (niet gevonden in
`webbrowser.js`; de klus leeft verder in de werklijst van de zaak).

## b. Marktvergelijking

Alleen ter vergelijking, nooit als partner. Geraadpleegd 2026-10-19. De vergelijking
is tweeledig: consumentenbrowsers (wat een lid kent) en enterprisebrowsers (wat een
organisatie koopt om de "laatste meter" te beheersen).

| Leider | Achter de betaalmuur | Wij | Bron |
|---|---|---|---|
| Brave | browser gratis; Search Premium $3, VPN $9,99, Leo Premium $14,99 | nee voor VPN en AI-assistent in de browser; zoeken alleen intern | https://brave.com/premium/ (via zoektool, live te controleren) |
| Opera | VPN Pro $7,99; Neon (agentische browser) $19,90 | nee; een agent die zelf surft botst met de stuurlaag (`server/kern/stuur/`) | https://www.opera.com/features/vpn-pricing-plan (via zoektool, live te controleren) |
| Island Enterprise Browser (offerte) | last-mile-controle op kopiëren, plakken, downloaden, uploaden, printen en screenshots, ook richting AI-tools; ZTNA, BYOD, auditlogging | half: binnen het RTG-web komt niets van buiten binnen, en elk bericht is begrensd en gekeurd; geen DLP op klembord of upload, want er is geen extern web | https://www.island.io/enterprise-browser (via zoektool, live te controleren) |
| Chrome Enterprise Premium ($6) | DLP, context-aware access, URL-filtering, evidence locker | nee; URL-filtering is overbodig zolang er geen extern web is | https://chromeenterprise.google/pricing/ (via zoektool, live te controleren) |
| Edge for Business | browser gratis; DLP en Conditional Access vragen E3/E5 | nee | https://learn.microsoft.com/en-us/DeployEdge/ms-edge-security-for-business (via zoektool, live te controleren) |

Wat de enterprisemarkt verkoopt (beheersen wat de deur uitgaat) heeft RTG op een
andere manier: er is geen deur naar buiten. Dat is sterker voor veiligheid en
zwakker voor bruikbaarheid; precies daarom is het een besluit.

## c. Analyse van het volledige domein

**Particulier.** Een lid zoekt een zaak of een ander lid, leest diens site, stuurt
een vraag of reservering, en wil bewaren wat hij vond. Buiten RTG surft hij in zijn
eigen browser.

**Professioneel.** Een zzp'er of zaak ontvangt vragen via de site en wil die als werk
zien, niet als losse berichten. Een medewerker gebruikt een browser voor
bedrijfsapplicaties.

**Organisatie.** Een organisatie wil weten welke gegevens via de browser het huis
verlaten (DLP), wil toegang laten afhangen van apparaat en context, en wil een
auditspoor. Dat is de enterprisebrowsermarkt.

| Eis | Bron | Gevolg voor software |
|---|---|---|
| Cookies (art. 11.7a Tw): toestemming nodig, behalve functioneel en analytisch met weinig impact | https://www.acm.nl/nl/verkoop-aan-consumenten/reclame-en-verleiden/online-beinvloeden/cookies-plaatsen | het RTG-web zet geen volgcookies (`server/kern/webmaker-meting.js` telt gebeurtenissen, geen bezoekers); bij extern surfen gelden de cookies van derden, en RTG beheert die niet |
| AVG art. 5 (dataminimalisatie) | https://autoriteitpersoonsgegevens.nl/nl/over-privacy/persoonsgegevens/bewaren-van-persoonsgegevens | geschiedenis staat alleen op het toestel; geen serverlog van wie welke site las (bestaand ontwerp) |
| European Accessibility Act, EN 301 549 / WCAG 2.1 AA | https://www.acm.nl/en/accessibility/accessibility-e-commerce-services-and-electronic-communications-services | het browserscherm en de getekende blokken moeten toegankelijk zijn; zie de Sitemaker-kaart voor de blokken |
| Sollicitatiegegevens: AVG, bewaartermijn | https://autoriteitpersoonsgegevens.nl/nl/onderwerpen/werk-en-uitkering/personeelsdossiers | een sollicitatie via het siteformulier wordt een gewone klus (`addTicket`); de leidingsplek van RT Mail (28 dagen, besluit 584A) geldt daar niet. Wie de werklijst ziet: te controleren |

## d. Functiecatalogus L1–L6

### L1 Persoonlijk

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Bladwijzers over toestellen | half: alleen `localStorage` | lijst adressen per lid | opslag op het account (max. 40), geen geschiedenis op de server | geen | lid | lid | verwijderde site: bladwijzer toont "niet meer online" | ik bewaar een site op mijn telefoon en vind hem op mijn laptop | klein | aanbevolen nu |
| Openen van een niet-RTG-adres eerlijk afhandelen | ontbreekt | ingevoerd adres | een `http(s)`-adres opent niet in de app; het scherm zegt "dit is het RTG-web; buiten RTG opent uw eigen browser" met een knop naar buiten (nieuw venster) | geen | lid | lid | geen | ik typ een gewoon webadres en krijg uitleg plus een knop, geen lege pagina | klein | aanbevolen nu (past bij besluit 1A) |
| Leesweergave en afdruk | ontbreekt | site-JSON | tekstblokken in leesvolgorde | geen | lid | lid | geen | ik print een menukaart netjes | klein | later |
| Vertaald lezen | bestaat, onbewezen | `memberTaal` | naam en prijs blijven onvertaald; melding "machinevertaald" | vertaling is graad `vermoed` | lid | lid | vertaler weg: onvertaald tonen | ik lees een Engelse site in het Nederlands met de melding erbij | klein | proef: aanbevolen nu |

### L2 Professioneel

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Sitebericht wordt klus | bestaat (`webbrowser.js`) | tekst, soort | herhaalsleutel; soort bepaalt het label | geen | zaak via melding, afzender via melding | ingelogd lid | niet verbonden lid: 403 | mijn offerteaanvraag staat één keer in de werklijst, ook na een herhaling | klein | bestaat |
| Antwoord terug naar het lid | niet gevonden | klus, codenaam | het antwoord van de zaak komt als gesprek bij het lid, met verwijzing naar de klus | geen | lid bij antwoord | zaakpersoneel | geen | de zaak antwoordt in de werklijst en ik lees het in mijn berichten | middel | aanbevolen nu (eerst nagaan wat er al is) |
| Sollicitatie via site naar de leidingsplek | ontbreekt | soort `sollicitatie` | landt op de leidingsplek van RT Mail, niet in de algemene werklijst; termijn 28 dagen | geen | alleen manager | manager | geen | mijn sollicitatie is alleen voor de manager zichtbaar en verdwijnt na de termijn | klein | aanbevolen nu |
| Statusvolg van een aanvraag | ontbreekt | ticketstand | lid ziet ontvangen, in behandeling, afgehandeld | geen | lid | lid | geen | ik zie dat mijn reservering is opgepakt | klein | later |

### L3 Organisatorisch

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Gids zonder populariteitsranglijst | half: gids sorteert op `bezoeken` | `ledenSites` | sorteren op relevantie of alfabet; bezoeken blijft een cijfer voor de maker | geen | n.v.t. | n.v.t. | geen | de gids zet geen sites in een ranglijst op bezoekersaantal | klein | later (zie Vraagt besluit 3) |
| Bezoekteller ontdubbelen | half: elke `open` telt (`webmaker-blader.js`) | telling per dag | per sessie per site hooguit één telling per dag, zonder de bezoeker op te slaan | ontdubbelen zonder bewaren is grof: graad `vermoed` | maker | maker | eigen bezoek telt al niet | verversen blaast het cijfer niet op | klein | later |
| Organisatiebrowser met DLP | ontbreekt | n.v.t. | n.v.t. | n.v.t. | n.v.t. | n.v.t. | n.v.t. | n.v.t. | groot | niet doen: geen extern web, dus geen laatste meter om te bewaken |

### L4 Domeinintelligentie

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Zoeken met bron | half: titel en adres | `webmaker.zoek`, `webplatform.zoekZaken` | elk resultaat zegt of het een site of een zaak is | geen | lid | lid | offline sites nooit | zoeken op "kapper" vindt zaken en hun site | klein | bestaat |
| Federatief zoeken over RTG | ontbreekt | domeinzoekroutes (OFFICE.md punt 16) | elk domein beantwoordt zijn eigen deel met zijn eigen poort; geen centrale index | geen | lid | lid | geen | eén zoekveld vindt sites, zaken en mijn documenten, elk met bron | middel | later (eigenaar zoeklaag: besluit) |

### L5 Volledige levenscyclus

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Site gaat offline | bestaat: open geeft 404 | `online` | geplande publicatie gaat eerst naar buiten (`rijp`) | geen | bezoeker | n.v.t. | geen | een offline site opent niet en zegt dat | klein | bestaat |
| Bladwijzer naar verdwenen site | ontbreekt | bladwijzer | markeren als "niet meer online" | geen | lid | lid | geen | zie L1 | klein | later |

### L6 RTG-samenhang

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Live zaakblokken | bestaat (`webplatform.js`) | zaakprofiel: menu, openingstijden, vacatures | opgelost bij elk openen, nooit gekopieerd | bron weg: blok leeg met reden | bezoeker | n.v.t. | geen | een gewijzigd menu staat direct op de site | klein | bestaat |
| Verbind en chat bij een persoonssite | bestaat | codenaam | alleen na verbinden | geen | beide leden | beide | geen | ik verbind en mijn bericht landt als gesprek | klein | bestaat |
| Reservering via site naar Horeca | ontbreekt | soort `reservering` | wordt een reserveringsverzoek bij de eigenaar (horeca of reizen), niet een losse klus | geen | zaak | zaak | zaak zonder reserveringen: blijft klus | een reservering via de site komt in het reserveringsoverzicht van de zaak | middel | later (eigenaar Horeca) |

**Modus LOS.** Kerntaak: sites binnen het RTG-web vinden en lezen. Zonder Sitemaker
zijn er geen sites; het scherm zegt dan "er staan nog geen sites online". Zonder
berichten (`commDm`) geeft het formulier bij een persoon 503 "De berichten draaien
hier even niet"; bij een zaak loopt het via de werklijst door. Zonder vertaler toont
de browser de oorspronkelijke tekst.

**Modus SAMEN: een lid vraagt een offerte aan bij een zaak**

1. Het lid zoekt "schilder" in de browser; zoek geeft zaken met hun adres.
2. Het lid opent `schilder.rtg`; het menu en de openingstijden komen live uit het
   zaakprofiel.
   - Storing: de site is net offline gezet. Wat het lid ziet: 404 "Geen RTG-site op
     dit adres." Bewaard: niets; de bladwijzer blijft.
3. Het lid kiest "offerte", schrijft 200 tekens en verstuurt met `idem`.
   - Storing: verbinding breekt na verzending. Wat het lid ziet na opnieuw tikken:
     `herhaald: true`, één klus. Bewaard: de eerste klus.
   - Storing: tekst valt door de keuring (`veilig.js`). Wat het lid ziet: 400 met de
     reden. Bewaard: niets verstuurd; de tekst staat nog in het veld.
4. De zaak krijgt een melding en ziet "Offerteaanvraag via de website" met de
   codenaam van het lid.
5. De zaak zet de klus om naar een offerte in Office en een project in Werk OS
   (eigenaren Office en Werk OS).
6. Het antwoord gaat terug naar het lid (functie L2, nog niet gevonden).

## e. RTG-exclusieve mogelijkheden

| Mogelijkheid | Eigenaar | Capability | Waarom geen markt-app dit kan |
|---|---|---|---|
| Een web waarin elke lezer een gekeurd lid is en elke afzender een codenaam | `web.browser` | `auth` op alle routes, `codenaamVan` | het open web heeft anonieme lezers en spam |
| Een websiteformulier dat precies één keer als werk aankomt | `web.browser` + zaak | herhaalsleutel, `addTicket` | marktformulieren mailen en dubbelen |
| Site met live bedrijfsgegevens zonder koppeling | `web.browser` + `werk.website-maker` | `webplatform.js` | marktsites kopiëren het menu of hebben een plug-in nodig |

## f. Bouwstenen en ontbrekende koppelingen

**Bestaande modules**: `server/routes/webbrowser.js`, `server/kern/webmaker-blader.js`,
`server/kern/webplatform.js`, `server/kern/webplatform-taal.js`,
`server/kern/veilig.js`, `server/kern/rtmail-leiding*.js` (leidingsplek).

| Van | Naar | Vorm | Toestemming |
|---|---|---|---|
| sitebericht soort `sollicitatie` | RT Mail leidingsplek | gebeurtenis | manager |
| klus van een zaak | gesprek met het lid | gebeurtenis met verwijzing | zaakpersoneel |
| sitebericht soort `reservering` | reserveringen van de zaak | verwijzing | zaak |
| bladwijzers | account | eigen kleine collectie per lid (`eigencollectie.js`) | lid |

## g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Niet-RTG-adres eerlijk afhandelen | klein | laag | besluit 1 | aanbevolen nu |
| Sollicitatie naar de leidingsplek | klein | laag | `rtmail-leiding.js` | aanbevolen nu |
| Antwoord van zaak terug naar lid | middel | middel | eerst nagaan wat de werklijst al doet | aanbevolen nu |
| Bladwijzers over toestellen | klein | laag | `eigencollectie.js` | aanbevolen nu |
| Proef op vertaald lezen | klein | laag | `webplatform-taal.js` | aanbevolen nu |
| Statusvolg van een aanvraag | klein | laag | ticketstanden | later |
| Gids zonder ranglijst, teller ontdubbelen | klein | laag | besluit 3 | later |
| Reservering naar Horeca | middel | middel | eigenaar Horeca | later |
| Federatief zoeken | middel | middel | eigenaar zoeklaag | later |
| Extern surfen in de app met DLP | groot | hoog | proxy, beleid | niet doen: maakt RTG een enterprisebrowser, een nieuw domein |

## h. Toetsbaar eindcontract Beyond Premium

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| Breedte | sites, zaken en personen vinden en lezen; elk adres krijgt een eerlijk antwoord | voltooiproef met een extern adres | intern ja; extern zonder uitleg |
| Professionele diepte | aanvraag gaat één keer heen en het antwoord komt terug | voltooiproef uitbreiden met antwoord | heen ja, terug niet gevonden |
| Levenscyclus | offline site, verdwenen bladwijzer en verlopen sollicitatie worden afgehandeld | nieuwe test op leidingsplek via site | half |
| Samenwerking en rollen | alleen verbonden leden schrijven elkaar; alleen de manager ziet sollicitaties | `test/browser-zaakbericht.test.js`; nieuwe test op sollicitatie | eerste ja, tweede nee |
| Domeinintelligentie | vertaling zegt dat ze vertaald is; zoeken zegt wat een resultaat is | test op `vertaald` in het antwoord | staat, onbewezen |
| Los functioneren | zonder berichten en vertaler werkt lezen en de zaakroute | voltooiproef met `commDm` uit | niet beproefd |
| RTG-ketens | bericht naar werklijst, chat of leidingsplek, met herhaalsleutel | `scripts/lib/voltooi/browser.js` | twee van drie |
| Bewezen betrouwbaarheid | acht bewijzen B | centrale meetronde | 3 B centraal, 4 lokaal gesloten, bevoegd NT |

Dit contract vervangt de acht bewijzen van APPWERKT nooit.

## Twee uitkomsten

**(A) Binnen de huidige architectuur en scope**

| Functie | Kosten | Bouwt op |
|---|---|---|
| Niet-RTG-adres: uitleg en knop naar de eigen browser | klein | `public/apps/browser.html` |
| Sollicitatie via site naar de leidingsplek | klein | `server/routes/webbrowser.js`, `server/kern/rtmail-leiding.js` |
| Antwoord van zaak terug naar het lid | middel | werklijst, `commDm` |
| Bladwijzers op het account | klein | `server/kern/eigencollectie.js` |
| Proef op vertaald lezen | klein | `server/kern/webplatform-taal.js`, `scripts/lib/voltooi/browser.js` |
| Later: statusvolg, gids zonder ranglijst, reservering naar Horeca, federatief zoeken | klein tot middel | ticketstanden, `webmaker-blader.js`, Horeca, OFFICE.md punt 16 |

**(B) Het domeinmaximum, ook buiten de huidige scope.** Richting, geen toezegging.

| Proces | Stappen | Rollen en organisaties | RTG-apps en eigenaar | Nodig buiten scope |
|---|---|---|---|---|
| Klant vindt, vraagt en koopt bij een lokale zaak | 1 zoeken; 2 site lezen met live aanbod; 3 vraag of reservering; 4 offerte; 5 betalen; 6 nazorg en klacht | lid, zaak | Browser (`web.browser`), Sitemaker, Mall/Commerce (`handel.verkoopwegen`), Geld, Werk OS | afrekenen op een site is webwinkel met informatieplicht en herroeping (art. 6:230m BW): besluit over eigenaar (Commerce) |
| Beveiligde werkplek voor een organisatie (enterprisebrowser) | 1 beleid per classificatie; 2 toegang naar externe bedrijfsapps; 3 DLP op kopiëren, uploaden, printen; 4 auditlog; 5 incident melden (NIS2) | IT-beheer, medewerker, toezichthouder (extern) | Browser, Office (classificatie), tenantlaag | extern surfen via RTG is een nieuw domein (proxy, URL-filter, DLP-detectoren) en vraagt een besluit over aansprakelijkheid voor externe inhoud |
| Openbaar web van RTG-zaken | 1 site op eigen domein; 2 lezers zonder account; 3 contact via de leden-app | zaak, bezoeker zonder account | Sitemaker (`dom-eigendomein`), Browser | botst met "een gast is geen gebruiker": boardroombesluit (staat al als schakelaar, standaard uit) |

## Vraagt besluit

1. **Wat is de Browser: RTG-web of het hele web?** (SCHERMEIGENAAR zegt "naar het web surfen", de code opent alleen `.rtg`)
   - A (aanbevolen): RTG-web; het doel in SCHERMEIGENAAR.json wordt "binnen het RTG-web sites van zaken en leden vinden en lezen", en een extern adres krijgt uitleg plus een knop naar de eigen browser. Kosten: klein.
   - B: extern surfen in de app, zonder beheer. Kosten: middel; RTG wordt drager van externe inhoud, cookies van derden en phishing in eigen schil.
   - C: extern surfen met DLP en beleid (enterprisebrowser). Kosten: groot; nieuw domein, vóór V1 uitgesloten.
2. **Waar landt een sollicitatie via een siteformulier?**
   - A (aanbevolen): op de leidingsplek van RT Mail (alleen manager, 28 dagen). Kosten: klein.
   - B: zoals nu, als klus in de werklijst. Kosten: geen; buiten de bewaartermijn en mogelijk zichtbaar voor al het personeel (te controleren).
3. **Mag de gids op bezoekersaantal sorteren?**
   - A (aanbevolen): nee; alfabetisch of op soort, het cijfer blijft voor de maker. Kosten: klein.
   - B: ja, zoals nu. Kosten: geen; een ranglijst op populariteit beloont wie al gezien wordt.
