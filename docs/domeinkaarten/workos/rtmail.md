# RT Mail (link:rtmail)

Eigenaar: `comm.mail` (SCHERMEIGENAAR.json, doelgroep `lid`, ingang
`/apps/rtmail.html`) en `zaak.rtmail` (doelgroep `zaak`, ingang
`/apps/leverancier-rtmail.html`). Het oordeel over die twee schermen staat open:
klasse "zelfde-component", eigenaar `apps/rtmail.html`, vervolg "De zaakkant heeft
een eigen inline-implementatie; laat die de rtmail-modules gebruiken."
Doelgroepen: lid, zaak (teamadres), kantoor (`rahultravelgroup.rtg`).

## a. Inventaris van het bewezen bestaande

**Wat er staat**

- Schermen: `public/apps/rtmail.html` (lid) en `public/apps/leverancier-rtmail.html` (zaak).
- Routes:
  - `server/routes/rtmail-lid.js`: `/api/member/rtmail/adres`, `inbox`, `lees`,
    `documenten`, `classificeer`, `workflow` (agenda, project);
  - `server/routes/rtmail-vak.js` en `rtmail-schrijf.js`: concept bewaar,
    verstuur, weg; concepten, antwoord, verplaats, sluimer, ster, etiket, zoek,
    draad, gesprekken, regels, alias, afwezig, handtekening, imap;
  - `server/routes/rtmail-team.js`: 16 routes `/api/member/rtmail/team/*` (maak, hef,
    mijn, postvak, pak, af, stuur, verlaat, overzicht, dossier, status, prioriteit,
    notitie, koppel, bevestiging, lid);
  - `server/routes/rtmail.js`: zaakkant `/api/supplier/rtmail/*`;
  - `server/routes/rtmail-bestuur.js` (bewaring, export);
  - `server/routes/mailpost.js`: `/api/mail/binnen` en SES, achter `server/kern/mailpoort.js`
    (gedeeld geheim, minstens 32 tekens, anders 401).
- Kern (ruim 30 bestanden, 3932 regels), o.a.:

| Onderdeel | Wat het doet | Pad |
|---|---|---|
| Adres | `codenaam@<pas>.rtg`; linkerdeel van een LEDENadres is nooit de echte naam; oud adres blijft werken | `server/kern/rtmail-adres.js` |
| Mappen | in, archief, prullenbak; prullenbak is een MAP, geen vernietiging | `server/kern/rtmail-vak.js` |
| Concept en versturen | bewaren, plannen (`plan`), versturen met handtekening | `server/kern/rtmail-schrijf.js` |
| Instellingen | handtekening, afwezigheid met vier lus-remmen, maximaal 5 aliassen | `server/kern/rtmail-inst.js` |
| Regels | bij ELKE bezorging: opbergen, weggooien (map), etiket, ster, lezen; doorsturen naar buiten mag NIET | `server/kern/rtmail-regels.js` |
| Teams | gedeeld adres, toewijzen (pak), afhandelen (af); "het adres is gedeeld, de hand niet"; geen ranglijst | `server/kern/rtmail-team.js`, `rtmail-teampost.js` |
| Dossier | status, prioriteit, interne notitie, koppeling aan klant of ticket | `server/kern/rtmail-dossier.js` |
| SLA | klok tot het eerste MENSELIJKE antwoord; norm urgent 30, hoog 120, normaal 480, laag 1440 minuten; ontvangstbevestiging met drie lus-remmen | `server/kern/rtmail-sla.js` |
| Bewaring | termijn per postvak (standaard 0 = nooit automatisch), juridische bewaring wint, vernietiging met spoor zonder inhoud; export met recht én reden | `server/kern/rtmail-bewaar.js`, `rtmail-recht.js` |
| Leidingsplek (werving) | termijn 28 dagen, verlengen tot 365 met grondslag; juridische hold met vier ogen op gekeurde identiteit (besluit 584A) | `rtmail-leiding*.js` |
| Integriteit | HMAC-zegel per bericht; oude berichten heten `legacy` | `server/kern/rtmail-veiligheid.js` |
| Inkomend van buiten | origineel ongewijzigd bewaard; SPF, DKIM, DMARC als STEMPEL, geen poortwachter; links onklikbaar | `mailinkomend.js`, `mailspf.js`, `mailauth.js`, `mailaanname.js`, `server/dkim.js` |
| Uitgaand | wachtrij met 1, 5, 15, 60, 240 minuten, geen herhaling bij 5xx, dead-letter-lade, dubbele aflevering herkend | `server/kern/mailwachtrij.js` |
| Publieke adressen | `voor.achternaam@<pas>.rahultravelgroup.com` en werkdomeinen; staan alleen aan na expliciete configuratie | `server/kern/mail-publiek.js` |
| AI | samenvatten, actiepunten, phishing uitleggen; elke bewering met bericht-id; geen taalmodel nodig | `server/kern/rtmail-ai.js` |

**Wat BEWEZEN is**

- APPWERKT.json (`link:rtmail`): bereikbaar, bedienbaar, menselijk, voltooibaar,
  waarheidsgetrouw, persistent en herstelbaar BEWEZEN; bevoegd NIET_GETEST. Dit is
  centraal bewezen (feiten-bewijs.txt).
- Scenario: `scripts/lib/voltooi/rtmail.js`: adres, inbox, lees en de conceptroutes,
  met een tweede lid.
- BEVOEGD.json: 63 routes gemeten, 35 open. IDOR.json: 0 doorbraken.
- Tests: o.a. `test/rtmail.test.js`, `rtmail-team.test.js`, `rtmail-alias.test.js`,
  `rtmail-bestuur.test.js`, `rtmail-leidinghold.test.js`, `rtmail-leidingtermijn.test.js`,
  `rtmail-zaak.test.js`, `mail-publiek.test.js`, `mail-uitgang.test.js`, `mailauth.test.js`.

**Staat, onbewezen** (niet in de proef gelopen): teams, aliassen, gepland versturen,
regels, publieke mail naar buiten, de zaakkant, bewaring en export.

**Wat de code zelf als niet gebouwd of open opgeeft**

- De zaakkant heeft een eigen inline-implementatie (SCHERMEIGENAAR-oordeel open).
- Publieke mail naar buiten staat uit tot configuratie (`mail-publiek.js`).
- Geen herhaalsleutel op versturen gevonden (`rtmail-schrijf.js` `verstuur`).
- Een spamoordeel is een stempel; er is geen quarantainemap (`mailaanname.js`).

## b. Marktvergelijking

Alleen ter vergelijking, nooit als partner. Geraadpleegd 2026-10-19.

| Leider | Achter de betaalmuur | Wij | Bron |
|---|---|---|---|
| Exchange Online Plan 2 ($8) | mailbox 100 GB, archief tot 1,5 TB, Litigation Hold, DLP | half: juridische bewaring ja, exportjournaal ja; geen DLP, geen archiefniveau | https://www.microsoft.com/en-us/microsoft-365/exchange/compare-microsoft-exchange-online-plans (via zoektool, live te controleren) |
| Google Workspace met Vault (Business Plus, Enterprise) | eDiscovery en holds; 30 dagen na downgrade gaan holds weg | half: hold ja, en hier zonder downgrade-afloop; eDiscovery-zoeken over postvakken heen nee | https://support.google.com/vault/answer/2462365 (via zoektool, live te controleren) |
| Gmail zakelijk | eigen domein, meer opslag, 99,9% | half: eigen domein alleen na configuratie; geen uptime-belofte | https://workspace.google.com/solutions/business-email/ (via zoektool, live te controleren) |
| Proton Mail Business | aantal eigen domeinen per plan (3 / 15 / 20) [oud] | nee: geen eigen domein per zaak in de app | https://proton.me/business/mail/pricing (via zoektool, live te controleren) |
| Mimecast Advanced (offerte) | archief met "perpetual retention" [archieftiers oud] | half: termijn tot 36500 dagen, geen apart archiefniveau | https://www.mimecast.com/products/mimecast-plans/ (via zoektool, live te controleren) |

Wat de markt als betaalde helft verkoopt en hier standaard is: gedeelde inbox met
toewijzen (kop van `rtmail-team.js`), SLA-klok, interne notities.

## c. Analyse van het volledige domein

**Particulier.** Post van mensen en instanties, abonnementen, facturen, een
afwezigheidsbericht. Wat telt: alleen wat ertoe doet, phishing herkennen, niets kwijt.

**Professioneel.** Een zzp'er heeft één adres naar buiten, offertes en facturen in
de post, en een klok op klantvragen. Fiscaal relevante e-mail valt onder de
bewaarplicht.

**Organisatie.** Functieadressen (receptie, boekhouding, werving), toewijzing, SLA,
bewaarbeleid per soort post, juridische bewaring, export voor een geschil, en
beveiligingsplichten (NIS2 voor wie eronder valt).

| Eis | Bron | Gevolg voor software |
|---|---|---|
| Fiscale bewaarplicht 7 jaar (art. 52 AWR); bij een factuur per mail ook de mail zelf bewaren | https://stichtingenvereniging.belastingdienst.nl/bijzondere-onderwerpen/administratie/de-bewaarplicht/ | een zakelijk postvak moet een ondergrens kennen voor post met fiscale waarde; nu kan de termijn op elk getal van 0 tot 36500 dagen (`rtmail-bewaar.js` `zetTermijn`) |
| Spam (art. 11.7 Tw): toestemming vooraf, 5 jaar aantoonbaar; uitzondering bestaande klanten; afmeldmogelijkheid in elk bericht | https://www.acm.nl/nl/verkoop-aan-consumenten/reclame-en-verleiden/spam-voorkomen-uw-reclame | RT Mail kent geen bulk- of nieuwsbriefverzending; komt die er, dan horen toestemming en afmelden bij het verzenden, niet erna |
| AVG art. 5: niet langer dan nodig; sollicitatiepost | https://autoriteitpersoonsgegevens.nl/nl/over-privacy/persoonsgegevens/bewaren-van-persoonsgegevens | bestaat voor werving (28 dagen, 584A) |
| AVG art. 33: datalek binnen 72 uur | https://autoriteitpersoonsgegevens.nl/nl/onderwerpen/beveiliging/meldplicht-datalekken | een verkeerd geadresseerd bericht met persoonsgegevens is een mogelijk datalek: terug te vinden via het spoor |
| Cyberbeveiligingswet (NIS2) sinds 15-8-2026: melden binnen 24 uur, 72 uur en 1 maand | https://www.ncsc.nl/cyberbeveiligingswet-nis2/meldplicht | voor een zaak die eronder valt is een phishing-incident een mogelijke melding; RT Mail kan de feiten leveren, het melden is extern |
| European Accessibility Act: elektronische communicatie sinds 28-6-2025, EN 301 549 (WCAG 2.1 AA) | https://www.acm.nl/en/accessibility/accessibility-e-commerce-services-and-electronic-communications-services | het postvak zelf moet toegankelijk zijn; `TOEGANKELIJK.md` en de a11y-scan dekken de schermen |

## d. Functiecatalogus L1–L6

### L1 Persoonlijk

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Versturen met herhaalsleutel | ontbreekt (`rtmail-schrijf.js`) | concept-id + `idem` | een herhaling met dezelfde sleutel geeft het eerder verstuurde bericht terug; afwijkende inhoud 409 | geen | afzender | eigenaar postvak | gepland versturen gebruikt dezelfde weg | na een verbroken verbinding tik ik opnieuw op versturen en zie "al verstuurd", niet "concept bestaat niet" | klein | aanbevolen nu |
| Quarantaine voor verdachte post | ontbreekt; spam is een stempel (`mailaanname.js`) | `controles.spam`, `dmarc` | GEZAKT op spam of DMARC: naar map "verdacht", nooit weggooien; lid ziet waarom | stempel kan fout zijn: oordeel met graad `vermoed` | ontvanger in de lijst "verdacht" | eigenaar postvak | interne post (bron lid of systeem) nooit | een phishingmail met gezakte DMARC staat in "verdacht" met de uitleg, en ik kan hem terugzetten | klein | aanbevolen nu |
| Afmelden bij nieuwsbrieven van buiten | ontbreekt | `List-Unsubscribe`-kop van het origineel (`mailinkomend.js` bewaart het origineel) | toon de afmeldweg; nooit zelf klikken | de kop kan vals zijn: alleen tonen bij DMARC geslaagd | ontvanger | eigenaar | links blijven onklikbaar (bestaande regel) | bij een nieuwsbrief zie ik "afmelden" alleen als de afzender klopt | klein | later |
| Ontvangen factuur naar Geld | bestaat (`/api/member/rtmail/documenten`, `classificeer`) | facturatie | de factuurmotor blijft eigenaar | herkenning is `vermoed` | lid | lid | geen | een factuur in de post komt met één tik in mijn administratie | klein | bestaat |

### L2 Professioneel

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Fiscale bewaarklasse per bericht | ontbreekt | `classificeer` (facturatie), dossierkoppeling | post die als factuur of contract is ingedeeld krijgt minimaal 7 jaar, los van de postvaktermijn; de langste termijn wint | indeling is een voorstel, een mens bevestigt; klasse `uitlegbaar` (`kern/fiscaal/zekerheid.js`) | eigenaar bij indelen | eigenaar postvak, manager bij team | juridische bewaring wint altijd | een factuurmail verdwijnt niet bij het opruimen van een postvak met 1 jaar termijn | middel | aanbevolen nu |
| Waarschuwing bij korte termijn op zakelijk postvak | ontbreekt (`zetTermijn` neemt 0 tot 36500) | `B().vakken` | termijn onder 7 jaar op een team- of zaakpostvak vraagt een reden en toont art. 52 AWR | geen | wie de termijn zet | recht bewaartermijn | privépostvak: geen waarschuwing | ik zet 365 dagen op de boekhouding en krijg de waarschuwing met bron | klein | aanbevolen nu |
| Eigen domein per zaak | half: werkdomeinen in `mail-publiek.js`, alleen na configuratie | DNS, DKIM (`server/dkim.js`) | domein telt pas als SPF en DKIM aantoonbaar kloppen | DNS buiten de app | manager | manager + boardroom | geen eigen domein voor leden (codenaam-ontwerp) | een zaak verstuurt als info@zaak.nl en de ontvanger ziet DKIM geslaagd | middel | later (besluit 1) |
| Sjabloonantwoorden voor teams | ontbreekt | teamadres | vaste antwoorden per team; de afzender staat er altijd bij ("namens") | geen | team | teamleden | geen anoniem antwoord (bestaande regel) | de receptie antwoordt met een sjabloon en de klant ziet wie het stuurde | klein | later |

### L3 Organisatorisch

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Teams, toewijzen, afhandelen | bestaat (`rtmail-team.js`), onbewezen | `rtmailTeams` | max. 10 eigen teams per oprichter; geen teller wie het meest afhandelt | geen | teamleden via SSE | teamleden | een team mag geen bestaand postvak kapen (`rtmail-vrij.js`) | twee medewerkers zien hetzelfde bericht; de eerste pakt het op, de tweede ziet "opgepakt door" | klein | voltooiproef uitbreiden: aanbevolen nu |
| SLA-klok met overschrijding | bestaat (`rtmail-sla.js`), onbewezen | prioriteit, eerste menselijk antwoord | klok stopt niet op `bevestiging` of `afwezig` | geen | team bij overschrijding; blijft zichtbaar | teamleden | buiten openingstijden: niet gemodelleerd (zie Vraagt besluit 3) | een urgent bericht zonder menselijk antwoord na 30 minuten staat rood, ook na een automatische bevestiging | klein | aanbevolen nu (proef) |
| Juridische bewaring en export | bestaat (`rtmail-bewaar.js`, `rtmail-recht.js`), onbewezen | postvakbeleid, journaal | bewaring wint van termijn; export vraagt recht en reden en komt in het journaal | geen | journaal; betrokkene bij leidingsplek | recht vernietigen / exporteren | leidingsplek: eigen hold met vier ogen | een hold op een postvak laat het opruimen niets weggooien; de export staat in het journaal met reden | klein | aanbevolen nu (proef) |
| Zaakkant op de rtmail-modules | open (SCHERMEIGENAAR) | `routes/rtmail.js` | één implementatie, twee sessies | geen | n.v.t. | zaakrollen | beperkte post (werving) alleen voor de manager | het zaakscherm gebruikt dezelfde modules; een test vergelijkt beide | middel | aanbevolen nu |
| Doorsturen naar buiten | bewust niet (`rtmail-regels.js`) | n.v.t. | lek- en lusrisico | n.v.t. | n.v.t. | n.v.t. | team is de zichtbare vervanger | n.v.t. | n.v.t. | niet doen: kortste weg naar een gekaapt postvak |

### L4 Domeinintelligentie

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Samenvatten met herkomst | bestaat (`rtmail-ai.js`) | draad | elke bewering met bericht-id; werkt zonder model | graad `vermoed` | lezer | lezer | AI doet nooit: betalen, accepteren, versturen, verwijderen | elke zin in de samenvatting springt naar zijn bericht | klein | bestaat |
| Phishinguitleg | bestaat | links, stempels | een waarschuwing wordt nooit onderdrukt | `vermoed` | lezer | lezer | geen | een nep-bankmail krijgt de uitleg welke link waarheen gaat | klein | bestaat |
| SLA-vooruitblik per team | ontbreekt | open dossiers, normen | aantal dat binnen een uur over de norm gaat, als telling; nooit per medewerker | het is een voorspelling, klasse `advies`; geen getal waar er geen is | team | teamleden | geen | de receptie ziet "3 berichten gaan binnen een uur over de norm" | klein | later |
| Herkennen van fiscale post | half (`classificeer`) | inhoud, bijlagen | voorstel, mens bevestigt | `vermoed` | eigenaar | eigenaar | geen | een factuurmail krijgt het voorstel "fiscaal, 7 jaar" | klein | later |

### L5 Volledige levenscyclus

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Adres volgt de pas | bestaat (`rtmail-adres.js`) | lidmaatschap | oud adres blijft werken | geen | lid | n.v.t. | geen | na een paswissel komt post op het oude adres nog aan | klein | bestaat |
| Uit dienst: postvak overdragen | ontbreekt | `bedrijf/uitdienst.js`, teamlidmaatschap | teamlidmaatschap vervalt; persoonlijk werkpostvak gaat met afwezigheidsbericht naar de manager; privépost van het lid blijft van het lid | wat werkpost is: alleen `rahultravelgroup.rtg` of werkdomein | manager | manager | leidingsplek: eigen termijn | na uitdiensttreding staat er een afwezigheidsbericht met het teamadres | middel | later |
| Opzeggen lidmaatschap: export | half: export met reden (`rtmail-bewaar.js`) | postvak | lid exporteert zijn eigen post zonder reden-eis van derden | geen | lid | lid | hold: export mag, vernietigen niet | ik neem bij vertrek al mijn post mee als bestand | klein | later |

### L6 RTG-samenhang

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Mail naar Werk OS-taak | bestaat (`server/bedrijf/postbrug.js`) | bericht | herkomst `rtg://`, twee sleutels, dezelfde persoon | geen | maker taak | eigenaar postvak + werkruimtelid | geen | een klantmail wordt een taak die terugwijst naar de mail | klein | bestaat |
| Mail naar project | bestaat (`workflow`, RTG One `project/van-mail`) | bericht | eigenaar project blijft Project Room of Werk OS | geen | maker | lid | geen | idem | klein | bestaat |
| Automatiseringen bezorgen in het zaakpostvak | bestaat (`server/kern/automatisering.js`) | sollicitatie, inkoop, btw | bron `systeem` | geen | zaak | zaak | systeempost stopt de SLA-klok nooit | n.v.t. | klein | bestaat |
| Bijlage naar Office | ontbreekt | `mailbijlage.js` | wordt document met herkomst | formaat | eigenaar | eigenaar | bijlage van buiten nooit automatisch | zie Office-kaart | middel | later (eigenaar Office) |

**Modus LOS.** Kerntaak: post lezen, schrijven, versturen, ordenen binnen RTG.
Zonder Werk OS, Geld en AI blijven postvak, teams, SLA en bewaring werken; de
knoppen "naar taak" en "naar administratie" zeggen "niet beschikbaar" en bewaren
niets half. Zonder publieke configuratie zegt het scherm: "Post naar buiten staat
voor dit huis uit; binnen RTG werkt alles."

**Modus SAMEN: klantvraag bij een zaak, van binnenkomst tot bewaren**

1. Een klant van buiten mailt `receptie@<zaak>.partner.rtg` (na configuratie van het
   publieke adres). De mailserver levert af op `/api/mail/binnen`.
   - Storing: `RTG_MAILPOORT_GEHEIM` ontbreekt. Gevolg: 401; de mail blijft bij de
     verzendende server (die opnieuw probeert). Niets half bezorgd.
2. `mailaanname.js` bewaart eerst het origineel, stempelt SPF/DKIM/DMARC.
   - Storing: DNS-opzoeking faalt. Gevolg: "De SPF- en DMARC-controle liep vast; het
     bericht is wel bezorgd." Bewaard: origineel en melding.
3. Regels lopen bij de bezorging; het bericht krijgt etiket "offerte".
4. De SLA-klok start (normaal: 480 minuten); de ontvangstbevestiging gaat één keer uit.
   - Storing: de klant heeft ook een afwezigheidsbericht. Gevolg: geen lus (drie remmen).
5. Medewerker A pakt het op; B ziet "opgepakt door A".
6. A zet het via de postbrug om naar een Werk OS-taak en koppelt de klant in het dossier.
   - Storing: Werk OS uit. Gevolg: de knop zegt "niet beschikbaar"; dossier en
     klok lopen door.
7. A antwoordt vanaf het teamadres; de klant ziet "<codenaam> namens de receptie".
   - Storing: de ontvangende server geeft een tijdelijke fout. Gevolg: wachtrij
     herprobeert (1, 5, 15, 60, 240 min); daarna dead-letter met de foutmelding,
     zichtbaar voor het team.
8. De klant stuurt een factuur; A deelt in als factuur; Geld neemt over.
9. Bewaren: de factuurmail valt onder 7 jaar (functie L2, nu ontbrekend).

## e. RTG-exclusieve mogelijkheden

| Mogelijkheid | Eigenaar | Capability | Waarom geen markt-app dit kan |
|---|---|---|---|
| Postvak op codenaam: een adres dat rondreist lekt geen echte naam | `comm.mail` | `rtmail-adres.js` + kluis | markt-mail is gebouwd op echte namen of vrije aliassen |
| Mail wordt werk zonder kopie: taak, project, administratie met herkomst | `comm.mail` + Werk OS + Geld | `postbrug.js`, `herkomst.js` | markt-koppelingen kopiëren de mail naar een ander systeem |
| Gedeeld adres waarop een mens altijd zichtbaar is | `comm.mail` | `rtmail-team.js` | markt-inboxen staan anoniem antwoorden vanaf een functieadres toe |
| Hold met vier ogen op gekeurde identiteit | `zaak.rtmail` | `rtmail-leidinghold.js` | markt-holds vragen een beheerdersrol, geen gekeurde tweede persoon |

## f. Bouwstenen en ontbrekende koppelingen

**Bestaande modules**: alle `server/kern/rtmail-*.js` en `mail*.js`, `server/dkim.js`,
`server/bedrijf/postbrug.js`, `server/kern/automatisering.js`, facturatie via
`/api/member/rtmail/classificeer`, `server/kern/fiscaal/zekerheid.js`.

| Van | Naar | Vorm | Toestemming |
|---|---|---|---|
| `classificeer` (factuur) | bewaarklasse per bericht | regel in `rtmail-bewaar.js` | eigenaar postvak |
| `mailaanname.js` stempel | map "verdacht" | regel bij bezorging (`rtmail-regels.js`-haak) | geen extra |
| `bedrijf/uitdienst.js` | teamlidmaatschap en afwezigheid | gebeurtenis | manager |
| zaakscherm | rtmail-modules | zelfde component | zaakrollen |
| `mailbijlage.js` | Office | gebeurtenis met herkomst | eigenaar |

## g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Herhaalsleutel op versturen | klein | laag | `rtmail-schrijf.js` | aanbevolen nu |
| Quarantainemap "verdacht" | klein | laag | `mailaanname.js`, `rtmail-regels.js` | aanbevolen nu |
| Fiscale bewaarklasse per bericht | middel | middel | facturatie, `rtmail-bewaar.js` | aanbevolen nu |
| Waarschuwing korte termijn zakelijk postvak | klein | laag | `rtmail-bewaar.js` | aanbevolen nu |
| Zaakkant op de rtmail-modules | middel | middel | SCHERMEIGENAAR-oordeel | aanbevolen nu |
| Voltooiproef uitbreiden: team, SLA, bewaring | klein | laag | `scripts/lib/voltooi/rtmail.js` | aanbevolen nu |
| Eigen domein per zaak | middel | middel | besluit, DNS | later |
| Uit dienst: postvak overdragen | middel | middel | `bedrijf/uitdienst.js` | later |
| SLA-vooruitblik | klein | laag | `rtmail-sla.js` | later |
| Nieuwsbrief/bulkverzending | middel | middel | toestemmingsregister art. 11.7 Tw | niet doen nu: nieuw domein, spamrisico |
| Doorsturen naar buiten | klein | laag | n.v.t. | niet doen (lek en lus) |

## h. Toetsbaar eindcontract Beyond Premium

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| Breedte | lid, team, zaak en kantoor gebruiken één implementatie | test die zaakscherm en lidscherm op dezelfde modules legt | nee: zaakkant inline |
| Professionele diepte | aliassen, regels, gepland versturen, sjablonen | voltooiproef uitbreiden met alias en plan | staat, onbewezen |
| Levenscyclus | fiscale post blijft 7 jaar; bewaring wint; vernietiging laat een spoor | nieuwe test op bewaarklasse; `test/rtmail-bestuur.test.js` | half |
| Samenwerking en rollen | een team ziet wie oppakt; niemand schrijft anoniem | `test/rtmail-team.test.js` + voltooiproef | test ja, proef nee |
| Domeinintelligentie | elke samenvatting wijst naar haar bericht; phishing nooit onderdrukt | `test/rtmail-ai.test.js` | ja |
| Los functioneren | zonder Werk OS, Geld en AI werkt het postvak volledig | voltooiproef met die apps uit | niet beproefd |
| RTG-ketens | mail naar taak en naar administratie met herkomst | `test/rtmail-werk.test.js` | ja (test) |
| Bewezen betrouwbaarheid | acht bewijzen B; BEVOEGD dicht | centrale meetronde; BEVOEGD 63 routes | 7 van 8 B; 35 routes open |

Dit contract vervangt de acht bewijzen van APPWERKT nooit.

## Twee uitkomsten

**(A) Binnen de huidige architectuur en scope**

| Functie | Kosten | Bouwt op |
|---|---|---|
| Herhaalsleutel op versturen | klein | `server/kern/rtmail-schrijf.js` |
| Quarantainemap voor gezakte stempels | klein | `mailaanname.js`, `rtmail-regels.js` |
| Fiscale bewaarklasse per bericht en waarschuwing bij korte termijn | middel + klein | `rtmail-bewaar.js`, `classificeer`, `kern/fiscaal/zekerheid.js` |
| Zaakkant op de rtmail-modules | middel | `server/routes/rtmail.js`, SCHERMEIGENAAR-oordeel |
| Voltooiproef voor team, SLA en bewaring | klein | `scripts/lib/voltooi/rtmail.js` |
| Later: uit-dienst-overdracht, SLA-vooruitblik, sjabloonantwoorden, eigen domein per zaak | klein tot middel | `bedrijf/uitdienst.js`, `rtmail-sla.js`, `mail-publiek.js` |

**(B) Het domeinmaximum, ook buiten de huidige scope.** Richting, geen toezegging.

| Proces | Stappen | Rollen en organisaties | RTG-apps en eigenaar | Nodig buiten scope |
|---|---|---|---|---|
| Klantenservice van een zaak (omnichannel) | 1 vraag binnen via mail, site, chat of telefoon; 2 één dossier per klant; 3 toewijzen; 4 SLA; 5 antwoord; 6 escalatie naar ticket; 7 tevredenheid zonder ranglijst | klant, frontoffice, specialist, manager | RT Mail (`comm.mail`), Browser (sitebericht), Werk OS `service`/`ticket`, Service (`kantoor.servicewachtrij` voor RTG zelf) | één klantdossier over kanalen heen: besluit over eigenaar (Werk OS `klant/*` of RT Mail-dossier) |
| Geschil en juridisch onderzoek (eDiscovery) | 1 hold op betrokken postvakken; 2 zoeken over postvakken met reden; 3 export met journaal; 4 overdracht aan advocaat; 5 hold opheffen; 6 vernietigen na termijn | manager, jurist (extern), betrokkenen | RT Mail (`zaak.rtmail`), Office (stukken), auditboek (`server/kern/auditboek/`) | zoeken over meerdere postvakken is een nieuwe bevoegdheid: besluit; een advocatenportaal is een externe koppeling |
| Werving per mail | 1 vacature; 2 sollicitatie binnen op leidingsplek; 3 beoordeling; 4 termijn 28 dagen of verlengen met grondslag; 5 aanname; 6 vernietigingsbewijs | sollicitant, manager, vertegenwoordiger | RT Mail leidingsplek, werving (`kern/werk.js`), Loopbaan | de naad aanname naar dienstverband (ARBEID.md par. 3): besluit |
| Zakelijke e-mail met eigen domein voor elke zaak | 1 domein koppelen; 2 SPF/DKIM/DMARC bewijzen; 3 adressen per functie; 4 archief 7 jaar; 5 vertrek met export | zaak, domeinregistrar (extern) | RT Mail, tenantlaag | DNS-beheer en certificaten blijven extern; eigen domein voor leden botst met het codenaamontwerp: besluit |

## Vraagt besluit

1. **Publieke mail naar buiten: standaard uit, zoals nu?**
   - A (aanbevolen): uit per huis, aan per zaak na DNS-bewijs (SPF en DKIM geslaagd). Kosten: middel.
   - B: blijft volledig uit; alleen intern RTG. Kosten: geen; een zaak kan geen klant van buiten mailen.
   - C: aan voor iedereen. Kosten: klein; reputatierisico van het verzenddomein.
2. **Ondergrens bewaartermijn voor zakelijke postvakken.**
   - A (aanbevolen): geen harde ondergrens, wel een bewaarklasse per fiscaal bericht (7 jaar) en een waarschuwing. Kosten: middel.
   - B: harde ondergrens 7 jaar op elk zaakpostvak. Kosten: klein; botst met AVG "niet langer dan nodig" voor niet-fiscale post.
   - C: zoals nu (0 tot 36500 dagen, vrij). Kosten: geen; fiscale post kan verdwijnen.
3. **SLA buiten openingstijden.**
   - A (aanbevolen): de klok leest de openingstijden van de zaak (zaakdata `openingstijden`). Kosten: klein.
   - B: de klok loopt altijd. Kosten: geen; 's nachts staat alles rood.
4. **Eigenaar van het klantdossier over kanalen.**
   - A (aanbevolen): Werk OS `klant/*` is eigenaar; RT Mail-dossier verwijst. Kosten: middel.
   - B: RT Mail-dossier wordt eigenaar. Kosten: middel; tweede klantbegrip naast Werk OS.
