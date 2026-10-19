# Sitemaker (link:sitemaker)

Volledige werkzaamheid: de Sitemaker doet volledig waarvoor hij er is als een lid of
een zaak een site met meerdere pagina's en live zaakgegevens bouwt, hem door een
toegankelijkheidscontrole haalt, hem (bij een zaak door de leiding, na het zien van
het verschil) publiceert of gepland laat publiceren, naar een eerdere stand terugzet,
en hem bij stoppen netjes offline haalt of als bestanden meeneemt; toetsbaar als de
voltooiproef dat met een medewerker, een manager en een lezer in de Browser sluit.

Eigenaar: `werk.website-maker` (SCHERMEIGENAAR.json, doelgroep `lid`), ingang
`/apps/sitemaker.html`. Doel volgens het register: "Een eigen website bouwen en
beheren met blokken, thema's en AI-hulp, en eerdere versies terugzien." De zaakkant
loopt via `/api/supplier/site/*`; het zaakscherm `public/apps/zaakweb.html` heeft
een eigen eigenaar (`site.mijnwebsite`, doelgroep `zaak`). Ambitie van de eigenaar:
een visueel ontwikkelplatform met CMS en domeinen. Doelgroepen: lid, zaak. Herzien op
19 oktober 2026 (avond) na het oordeel "deels": herstel en verdieping staan apart; de
verdieping zit in de publicatiestap (controle, verschil, klaar-melding) en in
bedrijfsgegevens uit de bron.

## a. Inventaris van het bewezen bestaande

**Wat er staat**

- Schermen: `public/apps/sitemaker.html` (lid) en `public/apps/zaakweb.html` (zaak,
  `site.mijnwebsite`).
- Routes:
  - `server/routes/webmaker.js`: `/api/site/mijn`, `haal`, `bewaar`, `verwijder`,
    `versies`, `herstel`, `publiceer`, `live`, `offline`, `plan`, `spoor`,
    `persoonlijk`, `ai`, `sjablonen`, `sjabloon`, `fotos`, `foto`, `foto-weg`;
  - `server/routes/webmeting.js`: `/api/site/cijfers`, `/api/site/domein`,
    `/api/supplier/site/domein`;
  - `server/routes/zaakweb.js`: `/api/supplier/site/*` (team, team/zet, ai, genereer,
    mijn, haal, bewaar, publiceer, live, offline, versies, herstel, plan, spoor).
    Bewaren mag elk personeelslid; publiceer, live en offline zijn `managerOnly`.
    Dat is een goedkeuringsgrens: personeel maakt een concept, de leiding zet het
    naar buiten.
- Kern (13 `webmaker*`-bestanden plus `webdomein.js`, `webdomein-html.js`,
  `webplatform*.js`, `webmerk.js`):

| Onderdeel | Wat het doet | Pad |
|---|---|---|
| Opslag | `db.data.ledenSites {lijst, fotos, meting}`; 12 sites per lid; harde bovengrens 20.000 | `server/kern/webmaker.js` |
| Bloktaal | hero, kop, tekst, knop, beeld, kolommen, galerij, citaat, ruimte, voettekst, zaakdata, formulier, faq, prijzen; een aanroeper mag de lijst versmallen, nooit verbreden | `server/kern/webmaker-schoon.js` |
| Live zaakdata | menu, diensten, kamers, agenda, events, vacatures, openingstijden, team, fotos, salon, reviews, contact, winkel; opgelost bij elk openen | `server/kern/webplatform.js` r. 24 |
| Pagina's | meerdere pagina's per site | `server/kern/webmaker-paginas.js` |
| Versies | 10 standen per site, herstel | `server/kern/webmaker-versies.js` |
| Publiceren | bevroren stand; adres bezet geeft 409; live, offline, gepland met veger | `webmaker-publiceren.js`, `webmaker-plan.js` |
| Spoor | wie deed wat, wanneer | `server/kern/webmaker-spoor.js` |
| Team op de site | niemand staat er vanzelf op; alleen verwijzingen; alleen naam en functie; werk van de leiding | `server/kern/webmaker-team.js` |
| Meting | tellingen per pagina en per dag (90 dagen), formulieren; geen bezoekers, geen tijdstippen, geen herkomst | `server/kern/webmaker-meting.js` |
| AI | geeft een aangepast ontwerp terug, slaat niets op; zonder model een lokale regelstand | `server/kern/webmaker-ai.js` |
| Eigen domein | achter boardroom-schakelaar `dom-eigendomein`, standaard UIT (`server/functies/register/cat-domeinen2.js`); daarna koppelt de eigenaar per site; DNS en certificaat buiten de app | `server/kern/webdomein.js` |
| Publieke HTML | alleen de gepubliceerde stand, alles geëscaped, formulier vervangen door een verwijzing naar de leden-app, `lang="nl"` vast | `server/kern/webdomein-html.js` r. 69 |
| Verwijderen | hard; versies, spoor en meting gaan mee (`webmaker.js` r. 113-120); geen scherm roept de route aan (alleen `test/eigen-website.test.js`) | `webmaker.js` |

Het woord "CMS" komt in de code niet voor. Wat er het dichtst bij komt: de live
zaakdata-blokken (inhoud uit het eigen domein van de zaak) en meerdere pagina's.

**Wat BEWEZEN is**

- APPWERKT.json (`link:sitemaker`): bereikbaar B, bedienbaar B, menselijk NT,
  voltooibaar GF, waarheidsgetrouw B, persistent GF, bevoegd B, herstelbaar GF.
  Sitemaker is de enige app in deze vier met bevoegd BEWEZEN (BEVOEGD.json).
- Voltooiproef op deze tak: lokaal gesloten 4/4 (19-10, dc501544), centraal nog te
  stempelen. Voltooibaar 7/7, persistent 3/3, herstelbaar 4/4, menselijk 3/3.
  Stap 3: "hij zet hem online op een eigen adres; een ander lid opent dat adres in
  de browser". Scenario: `scripts/lib/voltooi/sitemaker.js`.
- IDOR.json: 0 doorbraken.
- Tests: o.a. `test/eigen-website.test.js`, `test/webplatform.test.js`,
  `test/website-truth.test.js`, `test/website-codeproof.test.js`.

**Staat, onbewezen**: zaakkant met de managergrens, gepland publiceren, team op de
site, eigen domein, AI, fotobibliotheek, meting.

**Open bevindingen (gelezen, niet beproefd, niet gerepareerd)**. Niets van deze kaart
is in de reparatieronde gerepareerd (workos.md par. 9: sitemaker staat onder "nog
open").

- `server/kern/webdomein-html.js` r. 38: galerijbeelden krijgen `alt=""`; r. 33:
  een `beeld` gebruikt het bijschrift als alt (leeg bijschrift = lege alt); r. 69:
  `lang="nl"` staat vast. Risico voor WCAG 2.1 AA (te controleren welke sites onder
  de EAA vallen).
- Nieuw: `server/kern/webmaker.js` r. 113-120 `verwijder` wist ook het spoor
  ("een site die weg is, laat niets achter") en geeft `ok: true` ook als er niets
  gevonden is. Wie wat deed met een site die online stond, is daarna niet meer na te
  gaan.
- Nieuw: `server/kern/appgids-data/deel10b.js` r. 71 zegt bij het zaakscherm "een
  eigen extern domein bestaat hier bewust niet", terwijl `dom-eigendomein` het wel
  mogelijk maakt als de boardroom hem aanzet. De gids zegt dan iets anders dan er kan.

## b. Marktvergelijking

Alleen ter vergelijking, nooit als partner. Geraadpleegd 2026-10-19. Elke regel komt
uit een zoeksamenvatting en is **(te controleren)**.

| Leider | Achter de betaalmuur | Wij | Bron |
|---|---|---|---|
| (te controleren) Webflow Basic / Premium | Basic: eigen domein, geen CMS. Premium (sinds mei 2026 de naam van "Business"): CMS met 20.000 items en 40 collecties, site search | half: eigen domein achter boardroom; geen eigen collecties; wel live bedrijfsdata | https://webflow.com/pricing (via zoektool, live te controleren) |
| (te controleren) Webflow Enterprise (offerte) | page branching, publicatieworkflows, aangepaste rollen, design-goedkeuringen, audit-log-API, SSO/SCIM, eigen SSL, uptime-SLA | half: concept tegen gepubliceerde stand, publiceren alleen door de leiding, spoor; geen branches, geen rollen per site, geen verschilweergave | https://help.webflow.com/hc/en-us/articles/46651891357971-Differences-between-Enterprise-and-non-Enterprise-plans (via zoektool, live te controleren) |
| (te controleren) Wix | eigen domein, geen Wix-branding, domeinvoucher; winkel vanaf Core | half: geen RTG-branding-vraag; geen winkel in de site | https://www.wix.com/plans (via zoektool, live te controleren) |
| (te controleren) Squarespace | plannen gewijzigd in 2026; nieuwe niveaus niet bevestigd | niet vergeleken | https://support.squarespace.com/hc/en-us/articles/14721894632589 (via zoektool, live te controleren) |

## c. Analyse van het volledige domein

**Particulier.** Een persoonlijke pagina, een portfolio, een trouwsite. Wat telt: snel
iets moois, zelf bepalen wat zichtbaar is, geen volgcookies.

**Professioneel.** Een zzp'er of zaak heeft een site met aanbod, prijzen,
openingstijden, contact en vacatures, die actueel blijft zonder dubbel werk, en
bedrijfsgegevens (KVK-nummer, adres) die kloppen met de inschrijving. Wie online
verkoopt, heeft een informatieplicht.

**Organisatie.** Meerdere redacteuren, een goedkeuringsstap waarin de leiding ziet wat
er verandert, merkregels, toegankelijkheid, een spoor dat blijft, en meerdere
vestigingen of talen.

Geen van de wetsregels hieronder is in de primaire tekst nagelezen; ze komen uit
domein-max.txt en dragen allemaal **(te controleren)**. Geen ervan wordt in d. of h.
een harde weigerregel. Waar d. iets blokkeert (alt-tekst, taal), rust dat op de
huisregel uit `TOEGANKELIJK.md` en op besluit 3, niet op een wetsuitleg.

| Eis | Bron | Gevolg voor software |
|---|---|---|
| (te controleren) European Accessibility Act sinds 28-6-2025: webwinkels en elektronische communicatie; EN 301 549 = WCAG 2.1 AA; micro-ondernemingen (minder dan 10 personen en maximaal €2 mln) uitgezonderd | https://www.acm.nl/en/accessibility/accessibility-e-commerce-services-and-electronic-communications-services | voor een site die verkoopt zijn alt-tekst, contrast, kopvolgorde en taal per pagina mogelijk wettelijk; het huis kiest ze als bouwregel ongeacht de uitzondering |
| (te controleren) Cookies (art. 11.7a Tw): toestemming, behalve functioneel en analytisch met weinig impact; toezicht ACM | https://www.acm.nl/nl/verkoop-aan-consumenten/reclame-en-verleiden/online-beinvloeden/cookies-plaatsen | de meting zet geen volgcookies; zolang dat zo blijft is er geen banner nodig. Of de publieke HTML op een eigen domein cookies zet: te controleren |
| (te controleren) Webwinkel (art. 6:230m BW): informatieplicht en 14 dagen herroeping; herroepingsknop verplicht vanaf 19-6 of 25-6-2026 (ACM en KvK noemen verschillende data) | https://www.acm.nl/nl/publicaties/acm-roept-online-retailers-op-zich-voor-te-bereiden-op-herroepingsknop | het blok `prijzen` is een prijslijst, geen winkel; zodra er afgerekend wordt, gelden identiteit, KVK-nummer, prijzen inclusief btw en herroeping, en die horen bij de verkoopeigenaar (Commerce) |
| (te controleren) Algemene voorwaarden (art. 6:231 e.v. BW): terhandstelling verplicht | https://www.acm.nl/nl/verkoop-aan-consumenten/de-koop-sluiten/algemene-voorwaarden-aanbieden | een zaak die voorwaarden hanteert, moet ze op de site kunnen tonen; de tekst komt uit Office (verwijzing), niet uit een kopie |
| (te controleren) AVG: persoonsgegevens van personeel op de site | https://autoriteitpersoonsgegevens.nl/nl/onderwerpen/werk-en-uitkering/personeelsdossiers | bestaat: niemand staat er vanzelf op (`webmaker-team.js`) |

## d. Functiecatalogus L1–L6

De bak "aanbevolen nu" is gesplitst in **herstel** en **verdieping**.

### L1 Persoonlijk

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Alt-tekst als eigen veld, verplicht bij publiceren | ontbreekt: `beeld` gebruikt `bijschrift` als alt, `galerij` zet `alt=""` (`webdomein-html.js` r. 33 en 38) | blok `beeld`, `galerij` (per beeld een `alt` en een vinkje `decoratief`) | publiceren weigert een inhoudsbeeld zonder alt (huisregel, besluit 3A); "decoratief" is een bewuste keuze per beeld en geeft `alt=""` | geen | maker bij publiceren | maker | puur decoratief beeld: expliciet aangevinkt | ik kan niet publiceren zolang een galerijfoto geen beschrijving of decoratief-vinkje heeft | klein | aanbevolen nu: herstel |
| Taal per pagina | half: `lang="nl"` vast in `webdomein-html.js` r. 69 | pagina-instelling | `lang` volgt de taal die de maker koos | geen | n.v.t. | maker | vertaalde weergave in de browser: blijft gemeld als vertaald | een Engelse pagina draagt `lang="en"` | klein | aanbevolen nu: herstel |
| Verwijderen laat het spoor staan | ontbreekt: `verwijder` wist spoor en geeft `ok` zonder vondst | `webmaker-spoor.js` | bij verwijderen blijft het spoor (zonder inhoud) staan zolang de site ooit online was; een id die niet bestaat geeft 404 | geen | maker | maker | een site die nooit online stond mag zonder spoor weg | ik verwijder een site die online stond; wie hem publiceerde en wanneer staat er nog; een verkeerd id geeft "niet gevonden" | klein | aanbevolen nu: herstel |
| Prullenbak voor een site | ontbreekt: verwijder is hard; er is nog geen knop in een scherm | `ledenSites` | 30 dagen terug; adres blijft zolang gereserveerd; pas daarna komt de knop in het scherm | geen | maker | maker | geen | ik verwijder een site per ongeluk en zet hem terug op hetzelfde adres | klein | later (eerst als de knop er komt) |
| Toegankelijkheidscontrole vóór publiceren | ontbreekt | blokken, thema (`schoonKleuren`) | contrast van tekst op achtergrond (4,5:1 klein, 3:1 groot, de lat van AGENTS.md), kopvolgorde (geen `h3` zonder `h2`), linktekst ("klik hier" gemeld), taal; uitkomst per probleem met blok-id | automatische controle vangt niet alles: uitkomst graad `vermoed` met "handmatig na te lopen" | maker; bij zaak de manager vóór publiceren | maker; bij zaak de manager | blokkerend alleen voor alt en taal (besluit 3A), de rest waarschuwt | ik zie vóór publiceren "2 problemen: contrast hero (3,1:1), kop overgeslagen" en kan erop tikken om naar het blok te gaan | middel | aanbevolen nu: verdieping |

### L2 Professioneel

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Bedrijfsgegevensblok | ontbreekt | Onderneming (`ingeschreven`, KVK-nummer), zaakprofiel | naam, adres, KVK-nummer en btw-nummer komen uit de bron, nooit ingetypt; opgelost bij elk openen zoals de zaakdata-blokken | ontbrekend KVK-nummer: blok zegt "nog niet ingeschreven"; RTG valideert het nummer niet | maker | zaak; Onderneming geeft leesrecht | lid zonder onderneming: blok niet beschikbaar | de voettekst toont het KVK-nummer uit mijn Onderneming en wijzigt mee als ik het daar corrigeer | klein | aanbevolen nu: verdieping |
| Collecties (CMS) uit een Office-register | ontbreekt | Office Register (zie Office-kaart), verwijzing `rtg://office/<id>` | een blok `collectie` wijst naar een register en toont rijen als lijst of kaarten; opgelost bij elk openen, nooit gekopieerd | register weg of strikt: blok leeg met reden | maker | registereigenaar geeft de site leesrecht | strikt register kan nooit op een site | ik houd mijn portfolio bij in een register en de site toont het direct | middel | later (na Register) |
| Detailpagina per collectie-item | ontbreekt | register-rij | één sjabloonpagina, adres per rij `/<collectie>/<slug>` | geen | bezoeker | n.v.t. | geen | elk project uit mijn register heeft een eigen pagina | middel | later |
| Voorwaarden en privacyverklaring uit Office | ontbreekt | Office-document (fase goedgekeurd) | blok toont de laatst goedgekeurde versie | document niet goedgekeurd: blok toont niets en zegt waarom | maker | documenteigenaar | strikt document: nooit | mijn algemene voorwaarden op de site wijzigen mee zodra ik een nieuwe versie goedkeur | klein | later |

### L3 Organisatorisch

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Concept tegen publicatie met managergrens | bestaat (`zaakweb.js`), onbewezen | site, rol | personeel bewaart, manager publiceert | geen | manager bij een klaar concept | `managerOnly` | lid: eigen site, geen grens | een medewerker kan niet publiceren; de manager ziet wat er gaat veranderen | klein | proef: aanbevolen nu: herstel |
| Gepland publiceren | bestaat (`webmaker-plan.js`), onbewezen | `plan` | een bezoeker na het moment ziet de nieuwe stand meteen (`rijp`) | geen | maker | manager | geen | een actie gaat om 09:00 online zonder dat iemand iets doet | klein | proef: aanbevolen nu: herstel |
| Klaar voor publicatie, met verschil | ontbreekt | concept, bevroren stand (`webmaker-publiceren.js`), versies (`webmaker-versies.js`) | een medewerker zet "klaar voor publicatie"; de manager krijgt een melding en ziet per blok nieuw, gewijzigd of weg (vergelijking op blok-id), met de uitkomst van de toegankelijkheidscontrole; publiceren of terugsturen met opmerking komt in het spoor | geen | manager bij "klaar"; medewerker bij publiceren of terugsturen | medewerker meldt, manager beslist (`managerOnly`) | lid zonder zaak: verschil wel, melding niet | de manager ziet "3 blokken gewijzigd, 1 weg, 0 toegankelijkheidsproblemen" en publiceert; de medewerker ziet dat het online staat | middel | aanbevolen nu: verdieping |
| Gids klopt met de schakelaar | ontbreekt: `appgids-data/deel10b.js` r. 71 | `dom-eigendomein` | de gidstekst leest de schakelaar: uit → "een eigen domein staat in dit huis uit"; aan → hoe het werkt | geen | zaak | n.v.t. | geen | met de schakelaar aan zegt de gids niet meer dat het bewust niet bestaat | klein | aanbevolen nu: herstel |
| Sites per vestiging | ontbreekt | Concern (`kern/concern/` vestiging) | één site per vestiging met gedeelde blokken | geen | vestigingsmanager | scope per vestiging (`concern/scope`) | geen | twee vestigingen delen het merk en tonen elk hun eigen openingstijden | middel | later |

### L4 Domeinintelligentie

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| AI-ontwerp met lokale regelstand | bestaat (`webmaker-ai.js`) | ontwerp | geeft een ontwerp terug, slaat niets op | modeluitvoer graad `vermoed` | maker | maker | geen model: vaste transformaties en uitleg | "maak het luxer" werkt ook zonder model, beperkt en eerlijk | klein | bestaat |
| Merkcontrole | ontbreekt | `server/kern/webmerk.js`, thema | kleuren en fonts buiten het merkthema van de zaak worden gemeld | geen | maker | maker | geen | een kleur die niet in het merkthema zit krijgt een melding | klein | later |
| Leesbaarheidsadvies | ontbreekt | tekstblokken | zinslengte en jargon als advies | `advies` | maker | maker | geen | bij een lange alinea staat een advies, geen verplichting | klein | later |

### L5 Volledige levenscyclus

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Zaak stopt: site offline met nette laatste pagina | ontbreekt | Onderneming-fase, zaakstatus | bij opheffing gaat de site offline; adres blijft een jaar gereserveerd | geen | manager | eigenaar zaak | geen | na opheffing toont het adres "deze zaak is gestopt", geen 404 | klein | later |
| Export van een site | ontbreekt | `webdomein-html.js` | de gepubliceerde stand als HTML-bestanden mee bij vertrek | geen | eigenaar | eigenaar | live zaakblokken worden als stand van die dag geëxporteerd | ik neem mijn site als bestanden mee | klein | later |
| Lid wordt ondernemer: site gaat mee | ontbreekt | `persoonlijk`, Onderneming | een persoonlijke site kan aan een zaak worden overgedragen, met spoor | geen | lid | lid + manager | geen | mijn persoonlijke site wordt de site van mijn nieuwe zaak | klein | later |

### L6 RTG-samenhang

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Live zaakdata | bestaat | zaakprofiel | bron per blok | geen | n.v.t. | n.v.t. | geen | zie a. | klein | bestaat |
| Formulier naar werklijst of gesprek | bestaat (via Browser) | sitebericht | zie Browser-kaart | geen | zaak of lid | ingelogd lid | publieke HTML: geen formulier | zie Browser | klein | bestaat |
| Vacatures naar werving | half: `vacatures` als zaakbron | werving (`kern/werk.js`) | sollicitatie landt op de leidingsplek | geen | manager | manager | geen | zie Browser-kaart besluit 2 | klein | herstel bij Browser (eigenaar Browser/RT Mail) |
| Prijzen naar verkoop | ontbreekt | Commerce (`handel.verkoopwegen`) | een "koop"-knop leidt naar de bestaande verkoopweg; de site rekent nooit zelf af | geen | koper | zaak | geen | de knop opent de bestelweg van de zaak, en de informatieplicht staat daar | middel | later (eigenaar Commerce) |

### Modus LOS

Kerntaak: een site bouwen, versies bewaren, publiceren op `naam.rtg`. Per groep wat er
gebeurt als iets ontbreekt, met de letterlijke schermtekst (u-vorm).

**Eigen (de Sitemaker bezit het en kan het altijd)**: blokken en pagina's, thema,
versies en herstel, publiceren, offline, gepland publiceren, spoor, meting, de lokale
AI-regelstand.

| Wat ontbreekt | Schermtekst |
|---|---|
| adres bezet | "Dit adres is al bezet. Kies een ander." |
| een medewerker wil publiceren | "Publiceren doet de leiding; uw concept is bewaard en staat klaar." |
| AI zonder model | "Zonder taalmodel past de Sitemaker vaste stijlregels toe; uw ontwerp is niet opgeslagen tot u bewaart." |

**Noodzakelijke platformdiensten** (account en sessie, opslag, rolgrens
`managerOnly`, identiteitskluis voor de codenaam op een persoonlijke site, de veger
voor gepland publiceren):

| Wat ontbreekt | Schermtekst |
|---|---|
| sessie verlopen of geen account | "Log in om uw site te bewerken; zonder account bewaart de Sitemaker niets." |
| opslag schrijft niet | "Bewaren is niet gelukt; uw ontwerp staat nog hier, probeer het zo opnieuw." |
| veger liep niet (herstart) | "Gepland voor 09:00; de nieuwe stand gaat naar buiten bij de eerste bezoeker of de volgende ronde." |

**Optionele koppelingen** (Browser, zaakprofiel en Horeca, Onderneming, Office,
boardroom-schakelaar):

| Wat ontbreekt | Schermtekst |
|---|---|
| Browser niet bereikbaar | "Uw site staat online op het RTG-web; lezers openen hem in de Browser." |
| zaakprofiel of Horeca zonder gegevens | "Dit blok is leeg omdat er nog geen <menu> is; de rest van de site werkt." |
| Onderneming zonder inschrijving (bedrijfsgegevensblok) | "Nog niet ingeschreven; het blok toont uw KVK-nummer zodra het in Onderneming staat." |
| `dom-eigendomein` uit | "Een eigen domein staat in dit huis uit; dat beslist de boardroom." |

### Modus SAMEN: een nieuwe zaak zet haar site op

1. In Onderneming komt de zaak tot "eersteklant" (`server/kern/onderneming/fase.js`).
2. Een medewerker opent de Sitemaker via de zaak en kiest een sjabloon; bewaart met
   herhaalsleutel.
   - Storing: dubbele tik op bewaren. Gevolg: één stand. Bewaard: die stand.
3. Hij voegt zaakdata-blokken toe: menu (Horeca), openingstijden, vacatures, en het
   bedrijfsgegevensblok (verdieping L2).
   - Storing: Horeca heeft nog geen menu. Wat de bezoeker ziet: een leeg blok met
     reden; de site werkt verder.
   - Storing: de zaak is nog niet ingeschreven. Wat het blok zegt: "Nog niet
     ingeschreven".
4. De manager zet drie collega's op de teampagina (`webmaker-team.js`).
5. De medewerker zet "klaar voor publicatie" (verdieping L3).
   - Storing: een galerijfoto heeft geen alt-tekst. Wat hij ziet: de controle noemt
     het blok; publiceren blijft dicht tot hij een beschrijving of "decoratief" kiest.
   - Storing: hij probeert zelf te publiceren. Wat hij ziet: de weigering van
     `managerOnly`. Bewaard: het concept.
6. De manager ziet het verschil en plant publicatie op maandag 09:00 op `bistro.rtg`.
   - Storing: adres bezet. Wat hij ziet: 409 "Dit adres is al bezet. Kies een ander."
   - Storing: server herstart zondagnacht. Gevolg: de veger of de eerste bezoeker na
     09:00 zet de stand alsnog naar buiten (`rijp`).
7. Een lid opent de site in de Browser en stuurt een reserveringsverzoek; de zaak
   ziet een klus in de werklijst.
8. Een collega gaat uit dienst; hij verdwijnt vanzelf van de teampagina (alleen
   verwijzingen).
9. De zaak wil `bistro.nl`.
   - Storing: `dom-eigendomein` staat uit. Wat de manager ziet: de uitleg dat dit een
     boardroombesluit is. Bewaard: niets gekoppeld.

### Modus SAMEN als contractblok (VOORSTEL)

Voorstel; `scripts/lib/appcontract.js` blijft ongewijzigd.

```js
samen: {
  functie: 'link:sitemaker', familie: 'WorkOS',
  belofte: 'een lid of zaak bouwt een eigen website met live bedrijfsgegevens, haalt hem door de toegankelijkheidscontrole en zet hem online; bij een zaak publiceert alleen de leiding, na het verschil te zien, en een ander lid komt er niet aan',
  ingang: '/apps/sitemaker.html',
  bestanden: ['public/apps/sitemaker.html'],
  scenario: 'scripts/lib/voltooi/sitemaker.js',
  ketens: [
    { naam: 'site leesbaar in de Browser', uitgeeft: 'werk.website-maker', ontvangt: 'web.browser',
      vorm: 'projectie', eigenaar: 'werk.website-maker',
      toestemming: 'alleen de gepubliceerde stand; lezer is een lid met account',
      storingen: ['site offline: 404 "Geen RTG-site op dit adres."', 'gepland maar nog niet rijp: oude stand'],
      proef: 'scripts/lib/voltooi/sitemaker.js (stap 3)' },
    { naam: 'live zaakdata op de site', uitgeeft: 'zaak.beheer', ontvangt: 'werk.website-maker',
      vorm: 'verwijzing', eigenaar: 'zaak.beheer',
      toestemming: 'de zaak zelf; opgelost bij elk openen, nooit gekopieerd',
      storingen: ['bron leeg of weg: blok leeg met reden'],
      proef: 'test/webplatform.test.js (test)' },
    { naam: 'bedrijfsgegevens uit Onderneming', uitgeeft: 'werk.onderneming', ontvangt: 'werk.website-maker',
      vorm: 'projectie', eigenaar: 'werk.onderneming',
      toestemming: 'de zaak; alleen naam, adres, KVK- en btw-nummer',
      storingen: ['niet ingeschreven: "Nog niet ingeschreven"', 'Onderneming uit: blok leeg met reden'],
      proef: 'ontbreekt (functie nog niet gebouwd)' },
    { naam: 'collectie uit een Office-register', uitgeeft: 'docs.office', ontvangt: 'werk.website-maker',
      vorm: 'verwijzing', eigenaar: 'docs.office',
      toestemming: 'registereigenaar geeft de site leesrecht; strikt nooit',
      storingen: ['register weg of strikt: blok leeg met reden'],
      proef: 'ontbreekt (functie later)' }
  ]
}
```

## e. RTG-exclusieve mogelijkheden

| Mogelijkheid | Eigenaar | Capability | Waarom geen markt-app dit kan |
|---|---|---|---|
| Een site die actueel is omdat hij naar het eigen bedrijf wijst (menu, rooster, vacatures, KVK-gegevens) | `werk.website-maker` | zaakdata-blokken, `webplatform.js` | marktbouwers hebben een plug-in of import nodig en kopiëren |
| CMS zonder eigen database: collecties zijn Office-registers | `werk.website-maker` + `docs.office` | verwijzing (CREATE.md par. 3 view) | marktbouwers hebben een eigen CMS-opslag naast het kantoorpakket |
| Personeel op de site alleen per bewust besluit, en weg bij uitdiensttreding | `werk.website-maker` | `webmaker-team.js` | markt-teampagina's zijn kopieën die blijven staan |
| Een goedkeuringsstap met verschil en toegankelijkheid in één blik, in elke zaak | `werk.website-maker` | `managerOnly`, versies, controle | bij de markt zit publicatiegoedkeuring in de duurste editie |
| Analytics die niemand volgt | `werk.website-maker` | `webmaker-meting.js` | markt-analytics leven van bezoekersprofielen |

## f. Bouwstenen en ontbrekende koppelingen

**Bestaande modules**: alle `server/kern/webmaker*.js`, `server/kern/webdomein.js`,
`server/kern/webdomein-html.js`, `server/kern/webplatform.js`, `server/kern/webmerk.js`,
`server/routes/zaakweb.js`, Office Register (ontwerp in de Office-kaart),
`server/kern/onderneming/`, `server/kern/concern/`.

| Van | Naar | Vorm | Toestemming |
|---|---|---|---|
| blok `beeld`/`galerij` met `alt` | publieke HTML | regel in `webdomein-html.js` | maker |
| pagina-instelling taal | `lang` in publieke HTML | regel | maker |
| "klaar voor publicatie" | melding aan de manager met verschil | gebeurtenis | medewerker meldt, manager beslist |
| bedrijfsgegevensblok | Onderneming | projectie | zaak |
| blok `collectie` | Office Register | verwijzing, opgelost bij openen | registereigenaar geeft leesrecht |
| voorwaardenblok | Office-document, fase goedgekeurd | verwijzing | documenteigenaar |
| `prijzen` met knop | Commerce verkoopweg | verwijzing | zaak |
| zaakstatus gestopt | site offline | gebeurtenis | eigenaar zaak |

## g. Prioritering

**HERSTEL** (niets gerepareerd in de reparatieronde; alles open)

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Alt-tekst als eigen veld, verplicht bij publiceren | klein | laag | `webmaker-schoon.js`, `webdomein-html.js` | aanbevolen nu |
| Taal per pagina | klein | laag | `webmaker-paginas.js`, `webdomein-html.js` | aanbevolen nu |
| Verwijderen laat het spoor staan; 404 bij onbekend id | klein | laag | `webmaker.js`, `webmaker-spoor.js` | aanbevolen nu |
| Gidstekst klopt met `dom-eigendomein` | klein | laag | `appgids-data/deel10b.js` | aanbevolen nu |
| Proef op managergrens en gepland publiceren | klein | laag | `scripts/lib/voltooi/sitemaker.js` | aanbevolen nu |

**VERDIEPING**

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Toegankelijkheidscontrole vóór publiceren | middel | middel | thema, AGENTS.md-contrastlat | aanbevolen nu |
| Klaar voor publicatie, met verschil per blok | middel | middel | `webmaker-versies.js`, `webmaker-publiceren.js` | aanbevolen nu |
| Bedrijfsgegevensblok uit Onderneming | klein | laag | `server/kern/onderneming/` | aanbevolen nu |

**Later en niet doen**

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Prullenbak voor een site | klein | laag | knop in het scherm | later |
| Collecties uit Office-register | middel | middel | Office Register | later |
| Voorwaardenblok uit Office | klein | laag | Office-fasen | later |
| Sites per vestiging | middel | middel | `kern/concern/` | later |
| Export, nette stop, overdracht lid naar zaak | klein | laag | `webdomein-html.js`, Onderneming | later |
| Afrekenen in de site | groot | hoog | Commerce | niet doen: verkoop heeft een eigenaar; de site verwijst |
| Eigen code (scripts) in een site | middel | hoog | n.v.t. | niet doen: derdencode draait nooit op de RTG-herkomst (OFFICE.md punt 6) |

## h. Toetsbaar eindcontract Beyond Premium

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| Breedte | persoonlijke site, zaaksite, meerdere pagina's, bedrijfsgegevens, later collecties | voltooiproef met een bedrijfsgegevensblok | geen bedrijfsgegevens, geen collecties |
| Professionele diepte | bedrijfsgegevens uit de bron, gepland publiceren, verschil vóór publiceren | nieuwe tests per blok; voltooiproef met plan | gepland ja (onbewezen), rest nee |
| Levenscyclus | het spoor overleeft verwijderen; export en nette stop | test op verwijderen met spoor | nee |
| Samenwerking en rollen | personeel maakt en meldt, leiding ziet het verschil en publiceert; team alleen per besluit | voltooiproef zaakkant | staat, onbewezen; BEVOEGD B |
| Domeinintelligentie | toegankelijkheid en merk gecontroleerd vóór publiceren, met graad | nieuwe test: een galerij zonder alt kan niet online; een pagina in het Engels draagt `lang="en"` | nee |
| Los functioneren | zonder AI, Browser-berichten en zaakprofiel blijft bouwen en publiceren werken, met de schermteksten uit Modus LOS | voltooiproef met die delen uit | niet beproefd |
| RTG-ketens | zaakdata, bedrijfsgegevens, formulier, vacatures en prijzen wijzen naar hun eigenaar | `test/webplatform.test.js` + nieuwe | zaakdata ja |
| Bewezen betrouwbaarheid | acht bewijzen B | centrale meetronde | 4 B centraal, 4 lokaal gesloten |

Dit contract vervangt de acht bewijzen van APPWERKT nooit.

## Twee uitkomsten

**(A) Binnen de huidige architectuur en scope**

HERSTEL

| Functie | Kosten | Bouwt op |
|---|---|---|
| Alt-tekst verplicht, taal per pagina | klein | `webmaker-schoon.js`, `webdomein-html.js`, `webmaker-paginas.js` |
| Verwijderen laat het spoor staan | klein | `server/kern/webmaker.js`, `webmaker-spoor.js` |
| Gidstekst volgt de schakelaar | klein | `server/kern/appgids-data/deel10b.js`, `cat-domeinen2.js` |
| Proef op zaakkant en gepland publiceren | klein | `scripts/lib/voltooi/sitemaker.js` |

VERDIEPING

| Functie | Kosten | Bouwt op |
|---|---|---|
| Toegankelijkheidscontrole vóór publiceren | middel | thema's, contrastlat uit AGENTS.md, `TOEGANKELIJK.md` |
| Klaar voor publicatie met verschil per blok | middel | `webmaker-versies.js`, `webmaker-publiceren.js`, `managerOnly` |
| Bedrijfsgegevensblok | klein | `server/kern/onderneming/` |

LATER: prullenbak, collecties uit Office-register, voorwaardenblok, sites per
vestiging, export, nette stop (klein tot middel; Office Register, `kern/concern/`).

**(B) Het domeinmaximum, ook buiten de huidige scope.** Richting, geen toezegging.

| Proces | Stappen | Rollen en organisaties | RTG-apps en eigenaar | Nodig buiten scope |
|---|---|---|---|---|
| Online aanwezigheid van een startende onderneming | 1 werktitel en rechtsvorm; 2 KVK-inschrijving (extern); 3 site met bedrijfsgegevens; 4 voorwaarden en privacyverklaring; 5 aanbod en prijzen; 6 contact en reserveren; 7 vacatures; 8 groei naar vestigingen | ondernemer, KVK (extern), personeel | Onderneming (`werk.onderneming`), Sitemaker, Office, Browser, RT Mail, Werk OS | eigen domein buiten het RTG-web: boardroombesluit (`dom-eigendomein`); DNS en certificaten blijven extern |
| Webwinkel volgens de wet | 1 productcatalogus; 2 prijzen incl. btw; 3 afrekenen; 4 bevestiging; 5 herroeping binnen 14 dagen met knop; 6 retour; 7 toegankelijkheid (EAA) | zaak, koper, betaaldienst | Sitemaker (weergave), Commerce (`handel.verkoopwegen`, eigenaar), Geld | afrekenen op een publieke site voor niet-leden botst met "een gast is geen gebruiker": besluit; alle wetsregels hier: te controleren |
| Redactie en publicatie voor een organisatie | 1 contentplanning; 2 schrijven in Office; 3 review; 4 goedkeuring; 5 gepland publiceren; 6 archief; 7 meting zonder bezoekersprofiel | redacteur, eindredacteur, manager | Office (documenten, registers), Sitemaker, Werk OS (planning) | rollen per site (redacteur, eindredacteur) naast de zaakrollen: besluit, want geen derde rechtenmodel (`onderneming/toegang.js`) |
| Visueel ontwikkelplatform (de ambitie) | 1 eigen componenten; 2 interacties; 3 data uit collecties; 4 branches; 5 publicatieworkflow | ontwerper, ontwikkelaar | Sitemaker, Office, App Store/Developer Cloud | eigen code in sites botst met APPSTORE.md (derdencode draait nooit op de RTG-herkomst): nieuw domein en besluit; declaratief samenstellen uit bestaande blokken past wel |

## Vraagt besluit

1. **Eigen domein en lezers zonder account.**
   - A (aanbevolen): schakelaar blijft standaard uit; aan per zaak (niet per lid) na een toegankelijkheidscontrole en met een vaste uitleg dat contact via de leden-app gaat. Kosten: middel.
   - B: aan voor iedereen. Kosten: klein; codenaamsites van leden worden openbaar leesbaar.
   - C: nooit. Kosten: geen; de ambitie "domeinen" valt af, en de gidstekst klopt dan weer.
2. **CMS: eigen collecties in de Sitemaker of Office-registers?**
   - A (aanbevolen): Office-register als bron, de site verwijst. Kosten: middel; wacht op het Register.
   - B: eigen collecties in `ledenSites`. Kosten: middel; tweede lijstenopslag naast Office.
3. **Toegankelijkheidscontrole: blokkerend of waarschuwend?** (een huisregel, geen wetsuitleg; de EAA-reikwijdte is te controleren)
   - A (aanbevolen): blokkerend voor alt-tekst en taal, waarschuwend voor contrast en kopvolgorde. Kosten: middel.
   - B: alles waarschuwend. Kosten: klein; sites zonder alt-tekst kunnen online.
   - C: alles blokkerend. Kosten: middel; een automatische controle die fout zit houdt een site tegen.
4. **Het spoor bij verwijderen.**
   - A (aanbevolen): het spoor blijft (zonder inhoud) voor elke site die ooit online stond. Kosten: klein.
   - B: zoals nu, alles weg. Kosten: geen; wie publiceerde is na verwijderen niet meer na te gaan.
