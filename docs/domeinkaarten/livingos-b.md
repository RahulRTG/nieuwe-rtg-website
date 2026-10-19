# Premiumdomeinkaarten — LivingOS-B

**Stand:** 19 oktober 2026, gemeten op `appwerkt/living-b` (vanaf c038c1bd1).
**Opdracht:** Beyond Premium, met de bijstelling, de aanscherping en de drie aanvullingen van de eigenaar van die dag.
**Status:** dit is een kaart, geen bouwopdracht. Er is niets gebouwd. Een functie wordt pas werk als de eigenaar haar per familie toezegt.

## Waarom dit stuk er is

De eigenaar wil weten hoe ver elke app van het volledige werkgebied af staat. Dat werkgebied loopt van particulier tot professioneel en organisatorisch gebruik. De vergelijking gaat dus niet alleen over de beste bestaande app.

Per app staan hier:
- wat bewezen bestaat;
- wat de markt vraagt, ook in de duurste pakketten;
- hoe de mensen in het vak werken;
- wat RTG kan door bestaande apps te verbinden.

Elke functie is bouwbaar beschreven: gegevens en bron, regels, rekenwijze, onzekerheid, melding, rollen, toestemming, uitzonderingen en acceptatiecriterium. Elke app heeft twee uitkomsten:
- **A:** binnen de huidige architectuur;
- **B:** het domeinmaximum, ook buiten de huidige scope.

Per app sluit een toetsbaar eindcontract over acht dimensies af. Dat contract vervangt de acht APPWERKT-bewijzen nooit.

## Verdeling (afgestemd met LivingOS-A en Geld; Centraal besliste)

LivingOS-B heeft 25 apps:

| Familie | Apps |
|---|---|
| Media | muziek (met Klankwerk), clips, mediaos, tweedescherm |
| Sociaal | sociaal (met de Discussiekamer als verdieping), tab:salon, os:snaps, pulse, wereldlaag |
| Spel, sport en bellen | spelen, sport, os:rtf, os:videobellen |
| Lezen, overzicht, ontmoeten | nieuws, ontdek, rendezvous, rechterhand |
| Handel | commerce, mall, mijnmall, foodcourt |
| Uitgaan en kring | table, uitgaan, attenties, cercle |

Camera, spelavond, krant en logboek horen bij LivingOS-A. De geldapps horen bij Geld. Bellen en videobellen delen één signaleringsroute: LivingOS-A beschrijft de spraak, deze kaart de media. Een dubbel genoemde app gaat naar wie het voltooiscenario registreerde.

## Huisbrede bevindingen

1. **De registers lopen achter op de scenario's.**
   - `APPWERKT.json` is de nulmeting (af81b538). `VOLTOOIPROEF.json` kent de scenario's van 19 oktober nog niet.
   - Per bewijs staat daarom in de kaarten wat het register zegt en wat lokaal sluit.
   - Bewijs worden de lokale uitslagen pas na de centrale meetronde.
2. **Bevoegd is bij vrijwel elke app NIET_GETEST.**
   - De voltooiproeven laten wel zien dat een ander lid niets ziet. De bevoegdronde meet het niet.
   - Een paar routes zijn in IDOR.json onbereikbaar, onder meer `/api/event/rsvp` en `/annuleer` (Uitgaan) en `/api/sociaal/lijn` en `/wereld` (Overzicht).
3. **Moderatie zonder kantoorkant.**
   - De Salon en Pulse verbergen een post na drie meldingen. Er is geen kantoorroute die die meldingen leest, terugzet of motiveert.
   - `/api/member/report` slaat meldingen op, en niets leest ze.
   - Dat botst met de meld-, motiverings- en bezwaarplicht voor platforms. Zie de kaart van Sociaal.
   - Het concrete voorstel aan de eigenaar staat hieronder, in "Voorstel aan de eigenaar: één moderatiedienst met een kantoorkant".
4. **Gezondheidsgegevens van derden.** Table bewaarde het dieet van een gast onbeperkt in vrije tekst. Een allergie is een bijzonder persoonsgegeven, van iemand die zelf niet instemde. **Gerepareerd op 19 oktober (d806269d4):** de veertien allergenen van bijlage II als keuzelijst, wissen in de opslag de dag na de gelegenheid (zonder datum na 30 dagen), en de maître krijgt alleen aantallen zonder namen. Entourage bewaarde het dieet van reisgenoten op dezelfde manier; **gerepareerd in a5bc914f6** (EU-lijst, een jaar na de laatste bevestiging, alleen het lid).
5. **Snaps voor kinderen.** Dit ligt als besluit bij de eigenaar (opties A/B/C in het bericht van 19 oktober).
   - Op de gezinsroute hebben snaps en verhalen geen leeftijdsgrens. Ze gaan alleen naar door een ouder goedgekeurde vrienden, en na bekijken is de foto weg.
6. **Herroepingsrecht.** De retourgrond "bedenktijd" bestaat, maar de wettelijke termijn van 14 dagen na levering wordt nergens gerekend.
7. **Dynamische paden.** Attenties en Cercle bouwen hun API-paden nog dynamisch op. De meting ziet hun routes daardoor niet. Table (d806269d4) en Entourage (a5bc914f6) staan nu voluit.
8. **Een fout op het scherm.** De liegronde zag op Rendez-vous de kale tekst "undefined" bij een leeg antwoord. **Gerepareerd op 19 oktober (c5d6e935e):** het scherm zegt nu dat het antwoord onvolledig was.

## Bronnen

- **Marktprijzen:** komen waar mogelijk van de eigen prijspagina van de aanbieder. Waar die niet op te halen was, staat de bron van derden erbij als zodanig. Wat niet te controleren was, staat er niet als feit. Peildatum: 19 oktober 2026.
- **Echte bedrijven en organisaties:** staan er alleen als marktreferentie of als bron. Dat geldt ook voor de collectieve rechtenorganisaties, de wetgeving en de brancheorganisaties. Ze staan er nooit als partner.

## Besluiten die deze kaarten vragen

- Eén winkelingang: is Commerce de verkoperskant of een stand van de Mall? Dat is oordeel 29 in `SCHERMEIGENAAR.json`.
- Nieuws en Krant: één leesapp of twee?
- Wie is eigenaar van "de dag": Overzicht of Vandaag?
- Pulse naast De Salon.
- Snaps een eigen eigenaar in `SCHERMEIGENAAR.json`.
- Een genre voor menselijke matchmaking en een voor huispersoneel.
- De bewaartermijn na opzeggen bij Rendez-vous.
- Responstijd en 24/7-bezetting voor het kantoor.
- Snaps voor kinderen.
- Eén moderatiedienst met een kantoorkant (voorstel A, B of C hieronder).

## Voorstel aan de eigenaar: één moderatiedienst met een kantoorkant

*Gevraagd door de integrator op 19 oktober 2026 (bevinding 3). Dit is een nieuwe kantoorfunctie, dus een besluit van de eigenaar. Er is nog niets van gebouwd.*

### Wat er nu is (gemeten op d806269d4)

| Bron | Wat een melding doet | Waar het staat | Wie het leest |
|---|---|---|---|
| De Salon (`kern/salon/reacties.js`) | drie verschillende melders zetten `p.weg = true` | `post.meldingen` (key, reden, at) | niemand; de commentaarregel zegt "tot het kantoor kijkt" |
| Pulse (`kern/pulse/index.js`) | drie unieke melders zetten `post.verborgen = true` | `post.melders` (per key: reden, at) | niemand |
| Markt (`kern/markt/toezicht.js`) | drie melders: `verborgen` | `ad.melders`, `ad.meldRedenen` | niemand |
| Een persoon melden (`/api/member/report`, `kern/sociaal.js` `meldMisbruik`) | niets zichtbaars | `sociaal.reports` (laatste 5000; bewaartermijn 2 jaar in `bewaarbeleid-operationeel.js`) | niemand |
| Rendez-vous en Vonk | veiligheidsmeldingen | eigen opslag | het kantoor, als **leeslijst** (`/api/office/rendezvous/meldingen`, `/api/office/vonk/meldingen`); er hoort geen besluit bij |

Drie dingen ontbreken overal:
- iemand die beslist;
- een motivering aan de maker;
- een weg om bezwaar te maken.

Daarnaast blijft een post die drie mensen samen wegmelden voor altijd weg. Dat is meteen een middel om iemand het zwijgen op te leggen.

### Wat de wet vraagt (te toetsen door een jurist; menselijke beoordeling)

- **DSA art. 16:** een meldmechanisme met een bevestiging aan de melder. Het mechanisme bestaat; de bevestiging ontbreekt.
- **DSA art. 17:** een motivering aan de maker bij elke beperking. Dat geldt ook voor verbergen.
- **DSA art. 20:** een intern klachtensysteem van ten minste zes maanden na het besluit, besloten door mensen.
  - Art. 19 zondert micro- en kleine ondernemingen uit van art. 20 en verder, maar niet van art. 16 en 17.
  - Of RTG onder die uitzondering valt, is niet vastgesteld. Het voorstel bouwt art. 20 toch, omdat hij weinig kost en de huisregel "een mens beslist" er al om vraagt.

### Het voorstel

**Eén kern, `server/kern/moderatie/`, met een adapter per bron.** Elke bron houdt zijn eigen opslag en zijn eigen drempel. De adapter geeft vijf dingen:
- `gemeld()`: wat er in de wachtrij hoort;
- `herstel(id)`;
- `houdVerborgen(id)`;
- `verwijder(id)`;
- `maker(id)`: de codenaam van de maker, nooit een echte naam.

Er komt dus geen tweede kopie van de posts. Het oordeel Pulse naast De Salon (zie de besluitenlijst) hoeft hiervoor niet eerst genomen te worden: één wachtrij, twee adapters.

**Besluiten** komen in één eigen collectie `moderatiebesluiten`, met:
- bron, id, maker-codenaam;
- het besluit en de motivering;
- de huisregel waarop het besluit steunt;
- wie besloot (naam via `naamAuth`), wanneer;
- de tweede handtekening;
- het bezwaar.

| # | Functie | Regel | Acceptatie |
|---|---|---|---|
| MO1 | Wachtrij voor het kantoor | Erin komt: een post die verborgen raakte, of één melding met de reden "onveilig" (kind, geweld, dreiging). Zo'n melding gaat bovenaan en verbergt meteen. Termijn: 72 uur na de eerste melding, daarna rood. Op codenaam. | Drie leden melden een Salon-post; hij staat in `/api/office/moderatie/wachtrij` met de redenen en de termijn. |
| MO2 | Besluit met motivering | Een kantoormens op naam (werkrol kantoor, capability `moderatie.besluit`) kiest **terugzetten**, **verborgen houden** of **verwijderen**, met een verplichte motivering en een huisregel uit een vaste lijst. **Verwijderen** en **schorsen** vragen een tweede kantoormens; de eerste kan niet zelf tekenen (403). | Terugzetten zet de post terug in de feed. Verwijderen zonder tweede handtekening blijft "wacht op tweede". Dezelfde persoon tweemaal geeft 403. |
| MO3 | Bericht aan de maker | Bij verbergen meteen: "Uw bericht is verborgen na meldingen; een medewerker beslist binnen 3 dagen." Na het besluit: de uitkomst, de motivering en de huisregel, plus hoe bezwaar werkt. Melders worden nooit genoemd. | De maker leest in `/api/member/moderatie/mijn` de motivering, zonder codenamen van melders. |
| MO4 | Bevestiging aan de melder | Bij melden: "ontvangen". Na het besluit: "afgehandeld". Het besluit over een ander krijgt de melder niet te zien. | De melder ziet twee regels en geen besluit. |
| MO5 | Bezwaar | De maker maakt binnen 6 maanden één keer bezwaar, zonder kosten. Een **ander** kantoormens beslist; wie het eerste besluit nam, krijgt 403. Elk bezwaarbesluit draagt een nieuwe motivering. | Het bezwaar staat bij een tweede medewerker; de eerste wordt geweigerd; de maker leest de uitkomst. |
| MO6 | Personen melden leesbaar maken | `sociaal.reports` komt als bron "persoon" in dezelfde wachtrij, en wordt pas een besluit als het kantoor er een neemt. Een automatische sanctie op een persoon is er niet. | Een melding via `/api/member/report` staat in de wachtrij en verdwijnt alleen door een besluit. |
| MO7 | Geen stil wegmelden | Een post die na 72 uur niemand heeft beoordeeld, blijft verborgen en rood. Hij komt niet vanzelf terug en wordt niet vanzelf verwijderd. De maker ziet "nog in behandeling". | Na de termijn: rood in de wachtrij, en geen automatisch besluit. |

**Niet in dit voorstel:**
- een transparantierapport (art. 15/24; later, uit dezelfde collectie te tellen);
- het buitengerechtelijk geschil (art. 21; verwijzen volstaat);
- AI die beslist. AI mag hooguit de wachtrij sorteren, en beslist nooit.

**Rollen:**
- de werkrol **kantoor** (bestaat), met twee nieuwe capabilities `moderatie.besluit` en `moderatie.bezwaar`;
- geen nieuwe rol.

**Kosten en bouwvolgorde (schatting):**
- MO1, MO2 en MO3 op De Salon en Pulse: middel, ongeveer een werkronde;
- MO4 en MO5: klein;
- MO6 voor personen en de Markt-adapter: klein per adapter.

Elke stap krijgt een toets die eerst faalt, en een stap in de voltooiproeven van Salon en Pulse.

### Wat de eigenaar kiest

1. **Aanbevolen: A. Bouwen zoals hierboven, met De Salon en Pulse eerst, daarna personen en Markt.**
   - Wat het betekent: de wettelijke kern (art. 16 en 17) is er na één ronde, en bezwaar komt direct mee.
   - Wat het kost: het kantoor krijgt een wachtrij die bemand moet worden. Met 72 uur termijn is dat werkdagbezetting, geen 24/7. De responstijd staat al in de besluitenlijst.
2. **B. Alleen motiveren en terugzetten, zonder tweede handtekening en zonder bezwaar.**
   - Kleiner, maar art. 20 en de vier-ogenregel ontbreken.
   - Elk verwijderbesluit is dan het oordeel van één mens.
3. **C. Voorlopig geen automatisch verbergen meer: een melding gaat alleen naar de wachtrij, en verbergt pas na een besluit.**
   - Er is dan geen stil wegmelden, maar ook geen snelle bescherming bij echte overlast tot er iemand kijkt.
   - Te combineren met A: "onveilig" verbergt wel meteen.


---

## Media (LivingOS-B)

Vier apps volgens de aanscherping van 19 oktober (punt 4 a–h, plus LOS/SAMEN en een gebruikersketen met storingen): RTG Sound met Klankwerk als onderdeel, RTG Video, RTG Media en Tweede scherm. Camera is overgedragen aan LivingOS-A. Er komt geen nieuwe laag, geen motor en geen centrale database bij. De ambities van de eigenaar (studio, productie, distributie) staan hier als verdieping binnen de bestaande apps. Er is niets gebouwd.

**Afspraken voor de hele kaart**
- **Peildatum** van elke marktbron is 2026-10-19.
- **[derde bron]** betekent dat de prijs alleen via een site van derden te vinden was en niet op de officiële prijspagina is gecontroleerd.
- **Merknamen** staan alleen als marktreferentie of als bron, nooit als partner.
- **"Bewijs"** verwijst naar de acht APPWERKT-bewijzen. "Lokaal gemeten" is wat ik in deze sessie met `node scripts/voltooiproef.js --alleen=<naam>` en de toetsen op `appwerkt/living-b` zag. Het register zelf is nog de nulmeting.

**Stand van de registers (belangrijk voor punt a)**
- `APPWERKT.json`, ook op `claude/appwerkt-integraal`, is de nulmeting van commit af81b538 (2026-10-19 05:16). Die is van vóór de scenario's van deze ronde.
- `VOLTOOIPROEF.json` (f85c044e) kent `link:muziek`, `link:clips`, `link:mediaos` en `link:tweedescherm` nog niet.
- In het register staan voltooibaar, persistent en herstelbaar dus nog op GEEN_FIXTURE, en bevoegd en menselijk op NIET_GETEST.
- De scenario's sluiten wel lokaal. Pas een centrale meetronde (`npm run voltooiproef:vast` en `npm run appwerkt`) maakt dat tot bewijs. Ik schrijf beide standen op en verwar ze niet.

**Domeinbronnen die voor alle vier gelden** (als bron, niet als partner)
- De Auteurswet en de Wet op de naburige rechten.
- Buma (openbaarmaking van muziekwerken) en Stemra (het mechanische recht: vastleggen en verveelvoudigen). Bron: [webwoordenboek, auteursrechten muziek](https://webwoordenboek.nl/kenniscentrum/wat-zijn-auteursrechten-muziek).
- Sena (naburige rechten van uitvoerende artiesten en producenten). Bron: [IE-Forum, Angad-Gaur](https://www.ie-forum.nl/archief/ieforum_nl/uploads/file/IE-Forum%20Erwin%20Angad-Gaur,%20'Reflecties'%20in%20Sena%20Performers%20Magazine,%202012,%20p_16-17%20(met%20toestemming)_.pdf), een opiniestuk uit 2012. Wie muziek openbaar ten gehore brengt, draagt aan beide af.
- Videma en FilmService voor zakelijk vertoonde tv- en filmbeelden. Bron: [business.gov.nl](https://business.gov.nl/regulation/applying-for-licence-use-television-images).
- Pictoright voor beeldmakers en fotografen. Bron: [Emerce](https://www.emerce.nl/nieuws/670997).
- Actuele tarieven heb ik niet gevonden. Die staan op de sites van deze organisaties zelf, en ik verzin ze niet.

---

### RTG Sound met Klankwerk (link:muziek, /apps/muziek.html; Klankwerk /apps/klankwerk.html)

**Eigenaars (SCHERMEIGENAAR.json):**
- `media.luisteren` → apps/muziek.html
- `media.muziek-maken` → apps/klankwerk.html
- `kantoor.uitgavenaam` → apps/klankwerk-kantoor.html (het kantoorbesluit over de RTG-naam)
- Klankwerk is een eigen scherm met een eigen eigenaar. Ik behandel het hier als onderdeel van de app Muziek, zoals de integrator vroeg. In MAPPEN staat Klankwerk niet als eigen item. → *Voor de integrator:* hoort `media.muziek-maken` als eigen rij in APPWERKT, of als stand van link:muziek?

#### a. Inventaris van het bewezen bestaande

| Bewijs | Register (nulmeting af81b538) | Lokaal gemeten in deze ronde |
|---|---|---|
| bereikbaar | BEWEZEN: opent voor een lid zonder fout | – |
| bedienbaar | BEWEZEN: 14 van 15 eigen knoppen | – |
| menselijk | NIET_GETEST | sluit 3/3: geen kale 5xx, elke weigering in woorden (voltooi/muziek.js) |
| voltooibaar | GEEN_FIXTURE | sluit 8/8: publiceren met "eigen werk", een ander lid hoort het en waardeert, samen luisteren; bevoegd: anoniem 401, ander lid kan niet weghalen, gratis account 403 |
| waarheidsgetrouw | BEWEZEN: 9 antwoorden gelogen, geen verzonnen zekerheid | – |
| persistent | GEEN_FIXTURE | sluit 3/3: na herstart in de feed, de bytes uit de opslag, een nieuwe sessie |
| bevoegd | NIET_GETEST: /api/fluister en /api/muziek/bestand in IDOR.json onbereikbaar | bevoegdstappen in het scenario (zie voltooibaar); niet in IDOR/BEVOEGD |
| herstelbaar | GEEN_FIXTURE | sluit 4/4: dubbeltik, afgebroken upload, crash na publiceren, crash na weghalen |

Gebouwd en getoetst:
- **Sound:**
  - Routes `/api/muziek/bestand|feed|bestand-ticket|luister/:ticket|mooi|bestand-weg` en `/api/samen/*`.
  - Kern `muziek-bestanden.js`: maximaal 60 MB per nummer en 200 nummers per lid; de luisterkaart is 15 minuten geldig; publiceren gaat met een herhaalsleutel. Daarnaast `samen.js`.
  - Generatieve stations klinken in de browser.
- **Klankwerk:**
  - Kern `muziek.js`, `muziek-instrumenten.js` met 19 klanken (kick … koor, fluister), `muziek-lied.js` (vorm en zanglijn; Rahul verzint geen tekst), `muziek-mix.js` (master-gain en drieband-EQ), `muziek-samen.js` (rollen productie, zang, tekst, instrument, mix), `muziek-uitgave.js` (uitgeven onder codenaam; onder de RTG-naam alleen na een besluit van een kantoormens; geen hitlijst) en `muziek-rahul.js` (voorstellen uit tabellen, lokaal-eerst).
  - Scherm `public/apps/klankwerk/*`: export als WAV en als stems.
- **Toetsen:** `muziek*.test.js`, `muziek-bestanden.e2e.js`, `klankwerk.e2e.js`, `muziek-lied.test.js`, `muziek-uitgave.test.js`.

#### b. Marktvergelijking (functies over, verdienmodellen niet)

| Marktleider (duurste pakket) | Wat het pakket biedt | Bron, peildatum 2026-10-19 | Wij |
|---|---|---|---|
| Avid Pro Tools Ultimate | Professionele DAW: onbeperkt sporen, surround/immersive, video-sync, post-productie. $599 per jaar (persbericht Avid 2022) of $99,99 per maand | [Avid persbericht](https://www.avid.com/press-room/2022/11/avids-pro-tools-flex-subscription-offering-for-audio-post-and-music-facilities-renamed-as-pro-tools), [Sweetwater](https://www.sweetwater.com/c1108--Avid--Pro_Tools_Software) [derde bron] | half: meersporen-raster met 19 klanken, mix en master-EQ, WAV en stems. Geen audio-opname van externe instrumenten in meerdere sporen, geen video-sync |
| Ableton Live 12 Suite | Volledige instrumenten- en effectenbibliotheek, Max for Live. $749 (huur-tot-koop 24 × $31,21) | [Sweetwater](https://www.sweetwater.com/store/detail/Live12Ste), [Sound On Sound](https://www.soundonsound.com/news/ableton-introduce-rent-own-plan) [derde bron] | half: lied-vorm en zanglijn, maar een beperkte klankbibliotheek |
| BandLab Max | Samenwerken in de cloud, AI-mastering met mastering-EQ, Retune, distributie (90/10) | [BandLab Help](https://help.bandlab.com/hc/en-us/articles/19290698933145-What-is-BandLab-Membership); prijs [derde bron] wisselend ($12,99–$14,95) | half: samenwerken met rollen ja; mastering half (EQ zonder luidheidsdoel); distributie nee |
| DistroKid Ultimate | Distributie voor 5+ artiesten, Content-ID als betaalde add-on. Circa $89,99 per jaar | [SoftwareSuggest](https://www.softwaresuggest.com/distrokid/pricing), [RouteNote](https://routenote.com/blog/distrokid-up-their-pricing/) [derde bron] | nee |
| Spotify Premium Family | Luisteren zonder advertenties, offline, meerdere profielen. $19,99 per maand (juni 2024) | [Engadget](https://www.engadget.com/spotify-raises-iprice-of-premium-plans-115138529.html) | half: luisteren zonder advertenties ja; offline nee; gezinsprofielen nee |

Wat we niet overnemen:
- Betaald bereik of "promotie" (BandLab en vergelijkbare) en hitlijsten: huisregel, en `muziek-uitgave.js` weigert ze al in zijn kop.
- Een royaltysplit die het platform als verdienmodel achterhoudt: RTG neemt geen commissie op het werk van een maker. → *Vraagt besluit* als dat anders moet.

#### c. Het volledige domein

- **Particulier:** luisteren, een eigen opname delen met vrienden, samen luisteren op afstand, een lied maken zonder kennis van muziektheorie, een liedje voor een verjaardag.
- **Professioneel**, voor muzikant, producer, songwriter, technicus en sessiemuzikant:
  - opname van meerdere bronnen, overdubs en comping;
  - mixen met inserts, sends en automation;
  - mastering naar een luidheidsdoel (streamingdiensten normaliseren rond −14 LUFS; vakpraktijk, zonder bron met datum);
  - stems voor remixers en sync-licenties;
  - metadata: ISRC per opname, ISWC per werk, credits per rol;
  - splitsheets: wie schreef wat, in welk percentage, vastgelegd vóór de release;
  - aanmelden van een werk bij een auteursrechtenorganisatie (Buma/Stemra-structuur) en van een opname bij de naburige-rechtenorganisatie (Sena-structuur).
- **Organisatorisch**, voor label, uitgever, studio en koor of band:
  - catalogusbeheer en releaseplanning;
  - rechten per territorium;
  - afrekening per rechthebbende, met verantwoording;
  - studioboekingen, en een gedeelde bibliotheek in een band met rollen.
- **Wat het vak vraagt en RTG nog niet heeft:**
  - een werk/opname-onderscheid in de gegevens;
  - een splitsheet die vóór de uitgave vaststaat;
  - een luidheidsdoel;
  - opname van echte instrumenten in meerdere sporen.

#### d. Functiecatalogus (L1–L6)

Per functie: gegevens en bron · regels · rekenwijze · onzekerheid · wanneer iemand iets hoort · rollen en toestemming · uitzonderingen · acceptatiecriterium · stand · kosten · bak.

**L1 Persoonlijk**

1. **Eigen nummer delen en beheren**
   - Gegevens: het bestand (mediastore, versleuteld) en het nummerrecord (`muziekBestanden`).
   - Regels: alleen audio herkend aan de bytes; "eigen werk" is verplicht; ≤ 60 MB; ≤ 200 per lid; een herhaalsleutel ≥ 16 tekens.
   - Rekenwijze: geen. Onzekerheid: geen.
   - Wanneer iemand iets hoort: niemand, de feed is chronologisch.
   - Rollen: alleen de maker verwijdert; elk lid met een pas hoort.
   - Uitzonderingen: een gratis account krijgt 403 "RTG Studio is voor leden.".
   - Acceptatie: een ander lid hoort het nummer; na verwijderen staat het ook na een herstart niet meer in de feed of de opslag.
   - Stand: bestaat. Kosten: –. Bak: –.

2. **Verliesvrij afspelen tonen**
   - Gegevens: `mime` en `bytes` van het nummer.
   - Regels: WAV en FLAC worden ongewijzigd geleverd (`stuurBuffer`).
   - Rekenwijze: bitdiepte en samplefrequentie uit de WAV-kop lezen.
   - Onzekerheid: geen voor WAV; een gecomprimeerd bestand zegt "gecomprimeerd".
   - Wanneer iemand iets hoort: het label bij het nummer.
   - Rollen: iedereen die mag luisteren.
   - Acceptatie: bij een 24-bit WAV staat "verliesvrij, 24-bit" en de geleverde bytes zijn gelijk aan de geüploade.
   - Stand: half (de levering is al verliesvrij, de weergave ontbreekt). Kosten: klein. Bak: aanbevolen nu.

3. **Offline bewaren**
   - Gegevens: een kopie in de cache van het toestel.
   - Regels: alleen voor nummers van het lid zelf of met toestemming van de maker.
   - Onzekerheid: de cache kan door de browser geleegd worden; het scherm zegt dat.
   - Wanneer iemand iets hoort: "dit nummer is offline beschikbaar".
   - Rollen: de maker bepaalt of anderen offline mogen bewaren.
   - Acceptatie: zonder netwerk speelt een bewaard nummer.
   - Stand: ontbreekt. Kosten: middel (service worker, rechten). Bak: later.

4. **Samen luisteren**
   - Gegevens: de Samen-kamer (`samenKamers`) en een deelcode, eenmalig getoond.
   - Regels: maximaal 12 personen; alleen de gastheer zet het station.
   - Rekenwijze: de gedeelde start en de seed geven dezelfde track op hetzelfde moment.
   - Onzekerheid: klokverschil, opgevangen door `sesSkew`.
   - Wanneer iemand iets hoort: gastheer en luisteraars krijgen een seintje bij binnenkomst.
   - Rollen: wie de code heeft, mag één keer binnen.
   - Acceptatie: de luisteraar hoort binnen een seconde hetzelfde station.
   - Stand: bestaat. Bak: –.

**L2 Professioneel** (alleen via bestaande genres: `creator` bestaat, muzikant/label niet → vraagt besluit)

5. **Credits en splitsheet bij uitgave**
   - Gegevens: medemakers en rollen (`muziek-samen.js`), vastgelegd bij uitgave.
   - Regels: elke medemaker bevestigt zijn aandeel vóór de uitgave; de som is exact 100%; tekst en compositie (werk) staan apart van opname en uitvoering (master).
   - Rekenwijze: percentages in hele tienden; een afrondingsrest gaat naar de eerste maker en staat er zichtbaar bij.
   - Onzekerheid: geen, het is een afspraak. Rechtsgeldigheid buiten RTG valt onder *voorbehouden*: RTG beslist geen geschil.
   - Wanneer iemand iets hoort: elke medemaker krijgt een vraag om te bevestigen; zonder bevestiging gaat de uitgave niet door.
   - Rollen: de maker stelt voor, elke medemaker tekent voor zichzelf.
   - Uitzonderingen: een medemaker die eruit gaat, blijft met zijn vastgelegde aandeel staan.
   - Acceptatie: een uitgave met twee makers en 60/40 toont beide met rol en percentage, ook nadat één van hen het project verliet.
   - Stand: half (rollen en aftiteling bestaan, percentages en bevestiging niet). Kosten: middel. Bak: aanbevolen nu.

6. **Werk- en opname-metadata (ISWC/ISRC-velden)**
   - Gegevens: velden op de uitgave, ingevuld door de maker.
   - Regels: het formaat wordt gecontroleerd (ISRC: 12 tekens); RTG geeft zelf geen codes uit.
   - Onzekerheid: RTG controleert niet of een code echt bij een register hoort, en zegt dat.
   - Wanneer iemand iets hoort: geen melding.
   - Rollen: maker.
   - Acceptatie: een geldige code wordt opgeslagen; een ongeldige geeft de reden.
   - Stand: ontbreekt. Kosten: klein. Bak: later (pas nuttig met distributie).

7. **Meersporen-opname van echte instrumenten**
   - Gegevens: audio-opnames per spoor, origineel op het toestel (zoals Clips met OPFS) of in de privé-mediastore.
   - Regels: elk spoor heeft een eigenaar; inspelen over afstand kan alleen asynchroon.
   - Rekenwijze: latentiecompensatie per toestel, gemeten met een kliktoon.
   - Onzekerheid: de latentie van Bluetooth-oortjes is niet betrouwbaar te meten; het scherm raadt bedraad aan.
   - Rollen: rol "instrument" of "zang".
   - Acceptatie: een opgenomen spoor speelt in de maat met het raster, met minder dan 10 ms verschuiving na compensatie.
   - Stand: ontbreekt. Kosten: groot. Bak: later.

**L3 Organisatorisch**

8. **Band of collectief als eenheid**
   - Gegevens: een groep van codenamen met rollen.
   - Regels: een uitgave "namens de band" vraagt akkoord van de leden volgens een vooraf gekozen regel (alle leden of een meerderheid).
   - Rollen: lid, beheerder.
   - Acceptatie: een uitgave namens de band staat pas als het vereiste aantal leden akkoord gaf.
   - Stand: ontbreekt. Kosten: middel. Bak: later. → *Voor de integrator:* is dit een organisatie (WorkOS/concern) of een kring (sociaal)? Geen dubbele logica.

9. **Uitgave onder de RTG-naam**
   - Gegevens: aanvraag en besluit (`muziek-uitgave.js`, `klankwerk-kantoor.html`).
   - Regels: alleen een mens van het kantoor beslist; bij afwijzing blijft de uitgave onder de codenaam staan.
   - Wanneer iemand iets hoort: de maker hoort het besluit.
   - Acceptatie: de gedeelde kantoorcode kan niet beslissen; een kantoormens op naam wel.
   - Stand: bestaat. Bak: –.

**L4 Domeinintelligentie** (bestaande stuurlaag en `muziek-rahul.js`; een voorspelling is nooit een feit)

10. **Mastering naar een luidheidsdoel**
    - Gegevens: de mix (`muziek-mix.js`).
    - Regels: doel −14 LUFS geïntegreerd en ware piek ≤ −1 dBTP, gekozen door de maker.
    - Rekenwijze: luidheid meten volgens ITU-R BS.1770 (K-gewogen); daarna gain en limiter.
    - Onzekerheid: de meting is exact; "klinkt goed" is geen meting en wordt niet beweerd.
    - Wanneer iemand iets hoort: vóór en na, A/B te vergelijken.
    - Rollen: rol mix.
    - Uitzonderingen: een stil stuk wordt niet opgepompt boven het doel.
    - Acceptatie: na "maak af" meet de export −14 LUFS (±0,5) en ≤ −1 dBTP.
    - Stand: half (EQ en gain bestaan, de meting niet). Kosten: middel. Bak: aanbevolen nu.

11. **Voorstel van Rahul voor een patroon of lied**
    - Gegevens: tabellen uit `muziek-rahul.js`.
    - Regels: alleen een voorstel, nooit vanzelf toegepast; teksten van leden worden niet herschreven.
    - Onzekerheid: het voorstel draagt het label "voorstel".
    - Acceptatie: zonder AI-sleutel komt er een voorstel uit de tabellen, en het raster verandert pas na "neem over".
    - Stand: bestaat. Bak: –.

**L5 Volledige levenscyclus**

12. **Distributie buiten RTG**
    - Stand: ontbreekt. Kosten: groot. Bak: niet doen vóór V1.
    - Reden: vraagt een externe distributeur, contracten en een besluit over geld en rechten. Zie *Extern*.

13. **Intrekken en archief**
    - Gegevens: de uitgave.
    - Regels: intrekken haalt het nummer uit de zaal; de aftiteling blijft in het archief van de makers; clips die het als geluid dragen tonen "niet meer beschikbaar".
    - Acceptatie: na intrekken hoort niemand het nummer meer, en de clip zegt waarom.
    - Stand: half (`muziekTrekIn` bestaat; het gedrag in Clips is niet gemeten). Kosten: klein. Bak: aanbevolen nu.

**L6 RTG-samenhang**

14. **Uitgegeven:** `RTGSpeler` (de mini-speler van de schil), uitgaven voor Media OS (stand MUZIEK), geluid voor Clips (`clips-lezers.js`), functiegids/Heel RTG ("open muziek").
15. **Ontvangen:** Samen-kamers, `werkherkomst.js` (wie de maker is).
16. **Buiten de eigen apps:**
    - FoundationOS "liedjes" (`rtf.liedjes` → apps/foundation/liedjes.html) en School (`leren.school`): een kind maakt een lied als leeropdracht.
    - Horeca-events (`horeca.events`): een zaak die muziek laat horen, moet aan Buma en Sena afdragen; RTG kan dat melden, niet regelen.
    - → *Voor de integrator:* koppelt horeca.events aan een "muziek in de zaak"-verklaring, en wie is daarvan eigenaar?

#### e. RTG-exclusief

- **Uitgeven onder codenaam:** de echte naam reist nooit mee, en de aftiteling is onwijzigbaar.
- **Geen hitlijst en geen bereik te koop:** de zaal is chronologisch en eindig.
- **Splitsheet en uitgave in één stap:** de credits staan vast vóór iemand het hoort. Elders is dat een los document.
- **Van School tot uitgave in één keten:** een kind maakt een lied bij School en de ouder ziet het in het gezin. De 18+-grens geldt alleen voor een eventuele ranglijst, en die bestaat niet.

#### f. Bouwstenen en ontbrekende koppelingen

- **Bestaat:** `muziek-bestanden.js`, `muziek-mix.js`, `muziek-samen.js`, `muziek-uitgave.js`, `muziek-lied.js`, `muziek-rahul.js`, `klankwerk/wav.js` (export), `samen.js`, `RTGSpeler`, `werkherkomst.js`, `clips-lezers.js`.
- **Ontbreekt:**
  - percentages en bevestiging in `muziek-samen` (splitsheet);
  - een LUFS-meting in de export;
  - de weergave van verliesvrij op Sound;
  - de melding in Clips bij een ingetrokken uitgave;
  - een groep als maker.

#### g. Prioritering

| # | Functie | Kosten | Complexiteit | Afhankelijk van |
|---|---|---|---|---|
| 1 | Verliesvrij tonen | klein | laag | – |
| 2 | Intrekken zichtbaar in Clips | klein | laag | clips-lezers |
| 3 | Splitsheet bij uitgave | middel | middel | muziek-samen, uitgave |
| 4 | Mastering naar luidheidsdoel | middel | middel (DSP in de browser) | muziek-mix, wav-export |
| 5 | Offline bewaren | middel | middel | service worker, rechtenbesluit |
| 6 | ISRC/ISWC-velden | klein | laag | pas zinvol met #8 |
| 7 | Meersporen-opname | groot | hoog | latentiemeting, opslag |
| 8 | Distributie | groot | hoog | extern, besluit |

#### h. Toetsbaar eindcontract (Beyond Premium; vervangt de acht APPWERKT-bewijzen nooit)

| Dimensie | Meetbaar criterium |
|---|---|
| Breedte | Een lid kan luisteren, maken, samen luisteren, uitgeven en intrekken, elk via een route die in SCHERMROUTES staat |
| Professionele diepte | Een export haalt −14 LUFS ±0,5 en ≤ −1 dBTP; stems per spoor zijn bit-gelijk aan de mix-bronnen |
| Levenscyclus | Maken → uitgeven → intrekken → archief, elk met een toets, en een ingetrokken stuk is nergens meer te horen |
| Samenwerking en rollen | Een uitgave met twee makers draagt beide met rol en percentage, bevestigd door elk, ook na vertrek |
| Domeinintelligentie | Elk Rahul-voorstel draagt "voorstel" en verandert niets zonder "neem over" (toets) |
| Los functioneren | Met Media OS en Clips uit werken luisteren, maken en uitgeven, en het scherm zegt wat er niet kan |
| RTG-ketens | De keten Klankwerk → Sound → Media OS → Clips draagt overal dezelfde verwijzing, zonder kopie (toets op id) |
| Bewezen betrouwbaarheid | De acht APPWERKT-bewijzen BEWEZEN voor link:muziek, en een eigen rij voor Klankwerk als de integrator dat besluit |

#### Twee uitkomsten

**Deel A — bouwbaar binnen de huidige architectuur en scope.** Dit zijn de functies in d met bak "aanbevolen nu" en "later", in de volgorde van g:
1. verliesvrij tonen;
2. intrekken zichtbaar in Clips;
3. splitsheet bij uitgave;
4. mastering naar luidheidsdoel;
5. offline bewaren;
6. ISRC/ISWC-velden;
7. meersporen-opname.

Alles op bestaande kern (`muziek-*`, Samen, mediastore). Geen nieuwe laag, geen nieuwe motor.

**Deel B — het domeinmaximum, ook buiten de huidige scope.** Nieuwe professionele processen. Ze vragen elk een besluit en vaak iets van buiten (zie *Extern*). Elk is bouwbaar concreet uitgewerkt.

**B1. Releaseketen van werk tot release (label en artiest).**
- Gegevens:
  - een werk: titel, auteurs met aandeel, ISWC;
  - een opname: uitvoerenden met rol, producent, ISRC, de master-WAV;
  - een release: titel, releasedatum, territoria, artwork, prijs nul of per stuk.
- Regels:
  - geen release zonder een bevestigde splitsheet voor het werk én de opname;
  - artwork en master zijn vóór de releasedatum bevroren;
  - wijzigen na release maakt een nieuwe versie, de oude blijft in het archief.
- Rekenwijze: de releasedatum minus de aanlevertermijn van de distributeur (een veld) geeft de uiterste aanleverdatum.
- Onzekerheid: de aanlevertermijn is een opgave van derden en staat als "opgave distributeur".
- Wanneer iemand iets hoort:
  - elke betrokkene hoort het op T−30, T−14 en T−7 dagen als er iets ontbreekt;
  - op de releasedag hoort iedereen het.
- Rollen en toestemming:
  - de artiest of het label stelt samen;
  - elke rechthebbende tekent voor zijn deel;
  - alleen een mens van het label zet de release door.
- Uitzonderingen:
  - een cover vraagt een licentie van de rechthebbende van het werk;
  - zonder licentie geen release.
- Acceptatie: een release met een ontbrekende handtekening kan niet worden doorgezet, en het scherm noemt wie nog moet tekenen.

**B2. Afrekening per rechthebbende (royalty-afschrift).**
- Gegevens:
  - opbrengstregels per opname, per bron en per periode (uit een import van de distributeur);
  - de splitsheet.
- Regels:
  - de verdeling volgt de splitsheet die gold op de datum van de opbrengst;
  - RTG neemt geen commissie;
  - uitbetalen loopt via de geldlaag (`server/kern/pay`), nooit buiten het grootboek.
- Rekenwijze:
  - per regel: bedrag × aandeel, afgerond op centen;
  - de afrondingsrest gaat naar de hoofdrechthebbende en staat zichtbaar op het afschrift.
- Onzekerheid:
  - een import zonder ISRC wordt niet verdeeld, maar komt in een wachtrij "niet toe te wijzen";
  - de fiscale klasse is *uitlegbaar* (btw over royalty's verschilt per situatie).
- Wanneer iemand iets hoort: per kwartaal een afschrift; direct bij een regel die niet toe te wijzen is.
- Rollen: rechthebbende (alleen-lezen eigen deel), label (allen), kantoor (geschillen).
- Uitzonderingen: een geschil bevriest de uitbetaling voor die opname tot er een besluit van een mens is.
- Acceptatie: een import van €100 op een opname met 60/40 geeft €60,00 en €40,00, en de som van alle afschriften is gelijk aan de import.

**B3. Studioboeking en sessieregister.**
- Gegevens: studio (een zaak met genre-besluit), ruimte, tijdvak, sessiemuzikanten met tarief, het sessieregister (wie speelde wat op welke opname).
- Regels:
  - een sessie maakt automatisch een conceptregel voor de credits;
  - een sessiemuzikant tekent af wat hij speelde;
  - zonder aftekening geen credit.
- Rekenwijze: kosten = tijd × tarief per ruimte + sessietarieven.
- Wanneer iemand iets hoort: een bevestiging, een herinnering op T−1 dag, en na afloop een verzoek tot aftekenen.
- Rollen: de studio, de boeker en de muzikant.
- Uitzonderingen: annulering volgens de voorwaarden van de studio, door de studio zelf ingesteld.
- Acceptatie: een afgetekende sessie staat als credit op de opname, en een niet-afgetekende niet.
- Eigenaar van de boeking: de agenda/planning (`PLANNING.md`). → *Voor de integrator.*

**B4. Muziekgebruik door een zaak (Buma/Sena-melding).**
- Gegevens: welke muziek een zaak openbaar laat horen (afspeellijst, live-optredens) en de grootte van de zaak.
- Regels:
  - RTG meldt het gebruik en toont welke organisaties het betreft;
  - RTG sluit geen licentie af namens de zaak (*voorbehouden*);
  - eigen werk van leden met een verklaring "vrij voor openbaar gebruik" telt apart.
- Onzekerheid: de tarieven staan bij de organisaties zelf; RTG rekent ze niet uit en zegt dat.
- Wanneer iemand iets hoort: bij het aanzetten van muziek in de zaak hoort de zaak welke meldingen er horen.
- Rollen: de zaakbeheerder.
- Acceptatie: een zaak die een afspeellijst publiek zet, ziet de melding met de organisaties erbij en kan aangeven dat er een licentie is.

**Modus LOS**
- Vandaag:
  - stations klinken zonder server;
  - de eigen bibliotheek werkt zonder Media OS of Clips;
  - zonder inlog zegt het scherm dat de feed een account vraagt;
  - Klankwerk exporteert zonder netwerk.
- Niet gemeten: wat Sound zegt als `/api/samen` uitvalt. Eis: "Samen luisteren is nu niet beschikbaar; je eigen muziek speelt gewoon."

**Modus SAMEN**
- Eén verwijzing (het id van de uitgave) reist van Klankwerk naar Sound, Media OS en Clips.
- Volgen gaat via Media OS naar de volgerslijst van het domein zelf.
- Rahul "open muziek" en Heel RTG vinden Sound; Klankwerk staat in de gids als `media.muziek-maken`.

**Gebruikersketen** (een lied maken met een vriend en het delen)
1. A opent Klankwerk en kiest een lied-vorm.
2. A nodigt B op codenaam uit met de rol "zang".
3. B neemt de zang op (vandaag: de zanglijn van Klankwerk; straks een opname).
4. Ze bevestigen een split van 60/40.
5. A geeft uit onder codenaam.
6. Vrienden horen het in Sound en zien het in Media OS.
7. C zet het onder een clip.

Storingen:
- B heeft geen pas: uitnodigen weigert met de reden.
- B bevestigt niet: de uitgave blijft concept.
- Het netwerk valt weg tijdens de upload: dezelfde sleutel geeft één nummer (bewezen).
- Een crash na het publiceren: één nummer (bewezen).
- A trekt in: de clip van C zegt "niet meer beschikbaar" (te bouwen).
- C is geen vriend en ziet het nummer niet als het besloten is (bestaat bij Salon-posts, nog niet bij uitgaven).

**Vraagt besluit:**
- een genre muzikant/label/studio in `server/seed/genres.js`;
- de vorm van de band (organisatie of kring);
- rechten voor offline bewaren;
- distributie en uitbetaling van splits.

**Extern:**
- een distributeur (ISRC/UPC, levering aan streamingdiensten);
- collectieve beheersorganisaties voor auteurs- en naburige rechten (aanmelding blijft *voorbehouden*: RTG meldt niet aan namens een maker zonder mandaat);
- codecs voor verliesvrije compressie (FLAC wordt al herkend).

---

### RTG Video (link:clips, /apps/clips.html)

**Eigenaar:** `media.clips`.

#### a. Inventaris

| Bewijs | Register (nulmeting) | Lokaal gemeten |
|---|---|---|
| bereikbaar | BEWEZEN | – |
| bedienbaar | BEWEZEN: 4 van 4 | – |
| menselijk | NIET_GETEST | sluit 3/3 |
| voltooibaar | GEEN_FIXTURE | sluit 9/9 (voltooi/clips.js); bevoegd: anoniem 401, ander lid 404, gratis account 403 |
| waarheidsgetrouw | BEWEZEN: 11 gelogen | – |
| persistent | GEEN_FIXTURE | sluit 3/3 |
| bevoegd | NIET_GETEST: /api/stroom/ticket niet in IDOR.json | bevoegdstappen in het scenario |
| herstelbaar | GEEN_FIXTURE | sluit 4/4 (dubbeltik en crash geven één kaart) |

Daarnaast `test/videobellen-echt.e2e.js` toets 3: een kijker krijgt het beeld rechtstreeks van het toestel van de maker (WebRTC, nepcamera), niet in de voltooiproef.

Gebouwd:
- Routes `/api/clips/*` (feed, maak, weg, volg, reactie(s), meld, knip, ondertitels, geluid, aanwezig, signaal) en `/api/office/clips*`.
- Kern `clips.js`: maximaal 60 s; een affiche van ≤ 80 kB; een eindige dagselectie van 25; aanwezigheid 90 s.
- `clips-studio.js`: knippen zonder iets weg te gooien, ondertitels, geluid.
- `clips-lezers.js` (uitgave als geluid) en `clips-kantoor.js` (melden en afhandelen).
- Het origineel blijft in OPFS op het toestel van de maker.

#### b. Marktvergelijking

| Marktleider (duurste pakket) | Wat het pakket biedt | Bron, peildatum 2026-10-19 | Wij |
|---|---|---|---|
| CapCut Pro | Export in 4K/HDR, automatische ondertitels, 1 TB cloud, AI-effecten (achtergrond, ruis, tracking). $19,99/mnd of $179,99/jr | [Newsweek](https://newsweek.com/app-used-millions-nearly-doubles-subscription-price-overnight-11535999), [CapCut help](https://www.capcut.com/help/capcut-pro-price) | half: knippen, ondertitels en geluid zonder watermerk ja; 4K-export, ruisonderdrukking en tracking nee |
| Frame.io Enterprise | Review met tijdcodecommentaar, versies, beveiligde deellinks, SSO. Team $25 per lid per maand; Enterprise op offerte | [Frame.io help](https://help.frame.io/en/articles/10150181-getting-started-what-are-the-pricing-plans-you-offer), [Capterra](https://www.capterra.com/p/148214/Frame-io/pricing/) [derde bron] | nee: geen review op tijdcode, geen versies |
| Vimeo Enterprise / Advanced | Hosting, privacy per video, livestreaming, analyses, DRM | [Vimeo help](https://help.vimeo.com/hc/en-us/articles/12425432033937-About-Vimeo-plans), [Livid](https://livid.com/blog/vimeo-price-increase-2026-a-complete-breakdown-of-the-new-plans-and-forced-upgrades/) [derde bron] | half: privacy per clip nee (alles is feed); live zit in Podium (`media.podium`) |

Wat we niet overnemen: algoritmische bereiksvergroting, boost, "trending" en oneindige scroll. De feed is eindig: 25, met een einde.

#### c. Het volledige domein

- **Particulier:** een moment vastleggen, kort monteren, ondertitelen voor wie niet kan horen, delen met vrienden, muziek eronder.
- **Professioneel**, voor videomaker, editor, journalist en content-maker:
  - review met tijdcodecommentaar en versies;
  - exportprofielen (resolutie, codec, beeldverhouding);
  - rechten op de muziek eronder (synchronisatierecht: muziek bij beeld vraagt toestemming van de rechthebbende, ook van uitgever en producent);
  - portretrecht van wie in beeld is (Auteurswet art. 21);
  - ondertitels als toegankelijkheidseis.
- **Organisatorisch**, voor redactie, merk en school:
  - een kanaal met meerdere makers, goedkeuring vóór publicatie, archief en bewaartermijn;
  - een makerverklaring voor gebruik door derden.
- **Wat RTG nu niet heeft:**
  - review en versies;
  - privacy per clip;
  - een portretrechtvraag;
  - export;
  - een kanaal.

#### d. Functiecatalogus

**L1 Persoonlijk**

1. **Opnemen, knippen, ondertitelen, geluid**
   - Gegevens: het origineel in OPFS en de bewerking als instructie (`clips-studio.js`).
   - Regels: ≤ 60 s; een knip is een instructie, nooit verlies.
   - Rekenwijze: de duur wordt gemeten bij het stoppen (gerepareerd in deze ronde).
   - Rollen: maker.
   - Acceptatie: na knippen en terugdraaien is de clip weer heel.
   - Stand: bestaat.

2. **Zichtbaarheid per clip (iedereen / volgers / vrienden)**
   - Gegevens: veld `publiek` op de clip.
   - Regels: dezelfde waarden en dezelfde poort als Salon (`kern/salon/vorm.js`, `zichtbaarheid.js`), geen eigen kopie.
   - Wanneer iemand iets hoort: niets.
   - Rollen: maker.
   - Uitzonderingen: een gemelde clip wordt door het kantoor verborgen.
   - Acceptatie: een clip "vrienden" is voor een vreemde 404 en voor een vriend zichtbaar.
   - Stand: ontbreekt. Kosten: klein. Bak: aanbevolen nu.

3. **"De maker is nu niet online"**
   - Gegevens: de aanwezigheid (90 s).
   - Regels: P2P zonder kopie bij RTG.
   - Onzekerheid: aanwezigheid is een momentopname.
   - Wanneer iemand iets hoort: de kijker ziet de affiche, de titel en de zin.
   - Acceptatie: met de maker offline geeft Speel binnen 3 s die zin en geen lege speler.
   - Stand: half. Kosten: klein. Bak: aanbevolen nu.

4. **Export in de resolutie van opname**
   - Gegevens: het origineel in OPFS.
   - Regels: alleen de maker; encoderen in de browser.
   - Onzekerheid: per toestel verschilt welke codec beschikbaar is; het scherm noemt de gekozen codec.
   - Acceptatie: een 4K-opname exporteert in 4K met de knip en de ondertitels erin gebrand of als losse ondertitelbestanden.
   - Stand: ontbreekt. Kosten: middel. Bak: later.

5. **Ruisonderdrukking op het toestel**
   - Regels: alleen lokaal, geen externe dienst.
   - Onzekerheid: het resultaat is een bewerking die het lid hoort en kan uitzetten.
   - Stand: ontbreekt. Kosten: middel. Bak: later.

**L2 Professioneel** (genres `creator`, `fotograaf`, `journalistiek` bestaan)

6. **Portretrechtvraag**
   - Gegevens: codenamen die in de clip getagd zijn.
   - Regels: wie getagd is, krijgt een vraag; zonder akkoord is de clip alleen voor de maker. Gezichtsherkenning gebeurt niet (privacy).
   - Wanneer iemand iets hoort: de getagde krijgt een melding.
   - Rollen: maker vraagt, getagde beslist.
   - Uitzonderingen: geen tag betekent geen vraag. RTG beweert niet dat er niemand in beeld is.
   - Acceptatie: een getagde die weigert, ziet de clip nergens van zichzelf terug.
   - Stand: ontbreekt. Kosten: middel. Bak: later.

7. **Review met tijdcodecommentaar**
   - Gegevens: reacties met tijdstip (uitbreiding van `clips` reacties).
   - Regels: alleen voor genodigden van de maker.
   - Acceptatie: een opmerking op 0:12 springt bij tikken naar 0:12.
   - Stand: half (reacties bestaan zonder tijdcode). Kosten: klein. Bak: aanbevolen nu.

**L3 Organisatorisch**

8. **Kanaal met goedkeuring**
   - Regels: makers stellen voor, een redacteur keurt goed.
   - Eigenaar van redactie: `zaak.redactie` (apps/redactie.html).
   - → *Voor de integrator:* een videokanaal van een zaak hoort bij de redactie, niet als tweede redactielogica in Clips.
   - Stand: ontbreekt. Kosten: middel. Bak: later.

**L4 Domeinintelligentie**

9. **Automatische ondertitels**
   - Gegevens: audio van de clip via `/api/ondertiteling` (lokaal-eerst).
   - Onzekerheid: de ondertitels zijn voorlopig tot de maker ze nakeek; dat staat erbij.
   - Acceptatie: na opname staan ze klaar, met "voorlopig, nog niet nagekeken".
   - Stand: half. Kosten: klein. Bak: aanbevolen nu.

**L5 Levenscyclus**

10. **Verwijderen, melden, afhandelen**: bestaat (`clips-kantoor.js`), bewezen in het scenario.
11. **Wat als het toestel van de maker weg is**
    - Regels: het origineel is weg; de affiche en de titel blijven tot de maker ze verwijdert.
    - → *Vraagt besluit:* blijft een clip zonder bron in de feed?
    - Stand: ontbreekt (beleid).

**L6 RTG-samenhang**

- Uit: clips voor Media OS (FLOW); aanwezigheid via de gedeelde clipdeler (ook in media.html).
- In: uitgaven als geluid (Klankwerk), volgen via Media OS.
- Buiten de eigen apps:
  - Reizen: een clip van een moment op reis. Eigenaar van momenten in Reizen is `reizen.reisboek` (apps/reisboek.html) of de momenten van Reizen. → *Voor de integrator:* welke eigenaar, zodat Clips alleen een verwijzing geeft.
  - School: een spreekbeurt-video (`leren.school`).

#### e. RTG-exclusief

- **Het origineel verlaat het toestel nooit**, maar kijken kan toch, rechtstreeks. Er is geen kopie op een server.
- **Een eindige, eerlijke feed** met een einde.
- **Muziek eronder met de rechten van de maker meegenomen:** de uitgave draagt credits, en intrekken stopt het geluid.

#### f. Bouwstenen en ontbrekende koppelingen

- **Bestaat:** `clips.js`, `clips-studio.js`, `clips-lezers.js`, `clips-kantoor.js`, `clipdeler` (gedeeld), `/api/ondertiteling`, de Salon-zichtbaarheidspoort.
- **Ontbreekt:**
  - `publiek` op de clip via de Salon-poort;
  - tijdcode bij reacties;
  - de melding bij een offline maker;
  - de melding "voorlopig" bij ondertitels;
  - export.

#### g. Prioritering

| # | Functie | Kosten | Complexiteit | Afhankelijk van |
|---|---|---|---|---|
| 1 | "Maker niet online" | klein | laag | aanwezigheid |
| 2 | Ondertitels "voorlopig" | klein | laag | ondertiteling |
| 3 | Zichtbaarheid per clip | klein | laag | Salon-poort |
| 4 | Tijdcodecommentaar | klein | laag | reacties |
| 5 | Portretrechtvraag | middel | middel | tags, meldingen |
| 6 | Export | middel | middel | codecs in de browser |
| 7 | Ruisonderdrukking | middel | hoog | lokaal model |
| 8 | Kanaal met redactie | middel | middel | redactie-eigenaar |

#### h. Eindcontract

| Dimensie | Meetbaar criterium |
|---|---|
| Breedte | Opnemen, knippen, ondertitelen, geluid, delen, verwijderen, melden, elk getoetst |
| Professionele diepte | Tijdcodecommentaar springt naar de juiste seconde; export behoudt de resolutie van opname |
| Levenscyclus | Opnemen → delen → melden → afhandelen → verwijderen, en een verwijderde clip is nergens meer te zien |
| Samenwerking en rollen | Een clip "vrienden" is voor een vreemde 404 (toets); een getagde kan weigeren |
| Domeinintelligentie | Automatische ondertitels dragen "voorlopig" tot ze zijn nagekeken |
| Los functioneren | Zonder Klankwerk en Media OS werken opnemen en delen, en het scherm zegt wat er niet kan |
| RTG-ketens | Een ingetrokken uitgave onder een clip toont "niet meer beschikbaar" (toets) |
| Bewezen betrouwbaarheid | De acht APPWERKT-bewijzen BEWEZEN; de P2P-weergave blijft bewezen in de browserproef |

#### Twee uitkomsten

**Deel A — bouwbaar binnen de huidige architectuur en scope.** In de volgorde van g:
1. "maker niet online";
2. ondertitels "voorlopig";
3. zichtbaarheid per clip via de Salon-poort;
4. tijdcodecommentaar;
5. portretrechtvraag;
6. export;
7. ruisonderdrukking op het toestel;
8. kanaal met de redactie als eigenaar.

**Deel B — het domeinmaximum: nieuwe professionele processen.**

**B1. Productieketen voor korte video (redactie, merk, school).**
- Gegevens: briefing (doel, publiek, deadline), opnames per maker (origineel op het toestel), versies, reviewronde met tijdcodecommentaar, goedkeuring, publicatie.
- Regels:
  - publiceren kan pas na goedkeuring door de rol eindredacteur;
  - elke versie blijft bewaard;
  - goedkeuring geldt voor één versie.
- Rekenwijze: deadline minus de doorlooptijd per fase (door de redactie ingesteld) geeft per fase een uiterste datum.
- Onzekerheid: de doorlooptijden zijn een instelling, geen meting.
- Wanneer iemand iets hoort: een maker bij nieuw commentaar; de eindredacteur bij een nieuwe versie; iedereen bij publicatie.
- Rollen: maker, reviewer, eindredacteur (in de redactie, `zaak.redactie`).
- Uitzonderingen: een spoedpublicatie vraagt twee goedkeurders.
- Acceptatie: een clip zonder goedkeuring van de laatste versie kan niet gepubliceerd worden, en het scherm noemt de ontbrekende stap.

**B2. Rechtenpakket bij publicatie.**
- Gegevens:
  - muziekrechten (de uitgave met credits, of een licentie-ID van derden);
  - portrettoestemmingen (getagde codenamen met akkoord);
  - locatierechten (een verklaring van de plek).
- Regels: een publieke clip zonder volledig rechtenpakket blijft "alleen voor mij".
- Onzekerheid: RTG controleert geen externe licentie inhoudelijk en zegt dat; een licentie-ID is een opgave.
- Wanneer iemand iets hoort: de maker, bij een ontbrekend onderdeel.
- Rollen: de maker vraagt, de rechthebbende stemt in.
- Acceptatie: een clip met een getagde zonder akkoord kan niet op "iedereen".

**B3. Toegankelijkheidsnorm per clip.**
- Gegevens: ondertitels (nagekeken), audiodescriptie (een tekstspoor), het contrast van de ondertitels.
- Regels:
  - de redactie kan eisen dat nagekeken ondertitels verplicht zijn vóór publicatie;
  - de audiodescriptie wordt door een mens geschreven of nagekeken.
- Rekenwijze: het contrast van de ondertiteltekst ≥ 4,5:1 (WCAG AA, de huisnorm uit CLAUDE.md).
- Acceptatie: een redactie met deze eis publiceert geen clip met "voorlopig"-ondertitels.

**Modus LOS**
- Vandaag werken opnemen, knippen en delen zonder Media OS en zonder Klankwerk.
- Kijken zonder WebRTC kan niet.
- Eis: het scherm zegt dat eerlijk. Niet gemeten.

**Modus SAMEN**
- Een uitgave als geluid leidt in één tik naar het hele stuk (de Media OS-hub).
- Volgen geldt huisbreed.
- "open video" en Heel RTG vinden de app.

**Gebruikersketen**
1. A neemt 20 s op.
2. A knipt.
3. A zet er een uitgave van B onder.
4. A deelt met "vrienden".
5. C (een vriend) kijkt rechtstreeks.
6. D (een vreemde) ziet niets.

Storingen:
- A is offline: C hoort "de maker is nu niet online".
- B trekt de uitgave in: de clip speelt zonder geluid en zegt waarom.
- Een dubbeltik of crash bij delen: één kaart (bewezen).
- Een streng netwerk zonder TURN: geen beeld, met de reden.
- Het toestel van A is weg: besluit nodig.

**Vraagt besluit:**
- een clip zonder bron;
- een videokanaal bij de redactie;
- het portretrechtbeleid.

**Extern:** TURN voor strenge netwerken; codecs per platform.

---

### RTG Media (link:mediaos, /apps/media.html)

**Eigenaar:** `media.centrum`. Media OS bezit geen domein. Elke rij komt uit Klankwerk (`media.muziek-maken`), Theater (`media.theater`), Clips (`media.clips`) of Podium (`media.podium`).

#### a. Inventaris

| Bewijs | Register (nulmeting) | Lokaal gemeten |
|---|---|---|
| bereikbaar | BEWEZEN | – |
| bedienbaar | BEWEZEN: 17 van 29 eigen knoppen, 5 niet aan te tikken (intercepts pointer events) | – |
| menselijk | NIET_GETEST | sluit 3/3 |
| voltooibaar | GEEN_FIXTURE | sluit 7/7 (voltooi/mediaos.js); bevoegd: anoniem 401, een lezer kan een gedeelde lijst niet wijzigen (403), een vreemde ziet niets, gratis account 403 |
| waarheidsgetrouw | BEWEZEN: 11 gelogen | – |
| persistent | GEEN_FIXTURE | sluit 3/3 |
| bevoegd | NIET_GETEST: 3 van 6 routes niet gemeten | bevoegdstappen in het scenario |
| herstelbaar | GEEN_FIXTURE | sluit 4/4 (lijst na crash één keer, gerepareerd) |

Let op: de 5 niet aan te tikken knoppen uit de nulmeting zijn een open punt voor bedienbaar.

Gebouwd:
- Routes `/api/mediaos/*`: wereld, stuk, maker, volg, meldingen, bieb, bewaar, lijst(en), lijst/deel, samen, smaak, stuur, bord, aanwezig, momenten.
- Kern `server/kern/mediaos/`: hub, catalogus, lijsten, lijstdelen, samen, smaak, tijdlijn, zoeken, werkherkomst, zaakwereld, wekken.
- Toetsen: `media*.test.js`, `media.e2e.js`, `media-studio-pro.e2e.js`, `medialijst*.js`, `mediasamen.test.js`.

#### b. Marktvergelijking

| Marktleider (duurste pakket) | Wat het pakket biedt | Bron, peildatum 2026-10-19 | Wij |
|---|---|---|---|
| Plex Pass Lifetime | Downloaden voor offline, op afstand kijken, transcoderen in HD/4K, gezinsprofielen, liedteksten. Lifetime $749,99, jaar $69,99 | [TechCrunch 2025](https://techcrunch.com/2025/03/19/streamer-plex-raises-subscription-price-for-the-first-time-in-a-decade), [AlternativeTo 2026](https://alternativeto.net/news/2026/7/plex-lifetime-pass-price-is-now-750-as-plex-adds-a-new-5-year-recurring-pass-at-250/) [derde bron] | half: één bibliotheek en samen kijken ja; offline, profielen en transcoderen nee |
| Spotify Premium Family | Muziek zonder advertenties, offline, profielen | [Engadget](https://www.engadget.com/spotify-raises-iprice-of-premium-plans-115138529.html) | half |
| Vimeo Enterprise | Privacy per video, analyses, DRM | [Vimeo help](https://help.vimeo.com/hc/en-us/articles/12425432033937-About-Vimeo-plans) | nee: geen DRM; maker-analyses beperkt (`mediaos/meldingen`) |

Niet over te nemen: autoplay naar het volgende stuk, eindeloze stromen en een volgorde op populariteit.

#### c. Het volledige domein

- **Particulier:** één plek om te luisteren en te kijken, bewaren, lijsten voor jezelf en anderen, samen kijken op afstand, verdergaan op een ander toestel, kinderen veilig laten kijken.
- **Professioneel** (maker): één profiel over alle vormen, inzicht in wie volgt (zonder volgorde op populariteit), en een herkomst die vastligt (`werkherkomst.js`).
- **Organisatorisch** (zaak, zender, festival):
  - een zaakwereld (`zaakwereld.js`);
  - programmeren voor een zaal;
  - wat een zaak publiek mag vertonen (Videma/FilmService voor tv- en filmbeeld, Buma/Sena voor muziek).
- **Wat ontbreekt:**
  - offline;
  - profielen per gezinslid;
  - doorgaan waar ik was;
  - uitleg bij een aanbeveling;
  - een eerlijke melding per domein.

#### d. Functiecatalogus

**L1**

1. **Eén bibliotheek en één volgknop**
   - Gegevens: de volgerslijst van elk domein zelf (`volgen.js`).
   - Regels: Media OS schrijft in het domein, nooit in een eigen kopie.
   - Acceptatie: één keer volgen toont de maker in MUZIEK, KIJK en FLOW.
   - Stand: bestaat.

2. **Gedeelde lijst met rechten**
   - Gegevens: `lijsten.js` en `lijstdelen.js`.
   - Regels: alleen verbonden leden; de lezer kan niet wijzigen.
   - Wanneer iemand iets hoort: een DM met de lijst.
   - Acceptatie: bewezen in het scenario.
   - Stand: bestaat.

3. **Doorgaan waar ik was**
   - Gegevens: de positie per stuk, per lid, in de tijdlijn (`tijdlijn.js`).
   - Regels: eigen data; geen andere kijker ziet het.
   - Rekenwijze: de laatste positie ≥ 10 s vóór het einde; daarna geldt het stuk als "af".
   - Wanneer iemand iets hoort: "verder op 12:40".
   - Acceptatie: op een tweede toestel start het stuk binnen 5 s van de laatste positie.
   - Stand: half. Kosten: klein. Bak: aanbevolen nu.

4. **Profielen per gezinslid met leeftijdsfilter**
   - Gegevens: de gezinsrol van FoundationOS (de gezinsregel van 3d0e386f2), geen kopie.
   - Regels: een kind ziet alleen stukken met een leeftijdslabel op of onder zijn leeftijd. Zonder label is een stuk voor een kind niet zichtbaar.
   - Onzekerheid: het label komt van de maker, niet van RTG; dat staat erbij.
   - Acceptatie: een kind van 10 ziet geen stuk zonder label of met label 16.
   - Stand: ontbreekt. Kosten: middel. Bak: later.
   - → *Voor de integrator:* eigenaar van het leeftijdslabel per stuk (het domein of Media OS?).

5. **Offline bewaren**: als bij Sound, per domein met toestemming van de maker. Stand: ontbreekt. Kosten: middel. Bak: later.

**L2:** een makerprofiel over alle domeinen (`maker`, `werkherkomst`). Stand: bestaat. Genres `creator` en `fotograaf`.

**L3:** een zaakwereld (`zaakwereld.js`) voor een zaak met media. Stand: half. Programmeren voor een zaal hoort bij Podium/Theater. → *Voor de integrator.*

**L4**

6. **Aanbeveling met uitleg**
   - Gegevens: `smaak.js` (de eigen signalen van het lid).
   - Regels: elke aanbeveling zegt waarom ("u volgt X", "op uw lijst Y"); uit te zetten.
   - Onzekerheid: een aanbeveling is een voorstel en nooit een volgorde op populariteit.
   - Acceptatie: bij elke aanbeveling staat een reden; met smaak uit verdwijnen de aanbevelingen.
   - Stand: half. Kosten: klein. Bak: aanbevolen nu.

**L5:** ontdekken → bewaren → lijst → delen → samen → verwijderen uit de bibliotheek. Bestaat; herstel bewezen.

**L6**
- Ontvangen: uitgaven, video's, clips, livekanalen; `aanwezig` en `momenten` (de momentproef).
- Uitgegeven: verwijzingen in lijsten en DM's, de stuurfunctie naar de schil.
- Buiten de eigen apps:
  - Horeca-events/festival (`horeca.events`, `festival.crewdashboard`): een programma met media van makers. Verwijzing, geen kopie.
  - FoundationOS magazine (`media.magazine`).

**Eerlijke melding per domein**
- Gegevens: `leeg.js`.
- Regels: valt een domein weg, dan blijven de andere standen werken en zegt de stand "Theater is nu niet bereikbaar".
- Acceptatie: met Theater uit werken MUZIEK en FLOW, en KIJK toont de melding.
- Stand: half. Kosten: klein. Bak: aanbevolen nu.

#### e. RTG-exclusief

- **Eén mediawereld zonder data-eigendom:** vier domeinen, één volgknop, nul kopieën.
- **Samen kijken en luisteren met codenamen**, zonder telefoonnummer.
- **Herkomst die vastligt** waar ze beweerd wordt (`werkherkomst.js`).

#### f. Bouwstenen en ontbrekende koppelingen

- **Bestaat:** de hele `server/kern/mediaos/`, de clipdeler, Samen.
- **Ontbreekt:**
  - de positie per stuk in de tijdlijn;
  - de uitleg in smaak;
  - de melding per domein;
  - het leeftijdslabel en de koppeling met de gezinsregel;
  - de 5 onbedienbare knoppen (nulmeting).

#### g. Prioritering

1. Melding per domein: klein.
2. Doorgaan waar ik was: klein.
3. Uitleg bij aanbeveling: klein.
4. Onbedienbare knoppen: klein; nodig voor bewijs bedienbaar.
5. Leeftijdsfilter: middel; hangt aan het besluit over het label.
6. Offline: middel; hangt aan een rechtenbesluit.

#### h. Eindcontract

| Dimensie | Meetbaar criterium |
|---|---|
| Breedte | Ontdekken, bewaren, lijst, delen, samen, verder kijken, elk getoetst |
| Professionele diepte | Een maker ziet zijn werk over vier domeinen op één profiel, met herkomst |
| Levenscyclus | Bewaren → lijst → delen → intrekken van delen → verwijderen, met toetsen |
| Samenwerking en rollen | Een lezer kan niet wijzigen (bewezen); een kind ziet alleen wat bij zijn leeftijd past |
| Domeinintelligentie | Elke aanbeveling draagt een reden; met smaak uit verdwijnen ze |
| Los functioneren | Met één domein uit werken de andere standen, met een melding (toets) |
| RTG-ketens | Een volgknop in Media OS schrijft in de volgerslijst van het domein (toets op het domein) |
| Bewezen betrouwbaarheid | De acht APPWERKT-bewijzen BEWEZEN, inclusief bedienbaar zonder onbedienbare knoppen |

#### Twee uitkomsten

**Deel A — bouwbaar binnen de huidige architectuur en scope.** In de volgorde van g:
1. melding per domein;
2. doorgaan waar ik was;
3. uitleg bij aanbeveling;
4. onbedienbare knoppen;
5. leeftijdsfilter, via de gezinsregel;
6. offline.

**Deel B — het domeinmaximum: nieuwe professionele processen.**

**B1. Programmering van een eigen zender of zaal (zaak, festival, foundation).**
- Gegevens: een programma (tijdvakken met stukken uit de vier domeinen, als verwijzingen), het publiek (iedereen, leden, een besloten kring) en de rechtenstatus per stuk.
- Regels:
  - alleen stukken waarvan de maker "mag in een programma" aanzette;
  - een stuk zonder rechtenstatus voor openbare vertoning kan niet in een publiek programma;
  - een programma is eindig en heeft een einde.
- Rekenwijze: per tijdvak is de duur gelijk aan de som van de stukken; een overloop wordt gemeld.
- Wanneer iemand iets hoort: de maker, als zijn stuk wordt geprogrammeerd; het publiek bij de start (alleen wie volgt of zich aanmeldde).
- Rollen: programmeur (zaak of foundation), maker (toestemming).
- Uitzonderingen: de maker trekt in; het stuk valt uit het programma en het tijdvak toont dat.
- Acceptatie: een programma met een ingetrokken stuk toont "niet meer beschikbaar" op dat tijdvak, en de rest loopt door.

**B2. Bereik zonder volgorde (makeroverzicht).**
- Gegevens: hoeveel leden een stuk bewaarden, in een lijst zetten of samen keken, per stuk en per periode. Geen namen, tenzij een lid volgt en dat toestaat.
- Regels:
  - geen ranglijst tussen makers;
  - alleen eigen cijfers;
  - onder de 18 alleen voor de maker zelf, nooit vergelijkend.
- Rekenwijze: tellingen per week; bij minder dan 5 leden staat er "minder dan 5" (privacydrempel).
- Acceptatie: een maker ziet zijn eigen tellingen met drempel, en geen enkele vergelijking met anderen.

**B3. Leeftijdslabels en een keuringsproces.**
- Gegevens: een label per stuk, door de maker opgegeven volgens een vaste schaal (bijvoorbeeld AL/6/9/12/14/16/18, de schaal van de Nederlandse classificatie als BRON, niet als partner).
- Regels:
  - zonder label niet zichtbaar voor kinderen;
  - een melding dat een label te laag is, gaat naar een mens van het kantoor;
  - dat besluit wint van de maker.
- Wanneer iemand iets hoort: de maker, bij een gewijzigd label.
- Rollen: maker, melder, keurder (kantoor).
- Acceptatie: een stuk dat het kantoor naar 16 zette, is voor een kind van 12 niet meer zichtbaar.

**Modus LOS:** zonder domeinen is Media OS leeg en zegt het dat (`leeg.js`). Valt één domein weg, dan blijven de andere werken. Niet gemeten per stand.

**Modus SAMEN:** Media OS is de samenkomst. Het geeft alleen verwijzingen uit en ontvangt elke rij uit het domein. Rahul "open media" en Heel RTG.

**Gebruikersketen**
1. A hoort in FLOW een clip met muziek.
2. A tikt door naar het hele stuk (MUZIEK).
3. A volgt de maker.
4. A zet het stuk in een lijst.
5. A deelt de lijst met vriend B.
6. A en B kijken samen.

Storingen:
- B is geen vriend: 403 met de reden (bewezen).
- Klankwerk is uit: MUZIEK zegt het, FLOW werkt.
- Een crash bij de lijst: één lijst (bewezen).
- B's toestel valt van het net: A blijft spelen, B gaat verder waar A is.

**Vraagt besluit:** het leeftijdslabel (eigenaar); offline per domein.

**Extern:** geen.

---

### Tweede scherm (link:tweedescherm, /apps/scherm.html, werkrol zaak)

**Eigenaar:** `horeca.tweedescherm`. Bij horeca horen ook `horeca.keuken` (apps/horeca-expeditie.html), `horeca.bar`, `horeca.dashboard` en `horeca.events`.

#### a. Inventaris

| Bewijs | Register (nulmeting, nog persona lid) | Lokaal gemeten |
|---|---|---|
| bereikbaar | BEWEZEN (gemeten als lid; sinds de werkrol zaak hoort persona zaak) | – |
| bedienbaar | BEWEZEN: 1 van 1 | – |
| menselijk | NIET_GETEST | sluit 3/3 |
| voltooibaar | GEEN_FIXTURE | sluit 6/6 (voltooi/tweedescherm.js, KANTOORWERELD); bevoegd: anoniem 401, een lid 401, een andere zaak verandert de kassa niet |
| waarheidsgetrouw | BEWEZEN: 8 gelogen | – |
| persistent | GEEN_FIXTURE | sluit 3/3 |
| bevoegd | NIET_GETEST: /api/supplier/state niet in IDOR.json | bevoegdstappen in het scenario |
| herstelbaar | GEEN_FIXTURE | sluit 3/3 (over de lezing; het scherm schrijft niets) |

Gebouwd:
- Eén eigen route: `/api/supplier/state`.
- Spiegelen via BroadcastChannel (alleen op hetzelfde toestel).
- Standen keuken, bar, kassa en kamers, elk met eigen capabilities.

#### b. Marktvergelijking

| Marktleider | Wat het pakket biedt | Bron, peildatum 2026-10-19 | Wij |
|---|---|---|---|
| Toast KDS | Bonnen per station, kleurcodes op wachttijd, bon klaar, doorsturen naar de pas | [Merchant Maverick](https://www.merchantmaverick.com/toast-pricing-guide), [UpMenu](https://www.upmenu.com/blog/toast-pricing) [derde bron]; software ca. $25–35/mnd, scherm $599–1.199 | half: tonen ja; bon klaar, wachttijd en doorsturen nee |
| Fresh KDS (Advanced) | Meerdere schermen, routering per station, rapportage over bereidingstijd | [Square help](https://squareup.com/help/au/article/5392), [Fit Small Business](https://fitsmallbusiness.com/best-kitchen-display-systems/) [derde bron]; $15–89/mnd | nee: geen routering, geen rapportage |

#### c. Het volledige domein

- **Horeca-praktijk:**
  - de keuken werkt met een bon per gang en per station (koud, warm, pass);
  - "fire" per gang;
  - allergenen op de bon (EU-verordening 1169/2011 over voedselinformatie; vakpraktijk);
  - wachttijd zichtbaar voor de chef.
  - De bar ziet drank; de pass ziet wat compleet is; de bediening hoort "klaar".
  - Het hotel ziet de kamerstand (schoonmaak, vrij).
  - Na afloop: bereidingstijden per gerecht voor de planning.
- **Organisatorisch:** meerdere schermen per zaak, rechten per station, een HACCP-koppeling (`horeca.haccp`).

#### d. Functiecatalogus

**L3 Organisatorisch**

1. **Bon per station**
   - Gegevens: bestellingen uit de horeca-kern (`/api/supplier/horeca/*`, eigenaar `horeca.keuken`).
   - Regels: elk scherm toont alleen de regels van zijn station (koud, warm, bar).
   - Rollen: werkrol zaak, en straks per personeelsrol.
   - Acceptatie: het barscherm toont geen gerecht en het keukenscherm geen drank.
   - Stand: half (keuken/bar-standen). Kosten: klein. Bak: aanbevolen nu.

2. **Allergenen op de bon**
   - Gegevens: allergenen per gerecht uit de kaart van de zaak.
   - Regels: altijd zichtbaar, nooit in te klappen.
   - Onzekerheid: de zaak voert ze in; RTG controleert de recepten niet en zegt dat.
   - Acceptatie: een bon met een notengerecht toont "noten" bovenaan, groot.
   - Stand: niet gemeten. → *Voor de integrator:* staan allergenen al in de horecakaart?
   - Kosten: klein. Bak: aanbevolen nu (zodra de bron bekend is).

**L5 Levenscyclus**

3. **Bon klaar op het scherm zelf**
   - Gegevens: de bonstatus in de horeca-kern, niet in het scherm.
   - Regels: één schrijfhandeling met een herhaalsleutel; dezelfde route als de horeca-app.
   - Wanneer iemand iets hoort: de bediening en de pass horen "klaar".
   - Rollen: personeel met de keukenrol.
   - Uitzonderingen: een bon die al klaar is, kan niet nog eens.
   - Acceptatie: een dubbele tik zet de bon één keer op klaar; na een crash blijft hij klaar.
   - Stand: ontbreekt. Kosten: middel. Bak: aanbevolen nu. → *Vraagt besluit:* mag het tweede scherm schrijven?

4. **Stand bij netwerkverlies**
   - Regels: het scherm laat zien hoe oud zijn stand is.
   - Rekenwijze: nu min laatste antwoord.
   - Wanneer iemand iets hoort: na 30 s zonder antwoord "verbinding weg sinds …".
   - Acceptatie: zonder netwerk toont het scherm binnen 35 s de melding en de laatste stand.
   - Stand: ontbreekt. Kosten: klein. Bak: aanbevolen nu.

**L4 Domeinintelligentie**

5. **Wachttijd per bon**
   - Gegevens: tijdstip van bestellen.
   - Rekenwijze: nu min besteltijd; oranje boven de streefwaarde van de zaak, rood boven twee keer die waarde.
   - Onzekerheid: geen voor wachttijd. Een voorspelde bereidingstijd heet "verwachting", nooit een feit.
   - Acceptatie: een bon boven de streefwaarde kleurt oranje.
   - Stand: ontbreekt. Kosten: klein. Bak: aanbevolen nu (zonder voorspelling); voorspelling later via de stuurlaag.

**L6:** leest de zaakstand; gevonden alleen door de werkrol zaak (Heel RTG en de gids, 4074a194d). Buiten de eigen apps: festival-crew (`festival.crewdashboard`) kan hetzelfde scherm gebruiken voor een bar op een event. → *Voor de integrator.*

#### e. RTG-exclusief

- **Bestelling en scherm in één keten:** de gast bestelt aan tafel (`horeca.tafelgast`), en de bon staat op het scherm zonder koppelsoftware.
- **Zaak-eigen data, nul toegang voor andere zaken** (bewezen).

#### f. Bouwstenen en ontbrekende koppelingen

- **Bestaat:** `scherm.html`, `/api/supplier/state`, de horeca-kern, de herhaalsleutelregel.
- **Ontbreekt:**
  - het filter per station;
  - de schrijfroute "klaar";
  - de ouderdom van de stand;
  - de wachttijd;
  - de bron van allergenen (niet gemeten).

#### g. Prioritering

1. Ouderdom van de stand: klein.
2. Wachttijd: klein.
3. Filter per station: klein.
4. Allergenen: klein; hangt aan de bron.
5. Bon klaar: middel; hangt aan het besluit over schrijven.

#### h. Eindcontract

| Dimensie | Meetbaar criterium |
|---|---|
| Breedte | Keuken, bar, kassa en kamers, elk met eigen stand en toets |
| Professionele diepte | Per station alleen de eigen regels; allergenen altijd zichtbaar |
| Levenscyclus | Bestelling → op het scherm → klaar → bediening hoort het, met herhaalsleutel |
| Samenwerking en rollen | Alleen de werkrol zaak ziet het (bewezen); een andere zaak ziet niets (bewezen) |
| Domeinintelligentie | De wachttijd is gemeten; een voorspelling heet "verwachting" |
| Los functioneren | Zonder hoofd-app leest het scherm zelf; zonder netwerk toont het de ouderdom |
| RTG-ketens | Een bestelling aan tafel staat binnen 5 s op het keukenscherm (toets) |
| Bewezen betrouwbaarheid | De acht APPWERKT-bewijzen BEWEZEN met persona zaak |

#### Twee uitkomsten

**Deel A — bouwbaar binnen de huidige architectuur en scope.** In de volgorde van g:
1. ouderdom van de stand;
2. wachttijd;
3. filter per station;
4. allergenen, zodra de bron er is;
5. bon klaar, zodra het schrijfbesluit er is.

**Deel B — het domeinmaximum: nieuwe professionele processen.**

**B1. Keukensturing per gang.**
- Gegevens: bonnen met gangen (voor, hoofd, na), stations per gerecht, de "fire"-opdracht van de pass.
- Regels:
  - een gang start pas op het keukenscherm na "fire";
  - de pass ziet per tafel welke gang compleet is.
- Rekenwijze: per gerecht een streeftijd (een instelling van de zaak); de compleetheid per tafel is het aantal gerechten klaar gedeeld door het totaal.
- Onzekerheid: de streeftijden zijn een instelling.
- Wanneer iemand iets hoort: de pass, als een gang compleet is; de bediening, als de tafel kan worden uitgeserveerd.
- Rollen: chef (pass), kok (station), bediening.
- Uitzonderingen: een allergiebon gaat altijd apart en kan niet worden samengevoegd.
- Acceptatie: zonder "fire" verschijnt het hoofdgerecht niet op het warme station, en met "fire" binnen 5 s.

**B2. Bereidingsanalyse en planning.**
- Gegevens: van elke bon de tijden "verschenen" en "klaar".
- Regels: alleen voor de zaak zelf, nooit vergeleken met andere zaken.
- Rekenwijze:
  - per gerecht de mediaan en het 90e percentiel van de bereidingstijd per weekdag en uur;
  - een voorspelling voor de bezetting heet "verwachting".
- Onzekerheid: minder dan 20 metingen geeft "te weinig gegevens".
- Wanneer iemand iets hoort: de chef, wekelijks.
- Rollen: chef, beheer.
- Acceptatie: na 20 bonnen van een gerecht staat er een mediaan, daarvoor "te weinig gegevens".

**B3. HACCP-koppeling.**
- Gegevens: temperatuurregistraties (`horeca.haccp`, een bestaand eigen scherm).
- Regels:
  - een registratie die over tijd is, verschijnt op het keukenscherm;
  - het tweede scherm toont het, maar registreert het niet.
- Wanneer iemand iets hoort: de keuken, bij overschrijding.
- Rollen: verantwoordelijke HACCP.
- Acceptatie: een gemiste koelcelmeting verschijnt binnen een minuut op het keukenscherm.
- Eigenaar: `horeca.haccp`. Het tweede scherm geeft alleen weer.

**Modus LOS:** het scherm werkt zonder de hoofd-app. Zonder zaaksessie zegt het "Log eerst in op de leverancier-app". Zonder netwerk zegt het nog niets: te bouwen.

**Modus SAMEN:** tafel → horeca-kern → keukenscherm → bediening. De kassa telt de dag. Gevonden via Heel RTG (werkrol zaak).

**Gebruikersketen**
1. Een gast bestelt aan tafel.
2. De keuken ziet de bon met de allergenen.
3. De kok tikt klaar.
4. De bediening hoort het.
5. De kassa telt.

Storingen:
- Het netwerk valt weg: het scherm toont "verbinding weg sinds …" en de laatste stand.
- Een dubbele tik op klaar: één keer (te bouwen met de herhaalsleutel).
- Een lid opent het scherm: 401 (bewezen).
- Een andere zaak probeert het: niets (bewezen).

**Vraagt besluit:** mag het tweede scherm schrijven; persona zaak in de APPWERKT-rij (volgt uit 87e05f878 bij de volgende meetronde).

**Extern:** hardware (scherm, montage) per zaak.

---

### Voor de integrator (alle vier)

1. Moet Klankwerk (`media.muziek-maken`) een eigen APPWERKT-rij krijgen, of is het een stand van link:muziek?
2. Een genre muzikant/label/studio in `server/seed/genres.js`: dat vraagt een besluit.
3. Is een band of collectief een organisatie (WorkOS/concern) of een kring (sociaal)?
4. Wie is eigenaar van het leeftijdslabel per stuk: het domein of Media OS? Dit hangt aan de gezinsregel.
5. Een videokanaal van een zaak hoort bij `zaak.redactie`, niet als tweede redactielogica in Clips.
6. Wie is eigenaar van de momenten in Reizen, zodat Clips daar alleen een verwijzing geeft?
7. Een "muziek in de zaak"-verklaring bij `horeca.events`, met Buma- en Sena-afdracht: melden, niet regelen.
8. Staan allergenen al in de horecakaart, en mag het tweede scherm schrijven?
9. De registers zijn de nulmeting. Pas een centrale meetronde maakt de lokaal gesloten scenario's tot bewijs.


---

## Sociaal (LivingOS-B)

Domeinkaarten volgens `premiumformat.md`, inclusief de aanscherping en de drie aanvullingen: vier
onderzoeken per app, per app de onderdelen a tot en met h, en per app twee uitkomsten (A: binnen de huidige scope, onder d; B: het domeinmaximum, een eigen blok). Er wordt niets gebouwd.

### Gedeelde bronnen en meetstand

**Meetstand van de registers in deze checkout**
- `APPWERKT.json` heeft stempel `af81b538` van 2026-10-19 05:16.
- De voltooiscenario's voor sociaal, salon en snaps kwamen later: 7ca3e95c4, e664862d5 en 0eb0a9084.
- Hun APPWERKT-rij staat daarom nog op GEEN_FIXTURE of NIET_GETEST, terwijl het scenario lokaal sluit (gedraaid met `node scripts/voltooiproef.js --alleen=<naam>`).
- Waar ik "lokaal gesloten" schrijf, is dat zo gedraaid. Een vers register maakt alleen de integrator.

**Marktbronnen, peildatum 2026-10-19**
- Het meeste komt uit secundaire bronnen. Officiële prijspagina's waren niet op te halen: help.x.com gaf geen DNS, en de pagina's van Snapchat en Meta stonden niet in de zoekresultaten.
- Alles wat hieronder geen officiële bron heeft, is **niet officieel geverifieerd**.
- Merknamen zijn alleen marktreferentie, nooit partner.

| Code | Bron | Wat |
|---|---|---|
| M1 | https://techcrunch.com/2026/02/18/snapchat-tops-25m-subscribers-driving-companys-direct-revenue-arr-to-1b/ · https://unil.ink/blog/snapchat-plus-features | Snapchat+ ca. $3,99 per maand. Platinum (duurste) ca. $15,99 per maand: advertentievrij, 5 TB opslag. Functies: Story Timer (1 uur tot 1 week), aantal herbekijkingen, Pin a BFF, streak-emoji's, badge |
| M2 | https://metricool.com/twitter-blue/ · https://www.igeeksblog.com/what-is-x-premium/ (officieel: https://help.x.com/en/using-x/x-premium, onbereikbaar) | X Basic ca. $3, Premium ca. $8, Premium+ (duurste) ca. $40 per maand. Functies: bewerken binnen 1 uur, berichten tot 25.000 tekens, bladwijzermappen, voorrang voor antwoorden, minder of geen advertenties, Articles |
| M3 | https://about.fb.com/news/2026/09/introducing-meta-one-subscription-service-more-features-ai/ (officieel persbericht) · https://metricool.com/meta-one-subscription/ | Meta One. **Advanced (duurste), $49,99 per maand per profiel:** stories 30 dagen vooruit inplannen, links in posts, analyses exporteren, teamtoegang zonder wachtwoord, melding als je werk wordt hergepost (bronvermelding vragen). Verder zichtbaarheid kopen in feed en zoeken |
| M4 | https://www.unilink.us/blog/discord-nitro-features-2026 · https://toolradar.com/tools/discord/pricing | Discord Nitro Basic $2,99 en Nitro $9,99 per maand; server boosts ca. $4,99 per stuk. Functies: grotere uploads, profiel per server, hogere streamkwaliteit |
| M5 | https://schoolmaker.com/blog/circle-so-pricing · https://cartmango.com/circle-so-pricing/ | Community-platform voor organisaties. Professional ca. $89, Business ca. $199, Enterprise ca. $419 tot $499 per maand. "Plus" met eigen apps op maat. Functies: rollen, moderatie, betaalde lidmaatschappen, analyses, e-mail |
| M6 | https://www.commonsense.org/education/reviews/kialo-edu | Argumentkaart-platform, gratis. Stelling met pro en contra in een boom, besloten per groep |

**Domeinbronnen (bron, nooit partner)**

| Code | Bron | Wat |
|---|---|---|
| D1 | Digital Services Act (Verordening (EU) 2022/2065), samengevat via https://trust.doctena.com/dsa en https://www.taskus.com/insights/dsa-internal-complaint-handling-system/ | Art. 16 meldingsprocedure; art. 17 motivering van een beperking (feiten, of het geautomatiseerd ging, rechtsmiddel); art. 20 gratis intern klachtensysteem, niet volledig geautomatiseerd; art. 21 buitengerechtelijke geschilbeslechting. De Bundesnetzagentur noemt art. 16, 17 en 20 haar handhavingsfocus (https://bundesnetzagentur.de/SharedDocs/Pressemitteilungen/EN/2026/20260430_TB_DSC.html). Artikelnummers zijn niet tegen het Publicatieblad gecontroleerd |
| D2 | Code voor Kinderrechten (BZK, Leiden eLaw en Waag, 2021): https://www.universiteitleiden.nl/nieuws/2021/03/code-voor-kinderrechten-ontwerpen-in-het-belang-van-het-kind | Tien ontwerpprincipes, met het belang van het kind voorop. Niet afdwingbaar, wel onderschreven door de ACM |
| D3 | AVG art. 8 en UAVG art. 5, via https://www.legiscope.com/blog/uavg-uitvoeringswet-avg.html | In Nederland 16 jaar voor toestemming voor een informatiedienst; daaronder ouderlijke toestemming. Secundaire bron |
| D4 | Beroepspraktijk community-management en moderatie | Huisregels vooraf, escalatieladder (verbergen, waarschuwen, schorsen), vier ogen bij zware sancties, transparantierapport. Afgeleid uit D1 en M5. Er is geen enkele norm die ik hier kon verifiëren |

---

### Sociaal (link:sociaal, /apps/sociaal.html)

**a. Inventaris van het bewezen bestaande**

| Bewijs | Stand in APPWERKT (af81b538) | Werkelijkheid nu |
|---|---|---|
| bereikbaar | BEWEZEN | – |
| bedienbaar | BEWEZEN (3/3 eigen knoppen) | – |
| menselijk | NIET_GETEST | lokaal 3/3 gesloten in de voltooiproef |
| voltooibaar | GEEN_FIXTURE | scenario `scripts/lib/voltooi/sociaal.js` lokaal 8/8 (7ca3e95c4) |
| waarheidsgetrouw | BEWEZEN | – |
| persistent | GEEN_FIXTURE | lokaal 3/3 |
| bevoegd | NIET_GETEST (12 van 13 routes niet in IDOR) | in het scenario: anoniem 401, buiten het genootschap 404 |
| herstelbaar | GEEN_FIXTURE | lokaal 3/3 |

- Routes in `server/routes/sociaal.js`: wereld, lijn, object, object/pagina, command, voorstel/bevestig, graaf, actielog, beleid, beleid/zet en rahul. Daarnaast `/api/comm/inbox` en `/api/stream`.
- De kern is alleen-lezen. `test/socialegraaf.test.js` zakt zodra er een schrijffunctie bijkomt.
- Toetsen: `sociaal-index.test`, `sociaal-edge.e2e`.
- Eigenaar: `sociaal.leven`. Er staat een open oordeel met `apps/wereld.html` (`sociaal.alles`).

**b. Marktvergelijking**
- Geen marktleider verkoopt "overzicht van je kring" als los product. Het zit in de gratis laag van de grote netwerken.
- Wat betaald wordt, en hoe RTG ervoor staat:
  - **Advertentievrij** (M1 Platinum, M2 Premium+). RTG heeft geen advertenties: **bestaat**.
  - **Inplannen en teamtoegang** (M3 Advanced). Dat hoort bij het plaatsen (Salon, Pulse), niet hier.
  - **Organisatie-community** (M5): rollen, moderatie, analyses. Bij RTG zit dat in Genootschap (`sociaal.genootschap`), niet in Sociaal.

**c. Het volledige domein**
- **Particulier:** de kring overzien, weten wat op je wacht (uitnodigingen, verjaardagen, antwoorden), en beslissen zonder overspoeld te worden.
- **Professioneel:** een concierge of gastheer die een kring bedient, of een community-manager van een vereniging. Die werken met een wachtrij van open verzoeken, een antwoordtermijn en een verantwoording achteraf (D4). In RTG zitten die rollen in Genootschap en Concierge, niet in Sociaal.
- **Organisatorisch:** een vereniging of club wil zien wie niet reageerde en wie herinnerd moet worden, zonder spam. Moderatieplichten (D1) liggen bij de app waar de inhoud staat.
- **Discussie:** debatleiders werken met een stelling, sprekersvolgorde, spreektijd, bronvermelding en een samenvatting van argumenten (M6). De Discussiekamer is hieronder uitgewerkt als verdieping binnen Sociaal. Oorspronkelijke aantekening:
  - Debatleiders werken met een stelling, sprekersvolgorde, spreektijd, bronvermelding en een samenvatting van argumenten (M6).
  - Binnen Sociaal bestaat daar niets voor. Het hoort niet als nieuw domein vóór V1; zie "Vraagt besluit".

**d. Functiecatalogus: uitkomst A (binnen de huidige architectuur en scope)**

**S1 · Wat wacht er op mij, over alle sociale apps** — L6 · bestaat · –
- *Gegevens:* projecties uit Berichten (`comm.berichten`), Genootschap, Pulse, Salon en Vonk via `/api/sociaal/graaf`.
- *Regels:* alleen lezen; elke rij draagt zijn bron-app.
- *Melding:* geen eigen push, want die doet de bron-app.
- *Rollen:* het lid zelf.
- *Acceptatie:* een open uitnodiging uit Genootschap staat in de rij, en een tik opent Genootschap op die uitnodiging.

**S2 · Rahul zet klaar, de mens bevestigt** — L4 · bestaat · –
- *Gegevens:* het open object in de kring.
- *Regels:* een voorstel is nooit een handeling. In het weekend zet Rahul met opzet niets klaar.
- *Onzekerheid:* het voorstel draagt "voorstel" en geen stand.
- *Acceptatie:* zonder tik ziet de ander niets; na de tik ziet hij het antwoord. Bewezen.

**S3 · Bevestiging terugdraaien** — L5 · ontbreekt · klein · **aanbevolen nu**
- *Gegevens:* het bevestigde voorstel en zijn actielogregel.
- *Regels:* binnen 10 seconden na bevestigen terug te draaien, alleen door wie bevestigde. Daarna gaat het via de bron-app (afzeggen in Genootschap).
- *Rekenwijze:* het tijdstip van de actielogregel plus 10 s.
- *Melding:* de ander krijgt pas na het venster een seintje.
- *Uitzondering:* een betaalde of extern bevestigde handeling kan niet terug.
- *Acceptatie:* een lid tikt "bevestig" en daarna "ongedaan maken" binnen 10 s. De gastheer ziet niets, en het actielog toont beide regels.

**S4 · Eén overzicht van de kring in het menu** — L6 · half · klein · **aanbevolen nu (besluit)**
- *Regels:* er is één eigenaar, en de ander wordt een projectie of verdwijnt uit het menu. Dat volgt uit het open oordeel in SCHERMEIGENAAR.
- *Acceptatie:* het menu toont één ingang "Sociaal". Een tweede ingang heet anders en zegt wat hij anders doet.

**S5 · Herinneringsritme voor een kring** — L3 · ontbreekt · middel · later
- *Gegevens:* open uitnodigingen in Genootschap, met hun termijn.
- *Regels:* hoogstens één herinnering per uitnodiging, door de gastheer en niet door het systeem.
- *Rekenwijze:* `termijn − 48 uur`.
- *Melding:* de gastheer ziet "3 van 8 hebben nog niet gereageerd", en kiest zelf of hij herinnert.
- *Uitzondering:* geen herinnering aan wie de gastheer blokkeerde.
- *Acceptatie:* een gastheer stuurt één herinnering; een tweede tik zegt "al herinnerd".
- *Afhankelijk van:* Genootschap, de eigenaar. De bouw hoort daar.

**S6 · Kringbeleid** — L1 · bestaat · –
- *Acceptatie:* wie "geen voorstellen van onbekenden" kiest, krijgt die niet. Dat gaat via `/api/sociaal/beleid`.

**S7 · Advertentievrij** — L1 · bestaat · –
- *Acceptatie:* geen enkel scherm toont gesponsorde inhoud.

**e. RTG-exclusief**
- **Een agent die klaarzet maar nooit handelt**, met een actielog dat het lid kan nalezen.
- **Een kring die over apps heen gaat zonder gedeelde database:** projecties met bronvermelding en zonder kopie.

**f. Bouwstenen en ontbrekende koppelingen**
- Bestaat: de graaf, het actielog, het beleid, de klaarzetfunctie van Rahul en de schil-contextbus (`public/shared/rtg-schil.js`).
- Ontbreekt:
  - een terugdraaiknop (S3);
  - een storingsmelding per bron: faalt `/api/comm/inbox`, dan zegt het scherm dat in woorden. Niet gemeten.

**g. Prioritering**

| Prioriteit | Functie | Kosten |
|---|---|---|
| 1 | S4 (besluit) | klein |
| 2 | S3 | klein |
| 3 | storingsmelding per bron | klein |
| 4 | S5, via Genootschap | middel |

**h. Toetsbaar eindcontract**

| Dimensie | Criterium |
|---|---|
| Breedte | alle vijf sociale bronnen staan in de graaf, elk met een tik naar de bron |
| Professionele diepte | n.v.t.; zit in Genootschap. Het criterium is dat Sociaal de wachtrij van de gastheer kan tonen |
| Levenscyclus | klaarzetten, bevestigen en terugdraaien (S3) bewezen in de voltooiproef |
| Samenwerking en rollen | de bevestiging van B handelt alleen voor B (bewezen) |
| Domeinintelligentie | 0 handelingen zonder tik, gemeten over het actielog |
| Los functioneren | met één bron uit blijven de andere rijen staan, met een melding in woorden (nieuwe e2e) |
| RTG-ketens | de keten Genootschap → Sociaal → Genootschap is bewezen |
| Bewezen betrouwbaarheid | de acht APPWERKT-bewijzen BEWEZEN op een vers register. Bevoegd vraagt de routes in IDOR |

#### Discussiekamer (verdieping binnen Sociaal, akkoord van de eigenaar)

**Plaats**
- De Discussiekamer is een **verdieping binnen Sociaal** en wordt geen nieuwe app.
- Het object "kamer" hoort bij `sociaal.leven`.
- Twee dingen blijven bij hun eigen eigenaar en worden alleen verwezen, nooit gekopieerd:
  - de deelnemerskring (wie mag meedoen): Genootschap (`sociaal.genootschap`) of de eigen kring;
  - een besluit met maatschappelijk gevolg: DemocratieOS (`democratie.kwestie`). Een Discussiekamer stelt hooguit een **inbreng** voor een kwestie op.
- Opslag: een eigen collectie `discussiekamers` binnen de bestaande kv-opslag (`server/db`). Geen nieuwe database en geen nieuwe motor.

##### Variant 1: menselijke discussie

**DK1 · Kamer openen met stelling en huisregels** — L1/L3 · ontbreekt · middel · aanbevolen nu
- *Gegevens:*
  - stelling (≤ 280 tekens);
  - toelichting;
  - huisregels (keuze uit een vaste set plus vrije tekst);
  - publiek: kring, genootschap of uitnodiging;
  - start- en eindtijd;
  - moderator(en): codenamen.
- *Regels:*
  - de opener is moderator tot hij een ander aanwijst;
  - een kamer voor een genootschap kan alleen geopend worden door wie daar beheerder is (de genootschapsrol is de bron);
  - de stelling gaat langs de 9+-keuring (`kern/veilig.js`).
- *Rekenwijze:* een kamer is open tussen start en eind; daarna alleen-lezen.
- *Melding:* genodigden krijgen één uitnodiging via Sociaal/Berichten, geen herhaling.
- *Rollen en toestemming:* opener, moderator, deelnemer, lezer. Deelnemen vraagt toestemming in de kamer; meelezen vraagt alleen het publiek.
- *Uitzondering:* onder 16 alleen in kamers van de eigen klas of het eigen gezin (D3); geen open kamers.
- *Acceptatie:*
  - een lid opent een kamer voor zijn kring met stelling en eindtijd;
  - een kringlid ziet hem en doet mee;
  - een buitenstaander krijgt 404;
  - na de eindtijd is de kamer alleen-lezen.

**DK2 · Argumentkaart** — L4 · ontbreekt · middel · aanbevolen nu
- *Gegevens:* elke bijdrage is een **knoop** met:
  - soort: voor, tegen, vraag of bron;
  - ouder (de knoop waarop hij reageert);
  - tekst (≤ 600 tekens);
  - auteur (codenaam);
  - bronnen (0..n verwijzingen, zie DK3).
- *Regels:*
  - elke knoop hangt aan precies één ouder; de wortel is de stelling;
  - "voor" en "tegen" zijn relatief aan de ouder;
  - een moderator kan een knoop verplaatsen (mét regel in het verslag), maar de tekst niet wijzigen;
  - de auteur kan zijn knoop binnen 10 minuten bewerken; met versies, zoals Pulse.
- *Rekenwijze:* de kaart is een boom. Per knoop tellen we kinderen voor en tegen. **Er is geen winnaar en geen score:** de telling zegt hoeveel argumenten er zijn, niet wie gelijk heeft.
- *Onzekerheid:* een telling is geen oordeel. Het scherm zegt dat letterlijk.
- *Melding:* de auteur van een knoop hoort het als iemand er direct op reageert. Gebundeld, hoogstens één keer per uur.
- *Rollen:* deelnemer plaatst, moderator ordent, lezer leest.
- *Uitzondering:* een knoop zonder ouder wordt geweigerd ("Waar reageert u op?").
- *Acceptatie:*
  - A plaatst een tegenargument onder de stelling, en B een bron onder dat tegenargument;
  - de kaart toont de boom;
  - een verplaatsing door de moderator staat in het verslag;
  - nergens staat een winnaar.

**DK3 · Broncontrole** — L4 · ontbreekt · middel · aanbevolen nu
- *Gegevens:* een bron is:
  - een URL, met titel en datum zoals de deelnemer die invult;
  - of een verwijzing naar een RTG-object: een Krant-artikel (`media.krant`), een kwestie (`democratie.kwestie`) of een document van het lid zelf.
- *Regels:*
  - RTG **beoordeelt de inhoud niet en doet niet alsof**. Dat volgt dezelfde lijn als "wij bellen het BIG-register niet" in AGENTS.md.
  - De controle is formeel:
    - is de URL bereikbaar;
    - ondersteunt de geciteerde zin de bron letterlijk (een tekstvergelijking die de deelnemer zelf plakt);
    - hoe oud is de bron.
  - Een moderator kan een bron markeren als "betwist", met reden.
- *Rekenwijze:* stand per bron: `bereikbaar` / `niet bereikbaar` / `citaat gevonden` / `citaat niet gevonden` / `betwist door moderator`. Het bereikbaar-zijn wordt alleen gecontroleerd op een uitgaande verbinding die het huis toestaat. Zonder netwerk: `niet gecontroleerd`.
- *Onzekerheid:* "citaat gevonden" betekent niet "waar". Het scherm zegt: "de zin staat in de bron; of de bron klopt, beoordeelt u zelf".
- *Melding:* de auteur hoort het als zijn bron "betwist" wordt, met de reden.
- *Uitzondering:* een bron achter een betaalmuur krijgt "niet gecontroleerd", niet "niet bereikbaar".
- *Acceptatie:*
  - een bron met een geplakt citaat dat letterlijk op de pagina staat, krijgt "citaat gevonden";
  - een gewijzigd citaat krijgt "citaat niet gevonden";
  - zonder netwerk staat er "niet gecontroleerd";
  - nergens staat "waar" of "onwaar".

**DK4 · Moderatie in de kamer** — L3 · ontbreekt · middel · aanbevolen nu
- *Gegevens:* de huisregels uit DK1, meldingen per knoop en moderatiebesluiten.
- *Regels (escalatieladder, D4):*
  1. verbergen met motivering;
  2. waarschuwing aan de deelnemer;
  3. tijdelijk dempen in deze kamer (≤ 24 uur);
  4. uit de kamer zetten. Dat vraagt een tweede moderator, of de opener.

  Verder:
  - elke stap draagt een motivering die de deelnemer ziet (D1 art. 17);
  - de deelnemer kan één keer bezwaar maken bij een andere moderator (D1 art. 20);
  - gaat het over illegale inhoud of onveiligheid, dan gaat het door naar de wachtrij van het kantoor (SA1).
- *Rekenwijze:* een melding van ≥ 3 verschillende deelnemers verbergt een knoop voorlopig. Hetzelfde patroon als `MELD_GRENS`.
- *Melding:* de moderator krijgt een wachtrij met een termijn van 24 uur in een open kamer.
- *Rollen:* moderator, opener, deelnemer, kantoor (bij escalatie).
- *Uitzondering:* een moderator modereert zijn eigen knoop niet. Dat gaat naar een andere moderator.
- *Acceptatie:*
  - een moderator verbergt een knoop met reden, en de auteur ziet de reden;
  - uit de kamer zetten zonder tweede handtekening wordt geweigerd;
  - het bezwaar komt bij een ander;
  - een moderator die zijn eigen knoop wil verbergen, krijgt "dit beslist een andere moderator".

**DK5 · Verslag** — L5 · ontbreekt · middel · aanbevolen nu
- *Gegevens:* de kaart, de moderatiebesluiten en de bronstanden bij het sluiten.
- *Regels:*
  - het verslag bevat: de stelling, de argumenten per tak met auteur-codenaam, de bronnen met hun stand, en de moderatiebesluiten (zonder de verborgen tekst);
  - het verslag wordt vastgelegd met een hashketen (`server/lib/keten.js`, zoals in `kern/democratie/kwestie.js`), zodat een latere wijziging zichtbaar is;
  - een samenvatting door AI mag, maar heet "samenvatting (AI, controleer)", staat naast het verslag en vervangt het nooit.
- *Rekenwijze:* het verslag is deterministisch uit de kaart: dezelfde kaart geeft hetzelfde verslag.
- *Melding:* deelnemers krijgen bij sluiten één bericht met de link.
- *Rollen:* iedereen met leesrecht leest het. Delen buiten het publiek kan alleen de opener, en dan zonder codenamen van anderen tenzij die toestemming gaven.
- *Uitzondering:* een kamer met < 3 deelnemers krijgt geen openbaar verslag.
- *Acceptatie:*
  - bij sluiten verschijnt een verslag met alle argumenten en bronstanden;
  - de hash klopt bij herberekening;
  - een gedeeld verslag toont geen codenamen zonder toestemming.

**DK6 · Inbreng voor een kwestie** — L6 · ontbreekt · klein · later
- *Regels:* de opener kan het verslag als **inbreng** aan een DemocratieOS-kwestie hangen. Het blijft een verwijzing; de kwestie blijft eigenaar van haar besluit.
- *Acceptatie:* de kwestie toont "inbreng: Discussiekamer <stelling>" met een link. Er wordt niets gekopieerd.

##### Variant 2: AI-rollendiscussie (simulatie)

**DK7 · Simulatie openen** — L4 · ontbreekt · middel · aanbevolen nu
- *Gegevens:* stelling; 2 tot 5 rollen, elk met een **perspectief** (bv. "huurder", "verhuurder", "gemeente", "econoom", "jongere"); bronnenset (DK3-bronnen die het lid aanlevert, of RTG-objecten).
- *Regels:*
  - elke rol is een **perspectief, nooit een echte persoon of partij**. Een rolnaam die op een bestaande persoon of politieke partij lijkt, wordt geweigerd: dezelfde keuring als `kern/veilig.js`, plus een lijst van eigennamen uit `server/kern/democratie/partijen.js`;
  - elke bijdrage draagt zichtbaar "SIMULATIE: geen echte mening van een echt persoon";
  - de AI draait **lokaal-eerst** (`LOCAL_AI_URL`). Met `RTG_EXTERNE_AI_UIT=1` nooit extern. Zonder model draait de simulatie niet, en het scherm zegt dat in woorden: geen nepantwoord.
- *Rekenwijze:* per beurt krijgt een rol de stelling, de eerdere beurten en alleen de aangeleverde bronnen. Een bewering zonder bronverwijzing krijgt het label "zonder bron".
- *Onzekerheid:* elke beurt is een voorspelling van wat dat perspectief zou kunnen zeggen, nooit een feit. Het scherm toont dat bij elke beurt.
- *Melding:* geen; het lid kijkt zelf.
- *Rollen:* het lid is regisseur: het start, stopt, vraagt een rol om een tegenargument, en kan elke beurt verwerpen.
- *Uitzondering:*
  - geen simulaties over een specifieke echte persoon;
  - geen simulaties die stemadvies geven;
  - onder 16 alleen in een schoolcontext (`leren.school`) met de leraar als opener.
- *Acceptatie:*
  - een lid start een simulatie met drie rollen, en elke beurt draagt "SIMULATIE" en zijn bronverwijzingen;
  - een rol "Mark R." of een partijnaam wordt geweigerd;
  - zonder lokaal model zegt het scherm "er draait geen model; de simulatie kan nu niet";
  - met de externe AI uit gaat er niets naar buiten (netwerktoets).

**DK8 · Simulatie naar argumentkaart** — L4/L6 · ontbreekt · klein · later
- *Regels:* het lid kan beurten als **voorstel** in een menselijke kaart (DK2) zetten. Daar staan ze als "uit simulatie" en tellen ze nooit mee als bijdrage van een deelnemer.
- *Acceptatie:* een overgenomen beurt staat in de kaart met het label "uit simulatie (AI)" en heeft geen auteur-codenaam.

**DK9 · Oefenen voor een echt gesprek** — L1 · ontbreekt · klein · later
- *Regels:* een lid oefent een standpunt tegen één rol; de AI geeft per beurt een vraag terug, geen oordeel.
- *Acceptatie:* na vijf beurten staat er een lijst met "vragen die u nog kunt verwachten", zonder cijfer.

**Wat bestaat er al voor**
- de hashketen (`server/lib/keten.js`);
- de kwestie-tijdlijn (`kern/democratie/kwestie.js`);
- partijnamen (`kern/democratie/partijen.js`);
- de 9+-keuring;
- het meldpatroon (`MELD_GRENS`);
- de versies van Pulse;
- lokaal-eerst AI (`server/local-ai.js`, `LOCAL_AI_URL`);
- genootschapsrollen;
- de kantoorpoorten voor escalatie.

**Wat ontbreekt:** de collectie `discussiekamers`, de routes voor kamer, knoop, bron, moderatie en verslag, en een scherm (een paneel in sociaal.html).

**Eindcontract Discussiekamer**

| Dimensie | Criterium |
|---|---|
| Breedte | menselijke kamer en simulatie, allebei voltooibaar |
| Professionele diepte | escalatieladder met vier ogen en bezwaar |
| Levenscyclus | openen → discussie → sluiten → verslag met hash (voltooiscenario) |
| Samenwerking en rollen | moderator ≠ eigen knoop |
| Domeinintelligentie | elke AI-beurt gemarkeerd en met bron of "zonder bron" |
| Los functioneren | zonder model werkt de menselijke kamer volledig, en zegt de simulatie eerlijk dat ze niet kan |
| RTG-ketens | inbreng aan een kwestie als verwijzing |
| Bewezen betrouwbaarheid | de acht APPWERKT-bewijzen voor sociaal, inclusief deze routes in IDOR |

#### Uitkomst B: domeinmaximum van Sociaal (buiten de huidige scope)

**SB1 · Professionele gastheer en concierge van een kring**
- *Proces:* een betaalde of vrijwillige gastheer beheert de sociale agenda van een kring of club: uitnodigen, opvolgen, plaats en tafel, verslag.
- *Gegevens:* bijeenkomsten (Genootschap), antwoorden, tafel- en plekreserveringen (Horeca, `leven.uitgaan`) als verwijzing.
- *Regels:* de gastheer handelt namens de kring alleen met een mandaat van de beheerder, met intrekbare reikwijdte (zoals `link:vertegenwoordiging`). Elk namens-bericht draagt "namens <kring>, door <codenaam>".
- *Rekenwijze:* een opvolglijst, gesorteerd op termijn.
- *Rollen:* beheerder geeft het mandaat; gastheer handelt; leden zien wie namens wie sprak.
- *Uitzondering:* geen betalingen namens leden zonder hun eigen tik.
- *Acceptatie:* een gastheer met mandaat stuurt een herinnering namens de kring. Na intrekking van het mandaat wordt dezelfde handeling geweigerd.

**SB2 · Moderatiedienst als beroep (RTG-moderatoren)**
- *Proces:* opgeleide moderatoren (werkrol `kantoor` of een nieuw genre "moderator") behandelen meldingen uit alle sociale apps met termijnen, vier ogen en een transparantierapport (D1).
- *Gegevens:* meldingen, besluiten, bezwaren en doorlooptijden.
- *Regels:*
  - een moderator behandelt geen zaak van iemand in zijn eigen kring;
  - een zware sanctie vraagt twee handtekeningen;
  - elk kwartaal een openbaar transparantierapport met aantallen per soort besluit, zonder codenamen.
- *Rekenwijze:* mediane doorlooptijd per soort, het aandeel teruggedraaid na bezwaar.
- *Acceptatie:* het rapport over een kwartaal telt precies de besluiten in het journaal. Een besluit door een moderator over zijn eigen kringlid wordt geweigerd.
- *Afhankelijk van:* het genre "moderator" in `server/kern/aanmeldingen`. Vraagt besluit.

**SB3 · Verenigingsbestuur in de kring**
- *Proces:* een vereniging houdt een ledenvergadering in een Discussiekamer met agenda, stemming en notulen.
- *Regels:* een stemming hoort bij DemocratieOS of het genootschap, niet bij de kamer. De kamer levert alleen de bespreking en het verslag.
- *Acceptatie:* de notulen verwijzen naar de stemuitslag van de eigenaar. De kamer telt geen stemmen.

**SB4 · Debatonderwijs**
- *Proces:* een leraar gebruikt de Discussiekamer met een klas.
- *Regels:* het argumenteren wordt beoordeeld met een rubric (helderheid, bron, reactie op de ouder), door de leraar. Geen ranglijst.
- *Acceptatie:* een leerling ziet alleen zijn eigen beoordeling, nooit een vergelijking (de progressiegrens en het leerdossier volgen SCHOOL.md par. 11.1).

**Modus LOS**
- **Vandaag:** zonder kringgesprekken toont het scherm een lege rij met een melding. De voltooiproef loopt zonder `/api/comm/inbox`.
- **Niet gemeten:** de uitval van één bron.

**Modus SAMEN**
- Ontvangt de vijf projecties.
- Geeft verwijzingen naar de bron-app en de Rahul-context via de contextbus.
- Bereikbaar via Heel RTG ("sociaal") en Rahul ("open sociaal").

**Gebruikersketen**
Een lid opent Sociaal en ziet "diner vrijdag" (uit Genootschap). Het laat Rahul een antwoord klaarzetten, bevestigt, en de gastheer ziet het in Genootschap.
- *Genootschap faalt:* de rij toont het diner niet, en er komt geen spookvoorstel.
- *Het netwerk valt weg bij bevestigen:* dezelfde tik geeft één antwoord (bewezen).
- *Het lid is geen lid van het genootschap:* 404 "Dit vinden we niet." (bewezen).

**Vraagt besluit**
- De eigenaar van het kringoverzicht: Sociaal of Alles bij elkaar.
- **Discussiekamer:** akkoord als verdieping binnen Sociaal en uitgewerkt hierboven. Open punten: het genre "moderator" (SB2) en de lijst van eigennamen voor de simulatiekeuring.

**Extern:** geen.

---

### De Salon (tab:salon, /apps/app.html#tab=salon; eigen scherm /apps/salon.html)

**a. Inventaris**
- **APPWERKT (af81b538):** alle acht NIET_GETEST of GEEN_FIXTURE. Een tab had toen geen eigen adres.
- **Sinds 930667b1** kan een tab met een ingang en een via-route gemeten worden. Het scenario `scripts/lib/voltooi/salon.js` sluit lokaal:
  - voltooibaar 7/7, met bevoegd binnen: anoniem 401, een vreemde 404 op een besloten post, een gratis account 403;
  - persistent 3/3;
  - herstelbaar 4/4 (dubbel, afgebroken, crash, zelfde sleutel met andere tekst geeft 409);
  - menselijk 3/3.
- **Routes:**
  - `server/routes/member/salon.js`: like, comment (met herhaalsleutel sinds e664862d5), dm, volg, profiel, poll/stem;
  - `server/routes/member/salonapp.js`: plaats, media (61 MB, rauw), ondertitels, feed (paginering met "Meer laden" en "Je bent bij"), onderwerpen, lid, bio, volgend, bewaar, reacties, reageer, verberg, meld, inzicht, archiveer, ai/bijschrift, ai/reacties, ai/waarover;
  - `salon-claims.js` voor deals;
  - aan de zaakkant `/api/supplier/salon/*`.
- **Kern:** `server/kern/salon/*`. De zichtbaarheidspoort in `zichtbaarheid.js` geeft de publieken iedereen, vrienden, volgers, contacten en alleen ik. Verder `salonviraal.js` voor de kwaliteitsdrempel en `salonpromo.js` voor het beeld voor de site.
- **Toetsen:** salon-app, salon-reactie-herhaal, salonviraal, salon-curatie, salon-claimcode* en salonbeeld.
- **Eigenaar:** `sociaal.salon` (apps/salon.html). Twee oordelen staan open of blijven:
  - met Pulse "gedeeltelijk, open": twee feeds met dezelfde workflow;
  - met wereld.html "blijft": de tweede presentatie.

**b. Marktvergelijking (inclusief duurste pakketten)**

| Betaalde functie | Marktleider | RTG |
|---|---|---|
| Bewerken met termijn | M2 | ontbreekt in De Salon; Pulse heeft het wel |
| Bladwijzermappen | M2 | half: één lijst bewaard |
| Advertentievrij | M1 Platinum, M2 Premium+ | bestaat |
| Inplannen tot 30 dagen | M3 Advanced | ontbreekt |
| Analyses exporteren | M3 Advanced | half: `inzicht`, zonder export |
| Teamtoegang zonder wachtwoord | M3 Advanced | ontbreekt voor leden; de zaakkant heeft personeelssessies |
| Melding bij herposten, met bronvermelding | M3 Advanced | ontbreekt |
| Grote uploads | M4 | bestaat |
| Rollen en moderatie voor organisaties | M5 Enterprise | dun |

Niet overnemen:
- zichtbaarheid kopen of boosten (M3, M4-boosts);
- een betaalde badge (M3).

**c. Het volledige domein**
- **Particulier:** delen met wie je kiest, terugvinden, reageren zonder dat vreemden meekijken. De 9+-poort en codenamen beschermen.
- **Professioneel:**
  - Een maker of fotograaf wil inplannen, bronvermelding bij hergebruik, de eigen rechten houden en analyses.
  - Een redactie of community-manager werkt met een huisstijlgids, een moderatiewachtrij met termijnen, een escalatieladder en een transparantierapport (D1, D4).
- **Organisatorisch:**
  - Een zaak of vereniging publiceert namens een merk met meerdere mensen. Wie mag publiceren en wie tekent af, vier ogen.
  - Een platform met meldingen moet volgens D1:
    - een meldingsroute bieden (art. 16);
    - een beperking motiveren (art. 17);
    - een gratis bezwaarroute bieden die niet volledig automatisch is (art. 20).
- **Minderjarigen:** D2 vraagt standaarden in het belang van het kind (geen druk, geen profilering). D3: onder 16 vraagt verwerking op toestemming ouderlijke toestemming.
- **Wat RTG vandaag doet:**
  - Melden: drie verschillende melders verbergen een post (`MELD_GRENS`, `kern/salon/reacties.js`). "Daarna beslist het kantoor."
  - **Maar er is geen kantoorroute om die post te beoordelen of terug te zetten.** Gezocht in `server/routes/office/*`: er zijn alleen meldingenlijsten voor rendezvous en vonk.
  - De maker hoort ook niet waarom zijn post verdween. Dat is het grootste gat ten opzichte van D1.

**d. Functiecatalogus: uitkomst A (binnen de huidige architectuur en scope)**

**SA1 · Moderatiewachtrij voor gemelde posts** — L3 · ontbreekt · middel · **aanbevolen nu**
- *Gegevens:* `post.meldingen` (key, reden, at) en `post.weg` in de bestaande opslag van De Salon. Geen nieuwe database.
- *Regels:* een post met ≥3 melders of één melding van de categorie "onveilig" komt in de wachtrij van het kantoor. Een kantoormens op naam (werkrol kantoor) beslist: terugzetten, verborgen laten, of verwijderen met motivering. Bij verwijderen of schorsen tekent een tweede mens af.
- *Rekenwijze:* de termijn is `at` van de eerste melding plus 72 uur. Daarna staat de post rood in de wachtrij.
- *Onzekerheid:* een melding is een signaal, geen vaststelling. De post blijft bewaard tot het besluit.
- *Melding:* de maker hoort direct "uw post is verborgen na meldingen; een medewerker kijkt binnen 3 dagen". Na het besluit krijgt hij de motivering. De melder hoort "afgehandeld", zonder het besluit over een ander.
- *Rollen:* kantoor beslist; de maker en de melders zien alleen hun eigen deel.
- *Uitzondering:* een post van een partner gaat naar de partnerregie (`/api/office/salon/*`).
- *Acceptatie:*
  - drie leden melden een post en die is weg uit de feed;
  - de maker ziet de reden;
  - een kantoormens zet hem terug en hij staat weer in de feed;
  - verwijderen kan pas na de tweede handtekening.
- *Bron:* D1 art. 16 en 17, D4.

**SA2 · Bezwaar tegen een moderatiebesluit** — L5 · ontbreekt · middel · **aanbevolen nu**
- *Gegevens:* het besluit uit SA1.
- *Regels:* de maker kan één keer gratis bezwaar maken. Een ánder kantoormens beslist dan, niet degene die besloot. Er gaat niets volledig automatisch.
- *Rekenwijze:* binnen 14 dagen na het besluit.
- *Melding:* de maker krijgt de uitkomst met een nieuwe motivering.
- *Acceptatie:*
  - het bezwaar van een maker komt bij een tweede medewerker;
  - de eerste medewerker kan het niet zelf afhandelen (geweigerd);
  - de maker hoort de uitkomst.
- *Bron:* D1 art. 20.

**SA3 · Bewerken met versies** — L5 · ontbreekt · middel · **aanbevolen nu**
- *Gegevens:* het tekstveld van de post, met een versielijst. Hergebruikt het patroon van Pulse (`/api/member/pulse/bewerk` en `/versies`).
- *Regels:* alleen de maker, binnen 60 minuten na plaatsen. Elke versie gaat opnieuw langs de 9+-keuring (`kern/veilig.js`).
- *Melding:* lezers zien "bewerkt"; wie al reageerde krijgt geen push.
- *Uitzondering:* een post met een actieve deal of poll kan na de eerste stem niet meer bewerkt worden. Anders verandert de vraag onder de stemmers.
- *Acceptatie:*
  - een maker wijzigt binnen het uur; na het uur wordt het geweigerd met een reden;
  - een lezer ziet "bewerkt" en de vorige versie;
  - bewerken na de eerste pollstem wordt geweigerd.
- *Bron:* M2.

**SA4 · Inplannen** — L5 · ontbreekt · middel · later
- *Gegevens:* een post met `startsAt`. Het veld bestaat al in `kern/salon/index.js`, maar wordt nog niet als publicatiemoment gebruikt.
- *Regels:* een post verschijnt op `startsAt` en is tot dan alleen zichtbaar voor de maker. De keuring gebeurt bij het inplannen én bij publicatie.
- *Rekenwijze:* het onderhoudsrondje publiceert alles met `startsAt ≤ nu`.
- *Melding:* de maker hoort "staat nu live".
- *Rollen:* de maker; bij een zaak de beheerder.
- *Acceptatie:* een ingeplande post is voor een ander lid onzichtbaar tot het uur, en daarna zichtbaar. Intrekken vóór het uur werkt.
- *Bron:* M3.

**SA5 · Bronvermelding bij hergebruik** — L6 · ontbreekt · middel · later
- *Gegevens:* bij delen, citeren of uitlichten de verwijzing naar de originele post (id en codenaam). Dat bestaat al voor `salonpromo`: "Uit De Salon · naam".
- *Regels:* een projectie of herdeling draagt altijd de bron, en de maker krijgt een seintje. Uitlichten door RTG gebeurt alleen bij `promoMag` (bestaat).
- *Acceptatie:* deelt lid B de post van A, dan staat "Uit De Salon · A" erbij en ziet A een melding.
- *Bron:* M3 en de merkregel "De Salon levert het beeld, altijd met naam".

**SA6 · Bladwijzermappen** — L1 · half · klein · later
- *Acceptatie:* een lid legt een bewaarde post in een eigen map en vindt hem daar terug. De map is alleen voor hem zichtbaar.

**SA7 · Analyses voor de maker** — L1/L2 · half (`/api/salon/inzicht`) · klein · later
- *Regels:* tellingen zonder namen en zonder ranglijst. Export als CSV voor de eigen posts.
- *Uitzondering:* onder 18 geen vergelijkende cijfers (progressiegrens; `progressieMag` geldt voor spellen, en de geest van die regel hier).
- *Acceptatie:* een maker van 18+ downloadt de tellingen van zijn posts. Een minderjarige ziet alleen eigen totalen, geen vergelijking.

**SA8 · Publiceren namens een zaak, met rollen** — L3 · bestaat aan de zaakkant · –
- Management-only via `req.actor.manager` in `/api/supplier/salon/post`. Bestaat.

**SA9 · Boost of betaalde badge** — **niet doen**: verdienmodel.

**SA10 · Oneindige scroll** — **niet doen**: huisregel; "Je bent bij" bestaat.

**e. RTG-exclusief**
- **Moderatie met vier ogen op naam en een motivering voor de maker**, op de bestaande kantoorlaag (werkrol kantoor, de handtekening via `naamAuth`). De grote netwerken doen dat aantoonbaar slecht (D1).
- **Beeld voor de site uit De Salon met verplichte naam:** de makers zijn de bron van het merk.

**f. Bouwstenen en ontbrekende koppelingen**
- Bestaat:
  - `meld`, `MELD_GRENS` en `weg` in `kern/salon/reacties.js`;
  - kantoorpoorten `officeAuth` en `naamAuth` met vier ogen (`server/kern/kantoor`);
  - het bewerkpatroon in Pulse, `startsAt`, `inzicht` en `salonpromo`.
- **Ontbrekende koppeling:**
  - een kantoorroute die `post.meldingen` leest en een besluit schrijft;
  - een bericht aan de maker via de bestaande meldingen (`notify`).

**g. Prioritering**

| Prioriteit | Functie | Kosten | Afhankelijk van |
|---|---|---|---|
| 1 | SA1 | middel | kantoor |
| 2 | SA2 | middel | SA1 |
| 3 | SA3 | middel | – |
| 4 | SA5 | middel | – |
| 5 | SA4 | middel | onderhoudsronde |
| 6 | SA6, SA7 | klein | – |

**h. Toetsbaar eindcontract**

| Dimensie | Criterium |
|---|---|
| Breedte | plaatsen met vijf publieken, media, reacties, bewaren, verbergen, archiveren, bewerken (SA3) |
| Professionele diepte | inplannen (SA4) en export (SA7) werken voor 18+ |
| Levenscyclus | melden → wachtrij → besluit → bezwaar bewezen in een voltooiscenario met een kantoormens |
| Samenwerking en rollen | verwijderen vraagt twee mensen op naam |
| Domeinintelligentie | AI-bijschrift en reactievoorstel worden nooit zonder tik geplaatst (toets) |
| Los functioneren | faalt `/api/state`, dan zegt de tab dat in woorden (e2e) |
| RTG-ketens | een herdeling draagt de bron en de maker hoort het (SA5) |
| Bewezen betrouwbaarheid | de acht APPWERKT-bewijzen BEWEZEN met de tab-ingang uit 930667b1 |

#### Uitkomst B: domeinmaximum van De Salon (buiten de huidige scope)

**SAB1 · Redactie en publicatieproces voor makers en zaken**
- *Proces:* een maker of zaak werkt met concept → redactie → akkoord → inplannen → publiceren → archief, met meerdere mensen.
- *Gegevens:* een post met de stand `concept`, `ter beoordeling`, `goedgekeurd`, `ingepland` of `gepubliceerd`, en per overgang wie en wanneer.
- *Regels:*
  - de schrijver keurt zijn eigen post niet goed (vier ogen);
  - een zaak wijst redacteuren aan via de bestaande personeelsrollen;
  - na publicatie gaat een wijziging via SA3 met versies.
- *Rekenwijze:* doorlooptijd per stand.
- *Rollen:* schrijver, redacteur, eigenaar.
- *Uitzondering:* een particulier zonder team publiceert direct.
- *Acceptatie:*
  - een post van schrijver X kan niet door X worden goedgekeurd;
  - redacteur Y keurt, en de post verschijnt op het ingeplande uur.

**SAB2 · Rechten en licenties bij beeld**
- *Proces:* een fotograaf of maker legt bij upload de rechten vast. Hergebruik door RTG of anderen vraagt een licentie.
- *Gegevens per beeld:*
  - maker (codenaam);
  - licentie: alle rechten voorbehouden, alleen RTG-promotie (bestaat als `promoMag`), of een open licentie;
  - toestemming van herkenbare personen ja/nee;
  - datum.
- *Regels:*
  - uitlichten en hergebruik alleen binnen de licentie;
  - een herkenbaar persoon zonder toestemming gaat niet naar de site;
  - een intrekking geldt voor nieuw gebruik, en bestaande uitingen krijgen een vervaltermijn;
  - het auteursrecht ligt bij de maker (Auteurswet; bron, geen partner).
- *Melding:* de maker hoort elk gebruik, met plaats en datum.
- *Rollen:* maker, kantoor (uitlichten), derde (licentie vragen).
- *Uitzondering:* demo-beelden van RTG zelf (`public/campagne/`) vallen eronder als "RTG, eigen werk".
- *Acceptatie:*
  - een beeld met "alle rechten voorbehouden" kan het kantoor niet uitlichten (geweigerd);
  - na een intrekking verschijnt het beeld niet meer in een nieuwe uiting.

**SAB3 · Gesponsorde samenwerking, transparant**
- *Proces:* een zaak vraagt een maker om een post. Volgens de Reclamecode (bron) moet een betaalde samenwerking herkenbaar zijn.
- *Gegevens:* een samenwerkingsafspraak (zaak, maker, vergoeding als verwijzing naar Pay of Facturatie).
- *Regels:*
  - een post binnen een afspraak draagt verplicht het label "samenwerking met <zaak>";
  - er is geen boost en geen gekocht bereik: alleen het label;
  - de vergoeding loopt via de bestaande geldketen, niet in De Salon.
- *Rollen:* zaak, maker.
- *Uitzondering:* onder 18 geen betaalde samenwerkingen.
- *Acceptatie:*
  - een post binnen een afspraak zonder label wordt geweigerd;
  - een maker van 17 kan geen afspraak aannemen.

**SAB4 · Archief en nalatenschap van een profiel**
- *Proces:* bij overlijden of beëindiging beslist de nalatenschapsregeling (`link:nalatenschap`, Geld) wat er met de posts gebeurt.
- *Regels:* De Salon voert het besluit uit (bevriezen, herdenkingsprofiel, verwijderen); de eigenaar van het besluit blijft Nalatenschap.
- *Acceptatie:* een bevroren profiel is leesbaar, en niemand kan erop reageren of erin plaatsen.

**Modus LOS**
- **Vandaag:** lezen, waarderen en reageren via `/api/state`, `/api/like` en `/api/comment`. Werkt zonder Pulse, Media of Berichten.
- **Niet gemeten:** wat de tab toont als `/api/state` faalt.

**Modus SAMEN**
- Geeft uit:
  - posts als projectie (Alles bij elkaar, Sociaal);
  - het beeld voor site en campagne (`/api/salon/promo`);
  - de vriendschap (connect), die Snaps, Bellen en Spelen gebruiken.
- Ontvangt: partnerposts van het zaakkanaal.
- Bereikbaar via `#tab=salon`, Heel RTG en Rahul ("open salon").

**Buiten mijn apps**
- Sociale momenten bestaan ook in andere apps:
  - Reizen deelt een Moment (`wereld.travel`);
  - School heeft klasgenoten (`leren.school`, `rtf.klas`);
  - Foundation heeft vrienden voor gezinnen (`rtf.contacten`).
- De Salon neemt hun inhoud niet over. Hooguit verwijst een post naar hun object via de contextbus. **Voor de integrator:** één verwijzingsvorm voor "post over een reis of een event", eigenaar blijft de bron.

**Gebruikersketen**
A plaatst een vriendenpost. B reageert. C (vreemde) meldt. Na drie melders is de post weg; het kantoor beslist en A krijgt de motivering.
- *C ziet de post niet:* 404 (bewezen).
- *Het netwerk valt weg bij reageren:* één reactie (bewezen).
- *Het kantoor reageert niet binnen 72 uur:* de post staat rood in de wachtrij. Vandaag bestaat dat niet (SA1).
- *A is het oneens:* bezwaar bij een tweede mens (SA2).

**Vraagt besluit**
- Pulse en De Salon: samenvoegen of scheiden (open oordeel).
- Een makersgenre voor leden (L2) via `server/kern/aanmeldingen`. Dat genre bestaat nu niet.
- Het meldingsdrempelbeleid (3 melders) tegenover D1: blijft automatisch verbergen voorlopig toegestaan, met een menselijk besluit binnen een termijn?

**Extern:** geschilbeslechting buiten de rechter (D1 art. 21) vraagt een erkende instantie. Dat is een besluit, geen bouw.

---

### Snaps (os:snaps, via Rahul "open snaps" / Heel RTG → de kiezer in /apps/app.html)

**a. Inventaris**
- **APPWERKT (af81b538):** alle acht NIET_GETEST of GEEN_FIXTURE (een kiezer zonder adres).
- **Het scenario `scripts/lib/voltooi/snaps.js` sluit lokaal:**
  - voltooibaar 7/7, met bevoegd binnen: anoniem 401, een derde lid ziet of opent niets, een niet-vriend 403, na een blokkade 403;
  - persistent 3/3;
  - herstelbaar 4/4;
  - menselijk 3/3.
- **Routes** in `server/routes/social/snaps.js`: snap/send (herhaalsleutel sinds e664862d5), snaps, snap/view, story/post, stories, story/view, snap/opdracht. De gezinsvariant `/api/rtf/social/snap/*` draait op dezelfde kern.
- **Kern** `server/kern/sociaal/snaps.js`:
  - de foto staat versleuteld in de mediastore;
  - kijk-één-keer, met het bestand weg na openen;
  - niet-bekeken snaps zijn na 24 uur weg;
  - een verhaal staat 24 uur (`STORY_TTL`), met een `kijkers`-lijst;
  - streaks zijn **bewust verwijderd** (kopcommentaar).
- **Toetsen:** snaps-routes, snaps-herhaal.
- **Eigenaar:** niet geregistreerd in SCHERMEIGENAAR.json.

**b. Marktvergelijking**
- **M1 Snapchat+** (ca. $3,99) en **Platinum** (duurste, ca. $15,99): Story Timer van 1 uur tot 1 week, aantal herbekijkingen, Pin a BFF, streak-emoji's, opslag tot 5 TB.
- **RTG heeft:** kijk-één-keer (gratis bij iedereen), advertentievrij.
- **Niet:** de duur van een verhaal kiezen, een kijkertelling op het scherm, opslag.
- **Niet overnemen:** BFF-rangorde en streaks.

**c. Het volledige domein**
- **Particulier:** spontaan, vluchtig, alleen voor wie het is bedoeld. Het gevaar zit in druk ("streak"), in doorsturen en in schermafdrukken.
- **D2:** geen ontwerp dat dwingt om terug te komen.
- **D3:** onder 16 ouderlijke toestemming. In RTG hangt een kind aan het gezin, via de gezinsvariant met voogdbeleid (`isBeschermdHandle`).
- **Professioneel:** n.v.t. Een makersverhaal hoort in De Salon.
- **Organisatorisch:** n.v.t.

**d. Functiecatalogus: uitkomst A (binnen de huidige architectuur en scope)**

**SN1 · Kijk-één-keer, daarna nergens** — L5 · bestaat · –
- *Acceptatie:* een tweede keer openen geeft 404, en het merkteken van de foto staat niet meer in de opslag. Bewezen.

**SN2 · Duur van een verhaal kiezen** — L1 · ontbreekt · klein · **aanbevolen nu**
- *Gegevens:* een verhaal met `tot` in plaats van de vaste `STORY_TTL`.
- *Regels:* keuze uit 1 uur, 24 uur of 7 dagen; standaard 24 uur. Opruimen gebeurt in de bestaande `opschonenSnaps`.
- *Rekenwijze:* `at + gekozen duur`.
- *Melding:* geen.
- *Uitzondering:* onder 16 of bij een beschermd profiel maximaal 24 uur.
- *Acceptatie:*
  - een verhaal van 1 uur is na 61 minuten weg, ook uit de opslag;
  - een kind kan geen 7 dagen kiezen.
- *Bron:* M1.

**SN3 · Hoeveel vrienden mijn verhaal zagen** — L1 · half (`kijkers` bestaat, het scherm toont het niet) · klein · **aanbevolen nu**
- *Regels:* alleen de maker ziet een telling ("door 4 vrienden gezien"), zonder namen, volgorde of ranglijst.
- *Acceptatie:* de maker ziet het aantal; een vriend ziet niets van andere kijkers.
- *Bron:* M1.

**SN4 · Doorsturen of opslaan door de ontvanger** — **niet doen**: het breekt de belofte van kijk-één-keer.

**SN5 · Schermafdrukmelding** — L1 · ontbreekt · – · **niet doen**
- Een browser kan dat niet betrouwbaar zien. Een belofte die niet waar is, mag niet (BETROUWBAARHEID.md).

**SN6 · BFF-pin en streak-emoji's** — **niet doen**: rangorde tussen vrienden en terugkomdwang. Streaks zijn bewust verwijderd.

**SN7 · Eigen herinneringen bewaren (opt-in)** — L1 · ontbreekt · groot · later
- *Regels:* alleen eigen verhalen, alleen na expliciete keuze, versleuteld, en uit te zetten met alles weg.
- *Onzekerheid:* botst met "na bekijken weg" voor snaps. Daarom alleen verhalen.
- *Acceptatie:* wie het aanzet, vindt zijn eigen verhaal van gisteren terug. Wie het uitzet, ziet ze allemaal verdwijnen.
- *Bron:* M1 (opslag).

**SN8 · Dag-opdracht zonder telling** — L4 · bestaat · –
- *Acceptatie:* een overgeslagen dag kost niets en toont nergens een teller.

**e. RTG-exclusief**
- **Echt vluchtig:** de foto is na openen weg uit de opslag, aantoonbaar in een toets.
- **Geen streaks**, als huisregel.

**f. Bouwstenen en ontbrekende koppelingen**
- Bestaat: `snaps.js` met mediastore, TTL, `kijkers`, het blokkeren en de gezinsvariant.
- Ontbreekt:
  - de keuze voor de duur (SN2);
  - de telling op het scherm (SN3);
  - een eigen scherm met eigenaar in SCHERMEIGENAAR.

**g. Prioritering**

| Prioriteit | Functie | Kosten |
|---|---|---|
| 1 | SN3 | klein |
| 2 | SN2 | klein |
| 3 | registratie in SCHERMEIGENAAR | klein, besluit |
| 4 | SN7 | groot, besluit |

**h. Eindcontract**

| Dimensie | Criterium |
|---|---|
| Breedte | snap, verhaal met gekozen duur, dag-opdracht |
| Professionele diepte | n.v.t. (bewust) |
| Levenscyclus | sturen, één keer zien, vernietigen, bewezen na een crash |
| Samenwerking en rollen | alleen vrienden; blokkade bewezen |
| Domeinintelligentie | geen. Bewust geen aanbevelingen wie je moet snappen |
| Los functioneren | zonder vrienden zegt de kiezer eerlijk "Nog geen contacten…" |
| RTG-ketens | de vriendschap uit De Salon, bereikbaar via Rahul en Heel RTG (e2e) |
| Bewezen betrouwbaarheid | de acht APPWERKT-bewijzen BEWEZEN via de os-ingang |

#### Uitkomst B: domeinmaximum van Snaps (buiten de huidige scope)

Snaps is bewust geen professioneel product. Het maximum ligt in
**bescherming en gezinnen**, niet in makerstools.

**SNB1 · Gezinsmodus met voogdbeleid**
- *Proces:* een kind snapt alleen naar contacten die een ouder goedkeurde. Dat gebeurt al via `voogdWacht` in de vriendenlaag.
- *Regels:*
  - de ouder ziet de lijst van contacten, nooit de inhoud van snaps;
  - een nieuw contact vraagt goedkeuring van de ouder;
  - een melding van het kind gaat naar de ouder en naar het kantoor.
- *Melding:* de ouder hoort het verzoek "nieuw contact".
- *Uitzondering:* geen verhalen van 7 dagen voor kinderen.
- *Acceptatie:*
  - een kind kan geen snap sturen naar een contact dat de ouder niet goedkeurde;
  - de ouder ziet nooit een foto.

**SNB2 · Veilig melden met bewijs, zonder de belofte te breken**
- *Proces:* een ontvanger meldt een ongewenste snap.
- *Regels:*
  - op het moment van melden wordt de snap versleuteld bewaard voor het kantoor. Dat gebeurt alleen bij een melding, en wordt na afhandeling (≤ 30 dagen) gewist;
  - de afzender hoort dat er een melding is, niet door wie.
- *Rollen:* ontvanger meldt; kantoor beoordeelt (vier ogen bij een sanctie).
- *Acceptatie:*
  - een gemelde snap is voor het kantoor te zien, en na afhandeling weg uit de opslag;
  - een niet-gemelde snap is na openen meteen weg (SN1).

**Modus LOS**
- Werkt zonder de Salon-tab, maar alleen naar een bestaande vriend.
- De kiezer zegt het eerlijk als er geen contacten zijn.

**Modus SAMEN**
- Ontvangt de vriendschap uit De Salon.
- Geeft een SSE-sein aan de ontvanger.
- Bereikbaar via Rahul "open snaps" en Heel RTG (9cd499eed).

**Gebruikersketen**
A zegt "open snaps", kiest B en een foto. B opent de snap in de strip.
- *B blokkeerde A:* 403 "niet beschikbaar" (bewezen).
- *Het netwerk valt weg:* één snap (bewezen).
- *De server crasht na openen:* de snap komt niet terug (bewezen).
- *De foto is te groot:* melding in woorden. Het scherm verkleint vooraf.

**Vraagt besluit**
- SN7 (opslag van herinneringen).
- Een eigen scherm met eigenaar.

**Extern:** geen.

---

### Pulse (link:pulse, /apps/pulse.html)

**a. Inventaris**

| Bewijs | Stand in APPWERKT (af81b538) |
|---|---|
| bereikbaar | BEWEZEN |
| bedienbaar | BEWEZEN (12 van 23) |
| menselijk | BEWEZEN |
| voltooibaar | BEWEZEN |
| waarheidsgetrouw | BEWEZEN |
| persistent | BEWEZEN |
| bevoegd | NIET_GETEST: `/api/member/pulse/volg` ontbreekt in IDOR |
| herstelbaar | BEWEZEN |

- **Routes** in `server/routes/member/pulse.js`: feed (cursor), post, weg, like, reactie, volg, meld, profiel, bewerk, versies, bewaar en bewaard. Daarnaast `/api/member/wauw/stemming`, `/stemming/zet` en `/terugblik`.
- **Kern:**
  - `server/kern/pulse/index.js`: 280 tekens, hashtags, trending top-6, drie melders verbergen;
  - `kern/wauw.js`;
  - de 9+-keuring `kern/veilig.js`.
- **Scenario:** `scripts/lib/voltooi/pulse.js`.
- **Toetsen:** pulse, wauw.
- **Eigenaar:** `sociaal.pulse`, met een open oordeel tegenover De Salon.

**b. Marktvergelijking**
- **M2:** Basic ca. $3, Premium ca. $8, Premium+ (duurste) ca. $40:
  - bewerken binnen een uur: RTG **bestaat**;
  - tot 25.000 tekens: RTG **bewust niet**, want Pulse is kort;
  - bladwijzermappen: RTG **half**;
  - voorrang voor antwoorden: **niet doen** als betaald voorrecht;
  - advertentievrij: RTG **bestaat**;
  - Articles: lange vorm hoort in De Salon of de Krant (`media.krant`).

**c. Het volledige domein**
- **Particulier:** kort delen, volgen, ontdekken op onderwerp, zonder dat de feed je vasthoudt.
- **Professioneel:**
  - Een woordvoerder of redactie wil snel en correct kunnen bijsturen: bewerken met zichtbare versies (bestaat).
  - Bij een melding wil hij een motivering (D1).
- **Organisatorisch:** moderatie. Vandaag verbergen drie melders automatisch, "waarna het kantoor het…". Net als bij De Salon vond ik geen kantoorroute die gemelde Pulse-berichten leest.
- **Minderjarigen:** 9+ (D2). Trending kan druk geven; nu is het een top-6 van onderwerpen, niet van mensen.

**d. Functiecatalogus: uitkomst A (binnen de huidige architectuur en scope)**

**P1 · Bewerken met versies** — L5 · bestaat · klein (meten) · **aanbevolen nu**
- *Acceptatie:* na bewerken ziet een lezer "bewerkt" en opent hij de vorige versie. Komt in de voltooiproef; die liep het nog niet.

**P2 · Moderatiewachtrij en motivering** — L3 · ontbreekt · middel · **aanbevolen nu**
- Zelfde ontwerp als SA1 en SA2, op `post.melders`.
- **Voor de integrator:** één kantoorroute voor beide feeds is dubbele logica tenzij het open oordeel Pulse/Salon wordt beslist. Tot dan: twee dunne routes op dezelfde kantoorpoort, of het besluit eerst.
- *Acceptatie:* drie melders → verborgen → de maker hoort waarom → een kantoormens zet terug of verwijdert met motivering.

**P3 · Eindige feed** — L1 · half (cursor bestaat; niet gemeten of het scherm eindigt) · klein · **aanbevolen nu (meten)**
- *Acceptatie:* na de laatste pagina toont het scherm "u bent bij" en laadt niets stil door.

**P4 · Bladwijzermappen** — L1 · half · klein · later

**P5 · Onderwerp volgen (hashtag) in plaats van alleen mensen** — L1 · ontbreekt · klein · later
- *Regels:* volgen op een tag; de feed `volgend` neemt die berichten mee.
- *Acceptatie:* wie #zeilen volgt, ziet een nieuw #zeilen-bericht van een niet-gevolgd lid in "volgend".

**P6 · Langere berichten, betaalde voorrang, boost** — **niet doen**
- Langere berichten veranderen wat Pulse is.
- Betaalde voorrang en boost zijn een verdienmodel.

**P7 · Wauw zonder streak** — L4 · bestaat · –
- *Acceptatie:* een gemiste dag toont geen teller.

**e. RTG-exclusief**
- Een kort netwerk dat 9+-geschikt is, op codenaam, met zichtbare versies en zonder teller of boost.

**f. Bouwstenen en ontbrekende koppelingen**
- Bestaat: `bewerk`, `versies`, `melders`, cursorfeed en trending.
- Ontbreekt:
  - de kantoorroute voor meldingen (P2);
  - de IDOR-dekking voor `/volg` (voor bevoegd).

**g. Prioritering**

| Prioriteit | Functie | Kosten | Afhankelijk van |
|---|---|---|---|
| 1 | P2 | middel | besluit Pulse/Salon |
| 2 | P1 in de voltooiproef | klein | – |
| 3 | P3 meten | klein | – |
| 4 | `/volg` in IDOR | klein, integrator | – |
| 5 | P5 | klein | – |
| 6 | P4 | klein | – |

**h. Eindcontract**

| Dimensie | Criterium |
|---|---|
| Breedte | posten, bewerken, volgen (mensen en onderwerpen), bewaren, melden |
| Professionele diepte | versies voor iedereen zichtbaar |
| Levenscyclus | melden → wachtrij → besluit → bezwaar bewezen |
| Samenwerking en rollen | verwijderen door twee kantoormensen |
| Domeinintelligentie | trending toont onderwerpen, nooit mensen (toets) |
| Los functioneren | bewezen; eigen opslag |
| RTG-ketens | projectie in Alles bij elkaar met bron |
| Bewezen betrouwbaarheid | bevoegd naar BEWEZEN na de IDOR-dekking van `/volg` |

#### Uitkomst B: domeinmaximum van Pulse (buiten de huidige scope)

**PB1 · Officiële mededelingen van organisaties**
- *Proces:* een gemeente, school of vereniging plaatst korte mededelingen ("weg afgesloten", "school dicht").
- *Gegevens:* een bericht van een geverifieerde organisatie (de bestaande genres in `server/kern/aanmeldingen`, bv. gemeente), met een geldigheidsduur.
- *Regels:*
  - alleen een organisatie met een goedgekeurd genre krijgt het label "officieel";
  - het bericht verloopt op de ingestelde tijd;
  - correcties gaan via versies, zichtbaar;
  - geen push zonder dat het lid die organisatie volgt.
- *Rekenwijze:* het bericht is zichtbaar tussen `van` en `tot`.
- *Rollen:* communicatiemedewerker van de organisatie (werkrol zaak), en het lid.
- *Uitzondering:* noodberichten volgen het bestaande alarmkanaal (Veilig, `link:veilig`), niet Pulse.
- *Acceptatie:*
  - een niet-geverifieerde zaak kan het label "officieel" niet zetten;
  - een verlopen mededeling verdwijnt uit de feed.

**PB2 · Redactionele correctie en rectificatie**
- *Proces:* een fout bericht wordt niet stil gewijzigd. Er komt een zichtbare correctie, en wie het bewaarde hoort het.
- *Regels:* een correctie na 60 minuten is een nieuwe versie met het label "gecorrigeerd" en een reden.
- *Melding:* wie het bericht bewaarde, krijgt één seintje.
- *Acceptatie:* een gecorrigeerd bericht toont het label en de reden, en de plank van B toont "gecorrigeerd".

**Modus LOS:** bewezen. Pulse heeft een eigen opslag en feed.

**Modus SAMEN**
- Geeft berichten als projectie naar Alles bij elkaar.
- Ontvangt niets, bewust.
- Bereikbaar via Heel RTG en Rahul ("open pulse").

**Gebruikersketen**
A plaatst "#zeilen". B vindt het onder Ontdek, waardeert en bewaart het. A haalt het weg en het is ook uit de plank van B weg.
- *De keuring weigert:* de reden in woorden, en de tekst blijft staan (eis; niet uitgelokt in de proef).
- *Het netwerk valt weg:* herstelbaar is bewezen.
- *Drie melders:* het bericht is weg, maar de maker hoort het vandaag niet (P2).

**Vraagt besluit:** het open oordeel Pulse/Salon. Dat bepaalt of P2 en SA1 één route worden.

**Extern:** geen.

---

### Alles bij elkaar (link:wereldlaag, /apps/wereld.html)

**a. Inventaris**

| Bewijs | Stand in APPWERKT (af81b538) |
|---|---|
| bereikbaar | BEWEZEN |
| bedienbaar | BEWEZEN (18 van 22; 5 niet aan te tikken) |
| menselijk | BEWEZEN |
| voltooibaar | BEWEZEN |
| waarheidsgetrouw | BEWEZEN |
| persistent | BEWEZEN |
| bevoegd | NIET_GETEST: `/api/krant/artikel` en `/api/mediaos/volg` ontbreken in IDOR |
| herstelbaar | BEWEZEN |

- **Routes** in `server/routes/wereld.js` en `wereld/*`: feed, state, gesprek, introductie, lijst, lijst/zet, modus, profiel, profiel/van, profiel/zicht, rahul, zoek, bereik, bezoekers en bedrijf.
- **Kern** `server/kern/wereld/*`: feed, netwerk, lijsten, profiel, bezoek, inzicht, ai.
- **Presentatie** `public/apps/saloon/*.js`: plaatst en reageert via de Salon-routes.
- **Scenario:** `scripts/lib/voltooi/wereldlaag.js`.
- **Toetsen:** wereldlaag, wereld, wereldprofiel.
- **Eigenaar:** `sociaal.alles`. Oordelen: met De Salon "blijft" (presentatie); met Sociaal "open".

**b. Marktvergelijking**
- **Profielbezoekers zien:** bij de grote netwerken vaak een betaald voorrecht, niet geverifieerd. RTG heeft het half (`/api/wereld/bezoekers`).
- **Lijsten en zoeken:** gratis bij M2. RTG heeft het.
- **Zichtbaarheid kopen** (M3): niet doen.

**c. Het volledige domein**
- **Particulier:** één tijdlijn in plaats van vier apps, met de zichtbaarheid in eigen hand.
- **Professioneel:** zakelijk netwerken via `/api/wereld/bedrijf`. Introducties zijn wat een makelaar of concierge in het echt doet: twee kanten vragen, en pas dan verbinden.
- **Organisatorisch:** niet hier. Verenigingen zitten in Genootschap.
- **Privacy:** wie mijn profiel bekeek, is een persoonsgegeven van de bezoeker. Zichtbaar maken vraagt een grondslag en wederkerigheid (D3/AVG).

**d. Functiecatalogus: uitkomst A (binnen de huidige architectuur en scope)**

**W1 · Profielbezoekers, wederkerig** — L1 · half · klein · **aanbevolen nu**
- *Gegevens:* bezoeken uit `kern/wereld/bezoek.js`.
- *Regels:*
  - standaard alleen een telling;
  - namen alleen als zowel bezoeker als bezochte "wederzijds zichtbaar" aanzetten;
  - onder 16 nooit namen.
- *Rekenwijze:* unieke bezoekers per 7 dagen.
- *Melding:* geen push. Het is een overzicht, geen trigger.
- *Acceptatie:*
  - zonder wederzijdse keuze ziet A "3 bezoekers", zonder namen;
  - als beiden het aanzetten, ziet A de codenaam.

**W2 · Storingsbestendige tijdlijn** — L6 · ontbreekt (niet gemeten) · klein · **aanbevolen nu**
- *Regels:* valt één bron weg (Salon, Pulse of Zakelijk), dan blijven de andere staan, met een regel "Pulse is nu niet bereikbaar".
- *Acceptatie:* een e2e met de Pulse-route op 503 toont Salon-posts en de melding.

**W3 · Gevraagde introductie** — L4 · bestaat · –
- *Acceptatie:* een introductie gaat pas door na ja van beide kanten. Bij nee hoort de vrager "geen introductie", zonder reden.

**W4 · Lijsten en zoeken over drie bronnen** — L1 · bestaat · –
- *Acceptatie:* zoeken op "#zeilen" toont posts uit De Salon en Pulse, elk met de bron erbij.

**W5 · Zichtbaarheid per profieldeel** — L1 · bestaat · –

**W6 · Bereik kopen** — **niet doen**.

**e. RTG-exclusief**
- **Introducties met toestemming van twee kanten**, zoals een concierge dat doet. Geen "mensen die je misschien kent" zonder vraag.

**f. Bouwstenen en ontbrekende koppelingen**
- Bestaat: feed, bezoek, introductie, lijsten, zoek.
- Ontbreekt:
  - W1-wederkerigheid;
  - W2-storingsmelding;
  - IDOR-dekking voor de twee routes.

**g. Prioritering**

| Prioriteit | Functie | Kosten |
|---|---|---|
| 1 | W2 | klein |
| 2 | W1 | klein |
| 3 | IDOR | klein, integrator |
| 4 | besluit Sociaal/Alles | – |

**h. Eindcontract**

| Dimensie | Criterium |
|---|---|
| Breedte | drie bronnen, zoeken, lijsten, introducties |
| Professionele diepte | zakelijk profiel apart zichtbaar |
| Levenscyclus | plaatsen tot weghalen via de eigenaar (bewezen) |
| Samenwerking en rollen | een introductie vraagt twee ja's (toets) |
| Domeinintelligentie | geen suggestie zonder vraag |
| Los functioneren | W2 bewezen |
| RTG-ketens | een reactie landt in De Salon, niet in een kopie |
| Bewezen betrouwbaarheid | bevoegd naar BEWEZEN |

#### Uitkomst B: domeinmaximum van Alles bij elkaar (buiten de huidige scope)

**WB1 · Introductiedienst als professioneel proces (netwerker of concierge)**
- *Proces:* een Lifestyle-concierge (`link:rechterhand`) of een zakelijke netwerker introduceert mensen.
- *Gegevens:* de introductie (vrager, gevraagde, reden en de introducerende mens).
- *Regels:*
  - de introducerende kent beide kanten aantoonbaar: een bestaande verbinding;
  - beide kanten zeggen ja;
  - de reden staat in het verzoek;
  - er wordt geen contactgegeven gedeeld vóór beide ja's.
- *Melding:* de introducerende hoort het eindresultaat, niet de reden van een nee.
- *Rollen:* introducerende, vrager, gevraagde.
- *Uitzondering:* een Lifestyle-introductie mag geen toegang tot een pas beloven (AGENTS.md).
- *Acceptatie:*
  - zonder verbinding met beide kanten kan iemand niet introduceren (geweigerd);
  - na twee ja's verschijnt een gesprek in Berichten met beide.

**WB2 · Persoonlijk jaaroverzicht van het sociale leven**
- *Proces:* op verzoek een overzicht van het afgelopen jaar: momenten, bijeenkomsten, gedeelde reizen.
- *Gegevens:* projecties uit De Salon, Reizen (`wereld.travel`) en Uitgaan (`leven.uitgaan`). Alleen eigen gegevens.
- *Regels:*
  - alleen op verzoek, nooit als druk;
  - geen vergelijking met anderen;
  - geen tellers als prestatie;
  - onder 18 geen ranglijst-achtige cijfers.
- *Acceptatie:* het overzicht toont alleen eigen items met de bron-app, en verschijnt pas na een tik.

**Modus LOS:** **eis**: met één bron weg blijven de andere zichtbaar. Dat is niet gemeten.

**Modus SAMEN**
- Projecties van drie eigenaren, met verwijzingen terug.
- Bereikbaar via Heel RTG en Rahul ("open alles bij elkaar").

**Gebruikersketen**
A zoekt "#zeilen", vindt een post van B, vraagt een introductie. B zegt ja, en ze praten verder in Berichten (`comm.berichten`).
- *B weigert:* A hoort "geen introductie".
- *Berichten staat uit:* de introductie blijft staan en het gesprek wacht.
- *Het profiel van B staat op "alleen vrienden":* A ziet alleen de codenaam.

**Vraagt besluit:** de eigenaar van het kringoverzicht (Sociaal of Alles bij elkaar).

**Extern:** geen.

---

### Voor de integrator (buiten mijn apps)

- **Misbruikmeldingen worden geschreven maar door niemand gelezen:**
  - `/api/member/report` schrijft naar `reports` (`server/kern/sociaal.js:63`, bewaard 2 jaar volgens `bewaarbeleid-operationeel.js`);
  - ik vond geen kantoorroute die `reports` leest.
  - Hetzelfde geldt voor de verborgen posts in De Salon en Pulse.
  - Samen met D1 is dit het belangrijkste gat in de sociale familie.
- **Eén verwijzingsvorm** voor "post over een reis, event of klas". Bronnen: Reizen (`wereld.travel`), Uitgaan (`leven.uitgaan`), Festival (`festival.crewdashboard`), School (`leren.school`/`rtf.klas`). De Salon verwijst; de bron blijft eigenaar.
- **Discussiekamer:** een verdieping binnen Sociaal (`sociaal.leven`). Een besluit met maatschappelijk gevolg blijft bij `democratie.kwestie`, de deelnemerskring bij `sociaal.genootschap`; beide als verwijzing.


---

## Spel, sport en bellen (LivingOS-B)

Gemeten op `appwerkt/living-b` (HEAD c038c1bd1), 19 oktober 2026. Vorm volgens `premiumformat.md`, inclusief de aanscherping van de eigenaar: per app de punten a tot en met h, plus Modus LOS, Modus SAMEN en een gebruikersketen met storingen.

Drie afspraken gelden voor alle vier de kaarten:
- **Registers lopen achter.** De gecommitte registers (`APPWERKT.json`, stempel af81b538, en `VOLTOOIPROEF.json`, f85c044e) zijn van vanochtend en lopen achter op de scenario's die vandaag zijn gebouwd. Waar een bewijs pas op de tak sluit, staat dat er met "op de tak" bij. Dat telt pas als APPWERKT-bewijs na de centrale meetronde.
- **Marktleiders zijn een ondergrens.** Ze staan in de bronkolom als ondergrens van functies, nooit als partner of als verdienmodel.
- **Ongeverifieerde bronnen.** Een officiële prijspagina die niet is opgehaald, staat zo vermeld. Prijzen uit derde bronnen staan er als "volgens".

---

### Spelen (link:spelen, /apps/spelen.html?pas=)

Doel: een lid speelt met wie het kent een echt spel, aan elk toestel, en ziet daarna terug hoe het ging. Volwassenen die RTG gekeurd heeft, kunnen ook om een stand spelen. Eigenaar volgens `SCHERMEIGENAAR.json`: `apps/spelen.html`, capability `spelen.bordspel`, rol eigenaar, doelgroep lid. Verwante schermen van een andere eigenaar:
- `apps/spelscherm.html`: `spelen.projectiescherm`, Game Night, nu LivingOS-A;
- `apps/foundation/arena.html`: `rtf.arena`, doelgroep rtf-kind;
- `apps/foundation/societeit.html`: `rtf.societeit`;
- `apps/foundation/speelhal.html`: `spel.speelhal`.

#### a. Inventaris van het bewezen bestaande

| Bewijs | Stand in APPWERKT.json | Op de tak (nog niet in het register) |
|---|---|---|
| bereikbaar | BEWEZEN | — |
| bedienbaar | BEWEZEN (4 eigen knoppen) | — |
| menselijk | NIET_GETEST | sluit 3/3 in de voltooiproef |
| voltooibaar | GEEN_FIXTURE | sluit, 9 stappen (incl. de 18+-grens en 3 bevoegd-stappen) |
| waarheidsgetrouw | BEWEZEN (18 antwoorden gelogen) | — |
| persistent | GEEN_FIXTURE | sluit 3/3 (ook een lopend potje over een herstart) |
| bevoegd | NIET_GETEST (16 van 50 routes niet in IDOR.json) | — |
| herstelbaar | GEEN_FIXTURE | sluit 5/5 (dubbeltik, crash na "Nodig uit en start", dubbele zet, afgebroken zet, crash na de matzet) |

Wat er gebouwd is:
- **Routes:** 37 letterlijke routes onder `/api/member/spel/*` en dezelfde acties onder `/api/rtf/spel/*` voor het gezinsprofiel (`server/routes/spellen.js`). `/api/rtf/spel/nieuw` staat letterlijk achter `rtfSpeler`.
- **Kern:** `server/kern/spellen/`, met 18 spellen in het register: Schaken, Dammen, Mens erger je niet, Rummi, Pesten, Sneek, Sudoku, Tetris, Quizduel, Woordduel, 30 Seconden, Doen of Waarheid, Proost (18+), en de duels Flits, Geheugen, Reactie, Schat en Rangschik.
- **Kernmodules:** descriptor en variant, zicht per speler, klok en tempo, teams zonder ranglijst, toernooien (knockout 4/8 en roundrobin 3–8), replay en naspelen, nabespreking, Rahul als spelmaatje zonder het bord te zien, presence, dagpuzzel en arcade (beide achter de grens), dubbeltik-sleutel en projectie naar een tweede scherm.
- **Toetsen:** onder meer `test/spel-dubbeltik.test.js`, `test/spel-nieuw-sleutel.test.js`, `test/arena.test.js`, `test/spelbeleid.test.js`, `test/spelsudoku.test.js` en de spel-e2e's.
- **Specificatie:** `GAMEHALL.md` (1576 regels), waaronder par. 14 (toernooien en clubs) en par. 15 (casual tegenover ranked, en de grens).

#### b. Marktvergelijking (functies, geen verdienmodellen)

| Marktleider en pakket | Wat het pakket geeft | Bron, peildatum 2026-10-19 | Hebben wij het? |
|---|---|---|---|
| Chess.com Gold | onbeperkt puzzels en lessen, alle bots, geen advertenties | [support.chess.com](https://support.chess.com/en/articles/8562418-what-does-each-level-of-membership-get-me) | geen advertenties: ja. Lessen en bots: nee. Puzzels: half (dagpuzzel) |
| Chess.com Platinum | onbeperkte partijanalyse | idem | half: nabespreking en naspelen, geen zetbeoordeling |
| Chess.com Diamond (duurste) | coachuitleg bij elke zet, Insights over al je partijen; gezinsplan tot 6 personen | idem; prijzen alleen via derden en tegenstrijdig, de officiële pagina chess.com/membership is niet opgehaald | nee; een gezinsplan is bij ons overbodig, want alles is inbegrepen |
| Lichess (alles gratis) | geen advertenties, onbeperkt spelen en toernooien, lokale engine-analyse; diepe serveranalyse 40 per dag | [lichess.org/features](https://lichess.org/features) | toernooien: ja. Lokale engine-analyse: nee |
| Board Game Arena Premium | premiumspellen, tafels openen voor elk spel, spraak en video aan tafel, spelen op één toestel, statistiek na afloop; $5 per maand of $42 per jaar | [forum.boardgamearena.com](https://forum.boardgamearena.com/viewtopic.php?p=215419) (BGA zelf) | tafels voor elk spel: ja. Spraak en video: half (los in Videobellen). Eén toestel: nee. Statistiek: half (alleen 18+) |

Wat we NIET overnemen: premiumspellen achter een muur, advertenties als verdienmodel, kunstmatige schaarste. Loot boxes ook niet: de Kansspelautoriteit ziet loot boxes als kansspel zodra de speler geen invloed heeft op de inhoud ([cms.law](https://cms.law/nl/nld/publication/kansspelautoriteit-loot-boxes-kunnen-onder-reikwijdte-wet-op-de-kansspelen-vallen), peildatum 2026-10-19).

#### c. Analyse van het volledige domein

**Particulier.** Mensen spelen het meest met mensen die ze kennen: gezin, vrienden, klas. Ze spelen ook op één toestel aan tafel, op de bank met de televisie, en in de chat. Een partij terugkijken en snappen waarom je verloor, is het verschil tussen een spelletje en een hobby.

**Professioneel.** Er zijn drie werelden: speltoezicht, rating en ontwikkeling.
- **Rating:** een rating hoort bij een vastgelegde regeling. De FIDE-ratingregels (goedgekeurd 15/12/2023, van kracht sinds 1 maart 2024) stellen eisen aan bedenktijd en wie mee telt ([handbook.fide.com](https://handbook.fide.com/chapter/B022024), peildatum 2026-10-19). Een eigen ratingcijfer is dus geen officiële rating, en moet zo heten.
- **Leeftijdsclassificatie:** spelontwikkelaars werken met PEGI. PEGI kent een aanduiding voor in-game aankopen en een aparte voor betaalde willekeurige voorwerpen ([wikipedia: PEGI](https://en.wikipedia.org/wiki/PEGI), peildatum 2026-10-19; pegi.info zelf niet opgehaald). Omdat RTG niets verkoopt in een spel, hoort geen van onze spellen die aanduidingen te dragen.
- **Kansspel:** de Wet op de kansspelen verbiedt prijzen toe te kennen via een kansbepaling waarop deelnemers in het algemeen geen overwegende invloed hebben, zonder vergunning ([kansspelautoriteit.nl / Raad van State](https://www.raadvanstate.nl/@123942/202001415-1-a3/), peildatum 2026-10-19). Een toernooi met een prijs bij een kansspel (Mens erger je niet, Pesten) is dus juridisch iets anders dan een schaaktoernooi.

**Organisatorisch.** Toernooiorganisatoren werken met indelingssystemen (knockout, roundrobin, Zwitsers, poules), tie-breaks, bedenktijd per ronde, arbiters, verzoeken om uitstel en een publiek reglement. Schaakclubs en scholen houden clubkampioenschappen. RTG heeft al de Arena voor tieners en klas en quiz voor scholen (`rtf.klas`).

Wat dit volgens ons vraagt: 18+-poort voor elke blijvende stand, geen prijzen bij kansspelen zonder besluit, en bij minderjarigen de AVG-leeftijd van 16 voor toestemming in onlinediensten (art. 8 AVG, art. 5 UAVG, [gdpr-text.com](https://gdpr-text.com/nl/read/article-8/), peildatum 2026-10-19).

#### d. Concrete functiecatalogus

| Functie | Laag | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wanneer hoort iemand iets | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Stand | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Spelen aan één toestel (hotseat) | L1 | het potje in `S`, geen tweede sessie | de beurt wisselt op één toestel; per beurt een scherm "geef door aan <naam>" zodat verborgen kaarten verborgen blijven (`zicht.js`) | geen | niemand; het blijft op het toestel | een lid is eigenaar; medespelers zonder account tellen als gast in het potje en laten geen spoor na | spellen met verborgen informatie alleen met het doorgeefscherm; geen uitslag in `spelUitslagen` als niet iedereen 18+ en geverifieerd is | twee mensen spelen Rummi op één telefoon; bij elke beurt ziet alleen wie aan de beurt is zijn kaarten | ontbreekt | klein | aanbevolen nu |
| Zetbeoordeling na afloop | L4 | de zetten uit `naspelen.js`; een lokale evaluatie per spel (schaken, dammen) | per zet het verschil tussen de beste en de gespeelde zet, in drie klassen: goed / twijfelachtig / fout; geen extern model (AI lokaal-eerst) | een beoordeling is een inschatting van de rekendiepte, en heet zo ("volgens een rekendiepte van N zetten") | na afloop, op verzoek; nooit tijdens het potje | alleen de spelers van het potje; een kijker niet | niet bij kansspellen; niet bij een lopend potje | na een schaakpartij ziet het lid bij zet 12 "twijfelachtig, een betere zet was …" en kan het die stelling op het bord terugzien | half (nabespreking, geen evaluatie) | middel | aanbevolen nu |
| Eigen inzicht over partijen | L4 | `spelUitslagen` en de eigen replays | per opening of fase het aandeel winst en verlies van de eigen partijen; geen vergelijking met anderen | bij weinig partijen zegt het scherm "te weinig partijen om iets te zeggen" (drempel: 10) | maandelijks een samenvatting, alleen als het lid dat aanzet | alleen het lid zelf | onder de 18+-grens bestaat het niet (`progressieMag`) | een gekeurde volwassene ziet "met wit verloor je vaak na zet 20" uit zijn eigen 30 partijen | ontbreekt | middel | later |
| Ranked met een verborgen matchmakingcijfer | L4 | uitslagen van ranked-potjes | een eigen cijfer (Elo-achtig), uitdrukkelijk geen FIDE-rating; tegenstanders binnen een band | het cijfer is een schatting en wordt nooit getoond als absolute sterkte | na elk ranked-potje alleen de uitslag, geen cijfer in beeld | alleen gekeurde volwassenen; casual blijft voor iedereen | niet bij kansspellen; geen seizoenen of verval die terugkomen dwingen | een gekeurde volwassene kiest "Ranked" en krijgt binnen 60 seconden een tegenstander van vergelijkbare sterkte, of de melding dat er nu niemand is | ontbreekt (GAMEHALL.md par. 15) | middel | later |
| Toernooien: Zwitsers, poules, best-of, tie-breaks | L3 | `toernooi.js` en `toernooi-schema.js` | Zwitsers: per ronde koppelen op gelijke score, niet twee keer dezelfde; tie-break volgens het gekozen reglement | geen; de indeling is deterministisch en uitlegbaar | voor elke ronde aan alle spelers; bij uitstel aan de tegenstander | organisator (een lid) maakt; deelnemers op uitnodiging | onder de 18 geen blijvende stand na afloop (al zo); kansspellen zonder prijs | een organisator start een Zwitsers toernooi met 9 spelers; ronde 2 koppelt nooit twee spelers die al tegen elkaar speelden | half (knockout en roundrobin bestaan) | middel | aanbevolen nu: het schema heeft er de plek al voor |
| Publiek toernooireglement en arbiter | L3 | een reglementtekst per toernooi; een aangewezen arbiter | de arbiter kan een uitslag corrigeren met een reden; de correctie staat in de geschiedenis | geen | bij een correctie aan beide spelers | arbiter is een lid dat de organisator aanwijst; de arbiter speelt zelf niet mee | geen arbiter, dan beslist de uitslag van de partij | een arbiter zet een uitslag om met een reden; beide spelers zien de reden en de oude uitslag | ontbreekt | middel | later |
| Nieuwe varianten op een bestaand spel | L5 | de descriptor van een spel (`variant.js`) | een variant is een keuzelijst uit de descriptor, nooit vrije code uit het verzoek (al zo voor quiz) | geen | — | elk lid kiest; de keuzelijst bepaalt RTG | geen variant die een kansspel met prijs maakt | een lid kiest "Dammen, 8x8" of "Schaken 960" en het potje speelt volgens die regels | half (variant bestaat voor quiz) | klein tot middel per spel | aanbevolen nu |
| Spelbouwstudio en eigen spelmotor | — | — | — | — | — | — | — | — | ontbreekt | groot | niet doen vóór V1: een nieuwe motor of laag is uitgesloten. De verdieping is de descriptor (varianten) en de bestaande motoren |
| Spraak en video aan tafel | L6 | het potje en een verwijzing naar een gesprek (`/api/member/call`) | met één tik start een gesprek met de medespelers; het bord blijft staan | geen | de medespelers krijgen een oproep | alleen medespelers die verbonden zijn | geen gesprek met iemand die geblokkeerd is | in een lopend potje tikt een lid "Bel de tafel" en de ander krijgt een oproep met het bord eronder | half (bellen los) | middel | aanbevolen nu |

#### e. RTG-exclusieve mogelijkheden

- **Eén spelkern voor iedereen, met andere regels per ingang.** Gezin, klas, vrienden en volwassenen spelen hetzelfde schaakpotje. Het beleid aan de ingang beslist wie wat mag (`beleid.js`). Wij hoeven dus geen apart kinderspel te bouwen.
- **Rahul als uitlegger die nooit vals speelt.** Hij krijgt het bord bewust niet mee. Dat is uitlegbaar aan ouders en aan toernooispelers.
- **Toernooien zonder stand onder de 18.** Een schoolkampioenschap dat niets achterlaat, precies zoals De Arena belooft.

#### f. Bouwstenen en ontbrekende koppelingen

- **Bestaat:** descriptor, zicht, klok, toernooi, teams, replay, naspelen, nabespreking, Rahul, projectie en dubbeltik.
- **Ontbreekt:**
  - een lokale evaluator per spel (schaken, dammen);
  - een doorgeefscherm voor hotseat;
  - Zwitsers en poules in het toernooischema;
  - een verwijzing van het potje naar een gesprek;
  - een genre voor een spelhal of club in `server/seed/genres-lijst-*.js`. Dat vraagt besluit.

#### g. Prioritering

| Volgorde | Wat | Kosten | Complexiteit | Afhankelijk van |
|---|---|---|---|---|
| 1 | hotseat met doorgeefscherm | klein | laag | `zicht.js` |
| 2 | varianten (Dammen 8x8, Schaken 960) | klein tot middel | laag | `variant.js` |
| 3 | Zwitsers en poules | middel | middel | `toernooi-schema.js` |
| 4 | spraak en video aan tafel | middel | middel | Videobellen |
| 5 | zetbeoordeling | middel | hoog | een lokale evaluator |
| 6 | ranked en eigen inzicht | middel | middel | 18+-poort, besluit over het cijfer |

#### h. Toetsbaar eindcontract voor Beyond Premium

Dit eindcontract vervangt de acht APPWERKT-bewijzen niet.

| Dimensie | Criterium |
|---|---|
| Breedte | minstens 18 spellen speelbaar, elk met minstens één voltooiproefstap van uitnodiging tot uitslag |
| Professionele diepte | toernooien in drie indelingen (knockout, roundrobin, Zwitsers), elk met een toets die een volledige ronde indeelt |
| Levenscyclus | uitnodigen, aannemen, zetten, klok, opgeven, uitslag, replay en opruimen, elk bewezen in de voltooiproef |
| Samenwerking en rollen | organisator en arbiter; een toets laat zien dat een arbiter een uitslag corrigeert en een speler dat niet kan |
| Domeinintelligentie | elke inschatting heet een inschatting; een toets laat zakken als een beoordeling zonder rekendiepte getoond wordt |
| Los functioneren | spelen met iemand op codenaam lukt met De Salon en School uit; een e2e laat dat zien |
| RTG-ketens | potje naar het tweede scherm, naar een gesprek en naar de chat, elk met een e2e |
| Bewezen betrouwbaarheid | alle acht APPWERKT-bewijzen BEWEZEN, met IDOR-dekking voor alle 50 routes |

#### Uitkomst A — bouwbaar binnen de huidige architectuur en scope
De functiecatalogus (d) met de bak "aanbevolen nu" en "later", in de volgorde van g: hotseat, varianten via de descriptor, Zwitsers en poules, spraak en video aan tafel, zetbeoordeling met een lokale evaluator, ranked en eigen inzicht achter `progressieMag`. Geen nieuwe motor of laag; alles hangt aan de bestaande spelkern.

#### Uitkomst B — het domeinmaximum, ook buiten de huidige scope
Compleet nieuwe professionele processen. Elk vraagt een besluit en valt buiten V1.

| Proces | Gegevens en bron | Regels en rekenwijze | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium |
|---|---|---|---|---|---|
| **Toernooiorganisatie als vak** (clubs, scholen, zaken organiseren erkende toernooien met inschrijving, bedenktijd per ronde, arbiters en een publiek reglement) | inschrijvingen, het reglement als versie-tekst, rondes en uitslagen uit de spelkern | indeling volgens het gekozen systeem; tie-break volgens het reglement; een uitslag wordt definitief na een bezwaartermijn (bijvoorbeeld 24 uur) | organisator (zaak met een nieuw genre "spelorganisatie"), arbiter (aangewezen lid), deelnemer; minderjarigen alleen met toestemming van een ouder (AVG art. 8) | kansspellen alleen zonder prijs, of met een vergunning; geen blijvende stand onder de 18 | een organisator publiceert een reglement, 16 spelers schrijven in, de arbiter corrigeert één uitslag met een reden, en na de bezwaartermijn staat de eindstand vast en zichtbaar voor alle deelnemers |
| **Erkende rating via een bond** | partijen met bedenktijd die voldoet aan de ratingregeling van de bond ([handbook.fide.com](https://handbook.fide.com/chapter/B022024)) | RTG berekent niets officieels; RTG levert een partijbestand aan de bond (PGN) en toont de officiële rating die de bond teruggeeft | de speler geeft toestemming per toernooi; de arbiter tekent het rapport af | online partijen tellen alleen als de bond dat erkent | na een erkend toernooi staat het rapport bij de bond, en ziet de speler zijn officiële rating met de bron erbij |
| **Spelontwikkeling door derden** (een uitgever brengt een bordspel naar RTG) | een descriptor-bestand van de uitgever, gekeurd door RTG; rechten en licentie van de uitgever | het spel draait alleen als declaratieve descriptor binnen de bestaande motoren, nooit als vrije code; PEGI-achtige leeftijdsaanduiding verplicht | uitgever (zaak, via het App Store-kanaal, APPSTORE.md), keurder van RTG op naam (vier ogen) | geen in-game aankopen, geen willekeurige betaalde voorwerpen | een uitgever dient een descriptor in, een keurder keurt goed, en het spel verschijnt in Spelen met de leeftijdsaanduiding en de naam van de uitgever |
| **Spelhal en clubavond** (een zaak houdt een speelavond met tafels, inschrijving en een televisie per tafel) | tafels als zaakobject, potjes uit de spelkern, projectie per tafel | een tafel is een potje met een eigen schermcode; de zaak ziet alleen de bezetting, nooit de inhoud van verborgen kaarten | zaak (nieuw genre of horeca), gast als lid of als tafelgast zonder spoor | 18+-spellen (Proost) alleen aan tafels met gekeurde volwassenen | op een clubavond met 6 tafels toont elke televisie zijn eigen potje, en de zaak ziet welke tafel vrij is |

**Modus LOS.**
- **Al zo:** spelen op codenaam en solo (Sudoku, Tetris, de dagpuzzel) werkt zonder De Salon en School. Zonder Rahul-sleutel geeft dezelfde motor een vaste tip.
- **Nog niet:** staat De Salon uit, dan is de vriendenlijst leeg zonder uitleg. Dat hoort een zin te worden: "Uw vrienden komen uit De Salon; nodig iemand uit op codenaam".

**Modus SAMEN.**
- **Uitgegeven:**
  - een potje-verwijzing naar Game Night (`/api/member/spel/projectie-open`);
  - games in de chat (GAMEHALL.md par. 10);
  - een vermelding in Heel RTG en in de functiegids (Rahul "open spelen").
- **Ontvangen:** de vriendenkring (`/api/member/connections`), de klas (`spelKlasgenoten`) en de keuring via `volwassen()`.
- **Geen overname van gegevens:** de spelkern bewaart alleen het potje en de uitslag, op codenaam.
- **Buiten mijn apps:**
  - de Arena en Societeit (FoundationOS, `rtf.arena`, `rtf.societeit`) en de schoolquiz (`rtf.klas`) gebruiken dezelfde kern; voor de integrator: houd dat zo, één kern;
  - een spelavond op een evenement past bij Horeca-events (`horeca.events`, doelgroep zaak) en Festival (`festival.gast`) als verwijzing naar een potje, niet als eigen spellogica.

**Gebruikersketen.** Een lid doet het volgende:
1. Vraagt in de rand "open spelen".
2. Nodigt een Salon-vriend uit voor schaak.
3. Zet het bord op de televisie met een schermcode.
4. Speelt.
5. Kijkt daarna de replay terug, met de zetbeoordeling (nog te bouwen).

Storingen in die keten:
- **De vriend reageert niet:** de uitnodiging blijft wachten en er is geen tijdsdruk.
- **Dubbele tik op "Nodig uit en start":** één potje (bewezen).
- **Een crash vlak na de tik:** dezelfde tik geeft hetzelfde potje. Een ander spel onder dezelfde sleutel geeft 409 (bewezen).
- **Het netwerk valt weg tijdens een zet:** de zet staat er één keer, en de stand na herladen klopt (bewezen).
- **De vriend is niet gekeurd:** het potje wordt uitgespeeld, er wordt niets bewaard, en het scherm zegt dat met `GEEN_PROGRESSIE`.
- **De televisie valt weg:** de schermcode is op, het scherm zegt dat, en een nieuwe code koppelt (bewezen in Game Night).
- **De vriend is geblokkeerd:** geen uitnodiging mogelijk (bevoegd-stap op de tak).

**Vraagt besluit.**
- Een genre voor een spelhal, esportsclub of toernooiorganisator.
- Of een toernooi met een prijs kan, en welke spellen dan als behendigheidsspel gelden (Wet op de kansspelen).
- Of hotseat onder de 18 mag als er niets bewaard wordt.
- De naam en de zichtbaarheid van een eigen matchmakingcijfer.

**Extern.** Geen. Een officiële rating (FIDE of een nationale bond) is extern en valt buiten dit voorstel.

---

### Sport (link:sport, /apps/sport.html)

Doel: een lid volgt zijn club, kiest een plek in het stadion, gaat met een eenmalige code naar binnen, en kan als lid, vrijwilliger of sponsor bijdragen. De club runt het in zijn eigen kantoor. Eigenaren volgens `SCHERMEIGENAAR.json`:
- `apps/sport.html`: capability `sport.wedstrijd`, rol eigenaar, doelgroep lid;
- `apps/sportclub.html`: capability `werk.sportclubbeheer`, doelgroep zaak.

#### a. Inventaris

| Bewijs | APPWERKT.json | Op de tak |
|---|---|---|
| bereikbaar | BEWEZEN | — |
| bedienbaar | BEWEZEN (20 eigen knoppen) | — |
| menselijk | NIET_GETEST | sluit 3/3 |
| voltooibaar | GEEN_FIXTURE | sluit 8/8: vak tekenen, reserveren, vol vak, eenmalige scan, sponsorinteresse op codenaam en 3 bevoegd-stappen |
| waarheidsgetrouw | BEWEZEN | — |
| persistent | GEEN_FIXTURE | sluit 3/3 |
| bevoegd | NIET_GETEST (3 van 11 routes ongemeten) | — |
| herstelbaar | GEEN_FIXTURE | sluit 4/4: dubbeltik, afgebroken reservering, crash na reserveren, crash na scan |

Wat er gebouwd is:
- **Ledenkant:** 8 letterlijke routes onder `/api/member/sport/*`.
- **Clubkant:** routes onder `/api/sport/*` achter `supplierAuth` (`server/routes/sportclub.js`): cockpit, plattegrond, teams, spelers, programma, wedstrijden, uitslag, scan, stand, velden, kampen, sponsors, momenten, financiën en een assistent.
- **Kantoorkant:** `/api/office/sport/kampen` en `/kamp/beslis`.
- **Kern:** `server/kern/sportclub/` (stadion, sportief, zakelijk, cockpit).
- **Genre:** `sportclub` bestaat in `server/seed/genres-lijst-b.js`.
- **Herhaalsleutel:** een ticket draagt sinds vandaag zijn herhaalsleutel (`stadion.js`), met toets `test/sportticket-herhaal.test.js`.

#### b. Marktvergelijking

| Marktleider en pakket | Functies | Bron, peildatum 2026-10-19 | Hebben wij het? |
|---|---|---|---|
| FotMob, gratis basis | live stand, xG en schotkaarten, live tekst, tv-schema | [apps.apple.com](https://apps.apple.com/US/app/id488575683) | stand: half (één club). xG: nee |
| FotMob, betaald (duurste in de lijst: familie jaarlijks $29.99) | geen advertenties; verder niet hard te verifiëren | [apppricinglab.com](https://apppricinglab.com/iap/apple/488575683) (april 2026; officiële pagina niet opgehaald) | geen advertenties: ja |
| OneFootball, abonnement en per wedstrijd | wedstrijden per stuk kijken, clubkanalen (bijvoorbeeld €2.99 per maand voor een clubkanaal) | [apppricinglab.com](https://apppricinglab.com/iap/apple/382002079), [inter.it](https://www.inter.it/en/news/inter-tv-onefootball) | nee |
| Ledenadministratie van de bond | leden, wedstrijdzaken, teammanagers, digitaal wedstrijdformulier | [knvb.nl](https://www.knvb.nl/over-ons/knvb-account) (bron, geen partner) | teams en spelers: half. Wedstrijdformulier: nee. Koppeling met de bond: nee |

#### c. Domein

**Particulier.** Supporters volgen het programma, de stand en de opstelling. Ze kopen een kaart, reizen naar het stadion en willen dat alles op één plek staat. Ouders van jeugdspelers willen weten wanneer en waar het kind speelt, en wie rijdt.

**Professioneel.** Clubs werken met:
- een bondsledenadministratie: de bond gebruikt één pakket, en de club voert zelf leden en wijzigingen in ([knvb.nl](https://www.knvb.nl/over-ons/knvb-account), peildatum 2026-10-19);
- wedstrijdzaken: programma, wijzigingen en teammanagers;
- een digitaal wedstrijdformulier dat alleen werkt als trainer en teammanager goed geregistreerd zijn;
- scheidsrechters die worden aangewezen en een uitslag vastleggen.

**Organisatorisch.** Daaronder vallen vrijwilligersroosters (bar, scheidsrechter, kantine), sponsorcontracten, kampen en toernooien, contributie en de AVG voor jeugdleden (toestemming van een ouder onder de 16, [gdpr-text.com](https://gdpr-text.com/nl/read/article-8/)). Bij tickets voor grote wedstrijden spelen veiligheid, persoonsgebonden kaarten en doorverkoop een rol.

#### d. Functiecatalogus

| Functie | Laag | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wanneer hoort iemand iets | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Stand | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Mijn clubs volgen | L1 | een lijst clubcodes per lid; programma en stand uit `sportief.js` | alleen clubs die op RTG staan | geen | — | het lid | een club die van RTG afgaat, verdwijnt met een melding | een lid volgt twee clubs en ziet hun programma samen, op datum | half (één club per verzoek, voorkeur `FCRTG`) | klein | aanbevolen nu |
| Melding bij de aftrap en de uitslag | L1 | wedstrijdstart en uitslag uit `uitslagZet` | één melding bij de aftrap, één bij de uitslag; nooit een live stroom | geen | bij aftrap en uitslag, alleen als het lid dat aanzet | het lid | geen melding 's nachts (rust van de meldingslaag) | het lid zet de melding aan; bij de uitslag krijgt het precies één bericht | ontbreekt | klein | aanbevolen nu |
| Ticket doorgeven aan een vriend | L5 | het ticket (`stadion.js`) en een Salon-verbinding | de oude code vervalt meteen; de nieuwe is eenmalig; een gescand ticket kan niet meer | geen | de ontvanger krijgt een bericht | de houder geeft door; de ontvanger accepteert | niet na een scan; niet aan iemand die geblokkeerd is | een lid geeft één van drie tickets door; de oude code weigert aan de poort, de nieuwe werkt | ontbreekt | middel | aanbevolen nu |
| Annuleren voor de wedstrijd | L5 | het ticket | zolang het niet gescand is en de club annuleren toestaat | geen | de club ziet een plaats vrijkomen | de houder | na de aftrap niet | een lid annuleert een ticket; het vak heeft er één plek bij | ontbreekt | klein | aanbevolen nu |
| Wedstrijd in de agenda | L6 | een verwijzing (club, wedstrijd-id, tijd) | de agenda neemt geen ticketgegevens over, alleen de verwijzing | geen | — | het lid | — | na reserveren staat de wedstrijd in de agenda en opent een tik het ticket in Sport | ontbreekt | klein | aanbevolen nu |
| Online afrekenen | L5 | betaalwaarheid (`kern/betaalwaarheid`, eigenaar Geld) | ticket pas na een bevestigde betaling; weigert de bank, dan geen ticket | een hangende betaling heet wachtend, nooit betaald | bij bevestiging | het lid en de club | gratis wedstrijden zonder betaling | weigert de bank, dan staat er geen ticket en zegt het scherm dat er niets is afgeschreven | ontbreekt (afrekenen aan de poort) | middel | later, met Geld |
| Vrijwilligersrooster | L3 | rooster en taken in de clubkern | een lid schrijft zich in voor een dienst; de club bevestigt | geen | herinnering de dag ervoor | club (zaak) maakt, lid schrijft in | jeugdleden alleen met toestemming van een ouder | een lid schrijft zich in voor een bardienst en ziet hem in zijn agenda | ontbreekt | middel | later, met PLANNING.md |
| Scheidsrechter aanwijzen en uitslag laten vastleggen | L3 | wedstrijd, aangewezen lid | de scheidsrechter legt de uitslag vast; de club kan corrigeren met een reden | geen | beide teams bij de uitslag | club wijst aan; scheidsrechter is een lid met die rol in de club | geen scheidsrechter, dan de club zelf | een aangewezen scheidsrechter legt 2–1 vast; de stand werkt bij | ontbreekt (`uitslagZet` alleen door de club) | middel | later |
| Bondskoppeling en digitaal wedstrijdformulier | L2 | — | — | — | — | — | — | — | ontbreekt | groot | niet doen vóór V1: extern pakket en besluit |
| Live kijken en uitzendrechten | L1 | — | — | — | — | — | — | — | ontbreekt | groot | niet doen: rechten zijn extern |
| Diepe statistiek (xG) | L4 | — | — | — | — | — | — | — | ontbreekt | groot | niet doen: vraagt een datafeed |

#### e. RTG-exclusief

- **Club, lid en betaling als één keten zonder dubbele data.** De club tekent het stadion, het lid reserveert, Geld bevestigt en de agenda verwijst. Elk deel blijft eigenaar van zijn eigen stuk.
- **Sponsorinteresse op codenaam.** Een lid laat interesse zien zonder dat de club zijn naam krijgt. Dat bestaat al en bewijst de privacy by design.

#### f. Bouwstenen en ontbrekende koppelingen

- **Bestaat:** plattegrond, tickets, scan, teams, wedstrijden, uitslag, sponsors, kampen en financiën.
- **Ontbreekt:** een volglijst per lid, meldingen, doorgeven en annuleren, een agendaverwijzing, de betaalnaad van Geld, en de rollen scheidsrechter en vrijwilliger in de club.

#### g. Prioritering

| Volgorde | Wat | Kosten |
|---|---|---|
| 1 | mijn clubs | klein |
| 2 | melding bij aftrap en uitslag | klein |
| 3 | annuleren | klein |
| 4 | wedstrijd in de agenda | klein |
| 5 | ticket doorgeven | middel |
| 6 | online afrekenen | middel, afhankelijk van Geld |
| 7 | vrijwilligersrooster | middel, afhankelijk van PLANNING.md |
| 8 | scheidsrechter | middel |

#### h. Eindcontract

Dit eindcontract vervangt de acht APPWERKT-bewijzen niet.

| Dimensie | Criterium |
|---|---|
| Breedte | volgen, reserveren, binnenkomen, doorgeven en annuleren, elk met een voltooiproefstap |
| Professionele diepte | de clubkant bedient teams, wedstrijden, uitslag, velden en sponsors, elk met een toets |
| Levenscyclus | van reservering tot scan, annulering of doorgifte, met herstel na crash bewezen |
| Samenwerking en rollen | club, lid, scheidsrechter en vrijwilliger; een toets laat zien dat een lid geen uitslag kan zetten |
| Domeinintelligentie | geen voorspelling getoond als feit; een toets laat zakken als een kans zonder "schatting" verschijnt |
| Los functioneren | reserveren en binnenkomen lukt met de agenda en Geld uit |
| RTG-ketens | ticket naar agenda en betaling naar ticket, elk met een e2e |
| Bewezen betrouwbaarheid | alle acht APPWERKT-bewijzen BEWEZEN |

#### Uitkomst A — bouwbaar binnen de huidige architectuur en scope
De catalogus (d) in de volgorde van g: mijn clubs, melding bij aftrap en uitslag, annuleren, de wedstrijd in de agenda, ticket doorgeven, online afrekenen met Geld, vrijwilligersrooster en scheidsrechter. Alles binnen het bestaande genre `sportclub` en de bestaande kernen.

#### Uitkomst B — het domeinmaximum, ook buiten de huidige scope

| Proces | Gegevens en bron | Regels en rekenwijze | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium |
|---|---|---|---|---|---|
| **Complete verenigingsadministratie** (leden, contributie, teams, wedstrijdzaken, bondsafdracht) | leden op codenaam met echte naam in de kluis; contributieschema; bondscontributie per seizoen (bijvoorbeeld €13,83 in 2025/'26 volgens [knvb.nl](https://www.knvb.nl/over-ons/knvb-account)) | contributie per categorie en leeftijd op peildatum; automatische incasso via Geld; bondsafdracht per seizoen | ledenadministrateur, penningmeester, bestuur (vier ogen op afschrijven); een ouder voor een jeugdlid onder 16 | opzegtermijn volgens de statuten; geen incasso zonder machtiging | een vereniging met 300 leden draait een seizoen: contributie geïnd, bondsafdracht berekend, en een opgezegd lid wordt na de termijn niet meer geïnd |
| **Digitaal wedstrijdformulier en scheidsrechterszaken** | opstellingen, wissels, kaarten, uitslag; aanwijzing van scheidsrechters | het formulier wordt definitief na ondertekening door beide teammanagers en de scheidsrechter; een tuchtzaak opent bij een rode kaart | teammanager, scheidsrechter (met licentie, als vakbewijs in `kern/vakbewijs.js`), wedstrijdsecretaris | een gestaakte wedstrijd krijgt geen uitslag; een niet-geregistreerde speler blokkeert het formulier | na een wedstrijd ondertekenen drie mensen het formulier, en verschijnen uitslag, kaarten en spelersminuten bij beide clubs |
| **Veilige kaartverkoop voor risicowedstrijden** | persoonsgebonden tickets op codenaam met identiteitscontrole (betrouwbaarheidsniveau A3) | per wedstrijd een risicoklasse; bij hoog alleen persoonsgebonden, niet doorverkoopbaar boven de nominale prijs | club, veiligheidsmedewerker, lid | uitverkochte wedstrijd: een eerlijke wachtlijst op volgorde, geen loting met betaling | bij een risicowedstrijd kan alleen een gekeurd lid een kaart kopen, en een doorverkoop boven de nominale prijs wordt geweigerd |
| **Jeugdopleiding en talentvolg** (alleen als leerdossier, nooit als vergelijking) | trainingsaanwezigheid en doelen per speler, alleen voor de speler, de ouder en de trainer | geen ranglijst, geen niveau-label (de regel van het leerdossier in FOUNDATION.md par. 5.5) | trainer, speler, ouder | onder de 18 nooit een vergelijking tussen spelers | een trainer legt drie doelen vast, de speler en de ouder zien ze, en geen ander lid ziet iets |

**Modus LOS.**
- **Al zo:** zien, reserveren en binnenkomen lukt zonder andere apps.
- **Nog niet:** zonder ingerichte club toont het scherm stil de standaardclub. Het hoort te zeggen dat er nog geen club gekoppeld is.

**Modus SAMEN.**
- **Uitgegeven:** Heel RTG en Rahul "open sport".
- **Ontvangen:** niets.
- **Gewenst, als verwijzing:**
  - een agendaregel (agenda, eigenaar `agenda.afspraken`);
  - een betaling (Geld);
  - de club als plek op de kaart (`server/kern/mall/plek.js` kent `sportclub` als adres);
  - een uitwedstrijd als reis in TravelOS (reisbureau, eigenaar `reizen.reisbureau`), voor de integrator.

**Gebruikersketen.** Een lid doet het volgende:
1. Volgt zijn club.
2. Krijgt een melding dat de verkoop open is.
3. Reserveert drie tickets.
4. Geeft er één door aan een vriend.
5. Ziet de wedstrijd in zijn agenda.
6. Scant op de dag aan de poort.

Storingen in die keten:
- **Het vak is vol:** het scherm zegt hoeveel plaatsen er nog zijn (bewezen).
- **Een crash na het reserveren:** dezelfde tik geeft hetzelfde ticket (bewezen).
- **Een tweede scan:** geweigerd, en het lid ziet "gescand" (bewezen).
- **De vriend is geblokkeerd:** doorgeven geweigerd met een reden.
- **De agenda staat uit:** het ticket werkt gewoon; alleen de verwijzing ontbreekt.
- **Het netwerk valt weg aan de poort:** de code staat op het toestel. Of de poort offline kan scannen, vraagt besluit.

**Vraagt besluit.**
- Volgen van clubs die niet op RTG staan.
- Online betalen of aan de poort blijven.
- Persoonsgebonden tickets bij risicowedstrijden.
- Offline scannen aan de poort.

**Extern.** Bondsadministratie en wedstrijdformulier, live data en uitzendrechten, en poortapparatuur.

---

### RTFoundation-kiezer (os:rtf) — staat in de kaart van FoundationOS

**De kaart van FoundationOS draagt deze app** (`docs/domeinkaarten/foundationos.md`, hoofdstuk 14 "RTF-tegel"). De reden: in `SCHERMEIGENAAR.json` is `rtf.start` → `apps/foundation/index.html` de eigenaar van de bestemming, en de kiezer zelf heeft geen eigen functie of gegevens.

Deze familie houdt alleen bij wat in LivingOS ligt: de tegel en de leeftijdskiezer (`RTF_GROEPEN` in `public/apps/app-main/app-main-24a1.js`). Een eigen voltooiscenario `os:rtf` staat daar als RTF-19. Eerder stond hier een volledige catalogus; die is vervallen om dubbel werk te voorkomen. Zie de git-historie van dit bestand vóór 19 oktober 2026 als u die nog zoekt.

---

### Videobellen (os:videobellen, kiezer in de ledenapp)

Doel: twee mensen die elkaar kennen, zien en horen elkaar, rechtstreeks tussen hun toestellen, zonder dat het beeld over een server gaat. Eigenaar: niet geregistreerd in `SCHERMEIGENAAR.json`. Verwant zijn `apps/comm.html` (`comm.berichten`, LivingOS-A) en de werkvloer (`zaak.teamroom` in `apps/personeel.html`, die `public/shared/teamcall.js` laadt).

#### a. Inventaris

| Bewijs | APPWERKT.json | Op de tak |
|---|---|---|
| bereikbaar | NIET_GETEST ("een kiezer in de app") | bewezen in `test/videobellen-echt.e2e.js` via de echte route: Rahul "open videobellen" en Heel RTG ("video"), in `test/heelrtg-osapps.e2e.js` |
| bedienbaar | NIET_GETEST | idem: opnemen en ophangen met de knoppen van de rand |
| menselijk | NIET_GETEST | idem: een vreemde krijgt 403 met een melding in woorden |
| voltooibaar | GEEN_FIXTURE ("vraagt test-identiteiten voor WebRTC") | de browserproef bewijst bellen, opnemen en elkaar zien in beide richtingen (framesDecoded loopt op) en ophangen; niet in de voltooiproef, en of hij als bron mag tellen ligt bij de eigenaar |
| waarheidsgetrouw | NIET_GETEST | — |
| persistent | GEEN_FIXTURE | niet van toepassing: een gesprek wordt nergens bewaard |
| bevoegd | NIET_GETEST | een niet-verbonden lid 403, anoniem 401 |
| herstelbaar | GEEN_FIXTURE | opnemen als de rand nog niet klaar is (gerepareerd in `app-main-10.js`); herverbinden na netwerkverlies is niet beproefd |

Wat er gebouwd is:
- **Signalering:** `POST /api/member/call` (`server/routes/social/leden.js`), alleen tussen verbonden leden. Een blokkade weigert. Soorten: ring, accept, offer, answer, ice, hangup, decline, busy.
- **ICE-uitgifte:** `/api/ice` met STUN voor iedereen en een kortlevend TURN-credential alleen voor een ingelogde actor, met een plafond per actor (`server/kern/rtc/ijs.js`).
- **Relais:** relaystand en relayproef. Productie eist `TURN_URL` met `turns:` (`server/config/productie-communicatie.js`). Toetsen: `test/turn-*.test.js`.
- **Werkvloer:** `public/shared/teamcall.js` belt één-op-één en in een groep (mesh, kamer "team", tot 100 deelnemers), alleen voor personeel van een zaak.

#### b. Marktvergelijking

| Marktleider en pakket | Functies | Bron, peildatum 2026-10-19 | Hebben wij het? |
|---|---|---|---|
| Zoom gratis | 40 minuten per vergadering, tot 100 deelnemers | [tldv.io](https://tldv.io/blog/zoom-pricing/) (juni 2026; zoom.us/pricing niet opgehaald) | duur: wij zijn onbeperkt (één-op-één) |
| Zoom Pro | tot 30 uur, opnemen in de cloud, peilingen | idem | duur: ja. Opnemen: nee, bewust. Peilingen: nee |
| Zoom Business Plus en Enterprise (duurste) | 300 tot 1000 deelnemers, SSO, huisstijl, telefonie, onbeperkte cloudopslag; Enterprise op aanvraag | [eesel.ai](https://www.eesel.ai/en/blog/zoom-pricing), [trustradius.com](https://trustradius.com/products/zoom/pricing) (derden, onderling tegenstrijdig) | groep: alleen werkvloer (mesh tot 100, praktisch minder). Rest: nee |
| Google Meet gratis | één-op-één tot 24 uur, groep van 3 of meer tot 60 minuten | [9to5google.com](https://9to5google.com/2021/07/12/google-meet-group-limit/) (uit 2021); [tldv.io](https://tldv.io/blog/google-meet-time-limit/) (augustus 2026) | één-op-één: ja. Groep voor leden: nee |

Wat we NIET overnemen: een tijdslimiet als prikkel om te betalen, en opnemen of transcriberen in de cloud zonder toestemming.

#### c. Domein

**Particulier.** Familie op afstand, een vriend in een ander land, een ouder die een kind wil zien. Wat telt is dat het meteen werkt, ook op 4G en achter een strenge router, en dat je vertrouwt dat niemand meekijkt.

**Professioneel.** Vergaderprofessionals werken met een agenda en een uitnodiging, scherm delen, een wachtkamer, een gastheer die kan dempen of verwijderen, opnames met toestemming, en notulen. Dat bestaat bij RTG in de werkvloer (`teamcall.js`) en in WorkOS, niet in Videobellen.

**Organisatorisch.** Groepen tot enkele tientallen. Boven circa 8 video's houdt mesh het niet meer vol; dan is een doorgeefserver (SFU) nodig, en dat is een nieuwe motor.

**Rechten.** De AVG geldt voor elke verwerking. Er wordt niets opgeslagen, maar metadata (wie belde wie) kan wel bestaan. Een opname vraagt toestemming van iedereen in het gesprek.

#### d. Functiecatalogus

| Functie | Laag | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wanneer hoort iemand iets | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Stand | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Kleine groep voor leden (tot 4 tot 6) | L1 | Salon-verbindingen; de mesh van `teamcall.js` | alleen leden die onderling allemaal verbonden zijn; maximaal 6 met beeld | het toestel bepaalt hoeveel video's het aankan; het scherm zegt dat | iedereen krijgt een oproep | de beller nodigt uit; elke deelnemer neemt zelf op | een geblokkeerde deelnemer kan niet in hetzelfde gesprek | drie vrienden zien elkaar tegelijk, en een vierde die met één van hen niet verbonden is, wordt niet toegelaten | half (werkvloer) | middel | aanbevolen nu: dezelfde mesh, geen nieuwe motor |
| Werkt op 4G en achter een firewall | L5 | `/api/ice`, relaystand | TURN alleen voor een ingelogde actor; productie start niet zonder `TURN_URL` | of een netwerk TURN nodig heeft, is vooraf niet zeker; het scherm zegt "verbinden via een relais" | — | — | — | vanaf een mobiel netwerk met strenge NAT komt het gesprek tot stand via het relais | half (de uitgifte bestaat, een relais in productie is extern) | middel | aanbevolen nu |
| Herverbinden na netwerkverlies | L5 | de RTCPeerConnection | ICE herstart bij `disconnected`; na 15 seconden het bericht "verbinding verloren" | geen | beide kanten zien "opnieuw verbinden" | — | — | valt het netwerk 3 seconden weg, dan loopt het gesprek door of zegt het scherm dat het opnieuw verbindt; na 15 seconden een duidelijke melding | ontbreekt in de toetsen | middel | aanbevolen nu |
| Camera en microfoon aan en uit, wisselen | L1 | lokale tracks | aan en uit zonder het gesprek te verbreken; de ander ziet het | geen | de ander ziet het pictogram | — | — | een lid zet zijn camera uit, en de ander ziet een stilstaand pictogram in plaats van beeld | half (niet apart beproefd) | klein | aanbevolen nu: een toets erbij |
| Scherm delen | L1 | `getDisplayMedia` | alleen tijdens een gesprek, met een duidelijke rand "u deelt uw scherm" | geen | de ander ziet het gedeelde scherm | de deler | niet op toestellen zonder ondersteuning; het scherm zegt dat | een lid deelt zijn scherm en de ander ziet het binnen 3 seconden | ontbreekt | klein | later |
| Gepland gesprek | L3 | een agendaregel als verwijzing | de agenda bewaart alleen tijd en deelnemers; Videobellen belt op het moment | geen | een herinnering bij de start | de organisator | — | om 20:00 krijgen beide een herinnering met een knop "bel nu" | ontbreekt | klein | later |
| Opnemen of transcriberen in de cloud | — | — | — | — | — | — | — | — | ontbreekt | groot | niet doen: beeld loopt bewust nooit over de server, en dat is de belofte |
| Grote groepen (meer dan 8 met beeld) | — | — | — | — | — | — | — | — | ontbreekt | groot | niet doen vóór V1: vraagt een SFU, een nieuwe motor |

#### e. RTG-exclusief

- **Bellen zonder telefoonnummer.** Alleen tussen mensen die elkaar langs De Salon kennen, op codenaam. De server ziet alleen signalen.
- **Eén belweg in het hele huis.** Spelen, Samen en Berichten verwijzen naar hetzelfde gesprek, in plaats van elk een eigen bel te bouwen.

#### f. Bouwstenen en ontbrekende koppelingen

- **Bestaat:** signalering, ICE en TURN-uitgifte, relaystand, de belschil met de rand, en de groepsmesh van de werkvloer.
- **Ontbreekt:** de groepsmesh voor leden, een toets voor herverbinden, een verwijzing vanuit Spelen en Samen, en de koppeling met de agenda.

#### g. Prioritering

| Volgorde | Wat | Kosten | Afhankelijk van |
|---|---|---|---|
| 1 | camera en microfoon met toets | klein | — |
| 2 | herverbinden | middel | — |
| 3 | 4G en firewall | middel | een TURN-relais in productie (extern) |
| 4 | kleine groep voor leden | middel | `teamcall.js` |
| 5 | scherm delen | klein | — |
| 6 | gepland gesprek | klein | agenda |

#### h. Eindcontract

Dit eindcontract vervangt de acht APPWERKT-bewijzen niet.

| Dimensie | Criterium |
|---|---|
| Breedte | één-op-één en een kleine groep, elk in een browserproef met framesDecoded bij elke ontvanger |
| Professionele diepte | scherm delen en een gepland gesprek, elk met een e2e |
| Levenscyclus | bellen, opnemen, weigeren, bezet, ophangen en herverbinden, elk beproefd |
| Samenwerking en rollen | een niet-verbonden of geblokkeerd lid komt nooit in een gesprek; een e2e per geval |
| Domeinintelligentie | geen meeluisteren; een toets laat zakken als audio of beeld naar de server gaat |
| Los functioneren | bellen lukt met berichten uit; een e2e |
| RTG-ketens | gesprek vanuit een potje en vanuit de agenda, elk met een e2e |
| Bewezen betrouwbaarheid | de acht APPWERKT-bewijzen BEWEZEN zodra de eigenaar de browserproef als bron toestaat |

#### Uitkomst A — bouwbaar binnen de huidige architectuur en scope
De catalogus (d) in de volgorde van g: camera en microfoon met toets, herverbinden, 4G en firewall via het bestaande relais, een kleine groep voor leden op de mesh van de werkvloer, scherm delen en een gepland gesprek. Geen SFU, geen opname.

#### Uitkomst B — het domeinmaximum, ook buiten de huidige scope

| Proces | Gegevens en bron | Regels en rekenwijze | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium |
|---|---|---|---|---|---|
| **Vergaderen als professioneel proces** (agenda, wachtkamer, gastheer, besluitenlijst) | een vergaderobject met agenda en deelnemers; een doorgeefserver (SFU) voor meer dan 8 deelnemers | de gastheer laat toe uit de wachtkamer, kan dempen en verwijderen; besluiten worden met naam en tijd vastgelegd | gastheer, deelnemer, notulist; toestemming per deelnemer voor elke opname | een deelnemer die de opname weigert, wordt niet opgenomen of het gesprek gaat zonder opname verder | een vergadering met 20 deelnemers loopt via de wachtkamer, één deelnemer weigert de opname, en de besluitenlijst staat na afloop bij iedereen |
| **Notulen met toestemming, op het toestel** | de audio blijft op het toestel van de notulist; een lokaal spraakmodel (TOESTEL.md) | transcriptie alleen als iedereen toestemt; het verslag heet een concept tot de notulist het vaststelt | notulist, deelnemers keuren het verslag | geen transcriptie van minderjarigen | na een gesprek met toestemming van iedereen staat een conceptverslag bij de notulist, en geen audio verlaat het toestel |
| **Zorg- en hulpgesprek op afstand** (door een zaak met een genre dat een persoonseis heeft, `kern/persoonseis.js`) | een afspraak, een identiteitscontrole van de professional (vakbewijs) | alleen een professional met een geldig vakbewijs kan het gesprek openen; geen opname | professional, cliënt, eventueel een ouder | noodgevallen gaan langs de beschermingsdeur (HDI.md par. 7), niet langs dit gesprek | een cliënt belt op het afgesproken uur met een professional van wie het vakbewijs geldig is, en een professional met een verlopen bewijs kan het gesprek niet openen |

**Modus LOS.**
- **Al zo:** bellen werkt los van Berichten zodra de vriendschap bestaat.
- **Nog niet:** zonder contacten zegt de kiezer "Nog geen contacten" en verwijst naar De Salon. Dat is eerlijk.

**Modus SAMEN.**
- **Uitgegeven:** een lopend gesprek in de rand (Opnemen, Ophangen).
- **Ontvangen:** contacten en blokkades uit De Salon, en het TURN-credential.
- **Gewenst, als verwijzing:** vanuit een potje (Spelen), een Samen-kamer en de agenda.
- **Buiten mijn apps:**
  - een gesprek met de concierge of een zaak (Horeca, Reizen) hoort bij de bestaande servicebel (`public/shared/servicebel.js`), niet bij Videobellen; voor de integrator;
  - de schoolbel (`public/shared/schoolbel.js`) idem.

**Gebruikersketen.** Lid A doet het volgende (bewezen tot en met ophangen):
1. Zegt in de rand "open videobellen".
2. Kiest B.
3. B neemt op via de rand.
4. Ze zien elkaar.
5. A nodigt een derde vriend uit (nog te bouwen).
6. A hangt op.

Storingen in die keten:
- **B is geen vriend:** 403 met een melding, en bij B gaat niets over (bewezen).
- **De oproep komt binnen vlak na het openen van de app:** Opnemen verschijnt alsnog (gerepareerd en bewezen).
- **Strenge NAT zonder relais:** geen verbinding. In productie weigert de configuratie te starten zonder `TURN_URL`.
- **Het netwerk valt weg:** niet beproefd; zie de functie herverbinden.
- **De derde is niet met iedereen verbonden:** hij wordt niet toegelaten (te bouwen).

**Vraagt besluit.**
- Of de browserproef als bron voor APPWERKT telt.
- Groepsbellen voor leden op de mesh van de werkvloer.
- Of metadata (wie belde wie) bewaard mag worden, en hoe lang.

**Extern.** Een TURN-relais in productie (eigen beheer of een aanbieder; geen merk als partner). Een SFU voor grote groepen valt buiten V1.


---

## Lezen, overzicht, ontmoeten en het Privékantoor (LivingOS-B)

**Vorm.** Premiumdomeinkaart, met de aanscherping van de eigenaar van 19 oktober (punt 4 a–h). Gemeten op `appwerkt/living-b` (c038c1bd1 en later). Er is niets gebouwd.

**Bronnen.**
- **Peildatum** van alle marktbronnen: 2026-10-19. Echte merken en organisaties staan er alleen als bron of marktreferentie, nooit als partner.
- **Prijzen:** staat er "niet geverifieerd", dan kwam de prijs alleen van een derde partij of uit een ouder artikel, niet van de eigen prijspagina van de aanbieder.

**Twee kanttekeningen bij "bewezen".**
- **APPWERKT.json is van vóór de voltooiscenario's.** Het register staat op commit af81b538 (05:16). Daarin staan voltooibaar, persistent en herstelbaar nog op GEEN_FIXTURE.
- **De scenario's sluiten wel, maar zijn nog niet vastgelegd.** Ze bestaan sinds vandaag en sloten bij elke run op deze tak. VOLTOOIPROEF.json (f85c044e) is nog niet opnieuw vastgelegd; dat doet de centrale meetronde. "Sluit" hieronder betekent dus: geslaagd in een lokale run, nog niet in het register.

---

### Nieuws (link:nieuws, /apps/nieuws.html)

#### a. Inventaris van het bewezen bestaande

**Doel:** het gepubliceerde werk van RTG Redactie per rubriek lezen, een artikel openen en Rahul vragen het samen te vatten of een vraag te beantwoorden uit alleen de artikeltekst.

**Code:**
- **Routes:** `/api/member/nieuws`, `/api/member/nieuws/artikel` en `/api/member/nieuws/ai` (`server/routes/member/nieuws.js`). De schrijfkant loopt via `/api/office/redactie/*`.
- **Kern:** `server/kern/redactie/` (`index.js`, `pers.js`, `hoofdredacteur.js`), met zes rubrieken: nieuws, reizen, lifestyle, zaken, cultuur en sport. Een artikel heeft de standen concept, live en teruggetrokken.
- **Toetsen:** `redactie.test.js`, `edgenieuwscherm.test.js`.
- **Eigenaar:** `nieuws.lezen` → `apps/nieuws.html` (rol eigenaar, doelgroep lid).

**De acht APPWERKT-bewijzen** (register af81b538):

| Bewijs | Stand | Toelichting |
|---|---|---|
| bereikbaar | BEWEZEN | |
| bedienbaar | BEWEZEN | |
| waarheidsgetrouw | BEWEZEN | |
| bevoegd | BEWEZEN | |
| voltooibaar | GEEN_FIXTURE | het register is ouder dan het scenario `scripts/lib/voltooi/nieuws.js`; dat sluit 8/8 |
| persistent | GEEN_FIXTURE | idem; het scenario sluit 3/3 |
| herstelbaar | GEEN_FIXTURE | idem; het scenario sluit 4/4 |
| menselijk | NIET_GETEST | in het scenario afgeleid 3/3 |

#### b. Marktvergelijking (inclusief de duurste pakketten)

| Aanbieder | Pakket en prijs | Functies boven de ondergrens | Bron |
|---|---|---|---|
| Apple News+ | US$12,99 per maand, niet geverifieerd | ruim 350 titels, audioversies, offline, gezinsdeling (tot 5) | derde partijen, bv. [trustedreviews.com](https://www.trustedreviews.com/news/apple-news-plus-subscription-price-3683829) |
| Readly | EUR 14,99 per maand | ruim 8.000 titels, bladwijzers, offline, zoeken over de hele inventaris, delen met 5 huisgenoten | [corporate.readly.com/about-us](https://corporate.readly.com/about-us) |
| New York Times All Access | prijs niet geverifieerd: US$19,99 tot 25 per maand volgens derden | puzzels, recepten, audio, productreviews | [subger.com](https://subger.com/en/service/new-york-times) |
| Meltwater (duurste: monitoring voor organisaties) | Starter vanaf US$10.000, Pro vanaf 25.000, Enterprise vanaf 130.000 per jaar | waarschuwingen op onderwerpen, analyses, API, governance | [meltwater.com/en/blog/meltwater-pricing](https://www.meltwater.com/en/blog/meltwater-pricing) |

**Over, als functie:** bladwijzers, offline lezen, voorlezen, zoeken, volgen en waarschuwingen per onderwerp.

**Niet over, als verdienmodel:** betaalmuren per titel, het "lees nog 3 gratis"-model, advertentiestromen en gezinsdeling als verkoopargument. Bij RTG is lezen inbegrepen in elke pas.

#### c. Analyse van het volledige domein

**Particulier.** Een lezer wil vertrouwen ("is dit gecorrigeerd?"), tijd (een kort samenvattend overzicht in plaats van een oneindige stroom), toegankelijkheid (voorlezen, grote letters) en een eigen bewaarplek.

**Professioneel: redacties.** Een redactie werkt in de praktijk zo:
- **Beroepsnormen:** de Leidraad van de Raad voor de Journalistiek en de Code van het Genootschap van Hoofdredacteuren ([presscouncils.eu](https://www.presscouncils.eu/database/the-netherlands/), [rvdj.nl](https://rvdj.nl/english)).
- **Correcties:** gecorrigeerd wordt zichtbaar, met de datum.
- **Hoor en wederhoor.**
- **Anonieme bronnen** worden beschermd.
- **Persvrijheid naast privacy:** de AVG kent een uitzondering voor journalistieke doeleinden, en de verwerking blijft verantwoord.
- **Een klacht** gaat naar een onafhankelijke raad. Die legt geen boetes op; een eis tot rectificatie loopt via de rechter.
- **Eindredactie:** kopij → eindredactie → hoofdredactie → publicatie, en in vier ogen bij gevoelige stukken.

**Organisatorisch.**
- Een organisatie wil in de praktijk monitoring ("meld me als er over ons geschreven wordt"), persberichten en een woordvoerder. Dat is het terrein van mediamonitoring, en het hoort bij WorkOS (Werk).
- De Krant (`media.krant`, `apps/krant.html`, LivingOS-A) is de plek waar externe nieuwsbedrijven (genre `journalistiek`) publiceren.
- Nieuws blijft het werk van RTG Redactie zelf.

#### d. Functiecatalogus L1–L6

**N1 Rubriek lezen** (L1) — bestaat.
- **Gegevens:** de artikelen met stand live per rubriek (`redactie/index.js`).
- **Regel:** een concept of een teruggetrokken stuk bestaat voor de lezer niet.
- **Onzekerheid:** geen.
- **Melding:** geen.
- **Rollen:** ieder lid.
- **Uitzondering:** een lege rubriek.
- **Acceptatie:** een lid opent "Reizen" en ziet alleen live reisstukken. Een lege rubriek zegt "nog niets gepubliceerd in Reizen" en is geen leeg scherm. Dat tweede is nog na te gaan, dus half.

**N2 Rahul over het artikel** (L4) — bestaat.
- **Gegevens:** alleen de artikeltekst.
- **Regel:**
  - zonder model werkt het lokaal, met een letterlijke bronzin;
  - met een model gaat alleen de tekst mee, nooit het profiel van het lid.
- **Onzekerheid:** het antwoord heet een samenvatting en geen feit. Staat het antwoord niet in de tekst, dan zegt Rahul dat.
- **Acceptatie:** bij de vraag "wanneer opent het museum?" en een artikel zonder datum zegt Rahul "dat staat niet in dit artikel".

**N3 Leeslijst** (L1) — ontbreekt, klein, aanbevolen nu.
- **Gegevens:** artikel-ids per lid, in de eigen collectie (eigencollectie), met als eigenaar de codenaam van het lid.
- **Regel:** wordt een stuk teruggetrokken, dan blijft het op de lijst staan met "teruggetrokken op <datum>" en zonder tekst.
- **Melding:** geen; het lid ziet het bij het openen.
- **Rollen:** alleen het lid zelf.
- **Acceptatie:** bewaren, herstarten en inloggen op een ander toestel geeft dezelfde lijst, en een ander lid ziet hem niet.

**N4 Voorlezen** (L1) — ontbreekt, klein, aanbevolen nu.
- **Gegevens:** de artikeltekst, voorgelezen met de spraak van het toestel (`shared/spraak.js`).
- **Regel:** er gaat geen tekst naar buiten.
- **Uitzondering:** kan het toestel niet voorlezen, dan zegt het scherm dat.
- **Acceptatie:** "Lees voor" start; pauzeren en verder gaan werkt; vergrendelen stopt netjes.

**N5 Rubrieken volgen en ordenen** (L1) — ontbreekt, klein, aanbevolen nu.
- **Regel:** een gevolgde rubriek komt eerst. Er is geen oneindige stroom: een rubriek eindigt.
- **Acceptatie:** wie "Cultuur" volgt, ziet die als eerste, ook na opnieuw inloggen.

**N6 Correctie zichtbaar** (L5) — half (de Krant heeft correcties, Nieuws niet), klein, aanbevolen nu.
- **Gegevens:** de correctieregel van de redactie, met datum en wat er veranderde.
- **Regel:** een correctie is openbaar, oude tekst wordt nooit stil vervangen.
- **Melding:** wie het stuk op zijn leeslijst heeft, ziet "gecorrigeerd" bij het openen. Er komt geen push: niet elke correctie verdient een onderbreking.
- **Rollen:** de eindredactie schrijft, ieder lid leest.
- **Acceptatie:** na een correctie staat bovenaan "Gecorrigeerd op 19 oktober: <wat>".

**N7 Terugtrekking met reden** (L5) — ontbreekt, klein, aanbevolen nu.
- **Regel:** een teruggetrokken stuk geeft een korte pagina met de reden in één zin, door de redactie verplicht ingevuld. Bij een juridische terugtrekking kan de reden "op verzoek, om juridische redenen" zijn.
- **Acceptatie:** een gedeelde link naar een teruggetrokken stuk toont de reden, geen fout.

**N8 Zoeken in het archief** (L5) — ontbreekt, middel, later.
- **Gegevens:** live stukken.
- **Rekenwijze:** zoeken op kop en tekst.
- **Uitzondering:** teruggetrokken stukken komen niet in de uitslag.

**N9 Offline lezen** (L1) — ontbreekt, middel, later.
- **Regel:** alleen voor stukken op de leeslijst, via `sw.js`.
- **Onzekerheid:** er staat "bewaarde versie van <tijd>", omdat er intussen een correctie kan zijn.

**N10 Artikel delen als verwijzing** (L6) — ontbreekt, klein, aanbevolen nu.
- **Gegevens:** alleen het artikel-id en de kop, via `objectverwijzing.js`. De tekst wordt niet gekopieerd.
- **Rollen:** de ontvanger moet een lid zijn.
- **Uitzondering:** teruggetrokken (zie N7).
- **Acceptatie:** een vriend opent het gedeelde stuk in Nieuws, en De Salon of Berichten bewaart geen tekst.

**N11 Onderwerp-waarschuwing** (L3/L4) — ontbreekt, groot, later.
- **Regel:** het lid kiest zelf een onderwerp en hoort het één keer per dag, nooit vaker. Dit is geen engagement: het staat standaard uit.
- **Organisatorische variant:** monitoring voor een organisatie, zie "Voor de integrator".

**Niet doen:**
- **Puzzels:** de eigenaar is Spelen; Nieuws kan er hooguit naar verwijzen.
- **Advertenties en betaalmuur per stuk:** dat zijn verdienmodellen.
- **Een gepersonaliseerde eindeloze stroom:** dat is een verslavend patroon.

#### e. RTG-exclusieve mogelijkheden

- **Een verhaal dat je leven raakt, zonder dat het nieuws je leven kent.** Een reisstuk over Lissabon verschijnt als suggestie in Reisboek (`reizen.reisboek`) als het lid daar een reis heeft staan. Dat werkt als projectie via de contextbus: Nieuws weet niets van de reis.
- **Vertrouwen als functie:** elk stuk toont zichtbaar wie het eindredigeerde (codenaam) en wanneer het gecorrigeerd werd. Weinig nieuwsapps tonen dat per stuk.

#### f. Bouwstenen en ontbrekende koppelingen

- **Bestaat:** de redactiekern met standen, de correctiemotor in journalistiek (Krant), `objectverwijzing.js`, `shared/spraak.js`, `sw.js`, eigencollectie.
- **Ontbreekt:**
  - de correctie- en terugtrekkingsvelden in `redactie/` (of hergebruik van de vorm uit journalistiek);
  - een verwijzingstype "artikel";
  - de contextbus-projectie naar Reisboek.

#### g. Prioritering

| Volgorde | Wat | Kosten | Afhankelijkheid |
|---|---|---|---|
| 1 | N6 correctie zichtbaar en N7 terugtrekking met reden | klein | vertrouwen gaat voor alles |
| 2 | N3 leeslijst | klein | |
| 3 | N10 delen als verwijzing | klein | hangt af van N7 |
| 4 | N4 voorlezen | klein | |
| 5 | N5 rubrieken volgen | klein | |
| later | N8 zoeken en N9 offline | middel | N9 hangt af van N3 |
| later | N11 onderwerp-waarschuwing | groot | |

#### Uitkomst A — bouwbaar binnen de huidige architectuur en scope

N3–N10 uit de catalogus (d), in de volgorde van g. Ze gebruiken bestaande bouwstenen:
- de redactiekern;
- `objectverwijzing.js` en `spraak.js`;
- `sw.js`;
- eigencollectie.

Er komt geen nieuwe laag en geen nieuwe motor.

#### Uitkomst B — domeinmaximum, ook buiten de scope (nieuwe professionele processen)

**B1. Een redactiestatuut met klachtenafhandeling als proces.**
- **Gegevens:** per klacht het artikel-id, de klager (codenaam of extern), de klacht, de reactie van de redactie, een termijn en de uitkomst (afgewezen, rectificatie of toelichting).
- **Regels:**
  - de redactie reageert binnen een vastgelegde termijn;
  - een rectificatie verschijnt even zichtbaar als het oorspronkelijke stuk;
  - de klager kan doorverwijzen naar een onafhankelijke raad, en RTG beslist dan niet zelf.
- **Rekenwijze:** de termijn loopt vanaf de ontvangst; overschrijding wordt zichtbaar voor de hoofdredactie.
- **Rollen:** de klager, de eindredacteur en de hoofdredacteur (vier ogen bij een rectificatie).
- **Toestemming:** een klacht met persoonsgegevens is alleen zichtbaar voor de redactie.
- **Uitzondering:** een juridisch geschil. Dan schort de redactie de inhoudelijke reactie op en meldt dat.
- **Acceptatie:** een klacht leidt aantoonbaar binnen de termijn tot een uitkomst, en een rectificatie staat bovenaan het stuk met de datum.

**B2. Bronbescherming en hoor en wederhoor als vastgelegde stappen.**
- **Gegevens:** per stuk de betrokken partijen, of hun reactie gevraagd is (tijd), en het antwoord of "geen reactie".
- **Gegevens over bronnen:** een anonieme bron alleen als versleutelde notitie, zichtbaar voor de hoofdredactie.
- **Regel:** publiceren is geblokkeerd zolang een genoemde partij niet om een reactie is gevraagd, tenzij de hoofdredactie gemotiveerd afwijkt.
- **Acceptatie:** zonder vastgelegd wederhoor of een gemotiveerde afwijking kan een stuk dat een partij noemt niet live.

**B3. Mediamonitoring voor organisaties** (eigenaar WorkOS; zie "Voor de integrator").
- **Gegevens:** de onderwerpen van de organisatie en de live stukken die erover gaan.
- **Regels:** één melding per dag. Een woordvoerder kan een reactieverzoek sturen naar de redactie, en dat komt in B2 als wederhoor.
- **Acceptatie:** de organisatie hoort binnen een dag van een stuk over haar en kan een reactie geven die de redactie ziet.

#### h. Toetsbaar eindcontract (naast de acht APPWERKT-bewijzen, niet in plaats ervan)

| Dimensie | Meetbaar criterium |
|---|---|
| Breedte | alle zes rubrieken zijn leesbaar, en leeslijst, voorlezen en delen bestaan elk als stap in de voltooiproef |
| Professionele diepte | elk live stuk heeft een eindredacteur en een correctiehistorie; een toets bewijst dat een correctie nooit stil is |
| Levenscyclus | concept → live → gecorrigeerd → teruggetrokken is per stand zichtbaar voor de lezer, bewezen na een herstart |
| Samenwerking en rollen | de lezer kan niet schrijven en de redactie keurt in vier ogen (een kantoortoets) |
| Domeinintelligentie | Rahul antwoordt nooit buiten de tekst; een toets met een vraag zonder antwoord geeft "staat er niet in" |
| Los functioneren | lezen werkt zonder model, zonder Berichten en zonder netwerk (bewaard stuk), en elk scherm zegt wat niet kan |
| RTG-ketens | delen naar Berichten werkt van begin tot eind, inclusief een teruggetrokken stuk |
| Bewezen betrouwbaarheid | de acht APPWERKT-bewijzen staan op BEWEZEN in een vers register |

**Modus LOS:** lezen en Rahul werken zonder andere apps. Een lege rubriek en een onbereikbare redactie moeten een eerlijke zin geven. Dat is vandaag niet bewezen.

**Modus SAMEN:** de verwijzing "artikel" naar De Salon (`sociaal.salon`) en Berichten (`comm.berichten`), en de projectie naar Reisboek (`reizen.reisboek`). Rahul "open nieuws reizen" opent de rubriek. Nooit gedeelde data.

**Gebruikersketen:**
1. Het lid leest een stuk over Lissabon.
2. Het bewaart het op de leeslijst.
3. Het deelt het in Berichten met een vriend.
4. De vriend opent het in Nieuws.
5. Later ziet het lid in Reisboek bij zijn reis "1 stuk uit Nieuws".

Storingen:
- **Het stuk is intussen teruggetrokken:** de vriend ziet de reden, geen fout.
- **Berichten staat uit:** delen is grijs met uitleg, lezen gaat door.
- **Geen netwerk:** het bewaarde stuk opent, met "bewaarde versie".
- **De vriend heeft geen account:** na inloggen komt hij terug op het stuk.
- **Er is geen model:** Rahul vat lokaal samen en zegt dat.

**Vraagt besluit:** of Nieuws en de Krant één leesapp worden, of dat Nieuws alleen voor RTG Redactie blijft.
**Extern:** het gebruik van externe inhoud of persbureaumateriaal vraagt licenties. Voor eigen werk is niets extern.
**Voor de integrator:** mediamonitoring voor organisaties (N11, organisatorisch) hoort bij WorkOS. Die eigenaar staat niet in SCHERMEIGENAAR.json.

---

### Overzicht (link:ontdek, /apps/rtg.html)

#### a. Inventaris

**Doel:** het huis van LivingOS. Een lid ziet zijn dossier, wat er wacht en de afspraken van zijn eigen dag, en maakt het huis het zijne met een eigen beeld dat alleen hij ziet.

**Routes:**
- dossier: `/api/member/huis/dossier`, `/api/member/huis/map` en `/api/member/huis/rahul` (`server/routes/huis.js`, scherm `rtg-dossier.js`);
- kompas: `/api/agenda/mijn-lijst`, `/api/sociaal/lijn` en `/api/sociaal/wereld` (`rtg-vandaag.js`);
- beelden: `/api/ik/beelden` en `/api/bestanden/*` (`personal-images.js`).

**Toetsen:** `rtg-vandaag-lokaal.test.js`, `beeldkeuze-aba.test.js`, `sfeerbeeld-muis.e2e.js`.

**Eigenaar:** `wereld.living` → `apps/rtg.html`. Volgens besluit 5 is het Overzicht een projectie: het is alleen eigenaar van de beeldkeuze van het lid.

**De acht APPWERKT-bewijzen** (register af81b538):

| Bewijs | Stand | Toelichting |
|---|---|---|
| bereikbaar | BEWEZEN | |
| bedienbaar | BEWEZEN | |
| waarheidsgetrouw | BEWEZEN | |
| bevoegd | NIET_GETEST | 2 van de 7 routes niet gemeten: `/api/sociaal/lijn` en `/wereld` zijn onbereikbaar in IDOR.json |
| voltooibaar | GEEN_FIXTURE | het scenario `scripts/lib/voltooi/ontdek.js` sluit 7/7 |
| persistent | GEEN_FIXTURE | het scenario sluit 3/3 |
| herstelbaar | GEEN_FIXTURE | het scenario sluit 4/4 |
| menselijk | NIET_GETEST | in het scenario afgeleid 3/3 |

#### b. Marktvergelijking

- **Ondergrens:** Google Discover. Gratis en betaald met advertenties. Het lid kan onderwerpen volgen en "meer of minder" kiezen, en de stroom leert van zoek- en surfgedrag ([technipages.com](https://www.technipages.com/top-alternatives-to-google-discover-feed/), [ppc.land](https://ppc.land/googles-discover-vs-discovery-personalized-content-meets-targeted-advertising/)).
- **Betaald maximum:** een betaalde marktleider voor een persoonlijk startscherm kon ik niet verifiëren. Ik noem er geen.

**Over, als functie:** volgen, minder tonen, onderwerpen beheren.
**Niet over:** advertenties, en leren van surfgedrag buiten RTG.

#### c. Analyse van het volledige domein

**Particulier.** Een overzicht van de dag moet in de praktijk drie dingen kunnen:
- in tien seconden zeggen wat nu telt;
- eerlijk zijn over wat het niet weet;
- privé blijven op een gedeeld toestel.

**Gezin en huishouden** (organisatorisch, op kleine schaal). Wie is waar, wie haalt wie op. De eigenaar daarvan is het gezin (`gezin.*` in FoundationOS, Gezin in LivingOS-A), niet het Overzicht.

**Professioneel:** n.v.t. Werk heeft een eigen beginscherm (WorkOS).

#### d. Functiecatalogus L1–L6

**O1 Vandaag op de eigen klok** (L1) — bestaat.
- **Gegevens:** de afspraken van het lid (eigenaar `agenda.afspraken`).
- **Rekenwijze:** de lokale datum van het toestel.
- **Acceptatie:** om 01:30 Nederlandse tijd staat de afspraak van vandaag er (toets).

**O2 Eigen beeld, alleen voor mij** (L1) — bestaat.
- **Regel:** het beeld is alleen leesbaar voor het lid zelf, met een uitsnede per breedte.
- **Uitzondering:** herstellen geeft het RTG-beeld terug.
- **Acceptatie:** een ander lid krijgt 404 op mijn foto (voltooiproef, bevoegd).

**O3 Eerlijk bij een onbereikbare bron** (L5/L6) — ontbreekt, klein, aanbevolen nu.
- **Gegevens:** de antwoordstand per bron.
- **Regel:** "niets" en "niet bereikbaar" zijn verschillende zinnen.
- **Acceptatie:** valt de agenda weg, dan staat er "Agenda nu niet bereikbaar" en niet "niets vandaag". Dit kan in de liegronde getoetst worden met een gefaalde bron.

**O4 Waarom zie ik dit** (L4) — ontbreekt, klein, aanbevolen nu.
- **Regel:** elke kaart noemt in één zin de bron-app en de reden ("omdat u om 14:00 een afspraak heeft").
- **Onzekerheid:** een verwachting heet "verwacht", nooit een feit.
- **Acceptatie:** elke kaart heeft een uitleg die uit de bron-app komt.

**O5 Minder hiervan** (L1) — ontbreekt, klein, aanbevolen nu.
- **Gegevens:** een voorkeur per bron-app in de eigen collectie van het lid.
- **Regel:** het verbergt alleen hier, en wist niets in de bron-app.
- **Acceptatie:** na "minder sport" toont het Overzicht een week lang geen sportkaart, terwijl Sport zelf ongewijzigd is.

**O6 Widgets ordenen, ook op de telefoon** (L1) — half (de catalogus bestaat op desktop), middel, later.

**O7 Gezinsprojectie** (L3) — ontbreekt, middel, later.
- **Regel:** alleen wat een gezinslid zelf deelt, met intrekken op elk moment.
- **Toestemming:** per persoon en per soort.
- **Melding:** geen; de projectie is stil.
- **Eigenaar:** Gezin. Het Overzicht toont alleen.

**O8 Terugblik "gisteren"** (L5) — ontbreekt, klein, later.

**O9 Gedeeld toestel, snel wisselen** (L1) — ontbreekt, middel, later.
- **Regel:** na wisselen van account zijn beeld en dossier van de vorige meteen weg. Dat sluit aan op de kanttekening van FoundationOS over `rtf_sessie` per browser.

**Niet doen:** een ontdekstroom met advertenties of eindeloos scrollen; leren van surfgedrag buiten RTG.

#### e. RTG-exclusief

Het Overzicht is een eerlijk dashboard over het hele huis: elke kaart is een projectie met een verwijzing naar haar eigenaar, met een zin over waarom ze er staat. Bij uitval zegt het welke app, niet "alles in orde".

#### f. Bouwstenen en ontbrekende koppelingen

- **Bestaat:** het kompas, het dossier, persoonlijke beelden, Heel RTG en de catalogus-poort, de contextbus in `rtg-schil`, de liegronde.
- **Ontbreekt:**
  - per bron een stand "onbereikbaar" in het kompas;
  - een uitlegveld per kaart;
  - een voorkeur voor "minder".

#### g. Prioritering

| Volgorde | Wat | Kosten |
|---|---|---|
| 1 | O3 eerlijk bij uitval | klein |
| 2 | O4 waarom zie ik dit | klein |
| 3 | O5 minder hiervan | klein |
| later | O6 widgets ordenen | middel |
| later | O7 gezinsprojectie | middel |
| later | O9 gedeeld toestel | middel |

**Afhankelijkheid:** O7 vraagt het besluit over wie "de dag" bezit (zie "Vraagt besluit").

#### Uitkomst A — bouwbaar binnen de scope

O3, O4 en O5 (klein), daarna O6–O9. Ze gebruiken bestaande bouwstenen: het kompas, de contextbus, de liegronde en eigencollectie.

#### Uitkomst B — domeinmaximum

**B1. Een huishoudoverzicht als gezamenlijk proces.**
- **Gegevens:** per lid van het huishouden zelf gedeelde kaarten (ophalen, afwezig, taak), met als eigenaar Gezin.
- **Regels:**
  - delen gebeurt per persoon en per soort;
  - een kind deelt via de ouder (de FoundationOS-gezinsregel);
  - intrekken werkt direct.
- **Melding:** alleen bij een conflict ("twee mensen halen niemand op").
- **Rekenwijze:** een overlap in tijd tussen de gedeelde kaarten.
- **Rollen:** volwassenen in het huishouden; kinderen zien alleen hun eigen kaart.
- **Uitzondering:** co-ouderschap. Dan zijn er twee huishoudens en geen gedeelde lijst.
- **Acceptatie:** bij een overlap krijgen beide ouders één melding met de twee kaarten; na intrekken is de kaart bij de ander weg.

**B2. Een dagelijkse "stand van mijn leven" als verslag voor het lid zelf.**
- **Gegevens:** de projecties van gisteren: afspraken, reizen en zaken.
- **Regel:** er is geen score en geen vergelijking; het verslag is alleen leesbaar voor het lid.
- **Acceptatie:** het lid opent "gisteren" en ziet zijn eigen afspraken, met een verwijzing naar elke bron.

#### h. Eindcontract

| Dimensie | Meetbaar criterium |
|---|---|
| Breedte | dossier, dag, beeld en minstens vier bron-apps staan als kaart |
| Professionele diepte | n.v.t., en dat staat in het contract |
| Levenscyclus | een beeld kiezen, herstellen en opnieuw kiezen werkt na een crash (bestaat) |
| Samenwerking en rollen | een ander lid ziet niets; een gezinslid alleen wat gedeeld is |
| Domeinintelligentie | elke kaart met een verwachting is gelabeld; de toets eist het label |
| Los functioneren | met agenda en sociaal uit zegt het scherm per bron "niet bereikbaar" (de liegronde) |
| RTG-ketens | tikken op een kaart opent de eigenaar-app op het juiste object |
| Bewezen betrouwbaarheid | acht keer BEWEZEN, met bevoegd na het meetbaar maken van `/api/sociaal/*` in IDOR |

**Modus LOS:** vandaag zegt het kompas "Vandaag staat er niets in uw agenda", ook als de agenda niet antwoordt. Dat haalt de harde eis niet (O3).
**Modus SAMEN:** projecties via de contextbus; Heel RTG en Rahul openen alles vanuit hier; het Overzicht is nooit eigenaar.

**Gebruikersketen:**
1. Het lid opent 's ochtends het Overzicht.
2. Het ziet "14:00 tandarts" en "vlucht 2 uur later" (Reizen).
3. Het tikt de afspraak aan.
4. In Agenda verzet het die.
5. Terug in het Overzicht staat de nieuwe tijd.

Storingen:
- **Agenda antwoordt niet:** "Agenda nu niet bereikbaar".
- **Reizen staat uit:** geen kaart, en ook niet "op tijd".
- **De tik valt weg tijdens het verzetten:** de oude tijd blijft in beide apps.
- **Een ander lid op hetzelfde toestel:** het eigen beeld en het dossier van de vorige zijn weg.

**Vraagt besluit:** wie is eigenaar van "de dag": Vandaag (LivingOS-A, `dag.overzicht` is `apps/life.html`) of het Overzicht? Twee dagbeelden mogen niet uiteenlopen.
**Extern:** niets.

---

### Rendez-vous (link:rendezvous, /apps/rendezvous.html)

#### a. Inventaris

**Doel:** de besloten ontmoetingsapp voor Signature-leden (Lifestyle en Business) met een geverifieerd paspoort. In ONTMOETEN.md: "Rendez-vous maakt de juiste ontmoeting".

**Routes:**
- 28 onder `/api/member/rendezvous/*`: profiel, kandidaten, like, pas, matches, blokkeer, tafels, introducties, circles, arrange, concierge, date, encounter, samen, aanwezig en foto's;
- de chat, media en oproep via `/api/connection/rendezvous/*`.

**Kern:** `server/kern/rendezvous*.js` (15 bestanden). De poort is `kern/ontmoetpoort.js` (18+ met een geverifieerd paspoort), gedeeld met Vonk.

**Toets:** `rendezvous.test.js`.

**Eigenaar:** `sociaal.ontmoeten` → `apps/rendezvous.html`. Vonk heeft een eigen eigenaar: `daten.vonk` → `apps/vonk.html`.

**De acht APPWERKT-bewijzen** (register af81b538):

| Bewijs | Stand | Toelichting |
|---|---|---|
| bereikbaar | BEWEZEN | |
| bedienbaar | BEWEZEN | |
| waarheidsgetrouw | NIET_GETEST | het scherm toonde "undefined" bij een leeg antwoord; **gerepareerd in c5d6e935e** (test/rendezvous-leeg.e2e.js). Het register meet het opnieuw in de centrale ronde |
| bevoegd | NIET_GETEST | 9 van de 38 routes niet gemeten, zoals `/api/ice` en `/api/gids/app` |
| voltooibaar | GEEN_FIXTURE | het scenario `scripts/lib/voltooi/rendezvous.js` sluit 10/10, inclusief de chat |
| persistent | GEEN_FIXTURE | het scenario sluit 3/3 |
| herstelbaar | GEEN_FIXTURE | het scenario sluit 6/6 |
| menselijk | NIET_GETEST | |

#### b. Marktvergelijking (inclusief de duurste pakketten)

Prijzen variëren per land, leeftijd en looptijd. Alle bedragen hieronder zijn gemeld door derde partijen of komen uit een FAQ.

| Aanbieder | Pakket en prijs | Wat de betaalde laag geeft | Bron |
|---|---|---|---|
| Hinge | Hinge+ ca. US$19,99–29,99 per maand, HingeX US$49,99 per maand | gratis 8 likes per dag; meer zichtbaarheid | [lowermysubs.com](https://www.lowermysubs.com/blog/hinge-retention-offer) |
| Raya | lidmaatschap ca. US$24,99 en Raya+ US$49,99 per maand (augustus 2025) | op uitnodiging, met een commissie; Raya+ geeft "wie vond mij leuk", onbeperkt liken en reisplannen | [subger.com](https://subger.com/en/service/raya) |
| The League | Owner ca. US$249 en Investor ca. US$999 per maand; tot ca. US$30.000 per jaar volgens Fortune (2024) | | [swipestats.io](https://www.swipestats.io/blog/the-league-review), [fortune.com](https://fortune.com/2024/01/07/wealthy-gen-z-millennial-singles-paying-thousands-the-league-dating-app) |
| Tawkify (duurste: matchmaker die een mens is) | pakketten vanaf US$4.900, tot ca. US$70.000 | een matchmaker die zelf zoekt en introduceert | [tawkify.com/w/faq](https://Tawkify.com/w/faq), [photofeeler](https://blog.photofeeler.com/tawkify/) |

**Over, als functie:**
- zien wie je leuk vond (bij ons inbegrepen);
- reisplannen;
- strikte discretie;
- een menselijke introductie.

**Niet over:**
- **zichtbaarheid kopen of boost:** verboden;
- **likes afknijpen of onbeperkt verkopen:** Rendez-vous is eindig per introductie;
- **introducties per stuk verkopen:** ONTMOETEN.md par. 5 zegt "geen gemeten sociale toegang".

#### c. Analyse van het volledige domein

**Particulier.** In de praktijk wil een lid:
- **veiligheid:** wie weet waar ik ben, en of de ander echt is;
- **discretie:** een codenaam, en niemand die een screenshot maakt;
- **eerlijke afwijzing**, zonder zich te hoeven verantwoorden;
- **tijd:** een eindige selectie, geen lijst die eindeloos doorgaat.

**Professioneel: matchmakers en datingbureaus.** Zo werken ze in het vak:
- een intakegesprek;
- een vooraf afgesproken aantal introducties;
- de identiteit wordt gecontroleerd;
- na de date is er feedback;
- gegevens over seksuele geaardheid zijn bijzondere persoonsgegevens en worden zo behandeld (AVG art. 9).

**Organisatorisch.** Groepsontmoetingen: tafels, circles en evenementen.
- De tafel woont bij Table (`leven.tafel-gelegenheid` → `apps/table.html`).
- Evenementen horen bij Uitgaan (`leven.uitgaan`) en de horecazaak.

#### d. Functiecatalogus L1–L6

**R1 Wederzijdse match op codenaam** (L1) — bestaat (voltooiproef).
- **Regel:** alleen de twee zien de match, een derde niets (bewezen).

**R2 Zien wie mij leuk vond** (L1) — bestaat, inbegrepen (voltooiproef stap 3).
- **Acceptatie:** B ziet het zonder te betalen; een derde ziet het niet.

**R3 Chat van de match** (L1/L6) — bestaat.
- **Regel:** een herhaalsleutel per bericht (a59fe89ea); een derde krijgt 404.
- **Acceptatie:** een dubbele tik en een crash geven één bericht (bewezen).

**R4 Blokkeren en elegant afsluiten** (L5) — bestaat.
- **Regel:** wie blokkeert, hoeft zich niet te verantwoorden (par. 4.6).
- **Acceptatie:** de blokkade blijft na een crash, in een nieuwe sessie (bewezen).

**R5 Reisplannen, opgegeven en niet afgeleid** (L1) — half (`arrange`, aanwezigheid), middel, aanbevolen nu.
- **Gegevens:** stad en datumvenster, opgegeven door het lid.
- **Regel:** het wordt nooit afgeleid uit GPS (par. 4.3) en vervalt na het venster.
- **Melding:** geen push. Het lid ziet het bij het openen.
- **Acceptatie:** wie "Lissabon 12–15 november" zet, verschijnt in die dagen voor leden in Lissabon, en daarna niet meer.

**R6 Veilige date** (L1/L6) — half (Veilig bestaat, eigenaar `veilig.noodcontacten`, LivingOS-A), klein, aanbevolen nu.
- **Gegevens:** tijd en plaats van de date, gedeeld met één contact dat het lid in Veilig koos.
- **Regel:** het delen sluit vanzelf na een afgesproken tijd.
- **Melding:** het contact hoort het alleen als het lid de veiligheidsknop gebruikt.
- **Acceptatie:** delen, de date en afloop leveren geen bericht meer op; een alarm bereikt alleen het gekozen contact.

**R7 Date als verwijzing in Agenda** (L6) — ontbreekt, klein, aanbevolen nu.
- **Regel:** een verwijzing bij beide leden. Bij afzeggen verdwijnt hij bij allebei, zonder reden.
- **Acceptatie:** na afzeggen door A is hij weg bij B en staat er "afgezegd".

**R8 Wissen bij opzeggen** (L5) — onbekend, aanbevolen nu, eerst meten.
- **Gegevens:** profiel, foto's, chat en aanwezigheid.
- **Regel:** wissen, behalve wat de wet vraagt; het meten vraagt de lezer van de opslag (`vindInOpslag`).
- **Acceptatie:** na opzeggen is het merkteken nergens in de opslag te vinden.

**R9 Leeg antwoord, geen "undefined"** (L5) — **bestaat sinds c5d6e935e**: Today en Matches zeggen "Het antwoord was onvolledig, dus dit kon niet worden geladen." in plaats van de JS-fout. Toets: test/rendezvous-leeg.e2e.js.
- **Acceptatie:** de liegronde met een leeg antwoord toont een eerlijke zin.

**R10 Melden van lekken (screenshots, echte naam)** (L3) — half (melden bestaat), klein, aanbevolen nu.
- **Regel:** een mens van RTG beslist, nooit de AI.
- **Acceptatie:** een melding komt bij het kantoor, en het lid hoort de uitkomst.

**R11 Menselijke matchmaker** (L2) — ontbreekt; vraagt besluit (er is geen genre).
- **Regel als het komt:**
  - de matchmaker werkt op codenaam;
  - een introductie leunt nooit op een derde (par. 4.2);
  - het lid zegt per introductie ja of nee.

**R12 Concierge regelt de ontmoeting** (L3) — bestaat (`rendezvous-concierge.js`).
- **Regel:** het lid keurt goed, en er staat nooit "geboekt" voordat de zaak bevestigde.

**Niet doen:**
- **boost en zichtbaarheid kopen:** verdienmodellen;
- **een cijfer op een mens:** par. 4.4;
- **een publiek profiel:** par. 5;
- **"nog 3 uur om te reageren":** kunstmatige urgentie.

#### e. RTG-exclusief

De hele avond in één keten:
1. de match;
2. De Rechterhand regelt een tafel bij een echte zaak;
3. de date staat bij allebei in de agenda;
4. Veilig houdt een vertrouwd contact op de hoogte;
5. de afloop is elegant.

Er zijn vier eigenaars en geen gedeelde data. Daarbij geldt overal dezelfde poort (18+ met een paspoort, door een mens gekeurd) en draait alles op codenamen.

#### f. Bouwstenen en ontbrekende koppelingen

- **Bestaat:** de ontmoetpoort, de 15 kernbestanden, de connection-chat met herhaalsleutel, de concierge, Veilig en objectverwijzing.
- **Ontbreekt:**
  - de verwijzing "date" naar Agenda;
  - de koppeling van een date aan Veilig;
  - een meting van het wissen bij opzeggen;
  - de reparatie van het lege antwoord.

#### g. Prioritering

| Volgorde | Wat | Kosten |
|---|---|---|
| gedaan | R9 leeg antwoord (c5d6e935e) | — |
| 2 | R8 wissen meten | klein voor de meting |
| 3 | R6 veilige date | klein |
| 4 | R7 date in Agenda | klein |
| 5 | R10 melden van lekken | klein |
| later | R5 reisplannen | middel |
| besluit | R11 menselijke matchmaker | |

**Afhankelijkheid:** R6 en R7 vragen afstemming met LivingOS-A (Veilig) en de eigenaar van Agenda.

#### Uitkomst A — bouwbaar binnen de scope

R5–R10 en R12, in de volgorde van g. Ze gebruiken de ontmoetpoort, connection-chat, Veilig, objectverwijzing en de concierge.

#### Uitkomst B — domeinmaximum (nieuwe professionele processen)

**B1. Menselijke matchmaking als beroep binnen RTG.**
- **Gegevens:**
  - een intake (op codenaam, de antwoorden van het lid);
  - een introductiebudget per periode, voor kwaliteit en niet te koop;
  - per introductie het ja of nee van beide;
  - feedback na de date, alleen voor de matchmaker.
- **Regels:**
  - de matchmaker ziet nooit een echte naam;
  - een introductie leunt nooit op een derde (par. 4.2);
  - de matchmaker stelt voor, het lid beslist;
  - geaardheid en relatievorm zijn bijzondere persoonsgegevens (AVG art. 9), met een aparte toestemming en zichtbaar alleen voor de matchmaker.
- **Rollen:** het lid, de matchmaker (een nieuw genre met een persoonseis: VOG-achtig vakbewijs via `persoonseis.js`) en het kantoor dat toezicht houdt.
- **Uitzondering:** het lid trekt de toestemming in. Dan wist de matchmaker de intake, en de wisregel is bewezen met de opslaglezer.
- **Acceptatie:**
  - het lid krijgt een introductie met een reden in woorden en kan zonder uitleg nee zeggen;
  - na intrekken is de intake nergens meer te vinden.

**B2. Feedback na de date als zorgproces, niet als beoordeling.**
- **Gegevens:** per date een korte eigen terugblik van het lid ("veilig gevoeld ja/nee", "wil ik opnieuw").
- **Regels:**
  - er komt nooit een cijfer op de ander;
  - "niet veilig gevoeld" komt bij een mens van het kantoor, die beslist;
  - de ander hoort niets, behalve een besluit.
- **Acceptatie:** een melding "niet veilig" leidt binnen een vastgelegde termijn tot contact door een mens, en de gemelde persoon ziet geen score.

**B3. Een besloten evenement voor leden (salon-avond).**
- **Eigenaars:** Uitgaan of de horecazaak voor het evenement, Rendez-vous voor de uitnodiging.
- **Regels:** alleen leden die de ontmoetpoort halen; aanwezigheid alleen opgegeven; geen deelnemerslijst met echte namen.
- **Acceptatie:** een uitgenodigd lid ziet alleen codenamen van wie ook ja zei, en alleen na eigen ja.

#### h. Eindcontract

| Dimensie | Meetbaar criterium |
|---|---|
| Breedte | match, chat, tafel, circle en reisplan staan als stappen in de voltooiproef |
| Professionele diepte | de identiteitskeuring is een besluit van een mens (bestaat); een matchmaker-genre na het besluit |
| Levenscyclus | van profiel tot afsluiten en wissen; het wissen bewezen met de opslaglezer |
| Samenwerking en rollen | een derde ziet niets; een pas-loze krijgt PASS_REQUIRED; zonder paspoort IDENTITY_REQUIRED (bestaat) |
| Domeinintelligentie | Rahul stelt alleen voor, en geen enkel scherm toont een score |
| Los functioneren | zonder concierge en zonder Agenda werkt de kern, met een eerlijke zin |
| RTG-ketens | de avondketen (e) van begin tot eind, met storingen |
| Bewezen betrouwbaarheid | acht keer BEWEZEN, inclusief waarheidsgetrouw na R9 |

**Modus LOS:** profiel, match, chat en blokkeren werken zelfstandig, en de voltooiproef loopt alleen die routes. Valt de concierge weg, dan moet het scherm "regelen kan nu niet" zeggen. Dat is niet bewezen.
**Modus SAMEN:** de keten van e. Heel RTG toont Rendez-vous alleen met de pas (de catalogus-poort).

**Gebruikersketen:** de avondketen (e).

Storingen:
- **B blokkeert intussen:** het voorstel vervalt neutraal.
- **De zaak weigert:** De Rechterhand stelt een alternatief voor.
- **Agenda staat uit:** de date blijft in Rendez-vous, met de melding.
- **Geen netwerk bij akkoord:** één akkoord door de herhaalsleutel.
- **De pas van A vervalt:** PASS_REQUIRED met de reden, en voor B neutraal.
- **Het Veilig-contact is onbereikbaar:** het alarm meldt dat en biedt de nooddeur aan.

**Vraagt besluit:**
- een genre voor menselijke relatiebemiddeling;
- de bewaartermijn bij opzeggen.

**Extern:** de identiteitskeuring blijft bij RTG, door een mens. Tafels lopen via echte zaken; hun bevestiging is extern.

---

### Privékantoor / De Rechterhand (link:rechterhand, /apps/lifestyle.html)

#### a. Inventaris

**Doel:** een Lifestyle-lid vertelt een wens in één zin. De Rechterhand regelt hem. Buiten zijn mandaat beslist het lid over een concreet voorstel. Daaromheen ligt het Privékantoor: Nu, Vooruit, Zaken, Kantoor, Woning, Kring, Bezit, Reis, Veilig, Mandaat en Overzicht.

**De AI** belooft nooit toegang, en meldt nooit iets als geboekt voordat de zaak het bevestigde.

**Routes:**
- 42 onder `/api/member/bureau/*` en 5 lusroutes onder `/api/member/bureau/lus/*`;
- de kantoorkant via `/api/office/bureau/lus/*` (`server/routes/office/concierge.js`);
- de zaakkant via `/api/supplier/concierge/opdrachten`.

**Kern:** `server/kern/bureau/` (27 bestanden: lus, cases, delegatie, twin, collectie, reisdek, relaties, reputatie, dieren, beveiliging en ai).

**Toetsen:** `conciergelus.test.js`, `-kern`, `-regels`, `-dubbel`, `-naam` en `conciergelusscherm.e2e.js`.

**Eigenaar:** `concierge.privekantoor` → `apps/lifestyle.html` (doelgroep lifestyle-lid).

**De acht APPWERKT-bewijzen** (register af81b538):

| Bewijs | Stand | Toelichting |
|---|---|---|
| bereikbaar | BEWEZEN | |
| bedienbaar | BEWEZEN | |
| waarheidsgetrouw | BEWEZEN | |
| bevoegd | NIET_GETEST | 1 van de 73 routes niet gemeten |
| voltooibaar | NIET_GETEST | vervallen conciergeproef; sinds vandaag levert het scenario `scripts/lib/voltooi/rechterhand.js` dit, en het sluit 8/8 |
| persistent | GEEN_FIXTURE | het scenario sluit 3/3 |
| herstelbaar | GEEN_FIXTURE | het scenario sluit 4/4 |
| menselijk | NIET_GETEST | |

Het scenario loopt met een echt lid, een pas uit een menselijk besluit en een kantoormens op naam.

#### b. Marktvergelijking (inclusief de duurste pakketten)

| Aanbieder | Pakket en prijs | Bron |
|---|---|---|
| Quintessentially | ca. US$1.500, 5.000–7.000 en 20.000 per jaar (Elite, op uitnodiging); £24.000 per jaar voor een team (2008). Alles uit oudere artikelen, niet geverifieerd | [floridatrend.com](https://www.floridatrend.com/article/304/concierges), [dailynewsegypt.com](https://www.dailynewsegypt.com/2008/01/11/whatever-your-little-heart-desires) |
| Ten Lifestyle | voor bedrijven of banken £7.000–36.000 (niet geverifieerd); 24/7, 26 talen, reizen, dining, entertainment, retail | [tenlifestylegroup.com](https://tenlifestylegroup.com/what-ten-does/how-we-do-it/) |

**Duurste klasse:** het family office (huishouden, vermogen, personeel, veiligheid). Prijzen zijn daar niet openbaar.

**Over, als functie:**
- 24/7 bereikbaar;
- meertalig;
- reizen, tafels en tickets via de officiële kassa;
- een vaste persoon als aanspreekpunt;
- een geheugen voor voorkeuren.

**Niet over:**
- servicelagen binnen een pas: de Lifestyle Pass dekt alles;
- "elke gastenlijst" als belofte: de AI belooft geen toegang.

#### c. Analyse van het volledige domein

**Particulier.** Een lid wil één aanspreekpunt, geheugen (wat wil mijn vrouw nooit), een eerlijk "dit lukt niet, wel dit", en geen rompslomp.

**Professioneel: concierges.** Hoe het vak werkt, volgens Les Clefs d'Or:
- geen commissies of incentives die een aanbeveling sturen;
- vertrouwelijkheid;
- nooit een uitkomst beloven die je niet zeker kunt leveren;
- verborgen kosten en kledingvoorschriften vooraf melden.

Bronnen: [ehotelier.com](https://insights.ehotelier.com/news/2014/05/20/les-clefs-dor-and-the-modern-concierge/), [mixtemagazine.ca](https://www.mixtemagazine.ca/en/?p=12509). De officiële codetekst heb ik niet gevonden.

**Organisatorisch: family offices.** Hoe die in de praktijk werken:
- mandaten per domein (tot welk bedrag, welke zaken);
- vier ogen bij geld;
- personeelsbeheer;
- veiligheid;
- archief van bezit en herkomst.

RTG heeft daarvoor al `delegatie.js`, `collectie.js` (herkomst, taxatie, bruikleen) en `beveiliging.js`.

#### d. Functiecatalogus L1–L6

**P1 Wens in één zin → case** (L1) — bestaat.
- **Gegevens:** de zin van het lid.
- **Rekenwijze:** `lus-intake.js` haalt er tijd, plaats, harde wensen en verrassing uit; zonder model met de regels in `lus-regels.js`.
- **Acceptatie:** "Diner morgen om 20 uur, geen noten" geeft 20:00, Amsterdam, "geen noten" (voltooiproef).

**P2 Mandaat** (L1/L3) — bestaat.
- **Gegevens:** de delegatie per domein (`delegatie.js`).
- **Regel:** binnen het mandaat zet het kantoor vast; daarbuiten krijgt het lid een voorstel met de reden.
- **Melding:** bij een voorstel krijgt het lid één melding; niet bij elke tussenstap.
- **Acceptatie:** een aanbod buiten de speelruimte geeft "vastgezet: nee" en een voorstel (voltooiproef).

**P3 Mens op naam per case** (L3) — bestaat.
- **Regel:** de codenaam van de medewerker; met de gedeelde kantoorcode is het een rol.
- **Acceptatie:** nooit "user-1" (toets `-naam`).

**P4 Zaak ziet alleen haar onderdeel** (L3) — bestaat.
- **Gegevens:** een positieve lijst velden (`lus-regels`, deelnemerBeeld).
- **Acceptatie:** een tweede zaak ziet niets (conciergeproef).

**P5 Vertraging zet berichten klaar** (L5) — bestaat.
- **Regel:** versturen kan pas als alles gezien is (conciergeproef).

**P6 Omgevallen onderdeel → herstel in dezelfde case** (L5) — bestaat.

**P7 Bevestigd door de zaak, zichtbaar per onderdeel** (L5) — half, klein, aanbevolen nu.
- **Regel:** "bevestigd" staat er alleen als de zaak het zelf bevestigde.
- **Acceptatie:** zonder bevestiging van de zaak staat er "wacht op de zaak", nooit "geregeld".

**P8 Wens per spraak** (L1) — ontbreekt, klein, aanbevolen nu.
- **Gegevens:** spraak, op het toestel omgezet (`shared/spraak.js`).
- **Regel:** er gaat geen opname naar buiten; de tekst gaat de normale intake in.
- **Acceptatie:** een ingesproken wens geeft dezelfde case als de getypte.

**P9 Case als verwijzing in Agenda en Berichten** (L6) — ontbreekt, klein, aanbevolen nu.
- **Regel:** een verzette tijd verzet de verwijzing.
- **Acceptatie:** na verzetten klopt de agenda.

**P10 Responstijd die RTG belooft** (L3) — half, groot (bezetting), vraagt besluit.
- **Rekenwijze:** de tijd tot het oppakken (de stap "neem").
- **Onzekerheid:** een verwachte tijd heet "verwacht".
- **Acceptatie:** een wens om 03:00 krijgt een mens of een eerlijke tijd.

**P11 Geen commissie stuurt een advies** (L2/L3) — ontbreekt als regel, klein, aanbevolen nu.
- **Gegevens:** per voorstel staat vermeld of er een commerciële relatie met de zaak is.
- **Regel:** volgens de norm van het vak beïnvloedt een commissie het advies niet; RTG maakt de relatie zichtbaar.
- **Acceptatie:** het lid ziet bij elk voorstel "RTG ontvangt hier niets" of wat RTG wel ontvangt.

**P12 Kosten en voorwaarden vooraf** (L5) — half, klein, aanbevolen nu.
- **Regel:** een kledingvoorschrift, een annuleringsvoorwaarde en een verborgen kost horen bij het voorstel.
- **Acceptatie:** een voorstel zonder die velden kan het kantoor niet versturen.

**P13 Kring, bezit, woning, dieren, reputatie** (L1) — bestaat (de tabbladen); de voltooiproef loopt alleen de lus.
- **Later:** een eigen scenario per tabblad.

**Niet doen:**
- servicelagen of "Elite" binnen een pas;
- toegang beloven;
- AI die zelf afspraken vastzet zonder mandaat.

#### e. RTG-exclusief

Het Privékantoor is een family office op codenaam. Mandaat, zaak, reis, kring en veiligheid hangen aan elkaar zonder dat één app de data van een ander bezit. Bij elk voorstel staat een open verklaring over geld en commissie.

#### f. Bouwstenen en ontbrekende koppelingen

- **Bestaat:** de hele lus (intake, mandaat, aanbod, kies, vertraging, kapot, bevestig, uitkomst), delegatie, collectie, reisdek, relaties en beveiliging.
- **Ontbreekt:**
  - een verwijzing naar Agenda en Berichten;
  - een veld "commerciële relatie" per aanbod;
  - verplichte velden voor voorwaarden;
  - de spraakingang.

#### g. Prioritering

| Volgorde | Wat | Kosten |
|---|---|---|
| 1 | P7 bevestigd door de zaak | klein |
| 2 | P11 geen commissie stuurt het advies | klein |
| 3 | P12 kosten en voorwaarden vooraf | klein |
| 4 | P9 case in Agenda en Berichten | klein |
| 5 | P8 wens per spraak | klein |
| later | P13 scenario's per tabblad | middel |
| besluit | P10 responstijd | groot (bezetting) |

#### Uitkomst A — bouwbaar binnen de scope

P7, P11, P12, P9 en P8 (klein), daarna P13. Ze gebruiken de bestaande lus, delegatie, collectie en reisdek. Er komt geen nieuwe motor.

#### Uitkomst B — domeinmaximum (nieuwe professionele processen, family office)

**B1. Huispersoneel als proces.**
- **Gegevens:**
  - de medewerkers van het huishouden (op codenaam);
  - hun rol (chauffeur, huishoudster, kok, beveiliging);
  - rooster, contract en vakbewijs.
- **Regels:**
  - beveiliging en kinderopvang vragen een persoonseis (`persoonseis.js`, reikwijdte werk);
  - het loon loopt via de bestaande payrollketen van WorkOS;
  - het lid is werkgever, RTG niet.
- **Rollen:** het lid als werkgever, een beheerder met mandaat en de medewerker (die ziet alleen het eigen rooster).
- **Uitzondering:** een uitzendkracht. Dan is het een inleenrelatie.
- **Acceptatie:** een medewerker zonder geldig vakbewijs kan geen dienst met een beveiligingstaak aannemen, en het lid ziet waarom.

**B2. Mandaat met vier ogen bij geld.**
- **Gegevens:** een uitgave boven een drempel per domein.
- **Regels:**
  - boven de drempel tekenen twee mensen: het lid en een gemachtigde, of twee gemachtigden;
  - nooit dezelfde persoon twee keer (zoals `kern/appstore/vierogen.js`).
- **Rekenwijze:** de drempel geldt per domein en per periode, en het bedrag wordt opgeteld over de periode.
- **Melding:** het lid hoort bij elke uitgave boven de drempel.
- **Uitzondering:** een noodgeval. Dan mag één handtekening, met een verplichte reden en melding achteraf.
- **Acceptatie:** een tweede uitgave die samen boven de drempel komt, wacht op een tweede handtekening.

**B3. Herkomst en verzekering van bezit als doorlopend proces.**
- **Gegevens:** een stuk uit de collectie, met herkomst, taxatie, bruikleen en verzekerde waarde (`collectie.js` bestaat).
- **Regels:**
  - een taxatie verloopt na een vastgelegde termijn en wordt bij elke vraag opnieuw gerekend;
  - een bruikleen eindigt met een terugmelding.
- **Melding:** twee maanden voor het verlopen van een taxatie.
- **Onzekerheid:** een waarde is een taxatie op een datum, nooit een marktprijs van vandaag.
- **Acceptatie:** een verlopen taxatie staat als "verlopen" en niet als actuele waarde, en een stuk in bruikleen toont waar het is en tot wanneer.

**B4. Responstijd en bezetting als dienstverlening met een belofte.**
- **Gegevens:** de tijd tot het oppakken per case en het rooster van het kantoor.
- **Regels:**
  - RTG belooft alleen een tijd die het rooster haalt;
  - buiten het rooster zegt het scherm wanneer iemand begint.
- **Rekenwijze:** een mediaan en een 90e percentiel per week, gemeten en niet geschat.
- **Acceptatie:** de beloofde tijd staat zichtbaar en wordt aantoonbaar gehaald in de gemeten week, of het scherm zegt eerlijk dat het niet lukte.

#### h. Eindcontract

| Dimensie | Meetbaar criterium |
|---|---|
| Breedte | elk tabblad heeft een scenario in de voltooiproef |
| Professionele diepte | elk voorstel draagt voorwaarden en de commerciële relatie; de toets weigert een voorstel zonder |
| Levenscyclus | van intake tot uitkomst, inclusief herstel na een omgevallen onderdeel, bewezen na een crash |
| Samenwerking en rollen | lid, kantoor op naam en zaak, elk met eigen zicht; een tweede zaak ziet niets |
| Domeinintelligentie | de intake zonder model geeft dezelfde velden; voorstellen buiten het mandaat worden nooit vastgezet |
| Los functioneren | zonder kantoorbezetting staat er een eerlijke tijd; zonder model werken de regels |
| RTG-ketens | Reizen → vertraging → case → zaak → Agenda en partner, van begin tot eind |
| Bewezen betrouwbaarheid | acht keer BEWEZEN, met voltooibaar uit het nieuwe scenario |

**Modus LOS:** intake, case, voorstel en besluit werken zonder andere apps. Bij een kantoor zonder bezetting blijft de case "in voorbereiding" staan, zonder verwachte tijd. Dat haalt de eis nog niet (P10).
**Modus SAMEN:** Reizen (reisdek), zaken (opdrachten), Rendez-vous (concierge) en Agenda en Berichten (P9). Rahul "open privékantoor" opent het. Heel RTG toont het alleen met de pas.

**Gebruikersketen:**
1. De vlucht naar Lissabon gaat twee uur later (Reizen).
2. "Verzet het diner."
3. De zaak weigert 22:00 en biedt 22:30.
4. Dat valt buiten het mandaat, dus het lid zegt ja.
5. Agenda en de partner (Berichten) zien 22:30.

Storingen:
- **De zaak antwoordt niet:** "wacht op de zaak", nooit "geregeld".
- **Geen netwerk bij het ja:** één akkoord (bewezen).
- **Agenda staat uit:** de case meldt het.
- **De pas vervalt:** het Privékantoor is dicht met de reden, en het kantoor sluit de case netjes af.

**Vraagt besluit:**
- de responstijd en de bezetting 24/7;
- een genre voor particuliere dienstverlening en huishoudpersoneel (L2).

**Extern:** de leverende zaken en hun bevestiging; de menselijke bezetting van het kantoor.

**Voor de integrator:** de concierge-behoefte van Reizen (`reizen.reisbureau`) en Horeca-evenementen raakt deze lus. Dat is geen dubbele logica: zij leveren onderdelen aan de case, en de case blijft van De Rechterhand.


---

## Handel (LivingOS-B)

Vier apps rond kopen, vragen en reserveren: **Commerce, Mall, Mijn bestellingen en Food Court**. Geschreven volgens de aanscherping van de eigenaar (19 oktober, later): diep en volledig, vier onderzoeken per app, elke functie bouwbaar concreet, en een toetsbaar eindcontract dat de acht APPWERKT-bewijzen NIET vervangt.

### Gemeenschappelijke grond voor de vier

**De grens die de code zelf trekt.** RTG stelt samen en zet klaar, de zaak bevestigt (`kern/commerce/overdracht.js`: "een overdracht draagt de keuze over, nooit de bevestiging"; `kern/mall/bestellingen.js`: "geen gezamenlijke afrekening"). Geen van de vier bestelt, boekt of betaalt namens het lid. Betalen is van Geld (`geld.overzicht` → apps/geld.html, RTG Pay, wallet, betaalnaad), bevestigen is van het domein van de verkoper. Deze apps geven alleen verwijzingen uit: een bestel-, aanvraag- of reservering-id plus de zaakcode.

**Eigenaren volgens SCHERMEIGENAAR.json:**
- `winkel.commerce` → apps/commerce.html
- `winkel.mall` → apps/mall.html
- `winkel.bestellingen` → apps/mijnmall.html
- `horeca.reserveren` → apps/foodcourt.html

**Open oordeel 29** ("gedeeltelijk", stand open): twee winkelingangen voor een lid, Mall en Commerce, elk met een eigen mand of aanvraagweg. De eigenaar is mall.html. **Besluit nodig**: Commerce is volgens COMMERCE.md een laag en geen etalage, en wordt dan de verkoperskant of een stand van de Mall.

**Bewezen stand (gemeten, niet geschat).**
- **APPWERKT.json (nulmeting, commit af81b538):** voor alle vier zijn zeven van de acht bewijzen BEWEZEN. Bevoegd staat bij alle vier op NIET_GETEST, omdat routes "in IDOR.json onbereikbaar" zijn.
- **VOLTOOIPROEF.json (gemeten op f85c044e):** alle vier sluiten op voltooibaar, persistent, herstelbaar en menselijk.
- **Dit is het belangrijkste gat in de handelsfamilie:** dat een ander lid jouw mand, lijst of reservering niet ziet, is in de voltooiproeven beproefd maar niet in de bevoegdronde.

**Domeinbronnen die voor de hele familie gelden.** Echte organisaties en wetten staan hier als BRON, nooit als partner.

| Onderwerp | Bron | Wat het voor RTG betekent |
|---|---|---|
| Herroepingsrecht op afstand | Richtlijn 2011/83/EU (consumentenrechten), art. 9-16, https://eur-lex.europa.eu/eli/dir/2011/83/oj; in NL BW 7:46d | 14 dagen bedenktijd na ontvangst bij koop op afstand. Uitzonderingen: o.a. bederfelijk, op maat gemaakt, en diensten op een vaste datum zoals een restaurantreservering (art. 16 sub l). |
| Prijsverlaging tonen | Richtlijn 2019/2161 (Omnibus), via art. 6 bis Prijsaanduidingsrichtlijn, https://eur-lex.europa.eu/eli/dir/2019/2161/oj | "Van/voor" alleen met de laagste prijs van de afgelopen 30 dagen. |
| Marktplaats-transparantie | Verordening 2019/1150 (P2B), https://eur-lex.europa.eu/eli/reg/2019/1150/oj | De rangorde van aanbod moet uitlegbaar zijn voor de zakelijke gebruiker. |
| Traceerbaarheid van handelaren | Verordening 2022/2065 (DSA), art. 30-32, https://eur-lex.europa.eu/eli/reg/2022/2065/oj | Een marktplaats kent de handelaar, en de koper ziet wie de verkoper is. |
| Allergenen | Verordening 1169/2011, bijlage II (14 allergenen), https://eur-lex.europa.eu/eli/reg/2011/1169/oj | Ook horeca moet de allergenen kunnen noemen. |
| Btw | NL 9% en 21%, met de tarieven per categorie | In de code via `kern/fiscaal/tarief.js` (één bron). |

**Marktvergelijking, ook de duurste pakketten** (peildatum 2026-10-19; functies over, verdienmodellen niet):

| Aanbieder (marktreferentie) | Pakket en prijs | Bron | Betrouwbaarheid |
|---|---|---|---|
| Amazon Prime | $139/jaar of $14,99/maand (VS) | https://www.nerdwallet.com/finance/learn/amazon-prime-benefits-cost-worth | consistent over bronnen |
| bol.com Select | € 14,99/jaar (BE, klacht dec. 2025) | https://www.bol.com/be/nl/tc/select-voorwaarden/ | andere bronnen noemen € 11,99–12; niet eenduidig |
| Zalando Plus | vroeger € 9,95–14,95/jaar; nu volgens meerdere bronnen een gratis puntensysteem | https://www.retaildetail.be/nl/news/mode/zalando-plus-ledenprogramma-nu-ook-in-belgie/ | bronnen 2020–2024; geen officiële pagina gevonden |
| Shopify Plus (verkoperskant, duurste pakket) | vanaf $2.300/maand (3 jaar) of $2.500/maand (1 jaar), plus een variabel deel | https://useamp.com/blog/how-much-does-shopify-plus-cost/ | het variabele deel publiceert Shopify volgens één bron niet |
| OpenTable voor restaurants (duurste pakket Pro) | Basic $39/maand + $1,50/cover, Core $249, Pro $449 + $1/cover | https://www.capterra.com.au/software/17313/opentable-for-restaurants | een concurrent noemt hogere bedragen; niet officieel geverifieerd |
| TheFork Yums (diner) | punten per reservering, 1.000 Yums ≈ € 10 korting | https://loyaltyrewardco.com/thefork/ | bron 2022; actuele voorwaarden niet geverifieerd |

Wat RTG overneemt zijn de **functies**: bezorging en retourophaling inbegrepen, ledenprijs, vroege toegang, wachtlijst, tafelvoorkeuren, en een verkoperskant met voorraad, omnichannel en rapportage. Wat RTG **niet** overneemt: spaarpunten, levels, aftellende deals, betaalde zichtbaarheid en "dubbele punten"-acties. Dat zijn lokmechanieken, verboden onder "geen verslavende patronen" en "progressie alleen 18+".

---

### Commerce (link:commerce, /apps/commerce.html)

**Doel.** De verkooplaag boven de domeinen. Een lid ziet wat koopbaar is, legt het in één mand, krijgt per verkoper een afrekening met btw en met wat bevestigen blokkeert, en geeft zijn keuze als briefje door aan de deur die wel bevestigt. Hier wordt niets besteld en niets betaald.

#### a. Inventaris van het bewezen bestaande

- **Routes** (server/routes/commerce.js): `/api/commerce/aanbod`, `/etalage`, `/mand`, `/mand/zet`, `/mand/leeg`, `/overdracht/maak`, `/overdracht/lees`, `/overdracht/mijn`, `/retour/vraag`, `/retour/verstuurd`, `/retour/mijn`, `/reken`.
- **Verkoperskant:** leverancier-commerce.html met `/api/supplier/verkoopweg/*` en `/api/supplier/retour/*`.
- **Kern** (`server/kern/commerce/`):
  - `koopbaar` en `koopbaarlijst`: wat een domein aanmeldt;
  - `werkwoorden` en `werkwoordlijst`: toon, prijs, beschikbaarheid, reserveer, bevestig, lever, annuleer, retour;
  - `NIET_GEBOUWD`: ruil, abonnement, veiling en levering door derden, met reden;
  - `mand`, `afrekening` en `afrekenregel`: btw uit het brutobedrag via `kern/fiscaal/tarief.js`, en een onbekend tarief geeft null, geen nul;
  - `overdracht`: een bevroren briefje met datum;
  - `retour`, `retourlijst` en `retourstand`: zes gronden, vijf standen, verval na 60 dagen;
  - `prijsvraag`, `verkoopweg` en `graaf`.
- **Voltooiscenario** `scripts/lib/voltooi/commerce.js`.
- **Toetsen:** commerce-kern, -overdracht, -prijsvraag, -publiek, -retour, -verkoopweg, commerce.test, commerce-scherm.e2e en commerce-mand-scherm.e2e.

| Bewijs (APPWERKT) | Stand | Waar het op rust |
|---|---|---|
| bereikbaar | BEWEZEN | opent voor een lid zonder poort en zonder fout |
| bedienbaar | BEWEZEN | 5 van 7 eigen knoppen; 1 niet aan te tikken (element niet zichtbaar) |
| menselijk | BEWEZEN | geen kale fout, en meldingen in woorden in de voltooiproef |
| voltooibaar | BEWEZEN | voltooiproef 6/6 |
| waarheidsgetrouw | BEWEZEN | 11 antwoorden gelogen, geen verzonnen zekerheid |
| persistent | BEWEZEN | 3/3 |
| bevoegd | **NIET_GETEST** | 9 van 9 routes zijn "in IDOR.json onbereikbaar" |
| herstelbaar | BEWEZEN | 4/4; de dubbeltik is beproefd op het zetten van een aantal, want "In mand" telt met opzet op |

Niet gelopen: bevestigen en betalen in het domein, en de retour na een echte bestelling.

#### b. Marktvergelijking

| Betaalde functie bij de markt | Bij wie | RTG | Waar in de code |
|---|---|---|---|
| Gratis of snelle bezorging | Prime, Select | nee | `lever` is een werkwoord; levering door derden staat in NIET_GEBOUWD |
| Retour ophalen | Select, voorheen Zalando Plus | half | de retourstroom bestaat; ophalen bestaat niet |
| Ledenprijs / deals | Select | nee | — |
| Eén mand over verkopers | marktplaatsen | **ja** | `kern/commerce/mand.js`, afrekening per verkoper |
| Btw per regel, per verkoper | verkoperspakketten | **ja** | `afrekenregel.js` en `fiscaal/tarief.js` |
| Verkoopkanalen beheren (omnichannel) | Shopify Plus | half | `verkoopweg.js` voor de zaak |

#### c. Volledig domein

- **Particulier:** een koper wil weten wat het kost, wie de verkoper is, wanneer het komt, hoe hij terugstuurt en wat zijn rechten zijn.
- **Professioneel (winkelier):** werkt met voorraad, prijzen inclusief btw, kanalen, retourafhandeling met inspectie, een orderkenmerk en betaalbewijs. Het moment van levering bepaalt de herroepingstermijn.
- **Organisatorisch (marktplaats-exploitant):**
  - traceerbaarheid van handelaren (DSA art. 30);
  - een uitlegbare rangorde (P2B art. 5);
  - klachtafhandeling;
  - prijsverlagingen met de laagste prijs van 30 dagen (Omnibus).
- **Wat in de code ontbreekt:**
  - een termijn van 14 dagen voor de grond `bedenktijd`, gerekend vanaf de levering;
  - de uitzonderingen per soort goed;
  - het "laagste prijs 30 dagen"-veld.

#### d. Functiecatalogus

**F1 · Mand over verkopers met afrekening per verkoper** (L1/L5, **bestaat**)
- **Gegevens:** koopbare items uit de domeinen (koopbaar.js), aantal per regel van het lid.
- **Regels:** bedragen rekent de server; de mand bewaart geen bedragen.
- **Rekenwijze:** bruto per regel, btw eruit met het tarief van zaak en categorie.
- **Onzekerheid:** een onbekend tarief toont "btw onbekend", nooit 0%.
- **Melding:** geen.
- **Rollen:** alleen het lid.
- **Uitzonderingen:** verkoper weg → blokkade in de afrekening.
- **Acceptatie:** het lid ziet per verkoper een eigen totaal met btw en met wat bevestigen blokkeert; een ander lid ziet deze mand niet.
- **Kosten** — / **bak** —.

**F2 · Briefje naar de deur van het domein** (L6, **bestaat**)
- **Gegevens:** verkoper, pagina en bevroren regels met datum.
- **Regels:** de inhoud komt van de server, nooit uit het verzoek.
- **Rollen:** alleen het lid leest het briefje.
- **Uitzonderingen:** verlopen of van een ander → 404 met uitleg.
- **Acceptatie:** het domeinscherm opent met de keuze ingevuld; rekent het domein anders, dan toont het domein het verschil.
- — / —.

**F3 · Herroepingstermijn van 14 dagen** (L5, **ontbreekt**)
- **Gegevens:** leverdatum uit `lever` van het domein, soort goed uit koopbaar.
- **Regels:** BW 7:46d. 14 dagen vanaf de dag na ontvangst. Uitgesloten zijn o.a. op maat gemaakt, bederfelijk, verzegeld en geopend, en diensten op een vaste datum (art. 16).
- **Rekenwijze:** einddatum = levering + 14 dagen, in de zone van de koper.
- **Onzekerheid:** zonder gemeten leverdatum staat er "termijn loopt vanaf levering; levering nog niet vastgesteld", geen datum.
- **Melding:** in de app 3 dagen voor het einde, één keer, zonder pushmelding om terug te lokken.
- **Rollen:** de koper ziet het; de verkoper ziet dezelfde einddatum.
- **Acceptatie:** bij een bedenktijd-retour toont het scherm de einddatum. Na de einddatum is `bedenktijd` niet meer kiesbaar, met de wet als reden; de andere gronden blijven.
- **Kosten** middel / **bak** aanbevolen nu.

**F4 · Retour volgen tot de afronding** (L5, **half**)
- **Gegevens:** de vijf standen van retourlijst.js, met wie elke stand zet.
- **Regels:** RTG zet geen stand. Geld gaat nooit vanzelf terug (GELD.md par. 3).
- **Melding:** het lid hoort het bij `aanvaard` en bij de afronding.
- **Rollen:** koper, en de verkoper in leverancier-commerce.
- **Uitzonderingen:** na 60 dagen zonder handeling: vervallen, met reden.
- **Acceptatie:** het lid ziet elke stand met de naam van de rol die hem zette, en hoort het één keer bij aanvaarding en bij afronding.
- **Kosten** klein / **bak** aanbevolen nu.

**F5 · Laagste prijs van 30 dagen bij een prijsverlaging** (L2, **ontbreekt**)
- **Gegevens:** de prijshistorie van het koopbaar item bij de zaak.
- **Regels:** Omnibus. Een "was"-prijs mag alleen de laagste van de afgelopen 30 dagen zijn.
- **Rekenwijze:** minimum over 30 dagen.
- **Onzekerheid:** zonder 30 dagen historie staat er geen "was"-prijs.
- **Rollen:** de zaak zet de prijs; het lid ziet het.
- **Acceptatie:** een verlaagde prijs toont "laagste prijs afgelopen 30 dagen: € x"; zonder historie toont het scherm geen doorgestreepte prijs.
- **Kosten** middel / **bak** later. Het hoort bij de verkoperskant en vraagt prijshistorie in het domein.

**F6 · Bezorging en retourophaling "inbegrepen in uw pas"** (L5, **ontbreekt**)
- **Gegevens:** de levermogelijkheden van de zaak.
- **Regels:** inbegrepen alleen als de zaak het aanbiedt en de kosten bij een partij liggen.
- **Acceptatie:** waar de zaak bezorgt, staat "inbegrepen" in plaats van een bezorgprijs; waar niet, staat er "afhalen bij de zaak".
- **Kosten** groot / **bak** later. Vraagt besluit wie de kosten draagt.

**F7 · Eén winkelingang** (L6, **half**)
- **Regels:** volgt het besluit over oordeel 29.
- **Acceptatie:** een lid heeft één plek om te kopen; Commerce is daarvan een stand of de verkoperskant, en de mand is één mand.
- **Kosten** middel / **bak** aanbevolen nu, na besluit.

**F8 · Verkoper op naam van de handelaar** (L3, **half**)
- **Regels:** DSA art. 30-32. De koper ziet de handelsnaam van de verkoper, nooit een codenaam van een lid.
- **Acceptatie:** elke afrekeningsregel noemt de verkopende zaak en hoe die bereikbaar is.
- **Kosten** klein / **bak** aanbevolen nu.

**Niet doen:**
- betaalde zichtbaarheid of boost (lokmechaniek);
- aftellende deals (kunstmatige urgentie);
- automatische terugbetaling (GELD.md par. 3);
- een retourscore op kopers of verkopers (ranglijst, verboden in de kop van retourlijst.js).

#### e. RTG-exclusief
- **Eén mand over domeinen die elders aparte apps zijn:** een fles uit de Cellier, een tafel uit de Food Court en een klus, met per verkoper de btw. RTG doet nooit alsof het bevestigd heeft.
- **De retourgrond als gesloten keuze, met de rol die elke stand zet:** dat maakt de retour vergelijkbaar en toetsbaar, zonder score op mensen.

#### f. Bouwstenen en ontbrekende koppelingen
- **Bestaand:** mand, afrekening, overdracht, retour, verkoopweg, fiscaal/tarief.
- **Ontbrekende koppelingen:**
  - de leverdatum van het domein naar de retour (voor F3);
  - prijshistorie per koopbaar (voor F5);
  - een IDOR-route in de bevoegdronde, zodat bevoegd meetbaar wordt.

#### g. Prioritering
| Volgorde | Functie | Kosten | Complexiteit | Afhankelijk van |
|---|---|---|---|---|
| 1 | Bevoegdronde voor commerce-routes | klein | laag | Bevoegd-agent (IDOR.json) |
| 2 | F7 één winkelingang | middel | middel | besluit oordeel 29 |
| 3 | F3 termijn van 14 dagen | middel | middel | een leverdatum uit het domein |
| 4 | F4 retour volgen + F8 handelsnaam | klein | laag | — |
| 5 | F5 laagste prijs 30 dagen | middel | middel | prijshistorie verkoperskant |
| 6 | F6 inbegrepen bezorging | groot | hoog | besluit over kosten, mobiliteitslaag |

#### h. Toetsbaar eindcontract (vervangt de acht APPWERKT-bewijzen niet)
| Dimensie | Meetbaar criterium |
|---|---|
| Breedte | Elk werkwoord uit WERKWOORDEN heeft een koopbaar domein dat het levert, en elk NIET_GEBOUWD-werkwoord heeft zijn reden op het scherm. |
| Professionele diepte | Een bedenktijd-retour toont de wettelijke einddatum en weigert na de termijn, met de wet als reden. |
| Levenscyclus | Kiezen → afrekenen → overdragen → bevestigd (domein) → retour → afgerond, in één voltooiscenario. |
| Samenwerking en rollen | Elke retourstand draagt de rol die hem zette; RTG staat er nergens bij. |
| Domeinintelligentie | Geen voorspelling. Elk getoond bedrag is een rekenuitkomst van de server met een tarief, of "onbekend". |
| Los functioneren | Met een verkoperdomein uit: de mand blijft, en de afrekening toont die verkoper als blokkade. |
| RTG-ketens | Het briefje opent het domeinscherm met de keuze ingevuld, en de bestelling staat daarna in Mijn bestellingen. |
| Bewezen betrouwbaarheid | Alle acht APPWERKT-bewijzen BEWEZEN, inclusief bevoegd. |

#### Uitkomst A — binnen de huidige architectuur en scope
Bouwbaar met de bestaande kern (commerce/*, fiscaal/tarief, mall, Geld als betaaleigenaar), zonder nieuwe laag:
- F3 termijn van 14 dagen
- F4 retour volgen
- F7 één winkelingang (na besluit)
- F8 handelsnaam
- F5 laagste prijs 30 dagen
- bevoegd meetbaar maken

Volgorde en kosten staan onder g. Elke functie heeft haar acceptatiecriterium onder d.

#### Uitkomst B — het domeinmaximum, ook buiten de huidige scope
Compleet nieuwe professionele processen. Elk vraagt een besluit van de eigenaar en valt buiten V1.

**B1 · Retourinspectie met voorraadterugboeking** (proces voor de winkelier)
- **Gegevens:** retourregel, foto's van de staat bij ontvangst, voorraadpositie van de zaak.
- **Regels:**
  - de inspecteur kiest een staat uit een gesloten lijst: nieuw, gebruikt-verkoopbaar, beschadigd, onverkoopbaar;
  - alleen nieuw en verkoopbaar gaan terug in de voorraad;
  - de btw-correctie volgt het oorspronkelijke tarief.
- **Rekenwijze:** terug te betalen bedrag = koopprijs − waardevermindering. Een waardevermindering mag alleen bij behandeling verder dan nodig om aard, kenmerken en werking vast te stellen (Richtlijn 2011/83/EU art. 14 lid 2).
- **Rollen:** inspecteur (werkrol zaak) en koper.
- **Toestemming:** de koper ziet de foto's en de staat voordat het bedrag vastligt.
- **Uitzonderingen:** binnen de bedenktijd zonder gebrek geldt geen waardevermindering.
- **Acceptatie:** bij een retour "beschadigd" ziet de koper de foto, de staat en het berekende bedrag met de wettelijke grond. Geld zet de terugbetaling pas klaar na een mens die akkoord geeft.

**B2 · Marktplaatskeuring van handelaren (KYBC)** (proces voor de exploitant)
- **Gegevens:** handelsnaam, KvK-nummer, adres, contact en betaalrekening, als bewijsstukken (de zaakkeuring `kern/aanmeldingen/bewijs.js` bestaat al voor genres).
- **Regels:** DSA art. 30. Geen verkoop vóór volledige gegevens; een periodieke herkeuring.
- **Rekenwijze:** volledigheid per veld.
- **Rollen:** kantoor (keurder) en zaak.
- **Toestemming:** de zaak levert de gegevens; de koper ziet alleen wat de wet voorschrijft.
- **Uitzonderingen:** een particuliere verkoper in de tweedehandsmarkt (`winkel.tweedehands`) heeft een eigen regime.
- **Acceptatie:** een zaak zonder volledige handelsgegevens kan geen koopbaar item publiceren, en de reden staat in haar app.

**B3 · Geschillen- en klachtenregeling** (proces voor de exploitant)
- **Gegevens:** de klacht, het orderkenmerk, de stappen.
- **Regels:**
  - de verkoper antwoordt binnen een termijn;
  - daarna gaat het naar een bemiddelaar van RTG (mens);
  - de uitkomst is advies, geen beslissing over geld zonder akkoord van de verkoper (GELD.md par. 3).
- **Rollen:** koper, verkoper, bemiddelaar (kantoor).
- **Acceptatie:** elke klacht heeft een termijn per stap en een uitkomst met reden. Een bemiddelaar kan geen geld verplaatsen.

**B4 · Bundelafspraak over verkopers** (proces voor de koper)
- **Regels:** een "alles of niets"-keuze: de overdracht gaat alleen door als elke verkoper binnen een venster bevestigt; anders vervalt alles.
- **Rekenwijze:** venster per verkoper.
- **Rollen:** koper en verkopers.
- **Uitzonderingen:** één verkoper die weigert laat het geheel vervallen, zonder kosten.
- **Acceptatie:** bij een weigering van één verkoper wordt er bij geen enkele verkoper iets vastgelegd, en de koper hoort waarom.

**Modus LOS.**
- De mand en de afrekening werken zonder andere apps.
- Valt een domein weg, dan toont de afrekening dat als blokkade (ontworpen in afrekening.js; op het scherm niet apart beproefd).
- Zonder Geld: Commerce betaalt toch niet, dus de kerntaak blijft heel.

**Modus SAMEN.**
- **Uitgegeven:** het overdrachtsbriefje.
- **Ontvangen:** de koopbare dingen uit de domeinen.
- **Vindbaar:** via Heel RTG en Rahul "open commerce".

**Gebruikersketen.** Een lid legt een fles uit de Cellier en een tafel uit de Food Court in de mand. Het ziet twee afrekeningen, tikt "door naar de zaak", en het Food Court-scherm opent met datum en gezelschap ingevuld. De zaak bevestigt, en Mijn bestellingen toont de tafel. Vijf dagen na de levering vraagt het lid een bedenktijd-retour voor de fles.

*Storingen:*
- Food Court is uit: de afrekening zegt dat bevestigen daar nu niet kan, en de Cellier-regel blijft.
- Het briefje is van een ander: 404.
- De leverdatum is onbekend: geen einddatum, wel de tekst "loopt vanaf levering".
- Dag 15: `bedenktijd` is niet meer kiesbaar, met de wet als reden; `defect` wel.

**Vraagt besluit.** Oordeel 29 (één winkelingang). Wie de bezorgkosten draagt. **Extern.** Vervoerders voor bezorging en retour (geen merk als partner).

---

### Mall (link:mall, /apps/mall.html)

**Doel.** Een lid vindt aanbod over alle domeinen, zet het in eigen lijsten (reismand, verlanglijst), bewaart met een hartje in de vaste lijst "Bewaard", en beheert zijn App-Bibliotheek. Er komt geen melding die je opzoekt, geen aftellende klok en geen voorspelling.

#### a. Inventaris
- **Routes:**
  - Mall: `/api/mall`, `/mall/home`, `/zoek`, `/plekken`, `/lijsten`, `/lijst`, `/lijst/nieuw`, `/lijst/zet`, `/lijst/weg`, `/lijst/voegtoe`, `/lijst/regel-weg`, `/bewaar`, `/bewaard`, `/wijzigingen`, `/collecties`, `/collectie`, `/concierge`, `/zakelijk`, `/living`, `/eigen`;
  - App-Bibliotheek: `/mall/apps`, `/apps/catalogus`, `/apps/installeer`, `/apps/weg`, `/apps/mijn`;
  - App Store: `/api/appstore/*`;
  - routebestanden: mall-vindlaag.js en winkel-bieb.js.
- **Kern** (`server/kern/mall/`): aanbod, aanbodrtg, aanbodzaken, catalogus, zoek, zoekweging, zoekfilters, lijsten, lijstregel, bewaard, collecties, etalage, levende-etalage, kaart, extern, concierge, thuisplein.
- **Voltooiscenario** `scripts/lib/voltooi/mall.js`.
- **Toetsen:** mall-bewaard, -lijsten, -collecties, -concierge, -kaart, -extern, -context.

| Bewijs | Stand | Waar het op rust |
|---|---|---|
| bereikbaar | BEWEZEN | |
| bedienbaar | **NIET_GETEST** | 8 van 72 eigen knoppen aangetikt; een pagina antwoordde niet |
| menselijk | BEWEZEN | |
| voltooibaar | BEWEZEN | 5/5 |
| waarheidsgetrouw | BEWEZEN | 16 gelogen antwoorden |
| persistent | BEWEZEN | 3/3 |
| bevoegd | **NIET_GETEST** | 21 van 61 routes ongemeten |
| herstelbaar | BEWEZEN | 4/4 |

Niet gelopen: bestellen, boeken en betalen bij de verkopers; prijswijzigingen op een bewaarde regel; de concierge.

#### b. Marktvergelijking
| Functie | Bij wie | RTG | Waar |
|---|---|---|---|
| Lijsten en verlanglijst | marktplaatsen (gratis) | **ja** | lijsten.js, bewaard.js |
| Ledendeals en vroege toegang | Prime, Select, voorheen Zalando Plus | nee | — |
| Prijsmelding op de verlanglijst | marktplaatsen | half | `/api/mall/wijzigingen`, alleen in de app |
| Delen van een lijst | marktplaatsen | nee | — |
| Inbegrepen digitale extra's (apps) | Prime (video, muziek) | **ja, breder** | App-Bibliotheek: installeren kost 0 in de pas |

#### c. Volledig domein
- **Particulier:** zoekt, vergelijkt, bewaart, deelt met huisgenoten en wil weten of de prijs veranderde.
- **Professioneel (zaak):** wil gevonden worden op eerlijke gronden, een etalage bijhouden en collecties maken. Een marktplaats moet uitleggen waarom de ene zaak boven de andere staat (P2B art. 5).
- **Organisatorisch (exploitant):** zet curatie (collecties) apart van de rangorde, weert schijnaanbiedingen (DSA art. 31: de handelaar compleet en betrouwbaar) en voert een klachtenregeling.

#### d. Functiecatalogus

**M1 · Zoeken over alle domeinen met een uitlegbare rangorde** (L1/L6, **half**)
- **Gegevens:** aanbod uit de tien domeinen (aanbod.js).
- **Regels:** de weging staat in zoekweging.js.
- **Rekenwijze:** gewogen score.
- **Onzekerheid:** geen verborgen betaalde plaats.
- **Rollen:** lid en zaak.
- **Acceptatie:** bij elke treffer kan het lid "waarom staat dit hier" openen en ziet het de gronden (afstand, overeenkomst, beschikbaarheid). Een zaak ziet in haar app dezelfde gronden.
- **Kosten** klein / **bak** aanbevolen nu. Het gat is de uitleg, niet de weging.

**M2 · Bewaard en eigen lijsten** (L1, **bestaat**)
- **Acceptatie:** Bewaard verschijnt bij het eerste hartje en kan niet weg; de lijsten staan op elk toestel van het lid.

**M3 · Prijswijziging op een bewaarde regel** (L1/L4, **half**)
- **Gegevens:** de prijs bij het bewaren, en de huidige prijs van het domein.
- **Rekenwijze:** het verschil in centen.
- **Onzekerheid:** valt het domein weg, dan staat er "prijs nu niet op te halen", en nooit de oude prijs als nieuwe.
- **Melding:** alleen in de app, bij openen van de lijst. Geen pushmelding.
- **Acceptatie:** het lid ziet oud en nieuw naast elkaar met de datum van de wijziging.
- **Kosten** klein / **bak** aanbevolen nu, met een toets in de voltooiproef.

**M4 · Een lijst delen met een verbonden lid** (L1/L3, **ontbreekt**)
- **Gegevens:** de lijst van de eigenaar en de Salon-verbinding.
- **Regels:** de eigenaar blijft eigenaar. De ander mag lezen, of lezen en aanvullen.
- **Melding:** de ander hoort het één keer bij het delen.
- **Rollen:** eigenaar en gast-lezer.
- **Uitzonderingen:** na het verbreken van de verbinding is de toegang weg.
- **Acceptatie:** de ander ziet de lijst en kan aanvullen als dat mag; de lijst verhuist nooit naar zijn account.
- **Kosten** middel / **bak** later.

**M5 · Ledenprijs van een zaak** (L2, **ontbreekt**)
- **Regels:** de zaak zet hem. Hij moet aantoonbaar lager zijn dan de prijs voor niet-leden (Omnibus geldt bij "was").
- **Acceptatie:** de ledenprijs staat naast de gewone prijs; is het verschil nul, dan staat er niets.
- **Kosten** middel / **bak** later. Vraagt besluit.

**M6 · Concierge in gewone taal** (L4, **half**)
- **Gegevens:** de vraag van het lid.
- **Regels:** lokaal-eerst; zonder model werkt het gewone zoeken door.
- **Onzekerheid:** een voorstel is geen feit en geen bevestiging.
- **Acceptatie:** staat het model uit, dan zegt de concierge dat in één zin en blijft het zoekveld werken. Een voorstel wijst altijd naar de deur van de zaak.
- **Kosten** klein / **bak** aanbevolen nu.

**M7 · App-Bibliotheek in de pas** (L1, **bestaat**)
- **Acceptatie:** installeren kost 0, en een tweede installatie geeft geen tweede exemplaar.

**M8 · Collecties gescheiden van de rangorde** (L3, **half**)
- **Regels:** een collectie is curatie door RTG of de zaak, zichtbaar als "samengesteld door …".
- **Acceptatie:** elke collectie noemt wie haar samenstelde.
- **Kosten** klein / **bak** aanbevolen nu.

**Niet doen:** een oneindige feed of gepersonaliseerde lokdeals (verslavend), en een gekochte bovenaan-plaats (P2B en de huisregel).

#### e. RTG-exclusief
- **Aanbod uit tien domeinen in één zoek, waarvan de bron uitvalt zonder te verdwijnen:** de lijst zegt "kon niet ophalen" in plaats van stil minder te tonen.
- **Apps zijn inbegrepen in de pas:** de App-Bibliotheek kost niets extra.

#### f. Bouwstenen en ontbrekende koppelingen
- **Bestaand:** zoekweging, lijsten, bewaard, wijzigingen, collecties, concierge, appbieb.
- **Ontbrekend:**
  - de uitleg per treffer (M1);
  - deellijsten op de bestaande verbindingen (M4);
  - bedienbaar: 72 eigen knoppen, 8 aangetikt, wat de meting zelf moet verbreden;
  - een bevoegdronde voor 21 routes.

#### g. Prioritering
| Volgorde | Functie | Kosten | Complexiteit | Afhankelijk van |
|---|---|---|---|---|
| 1 | Bedienbaar en bevoegd meetbaar maken | middel | middel | APPWERKT- en Bevoegd-agent |
| 2 | M1 uitleg van de rangorde | klein | laag | zoekweging.js |
| 3 | M3 prijswijziging in de proef | klein | laag | een verkoper die zijn prijs verandert |
| 4 | M6, M8 | klein | laag | — |
| 5 | M4 deellijst | middel | middel | verbindingen (Salon) |
| 6 | M5 ledenprijs | middel | middel | besluit |

#### h. Toetsbaar eindcontract
| Dimensie | Criterium |
|---|---|
| Breedte | Zoeken levert treffers uit alle tien domeinen van aanbod.js. |
| Professionele diepte | Elke treffer heeft een opvraagbare uitleg van zijn plaats. |
| Levenscyclus | Vinden → bewaren → lijst → deur van de zaak → bestelling in Mijn bestellingen, in één scenario. |
| Samenwerking en rollen | Een gedeelde lijst blijft eigendom van de maker; de ander verliest toegang bij het verbreken van de verbinding. |
| Domeinintelligentie | Een concierge-voorstel draagt het label "voorstel", en zonder model blijft zoeken werken. |
| Los functioneren | Met een domein uit toont de lijst "kon niet ophalen" bij die regels. |
| RTG-ketens | Een lijstregel opent het domeinscherm met het item geselecteerd. |
| Bewezen betrouwbaarheid | Acht APPWERKT-bewijzen BEWEZEN; bedienbaar over alle eigen knoppen. |

#### Uitkomst A — binnen de huidige architectuur en scope
- M1 uitleg van de rangorde
- M3 prijswijziging
- M6 concierge eerlijk zonder model
- M8 collecties met samensteller
- M4 deellijst op bestaande verbindingen
- bedienbaar en bevoegd meetbaar

Volgorde onder g.

#### Uitkomst B — het domeinmaximum
**B1 · Uitlegbaarheidsdossier voor zakelijke gebruikers** (P2B art. 5)
- **Gegevens:** de wegingsparameters per zoekopdracht.
- **Regels:** elke zaak kan opvragen welke hoofdparameters haar plaats bepaalden.
- **Rekenwijze:** dezelfde als zoekweging.js; het dossier bevat geen andermans gegevens.
- **Rollen:** zaak en kantoor.
- **Acceptatie:** een zaak ziet voor een zoekterm de drie zwaarste factoren van haar positie. Een wijziging van de weging staat met datum in een logboek dat zaken kunnen lezen.

**B2 · Gezinsboodschappenlijst met budget** (gezinsproces)
- **Gegevens:** de gedeelde lijst en het potje uit Geld (alleen een verwijzing).
- **Regels:**
  - een kind kan items voorstellen, een ouder keurt goed;
  - het budget leest het saldo van het potje maar schrijft niet.
- **Rollen:** ouder en kind (gezinsprofiel).
- **Toestemming:** de ouder deelt.
- **Uitzonderingen:** geen progressie of beloning voor kinderen.
- **Acceptatie:** het voorstel van een kind verschijnt als "voorgesteld" tot een ouder het goedkeurt. Het getoonde budget is gelijk aan Geld en verandert daar niets.

**B3 · Inkooplijst voor een organisatie** (organisatorisch)
- **Gegevens:** de lijst van een werkruimte.
- **Regels:**
  - een aanvrager zet regels;
  - een budgethouder keurt goed tot een drempel;
  - daarboven keurt een tweede persoon goed (vier ogen, zoals `kern/appstore/vierogen.js`).
- **Rollen:** aanvrager, budgethouder (werkrol werkruimte).
- **Acceptatie:** boven de drempel kan dezelfde persoon niet zowel aanvragen als goedkeuren.

**LOS.** Zoeken, lijsten en bewaren werken op de eigen opslag van het lid. **SAMEN.** De Mall geeft lijstregels uit die naar de deur van het domein wijzen, plus een overdracht naar Commerce. Ze ontvangt aanbod uit tien domeinen. Vindbaar via Heel RTG en Rahul "open mall".

**Gebruikersketen.** Een lid zoekt "picknick", bewaart een mand van een zaak en een plek uit Uitgaan, en zet ze in de lijst "Zondag". Het deelt die lijst met een vriend, die er een fles bij zet. Op zondag tikt het door naar de zaak.

*Storingen:*
- Het model staat uit: de concierge zegt dat, en het zoeken werkt door.
- De zaak is van de kaart: de regel blijft staan met "niet meer leverbaar".
- De vriendschap wordt verbroken: de vriend ziet de lijst niet meer.
- Offline: de lijst is leesbaar, wijzigen wacht.

**Voor de integrator.** Uitgaan (`leven.avond` → avond.html) en Cellier (`leven.cellier`) leveren aanbod aan de Mall. Hun eigenaar blijft hun eigen app.

---

### Mijn bestellingen (link:mijnmall, /apps/mijnmall.html)

**Doel.** De vraagkant en het overzicht. Wat niemand aanbiedt, kun je vragen; wat er loopt, staat op één plek. Een aanvraag is geen boeking of betaling.

#### a. Inventaris
- **Routes:** `/api/mall/aanvraag`, `/aanvragen/mijn`, `/aanvraag/wijzig`, `/heropen`, `/sluit`, `/kies`, `/mall/bestellingen`, `/bewaard`, `/collecties`, `/wijzigingen`, `/home`, `/lijst*`.
- **Zaakkant:** `/api/supplier/mall/aanvraag/behandel`.
- **Kern:** `kern/mall/aanvragen.js`, `aanvraag-acties.js` en `bestellingen.js`. Dat laatste leest uit vijf domeinen, schrijft niets, en een kapotte bron komt als "stuk" terug.
- **Voltooiscenario** `scripts/lib/voltooi/mijnmall.js`, met drie actoren.
- **Toetsen:** mall-aanvraag-levensloop en mall-bestellingen.

| Bewijs | Stand |
|---|---|
| bereikbaar | BEWEZEN |
| bedienbaar | BEWEZEN (2/2) |
| menselijk | BEWEZEN |
| voltooibaar | BEWEZEN (6/6) |
| waarheidsgetrouw | BEWEZEN (15 gelogen antwoorden) |
| persistent | BEWEZEN (3/3) |
| bevoegd | **NIET_GETEST** (2 van 18 routes; `/api/supplier/mall/aanvraag/behandel` staat niet in IDOR) |
| herstelbaar | BEWEZEN (4/4) |

Niet gelopen: de bestellingen, lijsten en bewaarde items op dit scherm, en het verlopen na 30 dagen.

#### b. Marktvergelijking
| Functie | Bij wie | RTG | Waar |
|---|---|---|---|
| Ordertracking over verkopers | marktplaatsen | half | bestellingen.js toont de stand van het domein |
| Offertes aanvragen bij meerdere aanbieders | klusplatforms | **ja** | aanvragen.js, alleen zaken met het juiste vak in het juiste gebied |
| Reacties vergelijken | klusplatforms | nee | — |
| "Betaal alles" in één keer | marktplaatsen | **niet doen** | de kop van bestellingen.js |

#### c. Volledig domein
- **Particulier:** wil een overzicht van alles wat loopt, en wil hulp vragen als er geen aanbod is.
- **Professioneel (zaak):** offreert met een toelichting, prijs en termijn, en wil weten dat een keuze geen opdracht is tot er een bevestiging is.
- **Organisatorisch:** het lid kan zijn vraag terugtrekken; een vraag verloopt; een zaak met een ander vak ziet hem niet. Dat laatste is privacy: een vraag is persoonlijke informatie.

#### d. Functiecatalogus

**B1 · Alles wat loopt op één plek** (L6, **bestaat**)
- **Regels:** alleen lezen.
- **Onzekerheid:** een domein dat niet antwoordt geeft "kon niet ophalen".
- **Acceptatie:** tafel, klus, reis en verblijf staan samen, en een stuk domein staat er met naam als niet bereikbaar.

**B2 · Vraag wat niemand aanbiedt** (L2, **bestaat**)
- **Acceptatie:** een zaak met een ander vak of een ander gebied ziet de aanvraag niet. Het lid kiest een reactie en vindt het antwoord terug.

**B3 · Reacties naast elkaar** (L4, **ontbreekt**)
- **Gegevens:** de reacties met prijs, termijn en wat erbij zit.
- **Regels:** RTG rangschikt niet op "beste"; het lid kan sorteren op prijs of termijn.
- **Rekenwijze:** geen score.
- **Acceptatie:** het lid ziet de reacties in een tabel en kan sorteren; geen enkele reactie draagt een RTG-oordeel.
- **Kosten** klein / **bak** aanbevolen nu.

**B4 · Verlopen en heropenen** (L5, **half**)
- **Regels:** na 30 dagen sluit een vraag met een reden; heropenen kan.
- **Melding:** in de app bij het sluiten.
- **Acceptatie:** met een verzette klok sluit de vraag op dag 30 met de reden, en heropenen maakt hem weer zichtbaar voor dezelfde zaken.
- **Kosten** klein / **bak** aanbevolen nu, met een proef met tijdmachine.

**B5 · Stand van een bestelling van het domein** (L5, **half**)
- **Onzekerheid:** RTG verzint geen bezorgmoment.
- **Acceptatie:** de getoonde stand is letterlijk die van het domein, met het tijdstip van ophalen.
- **Kosten** middel / **bak** later.

**Niet doen:** "betaal alles" (dat belooft wat geen partij gaf), en een betrouwbaarheidsscore op zaken (ranglijst).

#### e. RTG-exclusief
- Eén overzicht over reis, tafel, klus en verblijf, zonder een tweede orderwaarheid.
- Een vraagmarkt die alleen de juiste vakmensen in het juiste gebied zien.

#### f. Bouwstenen en ontbrekende koppelingen
- **Bestaand:** aanvragen, bestellingen en de zaakkant.
- **Ontbrekend:** `/api/supplier/mall/aanvraag/behandel` in IDOR.json; een vergelijkingsweergave.

#### g. Prioritering
B4 met een proef (klein) → bevoegd meten (klein) → B3 (klein) → B5 (middel).

#### h. Toetsbaar eindcontract
| Dimensie | Criterium |
|---|---|
| Breedte | Alle vijf domeinen van bestellingen.js verschijnen, of verschijnen als "stuk". |
| Professionele diepte | Een reactie draagt prijs, termijn en toelichting; het kiezen zegt "geen boeking of betaling". |
| Levenscyclus | Plaatsen → reacties → kiezen → behandeling → afgerond → verlopen/heropenen, met tijdmachine. |
| Samenwerking en rollen | Een zaak met het verkeerde vak of gebied ziet de vraag niet. |
| Domeinintelligentie | Geen RTG-score op reacties. |
| Los functioneren | Met een domein uit blijven de andere regels zichtbaar, en die regel staat er als "stuk". |
| RTG-ketens | Elke regel opent het scherm van het domein dat hem beheert. |
| Bewezen betrouwbaarheid | Acht bewijzen BEWEZEN, inclusief bevoegd voor de zaakroute. |

#### Uitkomst A — binnen de huidige architectuur en scope
- B3 reacties naast elkaar
- B4 verlopen met tijdmachine-proef
- bevoegd voor de zaakroute
- B5 stand van het domein

#### Uitkomst B — het domeinmaximum
**B1 · Opdrachtbevestiging met offertevoorwaarden** (proces voor vakmensen)
- **Gegevens:** een gekozen reactie met prijs, btw, termijn, annuleringsvoorwaarden en geldigheid.
- **Regels:**
  - de zaak bevestigt pas met voorwaarden;
  - het lid accepteert expliciet;
  - daarna ontstaat een afspraak (werkwoord `bevestig`).
- **Rekenwijze:** btw via fiscaal/tarief.
- **Rollen:** lid, zaak.
- **Uitzonderingen:** een offerte die verlopen is kan niet meer geaccepteerd worden.
- **Acceptatie:** het lid ziet de voorwaarden vóór het akkoord, en na het akkoord staan beide partijen dezelfde tekst met datum.

**B2 · Meerdaagse opdracht met deelopleveringen**
- **Regels:** elke deeloplevering wordt door het lid afgetekend; betaling per deel loopt via Geld (verwijzing).
- **Rollen:** lid, zaak.
- **Acceptatie:** een deel dat niet is afgetekend, kan niet als betaald verschijnen.

**B3 · Vraag namens een team**
- **Regels:** een lid plaatst een vraag namens een werkruimte; de zaak ziet de organisatienaam, en het teamlid blijft codenaam.
- **Rollen:** teamlid en beheerder (werkrol werkruimte).
- **Acceptatie:** zonder recht in de werkruimte kan het lid geen vraag namens de werkruimte plaatsen.

**LOS.** Aanvragen werken zonder andere apps. **SAMEN.** Mijn bestellingen geeft aanvraag-id's uit naar de zaakapp en ontvangt regels uit de Food Court, de klussen, Reizen en Verblijf. Geld ontvangt van hier geen bedrag: een gekozen reactie is geen betaling.

**Gebruikersketen.** Een lid vraagt "privékok Ibiza, 6 personen". Twee zaken met het juiste vak reageren, het lid vergelijkt ze en kiest er één. Die zaak rondt af, en het antwoord staat bij het lid.

*Storingen:*
- Geen zaak met dat vak in dat gebied: het scherm zegt dat eerlijk.
- De zaak trekt zich terug: heropenen.
- Een ander raadt de id: 404.
- Na 30 dagen: gesloten met reden.

---

### Food Court (link:foodcourt, /apps/foodcourt.html)

**Doel.** Alle restaurants op een rij, de vrije tijden voor een datum en een gezelschap, en een tafel aanvragen in één tik. De zaak beslist. Let op de naam: `kern/gast/foodcourt.js` is een ander product (het mandje bij meer loketten); ze delen geen code.

#### a. Inventaris
- **Routes:** `/api/foodcourt` en `/foodcourt/tijden` (winkel-bieb.js); `/api/reserveer`, `/reserveringen/mijn`, `/reservering/annuleer`, `/reservering/tegenvoorstel` en `/review` (handel/uitjes.js).
- **Kern:**
  - `kern/foodcourt.js`: vaste lunch- en dinerslots, de klok van de zaak via tijdzone.js, capaciteit via `kern/reservering/capaciteit`;
  - `kern/ervaring/tafels.js`: een dubbele aanvraag voor hetzelfde moment geeft 409;
  - `kern/ervaring/tafeluitzondering.js`: het tegenvoorstel;
  - het zorgprofiel reist mee met toestemming, via zorgMee.
- **Gratis account:** reserveren kan pas met een geverifieerde identiteit; bestellen en meebestellen kan wel.
- **Voltooiscenario** `scripts/lib/voltooi/foodcourt.js`: lid en zaak, de zaak kent het lid op codenaam.
- **Toetsen:** foodcourt en gastfoodcourt.

| Bewijs | Stand |
|---|---|
| bereikbaar | BEWEZEN |
| bedienbaar | BEWEZEN (11/15) |
| menselijk | BEWEZEN |
| voltooibaar | BEWEZEN (6/6) |
| waarheidsgetrouw | BEWEZEN (9) |
| persistent | BEWEZEN (3/3) |
| bevoegd | **NIET_GETEST** (5 van 7 routes ongemeten) |
| herstelbaar | BEWEZEN (4/4) |

Niet gelopen: het tegenvoorstel en het meereizende zorgprofiel.

#### b. Marktvergelijking (ook het duurste restaurantpakket)
| Functie | Bij wie | RTG | Waar |
|---|---|---|---|
| Vrije tijden en reserveren | OpenTable, TheFork (gratis voor de gast) | **ja** | foodcourt.js, tafels.js |
| Voorkeuren en allergieën meegeven | OpenTable (gastprofiel) | half | zorgMee (met toestemming); niet in de proef |
| Wachtlijst | OpenTable Core/Pro | nee | — |
| Aanbetaling of no-show-garantie | OpenTable (2% transactiekosten, secundaire bron) | nee | — |
| Spaarpunten (Yums) | TheFork | **niet doen** | lokmechaniek |
| Echte openingstijden en tafelplan per zaak | restaurantpakketten (Pro) | half | vaste LUNCH/DINER-slots in foodcourt.js; het tafelplan staat in horeca |

#### c. Volledig domein
- **Particulier:** reserveert, meldt allergieën en wil een bevestiging, een tegenvoorstel of een wachtlijstplek.
- **Professioneel (restaurant):**
  - werkt met eigen diensten en tijden, tafelcombinaties en een maximum aantal couverts per kwartier;
  - heeft te maken met no-shows;
  - moet de allergenen kunnen benoemen (Verordening 1169/2011, bijlage II);
  - werkt volgens de hygiënecode (HACCP; in huis: `horeca.haccp` → horeca-haccp.html).
- **Organisatorisch (foodcourt-exploitant of horecaketen):** meer vestigingen, groepsreserveringen, aanbetalingen en een eerlijke weergave van ledenvoordelen.
- **Recht:** een restaurantreservering valt buiten het herroepingsrecht (Richtlijn 2011/83/EU, art. 16 sub l: diensten op een bepaalde datum).

#### d. Functiecatalogus

**R1 · Vrije tijden op de klok van de zaak** (L1, **half**)
- **Gegevens:** de tafels en capaciteit van de zaak, en de reserveringen.
- **Regels:** alleen vandaag of later, en op vandaag geen voorbije tijden.
- **Rekenwijze:** `capaciteit.past`.
- **Onzekerheid:** als de zaak geen reserveringen aanneemt: "vol", met reden.
- **Acceptatie:** een slot is vrij als de capaciteit past, in de tijdzone van de zaak. Een zaak met eigen diensten toont die en niet de vaste lijst.
- **Kosten** middel / **bak** aanbevolen nu. Vandaag zijn de slots een vaste lijst; de diensten van de zaak bestaan in horeca.
- **Na te gaan:** tafels.js gebruikt `vandaag()`; of dat ook de klok van de zaak is, is niet geverifieerd.

**R2 · Aanvragen, bevestigen, annuleren** (L5, **bestaat**)
- **Uitzondering:** een tweede aanvraag voor hetzelfde moment geeft 409.
- **Acceptatie:** "bevestigd" verschijnt alleen als de zaak dat zei; annuleren door het lid maakt de plek vrij.

**R3 · Tegenvoorstel** (L5, **half**)
- **Acceptatie:** het lid ziet het nieuwe tijdstip en kiest ja of nee; bij nee blijft er niets op zijn naam.
- **Kosten** klein / **bak** aanbevolen nu, met een stap in de voltooiproef.

**R4 · Allergieën meegeven** (L1/L2, **half**)
- **Gegevens:** het zorgprofiel van het lid.
- **Regels:** alleen met toestemming. De zaak ziet het op codenaam. De 14 allergenen van bijlage II zijn de keuzelijst.
- **Acceptatie:** bij de aanvraag ziet de zaak "pinda, schaaldieren", en zonder toestemming ziet de zaak niets.
- **Kosten** klein / **bak** aanbevolen nu.

**R5 · Wachtlijst** (L5, **ontbreekt**)
- **Regels:** het lid hoort het één keer als er plek vrijkomt, met een vervaltijd die de zaak zet. Geen aftelklok in beeld.
- **Acceptatie:** bij annulering door een ander krijgt de eerste op de lijst één bericht. Neemt hij niet aan, dan gaat het naar de volgende.
- **Kosten** middel / **bak** later.

**R6 · Aanbetaling bij groepen** (L5/L6, **ontbreekt**)
- **Regels:** de zaak vraagt hem; het geld loopt via Geld; terugbetalen gaat nooit vanzelf.
- **Acceptatie:** het lid ziet het bedrag vóór het akkoord en ziet het terug in Geld.
- **Kosten** middel / **bak** later. Vraagt besluit.

**R7 · Review na het bezoek** (L1, **bestaat**)
- **Regels:** 1 tot 5 sterren na een afgeronde dienst; geen gast-review.
- **Acceptatie:** een review kan pas na een bevestigde en voorbije reservering.

**Niet doen:** spaarpunten of "dubbele punten" (lokmechaniek), en een no-show-score op gasten (ranglijst).

#### e. RTG-exclusief
- Het zorgprofiel reist mee met toestemming, en de zaak kent de gast op codenaam.
- Eén keuze in Commerce of de Mall opent de reservering met alles ingevuld.

#### f. Bouwstenen en ontbrekende koppelingen
- **Bestaand:** foodcourt.js, tafels.js, capaciteit, tafeluitzondering, zorgMee en de horecakant (vloer, beheer, haccp).
- **Ontbrekend:**
  - de diensten van de zaak naar de slots (R1);
  - een wachtlijst op de bestaande capaciteit;
  - de aanbetalingsketen naar Geld;
  - een bevoegdronde voor 5 routes.

#### g. Prioritering
R3 en R4 in de proef (klein) → bevoegd meten (klein) → R1 diensten van de zaak (middel; afhankelijk van horeca-beheer) → R5 (middel) → R6 (middel, na besluit).

#### h. Toetsbaar eindcontract
| Dimensie | Criterium |
|---|---|
| Breedte | Elke zaak met `reservations` en tafels staat in de lijst; een zaak die dicht is staat er met "neemt nu geen reserveringen aan". |
| Professionele diepte | De slots volgen de diensten van de zaak, en de allergenen komen uit de lijst van bijlage II. |
| Levenscyclus | Aanvraag → tegenvoorstel → bevestigd → bezoek → review, of annulering, in één scenario. |
| Samenwerking en rollen | De zaak ziet het lid op codenaam, en het zorgprofiel alleen met toestemming. |
| Domeinintelligentie | Geen voorspelling van drukte als feit. Een slot is vrij of vol op basis van gemeten capaciteit. |
| Los functioneren | Antwoordt de zaak niet, dan blijft de aanvraag "aangevraagd" en nooit "bevestigd". |
| RTG-ketens | Een Commerce-briefje opent de reservering ingevuld, en de reservering staat in Mijn bestellingen. |
| Bewezen betrouwbaarheid | Acht bewijzen BEWEZEN, inclusief bevoegd. |

#### Uitkomst A — binnen de huidige architectuur en scope
- R3 tegenvoorstel in de proef
- R4 allergenen uit bijlage II
- R1 diensten van de zaak (via horeca-beheer)
- bevoegd meten
- R5 wachtlijst

R6 aanbetaling na besluit.

#### Uitkomst B — het domeinmaximum
**B1 · Allergenenkaart per gerecht met bewijs** (proces voor de horeca)
- **Gegevens:** de recepten en de ingrediënten met hun allergenen (bijlage II, Verordening 1169/2011).
- **Regels:**
  - de kok legt per gerecht vast;
  - een wijziging in een ingrediënt zet het gerecht terug op "te controleren";
  - de gast ziet alleen gecontroleerde gerechten als "vrij van".
- **Rekenwijze:** vereniging van de allergenen van de ingrediënten.
- **Rollen:** kok (werkrol personeel/zaak) en gast.
- **Uitzonderingen:** kruisbesmetting kan alleen als "kan sporen bevatten", met de bron van de kok.
- **Acceptatie:** bij een gast met "pinda" markeert de kaart elk gerecht met pinda. Een gerecht met een gewijzigd ingrediënt toont "nog niet gecontroleerd" en nooit "vrij van".

**B2 · No-show-afspraak met een eerlijke garantie**
- **Gegevens:** de voorwaarde van de zaak (bedrag per persoon, annuleringsgrens).
- **Regels:**
  - de gast ziet de voorwaarde vóór het akkoord;
  - een afschrijving pas na een mens van de zaak die "niet gekomen" bevestigt;
  - het geld loopt via Geld en gaat nooit vanzelf.
- **Rekenwijze:** bedrag × personen.
- **Rollen:** gast, zaak.
- **Uitzonderingen:** annuleren vóór de grens kost niets.
- **Acceptatie:** zonder bevestiging door de zaak wordt er nooit afgeschreven, en de gast ziet de grens in zijn eigen tijdzone.

**B3 · Groepsreservering met verdeelde rekening**
- **Regels:**
  - de organisator nodigt verbonden leden uit;
  - ieder bevestigt zelf;
  - de rekening wordt via WBW (Geld) verdeeld.
- **Rollen:** organisator, deelnemers.
- **Acceptatie:** de tafel telt pas de deelnemers die zelf bevestigden, en niemand betaalt voor een ander zonder akkoord.

**B4 · Ketenbeheer over vestigingen**
- **Regels:** één restaurantketen beheert de diensten per vestiging; de Food Court toont ze apart en noemt de keten.
- **Rollen:** ketenbeheerder (werkrol zaak, meer zaken).
- **Acceptatie:** een wijziging van diensten bij vestiging A raakt vestiging B niet.

**LOS.** Restaurants, tijden en aanvragen werken los. **SAMEN.** De Food Court geeft reservering-id plus zaak uit aan Mijn bestellingen en aan de zaakapp; bij een aanbetaling ook een verwijzing naar Geld, met toestemming per betaling. Ze ontvangt Commerce-briefjes en het zorgprofiel.

**Gebruikersketen.** Een lid kiest zaterdag 20:00 voor vier personen en geeft "pinda" mee. De zaak doet een tegenvoorstel voor 20:30, het lid accepteert, en Mijn bestellingen toont de tafel. Na het bezoek schrijft het lid een review.

*Storingen:*
- Een dubbele tik op aanvragen: de tweede aanvraag krijgt 409 "al een reservering voor dit moment".
- De zaak antwoordt niet: de aanvraag blijft open, en annuleren kan.
- Geen toestemming voor het zorgprofiel: de zaak ziet het niet.
- Een gratis account zonder geverifieerde identiteit: reserveren wordt geweigerd met de reden, bestellen kan wel.

**Voor de integrator.**
- De diensten en het tafelplan van de zaak horen bij Horeca (`horeca.beheer`, `horeca.vloer`).
- Groepsdiners bij events horen bij `horeca.events`.
- De Food Court leest alleen; geen dubbele logica.


---

## Uitgaan en kring (LivingOS-B)

Premiumdomeinkaarten voor Table, Uitgaan, Attenties en Cercle. Volgens de bijstelling en de aanscherping van de eigenaar van 19 oktober 2026: geen nieuwe domeinen, lagen of motoren vóór V1. Elke functie hieronder is een verdieping binnen de bestaande app en de bestaande kernen.

Peildatum van alle marktbronnen: **2026-10-19**. De officiële prijspagina's waren vanuit de testwereld voor een deel niet bereikbaar (DNS geweigerd voor getdex.com en eventbrite.com). Waar een bedrag of functie van een derde partij komt, staat dat erbij, en zo'n bedrag is een schatting en geen feit. Echte organisaties en merken staan alleen als bron of marktreferentie, nooit als partner.

**Twee uitkomsten per app** (aanvulling van de eigenaar): **Deel A** is wat binnen de huidige architectuur en scope gebouwd kan worden — punten a–h, met de functiecatalogus onder d. **Deel B** is het domeinmaximum, ook buiten de huidige scope: compleet nieuwe professionele processen, elk bouwbaar concreet. B is geen toezegging; elke B-regel vraagt een besluit van de eigenaar over scope.

**Gemeenschappelijk voor Table, Attenties en Cercle**
- **Poort:** alle drie zijn Privékantoor-apps van de Lifestyle Pass; Business erft mee. Ze zijn gepoort in `server/routes/member/rechterhand.js`, met 403 en "Deze app is onderdeel van de Lifestyle Pass".
- **Pas:** die ontstaat alleen na een menselijk besluit (`kern/aanmeldingen/besluit.js`). Geen scherm en geen AI belooft toegang.
- **Opslag:** de gegevens staan per lid in de levensbak van de Rechterhand (`server/kern/rechterhand/*`, sleutel per lid). Er is geen gedeelde database.
- **Paden:** Attenties en Cercle bouwen hun API-paden als `'/api/member/rechterhand/' + pad`; SCHERMROUTES kent daar alleen het voorvoegsel. Table staat sinds d806269d4 voluit. Dat is een open punt in de meetbaarheid, geen functie.

---

### Table (link:table, /apps/table.html)

**Doel.** Privé-diners en events organiseren: per gelegenheid de gastenlijst met dieet en tafelindeling, een menu per gang en de praktische gegevens. Alles wordt bewaard en is herbruikbaar.
**Eigenaar** (SCHERMEIGENAAR.json): `leven.tafel-gelegenheid`.

#### a. Inventaris van het bewezen bestaande
- **Kern:** `server/kern/rechterhand/table.js` (3,9 KB).
  - Een gelegenheid zetten, wijzigen of weghalen; maximaal 100.
  - Een gast toevoegen, wijzigen of weghalen, met naam, dieet (80 tekens), tafel en notitie; maximaal 400 per gelegenheid.
  - Een gerecht per gang toevoegen of weghalen; maximaal 30.
- **Routes:** `/api/member/rechterhand/table`, `/zet`, `/weg`, `/gast`, `/gast/zet`, `/gast/weg`, `/menu` en `/menu/weg`.
- **Voltooiscenario:** `scripts/lib/voltooi/table.js` (Lifestyle-lid langs het menselijke besluit; gedeeld `bewaarblok`).

| APPWERKT-bewijs | Stand | Toelichting |
|---|---|---|
| bereikbaar | BEWEZEN | Het scherm opent zonder fout. Let op: de meting opent als persona "lid", terwijl de API een Lifestyle Pass eist. Het scherm opent dus wel; de inhoud vraagt de pas. |
| bedienbaar | BEWEZEN | 2 van 2 eigen knoppen aangetikt. |
| menselijk | BEWEZEN | Geen kale fout; weigeringen in woorden. |
| voltooibaar | BEWEZEN | 5/5 (VOLTOOIPROEF, gemeten op f85c044e). |
| waarheidsgetrouw | BEWEZEN | 9 antwoorden gelogen, geen verzonnen zekerheid. |
| persistent | BEWEZEN | 3/3. |
| bevoegd | NIET_GETEST | 1 van de 70 routes niet gemeten (`/api/gids/app` staat niet in IDOR.json). |
| herstelbaar | BEWEZEN | 4/4: dubbeltik, afgebroken verzoek, crash. |

#### b. Marktvergelijking (functies over, verdienmodellen niet)

| Aanbieder (referentie) | Pakket, ook het duurste | Relevante functies | Bron |
|---|---|---|---|
| Paperless Post | per gast in munten; Basic, Premium en All Access. Een abonnement op jaarbasis ligt rond $250 per jaar voor 250 gasten (derde partij). | Uitnodiging, RSVP-registratie, gastvragen, gastenlijst importeren | usecarly.com/blog/paperless-post-pricing; paperlesspost.com/features |
| Partiful | gratis voor de gast. Verdienmodel niet geverifieerd. | RSVP, maximum met automatische wachtlijst, bericht aan alle bevestigde gasten, privacy van de gastenlijst | sacra.com/research/partiful (derde partij) |
| Tripleseat (de professionele kant: zalen en restaurants) | Standard en Premium, alleen op aanvraag. Een "$200–500 per maand"-bereik bij derden is ongesourcet. | Banquet Event Order (opstelling, tijden, menu, dieetwensen, audio en video), contract met e-handtekening, aanbetaling | tripleseat.com/blog/banquet-event-order-samples; saasrat.com/products/tripleseat (derde partij) |
| SevenRooms (restaurant-CRM) | Starter, plus add-ons Event Management en e-mailmarketing. Enterprise op maat; "$499 per maand per functie" bij derden, ongeverifieerd. | Gastprofiel met allergieën, tafelbeheer, wachtlijst, aanbetaling of kaart vooraf tegen no-shows | sevenrooms.com/pricing; getapp.com/…/sevenrooms/pricing (derde partij) |

**Overgenomen functies:** uitnodiging met RSVP, gastvragen, wachtlijst, draaiboek en BEO-document, en allergenen per gerecht.
**Niet overgenomen:** munten per gast, boost of promotie, en no-show-geld als lokmiddel. Een aanbetaling is van Geld en de zaak, niet van Table.

#### c. Het volledige domein
- **Particulier:**
  - de verjaardag, het jubileum en het zakendiner thuis of in een zaal;
  - wie komt, wie naast wie zit, wie wat niet eet, wat er geserveerd wordt;
  - wat het kost en wie wat meeneemt;
  - na afloop: wie bedankt wordt, en "zoals vorig jaar".
- **Professioneel (de chef, cateraar of zaal):**
  - werkt met een BEO: datum, tijden, aantal, opstelling, menu per gang, dieet en allergie per gast of per couvert, audio en video, bloemen, aanbetaling en eindafrekening;
  - de 14 allergenen van Verordening (EU) 1169/2011 moeten per gerecht bekend en schriftelijk beschikbaar zijn (NVWA-factsheet, nvwa.nl/…/onderzoeksresultaten-allergenen.pdf);
  - no-shows worden bestreden met bevestigingen, herinneringen en soms een aanbetaling (KHN, khn.nl/kennis/minder-no-shows-khn-geeft-tips);
  - een no-show-vergoeding mag alleen als die vooraf is afgesproken. Die juridische kant is niet geverifieerd bij ACM of ConsuWijzer.
- **Organisatorisch:**
  - de assistent of de Rechterhand die het diner voorbereidt (mandaat);
  - het kantoor dat een privéchef zoekt (concierge-lus);
  - de zaak die alleen het deel ziet dat hij levert.
- **Privacy (hard):**
  - een allergie of dieet om medische redenen is een gezondheidsgegeven, art. 9 AVG (legiscope.com/blog/avg-horeca-hotels.html, secundair, nog te toetsen aan de AP);
  - een gezondheidsgegeven vraagt een expliciete grondslag en beperking tot het doel.
  - Table bewaart `dieet` nu onbeperkt in vrije tekst bij een gast, en de gast is geen account. Dat is een gegeven over een derde die niet zelf heeft ingestemd.
  - **Dit is het belangrijkste open punt van deze app.**

#### d. Functiecatalogus — Deel A (binnen de huidige architectuur en scope)

| # | Functie | Laag | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Moment | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Stand | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | Gelegenheid, gasten, tafels, menu | L1 | eigen invoer, `table.js` | grenzen 100/400/30 | geen | geen | alleen het lid | vol geeft een weigering met de reden | 12 gasten met tafel staan er na een herstart nog, en een dubbeltik geeft 1 gast | bestaat | — | (gedekt) |
| T2 | Dieet als vaste keuzelijst plus vrije notitie | L1 | de 14 allergenen van 1169/2011 bijlage II (`server/kern/allergenen.js`, gedeeld met de tafellijst van de zaak); vegetarisch, halal en dergelijke als vrije aanvulling van 80 tekens | per gast een set codes in de volgorde van de lijst; een code buiten de lijst geeft 400 "Kies de allergenen uit de lijst; iets anders kan als korte aanvulling." | geen | geen | lid | "onbekend" als eigen waarde: nog niet gebouwd | Het lid vinkt "noten" en "melk" aan; die staan als codes bij de gast | **bestaat** (d806269d4; test/table-dieet.test.js). De BEO-weergave (T8) en "onbekend" ontbreken nog | — | gedaan |
| T3 | Bewaartermijn van dieetgegevens | L5 | T2 | allergie en dieet worden **in de opslag** gewist de dag na de gelegenheid; zonder datum 30 dagen na invoer. De gast blijft staan. Elke lezing veegt het eigen dossier, de bewaarveger alle (`tableVergeetDieet`). De maître krijgt alleen een telling per allergeen, zonder namen | geen | het scherm toont per gast "bewaard t/m …" en een uitleg; een melding vooraf is niet gebouwd | lid | "bewaren voor volgende keer" is niet gebouwd (bewust: de integrator koos een vaste termijn) | Een gelegenheid van eergisteren toont het dieet niet meer, en in de opslag staat het er niet meer (ook na een herstart met RTG_KLOK) | **bestaat** (d806269d4; test/table-dieet.test.js) | — | gedaan |
| T4 | Allergenen per gerecht en conflictcheck | L4 | menu × T2 | per gang: gasten met een allergeen ∩ allergenen van het gerecht | gerechten zonder allergeneninvoer heten "niet ingevuld", nooit "veilig" | bij het opslaan van een gerecht | lid | gerecht zonder allergenen: waarschuwing "niet gecontroleerd" | Gast met noten plus gerecht met noten geeft "Gang 2: noten — 1 gast (A)". Een gerecht zonder invoer zegt "niet gecontroleerd" | ontbreekt | klein | aanbevolen nu |
| T5 | Draaiboek (tijden van de avond) | L1 | eigen invoer | gesorteerd op tijd; overlap gemarkeerd | geen | geen | lid | — | Ontvangst 19:00, gang 1 19:45 en toespraak 19:30 staan in tijdvolgorde | ontbreekt | klein | aanbevolen nu |
| T6 | Kopiëren "zoals vorige keer" | L5 | T1 | kopie zonder datum en zonder dieet (vanwege T3), wel gasten, tafels en menu | geen | geen | lid | — | De kopie heeft dezelfde 12 gasten en 0 dieetregels; het origineel is ongewijzigd | ontbreekt | klein | aanbevolen nu |
| T7 | Gast als verwijzing naar een Attenties-relatie | L6 | relatie-id uit Attenties | Table bewaart alleen de id plus het tafelnummer; de naam komt live uit Attenties | relatie weg: gast toont "relatie verwijderd" | geen | lid (beide apps van hetzelfde lid) | Attenties uit: de gast is een vrije naam | Een naamwijziging in Attenties is in Table te zien zonder kopie | ontbreekt | middel | aanbevolen nu |
| T8 | BEO-weergave (afdrukbaar) | L2 | T1, T2, T4, T5 | één document per gelegenheid; zonder gastnamen naar buiten, met couverts per dieetcode | geen | geen | lid | — | De afdruk toont het aantal per dieetcode en het menu per gang, en geen gastnamen | ontbreekt | middel | later |
| T9 | Verzoek aan de concierge-lus (privéchef of zaal) | L3/L6 | gelegenheid-id, aantal, datum, dieetcodes | via `/api/member/bureau/lus/intake`; de zaak krijgt via de bestaande positieve veldenlijst alleen datum, aantal en codes | het blijft een voorstel; niets is geboekt tot het akkoord | lus-bericht | lid geeft akkoord; kantoormens op naam | buiten mandaat: het lid beslist | Het lid vraagt "privéchef 12 nov"; in de lus staat een case met aantal en dieetcodes, en de zaak ziet geen namen | ontbreekt (de lus bestaat) | middel | later |
| T10 | Uitnodiging en RSVP aan gasten | L1 | e-mail/telefoon van de gast | vraagt een account van de gast (accountregel) of een eenmalige link | — | uitnodiging, herinnering | gast geeft zelf toestemming | gast zonder account | De gast zegt ja; het lid ziet de stand per gast | ontbreekt | groot | later (vraagt besluit) |
| T11 | Munten per gast, promotie | — | — | — | — | — | — | — | — | — | — | **niet doen**: verdienmodel |

#### e. RTG-exclusief
- Het diner ontstaat in Table en wordt geregeld door een mens via de concierge-lus.
- De zaak ziet alleen wat hij levert: couverts per dieetcode, zonder namen.
- De gastenlijst wijst naar Attenties, met de geschiedenis van wat de gast at en kreeg, zonder kopie.
- Gezondheidsgegevens van derden hebben een vaste wistermijn; dat doet geen van de genoemde aanbieders zichtbaar.

#### f. Bouwstenen en ontbrekende koppelingen
**Bestaat:**
- `table.js`;
- `attenties.js` (relaties);
- de concierge-lus (`kern/bureau/lus*.js`) met de positieve veldenlijst voor de zaak;
- de postvanger;
- het horeca-genre.

**Bestaat sinds 19 oktober:** de dieetcodes (T2), de wistermijn (T3) en letterlijke API-paden in `table.html` (d806269d4).

**Ontbreekt:**
- de verwijzing van een gast naar een relatie (een objectverwijzing; Attenties laadt `objectverwijzing.js` al, Table niet);
- een lus-intake vanuit een gelegenheid.

#### g. Prioritering
1. T3 en T2, privacy eerst: **gedaan** (d806269d4).
2. T4: klein, hangt aan T2.
3. T5 en T6: klein.
4. T7: middel, objectverwijzing in Table.
5. T8 en T9: middel, later.
6. T10: groot, vraagt een besluit.

#### h. Toetsbaar eindcontract (naast, nooit in plaats van, de acht APPWERKT-bewijzen)

| Dimensie | Meetbaar criterium |
|---|---|
| Breedte | Gelegenheid, gasten, tafels, menu, draaiboek en BEO zijn in één scherm te maken (T1, T5, T8). |
| Professionele diepte | Elk gerecht draagt de 14 allergenen of "niet ingevuld"; de conflictcheck toont elke botsing (T4). |
| Levenscyclus | Van aanmaken tot kopiëren en wissen, inclusief de wistermijn van dieetgegevens, met een toets die de opslag leest (T3, T6). |
| Samenwerking en rollen | Een lus-case vanuit een gelegenheid; de zaak ziet alleen de positieve veldenlijst (T9). |
| Domeinintelligentie | Het conflict is een rekenregel; "niet gecontroleerd" is nooit "veilig". |
| Los functioneren | Table werkt met Attenties en de lus uit, en zegt eerlijk "geen uitnodigingen". |
| RTG-ketens | De gast verwijst naar een relatie, zonder kopie (T7). |
| Bewezen betrouwbaarheid | Bevoegd van NIET_GETEST naar BEWEZEN; het voltooiscenario uitgebreid met T2–T4. |

#### Deel B — domeinmaximum (buiten de huidige scope; vraagt besluit)

Compleet nieuwe professionele processen rond een gelegenheid. Elk is bouwbaar concreet, maar valt buiten V1: er zijn nieuwe genres of rollen voor nodig.

| # | Proces | Gegevens en bron | Regels en rekenwijze | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium |
|---|---|---|---|---|---|---|
| TB1 | **Offerte–contract–BEO-keten met een privéchef of cateraar** | gelegenheid (aantal, datum, dieetcodes), offerteregels van de chef (gang × prijs × couvert), voorwaarden | De offerte is Σ(couverts × prijs per gang) plus vaste kosten. Het contract bevriest de offerte met een versienummer. De BEO wordt uit het contract gegenereerd. Wijziging na het contract maakt een nieuwe versie, en de chef moet opnieuw akkoord geven. | chef (nieuw genre "privéchef"), lid; elke versie met akkoord van beide | Annuleren volgens de vooraf afgesproken voorwaarde; zonder afspraak geen kosten (consumentenrecht, te toetsen) | Het lid ziet offerte v1 → akkoord → BEO. Een wijziging van het aantal maakt v2, die pas geldt na het akkoord van de chef. De aanbetaling loopt via Geld met dezelfde versie-id. |
| TB2 | **Couvertplanning voor de keuken** | BEO, dieetcodes per couvert, tafelplan | Per tafel per gang een lijst "couvert n: code X". Wisselgerechten worden automatisch per code toegewezen, uit de alternatieven van de chef. | chef en keukenstaf (werkrol); ziet geen gastnamen, alleen tafel en couvertnummer | Een code zonder alternatief blokkeert het afronden van de BEO | De keuken ziet "tafel 2, couvert 4: notenvrij → alternatief B" en nergens een naam. |
| TB3 | **Zaalboeking met opstelling** | zaal (capaciteit per opstelling: diner, cocktail, theater), datum en tijdslot | De capaciteit per opstelling is een harde grens. Een dubbele boeking op hetzelfde slot wordt geweigerd. | zaal (genre horeca, uit te breiden), lid | brandveilige capaciteit volgens vergunning gaat boven de wens van het lid | 40 gasten in een zaal met 32 dinerplaatsen wordt geweigerd met de reden en het alternatief "cocktail: 60". |
| TB4 | **Nazorg en bedankronde** | gasten (Attenties-verwijzing), gelegenheid | Na de datum een bedanklijst. Wat gegeven is, gaat de giftgeschiedenis van Attenties in, als verwijzing. | lid | — | Na het diner toont Attenties "aanwezig bij Diner 12 nov" bij elke gast, als verwijzing. |

**Modus LOS.** De kerntaak werkt zonder andere apps.
- **Ontbreekt nu:** de eerlijke zin "Table verstuurt geen uitnodigingen; de gasten krijgen niets van RTG".

**Modus SAMEN.**
- **Uitgeven:** de gelegenheid (id en datum) als projectie aan Vandaag en Leven, en als verwijzing aan de lus.
- **Ontvangen:** een relatie uit Attenties.
- **Geld:** geen geldstroom. Een aanbetaling van een zaak is een verwijzing (case-id plus zaakcode), met toestemming van het lid per betaling.
- **Vinden:** via Heel RTG en Rahul "open table", alleen met de pas (catalogus-poort 9f199c01e).

**Gebruikersketen met storingen.**
1. Het lid opent Table en maakt "Diner 12 november".
2. Het kiest 6 relaties uit Attenties en zet hun dieetcodes.
3. Het zet het menu en ziet "Gang 2: noten — 1 gast".
4. Het vraagt de Rechterhand om een privéchef.
5. De chef ziet couverts per code.
6. Na de datum wist Table de dieetregels.

Storingen:
- **Attenties uit:** het lid typt de namen zelf (LOS).
- **Lus buiten mandaat:** het lid krijgt een voorstel en er wordt niets geboekt.
- **Dubbeltik of crash bij het zetten van een gast:** één gast (bewezen).
- **Geen pas:** 403 met de reden.
- **Gerecht zonder allergenen:** "niet gecontroleerd".

**Vraagt besluit.**
- De wistermijn voor dieet: **genomen** door de integrator op 19 oktober (de dag na de gelegenheid; zonder datum 30 dagen).
- Het genre "privéchef/cateraar".
- Gasten zonder account uitnodigen (accountregel).

**Extern.** Bezorging van uitnodigingen in productie (mail en sms via de bestaande postvangerketen).

---

### Uitgaan (link:uitgaan, /apps/uitgaan.html)

**Doel.** De nachtadressen met hun gepubliceerde avonden. Een lid zet zich met zijn gezelschap op de gastenlijst, en zijn codenaam is zijn toegang.
**Eigenaar:** `leven.uitgaan`. De zaakkant hoort bij `horeca.club` en `horeca.events` (apps/horeca-club.html, horeca-events.html).

#### a. Inventaris
- **Routes:**
  - `/api/uitgaan` en `/api/uitgaan/mijn` (`routes/member/winkel.js`);
  - `/api/event/rsvp` (`routes/member/terplaatse.js`): alleen leden, gepubliceerd event, events-optie aan, 1–8 personen, dubbel geeft 409 "U staat al op de gastenlijst", vol geeft 409 "Dit event is vol", melding aan de zaak en het lid;
  - `/api/event/rsvp/annuleer` (`routes/member/handel/uitjes.js`): maakt de plek vrij voor de wachtlijst (`kern/ervaring/leden/wachtlijst.js`).
- **Zaakkant:** check-in schakelt aan en uit (`routes/supplier/events/planning.js`), met een activiteitenlog; daarnaast de clubdeur (`routes/supplier/horeca/clubdeur`).
- **Scherm:** toont ook reserveringen en tickets uit `/api/mall/bestellingen` (Promise.allSettled).
- **Voltooiscenario:** `scripts/lib/voltooi/uitgaan.js`, met twee actoren: lid en zaakmanager.

| Bewijs | Stand | Toelichting |
|---|---|---|
| bereikbaar | BEWEZEN | |
| bedienbaar | BEWEZEN | 8 van 11 eigen knoppen. |
| menselijk | BEWEZEN | |
| voltooibaar | BEWEZEN | 5/5. |
| waarheidsgetrouw | BEWEZEN | 11 gelogen. |
| persistent | BEWEZEN | 3/3. |
| bevoegd | NIET_GETEST | `/api/event/rsvp` en `/annuleer` zijn in IDOR.json onbereikbaar; 3 van de 6 routes niet gemeten. |
| herstelbaar | BEWEZEN | 4/4. Niet gelopen: check-in aan de deur en een vol event. |

#### b. Marktvergelijking

| Referentie | Pakket, ook het duurste | Functies | Bron |
|---|---|---|---|
| Eventbrite | Flex (per ticket) en Pro (abonnement). Servicekosten circa 3,7% + $1,79 per betaald ticket plus 2,9% verwerking (derde partij); een organisatorfee boven 25 tickets. | Mobiele check-in met QR, wachtlijst, capaciteit | checkoutpage.com/blog/eventbrite-pricing-change-august-2023; softwareadvice.com/event-management/eventbrite-profile (derde partij) |
| Partiful | gratis voor de gast | RSVP, maximum met wachtlijst, bericht aan bevestigde gasten, verborgen gastenlijst | sacra.com/research/partiful (derde partij) |
| SevenRooms (horeca-CRM met event-add-on) | Starter plus add-ons; Enterprise op maat | Wachtlijst, gastprofiel, aanbetaling tegen no-show | sevenrooms.com/pricing |

**Overgenomen:** wachtlijst, check-in, één bericht aan alle gasten, verborgen gastenlijst, herinnering.
**Niet overgenomen:** servicekosten per ticket (dat is Geld), "bijna vol"-urgentie, en een ranglijst van "populaire gasten".

#### c. Het volledige domein
- **Particulier:** een avond kiezen en zich met vrienden aanmelden; weten of je erin komt, wanneer en waar; afmelden als het niet doorgaat.
- **Professioneel (club, zaal, promotor):**
  - capaciteit volgens de vergunning en brandveiligheid;
  - een gastenlijst met plus-één;
  - check-in aan de deur en een deurteller;
  - leeftijdsgrens voor alcohol;
  - selectiebeleid dat niet mag discrimineren: het College voor de Rechten van de Mens oordeelde in 2014 dat een Amsterdamse club aan de deur discrimineerde (nltimes.nl/node/17011, secundair). Een gastenlijst op codenaam helpt, want de deur ziet geen naam of afkomst, maar een weigering aan de deur blijft een menselijk besluit dat uitlegbaar moet zijn;
  - no-shows en wachtlijsten.
- **Organisatorisch:** de zaak met meerdere medewerkers (manager, deur), het festival met crew (`festival.crewdashboard`), en events van de Foundation of School (`rtf.club`).

#### d. Functiecatalogus — Deel A (binnen de huidige architectuur en scope)

| # | Functie | Laag | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Moment | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Stand | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| U1 | Aanmelden met capaciteit | L1/L2 | `e.capacity`, `e.guests` | bezet = Σ qty; weigeren als bezet + qty > capaciteit | geen | melding aan lid en zaak | lid; geen gast | events-optie uit: 409 met de naam van de zaak | Vol geeft "Dit event is vol"; dubbel geeft "U staat al op de gastenlijst" | bestaat | — | (gedekt) |
| U2 | Wachtlijst zichtbaar en doorschuiven | L5 | `wachtlijst.js` | FIFO; bij een afmelding krijgt de eerste met passend qty de plek, en de rest blijft staan | geen | melding "u bent erbij" | lid | qty past niet: de volgende | Bij vol staat het lid op de wachtlijst; na een afmelding staat de eerste op de gastenlijst en krijgt één melding (in de proef) | half | klein | aanbevolen nu |
| U3 | Check-in in de proef en in "mijn avonden" | L5 | `planning.js` `checkedIn` | een schakelaar; de log meldt wie het deed | geen | geen | zaakmedewerker | per ongeluk ingecheckt: terugzetten | Na de check-in toont het lid "Ingecheckt"; terugzetten toont weer "Op de gastenlijst" | half | klein | aanbevolen nu |
| U4 | Gezelschap als leden | L3 | Salon-connecties | het lid kiest vrienden; ieder heeft een eigen regel met de verwijzing "met <codenaam>"; capaciteit telt per persoon | geen | melding aan de vriend | de vriend moet zelf accepteren | de vriend weigert: de plek komt vrij | Twee vrienden zien de avond in hun eigen lijst en kunnen zelf afmelden | ontbreekt | middel | aanbevolen nu |
| U5 | Herinnering op de dag | L1 | datum en tijd van het event | 1 melding op de dag (bijv. 4 uur vooraf), nooit herhaald | geen | 1× | lid kan het uitzetten | event zonder tijd: geen melding | Er komt precies één melding op de dag, en geen na afmelden | ontbreekt | klein | later |
| U6 | Bericht van de zaak aan alle gasten | L2 | gastenlijst | één bericht per wijziging; geen marketing | geen | 1× per bericht | zaakmanager | — | Een tijdswijziging bereikt elke gast één keer, en een afgemelde gast niet | ontbreekt | middel | later |
| U7 | Leeftijdsgrens per avond | L2 | `volwassen()` (`kern/volwassen.js`) | een avond met "18+" weigert een lid zonder bevestigde leeftijd, met de reden | leeftijd zoals opgegeven telt niet als bevestigd (`leeftijdBron`) | — | zaak zet de grens | — | Een lid zonder A3 krijgt bij een 18+-avond een weigering in woorden | ontbreekt | klein | aanbevolen nu |
| U8 | Voorstel "past bij u" | L4 | eigen geschiedenis | voorstel met reden; aanmelden doet het lid zelf | het is een voorstel | geen | lid | — | Rahul noemt drie avonden met de reden en meldt niets aan | ontbreekt | middel | later |
| U9 | Ticket en betaling | L6 | mall-bestelling | Uitgaan toont alleen de verwijzing naar het ticket (`pagina`) | — | — | Geld | — | Een gekocht ticket staat in "mijn avonden" met een link naar de mall | half | — | (keten bestaat) |
| U10 | "Bijna vol", populariteitsranglijst | — | — | — | — | — | — | — | — | — | — | **niet doen**: kunstmatige urgentie en vergelijking |

#### e. RTG-exclusief
- De codenaam is de toegang: de deur ziet geen echte naam, en dat beperkt een discriminerende selectie aan de deur.
- Een gezelschap bestaat uit echte vrienden, die elk zelf toestemming geven.
- De leeftijdsgrens rust op een gekeurde leeftijd en niet op een vinkje.

#### f. Bouwstenen en ontbrekende koppelingen
**Bestaat:**
- rsvp en annuleren;
- de wachtlijstkern;
- check-in en de clubdeur;
- `volwassen()`;
- Salon-connecties;
- de mall-bestellingen.

**Ontbreekt:**
- de wachtlijst in het scherm en in de proef;
- check-in in de proef;
- gezelschapsregels per vriend;
- een leeftijdsveld per event;
- IDOR-dekking van `/api/event/rsvp*`.

#### g. Prioritering
1. U2 en U3: proef en scherm, klein.
2. U7: klein; hangt aan `volwassen()`.
3. U4: middel; Salon-connecties.
4. U5 en U6: later.
5. U8: later.

#### h. Toetsbaar eindcontract

| Dimensie | Criterium |
|---|---|
| Breedte | Aanmelden, afmelden, wachtlijst, check-in en gezelschap in één scherm. |
| Professionele diepte | Capaciteit, leeftijdsgrens en check-in-log zijn per avond afdwingbaar. |
| Levenscyclus | Van aanmelden tot inchecken en afmelden, met de wachtlijst, in het voltooiscenario. |
| Samenwerking en rollen | De zaakmanager checkt in; een vriend in het gezelschap meldt zichzelf af. |
| Domeinintelligentie | Voorstellen dragen hun reden en melden nooit zelf aan. |
| Los functioneren | Zonder mall toont het scherm de avonden en zegt dat bestellingen niet laden. |
| RTG-ketens | Een ticket uit de mall als verwijzing; een avond als projectie in Vandaag. |
| Bewezen betrouwbaarheid | Bevoegd BEWEZEN, met `/api/event/rsvp*` in IDOR.json. |

#### Deel B — domeinmaximum (buiten de huidige scope; vraagt besluit)

| # | Proces | Gegevens en bron | Regels en rekenwijze | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium |
|---|---|---|---|---|---|---|
| UB1 | **Deurbeleid met uitlegbare weigering** | gastenlijst op codenaam, huisregels van de zaak (gepubliceerd), weigerreden uit een vaste lijst (vol, leeftijd, gedrag, dresscode) | Een weigering aan de deur kan alleen met een reden uit de gepubliceerde lijst en wordt gelogd. Persoonskenmerken staan niet in de lijst (Algemene wet gelijke behandeling als bron). Per avond telt een overzicht de weigeringen per reden. | deurmedewerker (werkrol); het lid ziet zijn eigen reden | Calamiteit: de zaak sluit de deur, en alle wachtenden zien "deur gesloten" | Elke weigering heeft een reden uit de lijst. Het lid ziet die reden in "mijn avonden". Een vrije tekst als reden kan niet. |
| UB2 | **Promotor- en line-upproces** | event, artiesten (verwijzing naar Podium/Theater), promotor | De promotor maakt een event-voorstel en de zaak keurt het goed. De line-up met tijden is een eigen object van de zaak. Artiesten bevestigen hun slot. | promotor (nieuw genre), zaak, artiest | Een artiest zegt af: het slot staat open en de gasten krijgen één bericht | Het event wordt pas gepubliceerd als alle slots bevestigd zijn of als open gemarkeerd. |
| UB3 | **Capaciteit en deurteller live** | check-ins en check-outs aan de deur | aanwezig = in − uit. Bij de vergunningsgrens stopt de deur. De wachtrij is FIFO. | deur, manager | Het tellen valt uit: handmatig met de reden "teller uit" | De deur weigert bij aanwezig = grens, met de reden "vol, wacht"; het lid in de wachtrij ziet zijn plek. |
| UB4 | **Veilig uitgaan-keten** | Veilig (noodcontacten), avond, plek | Het lid zet "laat weten dat ik thuis ben". Na het eindtijdstip plus X minuten zonder "thuis" krijgt de kring één bericht. | lid, kring (toestemming per persoon, Veilig-regels) | Het lid zet "thuis" eerder of zet het uit | Zonder "thuis" na het eindtijdstip + 60 minuten krijgt de kring één bericht. Na "thuis" komt er niets. |

**Modus LOS.**
- **Werkt:** aanmelden en afmelden werken zonder de mall.
- **Na te gaan:** of het scherm eerlijk zegt dat de bestellingen niet laden als `/api/mall/bestellingen` faalt. De code vangt het op; of dat ook zichtbaar is, niet geverifieerd.

**Modus SAMEN.**
- **Ontvangen:** mall-tickets en reserveringen (verwijzing).
- **Uitgeven:** de avond (zaakcode plus event-id) aan Vandaag, Leven en de zaak.
- **Geld:** het ticket-id plus de zaakcode, toestemming per betaling, alleen via de mall.
- **Vinden:** Heel RTG en Rahul "open uitgaan", voor elk lid.

**Gebruikersketen met storingen.**
1. Het lid opent Uitgaan en kiest vrijdag.
2. Het meldt zich aan met twee Salon-vrienden.
3. Elke vriend accepteert.
4. De zaak ziet drie codenamen.
5. Aan de deur checkt de zaak in.
6. "Mijn avonden" toont Ingecheckt.

Storingen:
- **Vol:** wachtlijst; na een afmelding één melding.
- **Dubbel:** 409.
- **18+ zonder gekeurde leeftijd:** weigering in woorden.
- **Netwerk weg tijdens aanmelden:** geen dubbele plek (bewezen).
- **Zaak zet events uit:** 409 met de naam.
- **Mall faalt:** alleen de avonden.

**Vraagt besluit.** Gezelschap met niet-leden (accountregel). **Extern.** Geen.

---

### Attenties (link:attenties, /apps/attenties.html)

**Doel.** Relatiebeheer: per relatie de band, de belangrijke data en de voorkeuren; de giftgeschiedenis, zodat het lid nooit twee keer hetzelfde geeft; en wie er binnen dertig dagen een attentie verdient.
**Eigenaar:** `relaties.attenties`.

#### a. Inventaris
- **Kern:** `server/kern/rechterhand/attenties.js` (4,4 KB).
  - Een relatie zetten of weghalen; weghalen neemt de giften mee. Maximaal 500.
  - Een gift zetten of weghalen; maximaal 5000.
  - De banden; `aankomend` voor 30 dagen, met `dagenTot` op MM-DD.
- **Routes:** `/api/member/rechterhand/attenties`, `/relatie`, `/relatie/weg`, `/gift` en `/gift/weg`.
- **Scherm:** laadt `objectverwijzing.js`.
- **Voltooiscenario:** `scripts/lib/voltooi/attenties.js`.

| Bewijs | Stand |
|---|---|
| bereikbaar | BEWEZEN |
| bedienbaar | BEWEZEN (2/2) |
| menselijk | BEWEZEN |
| voltooibaar | BEWEZEN (5/5) |
| waarheidsgetrouw | BEWEZEN |
| persistent | BEWEZEN (3/3) |
| bevoegd | NIET_GETEST: 6 van de 75 routes niet gemeten, vooral uit de gedeelde schil |
| herstelbaar | BEWEZEN (4/4) |

#### b. Marktvergelijking

| Referentie | Pakket, ook het duurste | Functies | Bron |
|---|---|---|---|
| Dex (persoonlijke CRM) | Premium circa $12 per maand (jaarlijks); Professional $20 per maand; Enterprise met SSO en een SOC 2-rapport | Verjaardagen en belangrijke data, herinneringen, notities, sync met LinkedIn, mail en agenda, kaartweergave | getdex.com/blog/hubspot-vs-dex; capterra.com/p/275020/Dex (derde partij; de eigen prijspagina was niet bereikbaar) |
| Sendoso (zakelijk geschenken versturen) | Essential, Plus, Pro en Enterprise, op aanvraag. Derden schatten $15–25K tot $75–100K+ per jaar, plus de giften. | Catalogus, verzending, internationaal (Pro en Enterprise), rapportage | sendoso.com/pricing; docket.io/resources/research/sendoso-pricing (derde partij) |

**Overgenomen:** herinneringen, dubbelgift-waarschuwing, vooruitblik.
**Niet overgenomen:** sync van contacten uit externe diensten. Die zet echte namen in de operationele data en botst met privacy by design. Een verzendcatalogus met marge evenmin: dat is een verdienmodel en hoort bij handel en Geld.

#### c. Het volledige domein
- **Particulier:** verjaardagen, jubilea, rouw en geboorte; wat iemand mooi vindt; wat je gaf en wanneer; een kaart, bloemen, een diner.
- **Professioneel:**
  - relatiegeschenken met een beleid (waarde, frequentie, registratie in verband met integriteit en anti-corruptie);
  - de concierge die geschenken regelt;
  - de bloemist of zaak die levert;
  - fiscaal kan een grote schenking onder de schenkbelasting vallen: dat is de klasse "advies" of "voorbehouden" (`kern/fiscaal/zekerheid.js`), geen uitspraak van Attenties.
- **Organisatorisch:** de assistent met mandaat die namens het lid onthoudt en regelt; het huishouden dat samen geeft.
- **Privacy:** een relatie is een derde zonder account. Voorkeuren kunnen gevoelig zijn ("geen alcohol" om medische redenen). Het moet dus om minimale gegevens gaan, en wissen moet kunnen.

#### d. Functiecatalogus — Deel A (binnen de huidige architectuur en scope)

| # | Functie | Laag | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Moment | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Stand | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A1 | Vooruitblik 30 dagen | L1 | relaties.datum (MM-DD) | dagenTot ≤ 30, gesorteerd | 29 februari: in een niet-schrikkeljaar op 28 februari (te toetsen) | geen | lid | — | Een verjaardag over 10 dagen staat erin, een over 40 niet | bestaat | — | (gedekt) |
| A2 | "Dit gaf u al" | L4 | giften per relatie | normaliseer de tekst (kleine letters, zonder lidwoord); gelijk of zeer gelijkend geeft een waarschuwing met de datum | gelijkenis is een hint, geen feit | bij het opslaan | lid | — | "Een fles wijn" bij iemand die "fles wijn" al kreeg, geeft "u gaf dit op 12-03-2025" | half | klein | aanbevolen nu |
| A3 | Herinnering een week vooraf en op de dag | L1 | A1 | 2 meldingen per datum per jaar; per relatie uit te zetten | geen | −7 dagen en op de dag | lid | relatie zonder datum | Er komen precies twee meldingen per jaar per datum, en geen na uitzetten | ontbreekt | klein | aanbevolen nu |
| A4 | Budget per relatie of jaar | L1 | giften.waarde | som per jaar; waarschuwing boven het eigen budget | geen | bij overschrijding | lid | — | Na 3 giften van €40 bij een budget van €100 waarschuwt het scherm | ontbreekt | klein | later |
| A5 | Relatie als verwijzing naar een Salon-contact | L6 | codenaam | alleen een verwijzing; de ander ziet niets en krijgt niets | — | geen | lid | contact weg: de koppeling vervalt | Het scherm toont de codenaam; het andere lid ziet in geen enkele route dat het gekoppeld is (IDOR-toets) | ontbreekt | middel | aanbevolen nu |
| A6 | "Laat regelen" via de concierge-lus | L3/L6 | relatie, budget, voorkeur | lus-intake met een verwijzing; niets besteld zonder akkoord | het is een voorstel | lus-bericht | lid; kantoormens | buiten mandaat: het lid beslist | Er ontstaat een case met de relatie als verwijzing; er is niets besteld | ontbreekt (de lus bestaat) | middel | later |
| A7 | Giftbeleid zakelijk | L2 | giften.waarde, relatie.band = zakelijk | grens per jaar per relatie; uitkomst in een fiscale klasse indien relevant | — | bij overschrijding | lid | — | Een zakelijke relatie boven de grens geeft een waarschuwing met de klasse "advies" | ontbreekt | middel | later |
| A8 | Gevoelige voorkeur markeren en wissen | L5 | voorkeuren | markering "gevoelig"; niet in een uitvoer of naar de lus zonder expliciete keuze | — | — | lid | — | Een als gevoelig gemarkeerde voorkeur zit niet in een lus-case, tenzij het lid haar aanvinkt | ontbreekt | klein | aanbevolen nu |
| A9 | Contactsync en verzendcatalogus | — | — | — | — | — | — | — | — | — | — | **niet doen**: privacy en verdienmodel |

#### e. RTG-exclusief
- De relatie, het diner (Table), de club (Cercle) en de concierge zijn één keten met verwijzingen.
- De relatie zelf blijft privé, en een ander lid weet niet dat het een relatie is.

#### f. Bouwstenen en ontbrekende koppelingen
**Bestaat:**
- `attenties.js`;
- `objectverwijzing.js` (geladen);
- de concierge-lus;
- de meldingslaag (`notify`);
- de fiscale klassen.

**Ontbreekt:**
- de gelijkenisregel;
- de herinneringsplanning;
- de verwijzing naar een Salon-contact;
- de markering "gevoelig";
- letterlijke API-paden.

#### g. Prioritering
1. A2, A3 en A8: klein.
2. A5: middel, met een IDOR-toets.
3. A6 en A7: later.
4. A4: later.

#### h. Toetsbaar eindcontract

| Dimensie | Criterium |
|---|---|
| Breedte | Relaties, data, voorkeuren, giften, herinneringen en budget. |
| Professionele diepte | Een zakelijk giftbeleid met een grens en een fiscale klasse. |
| Levenscyclus | Van relatie tot gift, herinnering en wissen (gevoelig), met een toets die de opslag leest. |
| Samenwerking en rollen | Een lus-case "laat regelen" met akkoord van het lid. |
| Domeinintelligentie | De dubbelgift-waarschuwing is een regel met een datum, geen gok. |
| Los functioneren | Volledig zonder andere apps. |
| RTG-ketens | De relatie als verwijzing aan Table en de Salon. |
| Bewezen betrouwbaarheid | Bevoegd BEWEZEN; geen enkele route van een ander lid toont een koppeling. |

#### Deel B — domeinmaximum (buiten de huidige scope; vraagt besluit)

| # | Proces | Gegevens en bron | Regels en rekenwijze | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium |
|---|---|---|---|---|---|---|
| AB1 | **Relatiegeschenkenregister voor een organisatie** | giften (waarde, datum, ontvanger-organisatie), giftbeleid (grens per relatie per jaar) | Elke zakelijke gift boven de grens vraagt de goedkeuring van een tweede mens (vier ogen). Het register toont de som per ontvanger per jaar. | gever, goedkeurder (werkrol kantoor/zaak); niet de gever zelf | Een gift onder de drempel wordt alleen geregistreerd | Een gift van €250 boven een grens van €150 staat op "wacht op goedkeuring" tot een ander dan de gever akkoord geeft. |
| AB2 | **Ontvangen giften (de andere kant)** | gift ontvangen (waarde, van wie) | Een ontvangen zakelijke gift boven de drempel wordt gemeld aan de eigen organisatie. | ontvanger, compliance-rol | — | Een ontvangen gift boven de drempel verschijnt in het register van de organisatie met de status "gemeld". |
| AB3 | **Condoleance- en geboorteketen** | gebeurtenis bij een relatie | Een gebeurtenis zet een voorgestelde reeks klaar (kaart, bezoek, herinnering na een maand). Elke stap is een voorstel. | lid | Het lid zet de reeks uit | Na "overleden: vader van K." staan drie voorgestelde stappen met datum, en er wordt niets automatisch verstuurd. |
| AB4 | **Bezorgketen met een zaak** | gift, zaak (bloemist), adres via de lus | De zaak krijgt alleen de bezorgdatum, het adres via de concierge en de kaarttekst. De status loopt van besteld naar onderweg naar bezorgd. | zaak, lid, kantoor | Niet bezorgd: retour, en het lid hoort het | Het lid ziet "bezorgd op 14-11". De zaak heeft nooit de giftgeschiedenis gezien. |

**Modus LOS.** Volledig zelfstandig.

**Modus SAMEN.**
- **Uitgeven:** de relatie-id aan Table (gast) en de lus; de vooruitblik als projectie in Vandaag.
- **Ontvangen:** de codenaam uit de Salon.
- **Geld:** een gift via de lus is een verwijzing (case-id) aan Geld, met toestemming per betaling.

**Gebruikersketen met storingen.**
1. Een week vooraf: de melding "jubileum K.".
2. Het lid opent Attenties en ziet dat hij vorig jaar bloemen gaf.
3. Het kiest "Laat regelen" met een budget van €75.
4. De Rechterhand stelt iets voor; het lid geeft akkoord.
5. De gift staat in de geschiedenis.

Storingen:
- **Geen pas:** 403.
- **Lus buiten mandaat:** voorstel, niets besteld.
- **Dubbeltik bij de gift:** één gift (bewezen).
- **Relatie weggehaald:** de giften verdwijnen mee; het scherm moet dat vooraf zeggen (na te gaan).
- **Gevoelige voorkeur:** gaat niet mee naar de lus.

**Vraagt besluit.** Of een relatie aan een echt account mag hangen; de standaardgrens voor zakelijke giften. **Extern.** Bezorging van een gift: via de zaak of concierge, niet via Attenties.

---

### Cercle (link:cercle, /apps/cercle.html)

**Doel.** De besloten clubs van het lid wereldwijd, met lidnummer, dresscode, reciprociteit en gastpassen. "Waar kan ik in Milaan terecht, en op welk lidmaatschap?" En een gastpas-boekhouding die terugloopt en terug te draaien is.
**Eigenaar:** `leven.cercle`.

#### a. Inventaris
- **Kern:** `server/kern/rechterhand/cercle.js` (6,3 KB).
  - Een club zetten of weghalen; maximaal 300.
  - Een gastpas gebruiken, met een logboek, en terugdraaien.
  - `waarheen` per stad: eigen clubs en clubs via reciprociteit. RTG houdt geen clubgids bij, en het antwoord zegt dat.
- **Routes:** `/api/member/rechterhand/cercle`, `/club`, `/club/weg`, `/gast`, `/gast/terug` en `/waarheen`.
- **Scherm:** laadt `objectverwijzing.js`.
- **Voltooiscenario:** `scripts/lib/voltooi/cercle.js`.

| Bewijs | Stand |
|---|---|
| bereikbaar | BEWEZEN |
| bedienbaar | BEWEZEN (2/2) |
| menselijk | BEWEZEN |
| voltooibaar | BEWEZEN (5/5) |
| waarheidsgetrouw | BEWEZEN |
| persistent | BEWEZEN (3/3) |
| bevoegd | NIET_GETEST: 6 van de 75 routes |
| herstelbaar | BEWEZEN (5/5) |

#### b. Marktvergelijking

| Referentie | Pakket, ook het duurste | Functies | Bron |
|---|---|---|---|
| Clubessential (software voor clubs) | geen publieke prijs, contact met de verkoper; door derden aan de dure kant geplaatst | Leden-app, reserveringen, bestellen, account, pushberichten, CRM | capterra.com/p/151992/Clubessential; us.fitgap.com/products/clubessential (derde partij) |
| Digitale ledenkaarten (musea en tuinen, als patroon voor reciprociteit) | lidmaatschap | Kaart in de wallet, een pagina met het reciprocal netwerk, gastrechten per mail delen, eenmalige gastpassen | sjmusart.org/digital-membership-cards; wavehill.org/support/membership/digital-membership-cards; redbuttegarden.org/memberships/digital-faq |

Voor de reciprociteitsfuncties van clubsoftware vond ik geen verifieerbare bron. Die vergelijking is daarom niet gemaakt.

#### c. Het volledige domein
- **Particulier:**
  - meerdere lidmaatschappen (city club, golf, sport, cultuur);
  - lidnummer, dresscode, contributie en vervaldatum;
  - reciprociteit bij reizen;
  - gastpassen voor zakenrelaties en familie.
- **Professioneel (de club):**
  - ledenadministratie, introducés-beleid (aantal per jaar, begeleiding verplicht), reciprociteitsafspraken met kaartjes of brieven, en dresscode-handhaving;
  - de club verifieert zelf. RTG kan dat niet en mag het niet suggereren.
- **Organisatorisch:** het secretariaat of de assistent van het lid, en het huishouden met familielidmaatschappen.

#### d. Functiecatalogus — Deel A (binnen de huidige architectuur en scope)

| # | Functie | Laag | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Moment | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Stand | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C1 | Clubs met lidnummer en dresscode | L1 | eigen invoer | max 300 | geen | geen | lid | — | Na een herstart staat alles er nog | bestaat | — | (gedekt) |
| C2 | Waarheen per stad | L4 | eigen clubs plus ingevulde reciprociteit | eigen ∪ via reciprociteit; zegt "RTG houdt geen gids bij" | alleen eigen invoer | geen | lid | geen club: zegt dat | "Milaan" toont eigen clubs en clubs via reciprociteit, en verzint niets | bestaat | — | (gedekt) |
| C3 | Gastpassen met terugdraaibaar logboek | L5 | `gastpassen`, `gastlog` | −1 per gebruik; terug +1; 0 geeft een weigering | geen | geen | lid | — | Gebruik en terugdraaien kloppen; een dubbeltik geeft één (bewezen) | bestaat | — | (gedekt) |
| C4 | Vervaldatum en verlenging | L5 | `vervaltOp` (nieuw veld) | binnen 60 dagen: bovenaan, met de datum | geen | 1 melding 30 dagen vooraf | lid | — | Een lidmaatschap dat over 20 dagen verloopt, staat bovenaan; er komt één melding | ontbreekt | klein | aanbevolen nu |
| C5 | Introducés-regels per club | L2 | `gastRegel` (max per jaar, begeleid) | het logboek telt per kalenderjaar; boven het maximum een waarschuwing | de clubregel is wat het lid invult | bij het gebruik | lid | — | De derde gast bij een maximum van 2 per jaar geeft een waarschuwing in woorden | ontbreekt | klein | aanbevolen nu |
| C6 | Voor wie de gastpas was | L1 | logboek.notitie (codenaam of vrije naam) | alleen een notitie; de gast krijgt niets van RTG | — | — | lid | — | Het logboek toont "voor K." bij de pas | ontbreekt | klein | aanbevolen nu |
| C7 | Waarheen vanuit Reisboek | L6 | reisboek.bestemming | Reisboek toont een verwijzing "u kunt hier terecht bij …", live uit Cercle | — | geen | lid | Cercle leeg: geen verwijzing | Bij een reis naar Milaan toont Reisboek de clubs zonder kopie | ontbreekt | middel | aanbevolen nu |
| C8 | Club als plaats voor een Table-gelegenheid | L6 | club-id | verwijzing | — | — | lid | — | Een gelegenheid toont "in <club>" via de verwijzing | ontbreekt | klein | later |
| C9 | Kaart in de wallet van het toestel | L1 | C1 | passenlaag van Geld en wallet | — | — | lid | — | — | ontbreekt | groot | later (vraagt besluit) |
| C10 | Club bevestigt een gast (genre) | L2 | — | vraagt een nieuw genre | — | — | — | — | — | ontbreekt | groot | later (vraagt besluit) |
| C11 | Clubgids van RTG | — | — | — | — | — | — | — | — | — | — | **niet doen**: RTG zou gegevens over clubs verzinnen of overnemen |

#### e. RTG-exclusief
- Reizen, clubs en gelegenheden in één keten: Reisboek stelt de club voor, en Table plant het diner daar.
- Elk antwoord is eerlijk over wat RTG niet weet: geen gids, geen verificatie.

#### f. Bouwstenen en ontbrekende koppelingen
**Bestaat:**
- `cercle.js` (waarheen, gastlog);
- `reisboek.js`;
- `table.js`;
- `objectverwijzing.js`;
- `notify`.

**Ontbreekt:**
- de velden vervaldatum en gastregel;
- de verwijzing vanuit Reisboek;
- letterlijke API-paden.

#### g. Prioritering
1. C4, C5 en C6: klein.
2. C7: middel.
3. C8: later.
4. C9 en C10: besluit.

#### h. Toetsbaar eindcontract

| Dimensie | Criterium |
|---|---|
| Breedte | Clubs, reciprociteit, gastpassen, vervaldata en introducés-regels. |
| Professionele diepte | De gastregel per club wordt geteld per kalenderjaar. |
| Levenscyclus | Van lidmaatschap tot verlenging en weghalen; terugdraaien bewezen. |
| Samenwerking en rollen | De assistent of het mandaat kan waarheen opvragen (later). |
| Domeinintelligentie | Waarheen rekent alleen met eigen invoer en zegt dat. |
| Los functioneren | Volledig zonder andere apps. |
| RTG-ketens | Reisboek verwijst naar Cercle, Table naar de club. |
| Bewezen betrouwbaarheid | Bevoegd BEWEZEN. |

#### Deel B — domeinmaximum (buiten de huidige scope; vraagt besluit)

| # | Proces | Gegevens en bron | Regels en rekenwijze | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium |
|---|---|---|---|---|---|---|
| CB1 | **Clubgenre: ledenadministratie en introducés** | leden (codenaam), lidmaatschapssoort, introducés-beleid | De club houdt zelf haar ledenlijst bij. Een introducé wordt aangemeld door een lid en gecontroleerd tegen het beleid (max per jaar, begeleid). | club (nieuw genre "besloten club"), lid | Een gast van een reciprociteitsclub: de brief of het kaartje wordt als stuk gecontroleerd door een mens van de club | Bij een derde introducé boven een maximum van 2 weigert de club met de reden. Het lid ziet dat vooraf in Cercle. |
| CB2 | **Reciprociteitsbrief op aanvraag** | lid, thuisclub, gastclub, data | Het lid vraagt via Cercle een introductiebrief bij de thuisclub aan. De thuisclub geeft hem af met een geldigheidsperiode. De gastclub ziet alleen de brief. | lid, thuisclub, gastclub | De thuisclub weigert: het lid hoort de reden | De gastclub ontvangt een brief met de geldigheid en de codenaam, verifieerbaar en zonder ledenlijst. |
| CB3 | **Contributie en verlenging** | lidmaatschap, termijn, bedrag | De club stuurt een verlengverzoek. Het lid betaalt via Geld. Na betaling krijgt het lidmaatschap een nieuwe vervaldatum. | club, lid, Geld | Niet betaald: het lidmaatschap verloopt; het lid ziet de datum | Na de betaling staat de nieuwe vervaldatum in Cercle, en de betaling staat in Geld met de verwijzing. |

**Modus LOS.** Volledig zelfstandig, en eerlijk over de grens.

**Modus SAMEN.**
- **Uitgeven:** waarheen als verwijzing aan Reisboek; de club als plaats aan Table; vervaldata als projectie in Vandaag.
- **Geld:** een contributie is geen Cercle-object. Hooguit een verwijzing in de bestedingenprojectie, met toestemming.

**Gebruikersketen met storingen.**
1. Het lid zet in Reisboek een reis naar Milaan.
2. Reisboek toont twee clubs via Cercle.
3. Het lid opent Cercle en gebruikt een gastpas voor K.
4. De afspraak gaat niet door; het lid draait de pas terug.

Storingen:
- **Geen passen meer:** weigering met de reden.
- **Introducés-maximum bereikt:** waarschuwing.
- **Dubbeltik:** één pas eraf (bewezen).
- **Geen club in de stad:** het antwoord zegt dat.
- **Reisboek uit:** waarheen werkt in Cercle zelf (LOS).

**Vraagt besluit.** Een genre "besloten club"; de walletkaart. **Extern.** Geen, zolang RTG geen gids voert.

---

### Voor de integrator (buiten mijn apps; eigenaar volgens SCHERMEIGENAAR.json)
- **Allergenen per gerecht** (Table T4) is dezelfde behoefte als bij `horeca.bestellen` en `horeca.reserveren` (foodcourt). Eén bron voor de 14 allergenen hoort bij de horecakant; Table moet die codelijst ontvangen en niet kopiëren.
- **Gastenlijst, check-in en wachtlijst** (Uitgaan) bestaan ook bij `horeca.events`, `horeca.club` en `festival.gast`. De regels (capaciteit, 18+, check-in-log) horen bij de zaakkant. Uitgaan is alleen de ledenkant.
- **Verjaardagen** bestaan ook in `gezin.verjaardagen` (FoundationOS) en `agenda.afspraken`. Attenties houdt de relaties van het lid; geen dubbele verjaardagslogica. De vooruitblik hoort in Vandaag en Leven als projectie.
- **Gezondheidsgegevens van derden** (dieet bij Table, voorkeuren bij Attenties): een huisbrede bewaarregel zou in de bestaande privacylaag horen, niet per app.


---

