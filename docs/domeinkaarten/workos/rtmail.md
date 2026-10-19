# RT Mail (link:rtmail)

Volledige werkzaamheid: RT Mail doet volledig waarvoor het er is als een lid of een
team een bericht van binnen of van buiten ontvangt, het aan één zichtbare mens
toewijst, het binnen de SLA vanaf een persoonlijk of gedeeld adres beantwoordt met
naam (codenaam "namens" het team), elk verstuurd bericht precies één keer de deur uit
gaat, en de post bewaard blijft volgens de gekozen termijn en een eventuele hold tot
een vernietiging met spoor; toetsbaar als de voltooiproef dat met een tweede lid, een
team en een bewaarbeleid sluit.

Eigenaar: `comm.mail` (SCHERMEIGENAAR.json, doelgroep `lid`, ingang
`/apps/rtmail.html`) en `zaak.rtmail` (doelgroep `zaak`, ingang
`/apps/leverancier-rtmail.html`). Het oordeel over die twee schermen staat open:
klasse "zelfde-component", eigenaar `apps/rtmail.html`, vervolg "De zaakkant heeft
een eigen inline-implementatie; laat die de rtmail-modules gebruiken."
Doelgroepen: lid, zaak (teamadres), kantoor (`rahultravelgroup.rtg`). Herzien op
19 oktober 2026 (avond) na het oordeel "deels": herstel en verdieping staan apart, en
er zijn vier verdiepingsfuncties bijgekomen (opvolgen, vier ogen op uitgaande
teampost, teamoverdracht bij afwezigheid, quarantaine met terugzetten).

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
- Kern (ruim 30 bestanden), o.a.:

| Onderdeel | Wat het doet | Pad |
|---|---|---|
| Adres | `codenaam@<pas>.rtg`; linkerdeel van een LEDENadres is nooit de echte naam; oud adres blijft werken | `server/kern/rtmail-adres.js` |
| Mappen | in, archief, prullenbak; prullenbak is een MAP, geen vernietiging; sluimeren per bericht | `server/kern/rtmail-vak.js` |
| Concept en versturen | bewaren, plannen (`plan`), versturen met handtekening; `losMaken` verstuurt wat gepland stond | `server/kern/rtmail-schrijf.js` |
| Instellingen | handtekening, afwezigheid met vier lus-remmen, maximaal 5 aliassen | `server/kern/rtmail-inst.js` |
| Regels | bij ELKE bezorging: opbergen, weggooien (map), etiket, ster, lezen; doorsturen naar buiten mag NIET | `server/kern/rtmail-regels.js` |
| Teams | gedeeld adres, toewijzen (`pak`), afhandelen (`af`); "het adres is gedeeld, de hand niet"; een ander kan iets dat al opgepakt is niet overnemen; geen ranglijst | `server/kern/rtmail-team.js`, `rtmail-teampost.js` |
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
  `rtmail-zaak.test.js`, `rtmail-ai.test.js`, `rtmail-werk.test.js`,
  `mail-publiek.test.js`, `mail-uitgang.test.js`, `mailauth.test.js`.

**Staat, onbewezen** (niet in de proef gelopen): teams, aliassen, gepland versturen,
regels, publieke mail naar buiten, de zaakkant, bewaring en export.

**Wat de code zelf als niet gebouwd of open opgeeft**

- De zaakkant heeft een eigen inline-implementatie (SCHERMEIGENAAR-oordeel open).
- Publieke mail naar buiten staat uit tot configuratie (`mail-publiek.js`).
- Een spamoordeel is een stempel; er is geen quarantainemap (`mailaanname.js`).

**Open bevindingen (gelezen, niet beproefd, niet gerepareerd)**. Niets van deze kaart
is in de reparatieronde gerepareerd (workos.md par. 9: rtmail staat onder "nog open").

- `server/kern/rtmail-schrijf.js` r. 105-118 `verstuur`: geen herhaalsleutel. Na
  verzending wordt het concept verwijderd; een herhaling na een verbroken antwoord
  krijgt "Dit concept bestaat niet in dit postvak." terwijl het bericht wel weg is.
- `server/kern/rtmail-bewaar.js` r. 55-63 `zetTermijn`: neemt 0 tot 36500 dagen,
  ook op een zakelijk postvak; geen reden-eis boven het recht `bewaarbeleid`.
- Nieuw bij deze herziening: `server/kern/rtmail-team.js` `verlaat` (r. 112) en
  `lidZet` met `erin=false` (r. 93) halen een lid uit het team maar laten
  `team.toegewezen` staan. Wat dat lid had opgepakt blijft "opgepakt door" iemand die
  er niet meer is, en `rtmail-teampost.js` `pak` (r. 47) weigert elke collega met
  "Dit is al opgepakt door een ander." Er is geen weg om het vrij te geven.

## b. Marktvergelijking

Alleen ter vergelijking, nooit als partner. Geraadpleegd 2026-10-19. Elke regel komt
uit een zoeksamenvatting en is **(te controleren)**.

| Leider | Achter de betaalmuur | Wij | Bron |
|---|---|---|---|
| (te controleren) Exchange Online Plan 2 ($8) | mailbox 100 GB, archief tot 1,5 TB, Litigation Hold, DLP | half: juridische bewaring ja, exportjournaal ja; geen DLP, geen archiefniveau | https://www.microsoft.com/en-us/microsoft-365/exchange/compare-microsoft-exchange-online-plans (via zoektool, live te controleren) |
| (te controleren) Google Workspace met Vault (Business Plus, Enterprise) | eDiscovery en holds; 30 dagen na downgrade gaan holds weg | half: hold ja, en hier zonder downgrade-afloop; eDiscovery-zoeken over postvakken heen nee | https://support.google.com/vault/answer/2462365 (via zoektool, live te controleren) |
| (te controleren) Gmail zakelijk | eigen domein, meer opslag, 99,9% | half: eigen domein alleen na configuratie; geen uptime-belofte | https://workspace.google.com/solutions/business-email/ (via zoektool, live te controleren) |
| (te controleren) Proton Mail Business | aantal eigen domeinen per plan (3 / 15 / 20) [oud] | nee: geen eigen domein per zaak in de app | https://proton.me/business/mail/pricing (via zoektool, live te controleren) |
| (te controleren) Mimecast Advanced (offerte) | archief met "perpetual retention" [archieftiers oud] | half: termijn tot 36500 dagen, geen apart archiefniveau | https://www.mimecast.com/products/mimecast-plans/ (via zoektool, live te controleren) |

Wat de markt als betaalde helft verkoopt en hier standaard is: gedeelde inbox met
toewijzen (kop van `rtmail-team.js`), SLA-klok, interne notities. Wat de
gedeelde-inboxmarkt daarnaast verkoopt en hier ontbreekt: opvolgherinneringen,
goedkeuring van uitgaande post en herverdelen bij afwezigheid (geen bron-URL
gecontroleerd; niet gevonden in markt-workos.txt, dus als richting en niet als
marktfeit).

## c. Analyse van het volledige domein

**Particulier.** Post van mensen en instanties, abonnementen, facturen, een
afwezigheidsbericht. Wat telt: alleen wat ertoe doet, phishing herkennen, niets kwijt,
en weten of de ander gereageerd heeft.

**Professioneel.** Een zzp'er heeft één adres naar buiten, offertes en facturen in
de post, en een klok op klantvragen. Een offerte waarop niets terugkomt, moet hij
terugzien zonder zelf een lijst bij te houden.

**Organisatie.** Functieadressen (receptie, boekhouding, werving), toewijzing, SLA,
herverdelen als iemand weg is, vier ogen op wat namens de zaak de deur uit gaat,
bewaarbeleid per soort post, juridische bewaring, export voor een geschil, en
beveiligingsplichten.

Geen van de wetsregels hieronder is in de primaire tekst nagelezen; ze komen uit
domein-max.txt en dragen allemaal **(te controleren)**. Geen ervan wordt in d. of h.
een harde weigerregel; hooguit een signaal of een voorstel dat een mens bevestigt.

| Eis | Bron | Gevolg voor software |
|---|---|---|
| (te controleren) Fiscale bewaarplicht 7 jaar (art. 52 AWR); bij een factuur per mail ook de mail zelf bewaren | https://stichtingenvereniging.belastingdienst.nl/bijzondere-onderwerpen/administratie/de-bewaarplicht/ | een zakelijk postvak heeft een signaal nodig voor post met fiscale waarde; nu kan de termijn op elk getal van 0 tot 36500 dagen zonder melding |
| (te controleren) Spam (art. 11.7 Tw): toestemming vooraf, 5 jaar aantoonbaar; uitzondering bestaande klanten; afmeldmogelijkheid in elk bericht | https://www.acm.nl/nl/verkoop-aan-consumenten/reclame-en-verleiden/spam-voorkomen-uw-reclame | RT Mail kent geen bulk- of nieuwsbriefverzending; komt die er, dan horen toestemming en afmelden bij het verzenden, niet erna |
| (te controleren) AVG art. 5: niet langer dan nodig; sollicitatiepost | https://autoriteitpersoonsgegevens.nl/nl/over-privacy/persoonsgegevens/bewaren-van-persoonsgegevens | bestaat voor werving als huisbesluit (28 dagen, 584A) |
| (te controleren) AVG art. 33: datalek binnen 72 uur | https://autoriteitpersoonsgegevens.nl/nl/onderwerpen/beveiliging/meldplicht-datalekken | een verkeerd geadresseerd bericht met persoonsgegevens is een mogelijk datalek: terug te vinden via het spoor |
| (te controleren) Cyberbeveiligingswet (NIS2) sinds 15-8-2026: melden binnen 24 uur, 72 uur en 1 maand | https://www.ncsc.nl/cyberbeveiligingswet-nis2/meldplicht | voor een zaak die eronder valt is een phishing-incident een mogelijke melding; RT Mail kan de feiten leveren, het melden is extern |
| (te controleren) European Accessibility Act: elektronische communicatie sinds 28-6-2025, EN 301 549 (WCAG 2.1 AA) | https://www.acm.nl/en/accessibility/accessibility-e-commerce-services-and-electronic-communications-services | het postvak zelf moet toegankelijk zijn; `TOEGANKELIJK.md` en de a11y-scan dekken de schermen |

## d. Functiecatalogus L1–L6

De bak "aanbevolen nu" is gesplitst in **herstel** en **verdieping**.

### L1 Persoonlijk

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Versturen met herhaalsleutel | ontbreekt (`rtmail-schrijf.js` r. 105) | concept-id + `idem` | sleutel = hash van postvak en `idem`; een herhaling met dezelfde sleutel geeft het eerder verstuurde bericht terug met `herhaald: true`; dezelfde sleutel met andere inhoud 409 | geen | afzender | eigenaar postvak | gepland versturen (`losMaken`) gebruikt dezelfde weg en sleutel = concept-id | na een verbroken verbinding tik ik opnieuw op versturen en zie "al verstuurd", niet "concept bestaat niet"; de ontvanger heeft één bericht | klein | aanbevolen nu: herstel |
| Opvolgen: "terug als er niets komt" | ontbreekt; sluimeren bestaat per bericht (`rtmail-vak.js`) | verstuurd bericht, draad (`rtmail-draad.js`) | bij versturen kiest de afzender 2, 5 of 10 werkdagen; komt er in die draad geen bericht van de ontvanger, dan staat het verstuurde bericht op die dag bovenaan in "in" met "geen antwoord van <codenaam>"; elk antwoord in de draad heft het op | of een antwoord buiten de draad kwam (nieuw onderwerp) ziet de app niet; het scherm zegt "op deze draad" | afzender op de dag | eigenaar postvak | een automatisch antwoord of afwezigheidsbericht telt niet als antwoord (`bron` niet `lid`) | ik stuur een offerte, kies 5 dagen, en zie hem op dag 5 terug omdat de klant niet reageerde; reageerde hij op dag 3, dan zie ik niets | klein | aanbevolen nu: verdieping |
| Quarantaine voor verdachte post, met terugzetten | ontbreekt; spam is een stempel (`mailaanname.js`) | `controles.spam`, `dmarc` | GEZAKT op spam of DMARC: naar map "verdacht", nooit weggooien; lid ziet de stempels en kan terugzetten; terugzetten van een afzender leert een regel voor die afzender (`rtmail-regels.js`) | stempel kan fout zijn: oordeel met graad `vermoed` | ontvanger in de lijst "verdacht" | eigenaar postvak | interne post (bron lid of systeem) nooit | een phishingmail met gezakte DMARC staat in "verdacht" met de uitleg; een echte factuur zet ik terug en de volgende van die afzender komt in "in" | klein | aanbevolen nu: verdieping |
| Afmelden bij nieuwsbrieven van buiten | ontbreekt | `List-Unsubscribe`-kop van het origineel (`mailinkomend.js` bewaart het origineel) | toon de afmeldweg; nooit zelf klikken | de kop kan vals zijn: alleen tonen bij DMARC geslaagd | ontvanger | eigenaar | links blijven onklikbaar (bestaande regel) | bij een nieuwsbrief zie ik "afmelden" alleen als de afzender klopt | klein | later |
| Ontvangen factuur naar Geld | bestaat (`/api/member/rtmail/documenten`, `classificeer`) | facturatie | de factuurmotor blijft eigenaar | herkenning is `vermoed` | lid | lid | geen | een factuur in de post komt met één tik in mijn administratie | klein | bestaat |

### L2 Professioneel

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Waarschuwing bij korte termijn op zakelijk postvak | ontbreekt (`zetTermijn` neemt 0 tot 36500 zonder melding) | `B().vakken` | een termijn onder 7 jaar op een team- of zaakpostvak vraagt een reden in het journaal (`recht.log`) en toont het signaal "fiscale bewaarplicht, te controleren"; geen weigering | of 7 jaar hier wettelijk geldt: te controleren | wie de termijn zet | recht `bewaarbeleid` | privépostvak: geen waarschuwing | ik zet 365 dagen op de boekhouding, krijg het signaal en moet een reden opgeven die in het journaal staat | klein | aanbevolen nu: herstel |
| Bewaarklasse per bericht (fiscaal) | ontbreekt | `classificeer` (facturatie), dossierkoppeling | een mens deelt een bericht in als "fiscaal"; dan geldt per bericht de termijn die hij kiest (voorstel 7 jaar, klasse `uitlegbaar` uit `kern/fiscaal/zekerheid.js`), los van de postvaktermijn; de langste termijn wint bij het opruimen (`ruimOp`) | de indeling is een voorstel; de wettelijke termijn is te controleren | eigenaar bij indelen | eigenaar postvak, manager bij team | juridische bewaring wint altijd | een als fiscaal ingedeelde factuurmail verdwijnt niet bij het opruimen van een postvak met 1 jaar termijn | middel | aanbevolen nu: verdieping |
| Eigen domein per zaak | half: werkdomeinen in `mail-publiek.js`, alleen na configuratie | DNS, DKIM (`server/dkim.js`) | domein telt pas als SPF en DKIM aantoonbaar kloppen | DNS buiten de app | manager | manager + boardroom | geen eigen domein voor leden (codenaam-ontwerp) | een zaak verstuurt als info@zaak.nl en de ontvanger ziet DKIM geslaagd | middel | later (besluit 1) |
| Sjabloonantwoorden voor teams | ontbreekt | teamadres | vaste antwoorden per team; de afzender staat er altijd bij ("namens") | geen | team | teamleden | geen anoniem antwoord (bestaande regel) | de receptie antwoordt met een sjabloon en de klant ziet wie het stuurde | klein | later |

### L3 Organisatorisch

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Opgepakt werk komt vrij als iemand het team verlaat | ontbreekt: `verlaat` en `lidZet` laten `team.toegewezen` staan | `team.toegewezen`, `team.leden` | bij verlaten of verwijderen gaat elk bericht dat die persoon had opgepakt en niet heeft afgehandeld terug naar "niet opgepakt", met een dossiernotitie "vrijgegeven: <codenaam> verliet het team" | geen | teamleden via SSE; teameigenaar | automatisch bij verlaten; eigenaar bij verwijderen | afgehandelde berichten blijven bij wie ze afhandelde (spoor) | een collega verlaat het team; zijn drie open berichten staan meteen weer open en een ander kan ze oppakken | klein | aanbevolen nu: herstel |
| Teamoverdracht bij afwezigheid | ontbreekt; afwezigheid bestaat per postvak (`rtmail-inst.js`), `pak` weigert overnemen | `team.toegewezen`, afwezigheid van het teamlid | staat een teamlid op afwezig en heeft het opgepakte berichten waarvan de SLA-klok loopt, dan mag elke collega ze overnemen; het dossier krijgt "overgenomen van <codenaam> (afwezig)"; wie terugkomt ziet wat er is overgenomen | geen; de afwezigheid is wat het lid zelf instelde | collega's zodra de klok van zo'n bericht over de helft is; het oude lid bij terugkomst | teamleden; nooit stil: altijd met regel in het dossier | zonder afwezigheid blijft de bestaande regel ("vraag het hem") | ik ben ziek gemeld en zet afwezig; mijn urgente klantvraag wordt door een collega overgenomen en ik zie bij terugkomst wie | klein | aanbevolen nu: verdieping |
| Vier ogen op uitgaande teampost | ontbreekt | concept in het teampostvak, teamrol | een team kan "ter goedkeuring" aanzetten voor antwoorden met een bijlage of voor alle antwoorden; het concept gaat pas weg als een tweede teamlid (niet de schrijver) akkoord geeft; afwijzen geeft het concept terug met opmerking | geen | goedkeurder bij indienen; schrijver bij akkoord of terugsturen | teameigenaar zet de regel; elk ander teamlid keurt | de SLA-klok loopt door tijdens het wachten (eerlijk tegen de klant); een team met één lid kan de regel niet aanzetten | mijn antwoord met offerte gaat pas naar de klant als een collega akkoord gaf; ik kan mijn eigen concept niet goedkeuren | middel | aanbevolen nu: verdieping |
| Teams, toewijzen, afhandelen | bestaat (`rtmail-team.js`), onbewezen | `rtmailTeams` | max. 10 eigen teams per oprichter; geen teller wie het meest afhandelt | geen | teamleden via SSE | teamleden | een team mag geen bestaand postvak kapen (`rtmail-vrij.js`) | twee medewerkers zien hetzelfde bericht; de eerste pakt het op, de tweede ziet "opgepakt door" | klein | voltooiproef uitbreiden: aanbevolen nu: herstel |
| SLA-klok met overschrijding | bestaat (`rtmail-sla.js`), onbewezen | prioriteit, eerste menselijk antwoord | klok stopt niet op `bevestiging` of `afwezig` | geen | team bij overschrijding; blijft zichtbaar | teamleden | buiten openingstijden: niet gemodelleerd (zie Vraagt besluit 3) | een urgent bericht zonder menselijk antwoord na 30 minuten staat rood, ook na een automatische bevestiging | klein | proef: aanbevolen nu: herstel |
| Juridische bewaring en export | bestaat (`rtmail-bewaar.js`, `rtmail-recht.js`), onbewezen | postvakbeleid, journaal | bewaring wint van termijn; export vraagt recht en reden en komt in het journaal | geen | journaal; betrokkene bij leidingsplek | recht vernietigen / exporteren | leidingsplek: eigen hold met vier ogen | een hold op een postvak laat het opruimen niets weggooien; de export staat in het journaal met reden | klein | proef: aanbevolen nu: herstel |
| Zaakkant op de rtmail-modules | open (SCHERMEIGENAAR) | `routes/rtmail.js` | één implementatie, twee sessies | geen | n.v.t. | zaakrollen | beperkte post (werving) alleen voor de manager | het zaakscherm gebruikt dezelfde modules; een test vergelijkt beide | middel | aanbevolen nu: herstel |
| Doorsturen naar buiten | bewust niet (`rtmail-regels.js`) | n.v.t. | lek- en lusrisico | n.v.t. | n.v.t. | n.v.t. | team is de zichtbare vervanger | n.v.t. | n.v.t. | niet doen: kortste weg naar een gekaapt postvak |

### L4 Domeinintelligentie

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Samenvatten met herkomst | bestaat (`rtmail-ai.js`) | draad | elke bewering met bericht-id; werkt zonder model | graad `vermoed` | lezer | lezer | AI doet nooit: betalen, accepteren, versturen, verwijderen | elke zin in de samenvatting springt naar zijn bericht | klein | bestaat |
| Phishinguitleg | bestaat | links, stempels | een waarschuwing wordt nooit onderdrukt | `vermoed` | lezer | lezer | geen | een nep-bankmail krijgt de uitleg welke link waarheen gaat | klein | bestaat |
| SLA-vooruitblik per team | ontbreekt | open dossiers, normen | aantal dat binnen een uur over de norm gaat, als telling; nooit per medewerker | het is een voorspelling, klasse `advies`; geen getal waar er geen is | team | teamleden | geen | de receptie ziet "3 berichten gaan binnen een uur over de norm" | klein | later |
| Herkennen van fiscale post | half (`classificeer`) | inhoud, bijlagen | voorstel, mens bevestigt | `vermoed` | eigenaar | eigenaar | geen | een factuurmail krijgt het voorstel "fiscaal, termijn kiezen" | klein | later |

### L5 Volledige levenscyclus

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Adres volgt de pas | bestaat (`rtmail-adres.js`) | lidmaatschap | oud adres blijft werken | geen | lid | n.v.t. | geen | na een paswissel komt post op het oude adres nog aan | klein | bestaat |
| Uit dienst: postvak overdragen | ontbreekt | `bedrijf/uitdienst.js`, teamlidmaatschap | teamlidmaatschap vervalt (met vrijgeven, zie L3); persoonlijk werkpostvak gaat met afwezigheidsbericht naar de manager; privépost van het lid blijft van het lid | wat werkpost is: alleen `rahultravelgroup.rtg` of werkdomein | manager | manager | leidingsplek: eigen termijn | na uitdiensttreding staat er een afwezigheidsbericht met het teamadres | middel | later |
| Opzeggen lidmaatschap: export | half: export met reden (`rtmail-bewaar.js`) | postvak | lid exporteert zijn eigen post zonder reden-eis van derden | geen | lid | lid | hold: export mag, vernietigen niet | ik neem bij vertrek al mijn post mee als bestand | klein | later |

### L6 RTG-samenhang

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Mail naar Werk OS-taak | bestaat (`server/bedrijf/postbrug.js`) | bericht | herkomst `rtg://`, twee sleutels, dezelfde persoon | geen | maker taak | eigenaar postvak + werkruimtelid | geen | een klantmail wordt een taak die terugwijst naar de mail | klein | bestaat |
| Mail naar project | bestaat (`workflow`, RTG One `project/van-mail`) | bericht | eigenaar project blijft Project Room of Werk OS | geen | maker | lid | geen | idem | klein | bestaat |
| Automatiseringen bezorgen in het zaakpostvak | bestaat (`server/kern/automatisering.js`) | sollicitatie, inkoop, btw | bron `systeem` | geen | zaak | zaak | systeempost stopt de SLA-klok nooit | n.v.t. | klein | bestaat |
| Bijlage naar Office | ontbreekt | `mailbijlage.js` | wordt document met herkomst | formaat | eigenaar | eigenaar | bijlage van buiten nooit automatisch | zie Office-kaart | middel | later (eigenaar Office) |
| Sitesollicitatie op de leidingsplek | ontbreekt (Browser-kaart) | sitebericht soort `sollicitatie` | landt op de leidingsplek met de bestaande 28 dagen | geen | manager | manager | geen | zie Browser-kaart | klein | herstel bij Browser |

### Modus LOS

Kerntaak: post lezen, schrijven, versturen, ordenen en als team afhandelen binnen RTG.
Per groep wat er gebeurt als iets ontbreekt, met de letterlijke schermtekst (u-vorm).

**Eigen (RT Mail bezit het en kan het altijd)**: postvak, mappen, concepten, regels,
teams met toewijzen en afhandelen, SLA-klok, bewaarbeleid en hold, de lokale
AI-opdrachten.

| Wat ontbreekt | Schermtekst |
|---|---|
| een concept zonder ontvanger | "Aan wie moet dit bericht? Het concept is bewaard." |
| een bericht dat een ander al oppakte | "Dit is al opgepakt door <codenaam>; vraag het hem, of neem het over als hij afwezig is." |
| de AI zonder model | "Samenvatten en actiepunten werken hier zonder taalmodel; elke zin wijst naar zijn bericht." |

**Noodzakelijke platformdiensten** (account en sessie, identiteitskluis voor de
codenaam in het adres, opslag, SSE, mailpoort en wachtrij voor post van en naar
buiten):

| Wat ontbreekt | Schermtekst |
|---|---|
| sessie verlopen of geen account | "Log opnieuw in om uw post te lezen; zonder account heeft u geen postvak." |
| opslag schrijft niet bij versturen | "Versturen is niet bevestigd; kijk in Verzonden voor u het opnieuw probeert." (tot de herhaalsleutel er is; daarna: "Al verstuurd.") |
| SSE weg (team) | "U ziet nieuwe teampost pas na verversen; wie iets oppakt, blijft vastgelegd." |
| mailpoort zonder geheim of publieke mail niet geconfigureerd | "Post naar buiten staat voor dit huis uit; binnen RTG werkt alles." |
| wachtrij geeft op (dead-letter) | "Dit bericht kwam na vijf pogingen niet aan bij <adres>: <foutmelding>. Het staat in de lade 'niet afgeleverd'." |

**Optionele koppelingen** (Werk OS, Geld, Project Room, Office):

| Wat ontbreekt | Schermtekst |
|---|---|
| Werk OS uit | "Een taak maken kan nu niet; het bericht, het dossier en de klok lopen gewoon door." |
| Geld uit | "Naar uw administratie kan nu niet; de factuur blijft hier staan." |
| Project Room uit | "Aan een project koppelen kan nu niet; er is niets half gekoppeld." |

### Modus SAMEN: klantvraag bij een zaak, van binnenkomst tot bewaren

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
   - Storing: A verlaat het team voordat hij antwoordt. Gevolg nu: het bericht blijft
     "opgepakt door A" en niemand kan het oppakken (bevinding in a.). Gewenst
     (herstel L3): het komt vrij met een dossiernotitie.
6. A zet het via de postbrug om naar een Werk OS-taak en koppelt de klant in het dossier.
   - Storing: Werk OS uit. Gevolg: de knop zegt "niet beschikbaar"; dossier en
     klok lopen door.
7. A schrijft een antwoord met offerte; het team heeft vier ogen aan (verdieping L3);
   B keurt goed.
   - Storing: B is ook afwezig. Gevolg: het concept wacht, de klok loopt en kleurt
     rood; de teameigenaar ziet "wacht op goedkeuring".
8. A verstuurt vanaf het teamadres; de klant ziet "<codenaam> namens de receptie".
   - Storing: het antwoord op versturen komt niet aan bij A's toestel. Gevolg nu: bij
     opnieuw tikken "Dit concept bestaat niet in dit postvak." terwijl het bericht weg
     is. Gewenst (herstel L1): "Al verstuurd."
   - Storing: de ontvangende server geeft een tijdelijke fout. Gevolg: wachtrij
     herprobeert (1, 5, 15, 60, 240 min); daarna dead-letter met de foutmelding,
     zichtbaar voor het team.
9. A zet opvolgen op 5 dagen (verdieping L1); de klant reageert niet; op dag 5 staat
   het bericht bovenaan bij A.
10. De klant stuurt een factuur; A deelt in als factuur; Geld neemt over. A deelt het
    bericht ook in als fiscaal en kiest 7 jaar (verdieping L2).

### Modus SAMEN als contractblok (VOORSTEL)

Voorstel; `scripts/lib/appcontract.js` blijft ongewijzigd.

```js
samen: {
  functie: 'link:rtmail', familie: 'WorkOS',
  belofte: 'een lid of team ontvangt een bericht, een mens pakt het zichtbaar op en antwoordt met naam; elk verstuurd bericht gaat precies een keer de deur uit, andermans post is niet te lezen, en bewaarbeleid en hold bepalen wanneer iets verdwijnt',
  ingang: '/apps/rtmail.html',
  bestanden: ['public/apps/rtmail.html'],
  scenario: 'scripts/lib/voltooi/rtmail.js',
  ketens: [
    { naam: 'mail wordt taak', uitgeeft: 'comm.mail', ontvangt: 'werk.organisatie',
      vorm: 'verwijzing', eigenaar: 'werk.organisatie',
      toestemming: 'eigenaar postvak en lid van de werkruimte, dezelfde persoon (server/bedrijf/postbrug.js)',
      storingen: ['Werk OS uit: knop "niet beschikbaar", bericht onaangeroerd', 'dubbele tik: een taak'],
      proef: 'test/rtmail-werk.test.js (test, geen voltooiproef)' },
    { naam: 'factuur naar administratie', uitgeeft: 'comm.mail', ontvangt: 'geld.overzicht',
      vorm: 'gebeurtenis', eigenaar: 'geld.overzicht',
      toestemming: 'het lid zelf, per bericht (/api/member/rtmail/classificeer)',
      storingen: ['Geld uit: factuur blijft in de post', 'herkenning fout: mens bevestigt, niets automatisch'],
      proef: 'ontbreekt' },
    { naam: 'teampost van de zaak', uitgeeft: 'comm.mail', ontvangt: 'zaak.rtmail',
      vorm: 'projectie', eigenaar: 'comm.mail',
      toestemming: 'zaakrollen; beperkte post (werving) alleen manager',
      storingen: ['zaakkant inline: twee implementaties lopen uiteen (SCHERMEIGENAAR-oordeel open)'],
      proef: 'test/rtmail-zaak.test.js (test); voltooiproef ontbreekt' },
    { naam: 'sitesollicitatie op de leidingsplek', uitgeeft: 'web.browser', ontvangt: 'zaak.rtmail',
      vorm: 'gebeurtenis', eigenaar: 'zaak.rtmail',
      toestemming: 'alleen de manager; termijn 28 dagen (besluit 584A)',
      storingen: ['leidingsplek niet ingericht: bericht wordt geweigerd met uitleg, niet als klus opgeslagen'],
      proef: 'ontbreekt (functie nog niet gebouwd)' }
  ]
}
```

## e. RTG-exclusieve mogelijkheden

| Mogelijkheid | Eigenaar | Capability | Waarom geen markt-app dit kan |
|---|---|---|---|
| Postvak op codenaam: een adres dat rondreist lekt geen echte naam | `comm.mail` | `rtmail-adres.js` + kluis | markt-mail is gebouwd op echte namen of vrije aliassen |
| Mail wordt werk zonder kopie: taak, project, administratie met herkomst | `comm.mail` + Werk OS + Geld | `postbrug.js`, `herkomst.js` | markt-koppelingen kopiëren de mail naar een ander systeem |
| Gedeeld adres waarop een mens altijd zichtbaar is, ook bij overname en goedkeuring | `comm.mail` | `rtmail-team.js`, `rtmail-dossier.js` | markt-inboxen staan anoniem antwoorden vanaf een functieadres toe |
| Hold met vier ogen op gekeurde identiteit | `zaak.rtmail` | `rtmail-leidinghold.js` | markt-holds vragen een beheerdersrol, geen gekeurde tweede persoon |
| Opvolgen dat een automatisch antwoord niet als antwoord telt | `comm.mail` | `bron` per bericht (`lid`, `systeem`) | markt-mail weet niet wie of wat een antwoord schreef |

## f. Bouwstenen en ontbrekende koppelingen

**Bestaande modules**: alle `server/kern/rtmail-*.js` en `mail*.js`, `server/dkim.js`,
`server/bedrijf/postbrug.js`, `server/kern/automatisering.js`, facturatie via
`/api/member/rtmail/classificeer`, `server/kern/fiscaal/zekerheid.js`.

| Van | Naar | Vorm | Toestemming |
|---|---|---|---|
| `verstuur` | herhaalsleutel | regel in `rtmail-schrijf.js` | eigenaar postvak |
| `verlaat` / `lidZet` | `team.toegewezen` vrijgeven | regel in `rtmail-team.js` | automatisch, met dossiernotitie |
| afwezigheid (`rtmail-inst.js`) | overnemen in `pak` | regel in `rtmail-teampost.js` | teamleden |
| `classificeer` (factuur) | bewaarklasse per bericht | regel in `rtmail-bewaar.js` | eigenaar postvak |
| `mailaanname.js` stempel | map "verdacht" | regel bij bezorging (`rtmail-regels.js`-haak) | geen extra |
| `bedrijf/uitdienst.js` | teamlidmaatschap en afwezigheid | gebeurtenis | manager |
| zaakscherm | rtmail-modules | zelfde component | zaakrollen |
| `mailbijlage.js` | Office | gebeurtenis met herkomst | eigenaar |

## g. Prioritering

**HERSTEL**

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Herhaalsleutel op versturen | klein | laag | `rtmail-schrijf.js` | aanbevolen nu |
| Opgepakt werk vrij bij verlaten of verwijderen | klein | laag | `rtmail-team.js` | aanbevolen nu |
| Reden en signaal bij korte termijn op zakelijk postvak | klein | laag | `rtmail-bewaar.js` | aanbevolen nu |
| Zaakkant op de rtmail-modules | middel | middel | SCHERMEIGENAAR-oordeel | aanbevolen nu |
| Voltooiproef uitbreiden: team, SLA, bewaring, hold | klein | laag | `scripts/lib/voltooi/rtmail.js` | aanbevolen nu |

**VERDIEPING**

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Opvolgen ("terug als er niets komt") | klein | laag | `rtmail-draad.js`, sluimeren | aanbevolen nu |
| Teamoverdracht bij afwezigheid | klein | laag | `rtmail-teampost.js`, `rtmail-inst.js` | aanbevolen nu |
| Vier ogen op uitgaande teampost | middel | middel | concepten, teams | aanbevolen nu |
| Quarantainemap "verdacht" met terugzetten | klein | laag | `mailaanname.js`, `rtmail-regels.js` | aanbevolen nu |
| Bewaarklasse per bericht (fiscaal, mens kiest) | middel | middel | facturatie, `rtmail-bewaar.js` | aanbevolen nu |

**Later en niet doen**

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Eigen domein per zaak | middel | middel | besluit, DNS | later |
| Uit dienst: postvak overdragen | middel | middel | `bedrijf/uitdienst.js` | later |
| SLA-vooruitblik | klein | laag | `rtmail-sla.js` | later |
| Sjabloonantwoorden | klein | laag | teams | later |
| Nieuwsbrief/bulkverzending | middel | middel | toestemmingsregister (art. 11.7 Tw, te controleren) | niet doen nu: nieuw domein, spamrisico |
| Doorsturen naar buiten | klein | laag | n.v.t. | niet doen (lek en lus) |

## h. Toetsbaar eindcontract Beyond Premium

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| Breedte | lid, team, zaak en kantoor gebruiken één implementatie | test die zaakscherm en lidscherm op dezelfde modules legt | nee: zaakkant inline |
| Professionele diepte | aliassen, regels, gepland versturen, opvolgen, sjablonen | voltooiproef uitbreiden met alias, plan en opvolgen | staat, onbewezen; opvolgen ontbreekt |
| Levenscyclus | post met een gekozen bewaarklasse blijft tot het einde van die klasse; bewaring wint; vernietiging laat een spoor; een korte termijn op een zakelijk postvak staat met reden in het journaal | nieuwe test op bewaarklasse en reden; `test/rtmail-bestuur.test.js` | half |
| Samenwerking en rollen | een team ziet wie oppakt; niemand schrijft anoniem; niets blijft vastzitten bij iemand die weg is; vier ogen werken | `test/rtmail-team.test.js` + nieuwe test op verlaten en overname + voltooiproef | test ja, vrijgeven nee, proef nee |
| Domeinintelligentie | elke samenvatting wijst naar haar bericht; phishing nooit onderdrukt; een quarantaine-oordeel draagt `vermoed` | `test/rtmail-ai.test.js` | ja (quarantaine ontbreekt) |
| Los functioneren | zonder Werk OS, Geld en AI werkt het postvak volledig, met de schermteksten uit Modus LOS | voltooiproef met die apps uit | niet beproefd |
| RTG-ketens | mail naar taak en naar administratie met herkomst | `test/rtmail-werk.test.js` | ja (test) |
| Bewezen betrouwbaarheid | acht bewijzen B; BEVOEGD dicht; versturen idempotent | centrale meetronde; BEVOEGD 63 routes; herhaaltoets op versturen | 7 van 8 B; 35 routes open; versturen niet idempotent |

Dit contract vervangt de acht bewijzen van APPWERKT nooit.

## Twee uitkomsten

**(A) Binnen de huidige architectuur en scope**

HERSTEL (niets gerepareerd in de reparatieronde; alles open)

| Functie | Kosten | Bouwt op |
|---|---|---|
| Herhaalsleutel op versturen | klein | `server/kern/rtmail-schrijf.js` |
| Opgepakt werk vrij bij verlaten of verwijderen | klein | `server/kern/rtmail-team.js` |
| Reden en signaal bij korte termijn op zakelijk postvak | klein | `server/kern/rtmail-bewaar.js` |
| Zaakkant op de rtmail-modules | middel | `server/routes/rtmail.js`, SCHERMEIGENAAR-oordeel |
| Voltooiproef voor team, SLA en bewaring | klein | `scripts/lib/voltooi/rtmail.js` |

VERDIEPING

| Functie | Kosten | Bouwt op |
|---|---|---|
| Opvolgen | klein | `server/kern/rtmail-draad.js`, sluimeren in `rtmail-vak.js` |
| Teamoverdracht bij afwezigheid | klein | `rtmail-teampost.js`, `rtmail-inst.js`, `rtmail-dossier.js` |
| Vier ogen op uitgaande teampost | middel | concepten (`rtmail-schrijf.js`), `rtmail-team.js` |
| Quarantainemap met terugzetten | klein | `mailaanname.js`, `rtmail-regels.js` |
| Bewaarklasse per bericht | middel | `rtmail-bewaar.js`, `classificeer`, `kern/fiscaal/zekerheid.js` |

LATER: uit-dienst-overdracht, SLA-vooruitblik, sjabloonantwoorden, eigen domein per
zaak (klein tot middel; `bedrijf/uitdienst.js`, `rtmail-sla.js`, `mail-publiek.js`).

**(B) Het domeinmaximum, ook buiten de huidige scope.** Richting, geen toezegging.

| Proces | Stappen | Rollen en organisaties | RTG-apps en eigenaar | Nodig buiten scope |
|---|---|---|---|---|
| Klantenservice van een zaak (omnichannel) | 1 vraag binnen via mail, site, chat of telefoon; 2 één dossier per klant; 3 toewijzen; 4 SLA; 5 antwoord; 6 escalatie naar ticket; 7 tevredenheid zonder ranglijst | klant, frontoffice, specialist, manager | RT Mail (`comm.mail`), Browser (sitebericht), Werk OS `service`/`ticket`, Service (`kantoor.servicewachtrij` voor RTG zelf) | één klantdossier over kanalen heen: besluit over eigenaar (Werk OS `klant/*` of RT Mail-dossier) |
| Geschil en juridisch onderzoek (eDiscovery) | 1 hold op betrokken postvakken; 2 zoeken over postvakken met reden; 3 export met journaal; 4 overdracht aan advocaat; 5 hold opheffen; 6 vernietigen na termijn | manager, jurist (extern), betrokkenen | RT Mail (`zaak.rtmail`), Office (stukken), auditboek (`server/kern/auditboek/`) | zoeken over meerdere postvakken is een nieuwe bevoegdheid: besluit; een advocatenportaal is een externe koppeling |
| Werving per mail | 1 vacature; 2 sollicitatie binnen op leidingsplek; 3 beoordeling; 4 termijn 28 dagen of verlengen met grondslag; 5 aanname; 6 vernietigingsbewijs | sollicitant, manager, vertegenwoordiger | RT Mail leidingsplek, werving (`kern/werk.js`), Loopbaan | de naad aanname naar dienstverband (ARBEID.md par. 3): besluit |
| Zakelijke e-mail met eigen domein voor elke zaak | 1 domein koppelen; 2 SPF/DKIM/DMARC bewijzen; 3 adressen per functie; 4 archief volgens gekozen termijn; 5 vertrek met export | zaak, domeinregistrar (extern) | RT Mail, tenantlaag | DNS-beheer en certificaten blijven extern; eigen domein voor leden botst met het codenaamontwerp: besluit |

## Vraagt besluit

1. **Publieke mail naar buiten: standaard uit, zoals nu?**
   - A (aanbevolen): uit per huis, aan per zaak na DNS-bewijs (SPF en DKIM geslaagd). Kosten: middel.
   - B: blijft volledig uit; alleen intern RTG. Kosten: geen; een zaak kan geen klant van buiten mailen.
   - C: aan voor iedereen. Kosten: klein; reputatierisico van het verzenddomein.
2. **Ondergrens bewaartermijn voor zakelijke postvakken.**
   - A (aanbevolen): geen harde ondergrens; een signaal "te controleren" plus een verplichte reden bij een korte termijn, en een bewaarklasse per bericht die een mens kiest. Kosten: middel.
   - B: harde ondergrens 7 jaar op elk zaakpostvak. Kosten: klein; rust op een wetsregel die nog te controleren is, en botst met "niet langer dan nodig" voor niet-fiscale post.
   - C: zoals nu (0 tot 36500 dagen, vrij, zonder reden). Kosten: geen; fiscale post kan zonder spoor van een keuze verdwijnen.
3. **SLA buiten openingstijden.**
   - A (aanbevolen): de klok leest de openingstijden van de zaak (zaakdata `openingstijden`). Kosten: klein.
   - B: de klok loopt altijd. Kosten: geen; 's nachts staat alles rood.
4. **Eigenaar van het klantdossier over kanalen.**
   - A (aanbevolen): Werk OS `klant/*` is eigenaar; RT Mail-dossier verwijst. Kosten: middel.
   - B: RT Mail-dossier wordt eigenaar. Kosten: middel; tweede klantbegrip naast Werk OS.
5. **Overnemen bij afwezigheid: vrij of met goedkeuring?**
   - A (aanbevolen): vrij voor elk teamlid zodra de ander op afwezig staat, altijd met dossierregel. Kosten: klein.
   - B: alleen de teameigenaar mag herverdelen. Kosten: klein; bij een afwezige eigenaar staat alles stil.
   - C: zoals nu, nooit overnemen. Kosten: geen; een zieke medewerker houdt klantvragen vast.
