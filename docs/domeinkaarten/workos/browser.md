# Browser (link:browser)

Volledige werkzaamheid: de Browser doet volledig waarvoor hij er is als een lid een
site van een zaak of een ander lid in het RTG-web vindt en leest (ook vertaald, met de
melding erbij), er een vraag, offerte, reservering of sollicitatie naartoe stuurt die
precies één keer op de juiste plek aankomt (werklijst, gesprek of leidingsplek), het
antwoord terugleest in zijn eigen overzicht, en op elk ander adres een eerlijk
antwoord krijgt; toetsbaar als de voltooiproef heen én terug sluit.

Eigenaar: `web.browser` (SCHERMEIGENAAR.json, doelgroep `lid`), ingang
`/apps/browser.html`. Doel volgens het register: "Binnen de RTG-schil naar het web
surfen, met eigen startpagina, geschiedenis en bladwijzers." De code opent alleen
het interne RTG-web (`naam.rtg`): `server/kern/webmaker.js` zegt "Geen echte
domeinen, geen extern hosten". Die afwijking is een **vraagt besluit** (1). Herzien
op 19 oktober 2026 (avond) na het oordeel "deels": herstel en verdieping staan
apart; de verdieping zit in de terugweg (antwoord en status bij het lid), de
bladwijzers op het account en een eerlijke "nu open"-regel uit de zaakdata.

## a. Inventaris van het bewezen bestaande

**Wat er staat**

- Scherm: `public/apps/browser.html`: tabs, geschiedenis, bladwijzers in
  `localStorage` (`rtg_web_bladwijzers`, maximaal 40, alleen op dit toestel).
- Routes: `server/routes/webbrowser.js`, alle achter `auth`:
  - `/api/browser/gids`: online sites, gesorteerd op bezoeken, maximaal 200, met het
    bezoekcijfer per site in het antwoord (`webmaker-blader.js` r. 8-10);
  - `/api/browser/zoek`: sites (titel of adres) en zaken in één antwoord;
  - `/api/browser/open`: site openen, live zaakblokken oplossen
    (`server/kern/webplatform.js`), machinevertaling naar de taal van het lid
    met de melding dat het vertaald is (`server/kern/webplatform-taal.js`);
  - `/api/browser/bericht`: formulierbericht in zes soorten (vraag, offerte,
    sollicitatie, reservering, klacht, feedback), 3 tot 500 tekens, langs
    `server/kern/veilig.js`.
- Kern: `server/kern/webmaker-blader.js` (gids, zoek, open, eigenaar en zaak per adres).
- Gedrag van het bericht (`webbrowser.js` r. 60-100):
  - bij een ZAAK: een klus in de werklijst (`addTicket`) op naam "RTG-web ·
    <codenaam>" plus `notifySupplier` en een melding aan de afzender;
    herhaalsleutel als hash van sessie en `idem`, vingerafdruk van soort en tekst;
    zelfde sleutel met andere tekst geeft 409. Op de klus staat bewust NIET de
    ledensleutel (commentaar r. 65-69);
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
leesweergave of afdruk. **Geen terugweg**: nagetrokken bij deze herziening. De klus
draagt alleen "RTG-web · <codenaam>" en een hash, geen sleutel van het lid; de zaak
kan dus niet antwoorden via de klus, en het lid heeft geen overzicht van wat het
verstuurde. Dat is een ontwerpkeuze (de werklijst is van de zaak), geen fout; de
terugweg vraagt een eigen verwijzing (zie d., L2).

**Open bevindingen (gelezen, niet beproefd, niet gerepareerd)**. Niets van deze kaart
is in de reparatieronde gerepareerd (workos.md par. 9: browser staat onder "nog open").

- `server/routes/webbrowser.js`: een sollicitatie via een site wordt een gewone klus
  (`addTicket`) en valt buiten de leidingsplek van RT Mail (28 dagen, alleen manager).
- `server/kern/webmaker-blader.js` r. 8: `gids` sorteert op `bezoeken` en geeft het
  cijfer aan elk lid mee; dat is een populariteitsranglijst.
- Nieuw: `webmaker-blader.js` r. 57 telt elke `open` (behalve van de eigenaar) als
  bezoek; verversen telt opnieuw.
- Nieuw: `webbrowser.js` mengt aanspreekvormen in één route: "Uw ... staat in hun
  werklijst" naast "Dit is je eigen site." en "Jullie zijn nog niet verbonden."

## b. Marktvergelijking

Alleen ter vergelijking, nooit als partner. Geraadpleegd 2026-10-19. Elke regel komt
uit een zoeksamenvatting en is **(te controleren)**. De vergelijking is tweeledig:
consumentenbrowsers (wat een lid kent) en enterprisebrowsers (wat een organisatie
koopt om de "laatste meter" te beheersen).

| Leider | Achter de betaalmuur | Wij | Bron |
|---|---|---|---|
| (te controleren) Brave | browser gratis; Search Premium $3, VPN $9,99, Leo Premium $14,99 | nee voor VPN en AI-assistent in de browser; zoeken alleen intern | https://brave.com/premium/ (via zoektool, live te controleren) |
| (te controleren) Opera | VPN Pro $7,99; Neon (agentische browser) $19,90 | nee; een agent die zelf surft botst met de stuurlaag (`server/kern/stuur/`) | https://www.opera.com/features/vpn-pricing-plan (via zoektool, live te controleren) |
| (te controleren) Island Enterprise Browser (offerte) | last-mile-controle op kopiëren, plakken, downloaden, uploaden, printen en screenshots, ook richting AI-tools; ZTNA, BYOD, auditlogging | half: binnen het RTG-web komt niets van buiten binnen, en elk bericht is begrensd en gekeurd; geen DLP op klembord of upload, want er is geen extern web | https://www.island.io/enterprise-browser (via zoektool, live te controleren) |
| (te controleren) Chrome Enterprise Premium ($6) | DLP, context-aware access, URL-filtering, evidence locker | nee; URL-filtering is overbodig zolang er geen extern web is | https://chromeenterprise.google/pricing/ (via zoektool, live te controleren) |
| (te controleren) Edge for Business | browser gratis; DLP en Conditional Access vragen E3/E5 | nee | https://learn.microsoft.com/en-us/DeployEdge/ms-edge-security-for-business (via zoektool, live te controleren) |

Wat de enterprisemarkt verkoopt (beheersen wat de deur uitgaat) heeft RTG op een
andere manier: er is geen deur naar buiten. Dat is sterker voor veiligheid en
zwakker voor bruikbaarheid; precies daarom is het een besluit. Wat een
lokale-zakengids (geen bron gecontroleerd, richting) wel standaard heeft en wij niet:
"nu open", een overzicht van eigen aanvragen en antwoorden op één plek.

## c. Analyse van het volledige domein

**Particulier.** Een lid zoekt een zaak of een ander lid, leest diens site, stuurt
een vraag of reservering, en wil weten of en wat er geantwoord is. Hij wil bewaren
wat hij vond, op elk toestel. Buiten RTG surft hij in zijn eigen browser.

**Professioneel.** Een zzp'er of zaak ontvangt vragen via de site en wil die als werk
zien, niet als losse berichten, en wil kunnen antwoorden zonder de naam van de vrager
te kennen. Een medewerker gebruikt een browser voor bedrijfsapplicaties.

**Organisatie.** Een organisatie wil weten welke gegevens via de browser het huis
verlaten (DLP), wil toegang laten afhangen van apparaat en context, en wil een
auditspoor. Dat is de enterprisebrowsermarkt.

Geen van de wetsregels hieronder is in de primaire tekst nagelezen; ze dragen allemaal
**(te controleren)** en worden nergens een harde weigerregel.

| Eis | Bron | Gevolg voor software |
|---|---|---|
| (te controleren) Cookies (art. 11.7a Tw): toestemming nodig, behalve functioneel en analytisch met weinig impact | https://www.acm.nl/nl/verkoop-aan-consumenten/reclame-en-verleiden/online-beinvloeden/cookies-plaatsen | het RTG-web zet geen volgcookies (`server/kern/webmaker-meting.js` telt gebeurtenissen, geen bezoekers); bij extern surfen gelden de cookies van derden, en RTG beheert die niet |
| (te controleren) AVG art. 5 (dataminimalisatie) | https://autoriteitpersoonsgegevens.nl/nl/over-privacy/persoonsgegevens/bewaren-van-persoonsgegevens | geschiedenis staat alleen op het toestel; geen serverlog van wie welke site las (bestaand ontwerp). Bladwijzers op het account zijn wel opslag: alleen adressen, geen tijdstippen |
| (te controleren) European Accessibility Act, EN 301 549 / WCAG 2.1 AA | https://www.acm.nl/en/accessibility/accessibility-e-commerce-services-and-electronic-communications-services | het browserscherm en de getekende blokken moeten toegankelijk zijn; zie de Sitemaker-kaart voor de blokken |
| (te controleren) Sollicitatiegegevens: AVG, bewaartermijn | https://autoriteitpersoonsgegevens.nl/nl/onderwerpen/werk-en-uitkering/personeelsdossiers | een sollicitatie via het siteformulier wordt een gewone klus (`addTicket`); de leidingsplek van RT Mail (28 dagen, huisbesluit 584A) geldt daar niet. Wie de werklijst ziet: te controleren |

## d. Functiecatalogus L1–L6

De bak "aanbevolen nu" is gesplitst in **herstel** en **verdieping**.

### L1 Persoonlijk

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Openen van een niet-RTG-adres eerlijk afhandelen | ontbreekt | ingevoerd adres | een `http(s)`-adres opent niet in de app; het scherm zegt "dit is het RTG-web; buiten RTG opent uw eigen browser" met een knop naar buiten (nieuw venster) | geen | lid | lid | geen | ik typ een gewoon webadres en krijg uitleg plus een knop, geen lege pagina | klein | aanbevolen nu: herstel (past bij besluit 1A) |
| Eén aanspreekvorm in de meldingen | ontbreekt: je en u door elkaar in `webbrowser.js` | meldteksten | de Browser spreekt in de u-vorm, zoals de rest van de route en de kaart | geen | lid | n.v.t. | geen | elke melding van de Browser gebruikt "u" | klein | aanbevolen nu: herstel |
| Bladwijzers op het account | half: alleen `localStorage` | lijst adressen per lid, eigen kleine collectie (`server/kern/eigencollectie.js`) | max. 40; alleen adres en eigen titel, geen tijdstip, geen geschiedenis op de server; bij het eerste inloggen op een nieuw toestel worden de lokale bladwijzers één keer aangeboden om mee te nemen (lid kiest) | geen | lid | lid | verwijderde of offline site: bladwijzer toont "niet meer online" | ik bewaar een site op mijn telefoon en vind hem op mijn laptop; een site die offline ging staat er met die melding | klein | aanbevolen nu: verdieping |
| Vertaald lezen | bestaat, onbewezen | `memberTaal` | naam en prijs blijven onvertaald; melding "machinevertaald" | vertaling is graad `vermoed` | lid | lid | vertaler weg: onvertaald tonen | ik lees een Engelse site in het Nederlands met de melding erbij | klein | proef: aanbevolen nu: herstel |
| Leesweergave en afdruk | ontbreekt | site-JSON | tekstblokken in leesvolgorde | geen | lid | lid | geen | ik print een menukaart netjes | klein | later |

### L2 Professioneel

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Sitebericht wordt klus | bestaat (`webbrowser.js`) | tekst, soort | herhaalsleutel; soort bepaalt het label | geen | zaak via melding, afzender via melding | ingelogd lid | niet verbonden lid: 403 | mijn offerteaanvraag staat één keer in de werklijst, ook na een herhaling | klein | bestaat |
| Sollicitatie via site naar de leidingsplek | ontbreekt | soort `sollicitatie` | landt op de leidingsplek van RT Mail (`rtmail-leiding.js`), niet in de algemene werklijst; de bestaande termijn van 28 dagen (huisbesluit 584A) | geen | alleen manager; afzender krijgt "aangekomen bij de leiding" | manager | zaak zonder leidingsplek: het formulier zegt dat solliciteren hier niet kan en bewaart niets | mijn sollicitatie is alleen voor de manager zichtbaar en verdwijnt na de termijn | klein | aanbevolen nu: herstel |
| Antwoord terug naar het lid | ontbreekt (nagetrokken: de klus kent het lid niet) | nieuwe antwoordverwijzing: bij versturen maakt de Browser een willekeurige `antwoordId`, bewaart `antwoordId → ledensleutel` in een eigen collectie van de Browser, en zet alleen `antwoordId` op de klus | de zaak antwoordt in de werklijst; de route zoekt het lid via `antwoordId` en levert het antwoord als melding plus regel in "Mijn aanvragen" (hieronder); de zaak ziet nooit de sleutel of de echte naam | geen | lid bij antwoord | zaakpersoneel met toegang tot de werklijst | lid opgezegd of verwijzing verlopen (na 90 dagen): de zaak hoort "deze aanvrager is niet meer bereikbaar" | de zaak antwoordt in haar werklijst en ik lees het bij mijn aanvraag; de zaak kent alleen mijn codenaam | middel | aanbevolen nu: verdieping |
| Mijn aanvragen (status) | ontbreekt | dezelfde eigen collectie: per verstuurd bericht soort, adres, tijd, `antwoordId`, stand | stand = verstuurd, opgepakt, beantwoord, afgehandeld; de zaak zet hem met haar bestaande klusstanden; nooit een klok of herinnering aan de zaak namens het lid | geen | lid bij elke standwissel | lid leest; zaak zet | bericht aan een lid (DM) staat er niet in: dat is een gesprek | ik zie dat mijn reservering is opgepakt en lees het antwoord op dezelfde plek | klein | aanbevolen nu: verdieping |
| Reservering via site naar Horeca | ontbreekt | soort `reservering` | wordt een reserveringsverzoek bij de eigenaar (horeca of reizen), niet een losse klus | geen | zaak | zaak | zaak zonder reserveringen: blijft klus | een reservering via de site komt in het reserveringsoverzicht van de zaak | middel | later (eigenaar Horeca) |

### L3 Organisatorisch

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Gids zonder populariteitsranglijst | half: gids sorteert op `bezoeken` en toont het cijfer | `ledenSites` | sorteren op naam of soort; het bezoekcijfer gaat niet meer mee in het gidsantwoord, het blijft voor de maker (`webmaker-meting.js`) | geen | n.v.t. | n.v.t. | geen | de gids zet geen sites in een ranglijst op bezoekersaantal, en een lid ziet het cijfer van een ander niet | klein | aanbevolen nu: herstel (besluit 3A) |
| Bezoekteller ontdubbelen | half: elke `open` telt (`webmaker-blader.js` r. 57) | telling per dag | per sessie per site hooguit één telling per dag, met een vluchtige set in het geheugen die om middernacht leeg gaat; de bezoeker wordt niet opgeslagen | na een herstart kan iemand twee keer tellen: graad `vermoed` | maker | maker | eigen bezoek telt al niet | verversen blaast het cijfer niet op | klein | aanbevolen nu: herstel |
| Organisatiebrowser met DLP | ontbreekt | n.v.t. | n.v.t. | n.v.t. | n.v.t. | n.v.t. | n.v.t. | n.v.t. | groot | niet doen: geen extern web, dus geen laatste meter om te bewaken |

### L4 Domeinintelligentie

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Zoeken met bron | half: titel en adres | `webmaker.zoek`, `webplatform.zoekZaken` | elk resultaat zegt of het een site of een zaak is | geen | lid | lid | offline sites nooit | zoeken op "kapper" vindt zaken en hun site | klein | bestaat |
| "Nu open" bij een zaak | ontbreekt | zaakbron `openingstijden` (`webplatform.js` r. 24) | bij zoeken en openen: "nu open tot 22:00", "nu dicht, opent 09:00" of "openingstijden onbekend"; gerekend in de tijdzone van de zaak, nooit in UTC | feestdagen en uitzonderingen kent de bron mogelijk niet: het scherm zegt "volgens de opgegeven tijden" | lid | lid | geen openingstijden: niets tonen, geen gok | ik zoek een bakker om 21:00 en zie welke nog open is, met "volgens de opgegeven tijden" erbij | klein | aanbevolen nu: verdieping |
| Federatief zoeken over RTG | ontbreekt | domeinzoekroutes (OFFICE.md punt 16) | elk domein beantwoordt zijn eigen deel met zijn eigen poort; geen centrale index | geen | lid | lid | geen | één zoekveld vindt sites, zaken en mijn documenten, elk met bron | middel | later (eigenaar zoeklaag: besluit) |

### L5 Volledige levenscyclus

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Site gaat offline | bestaat: open geeft 404 | `online` | geplande publicatie gaat eerst naar buiten (`rijp`) | geen | bezoeker | n.v.t. | geen | een offline site opent niet en zegt dat | klein | bestaat |
| Aanvraag verloopt | ontbreekt | "Mijn aanvragen" | na 90 dagen zonder standwissel verdwijnt de regel en de `antwoordId`; de klus bij de zaak blijft van de zaak | geen | lid ziet "verlopen" een week vooraf | lid | sollicitatie: volgt de termijn van de leidingsplek | na drie maanden zonder antwoord staat mijn oude vraag er niet meer, en de zaak kan mij niet meer bereiken | klein | later |

### L6 RTG-samenhang

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Live zaakblokken | bestaat (`webplatform.js`) | zaakprofiel: menu, openingstijden, vacatures | opgelost bij elk openen, nooit gekopieerd | bron weg: blok leeg met reden | bezoeker | n.v.t. | geen | een gewijzigd menu staat direct op de site | klein | bestaat |
| Verbind en chat bij een persoonssite | bestaat | codenaam | alleen na verbinden | geen | beide leden | beide | geen | ik verbind en mijn bericht landt als gesprek | klein | bestaat |
| Klus wordt offerte of project | bestaat aan de zaakkant (Werk OS, Office) | klus | eigenaren Werk OS en Office; de Browser levert alleen de klus | geen | zaak | zaak | geen | n.v.t. | klein | bestaat (buiten deze app) |

### Modus LOS

Kerntaak: sites binnen het RTG-web vinden, lezen en er een bericht naartoe sturen.
Per groep wat er gebeurt als iets ontbreekt, met de letterlijke schermtekst (u-vorm).

**Eigen (de Browser bezit het en kan het altijd)**: tabs, geschiedenis op het toestel,
bladwijzers, gids en zoeken over wat online staat, het formulier met herhaalsleutel.

| Wat ontbreekt | Schermtekst |
|---|---|
| nog geen sites online | "Er staan nog geen sites online op het RTG-web." |
| een extern adres | "Dit is het RTG-web; dit adres opent in uw eigen browser." |
| een offline of onbekend adres | "Geen RTG-site op dit adres." |

**Noodzakelijke platformdiensten** (account en sessie, identiteitskluis voor de
codenaam, opslag, keuring `veilig.js`, Sitemaker als bron van sites):

| Wat ontbreekt | Schermtekst |
|---|---|
| sessie verlopen of geen account | "Log in om het RTG-web te lezen; het RTG-web is er alleen voor leden." |
| Sitemaker-opslag niet bereikbaar | "De sites zijn nu niet te laden; uw bladwijzers blijven staan." |
| keuring weigert de tekst | "Dit bericht kan zo niet verstuurd worden: <reden>. Uw tekst staat nog in het veld." |
| opslag schrijft niet bij versturen | "Versturen is niet bevestigd; tik nog eens, het komt hooguit één keer aan." |

**Optionele koppelingen** (berichten, vertaler, RT Mail-leidingsplek, zaakprofiel):

| Wat ontbreekt | Schermtekst |
|---|---|
| berichten (`commDm`) uit, bij een persoonssite | "De berichten draaien hier even niet; probeer het later, er is niets verstuurd." |
| vertaler uit | "Vertalen lukt nu niet; u leest de oorspronkelijke tekst." |
| zaakprofiel niet bereikbaar | "Dit deel van de site is nu niet te laden; de rest staat er wel." |
| leidingsplek niet ingericht (sollicitatie) | "Solliciteren via deze site kan nu niet; er is niets verstuurd." |

### Modus SAMEN: een lid vraagt een offerte aan bij een zaak, en leest het antwoord

1. Het lid zoekt "schilder" in de browser; zoek geeft zaken met hun adres en (verdieping
   L4) "nu open, volgens de opgegeven tijden".
2. Het lid opent `schilder.rtg`; het menu en de openingstijden komen live uit het
   zaakprofiel.
   - Storing: de site is net offline gezet. Wat het lid ziet: 404 "Geen RTG-site op
     dit adres." Bewaard: niets; de bladwijzer blijft en toont "niet meer online".
3. Het lid kiest "offerte", schrijft 200 tekens en verstuurt met `idem`.
   - Storing: verbinding breekt na verzending. Wat het lid ziet na opnieuw tikken:
     `herhaald: true`, één klus. Bewaard: de eerste klus.
   - Storing: tekst valt door de keuring (`veilig.js`). Wat het lid ziet: 400 met de
     reden. Bewaard: niets verstuurd; de tekst staat nog in het veld.
4. De zaak krijgt een melding en ziet "Offerteaanvraag via de website" met de
   codenaam van het lid. Het lid ziet de aanvraag in "Mijn aanvragen" als verstuurd.
5. De zaak pakt de klus op; de stand bij het lid wordt "opgepakt".
6. De zaak antwoordt in de werklijst; de route zoekt het lid via `antwoordId` en het
   lid leest het antwoord bij zijn aanvraag.
   - Storing: het lid heeft intussen opgezegd. Wat de zaak ziet: "Deze aanvrager is
     niet meer bereikbaar." Bewaard: het antwoord in de klus.
7. De zaak zet de klus om naar een offerte in Office en een project in Werk OS
   (eigenaren Office en Werk OS).

### Modus SAMEN als contractblok (VOORSTEL)

Voorstel; `scripts/lib/appcontract.js` blijft ongewijzigd.

```js
samen: {
  functie: 'link:browser', familie: 'WorkOS',
  belofte: 'een lid vindt en opent de site van een zaak of ander lid, stuurt via het formulier een bericht dat precies een keer op de juiste plek aankomt, en leest het antwoord van de zaak terug bij zijn aanvraag; alleen verbonden leden schrijven elkaar',
  ingang: '/apps/browser.html',
  bestanden: ['public/apps/browser.html'],
  scenario: 'scripts/lib/voltooi/browser.js',
  ketens: [
    { naam: 'sitebericht wordt klus', uitgeeft: 'web.browser', ontvangt: 'zaak.beheer',
      vorm: 'gebeurtenis', eigenaar: 'web.browser',
      toestemming: 'ingelogd lid; de klus kent alleen codenaam en hash',
      storingen: ['dubbele tik: een klus (herhaald)', 'zelfde sleutel andere tekst: 409, niets verstuurd'],
      proef: 'scripts/lib/voltooi/browser.js en test/browser-zaakbericht.test.js' },
    { naam: 'sitebericht wordt gesprek', uitgeeft: 'web.browser', ontvangt: 'comm.berichten',
      vorm: 'gebeurtenis', eigenaar: 'comm.berichten',
      toestemming: 'alleen tussen verbonden leden',
      storingen: ['niet verbonden: 403 met uitleg', 'berichten uit: 503, niets verstuurd'],
      proef: 'scripts/lib/voltooi/browser.js' },
    { naam: 'antwoord terug naar het lid', uitgeeft: 'zaak.beheer', ontvangt: 'web.browser',
      vorm: 'verwijzing', eigenaar: 'web.browser',
      toestemming: 'zaakpersoneel met toegang tot de werklijst; de zaak ziet nooit de ledensleutel',
      storingen: ['lid opgezegd: "niet meer bereikbaar"', 'verwijzing verlopen na 90 dagen'],
      proef: 'ontbreekt (functie nog niet gebouwd)' },
    { naam: 'sollicitatie op de leidingsplek', uitgeeft: 'web.browser', ontvangt: 'zaak.rtmail',
      vorm: 'gebeurtenis', eigenaar: 'zaak.rtmail',
      toestemming: 'alleen de manager; termijn 28 dagen',
      storingen: ['geen leidingsplek: weigering met uitleg, niets als klus bewaard'],
      proef: 'ontbreekt (functie nog niet gebouwd)' }
  ]
}
```

## e. RTG-exclusieve mogelijkheden

| Mogelijkheid | Eigenaar | Capability | Waarom geen markt-app dit kan |
|---|---|---|---|
| Een web waarin elke lezer een lid met een account is en elke afzender een codenaam | `web.browser` | `auth` op alle routes, `codenaamVan` | het open web heeft anonieme lezers en spam |
| Een websiteformulier dat precies één keer als werk aankomt | `web.browser` + zaak | herhaalsleutel, `addTicket` | marktformulieren mailen en dubbelen |
| Een antwoord dat terugkomt zonder dat de zaak weet wie het lid is | `web.browser` | antwoordverwijzing (voorstel) | een marktformulier geeft de zaak het e-mailadres van de vrager |
| Site met live bedrijfsgegevens zonder koppeling, ook "nu open" | `web.browser` + `werk.website-maker` | `webplatform.js` | marktsites kopiëren het menu of hebben een plug-in nodig |

## f. Bouwstenen en ontbrekende koppelingen

**Bestaande modules**: `server/routes/webbrowser.js`, `server/kern/webmaker-blader.js`,
`server/kern/webplatform.js`, `server/kern/webplatform-taal.js`,
`server/kern/veilig.js`, `server/kern/rtmail-leiding*.js` (leidingsplek),
`server/kern/eigencollectie.js`.

| Van | Naar | Vorm | Toestemming |
|---|---|---|---|
| sitebericht soort `sollicitatie` | RT Mail leidingsplek | gebeurtenis | manager |
| klus van een zaak | antwoord bij het lid via `antwoordId` | verwijzing | zaakpersoneel |
| klusstand | "Mijn aanvragen" | projectie | lid leest |
| sitebericht soort `reservering` | reserveringen van de zaak | verwijzing | zaak |
| bladwijzers | account | eigen kleine collectie per lid (`eigencollectie.js`) | lid |
| zaakbron `openingstijden` | zoekresultaat | projectie | geen extra |

## g. Prioritering

**HERSTEL** (niets gerepareerd in de reparatieronde; alles open)

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Sollicitatie naar de leidingsplek | klein | laag | `rtmail-leiding.js` | aanbevolen nu |
| Gids zonder ranglijst, cijfer alleen voor de maker | klein | laag | besluit 3 | aanbevolen nu |
| Bezoekteller ontdubbelen | klein | laag | `webmaker-blader.js` | aanbevolen nu |
| Niet-RTG-adres eerlijk afhandelen | klein | laag | besluit 1 | aanbevolen nu |
| Eén aanspreekvorm in de meldingen | klein | laag | `webbrowser.js` | aanbevolen nu |
| Proef op vertaald lezen | klein | laag | `webplatform-taal.js` | aanbevolen nu |

**VERDIEPING**

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Antwoord van zaak terug naar lid (antwoordverwijzing) | middel | middel | werklijst, `eigencollectie.js` | aanbevolen nu |
| Mijn aanvragen (status) | klein | laag | antwoordverwijzing, klusstanden | aanbevolen nu |
| Bladwijzers op het account | klein | laag | `eigencollectie.js` | aanbevolen nu |
| "Nu open" bij een zaak | klein | laag | zaakbron `openingstijden` | aanbevolen nu |

**Later en niet doen**

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Aanvraag verloopt na 90 dagen | klein | laag | Mijn aanvragen | later |
| Leesweergave en afdruk | klein | laag | site-JSON | later |
| Reservering naar Horeca | middel | middel | eigenaar Horeca | later |
| Federatief zoeken | middel | middel | eigenaar zoeklaag | later |
| Extern surfen in de app met DLP | groot | hoog | proxy, beleid | niet doen: maakt RTG een enterprisebrowser, een nieuw domein |

## h. Toetsbaar eindcontract Beyond Premium

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| Breedte | sites, zaken en personen vinden en lezen; elk adres krijgt een eerlijk antwoord | voltooiproef met een extern adres | intern ja; extern zonder uitleg |
| Professionele diepte | aanvraag gaat één keer heen, het antwoord komt terug bij de aanvraag, de stand is zichtbaar | voltooiproef uitbreiden met antwoord en stand | heen ja, terug ontbreekt |
| Levenscyclus | offline site, verdwenen bladwijzer, verlopen aanvraag en verlopen sollicitatie worden afgehandeld | nieuwe test op leidingsplek via site en op verlopen | half |
| Samenwerking en rollen | alleen verbonden leden schrijven elkaar; alleen de manager ziet sollicitaties; de zaak ziet nooit de ledensleutel | `test/browser-zaakbericht.test.js`; nieuwe test op sollicitatie en antwoordverwijzing | eerste ja, rest nee |
| Domeinintelligentie | vertaling zegt dat ze vertaald is; zoeken zegt wat een resultaat is; "nu open" zegt waarop het rust | test op `vertaald` en op "volgens de opgegeven tijden" | staat, onbewezen |
| Los functioneren | zonder berichten en vertaler werkt lezen en de zaakroute, met de schermteksten uit Modus LOS | voltooiproef met `commDm` uit | niet beproefd |
| RTG-ketens | bericht naar werklijst, chat of leidingsplek, met herhaalsleutel, en terug | `scripts/lib/voltooi/browser.js` | twee van vier |
| Bewezen betrouwbaarheid | acht bewijzen B | centrale meetronde | 3 B centraal, 4 lokaal gesloten, bevoegd NT |

Dit contract vervangt de acht bewijzen van APPWERKT nooit.

## Twee uitkomsten

**(A) Binnen de huidige architectuur en scope**

HERSTEL

| Functie | Kosten | Bouwt op |
|---|---|---|
| Sollicitatie via site naar de leidingsplek | klein | `server/routes/webbrowser.js`, `server/kern/rtmail-leiding.js` |
| Gids zonder ranglijst; bezoekcijfer alleen voor de maker | klein | `server/kern/webmaker-blader.js` |
| Bezoekteller ontdubbelen | klein | `webmaker-blader.js` r. 57 |
| Niet-RTG-adres: uitleg en knop naar de eigen browser | klein | `public/apps/browser.html` |
| Eén aanspreekvorm | klein | `server/routes/webbrowser.js` |
| Proef op vertaald lezen | klein | `server/kern/webplatform-taal.js`, `scripts/lib/voltooi/browser.js` |

VERDIEPING

| Functie | Kosten | Bouwt op |
|---|---|---|
| Antwoord van zaak terug naar het lid, via een antwoordverwijzing | middel | werklijst (`addTicket`), `server/kern/eigencollectie.js` |
| Mijn aanvragen met stand | klein | dezelfde collectie, klusstanden |
| Bladwijzers op het account | klein | `server/kern/eigencollectie.js` |
| "Nu open" uit de opgegeven openingstijden | klein | `server/kern/webplatform.js` |

LATER: verlopen aanvraag, leesweergave, reservering naar Horeca, federatief zoeken
(klein tot middel; Horeca, OFFICE.md punt 16).

**(B) Het domeinmaximum, ook buiten de huidige scope.** Richting, geen toezegging.

| Proces | Stappen | Rollen en organisaties | RTG-apps en eigenaar | Nodig buiten scope |
|---|---|---|---|---|
| Klant vindt, vraagt en koopt bij een lokale zaak | 1 zoeken; 2 site lezen met live aanbod; 3 vraag of reservering; 4 offerte; 5 betalen; 6 nazorg en klacht | lid, zaak | Browser (`web.browser`), Sitemaker, Mall/Commerce (`handel.verkoopwegen`), Geld, Werk OS | afrekenen op een site is webwinkel met informatieplicht en herroeping (art. 6:230m BW, te controleren): besluit over eigenaar (Commerce) |
| Beveiligde werkplek voor een organisatie (enterprisebrowser) | 1 beleid per classificatie; 2 toegang naar externe bedrijfsapps; 3 DLP op kopiëren, uploaden, printen; 4 auditlog; 5 incident melden (NIS2, te controleren) | IT-beheer, medewerker, toezichthouder (extern) | Browser, Office (classificatie), tenantlaag | extern surfen via RTG is een nieuw domein (proxy, URL-filter, DLP-detectoren) en vraagt een besluit over aansprakelijkheid voor externe inhoud |
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
4. **Wie is eigenaar van de antwoordverwijzing?**
   - A (aanbevolen): de Browser, als eigen collectie; de werklijst krijgt alleen een `antwoordId`. Kosten: middel.
   - B: de werklijst van de zaak bewaart de ledensleutel. Kosten: klein; breekt de keuze dat de werklijst het lid niet kent (`webbrowser.js` r. 65-69).
   - C: geen terugweg; de zaak antwoordt alleen als het lid verbonden is. Kosten: geen; een vraag aan een zaak blijft eenrichtingsverkeer.
